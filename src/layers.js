import * as eventify from "./api_eventify.js";
import * as layerquery from "./api_layerquery.js";
import * as callback from "./api_callback.js";
import * as sourceprop from "./api_sourceprop.js";
import * as segment from "./segments.js";

import { interval, endpoint } from "./intervals.js";
import { range, toState } from "./util.js";
import { StateProviderBase } from "./stateprovider_bases.js";
import { LocalStateProvider } from "./stateprovider_simple.js";
import { NearbyIndexSimple } from "./nearbyindex_simple";


/************************************************
 * LAYER
 ************************************************/

/**
 * Layer is abstract base class for Layers
 * 
 * Layer interface is defined by (index, CacheClass, valueFunc)
 */

export class Layer {

    constructor(CacheClass, valueFunc) {
        // callbacks
        callback.addToInstance(this);
        // layer query api
        layerquery.addToInstance(this, CacheClass, valueFunc);
        // define change event
        eventify.addToInstance(this);
        this.eventifyDefine("change", {init:true});
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
layerquery.addToPrototype(Layer.prototype);
eventify.addToPrototype(Layer.prototype);


/************************************************
 * LAYER CACHE
 ************************************************/

/**
 * This implements a Cache to be used with Layer objects
 * Query results are obtained from the src objects in the
 * layer index.
 * and cached only if they describe a static value. 
 */

export class LayerCache {

    constructor(layer) {
        this._layer = layer;
        // cached nearby state
        this._nearby;
        // cached result
        this._state;
        // src cache objects (src -> cache)
        this._cache_map = new Map();
    }

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
        const states = this._nearby.center
            // map to cache object
            .map((item) => {
                if (!this._cache_map.has(item.src)) {
                    this._cache_map.set(item.src, item.src.getCache());
                }
                return this._cache_map.get(item.src);
            })
            // map to query results
            .map((cache) => {
                return cache.query(offset);
            });

        const state = toState(states, this._layer.valueFunc)
        // cache state only if not dynamic
        this._state = (state.dynamic) ? undefined : state;
        return state    
    }

    clear() {
        this._itv = undefined;
        this._state = undefined;
    }
}


/*********************************************************************
    SOURCE LAYER
*********************************************************************/

/**
 * SourceLayer is a Layer with a stateprovider.
 * 
 * .src : stateprovider.
 */

export class SourceLayer extends Layer {

    constructor(options={}) {
        let {src, valueFunc, ...opts} = options;
        super(SourceLayerCache, valueFunc);
        // src
        sourceprop.addToInstance(this, "src");

        // initialise stateprovider
        if (src == undefined) {
            src = new LocalStateProvider(opts);
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
        return src;
    }    
    __src_handle_change() {
        if (this.index == undefined) {
            this.index = new NearbyIndexSimple(this.src)
        } else {
            this.clearCaches();
        }
        this.notify_callbacks();
        // trigger change event for cursor
        this.eventifyTrigger("change");   
    }
}
sourceprop.addToPrototype(SourceLayer.prototype, "src", {mutable:true});


/*********************************************************************
    SOURCE LAYER CACHE
*********************************************************************/

/*
    Source Layer used a specific cache implementation.    

    Since Source Layer has a state provider, its index is
    items, and the cache will instantiate segments corresponding to
    these items. 
*/

export class SourceLayerCache {
    constructor(layer) {
        // layer
        this._layer = layer;
        // cached nearby object
        this._nearby = undefined;
        // cached segment
        this._segment = undefined;
    }

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
        return toState(states, this._layer.valueFunc)
    }

    clear() {
        this._nearby = undefined;
        this._segment = undefined;
    }
}

/*********************************************************************
    LOAD SEGMENT
*********************************************************************/

function load_segment(itv, item) {
    let {type="static", data} = item;
    if (type == "static") {
        return new segment.StaticSegment(itv, data);
    } else if (type == "transition") {
        return new segment.TransitionSegment(itv, data);
    } else if (type == "interpolation") {
        return new segment.InterpolationSegment(itv, data);
    } else if (type == "motion") {
        return new segment.MotionSegment(itv, data);
    } else {
        console.log("unrecognized segment type", type);
    }
}



