var STATELAYERS = (function (exports) {
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
            return {value: p, dynamic: (v != 0 || a != 0 )}
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
        constructor(layer, options={}) {
            // layer
            this._layer = layer;
            // cached nearby object
            this._nearby = undefined;
            // cached segment
            this._segment = undefined;
            // default value
            this._options = options;

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
            return toState$1(this._segments, states, offset, this._layer.options);
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
                const map = new Map((layer.src.get() || [])
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
        const remove = layer.src.get()
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

    function clock_cursor(src=LOCAL_CLOCK_PROVIDER) {
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

    /**
     * "src" is a layer or a stateProvider
     * "clock" is a clockCursor or a clockProvider
     * 
     * - clockProvider is wrapped as clockCursor
     * to ensure that "clock" property of cursors is always a cursor
     * 
     * if no "clock" is provided - local clockProvider is used
     * 
     * - stateProvider is wrapped as itemsLayer
     * to ensure that "src" property of cursors is always a layer
     * this also ensures that variable cursor can easily
     * support live recording, which depends on the nearbyindex of the layer.
     * 
     */

    /**
     * TODO - media control is a special case of variable cursors
     * where src layer is number type and defined on the entire
     * timeline. And protected agoinst other types of state
     * Could perhaps make a special type of layer for this,
     * and then make a special type of control cursor with
     * the appropriate restriction on the src layer.
     */


    function variable_cursor(ctrl, src, options={}) {

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

        cursor.srcprop_check = function (propName, obj=LOCAL_CLOCK_PROVIDER) {
            if (propName == "ctrl") {
                if (is_clock_provider(obj)) {
                    obj = clock_cursor(obj);
                }
                if (!is_clock_cursor(obj)) {
                    throw new Error(`"ctrl" property must be a clock cursor ${obj}`);
                }
                return obj;
            }
            if (propName == "src") {
                if (is_collection_provider(obj) || is_variable_provider(obj)) {
                    obj = items_layer({src:obj});
                }
                if (!is_items_layer(obj)) {
                    throw new Error(`"src" property must be an item layer ${obj}`);
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
            // ctrl may change if clockProvider is reset - but
            // this does not require any particular changes to the src cache        
            detect_future_event();
            cursor.onchange();
        };

        /**
         * cursor.ctrl defines an active region of cursor.src (layer)
         * at some point in the future, the cursor.ctrl will leave this region.
         * in that moment, cursor should reevaluate its state - so we need to 
         * detect this event by timeout  
         */

        function detect_future_event() {
            if (tid) {tid.cancel();}
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
        cursor.options = options;
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
        let items = [];
        if (value != undefined) {
            items = [{
                id: random_string(10),
                itv: [null, null, true, true],
                type: "static",
                data: value              
            }];
        }
        return cursor_update (cursor, items);
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
     * if timestamp is omitted in vector - current timestamp will be assumed
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
        return cursor_update (cursor, items);
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
        return cursor_update (cursor, items);
    }

    /**
     * set interpolation
     * 
     */

    function set_interpolation(cursor, tuples, duration) {
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
        const items = [
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
        return cursor_update (cursor, items);
    }


    function cursor_update(cursor, items) {
        const {record=false} = cursor.options;
        if (record) {
            return cursor.src.append(items, cursor.ctrl.value);
        } else {
            return cursor.src.update({insert:items, reset:true});
        }
    }

    /*****************************************************
     * PLAYBACK CURSOR
     *****************************************************/

    /**
     * src is a layer or a stateProvider
     * ctrl is a cursor or a clockProvider
     * 
     * clockProvider is wrapped as clockCursor
     * to ensure that "ctrl" property of cursors is always a cursor
     * 
     * stateProvider is wrapped as itemsLayer
     * to ensure that "src" property of cursors is always a layer
     */

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
        cursor.srcprop_check = function (propName, obj=LOCAL_CLOCK_PROVIDER) {
            if (propName == "ctrl") {
                if (is_clock_provider(obj)) {
                    obj = clock_cursor(obj);
                }
                if (obj instanceof Cursor) {
                    return obj
                } else {
                    throw new Error(`ctrl must be clockProvider or Cursor ${obj}`);
                }
            }
            if (propName == "src") {
                if (is_collection_provider(obj) || is_variable_provider(obj)) {
                    obj = items_layer({src:obj});
                }
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
                        const [p,v,a,t] = active_item.data;
                        // TODO calculate timeout with acceleration too
                        if (a == 0.0) {
                            // figure out which region boundary we hit first
                            if (v > 0) {
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

    /**
     * recorder for cursor into layer
     * 
     *   MAIN IDEA
     * - record the current value of a cursor (src) into a layer (dst)
     * - recording is essentially a copy operation from the
     *   stateProvider of the cursor (src) to the stateProvider of the layer (dst).
     * - recording does not apply to derived cursors - only cursors that
     *   are directly connected to a stateProvider.
     *
     * 
     *   TIMEFRAMES
     * - the (src) cursor is driven by a clock (src.ctrl): <SRC_CLOCK> 
     * - the recording to (dst) layer is driven by a clock (ctrl): <DST_CLOCK>
     * - if SRC_CLOCK is not the same as DST_CLOCK, recorded items need to be
     *   converted to the DST_CLOCK time frame.
     * - for example - a common scenario would be to record a cursor with real-time
     *   timestamps into a logical timeline starting at 0, possibly 
     *   rewinding the DST_CLOCK to 0 multiple times in order to do new takes
     * 
     *   RECORDING
     * - recording is done by appending items to the dst layer 
     * - when the cursor state changes (entire timeline reset) 
     * - the part of it which describes the future will overwrite the relevant
     * - part of the the layer timeline
     * - the delineation between past and future is determined by 
     * - fresh timestamp <TS> from <DST_CLOCK>
     * - if an item overlaps with <TS> it will be truncates so that only the part
     * - that is in the future will be recorded (copied) to the layer.
     * - in case (ctrl) is a media control - recording can only happen
     *   when the (ctrl) is moving forward
     * 
     *   INPUT
     * - (ctrl) - clock cursor or clock provider media control 
     *   (ctrl is clock_cursor or ctrl.ctrl is clock_cursor)
     * - (src) - cursor with a itemslayer as src 
     *   (src.src is itemslayer)
     * - (dst) - itemslayer
     *
     *   WARNING
     * - implementation assumes (dst) layer is not the same as the (src) layer
     * - (src) cursor can not be clock cursor (makes no sense to record a clock
     *   - especially when you can make a new one at any time)
     *  
     * - if (dst) is not provided, an empty layer will be created
     * - if (ctrl) is not provided, LOCAL_CLOCK_PROVIDER will be used
     */


    function layer_recorder(ctrl=LOCAL_CLOCK_PROVIDER, src, dst) {

        // check - ctrl 
        if (is_clock_provider(ctrl)) {
            ctrl = clock_cursor(ctrl);
        }
        if (
            !is_clock_cursor(ctrl) &&
            !is_clock_cursor(ctrl.ctrl)
        ){
            throw new Error(`ctrl or ctrl.ctrl must be a clock cursor ${ctrl}`);
        }    

        // check - src
        if (!(src instanceof Cursor)) {
            throw new Error(`src must be a cursor ${src}`);
        }
        if (is_clock_cursor(src)) {
            throw new Error(`src can not be a clock cursor ${src}`);
        }
        if (!is_items_layer(src.src)) {
            throw new Error(`cursor src must be itemslayer ${src.src}`);
        }

        // check - dst
        if (!is_items_layer(dst)) {
            throw new Error(`dst must be a itemslayer ${dst}`);
        }

        // check - stateProviders
        const src_stateProvider = src.src.src;
        const dst_stateProvider = dst.src;
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
            if (is_clock_cursor(ctrl)) {
                is_recording = true;
            } else if (is_clock_cursor(ctrl.ctrl)) {
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
            console.log("record");
            const ts = local_clock.now();
            const src_offset = src.query(ts).offset;
            const dst_offset = ctrl.query(ts).value;
            // get current src items
            let src_items = src_stateProvider.get();
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
        return {};
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

    function recorder (options={}) {
        let {ctrl=LOCAL_CLOCK_PROVIDER, src, dst} = options;
        return layer_recorder(ctrl, src, dst);
    }

    /*********************************************************************
        CURSOR FACTORIES
    *********************************************************************/

    function clock (src) {
        return clock_cursor(src);
    }

    function variable(options={}) {
        let {clock, ...opts} = options;
        const src = layer(opts);
        return variable_cursor(clock, src);
    }

    function playback(options={}) {
        let {ctrl, ...opts} = options;
        const src = layer(opts);
        return playback_cursor(ctrl, src);
    }

    function skew (src, offset) {
        function valueFunc(value) {
            return value + offset;
        } 
        return cursor_transform(src, {valueFunc});
    }

    exports.CollectionProvider = CollectionProvider;
    exports.Cursor = Cursor;
    exports.Layer = Layer;
    exports.NearbyIndexBase = NearbyIndexBase;
    exports.VariableProvider = VariableProvider;
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
    exports.recorder = recorder;
    exports.render_cursor = render_cursor;
    exports.render_provider = render_provider;
    exports.skew = skew;
    exports.timeline_transform = timeline_transform;
    exports.variable = variable;

    return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGVsYXllcnMuaWlmZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWwvaW50ZXJ2YWxzLmpzIiwiLi4vLi4vc3JjL25lYXJieV9iYXNlLmpzIiwiLi4vLi4vc3JjL3V0aWwvYXBpX2V2ZW50aWZ5LmpzIiwiLi4vLi4vc3JjL3V0aWwvYXBpX2NhbGxiYWNrLmpzIiwiLi4vLi4vc3JjL3V0aWwvY29tbW9uLmpzIiwiLi4vLi4vc3JjL2xheWVyX2Jhc2UuanMiLCIuLi8uLi9zcmMvdXRpbC9jdXJzb3JfbW9uaXRvci5qcyIsIi4uLy4uL3NyYy9jdXJzb3JfYmFzZS5qcyIsIi4uLy4uL3NyYy9wcm92aWRlcl9jbG9jay5qcyIsIi4uLy4uL3NyYy9wcm92aWRlcl9jb2xsZWN0aW9uLmpzIiwiLi4vLi4vc3JjL3Byb3ZpZGVyX3ZhcmlhYmxlLmpzIiwiLi4vLi4vc3JjL3V0aWwvYXBpX3NyY3Byb3AuanMiLCIuLi8uLi9zcmMvdXRpbC9zb3J0ZWRhcnJheS5qcyIsIi4uLy4uL3NyYy9uZWFyYnlfaW5kZXguanMiLCIuLi8uLi9zcmMvdXRpbC9zZWdtZW50cy5qcyIsIi4uLy4uL3NyYy9sYXllcl9pdGVtcy5qcyIsIi4uLy4uL3NyYy9jdXJzb3JfY2xvY2suanMiLCIuLi8uLi9zcmMvY3Vyc29yX3ZhcmlhYmxlLmpzIiwiLi4vLi4vc3JjL2N1cnNvcl9wbGF5YmFjay5qcyIsIi4uLy4uL3NyYy9vcHMvbGF5ZXJfZnJvbV9jdXJzb3IuanMiLCIuLi8uLi9zcmMvb3BzL21lcmdlLmpzIiwiLi4vLi4vc3JjL29wcy9ib29sZWFuLmpzIiwiLi4vLi4vc3JjL29wcy9sb2dpY2FsX21lcmdlLmpzIiwiLi4vLi4vc3JjL29wcy90aW1lbGluZV90cmFuc2Zvcm0uanMiLCIuLi8uLi9zcmMvb3BzL3RyYW5zZm9ybS5qcyIsIi4uLy4uL3NyYy9vcHMvcmVjb3JkZXIuanMiLCIuLi8uLi9zcmMvdXRpbC9wcm92aWRlcl92aWV3ZXIuanMiLCIuLi8uLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IHRyaXBsZXQgW3ZhbHVlLCB0eXBlXVxuICAgICpcbiAgICAqICAgdGhlcmUgYXJlIDQgdHlwZXMgb2YgaW50ZXJ2YWwgZW5kcG9pbnRzIFxuICAgICogICAtIHYpIC0gaGlnaCBlbmRwb2ludCBhdCB2LCBub3QgaW5jbHVzaXZlXG4gICAgKiAgIC0gdl0gLSBoaWdoIGVuZHBvaW50IGF0IHYsIGluY2x1c2l2ZVxuICAgICogICAtIFt2IC0gbG93IGVuZHBvaW50IGF0IHYsIG5vdCBpbmNsdXNpdmVcbiAgICAqICAgLSAodiAtIGxvdyBlbmRwb2ludCBhdCB2LCBpbmNsdXNpdmVcbiAgICAqIFxuICAgICogICBBIHNpbmd1bGFyIGludGVydmFsIFsyLDIsdHJ1ZSx0cnVlXSB3aWxsIGhhdmUgZW5kcG9pbnRzIFsyIGFuZCAyXVxuICAgICogXG4gICAgKiAgIEFkZGl0aW9uYWxseSwgdG8gc2ltcGxpZnkgY29tcGFyaXNvbiBiZXR3ZWVuIGVuZHBvaW50cyBhbmQgbnVtYmVyc1xuICAgICogICB3aSBpbnRyb2R1Y2UgYSBzcGVjaWFsIGVuZHBvaW50IHR5cGUgLSBWQUxVRVxuICAgICogXG4gICAgKiAgIFRodXMgd2UgZGVmaW5lIDUgdHlwZXMgb2YgZW5kcG9pbnRzXG4gICAgKiBcbiAgICAqICAgSElHSF9PUEVOIDogdilcbiAgICAqICAgSElHSF9DTE9TRUQ6IHZdXG4gICAgKiAgIFZBTFVFOiB2XG4gICAgKiAgIExPV19DTE9TRUQ6IFt2XG4gICAgKiAgIExPV19PUEVOOiAodilcbiAgICAqIFxuICAgICogICBGb3IgdGhlIHB1cnBvc2Ugb2YgZW5kcG9pbnQgY29tcGFyaXNvbiB3ZSBtYWludGFpblxuICAgICogICBhIGxvZ2ljYWwgb3JkZXJpbmcgZm9yIGVuZHBvaW50cyB3aXRoIHRoZSBzYW1lIHZhbHVlLlxuICAgICogICBcbiAgICAqICAgdikgPCBbdiA9PSB2ID09IHZdIDwgKHZcbiAgICAqICBcbiAgICAqICAgV2UgYXNzaWduIG9yZGVyaW5nIHZhbHVlc1xuICAgICogICBcbiAgICAqICAgSElHSF9PUEVOOiAtMVxuICAgICogICBISUdIX0NMT1NFRCwgVkFMVUUsIExPV19DTE9TRUQ6IDBcbiAgICAqICAgTE9XX09QRU46IDFcbiAgICAqIFxuICAgICogICB2YWx1ZSBjYW4gYmUgbnVsbCBvciBudW1iZXIuIElmIHZhbHVlIGlzIG51bGwsIHRoaXMgbWVhbnMgdW5ib3VuZGVkIGVuZHBvaW50XG4gICAgKiAgIGkuZS4gbm8gb3RoZXIgZW5kcG9pbnQgY2FuIGJlIGxhcmdlciBvciBzbWFsbGVyLlxuICAgICogICBhbiB1bmJvdW5kZWQgbG93IGVuZHBvaW50IG1lYW5zIC1JbmZpbml0eVxuICAgICogICBhbiB1bmJvdW5kZWQgaGlnaCBlbmRwb2ludCBtZWFucyBJbmZpbml0eVxuICAgICpcbiovXG5cbmZ1bmN0aW9uIGlzTnVtYmVyKG4pIHtcbiAgICByZXR1cm4gdHlwZW9mIG4gPT0gXCJudW1iZXJcIjtcbn1cblxuY29uc3QgRVBfVFlQRSA9IE9iamVjdC5mcmVlemUoe1xuICAgIEhJR0hfT1BFTjogXCIpXCIsXG4gICAgSElHSF9DTE9TRUQ6IFwiXVwiLFxuICAgIFZBTFVFOiBcIlwiLFxuICAgIExPV19DTE9TRUQ6IFwiW1wiLFxuICAgIExPV19PUEVOOiBcIihcIlxufSk7XG5cbmZ1bmN0aW9uIGlzX0VQX1RZUEUodmFsdWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhFUF9UWVBFKS5pbmNsdWRlcyh2YWx1ZSk7XG59XG5cbmNvbnN0IEVQX09SREVSID0gbmV3IE1hcChbXG4gICAgW0VQX1RZUEUuSElHSF9PUEVOLCAtMV0sXG4gICAgW0VQX1RZUEUuSElHSF9DTE9TRUQsIDBdLFxuICAgIFtFUF9UWVBFLlZBTFVFLCAwXSxcbiAgICBbRVBfVFlQRS5MT1dfQ0xPU0VELCAwXSxcbiAgICBbRVBfVFlQRS5MT1dfT1BFTiwgMV1cbl0pO1xuXG5mdW5jdGlvbiBlbmRwb2ludF9pc19sb3coZXApIHtcbiAgICByZXR1cm4gZXBbMV0gPT0gRVBfVFlQRS5MT1dfQ0xPU0VEIHx8IGVwWzFdID09IEVQX1RZUEUuTE9XX09QRU47XG59XG5cbmZ1bmN0aW9uIGVuZHBvaW50X2lzX2hpZ2goZXApIHtcbiAgICByZXR1cm4gZXBbMV0gPT0gRVBfVFlQRS5ISUdIX0NMT1NFRCB8fCBlcFsxXSA9PSBFUF9UWVBFLkhJR0hfT1BFTjtcbn1cblxuLypcbiAgICByZXR1cm4gZW5kcG9pbnQgZnJvbSBpbnB1dFxuKi9cbmZ1bmN0aW9uIGVuZHBvaW50X2Zyb21faW5wdXQoZXApIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoZXApKSB7XG4gICAgICAgIGVwID0gW2VwLCBFUF9UWVBFLlZBTFVFXTtcbiAgICB9XG4gICAgaWYgKGVwLmxlbmd0aCAhPSAyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVuZHBvaW50IG11c3QgYmUgYSBsZW5ndGgtMiBhcnJheVwiLCBlcCk7XG4gICAgfVxuICAgIGxldCBbdix0XSA9IGVwO1xuICAgIGlmICghaXNfRVBfVFlQRSh0KSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbnN1cHBvcnRlZCBlbmRwb2ludCB0eXBlXCIsIHQpO1xuICAgIH1cbiAgICBpZiAodiA9PSAtSW5maW5pdHkpIHtcbiAgICAgICAgcmV0dXJuIFtudWxsLCBFUF9UWVBFLkxPV19DTE9TRURdO1xuICAgIH1cbiAgICBpZiAodiA9PSBJbmZpbml0eSkge1xuICAgICAgICByZXR1cm4gW251bGwsIEVQX1RZUEUuSElHSF9DTE9TRURdO1xuICAgIH1cbiAgICBpZiAodiA9PSB1bmRlZmluZWQgfHwgdiA9PSBudWxsIHx8IGlzTnVtYmVyKHYpKSB7XG4gICAgICAgIHJldHVybiBbdiwgdF07XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihcImVuZHBvaW50IG11c3QgYmUgbnVsbCBvciBudW1iZXJcIiwgdik7XG59XG5cbmNvbnN0IGVuZHBvaW50X1BPU19JTkYgPSBlbmRwb2ludF9mcm9tX2lucHV0KEluZmluaXR5KTtcbmNvbnN0IGVuZHBvaW50X05FR19JTkYgPSBlbmRwb2ludF9mcm9tX2lucHV0KC1JbmZpbml0eSk7XG5cbi8qKlxuICogSW50ZXJuYWwgcmVwcmVzZW50YXRpb24gXG4gKiByZXBsYWNpbmcgbnVsbCB2YWx1c2Ugd2l0aCAtSW5maW5pdHkgb3IgSW5maW5pdHlcbiAqIGluIG9yZGVyIHRvIHNpbXBsaWZ5IG51bWVyaWNhbCBjb21wYXJpc29uXG4gKi9cbmZ1bmN0aW9uIGVuZHBvaW50X2ludGVybmFsKGVwKSB7XG4gICAgaWYgKGVwWzBdICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIFtlcFswXSwgZXBbMV1dO1xuICAgIH1cbiAgICBpZiAoZW5kcG9pbnRfaXNfbG93KGVwKSkge1xuICAgICAgICByZXR1cm4gWy1JbmZpbml0eSwgRVBfVFlQRS5MT1dfQ0xPU0VEXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gW0luZmluaXR5LCBFUF9UWVBFLkhJR0hfQ0xPU0VEXTtcbiAgICB9XG59XG5cbi8qKlxuICogQ29tcGFyaXNvbiBmdW5jdGlvbiBmb3IgbnVtYmVyc1xuICogYXZvaWQgc3VidHJhY3Rpb24gdG8gc3VwcG9ydCBJbmZpbml0eSB2YWx1ZXNcbiAqL1xuZnVuY3Rpb24gbnVtYmVyX2NtcChhLCBiKSB7XG4gICAgaWYgKGEgPCBiKSByZXR1cm4gLTE7IC8vIGNvcnJlY3Qgb3JkZXJcbiAgICBpZiAoYSA+IGIpIHJldHVybiAxOyAvLyB3cm9uZyBvcmRlclxuICAgIHJldHVybiAwOyAvLyBlcXVhbGl0eVxufVxuXG4vKlxuICAgIEVuZHBvaW50IGNvbXBhcmlzb25cbiAgICByZXR1cm5zIFxuICAgICAgICAtIG5lZ2F0aXZlIDogY29ycmVjdCBvcmRlclxuICAgICAgICAtIDAgOiBlcXVhbFxuICAgICAgICAtIHBvc2l0aXZlIDogd3Jvbmcgb3JkZXJcbiovIFxuZnVuY3Rpb24gZW5kcG9pbnRfY21wKGVwMSwgZXAyKSB7ICAgIFxuICAgIGNvbnN0IFt2MSwgdDFdID0gZW5kcG9pbnRfaW50ZXJuYWwoZXAxKTtcbiAgICBjb25zdCBbdjIsIHQyXSA9IGVuZHBvaW50X2ludGVybmFsKGVwMik7XG4gICAgY29uc3QgZGlmZiA9IG51bWJlcl9jbXAodjEsIHYyKTtcbiAgICBpZiAoZGlmZiA9PSAwKSB7XG4gICAgICAgIGNvbnN0IG8xID0gRVBfT1JERVIuZ2V0KHQxKTtcbiAgICAgICAgY29uc3QgbzIgPSBFUF9PUkRFUi5nZXQodDIpO1xuICAgICAgICByZXR1cm4gbnVtYmVyX2NtcChvMSwgbzIpO1xuICAgIH1cbiAgICByZXR1cm4gZGlmZjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludDpcbiAqIC0gaWUuIGdldCBhZGphY2VudCBlbmRwb25pdCBvbiB0aGUgdGltZWxpbmVcbiAqIFxuICogdikgPC0+IFt2XG4gKiB2XSA8LT4gKHZcbiAqIFxuICogZmxpcHBpbmcgaGFzIG5vIGVmZmVjdCBvbiBlbmRwb2ludHMgd2l0aCB1bmJvdW5kZWQgdmFsdWVcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKGVwLCB0YXJnZXQpIHtcbiAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInRhcmdldCBpcyBkZXByZWNhdGVkXCIpO1xuICAgIH1cbiAgICBsZXQgW3YsdF0gPSBlcDtcbiAgICBpZiAodiA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBlcDtcbiAgICB9XG4gICAgaWYgKHQgPT0gRVBfVFlQRS5ISUdIX09QRU4pIHtcbiAgICAgICAgcmV0dXJuIFt2LCBFUF9UWVBFLkxPV19DTE9TRURdO1xuICAgIH0gZWxzZSBpZiAodCA9PSBFUF9UWVBFLkhJR0hfQ0xPU0VEKSB7XG4gICAgICAgIHJldHVybiBbdiwgRVBfVFlQRS5MT1dfT1BFTl07XG4gICAgfSBlbHNlIGlmICh0ID09IEVQX1RZUEUuTE9XX09QRU4pIHtcbiAgICAgICAgcmV0dXJuIFt2LCBFUF9UWVBFLkhJR0hfQ0xPU0VEXTtcbiAgICB9IGVsc2UgaWYgKHQgPT0gRVBfVFlQRS5MT1dfQ0xPU0VEKSB7XG4gICAgICAgIHJldHVybiBbdiwgRVBfVFlQRS5ISUdIX09QRU5dO1xuICAgIH0gZWxzZSB7XG4gICAgXHR0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2FsIGVuZHBvaW50IHR5cGVcIiwgdCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG4vKlxuICAgIHJldHVybnMgbG93IGFuZCBoaWdoIGVuZHBvaW50cyBmcm9tIGludGVydmFsXG4qL1xuZnVuY3Rpb24gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KSB7XG4gICAgY29uc3QgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBjb25zdCBsb3dUeXBlID0gKGxvd0Nsb3NlZCkgPyAgRVBfVFlQRS5MT1dfQ0xPU0VEIDogRVBfVFlQRS5MT1dfT1BFTjtcbiAgICBjb25zdCBoaWdoVHlwZSA9IChoaWdoQ2xvc2VkKSA/ICBFUF9UWVBFLkhJR0hfQ0xPU0VEIDogRVBfVFlQRS5ISUdIX09QRU47XG4gICAgY29uc3QgbG93RXAgPSBlbmRwb2ludF9mcm9tX2lucHV0KFtsb3csIGxvd1R5cGVdKTtcbiAgICBjb25zdCBoaWdoRXAgPSBlbmRwb2ludF9mcm9tX2lucHV0KFtoaWdoLCBoaWdoVHlwZV0pO1xuICAgIHJldHVybiBbbG93RXAsIGhpZ2hFcF07XG59XG5cblxuLypcbiAgICBJTlRFUlZBTFNcblxuICAgIEludGVydmFscyBhcmUgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXVxuXG4qLyBcblxuXG4vKlxuICAgIHJldHVybiB0cnVlIGlmIHBvaW50IG9yIGVuZHBvaW50IGlzIGNvdmVyZWQgYnkgaW50ZXJ2YWxcbiAgICBwb2ludCBwIGNhbiBiZSBudW1iZXIgdmFsdWUgb3IgYW4gZW5kcG9pbnRcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBlcCkge1xuICAgIGNvbnN0IFtsb3dfZXAsIGhpZ2hfZXBdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICBlcCA9IGVuZHBvaW50X2Zyb21faW5wdXQoZXApO1xuICAgIC8vIGNvdmVyczogbG93IDw9IHAgPD0gaGlnaFxuICAgIHJldHVybiBlbmRwb2ludF9sZShsb3dfZXAsIGVwKSAmJiBlbmRwb2ludF9sZShlcCwgaGlnaF9lcCk7XG59XG4vLyBjb252ZW5pZW5jZVxuZnVuY3Rpb24gaW50ZXJ2YWxfY292ZXJzX3BvaW50KGl0diwgcCkge1xuICAgIHJldHVybiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBwKTtcbn1cblxuLypcbiAgICBSZXR1cm4gdHJ1ZSBpZiBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIGVxdWFsXG4qL1xuZnVuY3Rpb24gaW50ZXJ2YWxfaXNfc2luZ3VsYXIoaW50ZXJ2YWwpIHtcbiAgICBjb25zdCBbbG93X2VwLCBoaWdoX2VwXSA9IGVuZHBvaW50c19mcm9tX2ludGVydmFsKGl0dik7XG4gICAgcmV0dXJuIGVuZHBvaW50X2VxKGxvd19lcCwgaGlnaF9lcCk7XG59XG5cbi8qXG4gICAgQ3JlYXRlIGludGVydmFsIGZyb20gZW5kcG9pbnRzXG4qL1xuZnVuY3Rpb24gaW50ZXJ2YWxfZnJvbV9lbmRwb2ludHMoZXAxLCBlcDIpIHtcbiAgICBsZXQgW3YxLCB0MV0gPSBlcDE7XG4gICAgbGV0IFt2MiwgdDJdID0gZXAyO1xuICAgIGlmICghZW5kcG9pbnRfaXNfbG93KGVwMSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBsb3cgZW5kcG9pbnRcIiwgZXAxKTtcbiAgICB9XG4gICAgaWYgKCFlbmRwb2ludF9pc19oaWdoKGVwMikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBoaWdoIGVuZHBvaW50XCIsIGVwMik7XG4gICAgfVxuICAgIHJldHVybiBbdjEsIHYyLCB0MSA9PSBFUF9UWVBFLkxPV19DTE9TRUQsIHQyID09IEVQX1RZUEUuSElHSF9DTE9TRURdO1xufVxuXG5cbmZ1bmN0aW9uIGludGVydmFsX2Zyb21faW5wdXQoaW5wdXQpe1xuICAgIGxldCBpdHYgPSBpbnB1dDtcbiAgICBpZiAoaXR2ID09IHVuZGVmaW5lZCB8fCBpdHYgPT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnB1dCBpcyB1bmRlZmluZWRcIik7XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShpdHYpKSB7XG4gICAgICAgIGlmIChpc051bWJlcihpdHYpKSB7XG4gICAgICAgICAgICAvLyBpbnB1dCBpcyBzaW5ndWxhciBudW1iZXJcbiAgICAgICAgICAgIGl0diA9IFtpdHYsIGl0diwgdHJ1ZSwgdHJ1ZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlucHV0OiAke2lucHV0fTogbXVzdCBiZSBBcnJheSBvciBOdW1iZXJgKVxuICAgICAgICB9XG4gICAgfTtcbiAgICAvLyBtYWtlIHN1cmUgaW50ZXJ2YWwgaXMgbGVuZ3RoIDRcbiAgICBpZiAoaXR2Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGl0diA9IFtpdHZbMF0sIGl0dlswXSwgdHJ1ZSwgdHJ1ZV07XG4gICAgfSBlbHNlIGlmIChpdHYubGVuZ3RoID09IDIpIHtcbiAgICAgICAgaXR2ID0gW2l0dlswXSwgaXR2WzFdLCB0cnVlLCBmYWxzZV07XG4gICAgfSBlbHNlIGlmIChpdHYubGVuZ3RoID09IDMpIHtcbiAgICAgICAgaXR2ID0gW2l0dlswXSwgaXR2WzFdLCBpdHZbMl0sIGZhbHNlXTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPiA0KSB7XG4gICAgICAgIGl0diA9IFtpdHZbMF0sIGl0dlsxXSwgaXR2WzJdLCBpdHZbNF1dO1xuICAgIH1cbiAgICBsZXQgW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdID0gaXR2O1xuICAgIC8vIGJvdW5kYXJ5IGNvbmRpdGlvbnMgYXJlIG51bWJlciBvciBudWxsXG4gICAgaWYgKGxvdyA9PSB1bmRlZmluZWQgfHwgbG93ID09IC1JbmZpbml0eSkge1xuICAgICAgICBsb3cgPSBudWxsO1xuICAgIH1cbiAgICBpZiAoaGlnaCA9PSB1bmRlZmluZWQgfHwgaGlnaCA9PSBJbmZpbml0eSkge1xuICAgICAgICBoaWdoID0gbnVsbDtcbiAgICB9XG4gICAgLy8gY2hlY2sgbG93XG4gICAgaWYgKGxvdyA9PSBudWxsKSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICghaXNOdW1iZXIobG93KSkgdGhyb3cgbmV3IEVycm9yKFwibG93IG5vdCBhIG51bWJlclwiLCBsb3cpO1xuICAgIH1cbiAgICAvLyBjaGVjayBoaWdoXG4gICAgaWYgKGhpZ2ggPT0gbnVsbCkge1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCFpc051bWJlcihoaWdoKSkgdGhyb3cgbmV3IEVycm9yKFwiaGlnaCBub3QgYSBudW1iZXJcIiwgaGlnaCk7XG4gICAgfSAgICBcbiAgICAvLyBjaGVjayB0aGF0IGxvdyA8PSBoaWdoXG4gICAgaWYgKGxvdyAhPSBudWxsICYmIGhpZ2ggIT0gbnVsbCkge1xuICAgICAgICBpZiAobG93ID4gaGlnaCkgdGhyb3cgbmV3IEVycm9yKFwibG93ID4gaGlnaFwiLCBsb3csIGhpZ2gpO1xuICAgICAgICAvLyBzaW5nbGV0b25cbiAgICAgICAgaWYgKGxvdyA9PSBoaWdoKSB7XG4gICAgICAgICAgICBsb3dJbmNsdWRlID0gdHJ1ZTtcbiAgICAgICAgICAgIGhpZ2hJbmNsdWRlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBjaGVjayB0aGF0IGxvd0luY2x1ZGUsIGhpZ2hJbmNsdWRlIGFyZSBib29sZWFuc1xuICAgIGlmICh0eXBlb2YgbG93SW5jbHVkZSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibG93SW5jbHVkZSBub3QgYm9vbGVhblwiKTtcbiAgICB9IFxuICAgIGlmICh0eXBlb2YgaGlnaEluY2x1ZGUgIT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImhpZ2hJbmNsdWRlIG5vdCBib29sZWFuXCIpO1xuICAgIH1cbiAgICByZXR1cm4gW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdO1xufVxuXG5leHBvcnQgY29uc3QgZW5kcG9pbnQgPSB7XG4gICAgbGU6IGVuZHBvaW50X2xlLFxuICAgIGx0OiBlbmRwb2ludF9sdCxcbiAgICBnZTogZW5kcG9pbnRfZ2UsXG4gICAgZ3Q6IGVuZHBvaW50X2d0LFxuICAgIGNtcDogZW5kcG9pbnRfY21wLFxuICAgIGVxOiBlbmRwb2ludF9lcSxcbiAgICBtaW46IGVuZHBvaW50X21pbixcbiAgICBtYXg6IGVuZHBvaW50X21heCxcbiAgICBmbGlwOiBlbmRwb2ludF9mbGlwLFxuICAgIGZyb21faW50ZXJ2YWw6IGVuZHBvaW50c19mcm9tX2ludGVydmFsLFxuICAgIGZyb21faW5wdXQ6IGVuZHBvaW50X2Zyb21faW5wdXQsXG4gICAgdHlwZXM6IHsuLi5FUF9UWVBFfSxcbiAgICBQT1NfSU5GIDogZW5kcG9pbnRfUE9TX0lORixcbiAgICBORUdfSU5GIDogZW5kcG9pbnRfTkVHX0lORlxufVxuZXhwb3J0IGNvbnN0IGludGVydmFsID0ge1xuICAgIGNvdmVyc19lbmRwb2ludDogaW50ZXJ2YWxfY292ZXJzX2VuZHBvaW50LFxuICAgIGNvdmVyc19wb2ludDogaW50ZXJ2YWxfY292ZXJzX3BvaW50LCBcbiAgICBpc19zaW5ndWxhcjogaW50ZXJ2YWxfaXNfc2luZ3VsYXIsXG4gICAgZnJvbV9lbmRwb2ludHM6IGludGVydmFsX2Zyb21fZW5kcG9pbnRzLFxuICAgIGZyb21faW5wdXQ6IGludGVydmFsX2Zyb21faW5wdXRcbn1cbiIsImltcG9ydCB7IGVuZHBvaW50LCBpbnRlcnZhbCB9IGZyb20gXCIuL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBORUFSQlkgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBBYnN0cmFjdCBzdXBlcmNsYXNzIGZvciBOZWFyYnlJbmRleGUuXG4gKiBcbiAqIFN1cGVyY2xhc3MgdXNlZCB0byBjaGVjayB0aGF0IGEgY2xhc3MgaW1wbGVtZW50cyB0aGUgbmVhcmJ5KCkgbWV0aG9kLCBcbiAqIGFuZCBwcm92aWRlIHNvbWUgY29udmVuaWVuY2UgbWV0aG9kcy5cbiAqIFxuICogTkVBUkJZIElOREVYXG4gKiBcbiAqIE5lYXJieUluZGV4IHByb3ZpZGVzIGluZGV4aW5nIHN1cHBvcnQgb2YgZWZmZWN0aXZlbHlcbiAqIGxvb2tpbmcgdXAgcmVnaW9ucyBieSBvZmZzZXQsIFxuICogZ2l2ZW4gdGhhdFxuICogKGkpIGVhY2ggcmVnaW9uIGlzIGFzc29jaWF0ZWQgd2l0aCBhbiBpbnRlcnZhbCBhbmQsXG4gKiAoaWkpIHJlZ2lvbnMgYXJlIG5vbi1vdmVybGFwcGluZy5cbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgXG4gKiBhcm91bmQgZW5kcG9pbnQuIFxuICogXG4gKiBSZXR1cm5zIHtcbiAqICAgICAgY2VudGVyOiBsaXN0IG9mIG9iamVjdHMgY292ZXJlZCBieSByZWdpb24sXG4gKiAgICAgIGl0djogcmVnaW9uIGludGVydmFsIC0gdmFsaWRpdHkgb2YgY2VudGVyIFxuICogICAgICBsZWZ0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIGxlZnQgXG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBoaWdoLWVuZHBvaW50IG9yIGVuZHBvaW50Lk5FR19JTkZcbiAqICAgICAgcmlnaHQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgcmlnaHRcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGxvdy1lbmRwb2ludCBvciBlbmR0cG9pbnQuUE9TX0lORlxuICogXG4gKiBcbiAqIFRoZSBuZWFyYnkgc3RhdGUgaXMgd2VsbC1kZWZpbmVkIGZvciBldmVyeSBlbmRwb2ludFxuICogb24gdGhlIHRpbWVsaW5lLlxuICogXG4gKiBJTlRFUlZBTFNcbiAqIFxuICogW2xvdywgaGlnaCwgbG93SW5jbHVzaXZlLCBoaWdoSW5jbHVzaXZlXVxuICogXG4gKiBUaGlzIHJlcHJlc2VudGF0aW9uIGVuc3VyZXMgdGhhdCB0aGUgaW50ZXJ2YWwgZW5kcG9pbnRzIFxuICogYXJlIG9yZGVyZWQgYW5kIGFsbG93cyBpbnRlcnZhbHMgdG8gYmUgZXhjbHVzaXZlIG9yIGluY2x1c2l2ZSwgXG4gKiB5ZXQgY292ZXIgdGhlIGVudGlyZSByZWFsIGxpbmUgXG4gKiBcbiAqIFthLGJdLCAoYSxiKSwgW2EsYiksIFthLCBiKSBhcmUgYWxsIHZhbGlkIGludGVydmFsc1xuICogXG4gKiBcbiAqIElOVEVSVkFMIEVORFBPSU5UU1xuICogXG4gKiBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIGRlZmluZWQgYnkgW3ZhbHVlLCB0eXBlXSwgZm9yIGV4YW1wbGVcbiAqIFxuICogNCkgLT4gWzQsXCIpXCJdIC0gaGlnaCBlbmRwb2ludCBsZWZ0IG9mIDRcbiAqIFs0IC0+IFs0LCBcIltcIl0gLSBsb3cgZW5kcG9pbnQgaW5jbHVkZXMgNFxuICogNCAgLT4gWzQsIFwiXCJdIC0gdmFsdWUgNFxuICogNF0gLT4gWzQsIFwiXVwiXSAtIGhpZ2ggZW5kcG9pbnQgaW5jbHVkZXMgNFxuICogKDQgLT4gWzQsIFwiKFwiXSAtIGxvdyBlbmRwb2ludCBpcyByaWdodCBvZiA0XG4gKiBcbiAqL1xuXG5cbi8qKlxuICogcmV0dXJuIGZpcnN0IGhpZ2ggZW5kcG9pbnQgb24gdGhlIGxlZnQgZnJvbSBuZWFyYnksXG4gKiB3aGljaCBpcyBub3QgaW4gY2VudGVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsZWZ0X2VuZHBvaW50IChuZWFyYnkpIHtcbiAgICBjb25zdCBsb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5lYXJieS5pdHYpWzBdO1xuICAgIHJldHVybiBlbmRwb2ludC5mbGlwKGxvdyk7XG59XG5cbi8qKlxuICogcmV0dXJuIGZpcnN0IGxvdyBlbmRwb2ludCBvbiB0aGUgcmlnaHQgZnJvbSBuZWFyYnksXG4gKiB3aGljaCBpcyBub3QgaW4gY2VudGVyXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHJpZ2h0X2VuZHBvaW50IChuZWFyYnkpIHtcbiAgICBjb25zdCBoaWdoID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChuZWFyYnkuaXR2KVsxXTtcbiAgICByZXR1cm4gZW5kcG9pbnQuZmxpcChoaWdoKTtcbn1cblxuXG5cbmV4cG9ydCBjbGFzcyBOZWFyYnlJbmRleEJhc2Uge1xuXG5cbiAgICAvKiBcbiAgICAgICAgTmVhcmJ5IG1ldGhvZFxuICAgICovXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgZW1wdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZpcnN0KCkgPT0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHJldHVybiBsb3cgcG9pbnQgb2YgbGVmdG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGZpcnN0KCkge1xuICAgICAgICBsZXQge2NlbnRlciwgcmlnaHR9ID0gdGhpcy5uZWFyYnkoZW5kcG9pbnQuTkVHX0lORik7XG4gICAgICAgIGlmIChjZW50ZXIubGVuZ3RoID4gMCApIHtcbiAgICAgICAgICAgIHJldHVybiBlbmRwb2ludC5ORUdfSU5GO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlbmRwb2ludC5sdChyaWdodCwgZW5kcG9pbnQuUE9TX0lORikpIHtcbiAgICAgICAgICAgIHJldHVybiByaWdodDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGVtcHR5XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGhpZ2ggcG9pbnQgb2YgcmlnaHRtb3N0IGVudHJ5XG4gICAgKi9cbiAgICBsYXN0KCkge1xuICAgICAgICBsZXQge2xlZnQsIGNlbnRlcn0gPSB0aGlzLm5lYXJieShlbmRwb2ludC5QT1NfSU5GKTtcbiAgICAgICAgaWYgKGNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuUE9TX0lORjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZW5kcG9pbnQuZ3QobGVmdCwgZW5kcG9pbnQuTkVHX0lORikpIHtcbiAgICAgICAgICAgIHJldHVybiBsZWZ0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZW1wdHlcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIHJldHVybiBuZWFyYnkgb2YgZmlyc3QgcmVnaW9uIHRvIHRoZSByaWdodFxuICAgICAqIHdoaWNoIGlzIG5vdCB0aGUgY2VudGVyIHJlZ2lvbi4gSWYgbm90IGV4aXN0cywgcmV0dXJuXG4gICAgICogdW5kZWZpbmVkLiBcbiAgICAgKi9cbiAgICByaWdodF9yZWdpb24obmVhcmJ5KSB7XG4gICAgICAgIGNvbnN0IHJpZ2h0ID0gcmlnaHRfZW5kcG9pbnQobmVhcmJ5KTtcbiAgICAgICAgaWYgKHJpZ2h0WzBdID09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubmVhcmJ5KHJpZ2h0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZXR1cm4gbmVhcmJ5IG9mIGZpcnN0IHJlZ2lvbiB0byB0aGUgbGVmdFxuICAgICAqIHdoaWNoIGlzIG5vdCB0aGUgY2VudGVyIHJlZ2lvbi4gSWYgbm90IGV4aXN0cywgcmV0dXJuXG4gICAgICogdW5kZWZpbmVkLiBcbiAgICAgKi9cbiAgICBsZWZ0X3JlZ2lvbihuZWFyYnkpIHtcbiAgICAgICAgY29uc3QgbGVmdCA9IGxlZnRfZW5kcG9pbnQobmVhcmJ5KTtcbiAgICAgICAgaWYgKGxlZnRbMF0gPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5uZWFyYnkobGVmdCk7ICAgIFxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGZpbmQgZmlyc3QgcmVnaW9uIHRvIHRoZSBcInJpZ2h0XCIgb3IgXCJsZWZ0XCJcbiAgICAgKiB3aGljaCBpcyBub3QgdGhlIGNlbnRlciByZWdpb24sIGFuZCB3aGljaCBtZWV0c1xuICAgICAqIGEgY29uZGl0aW9uIG9uIG5lYXJieS5jZW50ZXIuXG4gICAgICogRGVmYXVsdCBjb25kaXRpb24gaXMgY2VudGVyIG5vbi1lbXB0eVxuICAgICAqIElmIG5vdCBleGlzdHMsIHJldHVybiB1bmRlZmluZWQuIFxuICAgICAqL1xuICAgIFxuICAgIGZpbmRfcmVnaW9uKG5lYXJieSwgb3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge1xuICAgICAgICAgICAgZGlyZWN0aW9uID0gMSxcbiAgICAgICAgICAgIGNvbmRpdGlvbiA9IChjZW50ZXIpID0+IGNlbnRlci5sZW5ndGggPiAwXG4gICAgICAgIH0gPSBvcHRpb25zO1xuICAgICAgICBsZXQgbmV4dF9uZWFyYnk7XG4gICAgICAgIHdoaWxlKHRydWUpIHtcbiAgICAgICAgICAgIGlmIChkaXJlY3Rpb24gPT0gMSkge1xuICAgICAgICAgICAgICAgIG5leHRfbmVhcmJ5ID0gdGhpcy5yaWdodF9yZWdpb24obmVhcmJ5KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmV4dF9uZWFyYnkgPSB0aGlzLmxlZnRfcmVnaW9uKG5lYXJieSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobmV4dF9uZWFyYnkgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjb25kaXRpb24obmV4dF9uZWFyYnkuY2VudGVyKSkge1xuICAgICAgICAgICAgICAgIC8vIGZvdW5kIHJlZ2lvbiBcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV4dF9uZWFyYnk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyByZWdpb24gbm90IGZvdW5kXG4gICAgICAgICAgICAvLyBjb250aW51ZSBzZWFyY2hpbmcgdGhlIHJpZ2h0XG4gICAgICAgICAgICBuZWFyYnkgPSBuZXh0X25lYXJieTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlZ2lvbnMob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gbmV3IFJlZ2lvbkl0ZXJhdG9yKHRoaXMsIG9wdGlvbnMpO1xuICAgIH1cblxufVxuXG5cbi8qXG4gICAgSXRlcmF0ZSByZWdpb25zIG9mIGluZGV4IGZyb20gbGVmdCB0byByaWdodFxuXG4gICAgSXRlcmF0aW9uIGxpbWl0ZWQgdG8gaW50ZXJ2YWwgW3N0YXJ0LCBzdG9wXSBvbiB0aGUgdGltZWxpbmUuXG4gICAgUmV0dXJucyBsaXN0IG9mIGl0ZW0tbGlzdHMuXG4gICAgb3B0aW9uc1xuICAgIC0gc3RhcnRcbiAgICAtIHN0b3BcbiAgICAtIGluY2x1ZGVFbXB0eVxuKi9cblxuY2xhc3MgUmVnaW9uSXRlcmF0b3Ige1xuXG4gICAgY29uc3RydWN0b3IoaW5kZXgsIG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtcbiAgICAgICAgICAgIHN0YXJ0PS1JbmZpbml0eSwgXG4gICAgICAgICAgICBzdG9wPUluZmluaXR5LCBcbiAgICAgICAgICAgIGluY2x1ZGVFbXB0eT10cnVlXG4gICAgICAgIH0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3RhcnQgPiBzdG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgKFwic3RvcCBtdXN0IGJlIGxhcmdlciB0aGFuIHN0YXJ0XCIsIHN0YXJ0LCBzdG9wKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gICAgICAgIHRoaXMuX3N0YXJ0ID0gZW5kcG9pbnQuZnJvbV9pbnB1dChzdGFydCk7XG4gICAgICAgIHRoaXMuX3N0b3AgPSBlbmRwb2ludC5mcm9tX2lucHV0KHN0b3ApO1xuXG4gICAgICAgIGlmIChpbmNsdWRlRW1wdHkpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbmRpdGlvbiA9ICgpID0+IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jb25kaXRpb24gPSAoY2VudGVyKSA9PiBjZW50ZXIubGVuZ3RoID4gMDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jdXJyZW50O1xuICAgIH1cblxuICAgIG5leHQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gaW5pdGlhbHNlXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50ID0gdGhpcy5faW5kZXgubmVhcmJ5KHRoaXMuX3N0YXJ0KTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jb25kaXRpb24odGhpcy5fY3VycmVudC5jZW50ZXIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZTp0aGlzLl9jdXJyZW50LCBkb25lOmZhbHNlfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBsZXQgb3B0aW9ucyA9IHtjb25kaXRpb246dGhpcy5fY29uZGl0aW9uLCBkaXJlY3Rpb246MX1cbiAgICAgICAgdGhpcy5fY3VycmVudCA9IHRoaXMuX2luZGV4LmZpbmRfcmVnaW9uKHRoaXMuX2N1cnJlbnQsIG9wdGlvbnMpO1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dW5kZWZpbmVkLCBkb25lOnRydWV9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZTp0aGlzLl9jdXJyZW50LCBkb25lOmZhbHNlfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn1cblxuLyoqXG4gKiBuZWFyYnlfZnJvbVxuICogXG4gKiB1dGlsaXR5IGZ1bmN0aW9uIGZvciBjcmVhdGluZyBhIG5lYXJieSBvYmplY3QgaW4gY2lyY3Vtc3RhbmNlc1xuICogd2hlcmUgdGhlcmUgYXJlIG92ZXJsYXBwaW5nIGludGVydmFscyBUaGlzIGNvdWxkIGJlIHdoZW4gYSBcbiAqIHN0YXRlcHJvdmlkZXIgZm9yIGEgbGF5ZXIgaGFzIG92ZXJsYXBwaW5nIGl0ZW1zIG9yIHdoZW4gXG4gKiBtdWx0aXBsZSBuZWFyYnkgaW5kZXhlcyBhcmUgbWVyZ2VkIGludG8gb25lLlxuICogXG4gKiBcbiAqIEBwYXJhbSB7Kn0gcHJldl9oaWdoIDogdGhlIHJpZ2h0bW9zdCBoaWdoLWVuZHBvaW50IGxlZnQgb2Ygb2Zmc2V0XG4gKiBAcGFyYW0geyp9IGNlbnRlcl9sb3dfbGlzdCA6IGxvdy1lbmRwb2ludHMgb2YgY2VudGVyXG4gKiBAcGFyYW0geyp9IGNlbnRlciA6IGNlbnRlclxuICogQHBhcmFtIHsqfSBjZW50ZXJfaGlnaF9saXN0IDogaGlnaC1lbmRwb2ludHMgb2YgY2VudGVyXG4gKiBAcGFyYW0geyp9IG5leHRfbG93IDogdGhlIGxlZnRtb3N0IGxvdy1lbmRwb2ludCByaWdodCBvZiBvZmZzZXRcbiAqIEByZXR1cm5zIFxuICovXG5cbmZ1bmN0aW9uIGNtcF9hc2NlbmRpbmcocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmNtcChwMSwgcDIpXG59XG5cbmZ1bmN0aW9uIGNtcF9kZXNjZW5kaW5nKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludC5jbXAocDIsIHAxKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbmVhcmJ5X2Zyb20gKFxuICAgIHByZXZfaGlnaCwgXG4gICAgY2VudGVyX2xvd19saXN0LCBcbiAgICBjZW50ZXIsXG4gICAgY2VudGVyX2hpZ2hfbGlzdCxcbiAgICBuZXh0X2xvdykge1xuXG4gICAgLy8gbmVhcmJ5XG4gICAgY29uc3QgcmVzdWx0ID0ge2NlbnRlcn07XG5cbiAgICBpZiAoY2VudGVyLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgIC8vIGVtcHR5IGNlbnRlclxuICAgICAgICByZXN1bHQucmlnaHQgPSBuZXh0X2xvdztcbiAgICAgICAgcmVzdWx0LmxlZnQgPSBwcmV2X2hpZ2g7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gbm9uLWVtcHR5IGNlbnRlclxuICAgICAgICBcbiAgICAgICAgLy8gY2VudGVyIGhpZ2hcbiAgICAgICAgY2VudGVyX2hpZ2hfbGlzdC5zb3J0KGNtcF9hc2NlbmRpbmcpO1xuICAgICAgICBsZXQgbWluX2NlbnRlcl9oaWdoID0gY2VudGVyX2hpZ2hfbGlzdFswXTtcbiAgICAgICAgbGV0IG1heF9jZW50ZXJfaGlnaCA9IGNlbnRlcl9oaWdoX2xpc3Quc2xpY2UoLTEpWzBdO1xuICAgICAgICBsZXQgbXVsdGlwbGVfY2VudGVyX2hpZ2ggPSAhZW5kcG9pbnQuZXEobWluX2NlbnRlcl9oaWdoLCBtYXhfY2VudGVyX2hpZ2gpXG5cbiAgICAgICAgLy8gY2VudGVyIGxvd1xuICAgICAgICBjZW50ZXJfbG93X2xpc3Quc29ydChjbXBfZGVzY2VuZGluZyk7XG4gICAgICAgIGxldCBtYXhfY2VudGVyX2xvdyA9IGNlbnRlcl9sb3dfbGlzdFswXTtcbiAgICAgICAgbGV0IG1pbl9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0LnNsaWNlKC0xKVswXTtcbiAgICAgICAgbGV0IG11bHRpcGxlX2NlbnRlcl9sb3cgPSAhZW5kcG9pbnQuZXEobWF4X2NlbnRlcl9sb3csIG1pbl9jZW50ZXJfbG93KVxuXG4gICAgICAgIC8vIG5leHQvcmlnaHRcbiAgICAgICAgaWYgKGVuZHBvaW50LmxlKG5leHRfbG93LCBtaW5fY2VudGVyX2hpZ2gpKSB7XG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSBuZXh0X2xvdztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IGVuZHBvaW50LmZsaXAobWluX2NlbnRlcl9oaWdoKVxuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5uZXh0ID0gKG11bHRpcGxlX2NlbnRlcl9oaWdoKSA/IHJlc3VsdC5yaWdodCA6IG5leHRfbG93O1xuXG4gICAgICAgIC8vIHByZXYvbGVmdFxuICAgICAgICBpZiAoZW5kcG9pbnQuZ2UocHJldl9oaWdoLCBtYXhfY2VudGVyX2xvdykpIHtcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gcHJldl9oaWdoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSBlbmRwb2ludC5mbGlwKG1heF9jZW50ZXJfbG93KTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQucHJldiA9IChtdWx0aXBsZV9jZW50ZXJfbG93KSA/IHJlc3VsdC5sZWZ0IDogcHJldl9oaWdoO1xuXG4gICAgfVxuXG4gICAgLy8gaW50ZXJ2YWwgZnJvbSBsZWZ0L3JpZ2h0XG4gICAgbGV0IGxvdyA9IGVuZHBvaW50LmZsaXAocmVzdWx0LmxlZnQpO1xuICAgIGxldCBoaWdoID0gZW5kcG9pbnQuZmxpcChyZXN1bHQucmlnaHQpO1xuICAgIHJlc3VsdC5pdHYgPSBpbnRlcnZhbC5mcm9tX2VuZHBvaW50cyhsb3csIGhpZ2gpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuXG4vKipcbiAqIENyZWF0ZSBhIE5lYXJieUluZGV4IGZvciBhIHNyYyBvYmplY3QgTGF5ZXIuXG4gKiBcbiAqIFRoZSBzcmMgb2JqZWN0IHJlc29sdmVzIHF1ZXJpZXMgZm9yIHRoZSBlbnRpcmUgdGltZWxpbmUuXG4gKiBJbiBvcmRlciBmb3IgdGhlIGRlZmF1bHQgTGF5ZXJDYWNoZSB0byB3b3JrLCBhblxuICogb2JqZWN0IHdpdGggYSAucXVlcnkob2Zmc2V0KSBtZXRob2QgaXMgbmVlZGVkIGluIFxuICogbmVhcmJ5LmNlbnRlci5cbiAqL1xuXG5leHBvcnQgY2xhc3MgTmVhcmJ5SW5kZXhTcmMgZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Ioc3JjKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX3NyYyA9IHNyYztcbiAgICAgICAgdGhpcy5fY2FjaGUgPSBzcmMuY3JlYXRlQ2FjaGUoKTtcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IG5lYXJieSA9IHRoaXMuX3NyYy5pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgbmVhcmJ5LmNlbnRlciA9IFt0aGlzLl9jYWNoZV07XG4gICAgICAgIHJldHVybiBuZWFyYnk7XG4gICAgfVxufVxuIiwiLypcblx0Q29weXJpZ2h0IDIwMjBcblx0QXV0aG9yIDogSW5nYXIgQXJudHplblxuXG5cdFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUaW1pbmdzcmMgbW9kdWxlLlxuXG5cdFRpbWluZ3NyYyBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG5cdGl0IHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieVxuXHR0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvclxuXHQoYXQgeW91ciBvcHRpb24pIGFueSBsYXRlciB2ZXJzaW9uLlxuXG5cdFRpbWluZ3NyYyBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLFxuXHRidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7IHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZlxuXHRNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG5cdEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuXG5cdFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZVxuXHRhbG9uZyB3aXRoIFRpbWluZ3NyYy4gIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiovXG5cblxuXG4vKlxuXHRFdmVudFxuXHQtIG5hbWU6IGV2ZW50IG5hbWVcblx0LSBwdWJsaXNoZXI6IHRoZSBvYmplY3Qgd2hpY2ggZGVmaW5lZCB0aGUgZXZlbnRcblx0LSBpbml0OiB0cnVlIGlmIHRoZSBldmVudCBzdXBwcG9ydHMgaW5pdCBldmVudHNcblx0LSBzdWJzY3JpcHRpb25zOiBzdWJzY3JpcHRpbnMgdG8gdGhpcyBldmVudFxuXG4qL1xuXG5jbGFzcyBFdmVudCB7XG5cblx0Y29uc3RydWN0b3IgKHB1Ymxpc2hlciwgbmFtZSwgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5wdWJsaXNoZXIgPSBwdWJsaXNoZXI7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gZmFsc2UgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zID0gW107XG5cdH1cblxuXHQvKlxuXHRcdHN1YnNjcmliZSB0byBldmVudFxuXHRcdC0gc3Vic2NyaWJlcjogc3Vic2NyaWJpbmcgb2JqZWN0XG5cdFx0LSBjYWxsYmFjazogY2FsbGJhY2sgZnVuY3Rpb24gdG8gaW52b2tlXG5cdFx0LSBvcHRpb25zOlxuXHRcdFx0aW5pdDogaWYgdHJ1ZSBzdWJzY3JpYmVyIHdhbnRzIGluaXQgZXZlbnRzXG5cdCovXG5cdHN1YnNjcmliZSAoY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRpZiAoIWNhbGxiYWNrIHx8IHR5cGVvZiBjYWxsYmFjayAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayBub3QgYSBmdW5jdGlvblwiLCBjYWxsYmFjayk7XG5cdFx0fVxuXHRcdGNvbnN0IHN1YiA9IG5ldyBTdWJzY3JpcHRpb24odGhpcywgY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5wdXNoKHN1Yik7XG5cdCAgICAvLyBJbml0aWF0ZSBpbml0IGNhbGxiYWNrIGZvciB0aGlzIHN1YnNjcmlwdGlvblxuXHQgICAgaWYgKHRoaXMuaW5pdCAmJiBzdWIuaW5pdCkge1xuXHQgICAgXHRzdWIuaW5pdF9wZW5kaW5nID0gdHJ1ZTtcblx0ICAgIFx0bGV0IHNlbGYgPSB0aGlzO1xuXHQgICAgXHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgIFx0XHRjb25zdCBlQXJncyA9IHNlbGYucHVibGlzaGVyLmV2ZW50aWZ5SW5pdEV2ZW50QXJncyhzZWxmLm5hbWUpIHx8IFtdO1xuXHQgICAgXHRcdHN1Yi5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0ICAgIFx0XHRmb3IgKGxldCBlQXJnIG9mIGVBcmdzKSB7XG5cdCAgICBcdFx0XHRzZWxmLnRyaWdnZXIoZUFyZywgW3N1Yl0sIHRydWUpO1xuXHQgICAgXHRcdH1cblx0ICAgIFx0fSk7XG5cdCAgICB9XG5cdFx0cmV0dXJuIHN1YlxuXHR9XG5cblx0Lypcblx0XHR0cmlnZ2VyIGV2ZW50XG5cblx0XHQtIGlmIHN1YiBpcyB1bmRlZmluZWQgLSBwdWJsaXNoIHRvIGFsbCBzdWJzY3JpcHRpb25zXG5cdFx0LSBpZiBzdWIgaXMgZGVmaW5lZCAtIHB1Ymxpc2ggb25seSB0byBnaXZlbiBzdWJzY3JpcHRpb25cblx0Ki9cblx0dHJpZ2dlciAoZUFyZywgc3VicywgaW5pdCkge1xuXHRcdGxldCBlSW5mbywgY3R4O1xuXHRcdGZvciAoY29uc3Qgc3ViIG9mIHN1YnMpIHtcblx0XHRcdC8vIGlnbm9yZSB0ZXJtaW5hdGVkIHN1YnNjcmlwdGlvbnNcblx0XHRcdGlmIChzdWIudGVybWluYXRlZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGVJbmZvID0ge1xuXHRcdFx0XHRzcmM6IHRoaXMucHVibGlzaGVyLFxuXHRcdFx0XHRuYW1lOiB0aGlzLm5hbWUsXG5cdFx0XHRcdHN1Yjogc3ViLFxuXHRcdFx0XHRpbml0OiBpbml0XG5cdFx0XHR9XG5cdFx0XHRjdHggPSBzdWIuY3R4IHx8IHRoaXMucHVibGlzaGVyO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0c3ViLmNhbGxiYWNrLmNhbGwoY3R4LCBlQXJnLCBlSW5mbyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYEVycm9yIGluICR7dGhpcy5uYW1lfTogJHtzdWIuY2FsbGJhY2t9ICR7ZXJyfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qXG5cdHVuc3Vic2NyaWJlIGZyb20gZXZlbnRcblx0LSB1c2Ugc3Vic2NyaXB0aW9uIHJldHVybmVkIGJ5IHByZXZpb3VzIHN1YnNjcmliZVxuXHQqL1xuXHR1bnN1YnNjcmliZShzdWIpIHtcblx0XHRsZXQgaWR4ID0gdGhpcy5zdWJzY3JpcHRpb25zLmluZGV4T2Yoc3ViKTtcblx0XHRpZiAoaWR4ID4gLTEpIHtcblx0XHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdHN1Yi50ZXJtaW5hdGUoKTtcblx0XHR9XG5cdH1cbn1cblxuXG4vKlxuXHRTdWJzY3JpcHRpb24gY2xhc3NcbiovXG5cbmNsYXNzIFN1YnNjcmlwdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoZXZlbnQsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLmV2ZW50ID0gZXZlbnQ7XG5cdFx0dGhpcy5uYW1lID0gZXZlbnQubmFtZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2tcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gdGhpcy5ldmVudC5pbml0IDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gZmFsc2U7XG5cdFx0dGhpcy5jdHggPSBvcHRpb25zLmN0eDtcblx0fVxuXG5cdHRlcm1pbmF0ZSgpIHtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSB0cnVlO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5ldmVudC51bnN1YnNjcmliZSh0aGlzKTtcblx0fVxufVxuXG5cbi8qXG5cblx0RVZFTlRJRlkgSU5TVEFOQ0VcblxuXHRFdmVudGlmeSBicmluZ3MgZXZlbnRpbmcgY2FwYWJpbGl0aWVzIHRvIGFueSBvYmplY3QuXG5cblx0SW4gcGFydGljdWxhciwgZXZlbnRpZnkgc3VwcG9ydHMgdGhlIGluaXRpYWwtZXZlbnQgcGF0dGVybi5cblx0T3B0LWluIGZvciBpbml0aWFsIGV2ZW50cyBwZXIgZXZlbnQgdHlwZS5cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlJbnN0YW5jZSAob2JqZWN0KSB7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwID0gbmV3IE1hcCgpO1xuXHRvYmplY3QuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0cmV0dXJuIG9iamVjdDtcbn07XG5cblxuLypcblx0RVZFTlRJRlkgUFJPVE9UWVBFXG5cblx0QWRkIGV2ZW50aWZ5IGZ1bmN0aW9uYWxpdHkgdG8gcHJvdG90eXBlIG9iamVjdFxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5UHJvdG90eXBlKF9wcm90b3R5cGUpIHtcblxuXHRmdW5jdGlvbiBldmVudGlmeUdldEV2ZW50KG9iamVjdCwgbmFtZSkge1xuXHRcdGNvbnN0IGV2ZW50ID0gb2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAuZ2V0KG5hbWUpO1xuXHRcdGlmIChldmVudCA9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IHVuZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0cmV0dXJuIGV2ZW50O1xuXHR9XG5cblx0Lypcblx0XHRERUZJTkUgRVZFTlRcblx0XHQtIHVzZWQgb25seSBieSBldmVudCBzb3VyY2Vcblx0XHQtIG5hbWU6IG5hbWUgb2YgZXZlbnRcblx0XHQtIG9wdGlvbnM6IHtpbml0OnRydWV9IHNwZWNpZmllcyBpbml0LWV2ZW50IHNlbWFudGljcyBmb3IgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlEZWZpbmUobmFtZSwgb3B0aW9ucykge1xuXHRcdC8vIGNoZWNrIHRoYXQgZXZlbnQgZG9lcyBub3QgYWxyZWFkeSBleGlzdFxuXHRcdGlmICh0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuaGFzKG5hbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCBhbHJlYWR5IGRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5zZXQobmFtZSwgbmV3IEV2ZW50KHRoaXMsIG5hbWUsIG9wdGlvbnMpKTtcblx0fTtcblxuXHQvKlxuXHRcdE9OXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRyZWdpc3RlciBjYWxsYmFjayBvbiBldmVudC5cblx0Ki9cblx0ZnVuY3Rpb24gb24obmFtZSwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpYmUoY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T0ZGXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRVbi1yZWdpc3RlciBhIGhhbmRsZXIgZnJvbSBhIHNwZWNmaWMgZXZlbnQgdHlwZVxuXHQqL1xuXHRmdW5jdGlvbiBvZmYoc3ViKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgc3ViLm5hbWUpLnVuc3Vic2NyaWJlKHN1Yik7XG5cdH07XG5cblxuXHRmdW5jdGlvbiBldmVudGlmeVN1YnNjcmlwdGlvbnMobmFtZSkge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmlwdGlvbnM7XG5cdH1cblxuXG5cblx0Lypcblx0XHRUcmlnZ2VyIGxpc3Qgb2YgZXZlbnRJdGVtcyBvbiBvYmplY3RcblxuXHRcdGV2ZW50SXRlbTogIHtuYW1lOi4uLCBlQXJnOi4ufVxuXG5cdFx0Y29weSBhbGwgZXZlbnRJdGVtcyBpbnRvIGJ1ZmZlci5cblx0XHRyZXF1ZXN0IGVtcHR5aW5nIHRoZSBidWZmZXIsIGkuZS4gYWN0dWFsbHkgdHJpZ2dlcmluZyBldmVudHMsXG5cdFx0ZXZlcnkgdGltZSB0aGUgYnVmZmVyIGdvZXMgZnJvbSBlbXB0eSB0byBub24tZW1wdHlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxsKGV2ZW50SXRlbXMpIHtcblx0XHRpZiAoZXZlbnRJdGVtcy5sZW5ndGggPT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIG1ha2UgdHJpZ2dlciBpdGVtc1xuXHRcdC8vIHJlc29sdmUgbm9uLXBlbmRpbmcgc3Vic2NyaXB0aW9ucyBub3dcblx0XHQvLyBlbHNlIHN1YnNjcmlwdGlvbnMgbWF5IGNoYW5nZSBmcm9tIHBlbmRpbmcgdG8gbm9uLXBlbmRpbmdcblx0XHQvLyBiZXR3ZWVuIGhlcmUgYW5kIGFjdHVhbCB0cmlnZ2VyaW5nXG5cdFx0Ly8gbWFrZSBsaXN0IG9mIFtldiwgZUFyZywgc3Vic10gdHVwbGVzXG5cdFx0bGV0IHRyaWdnZXJJdGVtcyA9IGV2ZW50SXRlbXMubWFwKChpdGVtKSA9PiB7XG5cdFx0XHRsZXQge25hbWUsIGVBcmd9ID0gaXRlbTtcblx0XHRcdGxldCBldiA9IGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSk7XG5cdFx0XHRsZXQgc3VicyA9IGV2LnN1YnNjcmlwdGlvbnMuZmlsdGVyKHN1YiA9PiBzdWIuaW5pdF9wZW5kaW5nID09IGZhbHNlKTtcblx0XHRcdHJldHVybiBbZXYsIGVBcmcsIHN1YnNdO1xuXHRcdH0sIHRoaXMpO1xuXG5cdFx0Ly8gYXBwZW5kIHRyaWdnZXIgSXRlbXMgdG8gYnVmZmVyXG5cdFx0Y29uc3QgbGVuID0gdHJpZ2dlckl0ZW1zLmxlbmd0aDtcblx0XHRjb25zdCBidWYgPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyO1xuXHRcdGNvbnN0IGJ1Zl9sZW4gPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aDtcblx0XHQvLyByZXNlcnZlIG1lbW9yeSAtIHNldCBuZXcgbGVuZ3RoXG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGggPSBidWZfbGVuICsgbGVuO1xuXHRcdC8vIGNvcHkgdHJpZ2dlckl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGZvciAobGV0IGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0YnVmW2J1Zl9sZW4raV0gPSB0cmlnZ2VySXRlbXNbaV07XG5cdFx0fVxuXHRcdC8vIHJlcXVlc3QgZW1wdHlpbmcgb2YgdGhlIGJ1ZmZlclxuXHRcdGlmIChidWZfbGVuID09IDApIHtcblx0XHRcdGxldCBzZWxmID0gdGhpcztcblx0XHRcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGZvciAobGV0IFtldiwgZUFyZywgc3Vic10gb2Ygc2VsZi5fX2V2ZW50aWZ5X2J1ZmZlcikge1xuXHRcdFx0XHRcdC8vIGFjdHVhbCBldmVudCB0cmlnZ2VyaW5nXG5cdFx0XHRcdFx0ZXYudHJpZ2dlcihlQXJnLCBzdWJzLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZi5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIG11bHRpcGxlIGV2ZW50cyBvZiBzYW1lIHR5cGUgKG5hbWUpXG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsaWtlKG5hbWUsIGVBcmdzKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKGVBcmdzLm1hcChlQXJnID0+IHtcblx0XHRcdHJldHVybiB7bmFtZSwgZUFyZ307XG5cdFx0fSkpO1xuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIHNpbmdsZSBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXIobmFtZSwgZUFyZykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChbe25hbWUsIGVBcmd9XSk7XG5cdH1cblxuXHRfcHJvdG90eXBlLmV2ZW50aWZ5RGVmaW5lID0gZXZlbnRpZnlEZWZpbmU7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyID0gZXZlbnRpZnlUcmlnZ2VyO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsaWtlID0gZXZlbnRpZnlUcmlnZ2VyQWxpa2U7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxsID0gZXZlbnRpZnlUcmlnZ2VyQWxsO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5U3Vic2NyaXB0aW9ucyA9IGV2ZW50aWZ5U3Vic2NyaXB0aW9ucztcblx0X3Byb3RvdHlwZS5vbiA9IG9uO1xuXHRfcHJvdG90eXBlLm9mZiA9IG9mZjtcbn07XG5cblxuZXhwb3J0IHtldmVudGlmeUluc3RhbmNlIGFzIGFkZFN0YXRlfTtcbmV4cG9ydCB7ZXZlbnRpZnlQcm90b3R5cGUgYXMgYWRkTWV0aG9kc307XG5cbi8qXG5cdEV2ZW50IFZhcmlhYmxlXG5cblx0T2JqZWN0cyB3aXRoIGEgc2luZ2xlIFwiY2hhbmdlXCIgZXZlbnRcbiovXG5cbmV4cG9ydCBjbGFzcyBFdmVudFZhcmlhYmxlIHtcblxuXHRjb25zdHJ1Y3RvciAodmFsdWUpIHtcblx0XHRldmVudGlmeUluc3RhbmNlKHRoaXMpO1xuXHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0dGhpcy5ldmVudGlmeURlZmluZShcImNoYW5nZVwiLCB7aW5pdDp0cnVlfSk7XG5cdH1cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG5cdGdldCB2YWx1ZSAoKSB7cmV0dXJuIHRoaXMuX3ZhbHVlfTtcblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdGlmICh2YWx1ZSAhPSB0aGlzLl92YWx1ZSkge1xuXHRcdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHRcdHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHZhbHVlKTtcblx0XHR9XG5cdH1cbn1cbmV2ZW50aWZ5UHJvdG90eXBlKEV2ZW50VmFyaWFibGUucHJvdG90eXBlKTtcblxuLypcblx0RXZlbnQgQm9vbGVhblxuXG5cblx0Tm90ZSA6IGltcGxlbWVudGF0aW9uIHVzZXMgZmFsc2luZXNzIG9mIGlucHV0IHBhcmFtZXRlciB0byBjb25zdHJ1Y3RvciBhbmQgc2V0KCkgb3BlcmF0aW9uLFxuXHRzbyBldmVudEJvb2xlYW4oLTEpIHdpbGwgYWN0dWFsbHkgc2V0IGl0IHRvIHRydWUgYmVjYXVzZVxuXHQoLTEpID8gdHJ1ZSA6IGZhbHNlIC0+IHRydWUgIVxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50Qm9vbGVhbiBleHRlbmRzIEV2ZW50VmFyaWFibGUge1xuXHRjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuXHRcdHN1cGVyKEJvb2xlYW4odmFsdWUpKTtcblx0fVxuXG5cdHNldCB2YWx1ZSAodmFsdWUpIHtcblx0XHRzdXBlci52YWx1ZSA9IEJvb2xlYW4odmFsdWUpO1xuXHR9XG5cdGdldCB2YWx1ZSAoKSB7cmV0dXJuIHN1cGVyLnZhbHVlfTtcbn1cblxuXG4vKlxuXHRtYWtlIGEgcHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aGVuIEV2ZW50Qm9vbGVhbiBjaGFuZ2VzXG5cdHZhbHVlLlxuKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWtlUHJvbWlzZShldmVudE9iamVjdCwgY29uZGl0aW9uRnVuYykge1xuXHRjb25kaXRpb25GdW5jID0gY29uZGl0aW9uRnVuYyB8fCBmdW5jdGlvbih2YWwpIHtyZXR1cm4gdmFsID09IHRydWV9O1xuXHRyZXR1cm4gbmV3IFByb21pc2UgKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0XHRsZXQgc3ViID0gZXZlbnRPYmplY3Qub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHRpZiAoY29uZGl0aW9uRnVuYyh2YWx1ZSkpIHtcblx0XHRcdFx0cmVzb2x2ZSh2YWx1ZSk7XG5cdFx0XHRcdGV2ZW50T2JqZWN0Lm9mZihzdWIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcbn07XG5cbi8vIG1vZHVsZSBhcGlcbmV4cG9ydCBkZWZhdWx0IHtcblx0ZXZlbnRpZnlQcm90b3R5cGUsXG5cdGV2ZW50aWZ5SW5zdGFuY2UsXG5cdEV2ZW50VmFyaWFibGUsXG5cdEV2ZW50Qm9vbGVhbixcblx0bWFrZVByb21pc2Vcbn07XG5cbiIsIi8qXG4gICAgVGhpcyBkZWNvcmF0ZXMgYW4gb2JqZWN0L3Byb3RvdHlwZSB3aXRoIGJhc2ljIChzeW5jaHJvbm91cykgY2FsbGJhY2sgc3VwcG9ydC5cbiovXG5cbmNvbnN0IFBSRUZJWCA9IFwiX19jYWxsYmFja1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gYWRkU3RhdGUob2JqZWN0KSB7XG4gICAgb2JqZWN0W2Ake1BSRUZJWH1faGFuZGxlcnNgXSA9IFtdO1xufVxuXG5mdW5jdGlvbiBhZGRfY2FsbGJhY2sgKGhhbmRsZXIpIHtcbiAgICBsZXQgaGFuZGxlID0ge1xuICAgICAgICBoYW5kbGVyOiBoYW5kbGVyXG4gICAgfVxuICAgIHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLnB1c2goaGFuZGxlKTtcbiAgICByZXR1cm4gaGFuZGxlO1xufTtcblxuZnVuY3Rpb24gcmVtb3ZlX2NhbGxiYWNrIChoYW5kbGUpIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5pbmRleE9mKGhhbmRsZSk7XG4gICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBub3RpZnlfY2FsbGJhY2tzIChlQXJnKSB7XG4gICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uZm9yRWFjaChmdW5jdGlvbihoYW5kbGUpIHtcbiAgICAgICAgaGFuZGxlLmhhbmRsZXIoZUFyZyk7XG4gICAgfSk7XG59O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRNZXRob2RzIChvYmopIHtcbiAgICBjb25zdCBhcGkgPSB7XG4gICAgICAgIGFkZF9jYWxsYmFjaywgcmVtb3ZlX2NhbGxiYWNrLCBub3RpZnlfY2FsbGJhY2tzXG4gICAgfVxuICAgIE9iamVjdC5hc3NpZ24ob2JqLCBhcGkpO1xufVxuXG4vKipcbiAqIHRlc3QgaWYgb2JqZWN0IGltcGxlbWVudHMgY2FsbGJhY2sgYXBpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc19jYWxsYmFja19hcGkgKG9iaikge1xuICAgIGlmIChvYmogPT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgbWV0aG9kcyA9IFtcImFkZF9jYWxsYmFja1wiLCBcInJlbW92ZV9jYWxsYmFja1wiXTtcbiAgICBmb3IgKGNvbnN0IHByb3Agb2YgbWV0aG9kcykge1xuICAgICAgICBpZiAoIShwcm9wIGluIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKHR5cGVvZiBvYmpbcHJvcF0gIT0gJ2Z1bmN0aW9uJykgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn1cbiIsImltcG9ydCB7IGVuZHBvaW50LCBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFsc1wiO1xuXG5cbi8vIG92dmVycmlkZSBtb2R1bG8gdG8gYmVoYXZlIGJldHRlciBmb3IgbmVnYXRpdmUgbnVtYmVyc1xuZXhwb3J0IGZ1bmN0aW9uIG1vZChuLCBtKSB7XG4gICAgcmV0dXJuICgobiAlIG0pICsgbSkgJSBtO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRpdm1vZCh4LCBiYXNlKSB7XG4gICAgbGV0IG4gPSBNYXRoLmZsb29yKHggLyBiYXNlKVxuICAgIGxldCByID0gbW9kKHgsIGJhc2UpO1xuICAgIHJldHVybiBbbiwgcl07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc19maW5pdGVfbnVtYmVyKG9iaikge1xuICAgIHJldHVybiAodHlwZW9mIG9iaiA9PSAnbnVtYmVyJykgJiYgaXNGaW5pdGUob2JqKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrX251bWJlcihuYW1lLCBvYmopIHtcbiAgICBpZiAoIWlzX2Zpbml0ZV9udW1iZXIob2JqKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7bmFtZX0gbXVzdCBiZSBmaW5pdGUgbnVtYmVyICR7b2JqfWApO1xuICAgIH1cbn1cblxuLyoqXG4gKiBjb252ZW5pZW5jZSBmdW5jdGlvbiB0byByZW5kZXIgYSBjdXJzb3IgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJfY3Vyc29yIChjdXJzb3IsIHNlbGVjdG9yLCBvcHRpb25zPXt9KSB7XG4gICAgY29uc3Qge2RlbGF5PTIwMCwgcmVuZGVyLCBub3ZhbHVlfSA9IG9wdGlvbnM7XG4gICAgY29uc3QgZWxlbXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICBmdW5jdGlvbiBfcmVuZGVyKHN0YXRlKSB7XG4gICAgICAgIGlmIChzdGF0ZS52YWx1ZSA9PSB1bmRlZmluZWQgJiYgbm92YWx1ZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHN0YXRlLnZhbHVlID0gbm92YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVuZGVyICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmVuZGVyKHN0YXRlLCBlbGVtcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbGVtcy50ZXh0Q29udGVudCA9IChzdGF0ZS52YWx1ZSAhPSB1bmRlZmluZWQpID8gYCR7c3RhdGUudmFsdWV9YCA6IFwiXCI7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGN1cnNvci5iaW5kKF9yZW5kZXIsIGRlbGF5KTtcbn1cblxuXG5cblxuLypcbiAgICBzaW1pbGFyIHRvIHJhbmdlIGZ1bmN0aW9uIGluIHB5dGhvblxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmdlIChzdGFydCwgZW5kLCBzdGVwID0gMSwgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgIGNvbnN0IHtpbmNsdWRlX2VuZD1mYWxzZX0gPSBvcHRpb25zO1xuICAgIGlmIChzdGVwID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU3RlcCBjYW5ub3QgYmUgemVyby4nKTtcbiAgICB9XG4gICAgaWYgKHN0YXJ0IDwgZW5kKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSBzdGVwKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goaSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHN0YXJ0ID4gZW5kKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA+IGVuZDsgaSAtPSBzdGVwKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goaSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGluY2x1ZGVfZW5kKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGVuZCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cblxuLy8gd2VicGFnZSBjbG9jayAtIHBlcmZvcm1hbmNlIG5vdyAtIHNlY29uZHNcbmV4cG9ydCBjb25zdCBsb2NhbF9jbG9jayA9IGZ1bmN0aW9uIGxvY2FsX2Nsb2NrICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBub3c6ICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBwZXJmb3JtYW5jZS5ub3coKS8xMDAwLjA7XG4gICAgICAgIH1cbiAgICB9XG59KCk7XG5cbi8vIHN5c3RlbSBjbG9jayAtIGVwb2NoIC0gc2Vjb25kc1xuZXhwb3J0IGNvbnN0IGxvY2FsX2Vwb2NoID0gZnVuY3Rpb24gbG9jYWxfZXBvY2ggKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIG5vdzogKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBEYXRlKCkvMTAwMC4wO1xuICAgICAgICB9XG4gICAgfVxufSgpO1xuXG4vKipcbiAqIENyZWF0ZSBhIHNpbmdsZSBzdGF0ZSBmcm9tIGEgbGlzdCBvZiBzdGF0ZXMsIHVzaW5nIGEgdmFsdWVGdW5jXG4gKiBzdGF0ZTp7dmFsdWUsIGR5bmFtaWMsIG9mZnNldH1cbiAqIFxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiB0b1N0YXRlKHNvdXJjZXMsIHN0YXRlcywgb2Zmc2V0LCBvcHRpb25zPXt9KSB7XG4gICAgbGV0IHt2YWx1ZUZ1bmMsIHN0YXRlRnVuY30gPSBvcHRpb25zOyBcbiAgICBpZiAodmFsdWVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBsZXQgdmFsdWUgPSB2YWx1ZUZ1bmMoe3NvdXJjZXMsIHN0YXRlcywgb2Zmc2V0fSk7XG4gICAgICAgIGxldCBkeW5hbWljID0gc3RhdGVzLm1hcCgodikgPT4gdi5keW1hbWljKS5zb21lKGU9PmUpO1xuICAgICAgICByZXR1cm4ge3ZhbHVlLCBkeW5hbWljLCBvZmZzZXR9O1xuICAgIH0gZWxzZSBpZiAoc3RhdGVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gey4uLnN0YXRlRnVuYyh7c291cmNlcywgc3RhdGVzLCBvZmZzZXR9KSwgb2Zmc2V0fTtcbiAgICB9XG4gICAgLy8gbm8gdmFsdWVGdW5jIG9yIHN0YXRlRnVuY1xuICAgIGlmIChzdGF0ZXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTp1bmRlZmluZWQsIGR5bmFtaWM6ZmFsc2UsIG9mZnNldH1cbiAgICB9XG4gICAgLy8gZmFsbGJhY2sgLSBqdXN0IHVzZSBmaXJzdCBzdGF0ZVxuICAgIGxldCBzdGF0ZSA9IHN0YXRlc1swXTtcbiAgICByZXR1cm4gey4uLnN0YXRlLCBvZmZzZXR9OyBcbn1cblxuXG4vKipcbiAqIGNoZWNrIGlucHV0IGl0ZW1zIHRvIGxvY2FsIHN0YXRlIHByb3ZpZGVyc1xuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBjaGVja19pbnB1dChpdGVtcykge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShpdGVtcykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW5wdXQgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICB9XG4gICAgLy8gbWFrZSBzdXJlIHRoYXQgaW50ZXJ2YWxzIGFyZSB3ZWxsIGZvcm1lZFxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuICAgICAgICBpdGVtLml0diA9IGludGVydmFsLmZyb21faW5wdXQoaXRlbS5pdHYpO1xuICAgIH1cbiAgICAvLyBzb3J0IGl0ZW1zIGJhc2VkIG9uIGludGVydmFsIGxvdyBlbmRwb2ludFxuICAgIGl0ZW1zLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgbGV0IGFfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChhLml0dilbMF07XG4gICAgICAgIGxldCBiX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYi5pdHYpWzBdO1xuICAgICAgICByZXR1cm4gZW5kcG9pbnQuY21wKGFfbG93LCBiX2xvdyk7XG4gICAgfSk7XG4gICAgLy8gY2hlY2sgdGhhdCBpdGVtIGludGVydmFscyBhcmUgbm9uLW92ZXJsYXBwaW5nXG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBsZXQgcHJldl9oaWdoID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpIC0gMV0uaXR2KVsxXTtcbiAgICAgICAgbGV0IGN1cnJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpXS5pdHYpWzBdO1xuICAgICAgICAvLyB2ZXJpZnkgdGhhdCBwcmV2IGhpZ2ggaXMgbGVzcyB0aGF0IGN1cnIgbG93XG4gICAgICAgIGlmICghZW5kcG9pbnQubHQocHJldl9oaWdoLCBjdXJyX2xvdykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk92ZXJsYXBwaW5nIGludGVydmFscyBmb3VuZFwiKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmRvbV9zdHJpbmcobGVuZ3RoKSB7XG4gICAgdmFyIHRleHQgPSBcIlwiO1xuICAgIHZhciBwb3NzaWJsZSA9IFwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5elwiO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICB0ZXh0ICs9IHBvc3NpYmxlLmNoYXJBdChNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBwb3NzaWJsZS5sZW5ndGgpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRleHQ7XG59XG5cbi8qKlxuICogSW1wcm92ZWQgc2V0X3RpbWVvdXRcbiAqIFxuICogVGltZW91dCBpcyBkZWZpbmVkIGJ5IGEgdGFyZ2V0X21zIHJlYWRpbmcgb2YgcGVyZm9ybWFuY2Uubm93KCkuXG4gKiBDYWxsYmFjayBpcyBub3QgaW52b2tlZCB1bnRpbCBwZXJmb3JtYW5jZS5ub3coKSA+PSB0YXJnZXRfbXMuIFxuICogXG4gKiBUaGlzIHByb3RlY3RzIGFnYWluc3QgYSB3ZWFrbmVzcyBpbiBiYXNpYyBzZXRUaW1lb3V0LCB3aGljaCBtYXlcbiAqIG9jY2F0aW9uYWxseSBpbnZva2UgdGhlIGNhbGxiYWNrIHRvbyBlYXJseS4gXG4gKiBcbiAqIHNjaGVkdWxlIHRpbWVvdXQgMSBtcyBsYXRlLCB0byByZWR1Y2UgdGhlIGxpa2VsaWhvb2Qgb2YgXG4gKiBoYXZpbmcgdG8gcmVzY2hlZHVsZSBhIHRpbWVvdXQgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRfdGltZW91dCAoY2FsbGJhY2ssIGRlbHRhX21zKSB7XG4gICAgbGV0IHRzID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgZGVsdGFfbXMgPSBNYXRoLm1heChkZWx0YV9tcywgMCk7XG4gICAgbGV0IHRhcmdldF9tcyA9IHRzICsgZGVsdGFfbXM7XG4gICAgbGV0IHRpZDtcbiAgICBmdW5jdGlvbiBjYW5jZWxfdGltZW91dCgpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpZCk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGhhbmRsZV90aW1lb3V0KCkge1xuICAgICAgICBjb25zdCBkZWx0YV9tcyA9IHRhcmdldF9tcyAtIHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICBpZiAoZGVsdGFfbXMgPiAwKSB7XG4gICAgICAgICAgICAvLyByZXNjaGVkdWxlIHRpbWVvdXRcbiAgICAgICAgICAgIHRpZCA9IHNldFRpbWVvdXQoaGFuZGxlX3RpbWVvdXQsIGRlbHRhX21zICsgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHRpZCA9IHNldFRpbWVvdXQoaGFuZGxlX3RpbWVvdXQsIGRlbHRhX21zICsgMSk7XG4gICAgcmV0dXJuIHtjYW5jZWw6Y2FuY2VsX3RpbWVvdXR9O1xufVxuXG4vKipcbiAqICBJbXBsZW1lbnRzIGRldGVybWluaXN0aWMgcHJvamVjdGlvbiBiYXNlZCBvbiBpbml0aWFsIGNvbmRpdGlvbnMgXG4gKiAgLSBtb3Rpb24gdmVjdG9yIGRlc2NyaWJlcyBtb3Rpb24gdW5kZXIgY29uc3RhbnQgYWNjZWxlcmF0aW9uXG4gKlxuICogIG1vdGlvbiB0cmFuc2l0aW9uIFxuICogXG4gKiAgdHJhbnNpdGlvbiBmcm9tIHRpbWUgZG9tYWluIHRvIHBvc2l0aW9uIHVuZGVyIGNvbnN0YW50IGFjY2VsZXJhdGlvbiBpcyBnaXZlbiBieVxuICogIGdpdmVuIGluaXRpYWwgdmVjdG9yIFtwMCx2MCxhMCx0MF1cbiAqICBwKHQpID0gcDAgKyB2MCoodC10MCkgKyAwLjUqYTAqKHQtdDApKih0LXQwKVxuICogIHYodCkgPSB2MCArIGEwKih0LXQwKVxuICogIGEodCkgPSBhMFxuICogIHQodCkgPSB0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtb3Rpb25fY2FsY3VsYXRlKHZlY3Rvcix0KSB7XG4gICAgY29uc3QgW3AwLHYwLGEwLHQwXSA9IHZlY3RvcjtcbiAgICBjb25zdCBkID0gdCAtIHQwO1xuICAgIGNvbnN0IHAgPSBwMCArIHYwKmQgKyAwLjUqYTAqTWF0aC5wb3coZCwyKTtcbiAgICBjb25zdCB2ID0gdjAgKyBhMCpkO1xuICAgIGNvbnN0IGEgPSBhMDtcbiAgICByZXR1cm4gW3AsdixhLHRdO1xufVxuXG4vKipcbiAqIEdpdmVuIG1vdGlvbiBkZXRlcm1pbmVkIGZyb20gW3AwLHYwLGEwLHQwXS5cbiAqIEdpdmVuIGVxdWF0aW9uIHAodCkgPSBwMCArIHYwKih0LXQwKSArIDAuNSphMCoodC10MCleMiA9PSBwMVxuICogQ2FsY3VsYXRlIGlmIGVxdWF0aW9uIGhhcyBzb2x1dGlvbnMgZm9yIHNvbWUgcmVhbCBudW1iZXIgdC5cbiAqIEEgc29sdXRpb24gZXhpc3RzIGlmIGRldGVybWluYW50IG9mIHF1YWRyYXRpYyBlcXVhdGlvbiBpcyBub24tbmVnYXRpdmVcbiAqICh2MF4yIC0gMmEwKHAwLXAxKSkgPj0gMFxuICovXG5mdW5jdGlvbiBtb3Rpb25faGFzX3JlYWxfc29sdXRpb25zKHZlY3RvciwgcDEpIHtcbiAgICBjb25zdCBbcDAsdjAsYTAsdDBdID0gdmVjdG9yO1xuICAgIHJldHVybiAoTWF0aC5wb3codjAsMikgLSAyKmEwKihwMC1wMSkpID49IDAuMFxufTtcblxuLyoqXG4gKiBHaXZlbiBtb3Rpb24gZGV0ZXJtaW5lZCBmcm9tIFtwMCx2MCxhMCx0MF0uXG4gKiBHaXZlbiBlcXVhdGlvbiBwKHQpID0gcDAgKyB2MCoodC10MCkgKyAwLjUqYTAqKHQtdDApXjIgPT0gcDFcbiAqIENhbGN1bGF0ZSBhbmQgcmV0dXJuIHJlYWwgc29sdXRpb25zLCBpbiBhc2NlbmRpbmcgb3JkZXIuXG4qLyAgXG5mdW5jdGlvbiBtb3Rpb25fZ2V0X3JlYWxfc29sdXRpb25zICh2ZWN0b3IsIHAxKSB7XG4gICAgY29uc3QgW3AwLHYwLGEwLHQwXSA9IHZlY3RvcjtcbiAgICAvLyBDb25zdGFudCBQb3NpdGlvblxuICAgIGlmIChhMCA9PT0gMC4wICYmIHYwID09PSAwLjApIHtcbiAgICAgICAgaWYgKHAwICE9IHAxKSByZXR1cm4gW107XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgLy8gYW55IHQgaXMgYSBzb2x1dGlvblxuICAgICAgICAgICAgLy8gTk9URTogaGFzIHJlYWwgc29sdXRpb25zIGlzIHRydWVcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH07XG4gICAgfVxuICAgIC8vIENvbnN0YW50IG5vbi16ZXJvIFZlbG9jaXR5XG4gICAgaWYgKGEwID09PSAwLjApIHJldHVybiBbdDAgKyAocDEtcDApL3YwXTtcbiAgICAvLyBDb25zdGFudCBBY2NlbGVyYXRpb25cbiAgICBpZiAobW90aW9uX2hhc19yZWFsX3NvbHV0aW9ucyh2ZWN0b3IsIHAxKSA9PT0gZmFsc2UpIHJldHVybiBbXTtcbiAgICAvLyBFeGFjdGx5IG9uIHNvbHV0aW9uXG4gICAgdmFyIGRpc2NyaW1pbmFudCA9IE1hdGgucG93KHYwLDIpIC0gMiphMCoocDAtcDEpO1xuICAgIGlmIChkaXNjcmltaW5hbnQgPT09IDAuMCkge1xuICAgICAgICByZXR1cm4gW3QwLXYwL2EwXTtcbiAgICB9XG4gICAgdmFyIHNxcnQgPSBNYXRoLnNxcnQoTWF0aC5wb3codjAsMikgLSAyKmEwKihwMC1wMSkpO1xuICAgIHZhciBkMSA9IHQwICsgKC12MCArIHNxcnQpL2EwO1xuICAgIHZhciBkMiA9IHQwICsgKC12MCAtIHNxcnQpL2EwO1xuICAgIHJldHVybiBbTWF0aC5taW4oZDEsZDIpLE1hdGgubWF4KGQxLGQyKV07XG59O1xuXG4vKlxuICAgIGNhbGN1bGF0ZSB0aW1lIHJhbmdlIGZvciBnaXZlbiBwb3NpdGlvbiByYW5nZVxuXG4gICAgbW90aW9uIHRyYW5zaXRpb24gZnJvbSB0aW1lIHRvIHBvc2l0aW9uIGlzIGdpdmVuIGJ5XG4gICAgcCh0KSA9IHAwICsgdip0ICsgMC41KmEqdCp0XG4gICAgZmluZCBzb2x1dGlvbnMgZm9yIHQgc28gdGhhdCBcbiAgICBwKHQpID0gcG9zXG5cbiAgICBkbyB0aGlzIGZvciBib3RoIHZhbHVlcyBpbiByYW5nZSBbbG93LGhpZ2hdXG4gICAgYWNjdW11bGF0ZSBhbGwgY2FuZGlkYXRlIHNvbHV0aW9ucyB0IGluIGFzY2VuZGluZyBvcmRlclxuICAgIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICB0aGlzIGNhbiBhY2N1bXVsYXRlIDAsMSwyLDMsNCBzb2x1dGlvblxuICAgIGlmIDAgc29sdXRpb25zIC0gdW5kZWZpbmVkIChtb3Rpb24gZG9lcyBub3QgaW50ZXJzZWN0IHdpdGggcmFuZ2UgZXZlcikgXG4gICAgaWYgMSBzb2x1dGlvbnMgLSB1ZGVmaW5lZCAobW90aW9uIG9ubHkgaW50ZXJzZWN0cyB3aXRoIHJhbmdlIHRhbmdlbnRpYWxseSBhdCBvbmUgdClcbiAgICBpZiAyIHNvbHV0aW9ucyAtIFswLDFdIChtb3Rpb24gaW50ZXJzZWN0cyB3aXRoIHJhbmdlIGF0IHR3byB0aW1lcylcbiAgICBpZiAzIHNvbHV0aW9ucyAtIFswLDJdIChtb3Rpb24gaW50ZXJzZWN0cyB3aXRoIHJhbmdlIGF0IHRocmVlIHRpbWVzKVxuICAgIGlmIDQgc29sdXRpb25zIC0gWzAsMV0gYW5kIFsyLDNdXG5cbiAgICByZXR1cm5zIGEgbGlzdCBvZiByYW5nZSBjYW5kaWRhdGVzIChhdCBtb3N0IHR3byBidXQgb25seSB3aXRoIGFjY2VsZXJhdGlvbilcbiovXG5mdW5jdGlvbiBtb3Rpb25fY2FsY3VsYXRlX3RpbWVfcmFuZ2VzKHZlY3RvciwgcG9zX3JhbmdlKSB7XG4gICAgY29uc3QgW3AwLHYwLGEwLHQwXSA9IHZlY3RvcjtcbiAgICBsZXQgW2xvdywgaGlnaF0gPSBwb3NfcmFuZ2U7XG4gICAgaWYgKGxvdyA9PSBudWxsKSBsb3cgPSAtSW5maW5pdHk7XG4gICAgaWYgKGhpZ2ggPT0gbnVsbCkgaGlnaCA9IEluZmluaXR5O1xuXG4gICAgLy8gWzwtLCAtPl1cbiAgICBpZiAobG93ID09IC1JbmZpbml0eSAmJiBoaWdoID09IEluZmluaXR5KSB7XG4gICAgICAgIC8vIG5vIHBvcyByYW5nZSA9PSBlbnRpcmUgdmFsdWUgc3BhY2UgPT4gdGltZSByYW5nZSBlbnRpcmUgdGltZWxpbmVcbiAgICAgICAgcmV0dXJuIFtbbnVsbCwgbnVsbF1dO1xuICAgIH0gXG5cbiAgICAvLyBbRkxBVCBMSU5FXVxuICAgIC8vIHBvcyBpcyBlaXRoZXIgd2l0aGluIHBvcyByYW5nZSBmb3IgYWxsIHQgb3IgbmV2ZXIgIFxuICAgIGlmICh2MCA9PT0gMC4wICYmIGEwID09PSAwLjApIHtcbiAgICAgICAgLy8gYm90aCBsb3cgYW5kIGhpZ2ggYm91bmRcbiAgICAgICAgcmV0dXJuIChwMCA+PSBsb3cgJiYgcDAgPD0gaGlnaCkgPyBbW251bGwsIG51bGxdXSA6IFtdO1xuICAgIH1cblxuICAgIC8vIGFnZ3JlZ2F0ZSBzb2x1dGlvbnNcbiAgICBsZXQgc29sdXRpb25zID0gW107XG4gICAgaWYgKC1JbmZpbml0eSA8IGxvdykge1xuICAgICAgICBzb2x1dGlvbnMucHVzaCguLi5tb3Rpb25fZ2V0X3JlYWxfc29sdXRpb25zKHZlY3RvciwgbG93KSk7XG4gICAgfSBcbiAgICBpZiAoaGlnaCA8IEluZmluaXR5KSB7XG4gICAgICAgIHNvbHV0aW9ucy5wdXNoKC4uLm1vdGlvbl9nZXRfcmVhbF9zb2x1dGlvbnModmVjdG9yLCBoaWdoKSk7XG4gICAgfVxuICAgIC8vIHJlbW92ZSBkdXBsaWNhdGVzXG4gICAgc29sdXRpb25zID0gWy4uLm5ldyBTZXQoc29sdXRpb25zKV07XG4gICAgLy8gc29ydCBpbiBhc2NlbmRpbmcgb3JkZXJcbiAgICBzb2x1dGlvbnMuc29ydCgoYSxiKSA9PiBhLWIpO1xuXG4gICAgLy8gWzwtLCBISUdIXVxuICAgIGlmIChsb3cgPT0gLUluZmluaXR5KSB7XG4gICAgICAgIC8vIG9ubHkgaGlnaCBib3VuZFxuICAgICAgICBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAvLyBwYXJhYm9sYSBub3QgdG91Y2hpbmcgbG93XG4gICAgICAgICAgICAvLyBwb3MgPCBoaWdoIG9yIHBvcyA+IGhpZ2ggZm9yIGFsbCB0IC0ganVzdCB0ZXN0IHdpdGggdDBcbiAgICAgICAgICAgIHJldHVybiAocDAgPD0gaGlnaCkgPyBbW251bGwsIG51bGxdXSA6IFtdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNvbHV0aW9ucy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgaWYgKGEwID4gMC4wKSB7XG4gICAgICAgICAgICAgICAgLy8gcGFyYWJvbGEgLSB0b3VjaGluZyBoaWdoIGZyb20gb3ZlcnNpZGVcbiAgICAgICAgICAgICAgICAvLyBwb3MgPiBoaWdoIGZvciBhbGwgdFxuICAgICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYTAgPCAwLjApIHtcbiAgICAgICAgICAgICAgICAvLyBwYXJhYm9sYSB0b3VjaGluZyBsb3cgZnJvbSB1bmRlcnNpZGVcbiAgICAgICAgICAgICAgICAvLyBwb3MgPCBoaWdoIGZvciBhbGwgdFxuICAgICAgICAgICAgICAgIHJldHVybiBbW251bGwsIG51bGxdXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gYTAgPT0gMC4wID4gc3RyYWlndGggbGluZVxuICAgICAgICAgICAgICAgIGlmICh2MCA+IDAuMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBwb3MgPD0gaGlnaCBmb3IgYWxsIHQgPD0gc29sdXRpb25zWzBdXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBbW251bGwsIHNvbHV0aW9uc1swXV1dO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHBvcyA8PSBoaWdoIGZvciB0ID49IHNvbHV0aW9uc1swXVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW1tzb2x1dGlvbnNbMF0sIG51bGxdXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAvLyBwYXJhYm9sYVxuICAgICAgICAgICAgaWYgKGEwID4gMC4wKSB7XG4gICAgICAgICAgICAgICAgLy8gb25lIHRpbWUgcmFuZ2UgYmV0d2VlbiBzb2x1dGlvbnNcbiAgICAgICAgICAgICAgICByZXR1cm4gW1tzb2x1dGlvbnNbMF0sIHNvbHV0aW9uc1sxXV1dO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhMCA8IDAuMCkge1xuICAgICAgICAgICAgICAgIC8vIG9uZSB0aW1lIHJhbmdlIG9uIGVhY2ggc2lkZSBcbiAgICAgICAgICAgICAgICByZXR1cm4gW1tudWxsLCBzb2x1dGlvbnNbMF1dLCBbc29sdXRpb25zWzFdLCBudWxsXV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG4gICAgLy8gW0xPVywgLT5dXG4gICAgfSBlbHNlIGlmIChoaWdoID09IEluZmluaXR5KSB7XG4gICAgICAgIC8vIG9ubHkgbG93IGJvdW5kXG4gICAgICAgIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIC8vIHBhcmFib2xhIG5vdCB0b3VjaGluZyBsb3dcbiAgICAgICAgICAgIC8vIHBvcyA+IGxvdyBvciBwb3MgPCBsb3cgZm9yIGFsbCB0IC0ganVzdCB0ZXN0IHdpdGggdDBcbiAgICAgICAgICAgIHJldHVybiAocDAgPj0gbG93KSA/IFtbbnVsbCwgbnVsbF1dIDogW107XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICBpZiAoYTAgPiAwLjApIHtcbiAgICAgICAgICAgICAgICAvLyBwYXJhYm9sYSAtIHRvdWNoaW5nIGxvdyBmcm9tIG92ZXJzaWRlXG4gICAgICAgICAgICAgICAgLy8gcG9zID4gbG93IGZvciBhbGwgdFxuICAgICAgICAgICAgICAgIHJldHVybiBbW251bGwsIG51bGxdXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYTAgPCAwLjApIHtcbiAgICAgICAgICAgICAgICAvLyBwYXJhYm9sYSB0b3VjaGluZyBsb3cgZnJvbSB1bmRlcnNpZGVcbiAgICAgICAgICAgICAgICAvLyBwb3MgPCBsb3cgZm9yIGFsbCB0XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBhMCA9PSAwLjAgPiBzdHJhaWd0aCBsaW5lXG4gICAgICAgICAgICAgICAgaWYgKHYwID4gMC4wKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHBvcyA+PSBsb3cgZm9yIGFsbCB0ID49IHNvbHV0aW9uc1swXVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW1tzb2x1dGlvbnNbMF0sIG51bGxdXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBwb3MgPj0gbG93IGZvciB0IDw9IHNvbHV0aW9uc1swXVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW1tudWxsLCBzb2x1dGlvbnNbMF1dXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgICAgICAvLyBwYXJhYm9sYVxuICAgICAgICAgICAgaWYgKGEwID4gMC4wKSB7XG4gICAgICAgICAgICAgICAgLy8gb25lIHRpbWUgcmFuZ2Ugb24gZWFjaCBzaWRlIFxuICAgICAgICAgICAgICAgIHJldHVybiBbW251bGwsIHNvbHV0aW9uc1swXV0sIFtzb2x1dGlvbnNbMV0sIG51bGxdXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYTAgPCAwLjApIHtcbiAgICAgICAgICAgICAgICAvLyBvbmUgdGltZSByYW5nZSBiZXR3ZWVuIHNvbHV0aW9uc1xuICAgICAgICAgICAgICAgIHJldHVybiBbW3NvbHV0aW9uc1swXSwgc29sdXRpb25zWzFdXV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIC8vIFtMT1csIEhJR0hdXG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gYm90aCBsb3cgYW5kIGhpZ2ggYm91bmRcbiAgICAgICAgaWYgKHNvbHV0aW9ucy5sZW5ndGggPT0gMCkgcmV0dXJuIFtdO1xuICAgICAgICBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAxKSByZXR1cm4gW107XG4gICAgICAgIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDIpIHJldHVybiBbW3NvbHV0aW9uc1swXSwgc29sdXRpb25zWzFdXV07XG4gICAgICAgIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDMpIHJldHVybiBbW3NvbHV0aW9uc1swXSwgc29sdXRpb25zWzJdXV07XG4gICAgICAgIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDQpIHJldHVybiBbW3NvbHV0aW9uc1swXSwgc29sdXRpb25zWzFdXSwgW3NvbHV0aW9uc1syXSwgc29sdXRpb25zWzNdXV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBtb3Rpb25fY2hlY2tfcmFuZ2Uob2JqKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSAmJiBvYmoubGVuZ3RoICE9IDIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGByYW5nZSBtdXN0IGhhdmUgdHdvIGVsZW1lbnRzICR7b2JqfWApO1xuICAgIH1cbiAgICBvYmpbMF0gPT0gbnVsbCB8fCBjaGVja19udW1iZXIoXCJsb3dcIiwgb2JqWzBdKTtcbiAgICBvYmpbMV0gPT0gbnVsbCB8fCBjaGVja19udW1iZXIoXCJoaWdoXCIsIG9ialsxXSk7XG59XG5cbmV4cG9ydCBjb25zdCBtb3Rpb25fdXRpbHMgPSB7XG4gICAgY2FsY3VsYXRlOiBtb3Rpb25fY2FsY3VsYXRlLFxuICAgIGhhc19yZWFsX3NvbHV0aW9uczogbW90aW9uX2hhc19yZWFsX3NvbHV0aW9ucyxcbiAgICBnZXRfcmVhbF9zb2x1dGlvbnM6IG1vdGlvbl9nZXRfcmVhbF9zb2x1dGlvbnMsXG4gICAgY2FsY3VsYXRlX3RpbWVfcmFuZ2VzOiBtb3Rpb25fY2FsY3VsYXRlX3RpbWVfcmFuZ2VzLFxuICAgIGNoZWNrX3JhbmdlOiBtb3Rpb25fY2hlY2tfcmFuZ2Vcbn1cbiIsImltcG9ydCAqIGFzIGV2ZW50aWZ5IGZyb20gXCIuL3V0aWwvYXBpX2V2ZW50aWZ5LmpzXCI7XG5pbXBvcnQgKiBhcyBjYWxsYmFjayBmcm9tIFwiLi91dGlsL2FwaV9jYWxsYmFjay5qc1wiO1xuaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi91dGlsL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgcmFuZ2UsIHRvU3RhdGUgfSBmcm9tIFwiLi91dGlsL2NvbW1vbi5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMYXllciBpcyBhYnN0cmFjdCBiYXNlIGNsYXNzIGZvciBMYXllcnNcbiAqIFxuICogTGF5ZXIgaW50ZXJmYWNlIGlzIGRlZmluZWQgYnkgKGluZGV4LCBDYWNoZUNsYXNzLCBvcHRpb25zKVxuICogXG4gKiBDYWNoZUNsYXNzXG4gKiAtLS0tLS0tLS0tXG4gKiBUaGUgQ2FjaGVDbGFzcyBpbXBsZW1lbnRzIHRoZSBxdWVyeSBvcGVyYXRpb24gZm9yIHRoZSBsYXllciwgdXNpbmdcbiAqIHRoZSBpbmRleCBmb3IgbG9va3VwcyBvbiBjYWNoZSBtaXNzLiBMYXllciBoYXMgYSBwcml2YXRlIGNhY2hlLiBcbiAqIEFkZGl0aW9uYWxseSwgaWYgbGF5ZXIgaGFzIG11bHRpcGxlIGNvbnN1bWVycywgdGhleSBjYW4gZWFjaCBcbiAqIGNyZWF0ZSB0aGVpciBvd24gcHJpdmF0ZSBjYWNoZS4gXG4gKiBcbiAqIG9wdGlvbnNcbiAqIC0tLS0tLS1cbiAqIFRoZSB0aGUgcmVzdWx0IGZyb20gdGhlIHF1ZXJ5IG9wZXJhdGlvbiBjYW4gYmUgY29udHJvbGxlZCBieSBzdXBwbHlpbmdcbiAqIG9wdGlvbmFsIGN1c3RvbSBmdW5jdGlvbiwgZWl0aGVyIHZhbHVlRnVuYyBvciBhIHN0YXRlRnVuYyBcbiAqIHt2YWx1ZUZ1bmMsc3RhdGVGdW5jfVxuICogXG4gKiBpbmRleFxuICogLS0tLS1cbiAqIFRoZSBuZWFyYnkgaW5kZXggaXMgc3VwcGxpZWQgYnkgTGF5ZXIgaW1wbGVtZW50YXRpb25zLCBlaXRoZXIgYnkgXG4gKiBzdWJjbGFzc2luZyBpdCwgb3IgYnkgYXNzaWduaW5nIHRoZSBpbmRleC4gXG4gKi9cblxuZXhwb3J0IGNsYXNzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcblxuICAgICAgICBsZXQge0NhY2hlQ2xhc3M9TGF5ZXJDYWNoZSwgLi4ub3B0c30gPSBvcHRpb25zOyBcblxuICAgICAgICAvLyBsYXllciBvcHRpb25zXG4gICAgICAgIHRoaXMuX29wdGlvbnMgPSBvcHRzO1xuXG4gICAgICAgIC8vIGNhbGxiYWNrc1xuICAgICAgICBjYWxsYmFjay5hZGRTdGF0ZSh0aGlzKTtcbiAgICAgICAgLy8gZGVmaW5lIGNoYW5nZSBldmVudFxuICAgICAgICBldmVudGlmeS5hZGRTdGF0ZSh0aGlzKTtcbiAgICAgICAgdGhpcy5ldmVudGlmeURlZmluZShcImNoYW5nZVwiLCB7aW5pdDp0cnVlfSk7XG5cbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgdGhpcy5pbmRleDtcblxuICAgICAgICAvLyBjYWNoZVxuICAgICAgICB0aGlzLl9DYWNoZUNsYXNzID0gQ2FjaGVDbGFzcztcbiAgICAgICAgdGhpcy5fcHJpdmF0ZV9jYWNoZTtcbiAgICAgICAgdGhpcy5fY29uc3VtZXJfY2FjaGVzID0gW107XG4gICAgfVxuXG4gICAgLy8gbGF5ZXIgb3B0aW9uc1xuICAgIGdldCBvcHRpb25zICgpIHsgcmV0dXJuIHRoaXMuX29wdGlvbnM7IH1cblxuICAgIC8vIHByaXZhdGUgY2FjaGVcbiAgICBnZXQgY2FjaGUgKCkge1xuICAgICAgICBpZiAodGhpcy5fcHJpdmF0ZV9jYWNoZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3ByaXZhdGVfY2FjaGUgPSBuZXcgdGhpcy5fQ2FjaGVDbGFzcyh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fcHJpdmF0ZV9jYWNoZTtcbiAgICB9XG5cbiAgICAvLyBpbnZva2VkIGJ5IGxheWVyIGNvbnN1bWVyXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhY2hlLnF1ZXJ5KG9mZnNldCk7XG4gICAgfVxuXG4gICAgLy8gaW52b2tlZCBieSBsYXllciBjb25zdW1lclxuICAgIGNyZWF0ZUNhY2hlICgpIHtcbiAgICAgICAgY29uc3QgY2FjaGUgPSBuZXcgdGhpcy5fQ2FjaGVDbGFzcyh0aGlzKTtcbiAgICAgICAgdGhpcy5fY29uc3VtZXJfY2FjaGVzLnB1c2goY2FjaGUpO1xuICAgICAgICByZXR1cm4gY2FjaGU7XG4gICAgfVxuICAgIHJlbGVhc2VDYWNoZSAoY2FjaGUpIHtcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5fY29uc3VtZXJfY2FjaGVzLmluZGV4T2YoY2FjaGUpO1xuICAgICAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbnN1bWVyX2NhY2hlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgY2xlYXJDYWNoZXMoKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2FjaGUgb2YgdGhpcy5fY29uc3VtZXJfY2FjaGVzKXtcbiAgICAgICAgICAgIGNhY2hlLmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX3ByaXZhdGVfY2FjaGUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9wcml2YXRlX2NhY2hlLmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpbnZva2VkIGJ5IHN1YmNsYXNzIHdoZW5ldmVyIGxheWVyIGhhcyBjaGFuZ2VkXG4gICAgb25jaGFuZ2UoKSB7XG4gICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIpOyAgICBcbiAgICB9XG5cbiAgICAvLyBpdGVyYXRvciBmb3IgcmVnaW9ucyBvZiB0aGUgbGF5ZXIgaW5kZXhcbiAgICByZWdpb25zIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluZGV4LnJlZ2lvbnMob3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgU2FtcGxlIGxheWVyIHZhbHVlcyBieSB0aW1lbGluZSBvZmZzZXQgaW5jcmVtZW50c1xuICAgICAgICByZXR1cm4gbGlzdCBvZiB0dXBsZXMgW3ZhbHVlLCBvZmZzZXRdXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICAgLSBzdGFydFxuICAgICAgICAtIHN0b3BcbiAgICAgICAgLSBzdGVwXG5cbiAgICAgICAgVE9ETyAtIHRoaXMgc2hvdWxkIGJlIGFuIGl0ZXJhdG9yXG4gICAgKi9cbiAgICBzYW1wbGUob3B0aW9ucz17fSkge1xuICAgICAgICBpZiAodGhpcy5pbmRleC5lbXB0eSgpKSB7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHtzdGFydCwgc3RvcCwgc3RlcD0xfSA9IG9wdGlvbnM7XG4gICAgICAgIFxuICAgICAgICBpZiAoc3RhcnQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiBpbmRleC5maXJzdCBpcyBhIG51bWJlclxuICAgICAgICAgICAgY29uc3QgZmlyc3QgPSB0aGlzLmluZGV4LmZpcnN0KCk7XG4gICAgICAgICAgICBpZiAoZmlyc3RbMF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHN0YXJ0ID0gZmlyc3RbMF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInVuZGVmaW5lZCBzdGFydFwiKTtcbiAgICAgICAgICAgIH0gICAgXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0b3AgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiBpbmRleC5sYXN0IGlzIGEgbnVtYmVyXG4gICAgICAgICAgICBjb25zdCBsYXN0ID0gdGhpcy5pbmRleC5sYXN0KCk7XG4gICAgICAgICAgICBpZiAobGFzdFswXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgc3RvcCA9IGxhc3RbMF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInVuZGVmaW5lZCBzdG9wXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzdGFydCA+IHN0b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciAoXCJzdG9wIG11c3QgYmUgbGFyZ2VyIHRoYW4gc3RhcnRcIiwgc3RhcnQsIHN0b3ApXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmNyZWF0ZUNhY2hlKCk7XG4gICAgICAgIGNvbnN0IHNhbXBsZXMgPSByYW5nZShzdGFydCwgc3RvcCwgc3RlcCwge2luY2x1ZGVfZW5kOnRydWV9KVxuICAgICAgICAgICAgLm1hcCgob2Zmc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtjYWNoZS5xdWVyeShvZmZzZXQpLnZhbHVlLCBvZmZzZXRdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmVsZWFzZUNhY2hlKGNhY2hlKTtcbiAgICAgICAgcmV0dXJuIHNhbXBsZXM7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkTWV0aG9kcyhMYXllci5wcm90b3R5cGUpO1xuZXZlbnRpZnkuYWRkTWV0aG9kcyhMYXllci5wcm90b3R5cGUpO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExBWUVSIENBQ0hFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIExheWVyIENhY2hlIGlzIHRoZSByZWd1bGFyIGNhY2hlIHR5cGUsIGludGVuZGVkIGZvclxuICogX2Rlcml2ZWRfIExheWVycyAtIHRoYXQgaXMgYSBsYXllcnMgd2hpY2ggaW5kZXggcmVmZXJlbmNlc1xuICogb3RoZXIgc291cmNlIGxheWVycy5cbiAqIFxuICogQSBxdWVyeSBpcyByZXNvbHZlZCBieSBpZGVudGlmeWluZyB0aGUgcmVsZXZhbnQgcmVnaW9uIGluXG4gKiB0aGUgbmVhcmJ5IGluZGV4IChpbmRleC5uZWFyYnkob2Zmc2V0KSksIGFuZCB0aGVuIHF1ZXJ5aW5nIFxuICogdGhlIHN0YXRlIG9mIGFsbCB0aGUgb2JqZWN0cyBmb3VuZCBpbiB0aGUgcmVnaW9uIChuZWFyYnkuY2VudGVyKS5cbiAqICBcbiAqIE9wdGlvbnMge3ZhbHVlRnVuYyBvciBzdGF0ZUZ1bmN9IGFyZSB1c2VkIHRvIGNvbXB1dGUgYSBcbiAqIHNpbmdsZSBxdWVyeSByZXN1bHQgZnJvbSB0aGUgbGlzdCBvZiBzdGF0ZXMuXG4gKiBcbiAqIFRoZSByZXN1bHQgc3RhdGUgaXMgb25seSBjYWNoZWQgaWYgaXQgaXMgc3RhdGljLlxuICogQ2FjaGUgbWlzcyBpcyB0cmlnZ2VyZWQgaWYgbm8gc3RhdGUgaGFzIGJlZW4gY2FjaGVkLCBvciBpZiBcbiAqIG9mZnNldCBpcyBvdXRzaWRlIHRoZSByZWdpb24gb2YgdGhlIGNhY2hlZCBzdGF0ZS5cbiAqIFxuICovXG5cbmV4cG9ydCBjbGFzcyBMYXllckNhY2hlIHtcblxuICAgIGNvbnN0cnVjdG9yKGxheWVyKSB7XG4gICAgICAgIC8vIGNhY2hlIGJlbG9uZ3MgdG8gbGF5ZXJcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgLy8gY2FjaGVkIG5lYXJieSBzdGF0ZVxuICAgICAgICB0aGlzLl9uZWFyYnk7XG4gICAgICAgIC8vIGNhY2hlZCBzdGF0ZVxuICAgICAgICB0aGlzLl9zdGF0ZTtcbiAgICB9XG5cbiAgICBnZXQgbGF5ZXIoKSB7cmV0dXJuIHRoaXMuX2xheWVyfTtcblxuICAgIC8qKlxuICAgICAqIHF1ZXJ5IGNhY2hlXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IG5lZWRfaW5kZXhfbG9va3VwID0gKFxuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgIWludGVydmFsLmNvdmVyc19lbmRwb2ludCh0aGlzLl9uZWFyYnkuaXR2LCBvZmZzZXQpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICFuZWVkX2luZGV4X2xvb2t1cCAmJiBcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlICE9IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgIXRoaXMuX3N0YXRlLmR5bmFtaWNcbiAgICAgICAgKSB7XG4gICAgICAgICAgICAvLyBjYWNoZSBoaXRcbiAgICAgICAgICAgIHJldHVybiB7Li4udGhpcy5fc3RhdGUsIG9mZnNldH07XG4gICAgICAgIH1cbiAgICAgICAgLy8gY2FjaGUgbWlzc1xuICAgICAgICBpZiAobmVlZF9pbmRleF9sb29rdXApIHtcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICB9XG4gICAgICAgIC8vIHBlcmZvcm0gcXVlcmllc1xuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9uZWFyYnkuY2VudGVyLm1hcCgoY2FjaGUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBjYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gY2FsY3VsYXRlIHNpbmdsZSByZXN1bHQgc3RhdGVcbiAgICAgICAgY29uc3Qgc3RhdGUgPSB0b1N0YXRlKHRoaXMuX25lYXJieS5jZW50ZXIsIHN0YXRlcywgb2Zmc2V0LCB0aGlzLl9sYXllci5vcHRpb25zKTtcbiAgICAgICAgLy8gY2FjaGUgc3RhdGUgb25seSBpZiBub3QgZHluYW1pY1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IChzdGF0ZS5keW5hbWljKSA/IHVuZGVmaW5lZCA6IHN0YXRlO1xuICAgICAgICByZXR1cm4gc3RhdGUgICAgXG4gICAgfVxuXG4gICAgY2xlYXIoKSB7XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG4iLCJpbXBvcnQgeyBsb2NhbF9jbG9jayB9IGZyb20gXCIuL2NvbW1vbi5qc1wiO1xuXG4vKipcbiAqIHBvbGxpbmcgYSBjYWxsYmFjayBmdW5jdGlvbiBwZXJpb2RpY2FsbHkgd2l0aCBcbiAqIGEgZml4ZWQgZGVsYXkgKG1zKS5cbiAqIElmIGRlbGF5IGlzIDAsIHVzZSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXG4gKiBlbHNlIHVzZSBzZXRUaW1lb3V0LlxuICogRGVsYXkgY2FuIGJlIHNldCBkeW5hbWljYWxseS4gUGF1c2UgYW5kIHJlc3VtZVxuICogaXMgbmVlZGVkIGZvciBuZXcgZGVsYXkgdG8gdGFrZSBlZmZlY3QuXG4gKi9cblxuY2xhc3MgUG9sbGVyIHtcblxuICAgIGNvbnN0cnVjdG9yKGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuX2NhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgICAgIHRoaXMuX2hhbmRsZTtcbiAgICAgICAgdGhpcy5fZGVsYXk7XG4gICAgfVxuICAgIFxuICAgIHNldCBkZWxheSAoZGVsYXlfbXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBkZWxheV9tcyAhPSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGRlbGF5IG11c3QgYmUgYSBudW1iZXIgJHtkZWxheV9tc31gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fZGVsYXkgIT0gZGVsYXlfbXMpIHsgICBcbiAgICAgICAgICAgIHRoaXMuX2RlbGF5ID0gZGVsYXlfbXM7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZ2V0IGRlbGF5ICgpIHtyZXR1cm4gdGhpcy5fZGVsYXk7fVxuXG4gICAgaXNfcG9sbGluZyAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oYW5kbGUgIT0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHBhdXNlKCkge1xuICAgICAgICBpZiAodGhpcy5faGFuZGxlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlLmNhbmNlbCgpO1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcG9sbCgpIHtcbiAgICAgICAgLy8gcG9sbCBjYWxsYmFja1xuICAgICAgICB0aGlzLl9jYWxsYmFjaygpO1xuICAgICAgICAvLyBzY2hlZHVsZSBuZXh0IHBvbGxcbiAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgICB0aGlzLnJlc3VtZSgpO1xuICAgIH1cblxuICAgIHJlc3VtZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2hhbmRsZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9kZWxheSA9PSAwKSB7XG4gICAgICAgICAgICAgICAgLy8gZnJhbWVyYXRlXG4gICAgICAgICAgICAgICAgY29uc3QgYWlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMucG9sbC5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGUgPSB7Y2FuY2VsOiAoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShhaWQpfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gdGltZW91dFxuICAgICAgICAgICAgICAgIGNvbnN0IHRpZCA9IHNldFRpbWVvdXQodGhpcy5wb2xsLmJpbmQodGhpcyksIHRoaXMuX2RlbGF5KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGUgPSB7Y2FuY2VsOiAoKSA9PiBjbGVhclRpbWVvdXQodGlkKX07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogQ3Vyc29yIE1vbml0b3JcbiAqL1xuXG5jbGFzcyBDdXJzb3JNb25pdG9yIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgLypcbiAgICAgICAgICAgIHNldCBvZiBiaW5kaW5nc1xuICAgICAgICAgICAgcG9sbCBjdXJzb3IgKHdoZW4gZHluYW1pYykgcGVyaW9kaWNhbGx5IHdpdGggZ2l2ZW4gKG1pbmltdW0pIGRlbGF5LCBhbmQgaW52b2tlIGNhbGxiYWNrIHdpdGggY3Vyc29yIHN0YXRlIFxuICAgICAgICAgICAgYmluZGluZyA6IHtjdXJzb3IsIGNhbGxiYWNrLCBkZWxheV9tc31cbiAgICAgICAgICAgIC0gY3Vyc29yOlxuICAgICAgICAgICAgLSBjYWxsYmFjazogZnVuY3Rpb24oc3RhdGUpXG4gICAgICAgICAgICAtIGRlbGF5OiAobXMpIGJldHdlZW4gc2FtcGxlcyAod2hlbiB2YXJpYWJsZSBpcyBkeW5hbWljKVxuICAgICAgICAgICAgdGhlcmUgY2FuIGJlIG11bHRpcGxlIGJpbmRpbmdzIGZvciB0aGUgc2FtZSBjdXJzb3JcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmluZGluZ19zZXQgPSBuZXcgU2V0KCk7XG5cbiAgICAgICAgLypcbiAgICAgICAgICAgIGN1cnNvcnNcbiAgICAgICAgICAgIG1hcDogY3Vyc29yIC0+IHtzdWIsIHBvbGxpbmcsIGJpbmRpbmdzOltdfVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jdXJzb3JfbWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIC8vIFBvbGxlclxuICAgICAgICB0aGlzLl9wb2xsZXIgPSBuZXcgUG9sbGVyKHRoaXMub25wb2xsLmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGJpbmQoY3Vyc29yLCBjYWxsYmFjaywgZGVsYXkpIHtcbiAgICAgICAgLy8gY2hlY2sgZGVsYXlcbiAgICAgICAgaWYgKGRlbGF5ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGVsYXkgPSAwO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkZWxheSAhPSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGRlbGF5IG11c3QgYmUgYSBudW1iZXIgJHtkZWxheX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyByZWdpc3RlciBiaW5kaW5nXG4gICAgICAgIGxldCBiaW5kaW5nID0ge2N1cnNvciwgY2FsbGJhY2ssIGRlbGF5fTtcbiAgICAgICAgdGhpcy5fYmluZGluZ19zZXQuYWRkKGJpbmRpbmcpO1xuICAgICAgICAvLyByZWdpc3RlciBjdXJzb3JcbiAgICAgICAgaWYgKCF0aGlzLl9jdXJzb3JfbWFwLmhhcyhjdXJzb3IpKSB7IFxuICAgICAgICAgICAgbGV0IHN1YiA9IGN1cnNvci5vbihcImNoYW5nZVwiLCB0aGlzLm9uY3Vyc29yY2hhbmdlLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgdGhpcy5fY3Vyc29yX21hcC5zZXQoY3Vyc29yLCB7XG4gICAgICAgICAgICAgICAgc3ViLCBwb2xsaW5nOiBmYWxzZSwgYmluZGluZ3M6IFtiaW5kaW5nXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jdXJzb3JfbWFwLmdldChjdXJzb3IpLmJpbmRpbmdzLnB1c2goYmluZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJpbmRpbmc7XG4gICAgfVxuXG4gICAgcmVsZWFzZSAoYmluZGluZykge1xuICAgICAgICAvLyB1bnJlZ2lzdGVyIGJpbmRpbmdcbiAgICAgICAgY29uc3QgcmVtb3ZlZCA9IHRoaXMuX2JpbmRpbmdfc2V0LmRlbGV0ZShiaW5kaW5nKTtcbiAgICAgICAgaWYgKCFyZW1vdmVkKSByZXR1cm47XG4gICAgICAgIC8vIGNsZWFudXBcbiAgICAgICAgY29uc3QgY3Vyc29yID0gYmluZGluZy5jdXJzb3I7XG4gICAgICAgIGNvbnN0IHtzdWIsIGJpbmRpbmdzfSA9IHRoaXMuX2N1cnNvcl9tYXAuZ2V0KGN1cnNvcik7XG4gICAgICAgIC8vIHJlbW92ZSBiaW5kaW5nXG4gICAgICAgIGNvbnN0IGlkeCA9IGJpbmRpbmdzLmluZGV4T2YoYmluZGluZyk7XG4gICAgICAgIGlmIChpZHggPj0gMCkge1xuICAgICAgICAgICAgYmluZGluZ3Muc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJpbmRpbmdzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAvLyBubyBtb3JlIGJpbmRpbmdzXG4gICAgICAgICAgICBjdXJzb3Iub2ZmKHN1Yik7XG4gICAgICAgICAgICB0aGlzLl9jdXJzb3JfbWFwLmRlbGV0ZShjdXJzb3IpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYSBjdXJzb3IgaGFzIGNoYW5nZWRcbiAgICAgKiBmb3J3YXJkIGNoYW5nZSBldmVudCB0byBhbGwgY2FsbGJhY2tzIGZvciB0aGlzIGN1cnNvci5cbiAgICAgKiBhbmQgcmVldmFsdWF0ZSBwb2xsaW5nIHN0YXR1cywgcGF1c2luZyBvciByZXN1bWluZ1xuICAgICAqIHBvbGxpbmcgaWYgbmVlZGVkLlxuICAgICAqL1xuICAgIG9uY3Vyc29yY2hhbmdlKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIGNvbnN0IGN1cnNvciA9IGVJbmZvLnNyYztcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBlQXJnO1xuICAgICAgICAvLyByZWV2YWx1YXRlIHBvbGxpbmcgc3RhdHVzXG4gICAgICAgIHRoaXMuX2N1cnNvcl9tYXAuZ2V0KGN1cnNvcikucG9sbGluZyA9IHN0YXRlLmR5bmFtaWM7XG4gICAgICAgIC8vIGZpbmQgY3Vyc29ycyB3aGljaCBuZWVkIHBvbGxpbmdcbiAgICAgICAgY29uc3QgcG9sbGluZ19jdXJzb3JzID0gWy4uLnRoaXMuX2N1cnNvcl9tYXAudmFsdWVzKCldXG4gICAgICAgICAgICAuZmlsdGVyKGVudHJ5ID0+IGVudHJ5LnBvbGxpbmcpO1xuICAgICAgICB0aGlzLnJlZXZhbHVhdGVfcG9sbGluZyhwb2xsaW5nX2N1cnNvcnMpO1xuICAgICAgICAvLyBmb3J3YXJkIGNoYW5nZSBldmVudCB0byBhbGwgZm9yIHRoaXMgY3Vyc29yIGNhbGxiYWNrc1xuICAgICAgICBjb25zdCB7YmluZGluZ3N9ID0gdGhpcy5fY3Vyc29yX21hcC5nZXQoY3Vyc29yKTtcbiAgICAgICAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGJpbmRpbmdzKSB7XG4gICAgICAgICAgICBiaW5kaW5nLmNhbGxiYWNrKHN0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9ucG9sbCgpIHtcbiAgICAgICAgY29uc3QgdHMgPSBsb2NhbF9jbG9jay5ub3coKTtcbiAgICAgICAgLy8gcG9sbCBhbGwgY3Vyc29ycyB3aXRoIG5lZWQgb2YgcG9sbGluZ1xuICAgICAgICBmb3IgKGNvbnN0IFtjdXJzb3IsIGVudHJ5XSBvZiB0aGlzLl9jdXJzb3JfbWFwKSB7XG4gICAgICAgICAgICBpZiAoZW50cnkucG9sbGluZykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gY3Vyc29yLnF1ZXJ5KHRzKTtcbiAgICAgICAgICAgICAgICAvLyBmb3J3YXJkIHBvbGxlZCBzdGF0ZSB0byBhbGwgY2FsbGJhY2tzIGZvciB0aGlzIGN1cnNvclxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBlbnRyeS5iaW5kaW5ncykge1xuICAgICAgICAgICAgICAgICAgICBiaW5kaW5nLmNhbGxiYWNrKHN0YXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZWV2YWx1YXRlX3BvbGxpbmcocG9sbGluZ19jdXJzb3JzKSB7XG4gICAgICAgIGlmIChwb2xsaW5nX2N1cnNvcnMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3BvbGxlci5wYXVzZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmluZCBtaW5pbXVtIGRlbGF5XG4gICAgICAgICAgICBjb25zdCBkZWxheXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgcG9sbGluZ19jdXJzb3JzKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGVudHJ5LmJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGF5cy5wdXNoKGJpbmRpbmcuZGVsYXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjb25zdCBtaW5fZGVsYXkgPSBNYXRoLm1pbiguLi5kZWxheXMpO1xuICAgICAgICAgICAgdGhpcy5fcG9sbGVyLmRlbGF5ID0gbWluX2RlbGF5O1xuICAgICAgICAgICAgdGhpcy5fcG9sbGVyLnBhdXNlKCk7XG4gICAgICAgICAgICB0aGlzLl9wb2xsZXIucmVzdW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEJJTkQgUkVMRUFTRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vLyBtb25pdG9yIHNpbmdsZXRvblxuY29uc3QgbW9uaXRvciA9IG5ldyBDdXJzb3JNb25pdG9yKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kKGN1cnNvciwgY2FsbGJhY2ssIGRlbGF5KSB7XG4gICAgcmV0dXJuIG1vbml0b3IuYmluZChjdXJzb3IsIGNhbGxiYWNrLCBkZWxheSk7XG59XG5leHBvcnQgZnVuY3Rpb24gcmVsZWFzZShiaW5kaW5nKSB7XG4gICAgcmV0dXJuIG1vbml0b3IucmVsZWFzZShiaW5kaW5nKTtcbn1cblxuIiwiaW1wb3J0ICogYXMgZXZlbnRpZnkgZnJvbSBcIi4vdXRpbC9hcGlfZXZlbnRpZnkuanNcIjtcbmltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL3V0aWwvYXBpX2NhbGxiYWNrLmpzXCI7XG5pbXBvcnQgeyBiaW5kLCByZWxlYXNlIH0gZnJvbSBcIi4vdXRpbC9jdXJzb3JfbW9uaXRvci5qc1wiO1xuaW1wb3J0IHsgaXNfZmluaXRlX251bWJlciB9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5cbi8qKlxuICogY29udmVuaWVuY2VcbiAqIGdldCBjdXJyZW50IHN0YXRlIGZyb20gY3Vyc29yLmN0cmxcbiAqIGVuc3VyZSB0aGF0IGN1cnNvci5jdHJsIHJldHVybiBhIG51bWJlciBvZmZzZXRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldF9jdXJzb3JfY3RybF9zdGF0ZSAoY3Vyc29yLCB0c19sb2NhbCkge1xuICAgIGNvbnN0IHN0YXRlID0gY3Vyc29yLmN0cmwucXVlcnkodHNfbG9jYWwpO1xuICAgIGlmICghaXNfZmluaXRlX251bWJlcihzdGF0ZS52YWx1ZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3IgY3RybCB2YWx1ZSBtdXN0IGJlIG51bWJlciAke3N0YXRlLnZhbHVlfWApO1xuICAgIH1cbiAgICByZXR1cm4gc3RhdGU7XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi8gIFxuXG4vKipcbiAqIEFic3RyYWN0IGJhc2UgY2xhc3MgZm9yIEN1cnNvciBpbnRlcmZhY2VcbiAqL1xuXG5leHBvcnQgY2xhc3MgQ3Vyc29yIHtcbiAgICBcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGNhbGxiYWNrLmFkZFN0YXRlKHRoaXMpO1xuICAgICAgICAvLyBkZWZpbmUgY2hhbmdlIGV2ZW50XG4gICAgICAgIGV2ZW50aWZ5LmFkZFN0YXRlKHRoaXMpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFFVRVJZIEFQSVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgcXVlcnkoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInF1ZXJ5KCkgbm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIGdldCB2YWx1ZSAoKSB7cmV0dXJuIHRoaXMucXVlcnkoKS52YWx1ZX07XG5cbiAgICBnZXQgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5xdWVyeSgpLnZhbHVlO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIEV2ZW50aWZ5OiBpbW1lZGlhdGUgZXZlbnRzXG4gICAgKi9cbiAgICBldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuICAgICAgICBpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG4gICAgICAgICAgICByZXR1cm4gW3RoaXMucXVlcnkoKV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBCSU5EIFJFTEVBU0UgKGNvbnZlbmllbmNlKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgYmluZChjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICAgICAgcmV0dXJuIGJpbmQodGhpcywgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zKTtcbiAgICB9XG4gICAgcmVsZWFzZShoYW5kbGUpIHtcbiAgICAgICAgcmV0dXJuIHJlbGVhc2UoaGFuZGxlKTtcbiAgICB9XG5cbiAgICAvLyBpbnZva2VkIGJ5IHN1YmNsYXNzIHdoZW5ldmVyIGN1cnNvciBoYXMgY2hhbmdlZFxuICAgIG9uY2hhbmdlKCkge1xuICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdGhpcy5xdWVyeSgpKTsgICAgXG4gICAgfVxufVxuY2FsbGJhY2suYWRkTWV0aG9kcyhDdXJzb3IucHJvdG90eXBlKTtcbmV2ZW50aWZ5LmFkZE1ldGhvZHMoQ3Vyc29yLnByb3RvdHlwZSk7XG4iLCJpbXBvcnQge2xvY2FsX2Nsb2NrLCBsb2NhbF9lcG9jaH0gZnJvbSBcIi4vdXRpbC9jb21tb24uanNcIjtcblxuXG4vKipcbiAqIGNsb2NrIHByb3ZpZGVyIG11c3QgaGF2ZSBhIG5vdygpIG1ldGhvZFxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNfY2xvY2tfcHJvdmlkZXIob2JqKSB7XG4gICAgaWYgKG9iaiA9PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIShcIm5vd1wiIGluIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIG9iai5ub3cgIT0gJ2Z1bmN0aW9uJykgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xufVxuXG5cbi8qKlxuICogQ0xPQ0sgZ2l2ZXMgZXBvY2ggdmFsdWVzLCBidXQgaXMgaW1wbGVtZW50ZWRcbiAqIHVzaW5nIHBlcmZvcm1hbmNlIG5vdyBmb3IgYmV0dGVyXG4gKiB0aW1lIHJlc29sdXRpb24gYW5kIHByb3RlY3Rpb24gYWdhaW5zdCBzeXN0ZW0gXG4gKiB0aW1lIGFkanVzdG1lbnRzLlxuICovXG5leHBvcnQgY29uc3QgTE9DQUxfQ0xPQ0tfUFJPVklERVIgPSBmdW5jdGlvbiAoKSB7XG4gICAgY29uc3QgdDAgPSBsb2NhbF9jbG9jay5ub3coKTtcbiAgICBjb25zdCB0MF9lcG9jaCA9IGxvY2FsX2Vwb2NoLm5vdygpO1xuICAgIHJldHVybiB7XG4gICAgICAgIG5vdyAobG9jYWxfdHMgPSBsb2NhbF9jbG9jay5ub3coKSkge1xuICAgICAgICAgICAgcmV0dXJuIHQwX2Vwb2NoICsgKGxvY2FsX3RzIC0gdDApO1xuICAgICAgICB9XG4gICAgfVxufSgpO1xuXG4iLCJpbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyByYW5kb21fc3RyaW5nfSBmcm9tIFwiLi91dGlsL2NvbW1vbi5qc1wiO1xuaW1wb3J0ICogYXMgY2FsbGJhY2sgZnJvbSBcIi4vdXRpbC9hcGlfY2FsbGJhY2suanNcIjtcblxuXG5mdW5jdGlvbiBjaGVja19pdGVtKGl0ZW0pIHtcbiAgICBpdGVtLml0diA9IGludGVydmFsLmZyb21faW5wdXQoaXRlbS5pdHYpO1xuICAgIGl0ZW0uaWQgPSBpdGVtLmlkIHx8IHJhbmRvbV9zdHJpbmcoMTApO1xuICAgIHJldHVybiBpdGVtO1xufVxuXG4vKipcbiAqIGNvbGxlY3Rpb24gcHJvdmlkZXJzIG11c3QgcHJvdmlkZSBnZXRfYWxsIGZ1bmN0aW9uXG4gKiBhbmQgYWxzbyBpbXBsZW1lbnQgY2FsbGJhY2sgaW50ZXJmYWNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc19jb2xsZWN0aW9uX3Byb3ZpZGVyKG9iaikge1xuICAgIGlmICghY2FsbGJhY2suaXNfY2FsbGJhY2tfYXBpKG9iaikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIShcImdldFwiIGluIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIG9iai5nZXQgIT0gJ2Z1bmN0aW9uJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghKFwidXBkYXRlXCIgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2Ygb2JqLnVwZGF0ZSAhPSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIENPTExFQ1RJT04gUFJPVklERVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBsb2NhbCBjb2xsZWN0aW9uIHByb3ZpZGVyXG4gKiBcbiAqIFxuICogY2hhbmdlcyA9IHtcbiAqICAgcmVtb3ZlPVtdLFxuICogICBpbnNlcnQ9W10sXG4gKiAgIHJlc2V0PWZhbHNlIFxuICogfVxuICogXG4qL1xuXG5leHBvcnQgY2xhc3MgQ29sbGVjdGlvblByb3ZpZGVyIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgY2FsbGJhY2suYWRkU3RhdGUodGhpcyk7XG4gICAgICAgIHRoaXMuX21hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgLy8gaW5pdGlhbGl6ZVxuICAgICAgICBsZXQge2luc2VydH0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoaW5zZXJ0ICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlKHtpbnNlcnQsIHJlc2V0OnRydWV9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvY2FsIHN0YXRlcHJvdmlkZXJzIGRlY291cGxlIHVwZGF0ZSByZXF1ZXN0IGZyb21cbiAgICAgKiB1cGRhdGUgcHJvY2Vzc2luZywgYW5kIHJldHVybnMgUHJvbWlzZS5cbiAgICAgKi9cbiAgICB1cGRhdGUgKGNoYW5nZXMpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIGxldCBkaWZmcztcbiAgICAgICAgICAgIGlmIChjaGFuZ2VzICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGRpZmZzID0gdGhpcy5fdXBkYXRlKGNoYW5nZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcyhkaWZmcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZGlmZnM7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIF91cGRhdGUoY2hhbmdlcykge1xuICAgICAgICBjb25zdCBkaWZmX21hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgbGV0IHtcbiAgICAgICAgICAgIGluc2VydD1bXSxcbiAgICAgICAgICAgIHJlbW92ZT1bXSxcbiAgICAgICAgICAgIHJlc2V0PWZhbHNlXG4gICAgICAgIH0gPSBjaGFuZ2VzO1xuXG5cbiAgICAgICAgaWYgKHJlc2V0KSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtpZCwgaXRlbV0gb2YgdGhpcy5fbWFwLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgICAgIGRpZmZfbWFwLnNldChpZCwge2lkLCBuZXc6dW5kZWZpbmVkLCBvbGQ6aXRlbX0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gY2xlYXIgYWxsIGl0ZW1zXG4gICAgICAgICAgICB0aGlzLl9tYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyByZW1vdmUgaXRlbXMgYnkgaWRcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWQgb2YgcmVtb3ZlKSB7XG4gICAgICAgICAgICAgICAgbGV0IGl0ZW0gPSB0aGlzLl9tYXAuZ2V0KGlkKTtcbiAgICAgICAgICAgICAgICBpZiAoaXRlbSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgZGlmZl9tYXAuc2V0KGl0ZW0uaWQsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOml0ZW0uaWQsIG5ldzp1bmRlZmluZWQsIG9sZDppdGVtXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXAuZGVsZXRlKGlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gaW5zZXJ0IGl0ZW1zXG4gICAgICAgIGZvciAobGV0IGl0ZW0gb2YgaW5zZXJ0KSB7XG4gICAgICAgICAgICBpdGVtID0gY2hlY2tfaXRlbShpdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IGRpZmYgPSBkaWZmX21hcC5nZXQoaXRlbS5pZClcbiAgICAgICAgICAgIGNvbnN0IG9sZCA9IChkaWZmICE9IHVuZGVmaW5lZCkgPyBkaWZmLm9sZCA6IHRoaXMuX21hcC5nZXQoaXRlbS5pZCk7XG4gICAgICAgICAgICBkaWZmX21hcC5zZXQoaXRlbS5pZCwge2lkOml0ZW0uaWQsIG5ldzppdGVtLCBvbGR9KTtcbiAgICAgICAgICAgIHRoaXMuX21hcC5zZXQoaXRlbS5pZCwgaXRlbSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFsuLi5kaWZmX21hcC52YWx1ZXMoKV07XG4gICAgfVxuXG4gICAgZ2V0KCkge1xuICAgICAgICByZXR1cm4gWy4uLnRoaXMuX21hcC52YWx1ZXMoKV07XG4gICAgfTtcbn1cbmNhbGxiYWNrLmFkZE1ldGhvZHMoQ29sbGVjdGlvblByb3ZpZGVyLnByb3RvdHlwZSk7XG4iLCJpbXBvcnQgKiBhcyBjYWxsYmFjayBmcm9tIFwiLi91dGlsL2FwaV9jYWxsYmFjay5qc1wiO1xuaW1wb3J0IHsgcmFuZG9tX3N0cmluZ30gZnJvbSBcIi4vdXRpbC9jb21tb24uanNcIjtcblxuLyoqXG4gKiB2YXJpYWJsZSBwcm92aWRlcnMgbXVzdCBoYXZlIGEgdmFsdWUgcHJvcGVydHlcbiAqIGFuZCBhbHNvIGltcGxlbWVudCBjYWxsYmFjayBpbnRlcmZhY2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzX3ZhcmlhYmxlX3Byb3ZpZGVyKG9iaikge1xuICAgIGlmICghY2FsbGJhY2suaXNfY2FsbGJhY2tfYXBpKG9iaikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIShcImdldFwiIGluIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIG9iai5nZXQgIT0gJ2Z1bmN0aW9uJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghKFwic2V0XCIgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2Ygb2JqLnNldCAhPSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFZBUklBQkxFIFBST1ZJREVSXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogVmFyaWFibGVQcm92aWRlciBzdG9yZXMgYSBsaXN0IG9mIGl0ZW1zLlxuICovXG5cbmV4cG9ydCBjbGFzcyBWYXJpYWJsZVByb3ZpZGVyIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgY2FsbGJhY2suYWRkU3RhdGUodGhpcyk7XG4gICAgICAgIHRoaXMuX2l0ZW1zID0gW107XG4gICAgICAgIC8vIGluaXRpYWxpemVcbiAgICAgICAgY29uc3Qge3ZhbHVlfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmICh2YWx1ZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gW3tcbiAgICAgICAgICAgICAgICBpZDogcmFuZG9tX3N0cmluZygxMCksXG4gICAgICAgICAgICAgICAgaXR2OiBbbnVsbCwgbnVsbCwgdHJ1ZSwgdHJ1ZV0sIFxuICAgICAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICAgICAgZGF0YTogdmFsdWVcbiAgICAgICAgICAgIH1dO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0IChpdGVtcykge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pdGVtcyA9IGl0ZW1zO1xuICAgICAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ2V0ICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2l0ZW1zO1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZE1ldGhvZHMoVmFyaWFibGVQcm92aWRlci5wcm90b3R5cGUpOyIsImltcG9ydCB7IGlzX2NhbGxiYWNrX2FwaSB9IGZyb20gXCIuL2FwaV9jYWxsYmFjay5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTT1VSQ0UgUFJPUEVSVFkgKFNSQ1BST1ApXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9ucyBmb3IgZXh0ZW5kaW5nIGEgY2xhc3Mgd2l0aCBzdXBwb3J0IGZvciBcbiAqIGV4dGVybmFsIHNvdXJjZSBvbiBhIG5hbWVkIHByb3BlcnR5LlxuICogXG4gKiBvcHRpb246IG11dGFibGU6dHJ1ZSBtZWFucyB0aGF0IHByb3BlcnkgbWF5IGJlIHJlc2V0IFxuICogXG4gKiBzb3VyY2Ugb2JqZWN0IGlzIGFzc3VtZWQgdG8gc3VwcG9ydCB0aGUgY2FsbGJhY2sgaW50ZXJmYWNlLFxuICogb3IgYmUgYSBsaXN0IG9mIG9iamVjdHMgYWxsIHN1cHBvcnRpbmcgdGhlIGNhbGxiYWNrIGludGVyZmFjZVxuICovXG5cbmNvbnN0IE5BTUUgPSBcInNyY3Byb3BcIjtcbmNvbnN0IFBSRUZJWCA9IGBfXyR7TkFNRX1gO1xuXG5leHBvcnQgZnVuY3Rpb24gYWRkU3RhdGUgKG9iamVjdCkge1xuICAgIG9iamVjdFtgJHtQUkVGSVh9YF0gPSBuZXcgTWFwKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRNZXRob2RzIChvYmplY3QpIHtcblxuICAgIGZ1bmN0aW9uIHJlZ2lzdGVyKHByb3BOYW1lLCBvcHRpb25zPXt9KSB7XG4gICAgICAgIGxldCB7bXV0YWJsZT10cnVlfSA9IG9wdGlvbnM7XG4gICAgICAgIGNvbnN0IG1hcCA9IHRoaXNbYCR7UFJFRklYfWBdOyBcbiAgICAgICAgbWFwLnNldChwcm9wTmFtZSwge1xuICAgICAgICAgICAgaW5pdDpmYWxzZSxcbiAgICAgICAgICAgIG11dGFibGUsXG4gICAgICAgICAgICBlbnRpdHk6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGhhbmRsZXM6IFtdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHJlZ2lzdGVyIGdldHRlcnMgYW5kIHNldHRlcnNcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIHByb3BOYW1lLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbWFwLmdldChwcm9wTmFtZSkuZW50aXR5O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKGVudGl0eSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzW2Ake05BTUV9X2NoZWNrYF0pIHtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5ID0gdGhpc1tgJHtOQU1FfV9jaGVja2BdKHByb3BOYW1lLCBlbnRpdHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5ICE9IG1hcC5nZXQocHJvcE5hbWUpLmVudGl0eSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzW2Ake1BSRUZJWH1fYXR0YWNoYF0ocHJvcE5hbWUsIGVudGl0eSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhdHRhdGNoKHByb3BOYW1lLCBlbnRpdHkpIHtcblxuICAgICAgICBjb25zdCBtYXAgPSB0aGlzW2Ake1BSRUZJWH1gXTtcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBtYXAuZ2V0KHByb3BOYW1lKVxuXG4gICAgICAgIGlmIChzdGF0ZS5pbml0ICYmICFzdGF0ZS5tdXRhYmxlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7cHJvcE5hbWV9IGNhbiBub3QgYmUgcmVhc3NpZ25lZGApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZW50aXRpZXMgPSAoQXJyYXkuaXNBcnJheShlbnRpdHkpKSA/IGVudGl0eSA6IFtlbnRpdHldO1xuXG4gICAgICAgIC8vIHVuc3Vic2NyaWJlIGZyb20gZW50aXRpZXNcbiAgICAgICAgaWYgKHN0YXRlLmhhbmRsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBbaWR4LCBlXSBvZiBPYmplY3QuZW50cmllcyhlbnRpdGllcykpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNfY2FsbGJhY2tfYXBpKGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGUucmVtb3ZlX2NhbGxiYWNrKHN0YXRlLmhhbmRsZXNbaWR4XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSAgICBcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5oYW5kbGVzID0gW107XG5cbiAgICAgICAgLy8gYXR0YXRjaCBuZXcgZW50aXR5XG4gICAgICAgIHN0YXRlLmVudGl0eSA9IGVudGl0eTtcbiAgICAgICAgc3RhdGUuaW5pdCA9IHRydWU7XG5cbiAgICAgICAgLy8gc3Vic2NyaWJlIHRvIGNhbGxiYWNrIGZyb20gc291cmNlXG4gICAgICAgIGlmICh0aGlzW2Ake05BTUV9X29uY2hhbmdlYF0pIHtcbiAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBmdW5jdGlvbiAoZUFyZykge1xuICAgICAgICAgICAgICAgIHRoaXNbYCR7TkFNRX1fb25jaGFuZ2VgXShwcm9wTmFtZSwgZUFyZyk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGUgb2YgZW50aXRpZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNfY2FsbGJhY2tfYXBpKGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlLmhhbmRsZXMucHVzaChlLmFkZF9jYWxsYmFjayhoYW5kbGVyKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpc1tgJHtOQU1FfV9vbmNoYW5nZWBdKHByb3BOYW1lLCBcInJlc2V0XCIpOyBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGFwaSA9IHt9O1xuICAgIGFwaVtgJHtOQU1FfV9yZWdpc3RlcmBdID0gcmVnaXN0ZXI7XG4gICAgYXBpW2Ake1BSRUZJWH1fYXR0YWNoYF0gPSBhdHRhdGNoO1xuICAgIE9iamVjdC5hc3NpZ24ob2JqZWN0LCBhcGkpO1xufVxuXG4iLCJpbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblx0U09SVEVEIEFSUkFZXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG5cdFNvcnRlZCBhcnJheSBvZiBlbmRwb2ludHMgW3ZhbHVlLCB0eXBlXS5cblx0LSBFbGVtZW50cyBhcmUgc29ydGVkIGluIGFzY2VuZGluZyBvcmRlci5cblx0LSBObyBkdXBsaWNhdGVzIGFyZSBhbGxvd2VkLlxuXHQtIEJpbmFyeSBzZWFyY2ggdXNlZCBmb3IgbG9va3VwXG5cblx0dmFsdWVzIGNhbiBiZSByZWd1bGFyIG51bWJlciB2YWx1ZXMgKGZsb2F0KSBvciBlbmRwb2ludHMgW2Zsb2F0LCB0eXBlXVxuKi9cblxuZXhwb3J0IGNsYXNzIFNvcnRlZEFycmF5IHtcblxuXHRjb25zdHJ1Y3Rvcigpe1xuXHRcdHRoaXMuX2FycmF5ID0gW107XG5cdH1cblxuXHRnZXQgc2l6ZSgpIHtyZXR1cm4gdGhpcy5fYXJyYXkubGVuZ3RoO31cblx0Z2V0IGFycmF5KCkge3JldHVybiB0aGlzLl9hcnJheTt9XG5cblx0Lypcblx0XHRmaW5kIGluZGV4IG9mIGdpdmVuIHZhbHVlXG5cblx0XHRyZXR1cm4gW2ZvdW5kLCBpbmRleF1cblxuXHRcdGlmIGZvdW5kIGlzIHRydWUsIHRoZW4gaW5kZXggaXMgdGhlIGluZGV4IG9mIHRoZSBmb3VuZCBvYmplY3Rcblx0XHRpZiBmb3VuZCBpcyBmYWxzZSwgdGhlbiBpbmRleCBpcyB0aGUgaW5kZXggd2hlcmUgdGhlIG9iamVjdCBzaG91bGRcblx0XHRiZSBpbnNlcnRlZFxuXG5cdFx0LSB1c2VzIGJpbmFyeSBzZWFyY2hcdFx0XG5cdFx0LSBhcnJheSBkb2VzIG5vdCBpbmNsdWRlIGFueSBkdXBsaWNhdGUgdmFsdWVzXG5cdCovXG5cdGluZGV4T2YodGFyZ2V0X3ZhbHVlKSB7XG5cdFx0Y29uc3QgdGFyZ2V0X2VwID0gZW5kcG9pbnQuZnJvbV9pbnB1dCh0YXJnZXRfdmFsdWUpO1xuXHRcdGxldCBsZWZ0X2lkeCA9IDA7XG5cdFx0bGV0IHJpZ2h0X2lkeCA9IHRoaXMuX2FycmF5Lmxlbmd0aCAtIDE7XG5cdFx0d2hpbGUgKGxlZnRfaWR4IDw9IHJpZ2h0X2lkeCkge1xuXHRcdFx0Y29uc3QgbWlkX2lkeCA9IE1hdGguZmxvb3IoKGxlZnRfaWR4ICsgcmlnaHRfaWR4KSAvIDIpO1xuXHRcdFx0bGV0IG1pZF92YWx1ZSA9IHRoaXMuX2FycmF5W21pZF9pZHhdO1xuXHRcdFx0aWYgKGVuZHBvaW50LmVxKG1pZF92YWx1ZSwgdGFyZ2V0X2VwKSkge1xuXHRcdFx0XHRyZXR1cm4gW3RydWUsIG1pZF9pZHhdOyAvLyBUYXJnZXQgYWxyZWFkeSBleGlzdHMgaW4gdGhlIGFycmF5XG5cdFx0XHR9IGVsc2UgaWYgKGVuZHBvaW50Lmx0KG1pZF92YWx1ZSwgdGFyZ2V0X2VwKSkge1xuXHRcdFx0XHQgIGxlZnRfaWR4ID0gbWlkX2lkeCArIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSByaWdodFxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ICByaWdodF9pZHggPSBtaWRfaWR4IC0gMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIGxlZnRcblx0XHRcdH1cblx0XHR9XG5cdCAgXHRyZXR1cm4gW2ZhbHNlLCBsZWZ0X2lkeF07IC8vIFJldHVybiB0aGUgaW5kZXggd2hlcmUgdGFyZ2V0IHNob3VsZCBiZSBpbnNlcnRlZFxuXHR9XG5cblx0Lypcblx0XHRmaW5kIGluZGV4IG9mIHNtYWxsZXN0IHZhbHVlIHdoaWNoIGlzIGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byB0YXJnZXQgdmFsdWVcblx0XHRyZXR1cm5zIC0xIGlmIG5vIHN1Y2ggdmFsdWUgZXhpc3RzXG5cdCovXG5cdGdlSW5kZXhPZih0YXJnZXRfdmFsdWUpIHtcblx0XHRsZXQgW2ZvdW5kLCBpZHhdID0gdGhpcy5pbmRleE9mKHRhcmdldF92YWx1ZSk7XG5cdFx0cmV0dXJuIChpZHggPCB0aGlzLl9hcnJheS5sZW5ndGgpID8gaWR4IDogLTEgIFxuXHR9XG5cblx0Lypcblx0XHRmaW5kIGluZGV4IG9mIGxhcmdlc3QgdmFsdWUgd2hpY2ggaXMgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIHRhcmdldCB2YWx1ZVxuXHRcdHJldHVybnMgLTEgaWYgbm8gc3VjaCB2YWx1ZSBleGlzdHNcblx0Ki9cblx0bGVJbmRleE9mKHRhcmdldF92YWx1ZSkge1xuXHRcdGxldCBbZm91bmQsIGlkeF0gPSB0aGlzLmluZGV4T2YodGFyZ2V0X3ZhbHVlKTtcblx0XHRpZHggPSAoZm91bmQpID8gaWR4IDogaWR4LTE7XG5cdFx0cmV0dXJuIChpZHggPj0gMCkgPyBpZHggOiAtMTtcblx0fVxuXG5cdC8qXG5cdFx0ZmluZCBpbmRleCBvZiBzbWFsbGVzdCB2YWx1ZSB3aGljaCBpcyBncmVhdGVyIHRoYW4gdGFyZ2V0IHZhbHVlXG5cdFx0cmV0dXJucyAtMSBpZiBubyBzdWNoIHZhbHVlIGV4aXN0c1xuXHQqL1xuXHRndEluZGV4T2YodGFyZ2V0X3ZhbHVlKSB7XG5cdFx0bGV0IFtmb3VuZCwgaWR4XSA9IHRoaXMuaW5kZXhPZih0YXJnZXRfdmFsdWUpO1xuXHRcdGlkeCA9IChmb3VuZCkgPyBpZHggKyAxIDogaWR4O1xuXHRcdHJldHVybiAoaWR4IDwgdGhpcy5fYXJyYXkubGVuZ3RoKSA/IGlkeCA6IC0xICBcblx0fVxuXG5cdC8qXG5cdFx0ZmluZCBpbmRleCBvZiBsYXJnZXN0IHZhbHVlIHdoaWNoIGlzIGxlc3MgdGhhbiB0YXJnZXQgdmFsdWVcblx0XHRyZXR1cm5zIC0xIGlmIG5vIHN1Y2ggdmFsdWUgZXhpc3RzXG5cdCovXG5cdGx0SW5kZXhPZih0YXJnZXRfdmFsdWUpIHtcblx0XHRsZXQgW2ZvdW5kLCBpZHhdID0gdGhpcy5pbmRleE9mKHRhcmdldF92YWx1ZSk7XG5cdFx0aWR4ID0gaWR4LTE7XG5cdFx0cmV0dXJuIChpZHggPj0gMCkgPyBpZHggOiAtMTtcdFxuXHR9XG5cblx0Lypcblx0XHRVUERBVEVcblxuXHRcdGFwcHJvYWNoIC0gbWFrZSBhbGwgbmVjY2Vzc2FyeSBjaGFuZ2VzIGFuZCB0aGVuIHNvcnRcblxuXHRcdGFzIGEgcnVsZSBvZiB0aHVtYiAtIGNvbXBhcmVkIHRvIHJlbW92aW5nIGFuZCBpbnNlcnRpbmcgZWxlbWVudHNcblx0XHRvbmUgYnkgb25lLCB0aGlzIGlzIG1vcmUgZWZmZWN0aXZlIGZvciBsYXJnZXIgYmF0Y2hlcywgc2F5ID4gMTAwLlxuXHRcdEV2ZW4gdGhvdWdoIHRoaXMgbWlnaHQgbm90IGJlIHRoZSBjb21tb24gY2FzZSwgcGVuYWx0aWVzIGZvclxuXHRcdGNob29zaW5nIHRoZSB3cm9uZyBhcHByb2FjaCBpcyBoaWdoZXIgZm9yIGxhcmdlciBiYXRjaGVzLlxuXG5cdFx0cmVtb3ZlIGlzIHByb2Nlc3NlZCBmaXJzdCwgc28gaWYgYSB2YWx1ZSBhcHBlYXJzIGluIGJvdGggXG5cdFx0cmVtb3ZlIGFuZCBpbnNlcnQsIGl0IHdpbGwgcmVtYWluLlxuXHRcdHVuZGVmaW5lZCB2YWx1ZXMgY2FuIG5vdCBiZSBpbnNlcnRlZCBcblxuXHQqL1xuXG5cdHVwZGF0ZShyZW1vdmVfbGlzdD1bXSwgaW5zZXJ0X2xpc3Q9W10pIHtcblxuXHRcdC8qXG5cdFx0XHRyZW1vdmVcblxuXHRcdFx0cmVtb3ZlIGJ5IGZsYWdnaW5nIGVsZW1lbnRzIGFzIHVuZGVmaW5lZFxuXHRcdFx0LSBjb2xsZWN0IGFsbCBpbmRleGVzIGZpcnN0XG5cdFx0XHQtIGZsYWcgYXMgdW5kZWZpbmVkIG9ubHkgYWZ0ZXIgYWxsIGluZGV4ZXMgaGF2ZSBiZWVuIGZvdW5kLFxuXHRcdFx0ICBhcyBpbnNlcnRpbmcgdW5kZWZpbmVkIHZhbHVlcyBicmVha2VzIHRoZSBhc3N1bXB0aW9uIHRoYXRcblx0XHRcdCAgdGhlIGFycmF5IGlzIHNvcnRlZC5cblx0XHRcdC0gbGF0ZXIgc29ydCB3aWxsIG1vdmUgdGhlbSB0byB0aGUgZW5kLCB3aGVyZSB0aGV5IGNhbiBiZVxuXHRcdFx0ICB0cnVuY2F0ZWQgb2ZmXG5cdFx0Ki9cblx0XHRsZXQgcmVtb3ZlX2lkeF9saXN0ID0gW107XG5cdFx0Zm9yIChsZXQgdmFsdWUgb2YgcmVtb3ZlX2xpc3QpIHtcblx0XHRcdGxldCBbZm91bmQsIGlkeF0gPSB0aGlzLmluZGV4T2YodmFsdWUpO1xuXHRcdFx0aWYgKGZvdW5kKSB7XG5cdFx0XHRcdHJlbW92ZV9pZHhfbGlzdC5wdXNoKGlkeCk7XG5cdFx0XHR9XHRcdFxuXHRcdH1cblx0XHRmb3IgKGxldCBpZHggb2YgcmVtb3ZlX2lkeF9saXN0KSB7XG5cdFx0XHR0aGlzLl9hcnJheVtpZHhdID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRsZXQgYW55X3JlbW92ZXMgPSByZW1vdmVfaWR4X2xpc3QubGVuZ3RoID4gMDtcblxuXHRcdC8qXG5cdFx0XHRpbnNlcnRcblxuXHRcdFx0aW5zZXJ0IG1pZ2h0IGludHJvZHVjZSBkdXBsaWNhdGlvbnMsIGVpdGhlciBiZWNhdXNlXG5cdFx0XHR0aGUgaW5zZXJ0IGxpc3QgaW5jbHVkZXMgZHVwbGljYXRlcywgb3IgYmVjYXVzZSB0aGVcblx0XHRcdGluc2VydCBsaXN0IGR1cGxpY2F0ZXMgcHJlZXhpc3RpbmcgdmFsdWVzLlxuXG5cdFx0XHRJbnN0ZWFkIG9mIGxvb2tpbmcgdXAgYW5kIGNoZWNraW5nIGVhY2ggaW5zZXJ0IHZhbHVlLFxuXHRcdFx0d2UgaW5zdGVhZCBpbnNlcnQgZXZlcnl0aGluZyBhdCB0aGUgZW5kIG9mIHRoZSBhcnJheSxcblx0XHRcdGFuZCByZW1vdmUgZHVwbGljYXRlcyBvbmx5IGFmdGVyIHdlIGhhdmUgc29ydGVkLlxuXHRcdCovXG5cdFx0bGV0IGFueV9pbnNlcnRzID0gaW5zZXJ0X2xpc3QubGVuZ3RoID4gMDtcblx0XHRpZiAoYW55X2luc2VydHMpIHtcblx0XHRcdGNvbmNhdF9pbl9wbGFjZSh0aGlzLl9hcnJheSwgaW5zZXJ0X2xpc3QpO1xuXHRcdH1cblxuXHRcdC8qXG5cdFx0XHRzb3J0XG5cdFx0XHR0aGlzIHB1c2hlcyBhbnkgdW5kZWZpbmVkIHZhbHVlcyB0byB0aGUgZW5kIFxuXHRcdCovXG5cdFx0aWYgKGFueV9yZW1vdmVzIHx8IGFueV9pbnNlcnRzKSB7XG5cdFx0XHR0aGlzLl9hcnJheS5zb3J0KGVuZHBvaW50LmNtcCk7XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRcdHJlbW92ZSB1bmRlZmluZWQgXG5cdFx0XHRhbGwgdW5kZWZpbmVkIHZhbHVlcyBhcmUgcHVzaGVkIHRvIHRoZSBlbmRcblx0XHQqL1xuXHRcdGlmIChhbnlfcmVtb3Zlcykge1xuXHRcdFx0dGhpcy5fYXJyYXkubGVuZ3RoIC09IHJlbW92ZV9pZHhfbGlzdC5sZW5ndGg7XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRcdHJlbW92ZSBkdXBsaWNhdGVzIGZyb20gc29ydGVkIGFycmF5XG5cdFx0XHQtIGFzc3VtaW5nIHRoZXJlIGFyZSBnb2luZyB0byBiZSBmZXcgZHVwbGljYXRlcyxcblx0XHRcdCAgaXQgaXMgb2sgdG8gcmVtb3ZlIHRoZW0gb25lIGJ5IG9uZVxuXG5cdFx0Ki9cblx0XHRpZiAoYW55X2luc2VydHMpIHtcblx0XHRcdHJlbW92ZV9kdXBsaWNhdGVzKHRoaXMuX2FycmF5KTtcblx0XHR9XG5cdH1cblxuXHQvKlxuXHRcdGdldCBlbGVtZW50IGJ5IGluZGV4XG5cdCovXG5cdGdldF9ieV9pbmRleChpZHgpIHtcblx0XHRpZiAoaWR4ID4gLTEgJiYgaWR4IDwgdGhpcy5fYXJyYXkubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYXJyYXlbaWR4XTtcblx0XHR9XG5cdH1cblxuXHQvKlxuXHRcdGxvb2t1cCB2YWx1ZXMgd2l0aGluIGludGVydmFsXG5cdCovXG5cdGxvb2t1cChpdHYpIHtcblx0XHRpZiAoaXR2ID09IHVuZGVmaW5lZCkge1xuXHRcdFx0aXR2ID0gW251bGwsIG51bGwsIHRydWUsIHRydWVdO1xuXHRcdH1cblx0XHRsZXQgW2VwXzAsIGVwXzFdID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdHYpO1xuXHRcdGxldCBpZHhfMCA9IHRoaXMuZ2VJbmRleE9mKGVwXzApO1xuXHRcdGxldCBpZHhfMSA9IHRoaXMubGVJbmRleE9mKGVwXzEpO1xuXHRcdGlmIChpZHhfMCA9PSAtMSB8fCBpZHhfMSA9PSAtMSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYXJyYXkuc2xpY2UoaWR4XzAsIGlkeF8xKzEpO1xuXHRcdH1cblx0fVxuXG5cdGx0IChvZmZzZXQpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRfYnlfaW5kZXgodGhpcy5sdEluZGV4T2Yob2Zmc2V0KSk7XG5cdH1cblx0bGUgKG9mZnNldCkge1xuXHRcdHJldHVybiB0aGlzLmdldF9ieV9pbmRleCh0aGlzLmxlSW5kZXhPZihvZmZzZXQpKTtcblx0fVxuXHRnZXQgKG9mZnNldCkge1xuXHRcdGxldCBbZm91bmQsIGlkeF0gPSB0aGlzLmluZGV4T2Yob2Zmc2V0KTtcblx0XHRpZiAoZm91bmQpIHtcblx0XHRcdHJldHVybiB0aGlzLl9hcnJheVtpZHhdO1xuXHRcdH0gXG5cdH1cblx0Z3QgKG9mZnNldCkge1xuXHRcdHJldHVybiB0aGlzLmdldF9ieV9pbmRleCh0aGlzLmd0SW5kZXhPZihvZmZzZXQpKTtcblx0fVxuXHRnZSAob2Zmc2V0KSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0X2J5X2luZGV4KHRoaXMuZ2VJbmRleE9mKG9mZnNldCkpO1xuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXHRVVElMU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuXHRDb25jYXRpbmF0ZSB0d28gYXJyYXlzIGJ5IGFwcGVuZGluZyB0aGUgc2Vjb25kIGFycmF5IHRvIHRoZSBmaXJzdCBhcnJheS4gXG4qL1xuXG5mdW5jdGlvbiBjb25jYXRfaW5fcGxhY2UoZmlyc3RfYXJyLCBzZWNvbmRfYXJyKSB7XG5cdGNvbnN0IGZpcnN0X2Fycl9sZW5ndGggPSBmaXJzdF9hcnIubGVuZ3RoO1xuXHRjb25zdCBzZWNvbmRfYXJyX2xlbmd0aCA9IHNlY29uZF9hcnIubGVuZ3RoO1xuICBcdGZpcnN0X2Fyci5sZW5ndGggKz0gc2Vjb25kX2Fycl9sZW5ndGg7XG4gIFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzZWNvbmRfYXJyX2xlbmd0aDsgaSsrKSB7XG4gICAgXHRmaXJzdF9hcnJbZmlyc3RfYXJyX2xlbmd0aCArIGldID0gc2Vjb25kX2FycltpXTtcbiAgXHR9XG59XG5cbi8qXG5cdHJlbW92ZSBkdXBsaWNhdGVzIGluIGEgc29ydGVkIGFycmF5XG4qL1xuZnVuY3Rpb24gcmVtb3ZlX2R1cGxpY2F0ZXMoc29ydGVkX2Fycikge1xuXHRsZXQgaSA9IDA7XG5cdHdoaWxlICh0cnVlKSB7XG5cdFx0aWYgKGkgKyAxID49IHNvcnRlZF9hcnIubGVuZ3RoKSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdFx0aWYgKGVuZHBvaW50LmVxKHNvcnRlZF9hcnJbaV0sIHNvcnRlZF9hcnJbaSArIDFdKSkge1xuXHRcdFx0c29ydGVkX2Fyci5zcGxpY2UoaSArIDEsIDEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpICs9IDE7XG5cdFx0fVxuXHR9XG59XG4iLCJpbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UsIG5lYXJieV9mcm9tIH0gZnJvbSBcIi4vbmVhcmJ5X2Jhc2UuanNcIjtcbmltcG9ydCB7IFNvcnRlZEFycmF5IH0gZnJvbSBcIi4vdXRpbC9zb3J0ZWRhcnJheS5qc1wiO1xuaW1wb3J0IHsgaXNfY29sbGVjdGlvbl9wcm92aWRlciB9IGZyb20gXCIuL3Byb3ZpZGVyX2NvbGxlY3Rpb24uanNcIjtcbmltcG9ydCB7IGlzX3ZhcmlhYmxlX3Byb3ZpZGVyIH0gZnJvbSBcIi4vcHJvdmlkZXJfdmFyaWFibGUuanNcIjtcblxuY29uc3Qge0xPV19DTE9TRUQsIExPV19PUEVOLCBISUdIX0NMT1NFRCwgSElHSF9PUEVOfSA9IGVuZHBvaW50LnR5cGVzO1xuY29uc3QgRVBfVFlQRVMgPSBbTE9XX0NMT1NFRCwgTE9XX09QRU4sIEhJR0hfQ0xPU0VELCBISUdIX09QRU5dO1xuXG5cbi8vIFNldCBvZiB1bmlxdWUgW3YsIHRdIGVuZHBvaW50c1xuY2xhc3MgRW5kcG9pbnRTZXQge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLl9tYXAgPSBuZXcgTWFwKFtcblx0XHRcdFtMT1dfQ0xPU0VELCBuZXcgU2V0KCldLFxuXHRcdFx0W0xPV19PUEVOLCBuZXcgU2V0KCldLCBcblx0XHRcdFtISUdIX0NMT1NFRCwgbmV3IFNldCgpXSwgXG5cdFx0XHRbSElHSF9PUEVOLCBuZXcgU2V0KCldXG5cdFx0XSk7XG5cdH1cblx0YWRkKGVwKSB7XG5cdFx0Y29uc3QgW3ZhbHVlLCB0eXBlXSA9IGVwO1xuXHRcdHJldHVybiB0aGlzLl9tYXAuZ2V0KHR5cGUpLmFkZCh2YWx1ZSk7XG5cdH1cblx0aGFzIChlcCkge1xuXHRcdGNvbnN0IFt2YWx1ZSwgdHlwZV0gPSBlcDtcblx0XHRyZXR1cm4gdGhpcy5fbWFwLmdldCh0eXBlKS5oYXModmFsdWUpO1xuXHR9XG5cdGdldChlcCkge1xuXHRcdGNvbnN0IFt2YWx1ZSwgdHlwZV0gPSBlcDtcblx0XHRyZXR1cm4gdGhpcy5fbWFwLmdldCh0eXBlKS5nZXQodmFsdWUpO1xuXHR9XG5cblx0bGlzdCgpIHtcblx0XHRjb25zdCBsaXN0cyA9IEVQX1RZUEVTLm1hcCgodHlwZSkgPT4ge1xuXHRcdFx0cmV0dXJuIFsuLi50aGlzLl9tYXAuZ2V0KHR5cGUpLnZhbHVlcygpXVxuXHRcdFx0XHQubWFwKCh2YWx1ZSkgPT4gW3ZhbHVlLCB0eXBlXSk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIFtdLmNvbmNhdCguLi5saXN0cyk7XG5cdH1cbn1cblxuLyoqXG4gKiBJVEVNUyBNQVBcbiAqIFxuICogbWFwIGVuZHBvaW50IC0+IHtcbiAqIFx0bG93OiBbaXRlbXNdLCBcbiAqICBhY3RpdmU6IFtpdGVtc10sIFxuICogIGhpZ2g6W2l0ZW1zXVxuICogfVxuICogXG4gKiBpbiBvcmRlciB0byB1c2UgZW5kcG9pbnQgW3YsdF0gYXMgYSBtYXAga2V5IHdlIGNyZWF0ZSBhIHR3byBsZXZlbFxuICogbWFwIC0gdXNpbmcgdCBhcyB0aGUgZmlyc3QgdmFyaWFibGUuIFxuICogXG4gKi9cblxuXG5jb25zdCBMT1cgPSBcImxvd1wiO1xuY29uc3QgQUNUSVZFID0gXCJhY3RpdmVcIjtcbmNvbnN0IEhJR0ggPSBcImhpZ2hcIjtcblxuXG5jbGFzcyBJdGVtc01hcCB7XG5cblx0Y29uc3RydWN0b3IgKCkge1xuXHRcdC8vIG1hcCBlbmRwb2ludCAtPiB7bG93OiBbaXRlbXNdLCBhY3RpdmU6IFtpdGVtc10sIGhpZ2g6W2l0ZW1zXX1cblx0XHR0aGlzLl9tYXAgPSBuZXcgTWFwKFtcblx0XHRcdFtMT1dfQ0xPU0VELCBuZXcgTWFwKCldLFxuXHRcdFx0W0xPV19PUEVOLCBuZXcgTWFwKCldLCBcblx0XHRcdFtISUdIX0NMT1NFRCwgbmV3IE1hcCgpXSwgXG5cdFx0XHRbSElHSF9PUEVOLCBuZXcgTWFwKCldXG5cdFx0XSk7XG5cdH1cblxuXHRnZXRfaXRlbXNfYnlfcm9sZSAoZXAsIHJvbGUpIHtcblx0XHRjb25zdCBbdmFsdWUsIHR5cGVdID0gZXA7XG5cdFx0Y29uc3QgZW50cnkgPSB0aGlzLl9tYXAuZ2V0KHR5cGUpLmdldCh2YWx1ZSk7XG5cdFx0cmV0dXJuIChlbnRyeSAhPSB1bmRlZmluZWQpID8gZW50cnlbcm9sZV0gOiBbXTtcblx0fVxuXG5cdC8qXG5cdFx0cmVnaXN0ZXIgaXRlbSB3aXRoIGVuZHBvaW50IChpZGVtcG90ZW50KVxuXHRcdHJldHVybiB0cnVlIGlmIHRoaXMgd2FzIHRoZSBmaXJzdCBMT1cgb3IgSElHSCBcblx0ICovXG5cdHJlZ2lzdGVyKGVwLCBpdGVtLCByb2xlKSB7XG5cdFx0Y29uc3QgW3ZhbHVlLCB0eXBlXSA9IGVwO1xuXHRcdGNvbnN0IHR5cGVfbWFwID0gdGhpcy5fbWFwLmdldCh0eXBlKTtcblx0XHRpZiAoIXR5cGVfbWFwLmhhcyh2YWx1ZSkpIHtcblx0XHRcdHR5cGVfbWFwLnNldCh2YWx1ZSwge2xvdzogW10sIGFjdGl2ZTpbXSwgaGlnaDpbXX0pO1xuXHRcdH1cblx0XHRjb25zdCBlbnRyeSA9IHR5cGVfbWFwLmdldCh2YWx1ZSk7XG5cdFx0Y29uc3Qgd2FzX2VtcHR5ID0gZW50cnlbTE9XXS5sZW5ndGggKyBlbnRyeVtISUdIXS5sZW5ndGggPT0gMDtcblx0XHRsZXQgaWR4ID0gZW50cnlbcm9sZV0uZmluZEluZGV4KChfaXRlbSkgPT4ge1xuXHRcdFx0cmV0dXJuIF9pdGVtLmlkID09IGl0ZW0uaWQ7XG5cdFx0fSk7XG5cdFx0aWYgKGlkeCA9PSAtMSkge1xuXHRcdFx0ZW50cnlbcm9sZV0ucHVzaChpdGVtKTtcblx0XHR9XG5cdFx0Y29uc3QgaXNfZW1wdHkgPSBlbnRyeVtMT1ddLmxlbmd0aCArIGVudHJ5W0hJR0hdLmxlbmd0aCA9PSAwO1xuXHRcdHJldHVybiB3YXNfZW1wdHkgJiYgIWlzX2VtcHR5O1xuXHR9XG5cblx0Lypcblx0XHR1bnJlZ2lzdGVyIGl0ZW0gd2l0aCBlbmRwb2ludCAoaW5kZXBlbmRlbnQgb2Ygcm9sZSlcblx0XHRyZXR1cm4gdHJ1ZSBpZiB0aGlzIHJlbW92ZWQgbGFzdCBMT1cgb3IgSElHSFxuXHQgKi9cblx0dW5yZWdpc3RlcihlcCwgaXRlbSkge1xuXHRcdGNvbnN0IFt2YWx1ZSwgdHlwZV0gPSBlcDtcblx0XHRjb25zdCB0eXBlX21hcCA9IHRoaXMuX21hcC5nZXQodHlwZSk7XG5cdFx0Y29uc3QgZW50cnkgPSB0eXBlX21hcC5nZXQodmFsdWUpO1xuXHRcdGlmIChlbnRyeSAhPSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IHdhc19lbXB0eSA9IGVudHJ5W0xPV10ubGVuZ3RoICsgZW50cnlbSElHSF0ubGVuZ3RoID09IDA7XG5cdFx0XHQvLyByZW1vdmUgYWxsIG1lbnRpb25lcyBvZiBpdGVtXG5cdFx0XHRmb3IgKGNvbnN0IHJvbGUgb2YgW0xPVywgQUNUSVZFLCBISUdIXSkge1xuXHRcdFx0XHRsZXQgaWR4ID0gZW50cnlbcm9sZV0uZmluZEluZGV4KChfaXRlbSkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBfaXRlbS5pZCA9PSBpdGVtLmlkO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKGlkeCA+IC0xKSB7XG5cdFx0XHRcdFx0ZW50cnlbcm9sZV0uc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRcdH1cdFxuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaXNfZW1wdHkgPSBlbnRyeVtMT1ddLmxlbmd0aCArIGVudHJ5W0hJR0hdLmxlbmd0aCA9PSAwO1xuXHRcdFx0aWYgKCF3YXNfZW1wdHkgJiYgaXNfZW1wdHkpIHtcblx0XHRcdFx0Ly8gY2xlYW4gdXAgZW50cnlcblx0XHRcdFx0dHlwZV9tYXAuZGVsZXRlKHZhbHVlKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuXG5cbi8qKlxuICogTmVhcmJ5SW5kZXhcbiAqIFxuICogTmVhcmJ5SW5kZXggZm9yIENvbGxlY3Rpb25Qcm92aWRlciBvciBWYXJpYWJsZVByb3ZpZGVyXG4gKi9cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKHN0YXRlUHJvdmlkZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcdFx0XG5cblx0XHRpZiAoXG5cdFx0XHQhaXNfY29sbGVjdGlvbl9wcm92aWRlcihzdGF0ZVByb3ZpZGVyKSAmJlxuXHRcdFx0IWlzX3ZhcmlhYmxlX3Byb3ZpZGVyKHN0YXRlUHJvdmlkZXIpXG5cdFx0KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYHN0YXRlUHJvdmlkZXIgbXVzdCBiZSBjb2xsZWN0aW9uUHJvdmlkZXIgb3IgdmFyaWFibGVQcm92aWRlciAke3N0YXRlUHJvdmlkZXJ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fc3AgPSBzdGF0ZVByb3ZpZGVyO1xuXHRcdHRoaXMuX2luaXRpYWxpc2UoKTtcblx0XHR0aGlzLnJlZnJlc2goKTtcblx0fVxuXG4gICAgZ2V0IHNyYyAoKSB7cmV0dXJuIHRoaXMuX3NwO31cblxuXG5cdF9pbml0aWFsaXNlKCkge1xuXHRcdC8vIHJlZ2lzdGVyIGl0ZW1zIHdpdGggZW5kcG9pbnRzXG5cdFx0dGhpcy5faXRlbXNtYXAgPSBuZXcgSXRlbXNNYXAoKTtcblx0XHQvLyBzb3J0ZWQgaW5kZXhcblx0XHR0aGlzLl9lbmRwb2ludHMgPSBuZXcgU29ydGVkQXJyYXkoKTtcblx0XHQvLyBzd2lwZSBpbmRleFxuXHRcdHRoaXMuX2luZGV4ID0gW107XG5cdH1cblxuXG5cdHJlZnJlc2goZGlmZnMpIHtcblxuXHRcdGNvbnN0IHJlbW92ZV9lbmRwb2ludHMgPSBuZXcgRW5kcG9pbnRTZXQoKTtcblx0XHRjb25zdCBpbnNlcnRfZW5kcG9pbnRzID0gbmV3IEVuZHBvaW50U2V0KCk7XG5cblx0XHRsZXQgaW5zZXJ0X2l0ZW1zID0gW107XG5cdFx0bGV0IHJlbW92ZV9pdGVtcyA9IFtdO1xuXG5cdFx0aWYgKGRpZmZzID09IHVuZGVmaW5lZCkge1xuXHRcdFx0aW5zZXJ0X2l0ZW1zID0gdGhpcy5zcmMuZ2V0KCkgfHwgW107XG5cdFx0XHQvLyBjbGVhciBhbGwgc3RhdGVcblx0XHRcdHRoaXMuX2luaXRpYWxpc2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gY29sbGVjdCBpbnNlcnQgaXRlbXMgYW5kIHJlbW92ZSBpdGVtc1xuXHRcdFx0Zm9yIChjb25zdCBkaWZmIG9mIGRpZmZzKSB7XG5cdFx0XHRcdGlmIChkaWZmLm5ldyAhPSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRpbnNlcnRfaXRlbXMucHVzaChkaWZmLm5ldyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGRpZmYub2xkICE9IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJlbW92ZV9pdGVtcy5wdXNoKGRpZmYub2xkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qXG5cdFx0XHR1bnJlZ2lzdGVyIHJlbW92ZSBpdGVtcyBhY3Jvc3MgYWxsIGVuZHBvaW50cyBcblx0XHRcdHdoZXJlIHRoZXkgd2VyZSByZWdpc3RlcmVkIChMT1csIEFDVElWRSwgSElHSCkgXG5cdFx0Ki9cblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgcmVtb3ZlX2l0ZW1zKSB7XHRcdFx0XG5cdFx0XHRmb3IgKGNvbnN0IGVwIG9mIHRoaXMuX2VuZHBvaW50cy5sb29rdXAoaXRlbS5pdHYpKSB7XG5cdFx0XHRcdC8vIFRPRE86IGNoZWNrIGlmIHRoaXMgaXMgY29ycmVjdFxuXHRcdFx0XHRjb25zdCBiZWNhbWVfZW1wdHkgPSB0aGlzLl9pdGVtc21hcC51bnJlZ2lzdGVyKGVwLCBpdGVtKTtcblx0XHRcdFx0aWYgKGJlY2FtZV9lbXB0eSkgcmVtb3ZlX2VuZHBvaW50cy5hZGQoZXApO1xuXHRcdFx0fVx0XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRcdHJlZ2lzdGVyIG5ldyBpdGVtcyBhY3Jvc3MgYWxsIGVuZHBvaW50cyBcblx0XHRcdHdoZXJlIHRoZXkgc2hvdWxkIGJlIHJlZ2lzdGVyZWQgKExPVywgSElHSCkgXG5cdFx0Ki9cblx0XHRsZXQgYmVjYW1lX25vbmVtcHR5O1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBpbnNlcnRfaXRlbXMpIHtcblx0XHRcdGNvbnN0IFtsb3csIGhpZ2hdID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dik7XG5cdFx0XHRiZWNhbWVfbm9uZW1wdHkgPSB0aGlzLl9pdGVtc21hcC5yZWdpc3Rlcihsb3csIGl0ZW0sIExPVyk7XG5cdFx0XHRpZiAoYmVjYW1lX25vbmVtcHR5KSBpbnNlcnRfZW5kcG9pbnRzLmFkZChsb3cpO1xuXHRcdFx0YmVjYW1lX25vbmVtcHR5ID0gdGhpcy5faXRlbXNtYXAucmVnaXN0ZXIoaGlnaCwgaXRlbSwgSElHSCk7XG5cdFx0XHRpZiAoYmVjYW1lX25vbmVtcHR5KSBpbnNlcnRfZW5kcG9pbnRzLmFkZChoaWdoKTtcblx0XHR9XG5cblx0XHQvKlxuXHRcdFx0cmVmcmVzaCBzb3J0ZWQgZW5kcG9pbnRzXG5cdFx0XHRwb3NzaWJsZSB0aGF0IGFuIGVuZHBvaW50IGlzIHByZXNlbnQgaW4gYm90aCBsaXN0c1xuXHRcdFx0dGhpcyBpcyBwcmVzdW1hYmx5IG5vdCBhIHByb2JsZW0gd2l0aCBTb3J0ZWRBcnJheS5cblx0XHQqL1xuXHRcdHRoaXMuX2VuZHBvaW50cy51cGRhdGUoXG5cdFx0XHRyZW1vdmVfZW5kcG9pbnRzLmxpc3QoKSwgXG5cdFx0XHRpbnNlcnRfZW5kcG9pbnRzLmxpc3QoKVxuXHRcdCk7XG5cblx0XHQvKlxuXHRcdFx0c3dpcGUgb3ZlciB0byBlbnN1cmUgdGhhdCBhbGwgaXRlbXMgYXJlIGFjdGl2YXRlXG5cdFx0Ki9cblx0XHRjb25zdCBhY3RpdmVTZXQgPSBuZXcgU2V0KCk7XG5cdFx0Zm9yIChjb25zdCBlcCBvZiB0aGlzLl9lbmRwb2ludHMuYXJyYXkpIHtcdFxuXHRcdFx0Ly8gQWRkIGl0ZW1zIHdpdGggZXAgYXMgbG93IHBvaW50XG5cdFx0XHRmb3IgKGxldCBpdGVtIG9mIHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKGVwLCBMT1cpKSB7XG5cdFx0XHRcdGFjdGl2ZVNldC5hZGQoaXRlbSk7XG5cdFx0XHR9O1xuXHRcdFx0Ly8gYWN0aXZhdGUgdXNpbmcgYWN0aXZlU2V0XG5cdFx0XHRmb3IgKGxldCBpdGVtIG9mIGFjdGl2ZVNldCkge1xuXHRcdFx0XHR0aGlzLl9pdGVtc21hcC5yZWdpc3RlcihlcCwgaXRlbSwgQUNUSVZFKTtcblx0XHRcdH1cblx0XHRcdC8vIFJlbW92ZSBpdGVtcyB3aXRoIHAxIGFzIGhpZ2ggcG9pbnRcblx0XHRcdGZvciAobGV0IGl0ZW0gb2YgdGhpcy5faXRlbXNtYXAuZ2V0X2l0ZW1zX2J5X3JvbGUoZXAsIEhJR0gpKSB7XG5cdFx0XHRcdGFjdGl2ZVNldC5kZWxldGUoaXRlbSk7XG5cdFx0XHR9O1x0XG5cdFx0fVxuXHR9XG5cblx0X2NvdmVycyAob2Zmc2V0KSB7XG5cdFx0Y29uc3QgZXAgPSBlbmRwb2ludC5mcm9tX2lucHV0KG9mZnNldCk7XG5cdFx0Y29uc3QgZXAxID0gdGhpcy5fZW5kcG9pbnRzLmxlKGVwKSB8fCBlbmRwb2ludC5ORUdfSU5GO1xuXHRcdGNvbnN0IGVwMiA9IHRoaXMuX2VuZHBvaW50cy5nZShlcCkgfHwgZW5kcG9pbnQuUE9TX0lORjtcblx0XHRpZiAoZW5kcG9pbnQuZXEoZXAxLCBlcDIpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5faXRlbXNtYXAuZ2V0X2l0ZW1zX2J5X3JvbGUoZXAxLCBBQ1RJVkUpO1x0XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGdldCBpdGVtcyBmb3IgYm90aCBlbmRwb2ludHNcblx0XHRcdGNvbnN0IGl0ZW1zMSA9IHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKGVwMSwgQUNUSVZFKTtcblx0XHRcdGNvbnN0IGl0ZW1zMiA9IHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKGVwMiwgQUNUSVZFKTtcblx0XHRcdC8vIHJldHVybiBhbGwgaXRlbXMgdGhhdCBhcmUgYWN0aXZlIGluIGJvdGggZW5kcG9pbnRzXG5cdFx0XHRjb25zdCBpZFNldCA9IG5ldyBTZXQoaXRlbXMxLm1hcChpdGVtID0+IGl0ZW0uaWQpKTtcblx0XHRcdHJldHVybiBpdGVtczIuZmlsdGVyKGl0ZW0gPT4gaWRTZXQuaGFzKGl0ZW0uaWQpKTtcblx0XHR9XG5cdH1cblxuICAgIC8qXG5cdFx0bmVhcmJ5IChvZmZzZXQpXG4gICAgKi9cblx0bmVhcmJ5KG9mZnNldCkge1xuXHRcdGNvbnN0IGVwID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuXG5cdFx0Ly8gY2VudGVyXG5cdFx0bGV0IGNlbnRlciA9IHRoaXMuX2NvdmVycyhlcClcblx0XHRjb25zdCBjZW50ZXJfaGlnaF9saXN0ID0gW107XG5cdFx0Y29uc3QgY2VudGVyX2xvd19saXN0ID0gW107XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIGNlbnRlcikge1xuXHRcdFx0Y29uc3QgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW0uaXR2KTtcblx0XHRcdGNlbnRlcl9oaWdoX2xpc3QucHVzaChoaWdoKTtcblx0XHRcdGNlbnRlcl9sb3dfbGlzdC5wdXNoKGxvdyk7ICAgIFxuXHRcdH1cblxuXHRcdC8vIHByZXYgaGlnaFxuXHRcdGxldCBwcmV2X2hpZ2ggPSBlcDtcblx0XHRsZXQgaXRlbXM7XG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdHByZXZfaGlnaCA9IHRoaXMuX2VuZHBvaW50cy5sdChwcmV2X2hpZ2gpIHx8IGVuZHBvaW50Lk5FR19JTkY7XG5cdFx0XHRpZiAocHJldl9oaWdoWzBdID09IG51bGwpIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHRcdGl0ZW1zID0gdGhpcy5faXRlbXNtYXAuZ2V0X2l0ZW1zX2J5X3JvbGUocHJldl9oaWdoLCBISUdIKTtcblx0XHRcdGlmIChpdGVtcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gbmV4dCBsb3dcblx0XHRsZXQgbmV4dF9sb3cgPSBlcDtcblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0bmV4dF9sb3cgPSB0aGlzLl9lbmRwb2ludHMuZ3QobmV4dF9sb3cpIHx8IGVuZHBvaW50LlBPU19JTkZcblx0XHRcdGlmIChuZXh0X2xvd1swXSA9PSBudWxsKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0XHRpdGVtcyA9IHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKG5leHRfbG93LCBMT1cpO1xuXHRcdFx0aWYgKGl0ZW1zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbmVhcmJ5X2Zyb20oXG5cdFx0XHRwcmV2X2hpZ2gsIFxuXHRcdFx0Y2VudGVyX2xvd19saXN0LCBcblx0XHRcdGNlbnRlcixcblx0XHRcdGNlbnRlcl9oaWdoX2xpc3QsXG5cdFx0XHRuZXh0X2xvd1xuXHRcdCk7XG5cdH1cbn0iLCJpbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgbW90aW9uX3V0aWxzIH0gZnJvbSBcIi4vY29tbW9uLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuQkFTRSBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuXHRBYnN0cmFjdCBCYXNlIENsYXNzIGZvciBTZWdtZW50c1xuXG4gICAgY29uc3RydWN0b3IoaW50ZXJ2YWwpXG5cbiAgICAtIGludGVydmFsOiBpbnRlcnZhbCBvZiB2YWxpZGl0eSBvZiBzZWdtZW50XG4gICAgLSBkeW5hbWljOiB0cnVlIGlmIHNlZ21lbnQgaXMgZHluYW1pY1xuICAgIC0gdmFsdWUob2Zmc2V0KTogdmFsdWUgb2Ygc2VnbWVudCBhdCBvZmZzZXRcbiAgICAtIHF1ZXJ5KG9mZnNldCk6IHN0YXRlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4qL1xuXG5leHBvcnQgY2xhc3MgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0dikge1xuXHRcdHRoaXMuX2l0diA9IGl0djtcblx0fVxuXG5cdGdldCBpdHYoKSB7cmV0dXJuIHRoaXMuX2l0djt9XG5cbiAgICAvKiogXG4gICAgICogaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3NcbiAgICAgKiByZXR1cm5zIHt2YWx1ZSwgZHluYW1pY307XG4gICAgKi9cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjb252ZW5pZW5jZSBmdW5jdGlvbiByZXR1cm5pbmcgdGhlIHN0YXRlIG9mIHRoZSBzZWdtZW50XG4gICAgICogQHBhcmFtIHsqfSBvZmZzZXQgXG4gICAgICogQHJldHVybnMgXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5faXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuc3RhdGUob2Zmc2V0KSwgb2Zmc2V0fTtcbiAgICAgICAgfSBcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdW5kZWZpbmVkLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgIH1cbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU1RBVElDIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIFN0YXRpY1NlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG5cdFx0dGhpcy5fdmFsdWUgPSBkYXRhO1xuXHR9XG5cblx0c3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3ZhbHVlLCBkeW5hbWljOmZhbHNlfVxuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTU9USU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIE1vdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG4gICAgXG4gICAgY29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIHRoaXMuX3ZlY3RvciA9IGRhdGE7XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IFtwLHYsYSx0XSA9IG1vdGlvbl91dGlscy5jYWxjdWxhdGUodGhpcy5fdmVjdG9yLCBvZmZzZXQpO1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiBwLCBkeW5hbWljOiAodiAhPSAwIHx8IGEgIT0gMCApfVxuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBUUkFOU0lUSU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBTdXBwb3J0ZWQgZWFzaW5nIGZ1bmN0aW9uc1xuICAgIFwiZWFzZS1pblwiOlxuICAgIFwiZWFzZS1vdXRcIjpcbiAgICBcImVhc2UtaW4tb3V0XCJcbiovXG5cbmZ1bmN0aW9uIGVhc2VpbiAodHMpIHtcbiAgICByZXR1cm4gTWF0aC5wb3codHMsMik7ICBcbn1cbmZ1bmN0aW9uIGVhc2VvdXQgKHRzKSB7XG4gICAgcmV0dXJuIDEgLSBlYXNlaW4oMSAtIHRzKTtcbn1cbmZ1bmN0aW9uIGVhc2Vpbm91dCAodHMpIHtcbiAgICBpZiAodHMgPCAuNSkge1xuICAgICAgICByZXR1cm4gZWFzZWluKDIgKiB0cykgLyAyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAoMiAtIGVhc2VpbigyICogKDEgLSB0cykpKSAvIDI7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgVHJhbnNpdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG5cdFx0c3VwZXIoaXR2KTtcbiAgICAgICAgbGV0IHt2MCwgdjEsIGVhc2luZ30gPSBkYXRhO1xuICAgICAgICBsZXQgW3QwLCB0MV0gPSB0aGlzLl9pdHYuc2xpY2UoMCwyKTtcblxuICAgICAgICAvLyBjcmVhdGUgdGhlIHRyYW5zaXRpb24gZnVuY3Rpb25cbiAgICAgICAgdGhpcy5fZHluYW1pYyA9IHYxLXYwICE9IDA7XG4gICAgICAgIHRoaXMuX3RyYW5zID0gZnVuY3Rpb24gKHRzKSB7XG4gICAgICAgICAgICAvLyBjb252ZXJ0IHRzIHRvIFt0MCx0MV0tc3BhY2VcbiAgICAgICAgICAgIC8vIC0gc2hpZnQgZnJvbSBbdDAsdDFdLXNwYWNlIHRvIFswLCh0MS10MCldLXNwYWNlXG4gICAgICAgICAgICAvLyAtIHNjYWxlIGZyb20gWzAsKHQxLXQwKV0tc3BhY2UgdG8gWzAsMV0tc3BhY2VcbiAgICAgICAgICAgIHRzID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHRzID0gdHMvcGFyc2VGbG9hdCh0MS10MCk7XG4gICAgICAgICAgICAvLyBlYXNpbmcgZnVuY3Rpb25zIHN0cmV0Y2hlcyBvciBjb21wcmVzc2VzIHRoZSB0aW1lIHNjYWxlIFxuICAgICAgICAgICAgaWYgKGVhc2luZyA9PSBcImVhc2UtaW5cIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZWluKHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWFzaW5nID09IFwiZWFzZS1vdXRcIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZW91dCh0cyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVhc2luZyA9PSBcImVhc2UtaW4tb3V0XCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2Vpbm91dCh0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBsaW5lYXIgdHJhbnNpdGlvbiBmcm9tIHYwIHRvIHYxLCBmb3IgdGltZSB2YWx1ZXMgWzAsMV1cbiAgICAgICAgICAgIHRzID0gTWF0aC5tYXgodHMsIDApO1xuICAgICAgICAgICAgdHMgPSBNYXRoLm1pbih0cywgMSk7XG4gICAgICAgICAgICByZXR1cm4gdjAgKyAodjEtdjApKnRzO1xuICAgICAgICB9XG5cdH1cblxuXHRzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdGhpcy5fdHJhbnMob2Zmc2V0KSwgZHluYW1pYzp0aGlzLl9keW5hbWljfVxuXHR9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBJTlRFUlBPTEFUSU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBGdW5jdGlvbiB0byBjcmVhdGUgYW4gaW50ZXJwb2xhdG9yIGZvciBuZWFyZXN0IG5laWdoYm9yIGludGVycG9sYXRpb24gd2l0aFxuICogZXh0cmFwb2xhdGlvbiBzdXBwb3J0LlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHR1cGxlcyAtIEFuIGFycmF5IG9mIFt2YWx1ZSwgb2Zmc2V0XSBwYWlycywgd2hlcmUgdmFsdWUgaXMgdGhlXG4gKiBwb2ludCdzIHZhbHVlIGFuZCBvZmZzZXQgaXMgdGhlIGNvcnJlc3BvbmRpbmcgb2Zmc2V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSAtIEEgZnVuY3Rpb24gdGhhdCB0YWtlcyBhbiBvZmZzZXQgYW5kIHJldHVybnMgdGhlXG4gKiBpbnRlcnBvbGF0ZWQgb3IgZXh0cmFwb2xhdGVkIHZhbHVlLlxuICovXG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKHR1cGxlcykge1xuXG4gICAgaWYgKHR1cGxlcy5sZW5ndGggPCAxKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3IgKCkge3JldHVybiB1bmRlZmluZWQ7fVxuICAgIH0gZWxzZSBpZiAodHVwbGVzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3IgKCkge3JldHVybiB0dXBsZXNbMF1bMF07fVxuICAgIH1cblxuICAgIC8vIFNvcnQgdGhlIHR1cGxlcyBieSB0aGVpciBvZmZzZXRzXG4gICAgY29uc3Qgc29ydGVkVHVwbGVzID0gWy4uLnR1cGxlc10uc29ydCgoYSwgYikgPT4gYVsxXSAtIGJbMV0pO1xuICBcbiAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yKG9mZnNldCkge1xuICAgICAgLy8gSGFuZGxlIGV4dHJhcG9sYXRpb24gYmVmb3JlIHRoZSBmaXJzdCBwb2ludFxuICAgICAgaWYgKG9mZnNldCA8PSBzb3J0ZWRUdXBsZXNbMF1bMV0pIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbMF07XG4gICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzWzFdO1xuICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEhhbmRsZSBleHRyYXBvbGF0aW9uIGFmdGVyIHRoZSBsYXN0IHBvaW50XG4gICAgICBpZiAob2Zmc2V0ID49IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMV1bMV0pIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDJdO1xuICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMV07XG4gICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgIH1cbiAgXG4gICAgICAvLyBGaW5kIHRoZSBuZWFyZXN0IHBvaW50cyB0byB0aGUgbGVmdCBhbmQgcmlnaHRcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc29ydGVkVHVwbGVzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICBpZiAob2Zmc2V0ID49IHNvcnRlZFR1cGxlc1tpXVsxXSAmJiBvZmZzZXQgPD0gc29ydGVkVHVwbGVzW2kgKyAxXVsxXSkge1xuICAgICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzW2ldO1xuICAgICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzW2kgKyAxXTtcbiAgICAgICAgICAvLyBMaW5lYXIgaW50ZXJwb2xhdGlvbiBmb3JtdWxhOiB5ID0geTEgKyAoICh4IC0geDEpICogKHkyIC0geTEpIC8gKHgyIC0geDEpIClcbiAgICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgXG4gICAgICAvLyBJbiBjYXNlIHRoZSBvZmZzZXQgZG9lcyBub3QgZmFsbCB3aXRoaW4gYW55IHJhbmdlIChzaG91bGQgYmUgY292ZXJlZCBieSB0aGUgcHJldmlvdXMgY29uZGl0aW9ucylcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfTtcbn1cbiAgXG5cbmV4cG9ydCBjbGFzcyBJbnRlcnBvbGF0aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuICAgIGNvbnN0cnVjdG9yKGl0diwgdHVwbGVzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIC8vIHNldHVwIGludGVycG9sYXRpb24gZnVuY3Rpb25cbiAgICAgICAgdGhpcy5fdHJhbnMgPSBpbnRlcnBvbGF0ZSh0dXBsZXMpO1xuICAgIH1cblxuICAgIHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl90cmFucyhvZmZzZXQpLCBkeW5hbWljOnRydWV9O1xuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTE9BRCBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBmdW5jdGlvbiBsb2FkX3NlZ21lbnQoaXR2LCBpdGVtKSB7XG4gICAgbGV0IHt0eXBlPVwic3RhdGljXCIsIGRhdGF9ID0gaXRlbTtcbiAgICBpZiAodHlwZSA9PSBcInN0YXRpY1wiKSB7XG4gICAgICAgIHJldHVybiBuZXcgU3RhdGljU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IFRyYW5zaXRpb25TZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwiaW50ZXJwb2xhdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgSW50ZXJwb2xhdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJtb3Rpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IE1vdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhcInVucmVjb2duaXplZCBzZWdtZW50IHR5cGVcIiwgdHlwZSk7XG4gICAgfVxufVxuIiwiaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi91dGlsL2FwaV9zcmNwcm9wLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuL2xheWVyX2Jhc2UuanNcIjtcbmltcG9ydCB7IGlzX2NvbGxlY3Rpb25fcHJvdmlkZXIgfSBmcm9tIFwiLi9wcm92aWRlcl9jb2xsZWN0aW9uLmpzXCI7XG5pbXBvcnQgeyBpc192YXJpYWJsZV9wcm92aWRlcn0gZnJvbSBcIi4vcHJvdmlkZXJfdmFyaWFibGUuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4IH0gZnJvbSBcIi4vbmVhcmJ5X2luZGV4LmpzXCI7XG5pbXBvcnQgeyBsb2FkX3NlZ21lbnQgfSBmcm9tIFwiLi91dGlsL3NlZ21lbnRzLmpzXCI7XG5pbXBvcnQgeyB0b1N0YXRlIH0gZnJvbSBcIi4vdXRpbC9jb21tb24uanNcIjtcbmltcG9ydCB7IGVuZHBvaW50LCBpbnRlcnZhbCB9IGZyb20gXCIuL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBJVEVNUyBMQVlFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEl0ZW1zIExheWVyIGhhcyBhIHN0YXRlUHJvdmlkZXIgKGVpdGhlciBjb2xsZWN0aW9uUHJvdmlkZXIgb3IgdmFyaWFibGVQcm92aWRlcilcbiAqIGFzIHNyYyBwcm9wZXJ0eS5cbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gaXNfaXRlbXNfbGF5ZXIgKG9iaikge1xuICAgIGlmIChvYmogPT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gaXMgbGF5ZXJcbiAgICBpZiAoIShvYmogaW5zdGFuY2VvZiBMYXllcikpIHJldHVybiBmYWxzZTtcbiAgICAvLyBoYXMgc3JjIHByb3BlcnR5XG4gICAgY29uc3QgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBcInNyY1wiKTtcbiAgICBpZiAoISEoZGVzYz8uZ2V0ICYmIGRlc2M/LnNldCkgPT0gZmFsc2UpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGl0ZW1zX2xheWVyKG9wdGlvbnM9e30pIHtcblxuICAgIGNvbnN0IHtzcmMsIC4uLm9wdHN9ID0gb3B0aW9ucztcbiAgICBjb25zdCBsYXllciA9IG5ldyBMYXllcih7Q2FjaGVDbGFzczpJdGVtc0xheWVyQ2FjaGUsIC4uLm9wdHN9KTtcblxuICAgIC8vIHNldHVwIHNyYyBwcm9wZXJ0eVxuICAgIHNyY3Byb3AuYWRkU3RhdGUobGF5ZXIpO1xuICAgIHNyY3Byb3AuYWRkTWV0aG9kcyhsYXllcik7XG5cbiAgICBsYXllci5zcmNwcm9wX3JlZ2lzdGVyKFwic3JjXCIpO1xuICAgIGxheWVyLnNyY3Byb3BfY2hlY2sgPSBmdW5jdGlvbiAocHJvcE5hbWUsIHNyYykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzcmNcIikge1xuICAgICAgICAgICAgaWYgKCEoaXNfY29sbGVjdGlvbl9wcm92aWRlcihzcmMpKSAmJiAhKGlzX3ZhcmlhYmxlX3Byb3ZpZGVyKHNyYykpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcInNyY1wiIG11c3QgY29sbGVjdGlvblByb3ZpZGVyIG9yIHZhcmlhYmxlUHJvdmlkZXIgJHtzcmN9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3JjOyAgICBcbiAgICAgICAgfVxuICAgIH1cbiAgICBsYXllci5zcmNwcm9wX29uY2hhbmdlID0gZnVuY3Rpb24gKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAoZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNfY29sbGVjdGlvbl9wcm92aWRlcihsYXllci5zcmMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLmluZGV4ID0gbmV3IE5lYXJieUluZGV4KGxheWVyLnNyYyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc192YXJpYWJsZV9wcm92aWRlcihsYXllci5zcmMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLmluZGV4ID0gbmV3IE5lYXJieUluZGV4KGxheWVyLnNyYyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGlmIChsYXllci5pbmRleCAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNfY29sbGVjdGlvbl9wcm92aWRlcihsYXllci5zcmMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLmluZGV4LnJlZnJlc2goZUFyZyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc192YXJpYWJsZV9wcm92aWRlcihsYXllci5zcmMpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLmluZGV4LnJlZnJlc2goKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGF5ZXIub25jaGFuZ2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSAgICAgICAgXG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBjb252ZW5pZW5jZSBtZXRob2QgZm9yIGdldHRpbmcgaXRlbXMgdmFsaWQgYXQgb2Zmc2V0XG4gICAgICogb25seSBpdGVtcyBsYXllciBzdXBwb3J0cyB0aGlzIG1ldGhvZFxuICAgICAqL1xuICAgIGxheWVyLmdldF9pdGVtcyA9IGZ1bmN0aW9uIGdldF9pdGVtcyhvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIFsuLi5sYXllci5pbmRleC5uZWFyYnkob2Zmc2V0KS5jZW50ZXJdO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBMQVlFUiBVUERBVEUgQVBJXG4gICAgICogKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGxheWVyLnVwZGF0ZSA9IGZ1bmN0aW9uIHVwZGF0ZShjaGFuZ2VzKSB7XG4gICAgICAgIHJldHVybiBsYXllcl91cGRhdGUobGF5ZXIsIGNoYW5nZXMpO1xuICAgIH1cbiAgICBsYXllci5hcHBlbmQgPSBmdW5jdGlvbiBhcHBlbmQoaXRlbXMsIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gbGF5ZXJfYXBwZW5kKGxheWVyLCBpdGVtcywgb2Zmc2V0KTtcbiAgICB9XG5cbiAgICAvLyBpbml0aWFsaXNlXG4gICAgbGF5ZXIuc3JjID0gc3JjO1xuXG4gICAgcmV0dXJuIGxheWVyO1xufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBJVEVNUyBMQVlFUiBDQUNIRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIExheWVycyB3aXRoIGEgQ29sbGVjdGlvblByb3ZpZGVyIG9yIGEgVmFyaWFibGVQcm92aWRlciBhcyBzcmMgXG4gICAgdXNlIGEgc3BlY2lmaWMgY2FjaGUgaW1wbGVtZW50YXRpb24sIGFzIG9iamVjdHMgaW4gdGhlIFxuICAgIGluZGV4IGFyZSBhc3N1bWVkIHRvIGJlIGl0ZW1zIGZyb20gdGhlIHByb3ZpZGVyLCBub3QgbGF5ZXIgb2JqZWN0cy4gXG4gICAgVGh1cywgcXVlcmllcyBhcmUgbm90IHJlc29sdmVkIGRpcmVjdGx5IG9uIHRoZSBpdGVtcyBpbiB0aGUgaW5kZXgsIGJ1dFxuICAgIHJhdGhlciBmcm9tIGNvcnJlc3BvbmRpbmcgc2VnbWVudCBvYmplY3RzLCBpbnN0YW50aWF0ZWQgZnJvbSBpdGVtcy5cblxuICAgIENhY2hpbmcgaGVyZSBhcHBsaWVzIHRvIG5lYXJieSBzdGF0ZSBhbmQgc2VnbWVudCBvYmplY3RzLlxuKi9cblxuY2xhc3MgSXRlbXNMYXllckNhY2hlIHtcbiAgICBjb25zdHJ1Y3RvcihsYXllciwgb3B0aW9ucz17fSkge1xuICAgICAgICAvLyBsYXllclxuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IG9iamVjdFxuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhY2hlZCBzZWdtZW50XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGRlZmF1bHQgdmFsdWVcbiAgICAgICAgdGhpcy5fb3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgICB9XG5cbiAgICBnZXQgc3JjKCkge3JldHVybiB0aGlzLl9sYXllcn07XG4gICAgZ2V0IHNlZ21lbnQoKSB7cmV0dXJuIHRoaXMuX3NlZ21lbnR9O1xuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IG5lZWRfaW5kZXhfbG9va3VwID0gKFxuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgIWludGVydmFsLmNvdmVyc19lbmRwb2ludCh0aGlzLl9uZWFyYnkuaXR2LCBvZmZzZXQpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChuZWVkX2luZGV4X2xvb2t1cCkge1xuICAgICAgICAgICAgLy8gY2FjaGUgbWlzc1xuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdGhpcy5fbGF5ZXIuaW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgICAgICBsZXQge2l0diwgY2VudGVyfSA9IHRoaXMuX25lYXJieTtcbiAgICAgICAgICAgIHRoaXMuX3NlZ21lbnRzID0gY2VudGVyLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBsb2FkX3NlZ21lbnQoaXR2LCBpdGVtKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIHBlcmZvcm0gcXVlcmllc1xuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9zZWdtZW50cy5tYXAoKHNlZykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHNlZy5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gY2FsY3VsYXRlIHNpbmdsZSByZXN1bHQgc3RhdGVcbiAgICAgICAgcmV0dXJuIHRvU3RhdGUodGhpcy5fc2VnbWVudHMsIHN0YXRlcywgb2Zmc2V0LCB0aGlzLl9sYXllci5vcHRpb25zKTtcbiAgICB9XG5cbiAgICBjbGVhcigpIHtcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9zZWdtZW50ID0gdW5kZWZpbmVkO1xuICAgIH1cbn1cblxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExBWUVSIFVQREFURVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIE5PVEUgLSBsYXllciB1cGRhdGUgaXMgZXNzZW50aWFsbHkgYWJvdXQgc3RhdGVQcm92aWRlciB1cGRhdGUuXG4gKiBzbyB0aGVzZSBtZXRob2RzIGNvdWxkIChmb3IgdGhlIG1vc3QgcGFydCkgYmUgbW92ZWQgdG8gdGhlIHByb3ZpZGVyLlxuICogSG93ZXZlciwgdXBkYXRlX2FwcGVuZCBiZW5lZml0cyBmcm9tIHVzaW5nIHRoZSBpbmRleCBvZiB0aGUgbGF5ZXIsXG4gKiBzbyB3ZSBrZWVwIGl0IGhlcmUgZm9yIG5vdy4gXG4gKi9cblxuXG4vKlxuICAgIEl0ZW1zIExheWVyIGZvcndhcmRzIHVwZGF0ZSB0byBzdGF0ZVByb3ZpZGVyXG4qL1xuZnVuY3Rpb24gbGF5ZXJfdXBkYXRlKGxheWVyLCBjaGFuZ2VzPXt9KSB7XG4gICAgaWYgKGlzX2NvbGxlY3Rpb25fcHJvdmlkZXIobGF5ZXIuc3JjKSkge1xuICAgICAgICByZXR1cm4gbGF5ZXIuc3JjLnVwZGF0ZShjaGFuZ2VzKTtcbiAgICB9IGVsc2UgaWYgKGlzX3ZhcmlhYmxlX3Byb3ZpZGVyKGxheWVyLnNyYykpIHsgICAgIFxuICAgICAgICBsZXQge1xuICAgICAgICAgICAgaW5zZXJ0PVtdLFxuICAgICAgICAgICAgcmVtb3ZlPVtdLFxuICAgICAgICAgICAgcmVzZXQ9ZmFsc2VcbiAgICAgICAgfSA9IGNoYW5nZXM7XG4gICAgICAgIGlmIChyZXNldCkge1xuICAgICAgICAgICAgcmV0dXJuIGxheWVyLnNyYy5zZXQoaW5zZXJ0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAoKGxheWVyLnNyYy5nZXQoKSB8fCBbXSlcbiAgICAgICAgICAgICAgICAubWFwKChpdGVtKSA9PiBbaXRlbS5pZCwgaXRlbV0pKTtcbiAgICAgICAgICAgIC8vIHJlbW92ZVxuICAgICAgICAgICAgcmVtb3ZlLmZvckVhY2goKGlkKSA9PiBtYXAuZGVsZXRlKGlkKSk7XG4gICAgICAgICAgICAvLyBpbnNlcnRcbiAgICAgICAgICAgIGluc2VydC5mb3JFYWNoKChpdGVtKSA9PiBtYXAuc2V0KGl0ZW0uaWQsIGl0ZW0pKTtcbiAgICAgICAgICAgIC8vIHNldFxuICAgICAgICAgICAgY29uc3QgaXRlbXMgPSBBcnJheS5mcm9tKG1hcC52YWx1ZXMoKSk7XG4gICAgICAgICAgICByZXR1cm4gbGF5ZXIuc3JjLnNldChpdGVtcyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4gICAgXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUiBBUFBFTkRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBhcHBlbmQgaXRlbXMgdG8gbGF5ZXIgYXQgb2Zmc2V0XG4gKiBcbiAqIGFwcGVuZCBpbXBsaWVzIHRoYXQgcHJlLWV4aXN0aW5nIGl0ZW1zIGJleW9uZCBvZmZzZXQsXG4gKiB3aWxsIGVpdGhlciBiZSByZW1vdmVkIG9yIHRydW5jYXRlZCwgc28gdGhhdCB0aGUgbGF5ZXJcbiAqIGlzIGVtcHR5IGFmdGVyIG9mZnNldC5cbiAqIFxuICogaXRlbXMgd2lsbCBvbmx5IGJlIGluc2VydGVkIGFmdGVyIG9mZnNldCwgc28gYW55IG5ld1xuICogaXRlbSBiZWZvcmUgb2Zmc2V0IHdpbGwgYmUgdHJ1bmNhdGVkIG9yIGRyb3BwZWQuXG4gKiBcbiAqIG5ldyBpdGVtcyB3aWxsIG9ubHkgYmUgYmUgYXBwbGllZCBmb3IgdCA+PSBvZmZzZXRcbiAqIG9sZCBpdGVtcyB3aWxsIGJlIGtlcHQgZm9yIHQgPCBvZmZzZXRcbiAqIFxuICogXG4gKi9cbmZ1bmN0aW9uIGxheWVyX2FwcGVuZChsYXllciwgaXRlbXMsIG9mZnNldCkge1xuICAgIGNvbnN0IGVwID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuICAgIFxuICAgIC8vIHRydW5jYXRlIG9yIHJlbW92ZSBuZXcgaXRlbXMgYmVmb3JlIG9mZnNldFxuICAgIGNvbnN0IGluc2VydF9pdGVtcyA9IGl0ZW1zXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIC8vIGtlZXAgb25seSBpdGVtcyB3aXRoIGl0di5oaWdoID49IG9mZnNldFxuICAgICAgICAgICAgY29uc3QgaGlnaEVwID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMV07XG4gICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuZ2UoaGlnaEVwLCBlcCk7XG4gICAgICAgIH0pXG4gICAgICAgIC5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIC8vIHRydW5jYXRlIGl0ZW0gb3ZlcmxhcHBpbmcgb2Zmc2V0IGl0di5sb3c9b2Zmc2V0XG4gICAgICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KGl0ZW0uaXR2LCBlcCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdfaXRlbSA9IHsuLi5pdGVtfTtcbiAgICAgICAgICAgICAgICBuZXdfaXRlbS5pdHYgPSBbb2Zmc2V0LCBpdGVtLml0dlsxXSwgdHJ1ZSwgaXRlbS5pdHZbM11dO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXdfaXRlbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgICB9KTtcbiAgICBcbiAgICAvLyBjb25zb2xlLmxvZyhcImluc2VydFwiLCBpbnNlcnRfaXRlbXMpO1xuXG4gICAgLy8gdHJ1bmNhdGUgcHJlLWV4aXN0aW5nIGl0ZW1zIG92ZXJsYXBwaW5nIG9mZnNldFxuICAgIGNvbnN0IG1vZGlmeV9pdGVtcyA9IGxheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpLmNlbnRlci5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgY29uc3QgbmV3X2l0ZW0gPSB7Li4uaXRlbX07XG4gICAgICAgIG5ld19pdGVtLml0diA9IFtpdGVtLml0dlswXSwgb2Zmc2V0LCBpdGVtLml0dlsyXSwgZmFsc2VdO1xuICAgICAgICByZXR1cm4gbmV3X2l0ZW07XG4gICAgfSk7XG4gICAgXG4gICAgLy8gY29uc29sZS5sb2coXCJtb2RpZnlcIiwgbW9kaWZ5X2l0ZW1zKTtcblxuICAgIC8vIHJlbW92ZSBwcmUtZXhpc3RpbmcgZnV0dXJlIC0gaXRlbXMgY292ZXJpbmcgaXR2LmxvdyA+IG9mZnNldFxuICAgIGNvbnN0IHJlbW92ZSA9IGxheWVyLnNyYy5nZXQoKVxuICAgICAgICAuZmlsdGVyKChpdGVtKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBsb3dFcCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzBdO1xuICAgICAgICAgICAgcmV0dXJuIGVuZHBvaW50Lmd0KGxvd0VwLCBlcCk7XG4gICAgICAgIH0pXG4gICAgICAgIC5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBpdGVtLmlkO1xuICAgICAgICB9KTtcblxuICAgIC8vIGNvbnNvbGUubG9nKFwicmVtb3ZlXCIsIHJlbW92ZSk7XG5cbiAgICAvLyBsYXllciB1cGRhdGVcbiAgICBjb25zdCBpbnNlcnQgPSBbLi4ubW9kaWZ5X2l0ZW1zLCAuLi5pbnNlcnRfaXRlbXNdO1xuICAgIHJldHVybiBsYXllcl91cGRhdGUobGF5ZXIsIHtyZW1vdmUsIGluc2VydCwgcmVzZXQ6ZmFsc2V9KVxufVxuXG5cblxuIiwiaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4vY3Vyc29yX2Jhc2UuanNcIjtcbmltcG9ydCB7IGlzX2Nsb2NrX3Byb3ZpZGVyLCBMT0NBTF9DTE9DS19QUk9WSURFUiB9IGZyb20gXCIuL3Byb3ZpZGVyX2Nsb2NrLmpzXCI7XG4vKipcbiAqIENsb2NrIGN1cnNvciBpcyBhIHRoaW4gd3JhcHBlciBhcm91bmQgYSBjbG9ja1Byb3ZpZGVyLFxuICogc28gdGhhdCBpdCBjYW4gYmUgY29uc3VtZWQgYXMgYSBjdXJzb3IuXG4gKiBcbiAqIFRoZSBjdHJsIHByb3BlcnR5IG9mIGFueSBDdXJzb3IgaXMgcmVxdWlyZWQgdG8gYmUgYSBDdXJzb3Igb3IgdW5kZWZpbmVkLFxuICogc28gaW4gdGhlIGNhc2Ugb2YgYSBjbG9jayBjdXJzb3IsIHdoaWNoIGlzIHRoZSBzdGFydGluZyBwb2ludCxcbiAqIHRoZSBjdHJsIHByb3BlcnR5IGlzIGFsd2F5cyBzZXQgdG8gdW5kZWZpbmVkLlxuICogXG4gKiBBZGRpdGlvbmFsbHksIGNsb2NrIGN1cnNvci5zcmMgaXMgYWxzbyB1bmRlZmluZWQuXG4gKiBcbiAqIEN1cnNvciB0cmFuc2Zvcm1hdGlvbiBvZiBhIGNsb2NrIGN1cnNvciB3aWxsIHJlc3VsdCBpbiBhIG5ldyBjbG9jayBjdXJzb3IuXG4gKiAgXG4gKiBJZGVuZmlmeWluZyBhIGN1cnNvciBhcyBhIGNsb2NrIGN1cnNvciBvciBub3QgaXMgaW1wb3J0YW50IGZvciBwbGF5YmFja1xuICogbG9naWMgaW4gY3Vyc29yIGltcGxlbW1lbnRhdGlvbi5cbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gaXNfY2xvY2tfY3Vyc29yKG9iaikge1xuICAgIHJldHVybiBvYmogaW5zdGFuY2VvZiBDdXJzb3IgJiYgb2JqLmN0cmwgPT0gdW5kZWZpbmVkICYmIG9iai5zcmMgPT0gdW5kZWZpbmVkOyBcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsb2NrX2N1cnNvcihzcmM9TE9DQUxfQ0xPQ0tfUFJPVklERVIpIHtcbiAgICBpZiAoIWlzX2Nsb2NrX3Byb3ZpZGVyKHNyYykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzcmMgbXVzdCBiZSBjbG9ja1Byb3ZpZGVyICR7c3JjfWApO1xuICAgIH1cbiAgICBjb25zdCBjdXJzb3IgPSBuZXcgQ3Vyc29yKCk7XG4gICAgY3Vyc29yLnF1ZXJ5ID0gZnVuY3Rpb24gKGxvY2FsX3RzKSB7XG4gICAgICAgIGNvbnN0IGNsb2NrX3RzID0gc3JjLm5vdyhsb2NhbF90cyk7XG4gICAgICAgIHJldHVybiB7dmFsdWU6Y2xvY2tfdHMsIGR5bmFtaWM6dHJ1ZSwgb2Zmc2V0OmxvY2FsX3RzfTtcbiAgICB9XG4gICAgcmV0dXJuIGN1cnNvcjtcbn1cbiIsImltcG9ydCB7IEN1cnNvciB9IGZyb20gXCIuL2N1cnNvcl9iYXNlLmpzXCI7XG5pbXBvcnQgeyBpc19pdGVtc19sYXllciwgaXRlbXNfbGF5ZXIgfSBmcm9tIFwiLi9sYXllcl9pdGVtcy5qc1wiO1xuaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi91dGlsL2FwaV9zcmNwcm9wLmpzXCI7XG5pbXBvcnQgeyByYW5kb21fc3RyaW5nLCBzZXRfdGltZW91dCwgY2hlY2tfbnVtYmVyLCBtb3Rpb25fdXRpbHMgfSBmcm9tIFwiLi91dGlsL2NvbW1vbi5qc1wiO1xuaW1wb3J0IHsgaXNfY2xvY2tfY3Vyc29yLCBjbG9ja19jdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3JfY2xvY2suanNcIjtcbmltcG9ydCB7IGlzX2Nsb2NrX3Byb3ZpZGVyLCBMT0NBTF9DTE9DS19QUk9WSURFUiB9IGZyb20gXCIuL3Byb3ZpZGVyX2Nsb2NrLmpzXCI7XG5pbXBvcnQgeyBpc19jb2xsZWN0aW9uX3Byb3ZpZGVyIH0gZnJvbSBcIi4vcHJvdmlkZXJfY29sbGVjdGlvbi5qc1wiO1xuaW1wb3J0IHsgaXNfdmFyaWFibGVfcHJvdmlkZXIgfSBmcm9tIFwiLi9wcm92aWRlcl92YXJpYWJsZS5qc1wiO1xuaW1wb3J0IHsgbG9hZF9zZWdtZW50IH0gZnJvbSBcIi4vdXRpbC9zZWdtZW50cy5qc1wiO1xuXG5jb25zdCBjaGVja19yYW5nZSA9IG1vdGlvbl91dGlscy5jaGVja19yYW5nZTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBWQVJJQUJMRSBDVVJTT1JcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBcInNyY1wiIGlzIGEgbGF5ZXIgb3IgYSBzdGF0ZVByb3ZpZGVyXG4gKiBcImNsb2NrXCIgaXMgYSBjbG9ja0N1cnNvciBvciBhIGNsb2NrUHJvdmlkZXJcbiAqIFxuICogLSBjbG9ja1Byb3ZpZGVyIGlzIHdyYXBwZWQgYXMgY2xvY2tDdXJzb3JcbiAqIHRvIGVuc3VyZSB0aGF0IFwiY2xvY2tcIiBwcm9wZXJ0eSBvZiBjdXJzb3JzIGlzIGFsd2F5cyBhIGN1cnNvclxuICogXG4gKiBpZiBubyBcImNsb2NrXCIgaXMgcHJvdmlkZWQgLSBsb2NhbCBjbG9ja1Byb3ZpZGVyIGlzIHVzZWRcbiAqIFxuICogLSBzdGF0ZVByb3ZpZGVyIGlzIHdyYXBwZWQgYXMgaXRlbXNMYXllclxuICogdG8gZW5zdXJlIHRoYXQgXCJzcmNcIiBwcm9wZXJ0eSBvZiBjdXJzb3JzIGlzIGFsd2F5cyBhIGxheWVyXG4gKiB0aGlzIGFsc28gZW5zdXJlcyB0aGF0IHZhcmlhYmxlIGN1cnNvciBjYW4gZWFzaWx5XG4gKiBzdXBwb3J0IGxpdmUgcmVjb3JkaW5nLCB3aGljaCBkZXBlbmRzIG9uIHRoZSBuZWFyYnlpbmRleCBvZiB0aGUgbGF5ZXIuXG4gKiBcbiAqL1xuXG4vKipcbiAqIFRPRE8gLSBtZWRpYSBjb250cm9sIGlzIGEgc3BlY2lhbCBjYXNlIG9mIHZhcmlhYmxlIGN1cnNvcnNcbiAqIHdoZXJlIHNyYyBsYXllciBpcyBudW1iZXIgdHlwZSBhbmQgZGVmaW5lZCBvbiB0aGUgZW50aXJlXG4gKiB0aW1lbGluZS4gQW5kIHByb3RlY3RlZCBhZ29pbnN0IG90aGVyIHR5cGVzIG9mIHN0YXRlXG4gKiBDb3VsZCBwZXJoYXBzIG1ha2UgYSBzcGVjaWFsIHR5cGUgb2YgbGF5ZXIgZm9yIHRoaXMsXG4gKiBhbmQgdGhlbiBtYWtlIGEgc3BlY2lhbCB0eXBlIG9mIGNvbnRyb2wgY3Vyc29yIHdpdGhcbiAqIHRoZSBhcHByb3ByaWF0ZSByZXN0cmljdGlvbiBvbiB0aGUgc3JjIGxheWVyLlxuICovXG5cblxuZXhwb3J0IGZ1bmN0aW9uIHZhcmlhYmxlX2N1cnNvcihjdHJsLCBzcmMsIG9wdGlvbnM9e30pIHtcblxuICAgIGNvbnN0IGN1cnNvciA9IG5ldyBDdXJzb3IoKTtcblxuICAgIC8vIGNhY2hlIGZvciBzcmNcbiAgICBsZXQgc3JjX2NhY2hlO1xuICAgIC8vIHRpbWVvdXRcbiAgICBsZXQgdGlkO1xuXG4gICAgLy8gc2V0dXAgc3JjIHByb3BlcnR5XG4gICAgc3JjcHJvcC5hZGRTdGF0ZShjdXJzb3IpO1xuICAgIHNyY3Byb3AuYWRkTWV0aG9kcyhjdXJzb3IpO1xuICAgIGN1cnNvci5zcmNwcm9wX3JlZ2lzdGVyKFwiY3RybFwiKTtcbiAgICBjdXJzb3Iuc3JjcHJvcF9yZWdpc3RlcihcInNyY1wiKTtcblxuICAgIGN1cnNvci5zcmNwcm9wX2NoZWNrID0gZnVuY3Rpb24gKHByb3BOYW1lLCBvYmo9TE9DQUxfQ0xPQ0tfUFJPVklERVIpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwiY3RybFwiKSB7XG4gICAgICAgICAgICBpZiAoaXNfY2xvY2tfcHJvdmlkZXIob2JqKSkge1xuICAgICAgICAgICAgICAgIG9iaiA9IGNsb2NrX2N1cnNvcihvYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFpc19jbG9ja19jdXJzb3Iob2JqKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJjdHJsXCIgcHJvcGVydHkgbXVzdCBiZSBhIGNsb2NrIGN1cnNvciAke29ian1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmIChpc19jb2xsZWN0aW9uX3Byb3ZpZGVyKG9iaikgfHwgaXNfdmFyaWFibGVfcHJvdmlkZXIob2JqKSkge1xuICAgICAgICAgICAgICAgIG9iaiA9IGl0ZW1zX2xheWVyKHtzcmM6b2JqfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWlzX2l0ZW1zX2xheWVyKG9iaikpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwic3JjXCIgcHJvcGVydHkgbXVzdCBiZSBhbiBpdGVtIGxheWVyICR7b2JqfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgfVxuICAgIH1cbiAgICBjdXJzb3Iuc3JjcHJvcF9vbmNoYW5nZSA9IGZ1bmN0aW9uIChwcm9wTmFtZSwgZUFyZykge1xuICAgICAgICBpZiAoY3Vyc29yLnNyYyA9PSB1bmRlZmluZWQgfHwgY3Vyc29yLmN0cmwgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmIChlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIHNyY19jYWNoZSA9IGN1cnNvci5zcmMuY3JlYXRlQ2FjaGUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3JjX2NhY2hlLmNsZWFyKCk7ICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIGN0cmwgbWF5IGNoYW5nZSBpZiBjbG9ja1Byb3ZpZGVyIGlzIHJlc2V0IC0gYnV0XG4gICAgICAgIC8vIHRoaXMgZG9lcyBub3QgcmVxdWlyZSBhbnkgcGFydGljdWxhciBjaGFuZ2VzIHRvIHRoZSBzcmMgY2FjaGUgICAgICAgIFxuICAgICAgICBkZXRlY3RfZnV0dXJlX2V2ZW50KCk7XG4gICAgICAgIGN1cnNvci5vbmNoYW5nZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGN1cnNvci5jdHJsIGRlZmluZXMgYW4gYWN0aXZlIHJlZ2lvbiBvZiBjdXJzb3Iuc3JjIChsYXllcilcbiAgICAgKiBhdCBzb21lIHBvaW50IGluIHRoZSBmdXR1cmUsIHRoZSBjdXJzb3IuY3RybCB3aWxsIGxlYXZlIHRoaXMgcmVnaW9uLlxuICAgICAqIGluIHRoYXQgbW9tZW50LCBjdXJzb3Igc2hvdWxkIHJlZXZhbHVhdGUgaXRzIHN0YXRlIC0gc28gd2UgbmVlZCB0byBcbiAgICAgKiBkZXRlY3QgdGhpcyBldmVudCBieSB0aW1lb3V0ICBcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIGRldGVjdF9mdXR1cmVfZXZlbnQoKSB7XG4gICAgICAgIGlmICh0aWQpIHt0aWQuY2FuY2VsKCk7fVxuICAgICAgICBjb25zdCB0cyA9IGN1cnNvci5jdHJsLnZhbHVlO1xuICAgICAgICAvLyBuZWFyYnkgZnJvbSBzcmNcbiAgICAgICAgY29uc3QgbmVhcmJ5ID0gY3Vyc29yLnNyYy5pbmRleC5uZWFyYnkodHMpO1xuICAgICAgICBjb25zdCByZWdpb25faGlnaCA9IG5lYXJieS5pdHZbMV0gfHwgSW5maW5pdHk7ICAgICAgICBcblxuICAgICAgICBpZiAocmVnaW9uX2hpZ2ggPT0gSW5maW5pdHkpIHtcbiAgICAgICAgICAgIC8vIG5vIGZ1dHVyZSBsZWF2ZSBldmVudFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRlbHRhX21zID0gKHJlZ2lvbl9oaWdoIC0gdHMpICogMTAwMDtcbiAgICAgICAgdGlkID0gc2V0X3RpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgY3Vyc29yLm9uY2hhbmdlKCk7XG4gICAgICAgIH0sIGRlbHRhX21zKTtcbiAgICB9XG5cbiAgICBjdXJzb3IucXVlcnkgPSBmdW5jdGlvbiBxdWVyeShsb2NhbF90cykge1xuICAgICAgICBjb25zdCBvZmZzZXQgPSBjdXJzb3IuY3RybC5xdWVyeShsb2NhbF90cykudmFsdWU7XG4gICAgICAgIHJldHVybiBzcmNfY2FjaGUucXVlcnkob2Zmc2V0KTtcbiAgICB9XG4gICAgXG4gICAgLyoqXG4gICAgICogVVBEQVRFIEFQSSBmb3IgVmFyaWFibGUgQ3Vyc29yXG4gICAgICovICAgIFxuICAgIGN1cnNvci5zZXQgPSBmdW5jdGlvbiBzZXQodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHNldF92YWx1ZShjdXJzb3IsIHZhbHVlKTtcbiAgICB9XG4gICAgY3Vyc29yLm1vdGlvbiA9IGZ1bmN0aW9uIG1vdGlvbih2ZWN0b3IpIHtcbiAgICAgICAgcmV0dXJuIHNldF9tb3Rpb24oY3Vyc29yLCB2ZWN0b3IpO1xuICAgIH1cbiAgICBjdXJzb3IudHJhbnNpdGlvbiA9IGZ1bmN0aW9uIHRyYW5zaXRpb24oe3RhcmdldCwgZHVyYXRpb24sIGVhc2luZ30pIHtcbiAgICAgICAgcmV0dXJuIHNldF90cmFuc2l0aW9uKGN1cnNvciwgdGFyZ2V0LCBkdXJhdGlvbiwgZWFzaW5nKTtcbiAgICB9XG4gICAgY3Vyc29yLmludGVycG9sYXRlID0gZnVuY3Rpb24gaW50ZXJwb2xhdGUgKHt0dXBsZXMsIGR1cmF0aW9ufSkge1xuICAgICAgICByZXR1cm4gc2V0X2ludGVycG9sYXRpb24oY3Vyc29yLCB0dXBsZXMsIGR1cmF0aW9uKTtcbiAgICB9XG4gICAgXG4gICAgLy8gaW5pdGlhbGl6ZVxuICAgIGN1cnNvci5vcHRpb25zID0gb3B0aW9ucztcbiAgICBjdXJzb3IuY3RybCA9IGN0cmw7XG4gICAgY3Vyc29yLnNyYyA9IHNyYztcbiAgICByZXR1cm4gY3Vyc29yO1xufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUiBVUERBVEUgQVBJXG4gKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogc2V0IHZhbHVlIG9mIGN1cnNvclxuICovXG5cbmZ1bmN0aW9uIHNldF92YWx1ZShjdXJzb3IsIHZhbHVlKSB7XG4gICAgbGV0IGl0ZW1zID0gW107XG4gICAgaWYgKHZhbHVlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBpdGVtcyA9IFt7XG4gICAgICAgICAgICBpZDogcmFuZG9tX3N0cmluZygxMCksXG4gICAgICAgICAgICBpdHY6IFtudWxsLCBudWxsLCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2YWx1ZSAgICAgICAgICAgICAgXG4gICAgICAgIH1dO1xuICAgIH1cbiAgICByZXR1cm4gY3Vyc29yX3VwZGF0ZSAoY3Vyc29yLCBpdGVtcyk7XG59XG5cbi8qKlxuICogc2V0IG1vdGlvbiBzdGF0ZVxuICogIFxuICogbW90aW9uIG9ubHkgbWFrZXMgc2Vuc2UgaWYgdmFyaWFibGUgY3Vyc29yIGlzIHJlc3RyaWN0ZWQgdG8gbnVtYmVyIHZhbHVlcyxcbiAqIHdoaWNoIGluIHR1cm4gaW1wbGllcyB0aGF0IHRoZSBjdXJzb3Iuc3JjIChJdGVtcyBMYXllcikgc2hvdWxkIGJlXG4gKiByZXN0cmljdGVkIHRvIG51bWJlciB2YWx1ZXMuIFxuICogSWYgbm9uLW51bWJlciB2YWx1ZXMgb2NjdXIgLSB3ZSBzaW1wbHkgcmVwbGFjZSB3aXRoIDAuXG4gKiBBbHNvLCBpdGVtcyBsYXllciBzaG91bGQgaGF2ZSBhIHNpbmdsZSBpdGVtIGluIG5lYXJieSBjZW50ZXIuXG4gKiBcbiAqIGlmIHBvc2l0aW9uIGlzIG9taXR0ZWQgaW4gdmVjdG9yIC0gY3VycmVudCBwb3NpdGlvbiB3aWxsIGJlIGFzc3VtZWRcbiAqIGlmIHRpbWVzdGFtcCBpcyBvbWl0dGVkIGluIHZlY3RvciAtIGN1cnJlbnQgdGltZXN0YW1wIHdpbGwgYmUgYXNzdW1lZFxuICogaWYgdmVsb2NpdHkgYW5kIGFjY2VsZXJhdGlvbiBhcmUgb21taXR0ZWQgaW4gdmVjdG9yIFxuICogLSB0aGVzZSB3aWxsIGJlIHNldCB0byB6ZXJvLlxuICovXG5cbmZ1bmN0aW9uIHNldF9tb3Rpb24oY3Vyc29yLCB2ZWN0b3I9e30pIHtcbiAgICAvLyBnZXQgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIGN1cnNvclxuICAgIGxldCB7dmFsdWU6cDAsIG9mZnNldDp0MH0gPSBjdXJzb3IucXVlcnkoKTtcbiAgICAvLyBlbnN1cmUgdGhhdCBwMCBpcyBudW1iZXIgdHlwZVxuICAgIGlmICh0eXBlb2YgcDAgIT09ICdudW1iZXInIHx8ICFpc0Zpbml0ZShwMCkpIHtcbiAgICAgICAgcDAgPSAwO1xuICAgIH1cbiAgICAvLyBmZXRjaCBuZXcgdmFsdWVzIGZyb20gdmVjdG9yXG4gICAgY29uc3Qge1xuICAgICAgICBwb3NpdGlvbjpwMT1wMCxcbiAgICAgICAgdmVsb2NpdHk6djE9MCxcbiAgICAgICAgYWNjZWxlcmF0aW9uOmExPTAsXG4gICAgICAgIHRpbWVzdGFtcDp0MT10MCxcbiAgICAgICAgcmFuZ2U9W251bGwsIG51bGxdXG4gICAgfSA9IHZlY3RvcjtcbiAgICBjaGVja19yYW5nZShyYW5nZSk7XG4gICAgY2hlY2tfbnVtYmVyKFwicG9zaXRpb25cIiwgcDEpO1xuICAgIGNoZWNrX251bWJlcihcInZlbG9jaXR5XCIsIHYxKTtcbiAgICBjaGVja19udW1iZXIoXCJhY2NlbGVyYXRpb25cIiwgYTEpO1xuICAgIGNoZWNrX251bWJlcihcInRpbWVzdGFtcFwiLCB0MSk7XG5cbiAgICBjb25zdCBpdGVtcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogaWYgcG9zIHJhbmdlIGlzIGJvdW5kZWQgbG93IG9yIGhpZ2ggb3IgYm90aCxcbiAgICAgKiB0aGlzIHBvdGVudGlhbGx5IGNvcnJlc3BvbmRzIHRvIG11bHRpcGxlIHRpbWUgcmFuZ2VzIFtbdDAsIHQxXV0gXG4gICAgICogd2hlcmUgdGhlIG1vdGlvbiBwb3NpdGlvbiBpcyBsZWdhbCAgXG4gICAgICogbG93IDw9IHAgPD0gaGlnaCBcbiAgICAgKi9cbiAgICBjb25zdCBjdHIgPSBtb3Rpb25fdXRpbHMuY2FsY3VsYXRlX3RpbWVfcmFuZ2VzO1xuICAgIGNvbnN0IHRpbWVfcmFuZ2VzID0gY3RyKFtwMSx2MSxhMSx0MV0sIHJhbmdlKTtcbiAgICAvLyBwaWNrIGEgdGltZSByYW5nZSB3aGljaCBjb250YWlucyB0MVxuICAgIGNvbnN0IHRzID0gY3Vyc29yLmN0cmwudmFsdWU7XG5cbiAgICBjb25zdCB0aW1lX3JhbmdlID0gdGltZV9yYW5nZXMuZmluZCgodHIpID0+IHtcbiAgICAgICAgY29uc3QgbG93ID0gdHJbMF0gPz8gLUluZmluaXR5O1xuICAgICAgICBjb25zdCBoaWdoID0gdHJbMV0gPz8gSW5maW5pdHk7XG4gICAgICAgIHJldHVybiBsb3cgPD0gdHMgJiYgdHMgPD0gaGlnaDtcbiAgICB9KTtcbiAgICBpZiAodGltZV9yYW5nZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgW2xvdywgaGlnaF0gPSB0aW1lX3JhbmdlO1xuICAgICAgICBpdGVtcy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiByYW5kb21fc3RyaW5nKDEwKSxcbiAgICAgICAgICAgIGl0djogW2xvdywgaGlnaCwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICAgICAgZGF0YTogW3AxLCB2MSwgYTEsIHQxXVxuICAgICAgICB9KTtcbiAgICAgICAgLy8gYWRkIGxlZnQgaWYgbmVlZGVkXG4gICAgICAgIGlmIChsb3cgIT0gbnVsbCkge1xuICAgICAgICAgICAgaXRlbXMucHVzaCh7XG4gICAgICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgICAgIGl0djogW251bGwsIGxvdywgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICAgICAgZGF0YTogcmFuZ2VbMF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGFkZCByaWdodCBpZiBuZWVkZWRcbiAgICAgICAgaWYgKGhpZ2ggIT0gbnVsbCkge1xuICAgICAgICAgICAgaXRlbXMucHVzaCh7XG4gICAgICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgICAgIGl0djogW2hpZ2gsIG51bGwsIGZhbHNlLCB0cnVlXSxcbiAgICAgICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgICAgIGRhdGE6IHJhbmdlWzFdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8qIFxuICAgICAgICAgICAgbm8gdGltZV9yYW5nZSBmb3VuZFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBwMSBpcyBvdXRzaWRlIHRoZSBwb3NfcmFuZ2VcbiAgICAgICAgICAgIGlmIHAxIGlzIGxlc3MgdGhhbiBsb3csIHRoZW4gdXNlIGxvd1xuICAgICAgICAgICAgaWYgcDEgaXMgZ3JlYXRlciB0aGFuIGhpZ2gsIHRoZW4gdXNlIGhpZ2hcbiAgICAgICAgKi9cbiAgICAgICAgY29uc3QgdmFsID0gKHAxIDwgcmFuZ2VbMF0pID8gcmFuZ2VbMF0gOiByYW5nZVsxXTtcbiAgICAgICAgaXRlbXMucHVzaCh7XG4gICAgICAgICAgICBpZDogcmFuZG9tX3N0cmluZygxMCksXG4gICAgICAgICAgICBpdHY6IFtudWxsLCBudWxsLCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2YWxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBjdXJzb3JfdXBkYXRlIChjdXJzb3IsIGl0ZW1zKTtcbn1cblxuLyoqXG4gKiBzZXQgdHJhbnNpdGlvbiAtIHRvIHRhcmdldCBwb3NpdGlvbiB1c2luZyBpbiA8ZHVyYXRpb24+IHNlY29uZHMuXG4gKi9cblxuZnVuY3Rpb24gc2V0X3RyYW5zaXRpb24oY3Vyc29yLCB0YXJnZXQsIGR1cmF0aW9uLCBlYXNpbmcpIHtcbiAgICBjb25zdCB7dmFsdWU6djAsIG9mZnNldDp0MH0gPSBjdXJzb3IucXVlcnkoKTtcbiAgICBjb25zdCB2MSA9IHRhcmdldDtcbiAgICBjb25zdCB0MSA9IHQwICsgZHVyYXRpb247XG4gICAgY2hlY2tfbnVtYmVyKFwicG9zaXRpb25cIiwgdjApO1xuICAgIGNoZWNrX251bWJlcihcInBvc2l0aW9uXCIsIHYxKTtcbiAgICBjaGVja19udW1iZXIoXCJwb3NpdGlvblwiLCB0MCk7XG4gICAgY2hlY2tfbnVtYmVyKFwicG9zaXRpb25cIiwgdDEpO1xuICAgIGxldCBpdGVtcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgaXR2OiBbbnVsbCwgdDAsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpZDogcmFuZG9tX3N0cmluZygxMCksXG4gICAgICAgICAgICBpdHY6IFt0MCwgdDEsIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJ0cmFuc2l0aW9uXCIsXG4gICAgICAgICAgICBkYXRhOiB7djAsIHYxLCB0MCwgdDEsIGVhc2luZ31cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgaXR2OiBbdDEsIG51bGwsIGZhbHNlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MVxuICAgICAgICB9XG4gICAgXVxuICAgIHJldHVybiBjdXJzb3JfdXBkYXRlIChjdXJzb3IsIGl0ZW1zKTtcbn1cblxuLyoqXG4gKiBzZXQgaW50ZXJwb2xhdGlvblxuICogXG4gKi9cblxuZnVuY3Rpb24gc2V0X2ludGVycG9sYXRpb24oY3Vyc29yLCB0dXBsZXMsIGR1cmF0aW9uKSB7XG4gICAgY29uc3Qgbm93ID0gY3Vyc29yLmN0cmwudmFsdWU7XG4gICAgdHVwbGVzID0gdHVwbGVzLm1hcCgoW3YsdF0pID0+IHtcbiAgICAgICAgY2hlY2tfbnVtYmVyKFwidHNcIiwgdCk7XG4gICAgICAgIGNoZWNrX251bWJlcihcInZhbFwiLCB2KTtcbiAgICAgICAgcmV0dXJuIFt2LCBub3cgKyB0XTtcbiAgICB9KVxuXG4gICAgLy8gaW5mbGF0ZSBzZWdtZW50IHRvIGNhbGN1bGF0ZSBib3VuZGFyeSBjb25kaXRpb25zXG4gICAgY29uc3Qgc2VnID0gbG9hZF9zZWdtZW50KFtudWxsLCBudWxsLCB0cnVlLCB0cnVlXSwge1xuICAgICAgICB0eXBlOiBcImludGVycG9sYXRpb25cIixcbiAgICAgICAgZGF0YTogdHVwbGVzXG4gICAgfSk7XG5cbiAgICBjb25zdCB0MCA9IG5vdztcbiAgICBjb25zdCB0MSA9IHQwICsgZHVyYXRpb247XG4gICAgY29uc3QgdjAgPSBzZWcuc3RhdGUodDApLnZhbHVlO1xuICAgIGNvbnN0IHYxID0gc2VnLnN0YXRlKHQxKS52YWx1ZTtcbiAgICBjb25zdCBpdGVtcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYwXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlkOiByYW5kb21fc3RyaW5nKDEwKSxcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJpbnRlcnBvbGF0aW9uXCIsXG4gICAgICAgICAgICBkYXRhOiB0dXBsZXNcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgaXR2OiBbdDEsIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MVxuICAgICAgICB9XG4gICAgXVxuICAgIHJldHVybiBjdXJzb3JfdXBkYXRlIChjdXJzb3IsIGl0ZW1zKTtcbn1cblxuXG5mdW5jdGlvbiBjdXJzb3JfdXBkYXRlKGN1cnNvciwgaXRlbXMpIHtcbiAgICBjb25zdCB7cmVjb3JkPWZhbHNlfSA9IGN1cnNvci5vcHRpb25zO1xuICAgIGlmIChyZWNvcmQpIHtcbiAgICAgICAgcmV0dXJuIGN1cnNvci5zcmMuYXBwZW5kKGl0ZW1zLCBjdXJzb3IuY3RybC52YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGN1cnNvci5zcmMudXBkYXRlKHtpbnNlcnQ6aXRlbXMsIHJlc2V0OnRydWV9KTtcbiAgICB9XG59IiwiaW1wb3J0IHsgQ3Vyc29yLCBnZXRfY3Vyc29yX2N0cmxfc3RhdGUgfSBmcm9tIFwiLi9jdXJzb3JfYmFzZS5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi9sYXllcl9iYXNlLmpzXCI7XG5pbXBvcnQgeyBpc19pdGVtc19sYXllciwgaXRlbXNfbGF5ZXIgfSBmcm9tIFwiLi9sYXllcl9pdGVtcy5qc1wiO1xuaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi91dGlsL2FwaV9zcmNwcm9wLmpzXCI7XG5pbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBzZXRfdGltZW91dCB9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5pbXBvcnQgeyBpc19jbG9ja19jdXJzb3IsIGNsb2NrX2N1cnNvciB9IGZyb20gXCIuL2N1cnNvcl9jbG9jay5qc1wiO1xuaW1wb3J0IHsgaXNfY2xvY2tfcHJvdmlkZXIsIExPQ0FMX0NMT0NLX1BST1ZJREVSIH0gZnJvbSBcIi4vcHJvdmlkZXJfY2xvY2suanNcIjtcbmltcG9ydCB7IGlzX2NvbGxlY3Rpb25fcHJvdmlkZXIgfSBmcm9tIFwiLi9wcm92aWRlcl9jb2xsZWN0aW9uLmpzXCI7XG5pbXBvcnQgeyBpc192YXJpYWJsZV9wcm92aWRlciB9IGZyb20gXCIuL3Byb3ZpZGVyX3ZhcmlhYmxlLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogUExBWUJBQ0sgQ1VSU09SXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogc3JjIGlzIGEgbGF5ZXIgb3IgYSBzdGF0ZVByb3ZpZGVyXG4gKiBjdHJsIGlzIGEgY3Vyc29yIG9yIGEgY2xvY2tQcm92aWRlclxuICogXG4gKiBjbG9ja1Byb3ZpZGVyIGlzIHdyYXBwZWQgYXMgY2xvY2tDdXJzb3JcbiAqIHRvIGVuc3VyZSB0aGF0IFwiY3RybFwiIHByb3BlcnR5IG9mIGN1cnNvcnMgaXMgYWx3YXlzIGEgY3Vyc29yXG4gKiBcbiAqIHN0YXRlUHJvdmlkZXIgaXMgd3JhcHBlZCBhcyBpdGVtc0xheWVyXG4gKiB0byBlbnN1cmUgdGhhdCBcInNyY1wiIHByb3BlcnR5IG9mIGN1cnNvcnMgaXMgYWx3YXlzIGEgbGF5ZXJcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gcGxheWJhY2tfY3Vyc29yKGN0cmwsIHNyYykge1xuXG4gICAgY29uc3QgY3Vyc29yID0gbmV3IEN1cnNvcigpO1xuXG4gICAgLy8gc3JjIGNhY2hlXG4gICAgbGV0IHNyY19jYWNoZTtcbiAgICAvLyB0aW1lb3V0XG4gICAgbGV0IHRpZDtcbiAgICAvLyBwb2xsaW5nXG4gICAgbGV0IHBpZDtcblxuICAgIC8vIHNldHVwIHNyYyBwcm9wZXJ0eVxuICAgIHNyY3Byb3AuYWRkU3RhdGUoY3Vyc29yKTtcbiAgICBzcmNwcm9wLmFkZE1ldGhvZHMoY3Vyc29yKTtcbiAgICBjdXJzb3Iuc3JjcHJvcF9yZWdpc3RlcihcImN0cmxcIik7XG4gICAgY3Vyc29yLnNyY3Byb3BfcmVnaXN0ZXIoXCJzcmNcIik7XG5cbiAgICAvKipcbiAgICAgKiBzcmMgcHJvcGVydHkgaW5pdGlhbGl6YXRpb24gY2hlY2tcbiAgICAgKi9cbiAgICBjdXJzb3Iuc3JjcHJvcF9jaGVjayA9IGZ1bmN0aW9uIChwcm9wTmFtZSwgb2JqPUxPQ0FMX0NMT0NLX1BST1ZJREVSKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcImN0cmxcIikge1xuICAgICAgICAgICAgaWYgKGlzX2Nsb2NrX3Byb3ZpZGVyKG9iaikpIHtcbiAgICAgICAgICAgICAgICBvYmogPSBjbG9ja19jdXJzb3Iob2JqKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChvYmogaW5zdGFuY2VvZiBDdXJzb3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgY3RybCBtdXN0IGJlIGNsb2NrUHJvdmlkZXIgb3IgQ3Vyc29yICR7b2JqfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAoaXNfY29sbGVjdGlvbl9wcm92aWRlcihvYmopIHx8IGlzX3ZhcmlhYmxlX3Byb3ZpZGVyKG9iaikpIHtcbiAgICAgICAgICAgICAgICBvYmogPSBpdGVtc19sYXllcih7c3JjOm9ian0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9iaiBpbnN0YW5jZW9mIExheWVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzcmMgbXVzdCBiZSBMYXllciAke29ian1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGhhbmRsZSBzcmMgcHJvcGVydHkgY2hhbmdlXG4gICAgICovXG4gICAgY3Vyc29yLnNyY3Byb3Bfb25jaGFuZ2UgPSBmdW5jdGlvbiAocHJvcE5hbWUsIGVBcmcpIHtcbiAgICAgICAgaWYgKGN1cnNvci5zcmMgPT0gdW5kZWZpbmVkIHx8IGN1cnNvci5jdHJsID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAoZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICBzcmNfY2FjaGUgPSBjdXJzb3Iuc3JjLmNyZWF0ZUNhY2hlKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNyY19jYWNoZS5jbGVhcigpOyAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjdXJzb3Jfb25jaGFuZ2UoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBtYWluIGN1cnNvciBjaGFuZ2UgaGFuZGxlclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGN1cnNvcl9vbmNoYW5nZSgpIHtcbiAgICAgICAgY3Vyc29yLm9uY2hhbmdlKCk7XG4gICAgICAgIGRldGVjdF9mdXR1cmVfZXZlbnQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjdXJzb3IuY3RybCAoY3Vyc29yL2Nsb2NrKSBkZWZpbmVzIGFuIGFjdGl2ZSByZWdpb24gb2YgY3Vyc29yLnNyYyAobGF5ZXIpXG4gICAgICogYXQgc29tZSBwb2ludCBpbiB0aGUgZnV0dXJlLCB0aGUgY3Vyc29yLmN0cmwgd2lsbCBsZWF2ZSB0aGlzIHJlZ2lvbi5cbiAgICAgKiBpbiB0aGF0IG1vbWVudCwgY3Vyc29yIHNob3VsZCByZWV2YWx1YXRlIGl0cyBzdGF0ZSAtIHNvIHdlIG5lZWQgdG8gXG4gICAgICogZGV0ZWN0IHRoaXMgZXZlbnQsIGlkZWFsbHkgYnkgdGltZW91dCwgYWx0ZXJuYXRpdmVseSBieSBwb2xsaW5nLiAgXG4gICAgICovXG4gICAgZnVuY3Rpb24gZGV0ZWN0X2Z1dHVyZV9ldmVudCgpIHtcbiAgICAgICAgaWYgKHRpZCkgeyB0aWQuY2FuY2VsKCk7IH1cbiAgICAgICAgaWYgKHBpZCkgeyBjbGVhckludGVydmFsKHBpZCk7IH1cblxuICAgICAgICAvLyBjdXJyZW50IHN0YXRlIG9mIGN1cnNvci5jdHJsIFxuICAgICAgICBjb25zdCBjdHJsX3N0YXRlID0gZ2V0X2N1cnNvcl9jdHJsX3N0YXRlKGN1cnNvcik7XG4gICAgICAgIC8vIGN1cnJlbnQgKHBvc2l0aW9uLCB0aW1lKSBvZiBjdXJzb3IuY3RybFxuICAgICAgICBjb25zdCBjdXJyZW50X3BvcyA9IGN0cmxfc3RhdGUudmFsdWU7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRfdHMgPSBjdHJsX3N0YXRlLm9mZnNldDtcblxuICAgICAgICAvLyBubyBmdXR1cmUgZXZlbnQgaWYgdGhlIGN0cmwgaXMgc3RhdGljXG4gICAgICAgIGlmICghY3RybF9zdGF0ZS5keW5hbWljKSB7XG4gICAgICAgICAgICAvLyB3aWxsIG5ldmVyIGxlYXZlIHJlZ2lvblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3VycmVudCByZWdpb24gb2YgY3Vyc29yLnNyY1xuICAgICAgICBjb25zdCBzcmNfbmVhcmJ5ID0gY3Vyc29yLnNyYy5pbmRleC5uZWFyYnkoY3VycmVudF9wb3MpO1xuXG4gICAgICAgIGNvbnN0IHJlZ2lvbl9sb3cgPSBzcmNfbmVhcmJ5Lml0dlswXSA/PyAtSW5maW5pdHk7XG4gICAgICAgIGNvbnN0IHJlZ2lvbl9oaWdoID0gc3JjX25lYXJieS5pdHZbMV0gPz8gSW5maW5pdHk7XG5cbiAgICAgICAgLy8gbm8gZnV0dXJlIGxlYXZlIGV2ZW50IGlmIHRoZSByZWdpb24gY292ZXJzIHRoZSBlbnRpcmUgdGltZWxpbmUgXG4gICAgICAgIGlmIChyZWdpb25fbG93ID09IC1JbmZpbml0eSAmJiByZWdpb25faGlnaCA9PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgLy8gd2lsbCBuZXZlciBsZWF2ZSByZWdpb25cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc19jbG9ja19jdXJzb3IoY3Vyc29yLmN0cmwpKSB7XG4gICAgICAgICAgICAvKiBcbiAgICAgICAgICAgICAgICBjdXJzb3IuY3RybCBpcyBhIGNsb2NrIHByb3ZpZGVyXG5cbiAgICAgICAgICAgICAgICBwb3NzaWJsZSB0aW1lb3V0IGFzc29jaWF0ZWQgd2l0aCBsZWF2aW5nIHJlZ2lvblxuICAgICAgICAgICAgICAgIHRocm91Z2ggcmVnaW9uX2hpZ2ggLSBhcyBjbG9jayBpcyBpbmNyZWFzaW5nLlxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgY29uc3QgdGFyZ2V0X3BvcyA9IHJlZ2lvbl9oaWdoO1xuICAgICAgICAgICAgY29uc3QgZGVsdGFfbXMgPSAodGFyZ2V0X3BvcyAtIGN1cnJlbnRfcG9zKSAqIDEwMDA7XG4gICAgICAgICAgICB0aWQgPSBzZXRfdGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgY3Vyc29yX29uY2hhbmdlKCk7XG4gICAgICAgICAgICB9LCBkZWx0YV9tcyk7XG4gICAgICAgICAgICAvLyBsZWF2ZSBldmVudCBzY2hlZHVsZWRcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBcbiAgICAgICAgXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIGlzX2Nsb2NrX2N1cnNvcihjdXJzb3IuY3RybC5jdHJsKSAmJiBcbiAgICAgICAgICAgIGlzX2l0ZW1zX2xheWVyKGN1cnNvci5jdHJsLnNyYylcbiAgICAgICAgKSB7XG4gICAgICAgICAgICAvKiBcbiAgICAgICAgICAgICAgICBjdXJzb3IuY3RybCBpcyBhIGN1cnNvciB3aXRoIGEgY2xvY2sgcHJvdmlkZXJcblxuICAgICAgICAgICAgICAgIHBvc3NpYmxlIHRpbWVvdXQgYXNzb2NpYXRlZCB3aXRoIGxlYXZpbmcgcmVnaW9uXG4gICAgICAgICAgICAgICAgdGhyb3VnaCByZWdpb25fbG93IG9yIHJlZ2lvbl9oaWdoLlxuXG4gICAgICAgICAgICAgICAgSG93ZXZlciwgdGhpcyBjYW4gb25seSBiZSBwcmVkaWN0ZWQgaWYgY3Vyc29yLmN0cmxcbiAgICAgICAgICAgICAgICBpbXBsZW1lbnRzIGEgZGV0ZXJtaW5pc3RpYyBmdW5jdGlvbiBvZiB0aW1lLlxuXG4gICAgICAgICAgICAgICAgVGhpcyBjYW4gYmUgdGhlIGNhc2UgaWYgY3Vyc29yLmN0ci5zcmMgaXMgYW4gaXRlbXMgbGF5ZXIsXG4gICAgICAgICAgICAgICAgYW5kIGEgc2luZ2xlIGFjdGl2ZSBpdGVtIGRlc2NyaWJlcyBlaXRoZXIgYSBtb3Rpb24gb3IgYSB0cmFuc2l0aW9uICh3aXRoIGxpbmVhciBlYXNpbmcpLiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBjb25zdCBhY3RpdmVfaXRlbXMgPSBjdXJzb3IuY3RybC5zcmMuZ2V0X2l0ZW1zKGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgbGV0IHRhcmdldF9wb3M7XG5cbiAgICAgICAgICAgIGlmIChhY3RpdmVfaXRlbXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhY3RpdmVfaXRlbSA9IGFjdGl2ZV9pdGVtc1swXTtcbiAgICAgICAgICAgICAgICBpZiAoYWN0aXZlX2l0ZW0udHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IFtwLHYsYSx0XSA9IGFjdGl2ZV9pdGVtLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE8gY2FsY3VsYXRlIHRpbWVvdXQgd2l0aCBhY2NlbGVyYXRpb24gdG9vXG4gICAgICAgICAgICAgICAgICAgIGlmIChhID09IDAuMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmlndXJlIG91dCB3aGljaCByZWdpb24gYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodiA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRfcG9zID0gcmVnaW9uX2hpZ2g7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldF9wb3MgPSByZWdpb25fbG93O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVsdGFfbXMgPSAodGFyZ2V0X3BvcyAtIGN1cnJlbnRfcG9zKSAqIDEwMDA7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aWQgPSBzZXRfdGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3Vyc29yX29uY2hhbmdlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBkZWx0YV9tcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBsZWF2ZS1ldmVudCBzY2hlZHVsZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWN0aXZlX2l0ZW0udHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7djAsIHYxLCB0MCwgdDEsIGVhc2luZz1cImxpbmVhclwifSA9IGFjdGl2ZV9pdGVtLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlYXNpbmcgPT0gXCJsaW5lYXJcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGluZWFyIHRyYW5zdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHZlbG9jaXR5ID0gKHYxLXYwKS8odDEtdDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZlbG9jaXR5ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldF9wb3MgPSBNYXRoLm1pbihyZWdpb25faGlnaCwgdjEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0X3BvcyA9IE1hdGgubWF4KHJlZ2lvbl9sb3csIHYxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlbHRhX21zID0gKHRhcmdldF9wb3MgLSBjdXJyZW50X3BvcykgKiAxMDAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGlkID0gc2V0X3RpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnNvcl9vbmNoYW5nZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSwgZGVsdGFfbXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGVhdmUtZXZlbnQgc2NoZWR1bGVkXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogZGV0ZWN0aW9uIG9mIGxlYXZlIGV2ZW50cyBmYWxscyBiYWNrIG9uIHBvbGxpbmdcbiAgICAgICAgICovXG4gICAgICAgIHN0YXJ0X3BvbGxpbmcoc3JjX25lYXJieS5pdHYpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHN0YXJ0IHBvbGxpbmdcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBzdGFydF9wb2xsaW5nKGl0dikge1xuICAgICAgICBwaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICBoYW5kbGVfcG9sbGluZyhpdHYpO1xuICAgICAgICB9LCAxMDApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGhhbmRsZSBwb2xsaW5nXG4gICAgICovXG4gICAgZnVuY3Rpb24gaGFuZGxlX3BvbGxpbmcoaXR2KSB7XG4gICAgICAgIGxldCBvZmZzZXQgPSBjdXJzb3IuY3RybC52YWx1ZTtcbiAgICAgICAgaWYgKCFpbnRlcnZhbC5jb3ZlcnNfZW5kcG9pbnQoaXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICBjdXJzb3Jfb25jaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogbWFpbiBxdWVyeSBmdW5jdGlvbiAtIHJlc29sdmluZyBxdWVyeVxuICAgICAqIGZyb20gY2FjaGUgb2JqZWN0IGFzc29jaWF0ZWQgd2l0aCBjdXJzb3Iuc3JjXG4gICAgICovXG5cbiAgICBjdXJzb3IucXVlcnkgPSBmdW5jdGlvbiBxdWVyeShsb2NhbF90cykge1xuICAgICAgICBjb25zdCBvZmZzZXQgPSBnZXRfY3Vyc29yX2N0cmxfc3RhdGUoY3Vyc29yLCBsb2NhbF90cykudmFsdWU7IFxuICAgICAgICByZXR1cm4gc3JjX2NhY2hlLnF1ZXJ5KG9mZnNldCk7XG4gICAgfVxuICAgIFxuICAgIC8vIGluaXRpYWxpemVcbiAgICBjdXJzb3IuY3RybCA9IGN0cmw7XG4gICAgY3Vyc29yLnNyYyA9IHNyYztcbiAgICByZXR1cm4gY3Vyc29yO1xufSIsImltcG9ydCB7IGVuZHBvaW50fSBmcm9tIFwiLi4vdXRpbC9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuLi9uZWFyYnlfYmFzZS5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi4vbGF5ZXJfYmFzZS5qc1wiXG5pbXBvcnQgeyBDdXJzb3IgfSBmcm9tIFwiLi4vY3Vyc29yX2Jhc2UuanNcIjtcblxuLyoqXG4gKiBUaGlzIHdyYXBzIGEgY3Vyc29yIHNvIHRoYXQgaXQgY2FuIGJlIHVzZWQgYXMgYSBsYXllci5cbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gbGF5ZXJfZnJvbV9jdXJzb3Ioc3JjKSB7XG5cbiAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBDdXJzb3IpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgc3JjIG11c3QgYmUgYSBDdXJzb3IgJHtzcmN9YCk7XG4gICAgfVxuIFxuICAgIGNvbnN0IGxheWVyID0gbmV3IExheWVyKCk7XG4gICAgbGF5ZXIuaW5kZXggPSBuZXcgQ3Vyc29ySW5kZXgoc3JjKTtcbiAgICBcbiAgICAvLyBzdWJzY3JpYmVcbiAgICBzcmMuYWRkX2NhbGxiYWNrKChlQXJnKSA9PiB7XG4gICAgICAgIGxheWVyLm9uY2hhbmdlKGVBcmcpO1xuICAgIH0pO1xuXG4gICAgLy8gaW5pdGlhbGlzZVxuICAgIGxheWVyLnNyYyA9IHNyYztcbiAgICByZXR1cm4gbGF5ZXI7XG59IFxuXG5cbi8qKlxuICogQ3JlYXRlIGEgTmVhcmJ5SW5kZXggZm9yIHRoZSBDdXJzb3IuXG4gKiBcbiAqIFRoZSBjdXJzb3IgdmFsdWUgaXMgaW5kZXBlbmRlbnQgb2YgdGltZWxpbmUgb2Zmc2V0LCBcbiAqIHdoaWNoIGlzIHRvIHNheSB0aGF0IGl0IGhhcyB0aGUgc2FtZSB2YWx1ZSBmb3IgYWxsIFxuICogdGltZWxpbmUgb2Zmc2V0cy5cbiAqIFxuICogSW4gb3JkZXIgZm9yIHRoZSBkZWZhdWx0IExheWVyQ2FjaGUgdG8gd29yaywgYW5cbiAqIG9iamVjdCB3aXRoIGEgLnF1ZXJ5KG9mZnNldCkgbWV0aG9kIGlzIG5lZWRlZCBpbiBcbiAqIG5lYXJieS5jZW50ZXIuIFNpbmNlIGN1cnNvcnMgc3VwcG9ydCB0aGlzIG1ldGhvZFxuICogKGlnbm9yaW5nIHRoZSBvZmZzZXQpLCB3ZSBjYW4gdXNlIHRoZSBjdXJzb3IgZGlyZWN0bHkuXG4gKi9cblxuY2xhc3MgQ3Vyc29ySW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoY3Vyc29yKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2N1cnNvciA9IGN1cnNvcjtcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIC8vIGN1cnNvciBpbmRleCBpcyBkZWZpbmVkIGZvciBlbnRpcmUgdGltZWxpbmVcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGl0djogW251bGwsIG51bGwsIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgY2VudGVyOiBbdGhpcy5fY3Vyc29yXSxcbiAgICAgICAgICAgIGxlZnQ6IGVuZHBvaW50Lk5FR19JTkYsXG4gICAgICAgICAgICBwcmV2OiBlbmRwb2ludC5ORUdfSU5GLFxuICAgICAgICAgICAgcmlnaHQ6IGVuZHBvaW50LlBPU19JTkYsXG4gICAgICAgICAgICBuZXh0OiBlbmRwb2ludC5QT1NfSU5GLFxuICAgICAgICB9XG4gICAgfVxufVxuXG4iLCJpbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuLi91dGlsL2FwaV9zcmNwcm9wLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcl9iYXNlLmpzXCJcbmltcG9ydCB7IGVuZHBvaW50IH0gZnJvbSBcIi4uL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UsIG5lYXJieV9mcm9tIH0gZnJvbSBcIi4uL25lYXJieV9iYXNlLmpzXCI7XG5cblxuLyoqXG4gKiBDb252ZW5pZW5jZSBtZXJnZSBvcHRpb25zXG4gKi9cbmNvbnN0IE1FUkdFX09QVElPTlMgPSB7XG4gICAgc3VtOiB7XG4gICAgICAgIHZhbHVlRnVuYzogZnVuY3Rpb24gKGluZm8pIHtcbiAgICAgICAgICAgIC8vIHJldHVybnMgdGhlIHN1bSBvZiB2YWx1ZXMgb2YgYWN0aXZlIGxheWVyc1xuICAgICAgICAgICAgcmV0dXJuIGluZm8uc3RhdGVzXG4gICAgICAgICAgICAgICAgLm1hcChzdGF0ZSA9PiBzdGF0ZS52YWx1ZSkgXG4gICAgICAgICAgICAgICAgLnJlZHVjZSgoYWNjLCB2YWx1ZSkgPT4gYWNjICsgdmFsdWUsIDApO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBzdGFjazoge1xuICAgICAgICBzdGF0ZUZ1bmM6IGZ1bmN0aW9uIChpbmZvKSB7XG4gICAgICAgICAgICAvLyByZXR1cm5zIHZhbHVlcyBmcm9tIGZpcnN0IGFjdGl2ZSBsYXllclxuICAgICAgICAgICAgcmV0dXJuIHsuLi5pbmZvLnN0YXRlc1swXX1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgYXJyYXk6IHtcbiAgICAgICAgdmFsdWVGdW5jOiBmdW5jdGlvbiAoaW5mbykge1xuICAgICAgICAgICAgLy8gcmV0dXJucyBhbiBhcnJheSB3aXRoIHZhbHVlcyBmcm9tIGFjdGl2ZSBsYXllcnNcbiAgICAgICAgICAgIHJldHVybiBpbmZvLnN0YXRlcy5tYXAoc3RhdGUgPT4gc3RhdGUudmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIFxuICogVGhpcyBpbXBsZW1lbnRzIGEgbWVyZ2Ugb3BlcmF0aW9uIGZvciBsYXllcnMuXG4gKiBMaXN0IG9mIHNvdXJjZXMgaXMgaW1tdXRhYmxlLlxuICogXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlX2xheWVyIChzb3VyY2VzLCBvcHRpb25zPXt9KSB7XG4gICAgbGV0IHt0eXBlPVwiXCIsIC4uLm9wdHN9ID0gb3B0aW9ucztcblxuICAgIC8vIHR5cGUgc3BlY2lmaWVzIHByZWRlZmluZWQgb3B0aW9ucyBmb3IgTGF5ZXJcbiAgICBpZiAodHlwZSBpbiBNRVJHRV9PUFRJT05TKSB7XG4gICAgICAgIG9wdHMgPSBNRVJHRV9PUFRJT05TW3R5cGVdO1xuICAgIH1cbiAgICBjb25zdCBsYXllciA9IG5ldyBMYXllcihvcHRzKTsgICAgXG5cbiAgICAvLyBzZXR1cCBzb3VyY2VzIHByb3BlcnR5XG4gICAgc3JjcHJvcC5hZGRTdGF0ZShsYXllcik7XG4gICAgc3JjcHJvcC5hZGRNZXRob2RzKGxheWVyKTtcbiAgICBsYXllci5zcmNwcm9wX3JlZ2lzdGVyKFwic291cmNlc1wiKTtcblxuICAgIGxheWVyLnNyY3Byb3BfY2hlY2sgPSBmdW5jdGlvbihwcm9wTmFtZSwgc291cmNlcykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzb3VyY2VzXCIpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIHRoYXQgc291cmNlcyBpcyBhcnJheSBvZiBsYXllcnNcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShzb3VyY2VzKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgc291cmNlcyBtdXN0IGJlIGFycmF5ICR7c291cmNlc31gKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYWxsX2xheWVycyA9IHNvdXJjZXMubWFwKChlKSA9PiBlIGluc3RhbmNlb2YgTGF5ZXIpLmV2ZXJ5KGUgPT4gZSk7XG4gICAgICAgICAgICBpZiAoIWFsbF9sYXllcnMpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNvdXJjZXMgbXVzdCBhbGwgYmUgbGF5ZXJzICR7c291cmNlc31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc291cmNlcztcbiAgICB9XG5cbiAgICBsYXllci5zcmNwcm9wX29uY2hhbmdlID0gZnVuY3Rpb24ocHJvcE5hbWUsIGVBcmcpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic291cmNlc1wiKSB7XG4gICAgICAgICAgICBpZiAoZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5pbmRleCA9IG5ldyBOZWFyYnlJbmRleE1lcmdlKGxheWVyLnNvdXJjZXMpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgbGF5ZXIub25jaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGluaXRpYWxpc2VcbiAgICBsYXllci5zb3VyY2VzID0gc291cmNlcztcblxuICAgIHJldHVybiBsYXllclxufVxuXG5cblxuLyoqXG4gKiBDcmVhdGluZyBhIG1lcmdlZCBOZWFyYnlJbmRleCBmb3Igc2V0IG9mIExheWVycy5cbiAqICBcbiAqIEEgcmVnaW9uIHdpdGhpbiB0aGUgbWVyZ2VkIGluZGV4IHdpbGwgY29udGFpblxuICogYSBsaXN0IG9mIHJlZmVyZW5jZXMgdG8gKGNhY2hlIG9iamVjdHMpIGZvciBcbiAqIHRoZSBMYXllcnMgd2hpY2ggYXJlIGRlZmluZWQgaW4gdGhpcyByZWdpb24uXG4gKiBcbiAqIEltcGxlbWVudGF0aW9uIGlzIHN0YXRlbGVzcy5cbiAqIFNldCBvZiBsYXllcnMgaXMgYXNzdW1lZCB0byBiZSBzdGF0aWMuXG4gKi9cblxuZnVuY3Rpb24gY21wX2FzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAxLCBwMilcbn1cblxuZnVuY3Rpb24gY21wX2Rlc2NlbmRpbmcocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmNtcChwMiwgcDEpXG59XG5cbmV4cG9ydCBjbGFzcyBOZWFyYnlJbmRleE1lcmdlIGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKHNvdXJjZXMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fc291cmNlcyA9IHNvdXJjZXM7XG4gICAgICAgIHRoaXMuX2NhY2hlcyA9IG5ldyBNYXAoc291cmNlcy5tYXAoKHNyYykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFtzcmMsIHNyYy5jcmVhdGVDYWNoZSgpXTtcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgb2Zmc2V0ID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuICAgICAgICAvLyBhY2N1bXVsYXRlIG5lYXJieSBmcm9tIGFsbCBzb3VyY2VzXG4gICAgICAgIGNvbnN0IHByZXZfbGlzdCA9IFtdLCBuZXh0X2xpc3QgPSBbXTtcbiAgICAgICAgY29uc3QgY2VudGVyID0gW107XG4gICAgICAgIGNvbnN0IGNlbnRlcl9oaWdoX2xpc3QgPSBbXTtcbiAgICAgICAgY29uc3QgY2VudGVyX2xvd19saXN0ID0gW11cbiAgICAgICAgZm9yIChsZXQgc3JjIG9mIHRoaXMuX3NvdXJjZXMpIHtcbiAgICAgICAgICAgIGxldCBuZWFyYnkgPSBzcmMuaW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgICAgICBsZXQgcHJldl9yZWdpb24gPSBzcmMuaW5kZXguZmluZF9yZWdpb24obmVhcmJ5LCB7ZGlyZWN0aW9uOi0xfSk7XG4gICAgICAgICAgICBsZXQgbmV4dF9yZWdpb24gPSBzcmMuaW5kZXguZmluZF9yZWdpb24obmVhcmJ5LCB7ZGlyZWN0aW9uOjF9KTtcbiAgICAgICAgICAgIGlmIChwcmV2X3JlZ2lvbiAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBwcmV2X2xpc3QucHVzaChlbmRwb2ludC5mcm9tX2ludGVydmFsKHByZXZfcmVnaW9uLml0dilbMV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5leHRfcmVnaW9uICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIG5leHRfbGlzdC5wdXNoKGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmV4dF9yZWdpb24uaXR2KVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobmVhcmJ5LmNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY2VudGVyLnB1c2godGhpcy5fY2FjaGVzLmdldChzcmMpKTtcbiAgICAgICAgICAgICAgICBsZXQgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5lYXJieS5pdHYpO1xuICAgICAgICAgICAgICAgIGNlbnRlcl9oaWdoX2xpc3QucHVzaChoaWdoKTtcbiAgICAgICAgICAgICAgICBjZW50ZXJfbG93X2xpc3QucHVzaChsb3cpOyAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gZmluZCBjbG9zZXN0IGVuZHBvaW50IHRvIHRoZSByaWdodCAobm90IGluIGNlbnRlcilcbiAgICAgICAgbmV4dF9saXN0LnNvcnQoY21wX2FzY2VuZGluZyk7XG4gICAgICAgIGNvbnN0IG5leHRfbG93ID0gbmV4dF9saXN0WzBdIHx8IGVuZHBvaW50LlBPU19JTkY7XG5cbiAgICAgICAgLy8gZmluZCBjbG9zZXN0IGVuZHBvaW50IHRvIHRoZSBsZWZ0IChub3QgaW4gY2VudGVyKVxuICAgICAgICBwcmV2X2xpc3Quc29ydChjbXBfZGVzY2VuZGluZyk7XG4gICAgICAgIGNvbnN0IHByZXZfaGlnaCA9IHByZXZfbGlzdFswXSB8fCBlbmRwb2ludC5ORUdfSU5GO1xuXG4gICAgICAgIHJldHVybiBuZWFyYnlfZnJvbShcbiAgICAgICAgICAgICAgICBwcmV2X2hpZ2gsIFxuICAgICAgICAgICAgICAgIGNlbnRlcl9sb3dfbGlzdCwgXG4gICAgICAgICAgICAgICAgY2VudGVyLFxuICAgICAgICAgICAgICAgIGNlbnRlcl9oaWdoX2xpc3QsXG4gICAgICAgICAgICAgICAgbmV4dF9sb3dcbiAgICAgICAgICAgICk7XG4gICAgfVxufTtcbiIsImltcG9ydCB7IGludGVydmFsLCBlbmRwb2ludH0gZnJvbSBcIi4uL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi4vbmVhcmJ5X2Jhc2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVyX2Jhc2UuanNcIlxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQk9PTEVBTiBMQVlFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgZnVuY3Rpb24gYm9vbGVhbl9sYXllcihzcmMpIHtcblxuICAgIGNvbnN0IGxheWVyID0gbmV3IExheWVyKCk7XG4gICAgbGF5ZXIuaW5kZXggPSBuZXcgTmVhcmJ5SW5kZXhCb29sZWFuKHNyYy5pbmRleCk7XG4gICAgXG4gICAgLy8gc3Vic2NyaWJlXG4gICAgc3JjLmFkZF9jYWxsYmFjaygoZUFyZykgPT4ge1xuICAgICAgICBsYXllci5vbmNoYW5nZShlQXJnKTtcbiAgICB9KTtcblxuICAgIC8vIGluaXRpYWxpc2VcbiAgICBsYXllci5zcmMgPSBzcmM7XG4gICAgcmV0dXJuIGxheWVyO1xufSBcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQk9PTEVBTiBORUFSQlkgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBXcmFwcGVyIEluZGV4IHdoZXJlIHJlZ2lvbnMgYXJlIHRydWUvZmFsc2UsIGJhc2VkIG9uIFxuICogY29uZGl0aW9uIG9uIG5lYXJieS5jZW50ZXIuXG4gKiBCYWNrLXRvLWJhY2sgcmVnaW9ucyB3aGljaCBhcmUgdHJ1ZSBhcmUgY29sbGFwc2VkIFxuICogaW50byBvbmUgcmVnaW9uXG4gKiBcbiAqL1xuXG5mdW5jdGlvbiBxdWVyeU9iamVjdCAodmFsdWUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBxdWVyeTogZnVuY3Rpb24gKG9mZnNldCkge1xuICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZSwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4Qm9vbGVhbiBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbmRleCwgb3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9pbmRleCA9IGluZGV4O1xuICAgICAgICBsZXQge2NvbmRpdGlvbiA9IChjZW50ZXIpID0+IGNlbnRlci5sZW5ndGggPiAwfSA9IG9wdGlvbnM7XG4gICAgICAgIHRoaXMuX2NvbmRpdGlvbiA9IGNvbmRpdGlvbjtcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIG9mZnNldCA9IGVuZHBvaW50LmZyb21faW5wdXQob2Zmc2V0KTtcbiAgICAgICAgY29uc3QgbmVhcmJ5ID0gdGhpcy5faW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgIFxuICAgICAgICBsZXQgZXZhbHVhdGlvbiA9IHRoaXMuX2NvbmRpdGlvbihuZWFyYnkuY2VudGVyKTsgXG4gICAgICAgIC8qIFxuICAgICAgICAgICAgc2VlayBsZWZ0IGFuZCByaWdodCBmb3IgZmlyc3QgcmVnaW9uXG4gICAgICAgICAgICB3aGljaCBkb2VzIG5vdCBoYXZlIHRoZSBzYW1lIGV2YWx1YXRpb24gXG4gICAgICAgICovXG4gICAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IChjZW50ZXIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9jb25kaXRpb24oY2VudGVyKSAhPSBldmFsdWF0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZXhwYW5kIHJpZ2h0XG4gICAgICAgIGxldCByaWdodDtcbiAgICAgICAgbGV0IHJpZ2h0X25lYXJieSA9IHRoaXMuX2luZGV4LmZpbmRfcmVnaW9uKG5lYXJieSwge1xuICAgICAgICAgICAgZGlyZWN0aW9uOjEsIGNvbmRpdGlvblxuICAgICAgICB9KTsgICAgICAgIFxuICAgICAgICBpZiAocmlnaHRfbmVhcmJ5ICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmlnaHQgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKHJpZ2h0X25lYXJieS5pdHYpWzBdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZXhwYW5kIGxlZnRcbiAgICAgICAgbGV0IGxlZnQ7XG4gICAgICAgIGxldCBsZWZ0X25lYXJieSA9IHRoaXMuX2luZGV4LmZpbmRfcmVnaW9uKG5lYXJieSwge1xuICAgICAgICAgICAgZGlyZWN0aW9uOi0xLCBjb25kaXRpb25cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChsZWZ0X25lYXJieSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGxlZnQgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGxlZnRfbmVhcmJ5Lml0dilbMV07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBleHBhbmQgdG8gaW5maW5pdHlcbiAgICAgICAgbGVmdCA9IGxlZnQgfHwgZW5kcG9pbnQuTkVHX0lORjtcbiAgICAgICAgcmlnaHQgPSByaWdodCB8fCBlbmRwb2ludC5QT1NfSU5GO1xuICAgICAgICBjb25zdCBsb3cgPSBlbmRwb2ludC5mbGlwKGxlZnQpO1xuICAgICAgICBjb25zdCBoaWdoID0gZW5kcG9pbnQuZmxpcChyaWdodClcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGl0djogaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKSxcbiAgICAgICAgICAgIGNlbnRlciA6IFtxdWVyeU9iamVjdChldmFsdWF0aW9uKV0sXG4gICAgICAgICAgICBsZWZ0LFxuICAgICAgICAgICAgcmlnaHQsXG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcl9iYXNlLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJvb2xlYW4gfSBmcm9tIFwiLi9ib29sZWFuLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleE1lcmdlIH0gZnJvbSBcIi4vbWVyZ2UuanNcIjtcblxuXG5leHBvcnQgZnVuY3Rpb24gbG9naWNhbF9tZXJnZV9sYXllcihzb3VyY2VzLCBvcHRpb25zPXt9KSB7XG5cbiAgICBjb25zdCB7ZXhwcn0gPSBvcHRpb25zO1xuICAgIGxldCBjb25kaXRpb247XG4gICAgaWYgKGV4cHIpIHtcbiAgICAgICAgY29uZGl0aW9uID0gKGNlbnRlcikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGV4cHIuZXZhbChjZW50ZXIpO1xuICAgICAgICB9ICAgIFxuICAgIH1cblxuICAgIGNvbnN0IGxheWVyID0gbmV3IExheWVyKCk7XG4gICAgY29uc3QgaW5kZXggPSBuZXcgTmVhcmJ5SW5kZXhNZXJnZShzb3VyY2VzKTtcbiAgICBsYXllci5pbmRleCA9IG5ldyBOZWFyYnlJbmRleEJvb2xlYW4oaW5kZXgsIHtjb25kaXRpb259KTtcblxuICAgIC8vIHN1YnNjcmliZSB0byBjYWxsYmFja3MgZnJvbSBzb3VyY2VzXG4gICAgc291cmNlcy5tYXAoKHNyYykgPT4ge1xuICAgICAgICByZXR1cm4gc3JjLmFkZF9jYWxsYmFjayhsYXllci5vbmNoYW5nZSk7XG4gICAgfSk7XG4gICAgXG4gICAgbGF5ZXIuc291cmNlcyA9IHNvdXJjZXM7XG5cbiAgICByZXR1cm4gbGF5ZXI7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGxvZ2ljYWxfZXhwciAoc3JjKSB7XG4gICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgTGF5ZXIpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgbXVzdCBiZSBsYXllciAke3NyY31gKVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICBldmFsOiBmdW5jdGlvbiAoY2VudGVyKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBjYWNoZSBvZiBjZW50ZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FjaGUuc3JjID09IHNyYykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmxvZ2ljYWxfZXhwci5hbmQgPSBmdW5jdGlvbiBhbmQoLi4uZXhwcnMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBldmFsOiBmdW5jdGlvbiAoY2VudGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwcnMuZXZlcnkoKGV4cHIpID0+IGV4cHIuZXZhbChjZW50ZXIpKTtcbiAgICAgICAgfSAgICBcbiAgICB9XG59XG5cbmxvZ2ljYWxfZXhwci5vciA9IGZ1bmN0aW9uIG9yKC4uLmV4cHJzKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZXZhbDogZnVuY3Rpb24gKGNlbnRlcikge1xuICAgICAgICAgICAgcmV0dXJuIGV4cHJzLnNvbWUoKGV4cHIpID0+IGV4cHIuZXZhbChjZW50ZXIpKTtcbiAgICAgICAgfSAgICBcbiAgICB9XG59XG5cbmxvZ2ljYWxfZXhwci54b3IgPSBmdW5jdGlvbiB4b3IoZXhwcjEsIGV4cHIyKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZXZhbDogZnVuY3Rpb24gKGNlbnRlcikge1xuICAgICAgICAgICAgcmV0dXJuIGV4cHIxLmV2YWwoY2VudGVyKSAhPSBleHByMi5ldmFsKGNlbnRlcik7XG4gICAgICAgIH0gICAgXG4gICAgfVxufVxuXG5sb2dpY2FsX2V4cHIubm90ID0gZnVuY3Rpb24gbm90KGV4cHIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBldmFsOiBmdW5jdGlvbiAoY2VudGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gIWV4cHIuZXZhbChjZW50ZXIpO1xuICAgICAgICB9ICAgIFxuICAgIH1cbn1cblxuXG5cblxuIiwiaW1wb3J0IHsgZW5kcG9pbnQgfSBmcm9tIFwiLi4vdXRpbC9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuLi9uZWFyYnlfYmFzZS5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi4vbGF5ZXJfYmFzZS5qc1wiXG5pbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuLi91dGlsL2FwaV9zcmNwcm9wLmpzXCI7XG5cblxuLyoqXG4gKiBhZmZpbmUgdHJhbnNmb3JtIDFEIGJ5IHNoaWZ0IGFuZCBzY2FsZSBmYWN0b3JcbiAqL1xuXG5mdW5jdGlvbiB0cmFuc2Zvcm0ocCwge3NoaWZ0PTAsIHNjYWxlPTF9KSB7XG4gICAgaWYgKHAgPT0gdW5kZWZpbmVkIHx8ICFpc0Zpbml0ZShwKSkge1xuICAgICAgICAvLyBwIC0gbm9vcFxuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZW9mIHAgPT0gXCJudW1iZXJcIikge1xuICAgICAgICAvLyBwIGlzIG51bWJlciAtIHRyYW5zZm9ybVxuICAgICAgICByZXR1cm4gKHAqc2NhbGUpICsgc2hpZnQ7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHApICYmIHAubGVuZ3RoID4gMSkge1xuICAgICAgICAvLyBwIGlzIGVuZHBvaW50IC0gdHJhbnNmb3JtIHZhbHVlXG4gICAgICAgIGxldCBbdmFsLCBicmFja2V0XSA9IHA7XG4gICAgICAgIHJldHVybiBlbmRwb2ludC5mcm9tX2lucHV0KFsodmFsKnNjYWxlKStzaGlmdCwgYnJhY2tldF0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcmV2ZXJzZShwLCB7c2hpZnQ9MCwgc2NhbGU9MX0pIHtcbiAgICBpZiAocCA9PSB1bmRlZmluZWQgfHwgIWlzRmluaXRlKHApKSB7XG4gICAgICAgIC8vIHAgLSBub29wXG4gICAgICAgIHJldHVybiBwO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2YgcCA9PSBcIm51bWJlclwiKSB7XG4gICAgICAgIC8vIHAgaXMgbnVtYmVyIC0gdHJhbnNmb3JtXG4gICAgICAgIHJldHVybiAocC1zaGlmdCkvc2NhbGU7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHApICYmIHAubGVuZ3RoID4gMSkge1xuICAgICAgICAvLyBwIGlzIGVuZHBvaW50IC0gdHJhbnNmb3JtIHZhbHVlXG4gICAgICAgIGxldCBbdmFsLCBicmFja2V0XSA9IHA7XG4gICAgICAgIHJldHVybiBlbmRwb2ludC5mcm9tX2lucHV0KFsoKHZhbC1zaGlmdCkvc2NhbGUpLCBicmFja2V0XSk7XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBORUFSQlkgSU5ERVggLSBBRkZJTkUgVElNRUxJTkUgVFJBTlNGT1JNXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmNsYXNzIE5lYXJieUluZGV4QVRUIGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yIChsYXllciwgb3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICB0aGlzLl9jYWNoZSA9IGxheWVyLmNyZWF0ZUNhY2hlKCk7XG4gICAgICAgIHRoaXMuX29wdGlvbnMgPSBvcHRpb25zO1xuICAgICAgICBcbiAgICAgICAgLy8gdHJhbnNmb3JtIGNhY2hlXG4gICAgICAgIHRoaXMuX3RyYW5zZm9ybV9jYWNoZSA9IHtcbiAgICAgICAgICAgIHF1ZXJ5OiBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgLy8gcmV2ZXJzZSB0cmFuc2Zvcm0gcXVlcnlcbiAgICAgICAgICAgICAgICBjb25zdCBzdGF0ZSA9IHRoaXMuX2NhY2hlLnF1ZXJ5KHJldmVyc2Uob2Zmc2V0LCB0aGlzLl9vcHRpb25zKSk7XG4gICAgICAgICAgICAgICAgLy8ga2VlcCBvcmlnaW5hbCBvZmZzZXQgKGluc3RlYWQgb2YgcmV2ZXJzaW5nIHJlc3VsdClcbiAgICAgICAgICAgICAgICByZXR1cm4gey4uLnN0YXRlLCBvZmZzZXR9O1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBvZmZzZXQgPSBlbmRwb2ludC5mcm9tX2lucHV0KG9mZnNldCk7XG4gICAgICAgIC8vIHJldmVyc2UgdHJhbnNmb3JtIHF1ZXJ5IG9mZnNldFxuICAgICAgICBjb25zdCBuZWFyYnkgPSB0aGlzLl9sYXllci5pbmRleC5uZWFyYnkocmV2ZXJzZShvZmZzZXQsIHRoaXMuX29wdGlvbnMpKTtcbiAgICAgICAgLy8gdHJhbnNmb3JtIHF1ZXJ5IHJlc3VsdCBcbiAgICAgICAgY29uc3QgaXR2ID0gbmVhcmJ5Lml0di5zbGljZSgpO1xuICAgICAgICBpdHZbMF0gPSB0cmFuc2Zvcm0obmVhcmJ5Lml0dlswXSwgdGhpcy5fb3B0aW9ucyk7XG4gICAgICAgIGl0dlsxXSA9IHRyYW5zZm9ybShuZWFyYnkuaXR2WzFdLCB0aGlzLl9vcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGl0dixcbiAgICAgICAgICAgIGxlZnQ6IHRyYW5zZm9ybShuZWFyYnkubGVmdCwgdGhpcy5fb3B0aW9ucyksXG4gICAgICAgICAgICByaWdodDogdHJhbnNmb3JtKG5lYXJieS5yaWdodCwgdGhpcy5fb3B0aW9ucyksXG4gICAgICAgICAgICBjZW50ZXI6IG5lYXJieS5jZW50ZXIubWFwKCgpID0+IHRoaXMuX3RyYW5zZm9ybV9jYWNoZSlcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVElNRUxJTkUgVFJBTlNGT1JNIExBWUVSXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogU2hpZnRpbmcgYW5kIHNjYWxpbmcgdGhlIHRpbWVsaW5lIG9mIGEgbGF5ZXJcbiAqIFxuICogb3B0aW9uczpcbiAqIC0gc2hpZnQ6IGEgdmFsdWUgb2YgMiBlZmZlY3RpdmVseSBtZWFucyB0aGF0IGxheWVyIGNvbnRlbnRzIFxuICogICBhcmUgc2hpZnRlZCB0byB0aGUgcmlnaHQgb24gdGhlIHRpbWVsaW5lLCBieSAyIHVuaXRzXG4gKiAtIHNjYWxlOiBhIHZhbHVlIG9mIDIgbWVhbnMgdGhhdCB0aGUgbGF5ZXIgaXMgc3RyZXRjaGVkXG4gKiAgIGJ5IGEgZmFjdG9yIG9mIDJcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gdGltZWxpbmVfdHJhbnNmb3JtIChzcmMsIG9wdGlvbnM9e30pIHtcblxuICAgIGNvbnN0IGxheWVyID0gbmV3IExheWVyKCk7XG5cbiAgICAvLyBzZXR1cCBzcmMgcHJvcGVydHlcbiAgICBzcmNwcm9wLmFkZFN0YXRlKGxheWVyKTtcbiAgICBzcmNwcm9wLmFkZE1ldGhvZHMobGF5ZXIpO1xuICAgIGxheWVyLnNyY3Byb3BfcmVnaXN0ZXIoXCJzcmNcIik7XG4gICAgICAgIFxuICAgIGxheWVyLnNyY3Byb3BfY2hlY2sgPSBmdW5jdGlvbihwcm9wTmFtZSwgc3JjKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBMYXllcikpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwic3JjXCIgbXVzdCBiZSBMYXllciAke3NyY31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzcmM7ICAgIFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGF5ZXIuc3JjcHJvcF9vbmNoYW5nZSA9IGZ1bmN0aW9uKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAoZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4ID0gbmV3IE5lYXJieUluZGV4QVRUKHRoaXMuc3JjLCBvcHRpb25zKVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGxheWVyLm9uY2hhbmdlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpbml0aWFsaXNlXG4gICAgbGF5ZXIuc3JjID0gc3JjO1xuICAgIFxuICAgIHJldHVybiBsYXllcjtcbn1cblxuIiwiaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4uL2N1cnNvcl9iYXNlLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcl9iYXNlLmpzXCJcbmltcG9ydCB7IE5lYXJieUluZGV4U3JjIH0gZnJvbSBcIi4uL25lYXJieV9iYXNlLmpzXCJcbmltcG9ydCB7IGlzX2Nsb2NrX2N1cnNvciB9IGZyb20gXCIuLi9jdXJzb3JfY2xvY2suanNcIjtcblxuXG5mdW5jdGlvbiB0b1N0YXRlKHN0YXRlLCBvcHRpb25zPXt9KSB7XG4gICAgY29uc3Qge3ZhbHVlRnVuYywgc3RhdGVGdW5jfSA9IG9wdGlvbnM7XG4gICAgaWYgKHZhbHVlRnVuYyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3RhdGUudmFsdWUgPSB2YWx1ZUZ1bmMoc3RhdGUudmFsdWUpO1xuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfSBlbHNlIGlmIChzdGF0ZUZ1bmMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBzdGF0ZUZ1bmMoc3RhdGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9XG59XG5cbi8qKlxuICogQ3Vyc29yIFRyYW5zZm9ybVxuICogQ3JlYXRlIGEgbmV3IEN1cnNvciB3aGljaCBpcyBhIHRyYW5zZm9ybWF0aW9uIG9mIHRoZSBzcmMgQ3Vyc29yXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjdXJzb3JfdHJhbnNmb3JtKHNyYywgb3B0aW9ucz17fSkge1xuXG4gICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgQ3Vyc29yKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNyYyBtdXN0IGJlIGEgQ3Vyc29yICR7c3JjfWApO1xuICAgIH1cblxuICAgIGNvbnN0IGN1cnNvciA9IG5ldyBDdXJzb3IoKTtcblxuICAgIC8vIGltcGxlbWVudCBxdWVyeVxuICAgIGN1cnNvci5xdWVyeSA9IGZ1bmN0aW9uIHF1ZXJ5KCkge1xuICAgICAgICBjb25zdCBzdGF0ZSA9IHNyYy5xdWVyeSgpO1xuICAgICAgICByZXR1cm4gdG9TdGF0ZShzdGF0ZSwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLy8gYWRvcHQgdGhlIGN0cmwgb2YgdGhlIHNyYy1jdXJzb3JcbiAgICBpZiAoIWlzX2Nsb2NrX2N1cnNvcihzcmMpKSB7XG4gICAgICAgIGN1cnNvci5jdHJsID0gc3JjLmN0cmw7XG4gICAgICAgIC8vIGFkZCBjYWxsYmFja3NcbiAgICAgICAgY3Vyc29yLmN0cmwuYWRkX2NhbGxiYWNrKCgpID0+IHtjdXJzb3Iub25jaGFuZ2UoKX0pO1xuICAgIH1cblxuICAgIC8qIFxuICAgICAgICBDdXJyZW50IGRlZmluaXRpb24gb2YgQ3Vyc29yIHNyYyBwcm9wZXJ0eSBpcyB0aGF0IGl0IGlzIGEgbGF5ZXIgb3IgdW5kZWZpbmVkLlxuICAgICAgICBUaGlzIGxlYXZlcyBjdXJzb3IgdHJhbnNmb3JtIG9wdGlvbnMuXG4gICAgICAgIDEpIHdyYXAgc3JjIGN1cnNvciBhcyBhIGxheWVyLFxuICAgICAgICAyKSBsZXQgc3JjIHByb3BlcnR5IGJlIHVuZGVmaW5lZFxuICAgICAgICAzKSBhZG9wdCB0aGUgc3JjIHByb3BlcnR5IG9mIHRoZSBzcmMgY3Vyc29yIGFzIGl0cyBvd24gc3JjXG5cbiAgICAgICAgV2UgZ28gZm9yIDMpXG4gICAgKi9cblxuICAgIC8vIGFkb3B0IHRoZSBzcmMgb2YgdGhlIHNyYy1jdXJzb3IgYXMgc3JjXG4gICAgaWYgKCFpc19jbG9ja19jdXJzb3Ioc3JjKSkge1xuICAgICAgICBjdXJzb3Iuc3JjID0gc3JjLnNyYztcbiAgICB9XG5cbiAgICAvLyBjYWxsYmFja3MgZnJvbSBzcmMtY3Vyc29yXG4gICAgc3JjLmFkZF9jYWxsYmFjaygoKSA9PiB7Y3Vyc29yLm9uY2hhbmdlKCl9KTtcbiAgICByZXR1cm4gY3Vyc29yO1xufVxuXG5cbi8qKlxuICogTGF5ZXIgVHJhbnNmb3JtXG4gKiBDcmVhdGUgYSBuZXcgTGF5ZXIgd2hpY2ggaXMgYSB0cmFuc2Zvcm1hdGlvbiBvZiB0aGUgc3JjIExheWVyXG4gKi9cblxuZnVuY3Rpb24gd3JhcHBlZFZhbHVlRnVuYyh2YWx1ZUZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHtzb3VyY2VzLCBzdGF0ZXMsIG9mZnNldH0pIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlRnVuYyhzdGF0ZXNbMF0udmFsdWUpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gd3JhcHBlZFN0YXRlRnVuYyhzdGF0ZUZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHtzb3VyY2VzLCBzdGF0ZXMsIG9mZnNldH0pIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlRnVuYyhzdGF0ZXNbMF0pO1xuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxheWVyX3RyYW5zZm9ybShzcmMsIG9wdGlvbnM9e30pIHtcblxuICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNyYyBtdXN0IGJlIGEgTGF5ZXIgJHtzcmN9YCk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3BzID0ge307XG4gICAgb3BzLnZhbHVlRnVuYyA9IHdyYXBwZWRWYWx1ZUZ1bmMob3B0aW9ucy52YWx1ZUZ1bmMpO1xuICAgIG9wcy5zdGF0ZUZ1bmMgPSB3cmFwcGVkU3RhdGVGdW5jKG9wdGlvbnMuc3RhdGVGdW5jKTtcblxuICAgIGNvbnN0IGxheWVyID0gbmV3IExheWVyKG9wcyk7XG4gICAgbGF5ZXIuaW5kZXggPSBuZXcgTmVhcmJ5SW5kZXhTcmMoc3JjKTtcbiAgICBsYXllci5zcmMgPSBzcmM7XG4gICAgbGF5ZXIuc3JjLmFkZF9jYWxsYmFjaygoZUFyZykgPT4ge2xheWVyLm9uY2hhbmdlKGVBcmcpfSk7XG4gICAgcmV0dXJuIGxheWVyO1xufVxuXG5cblxuIiwiaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4uL2N1cnNvcl9iYXNlLmpzXCI7XG5pbXBvcnQgeyBpc19jbG9ja19jdXJzb3IsIGNsb2NrX2N1cnNvciB9IGZyb20gXCIuLi9jdXJzb3JfY2xvY2suanNcIjtcbmltcG9ydCB7IGlzX2l0ZW1zX2xheWVyIH0gZnJvbSBcIi4uL2xheWVyX2l0ZW1zLmpzXCI7XG5pbXBvcnQgeyBpc19jbG9ja19wcm92aWRlciwgTE9DQUxfQ0xPQ0tfUFJPVklERVIgfSBmcm9tIFwiLi4vcHJvdmlkZXJfY2xvY2suanNcIjtcbmltcG9ydCB7IGxvY2FsX2Nsb2NrIH0gZnJvbSBcIi4uL3V0aWwvY29tbW9uLmpzXCI7XG5cbi8qKlxuICogcmVjb3JkZXIgZm9yIGN1cnNvciBpbnRvIGxheWVyXG4gKiBcbiAqICAgTUFJTiBJREVBXG4gKiAtIHJlY29yZCB0aGUgY3VycmVudCB2YWx1ZSBvZiBhIGN1cnNvciAoc3JjKSBpbnRvIGEgbGF5ZXIgKGRzdClcbiAqIC0gcmVjb3JkaW5nIGlzIGVzc2VudGlhbGx5IGEgY29weSBvcGVyYXRpb24gZnJvbSB0aGVcbiAqICAgc3RhdGVQcm92aWRlciBvZiB0aGUgY3Vyc29yIChzcmMpIHRvIHRoZSBzdGF0ZVByb3ZpZGVyIG9mIHRoZSBsYXllciAoZHN0KS5cbiAqIC0gcmVjb3JkaW5nIGRvZXMgbm90IGFwcGx5IHRvIGRlcml2ZWQgY3Vyc29ycyAtIG9ubHkgY3Vyc29ycyB0aGF0XG4gKiAgIGFyZSBkaXJlY3RseSBjb25uZWN0ZWQgdG8gYSBzdGF0ZVByb3ZpZGVyLlxuICpcbiAqIFxuICogICBUSU1FRlJBTUVTXG4gKiAtIHRoZSAoc3JjKSBjdXJzb3IgaXMgZHJpdmVuIGJ5IGEgY2xvY2sgKHNyYy5jdHJsKTogPFNSQ19DTE9DSz4gXG4gKiAtIHRoZSByZWNvcmRpbmcgdG8gKGRzdCkgbGF5ZXIgaXMgZHJpdmVuIGJ5IGEgY2xvY2sgKGN0cmwpOiA8RFNUX0NMT0NLPlxuICogLSBpZiBTUkNfQ0xPQ0sgaXMgbm90IHRoZSBzYW1lIGFzIERTVF9DTE9DSywgcmVjb3JkZWQgaXRlbXMgbmVlZCB0byBiZVxuICogICBjb252ZXJ0ZWQgdG8gdGhlIERTVF9DTE9DSyB0aW1lIGZyYW1lLlxuICogLSBmb3IgZXhhbXBsZSAtIGEgY29tbW9uIHNjZW5hcmlvIHdvdWxkIGJlIHRvIHJlY29yZCBhIGN1cnNvciB3aXRoIHJlYWwtdGltZVxuICogICB0aW1lc3RhbXBzIGludG8gYSBsb2dpY2FsIHRpbWVsaW5lIHN0YXJ0aW5nIGF0IDAsIHBvc3NpYmx5IFxuICogICByZXdpbmRpbmcgdGhlIERTVF9DTE9DSyB0byAwIG11bHRpcGxlIHRpbWVzIGluIG9yZGVyIHRvIGRvIG5ldyB0YWtlc1xuICogXG4gKiAgIFJFQ09SRElOR1xuICogLSByZWNvcmRpbmcgaXMgZG9uZSBieSBhcHBlbmRpbmcgaXRlbXMgdG8gdGhlIGRzdCBsYXllciBcbiAqIC0gd2hlbiB0aGUgY3Vyc29yIHN0YXRlIGNoYW5nZXMgKGVudGlyZSB0aW1lbGluZSByZXNldCkgXG4gKiAtIHRoZSBwYXJ0IG9mIGl0IHdoaWNoIGRlc2NyaWJlcyB0aGUgZnV0dXJlIHdpbGwgb3ZlcndyaXRlIHRoZSByZWxldmFudFxuICogLSBwYXJ0IG9mIHRoZSB0aGUgbGF5ZXIgdGltZWxpbmVcbiAqIC0gdGhlIGRlbGluZWF0aW9uIGJldHdlZW4gcGFzdCBhbmQgZnV0dXJlIGlzIGRldGVybWluZWQgYnkgXG4gKiAtIGZyZXNoIHRpbWVzdGFtcCA8VFM+IGZyb20gPERTVF9DTE9DSz5cbiAqIC0gaWYgYW4gaXRlbSBvdmVybGFwcyB3aXRoIDxUUz4gaXQgd2lsbCBiZSB0cnVuY2F0ZXMgc28gdGhhdCBvbmx5IHRoZSBwYXJ0XG4gKiAtIHRoYXQgaXMgaW4gdGhlIGZ1dHVyZSB3aWxsIGJlIHJlY29yZGVkIChjb3BpZWQpIHRvIHRoZSBsYXllci5cbiAqIC0gaW4gY2FzZSAoY3RybCkgaXMgYSBtZWRpYSBjb250cm9sIC0gcmVjb3JkaW5nIGNhbiBvbmx5IGhhcHBlblxuICogICB3aGVuIHRoZSAoY3RybCkgaXMgbW92aW5nIGZvcndhcmRcbiAqIFxuICogICBJTlBVVFxuICogLSAoY3RybCkgLSBjbG9jayBjdXJzb3Igb3IgY2xvY2sgcHJvdmlkZXIgbWVkaWEgY29udHJvbCBcbiAqICAgKGN0cmwgaXMgY2xvY2tfY3Vyc29yIG9yIGN0cmwuY3RybCBpcyBjbG9ja19jdXJzb3IpXG4gKiAtIChzcmMpIC0gY3Vyc29yIHdpdGggYSBpdGVtc2xheWVyIGFzIHNyYyBcbiAqICAgKHNyYy5zcmMgaXMgaXRlbXNsYXllcilcbiAqIC0gKGRzdCkgLSBpdGVtc2xheWVyXG4gKlxuICogICBXQVJOSU5HXG4gKiAtIGltcGxlbWVudGF0aW9uIGFzc3VtZXMgKGRzdCkgbGF5ZXIgaXMgbm90IHRoZSBzYW1lIGFzIHRoZSAoc3JjKSBsYXllclxuICogLSAoc3JjKSBjdXJzb3IgY2FuIG5vdCBiZSBjbG9jayBjdXJzb3IgKG1ha2VzIG5vIHNlbnNlIHRvIHJlY29yZCBhIGNsb2NrXG4gKiAgIC0gZXNwZWNpYWxseSB3aGVuIHlvdSBjYW4gbWFrZSBhIG5ldyBvbmUgYXQgYW55IHRpbWUpXG4gKiAgXG4gKiAtIGlmIChkc3QpIGlzIG5vdCBwcm92aWRlZCwgYW4gZW1wdHkgbGF5ZXIgd2lsbCBiZSBjcmVhdGVkXG4gKiAtIGlmIChjdHJsKSBpcyBub3QgcHJvdmlkZWQsIExPQ0FMX0NMT0NLX1BST1ZJREVSIHdpbGwgYmUgdXNlZFxuICovXG5cblxuZXhwb3J0IGZ1bmN0aW9uIGxheWVyX3JlY29yZGVyKGN0cmw9TE9DQUxfQ0xPQ0tfUFJPVklERVIsIHNyYywgZHN0KSB7XG5cbiAgICAvLyBjaGVjayAtIGN0cmwgXG4gICAgaWYgKGlzX2Nsb2NrX3Byb3ZpZGVyKGN0cmwpKSB7XG4gICAgICAgIGN0cmwgPSBjbG9ja19jdXJzb3IoY3RybCk7XG4gICAgfVxuICAgIGlmIChcbiAgICAgICAgIWlzX2Nsb2NrX2N1cnNvcihjdHJsKSAmJlxuICAgICAgICAhaXNfY2xvY2tfY3Vyc29yKGN0cmwuY3RybClcbiAgICApe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGN0cmwgb3IgY3RybC5jdHJsIG11c3QgYmUgYSBjbG9jayBjdXJzb3IgJHtjdHJsfWApO1xuICAgIH0gICAgXG5cbiAgICAvLyBjaGVjayAtIHNyY1xuICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIEN1cnNvcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzcmMgbXVzdCBiZSBhIGN1cnNvciAke3NyY31gKTtcbiAgICB9XG4gICAgaWYgKGlzX2Nsb2NrX2N1cnNvcihzcmMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgc3JjIGNhbiBub3QgYmUgYSBjbG9jayBjdXJzb3IgJHtzcmN9YCk7XG4gICAgfVxuICAgIGlmICghaXNfaXRlbXNfbGF5ZXIoc3JjLnNyYykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjdXJzb3Igc3JjIG11c3QgYmUgaXRlbXNsYXllciAke3NyYy5zcmN9YCk7XG4gICAgfVxuXG4gICAgLy8gY2hlY2sgLSBkc3RcbiAgICBpZiAoIWlzX2l0ZW1zX2xheWVyKGRzdCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBkc3QgbXVzdCBiZSBhIGl0ZW1zbGF5ZXIgJHtkc3R9YCk7XG4gICAgfVxuXG4gICAgLy8gY2hlY2sgLSBzdGF0ZVByb3ZpZGVyc1xuICAgIGNvbnN0IHNyY19zdGF0ZVByb3ZpZGVyID0gc3JjLnNyYy5zcmM7XG4gICAgY29uc3QgZHN0X3N0YXRlUHJvdmlkZXIgPSBkc3Quc3JjO1xuICAgIGlmIChzcmNfc3RhdGVQcm92aWRlciA9PT0gZHN0X3N0YXRlUHJvdmlkZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzcmMgYW5kIGRzdCBjYW4gbm90IGhhdmUgdGhlIHNhbWUgc3RhdGVQcm92aWRlcmApO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogdHVybiB0aGlzIGFyb3VuZD9cbiAgICAgKiBoYXZlIHN0YXJ0IGFuZCBzdG9wIHJlY29yZGluZ1xuICAgICAqIG1ldGhvZHMgZGlyZWN0IHRoZSBjb250cm9sP1xuICAgICAqIFxuICAgICAqIHJlY29yZGluZyB3aXRoIGxpdmUgY2xvY2sgcmVxdWlyZXNcbiAgICAgKiBzdGFydCBhbmQgc3RvcCBtZXRob2RzXG4gICAgICogXG4gICAgICogd2hhdCBhYm91dCBhIG1lZGlhIGNsb2NrID9cbiAgICAgKiBzaG91bGQgYmUgYSBtZWRpYSBjbG9jayB0aGF0IGNhbiBvbmx5IG1vdmUgZm9yd2FyZFxuICAgICAqIGl0IGFjdHVhbGx5IG1ha2VzIHNlbnNlIHRvIGJlIGluIHJlY29yZCBtb2RlIGV2ZW4gaWYgbWVkaWFjbG9jayBpcyBwYXVzZWRcbiAgICAgKiBiZWNhdXNlIHJlY29yZGluZyBvbmx5IGhhcHBlbnMgb24gc3RhdGUgY2hhbmdlXG4gICAgICogcGF1c2VkIG1lYW5zIHlvdSBvdmVyd3JpdGUgb24gdGhlIHNhbWUgc3BvdFxuICAgICAqIHNraXBwaW5nIGJhY2sgd2hpbGUgaW4gcmVjb3JkIG1vZGUgLSBzaG91bGQgdGhhdCB0cmlnZ2VyIHdyaXRlIGN1cnJlbnRcbiAgICAgKiBzdGF0ZSBsb25nZXIgYmFja1xuICAgICAqIFxuICAgICAqIHNraXBwaW5nIGFsd2F5cyBleGl0IHJlY29yZCBtb2RlXG4gICAgICogcmVjb3JkIG1vZGUgYWx3YXlzIHN0YXJ0c1xuICAgICAqIG1lZGlhIGNvbnRyb2wgbWF5IGJlIGNvbnRyb2xsZWQgZXh0ZXJuYWxseVxuICAgICAqIFxuICAgICAqIHNwbGl0IGJldHdlZW4gYSBsaXZlIGFuZCBhIG1lZGlhIGNsb2NrIHJlY29yZGVyP1xuICAgICAqIFxuICAgICAqL1xuXG5cblxuICAgIC8vIGludGVybmFsIHN0YXRlXG4gICAgbGV0IGlzX3JlY29yZGluZyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogc3RhdGUgY2hhbmdlIGluIHNyYyBzdGF0ZVByb3ZpZGVyXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBvbl9zcmNfY2hhbmdlICgpIHtcbiAgICAgICAgaWYgKCFpc19yZWNvcmRpbmcpIHJldHVybjtcbiAgICAgICAgcmVjb3JkKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc3RhdGUgY2hhbmdlIGluIGN0cmxcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBvbl9jdHJsX2NoYW5nZSAoKSB7XG4gICAgICAgIC8vIGZpZ3VyZSBvdXQgaWYgcmVjb3JkaW5nIHN0YXJ0cyBvciBzdG9wc1xuICAgICAgICBjb25zdCB3YXNfcmVjb3JkaW5nID0gaXNfcmVjb3JkaW5nO1xuICAgICAgICBpc19yZWNvcmRpbmcgPSBmYWxzZTtcbiAgICAgICAgaWYgKGlzX2Nsb2NrX2N1cnNvcihjdHJsKSkge1xuICAgICAgICAgICAgaXNfcmVjb3JkaW5nID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChpc19jbG9ja19jdXJzb3IoY3RybC5jdHJsKSkge1xuICAgICAgICAgICAgY29uc3QgY3RybF90cyA9IGN0cmwuY3RybC52YWx1ZTtcbiAgICAgICAgICAgIGNvbnN0IGl0ZW1zID0gY3RybC5zcmMuaW5kZXgubmVhcmJ5KGN0cmxfdHMpLmNlbnRlcjtcbiAgICAgICAgICAgIGlmIChpdGVtcy5sZW5ndGggPT0gMSlcbiAgICAgICAgICAgICAgICBpZiAoaXRlbXNbMF0udHlwZSA9PSBcIm1vdGlvblwiICkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBbcCx2LGEsdF0gPSBpdGVtc1swXS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICBpZiAodiA+IDAgfHwgdiA9PSAwICYmIGEgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpc19yZWNvcmRpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF3YXNfcmVjb3JkaW5nICYmIGlzX3JlY29yZGluZykge1xuICAgICAgICAgICAgc3RhcnRfcmVjb3JkaW5nKCk7XG4gICAgICAgIH0gZWxzZSBpZiAod2FzX3JlY29yZGluZyAmJiAhaXNfcmVjb3JkaW5nKSB7XG4gICAgICAgICAgICBzdG9wX3JlY29yZGluZygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVjb3JkXG4gICAgICovXG4gICAgZnVuY3Rpb24gc3RhcnRfcmVjb3JkaW5nKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcInN0YXJ0IHJlY29yZGluZ1wiKVxuICAgICAgICByZWNvcmQoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdG9wX3JlY29yZGluZygpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJzdG9wIHJlY29yZGluZ1wiKVxuICAgICAgICAvLyBjbG9zZSBsYXN0IGl0ZW1cbiAgICAgICAgY29uc3QgdHMgPSBsb2NhbF9jbG9jay5ub3coKTtcbiAgICAgICAgY29uc3QgZHN0X29mZnNldCA9IGN0cmwucXVlcnkodHMpLnZhbHVlO1xuICAgICAgICBjb25zdCBpdGVtcyA9IGRzdC5pbmRleC5uZWFyYnkoZHN0X29mZnNldCkuY2VudGVyO1xuICAgICAgICBjb25zdCBpbnNlcnQgPSBpdGVtcy5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG5ld19pdGVtID0gey4uLml0ZW19O1xuICAgICAgICAgICAgbmV3X2l0ZW0uaXR2WzFdID0gZHN0X29mZnNldDtcbiAgICAgICAgICAgIG5ld19pdGVtLml0dlszXSA9IGZhbHNlO1xuICAgICAgICAgICAgcmV0dXJuIG5ld19pdGVtO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGl0ZW1zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGRzdC51cGRhdGUoe2luc2VydCwgcmVzZXQ6ZmFsc2V9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlY29yZCgpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJyZWNvcmRcIilcbiAgICAgICAgY29uc3QgdHMgPSBsb2NhbF9jbG9jay5ub3coKTtcbiAgICAgICAgY29uc3Qgc3JjX29mZnNldCA9IHNyYy5xdWVyeSh0cykub2Zmc2V0O1xuICAgICAgICBjb25zdCBkc3Rfb2Zmc2V0ID0gY3RybC5xdWVyeSh0cykudmFsdWU7XG4gICAgICAgIC8vIGdldCBjdXJyZW50IHNyYyBpdGVtc1xuICAgICAgICBsZXQgc3JjX2l0ZW1zID0gc3JjX3N0YXRlUHJvdmlkZXIuZ2V0KCk7XG4gICAgICAgIC8vIHJlLWVuY29kZSBpdGVtcyBpbiBkc3QgdGltZWZyYW1lLCBpZiBuZWVkZWRcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gZHN0X29mZnNldCAtIHNyY19vZmZzZXQ7XG4gICAgICAgIGlmIChvZmZzZXQgIT0gMCkge1xuICAgICAgICAgICAgY29uc3QgZHN0X2l0ZW1zID0gc3JjX2l0ZW1zLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aW1lc2hpZnRfaXRlbShpdGVtLCBvZmZzZXQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBkc3QuYXBwZW5kKGRzdF9pdGVtcywgZHN0X29mZnNldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkc3QuYXBwZW5kKHNyY19pdGVtcywgc3JjX29mZnNldCk7XG4gICAgICAgIH0gICAgICAgIFxuICAgIH1cblxuICAgIC8vIHJlZ2lzdGVyIGNhbGxiYWNrc1xuICAgIHNyY19zdGF0ZVByb3ZpZGVyLmFkZF9jYWxsYmFjayhvbl9zcmNfY2hhbmdlKTtcbiAgICBjdHJsLmFkZF9jYWxsYmFjayhvbl9jdHJsX2NoYW5nZSk7XG4gICAgb25fY3RybF9jaGFuZ2UoKTtcbiAgICByZXR1cm4ge307XG59XG5cblxuLyoqXG4gKiB0aW1lc2hpZnQgcGFyYW1ldGVycyBvZiB0aW1lIGJ5IG9mZnNldFxuICovXG5mdW5jdGlvbiB0aW1lc2hpZnRfaXRlbSAoaXRlbSwgb2Zmc2V0KSB7XG4gICAgaXRlbSA9IHsuLi5pdGVtfTtcbiAgICBpdGVtLml0dlswXSA9IChpdGVtLml0dlswXSAhPSBudWxsKSA/IGl0ZW0uaXR2WzBdICsgb2Zmc2V0IDogbnVsbDtcbiAgICBpdGVtLml0dlsxXSA9IChpdGVtLml0dlsxXSAhPSBudWxsKSA/IGl0ZW0uaXR2WzFdICsgb2Zmc2V0IDogbnVsbDtcbiAgICAvLyBUT0RPIC0gcGVyaGFwcyBjaGFuZ2UgaW1wbGVtZW50YXRpb24gb2YgbW90aW9uIGFuZCB0cmFuc2l0aW9uIHNlZ21lbnRcbiAgICAvLyB0byB1c2UgdGltZXN0YW1wcyByZWxhdGl2ZSB0byB0aGUgc3RhcnQgb2YgdGhlIHNlZ21lbnQsXG4gICAgLy8gc2ltaWxhciB0byBpbnRlcnBvbGF0aW9uP1xuICAgIGlmIChpdGVtLnR5cGUgPT0gXCJtb3Rpb25cIikge1xuICAgICAgICBpdGVtLmRhdGEudGltZXN0YW1wID0gaXRlbS5kYXRhLnRpbWVzdGFtcCArIG9mZnNldDtcbiAgICB9IGVsc2UgaWYgKGl0ZW0udHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICBpdGVtLmRhdGEudDAgPSBpdGVtLmRhdGEudDAgKyBvZmZzZXQ7XG4gICAgICAgIGl0ZW0uZGF0YS50MSA9IGl0ZW0uZGF0YS50MSArIG9mZnNldDtcbiAgICB9XG4gICAgcmV0dXJuIGl0ZW07XG59XG5cblxuXG4iLCJpbXBvcnQge2VuZHBvaW50fSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuLypcbiAgICBTdGF0ZSBQcm92aWRlciBWaWV3ZXJcbiovXG5cbmZ1bmN0aW9uIGl0ZW0yc3RyaW5nKGl0ZW0sIG9wdGlvbnMpIHtcbiAgICAvLyB0eHRcbiAgICBjb25zdCBpZF90eHQgPSBpdGVtLmlkO1xuICAgIGNvbnN0IHR5cGVfdHh0ID0gaXRlbS50eXBlO1xuICAgIGxldCBpdHZfdHh0ID0gXCJcIjtcbiAgICBpZiAoaXRlbS5pdHYgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IFtsb3csIGhpZ2gsIGxvd0luY2x1ZGUsIGhpZ2hJbmNsdWRlXSA9IGl0ZW0uaXR2O1xuICAgICAgICBjb25zdCBsb3dfdHh0ID0gKGxvdyA9PSBudWxsKSA/IFwibnVsbFwiIDogbG93LnRvRml4ZWQoMik7XG4gICAgICAgIGNvbnN0IGhpZ2hfdHh0ID0gKGhpZ2ggPT0gbnVsbCkgPyBcIm51bGxcIiA6IGhpZ2gudG9GaXhlZCgyKTtcbiAgICAgICAgaXR2X3R4dCA9IGBbJHtsb3dfdHh0fSwke2hpZ2hfdHh0fSwke2xvd0luY2x1ZGV9LCR7aGlnaEluY2x1ZGV9XWA7IFxuICAgIH1cbiAgICBsZXQgZGF0YV90eHQgPSBKU09OLnN0cmluZ2lmeShpdGVtLmRhdGEpO1xuXG4gICAgLy8gaHRtbFxuICAgIGxldCBpZF9odG1sID0gYDxzcGFuIGNsYXNzPVwiaXRlbS1pZFwiPiR7aWRfdHh0fTwvc3Bhbj5gO1xuICAgIGxldCBpdHZfaHRtbCA9IGA8c3BhbiBjbGFzcz1cIml0ZW0taXR2XCI+JHtpdHZfdHh0fTwvc3Bhbj5gO1xuICAgIGxldCB0eXBlX2h0bWwgPSBgPHNwYW4gY2xhc3M9XCJpdGVtLXR5cGVcIj4ke3R5cGVfdHh0fTwvc3Bhbj5gXG4gICAgbGV0IGRhdGFfaHRtbCA9IGA8c3BhbiBjbGFzcz1cIml0ZW0tZGF0YVwiPiR7ZGF0YV90eHR9PC9zcGFuPmA7XG4gICAgXG4gICAgLy8gZGVsZXRlIEJ1dHRvblxuICAgIGNvbnN0IHtkZWxldGVfYWxsb3dlZD1mYWxzZX0gPSBvcHRpb25zO1xuICAgIGlmIChkZWxldGVfYWxsb3dlZCkge1xuICAgICAgICByZXR1cm4gYFxuICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgPGJ1dHRvbiBpZD1cImRlbGV0ZVwiPlg8L2J1dHRvbj5cbiAgICAgICAgICAgICR7aWRfaHRtbH06ICR7dHlwZV9odG1sfSAke2l0dl9odG1sfSAke2RhdGFfaHRtbH1cbiAgICAgICAgPC9kaXY+YDtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYFxuICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgJHtpZF9odG1sfTogJHt0eXBlX2h0bWx9ICR7aXR2X2h0bWx9ICR7ZGF0YV9odG1sfVxuICAgICAgICA8L2Rpdj5gOyAgICAgICAgXG4gICAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBTdGF0ZVByb3ZpZGVyVmlld2VyIHtcblxuICAgIGNvbnN0cnVjdG9yKHN0YXRlUHJvdmlkZXIsIGVsZW0sIG9wdGlvbnM9e30pIHtcbiAgICAgICAgdGhpcy5fc3AgPSBzdGF0ZVByb3ZpZGVyO1xuICAgICAgICB0aGlzLl9lbGVtID0gZWxlbTtcbiAgICAgICAgdGhpcy5faGFuZGxlID0gdGhpcy5fc3AuYWRkX2NhbGxiYWNrKHRoaXMuX29uY2hhbmdlLmJpbmQodGhpcykpOyBcblxuICAgICAgICAvLyBvcHRpb25zXG4gICAgICAgIGxldCBkZWZhdWx0cyA9IHtcbiAgICAgICAgICAgIHRvU3RyaW5nOml0ZW0yc3RyaW5nXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX29wdGlvbnMgPSB7Li4uZGVmYXVsdHMsIC4uLm9wdGlvbnN9O1xuXG4gICAgICAgIC8qXG4gICAgICAgICAgICBTdXBwb3J0IGRlbGV0ZVxuICAgICAgICAqL1xuICAgICAgICBpZiAodGhpcy5fb3B0aW9ucy5kZWxldGVfYWxsb3dlZCkge1xuICAgICAgICAgICAgLy8gbGlzdGVuIGZvciBjbGljayBldmVudHMgb24gcm9vdCBlbGVtZW50XG4gICAgICAgICAgICBlbGVtLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIGNhdGNoIGNsaWNrIGV2ZW50IGZyb20gZGVsZXRlIGJ1dHRvblxuICAgICAgICAgICAgICAgIGNvbnN0IGRlbGV0ZUJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoXCIjZGVsZXRlXCIpO1xuICAgICAgICAgICAgICAgIGlmIChkZWxldGVCdG4pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlzdEl0ZW0gPSBkZWxldGVCdG4uY2xvc2VzdChcIi5saXN0LWl0ZW1cIik7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaXN0SXRlbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc3AudXBkYXRlKHtyZW1vdmU6W2xpc3RJdGVtLmlkXX0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLypcbiAgICAgICAgICAgIHJlbmRlciBpbml0aWFsIHN0YXRlXG4gICAgICAgICovIFxuICAgICAgICB0aGlzLl9vbmNoYW5nZSgpO1xuICAgIH1cblxuICAgIF9vbmNoYW5nZSgpIHtcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLl9zcC5nZXQoKSB8fCBbXTtcblxuICAgICAgICAvLyBzb3J0IGJ5IGxvdyBlbmRwb2ludFxuICAgICAgICBpdGVtcy5zb3J0KChpdGVtX2EsIGl0ZW1fYikgPT4ge1xuICAgICAgICAgICAgbGV0IGxvd0VwX2EgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1fYS5pdHYpWzBdO1xuICAgICAgICAgICAgbGV0IGxvd0VwX2IgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1fYi5pdHYpWzBdO1xuICAgICAgICAgICAgcmV0dXJuIGVuZHBvaW50LmNtcChsb3dFcF9hLCBsb3dFcF9iKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gY2xlYXJcbiAgICAgICAgdGhpcy5fZWxlbS5yZXBsYWNlQ2hpbGRyZW4oKTtcbiAgICAgICAgLy8gcmVidWlsZFxuICAgICAgICBjb25zdCB7dG9TdHJpbmd9ID0gdGhpcy5fb3B0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaXRlbSBvZiBpdGVtcykge1xuICAgICAgICAgICAgLy8gYWRkXG4gICAgICAgICAgICBsZXQgbm9kZSA9IHRoaXMuX2VsZW0ucXVlcnlTZWxlY3RvcihgIyR7aXRlbS5pZH1gKTtcbiAgICAgICAgICAgIGlmIChub2RlID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgICAgICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShcImlkXCIsIGl0ZW0uaWQpO1xuICAgICAgICAgICAgICAgIG5vZGUuY2xhc3NMaXN0LmFkZChcImxpc3QtaXRlbVwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9lbGVtLmFwcGVuZENoaWxkKG5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbm9kZS5pbm5lckhUTUwgPSB0b1N0cmluZyhpdGVtLCB0aGlzLl9vcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyX3Byb3ZpZGVyKHN0YXRlUHJvdmlkZXIsIHNlbGVjdG9yLCBvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgZWxlbXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICByZXR1cm4gbmV3IFN0YXRlUHJvdmlkZXJWaWV3ZXIoc3RhdGVQcm92aWRlciwgZWxlbXMsIG9wdGlvbnMpO1xufVxuIiwiLy8gY2xhc3Nlc1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4vbmVhcmJ5X2Jhc2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4vbGF5ZXJfYmFzZS5qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4vY3Vyc29yX2Jhc2UuanNcIjtcblxuLy8gc3RhdGVQcm92aWRlcnNcbmltcG9ydCB7IFxuICAgIExPQ0FMX0NMT0NLX1BST1ZJREVSXG59IGZyb20gXCIuL3Byb3ZpZGVyX2Nsb2NrLmpzXCI7XG5pbXBvcnQgeyBDb2xsZWN0aW9uUHJvdmlkZXIgfSBmcm9tIFwiLi9wcm92aWRlcl9jb2xsZWN0aW9uLmpzXCI7XG5pbXBvcnQgeyBWYXJpYWJsZVByb3ZpZGVyIH0gZnJvbSBcIi4vcHJvdmlkZXJfdmFyaWFibGUuanNcIjtcblxuLy8gZmFjdG9yeSBmdW5jdGlvbnNcbmltcG9ydCB7IGl0ZW1zX2xheWVyIH0gZnJvbSBcIi4vbGF5ZXJfaXRlbXMuanNcIjtcbmltcG9ydCB7IGNsb2NrX2N1cnNvciB9IGZyb20gXCIuL2N1cnNvcl9jbG9jay5qc1wiXG5pbXBvcnQgeyB2YXJpYWJsZV9jdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3JfdmFyaWFibGUuanNcIjtcbmltcG9ydCB7IHBsYXliYWNrX2N1cnNvciB9IGZyb20gXCIuL2N1cnNvcl9wbGF5YmFjay5qc1wiO1xuaW1wb3J0IHsgbGF5ZXJfZnJvbV9jdXJzb3IgfSBmcm9tIFwiLi9vcHMvbGF5ZXJfZnJvbV9jdXJzb3IuanNcIjtcbmltcG9ydCB7IG1lcmdlX2xheWVyIH0gZnJvbSBcIi4vb3BzL21lcmdlLmpzXCI7XG5pbXBvcnQgeyBib29sZWFuX2xheWVyIH0gZnJvbSBcIi4vb3BzL2Jvb2xlYW4uanNcIlxuaW1wb3J0IHsgbG9naWNhbF9tZXJnZV9sYXllciwgbG9naWNhbF9leHByfSBmcm9tIFwiLi9vcHMvbG9naWNhbF9tZXJnZS5qc1wiO1xuaW1wb3J0IHsgdGltZWxpbmVfdHJhbnNmb3JtIH0gZnJvbSBcIi4vb3BzL3RpbWVsaW5lX3RyYW5zZm9ybS5qc1wiO1xuaW1wb3J0IHsgY3Vyc29yX3RyYW5zZm9ybSwgbGF5ZXJfdHJhbnNmb3JtIH0gZnJvbSBcIi4vb3BzL3RyYW5zZm9ybS5qc1wiO1xuaW1wb3J0IHsgbGF5ZXJfcmVjb3JkZXIgfSBmcm9tIFwiLi9vcHMvcmVjb3JkZXIuanNcIjtcblxuXG4vLyB1dGlsXG5pbXBvcnQgeyBsb2NhbF9jbG9jaywgcmVuZGVyX2N1cnNvciB9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5pbXBvcnQgeyByZW5kZXJfcHJvdmlkZXIgfSBmcm9tIFwiLi91dGlsL3Byb3ZpZGVyX3ZpZXdlci5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUiBGQUNUT1JJRVNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gbGF5ZXIob3B0aW9ucz17fSkge1xuICAgIGxldCB7c3JjLCBpbnNlcnQsIHZhbHVlLCAuLi5vcHRzfSA9IG9wdGlvbnM7XG4gICAgaWYgKHNyYyBpbnN0YW5jZW9mIExheWVyKSB7XG4gICAgICAgIHJldHVybiBzcmM7XG4gICAgfVxuICAgIGlmIChzcmMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNyYyA9IG5ldyBWYXJpYWJsZVByb3ZpZGVyKHt2YWx1ZX0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3JjID0gbmV3IENvbGxlY3Rpb25Qcm92aWRlcih7aW5zZXJ0fSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGl0ZW1zX2xheWVyKHtzcmMsIC4uLm9wdHN9KTsgXG59XG5cbmZ1bmN0aW9uIHJlY29yZGVyIChvcHRpb25zPXt9KSB7XG4gICAgbGV0IHtjdHJsPUxPQ0FMX0NMT0NLX1BST1ZJREVSLCBzcmMsIGRzdH0gPSBvcHRpb25zO1xuICAgIHJldHVybiBsYXllcl9yZWNvcmRlcihjdHJsLCBzcmMsIGRzdCk7XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBDVVJTT1IgRkFDVE9SSUVTXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmZ1bmN0aW9uIGNsb2NrIChzcmMpIHtcbiAgICByZXR1cm4gY2xvY2tfY3Vyc29yKHNyYyk7XG59XG5cbmZ1bmN0aW9uIHZhcmlhYmxlKG9wdGlvbnM9e30pIHtcbiAgICBsZXQge2Nsb2NrLCAuLi5vcHRzfSA9IG9wdGlvbnM7XG4gICAgY29uc3Qgc3JjID0gbGF5ZXIob3B0cyk7XG4gICAgcmV0dXJuIHZhcmlhYmxlX2N1cnNvcihjbG9jaywgc3JjKTtcbn1cblxuZnVuY3Rpb24gcGxheWJhY2sob3B0aW9ucz17fSkge1xuICAgIGxldCB7Y3RybCwgLi4ub3B0c30gPSBvcHRpb25zO1xuICAgIGNvbnN0IHNyYyA9IGxheWVyKG9wdHMpO1xuICAgIHJldHVybiBwbGF5YmFja19jdXJzb3IoY3RybCwgc3JjKTtcbn1cblxuZnVuY3Rpb24gc2tldyAoc3JjLCBvZmZzZXQpIHtcbiAgICBmdW5jdGlvbiB2YWx1ZUZ1bmModmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlICsgb2Zmc2V0O1xuICAgIH0gXG4gICAgcmV0dXJuIGN1cnNvcl90cmFuc2Zvcm0oc3JjLCB7dmFsdWVGdW5jfSk7XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEVYUE9SVFNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IHtcbiAgICBDb2xsZWN0aW9uUHJvdmlkZXIsIFZhcmlhYmxlUHJvdmlkZXIsXG4gICAgTGF5ZXIsIEN1cnNvciwgTmVhcmJ5SW5kZXhCYXNlLFxuICAgIGxheWVyLCBcbiAgICBtZXJnZV9sYXllciBhcyBtZXJnZSwgXG4gICAgYm9vbGVhbl9sYXllciBhcyBib29sZWFuLFxuICAgIGxvZ2ljYWxfbWVyZ2VfbGF5ZXIgYXMgbG9naWNhbF9tZXJnZSwgXG4gICAgbG9naWNhbF9leHByLFxuICAgIGNsb2NrLFxuICAgIHZhcmlhYmxlLFxuICAgIHBsYXliYWNrLFxuICAgIGxheWVyX2Zyb21fY3Vyc29yLFxuICAgIGxheWVyX3RyYW5zZm9ybSxcbiAgICBjdXJzb3JfdHJhbnNmb3JtLFxuICAgIHRpbWVsaW5lX3RyYW5zZm9ybSxcbiAgICByZWNvcmRlcixcbiAgICBza2V3LFxuICAgIHJlbmRlcl9wcm92aWRlcixcbiAgICByZW5kZXJfY3Vyc29yLFxuICAgIGxvY2FsX2Nsb2NrXG59Il0sIm5hbWVzIjpbImNtcF9hc2NlbmRpbmciLCJjbXBfZGVzY2VuZGluZyIsIlBSRUZJWCIsImFkZFN0YXRlIiwiYWRkTWV0aG9kcyIsInRvU3RhdGUiLCJjYWxsYmFjay5hZGRTdGF0ZSIsImV2ZW50aWZ5LmFkZFN0YXRlIiwiY2FsbGJhY2suYWRkTWV0aG9kcyIsImV2ZW50aWZ5LmFkZE1ldGhvZHMiLCJjYWxsYmFjay5pc19jYWxsYmFja19hcGkiLCJzcmNwcm9wLmFkZFN0YXRlIiwic3JjcHJvcC5hZGRNZXRob2RzIl0sIm1hcHBpbmdzIjoiOzs7SUFBQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxTQUFTLFFBQVEsQ0FBQyxDQUFDLEVBQUU7SUFDckIsSUFBSSxPQUFPLE9BQU8sQ0FBQyxJQUFJLFFBQVE7SUFDL0I7O0lBRUEsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUM5QixJQUFJLFNBQVMsRUFBRSxHQUFHO0lBQ2xCLElBQUksV0FBVyxFQUFFLEdBQUc7SUFDcEIsSUFBSSxLQUFLLEVBQUUsRUFBRTtJQUNiLElBQUksVUFBVSxFQUFFLEdBQUc7SUFDbkIsSUFBSSxRQUFRLEVBQUU7SUFDZCxDQUFDLENBQUM7O0lBRUYsU0FBUyxVQUFVLENBQUMsS0FBSyxFQUFFO0lBQzNCLElBQUksT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7SUFDakQ7O0lBRUEsTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDM0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQzVCLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUN0QixJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDM0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUN4QixDQUFDLENBQUM7O0lBRUYsU0FBUyxlQUFlLENBQUMsRUFBRSxFQUFFO0lBQzdCLElBQUksT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVE7SUFDbkU7O0lBRUEsU0FBUyxnQkFBZ0IsQ0FBQyxFQUFFLEVBQUU7SUFDOUIsSUFBSSxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsV0FBVyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsU0FBUztJQUNyRTs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxTQUFTLG1CQUFtQixDQUFDLEVBQUUsRUFBRTtJQUNqQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFO0lBQzVCLFFBQVEsRUFBRSxHQUFHLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDaEM7SUFDQSxJQUFJLElBQUksRUFBRSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDeEIsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLG1DQUFtQyxFQUFFLEVBQUUsQ0FBQztJQUNoRTtJQUNBLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFO0lBQ2xCLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRTtJQUN4QixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsMkJBQTJCLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZEO0lBQ0EsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRTtJQUN4QixRQUFRLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLFVBQVUsQ0FBQztJQUN6QztJQUNBLElBQUksSUFBSSxDQUFDLElBQUksUUFBUSxFQUFFO0lBQ3ZCLFFBQVEsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFDO0lBQzFDO0lBQ0EsSUFBSSxJQUFJLENBQUMsSUFBSSxTQUFTLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUU7SUFDcEQsUUFBUSxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNyQjtJQUNBLElBQUksTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsRUFBRSxDQUFDLENBQUM7SUFDekQ7O0lBRUEsTUFBTSxnQkFBZ0IsR0FBRyxtQkFBbUIsQ0FBQyxRQUFRLENBQUM7SUFDdEQsTUFBTSxnQkFBZ0IsR0FBRyxtQkFBbUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQzs7SUFFdkQ7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLFNBQVMsaUJBQWlCLENBQUMsRUFBRSxFQUFFO0lBQy9CLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxFQUFFO0lBQ3ZCLFFBQVEsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0I7SUFDQSxJQUFJLElBQUksZUFBZSxDQUFDLEVBQUUsQ0FBQyxFQUFFO0lBQzdCLFFBQVEsT0FBTyxDQUFDLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUM7SUFDOUMsS0FBSyxNQUFNO0lBQ1gsUUFBUSxPQUFPLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUM7SUFDOUM7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLFNBQVMsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7SUFDMUIsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUN6QixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN4QixJQUFJLE9BQU8sQ0FBQyxDQUFDO0lBQ2I7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxTQUFTLFlBQVksQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFO0lBQ2hDLElBQUksTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLENBQUM7SUFDM0MsSUFBSSxNQUFNLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLGlCQUFpQixDQUFDLEdBQUcsQ0FBQztJQUMzQyxJQUFJLE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDO0lBQ25DLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxFQUFFO0lBQ25CLFFBQVEsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7SUFDbkMsUUFBUSxNQUFNLEVBQUUsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztJQUNuQyxRQUFRLE9BQU8sVUFBVSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUM7SUFDakM7SUFDQSxJQUFJLE9BQU8sSUFBSTtJQUNmOztJQUVBLFNBQVMsV0FBVyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDOUIsSUFBSSxPQUFPLFlBQVksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUc7SUFDbEM7SUFDQSxTQUFTLFdBQVcsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQzlCLElBQUksT0FBTyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJO0lBQ25DO0lBQ0EsU0FBUyxXQUFXLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUM5QixJQUFJLE9BQU8sWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRztJQUNsQztJQUNBLFNBQVMsV0FBVyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDOUIsSUFBSSxPQUFPLFlBQVksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUk7SUFDbkM7SUFDQSxTQUFTLFdBQVcsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQzlCLElBQUksT0FBTyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJO0lBQ25DO0lBQ0EsU0FBUyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUM5QixJQUFJLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO0lBQzFDO0lBQ0EsU0FBUyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUM5QixJQUFJLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO0lBQzFDOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxTQUFTLGFBQWEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFO0lBQ25DLElBQUksSUFBSSxNQUFNLEVBQUU7SUFDaEIsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixDQUFDO0lBQy9DO0lBQ0EsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUU7SUFDbEIsSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLEVBQUU7SUFDbkIsUUFBUSxPQUFPLEVBQUU7SUFDakI7SUFDQSxJQUFJLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxTQUFTLEVBQUU7SUFDaEMsUUFBUSxPQUFPLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUM7SUFDdEMsS0FBSyxNQUFNLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxXQUFXLEVBQUU7SUFDekMsUUFBUSxPQUFPLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxRQUFRLENBQUM7SUFDcEMsS0FBSyxNQUFNLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUU7SUFDdEMsUUFBUSxPQUFPLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxXQUFXLENBQUM7SUFDdkMsS0FBSyxNQUFNLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxVQUFVLEVBQUU7SUFDeEMsUUFBUSxPQUFPLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxTQUFTLENBQUM7SUFDckMsS0FBSyxNQUFNO0lBQ1gsS0FBSyxNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixFQUFFLENBQUMsQ0FBQztJQUNoRDtJQUVBOztJQUVBO0lBQ0E7SUFDQTtJQUNBLFNBQVMsdUJBQXVCLENBQUMsR0FBRyxFQUFFO0lBQ3RDLElBQUksTUFBTSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxHQUFHLEdBQUc7SUFDbEQsSUFBSSxNQUFNLE9BQU8sR0FBRyxDQUFDLFNBQVMsS0FBSyxPQUFPLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxRQUFRO0lBQ3hFLElBQUksTUFBTSxRQUFRLEdBQUcsQ0FBQyxVQUFVLEtBQUssT0FBTyxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsU0FBUztJQUM1RSxJQUFJLE1BQU0sS0FBSyxHQUFHLG1CQUFtQixDQUFDLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3JELElBQUksTUFBTSxNQUFNLEdBQUcsbUJBQW1CLENBQUMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDeEQsSUFBSSxPQUFPLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztJQUMxQjs7O0lBR0E7SUFDQTs7SUFFQTs7SUFFQTs7O0lBR0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxTQUFTLHdCQUF3QixDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUU7SUFDM0MsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLHVCQUF1QixDQUFDLEdBQUcsQ0FBQztJQUMxRCxJQUFJLEVBQUUsR0FBRyxtQkFBbUIsQ0FBQyxFQUFFLENBQUM7SUFDaEM7SUFDQSxJQUFJLE9BQU8sV0FBVyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsSUFBSSxXQUFXLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQztJQUM5RDtJQUNBO0lBQ0EsU0FBUyxxQkFBcUIsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFO0lBQ3ZDLElBQUksT0FBTyx3QkFBd0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQzNDOztJQUVBO0lBQ0E7SUFDQTtJQUNBLFNBQVMsb0JBQW9CLENBQUMsUUFBUSxFQUFFO0lBQ3hDLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyx1QkFBdUIsQ0FBQyxHQUFHLENBQUM7SUFDMUQsSUFBSSxPQUFPLFdBQVcsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDO0lBQ3ZDOztJQUVBO0lBQ0E7SUFDQTtJQUNBLFNBQVMsdUJBQXVCLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRTtJQUMzQyxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRztJQUN0QixJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRztJQUN0QixJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLEVBQUU7SUFDL0IsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixFQUFFLEdBQUcsQ0FBQztJQUNwRDtJQUNBLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxFQUFFO0lBQ2hDLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLENBQUM7SUFDckQ7SUFDQSxJQUFJLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxPQUFPLENBQUMsVUFBVSxFQUFFLEVBQUUsSUFBSSxPQUFPLENBQUMsV0FBVyxDQUFDO0lBQ3hFOzs7SUFHQSxTQUFTLG1CQUFtQixDQUFDLEtBQUssQ0FBQztJQUNuQyxJQUFJLElBQUksR0FBRyxHQUFHLEtBQUs7SUFDbkIsSUFBSSxJQUFJLEdBQUcsSUFBSSxTQUFTLElBQUksR0FBRyxJQUFJLElBQUksRUFBRTtJQUN6QyxRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQW9CLENBQUM7SUFDN0M7SUFDQSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0lBQzdCLFFBQVEsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7SUFDM0I7SUFDQSxZQUFZLEdBQUcsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztJQUN4QyxTQUFTLE1BQU07SUFDZixZQUFZLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLHlCQUF5QixDQUFDO0lBQ3RFO0lBQ0EsS0FDQTtJQUNBLElBQUksSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUN6QixRQUFRLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztJQUMxQyxLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUNoQyxRQUFRLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQztJQUMzQyxLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUNoQyxRQUFRLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQztJQUM3QyxLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtJQUMvQixRQUFRLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM5QztJQUNBLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFdBQVcsQ0FBQyxHQUFHLEdBQUc7SUFDbEQ7SUFDQSxJQUFJLElBQUksR0FBRyxJQUFJLFNBQVMsSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUU7SUFDOUMsUUFBUSxHQUFHLEdBQUcsSUFBSTtJQUNsQjtJQUNBLElBQUksSUFBSSxJQUFJLElBQUksU0FBUyxJQUFJLElBQUksSUFBSSxRQUFRLEVBQUU7SUFDL0MsUUFBUSxJQUFJLEdBQUcsSUFBSTtJQUNuQjtJQUNBO0lBQ0EsSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUU7SUFDckIsUUFBUSxVQUFVLEdBQUcsSUFBSTtJQUN6QixLQUFLLE1BQU07SUFDWCxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxHQUFHLENBQUM7SUFDcEU7SUFDQTtJQUNBLElBQUksSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO0lBQ3RCLFFBQVEsV0FBVyxHQUFHLElBQUk7SUFDMUIsS0FBSyxNQUFNO0lBQ1gsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDO0lBQ3ZFLEtBQUs7SUFDTDtJQUNBLElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxJQUFJLElBQUksSUFBSSxJQUFJLEVBQUU7SUFDckMsUUFBUSxJQUFJLEdBQUcsR0FBRyxJQUFJLEVBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQztJQUNoRTtJQUNBLFFBQVEsSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFO0lBQ3pCLFlBQVksVUFBVSxHQUFHLElBQUk7SUFDN0IsWUFBWSxXQUFXLEdBQUcsSUFBSTtJQUM5QjtJQUNBO0lBQ0E7SUFDQSxJQUFJLElBQUksT0FBTyxVQUFVLEtBQUssU0FBUyxFQUFFO0lBQ3pDLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQztJQUNqRCxLQUFLO0lBQ0wsSUFBSSxJQUFJLE9BQU8sV0FBVyxLQUFLLFNBQVMsRUFBRTtJQUMxQyxRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUM7SUFDbEQ7SUFDQSxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUM7SUFDL0M7O0lBRU8sTUFBTSxRQUFRLEdBQUc7SUFDeEIsSUFBSSxFQUFFLEVBQUUsV0FBVztJQUNuQixJQUFJLEVBQUUsRUFBRSxXQUFXO0lBQ25CLElBQUksRUFBRSxFQUFFLFdBQVc7SUFDbkIsSUFBSSxFQUFFLEVBQUUsV0FBVztJQUNuQixJQUFJLEdBQUcsRUFBRSxZQUFZO0lBQ3JCLElBQUksRUFBRSxFQUFFLFdBQVc7SUFDbkIsSUFBSSxHQUFHLEVBQUUsWUFBWTtJQUNyQixJQUFJLEdBQUcsRUFBRSxZQUFZO0lBQ3JCLElBQUksSUFBSSxFQUFFLGFBQWE7SUFDdkIsSUFBSSxhQUFhLEVBQUUsdUJBQXVCO0lBQzFDLElBQUksVUFBVSxFQUFFLG1CQUFtQjtJQUNuQyxJQUFJLEtBQUssRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDO0lBQ3ZCLElBQUksT0FBTyxHQUFHLGdCQUFnQjtJQUM5QixJQUFJLE9BQU8sR0FBRztJQUNkO0lBQ08sTUFBTSxRQUFRLEdBQUc7SUFDeEIsSUFBSSxlQUFlLEVBQUUsd0JBQXdCO0lBQzdDLElBQUksWUFBWSxFQUFFLHFCQUFxQjtJQUN2QyxJQUFJLFdBQVcsRUFBRSxvQkFBb0I7SUFDckMsSUFBSSxjQUFjLEVBQUUsdUJBQXVCO0lBQzNDLElBQUksVUFBVSxFQUFFO0lBQ2hCOztJQ3pWQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7O0lBR0E7SUFDQTtJQUNBO0lBQ0E7SUFDTyxTQUFTLGFBQWEsRUFBRSxNQUFNLEVBQUU7SUFDdkMsSUFBSSxNQUFNLEdBQUcsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckQsSUFBSSxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQzdCOztJQUVBO0lBQ0E7SUFDQTtJQUNBOztJQUVPLFNBQVMsY0FBYyxFQUFFLE1BQU0sRUFBRTtJQUN4QyxJQUFJLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0RCxJQUFJLE9BQU8sUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDOUI7Ozs7SUFJTyxNQUFNLGVBQWUsQ0FBQzs7O0lBRzdCO0lBQ0E7SUFDQTtJQUNBLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtJQUNuQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUM7SUFDMUM7O0lBRUEsSUFBSSxLQUFLLEdBQUc7SUFDWixRQUFRLE9BQU8sSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLFNBQVM7SUFDeEM7O0lBRUE7SUFDQTtJQUNBO0lBQ0EsSUFBSSxLQUFLLEdBQUc7SUFDWixRQUFRLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDO0lBQzNELFFBQVEsSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBRztJQUNoQyxZQUFZLE9BQU8sUUFBUSxDQUFDLE9BQU87SUFDbkM7SUFDQSxRQUFRLElBQUksUUFBUSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO0lBQ2xELFlBQVksT0FBTyxLQUFLO0lBQ3hCLFNBQVMsTUFBTTtJQUNmO0lBQ0EsWUFBWSxPQUFPLFNBQVM7SUFDNUI7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLElBQUksR0FBRztJQUNYLFFBQVEsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUM7SUFDMUQsUUFBUSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0lBQy9CLFlBQVksT0FBTyxRQUFRLENBQUMsT0FBTztJQUNuQztJQUNBLFFBQVEsSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7SUFDakQsWUFBWSxPQUFPLElBQUk7SUFDdkIsU0FBUyxNQUFNO0lBQ2Y7SUFDQSxZQUFZLE9BQU8sU0FBUztJQUM1QjtJQUNBOzs7SUFHQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsSUFBSSxZQUFZLENBQUMsTUFBTSxFQUFFO0lBQ3pCLFFBQVEsTUFBTSxLQUFLLEdBQUcsY0FBYyxDQUFDLE1BQU0sQ0FBQztJQUM1QyxRQUFRLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksRUFBRTtJQUM5QixZQUFZLE9BQU8sU0FBUztJQUM1QjtJQUNBLFFBQVEsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztJQUNqQzs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFO0lBQ3hCLFFBQVEsTUFBTSxJQUFJLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQztJQUMxQyxRQUFRLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksRUFBRTtJQUM3QixZQUFZLE9BQU8sU0FBUztJQUM1QjtJQUNBLFFBQVEsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2pDOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUNwQyxRQUFRLElBQUk7SUFDWixZQUFZLFNBQVMsR0FBRyxDQUFDO0lBQ3pCLFlBQVksU0FBUyxHQUFHLENBQUMsTUFBTSxLQUFLLE1BQU0sQ0FBQyxNQUFNLEdBQUc7SUFDcEQsU0FBUyxHQUFHLE9BQU87SUFDbkIsUUFBUSxJQUFJLFdBQVc7SUFDdkIsUUFBUSxNQUFNLElBQUksRUFBRTtJQUNwQixZQUFZLElBQUksU0FBUyxJQUFJLENBQUMsRUFBRTtJQUNoQyxnQkFBZ0IsV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDO0lBQ3ZELGFBQWEsTUFBTTtJQUNuQixnQkFBZ0IsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDO0lBQ3REO0lBQ0EsWUFBWSxJQUFJLFdBQVcsSUFBSSxTQUFTLEVBQUU7SUFDMUMsZ0JBQWdCLE9BQU8sU0FBUztJQUNoQztJQUNBLFlBQVksSUFBSSxTQUFTLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0lBQy9DO0lBQ0EsZ0JBQWdCLE9BQU8sV0FBVztJQUNsQztJQUNBO0lBQ0E7SUFDQSxZQUFZLE1BQU0sR0FBRyxXQUFXO0lBQ2hDO0lBQ0E7O0lBRUEsSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFO0lBQ3JCLFFBQVEsT0FBTyxJQUFJLGNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDO0lBQ2hEOztJQUVBOzs7SUFHQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLE1BQU0sY0FBYyxDQUFDOztJQUVyQixJQUFJLFdBQVcsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUNuQyxRQUFRLElBQUk7SUFDWixZQUFZLEtBQUssQ0FBQyxDQUFDLFFBQVE7SUFDM0IsWUFBWSxJQUFJLENBQUMsUUFBUTtJQUN6QixZQUFZLFlBQVksQ0FBQztJQUN6QixTQUFTLEdBQUcsT0FBTztJQUNuQixRQUFRLElBQUksS0FBSyxHQUFHLElBQUksRUFBRTtJQUMxQixZQUFZLE1BQU0sSUFBSSxLQUFLLEVBQUUsZ0NBQWdDLEVBQUUsS0FBSyxFQUFFLElBQUk7SUFDMUU7SUFDQSxRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztJQUMzQixRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUM7SUFDaEQsUUFBUSxJQUFJLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDOztJQUU5QyxRQUFRLElBQUksWUFBWSxFQUFFO0lBQzFCLFlBQVksSUFBSSxDQUFDLFVBQVUsR0FBRyxNQUFNLElBQUk7SUFDeEMsU0FBUyxNQUFNO0lBQ2YsWUFBWSxJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsTUFBTSxLQUFLLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQztJQUMzRDtJQUNBLFFBQVEsSUFBSSxDQUFDLFFBQVE7SUFDckI7O0lBRUEsSUFBSSxJQUFJLEdBQUc7SUFDWCxRQUFRLElBQUksSUFBSSxDQUFDLFFBQVEsSUFBSSxTQUFTLEVBQUU7SUFDeEM7SUFDQSxZQUFZLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUMzRCxZQUFZLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO0lBQ3ZELGdCQUFnQixPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUN4RDtJQUNBO0lBQ0EsUUFBUSxJQUFJLE9BQU8sR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQzdELFFBQVEsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQztJQUN2RSxRQUFRLElBQUksSUFBSSxDQUFDLFFBQVEsSUFBSSxTQUFTLEVBQUU7SUFDeEMsWUFBWSxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQy9DLFNBQVMsTUFBTTtJQUNmLFlBQVksT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFLO0lBQ25EO0lBQ0E7O0lBRUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRztJQUN4QixRQUFRLE9BQU8sSUFBSTtJQUNuQjtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLFNBQVNBLGVBQWEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQy9CLElBQUksT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFO0lBQzlCOztJQUVBLFNBQVNDLGdCQUFjLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUNoQyxJQUFJLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRTtJQUM5Qjs7SUFFTyxTQUFTLFdBQVc7SUFDM0IsSUFBSSxTQUFTO0lBQ2IsSUFBSSxlQUFlO0lBQ25CLElBQUksTUFBTTtJQUNWLElBQUksZ0JBQWdCO0lBQ3BCLElBQUksUUFBUSxFQUFFOztJQUVkO0lBQ0EsSUFBSSxNQUFNLE1BQU0sR0FBRyxDQUFDLE1BQU0sQ0FBQzs7SUFFM0IsSUFBSSxJQUFJLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO0lBQzVCO0lBQ0EsUUFBUSxNQUFNLENBQUMsS0FBSyxHQUFHLFFBQVE7SUFDL0IsUUFBUSxNQUFNLENBQUMsSUFBSSxHQUFHLFNBQVM7SUFDL0IsS0FBSyxNQUFNO0lBQ1g7SUFDQTtJQUNBO0lBQ0EsUUFBUSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUNELGVBQWEsQ0FBQztJQUM1QyxRQUFRLElBQUksZUFBZSxHQUFHLGdCQUFnQixDQUFDLENBQUMsQ0FBQztJQUNqRCxRQUFRLElBQUksZUFBZSxHQUFHLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMzRCxRQUFRLElBQUksb0JBQW9CLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLGVBQWUsRUFBRSxlQUFlOztJQUVoRjtJQUNBLFFBQVEsZUFBZSxDQUFDLElBQUksQ0FBQ0MsZ0JBQWMsQ0FBQztJQUM1QyxRQUFRLElBQUksY0FBYyxHQUFHLGVBQWUsQ0FBQyxDQUFDLENBQUM7SUFDL0MsUUFBUSxJQUFJLGNBQWMsR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3pELFFBQVEsSUFBSSxtQkFBbUIsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsY0FBYyxFQUFFLGNBQWM7O0lBRTdFO0lBQ0EsUUFBUSxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLGVBQWUsQ0FBQyxFQUFFO0lBQ3BELFlBQVksTUFBTSxDQUFDLEtBQUssR0FBRyxRQUFRO0lBQ25DLFNBQVMsTUFBTTtJQUNmLFlBQVksTUFBTSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLGVBQWU7SUFDeEQ7SUFDQSxRQUFRLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxvQkFBb0IsSUFBSSxNQUFNLENBQUMsS0FBSyxHQUFHLFFBQVE7O0lBRXRFO0lBQ0EsUUFBUSxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLGNBQWMsQ0FBQyxFQUFFO0lBQ3BELFlBQVksTUFBTSxDQUFDLElBQUksR0FBRyxTQUFTO0lBQ25DLFNBQVMsTUFBTTtJQUNmLFlBQVksTUFBTSxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQztJQUN2RDtJQUNBLFFBQVEsTUFBTSxDQUFDLElBQUksR0FBRyxDQUFDLG1CQUFtQixJQUFJLE1BQU0sQ0FBQyxJQUFJLEdBQUcsU0FBUzs7SUFFckU7O0lBRUE7SUFDQSxJQUFJLElBQUksR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztJQUN4QyxJQUFJLElBQUksSUFBSSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztJQUMxQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDOztJQUVuRCxJQUFJLE9BQU8sTUFBTTtJQUNqQjs7O0lBR0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFTyxNQUFNLGNBQWMsU0FBUyxlQUFlLENBQUM7O0lBRXBELElBQUksV0FBVyxDQUFDLEdBQUcsRUFBRTtJQUNyQixRQUFRLEtBQUssRUFBRTtJQUNmLFFBQVEsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHO0lBQ3ZCLFFBQVEsSUFBSSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUMsV0FBVyxFQUFFO0lBQ3ZDOztJQUVBLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtJQUNuQixRQUFRLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDckQsUUFBUSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNyQyxRQUFRLE9BQU8sTUFBTTtJQUNyQjtJQUNBOztJQ3JXQTtJQUNBO0lBQ0E7O0lBRUE7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOzs7O0lBSUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBOztJQUVBLE1BQU0sS0FBSyxDQUFDOztJQUVaLENBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUU7SUFDeEMsRUFBRSxPQUFPLEdBQUcsT0FBTyxJQUFJO0lBQ3ZCLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTO0lBQzVCLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJO0lBQ2xCLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssU0FBUyxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsSUFBSTtJQUNqRSxFQUFFLElBQUksQ0FBQyxhQUFhLEdBQUcsRUFBRTtJQUN6Qjs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLENBQUMsU0FBUyxDQUFDLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRTtJQUMvQixFQUFFLElBQUksQ0FBQyxRQUFRLElBQUksT0FBTyxRQUFRLEtBQUssVUFBVSxFQUFFO0lBQ25ELEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsRUFBRSxRQUFRLENBQUM7SUFDdkQ7SUFDQSxFQUFFLE1BQU0sR0FBRyxHQUFHLElBQUksWUFBWSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDO0lBQ3ZELEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQzlCO0lBQ0EsS0FBSyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLElBQUksRUFBRTtJQUNoQyxNQUFNLEdBQUcsQ0FBQyxZQUFZLEdBQUcsSUFBSTtJQUM3QixNQUFNLElBQUksSUFBSSxHQUFHLElBQUk7SUFDckIsTUFBTSxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVk7SUFDekMsT0FBTyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO0lBQzFFLE9BQU8sR0FBRyxDQUFDLFlBQVksR0FBRyxLQUFLO0lBQy9CLE9BQU8sS0FBSyxJQUFJLElBQUksSUFBSSxLQUFLLEVBQUU7SUFDL0IsUUFBUSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQztJQUN2QztJQUNBLE9BQU8sQ0FBQztJQUNSO0lBQ0EsRUFBRSxPQUFPO0lBQ1Q7O0lBRUE7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFO0lBQzVCLEVBQUUsSUFBSSxLQUFLLEVBQUUsR0FBRztJQUNoQixFQUFFLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFO0lBQzFCO0lBQ0EsR0FBRyxJQUFJLEdBQUcsQ0FBQyxVQUFVLEVBQUU7SUFDdkIsSUFBSTtJQUNKO0lBQ0EsR0FBRyxLQUFLLEdBQUc7SUFDWCxJQUFJLEdBQUcsRUFBRSxJQUFJLENBQUMsU0FBUztJQUN2QixJQUFJLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtJQUNuQixJQUFJLEdBQUcsRUFBRSxHQUFHO0lBQ1osSUFBSSxJQUFJLEVBQUU7SUFDVjtJQUNBLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLFNBQVM7SUFDbEMsR0FBRyxJQUFJO0lBQ1AsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQztJQUN2QyxJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUU7SUFDakIsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDaEU7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFO0lBQ2xCLEVBQUUsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDO0lBQzNDLEVBQUUsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUU7SUFDaEIsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3BDLEdBQUcsR0FBRyxDQUFDLFNBQVMsRUFBRTtJQUNsQjtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTs7SUFFQSxNQUFNLFlBQVksQ0FBQzs7SUFFbkIsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7SUFDdkMsRUFBRSxPQUFPLEdBQUcsT0FBTyxJQUFJO0lBQ3ZCLEVBQUUsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLO0lBQ3BCLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSTtJQUN4QixFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUc7SUFDbEIsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUk7SUFDM0UsRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUs7SUFDM0IsRUFBRSxJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUs7SUFDekIsRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHO0lBQ3hCOztJQUVBLENBQUMsU0FBUyxHQUFHO0lBQ2IsRUFBRSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUk7SUFDeEIsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLFNBQVM7SUFDM0IsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7SUFDOUI7SUFDQTs7O0lBR0E7O0lBRUE7O0lBRUE7O0lBRUE7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBOztJQUVPLFNBQVMsZ0JBQWdCLEVBQUUsTUFBTSxFQUFFO0lBQzFDLENBQUMsTUFBTSxDQUFDLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUFFO0lBQ3ZDLENBQUMsTUFBTSxDQUFDLGlCQUFpQixHQUFHLEVBQUU7SUFDOUIsQ0FBQyxPQUFPLE1BQU07SUFDZDs7SUFHQTtJQUNBOztJQUVBO0lBQ0E7O0lBRU8sU0FBUyxpQkFBaUIsQ0FBQyxVQUFVLEVBQUU7O0lBRTlDLENBQUMsU0FBUyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFO0lBQ3pDLEVBQUUsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7SUFDcEQsRUFBRSxJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUU7SUFDMUIsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQztJQUMzQztJQUNBLEVBQUUsT0FBTyxLQUFLO0lBQ2Q7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxTQUFTLGNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFO0lBQ3hDO0lBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7SUFDMUMsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixFQUFFLElBQUksQ0FBQztJQUNqRDtJQUNBLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNwRTtJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxDQUFDLFNBQVMsRUFBRSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO0lBQ3RDLEVBQUUsT0FBTyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUM7SUFDbEU7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxHQUFHLEVBQUU7SUFDbkIsRUFBRSxPQUFPLGdCQUFnQixDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQztJQUMxRDs7SUFHQSxDQUFDLFNBQVMscUJBQXFCLENBQUMsSUFBSSxFQUFFO0lBQ3RDLEVBQUUsT0FBTyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsYUFBYTtJQUNuRDs7OztJQUlBO0lBQ0E7O0lBRUE7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQSxDQUFDLFNBQVMsa0JBQWtCLENBQUMsVUFBVSxFQUFFO0lBQ3pDLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUM5QixHQUFHO0lBQ0g7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLEVBQUUsSUFBSSxZQUFZLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSztJQUM5QyxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsSUFBSTtJQUMxQixHQUFHLElBQUksRUFBRSxHQUFHLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUM7SUFDeEMsR0FBRyxJQUFJLElBQUksR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksSUFBSSxLQUFLLENBQUM7SUFDdkUsR0FBRyxPQUFPLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7SUFDMUIsR0FBRyxFQUFFLElBQUksQ0FBQzs7SUFFVjtJQUNBLEVBQUUsTUFBTSxHQUFHLEdBQUcsWUFBWSxDQUFDLE1BQU07SUFDakMsRUFBRSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsaUJBQWlCO0lBQ3BDLEVBQUUsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU07SUFDL0M7SUFDQSxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsT0FBTyxHQUFHLEdBQUc7SUFDL0M7SUFDQSxFQUFFLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUU7SUFDNUIsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDbkM7SUFDQTtJQUNBLEVBQUUsSUFBSSxPQUFPLElBQUksQ0FBQyxFQUFFO0lBQ3BCLEdBQUcsSUFBSSxJQUFJLEdBQUcsSUFBSTtJQUNsQixHQUFHLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVztJQUNyQyxJQUFJLEtBQUssSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFO0lBQ3pEO0lBQ0EsS0FBSyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDO0lBQ2xDO0lBQ0EsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsRUFBRTtJQUMvQixJQUFJLENBQUM7SUFDTDtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBLENBQUMsU0FBUyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO0lBQzVDLEVBQUUsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUk7SUFDbkQsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQztJQUN0QixHQUFHLENBQUMsQ0FBQztJQUNMOztJQUVBO0lBQ0E7SUFDQTtJQUNBLENBQUMsU0FBUyxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRTtJQUN0QyxFQUFFLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNoRDs7SUFFQSxDQUFDLFVBQVUsQ0FBQyxjQUFjLEdBQUcsY0FBYztJQUMzQyxDQUFDLFVBQVUsQ0FBQyxlQUFlLEdBQUcsZUFBZTtJQUM3QyxDQUFDLFVBQVUsQ0FBQyxvQkFBb0IsR0FBRyxvQkFBb0I7SUFDdkQsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLEdBQUcsa0JBQWtCO0lBQ25ELENBQUMsVUFBVSxDQUFDLHFCQUFxQixHQUFHLHFCQUFxQjtJQUN6RCxDQUFDLFVBQVUsQ0FBQyxFQUFFLEdBQUcsRUFBRTtJQUNuQixDQUFDLFVBQVUsQ0FBQyxHQUFHLEdBQUcsR0FBRztJQUNyQjtJQU1BO0lBQ0E7O0lBRUE7SUFDQTs7SUFFTyxNQUFNLGFBQWEsQ0FBQzs7SUFFM0IsQ0FBQyxXQUFXLENBQUMsQ0FBQyxLQUFLLEVBQUU7SUFDckIsRUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUM7SUFDeEIsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUs7SUFDckIsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM1Qzs7SUFFQSxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRTtJQUM3QixFQUFFLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtJQUN4QixHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3ZCO0lBQ0E7O0lBRUEsQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ2xDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUU7SUFDbkIsRUFBRSxJQUFJLEtBQUssSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0lBQzVCLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLO0lBQ3RCLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDO0lBQ3hDO0lBQ0E7SUFDQTtJQUNBLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUM7O0lDalUxQztJQUNBO0lBQ0E7O0lBRUEsTUFBTUMsUUFBTSxHQUFHLFlBQVk7O0lBRXBCLFNBQVNDLFVBQVEsQ0FBQyxNQUFNLEVBQUU7SUFDakMsSUFBSSxNQUFNLENBQUMsQ0FBQyxFQUFFRCxRQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxFQUFFO0lBQ3JDOztJQUVBLFNBQVMsWUFBWSxFQUFFLE9BQU8sRUFBRTtJQUNoQyxJQUFJLElBQUksTUFBTSxHQUFHO0lBQ2pCLFFBQVEsT0FBTyxFQUFFO0lBQ2pCO0lBQ0EsSUFBSSxJQUFJLENBQUMsQ0FBQyxFQUFFQSxRQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQzNDLElBQUksT0FBTyxNQUFNO0lBQ2pCO0lBRUEsU0FBUyxlQUFlLEVBQUUsTUFBTSxFQUFFO0lBQ2xDLElBQUksSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsRUFBRUEsUUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztJQUMxRCxJQUFJLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFO0lBQ3BCLFFBQVEsSUFBSSxDQUFDLENBQUMsRUFBRUEsUUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDbkQ7SUFDQTtJQUVBLFNBQVMsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFO0lBQ2pDLElBQUksSUFBSSxDQUFDLENBQUMsRUFBRUEsUUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsTUFBTSxFQUFFO0lBQ3hELFFBQVEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDNUIsS0FBSyxDQUFDO0lBQ047O0lBR08sU0FBU0UsWUFBVSxFQUFFLEdBQUcsRUFBRTtJQUNqQyxJQUFJLE1BQU0sR0FBRyxHQUFHO0lBQ2hCLFFBQVEsWUFBWSxFQUFFLGVBQWUsRUFBRTtJQUN2QztJQUNBLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDO0lBQzNCOztJQUVBO0lBQ0E7SUFDQTtJQUNPLFNBQVMsZUFBZSxFQUFFLEdBQUcsRUFBRTtJQUN0QyxJQUFJLElBQUksR0FBRyxJQUFJLFNBQVMsRUFBRSxPQUFPLEtBQUs7SUFDdEMsSUFBSSxNQUFNLE9BQU8sR0FBRyxDQUFDLGNBQWMsRUFBRSxpQkFBaUIsQ0FBQztJQUN2RCxJQUFJLEtBQUssTUFBTSxJQUFJLElBQUksT0FBTyxFQUFFO0lBQ2hDLFFBQVEsSUFBSSxFQUFFLElBQUksSUFBSSxHQUFHLENBQUMsRUFBRSxPQUFPLEtBQUs7SUFDeEMsUUFBUSxJQUFJLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsRUFBRSxPQUFPLEtBQUs7SUFDeEQ7SUFDQSxJQUFJLE9BQU8sSUFBSTtJQUNmOztJQ3BDTyxTQUFTLGdCQUFnQixDQUFDLEdBQUcsRUFBRTtJQUN0QyxJQUFJLE9BQU8sQ0FBQyxPQUFPLEdBQUcsSUFBSSxRQUFRLEtBQUssUUFBUSxDQUFDLEdBQUcsQ0FBQztJQUNwRDs7SUFFTyxTQUFTLFlBQVksQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO0lBQ3hDLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxFQUFFO0lBQ2hDLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDL0Q7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDTyxTQUFTLGFBQWEsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDN0QsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsT0FBTztJQUNoRCxJQUFJLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDO0lBQ2xELElBQUksU0FBUyxPQUFPLENBQUMsS0FBSyxFQUFFO0lBQzVCLFFBQVEsSUFBSSxLQUFLLENBQUMsS0FBSyxJQUFJLFNBQVMsSUFBSSxPQUFPLElBQUksU0FBUyxFQUFFO0lBQzlELFlBQVksS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFPO0lBQ2pDO0lBQ0EsUUFBUSxJQUFJLE1BQU0sSUFBSSxTQUFTLEVBQUU7SUFDakMsWUFBWSxNQUFNLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQztJQUNoQyxTQUFTLE1BQU07SUFDZixZQUFZLEtBQUssQ0FBQyxXQUFXLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxJQUFJLFNBQVMsSUFBSSxDQUFDLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRTtJQUNsRjtJQUNBO0lBQ0EsSUFBSSxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQztJQUN0Qzs7Ozs7SUFLQTtJQUNBO0lBQ0E7O0lBRU8sU0FBUyxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxJQUFJLEdBQUcsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDekQsSUFBSSxNQUFNLE1BQU0sR0FBRyxFQUFFO0lBQ3JCLElBQUksTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPO0lBQ3ZDLElBQUksSUFBSSxJQUFJLEtBQUssQ0FBQyxFQUFFO0lBQ3BCLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQztJQUMvQztJQUNBLElBQUksSUFBSSxLQUFLLEdBQUcsR0FBRyxFQUFFO0lBQ3JCLFFBQVEsS0FBSyxJQUFJLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFO0lBQ2hELFVBQVUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDeEI7SUFDQSxLQUFLLE1BQU0sSUFBSSxLQUFLLEdBQUcsR0FBRyxFQUFFO0lBQzVCLFFBQVEsS0FBSyxJQUFJLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFO0lBQ2hELFVBQVUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDeEI7SUFDQTtJQUNBLElBQUksSUFBSSxXQUFXLEVBQUU7SUFDckIsUUFBUSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUN4QjtJQUNBLElBQUksT0FBTyxNQUFNO0lBQ2pCOzs7SUFHQTtBQUNZLFVBQUMsV0FBVyxHQUFHLFNBQVMsV0FBVyxJQUFJO0lBQ25ELElBQUksT0FBTztJQUNYLFFBQVEsR0FBRyxFQUFFLE1BQU07SUFDbkIsWUFBWSxPQUFPLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNO0lBQzNDO0lBQ0E7SUFDQSxDQUFDOztJQUVEO0lBQ08sTUFBTSxXQUFXLEdBQUcsU0FBUyxXQUFXLElBQUk7SUFDbkQsSUFBSSxPQUFPO0lBQ1gsUUFBUSxHQUFHLEVBQUUsTUFBTTtJQUNuQixZQUFZLE9BQU8sSUFBSSxJQUFJLEVBQUUsQ0FBQyxNQUFNO0lBQ3BDO0lBQ0E7SUFDQSxDQUFDLEVBQUU7O0lBRUg7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFTyxTQUFTQyxTQUFPLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUM3RCxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLEdBQUcsT0FBTyxDQUFDO0lBQ3pDLElBQUksSUFBSSxTQUFTLElBQUksU0FBUyxFQUFFO0lBQ2hDLFFBQVEsSUFBSSxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUN4RCxRQUFRLElBQUksT0FBTyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzdELFFBQVEsT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDO0lBQ3ZDLEtBQUssTUFBTSxJQUFJLFNBQVMsSUFBSSxTQUFTLEVBQUU7SUFDdkMsUUFBUSxPQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDO0lBQ2hFO0lBQ0E7SUFDQSxJQUFJLElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDNUIsUUFBUSxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLE1BQU07SUFDdEQ7SUFDQTtJQUNBLElBQUksSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUN6QixJQUFJLE9BQU8sQ0FBQyxHQUFHLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM5Qjs7O0lBa0NPLFNBQVMsYUFBYSxDQUFDLE1BQU0sRUFBRTtJQUN0QyxJQUFJLElBQUksSUFBSSxHQUFHLEVBQUU7SUFDakIsSUFBSSxJQUFJLFFBQVEsR0FBRyxzREFBc0Q7SUFDekUsSUFBSSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0lBQ3BDLFFBQVEsSUFBSSxJQUFJLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzVFO0lBQ0EsSUFBSSxPQUFPLElBQUk7SUFDZjs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDTyxTQUFTLFdBQVcsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFO0lBQ2pELElBQUksSUFBSSxFQUFFLEdBQUcsV0FBVyxDQUFDLEdBQUcsRUFBRTtJQUM5QixJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDcEMsSUFBSSxJQUFJLFNBQVMsR0FBRyxFQUFFLEdBQUcsUUFBUTtJQUNqQyxJQUFJLElBQUksR0FBRztJQUNYLElBQUksU0FBUyxjQUFjLEdBQUc7SUFDOUIsUUFBUSxZQUFZLENBQUMsR0FBRyxDQUFDO0lBQ3pCO0lBQ0EsSUFBSSxTQUFTLGNBQWMsR0FBRztJQUM5QixRQUFRLE1BQU0sUUFBUSxHQUFHLFNBQVMsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFO0lBQ3RELFFBQVEsSUFBSSxRQUFRLEdBQUcsQ0FBQyxFQUFFO0lBQzFCO0lBQ0EsWUFBWSxHQUFHLEdBQUcsVUFBVSxDQUFDLGNBQWMsRUFBRSxRQUFRLEdBQUcsQ0FBQyxDQUFDO0lBQzFELFNBQVMsTUFBTTtJQUNmLFlBQVksUUFBUSxFQUFFO0lBQ3RCO0lBQ0E7SUFDQSxJQUFJLEdBQUcsR0FBRyxVQUFVLENBQUMsY0FBYyxFQUFFLFFBQVEsR0FBRyxDQUFDLENBQUM7SUFDbEQsSUFBSSxPQUFPLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQztJQUNsQzs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNPLFNBQVMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRTtJQUMzQyxJQUFJLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNO0lBQ2hDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUU7SUFDcEIsSUFBSSxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM5QyxJQUFJLE1BQU0sQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUN2QixJQUFJLE1BQU0sQ0FBQyxHQUFHLEVBQUU7SUFDaEIsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3BCOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsU0FBUyx5QkFBeUIsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFO0lBQy9DLElBQUksTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU07SUFDaEMsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEtBQUs7SUFDOUM7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsU0FBUyx5QkFBeUIsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFO0lBQ2hELElBQUksTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU07SUFDaEM7SUFDQSxJQUFJLElBQUksRUFBRSxLQUFLLEdBQUcsSUFBSSxFQUFFLEtBQUssR0FBRyxFQUFFO0lBQ2xDLFFBQVEsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLE9BQU8sRUFBRTtJQUMvQixhQUFhO0lBQ2I7SUFDQTtJQUNBLFlBQVksT0FBTyxTQUFTO0lBQzVCLFNBQ0E7SUFDQTtJQUNBLElBQUksSUFBSSxFQUFFLEtBQUssR0FBRyxFQUFFLE9BQU8sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQztJQUM1QztJQUNBLElBQUksSUFBSSx5QkFBeUIsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEtBQUssS0FBSyxFQUFFLE9BQU8sRUFBRTtJQUNsRTtJQUNBLElBQUksSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ3BELElBQUksSUFBSSxZQUFZLEtBQUssR0FBRyxFQUFFO0lBQzlCLFFBQVEsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ3pCO0lBQ0EsSUFBSSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZELElBQUksSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEdBQUcsSUFBSSxFQUFFLEVBQUU7SUFDakMsSUFBSSxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxJQUFJLEVBQUUsRUFBRTtJQUNqQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUM1QztJQUVBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQSxTQUFTLDRCQUE0QixDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUU7SUFDekQsSUFBSSxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTTtJQUNoQyxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsU0FBUztJQUMvQixJQUFJLElBQUksR0FBRyxJQUFJLElBQUksRUFBRSxHQUFHLEdBQUcsQ0FBQyxRQUFRO0lBQ3BDLElBQUksSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFLElBQUksR0FBRyxRQUFROztJQUVyQztJQUNBLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtJQUM5QztJQUNBLFFBQVEsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzdCLEtBQUs7O0lBRUw7SUFDQTtJQUNBLElBQUksSUFBSSxFQUFFLEtBQUssR0FBRyxJQUFJLEVBQUUsS0FBSyxHQUFHLEVBQUU7SUFDbEM7SUFDQSxRQUFRLE9BQU8sQ0FBQyxFQUFFLElBQUksR0FBRyxJQUFJLEVBQUUsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUU7SUFDOUQ7O0lBRUE7SUFDQSxJQUFJLElBQUksU0FBUyxHQUFHLEVBQUU7SUFDdEIsSUFBSSxJQUFJLENBQUMsUUFBUSxHQUFHLEdBQUcsRUFBRTtJQUN6QixRQUFRLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyx5QkFBeUIsQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDakUsS0FBSztJQUNMLElBQUksSUFBSSxJQUFJLEdBQUcsUUFBUSxFQUFFO0lBQ3pCLFFBQVEsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLHlCQUF5QixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNsRTtJQUNBO0lBQ0EsSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3ZDO0lBQ0EsSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDOztJQUVoQztJQUNBLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUU7SUFDMUI7SUFDQSxRQUFRLElBQUksU0FBUyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDbkM7SUFDQTtJQUNBLFlBQVksT0FBTyxDQUFDLEVBQUUsSUFBSSxJQUFJLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUU7SUFDckQ7SUFDQSxhQUFhLElBQUksU0FBUyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDeEMsWUFBWSxJQUFJLEVBQUUsR0FBRyxHQUFHLEVBQUU7SUFDMUI7SUFDQTtJQUNBLGdCQUFnQixPQUFPLEVBQUU7SUFDekIsYUFBYSxNQUFNLElBQUksRUFBRSxHQUFHLEdBQUcsRUFBRTtJQUNqQztJQUNBO0lBQ0EsZ0JBQWdCLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNyQyxhQUFhLE1BQU07SUFDbkI7SUFDQSxnQkFBZ0IsSUFBSSxFQUFFLEdBQUcsR0FBRyxFQUFFO0lBQzlCO0lBQ0Esb0JBQW9CLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqRCxpQkFBaUIsTUFBTTtJQUN2QjtJQUNBLG9CQUFvQixPQUFPLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDakQ7SUFDQTtJQUNBLFNBQVMsTUFBTSxJQUFJLFNBQVMsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO0lBQzFDO0lBQ0EsWUFBWSxJQUFJLEVBQUUsR0FBRyxHQUFHLEVBQUU7SUFDMUI7SUFDQSxnQkFBZ0IsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3JELGFBQWEsTUFBTSxJQUFJLEVBQUUsR0FBRyxHQUFHLEVBQUU7SUFDakM7SUFDQSxnQkFBZ0IsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ25FO0lBQ0E7OztJQUdBO0lBQ0EsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtJQUNqQztJQUNBLFFBQVEsSUFBSSxTQUFTLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUNuQztJQUNBO0lBQ0EsWUFBWSxPQUFPLENBQUMsRUFBRSxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRTtJQUNwRDtJQUNBLGFBQWEsSUFBSSxTQUFTLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUN4QyxZQUFZLElBQUksRUFBRSxHQUFHLEdBQUcsRUFBRTtJQUMxQjtJQUNBO0lBQ0EsZ0JBQWdCLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNyQyxhQUFhLE1BQU0sSUFBSSxFQUFFLEdBQUcsR0FBRyxFQUFFO0lBQ2pDO0lBQ0E7SUFDQSxnQkFBZ0IsT0FBTyxFQUFFO0lBQ3pCLGFBQWEsTUFBTTtJQUNuQjtJQUNBLGdCQUFnQixJQUFJLEVBQUUsR0FBRyxHQUFHLEVBQUU7SUFDOUI7SUFDQSxvQkFBb0IsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ2pELGlCQUFpQixNQUFNO0lBQ3ZCO0lBQ0Esb0JBQW9CLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqRDtJQUNBO0lBQ0EsU0FBUyxNQUFNLElBQUksU0FBUyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDMUM7SUFDQSxZQUFZLElBQUksRUFBRSxHQUFHLEdBQUcsRUFBRTtJQUMxQjtJQUNBLGdCQUFnQixPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDbkUsYUFBYSxNQUFNLElBQUksRUFBRSxHQUFHLEdBQUcsRUFBRTtJQUNqQztJQUNBLGdCQUFnQixPQUFPLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckQ7SUFDQTs7SUFFQTtJQUNBLEtBQUssTUFBTTtJQUNYO0lBQ0EsUUFBUSxJQUFJLFNBQVMsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRTtJQUM1QyxRQUFRLElBQUksU0FBUyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFO0lBQzVDLFFBQVEsSUFBSSxTQUFTLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDeEUsUUFBUSxJQUFJLFNBQVMsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4RSxRQUFRLElBQUksU0FBUyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RHO0lBQ0E7O0lBRUEsU0FBUyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUU7SUFDakMsSUFBSSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDL0MsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsNkJBQTZCLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUM5RDtJQUNBLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksSUFBSSxZQUFZLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqRCxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLElBQUksWUFBWSxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbEQ7O0lBRU8sTUFBTSxZQUFZLEdBQUc7SUFDNUIsSUFBSSxTQUFTLEVBQUUsZ0JBQWdCO0lBQy9CLElBQUksa0JBQWtCLEVBQUUseUJBQXlCO0lBQ2pELElBQUksa0JBQWtCLEVBQUUseUJBQXlCO0lBQ2pELElBQUkscUJBQXFCLEVBQUUsNEJBQTRCO0lBQ3ZELElBQUksV0FBVyxFQUFFO0lBQ2pCOztJQ2xaQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFTyxNQUFNLEtBQUssQ0FBQzs7SUFFbkIsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRTs7SUFFNUIsUUFBUSxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQzs7SUFFdkQ7SUFDQSxRQUFRLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSTs7SUFFNUI7SUFDQSxRQUFRQyxVQUFpQixDQUFDLElBQUksQ0FBQztJQUMvQjtJQUNBLFFBQVFDLGdCQUFpQixDQUFDLElBQUksQ0FBQztJQUMvQixRQUFRLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDOztJQUVsRDtJQUNBLFFBQVEsSUFBSSxDQUFDLEtBQUs7O0lBRWxCO0lBQ0EsUUFBUSxJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVU7SUFDckMsUUFBUSxJQUFJLENBQUMsY0FBYztJQUMzQixRQUFRLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxFQUFFO0lBQ2xDOztJQUVBO0lBQ0EsSUFBSSxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDOztJQUUxQztJQUNBLElBQUksSUFBSSxLQUFLLENBQUMsR0FBRztJQUNqQixRQUFRLElBQUksSUFBSSxDQUFDLGNBQWMsSUFBSSxTQUFTLEVBQUU7SUFDOUMsWUFBWSxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7SUFDNUQ7SUFDQSxRQUFRLE9BQU8sSUFBSSxDQUFDLGNBQWM7SUFDbEM7O0lBRUE7SUFDQSxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7SUFDbEIsUUFBUSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUN2Qzs7SUFFQTtJQUNBLElBQUksV0FBVyxDQUFDLEdBQUc7SUFDbkIsUUFBUSxNQUFNLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO0lBQ2hELFFBQVEsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDekMsUUFBUSxPQUFPLEtBQUs7SUFDcEI7SUFDQSxJQUFJLFlBQVksQ0FBQyxDQUFDLEtBQUssRUFBRTtJQUN6QixRQUFRLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0lBQ3hELFFBQVEsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUU7SUFDdEIsWUFBWSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDaEQ7SUFDQTs7O0lBR0EsSUFBSSxXQUFXLEdBQUc7SUFDbEIsUUFBUSxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztJQUNsRCxZQUFZLEtBQUssQ0FBQyxLQUFLLEVBQUU7SUFDekI7SUFDQSxRQUFRLElBQUksSUFBSSxDQUFDLGNBQWMsSUFBSSxTQUFTLEVBQUU7SUFDOUMsWUFBWSxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRTtJQUN2QztJQUNBOztJQUVBO0lBQ0EsSUFBSSxRQUFRLEdBQUc7SUFDZixRQUFRLElBQUksQ0FBQyxXQUFXLEVBQUU7SUFDMUIsUUFBUSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7SUFDL0IsUUFBUSxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3ZDOztJQUVBO0lBQ0EsSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUU7SUFDdEIsUUFBUSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztJQUMxQzs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0EsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUN2QixRQUFRLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRTtJQUNoQyxZQUFZLE9BQU8sRUFBRTtJQUNyQjtJQUNBLFFBQVEsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU87SUFDM0M7SUFDQSxRQUFRLElBQUksS0FBSyxJQUFJLFNBQVMsRUFBRTtJQUNoQztJQUNBLFlBQVksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUU7SUFDNUMsWUFBWSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLEVBQUU7SUFDbEMsZ0JBQWdCLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ2hDLGFBQWEsTUFBTTtJQUNuQixnQkFBZ0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQztJQUNsRCxhQUFhO0lBQ2I7SUFDQSxRQUFRLElBQUksSUFBSSxJQUFJLFNBQVMsRUFBRTtJQUMvQjtJQUNBLFlBQVksTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUU7SUFDMUMsWUFBWSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLEVBQUU7SUFDakMsZ0JBQWdCLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzlCLGFBQWEsTUFBTTtJQUNuQixnQkFBZ0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQztJQUNqRDtJQUNBO0lBQ0EsUUFBUSxJQUFJLEtBQUssR0FBRyxJQUFJLEVBQUU7SUFDMUIsWUFBWSxNQUFNLElBQUksS0FBSyxFQUFFLGdDQUFnQyxFQUFFLEtBQUssRUFBRSxJQUFJO0lBQzFFO0lBQ0EsUUFBUSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFO0lBQ3hDLFFBQVEsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztJQUNuRSxhQUFhLEdBQUcsQ0FBQyxDQUFDLE1BQU0sS0FBSztJQUM3QixnQkFBZ0IsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztJQUMxRCxhQUFhLENBQUM7SUFDZCxRQUFRLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO0lBQ2hDLFFBQVEsT0FBTyxPQUFPO0lBQ3RCO0lBQ0E7QUFDQUMsZ0JBQW1CLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQztBQUNwQ0MscUJBQW1CLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQzs7O0lBR3BDO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVPLE1BQU0sVUFBVSxDQUFDOztJQUV4QixJQUFJLFdBQVcsQ0FBQyxLQUFLLEVBQUU7SUFDdkI7SUFDQSxRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztJQUMzQjtJQUNBLFFBQVEsSUFBSSxDQUFDLE9BQU87SUFDcEI7SUFDQSxRQUFRLElBQUksQ0FBQyxNQUFNO0lBQ25COztJQUVBLElBQUksSUFBSSxLQUFLLEdBQUcsQ0FBQyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7O0lBRXBDO0lBQ0E7SUFDQTtJQUNBLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtJQUNsQixRQUFRLE1BQU0saUJBQWlCO0lBQy9CLFlBQVksSUFBSSxDQUFDLE9BQU8sSUFBSSxTQUFTO0lBQ3JDLFlBQVksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE1BQU07SUFDOUQsU0FBUztJQUNULFFBQVE7SUFDUixZQUFZLENBQUMsaUJBQWlCO0lBQzlCLFlBQVksSUFBSSxDQUFDLE1BQU0sSUFBSSxTQUFTO0lBQ3BDLFlBQVksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3pCLFVBQVU7SUFDVjtJQUNBLFlBQVksT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUM7SUFDM0M7SUFDQTtJQUNBLFFBQVEsSUFBSSxpQkFBaUIsRUFBRTtJQUMvQixZQUFZLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUMzRDtJQUNBO0lBQ0EsUUFBUSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEtBQUs7SUFDMUQsWUFBWSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQ3RDLFNBQVMsQ0FBQztJQUNWO0lBQ0EsUUFBUSxNQUFNLEtBQUssR0FBR0osU0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7SUFDdkY7SUFDQSxRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLFNBQVMsR0FBRyxLQUFLO0lBQ3pELFFBQVEsT0FBTyxLQUFLO0lBQ3BCOztJQUVBLElBQUksS0FBSyxHQUFHO0lBQ1osUUFBUSxJQUFJLENBQUMsT0FBTyxHQUFHLFNBQVM7SUFDaEMsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLFNBQVM7SUFDL0I7SUFDQTs7SUNsT0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxNQUFNLE1BQU0sQ0FBQzs7SUFFYixJQUFJLFdBQVcsQ0FBQyxRQUFRLEVBQUU7SUFDMUIsUUFBUSxJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVE7SUFDakMsUUFBUSxJQUFJLENBQUMsT0FBTztJQUNwQixRQUFRLElBQUksQ0FBQyxNQUFNO0lBQ25CO0lBQ0E7SUFDQSxJQUFJLElBQUksS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFO0lBQ3pCLFFBQVEsSUFBSSxPQUFPLFFBQVEsSUFBSSxRQUFRLEVBQUU7SUFDekMsWUFBWSxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsdUJBQXVCLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUNqRTtJQUNBLFFBQVEsSUFBSSxJQUFJLENBQUMsTUFBTSxJQUFJLFFBQVEsRUFBRTtJQUNyQyxZQUFZLElBQUksQ0FBQyxNQUFNLEdBQUcsUUFBUTtJQUNsQztJQUNBO0lBQ0EsSUFBSSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDOztJQUVyQyxJQUFJLFVBQVUsQ0FBQyxHQUFHO0lBQ2xCLFFBQVEsT0FBTyxJQUFJLENBQUMsT0FBTyxJQUFJLFNBQVM7SUFDeEM7O0lBRUEsSUFBSSxLQUFLLEdBQUc7SUFDWixRQUFRLElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxTQUFTLEVBQUU7SUFDdkMsWUFBWSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRTtJQUNqQyxZQUFZLElBQUksQ0FBQyxPQUFPLEdBQUcsU0FBUztJQUNwQztJQUNBOztJQUVBLElBQUksSUFBSSxHQUFHO0lBQ1g7SUFDQSxRQUFRLElBQUksQ0FBQyxTQUFTLEVBQUU7SUFDeEI7SUFDQSxRQUFRLElBQUksQ0FBQyxLQUFLLEVBQUU7SUFDcEIsUUFBUSxJQUFJLENBQUMsTUFBTSxFQUFFO0lBQ3JCOztJQUVBLElBQUksTUFBTSxHQUFHO0lBQ2IsUUFBUSxJQUFJLElBQUksQ0FBQyxPQUFPLElBQUksU0FBUyxFQUFFO0lBQ3ZDLFlBQVksSUFBSSxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUNsQztJQUNBLGdCQUFnQixNQUFNLEdBQUcsR0FBRyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2RSxnQkFBZ0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLE1BQU0sRUFBRSxNQUFNLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3hFLGFBQWEsTUFBTTtJQUNuQjtJQUNBLGdCQUFnQixNQUFNLEdBQUcsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUN6RSxnQkFBZ0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLE1BQU0sRUFBRSxNQUFNLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNoRTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRUEsTUFBTSxhQUFhLENBQUM7SUFDcEIsSUFBSSxXQUFXLEdBQUc7SUFDbEI7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsUUFBUSxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksR0FBRyxFQUFFOztJQUVyQztJQUNBO0lBQ0E7SUFDQTtJQUNBLFFBQVEsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLEdBQUcsRUFBRTs7SUFFcEM7SUFDQSxRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekQ7O0lBRUEsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUU7SUFDbEM7SUFDQSxRQUFRLElBQUksS0FBSyxJQUFJLFNBQVMsRUFBRTtJQUNoQyxZQUFZLEtBQUssR0FBRyxDQUFDO0lBQ3JCLFNBQVMsTUFBTSxJQUFJLE9BQU8sS0FBSyxJQUFJLFFBQVEsRUFBRTtJQUM3QyxZQUFZLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyx1QkFBdUIsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQzlEO0lBQ0E7SUFDQSxRQUFRLElBQUksT0FBTyxHQUFHLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUM7SUFDL0MsUUFBUSxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUM7SUFDdEM7SUFDQSxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRTtJQUMzQyxZQUFZLElBQUksR0FBRyxHQUFHLE1BQU0sQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pFLFlBQVksSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFO0lBQ3pDLGdCQUFnQixHQUFHLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsQ0FBQyxPQUFPO0lBQ3ZELGFBQWEsQ0FBQztJQUNkLFNBQVMsTUFBTTtJQUNmLFlBQVksSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDL0Q7SUFDQSxRQUFRLE9BQU8sT0FBTztJQUN0Qjs7SUFFQSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRTtJQUN0QjtJQUNBLFFBQVEsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO0lBQ3pELFFBQVEsSUFBSSxDQUFDLE9BQU8sRUFBRTtJQUN0QjtJQUNBLFFBQVEsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU07SUFDckMsUUFBUSxNQUFNLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztJQUM1RDtJQUNBLFFBQVEsTUFBTSxHQUFHLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7SUFDN0MsUUFBUSxJQUFJLEdBQUcsSUFBSSxDQUFDLEVBQUU7SUFDdEIsWUFBWSxRQUFRLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDbkM7SUFDQSxRQUFRLElBQUksUUFBUSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDbEM7SUFDQSxZQUFZLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO0lBQzNCLFlBQVksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQzNDO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsSUFBSSxjQUFjLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTtJQUNoQyxRQUFRLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxHQUFHO0lBQ2hDLFFBQVEsTUFBTSxLQUFLLEdBQUcsSUFBSTtJQUMxQjtJQUNBLFFBQVEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPO0lBQzVEO0lBQ0EsUUFBUSxNQUFNLGVBQWUsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUU7SUFDN0QsYUFBYSxNQUFNLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUM7SUFDM0MsUUFBUSxJQUFJLENBQUMsa0JBQWtCLENBQUMsZUFBZSxDQUFDO0lBQ2hEO0lBQ0EsUUFBUSxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDO0lBQ3ZELFFBQVEsS0FBSyxNQUFNLE9BQU8sSUFBSSxRQUFRLEVBQUU7SUFDeEMsWUFBWSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQztJQUNuQztJQUNBOztJQUVBLElBQUksTUFBTSxHQUFHO0lBQ2IsUUFBUSxNQUFNLEVBQUUsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFO0lBQ3BDO0lBQ0EsUUFBUSxLQUFLLE1BQU0sQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtJQUN4RCxZQUFZLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRTtJQUMvQixnQkFBZ0IsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7SUFDOUM7SUFDQSxnQkFBZ0IsS0FBSyxNQUFNLE9BQU8sSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO0lBQ3RELG9CQUFvQixPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQztJQUMzQztJQUNBO0lBQ0E7SUFDQTs7SUFFQSxJQUFJLGtCQUFrQixDQUFDLGVBQWUsRUFBRTtJQUN4QyxRQUFRLElBQUksZUFBZSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDekMsWUFBWSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRTtJQUNoQyxTQUFTLE1BQU07SUFDZjtJQUNBLFlBQVksTUFBTSxNQUFNLEdBQUcsRUFBRTtJQUM3QixZQUFZLEtBQUssTUFBTSxLQUFLLElBQUksZUFBZSxFQUFFO0lBQ2pELGdCQUFnQixLQUFLLE1BQU0sT0FBTyxJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUU7SUFDdEQsb0JBQW9CLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztJQUM5QztJQUNBLGFBQ0EsWUFBWSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDO0lBQ2pELFlBQVksSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEdBQUcsU0FBUztJQUMxQyxZQUFZLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFO0lBQ2hDLFlBQVksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUU7SUFDakM7SUFDQTtJQUNBOzs7SUFHQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQSxNQUFNLE9BQU8sR0FBRyxJQUFJLGFBQWEsRUFBRTs7SUFFNUIsU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUU7SUFDOUMsSUFBSSxPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUM7SUFDaEQ7SUFDTyxTQUFTLE9BQU8sQ0FBQyxPQUFPLEVBQUU7SUFDakMsSUFBSSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO0lBQ25DOztJQ2xNQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ08sU0FBUyxxQkFBcUIsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0lBQ3pELElBQUksTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDO0lBQzdDLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRTtJQUN4QyxRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQywwQ0FBMEMsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNuRjtJQUNBLElBQUksT0FBTyxLQUFLO0lBQ2hCOztJQUVBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRU8sTUFBTSxNQUFNLENBQUM7SUFDcEI7SUFDQSxJQUFJLFdBQVcsR0FBRztJQUNsQjtJQUNBLFFBQVFDLFVBQWlCLENBQUMsSUFBSSxDQUFDO0lBQy9CO0lBQ0EsUUFBUUMsZ0JBQWlCLENBQUMsSUFBSSxDQUFDO0lBQy9CLFFBQVEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbEQ7O0lBRUE7SUFDQTtJQUNBOztJQUVBLElBQUksS0FBSyxHQUFHO0lBQ1osUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDO0lBQ2xEOztJQUVBLElBQUksSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQzs7SUFFNUMsSUFBSSxHQUFHLENBQUMsR0FBRztJQUNYLFFBQVEsT0FBTyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSztJQUNqQzs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLHFCQUFxQixDQUFDLElBQUksRUFBRTtJQUNoQyxRQUFRLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtJQUM5QixZQUFZLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDakM7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUN0QyxRQUFRLE9BQU8sSUFBSSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBYyxDQUFDO0lBQ25EO0lBQ0EsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFO0lBQ3BCLFFBQVEsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDO0lBQzlCOztJQUVBO0lBQ0EsSUFBSSxRQUFRLEdBQUc7SUFDZixRQUFRLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtJQUMvQixRQUFRLElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ3JEO0lBQ0E7QUFDQUMsZ0JBQW1CLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQztBQUNyQ0MscUJBQW1CLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQzs7SUMxRXJDO0lBQ0E7SUFDQTtJQUNPLFNBQVMsaUJBQWlCLENBQUMsR0FBRyxFQUFFO0lBQ3ZDLElBQUksSUFBSSxHQUFHLElBQUksU0FBUyxFQUFFLE9BQU8sS0FBSztJQUN0QyxJQUFJLElBQUksRUFBRSxLQUFLLElBQUksR0FBRyxDQUFDLEVBQUUsT0FBTyxLQUFLO0lBQ3JDLElBQUksSUFBSSxPQUFPLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxFQUFFLE9BQU8sS0FBSztJQUNsRCxJQUFJLE9BQU8sSUFBSTtJQUNmOzs7SUFHQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDTyxNQUFNLG9CQUFvQixHQUFHLFlBQVk7SUFDaEQsSUFBSSxNQUFNLEVBQUUsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFO0lBQ2hDLElBQUksTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLEdBQUcsRUFBRTtJQUN0QyxJQUFJLE9BQU87SUFDWCxRQUFRLEdBQUcsQ0FBQyxDQUFDLFFBQVEsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLEVBQUU7SUFDM0MsWUFBWSxPQUFPLFFBQVEsSUFBSSxRQUFRLEdBQUcsRUFBRSxDQUFDO0lBQzdDO0lBQ0E7SUFDQSxDQUFDLEVBQUU7O0lDdkJILFNBQVMsVUFBVSxDQUFDLElBQUksRUFBRTtJQUMxQixJQUFJLElBQUksQ0FBQyxHQUFHLEdBQUcsUUFBUSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQzVDLElBQUksSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsRUFBRSxJQUFJLGFBQWEsQ0FBQyxFQUFFLENBQUM7SUFDMUMsSUFBSSxPQUFPLElBQUk7SUFDZjs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNPLFNBQVMsc0JBQXNCLENBQUMsR0FBRyxFQUFFO0lBQzVDLElBQUksSUFBSSxDQUFDQyxlQUF3QixDQUFDLEdBQUcsQ0FBQyxFQUFFLE9BQU8sS0FBSztJQUNwRCxJQUFJLElBQUksRUFBRSxLQUFLLElBQUksR0FBRyxDQUFDLEVBQUUsT0FBTyxLQUFLO0lBQ3JDLElBQUksSUFBSSxPQUFPLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxFQUFFLE9BQU8sS0FBSztJQUNsRCxJQUFJLElBQUksRUFBRSxRQUFRLElBQUksR0FBRyxDQUFDLEVBQUUsT0FBTyxLQUFLO0lBQ3hDLElBQUksSUFBSSxPQUFPLEdBQUcsQ0FBQyxNQUFNLElBQUksVUFBVSxFQUFFLE9BQU8sS0FBSztJQUNyRCxJQUFJLE9BQU8sSUFBSTtJQUNmOzs7SUFHQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFTyxNQUFNLGtCQUFrQixDQUFDOztJQUVoQyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO0lBQzVCLFFBQVFKLFVBQWlCLENBQUMsSUFBSSxDQUFDO0lBQy9CLFFBQVEsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBRTtJQUM3QjtJQUNBLFFBQVEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE9BQU87SUFDOUIsUUFBUSxJQUFJLE1BQU0sSUFBSSxTQUFTLEVBQUU7SUFDakMsWUFBWSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QztJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsSUFBSSxNQUFNLENBQUMsQ0FBQyxPQUFPLEVBQUU7SUFDckIsUUFBUSxPQUFPLE9BQU8sQ0FBQyxPQUFPO0lBQzlCLFNBQVMsSUFBSSxDQUFDLE1BQU07SUFDcEIsWUFBWSxJQUFJLEtBQUs7SUFDckIsWUFBWSxJQUFJLE9BQU8sSUFBSSxTQUFTLEVBQUU7SUFDdEMsZ0JBQWdCLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztJQUM3QyxnQkFBZ0IsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQztJQUM1QztJQUNBLFlBQVksT0FBTyxLQUFLO0lBQ3hCLFNBQVMsQ0FBQztJQUNWOztJQUVBLElBQUksT0FBTyxDQUFDLE9BQU8sRUFBRTtJQUNyQixRQUFRLE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxFQUFFO0lBQ2xDLFFBQVEsSUFBSTtJQUNaLFlBQVksTUFBTSxDQUFDLEVBQUU7SUFDckIsWUFBWSxNQUFNLENBQUMsRUFBRTtJQUNyQixZQUFZLEtBQUssQ0FBQztJQUNsQixTQUFTLEdBQUcsT0FBTzs7O0lBR25CLFFBQVEsSUFBSSxLQUFLLEVBQUU7SUFDbkIsWUFBWSxLQUFLLE1BQU0sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRTtJQUMxRCxnQkFBZ0IsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0Q7SUFDQTtJQUNBLFlBQVksSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBRTtJQUNqQyxTQUFTLE1BQU07SUFDZjtJQUNBLFlBQVksS0FBSyxNQUFNLEVBQUUsSUFBSSxNQUFNLEVBQUU7SUFDckMsZ0JBQWdCLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztJQUM1QyxnQkFBZ0IsSUFBSSxJQUFJLElBQUksU0FBUyxFQUFFO0lBQ3ZDLG9CQUFvQixRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUU7SUFDMUMsd0JBQXdCLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDO0lBQ3ZELHFCQUFxQixDQUFDO0lBQ3RCLG9CQUFvQixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7SUFDeEM7SUFDQTtJQUNBO0lBQ0E7SUFDQSxRQUFRLEtBQUssSUFBSSxJQUFJLElBQUksTUFBTSxFQUFFO0lBQ2pDLFlBQVksSUFBSSxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUM7SUFDbkMsWUFBWSxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO0lBQzdDLFlBQVksTUFBTSxHQUFHLEdBQUcsQ0FBQyxJQUFJLElBQUksU0FBUyxJQUFJLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztJQUMvRSxZQUFZLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDOUQsWUFBWSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQztJQUN4QztJQUNBLFFBQVEsT0FBTyxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQ3JDOztJQUVBLElBQUksR0FBRyxHQUFHO0lBQ1YsUUFBUSxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQ3RDLEtBQUs7SUFDTDtBQUNBRSxnQkFBbUIsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUM7O0lDNUdqRDtJQUNBO0lBQ0E7SUFDQTtJQUNPLFNBQVMsb0JBQW9CLENBQUMsR0FBRyxFQUFFO0lBQzFDLElBQUksSUFBSSxDQUFDRSxlQUF3QixDQUFDLEdBQUcsQ0FBQyxFQUFFLE9BQU8sS0FBSztJQUNwRCxJQUFJLElBQUksRUFBRSxLQUFLLElBQUksR0FBRyxDQUFDLEVBQUUsT0FBTyxLQUFLO0lBQ3JDLElBQUksSUFBSSxPQUFPLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxFQUFFLE9BQU8sS0FBSztJQUNsRCxJQUFJLElBQUksRUFBRSxLQUFLLElBQUksR0FBRyxDQUFDLEVBQUUsT0FBTyxLQUFLO0lBQ3JDLElBQUksSUFBSSxPQUFPLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxFQUFFLE9BQU8sS0FBSztJQUNsRCxJQUFJLE9BQU8sSUFBSTtJQUNmOzs7SUFHQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOztJQUVPLE1BQU0sZ0JBQWdCLENBQUM7O0lBRTlCLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDNUIsUUFBUUosVUFBaUIsQ0FBQyxJQUFJLENBQUM7SUFDL0IsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUU7SUFDeEI7SUFDQSxRQUFRLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPO0lBQy9CLFFBQVEsSUFBSSxLQUFLLElBQUksU0FBUyxFQUFFO0lBQ2hDLFlBQVksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDO0lBQzNCLGdCQUFnQixFQUFFLEVBQUUsYUFBYSxDQUFDLEVBQUUsQ0FBQztJQUNyQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0lBQzdDLGdCQUFnQixJQUFJLEVBQUUsUUFBUTtJQUM5QixnQkFBZ0IsSUFBSSxFQUFFO0lBQ3RCLGFBQWEsQ0FBQztJQUNkO0lBQ0E7O0lBRUEsSUFBSSxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUU7SUFDaEIsUUFBUSxPQUFPLE9BQU8sQ0FBQyxPQUFPO0lBQzlCLGFBQWEsSUFBSSxDQUFDLE1BQU07SUFDeEIsZ0JBQWdCLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztJQUNuQyxnQkFBZ0IsSUFBSSxDQUFDLGdCQUFnQixFQUFFO0lBQ3ZDLGFBQWEsQ0FBQztJQUNkOztJQUVBLElBQUksR0FBRyxDQUFDLEdBQUc7SUFDWCxRQUFRLE9BQU8sSUFBSSxDQUFDLE1BQU07SUFDMUI7SUFDQTtBQUNBRSxnQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUM7O0lDcEQvQztJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLE1BQU0sSUFBSSxHQUFHLFNBQVM7SUFDdEIsTUFBTSxNQUFNLEdBQUcsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7O0lBRW5CLFNBQVMsUUFBUSxFQUFFLE1BQU0sRUFBRTtJQUNsQyxJQUFJLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0lBQ25DOztJQUVPLFNBQVMsVUFBVSxFQUFFLE1BQU0sRUFBRTs7SUFFcEMsSUFBSSxTQUFTLFFBQVEsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUM1QyxRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsT0FBTztJQUNwQyxRQUFRLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RDLFFBQVEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7SUFDMUIsWUFBWSxJQUFJLENBQUMsS0FBSztJQUN0QixZQUFZLE9BQU87SUFDbkIsWUFBWSxNQUFNLEVBQUUsU0FBUztJQUM3QixZQUFZLE9BQU8sRUFBRTtJQUNyQixTQUFTLENBQUM7O0lBRVY7SUFDQSxRQUFRLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtJQUM5QyxZQUFZLEdBQUcsRUFBRSxZQUFZO0lBQzdCLGdCQUFnQixPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTTtJQUMvQyxhQUFhO0lBQ2IsWUFBWSxHQUFHLEVBQUUsVUFBVSxNQUFNLEVBQUU7SUFDbkMsZ0JBQWdCLElBQUksSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRTtJQUMzQyxvQkFBb0IsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQztJQUNwRTtJQUNBLGdCQUFnQixJQUFJLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sRUFBRTtJQUN4RCxvQkFBb0IsSUFBSSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDO0lBQzlEO0lBQ0E7SUFDQSxTQUFTLENBQUM7SUFDVjs7SUFFQSxJQUFJLFNBQVMsT0FBTyxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUU7O0lBRXZDLFFBQVEsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ3JDLFFBQVEsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFROztJQUV0QyxRQUFRLElBQUksS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUU7SUFDMUMsWUFBWSxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsc0JBQXNCLENBQUMsQ0FBQztJQUNoRTs7SUFFQSxRQUFRLE1BQU0sUUFBUSxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxNQUFNLEdBQUcsQ0FBQyxNQUFNLENBQUM7O0lBRXBFO0lBQ0EsUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtJQUN0QyxZQUFZLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO0lBQzdELGdCQUFnQixJQUFJLGVBQWUsQ0FBQyxDQUFDLENBQUMsRUFBRTtJQUN4QyxvQkFBb0IsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3pEO0lBQ0EsYUFBYTtJQUNiO0lBQ0EsUUFBUSxLQUFLLENBQUMsT0FBTyxHQUFHLEVBQUU7O0lBRTFCO0lBQ0EsUUFBUSxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQU07SUFDN0IsUUFBUSxLQUFLLENBQUMsSUFBSSxHQUFHLElBQUk7O0lBRXpCO0lBQ0EsUUFBUSxJQUFJLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUU7SUFDdEMsWUFBWSxNQUFNLE9BQU8sR0FBRyxVQUFVLElBQUksRUFBRTtJQUM1QyxnQkFBZ0IsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDO0lBQ3hELGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ3hCLFlBQVksS0FBSyxNQUFNLENBQUMsSUFBSSxRQUFRLEVBQUU7SUFDdEMsZ0JBQWdCLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ3hDLG9CQUFvQixLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQy9EO0lBQ0E7SUFDQSxZQUFZLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3hEO0lBQ0E7O0lBRUEsSUFBSSxNQUFNLEdBQUcsR0FBRyxFQUFFO0lBQ2xCLElBQUksR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxRQUFRO0lBQ3RDLElBQUksR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxPQUFPO0lBQ3JDLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDO0lBQzlCOztJQzNGQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBOztJQUVPLE1BQU0sV0FBVyxDQUFDOztJQUV6QixDQUFDLFdBQVcsRUFBRTtJQUNkLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFO0lBQ2xCOztJQUVBLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ3ZDLENBQUMsSUFBSSxLQUFLLEdBQUcsQ0FBQyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7O0lBRWpDO0lBQ0E7O0lBRUE7O0lBRUE7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRTtJQUN2QixFQUFFLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDO0lBQ3JELEVBQUUsSUFBSSxRQUFRLEdBQUcsQ0FBQztJQUNsQixFQUFFLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUM7SUFDeEMsRUFBRSxPQUFPLFFBQVEsSUFBSSxTQUFTLEVBQUU7SUFDaEMsR0FBRyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxHQUFHLFNBQVMsSUFBSSxDQUFDLENBQUM7SUFDekQsR0FBRyxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztJQUN2QyxHQUFHLElBQUksUUFBUSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLEVBQUU7SUFDMUMsSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzNCLElBQUksTUFBTSxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxFQUFFO0lBQ2pELE1BQU0sUUFBUSxHQUFHLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDN0IsSUFBSSxNQUFNO0lBQ1YsTUFBTSxTQUFTLEdBQUcsT0FBTyxHQUFHLENBQUMsQ0FBQztJQUM5QjtJQUNBO0lBQ0EsSUFBSSxPQUFPLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQzdCOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFO0lBQ3pCLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQztJQUMvQyxFQUFFLE9BQU8sQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQztJQUM5Qzs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRTtJQUN6QixFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUM7SUFDL0MsRUFBRSxHQUFHLEdBQUcsQ0FBQyxLQUFLLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQzdCLEVBQUUsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQztJQUM5Qjs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRTtJQUN6QixFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUM7SUFDL0MsRUFBRSxHQUFHLEdBQUcsQ0FBQyxLQUFLLElBQUksR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHO0lBQy9CLEVBQUUsT0FBTyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQzlDOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFO0lBQ3pCLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQztJQUMvQyxFQUFFLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztJQUNiLEVBQUUsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQy9COztJQUVBO0lBQ0E7O0lBRUE7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOztJQUVBOztJQUVBLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFLEVBQUUsV0FBVyxDQUFDLEVBQUUsRUFBRTs7SUFFeEM7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsRUFBRSxJQUFJLGVBQWUsR0FBRyxFQUFFO0lBQzFCLEVBQUUsS0FBSyxJQUFJLEtBQUssSUFBSSxXQUFXLEVBQUU7SUFDakMsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0lBQ3pDLEdBQUcsSUFBSSxLQUFLLEVBQUU7SUFDZCxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQzdCLElBQUk7SUFDSjtJQUNBLEVBQUUsS0FBSyxJQUFJLEdBQUcsSUFBSSxlQUFlLEVBQUU7SUFDbkMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFNBQVM7SUFDL0I7SUFDQSxFQUFFLElBQUksV0FBVyxHQUFHLGVBQWUsQ0FBQyxNQUFNLEdBQUcsQ0FBQzs7SUFFOUM7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQSxFQUFFLElBQUksV0FBVyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQztJQUMxQyxFQUFFLElBQUksV0FBVyxFQUFFO0lBQ25CLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDO0lBQzVDOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsRUFBRSxJQUFJLFdBQVcsSUFBSSxXQUFXLEVBQUU7SUFDbEMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDO0lBQ2pDOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsRUFBRSxJQUFJLFdBQVcsRUFBRTtJQUNuQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLGVBQWUsQ0FBQyxNQUFNO0lBQy9DOztJQUVBO0lBQ0E7SUFDQTtJQUNBOztJQUVBO0lBQ0EsRUFBRSxJQUFJLFdBQVcsRUFBRTtJQUNuQixHQUFHLGlCQUFpQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDakM7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUU7SUFDbkIsRUFBRSxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7SUFDNUMsR0FBRyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDO0lBQzFCO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFO0lBQ2IsRUFBRSxJQUFJLEdBQUcsSUFBSSxTQUFTLEVBQUU7SUFDeEIsR0FBRyxHQUFHLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7SUFDakM7SUFDQSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUM7SUFDaEQsRUFBRSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztJQUNsQyxFQUFFLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO0lBQ2xDLEVBQUUsSUFBSSxLQUFLLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQyxFQUFFO0lBQ2xDLEdBQUcsT0FBTyxFQUFFO0lBQ1osR0FBRyxNQUFNO0lBQ1QsR0FBRyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQzNDO0lBQ0E7O0lBRUEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUU7SUFDYixFQUFFLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2xEO0lBQ0EsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUU7SUFDYixFQUFFLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2xEO0lBQ0EsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUU7SUFDZCxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDekMsRUFBRSxJQUFJLEtBQUssRUFBRTtJQUNiLEdBQUcsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQztJQUMxQixHQUFHO0lBQ0g7SUFDQSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sRUFBRTtJQUNiLEVBQUUsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbEQ7SUFDQSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sRUFBRTtJQUNiLEVBQUUsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbEQ7SUFDQTs7O0lBR0E7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTs7SUFFQSxTQUFTLGVBQWUsQ0FBQyxTQUFTLEVBQUUsVUFBVSxFQUFFO0lBQ2hELENBQUMsTUFBTSxnQkFBZ0IsR0FBRyxTQUFTLENBQUMsTUFBTTtJQUMxQyxDQUFDLE1BQU0saUJBQWlCLEdBQUcsVUFBVSxDQUFDLE1BQU07SUFDNUMsR0FBRyxTQUFTLENBQUMsTUFBTSxJQUFJLGlCQUFpQjtJQUN4QyxHQUFHLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxpQkFBaUIsRUFBRSxDQUFDLEVBQUUsRUFBRTtJQUMvQyxLQUFLLFNBQVMsQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBQ3BEO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0EsU0FBUyxpQkFBaUIsQ0FBQyxVQUFVLEVBQUU7SUFDdkMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ1YsQ0FBQyxPQUFPLElBQUksRUFBRTtJQUNkLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxNQUFNLEVBQUU7SUFDbEMsR0FBRztJQUNIO0lBQ0EsRUFBRSxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRTtJQUNyRCxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDOUIsR0FBRyxNQUFNO0lBQ1QsR0FBRyxDQUFDLElBQUksQ0FBQztJQUNUO0lBQ0E7SUFDQTs7SUMzUEEsTUFBTSxDQUFDLFVBQVUsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLFNBQVMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxLQUFLO0lBQ3JFLE1BQU0sUUFBUSxHQUFHLENBQUMsVUFBVSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDOzs7SUFHL0Q7SUFDQSxNQUFNLFdBQVcsQ0FBQztJQUNsQixDQUFDLFdBQVcsR0FBRztJQUNmLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQztJQUN0QixHQUFHLENBQUMsVUFBVSxFQUFFLElBQUksR0FBRyxFQUFFLENBQUM7SUFDMUIsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLEdBQUcsQ0FBQyxXQUFXLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUMzQixHQUFHLENBQUMsU0FBUyxFQUFFLElBQUksR0FBRyxFQUFFO0lBQ3hCLEdBQUcsQ0FBQztJQUNKO0lBQ0EsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFO0lBQ1QsRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7SUFDMUIsRUFBRSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUM7SUFDdkM7SUFDQSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRTtJQUNWLEVBQUUsTUFBTSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO0lBQzFCLEVBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO0lBQ3ZDO0lBQ0EsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFO0lBQ1QsRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7SUFDMUIsRUFBRSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUM7SUFDdkM7O0lBRUEsQ0FBQyxJQUFJLEdBQUc7SUFDUixFQUFFLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEtBQUs7SUFDdkMsR0FBRyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUU7SUFDMUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDbEMsR0FBRyxDQUFDO0lBQ0osRUFBRSxPQUFPLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxLQUFLLENBQUM7SUFDNUI7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7O0lBR0EsTUFBTSxHQUFHLEdBQUcsS0FBSztJQUNqQixNQUFNLE1BQU0sR0FBRyxRQUFRO0lBQ3ZCLE1BQU0sSUFBSSxHQUFHLE1BQU07OztJQUduQixNQUFNLFFBQVEsQ0FBQzs7SUFFZixDQUFDLFdBQVcsQ0FBQyxHQUFHO0lBQ2hCO0lBQ0EsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDO0lBQ3RCLEdBQUcsQ0FBQyxVQUFVLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUMxQixHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksR0FBRyxFQUFFLENBQUM7SUFDeEIsR0FBRyxDQUFDLFdBQVcsRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQzNCLEdBQUcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxHQUFHLEVBQUU7SUFDeEIsR0FBRyxDQUFDO0lBQ0o7O0lBRUEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUU7SUFDOUIsRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUU7SUFDMUIsRUFBRSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO0lBQzlDLEVBQUUsT0FBTyxDQUFDLEtBQUssSUFBSSxTQUFTLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7SUFDaEQ7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRTtJQUMxQixFQUFFLE1BQU0sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtJQUMxQixFQUFFLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztJQUN0QyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFO0lBQzVCLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLE1BQU0sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3JEO0lBQ0EsRUFBRSxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQztJQUNuQyxFQUFFLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDO0lBQy9ELEVBQUUsSUFBSSxHQUFHLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEtB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QUFDLEVBQUU7SUFDbkMsUUFBUSxPQUFPLFNBQVMsWUFBWSxJQUFJLENBQUMsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0Q7O0lBRUE7SUFDQSxJQUFJLE1BQU0sWUFBWSxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDaEU7SUFDQSxJQUFJLE9BQU8sU0FBUyxZQUFZLENBQUMsTUFBTSxFQUFFO0lBQ3pDO0lBQ0EsTUFBTSxJQUFJLE1BQU0sSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7SUFDeEMsUUFBUSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDakQsUUFBUSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDakQsUUFBUSxPQUFPLE1BQU0sSUFBSSxDQUFDLE1BQU0sR0FBRyxPQUFPLEtBQUssTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsQ0FBQztJQUN0RjtJQUNBO0lBQ0E7SUFDQSxNQUFNLElBQUksTUFBTSxJQUFJLFlBQVksQ0FBQyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQzlELFFBQVEsTUFBTSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDdkUsUUFBUSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUN2RSxRQUFRLE9BQU8sTUFBTSxJQUFJLENBQUMsTUFBTSxHQUFH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LFNBQVMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDO0lBQzVDLFFBQVEsT0FBTyxLQUFLO0lBQ3BCLEtBQUssTUFBTSxJQUFJLFNBQVMsSUFBSSxTQUFTLEVBQUU7SUFDdkMsUUFBUSxPQUFPLFNBQVMsQ0FBQyxLQUFLLENBQUM7SUFDL0IsS0FBSyxNQUFNO0lBQ1gsUUFBUSxPQUFPLEtBQUs7SUFDcEI7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNPLFNBQVMsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7O0lBRWxELElBQUksSUFBSSxFQUFFLEdBQUcsWUFBWSxNQUFNLENBQUMsRUFBRTtJQUNsQyxRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxxQkFBcUIsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ3REOztJQUVBLElBQUksTUFBTSxNQUFNLEdBQUcsSUFBSSxNQUFNLEVBQUU7O0lBRS9CO0lBQ0EsSUFBSSxNQUFNLENBQUMsS0FBSyxHQUFHLFNBQVMsS0FBSyxHQUFHO0lBQ3BDLFFBQVEsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssRUFBRTtJQUNqQyxRQUFRLE9BQU8sT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUM7SUFDdEM7O0lBRUE7SUFDQSxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLEVBQUU7SUFDL0IsUUFBUSxNQUFNLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJO0lBQzlCO0lBQ0EsUUFBUSxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsR0FBRSxDQUFDLENBQUM7SUFDM0Q7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBO0lBQ0E7O0lBRUE7SUFDQSxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLEVBQUU7SUFDL0IsUUFBUSxNQUFNLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHO0lBQzVCOztJQUVB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LE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7SUFDM0IsSUFBSSxPQUFPLGVBQWUsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDO0lBQ3RDOztJQUVBLFNBQVMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDOUIsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsT0FBTztJQUNqQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7SUFDM0IsSUFBSSxPQUFPLGVBQWUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0lBQ3JDOztJQUVBLFNBQVMsSUFBSSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUU7SUFDNUIsSUFBSSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUU7SUFDOUIsUUFBUSxPQUFPLEtBQUssR0FBRyxNQUFNO0lBQzdCLEtBQUs7SUFDTCxJQUFJLE9BQU8sZ0JBQWdCLENBQUMsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDN0M7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7In0=
