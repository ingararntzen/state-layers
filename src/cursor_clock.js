import { Cursor } from "./cursor_base.js";
import { is_clock_provider, LOCAL_CLOCK_PROVIDER } from "./provider_clock.js";
import * as srcprop from "./util/api_srcprop.js";

/**
 * Clock Cursor is a cursor that wraps a clock provider, which is available 
 * on the provider property.
 * 
 * Clock cursor does not depend on a src layer or a ctrl cursor. 
 * Clock cursor is FixedRate Cursor (bpm 1)
 * Clock cursor is NumberOnly
 * 
 * The Clock cursor generally does not invoke any callback, as it is always in dynamic state.
 * However, a callback will be invoked if the clockprovider is changed through 
 * assignment of the provider property.
 * 
 */

export function clock({provider=LOCAL_CLOCK_PROVIDER}) {
    const cursor = new Cursor();

    // properties
    Object.defineProperty(cursor, "isNumberOnly", {get: () => true});
    Object.defineProperty(cursor, "isReadOnly", {get: () => true});
    Object.defineProperty(cursor, "isLeaf", {get: () => true});
    Object.defineProperty(cursor, "isFixedRate", {get: () => true});

    // query
    cursor.query = function (local_ts) {
        const clock_ts = provider.now(local_ts);
        return {value:clock_ts, dynamic:true, offset:local_ts};
    }

    // setup provider as settable property
    srcprop.addState(cursor);
    srcprop.addMethods(cursor);
    cursor.srcprop_register("provider");
    cursor.srcprop_check = function (propName, obj) {
        if (propName == "provider") {
            if (!is_clock_provider(obj)) {
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
    cursor.rate = 1.0;
    cursor.provider = provider;
    return cursor;
}
