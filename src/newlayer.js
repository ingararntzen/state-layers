import { eventify } from "./eventify.js";
import { callback } from "./util.js";
import * as sourceprop from "./sourceprop.js";
import { interval, endpoint } from "./intervals.js";
import { Datasource } from "./datasource.js";
import { StateProviderBase } from "./bases.js";
import { LocalStateProvider } from "./stateprovider_simple.js";
import { range } from "./util.js";

/************************************************
 * LAYER CACHE
 ************************************************/

export class LayerCache {

    constructor(layer) {
        this._layer = layer;
        this._itv;
        this._state;
        this._obj = layer.src.getQueryObject();
        this._index = layer.index;
    }

    query(offset) {
        const need_itv = (
            this._itv == undefined ||
            !interval.covers_point(this._itv, offset)
        );
        if (
            !need_itv && 
            this._state != undefined &&
            !this._state.dynamic
        ) {
            // cache hit
            return {...this._state, offset};
        }
        // cache miss
        if (need_itv) {
            this._itv = this._index.nearby(offset).itv;
        }
        const state = this._obj.query(offset);
        // cache state only if not dynamic
        if (!state.dynamic) {
            this._state = state;
        }
        return state    
    }

    clear() {
        this._itv = undefined;
        this._state = undefined;
    }
}

/************************************************
 * LAYER
 ************************************************/

export class Layer {

    constructor(options={}) {

        callback.addToInstance(this);
        // define change event
        eventify.addToInstance(this);
        this.eventifyDefine("change", {init:true});
        // src
        sourceprop.addToInstance(this, "src");
        // index
        this._index;
        // cache
        this._cache_objects = [];

        // initialise with stateprovider
        let {src, ...opts} = options;
        if (src == undefined) {
            src = new LocalStateProvider(opts);
        }
        this.src = src;
    }

    /**********************************************************
     * SRC (datasource)
     **********************************************************/

    __src_check(src) {
        if (src instanceof StateProviderBase) {
            src = new Datasource(src);
        }
        if (!(src instanceof Datasource)) {
            throw new Error(`"src" must be a datasource ${src}`);
        }
        return src;
    }    
    __src_handle_change(reason) {
        if (reason == "reset") {
            this._index = this.src.index;
        }
        for (let cache_object of this._cache_objects) {
            cache_object.clear();
        }
        this.notify_callbacks();
        // trigger change event for cursor
        this.eventifyTrigger("change");   
    }

    /**********************************************************
     * QUERY API
     **********************************************************/

    get index () {return this._index};

    getQueryObject () {
        const cache_object = new LayerCache(this);
        this._cache_objects.push(cache_object);
        return cache_object;
    }

    query (offset) {
        return this.src.query(offset);
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
        const cache = this.getQueryObject();
        return range(start[0], stop[0], step, {include_end:true})
            .map((offset) => {
                return [cache.query(offset).value, offset];
            });
    }
}
callback.addToPrototype(Layer.prototype);
sourceprop.addToPrototype(Layer.prototype, "src", {mutable:true});
eventify.addToPrototype(Layer.prototype);
