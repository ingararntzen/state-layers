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
    if (v == -Infinity) {
        return [null, EP_TYPE.LOW_CLOSED];
    }
    if (v == Infinity) {
        return [null, EP_TYPE.HIGH_CLOSED];
    }
    if (v == undefined || v == null || isNumber(v)) {
        return [v, t];
    }
    throw new Error("endpoint must be null or number", v);
}

const endpoint_POS_INF = endpoint_from_input(Infinity);
const endpoint_NEG_INF = endpoint_from_input(-Infinity);

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
}

/*
    returns low and high endpoints from interval
*/
function endpoints_from_interval(itv) {
    const [low, high, lowClosed, highClosed] = itv;
    const lowType = (lowClosed) ?  EP_TYPE.LOW_CLOSED : EP_TYPE.LOW_OPEN;
    const highType = (highClosed) ?  EP_TYPE.HIGH_CLOSED : EP_TYPE.HIGH_OPEN;
    const lowEp = endpoint_from_input([low, lowType]);
    const highEp = endpoint_from_input([high, highType]);
    return [lowEp, highEp];
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
    }    // make sure interval is length 4
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

const endpoint = {
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
    types: {...EP_TYPE},
    POS_INF : endpoint_POS_INF,
    NEG_INF : endpoint_NEG_INF
};
const interval = {
    covers_endpoint: interval_covers_endpoint,
    covers_point: interval_covers_point, 
    is_singular: interval_is_singular,
    from_endpoints: interval_from_endpoints,
    from_input: interval_from_input
};

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
 *          always a high-endpoint or endpoint.NEG_INF
 *      right:
 *          first interval endpoint to the right
 *          which will produce different {center}
 *          always a low-endpoint or endtpoint.POS_INF
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
 * interval endpoints are defined by [value, type], for example
 * 
 * 4) -> [4,")"] - high endpoint left of 4
 * [4 -> [4, "["] - low endpoint includes 4
 * 4  -> [4, ""] - value 4
 * 4] -> [4, "]"] - high endpoint includes 4
 * (4 -> [4, "("] - low endpoint is right of 4
 * 
 */


/**
 * return first high endpoint on the left from nearby,
 * which is not in center
 */
function left_endpoint (nearby) {
    const low = endpoint.from_interval(nearby.itv)[0];
    return endpoint.flip(low);
}

/**
 * return first low endpoint on the right from nearby,
 * which is not in center
 */

function right_endpoint (nearby) {
    const high = endpoint.from_interval(nearby.itv)[1];
    return endpoint.flip(high);
}



class NearbyIndexBase {


    /* 
        Nearby method
    */
    nearby(offset) {
        throw new Error("Not implemented");
    }

    empty() {
        return this.first() == undefined;
    }

    /*
        return low point of leftmost entry
    */
    first() {
        let {center, right} = this.nearby(endpoint.NEG_INF);
        if (center.length > 0 ) {
            return endpoint.NEG_INF;
        }
        if (endpoint.lt(right, endpoint.POS_INF)) {
            return right;
        } else {
            // empty
            return undefined;
        }
    }

    /*
        return high point of rightmost entry
    */
    last() {
        let {left, center} = this.nearby(endpoint.POS_INF);
        if (center.length > 0) {
            return endpoint.POS_INF;
        }
        if (endpoint.gt(left, endpoint.NEG_INF)) {
            return left;
        } else {
            // empty
            return undefined;
        }
    }


    /**
     * return nearby of first region to the right
     * which is not the center region. If not exists, return
     * undefined. 
     */
    right_region(nearby) {
        const right = right_endpoint(nearby);
        if (right[0] == null) {
            return undefined;
        }
        return this.nearby(right);
    }

    /**
     * return nearby of first region to the left
     * which is not the center region. If not exists, return
     * undefined. 
     */
    left_region(nearby) {
        const left = left_endpoint(nearby);
        if (left[0] == null) {
            return undefined;
        }
        return this.nearby(left);    
    }

    /**
     * find first region to the "right" or "left"
     * which is not the center region, and which meets
     * a condition on nearby.center.
     * Default condition is center non-empty
     * If not exists, return undefined. 
     */
    
    find_region(nearby, options={}) {
        let {
            direction = 1,
            condition = (center) => center.length > 0
        } = options;
        let next_nearby;
        while(true) {
            if (direction == 1) {
                next_nearby = this.right_region(nearby);
            } else {
                next_nearby = this.left_region(nearby);
            }
            if (next_nearby == undefined) {
                return undefined;
            }
            if (condition(next_nearby.center)) {
                // found region 
                return next_nearby;
            }
            // region not found
            // continue searching the right
            nearby = next_nearby;
        }
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
        this._start = endpoint.from_input(start);
        this._stop = endpoint.from_input(stop);

        if (includeEmpty) {
            this._condition = () => true;
        } else {
            this._condition = (center) => center.length > 0;
        }
        this._current;
    }

    next() {
        if (this._current == undefined) {
            // initialse
            this._current = this._index.nearby(this._start);
            if (this._condition(this._current.center)) {
                return {value:this._current, done:false};
            }
        }
        let options = {condition:this._condition, direction:1};
        this._current = this._index.find_region(this._current, options);
        if (this._current == undefined) {
            return {value:undefined, done:true};
        } else {
            return {value:this._current, done:false}
        }
    }

    [Symbol.iterator]() {
        return this;
    }
}

/**
 * nearby_from
 * 
 * utility function for creating a nearby object in circumstances
 * where there are overlapping intervals This could be when a 
 * stateprovider for a layer has overlapping items or when 
 * multiple nearby indexes are merged into one.
 * 
 * 
 * @param {*} prev_high : the rightmost high-endpoint left of offset
 * @param {*} center_low_list : low-endpoints of center
 * @param {*} center : center
 * @param {*} center_high_list : high-endpoints of center
 * @param {*} next_low : the leftmost low-endpoint right of offset
 * @returns 
 */

function cmp_ascending$1(p1, p2) {
    return endpoint.cmp(p1, p2)
}

function cmp_descending$1(p1, p2) {
    return endpoint.cmp(p2, p1)
}

function nearby_from (
    prev_high, 
    center_low_list, 
    center,
    center_high_list,
    next_low) {

    // nearby
    const result = {center};

    if (center.length == 0) {
        // empty center
        result.right = next_low;
        result.left = prev_high;
    } else {
        // non-empty center
        
        // center high
        center_high_list.sort(cmp_ascending$1);
        let min_center_high = center_high_list[0];
        let max_center_high = center_high_list.slice(-1)[0];
        let multiple_center_high = !endpoint.eq(min_center_high, max_center_high);

        // center low
        center_low_list.sort(cmp_descending$1);
        let max_center_low = center_low_list[0];
        let min_center_low = center_low_list.slice(-1)[0];
        let multiple_center_low = !endpoint.eq(max_center_low, min_center_low);

        // next/right
        if (endpoint.le(next_low, min_center_high)) {
            result.right = next_low;
        } else {
            result.right = endpoint.flip(min_center_high);
        }
        result.next = (multiple_center_high) ? result.right : next_low;

        // prev/left
        if (endpoint.ge(prev_high, max_center_low)) {
            result.left = prev_high;
        } else {
            result.left = endpoint.flip(max_center_low);
        }
        result.prev = (multiple_center_low) ? result.left : prev_high;

    }

    // interval from left/right
    let low = endpoint.flip(result.left);
    let high = endpoint.flip(result.right);
    result.itv = interval.from_endpoints(low, high);

    return result;
}


/**
 * Create a NearbyIndex for a src object Layer.
 * 
 * The src object resolves queries for the entire timeline.
 * In order for the default LayerCache to work, an
 * object with a .query(offset) method is needed in 
 * nearby.center.
 */

class NearbyIndexSrc extends NearbyIndexBase {

    constructor(src) {
        super();
        this._src = src;
        this._cache = src.createCache();
    }

    nearby(offset) {
        const nearby = this._src.index.nearby(offset);
        nearby.center = [this._cache];
        return nearby;
    }
}

/*
	Copyright 2020
	Author : Ingar Arntzen

	This file is part of the Timingsrc module.

	Timingsrc is free software: you can redistribute it and/or modify
	it under the terms of the GNU Lesser General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	Timingsrc is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Lesser General Public License for more details.

	You should have received a copy of the GNU Lesser General Public License
	along with Timingsrc.  If not, see <http://www.gnu.org/licenses/>.
*/



/*
	Event
	- name: event name
	- publisher: the object which defined the event
	- init: true if the event suppports init events
	- subscriptions: subscriptins to this event

*/

class Event {

	constructor (publisher, name, options) {
		options = options || {};
		this.publisher = publisher;
		this.name = name;
		this.init = (options.init === undefined) ? false : options.init;
		this.subscriptions = [];
	}

	/*
		subscribe to event
		- subscriber: subscribing object
		- callback: callback function to invoke
		- options:
			init: if true subscriber wants init events
	*/
	subscribe (callback, options) {
		if (!callback || typeof callback !== "function") {
			throw new Error("Callback not a function", callback);
		}
		const sub = new Subscription(this, callback, options);
		this.subscriptions.push(sub);
	    // Initiate init callback for this subscription
	    if (this.init && sub.init) {
	    	sub.init_pending = true;
	    	let self = this;
	    	Promise.resolve().then(function () {
	    		const eArgs = self.publisher.eventifyInitEventArgs(self.name) || [];
	    		sub.init_pending = false;
	    		for (let eArg of eArgs) {
	    			self.trigger(eArg, [sub], true);
	    		}
	    	});
	    }
		return sub
	}

	/*
		trigger event

		- if sub is undefined - publish to all subscriptions
		- if sub is defined - publish only to given subscription
	*/
	trigger (eArg, subs, init) {
		let eInfo, ctx;
		for (const sub of subs) {
			// ignore terminated subscriptions
			if (sub.terminated) {
				continue;
			}
			eInfo = {
				src: this.publisher,
				name: this.name,
				sub: sub,
				init: init
			};
			ctx = sub.ctx || this.publisher;
			try {
				sub.callback.call(ctx, eArg, eInfo);
			} catch (err) {
				console.log(`Error in ${this.name}: ${sub.callback} ${err}`);
			}
		}
	}

	/*
	unsubscribe from event
	- use subscription returned by previous subscribe
	*/
	unsubscribe(sub) {
		let idx = this.subscriptions.indexOf(sub);
		if (idx > -1) {
			this.subscriptions.splice(idx, 1);
			sub.terminate();
		}
	}
}


/*
	Subscription class
*/

class Subscription {

	constructor(event, callback, options) {
		options = options || {};
		this.event = event;
		this.name = event.name;
		this.callback = callback;
		this.init = (options.init === undefined) ? this.event.init : options.init;
		this.init_pending = false;
		this.terminated = false;
		this.ctx = options.ctx;
	}

	terminate() {
		this.terminated = true;
		this.callback = undefined;
		this.event.unsubscribe(this);
	}
}


/*

	EVENTIFY INSTANCE

	Eventify brings eventing capabilities to any object.

	In particular, eventify supports the initial-event pattern.
	Opt-in for initial events per event type.

	eventifyInitEventArgs(name) {
		if (name == "change") {
			return [this._value];
		}
	}

*/

function eventifyInstance (object) {
	object.__eventify_eventMap = new Map();
	object.__eventify_buffer = [];
	return object;
}

/*
	EVENTIFY PROTOTYPE

	Add eventify functionality to prototype object
*/

function eventifyPrototype(_prototype) {

	function eventifyGetEvent(object, name) {
		const event = object.__eventify_eventMap.get(name);
		if (event == undefined) {
			throw new Error("Event undefined", name);
		}
		return event;
	}

	/*
		DEFINE EVENT
		- used only by event source
		- name: name of event
		- options: {init:true} specifies init-event semantics for event
	*/
	function eventifyDefine(name, options) {
		// check that event does not already exist
		if (this.__eventify_eventMap.has(name)) {
			throw new Error("Event already defined", name);
		}
		this.__eventify_eventMap.set(name, new Event(this, name, options));
	}
	/*
		ON
		- used by subscriber
		register callback on event.
	*/
	function on(name, callback, options) {
		return eventifyGetEvent(this, name).subscribe(callback, options);
	}
	/*
		OFF
		- used by subscriber
		Un-register a handler from a specfic event type
	*/
	function off(sub) {
		return eventifyGetEvent(this, sub.name).unsubscribe(sub);
	}

	function eventifySubscriptions(name) {
		return eventifyGetEvent(this, name).subscriptions;
	}



	/*
		Trigger list of eventItems on object

		eventItem:  {name:.., eArg:..}

		copy all eventItems into buffer.
		request emptying the buffer, i.e. actually triggering events,
		every time the buffer goes from empty to non-empty
	*/
	function eventifyTriggerAll(eventItems) {
		if (eventItems.length == 0) {
			return;
		}

		// make trigger items
		// resolve non-pending subscriptions now
		// else subscriptions may change from pending to non-pending
		// between here and actual triggering
		// make list of [ev, eArg, subs] tuples
		let triggerItems = eventItems.map((item) => {
			let {name, eArg} = item;
			let ev = eventifyGetEvent(this, name);
			let subs = ev.subscriptions.filter(sub => sub.init_pending == false);
			return [ev, eArg, subs];
		}, this);

		// append trigger Items to buffer
		const len = triggerItems.length;
		const buf = this.__eventify_buffer;
		const buf_len = this.__eventify_buffer.length;
		// reserve memory - set new length
		this.__eventify_buffer.length = buf_len + len;
		// copy triggerItems to buffer
		for (let i=0; i<len; i++) {
			buf[buf_len+i] = triggerItems[i];
		}
		// request emptying of the buffer
		if (buf_len == 0) {
			let self = this;
			Promise.resolve().then(function() {
				for (let [ev, eArg, subs] of self.__eventify_buffer) {
					// actual event triggering
					ev.trigger(eArg, subs, false);
				}
				self.__eventify_buffer = [];
			});
		}
	}

	/*
		Trigger multiple events of same type (name)
	*/
	function eventifyTriggerAlike(name, eArgs) {
		return this.eventifyTriggerAll(eArgs.map(eArg => {
			return {name, eArg};
		}));
	}

	/*
		Trigger single event
	*/
	function eventifyTrigger(name, eArg) {
		return this.eventifyTriggerAll([{name, eArg}]);
	}

	_prototype.eventifyDefine = eventifyDefine;
	_prototype.eventifyTrigger = eventifyTrigger;
	_prototype.eventifyTriggerAlike = eventifyTriggerAlike;
	_prototype.eventifyTriggerAll = eventifyTriggerAll;
	_prototype.eventifySubscriptions = eventifySubscriptions;
	_prototype.on = on;
	_prototype.off = off;
}
/*
	Event Variable

	Objects with a single "change" event
*/

class EventVariable {

	constructor (value) {
		eventifyInstance(this);
		this._value = value;
		this.eventifyDefine("change", {init:true});
	}

	eventifyInitEventArgs(name) {
		if (name == "change") {
			return [this._value];
		}
	}

	get value () {return this._value};
	set value (value) {
		if (value != this._value) {
			this._value = value;
			this.eventifyTrigger("change", value);
		}
	}
}
eventifyPrototype(EventVariable.prototype);

/*
    This decorates an object/prototype with basic (synchronous) callback support.
*/

const PREFIX$1 = "__callback";

function addState$1(object) {
    object[`${PREFIX$1}_handlers`] = [];
}

function add_callback (handler) {
    let handle = {
        handler: handler
    };
    this[`${PREFIX$1}_handlers`].push(handle);
    return handle;
}
function remove_callback (handle) {
    let index = this[`${PREFIX$1}_handlers`].indexOf(handle);
    if (index > -1) {
        this[`${PREFIX$1}_handlers`].splice(index, 1);
    }
}
function notify_callbacks (eArg) {
    this[`${PREFIX$1}_handlers`].forEach(function(handle) {
        handle.handler(eArg);
    });
}

function addMethods$1 (obj) {
    const api = {
        add_callback, remove_callback, notify_callbacks
    };
    Object.assign(obj, api);
}

/**
 * test if object implements callback api
 */
function is_callback_api (obj) {
    if (obj == undefined) return false;
    const methods = ["add_callback", "remove_callback"];
    for (const prop of methods) {
        if (!(prop in obj)) return false;
        if (typeof obj[prop] != 'function') return false;
    }
    return true;
}

function is_finite_number(obj) {
    return (typeof obj == 'number') && isFinite(obj);
}

function check_number(name, obj) {
    if (!is_finite_number(obj)) {
        throw new Error(`${name} must be finite number ${obj}`);
    }
}

/**
 * convenience function to render a cursor 
 */
function render_cursor (cursor, selector, options={}) {
    const {delay=200, render, novalue} = options;
    const elems = document.querySelector(selector);
    function _render(state) {
        if (state.value == undefined && novalue != undefined) {
            state.value = novalue;
        }
        if (render != undefined) {
            render(state, elems);
        } else {
            elems.textContent = (state.value != undefined) ? `${state.value}` : "";
        }
    }
    return cursor.bind(_render, delay);
}




/*
    similar to range function in python
*/

function range (start, end, step = 1, options={}) {
    const result = [];
    const {include_end=false} = options;
    if (step === 0) {
        throw new Error('Step cannot be zero.');
    }
    if (start < end) {
        for (let i = start; i < end; i += step) {
          result.push(i);
        }
    } else if (start > end) {
        for (let i = start; i > end; i -= step) {
          result.push(i);
        }
    }
    if (include_end) {
        result.push(end);
    }
    return result;
}


// webpage clock - performance now - seconds
const local_clock = function local_clock () {
    return {
        now: () => {
            return performance.now()/1000.0;
        }
    }
}();

/**
 * Create a single state from a list of states, using a valueFunc
 * state:{value, dynamic, offset}
 * 
 */

function toState(sources, states, offset, options={}) {
    let {valueFunc, stateFunc, numeric=false, mask} = options; 
    let state;
    if (valueFunc != undefined) {
        let value = valueFunc({sources, states, offset});
        let dynamic = states.map((v) => v.dymamic).some(e=>e);
        state = {value, dynamic, offset};
    } else if (stateFunc != undefined) {
        state = {...stateFunc({sources, states, offset}), offset};
    } else if (states.length == 0) {
        state = {value:undefined, dynamic:false, offset};
    } else {
        state = {...states[0], offset};
    }
    if (numeric && state.value != undefined) {
        if (!is_finite_number(state.value)) {
            state = {value:mask, dynamic:false, offset};
        }
    }
    return state;
}


function check_items(items) {
    if (!Array.isArray(items)) {
        throw new Error("Input must be an array");
    }
    for (const item of items) {
        // make suer item has id
        item.id = item.id || random_string(10);
        // make sure item intervals are well formed
        item.itv = interval.from_input(item.itv);
    }
    return items;
}


function random_string(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    for(var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Improved set_timeout
 * 
 * Timeout is defined by a target_ms reading of performance.now().
 * Callback is not invoked until performance.now() >= target_ms. 
 * 
 * This protects against a weakness in basic setTimeout, which may
 * occationally invoke the callback too early. 
 * 
 * schedule timeout 1 ms late, to reduce the likelihood of 
 * having to reschedule a timeout 
 */
function set_timeout (callback, delta_ms) {
    let ts = performance.now();
    delta_ms = Math.max(delta_ms, 0);
    let target_ms = ts + delta_ms;
    let tid;
    function cancel_timeout() {
        clearTimeout(tid);
    }
    function handle_timeout() {
        const delta_ms = target_ms - performance.now();
        if (delta_ms > 0) {
            // reschedule timeout
            tid = setTimeout(handle_timeout, delta_ms + 1);
        } else {
            callback();
        }
    }
    tid = setTimeout(handle_timeout, delta_ms + 1);
    return {cancel:cancel_timeout};
}

/**
 *  Implements deterministic projection based on initial conditions 
 *  - motion vector describes motion under constant acceleration
 *
 *  motion transition 
 * 
 *  transition from time domain to position under constant acceleration is given by
 *  given initial vector [p0,v0,a0,t0]
 *  p(t) = p0 + v0*(t-t0) + 0.5*a0*(t-t0)*(t-t0)
 *  v(t) = v0 + a0*(t-t0)
 *  a(t) = a0
 *  t(t) = t
 */
function motion_calculate(vector,t) {
    const [p0,v0,a0,t0] = vector;
    const d = t - t0;
    const p = p0 + v0*d + 0.5*a0*Math.pow(d,2);
    const v = v0 + a0*d;
    const a = a0;
    return [p,v,a,t];
}

/**
 * Given motion determined from [p0,v0,a0,t0].
 * Given equation p(t) = p0 + v0*(t-t0) + 0.5*a0*(t-t0)^2 == p1
 * Calculate if equation has solutions for some real number t.
 * A solution exists if determinant of quadratic equation is non-negative
 * (v0^2 - 2a0(p0-p1)) >= 0
 */
function motion_has_real_solutions(vector, p1) {
    const [p0,v0,a0,t0] = vector;
    return (Math.pow(v0,2) - 2*a0*(p0-p1)) >= 0.0
}
/**
 * Given motion determined from [p0,v0,a0,t0].
 * Given equation p(t) = p0 + v0*(t-t0) + 0.5*a0*(t-t0)^2 == p1
 * Calculate and return real solutions, in ascending order.
*/  
function motion_get_real_solutions (vector, p1) {
    const [p0,v0,a0,t0] = vector;
    // Constant Position
    if (a0 === 0.0 && v0 === 0.0) {
        if (p0 != p1) return [];
        else {
            // any t is a solution
            // NOTE: has real solutions is true
            return undefined;
        }    }
    // Constant non-zero Velocity
    if (a0 === 0.0) return [t0 + (p1-p0)/v0];
    // Constant Acceleration
    if (motion_has_real_solutions(vector, p1) === false) return [];
    // Exactly on solution
    var discriminant = Math.pow(v0,2) - 2*a0*(p0-p1);
    if (discriminant === 0.0) {
        return [t0-v0/a0];
    }
    var sqrt = Math.sqrt(Math.pow(v0,2) - 2*a0*(p0-p1));
    var d1 = t0 + (-v0 + sqrt)/a0;
    var d2 = t0 + (-v0 - sqrt)/a0;
    return [Math.min(d1,d2),Math.max(d1,d2)];
}
/*
    calculate time range for given position range

    motion transition from time to position is given by
    p(t) = p0 + v*t + 0.5*a*t*t
    find solutions for t so that 
    p(t) = pos

    do this for both values in range [low,high]
    accumulate all candidate solutions t in ascending order
    avoid duplicates
    this can accumulate 0,1,2,3,4 solution
    if 0 solutions - undefined (motion does not intersect with range ever) 
    if 1 solutions - udefined (motion only intersects with range tangentially at one t)
    if 2 solutions - [0,1] (motion intersects with range at two times)
    if 3 solutions - [0,2] (motion intersects with range at three times)
    if 4 solutions - [0,1] and [2,3]

    returns a list of range candidates (at most two but only with acceleration)
*/
function motion_calculate_time_ranges(vector, pos_range) {
    const [p0,v0,a0,t0] = vector;
    let [low, high] = pos_range;
    if (low == null) low = -Infinity;
    if (high == null) high = Infinity;

    // [<-, ->]
    if (low == -Infinity && high == Infinity) {
        // no pos range == entire value space => time range entire timeline
        return [[null, null]];
    } 

    // [FLAT LINE]
    // pos is either within pos range for all t or never  
    if (v0 === 0.0 && a0 === 0.0) {
        // both low and high bound
        return (p0 >= low && p0 <= high) ? [[null, null]] : [];
    }

    // aggregate solutions
    let solutions = [];
    if (-Infinity < low) {
        solutions.push(...motion_get_real_solutions(vector, low));
    } 
    if (high < Infinity) {
        solutions.push(...motion_get_real_solutions(vector, high));
    }
    // remove duplicates
    solutions = [...new Set(solutions)];
    // sort in ascending order
    solutions.sort((a,b) => a-b);

    // [<-, HIGH]
    if (low == -Infinity) {
        // only high bound
        if (solutions.length == 0) {
            // parabola not touching low
            // pos < high or pos > high for all t - just test with t0
            return (p0 <= high) ? [[null, null]] : [];
        }
        else if (solutions.length == 1) {
            if (a0 > 0.0) {
                // parabola - touching high from overside
                // pos > high for all t
                return [];
            } else if (a0 < 0.0) {
                // parabola touching low from underside
                // pos < high for all t
                return [[null, null]];
            } else {
                // a0 == 0.0 > straigth line
                if (v0 > 0.0) {
                    // pos <= high for all t <= solutions[0]
                    return [[null, solutions[0]]];
                } else {
                    // pos <= high for t >= solutions[0]
                    return [[solutions[0], null]];
                }
            }
        } else if (solutions.length == 2) {
            // parabola
            if (a0 > 0.0) {
                // one time range between solutions
                return [[solutions[0], solutions[1]]];
            } else if (a0 < 0.0) {
                // one time range on each side 
                return [[null, solutions[0]], [solutions[1], null]];
            }
        }


    // [LOW, ->]
    } else if (high == Infinity) {
        // only low bound
        if (solutions.length == 0) {
            // parabola not touching low
            // pos > low or pos < low for all t - just test with t0
            return (p0 >= low) ? [[null, null]] : [];
        }
        else if (solutions.length == 1) {
            if (a0 > 0.0) {
                // parabola - touching low from overside
                // pos > low for all t
                return [[null, null]];
            } else if (a0 < 0.0) {
                // parabola touching low from underside
                // pos < low for all t
                return [];
            } else {
                // a0 == 0.0 > straigth line
                if (v0 > 0.0) {
                    // pos >= low for all t >= solutions[0]
                    return [[solutions[0], null]];
                } else {
                    // pos >= low for t <= solutions[0]
                    return [[null, solutions[0]]];
                }
            }
        } else if (solutions.length == 2) {
            // parabola
            if (a0 > 0.0) {
                // one time range on each side 
                return [[null, solutions[0]], [solutions[1], null]];
            } else if (a0 < 0.0) {
                // one time range between solutions
                return [[solutions[0], solutions[1]]];
            }
        }

    // [LOW, HIGH]
    } else {
        // both low and high bound
        if (solutions.length == 0) return [];
        if (solutions.length == 1) return [];
        if (solutions.length == 2) return [[solutions[0], solutions[1]]];
        if (solutions.length == 3) return [[solutions[0], solutions[2]]];
        if (solutions.length == 4) return [[solutions[0], solutions[1]], [solutions[2], solutions[3]]];
    }
}

function motion_check_range(obj) {
    if (Array.isArray(obj) && obj.length != 2) {
        throw new Error(`range must have two elements ${obj}`);
    }
    obj[0] == null || check_number("low", obj[0]);
    obj[1] == null || check_number("high", obj[1]);
}

const motion_utils = {
    calculate: motion_calculate,
    has_real_solutions: motion_has_real_solutions,
    get_real_solutions: motion_get_real_solutions,
    calculate_time_ranges: motion_calculate_time_ranges,
    check_range: motion_check_range
};

/************************************************
 * LAYER
 ************************************************/

/**
 * Layer is abstract base class for Layers
 * 
 * Layer interface is defined by (index, CacheClass, options)
 * 
 * CacheClass
 * ----------
 * The CacheClass implements the query operation for the layer, using
 * the index for lookups on cache miss. Layer has a private cache. 
 * Additionally, if layer has multiple consumers, they can each 
 * create their own private cache. 
 * 
 * options
 * -------
 * The the result from the query operation can be controlled by supplying
 * optional custom function, either valueFunc or a stateFunc 
 * {valueFunc,stateFunc}
 * 
 * index
 * -----
 * The nearby index is supplied by Layer implementations, either by 
 * subclassing it, or by assigning the index. 
 */

class Layer {

    constructor(options={}) {

        const {
            CacheClass=LayerCache, 
            valueFunc=undefined,
            stateFunc=undefined,
        } = options; 

        // callbacks
        addState$1(this);
        // define change event
        eventifyInstance(this);
        this.eventifyDefine("change", {init:false});

        // index
        this.index;

        // cache
        this._CacheClass = CacheClass;
        this._private_cache;
        this._consumer_caches = [];

        // properties
        this._valueFunc = valueFunc;
        this._stateFunc = stateFunc;
    }

    // restrictions (defaults)
    get numeric () {return false;}
    get mutable () {return false;}
    get itemsOnly () {return false;}

    // query options
    get valueFunc () {return this._valueFunc;}
    get stateFunc () {return this._stateFunc;}

    // private cache
    get cache () {
        if (this._private_cache == undefined) {
            this._private_cache = new this._CacheClass(this);
        }
        return this._private_cache;
    }

    // invoked by layer consumer
    query(offset) {
        return this.cache.query(offset);
    }

    // invoked by layer consumer
    createCache () {
        const cache = new this._CacheClass(this);
        this._consumer_caches.push(cache);
        return cache;
    }
    releaseCache (cache) {
        const idx = this._consumer_caches.indexOf(cache);
        if (idx > -1) {
            this._consumer_caches.splice(idx, 1);
        }
    }
    clearCaches() {
        for (const cache of this._consumer_caches){
            cache.clear();
        }
        if (this._private_cache != undefined) {
            this._private_cache.clear();
        }
    }

    // invoked by subclass whenever layer has changed
    onchange() {
        this.clearCaches();
        this.notify_callbacks();
        this.eventifyTrigger("change");    
    }

    // iterator for regions of the layer index
    regions (options) {
        return this.index.regions(options);
    }

    /*
        Sample layer values by timeline offset increments
        return list of tuples [value, offset]
        options
        - start
        - stop
        - step

        TODO - this should be an iterator
    */
    sample(options={}) {
        if (this.index.empty()) {
            return [];
        }
        let {start, stop, step=1} = options;
        
        if (start == undefined) {
            // check if index.first is a number
            const first = this.index.first();
            if (first[0] != null) {
                start = first[0];
            } else {
                throw new Error("undefined start");
            }    
        }
        if (stop == undefined) {
            // check if index.last is a number
            const last = this.index.last();
            if (last[0] != null) {
                stop = last[0];
            } else {
                throw new Error("undefined stop");
            }
        }
        if (start > stop) {
            throw new Error ("stop must be larger than start", start, stop)
        }
        const cache = this.createCache();
        const samples = range(start, stop, step, {include_end:true})
            .map((offset) => {
                return [cache.query(offset).value, offset];
            });
        this.releaseCache(cache);
        return samples;
    }
}
addMethods$1(Layer.prototype);
eventifyPrototype(Layer.prototype);


/************************************************
 * LAYER CACHE
 ************************************************/

/**
 * Layer Cache is the regular cache type, intended for
 * _derived_ Layers - that is a layers which index references
 * other source layers.
 * 
 * A query is resolved by identifying the relevant region in
 * the nearby index (index.nearby(offset)), and then querying 
 * the state of all the objects found in the region (nearby.center).
 *  
 * Options {valueFunc or stateFunc} are used to compute a 
 * single query result from the list of states.
 * 
 * The result state is only cached if it is static.
 * Cache miss is triggered if no state has been cached, or if 
 * offset is outside the region of the cached state.
 * 
 */

class LayerCache {

    constructor(layer) {
        // cache belongs to layer
        this._layer = layer;
        // cached nearby state
        this._nearby;
        // cached state
        this._state;
        // query options
        this._query_options = {
            valueFunc: this._layer.valueFunc,
            stateFunc: this._layer.stateFunc,
            numberOnly: this._layer.isNumberOnly,
        };
    }

    get layer() {return this._layer};

    /**
     * query cache
     */
    query(offset) {
        const need_index_lookup = (
            this._nearby == undefined ||
            !interval.covers_endpoint(this._nearby.itv, offset)
        );
        if (
            !need_index_lookup && 
            this._state != undefined &&
            !this._state.dynamic
        ) {
            // cache hit
            return {...this._state, offset};
        }
        // cache miss
        if (need_index_lookup) {
            this._nearby = this._layer.index.nearby(offset);
        }
        // perform queries
        const states = this._nearby.center.map((cache) => {
            return cache.query(offset);
        });
        // calculate single result state
        const state = toState(this._nearby.center, states, offset, this._query_options);
        // cache state only if not dynamic
        this._state = (state.dynamic) ? undefined : state;
        return state    
    }

    clear() {
        this._nearby = undefined;
        this._state = undefined;
    }
}

/**
 * polling a callback function periodically with 
 * a fixed delay (ms).
 * If delay is 0, use requestAnimationFrame,
 * else use setTimeout.
 * Delay can be set dynamically. Pause and resume
 * is needed for new delay to take effect.
 */

class Poller {

    constructor(callback) {
        this._callback = callback;
        this._handle;
        this._delay;
    }
    
    set delay (delay_ms) {
        if (typeof delay_ms != "number") {
            throw new Error(`delay must be a number ${delay_ms}`);
        }
        if (this._delay != delay_ms) {   
            this._delay = delay_ms;
        }
    }
    get delay () {return this._delay;}

    is_polling () {
        return this._handle != undefined;
    }

    pause() {
        if (this._handle != undefined) {
            this._handle.cancel();
            this._handle = undefined;
        }
    }

    poll() {
        // poll callback
        this._callback();
        // schedule next poll
        this.pause();
        this.resume();
    }

    resume() {
        if (this._handle == undefined) {
            if (this._delay == 0) {
                // framerate
                const aid = requestAnimationFrame(this.poll.bind(this));
                this._handle = {cancel: () => cancelAnimationFrame(aid)};
            } else {
                // timeout
                const tid = setTimeout(this.poll.bind(this), this._delay);
                this._handle = {cancel: () => clearTimeout(tid)};
            }
        }
    }
}

/**
 * Cursor Monitor
 */

class CursorMonitor {
    constructor() {
        /*
            set of bindings
            poll cursor (when dynamic) periodically with given (minimum) delay, and invoke callback with cursor state 
            binding : {cursor, callback, delay_ms}
            - cursor:
            - callback: function(state)
            - delay: (ms) between samples (when variable is dynamic)
            there can be multiple bindings for the same cursor
        */
        this._binding_set = new Set();

        /*
            cursors
            map: cursor -> {sub, polling, bindings:[]}
        */
        this._cursor_map = new Map();

        // Poller
        this._poller = new Poller(this.onpoll.bind(this));
    }

    bind(cursor, callback, delay) {
        // check delay
        if (delay == undefined) {
            delay = 0;
        } else if (typeof delay != "number") {
            throw new Error(`delay must be a number ${delay}`);
        }
        // register binding
        let binding = {cursor, callback, delay};
        this._binding_set.add(binding);
        // register cursor
        if (!this._cursor_map.has(cursor)) { 
            let sub = cursor.on("change", this.oncursorchange.bind(this));
            this._cursor_map.set(cursor, {
                sub, polling: false, bindings: [binding]
            });
        } else {
            this._cursor_map.get(cursor).bindings.push(binding);
        }
        return binding;
    }

    release (binding) {
        // unregister binding
        const removed = this._binding_set.delete(binding);
        if (!removed) return;
        // cleanup
        const cursor = binding.cursor;
        const {sub, bindings} = this._cursor_map.get(cursor);
        // remove binding
        const idx = bindings.indexOf(binding);
        if (idx >= 0) {
            bindings.splice(idx, 1);
        }
        if (bindings.length == 0) {
            // no more bindings
            cursor.off(sub);
            this._cursor_map.delete(cursor);
        }
    }

    /**
     * a cursor has changed
     * forward change event to all callbacks for this cursor.
     * and reevaluate polling status, pausing or resuming
     * polling if needed.
     */
    oncursorchange(eArg, eInfo) {
        const cursor = eInfo.src;
        const state = eArg;
        // reevaluate polling status
        this._cursor_map.get(cursor).polling = state.dynamic;
        // find cursors which need polling
        const polling_cursors = [...this._cursor_map.values()]
            .filter(entry => entry.polling);
        this.reevaluate_polling(polling_cursors);
        // forward change event to all for this cursor callbacks
        const {bindings} = this._cursor_map.get(cursor);
        for (const binding of bindings) {
            binding.callback(state);
        }
    }

    onpoll() {
        const ts = local_clock.now();
        // poll all cursors with need of polling
        for (const [cursor, entry] of this._cursor_map) {
            if (entry.polling) {
                const state = cursor.query(ts);
                // forward polled state to all callbacks for this cursor
                for (const binding of entry.bindings) {
                    binding.callback(state);
                }
            }
        }
    }

    reevaluate_polling(polling_cursors) {
        if (polling_cursors.length == 0) {
            this._poller.pause();
        } else {
            // find minimum delay
            const delays = [];
            for (const entry of polling_cursors) {
                for (const binding of entry.bindings) {
                    delays.push(binding.delay);
                }
            }            const min_delay = Math.min(...delays);
            this._poller.delay = min_delay;
            this._poller.pause();
            this._poller.resume();
        }
    }
}


/*********************************************************************
    BIND RELEASE
*********************************************************************/

// monitor singleton
const monitor = new CursorMonitor();

function bind(cursor, callback, delay) {
    return monitor.bind(cursor, callback, delay);
}
function release(binding) {
    return monitor.release(binding);
}

/************************************************
 * CURSOR
 ************************************************/  

/**
 * Abstract base class for Cursor interface
 */

class Cursor {
    
    constructor() {
        // callbacks
        addState$1(this);
        // define change event
        eventifyInstance(this);
        this.eventifyDefine("change", {init:true});
    }

    // restriction defaults
    get mutable () {return false;}
    get numeric () {return false;};
    get itemsOnly () {return false;}
    get fixedRate () {return false}

    /**********************************************************
     * QUERY API
     **********************************************************/

    query(local_ts) {
        throw new Error("query() not implemented");
    }
    get value () {return this.query().value};
    get () {return this.query().value;}

    /**
     * Eventify: immediate events
     */
    eventifyInitEventArgs(name) {
        if (name == "change") {
            return [this.query()];
        }
    }
    
    /**********************************************************
     * BIND RELEASE (convenience)
     **********************************************************/

    /**
     * alternative to listening to the change event
     * bind subscribes to the change event, but also automatically
     * turns listening on and off when as the cursor switches
     * between dynamic and non-dynamic behavior.
     */

    bind(callback, delay, options={}) {
        return bind(this, callback, delay);
    }
    release(handle) {
        return release(handle);
    }

    /**********************************************************
     * CHANGE NOTIFICATION
     **********************************************************/

    /**
     * invoked by cursor implementation to signal change in cursor
     * behavior.
     */
    onchange() {
        this.notify_callbacks();
        this.eventifyTrigger("change", this.query());
        this.detect_future_event();
    }

    /**
     * override by cursor implementation in order to detect
     * and trigger future change events - which are not triggered
     * by state changes - but caused by time progression
     * or playback. This function is invoked after each 
     * onchange() event.
     */
    detect_future_event() {}
}
addMethods$1(Cursor.prototype);
eventifyPrototype(Cursor.prototype);

/**
 * CLOCK PROVIDER
 * 
 * A ClockProvider can be created in two ways
 * - either by supplying a clock object
 * - or by supplying a vector 
 * 
 * A *clock* is an object that has a now() method which returns the current time.
 * A clock is expected to return a timestamp in seconds, monitonically increasing 
 * at rate 1.0 sec/sec. 
 * 
 * A *vector* initializes a determistic clock based on the official *local_clock*. 
 * - ts (sec) - timestamp from official *local_clock*
 * - value (sec) - value of clock at time ts
 * - rate (sec/sec) - rate of clock (default 1.0)
 * Clock Provider uses official *local clock* (performace.now()/1000.0)
 * The official clock is exported by the statelayers framework, so application
 * code can use it to create an initial timestamps. If ommitted, clock
 * provider creates the timestamp - thereby assuming that the provided value was 
 * sampled immediately before.
 * 
 * 
 * The key difference between *clock* and *vector* is that the clock object can drift 
 * relative to the official *local_clock*, while the vector object is forever locked to
 * the official *local_clock*.
 *   
 */

function is_clock(obj) {
    if (!("now" in obj)) return false;
    if (typeof obj.now != "function") return false;
    return true;
}

class ClockProvider {

    constructor (options={}) {
        const {clock, vector=LOCAL_CLOCK_VECTOR} = options;

        if (clock !== undefined && is_clock(clock)) {
            this._clock = {
                now: (local_ts) => {
                    // if local_ts is defined it defines a timestamp for
                    // evaluation of the clock - which is not necessarily the same
                    // as now - back-date clock accordingly
                    const diff_ts = (local_ts != undefined) ? local_clock.now() - local_ts : 0;
                    return clock.now() - diff_ts;
                }
            };    
            this._rate = 1.0;
        } else {
            let {ts, value, rate=1.0} = vector;
            if (ts == undefined) {
                ts = local_clock.now();
            }
            check_number("ts", ts);
            check_number("value", value);
            check_number("rate", rate);
            this._t0 = ts;
            this._value = value;
            this._rate = rate;
            this._clock = {
                now: (local_ts = local_clock.now()) => {
                    return this._value + (local_ts - this._t0)*this._rate;
                }
            };
        }
    }

    now () {
        return this._clock.now();
    }

    get rate() {return this._rate;}
}


// default clock provider    
const LOCAL_CLOCK_VECTOR = {
    ts: local_clock.now(),
    value: new Date()/1000.0, 
    rate: 1.0
};
const LOCAL_CLOCK_PROVIDER = new ClockProvider({vector:LOCAL_CLOCK_VECTOR});

const clock_provider = (options={}) => {

    const {clock, vector} = options;
    if (clock == undefined && vector == undefined) {
        return LOCAL_CLOCK_PROVIDER;
    }
    return new ClockProvider(options); 
};

/**
 * collection providers must provide get_all function
 * and also implement callback interface
 */
function is_collection_provider(obj) {
    if (!is_callback_api(obj)) return false;
    if (!("get" in obj)) return false;
    if (typeof obj.get != 'function') return false;
    if (!("update" in obj)) return false;
    if (typeof obj.update != 'function') return false;
    return true;
}


/***************************************************************
    COLLECTION PROVIDER
***************************************************************/

/**
 * local collection provider
 * 
 * 
 * changes = {
 *   remove=[],
 *   insert=[],
 *   reset=false 
 * }
 * 
*/

class CollectionProvider {

    constructor(options={}) {
        addState$1(this);
        this._map = new Map();
        // initialize
        let {items} = options;
        if (items != undefined) {
            for (const item of items) {
                this._map.set(item.id, item);
            }
        }
    }

    /**
     * Local stateproviders decouple update request from
     * update processing, and returns Promise.
     */
    update (changes) {
        changes.insert = check_items(changes.insert);
        return Promise.resolve()
        .then(() => {
            let diffs;
            if (changes != undefined) {
                diffs = this._update(changes);
                this.notify_callbacks(diffs);
            }
            return diffs;
        });
    }

    _update(changes) {
        const diff_map = new Map();
        let {
            insert=[],
            remove=[],
            reset=false
        } = changes;


        if (reset) {
            for (const [id, item] of this._map.entries()) {
                diff_map.set(id, {id, new:undefined, old:item});
            }
            // clear all items
            this._map = new Map();
        } else {
            // remove items by id
            for (const id of remove) {
                let item = this._map.get(id);
                if (item != undefined) {
                    diff_map.set(item.id, {
                        id:item.id, new:undefined, old:item
                    });
                    this._map.delete(id);
                }
            }
        }
        // insert items
        for (let item of insert) {
            const diff = diff_map.get(item.id);
            const old = (diff != undefined) ? diff.old : this._map.get(item.id);
            diff_map.set(item.id, {id:item.id, new:item, old});
            this._map.set(item.id, item);
        }
        return [...diff_map.values()];
    }

    get() {
        return [...this._map.values()];
    };
}
addMethods$1(CollectionProvider.prototype);

/**
 * object providers implement get() and set() methods
 * and the callback interface
 */
function is_object_provider(obj) {
    if (!is_callback_api(obj)) return false;
    if (!("get" in obj)) return false;
    if (typeof obj.get != 'function') return false;
    if (!("set" in obj)) return false;
    if (typeof obj.set != 'function') return false;
    return true;
}

/***************************************************************
    OBJECT PROVIDER
***************************************************************/

/**
 * ObjectProvider stores an object or undefined.
 */

class ObjectProvider {

    constructor(options={}) {
        const {items} = options;
        addState$1(this);
        this._object = items;
    }

    set (items) {
        items = check_items(items);
        return Promise.resolve()
            .then(() => {
                this._object = items;
                this.notify_callbacks();
            });
    }

    get () {
        return this._object;
    }
}
addMethods$1(ObjectProvider.prototype);

/************************************************
 * SOURCE PROPERTY (SRCPROP)
 ************************************************/

/**
 * Functions for extending a class with support for 
 * external source on a named property.
 * 
 * option: mutable:true means that propery may be reset 
 * 
 * source object is assumed to support the callback interface,
 * or be a list of objects all supporting the callback interface
 */

const NAME = "srcprop";
const PREFIX = `__${NAME}`;

function addState (object) {
    object[`${PREFIX}`] = new Map();
}

function addMethods (object) {

    function register(propName, options={}) {
        let {mutable=true} = options;
        const map = this[`${PREFIX}`]; 
        map.set(propName, {
            init:false,
            mutable,
            entity: undefined,
            handles: []
        });

        // register getters and setters
        Object.defineProperty(this, propName, {
            get: function () {
                return map.get(propName).entity;
            },
            set: function (entity) {
                if (this[`${NAME}_check`]) {
                    entity = this[`${NAME}_check`](propName, entity);
                }
                if (entity != map.get(propName).entity) {
                    this[`${PREFIX}_attach`](propName, entity);
                }
            }
        });
    }

    function attatch(propName, entity) {

        const map = this[`${PREFIX}`];
        const state = map.get(propName);

        if (state.init && !state.mutable) {
            throw new Error(`${propName} can not be reassigned`);
        }

        const entities = (Array.isArray(entity)) ? entity : [entity];

        // unsubscribe from entities
        if (state.handles.length > 0) {
            for (const [idx, e] of Object.entries(entities)) {
                if (is_callback_api(e)) {
                    e.remove_callback(state.handles[idx]);
                }
            }    
        }
        state.handles = [];

        // attatch new entity
        state.entity = entity;
        state.init = true;

        // subscribe to callback from source
        if (this[`${NAME}_onchange`]) {
            const handler = function (eArg) {
                this[`${NAME}_onchange`](propName, eArg);
            }.bind(this);
            for (const e of entities) {
                if (is_callback_api(e)) {
                    state.handles.push(e.add_callback(handler));
                }
            }
            this[`${NAME}_onchange`](propName, "reset"); 
        }
    }

    const api = {};
    api[`${NAME}_register`] = register;
    api[`${PREFIX}_attach`] = attatch;
    Object.assign(object, api);
}

/*********************************************************************
	SORTED ARRAY
*********************************************************************/

/*
	Sorted array of endpoints [value, type].
	- Elements are sorted in ascending order.
	- No duplicates are allowed.
	- Binary search used for lookup

	values can be regular number values (float) or endpoints [float, type]
*/

class SortedArray {

	constructor(){
		this._array = [];
	}

	get size() {return this._array.length;}
	get array() {return this._array;}

	/*
		find index of given value

		return [found, index]

		if found is true, then index is the index of the found object
		if found is false, then index is the index where the object should
		be inserted

		- uses binary search		
		- array does not include any duplicate values
	*/
	indexOf(target_value) {
		const target_ep = endpoint.from_input(target_value);
		let left_idx = 0;
		let right_idx = this._array.length - 1;
		while (left_idx <= right_idx) {
			const mid_idx = Math.floor((left_idx + right_idx) / 2);
			let mid_value = this._array[mid_idx];
			if (endpoint.eq(mid_value, target_ep)) {
				return [true, mid_idx]; // Target already exists in the array
			} else if (endpoint.lt(mid_value, target_ep)) {
				  left_idx = mid_idx + 1; // Move search range to the right
			} else {
				  right_idx = mid_idx - 1; // Move search range to the left
			}
		}
	  	return [false, left_idx]; // Return the index where target should be inserted
	}

	/*
		find index of smallest value which is greater than or equal to target value
		returns -1 if no such value exists
	*/
	geIndexOf(target_value) {
		let [found, idx] = this.indexOf(target_value);
		return (idx < this._array.length) ? idx : -1  
	}

	/*
		find index of largest value which is less than or equal to target value
		returns -1 if no such value exists
	*/
	leIndexOf(target_value) {
		let [found, idx] = this.indexOf(target_value);
		idx = (found) ? idx : idx-1;
		return (idx >= 0) ? idx : -1;
	}

	/*
		find index of smallest value which is greater than target value
		returns -1 if no such value exists
	*/
	gtIndexOf(target_value) {
		let [found, idx] = this.indexOf(target_value);
		idx = (found) ? idx + 1 : idx;
		return (idx < this._array.length) ? idx : -1  
	}

	/*
		find index of largest value which is less than target value
		returns -1 if no such value exists
	*/
	ltIndexOf(target_value) {
		let [found, idx] = this.indexOf(target_value);
		idx = idx-1;
		return (idx >= 0) ? idx : -1;	
	}

	/*
		UPDATE

		approach - make all neccessary changes and then sort

		as a rule of thumb - compared to removing and inserting elements
		one by one, this is more effective for larger batches, say > 100.
		Even though this might not be the common case, penalties for
		choosing the wrong approach is higher for larger batches.

		remove is processed first, so if a value appears in both 
		remove and insert, it will remain.
		undefined values can not be inserted 

	*/

	update(remove_list=[], insert_list=[]) {

		/*
			remove

			remove by flagging elements as undefined
			- collect all indexes first
			- flag as undefined only after all indexes have been found,
			  as inserting undefined values breakes the assumption that
			  the array is sorted.
			- later sort will move them to the end, where they can be
			  truncated off
		*/
		let remove_idx_list = [];
		for (let value of remove_list) {
			let [found, idx] = this.indexOf(value);
			if (found) {
				remove_idx_list.push(idx);
			}		
		}
		for (let idx of remove_idx_list) {
			this._array[idx] = undefined;
		}
		let any_removes = remove_idx_list.length > 0;

		/*
			insert

			insert might introduce duplications, either because
			the insert list includes duplicates, or because the
			insert list duplicates preexisting values.

			Instead of looking up and checking each insert value,
			we instead insert everything at the end of the array,
			and remove duplicates only after we have sorted.
		*/
		let any_inserts = insert_list.length > 0;
		if (any_inserts) {
			concat_in_place(this._array, insert_list);
		}

		/*
			sort
			this pushes any undefined values to the end 
		*/
		if (any_removes || any_inserts) {
			this._array.sort(endpoint.cmp);
		}

		/*
			remove undefined 
			all undefined values are pushed to the end
		*/
		if (any_removes) {
			this._array.length -= remove_idx_list.length;
		}

		/*
			remove duplicates from sorted array
			- assuming there are going to be few duplicates,
			  it is ok to remove them one by one

		*/
		if (any_inserts) {
			remove_duplicates(this._array);
		}
	}

	/*
		get element by index
	*/
	get_by_index(idx) {
		if (idx > -1 && idx < this._array.length) {
			return this._array[idx];
		}
	}

	/*
		lookup values within interval
	*/
	lookup(itv) {
		if (itv == undefined) {
			itv = [null, null, true, true];
		}
		let [ep_0, ep_1] = endpoint.from_interval(itv);
		let idx_0 = this.geIndexOf(ep_0);
		let idx_1 = this.leIndexOf(ep_1);
		if (idx_0 == -1 || idx_1 == -1) {
			return [];
		} else {
			return this._array.slice(idx_0, idx_1+1);
		}
	}

	lt (offset) {
		return this.get_by_index(this.ltIndexOf(offset));
	}
	le (offset) {
		return this.get_by_index(this.leIndexOf(offset));
	}
	get (offset) {
		let [found, idx] = this.indexOf(offset);
		if (found) {
			return this._array[idx];
		} 
	}
	gt (offset) {
		return this.get_by_index(this.gtIndexOf(offset));
	}
	ge (offset) {
		return this.get_by_index(this.geIndexOf(offset));
	}
}


/*********************************************************************
	UTILS
*********************************************************************/

/*
	Concatinate two arrays by appending the second array to the first array. 
*/

function concat_in_place(first_arr, second_arr) {
	const first_arr_length = first_arr.length;
	const second_arr_length = second_arr.length;
  	first_arr.length += second_arr_length;
  	for (let i = 0; i < second_arr_length; i++) {
    	first_arr[first_arr_length + i] = second_arr[i];
  	}
}

/*
	remove duplicates in a sorted array
*/
function remove_duplicates(sorted_arr) {
	let i = 0;
	while (true) {
		if (i + 1 >= sorted_arr.length) {
			break;
		}
		if (endpoint.eq(sorted_arr[i], sorted_arr[i + 1])) {
			sorted_arr.splice(i + 1, 1);
		} else {
			i += 1;
		}
	}
}

const {LOW_CLOSED, LOW_OPEN, HIGH_CLOSED, HIGH_OPEN} = endpoint.types;
const EP_TYPES = [LOW_CLOSED, LOW_OPEN, HIGH_CLOSED, HIGH_OPEN];


// Set of unique [v, t] endpoints
class EndpointSet {
	constructor() {
		this._map = new Map([
			[LOW_CLOSED, new Set()],
			[LOW_OPEN, new Set()], 
			[HIGH_CLOSED, new Set()], 
			[HIGH_OPEN, new Set()]
		]);
	}
	add(ep) {
		const [value, type] = ep;
		return this._map.get(type).add(value);
	}
	has (ep) {
		const [value, type] = ep;
		return this._map.get(type).has(value);
	}
	get(ep) {
		const [value, type] = ep;
		return this._map.get(type).get(value);
	}

	list() {
		const lists = EP_TYPES.map((type) => {
			return [...this._map.get(type).values()]
				.map((value) => [value, type]);
		});
		return [].concat(...lists);
	}
}

/**
 * ITEMS MAP
 * 
 * map endpoint -> {
 * 	low: [items], 
 *  active: [items], 
 *  high:[items]
 * }
 * 
 * in order to use endpoint [v,t] as a map key we create a two level
 * map - using t as the first variable. 
 * 
 */


const LOW = "low";
const ACTIVE = "active";
const HIGH = "high";


class ItemsMap {

	constructor () {
		// map endpoint -> {low: [items], active: [items], high:[items]}
		this._map = new Map([
			[LOW_CLOSED, new Map()],
			[LOW_OPEN, new Map()], 
			[HIGH_CLOSED, new Map()], 
			[HIGH_OPEN, new Map()]
		]);
	}

	get_items_by_role (ep, role) {
		const [value, type] = ep;
		const entry = this._map.get(type).get(value);
		return (entry != undefined) ? entry[role] : [];
	}

	/*
		register item with endpoint (idempotent)
		return true if this was the first LOW or HIGH 
	 */
	register(ep, item, role) {
		const [value, type] = ep;
		const type_map = this._map.get(type);
		if (!type_map.has(value)) {
			type_map.set(value, {low: [], active:[], high:[]});
		}
		const entry = type_map.get(value);
		const was_empty = entry[LOW].length + entry[HIGH].length == 0;
		let idx = entry[role].findIndex((_item) => {
			return _item.id == item.id;
		});
		if (idx == -1) {
			entry[role].push(item);
		}
		const is_empty = entry[LOW].length + entry[HIGH].length == 0;
		return was_empty && !is_empty;
	}

	/*
		unregister item with endpoint (independent of role)
		return true if this removed last LOW or HIGH
	 */
	unregister(ep, item) {
		const [value, type] = ep;
		const type_map = this._map.get(type);
		const entry = type_map.get(value);
		if (entry != undefined) {
			const was_empty = entry[LOW].length + entry[HIGH].length == 0;
			// remove all mentiones of item
			for (const role of [LOW, ACTIVE, HIGH]) {
				let idx = entry[role].findIndex((_item) => {
					return _item.id == item.id;
				});
				if (idx > -1) {
					entry[role].splice(idx, 1);
				}	
			}
			const is_empty = entry[LOW].length + entry[HIGH].length == 0;
			if (!was_empty && is_empty) {
				// clean up entry
				type_map.delete(value);
				return true;
			}
		}
		return false;
	}
}


/**
 * NearbyIndex
 * 
 * NearbyIndex for CollectionProvider or VariableProvider
 */

class NearbyIndex extends NearbyIndexBase {

    constructor(stateProvider) {
        super();		

		if (
			!is_collection_provider(stateProvider) &&
			!is_object_provider(stateProvider)
		) {
			throw new Error(`stateProvider must be collectionProvider or variableProvider ${stateProvider}`);
        }
        this._sp = stateProvider;
		this._initialise();
		this.refresh();
	}

    get src () {return this._sp;}


	_initialise() {
		// register items with endpoints
		this._itemsmap = new ItemsMap();
		// sorted index
		this._endpoints = new SortedArray();
		// swipe index
		this._index = [];
	}


	refresh(diffs) {

		const remove_endpoints = new EndpointSet();
		const insert_endpoints = new EndpointSet();

		let insert_items = [];
		let remove_items = [];

		if (diffs == undefined) {
			insert_items = this.src.get() || [];
			// clear all state
			this._initialise();
		} else {
			// collect insert items and remove items
			for (const diff of diffs) {
				if (diff.new != undefined) {
					insert_items.push(diff.new);
				}
				if (diff.old != undefined) {
					remove_items.push(diff.old);
				}
			}
		}

		/*
			unregister remove items across all endpoints 
			where they were registered (LOW, ACTIVE, HIGH) 
		*/
		for (const item of remove_items) {			
			for (const ep of this._endpoints.lookup(item.itv)) {
				// TODO: check if this is correct
				const became_empty = this._itemsmap.unregister(ep, item);
				if (became_empty) remove_endpoints.add(ep);
			}	
		}

		/*
			register new items across all endpoints 
			where they should be registered (LOW, HIGH) 
		*/
		let became_nonempty;
		for (const item of insert_items) {
			const [low, high] = endpoint.from_interval(item.itv);
			became_nonempty = this._itemsmap.register(low, item, LOW);
			if (became_nonempty) insert_endpoints.add(low);
			became_nonempty = this._itemsmap.register(high, item, HIGH);
			if (became_nonempty) insert_endpoints.add(high);
		}

		/*
			refresh sorted endpoints
			possible that an endpoint is present in both lists
			this is presumably not a problem with SortedArray.
		*/
		this._endpoints.update(
			remove_endpoints.list(), 
			insert_endpoints.list()
		);

		/*
			swipe over to ensure that all items are activate
		*/
		const activeSet = new Set();
		for (const ep of this._endpoints.array) {	
			// Add items with ep as low point
			for (let item of this._itemsmap.get_items_by_role(ep, LOW)) {
				activeSet.add(item);
			}			// activate using activeSet
			for (let item of activeSet) {
				this._itemsmap.register(ep, item, ACTIVE);
			}
			// Remove items with p1 as high point
			for (let item of this._itemsmap.get_items_by_role(ep, HIGH)) {
				activeSet.delete(item);
			}		}
	}

	_covers (offset) {
		const ep = endpoint.from_input(offset);
		const ep1 = this._endpoints.le(ep) || endpoint.NEG_INF;
		const ep2 = this._endpoints.ge(ep) || endpoint.POS_INF;
		if (endpoint.eq(ep1, ep2)) {
			return this._itemsmap.get_items_by_role(ep1, ACTIVE);	
		} else {
			// get items for both endpoints
			const items1 = this._itemsmap.get_items_by_role(ep1, ACTIVE);
			const items2 = this._itemsmap.get_items_by_role(ep2, ACTIVE);
			// return all items that are active in both endpoints
			const idSet = new Set(items1.map(item => item.id));
			return items2.filter(item => idSet.has(item.id));
		}
	}

    /*
		nearby (offset)
    */
	nearby(offset) {
		const ep = endpoint.from_input(offset);

		// center
		let center = this._covers(ep);
		const center_high_list = [];
		const center_low_list = [];
		for (const item of center) {
			const [low, high] = endpoint.from_interval(item.itv);
			center_high_list.push(high);
			center_low_list.push(low);    
		}

		// prev high
		let prev_high = ep;
		let items;
		while (true) {
			prev_high = this._endpoints.lt(prev_high) || endpoint.NEG_INF;
			if (prev_high[0] == null) {
				break
			}
			items = this._itemsmap.get_items_by_role(prev_high, HIGH);
			if (items.length > 0) {
				break
			}
		}

		// next low
		let next_low = ep;
		while (true) {
			next_low = this._endpoints.gt(next_low) || endpoint.POS_INF;
			if (next_low[0] == null) {
				break
			}
			items = this._itemsmap.get_items_by_role(next_low, LOW);
			if (items.length > 0) {
				break
			}
		}

		return nearby_from(
			prev_high, 
			center_low_list, 
			center,
			center_high_list,
			next_low
		);
	}
}

/********************************************************************
BASE SEGMENT
*********************************************************************/
/*
	Abstract Base Class for Segments

    constructor(interval)

    - interval: interval of validity of segment
    - dynamic: true if segment is dynamic
    - value(offset): value of segment at offset
    - query(offset): state of segment at offset
*/

class BaseSegment {

	constructor(itv) {
		this._itv = itv;
	}

	get itv() {return this._itv;}

    /** 
     * implemented by subclass
     * returns {value, dynamic};
    */
    state(offset) {
    	throw new Error("not implemented");
    }

    /**
     * convenience function returning the state of the segment
     * @param {*} offset 
     * @returns 
     */
    query(offset) {
        if (interval.covers_point(this._itv, offset)) {
            return {...this.state(offset), offset};
        } 
        return {value: undefined, dynamic:false, offset};
    }
}

/********************************************************************
    STATIC SEGMENT
*********************************************************************/

class StaticSegment extends BaseSegment {

	constructor(itv, data) {
        super(itv);
		this._value = data;
	}

	state() {
        return {value: this._value, dynamic:false}
	}
}


/********************************************************************
    MOTION SEGMENT
*********************************************************************/

class MotionSegment extends BaseSegment {
    
    constructor(itv, data) {
        super(itv);
        this._vector = data;
    }

    state(offset) {
        const [p,v,a,t] = motion_utils.calculate(this._vector, offset);
        return {
            value: p, dynamic: (v != 0 || a != 0 ),
            vector: [p, v, a, t],
        }
    }
}


/********************************************************************
    TRANSITION SEGMENT
*********************************************************************/

/*
    Supported easing functions
    "ease-in":
    "ease-out":
    "ease-in-out"
*/

function easein (ts) {
    return Math.pow(ts,2);  
}
function easeout (ts) {
    return 1 - easein(1 - ts);
}
function easeinout (ts) {
    if (ts < .5) {
        return easein(2 * ts) / 2;
    } else {
        return (2 - easein(2 * (1 - ts))) / 2;
    }
}

class TransitionSegment extends BaseSegment {

	constructor(itv, data) {
		super(itv);
        let {v0, v1, easing} = data;
        let [t0, t1] = this._itv.slice(0,2);

        // create the transition function
        this._dynamic = v1-v0 != 0;
        this._trans = function (ts) {
            // convert ts to [t0,t1]-space
            // - shift from [t0,t1]-space to [0,(t1-t0)]-space
            // - scale from [0,(t1-t0)]-space to [0,1]-space
            ts = ts - t0;
            ts = ts/parseFloat(t1-t0);
            // easing functions stretches or compresses the time scale 
            if (easing == "ease-in") {
                ts = easein(ts);
            } else if (easing == "ease-out") {
                ts = easeout(ts);
            } else if (easing == "ease-in-out") {
                ts = easeinout(ts);
            }
            // linear transition from v0 to v1, for time values [0,1]
            ts = Math.max(ts, 0);
            ts = Math.min(ts, 1);
            return v0 + (v1-v0)*ts;
        };
	}

	state(offset) {
        return {value: this._trans(offset), dynamic:this._dynamic}
	}
}



/********************************************************************
    INTERPOLATION SEGMENT
*********************************************************************/

/**
 * Function to create an interpolator for nearest neighbor interpolation with
 * extrapolation support.
 *
 * @param {Array} tuples - An array of [value, offset] pairs, where value is the
 * point's value and offset is the corresponding offset.
 * @returns {Function} - A function that takes an offset and returns the
 * interpolated or extrapolated value.
 */

function interpolate(tuples) {

    if (tuples.length < 1) {
        return function interpolator () {return undefined;}
    } else if (tuples.length == 1) {
        return function interpolator () {return tuples[0][0];}
    }

    // Sort the tuples by their offsets
    const sortedTuples = [...tuples].sort((a, b) => a[1] - b[1]);
  
    return function interpolator(offset) {
      // Handle extrapolation before the first point
      if (offset <= sortedTuples[0][1]) {
        const [value1, offset1] = sortedTuples[0];
        const [value2, offset2] = sortedTuples[1];
        return value1 + ((offset - offset1) * (value2 - value1) / (offset2 - offset1));
      }
      
      // Handle extrapolation after the last point
      if (offset >= sortedTuples[sortedTuples.length - 1][1]) {
        const [value1, offset1] = sortedTuples[sortedTuples.length - 2];
        const [value2, offset2] = sortedTuples[sortedTuples.length - 1];
        return value1 + ((offset - offset1) * (value2 - value1) / (offset2 - offset1));
      }
  
      // Find the nearest points to the left and right
      for (let i = 0; i < sortedTuples.length - 1; i++) {
        if (offset >= sortedTuples[i][1] && offset <= sortedTuples[i + 1][1]) {
          const [value1, offset1] = sortedTuples[i];
          const [value2, offset2] = sortedTuples[i + 1];
          // Linear interpolation formula: y = y1 + ( (x - x1) * (y2 - y1) / (x2 - x1) )
          return value1 + ((offset - offset1) * (value2 - value1) / (offset2 - offset1));
        }
      }
  
      // In case the offset does not fall within any range (should be covered by the previous conditions)
      return undefined;
    };
}
  

class InterpolationSegment extends BaseSegment {

    constructor(itv, tuples) {
        super(itv);
        // setup interpolation function
        this._trans = interpolate(tuples);
    }

    state(offset) {
        return {value: this._trans(offset), dynamic:true};
    }
}


/*********************************************************************
    LOAD SEGMENT
*********************************************************************/

function load_segment(itv, item) {
    let {type="static", data} = item;
    if (type == "static") {
        return new StaticSegment(itv, data);
    } else if (type == "transition") {
        return new TransitionSegment(itv, data);
    } else if (type == "interpolation") {
        return new InterpolationSegment(itv, data);
    } else if (type == "motion") {
        return new MotionSegment(itv, data);
    } else {
        console.log("unrecognized segment type", type);
    }
}

/*********************************************************************
    LEAF LAYER
*********************************************************************/

function leaf_layer(options={}) {
    const {
        provider,
        numeric=false, 
        mutable=true, 
        mask,
        ...opts} = options;

    const layer = new Layer({
        CacheClass:LeafLayerCache, 
        ...opts,
    });

    // restrictions
    Object.defineProperty(layer, "numeric", {get: () => numeric});
    Object.defineProperty(layer, "mutable", {get: () => mutable});
    Object.defineProperty(layer, "itemsOnly", {get: () => true});

    // numeric mask - replaces undefined for numeric layers
    if (mask != undefined) {
        check_number("mask", mask);
    }
    layer.mask = mask;

    // setup provider as property
    addState(layer);
    addMethods(layer);
    layer.srcprop_register("provider");
    layer.srcprop_check = function (propName, obj) {
        if (propName == "provider") {
            if (!(is_collection_provider(obj)) && !(is_object_provider(obj))) {
                throw new Error(`"obj" must collectionProvider or objectProvider ${obj}`);
            }
            return obj;    
        }
    };
    layer.srcprop_onchange = function (propName, eArg) {
        if (propName == "provider") {
            if (eArg == "reset") {
                if (is_collection_provider(layer.provider)) {
                    layer.index = new NearbyIndex(layer.provider);
                } else if (is_object_provider(layer.provider)) {
                    layer.index = new NearbyIndex(layer.provider);
                }
            } 
            if (layer.index != undefined) {
                if (is_collection_provider(layer.provider)) {
                    layer.index.refresh(eArg);
                } else if (is_object_provider(layer.provider)) {
                    layer.index.refresh();
                }
                layer.onchange();
            }
        }        
    };


    /**
     * convenience method for getting items valid at offset
     * only items layer supports this method
     */
    layer.get_items = function get_items(offset) {
        return [...layer.index.nearby(offset).center];
    };

    /******************************************************************
     * LAYER UPDATE API
     * ***************************************************************/

    if (!layer.readOnly) {
        layer.update = function update(changes) {
            return layer_update(layer, changes);
        };
        layer.append = function append(items, offset) {
            return layer_append(layer, items, offset);
        };    
    }
 
    // initialise
    layer.provider = provider;

    return layer;
}


/*********************************************************************
    LEAF LAYER CACHE
*********************************************************************/

/*
    LeafLayers have a CollectionProvider or a ObjectProvider as provider 
    and use a specific cache implementation, as objects in the 
    index are assumed to be items from the provider, not other layer objects. 
    Moreover, queries are not resolved directly on the items in the index, but
    rather from corresponding segment objects, instantiated from items.

    Caching here applies to nearby state and segment objects.
*/

class LeafLayerCache {
    constructor(layer) {
        // layer
        this._layer = layer;
        // cached nearby object
        this._nearby = undefined;
        // cached segment
        this._segment = undefined;
        // query options
        this._query_options = {
            valueFunc: this._layer.valueFunc,
            stateFunc: this._layer.stateFunc,
            numeric: this._layer.numeric,
            mask: this._layer.mask
        };
    }

    get src() {return this._layer};
    get segment() {return this._segment};

    query(offset) {
        const need_index_lookup = (
            this._nearby == undefined ||
            !interval.covers_endpoint(this._nearby.itv, offset)
        );
        if (need_index_lookup) {
            // cache miss
            this._nearby = this._layer.index.nearby(offset);
            let {itv, center} = this._nearby;
            this._segments = center.map((item) => {
                return load_segment(itv, item);
            });
        }
        // perform queries
        const states = this._segments.map((seg) => {
            return seg.query(offset);
        });
        // calculate single result state
        return toState(this._segments, states, offset, this._query_options);
    }

    clear() {
        this._nearby = undefined;
        this._segment = undefined;
    }
}




/*********************************************************************
    LAYER UPDATE
*********************************************************************/

/**
 * NOTE - layer update is essentially about stateProvider update.
 * so these methods could (for the most part) be moved to the provider.
 * However, update_append benefits from using the index of the layer,
 * so we keep it here for now. 
 */

/*
    Items Layer forwards update to stateProvider
*/
function layer_update(layer, changes={}) {

    changes.insert ??= [];

    // check number restriction
    // check that static items are restricted to numbers
    // other item types are restricted to numbers by default
    if (layer.isNumberOnly) {
        for (let item of changes.insert) {
            item.type ??= "static";
            if (item.type == "static" && !is_finite_number(item.data)) {
                throw new Error(`Layer is number only, but item ${item} is not a number`);
            }
        }
    }

    if (is_collection_provider(layer.provider)) {
        return layer.provider.update(changes);
    } else if (is_object_provider(layer.provider)) {     
        let {
            insert=[],
            remove=[],
            reset=false
        } = changes;
        if (reset) {
            return layer.provider.set(insert);
        } else {
            const map = new Map((layer.provider.get() || [])
                .map((item) => [item.id, item]));
            // remove
            remove.forEach((id) => map.delete(id));
            // insert
            insert.forEach((item) => map.set(item.id, item));
            // set
            const items = Array.from(map.values());
            return layer.provider.set(items);
        }
    }
}
    

/*********************************************************************
    LAYER APPEND
*********************************************************************/

/**
 * append items to layer at offset
 * 
 * append implies that pre-existing items beyond offset,
 * will either be removed or truncated, so that the layer
 * is empty after offset.
 * 
 * items will only be inserted after offset, so any new
 * item before offset will be truncated or dropped.
 * 
 * new items will only be be applied for t >= offset
 * old items will be kept for t < offset
 * 
 * 
 */
function layer_append(layer, items, offset) {
    const ep = endpoint.from_input(offset);
    
    // truncate or remove new items before offset
    const insert_items = items
        .filter((item) => {
            // keep only items with itv.high >= offset
            const highEp = endpoint.from_interval(item.itv)[1];
            return endpoint.ge(highEp, ep);
        })
        .map((item) => {
            // truncate item overlapping offset itv.low=offset
            if (interval.covers_endpoint(item.itv, ep)) {
                const new_item = {...item};
                new_item.itv = [offset, item.itv[1], true, item.itv[3]];
                return new_item;
            }
            return item;
        });
    
    // console.log("insert", insert_items);

    // truncate pre-existing items overlapping offset
    const modify_items = layer.index.nearby(offset).center.map((item) => {
        const new_item = {...item};
        new_item.itv = [item.itv[0], offset, item.itv[2], false];
        return new_item;
    });
    
    // console.log("modify", modify_items);

    // remove pre-existing future - items covering itv.low > offset
    const remove = layer.provider.get()
        .filter((item) => {
            const lowEp = endpoint.from_interval(item.itv)[0];
            return endpoint.gt(lowEp, ep);
        })
        .map((item) => {
            return item.id;
        });

    // console.log("remove", remove);

    // layer update
    const insert = [...modify_items, ...insert_items];
    return layer_update(layer, {remove, insert, reset:false})
}

/**
 * Clock Cursor is a cursor that wraps a clock provider, which is available 
 * on the provider property.
 * 
 * Clock cursor does not depend on a src layer or a ctrl cursor. 
 * Clock cursor is FixedRate Cursor (bpm 1)
 * Clock cursor is NumberOnly
 * 
 * Clock cursor take options {skew, scale} to transform the clock value.
 * Scale is multiplier to the clock value, applied before the skew so that
 * it preserves the zero point.
 * 
 * The Clock cursor generally does not invoke any callback, as it is always in dynamic state.
 * However, a callback will be invoked if the clockprovider is changed through 
 * assignment of the provider property.
 * 
 */

function clock_cursor(options={}) {

    const {provider, shift=0, scale=1.0} = options;

    const cursor = new Cursor();

    // restrictions
    Object.defineProperty(cursor, "numeric", {get: () => true});
    Object.defineProperty(cursor, "fixedRate", {get: () => true});

    // query
    cursor.query = function (local_ts=local_clock.now()) {
        const clock_ts = provider.now(local_ts);
        const value = (clock_ts * scale) + shift;
        return {value, dynamic:true, offset:local_ts};
    };

    // setup provider as settable property
    addState(cursor);
    addMethods(cursor);
    cursor.srcprop_register("provider");
    cursor.srcprop_check = function (propName, obj) {
        if (propName == "provider") {
            if (!(obj instanceof ClockProvider)) {
                throw new Error(`provider must be clockProvider ${provider}`);
            }        
            return obj;    
        }
    };
    cursor.srcprop_onchange = function (propName, eArg) {
        if (propName == "provider") {
            if (eArg == "reset") {
                cursor.onchange();
            }
        }        
    };

    // initialise
    cursor.rate = 1.0 * scale;
    cursor.provider = provider;
    return cursor;
}

/*****************************************************
 * PLAYBACK CURSOR
 *****************************************************/

/**
 * generic playback cursor
 * 
 * "src" is a layer
 * "ctrl" is cursor (Number)
 * returns a cursor
 */

function playback_cursor(options={}) {

    const {ctrl, src, 
        mutable=false} = options;

    let src_cache; // cache for src layer
    let tid; // timeout
    let pid; // polling

    const cursor = new Cursor();

    /**********************************************************
     * RESTRICTIONS
     **********************************************************/

    Object.defineProperty(cursor, "numeric", {get: () => {
        return (cursor.src != undefined) ? cursor.src.numeric : false;
    }});
    Object.defineProperty(cursor, "mutable", {get: () => {
        return (cursor.src != undefined) ? (cursor.src.mutable && mutable) : false;
    }});
    Object.defineProperty(cursor, "itemsOnly", {get: () => {
        return (cursor.src != undefined) ? cursor.src.itemsOnly : false;
    }});

    
    /**********************************************************
     * SRC AND CTRL PROPERTIES
     **********************************************************/

    addState(cursor);
    addMethods(cursor);
    cursor.srcprop_register("ctrl");
    cursor.srcprop_register("src");

    cursor.srcprop_check = function (propName, obj) {
        if (propName == "ctrl") {
            if (!(obj instanceof Cursor) || obj.numeric == false) {
                throw new Error(`"ctrl" property must be a numeric cursor ${obj}`);
            }
            return obj;
        }
        if (propName == "src") {
            if (!(obj instanceof Layer)) {
                throw new Error(`"src" property must be a layer ${obj}`);
            }
            return obj;
        }
    };
    cursor.srcprop_onchange = function (propName, eArg) {
        if (cursor.src == undefined || cursor.ctrl == undefined) {
            return;
        }
        if (propName == "src") {
            if (eArg == "reset") {
                src_cache = cursor.src.createCache();
            } else {
                src_cache.clear();                
            }
        }
        cursor.onchange();
    };

    cursor.query = function query(local_ts) {
        let offset = cursor.ctrl.query(local_ts).value;
        // should not happen
        check_number("cursor.ctrl.offset", offset);
        const state = src_cache.query(offset);
        // if (src) layer is numeric, default value 0 
        // is assumed in regions where the layer is undefined
        if (cursor.src.numeric && state.value == undefined) {
            state.value = 0.0;
        }
        return state;
    };

    cursor.active_items = function get_item(local_ts) {
        if (cursor.itemsOnly) {
            const offset = cursor.ctrl.query(local_ts).value;
            return cursor.src.index.nearby(offset).center;    
        }
    };

    /**********************************************************
     * DETECT FUTURE EVENT
     **********************************************************/

    /**
     * fixed rate cursors never change their behavior - and
     * consequently never has to invoke any callbacks / events
     * 
     * Other cursors may change behaviour at a future time.
     * If this future change is caused by a state change - 
     * either in (src) layer or (ctrl) cursor - events will be 
     * triggered in response to this. 
     * 
     * However, cursors may also change behaviour at a future time moment
     * in time, without any causing state change. This may happen during 
     * playback, as the (ctrl) cursor leaves the current region 
     * of the (src) layer and enters into the next region.
     * 
     * This event must be detected, ideally at the right moment, 
     * so that the cursor can generate events, allowing observers to
     * react to the change. If the (ctrl) cursor behaves deterministically, 
     * this future event can be calculated ahead of time, 
     * and detected by timeout. Otherwise, the fallback solution is to
     * detect such future events by polling.
     * 
     * NOTE consumers of cursors might poll the cursor themselves, thus 
     * causing the event to be detected that way. However, there is no 
     * guarantee that this will happen. For example, in circumstances 
     * where the (src) layer region is static, consumers will turn
     * polling off, and depend on the change event from the cursor, in order 
     * to detect the change in behavior.
     * 
     */
    cursor.detect_future_event = function detect_future_event() {

        cancel_timeout();
        cancel_polling();

        // no future timeout if cursor itself is fixedRate
        if (cursor.fixedRate) {
            return;
        }

        // all other cursors must have (src) and (ctrl)
        if (cursor.ctrl == undefined) {
            throw new Error("cursor.ctrl can not be undefined with isFixedRate=false");
        }
        if (cursor.src == undefined) {
            throw new Error("cursor.src can not be undefined with isFixedRate=false");
        }

        // current state of cursor.ctrl 
        const {value:pos0, dynamic, offset:ts0} = cursor.ctrl.query();

        // no future timeout if cursor.ctrl is static
        if (!dynamic) {
            return;
        }

        // current region of cursor.src
        const src_nearby = cursor.src.index.nearby(pos0);
        const src_region_low = src_nearby.itv[0] ?? -Infinity;
        const src_region_high = src_nearby.itv[1] ?? Infinity;

        if (src_region_low == -Infinity && src_region_high == Infinity) {
            // unbounded src region - no event
            return;
        }

        // check if condition for clock timeout is met
        if (cursor.ctrl.fixedRate) {
            /* 
                cursor.ctrl is fixed rate (clock)
                future timeout when cursor.ctrl leaves src_region (on the right)
            */
            const vector = [pos0, cursor.ctrl.rate, 0, ts0];
            const target = src_region_high;
            schedule_timeout(vector, target);
            return;
        }

        // check if conditions for motion timeout are met
        // cursor.ctrl.ctrl must be fixed rate
        // cursor.ctrl.src must have itemsOnly == true 
        if (cursor.ctrl.ctrl.fixedRate && cursor.ctrl.src.itemsOnly) {
            /* 
                possible timeout associated with leaving region
                through either region_low or region_high.

                However, this can only be predicted if cursor.ctrl
                implements a deterministic function of time.
                This can be known only if cursor.ctrl.src is a layer with items.
                and a single active item describes either a motion or a transition 
                (with linear easing).                
            */
            const active_items = cursor.ctrl.src.get_items(ts0);
            if (active_items.length == 1) {
                const active_item = active_items[0];
                if (active_item.type == "motion") {
                    const [p,v,a,t] = active_item.data;
                    // TODO calculate timeout with acceleration too
                    if (a == 0.0) {
                        // figure out which region boundary we hit first
                        const target = (v > 0) ? src_region_high : src_region_low;
                        const vector = [pos0, v, 0, ts0];
                        schedule_timeout(vector, target);
                        return;
                    }
                } else if (active_item.type == "transition") {
                    const {v0, v1, t0, t1, easing="linear"} = active_item.data;
                    if (easing == "linear") {
                        // linear transition
                        const v = (v1-v0)/(t1-t0);
                        const target = (v > 0) ? src_region_high : src_region_low;
                        const vector = [pos0, v, 0, ts0];
                        schedule_timeout(vector, target);
                        return;                           
                    }
                }
            }
        }            

        /**
         * detection of leave events falls back on polling
         */
        start_polling(src_region_low, src_region_high);
    };

    /**********************************************************
     * TIMEOUT
     **********************************************************/

    function schedule_timeout(vector, target) {
        const [p,v,a,t] = vector;
        if (a != 0) {
            throw new Error("timeout not yet implemented for acceleration");
        }
        if (target == Infinity || target == -Infinity) {
            // no timeout
            return;
        }
        const delta_sec = (target - p) / v;
        if (delta_sec <= 0) {
            console.log("Warning - timeout <= 0 - dropping", delta_sec);
            console.log("vector", vector);
            console.log("target", target);
            return;
        }
        tid = set_timeout(handle_timeout, delta_sec * 1000.0);
    }

    function handle_timeout() {
        // event detected
        cursor.onchange();
    }

    function cancel_timeout() {
        if (tid != undefined) {
            tid.cancel(); 
        }    
    }

    /**********************************************************
     * POLLING
     **********************************************************/

    function start_polling(targetLow, targetHigh) {
        pid = setInterval(() => {
            handle_polling(targetLow, targetHigh);
        }, 100);
    }

    function handle_polling(targetLow, targetHigh) {
        let pos = cursor.ctrl.value;
        if (
            (targetLow > -Infinity && pos < targetLow) ||
            (targetHigh < Infinity && pos > targetHigh)
        ){ 
            // event detected
            cursor.onchange();
            return;
        }
    }

    function cancel_polling() {
        if (pid != undefined) { 
            clearInterval(pid); 
        }
    }
 
    /**********************************************************
     * INITIALIZATION
     **********************************************************/
    cursor.ctrl = ctrl;
    cursor.src = src;
    return cursor;
}

/*****************************************************
 * OBJECT CURSOR
 *****************************************************/

/**
 * cursor object supporting updates
 *  
 * "src" is a layer which is mutable
 * "ctrl" is fixed-rate cursor
 * 
 * object_cursor may also support recording
 */

function object_cursor(options={}) {

    const {ctrl, src, record=false} = options;

    const cursor = new playback_cursor({ctrl, src, mutable: true});

    /**
     * override to implement additional restrictions 
     * on src and ctrl
     */
    const original_srcprop_check = cursor.srcprop_check;

    cursor.srcprop_check = function (propName, obj) {
        obj = original_srcprop_check(propName, obj);
        if (propName == "ctrl") {
            if (!obj.fixedRate) {
                throw new Error(`"ctrl" property must be a fixedrate cursor ${obj}`);
            }
            return obj;
        }
        if (propName == "src") {
            if (!obj.mutable) {
                throw new Error(`"src" property must be mutable layer ${obj}`);
            }
            return obj;
        }
    };
        

    /**********************************************************
     * UPDATE API
     **********************************************************/
    cursor.set = (value) => {
        const items = create_set_items(cursor, value);
        return cursor.update(items);
    };
    cursor.motion = (vector) => {
        const items = create_motion_items(cursor, vector);
        return cursor.update(items);
    };
    cursor.transition = ({target, duration, easing}) => { 
        const items = create_transition_items(cursor, target, duration, easing);
        return cursor.update(items);

    };
    cursor.interpolate = ({tuples, duration}) => {
        const items = create_interpolation_items(cursor, tuples, duration);
        return cursor.update(items);
    };
    
    cursor.update = (items) => {
        if (items != undefined) {
            if (record) {
                return cursor.src.append(items, cursor.ctrl.value);
            } else {
                return cursor.src.update({insert:items, reset:true});
            }
        }
    };

    return cursor;
}


/******************************************************************
 * CURSOR UPDATE API
 * ***************************************************************/

/**
 * creaate items for set operation
*/
function create_set_items(cursor, value) {
    let items = [];
    if (value != undefined) {
        items = [{
            id: random_string(10),
            itv: [null, null, true, true],
            type: "static",
            data: value              
        }];
    }
    return items;
}

/**
 * create items for motion operation
 *  
 * motion only makes sense if object cursor is restricted to number values,
 * which in turn implies that the cursor.src (Items Layer) should be
 * restricted to number values. 
 * If non-number values occur - we simply replace with 0.
 * Also, items layer should have a single item in nearby center.
 * 
 * if position is omitted in vector - current position will be assumed
 * if timestamp is omitted in vector - current timestamp will be assumed
 * if velocity and acceleration are ommitted in vector 
 * - these will be set to zero.
 */

function create_motion_items(cursor, vector={}) {
    // get the current state of the cursor
    let {value:p0, offset:t0} = cursor.query();
    // ensure that p0 is number type
    if (typeof p0 !== 'number' || !isFinite(p0)) {
        p0 = 0;
    }
    // fetch new values from vector
    const {
        position:p1=p0,
        velocity:v1=0,
        acceleration:a1=0,
        timestamp:t1=t0,
        range=[null, null]
    } = vector;
    motion_utils.check_range(range);
    check_number("position", p1);
    check_number("velocity", v1);
    check_number("acceleration", a1);
    check_number("timestamp", t1);

    const items = [];

    /**
     * if pos range is bounded low or high or both,
     * this potentially corresponds to multiple time ranges [[t0, t1]] 
     * where the motion position is legal  
     * low <= p <= high 
     */
    const ctr = motion_utils.calculate_time_ranges;
    const time_ranges = ctr([p1,v1,a1,t1], range);
    // pick a time range which contains t1
    const ts = cursor.ctrl.value;

    const time_range = time_ranges.find((tr) => {
        const low = tr[0] ?? -Infinity;
        const high = tr[1] ?? Infinity;
        return low <= ts && ts <= high;
    });
    if (time_range != undefined) {
        const [low, high] = time_range;
        items.push({
            id: random_string(10),
            itv: [low, high, true, true],
            type: "motion",
            data: [p1, v1, a1, t1]
        });
        // add left if needed
        if (low != null) {
            items.push({
                id: random_string(10),
                itv: [null, low, true, false],
                type: "static",
                data: range[0]
            });
        }
        // add right if needed
        if (high != null) {
            items.push({
                id: random_string(10),
                itv: [high, null, false, true],
                type: "static",
                data: range[1]
            });
        }
    } else {
        /* 
            no time_range found
            
            p1 is outside the pos_range
            if p1 is less than low, then use low
            if p1 is greater than high, then use high
        */
        const val = (p1 < range[0]) ? range[0] : range[1];
        items.push({
            id: random_string(10),
            itv: [null, null, true, true],
            type: "static",
            data: val
        });
    }
    return items;
}

/**
 * create items for transition operation
 *  
 * transition to target position using in <duration> seconds.
 */

function create_transition_items(cursor, target, duration, easing) {

    const {value:v0, offset:t0} = cursor.query();
    const v1 = target;
    const t1 = t0 + duration;
    if (v1 == v0) {
        // noop
        return;
    }
    check_number("position", v0);
    check_number("position", v1);
    check_number("position", t0);
    check_number("position", t1);
    return [
        {
            id: random_string(10),
            itv: [null, t0, true, false],
            type: "static",
            data: v0
        },
        {
            id: random_string(10),
            itv: [t0, t1, true, true],
            type: "transition",
            data: {v0, v1, t0, t1, easing}
        },
        {
            id: random_string(10),
            itv: [t1, null, false, true],
            type: "static",
            data: v1
        }
    ];
}

/**
 * create items for interpolation operation
 */

function create_interpolation_items(cursor, tuples, duration) {

    const now = cursor.ctrl.value;
    tuples = tuples.map(([v,t]) => {
        check_number("ts", t);
        check_number("val", v);
        return [v, now + t];
    });

    // inflate segment to calculate boundary conditions
    const seg = load_segment([null, null, true, true], {
        type: "interpolation",
        data: tuples
    });

    const t0 = now;
    const t1 = t0 + duration;
    const v0 = seg.state(t0).value;
    const v1 = seg.state(t1).value;
    return [
        {
            id: random_string(10),
            itv: [-Infinity, t0, true, false],
            type: "static",
            data: v0
        },
        {
            id: random_string(10),
            itv: [t0, t1, true, false],
            type: "interpolation",
            data: tuples
        },
        {
            id: random_string(10),
            itv: [t1, Infinity, true, true],
            type: "static",
            data: v1
        }
    ];
}

/**
 * This wraps a cursor so that it can be used as a layer.
 */

function layer_from_cursor(src) {

    if (!(src instanceof Cursor)) {
        throw new Error(`src must be a Cursor ${src}`);
    }
 
    const layer = new Layer();
    layer.index = new CursorIndex(src);

    // restrictions
    Object.defineProperty(layer, "numeric", {get: () => src.numeric});

    // subscribe
    src.add_callback((eArg) => {
        layer.onchange(eArg);
    });

    // initialise
    layer.src = src;
    return layer;
} 


/**
 * Create a NearbyIndex for the Cursor.
 * 
 * The cursor value is independent of timeline offset, 
 * which is to say that it has the same value for all 
 * timeline offsets.
 * 
 * In order for the default LayerCache to work, an
 * object with a .query(offset) method is needed in 
 * nearby.center. Since cursors support this method
 * (ignoring the offset), we can use the cursor directly.
 */

class CursorIndex extends NearbyIndexBase {

    constructor(cursor) {
        super();
        this._cursor = cursor;
    }

    nearby(offset) {
        // cursor index is defined for entire timeline
        return {
            itv: [null, null, true, true],
            center: [this._cursor],
            left: endpoint.NEG_INF,
            prev: endpoint.NEG_INF,
            right: endpoint.POS_INF,
            next: endpoint.POS_INF,
        }
    }
}

/**
 * Convenience merge options
 */
const MERGE_OPTIONS = {
    sum: {
        valueFunc: function (info) {
            // returns the sum of values of active layers
            return info.states
                .map(state => state.value) 
                .reduce((acc, value) => acc + value, 0);
        }
    },
    stack: {
        stateFunc: function (info) {
            // returns values from first active layer
            return {...info.states[0]}
        }
    },
    array: {
        valueFunc: function (info) {
            // returns an array with values from active layers
            return info.states.map(state => state.value);
        }
    }
};

/**
 * 
 * This implements a merge operation for layers.
 * List of sources is immutable.
 * 
 */

function merge_layer (sources, options={}) {
    let {type="", ...opts} = options;

    // type specifies predefined options for Layer
    if (type in MERGE_OPTIONS) {
        opts = MERGE_OPTIONS[type];
    }
    const layer = new Layer(opts);    

    // setup sources property
    addState(layer);
    addMethods(layer);
    layer.srcprop_register("sources");

    layer.srcprop_check = function(propName, sources) {
        if (propName == "sources") {
            // check that sources is array of layers
            if (!Array.isArray(sources)) {
                throw new Error(`sources must be array ${sources}`)
            }
            const all_layers = sources.map((e) => e instanceof Layer).every(e => e);
            if (!all_layers) {
                throw new Error(`sources must all be layers ${sources}`);
            }
        }
        return sources;
    };

    layer.srcprop_onchange = function(propName, eArg) {
        if (propName == "sources") {
            if (eArg == "reset") {
                layer.index = new NearbyIndexMerge(layer.sources);
            } 
            layer.onchange();
        }
    };

    // restrictions
    const numeric = sources.map((src) => src.numeric).every(e=>e);  
    Object.defineProperty(layer, "numeric", {get: () => numeric});

    // initialise
    layer.sources = sources;

    return layer
}



/**
 * Creating a merged NearbyIndex for set of Layers.
 *  
 * A region within the merged index will contain
 * a list of references to (cache objects) for 
 * the Layers which are defined in this region.
 * 
 * Implementation is stateless.
 * Set of layers is assumed to be static.
 */

function cmp_ascending(p1, p2) {
    return endpoint.cmp(p1, p2)
}

function cmp_descending(p1, p2) {
    return endpoint.cmp(p2, p1)
}

class NearbyIndexMerge extends NearbyIndexBase {

    constructor(sources) {
        super();
        this._sources = sources;
        this._caches = new Map(sources.map((src) => {
            return [src, src.createCache()];
        }));
    }

    nearby(offset) {
        offset = endpoint.from_input(offset);
        // accumulate nearby from all sources
        const prev_list = [], next_list = [];
        const center = [];
        const center_high_list = [];
        const center_low_list = [];
        for (let src of this._sources) {
            let nearby = src.index.nearby(offset);
            let prev_region = src.index.find_region(nearby, {direction:-1});
            let next_region = src.index.find_region(nearby, {direction:1});
            if (prev_region != undefined) {
                prev_list.push(endpoint.from_interval(prev_region.itv)[1]);
            }
            if (next_region != undefined) {
                next_list.push(endpoint.from_interval(next_region.itv)[0]);
            }
            if (nearby.center.length > 0) {
                center.push(this._caches.get(src));
                let [low, high] = endpoint.from_interval(nearby.itv);
                center_high_list.push(high);
                center_low_list.push(low);    
            }
        }
        
        // find closest endpoint to the right (not in center)
        next_list.sort(cmp_ascending);
        const next_low = next_list[0] || endpoint.POS_INF;

        // find closest endpoint to the left (not in center)
        prev_list.sort(cmp_descending);
        const prev_high = prev_list[0] || endpoint.NEG_INF;

        return nearby_from(
                prev_high, 
                center_low_list, 
                center,
                center_high_list,
                next_low
            );
    }
}

/*********************************************************************
    BOOLEAN LAYER
*********************************************************************/

/* 
    Boolean Layer is returns values 0/1 - making it a numeric layer
*/


function boolean_layer(src) {

    const layer = new Layer();
    layer.index = new NearbyIndexBoolean(src.index);
    
    // subscribe
    src.add_callback((eArg) => {
        layer.onchange(eArg);
    });


    // restrictions
    Object.defineProperty(layer, "numeric", {get: () => true});

    // initialise
    layer.src = src;
    return layer;
} 


/*********************************************************************
    BOOLEAN NEARBY INDEX
*********************************************************************/

/**
 * Wrapper Index where regions are true/false, based on 
 * condition on nearby.center.
 * Back-to-back regions which are true are collapsed 
 * into one region
 * 
 */

function queryObject (value) {
    return {
        query: function (offset) {
            return {value, dynamic:false, offset};
        }
    }
}

class NearbyIndexBoolean extends NearbyIndexBase {

    constructor(index, options={}) {
        super();
        this._index = index;
        let {condition = (center) => center.length > 0} = options;
        this._condition = condition;
    }

    nearby(offset) {
        offset = endpoint.from_input(offset);
        const nearby = this._index.nearby(offset);
        
        let evaluation = this._condition(nearby.center); 
        /* 
            seek left and right for first region
            which does not have the same evaluation 
        */
        const condition = (center) => {
            return this._condition(center) != evaluation;
        };

        // expand right
        let right;
        let right_nearby = this._index.find_region(nearby, {
            direction:1, condition
        });        
        if (right_nearby != undefined) {
            right = endpoint.from_interval(right_nearby.itv)[0];
        }

        // expand left
        let left;
        let left_nearby = this._index.find_region(nearby, {
            direction:-1, condition
        });
        if (left_nearby != undefined) {
            left = endpoint.from_interval(left_nearby.itv)[1];
        }

        // expand to infinity
        left = left || endpoint.NEG_INF;
        right = right || endpoint.POS_INF;
        const low = endpoint.flip(left);
        const high = endpoint.flip(right);
        const value = evaluation ? 1 : 0;
        return {
            itv: interval.from_endpoints(low, high),
            center : [queryObject(value)],
            left,
            right,
        }
    }
}

function logical_merge_layer(sources, options={}) {

    const {expr} = options;
    let condition;
    if (expr) {
        condition = (center) => {
            return expr.eval(center);
        };    
    }

    const layer = new Layer();
    const index = new NearbyIndexMerge(sources);
    layer.index = new NearbyIndexBoolean(index, {condition});

    // subscribe to callbacks from sources
    sources.map((src) => {
        return src.add_callback(layer.onchange);
    });
    
    layer.sources = sources;

    // restrictions
    Object.defineProperty(layer, "numeric", {get: () => true});

    return layer;
}


function logical_expr (src) {
    if (!(src instanceof Layer)) {
        throw new Error(`must be layer ${src}`)
    }
    return {
        eval: function (center) {
            for (let cache of center) {
                if (cache.src == src) {
                    return true;
                }
            }
            return false;
        }
    }
}

logical_expr.and = function and(...exprs) {
    return {
        eval: function (center) {
            return exprs.every((expr) => expr.eval(center));
        }    
    }
};

logical_expr.or = function or(...exprs) {
    return {
        eval: function (center) {
            return exprs.some((expr) => expr.eval(center));
        }    
    }
};

logical_expr.xor = function xor(expr1, expr2) {
    return {
        eval: function (center) {
            return expr1.eval(center) != expr2.eval(center);
        }    
    }
};

logical_expr.not = function not(expr) {
    return {
        eval: function (center) {
            return !expr.eval(center);
        }    
    }
};

/**
 * affine transform 1D by shift and scale factor
 */

function transform(p, {shift=0, scale=1}) {
    if (p == undefined || !isFinite(p)) {
        // p - noop
        return p;
    }
    else if (typeof p == "number") {
        // p is number - transform
        return (p*scale) + shift;
    } else if (Array.isArray(p) && p.length > 1) {
        // p is endpoint - transform value
        let [val, bracket] = p;
        return endpoint.from_input([(val*scale)+shift, bracket]);
    }
}

function reverse(p, {shift=0, scale=1}) {
    if (p == undefined || !isFinite(p)) {
        // p - noop
        return p;
    }
    else if (typeof p == "number") {
        // p is number - transform
        return (p-shift)/scale;
    } else if (Array.isArray(p) && p.length > 1) {
        // p is endpoint - transform value
        let [val, bracket] = p;
        return endpoint.from_input([((val-shift)/scale), bracket]);
    }
}


/*********************************************************************
    NEARBY INDEX - AFFINE TIMELINE TRANSFORM
*********************************************************************/

class NearbyIndexATT extends NearbyIndexBase {

    constructor (layer, options={}) {
        super();
        this._layer = layer;
        this._cache = layer.createCache();
        this._options = options;
        
        // transform cache
        this._transform_cache = {
            query: function (offset) {
                // reverse transform query
                const state = this._cache.query(reverse(offset, this._options));
                // keep original offset (instead of reversing result)
                return {...state, offset};
            }.bind(this)
        };
    }

    nearby(offset) {
        offset = endpoint.from_input(offset);
        // reverse transform query offset
        const nearby = this._layer.index.nearby(reverse(offset, this._options));
        // transform query result 
        const itv = nearby.itv.slice();
        itv[0] = transform(nearby.itv[0], this._options);
        itv[1] = transform(nearby.itv[1], this._options);
        return {
            itv,
            left: transform(nearby.left, this._options),
            right: transform(nearby.right, this._options),
            center: nearby.center.map(() => this._transform_cache)
        }
    }
}


/*********************************************************************
    TIMELINE TRANSFORM LAYER
*********************************************************************/

/**
 * Shifting and scaling the timeline of a layer
 * 
 * options:
 * - shift: a value of 2 effectively means that layer contents 
 *   are shifted to the right on the timeline, by 2 units
 * - scale: a value of 2 means that the layer is stretched
 *   by a factor of 2
 */

function timeline_transform (src, options={}) {

    const layer = new Layer();

    // setup src property
    addState(layer);
    addMethods(layer);
    layer.srcprop_register("src");
        
    layer.srcprop_check = function(propName, src) {
        if (propName == "src") {
            if (!(src instanceof Layer)) {
                throw new Error(`"src" must be Layer ${src}`);
            }
            return src;    
        }
    };

    layer.srcprop_onchange = function(propName, eArg) {
        if (propName == "src") {
            if (eArg == "reset") {
                this.index = new NearbyIndexATT(this.src, options);
            } 
            layer.onchange();
        }
    };

    // restrictions
    Object.defineProperty(layer, "numeric", {get: () => src.numeric});

    // initialise
    layer.src = src;



    
    return layer;
}

// TODO - enusure numeric if set to true

function transformState(state, options={}) {
    const {valueFunc, stateFunc} = options;
    if (valueFunc != undefined) {
        state.value = valueFunc(state.value);
        return state;
    } else if (stateFunc != undefined) {
        return stateFunc(state);
    } else {
        return state;
    }
}

/**
 * Cursor Transform
 * Create a new Cursor which is a transformation of a src Cursor.
 * 
 * The new transformed Cursor does not have a src (layer) and and a ctrl (cursor)
 * property, since it only depends on the src cursor.
 * 
 * Also, the new transformed cursor does not need any playback logic on its own
 * as long as the nature of the transformation is a plain value/state transition. 
 */
function cursor_transform(src, options={}) {

    if (!(src instanceof Cursor)) {
        throw new Error(`src must be a Cursor ${src}`);
    }

    const {numeric, valueFunc, stateFunc} = options;
    const cursor = new Cursor();

    // implement query
    cursor.query = function query() {
        const state = src.query();
        return transformState(state, {stateFunc, valueFunc});
    };

    // numberic can be set to true by options
    Object.defineProperty(cursor, "numeric", {get: () => {
        return (numeric == undefined) ? src.numeric : numeric; 
    }});
    // fixedRate is inherited from src
    Object.defineProperty(cursor, "fixedRate", {get: () => src.fixedRate});

    if (src.fixedRate) {
        // propagate rate property from src
        Object.defineProperty(cursor, "rate", {get: () => src.rate});
    }

    // callbacks from src-cursor
    src.add_callback(() => {cursor.onchange();});
    return cursor;
}


/**
 * Layer Transform
 * Create a new Layer which is a transformation of the src Layer
 */

function wrappedValueFunc(valueFunc) {
    return function ({sources, states, offset}) {
        return valueFunc(states[0].value);
    }
}

function wrappedStateFunc(stateFunc) {
    return function ({sources, states, offset}) {
        return stateFunc(states[0]);
    }
}

function layer_transform(src, options={}) {

    if (!(src instanceof Layer)) {
        throw new Error(`src must be a Layer ${src}`);
    }

    const ops = {};
    ops.valueFunc = wrappedValueFunc(options.valueFunc);
    ops.stateFunc = wrappedStateFunc(options.stateFunc);

    const layer = new Layer(ops);
    layer.index = new NearbyIndexSrc(src);
    layer.src = src;
    layer.src.add_callback((eArg) => {layer.onchange(eArg);});

    Object.defineProperty(layer, "numeric", {get: () => src.numeric});

    return layer;
}

/**
 * record cursor into layer
 * 
 *   MAIN IDEA
 * - record the current value of a cursor (src) into a layer (dst)
 * 
 * - recording is essentially a copy operation from the
 *   stateProvider of a cursor (src) to the stateProvider of the layer (dst).
 * - more generally copy state (items) from cursor to layer. 
 * - recording therefor only applies to cursors that run directly on a layer with items
 * - moreover, the target layer must have items (typically a leaflayer)
 *
 * 
 *   TIMEFRAMES 
 * - the recording to (dst) layer is driven by a clock (ctrl): <DST_CLOCK>
 * - during recording - current value of the src cursor will be copied, and
 *   converted into the timeline of the <DST_CLOCK>
 * - recording is active only when <DST_CLOCK> is progressing with rate==1.0
 * - this opens for LIVE recording (<DST_CLOCK> is fixedRate cursor) or
 *   iterative recording using a (NumbericVariable), allowing multiple takes, 
 * 
 * 
 *   RECORDING
 * - recording is done by appending items to the dst layer 
 * - when the cursor state changes (entire cursor.src layer is reset) 
 * - the part which describes the future will overwrite the relevant
 * - part of the the layer timeline
 * - the delineation between past and future is determined by 
 * - fresh timestamp <TS> from <DST_CLOCK>
 * - if an item overlaps with <TS> it will be truncates so that only the part
 * - that is in the future will be recorded (copied) to the layer.
 * - in case (ctrl) is a media control - recording can only happen
 *   when the (ctrl) is moving forward
 * 
 *   INPUT
 * - (ctrl)
 *      - numeric cursor (ctrl.fixedRate, or 
 *      - media control (ctrl.ctrl.fixedRate && ctrl.src.itemsOnly)
 * - (src) - cursor with layer with items (src.itemsOnly) 
 * - (dst) - layer of items (dst.itemsOnly && dst.mutable)
 *
 *   NOTE
 * - implementation assumes 
 *      - (dst) layer is not the same as the (src) layer
 *      - (src) cursor can not be clock cursor (makes no sense to record a clock
 *   
 */


function layer_recorder(options={}) {
    const {ctrl, src, dst} = options;

    // check - ctrl
    if (!(ctrl instanceof Cursor)) {
        throw new Error(`ctrl must be a cursor ${ctrl}`);
    }
    if (
        !ctrl.fixedRate && !ctrl.ctrl.fixedRate
    ) {
        throw new Error(`ctrl or ctrl.ctrl must be fixedRate ${ctrl}`);
    }
    if (!ctrl.fixedRate) {
        if (ctrl.ctrl.fixedRate && !ctrl.itemsOnly) {
            throw new Error(`given ctrl.ctrl.fixedRate, ctrl must be itemsOnly ${ctrl}`);
        }
    }

    // check - src
    if (!(src instanceof Cursor)) {
        throw new Error(`src must be a cursor ${src}`);
    }
    if ((src.fixedRate)) {
        throw new Error(`cursor src can not be fixedRate cursor ${src}`);
    }
    if (!src.itemsOnly) {
        throw new Error(`cursor src must be itemsOnly ${src}`);
    }
    if (!src.mutable) {
        throw new Error(`cursor src must be mutable ${src}`);
    }

    // check - stateProviders
    const src_stateProvider = src.src.provider;
    const dst_stateProvider = dst.provider;
    if (src_stateProvider === dst_stateProvider) {
        throw new Error(`src and dst can not have the same stateProvider`);
    }


    /**
     * turn this around?
     * have start and stop recording
     * methods direct the control?
     * 
     * recording with live clock requires
     * start and stop methods
     * 
     * what about a media clock ?
     * should be a media clock that can only move forward
     * it actually makes sense to be in record mode even if mediaclock is paused
     * because recording only happens on state change
     * paused means you overwrite on the same spot
     * skipping back while in record mode - should that trigger write current
     * state longer back
     * 
     * skipping always exit record mode
     * record mode always starts
     * media control may be controlled externally
     * 
     * split between a live and a media clock recorder?
     * 
     */

    // internal state
    let is_recording = false;

    /**
     * state change in src stateProvider
     */

    function on_src_change () {
        if (!is_recording) return;
        record();
    }

    /**
     * state change in ctrl
     */
    function on_ctrl_change () {
        // figure out if recording starts or stops
        const was_recording = is_recording;
        is_recording = false;
        if (ctrl.fixedRate) {
            is_recording = true;
        } else {
            const ctrl_ts = ctrl.ctrl.value;
            const items = ctrl.src.index.nearby(ctrl_ts).center;
            if (items.length == 1)
                if (items[0].type == "motion" ) {
                    const [p,v,a,t] = items[0].data;
                    if (v > 0 || v == 0 && a > 0) {
                        is_recording = true;
                    }
            }
        }
        if (!was_recording && is_recording) {
            start_recording();
        } else if (was_recording && !is_recording) {
            stop_recording();
        }
    }

    /**
     * record
     */
    function start_recording() {
        console.log("start recording");
        record();
    }

    function stop_recording() {
        console.log("stop recording");
        // close last item
        const ts = local_clock.now();
        const dst_offset = ctrl.query(ts).value;
        const items = dst.index.nearby(dst_offset).center;
        const insert = items.map((item) => {
            const new_item = {...item};
            new_item.itv[1] = dst_offset;
            new_item.itv[3] = false;
            return new_item;
        });
        if (items.length > 0) {
            dst.update({insert, reset:false});
        }
    }

    function record() {
        const ts = local_clock.now();
        const src_offset = src.query(ts).offset;
        const dst_offset = ctrl.query(ts).value;
        // get current src items
        // crucial to clone the items before changing and
        // storing them in the dst layer
        let src_items = structuredClone(src_stateProvider.get());

        // re-encode items in dst timeframe, if needed
        const offset = dst_offset - src_offset;
        if (offset != 0) {
            const dst_items = src_items.map((item) => {
                return timeshift_item(item, offset);
            });
            dst.append(dst_items, dst_offset);
        } else {
            dst.append(src_items, src_offset);
        }        
    }

    // register callbacks
    src_stateProvider.add_callback(on_src_change);
    ctrl.add_callback(on_ctrl_change);
    on_ctrl_change();

    return dst;
}


/**
 * timeshift parameters of time by offset
 */
function timeshift_item (item, offset) {
    item = {...item};
    item.itv[0] = (item.itv[0] != null) ? item.itv[0] + offset : null;
    item.itv[1] = (item.itv[1] != null) ? item.itv[1] + offset : null;
    // TODO - perhaps change implementation of motion and transition segment
    // to use timestamps relative to the start of the segment,
    // similar to interpolation?
    if (item.type == "motion") {
        item.data.timestamp = item.data.timestamp + offset;
    } else if (item.type == "transition") {
        item.data.t0 = item.data.t0 + offset;
        item.data.t1 = item.data.t1 + offset;
    }
    return item;
}

/**
 * Timing Object Cursor
 * Create a new Cursor which has a Timing Object as src property.
 * 
 * The new Cursor does not have a src (layer) or a ctrl (cursor)
 * property, since it only depends on the src TimingObject.
 * 
 * Also, the new cursor does not need any playback logic on its own
 * since it is only a wrapper and the timing object provides playback support.
 */
function cursor_from_timingobject(src) {

    if (src.constructor.name != "TimingObject") {
        throw new Error(`src must be a TimingObject ${src}`);
    }

    // split timing object into clock and vector

    // make a clock cursor
    const clock = new Cursor();
    clock.query = function query() {
        const {timestamp} = src.query();
        return {value: timestamp, dynamic: true, offset: timestamp}; 
    };
    // numeric
    Object.defineProperty(clock, "numeric", {get: () => {return true}});
    // fixedRate
    Object.defineProperty(clock, "fixedRate", {get: () => {return true}});

    // layer for the vector
    const sp = new ObjectProvider({
        items: [{
            itv: [null, null, true, true],
            data: src.vector
        }]
    });
    const layer = leaf_layer({provider: sp});


    // make a timing object cursor
    const cursor = new Cursor();

    // implement query
    cursor.query = function query() {
        const {position, velocity, acceleration, timestamp} = src.query();
        const dynamic = (velocity != 0 || acceleration != 0);
        return {value:position, dynamic, offset:timestamp};
    };

    // numeric
    Object.defineProperty(cursor, "numeric", {get: () => {return true}});
    // fixedRate
    Object.defineProperty(cursor, "fixedRate", {get: () => {return false}});
    // ctrl
    Object.defineProperty(cursor, "ctrl", {get: () => {return clock}});
    // src
    Object.defineProperty(cursor, "src", {get: () => {return layer}});


    // callbacks from timing object
    src.on("change", () => {
        // update state provider
        layer.provider.set([{
            itv: [null, null, true, true],
            data: src.vector
        }]);
        cursor.onchange();
    });
    return cursor;
}

/*
    State Provider Viewer
*/

function item2string(item, options) {
    // txt
    const id_txt = item.id;
    const type_txt = item.type;
    let itv_txt = "";
    if (item.itv != undefined) {
        const [low, high, lowInclude, highInclude] = item.itv;
        const low_txt = (low == null) ? "null" : low.toFixed(2);
        const high_txt = (high == null) ? "null" : high.toFixed(2);
        itv_txt = `[${low_txt},${high_txt},${lowInclude},${highInclude}]`; 
    }
    let data_txt = JSON.stringify(item.data);

    // html
    let id_html = `<span class="item-id">${id_txt}</span>`;
    let itv_html = `<span class="item-itv">${itv_txt}</span>`;
    let type_html = `<span class="item-type">${type_txt}</span>`;
    let data_html = `<span class="item-data">${data_txt}</span>`;
    
    // delete Button
    const {delete_allowed=false} = options;
    if (delete_allowed) {
        return `
        <div>
            <button id="delete">X</button>
            ${id_html}: ${type_html} ${itv_html} ${data_html}
        </div>`;
    } else {
        return `
        <div>
            ${id_html}: ${type_html} ${itv_html} ${data_html}
        </div>`;        
    }
}


class StateProviderViewer {

    constructor(stateProvider, elem, options={}) {
        this._sp = stateProvider;
        this._elem = elem;
        this._handle = this._sp.add_callback(this._onchange.bind(this)); 

        // options
        let defaults = {
            toString:item2string
        };
        this._options = {...defaults, ...options};

        /*
            Support delete
        */
        if (this._options.delete_allowed) {
            // listen for click events on root element
            elem.addEventListener("click", (e) => {
                // catch click event from delete button
                const deleteBtn = e.target.closest("#delete");
                if (deleteBtn) {
                    const listItem = deleteBtn.closest(".list-item");
                    if (listItem) {
                        this._sp.update({remove:[listItem.id]});
                        e.stopPropagation();
                    }
                }
            });
        }

        /*
            render initial state
        */ 
        this._onchange();
    }

    _onchange() {
        const items = this._sp.get() || [];

        // sort by low endpoint
        items.sort((item_a, item_b) => {
            let lowEp_a = endpoint.from_interval(item_a.itv)[0];
            let lowEp_b = endpoint.from_interval(item_b.itv)[0];
            return endpoint.cmp(lowEp_a, lowEp_b);
        });

        // clear
        this._elem.replaceChildren();
        // rebuild
        const {toString} = this._options;
        for (let item of items) {
            // add
            let node = this._elem.querySelector(`#${item.id}`);
            if (node == null) {
                node = document.createElement("div");
                node.setAttribute("id", item.id);
                node.classList.add("list-item");
                this._elem.appendChild(node);
            }
            node.innerHTML = toString(item, this._options);
        }
    }
}


function render_provider(stateProvider, selector, options={}) {
    const elems = document.querySelector(selector);
    return new StateProviderViewer(stateProvider, elems, options);
}

// classes


/*********************************************************************
    LAYER FACTORIES
*********************************************************************/

function layer(options={}) {
    let {src, provider, items=[], value, ...opts} = options;
    if (src != undefined) {
        if (src instanceof Layer) {
            return src;
        }
    }
    if (provider == undefined) {
        if (value != undefined) {
            const items = check_items([{
                itv: [null, null, true, true],
                data: value
            }]);
            provider = new ObjectProvider({items});
        } else {
            items = check_items(items);
            provider = new CollectionProvider({items});
        } 
    }
    return leaf_layer({provider, ...opts}); 
}

function record (options={}) {
    const dst = layer({mutable:true});
    let {ctrl, src} = options;
    if (ctrl == undefined) {
        ctrl = clock();
    }
    return layer_recorder({ctrl, src, dst});
}

/*********************************************************************
    CURSOR FACTORIES
*********************************************************************/

function clock(options={}) {
    const {clock, vector, ...opts} = options;
    const provider = clock_provider({clock, vector});
    return clock_cursor({provider, ...opts});
}

function object(options={}) {
    let {ctrl, src, ...src_opts} = options;
    if (ctrl == undefined) {
        ctrl = clock();
    }
    if (src == undefined) {
        src = layer(src_opts);
    }
    return object_cursor({ctrl, src});
}

function playback(options={}) {
    let {ctrl, src, ...src_opts} = options;
    if (ctrl == undefined) {
        ctrl = clock();
    }
    if (src == undefined) {
        src = layer(src_opts);
    }
    return playback_cursor({ctrl, src});
}

export { CollectionProvider, Cursor, Layer, NearbyIndexBase, ObjectProvider, boolean_layer as boolean, clock, cursor_from_timingobject, cursor_transform, layer, layer_from_cursor, layer_transform, local_clock, logical_expr, logical_merge_layer as logical_merge, merge_layer as merge, object, playback, record, render_cursor, render_provider, timeline_transform };
