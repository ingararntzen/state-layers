import { interval, endpoint } from "./intervals.js";
import { NearbyIndexBase } from "./nearbyindex.js";

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

    /*
        nearby by offset
        
        returns {left, center, right}

        binary search based on offset
        1) found, idx
            offset matches value of interval.low of an item
            idx gives the index of this item in the array
        2) not found, idx
            offset is either covered by item at (idx-1),
            or it is not => between entries
            in this case - idx gives the index where an item
            should be inserted - if it had low == offset
    */
    nearby(offset) {
        offset = this.check(offset);
        const result = {
            center: [],
            itv: [-Infinity, Infinity, true, true],
            left: [-Infinity, 0],
            prev: [-Infinity, 0],
            right: [Infinity, 0],
            next: [Infinity, 0]
        };
        let items = this._src.get_items();
        let indexes, item;
        const size = items.length;
        if (size == 0) {
            return result; 
        }
        let [found, idx] = find_index(offset[0], items, get_low_value);
        if (found) {
            // search offset matches item low exactly
            // check that it indeed covered by item interval
            item = items[idx]
            if (interval.covers_endpoint(item.itv, offset)) {
                indexes = {left:idx-1, center:idx, right:idx+1};
            }
        }
        if (indexes == undefined) {
            // check prev item
            item = items[idx-1];
            if (item != undefined) {
                // check if search offset is covered by item interval
                if (interval.covers_endpoint(item.itv, offset)) {
                    indexes = {left:idx-2, center:idx-1, right:idx};
                } 
            }
        }	
        if (indexes == undefined) {
            // prev item either does not exist or is not relevant
            indexes = {left:idx-1, center:-1, right:idx};
        }

        // center
        if (0 <= indexes.center && indexes.center < size) {
            result.center =  [items[indexes.center]];
        }
        // prev/next
        if (0 <= indexes.left && indexes.left < size) {
            result.prev =  get_high_endpoint(items[indexes.left]);
        }
        if (0 <= indexes.right && indexes.right < size) {
            result.next =  get_low_endpoint(items[indexes.right]);
        }        
        // left/right
        let low = [-Infinity, 0], high= [Infinity, 0];
        if (result.center.length > 0) {
            let itv = result.center[0].itv;
            [low, high] = endpoint.from_interval(itv);
            result.left = (low[0] > -Infinity) ? endpoint.flip(low, "high") : [-Infinity, 0];
            result.right = (high[0] < Infinity) ? endpoint.flip(high, "low") : [Infinity, 0];
            result.itv = result.center[0].itv;
        } else {
            result.left = result.prev;
            result.right = result.next;
            // interval
            let left = result.left;
            if (low[0] == -Infinity) {
                low = endpoint.flip(left, "low");
            }
            let right = result.right;
            if (high[0] == Infinity) {
                high = endpoint.flip(right, "high");
            }
            result.itv = interval.from_endpoints(low, high);
        }
        return result;
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
