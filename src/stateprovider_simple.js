import { StateProviderBase } from "./stateprovider_bases.js";

/***************************************************************
    SIMPLE STATE PROVIDER
***************************************************************/

/**
 * StateProvider based on array with non-overlapping items.
 */

export class LocalStateProvider extends StateProviderBase {

    constructor(options={}) {
        super(options);
        this._items = [];
        this.initialise(options);
    }

    /**
     * Local StateProviders support initialisation with
     * by giving items or a value. 
     */
    initialise(options={}) {
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
            this._update(items);
        }
    }


    /**
     * Local StateProviders decouple update request from
     * update processing, and returns Promise.
     */
    update (items) {
        return Promise.resolve()
        .then(() => {
            this._update(items);
            this.notify_callbacks();
        });
    }



    _update(items) {
        this._items = items;
    }

    get_items () {
        return this._items.slice();
    }

    get info () {
        return {overlapping: false};
    }
}






