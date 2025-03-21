import * as srcprop from "./api_srcprop.js";
import { Layer } from "./layer_base.js";
import { is_collection_provider } from "./provider_collection.js";
import { is_variable_provider} from "./provider_variable.js";
import { NearbyIndex } from "./nearby_index.js";
import { load_segment } from "./segments.js";
import { toState } from "./util.js";
import { interval } from "./intervals.js";

/*********************************************************************
    SEGMENT LAYER
*********************************************************************/

/**
 * Segment Layer has either collectionProvider or variableProvider
 * as src property.
 */

export function is_segments_layer (obj) {
    if (obj == undefined) return false;
    // is layer
    if (!(obj instanceof Layer)) return false;
    // has src property
    const desc = Object.getOwnPropertyDescriptor(obj, "src");
    if (!!(desc?.get && desc?.set) == false) return false;
    return true;
}

export function segments_layer(options={}) {

    const {src, ...opts} = options;
    const layer = new Layer({CacheClass:SegmentLayerCache, ...opts});

    // setup src property
    srcprop.addState(layer);
    srcprop.addMethods(layer);

    layer.srcprop_register("src");
    layer.srcprop_check = function (propName, src) {
        if (propName == "src") {
            if (!(is_collection_provider(src)) && !(is_variable_provider(src))) {
                throw new Error(`"src" must collectionProvider or variableProvider ${src}`);
            }
            return src;    
        }
    }
    layer.srcprop_onchange = function (propName, eArg) {
        if (propName == "src") {
            if (eArg == "reset") {
                if (is_collection_provider(layer.src)) {
                    layer.index = new NearbyIndex(layer.src);
                } else if (is_variable_provider(layer.src)) {
                    layer.index = new NearbyIndex(layer.src);
                }
            } 
            if (layer.index != undefined) {
                if (is_collection_provider(layer.src)) {
                    layer.index.refresh(eArg);
                } else if (is_variable_provider(layer.src)) {
                    layer.index.refresh();
                }
                layer.onchange();
            }
        }        
    }

    // return items valid for given offset.
    layer.get_items = function get_items(offset) {
        return [...layer.index.nearby(offset).center];
    }

    // initialise
    layer.src = src;

    return layer;
}


/*********************************************************************
    SEGMENT LAYER CACHE
*********************************************************************/

/*
    Layers with a CollectionProvider or a VariableProvider as src 
    use a specific cache implementation, as objects in the 
    index are assumed to be items from the provider, not layer objects. 
    Thus, queries are not resolved directly on the objects in the index, but
    rather on corresponding segment objects, instantiated as needed.

    Caching here applies to nearby state and segment objects.
*/

class SegmentLayerCache {
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
        const need_index_lookup = (
            this._nearby == undefined ||
            !interval.covers_endpoint(this._nearby.itv, offset)
        );
        if (need_index_lookup) {
            // cache miss
            this._nearby = this._layer.index.nearby(offset);
            let {itv, center} = this._nearby;
            this._segments = center.map((item) => {
                return load_segment(itv, item);
            });
        }
        // perform queries
        const states = this._segments.map((seg) => {
            return seg.query(offset);
        });
        // calculate single result state
        return toState(this._segments, states, offset, this._layer.options)
    }

    clear() {
        this._nearby = undefined;
        this._segment = undefined;
    }
}

