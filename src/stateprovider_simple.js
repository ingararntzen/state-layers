import { StateProviderBase } from "./bases.js";
import { endpoint } from "./intervals.js";

/***************************************************************
    LOCAL STATE PROVIDER
***************************************************************/

/**
 * Local Array with non-overlapping items.
 */

export class LocalStateProvider extends StateProviderBase {

    constructor(options={}) {
        super();
        // initialization
        let {items, value} = options;
        if (items != undefined) {
            // initialize from items
            this._items = check_input(items);
        } else if (value != undefined) {
            // initialize from value
            this._items = [{
                itv:[-Infinity, Infinity, true, true], 
                type: "static",
                data:value
            }];
        } else {
            this._items = [];
        }
    }

    update (items, options) {
        return Promise.resolve()
            .then(() => {
                this._items = check_input(items);
                this.notify_callbacks();
            });
    }

    get_items () {
        return this._items.slice();
    }

    get info () {
        return {overlapping: false};
    }
}


function check_input(items) {
    if (!Array.isArray(items)) {
        throw new Error("Input must be an array");
    }
    // sort items based on interval low endpoint
    items.sort((a, b) => {
        let a_low = endpoint.from_interval(a.itv)[0];
        let b_low = endpoint.from_interval(b.itv)[0];
        return endpoint.cmp(a_low, b_low);
    });
    // check that item intervals are non-overlapping
    for (let i = 1; i < items.length; i++) {
        let prev_high = endpoint.from_interval(items[i - 1].itv)[1];
        let curr_low = endpoint.from_interval(items[i].itv)[0];
        // verify that prev high is less that curr low
        if (!endpoint.lt(prev_high, curr_low)) {
            throw new Error("Overlapping intervals found");
        }
    }
    return items;
}




