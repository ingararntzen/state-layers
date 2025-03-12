
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
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
    if (!isFinite(v)) {
        return p;
    }
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
    returns endpoints from interval
*/

function endpoint_from_input(offset) {
    if (typeof offset === 'number') {
        return [offset, 0];
    }
    if (!Array.isArray(offset) || offset.length != 2) {
        throw new Error("Endpoint must be a length-2 array");
    }
    let [value, sign] = offset;
    if (typeof value !== "number") {
        throw new Error("Endpoint value must be number");
    }
    return [value, Math.sign(sign)];
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

function interval_from_input(input){
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
    }    // make sure interval is length 4
    if (itv.length == 1) {
        itv = [itv[0], itv[0], true, true];
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
    from_input: endpoint_from_input
};
const interval = {
    covers_endpoint: interval_covers_endpoint,
    covers_point: interval_covers_point, 
    is_singular: interval_is_singular,
    from_endpoints: interval_from_endpoints,
    from_input: interval_from_input
};

// ovverride modulo to behave better for negative numbers
function mod(n, m) {
    return ((n % m) + m) % m;
}
function divmod(x, base) {
    let n = Math.floor(x / base);
    let r = mod(x, base);
    return [n, r];
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


/**
 * Create a single state from a list of states, using a valueFunc
 * state:{value, dynamic, offset}
 * 
 */

function toState(sources, states, offset, options={}) {
    let {valueFunc, stateFunc} = options; 
    if (valueFunc != undefined) {
        let value = valueFunc({sources, states, offset});
        let dynamic = states.map((v) => v.dymamic).some(e=>e);
        return {value, dynamic, offset};
    } else if (stateFunc != undefined) {
        return {...stateFunc({sources, states, offset}), offset};
    }
    // no valueFunc or stateFunc
    if (states.length == 0) {
        return {value:undefined, dynamic:false, offset}
    }
    // fallback - just use first state
    let state = states[0];
    return {...state, offset}; 
}


function random_string(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    for(var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/*
    This decorates an object/prototype with basic (synchronous) callback support.
*/

const PREFIX$1 = "__callback";

function addToInstance$1(object) {
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

function addToPrototype$1 (_prototype) {
    const api = {
        add_callback, remove_callback, notify_callbacks
    };
    Object.assign(_prototype, api);
}

function implements_callback (obj) {
    const methods = ["add_callback", "remove_callback"];
    for (const prop of methods) {
        if (!(prop in obj)) return false;
        if (typeof obj[prop] != 'function') return false;
    }
    return true;
}

function check_item(item) {
    item.itv = interval.from_input(item.itv);
    item.id = item.id || random_string(10);
    return item;
}


function is_stateprovider(obj) {
    if (!implements_callback(obj)) return false;
    if (!("get_items" in obj)) return false;
    if (typeof obj.get_items != 'function') return false;
    return true;
}


/***************************************************************
    LOCAL STATE PROVIDER
***************************************************************/

/**
 * local state provider
 * collection of items
 * 
 * changes = {
 *   remove=[],
 *   insert=[],
 *   reset=false 
 * }
 * 
*/

class LocalStateProvider {

    constructor(options={}) {
        addToInstance$1(this);
        this._map = new Map();
        this._initialise(options);
    }

    /**
     * Local stateprovider support initialisation with
     * by giving items or a value. 
     */
    _initialise(options={}) {
        // initialization with items or single value 
        let {insert, value} = options;
        if (value != undefined) {
            // initialize from value
            insert = [{
                itv: [-Infinity, Infinity, true, true], 
                type: "static",
                data: value
            }];
        }
        if (insert != undefined) {
            this._update({insert, reset:true});
        }
    }

    /**
     * Local stateproviders decouple update request from
     * update processing, and returns Promise.
     */
    update (changes) {
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
            item = check_item(item);
            const diff = diff_map.get(item.id);
            const old = (diff != undefined) ? diff.old : this._map.get(item.id);
            diff_map.set(item.id, {id:item.id, new:item, old});
            this._map.set(item.id, item);
        }
        return [...diff_map.values()];
    }

    get_items() {
        return [...this._map.values()];
    };
}
addToPrototype$1(LocalStateProvider.prototype);

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
 *          always a high-endpoint or [-Infinity, 0]
 *      right:
 *          first interval endpoint to the right
 *          which will produce different {center}
 *          always a low-endpoint or [Infinity, 0]    
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
 * interval endpoints are defined by [value, sign], for example
 * 
 * 4) -> [4,-1] - endpoint is on the left of 4
 * [4, 4, 4] -> [4, 0] - endpoint is at 4 
 * (4 -> [4, 1] - endpoint is on the right of 4)
 * 
 *  
 */


/**
 * return first high endpoint on the left from nearby,
 * which is not in center
 */
function left_endpoint (nearby) {
    const low = endpoint.from_interval(nearby.itv)[0];
    return endpoint.flip(low, "high");
}

/**
 * return first low endpoint on the right from nearby,
 * which is not in center
 */

function right_endpoint (nearby) {
    const high = endpoint.from_interval(nearby.itv)[1];
    return endpoint.flip(high, "low");
}



class NearbyIndexBase {


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


    /**
     * return nearby of first region to the right
     * which is not the center region. If not exists, return
     * undefined. 
     */
    right_region(nearby) {
        const right = right_endpoint(nearby);
        if (right[0] == Infinity) {
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
        if (left[0] == -Infinity) {
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
        this._start = [start, 0];
        this._stop = [stop, 0];

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
            result.right = endpoint.flip(min_center_high, "low");
        }
        result.next = (multiple_center_high) ? result.right : next_low;

        // prev/left
        if (endpoint.ge(prev_high, max_center_low)) {
            result.left = prev_high;
        } else {
            result.left = endpoint.flip(max_center_low, "high");
        }
        result.prev = (multiple_center_low) ? result.left : prev_high;

    }

    // interval from left/right
    let low = endpoint.flip(result.left, "low");
    let high = endpoint.flip(result.right, "high");
    result.itv = interval.from_endpoints(low, high);

    return result;
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

function addToInstance (object) {
    object[`${PREFIX}`] = new Map();
}

function addToPrototype (_prototype) {

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
                if (implements_callback(e)) {
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
                if (implements_callback(e)) {
                    state.handles.push(e.add_callback(handler));
                }
            }
            this[`${NAME}_onchange`](propName, "reset"); 
        }
    }

    const api = {};
    api[`${NAME}_register`] = register;
    api[`${PREFIX}_attach`] = attatch;
    Object.assign(_prototype, api);
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
/*
    Implements deterministic projection based on initial conditions 
    - motion vector describes motion under constant acceleration
*/

class MotionSegment extends BaseSegment {
    
    constructor(itv, data) {
        super(itv);
        const {
            position:p0=0, 
            velocity:v0=0, 
            acceleration:a0=0, 
            timestamp:t0=0
        } = data;
        // create motion transition
        this._pos_func = function (ts) {
            let d = ts - t0;
            return p0 + v0*d + 0.5*a0*d*d;
        };
        this._vel_func = function (ts) {
            let d = ts - t0;
            return v0 + a0*d;
        };
        this._acc_func = function (ts) {
            return a0;
        };
    }

    state(offset) {
        let pos = this._pos_func(offset);
        let vel = this._vel_func(offset);
        let acc = this._acc_func(offset);
        return {
            position: pos,
            velocity: vel,
            acceleration: acc,
            timestamp: offset,
            value: pos,
            dynamic: (vel != 0 || acc != 0 )
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

function interpolate$1(tuples) {

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
        this._trans = interpolate$1(tuples);
    }

    state(offset) {
        return {value: this._trans(offset), dynamic:true};
    }
}

function lt (p1, p2) {
	return endpoint.lt(endpoint.from_input(p1), endpoint.from_input(p2));
}
function eq (p1, p2) {
	return endpoint.eq(endpoint.from_input(p1), endpoint.from_input(p2));
}
function cmp (p1, p2) {
	return endpoint.cmp(endpoint.from_input(p1), endpoint.from_input(p2));
}


/*********************************************************************
	SORTED ARRAY
*********************************************************************/

/*
	Sorted array of values.
	- Elements are sorted in ascending order.
	- No duplicates are allowed.
	- Binary search used for lookup

	values can be regular number values (float) or points [float, sign]
		>a : [a, -1] - largest value smaller than a
		a  : [a, 0]  - a
		a< : [a, +1] - smallest value larger than a
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
		let left_idx = 0;
		let right_idx = this._array.length - 1;
		while (left_idx <= right_idx) {
			const mid_idx = Math.floor((left_idx + right_idx) / 2);
			let mid_value = this._array[mid_idx];
			if (eq(mid_value, target_value)) {
				return [true, mid_idx]; // Target already exists in the array
			} else if (lt(mid_value, target_value)) {
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
			this._array.sort(cmp);
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
			itv = [-Infinity, Infinity, true, true];
		}
		let [p0, p1] = endpoint.from_interval(itv);
		let p0_idx = this.geIndexOf(p0);
		let p1_idx = this.leIndexOf(p1);
		if (p0_idx == -1 || p1_idx == -1) {
			return [];
		} else {
			return this._array.slice(p0_idx, p1_idx+1);
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
		if (sorted_arr[i] == sorted_arr[i + 1]) {
			sorted_arr.splice(i + 1, 1);
		} else {
			i += 1;
		}
	}
}

// Set of unique [value, sign] endpoints
class EndpointSet {
	constructor() {
		this._map = new Map([
			[-1, new Set()], 
			[0, new Set()], 
			[1, new Set()]
		]);
	}
	add([value, sign]) {
		return this._map.get(sign).add(value);
	}
	has ([value, sign]) {
		return this._map.get(sign).has(value);
	}
	get([value, sign]) {
		return this._map.get(sign).get(value);
	}

	list() {
		const lists = [-1, 0, 1].map((sign) => {
			return [...this._map.get(sign).values()]
				.map((val) => [val, sign]);
		});
		return [].concat(...lists);
	}
}

/**
 * ITEMS MAP
 * 
 * mapping endpoint -> [[item, status],...]
 * status: endpoint is either LOW,HIGH or COVERED for a given item.
 */


const LOW = "low";
const ACTIVE = "active";
const HIGH = "high";

class ItemsMap {

	constructor () {
		// map endpoint -> {low: [items], active: [items], high:[items]}
		this._map = new Map([
			[-1, new Map()], 
			[0, new Map()], 
			[1, new Map()]
		]);
	}

	get_items_by_role ([value, sign], role) {
		const entry = this._map.get(sign).get(value);
		return (entry != undefined) ? entry[role] : [];
	}

	/*
		register item with endpoint (idempotent)
		return true if this was the first LOW or HIGH 
	 */
	register([value, sign], item, role) {
		const sign_map = this._map.get(sign);
		if (!sign_map.has(value)) {
			sign_map.set(value, {low: [], active:[], high:[]});
		}
		const entry = sign_map.get(value);
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
	unregister([value, sign], item) {
		const sign_map = this._map.get(sign);
		const entry = sign_map.get(value);
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
				sign_map.delete(value);
				return true;
			}
		}
		return false;
	}
}


class NearbyIndex extends NearbyIndexBase {

    constructor(stateProvider) {
        super();

        if (!(is_stateprovider(stateProvider))) {
            throw new Error(`must be stateprovider ${stateProvider}`);
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
			insert_items = this.src.get_items();
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
			this._endpoints.lookup(item.itv);
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
		const ep1 = this._endpoints.le(offset) || [-Infinity, 0];
		const ep2 = this._endpoints.ge(offset) || [Infinity, 0];
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
		offset = endpoint.from_input(offset);

		// center
		let center = this._covers(offset);
		const center_high_list = [];
		const center_low_list = [];
		for (const item of center) {
			const [low, high] = endpoint.from_interval(item.itv);
			center_high_list.push(high);
			center_low_list.push(low);    
		}

		// prev high
		let prev_high = offset;
		let items;
		while (true) {
			prev_high = this._endpoints.lt(prev_high) || [-Infinity, 0];
			if (prev_high[0] == -Infinity) {
				break
			}
			items = this._itemsmap.get_items_by_role(prev_high, HIGH);
			if (items.length > 0) {
				break
			}
		}

		// next low
		let next_low = offset;
		while (true) {
			next_low = this._endpoints.gt(next_low) || [Infinity, 0];
			if (next_low[0] == Infinity) {
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

/************************************************
 * LAYER
 ************************************************/

/**
 * Layer is abstract base class for Layers
 * 
 * Layer interface is defined by (index, CacheClass, valueFunc)
 */

class Layer {

    constructor(options={}) {
        const {CacheClass=LayerCache} = options;
        const {valueFunc, stateFunc} = options;
        // callbacks
        addToInstance$1(this);
        // layer query api
        //layerquery.addToInstance(this, CacheClass, {valueFunc, stateFunc});
        // define change event
        eventifyInstance(this);
        this.eventifyDefine("change", {init:true});

        // index
        this._index;
        // cache
        this._CacheClass = CacheClass;
        this._cache_object;
        this._cache_objects = [];

        // query options
        this._queryOptions = {valueFunc, stateFunc};
    }

    // index
    get index () {return this._index}
    set index (index) {this._index = index;}

    // queryOptions
    get queryOptions () {
        return this._queryOptions;
    }

    // cache
    get cache () {
        if (this._cache_object == undefined) {
            this._cache_object = new this._CacheClass(this);
        }
        return this._cache_object;
    }

    getCache () {
        const cache = new this._CacheClass(this);
        this._cache_objects.push(cache);
        return cache;
    }

    clearCaches() {
        for (const cache of this._cache_objects){
            cache.clear();
        }
    }

    query(offset) {
        return this.cache.query(offset);
    }

    regions (options) {
        return this.index.regions(options);
    }

    /*
        Sample Layer by timeline offset increments
        return list of tuples [value, offset]
        options
        - start
        - stop
        - step
    */
    sample(options={}) {
        let {start=-Infinity, stop=Infinity, step=1} = options;
        if (start > stop) {
            throw new Error ("stop must be larger than start", start, stop)
        }
        start = [start, 0];
        stop = [stop, 0];
        start = endpoint.max(this.index.first(), start);
        stop = endpoint.min(this.index.last(), stop);
        const cache = this.getCache();
        return range(start[0], stop[0], step, {include_end:true})
            .map((offset) => {
                return [cache.query(offset).value, offset];
            });
    }
}
addToPrototype$1(Layer.prototype);
eventifyPrototype(Layer.prototype);


/************************************************
 * LAYER CACHE
 ************************************************/

/**
 * This implements a Cache to be used with Layer objects
 * Query results are obtained from the cache objects in the
 * layer index and cached only if they describe a static value. 
 */

class LayerCache {

    constructor(layer) {
        this._layer = layer;
        // cached nearby state
        this._nearby;
        // cached result
        this._state;
    }

    get src() {return this._layer};

    /**
     * query cache
     */
    query(offset) {
        const need_nearby = (
            this._nearby == undefined ||
            !interval.covers_point(this._nearby.itv, offset)
        );
        if (
            !need_nearby && 
            this._state != undefined &&
            !this._state.dynamic
        ) {
            // cache hit
            return {...this._state, offset};
        }
        // cache miss
        if (need_nearby) {
            this._nearby = this._layer.index.nearby(offset);
        }
        // perform queries
        const states = this._nearby.center.map((cache) => {
            return cache.query(offset);
        });
        const state = toState(this._nearby.center, states, offset, this._layer.queryOptions);
        // cache state only if not dynamic
        this._state = (state.dynamic) ? undefined : state;
        return state    
    }

    clear() {
        this._nearby = undefined;
        this._state = undefined;
    }
}



/*********************************************************************
    INPUT LAYER
*********************************************************************/

/**
 * Layer with a StateProvider as src
 */

class InputLayer extends Layer {

    constructor(options={}) {
        const {src, valueFunc, stateFunc} = options;
        super({CacheClass:InputLayerCache, valueFunc, stateFunc});
        // setup src propterty
        addToInstance(this);
        this.srcprop_register("src");
        // initialize
        this.src = src;
    }

    srcprop_check(propName, src) {
        if (propName == "src") {
            if (!(is_stateprovider(src))) {
                throw new Error(`"src" must be state provider ${src}`);
            }
            return src;    
        }
    }

    srcprop_onchange(propName, eArg) {
        if (propName == "src") {
            if (this.index == undefined || eArg == "reset") {
                this.index = new NearbyIndex(this.src);
            } 
            if (eArg != "reset") {
                this.index.refresh(eArg);
            }
            this.clearCaches();
            this.notify_callbacks();
            this.eventifyTrigger("change");
        }        
    }
}
addToPrototype(InputLayer.prototype);



/*********************************************************************
    INPUT LAYER CACHE
*********************************************************************/

/*
    Layer with a StateProvider uses a specific cache implementation.    

    The cache will instantiate segments corresponding to
    items in the index. 
*/

class InputLayerCache {
    constructor(layer) {
        // layer
        this._layer = layer;
        // cached nearby object
        this._nearby = undefined;
        // cached segment
        this._segment = undefined;
    }

    get src() {return this._layer};

    query(offset) {
        const cache_miss = (
            this._nearby == undefined ||
            !interval.covers_point(this._nearby.itv, offset)
        );
        if (cache_miss) {
            this._nearby = this._layer.index.nearby(offset);
            let {itv, center} = this._nearby;
            this._segments = center.map((item) => {
                return load_segment(itv, item);
            });
        }
        // query segments
        const states = this._segments.map((seg) => {
            return seg.query(offset);
        });
        return toState(this._segments, states, offset, this._layer.queryOptions)
    }

    clear() {
        this._nearby = undefined;
        this._segment = undefined;
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

/**
 * Convenience merge options
 */
const merge_options = {
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

function merge (sources, options={}) {
    const {type=""} = options;

    if (type in merge_options) {
        return new MergeLayer(sources, merge_options[type])
    } else {
        return new MergeLayer(sources, options);
    }
}


class MergeLayer extends Layer {

    constructor(sources, options) {
        super(options);

        // setup sources property
        addToInstance(this);
        this.srcprop_register("sources", {mutable:false});
        this.sources = sources;
    }

    srcprop_check(propName, sources) {
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
    }

    srcprop_onchange(propName, eArg) {
        if (propName == "sources") {
            if (this.index == undefined || eArg == "reset") {
                this.index = new MergeIndex(this.sources);
            } 
            this.clearCaches();
            this.notify_callbacks();
            this.eventifyTrigger("change");
        }
    }
}
addToPrototype(MergeLayer.prototype);



/**
 * Merging indexes from multiple sources into a single index.
 * 
 * A source is an object with an index.
 * - layer (cursor)
 * 
 * The merged index gives a temporal structure for the
 * collection of sources, computing a list of
 * sources which are defined at a given offset
 * 
 * nearby(offset).center is a list of items
 * [{itv, src}]
 * 
 * Implementaion is stateless.
 */

function cmp_ascending(p1, p2) {
    return endpoint.cmp(p1, p2)
}

function cmp_descending(p1, p2) {
    return endpoint.cmp(p2, p1)
}

class MergeIndex extends NearbyIndexBase {

    constructor(sources) {
        super();
        this._sources = sources;
        this._caches = new Map(sources.map((src) => {
            return [src, src.getCache()];
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
        const next_low = next_list[0] || [Infinity, 0];

        // find closest endpoint to the left (not in center)
        prev_list.sort(cmp_descending);
        const prev_high = prev_list[0] || [-Infinity, 0];

        return nearby_from(
                prev_high, 
                center_low_list, 
                center,
                center_high_list,
                next_low
            );
    }
}

function shifted(p, offset) {
    if (p == undefined || !isFinite(p)) {
        // p - no skew
        return p;
    }
    else if (typeof p == "number") {
        // p is number - skew
        return p + offset;
    } else if (Array.isArray(p) && p.length > 1) {
        // p is endpoint - skew value
        let [val, sign] = p;
        return [val + offset, sign];
    }
}


/*********************************************************************
    SHIFT INDEX
*********************************************************************/

class ShiftIndex extends NearbyIndexBase {

    constructor (layer, skew) {
        super();
        this._layer = layer;
        this._skew = skew;
        this._cache = layer.getCache();

        // skewing cache object
        this._shifted_cache = {
            query: function (offset) {
                // skew query (negative) - override result offset
                return {...this._cache.query(shifted(offset, -this._skew)), offset};
            }.bind(this)
        };
    }

    // skewing index.nearby
    nearby(offset) {
        offset = endpoint.from_input(offset);
        // skew query (negative)
        const nearby = this._layer.index.nearby(shifted(offset, -this._skew));
        // skew result (positive) 
        const itv = nearby.itv.slice();
        itv[0] = shifted(nearby.itv[0], this._skew);
        itv[1] = shifted(nearby.itv[1], this._skew);
        return {
            itv,
            left: shifted(nearby.left, this._skew),
            right: shifted(nearby.right, this._skew),
            center: nearby.center.map(() => this._shifted_cache)
        }
    }
}


/*********************************************************************
    SHIFT LAYER
*********************************************************************/


class ShiftLayer extends Layer {

    constructor(layer, skew, options={}) {
        super(options);
        this._skew = skew;
        // setup src propterty
        addToInstance(this);
        this.srcprop_register("src");
        this.src = layer;
    }

    srcprop_check(propName, src) {
        if (propName == "src") {
            if (!(src instanceof Layer)) {
                throw new Error(`"src" must be Layer ${src}`);
            }
            return src;    
        }
    }

    srcprop_onchange(propName, eArg) {
        if (propName == "src") {
            if (this.index == undefined || eArg == "reset") {
                this.index = new ShiftIndex(this.src, this._skew);
            } 
            this.clearCaches();
            this.notify_callbacks();
            this.eventifyTrigger("change");    
        }
    }
}
addToPrototype(ShiftLayer.prototype);

/**
 * Skewing a Layer by an offset
 * 
 * a positive value for offset means that
 * the layer is shifted to the right on the timeline
 * 
 * 
 */

function shift (layer, offset) {
    return new ShiftLayer(layer, offset);
}

// webpage clock - performance now - seconds
const local = {
    now: function() {
        return performance.now()/1000.0;
    }
};
// system clock - epoch - seconds
const epoch = {
    now: function() {
        return new Date()/1000.0;
    }
};

/**
 * CLOCK gives epoch values, but is implemented
 * using performance now for better
 * time resolution and protection against system 
 * time adjustments.
 */

const LOCAL_CLOCK_PROVIDER = function () {
    const t0_local = local.now();
    const t0_epoch = epoch.now();
    return {
        now: function () {
            const t1_local = local.now();
            return t0_epoch + (t1_local - t0_local);
        }
    };
}();

function is_clockprovider(obj) {
    return (
        ("now" in obj) && typeof (obj.now == "function")
    )
}

const METHODS = {assign, move, transition, interpolate};


function cmd (target) {
    if (!(is_stateprovider(target))) {
        throw new Error(`target.src must be stateprovider ${target}`);
    }
    let entries = Object.entries(METHODS)
        .map(([name, method]) => {
            return [
                name,
                function(...args) { 
                    let items = method.call(this, ...args);
                    return target.update({insert:items, reset:true});  
                }
            ]
        });
    return Object.fromEntries(entries);
}

function assign(value) {
    if (value == undefined) {
        return [];
    } else {
        let item = {
            itv: [-Infinity, Infinity, true, true],
            type: "static",
            data: value                 
        };
        return [item];
    }
}

function move(vector) {
    let item = {
        itv: [-Infinity, Infinity, true, true],
        type: "motion",
        data: vector  
    };
    return [item];
}

function transition(v0, v1, t0, t1, easing) {
    let items = [
        {
            itv: [-Infinity, t0, true, false],
            type: "static",
            data: v0
        },
        {
            itv: [t0, t1, true, false],
            type: "transition",
            data: {v0, v1, t0, t1, easing}
        },
        {
            itv: [t1, Infinity, true, true],
            type: "static",
            data: v1
        }
    ];
    return items;
}

function interpolate(tuples) {
    let [v0, t0] = tuples[0];
    let [v1, t1] = tuples[tuples.length-1];

    let items = [
        {
            itv: [-Infinity, t0, true, false],
            type: "static",
            data: v0
        },
        {
            itv: [t0, t1, true, false],
            type: "interpolation",
            data: tuples
        },
        {
            itv: [t1, Infinity, true, true],
            type: "static",
            data: v1
        }
    ];    
    return items;
}

/*
    Timeout Monitor

    Timeout Monitor is similar to setInterval, in the sense that 
    it allows callbacks to be fired periodically 
    with a given delay (in millis).  
    
    Timeout Monitor is made to sample the state 
    of a dynamic object, periodically. For this reason, each callback is 
    bound to a monitored object, which we here call a variable. 
    On each invocation, a callback will provide a freshly sampled 
    value from the variable.

    This value is assumed to be available by querying the variable. 

        v.query() -> {value, dynamic, offset, ts}

    In addition, the variable object may switch back and 
    forth between dynamic and static behavior. The Timeout Monitor
    turns polling off when the variable is no longer dynamic, 
    and resumes polling when the object becomes dynamic.

    State changes are expected to be signalled through a <change> event.

        sub = v.on("change", callback)
        v.off(sub)

    Callbacks are invoked on every <change> event, as well
    as periodically when the object is in <dynamic> state.

        callback({value, dynamic, offset, ts})

    Furthermore, in order to support consistent rendering of
    state changes from many dynamic variables, it is important that
    callbacks are invoked at the same time as much as possible, so
    that changes that occur near in time can be part of the same
    screen refresh. 

    For this reason, the TimeoutMonitor groups callbacks in time
    and invokes callbacks at at fixed maximum rate (20Hz/50ms).
    This implies that polling callbacks will fall on a shared 
    polling frequency.

    At the same time, callbacks may have individual frequencies that
    are much lower rate than the maximum rate. The implementation
    does not rely on a fixed 50ms timeout frequency, but is timeout based,
    thus there is no processing or timeout between callbacks, even
    if all callbacks have low rates.

    It is safe to define multiple callabacks for a single variable, each
    callback with a different polling frequency.

    options
        <rate> - default 50: specify minimum frequency in ms

*/


const RATE_MS = 50;


/*********************************************************************
    TIMEOUT MONITOR
*********************************************************************/

/*
    Base class for Timeout Monitor and Framerate Monitor
*/

class TimeoutMonitor {

    constructor(options={}) {

        this._options = Object.assign({rate: RATE_MS}, options);
        if (this._options.rate < RATE_MS) {
            throw new Error(`illegal rate ${rate}, minimum rate is ${RATE_MS}`);
        }
        /*
            map
            handle -> {callback, variable, delay}
            - variable: target for sampling
            - callback: function(value)
            - delay: between samples (when variable is dynamic)
        */
        this._set = new Set();
        /*
            variable map
            variable -> {sub, polling, handles:[]}
            - sub associated with variable
            - polling: true if variable needs polling
            - handles: list of handles associated with variable
        */
        this._variable_map = new Map();
        // variable change handler
        this.__onvariablechange = this._onvariablechange.bind(this);
    }

    bind(variable, callback, delay, options={}) {
        // register binding
        let handle = {callback, variable, delay};
        this._set.add(handle);
        // register variable
        if (!this._variable_map.has(variable)) {
            let sub = variable.on("change", this.__onvariablechange);
            let item = {sub, polling:false, handles: [handle]};
            this._variable_map.set(variable, item);
            //this._reevaluate_polling(variable);
        } else {
            this._variable_map.get(variable).handles.push(handle);
        }
        return handle;
    }

    release(handle) {
        // cleanup
        let removed = this._set.delete(handle);
        if (!removed) return;
        handle.tid = undefined;
        // cleanup variable map
        let variable = handle.variable;
        let {sub, handles} = this._variable_map.get(variable);
        let idx = handles.indexOf(handle);
        if (idx > -1) {
            handles.splice(idx, 1);
        }
        if (handles.length == 0) {
            // variable has no handles
            // cleanup variable map
            this._variable_map.delete(variable);
            variable.off(sub);
        }
    }

    /*
        variable emits a change event
    */
    _onvariablechange (eArg, eInfo) {
        let variable = eInfo.src;
        // direct callback - could use eArg here
        let {handles} = this._variable_map.get(variable);
        let state = eArg;
        // reevaluate polling
        this._reevaluate_polling(variable, state);
        // callbacks
        for (let handle of handles) {
            handle.callback(state);
        }
    }

    /*
        start or stop polling if needed
    */
    _reevaluate_polling(variable, state) {
        let item = this._variable_map.get(variable);
        let {polling:was_polling} = item;
        state = state || variable.query();
        let should_be_polling = state.dynamic;
        if (!was_polling && should_be_polling) {
            item.polling = true;
            this._set_timeouts(variable);
        } else if (was_polling && !should_be_polling) {
            item.polling = false;
            this._clear_timeouts(variable);
        }
    }

    /*
        set timeout for all callbacks associated with variable
    */
    _set_timeouts(variable) {
        let {handles} = this._variable_map.get(variable);
        for (let handle of handles) {
            this._set_timeout(handle);
        }
    }

    _set_timeout(handle) {
        let delta = this._calculate_delta(handle.delay);
        let handler = function () {
            this._handle_timeout(handle);
        }.bind(this);
        handle.tid = setTimeout(handler, delta);
    }

    /*
        adjust delay so that if falls on
        the main tick rate
    */
    _calculate_delta(delay) {
        let rate = this._options.rate;
        let now = Math.round(performance.now());
        let [now_n, now_r] = divmod(now, rate);
        let [n, r] = divmod(now + delay, rate);
        let target = Math.max(n, now_n + 1)*rate;
        return target - performance.now();
    }

    /*
        clear all timeouts associated with variable
    */
    _clear_timeouts(variable) {
        let {handles} = this._variable_map.get(variable);
        for (let handle of handles) {
            if (handle.tid != undefined) {
                clearTimeout(handle.tid);
                handle.tid = undefined;
            }
        }
    }

    /*
        handle timeout
    */
    _handle_timeout(handle) {
        // drop if handle tid has been cleared
        if (handle.tid == undefined) return;
        handle.tid = undefined;
        // callback
        let {variable} = handle;
        let state = variable.query();
        // reschedule timeouts for callbacks
        if (state.dynamic) {
            this._set_timeout(handle);
        } else {
            /*
                make sure polling state is also false
                this would only occur if the variable
                went from reporting dynamic true to dynamic false,
                without emmitting a change event - thus
                violating the assumption. This preserves
                internal integrity i the monitor.
            */
            let item = this._variable_map.get(variable);
            item.polling = false;
        }
        //
        handle.callback(state);
    }
}



/*********************************************************************
    FRAMERATE MONITOR
*********************************************************************/


class FramerateMonitor extends TimeoutMonitor {

    constructor(options={}) {
        super(options);
        this._handle;
    }

    /*
        timeouts are obsolete
    */
    _set_timeouts(variable) {}
    _set_timeout(handle) {}
    _calculate_delta(delay) {}
    _clear_timeouts(variable) {}
    _handle_timeout(handle) {}

    _onvariablechange (eArg, eInfo) {
        super._onvariablechange(eArg, eInfo);
        // kick off callback loop driven by request animationframe
        this._callback();
    }

    _callback() {
        // callback to all variables which require polling
        let variables = [...this._variable_map.entries()]
            .filter(([variable, item]) => item.polling)
            .map(([variable, item]) => variable);
        if (variables.length > 0) {
            // callback
            for (let variable of variables) {
                let {handles} = this._variable_map.get(variable);
                let res = variable.query();
                for (let handle of handles) {
                    handle.callback(res);
                }
            }
            /* 
                request next callback as long as at least one variable 
                is requiring polling
            */
            this._handle = requestAnimationFrame(this._callback.bind(this));
        }
    }
}


/*********************************************************************
    BIND RELEASE
*********************************************************************/

const monitor = new TimeoutMonitor();
const framerate_monitor = new FramerateMonitor();

function bind(variable, callback, delay, options={}) {
    let handle;
    if (Boolean(parseFloat(delay))) {
        handle = monitor.bind(variable, callback, delay, options);
        return ["timeout", handle];
    } else {
        handle = framerate_monitor.bind(variable, callback, 0, options);
        return ["framerate", handle];
    }
}
function release(handle) {
    let [type, _handle] = handle;
    if (type == "timeout") {
        return monitor.release(_handle);
    } else if (type == "framerate") {
        return framerate_monitor.release(_handle);
    }
}

/**
 * Cursor emulates Layer interface.
 * Part of this is to prove an index for the timeline. 
 * However, when considered as a layer, the cursor value is 
 * independent of timeline offset, which is to say that
 * it has the same value for all timeline offsets.
 * 
 * Unlike other Layers, the Cursor do not actually
 * use this index to resolve queries. It is only needed
 * for some generic Layer functionnality, like sampling,
 * which uses index.first() and index.last().
 */

class CursorIndex extends NearbyIndexBase {

    constructor(cursor) {
        super();
        this._cache = cursor.getCache();
    }

    nearby(offset) {
        // cursor index is defined for entire timeline
        return {
            itv: [-Infinity, Infinity, true, true],
            center: [this._cache],
            left: [-Infinity, 0],
            prev: [-Infinity, 0],
            right: [Infinity, 0],
            next: [Infinity, 0],
        }
    }
}

/**
 * 
 * Cursor cache implements the query operation for 
 * the Cursor, ignoring the given offset, replacing it 
 * with an offset from the ctrl instead. 
 * The layer cache is used to resolve the query 
 */

class CursorCache {
    constructor(cursor) {
        this._cursor = cursor;
        this._cache = this._cursor.src.getCache();
    }

    query() {
        const offset = this._cursor._get_ctrl_state().value; 
        return this._cache.query(offset);
    }

    clear() {
        this._cache.clear();
    }
}


/************************************************
 * CURSOR
 ************************************************/

/**
 * 
 * Cursor glides along a layer and exposes the current layer
 * value at any time
 * - has mutable ctrl (localClockProvider or Cursor)
 * - has mutable src (layer)
 * - methods for assign, move, transition, interpolation
 */

class Cursor extends Layer {

    constructor (options={}) {
        super({CacheClass:CursorCache});

        // setup src properties
        addToInstance(this);
        this.srcprop_register("src");
        this.srcprop_register("ctrl");

        // timeout
        this._tid;
        // polling
        this._pid;

        // initialise ctrl, src
        let {src, ctrl} = options;
        this.ctrl = ctrl || LOCAL_CLOCK_PROVIDER;
        this.src = src;
    }

    /**********************************************************
     * SRCPROP: CTRL and SRC
     **********************************************************/

    srcprop_check(propName, obj) {
        if (propName == "ctrl") {
            if (!(is_clockprovider(obj) || obj instanceof Cursor)) {
                throw new Error(`"ctrl" must be clockProvider or Cursor ${obj}`)
            }
        } else if (propName == "src") {
            if (!(obj instanceof Layer)) {
                throw new Error(`"src" must be Layer ${obj}`);
            }
        }
        return obj;
    }

    srcprop_onchange(propName, eArg) {
        this.__handle_change(propName, eArg);
    }

    /**********************************************************
     * CALLBACK
     **********************************************************/

    __handle_change(origin, eArg) {
        clearTimeout(this._tid);
        clearInterval(this._pid);
        if (this.src && this.ctrl) {
            if (this.index == undefined || eArg == "reset") {
                // NOT used for cursor query 
                this.index = new CursorIndex(this);
            }
            this.clearCaches();
            this.notify_callbacks();
            // trigger change event for cursor
            this.eventifyTrigger("change", this.query());
            // detect future change event - if needed
            this.__detect_future_change();
        }
    }

    /**
     * DETECT FUTURE CHANGE
     * 
     * PROBLEM:
     * 
     * During playback (cursor.ctrl is dynamic), there is a need to 
     * detect the passing from one segment interval of src
     * to the next - ideally at precisely the correct time
     * 
     * nearby.itv (derived from cursor.src) gives the 
     * interval (i) we are currently in, i.e., 
     * containing the current offset (value of cursor.ctrl), 
     * and (ii) where nearby.center stays constant
     * 
     * The event that needs to be detected is therefore the
     * moment when we leave this interval, through either
     * the low or high interval endpoint
     * 
     * GOAL:
     * 
     * At this moment, we simply need to reevaluate the state (query) and
     * emit a change event to notify observers. 
     * 
     * APPROACHES:
     * 
     * Approach [0] 
     * The trivial solution is to do nothing, in which case
     * observers will simply find out themselves according to their 
     * own poll frequency. This is suboptimal, particularly for low frequency 
     * observers. If there is at least one high-frequency poller, 
     * this would trigger trigger the state change, causing all
     * observers to be notified. The problem though, is if no observers
     * are actively polling, but only depending on change events.
     * 
     * Approach [1] 
     * In cases where the ctrl is deterministic, a timeout
     * can be calculated. This is trivial if ctrl is a ClockProvider, and
     * it is fairly easy if the ctrl is Cursor representing motion
     * or linear transition. However, calculations can become more
     * complex if motion supports acceleration, or if transitions
     * are set up with non-linear easing.
     *   
     * Note, however, that these calculations assume that the cursor.ctrl is 
     * a ClockProvider, or that cursor.ctrl.ctrl is a ClockProider. 
     * In principle, though, there could be a recursive chain of cursors,
     * (cursor.ctrl.ctrl....ctrl) of some length, where only the last is a 
     * ClockProvider. In order to do deterministic calculations in the general
     * case, all cursors in the chain would have to be limited to 
     * deterministic linear transformations.
     * 
     * Approch [2] 
     * It might also be possible to sample future values of 
     * cursor.ctrl to see if the values violate the nearby.itv at some point. 
     * This would essentially be treating ctrl as a layer and sampling 
     * future values. This approch would work for all types, 
     * but there is no knowing how far into the future one 
     * would have to seek. However, again - as in [1] the ability to sample future values
     * is predicated on cursor.ctrl being a ClockProvider. Also, there 
     * is no way of knowing how long into the future sampling would be necessary.
     * 
     * Approach [3] 
     * In the general case, the only way to reliabley detect the event is through repeated
     * polling. Approach [3] is simply the idea that this polling is performed
     * internally by the cursor itself, as a way of securing its own consistent
     * state, and ensuring that observer get change events in a timely manner, event
     * if they do low-frequency polling, or do not do polling at all. 
     * 
     * SOLUTION:
     * As there is no perfect solution in the general case, we opportunistically
     * use approach [1] when this is possible. If not, we are falling back on 
     * approach [3]
     * 
     * CONDITIONS when NO event detection is needed (NOOP)
     * (i) cursor.ctrl is not dynamic
     * or
     * (ii) nearby.itv stretches into infinity in both directions
     * 
     * CONDITIONS when approach [1] can be used
     * 
     * (i) if ctrl is a ClockProvider && nearby.itv.high < Infinity
     * or
     * (ii) ctrl.ctrl is a ClockProvider
     *      (a) ctrl.nearby.center has exactly 1 item
     *      &&
     *      (b) ctrl.nearby.center[0].type == ("motion") || ("transition" && easing=="linear")
     *      &&
     *      (c) ctrl.nearby.center[0].data.velocity != 0.0
     *      && 
     *      (d) future intersecton point with cache.nearby.itv 
     *          is not -Infinity or Infinity
     * 
     * Though it seems complex, conditions for [1] should be met for common cases involving
     * playback. Also, use of transition etc might be rare.
     * 
     */

    __detect_future_change() {

        // ctrl 
        const ctrl_vector = this._get_ctrl_state();
        const {value:current_pos, offset:current_ts} = ctrl_vector;

        // ctrl must be dynamic
        if (!ctrl_vector.dynamic) {
            // no future event to detect
            return;
        }

        // get nearby from src - use value from ctrl
        const src_nearby = this.src.index.nearby(current_pos);
        const [low, high] = src_nearby.itv.slice(0,2);

        // approach [1]
        if (is_clockprovider(this.ctrl)) {
            if (isFinite(high)) {
                this.__set_timeout(high, current_pos, 1.0, current_ts);
                return;
            }
            // no future event to detect
            return;
        } 
        if (is_clockprovider(this.ctrl.ctrl)) {
            /** 
             * this.ctrl 
             * 
             * has many possible behaviors
             * this.ctrl has an index use this to figure out which
             * behaviour is current.
             * 
            */
            // use the same offset that was used in the ctrl.query
            const ctrl_nearby = this.ctrl.index.nearby(current_ts);

            if (!isFinite(low) && !isFinite(high)) {
                // no future event to detect
                return;
            }
            if (ctrl_nearby.center.length == 1) {
                const ctrl_item = ctrl_nearby.center[0];
                if (ctrl_item.type == "motion") {
                    const {velocity, acceleration=0.0} = ctrl_item.data;
                    if (acceleration == 0.0) {
                        // figure out which boundary we hit first
                        let target_pos = (velocity > 0) ? high : low;
                        if (isFinite(target_pos)) {
                            this.__set_timeout(target_pos, current_pos, velocity, current_ts);
                            return;                           
                        } 
                        // no future event to detect
                        return;
                    }
                    // acceleration - possible event to detect
                } else if (ctrl_item.type == "transition") {
                    const {v0:p0, v1:p1, t0, t1, easing="linear"} = ctrl_item.data;
                    if (easing == "linear") {
                        // linear transtion
                        let velocity = (p1-p0)/(t1-t0);
                        // figure out which boundary we hit first
                        const target_pos = (velocity > 0) ? Math.min(high, p1) : Math.max(low, p1);
                        this.__set_timeout(target_pos, current_pos, 
                            velocity, current_ts);
                        //
                        return;
                    }
                    // other easing - possible event to detect
                }
                // other type (interpolation) - possible event to detect
            }
            // more than one segment - possible event to detect
        }

        // possible event to detect - approach [3]
        this.__set_polling(src_nearby.itv);
    }

    /**
     * set timeout
     * - protects against too early callbacks by rescheduling
     * timeout if neccessary.
     * - adds a millisecond to original timeout to avoid
     * frequent rescheduling 
     */

    __set_timeout(target_pos, current_pos, velocity, current_ts) {
        const delta_sec = (target_pos - current_pos) / velocity;
        const target_ts = current_ts + delta_sec;
        this._tid = setTimeout(() => {
            this.__handle_timeout(target_ts);
        }, delta_sec*1000 + 1);
    }

    __handle_timeout(target_ts) {
        const ts = this._get_ctrl_state().offset;
        const remaining_sec = target_ts - ts; 
        if (remaining_sec <= 0) {
            // done
            this.__handle_change("timeout");
        } else {
            // reschedule timeout
            this._tid = setTimeout(() => {
                this.__handle_timeout(target_ts);
            }, remaining_sec*1000);
        }
    }

    /**
     * set polling
     */

    __set_polling(itv) {
        this._pid = setInterval(() => {
            this.__handle_poll(itv);
        }, 100);
    }

    __handle_poll(itv) {
        let offset = this.query().value;
        if (!interval.covers_point(itv, offset)) {
            this.__handle_change("timeout");
        }
    }

    /**********************************************************
     * QUERY API
     **********************************************************/

    _get_ctrl_state () {
        if (is_clockprovider(this.ctrl)) {
            let ts = this.ctrl.now();
            return {value:ts, dynamic:true, offset:ts};
        } else {
            let state = this.ctrl.query();
            // protect against non-float values
            if (typeof state.value !== 'number') {
                throw new Error(`warning: ctrl state must be number ${state.value}`);
            }
            return state;
        }
    }

    get value () {return this.query().value};
    
    /*
        Eventify: immediate events
    */
    eventifyInitEventArgs(name) {
        if (name == "change") {
            return [this.query()];
        }
    }
    
    /**********************************************************
     * BIND RELEASE (convenience)
     **********************************************************/

    bind(callback, delay, options={}) {
        return bind(this, callback, delay, options);
    }
    release(handle) {
        return release(handle);
    }

    /**********************************************************
     * UPDATE API
     **********************************************************/

    assign(value) {
        return cmd(this.src.src).assign(value);
    }
    move ({position, velocity}) {
        let {value, offset:timestamp} = this.query();
        if (typeof value !== 'number') {
            throw new Error(`warning: cursor state must be number ${value}`);
        }
        position = (position != undefined) ? position : value;
        velocity = (velocity != undefined) ? velocity: 0;
        return cmd(this.src.src).move({position, velocity, timestamp});
    }
    transition ({target, duration, easing}) {
        let {value:v0, offset:t0} = this.query();
        if (typeof v0 !== 'number') {
            throw new Error(`warning: cursor state must be number ${v0}`);
        }
        return cmd(this.src.src).transition(v0, target, t0, t0 + duration, easing);
    }
    interpolate ({tuples, duration}) {
        let t0 = this.query().offset;
        // assuming timstamps are in range [0,1]
        // scale timestamps to duration
        tuples = tuples.map(([v,t]) => {
            return [v, t0 + t*duration];
        });
        return cmd(this.src.src).interpolate(tuples);
    }

}
addToPrototype(Cursor.prototype);
addToPrototype(Cursor.prototype);

class BooleanLayer extends Layer {

    constructor(layer) {
        super();
        this.index = new BooleanIndex(layer.index);
    
        // subscribe
        const handler = this._onchange.bind(this);
        layer.add_callback(handler);
    }

    _onchange(eArg) {
        this.clearCaches();
        this.notify_callbacks();
        this.eventifyTrigger("change");
    }
}

function boolean(layer) {
    return new BooleanLayer(layer);
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

class BooleanIndex extends NearbyIndexBase {

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
        left = left || [-Infinity, 0];
        right = right || [Infinity, 0];
        const low = endpoint.flip(left, "low");
        const high = endpoint.flip(right, "high");
        return {
            itv: interval.from_endpoints(low, high),
            center : [queryObject(evaluation)],
            left,
            right,
        }
    }
}

class LogicalMergeLayer extends Layer {

    constructor(sources, options={}) {
        super();

        const {expr} = options;

        let condition;
        if (expr) {
            condition = (center) => {
                return expr.eval(center);
            };    
        }
                    
        // subscribe to callbacks from sources
        const handler = this._onchange.bind(this);
        for (let src of sources) {
            src.add_callback(handler);
        }

        // index
        let index = new MergeIndex(sources);
        this._index = new BooleanIndex(index, {condition});
    }

    get index () {return this._index};

    _onchange(eArg) {
        this.clearCaches();
        this.notify_callbacks();
        this.eventifyTrigger("change");
    }
}


function logical_merge(sources, options) {
    return new LogicalMergeLayer(sources, options);
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

/*********************************************************************
    LAYER FACTORY
*********************************************************************/

function layer(options={}) {
    let {src, ...opts} = options;
    if (src instanceof Layer) {
        return src;
    } 
    if (src == undefined) {
        src = new LocalStateProvider(opts);
    }
    return new InputLayer({src, ...opts}); 
}

/*********************************************************************
    CURSOR FACTORIES
*********************************************************************/

function cursor(options={}) {
    const {ctrl, ...opts} = options;
    const src = layer(opts);    
    return new Cursor({ctrl, src});
}

export { boolean, cmd, cursor, layer, logical_expr, logical_merge, merge, cursor as playback, shift, cursor as variable };
