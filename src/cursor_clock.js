import { Cursor } from "./cursor_base.js";
import { 
    LOCAL_CLOCK_PROVIDER, 
    is_clock_provider 
} from "./provider_clock.js";
import * as srcprop from "./api_srcprop.js";

export function clock_cursor(options={}) {

    const {ctrl=LOCAL_CLOCK_PROVIDER} = options;
    const cursor = new Cursor();

    // setup src property
    srcprop.addState(cursor);
    srcprop.addMethods(cursor);
    cursor.srcprop_register("ctrl");

    cursor.srcprop_check = function (propName, obj) {
        if (propName == "ctrl") {
            if (!is_clock_provider(obj)) {
                throw new Error(`"ctr" must be a clock provider ${obj}`);
            }
            return obj;
        }
    }
    cursor.srcprop_onchange = function (propName, eArg) {
        if (propName == "ctrl") {
            cursor.onchange();
        }
    }

    cursor.query = function () {
        const ts = this.ctrl.now();
        return {value:ts, dynamic:true, offset:ts};
    }

    // initialize
    cursor.ctrl = ctrl;

    return cursor;
}