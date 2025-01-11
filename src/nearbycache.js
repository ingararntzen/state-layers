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
    index, and also the cached segments corresponding
    to that state. This way, on a cache hit, the 
    query may be satisfied directly from the cache.

    The cache is marked as dirty when the Nearby indexes changes.
*/

export class NearbyCache {

    constructor (nearbyIndex) {
        // nearby index
        this._index = nearbyIndex;
        // cached nearby object
        this._nearby = undefined;
        // cached segment
        this._segment = undefined;
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
        - if offset is outside nearby.interval
        - if cache is dirty
    */
    refresh (offset) {
        if (typeof offset === 'number') {
            offset = [offset, 0];
        }
        if (this._nearby == undefined || this._dirty) {
            return this._refresh(offset);
        }
        if (!interval.covers_endpoint(this._nearby.interval, offset)) {
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
        if (offset == undefined) {
            throw new Error("cache query offset cannot be undefined")
        }
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

function create_segment(interval, type, args) {
    if (type == "static") {
        return new segment.StaticSegment(interval, args);
    } else if (type == "transition") {
        return new segment.TransitionSegment(interval, args);
    } else if (type == "interpolation") {
        return new segment.InterpolationSegment(interval, args);
    } else if (type == "motion") {
        return new segment.MotionSegment(interval, args);
    } else {
        console.log("unrecognized segment type", type);
    }
}

function load_segment(nearby) {
    let item;
    let {interval:itv, center} = nearby;
    if (center.length == 0) {
        return create_segment(itv, "static", {value:undefined});
    }
    if (center.length == 1) {
        item = center[0];
        return create_segment(itv, item.type, item.args);
    }
    if (center.length > 1) {
        throw new Error("ListSegments not yet supported");
    }
}
