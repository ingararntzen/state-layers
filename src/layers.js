
import { LayerBase, StateProviderBase } from "./bases.js";
import * as sourceprop from "./sourceprop.js";
import { SimpleStateProvider } from "./stateprovider_simple.js";
import { NearbyIndexSimple, SimpleNearbyIndex } from "./nearbyindex_simple.js";
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
        sourceprop.addToInstance(this, "src");
        // index
        this._index;
        // cache
        this._cache;

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
            throw new Error(`"src" must be state provider ${src}`);
        }
    }    
    __src_handle_change() {
        if (this._index == undefined) {
            this._index = new NearbyIndexSimple(this.src)
            this._cache = new NearbyCache(this._index);
        } else {
            this._cache.dirty();
        }
        this.notify_callbacks();
        // trigger change event for cursor
        this.eventifyTrigger("change");   
    }

    /**********************************************************
     * QUERY API
     **********************************************************/

    get cache () {return this._cache};
    get index () {return this._index};
    
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
sourceprop.addToPrototype(Layer.prototype, "src", {mutable:true});


function fromArray (array) {
    const items = array.map((obj, index) => {
        return { 
            itv: [index, index+1, true, false], 
            type: "static", 
            args: {value:obj}};
    });
    return new Layer({items});
}

Layer.fromArray = fromArray;