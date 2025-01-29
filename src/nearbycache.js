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



export class NearbyCache {
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


export class NearbyCache2 {

    constructor (layer) {
        // dirty flag
        this._dirty = false;
    }

    /**************************************************
        Accessors for Cache state
    ***************************************************/
    
    get nearby () {
        return this._nearby;
    }

    load_segment () {
        // lazy load segment
        if (this._nearby && !this._segment) {
            this._segment = load_segment(this._nearby);
        }
        return this._segment
    }

    /**************************************************
        Dirty Cache
    ***************************************************/

    dirty() {
        this._dirty = true;
    }

    /**************************************************
        Refresh Cache
    ***************************************************/

    /*
        refresh if necessary - else NOOP
        - if nearby is not defined
        - if offset is outside nearby.itv
        - if cache is dirty
    */
    refresh (offset) {
        if (typeof offset === 'number') {
            offset = [offset, 0];
        }
        if (this._nearby == undefined || this._dirty) {
            return this._refresh(offset);
        }
        if (!interval.covers_endpoint(this._nearby.itv, offset)) {
            return this._refresh(offset)
        }
        return false;
    }

    _refresh (offset) {
        this._nearby = this._index.nearby(offset);
        this._segment = undefined;
        this._dirty = false;
        return true;
    }

    /**************************************************
        Query Cache
    ***************************************************/

    query(offset) {
        this.refresh(offset);
        if (!this._segment) {
            this._segment = load_segment(this._nearby);
        }
        return this._segment.query(offset);
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
