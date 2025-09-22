import * as srcprop from "../util/api_srcprop.js";
import { Track } from "../track_base.js"
import { endpoint } from "../util/intervals.js";
import { NearbyIndexBase, nearby_from } from "../nearby_base.js";


/**
 * Convenience merge options
 */
const MERGE_OPTIONS = {
    sum: {
        valueFunc: function (info) {
            // returns the sum of values of active tracks
            return info.states
                .map(state => state.value) 
                .reduce((acc, value) => acc + value, 0);
        }
    },
    stack: {
        stateFunc: function (info) {
            // returns values from first active track
            return {...info.states[0]}
        }
    },
    array: {
        valueFunc: function (info) {
            // returns an array with values from active tracks
            return info.states.map(state => state.value);
        }
    }
}

/**
 * 
 * This implements a merge operation for tracks.
 * List of sources is immutable.
 * 
 */

export function merge_track (sources, options={}) {
    let {type="", ...opts} = options;

    // type specifies predefined options for Track
    if (type in MERGE_OPTIONS) {
        opts = MERGE_OPTIONS[type];
    }
    const track = new Track(opts);    

    // setup sources property
    srcprop.addState(track);
    srcprop.addMethods(track);
    track.srcprop_register("sources");

    track.srcprop_check = function(propName, sources) {
        if (propName == "sources") {
            // check that sources is array of tracks
            if (!Array.isArray(sources)) {
                throw new Error(`sources must be array ${sources}`)
            }
            const all_tracks = sources.map((e) => e instanceof Track).every(e => e);
            if (!all_tracks) {
                throw new Error(`sources must all be tracks ${sources}`);
            }
        }
        return sources;
    }

    track.srcprop_onchange = function(propName, eArg) {
        if (propName == "sources") {
            if (eArg == "reset") {
                track.index = new NearbyIndexMerge(track.sources)
            } 
            track.onchange();
        }
    }

    // restrictions
    const numeric = sources.map((src) => src.numeric).every(e=>e)  
    Object.defineProperty(track, "numeric", {get: () => numeric});

    // initialise
    track.sources = sources;

    return track
}



/**
 * Creating a merged NearbyIndex for set of Tracks.
 *  
 * A region within the merged index will contain
 * a list of references to (cache objects) for 
 * the Tracks which are defined in this region.
 * 
 * Implementation is stateless.
 * Set of tracks is assumed to be static.
 */

function cmp_ascending(p1, p2) {
    return endpoint.cmp(p1, p2)
}

function cmp_descending(p1, p2) {
    return endpoint.cmp(p2, p1)
}

export class NearbyIndexMerge extends NearbyIndexBase {

    constructor(sources) {
        super();
        this._sources = sources;
        this._caches = new Map(sources.map((src) => {
            return [src, src.createCache()];
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
        const next_low = next_list[0] || endpoint.POS_INF;

        // find closest endpoint to the left (not in center)
        prev_list.sort(cmp_descending);
        const prev_high = prev_list[0] || endpoint.NEG_INF;

        return nearby_from(
                prev_high, 
                center_low_list, 
                center,
                center_high_list,
                next_low
            );
    }
};
