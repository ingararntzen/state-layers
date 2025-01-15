
import { LayerBase, StateProviderBase } from "./bases.js";
import { source } from "./util.js";
import { SimpleStateProvider } from "./stateprovider_simple.js";
import { SimpleNearbyIndex } from "./nearbyindex_simple.js";
import { NearbyCache } from "./nearbycache.js";

/************************************************
 * LAYER
 ************************************************/

/**
 * 
 * Layer
 * - has mutable state provider (src) (default state undefined)
 * - methods for list and sample
 * 
 */


export class Layer extends LayerBase {

    constructor (options={}) {
        super();

        // src
        source.addToInstance(this, "src");
        // index
        this._index = new SimpleNearbyIndex();
        // cache
        this._cache = new NearbyCache(this._index);

        // initialise with stateprovider
        let {src, ...opts} = options;
        if (src == undefined) {
            src = new SimpleStateProvider(opts);
        }
        if (!(src instanceof StateProviderBase)) {
            throw new Error("src must be StateproviderBase")
        }
        this.src = src;
    }

    /**********************************************************
     * SRC (stateprovider)
     **********************************************************/

    __src_check(src) {
        if (!(src instanceof StateProviderBase)) {
            throw new Error(`"src" must be state provider ${source}`);
        }
    }    
    __src_handle_change() {
        this._index.update(this.src.items);
        this._cache.dirty();
        // trigger change event for cursor
        this.eventifyTrigger("change", this.query());   
    }

    /**********************************************************
     * QUERY API
     **********************************************************/

    query(offset) {
        if (offset == undefined) {
            throw new Error("Layer: query offset can not be undefined");
        }
        return this._cache.query(offset);
    }

    list (options) {
        return this._index.list(options);
    }

    sample (options) {
        return this._index.sample(options);
    }

    /**********************************************************
     * UPDATE API
     **********************************************************/

    // TODO - add methods for update?

}
source.addToPrototype(Layer.prototype, "src", {mutable:true});
