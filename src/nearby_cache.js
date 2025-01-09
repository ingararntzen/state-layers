import { intervals } from "./intervals.js";
import { create_segment } from "./segments.js";

/*********************************************************************
    NEARBY CACHE
*********************************************************************/

/*
    This implements a cache for the nearby object, in front of an
    NearbyIndex. The cache includes lazily instantiated segments.

    The purpose of caching is to optimize for repeated
    queries to a NearbyIndex to similar offsets.

    NearbyCache also supports customized interpretation of individual
    cache entry.
*/



export class NearbyCache {

    constructor (nearbyIndex) {
        // nearby index
        this._index = nearbyIndex;
        // cached nearby object
        this._nearby;
        // cached segment
        this._segment;
    }

    /**************************************************
        Accessors for cached state
    ***************************************************/

    get nearby () {
        return this._nearby;
    }

    // lazy instantiation of segment
    get segment () {
        const {center} = this._nearby || {};
        if (center && !this._segment) {
            // lazy instantiate
            this._segment = create_segment(center);
        }
        return this._segment
    }

    /**************************************************
        Clear
    ***************************************************/

    clear() {
        this._nearby = undefined;
        this._segment = undefined;
    }

    /**************************************************
        Refresh
    ***************************************************/

    /*
        refresh if necessary
        - if nearby is not defined
        - if offset is outside entry
        - force is needed after entryindex has changed
    */
    refresh (offset) {
        if (offset == undefined) {
            this.clear();
            return true;
        }
        /*
            always change, except when nearby is defined and offset
            hits within the interval
        */
        let change_needed = true;
        if (this._nearby != undefined && offset != undefined) {
            let itv = interval_from_nearby(this._nearby);
            change_needed = !(intervals.covers(itv, offset));
        }
        if (change_needed) {
            // clear
            this.clear();
            // set
            this._nearby = this._eIndex.nearby(offset);
            return true;
        }
        return false;
    }

    /**************************************************
        Query
    ***************************************************/

    query(offset) {
        this.refresh(offset);
        let entry = undefined;
        if (this._nearby.center != undefined) {
            entry = {...this._nearby.center};
        }
        if (entry == undefined) {
            return {value:undefined, dynamic:false, offset};
        }
        let {proj={mode:"entry", func:undefined}} = options;
        let {mode, func} = proj;
        let values = this.segments.map(seg => seg.value(offset));
        let dynamics = this.segments.map(seg => seg.dynamic());
        let value, dynamic;
        let info = {entry, values, dynamics, offset};
        if (mode == "single") {
            let idx = func(info);
            value = values[idx];
            dynamic = dynamics[idx];
        } else if (mode == "multi") {
            value = func(info);
            dynamic = dynamics.some(e=>e);
        } else if (mode == "tuple") {
            [value, dynamic] = func(info);
        } else if (mode == "entry") {
            // default - entry
            value = entry;
            dynamic = false;
        } else {
            throw new Error("unsupported mode", mode);
        }
        return {value, dynamic, offset};
    }
}


/*********************************************************************
    UTIL
*********************************************************************/


/*
    return the interval defined by nearby
    - if nearby center is defined, this will
      be the valid interval of the center entry
    - else it will be the interval between left and right
    - return Infinite interval if left and right are not defined
*/

export function interval_from_nearby(nearby) {
    // figure out interval
    let {left, center, right} = nearby;
    if (center != undefined) {
        // entry defined - use validity of entry
        return center.valid;
    } else {
        // entry undefined - use validity between entries
        if (left != undefined) {
            let [left_v, left_s] = left;
            // high points are -1 or 0
            // make it a low point
            left = [left_v, left_s + 1];
        } else {
            left = [-Infinity, 0];
        }
        if (right != undefined) {
            let [right_v, right_s] = right;
            // low points are 0 or +1
            // make it a high point
            right = [right_v, right_s -1];
        } else {
            right = [Infinity, 0];
        }
        return intervals.interval_from_points(left, right);
    }
}
