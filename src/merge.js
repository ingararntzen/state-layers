import {endpoint, interval} from "./intervals.js";


function cmp_ascending(p1, p2) {
    return endpoint.cmp(p1, p2)
}

function cmp_descending(p1, p2) {
    return endpoint.cmp(p2, p1)
}

/**
 * calculate nearby structure for multiple layers
 */

export function nearby(layers, offset) {
    // accumulate nearby from all sources
    const left_list = [], center_list = [], right_list = [];
    for (let layer of layers) {
        let {left, center, right} = layer.index.nearby(offset);
        if (left != undefined) left_list.push(left);
        center_list.push(...center);
        if (right != undefined) right_list.push(right);
    }
    
    // find closest endpoint to the right (not in center)
    right_list.sort(cmp_ascending);
    const min_right_low = right_list[0]; // endpoint or undefined

    // find closest endpoint to the left
    left_list.sort(cmp_descending);
    const max_left_high = left_list[0]; // endpoint or undefined

    let low, high; 
    const result = {
        left: undefined,
        prev: undefined,
        center: center_list, 
        right: undefined,
        next: undefined
    }

    // empty center
    if (center_list.length == 0) {
        result.right = min_right_low;       
        result.left = max_left_high;
        result.next = result.right;
        result.prev = result.left;

        if (result.prev != undefined) {
            low = endpoint.flip(result.prev, "low");
        } else {
            low = [-Infinity, 0];
        }
        if (result.next != undefined) {
            high = endpoint.flip(result.next, "high");
        } else {
            high = [Infinity, 0];
        }
        result.itv = interval.from_endpoints(low, high);
        return result;
    }

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

    // right
    if (endpoint.le(min_right_low, min_center_high)) {
        result.next = min_right_low;
        high = endpoint.flip(min_right_low, "high")
    } else {
        result.next = endpoint.flip(min_center_high, "low")
        high = min_center_high;
    }
    result.right = (multiple_center_high) ? result.next : min_right_low;
    if (result.right[0] == Infinity) {
        result.right = undefined;
    }

    // left
    if (endpoint.ge(max_left_high, max_center_low)) {
        result.prev = max_left_high;
        low = endpoint.flip(max_left_high, "low")
    } else {
        result.prev = endpoint.flip(max_center_low, "high");
        low = max_center_low;
    }
    result.left = (multiple_center_low) ? result.prev : max_left_high;    
    if (result.left[0] == -Infinity) {
        result.left = undefined;
    }

    // interval
    result.itv = interval.from_endpoints(low, high);

    return result;
}
