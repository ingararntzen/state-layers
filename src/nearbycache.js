import { interval } from "./intervals.js";
import * as segment from "./segments.js";

/*********************************************************************
    NEARBY CACHE
*********************************************************************/

/*
    This implements a cache in front of a NearbyIndex.
    
    The purpose of caching is to optimize for repeated
    queries to a NearbyIndex to nearby offsets.

    The cache state includes the nearby state from the 
    index, and also segments corresponding
    to that state. This way, on a cache hit, the 
    query may be satisfied directly from the cache.

    The cache is marked as dirty when the Nearby indexes changes.
*/



export class DatasourceCache {
    constructor(datasource) {
        // nearby index
        this._index = datasource.index;
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
            this._nearby = this._index.nearby(offset);
            this._segment = load_segment(this._nearby);
        }
        return this._segment.query(offset); 
    }

    clear() {
        this._nearby = undefined;
        this._segment = undefined;
    }

}



/*********************************************************************
    LOAD SEGMENT
*********************************************************************/

function create_segment(itv, type, data) {
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

function load_segment(nearby) {
    let {itv, center} = nearby;
    if (center.length == 0) {
        return create_segment(itv, "static", undefined);
    }
    if (center.length == 1) {
        let {type="static", data} = center[0];
        return create_segment(itv, type, data);
    }
    if (center.length > 1) {
        throw new Error("ListSegments not yet supported");
    }
}
