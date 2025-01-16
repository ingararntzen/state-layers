/*
    
    INTERVAL ENDPOINTS

    * interval endpoints are defined by [value, sign], for example
    * 
    * 4) -> [4,-1] - endpoint is on the left of 4
    * [4, 4, 4] -> [4, 0] - endpoint is at 4 
    * (4 -> [4, 1] - endpoint is on the right of 4)
    * 
    * This representation ensures that the interval endpoints are ordered and allows
    * intervals to be exclusive or inclusive, yet cover the entire real line 
    * 
    * [a,b], (a,b), [a,b), [a, b) are all valid intervals

*/

/*
    Endpoint comparison
    returns 
        - negative : correct order
        - 0 : equal
        - positive : wrong order


    NOTE 
    - cmp(4],[4 ) == 0 - since these are the same with respect to sorting
    - but if you want to see if two intervals are overlapping in the endpoints
    cmp(high_a, low_b) > 0 this will not be good
    
*/ 


function cmpNumbers(a, b) {
    if (a === b) return 0;
    if (a === Infinity) return 1;
    if (b === Infinity) return -1;
    if (a === -Infinity) return -1;
    if (b === -Infinity) return 1;
    return a - b;
  }

function endpoint_cmp (p1, p2) {
    let [v1, s1] = p1;
    let [v2, s2] = p2;
    let diff = cmpNumbers(v1, v2);
    return (diff != 0) ? diff : s1 - s2;
}

function endpoint_lt (p1, p2) {
    return endpoint_cmp(p1, p2) < 0
}
function endpoint_le (p1, p2) {
    return endpoint_cmp(p1, p2) <= 0
}
function endpoint_gt (p1, p2) {
    return endpoint_cmp(p1, p2) > 0
}
function endpoint_ge (p1, p2) {
    return endpoint_cmp(p1, p2) >= 0
}
function endpoint_eq (p1, p2) {
    return endpoint_cmp(p1, p2) == 0
}
function endpoint_min(p1, p2) {
    return (endpoint_le(p1, p2)) ? p1 : p2;
}
function endpoint_max(p1, p2) {
    return (endpoint_ge(p1, p2)) ? p1 : p2;
}

/**
 * flip endpoint to the other side
 * 
 * useful for making back-to-back intervals 
 * 
 * high) <-> [low
 * high] <-> (low
 */

function endpoint_flip(p, target) {
    let [v,s] = p;
    if (target == "low") {
    	// assume point is high: sign must be -1 or 0
    	if (s > 0) {
			throw new Error("endpoint is already low");    		
    	}
        p = [v, s+1];
    } else if (target == "high") {
		// assume point is low: sign is 0 or 1
    	if (s < 0) {
			throw new Error("endpoint is already high");    		
    	}
        p = [v, s-1];
    } else {
    	throw new Error("illegal type", target);
    }
    return p;
}


/*
    returns low and high endpoints from interval
*/
function endpoints_from_interval(itv) {
    let [low, high, lowClosed, highClosed] = itv;
    let low_p = (lowClosed) ? [low, 0] : [low, 1]; 
    let high_p = (highClosed) ? [high, 0] : [high, -1];
    return [low_p, high_p];
}


/*
    INTERVALS

    Intervals are [low, high, lowClosed, highClosed]

*/ 

/*
    return true if point p is covered by interval itv
    point p can be number p or a point [p,s]

    implemented by comparing points
    exception if interval is not defined
*/
function interval_covers_endpoint(itv, p) {
    let [low_p, high_p] = endpoints_from_interval(itv);
    // covers: low <= p <= high
    return endpoint_le(low_p, p) && endpoint_le(p, high_p);
}
// convenience
function interval_covers_point(itv, p) {
    return interval_covers_endpoint(itv, [p, 0]);
}



/*
    Return true if interval has length 0
*/
function interval_is_singular(interval) {
    return interval[0] == interval[1]
}

/*
    Create interval from endpoints
*/
function interval_from_endpoints(p1, p2) {
    let [v1, s1] = p1;
    let [v2, s2] = p2;
    // p1 must be a low point
    if (s1 == -1) {
        throw new Error("illegal low point", p1);
    }
    if (s2 == 1) {
        throw new Error("illegeal high point", p2);   
    }
    return [v1, v2, (s1==0), (s2==0)]
}

function isNumber(n) {
    return typeof n == "number";
}

export function interval_from_input(input){
    let itv = input;
    if (itv == undefined) {
        throw new Error("input is undefined");
    }
    if (!Array.isArray(itv)) {
        if (isNumber(itv)) {
            // input is singular number
            itv = [itv, itv, true, true];
        } else {
            throw new Error(`input: ${input}: must be Array or Number`)
        }
    };
    // make sure interval is length 4
    if (itv.length == 1) {
        itv = [itv[0], itv[0], true, true]
    } else if (itv.length == 2) {
        itv = itv.concat([true, false]);
    } else if (itv.length == 3) {
        itv = itv.push(false);
    } else if (itv.length > 4) {
        itv = itv.slice(0,4);
    }
    let [low, high, lowInclude, highInclude] = itv;
    // undefined
    if (low == undefined || low == null) {
        low = -Infinity;
    }
    if (high == undefined || high == null) {
        high = Infinity;
    }
    // check that low and high are numbers
    if (!isNumber(low)) throw new Error("low not a number", low);
    if (!isNumber(high)) throw new Error("high not a number", high);
    // check that low <= high
    if (low > high) throw new Error("low > high", low, high);
    // singleton
    if (low == high) {
        lowInclude = true;
        highInclude = true;
    }
    // check infinity values
    if (low == -Infinity) {
        lowInclude = true;
    }
    if (high == Infinity) {
        highInclude = true;
    }
    // check that lowInclude, highInclude are booleans
    if (typeof lowInclude !== "boolean") {
        throw new Error("lowInclude not boolean");
    } 
    if (typeof highInclude !== "boolean") {
        throw new Error("highInclude not boolean");
    }
    return [low, high, lowInclude, highInclude];
}




export const endpoint = {
    le: endpoint_le,
    lt: endpoint_lt,
    ge: endpoint_ge,
    gt: endpoint_gt,
    cmp: endpoint_cmp,
    eq: endpoint_eq,
    min: endpoint_min,
    max: endpoint_max,
    flip: endpoint_flip,
    from_interval: endpoints_from_interval
}
export const interval = {
    covers_endpoint: interval_covers_endpoint,
    covers_point: interval_covers_point, 
    is_singular: interval_is_singular,
    from_endpoints: interval_from_endpoints,
    from_input: interval_from_input
}
