
import { LayerBase, StateProviderBase } from "./bases.js";
import * as sourceprop from "./sourceprop.js";
import { StateProviderSimple } from "./stateprovider_simple.js";
import { NearbyIndexSimple } from "./nearbyindex_simple.js";
import { NearbyCache } from "./nearbycache.js";
import { NearbyIndexMerge } from "./nearbyindex_merge.js";



class QueryObject {

    constructor (layer) {
        this._layer = layer;
        this._cache = new NearbyCache(this._layer.index);
    }

    query(offset) {
        if (offset == undefined) {
            throw new Error("Layer: query offset can not be undefined");
        }
        return this._cache.query(offset);
    }

    dirty() {
        this._cache.dirty();
    }
}



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
        // query object
        this._query_objects = [];

        // initialise with stateprovider
        let {src, ...opts} = options;
        if (src == undefined) {
            src = new StateProviderSimple(opts);
        }
        if (!(src instanceof StateProviderBase)) {
            throw new Error("src must be StateproviderBase")
        }
        this.src = src;
    }

    /**********************************************************
     * QUERY API
     **********************************************************/

    getQueryObject () {
        const query_object = new QueryObject(layer);
        this._query_objects.push(query_object);
        return query_object;
    }
    
    /*
    query(offset) {
        if (offset == undefined) {
            throw new Error("Layer: query offset can not be undefined");
        }
        return this._cache.query(offset);
    }
    */

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
        } else {
            for (query_object of this._query_objects) {
                query_object.dirty();
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

        // sources (layers)
        this._sources = [];

        // layers
        let {sources} = options;
        this.set_sources(sources);
    }

    /**********************************************************
     * QUERY API
     **********************************************************/

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

    /**********************************************************
     * UPDATE API
     **********************************************************/
    set_sources (sources) {
        this._sources.push(...sources);
        let indexes = sources.map((layer) => layer.index);
        this._index = new NearbyIndexMerge(indexes);
    }

}


