import {endpoint, interval} from "./intervals.js";
import { NearbyIndexBase } from "./nearbyindex.js";



function cmp_ascending(p1, p2) {
    return endpoint.cmp(p1, p2)
}

function cmp_descending(p1, p2) {
    return endpoint.cmp(p2, p1)
}


/**
 * Merging NearbyIndexes into one.
 * 
 * Stateless virtual nearby index on top of multiple nearby
 * indexes.
 */

export class NearbyIndexMerge extends NearbyIndexBase {

    constructor(nearby_indexes) {
        super();
        this._indexes = nearby_indexes;
    }

    nearby(offset) {
        // accumulate nearby from all sources
        const prev_list = [], center_list = [], next_list = [];
        for (let index of this._indexes) {
            let {prev, center, next} = index.nearby(offset);
            if (prev != undefined) prev_list.push(prev);
            center_list.push(...center);
            if (next != undefined) next_list.push(next);
        }
        
        // find closest endpoint to the right (not in center)
        next_list.sort(cmp_ascending);
        const min_next_low = next_list[0] || [Infinity, 0];

        // find closest endpoint to the left (not in center)
        prev_list.sort(cmp_descending);
        const max_prev_high = prev_list[0] || [-Infinity, 0];

        // nearby
        let low, high; 
        const result = {
            center: center_list, 
        }

        if (center_list.length == 0) {

            // empty center
            result.right = min_next_low;       
            result.next = min_next_low;
            result.left = max_prev_high;
            result.prev = max_prev_high;

        } else {

            // non-empty center

            // center high
            let center_high_list = center_list.map((item) => {
                return endpoint.from_interval(item.itv)[1];
            }).sort(cmp_ascending);
            let min_center_high = center_high_list[0];
            let max_center_high = center_high_list.slice(-1)[0];
            let multiple_center_high = !endpoint.eq(min_center_high, max_center_high)

            // center low
            let center_low_list = center_list.map((item) => {
                return endpoint.from_interval(item.itv)[0]
            }).sort(cmp_descending);
            let max_center_low = center_low_list[0];
            let min_center_low = center_low_list.slice(-1)[0];
            let multiple_center_low = !endpoint.eq(max_center_low, min_center_low)

            // next/right
            if (endpoint.le(min_next_low, min_center_high)) {
                result.right = min_next_low;
            } else {
                result.right = endpoint.flip(min_center_high, "low")
            }
            result.next = (multiple_center_high) ? result.right : min_next_low;

            // prev/left
            if (endpoint.ge(max_prev_high, max_center_low)) {
                result.left = max_prev_high;
            } else {
                result.left = endpoint.flip(max_center_low, "high");
            }
            result.prev = (multiple_center_low) ? result.left : max_prev_high;    
        }

        // interval from left/right
        low = endpoint.flip(result.left, "low");
        high = endpoint.flip(result.right, "high");
        result.itv = interval.from_endpoints(low, high);

        // switch to undefined
        if (result.prev[0] == -Infinity) {
            result.prev = undefined;
        }
        if (result.left[0] == -Infinity) {
            result.left = undefined;
        }
        if (result.next[0] == Infinity) {
            result.next = undefined;
        }
        if (result.right[0] == Infinity) {
            result.right = undefined;
        }

        return result;


    }


};

