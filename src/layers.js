
import { LayerBase, StateProviderBase } from "./bases.js";
import * as sourceprop from "./sourceprop.js";
import { LocalStateProvider } from "./stateprovider_simple.js";
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
        // cache objects
        this._cache_objects = [];

        // initialise with stateprovider
        let {src, ...opts} = options;
        if (src == undefined) {
            src = new LocalStateProvider(opts);
        }
        if (!(src instanceof StateProviderBase)) {
            throw new Error("src must be StateproviderBase")
        }
        this.src = src;
    }

    /**********************************************************
     * QUERY API
     **********************************************************/

    getCacheObject () {
        const cache_object = new NearbyCache(this);
        this._cache_objects.push(cache_object);
        return cache_object;
    }
    
    /**********************************************************
     * SRC (stateprovider)
     **********************************************************/

    __src_check(src) {
        if (!(src instanceof StateProviderBase)) {
            throw new Error(`"src" must be state provider ${src}`);
        }
        return src;
    }    
    __src_handle_change() {
        if (this._index == undefined) {
            this._index = new NearbyIndexSimple(this.src)
        } else {
            for (let cache_object of this._cache_objects) {
                cache_object.dirty();
            }
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
            data: obj};
    });
    return new Layer({items});
}

Layer.fromArray = fromArray;



/************************************************
 * MERGE LAYER
 ************************************************/




class MergeLayerCacheObject {

    constructor (layer) {
        this._layer = layer;
        this._cache_objects = layer.sources.map((layer) => layer.getCacheObject());
    }

    query(offset) {
        if (offset == undefined) {
            throw new Error("Layer: query offset can not be undefined");
        }
        const vector = this._cache_objects.map((cache_object) => {
            return cache_object.query(offset);
        });
        const valueFunc = this._layer.valueFunc;
        const dynamic = vector.map((v) => v.dynamic).some(e => e == true);
        const values = vector.map((v) => v.value);
        const value = (valueFunc) ? valueFunc(values) : values;
        return {value, dynamic, offset};
    }

    dirty() {
        // Noop - as long as queryobject is stateless
    }

    refresh(offset) {
        // Noop - as long as queryobject is stateless
    }

    get nearby() {
        throw new Error("not implemented")
    }


}


export class MergeLayer extends LayerBase {

    constructor (options={}) {
        super();

        this._cache_objects = [];

        // value func
        let {valueFunc=undefined} = options;
        if (typeof valueFunc == "function") {
            this._valueFunc = valueFunc
        }

        // sources (layers)
        this._sources;
        let {sources} = options;
        if (sources) {
            this.sources = sources;
        }
 
        // subscribe to callbacks from sources
    }



    /**********************************************************
     * QUERY API
     **********************************************************/

    get valueFunc () {
        return this._valueFunc;
    }

    getCacheObject () {
        const cache_object = new MergeLayerCacheObject(this);
        this._cache_objects.push(cache_object);
        return cache_object;
    }

    /*
    query(offset) {
        if (offset == undefined) {
            throw new Error("Layer: query offset can not be undefined");
        }
        let values = this._sources.map((layer) => {
            return layer.query(offset);
        });
        // TODO - apply function to arrive at single value for layer.
        return values;
    }
    */

    /**********************************************************
     * UPDATE API
     **********************************************************/
    
    get sources () {
        return this._sources;
    }
    set sources (sources) {
        this._sources = sources;
        let indexes = sources.map((layer) => layer.index);
        this._index = new NearbyIndexMerge(indexes);
    }

}


