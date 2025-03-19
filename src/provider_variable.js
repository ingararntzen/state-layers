import * as callback from "./api_callback.js";
import { random_string} from "./util.js";

/**
 * variable providers must have a value property
 * and also implement callback interface
 */
export function is_variable_provider(obj) {
    if (!callback.is_callback_api(obj)) return false;
    if (!("get" in obj)) return false;
    if (typeof obj.get != 'function') return false;
    return true;
}

/***************************************************************
    VARIABLE PROVIDER
***************************************************************/

export class VariableProvider {

    constructor(options={}) {
        callback.addState(this);
        this._item;

        // initialize
        const {value} = options;
        if (value != undefined) {
            this._item = {
                id: random_string(10),
                itv: [null, null, true, true], 
                type: "static",
                data: value
            };
        }
    }

    set (item) {
        return Promise.resolve()
            .then(() => {
                this._item = item;
                this.notify_callbacks();
            });
    }

    get () {
        return this._item;
    }
}
callback.addMethods(VariableProvider.prototype);