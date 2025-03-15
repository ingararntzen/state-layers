import * as callback from "./api_callback.js";
import * as srcprop from "./api_srcprop.js";
import { LOCAL_CLOCK_PROVIDER, is_clockprovider } from "./clockprovider.js";
import { bind, release } from "./monitor.js";

/************************************************
 * CURSOR
 ************************************************/

/**
 * 
 * Cursor is abstract base class for cursors 
 * 
 * - src (layer) 
 * - ctrl (localClockProvider or Cursor)
 * - query
 * - change event
 * - bind/release
 */

export class Cursor {

    constructor () {

        // callbacks
        callback.addToInstance(this);
        // setup src properties
        srcprop.addToInstance(this);
        this.srcprop_register("src");
        this.srcprop_register("ctrl");
        // define change event
        eventify.addToInstance(this);
        this.eventifyDefine("change", {init:true});

        // timeout
        this._tid;
        // polling
        this._pid;
        // src cache
        this._src_cache;
    }

    /**********************************************************
     * SRCPROP: CTRL and SRC
     **********************************************************/

    srcprop_check(propName, obj) {
        if (propName == "ctrl") {
            if (!(is_clockprovider(obj) || obj instanceof Cursor)) {
                throw new Error(`"ctrl" must be clockProvider or Cursor ${obj}`)
            }
        } else if (propName == "src") {
            if (!(obj instanceof Layer)) {
                throw new Error(`"src" must be Layer ${obj}`);
            }
        }
        return obj;
    }

    srcprop_onchange(propName, eArg) {
        this.__handle_change(propName, eArg);
    }

    /**********************************************************
     * CALLBACK
     **********************************************************/

    __handle_change(origin, eArg) {
        clearTimeout(this._tid);
        clearInterval(this._pid);
        if (origin == "src" && eArg == "reset") {
            this._src_cache = this.src.getCache();
        }
        if (this.src && this.ctrl) {
            this.notify_callbacks();
            // trigger change event for cursor
            this.eventifyTrigger("change", this.query());
            // detect future change event - if needed
            this.__detect_future_change();
        }
    }

    /**
     * DETECT FUTURE CHANGE
     * 
     * PROBLEM:
     * 
     * During playback (cursor.ctrl is dynamic), there is a need to 
     * detect the passing from one segment interval of src
     * to the next - ideally at precisely the correct time
     * 
     * nearby.itv (derived from cursor.src) gives the 
     * interval (i) we are currently in, i.e., 
     * containing the current offset (value of cursor.ctrl), 
     * and (ii) where nearby.center stays constant
     * 
     * The event that needs to be detected is therefore the
     * moment when we leave this interval, through either
     * the low or high interval endpoint
     * 
     * GOAL:
     * 
     * At this moment, we simply need to reevaluate the state (query) and
     * emit a change event to notify observers. 
     * 
     * APPROACHES:
     * 
     * Approach [0] 
     * The trivial solution is to do nothing, in which case
     * observers will simply find out themselves according to their 
     * own poll frequency. This is suboptimal, particularly for low frequency 
     * observers. If there is at least one high-frequency poller, 
     * this would trigger trigger the state change, causing all
     * observers to be notified. The problem though, is if no observers
     * are actively polling, but only depending on change events.
     * 
     * Approach [1] 
     * In cases where the ctrl is deterministic, a timeout
     * can be calculated. This is trivial if ctrl is a ClockProvider, and
     * it is fairly easy if the ctrl is Cursor representing motion
     * or linear transition. However, calculations can become more
     * complex if motion supports acceleration, or if transitions
     * are set up with non-linear easing.
     *   
     * Note, however, that these calculations assume that the cursor.ctrl is 
     * a ClockProvider, or that cursor.ctrl.ctrl is a ClockProider. 
     * In principle, though, there could be a recursive chain of cursors,
     * (cursor.ctrl.ctrl....ctrl) of some length, where only the last is a 
     * ClockProvider. In order to do deterministic calculations in the general
     * case, all cursors in the chain would have to be limited to 
     * deterministic linear transformations.
     * 
     * Approch [2] 
     * It might also be possible to sample future values of 
     * cursor.ctrl to see if the values violate the nearby.itv at some point. 
     * This would essentially be treating ctrl as a layer and sampling 
     * future values. This approch would work for all types, 
     * but there is no knowing how far into the future one 
     * would have to seek. However, again - as in [1] the ability to sample future values
     * is predicated on cursor.ctrl being a ClockProvider. Also, there 
     * is no way of knowing how long into the future sampling would be necessary.
     * 
     * Approach [3] 
     * In the general case, the only way to reliabley detect the event is through repeated
     * polling. Approach [3] is simply the idea that this polling is performed
     * internally by the cursor itself, as a way of securing its own consistent
     * state, and ensuring that observer get change events in a timely manner, event
     * if they do low-frequency polling, or do not do polling at all. 
     * 
     * SOLUTION:
     * As there is no perfect solution in the general case, we opportunistically
     * use approach [1] when this is possible. If not, we are falling back on 
     * approach [3]
     * 
     * CONDITIONS when NO event detection is needed (NOOP)
     * (i) cursor.ctrl is not dynamic
     * or
     * (ii) nearby.itv stretches into infinity in both directions
     * 
     * CONDITIONS when approach [1] can be used
     * 
     * (i) if ctrl is a ClockProvider && nearby.itv.high < Infinity
     * or
     * (ii) ctrl.ctrl is a ClockProvider
     *      (a) ctrl.nearby.center has exactly 1 item
     *      &&
     *      (b) ctrl.nearby.center[0].type == ("motion") || ("transition" && easing=="linear")
     *      &&
     *      (c) ctrl.nearby.center[0].data.velocity != 0.0
     *      && 
     *      (d) future intersecton point with cache.nearby.itv 
     *          is not -Infinity or Infinity
     * 
     * Though it seems complex, conditions for [1] should be met for common cases involving
     * playback. Also, use of transition etc might be rare.
     * 
     */

    __detect_future_change() {

        // ctrl 
        const ctrl_vector = this._get_ctrl_state();
        const {value:current_pos, offset:current_ts} = ctrl_vector;

        // ctrl must be dynamic
        if (!ctrl_vector.dynamic) {
            // no future event to detect
            return;
        }

        // get nearby from src - use value from ctrl
        const src_nearby = this.src.index.nearby(current_pos);
        let [low, high] = src_nearby.itv.slice(0,2);        
        if (low == null) {
            low = -Infinity
        }
        if (high == null) {
            high = Infinity;
        }

        // approach [1]
        if (is_clockprovider(this.ctrl)) {
            if (isFinite(high)) {
                this.__set_timeout(high, current_pos, 1.0, current_ts);
                return;
            }
            // no future event to detect
            return;
        }
        if (is_clockprovider(this.ctrl.ctrl)) {
            /** 
             * this.ctrl is a cursor
             * 
             * has many possible behaviors
             * this.ctrl has an index use this to figure out which
             * behaviour is current.
             * 
            */
            if (!isFinite(low) && !isFinite(high)) {
                // no future event to detect
                return;
            }
            // use the same offset that was used in the ctrl.query
            // assuming that this.ctrl.src is InputLayer with segments
            const ctrl_src_nearby = this.ctrl.src.index.nearby(current_ts);

            if (ctrl_src_nearby.center.length == 1) {
                const seg = ctrl_src_nearby.center[0];
                if (seg.type == "motion") {
                    const {velocity, acceleration=0.0} = seg.data;
                    if (acceleration == 0.0) {
                        // figure out which boundary we hit first
                        let target_pos = (velocity > 0) ? high : low;
                        if (isFinite(target_pos)) {
                            this.__set_timeout(target_pos, current_pos, velocity, current_ts);
                            return;                           
                        } 
                        // no future event to detect
                        return;
                    }
                    // acceleration - possible event to detect
                } else if (seg.type == "transition") {
                    const {v0:p0, v1:p1, t0, t1, easing="linear"} = seg.data;
                    if (easing == "linear") {
                        // linear transtion
                        let velocity = (p1-p0)/(t1-t0);
                        // figure out which boundary we hit first
                        const target_pos = (velocity > 0) ? Math.min(high, p1) : Math.max(low, p1);
                        this.__set_timeout(target_pos, current_pos, 
                            velocity, current_ts);
                        //
                        return;
                    }
                    // other easing - possible event to detect
                }
                // other type (interpolation) - possible event to detect
            }
            // more than one segment - possible event to detect
        }

        // possible event to detect - approach [3]
        this.__set_polling(src_nearby.itv);
    }

    /**
     * set timeout
     * - protects against too early callbacks by rescheduling
     * timeout if neccessary.
     * - adds a millisecond to original timeout to avoid
     * frequent rescheduling 
     */

    __set_timeout(target_pos, current_pos, velocity, current_ts) {
        const delta_sec = (target_pos - current_pos) / velocity;
        const target_ts = current_ts + delta_sec;
        this._tid = setTimeout(() => {
            this.__handle_timeout(target_ts);
        }, delta_sec*1000 + 1);
    }

    __handle_timeout(target_ts) {
        const ts = this._get_ctrl_state().offset;
        const remaining_sec = target_ts - ts; 
        if (remaining_sec <= 0) {
            // done
            this.__handle_change("timeout");
        } else {
            // reschedule timeout
            this._tid = setTimeout(() => {
                this.__handle_timeout(target_ts)
            }, remaining_sec*1000);
        }
    }

    /**
     * set polling
     */

    __set_polling(itv) {
        this._pid = setInterval(() => {
            this.__handle_poll(itv);
        }, 100);
    }

    __handle_poll(itv) {
        let offset = this.ctrl.query().value;
        if (!interval.covers_point(itv, offset)) {
            this.__handle_change("timeout");
        }
    }


    /**********************************************************
     * QUERY API
     **********************************************************/

    /**
     * internal method
     * get current state from the ctrl of the cursor
     */
    _get_ctrl_state () {
        if (is_clockprovider(this.ctrl)) {
            let ts = this.ctrl.now();
            return {value:ts, dynamic:true, offset:ts};
        } else {
            let state = this.ctrl.query();
            // protect against non-float values
            if (typeof state.value !== 'number') {
                throw new Error(`warning: ctrl value must be number ${state.value}`);
            }
            return state;
        }
    }

    query() {
        const offset = this._get_ctrl_state().value; 
        return this._src_cache.query(offset);
    }

    get value () {return this.query().value};

    /*
        Eventify: immediate events
    */
    eventifyInitEventArgs(name) {
        if (name == "change") {
            return [this.query()];
        }
    }
    
    /**********************************************************
     * BIND RELEASE (convenience)
     **********************************************************/

    bind(callback, delay, options={}) {
        return bind(this, callback, delay, options);
    }
    release(handle) {
        return release(handle);
    }
}
callback.addToPrototype(Layer.prototype);
srcprop.addToPrototype(Cursor.prototype);
eventify.addToPrototype(Cursor.prototype);


/**
 * ClockCursor exposes a clockProvider directly as a Cursor
 * So it does not need a src
 */
export class ClockCursor extends Cursor {
    constructor (ctrl=LOCAL_CLOCK_PROVIDER) {
        super();
        if (!(is_clockprovider(ctrl))) {
            throw new Error(`"ctrl" must be clockProvider ${ctrl}`)
        }
        this.ctrl = ctrl;        
    }
    query() {
        return this._get_ctrl_state();
    }
}



