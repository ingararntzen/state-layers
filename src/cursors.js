import { 
    ClockProviderBase,
    StateProviderBase,
    CursorBase, 
    LayerBase
} from "./bases.js";
import * as sourceprop from "./sourceprop.js";
import { cmd } from "./cmd.js";
import { Layer } from "./layers.js";
import { LOCAL_CLOCK_PROVIDER, LOCAL_EPOCH_PROVIDER } from "./clockproviders.js";


/************************************************
 * CLOCK CURSOR
 ************************************************/

/**
 * Convenience wrapping around a clock provider.
 * - makes it easy to visualize a clock like any other cursor
 * - allows cursor.ctrl to always be cursor type
 * - allows cursors to be driven by online clocks 
 */

class ClockCursor extends CursorBase {

    constructor (src) {
        super();
        // src
        sourceprop.addToInstance(this, "src");
        this.src = src;
    }

    /**********************************************************
     * SRC (stateprovider)
     **********************************************************/

    __src_check(src) {
        if (!(src instanceof ClockProviderBase)) {
            throw new Error(`"src" must be ClockProvider ${src}`);
        }
    }    
    __src_handle_change(reason) {
        /**
         * Local ClockProviders never change 
         * do change - in the sense that and signal change through
         * this callback.
         * 
         * Currently we ignore such changes, on the assumtion
         * that these changes are small and that
         * there is no need to inform the application about it.
         * 
         * However, we we do not ignore switching between clocks,
         * which may happen if one switches from a local clock
         * to an online source. Note however that switching clocks
         * make most sense if the clocks are within the same time domain
         * for example, switching from local epoch to global epoch,
         * whi
         */
        // 
        if (reason == "reset") {
            this.notify_callbacks();
        }
    }

    query () {
        let ts =  this.src.now();
        return {value:ts, dynamic:true, offset:ts}
    }
}
sourceprop.addToPrototype(ClockCursor.prototype, "src", {mutable:true});

// singleton clock cursors
const localClockCursor = new ClockCursor(LOCAL_CLOCK_PROVIDER);
const epochClockCursor = new ClockCursor(LOCAL_EPOCH_PROVIDER);


/************************************************
 * CURSOR
 ************************************************/

/**
 * 
 * Cursor is a variable
 * - has mutable ctrl cursor (default local clock)
 * - has mutable state provider (src) (default state undefined)
 * - methods for assign, move, transition, intepolation
 * 
 */

export class Cursor extends CursorBase {

    constructor (options={}) {
        super();
        // ctrl
        sourceprop.addToInstance(this, "ctrl");
        // src
        sourceprop.addToInstance(this, "src");
        // index
        this._index;
        // cursor maintains a cashe object for querying src layer
        this._cache;
        // timeout
        this._tid;
        // polling
        this._pid;
        // options
        let {src, ctrl, ...opts} = options;

        // initialise ctrl
        if (ctrl == undefined) {
            let {epoch=false} = options;
            ctrl = (epoch) ? epochClockCursor : localClockCursor;
        }
        this.ctrl = ctrl;

        // initialise state
        if (src == undefined) {
            src = new Layer(opts);
        } else if (src instanceof StateProviderBase) {
            src = new Layer({src});
        }
        this.src = src
    }

    /**********************************************************
     * CTRL (cursor)
     **********************************************************/

    __ctrl_check(ctrl) {
        if (!(ctrl instanceof CursorBase)) {
            throw new Error(`"ctrl" must be cursor ${ctrl}`)
        }
    }
    __ctrl_handle_change(reason) {
        this.__handle_change("ctrl", reason);
    }

    /**********************************************************
     * SRC (layer)
     **********************************************************/

    __src_check(src) {
        if (!(src instanceof LayerBase)) {
            throw new Error(`"src" must be Layer ${src}`);
        }
    }    
    __src_handle_change(reason) {
        this.__handle_change("src", reason);
    }

    /**********************************************************
     * CALLBACK
     **********************************************************/

    __handle_change(origin, reason) {
        clearTimeout(this._tid);
        clearInterval(this._pid);
        if (this.src && this.ctrl) {
            if (origin == "src") {
                // reset cursor index to layer index
                if (this._index != this.src.index) {
                    this._index = this.src.index;
                    this._cache = this.src.getCacheObject();
                }
            }
            if (origin == "src" || origin == "ctrl") {
                // reevaluate the cache
                this._cache.dirty();
                this._refresh();
            }
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
     * detect the passing from one segment interval
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
     * can be calculated. This is trivial if ctrl is a ClockCursor, and
     * it is fairly easy if the ctrl is Cursor representing motion
     * or linear transition. However, calculations can become more
     * complex if motion supports acceleration, or if transitions
     * are set up with non-linear easing.
     *   
     * Note, however, that these calculations assume that the cursor.ctrl is 
     * a ClockCursor, or that cursor.ctrl.ctrl is a ClockCursor. 
     * In principle, though, there could be a recursive chain of cursors,
     * (cursor.ctrl.ctrl....ctrl) of some length, where only the last is a 
     * ClockCursor. In order to do deterministic calculations in the general
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
     * is predicated on cursor.ctrl being a ClockCursor. Also, there 
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
     * (i) if ctrl is a ClockCursor && nearby.itv.high < Infinity
     * or
     * (ii) ctrl.ctrl is a ClockCursor
     *      (a) ctrl.nearby.center has exactly 1 item
     *      &&
     *      (b) ctrl.nearby.center[0].type == ("motion") || ("transition" && easing=="linear")
     *      &&
     *      (c) ctrl.nearby.center[0].args.velocity != 0.0
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
        const ctrl_vector = this.ctrl.query();
        const {value:current_pos} = ctrl_vector;

        // nearby.center - low and high
        this._cache.refresh(ctrl_vector.value);
        // TODO - should I get it from the cache?
        const src_nearby = this._cache.nearby;
        const [low, high] = src_nearby.itv.slice(0,2);

        // ctrl must be dynamic
        if (!ctrl_vector.dynamic) {
            return;
        }

        // approach [1]
        if (this.ctrl instanceof ClockCursor) {
            if (isFinite(high)) {
                this.__set_timeout(high, current_pos, 1.0);
            }
            return;
        } 
        if (
            this.ctrl instanceof Cursor && 
            this.ctrl.ctrl instanceof ClockCursor
        ) {
            // TODO - this only works if src of ctrl is a regular layer
            const ctrl_nearby = this.ctrl.cache.nearby;

            if (!isFinite(low) && !isFinite(high)) {
                return;
            }
            if (ctrl_nearby.center.length == 1) {
                const ctrl_item = ctrl_nearby.center[0];
                if (ctrl_item.type == "motion") {
                    const {velocity, acceleration=0.0} = ctrl_item.args;
                    if (acceleration == 0.0) {
                        // figure out which boundary we hit first
                        let target_pos = (velocity > 0) ? high : low;
                        if (isFinite(target_pos)) {
                            this.__set_timeout(target_pos, current_pos, velocity);
                            return;                           
                        } else {
                            // no need for timeout
                            return;
                        }
                    }
                } else if (ctrl_item.type == "transition") {
                    const {v0:p0, v1:p1, t0, t1, easing="linear"} = ctrl_item.args;
                    if (easing == "linear") {
                        // linear transtion
                        let velocity = (p1-p0)/(t1-t0);
                        // figure out which boundary we hit first
                        const target_pos = (velocity > 0) ? Math.min(high, p1) : Math.max(low, p1);
                        this.__set_timeout(target_pos, current_pos, velocity);
                        return;
                    }
                }
            }
        }

        // approach [3]
        this.__set_polling();
    }

    __set_timeout(target_pos, current_pos, velocity) {
        const delta_sec = (target_pos - current_pos)/velocity;
        this._tid = setTimeout(() => {
            // TODO - guarantee that timeout is not too early
            this.__handle_change("timeout");
        }, delta_sec*1000);
    }

    __set_polling() {
        this._pid = setInterval(() => {
            this.__handle_poll();
        }, 100);
    }

    __handle_poll() {
        this.query();
    }



    /**********************************************************
     * QUERY API
     **********************************************************/
    _refresh () {
        let {value:offset} = this.ctrl.query();
        if (typeof offset !== 'number') {
            throw new Error(`warning: ctrl state must be number ${offset}`);
        }
        let refreshed = this._cache.refresh(offset);
        return [offset, refreshed];
    }

    query () {
        let [offset, refreshed] = this._refresh();
        if (refreshed) {
            this.__handle_change("query");
        }
        return this._cache.query(offset);
    }

    get value () {return this.query().value};
    get cache () {return this._cache};
    get index () {return this._index};

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
sourceprop.addToPrototype(Cursor.prototype, "src", {mutable:true});
sourceprop.addToPrototype(Cursor.prototype, "ctrl", {mutable:true});

