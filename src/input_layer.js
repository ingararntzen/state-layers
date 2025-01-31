import {Layer} from "./newlayer.js";
import { StateProviderBase } from "./bases.js";
import * as sourceprop from "./sourceprop.js";
import { LocalStateProvider } from "./stateprovider_simple.js";
import { interval } from "./intervals.js";
import { NearbyIndexSimple } from "./nearbyindex_simple";
import { toState } from "./util.js";
import * as segment from "./segments.js";

export class InputLayer extends Layer {

    constructor(options={}) {
        let {src, valueFunc, ...opts} = options;
        super(InputLayerCache, valueFunc);
        // src
        sourceprop.addToInstance(this, "src");

        // initialise with stateprovider
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
        if (this._index == undefined) {
            console.log("set index");
            this._index = new NearbyIndexSimple(this.src)
        } else {
            this.clearCaches();
        }
        this.notify_callbacks();
        // trigger change event for cursor
        this.eventifyTrigger("change");   
    }



}
sourceprop.addToPrototype(InputLayer.prototype, "src", {mutable:true});


/*********************************************************************
    INPUTLAYER CACHE
*********************************************************************/

/*
    This implements a cache in front of a StateProvider    
    - index contains segment items
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

    query(offset) {
        // check cache
        if (
            this._nearby == undefined ||
            !interval.covers_point(this._nearby.itv, offset)
        ) {
            // cache miss
            this._nearby = this._layer.index.nearby(offset);
            let {itv, center} = this._nearby;
            this._segments = center.map((item) => {
                return create_segment(itv, item);
            });
        }
        // query
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

function create_segment(itv, item) {
    let {type, data} = item;
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

