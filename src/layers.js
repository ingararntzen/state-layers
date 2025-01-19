
import { LayerBase, StateProviderBase } from "./bases.js";
import * as sourceprop from "./sourceprop.js";
import { SimpleStateProvider } from "./stateprovider_simple.js";
import { NearbyIndexSimple } from "./nearbyindex_simple.js";
import { NearbyCache } from "./nearbycache.js";
import { NearbyIndexMerge } from "./nearbyindex_merge.js";

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



/************************************************
 * MERGE LAYER
 ************************************************/


export class MergeLayer extends LayerBase {

    constructor (options={}) {
        super();

        // sources
        this._sources = [];
        // index
        this._index = new NearbyIndexMerge(this._sources);
        // cache
        this._cache = new NearbyCache(this._index);

        // layers
        let {sources} = options;
        this.add_sources(sources);
    }

    /**********************************************************
     * UPDATE API
     **********************************************************/
    add_sources (sources) {
        this._sources.push(...sources);
        this._cache.dirty();
    }

}


