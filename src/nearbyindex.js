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
 * NearbyIndex provides indexing support of effectivelylooking up ITEMS by offset, 
 * given that
 * (i) each entriy is associated with an interval and,
 * (ii) entries are non-overlapping.
 * Each ITEM must be associated with an interval on the timeline 
 * 
 * NEARBY
 * The nearby method returns information about the neighborhood around endpoint. 
 * 
 * Primary use is for iteration 
 * 
 * Returns {
 *      center: list of ITEMS/LAYERS covering endpoint,
 *      itv: interval where nearby returns identical {center}
 *      left:
 *          first interval endpoint to the left 
 *          which will produce different {center}
 *          always a high-endpoint or [-Infinity, 0]
 *      right:
 *          first interval endpoint to the right
 *          which will produce different {center}
 *          always a low-endpoint or [Infinity, 0]    
 *      prev:
 *          first interval endpoint to the left 
 *          which will produce different && non-empty {center}
 *          always a high-endpoint or [-Infinity, 0] if no more intervals to the left
 *      next:
 *          first interval endpoint to the right
 *          which will produce different && non-empty {center}
 *          always a low-endpoint or [Infinity, 0] if no more intervals to the right
 * }
 * 
 * 
 * The nearby state is well-defined for every timeline position.
 * 
 * 
 * NOTE left/right and prev/next are mostly the same. The only difference is 
 * that prev/next will skip over regions where there are no intervals. This
 * ensures practical iteration of items as prev/next will only be undefined  
 * at the end of iteration.
 * 
 * INTERVALS
 * 
 * [low, high, lowInclusive, highInclusive]
 * 
 * This representation ensures that the interval endpoints are ordered and allows
 * intervals to be exclusive or inclusive, yet cover the entire real line 
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
 * / */

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
        let {start=-Infinity, stop=Infinity, includeEmpty=true} = options;
        if (start > stop) {
            throw new Error ("stop must be larger than start", start, stop)
        }
        start = [start, 0];
        stop = [stop, 0];

        this._index = index;
        this._current = start;
        this._includeEmpty = includeEmpty;
        this._done = false;
        this._stop = stop;
    }

    next() {
        if (this._done) {
            return {value:undefined, done:true};
        }
        if (endpoint.gt(this._current, this._stop)) {
            // exhausted
            this._done = true;
            return {value:undefined, done:true};
        }
        while(true) {
            const {itv, center, right} = this._index.nearby(this._current);
            if (center.length == 0) {
                // center empty
                if (right[0] == Infinity) {
                    // last region - iterator exhausted
                    this._done = true;
                } else {
                    // right defined - increment offset
                    this._current = right;
                    if (!this._includeEmpty) {
                        continue;
                    }
                }
            } else {
                // center non-empty
                if (right[0] == Infinity) {
                    // last region - iterator exhausted
                    this._done = true;
                } else {
                    // right defined - increment offset
                    this._current = right;
                }
            }
            return {value:{itv, center}, done:false};
        }
    }

    [Symbol.iterator]() {
        return this;
    }
}

/*********************************************************************
    BOOLEAN NEARBY INDEX
*********************************************************************/

/**
 * Wrapper Index where regions are true/false, based on 
 * on whether the source index is defined or not.
 * Back-to-back regions which are defined 
 * are collapsed into one region
 * 
 * Boolean Index is stateless.
 * 
 */

function queryObject (value) {
    return {
        query: function (offset) {
            return {value, dynamic:false, offset};
        }
    }
}

export class BooleanIndex extends NearbyIndexBase {

    constructor(source) {
        super();
        this._index = source;
        this._trueObject = queryObject(true);
        this._falseObject = queryObject(false);
    }

    nearby(offset) {
        offset = this.check(offset);
        const nearby = this._index.nearby(offset);

        // left, right is unchanged if center is empty
        if (nearby.center.length == 0) {
            nearby.center = [this._falseObject];
            return nearby;
        }

        // seek left and right for next gap - expand region
        let [low, high] = endpoint.from_interval(nearby.itv)
        let current_nearby;

        // seek right
        current_nearby = nearby;
        while (true) {
            // region on the right
            const next_nearby = this._index.nearby(current_nearby.right);
            if (next_nearby.center.length > 0) {
                // expand region
                high = endpoint.from_interval(next_nearby.itv)[1];
                // check if this is last region
                if (next_nearby.right[0] == Infinity) {
                    break;
                } else {
                    // continue
                    current_nearby = next_nearby;
                }
            } else {
                // found gap
                break;
            }
        }

        // seek left
        current_nearby = nearby;
        while (true) {
            // region on the left
            const next_nearby = this._index.nearby(current_nearby.left);
            if (next_nearby.center.length > 0) {
                // expand region
                low = endpoint.from_interval(next_nearby.itv)[0];
                // check if this is last region
                if (next_nearby.left[0] == -Infinity) {
                    break;
                } else {
                    // continue
                    current_nearby = next_nearby;
                }
            } else {
                // found gap
                break;
            }
        }

        return {
            itv: interval.from_endpoints(low, high),
            center : [this._trueObject],
            left: endpoint.flip(low, "high"),
            right: endpoint.flip(high, "low"),
        }
    }
}


