

import { StateProviderBase, CursorBase } from "./bases.js";
import { source } from "./util.js";
import { SimpleStateProvider } from "./stateprovider_simple.js";
import { cmd } from "./cmd.js";
import { SimpleNearbyIndex } from "./nearbyindex_simple.js";
import { NearbyCache } from "./nearbycache.js";

/************************************************
 * CLOCKS
 ************************************************/

const CLOCK = function () {
    return performance.now()/1000.0;
}

/*
    NOTE 
    epoch should only be used for visualization,
    as it has time resolution limited to ms
*/

const EPOCH = function () {
    return Date.now()/1000.0;
}


/************************************************
 * CLOCK CURSORS
 ************************************************/

// CLOCK (counting seconds since page load)
class ClockCursor extends CursorBase {

    constructor (clock) {
        super();
        this._clock = clock;
        // items
        const t0 = this._clock();
        this._items = [{
            itv: [-Infinity, Infinity, true, true],
            type: "motion",
            args: {position: t0, velocity: 1, offset: t0}
        }];    
    }

    query () {
        let ts = this._clock(); 
        return {value:ts, dynamic:true, offset:ts};
    }

    items () {
        return this._items;
    }
}

export const local_clock = new ClockCursor(CLOCK);
export const local_epoch = new ClockCursor(EPOCH);



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
        source.addToInstance(this, "ctrl");
        // src
        source.addToInstance(this, "src");
        // index
        this._index = new SimpleNearbyIndex();
        // cache
        this._cache = new NearbyCache(this._index);
        // timeout
        this._tid;

        let {src, ctrl, ...opts} = options;

        // initialise ctrl
        if (ctrl == undefined) {
            ctrl = local_clock;
        }
        this.ctrl = ctrl;

        // initialise state
        if (src == undefined) {
            src = new SimpleStateProvider(opts);
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
    __ctrl_handle_change() {
        this.__handle_change();
    }

    /**********************************************************
     * SRC (stateprovider)
     **********************************************************/

    __src_check(src) {
        if (!(src instanceof StateProviderBase)) {
            throw new Error(`"src" must be state provider ${source}`);
        }
    }    
    __src_handle_change() {
        this.__handle_change();
    }

    /**********************************************************
     * CALLBACK
     **********************************************************/

    __handle_change() {
        // clean up old timeout
        clearTimeout(this._tid)

        if (this.src && this.ctrl) {
            this._index.update(this.src.items);
            this._cache.dirty();
            // trigger change event for cursor
            this.eventifyTrigger("change", this.query());
            /**
             * Playback support
             * 
             * During playback (ctrl signaling dynamic change)
             * there is a need to report passing from one segment interval
             * to the next - ideally at precisely the right time
             * 
             * [1] In cases where the ctrl is deterministic, this can
             * be achived by calculating a timeout.
             * 
             * [2] If ctrl is not deterministic, the cursor
             * could detect the event by polling internally, meaning
             * that polling observers could still observe changes at 
             * precisely the correct time, even if their poll frequency is low.
             * This is ineffective if the poll time is long.
             *  
             * [3] The fallback solution is to not do anything, in which case
             * observers will simply find out according to their own
             * poll frequency. 
             * 
             */
            let {
                value: ctrl_offset, 
                dynamic: ctrl_dynamic,
            } = this.ctrl.query();
    
            /**
             * - no need for playback timeout if there is no playback
             */

            if (!ctrl_dynamic) {
                return;
            }

            /**
             * - no need for playback timeout if current segment has no boundary
             * boundary of current segment - low and high
             */
            this._cache.refresh(ctrl_offset);
            const itv = this._cache.nearby.itv;
            const [low, high] = itv.slice(0,2);
            if (low == -Infinity && high == Infinity) {
                return;
            }

            /**
             * - no need for playback timeout if ctrl is not deterministic
             * - must have exactly on segment item - type motion
             */
            let ctrl_items = this.ctrl.items();
            if (ctrl_items.length != 1) {
                console.log(`warning: ctrl has multiple items ${this.ctrl}`);
                return;
            }
            const ctrl_item = ctrl_items[0];

            /**
             * option [1] 
             * - deterministic motion
             * - TODO - expand to fixed duration transitions
             * 
             * calculate the time to ctrl.value first hits low or high
             * i.e. time to end for current motion or transition
             */
            if (ctrl_item.type == "motion") {
                // calculate the time to ctrl.value first hits low or high
                const {velocity:v0} = ctrl_item.args;
                // figur out which boundary we hit first
                // assuming we are currently between low and high
                let target_position = (v0 > 0) ? high : low;
                // no need for timeout if boundary is infinity
                if (isFinite(target_position)) {
                    // calculate time until hitting target
                    const delta_sec = Math.abs(target_position - ctrl_offset)/v0;
                    console.log("set timeout")
                    this._tid = setTimeout(this.__handle_timeout.bind(this), delta_sec*1000);
                    return;
                }

            }

            /**
             * option [2] - polling until ctrl.value is no longer witin itv
             * NOT SUPPORTED
             * 
             * option [3] - do nothing
             */

        }
    }

    __handle_timeout() {
        // trigger change event for cursor
        console.log("timeout");
        this.eventifyTrigger("change");
    }



    /**********************************************************
     * QUERY API
     **********************************************************/
    
    query () {
        let {value:offset} = this.ctrl.query()
        if (typeof offset !== 'number') {
            throw new Error(`warning: ctrl state must be number ${offset}`);
        }
        return this._cache.query(offset);
    }

    get value () {return this.query().value};

    state () {
        // nearby.center represents the state of the cursor
        // the ensure that the cache is not stale - run a query first
        return this._cache.nearby.center;
    }

    /**********************************************************
     * UPDATE API
     **********************************************************/

    assign(value) {
        return cmd(this).assign(value);
    }
    move ({position, velocity}) {
        let {value, rate, offset:timestamp} = this.query();
        if (typeof value !== 'number') {
            throw new Error(`warning: cursor state must be number ${value}`);
        }
        position = (position != undefined) ? position : value;
        velocity = (velocity != undefined) ? velocity: rate;
        return cmd(this).move({position, velocity, timestamp});
    }
    transition ({target, duration, easing}) {
        let {value:v0, offset:t0} = this.query();
        if (typeof v0 !== 'number') {
            throw new Error(`warning: cursor state must be number ${v0}`);
        }
        return cmd(this).transition(v0, target, t0, t0 + duration, easing);
    }
    interpolate ({tuples, duration}) {
        let t0 = this.query().offset;
        // assuming timstamps are in range [0,1]
        // scale timestamps to duration
        tuples = tuples.map(([v,t]) => {
            return [v, t0 + t*duration];
        })
        return cmd(this).interpolate(tuples);
    }

}
source.addToPrototype(Cursor.prototype, "src", {mutable:true});
source.addToPrototype(Cursor.prototype, "ctrl", {mutable:true});

