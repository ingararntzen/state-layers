
import { LayerBase, StateProviderBase } from "./bases.js";
import { source } from "./util.js";
import { SimpleStateProvider } from "./stateprovider_simple.js";
import { SimpleNearbyIndex } from "./nearbyindex_simple.js";

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
    
        // initialise with stateprovider
        let {src} = options;
        if (src == undefined) {
            src = new SimpleStateProvider();
        }
        if (!(src instanceof StateProviderBase)) {
            throw new Error("src must be StateproviderBase")
        }
        this.src = src;
    }

    // src
    __src_check(src) {
        if (!(src instanceof StateProviderBase)) {
            throw new Error(`"src" must be state provider ${source}`);
        }
    }    
    __src_handle_change() {
        let items = this.src.items;
        this._index.update(items);
        // trigger change event for cursor
        this.eventifyTrigger("change", this.query());   
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

    list (options) {
        return this._index.list(options);
    }

    sample (options) {
        return this._index.sample(options);
    }

}
source.addToPrototype(Layer.prototype, "src", {mutable:true});
