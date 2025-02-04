
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
/*
    This decorates an object/prototype with basic (synchronous) callback support.
*/

const PREFIX$2 = "__callback";

function addToInstance$2(object) {
    object[`${PREFIX$2}_handlers`] = [];
}

function add_callback (handler) {
    let handle = {
        handler: handler
    };
    this[`${PREFIX$2}_handlers`].push(handle);
    return handle;
}
function remove_callback (handle) {
    let index = this[`${PREFIX$2}_handlers`].indexof(handle);
    if (index > -1) {
        this[`${PREFIX$2}_handlers`].splice(index, 1);
    }
}
function notify_callbacks (eArg) {
    this[`${PREFIX$2}_handlers`].forEach(function(handle) {
        handle.handler(eArg);
    });
}

function addToPrototype$2 (_prototype) {
    const api = {
        add_callback, remove_callback, notify_callbacks
    };
    Object.assign(_prototype, api);
}

/************************************************
 * CLOCK PROVIDER BASE
 ************************************************/

/**
 * Base class for ClockProviders
 * 
 * Clock Providers implement the callback
 * interface to be compatible with other state
 * providers, even though they are not required to
 * provide any callbacks after clock adjustments
 */

class ClockProviderBase {
    constructor() {
        addToInstance$2(this);
    }
    now () {
        throw new Error("not implemented");
    }
}
addToPrototype$2(ClockProviderBase.prototype);


/**
 * Base class for MotionProviders
 * 
 * This is a convenience class offering a simpler way
 * of implementing state provider which deal exclusively
 * with motion segments.
 * 
 * Motionproviders do not deal with items, but with simpler
 * statements of motion state
 * 
 * state = {
 *      position: 0,
 *      velocity: 0,
 *      acceleration: 0,
 *      timestamp: 0
 *      range: [undefined, undefined]
 * }
 * 
 * Internally, MotionProvider will be wrapped so that they
 * become proper StateProviders.
 */

class MotionProviderBase {

    constructor(options={}) {
        addToInstance$2(this);
        let {state} = options;
        if (state = undefined) {
            this._state = {
                position: 0,
                velocity: 0,
                acceleration: 0,
                timestamp: 0,
                range: [undefined, undefined]
            };
        } else {
            this._state = state;
        }
    }

    /**
     * set motion state
     * 
     * implementations of online motion providers will
     * use this to send an update request,
     * and set _state on response and then call notify_callbaks
     * If the proxy wants to set the state immediatedly - 
     * it should be done using a Promise - to break the control flow.
     * 
     * return Promise.resolve()
     *      .then(() => {
     *           this._state = state;
     *           this.notify_callbacks();
     *       });
     * 
     */
    set_state (state) {
        throw new Error("not implemented");
    }

    // return current motion state
    get_state () {
        return {...this._state};
    }
}
addToPrototype$2(MotionProviderBase.prototype);




/************************************************
 * STATE PROVIDER BASE
 ************************************************/

/*
    Base class for StateProviders

    - collection of items
    - {key, itv, type, data}
*/

class StateProviderBase {

    constructor() {
        addToInstance$2(this);
    }

    /**
     * update function
     * 
     * If ItemsProvider is a proxy to an online
     * Items collection, update requests will 
     * imply a network request
     * 
     * options - support reset flag 
     */
    update(items, options={}){
        throw new Error("not implemented");
    }

    /**
     * return array with all items in collection 
     * - no requirement wrt order
     */

    get_items() {
        throw new Error("not implemented");
    }

    /**
     * signal if items can be overlapping or not
     */

    get info () {
        return {overlapping: true};
    }
}
addToPrototype$2(StateProviderBase.prototype);

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
    from_interval: endpoints_from_interval
};
const interval = {
    covers_endpoint: interval_covers_endpoint,
    covers_point: interval_covers_point, 
    is_singular: interval_is_singular,
    from_endpoints: interval_from_endpoints,
    from_input: interval_from_input
};

/***************************************************************
    LOCAL STATE PROVIDER
***************************************************************/

/**
 * Local Array with non-overlapping items.
 */

class LocalStateProvider extends StateProviderBase {

    constructor(options={}) {
        super();
        // initialization
        let {items, value} = options;
        if (items != undefined) {
            // initialize from items
            this._items = check_input(items);
        } else if (value != undefined) {
            // initialize from value
            this._items = [{
                itv:[-Infinity, Infinity, true, true], 
                type: "static",
                data:value
            }];
        } else {
            this._items = [];
        }
    }

    update (items, options) {
        return Promise.resolve()
            .then(() => {
                this._items = check_input(items);
                this.notify_callbacks();
            });
    }

    get_items () {
        return this._items.slice();
    }

    get info () {
        return {overlapping: false};
    }
}


function check_input(items) {
    if (!Array.isArray(items)) {
        throw new Error("Input must be an array");
    }
    // sort items based on interval low endpoint
    items.sort((a, b) => {
        let a_low = endpoint.from_interval(a.itv)[0];
        let b_low = endpoint.from_interval(b.itv)[0];
        return endpoint.cmp(a_low, b_low);
    });
    // check that item intervals are non-overlapping
    for (let i = 1; i < items.length; i++) {
        let prev_high = endpoint.from_interval(items[i - 1].itv)[1];
        let curr_low = endpoint.from_interval(items[i].itv)[0];
        // verify that prev high is less that curr low
        if (!endpoint.lt(prev_high, curr_low)) {
            throw new Error("Overlapping intervals found");
        }
    }
    return items;
}

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
        let limit = 5;
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
 * LAYER QUERY INTERFACE
 ************************************************/

/**
 * Decorate an object/prototype of a Layer to implement 
 * the LayerQuery interface.
 * 
 * The layer query interface implements a query
 * mechanism for layers, with built-in caching
 * 
 * Example use
 * cache = object.getCache() 
 * cache.query();
 * 
 * - clearCaches is for internal use
 * - index is the actual target of of the query
 * - queryOptions specializes the query output
 * 
 * 
 * NOTE - this might be part of the BaseLayer class instead.
 */

const PREFIX$1 = "__layerquery";

function addToInstance$1 (object, CacheClass, queryOptions) {
    object[`${PREFIX$1}_index`];
    object[`${PREFIX$1}_queryOptions`] = queryOptions;
    object[`${PREFIX$1}_cacheClass`] = CacheClass;
    object[`${PREFIX$1}_cacheObject`] = new CacheClass(object);
    object[`${PREFIX$1}_cacheObjects`] = [];
}

function addToPrototype$1 (_prototype) {

    Object.defineProperty(_prototype, "index", {
        get: function () {
            return this[`${PREFIX$1}_index`];
        },
        set: function (index) {
            this[`${PREFIX$1}_index`] = index;
        }
    });
    Object.defineProperty(_prototype, "queryOptions", {
        get: function () {
            return this[`${PREFIX$1}_queryOptions`];
        }
    });

    function getCache () {
        let CacheClass = this[`${PREFIX$1}_cacheClass`];
        const cache = new CacheClass(this);
        this[`${PREFIX$1}_cacheObjects`].push(cache);
        return cache;
    }

    function clearCaches () {
        this[`${PREFIX$1}_cacheObject`].clear();
        for (let cache of this[`${PREFIX$1}_cacheObjects`]) {
            cache.clear();
        }
    }

    function query (offset) {
        return this[`${PREFIX$1}_cacheObject`].query(offset);
    }

    
    Object.assign(_prototype, {getCache, clearCaches, query});
}

/************************************************
 * SOURCE PROPERTY (SRCPROP)
 ************************************************/

/**
 * Functions for extending a class with support for 
 * external source on a named property.
 * 
 * option: mutable:true means that propery may be reset 
 * 
 * source object is assumed to support the callback interface
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
            handle: undefined,
            src: undefined,
            mutable
        });

        // register getters and setters
        if (mutable) {
            // getter and setter
            Object.defineProperty(this, propName, {
                get: function () {
                    return map.get(propName).src;
                },
                set: function (src) {
                    if (this.propCheck) {
                        src = this.propCheck(propName, src);
                    }
                    if (src != map.get(propName).src) {
                        this[`${PREFIX}_attach`](propName, src);
                    }
                }
            });
        } else {
            // only getter
            Object.defineProperty(this, propName, {
                get: function () {
                    return m.get(propName).src;
                }
            });
        }
    }

    function attatch(propName, src) {
        const map = this[`${PREFIX}`];
        const state = map.get(propName);

        if (state.init && !state.mutable) {
            throw new Error(`${propName} can not be reassigned`);
        }

        // unsubscribe from source change event
        if (state.src) {
            state.src.remove_callback(state.handle);
            state.src = undefined;
            state.handle = undefined;
        }

        // attatch new src
        state.src = src;
        state.init = true;

        // subscribe to callback from source
        if (this.propChange) {
            const handler = function (eArg) {
                this.propChange(propName, eArg);
            }.bind(this);
            state.handle = src.add_callback(handler);
            this.propChange(propName, "reset"); 
        }
    }

    const api = {};
    api[`${NAME}Register`] = register;
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

/***************************************************************
    CLOCKS
***************************************************************/

/**
 * clocks counting in seconds
 */

const local = function () {
    return performance.now()/1000.0;
};

const epoch = function () {
    return new Date()/1000.0;
};

/**
 * the clock gives epoch values, but is implemented
 * using a high performance local clock for better
 * time resolution and protection against system 
 * time adjustments.
 */

(function () {
    const t0_local = local();
    const t0_epoch = epoch();
    return {
        now: function () {
            return t0_epoch + (local() - t0_local)
        }
    }
})();


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


class NearbyIndexSimple extends NearbyIndexBase {

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
        if (typeof offset === 'number') {
            offset = [offset, 0];
        }
        if (!Array.isArray(offset)) {
            throw new Error("Endpoint must be an array");
        }
        const result = {
            center: [],
            itv: [-Infinity, Infinity, true, true],
            left: undefined,
            right: undefined,
            prev: undefined,
            next: undefined
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
            item = items[idx];
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
        let low, high;
        if (result.center.length > 0) {
            let itv = result.center[0].itv;
            [low, high] = endpoint.from_interval(itv);
            result.left = (low[0] > -Infinity) ? endpoint.flip(low, "high") : undefined;
            result.right = (high[0] < Infinity) ? endpoint.flip(high, "low") : undefined;
            result.itv = result.center[0].itv;
        } else {
            result.left = result.prev;
            result.right = result.next;
            // interval
            let left = result.left;
            low = (left == undefined) ? [-Infinity, 0] : endpoint.flip(left, "low");
            let right = result.right;
            high = (right == undefined) ? [Infinity, 0] : endpoint.flip(right, "high");
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
        addToInstance$2(this);
        // layer query api
        addToInstance$1(this, CacheClass, {valueFunc, stateFunc});
        // define change event
        eventifyInstance(this);
        this.eventifyDefine("change", {init:true});
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
addToPrototype$2(Layer.prototype);
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
        this._itv = undefined;
        this._state = undefined;
    }
}



/*********************************************************************
    STATE LAYER
*********************************************************************/

/**
 * Layer with a StateProvider as src
 */

class StateLayer extends Layer {

    constructor(options={}) {
        const {queryFuncs} = options;
        super({queryFuncs, CacheClass:StateLayerCache});
        // setup src propterty
        addToInstance(this);
        this.srcpropRegister("src");
    }

    propCheck(propName, src) {
        if (propName == "src") {
            if (!(src instanceof StateProviderBase)) {
                throw new Error(`"src" must be state provider ${src}`);
            }
            return src;    
        }
    }

    propChange(propName, eArg) {
        if (propName == "src") {
            if (this.index == undefined || eArg == "reset") {
                this.index = new NearbyIndexSimple(this.src);
            } else {
                this.clearCaches();
            }
            this.notify_callbacks();
            this.eventifyTrigger("change");
        }        
    }
}
addToPrototype(StateLayer.prototype);



/*********************************************************************
    STATE LAYER CACHE
*********************************************************************/

/*
    Layer with a StateProvider uses a specific cache implementation.    

    Since Source Layer has a state provider, its index is
    items, and the cache will instantiate segments corresponding to
    these items. 
*/

class StateLayerCache {
    constructor(layer) {
        // layer
        this._layer = layer;
        // cached nearby object
        this._nearby = undefined;
        // cached segment
        this._segment = undefined;
    }

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
 * 
 * This implements a merge operation for layers.
 * List of sources is immutable.
 * 
 */

function merge (sources, options) {
    
    const layer = new Layer(options);
    layer.index = new MergeIndex(sources);

    // getter for sources
    Object.defineProperty(layer, "sources", {
        get: function () {
            return sources;
        }
    });
 
    // subscrive to change callbacks from sources 
    function handle_src_change(eArg) {
        layer.clearCaches();
        layer.notify_callback();
        layer.eventifyTrigger("change"); 
    }
    for (let src of sources) {
        src.add_callback(handle_src_change);            
    }
    return layer;
}


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
        // accumulate nearby from all sources
        const prev_list = [], next_list = [];
        const center_list = [];
        const center_high_list = [];
        const center_low_list = [];
        for (let src of this._sources) {
            let {prev, center, next, itv} = src.index.nearby(offset);
            if (prev != undefined) prev_list.push(prev);            
            if (next != undefined) next_list.push(next);
            if (center.length > 0) {
                center_list.push(this._caches.get(src));
                let [low, high] = endpoint.from_interval(itv);
                center_high_list.push(high);
                center_low_list.push(low);    
            }
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
        };

        if (center_list.length == 0) {

            // empty center
            result.right = min_next_low;       
            result.next = min_next_low;
            result.left = max_prev_high;
            result.prev = max_prev_high;

        } else {
            // non-empty center
            
            // center high
            center_high_list.sort(cmp_ascending);
            let min_center_high = center_high_list[0];
            let max_center_high = center_high_list.slice(-1)[0];
            let multiple_center_high = !endpoint.eq(min_center_high, max_center_high);

            // center low
            center_low_list.sort(cmp_descending);
            let max_center_low = center_low_list[0];
            let min_center_low = center_low_list.slice(-1)[0];
            let multiple_center_low = !endpoint.eq(max_center_low, min_center_low);

            // next/right
            if (endpoint.le(min_next_low, min_center_high)) {
                result.right = min_next_low;
            } else {
                result.right = endpoint.flip(min_center_high, "low");
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
}

function skewed(p, offset) {
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
    SKEW INDEX
*********************************************************************/

class SkewIndex extends NearbyIndexBase {

    constructor (layer, skew) {
        super();
        this._layer = layer;
        this._skew = skew;
        this._cache = layer.getCache();

        // skewing cache object
        this._skewed_cache = {
            query: function (offset) {
                // skew query (negative) - override result offset
                return {...this._cache.query(skewed(offset, -this._skew)), offset};
            }.bind(this)
        };
    }

    // skewing index.nearby
    nearby(offset) {
        // skew query (negative)
        const nearby = this._layer.index.nearby(skewed(offset, -this._skew));
        // skew result (positive) 
        const itv = nearby.itv.slice();
        itv[0] = skewed(nearby.itv[0], this._skew);
        itv[1] = skewed(nearby.itv[1], this._skew);
        return {
            itv,
            left: skewed(nearby.left, this._skew),
            right: skewed(nearby.right, this._skew),
            next: skewed(nearby.next, this._skew),
            prev: skewed(nearby.prev, this._skew),
            center: nearby.center.map(() => this._skewed_cache)
        }
    }
}


/*********************************************************************
    SKEW LAYER
*********************************************************************/

/**
 * Todo - make SkewLayer use a dynamic Skew Cursor
 * as ctrl.
 */


class SkewLayer extends Layer {

    constructor(layer, skew, options={}) {
        super(options);
        this._skew = skew;
        // setup src propterty
        addToInstance(this);
        this.srcpropRegister("src");
        this.src = layer;
    }

    propCheck(propName, src) {
        if (propName == "src") {
            if (!(src instanceof Layer)) {
                throw new Error(`"src" must be Layer ${src}`);
            }
            return src;    
        }
    }

    propChange(propName, eArg) {
        if (propName == "src") {
            if (this.index == undefined || eArg == "reset") {
                this.index = new SkewIndex(this.src, this._skew);
            } else {
                this.clearCaches();
            }
            this.notify_callbacks();
            this.eventifyTrigger("change");    
        }
    }
}
addToPrototype(SkewLayer.prototype);

/**
 * Skewing a Layer by an offset
 * 
 * a positive value for offset means that
 * the layer is shifted to the right on the timeline
 * 
 * 
 */

function skew (layer, offset) {
    return new SkewLayer(layer, offset);
}

// import { Cursor } from "./cursors.js";
// import { cmd } from "./cmd.js";


/*********************************************************************
    LAYER FACTORY
*********************************************************************/

function layer(options={}) {
    let {src, items, ...opts} = options;
    if (src == undefined) {
        src = new LocalStateProvider({items});
    }
    const layer = new StateLayer(opts);
    layer.src = src;
    return layer;
}

export { layer, merge, skew };
