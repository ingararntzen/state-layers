import { Cursor, get_cursor_ctrl_state } from "./cursor_base.js";
import { Layer } from "./layer_base.js";
import { is_items_layer } from "./layer_items.js";
import * as srcprop from "./api_srcprop.js";
import { interval } from "./intervals.js";
import { set_timeout } from "./util.js";
import { is_clock_cursor } from "./cursor_clock.js";

/*****************************************************
 * PLAYBACK CURSOR
 *****************************************************/

export function playback_cursor(ctrl, src) {

    const cursor = new Cursor();

    // src cache
    let src_cache;
    // timeout
    let tid;
    // polling
    let pid;

    // setup src property
    srcprop.addState(cursor);
    srcprop.addMethods(cursor);
    cursor.srcprop_register("ctrl");
    cursor.srcprop_register("src");

    /**
     * src property initialization check
     */
    cursor.srcprop_check = function (propName, obj) {
        if (propName == "ctrl") {
            if (obj instanceof Cursor) {
                return obj
            } else {
                throw new Error(`ctrl must be clockProvider or Cursor ${obj}`);
            }
        }
        if (propName == "src") {
            if (obj instanceof Layer) {
                return obj;
            } else {
                throw new Error(`src must be Layer ${obj}`);
            }
        }
    }

    /**
     * handle src property change
     */
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
        cursor_onchange();
    }

    /**
     * main cursor change handler
     */
    function cursor_onchange() {
        cursor.onchange();
        detect_future_event();
    }

    /**
     * cursor.ctrl (cursor/clock) defines an active region of cursor.src (layer)
     * at some point in the future, the cursor.ctrl will leave this region.
     * in that moment, cursor should reevaluate its state - so we need to 
     * detect this event, ideally by timeout, alternatively by polling.  
     */
    function detect_future_event() {
        if (tid) { tid.cancel(); }
        if (pid) { clearInterval(pid); }

        // current state of cursor.ctrl 
        const ctrl_state = get_cursor_ctrl_state(cursor);
        // current (position, time) of cursor.ctrl
        const current_pos = ctrl_state.value;
        const current_ts = ctrl_state.offset;

        // no future event if the ctrl is static
        if (!ctrl_state.dynamic) {
            // will never leave region
            return;
        }

        // current region of cursor.src
        const src_nearby = cursor.src.index.nearby(current_pos);

        const region_low = src_nearby.itv[0] ?? -Infinity;
        const region_high = src_nearby.itv[1] ?? Infinity;

        // no future leave event if the region covers the entire timeline 
        if (region_low == -Infinity && region_high == Infinity) {
            // will never leave region
            return;
        }

        if (is_clock_cursor(cursor.ctrl)) {
            /* 
                cursor.ctrl is a clock provider

                possible timeout associated with leaving region
                through region_high - as clock is increasing.
            */
           const target_pos = region_high;
            const delta_ms = (target_pos - current_pos) * 1000;
            tid = set_timeout(() => {
                cursor_onchange();
            }, delta_ms);
            // leave event scheduled
            return;
        } 
        
        if (
            is_clock_cursor(cursor.ctrl.ctrl) && 
            is_items_layer(cursor.ctrl.src)
        ) {
            /* 
                cursor.ctrl is a cursor with a clock provider

                possible timeout associated with leaving region
                through region_low or region_high.

                However, this can only be predicted if cursor.ctrl
                implements a deterministic function of time.

                This can be the case if cursor.ctr.src is an items layer,
                and a single active item describes either a motion or a transition (with linear easing).                
            */
            const active_items = cursor.ctrl.src.get_items(current_ts);
            let target_pos;

            if (active_items.length == 1) {
                const active_item = active_items[0];
                if (active_item.type == "motion") {
                    const {velocity, acceleration} = active_item.data;
                    // TODO calculate timeout with acceleration too
                    if (acceleration == 0.0) {
                        // figure out which region boundary we hit first
                        if (velocity > 0) {
                            target_pos = region_high;
                        } else {
                            target_pos = region_low;
                        }
                        const delta_ms = (target_pos - current_pos) * 1000;
                        tid = set_timeout(() => {
                            cursor_onchange();
                        }, delta_ms);
                        // leave-event scheduled
                        return;
                    }
                } else if (active_item.type == "transition") {
                    const {v0, v1, t0, t1, easing="linear"} = active_item.data;
                    if (easing == "linear") {
                        // linear transtion
                        let velocity = (v1-v0)/(t1-t0);
                        if (velocity > 0) {
                            target_pos = Math.min(region_high, v1);
                        }
                        else {
                            target_pos = Math.max(region_low, v1);
                        }
                        const delta_ms = (target_pos - current_pos) * 1000;
                        tid = set_timeout(() => {
                            cursor_onchange();
                        }, delta_ms);
                        // leave-event scheduled
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

    /**
     * start polling
     */
    function start_polling(itv) {
        pid = setInterval(() => {
            handle_polling(itv);
        }, 100);
    }

    /**
     * handle polling
     */
    function handle_polling(itv) {
        let offset = cursor.ctrl.value;
        if (!interval.covers_endpoint(itv, offset)) {
            cursor_onchange();
        }
    }


    /**
     * main query function - resolving query
     * from cache object associated with cursor.src
     */

    cursor.query = function query() {
        const offset = get_cursor_ctrl_state(cursor).value; 
        return src_cache.query(offset);
    }
    
    // initialize
    cursor.ctrl = ctrl;
    cursor.src = src;
    return cursor;
}