import * as eventify from "./api_eventify.js";
import * as layerquery from "./api_layerquery.js";
import * as callback from "./api_callback.js";
import * as srcprop from "./api_srcprop.js";
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

    constructor(options={}) {
        let {queryFuncs, CacheClass} = options;
        // callbacks
        callback.addToInstance(this);
        // layer query api
        layerquery.addToInstance(this, queryFuncs, CacheClass || LayerCache);
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
        this._caches;
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
            console.log(this._nearby.center);
            this._caches = this._nearby.center
                // map to layer
                .map((item) => item.src)
                // map to cache object
                .map((layer) => {
                    if (!this._cache_map.has(layer)) {
                        this._cache_map.set(layer, layer.getCache());
                    }
                    return this._cache_map.get(layer);
                });
        }
        // perform queries
        const states = this._caches.map((cache) => {
            return cache.query(offset);
        });
        const state = toState(this._caches, states, offset, this._layer.queryOptions)
        // cache state only if not dynamic
        this._state = (state.dynamic) ? undefined : state;
        return state    
    }

    clear() {
        this._itv = undefined;
        this._state = undefined;
        this._caches = undefined;
        this._cache_map = new Map();
    }
}



/*********************************************************************
    STATE LAYER
*********************************************************************/

class StateIndex extends NearbyIndexSimple {

    constructor (stateProvider) {
        super(stateProvider);
    }

    nearby (offset) {
        const nearby = super.nearby(offset);
        // change center
        nearby.center = nearby.center.map((item) => {
            return load_segment(nearby.itv, item);
        });
        return nearby;
    }
}

/**
 * Layer with a StateProvider as src
 */

export class StateLayer extends Layer {

    constructor(options={}) {
        const {queryFuncs} = options;
        super({queryFuncs, CacheClass:StateLayerCache});
        // setup src propterty
        srcprop.addToInstance(this);
        this.srcpropRegister("src");
    }

    propCheck(propName, src) {
        if (propName == "src") {
            if (!(src instanceof StateProviderBase)) {
                throw new Error(`"src" must be state provider ${src}`);
            }
            return src;    
        }
    }

    propChange(propName, eArg) {
        if (propName == "src") {
            if (this.index == undefined || eArg == "reset") {
                this.index = new NearbyIndexSimple(this.src)
            } else {
                this.clearCaches();
            }
            this.notify_callbacks();
            this.eventifyTrigger("change");
        }        
    }
}
srcprop.addToPrototype(StateLayer.prototype);

/*********************************************************************
    LAYER FACTORY
*********************************************************************/

export function getLayer(options={}) {
    let {src, items, ...opts} = options;
    if (src == undefined) {
        src = new LocalStateProvider({items})
    }
    const layer = new StateLayer(opts);
    layer.src = src;
    return layer;
}


/*********************************************************************
    STATE LAYER CACHE
*********************************************************************/

/*
    Layer with a StateProvider uses a specific cache implementation.    

    Since Source Layer has a state provider, its index is
    items, and the cache will instantiate segments corresponding to
    these items. 
*/

export class StateLayerCache {
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
        return toState(this._segments, states, offset, this._layer.queryOptions)
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



