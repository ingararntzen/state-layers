/*
    
    INTERVAL ENDPOINTS

    * interval endpoints are defined by triplet [value, type]
    *
    *   there are 4 types of interval endpoints 
    *   - v) - high endpoint at v, not inclusive
    *   - v] - high endpoint at v, inclusive
    *   - [v - low endpoint at v, not inclusive
    *   - (v - low endpoint at v, inclusive
    * 
    *   A singular interval [2,2,true,true] will have endpoints [2 and 2]
    * 
    *   Additionally, to simplify comparison between endpoints and numbers
    *   wi introduce a special endpoint type - VALUE
    * 
    *   Thus we define 5 types of endpoints
    * 
    *   HIGH_OPEN : v)
    *   HIGH_CLOSED: v]
    *   VALUE: v
    *   LOW_CLOSED: [v
    *   LOW_OPEN: (v)
    * 
    *   For the purpose of endpoint comparison we maintain
    *   a logical ordering for endpoints with the same value.
    *   
    *   v) < [v == v == v] < (v
    *  
    *   We assign ordering values
    *   
    *   HIGH_OPEN: -1
    *   HIGH_CLOSED, VALUE, LOW_CLOSED: 0
    *   LOW_OPEN: 1
    * 
    *   value can be null or number. If value is null, this means unbounded endpoint
    *   i.e. no other endpoint can be larger or smaller.
    *   an unbounded low endpoint means -Infinity
    *   an unbounded high endpoint means Infinity
    *
*/

function isNumber(n) {
    return typeof n == "number";
}

const EP_TYPE = Object.freeze({
    HIGH_OPEN: ")",
    HIGH_CLOSED: "]",
    VALUE: "",
    LOW_CLOSED: "[",
    LOW_OPEN: "("
});

function is_EP_TYPE(value) {
    return Object.values(EP_TYPE).includes(value);
}

const EP_ORDER = new Map([
    [EP_TYPE.HIGH_OPEN, -1],
    [EP_TYPE.HIGH_CLOSED, 0],
    [EP_TYPE.VALUE, 0],
    [EP_TYPE.LOW_CLOSED, 0],
    [EP_TYPE.LOW_OPEN, 1]
]);

function endpoint_is_low(ep) {
    return ep[1] == EP_TYPE.LOW_CLOSED || ep[1] == EP_TYPE.LOW_OPEN;
}

function endpoint_is_high(ep) {
    return ep[1] == EP_TYPE.HIGH_CLOSED || ep[1] == EP_TYPE.HIGH_OPEN;
}

/*
    return endpoint from input
*/
function endpoint_from_input(ep) {
    if (!Array.isArray(ep)) {
        ep = [ep, EP_TYPE.VALUE];
    }
    if (ep.length != 2) {
        throw new Error("Endpoint must be a length-2 array", ep);
    }
    let [v,t] = ep;
    if (!is_EP_TYPE(t)) {
        throw new Error("Unsupported endpoint type", t);
    }
    if (v == -Infinity || v == Infinity || v == undefined) {
        v = null;
    }
    if (v == null || isNumber(v)) {
        return [v, t];
    }
    throw new Error("enpoint must be null or number", v);
}


/**
 * Internal representation 
 * replacing null valuse with -Infinity or Infinity
 * in order to simplify numerical comparison
 */
function endpoint_internal(ep) {
    if (ep[0] != null) {
        return [ep[0], ep[1]];
    }
    if (endpoint_is_low(ep)) {
        return [-Infinity, EP_TYPE.LOW_CLOSED];
    } else {
        return [Infinity, EP_TYPE.HIGH_CLOSED];
    }
}

/**
 * Comparison function for numbers
 * avoid subtraction to support Infinity values
 */
function number_cmp(a, b) {
    if (a < b) return -1; // correct order
    if (a > b) return 1; // wrong order
    return 0; // equality
}

/*
    Endpoint comparison
    returns 
        - negative : correct order
        - 0 : equal
        - positive : wrong order
*/ 
function endpoint_cmp(ep1, ep2) {    
    const [v1, t1] = endpoint_internal(ep1);
    const [v2, t2] = endpoint_internal(ep2);
    const diff = number_cmp(v1, v2);
    if (diff == 0) {
        const o1 = EP_ORDER.get(t1);
        const o2 = EP_ORDER.get(t2);
        return number_cmp(o1, o2);
    }
    return diff;
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
 * flip endpoint:
 * - ie. get adjacent endponit on the timeline
 * 
 * v) <-> [v
 * v] <-> (v
 * 
 * flipping has no effect on endpoints with unbounded value
 */

function endpoint_flip(ep, target) {
    if (target) {
        throw new Error("target is deprecated");
    }
    let [v,t] = ep;
    if (v == null) {
        return ep;
    }
    if (t == EP_TYPE.HIGH_OPEN) {
        return [v, EP_TYPE.LOW_CLOSED];
    } else if (t == EP_TYPE.HIGH_CLOSED) {
        return [v, EP_TYPE.LOW_OPEN];
    } else if (t == EP_TYPE.LOW_OPEN) {
        return [v, EP_TYPE.HIGH_CLOSED];
    } else if (t == EP_TYPE.LOW_CLOSED) {
        return [v, EP_TYPE.HIGH_OPEN];
    } else {
    	throw new Error("illegal endpoint type", t);
    }
    return p;
}

/*
    returns low and high endpoints from interval
*/
function endpoints_from_interval(itv) {
    const [low, high, lowClosed, highClosed] = itv;
    const lowType = (lowClosed) ?  EP_TYPE.LOW_CLOSED : EP_TYPE.LOW_OPEN;
    const highType = (highClosed) ?  EP_TYPE.HIGH_CLOSED : EP_TYPE.HIGH_OPEN;
    return [[low, lowType], [high, highType]];
}


/*
    INTERVALS

    Intervals are [low, high, lowClosed, highClosed]

*/ 


/*
    return true if point or endpoint is covered by interval
    point p can be number value or an endpoint
*/
function interval_covers_endpoint(itv, ep) {
    const [low_ep, high_ep] = endpoints_from_interval(itv);
    ep = endpoint_from_input(ep);
    // covers: low <= p <= high
    return endpoint_le(low_ep, ep) && endpoint_le(ep, high_ep);
}
// convenience
function interval_covers_point(itv, p) {
    return interval_covers_endpoint(itv, p);
}

/*
    Return true if interval endpoints are equal
*/
function interval_is_singular(interval) {
    const [low_ep, high_ep] = endpoints_from_interval(itv);
    return endpoint_eq(low_ep, high_ep);
}

/*
    Create interval from endpoints
*/
function interval_from_endpoints(ep1, ep2) {
    let [v1, t1] = ep1;
    let [v2, t2] = ep2;
    if (!endpoint_is_low(ep1)) {
        throw new Error("illegal low endpoint", ep1);
    }
    if (!endpoint_is_high(ep2)) {
        throw new Error("illegal high endpoint", ep2);
    }
    return [v1, v2, t1 == EP_TYPE.LOW_CLOSED, t2 == EP_TYPE.HIGH_CLOSED];
}


function interval_from_input(input){
    let itv = input;
    if (itv == undefined || itv == null) {
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
        itv = [itv[0], itv[0], true, true];
    } else if (itv.length == 2) {
        itv = [itv[0], itv[1], true, false];
    } else if (itv.length == 3) {
        itv = [itv[0], itv[1], itv[2], false];
    } else if (itv.length > 4) {
        itv = [itv[0], itv[1], itv[2], itv[4]];
    }
    let [low, high, lowInclude, highInclude] = itv;
    // boundary conditions are number or null
    if (low == undefined || low == -Infinity) {
        low = null;
    }
    if (high == undefined || high == Infinity) {
        high = null;
    }
    // check low
    if (low == null) {
        lowInclude = true;
    } else {
        if (!isNumber(low)) throw new Error("low not a number", low);
    }
    // check high
    if (high == null) {
        highInclude = true;
    } else {
        if (!isNumber(high)) throw new Error("high not a number", high);
    }    
    // check that low <= high
    if (low != null && high != null) {
        if (low > high) throw new Error("low > high", low, high);
        // singleton
        if (low == high) {
            lowInclude = true;
            highInclude = true;
        }
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
    from_interval: endpoints_from_interval,
    from_input: endpoint_from_input,
    types: {...EP_TYPE}
}
export const interval = {
    covers_endpoint: interval_covers_endpoint,
    covers_point: interval_covers_point, 
    is_singular: interval_is_singular,
    from_endpoints: interval_from_endpoints,
    from_input: interval_from_input
}
