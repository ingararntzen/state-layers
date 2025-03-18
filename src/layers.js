import * as eventify from "./api_eventify.js";
import * as callback from "./api_callback.js";
import * as srcprop from "./api_srcprop.js";

import { interval, endpoint } from "./intervals.js";
import { range, toState } from "./util.js";
import { NearbyIndexCollection } from "./nearby_collection.js";
import { is_collection_provider } from "./provider_collection.js";
import { load_segment } from "./segments.js";

/************************************************
 * LAYER
 ************************************************/

/**
 * Layer is abstract base class for Layers
 * 
 * Layer interface is defined by (index, CacheClass, {valueFunc,stateFunc})
 * 
 * Index is supplied by subclass - needed by caches
 */

export class Layer {

    constructor(options={}) {
        const {CacheClass=LayerCache} = options;
        const {valueFunc, stateFunc} = options;
        // callbacks
        callback.addToInstance(this);
        // define change event
        eventify.addToInstance(this);
        this.eventifyDefine("change", {init:true});

        // index
        this._index;
        // cache
        this._CacheClass = CacheClass;
        this._cache_object;
        this._cache_objects = [];

        // query options
        this._queryOptions = {valueFunc, stateFunc};
    }

    // index
    get index () {return this._index}
    set index (index) {this._index = index}

    // queryOptions
    get queryOptions () {
        return this._queryOptions;
    }

    // cache
    get cache () {
        if (this._cache_object == undefined) {
            this._cache_object = new this._CacheClass(this);
        }
        return this._cache_object;
    }

    getCache () {
        const cache = new this._CacheClass(this);
        this._cache_objects.push(cache);
        return cache;
    }

    clearCaches() {
        for (const cache of this._cache_objects){
            cache.clear();
        }
        
    }

    query(offset) {
        return this.cache.query(offset);
    }

    regions (options) {
        return this.index.regions(options);
    }

    /*
        Sample Layer by timeline offset increments
        return list of tuples [value, offset]
        options
        - start
        - stop
        - step
    */
    sample(options={}) {
        let {start=-Infinity, stop=Infinity, step=1} = options;
        if (start > stop) {
            throw new Error ("stop must be larger than start", start, stop)
        }
        start = [start, 0];
        stop = [stop, 0];
        start = endpoint.max(this.index.first(), start);
        stop = endpoint.min(this.index.last(), stop);
        const cache = this.getCache();
        return range(start[0], stop[0], step, {include_end:true})
            .map((offset) => {
                return [cache.query(offset).value, offset];
            });
    }
}
callback.addToPrototype(Layer.prototype);
eventify.addToPrototype(Layer.prototype);


/************************************************
 * LAYER CACHE
 ************************************************/

/**
 * This implements a Cache to be used with Layer objects
 * Query results are obtained from the cache objects in the
 * layer index and cached only if they describe a static value. 
 */

export class LayerCache {

    constructor(layer) {
        this._layer = layer;
        // cached nearby state
        this._nearby;
        // cached result
        this._state;
    }

    get src() {return this._layer};

    /**
     * query cache
     */
    query(offset) {
        const need_nearby = (
            this._nearby == undefined ||
            !interval.covers_point(this._nearby.itv, offset)
        );
        if (
            !need_nearby && 
            this._state != undefined &&
            !this._state.dynamic
        ) {
            // cache hit
            return {...this._state, offset};
        }
        // cache miss
        if (need_nearby) {
            this._nearby = this._layer.index.nearby(offset);
        }
        // perform queries
        const states = this._nearby.center.map((cache) => {
            return cache.query(offset);
        });
        const state = toState(this._nearby.center, states, offset, this._layer.queryOptions)
        // cache state only if not dynamic
        this._state = (state.dynamic) ? undefined : state;
        return state    
    }

    clear() {
        this._nearby = undefined;
        this._state = undefined;
    }
}



/*********************************************************************
    INPUT LAYER
*********************************************************************/

/**
 * Layer with a StateProvider as src
 */

export class InputLayer extends Layer {

    constructor(options={}) {
        const {src, valueFunc, stateFunc} = options;
        super({CacheClass:InputLayerCache, valueFunc, stateFunc});
        // setup src propterty
        srcprop.addToInstance(this);
        this.srcprop_register("src");
        // initialize
        this.src = src;
    }

    srcprop_check(propName, src) {
        if (propName == "src") {
            if (!(is_collection_provider(src))) {
                throw new Error(`"src" must be collection provider ${src}`);
            }
            return src;    
        }
    }

    srcprop_onchange(propName, eArg) {
        if (propName == "src") {
            if (this.index == undefined || eArg == "reset") {
                this.index = new NearbyIndexCollection(this.src);
            } 
            if (eArg != "reset") {
                this.index.refresh(eArg);
            }
            this.clearCaches();
            this.notify_callbacks();
            this.eventifyTrigger("change");
        }        
    }
}
srcprop.addToPrototype(InputLayer.prototype);



/*********************************************************************
    INPUT LAYER CACHE
*********************************************************************/

/*
    Layer with a StateProvider uses a specific cache implementation.    

    The cache will instantiate segments corresponding to
    items in the index. 
*/

export class InputLayerCache {
    constructor(layer) {
        // layer
        this._layer = layer;
        // cached nearby object
        this._nearby = undefined;
        // cached segment
        this._segment = undefined;
    }

    get src() {return this._layer};
    get segment() {return this._segment};

    query(offset) {
        const cache_miss = (
            this._nearby == undefined ||
            !interval.covers_point(this._nearby.itv, offset)
        );
        if (cache_miss) {
            this._nearby = this._layer.index.nearby(offset);
            let {itv, center} = this._nearby;
            this._segments = center.map((item) => {
                return load_segment(itv, item);
            });
        }
        // query segments
        const states = this._segments.map((seg) => {
            return seg.query(offset);
        });
        return toState(this._segments, states, offset, this._layer.queryOptions)
    }

    clear() {
        this._nearby = undefined;
        this._segment = undefined;
    }
}




