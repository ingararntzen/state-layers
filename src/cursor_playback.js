import { Cursor } from "./cursor_base.js";
import { Layer } from "./layer_base.js";
import { 
    LOCAL_CLOCK_PROVIDER, 
    is_clock_provider 
} from "./provider_clock.js";
import { is_segments_layer } from "./layer_segments.js";
import * as srcprop from "./api_srcprop.js";
import {interval} from "./intervals.js";
import { set_timeout, check_number, 
    motion_utils, is_finite_number } from "./util.js";


export function playback_cursor(options={}) {

    const {src, ctrl=LOCAL_CLOCK_PROVIDER} = options;
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

    cursor.srcprop_check = function (propName, obj) {
        if (propName == "ctrl") {
            if (is_clock_provider(obj) || obj instanceof Cursor) {
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
        onchange();
    }

    function onchange() {
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
        const ctrl_state = get_ctrl_state();
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

        if (is_clock_provider(cursor.ctrl)) {
            /* 
                cursor.ctrl is a clock provider

                possible timeout associated with leaving region
                through region_high - as clock is increasing.
            */
            const delta_ms = (region_high - current_pos) * 1000;
            tid = set_timeout(() => {
                onchange();
            }, delta_ms);
            console.log("playback timeout", delta_ms)
            // leave event scheduled
            return;
        } 
        
        if (is_clock_provider(cursor.ctrl.ctrl) && is_segments_layer(cursor.ctrl.src)) {
            /* 
                cursor.ctrl is a cursor with a clock provider

                possible timeout associated with leaving region
                through region_low or region_high.

                However, this can only be predicted if cursor.ctrl
                implements a deterministic function of time.

                This can be the case if cursor.ctr.src is a segments layer,
                and the current item describes either a motion or a transition (with linear easing).                
            */
            const active_items = cursor.ctrl.src.get_items(current_ts);
            // prediction depends on a single active item, either motion or transition
            if (active_items.length == 1) {
                const active_item = active_items[0];
                if (active_item.type == "motion") {
                    const {velocity, acceleration=0.0} = active_item.data;
                    // TODO calculate timeout with acceleration too
                    if (acceleration == 0.0) {
                        // figure out which boundary we hit first
                        let target_pos = (velocity > 0) ? region_high : region_low;
                        console.log(target_pos, current_pos)
                        const delta_ms = (target_pos - current_pos) * 1000;
                        tid = set_timeout(() => {
                            console.log("motion timeout")
                            onchange();
                        }, delta_ms);
                        // leave event scheduled
                        return;
                    }

                } else if (active_item.type == "transition") {
                    console.log("transition - should make timeout")
                    // leave event scheduled
                    // return;
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
        console.log("polling")
        let offset = cursor.ctrl.value;
        if (!interval.covers_endpoint(itv, offset)) {
            cursor.onchange();
        }
    }

    /**
     * internal method
     * get current state from cursor.ctrl (Cursor or clockProvider)
     * ensure that cursor.ctrl return a number offset
     * 
     */
    function get_ctrl_state () {
        if (is_clock_provider(cursor.ctrl)) {
            const ts = cursor.ctrl.now();
            return {value:ts, dynamic:true, offset:ts};
        } else {
            const state = cursor.ctrl.query();
            const offset = cursor.ctrl.value;
            // protect against nonnumber values
            if (!is_finite_number(offset)) {
                throw new Error(`warning: cursor ctrl value must be number ${offset}`);
            }
            return state;
        }
    }

    cursor.query = function query() {
        const offset = get_ctrl_state().value; 
        return src_cache.query(offset);
    }


    /*
      
        return the currently active items of the cursor
        - only applicable if src is segment layer
        - basis for segment and current value
        - typically just one

    */
    cursor.get_items = function get_items() {
        const offset = get_ctrl_state().value; 
        return cursor.src.get_items(offset);
    }
    
    // initialize
    cursor.ctrl = ctrl;
    cursor.src = src;
    return cursor;
}