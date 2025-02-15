import { endpoint, interval } from "../intervals.js";
import { NearbyIndexBase, nearby_from } from "../nearbyindex_base.js";
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
        offset = endpoint.from_input(offset);
        // accumulate nearby from all sources
        const prev_list = [], next_list = [];
        const center = [];
        const center_high_list = [];
        const center_low_list = []
        for (let src of this._sources) {
            let nearby = src.index.nearby(offset);
            let prev_region = src.index.find_region(nearby, {direction:-1});
            let next_region = src.index.find_region(nearby, {direction:1});
            if (prev_region != undefined) {
                prev_list.push(endpoint.from_interval(prev_region.itv)[1]);
            }
            if (next_region != undefined) {
                next_list.push(endpoint.from_interval(next_region.itv)[0]);
            }
            if (nearby.center.length > 0) {
                center.push(this._caches.get(src));
                let [low, high] = endpoint.from_interval(nearby.itv);
                center_high_list.push(high);
                center_low_list.push(low);    
            }
        }
        
        // find closest endpoint to the right (not in center)
        next_list.sort(cmp_ascending);
        const next_low = next_list[0] || [Infinity, 0];

        // find closest endpoint to the left (not in center)
        prev_list.sort(cmp_descending);
        const prev_high = prev_list[0] || [-Infinity, 0];

        return nearby_from(
                prev_high, 
                center_low_list, 
                center,
                center_high_list,
                next_low
            );
    }
};



