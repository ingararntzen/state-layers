import { Cursor } from "./cursor_base.js";
import { is_clock_provider, LOCAL_CLOCK_PROVIDER } from "./provider_clock.js";
import * as srcprop from "./api_srcprop.js";


export class ClockCursor extends Cursor {
    
    constructor(options={}) {
        super();

        // setup src property
        srcprop.addState(this);
        this.srcprop_register("ctrl");

        const {ctrl=LOCAL_CLOCK_PROVIDER} = options;
        this.ctrl = ctrl;
    }

    srcprop_check = function (propName, obj) {
        if (propName == "ctrl") {
            if (!is_clock_provider(obj)) {
                throw new Error(`"ctrl" must be a clock provider ${obj}`);
            }
            return obj;
        }
    }
    srcprop_onchange = function (propName, eArg) {
        if (propName == "ctrl") {
            this.onchange();
        }
    }

    query() {
        const ts = this.ctrl.now();
        return {value:ts, dynamic:true, offset:ts};
    }
}
srcprop.addMethods(ClockCursor.prototype);


export function clock (obj) {
    return new ClockCursor({ctrl:obj});
}
