import { interval, endpoint } from "./intervals.js";
import { NearbyIndexBase } from "./nearbyindex_base.js";

/**
 * 
 * Nearby Index Simple
 * 
 * - items are assumed to be non-overlapping on the timeline, 
 * - implying that nearby.center will be a list of at most one ITEM. 
 * - exception will be raised if overlapping ITEMS are found
 * - ITEMS is assumbed to be immutable array - change ITEMS by replacing array
 * 
 *  
 */


// get interval low point
function get_low_value(item) {
    return item.itv[0];
}

// get interval low endpoint
function get_low_endpoint(item) {
    return endpoint.from_interval(item.itv)[0]
}

// get interval high endpoint
function get_high_endpoint(item) {
    return endpoint.from_interval(item.itv)[1]
}


export class NearbyIndexSimple extends NearbyIndexBase {

    constructor(src) {
        super();
        this._src = src;
    }

    get src () {return this._src;}


    nearby(offset) {
        offset = endpoint.from_input(offset);
        let item = undefined;
        let center_idx = undefined;
        let items = this._src.get_items();

        // binary search for index
        let [found, idx] = find_index(offset[0], items, get_low_value);
        if (found) {
            // search offset matches item low exactly
            // check that it is indeed covered by item interval
            item = items[idx]
            if (interval.covers_endpoint(item.itv, offset)) {
                center_idx = idx
            }
        }
        if (center_idx == undefined) {
            // check if previous item covers offset
            item = items[idx-1];
            if (item != undefined) {
                if (interval.covers_endpoint(item.itv, offset)) {
                    center_idx = idx-1;
                }
            } 
        }

        /* 
            center is non-empty 
        */
        if (center_idx != undefined) {
            item = items[center_idx];
            const [low, high] = endpoint.from_interval(item.itv);
            return {
                center: [item],
                itv: item.itv,
                left: endpoint.flip(low, "high"),
                right: endpoint.flip(high, "low")
            }
        }

        /* 
            center is empty 
        */
        // left is based on previous item
        item = items[idx-1];
        let left = [-Infinity, 0];
        if (item != undefined) {
            left = endpoint.from_interval(item.itv)[1];
        }
        // right is based on next item
        item = items[idx];
        let right = [Infinity, 0];
        if (item != undefined) {
            right = endpoint.from_interval(item.itv)[0];
        }
        // itv based on left and right        
        let low = endpoint.flip(left, "low");
        let high = endpoint.flip(right, "high");

        return {
            center: [], left, right,
            itv: interval.from_endpoints(low, high)
        };
    }
}

/*********************************************************************
	UTILS
*********************************************************************/


/*
	binary search for finding the correct insertion index into
	the sorted array (ascending) of items
	
	array contains objects, and value func retreaves a value
	from each object.

	return [found, index]
*/

function find_index(target, arr, value_func) {

    function default_value_func(el) {
        return el;
    }
    
    let left = 0;
	let right = arr.length - 1;
	value_func = value_func || default_value_func;
	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		let mid_value = value_func(arr[mid]);
		if (mid_value === target) {
			return [true, mid]; // Target already exists in the array
		} else if (mid_value < target) {
			  left = mid + 1; // Move search range to the right
		} else {
			  right = mid - 1; // Move search range to the left
		}
	}
  	return [false, left]; // Return the index where target should be inserted
}
