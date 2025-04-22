import * as eventify from "./util/api_eventify.js";
import * as callback from "./util/api_callback.js";
import { interval } from "./util/intervals.js";
import { range, toState } from "./util/common.js";

/************************************************
 * LAYER
 ************************************************/

/**
 * Layer is abstract base class for Layers
 * 
 * Layer interface is defined by (index, CacheClass, options)
 * 
 * CacheClass
 * ----------
 * The CacheClass implements the query operation for the layer, using
 * the index for lookups on cache miss. Layer has a private cache. 
 * Additionally, if layer has multiple consumers, they can each 
 * create their own private cache. 
 * 
 * options
 * -------
 * The the result from the query operation can be controlled by supplying
 * optional custom function, either valueFunc or a stateFunc 
 * {valueFunc,stateFunc}
 * 
 * index
 * -----
 * The nearby index is supplied by Layer implementations, either by 
 * subclassing it, or by assigning the index. 
 */

export class Layer {

    constructor(options={}) {

        const {
            CacheClass=LayerCache, 
            valueFunc=undefined,
            stateFunc=undefined,
        } = options; 

        // callbacks
        callback.addState(this);
        // define change event
        eventify.addState(this);
        this.eventifyDefine("change", {init:true});

        // index
        this.index;

        // cache
        this._CacheClass = CacheClass;
        this._private_cache;
        this._consumer_caches = [];

        // properties
        this._valueFunc = valueFunc;
        this._stateFunc = stateFunc;
    }

    // restrictions (defaults)
    get numeric () {return false;}
    get mutable () {return false;}
    get itemsOnly () {return false;}

    // query options
    get valueFunc () {return this._valueFunc;}
    get stateFunc () {return this._stateFunc;}

    // private cache
    get cache () {
        if (this._private_cache == undefined) {
            this._private_cache = new this._CacheClass(this);
        }
        return this._private_cache;
    }

    // invoked by layer consumer
    query(offset) {
        return this.cache.query(offset);
    }

    // invoked by layer consumer
    createCache () {
        const cache = new this._CacheClass(this);
        this._consumer_caches.push(cache);
        return cache;
    }
    releaseCache (cache) {
        const idx = this._consumer_caches.indexOf(cache);
        if (idx > -1) {
            this._consumer_caches.splice(idx, 1);
        }
    }
    clearCaches() {
        for (const cache of this._consumer_caches){
            cache.clear();
        }
        if (this._private_cache != undefined) {
            this._private_cache.clear();
        }
    }

    // invoked by subclass whenever layer has changed
    onchange() {
        this.clearCaches();
        this.notify_callbacks();
        this.eventifyTrigger("change");    
    }

    // iterator for regions of the layer index
    regions (options) {
        return this.index.regions(options);
    }

    /*
        Sample layer values by timeline offset increments
        return list of tuples [value, offset]
        options
        - start
        - stop
        - step

        TODO - this should be an iterator
    */
    sample(options={}) {
        if (this.index.empty()) {
            return [];
        }
        let {start, stop, step=1} = options;
        
        if (start == undefined) {
            // check if index.first is a number
            const first = this.index.first();
            if (first[0] != null) {
                start = first[0];
            } else {
                throw new Error("undefined start");
            }    
        }
        if (stop == undefined) {
            // check if index.last is a number
            const last = this.index.last();
            if (last[0] != null) {
                stop = last[0];
            } else {
                throw new Error("undefined stop");
            }
        }
        if (start > stop) {
            throw new Error ("stop must be larger than start", start, stop)
        }
        const cache = this.createCache();
        const samples = range(start, stop, step, {include_end:true})
            .map((offset) => {
                return [cache.query(offset).value, offset];
            });
        this.releaseCache(cache);
        return samples;
    }
}
callback.addMethods(Layer.prototype);
eventify.addMethods(Layer.prototype);


/************************************************
 * LAYER CACHE
 ************************************************/

/**
 * Layer Cache is the regular cache type, intended for
 * _derived_ Layers - that is a layers which index references
 * other source layers.
 * 
 * A query is resolved by identifying the relevant region in
 * the nearby index (index.nearby(offset)), and then querying 
 * the state of all the objects found in the region (nearby.center).
 *  
 * Options {valueFunc or stateFunc} are used to compute a 
 * single query result from the list of states.
 * 
 * The result state is only cached if it is static.
 * Cache miss is triggered if no state has been cached, or if 
 * offset is outside the region of the cached state.
 * 
 */

export class LayerCache {

    constructor(layer) {
        // cache belongs to layer
        this._layer = layer;
        // cached nearby state
        this._nearby;
        // cached state
        this._state;
        // query options
        this._query_options = {
            valueFunc: this._layer.valueFunc,
            stateFunc: this._layer.stateFunc,
            numberOnly: this._layer.isNumberOnly,
        };
    }

    get layer() {return this._layer};

    /**
     * query cache
     */
    query(offset) {
        const need_index_lookup = (
            this._nearby == undefined ||
            !interval.covers_endpoint(this._nearby.itv, offset)
        );
        if (
            !need_index_lookup && 
            this._state != undefined &&
            !this._state.dynamic
        ) {
            // cache hit
            return {...this._state, offset};
        }
        // cache miss
        if (need_index_lookup) {
            this._nearby = this._layer.index.nearby(offset);
        }
        // perform queries
        const states = this._nearby.center.map((cache) => {
            return cache.query(offset);
        });
        // calculate single result state
        const state = toState(this._nearby.center, states, offset, this._query_options);
        // cache state only if not dynamic
        this._state = (state.dynamic) ? undefined : state;
        return state    
    }

    clear() {
        this._nearby = undefined;
        this._state = undefined;
    }
}

