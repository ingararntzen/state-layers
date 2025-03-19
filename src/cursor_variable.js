import { Cursor } from "./cursor_base.js";
import { 
    LOCAL_CLOCK_PROVIDER, 
    is_clock_provider 
} from "./provider_clock.js";
import { is_segments_layer } from "./layer_segments.js";
import * as srcprop from "./api_srcprop.js";
import { set_timeout } from "./util.js";

export function variable_cursor(options={}) {

    const {src, ctrl=LOCAL_CLOCK_PROVIDER} = options;
    const cursor = new Cursor();

    // cache for src
    let src_cache;
    // timeout
    let timeout;

    // setup src property
    srcprop.addState(cursor);
    srcprop.addMethods(cursor);
    cursor.srcprop_register("ctrl");
    cursor.srcprop_register("src");

    cursor.srcprop_check = function (propName, obj) {
        if (propName == "ctrl") {
            if (!is_clock_provider(obj)) {
                throw new Error(`ctrl must be a clock provider ${obj}`);
            }
            return obj;
        }
        if (propName == "src") {
            if (!is_segments_layer(obj)) {
                throw new Error(`src must be a segments layer ${obj}`);
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
                src_cache.clearCache();                
            }
        }
        detect_future_change();
        cursor.onchange();
    }

    function detect_future_change() {
        if (timeout) {
            timeout.cancel();
            timeout = undefined;
        }
        // ctrl 
        const ts = cursor.ctrl.now();
        // nearby from src
        const nearby = cursor.src.index.nearby(ts);
        const high = nearby.itv[1] || Infinity;        
        if (isFinite(high)) {
            const delta_sec = high - ts;
            timeout = set_timeout(delta_sec, () => {
                cursor.onchange();
            });
        }
    }

    cursor.query = function () {
        const offset = cursor.ctrl.now();
        return src_cache.query(offset);
    }

    // initialize
    cursor.ctrl = ctrl;
    cursor.src = src;
    return cursor;
}