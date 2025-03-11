import { interval } from "./intervals.js";
import { random_string } from "./util.js";
import * as callback from "./api_callback.js";


function check_item(item) {
    item.itv = interval.from_input(item.itv);
    item.id = item.id || random_string(10);
    return item;
}


export function is_stateprovider(obj) {
    if (!callback.implements_callback(obj)) return false;
    if (!("get_items" in obj)) return false;
    if (typeof obj.get_items != 'function') return false;
    return true;
}


/***************************************************************
    LOCAL STATE PROVIDER
***************************************************************/

/**
 * local state provider
 * collection of items
 * 
 * changes = {
 *   remove=[],
 *   insert=[],
 *   reset=false 
 * }
 * 
*/

export class LocalStateProvider {

    constructor(options={}) {
        callback.addToInstance(this);
        this._map = new Map();
        this._initialise(options);
    }

    /**
     * Local stateprovider support initialisation with
     * by giving items or a value. 
     */
    _initialise(options={}) {
        // initialization with items or single value 
        let {items, value} = options;
        if (value != undefined) {
            // initialize from value
            items = [{
                itv: [-Infinity, Infinity, true, true], 
                type: "static",
                data: value
            }];
        }
        if (items != undefined) {
            this._update({insert:items, reset:true});
        }
    }

    /**
     * Local stateproviders decouple update request from
     * update processing, and returns Promise.
     */
    update (changes) {
        return Promise.resolve()
        .then(() => {
            let diffs;
            if (changes != undefined) {
                diffs = this._update(changes);
                console.log("diffs", diffs);
                this.notify_callbacks(diffs);
            }
            return diffs;
        });
    }

    _update(changes) {
        const diff_map = new Map();
        let {
            insert=[],
            remove=[],
            reset=false
        } = changes;


        if (reset) {
            for (const [id, item] of this._map.entries()) {
                diff_map.set(id, {id, new:undefined, old:item});
            }
            // clear all items
            this._map = new Map();
        } else {
            // remove items by id
            for (const id of remove) {
                let item = this._map.get(id);
                if (item != undefined) {
                    diff_map.set(item.id, {
                        id:item.id, new:undefined, old:item
                    });
                    this._map.delete(id);
                }
            }
        }
        // insert items
        for (let item of insert) {
            item = check_item(item);
            const diff = diff_map.get(item.id)
            const old = (diff != undefined) ? diff.old : this._map.get(item.id);
            diff_map.set(item.id, {id:item.id, new:item, old});
            this._map.set(item.id, item);
        }
        return [...diff_map.values()];
    }

    get_items() {
        return [...this._map.values()];
    };
}
callback.addToPrototype(LocalStateProvider.prototype);
