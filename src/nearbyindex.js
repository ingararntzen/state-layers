import { endpoint } from "./intervals.js";
import { range } from "./util.js";
import { NearbyCache } from "./nearbycache.js";

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
 *      center: list of ITEMS covering endpoint,
 *      itv: interval where nearby returns identical {center}
 *      left:
 *          first interval endpoint to the left 
 *          which will produce different {center}
 *          always a high-endpoint or undefined
 *      right:
 *          first interval endpoint to the right
 *          which will produce different {center}
 *          always a low-endpoint or undefined         
 *      prev:
 *          first interval endpoint to the left 
 *          which will produce different && non-empty {center}
 *          always a high-endpoint or undefined if no more intervals to the left
 *      next:
 *          first interval endpoint to the right
 *          which will produce different && non-empty {center}
 *          always a low-endpoint or undefined if no more intervals to the right
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

    /*
        List items of NearbyIndex (order left to right)
        interval defines [start, end] offset on the timeline.
        Returns list of item-lists.
        options
        - start
        - stop
    */
    list(options={}) {
        let {start=-Infinity, stop=Infinity} = options;
        if (start > stop) {
            throw new Error ("stop must be larger than start", start, stop)
        }
        start = [start, 0];
        stop = [stop, 0];
        let current = start;
        let nearby;
        const results = [];
        let limit = 5
        while (limit) {
            if (endpoint.gt(current, stop)) {
                // exhausted
                break;
            }
            nearby = this.nearby(current);
            if (nearby.center.length == 0) {
                // center empty (typically first iteration)
                if (nearby.right == undefined) {
                    // right undefined
                    // no entries - already exhausted
                    break;
                } else {
                    // right defined
                    // increment offset
                    current = nearby.right;
                }
            } else {
                results.push(nearby.center);
                if (nearby.right == undefined) {
                    // right undefined
                    // last entry - mark iteractor exhausted
                    break;
                } else {
                    // right defined
                    // increment offset
                    current = nearby.right;
                }
            }
            limit--;
        }
        return results;
    }
}





