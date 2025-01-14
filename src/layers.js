
import { LayerBase, StateProviderBase } from "./bases.js";
import { SimpleStateProvider } from "./stateprovider_simple.js";
import { SimpleNearbyIndex} from "./nearbyindex_simple.js"
import { NearbyCache } from "./nearbycache.js";




/*
    Input Layer is a facade on top of a StateProvider
*/

export class InputLayer extends LayerBase {

    constructor (options={}) {
        super();

        // state provider
        this._src;
        // index
        this._index;
        // nearby cache
        this._cache;
    
        // initialise with stateprovider
        let {src} = options;
        if (src == undefined) {
            src = new SimpleStateProvider();
        }
        if (!(src instanceof StateProviderBase)) {
            throw new Error("src must be StateproviderBase")
        }
        this._initialise_src(src);
    }

    _initialise_src (src) {
        // set state provider
        this._src = src;
        // nearby index
        this._index = new SimpleNearbyIndex();
        this._index.update(this.src.items);
        // nearby cache
        this._cache = new NearbyCache(this._index);
        // add callbacks from state provider
        this._src.add_callback(this._onchange_stateprovider.bind(this));
    }

    // state change in state provider
    _onchange_stateprovider(itv) {
        this._index.update(this._src.items);
        this._cache.dirty();
        // trigger change event for cursor
        this.eventifyTrigger("change", itv);
    }

    /**********************************************************
     * QUERY
     **********************************************************/
    query(offset) {
        return this._cache.query(offset);
    }

    /**********************************************************
     * ACCESSORS
     **********************************************************/
    get src () {return this._src}

    // TODO - define support for list and sample

}

