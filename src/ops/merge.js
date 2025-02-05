import { endpoint, interval } from "../intervals.js";
import { NearbyIndexBase } from "../nearbyindex.js";
import { Layer } from "../layers.js"
import * as srcprop from "../api_srcprop.js";


/**
 * Convenience merge options
 */
const merge_options = {
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

export function merge (sources, options={}) {
    const {type=""} = options;

    if (type in merge_options) {
        return new MergeLayer(sources, merge_options[type])
    } else {
        return new MergeLayer(sources, options);
    }
}


class MergeLayer extends Layer {

    constructor(sources, options) {
        super(options);

        // setup sources property
        srcprop.addToInstance(this);
        this.srcprop_register("sources", {mutable:false});
        this.sources = sources;
    }

    srcprop_check(propName, sources) {
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

    srcprop_onchange(propName, eArg) {
        if (propName == "sources") {
            if (this.index == undefined || eArg == "reset") {
                this.index = new MergeIndex(this.sources)
            } 
            this.clearCaches();
            this.notify_callbacks();
            this.eventifyTrigger("change");
        }
    }
}
srcprop.addToPrototype(MergeLayer.prototype);





/**
 * Merging indexes from multiple sources into a single index.
 * 
 * A source is an object with an index.
 * - layer (cursor)
 * 
 * The merged index gives a temporal structure for the
 * collection of sources, computing a list of
 * sources which are defined at a given offset
 * 
 * nearby(offset).center is a list of items
 * [{itv, src}]
 * 
 * Implementaion is stateless.
 */

function cmp_ascending(p1, p2) {
    return endpoint.cmp(p1, p2)
}

function cmp_descending(p1, p2) {
    return endpoint.cmp(p2, p1)
}

export class MergeIndex extends NearbyIndexBase {

    constructor(sources) {
        super();
        this._sources = sources;
        this._caches = new Map(sources.map((src) => {
            return [src, src.getCache()];
        }));
    }

    nearby(offset) {
        // accumulate nearby from all sources
        const prev_list = [], next_list = [];
        const center_list = [];
        const center_high_list = [];
        const center_low_list = []
        for (let src of this._sources) {
            let {prev, center, next, itv} = src.index.nearby(offset);
            if (prev[0] > -Infinity) prev_list.push(prev);            
            if (next[0] < Infinity) next_list.push(next);
            if (center.length > 0) {
                center_list.push(this._caches.get(src));
                let [low, high] = endpoint.from_interval(itv);
                center_high_list.push(high);
                center_low_list.push(low);    
            }
        }
        
        // find closest endpoint to the right (not in center)
        next_list.sort(cmp_ascending);
        const min_next_low = next_list[0] || [Infinity, 0];

        // find closest endpoint to the left (not in center)
        prev_list.sort(cmp_descending);
        const max_prev_high = prev_list[0] || [-Infinity, 0];

        // nearby
        let low, high; 
        const result = {
            center: center_list, 
        }

        if (center_list.length == 0) {

            // empty center
            result.right = min_next_low;       
            result.next = min_next_low;
            result.left = max_prev_high;
            result.prev = max_prev_high;

        } else {
            // non-empty center
            
            // center high
            center_high_list.sort(cmp_ascending);
            let min_center_high = center_high_list[0];
            let max_center_high = center_high_list.slice(-1)[0];
            let multiple_center_high = !endpoint.eq(min_center_high, max_center_high)

            // center low
            center_low_list.sort(cmp_descending);
            let max_center_low = center_low_list[0];
            let min_center_low = center_low_list.slice(-1)[0];
            let multiple_center_low = !endpoint.eq(max_center_low, min_center_low)

            // next/right
            if (endpoint.le(min_next_low, min_center_high)) {
                result.right = min_next_low;
            } else {
                result.right = endpoint.flip(min_center_high, "low")
            }
            result.next = (multiple_center_high) ? result.right : min_next_low;

            // prev/left
            if (endpoint.ge(max_prev_high, max_center_low)) {
                result.left = max_prev_high;
            } else {
                result.left = endpoint.flip(max_center_low, "high");
            }
            result.prev = (multiple_center_low) ? result.left : max_prev_high;

        }

        // interval from left/right
        low = endpoint.flip(result.left, "low");
        high = endpoint.flip(result.right, "high");
        result.itv = interval.from_endpoints(low, high);

        return result;
    }
};

