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

function nearby (layers, offset) {

    // accumulate nearby from all sources
    const left_list = [], center_list = [], right_list = [];
    for (let src of layers) {
        let {left, center, right} = src.nearby(offset);
        if (left != undefined) left_list.push(left);
        center_list.push(...center.items);
        if (right != undefined) right_list.push(right);
    }
    
    // find closest endpoint to the right (not in center)
    rights.sort(cmp_ascending);
    const min_right_low = rights[0]; // endpoint or undefined

    // find closest endpoint to the left
    lefts.sort(cmp_descending);
    const max_left_high = lefts[0]; // endpoint or undefined

    // empty center
    if (centers.length == 0) {
        return {left, prev: undefined, center: [], next: undefined, right}
    }

    // center high
    let center_high_list = centers.map((item) => {
        return endpoint.from_interval(item.itv)[1];
    }).sort(cmp_ascending);
    let min_center_high = center_high_list[0];
    let max_center_high = center_high_list.slice(-1)[0];
    let multiple_center_high = !endpoint.eq(min_center_high, max_center_high)

    // center low
    let center_low_list = centers.map((item) => {
        return endpoint.from_interval(item.itv)[0]
    }).sort(cmp_descending);
    let max_center_low = center_low_list[0];
    let min_center_low = center_low_list.slice(-1)[0];
    let multiple_center_low = !endpoint.eq(max_center_low, min_center_low)

    // nearby
	const nearby = {
        left: undefined,
        prev: undefined,
		center: center_list, 
		right: undefined,
        next:undefined
	}

    let low, high;

    // right
    if (endpoint.le (min_right_low, min_center_high)) {
        nearby.next = min_right_low;
        high = endpoint.flip(min_right_low, "high")
    } else {
        nearby.next = endpoint.flip(min_center_high, "low")
        high = min_center_high;
    }
    nearby.right = (multiple_center_high) ? nearby.next : min_right_low;
	if (nearby.right[0] == Infinity) {
		nearby.right = undefined;
	}

    // left
    if (endpoint.ge(max_left_high, max_center_low)) {
        nearby.prev = max_left_high;
        low = endpoint.flip(max_left_high, "low")
    } else {
        nearby.prev = endpoint.flip(max_center_low, "high");
        low = max_center_low;
    }
    nearby.left = (multiple_center_low) ? nearby.prev : max_left_high;    
	if (nearby.left[0] == -Infinity) {
		nearby.left = undefined;
	}

    // interval
    nearby.itv = interval.from_endpoints(low, high);

    return nearby;
}