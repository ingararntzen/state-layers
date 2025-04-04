import { interval } from "./util/intervals.js";
import { random_string} from "./util/common.js";
import * as callback from "./util/api_callback.js";


function check_item(item) {
    item.itv = interval.from_input(item.itv);
    item.id = item.id || random_string(10);
    return item;
}

/**
 * collection providers must provide get_all function
 * and also implement callback interface
 */
export function is_collection_provider(obj) {
    if (!callback.is_callback_api(obj)) return false;
    if (!("get" in obj)) return false;
    if (typeof obj.get != 'function') return false;
    if (!("update" in obj)) return false;
    if (typeof obj.update != 'function') return false;
    return true;
}


/***************************************************************
    COLLECTION PROVIDER
***************************************************************/

/**
 * local collection provider
 * 
 * 
 * changes = {
 *   remove=[],
 *   insert=[],
 *   reset=false 
 * }
 * 
*/

export class CollectionProvider {

    constructor(options={}) {
        callback.addState(this);
        this._map = new Map();
        // initialize
        let {insert} = options;
        if (insert != undefined) {
            this._update({insert, reset:true});
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

    get() {
        return [...this._map.values()];
    };
}
callback.addMethods(CollectionProvider.prototype);
