import * as srcprop from "./api_srcprop.js";
import { LOCAL_CLOCK_PROVIDER, is_clockprovider } from "./clockprovider.js";
import { cmd } from "./cmd.js";
import { Layer } from "./layers.js";
import { interval } from "./intervals.js";
import { bind, release } from "./monitor.js";
import { NearbyIndexBase } from "./nearbyindex_base.js";



/**
 * Cursor emulates Layer interface.
 * Part of this is to prove an index for the timeline. 
 * However, when considered as a layer, the cursor value is 
 * independent of timeline offset, which is to say that
 * it has the same value for all timeline offsets.
 * 
 * Unlike other Layers, the Cursor do not actually
 * use this index to resolve queries. It is only needed
 * for some generic Layer functionnality, like sampling,
 * which uses index.first() and index.last().
 */

class CursorIndex extends NearbyIndexBase {

    constructor(cursor) {
        super();
        this._cache = cursor.getCache();
    }

    nearby(offset) {
        // cursor index is defined for entire timeline
        return {
            itv: [-Infinity, Infinity, true, true],
            center: [this._cache],
            left: [-Infinity, 0],
            prev: [-Infinity, 0],
            right: [Infinity, 0],
            next: [Infinity, 0],
        }
    }
}

/**
 * 
 * Cursor cache implements the query operation for 
 * the Cursor, ignoring the given offset, replacing it 
 * with an offset from the ctrl instead. 
 * The layer cache is used to resolve the query 
 */

class CursorCache {
    constructor(cursor) {
        this._cursor = cursor;
        this._cache = this._cursor.src.getCache();
    }

    query() {
        const offset = this._cursor._get_ctrl_state().value; 
        return this._cache.query(offset);
    }

    clear() {
        this._cache.clear();
    }
}


/************************************************
 * CURSOR
 ************************************************/

/**
 * 
 * Cursor glides along a layer and exposes the current layer
 * value at any time
 * - has mutable ctrl (localClockProvider or Cursor)
 * - has mutable src (layer)
 * - methods for assign, move, transition, interpolation
 */

export class Cursor extends Layer {

    constructor (options={}) {
        super({CacheClass:CursorCache});

        // setup src properties
        srcprop.addToInstance(this);
        this.srcprop_register("src");
        this.srcprop_register("ctrl");

        // timeout
        this._tid;
        // polling
        this._pid;

        // initialise ctrl, src
        let {src, ctrl} = options;
        this.ctrl = ctrl || LOCAL_CLOCK_PROVIDER;
        this.src = src;
    }

    /**********************************************************
     * SRCPROP: CTRL and SRC
     **********************************************************/

    srcprop_check(propName, obj) {
        if (propName == "ctrl") {
            if (is_clockprovider(obj) || obj instanceof Cursor) {
                throw new Error(`"ctrl" must be ClockProvider or Cursor ${obj}`)
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
        if (this.src && this.ctrl) {
            if (this.index == undefined || eArg == "reset") {
                // NOT used for cursor query 
                this.index = new CursorIndex(this);
            }
            this.clearCaches();
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
        const [low, high] = src_nearby.itv.slice(0,2);

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
             * this.ctrl 
             * 
             * has many possible behaviors
             * this.ctrl has an index use this to figure out which
             * behaviour is current.
             * 
            */
            // use the same offset that was used in the ctrl.query
            const ctrl_nearby = this.ctrl.index.nearby(current_ts);

            if (!isFinite(low) && !isFinite(high)) {
                // no future event to detect
                return;
            }
            if (ctrl_nearby.center.length == 1) {
                const ctrl_item = ctrl_nearby.center[0];
                if (ctrl_item.type == "motion") {
                    const {velocity, acceleration=0.0} = ctrl_item.data;
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
                } else if (ctrl_item.type == "transition") {
                    const {v0:p0, v1:p1, t0, t1, easing="linear"} = ctrl_item.data;
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
        let offset = this.query().value;
        if (!interval.covers_point(itv, offset)) {
            this.__handle_change("timeout");
        }
    }

    /**********************************************************
     * QUERY API
     **********************************************************/

    _get_ctrl_state () {
        if (is_clockprovider(this.ctrl)) {
            let ts = this.ctrl.now();
            return {value:ts, dynamic:true, offset:ts};
        } else {
            let state = this.ctrl.query();
            // protect against non-float values
            if (typeof state.value !== 'number') {
                throw new Error(`warning: ctrl state must be number ${state.value}`);
            }
            return state;
        }
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

    /**********************************************************
     * UPDATE API
     **********************************************************/

    assign(value) {
        return cmd(this.src.src).assign(value);
    }
    move ({position, velocity}) {
        let {value, offset:timestamp} = this.query();
        if (typeof value !== 'number') {
            throw new Error(`warning: cursor state must be number ${value}`);
        }
        position = (position != undefined) ? position : value;
        velocity = (velocity != undefined) ? velocity: 0;
        return cmd(this.src.src).move({position, velocity, timestamp});
    }
    transition ({target, duration, easing}) {
        let {value:v0, offset:t0} = this.query();
        if (typeof v0 !== 'number') {
            throw new Error(`warning: cursor state must be number ${v0}`);
        }
        return cmd(this.src.src).transition(v0, target, t0, t0 + duration, easing);
    }
    interpolate ({tuples, duration}) {
        let t0 = this.query().offset;
        // assuming timstamps are in range [0,1]
        // scale timestamps to duration
        tuples = tuples.map(([v,t]) => {
            return [v, t0 + t*duration];
        })
        return cmd(this.src.src).interpolate(tuples);
    }

}
srcprop.addToPrototype(Cursor.prototype);
srcprop.addToPrototype(Cursor.prototype);

