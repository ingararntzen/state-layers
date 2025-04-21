import { Cursor } from "./cursor_base.js";
import { Layer } from "./layer_base.js";
import * as srcprop from "./util/api_srcprop.js";
import { check_number, set_timeout} from "./util/common.js";
import { interval } from "./util/intervals.js";


/*****************************************************
 * PLAYBACK CURSOR
 *****************************************************/

/**
 * generic playback cursor
 * 
 * "src" is a layer
 * "ctrl" is cursor (Number)
 * returns a cursor
 */

export function playback_cursor(options={}) {

    const {ctrl, src, 
        mutable=false} = options;

    let src_cache; // cache for src layer
    let tid; // timeout
    let pid; // polling

    const cursor = new Cursor();

    /**********************************************************
     * RESTRICTIONS
     **********************************************************/

    Object.defineProperty(cursor, "numeric", {get: () => {
        return (cursor.src != undefined) ? cursor.src.numeric : false;
    }});
    Object.defineProperty(cursor, "mutable", {get: () => {
        return (cursor.src != undefined) ? (cursor.src.mutable && mutable) : false;
    }});
    Object.defineProperty(cursor, "fixedRate", {get: () => false});
    Object.defineProperty(cursor, "itemsOnly", {get: () => {
        return (cursor.src != undefined) ? cursor.src.itemsOnly : false;
    }});

    
    /**********************************************************
     * SRC AND CTRL PROPERTIES
     **********************************************************/

    srcprop.addState(cursor);
    srcprop.addMethods(cursor);
    cursor.srcprop_register("ctrl");
    cursor.srcprop_register("src");

    cursor.srcprop_check = function (propName, obj) {
        if (propName == "ctrl") {
            if (!(obj instanceof Cursor) || obj.numeric == false) {
                throw new Error(`"ctrl" property must be a numeric cursor ${obj}`);
            }
            return obj;
        }
        if (propName == "src") {
            if (!(obj instanceof Layer)) {
                throw new Error(`"src" property must be a layer ${obj}`);
            }
            return obj;
        }
    }
    cursor.srcprop_onchange = function (propName, eArg) {
        if (cursor.src == undefined || cursor.ctrl == undefined) {
            return;
        }
        if (propName == "src") {
            if (eArg == "reset") {
                src_cache = cursor.src.createCache();
            } else {
                src_cache.clear();                
            }
        }
        cursor.onchange();
    }

    cursor.query = function query(local_ts) {
        let offset = cursor.ctrl.query(local_ts).value;
        // should not happen
        check_number("cursor.ctrl.offset", offset);
        const state = src_cache.query(offset);
        // if (src) layer is numeric, default value 0 
        // is assumed in regions where the layer is undefined
        if (cursor.src.numeric && state.value == undefined) {
            state.value = 0.0;
        }
        return state;
    }

    cursor.active_items = function get_item(local_ts) {
        if (cursor.itemsOnly) {
            const offset = cursor.ctrl.query(local_ts).value;
            return cursor.src.index.nearby(offset).center;    
        }
    }

    /**********************************************************
     * DETECT FUTURE EVENT
     **********************************************************/

    /**
     * fixed rate cursors never change their behavior - and
     * consequently never has to invoke any callbacks / events
     * 
     * Other cursors may change behaviour at a future time.
     * If this future change is caused by a state change - 
     * either in (src) layer or (ctrl) cursor - events will be 
     * triggered in response to this. 
     * 
     * However, cursors may also change behaviour at a future time moment
     * in time, without any causing state change. This may happen during 
     * playback, as the (ctrl) cursor leaves the current region 
     * of the (src) layer and enters into the next region.
     * 
     * This event must be detected, ideally at the right moment, 
     * so that the cursor can generate events, allowing observers to
     * react to the change. If the (ctrl) cursor behaves deterministically, 
     * this future event can be calculated ahead of time, 
     * and detected by timeout. Otherwise, the fallback solution is to
     * detect such future events by polling.
     * 
     * NOTE consumers of cursors might poll the cursor themselves, thus 
     * causing the event to be detected that way. However, there is no 
     * guarantee that this will happen. For example, in circumstances 
     * where the (src) layer region is static, consumers will turn
     * polling off, and depend on the change event from the cursor, in order 
     * to detect the change in behavior.
     * 
     */
    cursor.detect_future_event = function detect_future_event() {

        cancel_timeout();
        cancel_polling();

        // no future timeout if cursor itself is fixedRate
        if (cursor.fixedRate) {
            return;
        }

        // all other cursors must have (src) and (ctrl)
        if (cursor.ctrl == undefined) {
            throw new Error("cursor.ctrl can not be undefined with isFixedRate=false");
        }
        if (cursor.src == undefined) {
            throw new Error("cursor.src can not be undefined with isFixedRate=false");
        }

        // current state of cursor.ctrl 
        const {value:pos0, dynamic, offset:ts0} = cursor.ctrl.query();

        // no future timeout if cursor.ctrl is static
        if (!dynamic) {
            return;
        }

        // current region of cursor.src
        const src_nearby = cursor.src.index.nearby(pos0);
        const src_region_low = src_nearby.itv[0] ?? -Infinity;
        const src_region_high = src_nearby.itv[1] ?? Infinity;

        // no future timeout if the region is infinite 
        if (src_region_low == -Infinity && src_region_high == Infinity) {
            // will never leave region
            return;
        }

        // check if condition for clock timeout is met
        if (cursor.ctrl.fixedRate) {
            /* 
                cursor.ctrl is fixed rate (clock)
                future timeout when cursor.ctrl leaves src_region (on the right)
            */
            const vector = [pos0, cursor.ctrl.rate, 0, ts0];
            const target = src_region_high
            schedule_timeout(vector, target);
            return;
        }

        // check if conditions for motion timeout are met
        // cursor.ctrl.ctrl must be fixed rate
        // cursor.ctrl.src must have itemsOnly == true 
        if (cursor.ctrl.ctrl.fixedRate && cursor.ctrl.src.itemsOnly) {

            /* 
                possible timeout associated with leaving region
                through either region_low or region_high.

                However, this can only be predicted if cursor.ctrl
                implements a deterministic function of time.
                This can be known only if cursor.ctrl.src is a layer with items.
                and a single active item describes either a motion or a transition 
                (with linear easing).                
            */
            const active_items = cursor.ctrl.src.get_items(ts0);
            if (active_items.length == 1) {
                const active_item = active_items[0];
                if (active_item.type == "motion") {
                    const [p,v,a,t] = active_item.data;
                    // TODO calculate timeout with acceleration too
                    if (a == 0.0) {
                        // figure out which region boundary we hit first
                        const target = (v > 0) ? src_region_high : src_region_low;
                        const vector = [pos0, v, 0, ts0];
                        schedule_timeout(vector, target);
                        return;
                    }
                } else if (active_item.type == "transition") {
                    const {v0, v1, t0, t1, easing="linear"} = active_item.data;
                    if (easing == "linear") {
                        // linear transition
                        const v = (v1-v0)/(t1-t0);
                        let target = (v > 0) ? Math.min(v1, src_region_high) : Math.max(v1, src_region_low);
                        const vector = [pos0, v, 0, ts0];
                        schedule_timeout(vector, target);
                        return;                           
                    }
                }
            }
        }            

        /**
         * detection of leave events falls back on polling
         */
        start_polling(src_nearby.itv);
    }

    /**********************************************************
     * TIMEOUT
     **********************************************************/

    function schedule_timeout(vector, target) {
        const [p,v,a,t] = vector;
        if (a != 0) {
            throw new Error("timeout not yet implemented for acceleration");
        }
        if (target == Infinity) {
            // no timeout
            return;
        }
        const delta_sec = (target - p) / v;
        tid = set_timeout(handle_timeout, delta_sec * 1000.0);
    }

    function handle_timeout() {
        // event detected
        cursor.onchange();
    }

    function cancel_timeout() {
        if (tid != undefined) {
            tid.cancel(); 
        }    
    }

    /**********************************************************
     * POLLING
     **********************************************************/

    function start_polling(itv) {
        pid = setInterval(() => {
            handle_polling(itv);
        }, 100);
    }

    function handle_polling(itv) {
        let pos = cursor.ctrl.value;
        if (!interval.covers_endpoint(itv, pos)) {
            // event detected
            cursor.onchange();
        }
    }

    function cancel_polling() {
        if (pid != undefined) { 
            clearInterval(pid); 
        }
    }
 
    /**********************************************************
     * INITIALIZATION
     **********************************************************/
    cursor.ctrl = ctrl;
    cursor.src = src;
    return cursor;
}

