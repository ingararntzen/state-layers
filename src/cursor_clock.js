import { Cursor } from "./cursor_base.js";
import { ClockProvider } from "./provider_clock.js";
import * as srcprop from "./util/api_srcprop.js";
import { local_clock } from "./util/common.js";

/**
 * Clock Cursor is a cursor that wraps a clock provider, which is available 
 * on the provider property.
 * 
 * Clock cursor does not depend on a src layer or a ctrl cursor. 
 * Clock cursor is FixedRate Cursor (bpm 1)
 * Clock cursor is NumberOnly
 * 
 * Clock cursor take options {skew, scale} to transform the clock value.
 * Scale is multiplier to the clock value, applied before the skew so that
 * it preserves the zero point.
 * 
 * The Clock cursor generally does not invoke any callback, as it is always in dynamic state.
 * However, a callback will be invoked if the clockprovider is changed through 
 * assignment of the provider property.
 * 
 */

export function clock_cursor(options={}) {

    const {provider, shift=0, scale=1.0} = options;

    const cursor = new Cursor();

    // restrictions
    Object.defineProperty(cursor, "numeric", {get: () => true});
    Object.defineProperty(cursor, "fixedRate", {get: () => true});

    // query
    cursor.query = function (local_ts=local_clock.now()) {
        const clock_ts = provider.now(local_ts);
        const value = (clock_ts * scale) + shift;
        return {value, dynamic:true, offset:local_ts};
    }

    // setup provider as settable property
    srcprop.addState(cursor);
    srcprop.addMethods(cursor);
    cursor.srcprop_register("provider");
    cursor.srcprop_check = function (propName, obj) {
        if (propName == "provider") {
            if (!(obj instanceof ClockProvider)) {
                throw new Error(`provider must be clockProvider ${provider}`);
            }        
            return obj;    
        }
    }
    cursor.srcprop_onchange = function (propName, eArg) {
        if (propName == "provider") {
            if (eArg == "reset") {
                cursor.onchange();
            }
        }        
    }

    // initialise
    cursor.rate = 1.0 * scale;
    cursor.provider = provider;
    return cursor;
}
