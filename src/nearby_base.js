import { endpoint, interval } from "./util/intervals.js";

/*********************************************************************
    NEARBY INDEX
*********************************************************************/

/**
 * Abstract superclass for NearbyIndexe.
 * 
 * Superclass used to check that a class implements the nearby() method, 
 * and provide some convenience methods.
 * 
 * NEARBY INDEX
 * 
 * NearbyIndex provides indexing support of effectively
 * looking up regions by offset, 
 * given that
 * (i) each region is associated with an interval and,
 * (ii) regions are non-overlapping.
 * 
 * NEARBY
 * The nearby method returns information about the neighborhood 
 * around endpoint. 
 * 
 * Returns {
 *      center: list of objects covered by region,
 *      itv: region interval - validity of center 
 *      left:
 *          first interval endpoint to the left 
 *          which will produce different {center}
 *          always a high-endpoint or endpoint.NEG_INF
 *      right:
 *          first interval endpoint to the right
 *          which will produce different {center}
 *          always a low-endpoint or endtpoint.POS_INF
 * 
 * 
 * The nearby state is well-defined for every endpoint
 * on the timeline.
 * 
 * INTERVALS
 * 
 * [low, high, lowInclusive, highInclusive]
 * 
 * This representation ensures that the interval endpoints 
 * are ordered and allows intervals to be exclusive or inclusive, 
 * yet cover the entire real line 
 * 
 * [a,b], (a,b), [a,b), [a, b) are all valid intervals
 * 
 * 
 * INTERVAL ENDPOINTS
 * 
 * interval endpoints are defined by [value, type], for example
 * 
 * 4) -> [4,")"] - high endpoint left of 4
 * [4 -> [4, "["] - low endpoint includes 4
 * 4  -> [4, ""] - value 4
 * 4] -> [4, "]"] - high endpoint includes 4
 * (4 -> [4, "("] - low endpoint is right of 4
 * 
 */


/**
 * return first high endpoint on the left from nearby,
 * which is not in center
 */
export function left_endpoint (nearby) {
    const low = endpoint.from_interval(nearby.itv)[0];
    return endpoint.flip(low);
}

/**
 * return first low endpoint on the right from nearby,
 * which is not in center
 */

export function right_endpoint (nearby) {
    const high = endpoint.from_interval(nearby.itv)[1];
    return endpoint.flip(high);
}



export class NearbyIndexBase {


    /* 
        Nearby method
    */
    nearby(offset) {
        throw new Error("Not implemented");
    }

    empty() {
        return this.first() == undefined;
    }

    /*
        return low point of leftmost entry
    */
    first() {
        let {center, right} = this.nearby(endpoint.NEG_INF);
        if (center.length > 0 ) {
            return endpoint.NEG_INF;
        }
        if (endpoint.lt(right, endpoint.POS_INF)) {
            return right;
        } else {
            // empty
            return undefined;
        }
    }

    /*
        return high point of rightmost entry
    */
    last() {
        let {left, center} = this.nearby(endpoint.POS_INF);
        if (center.length > 0) {
            return endpoint.POS_INF;
        }
        if (endpoint.gt(left, endpoint.NEG_INF)) {
            return left;
        } else {
            // empty
            return undefined;
        }
    }


    /**
     * return nearby of first region to the right
     * which is not the center region. If not exists, return
     * undefined. 
     */
    right_region(nearby) {
        const right = right_endpoint(nearby);
        if (right[0] == null) {
            return undefined;
        }
        return this.nearby(right);
    }

    /**
     * return nearby of first region to the left
     * which is not the center region. If not exists, return
     * undefined. 
     */
    left_region(nearby) {
        const left = left_endpoint(nearby);
        if (left[0] == null) {
            return undefined;
        }
        return this.nearby(left);    
    }

    /**
     * find first region to the "right" or "left"
     * which is not the center region, and which meets
     * a condition on nearby.center.
     * Default condition is center non-empty
     * If not exists, return undefined. 
     */
    
    find_region(nearby, options={}) {
        let {
            direction = 1,
            condition = (center) => center.length > 0
        } = options;
        let next_nearby;
        while(true) {
            if (direction == 1) {
                next_nearby = this.right_region(nearby);
            } else {
                next_nearby = this.left_region(nearby);
            }
            if (next_nearby == undefined) {
                return undefined;
            }
            if (condition(next_nearby.center)) {
                // found region 
                return next_nearby;
            }
            // region not found
            // continue searching the right
            nearby = next_nearby;
        }
    }

    regions(options) {
        return new RegionIterator(this, options);
    }

}


/*
    Iterate regions of index from left to right

    Iteration limited to interval [start, stop] on the timeline.
    Returns list of item-lists.
    options
    - start
    - stop
    - includeEmpty
*/

class RegionIterator {

    constructor(index, options={}) {
        let {
            start=-Infinity, 
            stop=Infinity, 
            includeEmpty=true
        } = options;
        if (start > stop) {
            throw new Error ("stop must be larger than start", start, stop)
        }
        this._index = index;
        this._start = endpoint.from_input(start);
        this._stop = endpoint.from_input(stop);

        if (includeEmpty) {
            this._condition = () => true;
        } else {
            this._condition = (center) => center.length > 0;
        }
        this._current;
    }

    next() {
        if (this._current == undefined) {
            // initialse
            this._current = this._index.nearby(this._start);
            if (this._condition(this._current.center)) {
                return {value:this._current, done:false};
            }
        }
        let options = {condition:this._condition, direction:1}
        this._current = this._index.find_region(this._current, options);
        if (this._current == undefined) {
            return {value:undefined, done:true};
        } else {
            return {value:this._current, done:false}
        }
    }

    [Symbol.iterator]() {
        return this;
    }
}

/**
 * nearby_from
 * 
 * utility function for creating a nearby object in circumstances
 * where there are overlapping intervals This could be when a 
 * stateprovider for a layer has overlapping items or when 
 * multiple nearby indexes are merged into one.
 * 
 * 
 * @param {*} prev_high : the rightmost high-endpoint left of offset
 * @param {*} center_low_list : low-endpoints of center
 * @param {*} center : center
 * @param {*} center_high_list : high-endpoints of center
 * @param {*} next_low : the leftmost low-endpoint right of offset
 * @returns 
 */

function cmp_ascending(p1, p2) {
    return endpoint.cmp(p1, p2)
}

function cmp_descending(p1, p2) {
    return endpoint.cmp(p2, p1)
}

export function nearby_from (
    prev_high, 
    center_low_list, 
    center,
    center_high_list,
    next_low) {

    // nearby
    const result = {center};

    if (center.length == 0) {
        // empty center
        result.right = next_low;
        result.left = prev_high;
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
        if (endpoint.le(next_low, min_center_high)) {
            result.right = next_low;
        } else {
            result.right = endpoint.flip(min_center_high)
        }
        result.next = (multiple_center_high) ? result.right : next_low;

        // prev/left
        if (endpoint.ge(prev_high, max_center_low)) {
            result.left = prev_high;
        } else {
            result.left = endpoint.flip(max_center_low);
        }
        result.prev = (multiple_center_low) ? result.left : prev_high;

    }

    // interval from left/right
    let low = endpoint.flip(result.left);
    let high = endpoint.flip(result.right);
    result.itv = interval.from_endpoints(low, high);

    return result;
}


/**
 * Create a NearbyIndex for a src object Layer.
 * 
 * The src object resolves queries for the entire timeline.
 * In order for the default LayerCache to work, an
 * object with a .query(offset) method is needed in 
 * nearby.center.
 */

export class NearbyIndexSrc extends NearbyIndexBase {

    constructor(src) {
        super();
        this._src = src;
        this._cache = src.createCache();
    }

    nearby(offset) {
        const nearby = this._src.index.nearby(offset);
        nearby.center = [this._cache];
        return nearby;
    }
}
