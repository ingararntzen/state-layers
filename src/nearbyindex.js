import { endpoint, interval } from "./intervals.js";

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
 *          always a high-endpoint or [-Infinity, 0]
 *      right:
 *          first interval endpoint to the right
 *          which will produce different {center}
 *          always a low-endpoint or [Infinity, 0]    
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
 * interval endpoints are defined by [value, sign], for example
 * 
 * 4) -> [4,-1] - endpoint is on the left of 4
 * [4, 4, 4] -> [4, 0] - endpoint is at 4 
 * (4 -> [4, 1] - endpoint is on the right of 4)
 * 
 *  
 */


/**
 * return first high endpoint on the left from nearby,
 * which is not in center
 */
export function left_endpoint (nearby) {
    const low = endpoint.from_interval(nearby.itv)[0];
    return endpoint.flip(low, "high");
}

/**
 * return first low endpoint on the right from nearby,
 * which is not in center
 */

export function right_endpoint (nearby) {
    const high = endpoint.from_interval(nearby.itv)[1];
    return endpoint.flip(high, "low");
}



export class NearbyIndexBase {


    /* 
        Nearby method
    */
    nearby(offset) {
        throw new Error("Not implemented");
    }

    check(offset) {
        if (typeof offset === 'number') {
            offset = [offset, 0];
        }
        if (!Array.isArray(offset)) {
            throw new Error("Endpoint must be an array");
        }
        return offset;
    }

    /*
        return low point of leftmost entry
    */
    first() {
        let {center, right} = this.nearby([-Infinity, 0]);
        return (center.length > 0) ? [-Infinity, 0] : right;
    }

    /*
        return high point of rightmost entry
    */
    last() {
        let {left, center} = this.nearby([Infinity, 0]);
        return (center.length > 0) ? [Infinity, 0] : left
    }


    /**
     * return nearby of first region to the right
     * which is not the center region. If not exists, return
     * undefined. 
     */
    right_region(nearby) {
        const right = right_endpoint(nearby);
        if (right[0] == Infinity) {
            return undefined;
        }
        return this.nearby(right);
    }

    /**
     * return nearby of first non-empty region to the right
     * which is not the center region. If not exists, return
     * undefined. 
     */
    next_region(nearby) {
        const next_nearby = this.right_region(nearby);
        if (next_nearby == undefined) {
            return undefined;
        }
        if (next_nearby.center.length > 0) {
            // center non-empty 
            return next_nearby;
        }
        // center empty
        // find first non-empty region to the right (recursively)
        return this.next_region(next_nearby);
    }

    /**
     * return nearby of first region to the left
     * which is not the center region. If not exists, return
     * undefined. 
     */
    left_region(nearby) {
        const left = left_endpoint(nearby);
        if (left[0] == -Infinity) {
            return undefined;
        }
        return this.nearby(left);    
    }

    /** 
     * return nearby of first non-empty region to the left
     * which is not the center region. If not exists, return
     * undefined. 
    */
    prev_region(nearby) {
        const next_nearby = this.left_region(nearby);
        if (next_nearby == undefined) {
            return undefined;
        }
        if (next_nearby.center.length > 0) {
            // center non-empty 
            return next_nearby;
        }
        // center empty
        // find first non-empty region to the left (recursively)
        return this.prev_region(next_nearby);
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
        this._start = [start, 0];
        this._stop = [stop, 0];
        this._includeEmpty = includeEmpty;        
        this._current;
        this._done = false;
    }

    next() {
        let current;
        if (this._done) {
            return {value:undefined, done:true};
        }
        if (this._current == undefined) {
            // initialise
            this._current = this._index.nearby(this._start);
        } 
        /* 
            need multiple passes to skip over
            empty regions within this next invocation
        */
        while (true) {
            current = this._current;

            // check if stop < region.low
            let low = endpoint.from_interval(current.itv)[0] 
            if (endpoint.gt(low, this._stop)) {
                return {value:undefined, done:true};
            }

            const is_last = current.itv[1] == Infinity;

            /* 
                check if we need to skip to next within 
                this next invocation
            */
            const skip_empty = (
                is_last == false &&
                this._includeEmpty == false &&
                current.center.length == 0
            );
            if (skip_empty) {
                this._current = this._index.right_region(current);
                if (current == undefined) {
                    return {value:undefined, done:true}
                }
                continue;
            }

            if (is_last) {
                this._done = true;
            } else {
                // increment current
                this._current = this._index.right_region(current);
                if (current == undefined) {
                    this._done = true;
                }
            }
            return {value:current, done:false};
        }
    }

    [Symbol.iterator]() {
        return this;
    }
}



