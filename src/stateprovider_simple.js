import { LocalStateProviderBase } from "./stateprovider_bases.js";

/***************************************************************
    SIMPLE STATE PROVIDER
***************************************************************/

/**
 * StateProvider based on array with non-overlapping items.
 */

export class LocalStateProvider extends LocalStateProviderBase {

    constructor(options={}) {
        super(options);
        this._items = [];
        this.initialise(options);
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






