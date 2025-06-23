import * as callback from "./util/api_callback.js";
import { check_items } from "./util/common.js";

/**
 * object providers implement get() and set() methods
 * and the callback interface
 */
export function is_object_provider(obj) {
    if (!callback.is_callback_api(obj)) return false;
    if (!("get" in obj)) return false;
    if (typeof obj.get != 'function') return false;
    if (!("set" in obj)) return false;
    if (typeof obj.set != 'function') return false;
    return true;
}

/***************************************************************
    OBJECT PROVIDER
***************************************************************/

/**
 * ObjectProvider stores an object or undefined.
 */

export class ObjectProvider {

    constructor(options={}) {
        const {items} = options;
        callback.addState(this);
        this._object = items;
    }

    set (items) {
        items = check_items(items);
        return Promise.resolve()
            .then(() => {
                this._object = items;
                this.notify_callbacks();
            });
    }

    get () {
        return this._object;
    }
}
callback.addMethods(ObjectProvider.prototype);