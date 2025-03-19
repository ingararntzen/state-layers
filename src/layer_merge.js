
import { Layer } from "./layer_base.js"
import { NearbyIndexMerge } from "./nearby_merge.js";
import * as srcprop from "./api_srcprop.js";


/**
 * Convenience merge options
 */
const MERGE_OPTIONS = {
    sum: {
        valueFunc: function (info) {
            // returns the sum of values of active layers
            return info.states
                .map(state => state.value) 
                .reduce((acc, value) => acc + value, 0);
        }
    },
    stack: {
        stateFunc: function (info) {
            // returns values from first active layer
            return {...info.states[0]}
        }
    },
    array: {
        valueFunc: function (info) {
            // returns an array with values from active layers
            return info.states.map(state => state.value);
        }
    }
}

/**
 * 
 * This implements a merge operation for layers.
 * List of sources is immutable.
 * 
 */

export function merge_layer (sources, options={}) {
    const {type="", ...opts} = options;

    // type specifies predefined options for Layer
    if (type in MERGE_OPTIONS) {
        opts = MERGE_OPTIONS[type];
    }
    const layer = new Layer(opts);    

    // setup sources property
    srcprop.addState(layer);
    srcprop.addMethods(layer);
    layer.srcprop_register("sources");

    layer.srcprop_check = function(propName, sources) {
        if (propName == "sources") {
            // check that sources is array of layers
            if (!Array.isArray(sources)) {
                throw new Error(`sources must be array ${sources}`)
            }
            const all_layers = sources.map((e) => e instanceof Layer).every(e => e);
            if (!all_layers) {
                throw new Error(`sources must all be layers ${sources}`);
            }
        }
        return sources;
    }

    layer.srcprop_onchange = function(propName, eArg) {
        if (propName == "sources") {
            if (eArg == "reset") {
                layer.index = new NearbyIndexMerge(layer.sources)
            } 
            layer.onchange();
        }
    }

    // initialise
    layer.sources = sources;

    return layer
}
