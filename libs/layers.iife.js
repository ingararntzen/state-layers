
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var LAYERS = (function (exports) {
    'use strict';

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

    // system clock - epoch - seconds
    const local_epoch = function local_epoch () {
        return {
            now: () => {
                return new Date()/1000.0;
            }
        }
    }();

    /**
     * Create a single state from a list of states, using a valueFunc
     * state:{value, dynamic, offset}
     * 
     */

    function toState$1(sources, states, offset, options={}) {
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

            let {CacheClass=LayerCache, ...opts} = options; 

            // layer options
            this._options = opts;

            // callbacks
            addState$1(this);
            // define change event
            eventifyInstance(this);
            this.eventifyDefine("change", {init:true});

            // index
            this.index;

            // cache
            this._CacheClass = CacheClass;
            this._private_cache;
            this._consumer_caches = [];
        }

        // layer options
        get options () { return this._options; }

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
            const state = toState$1(this._nearby.center, states, offset, this._layer.options);
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
                const delays = polling_cursors.map(entry => {
                    return entry.bindings.map(binding => binding.delay);
                });
                const min_delay = Math.min(...delays);
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

    /**
     * convenience
     * get current state from cursor.ctrl
     * ensure that cursor.ctrl return a number offset
     */
    function get_cursor_ctrl_state (cursor, ts_local) {
        const state = cursor.ctrl.query(ts_local);
        if (!is_finite_number(state.value)) {
            throw new Error(`warning: cursor ctrl value must be number ${state.value}`);
        }
        return state;
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

        /**********************************************************
         * QUERY API
         **********************************************************/

        query() {
            throw new Error("query() not implemented");
        }

        get value () {return this.query().value};

        get () {
            return this.query().value;
        }

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
            return bind(this, callback, delay);
        }
        release(handle) {
            return release(handle);
        }

        // invoked by subclass whenever cursor has changed
        onchange() {
            this.notify_callbacks();
            this.eventifyTrigger("change", this.query());    
        }
    }
    addMethods$1(Cursor.prototype);
    eventifyPrototype(Cursor.prototype);

    /**
     * clock provider must have a now() method
     */
    function is_clock_provider(obj) {
        if (obj == undefined) return false;
        if (!("now" in obj)) return false;
        if (typeof obj.now != 'function') return false;
        return true;
    }


    /**
     * CLOCK gives epoch values, but is implemented
     * using performance now for better
     * time resolution and protection against system 
     * time adjustments.
     */
    const LOCAL_CLOCK_PROVIDER = function () {
        const t0 = local_clock.now();
        const t0_epoch = local_epoch.now();
        return {
            now (local_ts = local_clock.now()) {
                return t0_epoch + (local_ts - t0);
            }
        }
    }();

    function check_item(item) {
        item.itv = interval.from_input(item.itv);
        item.id = item.id || random_string(10);
        return item;
    }

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
            let {insert} = options;
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

        get() {
            return [...this._map.values()];
        };
    }
    addMethods$1(CollectionProvider.prototype);

    /**
     * variable providers must have a value property
     * and also implement callback interface
     */
    function is_variable_provider(obj) {
        if (!is_callback_api(obj)) return false;
        if (!("get" in obj)) return false;
        if (typeof obj.get != 'function') return false;
        if (!("set" in obj)) return false;
        if (typeof obj.set != 'function') return false;
        return true;
    }


    /***************************************************************
        VARIABLE PROVIDER
    ***************************************************************/

    /**
     * VariableProvider stores a list of items.
     */

    class VariableProvider {

        constructor(options={}) {
            addState$1(this);
            this._items = [];

            // initialize
            const {value} = options;
            if (value != undefined) {
                this._items = [{
                    id: random_string(10),
                    itv: [null, null, true, true], 
                    type: "static",
                    data: value
                }];
            }
        }

        set (items) {
            return Promise.resolve()
                .then(() => {
                    this._items = items;
                    this.notify_callbacks();
                });
        }

        get () {
            return this._items;
        }
    }
    addMethods$1(VariableProvider.prototype);

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
    			!is_variable_provider(stateProvider)
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
    			insert_items = this.src.get();		
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
            const {
                position:p0=0, 
                velocity:v0=0, 
                acceleration:a0=0, 
                timestamp:t0=0
            } = data;
            this._vector = [p0,v0,a0,t0];
        }

        state(offset) {
            const [p,v,a,t] = motion_utils.calculate(this._vector, offset);
            return {
                // position: p,
                // velocity: v,
                // acceleration: a,
                // timestamp: t,
                value: p,
                dynamic: (v != 0 || a != 0 )
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
        ITEMS LAYER
    *********************************************************************/

    /**
     * Items Layer has a stateProvider (either collectionProvider or variableProvider)
     * as src property.
     */

    function is_items_layer (obj) {
        if (obj == undefined) return false;
        // is layer
        if (!(obj instanceof Layer)) return false;
        // has src property
        const desc = Object.getOwnPropertyDescriptor(obj, "src");
        if (!!(desc?.get && desc?.set) == false) return false;
        return true;
    }

    function items_layer(options={}) {

        const {src, ...opts} = options;
        const layer = new Layer({CacheClass:ItemsLayerCache, ...opts});

        // setup src property
        addState(layer);
        addMethods(layer);

        layer.srcprop_register("src");
        layer.srcprop_check = function (propName, src) {
            if (propName == "src") {
                if (!(is_collection_provider(src)) && !(is_variable_provider(src))) {
                    throw new Error(`"src" must collectionProvider or variableProvider ${src}`);
                }
                return src;    
            }
        };
        layer.srcprop_onchange = function (propName, eArg) {
            if (propName == "src") {
                if (eArg == "reset") {
                    if (is_collection_provider(layer.src)) {
                        layer.index = new NearbyIndex(layer.src);
                    } else if (is_variable_provider(layer.src)) {
                        layer.index = new NearbyIndex(layer.src);
                    }
                } 
                if (layer.index != undefined) {
                    if (is_collection_provider(layer.src)) {
                        layer.index.refresh(eArg);
                    } else if (is_variable_provider(layer.src)) {
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
        layer.update = function update(changes) {
            return layer_update(layer, changes);
        };
        layer.append = function append(items, offset) {
            return layer_append(layer, items, offset);
        };

        // initialise
        layer.src = src;

        return layer;
    }


    /*********************************************************************
        ITEMS LAYER CACHE
    *********************************************************************/

    /*
        Layers with a CollectionProvider or a VariableProvider as src 
        use a specific cache implementation, as objects in the 
        index are assumed to be items from the provider, not layer objects. 
        Thus, queries are not resolved directly on the items in the index, but
        rather from corresponding segment objects, instantiated from items.

        Caching here applies to nearby state and segment objects.
    */

    class ItemsLayerCache {
        constructor(layer) {
            // layer
            this._layer = layer;
            // cached nearby object
            this._nearby = undefined;
            // cached segment
            this._segment = undefined;
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
            return toState$1(this._segments, states, offset, this._layer.options)
        }

        clear() {
            this._nearby = undefined;
            this._segment = undefined;
        }
    }




    /*********************************************************************
        LAYER UPDATE
    *********************************************************************/

    /*
        Items Layer forwards update to stateProvider
    */
    function layer_update(layer, changes={}) {
        if (is_collection_provider(layer.src)) {
            return layer.src.update(changes);
        } else if (is_variable_provider(layer.src)) {     
            let {
                insert=[],
                remove=[],
                reset=false
            } = changes;
            if (reset) {
                return layer.src.set(insert);
            } else {
                const map = new Map(layer.src.get()
                    .map((item) => [item.id, item]));
                // remove
                remove.forEach((id) => map.delete(id));
                // insert
                insert.forEach((item) => map.set(item.id, item));
                // set
                const items = Array.from(map.values());
                return layer.src.set(items);
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
     * TODO - not safe for repeting state
     * 
     */
    function layer_append(layer, items, offset) {
        const ep = endpoint.from_input(offset);
        
        // console.log("all items", items.length);

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
        
        // console.log("insert", insert_items.length);

        // truncate pre-existing items overlapping offset
        const modify_items = layer.index.nearby(offset).center.map((item) => {
            const new_item = {...item};
            new_item.itv = [item.itv[0], offset, item.itv[2], false];
            return new_item;
        });
        
        // console.log("modify", modify_items.length);

        //remove pre-existing items where itv.low > offset
        const remove = layer.src.get()
            .filter((item) => {
                const lowEp = endpoint.from_interval(item.itv)[0];
                return endpoint.gt(lowEp, ep);
            })
            .map((item) => {
                return item.id;
            });

        // console.log("remove", remove.length);

        // layer update
        const insert = [...modify_items, ...insert_items];
        return layer_update(layer, {remove, insert, reset:false})
    }

    /**
     * Clock cursor is a thin wrapper around a clockProvider,
     * so that it can be consumed as a cursor.
     * 
     * The ctrl property of any Cursor is required to be a Cursor or undefined,
     * so in the case of a clock cursor, which is the starting point,
     * the ctrl property is always set to undefined.
     * 
     * Additionally, clock cursor.src is also undefined.
     * 
     * Cursor transformation of a clock cursor will result in a new clock cursor.
     *  
     * Idenfifying a cursor as a clock cursor or not is important for playback
     * logic in cursor implemmentation.
     */

    function is_clock_cursor(obj) {
        return obj instanceof Cursor && obj.ctrl == undefined && obj.src == undefined; 
    }

    function clock_cursor(src) {

        if (!is_clock_provider(src)) {
            throw new Error(`src must be clockProvider ${src}`);
        }
        const cursor = new Cursor();
        cursor.query = function (local_ts) {
            const clock_ts = src.now(local_ts);
            return {value:clock_ts, dynamic:true, offset:local_ts};
        };
        return cursor;
    }

    const check_range = motion_utils.check_range;

    /*****************************************************
     * VARIABLE CURSOR
     *****************************************************/

    function variable_cursor(ctrl, src) {

        const cursor = new Cursor();

        // cache for src
        let src_cache;
        // timeout
        let tid;

        // setup src property
        addState(cursor);
        addMethods(cursor);
        cursor.srcprop_register("ctrl");
        cursor.srcprop_register("src");

        cursor.srcprop_check = function (propName, obj) {

            if (propName == "ctrl") {
                if (!is_clock_cursor(obj)) {
                    throw new Error(`ctrl must be a clock cursor ${obj}`);
                }
                return obj;
            }
            if (propName == "src") {
                if (!is_items_layer(obj)) {
                    throw new Error(`src must be an item layer ${obj}`);
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
            detect_future_event();
            cursor.onchange();
        };

        /**
         * cursor.ctrl (clock) defines an active region of cursor.src (layer)
         * at some point in the future, the cursor.ctrl will leave this region.
         * in that moment, cursor should reevaluate its state - so we need to 
         * detect this event by timeout  
         */

        function detect_future_event() {
            if (tid) {tid.cancel();}
            // ctrl 
            const ts = cursor.ctrl.value;
            // nearby from src
            const nearby = cursor.src.index.nearby(ts);
            const region_high = nearby.itv[1] || Infinity;        

            if (region_high == Infinity) {
                // no future leave event
                return;
            }
            const delta_ms = (region_high - ts) * 1000;
            tid = set_timeout(() => {
                cursor.onchange();
            }, delta_ms);
        }

        cursor.query = function query(local_ts) {
            const offset = cursor.ctrl.query(local_ts).value;
            return src_cache.query(offset);
        };
        
        /**
         * UPDATE API for Variable Cursor
         */    
        cursor.set = function set(value) {
            return set_value(cursor, value);
        };
        cursor.motion = function motion(vector) {
            return set_motion(cursor, vector);
        };
        cursor.transition = function transition({target, duration, easing}) {
            return set_transition(cursor, target, duration, easing);
        };
        cursor.interpolate = function interpolate ({tuples, duration}) {
            return set_interpolation(cursor, tuples, duration);
        };
        
        // initialize
        cursor.ctrl = ctrl;
        cursor.src = src;
        return cursor;
    }


    /******************************************************************
     * CURSOR UPDATE API
     * ***************************************************************/

    /**
     * set value of cursor
     */

    function set_value(cursor, value) {
        const items = [{
            id: random_string(10),
            itv: [null, null, true, true],
            type: "static",
            data: value                 
        }];
        return cursor.src.update({insert:items, reset:true});
    }

    /**
     * set motion state
     *  
     * motion only makes sense if variable cursor is restricted to number values,
     * which in turn implies that the cursor.src (Items Layer) should be
     * restricted to number values. 
     * If non-number values occur - we simply replace with 0.
     * Also, items layer should have a single item in nearby center.
     * 
     * if position is omitted in vector - current position will be assumed
     * if timestamp is omittted in vector - current timestamp will be assumed
     * if velocity and acceleration are ommitted in vector 
     * - these will be set to zero.
     */

    function set_motion(cursor, vector={}) {
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
        check_range(range);
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
                data: {position:p1, velocity:v1, acceleration:a1, timestamp:t1}
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
        return cursor.src.update({insert:items, reset:true});
    }

    /**
     * set transition - to target position using in <duration> seconds.
     */

    function set_transition(cursor, target, duration, easing) {
        const {value:v0, offset:t0} = cursor.query();
        const v1 = target;
        const t1 = t0 + duration;
        check_number("position", v0);
        check_number("position", v1);
        check_number("position", t0);
        check_number("position", t1);
        let items = [
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
        return cursor.src.update({insert:items, reset:true});
    }

    /**
     * set interpolation
     * 
     * assumes timestamps are in range [0,1]
     * scale timestamps to duration and offset by t0
     * assuming interpolation starts at t0
     */

    function set_interpolation(cursor, tuples, duration) {
        const now = cursor.ctrl.value;
        tuples = tuples.map(([v,t]) => {
            check_number("ts", t);
            check_number("val", v);
            return [v, now + t*duration];
        });
        const [v0, t0] = tuples[0];
        const [v1, t1] = tuples[tuples.length-1];
        const items = [
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
        return cursor.src.update({insert:items, reset:true});
    }


    /**
     * TODO: support alternative update for state recording.
     * This effectively means that recording is a 
     * bultin feature of the variable cursor. Could be enabled by option.
     * To calcultate the new state, need to truncate existing state
     * and append new items. Index support for the provider would be needed,
     * so that we can clear all state in interval [ts, null], 
     * and then append new items to the same interval. Would also need to
     * forward a ts from each of the update methods.
     * 
     * Check out some similar code from State Trajectory 
     * 
     */

    /*****************************************************
     * PLAYBACK CURSOR
     *****************************************************/

    function playback_cursor(ctrl, src) {

        const cursor = new Cursor();

        // src cache
        let src_cache;
        // timeout
        let tid;
        // polling
        let pid;

        // setup src property
        addState(cursor);
        addMethods(cursor);
        cursor.srcprop_register("ctrl");
        cursor.srcprop_register("src");

        /**
         * src property initialization check
         */
        cursor.srcprop_check = function (propName, obj) {
            if (propName == "ctrl") {
                if (obj instanceof Cursor) {
                    return obj
                } else {
                    throw new Error(`ctrl must be clockProvider or Cursor ${obj}`);
                }
            }
            if (propName == "src") {
                if (obj instanceof Layer) {
                    return obj;
                } else {
                    throw new Error(`src must be Layer ${obj}`);
                }
            }
        };

        /**
         * handle src property change
         */
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
            cursor_onchange();
        };

        /**
         * main cursor change handler
         */
        function cursor_onchange() {
            cursor.onchange();
            detect_future_event();
        }

        /**
         * cursor.ctrl (cursor/clock) defines an active region of cursor.src (layer)
         * at some point in the future, the cursor.ctrl will leave this region.
         * in that moment, cursor should reevaluate its state - so we need to 
         * detect this event, ideally by timeout, alternatively by polling.  
         */
        function detect_future_event() {
            if (tid) { tid.cancel(); }
            if (pid) { clearInterval(pid); }

            // current state of cursor.ctrl 
            const ctrl_state = get_cursor_ctrl_state(cursor);
            // current (position, time) of cursor.ctrl
            const current_pos = ctrl_state.value;
            const current_ts = ctrl_state.offset;

            // no future event if the ctrl is static
            if (!ctrl_state.dynamic) {
                // will never leave region
                return;
            }

            // current region of cursor.src
            const src_nearby = cursor.src.index.nearby(current_pos);

            const region_low = src_nearby.itv[0] ?? -Infinity;
            const region_high = src_nearby.itv[1] ?? Infinity;

            // no future leave event if the region covers the entire timeline 
            if (region_low == -Infinity && region_high == Infinity) {
                // will never leave region
                return;
            }

            if (is_clock_cursor(cursor.ctrl)) {
                /* 
                    cursor.ctrl is a clock provider

                    possible timeout associated with leaving region
                    through region_high - as clock is increasing.
                */
               const target_pos = region_high;
                const delta_ms = (target_pos - current_pos) * 1000;
                tid = set_timeout(() => {
                    cursor_onchange();
                }, delta_ms);
                // leave event scheduled
                return;
            } 
            
            if (
                is_clock_cursor(cursor.ctrl.ctrl) && 
                is_items_layer(cursor.ctrl.src)
            ) {
                /* 
                    cursor.ctrl is a cursor with a clock provider

                    possible timeout associated with leaving region
                    through region_low or region_high.

                    However, this can only be predicted if cursor.ctrl
                    implements a deterministic function of time.

                    This can be the case if cursor.ctr.src is an items layer,
                    and a single active item describes either a motion or a transition (with linear easing).                
                */
                const active_items = cursor.ctrl.src.get_items(current_ts);
                let target_pos;

                if (active_items.length == 1) {
                    const active_item = active_items[0];
                    if (active_item.type == "motion") {
                        const {velocity, acceleration} = active_item.data;
                        // TODO calculate timeout with acceleration too
                        if (acceleration == 0.0) {
                            // figure out which region boundary we hit first
                            if (velocity > 0) {
                                target_pos = region_high;
                            } else {
                                target_pos = region_low;
                            }
                            const delta_ms = (target_pos - current_pos) * 1000;
                            tid = set_timeout(() => {
                                cursor_onchange();
                            }, delta_ms);
                            // leave-event scheduled
                            return;
                        }
                    } else if (active_item.type == "transition") {
                        const {v0, v1, t0, t1, easing="linear"} = active_item.data;
                        if (easing == "linear") {
                            // linear transtion
                            let velocity = (v1-v0)/(t1-t0);
                            if (velocity > 0) {
                                target_pos = Math.min(region_high, v1);
                            }
                            else {
                                target_pos = Math.max(region_low, v1);
                            }
                            const delta_ms = (target_pos - current_pos) * 1000;
                            tid = set_timeout(() => {
                                cursor_onchange();
                            }, delta_ms);
                            // leave-event scheduled
                            return;
                        }
                    }
                }
            }

            /**
             * detection of leave events falls back on polling
             */
            start_polling(src_nearby.itv);
        }

        /**
         * start polling
         */
        function start_polling(itv) {
            pid = setInterval(() => {
                handle_polling(itv);
            }, 100);
        }

        /**
         * handle polling
         */
        function handle_polling(itv) {
            let offset = cursor.ctrl.value;
            if (!interval.covers_endpoint(itv, offset)) {
                cursor_onchange();
            }
        }


        /**
         * main query function - resolving query
         * from cache object associated with cursor.src
         */

        cursor.query = function query(local_ts) {
            const offset = get_cursor_ctrl_state(cursor, local_ts).value; 
            return src_cache.query(offset);
        };
        
        // initialize
        cursor.ctrl = ctrl;
        cursor.src = src;
        return cursor;
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

    function boolean_layer(src) {

        const layer = new Layer();
        layer.index = new NearbyIndexBoolean(src.index);
        
        // subscribe
        src.add_callback((eArg) => {
            layer.onchange(eArg);
        });

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
            return {
                itv: interval.from_endpoints(low, high),
                center : [queryObject(evaluation)],
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

        // initialise
        layer.src = src;
        
        return layer;
    }

    function toState(state, options={}) {
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
     * Create a new Cursor which is a transformation of the src Cursor
     */
    function cursor_transform(src, options={}) {

        if (!(src instanceof Cursor)) {
            throw new Error(`src must be a Cursor ${src}`);
        }

        const cursor = new Cursor();

        // implement query
        cursor.query = function query() {
            const state = src.query();
            return toState(state, options);
        };

        // adopt the ctrl of the src-cursor
        if (!is_clock_cursor(src)) {
            cursor.ctrl = src.ctrl;
            // add callbacks
            cursor.ctrl.add_callback(() => {cursor.onchange();});
        }

        /* 
            Current definition of Cursor src property is that it is a layer or undefined.
            This leaves cursor transform options.
            1) wrap src cursor as a layer,
            2) let src property be undefined
            3) adopt the src property of the src cursor as its own src

            We go for 3)
        */

        // adopt the src of the src-cursor as src
        if (!is_clock_cursor(src)) {
            cursor.src = src.src;
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
        return layer;
    }

    function record_layer(ctrl, src, dst) {

        // ctrl must be clock cursor or media cursor
        if (
            !is_clock_cursor(ctrl) &&
            !is_clock_cursor(ctrl.ctrl)
        ){
            throw new Error(`ctrl or ctrl.ctrl must be a clock cursor ${ctrl}`);
        }    

        // src must be cursor with a segments layer as src
        if (!(src instanceof Cursor)) {
            throw new Error(`src must be a cursor ${src}`);
        }
        if (!is_items_layer(src.src)) {
            throw new Error(`cursor src must be a segment layer ${src.src}`);
        }

        // dst must be segments layer
        if (!is_items_layer(dst)) {
            throw new Error(`dst must be a segment layer ${dst}`);
        }

        /**
         * record stateProvider of cursor (src)
         */
        src.src.src.add_callback(on_src_change);

        function on_src_change () {
            // record timestamp
            const ts = ctrl.value;
            // get current items from stateProvider
            const items = src.src.src.get();
            // append items to dst
            dst.append(items, ts);
        }

        /**
         * TODO 
         * - clock should be used as a record clock, implying that
         *   items should be recoded according to this clock?
         * - this implies sensitivity to a difference between 
         *   cursor clock and record clock 
         */


        return dst;
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
            const items = this._sp.get();

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

    // classes

    function viewer(stateProvider, elem, options={}) {
        // create a new viewer
        return new StateProviderViewer(stateProvider, elem, options);
    }

    /*********************************************************************
        LAYER FACTORIES
    *********************************************************************/

    function layer(options={}) {
        let {src, insert, value, ...opts} = options;
        if (src instanceof Layer) {
            return src;
        }
        if (src == undefined) {
            if (value != undefined) {
                src = new VariableProvider({value});
            } else {
                src = new CollectionProvider({insert});
            }
        }
        return items_layer({src, ...opts}); 
    }

    function record (options={}) {
        let {ctrl, src, dst, ...ops} = options;
        ctrl = cursor(ctrl);
        src = cursor(src);
        dst = layer({dst:src, ...ops});
        record_layer(ctrl, src, dst);
        return dst;
    }


    /*********************************************************************
        CURSOR FACTORIES
    *********************************************************************/


    function cursor (src=LOCAL_CLOCK_PROVIDER) {
        if (src instanceof Cursor) {
            return src;
        }
        if (is_clock_cursor(src)) {
            return src;
        }
        if (is_clock_provider(src)) {
            return clock_cursor(src);
        }
        throw new Error(`src must be cursor, clockProvider or undefined ${src}`);
    }

    function clock (src) {
        return cursor(src);
    }

    function variable(options={}) {
        let {ctrl, ...opts} = options;
        ctrl = cursor(ctrl);
        const src = layer(opts);
        return variable_cursor(ctrl, src);
    }

    function playback(options={}) {
        let {ctrl, ...opts} = options;
        ctrl = cursor(ctrl);
        const src = layer(opts);
        return playback_cursor(ctrl, src);
    }

    function skew (src, offset) {
        src = cursor(src);
        function valueFunc(value) {
            return value + offset;
        } 
        return cursor_transform(src, {valueFunc});
    }

    exports.Cursor = Cursor;
    exports.Layer = Layer;
    exports.NearbyIndexBase = NearbyIndexBase;
    exports.boolean = boolean_layer;
    exports.clock = clock;
    exports.cursor_transform = cursor_transform;
    exports.layer = layer;
    exports.layer_from_cursor = layer_from_cursor;
    exports.layer_transform = layer_transform;
    exports.local_clock = local_clock;
    exports.logical_expr = logical_expr;
    exports.logical_merge = logical_merge_layer;
    exports.merge = merge_layer;
    exports.playback = playback;
    exports.record = record;
    exports.skew = skew;
    exports.timeline_transform = timeline_transform;
    exports.variable = variable;
    exports.viewer = viewer;

    return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsL2ludGVydmFscy5qcyIsIi4uLy4uL3NyYy9uZWFyYnlfYmFzZS5qcyIsIi4uLy4uL3NyYy91dGlsL2FwaV9ldmVudGlmeS5qcyIsIi4uLy4uL3NyYy91dGlsL2FwaV9jYWxsYmFjay5qcyIsIi4uLy4uL3NyYy91dGlsL2NvbW1vbi5qcyIsIi4uLy4uL3NyYy9sYXllcl9iYXNlLmpzIiwiLi4vLi4vc3JjL3V0aWwvY3Vyc29yX21vbml0b3IuanMiLCIuLi8uLi9zcmMvY3Vyc29yX2Jhc2UuanMiLCIuLi8uLi9zcmMvcHJvdmlkZXJfY2xvY2suanMiLCIuLi8uLi9zcmMvcHJvdmlkZXJfY29sbGVjdGlvbi5qcyIsIi4uLy4uL3NyYy9wcm92aWRlcl92YXJpYWJsZS5qcyIsIi4uLy4uL3NyYy91dGlsL2FwaV9zcmNwcm9wLmpzIiwiLi4vLi4vc3JjL3V0aWwvc29ydGVkYXJyYXkuanMiLCIuLi8uLi9zcmMvbmVhcmJ5X2luZGV4LmpzIiwiLi4vLi4vc3JjL3V0aWwvc2VnbWVudHMuanMiLCIuLi8uLi9zcmMvbGF5ZXJfaXRlbXMuanMiLCIuLi8uLi9zcmMvY3Vyc29yX2Nsb2NrLmpzIiwiLi4vLi4vc3JjL2N1cnNvcl92YXJpYWJsZS5qcyIsIi4uLy4uL3NyYy9jdXJzb3JfcGxheWJhY2suanMiLCIuLi8uLi9zcmMvb3BzL2xheWVyX2Zyb21fY3Vyc29yLmpzIiwiLi4vLi4vc3JjL29wcy9tZXJnZS5qcyIsIi4uLy4uL3NyYy9vcHMvYm9vbGVhbi5qcyIsIi4uLy4uL3NyYy9vcHMvbG9naWNhbF9tZXJnZS5qcyIsIi4uLy4uL3NyYy9vcHMvdGltZWxpbmVfdHJhbnNmb3JtLmpzIiwiLi4vLi4vc3JjL29wcy90cmFuc2Zvcm0uanMiLCIuLi8uLi9zcmMvb3BzL3JlY29yZC5qcyIsIi4uLy4uL3NyYy91dGlsL3Byb3ZpZGVyX3ZpZXdlci5qcyIsIi4uLy4uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICAgIFxuICAgIElOVEVSVkFMIEVORFBPSU5UU1xuXG4gICAgKiBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIGRlZmluZWQgYnkgdHJpcGxldCBbdmFsdWUsIHR5cGVdXG4gICAgKlxuICAgICogICB0aGVyZSBhcmUgNCB0eXBlcyBvZiBpbnRlcnZhbCBlbmRwb2ludHMgXG4gICAgKiAgIC0gdikgLSBoaWdoIGVuZHBvaW50IGF0IHYsIG5vdCBpbmNsdXNpdmVcbiAgICAqICAgLSB2XSAtIGhpZ2ggZW5kcG9pbnQgYXQgdiwgaW5jbHVzaXZlXG4gICAgKiAgIC0gW3YgLSBsb3cgZW5kcG9pbnQgYXQgdiwgbm90IGluY2x1c2l2ZVxuICAgICogICAtICh2IC0gbG93IGVuZHBvaW50IGF0IHYsIGluY2x1c2l2ZVxuICAgICogXG4gICAgKiAgIEEgc2luZ3VsYXIgaW50ZXJ2YWwgWzIsMix0cnVlLHRydWVdIHdpbGwgaGF2ZSBlbmRwb2ludHMgWzIgYW5kIDJdXG4gICAgKiBcbiAgICAqICAgQWRkaXRpb25hbGx5LCB0byBzaW1wbGlmeSBjb21wYXJpc29uIGJldHdlZW4gZW5kcG9pbnRzIGFuZCBudW1iZXJzXG4gICAgKiAgIHdpIGludHJvZHVjZSBhIHNwZWNpYWwgZW5kcG9pbnQgdHlwZSAtIFZBTFVFXG4gICAgKiBcbiAgICAqICAgVGh1cyB3ZSBkZWZpbmUgNSB0eXBlcyBvZiBlbmRwb2ludHNcbiAgICAqIFxuICAgICogICBISUdIX09QRU4gOiB2KVxuICAgICogICBISUdIX0NMT1NFRDogdl1cbiAgICAqICAgVkFMVUU6IHZcbiAgICAqICAgTE9XX0NMT1NFRDogW3ZcbiAgICAqICAgTE9XX09QRU46ICh2KVxuICAgICogXG4gICAgKiAgIEZvciB0aGUgcHVycG9zZSBvZiBlbmRwb2ludCBjb21wYXJpc29uIHdlIG1haW50YWluXG4gICAgKiAgIGEgbG9naWNhbCBvcmRlcmluZyBmb3IgZW5kcG9pbnRzIHdpdGggdGhlIHNhbWUgdmFsdWUuXG4gICAgKiAgIFxuICAgICogICB2KSA8IFt2ID09IHYgPT0gdl0gPCAodlxuICAgICogIFxuICAgICogICBXZSBhc3NpZ24gb3JkZXJpbmcgdmFsdWVzXG4gICAgKiAgIFxuICAgICogICBISUdIX09QRU46IC0xXG4gICAgKiAgIEhJR0hfQ0xPU0VELCBWQUxVRSwgTE9XX0NMT1NFRDogMFxuICAgICogICBMT1dfT1BFTjogMVxuICAgICogXG4gICAgKiAgIHZhbHVlIGNhbiBiZSBudWxsIG9yIG51bWJlci4gSWYgdmFsdWUgaXMgbnVsbCwgdGhpcyBtZWFucyB1bmJvdW5kZWQgZW5kcG9pbnRcbiAgICAqICAgaS5lLiBubyBvdGhlciBlbmRwb2ludCBjYW4gYmUgbGFyZ2VyIG9yIHNtYWxsZXIuXG4gICAgKiAgIGFuIHVuYm91bmRlZCBsb3cgZW5kcG9pbnQgbWVhbnMgLUluZmluaXR5XG4gICAgKiAgIGFuIHVuYm91bmRlZCBoaWdoIGVuZHBvaW50IG1lYW5zIEluZmluaXR5XG4gICAgKlxuKi9cblxuZnVuY3Rpb24gaXNOdW1iZXIobikge1xuICAgIHJldHVybiB0eXBlb2YgbiA9PSBcIm51bWJlclwiO1xufVxuXG5jb25zdCBFUF9UWVBFID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgSElHSF9PUEVOOiBcIilcIixcbiAgICBISUdIX0NMT1NFRDogXCJdXCIsXG4gICAgVkFMVUU6IFwiXCIsXG4gICAgTE9XX0NMT1NFRDogXCJbXCIsXG4gICAgTE9XX09QRU46IFwiKFwiXG59KTtcblxuZnVuY3Rpb24gaXNfRVBfVFlQRSh2YWx1ZSkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKEVQX1RZUEUpLmluY2x1ZGVzKHZhbHVlKTtcbn1cblxuY29uc3QgRVBfT1JERVIgPSBuZXcgTWFwKFtcbiAgICBbRVBfVFlQRS5ISUdIX09QRU4sIC0xXSxcbiAgICBbRVBfVFlQRS5ISUdIX0NMT1NFRCwgMF0sXG4gICAgW0VQX1RZUEUuVkFMVUUsIDBdLFxuICAgIFtFUF9UWVBFLkxPV19DTE9TRUQsIDBdLFxuICAgIFtFUF9UWVBFLkxPV19PUEVOLCAxXVxuXSk7XG5cbmZ1bmN0aW9uIGVuZHBvaW50X2lzX2xvdyhlcCkge1xuICAgIHJldHVybiBlcFsxXSA9PSBFUF9UWVBFLkxPV19DTE9TRUQgfHwgZXBbMV0gPT0gRVBfVFlQRS5MT1dfT1BFTjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfaXNfaGlnaChlcCkge1xuICAgIHJldHVybiBlcFsxXSA9PSBFUF9UWVBFLkhJR0hfQ0xPU0VEIHx8IGVwWzFdID09IEVQX1RZUEUuSElHSF9PUEVOO1xufVxuXG4vKlxuICAgIHJldHVybiBlbmRwb2ludCBmcm9tIGlucHV0XG4qL1xuZnVuY3Rpb24gZW5kcG9pbnRfZnJvbV9pbnB1dChlcCkge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShlcCkpIHtcbiAgICAgICAgZXAgPSBbZXAsIEVQX1RZUEUuVkFMVUVdO1xuICAgIH1cbiAgICBpZiAoZXAubGVuZ3RoICE9IDIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW5kcG9pbnQgbXVzdCBiZSBhIGxlbmd0aC0yIGFycmF5XCIsIGVwKTtcbiAgICB9XG4gICAgbGV0IFt2LHRdID0gZXA7XG4gICAgaWYgKCFpc19FUF9UWVBFKHQpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIGVuZHBvaW50IHR5cGVcIiwgdCk7XG4gICAgfVxuICAgIGlmICh2ID09IC1JbmZpbml0eSkge1xuICAgICAgICByZXR1cm4gW251bGwsIEVQX1RZUEUuTE9XX0NMT1NFRF07XG4gICAgfVxuICAgIGlmICh2ID09IEluZmluaXR5KSB7XG4gICAgICAgIHJldHVybiBbbnVsbCwgRVBfVFlQRS5ISUdIX0NMT1NFRF07XG4gICAgfVxuICAgIGlmICh2ID09IHVuZGVmaW5lZCB8fCB2ID09IG51bGwgfHwgaXNOdW1iZXIodikpIHtcbiAgICAgICAgcmV0dXJuIFt2LCB0XTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgbXVzdCBiZSBudWxsIG9yIG51bWJlclwiLCB2KTtcbn1cblxuY29uc3QgZW5kcG9pbnRfUE9TX0lORiA9IGVuZHBvaW50X2Zyb21faW5wdXQoSW5maW5pdHkpO1xuY29uc3QgZW5kcG9pbnRfTkVHX0lORiA9IGVuZHBvaW50X2Zyb21faW5wdXQoLUluZmluaXR5KTtcblxuLyoqXG4gKiBJbnRlcm5hbCByZXByZXNlbnRhdGlvbiBcbiAqIHJlcGxhY2luZyBudWxsIHZhbHVzZSB3aXRoIC1JbmZpbml0eSBvciBJbmZpbml0eVxuICogaW4gb3JkZXIgdG8gc2ltcGxpZnkgbnVtZXJpY2FsIGNvbXBhcmlzb25cbiAqL1xuZnVuY3Rpb24gZW5kcG9pbnRfaW50ZXJuYWwoZXApIHtcbiAgICBpZiAoZXBbMF0gIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gW2VwWzBdLCBlcFsxXV07XG4gICAgfVxuICAgIGlmIChlbmRwb2ludF9pc19sb3coZXApKSB7XG4gICAgICAgIHJldHVybiBbLUluZmluaXR5LCBFUF9UWVBFLkxPV19DTE9TRURdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBbSW5maW5pdHksIEVQX1RZUEUuSElHSF9DTE9TRURdO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDb21wYXJpc29uIGZ1bmN0aW9uIGZvciBudW1iZXJzXG4gKiBhdm9pZCBzdWJ0cmFjdGlvbiB0byBzdXBwb3J0IEluZmluaXR5IHZhbHVlc1xuICovXG5mdW5jdGlvbiBudW1iZXJfY21wKGEsIGIpIHtcbiAgICBpZiAoYSA8IGIpIHJldHVybiAtMTsgLy8gY29ycmVjdCBvcmRlclxuICAgIGlmIChhID4gYikgcmV0dXJuIDE7IC8vIHdyb25nIG9yZGVyXG4gICAgcmV0dXJuIDA7IC8vIGVxdWFsaXR5XG59XG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuKi8gXG5mdW5jdGlvbiBlbmRwb2ludF9jbXAoZXAxLCBlcDIpIHsgICAgXG4gICAgY29uc3QgW3YxLCB0MV0gPSBlbmRwb2ludF9pbnRlcm5hbChlcDEpO1xuICAgIGNvbnN0IFt2MiwgdDJdID0gZW5kcG9pbnRfaW50ZXJuYWwoZXAyKTtcbiAgICBjb25zdCBkaWZmID0gbnVtYmVyX2NtcCh2MSwgdjIpO1xuICAgIGlmIChkaWZmID09IDApIHtcbiAgICAgICAgY29uc3QgbzEgPSBFUF9PUkRFUi5nZXQodDEpO1xuICAgICAgICBjb25zdCBvMiA9IEVQX09SREVSLmdldCh0Mik7XG4gICAgICAgIHJldHVybiBudW1iZXJfY21wKG8xLCBvMik7XG4gICAgfVxuICAgIHJldHVybiBkaWZmO1xufVxuXG5mdW5jdGlvbiBlbmRwb2ludF9sdCAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpIDwgMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfbGUgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9ndCAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpID4gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ2UgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9lcSAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpID09IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X21pbihwMSwgcDIpIHtcbiAgICByZXR1cm4gKGVuZHBvaW50X2xlKHAxLCBwMikpID8gcDEgOiBwMjtcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X21heChwMSwgcDIpIHtcbiAgICByZXR1cm4gKGVuZHBvaW50X2dlKHAxLCBwMikpID8gcDEgOiBwMjtcbn1cblxuLyoqXG4gKiBmbGlwIGVuZHBvaW50OlxuICogLSBpZS4gZ2V0IGFkamFjZW50IGVuZHBvbml0IG9uIHRoZSB0aW1lbGluZVxuICogXG4gKiB2KSA8LT4gW3ZcbiAqIHZdIDwtPiAodlxuICogXG4gKiBmbGlwcGluZyBoYXMgbm8gZWZmZWN0IG9uIGVuZHBvaW50cyB3aXRoIHVuYm91bmRlZCB2YWx1ZVxuICovXG5cbmZ1bmN0aW9uIGVuZHBvaW50X2ZsaXAoZXAsIHRhcmdldCkge1xuICAgIGlmICh0YXJnZXQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwidGFyZ2V0IGlzIGRlcHJlY2F0ZWRcIik7XG4gICAgfVxuICAgIGxldCBbdix0XSA9IGVwO1xuICAgIGlmICh2ID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGVwO1xuICAgIH1cbiAgICBpZiAodCA9PSBFUF9UWVBFLkhJR0hfT1BFTikge1xuICAgICAgICByZXR1cm4gW3YsIEVQX1RZUEUuTE9XX0NMT1NFRF07XG4gICAgfSBlbHNlIGlmICh0ID09IEVQX1RZUEUuSElHSF9DTE9TRUQpIHtcbiAgICAgICAgcmV0dXJuIFt2LCBFUF9UWVBFLkxPV19PUEVOXTtcbiAgICB9IGVsc2UgaWYgKHQgPT0gRVBfVFlQRS5MT1dfT1BFTikge1xuICAgICAgICByZXR1cm4gW3YsIEVQX1RZUEUuSElHSF9DTE9TRURdO1xuICAgIH0gZWxzZSBpZiAodCA9PSBFUF9UWVBFLkxPV19DTE9TRUQpIHtcbiAgICAgICAgcmV0dXJuIFt2LCBFUF9UWVBFLkhJR0hfT1BFTl07XG4gICAgfSBlbHNlIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgZW5kcG9pbnQgdHlwZVwiLCB0KTtcbiAgICB9XG4gICAgcmV0dXJuIHA7XG59XG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBjb25zdCBbbG93LCBoaWdoLCBsb3dDbG9zZWQsIGhpZ2hDbG9zZWRdID0gaXR2O1xuICAgIGNvbnN0IGxvd1R5cGUgPSAobG93Q2xvc2VkKSA/ICBFUF9UWVBFLkxPV19DTE9TRUQgOiBFUF9UWVBFLkxPV19PUEVOO1xuICAgIGNvbnN0IGhpZ2hUeXBlID0gKGhpZ2hDbG9zZWQpID8gIEVQX1RZUEUuSElHSF9DTE9TRUQgOiBFUF9UWVBFLkhJR0hfT1BFTjtcbiAgICBjb25zdCBsb3dFcCA9IGVuZHBvaW50X2Zyb21faW5wdXQoW2xvdywgbG93VHlwZV0pO1xuICAgIGNvbnN0IGhpZ2hFcCA9IGVuZHBvaW50X2Zyb21faW5wdXQoW2hpZ2gsIGhpZ2hUeXBlXSk7XG4gICAgcmV0dXJuIFtsb3dFcCwgaGlnaEVwXTtcbn1cblxuXG4vKlxuICAgIElOVEVSVkFMU1xuXG4gICAgSW50ZXJ2YWxzIGFyZSBbbG93LCBoaWdoLCBsb3dDbG9zZWQsIGhpZ2hDbG9zZWRdXG5cbiovIFxuXG5cbi8qXG4gICAgcmV0dXJuIHRydWUgaWYgcG9pbnQgb3IgZW5kcG9pbnQgaXMgY292ZXJlZCBieSBpbnRlcnZhbFxuICAgIHBvaW50IHAgY2FuIGJlIG51bWJlciB2YWx1ZSBvciBhbiBlbmRwb2ludFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIGVwKSB7XG4gICAgY29uc3QgW2xvd19lcCwgaGlnaF9lcF0gPSBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpO1xuICAgIGVwID0gZW5kcG9pbnRfZnJvbV9pbnB1dChlcCk7XG4gICAgLy8gY292ZXJzOiBsb3cgPD0gcCA8PSBoaWdoXG4gICAgcmV0dXJuIGVuZHBvaW50X2xlKGxvd19lcCwgZXApICYmIGVuZHBvaW50X2xlKGVwLCBoaWdoX2VwKTtcbn1cbi8vIGNvbnZlbmllbmNlXG5mdW5jdGlvbiBpbnRlcnZhbF9jb3ZlcnNfcG9pbnQoaXR2LCBwKSB7XG4gICAgcmV0dXJuIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIHApO1xufVxuXG4vKlxuICAgIFJldHVybiB0cnVlIGlmIGludGVydmFsIGVuZHBvaW50cyBhcmUgZXF1YWxcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9pc19zaW5ndWxhcihpbnRlcnZhbCkge1xuICAgIGNvbnN0IFtsb3dfZXAsIGhpZ2hfZXBdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICByZXR1cm4gZW5kcG9pbnRfZXEobG93X2VwLCBoaWdoX2VwKTtcbn1cblxuLypcbiAgICBDcmVhdGUgaW50ZXJ2YWwgZnJvbSBlbmRwb2ludHNcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyhlcDEsIGVwMikge1xuICAgIGxldCBbdjEsIHQxXSA9IGVwMTtcbiAgICBsZXQgW3YyLCB0Ml0gPSBlcDI7XG4gICAgaWYgKCFlbmRwb2ludF9pc19sb3coZXAxKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2FsIGxvdyBlbmRwb2ludFwiLCBlcDEpO1xuICAgIH1cbiAgICBpZiAoIWVuZHBvaW50X2lzX2hpZ2goZXAyKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2FsIGhpZ2ggZW5kcG9pbnRcIiwgZXAyKTtcbiAgICB9XG4gICAgcmV0dXJuIFt2MSwgdjIsIHQxID09IEVQX1RZUEUuTE9XX0NMT1NFRCwgdDIgPT0gRVBfVFlQRS5ISUdIX0NMT1NFRF07XG59XG5cblxuZnVuY3Rpb24gaW50ZXJ2YWxfZnJvbV9pbnB1dChpbnB1dCl7XG4gICAgbGV0IGl0diA9IGlucHV0O1xuICAgIGlmIChpdHYgPT0gdW5kZWZpbmVkIHx8IGl0diA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImlucHV0IGlzIHVuZGVmaW5lZFwiKTtcbiAgICB9XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGl0dikpIHtcbiAgICAgICAgaWYgKGlzTnVtYmVyKGl0dikpIHtcbiAgICAgICAgICAgIC8vIGlucHV0IGlzIHNpbmd1bGFyIG51bWJlclxuICAgICAgICAgICAgaXR2ID0gW2l0diwgaXR2LCB0cnVlLCB0cnVlXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgaW5wdXQ6ICR7aW5wdXR9OiBtdXN0IGJlIEFycmF5IG9yIE51bWJlcmApXG4gICAgICAgIH1cbiAgICB9O1xuICAgIC8vIG1ha2Ugc3VyZSBpbnRlcnZhbCBpcyBsZW5ndGggNFxuICAgIGlmIChpdHYubGVuZ3RoID09IDEpIHtcbiAgICAgICAgaXR2ID0gW2l0dlswXSwgaXR2WzBdLCB0cnVlLCB0cnVlXTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMikge1xuICAgICAgICBpdHYgPSBbaXR2WzBdLCBpdHZbMV0sIHRydWUsIGZhbHNlXTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMykge1xuICAgICAgICBpdHYgPSBbaXR2WzBdLCBpdHZbMV0sIGl0dlsyXSwgZmFsc2VdO1xuICAgIH0gZWxzZSBpZiAoaXR2Lmxlbmd0aCA+IDQpIHtcbiAgICAgICAgaXR2ID0gW2l0dlswXSwgaXR2WzFdLCBpdHZbMl0sIGl0dls0XV07XG4gICAgfVxuICAgIGxldCBbbG93LCBoaWdoLCBsb3dJbmNsdWRlLCBoaWdoSW5jbHVkZV0gPSBpdHY7XG4gICAgLy8gYm91bmRhcnkgY29uZGl0aW9ucyBhcmUgbnVtYmVyIG9yIG51bGxcbiAgICBpZiAobG93ID09IHVuZGVmaW5lZCB8fCBsb3cgPT0gLUluZmluaXR5KSB7XG4gICAgICAgIGxvdyA9IG51bGw7XG4gICAgfVxuICAgIGlmIChoaWdoID09IHVuZGVmaW5lZCB8fCBoaWdoID09IEluZmluaXR5KSB7XG4gICAgICAgIGhpZ2ggPSBudWxsO1xuICAgIH1cbiAgICAvLyBjaGVjayBsb3dcbiAgICBpZiAobG93ID09IG51bGwpIHtcbiAgICAgICAgbG93SW5jbHVkZSA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCFpc051bWJlcihsb3cpKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgbm90IGEgbnVtYmVyXCIsIGxvdyk7XG4gICAgfVxuICAgIC8vIGNoZWNrIGhpZ2hcbiAgICBpZiAoaGlnaCA9PSBudWxsKSB7XG4gICAgICAgIGhpZ2hJbmNsdWRlID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoIWlzTnVtYmVyKGhpZ2gpKSB0aHJvdyBuZXcgRXJyb3IoXCJoaWdoIG5vdCBhIG51bWJlclwiLCBoaWdoKTtcbiAgICB9ICAgIFxuICAgIC8vIGNoZWNrIHRoYXQgbG93IDw9IGhpZ2hcbiAgICBpZiAobG93ICE9IG51bGwgJiYgaGlnaCAhPSBudWxsKSB7XG4gICAgICAgIGlmIChsb3cgPiBoaWdoKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgPiBoaWdoXCIsIGxvdywgaGlnaCk7XG4gICAgICAgIC8vIHNpbmdsZXRvblxuICAgICAgICBpZiAobG93ID09IGhpZ2gpIHtcbiAgICAgICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgICAgICAgICAgaGlnaEluY2x1ZGUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGUgYXJlIGJvb2xlYW5zXG4gICAgaWYgKHR5cGVvZiBsb3dJbmNsdWRlICE9PSBcImJvb2xlYW5cIikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJsb3dJbmNsdWRlIG5vdCBib29sZWFuXCIpO1xuICAgIH0gXG4gICAgaWYgKHR5cGVvZiBoaWdoSW5jbHVkZSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaGlnaEluY2x1ZGUgbm90IGJvb2xlYW5cIik7XG4gICAgfVxuICAgIHJldHVybiBbbG93LCBoaWdoLCBsb3dJbmNsdWRlLCBoaWdoSW5jbHVkZV07XG59XG5cbmV4cG9ydCBjb25zdCBlbmRwb2ludCA9IHtcbiAgICBsZTogZW5kcG9pbnRfbGUsXG4gICAgbHQ6IGVuZHBvaW50X2x0LFxuICAgIGdlOiBlbmRwb2ludF9nZSxcbiAgICBndDogZW5kcG9pbnRfZ3QsXG4gICAgY21wOiBlbmRwb2ludF9jbXAsXG4gICAgZXE6IGVuZHBvaW50X2VxLFxuICAgIG1pbjogZW5kcG9pbnRfbWluLFxuICAgIG1heDogZW5kcG9pbnRfbWF4LFxuICAgIGZsaXA6IGVuZHBvaW50X2ZsaXAsXG4gICAgZnJvbV9pbnRlcnZhbDogZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwsXG4gICAgZnJvbV9pbnB1dDogZW5kcG9pbnRfZnJvbV9pbnB1dCxcbiAgICB0eXBlczogey4uLkVQX1RZUEV9LFxuICAgIFBPU19JTkYgOiBlbmRwb2ludF9QT1NfSU5GLFxuICAgIE5FR19JTkYgOiBlbmRwb2ludF9ORUdfSU5GXG59XG5leHBvcnQgY29uc3QgaW50ZXJ2YWwgPSB7XG4gICAgY292ZXJzX2VuZHBvaW50OiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQsXG4gICAgY292ZXJzX3BvaW50OiBpbnRlcnZhbF9jb3ZlcnNfcG9pbnQsIFxuICAgIGlzX3Npbmd1bGFyOiBpbnRlcnZhbF9pc19zaW5ndWxhcixcbiAgICBmcm9tX2VuZHBvaW50czogaW50ZXJ2YWxfZnJvbV9lbmRwb2ludHMsXG4gICAgZnJvbV9pbnB1dDogaW50ZXJ2YWxfZnJvbV9pbnB1dFxufVxuIiwiaW1wb3J0IHsgZW5kcG9pbnQsIGludGVydmFsIH0gZnJvbSBcIi4vdXRpbC9pbnRlcnZhbHMuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE5FQVJCWSBJTkRFWFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEFic3RyYWN0IHN1cGVyY2xhc3MgZm9yIE5lYXJieUluZGV4ZS5cbiAqIFxuICogU3VwZXJjbGFzcyB1c2VkIHRvIGNoZWNrIHRoYXQgYSBjbGFzcyBpbXBsZW1lbnRzIHRoZSBuZWFyYnkoKSBtZXRob2QsIFxuICogYW5kIHByb3ZpZGUgc29tZSBjb252ZW5pZW5jZSBtZXRob2RzLlxuICogXG4gKiBORUFSQlkgSU5ERVhcbiAqIFxuICogTmVhcmJ5SW5kZXggcHJvdmlkZXMgaW5kZXhpbmcgc3VwcG9ydCBvZiBlZmZlY3RpdmVseVxuICogbG9va2luZyB1cCByZWdpb25zIGJ5IG9mZnNldCwgXG4gKiBnaXZlbiB0aGF0XG4gKiAoaSkgZWFjaCByZWdpb24gaXMgYXNzb2NpYXRlZCB3aXRoIGFuIGludGVydmFsIGFuZCxcbiAqIChpaSkgcmVnaW9ucyBhcmUgbm9uLW92ZXJsYXBwaW5nLlxuICogXG4gKiBORUFSQllcbiAqIFRoZSBuZWFyYnkgbWV0aG9kIHJldHVybnMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG5laWdoYm9yaG9vZCBcbiAqIGFyb3VuZCBlbmRwb2ludC4gXG4gKiBcbiAqIFJldHVybnMge1xuICogICAgICBjZW50ZXI6IGxpc3Qgb2Ygb2JqZWN0cyBjb3ZlcmVkIGJ5IHJlZ2lvbixcbiAqICAgICAgaXR2OiByZWdpb24gaW50ZXJ2YWwgLSB2YWxpZGl0eSBvZiBjZW50ZXIgXG4gKiAgICAgIGxlZnQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgbGVmdCBcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGhpZ2gtZW5kcG9pbnQgb3IgZW5kcG9pbnQuTkVHX0lORlxuICogICAgICByaWdodDpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSByaWdodFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgbG93LWVuZHBvaW50IG9yIGVuZHRwb2ludC5QT1NfSU5GXG4gKiBcbiAqIFxuICogVGhlIG5lYXJieSBzdGF0ZSBpcyB3ZWxsLWRlZmluZWQgZm9yIGV2ZXJ5IGVuZHBvaW50XG4gKiBvbiB0aGUgdGltZWxpbmUuXG4gKiBcbiAqIElOVEVSVkFMU1xuICogXG4gKiBbbG93LCBoaWdoLCBsb3dJbmNsdXNpdmUsIGhpZ2hJbmNsdXNpdmVdXG4gKiBcbiAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgXG4gKiBhcmUgb3JkZXJlZCBhbmQgYWxsb3dzIGludGVydmFscyB0byBiZSBleGNsdXNpdmUgb3IgaW5jbHVzaXZlLCBcbiAqIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAqIFxuICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG4gKiBcbiAqIFxuICogSU5URVJWQUwgRU5EUE9JTlRTXG4gKiBcbiAqIGludGVydmFsIGVuZHBvaW50cyBhcmUgZGVmaW5lZCBieSBbdmFsdWUsIHR5cGVdLCBmb3IgZXhhbXBsZVxuICogXG4gKiA0KSAtPiBbNCxcIilcIl0gLSBoaWdoIGVuZHBvaW50IGxlZnQgb2YgNFxuICogWzQgLT4gWzQsIFwiW1wiXSAtIGxvdyBlbmRwb2ludCBpbmNsdWRlcyA0XG4gKiA0ICAtPiBbNCwgXCJcIl0gLSB2YWx1ZSA0XG4gKiA0XSAtPiBbNCwgXCJdXCJdIC0gaGlnaCBlbmRwb2ludCBpbmNsdWRlcyA0XG4gKiAoNCAtPiBbNCwgXCIoXCJdIC0gbG93IGVuZHBvaW50IGlzIHJpZ2h0IG9mIDRcbiAqIFxuICovXG5cblxuLyoqXG4gKiByZXR1cm4gZmlyc3QgaGlnaCBlbmRwb2ludCBvbiB0aGUgbGVmdCBmcm9tIG5lYXJieSxcbiAqIHdoaWNoIGlzIG5vdCBpbiBjZW50ZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxlZnRfZW5kcG9pbnQgKG5lYXJieSkge1xuICAgIGNvbnN0IGxvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmVhcmJ5Lml0dilbMF07XG4gICAgcmV0dXJuIGVuZHBvaW50LmZsaXAobG93KTtcbn1cblxuLyoqXG4gKiByZXR1cm4gZmlyc3QgbG93IGVuZHBvaW50IG9uIHRoZSByaWdodCBmcm9tIG5lYXJieSxcbiAqIHdoaWNoIGlzIG5vdCBpbiBjZW50ZXJcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gcmlnaHRfZW5kcG9pbnQgKG5lYXJieSkge1xuICAgIGNvbnN0IGhpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5lYXJieS5pdHYpWzFdO1xuICAgIHJldHVybiBlbmRwb2ludC5mbGlwKGhpZ2gpO1xufVxuXG5cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4QmFzZSB7XG5cblxuICAgIC8qIFxuICAgICAgICBOZWFyYnkgbWV0aG9kXG4gICAgKi9cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICBlbXB0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmlyc3QoKSA9PSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGxvdyBwb2ludCBvZiBsZWZ0bW9zdCBlbnRyeVxuICAgICovXG4gICAgZmlyc3QoKSB7XG4gICAgICAgIGxldCB7Y2VudGVyLCByaWdodH0gPSB0aGlzLm5lYXJieShlbmRwb2ludC5ORUdfSU5GKTtcbiAgICAgICAgaWYgKGNlbnRlci5sZW5ndGggPiAwICkge1xuICAgICAgICAgICAgcmV0dXJuIGVuZHBvaW50Lk5FR19JTkY7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVuZHBvaW50Lmx0KHJpZ2h0LCBlbmRwb2ludC5QT1NfSU5GKSkge1xuICAgICAgICAgICAgcmV0dXJuIHJpZ2h0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZW1wdHlcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICByZXR1cm4gaGlnaCBwb2ludCBvZiByaWdodG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGxhc3QoKSB7XG4gICAgICAgIGxldCB7bGVmdCwgY2VudGVyfSA9IHRoaXMubmVhcmJ5KGVuZHBvaW50LlBPU19JTkYpO1xuICAgICAgICBpZiAoY2VudGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHJldHVybiBlbmRwb2ludC5QT1NfSU5GO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlbmRwb2ludC5ndChsZWZ0LCBlbmRwb2ludC5ORUdfSU5GKSkge1xuICAgICAgICAgICAgcmV0dXJuIGxlZnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBlbXB0eVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIG5lYXJieSBvZiBmaXJzdCByZWdpb24gdG8gdGhlIHJpZ2h0XG4gICAgICogd2hpY2ggaXMgbm90IHRoZSBjZW50ZXIgcmVnaW9uLiBJZiBub3QgZXhpc3RzLCByZXR1cm5cbiAgICAgKiB1bmRlZmluZWQuIFxuICAgICAqL1xuICAgIHJpZ2h0X3JlZ2lvbihuZWFyYnkpIHtcbiAgICAgICAgY29uc3QgcmlnaHQgPSByaWdodF9lbmRwb2ludChuZWFyYnkpO1xuICAgICAgICBpZiAocmlnaHRbMF0gPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5uZWFyYnkocmlnaHQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJldHVybiBuZWFyYnkgb2YgZmlyc3QgcmVnaW9uIHRvIHRoZSBsZWZ0XG4gICAgICogd2hpY2ggaXMgbm90IHRoZSBjZW50ZXIgcmVnaW9uLiBJZiBub3QgZXhpc3RzLCByZXR1cm5cbiAgICAgKiB1bmRlZmluZWQuIFxuICAgICAqL1xuICAgIGxlZnRfcmVnaW9uKG5lYXJieSkge1xuICAgICAgICBjb25zdCBsZWZ0ID0gbGVmdF9lbmRwb2ludChuZWFyYnkpO1xuICAgICAgICBpZiAobGVmdFswXSA9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm5lYXJieShsZWZ0KTsgICAgXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogZmluZCBmaXJzdCByZWdpb24gdG8gdGhlIFwicmlnaHRcIiBvciBcImxlZnRcIlxuICAgICAqIHdoaWNoIGlzIG5vdCB0aGUgY2VudGVyIHJlZ2lvbiwgYW5kIHdoaWNoIG1lZXRzXG4gICAgICogYSBjb25kaXRpb24gb24gbmVhcmJ5LmNlbnRlci5cbiAgICAgKiBEZWZhdWx0IGNvbmRpdGlvbiBpcyBjZW50ZXIgbm9uLWVtcHR5XG4gICAgICogSWYgbm90IGV4aXN0cywgcmV0dXJuIHVuZGVmaW5lZC4gXG4gICAgICovXG4gICAgXG4gICAgZmluZF9yZWdpb24obmVhcmJ5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIGxldCB7XG4gICAgICAgICAgICBkaXJlY3Rpb24gPSAxLFxuICAgICAgICAgICAgY29uZGl0aW9uID0gKGNlbnRlcikgPT4gY2VudGVyLmxlbmd0aCA+IDBcbiAgICAgICAgfSA9IG9wdGlvbnM7XG4gICAgICAgIGxldCBuZXh0X25lYXJieTtcbiAgICAgICAgd2hpbGUodHJ1ZSkge1xuICAgICAgICAgICAgaWYgKGRpcmVjdGlvbiA9PSAxKSB7XG4gICAgICAgICAgICAgICAgbmV4dF9uZWFyYnkgPSB0aGlzLnJpZ2h0X3JlZ2lvbihuZWFyYnkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXh0X25lYXJieSA9IHRoaXMubGVmdF9yZWdpb24obmVhcmJ5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChuZXh0X25lYXJieSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNvbmRpdGlvbihuZXh0X25lYXJieS5jZW50ZXIpKSB7XG4gICAgICAgICAgICAgICAgLy8gZm91bmQgcmVnaW9uIFxuICAgICAgICAgICAgICAgIHJldHVybiBuZXh0X25lYXJieTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHJlZ2lvbiBub3QgZm91bmRcbiAgICAgICAgICAgIC8vIGNvbnRpbnVlIHNlYXJjaGluZyB0aGUgcmlnaHRcbiAgICAgICAgICAgIG5lYXJieSA9IG5leHRfbmVhcmJ5O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVnaW9ucyhvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVnaW9uSXRlcmF0b3IodGhpcywgb3B0aW9ucyk7XG4gICAgfVxuXG59XG5cblxuLypcbiAgICBJdGVyYXRlIHJlZ2lvbnMgb2YgaW5kZXggZnJvbSBsZWZ0IHRvIHJpZ2h0XG5cbiAgICBJdGVyYXRpb24gbGltaXRlZCB0byBpbnRlcnZhbCBbc3RhcnQsIHN0b3BdIG9uIHRoZSB0aW1lbGluZS5cbiAgICBSZXR1cm5zIGxpc3Qgb2YgaXRlbS1saXN0cy5cbiAgICBvcHRpb25zXG4gICAgLSBzdGFydFxuICAgIC0gc3RvcFxuICAgIC0gaW5jbHVkZUVtcHR5XG4qL1xuXG5jbGFzcyBSZWdpb25JdGVyYXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbmRleCwgb3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge1xuICAgICAgICAgICAgc3RhcnQ9LUluZmluaXR5LCBcbiAgICAgICAgICAgIHN0b3A9SW5maW5pdHksIFxuICAgICAgICAgICAgaW5jbHVkZUVtcHR5PXRydWVcbiAgICAgICAgfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzdGFydCA+IHN0b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciAoXCJzdG9wIG11c3QgYmUgbGFyZ2VyIHRoYW4gc3RhcnRcIiwgc3RhcnQsIHN0b3ApXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faW5kZXggPSBpbmRleDtcbiAgICAgICAgdGhpcy5fc3RhcnQgPSBlbmRwb2ludC5mcm9tX2lucHV0KHN0YXJ0KTtcbiAgICAgICAgdGhpcy5fc3RvcCA9IGVuZHBvaW50LmZyb21faW5wdXQoc3RvcCk7XG5cbiAgICAgICAgaWYgKGluY2x1ZGVFbXB0eSkge1xuICAgICAgICAgICAgdGhpcy5fY29uZGl0aW9uID0gKCkgPT4gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbmRpdGlvbiA9IChjZW50ZXIpID0+IGNlbnRlci5sZW5ndGggPiAwO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2N1cnJlbnQ7XG4gICAgfVxuXG4gICAgbmV4dCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBpbml0aWFsc2VcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnQgPSB0aGlzLl9pbmRleC5uZWFyYnkodGhpcy5fc3RhcnQpO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NvbmRpdGlvbih0aGlzLl9jdXJyZW50LmNlbnRlcikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge3ZhbHVlOnRoaXMuX2N1cnJlbnQsIGRvbmU6ZmFsc2V9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGxldCBvcHRpb25zID0ge2NvbmRpdGlvbjp0aGlzLl9jb25kaXRpb24sIGRpcmVjdGlvbjoxfVxuICAgICAgICB0aGlzLl9jdXJyZW50ID0gdGhpcy5faW5kZXguZmluZF9yZWdpb24odGhpcy5fY3VycmVudCwgb3B0aW9ucyk7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZTp1bmRlZmluZWQsIGRvbmU6dHJ1ZX07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4ge3ZhbHVlOnRoaXMuX2N1cnJlbnQsIGRvbmU6ZmFsc2V9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufVxuXG4vKipcbiAqIG5lYXJieV9mcm9tXG4gKiBcbiAqIHV0aWxpdHkgZnVuY3Rpb24gZm9yIGNyZWF0aW5nIGEgbmVhcmJ5IG9iamVjdCBpbiBjaXJjdW1zdGFuY2VzXG4gKiB3aGVyZSB0aGVyZSBhcmUgb3ZlcmxhcHBpbmcgaW50ZXJ2YWxzIFRoaXMgY291bGQgYmUgd2hlbiBhIFxuICogc3RhdGVwcm92aWRlciBmb3IgYSBsYXllciBoYXMgb3ZlcmxhcHBpbmcgaXRlbXMgb3Igd2hlbiBcbiAqIG11bHRpcGxlIG5lYXJieSBpbmRleGVzIGFyZSBtZXJnZWQgaW50byBvbmUuXG4gKiBcbiAqIFxuICogQHBhcmFtIHsqfSBwcmV2X2hpZ2ggOiB0aGUgcmlnaHRtb3N0IGhpZ2gtZW5kcG9pbnQgbGVmdCBvZiBvZmZzZXRcbiAqIEBwYXJhbSB7Kn0gY2VudGVyX2xvd19saXN0IDogbG93LWVuZHBvaW50cyBvZiBjZW50ZXJcbiAqIEBwYXJhbSB7Kn0gY2VudGVyIDogY2VudGVyXG4gKiBAcGFyYW0geyp9IGNlbnRlcl9oaWdoX2xpc3QgOiBoaWdoLWVuZHBvaW50cyBvZiBjZW50ZXJcbiAqIEBwYXJhbSB7Kn0gbmV4dF9sb3cgOiB0aGUgbGVmdG1vc3QgbG93LWVuZHBvaW50IHJpZ2h0IG9mIG9mZnNldFxuICogQHJldHVybnMgXG4gKi9cblxuZnVuY3Rpb24gY21wX2FzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAxLCBwMilcbn1cblxuZnVuY3Rpb24gY21wX2Rlc2NlbmRpbmcocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmNtcChwMiwgcDEpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuZWFyYnlfZnJvbSAoXG4gICAgcHJldl9oaWdoLCBcbiAgICBjZW50ZXJfbG93X2xpc3QsIFxuICAgIGNlbnRlcixcbiAgICBjZW50ZXJfaGlnaF9saXN0LFxuICAgIG5leHRfbG93KSB7XG5cbiAgICAvLyBuZWFyYnlcbiAgICBjb25zdCByZXN1bHQgPSB7Y2VudGVyfTtcblxuICAgIGlmIChjZW50ZXIubGVuZ3RoID09IDApIHtcbiAgICAgICAgLy8gZW1wdHkgY2VudGVyXG4gICAgICAgIHJlc3VsdC5yaWdodCA9IG5leHRfbG93O1xuICAgICAgICByZXN1bHQubGVmdCA9IHByZXZfaGlnaDtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBub24tZW1wdHkgY2VudGVyXG4gICAgICAgIFxuICAgICAgICAvLyBjZW50ZXIgaGlnaFxuICAgICAgICBjZW50ZXJfaGlnaF9saXN0LnNvcnQoY21wX2FzY2VuZGluZyk7XG4gICAgICAgIGxldCBtaW5fY2VudGVyX2hpZ2ggPSBjZW50ZXJfaGlnaF9saXN0WzBdO1xuICAgICAgICBsZXQgbWF4X2NlbnRlcl9oaWdoID0gY2VudGVyX2hpZ2hfbGlzdC5zbGljZSgtMSlbMF07XG4gICAgICAgIGxldCBtdWx0aXBsZV9jZW50ZXJfaGlnaCA9ICFlbmRwb2ludC5lcShtaW5fY2VudGVyX2hpZ2gsIG1heF9jZW50ZXJfaGlnaClcblxuICAgICAgICAvLyBjZW50ZXIgbG93XG4gICAgICAgIGNlbnRlcl9sb3dfbGlzdC5zb3J0KGNtcF9kZXNjZW5kaW5nKTtcbiAgICAgICAgbGV0IG1heF9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0WzBdO1xuICAgICAgICBsZXQgbWluX2NlbnRlcl9sb3cgPSBjZW50ZXJfbG93X2xpc3Quc2xpY2UoLTEpWzBdO1xuICAgICAgICBsZXQgbXVsdGlwbGVfY2VudGVyX2xvdyA9ICFlbmRwb2ludC5lcShtYXhfY2VudGVyX2xvdywgbWluX2NlbnRlcl9sb3cpXG5cbiAgICAgICAgLy8gbmV4dC9yaWdodFxuICAgICAgICBpZiAoZW5kcG9pbnQubGUobmV4dF9sb3csIG1pbl9jZW50ZXJfaGlnaCkpIHtcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IG5leHRfbG93O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gZW5kcG9pbnQuZmxpcChtaW5fY2VudGVyX2hpZ2gpXG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0Lm5leHQgPSAobXVsdGlwbGVfY2VudGVyX2hpZ2gpID8gcmVzdWx0LnJpZ2h0IDogbmV4dF9sb3c7XG5cbiAgICAgICAgLy8gcHJldi9sZWZ0XG4gICAgICAgIGlmIChlbmRwb2ludC5nZShwcmV2X2hpZ2gsIG1heF9jZW50ZXJfbG93KSkge1xuICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSBwcmV2X2hpZ2g7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IGVuZHBvaW50LmZsaXAobWF4X2NlbnRlcl9sb3cpO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5wcmV2ID0gKG11bHRpcGxlX2NlbnRlcl9sb3cpID8gcmVzdWx0LmxlZnQgOiBwcmV2X2hpZ2g7XG5cbiAgICB9XG5cbiAgICAvLyBpbnRlcnZhbCBmcm9tIGxlZnQvcmlnaHRcbiAgICBsZXQgbG93ID0gZW5kcG9pbnQuZmxpcChyZXN1bHQubGVmdCk7XG4gICAgbGV0IGhpZ2ggPSBlbmRwb2ludC5mbGlwKHJlc3VsdC5yaWdodCk7XG4gICAgcmVzdWx0Lml0diA9IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5cbi8qKlxuICogQ3JlYXRlIGEgTmVhcmJ5SW5kZXggZm9yIGEgc3JjIG9iamVjdCBMYXllci5cbiAqIFxuICogVGhlIHNyYyBvYmplY3QgcmVzb2x2ZXMgcXVlcmllcyBmb3IgdGhlIGVudGlyZSB0aW1lbGluZS5cbiAqIEluIG9yZGVyIGZvciB0aGUgZGVmYXVsdCBMYXllckNhY2hlIHRvIHdvcmssIGFuXG4gKiBvYmplY3Qgd2l0aCBhIC5xdWVyeShvZmZzZXQpIG1ldGhvZCBpcyBuZWVkZWQgaW4gXG4gKiBuZWFyYnkuY2VudGVyLlxuICovXG5cbmV4cG9ydCBjbGFzcyBOZWFyYnlJbmRleFNyYyBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihzcmMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fc3JjID0gc3JjO1xuICAgICAgICB0aGlzLl9jYWNoZSA9IHNyYy5jcmVhdGVDYWNoZSgpO1xuICAgIH1cblxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgY29uc3QgbmVhcmJ5ID0gdGhpcy5fc3JjLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICBuZWFyYnkuY2VudGVyID0gW3RoaXMuX2NhY2hlXTtcbiAgICAgICAgcmV0dXJuIG5lYXJieTtcbiAgICB9XG59XG4iLCIvKlxuXHRDb3B5cmlnaHQgMjAyMFxuXHRBdXRob3IgOiBJbmdhciBBcm50emVuXG5cblx0VGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFRpbWluZ3NyYyBtb2R1bGUuXG5cblx0VGltaW5nc3JjIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnlcblx0aXQgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5XG5cdHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yXG5cdChhdCB5b3VyIG9wdGlvbikgYW55IGxhdGVyIHZlcnNpb24uXG5cblx0VGltaW5nc3JjIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsXG5cdGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mXG5cdE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS4gIFNlZSB0aGVcblx0R05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG5cblx0WW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlXG5cdGFsb25nIHdpdGggVGltaW5nc3JjLiAgSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+LlxuKi9cblxuXG5cbi8qXG5cdEV2ZW50XG5cdC0gbmFtZTogZXZlbnQgbmFtZVxuXHQtIHB1Ymxpc2hlcjogdGhlIG9iamVjdCB3aGljaCBkZWZpbmVkIHRoZSBldmVudFxuXHQtIGluaXQ6IHRydWUgaWYgdGhlIGV2ZW50IHN1cHBwb3J0cyBpbml0IGV2ZW50c1xuXHQtIHN1YnNjcmlwdGlvbnM6IHN1YnNjcmlwdGlucyB0byB0aGlzIGV2ZW50XG5cbiovXG5cbmNsYXNzIEV2ZW50IHtcblxuXHRjb25zdHJ1Y3RvciAocHVibGlzaGVyLCBuYW1lLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLnB1Ymxpc2hlciA9IHB1Ymxpc2hlcjtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMuaW5pdCA9IChvcHRpb25zLmluaXQgPT09IHVuZGVmaW5lZCkgPyBmYWxzZSA6IG9wdGlvbnMuaW5pdDtcblx0XHR0aGlzLnN1YnNjcmlwdGlvbnMgPSBbXTtcblx0fVxuXG5cdC8qXG5cdFx0c3Vic2NyaWJlIHRvIGV2ZW50XG5cdFx0LSBzdWJzY3JpYmVyOiBzdWJzY3JpYmluZyBvYmplY3Rcblx0XHQtIGNhbGxiYWNrOiBjYWxsYmFjayBmdW5jdGlvbiB0byBpbnZva2Vcblx0XHQtIG9wdGlvbnM6XG5cdFx0XHRpbml0OiBpZiB0cnVlIHN1YnNjcmliZXIgd2FudHMgaW5pdCBldmVudHNcblx0Ki9cblx0c3Vic2NyaWJlIChjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdGlmICghY2FsbGJhY2sgfHwgdHlwZW9mIGNhbGxiYWNrICE9PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIG5vdCBhIGZ1bmN0aW9uXCIsIGNhbGxiYWNrKTtcblx0XHR9XG5cdFx0Y29uc3Qgc3ViID0gbmV3IFN1YnNjcmlwdGlvbih0aGlzLCBjYWxsYmFjaywgb3B0aW9ucyk7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zLnB1c2goc3ViKTtcblx0ICAgIC8vIEluaXRpYXRlIGluaXQgY2FsbGJhY2sgZm9yIHRoaXMgc3Vic2NyaXB0aW9uXG5cdCAgICBpZiAodGhpcy5pbml0ICYmIHN1Yi5pbml0KSB7XG5cdCAgICBcdHN1Yi5pbml0X3BlbmRpbmcgPSB0cnVlO1xuXHQgICAgXHRsZXQgc2VsZiA9IHRoaXM7XG5cdCAgICBcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgXHRcdGNvbnN0IGVBcmdzID0gc2VsZi5wdWJsaXNoZXIuZXZlbnRpZnlJbml0RXZlbnRBcmdzKHNlbGYubmFtZSkgfHwgW107XG5cdCAgICBcdFx0c3ViLmluaXRfcGVuZGluZyA9IGZhbHNlO1xuXHQgICAgXHRcdGZvciAobGV0IGVBcmcgb2YgZUFyZ3MpIHtcblx0ICAgIFx0XHRcdHNlbGYudHJpZ2dlcihlQXJnLCBbc3ViXSwgdHJ1ZSk7XG5cdCAgICBcdFx0fVxuXHQgICAgXHR9KTtcblx0ICAgIH1cblx0XHRyZXR1cm4gc3ViXG5cdH1cblxuXHQvKlxuXHRcdHRyaWdnZXIgZXZlbnRcblxuXHRcdC0gaWYgc3ViIGlzIHVuZGVmaW5lZCAtIHB1Ymxpc2ggdG8gYWxsIHN1YnNjcmlwdGlvbnNcblx0XHQtIGlmIHN1YiBpcyBkZWZpbmVkIC0gcHVibGlzaCBvbmx5IHRvIGdpdmVuIHN1YnNjcmlwdGlvblxuXHQqL1xuXHR0cmlnZ2VyIChlQXJnLCBzdWJzLCBpbml0KSB7XG5cdFx0bGV0IGVJbmZvLCBjdHg7XG5cdFx0Zm9yIChjb25zdCBzdWIgb2Ygc3Vicykge1xuXHRcdFx0Ly8gaWdub3JlIHRlcm1pbmF0ZWQgc3Vic2NyaXB0aW9uc1xuXHRcdFx0aWYgKHN1Yi50ZXJtaW5hdGVkKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0ZUluZm8gPSB7XG5cdFx0XHRcdHNyYzogdGhpcy5wdWJsaXNoZXIsXG5cdFx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdFx0c3ViOiBzdWIsXG5cdFx0XHRcdGluaXQ6IGluaXRcblx0XHRcdH1cblx0XHRcdGN0eCA9IHN1Yi5jdHggfHwgdGhpcy5wdWJsaXNoZXI7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzdWIuY2FsbGJhY2suY2FsbChjdHgsIGVBcmcsIGVJbmZvKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgRXJyb3IgaW4gJHt0aGlzLm5hbWV9OiAke3N1Yi5jYWxsYmFja30gJHtlcnJ9YCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0dW5zdWJzY3JpYmUgZnJvbSBldmVudFxuXHQtIHVzZSBzdWJzY3JpcHRpb24gcmV0dXJuZWQgYnkgcHJldmlvdXMgc3Vic2NyaWJlXG5cdCovXG5cdHVuc3Vic2NyaWJlKHN1Yikge1xuXHRcdGxldCBpZHggPSB0aGlzLnN1YnNjcmlwdGlvbnMuaW5kZXhPZihzdWIpO1xuXHRcdGlmIChpZHggPiAtMSkge1xuXHRcdFx0dGhpcy5zdWJzY3JpcHRpb25zLnNwbGljZShpZHgsIDEpO1xuXHRcdFx0c3ViLnRlcm1pbmF0ZSgpO1xuXHRcdH1cblx0fVxufVxuXG5cbi8qXG5cdFN1YnNjcmlwdGlvbiBjbGFzc1xuKi9cblxuY2xhc3MgU3Vic2NyaXB0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcihldmVudCwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXHRcdHRoaXMuZXZlbnQgPSBldmVudDtcblx0XHR0aGlzLm5hbWUgPSBldmVudC5uYW1lO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFja1xuXHRcdHRoaXMuaW5pdCA9IChvcHRpb25zLmluaXQgPT09IHVuZGVmaW5lZCkgPyB0aGlzLmV2ZW50LmluaXQgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSBmYWxzZTtcblx0XHR0aGlzLmN0eCA9IG9wdGlvbnMuY3R4O1xuXHR9XG5cblx0dGVybWluYXRlKCkge1xuXHRcdHRoaXMudGVybWluYXRlZCA9IHRydWU7XG5cdFx0dGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmV2ZW50LnVuc3Vic2NyaWJlKHRoaXMpO1xuXHR9XG59XG5cblxuLypcblxuXHRFVkVOVElGWSBJTlNUQU5DRVxuXG5cdEV2ZW50aWZ5IGJyaW5ncyBldmVudGluZyBjYXBhYmlsaXRpZXMgdG8gYW55IG9iamVjdC5cblxuXHRJbiBwYXJ0aWN1bGFyLCBldmVudGlmeSBzdXBwb3J0cyB0aGUgaW5pdGlhbC1ldmVudCBwYXR0ZXJuLlxuXHRPcHQtaW4gZm9yIGluaXRpYWwgZXZlbnRzIHBlciBldmVudCB0eXBlLlxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cbiovXG5cbmV4cG9ydCBmdW5jdGlvbiBldmVudGlmeUluc3RhbmNlIChvYmplY3QpIHtcblx0b2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAgPSBuZXcgTWFwKCk7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRyZXR1cm4gb2JqZWN0O1xufTtcblxuXG4vKlxuXHRFVkVOVElGWSBQUk9UT1RZUEVcblxuXHRBZGQgZXZlbnRpZnkgZnVuY3Rpb25hbGl0eSB0byBwcm90b3R5cGUgb2JqZWN0XG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlQcm90b3R5cGUoX3Byb3RvdHlwZSkge1xuXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5R2V0RXZlbnQob2JqZWN0LCBuYW1lKSB7XG5cdFx0Y29uc3QgZXZlbnQgPSBvYmplY3QuX19ldmVudGlmeV9ldmVudE1hcC5nZXQobmFtZSk7XG5cdFx0aWYgKGV2ZW50ID09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRXZlbnQgdW5kZWZpbmVkXCIsIG5hbWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gZXZlbnQ7XG5cdH1cblxuXHQvKlxuXHRcdERFRklORSBFVkVOVFxuXHRcdC0gdXNlZCBvbmx5IGJ5IGV2ZW50IHNvdXJjZVxuXHRcdC0gbmFtZTogbmFtZSBvZiBldmVudFxuXHRcdC0gb3B0aW9uczoge2luaXQ6dHJ1ZX0gc3BlY2lmaWVzIGluaXQtZXZlbnQgc2VtYW50aWNzIGZvciBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeURlZmluZShuYW1lLCBvcHRpb25zKSB7XG5cdFx0Ly8gY2hlY2sgdGhhdCBldmVudCBkb2VzIG5vdCBhbHJlYWR5IGV4aXN0XG5cdFx0aWYgKHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5oYXMobmFtZSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IGFscmVhZHkgZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2V2ZW50TWFwLnNldChuYW1lLCBuZXcgRXZlbnQodGhpcywgbmFtZSwgb3B0aW9ucykpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T05cblx0XHQtIHVzZWQgYnkgc3Vic2NyaWJlclxuXHRcdHJlZ2lzdGVyIGNhbGxiYWNrIG9uIGV2ZW50LlxuXHQqL1xuXHRmdW5jdGlvbiBvbihuYW1lLCBjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmliZShjYWxsYmFjaywgb3B0aW9ucyk7XG5cdH07XG5cblx0Lypcblx0XHRPRkZcblx0XHQtIHVzZWQgYnkgc3Vic2NyaWJlclxuXHRcdFVuLXJlZ2lzdGVyIGEgaGFuZGxlciBmcm9tIGEgc3BlY2ZpYyBldmVudCB0eXBlXG5cdCovXG5cdGZ1bmN0aW9uIG9mZihzdWIpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBzdWIubmFtZSkudW5zdWJzY3JpYmUoc3ViKTtcblx0fTtcblxuXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5U3Vic2NyaXB0aW9ucyhuYW1lKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSkuc3Vic2NyaXB0aW9ucztcblx0fVxuXG5cblxuXHQvKlxuXHRcdFRyaWdnZXIgbGlzdCBvZiBldmVudEl0ZW1zIG9uIG9iamVjdFxuXG5cdFx0ZXZlbnRJdGVtOiAge25hbWU6Li4sIGVBcmc6Li59XG5cblx0XHRjb3B5IGFsbCBldmVudEl0ZW1zIGludG8gYnVmZmVyLlxuXHRcdHJlcXVlc3QgZW1wdHlpbmcgdGhlIGJ1ZmZlciwgaS5lLiBhY3R1YWxseSB0cmlnZ2VyaW5nIGV2ZW50cyxcblx0XHRldmVyeSB0aW1lIHRoZSBidWZmZXIgZ29lcyBmcm9tIGVtcHR5IHRvIG5vbi1lbXB0eVxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXJBbGwoZXZlbnRJdGVtcykge1xuXHRcdGlmIChldmVudEl0ZW1zLmxlbmd0aCA9PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gbWFrZSB0cmlnZ2VyIGl0ZW1zXG5cdFx0Ly8gcmVzb2x2ZSBub24tcGVuZGluZyBzdWJzY3JpcHRpb25zIG5vd1xuXHRcdC8vIGVsc2Ugc3Vic2NyaXB0aW9ucyBtYXkgY2hhbmdlIGZyb20gcGVuZGluZyB0byBub24tcGVuZGluZ1xuXHRcdC8vIGJldHdlZW4gaGVyZSBhbmQgYWN0dWFsIHRyaWdnZXJpbmdcblx0XHQvLyBtYWtlIGxpc3Qgb2YgW2V2LCBlQXJnLCBzdWJzXSB0dXBsZXNcblx0XHRsZXQgdHJpZ2dlckl0ZW1zID0gZXZlbnRJdGVtcy5tYXAoKGl0ZW0pID0+IHtcblx0XHRcdGxldCB7bmFtZSwgZUFyZ30gPSBpdGVtO1xuXHRcdFx0bGV0IGV2ID0gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKTtcblx0XHRcdGxldCBzdWJzID0gZXYuc3Vic2NyaXB0aW9ucy5maWx0ZXIoc3ViID0+IHN1Yi5pbml0X3BlbmRpbmcgPT0gZmFsc2UpO1xuXHRcdFx0cmV0dXJuIFtldiwgZUFyZywgc3Vic107XG5cdFx0fSwgdGhpcyk7XG5cblx0XHQvLyBhcHBlbmQgdHJpZ2dlciBJdGVtcyB0byBidWZmZXJcblx0XHRjb25zdCBsZW4gPSB0cmlnZ2VySXRlbXMubGVuZ3RoO1xuXHRcdGNvbnN0IGJ1ZiA9IHRoaXMuX19ldmVudGlmeV9idWZmZXI7XG5cdFx0Y29uc3QgYnVmX2xlbiA9IHRoaXMuX19ldmVudGlmeV9idWZmZXIubGVuZ3RoO1xuXHRcdC8vIHJlc2VydmUgbWVtb3J5IC0gc2V0IG5ldyBsZW5ndGhcblx0XHR0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aCA9IGJ1Zl9sZW4gKyBsZW47XG5cdFx0Ly8gY29weSB0cmlnZ2VySXRlbXMgdG8gYnVmZmVyXG5cdFx0Zm9yIChsZXQgaT0wOyBpPGxlbjsgaSsrKSB7XG5cdFx0XHRidWZbYnVmX2xlbitpXSA9IHRyaWdnZXJJdGVtc1tpXTtcblx0XHR9XG5cdFx0Ly8gcmVxdWVzdCBlbXB0eWluZyBvZiB0aGUgYnVmZmVyXG5cdFx0aWYgKGJ1Zl9sZW4gPT0gMCkge1xuXHRcdFx0bGV0IHNlbGYgPSB0aGlzO1xuXHRcdFx0UHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0Zm9yIChsZXQgW2V2LCBlQXJnLCBzdWJzXSBvZiBzZWxmLl9fZXZlbnRpZnlfYnVmZmVyKSB7XG5cdFx0XHRcdFx0Ly8gYWN0dWFsIGV2ZW50IHRyaWdnZXJpbmdcblx0XHRcdFx0XHRldi50cmlnZ2VyKGVBcmcsIHN1YnMsIGZhbHNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxmLl9fZXZlbnRpZnlfYnVmZmVyID0gW107XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHQvKlxuXHRcdFRyaWdnZXIgbXVsdGlwbGUgZXZlbnRzIG9mIHNhbWUgdHlwZSAobmFtZSlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxpa2UobmFtZSwgZUFyZ3MpIHtcblx0XHRyZXR1cm4gdGhpcy5ldmVudGlmeVRyaWdnZXJBbGwoZUFyZ3MubWFwKGVBcmcgPT4ge1xuXHRcdFx0cmV0dXJuIHtuYW1lLCBlQXJnfTtcblx0XHR9KSk7XG5cdH1cblxuXHQvKlxuXHRcdFRyaWdnZXIgc2luZ2xlIGV2ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlcihuYW1lLCBlQXJnKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKFt7bmFtZSwgZUFyZ31dKTtcblx0fVxuXG5cdF9wcm90b3R5cGUuZXZlbnRpZnlEZWZpbmUgPSBldmVudGlmeURlZmluZTtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXIgPSBldmVudGlmeVRyaWdnZXI7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxpa2UgPSBldmVudGlmeVRyaWdnZXJBbGlrZTtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXJBbGwgPSBldmVudGlmeVRyaWdnZXJBbGw7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlTdWJzY3JpcHRpb25zID0gZXZlbnRpZnlTdWJzY3JpcHRpb25zO1xuXHRfcHJvdG90eXBlLm9uID0gb247XG5cdF9wcm90b3R5cGUub2ZmID0gb2ZmO1xufTtcblxuXG5leHBvcnQge2V2ZW50aWZ5SW5zdGFuY2UgYXMgYWRkU3RhdGV9O1xuZXhwb3J0IHtldmVudGlmeVByb3RvdHlwZSBhcyBhZGRNZXRob2RzfTtcblxuLypcblx0RXZlbnQgVmFyaWFibGVcblxuXHRPYmplY3RzIHdpdGggYSBzaW5nbGUgXCJjaGFuZ2VcIiBldmVudFxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50VmFyaWFibGUge1xuXG5cdGNvbnN0cnVjdG9yICh2YWx1ZSkge1xuXHRcdGV2ZW50aWZ5SW5zdGFuY2UodGhpcyk7XG5cdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHR0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcblx0fVxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5fdmFsdWV9O1xuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlICE9IHRoaXMuX3ZhbHVlKSB7XG5cdFx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuZXZlbnRpZnlQcm90b3R5cGUoRXZlbnRWYXJpYWJsZS5wcm90b3R5cGUpO1xuXG4vKlxuXHRFdmVudCBCb29sZWFuXG5cblxuXHROb3RlIDogaW1wbGVtZW50YXRpb24gdXNlcyBmYWxzaW5lc3Mgb2YgaW5wdXQgcGFyYW1ldGVyIHRvIGNvbnN0cnVjdG9yIGFuZCBzZXQoKSBvcGVyYXRpb24sXG5cdHNvIGV2ZW50Qm9vbGVhbigtMSkgd2lsbCBhY3R1YWxseSBzZXQgaXQgdG8gdHJ1ZSBiZWNhdXNlXG5cdCgtMSkgPyB0cnVlIDogZmFsc2UgLT4gdHJ1ZSAhXG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRCb29sZWFuIGV4dGVuZHMgRXZlbnRWYXJpYWJsZSB7XG5cdGNvbnN0cnVjdG9yKHZhbHVlKSB7XG5cdFx0c3VwZXIoQm9vbGVhbih2YWx1ZSkpO1xuXHR9XG5cblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdHN1cGVyLnZhbHVlID0gQm9vbGVhbih2YWx1ZSk7XG5cdH1cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gc3VwZXIudmFsdWV9O1xufVxuXG5cbi8qXG5cdG1ha2UgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gRXZlbnRCb29sZWFuIGNoYW5nZXNcblx0dmFsdWUuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQcm9taXNlKGV2ZW50T2JqZWN0LCBjb25kaXRpb25GdW5jKSB7XG5cdGNvbmRpdGlvbkZ1bmMgPSBjb25kaXRpb25GdW5jIHx8IGZ1bmN0aW9uKHZhbCkge3JldHVybiB2YWwgPT0gdHJ1ZX07XG5cdHJldHVybiBuZXcgUHJvbWlzZSAoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdGxldCBzdWIgPSBldmVudE9iamVjdC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdGlmIChjb25kaXRpb25GdW5jKHZhbHVlKSkge1xuXHRcdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHRcdFx0ZXZlbnRPYmplY3Qub2ZmKHN1Yik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufTtcblxuLy8gbW9kdWxlIGFwaVxuZXhwb3J0IGRlZmF1bHQge1xuXHRldmVudGlmeVByb3RvdHlwZSxcblx0ZXZlbnRpZnlJbnN0YW5jZSxcblx0RXZlbnRWYXJpYWJsZSxcblx0RXZlbnRCb29sZWFuLFxuXHRtYWtlUHJvbWlzZVxufTtcblxuIiwiLypcbiAgICBUaGlzIGRlY29yYXRlcyBhbiBvYmplY3QvcHJvdG90eXBlIHdpdGggYmFzaWMgKHN5bmNocm9ub3VzKSBjYWxsYmFjayBzdXBwb3J0LlxuKi9cblxuY29uc3QgUFJFRklYID0gXCJfX2NhbGxiYWNrXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRTdGF0ZShvYmplY3QpIHtcbiAgICBvYmplY3RbYCR7UFJFRklYfV9oYW5kbGVyc2BdID0gW107XG59XG5cbmZ1bmN0aW9uIGFkZF9jYWxsYmFjayAoaGFuZGxlcikge1xuICAgIGxldCBoYW5kbGUgPSB7XG4gICAgICAgIGhhbmRsZXI6IGhhbmRsZXJcbiAgICB9XG4gICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0ucHVzaChoYW5kbGUpO1xuICAgIHJldHVybiBoYW5kbGU7XG59O1xuXG5mdW5jdGlvbiByZW1vdmVfY2FsbGJhY2sgKGhhbmRsZSkge1xuICAgIGxldCBpbmRleCA9IHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLmluZGV4T2YoaGFuZGxlKTtcbiAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIG5vdGlmeV9jYWxsYmFja3MgKGVBcmcpIHtcbiAgICB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5mb3JFYWNoKGZ1bmN0aW9uKGhhbmRsZSkge1xuICAgICAgICBoYW5kbGUuaGFuZGxlcihlQXJnKTtcbiAgICB9KTtcbn07XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZE1ldGhvZHMgKG9iaikge1xuICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgYWRkX2NhbGxiYWNrLCByZW1vdmVfY2FsbGJhY2ssIG5vdGlmeV9jYWxsYmFja3NcbiAgICB9XG4gICAgT2JqZWN0LmFzc2lnbihvYmosIGFwaSk7XG59XG5cbi8qKlxuICogdGVzdCBpZiBvYmplY3QgaW1wbGVtZW50cyBjYWxsYmFjayBhcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzX2NhbGxiYWNrX2FwaSAob2JqKSB7XG4gICAgaWYgKG9iaiA9PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBtZXRob2RzID0gW1wiYWRkX2NhbGxiYWNrXCIsIFwicmVtb3ZlX2NhbGxiYWNrXCJdO1xuICAgIGZvciAoY29uc3QgcHJvcCBvZiBtZXRob2RzKSB7XG4gICAgICAgIGlmICghKHByb3AgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAodHlwZW9mIG9ialtwcm9wXSAhPSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufVxuIiwiaW1wb3J0IHsgZW5kcG9pbnQsIGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzXCI7XG5cblxuLy8gb3Z2ZXJyaWRlIG1vZHVsbyB0byBiZWhhdmUgYmV0dGVyIGZvciBuZWdhdGl2ZSBudW1iZXJzXG5leHBvcnQgZnVuY3Rpb24gbW9kKG4sIG0pIHtcbiAgICByZXR1cm4gKChuICUgbSkgKyBtKSAlIG07XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZGl2bW9kKHgsIGJhc2UpIHtcbiAgICBsZXQgbiA9IE1hdGguZmxvb3IoeCAvIGJhc2UpXG4gICAgbGV0IHIgPSBtb2QoeCwgYmFzZSk7XG4gICAgcmV0dXJuIFtuLCByXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2Zpbml0ZV9udW1iZXIob2JqKSB7XG4gICAgcmV0dXJuICh0eXBlb2Ygb2JqID09ICdudW1iZXInKSAmJiBpc0Zpbml0ZShvYmopO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tfbnVtYmVyKG5hbWUsIG9iaikge1xuICAgIGlmICghaXNfZmluaXRlX251bWJlcihvYmopKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtuYW1lfSBtdXN0IGJlIGZpbml0ZSBudW1iZXIgJHtvYmp9YCk7XG4gICAgfVxufVxuLypcbiAgICBzaW1pbGFyIHRvIHJhbmdlIGZ1bmN0aW9uIGluIHB5dGhvblxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmdlIChzdGFydCwgZW5kLCBzdGVwID0gMSwgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgIGNvbnN0IHtpbmNsdWRlX2VuZD1mYWxzZX0gPSBvcHRpb25zO1xuICAgIGlmIChzdGVwID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU3RlcCBjYW5ub3QgYmUgemVyby4nKTtcbiAgICB9XG4gICAgaWYgKHN0YXJ0IDwgZW5kKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSBzdGVwKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goaSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHN0YXJ0ID4gZW5kKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA+IGVuZDsgaSAtPSBzdGVwKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goaSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGluY2x1ZGVfZW5kKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGVuZCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cblxuLy8gd2VicGFnZSBjbG9jayAtIHBlcmZvcm1hbmNlIG5vdyAtIHNlY29uZHNcbmV4cG9ydCBjb25zdCBsb2NhbF9jbG9jayA9IGZ1bmN0aW9uIGxvY2FsX2Nsb2NrICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBub3c6ICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBwZXJmb3JtYW5jZS5ub3coKS8xMDAwLjA7XG4gICAgICAgIH1cbiAgICB9XG59KCk7XG5cbi8vIHN5c3RlbSBjbG9jayAtIGVwb2NoIC0gc2Vjb25kc1xuZXhwb3J0IGNvbnN0IGxvY2FsX2Vwb2NoID0gZnVuY3Rpb24gbG9jYWxfZXBvY2ggKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIG5vdzogKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBEYXRlKCkvMTAwMC4wO1xuICAgICAgICB9XG4gICAgfVxufSgpO1xuXG4vKipcbiAqIENyZWF0ZSBhIHNpbmdsZSBzdGF0ZSBmcm9tIGEgbGlzdCBvZiBzdGF0ZXMsIHVzaW5nIGEgdmFsdWVGdW5jXG4gKiBzdGF0ZTp7dmFsdWUsIGR5bmFtaWMsIG9mZnNldH1cbiAqIFxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiB0b1N0YXRlKHNvdXJjZXMsIHN0YXRlcywgb2Zmc2V0LCBvcHRpb25zPXt9KSB7XG4gICAgbGV0IHt2YWx1ZUZ1bmMsIHN0YXRlRnVuY30gPSBvcHRpb25zOyBcbiAgICBpZiAodmFsdWVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBsZXQgdmFsdWUgPSB2YWx1ZUZ1bmMoe3NvdXJjZXMsIHN0YXRlcywgb2Zmc2V0fSk7XG4gICAgICAgIGxldCBkeW5hbWljID0gc3RhdGVzLm1hcCgodikgPT4gdi5keW1hbWljKS5zb21lKGU9PmUpO1xuICAgICAgICByZXR1cm4ge3ZhbHVlLCBkeW5hbWljLCBvZmZzZXR9O1xuICAgIH0gZWxzZSBpZiAoc3RhdGVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gey4uLnN0YXRlRnVuYyh7c291cmNlcywgc3RhdGVzLCBvZmZzZXR9KSwgb2Zmc2V0fTtcbiAgICB9XG4gICAgLy8gbm8gdmFsdWVGdW5jIG9yIHN0YXRlRnVuY1xuICAgIGlmIChzdGF0ZXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTp1bmRlZmluZWQsIGR5bmFtaWM6ZmFsc2UsIG9mZnNldH1cbiAgICB9XG4gICAgLy8gZmFsbGJhY2sgLSBqdXN0IHVzZSBmaXJzdCBzdGF0ZVxuICAgIGxldCBzdGF0ZSA9IHN0YXRlc1swXTtcbiAgICByZXR1cm4gey4uLnN0YXRlLCBvZmZzZXR9OyBcbn1cblxuXG4vKipcbiAqIGNoZWNrIGlucHV0IGl0ZW1zIHRvIGxvY2FsIHN0YXRlIHByb3ZpZGVyc1xuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBjaGVja19pbnB1dChpdGVtcykge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShpdGVtcykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW5wdXQgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICB9XG4gICAgLy8gbWFrZSBzdXJlIHRoYXQgaW50ZXJ2YWxzIGFyZSB3ZWxsIGZvcm1lZFxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuICAgICAgICBpdGVtLml0diA9IGludGVydmFsLmZyb21faW5wdXQoaXRlbS5pdHYpO1xuICAgIH1cbiAgICAvLyBzb3J0IGl0ZW1zIGJhc2VkIG9uIGludGVydmFsIGxvdyBlbmRwb2ludFxuICAgIGl0ZW1zLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgbGV0IGFfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChhLml0dilbMF07XG4gICAgICAgIGxldCBiX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYi5pdHYpWzBdO1xuICAgICAgICByZXR1cm4gZW5kcG9pbnQuY21wKGFfbG93LCBiX2xvdyk7XG4gICAgfSk7XG4gICAgLy8gY2hlY2sgdGhhdCBpdGVtIGludGVydmFscyBhcmUgbm9uLW92ZXJsYXBwaW5nXG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBsZXQgcHJldl9oaWdoID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpIC0gMV0uaXR2KVsxXTtcbiAgICAgICAgbGV0IGN1cnJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpXS5pdHYpWzBdO1xuICAgICAgICAvLyB2ZXJpZnkgdGhhdCBwcmV2IGhpZ2ggaXMgbGVzcyB0aGF0IGN1cnIgbG93XG4gICAgICAgIGlmICghZW5kcG9pbnQubHQocHJldl9oaWdoLCBjdXJyX2xvdykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk92ZXJsYXBwaW5nIGludGVydmFscyBmb3VuZFwiKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmRvbV9zdHJpbmcobGVuZ3RoKSB7XG4gICAgdmFyIHRleHQgPSBcIlwiO1xuICAgIHZhciBwb3NzaWJsZSA9IFwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5elwiO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICB0ZXh0ICs9IHBvc3NpYmxlLmNoYXJBdChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBwb3NzaWJsZS5sZW5ndGgpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRleHQ7XG59XG5cbi8qKlxuICogSW1wcm92ZWQgc2V0X3RpbWVvdXRcbiAqIFxuICogVGltZW91dCBpcyBkZWZpbmVkIGJ5IGEgdGFyZ2V0X21zIHJlYWRpbmcgb2YgcGVyZm9ybWFuY2Uubm93KCkuXG4gKiBDYWxsYmFjayBpcyBub3QgaW52b2tlZCB1bnRpbCBwZXJmb3JtYW5jZS5ub3coKSA+PSB0YXJnZXRfbXMuIFxuICogXG4gKiBUaGlzIHByb3RlY3RzIGFnYWluc3QgYSB3ZWFrbmVzcyBpbiBiYXNpYyBzZXRUaW1lb3V0LCB3aGljaCBtYXlcbiAqIG9jY2F0aW9uYWxseSBpbnZva2UgdGhlIGNhbGxiYWNrIHRvbyBlYXJseS4gXG4gKiBcbiAqIHNjaGVkdWxlIHRpbWVvdXQgMSBtcyBsYXRlLCB0byByZWR1Y2UgdGhlIGxpa2VsaWhvb2Qgb2YgXG4gKiBoYXZpbmcgdG8gcmVzY2hlZHVsZSBhIHRpbWVvdXQgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRfdGltZW91dCAoY2FsbGJhY2ssIGRlbHRhX21zKSB7XG4gICAgbGV0IHRzID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgZGVsdGFfbXMgPSBNYXRoLm1heChkZWx0YV9tcywgMCk7XG4gICAgbGV0IHRhcmdldF9tcyA9IHRzICsgZGVsdGFfbXM7XG4gICAgbGV0IHRpZDtcbiAgICBmdW5jdGlvbiBjYW5jZWxfdGltZW91dCgpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpZCk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGhhbmRsZV90aW1lb3V0KCkge1xuICAgICAgICBjb25zdCBkZWx0YV9tcyA9IHRhcmdldF9tcyAtIHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICBpZiAoZGVsdGFfbXMgPiAwKSB7XG4gICAgICAgICAgICAvLyByZXNjaGVkdWxlIHRpbWVvdXRcbiAgICAgICAgICAgIHRpZCA9IHNldFRpbWVvdXQoaGFuZGxlX3RpbWVvdXQsIGRlbHRhX21zICsgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHRpZCA9IHNldFRpbWVvdXQoaGFuZGxlX3RpbWVvdXQsIGRlbHRhX21zICsgMSk7XG4gICAgcmV0dXJuIHtjYW5jZWw6Y2FuY2VsX3RpbWVvdXR9O1xufVxuXG4vKipcbiAqICBJbXBsZW1lbnRzIGRldGVybWluaXN0aWMgcHJvamVjdGlvbiBiYXNlZCBvbiBpbml0aWFsIGNvbmRpdGlvbnMgXG4gKiAgLSBtb3Rpb24gdmVjdG9yIGRlc2NyaWJlcyBtb3Rpb24gdW5kZXIgY29uc3RhbnQgYWNjZWxlcmF0aW9uXG4gKlxuICogIG1vdGlvbiB0cmFuc2l0aW9uIFxuICogXG4gKiAgdHJhbnNpdGlvbiBmcm9tIHRpbWUgZG9tYWluIHRvIHBvc2l0aW9uIHVuZGVyIGNvbnN0YW50IGFjY2VsZXJhdGlvbiBpcyBnaXZlbiBieVxuICogIGdpdmVuIGluaXRpYWwgdmVjdG9yIFtwMCx2MCxhMCx0MF1cbiAqICBwKHQpID0gcDAgKyB2MCoodC10MCkgKyAwLjUqYTAqKHQtdDApKih0LXQwKVxuICogIHYodCkgPSB2MCArIGEwKih0LXQwKVxuICogIGEodCkgPSBhMFxuICogIHQodCkgPSB0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtb3Rpb25fY2FsY3VsYXRlKHZlY3Rvcix0KSB7XG4gICAgY29uc3QgW3AwLHYwLGEwLHQwXSA9IHZlY3RvcjtcbiAgICBjb25zdCBkID0gdCAtIHQwO1xuICAgIGNvbnN0IHAgPSBwMCArIHYwKmQgKyAwLjUqYTAqTWF0aC5wb3coZCwyKTtcbiAgICBjb25zdCB2ID0gdjAgKyBhMCpkO1xuICAgIGNvbnN0IGEgPSBhMDtcbiAgICByZXR1cm4gW3AsdixhLHRdO1xufVxuXG4vKipcbiAqIEdpdmVuIG1vdGlvbiBkZXRlcm1pbmVkIGZyb20gW3AwLHYwLGEwLHQwXS5cbiAqIEdpdmVuIGVxdWF0aW9uIHAodCkgPSBwMCArIHYwKih0LXQwKSArIDAuNSphMCoodC10MCleMiA9PSBwMVxuICogQ2FsY3VsYXRlIGlmIGVxdWF0aW9uIGhhcyBzb2x1dGlvbnMgZm9yIHNvbWUgcmVhbCBudW1iZXIgdC5cbiAqIEEgc29sdXRpb24gZXhpc3RzIGlmIGRldGVybWluYW50IG9mIHF1YWRyYXRpYyBlcXVhdGlvbiBpcyBub24tbmVnYXRpdmVcbiAqICh2MF4yIC0gMmEwKHAwLXAxKSkgPj0gMFxuICovXG5mdW5jdGlvbiBtb3Rpb25faGFzX3JlYWxfc29sdXRpb25zKHZlY3RvciwgcDEpIHtcbiAgICBjb25zdCBbcDAsdjAsYTAsdDBdID0gdmVjdG9yO1xuICAgIHJldHVybiAoTWF0aC5wb3codjAsMikgLSAyKmEwKihwMC1wMSkpID49IDAuMFxufTtcblxuLyoqXG4gKiBHaXZlbiBtb3Rpb24gZGV0ZXJtaW5lZCBmcm9tIFtwMCx2MCxhMCx0MF0uXG4gKiBHaXZlbiBlcXVhdGlvbiBwKHQpID0gcDAgKyB2MCoodC10MCkgKyAwLjUqYTAqKHQtdDApXjIgPT0gcDFcbiAqIENhbGN1bGF0ZSBhbmQgcmV0dXJuIHJlYWwgc29sdXRpb25zLCBpbiBhc2NlbmRpbmcgb3JkZXIuXG4qLyAgXG5mdW5jdGlvbiBtb3Rpb25fZ2V0X3JlYWxfc29sdXRpb25zICh2ZWN0b3IsIHAxKSB7XG4gICAgY29uc3QgW3AwLHYwLGEwLHQwXSA9IHZlY3RvcjtcbiAgICAvLyBDb25zdGFudCBQb3NpdGlvblxuICAgIGlmIChhMCA9PT0gMC4wICYmIHYwID09PSAwLjApIHtcbiAgICAgICAgaWYgKHAwICE9IHAxKSByZXR1cm4gW107XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gYW55IHQgaXMgYSBzb2x1dGlvblxuICAgICAgICAgICAgLy8gTk9URTogaGFzIHJlYWwgc29sdXRpb25zIGlzIHRydWVcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH07XG4gICAgfVxuICAgIC8vIENvbnN0YW50IG5vbi16ZXJvIFZlbG9jaXR5XG4gICAgaWYgKGEwID09PSAwLjApIHJldHVybiBbdDAgKyAocDEtcDApL3YwXTtcbiAgICAvLyBDb25zdGFudCBBY2NlbGVyYXRpb25cbiAgICBpZiAobW90aW9uX2hhc19yZWFsX3NvbHV0aW9ucyh2ZWN0b3IsIHAxKSA9PT0gZmFsc2UpIHJldHVybiBbXTtcbiAgICAvLyBFeGFjdGx5IG9uIHNvbHV0aW9uXG4gICAgdmFyIGRpc2NyaW1pbmFudCA9IE1hdGgucG93KHYwLDIpIC0gMiphMCoocDAtcDEpO1xuICAgIGlmIChkaXNjcmltaW5hbnQgPT09IDAuMCkge1xuICAgICAgICByZXR1cm4gW3QwLXYwL2EwXTtcbiAgICB9XG4gICAgdmFyIHNxcnQgPSBNYXRoLnNxcnQoTWF0aC5wb3codjAsMikgLSAyKmEwKihwMC1wMSkpO1xuICAgIHZhciBkMSA9IHQwICsgKC12MCArIHNxcnQpL2EwO1xuICAgIHZhciBkMiA9IHQwICsgKC12MCAtIHNxcnQpL2EwO1xuICAgIHJldHVybiBbTWF0aC5taW4oZDEsZDIpLE1hdGgubWF4KGQxLGQyKV07XG59O1xuXG4vKlxuICAgIGNhbGN1bGF0ZSB0aW1lIHJhbmdlIGZvciBnaXZlbiBwb3NpdGlvbiByYW5nZVxuXG4gICAgbW90aW9uIHRyYW5zaXRpb24gZnJvbSB0aW1lIHRvIHBvc2l0aW9uIGlzIGdpdmVuIGJ5XG4gICAgcCh0KSA9IHAwICsgdip0ICsgMC41KmEqdCp0XG4gICAgZmluZCBzb2x1dGlvbnMgZm9yIHQgc28gdGhhdCBcbiAgICBwKHQpID0gcG9zXG5cbiAgICBkbyB0aGlzIGZvciBib3RoIHZhbHVlcyBpbiByYW5nZSBbbG93LGhpZ2hdXG4gICAgYWNjdW11bGF0ZSBhbGwgY2FuZGlkYXRlIHNvbHV0aW9ucyB0IGluIGFzY2VuZGluZyBvcmRlclxuICAgIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICB0aGlzIGNhbiBhY2N1bXVsYXRlIDAsMSwyLDMsNCBzb2x1dGlvblxuICAgIGlmIDAgc29sdXRpb25zIC0gdW5kZWZpbmVkIChtb3Rpb24gZG9lcyBub3QgaW50ZXJzZWN0IHdpdGggcmFuZ2UgZXZlcikgXG4gICAgaWYgMSBzb2x1dGlvbnMgLSB1ZGVmaW5lZCAobW90aW9uIG9ubHkgaW50ZXJzZWN0cyB3aXRoIHJhbmdlIHRhbmdlbnRpYWxseSBhdCBvbmUgdClcbiAgICBpZiAyIHNvbHV0aW9ucyAtIFswLDFdIChtb3Rpb24gaW50ZXJzZWN0cyB3aXRoIHJhbmdlIGF0IHR3byB0aW1lcylcbiAgICBpZiAzIHNvbHV0aW9ucyAtIFswLDJdIChtb3Rpb24gaW50ZXJzZWN0cyB3aXRoIHJhbmdlIGF0IHRocmVlIHRpbWVzKVxuICAgIGlmIDQgc29sdXRpb25zIC0gWzAsMV0gYW5kIFsyLDNdXG5cbiAgICByZXR1cm5zIGEgbGlzdCBvZiByYW5nZSBjYW5kaWRhdGVzIChhdCBtb3N0IHR3byBidXQgb25seSB3aXRoIGFjY2VsZXJhdGlvbilcbiovXG5mdW5jdGlvbiBtb3Rpb25fY2FsY3VsYXRlX3RpbWVfcmFuZ2VzKHZlY3RvciwgcG9zX3JhbmdlKSB7XG4gICAgY29uc3QgW3AwLHYwLGEwLHQwXSA9IHZlY3RvcjtcbiAgICBsZXQgW2xvdywgaGlnaF0gPSBwb3NfcmFuZ2U7XG4gICAgaWYgKGxvdyA9PSBudWxsKSBsb3cgPSAtSW5maW5pdHk7XG4gICAgaWYgKGhpZ2ggPT0gbnVsbCkgaGlnaCA9IEluZmluaXR5O1xuXG4gICAgLy8gWzwtLCAtPl1cbiAgICBpZiAobG93ID09IC1JbmZpbml0eSAmJiBoaWdoID09IEluZmluaXR5KSB7XG4gICAgICAgIC8vIG5vIHBvcyByYW5nZSA9PSBlbnRpcmUgdmFsdWUgc3BhY2UgPT4gdGltZSByYW5nZSBlbnRpcmUgdGltZWxpbmVcbiAgICAgICAgcmV0dXJuIFtbbnVsbCwgbnVsbF1dO1xuICAgIH0gXG5cbiAgICAvLyBbRkxBVCBMSU5FXVxuICAgIC8vIHBvcyBpcyBlaXRoZXIgd2l0aGluIHBvcyByYW5nZSBmb3IgYWxsIHQgb3IgbmV2ZXIgIFxuICAgIGlmICh2MCA9PT0gMC4wICYmIGEwID09PSAwLjApIHtcbiAgICAgICAgLy8gYm90aCBsb3cgYW5kIGhpZ2ggYm91bmRcbiAgICAgICAgcmV0dXJuIChwMCA+PSBsb3cgJiYgcDAgPD0gaGlnaCkgPyBbW251bGwsIG51bGxdXSA6IFtdO1xuICAgIH1cblxuICAgIC8vIGFnZ3JlZ2F0ZSBzb2x1dGlvbnNcbiAgICBsZXQgc29sdXRpb25zID0gW107XG4gICAgaWYgKC1JbmZpbml0eSA8IGxvdykge1xuICAgICAgICBzb2x1dGlvbnMucHVzaCguLi5tb3Rpb25fZ2V0X3JlYWxfc29sdXRpb25zKHZlY3RvciwgbG93KSk7XG4gICAgfSBcbiAgICBpZiAoaGlnaCA8IEluZmluaXR5KSB7XG4gICAgICAgIHNvbHV0aW9ucy5wdXNoKC4uLm1vdGlvbl9nZXRfcmVhbF9zb2x1dGlvbnModmVjdG9yLCBoaWdoKSk7XG4gICAgfVxuICAgIC8vIHJlbW92ZSBkdXBsaWNhdGVzXG4gICAgc29sdXRpb25zID0gWy4uLm5ldyBTZXQoc29sdXRpb25zKV07XG4gICAgLy8gc29ydCBpbiBhc2NlbmRpbmcgb3JkZXJcbiAgICBzb2x1dGlvbnMuc29ydCgoYSxiKSA9PiBhLWIpO1xuXG4gICAgLy8gWzwtLCBISUdIXVxuICAgIGlmIChsb3cgPT0gLUluZmluaXR5KSB7XG4gICAgICAgIC8vIG9ubHkgaGlnaCBib3VuZFxuICAgICAgICBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAvLyBwYXJhYm9sYSBub3QgdG91Y2hpbmcgbG93XG4gICAgICAgICAgICAvLyBwb3MgPCBoaWdoIG9yIHBvcyA+IGhpZ2ggZm9yIGFsbCB0IC0ganVzdCB0ZXN0IHdpdGggdDBcbiAgICAgICAgICAgIHJldHVybiAocDAgPD0gaGlnaCkgPyBbW251bGwsIG51bGxdXSA6IFtdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNvbHV0aW9ucy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgaWYgKGEwID4gMC4wKSB7XG4gICAgICAgICAgICAgICAgLy8gcGFyYWJvbGEgLSB0b3VjaGluZyBoaWdoIGZyb20gb3ZlcnNpZGVcbiAgICAgICAgICAgICAgICAvLyBwb3MgPiBoaWdoIGZvciBhbGwgdFxuICAgICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYTAgPCAwLjApIHtcbiAgICAgICAgICAgICAgICAvLyBwYXJhYm9sYSB0b3VjaGluZyBsb3cgZnJvbSB1bmRlcnNpZGVcbiAgICAgICAgICAgICAgICAvLyBwb3MgPCBoaWdoIGZvciBhbGwgdFxuICAgICAgICAgICAgICAgIHJldHVybiBbW251bGwsIG51bGxdXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gYTAgPT0gMC4wID4gc3RyYWlndGggbGluZVxuICAgICAgICAgICAgICAgIGlmICh2MCA+IDAuMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBwb3MgPD0gaGlnaCBmb3IgYWxsIHQgPD0gc29sdXRpb25zWzBdXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBbW251bGwsIHNvbHV0aW9uc1swXV1dO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHBvcyA8PSBoaWdoIGZvciB0ID49IHNvbHV0aW9uc1swXVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW1tzb2x1dGlvbnNbMF0sIG51bGxdXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAvLyBwYXJhYm9sYVxuICAgICAgICAgICAgaWYgKGEwID4gMC4wKSB7XG4gICAgICAgICAgICAgICAgLy8gb25lIHRpbWUgcmFuZ2UgYmV0d2VlbiBzb2x1dGlvbnNcbiAgICAgICAgICAgICAgICByZXR1cm4gW1tzb2x1dGlvbnNbMF0sIHNvbHV0aW9uc1sxXV1dO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhMCA8IDAuMCkge1xuICAgICAgICAgICAgICAgIC8vIG9uZSB0aW1lIHJhbmdlIG9uIGVhY2ggc2lkZSBcbiAgICAgICAgICAgICAgICByZXR1cm4gW1tudWxsLCBzb2x1dGlvbnNbMF1dLCBbc29sdXRpb25zWzFdLCBudWxsXV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG4gICAgLy8gW0xPVywgLT5dXG4gICAgfSBlbHNlIGlmIChoaWdoID09IEluZmluaXR5KSB7XG4gICAgICAgIC8vIG9ubHkgbG93IGJvdW5kXG4gICAgICAgIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIC8vIHBhcmFib2xhIG5vdCB0b3VjaGluZyBsb3dcbiAgICAgICAgICAgIC8vIHBvcyA+IGxvdyBvciBwb3MgPCBsb3cgZm9yIGFsbCB0IC0ganVzdCB0ZXN0IHdpdGggdDBcbiAgICAgICAgICAgIHJldHVybiAocDAgPj0gbG93KSA/IFtbbnVsbCwgbnVsbF1dIDogW107XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICBpZiAoYTAgPiAwLjApIHtcbiAgICAgICAgICAgICAgICAvLyBwYXJhYm9sYSAtIHRvdWNoaW5nIGxvdyBmcm9tIG92ZXJzaWRlXG4gICAgICAgICAgICAgICAgLy8gcG9zID4gbG93IGZvciBhbGwgdFxuICAgICAgICAgICAgICAgIHJldHVybiBbW251bGwsIG51bGxdXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYTAgPCAwLjApIHtcbiAgICAgICAgICAgICAgICAvLyBwYXJhYm9sYSB0b3VjaGluZyBsb3cgZnJvbSB1bmRlcnNpZGVcbiAgICAgICAgICAgICAgICAvLyBwb3MgPCBsb3cgZm9yIGFsbCB0XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBhMCA9PSAwLjAgPiBzdHJhaWd0aCBsaW5lXG4gICAgICAgICAgICAgICAgaWYgKHYwID4gMC4wKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHBvcyA+PSBsb3cgZm9yIGFsbCB0ID49IHNvbHV0aW9uc1swXVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW1tzb2x1dGlvbnNbMF0sIG51bGxdXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBwb3MgPj0gbG93IGZvciB0IDw9IHNvbHV0aW9uc1swXVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW1tudWxsLCBzb2x1dGlvbnNbMF1dXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAvLyBwYXJhYm9sYVxuICAgICAgICAgICAgaWYgKGEwID4gMC4wKSB7XG4gICAgICAgICAgICAgICAgLy8gb25lIHRpbWUgcmFuZ2Ugb24gZWFjaCBzaWRlIFxuICAgICAgICAgICAgICAgIHJldHVybiBbW251bGwsIHNvbHV0aW9uc1swXV0sIFtzb2x1dGlvbnNbMV0sIG51bGxdXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYTAgPCAwLjApIHtcbiAgICAgICAgICAgICAgICAvLyBvbmUgdGltZSByYW5nZSBiZXR3ZWVuIHNvbHV0aW9uc1xuICAgICAgICAgICAgICAgIHJldHVybiBbW3NvbHV0aW9uc1swXSwgc29sdXRpb25zWzFdXV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIC8vIFtMT1csIEhJR0hdXG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gYm90aCBsb3cgYW5kIGhpZ2ggYm91bmRcbiAgICAgICAgaWYgKHNvbHV0aW9ucy5sZW5ndGggPT0gMCkgcmV0dXJuIFtdO1xuICAgICAgICBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAxKSByZXR1cm4gW107XG4gICAgICAgIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDIpIHJldHVybiBbW3NvbHV0aW9uc1swXSwgc29sdXRpb25zWzFdXV07XG4gICAgICAgIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDMpIHJldHVybiBbW3NvbHV0aW9uc1swXSwgc29sdXRpb25zWzJdXV07XG4gICAgICAgIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDQpIHJldHVybiBbW3NvbHV0aW9uc1swXSwgc29sdXRpb25zWzFdXSwgW3NvbHV0aW9uc1syXSwgc29sdXRpb25zWzNdXV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBtb3Rpb25fY2hlY2tfcmFuZ2Uob2JqKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSAmJiBvYmoubGVuZ3RoICE9IDIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGByYW5nZSBtdXN0IGhhdmUgdHdvIGVsZW1lbnRzICR7b2JqfWApO1xuICAgIH1cbiAgICBvYmpbMF0gPT0gbnVsbCB8fCBjaGVja19udW1iZXIoXCJsb3dcIiwgb2JqWzBdKTtcbiAgICBvYmpbMV0gPT0gbnVsbCB8fCBjaGVja19udW1iZXIoXCJoaWdoXCIsIG9ialsxXSk7XG59XG5cbmV4cG9ydCBjb25zdCBtb3Rpb25fdXRpbHMgPSB7XG4gICAgY2FsY3VsYXRlOiBtb3Rpb25fY2FsY3VsYXRlLFxuICAgIGhhc19yZWFsX3NvbHV0aW9uczogbW90aW9uX2hhc19yZWFsX3NvbHV0aW9ucyxcbiAgICBnZXRfcmVhbF9zb2x1dGlvbnM6IG1vdGlvbl9nZXRfcmVhbF9zb2x1dGlvbnMsXG4gICAgY2FsY3VsYXRlX3RpbWVfcmFuZ2VzOiBtb3Rpb25fY2FsY3VsYXRlX3RpbWVfcmFuZ2VzLFxuICAgIGNoZWNrX3JhbmdlOiBtb3Rpb25fY2hlY2tfcmFuZ2Vcbn1cbiIsImltcG9ydCAqIGFzIGV2ZW50aWZ5IGZyb20gXCIuL3V0aWwvYXBpX2V2ZW50aWZ5LmpzXCI7XG5pbXBvcnQgKiBhcyBjYWxsYmFjayBmcm9tIFwiLi91dGlsL2FwaV9jYWxsYmFjay5qc1wiO1xuaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi91dGlsL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgcmFuZ2UsIHRvU3RhdGUgfSBmcm9tIFwiLi91dGlsL2NvbW1vbi5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMYXllciBpcyBhYnN0cmFjdCBiYXNlIGNsYXNzIGZvciBMYXllcnNcbiAqIFxuICogTGF5ZXIgaW50ZXJmYWNlIGlzIGRlZmluZWQgYnkgKGluZGV4LCBDYWNoZUNsYXNzLCBvcHRpb25zKVxuICogXG4gKiBDYWNoZUNsYXNzXG4gKiAtLS0tLS0tLS0tXG4gKiBUaGUgQ2FjaGVDbGFzcyBpbXBsZW1lbnRzIHRoZSBxdWVyeSBvcGVyYXRpb24gZm9yIHRoZSBsYXllciwgdXNpbmdcbiAqIHRoZSBpbmRleCBmb3IgbG9va3VwcyBvbiBjYWNoZSBtaXNzLiBMYXllciBoYXMgYSBwcml2YXRlIGNhY2hlLiBcbiAqIEFkZGl0aW9uYWxseSwgaWYgbGF5ZXIgaGFzIG11bHRpcGxlIGNvbnN1bWVycywgdGhleSBjYW4gZWFjaCBcbiAqIGNyZWF0ZSB0aGVpciBvd24gcHJpdmF0ZSBjYWNoZS4gXG4gKiBcbiAqIG9wdGlvbnNcbiAqIC0tLS0tLS1cbiAqIFRoZSB0aGUgcmVzdWx0IGZyb20gdGhlIHF1ZXJ5IG9wZXJhdGlvbiBjYW4gYmUgY29udHJvbGxlZCBieSBzdXBwbHlpbmdcbiAqIG9wdGlvbmFsIGN1c3RvbSBmdW5jdGlvbiwgZWl0aGVyIHZhbHVlRnVuYyBvciBhIHN0YXRlRnVuYyBcbiAqIHt2YWx1ZUZ1bmMsc3RhdGVGdW5jfVxuICogXG4gKiBpbmRleFxuICogLS0tLS1cbiAqIFRoZSBuZWFyYnkgaW5kZXggaXMgc3VwcGxpZWQgYnkgTGF5ZXIgaW1wbGVtZW50YXRpb25zLCBlaXRoZXIgYnkgXG4gKiBzdWJjbGFzc2luZyBpdCwgb3IgYnkgYXNzaWduaW5nIHRoZSBpbmRleC4gXG4gKi9cblxuZXhwb3J0IGNsYXNzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcblxuICAgICAgICBsZXQge0NhY2hlQ2xhc3M9TGF5ZXJDYWNoZSwgLi4ub3B0c30gPSBvcHRpb25zOyBcblxuICAgICAgICAvLyBsYXllciBvcHRpb25zXG4gICAgICAgIHRoaXMuX29wdGlvbnMgPSBvcHRzO1xuXG4gICAgICAgIC8vIGNhbGxiYWNrc1xuICAgICAgICBjYWxsYmFjay5hZGRTdGF0ZSh0aGlzKTtcbiAgICAgICAgLy8gZGVmaW5lIGNoYW5nZSBldmVudFxuICAgICAgICBldmVudGlmeS5hZGRTdGF0ZSh0aGlzKTtcbiAgICAgICAgdGhpcy5ldmVudGlmeURlZmluZShcImNoYW5nZVwiLCB7aW5pdDp0cnVlfSk7XG5cbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgdGhpcy5pbmRleDtcblxuICAgICAgICAvLyBjYWNoZVxuICAgICAgICB0aGlzLl9DYWNoZUNsYXNzID0gQ2FjaGVDbGFzcztcbiAgICAgICAgdGhpcy5fcHJpdmF0ZV9jYWNoZTtcbiAgICAgICAgdGhpcy5fY29uc3VtZXJfY2FjaGVzID0gW107XG4gICAgfVxuXG4gICAgLy8gbGF5ZXIgb3B0aW9uc1xuICAgIGdldCBvcHRpb25zICgpIHsgcmV0dXJuIHRoaXMuX29wdGlvbnM7IH1cblxuICAgIC8vIHByaXZhdGUgY2FjaGVcbiAgICBnZXQgY2FjaGUgKCkge1xuICAgICAgICBpZiAodGhpcy5fcHJpdmF0ZV9jYWNoZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3ByaXZhdGVfY2FjaGUgPSBuZXcgdGhpcy5fQ2FjaGVDbGFzcyh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fcHJpdmF0ZV9jYWNoZTtcbiAgICB9XG5cbiAgICAvLyBpbnZva2VkIGJ5IGxheWVyIGNvbnN1bWVyXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhY2hlLnF1ZXJ5KG9mZnNldCk7XG4gICAgfVxuXG4gICAgLy8gaW52b2tlZCBieSBsYXllciBjb25zdW1lclxuICAgIGNyZWF0ZUNhY2hlICgpIHtcbiAgICAgICAgY29uc3QgY2FjaGUgPSBuZXcgdGhpcy5fQ2FjaGVDbGFzcyh0aGlzKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZXJfY2FjaGVzLnB1c2goY2FjaGUpO1xuICAgICAgICByZXR1cm4gY2FjaGU7XG4gICAgfVxuICAgIHJlbGVhc2VDYWNoZSAoY2FjaGUpIHtcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5fY29uc3VtZXJfY2FjaGVzLmluZGV4T2YoY2FjaGUpO1xuICAgICAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbnN1bWVyX2NhY2hlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgY2xlYXJDYWNoZXMoKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2FjaGUgb2YgdGhpcy5fY29uc3VtZXJfY2FjaGVzKXtcbiAgICAgICAgICAgIGNhY2hlLmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX3ByaXZhdGVfY2FjaGUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9wcml2YXRlX2NhY2hlLmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpbnZva2VkIGJ5IHN1YmNsYXNzIHdoZW5ldmVyIGxheWVyIGhhcyBjaGFuZ2VkXG4gICAgb25jaGFuZ2UoKSB7XG4gICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIpOyAgICBcbiAgICB9XG5cbiAgICAvLyBpdGVyYXRvciBmb3IgcmVnaW9ucyBvZiB0aGUgbGF5ZXIgaW5kZXhcbiAgICByZWdpb25zIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluZGV4LnJlZ2lvbnMob3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgU2FtcGxlIGxheWVyIHZhbHVlcyBieSB0aW1lbGluZSBvZmZzZXQgaW5jcmVtZW50c1xuICAgICAgICByZXR1cm4gbGlzdCBvZiB0dXBsZXMgW3ZhbHVlLCBvZmZzZXRdXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICAgLSBzdGFydFxuICAgICAgICAtIHN0b3BcbiAgICAgICAgLSBzdGVwXG5cbiAgICAgICAgVE9ETyAtIHRoaXMgc2hvdWxkIGJlIGFuIGl0ZXJhdG9yXG4gICAgKi9cbiAgICBzYW1wbGUob3B0aW9ucz17fSkge1xuICAgICAgICBpZiAodGhpcy5pbmRleC5lbXB0eSgpKSB7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHtzdGFydCwgc3RvcCwgc3RlcD0xfSA9IG9wdGlvbnM7XG4gICAgICAgIFxuICAgICAgICBpZiAoc3RhcnQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiBpbmRleC5maXJzdCBpcyBhIG51bWJlclxuICAgICAgICAgICAgY29uc3QgZmlyc3QgPSB0aGlzLmluZGV4LmZpcnN0KCk7XG4gICAgICAgICAgICBpZiAoZmlyc3RbMF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHN0YXJ0ID0gZmlyc3RbMF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInVuZGVmaW5lZCBzdGFydFwiKTtcbiAgICAgICAgICAgIH0gICAgXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0b3AgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiBpbmRleC5sYXN0IGlzIGEgbnVtYmVyXG4gICAgICAgICAgICBjb25zdCBsYXN0ID0gdGhpcy5pbmRleC5sYXN0KCk7XG4gICAgICAgICAgICBpZiAobGFzdFswXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgc3RvcCA9IGxhc3RbMF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInVuZGVmaW5lZCBzdG9wXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzdGFydCA+IHN0b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciAoXCJzdG9wIG11c3QgYmUgbGFyZ2VyIHRoYW4gc3RhcnRcIiwgc3RhcnQsIHN0b3ApXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmNyZWF0ZUNhY2hlKCk7XG4gICAgICAgIGNvbnN0IHNhbXBsZXMgPSByYW5nZShzdGFydCwgc3RvcCwgc3RlcCwge2luY2x1ZGVfZW5kOnRydWV9KVxuICAgICAgICAgICAgLm1hcCgob2Zmc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtjYWNoZS5xdWVyeShvZmZzZXQpLnZhbHVlLCBvZmZzZXRdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmVsZWFzZUNhY2hlKGNhY2hlKTtcbiAgICAgICAgcmV0dXJuIHNhbXBsZXM7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkTWV0aG9kcyhMYXllci5wcm90b3R5cGUpO1xuZXZlbnRpZnkuYWRkTWV0aG9kcyhMYXllci5wcm90b3R5cGUpO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExBWUVSIENBQ0hFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIExheWVyIENhY2hlIGlzIHRoZSByZWd1bGFyIGNhY2hlIHR5cGUsIGludGVuZGVkIGZvclxuICogX2Rlcml2ZWRfIExheWVycyAtIHRoYXQgaXMgYSBsYXllcnMgd2hpY2ggaW5kZXggcmVmZXJlbmNlc1xuICogb3RoZXIgc291cmNlIGxheWVycy5cbiAqIFxuICogQSBxdWVyeSBpcyByZXNvbHZlZCBieSBpZGVudGlmeWluZyB0aGUgcmVsZXZhbnQgcmVnaW9uIGluXG4gKiB0aGUgbmVhcmJ5IGluZGV4IChpbmRleC5uZWFyYnkob2Zmc2V0KSksIGFuZCB0aGVuIHF1ZXJ5aW5nIFxuICogdGhlIHN0YXRlIG9mIGFsbCB0aGUgb2JqZWN0cyBmb3VuZCBpbiB0aGUgcmVnaW9uIChuZWFyYnkuY2VudGVyKS5cbiAqICBcbiAqIE9wdGlvbnMge3ZhbHVlRnVuYyBvciBzdGF0ZUZ1bmN9IGFyZSB1c2VkIHRvIGNvbXB1dGUgYSBcbiAqIHNpbmdsZSBxdWVyeSByZXN1bHQgZnJvbSB0aGUgbGlzdCBvZiBzdGF0ZXMuXG4gKiBcbiAqIFRoZSByZXN1bHQgc3RhdGUgaXMgb25seSBjYWNoZWQgaWYgaXQgaXMgc3RhdGljLlxuICogQ2FjaGUgbWlzcyBpcyB0cmlnZ2VyZWQgaWYgbm8gc3RhdGUgaGFzIGJlZW4gY2FjaGVkLCBvciBpZiBcbiAqIG9mZnNldCBpcyBvdXRzaWRlIHRoZSByZWdpb24gb2YgdGhlIGNhY2hlZCBzdGF0ZS5cbiAqIFxuICovXG5cbmV4cG9ydCBjbGFzcyBMYXllckNhY2hlIHtcblxuICAgIGNvbnN0cnVjdG9yKGxheWVyKSB7XG4gICAgICAgIC8vIGNhY2hlIGJlbG9uZ3MgdG8gbGF5ZXJcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgLy8gY2FjaGVkIG5lYXJieSBzdGF0ZVxuICAgICAgICB0aGlzLl9uZWFyYnk7XG4gICAgICAgIC8vIGNhY2hlZCBzdGF0ZVxuICAgICAgICB0aGlzLl9zdGF0ZTtcbiAgICB9XG5cbiAgICBnZXQgbGF5ZXIoKSB7cmV0dXJuIHRoaXMuX2xheWVyfTtcblxuICAgIC8qKlxuICAgICAqIHF1ZXJ5IGNhY2hlXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IG5lZWRfaW5kZXhfbG9va3VwID0gKFxuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgIWludGVydmFsLmNvdmVyc19lbmRwb2ludCh0aGlzLl9uZWFyYnkuaXR2LCBvZmZzZXQpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICFuZWVkX2luZGV4X2xvb2t1cCAmJiBcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlICE9IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgIXRoaXMuX3N0YXRlLmR5bmFtaWNcbiAgICAgICAgKSB7XG4gICAgICAgICAgICAvLyBjYWNoZSBoaXRcbiAgICAgICAgICAgIHJldHVybiB7Li4udGhpcy5fc3RhdGUsIG9mZnNldH07XG4gICAgICAgIH1cbiAgICAgICAgLy8gY2FjaGUgbWlzc1xuICAgICAgICBpZiAobmVlZF9pbmRleF9sb29rdXApIHtcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICB9XG4gICAgICAgIC8vIHBlcmZvcm0gcXVlcmllc1xuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9uZWFyYnkuY2VudGVyLm1hcCgoY2FjaGUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBjYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gY2FsY3VsYXRlIHNpbmdsZSByZXN1bHQgc3RhdGVcbiAgICAgICAgY29uc3Qgc3RhdGUgPSB0b1N0YXRlKHRoaXMuX25lYXJieS5jZW50ZXIsIHN0YXRlcywgb2Zmc2V0LCB0aGlzLl9sYXllci5vcHRpb25zKTtcbiAgICAgICAgLy8gY2FjaGUgc3RhdGUgb25seSBpZiBub3QgZHluYW1pY1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IChzdGF0ZS5keW5hbWljKSA/IHVuZGVmaW5lZCA6IHN0YXRlO1xuICAgICAgICByZXR1cm4gc3RhdGUgICAgXG4gICAgfVxuXG4gICAgY2xlYXIoKSB7XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG4iLCJpbXBvcnQgeyBsb2NhbF9jbG9jayB9IGZyb20gXCIuL2NvbW1vbi5qc1wiO1xuXG4vKipcbiAqIHBvbGxpbmcgYSBjYWxsYmFjayBmdW5jdGlvbiBwZXJpb2RpY2FsbHkgd2l0aCBcbiAqIGEgZml4ZWQgZGVsYXkgKG1zKS5cbiAqIElmIGRlbGF5IGlzIDAsIHVzZSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXG4gKiBlbHNlIHVzZSBzZXRUaW1lb3V0LlxuICogRGVsYXkgY2FuIGJlIHNldCBkeW5hbWljYWxseS4gUGF1c2UgYW5kIHJlc3VtZVxuICogaXMgbmVlZGVkIGZvciBuZXcgZGVsYXkgdG8gdGFrZSBlZmZlY3QuXG4gKi9cblxuY2xhc3MgUG9sbGVyIHtcblxuICAgIGNvbnN0cnVjdG9yKGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuX2NhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgICAgIHRoaXMuX2hhbmRsZTtcbiAgICAgICAgdGhpcy5fZGVsYXk7XG4gICAgfVxuICAgIFxuICAgIHNldCBkZWxheSAoZGVsYXlfbXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBkZWxheV9tcyAhPSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGRlbGF5IG11c3QgYmUgYSBudW1iZXIgJHtkZWxheV9tc31gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fZGVsYXkgIT0gZGVsYXlfbXMpIHsgICBcbiAgICAgICAgICAgIHRoaXMuX2RlbGF5ID0gZGVsYXlfbXM7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZ2V0IGRlbGF5ICgpIHtyZXR1cm4gdGhpcy5fZGVsYXk7fVxuXG4gICAgaXNfcG9sbGluZyAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oYW5kbGUgIT0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHBhdXNlKCkge1xuICAgICAgICBpZiAodGhpcy5faGFuZGxlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlLmNhbmNlbCgpO1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcG9sbCgpIHtcbiAgICAgICAgLy8gcG9sbCBjYWxsYmFja1xuICAgICAgICB0aGlzLl9jYWxsYmFjaygpO1xuICAgICAgICAvLyBzY2hlZHVsZSBuZXh0IHBvbGxcbiAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgICB0aGlzLnJlc3VtZSgpO1xuICAgIH1cblxuICAgIHJlc3VtZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2hhbmRsZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9kZWxheSA9PSAwKSB7XG4gICAgICAgICAgICAgICAgLy8gZnJhbWVyYXRlXG4gICAgICAgICAgICAgICAgY29uc3QgYWlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMucG9sbC5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGUgPSB7Y2FuY2VsOiAoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShhaWQpfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gdGltZW91dFxuICAgICAgICAgICAgICAgIGNvbnN0IHRpZCA9IHNldFRpbWVvdXQodGhpcy5wb2xsLmJpbmQodGhpcyksIHRoaXMuX2RlbGF5KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGUgPSB7Y2FuY2VsOiAoKSA9PiBjbGVhclRpbWVvdXQodGlkKX07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogQ3Vyc29yIE1vbml0b3JcbiAqL1xuXG5jbGFzcyBDdXJzb3JNb25pdG9yIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgLypcbiAgICAgICAgICAgIHNldCBvZiBiaW5kaW5nc1xuICAgICAgICAgICAgcG9sbCBjdXJzb3IgKHdoZW4gZHluYW1pYykgcGVyaW9kaWNhbGx5IHdpdGggZ2l2ZW4gKG1pbmltdW0pIGRlbGF5LCBhbmQgaW52b2tlIGNhbGxiYWNrIHdpdGggY3Vyc29yIHN0YXRlIFxuICAgICAgICAgICAgYmluZGluZyA6IHtjdXJzb3IsIGNhbGxiYWNrLCBkZWxheV9tc31cbiAgICAgICAgICAgIC0gY3Vyc29yOlxuICAgICAgICAgICAgLSBjYWxsYmFjazogZnVuY3Rpb24oc3RhdGUpXG4gICAgICAgICAgICAtIGRlbGF5OiAobXMpIGJldHdlZW4gc2FtcGxlcyAod2hlbiB2YXJpYWJsZSBpcyBkeW5hbWljKVxuICAgICAgICAgICAgdGhlcmUgY2FuIGJlIG11bHRpcGxlIGJpbmRpbmdzIGZvciB0aGUgc2FtZSBjdXJzb3JcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmluZGluZ19zZXQgPSBuZXcgU2V0KCk7XG5cbiAgICAgICAgLypcbiAgICAgICAgICAgIGN1cnNvcnNcbiAgICAgICAgICAgIG1hcDogY3Vyc29yIC0+IHtzdWIsIHBvbGxpbmcsIGJpbmRpbmdzOltdfVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jdXJzb3JfbWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIC8vIFBvbGxlclxuICAgICAgICB0aGlzLl9wb2xsZXIgPSBuZXcgUG9sbGVyKHRoaXMub25wb2xsLmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGJpbmQoY3Vyc29yLCBjYWxsYmFjaywgZGVsYXkpIHtcbiAgICAgICAgLy8gY2hlY2sgZGVsYXlcbiAgICAgICAgaWYgKGRlbGF5ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGVsYXkgPSAwO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkZWxheSAhPSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGRlbGF5IG11c3QgYmUgYSBudW1iZXIgJHtkZWxheX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyByZWdpc3RlciBiaW5kaW5nXG4gICAgICAgIGxldCBiaW5kaW5nID0ge2N1cnNvciwgY2FsbGJhY2ssIGRlbGF5fTtcbiAgICAgICAgdGhpcy5fYmluZGluZ19zZXQuYWRkKGJpbmRpbmcpO1xuICAgICAgICAvLyByZWdpc3RlciBjdXJzb3JcbiAgICAgICAgaWYgKCF0aGlzLl9jdXJzb3JfbWFwLmhhcyhjdXJzb3IpKSB7IFxuICAgICAgICAgICAgbGV0IHN1YiA9IGN1cnNvci5vbihcImNoYW5nZVwiLCB0aGlzLm9uY3Vyc29yY2hhbmdlLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgdGhpcy5fY3Vyc29yX21hcC5zZXQoY3Vyc29yLCB7XG4gICAgICAgICAgICAgICAgc3ViLCBwb2xsaW5nOiBmYWxzZSwgYmluZGluZ3M6IFtiaW5kaW5nXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jdXJzb3JfbWFwLmdldChjdXJzb3IpLmJpbmRpbmdzLnB1c2goYmluZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJpbmRpbmc7XG4gICAgfVxuXG4gICAgcmVsZWFzZSAoYmluZGluZykge1xuICAgICAgICAvLyB1bnJlZ2lzdGVyIGJpbmRpbmdcbiAgICAgICAgY29uc3QgcmVtb3ZlZCA9IHRoaXMuX2JpbmRpbmdfc2V0LmRlbGV0ZShiaW5kaW5nKTtcbiAgICAgICAgaWYgKCFyZW1vdmVkKSByZXR1cm47XG4gICAgICAgIC8vIGNsZWFudXBcbiAgICAgICAgY29uc3QgY3Vyc29yID0gYmluZGluZy5jdXJzb3I7XG4gICAgICAgIGNvbnN0IHtzdWIsIGJpbmRpbmdzfSA9IHRoaXMuX2N1cnNvcl9tYXAuZ2V0KGN1cnNvcik7XG4gICAgICAgIC8vIHJlbW92ZSBiaW5kaW5nXG4gICAgICAgIGNvbnN0IGlkeCA9IGJpbmRpbmdzLmluZGV4T2YoYmluZGluZyk7XG4gICAgICAgIGlmIChpZHggPj0gMCkge1xuICAgICAgICAgICAgYmluZGluZ3Muc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJpbmRpbmdzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAvLyBubyBtb3JlIGJpbmRpbmdzXG4gICAgICAgICAgICBjdXJzb3Iub2ZmKHN1Yik7XG4gICAgICAgICAgICB0aGlzLl9jdXJzb3JfbWFwLmRlbGV0ZShjdXJzb3IpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYSBjdXJzb3IgaGFzIGNoYW5nZWRcbiAgICAgKiBmb3J3YXJkIGNoYW5nZSBldmVudCB0byBhbGwgY2FsbGJhY2tzIGZvciB0aGlzIGN1cnNvci5cbiAgICAgKiBhbmQgcmVldmFsdWF0ZSBwb2xsaW5nIHN0YXR1cywgcGF1c2luZyBvciByZXN1bWluZ1xuICAgICAqIHBvbGxpbmcgaWYgbmVlZGVkLlxuICAgICAqL1xuICAgIG9uY3Vyc29yY2hhbmdlKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIGNvbnN0IGN1cnNvciA9IGVJbmZvLnNyYztcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBlQXJnO1xuICAgICAgICAvLyByZWV2YWx1YXRlIHBvbGxpbmcgc3RhdHVzXG4gICAgICAgIHRoaXMuX2N1cnNvcl9tYXAuZ2V0KGN1cnNvcikucG9sbGluZyA9IHN0YXRlLmR5bmFtaWM7XG4gICAgICAgIC8vIGZpbmQgY3Vyc29ycyB3aGljaCBuZWVkIHBvbGxpbmdcbiAgICAgICAgY29uc3QgcG9sbGluZ19jdXJzb3JzID0gWy4uLnRoaXMuX2N1cnNvcl9tYXAudmFsdWVzKCldXG4gICAgICAgICAgICAuZmlsdGVyKGVudHJ5ID0+IGVudHJ5LnBvbGxpbmcpO1xuICAgICAgICB0aGlzLnJlZXZhbHVhdGVfcG9sbGluZyhwb2xsaW5nX2N1cnNvcnMpO1xuICAgICAgICAvLyBmb3J3YXJkIGNoYW5nZSBldmVudCB0byBhbGwgZm9yIHRoaXMgY3Vyc29yIGNhbGxiYWNrc1xuICAgICAgICBjb25zdCB7YmluZGluZ3N9ID0gdGhpcy5fY3Vyc29yX21hcC5nZXQoY3Vyc29yKTtcbiAgICAgICAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGJpbmRpbmdzKSB7XG4gICAgICAgICAgICBiaW5kaW5nLmNhbGxiYWNrKHN0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9ucG9sbCgpIHtcbiAgICAgICAgY29uc3QgdHMgPSBsb2NhbF9jbG9jay5ub3coKTtcbiAgICAgICAgLy8gcG9sbCBhbGwgY3Vyc29ycyB3aXRoIG5lZWQgb2YgcG9sbGluZ1xuICAgICAgICBmb3IgKGNvbnN0IFtjdXJzb3IsIGVudHJ5XSBvZiB0aGlzLl9jdXJzb3JfbWFwKSB7XG4gICAgICAgICAgICBpZiAoZW50cnkucG9sbGluZykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gY3Vyc29yLnF1ZXJ5KHRzKTtcbiAgICAgICAgICAgICAgICAvLyBmb3J3YXJkIHBvbGxlZCBzdGF0ZSB0byBhbGwgY2FsbGJhY2tzIGZvciB0aGlzIGN1cnNvclxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBlbnRyeS5iaW5kaW5ncykge1xuICAgICAgICAgICAgICAgICAgICBiaW5kaW5nLmNhbGxiYWNrKHN0YXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZWV2YWx1YXRlX3BvbGxpbmcocG9sbGluZ19jdXJzb3JzKSB7XG4gICAgICAgIGlmIChwb2xsaW5nX2N1cnNvcnMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3BvbGxlci5wYXVzZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmluZCBtaW5pbXVtIGRlbGF5XG4gICAgICAgICAgICBjb25zdCBkZWxheXMgPSBwb2xsaW5nX2N1cnNvcnMubWFwKGVudHJ5ID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZW50cnkuYmluZGluZ3MubWFwKGJpbmRpbmcgPT4gYmluZGluZy5kZWxheSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IG1pbl9kZWxheSA9IE1hdGgubWluKC4uLmRlbGF5cyk7XG4gICAgICAgICAgICB0aGlzLl9wb2xsZXIuZGVsYXkgPSBtaW5fZGVsYXk7XG4gICAgICAgICAgICB0aGlzLl9wb2xsZXIucGF1c2UoKTtcbiAgICAgICAgICAgIHRoaXMuX3BvbGxlci5yZXN1bWUoKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQklORCBSRUxFQVNFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8vIG1vbml0b3Igc2luZ2xldG9uXG5jb25zdCBtb25pdG9yID0gbmV3IEN1cnNvck1vbml0b3IoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmQoY3Vyc29yLCBjYWxsYmFjaywgZGVsYXkpIHtcbiAgICByZXR1cm4gbW9uaXRvci5iaW5kKGN1cnNvciwgY2FsbGJhY2ssIGRlbGF5KTtcbn1cbmV4cG9ydCBmdW5jdGlvbiByZWxlYXNlKGJpbmRpbmcpIHtcbiAgICByZXR1cm4gbW9uaXRvci5yZWxlYXNlKGJpbmRpbmcpO1xufVxuXG4iLCJpbXBvcnQgKiBhcyBldmVudGlmeSBmcm9tIFwiLi91dGlsL2FwaV9ldmVudGlmeS5qc1wiO1xuaW1wb3J0ICogYXMgY2FsbGJhY2sgZnJvbSBcIi4vdXRpbC9hcGlfY2FsbGJhY2suanNcIjtcbmltcG9ydCB7IGJpbmQsIHJlbGVhc2UgfSBmcm9tIFwiLi91dGlsL2N1cnNvcl9tb25pdG9yLmpzXCI7XG5pbXBvcnQgeyBpc19maW5pdGVfbnVtYmVyIH0gZnJvbSBcIi4vdXRpbC9jb21tb24uanNcIjtcblxuLyoqXG4gKiBjb252ZW5pZW5jZVxuICogZ2V0IGN1cnJlbnQgc3RhdGUgZnJvbSBjdXJzb3IuY3RybFxuICogZW5zdXJlIHRoYXQgY3Vyc29yLmN0cmwgcmV0dXJuIGEgbnVtYmVyIG9mZnNldFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0X2N1cnNvcl9jdHJsX3N0YXRlIChjdXJzb3IsIHRzX2xvY2FsKSB7XG4gICAgY29uc3Qgc3RhdGUgPSBjdXJzb3IuY3RybC5xdWVyeSh0c19sb2NhbCk7XG4gICAgaWYgKCFpc19maW5pdGVfbnVtYmVyKHN0YXRlLnZhbHVlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhcm5pbmc6IGN1cnNvciBjdHJsIHZhbHVlIG11c3QgYmUgbnVtYmVyICR7c3RhdGUudmFsdWV9YCk7XG4gICAgfVxuICAgIHJldHVybiBzdGF0ZTtcbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ1VSU09SXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqLyAgXG5cbi8qKlxuICogQWJzdHJhY3QgYmFzZSBjbGFzcyBmb3IgQ3Vyc29yIGludGVyZmFjZVxuICovXG5cbmV4cG9ydCBjbGFzcyBDdXJzb3Ige1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAvLyBjYWxsYmFja3NcbiAgICAgICAgY2FsbGJhY2suYWRkU3RhdGUodGhpcyk7XG4gICAgICAgIC8vIGRlZmluZSBjaGFuZ2UgZXZlbnRcbiAgICAgICAgZXZlbnRpZnkuYWRkU3RhdGUodGhpcyk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlEZWZpbmUoXCJjaGFuZ2VcIiwge2luaXQ6dHJ1ZX0pO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBxdWVyeSgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwicXVlcnkoKSBub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgZ2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5xdWVyeSgpLnZhbHVlfTtcblxuICAgIGdldCAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnF1ZXJ5KCkudmFsdWU7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgRXZlbnRpZnk6IGltbWVkaWF0ZSBldmVudHNcbiAgICAqL1xuICAgIGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG4gICAgICAgIGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBbdGhpcy5xdWVyeSgpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIEJJTkQgUkVMRUFTRSAoY29udmVuaWVuY2UpXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBiaW5kKGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgICAgICByZXR1cm4gYmluZCh0aGlzLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnMpO1xuICAgIH1cbiAgICByZWxlYXNlKGhhbmRsZSkge1xuICAgICAgICByZXR1cm4gcmVsZWFzZShoYW5kbGUpO1xuICAgIH1cblxuICAgIC8vIGludm9rZWQgYnkgc3ViY2xhc3Mgd2hlbmV2ZXIgY3Vyc29yIGhhcyBjaGFuZ2VkXG4gICAgb25jaGFuZ2UoKSB7XG4gICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiLCB0aGlzLnF1ZXJ5KCkpOyAgICBcbiAgICB9XG59XG5jYWxsYmFjay5hZGRNZXRob2RzKEN1cnNvci5wcm90b3R5cGUpO1xuZXZlbnRpZnkuYWRkTWV0aG9kcyhDdXJzb3IucHJvdG90eXBlKTtcbiIsImltcG9ydCB7bG9jYWxfY2xvY2ssIGxvY2FsX2Vwb2NofSBmcm9tIFwiLi91dGlsL2NvbW1vbi5qc1wiO1xuXG5cbi8qKlxuICogY2xvY2sgcHJvdmlkZXIgbXVzdCBoYXZlIGEgbm93KCkgbWV0aG9kXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc19jbG9ja19wcm92aWRlcihvYmopIHtcbiAgICBpZiAob2JqID09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghKFwibm93XCIgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2Ygb2JqLm5vdyAhPSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG59XG5cblxuLyoqXG4gKiBDTE9DSyBnaXZlcyBlcG9jaCB2YWx1ZXMsIGJ1dCBpcyBpbXBsZW1lbnRlZFxuICogdXNpbmcgcGVyZm9ybWFuY2Ugbm93IGZvciBiZXR0ZXJcbiAqIHRpbWUgcmVzb2x1dGlvbiBhbmQgcHJvdGVjdGlvbiBhZ2FpbnN0IHN5c3RlbSBcbiAqIHRpbWUgYWRqdXN0bWVudHMuXG4gKi9cbmV4cG9ydCBjb25zdCBMT0NBTF9DTE9DS19QUk9WSURFUiA9IGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCB0MCA9IGxvY2FsX2Nsb2NrLm5vdygpO1xuICAgIGNvbnN0IHQwX2Vwb2NoID0gbG9jYWxfZXBvY2gubm93KCk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgbm93IChsb2NhbF90cyA9IGxvY2FsX2Nsb2NrLm5vdygpKSB7XG4gICAgICAgICAgICByZXR1cm4gdDBfZXBvY2ggKyAobG9jYWxfdHMgLSB0MCk7XG4gICAgICAgIH1cbiAgICB9XG59KCk7XG5cbiIsImltcG9ydCB7IGludGVydmFsIH0gZnJvbSBcIi4vdXRpbC9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IHJhbmRvbV9zdHJpbmd9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5pbXBvcnQgKiBhcyBjYWxsYmFjayBmcm9tIFwiLi91dGlsL2FwaV9jYWxsYmFjay5qc1wiO1xuXG5cbmZ1bmN0aW9uIGNoZWNrX2l0ZW0oaXRlbSkge1xuICAgIGl0ZW0uaXR2ID0gaW50ZXJ2YWwuZnJvbV9pbnB1dChpdGVtLml0dik7XG4gICAgaXRlbS5pZCA9IGl0ZW0uaWQgfHwgcmFuZG9tX3N0cmluZygxMCk7XG4gICAgcmV0dXJuIGl0ZW07XG59XG5cbi8qKlxuICogY29sbGVjdGlvbiBwcm92aWRlcnMgbXVzdCBwcm92aWRlIGdldF9hbGwgZnVuY3Rpb25cbiAqIGFuZCBhbHNvIGltcGxlbWVudCBjYWxsYmFjayBpbnRlcmZhY2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzX2NvbGxlY3Rpb25fcHJvdmlkZXIob2JqKSB7XG4gICAgaWYgKCFjYWxsYmFjay5pc19jYWxsYmFja19hcGkob2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghKFwiZ2V0XCIgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2Ygb2JqLmdldCAhPSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCEoXCJ1cGRhdGVcIiBpbiBvYmopKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiBvYmoudXBkYXRlICE9ICdmdW5jdGlvbicpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQ09MTEVDVElPTiBQUk9WSURFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIGxvY2FsIGNvbGxlY3Rpb24gcHJvdmlkZXJcbiAqIFxuICogXG4gKiBjaGFuZ2VzID0ge1xuICogICByZW1vdmU9W10sXG4gKiAgIGluc2VydD1bXSxcbiAqICAgcmVzZXQ9ZmFsc2UgXG4gKiB9XG4gKiBcbiovXG5cbmV4cG9ydCBjbGFzcyBDb2xsZWN0aW9uUHJvdmlkZXIge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBjYWxsYmFjay5hZGRTdGF0ZSh0aGlzKTtcbiAgICAgICAgdGhpcy5fbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICAvLyBpbml0aWFsaXplXG4gICAgICAgIGxldCB7aW5zZXJ0fSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChpbnNlcnQgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGUoe2luc2VydCwgcmVzZXQ6dHJ1ZX0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9jYWwgc3RhdGVwcm92aWRlcnMgZGVjb3VwbGUgdXBkYXRlIHJlcXVlc3QgZnJvbVxuICAgICAqIHVwZGF0ZSBwcm9jZXNzaW5nLCBhbmQgcmV0dXJucyBQcm9taXNlLlxuICAgICAqL1xuICAgIHVwZGF0ZSAoY2hhbmdlcykge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgbGV0IGRpZmZzO1xuICAgICAgICAgICAgaWYgKGNoYW5nZXMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZGlmZnMgPSB0aGlzLl91cGRhdGUoY2hhbmdlcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKGRpZmZzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkaWZmcztcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZShjaGFuZ2VzKSB7XG4gICAgICAgIGNvbnN0IGRpZmZfbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICBsZXQge1xuICAgICAgICAgICAgaW5zZXJ0PVtdLFxuICAgICAgICAgICAgcmVtb3ZlPVtdLFxuICAgICAgICAgICAgcmVzZXQ9ZmFsc2VcbiAgICAgICAgfSA9IGNoYW5nZXM7XG5cblxuICAgICAgICBpZiAocmVzZXQpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2lkLCBpdGVtXSBvZiB0aGlzLl9tYXAuZW50cmllcygpKSB7XG4gICAgICAgICAgICAgICAgZGlmZl9tYXAuc2V0KGlkLCB7aWQsIG5ldzp1bmRlZmluZWQsIG9sZDppdGVtfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBjbGVhciBhbGwgaXRlbXNcbiAgICAgICAgICAgIHRoaXMuX21hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHJlbW92ZSBpdGVtcyBieSBpZFxuICAgICAgICAgICAgZm9yIChjb25zdCBpZCBvZiByZW1vdmUpIHtcbiAgICAgICAgICAgICAgICBsZXQgaXRlbSA9IHRoaXMuX21hcC5nZXQoaWQpO1xuICAgICAgICAgICAgICAgIGlmIChpdGVtICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBkaWZmX21hcC5zZXQoaXRlbS5pZCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6aXRlbS5pZCwgbmV3OnVuZGVmaW5lZCwgb2xkOml0ZW1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hcC5kZWxldGUoaWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBpbnNlcnQgaXRlbXNcbiAgICAgICAgZm9yIChsZXQgaXRlbSBvZiBpbnNlcnQpIHtcbiAgICAgICAgICAgIGl0ZW0gPSBjaGVja19pdGVtKGl0ZW0pO1xuICAgICAgICAgICAgY29uc3QgZGlmZiA9IGRpZmZfbWFwLmdldChpdGVtLmlkKVxuICAgICAgICAgICAgY29uc3Qgb2xkID0gKGRpZmYgIT0gdW5kZWZpbmVkKSA/IGRpZmYub2xkIDogdGhpcy5fbWFwLmdldChpdGVtLmlkKTtcbiAgICAgICAgICAgIGRpZmZfbWFwLnNldChpdGVtLmlkLCB7aWQ6aXRlbS5pZCwgbmV3Oml0ZW0sIG9sZH0pO1xuICAgICAgICAgICAgdGhpcy5fbWFwLnNldChpdGVtLmlkLCBpdGVtKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gWy4uLmRpZmZfbWFwLnZhbHVlcygpXTtcbiAgICB9XG5cbiAgICBnZXQoKSB7XG4gICAgICAgIHJldHVybiBbLi4udGhpcy5fbWFwLnZhbHVlcygpXTtcbiAgICB9O1xufVxuY2FsbGJhY2suYWRkTWV0aG9kcyhDb2xsZWN0aW9uUHJvdmlkZXIucHJvdG90eXBlKTtcbiIsImltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL3V0aWwvYXBpX2NhbGxiYWNrLmpzXCI7XG5pbXBvcnQgeyByYW5kb21fc3RyaW5nfSBmcm9tIFwiLi91dGlsL2NvbW1vbi5qc1wiO1xuXG4vKipcbiAqIHZhcmlhYmxlIHByb3ZpZGVycyBtdXN0IGhhdmUgYSB2YWx1ZSBwcm9wZXJ0eVxuICogYW5kIGFsc28gaW1wbGVtZW50IGNhbGxiYWNrIGludGVyZmFjZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNfdmFyaWFibGVfcHJvdmlkZXIob2JqKSB7XG4gICAgaWYgKCFjYWxsYmFjay5pc19jYWxsYmFja19hcGkob2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghKFwiZ2V0XCIgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2Ygb2JqLmdldCAhPSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCEoXCJzZXRcIiBpbiBvYmopKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiBvYmouc2V0ICE9ICdmdW5jdGlvbicpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVkFSSUFCTEUgUFJPVklERVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBWYXJpYWJsZVByb3ZpZGVyIHN0b3JlcyBhIGxpc3Qgb2YgaXRlbXMuXG4gKi9cblxuZXhwb3J0IGNsYXNzIFZhcmlhYmxlUHJvdmlkZXIge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBjYWxsYmFjay5hZGRTdGF0ZSh0aGlzKTtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBbXTtcblxuICAgICAgICAvLyBpbml0aWFsaXplXG4gICAgICAgIGNvbnN0IHt2YWx1ZX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAodmFsdWUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9pdGVtcyA9IFt7XG4gICAgICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgICAgIGl0djogW251bGwsIG51bGwsIHRydWUsIHRydWVdLCBcbiAgICAgICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgICAgIGRhdGE6IHZhbHVlXG4gICAgICAgICAgICB9XTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldCAoaXRlbXMpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5faXRlbXMgPSBpdGVtcztcbiAgICAgICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldCAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pdGVtcztcbiAgICB9XG59XG5jYWxsYmFjay5hZGRNZXRob2RzKFZhcmlhYmxlUHJvdmlkZXIucHJvdG90eXBlKTsiLCJpbXBvcnQgeyBpc19jYWxsYmFja19hcGkgfSBmcm9tIFwiLi9hcGlfY2FsbGJhY2suanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU09VUkNFIFBST1BFUlRZIChTUkNQUk9QKVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBGdW5jdGlvbnMgZm9yIGV4dGVuZGluZyBhIGNsYXNzIHdpdGggc3VwcG9ydCBmb3IgXG4gKiBleHRlcm5hbCBzb3VyY2Ugb24gYSBuYW1lZCBwcm9wZXJ0eS5cbiAqIFxuICogb3B0aW9uOiBtdXRhYmxlOnRydWUgbWVhbnMgdGhhdCBwcm9wZXJ5IG1heSBiZSByZXNldCBcbiAqIFxuICogc291cmNlIG9iamVjdCBpcyBhc3N1bWVkIHRvIHN1cHBvcnQgdGhlIGNhbGxiYWNrIGludGVyZmFjZSxcbiAqIG9yIGJlIGEgbGlzdCBvZiBvYmplY3RzIGFsbCBzdXBwb3J0aW5nIHRoZSBjYWxsYmFjayBpbnRlcmZhY2VcbiAqL1xuXG5jb25zdCBOQU1FID0gXCJzcmNwcm9wXCI7XG5jb25zdCBQUkVGSVggPSBgX18ke05BTUV9YDtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFN0YXRlIChvYmplY3QpIHtcbiAgICBvYmplY3RbYCR7UFJFRklYfWBdID0gbmV3IE1hcCgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWRkTWV0aG9kcyAob2JqZWN0KSB7XG5cbiAgICBmdW5jdGlvbiByZWdpc3Rlcihwcm9wTmFtZSwgb3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge211dGFibGU9dHJ1ZX0gPSBvcHRpb25zO1xuICAgICAgICBjb25zdCBtYXAgPSB0aGlzW2Ake1BSRUZJWH1gXTsgXG4gICAgICAgIG1hcC5zZXQocHJvcE5hbWUsIHtcbiAgICAgICAgICAgIGluaXQ6ZmFsc2UsXG4gICAgICAgICAgICBtdXRhYmxlLFxuICAgICAgICAgICAgZW50aXR5OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBoYW5kbGVzOiBbXVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyByZWdpc3RlciBnZXR0ZXJzIGFuZCBzZXR0ZXJzXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wTmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1hcC5nZXQocHJvcE5hbWUpLmVudGl0eTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uIChlbnRpdHkpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1tgJHtOQU1FfV9jaGVja2BdKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eSA9IHRoaXNbYCR7TkFNRX1fY2hlY2tgXShwcm9wTmFtZSwgZW50aXR5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eSAhPSBtYXAuZ2V0KHByb3BOYW1lKS5lbnRpdHkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1tgJHtQUkVGSVh9X2F0dGFjaGBdKHByb3BOYW1lLCBlbnRpdHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXR0YXRjaChwcm9wTmFtZSwgZW50aXR5KSB7XG5cbiAgICAgICAgY29uc3QgbWFwID0gdGhpc1tgJHtQUkVGSVh9YF07XG4gICAgICAgIGNvbnN0IHN0YXRlID0gbWFwLmdldChwcm9wTmFtZSlcblxuICAgICAgICBpZiAoc3RhdGUuaW5pdCAmJiAhc3RhdGUubXV0YWJsZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3Byb3BOYW1lfSBjYW4gbm90IGJlIHJlYXNzaWduZWRgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGVudGl0aWVzID0gKEFycmF5LmlzQXJyYXkoZW50aXR5KSkgPyBlbnRpdHkgOiBbZW50aXR5XTtcblxuICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIGVudGl0aWVzXG4gICAgICAgIGlmIChzdGF0ZS5oYW5kbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2lkeCwgZV0gb2YgT2JqZWN0LmVudHJpZXMoZW50aXRpZXMpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzX2NhbGxiYWNrX2FwaShlKSkge1xuICAgICAgICAgICAgICAgICAgICBlLnJlbW92ZV9jYWxsYmFjayhzdGF0ZS5oYW5kbGVzW2lkeF0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gICAgXG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUuaGFuZGxlcyA9IFtdO1xuXG4gICAgICAgIC8vIGF0dGF0Y2ggbmV3IGVudGl0eVxuICAgICAgICBzdGF0ZS5lbnRpdHkgPSBlbnRpdHk7XG4gICAgICAgIHN0YXRlLmluaXQgPSB0cnVlO1xuXG4gICAgICAgIC8vIHN1YnNjcmliZSB0byBjYWxsYmFjayBmcm9tIHNvdXJjZVxuICAgICAgICBpZiAodGhpc1tgJHtOQU1FfV9vbmNoYW5nZWBdKSB7XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gZnVuY3Rpb24gKGVBcmcpIHtcbiAgICAgICAgICAgICAgICB0aGlzW2Ake05BTUV9X29uY2hhbmdlYF0ocHJvcE5hbWUsIGVBcmcpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBlIG9mIGVudGl0aWVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzX2NhbGxiYWNrX2FwaShlKSkge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZS5oYW5kbGVzLnB1c2goZS5hZGRfY2FsbGJhY2soaGFuZGxlcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXNbYCR7TkFNRX1fb25jaGFuZ2VgXShwcm9wTmFtZSwgXCJyZXNldFwiKTsgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBhcGkgPSB7fTtcbiAgICBhcGlbYCR7TkFNRX1fcmVnaXN0ZXJgXSA9IHJlZ2lzdGVyO1xuICAgIGFwaVtgJHtQUkVGSVh9X2F0dGFjaGBdID0gYXR0YXRjaDtcbiAgICBPYmplY3QuYXNzaWduKG9iamVjdCwgYXBpKTtcbn1cblxuIiwiaW1wb3J0IHsgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG5cdFNPUlRFRCBBUlJBWVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuXHRTb3J0ZWQgYXJyYXkgb2YgZW5kcG9pbnRzIFt2YWx1ZSwgdHlwZV0uXG5cdC0gRWxlbWVudHMgYXJlIHNvcnRlZCBpbiBhc2NlbmRpbmcgb3JkZXIuXG5cdC0gTm8gZHVwbGljYXRlcyBhcmUgYWxsb3dlZC5cblx0LSBCaW5hcnkgc2VhcmNoIHVzZWQgZm9yIGxvb2t1cFxuXG5cdHZhbHVlcyBjYW4gYmUgcmVndWxhciBudW1iZXIgdmFsdWVzIChmbG9hdCkgb3IgZW5kcG9pbnRzIFtmbG9hdCwgdHlwZV1cbiovXG5cbmV4cG9ydCBjbGFzcyBTb3J0ZWRBcnJheSB7XG5cblx0Y29uc3RydWN0b3IoKXtcblx0XHR0aGlzLl9hcnJheSA9IFtdO1xuXHR9XG5cblx0Z2V0IHNpemUoKSB7cmV0dXJuIHRoaXMuX2FycmF5Lmxlbmd0aDt9XG5cdGdldCBhcnJheSgpIHtyZXR1cm4gdGhpcy5fYXJyYXk7fVxuXG5cdC8qXG5cdFx0ZmluZCBpbmRleCBvZiBnaXZlbiB2YWx1ZVxuXG5cdFx0cmV0dXJuIFtmb3VuZCwgaW5kZXhdXG5cblx0XHRpZiBmb3VuZCBpcyB0cnVlLCB0aGVuIGluZGV4IGlzIHRoZSBpbmRleCBvZiB0aGUgZm91bmQgb2JqZWN0XG5cdFx0aWYgZm91bmQgaXMgZmFsc2UsIHRoZW4gaW5kZXggaXMgdGhlIGluZGV4IHdoZXJlIHRoZSBvYmplY3Qgc2hvdWxkXG5cdFx0YmUgaW5zZXJ0ZWRcblxuXHRcdC0gdXNlcyBiaW5hcnkgc2VhcmNoXHRcdFxuXHRcdC0gYXJyYXkgZG9lcyBub3QgaW5jbHVkZSBhbnkgZHVwbGljYXRlIHZhbHVlc1xuXHQqL1xuXHRpbmRleE9mKHRhcmdldF92YWx1ZSkge1xuXHRcdGNvbnN0IHRhcmdldF9lcCA9IGVuZHBvaW50LmZyb21faW5wdXQodGFyZ2V0X3ZhbHVlKTtcblx0XHRsZXQgbGVmdF9pZHggPSAwO1xuXHRcdGxldCByaWdodF9pZHggPSB0aGlzLl9hcnJheS5sZW5ndGggLSAxO1xuXHRcdHdoaWxlIChsZWZ0X2lkeCA8PSByaWdodF9pZHgpIHtcblx0XHRcdGNvbnN0IG1pZF9pZHggPSBNYXRoLmZsb29yKChsZWZ0X2lkeCArIHJpZ2h0X2lkeCkgLyAyKTtcblx0XHRcdGxldCBtaWRfdmFsdWUgPSB0aGlzLl9hcnJheVttaWRfaWR4XTtcblx0XHRcdGlmIChlbmRwb2ludC5lcShtaWRfdmFsdWUsIHRhcmdldF9lcCkpIHtcblx0XHRcdFx0cmV0dXJuIFt0cnVlLCBtaWRfaWR4XTsgLy8gVGFyZ2V0IGFscmVhZHkgZXhpc3RzIGluIHRoZSBhcnJheVxuXHRcdFx0fSBlbHNlIGlmIChlbmRwb2ludC5sdChtaWRfdmFsdWUsIHRhcmdldF9lcCkpIHtcblx0XHRcdFx0ICBsZWZ0X2lkeCA9IG1pZF9pZHggKyAxOyAvLyBNb3ZlIHNlYXJjaCByYW5nZSB0byB0aGUgcmlnaHRcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdCAgcmlnaHRfaWR4ID0gbWlkX2lkeCAtIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSBsZWZ0XG5cdFx0XHR9XG5cdFx0fVxuXHQgIFx0cmV0dXJuIFtmYWxzZSwgbGVmdF9pZHhdOyAvLyBSZXR1cm4gdGhlIGluZGV4IHdoZXJlIHRhcmdldCBzaG91bGQgYmUgaW5zZXJ0ZWRcblx0fVxuXG5cdC8qXG5cdFx0ZmluZCBpbmRleCBvZiBzbWFsbGVzdCB2YWx1ZSB3aGljaCBpcyBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gdGFyZ2V0IHZhbHVlXG5cdFx0cmV0dXJucyAtMSBpZiBubyBzdWNoIHZhbHVlIGV4aXN0c1xuXHQqL1xuXHRnZUluZGV4T2YodGFyZ2V0X3ZhbHVlKSB7XG5cdFx0bGV0IFtmb3VuZCwgaWR4XSA9IHRoaXMuaW5kZXhPZih0YXJnZXRfdmFsdWUpO1xuXHRcdHJldHVybiAoaWR4IDwgdGhpcy5fYXJyYXkubGVuZ3RoKSA/IGlkeCA6IC0xICBcblx0fVxuXG5cdC8qXG5cdFx0ZmluZCBpbmRleCBvZiBsYXJnZXN0IHZhbHVlIHdoaWNoIGlzIGxlc3MgdGhhbiBvciBlcXVhbCB0byB0YXJnZXQgdmFsdWVcblx0XHRyZXR1cm5zIC0xIGlmIG5vIHN1Y2ggdmFsdWUgZXhpc3RzXG5cdCovXG5cdGxlSW5kZXhPZih0YXJnZXRfdmFsdWUpIHtcblx0XHRsZXQgW2ZvdW5kLCBpZHhdID0gdGhpcy5pbmRleE9mKHRhcmdldF92YWx1ZSk7XG5cdFx0aWR4ID0gKGZvdW5kKSA/IGlkeCA6IGlkeC0xO1xuXHRcdHJldHVybiAoaWR4ID49IDApID8gaWR4IDogLTE7XG5cdH1cblxuXHQvKlxuXHRcdGZpbmQgaW5kZXggb2Ygc21hbGxlc3QgdmFsdWUgd2hpY2ggaXMgZ3JlYXRlciB0aGFuIHRhcmdldCB2YWx1ZVxuXHRcdHJldHVybnMgLTEgaWYgbm8gc3VjaCB2YWx1ZSBleGlzdHNcblx0Ki9cblx0Z3RJbmRleE9mKHRhcmdldF92YWx1ZSkge1xuXHRcdGxldCBbZm91bmQsIGlkeF0gPSB0aGlzLmluZGV4T2YodGFyZ2V0X3ZhbHVlKTtcblx0XHRpZHggPSAoZm91bmQpID8gaWR4ICsgMSA6IGlkeDtcblx0XHRyZXR1cm4gKGlkeCA8IHRoaXMuX2FycmF5Lmxlbmd0aCkgPyBpZHggOiAtMSAgXG5cdH1cblxuXHQvKlxuXHRcdGZpbmQgaW5kZXggb2YgbGFyZ2VzdCB2YWx1ZSB3aGljaCBpcyBsZXNzIHRoYW4gdGFyZ2V0IHZhbHVlXG5cdFx0cmV0dXJucyAtMSBpZiBubyBzdWNoIHZhbHVlIGV4aXN0c1xuXHQqL1xuXHRsdEluZGV4T2YodGFyZ2V0X3ZhbHVlKSB7XG5cdFx0bGV0IFtmb3VuZCwgaWR4XSA9IHRoaXMuaW5kZXhPZih0YXJnZXRfdmFsdWUpO1xuXHRcdGlkeCA9IGlkeC0xO1xuXHRcdHJldHVybiAoaWR4ID49IDApID8gaWR4IDogLTE7XHRcblx0fVxuXG5cdC8qXG5cdFx0VVBEQVRFXG5cblx0XHRhcHByb2FjaCAtIG1ha2UgYWxsIG5lY2Nlc3NhcnkgY2hhbmdlcyBhbmQgdGhlbiBzb3J0XG5cblx0XHRhcyBhIHJ1bGUgb2YgdGh1bWIgLSBjb21wYXJlZCB0byByZW1vdmluZyBhbmQgaW5zZXJ0aW5nIGVsZW1lbnRzXG5cdFx0b25lIGJ5IG9uZSwgdGhpcyBpcyBtb3JlIGVmZmVjdGl2ZSBmb3IgbGFyZ2VyIGJhdGNoZXMsIHNheSA+IDEwMC5cblx0XHRFdmVuIHRob3VnaCB0aGlzIG1pZ2h0IG5vdCBiZSB0aGUgY29tbW9uIGNhc2UsIHBlbmFsdGllcyBmb3Jcblx0XHRjaG9vc2luZyB0aGUgd3JvbmcgYXBwcm9hY2ggaXMgaGlnaGVyIGZvciBsYXJnZXIgYmF0Y2hlcy5cblxuXHRcdHJlbW92ZSBpcyBwcm9jZXNzZWQgZmlyc3QsIHNvIGlmIGEgdmFsdWUgYXBwZWFycyBpbiBib3RoIFxuXHRcdHJlbW92ZSBhbmQgaW5zZXJ0LCBpdCB3aWxsIHJlbWFpbi5cblx0XHR1bmRlZmluZWQgdmFsdWVzIGNhbiBub3QgYmUgaW5zZXJ0ZWQgXG5cblx0Ki9cblxuXHR1cGRhdGUocmVtb3ZlX2xpc3Q9W10sIGluc2VydF9saXN0PVtdKSB7XG5cblx0XHQvKlxuXHRcdFx0cmVtb3ZlXG5cblx0XHRcdHJlbW92ZSBieSBmbGFnZ2luZyBlbGVtZW50cyBhcyB1bmRlZmluZWRcblx0XHRcdC0gY29sbGVjdCBhbGwgaW5kZXhlcyBmaXJzdFxuXHRcdFx0LSBmbGFnIGFzIHVuZGVmaW5lZCBvbmx5IGFmdGVyIGFsbCBpbmRleGVzIGhhdmUgYmVlbiBmb3VuZCxcblx0XHRcdCAgYXMgaW5zZXJ0aW5nIHVuZGVmaW5lZCB2YWx1ZXMgYnJlYWtlcyB0aGUgYXNzdW1wdGlvbiB0aGF0XG5cdFx0XHQgIHRoZSBhcnJheSBpcyBzb3J0ZWQuXG5cdFx0XHQtIGxhdGVyIHNvcnQgd2lsbCBtb3ZlIHRoZW0gdG8gdGhlIGVuZCwgd2hlcmUgdGhleSBjYW4gYmVcblx0XHRcdCAgdHJ1bmNhdGVkIG9mZlxuXHRcdCovXG5cdFx0bGV0IHJlbW92ZV9pZHhfbGlzdCA9IFtdO1xuXHRcdGZvciAobGV0IHZhbHVlIG9mIHJlbW92ZV9saXN0KSB7XG5cdFx0XHRsZXQgW2ZvdW5kLCBpZHhdID0gdGhpcy5pbmRleE9mKHZhbHVlKTtcblx0XHRcdGlmIChmb3VuZCkge1xuXHRcdFx0XHRyZW1vdmVfaWR4X2xpc3QucHVzaChpZHgpO1xuXHRcdFx0fVx0XHRcblx0XHR9XG5cdFx0Zm9yIChsZXQgaWR4IG9mIHJlbW92ZV9pZHhfbGlzdCkge1xuXHRcdFx0dGhpcy5fYXJyYXlbaWR4XSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0bGV0IGFueV9yZW1vdmVzID0gcmVtb3ZlX2lkeF9saXN0Lmxlbmd0aCA+IDA7XG5cblx0XHQvKlxuXHRcdFx0aW5zZXJ0XG5cblx0XHRcdGluc2VydCBtaWdodCBpbnRyb2R1Y2UgZHVwbGljYXRpb25zLCBlaXRoZXIgYmVjYXVzZVxuXHRcdFx0dGhlIGluc2VydCBsaXN0IGluY2x1ZGVzIGR1cGxpY2F0ZXMsIG9yIGJlY2F1c2UgdGhlXG5cdFx0XHRpbnNlcnQgbGlzdCBkdXBsaWNhdGVzIHByZWV4aXN0aW5nIHZhbHVlcy5cblxuXHRcdFx0SW5zdGVhZCBvZiBsb29raW5nIHVwIGFuZCBjaGVja2luZyBlYWNoIGluc2VydCB2YWx1ZSxcblx0XHRcdHdlIGluc3RlYWQgaW5zZXJ0IGV2ZXJ5dGhpbmcgYXQgdGhlIGVuZCBvZiB0aGUgYXJyYXksXG5cdFx0XHRhbmQgcmVtb3ZlIGR1cGxpY2F0ZXMgb25seSBhZnRlciB3ZSBoYXZlIHNvcnRlZC5cblx0XHQqL1xuXHRcdGxldCBhbnlfaW5zZXJ0cyA9IGluc2VydF9saXN0Lmxlbmd0aCA+IDA7XG5cdFx0aWYgKGFueV9pbnNlcnRzKSB7XG5cdFx0XHRjb25jYXRfaW5fcGxhY2UodGhpcy5fYXJyYXksIGluc2VydF9saXN0KTtcblx0XHR9XG5cblx0XHQvKlxuXHRcdFx0c29ydFxuXHRcdFx0dGhpcyBwdXNoZXMgYW55IHVuZGVmaW5lZCB2YWx1ZXMgdG8gdGhlIGVuZCBcblx0XHQqL1xuXHRcdGlmIChhbnlfcmVtb3ZlcyB8fCBhbnlfaW5zZXJ0cykge1xuXHRcdFx0dGhpcy5fYXJyYXkuc29ydChlbmRwb2ludC5jbXApO1xuXHRcdH1cblxuXHRcdC8qXG5cdFx0XHRyZW1vdmUgdW5kZWZpbmVkIFxuXHRcdFx0YWxsIHVuZGVmaW5lZCB2YWx1ZXMgYXJlIHB1c2hlZCB0byB0aGUgZW5kXG5cdFx0Ki9cblx0XHRpZiAoYW55X3JlbW92ZXMpIHtcblx0XHRcdHRoaXMuX2FycmF5Lmxlbmd0aCAtPSByZW1vdmVfaWR4X2xpc3QubGVuZ3RoO1xuXHRcdH1cblxuXHRcdC8qXG5cdFx0XHRyZW1vdmUgZHVwbGljYXRlcyBmcm9tIHNvcnRlZCBhcnJheVxuXHRcdFx0LSBhc3N1bWluZyB0aGVyZSBhcmUgZ29pbmcgdG8gYmUgZmV3IGR1cGxpY2F0ZXMsXG5cdFx0XHQgIGl0IGlzIG9rIHRvIHJlbW92ZSB0aGVtIG9uZSBieSBvbmVcblxuXHRcdCovXG5cdFx0aWYgKGFueV9pbnNlcnRzKSB7XG5cdFx0XHRyZW1vdmVfZHVwbGljYXRlcyh0aGlzLl9hcnJheSk7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRnZXQgZWxlbWVudCBieSBpbmRleFxuXHQqL1xuXHRnZXRfYnlfaW5kZXgoaWR4KSB7XG5cdFx0aWYgKGlkeCA+IC0xICYmIGlkeCA8IHRoaXMuX2FycmF5Lmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FycmF5W2lkeF07XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRsb29rdXAgdmFsdWVzIHdpdGhpbiBpbnRlcnZhbFxuXHQqL1xuXHRsb29rdXAoaXR2KSB7XG5cdFx0aWYgKGl0diA9PSB1bmRlZmluZWQpIHtcblx0XHRcdGl0diA9IFtudWxsLCBudWxsLCB0cnVlLCB0cnVlXTtcblx0XHR9XG5cdFx0bGV0IFtlcF8wLCBlcF8xXSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXR2KTtcblx0XHRsZXQgaWR4XzAgPSB0aGlzLmdlSW5kZXhPZihlcF8wKTtcblx0XHRsZXQgaWR4XzEgPSB0aGlzLmxlSW5kZXhPZihlcF8xKTtcblx0XHRpZiAoaWR4XzAgPT0gLTEgfHwgaWR4XzEgPT0gLTEpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FycmF5LnNsaWNlKGlkeF8wLCBpZHhfMSsxKTtcblx0XHR9XG5cdH1cblxuXHRsdCAob2Zmc2V0KSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0X2J5X2luZGV4KHRoaXMubHRJbmRleE9mKG9mZnNldCkpO1xuXHR9XG5cdGxlIChvZmZzZXQpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRfYnlfaW5kZXgodGhpcy5sZUluZGV4T2Yob2Zmc2V0KSk7XG5cdH1cblx0Z2V0IChvZmZzZXQpIHtcblx0XHRsZXQgW2ZvdW5kLCBpZHhdID0gdGhpcy5pbmRleE9mKG9mZnNldCk7XG5cdFx0aWYgKGZvdW5kKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYXJyYXlbaWR4XTtcblx0XHR9IFxuXHR9XG5cdGd0IChvZmZzZXQpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRfYnlfaW5kZXgodGhpcy5ndEluZGV4T2Yob2Zmc2V0KSk7XG5cdH1cblx0Z2UgKG9mZnNldCkge1xuXHRcdHJldHVybiB0aGlzLmdldF9ieV9pbmRleCh0aGlzLmdlSW5kZXhPZihvZmZzZXQpKTtcblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblx0VVRJTFNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcblx0Q29uY2F0aW5hdGUgdHdvIGFycmF5cyBieSBhcHBlbmRpbmcgdGhlIHNlY29uZCBhcnJheSB0byB0aGUgZmlyc3QgYXJyYXkuIFxuKi9cblxuZnVuY3Rpb24gY29uY2F0X2luX3BsYWNlKGZpcnN0X2Fyciwgc2Vjb25kX2Fycikge1xuXHRjb25zdCBmaXJzdF9hcnJfbGVuZ3RoID0gZmlyc3RfYXJyLmxlbmd0aDtcblx0Y29uc3Qgc2Vjb25kX2Fycl9sZW5ndGggPSBzZWNvbmRfYXJyLmxlbmd0aDtcbiAgXHRmaXJzdF9hcnIubGVuZ3RoICs9IHNlY29uZF9hcnJfbGVuZ3RoO1xuICBcdGZvciAobGV0IGkgPSAwOyBpIDwgc2Vjb25kX2Fycl9sZW5ndGg7IGkrKykge1xuICAgIFx0Zmlyc3RfYXJyW2ZpcnN0X2Fycl9sZW5ndGggKyBpXSA9IHNlY29uZF9hcnJbaV07XG4gIFx0fVxufVxuXG4vKlxuXHRyZW1vdmUgZHVwbGljYXRlcyBpbiBhIHNvcnRlZCBhcnJheVxuKi9cbmZ1bmN0aW9uIHJlbW92ZV9kdXBsaWNhdGVzKHNvcnRlZF9hcnIpIHtcblx0bGV0IGkgPSAwO1xuXHR3aGlsZSAodHJ1ZSkge1xuXHRcdGlmIChpICsgMSA+PSBzb3J0ZWRfYXJyLmxlbmd0aCkge1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdGlmIChlbmRwb2ludC5lcShzb3J0ZWRfYXJyW2ldLCBzb3J0ZWRfYXJyW2kgKyAxXSkpIHtcblx0XHRcdHNvcnRlZF9hcnIuc3BsaWNlKGkgKyAxLCAxKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aSArPSAxO1xuXHRcdH1cblx0fVxufVxuIiwiaW1wb3J0IHsgZW5kcG9pbnQgfSBmcm9tIFwiLi91dGlsL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlLCBuZWFyYnlfZnJvbSB9IGZyb20gXCIuL25lYXJieV9iYXNlLmpzXCI7XG5pbXBvcnQgeyBTb3J0ZWRBcnJheSB9IGZyb20gXCIuL3V0aWwvc29ydGVkYXJyYXkuanNcIjtcbmltcG9ydCB7IGlzX2NvbGxlY3Rpb25fcHJvdmlkZXIgfSBmcm9tIFwiLi9wcm92aWRlcl9jb2xsZWN0aW9uLmpzXCI7XG5pbXBvcnQgeyBpc192YXJpYWJsZV9wcm92aWRlciB9IGZyb20gXCIuL3Byb3ZpZGVyX3ZhcmlhYmxlLmpzXCI7XG5cbmNvbnN0IHtMT1dfQ0xPU0VELCBMT1dfT1BFTiwgSElHSF9DTE9TRUQsIEhJR0hfT1BFTn0gPSBlbmRwb2ludC50eXBlcztcbmNvbnN0IEVQX1RZUEVTID0gW0xPV19DTE9TRUQsIExPV19PUEVOLCBISUdIX0NMT1NFRCwgSElHSF9PUEVOXTtcblxuXG4vLyBTZXQgb2YgdW5pcXVlIFt2LCB0XSBlbmRwb2ludHNcbmNsYXNzIEVuZHBvaW50U2V0IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5fbWFwID0gbmV3IE1hcChbXG5cdFx0XHRbTE9XX0NMT1NFRCwgbmV3IFNldCgpXSxcblx0XHRcdFtMT1dfT1BFTiwgbmV3IFNldCgpXSwgXG5cdFx0XHRbSElHSF9DTE9TRUQsIG5ldyBTZXQoKV0sIFxuXHRcdFx0W0hJR0hfT1BFTiwgbmV3IFNldCgpXVxuXHRcdF0pO1xuXHR9XG5cdGFkZChlcCkge1xuXHRcdGNvbnN0IFt2YWx1ZSwgdHlwZV0gPSBlcDtcblx0XHRyZXR1cm4gdGhpcy5fbWFwLmdldCh0eXBlKS5hZGQodmFsdWUpO1xuXHR9XG5cdGhhcyAoZXApIHtcblx0XHRjb25zdCBbdmFsdWUsIHR5cGVdID0gZXA7XG5cdFx0cmV0dXJuIHRoaXMuX21hcC5nZXQodHlwZSkuaGFzKHZhbHVlKTtcblx0fVxuXHRnZXQoZXApIHtcblx0XHRjb25zdCBbdmFsdWUsIHR5cGVdID0gZXA7XG5cdFx0cmV0dXJuIHRoaXMuX21hcC5nZXQodHlwZSkuZ2V0KHZhbHVlKTtcblx0fVxuXG5cdGxpc3QoKSB7XG5cdFx0Y29uc3QgbGlzdHMgPSBFUF9UWVBFUy5tYXAoKHR5cGUpID0+IHtcblx0XHRcdHJldHVybiBbLi4udGhpcy5fbWFwLmdldCh0eXBlKS52YWx1ZXMoKV1cblx0XHRcdFx0Lm1hcCgodmFsdWUpID0+IFt2YWx1ZSwgdHlwZV0pO1xuXHRcdH0pO1xuXHRcdHJldHVybiBbXS5jb25jYXQoLi4ubGlzdHMpO1xuXHR9XG59XG5cbi8qKlxuICogSVRFTVMgTUFQXG4gKiBcbiAqIG1hcCBlbmRwb2ludCAtPiB7XG4gKiBcdGxvdzogW2l0ZW1zXSwgXG4gKiAgYWN0aXZlOiBbaXRlbXNdLCBcbiAqICBoaWdoOltpdGVtc11cbiAqIH1cbiAqIFxuICogaW4gb3JkZXIgdG8gdXNlIGVuZHBvaW50IFt2LHRdIGFzIGEgbWFwIGtleSB3ZSBjcmVhdGUgYSB0d28gbGV2ZWxcbiAqIG1hcCAtIHVzaW5nIHQgYXMgdGhlIGZpcnN0IHZhcmlhYmxlLiBcbiAqIFxuICovXG5cblxuY29uc3QgTE9XID0gXCJsb3dcIjtcbmNvbnN0IEFDVElWRSA9IFwiYWN0aXZlXCI7XG5jb25zdCBISUdIID0gXCJoaWdoXCI7XG5cblxuY2xhc3MgSXRlbXNNYXAge1xuXG5cdGNvbnN0cnVjdG9yICgpIHtcblx0XHQvLyBtYXAgZW5kcG9pbnQgLT4ge2xvdzogW2l0ZW1zXSwgYWN0aXZlOiBbaXRlbXNdLCBoaWdoOltpdGVtc119XG5cdFx0dGhpcy5fbWFwID0gbmV3IE1hcChbXG5cdFx0XHRbTE9XX0NMT1NFRCwgbmV3IE1hcCgpXSxcblx0XHRcdFtMT1dfT1BFTiwgbmV3IE1hcCgpXSwgXG5cdFx0XHRbSElHSF9DTE9TRUQsIG5ldyBNYXAoKV0sIFxuXHRcdFx0W0hJR0hfT1BFTiwgbmV3IE1hcCgpXVxuXHRcdF0pO1xuXHR9XG5cblx0Z2V0X2l0ZW1zX2J5X3JvbGUgKGVwLCByb2xlKSB7XG5cdFx0Y29uc3QgW3ZhbHVlLCB0eXBlXSA9IGVwO1xuXHRcdGNvbnN0IGVudHJ5ID0gdGhpcy5fbWFwLmdldCh0eXBlKS5nZXQodmFsdWUpO1xuXHRcdHJldHVybiAoZW50cnkgIT0gdW5kZWZpbmVkKSA/IGVudHJ5W3JvbGVdIDogW107XG5cdH1cblxuXHQvKlxuXHRcdHJlZ2lzdGVyIGl0ZW0gd2l0aCBlbmRwb2ludCAoaWRlbXBvdGVudClcblx0XHRyZXR1cm4gdHJ1ZSBpZiB0aGlzIHdhcyB0aGUgZmlyc3QgTE9XIG9yIEhJR0ggXG5cdCAqL1xuXHRyZWdpc3RlcihlcCwgaXRlbSwgcm9sZSkge1xuXHRcdGNvbnN0IFt2YWx1ZSwgdHlwZV0gPSBlcDtcblx0XHRjb25zdCB0eXBlX21hcCA9IHRoaXMuX21hcC5nZXQodHlwZSk7XG5cdFx0aWYgKCF0eXBlX21hcC5oYXModmFsdWUpKSB7XG5cdFx0XHR0eXBlX21hcC5zZXQodmFsdWUsIHtsb3c6IFtdLCBhY3RpdmU6W10sIGhpZ2g6W119KTtcblx0XHR9XG5cdFx0Y29uc3QgZW50cnkgPSB0eXBlX21hcC5nZXQodmFsdWUpO1xuXHRcdGNvbnN0IHdhc19lbXB0eSA9IGVudHJ5W0xPV10ubGVuZ3RoICsgZW50cnlbSElHSF0ubGVuZ3RoID09IDA7XG5cdFx0bGV0IGlkeCA9IGVudHJ5W3JvbGVdLmZpbmRJbmRleCgoX2l0ZW0pID0+IHtcblx0XHRcdHJldHVybiBfaXRlbS5pZCA9PSBpdGVtLmlkO1xuXHRcdH0pO1xuXHRcdGlmIChpZHggPT0gLTEpIHtcblx0XHRcdGVudHJ5W3JvbGVdLnB1c2goaXRlbSk7XG5cdFx0fVxuXHRcdGNvbnN0IGlzX2VtcHR5ID0gZW50cnlbTE9XXS5sZW5ndGggKyBlbnRyeVtISUdIXS5sZW5ndGggPT0gMDtcblx0XHRyZXR1cm4gd2FzX2VtcHR5ICYmICFpc19lbXB0eTtcblx0fVxuXG5cdC8qXG5cdFx0dW5yZWdpc3RlciBpdGVtIHdpdGggZW5kcG9pbnQgKGluZGVwZW5kZW50IG9mIHJvbGUpXG5cdFx0cmV0dXJuIHRydWUgaWYgdGhpcyByZW1vdmVkIGxhc3QgTE9XIG9yIEhJR0hcblx0ICovXG5cdHVucmVnaXN0ZXIoZXAsIGl0ZW0pIHtcblx0XHRjb25zdCBbdmFsdWUsIHR5cGVdID0gZXA7XG5cdFx0Y29uc3QgdHlwZV9tYXAgPSB0aGlzLl9tYXAuZ2V0KHR5cGUpO1xuXHRcdGNvbnN0IGVudHJ5ID0gdHlwZV9tYXAuZ2V0KHZhbHVlKTtcblx0XHRpZiAoZW50cnkgIT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCB3YXNfZW1wdHkgPSBlbnRyeVtMT1ddLmxlbmd0aCArIGVudHJ5W0hJR0hdLmxlbmd0aCA9PSAwO1xuXHRcdFx0Ly8gcmVtb3ZlIGFsbCBtZW50aW9uZXMgb2YgaXRlbVxuXHRcdFx0Zm9yIChjb25zdCByb2xlIG9mIFtMT1csIEFDVElWRSwgSElHSF0pIHtcblx0XHRcdFx0bGV0IGlkeCA9IGVudHJ5W3JvbGVdLmZpbmRJbmRleCgoX2l0ZW0pID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gX2l0ZW0uaWQgPT0gaXRlbS5pZDtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGlmIChpZHggPiAtMSkge1xuXHRcdFx0XHRcdGVudHJ5W3JvbGVdLnNwbGljZShpZHgsIDEpO1xuXHRcdFx0XHR9XHRcblx0XHRcdH1cblx0XHRcdGNvbnN0IGlzX2VtcHR5ID0gZW50cnlbTE9XXS5sZW5ndGggKyBlbnRyeVtISUdIXS5sZW5ndGggPT0gMDtcblx0XHRcdGlmICghd2FzX2VtcHR5ICYmIGlzX2VtcHR5KSB7XG5cdFx0XHRcdC8vIGNsZWFuIHVwIGVudHJ5XG5cdFx0XHRcdHR5cGVfbWFwLmRlbGV0ZSh2YWx1ZSk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuXG4vKipcbiAqIE5lYXJieUluZGV4XG4gKiBcbiAqIE5lYXJieUluZGV4IGZvciBDb2xsZWN0aW9uUHJvdmlkZXIgb3IgVmFyaWFibGVQcm92aWRlclxuICovXG5cbmV4cG9ydCBjbGFzcyBOZWFyYnlJbmRleCBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihzdGF0ZVByb3ZpZGVyKSB7XG4gICAgICAgIHN1cGVyKCk7XHRcdFxuXG5cdFx0aWYgKFxuXHRcdFx0IWlzX2NvbGxlY3Rpb25fcHJvdmlkZXIoc3RhdGVQcm92aWRlcikgJiZcblx0XHRcdCFpc192YXJpYWJsZV9wcm92aWRlcihzdGF0ZVByb3ZpZGVyKVxuXHRcdCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBzdGF0ZVByb3ZpZGVyIG11c3QgYmUgY29sbGVjdGlvblByb3ZpZGVyIG9yIHZhcmlhYmxlUHJvdmlkZXIgJHtzdGF0ZVByb3ZpZGVyfWApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3NwID0gc3RhdGVQcm92aWRlcjtcblx0XHR0aGlzLl9pbml0aWFsaXNlKCk7XG5cdFx0dGhpcy5yZWZyZXNoKCk7XG5cdH1cblxuICAgIGdldCBzcmMgKCkge3JldHVybiB0aGlzLl9zcDt9XG5cblxuXHRfaW5pdGlhbGlzZSgpIHtcblx0XHQvLyByZWdpc3RlciBpdGVtcyB3aXRoIGVuZHBvaW50c1xuXHRcdHRoaXMuX2l0ZW1zbWFwID0gbmV3IEl0ZW1zTWFwKCk7XG5cdFx0Ly8gc29ydGVkIGluZGV4XG5cdFx0dGhpcy5fZW5kcG9pbnRzID0gbmV3IFNvcnRlZEFycmF5KCk7XG5cdFx0Ly8gc3dpcGUgaW5kZXhcblx0XHR0aGlzLl9pbmRleCA9IFtdO1xuXHR9XG5cblxuXHRyZWZyZXNoKGRpZmZzKSB7XG5cblx0XHRjb25zdCByZW1vdmVfZW5kcG9pbnRzID0gbmV3IEVuZHBvaW50U2V0KCk7XG5cdFx0Y29uc3QgaW5zZXJ0X2VuZHBvaW50cyA9IG5ldyBFbmRwb2ludFNldCgpO1xuXG5cdFx0bGV0IGluc2VydF9pdGVtcyA9IFtdO1xuXHRcdGxldCByZW1vdmVfaXRlbXMgPSBbXTtcblxuXHRcdGlmIChkaWZmcyA9PSB1bmRlZmluZWQpIHtcblx0XHRcdGluc2VydF9pdGVtcyA9IHRoaXMuc3JjLmdldCgpO1x0XHRcblx0XHRcdC8vIGNsZWFyIGFsbCBzdGF0ZVxuXHRcdFx0dGhpcy5faW5pdGlhbGlzZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBjb2xsZWN0IGluc2VydCBpdGVtcyBhbmQgcmVtb3ZlIGl0ZW1zXG5cdFx0XHRmb3IgKGNvbnN0IGRpZmYgb2YgZGlmZnMpIHtcblx0XHRcdFx0aWYgKGRpZmYubmV3ICE9IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGluc2VydF9pdGVtcy5wdXNoKGRpZmYubmV3KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZGlmZi5vbGQgIT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0cmVtb3ZlX2l0ZW1zLnB1c2goZGlmZi5vbGQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRcdHVucmVnaXN0ZXIgcmVtb3ZlIGl0ZW1zIGFjcm9zcyBhbGwgZW5kcG9pbnRzIFxuXHRcdFx0d2hlcmUgdGhleSB3ZXJlIHJlZ2lzdGVyZWQgKExPVywgQUNUSVZFLCBISUdIKSBcblx0XHQqL1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiByZW1vdmVfaXRlbXMpIHtcdFx0XHRcblx0XHRcdGNvbnN0IGVwcyA9IHRoaXMuX2VuZHBvaW50cy5sb29rdXAoaXRlbS5pdHYpO1xuXHRcdFx0Zm9yIChjb25zdCBlcCBvZiB0aGlzLl9lbmRwb2ludHMubG9va3VwKGl0ZW0uaXR2KSkge1xuXHRcdFx0XHQvLyBUT0RPOiBjaGVjayBpZiB0aGlzIGlzIGNvcnJlY3Rcblx0XHRcdFx0Y29uc3QgYmVjYW1lX2VtcHR5ID0gdGhpcy5faXRlbXNtYXAudW5yZWdpc3RlcihlcCwgaXRlbSk7XG5cdFx0XHRcdGlmIChiZWNhbWVfZW1wdHkpIHJlbW92ZV9lbmRwb2ludHMuYWRkKGVwKTtcblx0XHRcdH1cdFxuXHRcdH1cblxuXHRcdC8qXG5cdFx0XHRyZWdpc3RlciBuZXcgaXRlbXMgYWNyb3NzIGFsbCBlbmRwb2ludHMgXG5cdFx0XHR3aGVyZSB0aGV5IHNob3VsZCBiZSByZWdpc3RlcmVkIChMT1csIEhJR0gpIFxuXHRcdCovXG5cdFx0bGV0IGJlY2FtZV9ub25lbXB0eTtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgaW5zZXJ0X2l0ZW1zKSB7XG5cdFx0XHRjb25zdCBbbG93LCBoaWdoXSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpO1xuXHRcdFx0YmVjYW1lX25vbmVtcHR5ID0gdGhpcy5faXRlbXNtYXAucmVnaXN0ZXIobG93LCBpdGVtLCBMT1cpO1xuXHRcdFx0aWYgKGJlY2FtZV9ub25lbXB0eSkgaW5zZXJ0X2VuZHBvaW50cy5hZGQobG93KTtcblx0XHRcdGJlY2FtZV9ub25lbXB0eSA9IHRoaXMuX2l0ZW1zbWFwLnJlZ2lzdGVyKGhpZ2gsIGl0ZW0sIEhJR0gpO1xuXHRcdFx0aWYgKGJlY2FtZV9ub25lbXB0eSkgaW5zZXJ0X2VuZHBvaW50cy5hZGQoaGlnaCk7XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRcdHJlZnJlc2ggc29ydGVkIGVuZHBvaW50c1xuXHRcdFx0cG9zc2libGUgdGhhdCBhbiBlbmRwb2ludCBpcyBwcmVzZW50IGluIGJvdGggbGlzdHNcblx0XHRcdHRoaXMgaXMgcHJlc3VtYWJseSBub3QgYSBwcm9ibGVtIHdpdGggU29ydGVkQXJyYXkuXG5cdFx0Ki9cblx0XHR0aGlzLl9lbmRwb2ludHMudXBkYXRlKFxuXHRcdFx0cmVtb3ZlX2VuZHBvaW50cy5saXN0KCksIFxuXHRcdFx0aW5zZXJ0X2VuZHBvaW50cy5saXN0KClcblx0XHQpO1xuXG5cdFx0Lypcblx0XHRcdHN3aXBlIG92ZXIgdG8gZW5zdXJlIHRoYXQgYWxsIGl0ZW1zIGFyZSBhY3RpdmF0ZVxuXHRcdCovXG5cdFx0Y29uc3QgYWN0aXZlU2V0ID0gbmV3IFNldCgpO1xuXHRcdGZvciAoY29uc3QgZXAgb2YgdGhpcy5fZW5kcG9pbnRzLmFycmF5KSB7XHRcblx0XHRcdC8vIEFkZCBpdGVtcyB3aXRoIGVwIGFzIGxvdyBwb2ludFxuXHRcdFx0Zm9yIChsZXQgaXRlbSBvZiB0aGlzLl9pdGVtc21hcC5nZXRfaXRlbXNfYnlfcm9sZShlcCwgTE9XKSkge1xuXHRcdFx0XHRhY3RpdmVTZXQuYWRkKGl0ZW0pO1xuXHRcdFx0fTtcblx0XHRcdC8vIGFjdGl2YXRlIHVzaW5nIGFjdGl2ZVNldFxuXHRcdFx0Zm9yIChsZXQgaXRlbSBvZiBhY3RpdmVTZXQpIHtcblx0XHRcdFx0dGhpcy5faXRlbXNtYXAucmVnaXN0ZXIoZXAsIGl0ZW0sIEFDVElWRSk7XG5cdFx0XHR9XG5cdFx0XHQvLyBSZW1vdmUgaXRlbXMgd2l0aCBwMSBhcyBoaWdoIHBvaW50XG5cdFx0XHRmb3IgKGxldCBpdGVtIG9mIHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKGVwLCBISUdIKSkge1xuXHRcdFx0XHRhY3RpdmVTZXQuZGVsZXRlKGl0ZW0pO1xuXHRcdFx0fTtcdFxuXHRcdH1cblx0fVxuXG5cdF9jb3ZlcnMgKG9mZnNldCkge1xuXHRcdGNvbnN0IGVwID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuXHRcdGNvbnN0IGVwMSA9IHRoaXMuX2VuZHBvaW50cy5sZShlcCkgfHwgZW5kcG9pbnQuTkVHX0lORjtcblx0XHRjb25zdCBlcDIgPSB0aGlzLl9lbmRwb2ludHMuZ2UoZXApIHx8IGVuZHBvaW50LlBPU19JTkY7XG5cdFx0aWYgKGVuZHBvaW50LmVxKGVwMSwgZXAyKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKGVwMSwgQUNUSVZFKTtcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBnZXQgaXRlbXMgZm9yIGJvdGggZW5kcG9pbnRzXG5cdFx0XHRjb25zdCBpdGVtczEgPSB0aGlzLl9pdGVtc21hcC5nZXRfaXRlbXNfYnlfcm9sZShlcDEsIEFDVElWRSk7XG5cdFx0XHRjb25zdCBpdGVtczIgPSB0aGlzLl9pdGVtc21hcC5nZXRfaXRlbXNfYnlfcm9sZShlcDIsIEFDVElWRSk7XG5cdFx0XHQvLyByZXR1cm4gYWxsIGl0ZW1zIHRoYXQgYXJlIGFjdGl2ZSBpbiBib3RoIGVuZHBvaW50c1xuXHRcdFx0Y29uc3QgaWRTZXQgPSBuZXcgU2V0KGl0ZW1zMS5tYXAoaXRlbSA9PiBpdGVtLmlkKSk7XG5cdFx0XHRyZXR1cm4gaXRlbXMyLmZpbHRlcihpdGVtID0+IGlkU2V0LmhhcyhpdGVtLmlkKSk7XG5cdFx0fVxuXHR9XG5cbiAgICAvKlxuXHRcdG5lYXJieSAob2Zmc2V0KVxuICAgICovXG5cdG5lYXJieShvZmZzZXQpIHtcblx0XHRjb25zdCBlcCA9IGVuZHBvaW50LmZyb21faW5wdXQob2Zmc2V0KTtcblxuXHRcdC8vIGNlbnRlclxuXHRcdGxldCBjZW50ZXIgPSB0aGlzLl9jb3ZlcnMoZXApXG5cdFx0Y29uc3QgY2VudGVyX2hpZ2hfbGlzdCA9IFtdO1xuXHRcdGNvbnN0IGNlbnRlcl9sb3dfbGlzdCA9IFtdO1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBjZW50ZXIpIHtcblx0XHRcdGNvbnN0IFtsb3csIGhpZ2hdID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dik7XG5cdFx0XHRjZW50ZXJfaGlnaF9saXN0LnB1c2goaGlnaCk7XG5cdFx0XHRjZW50ZXJfbG93X2xpc3QucHVzaChsb3cpOyAgICBcblx0XHR9XG5cblx0XHQvLyBwcmV2IGhpZ2hcblx0XHRsZXQgcHJldl9oaWdoID0gZXA7XG5cdFx0bGV0IGl0ZW1zO1xuXHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRwcmV2X2hpZ2ggPSB0aGlzLl9lbmRwb2ludHMubHQocHJldl9oaWdoKSB8fCBlbmRwb2ludC5ORUdfSU5GO1xuXHRcdFx0aWYgKHByZXZfaGlnaFswXSA9PSBudWxsKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0XHRpdGVtcyA9IHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKHByZXZfaGlnaCwgSElHSCk7XG5cdFx0XHRpZiAoaXRlbXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIG5leHQgbG93XG5cdFx0bGV0IG5leHRfbG93ID0gZXA7XG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdG5leHRfbG93ID0gdGhpcy5fZW5kcG9pbnRzLmd0KG5leHRfbG93KSB8fCBlbmRwb2ludC5QT1NfSU5GXG5cdFx0XHRpZiAobmV4dF9sb3dbMF0gPT0gbnVsbCkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXHRcdFx0aXRlbXMgPSB0aGlzLl9pdGVtc21hcC5nZXRfaXRlbXNfYnlfcm9sZShuZXh0X2xvdywgTE9XKTtcblx0XHRcdGlmIChpdGVtcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5lYXJieV9mcm9tKFxuXHRcdFx0cHJldl9oaWdoLCBcblx0XHRcdGNlbnRlcl9sb3dfbGlzdCwgXG5cdFx0XHRjZW50ZXIsXG5cdFx0XHRjZW50ZXJfaGlnaF9saXN0LFxuXHRcdFx0bmV4dF9sb3dcblx0XHQpO1xuXHR9XG59IiwiaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IG1vdGlvbl91dGlscyB9IGZyb20gXCIuL2NvbW1vbi5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbkJBU0UgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLypcblx0QWJzdHJhY3QgQmFzZSBDbGFzcyBmb3IgU2VnbWVudHNcblxuICAgIGNvbnN0cnVjdG9yKGludGVydmFsKVxuXG4gICAgLSBpbnRlcnZhbDogaW50ZXJ2YWwgb2YgdmFsaWRpdHkgb2Ygc2VnbWVudFxuICAgIC0gZHluYW1pYzogdHJ1ZSBpZiBzZWdtZW50IGlzIGR5bmFtaWNcbiAgICAtIHZhbHVlKG9mZnNldCk6IHZhbHVlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4gICAgLSBxdWVyeShvZmZzZXQpOiBzdGF0ZSBvZiBzZWdtZW50IGF0IG9mZnNldFxuKi9cblxuZXhwb3J0IGNsYXNzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYpIHtcblx0XHR0aGlzLl9pdHYgPSBpdHY7XG5cdH1cblxuXHRnZXQgaXR2KCkge3JldHVybiB0aGlzLl9pdHY7fVxuXG4gICAgLyoqIFxuICAgICAqIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzXG4gICAgICogcmV0dXJucyB7dmFsdWUsIGR5bmFtaWN9O1xuICAgICovXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgXHR0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY29udmVuaWVuY2UgZnVuY3Rpb24gcmV0dXJuaW5nIHRoZSBzdGF0ZSBvZiB0aGUgc2VnbWVudFxuICAgICAqIEBwYXJhbSB7Kn0gb2Zmc2V0IFxuICAgICAqIEByZXR1cm5zIFxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX2l0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHsuLi50aGlzLnN0YXRlKG9mZnNldCksIG9mZnNldH07XG4gICAgICAgIH0gXG4gICAgICAgIHJldHVybiB7dmFsdWU6IHVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICB9XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNUQVRJQyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX3ZhbHVlID0gZGF0YTtcblx0fVxuXG5cdHN0YXRlKCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl92YWx1ZSwgZHluYW1pYzpmYWxzZX1cblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE1PVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuICAgICAgICBzdXBlcihpdHYpO1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBwb3NpdGlvbjpwMD0wLCBcbiAgICAgICAgICAgIHZlbG9jaXR5OnYwPTAsIFxuICAgICAgICAgICAgYWNjZWxlcmF0aW9uOmEwPTAsIFxuICAgICAgICAgICAgdGltZXN0YW1wOnQwPTBcbiAgICAgICAgfSA9IGRhdGE7XG4gICAgICAgIHRoaXMuX3ZlY3RvciA9IFtwMCx2MCxhMCx0MF07XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IFtwLHYsYSx0XSA9IG1vdGlvbl91dGlscy5jYWxjdWxhdGUodGhpcy5fdmVjdG9yLCBvZmZzZXQpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLy8gcG9zaXRpb246IHAsXG4gICAgICAgICAgICAvLyB2ZWxvY2l0eTogdixcbiAgICAgICAgICAgIC8vIGFjY2VsZXJhdGlvbjogYSxcbiAgICAgICAgICAgIC8vIHRpbWVzdGFtcDogdCxcbiAgICAgICAgICAgIHZhbHVlOiBwLFxuICAgICAgICAgICAgZHluYW1pYzogKHYgIT0gMCB8fCBhICE9IDAgKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRSQU5TSVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIFN1cHBvcnRlZCBlYXNpbmcgZnVuY3Rpb25zXG4gICAgXCJlYXNlLWluXCI6XG4gICAgXCJlYXNlLW91dFwiOlxuICAgIFwiZWFzZS1pbi1vdXRcIlxuKi9cblxuZnVuY3Rpb24gZWFzZWluICh0cykge1xuICAgIHJldHVybiBNYXRoLnBvdyh0cywyKTsgIFxufVxuZnVuY3Rpb24gZWFzZW91dCAodHMpIHtcbiAgICByZXR1cm4gMSAtIGVhc2VpbigxIC0gdHMpO1xufVxuZnVuY3Rpb24gZWFzZWlub3V0ICh0cykge1xuICAgIGlmICh0cyA8IC41KSB7XG4gICAgICAgIHJldHVybiBlYXNlaW4oMiAqIHRzKSAvIDI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICgyIC0gZWFzZWluKDIgKiAoMSAtIHRzKSkpIC8gMjtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFuc2l0aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGRhdGEpIHtcblx0XHRzdXBlcihpdHYpO1xuICAgICAgICBsZXQge3YwLCB2MSwgZWFzaW5nfSA9IGRhdGE7XG4gICAgICAgIGxldCBbdDAsIHQxXSA9IHRoaXMuX2l0di5zbGljZSgwLDIpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgdHJhbnNpdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl9keW5hbWljID0gdjEtdjAgIT0gMDtcbiAgICAgICAgdGhpcy5fdHJhbnMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgdHMgdG8gW3QwLHQxXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzaGlmdCBmcm9tIFt0MCx0MV0tc3BhY2UgdG8gWzAsKHQxLXQwKV0tc3BhY2VcbiAgICAgICAgICAgIC8vIC0gc2NhbGUgZnJvbSBbMCwodDEtdDApXS1zcGFjZSB0byBbMCwxXS1zcGFjZVxuICAgICAgICAgICAgdHMgPSB0cyAtIHQwO1xuICAgICAgICAgICAgdHMgPSB0cy9wYXJzZUZsb2F0KHQxLXQwKTtcbiAgICAgICAgICAgIC8vIGVhc2luZyBmdW5jdGlvbnMgc3RyZXRjaGVzIG9yIGNvbXByZXNzZXMgdGhlIHRpbWUgc2NhbGUgXG4gICAgICAgICAgICBpZiAoZWFzaW5nID09IFwiZWFzZS1pblwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW4odHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlb3V0KHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWFzaW5nID09IFwiZWFzZS1pbi1vdXRcIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZWlub3V0KHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc2l0aW9uIGZyb20gdjAgdG8gdjEsIGZvciB0aW1lIHZhbHVlcyBbMCwxXVxuICAgICAgICAgICAgdHMgPSBNYXRoLm1heCh0cywgMCk7XG4gICAgICAgICAgICB0cyA9IE1hdGgubWluKHRzLCAxKTtcbiAgICAgICAgICAgIHJldHVybiB2MCArICh2MS12MCkqdHM7XG4gICAgICAgIH1cblx0fVxuXG5cdHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl90cmFucyhvZmZzZXQpLCBkeW5hbWljOnRoaXMuX2R5bmFtaWN9XG5cdH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElOVEVSUE9MQVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9uIHRvIGNyZWF0ZSBhbiBpbnRlcnBvbGF0b3IgZm9yIG5lYXJlc3QgbmVpZ2hib3IgaW50ZXJwb2xhdGlvbiB3aXRoXG4gKiBleHRyYXBvbGF0aW9uIHN1cHBvcnQuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdHVwbGVzIC0gQW4gYXJyYXkgb2YgW3ZhbHVlLCBvZmZzZXRdIHBhaXJzLCB3aGVyZSB2YWx1ZSBpcyB0aGVcbiAqIHBvaW50J3MgdmFsdWUgYW5kIG9mZnNldCBpcyB0aGUgY29ycmVzcG9uZGluZyBvZmZzZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gQSBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIG9mZnNldCBhbmQgcmV0dXJucyB0aGVcbiAqIGludGVycG9sYXRlZCBvciBleHRyYXBvbGF0ZWQgdmFsdWUuXG4gKi9cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUodHVwbGVzKSB7XG5cbiAgICBpZiAodHVwbGVzLmxlbmd0aCA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHVuZGVmaW5lZDt9XG4gICAgfSBlbHNlIGlmICh0dXBsZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHR1cGxlc1swXVswXTt9XG4gICAgfVxuXG4gICAgLy8gU29ydCB0aGUgdHVwbGVzIGJ5IHRoZWlyIG9mZnNldHNcbiAgICBjb25zdCBzb3J0ZWRUdXBsZXMgPSBbLi4udHVwbGVzXS5zb3J0KChhLCBiKSA9PiBhWzFdIC0gYlsxXSk7XG4gIFxuICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3Iob2Zmc2V0KSB7XG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBiZWZvcmUgdGhlIGZpcnN0IHBvaW50XG4gICAgICBpZiAob2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1swXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1swXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbMV07XG4gICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gSGFuZGxlIGV4dHJhcG9sYXRpb24gYWZ0ZXIgdGhlIGxhc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMl07XG4gICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICBcbiAgICAgIC8vIEZpbmQgdGhlIG5lYXJlc3QgcG9pbnRzIHRvIHRoZSBsZWZ0IGFuZCByaWdodFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW2ldWzFdICYmIG9mZnNldCA8PSBzb3J0ZWRUdXBsZXNbaSArIDFdWzFdKSB7XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbaV07XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbaSArIDFdO1xuICAgICAgICAgIC8vIExpbmVhciBpbnRlcnBvbGF0aW9uIGZvcm11bGE6IHkgPSB5MSArICggKHggLSB4MSkgKiAoeTIgLSB5MSkgLyAoeDIgLSB4MSkgKVxuICAgICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICBcbiAgICAgIC8vIEluIGNhc2UgdGhlIG9mZnNldCBkb2VzIG5vdCBmYWxsIHdpdGhpbiBhbnkgcmFuZ2UgKHNob3VsZCBiZSBjb3ZlcmVkIGJ5IHRoZSBwcmV2aW91cyBjb25kaXRpb25zKVxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9O1xufVxuICBcblxuZXhwb3J0IGNsYXNzIEludGVycG9sYXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG4gICAgY29uc3RydWN0b3IoaXR2LCB0dXBsZXMpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcbiAgICAgICAgLy8gc2V0dXAgaW50ZXJwb2xhdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl90cmFucyA9IGludGVycG9sYXRlKHR1cGxlcyk7XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dHJ1ZX07XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0FEIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGxvYWRfc2VnbWVudChpdHYsIGl0ZW0pIHtcbiAgICBsZXQge3R5cGU9XCJzdGF0aWNcIiwgZGF0YX0gPSBpdGVtO1xuICAgIGlmICh0eXBlID09IFwic3RhdGljXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBTdGF0aWNTZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwidHJhbnNpdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgVHJhbnNpdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJpbnRlcnBvbGF0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBJbnRlcnBvbGF0aW9uU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgTW90aW9uU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwidW5yZWNvZ25pemVkIHNlZ21lbnQgdHlwZVwiLCB0eXBlKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuL3V0aWwvYXBpX3NyY3Byb3AuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4vbGF5ZXJfYmFzZS5qc1wiO1xuaW1wb3J0IHsgaXNfY29sbGVjdGlvbl9wcm92aWRlciB9IGZyb20gXCIuL3Byb3ZpZGVyX2NvbGxlY3Rpb24uanNcIjtcbmltcG9ydCB7IGlzX3ZhcmlhYmxlX3Byb3ZpZGVyfSBmcm9tIFwiLi9wcm92aWRlcl92YXJpYWJsZS5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXggfSBmcm9tIFwiLi9uZWFyYnlfaW5kZXguanNcIjtcbmltcG9ydCB7IGxvYWRfc2VnbWVudCB9IGZyb20gXCIuL3V0aWwvc2VnbWVudHMuanNcIjtcbmltcG9ydCB7IHRvU3RhdGUgfSBmcm9tIFwiLi91dGlsL2NvbW1vbi5qc1wiO1xuaW1wb3J0IHsgZW5kcG9pbnQsIGludGVydmFsIH0gZnJvbSBcIi4vdXRpbC9pbnRlcnZhbHMuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElURU1TIExBWUVSXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogSXRlbXMgTGF5ZXIgaGFzIGEgc3RhdGVQcm92aWRlciAoZWl0aGVyIGNvbGxlY3Rpb25Qcm92aWRlciBvciB2YXJpYWJsZVByb3ZpZGVyKVxuICogYXMgc3JjIHByb3BlcnR5LlxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19pdGVtc19sYXllciAob2JqKSB7XG4gICAgaWYgKG9iaiA9PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcbiAgICAvLyBpcyBsYXllclxuICAgIGlmICghKG9iaiBpbnN0YW5jZW9mIExheWVyKSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vIGhhcyBzcmMgcHJvcGVydHlcbiAgICBjb25zdCBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmosIFwic3JjXCIpO1xuICAgIGlmICghIShkZXNjPy5nZXQgJiYgZGVzYz8uc2V0KSA9PSBmYWxzZSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXRlbXNfbGF5ZXIob3B0aW9ucz17fSkge1xuXG4gICAgY29uc3Qge3NyYywgLi4ub3B0c30gPSBvcHRpb25zO1xuICAgIGNvbnN0IGxheWVyID0gbmV3IExheWVyKHtDYWNoZUNsYXNzOkl0ZW1zTGF5ZXJDYWNoZSwgLi4ub3B0c30pO1xuXG4gICAgLy8gc2V0dXAgc3JjIHByb3BlcnR5XG4gICAgc3JjcHJvcC5hZGRTdGF0ZShsYXllcik7XG4gICAgc3JjcHJvcC5hZGRNZXRob2RzKGxheWVyKTtcblxuICAgIGxheWVyLnNyY3Byb3BfcmVnaXN0ZXIoXCJzcmNcIik7XG4gICAgbGF5ZXIuc3JjcHJvcF9jaGVjayA9IGZ1bmN0aW9uIChwcm9wTmFtZSwgc3JjKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAoIShpc19jb2xsZWN0aW9uX3Byb3ZpZGVyKHNyYykpICYmICEoaXNfdmFyaWFibGVfcHJvdmlkZXIoc3JjKSkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwic3JjXCIgbXVzdCBjb2xsZWN0aW9uUHJvdmlkZXIgb3IgdmFyaWFibGVQcm92aWRlciAke3NyY31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzcmM7ICAgIFxuICAgICAgICB9XG4gICAgfVxuICAgIGxheWVyLnNyY3Byb3Bfb25jaGFuZ2UgPSBmdW5jdGlvbiAocHJvcE5hbWUsIGVBcmcpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmIChlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIGlmIChpc19jb2xsZWN0aW9uX3Byb3ZpZGVyKGxheWVyLnNyYykpIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIuaW5kZXggPSBuZXcgTmVhcmJ5SW5kZXgobGF5ZXIuc3JjKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzX3ZhcmlhYmxlX3Byb3ZpZGVyKGxheWVyLnNyYykpIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIuaW5kZXggPSBuZXcgTmVhcmJ5SW5kZXgobGF5ZXIuc3JjKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgaWYgKGxheWVyLmluZGV4ICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGlmIChpc19jb2xsZWN0aW9uX3Byb3ZpZGVyKGxheWVyLnNyYykpIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIuaW5kZXgucmVmcmVzaChlQXJnKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzX3ZhcmlhYmxlX3Byb3ZpZGVyKGxheWVyLnNyYykpIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIuaW5kZXgucmVmcmVzaCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsYXllci5vbmNoYW5nZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9ICAgICAgICBcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIGNvbnZlbmllbmNlIG1ldGhvZCBmb3IgZ2V0dGluZyBpdGVtcyB2YWxpZCBhdCBvZmZzZXRcbiAgICAgKiBvbmx5IGl0ZW1zIGxheWVyIHN1cHBvcnRzIHRoaXMgbWV0aG9kXG4gICAgICovXG4gICAgbGF5ZXIuZ2V0X2l0ZW1zID0gZnVuY3Rpb24gZ2V0X2l0ZW1zKG9mZnNldCkge1xuICAgICAgICByZXR1cm4gWy4uLmxheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpLmNlbnRlcl07XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIExBWUVSIFVQREFURSBBUElcbiAgICAgKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgbGF5ZXIudXBkYXRlID0gZnVuY3Rpb24gdXBkYXRlKGNoYW5nZXMpIHtcbiAgICAgICAgcmV0dXJuIGxheWVyX3VwZGF0ZShsYXllciwgY2hhbmdlcyk7XG4gICAgfVxuICAgIGxheWVyLmFwcGVuZCA9IGZ1bmN0aW9uIGFwcGVuZChpdGVtcywgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBsYXllcl9hcHBlbmQobGF5ZXIsIGl0ZW1zLCBvZmZzZXQpO1xuICAgIH1cblxuICAgIC8vIGluaXRpYWxpc2VcbiAgICBsYXllci5zcmMgPSBzcmM7XG5cbiAgICByZXR1cm4gbGF5ZXI7XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElURU1TIExBWUVSIENBQ0hFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgTGF5ZXJzIHdpdGggYSBDb2xsZWN0aW9uUHJvdmlkZXIgb3IgYSBWYXJpYWJsZVByb3ZpZGVyIGFzIHNyYyBcbiAgICB1c2UgYSBzcGVjaWZpYyBjYWNoZSBpbXBsZW1lbnRhdGlvbiwgYXMgb2JqZWN0cyBpbiB0aGUgXG4gICAgaW5kZXggYXJlIGFzc3VtZWQgdG8gYmUgaXRlbXMgZnJvbSB0aGUgcHJvdmlkZXIsIG5vdCBsYXllciBvYmplY3RzLiBcbiAgICBUaHVzLCBxdWVyaWVzIGFyZSBub3QgcmVzb2x2ZWQgZGlyZWN0bHkgb24gdGhlIGl0ZW1zIGluIHRoZSBpbmRleCwgYnV0XG4gICAgcmF0aGVyIGZyb20gY29ycmVzcG9uZGluZyBzZWdtZW50IG9iamVjdHMsIGluc3RhbnRpYXRlZCBmcm9tIGl0ZW1zLlxuXG4gICAgQ2FjaGluZyBoZXJlIGFwcGxpZXMgdG8gbmVhcmJ5IHN0YXRlIGFuZCBzZWdtZW50IG9iamVjdHMuXG4qL1xuXG5jbGFzcyBJdGVtc0xheWVyQ2FjaGUge1xuICAgIGNvbnN0cnVjdG9yKGxheWVyKSB7XG4gICAgICAgIC8vIGxheWVyXG4gICAgICAgIHRoaXMuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIC8vIGNhY2hlZCBuZWFyYnkgb2JqZWN0XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2FjaGVkIHNlZ21lbnRcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBnZXQgc3JjKCkge3JldHVybiB0aGlzLl9sYXllcn07XG4gICAgZ2V0IHNlZ21lbnQoKSB7cmV0dXJuIHRoaXMuX3NlZ21lbnR9O1xuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IG5lZWRfaW5kZXhfbG9va3VwID0gKFxuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgIWludGVydmFsLmNvdmVyc19lbmRwb2ludCh0aGlzLl9uZWFyYnkuaXR2LCBvZmZzZXQpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChuZWVkX2luZGV4X2xvb2t1cCkge1xuICAgICAgICAgICAgLy8gY2FjaGUgbWlzc1xuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdGhpcy5fbGF5ZXIuaW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgICAgICBsZXQge2l0diwgY2VudGVyfSA9IHRoaXMuX25lYXJieTtcbiAgICAgICAgICAgIHRoaXMuX3NlZ21lbnRzID0gY2VudGVyLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBsb2FkX3NlZ21lbnQoaXR2LCBpdGVtKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIHBlcmZvcm0gcXVlcmllc1xuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9zZWdtZW50cy5tYXAoKHNlZykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHNlZy5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gY2FsY3VsYXRlIHNpbmdsZSByZXN1bHQgc3RhdGVcbiAgICAgICAgcmV0dXJuIHRvU3RhdGUodGhpcy5fc2VnbWVudHMsIHN0YXRlcywgb2Zmc2V0LCB0aGlzLl9sYXllci5vcHRpb25zKVxuICAgIH1cblxuICAgIGNsZWFyKCkge1xuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTEFZRVIgVVBEQVRFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgSXRlbXMgTGF5ZXIgZm9yd2FyZHMgdXBkYXRlIHRvIHN0YXRlUHJvdmlkZXJcbiovXG5mdW5jdGlvbiBsYXllcl91cGRhdGUobGF5ZXIsIGNoYW5nZXM9e30pIHtcbiAgICBpZiAoaXNfY29sbGVjdGlvbl9wcm92aWRlcihsYXllci5zcmMpKSB7XG4gICAgICAgIHJldHVybiBsYXllci5zcmMudXBkYXRlKGNoYW5nZXMpO1xuICAgIH0gZWxzZSBpZiAoaXNfdmFyaWFibGVfcHJvdmlkZXIobGF5ZXIuc3JjKSkgeyAgICAgXG4gICAgICAgIGxldCB7XG4gICAgICAgICAgICBpbnNlcnQ9W10sXG4gICAgICAgICAgICByZW1vdmU9W10sXG4gICAgICAgICAgICByZXNldD1mYWxzZVxuICAgICAgICB9ID0gY2hhbmdlcztcbiAgICAgICAgaWYgKHJlc2V0KSB7XG4gICAgICAgICAgICByZXR1cm4gbGF5ZXIuc3JjLnNldChpbnNlcnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcChsYXllci5zcmMuZ2V0KClcbiAgICAgICAgICAgICAgICAubWFwKChpdGVtKSA9PiBbaXRlbS5pZCwgaXRlbV0pKTtcbiAgICAgICAgICAgIC8vIHJlbW92ZVxuICAgICAgICAgICAgcmVtb3ZlLmZvckVhY2goKGlkKSA9PiBtYXAuZGVsZXRlKGlkKSk7XG4gICAgICAgICAgICAvLyBpbnNlcnRcbiAgICAgICAgICAgIGluc2VydC5mb3JFYWNoKChpdGVtKSA9PiBtYXAuc2V0KGl0ZW0uaWQsIGl0ZW0pKTtcbiAgICAgICAgICAgIC8vIHNldFxuICAgICAgICAgICAgY29uc3QgaXRlbXMgPSBBcnJheS5mcm9tKG1hcC52YWx1ZXMoKSk7XG4gICAgICAgICAgICByZXR1cm4gbGF5ZXIuc3JjLnNldChpdGVtcyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4gICAgXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUiBBUFBFTkRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBhcHBlbmQgaXRlbXMgdG8gbGF5ZXIgYXQgb2Zmc2V0XG4gKiBcbiAqIGFwcGVuZCBpbXBsaWVzIHRoYXQgcHJlLWV4aXN0aW5nIGl0ZW1zIGJleW9uZCBvZmZzZXQsXG4gKiB3aWxsIGVpdGhlciBiZSByZW1vdmVkIG9yIHRydW5jYXRlZCwgc28gdGhhdCB0aGUgbGF5ZXJcbiAqIGlzIGVtcHR5IGFmdGVyIG9mZnNldC5cbiAqIFxuICogaXRlbXMgd2lsbCBvbmx5IGJlIGluc2VydGVkIGFmdGVyIG9mZnNldCwgc28gYW55IG5ld1xuICogaXRlbSBiZWZvcmUgb2Zmc2V0IHdpbGwgYmUgdHJ1bmNhdGVkIG9yIGRyb3BwZWQuXG4gKiBcbiAqIG5ldyBpdGVtcyB3aWxsIG9ubHkgYmUgYmUgYXBwbGllZCBmb3IgdCA+PSBvZmZzZXRcbiAqIG9sZCBpdGVtcyB3aWxsIGJlIGtlcHQgZm9yIHQgPCBvZmZzZXRcbiAqIFxuICogXG4gKiBUT0RPIC0gbm90IHNhZmUgZm9yIHJlcGV0aW5nIHN0YXRlXG4gKiBcbiAqL1xuZnVuY3Rpb24gbGF5ZXJfYXBwZW5kKGxheWVyLCBpdGVtcywgb2Zmc2V0KSB7XG4gICAgY29uc3QgZXAgPSBlbmRwb2ludC5mcm9tX2lucHV0KG9mZnNldCk7XG4gICAgXG4gICAgLy8gY29uc29sZS5sb2coXCJhbGwgaXRlbXNcIiwgaXRlbXMubGVuZ3RoKTtcblxuICAgIC8vIHRydW5jYXRlIG9yIHJlbW92ZSBuZXcgaXRlbXMgYmVmb3JlIG9mZnNldFxuICAgIGNvbnN0IGluc2VydF9pdGVtcyA9IGl0ZW1zXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIC8vIGtlZXAgb25seSBpdGVtcyB3aXRoIGl0di5oaWdoID49IG9mZnNldFxuICAgICAgICAgICAgY29uc3QgaGlnaEVwID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMV07XG4gICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuZ2UoaGlnaEVwLCBlcCk7XG4gICAgICAgIH0pXG4gICAgICAgIC5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIC8vIHRydW5jYXRlIGl0ZW0gb3ZlcmxhcHBpbmcgb2Zmc2V0IGl0di5sb3c9b2Zmc2V0XG4gICAgICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KGl0ZW0uaXR2LCBlcCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdfaXRlbSA9IHsuLi5pdGVtfTtcbiAgICAgICAgICAgICAgICBuZXdfaXRlbS5pdHYgPSBbb2Zmc2V0LCBpdGVtLml0dlsxXSwgdHJ1ZSwgaXRlbS5pdHZbM11dO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXdfaXRlbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgICB9KTtcbiAgICBcbiAgICAvLyBjb25zb2xlLmxvZyhcImluc2VydFwiLCBpbnNlcnRfaXRlbXMubGVuZ3RoKTtcblxuICAgIC8vIHRydW5jYXRlIHByZS1leGlzdGluZyBpdGVtcyBvdmVybGFwcGluZyBvZmZzZXRcbiAgICBjb25zdCBtb2RpZnlfaXRlbXMgPSBsYXllci5pbmRleC5uZWFyYnkob2Zmc2V0KS5jZW50ZXIubWFwKChpdGVtKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld19pdGVtID0gey4uLml0ZW19O1xuICAgICAgICBuZXdfaXRlbS5pdHYgPSBbaXRlbS5pdHZbMF0sIG9mZnNldCwgaXRlbS5pdHZbMl0sIGZhbHNlXTtcbiAgICAgICAgcmV0dXJuIG5ld19pdGVtO1xuICAgIH0pO1xuICAgIFxuICAgIC8vIGNvbnNvbGUubG9nKFwibW9kaWZ5XCIsIG1vZGlmeV9pdGVtcy5sZW5ndGgpO1xuXG4gICAgLy9yZW1vdmUgcHJlLWV4aXN0aW5nIGl0ZW1zIHdoZXJlIGl0di5sb3cgPiBvZmZzZXRcbiAgICBjb25zdCByZW1vdmUgPSBsYXllci5zcmMuZ2V0KClcbiAgICAgICAgLmZpbHRlcigoaXRlbSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbG93RXAgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW0uaXR2KVswXTtcbiAgICAgICAgICAgIHJldHVybiBlbmRwb2ludC5ndChsb3dFcCwgZXApO1xuICAgICAgICB9KVxuICAgICAgICAubWFwKChpdGVtKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gaXRlbS5pZDtcbiAgICAgICAgfSk7XG5cbiAgICAvLyBjb25zb2xlLmxvZyhcInJlbW92ZVwiLCByZW1vdmUubGVuZ3RoKTtcblxuICAgIC8vIGxheWVyIHVwZGF0ZVxuICAgIGNvbnN0IGluc2VydCA9IFsuLi5tb2RpZnlfaXRlbXMsIC4uLmluc2VydF9pdGVtc107XG4gICAgcmV0dXJuIGxheWVyX3VwZGF0ZShsYXllciwge3JlbW92ZSwgaW5zZXJ0LCByZXNldDpmYWxzZX0pXG59XG5cblxuXG4iLCJpbXBvcnQgeyBDdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3JfYmFzZS5qc1wiO1xuaW1wb3J0IHsgaXNfY2xvY2tfcHJvdmlkZXIgfSBmcm9tIFwiLi9wcm92aWRlcl9jbG9jay5qc1wiO1xuLyoqXG4gKiBDbG9jayBjdXJzb3IgaXMgYSB0aGluIHdyYXBwZXIgYXJvdW5kIGEgY2xvY2tQcm92aWRlcixcbiAqIHNvIHRoYXQgaXQgY2FuIGJlIGNvbnN1bWVkIGFzIGEgY3Vyc29yLlxuICogXG4gKiBUaGUgY3RybCBwcm9wZXJ0eSBvZiBhbnkgQ3Vyc29yIGlzIHJlcXVpcmVkIHRvIGJlIGEgQ3Vyc29yIG9yIHVuZGVmaW5lZCxcbiAqIHNvIGluIHRoZSBjYXNlIG9mIGEgY2xvY2sgY3Vyc29yLCB3aGljaCBpcyB0aGUgc3RhcnRpbmcgcG9pbnQsXG4gKiB0aGUgY3RybCBwcm9wZXJ0eSBpcyBhbHdheXMgc2V0IHRvIHVuZGVmaW5lZC5cbiAqIFxuICogQWRkaXRpb25hbGx5LCBjbG9jayBjdXJzb3Iuc3JjIGlzIGFsc28gdW5kZWZpbmVkLlxuICogXG4gKiBDdXJzb3IgdHJhbnNmb3JtYXRpb24gb2YgYSBjbG9jayBjdXJzb3Igd2lsbCByZXN1bHQgaW4gYSBuZXcgY2xvY2sgY3Vyc29yLlxuICogIFxuICogSWRlbmZpZnlpbmcgYSBjdXJzb3IgYXMgYSBjbG9jayBjdXJzb3Igb3Igbm90IGlzIGltcG9ydGFudCBmb3IgcGxheWJhY2tcbiAqIGxvZ2ljIGluIGN1cnNvciBpbXBsZW1tZW50YXRpb24uXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2Nsb2NrX2N1cnNvcihvYmopIHtcbiAgICByZXR1cm4gb2JqIGluc3RhbmNlb2YgQ3Vyc29yICYmIG9iai5jdHJsID09IHVuZGVmaW5lZCAmJiBvYmouc3JjID09IHVuZGVmaW5lZDsgXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbG9ja19jdXJzb3Ioc3JjKSB7XG5cbiAgICBpZiAoIWlzX2Nsb2NrX3Byb3ZpZGVyKHNyYykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzcmMgbXVzdCBiZSBjbG9ja1Byb3ZpZGVyICR7c3JjfWApO1xuICAgIH1cbiAgICBjb25zdCBjdXJzb3IgPSBuZXcgQ3Vyc29yKCk7XG4gICAgY3Vyc29yLnF1ZXJ5ID0gZnVuY3Rpb24gKGxvY2FsX3RzKSB7XG4gICAgICAgIGNvbnN0IGNsb2NrX3RzID0gc3JjLm5vdyhsb2NhbF90cyk7XG4gICAgICAgIHJldHVybiB7dmFsdWU6Y2xvY2tfdHMsIGR5bmFtaWM6dHJ1ZSwgb2Zmc2V0OmxvY2FsX3RzfTtcbiAgICB9XG4gICAgcmV0dXJuIGN1cnNvcjtcbn1cbiIsImltcG9ydCB7IEN1cnNvciB9IGZyb20gXCIuL2N1cnNvcl9iYXNlLmpzXCI7XG5pbXBvcnQgeyBpc19pdGVtc19sYXllciB9IGZyb20gXCIuL2xheWVyX2l0ZW1zLmpzXCI7XG5pbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuL3V0aWwvYXBpX3NyY3Byb3AuanNcIjtcbmltcG9ydCB7IHJhbmRvbV9zdHJpbmcsIHNldF90aW1lb3V0LCBjaGVja19udW1iZXIsIG1vdGlvbl91dGlscyB9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5pbXBvcnQgeyBpc19jbG9ja19jdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3JfY2xvY2suanNcIjtcblxuY29uc3QgY2hlY2tfcmFuZ2UgPSBtb3Rpb25fdXRpbHMuY2hlY2tfcmFuZ2U7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogVkFSSUFCTEUgQ1VSU09SXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBmdW5jdGlvbiB2YXJpYWJsZV9jdXJzb3IoY3RybCwgc3JjKSB7XG5cbiAgICBjb25zdCBjdXJzb3IgPSBuZXcgQ3Vyc29yKCk7XG5cbiAgICAvLyBjYWNoZSBmb3Igc3JjXG4gICAgbGV0IHNyY19jYWNoZTtcbiAgICAvLyB0aW1lb3V0XG4gICAgbGV0IHRpZDtcblxuICAgIC8vIHNldHVwIHNyYyBwcm9wZXJ0eVxuICAgIHNyY3Byb3AuYWRkU3RhdGUoY3Vyc29yKTtcbiAgICBzcmNwcm9wLmFkZE1ldGhvZHMoY3Vyc29yKTtcbiAgICBjdXJzb3Iuc3JjcHJvcF9yZWdpc3RlcihcImN0cmxcIik7XG4gICAgY3Vyc29yLnNyY3Byb3BfcmVnaXN0ZXIoXCJzcmNcIik7XG5cbiAgICBjdXJzb3Iuc3JjcHJvcF9jaGVjayA9IGZ1bmN0aW9uIChwcm9wTmFtZSwgb2JqKSB7XG5cbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwiY3RybFwiKSB7XG4gICAgICAgICAgICBpZiAoIWlzX2Nsb2NrX2N1cnNvcihvYmopKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjdHJsIG11c3QgYmUgYSBjbG9jayBjdXJzb3IgJHtvYmp9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAoIWlzX2l0ZW1zX2xheWVyKG9iaikpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNyYyBtdXN0IGJlIGFuIGl0ZW0gbGF5ZXIgJHtvYmp9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9XG4gICAgfVxuICAgIGN1cnNvci5zcmNwcm9wX29uY2hhbmdlID0gZnVuY3Rpb24gKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChjdXJzb3Iuc3JjID09IHVuZGVmaW5lZCB8fCBjdXJzb3IuY3RybCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzcmNcIikge1xuICAgICAgICAgICAgaWYgKGVBcmcgPT0gXCJyZXNldFwiKSB7XG4gICAgICAgICAgICAgICAgc3JjX2NhY2hlID0gY3Vyc29yLnNyYy5jcmVhdGVDYWNoZSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzcmNfY2FjaGUuY2xlYXIoKTsgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZGV0ZWN0X2Z1dHVyZV9ldmVudCgpO1xuICAgICAgICBjdXJzb3Iub25jaGFuZ2UoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjdXJzb3IuY3RybCAoY2xvY2spIGRlZmluZXMgYW4gYWN0aXZlIHJlZ2lvbiBvZiBjdXJzb3Iuc3JjIChsYXllcilcbiAgICAgKiBhdCBzb21lIHBvaW50IGluIHRoZSBmdXR1cmUsIHRoZSBjdXJzb3IuY3RybCB3aWxsIGxlYXZlIHRoaXMgcmVnaW9uLlxuICAgICAqIGluIHRoYXQgbW9tZW50LCBjdXJzb3Igc2hvdWxkIHJlZXZhbHVhdGUgaXRzIHN0YXRlIC0gc28gd2UgbmVlZCB0byBcbiAgICAgKiBkZXRlY3QgdGhpcyBldmVudCBieSB0aW1lb3V0ICBcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIGRldGVjdF9mdXR1cmVfZXZlbnQoKSB7XG4gICAgICAgIGlmICh0aWQpIHt0aWQuY2FuY2VsKCk7fVxuICAgICAgICAvLyBjdHJsIFxuICAgICAgICBjb25zdCB0cyA9IGN1cnNvci5jdHJsLnZhbHVlO1xuICAgICAgICAvLyBuZWFyYnkgZnJvbSBzcmNcbiAgICAgICAgY29uc3QgbmVhcmJ5ID0gY3Vyc29yLnNyYy5pbmRleC5uZWFyYnkodHMpO1xuICAgICAgICBjb25zdCByZWdpb25faGlnaCA9IG5lYXJieS5pdHZbMV0gfHwgSW5maW5pdHk7ICAgICAgICBcblxuICAgICAgICBpZiAocmVnaW9uX2hpZ2ggPT0gSW5maW5pdHkpIHtcbiAgICAgICAgICAgIC8vIG5vIGZ1dHVyZSBsZWF2ZSBldmVudFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRlbHRhX21zID0gKHJlZ2lvbl9oaWdoIC0gdHMpICogMTAwMDtcbiAgICAgICAgdGlkID0gc2V0X3RpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgY3Vyc29yLm9uY2hhbmdlKCk7XG4gICAgICAgIH0sIGRlbHRhX21zKTtcbiAgICB9XG5cbiAgICBjdXJzb3IucXVlcnkgPSBmdW5jdGlvbiBxdWVyeShsb2NhbF90cykge1xuICAgICAgICBjb25zdCBvZmZzZXQgPSBjdXJzb3IuY3RybC5xdWVyeShsb2NhbF90cykudmFsdWU7XG4gICAgICAgIHJldHVybiBzcmNfY2FjaGUucXVlcnkob2Zmc2V0KTtcbiAgICB9XG4gICAgXG4gICAgLyoqXG4gICAgICogVVBEQVRFIEFQSSBmb3IgVmFyaWFibGUgQ3Vyc29yXG4gICAgICovICAgIFxuICAgIGN1cnNvci5zZXQgPSBmdW5jdGlvbiBzZXQodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHNldF92YWx1ZShjdXJzb3IsIHZhbHVlKTtcbiAgICB9XG4gICAgY3Vyc29yLm1vdGlvbiA9IGZ1bmN0aW9uIG1vdGlvbih2ZWN0b3IpIHtcbiAgICAgICAgcmV0dXJuIHNldF9tb3Rpb24oY3Vyc29yLCB2ZWN0b3IpO1xuICAgIH1cbiAgICBjdXJzb3IudHJhbnNpdGlvbiA9IGZ1bmN0aW9uIHRyYW5zaXRpb24oe3RhcmdldCwgZHVyYXRpb24sIGVhc2luZ30pIHtcbiAgICAgICAgcmV0dXJuIHNldF90cmFuc2l0aW9uKGN1cnNvciwgdGFyZ2V0LCBkdXJhdGlvbiwgZWFzaW5nKTtcbiAgICB9XG4gICAgY3Vyc29yLmludGVycG9sYXRlID0gZnVuY3Rpb24gaW50ZXJwb2xhdGUgKHt0dXBsZXMsIGR1cmF0aW9ufSkge1xuICAgICAgICByZXR1cm4gc2V0X2ludGVycG9sYXRpb24oY3Vyc29yLCB0dXBsZXMsIGR1cmF0aW9uKTtcbiAgICB9XG4gICAgXG4gICAgLy8gaW5pdGlhbGl6ZVxuICAgIGN1cnNvci5jdHJsID0gY3RybDtcbiAgICBjdXJzb3Iuc3JjID0gc3JjO1xuICAgIHJldHVybiBjdXJzb3I7XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ1VSU09SIFVQREFURSBBUElcbiAqICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBzZXQgdmFsdWUgb2YgY3Vyc29yXG4gKi9cblxuZnVuY3Rpb24gc2V0X3ZhbHVlKGN1cnNvciwgdmFsdWUpIHtcbiAgICBjb25zdCBpdGVtcyA9IFt7XG4gICAgICAgIGlkOiByYW5kb21fc3RyaW5nKDEwKSxcbiAgICAgICAgaXR2OiBbbnVsbCwgbnVsbCwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgIGRhdGE6IHZhbHVlICAgICAgICAgICAgICAgICBcbiAgICB9XTtcbiAgICByZXR1cm4gY3Vyc29yLnNyYy51cGRhdGUoe2luc2VydDppdGVtcywgcmVzZXQ6dHJ1ZX0pO1xufVxuXG4vKipcbiAqIHNldCBtb3Rpb24gc3RhdGVcbiAqICBcbiAqIG1vdGlvbiBvbmx5IG1ha2VzIHNlbnNlIGlmIHZhcmlhYmxlIGN1cnNvciBpcyByZXN0cmljdGVkIHRvIG51bWJlciB2YWx1ZXMsXG4gKiB3aGljaCBpbiB0dXJuIGltcGxpZXMgdGhhdCB0aGUgY3Vyc29yLnNyYyAoSXRlbXMgTGF5ZXIpIHNob3VsZCBiZVxuICogcmVzdHJpY3RlZCB0byBudW1iZXIgdmFsdWVzLiBcbiAqIElmIG5vbi1udW1iZXIgdmFsdWVzIG9jY3VyIC0gd2Ugc2ltcGx5IHJlcGxhY2Ugd2l0aCAwLlxuICogQWxzbywgaXRlbXMgbGF5ZXIgc2hvdWxkIGhhdmUgYSBzaW5nbGUgaXRlbSBpbiBuZWFyYnkgY2VudGVyLlxuICogXG4gKiBpZiBwb3NpdGlvbiBpcyBvbWl0dGVkIGluIHZlY3RvciAtIGN1cnJlbnQgcG9zaXRpb24gd2lsbCBiZSBhc3N1bWVkXG4gKiBpZiB0aW1lc3RhbXAgaXMgb21pdHR0ZWQgaW4gdmVjdG9yIC0gY3VycmVudCB0aW1lc3RhbXAgd2lsbCBiZSBhc3N1bWVkXG4gKiBpZiB2ZWxvY2l0eSBhbmQgYWNjZWxlcmF0aW9uIGFyZSBvbW1pdHRlZCBpbiB2ZWN0b3IgXG4gKiAtIHRoZXNlIHdpbGwgYmUgc2V0IHRvIHplcm8uXG4gKi9cblxuZnVuY3Rpb24gc2V0X21vdGlvbihjdXJzb3IsIHZlY3Rvcj17fSkge1xuICAgIC8vIGdldCB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgY3Vyc29yXG4gICAgbGV0IHt2YWx1ZTpwMCwgb2Zmc2V0OnQwfSA9IGN1cnNvci5xdWVyeSgpO1xuICAgIC8vIGVuc3VyZSB0aGF0IHAwIGlzIG51bWJlciB0eXBlXG4gICAgaWYgKHR5cGVvZiBwMCAhPT0gJ251bWJlcicgfHwgIWlzRmluaXRlKHAwKSkge1xuICAgICAgICBwMCA9IDA7XG4gICAgfVxuICAgIC8vIGZldGNoIG5ldyB2YWx1ZXMgZnJvbSB2ZWN0b3JcbiAgICBjb25zdCB7XG4gICAgICAgIHBvc2l0aW9uOnAxPXAwLFxuICAgICAgICB2ZWxvY2l0eTp2MT0wLFxuICAgICAgICBhY2NlbGVyYXRpb246YTE9MCxcbiAgICAgICAgdGltZXN0YW1wOnQxPXQwLFxuICAgICAgICByYW5nZT1bbnVsbCwgbnVsbF1cbiAgICB9ID0gdmVjdG9yO1xuICAgIGNoZWNrX3JhbmdlKHJhbmdlKTtcbiAgICBjaGVja19udW1iZXIoXCJwb3NpdGlvblwiLCBwMSk7XG4gICAgY2hlY2tfbnVtYmVyKFwidmVsb2NpdHlcIiwgdjEpO1xuICAgIGNoZWNrX251bWJlcihcImFjY2VsZXJhdGlvblwiLCBhMSk7XG4gICAgY2hlY2tfbnVtYmVyKFwidGltZXN0YW1wXCIsIHQxKTtcblxuICAgIGNvbnN0IGl0ZW1zID0gW107XG5cbiAgICAvKipcbiAgICAgKiBpZiBwb3MgcmFuZ2UgaXMgYm91bmRlZCBsb3cgb3IgaGlnaCBvciBib3RoLFxuICAgICAqIHRoaXMgcG90ZW50aWFsbHkgY29ycmVzcG9uZHMgdG8gbXVsdGlwbGUgdGltZSByYW5nZXMgW1t0MCwgdDFdXSBcbiAgICAgKiB3aGVyZSB0aGUgbW90aW9uIHBvc2l0aW9uIGlzIGxlZ2FsICBcbiAgICAgKiBsb3cgPD0gcCA8PSBoaWdoIFxuICAgICAqL1xuICAgIGNvbnN0IGN0ciA9IG1vdGlvbl91dGlscy5jYWxjdWxhdGVfdGltZV9yYW5nZXM7XG4gICAgY29uc3QgdGltZV9yYW5nZXMgPSBjdHIoW3AxLHYxLGExLHQxXSwgcmFuZ2UpO1xuICAgIC8vIHBpY2sgYSB0aW1lIHJhbmdlIHdoaWNoIGNvbnRhaW5zIHQxXG4gICAgY29uc3QgdHMgPSBjdXJzb3IuY3RybC52YWx1ZTtcblxuICAgIGNvbnN0IHRpbWVfcmFuZ2UgPSB0aW1lX3Jhbmdlcy5maW5kKCh0cikgPT4ge1xuICAgICAgICBjb25zdCBsb3cgPSB0clswXSA/PyAtSW5maW5pdHk7XG4gICAgICAgIGNvbnN0IGhpZ2ggPSB0clsxXSA/PyBJbmZpbml0eTtcbiAgICAgICAgcmV0dXJuIGxvdyA8PSB0cyAmJiB0cyA8PSBoaWdoO1xuICAgIH0pO1xuICAgIGlmICh0aW1lX3JhbmdlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCBbbG93LCBoaWdoXSA9IHRpbWVfcmFuZ2U7XG4gICAgICAgIGl0ZW1zLnB1c2goe1xuICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgaXR2OiBbbG93LCBoaWdoLCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwibW90aW9uXCIsXG4gICAgICAgICAgICBkYXRhOiB7cG9zaXRpb246cDEsIHZlbG9jaXR5OnYxLCBhY2NlbGVyYXRpb246YTEsIHRpbWVzdGFtcDp0MX1cbiAgICAgICAgfSk7XG4gICAgICAgIC8vIGFkZCBsZWZ0IGlmIG5lZWRlZFxuICAgICAgICBpZiAobG93ICE9IG51bGwpIHtcbiAgICAgICAgICAgIGl0ZW1zLnB1c2goe1xuICAgICAgICAgICAgICAgIGlkOiByYW5kb21fc3RyaW5nKDEwKSxcbiAgICAgICAgICAgICAgICBpdHY6IFtudWxsLCBsb3csIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgICAgIGRhdGE6IHJhbmdlWzBdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBhZGQgcmlnaHQgaWYgbmVlZGVkXG4gICAgICAgIGlmIChoaWdoICE9IG51bGwpIHtcbiAgICAgICAgICAgIGl0ZW1zLnB1c2goe1xuICAgICAgICAgICAgICAgIGlkOiByYW5kb21fc3RyaW5nKDEwKSxcbiAgICAgICAgICAgICAgICBpdHY6IFtoaWdoLCBudWxsLCBmYWxzZSwgdHJ1ZV0sXG4gICAgICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgICAgICBkYXRhOiByYW5nZVsxXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICAvKiBcbiAgICAgICAgICAgIG5vIHRpbWVfcmFuZ2UgZm91bmRcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcDEgaXMgb3V0c2lkZSB0aGUgcG9zX3JhbmdlXG4gICAgICAgICAgICBpZiBwMSBpcyBsZXNzIHRoYW4gbG93LCB0aGVuIHVzZSBsb3dcbiAgICAgICAgICAgIGlmIHAxIGlzIGdyZWF0ZXIgdGhhbiBoaWdoLCB0aGVuIHVzZSBoaWdoXG4gICAgICAgICovXG4gICAgICAgIGNvbnN0IHZhbCA9IChwMSA8IHJhbmdlWzBdKSA/IHJhbmdlWzBdIDogcmFuZ2VbMV07XG4gICAgICAgIGl0ZW1zLnB1c2goe1xuICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgaXR2OiBbbnVsbCwgbnVsbCwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdmFsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gY3Vyc29yLnNyYy51cGRhdGUoe2luc2VydDppdGVtcywgcmVzZXQ6dHJ1ZX0pO1xufVxuXG4vKipcbiAqIHNldCB0cmFuc2l0aW9uIC0gdG8gdGFyZ2V0IHBvc2l0aW9uIHVzaW5nIGluIDxkdXJhdGlvbj4gc2Vjb25kcy5cbiAqL1xuXG5mdW5jdGlvbiBzZXRfdHJhbnNpdGlvbihjdXJzb3IsIHRhcmdldCwgZHVyYXRpb24sIGVhc2luZykge1xuICAgIGNvbnN0IHt2YWx1ZTp2MCwgb2Zmc2V0OnQwfSA9IGN1cnNvci5xdWVyeSgpO1xuICAgIGNvbnN0IHYxID0gdGFyZ2V0O1xuICAgIGNvbnN0IHQxID0gdDAgKyBkdXJhdGlvbjtcbiAgICBjaGVja19udW1iZXIoXCJwb3NpdGlvblwiLCB2MCk7XG4gICAgY2hlY2tfbnVtYmVyKFwicG9zaXRpb25cIiwgdjEpO1xuICAgIGNoZWNrX251bWJlcihcInBvc2l0aW9uXCIsIHQwKTtcbiAgICBjaGVja19udW1iZXIoXCJwb3NpdGlvblwiLCB0MSk7XG4gICAgbGV0IGl0ZW1zID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICBpZDogcmFuZG9tX3N0cmluZygxMCksXG4gICAgICAgICAgICBpdHY6IFtudWxsLCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYwXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlkOiByYW5kb21fc3RyaW5nKDEwKSxcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInRyYW5zaXRpb25cIixcbiAgICAgICAgICAgIGRhdGE6IHt2MCwgdjEsIHQwLCB0MSwgZWFzaW5nfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpZDogcmFuZG9tX3N0cmluZygxMCksXG4gICAgICAgICAgICBpdHY6IFt0MSwgbnVsbCwgZmFsc2UsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYxXG4gICAgICAgIH1cbiAgICBdXG4gICAgcmV0dXJuIGN1cnNvci5zcmMudXBkYXRlKHtpbnNlcnQ6aXRlbXMsIHJlc2V0OnRydWV9KTtcbn1cblxuLyoqXG4gKiBzZXQgaW50ZXJwb2xhdGlvblxuICogXG4gKiBhc3N1bWVzIHRpbWVzdGFtcHMgYXJlIGluIHJhbmdlIFswLDFdXG4gKiBzY2FsZSB0aW1lc3RhbXBzIHRvIGR1cmF0aW9uIGFuZCBvZmZzZXQgYnkgdDBcbiAqIGFzc3VtaW5nIGludGVycG9sYXRpb24gc3RhcnRzIGF0IHQwXG4gKi9cblxuZnVuY3Rpb24gc2V0X2ludGVycG9sYXRpb24oY3Vyc29yLCB0dXBsZXMsIGR1cmF0aW9uKSB7XG4gICAgY29uc3Qgbm93ID0gY3Vyc29yLmN0cmwudmFsdWU7XG4gICAgdHVwbGVzID0gdHVwbGVzLm1hcCgoW3YsdF0pID0+IHtcbiAgICAgICAgY2hlY2tfbnVtYmVyKFwidHNcIiwgdCk7XG4gICAgICAgIGNoZWNrX251bWJlcihcInZhbFwiLCB2KTtcbiAgICAgICAgcmV0dXJuIFt2LCBub3cgKyB0KmR1cmF0aW9uXTtcbiAgICB9KVxuICAgIGNvbnN0IFt2MCwgdDBdID0gdHVwbGVzWzBdO1xuICAgIGNvbnN0IFt2MSwgdDFdID0gdHVwbGVzW3R1cGxlcy5sZW5ndGgtMV07XG4gICAgY29uc3QgaXRlbXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgdDAsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MCwgdDEsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwiaW50ZXJwb2xhdGlvblwiLFxuICAgICAgICAgICAgZGF0YTogdHVwbGVzXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdjFcbiAgICAgICAgfVxuICAgIF1cbiAgICByZXR1cm4gY3Vyc29yLnNyYy51cGRhdGUoe2luc2VydDppdGVtcywgcmVzZXQ6dHJ1ZX0pO1xufVxuXG5cbi8qKlxuICogVE9ETzogc3VwcG9ydCBhbHRlcm5hdGl2ZSB1cGRhdGUgZm9yIHN0YXRlIHJlY29yZGluZy5cbiAqIFRoaXMgZWZmZWN0aXZlbHkgbWVhbnMgdGhhdCByZWNvcmRpbmcgaXMgYSBcbiAqIGJ1bHRpbiBmZWF0dXJlIG9mIHRoZSB2YXJpYWJsZSBjdXJzb3IuIENvdWxkIGJlIGVuYWJsZWQgYnkgb3B0aW9uLlxuICogVG8gY2FsY3VsdGF0ZSB0aGUgbmV3IHN0YXRlLCBuZWVkIHRvIHRydW5jYXRlIGV4aXN0aW5nIHN0YXRlXG4gKiBhbmQgYXBwZW5kIG5ldyBpdGVtcy4gSW5kZXggc3VwcG9ydCBmb3IgdGhlIHByb3ZpZGVyIHdvdWxkIGJlIG5lZWRlZCxcbiAqIHNvIHRoYXQgd2UgY2FuIGNsZWFyIGFsbCBzdGF0ZSBpbiBpbnRlcnZhbCBbdHMsIG51bGxdLCBcbiAqIGFuZCB0aGVuIGFwcGVuZCBuZXcgaXRlbXMgdG8gdGhlIHNhbWUgaW50ZXJ2YWwuIFdvdWxkIGFsc28gbmVlZCB0b1xuICogZm9yd2FyZCBhIHRzIGZyb20gZWFjaCBvZiB0aGUgdXBkYXRlIG1ldGhvZHMuXG4gKiBcbiAqIENoZWNrIG91dCBzb21lIHNpbWlsYXIgY29kZSBmcm9tIFN0YXRlIFRyYWplY3RvcnkgXG4gKiBcbiAqLyIsImltcG9ydCB7IEN1cnNvciwgZ2V0X2N1cnNvcl9jdHJsX3N0YXRlIH0gZnJvbSBcIi4vY3Vyc29yX2Jhc2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4vbGF5ZXJfYmFzZS5qc1wiO1xuaW1wb3J0IHsgaXNfaXRlbXNfbGF5ZXIgfSBmcm9tIFwiLi9sYXllcl9pdGVtcy5qc1wiO1xuaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi91dGlsL2FwaV9zcmNwcm9wLmpzXCI7XG5pbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBzZXRfdGltZW91dCB9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5pbXBvcnQgeyBpc19jbG9ja19jdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3JfY2xvY2suanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBQTEFZQkFDSyBDVVJTT1JcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHBsYXliYWNrX2N1cnNvcihjdHJsLCBzcmMpIHtcblxuICAgIGNvbnN0IGN1cnNvciA9IG5ldyBDdXJzb3IoKTtcblxuICAgIC8vIHNyYyBjYWNoZVxuICAgIGxldCBzcmNfY2FjaGU7XG4gICAgLy8gdGltZW91dFxuICAgIGxldCB0aWQ7XG4gICAgLy8gcG9sbGluZ1xuICAgIGxldCBwaWQ7XG5cbiAgICAvLyBzZXR1cCBzcmMgcHJvcGVydHlcbiAgICBzcmNwcm9wLmFkZFN0YXRlKGN1cnNvcik7XG4gICAgc3JjcHJvcC5hZGRNZXRob2RzKGN1cnNvcik7XG4gICAgY3Vyc29yLnNyY3Byb3BfcmVnaXN0ZXIoXCJjdHJsXCIpO1xuICAgIGN1cnNvci5zcmNwcm9wX3JlZ2lzdGVyKFwic3JjXCIpO1xuXG4gICAgLyoqXG4gICAgICogc3JjIHByb3BlcnR5IGluaXRpYWxpemF0aW9uIGNoZWNrXG4gICAgICovXG4gICAgY3Vyc29yLnNyY3Byb3BfY2hlY2sgPSBmdW5jdGlvbiAocHJvcE5hbWUsIG9iaikge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJjdHJsXCIpIHtcbiAgICAgICAgICAgIGlmIChvYmogaW5zdGFuY2VvZiBDdXJzb3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgY3RybCBtdXN0IGJlIGNsb2NrUHJvdmlkZXIgb3IgQ3Vyc29yICR7b2JqfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAob2JqIGluc3RhbmNlb2YgTGF5ZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNyYyBtdXN0IGJlIExheWVyICR7b2JqfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogaGFuZGxlIHNyYyBwcm9wZXJ0eSBjaGFuZ2VcbiAgICAgKi9cbiAgICBjdXJzb3Iuc3JjcHJvcF9vbmNoYW5nZSA9IGZ1bmN0aW9uIChwcm9wTmFtZSwgZUFyZykge1xuICAgICAgICBpZiAoY3Vyc29yLnNyYyA9PSB1bmRlZmluZWQgfHwgY3Vyc29yLmN0cmwgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmIChlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIHNyY19jYWNoZSA9IGN1cnNvci5zcmMuY3JlYXRlQ2FjaGUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3JjX2NhY2hlLmNsZWFyKCk7ICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGN1cnNvcl9vbmNoYW5nZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIG1haW4gY3Vyc29yIGNoYW5nZSBoYW5kbGVyXG4gICAgICovXG4gICAgZnVuY3Rpb24gY3Vyc29yX29uY2hhbmdlKCkge1xuICAgICAgICBjdXJzb3Iub25jaGFuZ2UoKTtcbiAgICAgICAgZGV0ZWN0X2Z1dHVyZV9ldmVudCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGN1cnNvci5jdHJsIChjdXJzb3IvY2xvY2spIGRlZmluZXMgYW4gYWN0aXZlIHJlZ2lvbiBvZiBjdXJzb3Iuc3JjIChsYXllcilcbiAgICAgKiBhdCBzb21lIHBvaW50IGluIHRoZSBmdXR1cmUsIHRoZSBjdXJzb3IuY3RybCB3aWxsIGxlYXZlIHRoaXMgcmVnaW9uLlxuICAgICAqIGluIHRoYXQgbW9tZW50LCBjdXJzb3Igc2hvdWxkIHJlZXZhbHVhdGUgaXRzIHN0YXRlIC0gc28gd2UgbmVlZCB0byBcbiAgICAgKiBkZXRlY3QgdGhpcyBldmVudCwgaWRlYWxseSBieSB0aW1lb3V0LCBhbHRlcm5hdGl2ZWx5IGJ5IHBvbGxpbmcuICBcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBkZXRlY3RfZnV0dXJlX2V2ZW50KCkge1xuICAgICAgICBpZiAodGlkKSB7IHRpZC5jYW5jZWwoKTsgfVxuICAgICAgICBpZiAocGlkKSB7IGNsZWFySW50ZXJ2YWwocGlkKTsgfVxuXG4gICAgICAgIC8vIGN1cnJlbnQgc3RhdGUgb2YgY3Vyc29yLmN0cmwgXG4gICAgICAgIGNvbnN0IGN0cmxfc3RhdGUgPSBnZXRfY3Vyc29yX2N0cmxfc3RhdGUoY3Vyc29yKTtcbiAgICAgICAgLy8gY3VycmVudCAocG9zaXRpb24sIHRpbWUpIG9mIGN1cnNvci5jdHJsXG4gICAgICAgIGNvbnN0IGN1cnJlbnRfcG9zID0gY3RybF9zdGF0ZS52YWx1ZTtcbiAgICAgICAgY29uc3QgY3VycmVudF90cyA9IGN0cmxfc3RhdGUub2Zmc2V0O1xuXG4gICAgICAgIC8vIG5vIGZ1dHVyZSBldmVudCBpZiB0aGUgY3RybCBpcyBzdGF0aWNcbiAgICAgICAgaWYgKCFjdHJsX3N0YXRlLmR5bmFtaWMpIHtcbiAgICAgICAgICAgIC8vIHdpbGwgbmV2ZXIgbGVhdmUgcmVnaW9uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjdXJyZW50IHJlZ2lvbiBvZiBjdXJzb3Iuc3JjXG4gICAgICAgIGNvbnN0IHNyY19uZWFyYnkgPSBjdXJzb3Iuc3JjLmluZGV4Lm5lYXJieShjdXJyZW50X3Bvcyk7XG5cbiAgICAgICAgY29uc3QgcmVnaW9uX2xvdyA9IHNyY19uZWFyYnkuaXR2WzBdID8/IC1JbmZpbml0eTtcbiAgICAgICAgY29uc3QgcmVnaW9uX2hpZ2ggPSBzcmNfbmVhcmJ5Lml0dlsxXSA/PyBJbmZpbml0eTtcblxuICAgICAgICAvLyBubyBmdXR1cmUgbGVhdmUgZXZlbnQgaWYgdGhlIHJlZ2lvbiBjb3ZlcnMgdGhlIGVudGlyZSB0aW1lbGluZSBcbiAgICAgICAgaWYgKHJlZ2lvbl9sb3cgPT0gLUluZmluaXR5ICYmIHJlZ2lvbl9oaWdoID09IEluZmluaXR5KSB7XG4gICAgICAgICAgICAvLyB3aWxsIG5ldmVyIGxlYXZlIHJlZ2lvblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzX2Nsb2NrX2N1cnNvcihjdXJzb3IuY3RybCkpIHtcbiAgICAgICAgICAgIC8qIFxuICAgICAgICAgICAgICAgIGN1cnNvci5jdHJsIGlzIGEgY2xvY2sgcHJvdmlkZXJcblxuICAgICAgICAgICAgICAgIHBvc3NpYmxlIHRpbWVvdXQgYXNzb2NpYXRlZCB3aXRoIGxlYXZpbmcgcmVnaW9uXG4gICAgICAgICAgICAgICAgdGhyb3VnaCByZWdpb25faGlnaCAtIGFzIGNsb2NrIGlzIGluY3JlYXNpbmcuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICBjb25zdCB0YXJnZXRfcG9zID0gcmVnaW9uX2hpZ2g7XG4gICAgICAgICAgICBjb25zdCBkZWx0YV9tcyA9ICh0YXJnZXRfcG9zIC0gY3VycmVudF9wb3MpICogMTAwMDtcbiAgICAgICAgICAgIHRpZCA9IHNldF90aW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICBjdXJzb3Jfb25jaGFuZ2UoKTtcbiAgICAgICAgICAgIH0sIGRlbHRhX21zKTtcbiAgICAgICAgICAgIC8vIGxlYXZlIGV2ZW50IHNjaGVkdWxlZFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IFxuICAgICAgICBcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgaXNfY2xvY2tfY3Vyc29yKGN1cnNvci5jdHJsLmN0cmwpICYmIFxuICAgICAgICAgICAgaXNfaXRlbXNfbGF5ZXIoY3Vyc29yLmN0cmwuc3JjKVxuICAgICAgICApIHtcbiAgICAgICAgICAgIC8qIFxuICAgICAgICAgICAgICAgIGN1cnNvci5jdHJsIGlzIGEgY3Vyc29yIHdpdGggYSBjbG9jayBwcm92aWRlclxuXG4gICAgICAgICAgICAgICAgcG9zc2libGUgdGltZW91dCBhc3NvY2lhdGVkIHdpdGggbGVhdmluZyByZWdpb25cbiAgICAgICAgICAgICAgICB0aHJvdWdoIHJlZ2lvbl9sb3cgb3IgcmVnaW9uX2hpZ2guXG5cbiAgICAgICAgICAgICAgICBIb3dldmVyLCB0aGlzIGNhbiBvbmx5IGJlIHByZWRpY3RlZCBpZiBjdXJzb3IuY3RybFxuICAgICAgICAgICAgICAgIGltcGxlbWVudHMgYSBkZXRlcm1pbmlzdGljIGZ1bmN0aW9uIG9mIHRpbWUuXG5cbiAgICAgICAgICAgICAgICBUaGlzIGNhbiBiZSB0aGUgY2FzZSBpZiBjdXJzb3IuY3RyLnNyYyBpcyBhbiBpdGVtcyBsYXllcixcbiAgICAgICAgICAgICAgICBhbmQgYSBzaW5nbGUgYWN0aXZlIGl0ZW0gZGVzY3JpYmVzIGVpdGhlciBhIG1vdGlvbiBvciBhIHRyYW5zaXRpb24gKHdpdGggbGluZWFyIGVhc2luZykuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGNvbnN0IGFjdGl2ZV9pdGVtcyA9IGN1cnNvci5jdHJsLnNyYy5nZXRfaXRlbXMoY3VycmVudF90cyk7XG4gICAgICAgICAgICBsZXQgdGFyZ2V0X3BvcztcblxuICAgICAgICAgICAgaWYgKGFjdGl2ZV9pdGVtcy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFjdGl2ZV9pdGVtID0gYWN0aXZlX2l0ZW1zWzBdO1xuICAgICAgICAgICAgICAgIGlmIChhY3RpdmVfaXRlbS50eXBlID09IFwibW90aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qge3ZlbG9jaXR5LCBhY2NlbGVyYXRpb259ID0gYWN0aXZlX2l0ZW0uZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETyBjYWxjdWxhdGUgdGltZW91dCB3aXRoIGFjY2VsZXJhdGlvbiB0b29cbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjY2VsZXJhdGlvbiA9PSAwLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggcmVnaW9uIGJvdW5kYXJ5IHdlIGhpdCBmaXJzdFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZlbG9jaXR5ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldF9wb3MgPSByZWdpb25faGlnaDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0X3BvcyA9IHJlZ2lvbl9sb3c7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWx0YV9tcyA9ICh0YXJnZXRfcG9zIC0gY3VycmVudF9wb3MpICogMTAwMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpZCA9IHNldF90aW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJzb3Jfb25jaGFuZ2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIGRlbHRhX21zKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxlYXZlLWV2ZW50IHNjaGVkdWxlZFxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChhY3RpdmVfaXRlbS50eXBlID09IFwidHJhbnNpdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHt2MCwgdjEsIHQwLCB0MSwgZWFzaW5nPVwibGluZWFyXCJ9ID0gYWN0aXZlX2l0ZW0uZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVhc2luZyA9PSBcImxpbmVhclwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBsaW5lYXIgdHJhbnN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdmVsb2NpdHkgPSAodjEtdjApLyh0MS10MCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodmVsb2NpdHkgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0X3BvcyA9IE1hdGgubWluKHJlZ2lvbl9oaWdoLCB2MSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRfcG9zID0gTWF0aC5tYXgocmVnaW9uX2xvdywgdjEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVsdGFfbXMgPSAodGFyZ2V0X3BvcyAtIGN1cnJlbnRfcG9zKSAqIDEwMDA7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aWQgPSBzZXRfdGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3Vyc29yX29uY2hhbmdlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBkZWx0YV9tcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBsZWF2ZS1ldmVudCBzY2hlZHVsZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBkZXRlY3Rpb24gb2YgbGVhdmUgZXZlbnRzIGZhbGxzIGJhY2sgb24gcG9sbGluZ1xuICAgICAgICAgKi9cbiAgICAgICAgc3RhcnRfcG9sbGluZyhzcmNfbmVhcmJ5Lml0dik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc3RhcnQgcG9sbGluZ1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIHN0YXJ0X3BvbGxpbmcoaXR2KSB7XG4gICAgICAgIHBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICAgIGhhbmRsZV9wb2xsaW5nKGl0dik7XG4gICAgICAgIH0sIDEwMCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogaGFuZGxlIHBvbGxpbmdcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBoYW5kbGVfcG9sbGluZyhpdHYpIHtcbiAgICAgICAgbGV0IG9mZnNldCA9IGN1cnNvci5jdHJsLnZhbHVlO1xuICAgICAgICBpZiAoIWludGVydmFsLmNvdmVyc19lbmRwb2ludChpdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgIGN1cnNvcl9vbmNoYW5nZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBtYWluIHF1ZXJ5IGZ1bmN0aW9uIC0gcmVzb2x2aW5nIHF1ZXJ5XG4gICAgICogZnJvbSBjYWNoZSBvYmplY3QgYXNzb2NpYXRlZCB3aXRoIGN1cnNvci5zcmNcbiAgICAgKi9cblxuICAgIGN1cnNvci5xdWVyeSA9IGZ1bmN0aW9uIHF1ZXJ5KGxvY2FsX3RzKSB7XG4gICAgICAgIGNvbnN0IG9mZnNldCA9IGdldF9jdXJzb3JfY3RybF9zdGF0ZShjdXJzb3IsIGxvY2FsX3RzKS52YWx1ZTsgXG4gICAgICAgIHJldHVybiBzcmNfY2FjaGUucXVlcnkob2Zmc2V0KTtcbiAgICB9XG4gICAgXG4gICAgLy8gaW5pdGlhbGl6ZVxuICAgIGN1cnNvci5jdHJsID0gY3RybDtcbiAgICBjdXJzb3Iuc3JjID0gc3JjO1xuICAgIHJldHVybiBjdXJzb3I7XG59IiwiaW1wb3J0IHsgZW5kcG9pbnR9IGZyb20gXCIuLi91dGlsL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4uL25lYXJieV9iYXNlLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcl9iYXNlLmpzXCJcbmltcG9ydCB7IEN1cnNvciB9IGZyb20gXCIuLi9jdXJzb3JfYmFzZS5qc1wiO1xuXG4vKipcbiAqIFRoaXMgd3JhcHMgYSBjdXJzb3Igc28gdGhhdCBpdCBjYW4gYmUgdXNlZCBhcyBhIGxheWVyLlxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBsYXllcl9mcm9tX2N1cnNvcihzcmMpIHtcblxuICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIEN1cnNvcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzcmMgbXVzdCBiZSBhIEN1cnNvciAke3NyY31gKTtcbiAgICB9XG4gXG4gICAgY29uc3QgbGF5ZXIgPSBuZXcgTGF5ZXIoKTtcbiAgICBsYXllci5pbmRleCA9IG5ldyBDdXJzb3JJbmRleChzcmMpO1xuICAgIFxuICAgIC8vIHN1YnNjcmliZVxuICAgIHNyYy5hZGRfY2FsbGJhY2soKGVBcmcpID0+IHtcbiAgICAgICAgbGF5ZXIub25jaGFuZ2UoZUFyZyk7XG4gICAgfSk7XG5cbiAgICAvLyBpbml0aWFsaXNlXG4gICAgbGF5ZXIuc3JjID0gc3JjO1xuICAgIHJldHVybiBsYXllcjtcbn0gXG5cblxuLyoqXG4gKiBDcmVhdGUgYSBOZWFyYnlJbmRleCBmb3IgdGhlIEN1cnNvci5cbiAqIFxuICogVGhlIGN1cnNvciB2YWx1ZSBpcyBpbmRlcGVuZGVudCBvZiB0aW1lbGluZSBvZmZzZXQsIFxuICogd2hpY2ggaXMgdG8gc2F5IHRoYXQgaXQgaGFzIHRoZSBzYW1lIHZhbHVlIGZvciBhbGwgXG4gKiB0aW1lbGluZSBvZmZzZXRzLlxuICogXG4gKiBJbiBvcmRlciBmb3IgdGhlIGRlZmF1bHQgTGF5ZXJDYWNoZSB0byB3b3JrLCBhblxuICogb2JqZWN0IHdpdGggYSAucXVlcnkob2Zmc2V0KSBtZXRob2QgaXMgbmVlZGVkIGluIFxuICogbmVhcmJ5LmNlbnRlci4gU2luY2UgY3Vyc29ycyBzdXBwb3J0IHRoaXMgbWV0aG9kXG4gKiAoaWdub3JpbmcgdGhlIG9mZnNldCksIHdlIGNhbiB1c2UgdGhlIGN1cnNvciBkaXJlY3RseS5cbiAqL1xuXG5jbGFzcyBDdXJzb3JJbmRleCBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihjdXJzb3IpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fY3Vyc29yID0gY3Vyc29yO1xuICAgIH1cblxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgLy8gY3Vyc29yIGluZGV4IGlzIGRlZmluZWQgZm9yIGVudGlyZSB0aW1lbGluZVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXR2OiBbbnVsbCwgbnVsbCwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICBjZW50ZXI6IFt0aGlzLl9jdXJzb3JdLFxuICAgICAgICAgICAgbGVmdDogZW5kcG9pbnQuTkVHX0lORixcbiAgICAgICAgICAgIHByZXY6IGVuZHBvaW50Lk5FR19JTkYsXG4gICAgICAgICAgICByaWdodDogZW5kcG9pbnQuUE9TX0lORixcbiAgICAgICAgICAgIG5leHQ6IGVuZHBvaW50LlBPU19JTkYsXG4gICAgICAgIH1cbiAgICB9XG59XG5cbiIsImltcG9ydCAqIGFzIHNyY3Byb3AgZnJvbSBcIi4uL3V0aWwvYXBpX3NyY3Byb3AuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVyX2Jhc2UuanNcIlxuaW1wb3J0IHsgZW5kcG9pbnQgfSBmcm9tIFwiLi4vdXRpbC9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSwgbmVhcmJ5X2Zyb20gfSBmcm9tIFwiLi4vbmVhcmJ5X2Jhc2UuanNcIjtcblxuXG4vKipcbiAqIENvbnZlbmllbmNlIG1lcmdlIG9wdGlvbnNcbiAqL1xuY29uc3QgTUVSR0VfT1BUSU9OUyA9IHtcbiAgICBzdW06IHtcbiAgICAgICAgdmFsdWVGdW5jOiBmdW5jdGlvbiAoaW5mbykge1xuICAgICAgICAgICAgLy8gcmV0dXJucyB0aGUgc3VtIG9mIHZhbHVlcyBvZiBhY3RpdmUgbGF5ZXJzXG4gICAgICAgICAgICByZXR1cm4gaW5mby5zdGF0ZXNcbiAgICAgICAgICAgICAgICAubWFwKHN0YXRlID0+IHN0YXRlLnZhbHVlKSBcbiAgICAgICAgICAgICAgICAucmVkdWNlKChhY2MsIHZhbHVlKSA9PiBhY2MgKyB2YWx1ZSwgMCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHN0YWNrOiB7XG4gICAgICAgIHN0YXRlRnVuYzogZnVuY3Rpb24gKGluZm8pIHtcbiAgICAgICAgICAgIC8vIHJldHVybnMgdmFsdWVzIGZyb20gZmlyc3QgYWN0aXZlIGxheWVyXG4gICAgICAgICAgICByZXR1cm4gey4uLmluZm8uc3RhdGVzWzBdfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBhcnJheToge1xuICAgICAgICB2YWx1ZUZ1bmM6IGZ1bmN0aW9uIChpbmZvKSB7XG4gICAgICAgICAgICAvLyByZXR1cm5zIGFuIGFycmF5IHdpdGggdmFsdWVzIGZyb20gYWN0aXZlIGxheWVyc1xuICAgICAgICAgICAgcmV0dXJuIGluZm8uc3RhdGVzLm1hcChzdGF0ZSA9PiBzdGF0ZS52YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogXG4gKiBUaGlzIGltcGxlbWVudHMgYSBtZXJnZSBvcGVyYXRpb24gZm9yIGxheWVycy5cbiAqIExpc3Qgb2Ygc291cmNlcyBpcyBpbW11dGFibGUuXG4gKiBcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gbWVyZ2VfbGF5ZXIgKHNvdXJjZXMsIG9wdGlvbnM9e30pIHtcbiAgICBsZXQge3R5cGU9XCJcIiwgLi4ub3B0c30gPSBvcHRpb25zO1xuXG4gICAgLy8gdHlwZSBzcGVjaWZpZXMgcHJlZGVmaW5lZCBvcHRpb25zIGZvciBMYXllclxuICAgIGlmICh0eXBlIGluIE1FUkdFX09QVElPTlMpIHtcbiAgICAgICAgb3B0cyA9IE1FUkdFX09QVElPTlNbdHlwZV07XG4gICAgfVxuICAgIGNvbnN0IGxheWVyID0gbmV3IExheWVyKG9wdHMpOyAgICBcblxuICAgIC8vIHNldHVwIHNvdXJjZXMgcHJvcGVydHlcbiAgICBzcmNwcm9wLmFkZFN0YXRlKGxheWVyKTtcbiAgICBzcmNwcm9wLmFkZE1ldGhvZHMobGF5ZXIpO1xuICAgIGxheWVyLnNyY3Byb3BfcmVnaXN0ZXIoXCJzb3VyY2VzXCIpO1xuXG4gICAgbGF5ZXIuc3JjcHJvcF9jaGVjayA9IGZ1bmN0aW9uKHByb3BOYW1lLCBzb3VyY2VzKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNvdXJjZXNcIikge1xuICAgICAgICAgICAgLy8gY2hlY2sgdGhhdCBzb3VyY2VzIGlzIGFycmF5IG9mIGxheWVyc1xuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHNvdXJjZXMpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzb3VyY2VzIG11c3QgYmUgYXJyYXkgJHtzb3VyY2VzfWApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBhbGxfbGF5ZXJzID0gc291cmNlcy5tYXAoKGUpID0+IGUgaW5zdGFuY2VvZiBMYXllcikuZXZlcnkoZSA9PiBlKTtcbiAgICAgICAgICAgIGlmICghYWxsX2xheWVycykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgc291cmNlcyBtdXN0IGFsbCBiZSBsYXllcnMgJHtzb3VyY2VzfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzb3VyY2VzO1xuICAgIH1cblxuICAgIGxheWVyLnNyY3Byb3Bfb25jaGFuZ2UgPSBmdW5jdGlvbihwcm9wTmFtZSwgZUFyZykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzb3VyY2VzXCIpIHtcbiAgICAgICAgICAgIGlmIChlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIGxheWVyLmluZGV4ID0gbmV3IE5lYXJieUluZGV4TWVyZ2UobGF5ZXIuc291cmNlcylcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBsYXllci5vbmNoYW5nZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gaW5pdGlhbGlzZVxuICAgIGxheWVyLnNvdXJjZXMgPSBzb3VyY2VzO1xuXG4gICAgcmV0dXJuIGxheWVyXG59XG5cblxuXG4vKipcbiAqIENyZWF0aW5nIGEgbWVyZ2VkIE5lYXJieUluZGV4IGZvciBzZXQgb2YgTGF5ZXJzLlxuICogIFxuICogQSByZWdpb24gd2l0aGluIHRoZSBtZXJnZWQgaW5kZXggd2lsbCBjb250YWluXG4gKiBhIGxpc3Qgb2YgcmVmZXJlbmNlcyB0byAoY2FjaGUgb2JqZWN0cykgZm9yIFxuICogdGhlIExheWVycyB3aGljaCBhcmUgZGVmaW5lZCBpbiB0aGlzIHJlZ2lvbi5cbiAqIFxuICogSW1wbGVtZW50YXRpb24gaXMgc3RhdGVsZXNzLlxuICogU2V0IG9mIGxheWVycyBpcyBhc3N1bWVkIHRvIGJlIHN0YXRpYy5cbiAqL1xuXG5mdW5jdGlvbiBjbXBfYXNjZW5kaW5nKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludC5jbXAocDEsIHAyKVxufVxuXG5mdW5jdGlvbiBjbXBfZGVzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAyLCBwMSlcbn1cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4TWVyZ2UgZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Ioc291cmNlcykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9zb3VyY2VzID0gc291cmNlcztcbiAgICAgICAgdGhpcy5fY2FjaGVzID0gbmV3IE1hcChzb3VyY2VzLm1hcCgoc3JjKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3NyYywgc3JjLmNyZWF0ZUNhY2hlKCldO1xuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBvZmZzZXQgPSBlbmRwb2ludC5mcm9tX2lucHV0KG9mZnNldCk7XG4gICAgICAgIC8vIGFjY3VtdWxhdGUgbmVhcmJ5IGZyb20gYWxsIHNvdXJjZXNcbiAgICAgICAgY29uc3QgcHJldl9saXN0ID0gW10sIG5leHRfbGlzdCA9IFtdO1xuICAgICAgICBjb25zdCBjZW50ZXIgPSBbXTtcbiAgICAgICAgY29uc3QgY2VudGVyX2hpZ2hfbGlzdCA9IFtdO1xuICAgICAgICBjb25zdCBjZW50ZXJfbG93X2xpc3QgPSBbXVxuICAgICAgICBmb3IgKGxldCBzcmMgb2YgdGhpcy5fc291cmNlcykge1xuICAgICAgICAgICAgbGV0IG5lYXJieSA9IHNyYy5pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgICAgIGxldCBwcmV2X3JlZ2lvbiA9IHNyYy5pbmRleC5maW5kX3JlZ2lvbihuZWFyYnksIHtkaXJlY3Rpb246LTF9KTtcbiAgICAgICAgICAgIGxldCBuZXh0X3JlZ2lvbiA9IHNyYy5pbmRleC5maW5kX3JlZ2lvbihuZWFyYnksIHtkaXJlY3Rpb246MX0pO1xuICAgICAgICAgICAgaWYgKHByZXZfcmVnaW9uICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHByZXZfbGlzdC5wdXNoKGVuZHBvaW50LmZyb21faW50ZXJ2YWwocHJldl9yZWdpb24uaXR2KVsxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobmV4dF9yZWdpb24gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgbmV4dF9saXN0LnB1c2goZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChuZXh0X3JlZ2lvbi5pdHYpWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChuZWFyYnkuY2VudGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjZW50ZXIucHVzaCh0aGlzLl9jYWNoZXMuZ2V0KHNyYykpO1xuICAgICAgICAgICAgICAgIGxldCBbbG93LCBoaWdoXSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmVhcmJ5Lml0dik7XG4gICAgICAgICAgICAgICAgY2VudGVyX2hpZ2hfbGlzdC5wdXNoKGhpZ2gpO1xuICAgICAgICAgICAgICAgIGNlbnRlcl9sb3dfbGlzdC5wdXNoKGxvdyk7ICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBmaW5kIGNsb3Nlc3QgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0IChub3QgaW4gY2VudGVyKVxuICAgICAgICBuZXh0X2xpc3Quc29ydChjbXBfYXNjZW5kaW5nKTtcbiAgICAgICAgY29uc3QgbmV4dF9sb3cgPSBuZXh0X2xpc3RbMF0gfHwgZW5kcG9pbnQuUE9TX0lORjtcblxuICAgICAgICAvLyBmaW5kIGNsb3Nlc3QgZW5kcG9pbnQgdG8gdGhlIGxlZnQgKG5vdCBpbiBjZW50ZXIpXG4gICAgICAgIHByZXZfbGlzdC5zb3J0KGNtcF9kZXNjZW5kaW5nKTtcbiAgICAgICAgY29uc3QgcHJldl9oaWdoID0gcHJldl9saXN0WzBdIHx8IGVuZHBvaW50Lk5FR19JTkY7XG5cbiAgICAgICAgcmV0dXJuIG5lYXJieV9mcm9tKFxuICAgICAgICAgICAgICAgIHByZXZfaGlnaCwgXG4gICAgICAgICAgICAgICAgY2VudGVyX2xvd19saXN0LCBcbiAgICAgICAgICAgICAgICBjZW50ZXIsXG4gICAgICAgICAgICAgICAgY2VudGVyX2hpZ2hfbGlzdCxcbiAgICAgICAgICAgICAgICBuZXh0X2xvd1xuICAgICAgICAgICAgKTtcbiAgICB9XG59O1xuIiwiaW1wb3J0IHsgaW50ZXJ2YWwsIGVuZHBvaW50fSBmcm9tIFwiLi4vdXRpbC9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuLi9uZWFyYnlfYmFzZS5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi4vbGF5ZXJfYmFzZS5qc1wiXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBCT09MRUFOIExBWUVSXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBmdW5jdGlvbiBib29sZWFuX2xheWVyKHNyYykge1xuXG4gICAgY29uc3QgbGF5ZXIgPSBuZXcgTGF5ZXIoKTtcbiAgICBsYXllci5pbmRleCA9IG5ldyBOZWFyYnlJbmRleEJvb2xlYW4oc3JjLmluZGV4KTtcbiAgICBcbiAgICAvLyBzdWJzY3JpYmVcbiAgICBzcmMuYWRkX2NhbGxiYWNrKChlQXJnKSA9PiB7XG4gICAgICAgIGxheWVyLm9uY2hhbmdlKGVBcmcpO1xuICAgIH0pO1xuXG4gICAgLy8gaW5pdGlhbGlzZVxuICAgIGxheWVyLnNyYyA9IHNyYztcbiAgICByZXR1cm4gbGF5ZXI7XG59IFxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBCT09MRUFOIE5FQVJCWSBJTkRFWFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFdyYXBwZXIgSW5kZXggd2hlcmUgcmVnaW9ucyBhcmUgdHJ1ZS9mYWxzZSwgYmFzZWQgb24gXG4gKiBjb25kaXRpb24gb24gbmVhcmJ5LmNlbnRlci5cbiAqIEJhY2stdG8tYmFjayByZWdpb25zIHdoaWNoIGFyZSB0cnVlIGFyZSBjb2xsYXBzZWQgXG4gKiBpbnRvIG9uZSByZWdpb25cbiAqIFxuICovXG5cbmZ1bmN0aW9uIHF1ZXJ5T2JqZWN0ICh2YWx1ZSkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHF1ZXJ5OiBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgICAgICAgICByZXR1cm4ge3ZhbHVlLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgTmVhcmJ5SW5kZXhCb29sZWFuIGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKGluZGV4LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gICAgICAgIGxldCB7Y29uZGl0aW9uID0gKGNlbnRlcikgPT4gY2VudGVyLmxlbmd0aCA+IDB9ID0gb3B0aW9ucztcbiAgICAgICAgdGhpcy5fY29uZGl0aW9uID0gY29uZGl0aW9uO1xuICAgIH1cblxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgb2Zmc2V0ID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuICAgICAgICBjb25zdCBuZWFyYnkgPSB0aGlzLl9pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgXG4gICAgICAgIGxldCBldmFsdWF0aW9uID0gdGhpcy5fY29uZGl0aW9uKG5lYXJieS5jZW50ZXIpOyBcbiAgICAgICAgLyogXG4gICAgICAgICAgICBzZWVrIGxlZnQgYW5kIHJpZ2h0IGZvciBmaXJzdCByZWdpb25cbiAgICAgICAgICAgIHdoaWNoIGRvZXMgbm90IGhhdmUgdGhlIHNhbWUgZXZhbHVhdGlvbiBcbiAgICAgICAgKi9cbiAgICAgICAgY29uc3QgY29uZGl0aW9uID0gKGNlbnRlcikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2NvbmRpdGlvbihjZW50ZXIpICE9IGV2YWx1YXRpb247XG4gICAgICAgIH1cblxuICAgICAgICAvLyBleHBhbmQgcmlnaHRcbiAgICAgICAgbGV0IHJpZ2h0O1xuICAgICAgICBsZXQgcmlnaHRfbmVhcmJ5ID0gdGhpcy5faW5kZXguZmluZF9yZWdpb24obmVhcmJ5LCB7XG4gICAgICAgICAgICBkaXJlY3Rpb246MSwgY29uZGl0aW9uXG4gICAgICAgIH0pOyAgICAgICAgXG4gICAgICAgIGlmIChyaWdodF9uZWFyYnkgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByaWdodCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwocmlnaHRfbmVhcmJ5Lml0dilbMF07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBleHBhbmQgbGVmdFxuICAgICAgICBsZXQgbGVmdDtcbiAgICAgICAgbGV0IGxlZnRfbmVhcmJ5ID0gdGhpcy5faW5kZXguZmluZF9yZWdpb24obmVhcmJ5LCB7XG4gICAgICAgICAgICBkaXJlY3Rpb246LTEsIGNvbmRpdGlvblxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGxlZnRfbmVhcmJ5ICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGVmdCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobGVmdF9uZWFyYnkuaXR2KVsxXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGV4cGFuZCB0byBpbmZpbml0eVxuICAgICAgICBsZWZ0ID0gbGVmdCB8fCBlbmRwb2ludC5ORUdfSU5GO1xuICAgICAgICByaWdodCA9IHJpZ2h0IHx8IGVuZHBvaW50LlBPU19JTkY7XG4gICAgICAgIGNvbnN0IGxvdyA9IGVuZHBvaW50LmZsaXAobGVmdCk7XG4gICAgICAgIGNvbnN0IGhpZ2ggPSBlbmRwb2ludC5mbGlwKHJpZ2h0KVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXR2OiBpbnRlcnZhbC5mcm9tX2VuZHBvaW50cyhsb3csIGhpZ2gpLFxuICAgICAgICAgICAgY2VudGVyIDogW3F1ZXJ5T2JqZWN0KGV2YWx1YXRpb24pXSxcbiAgICAgICAgICAgIGxlZnQsXG4gICAgICAgICAgICByaWdodCxcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVyX2Jhc2UuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4Qm9vbGVhbiB9IGZyb20gXCIuL2Jvb2xlYW4uanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4TWVyZ2UgfSBmcm9tIFwiLi9tZXJnZS5qc1wiO1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dpY2FsX21lcmdlX2xheWVyKHNvdXJjZXMsIG9wdGlvbnM9e30pIHtcblxuICAgIGNvbnN0IHtleHByfSA9IG9wdGlvbnM7XG4gICAgbGV0IGNvbmRpdGlvbjtcbiAgICBpZiAoZXhwcikge1xuICAgICAgICBjb25kaXRpb24gPSAoY2VudGVyKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gZXhwci5ldmFsKGNlbnRlcik7XG4gICAgICAgIH0gICAgXG4gICAgfVxuXG4gICAgY29uc3QgbGF5ZXIgPSBuZXcgTGF5ZXIoKTtcbiAgICBjb25zdCBpbmRleCA9IG5ldyBOZWFyYnlJbmRleE1lcmdlKHNvdXJjZXMpO1xuICAgIGxheWVyLmluZGV4ID0gbmV3IE5lYXJieUluZGV4Qm9vbGVhbihpbmRleCwge2NvbmRpdGlvbn0pO1xuXG4gICAgLy8gc3Vic2NyaWJlIHRvIGNhbGxiYWNrcyBmcm9tIHNvdXJjZXNcbiAgICBzb3VyY2VzLm1hcCgoc3JjKSA9PiB7XG4gICAgICAgIHJldHVybiBzcmMuYWRkX2NhbGxiYWNrKGxheWVyLm9uY2hhbmdlKTtcbiAgICB9KTtcbiAgICBcbiAgICBsYXllci5zb3VyY2VzID0gc291cmNlcztcblxuICAgIHJldHVybiBsYXllcjtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gbG9naWNhbF9leHByIChzcmMpIHtcbiAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBMYXllcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBtdXN0IGJlIGxheWVyICR7c3JjfWApXG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGNhY2hlIG9mIGNlbnRlcikge1xuICAgICAgICAgICAgICAgIGlmIChjYWNoZS5zcmMgPT0gc3JjKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxubG9naWNhbF9leHByLmFuZCA9IGZ1bmN0aW9uIGFuZCguLi5leHBycykge1xuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBleHBycy5ldmVyeSgoZXhwcikgPT4gZXhwci5ldmFsKGNlbnRlcikpO1xuICAgICAgICB9ICAgIFxuICAgIH1cbn1cblxubG9naWNhbF9leHByLm9yID0gZnVuY3Rpb24gb3IoLi4uZXhwcnMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBldmFsOiBmdW5jdGlvbiAoY2VudGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwcnMuc29tZSgoZXhwcikgPT4gZXhwci5ldmFsKGNlbnRlcikpO1xuICAgICAgICB9ICAgIFxuICAgIH1cbn1cblxubG9naWNhbF9leHByLnhvciA9IGZ1bmN0aW9uIHhvcihleHByMSwgZXhwcjIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBldmFsOiBmdW5jdGlvbiAoY2VudGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwcjEuZXZhbChjZW50ZXIpICE9IGV4cHIyLmV2YWwoY2VudGVyKTtcbiAgICAgICAgfSAgICBcbiAgICB9XG59XG5cbmxvZ2ljYWxfZXhwci5ub3QgPSBmdW5jdGlvbiBub3QoZXhwcikge1xuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiAhZXhwci5ldmFsKGNlbnRlcik7XG4gICAgICAgIH0gICAgXG4gICAgfVxufVxuXG5cblxuXG4iLCJpbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuLi91dGlsL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4uL25lYXJieV9iYXNlLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcl9iYXNlLmpzXCJcbmltcG9ydCAqIGFzIHNyY3Byb3AgZnJvbSBcIi4uL3V0aWwvYXBpX3NyY3Byb3AuanNcIjtcblxuXG4vKipcbiAqIGFmZmluZSB0cmFuc2Zvcm0gMUQgYnkgc2hpZnQgYW5kIHNjYWxlIGZhY3RvclxuICovXG5cbmZ1bmN0aW9uIHRyYW5zZm9ybShwLCB7c2hpZnQ9MCwgc2NhbGU9MX0pIHtcbiAgICBpZiAocCA9PSB1bmRlZmluZWQgfHwgIWlzRmluaXRlKHApKSB7XG4gICAgICAgIC8vIHAgLSBub29wXG4gICAgICAgIHJldHVybiBwO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2YgcCA9PSBcIm51bWJlclwiKSB7XG4gICAgICAgIC8vIHAgaXMgbnVtYmVyIC0gdHJhbnNmb3JtXG4gICAgICAgIHJldHVybiAocCpzY2FsZSkgKyBzaGlmdDtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocCkgJiYgcC5sZW5ndGggPiAxKSB7XG4gICAgICAgIC8vIHAgaXMgZW5kcG9pbnQgLSB0cmFuc2Zvcm0gdmFsdWVcbiAgICAgICAgbGV0IFt2YWwsIGJyYWNrZXRdID0gcDtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW5wdXQoWyh2YWwqc2NhbGUpK3NoaWZ0LCBicmFja2V0XSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZXZlcnNlKHAsIHtzaGlmdD0wLCBzY2FsZT0xfSkge1xuICAgIGlmIChwID09IHVuZGVmaW5lZCB8fCAhaXNGaW5pdGUocCkpIHtcbiAgICAgICAgLy8gcCAtIG5vb3BcbiAgICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBwID09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgLy8gcCBpcyBudW1iZXIgLSB0cmFuc2Zvcm1cbiAgICAgICAgcmV0dXJuIChwLXNoaWZ0KS9zY2FsZTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocCkgJiYgcC5sZW5ndGggPiAxKSB7XG4gICAgICAgIC8vIHAgaXMgZW5kcG9pbnQgLSB0cmFuc2Zvcm0gdmFsdWVcbiAgICAgICAgbGV0IFt2YWwsIGJyYWNrZXRdID0gcDtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW5wdXQoWygodmFsLXNoaWZ0KS9zY2FsZSksIGJyYWNrZXRdKTtcbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE5FQVJCWSBJTkRFWCAtIEFGRklORSBUSU1FTElORSBUUkFOU0ZPUk1cbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuY2xhc3MgTmVhcmJ5SW5kZXhBVFQgZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKGxheWVyLCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIHRoaXMuX2NhY2hlID0gbGF5ZXIuY3JlYXRlQ2FjaGUoKTtcbiAgICAgICAgdGhpcy5fb3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgICAgIFxuICAgICAgICAvLyB0cmFuc2Zvcm0gY2FjaGVcbiAgICAgICAgdGhpcy5fdHJhbnNmb3JtX2NhY2hlID0ge1xuICAgICAgICAgICAgcXVlcnk6IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICAgICAgICAgICAgICAvLyByZXZlcnNlIHRyYW5zZm9ybSBxdWVyeVxuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5fY2FjaGUucXVlcnkocmV2ZXJzZShvZmZzZXQsIHRoaXMuX29wdGlvbnMpKTtcbiAgICAgICAgICAgICAgICAvLyBrZWVwIG9yaWdpbmFsIG9mZnNldCAoaW5zdGVhZCBvZiByZXZlcnNpbmcgcmVzdWx0KVxuICAgICAgICAgICAgICAgIHJldHVybiB7Li4uc3RhdGUsIG9mZnNldH07XG4gICAgICAgICAgICB9LmJpbmQodGhpcylcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIG9mZnNldCA9IGVuZHBvaW50LmZyb21faW5wdXQob2Zmc2V0KTtcbiAgICAgICAgLy8gcmV2ZXJzZSB0cmFuc2Zvcm0gcXVlcnkgb2Zmc2V0XG4gICAgICAgIGNvbnN0IG5lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShyZXZlcnNlKG9mZnNldCwgdGhpcy5fb3B0aW9ucykpO1xuICAgICAgICAvLyB0cmFuc2Zvcm0gcXVlcnkgcmVzdWx0IFxuICAgICAgICBjb25zdCBpdHYgPSBuZWFyYnkuaXR2LnNsaWNlKCk7XG4gICAgICAgIGl0dlswXSA9IHRyYW5zZm9ybShuZWFyYnkuaXR2WzBdLCB0aGlzLl9vcHRpb25zKTtcbiAgICAgICAgaXR2WzFdID0gdHJhbnNmb3JtKG5lYXJieS5pdHZbMV0sIHRoaXMuX29wdGlvbnMpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXR2LFxuICAgICAgICAgICAgbGVmdDogdHJhbnNmb3JtKG5lYXJieS5sZWZ0LCB0aGlzLl9vcHRpb25zKSxcbiAgICAgICAgICAgIHJpZ2h0OiB0cmFuc2Zvcm0obmVhcmJ5LnJpZ2h0LCB0aGlzLl9vcHRpb25zKSxcbiAgICAgICAgICAgIGNlbnRlcjogbmVhcmJ5LmNlbnRlci5tYXAoKCkgPT4gdGhpcy5fdHJhbnNmb3JtX2NhY2hlKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBUSU1FTElORSBUUkFOU0ZPUk0gTEFZRVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBTaGlmdGluZyBhbmQgc2NhbGluZyB0aGUgdGltZWxpbmUgb2YgYSBsYXllclxuICogXG4gKiBvcHRpb25zOlxuICogLSBzaGlmdDogYSB2YWx1ZSBvZiAyIGVmZmVjdGl2ZWx5IG1lYW5zIHRoYXQgbGF5ZXIgY29udGVudHMgXG4gKiAgIGFyZSBzaGlmdGVkIHRvIHRoZSByaWdodCBvbiB0aGUgdGltZWxpbmUsIGJ5IDIgdW5pdHNcbiAqIC0gc2NhbGU6IGEgdmFsdWUgb2YgMiBtZWFucyB0aGF0IHRoZSBsYXllciBpcyBzdHJldGNoZWRcbiAqICAgYnkgYSBmYWN0b3Igb2YgMlxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiB0aW1lbGluZV90cmFuc2Zvcm0gKHNyYywgb3B0aW9ucz17fSkge1xuXG4gICAgY29uc3QgbGF5ZXIgPSBuZXcgTGF5ZXIoKTtcblxuICAgIC8vIHNldHVwIHNyYyBwcm9wZXJ0eVxuICAgIHNyY3Byb3AuYWRkU3RhdGUobGF5ZXIpO1xuICAgIHNyY3Byb3AuYWRkTWV0aG9kcyhsYXllcik7XG4gICAgbGF5ZXIuc3JjcHJvcF9yZWdpc3RlcihcInNyY1wiKTtcbiAgICAgICAgXG4gICAgbGF5ZXIuc3JjcHJvcF9jaGVjayA9IGZ1bmN0aW9uKHByb3BOYW1lLCBzcmMpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIExheWVyICR7c3JjfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNyYzsgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsYXllci5zcmNwcm9wX29uY2hhbmdlID0gZnVuY3Rpb24ocHJvcE5hbWUsIGVBcmcpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmIChlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXggPSBuZXcgTmVhcmJ5SW5kZXhBVFQodGhpcy5zcmMsIG9wdGlvbnMpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgbGF5ZXIub25jaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGluaXRpYWxpc2VcbiAgICBsYXllci5zcmMgPSBzcmM7XG4gICAgXG4gICAgcmV0dXJuIGxheWVyO1xufVxuXG4iLCJpbXBvcnQgeyBDdXJzb3IgfSBmcm9tIFwiLi4vY3Vyc29yX2Jhc2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVyX2Jhc2UuanNcIlxuaW1wb3J0IHsgTmVhcmJ5SW5kZXhTcmMgfSBmcm9tIFwiLi4vbmVhcmJ5X2Jhc2UuanNcIlxuaW1wb3J0IHsgaXNfY2xvY2tfY3Vyc29yIH0gZnJvbSBcIi4uL2N1cnNvcl9jbG9jay5qc1wiO1xuXG5cbmZ1bmN0aW9uIHRvU3RhdGUoc3RhdGUsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7dmFsdWVGdW5jLCBzdGF0ZUZ1bmN9ID0gb3B0aW9ucztcbiAgICBpZiAodmFsdWVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBzdGF0ZS52YWx1ZSA9IHZhbHVlRnVuYyhzdGF0ZS52YWx1ZSk7XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9IGVsc2UgaWYgKHN0YXRlRnVuYyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlRnVuYyhzdGF0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDdXJzb3IgVHJhbnNmb3JtXG4gKiBDcmVhdGUgYSBuZXcgQ3Vyc29yIHdoaWNoIGlzIGEgdHJhbnNmb3JtYXRpb24gb2YgdGhlIHNyYyBDdXJzb3JcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGN1cnNvcl90cmFuc2Zvcm0oc3JjLCBvcHRpb25zPXt9KSB7XG5cbiAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBDdXJzb3IpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgc3JjIG11c3QgYmUgYSBDdXJzb3IgJHtzcmN9YCk7XG4gICAgfVxuXG4gICAgY29uc3QgY3Vyc29yID0gbmV3IEN1cnNvcigpO1xuXG4gICAgLy8gaW1wbGVtZW50IHF1ZXJ5XG4gICAgY3Vyc29yLnF1ZXJ5ID0gZnVuY3Rpb24gcXVlcnkoKSB7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3JjLnF1ZXJ5KCk7XG4gICAgICAgIHJldHVybiB0b1N0YXRlKHN0YXRlLCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICAvLyBhZG9wdCB0aGUgY3RybCBvZiB0aGUgc3JjLWN1cnNvclxuICAgIGlmICghaXNfY2xvY2tfY3Vyc29yKHNyYykpIHtcbiAgICAgICAgY3Vyc29yLmN0cmwgPSBzcmMuY3RybDtcbiAgICAgICAgLy8gYWRkIGNhbGxiYWNrc1xuICAgICAgICBjdXJzb3IuY3RybC5hZGRfY2FsbGJhY2soKCkgPT4ge2N1cnNvci5vbmNoYW5nZSgpfSk7XG4gICAgfVxuXG4gICAgLyogXG4gICAgICAgIEN1cnJlbnQgZGVmaW5pdGlvbiBvZiBDdXJzb3Igc3JjIHByb3BlcnR5IGlzIHRoYXQgaXQgaXMgYSBsYXllciBvciB1bmRlZmluZWQuXG4gICAgICAgIFRoaXMgbGVhdmVzIGN1cnNvciB0cmFuc2Zvcm0gb3B0aW9ucy5cbiAgICAgICAgMSkgd3JhcCBzcmMgY3Vyc29yIGFzIGEgbGF5ZXIsXG4gICAgICAgIDIpIGxldCBzcmMgcHJvcGVydHkgYmUgdW5kZWZpbmVkXG4gICAgICAgIDMpIGFkb3B0IHRoZSBzcmMgcHJvcGVydHkgb2YgdGhlIHNyYyBjdXJzb3IgYXMgaXRzIG93biBzcmNcblxuICAgICAgICBXZSBnbyBmb3IgMylcbiAgICAqL1xuXG4gICAgLy8gYWRvcHQgdGhlIHNyYyBvZiB0aGUgc3JjLWN1cnNvciBhcyBzcmNcbiAgICBpZiAoIWlzX2Nsb2NrX2N1cnNvcihzcmMpKSB7XG4gICAgICAgIGN1cnNvci5zcmMgPSBzcmMuc3JjO1xuICAgIH1cblxuICAgIC8vIGNhbGxiYWNrcyBmcm9tIHNyYy1jdXJzb3JcbiAgICBzcmMuYWRkX2NhbGxiYWNrKCgpID0+IHtjdXJzb3Iub25jaGFuZ2UoKX0pO1xuICAgIHJldHVybiBjdXJzb3I7XG59XG5cblxuLyoqXG4gKiBMYXllciBUcmFuc2Zvcm1cbiAqIENyZWF0ZSBhIG5ldyBMYXllciB3aGljaCBpcyBhIHRyYW5zZm9ybWF0aW9uIG9mIHRoZSBzcmMgTGF5ZXJcbiAqL1xuXG5mdW5jdGlvbiB3cmFwcGVkVmFsdWVGdW5jKHZhbHVlRnVuYykge1xuICAgIHJldHVybiBmdW5jdGlvbiAoe3NvdXJjZXMsIHN0YXRlcywgb2Zmc2V0fSkge1xuICAgICAgICByZXR1cm4gdmFsdWVGdW5jKHN0YXRlc1swXS52YWx1ZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB3cmFwcGVkU3RhdGVGdW5jKHN0YXRlRnVuYykge1xuICAgIHJldHVybiBmdW5jdGlvbiAoe3NvdXJjZXMsIHN0YXRlcywgb2Zmc2V0fSkge1xuICAgICAgICByZXR1cm4gc3RhdGVGdW5jKHN0YXRlc1swXSk7XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbGF5ZXJfdHJhbnNmb3JtKHNyYywgb3B0aW9ucz17fSkge1xuXG4gICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgTGF5ZXIpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgc3JjIG11c3QgYmUgYSBMYXllciAke3NyY31gKTtcbiAgICB9XG5cbiAgICBjb25zdCBvcHMgPSB7fTtcbiAgICBvcHMudmFsdWVGdW5jID0gd3JhcHBlZFZhbHVlRnVuYyhvcHRpb25zLnZhbHVlRnVuYyk7XG4gICAgb3BzLnN0YXRlRnVuYyA9IHdyYXBwZWRTdGF0ZUZ1bmMob3B0aW9ucy5zdGF0ZUZ1bmMpO1xuXG4gICAgY29uc3QgbGF5ZXIgPSBuZXcgTGF5ZXIob3BzKTtcbiAgICBsYXllci5pbmRleCA9IG5ldyBOZWFyYnlJbmRleFNyYyhzcmMpO1xuICAgIGxheWVyLnNyYyA9IHNyYztcbiAgICBsYXllci5zcmMuYWRkX2NhbGxiYWNrKChlQXJnKSA9PiB7bGF5ZXIub25jaGFuZ2UoZUFyZyl9KTtcbiAgICByZXR1cm4gbGF5ZXI7XG59XG5cblxuXG4iLCJpbXBvcnQgeyBDdXJzb3IgfSBmcm9tIFwiLi4vY3Vyc29yX2Jhc2UuanNcIjtcbmltcG9ydCB7IGlzX2Nsb2NrX2N1cnNvciB9IGZyb20gXCIuLi9jdXJzb3JfY2xvY2suanNcIjtcbmltcG9ydCB7IGlzX2l0ZW1zX2xheWVyIH0gZnJvbSBcIi4uL2xheWVyX2l0ZW1zLmpzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWNvcmRfbGF5ZXIoY3RybCwgc3JjLCBkc3QpIHtcblxuICAgIC8vIGN0cmwgbXVzdCBiZSBjbG9jayBjdXJzb3Igb3IgbWVkaWEgY3Vyc29yXG4gICAgaWYgKFxuICAgICAgICAhaXNfY2xvY2tfY3Vyc29yKGN0cmwpICYmXG4gICAgICAgICFpc19jbG9ja19jdXJzb3IoY3RybC5jdHJsKVxuICAgICl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgY3RybCBvciBjdHJsLmN0cmwgbXVzdCBiZSBhIGNsb2NrIGN1cnNvciAke2N0cmx9YCk7XG4gICAgfSAgICBcblxuICAgIC8vIHNyYyBtdXN0IGJlIGN1cnNvciB3aXRoIGEgc2VnbWVudHMgbGF5ZXIgYXMgc3JjXG4gICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgQ3Vyc29yKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNyYyBtdXN0IGJlIGEgY3Vyc29yICR7c3JjfWApO1xuICAgIH1cbiAgICBpZiAoIWlzX2l0ZW1zX2xheWVyKHNyYy5zcmMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgY3Vyc29yIHNyYyBtdXN0IGJlIGEgc2VnbWVudCBsYXllciAke3NyYy5zcmN9YCk7XG4gICAgfVxuXG4gICAgLy8gZHN0IG11c3QgYmUgc2VnbWVudHMgbGF5ZXJcbiAgICBpZiAoIWlzX2l0ZW1zX2xheWVyKGRzdCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBkc3QgbXVzdCBiZSBhIHNlZ21lbnQgbGF5ZXIgJHtkc3R9YCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVjb3JkIHN0YXRlUHJvdmlkZXIgb2YgY3Vyc29yIChzcmMpXG4gICAgICovXG4gICAgc3JjLnNyYy5zcmMuYWRkX2NhbGxiYWNrKG9uX3NyY19jaGFuZ2UpO1xuXG4gICAgZnVuY3Rpb24gb25fc3JjX2NoYW5nZSAoKSB7XG4gICAgICAgIC8vIHJlY29yZCB0aW1lc3RhbXBcbiAgICAgICAgY29uc3QgdHMgPSBjdHJsLnZhbHVlO1xuICAgICAgICAvLyBnZXQgY3VycmVudCBpdGVtcyBmcm9tIHN0YXRlUHJvdmlkZXJcbiAgICAgICAgY29uc3QgaXRlbXMgPSBzcmMuc3JjLnNyYy5nZXQoKTtcbiAgICAgICAgLy8gYXBwZW5kIGl0ZW1zIHRvIGRzdFxuICAgICAgICBkc3QuYXBwZW5kKGl0ZW1zLCB0cyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVE9ETyBcbiAgICAgKiAtIGNsb2NrIHNob3VsZCBiZSB1c2VkIGFzIGEgcmVjb3JkIGNsb2NrLCBpbXBseWluZyB0aGF0XG4gICAgICogICBpdGVtcyBzaG91bGQgYmUgcmVjb2RlZCBhY2NvcmRpbmcgdG8gdGhpcyBjbG9jaz9cbiAgICAgKiAtIHRoaXMgaW1wbGllcyBzZW5zaXRpdml0eSB0byBhIGRpZmZlcmVuY2UgYmV0d2VlbiBcbiAgICAgKiAgIGN1cnNvciBjbG9jayBhbmQgcmVjb3JkIGNsb2NrIFxuICAgICAqL1xuXG5cbiAgICByZXR1cm4gZHN0O1xufSIsImltcG9ydCB7ZW5kcG9pbnR9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG4vKlxuICAgIFN0YXRlIFByb3ZpZGVyIFZpZXdlclxuKi9cblxuZnVuY3Rpb24gaXRlbTJzdHJpbmcoaXRlbSwgb3B0aW9ucykge1xuICAgIC8vIHR4dFxuICAgIGNvbnN0IGlkX3R4dCA9IGl0ZW0uaWQ7XG4gICAgY29uc3QgdHlwZV90eHQgPSBpdGVtLnR5cGU7XG4gICAgbGV0IGl0dl90eHQgPSBcIlwiO1xuICAgIGlmIChpdGVtLml0diAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdID0gaXRlbS5pdHY7XG4gICAgICAgIGNvbnN0IGxvd190eHQgPSAobG93ID09IG51bGwpID8gXCJudWxsXCIgOiBsb3cudG9GaXhlZCgyKTtcbiAgICAgICAgY29uc3QgaGlnaF90eHQgPSAoaGlnaCA9PSBudWxsKSA/IFwibnVsbFwiIDogaGlnaC50b0ZpeGVkKDIpO1xuICAgICAgICBpdHZfdHh0ID0gYFske2xvd190eHR9LCR7aGlnaF90eHR9LCR7bG93SW5jbHVkZX0sJHtoaWdoSW5jbHVkZX1dYDsgXG4gICAgfVxuICAgIGxldCBkYXRhX3R4dCA9IEpTT04uc3RyaW5naWZ5KGl0ZW0uZGF0YSk7XG5cbiAgICAvLyBodG1sXG4gICAgbGV0IGlkX2h0bWwgPSBgPHNwYW4gY2xhc3M9XCJpdGVtLWlkXCI+JHtpZF90eHR9PC9zcGFuPmA7XG4gICAgbGV0IGl0dl9odG1sID0gYDxzcGFuIGNsYXNzPVwiaXRlbS1pdHZcIj4ke2l0dl90eHR9PC9zcGFuPmA7XG4gICAgbGV0IHR5cGVfaHRtbCA9IGA8c3BhbiBjbGFzcz1cIml0ZW0tdHlwZVwiPiR7dHlwZV90eHR9PC9zcGFuPmBcbiAgICBsZXQgZGF0YV9odG1sID0gYDxzcGFuIGNsYXNzPVwiaXRlbS1kYXRhXCI+JHtkYXRhX3R4dH08L3NwYW4+YDtcbiAgICBcbiAgICAvLyBkZWxldGUgQnV0dG9uXG4gICAgY29uc3Qge2RlbGV0ZV9hbGxvd2VkPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgaWYgKGRlbGV0ZV9hbGxvd2VkKSB7XG4gICAgICAgIHJldHVybiBgXG4gICAgICAgIDxkaXY+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPVwiZGVsZXRlXCI+WDwvYnV0dG9uPlxuICAgICAgICAgICAgJHtpZF9odG1sfTogJHt0eXBlX2h0bWx9ICR7aXR2X2h0bWx9ICR7ZGF0YV9odG1sfVxuICAgICAgICA8L2Rpdj5gO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBgXG4gICAgICAgIDxkaXY+XG4gICAgICAgICAgICAke2lkX2h0bWx9OiAke3R5cGVfaHRtbH0gJHtpdHZfaHRtbH0gJHtkYXRhX2h0bWx9XG4gICAgICAgIDwvZGl2PmA7ICAgICAgICBcbiAgICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFN0YXRlUHJvdmlkZXJWaWV3ZXIge1xuXG4gICAgY29uc3RydWN0b3Ioc3RhdGVQcm92aWRlciwgZWxlbSwgb3B0aW9ucz17fSkge1xuICAgICAgICB0aGlzLl9zcCA9IHN0YXRlUHJvdmlkZXI7XG4gICAgICAgIHRoaXMuX2VsZW0gPSBlbGVtO1xuICAgICAgICB0aGlzLl9oYW5kbGUgPSB0aGlzLl9zcC5hZGRfY2FsbGJhY2sodGhpcy5fb25jaGFuZ2UuYmluZCh0aGlzKSk7IFxuXG4gICAgICAgIC8vIG9wdGlvbnNcbiAgICAgICAgbGV0IGRlZmF1bHRzID0ge1xuICAgICAgICAgICAgdG9TdHJpbmc6aXRlbTJzdHJpbmdcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fb3B0aW9ucyA9IHsuLi5kZWZhdWx0cywgLi4ub3B0aW9uc307XG5cbiAgICAgICAgLypcbiAgICAgICAgICAgIFN1cHBvcnQgZGVsZXRlXG4gICAgICAgICovXG4gICAgICAgIGlmICh0aGlzLl9vcHRpb25zLmRlbGV0ZV9hbGxvd2VkKSB7XG4gICAgICAgICAgICAvLyBsaXN0ZW4gZm9yIGNsaWNrIGV2ZW50cyBvbiByb290IGVsZW1lbnRcbiAgICAgICAgICAgIGVsZW0uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gY2F0Y2ggY2xpY2sgZXZlbnQgZnJvbSBkZWxldGUgYnV0dG9uXG4gICAgICAgICAgICAgICAgY29uc3QgZGVsZXRlQnRuID0gZS50YXJnZXQuY2xvc2VzdChcIiNkZWxldGVcIik7XG4gICAgICAgICAgICAgICAgaWYgKGRlbGV0ZUJ0bikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaXN0SXRlbSA9IGRlbGV0ZUJ0bi5jbG9zZXN0KFwiLmxpc3QtaXRlbVwiKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpc3RJdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zcC51cGRhdGUoe3JlbW92ZTpbbGlzdEl0ZW0uaWRdfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKlxuICAgICAgICAgICAgcmVuZGVyIGluaXRpYWwgc3RhdGVcbiAgICAgICAgKi8gXG4gICAgICAgIHRoaXMuX29uY2hhbmdlKCk7XG4gICAgfVxuXG4gICAgX29uY2hhbmdlKCkge1xuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuX3NwLmdldCgpO1xuXG4gICAgICAgIC8vIHNvcnQgYnkgbG93IGVuZHBvaW50XG4gICAgICAgIGl0ZW1zLnNvcnQoKGl0ZW1fYSwgaXRlbV9iKSA9PiB7XG4gICAgICAgICAgICBsZXQgbG93RXBfYSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbV9hLml0dilbMF07XG4gICAgICAgICAgICBsZXQgbG93RXBfYiA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbV9iLml0dilbMF07XG4gICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuY21wKGxvd0VwX2EsIGxvd0VwX2IpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBjbGVhclxuICAgICAgICB0aGlzLl9lbGVtLnJlcGxhY2VDaGlsZHJlbigpO1xuICAgICAgICAvLyByZWJ1aWxkXG4gICAgICAgIGNvbnN0IHt0b1N0cmluZ30gPSB0aGlzLl9vcHRpb25zO1xuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICAgICAgICAvLyBhZGRcbiAgICAgICAgICAgIGxldCBub2RlID0gdGhpcy5fZWxlbS5xdWVyeVNlbGVjdG9yKGAjJHtpdGVtLmlkfWApO1xuICAgICAgICAgICAgaWYgKG5vZGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICAgICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKFwiaWRcIiwgaXRlbS5pZCk7XG4gICAgICAgICAgICAgICAgbm9kZS5jbGFzc0xpc3QuYWRkKFwibGlzdC1pdGVtXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2VsZW0uYXBwZW5kQ2hpbGQobm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBub2RlLmlubmVySFRNTCA9IHRvU3RyaW5nKGl0ZW0sIHRoaXMuX29wdGlvbnMpO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiLy8gY2xhc3Nlc1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4vbmVhcmJ5X2Jhc2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4vbGF5ZXJfYmFzZS5qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4vY3Vyc29yX2Jhc2UuanNcIjtcblxuLy8gc3RhdGVQcm92aWRlcnNcbmltcG9ydCB7IFxuICAgIGlzX2Nsb2NrX3Byb3ZpZGVyLCBcbiAgICBMT0NBTF9DTE9DS19QUk9WSURFUlxufSBmcm9tIFwiLi9wcm92aWRlcl9jbG9jay5qc1wiO1xuaW1wb3J0IHsgQ29sbGVjdGlvblByb3ZpZGVyIH0gZnJvbSBcIi4vcHJvdmlkZXJfY29sbGVjdGlvbi5qc1wiO1xuaW1wb3J0IHsgVmFyaWFibGVQcm92aWRlciB9IGZyb20gXCIuL3Byb3ZpZGVyX3ZhcmlhYmxlLmpzXCI7XG5cbi8vIGZhY3RvcnkgZnVuY3Rpb25zXG5pbXBvcnQgeyBpdGVtc19sYXllciB9IGZyb20gXCIuL2xheWVyX2l0ZW1zLmpzXCI7XG5pbXBvcnQgeyBjbG9ja19jdXJzb3IsIGlzX2Nsb2NrX2N1cnNvciB9IGZyb20gXCIuL2N1cnNvcl9jbG9jay5qc1wiXG5pbXBvcnQgeyB2YXJpYWJsZV9jdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3JfdmFyaWFibGUuanNcIjtcbmltcG9ydCB7IHBsYXliYWNrX2N1cnNvciB9IGZyb20gXCIuL2N1cnNvcl9wbGF5YmFjay5qc1wiO1xuaW1wb3J0IHsgbGF5ZXJfZnJvbV9jdXJzb3IgfSBmcm9tIFwiLi9vcHMvbGF5ZXJfZnJvbV9jdXJzb3IuanNcIjtcbmltcG9ydCB7IG1lcmdlX2xheWVyIH0gZnJvbSBcIi4vb3BzL21lcmdlLmpzXCI7XG5pbXBvcnQgeyBib29sZWFuX2xheWVyIH0gZnJvbSBcIi4vb3BzL2Jvb2xlYW4uanNcIlxuaW1wb3J0IHsgbG9naWNhbF9tZXJnZV9sYXllciwgbG9naWNhbF9leHByfSBmcm9tIFwiLi9vcHMvbG9naWNhbF9tZXJnZS5qc1wiO1xuaW1wb3J0IHsgdGltZWxpbmVfdHJhbnNmb3JtIH0gZnJvbSBcIi4vb3BzL3RpbWVsaW5lX3RyYW5zZm9ybS5qc1wiO1xuaW1wb3J0IHsgY3Vyc29yX3RyYW5zZm9ybSwgbGF5ZXJfdHJhbnNmb3JtIH0gZnJvbSBcIi4vb3BzL3RyYW5zZm9ybS5qc1wiO1xuaW1wb3J0IHsgcmVjb3JkX2xheWVyIH0gZnJvbSBcIi4vb3BzL3JlY29yZC5qc1wiO1xuXG5cblxuLy8gdXRpbFxuaW1wb3J0IHsgbG9jYWxfY2xvY2sgfSBmcm9tIFwiLi91dGlsL2NvbW1vbi5qc1wiO1xuaW1wb3J0IHsgU3RhdGVQcm92aWRlclZpZXdlciB9IGZyb20gXCIuL3V0aWwvcHJvdmlkZXJfdmlld2VyLmpzXCI7XG5cbmZ1bmN0aW9uIHZpZXdlcihzdGF0ZVByb3ZpZGVyLCBlbGVtLCBvcHRpb25zPXt9KSB7XG4gICAgLy8gY3JlYXRlIGEgbmV3IHZpZXdlclxuICAgIHJldHVybiBuZXcgU3RhdGVQcm92aWRlclZpZXdlcihzdGF0ZVByb3ZpZGVyLCBlbGVtLCBvcHRpb25zKTtcbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExBWUVSIEZBQ1RPUklFU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5mdW5jdGlvbiBsYXllcihvcHRpb25zPXt9KSB7XG4gICAgbGV0IHtzcmMsIGluc2VydCwgdmFsdWUsIC4uLm9wdHN9ID0gb3B0aW9ucztcbiAgICBpZiAoc3JjIGluc3RhbmNlb2YgTGF5ZXIpIHtcbiAgICAgICAgcmV0dXJuIHNyYztcbiAgICB9XG4gICAgaWYgKHNyYyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3JjID0gbmV3IFZhcmlhYmxlUHJvdmlkZXIoe3ZhbHVlfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzcmMgPSBuZXcgQ29sbGVjdGlvblByb3ZpZGVyKHtpbnNlcnR9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaXRlbXNfbGF5ZXIoe3NyYywgLi4ub3B0c30pOyBcbn1cblxuZnVuY3Rpb24gcmVjb3JkIChvcHRpb25zPXt9KSB7XG4gICAgbGV0IHtjdHJsLCBzcmMsIGRzdCwgLi4ub3BzfSA9IG9wdGlvbnM7XG4gICAgY3RybCA9IGN1cnNvcihjdHJsKTtcbiAgICBzcmMgPSBjdXJzb3Ioc3JjKTtcbiAgICBkc3QgPSBsYXllcih7ZHN0OnNyYywgLi4ub3BzfSk7XG4gICAgcmVjb3JkX2xheWVyKGN0cmwsIHNyYywgZHN0KTtcbiAgICByZXR1cm4gZHN0O1xufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBDVVJTT1IgRkFDVE9SSUVTXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuZnVuY3Rpb24gY3Vyc29yIChzcmM9TE9DQUxfQ0xPQ0tfUFJPVklERVIpIHtcbiAgICBpZiAoc3JjIGluc3RhbmNlb2YgQ3Vyc29yKSB7XG4gICAgICAgIHJldHVybiBzcmM7XG4gICAgfVxuICAgIGlmIChpc19jbG9ja19jdXJzb3Ioc3JjKSkge1xuICAgICAgICByZXR1cm4gc3JjO1xuICAgIH1cbiAgICBpZiAoaXNfY2xvY2tfcHJvdmlkZXIoc3JjKSkge1xuICAgICAgICByZXR1cm4gY2xvY2tfY3Vyc29yKHNyYyk7XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihgc3JjIG11c3QgYmUgY3Vyc29yLCBjbG9ja1Byb3ZpZGVyIG9yIHVuZGVmaW5lZCAke3NyY31gKTtcbn1cblxuZnVuY3Rpb24gY2xvY2sgKHNyYykge1xuICAgIHJldHVybiBjdXJzb3Ioc3JjKTtcbn1cblxuZnVuY3Rpb24gdmFyaWFibGUob3B0aW9ucz17fSkge1xuICAgIGxldCB7Y3RybCwgLi4ub3B0c30gPSBvcHRpb25zO1xuICAgIGN0cmwgPSBjdXJzb3IoY3RybCk7XG4gICAgY29uc3Qgc3JjID0gbGF5ZXIob3B0cyk7XG4gICAgcmV0dXJuIHZhcmlhYmxlX2N1cnNvcihjdHJsLCBzcmMpO1xufVxuXG5mdW5jdGlvbiBwbGF5YmFjayhvcHRpb25zPXt9KSB7XG4gICAgbGV0IHtjdHJsLCAuLi5vcHRzfSA9IG9wdGlvbnM7XG4gICAgY3RybCA9IGN1cnNvcihjdHJsKTtcbiAgICBjb25zdCBzcmMgPSBsYXllcihvcHRzKTtcbiAgICByZXR1cm4gcGxheWJhY2tfY3Vyc29yKGN0cmwsIHNyYyk7XG59XG5cbmZ1bmN0aW9uIHNrZXcgKHNyYywgb2Zmc2V0KSB7XG4gICAgc3JjID0gY3Vyc29yKHNyYyk7XG4gICAgZnVuY3Rpb24gdmFsdWVGdW5jKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSArIG9mZnNldDtcbiAgICB9IFxuICAgIHJldHVybiBjdXJzb3JfdHJhbnNmb3JtKHNyYywge3ZhbHVlRnVuY30pO1xufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBFWFBPUlRTXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCB7XG4gICAgTGF5ZXIsIEN1cnNvciwgTmVhcmJ5SW5kZXhCYXNlLFxuICAgIGxheWVyLCBcbiAgICBtZXJnZV9sYXllciBhcyBtZXJnZSwgXG4gICAgYm9vbGVhbl9sYXllciBhcyBib29sZWFuLFxuICAgIGxvZ2ljYWxfbWVyZ2VfbGF5ZXIgYXMgbG9naWNhbF9tZXJnZSwgXG4gICAgbG9naWNhbF9leHByLFxuICAgIGNsb2NrLFxuICAgIHZhcmlhYmxlLFxuICAgIHBsYXliYWNrLFxuICAgIGxheWVyX2Zyb21fY3Vyc29yLFxuICAgIGxheWVyX3RyYW5zZm9ybSxcbiAgICBjdXJzb3JfdHJhbnNmb3JtLFxuICAgIHRpbWVsaW5lX3RyYW5zZm9ybSxcbiAgICByZWNvcmQsXG4gICAgc2tldyxcbiAgICB2aWV3ZXIsXG4gICAgbG9jYWxfY2xvY2tcbn0iXSwibmFtZXMiOlsiY21wX2FzY2VuZGluZyIsImNtcF9kZXNjZW5kaW5nIiwiUFJFRklYIiwiYWRkU3RhdGUiLCJhZGRNZXRob2RzIiwidG9TdGF0ZSIsImNhbGxiYWNrLmFkZFN0YXRlIiwiZXZlbnRpZnkuYWRkU3RhdGUiLCJjYWxsYmFjay5hZGRNZXRob2RzIiwiZXZlbnRpZnkuYWRkTWV0aG9kcyIsImNhbGxiYWNrLmlzX2NhbGxiYWNrX2FwaSIsInNyY3Byb3AuYWRkU3RhdGUiLCJzcmNwcm9wLmFkZE1ldGhvZHMiXSwibWFwcGluZ3Mi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QUcsQ0FBQyxFQUFFO0lBQzNCO0lBQ0EsWUFBWSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7SUFDeEMsU0FBUyxNQUFNO0lBQ2YsWUFBWSxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQztJQUN0RTtJQUNBLEtBQ0E7SUFDQSxJQUFJLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDekIsUUFBUSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7SUFDMUMsS0FBSyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDaEMsUUFBUSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUM7SUFDM0MsS0FBSyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDaEMsUUFBUSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUM7SUFDN0MsS0FBSyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7SUFDL0IsUUFBUSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUM7SUFDQSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUMsR0FBRyxHQUFHO0lBQ2xEO0lBQ0EsSUFB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LFlBQVksT0FBTyxTQUFTO0lBQzVCLFNBQ0E7SUFDQTtJQUNBLElBQUksSUFBSSxFQUFFLEtBQUssR0FBRyxFQUFFLE9BQU8sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQztJQUM1QztJQUNBLElBQUksSUFBSSx5QkFBeUIsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEtBQUssS0FBSyxFQUFFLE9BQU8sRUFBRTtJQUNsRTtJQUNBLElBQUksSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ3BELElBQUksSUFBSSxZQUFZLEtBQUssR0FBRyxFQUFFO0lBQzlCLFFBQVEsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ3pCO0lBQ0EsSUFBSSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZELElBQUksSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEdBQUcsSUFBSSxFQUFFLEVBQUU7SUFDakMsSUFBSSxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxJQUFJLEVBQUUsRUFBRTtJQUNqQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUM1QztJQUVBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQSxTQUFT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QUNsQyxFQUFFLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUMsRUFBRTtJQUNsQyxHQUFHLE9BQU8sRUFBRTtJQUNaLEdBQUcsTUFBTTtJQUNULEdBQUcsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUMzQztJQUNBOztJQUVBLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFO0lBQ2IsRUFBRSxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNsRDtJQUNBLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFO0lBQ2IsRUFBRSxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNsRDtJQUNBLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFO0lBQ2QsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO0lBQ3pDLEVBQUUsSUFBSSxLQUFLLEVBQUU7SUFDYixHQUFHLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUM7SUFDMUIsR0FBRztJQUNIO0lBQ0EsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUU7SUFDYixFQUFFLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2xEO0lBQ0EsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUU7SUFDYixFQUFFLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2xEO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRUEsU0FBUyxlQUFlLENBQUMsU0FBUyxFQUFFLFVBQVUsRUFBRTtJQUNoRCxDQUFDLE1BQU0sZ0JBQWdCLEdBQUcsU0FBUyxDQUFDLE1BQU07SUFDMUMsQ0FBQyxNQUFNLGlCQUFpQixHQUFHLFVBQVUsQ0FBQyxNQUFNO0lBQzVDLEdBQUcsU0FBUyxDQUFDLE1BQU0sSUFBSSxpQkFBaUI7SUFDeEMsR0FBRyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsaUJBQWlCLEVBQUUsQ0FBQyxFQUFFLEVBQUU7SUFDL0MsS0FBSyxTQUFTLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUNwRDtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBLFNBQVMsaUJBQWlCLENBQUMsVUFBVSxFQUFFO0lBQ3ZDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUNWLENBQUMsT0FBTyxJQUFJLEVBQUU7SUFDZCxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxVQUFVLENBQUMsTUFBTSxFQUFFO0lBQ2xDLEdBQUc7SUFDSDtJQUNBLEVBQUUsSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7SUFDckQsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzlCLEdBQUcsTUFBTTtJQUNULEdBQUcsQ0FBQyxJQUFJLENBQUM7SUFDVDtJQUNBO0lBQ0E7O0lDM1BBLE1BQU0sQ0FBQyxVQUFVLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxTQUFTLENBQUMsR0FBRyxRQUFRLENBQUMsS0FBSztJQUNyRSxNQUFNLFFBQVEsR0FBRyxDQUFDLFVBQVUsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLFNBQVMsQ0FBQzs7O0lBRy9EO0lBQ0EsTUFBTSxXQUFXLENBQUM7SUFDbEIsQ0FBQyxXQUFXLEdBQUc7SUFDZixFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDdEIsR0FBRyxDQUFDLFVBQVUsRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQzFCLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUN4QixHQUFHLENBQUMsV0FBVyxFQUFFLElBQUksR0FBRyxFQUFFLENBQUM7SUFDM0IsR0FBRyxDQUFDLFNBQVMsRUFBRSxJQUFJLEdBQUcsRUFBRTtJQUN4QixHQUFHLENBQUM7SUFDSjtJQUNBLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRTtJQUNULEVBQUUsTUFBTSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO0lBQzFCLEVBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO0lBQ3ZDO0lBQ0EsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUU7SUFDVixFQUFFLE1BQU0sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtJQUMxQixFQUFFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQztJQUN2QztJQUNBLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRTtJQUNULEVBQUUsTUFBTSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO0lBQzFCLEVBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO0lBQ3ZDOztJQUVBLENBQUMsSUFBSSxHQUFHO0lBQ1IsRUFBRSxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLO0lBQ3ZDLEdBQUcsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFO0lBQzFDLEtBQUssR0FB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LE9BQU87SUFDWCxRQUFRLElBQUksRUFBRSxVQUFVLE1BQU0sRUFBRTtJQUNoQyxZQUFZLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzNELFNBQVM7SUFDVDtJQUNBOztJQUVBLFlBQVksQ0FBQyxFQUFFLEdBQUcsU0FBUyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUU7SUFDeEMsSUFBSSxPQUFPO0lBQ1gsUUFBUSxJQUFJLEVBQUUsVUFBVSxNQUFNLEVBQUU7SUFDaEMsWUFBWSxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMxRCxTQUFTO0lBQ1Q7SUFDQTs7SUFFQSxZQUFZLENBQUMsR0FBRyxHQUFHLFNBQVMsR0FBRyxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUU7SUFDOUMsSUFBSSxPQUFPO0lBQ1gsUUFBUSxJQUFJLEVBQUUsVUFBVSxNQUFNLEVBQUU7SUFDaEMsWUFBWSxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDM0QsU0FBUztJQUNUO0lBQ0E7O0lBRUEsWUFBWSxDQUFDLEdBQUcsR0FBRyxTQUFTLEdBQUcsQ0FBQyxJQUFJLEVBQUU7SUFDdEMsSUFBSSxPQUFPO0lBQ1gsUUFBUSxJQUFJLEVBQUUsVUFBVSxNQUFNLEVBQUU7SUFDaEMsWUFBWSxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDckMsU0FBUztJQUNUO0lBQ0E7O0lDdEVBO0lBQ0E7SUFDQTs7SUFFQSxTQUFTLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRTtJQUMxQyxJQUFJLElBQUksQ0FBQyxJQUFJLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxD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
