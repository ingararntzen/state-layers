import { eventify } from "./eventify.js";
import { interval, endpoint } from "./intervals.js";
import { range } from "./util.js";
import * as layersource from "./api_layersource.js";
import * as callback from "./api_callback.js";
import { toState } from "./util.js";


/************************************************
 * LAYER
 ************************************************/

/**
 * Layer is base class for Layers
 * defined by an index and a valueFunc
 */

export class Layer {

    constructor(CacheClass, valueFunc) {
        // callbacks
        callback.addToInstance(this);
        // layer source api
        layersource.addToInstance(this, CacheClass, valueFunc);
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
layersource.addToPrototype(Layer.prototype);
eventify.addToPrototype(Layer.prototype);



/************************************************
 * LAYER CACHE
 ************************************************/

/**
 * This implements a Cache to be used with Layer objects
 * 
 */

export class LayerCache {

    constructor(layer) {
        this._layer = layer;
        // cached nearby state
        this._nearby;
        // cached result
        this._state;
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
        // perform actual query
        const states = this._nearby.center.map((item) => item.src.query(offset));
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





