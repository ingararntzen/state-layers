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
            this.eventifyDefine("change", {init:true});

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

        set (obj) {
            return Promise.resolve()
                .then(() => {
                    this._object = obj;
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

        // check items to be inserted
        let {insert=[]} = changes;
        changes.insert = check_items(insert);

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

    exports.CollectionProvider = CollectionProvider;
    exports.Cursor = Cursor;
    exports.Layer = Layer;
    exports.NearbyIndexBase = NearbyIndexBase;
    exports.ObjectProvider = ObjectProvider;
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
    exports.object = object;
    exports.playback = playback;
    exports.record = record;
    exports.render_cursor = render_cursor;
    exports.render_provider = render_provider;
    exports.timeline_transform = timeline_transform;

    return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGVsYXllcnMuaWlmZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWwvaW50ZXJ2YWxzLmpzIiwiLi4vLi4vc3JjL25lYXJieV9iYXNlLmpzIiwiLi4vLi4vc3JjL3V0aWwvYXBpX2V2ZW50aWZ5LmpzIiwiLi4vLi4vc3JjL3V0aWwvYXBpX2NhbGxiYWNrLmpzIiwiLi4vLi4vc3JjL3V0aWwvY29tbW9uLmpzIiwiLi4vLi4vc3JjL2xheWVyX2Jhc2UuanMiLCIuLi8uLi9zcmMvdXRpbC9jdXJzb3JfbW9uaXRvci5qcyIsIi4uLy4uL3NyYy9jdXJzb3JfYmFzZS5qcyIsIi4uLy4uL3NyYy9wcm92aWRlcl9jbG9jay5qcyIsIi4uLy4uL3NyYy9wcm92aWRlcl9jb2xsZWN0aW9uLmpzIiwiLi4vLi4vc3JjL3Byb3ZpZGVyX29iamVjdC5qcyIsIi4uLy4uL3NyYy91dGlsL2FwaV9zcmNwcm9wLmpzIiwiLi4vLi4vc3JjL3V0aWwvc29ydGVkYXJyYXkuanMiLCIuLi8uLi9zcmMvbmVhcmJ5X2luZGV4LmpzIiwiLi4vLi4vc3JjL3V0aWwvc2VnbWVudHMuanMiLCIuLi8uLi9zcmMvbGF5ZXJfbGVhZi5qcyIsIi4uLy4uL3NyYy9jdXJzb3JfY2xvY2suanMiLCIuLi8uLi9zcmMvY3Vyc29yX3BsYXliYWNrLmpzIiwiLi4vLi4vc3JjL2N1cnNvcl9vYmplY3QuanMiLCIuLi8uLi9zcmMvb3BzL2xheWVyX2Zyb21fY3Vyc29yLmpzIiwiLi4vLi4vc3JjL29wcy9tZXJnZS5qcyIsIi4uLy4uL3NyYy9vcHMvYm9vbGVhbi5qcyIsIi4uLy4uL3NyYy9vcHMvbG9naWNhbF9tZXJnZS5qcyIsIi4uLy4uL3NyYy9vcHMvdGltZWxpbmVfdHJhbnNmb3JtLmpzIiwiLi4vLi4vc3JjL29wcy90cmFuc2Zvcm0uanMiLCIuLi8uLi9zcmMvb3BzL3JlY29yZC5qcyIsIi4uLy4uL3NyYy91dGlsL3Byb3ZpZGVyX3ZpZXdlci5qcyIsIi4uLy4uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICAgIFxuICAgIElOVEVSVkFMIEVORFBPSU5UU1xuXG4gICAgKiBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIGRlZmluZWQgYnkgdHJpcGxldCBbdmFsdWUsIHR5cGVdXG4gICAgKlxuICAgICogICB0aGVyZSBhcmUgNCB0eXBlcyBvZiBpbnRlcnZhbCBlbmRwb2ludHMgXG4gICAgKiAgIC0gdikgLSBoaWdoIGVuZHBvaW50IGF0IHYsIG5vdCBpbmNsdXNpdmVcbiAgICAqICAgLSB2XSAtIGhpZ2ggZW5kcG9pbnQgYXQgdiwgaW5jbHVzaXZlXG4gICAgKiAgIC0gW3YgLSBsb3cgZW5kcG9pbnQgYXQgdiwgbm90IGluY2x1c2l2ZVxuICAgICogICAtICh2IC0gbG93IGVuZHBvaW50IGF0IHYsIGluY2x1c2l2ZVxuICAgICogXG4gICAgKiAgIEEgc2luZ3VsYXIgaW50ZXJ2YWwgWzIsMix0cnVlLHRydWVdIHdpbGwgaGF2ZSBlbmRwb2ludHMgWzIgYW5kIDJdXG4gICAgKiBcbiAgICAqICAgQWRkaXRpb25hbGx5LCB0byBzaW1wbGlmeSBjb21wYXJpc29uIGJldHdlZW4gZW5kcG9pbnRzIGFuZCBudW1iZXJzXG4gICAgKiAgIHdpIGludHJvZHVjZSBhIHNwZWNpYWwgZW5kcG9pbnQgdHlwZSAtIFZBTFVFXG4gICAgKiBcbiAgICAqICAgVGh1cyB3ZSBkZWZpbmUgNSB0eXBlcyBvZiBlbmRwb2ludHNcbiAgICAqIFxuICAgICogICBISUdIX09QRU4gOiB2KVxuICAgICogICBISUdIX0NMT1NFRDogdl1cbiAgICAqICAgVkFMVUU6IHZcbiAgICAqICAgTE9XX0NMT1NFRDogW3ZcbiAgICAqICAgTE9XX09QRU46ICh2KVxuICAgICogXG4gICAgKiAgIEZvciB0aGUgcHVycG9zZSBvZiBlbmRwb2ludCBjb21wYXJpc29uIHdlIG1haW50YWluXG4gICAgKiAgIGEgbG9naWNhbCBvcmRlcmluZyBmb3IgZW5kcG9pbnRzIHdpdGggdGhlIHNhbWUgdmFsdWUuXG4gICAgKiAgIFxuICAgICogICB2KSA8IFt2ID09IHYgPT0gdl0gPCAodlxuICAgICogIFxuICAgICogICBXZSBhc3NpZ24gb3JkZXJpbmcgdmFsdWVzXG4gICAgKiAgIFxuICAgICogICBISUdIX09QRU46IC0xXG4gICAgKiAgIEhJR0hfQ0xPU0VELCBWQUxVRSwgTE9XX0NMT1NFRDogMFxuICAgICogICBMT1dfT1BFTjogMVxuICAgICogXG4gICAgKiAgIHZhbHVlIGNhbiBiZSBudWxsIG9yIG51bWJlci4gSWYgdmFsdWUgaXMgbnVsbCwgdGhpcyBtZWFucyB1bmJvdW5kZWQgZW5kcG9pbnRcbiAgICAqICAgaS5lLiBubyBvdGhlciBlbmRwb2ludCBjYW4gYmUgbGFyZ2VyIG9yIHNtYWxsZXIuXG4gICAgKiAgIGFuIHVuYm91bmRlZCBsb3cgZW5kcG9pbnQgbWVhbnMgLUluZmluaXR5XG4gICAgKiAgIGFuIHVuYm91bmRlZCBoaWdoIGVuZHBvaW50IG1lYW5zIEluZmluaXR5XG4gICAgKlxuKi9cblxuZnVuY3Rpb24gaXNOdW1iZXIobikge1xuICAgIHJldHVybiB0eXBlb2YgbiA9PSBcIm51bWJlclwiO1xufVxuXG5jb25zdCBFUF9UWVBFID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgSElHSF9PUEVOOiBcIilcIixcbiAgICBISUdIX0NMT1NFRDogXCJdXCIsXG4gICAgVkFMVUU6IFwiXCIsXG4gICAgTE9XX0NMT1NFRDogXCJbXCIsXG4gICAgTE9XX09QRU46IFwiKFwiXG59KTtcblxuZnVuY3Rpb24gaXNfRVBfVFlQRSh2YWx1ZSkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKEVQX1RZUEUpLmluY2x1ZGVzKHZhbHVlKTtcbn1cblxuY29uc3QgRVBfT1JERVIgPSBuZXcgTWFwKFtcbiAgICBbRVBfVFlQRS5ISUdIX09QRU4sIC0xXSxcbiAgICBbRVBfVFlQRS5ISUdIX0NMT1NFRCwgMF0sXG4gICAgW0VQX1RZUEUuVkFMVUUsIDBdLFxuICAgIFtFUF9UWVBFLkxPV19DTE9TRUQsIDBdLFxuICAgIFtFUF9UWVBFLkxPV19PUEVOLCAxXVxuXSk7XG5cbmZ1bmN0aW9uIGVuZHBvaW50X2lzX2xvdyhlcCkge1xuICAgIHJldHVybiBlcFsxXSA9PSBFUF9UWVBFLkxPV19DTE9TRUQgfHwgZXBbMV0gPT0gRVBfVFlQRS5MT1dfT1BFTjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfaXNfaGlnaChlcCkge1xuICAgIHJldHVybiBlcFsxXSA9PSBFUF9UWVBFLkhJR0hfQ0xPU0VEIHx8IGVwWzFdID09IEVQX1RZUEUuSElHSF9PUEVOO1xufVxuXG4vKlxuICAgIHJldHVybiBlbmRwb2ludCBmcm9tIGlucHV0XG4qL1xuZnVuY3Rpb24gZW5kcG9pbnRfZnJvbV9pbnB1dChlcCkge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShlcCkpIHtcbiAgICAgICAgZXAgPSBbZXAsIEVQX1RZUEUuVkFMVUVdO1xuICAgIH1cbiAgICBpZiAoZXAubGVuZ3RoICE9IDIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW5kcG9pbnQgbXVzdCBiZSBhIGxlbmd0aC0yIGFycmF5XCIsIGVwKTtcbiAgICB9XG4gICAgbGV0IFt2LHRdID0gZXA7XG4gICAgaWYgKCFpc19FUF9UWVBFKHQpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIGVuZHBvaW50IHR5cGVcIiwgdCk7XG4gICAgfVxuICAgIGlmICh2ID09IC1JbmZpbml0eSkge1xuICAgICAgICByZXR1cm4gW251bGwsIEVQX1RZUEUuTE9XX0NMT1NFRF07XG4gICAgfVxuICAgIGlmICh2ID09IEluZmluaXR5KSB7XG4gICAgICAgIHJldHVybiBbbnVsbCwgRVBfVFlQRS5ISUdIX0NMT1NFRF07XG4gICAgfVxuICAgIGlmICh2ID09IHVuZGVmaW5lZCB8fCB2ID09IG51bGwgfHwgaXNOdW1iZXIodikpIHtcbiAgICAgICAgcmV0dXJuIFt2LCB0XTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgbXVzdCBiZSBudWxsIG9yIG51bWJlclwiLCB2KTtcbn1cblxuY29uc3QgZW5kcG9pbnRfUE9TX0lORiA9IGVuZHBvaW50X2Zyb21faW5wdXQoSW5maW5pdHkpO1xuY29uc3QgZW5kcG9pbnRfTkVHX0lORiA9IGVuZHBvaW50X2Zyb21faW5wdXQoLUluZmluaXR5KTtcblxuLyoqXG4gKiBJbnRlcm5hbCByZXByZXNlbnRhdGlvbiBcbiAqIHJlcGxhY2luZyBudWxsIHZhbHVzZSB3aXRoIC1JbmZpbml0eSBvciBJbmZpbml0eVxuICogaW4gb3JkZXIgdG8gc2ltcGxpZnkgbnVtZXJpY2FsIGNvbXBhcmlzb25cbiAqL1xuZnVuY3Rpb24gZW5kcG9pbnRfaW50ZXJuYWwoZXApIHtcbiAgICBpZiAoZXBbMF0gIT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gW2VwWzBdLCBlcFsxXV07XG4gICAgfVxuICAgIGlmIChlbmRwb2ludF9pc19sb3coZXApKSB7XG4gICAgICAgIHJldHVybiBbLUluZmluaXR5LCBFUF9UWVBFLkxPV19DTE9TRURdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBbSW5maW5pdHksIEVQX1RZUEUuSElHSF9DTE9TRURdO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDb21wYXJpc29uIGZ1bmN0aW9uIGZvciBudW1iZXJzXG4gKiBhdm9pZCBzdWJ0cmFjdGlvbiB0byBzdXBwb3J0IEluZmluaXR5IHZhbHVlc1xuICovXG5mdW5jdGlvbiBudW1iZXJfY21wKGEsIGIpIHtcbiAgICBpZiAoYSA8IGIpIHJldHVybiAtMTsgLy8gY29ycmVjdCBvcmRlclxuICAgIGlmIChhID4gYikgcmV0dXJuIDE7IC8vIHdyb25nIG9yZGVyXG4gICAgcmV0dXJuIDA7IC8vIGVxdWFsaXR5XG59XG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuKi8gXG5mdW5jdGlvbiBlbmRwb2ludF9jbXAoZXAxLCBlcDIpIHsgICAgXG4gICAgY29uc3QgW3YxLCB0MV0gPSBlbmRwb2ludF9pbnRlcm5hbChlcDEpO1xuICAgIGNvbnN0IFt2MiwgdDJdID0gZW5kcG9pbnRfaW50ZXJuYWwoZXAyKTtcbiAgICBjb25zdCBkaWZmID0gbnVtYmVyX2NtcCh2MSwgdjIpO1xuICAgIGlmIChkaWZmID09IDApIHtcbiAgICAgICAgY29uc3QgbzEgPSBFUF9PUkRFUi5nZXQodDEpO1xuICAgICAgICBjb25zdCBvMiA9IEVQX09SREVSLmdldCh0Mik7XG4gICAgICAgIHJldHVybiBudW1iZXJfY21wKG8xLCBvMik7XG4gICAgfVxuICAgIHJldHVybiBkaWZmO1xufVxuXG5mdW5jdGlvbiBlbmRwb2ludF9sdCAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpIDwgMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfbGUgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9ndCAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpID4gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ2UgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9lcSAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpID09IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X21pbihwMSwgcDIpIHtcbiAgICByZXR1cm4gKGVuZHBvaW50X2xlKHAxLCBwMikpID8gcDEgOiBwMjtcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X21heChwMSwgcDIpIHtcbiAgICByZXR1cm4gKGVuZHBvaW50X2dlKHAxLCBwMikpID8gcDEgOiBwMjtcbn1cblxuLyoqXG4gKiBmbGlwIGVuZHBvaW50OlxuICogLSBpZS4gZ2V0IGFkamFjZW50IGVuZHBvbml0IG9uIHRoZSB0aW1lbGluZVxuICogXG4gKiB2KSA8LT4gW3ZcbiAqIHZdIDwtPiAodlxuICogXG4gKiBmbGlwcGluZyBoYXMgbm8gZWZmZWN0IG9uIGVuZHBvaW50cyB3aXRoIHVuYm91bmRlZCB2YWx1ZVxuICovXG5cbmZ1bmN0aW9uIGVuZHBvaW50X2ZsaXAoZXAsIHRhcmdldCkge1xuICAgIGlmICh0YXJnZXQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwidGFyZ2V0IGlzIGRlcHJlY2F0ZWRcIik7XG4gICAgfVxuICAgIGxldCBbdix0XSA9IGVwO1xuICAgIGlmICh2ID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGVwO1xuICAgIH1cbiAgICBpZiAodCA9PSBFUF9UWVBFLkhJR0hfT1BFTikge1xuICAgICAgICByZXR1cm4gW3YsIEVQX1RZUEUuTE9XX0NMT1NFRF07XG4gICAgfSBlbHNlIGlmICh0ID09IEVQX1RZUEUuSElHSF9DTE9TRUQpIHtcbiAgICAgICAgcmV0dXJuIFt2LCBFUF9UWVBFLkxPV19PUEVOXTtcbiAgICB9IGVsc2UgaWYgKHQgPT0gRVBfVFlQRS5MT1dfT1BFTikge1xuICAgICAgICByZXR1cm4gW3YsIEVQX1RZUEUuSElHSF9DTE9TRURdO1xuICAgIH0gZWxzZSBpZiAodCA9PSBFUF9UWVBFLkxPV19DTE9TRUQpIHtcbiAgICAgICAgcmV0dXJuIFt2LCBFUF9UWVBFLkhJR0hfT1BFTl07XG4gICAgfSBlbHNlIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgZW5kcG9pbnQgdHlwZVwiLCB0KTtcbiAgICB9XG4gICAgcmV0dXJuIHA7XG59XG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBjb25zdCBbbG93LCBoaWdoLCBsb3dDbG9zZWQsIGhpZ2hDbG9zZWRdID0gaXR2O1xuICAgIGNvbnN0IGxvd1R5cGUgPSAobG93Q2xvc2VkKSA/ICBFUF9UWVBFLkxPV19DTE9TRUQgOiBFUF9UWVBFLkxPV19PUEVOO1xuICAgIGNvbnN0IGhpZ2hUeXBlID0gKGhpZ2hDbG9zZWQpID8gIEVQX1RZUEUuSElHSF9DTE9TRUQgOiBFUF9UWVBFLkhJR0hfT1BFTjtcbiAgICBjb25zdCBsb3dFcCA9IGVuZHBvaW50X2Zyb21faW5wdXQoW2xvdywgbG93VHlwZV0pO1xuICAgIGNvbnN0IGhpZ2hFcCA9IGVuZHBvaW50X2Zyb21faW5wdXQoW2hpZ2gsIGhpZ2hUeXBlXSk7XG4gICAgcmV0dXJuIFtsb3dFcCwgaGlnaEVwXTtcbn1cblxuXG4vKlxuICAgIElOVEVSVkFMU1xuXG4gICAgSW50ZXJ2YWxzIGFyZSBbbG93LCBoaWdoLCBsb3dDbG9zZWQsIGhpZ2hDbG9zZWRdXG5cbiovIFxuXG5cbi8qXG4gICAgcmV0dXJuIHRydWUgaWYgcG9pbnQgb3IgZW5kcG9pbnQgaXMgY292ZXJlZCBieSBpbnRlcnZhbFxuICAgIHBvaW50IHAgY2FuIGJlIG51bWJlciB2YWx1ZSBvciBhbiBlbmRwb2ludFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIGVwKSB7XG4gICAgY29uc3QgW2xvd19lcCwgaGlnaF9lcF0gPSBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpO1xuICAgIGVwID0gZW5kcG9pbnRfZnJvbV9pbnB1dChlcCk7XG4gICAgLy8gY292ZXJzOiBsb3cgPD0gcCA8PSBoaWdoXG4gICAgcmV0dXJuIGVuZHBvaW50X2xlKGxvd19lcCwgZXApICYmIGVuZHBvaW50X2xlKGVwLCBoaWdoX2VwKTtcbn1cbi8vIGNvbnZlbmllbmNlXG5mdW5jdGlvbiBpbnRlcnZhbF9jb3ZlcnNfcG9pbnQoaXR2LCBwKSB7XG4gICAgcmV0dXJuIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIHApO1xufVxuXG4vKlxuICAgIFJldHVybiB0cnVlIGlmIGludGVydmFsIGVuZHBvaW50cyBhcmUgZXF1YWxcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9pc19zaW5ndWxhcihpbnRlcnZhbCkge1xuICAgIGNvbnN0IFtsb3dfZXAsIGhpZ2hfZXBdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICByZXR1cm4gZW5kcG9pbnRfZXEobG93X2VwLCBoaWdoX2VwKTtcbn1cblxuLypcbiAgICBDcmVhdGUgaW50ZXJ2YWwgZnJvbSBlbmRwb2ludHNcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyhlcDEsIGVwMikge1xuICAgIGxldCBbdjEsIHQxXSA9IGVwMTtcbiAgICBsZXQgW3YyLCB0Ml0gPSBlcDI7XG4gICAgaWYgKCFlbmRwb2ludF9pc19sb3coZXAxKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2FsIGxvdyBlbmRwb2ludFwiLCBlcDEpO1xuICAgIH1cbiAgICBpZiAoIWVuZHBvaW50X2lzX2hpZ2goZXAyKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2FsIGhpZ2ggZW5kcG9pbnRcIiwgZXAyKTtcbiAgICB9XG4gICAgcmV0dXJuIFt2MSwgdjIsIHQxID09IEVQX1RZUEUuTE9XX0NMT1NFRCwgdDIgPT0gRVBfVFlQRS5ISUdIX0NMT1NFRF07XG59XG5cblxuZnVuY3Rpb24gaW50ZXJ2YWxfZnJvbV9pbnB1dChpbnB1dCl7XG4gICAgbGV0IGl0diA9IGlucHV0O1xuICAgIGlmIChpdHYgPT0gdW5kZWZpbmVkIHx8IGl0diA9PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImlucHV0IGlzIHVuZGVmaW5lZFwiKTtcbiAgICB9XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGl0dikpIHtcbiAgICAgICAgaWYgKGlzTnVtYmVyKGl0dikpIHtcbiAgICAgICAgICAgIC8vIGlucHV0IGlzIHNpbmd1bGFyIG51bWJlclxuICAgICAgICAgICAgaXR2ID0gW2l0diwgaXR2LCB0cnVlLCB0cnVlXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgaW5wdXQ6ICR7aW5wdXR9OiBtdXN0IGJlIEFycmF5IG9yIE51bWJlcmApXG4gICAgICAgIH1cbiAgICB9O1xuICAgIC8vIG1ha2Ugc3VyZSBpbnRlcnZhbCBpcyBsZW5ndGggNFxuICAgIGlmIChpdHYubGVuZ3RoID09IDEpIHtcbiAgICAgICAgaXR2ID0gW2l0dlswXSwgaXR2WzBdLCB0cnVlLCB0cnVlXTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMikge1xuICAgICAgICBpdHYgPSBbaXR2WzBdLCBpdHZbMV0sIHRydWUsIGZhbHNlXTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMykge1xuICAgICAgICBpdHYgPSBbaXR2WzBdLCBpdHZbMV0sIGl0dlsyXSwgZmFsc2VdO1xuICAgIH0gZWxzZSBpZiAoaXR2Lmxlbmd0aCA+IDQpIHtcbiAgICAgICAgaXR2ID0gW2l0dlswXSwgaXR2WzFdLCBpdHZbMl0sIGl0dls0XV07XG4gICAgfVxuICAgIGxldCBbbG93LCBoaWdoLCBsb3dJbmNsdWRlLCBoaWdoSW5jbHVkZV0gPSBpdHY7XG4gICAgLy8gYm91bmRhcnkgY29uZGl0aW9ucyBhcmUgbnVtYmVyIG9yIG51bGxcbiAgICBpZiAobG93ID09IHVuZGVmaW5lZCB8fCBsb3cgPT0gLUluZmluaXR5KSB7XG4gICAgICAgIGxvdyA9IG51bGw7XG4gICAgfVxuICAgIGlmIChoaWdoID09IHVuZGVmaW5lZCB8fCBoaWdoID09IEluZmluaXR5KSB7XG4gICAgICAgIGhpZ2ggPSBudWxsO1xuICAgIH1cbiAgICAvLyBjaGVjayBsb3dcbiAgICBpZiAobG93ID09IG51bGwpIHtcbiAgICAgICAgbG93SW5jbHVkZSA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKCFpc051bWJlcihsb3cpKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgbm90IGEgbnVtYmVyXCIsIGxvdyk7XG4gICAgfVxuICAgIC8vIGNoZWNrIGhpZ2hcbiAgICBpZiAoaGlnaCA9PSBudWxsKSB7XG4gICAgICAgIGhpZ2hJbmNsdWRlID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoIWlzTnVtYmVyKGhpZ2gpKSB0aHJvdyBuZXcgRXJyb3IoXCJoaWdoIG5vdCBhIG51bWJlclwiLCBoaWdoKTtcbiAgICB9ICAgIFxuICAgIC8vIGNoZWNrIHRoYXQgbG93IDw9IGhpZ2hcbiAgICBpZiAobG93ICE9IG51bGwgJiYgaGlnaCAhPSBudWxsKSB7XG4gICAgICAgIGlmIChsb3cgPiBoaWdoKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgPiBoaWdoXCIsIGxvdywgaGlnaCk7XG4gICAgICAgIC8vIHNpbmdsZXRvblxuICAgICAgICBpZiAobG93ID09IGhpZ2gpIHtcbiAgICAgICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgICAgICAgICAgaGlnaEluY2x1ZGUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGUgYXJlIGJvb2xlYW5zXG4gICAgaWYgKHR5cGVvZiBsb3dJbmNsdWRlICE9PSBcImJvb2xlYW5cIikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJsb3dJbmNsdWRlIG5vdCBib29sZWFuXCIpO1xuICAgIH0gXG4gICAgaWYgKHR5cGVvZiBoaWdoSW5jbHVkZSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaGlnaEluY2x1ZGUgbm90IGJvb2xlYW5cIik7XG4gICAgfVxuICAgIHJldHVybiBbbG93LCBoaWdoLCBsb3dJbmNsdWRlLCBoaWdoSW5jbHVkZV07XG59XG5cbmV4cG9ydCBjb25zdCBlbmRwb2ludCA9IHtcbiAgICBsZTogZW5kcG9pbnRfbGUsXG4gICAgbHQ6IGVuZHBvaW50X2x0LFxuICAgIGdlOiBlbmRwb2ludF9nZSxcbiAgICBndDogZW5kcG9pbnRfZ3QsXG4gICAgY21wOiBlbmRwb2ludF9jbXAsXG4gICAgZXE6IGVuZHBvaW50X2VxLFxuICAgIG1pbjogZW5kcG9pbnRfbWluLFxuICAgIG1heDogZW5kcG9pbnRfbWF4LFxuICAgIGZsaXA6IGVuZHBvaW50X2ZsaXAsXG4gICAgZnJvbV9pbnRlcnZhbDogZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwsXG4gICAgZnJvbV9pbnB1dDogZW5kcG9pbnRfZnJvbV9pbnB1dCxcbiAgICB0eXBlczogey4uLkVQX1RZUEV9LFxuICAgIFBPU19JTkYgOiBlbmRwb2ludF9QT1NfSU5GLFxuICAgIE5FR19JTkYgOiBlbmRwb2ludF9ORUdfSU5GXG59XG5leHBvcnQgY29uc3QgaW50ZXJ2YWwgPSB7XG4gICAgY292ZXJzX2VuZHBvaW50OiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQsXG4gICAgY292ZXJzX3BvaW50OiBpbnRlcnZhbF9jb3ZlcnNfcG9pbnQsIFxuICAgIGlzX3Npbmd1bGFyOiBpbnRlcnZhbF9pc19zaW5ndWxhcixcbiAgICBmcm9tX2VuZHBvaW50czogaW50ZXJ2YWxfZnJvbV9lbmRwb2ludHMsXG4gICAgZnJvbV9pbnB1dDogaW50ZXJ2YWxfZnJvbV9pbnB1dFxufVxuIiwiaW1wb3J0IHsgZW5kcG9pbnQsIGludGVydmFsIH0gZnJvbSBcIi4vdXRpbC9pbnRlcnZhbHMuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE5FQVJCWSBJTkRFWFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEFic3RyYWN0IHN1cGVyY2xhc3MgZm9yIE5lYXJieUluZGV4ZS5cbiAqIFxuICogU3VwZXJjbGFzcyB1c2VkIHRvIGNoZWNrIHRoYXQgYSBjbGFzcyBpbXBsZW1lbnRzIHRoZSBuZWFyYnkoKSBtZXRob2QsIFxuICogYW5kIHByb3ZpZGUgc29tZSBjb252ZW5pZW5jZSBtZXRob2RzLlxuICogXG4gKiBORUFSQlkgSU5ERVhcbiAqIFxuICogTmVhcmJ5SW5kZXggcHJvdmlkZXMgaW5kZXhpbmcgc3VwcG9ydCBvZiBlZmZlY3RpdmVseVxuICogbG9va2luZyB1cCByZWdpb25zIGJ5IG9mZnNldCwgXG4gKiBnaXZlbiB0aGF0XG4gKiAoaSkgZWFjaCByZWdpb24gaXMgYXNzb2NpYXRlZCB3aXRoIGFuIGludGVydmFsIGFuZCxcbiAqIChpaSkgcmVnaW9ucyBhcmUgbm9uLW92ZXJsYXBwaW5nLlxuICogXG4gKiBORUFSQllcbiAqIFRoZSBuZWFyYnkgbWV0aG9kIHJldHVybnMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG5laWdoYm9yaG9vZCBcbiAqIGFyb3VuZCBlbmRwb2ludC4gXG4gKiBcbiAqIFJldHVybnMge1xuICogICAgICBjZW50ZXI6IGxpc3Qgb2Ygb2JqZWN0cyBjb3ZlcmVkIGJ5IHJlZ2lvbixcbiAqICAgICAgaXR2OiByZWdpb24gaW50ZXJ2YWwgLSB2YWxpZGl0eSBvZiBjZW50ZXIgXG4gKiAgICAgIGxlZnQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgbGVmdCBcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGhpZ2gtZW5kcG9pbnQgb3IgZW5kcG9pbnQuTkVHX0lORlxuICogICAgICByaWdodDpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSByaWdodFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgbG93LWVuZHBvaW50IG9yIGVuZHRwb2ludC5QT1NfSU5GXG4gKiBcbiAqIFxuICogVGhlIG5lYXJieSBzdGF0ZSBpcyB3ZWxsLWRlZmluZWQgZm9yIGV2ZXJ5IGVuZHBvaW50XG4gKiBvbiB0aGUgdGltZWxpbmUuXG4gKiBcbiAqIElOVEVSVkFMU1xuICogXG4gKiBbbG93LCBoaWdoLCBsb3dJbmNsdXNpdmUsIGhpZ2hJbmNsdXNpdmVdXG4gKiBcbiAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgXG4gKiBhcmUgb3JkZXJlZCBhbmQgYWxsb3dzIGludGVydmFscyB0byBiZSBleGNsdXNpdmUgb3IgaW5jbHVzaXZlLCBcbiAqIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAqIFxuICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG4gKiBcbiAqIFxuICogSU5URVJWQUwgRU5EUE9JTlRTXG4gKiBcbiAqIGludGVydmFsIGVuZHBvaW50cyBhcmUgZGVmaW5lZCBieSBbdmFsdWUsIHR5cGVdLCBmb3IgZXhhbXBsZVxuICogXG4gKiA0KSAtPiBbNCxcIilcIl0gLSBoaWdoIGVuZHBvaW50IGxlZnQgb2YgNFxuICogWzQgLT4gWzQsIFwiW1wiXSAtIGxvdyBlbmRwb2ludCBpbmNsdWRlcyA0XG4gKiA0ICAtPiBbNCwgXCJcIl0gLSB2YWx1ZSA0XG4gKiA0XSAtPiBbNCwgXCJdXCJdIC0gaGlnaCBlbmRwb2ludCBpbmNsdWRlcyA0XG4gKiAoNCAtPiBbNCwgXCIoXCJdIC0gbG93IGVuZHBvaW50IGlzIHJpZ2h0IG9mIDRcbiAqIFxuICovXG5cblxuLyoqXG4gKiByZXR1cm4gZmlyc3QgaGlnaCBlbmRwb2ludCBvbiB0aGUgbGVmdCBmcm9tIG5lYXJieSxcbiAqIHdoaWNoIGlzIG5vdCBpbiBjZW50ZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxlZnRfZW5kcG9pbnQgKG5lYXJieSkge1xuICAgIGNvbnN0IGxvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmVhcmJ5Lml0dilbMF07XG4gICAgcmV0dXJuIGVuZHBvaW50LmZsaXAobG93KTtcbn1cblxuLyoqXG4gKiByZXR1cm4gZmlyc3QgbG93IGVuZHBvaW50IG9uIHRoZSByaWdodCBmcm9tIG5lYXJieSxcbiAqIHdoaWNoIGlzIG5vdCBpbiBjZW50ZXJcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gcmlnaHRfZW5kcG9pbnQgKG5lYXJieSkge1xuICAgIGNvbnN0IGhpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5lYXJieS5pdHYpWzFdO1xuICAgIHJldHVybiBlbmRwb2ludC5mbGlwKGhpZ2gpO1xufVxuXG5cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4QmFzZSB7XG5cblxuICAgIC8qIFxuICAgICAgICBOZWFyYnkgbWV0aG9kXG4gICAgKi9cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICBlbXB0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmlyc3QoKSA9PSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGxvdyBwb2ludCBvZiBsZWZ0bW9zdCBlbnRyeVxuICAgICovXG4gICAgZmlyc3QoKSB7XG4gICAgICAgIGxldCB7Y2VudGVyLCByaWdodH0gPSB0aGlzLm5lYXJieShlbmRwb2ludC5ORUdfSU5GKTtcbiAgICAgICAgaWYgKGNlbnRlci5sZW5ndGggPiAwICkge1xuICAgICAgICAgICAgcmV0dXJuIGVuZHBvaW50Lk5FR19JTkY7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVuZHBvaW50Lmx0KHJpZ2h0LCBlbmRwb2ludC5QT1NfSU5GKSkge1xuICAgICAgICAgICAgcmV0dXJuIHJpZ2h0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZW1wdHlcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICByZXR1cm4gaGlnaCBwb2ludCBvZiByaWdodG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGxhc3QoKSB7XG4gICAgICAgIGxldCB7bGVmdCwgY2VudGVyfSA9IHRoaXMubmVhcmJ5KGVuZHBvaW50LlBPU19JTkYpO1xuICAgICAgICBpZiAoY2VudGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHJldHVybiBlbmRwb2ludC5QT1NfSU5GO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlbmRwb2ludC5ndChsZWZ0LCBlbmRwb2ludC5ORUdfSU5GKSkge1xuICAgICAgICAgICAgcmV0dXJuIGxlZnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBlbXB0eVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIG5lYXJieSBvZiBmaXJzdCByZWdpb24gdG8gdGhlIHJpZ2h0XG4gICAgICogd2hpY2ggaXMgbm90IHRoZSBjZW50ZXIgcmVnaW9uLiBJZiBub3QgZXhpc3RzLCByZXR1cm5cbiAgICAgKiB1bmRlZmluZWQuIFxuICAgICAqL1xuICAgIHJpZ2h0X3JlZ2lvbihuZWFyYnkpIHtcbiAgICAgICAgY29uc3QgcmlnaHQgPSByaWdodF9lbmRwb2ludChuZWFyYnkpO1xuICAgICAgICBpZiAocmlnaHRbMF0gPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5uZWFyYnkocmlnaHQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJldHVybiBuZWFyYnkgb2YgZmlyc3QgcmVnaW9uIHRvIHRoZSBsZWZ0XG4gICAgICogd2hpY2ggaXMgbm90IHRoZSBjZW50ZXIgcmVnaW9uLiBJZiBub3QgZXhpc3RzLCByZXR1cm5cbiAgICAgKiB1bmRlZmluZWQuIFxuICAgICAqL1xuICAgIGxlZnRfcmVnaW9uKG5lYXJieSkge1xuICAgICAgICBjb25zdCBsZWZ0ID0gbGVmdF9lbmRwb2ludChuZWFyYnkpO1xuICAgICAgICBpZiAobGVmdFswXSA9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm5lYXJieShsZWZ0KTsgICAgXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogZmluZCBmaXJzdCByZWdpb24gdG8gdGhlIFwicmlnaHRcIiBvciBcImxlZnRcIlxuICAgICAqIHdoaWNoIGlzIG5vdCB0aGUgY2VudGVyIHJlZ2lvbiwgYW5kIHdoaWNoIG1lZXRzXG4gICAgICogYSBjb25kaXRpb24gb24gbmVhcmJ5LmNlbnRlci5cbiAgICAgKiBEZWZhdWx0IGNvbmRpdGlvbiBpcyBjZW50ZXIgbm9uLWVtcHR5XG4gICAgICogSWYgbm90IGV4aXN0cywgcmV0dXJuIHVuZGVmaW5lZC4gXG4gICAgICovXG4gICAgXG4gICAgZmluZF9yZWdpb24obmVhcmJ5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIGxldCB7XG4gICAgICAgICAgICBkaXJlY3Rpb24gPSAxLFxuICAgICAgICAgICAgY29uZGl0aW9uID0gKGNlbnRlcikgPT4gY2VudGVyLmxlbmd0aCA+IDBcbiAgICAgICAgfSA9IG9wdGlvbnM7XG4gICAgICAgIGxldCBuZXh0X25lYXJieTtcbiAgICAgICAgd2hpbGUodHJ1ZSkge1xuICAgICAgICAgICAgaWYgKGRpcmVjdGlvbiA9PSAxKSB7XG4gICAgICAgICAgICAgICAgbmV4dF9uZWFyYnkgPSB0aGlzLnJpZ2h0X3JlZ2lvbihuZWFyYnkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXh0X25lYXJieSA9IHRoaXMubGVmdF9yZWdpb24obmVhcmJ5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChuZXh0X25lYXJieSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNvbmRpdGlvbihuZXh0X25lYXJieS5jZW50ZXIpKSB7XG4gICAgICAgICAgICAgICAgLy8gZm91bmQgcmVnaW9uIFxuICAgICAgICAgICAgICAgIHJldHVybiBuZXh0X25lYXJieTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHJlZ2lvbiBub3QgZm91bmRcbiAgICAgICAgICAgIC8vIGNvbnRpbnVlIHNlYXJjaGluZyB0aGUgcmlnaHRcbiAgICAgICAgICAgIG5lYXJieSA9IG5leHRfbmVhcmJ5O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVnaW9ucyhvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVnaW9uSXRlcmF0b3IodGhpcywgb3B0aW9ucyk7XG4gICAgfVxuXG59XG5cblxuLypcbiAgICBJdGVyYXRlIHJlZ2lvbnMgb2YgaW5kZXggZnJvbSBsZWZ0IHRvIHJpZ2h0XG5cbiAgICBJdGVyYXRpb24gbGltaXRlZCB0byBpbnRlcnZhbCBbc3RhcnQsIHN0b3BdIG9uIHRoZSB0aW1lbGluZS5cbiAgICBSZXR1cm5zIGxpc3Qgb2YgaXRlbS1saXN0cy5cbiAgICBvcHRpb25zXG4gICAgLSBzdGFydFxuICAgIC0gc3RvcFxuICAgIC0gaW5jbHVkZUVtcHR5XG4qL1xuXG5jbGFzcyBSZWdpb25JdGVyYXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbmRleCwgb3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge1xuICAgICAgICAgICAgc3RhcnQ9LUluZmluaXR5LCBcbiAgICAgICAgICAgIHN0b3A9SW5maW5pdHksIFxuICAgICAgICAgICAgaW5jbHVkZUVtcHR5PXRydWVcbiAgICAgICAgfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzdGFydCA+IHN0b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciAoXCJzdG9wIG11c3QgYmUgbGFyZ2VyIHRoYW4gc3RhcnRcIiwgc3RhcnQsIHN0b3ApXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faW5kZXggPSBpbmRleDtcbiAgICAgICAgdGhpcy5fc3RhcnQgPSBlbmRwb2ludC5mcm9tX2lucHV0KHN0YXJ0KTtcbiAgICAgICAgdGhpcy5fc3RvcCA9IGVuZHBvaW50LmZyb21faW5wdXQoc3RvcCk7XG5cbiAgICAgICAgaWYgKGluY2x1ZGVFbXB0eSkge1xuICAgICAgICAgICAgdGhpcy5fY29uZGl0aW9uID0gKCkgPT4gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbmRpdGlvbiA9IChjZW50ZXIpID0+IGNlbnRlci5sZW5ndGggPiAwO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2N1cnJlbnQ7XG4gICAgfVxuXG4gICAgbmV4dCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBpbml0aWFsc2VcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnQgPSB0aGlzLl9pbmRleC5uZWFyYnkodGhpcy5fc3RhcnQpO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NvbmRpdGlvbih0aGlzLl9jdXJyZW50LmNlbnRlcikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge3ZhbHVlOnRoaXMuX2N1cnJlbnQsIGRvbmU6ZmFsc2V9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGxldCBvcHRpb25zID0ge2NvbmRpdGlvbjp0aGlzLl9jb25kaXRpb24sIGRpcmVjdGlvbjoxfVxuICAgICAgICB0aGlzLl9jdXJyZW50ID0gdGhpcy5faW5kZXguZmluZF9yZWdpb24odGhpcy5fY3VycmVudCwgb3B0aW9ucyk7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZTp1bmRlZmluZWQsIGRvbmU6dHJ1ZX07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4ge3ZhbHVlOnRoaXMuX2N1cnJlbnQsIGRvbmU6ZmFsc2V9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufVxuXG4vKipcbiAqIG5lYXJieV9mcm9tXG4gKiBcbiAqIHV0aWxpdHkgZnVuY3Rpb24gZm9yIGNyZWF0aW5nIGEgbmVhcmJ5IG9iamVjdCBpbiBjaXJjdW1zdGFuY2VzXG4gKiB3aGVyZSB0aGVyZSBhcmUgb3ZlcmxhcHBpbmcgaW50ZXJ2YWxzIFRoaXMgY291bGQgYmUgd2hlbiBhIFxuICogc3RhdGVwcm92aWRlciBmb3IgYSBsYXllciBoYXMgb3ZlcmxhcHBpbmcgaXRlbXMgb3Igd2hlbiBcbiAqIG11bHRpcGxlIG5lYXJieSBpbmRleGVzIGFyZSBtZXJnZWQgaW50byBvbmUuXG4gKiBcbiAqIFxuICogQHBhcmFtIHsqfSBwcmV2X2hpZ2ggOiB0aGUgcmlnaHRtb3N0IGhpZ2gtZW5kcG9pbnQgbGVmdCBvZiBvZmZzZXRcbiAqIEBwYXJhbSB7Kn0gY2VudGVyX2xvd19saXN0IDogbG93LWVuZHBvaW50cyBvZiBjZW50ZXJcbiAqIEBwYXJhbSB7Kn0gY2VudGVyIDogY2VudGVyXG4gKiBAcGFyYW0geyp9IGNlbnRlcl9oaWdoX2xpc3QgOiBoaWdoLWVuZHBvaW50cyBvZiBjZW50ZXJcbiAqIEBwYXJhbSB7Kn0gbmV4dF9sb3cgOiB0aGUgbGVmdG1vc3QgbG93LWVuZHBvaW50IHJpZ2h0IG9mIG9mZnNldFxuICogQHJldHVybnMgXG4gKi9cblxuZnVuY3Rpb24gY21wX2FzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAxLCBwMilcbn1cblxuZnVuY3Rpb24gY21wX2Rlc2NlbmRpbmcocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmNtcChwMiwgcDEpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuZWFyYnlfZnJvbSAoXG4gICAgcHJldl9oaWdoLCBcbiAgICBjZW50ZXJfbG93X2xpc3QsIFxuICAgIGNlbnRlcixcbiAgICBjZW50ZXJfaGlnaF9saXN0LFxuICAgIG5leHRfbG93KSB7XG5cbiAgICAvLyBuZWFyYnlcbiAgICBjb25zdCByZXN1bHQgPSB7Y2VudGVyfTtcblxuICAgIGlmIChjZW50ZXIubGVuZ3RoID09IDApIHtcbiAgICAgICAgLy8gZW1wdHkgY2VudGVyXG4gICAgICAgIHJlc3VsdC5yaWdodCA9IG5leHRfbG93O1xuICAgICAgICByZXN1bHQubGVmdCA9IHByZXZfaGlnaDtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBub24tZW1wdHkgY2VudGVyXG4gICAgICAgIFxuICAgICAgICAvLyBjZW50ZXIgaGlnaFxuICAgICAgICBjZW50ZXJfaGlnaF9saXN0LnNvcnQoY21wX2FzY2VuZGluZyk7XG4gICAgICAgIGxldCBtaW5fY2VudGVyX2hpZ2ggPSBjZW50ZXJfaGlnaF9saXN0WzBdO1xuICAgICAgICBsZXQgbWF4X2NlbnRlcl9oaWdoID0gY2VudGVyX2hpZ2hfbGlzdC5zbGljZSgtMSlbMF07XG4gICAgICAgIGxldCBtdWx0aXBsZV9jZW50ZXJfaGlnaCA9ICFlbmRwb2ludC5lcShtaW5fY2VudGVyX2hpZ2gsIG1heF9jZW50ZXJfaGlnaClcblxuICAgICAgICAvLyBjZW50ZXIgbG93XG4gICAgICAgIGNlbnRlcl9sb3dfbGlzdC5zb3J0KGNtcF9kZXNjZW5kaW5nKTtcbiAgICAgICAgbGV0IG1heF9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0WzBdO1xuICAgICAgICBsZXQgbWluX2NlbnRlcl9sb3cgPSBjZW50ZXJfbG93X2xpc3Quc2xpY2UoLTEpWzBdO1xuICAgICAgICBsZXQgbXVsdGlwbGVfY2VudGVyX2xvdyA9ICFlbmRwb2ludC5lcShtYXhfY2VudGVyX2xvdywgbWluX2NlbnRlcl9sb3cpXG5cbiAgICAgICAgLy8gbmV4dC9yaWdodFxuICAgICAgICBpZiAoZW5kcG9pbnQubGUobmV4dF9sb3csIG1pbl9jZW50ZXJfaGlnaCkpIHtcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IG5leHRfbG93O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gZW5kcG9pbnQuZmxpcChtaW5fY2VudGVyX2hpZ2gpXG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0Lm5leHQgPSAobXVsdGlwbGVfY2VudGVyX2hpZ2gpID8gcmVzdWx0LnJpZ2h0IDogbmV4dF9sb3c7XG5cbiAgICAgICAgLy8gcHJldi9sZWZ0XG4gICAgICAgIGlmIChlbmRwb2ludC5nZShwcmV2X2hpZ2gsIG1heF9jZW50ZXJfbG93KSkge1xuICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSBwcmV2X2hpZ2g7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IGVuZHBvaW50LmZsaXAobWF4X2NlbnRlcl9sb3cpO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5wcmV2ID0gKG11bHRpcGxlX2NlbnRlcl9sb3cpID8gcmVzdWx0LmxlZnQgOiBwcmV2X2hpZ2g7XG5cbiAgICB9XG5cbiAgICAvLyBpbnRlcnZhbCBmcm9tIGxlZnQvcmlnaHRcbiAgICBsZXQgbG93ID0gZW5kcG9pbnQuZmxpcChyZXN1bHQubGVmdCk7XG4gICAgbGV0IGhpZ2ggPSBlbmRwb2ludC5mbGlwKHJlc3VsdC5yaWdodCk7XG4gICAgcmVzdWx0Lml0diA9IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5cbi8qKlxuICogQ3JlYXRlIGEgTmVhcmJ5SW5kZXggZm9yIGEgc3JjIG9iamVjdCBMYXllci5cbiAqIFxuICogVGhlIHNyYyBvYmplY3QgcmVzb2x2ZXMgcXVlcmllcyBmb3IgdGhlIGVudGlyZSB0aW1lbGluZS5cbiAqIEluIG9yZGVyIGZvciB0aGUgZGVmYXVsdCBMYXllckNhY2hlIHRvIHdvcmssIGFuXG4gKiBvYmplY3Qgd2l0aCBhIC5xdWVyeShvZmZzZXQpIG1ldGhvZCBpcyBuZWVkZWQgaW4gXG4gKiBuZWFyYnkuY2VudGVyLlxuICovXG5cbmV4cG9ydCBjbGFzcyBOZWFyYnlJbmRleFNyYyBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihzcmMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fc3JjID0gc3JjO1xuICAgICAgICB0aGlzLl9jYWNoZSA9IHNyYy5jcmVhdGVDYWNoZSgpO1xuICAgIH1cblxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgY29uc3QgbmVhcmJ5ID0gdGhpcy5fc3JjLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICBuZWFyYnkuY2VudGVyID0gW3RoaXMuX2NhY2hlXTtcbiAgICAgICAgcmV0dXJuIG5lYXJieTtcbiAgICB9XG59XG4iLCIvKlxuXHRDb3B5cmlnaHQgMjAyMFxuXHRBdXRob3IgOiBJbmdhciBBcm50emVuXG5cblx0VGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFRpbWluZ3NyYyBtb2R1bGUuXG5cblx0VGltaW5nc3JjIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnlcblx0aXQgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5XG5cdHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yXG5cdChhdCB5b3VyIG9wdGlvbikgYW55IGxhdGVyIHZlcnNpb24uXG5cblx0VGltaW5nc3JjIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsXG5cdGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mXG5cdE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS4gIFNlZSB0aGVcblx0R05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG5cblx0WW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlXG5cdGFsb25nIHdpdGggVGltaW5nc3JjLiAgSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+LlxuKi9cblxuXG5cbi8qXG5cdEV2ZW50XG5cdC0gbmFtZTogZXZlbnQgbmFtZVxuXHQtIHB1Ymxpc2hlcjogdGhlIG9iamVjdCB3aGljaCBkZWZpbmVkIHRoZSBldmVudFxuXHQtIGluaXQ6IHRydWUgaWYgdGhlIGV2ZW50IHN1cHBwb3J0cyBpbml0IGV2ZW50c1xuXHQtIHN1YnNjcmlwdGlvbnM6IHN1YnNjcmlwdGlucyB0byB0aGlzIGV2ZW50XG5cbiovXG5cbmNsYXNzIEV2ZW50IHtcblxuXHRjb25zdHJ1Y3RvciAocHVibGlzaGVyLCBuYW1lLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLnB1Ymxpc2hlciA9IHB1Ymxpc2hlcjtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMuaW5pdCA9IChvcHRpb25zLmluaXQgPT09IHVuZGVmaW5lZCkgPyBmYWxzZSA6IG9wdGlvbnMuaW5pdDtcblx0XHR0aGlzLnN1YnNjcmlwdGlvbnMgPSBbXTtcblx0fVxuXG5cdC8qXG5cdFx0c3Vic2NyaWJlIHRvIGV2ZW50XG5cdFx0LSBzdWJzY3JpYmVyOiBzdWJzY3JpYmluZyBvYmplY3Rcblx0XHQtIGNhbGxiYWNrOiBjYWxsYmFjayBmdW5jdGlvbiB0byBpbnZva2Vcblx0XHQtIG9wdGlvbnM6XG5cdFx0XHRpbml0OiBpZiB0cnVlIHN1YnNjcmliZXIgd2FudHMgaW5pdCBldmVudHNcblx0Ki9cblx0c3Vic2NyaWJlIChjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdGlmICghY2FsbGJhY2sgfHwgdHlwZW9mIGNhbGxiYWNrICE9PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIG5vdCBhIGZ1bmN0aW9uXCIsIGNhbGxiYWNrKTtcblx0XHR9XG5cdFx0Y29uc3Qgc3ViID0gbmV3IFN1YnNjcmlwdGlvbih0aGlzLCBjYWxsYmFjaywgb3B0aW9ucyk7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zLnB1c2goc3ViKTtcblx0ICAgIC8vIEluaXRpYXRlIGluaXQgY2FsbGJhY2sgZm9yIHRoaXMgc3Vic2NyaXB0aW9uXG5cdCAgICBpZiAodGhpcy5pbml0ICYmIHN1Yi5pbml0KSB7XG5cdCAgICBcdHN1Yi5pbml0X3BlbmRpbmcgPSB0cnVlO1xuXHQgICAgXHRsZXQgc2VsZiA9IHRoaXM7XG5cdCAgICBcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgXHRcdGNvbnN0IGVBcmdzID0gc2VsZi5wdWJsaXNoZXIuZXZlbnRpZnlJbml0RXZlbnRBcmdzKHNlbGYubmFtZSkgfHwgW107XG5cdCAgICBcdFx0c3ViLmluaXRfcGVuZGluZyA9IGZhbHNlO1xuXHQgICAgXHRcdGZvciAobGV0IGVBcmcgb2YgZUFyZ3MpIHtcblx0ICAgIFx0XHRcdHNlbGYudHJpZ2dlcihlQXJnLCBbc3ViXSwgdHJ1ZSk7XG5cdCAgICBcdFx0fVxuXHQgICAgXHR9KTtcblx0ICAgIH1cblx0XHRyZXR1cm4gc3ViXG5cdH1cblxuXHQvKlxuXHRcdHRyaWdnZXIgZXZlbnRcblxuXHRcdC0gaWYgc3ViIGlzIHVuZGVmaW5lZCAtIHB1Ymxpc2ggdG8gYWxsIHN1YnNjcmlwdGlvbnNcblx0XHQtIGlmIHN1YiBpcyBkZWZpbmVkIC0gcHVibGlzaCBvbmx5IHRvIGdpdmVuIHN1YnNjcmlwdGlvblxuXHQqL1xuXHR0cmlnZ2VyIChlQXJnLCBzdWJzLCBpbml0KSB7XG5cdFx0bGV0IGVJbmZvLCBjdHg7XG5cdFx0Zm9yIChjb25zdCBzdWIgb2Ygc3Vicykge1xuXHRcdFx0Ly8gaWdub3JlIHRlcm1pbmF0ZWQgc3Vic2NyaXB0aW9uc1xuXHRcdFx0aWYgKHN1Yi50ZXJtaW5hdGVkKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0ZUluZm8gPSB7XG5cdFx0XHRcdHNyYzogdGhpcy5wdWJsaXNoZXIsXG5cdFx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdFx0c3ViOiBzdWIsXG5cdFx0XHRcdGluaXQ6IGluaXRcblx0XHRcdH1cblx0XHRcdGN0eCA9IHN1Yi5jdHggfHwgdGhpcy5wdWJsaXNoZXI7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzdWIuY2FsbGJhY2suY2FsbChjdHgsIGVBcmcsIGVJbmZvKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgRXJyb3IgaW4gJHt0aGlzLm5hbWV9OiAke3N1Yi5jYWxsYmFja30gJHtlcnJ9YCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0dW5zdWJzY3JpYmUgZnJvbSBldmVudFxuXHQtIHVzZSBzdWJzY3JpcHRpb24gcmV0dXJuZWQgYnkgcHJldmlvdXMgc3Vic2NyaWJlXG5cdCovXG5cdHVuc3Vic2NyaWJlKHN1Yikge1xuXHRcdGxldCBpZHggPSB0aGlzLnN1YnNjcmlwdGlvbnMuaW5kZXhPZihzdWIpO1xuXHRcdGlmIChpZHggPiAtMSkge1xuXHRcdFx0dGhpcy5zdWJzY3JpcHRpb25zLnNwbGljZShpZHgsIDEpO1xuXHRcdFx0c3ViLnRlcm1pbmF0ZSgpO1xuXHRcdH1cblx0fVxufVxuXG5cbi8qXG5cdFN1YnNjcmlwdGlvbiBjbGFzc1xuKi9cblxuY2xhc3MgU3Vic2NyaXB0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcihldmVudCwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXHRcdHRoaXMuZXZlbnQgPSBldmVudDtcblx0XHR0aGlzLm5hbWUgPSBldmVudC5uYW1lO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFja1xuXHRcdHRoaXMuaW5pdCA9IChvcHRpb25zLmluaXQgPT09IHVuZGVmaW5lZCkgPyB0aGlzLmV2ZW50LmluaXQgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSBmYWxzZTtcblx0XHR0aGlzLmN0eCA9IG9wdGlvbnMuY3R4O1xuXHR9XG5cblx0dGVybWluYXRlKCkge1xuXHRcdHRoaXMudGVybWluYXRlZCA9IHRydWU7XG5cdFx0dGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmV2ZW50LnVuc3Vic2NyaWJlKHRoaXMpO1xuXHR9XG59XG5cblxuLypcblxuXHRFVkVOVElGWSBJTlNUQU5DRVxuXG5cdEV2ZW50aWZ5IGJyaW5ncyBldmVudGluZyBjYXBhYmlsaXRpZXMgdG8gYW55IG9iamVjdC5cblxuXHRJbiBwYXJ0aWN1bGFyLCBldmVudGlmeSBzdXBwb3J0cyB0aGUgaW5pdGlhbC1ldmVudCBwYXR0ZXJuLlxuXHRPcHQtaW4gZm9yIGluaXRpYWwgZXZlbnRzIHBlciBldmVudCB0eXBlLlxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cbiovXG5cbmV4cG9ydCBmdW5jdGlvbiBldmVudGlmeUluc3RhbmNlIChvYmplY3QpIHtcblx0b2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAgPSBuZXcgTWFwKCk7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRyZXR1cm4gb2JqZWN0O1xufTtcblxuXG4vKlxuXHRFVkVOVElGWSBQUk9UT1RZUEVcblxuXHRBZGQgZXZlbnRpZnkgZnVuY3Rpb25hbGl0eSB0byBwcm90b3R5cGUgb2JqZWN0XG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlQcm90b3R5cGUoX3Byb3RvdHlwZSkge1xuXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5R2V0RXZlbnQob2JqZWN0LCBuYW1lKSB7XG5cdFx0Y29uc3QgZXZlbnQgPSBvYmplY3QuX19ldmVudGlmeV9ldmVudE1hcC5nZXQobmFtZSk7XG5cdFx0aWYgKGV2ZW50ID09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRXZlbnQgdW5kZWZpbmVkXCIsIG5hbWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gZXZlbnQ7XG5cdH1cblxuXHQvKlxuXHRcdERFRklORSBFVkVOVFxuXHRcdC0gdXNlZCBvbmx5IGJ5IGV2ZW50IHNvdXJjZVxuXHRcdC0gbmFtZTogbmFtZSBvZiBldmVudFxuXHRcdC0gb3B0aW9uczoge2luaXQ6dHJ1ZX0gc3BlY2lmaWVzIGluaXQtZXZlbnQgc2VtYW50aWNzIGZvciBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeURlZmluZShuYW1lLCBvcHRpb25zKSB7XG5cdFx0Ly8gY2hlY2sgdGhhdCBldmVudCBkb2VzIG5vdCBhbHJlYWR5IGV4aXN0XG5cdFx0aWYgKHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5oYXMobmFtZSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IGFscmVhZHkgZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2V2ZW50TWFwLnNldChuYW1lLCBuZXcgRXZlbnQodGhpcywgbmFtZSwgb3B0aW9ucykpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T05cblx0XHQtIHVzZWQgYnkgc3Vic2NyaWJlclxuXHRcdHJlZ2lzdGVyIGNhbGxiYWNrIG9uIGV2ZW50LlxuXHQqL1xuXHRmdW5jdGlvbiBvbihuYW1lLCBjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmliZShjYWxsYmFjaywgb3B0aW9ucyk7XG5cdH07XG5cblx0Lypcblx0XHRPRkZcblx0XHQtIHVzZWQgYnkgc3Vic2NyaWJlclxuXHRcdFVuLXJlZ2lzdGVyIGEgaGFuZGxlciBmcm9tIGEgc3BlY2ZpYyBldmVudCB0eXBlXG5cdCovXG5cdGZ1bmN0aW9uIG9mZihzdWIpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBzdWIubmFtZSkudW5zdWJzY3JpYmUoc3ViKTtcblx0fTtcblxuXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5U3Vic2NyaXB0aW9ucyhuYW1lKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSkuc3Vic2NyaXB0aW9ucztcblx0fVxuXG5cblxuXHQvKlxuXHRcdFRyaWdnZXIgbGlzdCBvZiBldmVudEl0ZW1zIG9uIG9iamVjdFxuXG5cdFx0ZXZlbnRJdGVtOiAge25hbWU6Li4sIGVBcmc6Li59XG5cblx0XHRjb3B5IGFsbCBldmVudEl0ZW1zIGludG8gYnVmZmVyLlxuXHRcdHJlcXVlc3QgZW1wdHlpbmcgdGhlIGJ1ZmZlciwgaS5lLiBhY3R1YWxseSB0cmlnZ2VyaW5nIGV2ZW50cyxcblx0XHRldmVyeSB0aW1lIHRoZSBidWZmZXIgZ29lcyBmcm9tIGVtcHR5IHRvIG5vbi1lbXB0eVxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXJBbGwoZXZlbnRJdGVtcykge1xuXHRcdGlmIChldmVudEl0ZW1zLmxlbmd0aCA9PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gbWFrZSB0cmlnZ2VyIGl0ZW1zXG5cdFx0Ly8gcmVzb2x2ZSBub24tcGVuZGluZyBzdWJzY3JpcHRpb25zIG5vd1xuXHRcdC8vIGVsc2Ugc3Vic2NyaXB0aW9ucyBtYXkgY2hhbmdlIGZyb20gcGVuZGluZyB0byBub24tcGVuZGluZ1xuXHRcdC8vIGJldHdlZW4gaGVyZSBhbmQgYWN0dWFsIHRyaWdnZXJpbmdcblx0XHQvLyBtYWtlIGxpc3Qgb2YgW2V2LCBlQXJnLCBzdWJzXSB0dXBsZXNcblx0XHRsZXQgdHJpZ2dlckl0ZW1zID0gZXZlbnRJdGVtcy5tYXAoKGl0ZW0pID0+IHtcblx0XHRcdGxldCB7bmFtZSwgZUFyZ30gPSBpdGVtO1xuXHRcdFx0bGV0IGV2ID0gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKTtcblx0XHRcdGxldCBzdWJzID0gZXYuc3Vic2NyaXB0aW9ucy5maWx0ZXIoc3ViID0+IHN1Yi5pbml0X3BlbmRpbmcgPT0gZmFsc2UpO1xuXHRcdFx0cmV0dXJuIFtldiwgZUFyZywgc3Vic107XG5cdFx0fSwgdGhpcyk7XG5cblx0XHQvLyBhcHBlbmQgdHJpZ2dlciBJdGVtcyB0byBidWZmZXJcblx0XHRjb25zdCBsZW4gPSB0cmlnZ2VySXRlbXMubGVuZ3RoO1xuXHRcdGNvbnN0IGJ1ZiA9IHRoaXMuX19ldmVudGlmeV9idWZmZXI7XG5cdFx0Y29uc3QgYnVmX2xlbiA9IHRoaXMuX19ldmVudGlmeV9idWZmZXIubGVuZ3RoO1xuXHRcdC8vIHJlc2VydmUgbWVtb3J5IC0gc2V0IG5ldyBsZW5ndGhcblx0XHR0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aCA9IGJ1Zl9sZW4gKyBsZW47XG5cdFx0Ly8gY29weSB0cmlnZ2VySXRlbXMgdG8gYnVmZmVyXG5cdFx0Zm9yIChsZXQgaT0wOyBpPGxlbjsgaSsrKSB7XG5cdFx0XHRidWZbYnVmX2xlbitpXSA9IHRyaWdnZXJJdGVtc1tpXTtcblx0XHR9XG5cdFx0Ly8gcmVxdWVzdCBlbXB0eWluZyBvZiB0aGUgYnVmZmVyXG5cdFx0aWYgKGJ1Zl9sZW4gPT0gMCkge1xuXHRcdFx0bGV0IHNlbGYgPSB0aGlzO1xuXHRcdFx0UHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0Zm9yIChsZXQgW2V2LCBlQXJnLCBzdWJzXSBvZiBzZWxmLl9fZXZlbnRpZnlfYnVmZmVyKSB7XG5cdFx0XHRcdFx0Ly8gYWN0dWFsIGV2ZW50IHRyaWdnZXJpbmdcblx0XHRcdFx0XHRldi50cmlnZ2VyKGVBcmcsIHN1YnMsIGZhbHNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxmLl9fZXZlbnRpZnlfYnVmZmVyID0gW107XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHQvKlxuXHRcdFRyaWdnZXIgbXVsdGlwbGUgZXZlbnRzIG9mIHNhbWUgdHlwZSAobmFtZSlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxpa2UobmFtZSwgZUFyZ3MpIHtcblx0XHRyZXR1cm4gdGhpcy5ldmVudGlmeVRyaWdnZXJBbGwoZUFyZ3MubWFwKGVBcmcgPT4ge1xuXHRcdFx0cmV0dXJuIHtuYW1lLCBlQXJnfTtcblx0XHR9KSk7XG5cdH1cblxuXHQvKlxuXHRcdFRyaWdnZXIgc2luZ2xlIGV2ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlcihuYW1lLCBlQXJnKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKFt7bmFtZSwgZUFyZ31dKTtcblx0fVxuXG5cdF9wcm90b3R5cGUuZXZlbnRpZnlEZWZpbmUgPSBldmVudGlmeURlZmluZTtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXIgPSBldmVudGlmeVRyaWdnZXI7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxpa2UgPSBldmVudGlmeVRyaWdnZXJBbGlrZTtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXJBbGwgPSBldmVudGlmeVRyaWdnZXJBbGw7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlTdWJzY3JpcHRpb25zID0gZXZlbnRpZnlTdWJzY3JpcHRpb25zO1xuXHRfcHJvdG90eXBlLm9uID0gb247XG5cdF9wcm90b3R5cGUub2ZmID0gb2ZmO1xufTtcblxuXG5leHBvcnQge2V2ZW50aWZ5SW5zdGFuY2UgYXMgYWRkU3RhdGV9O1xuZXhwb3J0IHtldmVudGlmeVByb3RvdHlwZSBhcyBhZGRNZXRob2RzfTtcblxuLypcblx0RXZlbnQgVmFyaWFibGVcblxuXHRPYmplY3RzIHdpdGggYSBzaW5nbGUgXCJjaGFuZ2VcIiBldmVudFxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50VmFyaWFibGUge1xuXG5cdGNvbnN0cnVjdG9yICh2YWx1ZSkge1xuXHRcdGV2ZW50aWZ5SW5zdGFuY2UodGhpcyk7XG5cdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHR0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcblx0fVxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5fdmFsdWV9O1xuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlICE9IHRoaXMuX3ZhbHVlKSB7XG5cdFx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuZXZlbnRpZnlQcm90b3R5cGUoRXZlbnRWYXJpYWJsZS5wcm90b3R5cGUpO1xuXG4vKlxuXHRFdmVudCBCb29sZWFuXG5cblxuXHROb3RlIDogaW1wbGVtZW50YXRpb24gdXNlcyBmYWxzaW5lc3Mgb2YgaW5wdXQgcGFyYW1ldGVyIHRvIGNvbnN0cnVjdG9yIGFuZCBzZXQoKSBvcGVyYXRpb24sXG5cdHNvIGV2ZW50Qm9vbGVhbigtMSkgd2lsbCBhY3R1YWxseSBzZXQgaXQgdG8gdHJ1ZSBiZWNhdXNlXG5cdCgtMSkgPyB0cnVlIDogZmFsc2UgLT4gdHJ1ZSAhXG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRCb29sZWFuIGV4dGVuZHMgRXZlbnRWYXJpYWJsZSB7XG5cdGNvbnN0cnVjdG9yKHZhbHVlKSB7XG5cdFx0c3VwZXIoQm9vbGVhbih2YWx1ZSkpO1xuXHR9XG5cblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdHN1cGVyLnZhbHVlID0gQm9vbGVhbih2YWx1ZSk7XG5cdH1cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gc3VwZXIudmFsdWV9O1xufVxuXG5cbi8qXG5cdG1ha2UgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gRXZlbnRCb29sZWFuIGNoYW5nZXNcblx0dmFsdWUuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQcm9taXNlKGV2ZW50T2JqZWN0LCBjb25kaXRpb25GdW5jKSB7XG5cdGNvbmRpdGlvbkZ1bmMgPSBjb25kaXRpb25GdW5jIHx8IGZ1bmN0aW9uKHZhbCkge3JldHVybiB2YWwgPT0gdHJ1ZX07XG5cdHJldHVybiBuZXcgUHJvbWlzZSAoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdGxldCBzdWIgPSBldmVudE9iamVjdC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdGlmIChjb25kaXRpb25GdW5jKHZhbHVlKSkge1xuXHRcdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHRcdFx0ZXZlbnRPYmplY3Qub2ZmKHN1Yik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufTtcblxuLy8gbW9kdWxlIGFwaVxuZXhwb3J0IGRlZmF1bHQge1xuXHRldmVudGlmeVByb3RvdHlwZSxcblx0ZXZlbnRpZnlJbnN0YW5jZSxcblx0RXZlbnRWYXJpYWJsZSxcblx0RXZlbnRCb29sZWFuLFxuXHRtYWtlUHJvbWlzZVxufTtcblxuIiwiLypcbiAgICBUaGlzIGRlY29yYXRlcyBhbiBvYmplY3QvcHJvdG90eXBlIHdpdGggYmFzaWMgKHN5bmNocm9ub3VzKSBjYWxsYmFjayBzdXBwb3J0LlxuKi9cblxuY29uc3QgUFJFRklYID0gXCJfX2NhbGxiYWNrXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRTdGF0ZShvYmplY3QpIHtcbiAgICBvYmplY3RbYCR7UFJFRklYfV9oYW5kbGVyc2BdID0gW107XG59XG5cbmZ1bmN0aW9uIGFkZF9jYWxsYmFjayAoaGFuZGxlcikge1xuICAgIGxldCBoYW5kbGUgPSB7XG4gICAgICAgIGhhbmRsZXI6IGhhbmRsZXJcbiAgICB9XG4gICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0ucHVzaChoYW5kbGUpO1xuICAgIHJldHVybiBoYW5kbGU7XG59O1xuXG5mdW5jdGlvbiByZW1vdmVfY2FsbGJhY2sgKGhhbmRsZSkge1xuICAgIGxldCBpbmRleCA9IHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLmluZGV4T2YoaGFuZGxlKTtcbiAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIG5vdGlmeV9jYWxsYmFja3MgKGVBcmcpIHtcbiAgICB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5mb3JFYWNoKGZ1bmN0aW9uKGhhbmRsZSkge1xuICAgICAgICBoYW5kbGUuaGFuZGxlcihlQXJnKTtcbiAgICB9KTtcbn07XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZE1ldGhvZHMgKG9iaikge1xuICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgYWRkX2NhbGxiYWNrLCByZW1vdmVfY2FsbGJhY2ssIG5vdGlmeV9jYWxsYmFja3NcbiAgICB9XG4gICAgT2JqZWN0LmFzc2lnbihvYmosIGFwaSk7XG59XG5cbi8qKlxuICogdGVzdCBpZiBvYmplY3QgaW1wbGVtZW50cyBjYWxsYmFjayBhcGlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzX2NhbGxiYWNrX2FwaSAob2JqKSB7XG4gICAgaWYgKG9iaiA9PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBtZXRob2RzID0gW1wiYWRkX2NhbGxiYWNrXCIsIFwicmVtb3ZlX2NhbGxiYWNrXCJdO1xuICAgIGZvciAoY29uc3QgcHJvcCBvZiBtZXRob2RzKSB7XG4gICAgICAgIGlmICghKHByb3AgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAodHlwZW9mIG9ialtwcm9wXSAhPSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufVxuIiwiaW1wb3J0IHsgZW5kcG9pbnQsIGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzXCI7XG5cblxuLy8gb3Z2ZXJyaWRlIG1vZHVsbyB0byBiZWhhdmUgYmV0dGVyIGZvciBuZWdhdGl2ZSBudW1iZXJzXG5leHBvcnQgZnVuY3Rpb24gbW9kKG4sIG0pIHtcbiAgICByZXR1cm4gKChuICUgbSkgKyBtKSAlIG07XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZGl2bW9kKHgsIGJhc2UpIHtcbiAgICBsZXQgbiA9IE1hdGguZmxvb3IoeCAvIGJhc2UpXG4gICAgbGV0IHIgPSBtb2QoeCwgYmFzZSk7XG4gICAgcmV0dXJuIFtuLCByXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2Zpbml0ZV9udW1iZXIob2JqKSB7XG4gICAgcmV0dXJuICh0eXBlb2Ygb2JqID09ICdudW1iZXInKSAmJiBpc0Zpbml0ZShvYmopO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tfbnVtYmVyKG5hbWUsIG9iaikge1xuICAgIGlmICghaXNfZmluaXRlX251bWJlcihvYmopKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtuYW1lfSBtdXN0IGJlIGZpbml0ZSBudW1iZXIgJHtvYmp9YCk7XG4gICAgfVxufVxuXG4vKipcbiAqIGNvbnZlbmllbmNlIGZ1bmN0aW9uIHRvIHJlbmRlciBhIGN1cnNvciBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlcl9jdXJzb3IgKGN1cnNvciwgc2VsZWN0b3IsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7ZGVsYXk9MjAwLCByZW5kZXIsIG5vdmFsdWV9ID0gb3B0aW9ucztcbiAgICBjb25zdCBlbGVtcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICAgIGZ1bmN0aW9uIF9yZW5kZXIoc3RhdGUpIHtcbiAgICAgICAgaWYgKHN0YXRlLnZhbHVlID09IHVuZGVmaW5lZCAmJiBub3ZhbHVlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3RhdGUudmFsdWUgPSBub3ZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZW5kZXIgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZW5kZXIoc3RhdGUsIGVsZW1zKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVsZW1zLnRleHRDb250ZW50ID0gKHN0YXRlLnZhbHVlICE9IHVuZGVmaW5lZCkgPyBgJHtzdGF0ZS52YWx1ZX1gIDogXCJcIjtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY3Vyc29yLmJpbmQoX3JlbmRlciwgZGVsYXkpO1xufVxuXG5cblxuXG4vKlxuICAgIHNpbWlsYXIgdG8gcmFuZ2UgZnVuY3Rpb24gaW4gcHl0aG9uXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gcmFuZ2UgKHN0YXJ0LCBlbmQsIHN0ZXAgPSAxLCBvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgY29uc3Qge2luY2x1ZGVfZW5kPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgaWYgKHN0ZXAgPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTdGVwIGNhbm5vdCBiZSB6ZXJvLicpO1xuICAgIH1cbiAgICBpZiAoc3RhcnQgPCBlbmQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IHN0ZXApIHtcbiAgICAgICAgICByZXN1bHQucHVzaChpKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RhcnQgPiBlbmQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpID4gZW5kOyBpIC09IHN0ZXApIHtcbiAgICAgICAgICByZXN1bHQucHVzaChpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoaW5jbHVkZV9lbmQpIHtcbiAgICAgICAgcmVzdWx0LnB1c2goZW5kKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuXG4vLyB3ZWJwYWdlIGNsb2NrIC0gcGVyZm9ybWFuY2Ugbm93IC0gc2Vjb25kc1xuZXhwb3J0IGNvbnN0IGxvY2FsX2Nsb2NrID0gZnVuY3Rpb24gbG9jYWxfY2xvY2sgKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIG5vdzogKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHBlcmZvcm1hbmNlLm5vdygpLzEwMDAuMDtcbiAgICAgICAgfVxuICAgIH1cbn0oKTtcblxuLy8gc3lzdGVtIGNsb2NrIC0gZXBvY2ggLSBzZWNvbmRzXG5leHBvcnQgY29uc3QgbG9jYWxfZXBvY2ggPSBmdW5jdGlvbiBsb2NhbF9lcG9jaCAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgbm93OiAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IERhdGUoKS8xMDAwLjA7XG4gICAgICAgIH1cbiAgICB9XG59KCk7XG5cbi8qKlxuICogQ3JlYXRlIGEgc2luZ2xlIHN0YXRlIGZyb20gYSBsaXN0IG9mIHN0YXRlcywgdXNpbmcgYSB2YWx1ZUZ1bmNcbiAqIHN0YXRlOnt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0fVxuICogXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHRvU3RhdGUoc291cmNlcywgc3RhdGVzLCBvZmZzZXQsIG9wdGlvbnM9e30pIHtcbiAgICBsZXQge3ZhbHVlRnVuYywgc3RhdGVGdW5jLCBudW1lcmljPWZhbHNlLCBtYXNrfSA9IG9wdGlvbnM7IFxuICAgIGxldCBzdGF0ZTtcbiAgICBpZiAodmFsdWVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBsZXQgdmFsdWUgPSB2YWx1ZUZ1bmMoe3NvdXJjZXMsIHN0YXRlcywgb2Zmc2V0fSk7XG4gICAgICAgIGxldCBkeW5hbWljID0gc3RhdGVzLm1hcCgodikgPT4gdi5keW1hbWljKS5zb21lKGU9PmUpO1xuICAgICAgICBzdGF0ZSA9IHt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0fTtcbiAgICB9IGVsc2UgaWYgKHN0YXRlRnVuYyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3RhdGUgPSB7Li4uc3RhdGVGdW5jKHtzb3VyY2VzLCBzdGF0ZXMsIG9mZnNldH0pLCBvZmZzZXR9O1xuICAgIH0gZWxzZSBpZiAoc3RhdGVzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgIHN0YXRlID0ge3ZhbHVlOnVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHN0YXRlID0gey4uLnN0YXRlc1swXSwgb2Zmc2V0fVxuICAgIH1cbiAgICBpZiAobnVtZXJpYyAmJiBzdGF0ZS52YWx1ZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKCFpc19maW5pdGVfbnVtYmVyKHN0YXRlLnZhbHVlKSkge1xuICAgICAgICAgICAgc3RhdGUgPSB7dmFsdWU6bWFzaywgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3RhdGU7XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrX2l0ZW1zKGl0ZW1zKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnB1dCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICAgICAgLy8gbWFrZSBzdWVyIGl0ZW0gaGFzIGlkXG4gICAgICAgIGl0ZW0uaWQgPSBpdGVtLmlkIHx8IHJhbmRvbV9zdHJpbmcoMTApO1xuICAgICAgICAvLyBtYWtlIHN1cmUgaXRlbSBpbnRlcnZhbHMgYXJlIHdlbGwgZm9ybWVkXG4gICAgICAgIGl0ZW0uaXR2ID0gaW50ZXJ2YWwuZnJvbV9pbnB1dChpdGVtLml0dik7XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcmFuZG9tX3N0cmluZyhsZW5ndGgpIHtcbiAgICB2YXIgdGV4dCA9IFwiXCI7XG4gICAgdmFyIHBvc3NpYmxlID0gXCJBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6XCI7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRleHQgKz0gcG9zc2libGUuY2hhckF0KE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHBvc3NpYmxlLmxlbmd0aCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGV4dDtcbn1cblxuLyoqXG4gKiBJbXByb3ZlZCBzZXRfdGltZW91dFxuICogXG4gKiBUaW1lb3V0IGlzIGRlZmluZWQgYnkgYSB0YXJnZXRfbXMgcmVhZGluZyBvZiBwZXJmb3JtYW5jZS5ub3coKS5cbiAqIENhbGxiYWNrIGlzIG5vdCBpbnZva2VkIHVudGlsIHBlcmZvcm1hbmNlLm5vdygpID49IHRhcmdldF9tcy4gXG4gKiBcbiAqIFRoaXMgcHJvdGVjdHMgYWdhaW5zdCBhIHdlYWtuZXNzIGluIGJhc2ljIHNldFRpbWVvdXQsIHdoaWNoIG1heVxuICogb2NjYXRpb25hbGx5IGludm9rZSB0aGUgY2FsbGJhY2sgdG9vIGVhcmx5LiBcbiAqIFxuICogc2NoZWR1bGUgdGltZW91dCAxIG1zIGxhdGUsIHRvIHJlZHVjZSB0aGUgbGlrZWxpaG9vZCBvZiBcbiAqIGhhdmluZyB0byByZXNjaGVkdWxlIGEgdGltZW91dCBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldF90aW1lb3V0IChjYWxsYmFjaywgZGVsdGFfbXMpIHtcbiAgICBsZXQgdHMgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICBkZWx0YV9tcyA9IE1hdGgubWF4KGRlbHRhX21zLCAwKTtcbiAgICBsZXQgdGFyZ2V0X21zID0gdHMgKyBkZWx0YV9tcztcbiAgICBsZXQgdGlkO1xuICAgIGZ1bmN0aW9uIGNhbmNlbF90aW1lb3V0KCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGlkKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaGFuZGxlX3RpbWVvdXQoKSB7XG4gICAgICAgIGNvbnN0IGRlbHRhX21zID0gdGFyZ2V0X21zIC0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIGlmIChkZWx0YV9tcyA+IDApIHtcbiAgICAgICAgICAgIC8vIHJlc2NoZWR1bGUgdGltZW91dFxuICAgICAgICAgICAgdGlkID0gc2V0VGltZW91dChoYW5kbGVfdGltZW91dCwgZGVsdGFfbXMgKyAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgdGlkID0gc2V0VGltZW91dChoYW5kbGVfdGltZW91dCwgZGVsdGFfbXMgKyAxKTtcbiAgICByZXR1cm4ge2NhbmNlbDpjYW5jZWxfdGltZW91dH07XG59XG5cbi8qKlxuICogIEltcGxlbWVudHMgZGV0ZXJtaW5pc3RpYyBwcm9qZWN0aW9uIGJhc2VkIG9uIGluaXRpYWwgY29uZGl0aW9ucyBcbiAqICAtIG1vdGlvbiB2ZWN0b3IgZGVzY3JpYmVzIG1vdGlvbiB1bmRlciBjb25zdGFudCBhY2NlbGVyYXRpb25cbiAqXG4gKiAgbW90aW9uIHRyYW5zaXRpb24gXG4gKiBcbiAqICB0cmFuc2l0aW9uIGZyb20gdGltZSBkb21haW4gdG8gcG9zaXRpb24gdW5kZXIgY29uc3RhbnQgYWNjZWxlcmF0aW9uIGlzIGdpdmVuIGJ5XG4gKiAgZ2l2ZW4gaW5pdGlhbCB2ZWN0b3IgW3AwLHYwLGEwLHQwXVxuICogIHAodCkgPSBwMCArIHYwKih0LXQwKSArIDAuNSphMCoodC10MCkqKHQtdDApXG4gKiAgdih0KSA9IHYwICsgYTAqKHQtdDApXG4gKiAgYSh0KSA9IGEwXG4gKiAgdCh0KSA9IHRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1vdGlvbl9jYWxjdWxhdGUodmVjdG9yLHQpIHtcbiAgICBjb25zdCBbcDAsdjAsYTAsdDBdID0gdmVjdG9yO1xuICAgIGNvbnN0IGQgPSB0IC0gdDA7XG4gICAgY29uc3QgcCA9IHAwICsgdjAqZCArIDAuNSphMCpNYXRoLnBvdyhkLDIpO1xuICAgIGNvbnN0IHYgPSB2MCArIGEwKmQ7XG4gICAgY29uc3QgYSA9IGEwO1xuICAgIHJldHVybiBbcCx2LGEsdF07XG59XG5cbi8qKlxuICogR2l2ZW4gbW90aW9uIGRldGVybWluZWQgZnJvbSBbcDAsdjAsYTAsdDBdLlxuICogR2l2ZW4gZXF1YXRpb24gcCh0KSA9IHAwICsgdjAqKHQtdDApICsgMC41KmEwKih0LXQwKV4yID09IHAxXG4gKiBDYWxjdWxhdGUgaWYgZXF1YXRpb24gaGFzIHNvbHV0aW9ucyBmb3Igc29tZSByZWFsIG51bWJlciB0LlxuICogQSBzb2x1dGlvbiBleGlzdHMgaWYgZGV0ZXJtaW5hbnQgb2YgcXVhZHJhdGljIGVxdWF0aW9uIGlzIG5vbi1uZWdhdGl2ZVxuICogKHYwXjIgLSAyYTAocDAtcDEpKSA+PSAwXG4gKi9cbmZ1bmN0aW9uIG1vdGlvbl9oYXNfcmVhbF9zb2x1dGlvbnModmVjdG9yLCBwMSkge1xuICAgIGNvbnN0IFtwMCx2MCxhMCx0MF0gPSB2ZWN0b3I7XG4gICAgcmV0dXJuIChNYXRoLnBvdyh2MCwyKSAtIDIqYTAqKHAwLXAxKSkgPj0gMC4wXG59O1xuXG4vKipcbiAqIEdpdmVuIG1vdGlvbiBkZXRlcm1pbmVkIGZyb20gW3AwLHYwLGEwLHQwXS5cbiAqIEdpdmVuIGVxdWF0aW9uIHAodCkgPSBwMCArIHYwKih0LXQwKSArIDAuNSphMCoodC10MCleMiA9PSBwMVxuICogQ2FsY3VsYXRlIGFuZCByZXR1cm4gcmVhbCBzb2x1dGlvbnMsIGluIGFzY2VuZGluZyBvcmRlci5cbiovICBcbmZ1bmN0aW9uIG1vdGlvbl9nZXRfcmVhbF9zb2x1dGlvbnMgKHZlY3RvciwgcDEpIHtcbiAgICBjb25zdCBbcDAsdjAsYTAsdDBdID0gdmVjdG9yO1xuICAgIC8vIENvbnN0YW50IFBvc2l0aW9uXG4gICAgaWYgKGEwID09PSAwLjAgJiYgdjAgPT09IDAuMCkge1xuICAgICAgICBpZiAocDAgIT0gcDEpIHJldHVybiBbXTtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBhbnkgdCBpcyBhIHNvbHV0aW9uXG4gICAgICAgICAgICAvLyBOT1RFOiBoYXMgcmVhbCBzb2x1dGlvbnMgaXMgdHJ1ZVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgLy8gQ29uc3RhbnQgbm9uLXplcm8gVmVsb2NpdHlcbiAgICBpZiAoYTAgPT09IDAuMCkgcmV0dXJuIFt0MCArIChwMS1wMCkvdjBdO1xuICAgIC8vIENvbnN0YW50IEFjY2VsZXJhdGlvblxuICAgIGlmIChtb3Rpb25faGFzX3JlYWxfc29sdXRpb25zKHZlY3RvciwgcDEpID09PSBmYWxzZSkgcmV0dXJuIFtdO1xuICAgIC8vIEV4YWN0bHkgb24gc29sdXRpb25cbiAgICB2YXIgZGlzY3JpbWluYW50ID0gTWF0aC5wb3codjAsMikgLSAyKmEwKihwMC1wMSk7XG4gICAgaWYgKGRpc2NyaW1pbmFudCA9PT0gMC4wKSB7XG4gICAgICAgIHJldHVybiBbdDAtdjAvYTBdO1xuICAgIH1cbiAgICB2YXIgc3FydCA9IE1hdGguc3FydChNYXRoLnBvdyh2MCwyKSAtIDIqYTAqKHAwLXAxKSk7XG4gICAgdmFyIGQxID0gdDAgKyAoLXYwICsgc3FydCkvYTA7XG4gICAgdmFyIGQyID0gdDAgKyAoLXYwIC0gc3FydCkvYTA7XG4gICAgcmV0dXJuIFtNYXRoLm1pbihkMSxkMiksTWF0aC5tYXgoZDEsZDIpXTtcbn07XG5cbi8qXG4gICAgY2FsY3VsYXRlIHRpbWUgcmFuZ2UgZm9yIGdpdmVuIHBvc2l0aW9uIHJhbmdlXG5cbiAgICBtb3Rpb24gdHJhbnNpdGlvbiBmcm9tIHRpbWUgdG8gcG9zaXRpb24gaXMgZ2l2ZW4gYnlcbiAgICBwKHQpID0gcDAgKyB2KnQgKyAwLjUqYSp0KnRcbiAgICBmaW5kIHNvbHV0aW9ucyBmb3IgdCBzbyB0aGF0IFxuICAgIHAodCkgPSBwb3NcblxuICAgIGRvIHRoaXMgZm9yIGJvdGggdmFsdWVzIGluIHJhbmdlIFtsb3csaGlnaF1cbiAgICBhY2N1bXVsYXRlIGFsbCBjYW5kaWRhdGUgc29sdXRpb25zIHQgaW4gYXNjZW5kaW5nIG9yZGVyXG4gICAgYXZvaWQgZHVwbGljYXRlc1xuICAgIHRoaXMgY2FuIGFjY3VtdWxhdGUgMCwxLDIsMyw0IHNvbHV0aW9uXG4gICAgaWYgMCBzb2x1dGlvbnMgLSB1bmRlZmluZWQgKG1vdGlvbiBkb2VzIG5vdCBpbnRlcnNlY3Qgd2l0aCByYW5nZSBldmVyKSBcbiAgICBpZiAxIHNvbHV0aW9ucyAtIHVkZWZpbmVkIChtb3Rpb24gb25seSBpbnRlcnNlY3RzIHdpdGggcmFuZ2UgdGFuZ2VudGlhbGx5IGF0IG9uZSB0KVxuICAgIGlmIDIgc29sdXRpb25zIC0gWzAsMV0gKG1vdGlvbiBpbnRlcnNlY3RzIHdpdGggcmFuZ2UgYXQgdHdvIHRpbWVzKVxuICAgIGlmIDMgc29sdXRpb25zIC0gWzAsMl0gKG1vdGlvbiBpbnRlcnNlY3RzIHdpdGggcmFuZ2UgYXQgdGhyZWUgdGltZXMpXG4gICAgaWYgNCBzb2x1dGlvbnMgLSBbMCwxXSBhbmQgWzIsM11cblxuICAgIHJldHVybnMgYSBsaXN0IG9mIHJhbmdlIGNhbmRpZGF0ZXMgKGF0IG1vc3QgdHdvIGJ1dCBvbmx5IHdpdGggYWNjZWxlcmF0aW9uKVxuKi9cbmZ1bmN0aW9uIG1vdGlvbl9jYWxjdWxhdGVfdGltZV9yYW5nZXModmVjdG9yLCBwb3NfcmFuZ2UpIHtcbiAgICBjb25zdCBbcDAsdjAsYTAsdDBdID0gdmVjdG9yO1xuICAgIGxldCBbbG93LCBoaWdoXSA9IHBvc19yYW5nZTtcbiAgICBpZiAobG93ID09IG51bGwpIGxvdyA9IC1JbmZpbml0eTtcbiAgICBpZiAoaGlnaCA9PSBudWxsKSBoaWdoID0gSW5maW5pdHk7XG5cbiAgICAvLyBbPC0sIC0+XVxuICAgIGlmIChsb3cgPT0gLUluZmluaXR5ICYmIGhpZ2ggPT0gSW5maW5pdHkpIHtcbiAgICAgICAgLy8gbm8gcG9zIHJhbmdlID09IGVudGlyZSB2YWx1ZSBzcGFjZSA9PiB0aW1lIHJhbmdlIGVudGlyZSB0aW1lbGluZVxuICAgICAgICByZXR1cm4gW1tudWxsLCBudWxsXV07XG4gICAgfSBcblxuICAgIC8vIFtGTEFUIExJTkVdXG4gICAgLy8gcG9zIGlzIGVpdGhlciB3aXRoaW4gcG9zIHJhbmdlIGZvciBhbGwgdCBvciBuZXZlciAgXG4gICAgaWYgKHYwID09PSAwLjAgJiYgYTAgPT09IDAuMCkge1xuICAgICAgICAvLyBib3RoIGxvdyBhbmQgaGlnaCBib3VuZFxuICAgICAgICByZXR1cm4gKHAwID49IGxvdyAmJiBwMCA8PSBoaWdoKSA/IFtbbnVsbCwgbnVsbF1dIDogW107XG4gICAgfVxuXG4gICAgLy8gYWdncmVnYXRlIHNvbHV0aW9uc1xuICAgIGxldCBzb2x1dGlvbnMgPSBbXTtcbiAgICBpZiAoLUluZmluaXR5IDwgbG93KSB7XG4gICAgICAgIHNvbHV0aW9ucy5wdXNoKC4uLm1vdGlvbl9nZXRfcmVhbF9zb2x1dGlvbnModmVjdG9yLCBsb3cpKTtcbiAgICB9IFxuICAgIGlmIChoaWdoIDwgSW5maW5pdHkpIHtcbiAgICAgICAgc29sdXRpb25zLnB1c2goLi4ubW90aW9uX2dldF9yZWFsX3NvbHV0aW9ucyh2ZWN0b3IsIGhpZ2gpKTtcbiAgICB9XG4gICAgLy8gcmVtb3ZlIGR1cGxpY2F0ZXNcbiAgICBzb2x1dGlvbnMgPSBbLi4ubmV3IFNldChzb2x1dGlvbnMpXTtcbiAgICAvLyBzb3J0IGluIGFzY2VuZGluZyBvcmRlclxuICAgIHNvbHV0aW9ucy5zb3J0KChhLGIpID0+IGEtYik7XG5cbiAgICAvLyBbPC0sIEhJR0hdXG4gICAgaWYgKGxvdyA9PSAtSW5maW5pdHkpIHtcbiAgICAgICAgLy8gb25seSBoaWdoIGJvdW5kXG4gICAgICAgIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIC8vIHBhcmFib2xhIG5vdCB0b3VjaGluZyBsb3dcbiAgICAgICAgICAgIC8vIHBvcyA8IGhpZ2ggb3IgcG9zID4gaGlnaCBmb3IgYWxsIHQgLSBqdXN0IHRlc3Qgd2l0aCB0MFxuICAgICAgICAgICAgcmV0dXJuIChwMCA8PSBoaWdoKSA/IFtbbnVsbCwgbnVsbF1dIDogW107XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICBpZiAoYTAgPiAwLjApIHtcbiAgICAgICAgICAgICAgICAvLyBwYXJhYm9sYSAtIHRvdWNoaW5nIGhpZ2ggZnJvbSBvdmVyc2lkZVxuICAgICAgICAgICAgICAgIC8vIHBvcyA+IGhpZ2ggZm9yIGFsbCB0XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhMCA8IDAuMCkge1xuICAgICAgICAgICAgICAgIC8vIHBhcmFib2xhIHRvdWNoaW5nIGxvdyBmcm9tIHVuZGVyc2lkZVxuICAgICAgICAgICAgICAgIC8vIHBvcyA8IGhpZ2ggZm9yIGFsbCB0XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtbbnVsbCwgbnVsbF1dO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBhMCA9PSAwLjAgPiBzdHJhaWd0aCBsaW5lXG4gICAgICAgICAgICAgICAgaWYgKHYwID4gMC4wKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHBvcyA8PSBoaWdoIGZvciBhbGwgdCA8PSBzb2x1dGlvbnNbMF1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtbbnVsbCwgc29sdXRpb25zWzBdXV07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcG9zIDw9IGhpZ2ggZm9yIHQgPj0gc29sdXRpb25zWzBdXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBbW3NvbHV0aW9uc1swXSwgbnVsbF1dO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgIC8vIHBhcmFib2xhXG4gICAgICAgICAgICBpZiAoYTAgPiAwLjApIHtcbiAgICAgICAgICAgICAgICAvLyBvbmUgdGltZSByYW5nZSBiZXR3ZWVuIHNvbHV0aW9uc1xuICAgICAgICAgICAgICAgIHJldHVybiBbW3NvbHV0aW9uc1swXSwgc29sdXRpb25zWzFdXV07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGEwIDwgMC4wKSB7XG4gICAgICAgICAgICAgICAgLy8gb25lIHRpbWUgcmFuZ2Ugb24gZWFjaCBzaWRlIFxuICAgICAgICAgICAgICAgIHJldHVybiBbW251bGwsIHNvbHV0aW9uc1swXV0sIFtzb2x1dGlvbnNbMV0sIG51bGxdXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAvLyBbTE9XLCAtPl1cbiAgICB9IGVsc2UgaWYgKGhpZ2ggPT0gSW5maW5pdHkpIHtcbiAgICAgICAgLy8gb25seSBsb3cgYm91bmRcbiAgICAgICAgaWYgKHNvbHV0aW9ucy5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgLy8gcGFyYWJvbGEgbm90IHRvdWNoaW5nIGxvd1xuICAgICAgICAgICAgLy8gcG9zID4gbG93IG9yIHBvcyA8IGxvdyBmb3IgYWxsIHQgLSBqdXN0IHRlc3Qgd2l0aCB0MFxuICAgICAgICAgICAgcmV0dXJuIChwMCA+PSBsb3cpID8gW1tudWxsLCBudWxsXV0gOiBbXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgIGlmIChhMCA+IDAuMCkge1xuICAgICAgICAgICAgICAgIC8vIHBhcmFib2xhIC0gdG91Y2hpbmcgbG93IGZyb20gb3ZlcnNpZGVcbiAgICAgICAgICAgICAgICAvLyBwb3MgPiBsb3cgZm9yIGFsbCB0XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtbbnVsbCwgbnVsbF1dO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhMCA8IDAuMCkge1xuICAgICAgICAgICAgICAgIC8vIHBhcmFib2xhIHRvdWNoaW5nIGxvdyBmcm9tIHVuZGVyc2lkZVxuICAgICAgICAgICAgICAgIC8vIHBvcyA8IGxvdyBmb3IgYWxsIHRcbiAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGEwID09IDAuMCA+IHN0cmFpZ3RoIGxpbmVcbiAgICAgICAgICAgICAgICBpZiAodjAgPiAwLjApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcG9zID49IGxvdyBmb3IgYWxsIHQgPj0gc29sdXRpb25zWzBdXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBbW3NvbHV0aW9uc1swXSwgbnVsbF1dO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHBvcyA+PSBsb3cgZm9yIHQgPD0gc29sdXRpb25zWzBdXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBbW251bGwsIHNvbHV0aW9uc1swXV1dO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgIC8vIHBhcmFib2xhXG4gICAgICAgICAgICBpZiAoYTAgPiAwLjApIHtcbiAgICAgICAgICAgICAgICAvLyBvbmUgdGltZSByYW5nZSBvbiBlYWNoIHNpZGUgXG4gICAgICAgICAgICAgICAgcmV0dXJuIFtbbnVsbCwgc29sdXRpb25zWzBdXSwgW3NvbHV0aW9uc1sxXSwgbnVsbF1dO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhMCA8IDAuMCkge1xuICAgICAgICAgICAgICAgIC8vIG9uZSB0aW1lIHJhbmdlIGJldHdlZW4gc29sdXRpb25zXG4gICAgICAgICAgICAgICAgcmV0dXJuIFtbc29sdXRpb25zWzBdLCBzb2x1dGlvbnNbMV1dXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgLy8gW0xPVywgSElHSF1cbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBib3RoIGxvdyBhbmQgaGlnaCBib3VuZFxuICAgICAgICBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAwKSByZXR1cm4gW107XG4gICAgICAgIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDEpIHJldHVybiBbXTtcbiAgICAgICAgaWYgKHNvbHV0aW9ucy5sZW5ndGggPT0gMikgcmV0dXJuIFtbc29sdXRpb25zWzBdLCBzb2x1dGlvbnNbMV1dXTtcbiAgICAgICAgaWYgKHNvbHV0aW9ucy5sZW5ndGggPT0gMykgcmV0dXJuIFtbc29sdXRpb25zWzBdLCBzb2x1dGlvbnNbMl1dXTtcbiAgICAgICAgaWYgKHNvbHV0aW9ucy5sZW5ndGggPT0gNCkgcmV0dXJuIFtbc29sdXRpb25zWzBdLCBzb2x1dGlvbnNbMV1dLCBbc29sdXRpb25zWzJdLCBzb2x1dGlvbnNbM11dXTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG1vdGlvbl9jaGVja19yYW5nZShvYmopIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmopICYmIG9iai5sZW5ndGggIT0gMikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHJhbmdlIG11c3QgaGF2ZSB0d28gZWxlbWVudHMgJHtvYmp9YCk7XG4gICAgfVxuICAgIG9ialswXSA9PSBudWxsIHx8IGNoZWNrX251bWJlcihcImxvd1wiLCBvYmpbMF0pO1xuICAgIG9ialsxXSA9PSBudWxsIHx8IGNoZWNrX251bWJlcihcImhpZ2hcIiwgb2JqWzFdKTtcbn1cblxuZXhwb3J0IGNvbnN0IG1vdGlvbl91dGlscyA9IHtcbiAgICBjYWxjdWxhdGU6IG1vdGlvbl9jYWxjdWxhdGUsXG4gICAgaGFzX3JlYWxfc29sdXRpb25zOiBtb3Rpb25faGFzX3JlYWxfc29sdXRpb25zLFxuICAgIGdldF9yZWFsX3NvbHV0aW9uczogbW90aW9uX2dldF9yZWFsX3NvbHV0aW9ucyxcbiAgICBjYWxjdWxhdGVfdGltZV9yYW5nZXM6IG1vdGlvbl9jYWxjdWxhdGVfdGltZV9yYW5nZXMsXG4gICAgY2hlY2tfcmFuZ2U6IG1vdGlvbl9jaGVja19yYW5nZVxufVxuIiwiaW1wb3J0ICogYXMgZXZlbnRpZnkgZnJvbSBcIi4vdXRpbC9hcGlfZXZlbnRpZnkuanNcIjtcbmltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL3V0aWwvYXBpX2NhbGxiYWNrLmpzXCI7XG5pbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyByYW5nZSwgdG9TdGF0ZSB9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExBWUVSXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIExheWVyIGlzIGFic3RyYWN0IGJhc2UgY2xhc3MgZm9yIExheWVyc1xuICogXG4gKiBMYXllciBpbnRlcmZhY2UgaXMgZGVmaW5lZCBieSAoaW5kZXgsIENhY2hlQ2xhc3MsIG9wdGlvbnMpXG4gKiBcbiAqIENhY2hlQ2xhc3NcbiAqIC0tLS0tLS0tLS1cbiAqIFRoZSBDYWNoZUNsYXNzIGltcGxlbWVudHMgdGhlIHF1ZXJ5IG9wZXJhdGlvbiBmb3IgdGhlIGxheWVyLCB1c2luZ1xuICogdGhlIGluZGV4IGZvciBsb29rdXBzIG9uIGNhY2hlIG1pc3MuIExheWVyIGhhcyBhIHByaXZhdGUgY2FjaGUuIFxuICogQWRkaXRpb25hbGx5LCBpZiBsYXllciBoYXMgbXVsdGlwbGUgY29uc3VtZXJzLCB0aGV5IGNhbiBlYWNoIFxuICogY3JlYXRlIHRoZWlyIG93biBwcml2YXRlIGNhY2hlLiBcbiAqIFxuICogb3B0aW9uc1xuICogLS0tLS0tLVxuICogVGhlIHRoZSByZXN1bHQgZnJvbSB0aGUgcXVlcnkgb3BlcmF0aW9uIGNhbiBiZSBjb250cm9sbGVkIGJ5IHN1cHBseWluZ1xuICogb3B0aW9uYWwgY3VzdG9tIGZ1bmN0aW9uLCBlaXRoZXIgdmFsdWVGdW5jIG9yIGEgc3RhdGVGdW5jIFxuICoge3ZhbHVlRnVuYyxzdGF0ZUZ1bmN9XG4gKiBcbiAqIGluZGV4XG4gKiAtLS0tLVxuICogVGhlIG5lYXJieSBpbmRleCBpcyBzdXBwbGllZCBieSBMYXllciBpbXBsZW1lbnRhdGlvbnMsIGVpdGhlciBieSBcbiAqIHN1YmNsYXNzaW5nIGl0LCBvciBieSBhc3NpZ25pbmcgdGhlIGluZGV4LiBcbiAqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXIge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuXG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgIENhY2hlQ2xhc3M9TGF5ZXJDYWNoZSwgXG4gICAgICAgICAgICB2YWx1ZUZ1bmM9dW5kZWZpbmVkLFxuICAgICAgICAgICAgc3RhdGVGdW5jPXVuZGVmaW5lZCxcbiAgICAgICAgfSA9IG9wdGlvbnM7IFxuXG4gICAgICAgIC8vIGNhbGxiYWNrc1xuICAgICAgICBjYWxsYmFjay5hZGRTdGF0ZSh0aGlzKTtcbiAgICAgICAgLy8gZGVmaW5lIGNoYW5nZSBldmVudFxuICAgICAgICBldmVudGlmeS5hZGRTdGF0ZSh0aGlzKTtcbiAgICAgICAgdGhpcy5ldmVudGlmeURlZmluZShcImNoYW5nZVwiLCB7aW5pdDp0cnVlfSk7XG5cbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgdGhpcy5pbmRleDtcblxuICAgICAgICAvLyBjYWNoZVxuICAgICAgICB0aGlzLl9DYWNoZUNsYXNzID0gQ2FjaGVDbGFzcztcbiAgICAgICAgdGhpcy5fcHJpdmF0ZV9jYWNoZTtcbiAgICAgICAgdGhpcy5fY29uc3VtZXJfY2FjaGVzID0gW107XG5cbiAgICAgICAgLy8gcHJvcGVydGllc1xuICAgICAgICB0aGlzLl92YWx1ZUZ1bmMgPSB2YWx1ZUZ1bmM7XG4gICAgICAgIHRoaXMuX3N0YXRlRnVuYyA9IHN0YXRlRnVuYztcbiAgICB9XG5cbiAgICAvLyByZXN0cmljdGlvbnMgKGRlZmF1bHRzKVxuICAgIGdldCBudW1lcmljICgpIHtyZXR1cm4gZmFsc2U7fVxuICAgIGdldCBtdXRhYmxlICgpIHtyZXR1cm4gZmFsc2U7fVxuICAgIGdldCBpdGVtc09ubHkgKCkge3JldHVybiBmYWxzZTt9XG5cbiAgICAvLyBxdWVyeSBvcHRpb25zXG4gICAgZ2V0IHZhbHVlRnVuYyAoKSB7cmV0dXJuIHRoaXMuX3ZhbHVlRnVuYzt9XG4gICAgZ2V0IHN0YXRlRnVuYyAoKSB7cmV0dXJuIHRoaXMuX3N0YXRlRnVuYzt9XG5cbiAgICAvLyBwcml2YXRlIGNhY2hlXG4gICAgZ2V0IGNhY2hlICgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3ByaXZhdGVfY2FjaGUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9wcml2YXRlX2NhY2hlID0gbmV3IHRoaXMuX0NhY2hlQ2xhc3ModGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByaXZhdGVfY2FjaGU7XG4gICAgfVxuXG4gICAgLy8gaW52b2tlZCBieSBsYXllciBjb25zdW1lclxuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIC8vIGludm9rZWQgYnkgbGF5ZXIgY29uc3VtZXJcbiAgICBjcmVhdGVDYWNoZSAoKSB7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gbmV3IHRoaXMuX0NhY2hlQ2xhc3ModGhpcyk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVyX2NhY2hlcy5wdXNoKGNhY2hlKTtcbiAgICAgICAgcmV0dXJuIGNhY2hlO1xuICAgIH1cbiAgICByZWxlYXNlQ2FjaGUgKGNhY2hlKSB7XG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuX2NvbnN1bWVyX2NhY2hlcy5pbmRleE9mKGNhY2hlKTtcbiAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICB0aGlzLl9jb25zdW1lcl9jYWNoZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgY2xlYXJDYWNoZXMoKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2FjaGUgb2YgdGhpcy5fY29uc3VtZXJfY2FjaGVzKXtcbiAgICAgICAgICAgIGNhY2hlLmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX3ByaXZhdGVfY2FjaGUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9wcml2YXRlX2NhY2hlLmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpbnZva2VkIGJ5IHN1YmNsYXNzIHdoZW5ldmVyIGxheWVyIGhhcyBjaGFuZ2VkXG4gICAgb25jaGFuZ2UoKSB7XG4gICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIpOyAgICBcbiAgICB9XG5cbiAgICAvLyBpdGVyYXRvciBmb3IgcmVnaW9ucyBvZiB0aGUgbGF5ZXIgaW5kZXhcbiAgICByZWdpb25zIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluZGV4LnJlZ2lvbnMob3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgU2FtcGxlIGxheWVyIHZhbHVlcyBieSB0aW1lbGluZSBvZmZzZXQgaW5jcmVtZW50c1xuICAgICAgICByZXR1cm4gbGlzdCBvZiB0dXBsZXMgW3ZhbHVlLCBvZmZzZXRdXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICAgLSBzdGFydFxuICAgICAgICAtIHN0b3BcbiAgICAgICAgLSBzdGVwXG5cbiAgICAgICAgVE9ETyAtIHRoaXMgc2hvdWxkIGJlIGFuIGl0ZXJhdG9yXG4gICAgKi9cbiAgICBzYW1wbGUob3B0aW9ucz17fSkge1xuICAgICAgICBpZiAodGhpcy5pbmRleC5lbXB0eSgpKSB7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHtzdGFydCwgc3RvcCwgc3RlcD0xfSA9IG9wdGlvbnM7XG4gICAgICAgIFxuICAgICAgICBpZiAoc3RhcnQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiBpbmRleC5maXJzdCBpcyBhIG51bWJlclxuICAgICAgICAgICAgY29uc3QgZmlyc3QgPSB0aGlzLmluZGV4LmZpcnN0KCk7XG4gICAgICAgICAgICBpZiAoZmlyc3RbMF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHN0YXJ0ID0gZmlyc3RbMF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInVuZGVmaW5lZCBzdGFydFwiKTtcbiAgICAgICAgICAgIH0gICAgXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0b3AgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiBpbmRleC5sYXN0IGlzIGEgbnVtYmVyXG4gICAgICAgICAgICBjb25zdCBsYXN0ID0gdGhpcy5pbmRleC5sYXN0KCk7XG4gICAgICAgICAgICBpZiAobGFzdFswXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgc3RvcCA9IGxhc3RbMF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInVuZGVmaW5lZCBzdG9wXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzdGFydCA+IHN0b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciAoXCJzdG9wIG11c3QgYmUgbGFyZ2VyIHRoYW4gc3RhcnRcIiwgc3RhcnQsIHN0b3ApXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmNyZWF0ZUNhY2hlKCk7XG4gICAgICAgIGNvbnN0IHNhbXBsZXMgPSByYW5nZShzdGFydCwgc3RvcCwgc3RlcCwge2luY2x1ZGVfZW5kOnRydWV9KVxuICAgICAgICAgICAgLm1hcCgob2Zmc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtjYWNoZS5xdWVyeShvZmZzZXQpLnZhbHVlLCBvZmZzZXRdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmVsZWFzZUNhY2hlKGNhY2hlKTtcbiAgICAgICAgcmV0dXJuIHNhbXBsZXM7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkTWV0aG9kcyhMYXllci5wcm90b3R5cGUpO1xuZXZlbnRpZnkuYWRkTWV0aG9kcyhMYXllci5wcm90b3R5cGUpO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExBWUVSIENBQ0hFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIExheWVyIENhY2hlIGlzIHRoZSByZWd1bGFyIGNhY2hlIHR5cGUsIGludGVuZGVkIGZvclxuICogX2Rlcml2ZWRfIExheWVycyAtIHRoYXQgaXMgYSBsYXllcnMgd2hpY2ggaW5kZXggcmVmZXJlbmNlc1xuICogb3RoZXIgc291cmNlIGxheWVycy5cbiAqIFxuICogQSBxdWVyeSBpcyByZXNvbHZlZCBieSBpZGVudGlmeWluZyB0aGUgcmVsZXZhbnQgcmVnaW9uIGluXG4gKiB0aGUgbmVhcmJ5IGluZGV4IChpbmRleC5uZWFyYnkob2Zmc2V0KSksIGFuZCB0aGVuIHF1ZXJ5aW5nIFxuICogdGhlIHN0YXRlIG9mIGFsbCB0aGUgb2JqZWN0cyBmb3VuZCBpbiB0aGUgcmVnaW9uIChuZWFyYnkuY2VudGVyKS5cbiAqICBcbiAqIE9wdGlvbnMge3ZhbHVlRnVuYyBvciBzdGF0ZUZ1bmN9IGFyZSB1c2VkIHRvIGNvbXB1dGUgYSBcbiAqIHNpbmdsZSBxdWVyeSByZXN1bHQgZnJvbSB0aGUgbGlzdCBvZiBzdGF0ZXMuXG4gKiBcbiAqIFRoZSByZXN1bHQgc3RhdGUgaXMgb25seSBjYWNoZWQgaWYgaXQgaXMgc3RhdGljLlxuICogQ2FjaGUgbWlzcyBpcyB0cmlnZ2VyZWQgaWYgbm8gc3RhdGUgaGFzIGJlZW4gY2FjaGVkLCBvciBpZiBcbiAqIG9mZnNldCBpcyBvdXRzaWRlIHRoZSByZWdpb24gb2YgdGhlIGNhY2hlZCBzdGF0ZS5cbiAqIFxuICovXG5cbmV4cG9ydCBjbGFzcyBMYXllckNhY2hlIHtcblxuICAgIGNvbnN0cnVjdG9yKGxheWVyKSB7XG4gICAgICAgIC8vIGNhY2hlIGJlbG9uZ3MgdG8gbGF5ZXJcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgLy8gY2FjaGVkIG5lYXJieSBzdGF0ZVxuICAgICAgICB0aGlzLl9uZWFyYnk7XG4gICAgICAgIC8vIGNhY2hlZCBzdGF0ZVxuICAgICAgICB0aGlzLl9zdGF0ZTtcbiAgICAgICAgLy8gcXVlcnkgb3B0aW9uc1xuICAgICAgICB0aGlzLl9xdWVyeV9vcHRpb25zID0ge1xuICAgICAgICAgICAgdmFsdWVGdW5jOiB0aGlzLl9sYXllci52YWx1ZUZ1bmMsXG4gICAgICAgICAgICBzdGF0ZUZ1bmM6IHRoaXMuX2xheWVyLnN0YXRlRnVuYyxcbiAgICAgICAgICAgIG51bWJlck9ubHk6IHRoaXMuX2xheWVyLmlzTnVtYmVyT25seSxcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBnZXQgbGF5ZXIoKSB7cmV0dXJuIHRoaXMuX2xheWVyfTtcblxuICAgIC8qKlxuICAgICAqIHF1ZXJ5IGNhY2hlXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IG5lZWRfaW5kZXhfbG9va3VwID0gKFxuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgIWludGVydmFsLmNvdmVyc19lbmRwb2ludCh0aGlzLl9uZWFyYnkuaXR2LCBvZmZzZXQpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICFuZWVkX2luZGV4X2xvb2t1cCAmJiBcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlICE9IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgIXRoaXMuX3N0YXRlLmR5bmFtaWNcbiAgICAgICAgKSB7XG4gICAgICAgICAgICAvLyBjYWNoZSBoaXRcbiAgICAgICAgICAgIHJldHVybiB7Li4udGhpcy5fc3RhdGUsIG9mZnNldH07XG4gICAgICAgIH1cbiAgICAgICAgLy8gY2FjaGUgbWlzc1xuICAgICAgICBpZiAobmVlZF9pbmRleF9sb29rdXApIHtcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICB9XG4gICAgICAgIC8vIHBlcmZvcm0gcXVlcmllc1xuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9uZWFyYnkuY2VudGVyLm1hcCgoY2FjaGUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBjYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gY2FsY3VsYXRlIHNpbmdsZSByZXN1bHQgc3RhdGVcbiAgICAgICAgY29uc3Qgc3RhdGUgPSB0b1N0YXRlKHRoaXMuX25lYXJieS5jZW50ZXIsIHN0YXRlcywgb2Zmc2V0LCB0aGlzLl9xdWVyeV9vcHRpb25zKTtcbiAgICAgICAgLy8gY2FjaGUgc3RhdGUgb25seSBpZiBub3QgZHluYW1pY1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IChzdGF0ZS5keW5hbWljKSA/IHVuZGVmaW5lZCA6IHN0YXRlO1xuICAgICAgICByZXR1cm4gc3RhdGUgICAgXG4gICAgfVxuXG4gICAgY2xlYXIoKSB7XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG4iLCJpbXBvcnQgeyBsb2NhbF9jbG9jayB9IGZyb20gXCIuL2NvbW1vbi5qc1wiO1xuXG4vKipcbiAqIHBvbGxpbmcgYSBjYWxsYmFjayBmdW5jdGlvbiBwZXJpb2RpY2FsbHkgd2l0aCBcbiAqIGEgZml4ZWQgZGVsYXkgKG1zKS5cbiAqIElmIGRlbGF5IGlzIDAsIHVzZSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXG4gKiBlbHNlIHVzZSBzZXRUaW1lb3V0LlxuICogRGVsYXkgY2FuIGJlIHNldCBkeW5hbWljYWxseS4gUGF1c2UgYW5kIHJlc3VtZVxuICogaXMgbmVlZGVkIGZvciBuZXcgZGVsYXkgdG8gdGFrZSBlZmZlY3QuXG4gKi9cblxuY2xhc3MgUG9sbGVyIHtcblxuICAgIGNvbnN0cnVjdG9yKGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuX2NhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgICAgIHRoaXMuX2hhbmRsZTtcbiAgICAgICAgdGhpcy5fZGVsYXk7XG4gICAgfVxuICAgIFxuICAgIHNldCBkZWxheSAoZGVsYXlfbXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBkZWxheV9tcyAhPSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGRlbGF5IG11c3QgYmUgYSBudW1iZXIgJHtkZWxheV9tc31gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fZGVsYXkgIT0gZGVsYXlfbXMpIHsgICBcbiAgICAgICAgICAgIHRoaXMuX2RlbGF5ID0gZGVsYXlfbXM7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZ2V0IGRlbGF5ICgpIHtyZXR1cm4gdGhpcy5fZGVsYXk7fVxuXG4gICAgaXNfcG9sbGluZyAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oYW5kbGUgIT0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHBhdXNlKCkge1xuICAgICAgICBpZiAodGhpcy5faGFuZGxlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlLmNhbmNlbCgpO1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcG9sbCgpIHtcbiAgICAgICAgLy8gcG9sbCBjYWxsYmFja1xuICAgICAgICB0aGlzLl9jYWxsYmFjaygpO1xuICAgICAgICAvLyBzY2hlZHVsZSBuZXh0IHBvbGxcbiAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgICB0aGlzLnJlc3VtZSgpO1xuICAgIH1cblxuICAgIHJlc3VtZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2hhbmRsZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9kZWxheSA9PSAwKSB7XG4gICAgICAgICAgICAgICAgLy8gZnJhbWVyYXRlXG4gICAgICAgICAgICAgICAgY29uc3QgYWlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMucG9sbC5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGUgPSB7Y2FuY2VsOiAoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShhaWQpfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gdGltZW91dFxuICAgICAgICAgICAgICAgIGNvbnN0IHRpZCA9IHNldFRpbWVvdXQodGhpcy5wb2xsLmJpbmQodGhpcyksIHRoaXMuX2RlbGF5KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGUgPSB7Y2FuY2VsOiAoKSA9PiBjbGVhclRpbWVvdXQodGlkKX07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogQ3Vyc29yIE1vbml0b3JcbiAqL1xuXG5jbGFzcyBDdXJzb3JNb25pdG9yIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgLypcbiAgICAgICAgICAgIHNldCBvZiBiaW5kaW5nc1xuICAgICAgICAgICAgcG9sbCBjdXJzb3IgKHdoZW4gZHluYW1pYykgcGVyaW9kaWNhbGx5IHdpdGggZ2l2ZW4gKG1pbmltdW0pIGRlbGF5LCBhbmQgaW52b2tlIGNhbGxiYWNrIHdpdGggY3Vyc29yIHN0YXRlIFxuICAgICAgICAgICAgYmluZGluZyA6IHtjdXJzb3IsIGNhbGxiYWNrLCBkZWxheV9tc31cbiAgICAgICAgICAgIC0gY3Vyc29yOlxuICAgICAgICAgICAgLSBjYWxsYmFjazogZnVuY3Rpb24oc3RhdGUpXG4gICAgICAgICAgICAtIGRlbGF5OiAobXMpIGJldHdlZW4gc2FtcGxlcyAod2hlbiB2YXJpYWJsZSBpcyBkeW5hbWljKVxuICAgICAgICAgICAgdGhlcmUgY2FuIGJlIG11bHRpcGxlIGJpbmRpbmdzIGZvciB0aGUgc2FtZSBjdXJzb3JcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmluZGluZ19zZXQgPSBuZXcgU2V0KCk7XG5cbiAgICAgICAgLypcbiAgICAgICAgICAgIGN1cnNvcnNcbiAgICAgICAgICAgIG1hcDogY3Vyc29yIC0+IHtzdWIsIHBvbGxpbmcsIGJpbmRpbmdzOltdfVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jdXJzb3JfbWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIC8vIFBvbGxlclxuICAgICAgICB0aGlzLl9wb2xsZXIgPSBuZXcgUG9sbGVyKHRoaXMub25wb2xsLmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGJpbmQoY3Vyc29yLCBjYWxsYmFjaywgZGVsYXkpIHtcbiAgICAgICAgLy8gY2hlY2sgZGVsYXlcbiAgICAgICAgaWYgKGRlbGF5ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGVsYXkgPSAwO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkZWxheSAhPSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGRlbGF5IG11c3QgYmUgYSBudW1iZXIgJHtkZWxheX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyByZWdpc3RlciBiaW5kaW5nXG4gICAgICAgIGxldCBiaW5kaW5nID0ge2N1cnNvciwgY2FsbGJhY2ssIGRlbGF5fTtcbiAgICAgICAgdGhpcy5fYmluZGluZ19zZXQuYWRkKGJpbmRpbmcpO1xuICAgICAgICAvLyByZWdpc3RlciBjdXJzb3JcbiAgICAgICAgaWYgKCF0aGlzLl9jdXJzb3JfbWFwLmhhcyhjdXJzb3IpKSB7IFxuICAgICAgICAgICAgbGV0IHN1YiA9IGN1cnNvci5vbihcImNoYW5nZVwiLCB0aGlzLm9uY3Vyc29yY2hhbmdlLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgdGhpcy5fY3Vyc29yX21hcC5zZXQoY3Vyc29yLCB7XG4gICAgICAgICAgICAgICAgc3ViLCBwb2xsaW5nOiBmYWxzZSwgYmluZGluZ3M6IFtiaW5kaW5nXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jdXJzb3JfbWFwLmdldChjdXJzb3IpLmJpbmRpbmdzLnB1c2goYmluZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJpbmRpbmc7XG4gICAgfVxuXG4gICAgcmVsZWFzZSAoYmluZGluZykge1xuICAgICAgICAvLyB1bnJlZ2lzdGVyIGJpbmRpbmdcbiAgICAgICAgY29uc3QgcmVtb3ZlZCA9IHRoaXMuX2JpbmRpbmdfc2V0LmRlbGV0ZShiaW5kaW5nKTtcbiAgICAgICAgaWYgKCFyZW1vdmVkKSByZXR1cm47XG4gICAgICAgIC8vIGNsZWFudXBcbiAgICAgICAgY29uc3QgY3Vyc29yID0gYmluZGluZy5jdXJzb3I7XG4gICAgICAgIGNvbnN0IHtzdWIsIGJpbmRpbmdzfSA9IHRoaXMuX2N1cnNvcl9tYXAuZ2V0KGN1cnNvcik7XG4gICAgICAgIC8vIHJlbW92ZSBiaW5kaW5nXG4gICAgICAgIGNvbnN0IGlkeCA9IGJpbmRpbmdzLmluZGV4T2YoYmluZGluZyk7XG4gICAgICAgIGlmIChpZHggPj0gMCkge1xuICAgICAgICAgICAgYmluZGluZ3Muc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJpbmRpbmdzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAvLyBubyBtb3JlIGJpbmRpbmdzXG4gICAgICAgICAgICBjdXJzb3Iub2ZmKHN1Yik7XG4gICAgICAgICAgICB0aGlzLl9jdXJzb3JfbWFwLmRlbGV0ZShjdXJzb3IpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYSBjdXJzb3IgaGFzIGNoYW5nZWRcbiAgICAgKiBmb3J3YXJkIGNoYW5nZSBldmVudCB0byBhbGwgY2FsbGJhY2tzIGZvciB0aGlzIGN1cnNvci5cbiAgICAgKiBhbmQgcmVldmFsdWF0ZSBwb2xsaW5nIHN0YXR1cywgcGF1c2luZyBvciByZXN1bWluZ1xuICAgICAqIHBvbGxpbmcgaWYgbmVlZGVkLlxuICAgICAqL1xuICAgIG9uY3Vyc29yY2hhbmdlKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIGNvbnN0IGN1cnNvciA9IGVJbmZvLnNyYztcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBlQXJnO1xuICAgICAgICAvLyByZWV2YWx1YXRlIHBvbGxpbmcgc3RhdHVzXG4gICAgICAgIHRoaXMuX2N1cnNvcl9tYXAuZ2V0KGN1cnNvcikucG9sbGluZyA9IHN0YXRlLmR5bmFtaWM7XG4gICAgICAgIC8vIGZpbmQgY3Vyc29ycyB3aGljaCBuZWVkIHBvbGxpbmdcbiAgICAgICAgY29uc3QgcG9sbGluZ19jdXJzb3JzID0gWy4uLnRoaXMuX2N1cnNvcl9tYXAudmFsdWVzKCldXG4gICAgICAgICAgICAuZmlsdGVyKGVudHJ5ID0+IGVudHJ5LnBvbGxpbmcpO1xuICAgICAgICB0aGlzLnJlZXZhbHVhdGVfcG9sbGluZyhwb2xsaW5nX2N1cnNvcnMpO1xuICAgICAgICAvLyBmb3J3YXJkIGNoYW5nZSBldmVudCB0byBhbGwgZm9yIHRoaXMgY3Vyc29yIGNhbGxiYWNrc1xuICAgICAgICBjb25zdCB7YmluZGluZ3N9ID0gdGhpcy5fY3Vyc29yX21hcC5nZXQoY3Vyc29yKTtcbiAgICAgICAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGJpbmRpbmdzKSB7XG4gICAgICAgICAgICBiaW5kaW5nLmNhbGxiYWNrKHN0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9ucG9sbCgpIHtcbiAgICAgICAgY29uc3QgdHMgPSBsb2NhbF9jbG9jay5ub3coKTtcbiAgICAgICAgLy8gcG9sbCBhbGwgY3Vyc29ycyB3aXRoIG5lZWQgb2YgcG9sbGluZ1xuICAgICAgICBmb3IgKGNvbnN0IFtjdXJzb3IsIGVudHJ5XSBvZiB0aGlzLl9jdXJzb3JfbWFwKSB7XG4gICAgICAgICAgICBpZiAoZW50cnkucG9sbGluZykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gY3Vyc29yLnF1ZXJ5KHRzKTtcbiAgICAgICAgICAgICAgICAvLyBmb3J3YXJkIHBvbGxlZCBzdGF0ZSB0byBhbGwgY2FsbGJhY2tzIGZvciB0aGlzIGN1cnNvclxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBlbnRyeS5iaW5kaW5ncykge1xuICAgICAgICAgICAgICAgICAgICBiaW5kaW5nLmNhbGxiYWNrKHN0YXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZWV2YWx1YXRlX3BvbGxpbmcocG9sbGluZ19jdXJzb3JzKSB7XG4gICAgICAgIGlmIChwb2xsaW5nX2N1cnNvcnMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3BvbGxlci5wYXVzZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmluZCBtaW5pbXVtIGRlbGF5XG4gICAgICAgICAgICBjb25zdCBkZWxheXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgcG9sbGluZ19jdXJzb3JzKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGVudHJ5LmJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGF5cy5wdXNoKGJpbmRpbmcuZGVsYXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjb25zdCBtaW5fZGVsYXkgPSBNYXRoLm1pbiguLi5kZWxheXMpO1xuICAgICAgICAgICAgdGhpcy5fcG9sbGVyLmRlbGF5ID0gbWluX2RlbGF5O1xuICAgICAgICAgICAgdGhpcy5fcG9sbGVyLnBhdXNlKCk7XG4gICAgICAgICAgICB0aGlzLl9wb2xsZXIucmVzdW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEJJTkQgUkVMRUFTRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vLyBtb25pdG9yIHNpbmdsZXRvblxuY29uc3QgbW9uaXRvciA9IG5ldyBDdXJzb3JNb25pdG9yKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kKGN1cnNvciwgY2FsbGJhY2ssIGRlbGF5KSB7XG4gICAgcmV0dXJuIG1vbml0b3IuYmluZChjdXJzb3IsIGNhbGxiYWNrLCBkZWxheSk7XG59XG5leHBvcnQgZnVuY3Rpb24gcmVsZWFzZShiaW5kaW5nKSB7XG4gICAgcmV0dXJuIG1vbml0b3IucmVsZWFzZShiaW5kaW5nKTtcbn1cblxuIiwiaW1wb3J0ICogYXMgZXZlbnRpZnkgZnJvbSBcIi4vdXRpbC9hcGlfZXZlbnRpZnkuanNcIjtcbmltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL3V0aWwvYXBpX2NhbGxiYWNrLmpzXCI7XG5pbXBvcnQgeyBiaW5kLCByZWxlYXNlIH0gZnJvbSBcIi4vdXRpbC9jdXJzb3JfbW9uaXRvci5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi8gIFxuXG4vKipcbiAqIEFic3RyYWN0IGJhc2UgY2xhc3MgZm9yIEN1cnNvciBpbnRlcmZhY2VcbiAqL1xuXG5leHBvcnQgY2xhc3MgQ3Vyc29yIHtcbiAgICBcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGNhbGxiYWNrLmFkZFN0YXRlKHRoaXMpO1xuICAgICAgICAvLyBkZWZpbmUgY2hhbmdlIGV2ZW50XG4gICAgICAgIGV2ZW50aWZ5LmFkZFN0YXRlKHRoaXMpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcbiAgICB9XG5cbiAgICAvLyByZXN0cmljdGlvbiBkZWZhdWx0c1xuICAgIGdldCBtdXRhYmxlICgpIHtyZXR1cm4gZmFsc2U7fVxuICAgIGdldCBudW1lcmljICgpIHtyZXR1cm4gZmFsc2U7fTtcbiAgICBnZXQgaXRlbXNPbmx5ICgpIHtyZXR1cm4gZmFsc2U7fVxuICAgIGdldCBmaXhlZFJhdGUgKCkge3JldHVybiBmYWxzZX1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBxdWVyeShsb2NhbF90cykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJxdWVyeSgpIG5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG4gICAgZ2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5xdWVyeSgpLnZhbHVlfTtcbiAgICBnZXQgKCkge3JldHVybiB0aGlzLnF1ZXJ5KCkudmFsdWU7fVxuXG4gICAgLyoqXG4gICAgICogRXZlbnRpZnk6IGltbWVkaWF0ZSBldmVudHNcbiAgICAgKi9cbiAgICBldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuICAgICAgICBpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG4gICAgICAgICAgICByZXR1cm4gW3RoaXMucXVlcnkoKV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBCSU5EIFJFTEVBU0UgKGNvbnZlbmllbmNlKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgLyoqXG4gICAgICogYWx0ZXJuYXRpdmUgdG8gbGlzdGVuaW5nIHRvIHRoZSBjaGFuZ2UgZXZlbnRcbiAgICAgKiBiaW5kIHN1YnNjcmliZXMgdG8gdGhlIGNoYW5nZSBldmVudCwgYnV0IGFsc28gYXV0b21hdGljYWxseVxuICAgICAqIHR1cm5zIGxpc3RlbmluZyBvbiBhbmQgb2ZmIHdoZW4gYXMgdGhlIGN1cnNvciBzd2l0Y2hlc1xuICAgICAqIGJldHdlZW4gZHluYW1pYyBhbmQgbm9uLWR5bmFtaWMgYmVoYXZpb3IuXG4gICAgICovXG5cbiAgICBiaW5kKGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgICAgICByZXR1cm4gYmluZCh0aGlzLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnMpO1xuICAgIH1cbiAgICByZWxlYXNlKGhhbmRsZSkge1xuICAgICAgICByZXR1cm4gcmVsZWFzZShoYW5kbGUpO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogQ0hBTkdFIE5PVElGSUNBVElPTlxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgLyoqXG4gICAgICogaW52b2tlZCBieSBjdXJzb3IgaW1wbGVtZW50YXRpb24gdG8gc2lnbmFsIGNoYW5nZSBpbiBjdXJzb3JcbiAgICAgKiBiZWhhdmlvci5cbiAgICAgKi9cbiAgICBvbmNoYW5nZSgpIHtcbiAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHRoaXMucXVlcnkoKSk7XG4gICAgICAgIHRoaXMuZGV0ZWN0X2Z1dHVyZV9ldmVudCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIG92ZXJyaWRlIGJ5IGN1cnNvciBpbXBsZW1lbnRhdGlvbiBpbiBvcmRlciB0byBkZXRlY3RcbiAgICAgKiBhbmQgdHJpZ2dlciBmdXR1cmUgY2hhbmdlIGV2ZW50cyAtIHdoaWNoIGFyZSBub3QgdHJpZ2dlcmVkXG4gICAgICogYnkgc3RhdGUgY2hhbmdlcyAtIGJ1dCBjYXVzZWQgYnkgdGltZSBwcm9ncmVzc2lvblxuICAgICAqIG9yIHBsYXliYWNrLiBUaGlzIGZ1bmN0aW9uIGlzIGludm9rZWQgYWZ0ZXIgZWFjaCBcbiAgICAgKiBvbmNoYW5nZSgpIGV2ZW50LlxuICAgICAqL1xuICAgIGRldGVjdF9mdXR1cmVfZXZlbnQoKSB7fVxufVxuY2FsbGJhY2suYWRkTWV0aG9kcyhDdXJzb3IucHJvdG90eXBlKTtcbmV2ZW50aWZ5LmFkZE1ldGhvZHMoQ3Vyc29yLnByb3RvdHlwZSk7XG4iLCJpbXBvcnQge2xvY2FsX2Nsb2NrLCBjaGVja19udW1iZXJ9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5cblxuLyoqXG4gKiBDTE9DSyBQUk9WSURFUlxuICogXG4gKiBBIENsb2NrUHJvdmlkZXIgY2FuIGJlIGNyZWF0ZWQgaW4gdHdvIHdheXNcbiAqIC0gZWl0aGVyIGJ5IHN1cHBseWluZyBhIGNsb2NrIG9iamVjdFxuICogLSBvciBieSBzdXBwbHlpbmcgYSB2ZWN0b3IgXG4gKiBcbiAqIEEgKmNsb2NrKiBpcyBhbiBvYmplY3QgdGhhdCBoYXMgYSBub3coKSBtZXRob2Qgd2hpY2ggcmV0dXJucyB0aGUgY3VycmVudCB0aW1lLlxuICogQSBjbG9jayBpcyBleHBlY3RlZCB0byByZXR1cm4gYSB0aW1lc3RhbXAgaW4gc2Vjb25kcywgbW9uaXRvbmljYWxseSBpbmNyZWFzaW5nIFxuICogYXQgcmF0ZSAxLjAgc2VjL3NlYy4gXG4gKiBcbiAqIEEgKnZlY3RvciogaW5pdGlhbGl6ZXMgYSBkZXRlcm1pc3RpYyBjbG9jayBiYXNlZCBvbiB0aGUgb2ZmaWNpYWwgKmxvY2FsX2Nsb2NrKi4gXG4gKiAtIHRzIChzZWMpIC0gdGltZXN0YW1wIGZyb20gb2ZmaWNpYWwgKmxvY2FsX2Nsb2NrKlxuICogLSB2YWx1ZSAoc2VjKSAtIHZhbHVlIG9mIGNsb2NrIGF0IHRpbWUgdHNcbiAqIC0gcmF0ZSAoc2VjL3NlYykgLSByYXRlIG9mIGNsb2NrIChkZWZhdWx0IDEuMClcbiAqIENsb2NrIFByb3ZpZGVyIHVzZXMgb2ZmaWNpYWwgKmxvY2FsIGNsb2NrKiAocGVyZm9ybWFjZS5ub3coKS8xMDAwLjApXG4gKiBUaGUgb2ZmaWNpYWwgY2xvY2sgaXMgZXhwb3J0ZWQgYnkgdGhlIHN0YXRlbGF5ZXJzIGZyYW1ld29yaywgc28gYXBwbGljYXRpb25cbiAqIGNvZGUgY2FuIHVzZSBpdCB0byBjcmVhdGUgYW4gaW5pdGlhbCB0aW1lc3RhbXBzLiBJZiBvbW1pdHRlZCwgY2xvY2tcbiAqIHByb3ZpZGVyIGNyZWF0ZXMgdGhlIHRpbWVzdGFtcCAtIHRoZXJlYnkgYXNzdW1pbmcgdGhhdCB0aGUgcHJvdmlkZWQgdmFsdWUgd2FzIFxuICogc2FtcGxlZCBpbW1lZGlhdGVseSBiZWZvcmUuXG4gKiBcbiAqIFxuICogVGhlIGtleSBkaWZmZXJlbmNlIGJldHdlZW4gKmNsb2NrKiBhbmQgKnZlY3RvciogaXMgdGhhdCB0aGUgY2xvY2sgb2JqZWN0IGNhbiBkcmlmdCBcbiAqIHJlbGF0aXZlIHRvIHRoZSBvZmZpY2lhbCAqbG9jYWxfY2xvY2sqLCB3aGlsZSB0aGUgdmVjdG9yIG9iamVjdCBpcyBmb3JldmVyIGxvY2tlZCB0b1xuICogdGhlIG9mZmljaWFsICpsb2NhbF9jbG9jayouXG4gKiAgIFxuICovXG5cbmZ1bmN0aW9uIGlzX2Nsb2NrKG9iaikge1xuICAgIGlmICghKFwibm93XCIgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2Ygb2JqLm5vdyAhPSBcImZ1bmN0aW9uXCIpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGNsYXNzIENsb2NrUHJvdmlkZXIge1xuXG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnM9e30pIHtcbiAgICAgICAgY29uc3Qge2Nsb2NrLCB2ZWN0b3I9TE9DQUxfQ0xPQ0tfVkVDVE9SfSA9IG9wdGlvbnM7XG5cbiAgICAgICAgaWYgKGNsb2NrICE9PSB1bmRlZmluZWQgJiYgaXNfY2xvY2soY2xvY2spKSB7XG4gICAgICAgICAgICB0aGlzLl9jbG9jayA9IHtcbiAgICAgICAgICAgICAgICBub3c6IChsb2NhbF90cykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiBsb2NhbF90cyBpcyBkZWZpbmVkIGl0IGRlZmluZXMgYSB0aW1lc3RhbXAgZm9yXG4gICAgICAgICAgICAgICAgICAgIC8vIGV2YWx1YXRpb24gb2YgdGhlIGNsb2NrIC0gd2hpY2ggaXMgbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lXG4gICAgICAgICAgICAgICAgICAgIC8vIGFzIG5vdyAtIGJhY2stZGF0ZSBjbG9jayBhY2NvcmRpbmdseVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaWZmX3RzID0gKGxvY2FsX3RzICE9IHVuZGVmaW5lZCkgPyBsb2NhbF9jbG9jay5ub3coKSAtIGxvY2FsX3RzIDogMDtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNsb2NrLm5vdygpIC0gZGlmZl90cztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9ICAgIFxuICAgICAgICAgICAgdGhpcy5fcmF0ZSA9IDEuMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCB7dHMsIHZhbHVlLCByYXRlPTEuMH0gPSB2ZWN0b3I7XG4gICAgICAgICAgICBpZiAodHMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBsb2NhbF9jbG9jay5ub3coKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNoZWNrX251bWJlcihcInRzXCIsIHRzKTtcbiAgICAgICAgICAgIGNoZWNrX251bWJlcihcInZhbHVlXCIsIHZhbHVlKTtcbiAgICAgICAgICAgIGNoZWNrX251bWJlcihcInJhdGVcIiwgcmF0ZSk7XG4gICAgICAgICAgICB0aGlzLl90MCA9IHRzO1xuICAgICAgICAgICAgdGhpcy5fdmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3JhdGUgPSByYXRlO1xuICAgICAgICAgICAgdGhpcy5fY2xvY2sgPSB7XG4gICAgICAgICAgICAgICAgbm93OiAobG9jYWxfdHMgPSBsb2NhbF9jbG9jay5ub3coKSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fdmFsdWUgKyAobG9jYWxfdHMgLSB0aGlzLl90MCkqdGhpcy5fcmF0ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBub3cgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xvY2subm93KCk7XG4gICAgfVxuXG4gICAgZ2V0IHJhdGUoKSB7cmV0dXJuIHRoaXMuX3JhdGU7fVxufVxuXG5cbi8vIGRlZmF1bHQgY2xvY2sgcHJvdmlkZXIgICAgXG5jb25zdCBMT0NBTF9DTE9DS19WRUNUT1IgPSB7XG4gICAgdHM6IGxvY2FsX2Nsb2NrLm5vdygpLFxuICAgIHZhbHVlOiBuZXcgRGF0ZSgpLzEwMDAuMCwgXG4gICAgcmF0ZTogMS4wXG59O1xuY29uc3QgTE9DQUxfQ0xPQ0tfUFJPVklERVIgPSBuZXcgQ2xvY2tQcm92aWRlcih7dmVjdG9yOkxPQ0FMX0NMT0NLX1ZFQ1RPUn0pO1xuXG5leHBvcnQgY29uc3QgY2xvY2tfcHJvdmlkZXIgPSAob3B0aW9ucz17fSkgPT4ge1xuXG4gICAgY29uc3Qge2Nsb2NrLCB2ZWN0b3J9ID0gb3B0aW9ucztcbiAgICBpZiAoY2xvY2sgPT0gdW5kZWZpbmVkICYmIHZlY3RvciA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIExPQ0FMX0NMT0NLX1BST1ZJREVSO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IENsb2NrUHJvdmlkZXIob3B0aW9ucyk7IFxufSIsImltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL3V0aWwvYXBpX2NhbGxiYWNrLmpzXCI7XG5cblxuLyoqXG4gKiBjb2xsZWN0aW9uIHByb3ZpZGVycyBtdXN0IHByb3ZpZGUgZ2V0X2FsbCBmdW5jdGlvblxuICogYW5kIGFsc28gaW1wbGVtZW50IGNhbGxiYWNrIGludGVyZmFjZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNfY29sbGVjdGlvbl9wcm92aWRlcihvYmopIHtcbiAgICBpZiAoIWNhbGxiYWNrLmlzX2NhbGxiYWNrX2FwaShvYmopKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCEoXCJnZXRcIiBpbiBvYmopKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiBvYmouZ2V0ICE9ICdmdW5jdGlvbicpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIShcInVwZGF0ZVwiIGluIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIG9iai51cGRhdGUgIT0gJ2Z1bmN0aW9uJykgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBDT0xMRUNUSU9OIFBST1ZJREVSXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogbG9jYWwgY29sbGVjdGlvbiBwcm92aWRlclxuICogXG4gKiBcbiAqIGNoYW5nZXMgPSB7XG4gKiAgIHJlbW92ZT1bXSxcbiAqICAgaW5zZXJ0PVtdLFxuICogICByZXNldD1mYWxzZSBcbiAqIH1cbiAqIFxuKi9cblxuZXhwb3J0IGNsYXNzIENvbGxlY3Rpb25Qcm92aWRlciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFN0YXRlKHRoaXMpO1xuICAgICAgICB0aGlzLl9tYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIC8vIGluaXRpYWxpemVcbiAgICAgICAgbGV0IHtpdGVtc30gPSBvcHRpb25zO1xuICAgICAgICBpZiAoaXRlbXMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXAuc2V0KGl0ZW0uaWQsIGl0ZW0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9jYWwgc3RhdGVwcm92aWRlcnMgZGVjb3VwbGUgdXBkYXRlIHJlcXVlc3QgZnJvbVxuICAgICAqIHVwZGF0ZSBwcm9jZXNzaW5nLCBhbmQgcmV0dXJucyBQcm9taXNlLlxuICAgICAqL1xuICAgIHVwZGF0ZSAoY2hhbmdlcykge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgbGV0IGRpZmZzO1xuICAgICAgICAgICAgaWYgKGNoYW5nZXMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZGlmZnMgPSB0aGlzLl91cGRhdGUoY2hhbmdlcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKGRpZmZzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkaWZmcztcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZShjaGFuZ2VzKSB7XG4gICAgICAgIGNvbnN0IGRpZmZfbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICBsZXQge1xuICAgICAgICAgICAgaW5zZXJ0PVtdLFxuICAgICAgICAgICAgcmVtb3ZlPVtdLFxuICAgICAgICAgICAgcmVzZXQ9ZmFsc2VcbiAgICAgICAgfSA9IGNoYW5nZXM7XG5cblxuICAgICAgICBpZiAocmVzZXQpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2lkLCBpdGVtXSBvZiB0aGlzLl9tYXAuZW50cmllcygpKSB7XG4gICAgICAgICAgICAgICAgZGlmZl9tYXAuc2V0KGlkLCB7aWQsIG5ldzp1bmRlZmluZWQsIG9sZDppdGVtfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBjbGVhciBhbGwgaXRlbXNcbiAgICAgICAgICAgIHRoaXMuX21hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHJlbW92ZSBpdGVtcyBieSBpZFxuICAgICAgICAgICAgZm9yIChjb25zdCBpZCBvZiByZW1vdmUpIHtcbiAgICAgICAgICAgICAgICBsZXQgaXRlbSA9IHRoaXMuX21hcC5nZXQoaWQpO1xuICAgICAgICAgICAgICAgIGlmIChpdGVtICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBkaWZmX21hcC5zZXQoaXRlbS5pZCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6aXRlbS5pZCwgbmV3OnVuZGVmaW5lZCwgb2xkOml0ZW1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hcC5kZWxldGUoaWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBpbnNlcnQgaXRlbXNcbiAgICAgICAgZm9yIChsZXQgaXRlbSBvZiBpbnNlcnQpIHtcbiAgICAgICAgICAgIGNvbnN0IGRpZmYgPSBkaWZmX21hcC5nZXQoaXRlbS5pZClcbiAgICAgICAgICAgIGNvbnN0IG9sZCA9IChkaWZmICE9IHVuZGVmaW5lZCkgPyBkaWZmLm9sZCA6IHRoaXMuX21hcC5nZXQoaXRlbS5pZCk7XG4gICAgICAgICAgICBkaWZmX21hcC5zZXQoaXRlbS5pZCwge2lkOml0ZW0uaWQsIG5ldzppdGVtLCBvbGR9KTtcbiAgICAgICAgICAgIHRoaXMuX21hcC5zZXQoaXRlbS5pZCwgaXRlbSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFsuLi5kaWZmX21hcC52YWx1ZXMoKV07XG4gICAgfVxuXG4gICAgZ2V0KCkge1xuICAgICAgICByZXR1cm4gWy4uLnRoaXMuX21hcC52YWx1ZXMoKV07XG4gICAgfTtcbn1cbmNhbGxiYWNrLmFkZE1ldGhvZHMoQ29sbGVjdGlvblByb3ZpZGVyLnByb3RvdHlwZSk7XG4iLCJpbXBvcnQgKiBhcyBjYWxsYmFjayBmcm9tIFwiLi91dGlsL2FwaV9jYWxsYmFjay5qc1wiO1xuXG4vKipcbiAqIG9iamVjdCBwcm92aWRlcnMgaW1wbGVtZW50IGdldCgpIGFuZCBzZXQoKSBtZXRob2RzXG4gKiBhbmQgdGhlIGNhbGxiYWNrIGludGVyZmFjZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNfb2JqZWN0X3Byb3ZpZGVyKG9iaikge1xuICAgIGlmICghY2FsbGJhY2suaXNfY2FsbGJhY2tfYXBpKG9iaikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIShcImdldFwiIGluIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIG9iai5nZXQgIT0gJ2Z1bmN0aW9uJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghKFwic2V0XCIgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2Ygb2JqLnNldCAhPSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBPQkpFQ1QgUFJPVklERVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBPYmplY3RQcm92aWRlciBzdG9yZXMgYW4gb2JqZWN0IG9yIHVuZGVmaW5lZC5cbiAqL1xuXG5leHBvcnQgY2xhc3MgT2JqZWN0UHJvdmlkZXIge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBjb25zdCB7aXRlbXN9ID0gb3B0aW9ucztcbiAgICAgICAgY2FsbGJhY2suYWRkU3RhdGUodGhpcyk7XG4gICAgICAgIHRoaXMuX29iamVjdCA9IGl0ZW1zO1xuICAgIH1cblxuICAgIHNldCAob2JqKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX29iamVjdCA9IG9iajtcbiAgICAgICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldCAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vYmplY3Q7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkTWV0aG9kcyhPYmplY3RQcm92aWRlci5wcm90b3R5cGUpOyIsImltcG9ydCB7IGlzX2NhbGxiYWNrX2FwaSB9IGZyb20gXCIuL2FwaV9jYWxsYmFjay5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTT1VSQ0UgUFJPUEVSVFkgKFNSQ1BST1ApXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9ucyBmb3IgZXh0ZW5kaW5nIGEgY2xhc3Mgd2l0aCBzdXBwb3J0IGZvciBcbiAqIGV4dGVybmFsIHNvdXJjZSBvbiBhIG5hbWVkIHByb3BlcnR5LlxuICogXG4gKiBvcHRpb246IG11dGFibGU6dHJ1ZSBtZWFucyB0aGF0IHByb3BlcnkgbWF5IGJlIHJlc2V0IFxuICogXG4gKiBzb3VyY2Ugb2JqZWN0IGlzIGFzc3VtZWQgdG8gc3VwcG9ydCB0aGUgY2FsbGJhY2sgaW50ZXJmYWNlLFxuICogb3IgYmUgYSBsaXN0IG9mIG9iamVjdHMgYWxsIHN1cHBvcnRpbmcgdGhlIGNhbGxiYWNrIGludGVyZmFjZVxuICovXG5cbmNvbnN0IE5BTUUgPSBcInNyY3Byb3BcIjtcbmNvbnN0IFBSRUZJWCA9IGBfXyR7TkFNRX1gO1xuXG5leHBvcnQgZnVuY3Rpb24gYWRkU3RhdGUgKG9iamVjdCkge1xuICAgIG9iamVjdFtgJHtQUkVGSVh9YF0gPSBuZXcgTWFwKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRNZXRob2RzIChvYmplY3QpIHtcblxuICAgIGZ1bmN0aW9uIHJlZ2lzdGVyKHByb3BOYW1lLCBvcHRpb25zPXt9KSB7XG4gICAgICAgIGxldCB7bXV0YWJsZT10cnVlfSA9IG9wdGlvbnM7XG4gICAgICAgIGNvbnN0IG1hcCA9IHRoaXNbYCR7UFJFRklYfWBdOyBcbiAgICAgICAgbWFwLnNldChwcm9wTmFtZSwge1xuICAgICAgICAgICAgaW5pdDpmYWxzZSxcbiAgICAgICAgICAgIG11dGFibGUsXG4gICAgICAgICAgICBlbnRpdHk6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGhhbmRsZXM6IFtdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHJlZ2lzdGVyIGdldHRlcnMgYW5kIHNldHRlcnNcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIHByb3BOYW1lLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbWFwLmdldChwcm9wTmFtZSkuZW50aXR5O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKGVudGl0eSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzW2Ake05BTUV9X2NoZWNrYF0pIHtcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5ID0gdGhpc1tgJHtOQU1FfV9jaGVja2BdKHByb3BOYW1lLCBlbnRpdHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZW50aXR5ICE9IG1hcC5nZXQocHJvcE5hbWUpLmVudGl0eSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzW2Ake1BSRUZJWH1fYXR0YWNoYF0ocHJvcE5hbWUsIGVudGl0eSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhdHRhdGNoKHByb3BOYW1lLCBlbnRpdHkpIHtcblxuICAgICAgICBjb25zdCBtYXAgPSB0aGlzW2Ake1BSRUZJWH1gXTtcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBtYXAuZ2V0KHByb3BOYW1lKVxuXG4gICAgICAgIGlmIChzdGF0ZS5pbml0ICYmICFzdGF0ZS5tdXRhYmxlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7cHJvcE5hbWV9IGNhbiBub3QgYmUgcmVhc3NpZ25lZGApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZW50aXRpZXMgPSAoQXJyYXkuaXNBcnJheShlbnRpdHkpKSA/IGVudGl0eSA6IFtlbnRpdHldO1xuXG4gICAgICAgIC8vIHVuc3Vic2NyaWJlIGZyb20gZW50aXRpZXNcbiAgICAgICAgaWYgKHN0YXRlLmhhbmRsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBbaWR4LCBlXSBvZiBPYmplY3QuZW50cmllcyhlbnRpdGllcykpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNfY2FsbGJhY2tfYXBpKGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGUucmVtb3ZlX2NhbGxiYWNrKHN0YXRlLmhhbmRsZXNbaWR4XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSAgICBcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5oYW5kbGVzID0gW107XG5cbiAgICAgICAgLy8gYXR0YXRjaCBuZXcgZW50aXR5XG4gICAgICAgIHN0YXRlLmVudGl0eSA9IGVudGl0eTtcbiAgICAgICAgc3RhdGUuaW5pdCA9IHRydWU7XG5cbiAgICAgICAgLy8gc3Vic2NyaWJlIHRvIGNhbGxiYWNrIGZyb20gc291cmNlXG4gICAgICAgIGlmICh0aGlzW2Ake05BTUV9X29uY2hhbmdlYF0pIHtcbiAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBmdW5jdGlvbiAoZUFyZykge1xuICAgICAgICAgICAgICAgIHRoaXNbYCR7TkFNRX1fb25jaGFuZ2VgXShwcm9wTmFtZSwgZUFyZyk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGUgb2YgZW50aXRpZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNfY2FsbGJhY2tfYXBpKGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlLmhhbmRsZXMucHVzaChlLmFkZF9jYWxsYmFjayhoYW5kbGVyKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpc1tgJHtOQU1FfV9vbmNoYW5nZWBdKHByb3BOYW1lLCBcInJlc2V0XCIpOyBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGFwaSA9IHt9O1xuICAgIGFwaVtgJHtOQU1FfV9yZWdpc3RlcmBdID0gcmVnaXN0ZXI7XG4gICAgYXBpW2Ake1BSRUZJWH1fYXR0YWNoYF0gPSBhdHRhdGNoO1xuICAgIE9iamVjdC5hc3NpZ24ob2JqZWN0LCBhcGkpO1xufVxuXG4iLCJpbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblx0U09SVEVEIEFSUkFZXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG5cdFNvcnRlZCBhcnJheSBvZiBlbmRwb2ludHMgW3ZhbHVlLCB0eXBlXS5cblx0LSBFbGVtZW50cyBhcmUgc29ydGVkIGluIGFzY2VuZGluZyBvcmRlci5cblx0LSBObyBkdXBsaWNhdGVzIGFyZSBhbGxvd2VkLlxuXHQtIEJpbmFyeSBzZWFyY2ggdXNlZCBmb3IgbG9va3VwXG5cblx0dmFsdWVzIGNhbiBiZSByZWd1bGFyIG51bWJlciB2YWx1ZXMgKGZsb2F0KSBvciBlbmRwb2ludHMgW2Zsb2F0LCB0eXBlXVxuKi9cblxuZXhwb3J0IGNsYXNzIFNvcnRlZEFycmF5IHtcblxuXHRjb25zdHJ1Y3Rvcigpe1xuXHRcdHRoaXMuX2FycmF5ID0gW107XG5cdH1cblxuXHRnZXQgc2l6ZSgpIHtyZXR1cm4gdGhpcy5fYXJyYXkubGVuZ3RoO31cblx0Z2V0IGFycmF5KCkge3JldHVybiB0aGlzLl9hcnJheTt9XG5cblx0Lypcblx0XHRmaW5kIGluZGV4IG9mIGdpdmVuIHZhbHVlXG5cblx0XHRyZXR1cm4gW2ZvdW5kLCBpbmRleF1cblxuXHRcdGlmIGZvdW5kIGlzIHRydWUsIHRoZW4gaW5kZXggaXMgdGhlIGluZGV4IG9mIHRoZSBmb3VuZCBvYmplY3Rcblx0XHRpZiBmb3VuZCBpcyBmYWxzZSwgdGhlbiBpbmRleCBpcyB0aGUgaW5kZXggd2hlcmUgdGhlIG9iamVjdCBzaG91bGRcblx0XHRiZSBpbnNlcnRlZFxuXG5cdFx0LSB1c2VzIGJpbmFyeSBzZWFyY2hcdFx0XG5cdFx0LSBhcnJheSBkb2VzIG5vdCBpbmNsdWRlIGFueSBkdXBsaWNhdGUgdmFsdWVzXG5cdCovXG5cdGluZGV4T2YodGFyZ2V0X3ZhbHVlKSB7XG5cdFx0Y29uc3QgdGFyZ2V0X2VwID0gZW5kcG9pbnQuZnJvbV9pbnB1dCh0YXJnZXRfdmFsdWUpO1xuXHRcdGxldCBsZWZ0X2lkeCA9IDA7XG5cdFx0bGV0IHJpZ2h0X2lkeCA9IHRoaXMuX2FycmF5Lmxlbmd0aCAtIDE7XG5cdFx0d2hpbGUgKGxlZnRfaWR4IDw9IHJpZ2h0X2lkeCkge1xuXHRcdFx0Y29uc3QgbWlkX2lkeCA9IE1hdGguZmxvb3IoKGxlZnRfaWR4ICsgcmlnaHRfaWR4KSAvIDIpO1xuXHRcdFx0bGV0IG1pZF92YWx1ZSA9IHRoaXMuX2FycmF5W21pZF9pZHhdO1xuXHRcdFx0aWYgKGVuZHBvaW50LmVxKG1pZF92YWx1ZSwgdGFyZ2V0X2VwKSkge1xuXHRcdFx0XHRyZXR1cm4gW3RydWUsIG1pZF9pZHhdOyAvLyBUYXJnZXQgYWxyZWFkeSBleGlzdHMgaW4gdGhlIGFycmF5XG5cdFx0XHR9IGVsc2UgaWYgKGVuZHBvaW50Lmx0KG1pZF92YWx1ZSwgdGFyZ2V0X2VwKSkge1xuXHRcdFx0XHQgIGxlZnRfaWR4ID0gbWlkX2lkeCArIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSByaWdodFxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ICByaWdodF9pZHggPSBtaWRfaWR4IC0gMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIGxlZnRcblx0XHRcdH1cblx0XHR9XG5cdCAgXHRyZXR1cm4gW2ZhbHNlLCBsZWZ0X2lkeF07IC8vIFJldHVybiB0aGUgaW5kZXggd2hlcmUgdGFyZ2V0IHNob3VsZCBiZSBpbnNlcnRlZFxuXHR9XG5cblx0Lypcblx0XHRmaW5kIGluZGV4IG9mIHNtYWxsZXN0IHZhbHVlIHdoaWNoIGlzIGdyZWF0ZXIgdGhhbiBvciBlcXVhbCB0byB0YXJnZXQgdmFsdWVcblx0XHRyZXR1cm5zIC0xIGlmIG5vIHN1Y2ggdmFsdWUgZXhpc3RzXG5cdCovXG5cdGdlSW5kZXhPZih0YXJnZXRfdmFsdWUpIHtcblx0XHRsZXQgW2ZvdW5kLCBpZHhdID0gdGhpcy5pbmRleE9mKHRhcmdldF92YWx1ZSk7XG5cdFx0cmV0dXJuIChpZHggPCB0aGlzLl9hcnJheS5sZW5ndGgpID8gaWR4IDogLTEgIFxuXHR9XG5cblx0Lypcblx0XHRmaW5kIGluZGV4IG9mIGxhcmdlc3QgdmFsdWUgd2hpY2ggaXMgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIHRhcmdldCB2YWx1ZVxuXHRcdHJldHVybnMgLTEgaWYgbm8gc3VjaCB2YWx1ZSBleGlzdHNcblx0Ki9cblx0bGVJbmRleE9mKHRhcmdldF92YWx1ZSkge1xuXHRcdGxldCBbZm91bmQsIGlkeF0gPSB0aGlzLmluZGV4T2YodGFyZ2V0X3ZhbHVlKTtcblx0XHRpZHggPSAoZm91bmQpID8gaWR4IDogaWR4LTE7XG5cdFx0cmV0dXJuIChpZHggPj0gMCkgPyBpZHggOiAtMTtcblx0fVxuXG5cdC8qXG5cdFx0ZmluZCBpbmRleCBvZiBzbWFsbGVzdCB2YWx1ZSB3aGljaCBpcyBncmVhdGVyIHRoYW4gdGFyZ2V0IHZhbHVlXG5cdFx0cmV0dXJucyAtMSBpZiBubyBzdWNoIHZhbHVlIGV4aXN0c1xuXHQqL1xuXHRndEluZGV4T2YodGFyZ2V0X3ZhbHVlKSB7XG5cdFx0bGV0IFtmb3VuZCwgaWR4XSA9IHRoaXMuaW5kZXhPZih0YXJnZXRfdmFsdWUpO1xuXHRcdGlkeCA9IChmb3VuZCkgPyBpZHggKyAxIDogaWR4O1xuXHRcdHJldHVybiAoaWR4IDwgdGhpcy5fYXJyYXkubGVuZ3RoKSA/IGlkeCA6IC0xICBcblx0fVxuXG5cdC8qXG5cdFx0ZmluZCBpbmRleCBvZiBsYXJnZXN0IHZhbHVlIHdoaWNoIGlzIGxlc3MgdGhhbiB0YXJnZXQgdmFsdWVcblx0XHRyZXR1cm5zIC0xIGlmIG5vIHN1Y2ggdmFsdWUgZXhpc3RzXG5cdCovXG5cdGx0SW5kZXhPZih0YXJnZXRfdmFsdWUpIHtcblx0XHRsZXQgW2ZvdW5kLCBpZHhdID0gdGhpcy5pbmRleE9mKHRhcmdldF92YWx1ZSk7XG5cdFx0aWR4ID0gaWR4LTE7XG5cdFx0cmV0dXJuIChpZHggPj0gMCkgPyBpZHggOiAtMTtcdFxuXHR9XG5cblx0Lypcblx0XHRVUERBVEVcblxuXHRcdGFwcHJvYWNoIC0gbWFrZSBhbGwgbmVjY2Vzc2FyeSBjaGFuZ2VzIGFuZCB0aGVuIHNvcnRcblxuXHRcdGFzIGEgcnVsZSBvZiB0aHVtYiAtIGNvbXBhcmVkIHRvIHJlbW92aW5nIGFuZCBpbnNlcnRpbmcgZWxlbWVudHNcblx0XHRvbmUgYnkgb25lLCB0aGlzIGlzIG1vcmUgZWZmZWN0aXZlIGZvciBsYXJnZXIgYmF0Y2hlcywgc2F5ID4gMTAwLlxuXHRcdEV2ZW4gdGhvdWdoIHRoaXMgbWlnaHQgbm90IGJlIHRoZSBjb21tb24gY2FzZSwgcGVuYWx0aWVzIGZvclxuXHRcdGNob29zaW5nIHRoZSB3cm9uZyBhcHByb2FjaCBpcyBoaWdoZXIgZm9yIGxhcmdlciBiYXRjaGVzLlxuXG5cdFx0cmVtb3ZlIGlzIHByb2Nlc3NlZCBmaXJzdCwgc28gaWYgYSB2YWx1ZSBhcHBlYXJzIGluIGJvdGggXG5cdFx0cmVtb3ZlIGFuZCBpbnNlcnQsIGl0IHdpbGwgcmVtYWluLlxuXHRcdHVuZGVmaW5lZCB2YWx1ZXMgY2FuIG5vdCBiZSBpbnNlcnRlZCBcblxuXHQqL1xuXG5cdHVwZGF0ZShyZW1vdmVfbGlzdD1bXSwgaW5zZXJ0X2xpc3Q9W10pIHtcblxuXHRcdC8qXG5cdFx0XHRyZW1vdmVcblxuXHRcdFx0cmVtb3ZlIGJ5IGZsYWdnaW5nIGVsZW1lbnRzIGFzIHVuZGVmaW5lZFxuXHRcdFx0LSBjb2xsZWN0IGFsbCBpbmRleGVzIGZpcnN0XG5cdFx0XHQtIGZsYWcgYXMgdW5kZWZpbmVkIG9ubHkgYWZ0ZXIgYWxsIGluZGV4ZXMgaGF2ZSBiZWVuIGZvdW5kLFxuXHRcdFx0ICBhcyBpbnNlcnRpbmcgdW5kZWZpbmVkIHZhbHVlcyBicmVha2VzIHRoZSBhc3N1bXB0aW9uIHRoYXRcblx0XHRcdCAgdGhlIGFycmF5IGlzIHNvcnRlZC5cblx0XHRcdC0gbGF0ZXIgc29ydCB3aWxsIG1vdmUgdGhlbSB0byB0aGUgZW5kLCB3aGVyZSB0aGV5IGNhbiBiZVxuXHRcdFx0ICB0cnVuY2F0ZWQgb2ZmXG5cdFx0Ki9cblx0XHRsZXQgcmVtb3ZlX2lkeF9saXN0ID0gW107XG5cdFx0Zm9yIChsZXQgdmFsdWUgb2YgcmVtb3ZlX2xpc3QpIHtcblx0XHRcdGxldCBbZm91bmQsIGlkeF0gPSB0aGlzLmluZGV4T2YodmFsdWUpO1xuXHRcdFx0aWYgKGZvdW5kKSB7XG5cdFx0XHRcdHJlbW92ZV9pZHhfbGlzdC5wdXNoKGlkeCk7XG5cdFx0XHR9XHRcdFxuXHRcdH1cblx0XHRmb3IgKGxldCBpZHggb2YgcmVtb3ZlX2lkeF9saXN0KSB7XG5cdFx0XHR0aGlzLl9hcnJheVtpZHhdID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRsZXQgYW55X3JlbW92ZXMgPSByZW1vdmVfaWR4X2xpc3QubGVuZ3RoID4gMDtcblxuXHRcdC8qXG5cdFx0XHRpbnNlcnRcblxuXHRcdFx0aW5zZXJ0IG1pZ2h0IGludHJvZHVjZSBkdXBsaWNhdGlvbnMsIGVpdGhlciBiZWNhdXNlXG5cdFx0XHR0aGUgaW5zZXJ0IGxpc3QgaW5jbHVkZXMgZHVwbGljYXRlcywgb3IgYmVjYXVzZSB0aGVcblx0XHRcdGluc2VydCBsaXN0IGR1cGxpY2F0ZXMgcHJlZXhpc3RpbmcgdmFsdWVzLlxuXG5cdFx0XHRJbnN0ZWFkIG9mIGxvb2tpbmcgdXAgYW5kIGNoZWNraW5nIGVhY2ggaW5zZXJ0IHZhbHVlLFxuXHRcdFx0d2UgaW5zdGVhZCBpbnNlcnQgZXZlcnl0aGluZyBhdCB0aGUgZW5kIG9mIHRoZSBhcnJheSxcblx0XHRcdGFuZCByZW1vdmUgZHVwbGljYXRlcyBvbmx5IGFmdGVyIHdlIGhhdmUgc29ydGVkLlxuXHRcdCovXG5cdFx0bGV0IGFueV9pbnNlcnRzID0gaW5zZXJ0X2xpc3QubGVuZ3RoID4gMDtcblx0XHRpZiAoYW55X2luc2VydHMpIHtcblx0XHRcdGNvbmNhdF9pbl9wbGFjZSh0aGlzLl9hcnJheSwgaW5zZXJ0X2xpc3QpO1xuXHRcdH1cblxuXHRcdC8qXG5cdFx0XHRzb3J0XG5cdFx0XHR0aGlzIHB1c2hlcyBhbnkgdW5kZWZpbmVkIHZhbHVlcyB0byB0aGUgZW5kIFxuXHRcdCovXG5cdFx0aWYgKGFueV9yZW1vdmVzIHx8IGFueV9pbnNlcnRzKSB7XG5cdFx0XHR0aGlzLl9hcnJheS5zb3J0KGVuZHBvaW50LmNtcCk7XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRcdHJlbW92ZSB1bmRlZmluZWQgXG5cdFx0XHRhbGwgdW5kZWZpbmVkIHZhbHVlcyBhcmUgcHVzaGVkIHRvIHRoZSBlbmRcblx0XHQqL1xuXHRcdGlmIChhbnlfcmVtb3Zlcykge1xuXHRcdFx0dGhpcy5fYXJyYXkubGVuZ3RoIC09IHJlbW92ZV9pZHhfbGlzdC5sZW5ndGg7XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRcdHJlbW92ZSBkdXBsaWNhdGVzIGZyb20gc29ydGVkIGFycmF5XG5cdFx0XHQtIGFzc3VtaW5nIHRoZXJlIGFyZSBnb2luZyB0byBiZSBmZXcgZHVwbGljYXRlcyxcblx0XHRcdCAgaXQgaXMgb2sgdG8gcmVtb3ZlIHRoZW0gb25lIGJ5IG9uZVxuXG5cdFx0Ki9cblx0XHRpZiAoYW55X2luc2VydHMpIHtcblx0XHRcdHJlbW92ZV9kdXBsaWNhdGVzKHRoaXMuX2FycmF5KTtcblx0XHR9XG5cdH1cblxuXHQvKlxuXHRcdGdldCBlbGVtZW50IGJ5IGluZGV4XG5cdCovXG5cdGdldF9ieV9pbmRleChpZHgpIHtcblx0XHRpZiAoaWR4ID4gLTEgJiYgaWR4IDwgdGhpcy5fYXJyYXkubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYXJyYXlbaWR4XTtcblx0XHR9XG5cdH1cblxuXHQvKlxuXHRcdGxvb2t1cCB2YWx1ZXMgd2l0aGluIGludGVydmFsXG5cdCovXG5cdGxvb2t1cChpdHYpIHtcblx0XHRpZiAoaXR2ID09IHVuZGVmaW5lZCkge1xuXHRcdFx0aXR2ID0gW251bGwsIG51bGwsIHRydWUsIHRydWVdO1xuXHRcdH1cblx0XHRsZXQgW2VwXzAsIGVwXzFdID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdHYpO1xuXHRcdGxldCBpZHhfMCA9IHRoaXMuZ2VJbmRleE9mKGVwXzApO1xuXHRcdGxldCBpZHhfMSA9IHRoaXMubGVJbmRleE9mKGVwXzEpO1xuXHRcdGlmIChpZHhfMCA9PSAtMSB8fCBpZHhfMSA9PSAtMSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYXJyYXkuc2xpY2UoaWR4XzAsIGlkeF8xKzEpO1xuXHRcdH1cblx0fVxuXG5cdGx0IChvZmZzZXQpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRfYnlfaW5kZXgodGhpcy5sdEluZGV4T2Yob2Zmc2V0KSk7XG5cdH1cblx0bGUgKG9mZnNldCkge1xuXHRcdHJldHVybiB0aGlzLmdldF9ieV9pbmRleCh0aGlzLmxlSW5kZXhPZihvZmZzZXQpKTtcblx0fVxuXHRnZXQgKG9mZnNldCkge1xuXHRcdGxldCBbZm91bmQsIGlkeF0gPSB0aGlzLmluZGV4T2Yob2Zmc2V0KTtcblx0XHRpZiAoZm91bmQpIHtcblx0XHRcdHJldHVybiB0aGlzLl9hcnJheVtpZHhdO1xuXHRcdH0gXG5cdH1cblx0Z3QgKG9mZnNldCkge1xuXHRcdHJldHVybiB0aGlzLmdldF9ieV9pbmRleCh0aGlzLmd0SW5kZXhPZihvZmZzZXQpKTtcblx0fVxuXHRnZSAob2Zmc2V0KSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0X2J5X2luZGV4KHRoaXMuZ2VJbmRleE9mKG9mZnNldCkpO1xuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXHRVVElMU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuXHRDb25jYXRpbmF0ZSB0d28gYXJyYXlzIGJ5IGFwcGVuZGluZyB0aGUgc2Vjb25kIGFycmF5IHRvIHRoZSBmaXJzdCBhcnJheS4gXG4qL1xuXG5mdW5jdGlvbiBjb25jYXRfaW5fcGxhY2UoZmlyc3RfYXJyLCBzZWNvbmRfYXJyKSB7XG5cdGNvbnN0IGZpcnN0X2Fycl9sZW5ndGggPSBmaXJzdF9hcnIubGVuZ3RoO1xuXHRjb25zdCBzZWNvbmRfYXJyX2xlbmd0aCA9IHNlY29uZF9hcnIubGVuZ3RoO1xuICBcdGZpcnN0X2Fyci5sZW5ndGggKz0gc2Vjb25kX2Fycl9sZW5ndGg7XG4gIFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzZWNvbmRfYXJyX2xlbmd0aDsgaSsrKSB7XG4gICAgXHRmaXJzdF9hcnJbZmlyc3RfYXJyX2xlbmd0aCArIGldID0gc2Vjb25kX2FycltpXTtcbiAgXHR9XG59XG5cbi8qXG5cdHJlbW92ZSBkdXBsaWNhdGVzIGluIGEgc29ydGVkIGFycmF5XG4qL1xuZnVuY3Rpb24gcmVtb3ZlX2R1cGxpY2F0ZXMoc29ydGVkX2Fycikge1xuXHRsZXQgaSA9IDA7XG5cdHdoaWxlICh0cnVlKSB7XG5cdFx0aWYgKGkgKyAxID49IHNvcnRlZF9hcnIubGVuZ3RoKSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdFx0aWYgKGVuZHBvaW50LmVxKHNvcnRlZF9hcnJbaV0sIHNvcnRlZF9hcnJbaSArIDFdKSkge1xuXHRcdFx0c29ydGVkX2Fyci5zcGxpY2UoaSArIDEsIDEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpICs9IDE7XG5cdFx0fVxuXHR9XG59XG4iLCJpbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UsIG5lYXJieV9mcm9tIH0gZnJvbSBcIi4vbmVhcmJ5X2Jhc2UuanNcIjtcbmltcG9ydCB7IFNvcnRlZEFycmF5IH0gZnJvbSBcIi4vdXRpbC9zb3J0ZWRhcnJheS5qc1wiO1xuaW1wb3J0IHsgaXNfY29sbGVjdGlvbl9wcm92aWRlciB9IGZyb20gXCIuL3Byb3ZpZGVyX2NvbGxlY3Rpb24uanNcIjtcbmltcG9ydCB7IGlzX29iamVjdF9wcm92aWRlciB9IGZyb20gXCIuL3Byb3ZpZGVyX29iamVjdC5qc1wiO1xuXG5jb25zdCB7TE9XX0NMT1NFRCwgTE9XX09QRU4sIEhJR0hfQ0xPU0VELCBISUdIX09QRU59ID0gZW5kcG9pbnQudHlwZXM7XG5jb25zdCBFUF9UWVBFUyA9IFtMT1dfQ0xPU0VELCBMT1dfT1BFTiwgSElHSF9DTE9TRUQsIEhJR0hfT1BFTl07XG5cblxuLy8gU2V0IG9mIHVuaXF1ZSBbdiwgdF0gZW5kcG9pbnRzXG5jbGFzcyBFbmRwb2ludFNldCB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuX21hcCA9IG5ldyBNYXAoW1xuXHRcdFx0W0xPV19DTE9TRUQsIG5ldyBTZXQoKV0sXG5cdFx0XHRbTE9XX09QRU4sIG5ldyBTZXQoKV0sIFxuXHRcdFx0W0hJR0hfQ0xPU0VELCBuZXcgU2V0KCldLCBcblx0XHRcdFtISUdIX09QRU4sIG5ldyBTZXQoKV1cblx0XHRdKTtcblx0fVxuXHRhZGQoZXApIHtcblx0XHRjb25zdCBbdmFsdWUsIHR5cGVdID0gZXA7XG5cdFx0cmV0dXJuIHRoaXMuX21hcC5nZXQodHlwZSkuYWRkKHZhbHVlKTtcblx0fVxuXHRoYXMgKGVwKSB7XG5cdFx0Y29uc3QgW3ZhbHVlLCB0eXBlXSA9IGVwO1xuXHRcdHJldHVybiB0aGlzLl9tYXAuZ2V0KHR5cGUpLmhhcyh2YWx1ZSk7XG5cdH1cblx0Z2V0KGVwKSB7XG5cdFx0Y29uc3QgW3ZhbHVlLCB0eXBlXSA9IGVwO1xuXHRcdHJldHVybiB0aGlzLl9tYXAuZ2V0KHR5cGUpLmdldCh2YWx1ZSk7XG5cdH1cblxuXHRsaXN0KCkge1xuXHRcdGNvbnN0IGxpc3RzID0gRVBfVFlQRVMubWFwKCh0eXBlKSA9PiB7XG5cdFx0XHRyZXR1cm4gWy4uLnRoaXMuX21hcC5nZXQodHlwZSkudmFsdWVzKCldXG5cdFx0XHRcdC5tYXAoKHZhbHVlKSA9PiBbdmFsdWUsIHR5cGVdKTtcblx0XHR9KTtcblx0XHRyZXR1cm4gW10uY29uY2F0KC4uLmxpc3RzKTtcblx0fVxufVxuXG4vKipcbiAqIElURU1TIE1BUFxuICogXG4gKiBtYXAgZW5kcG9pbnQgLT4ge1xuICogXHRsb3c6IFtpdGVtc10sIFxuICogIGFjdGl2ZTogW2l0ZW1zXSwgXG4gKiAgaGlnaDpbaXRlbXNdXG4gKiB9XG4gKiBcbiAqIGluIG9yZGVyIHRvIHVzZSBlbmRwb2ludCBbdix0XSBhcyBhIG1hcCBrZXkgd2UgY3JlYXRlIGEgdHdvIGxldmVsXG4gKiBtYXAgLSB1c2luZyB0IGFzIHRoZSBmaXJzdCB2YXJpYWJsZS4gXG4gKiBcbiAqL1xuXG5cbmNvbnN0IExPVyA9IFwibG93XCI7XG5jb25zdCBBQ1RJVkUgPSBcImFjdGl2ZVwiO1xuY29uc3QgSElHSCA9IFwiaGlnaFwiO1xuXG5cbmNsYXNzIEl0ZW1zTWFwIHtcblxuXHRjb25zdHJ1Y3RvciAoKSB7XG5cdFx0Ly8gbWFwIGVuZHBvaW50IC0+IHtsb3c6IFtpdGVtc10sIGFjdGl2ZTogW2l0ZW1zXSwgaGlnaDpbaXRlbXNdfVxuXHRcdHRoaXMuX21hcCA9IG5ldyBNYXAoW1xuXHRcdFx0W0xPV19DTE9TRUQsIG5ldyBNYXAoKV0sXG5cdFx0XHRbTE9XX09QRU4sIG5ldyBNYXAoKV0sIFxuXHRcdFx0W0hJR0hfQ0xPU0VELCBuZXcgTWFwKCldLCBcblx0XHRcdFtISUdIX09QRU4sIG5ldyBNYXAoKV1cblx0XHRdKTtcblx0fVxuXG5cdGdldF9pdGVtc19ieV9yb2xlIChlcCwgcm9sZSkge1xuXHRcdGNvbnN0IFt2YWx1ZSwgdHlwZV0gPSBlcDtcblx0XHRjb25zdCBlbnRyeSA9IHRoaXMuX21hcC5nZXQodHlwZSkuZ2V0KHZhbHVlKTtcblx0XHRyZXR1cm4gKGVudHJ5ICE9IHVuZGVmaW5lZCkgPyBlbnRyeVtyb2xlXSA6IFtdO1xuXHR9XG5cblx0Lypcblx0XHRyZWdpc3RlciBpdGVtIHdpdGggZW5kcG9pbnQgKGlkZW1wb3RlbnQpXG5cdFx0cmV0dXJuIHRydWUgaWYgdGhpcyB3YXMgdGhlIGZpcnN0IExPVyBvciBISUdIIFxuXHQgKi9cblx0cmVnaXN0ZXIoZXAsIGl0ZW0sIHJvbGUpIHtcblx0XHRjb25zdCBbdmFsdWUsIHR5cGVdID0gZXA7XG5cdFx0Y29uc3QgdHlwZV9tYXAgPSB0aGlzLl9tYXAuZ2V0KHR5cGUpO1xuXHRcdGlmICghdHlwZV9tYXAuaGFzKHZhbHVlKSkge1xuXHRcdFx0dHlwZV9tYXAuc2V0KHZhbHVlLCB7bG93OiBbXSwgYWN0aXZlOltdLCBoaWdoOltdfSk7XG5cdFx0fVxuXHRcdGNvbnN0IGVudHJ5ID0gdHlwZV9tYXAuZ2V0KHZhbHVlKTtcblx0XHRjb25zdCB3YXNfZW1wdHkgPSBlbnRyeVtMT1ddLmxlbmd0aCArIGVudHJ5W0hJR0hdLmxlbmd0aCA9PSAwO1xuXHRcdGxldCBpZHggPSBlbnRyeVtyb2xlXS5maW5kSW5kZXgoKF9pdGVtKSA9PiB7XG5cdFx0XHRyZXR1cm4gX2l0ZW0uaWQgPT0gaXRlbS5pZDtcblx0XHR9KTtcblx0XHRpZiAoaWR4ID09IC0xKSB7XG5cdFx0XHRlbnRyeVtyb2xlXS5wdXNoKGl0ZW0pO1xuXHRcdH1cblx0XHRjb25zdCBpc19lbXB0eSA9IGVudHJ5W0xPV10ubGVuZ3RoICsgZW50cnlbSElHSF0ubGVuZ3RoID09IDA7XG5cdFx0cmV0dXJuIHdhc19lbXB0eSAmJiAhaXNfZW1wdHk7XG5cdH1cblxuXHQvKlxuXHRcdHVucmVnaXN0ZXIgaXRlbSB3aXRoIGVuZHBvaW50IChpbmRlcGVuZGVudCBvZiByb2xlKVxuXHRcdHJldHVybiB0cnVlIGlmIHRoaXMgcmVtb3ZlZCBsYXN0IExPVyBvciBISUdIXG5cdCAqL1xuXHR1bnJlZ2lzdGVyKGVwLCBpdGVtKSB7XG5cdFx0Y29uc3QgW3ZhbHVlLCB0eXBlXSA9IGVwO1xuXHRcdGNvbnN0IHR5cGVfbWFwID0gdGhpcy5fbWFwLmdldCh0eXBlKTtcblx0XHRjb25zdCBlbnRyeSA9IHR5cGVfbWFwLmdldCh2YWx1ZSk7XG5cdFx0aWYgKGVudHJ5ICE9IHVuZGVmaW5lZCkge1xuXHRcdFx0Y29uc3Qgd2FzX2VtcHR5ID0gZW50cnlbTE9XXS5sZW5ndGggKyBlbnRyeVtISUdIXS5sZW5ndGggPT0gMDtcblx0XHRcdC8vIHJlbW92ZSBhbGwgbWVudGlvbmVzIG9mIGl0ZW1cblx0XHRcdGZvciAoY29uc3Qgcm9sZSBvZiBbTE9XLCBBQ1RJVkUsIEhJR0hdKSB7XG5cdFx0XHRcdGxldCBpZHggPSBlbnRyeVtyb2xlXS5maW5kSW5kZXgoKF9pdGVtKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIF9pdGVtLmlkID09IGl0ZW0uaWQ7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpZiAoaWR4ID4gLTEpIHtcblx0XHRcdFx0XHRlbnRyeVtyb2xlXS5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdFx0fVx0XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpc19lbXB0eSA9IGVudHJ5W0xPV10ubGVuZ3RoICsgZW50cnlbSElHSF0ubGVuZ3RoID09IDA7XG5cdFx0XHRpZiAoIXdhc19lbXB0eSAmJiBpc19lbXB0eSkge1xuXHRcdFx0XHQvLyBjbGVhbiB1cCBlbnRyeVxuXHRcdFx0XHR0eXBlX21hcC5kZWxldGUodmFsdWUpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5cblxuLyoqXG4gKiBOZWFyYnlJbmRleFxuICogXG4gKiBOZWFyYnlJbmRleCBmb3IgQ29sbGVjdGlvblByb3ZpZGVyIG9yIFZhcmlhYmxlUHJvdmlkZXJcbiAqL1xuXG5leHBvcnQgY2xhc3MgTmVhcmJ5SW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Ioc3RhdGVQcm92aWRlcikge1xuICAgICAgICBzdXBlcigpO1x0XHRcblxuXHRcdGlmIChcblx0XHRcdCFpc19jb2xsZWN0aW9uX3Byb3ZpZGVyKHN0YXRlUHJvdmlkZXIpICYmXG5cdFx0XHQhaXNfb2JqZWN0X3Byb3ZpZGVyKHN0YXRlUHJvdmlkZXIpXG5cdFx0KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYHN0YXRlUHJvdmlkZXIgbXVzdCBiZSBjb2xsZWN0aW9uUHJvdmlkZXIgb3IgdmFyaWFibGVQcm92aWRlciAke3N0YXRlUHJvdmlkZXJ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fc3AgPSBzdGF0ZVByb3ZpZGVyO1xuXHRcdHRoaXMuX2luaXRpYWxpc2UoKTtcblx0XHR0aGlzLnJlZnJlc2goKTtcblx0fVxuXG4gICAgZ2V0IHNyYyAoKSB7cmV0dXJuIHRoaXMuX3NwO31cblxuXG5cdF9pbml0aWFsaXNlKCkge1xuXHRcdC8vIHJlZ2lzdGVyIGl0ZW1zIHdpdGggZW5kcG9pbnRzXG5cdFx0dGhpcy5faXRlbXNtYXAgPSBuZXcgSXRlbXNNYXAoKTtcblx0XHQvLyBzb3J0ZWQgaW5kZXhcblx0XHR0aGlzLl9lbmRwb2ludHMgPSBuZXcgU29ydGVkQXJyYXkoKTtcblx0XHQvLyBzd2lwZSBpbmRleFxuXHRcdHRoaXMuX2luZGV4ID0gW107XG5cdH1cblxuXG5cdHJlZnJlc2goZGlmZnMpIHtcblxuXHRcdGNvbnN0IHJlbW92ZV9lbmRwb2ludHMgPSBuZXcgRW5kcG9pbnRTZXQoKTtcblx0XHRjb25zdCBpbnNlcnRfZW5kcG9pbnRzID0gbmV3IEVuZHBvaW50U2V0KCk7XG5cblx0XHRsZXQgaW5zZXJ0X2l0ZW1zID0gW107XG5cdFx0bGV0IHJlbW92ZV9pdGVtcyA9IFtdO1xuXG5cdFx0aWYgKGRpZmZzID09IHVuZGVmaW5lZCkge1xuXHRcdFx0aW5zZXJ0X2l0ZW1zID0gdGhpcy5zcmMuZ2V0KCkgfHwgW107XG5cdFx0XHQvLyBjbGVhciBhbGwgc3RhdGVcblx0XHRcdHRoaXMuX2luaXRpYWxpc2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gY29sbGVjdCBpbnNlcnQgaXRlbXMgYW5kIHJlbW92ZSBpdGVtc1xuXHRcdFx0Zm9yIChjb25zdCBkaWZmIG9mIGRpZmZzKSB7XG5cdFx0XHRcdGlmIChkaWZmLm5ldyAhPSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRpbnNlcnRfaXRlbXMucHVzaChkaWZmLm5ldyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGRpZmYub2xkICE9IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJlbW92ZV9pdGVtcy5wdXNoKGRpZmYub2xkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qXG5cdFx0XHR1bnJlZ2lzdGVyIHJlbW92ZSBpdGVtcyBhY3Jvc3MgYWxsIGVuZHBvaW50cyBcblx0XHRcdHdoZXJlIHRoZXkgd2VyZSByZWdpc3RlcmVkIChMT1csIEFDVElWRSwgSElHSCkgXG5cdFx0Ki9cblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgcmVtb3ZlX2l0ZW1zKSB7XHRcdFx0XG5cdFx0XHRmb3IgKGNvbnN0IGVwIG9mIHRoaXMuX2VuZHBvaW50cy5sb29rdXAoaXRlbS5pdHYpKSB7XG5cdFx0XHRcdC8vIFRPRE86IGNoZWNrIGlmIHRoaXMgaXMgY29ycmVjdFxuXHRcdFx0XHRjb25zdCBiZWNhbWVfZW1wdHkgPSB0aGlzLl9pdGVtc21hcC51bnJlZ2lzdGVyKGVwLCBpdGVtKTtcblx0XHRcdFx0aWYgKGJlY2FtZV9lbXB0eSkgcmVtb3ZlX2VuZHBvaW50cy5hZGQoZXApO1xuXHRcdFx0fVx0XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRcdHJlZ2lzdGVyIG5ldyBpdGVtcyBhY3Jvc3MgYWxsIGVuZHBvaW50cyBcblx0XHRcdHdoZXJlIHRoZXkgc2hvdWxkIGJlIHJlZ2lzdGVyZWQgKExPVywgSElHSCkgXG5cdFx0Ki9cblx0XHRsZXQgYmVjYW1lX25vbmVtcHR5O1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBpbnNlcnRfaXRlbXMpIHtcblx0XHRcdGNvbnN0IFtsb3csIGhpZ2hdID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dik7XG5cdFx0XHRiZWNhbWVfbm9uZW1wdHkgPSB0aGlzLl9pdGVtc21hcC5yZWdpc3Rlcihsb3csIGl0ZW0sIExPVyk7XG5cdFx0XHRpZiAoYmVjYW1lX25vbmVtcHR5KSBpbnNlcnRfZW5kcG9pbnRzLmFkZChsb3cpO1xuXHRcdFx0YmVjYW1lX25vbmVtcHR5ID0gdGhpcy5faXRlbXNtYXAucmVnaXN0ZXIoaGlnaCwgaXRlbSwgSElHSCk7XG5cdFx0XHRpZiAoYmVjYW1lX25vbmVtcHR5KSBpbnNlcnRfZW5kcG9pbnRzLmFkZChoaWdoKTtcblx0XHR9XG5cblx0XHQvKlxuXHRcdFx0cmVmcmVzaCBzb3J0ZWQgZW5kcG9pbnRzXG5cdFx0XHRwb3NzaWJsZSB0aGF0IGFuIGVuZHBvaW50IGlzIHByZXNlbnQgaW4gYm90aCBsaXN0c1xuXHRcdFx0dGhpcyBpcyBwcmVzdW1hYmx5IG5vdCBhIHByb2JsZW0gd2l0aCBTb3J0ZWRBcnJheS5cblx0XHQqL1xuXHRcdHRoaXMuX2VuZHBvaW50cy51cGRhdGUoXG5cdFx0XHRyZW1vdmVfZW5kcG9pbnRzLmxpc3QoKSwgXG5cdFx0XHRpbnNlcnRfZW5kcG9pbnRzLmxpc3QoKVxuXHRcdCk7XG5cblx0XHQvKlxuXHRcdFx0c3dpcGUgb3ZlciB0byBlbnN1cmUgdGhhdCBhbGwgaXRlbXMgYXJlIGFjdGl2YXRlXG5cdFx0Ki9cblx0XHRjb25zdCBhY3RpdmVTZXQgPSBuZXcgU2V0KCk7XG5cdFx0Zm9yIChjb25zdCBlcCBvZiB0aGlzLl9lbmRwb2ludHMuYXJyYXkpIHtcdFxuXHRcdFx0Ly8gQWRkIGl0ZW1zIHdpdGggZXAgYXMgbG93IHBvaW50XG5cdFx0XHRmb3IgKGxldCBpdGVtIG9mIHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKGVwLCBMT1cpKSB7XG5cdFx0XHRcdGFjdGl2ZVNldC5hZGQoaXRlbSk7XG5cdFx0XHR9O1xuXHRcdFx0Ly8gYWN0aXZhdGUgdXNpbmcgYWN0aXZlU2V0XG5cdFx0XHRmb3IgKGxldCBpdGVtIG9mIGFjdGl2ZVNldCkge1xuXHRcdFx0XHR0aGlzLl9pdGVtc21hcC5yZWdpc3RlcihlcCwgaXRlbSwgQUNUSVZFKTtcblx0XHRcdH1cblx0XHRcdC8vIFJlbW92ZSBpdGVtcyB3aXRoIHAxIGFzIGhpZ2ggcG9pbnRcblx0XHRcdGZvciAobGV0IGl0ZW0gb2YgdGhpcy5faXRlbXNtYXAuZ2V0X2l0ZW1zX2J5X3JvbGUoZXAsIEhJR0gpKSB7XG5cdFx0XHRcdGFjdGl2ZVNldC5kZWxldGUoaXRlbSk7XG5cdFx0XHR9O1x0XG5cdFx0fVxuXHR9XG5cblx0X2NvdmVycyAob2Zmc2V0KSB7XG5cdFx0Y29uc3QgZXAgPSBlbmRwb2ludC5mcm9tX2lucHV0KG9mZnNldCk7XG5cdFx0Y29uc3QgZXAxID0gdGhpcy5fZW5kcG9pbnRzLmxlKGVwKSB8fCBlbmRwb2ludC5ORUdfSU5GO1xuXHRcdGNvbnN0IGVwMiA9IHRoaXMuX2VuZHBvaW50cy5nZShlcCkgfHwgZW5kcG9pbnQuUE9TX0lORjtcblx0XHRpZiAoZW5kcG9pbnQuZXEoZXAxLCBlcDIpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5faXRlbXNtYXAuZ2V0X2l0ZW1zX2J5X3JvbGUoZXAxLCBBQ1RJVkUpO1x0XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGdldCBpdGVtcyBmb3IgYm90aCBlbmRwb2ludHNcblx0XHRcdGNvbnN0IGl0ZW1zMSA9IHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKGVwMSwgQUNUSVZFKTtcblx0XHRcdGNvbnN0IGl0ZW1zMiA9IHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKGVwMiwgQUNUSVZFKTtcblx0XHRcdC8vIHJldHVybiBhbGwgaXRlbXMgdGhhdCBhcmUgYWN0aXZlIGluIGJvdGggZW5kcG9pbnRzXG5cdFx0XHRjb25zdCBpZFNldCA9IG5ldyBTZXQoaXRlbXMxLm1hcChpdGVtID0+IGl0ZW0uaWQpKTtcblx0XHRcdHJldHVybiBpdGVtczIuZmlsdGVyKGl0ZW0gPT4gaWRTZXQuaGFzKGl0ZW0uaWQpKTtcblx0XHR9XG5cdH1cblxuICAgIC8qXG5cdFx0bmVhcmJ5IChvZmZzZXQpXG4gICAgKi9cblx0bmVhcmJ5KG9mZnNldCkge1xuXHRcdGNvbnN0IGVwID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuXG5cdFx0Ly8gY2VudGVyXG5cdFx0bGV0IGNlbnRlciA9IHRoaXMuX2NvdmVycyhlcClcblx0XHRjb25zdCBjZW50ZXJfaGlnaF9saXN0ID0gW107XG5cdFx0Y29uc3QgY2VudGVyX2xvd19saXN0ID0gW107XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIGNlbnRlcikge1xuXHRcdFx0Y29uc3QgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW0uaXR2KTtcblx0XHRcdGNlbnRlcl9oaWdoX2xpc3QucHVzaChoaWdoKTtcblx0XHRcdGNlbnRlcl9sb3dfbGlzdC5wdXNoKGxvdyk7ICAgIFxuXHRcdH1cblxuXHRcdC8vIHByZXYgaGlnaFxuXHRcdGxldCBwcmV2X2hpZ2ggPSBlcDtcblx0XHRsZXQgaXRlbXM7XG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdHByZXZfaGlnaCA9IHRoaXMuX2VuZHBvaW50cy5sdChwcmV2X2hpZ2gpIHx8IGVuZHBvaW50Lk5FR19JTkY7XG5cdFx0XHRpZiAocHJldl9oaWdoWzBdID09IG51bGwpIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHRcdGl0ZW1zID0gdGhpcy5faXRlbXNtYXAuZ2V0X2l0ZW1zX2J5X3JvbGUocHJldl9oaWdoLCBISUdIKTtcblx0XHRcdGlmIChpdGVtcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gbmV4dCBsb3dcblx0XHRsZXQgbmV4dF9sb3cgPSBlcDtcblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0bmV4dF9sb3cgPSB0aGlzLl9lbmRwb2ludHMuZ3QobmV4dF9sb3cpIHx8IGVuZHBvaW50LlBPU19JTkZcblx0XHRcdGlmIChuZXh0X2xvd1swXSA9PSBudWxsKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0XHRpdGVtcyA9IHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKG5leHRfbG93LCBMT1cpO1xuXHRcdFx0aWYgKGl0ZW1zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbmVhcmJ5X2Zyb20oXG5cdFx0XHRwcmV2X2hpZ2gsIFxuXHRcdFx0Y2VudGVyX2xvd19saXN0LCBcblx0XHRcdGNlbnRlcixcblx0XHRcdGNlbnRlcl9oaWdoX2xpc3QsXG5cdFx0XHRuZXh0X2xvd1xuXHRcdCk7XG5cdH1cbn0iLCJpbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgbW90aW9uX3V0aWxzIH0gZnJvbSBcIi4vY29tbW9uLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuQkFTRSBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuXHRBYnN0cmFjdCBCYXNlIENsYXNzIGZvciBTZWdtZW50c1xuXG4gICAgY29uc3RydWN0b3IoaW50ZXJ2YWwpXG5cbiAgICAtIGludGVydmFsOiBpbnRlcnZhbCBvZiB2YWxpZGl0eSBvZiBzZWdtZW50XG4gICAgLSBkeW5hbWljOiB0cnVlIGlmIHNlZ21lbnQgaXMgZHluYW1pY1xuICAgIC0gdmFsdWUob2Zmc2V0KTogdmFsdWUgb2Ygc2VnbWVudCBhdCBvZmZzZXRcbiAgICAtIHF1ZXJ5KG9mZnNldCk6IHN0YXRlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4qL1xuXG5leHBvcnQgY2xhc3MgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0dikge1xuXHRcdHRoaXMuX2l0diA9IGl0djtcblx0fVxuXG5cdGdldCBpdHYoKSB7cmV0dXJuIHRoaXMuX2l0djt9XG5cbiAgICAvKiogXG4gICAgICogaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3NcbiAgICAgKiByZXR1cm5zIHt2YWx1ZSwgZHluYW1pY307XG4gICAgKi9cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjb252ZW5pZW5jZSBmdW5jdGlvbiByZXR1cm5pbmcgdGhlIHN0YXRlIG9mIHRoZSBzZWdtZW50XG4gICAgICogQHBhcmFtIHsqfSBvZmZzZXQgXG4gICAgICogQHJldHVybnMgXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5faXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuc3RhdGUob2Zmc2V0KSwgb2Zmc2V0fTtcbiAgICAgICAgfSBcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdW5kZWZpbmVkLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgIH1cbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU1RBVElDIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIFN0YXRpY1NlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG5cdFx0dGhpcy5fdmFsdWUgPSBkYXRhO1xuXHR9XG5cblx0c3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3ZhbHVlLCBkeW5hbWljOmZhbHNlfVxuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTU9USU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIE1vdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG4gICAgXG4gICAgY29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIHRoaXMuX3ZlY3RvciA9IGRhdGE7XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IFtwLHYsYSx0XSA9IG1vdGlvbl91dGlscy5jYWxjdWxhdGUodGhpcy5fdmVjdG9yLCBvZmZzZXQpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmFsdWU6IHAsIGR5bmFtaWM6ICh2ICE9IDAgfHwgYSAhPSAwICksXG4gICAgICAgICAgICB2ZWN0b3I6IFtwLCB2LCBhLCB0XSxcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBUUkFOU0lUSU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBTdXBwb3J0ZWQgZWFzaW5nIGZ1bmN0aW9uc1xuICAgIFwiZWFzZS1pblwiOlxuICAgIFwiZWFzZS1vdXRcIjpcbiAgICBcImVhc2UtaW4tb3V0XCJcbiovXG5cbmZ1bmN0aW9uIGVhc2VpbiAodHMpIHtcbiAgICByZXR1cm4gTWF0aC5wb3codHMsMik7ICBcbn1cbmZ1bmN0aW9uIGVhc2VvdXQgKHRzKSB7XG4gICAgcmV0dXJuIDEgLSBlYXNlaW4oMSAtIHRzKTtcbn1cbmZ1bmN0aW9uIGVhc2Vpbm91dCAodHMpIHtcbiAgICBpZiAodHMgPCAuNSkge1xuICAgICAgICByZXR1cm4gZWFzZWluKDIgKiB0cykgLyAyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAoMiAtIGVhc2VpbigyICogKDEgLSB0cykpKSAvIDI7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgVHJhbnNpdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG5cdFx0c3VwZXIoaXR2KTtcbiAgICAgICAgbGV0IHt2MCwgdjEsIGVhc2luZ30gPSBkYXRhO1xuICAgICAgICBsZXQgW3QwLCB0MV0gPSB0aGlzLl9pdHYuc2xpY2UoMCwyKTtcblxuICAgICAgICAvLyBjcmVhdGUgdGhlIHRyYW5zaXRpb24gZnVuY3Rpb25cbiAgICAgICAgdGhpcy5fZHluYW1pYyA9IHYxLXYwICE9IDA7XG4gICAgICAgIHRoaXMuX3RyYW5zID0gZnVuY3Rpb24gKHRzKSB7XG4gICAgICAgICAgICAvLyBjb252ZXJ0IHRzIHRvIFt0MCx0MV0tc3BhY2VcbiAgICAgICAgICAgIC8vIC0gc2hpZnQgZnJvbSBbdDAsdDFdLXNwYWNlIHRvIFswLCh0MS10MCldLXNwYWNlXG4gICAgICAgICAgICAvLyAtIHNjYWxlIGZyb20gWzAsKHQxLXQwKV0tc3BhY2UgdG8gWzAsMV0tc3BhY2VcbiAgICAgICAgICAgIHRzID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHRzID0gdHMvcGFyc2VGbG9hdCh0MS10MCk7XG4gICAgICAgICAgICAvLyBlYXNpbmcgZnVuY3Rpb25zIHN0cmV0Y2hlcyBvciBjb21wcmVzc2VzIHRoZSB0aW1lIHNjYWxlIFxuICAgICAgICAgICAgaWYgKGVhc2luZyA9PSBcImVhc2UtaW5cIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZWluKHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWFzaW5nID09IFwiZWFzZS1vdXRcIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZW91dCh0cyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVhc2luZyA9PSBcImVhc2UtaW4tb3V0XCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2Vpbm91dCh0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBsaW5lYXIgdHJhbnNpdGlvbiBmcm9tIHYwIHRvIHYxLCBmb3IgdGltZSB2YWx1ZXMgWzAsMV1cbiAgICAgICAgICAgIHRzID0gTWF0aC5tYXgodHMsIDApO1xuICAgICAgICAgICAgdHMgPSBNYXRoLm1pbih0cywgMSk7XG4gICAgICAgICAgICByZXR1cm4gdjAgKyAodjEtdjApKnRzO1xuICAgICAgICB9XG5cdH1cblxuXHRzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdGhpcy5fdHJhbnMob2Zmc2V0KSwgZHluYW1pYzp0aGlzLl9keW5hbWljfVxuXHR9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBJTlRFUlBPTEFUSU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBGdW5jdGlvbiB0byBjcmVhdGUgYW4gaW50ZXJwb2xhdG9yIGZvciBuZWFyZXN0IG5laWdoYm9yIGludGVycG9sYXRpb24gd2l0aFxuICogZXh0cmFwb2xhdGlvbiBzdXBwb3J0LlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHR1cGxlcyAtIEFuIGFycmF5IG9mIFt2YWx1ZSwgb2Zmc2V0XSBwYWlycywgd2hlcmUgdmFsdWUgaXMgdGhlXG4gKiBwb2ludCdzIHZhbHVlIGFuZCBvZmZzZXQgaXMgdGhlIGNvcnJlc3BvbmRpbmcgb2Zmc2V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSAtIEEgZnVuY3Rpb24gdGhhdCB0YWtlcyBhbiBvZmZzZXQgYW5kIHJldHVybnMgdGhlXG4gKiBpbnRlcnBvbGF0ZWQgb3IgZXh0cmFwb2xhdGVkIHZhbHVlLlxuICovXG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKHR1cGxlcykge1xuXG4gICAgaWYgKHR1cGxlcy5sZW5ndGggPCAxKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3IgKCkge3JldHVybiB1bmRlZmluZWQ7fVxuICAgIH0gZWxzZSBpZiAodHVwbGVzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3IgKCkge3JldHVybiB0dXBsZXNbMF1bMF07fVxuICAgIH1cblxuICAgIC8vIFNvcnQgdGhlIHR1cGxlcyBieSB0aGVpciBvZmZzZXRzXG4gICAgY29uc3Qgc29ydGVkVHVwbGVzID0gWy4uLnR1cGxlc10uc29ydCgoYSwgYikgPT4gYVsxXSAtIGJbMV0pO1xuICBcbiAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yKG9mZnNldCkge1xuICAgICAgLy8gSGFuZGxlIGV4dHJhcG9sYXRpb24gYmVmb3JlIHRoZSBmaXJzdCBwb2ludFxuICAgICAgaWYgKG9mZnNldCA8PSBzb3J0ZWRUdXBsZXNbMF1bMV0pIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbMF07XG4gICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzWzFdO1xuICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEhhbmRsZSBleHRyYXBvbGF0aW9uIGFmdGVyIHRoZSBsYXN0IHBvaW50XG4gICAgICBpZiAob2Zmc2V0ID49IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMV1bMV0pIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDJdO1xuICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMV07XG4gICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgIH1cbiAgXG4gICAgICAvLyBGaW5kIHRoZSBuZWFyZXN0IHBvaW50cyB0byB0aGUgbGVmdCBhbmQgcmlnaHRcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc29ydGVkVHVwbGVzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICBpZiAob2Zmc2V0ID49IHNvcnRlZFR1cGxlc1tpXVsxXSAmJiBvZmZzZXQgPD0gc29ydGVkVHVwbGVzW2kgKyAxXVsxXSkge1xuICAgICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzW2ldO1xuICAgICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzW2kgKyAxXTtcbiAgICAgICAgICAvLyBMaW5lYXIgaW50ZXJwb2xhdGlvbiBmb3JtdWxhOiB5ID0geTEgKyAoICh4IC0geDEpICogKHkyIC0geTEpIC8gKHgyIC0geDEpIClcbiAgICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgXG4gICAgICAvLyBJbiBjYXNlIHRoZSBvZmZzZXQgZG9lcyBub3QgZmFsbCB3aXRoaW4gYW55IHJhbmdlIChzaG91bGQgYmUgY292ZXJlZCBieSB0aGUgcHJldmlvdXMgY29uZGl0aW9ucylcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfTtcbn1cbiAgXG5cbmV4cG9ydCBjbGFzcyBJbnRlcnBvbGF0aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuICAgIGNvbnN0cnVjdG9yKGl0diwgdHVwbGVzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIC8vIHNldHVwIGludGVycG9sYXRpb24gZnVuY3Rpb25cbiAgICAgICAgdGhpcy5fdHJhbnMgPSBpbnRlcnBvbGF0ZSh0dXBsZXMpO1xuICAgIH1cblxuICAgIHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl90cmFucyhvZmZzZXQpLCBkeW5hbWljOnRydWV9O1xuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTE9BRCBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBmdW5jdGlvbiBsb2FkX3NlZ21lbnQoaXR2LCBpdGVtKSB7XG4gICAgbGV0IHt0eXBlPVwic3RhdGljXCIsIGRhdGF9ID0gaXRlbTtcbiAgICBpZiAodHlwZSA9PSBcInN0YXRpY1wiKSB7XG4gICAgICAgIHJldHVybiBuZXcgU3RhdGljU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IFRyYW5zaXRpb25TZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwiaW50ZXJwb2xhdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgSW50ZXJwb2xhdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJtb3Rpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IE1vdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhcInVucmVjb2duaXplZCBzZWdtZW50IHR5cGVcIiwgdHlwZSk7XG4gICAgfVxufVxuIiwiaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi91dGlsL2FwaV9zcmNwcm9wLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuL2xheWVyX2Jhc2UuanNcIjtcbmltcG9ydCB7IGlzX2NvbGxlY3Rpb25fcHJvdmlkZXIgfSBmcm9tIFwiLi9wcm92aWRlcl9jb2xsZWN0aW9uLmpzXCI7XG5pbXBvcnQgeyBpc19vYmplY3RfcHJvdmlkZXJ9IGZyb20gXCIuL3Byb3ZpZGVyX29iamVjdC5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXggfSBmcm9tIFwiLi9uZWFyYnlfaW5kZXguanNcIjtcbmltcG9ydCB7IGxvYWRfc2VnbWVudCB9IGZyb20gXCIuL3V0aWwvc2VnbWVudHMuanNcIjtcbmltcG9ydCB7IHRvU3RhdGUsIGlzX2Zpbml0ZV9udW1iZXIsIGNoZWNrX2l0ZW1zLCBjaGVja19udW1iZXJ9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5pbXBvcnQgeyBlbmRwb2ludCwgaW50ZXJ2YWwgfSBmcm9tIFwiLi91dGlsL2ludGVydmFscy5qc1wiO1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19sZWFmX2xheWVyKG9iaikge1xuICAgIHJldHVybiAoKG9iaiBpbnN0YW5jZW9mIExheWVyKSAmJiBvYmouaXNMZWFmKTtcbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExFQUYgTEFZRVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGxlYWZfbGF5ZXIob3B0aW9ucz17fSkge1xuXG4gICAgY29uc3Qge1xuICAgICAgICBwcm92aWRlcixcbiAgICAgICAgbnVtZXJpYz1mYWxzZSwgXG4gICAgICAgIG11dGFibGU9dHJ1ZSwgXG4gICAgICAgIG1hc2ssXG4gICAgICAgIC4uLm9wdHN9ID0gb3B0aW9ucztcblxuICAgIGNvbnN0IGxheWVyID0gbmV3IExheWVyKHtcbiAgICAgICAgQ2FjaGVDbGFzczpMZWFmTGF5ZXJDYWNoZSwgXG4gICAgICAgIC4uLm9wdHMsXG4gICAgfSk7XG5cbiAgICAvLyByZXN0cmljdGlvbnNcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobGF5ZXIsIFwibnVtZXJpY1wiLCB7Z2V0OiAoKSA9PiBudW1lcmljfSk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGxheWVyLCBcIm11dGFibGVcIiwge2dldDogKCkgPT4gbXV0YWJsZX0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShsYXllciwgXCJpdGVtc09ubHlcIiwge2dldDogKCkgPT4gdHJ1ZX0pO1xuXG4gICAgLy8gbnVtZXJpYyBtYXNrIC0gcmVwbGFjZXMgdW5kZWZpbmVkIGZvciBudW1lcmljIGxheWVyc1xuICAgIGlmIChtYXNrICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBjaGVja19udW1iZXIoXCJtYXNrXCIsIG1hc2spO1xuICAgIH1cbiAgICBsYXllci5tYXNrID0gbWFzaztcblxuICAgIC8vIHNldHVwIHByb3ZpZGVyIGFzIHByb3BlcnR5XG4gICAgc3JjcHJvcC5hZGRTdGF0ZShsYXllcik7XG4gICAgc3JjcHJvcC5hZGRNZXRob2RzKGxheWVyKTtcbiAgICBsYXllci5zcmNwcm9wX3JlZ2lzdGVyKFwicHJvdmlkZXJcIik7XG4gICAgbGF5ZXIuc3JjcHJvcF9jaGVjayA9IGZ1bmN0aW9uIChwcm9wTmFtZSwgb2JqKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInByb3ZpZGVyXCIpIHtcbiAgICAgICAgICAgIGlmICghKGlzX2NvbGxlY3Rpb25fcHJvdmlkZXIob2JqKSkgJiYgIShpc19vYmplY3RfcHJvdmlkZXIob2JqKSkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwib2JqXCIgbXVzdCBjb2xsZWN0aW9uUHJvdmlkZXIgb3Igb2JqZWN0UHJvdmlkZXIgJHtvYmp9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2JqOyAgICBcbiAgICAgICAgfVxuICAgIH1cbiAgICBsYXllci5zcmNwcm9wX29uY2hhbmdlID0gZnVuY3Rpb24gKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInByb3ZpZGVyXCIpIHtcbiAgICAgICAgICAgIGlmIChlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIGlmIChpc19jb2xsZWN0aW9uX3Byb3ZpZGVyKGxheWVyLnByb3ZpZGVyKSkge1xuICAgICAgICAgICAgICAgICAgICBsYXllci5pbmRleCA9IG5ldyBOZWFyYnlJbmRleChsYXllci5wcm92aWRlcik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc19vYmplY3RfcHJvdmlkZXIobGF5ZXIucHJvdmlkZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLmluZGV4ID0gbmV3IE5lYXJieUluZGV4KGxheWVyLnByb3ZpZGVyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgaWYgKGxheWVyLmluZGV4ICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGlmIChpc19jb2xsZWN0aW9uX3Byb3ZpZGVyKGxheWVyLnByb3ZpZGVyKSkge1xuICAgICAgICAgICAgICAgICAgICBsYXllci5pbmRleC5yZWZyZXNoKGVBcmcpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNfb2JqZWN0X3Byb3ZpZGVyKGxheWVyLnByb3ZpZGVyKSkge1xuICAgICAgICAgICAgICAgICAgICBsYXllci5pbmRleC5yZWZyZXNoKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxheWVyLm9uY2hhbmdlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gICAgICAgIFxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogY29udmVuaWVuY2UgbWV0aG9kIGZvciBnZXR0aW5nIGl0ZW1zIHZhbGlkIGF0IG9mZnNldFxuICAgICAqIG9ubHkgaXRlbXMgbGF5ZXIgc3VwcG9ydHMgdGhpcyBtZXRob2RcbiAgICAgKi9cbiAgICBsYXllci5nZXRfaXRlbXMgPSBmdW5jdGlvbiBnZXRfaXRlbXMob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBbLi4ubGF5ZXIuaW5kZXgubmVhcmJ5KG9mZnNldCkuY2VudGVyXTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogTEFZRVIgVVBEQVRFIEFQSVxuICAgICAqICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGlmICghbGF5ZXIucmVhZE9ubHkpIHtcbiAgICAgICAgbGF5ZXIudXBkYXRlID0gZnVuY3Rpb24gdXBkYXRlKGNoYW5nZXMpIHtcbiAgICAgICAgICAgIHJldHVybiBsYXllcl91cGRhdGUobGF5ZXIsIGNoYW5nZXMpO1xuICAgICAgICB9XG4gICAgICAgIGxheWVyLmFwcGVuZCA9IGZ1bmN0aW9uIGFwcGVuZChpdGVtcywgb2Zmc2V0KSB7XG4gICAgICAgICAgICByZXR1cm4gbGF5ZXJfYXBwZW5kKGxheWVyLCBpdGVtcywgb2Zmc2V0KTtcbiAgICAgICAgfSAgICBcbiAgICB9XG4gXG4gICAgLy8gaW5pdGlhbGlzZVxuICAgIGxheWVyLnByb3ZpZGVyID0gcHJvdmlkZXI7XG5cbiAgICByZXR1cm4gbGF5ZXI7XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExFQUYgTEFZRVIgQ0FDSEVcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBMZWFmTGF5ZXJzIGhhdmUgYSBDb2xsZWN0aW9uUHJvdmlkZXIgb3IgYSBPYmplY3RQcm92aWRlciBhcyBwcm92aWRlciBcbiAgICBhbmQgdXNlIGEgc3BlY2lmaWMgY2FjaGUgaW1wbGVtZW50YXRpb24sIGFzIG9iamVjdHMgaW4gdGhlIFxuICAgIGluZGV4IGFyZSBhc3N1bWVkIHRvIGJlIGl0ZW1zIGZyb20gdGhlIHByb3ZpZGVyLCBub3Qgb3RoZXIgbGF5ZXIgb2JqZWN0cy4gXG4gICAgTW9yZW92ZXIsIHF1ZXJpZXMgYXJlIG5vdCByZXNvbHZlZCBkaXJlY3RseSBvbiB0aGUgaXRlbXMgaW4gdGhlIGluZGV4LCBidXRcbiAgICByYXRoZXIgZnJvbSBjb3JyZXNwb25kaW5nIHNlZ21lbnQgb2JqZWN0cywgaW5zdGFudGlhdGVkIGZyb20gaXRlbXMuXG5cbiAgICBDYWNoaW5nIGhlcmUgYXBwbGllcyB0byBuZWFyYnkgc3RhdGUgYW5kIHNlZ21lbnQgb2JqZWN0cy5cbiovXG5cbmNsYXNzIExlYWZMYXllckNhY2hlIHtcbiAgICBjb25zdHJ1Y3RvcihsYXllcikge1xuICAgICAgICAvLyBsYXllclxuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IG9iamVjdFxuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhY2hlZCBzZWdtZW50XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIHF1ZXJ5IG9wdGlvbnNcbiAgICAgICAgdGhpcy5fcXVlcnlfb3B0aW9ucyA9IHtcbiAgICAgICAgICAgIHZhbHVlRnVuYzogdGhpcy5fbGF5ZXIudmFsdWVGdW5jLFxuICAgICAgICAgICAgc3RhdGVGdW5jOiB0aGlzLl9sYXllci5zdGF0ZUZ1bmMsXG4gICAgICAgICAgICBudW1lcmljOiB0aGlzLl9sYXllci5udW1lcmljLFxuICAgICAgICAgICAgbWFzazogdGhpcy5fbGF5ZXIubWFza1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGdldCBzcmMoKSB7cmV0dXJuIHRoaXMuX2xheWVyfTtcbiAgICBnZXQgc2VnbWVudCgpIHtyZXR1cm4gdGhpcy5fc2VnbWVudH07XG5cbiAgICBxdWVyeShvZmZzZXQpIHtcbiAgICAgICAgY29uc3QgbmVlZF9pbmRleF9sb29rdXAgPSAoXG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAhaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KHRoaXMuX25lYXJieS5pdHYsIG9mZnNldClcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKG5lZWRfaW5kZXhfbG9va3VwKSB7XG4gICAgICAgICAgICAvLyBjYWNoZSBtaXNzXG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPSB0aGlzLl9sYXllci5pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgICAgIGxldCB7aXR2LCBjZW50ZXJ9ID0gdGhpcy5fbmVhcmJ5O1xuICAgICAgICAgICAgdGhpcy5fc2VnbWVudHMgPSBjZW50ZXIubWFwKChpdGVtKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxvYWRfc2VnbWVudChpdHYsIGl0ZW0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gcGVyZm9ybSBxdWVyaWVzXG4gICAgICAgIGNvbnN0IHN0YXRlcyA9IHRoaXMuX3NlZ21lbnRzLm1hcCgoc2VnKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gc2VnLnF1ZXJ5KG9mZnNldCk7XG4gICAgICAgIH0pO1xuICAgICAgICAvLyBjYWxjdWxhdGUgc2luZ2xlIHJlc3VsdCBzdGF0ZVxuICAgICAgICByZXR1cm4gdG9TdGF0ZSh0aGlzLl9zZWdtZW50cywgc3RhdGVzLCBvZmZzZXQsIHRoaXMuX3F1ZXJ5X29wdGlvbnMpO1xuICAgIH1cblxuICAgIGNsZWFyKCkge1xuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTEFZRVIgVVBEQVRFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogTk9URSAtIGxheWVyIHVwZGF0ZSBpcyBlc3NlbnRpYWxseSBhYm91dCBzdGF0ZVByb3ZpZGVyIHVwZGF0ZS5cbiAqIHNvIHRoZXNlIG1ldGhvZHMgY291bGQgKGZvciB0aGUgbW9zdCBwYXJ0KSBiZSBtb3ZlZCB0byB0aGUgcHJvdmlkZXIuXG4gKiBIb3dldmVyLCB1cGRhdGVfYXBwZW5kIGJlbmVmaXRzIGZyb20gdXNpbmcgdGhlIGluZGV4IG9mIHRoZSBsYXllcixcbiAqIHNvIHdlIGtlZXAgaXQgaGVyZSBmb3Igbm93LiBcbiAqL1xuXG4vKlxuICAgIEl0ZW1zIExheWVyIGZvcndhcmRzIHVwZGF0ZSB0byBzdGF0ZVByb3ZpZGVyXG4qL1xuZnVuY3Rpb24gbGF5ZXJfdXBkYXRlKGxheWVyLCBjaGFuZ2VzPXt9KSB7XG5cbiAgICAvLyBjaGVjayBpdGVtcyB0byBiZSBpbnNlcnRlZFxuICAgIGxldCB7aW5zZXJ0PVtdfSA9IGNoYW5nZXM7XG4gICAgY2hhbmdlcy5pbnNlcnQgPSBjaGVja19pdGVtcyhpbnNlcnQpO1xuXG4gICAgLy8gY2hlY2sgbnVtYmVyIHJlc3RyaWN0aW9uXG4gICAgLy8gY2hlY2sgdGhhdCBzdGF0aWMgaXRlbXMgYXJlIHJlc3RyaWN0ZWQgdG8gbnVtYmVyc1xuICAgIC8vIG90aGVyIGl0ZW0gdHlwZXMgYXJlIHJlc3RyaWN0ZWQgdG8gbnVtYmVycyBieSBkZWZhdWx0XG4gICAgaWYgKGxheWVyLmlzTnVtYmVyT25seSkge1xuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGNoYW5nZXMuaW5zZXJ0KSB7XG4gICAgICAgICAgICBpdGVtLnR5cGUgPz89IFwic3RhdGljXCI7XG4gICAgICAgICAgICBpZiAoaXRlbS50eXBlID09IFwic3RhdGljXCIgJiYgIWlzX2Zpbml0ZV9udW1iZXIoaXRlbS5kYXRhKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTGF5ZXIgaXMgbnVtYmVyIG9ubHksIGJ1dCBpdGVtICR7aXRlbX0gaXMgbm90IGEgbnVtYmVyYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaXNfY29sbGVjdGlvbl9wcm92aWRlcihsYXllci5wcm92aWRlcikpIHtcbiAgICAgICAgcmV0dXJuIGxheWVyLnByb3ZpZGVyLnVwZGF0ZShjaGFuZ2VzKTtcbiAgICB9IGVsc2UgaWYgKGlzX29iamVjdF9wcm92aWRlcihsYXllci5wcm92aWRlcikpIHsgICAgIFxuICAgICAgICBsZXQge1xuICAgICAgICAgICAgaW5zZXJ0PVtdLFxuICAgICAgICAgICAgcmVtb3ZlPVtdLFxuICAgICAgICAgICAgcmVzZXQ9ZmFsc2VcbiAgICAgICAgfSA9IGNoYW5nZXM7XG4gICAgICAgIGlmIChyZXNldCkge1xuICAgICAgICAgICAgcmV0dXJuIGxheWVyLnByb3ZpZGVyLnNldChpbnNlcnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCgobGF5ZXIucHJvdmlkZXIuZ2V0KCkgfHwgW10pXG4gICAgICAgICAgICAgICAgLm1hcCgoaXRlbSkgPT4gW2l0ZW0uaWQsIGl0ZW1dKSk7XG4gICAgICAgICAgICAvLyByZW1vdmVcbiAgICAgICAgICAgIHJlbW92ZS5mb3JFYWNoKChpZCkgPT4gbWFwLmRlbGV0ZShpZCkpO1xuICAgICAgICAgICAgLy8gaW5zZXJ0XG4gICAgICAgICAgICBpbnNlcnQuZm9yRWFjaCgoaXRlbSkgPT4gbWFwLnNldChpdGVtLmlkLCBpdGVtKSk7XG4gICAgICAgICAgICAvLyBzZXRcbiAgICAgICAgICAgIGNvbnN0IGl0ZW1zID0gQXJyYXkuZnJvbShtYXAudmFsdWVzKCkpO1xuICAgICAgICAgICAgcmV0dXJuIGxheWVyLnByb3ZpZGVyLnNldChpdGVtcyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4gICAgXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUiBBUFBFTkRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBhcHBlbmQgaXRlbXMgdG8gbGF5ZXIgYXQgb2Zmc2V0XG4gKiBcbiAqIGFwcGVuZCBpbXBsaWVzIHRoYXQgcHJlLWV4aXN0aW5nIGl0ZW1zIGJleW9uZCBvZmZzZXQsXG4gKiB3aWxsIGVpdGhlciBiZSByZW1vdmVkIG9yIHRydW5jYXRlZCwgc28gdGhhdCB0aGUgbGF5ZXJcbiAqIGlzIGVtcHR5IGFmdGVyIG9mZnNldC5cbiAqIFxuICogaXRlbXMgd2lsbCBvbmx5IGJlIGluc2VydGVkIGFmdGVyIG9mZnNldCwgc28gYW55IG5ld1xuICogaXRlbSBiZWZvcmUgb2Zmc2V0IHdpbGwgYmUgdHJ1bmNhdGVkIG9yIGRyb3BwZWQuXG4gKiBcbiAqIG5ldyBpdGVtcyB3aWxsIG9ubHkgYmUgYmUgYXBwbGllZCBmb3IgdCA+PSBvZmZzZXRcbiAqIG9sZCBpdGVtcyB3aWxsIGJlIGtlcHQgZm9yIHQgPCBvZmZzZXRcbiAqIFxuICogXG4gKi9cbmZ1bmN0aW9uIGxheWVyX2FwcGVuZChsYXllciwgaXRlbXMsIG9mZnNldCkge1xuICAgIGNvbnN0IGVwID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuICAgIFxuICAgIC8vIHRydW5jYXRlIG9yIHJlbW92ZSBuZXcgaXRlbXMgYmVmb3JlIG9mZnNldFxuICAgIGNvbnN0IGluc2VydF9pdGVtcyA9IGl0ZW1zXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIC8vIGtlZXAgb25seSBpdGVtcyB3aXRoIGl0di5oaWdoID49IG9mZnNldFxuICAgICAgICAgICAgY29uc3QgaGlnaEVwID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMV07XG4gICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuZ2UoaGlnaEVwLCBlcCk7XG4gICAgICAgIH0pXG4gICAgICAgIC5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIC8vIHRydW5jYXRlIGl0ZW0gb3ZlcmxhcHBpbmcgb2Zmc2V0IGl0di5sb3c9b2Zmc2V0XG4gICAgICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KGl0ZW0uaXR2LCBlcCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdfaXRlbSA9IHsuLi5pdGVtfTtcbiAgICAgICAgICAgICAgICBuZXdfaXRlbS5pdHYgPSBbb2Zmc2V0LCBpdGVtLml0dlsxXSwgdHJ1ZSwgaXRlbS5pdHZbM11dO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXdfaXRlbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgICB9KTtcbiAgICBcbiAgICAvLyBjb25zb2xlLmxvZyhcImluc2VydFwiLCBpbnNlcnRfaXRlbXMpO1xuXG4gICAgLy8gdHJ1bmNhdGUgcHJlLWV4aXN0aW5nIGl0ZW1zIG92ZXJsYXBwaW5nIG9mZnNldFxuICAgIGNvbnN0IG1vZGlmeV9pdGVtcyA9IGxheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpLmNlbnRlci5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgY29uc3QgbmV3X2l0ZW0gPSB7Li4uaXRlbX07XG4gICAgICAgIG5ld19pdGVtLml0diA9IFtpdGVtLml0dlswXSwgb2Zmc2V0LCBpdGVtLml0dlsyXSwgZmFsc2VdO1xuICAgICAgICByZXR1cm4gbmV3X2l0ZW07XG4gICAgfSk7XG4gICAgXG4gICAgLy8gY29uc29sZS5sb2coXCJtb2RpZnlcIiwgbW9kaWZ5X2l0ZW1zKTtcblxuICAgIC8vIHJlbW92ZSBwcmUtZXhpc3RpbmcgZnV0dXJlIC0gaXRlbXMgY292ZXJpbmcgaXR2LmxvdyA+IG9mZnNldFxuICAgIGNvbnN0IHJlbW92ZSA9IGxheWVyLnByb3ZpZGVyLmdldCgpXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGxvd0VwID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMF07XG4gICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuZ3QobG93RXAsIGVwKTtcbiAgICAgICAgfSlcbiAgICAgICAgLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGl0ZW0uaWQ7XG4gICAgICAgIH0pO1xuXG4gICAgLy8gY29uc29sZS5sb2coXCJyZW1vdmVcIiwgcmVtb3ZlKTtcblxuICAgIC8vIGxheWVyIHVwZGF0ZVxuICAgIGNvbnN0IGluc2VydCA9IFsuLi5tb2RpZnlfaXRlbXMsIC4uLmluc2VydF9pdGVtc107XG4gICAgcmV0dXJuIGxheWVyX3VwZGF0ZShsYXllciwge3JlbW92ZSwgaW5zZXJ0LCByZXNldDpmYWxzZX0pXG59XG5cblxuXG4iLCJpbXBvcnQgeyBDdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3JfYmFzZS5qc1wiO1xuaW1wb3J0IHsgQ2xvY2tQcm92aWRlciB9IGZyb20gXCIuL3Byb3ZpZGVyX2Nsb2NrLmpzXCI7XG5pbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuL3V0aWwvYXBpX3NyY3Byb3AuanNcIjtcbmltcG9ydCB7IGxvY2FsX2Nsb2NrIH0gZnJvbSBcIi4vdXRpbC9jb21tb24uanNcIjtcblxuLyoqXG4gKiBDbG9jayBDdXJzb3IgaXMgYSBjdXJzb3IgdGhhdCB3cmFwcyBhIGNsb2NrIHByb3ZpZGVyLCB3aGljaCBpcyBhdmFpbGFibGUgXG4gKiBvbiB0aGUgcHJvdmlkZXIgcHJvcGVydHkuXG4gKiBcbiAqIENsb2NrIGN1cnNvciBkb2VzIG5vdCBkZXBlbmQgb24gYSBzcmMgbGF5ZXIgb3IgYSBjdHJsIGN1cnNvci4gXG4gKiBDbG9jayBjdXJzb3IgaXMgRml4ZWRSYXRlIEN1cnNvciAoYnBtIDEpXG4gKiBDbG9jayBjdXJzb3IgaXMgTnVtYmVyT25seVxuICogXG4gKiBDbG9jayBjdXJzb3IgdGFrZSBvcHRpb25zIHtza2V3LCBzY2FsZX0gdG8gdHJhbnNmb3JtIHRoZSBjbG9jayB2YWx1ZS5cbiAqIFNjYWxlIGlzIG11bHRpcGxpZXIgdG8gdGhlIGNsb2NrIHZhbHVlLCBhcHBsaWVkIGJlZm9yZSB0aGUgc2tldyBzbyB0aGF0XG4gKiBpdCBwcmVzZXJ2ZXMgdGhlIHplcm8gcG9pbnQuXG4gKiBcbiAqIFRoZSBDbG9jayBjdXJzb3IgZ2VuZXJhbGx5IGRvZXMgbm90IGludm9rZSBhbnkgY2FsbGJhY2ssIGFzIGl0IGlzIGFsd2F5cyBpbiBkeW5hbWljIHN0YXRlLlxuICogSG93ZXZlciwgYSBjYWxsYmFjayB3aWxsIGJlIGludm9rZWQgaWYgdGhlIGNsb2NrcHJvdmlkZXIgaXMgY2hhbmdlZCB0aHJvdWdoIFxuICogYXNzaWdubWVudCBvZiB0aGUgcHJvdmlkZXIgcHJvcGVydHkuXG4gKiBcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gY2xvY2tfY3Vyc29yKG9wdGlvbnM9e30pIHtcblxuICAgIGNvbnN0IHtwcm92aWRlciwgc2hpZnQ9MCwgc2NhbGU9MS4wfSA9IG9wdGlvbnM7XG5cbiAgICBjb25zdCBjdXJzb3IgPSBuZXcgQ3Vyc29yKCk7XG5cbiAgICAvLyByZXN0cmljdGlvbnNcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3Vyc29yLCBcIm51bWVyaWNcIiwge2dldDogKCkgPT4gdHJ1ZX0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjdXJzb3IsIFwiZml4ZWRSYXRlXCIsIHtnZXQ6ICgpID0+IHRydWV9KTtcblxuICAgIC8vIHF1ZXJ5XG4gICAgY3Vyc29yLnF1ZXJ5ID0gZnVuY3Rpb24gKGxvY2FsX3RzPWxvY2FsX2Nsb2NrLm5vdygpKSB7XG4gICAgICAgIGNvbnN0IGNsb2NrX3RzID0gcHJvdmlkZXIubm93KGxvY2FsX3RzKTtcbiAgICAgICAgY29uc3QgdmFsdWUgPSAoY2xvY2tfdHMgKiBzY2FsZSkgKyBzaGlmdDtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZSwgZHluYW1pYzp0cnVlLCBvZmZzZXQ6bG9jYWxfdHN9O1xuICAgIH1cblxuICAgIC8vIHNldHVwIHByb3ZpZGVyIGFzIHNldHRhYmxlIHByb3BlcnR5XG4gICAgc3JjcHJvcC5hZGRTdGF0ZShjdXJzb3IpO1xuICAgIHNyY3Byb3AuYWRkTWV0aG9kcyhjdXJzb3IpO1xuICAgIGN1cnNvci5zcmNwcm9wX3JlZ2lzdGVyKFwicHJvdmlkZXJcIik7XG4gICAgY3Vyc29yLnNyY3Byb3BfY2hlY2sgPSBmdW5jdGlvbiAocHJvcE5hbWUsIG9iaikge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJwcm92aWRlclwiKSB7XG4gICAgICAgICAgICBpZiAoIShvYmogaW5zdGFuY2VvZiBDbG9ja1Byb3ZpZGVyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgcHJvdmlkZXIgbXVzdCBiZSBjbG9ja1Byb3ZpZGVyICR7cHJvdmlkZXJ9YCk7XG4gICAgICAgICAgICB9ICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBvYmo7ICAgIFxuICAgICAgICB9XG4gICAgfVxuICAgIGN1cnNvci5zcmNwcm9wX29uY2hhbmdlID0gZnVuY3Rpb24gKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInByb3ZpZGVyXCIpIHtcbiAgICAgICAgICAgIGlmIChlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIGN1cnNvci5vbmNoYW5nZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9ICAgICAgICBcbiAgICB9XG5cbiAgICAvLyBpbml0aWFsaXNlXG4gICAgY3Vyc29yLnJhdGUgPSAxLjAgKiBzY2FsZTtcbiAgICBjdXJzb3IucHJvdmlkZXIgPSBwcm92aWRlcjtcbiAgICByZXR1cm4gY3Vyc29yO1xufVxuIiwiaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4vY3Vyc29yX2Jhc2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4vbGF5ZXJfYmFzZS5qc1wiO1xuaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi91dGlsL2FwaV9zcmNwcm9wLmpzXCI7XG5pbXBvcnQgeyBjaGVja19udW1iZXIsIHNldF90aW1lb3V0fSBmcm9tIFwiLi91dGlsL2NvbW1vbi5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogUExBWUJBQ0sgQ1VSU09SXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogZ2VuZXJpYyBwbGF5YmFjayBjdXJzb3JcbiAqIFxuICogXCJzcmNcIiBpcyBhIGxheWVyXG4gKiBcImN0cmxcIiBpcyBjdXJzb3IgKE51bWJlcilcbiAqIHJldHVybnMgYSBjdXJzb3JcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gcGxheWJhY2tfY3Vyc29yKG9wdGlvbnM9e30pIHtcblxuICAgIGNvbnN0IHtjdHJsLCBzcmMsIFxuICAgICAgICBtdXRhYmxlPWZhbHNlfSA9IG9wdGlvbnM7XG5cbiAgICBsZXQgc3JjX2NhY2hlOyAvLyBjYWNoZSBmb3Igc3JjIGxheWVyXG4gICAgbGV0IHRpZDsgLy8gdGltZW91dFxuICAgIGxldCBwaWQ7IC8vIHBvbGxpbmdcblxuICAgIGNvbnN0IGN1cnNvciA9IG5ldyBDdXJzb3IoKTtcblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUkVTVFJJQ1RJT05TXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3Vyc29yLCBcIm51bWVyaWNcIiwge2dldDogKCkgPT4ge1xuICAgICAgICByZXR1cm4gKGN1cnNvci5zcmMgIT0gdW5kZWZpbmVkKSA/IGN1cnNvci5zcmMubnVtZXJpYyA6IGZhbHNlO1xuICAgIH19KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3Vyc29yLCBcIm11dGFibGVcIiwge2dldDogKCkgPT4ge1xuICAgICAgICByZXR1cm4gKGN1cnNvci5zcmMgIT0gdW5kZWZpbmVkKSA/IChjdXJzb3Iuc3JjLm11dGFibGUgJiYgbXV0YWJsZSkgOiBmYWxzZTtcbiAgICB9fSk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGN1cnNvciwgXCJpdGVtc09ubHlcIiwge2dldDogKCkgPT4ge1xuICAgICAgICByZXR1cm4gKGN1cnNvci5zcmMgIT0gdW5kZWZpbmVkKSA/IGN1cnNvci5zcmMuaXRlbXNPbmx5IDogZmFsc2U7XG4gICAgfX0pO1xuXG4gICAgXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBTUkMgQU5EIENUUkwgUFJPUEVSVElFU1xuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgc3JjcHJvcC5hZGRTdGF0ZShjdXJzb3IpO1xuICAgIHNyY3Byb3AuYWRkTWV0aG9kcyhjdXJzb3IpO1xuICAgIGN1cnNvci5zcmNwcm9wX3JlZ2lzdGVyKFwiY3RybFwiKTtcbiAgICBjdXJzb3Iuc3JjcHJvcF9yZWdpc3RlcihcInNyY1wiKTtcblxuICAgIGN1cnNvci5zcmNwcm9wX2NoZWNrID0gZnVuY3Rpb24gKHByb3BOYW1lLCBvYmopIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwiY3RybFwiKSB7XG4gICAgICAgICAgICBpZiAoIShvYmogaW5zdGFuY2VvZiBDdXJzb3IpIHx8IG9iai5udW1lcmljID09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcImN0cmxcIiBwcm9wZXJ0eSBtdXN0IGJlIGEgbnVtZXJpYyBjdXJzb3IgJHtvYmp9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAoIShvYmogaW5zdGFuY2VvZiBMYXllcikpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwic3JjXCIgcHJvcGVydHkgbXVzdCBiZSBhIGxheWVyICR7b2JqfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgfVxuICAgIH1cbiAgICBjdXJzb3Iuc3JjcHJvcF9vbmNoYW5nZSA9IGZ1bmN0aW9uIChwcm9wTmFtZSwgZUFyZykge1xuICAgICAgICBpZiAoY3Vyc29yLnNyYyA9PSB1bmRlZmluZWQgfHwgY3Vyc29yLmN0cmwgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmIChlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIHNyY19jYWNoZSA9IGN1cnNvci5zcmMuY3JlYXRlQ2FjaGUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3JjX2NhY2hlLmNsZWFyKCk7ICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGN1cnNvci5vbmNoYW5nZSgpO1xuICAgIH1cblxuICAgIGN1cnNvci5xdWVyeSA9IGZ1bmN0aW9uIHF1ZXJ5KGxvY2FsX3RzKSB7XG4gICAgICAgIGxldCBvZmZzZXQgPSBjdXJzb3IuY3RybC5xdWVyeShsb2NhbF90cykudmFsdWU7XG4gICAgICAgIC8vIHNob3VsZCBub3QgaGFwcGVuXG4gICAgICAgIGNoZWNrX251bWJlcihcImN1cnNvci5jdHJsLm9mZnNldFwiLCBvZmZzZXQpO1xuICAgICAgICBjb25zdCBzdGF0ZSA9IHNyY19jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgICAgICAvLyBpZiAoc3JjKSBsYXllciBpcyBudW1lcmljLCBkZWZhdWx0IHZhbHVlIDAgXG4gICAgICAgIC8vIGlzIGFzc3VtZWQgaW4gcmVnaW9ucyB3aGVyZSB0aGUgbGF5ZXIgaXMgdW5kZWZpbmVkXG4gICAgICAgIGlmIChjdXJzb3Iuc3JjLm51bWVyaWMgJiYgc3RhdGUudmFsdWUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzdGF0ZS52YWx1ZSA9IDAuMDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfVxuXG4gICAgY3Vyc29yLmFjdGl2ZV9pdGVtcyA9IGZ1bmN0aW9uIGdldF9pdGVtKGxvY2FsX3RzKSB7XG4gICAgICAgIGlmIChjdXJzb3IuaXRlbXNPbmx5KSB7XG4gICAgICAgICAgICBjb25zdCBvZmZzZXQgPSBjdXJzb3IuY3RybC5xdWVyeShsb2NhbF90cykudmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gY3Vyc29yLnNyYy5pbmRleC5uZWFyYnkob2Zmc2V0KS5jZW50ZXI7ICAgIFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBERVRFQ1QgRlVUVVJFIEVWRU5UXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICAvKipcbiAgICAgKiBmaXhlZCByYXRlIGN1cnNvcnMgbmV2ZXIgY2hhbmdlIHRoZWlyIGJlaGF2aW9yIC0gYW5kXG4gICAgICogY29uc2VxdWVudGx5IG5ldmVyIGhhcyB0byBpbnZva2UgYW55IGNhbGxiYWNrcyAvIGV2ZW50c1xuICAgICAqIFxuICAgICAqIE90aGVyIGN1cnNvcnMgbWF5IGNoYW5nZSBiZWhhdmlvdXIgYXQgYSBmdXR1cmUgdGltZS5cbiAgICAgKiBJZiB0aGlzIGZ1dHVyZSBjaGFuZ2UgaXMgY2F1c2VkIGJ5IGEgc3RhdGUgY2hhbmdlIC0gXG4gICAgICogZWl0aGVyIGluIChzcmMpIGxheWVyIG9yIChjdHJsKSBjdXJzb3IgLSBldmVudHMgd2lsbCBiZSBcbiAgICAgKiB0cmlnZ2VyZWQgaW4gcmVzcG9uc2UgdG8gdGhpcy4gXG4gICAgICogXG4gICAgICogSG93ZXZlciwgY3Vyc29ycyBtYXkgYWxzbyBjaGFuZ2UgYmVoYXZpb3VyIGF0IGEgZnV0dXJlIHRpbWUgbW9tZW50XG4gICAgICogaW4gdGltZSwgd2l0aG91dCBhbnkgY2F1c2luZyBzdGF0ZSBjaGFuZ2UuIFRoaXMgbWF5IGhhcHBlbiBkdXJpbmcgXG4gICAgICogcGxheWJhY2ssIGFzIHRoZSAoY3RybCkgY3Vyc29yIGxlYXZlcyB0aGUgY3VycmVudCByZWdpb24gXG4gICAgICogb2YgdGhlIChzcmMpIGxheWVyIGFuZCBlbnRlcnMgaW50byB0aGUgbmV4dCByZWdpb24uXG4gICAgICogXG4gICAgICogVGhpcyBldmVudCBtdXN0IGJlIGRldGVjdGVkLCBpZGVhbGx5IGF0IHRoZSByaWdodCBtb21lbnQsIFxuICAgICAqIHNvIHRoYXQgdGhlIGN1cnNvciBjYW4gZ2VuZXJhdGUgZXZlbnRzLCBhbGxvd2luZyBvYnNlcnZlcnMgdG9cbiAgICAgKiByZWFjdCB0byB0aGUgY2hhbmdlLiBJZiB0aGUgKGN0cmwpIGN1cnNvciBiZWhhdmVzIGRldGVybWluaXN0aWNhbGx5LCBcbiAgICAgKiB0aGlzIGZ1dHVyZSBldmVudCBjYW4gYmUgY2FsY3VsYXRlZCBhaGVhZCBvZiB0aW1lLCBcbiAgICAgKiBhbmQgZGV0ZWN0ZWQgYnkgdGltZW91dC4gT3RoZXJ3aXNlLCB0aGUgZmFsbGJhY2sgc29sdXRpb24gaXMgdG9cbiAgICAgKiBkZXRlY3Qgc3VjaCBmdXR1cmUgZXZlbnRzIGJ5IHBvbGxpbmcuXG4gICAgICogXG4gICAgICogTk9URSBjb25zdW1lcnMgb2YgY3Vyc29ycyBtaWdodCBwb2xsIHRoZSBjdXJzb3IgdGhlbXNlbHZlcywgdGh1cyBcbiAgICAgKiBjYXVzaW5nIHRoZSBldmVudCB0byBiZSBkZXRlY3RlZCB0aGF0IHdheS4gSG93ZXZlciwgdGhlcmUgaXMgbm8gXG4gICAgICogZ3VhcmFudGVlIHRoYXQgdGhpcyB3aWxsIGhhcHBlbi4gRm9yIGV4YW1wbGUsIGluIGNpcmN1bXN0YW5jZXMgXG4gICAgICogd2hlcmUgdGhlIChzcmMpIGxheWVyIHJlZ2lvbiBpcyBzdGF0aWMsIGNvbnN1bWVycyB3aWxsIHR1cm5cbiAgICAgKiBwb2xsaW5nIG9mZiwgYW5kIGRlcGVuZCBvbiB0aGUgY2hhbmdlIGV2ZW50IGZyb20gdGhlIGN1cnNvciwgaW4gb3JkZXIgXG4gICAgICogdG8gZGV0ZWN0IHRoZSBjaGFuZ2UgaW4gYmVoYXZpb3IuXG4gICAgICogXG4gICAgICovXG4gICAgY3Vyc29yLmRldGVjdF9mdXR1cmVfZXZlbnQgPSBmdW5jdGlvbiBkZXRlY3RfZnV0dXJlX2V2ZW50KCkge1xuXG4gICAgICAgIGNhbmNlbF90aW1lb3V0KCk7XG4gICAgICAgIGNhbmNlbF9wb2xsaW5nKCk7XG5cbiAgICAgICAgLy8gbm8gZnV0dXJlIHRpbWVvdXQgaWYgY3Vyc29yIGl0c2VsZiBpcyBmaXhlZFJhdGVcbiAgICAgICAgaWYgKGN1cnNvci5maXhlZFJhdGUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFsbCBvdGhlciBjdXJzb3JzIG11c3QgaGF2ZSAoc3JjKSBhbmQgKGN0cmwpXG4gICAgICAgIGlmIChjdXJzb3IuY3RybCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImN1cnNvci5jdHJsIGNhbiBub3QgYmUgdW5kZWZpbmVkIHdpdGggaXNGaXhlZFJhdGU9ZmFsc2VcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN1cnNvci5zcmMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjdXJzb3Iuc3JjIGNhbiBub3QgYmUgdW5kZWZpbmVkIHdpdGggaXNGaXhlZFJhdGU9ZmFsc2VcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjdXJyZW50IHN0YXRlIG9mIGN1cnNvci5jdHJsIFxuICAgICAgICBjb25zdCB7dmFsdWU6cG9zMCwgZHluYW1pYywgb2Zmc2V0OnRzMH0gPSBjdXJzb3IuY3RybC5xdWVyeSgpO1xuXG4gICAgICAgIC8vIG5vIGZ1dHVyZSB0aW1lb3V0IGlmIGN1cnNvci5jdHJsIGlzIHN0YXRpY1xuICAgICAgICBpZiAoIWR5bmFtaWMpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGN1cnJlbnQgcmVnaW9uIG9mIGN1cnNvci5zcmNcbiAgICAgICAgY29uc3Qgc3JjX25lYXJieSA9IGN1cnNvci5zcmMuaW5kZXgubmVhcmJ5KHBvczApO1xuICAgICAgICBjb25zdCBzcmNfcmVnaW9uX2xvdyA9IHNyY19uZWFyYnkuaXR2WzBdID8/IC1JbmZpbml0eTtcbiAgICAgICAgY29uc3Qgc3JjX3JlZ2lvbl9oaWdoID0gc3JjX25lYXJieS5pdHZbMV0gPz8gSW5maW5pdHk7XG5cbiAgICAgICAgaWYgKHNyY19yZWdpb25fbG93ID09IC1JbmZpbml0eSAmJiBzcmNfcmVnaW9uX2hpZ2ggPT0gSW5maW5pdHkpIHtcbiAgICAgICAgICAgIC8vIHVuYm91bmRlZCBzcmMgcmVnaW9uIC0gbm8gZXZlbnRcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNoZWNrIGlmIGNvbmRpdGlvbiBmb3IgY2xvY2sgdGltZW91dCBpcyBtZXRcbiAgICAgICAgaWYgKGN1cnNvci5jdHJsLmZpeGVkUmF0ZSkge1xuICAgICAgICAgICAgLyogXG4gICAgICAgICAgICAgICAgY3Vyc29yLmN0cmwgaXMgZml4ZWQgcmF0ZSAoY2xvY2spXG4gICAgICAgICAgICAgICAgZnV0dXJlIHRpbWVvdXQgd2hlbiBjdXJzb3IuY3RybCBsZWF2ZXMgc3JjX3JlZ2lvbiAob24gdGhlIHJpZ2h0KVxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGNvbnN0IHZlY3RvciA9IFtwb3MwLCBjdXJzb3IuY3RybC5yYXRlLCAwLCB0czBdO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gc3JjX3JlZ2lvbl9oaWdoXG4gICAgICAgICAgICBzY2hlZHVsZV90aW1lb3V0KHZlY3RvciwgdGFyZ2V0KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNoZWNrIGlmIGNvbmRpdGlvbnMgZm9yIG1vdGlvbiB0aW1lb3V0IGFyZSBtZXRcbiAgICAgICAgLy8gY3Vyc29yLmN0cmwuY3RybCBtdXN0IGJlIGZpeGVkIHJhdGVcbiAgICAgICAgLy8gY3Vyc29yLmN0cmwuc3JjIG11c3QgaGF2ZSBpdGVtc09ubHkgPT0gdHJ1ZSBcbiAgICAgICAgaWYgKGN1cnNvci5jdHJsLmN0cmwuZml4ZWRSYXRlICYmIGN1cnNvci5jdHJsLnNyYy5pdGVtc09ubHkpIHtcbiAgICAgICAgICAgIC8qIFxuICAgICAgICAgICAgICAgIHBvc3NpYmxlIHRpbWVvdXQgYXNzb2NpYXRlZCB3aXRoIGxlYXZpbmcgcmVnaW9uXG4gICAgICAgICAgICAgICAgdGhyb3VnaCBlaXRoZXIgcmVnaW9uX2xvdyBvciByZWdpb25faGlnaC5cblxuICAgICAgICAgICAgICAgIEhvd2V2ZXIsIHRoaXMgY2FuIG9ubHkgYmUgcHJlZGljdGVkIGlmIGN1cnNvci5jdHJsXG4gICAgICAgICAgICAgICAgaW1wbGVtZW50cyBhIGRldGVybWluaXN0aWMgZnVuY3Rpb24gb2YgdGltZS5cbiAgICAgICAgICAgICAgICBUaGlzIGNhbiBiZSBrbm93biBvbmx5IGlmIGN1cnNvci5jdHJsLnNyYyBpcyBhIGxheWVyIHdpdGggaXRlbXMuXG4gICAgICAgICAgICAgICAgYW5kIGEgc2luZ2xlIGFjdGl2ZSBpdGVtIGRlc2NyaWJlcyBlaXRoZXIgYSBtb3Rpb24gb3IgYSB0cmFuc2l0aW9uIFxuICAgICAgICAgICAgICAgICh3aXRoIGxpbmVhciBlYXNpbmcpLiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBjb25zdCBhY3RpdmVfaXRlbXMgPSBjdXJzb3IuY3RybC5zcmMuZ2V0X2l0ZW1zKHRzMCk7XG4gICAgICAgICAgICBpZiAoYWN0aXZlX2l0ZW1zLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYWN0aXZlX2l0ZW0gPSBhY3RpdmVfaXRlbXNbMF07XG4gICAgICAgICAgICAgICAgaWYgKGFjdGl2ZV9pdGVtLnR5cGUgPT0gXCJtb3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBbcCx2LGEsdF0gPSBhY3RpdmVfaXRlbS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPIGNhbGN1bGF0ZSB0aW1lb3V0IHdpdGggYWNjZWxlcmF0aW9uIHRvb1xuICAgICAgICAgICAgICAgICAgICBpZiAoYSA9PSAwLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggcmVnaW9uIGJvdW5kYXJ5IHdlIGhpdCBmaXJzdFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gKHYgPiAwKSA/IHNyY19yZWdpb25faGlnaCA6IHNyY19yZWdpb25fbG93O1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmVjdG9yID0gW3BvczAsIHYsIDAsIHRzMF07XG4gICAgICAgICAgICAgICAgICAgICAgICBzY2hlZHVsZV90aW1lb3V0KHZlY3RvciwgdGFyZ2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWN0aXZlX2l0ZW0udHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7djAsIHYxLCB0MCwgdDEsIGVhc2luZz1cImxpbmVhclwifSA9IGFjdGl2ZV9pdGVtLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlYXNpbmcgPT0gXCJsaW5lYXJcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGluZWFyIHRyYW5zaXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHYgPSAodjEtdjApLyh0MS10MCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXQgPSAodiA+IDApID8gc3JjX3JlZ2lvbl9oaWdoIDogc3JjX3JlZ2lvbl9sb3c7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2ZWN0b3IgPSBbcG9zMCwgdiwgMCwgdHMwXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjaGVkdWxlX3RpbWVvdXQodmVjdG9yLCB0YXJnZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuOyAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9ICAgICAgICAgICAgXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGRldGVjdGlvbiBvZiBsZWF2ZSBldmVudHMgZmFsbHMgYmFjayBvbiBwb2xsaW5nXG4gICAgICAgICAqL1xuICAgICAgICBzdGFydF9wb2xsaW5nKHNyY19yZWdpb25fbG93LCBzcmNfcmVnaW9uX2hpZ2gpO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogVElNRU9VVFxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgZnVuY3Rpb24gc2NoZWR1bGVfdGltZW91dCh2ZWN0b3IsIHRhcmdldCkge1xuICAgICAgICBjb25zdCBbcCx2LGEsdF0gPSB2ZWN0b3I7XG4gICAgICAgIGlmIChhICE9IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInRpbWVvdXQgbm90IHlldCBpbXBsZW1lbnRlZCBmb3IgYWNjZWxlcmF0aW9uXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0YXJnZXQgPT0gSW5maW5pdHkgfHwgdGFyZ2V0ID09IC1JbmZpbml0eSkge1xuICAgICAgICAgICAgLy8gbm8gdGltZW91dFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRlbHRhX3NlYyA9ICh0YXJnZXQgLSBwKSAvIHY7XG4gICAgICAgIGlmIChkZWx0YV9zZWMgPD0gMCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJXYXJuaW5nIC0gdGltZW91dCA8PSAwIC0gZHJvcHBpbmdcIiwgZGVsdGFfc2VjKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwidmVjdG9yXCIsIHZlY3Rvcik7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInRhcmdldFwiLCB0YXJnZXQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRpZCA9IHNldF90aW1lb3V0KGhhbmRsZV90aW1lb3V0LCBkZWx0YV9zZWMgKiAxMDAwLjApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhbmRsZV90aW1lb3V0KCkge1xuICAgICAgICAvLyBldmVudCBkZXRlY3RlZFxuICAgICAgICBjdXJzb3Iub25jaGFuZ2UoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYW5jZWxfdGltZW91dCgpIHtcbiAgICAgICAgaWYgKHRpZCAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRpZC5jYW5jZWwoKTsgXG4gICAgICAgIH0gICAgXG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBQT0xMSU5HXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBmdW5jdGlvbiBzdGFydF9wb2xsaW5nKHRhcmdldExvdywgdGFyZ2V0SGlnaCkge1xuICAgICAgICBwaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICBoYW5kbGVfcG9sbGluZyh0YXJnZXRMb3csIHRhcmdldEhpZ2gpO1xuICAgICAgICB9LCAxMDApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhbmRsZV9wb2xsaW5nKHRhcmdldExvdywgdGFyZ2V0SGlnaCkge1xuICAgICAgICBsZXQgcG9zID0gY3Vyc29yLmN0cmwudmFsdWU7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICh0YXJnZXRMb3cgPiAtSW5maW5pdHkgJiYgcG9zIDwgdGFyZ2V0TG93KSB8fFxuICAgICAgICAgICAgKHRhcmdldEhpZ2ggPCBJbmZpbml0eSAmJiBwb3MgPiB0YXJnZXRIaWdoKVxuICAgICAgICApeyBcbiAgICAgICAgICAgIC8vIGV2ZW50IGRldGVjdGVkXG4gICAgICAgICAgICBjdXJzb3Iub25jaGFuZ2UoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNhbmNlbF9wb2xsaW5nKCkge1xuICAgICAgICBpZiAocGlkICE9IHVuZGVmaW5lZCkgeyBcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwocGlkKTsgXG4gICAgICAgIH1cbiAgICB9XG4gXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBJTklUSUFMSVpBVElPTlxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGN1cnNvci5jdHJsID0gY3RybDtcbiAgICBjdXJzb3Iuc3JjID0gc3JjO1xuICAgIHJldHVybiBjdXJzb3I7XG59XG5cbiIsImltcG9ydCB7IHBsYXliYWNrX2N1cnNvciB9IGZyb20gXCIuL2N1cnNvcl9wbGF5YmFjay5qc1wiO1xuaW1wb3J0IHsgcmFuZG9tX3N0cmluZywgY2hlY2tfbnVtYmVyLCBtb3Rpb25fdXRpbHMgfSBmcm9tIFwiLi91dGlsL2NvbW1vbi5qc1wiO1xuaW1wb3J0IHsgbG9hZF9zZWdtZW50IH0gZnJvbSBcIi4vdXRpbC9zZWdtZW50cy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE9CSkVDVCBDVVJTT1JcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBjdXJzb3Igb2JqZWN0IHN1cHBvcnRpbmcgdXBkYXRlc1xuICogIFxuICogXCJzcmNcIiBpcyBhIGxheWVyIHdoaWNoIGlzIG11dGFibGVcbiAqIFwiY3RybFwiIGlzIGZpeGVkLXJhdGUgY3Vyc29yXG4gKiBcbiAqIG9iamVjdF9jdXJzb3IgbWF5IGFsc28gc3VwcG9ydCByZWNvcmRpbmdcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gb2JqZWN0X2N1cnNvcihvcHRpb25zPXt9KSB7XG5cbiAgICBjb25zdCB7Y3RybCwgc3JjLCByZWNvcmQ9ZmFsc2V9ID0gb3B0aW9ucztcblxuICAgIGNvbnN0IGN1cnNvciA9IG5ldyBwbGF5YmFja19jdXJzb3Ioe2N0cmwsIHNyYywgbXV0YWJsZTogdHJ1ZX0pO1xuXG4gICAgLyoqXG4gICAgICogb3ZlcnJpZGUgdG8gaW1wbGVtZW50IGFkZGl0aW9uYWwgcmVzdHJpY3Rpb25zIFxuICAgICAqIG9uIHNyYyBhbmQgY3RybFxuICAgICAqL1xuICAgIGNvbnN0IG9yaWdpbmFsX3NyY3Byb3BfY2hlY2sgPSBjdXJzb3Iuc3JjcHJvcF9jaGVjaztcblxuICAgIGN1cnNvci5zcmNwcm9wX2NoZWNrID0gZnVuY3Rpb24gKHByb3BOYW1lLCBvYmopIHtcbiAgICAgICAgb2JqID0gb3JpZ2luYWxfc3JjcHJvcF9jaGVjayhwcm9wTmFtZSwgb2JqKTtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwiY3RybFwiKSB7XG4gICAgICAgICAgICBpZiAoIW9iai5maXhlZFJhdGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwiY3RybFwiIHByb3BlcnR5IG11c3QgYmUgYSBmaXhlZHJhdGUgY3Vyc29yICR7b2JqfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzcmNcIikge1xuICAgICAgICAgICAgaWYgKCFvYmoubXV0YWJsZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBwcm9wZXJ0eSBtdXN0IGJlIG11dGFibGUgbGF5ZXIgJHtvYmp9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9XG4gICAgfVxuICAgICAgICBcblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogVVBEQVRFIEFQSVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGN1cnNvci5zZXQgPSAodmFsdWUpID0+IHtcbiAgICAgICAgY29uc3QgaXRlbXMgPSBjcmVhdGVfc2V0X2l0ZW1zKGN1cnNvciwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gY3Vyc29yLnVwZGF0ZShpdGVtcyk7XG4gICAgfVxuICAgIGN1cnNvci5tb3Rpb24gPSAodmVjdG9yKSA9PiB7XG4gICAgICAgIGNvbnN0IGl0ZW1zID0gY3JlYXRlX21vdGlvbl9pdGVtcyhjdXJzb3IsIHZlY3Rvcik7XG4gICAgICAgIHJldHVybiBjdXJzb3IudXBkYXRlKGl0ZW1zKTtcbiAgICB9XG4gICAgY3Vyc29yLnRyYW5zaXRpb24gPSAoe3RhcmdldCwgZHVyYXRpb24sIGVhc2luZ30pID0+IHsgXG4gICAgICAgIGNvbnN0IGl0ZW1zID0gY3JlYXRlX3RyYW5zaXRpb25faXRlbXMoY3Vyc29yLCB0YXJnZXQsIGR1cmF0aW9uLCBlYXNpbmcpO1xuICAgICAgICByZXR1cm4gY3Vyc29yLnVwZGF0ZShpdGVtcyk7XG5cbiAgICB9XG4gICAgY3Vyc29yLmludGVycG9sYXRlID0gKHt0dXBsZXMsIGR1cmF0aW9ufSkgPT4ge1xuICAgICAgICBjb25zdCBpdGVtcyA9IGNyZWF0ZV9pbnRlcnBvbGF0aW9uX2l0ZW1zKGN1cnNvciwgdHVwbGVzLCBkdXJhdGlvbik7XG4gICAgICAgIHJldHVybiBjdXJzb3IudXBkYXRlKGl0ZW1zKTtcbiAgICB9XG4gICAgXG4gICAgY3Vyc29yLnVwZGF0ZSA9IChpdGVtcykgPT4ge1xuICAgICAgICBpZiAoaXRlbXMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAocmVjb3JkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnNvci5zcmMuYXBwZW5kKGl0ZW1zLCBjdXJzb3IuY3RybC52YWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBjdXJzb3Iuc3JjLnVwZGF0ZSh7aW5zZXJ0Oml0ZW1zLCByZXNldDp0cnVlfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY3Vyc29yO1xufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUiBVUERBVEUgQVBJXG4gKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogY3JlYWF0ZSBpdGVtcyBmb3Igc2V0IG9wZXJhdGlvblxuKi9cbmZ1bmN0aW9uIGNyZWF0ZV9zZXRfaXRlbXMoY3Vyc29yLCB2YWx1ZSkge1xuICAgIGxldCBpdGVtcyA9IFtdO1xuICAgIGlmICh2YWx1ZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgaXRlbXMgPSBbe1xuICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgaXR2OiBbbnVsbCwgbnVsbCwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdmFsdWUgICAgICAgICAgICAgIFxuICAgICAgICB9XTtcbiAgICB9XG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG4vKipcbiAqIGNyZWF0ZSBpdGVtcyBmb3IgbW90aW9uIG9wZXJhdGlvblxuICogIFxuICogbW90aW9uIG9ubHkgbWFrZXMgc2Vuc2UgaWYgb2JqZWN0IGN1cnNvciBpcyByZXN0cmljdGVkIHRvIG51bWJlciB2YWx1ZXMsXG4gKiB3aGljaCBpbiB0dXJuIGltcGxpZXMgdGhhdCB0aGUgY3Vyc29yLnNyYyAoSXRlbXMgTGF5ZXIpIHNob3VsZCBiZVxuICogcmVzdHJpY3RlZCB0byBudW1iZXIgdmFsdWVzLiBcbiAqIElmIG5vbi1udW1iZXIgdmFsdWVzIG9jY3VyIC0gd2Ugc2ltcGx5IHJlcGxhY2Ugd2l0aCAwLlxuICogQWxzbywgaXRlbXMgbGF5ZXIgc2hvdWxkIGhhdmUgYSBzaW5nbGUgaXRlbSBpbiBuZWFyYnkgY2VudGVyLlxuICogXG4gKiBpZiBwb3NpdGlvbiBpcyBvbWl0dGVkIGluIHZlY3RvciAtIGN1cnJlbnQgcG9zaXRpb24gd2lsbCBiZSBhc3N1bWVkXG4gKiBpZiB0aW1lc3RhbXAgaXMgb21pdHRlZCBpbiB2ZWN0b3IgLSBjdXJyZW50IHRpbWVzdGFtcCB3aWxsIGJlIGFzc3VtZWRcbiAqIGlmIHZlbG9jaXR5IGFuZCBhY2NlbGVyYXRpb24gYXJlIG9tbWl0dGVkIGluIHZlY3RvciBcbiAqIC0gdGhlc2Ugd2lsbCBiZSBzZXQgdG8gemVyby5cbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlX21vdGlvbl9pdGVtcyhjdXJzb3IsIHZlY3Rvcj17fSkge1xuICAgIC8vIGdldCB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgY3Vyc29yXG4gICAgbGV0IHt2YWx1ZTpwMCwgb2Zmc2V0OnQwfSA9IGN1cnNvci5xdWVyeSgpO1xuICAgIC8vIGVuc3VyZSB0aGF0IHAwIGlzIG51bWJlciB0eXBlXG4gICAgaWYgKHR5cGVvZiBwMCAhPT0gJ251bWJlcicgfHwgIWlzRmluaXRlKHAwKSkge1xuICAgICAgICBwMCA9IDA7XG4gICAgfVxuICAgIC8vIGZldGNoIG5ldyB2YWx1ZXMgZnJvbSB2ZWN0b3JcbiAgICBjb25zdCB7XG4gICAgICAgIHBvc2l0aW9uOnAxPXAwLFxuICAgICAgICB2ZWxvY2l0eTp2MT0wLFxuICAgICAgICBhY2NlbGVyYXRpb246YTE9MCxcbiAgICAgICAgdGltZXN0YW1wOnQxPXQwLFxuICAgICAgICByYW5nZT1bbnVsbCwgbnVsbF1cbiAgICB9ID0gdmVjdG9yO1xuICAgIG1vdGlvbl91dGlscy5jaGVja19yYW5nZShyYW5nZSk7XG4gICAgY2hlY2tfbnVtYmVyKFwicG9zaXRpb25cIiwgcDEpO1xuICAgIGNoZWNrX251bWJlcihcInZlbG9jaXR5XCIsIHYxKTtcbiAgICBjaGVja19udW1iZXIoXCJhY2NlbGVyYXRpb25cIiwgYTEpO1xuICAgIGNoZWNrX251bWJlcihcInRpbWVzdGFtcFwiLCB0MSk7XG5cbiAgICBjb25zdCBpdGVtcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogaWYgcG9zIHJhbmdlIGlzIGJvdW5kZWQgbG93IG9yIGhpZ2ggb3IgYm90aCxcbiAgICAgKiB0aGlzIHBvdGVudGlhbGx5IGNvcnJlc3BvbmRzIHRvIG11bHRpcGxlIHRpbWUgcmFuZ2VzIFtbdDAsIHQxXV0gXG4gICAgICogd2hlcmUgdGhlIG1vdGlvbiBwb3NpdGlvbiBpcyBsZWdhbCAgXG4gICAgICogbG93IDw9IHAgPD0gaGlnaCBcbiAgICAgKi9cbiAgICBjb25zdCBjdHIgPSBtb3Rpb25fdXRpbHMuY2FsY3VsYXRlX3RpbWVfcmFuZ2VzO1xuICAgIGNvbnN0IHRpbWVfcmFuZ2VzID0gY3RyKFtwMSx2MSxhMSx0MV0sIHJhbmdlKTtcbiAgICAvLyBwaWNrIGEgdGltZSByYW5nZSB3aGljaCBjb250YWlucyB0MVxuICAgIGNvbnN0IHRzID0gY3Vyc29yLmN0cmwudmFsdWU7XG5cbiAgICBjb25zdCB0aW1lX3JhbmdlID0gdGltZV9yYW5nZXMuZmluZCgodHIpID0+IHtcbiAgICAgICAgY29uc3QgbG93ID0gdHJbMF0gPz8gLUluZmluaXR5O1xuICAgICAgICBjb25zdCBoaWdoID0gdHJbMV0gPz8gSW5maW5pdHk7XG4gICAgICAgIHJldHVybiBsb3cgPD0gdHMgJiYgdHMgPD0gaGlnaDtcbiAgICB9KTtcbiAgICBpZiAodGltZV9yYW5nZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgW2xvdywgaGlnaF0gPSB0aW1lX3JhbmdlO1xuICAgICAgICBpdGVtcy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiByYW5kb21fc3RyaW5nKDEwKSxcbiAgICAgICAgICAgIGl0djogW2xvdywgaGlnaCwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICAgICAgZGF0YTogW3AxLCB2MSwgYTEsIHQxXVxuICAgICAgICB9KTtcbiAgICAgICAgLy8gYWRkIGxlZnQgaWYgbmVlZGVkXG4gICAgICAgIGlmIChsb3cgIT0gbnVsbCkge1xuICAgICAgICAgICAgaXRlbXMucHVzaCh7XG4gICAgICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgICAgIGl0djogW251bGwsIGxvdywgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICAgICAgZGF0YTogcmFuZ2VbMF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGFkZCByaWdodCBpZiBuZWVkZWRcbiAgICAgICAgaWYgKGhpZ2ggIT0gbnVsbCkge1xuICAgICAgICAgICAgaXRlbXMucHVzaCh7XG4gICAgICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgICAgIGl0djogW2hpZ2gsIG51bGwsIGZhbHNlLCB0cnVlXSxcbiAgICAgICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgICAgIGRhdGE6IHJhbmdlWzFdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8qIFxuICAgICAgICAgICAgbm8gdGltZV9yYW5nZSBmb3VuZFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBwMSBpcyBvdXRzaWRlIHRoZSBwb3NfcmFuZ2VcbiAgICAgICAgICAgIGlmIHAxIGlzIGxlc3MgdGhhbiBsb3csIHRoZW4gdXNlIGxvd1xuICAgICAgICAgICAgaWYgcDEgaXMgZ3JlYXRlciB0aGFuIGhpZ2gsIHRoZW4gdXNlIGhpZ2hcbiAgICAgICAgKi9cbiAgICAgICAgY29uc3QgdmFsID0gKHAxIDwgcmFuZ2VbMF0pID8gcmFuZ2VbMF0gOiByYW5nZVsxXTtcbiAgICAgICAgaXRlbXMucHVzaCh7XG4gICAgICAgICAgICBpZDogcmFuZG9tX3N0cmluZygxMCksXG4gICAgICAgICAgICBpdHY6IFtudWxsLCBudWxsLCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2YWxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuLyoqXG4gKiBjcmVhdGUgaXRlbXMgZm9yIHRyYW5zaXRpb24gb3BlcmF0aW9uXG4gKiAgXG4gKiB0cmFuc2l0aW9uIHRvIHRhcmdldCBwb3NpdGlvbiB1c2luZyBpbiA8ZHVyYXRpb24+IHNlY29uZHMuXG4gKi9cblxuZnVuY3Rpb24gY3JlYXRlX3RyYW5zaXRpb25faXRlbXMoY3Vyc29yLCB0YXJnZXQsIGR1cmF0aW9uLCBlYXNpbmcpIHtcblxuICAgIGNvbnN0IHt2YWx1ZTp2MCwgb2Zmc2V0OnQwfSA9IGN1cnNvci5xdWVyeSgpO1xuICAgIGNvbnN0IHYxID0gdGFyZ2V0O1xuICAgIGNvbnN0IHQxID0gdDAgKyBkdXJhdGlvbjtcbiAgICBpZiAodjEgPT0gdjApIHtcbiAgICAgICAgLy8gbm9vcFxuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGNoZWNrX251bWJlcihcInBvc2l0aW9uXCIsIHYwKTtcbiAgICBjaGVja19udW1iZXIoXCJwb3NpdGlvblwiLCB2MSk7XG4gICAgY2hlY2tfbnVtYmVyKFwicG9zaXRpb25cIiwgdDApO1xuICAgIGNoZWNrX251bWJlcihcInBvc2l0aW9uXCIsIHQxKTtcbiAgICByZXR1cm4gW1xuICAgICAgICB7XG4gICAgICAgICAgICBpZDogcmFuZG9tX3N0cmluZygxMCksXG4gICAgICAgICAgICBpdHY6IFtudWxsLCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYwXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlkOiByYW5kb21fc3RyaW5nKDEwKSxcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInRyYW5zaXRpb25cIixcbiAgICAgICAgICAgIGRhdGE6IHt2MCwgdjEsIHQwLCB0MSwgZWFzaW5nfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpZDogcmFuZG9tX3N0cmluZygxMCksXG4gICAgICAgICAgICBpdHY6IFt0MSwgbnVsbCwgZmFsc2UsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYxXG4gICAgICAgIH1cbiAgICBdO1xufVxuXG4vKipcbiAqIGNyZWF0ZSBpdGVtcyBmb3IgaW50ZXJwb2xhdGlvbiBvcGVyYXRpb25cbiAqL1xuXG5mdW5jdGlvbiBjcmVhdGVfaW50ZXJwb2xhdGlvbl9pdGVtcyhjdXJzb3IsIHR1cGxlcywgZHVyYXRpb24pIHtcblxuICAgIGNvbnN0IG5vdyA9IGN1cnNvci5jdHJsLnZhbHVlO1xuICAgIHR1cGxlcyA9IHR1cGxlcy5tYXAoKFt2LHRdKSA9PiB7XG4gICAgICAgIGNoZWNrX251bWJlcihcInRzXCIsIHQpO1xuICAgICAgICBjaGVja19udW1iZXIoXCJ2YWxcIiwgdik7XG4gICAgICAgIHJldHVybiBbdiwgbm93ICsgdF07XG4gICAgfSlcblxuICAgIC8vIGluZmxhdGUgc2VnbWVudCB0byBjYWxjdWxhdGUgYm91bmRhcnkgY29uZGl0aW9uc1xuICAgIGNvbnN0IHNlZyA9IGxvYWRfc2VnbWVudChbbnVsbCwgbnVsbCwgdHJ1ZSwgdHJ1ZV0sIHtcbiAgICAgICAgdHlwZTogXCJpbnRlcnBvbGF0aW9uXCIsXG4gICAgICAgIGRhdGE6IHR1cGxlc1xuICAgIH0pO1xuXG4gICAgY29uc3QgdDAgPSBub3c7XG4gICAgY29uc3QgdDEgPSB0MCArIGR1cmF0aW9uO1xuICAgIGNvbnN0IHYwID0gc2VnLnN0YXRlKHQwKS52YWx1ZTtcbiAgICBjb25zdCB2MSA9IHNlZy5zdGF0ZSh0MSkudmFsdWU7XG4gICAgcmV0dXJuIFtcbiAgICAgICAge1xuICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYwXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlkOiByYW5kb21fc3RyaW5nKDEwKSxcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJpbnRlcnBvbGF0aW9uXCIsXG4gICAgICAgICAgICBkYXRhOiB0dXBsZXNcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgaXR2OiBbdDEsIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MVxuICAgICAgICB9XG4gICAgXTtcbn1cbiIsImltcG9ydCB7IGVuZHBvaW50fSBmcm9tIFwiLi4vdXRpbC9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuLi9uZWFyYnlfYmFzZS5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi4vbGF5ZXJfYmFzZS5qc1wiXG5pbXBvcnQgeyBDdXJzb3IgfSBmcm9tIFwiLi4vY3Vyc29yX2Jhc2UuanNcIjtcblxuLyoqXG4gKiBUaGlzIHdyYXBzIGEgY3Vyc29yIHNvIHRoYXQgaXQgY2FuIGJlIHVzZWQgYXMgYSBsYXllci5cbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gbGF5ZXJfZnJvbV9jdXJzb3Ioc3JjKSB7XG5cbiAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBDdXJzb3IpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgc3JjIG11c3QgYmUgYSBDdXJzb3IgJHtzcmN9YCk7XG4gICAgfVxuIFxuICAgIGNvbnN0IGxheWVyID0gbmV3IExheWVyKCk7XG4gICAgbGF5ZXIuaW5kZXggPSBuZXcgQ3Vyc29ySW5kZXgoc3JjKTtcblxuICAgIC8vIHJlc3RyaWN0aW9uc1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShsYXllciwgXCJudW1lcmljXCIsIHtnZXQ6ICgpID0+IHNyYy5udW1lcmljfSk7XG5cbiAgICAvLyBzdWJzY3JpYmVcbiAgICBzcmMuYWRkX2NhbGxiYWNrKChlQXJnKSA9PiB7XG4gICAgICAgIGxheWVyLm9uY2hhbmdlKGVBcmcpO1xuICAgIH0pO1xuXG4gICAgLy8gaW5pdGlhbGlzZVxuICAgIGxheWVyLnNyYyA9IHNyYztcbiAgICByZXR1cm4gbGF5ZXI7XG59IFxuXG5cbi8qKlxuICogQ3JlYXRlIGEgTmVhcmJ5SW5kZXggZm9yIHRoZSBDdXJzb3IuXG4gKiBcbiAqIFRoZSBjdXJzb3IgdmFsdWUgaXMgaW5kZXBlbmRlbnQgb2YgdGltZWxpbmUgb2Zmc2V0LCBcbiAqIHdoaWNoIGlzIHRvIHNheSB0aGF0IGl0IGhhcyB0aGUgc2FtZSB2YWx1ZSBmb3IgYWxsIFxuICogdGltZWxpbmUgb2Zmc2V0cy5cbiAqIFxuICogSW4gb3JkZXIgZm9yIHRoZSBkZWZhdWx0IExheWVyQ2FjaGUgdG8gd29yaywgYW5cbiAqIG9iamVjdCB3aXRoIGEgLnF1ZXJ5KG9mZnNldCkgbWV0aG9kIGlzIG5lZWRlZCBpbiBcbiAqIG5lYXJieS5jZW50ZXIuIFNpbmNlIGN1cnNvcnMgc3VwcG9ydCB0aGlzIG1ldGhvZFxuICogKGlnbm9yaW5nIHRoZSBvZmZzZXQpLCB3ZSBjYW4gdXNlIHRoZSBjdXJzb3IgZGlyZWN0bHkuXG4gKi9cblxuY2xhc3MgQ3Vyc29ySW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoY3Vyc29yKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2N1cnNvciA9IGN1cnNvcjtcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIC8vIGN1cnNvciBpbmRleCBpcyBkZWZpbmVkIGZvciBlbnRpcmUgdGltZWxpbmVcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGl0djogW251bGwsIG51bGwsIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgY2VudGVyOiBbdGhpcy5fY3Vyc29yXSxcbiAgICAgICAgICAgIGxlZnQ6IGVuZHBvaW50Lk5FR19JTkYsXG4gICAgICAgICAgICBwcmV2OiBlbmRwb2ludC5ORUdfSU5GLFxuICAgICAgICAgICAgcmlnaHQ6IGVuZHBvaW50LlBPU19JTkYsXG4gICAgICAgICAgICBuZXh0OiBlbmRwb2ludC5QT1NfSU5GLFxuICAgICAgICB9XG4gICAgfVxufVxuXG4iLCJpbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuLi91dGlsL2FwaV9zcmNwcm9wLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcl9iYXNlLmpzXCJcbmltcG9ydCB7IGVuZHBvaW50IH0gZnJvbSBcIi4uL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UsIG5lYXJieV9mcm9tIH0gZnJvbSBcIi4uL25lYXJieV9iYXNlLmpzXCI7XG5cblxuLyoqXG4gKiBDb252ZW5pZW5jZSBtZXJnZSBvcHRpb25zXG4gKi9cbmNvbnN0IE1FUkdFX09QVElPTlMgPSB7XG4gICAgc3VtOiB7XG4gICAgICAgIHZhbHVlRnVuYzogZnVuY3Rpb24gKGluZm8pIHtcbiAgICAgICAgICAgIC8vIHJldHVybnMgdGhlIHN1bSBvZiB2YWx1ZXMgb2YgYWN0aXZlIGxheWVyc1xuICAgICAgICAgICAgcmV0dXJuIGluZm8uc3RhdGVzXG4gICAgICAgICAgICAgICAgLm1hcChzdGF0ZSA9PiBzdGF0ZS52YWx1ZSkgXG4gICAgICAgICAgICAgICAgLnJlZHVjZSgoYWNjLCB2YWx1ZSkgPT4gYWNjICsgdmFsdWUsIDApO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBzdGFjazoge1xuICAgICAgICBzdGF0ZUZ1bmM6IGZ1bmN0aW9uIChpbmZvKSB7XG4gICAgICAgICAgICAvLyByZXR1cm5zIHZhbHVlcyBmcm9tIGZpcnN0IGFjdGl2ZSBsYXllclxuICAgICAgICAgICAgcmV0dXJuIHsuLi5pbmZvLnN0YXRlc1swXX1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgYXJyYXk6IHtcbiAgICAgICAgdmFsdWVGdW5jOiBmdW5jdGlvbiAoaW5mbykge1xuICAgICAgICAgICAgLy8gcmV0dXJucyBhbiBhcnJheSB3aXRoIHZhbHVlcyBmcm9tIGFjdGl2ZSBsYXllcnNcbiAgICAgICAgICAgIHJldHVybiBpbmZvLnN0YXRlcy5tYXAoc3RhdGUgPT4gc3RhdGUudmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIFxuICogVGhpcyBpbXBsZW1lbnRzIGEgbWVyZ2Ugb3BlcmF0aW9uIGZvciBsYXllcnMuXG4gKiBMaXN0IG9mIHNvdXJjZXMgaXMgaW1tdXRhYmxlLlxuICogXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlX2xheWVyIChzb3VyY2VzLCBvcHRpb25zPXt9KSB7XG4gICAgbGV0IHt0eXBlPVwiXCIsIC4uLm9wdHN9ID0gb3B0aW9ucztcblxuICAgIC8vIHR5cGUgc3BlY2lmaWVzIHByZWRlZmluZWQgb3B0aW9ucyBmb3IgTGF5ZXJcbiAgICBpZiAodHlwZSBpbiBNRVJHRV9PUFRJT05TKSB7XG4gICAgICAgIG9wdHMgPSBNRVJHRV9PUFRJT05TW3R5cGVdO1xuICAgIH1cbiAgICBjb25zdCBsYXllciA9IG5ldyBMYXllcihvcHRzKTsgICAgXG5cbiAgICAvLyBzZXR1cCBzb3VyY2VzIHByb3BlcnR5XG4gICAgc3JjcHJvcC5hZGRTdGF0ZShsYXllcik7XG4gICAgc3JjcHJvcC5hZGRNZXRob2RzKGxheWVyKTtcbiAgICBsYXllci5zcmNwcm9wX3JlZ2lzdGVyKFwic291cmNlc1wiKTtcblxuICAgIGxheWVyLnNyY3Byb3BfY2hlY2sgPSBmdW5jdGlvbihwcm9wTmFtZSwgc291cmNlcykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzb3VyY2VzXCIpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIHRoYXQgc291cmNlcyBpcyBhcnJheSBvZiBsYXllcnNcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShzb3VyY2VzKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgc291cmNlcyBtdXN0IGJlIGFycmF5ICR7c291cmNlc31gKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYWxsX2xheWVycyA9IHNvdXJjZXMubWFwKChlKSA9PiBlIGluc3RhbmNlb2YgTGF5ZXIpLmV2ZXJ5KGUgPT4gZSk7XG4gICAgICAgICAgICBpZiAoIWFsbF9sYXllcnMpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNvdXJjZXMgbXVzdCBhbGwgYmUgbGF5ZXJzICR7c291cmNlc31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc291cmNlcztcbiAgICB9XG5cbiAgICBsYXllci5zcmNwcm9wX29uY2hhbmdlID0gZnVuY3Rpb24ocHJvcE5hbWUsIGVBcmcpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic291cmNlc1wiKSB7XG4gICAgICAgICAgICBpZiAoZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5pbmRleCA9IG5ldyBOZWFyYnlJbmRleE1lcmdlKGxheWVyLnNvdXJjZXMpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgbGF5ZXIub25jaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlc3RyaWN0aW9uc1xuICAgIGNvbnN0IG51bWVyaWMgPSBzb3VyY2VzLm1hcCgoc3JjKSA9PiBzcmMubnVtZXJpYykuZXZlcnkoZT0+ZSkgIFxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShsYXllciwgXCJudW1lcmljXCIsIHtnZXQ6ICgpID0+IG51bWVyaWN9KTtcblxuICAgIC8vIGluaXRpYWxpc2VcbiAgICBsYXllci5zb3VyY2VzID0gc291cmNlcztcblxuICAgIHJldHVybiBsYXllclxufVxuXG5cblxuLyoqXG4gKiBDcmVhdGluZyBhIG1lcmdlZCBOZWFyYnlJbmRleCBmb3Igc2V0IG9mIExheWVycy5cbiAqICBcbiAqIEEgcmVnaW9uIHdpdGhpbiB0aGUgbWVyZ2VkIGluZGV4IHdpbGwgY29udGFpblxuICogYSBsaXN0IG9mIHJlZmVyZW5jZXMgdG8gKGNhY2hlIG9iamVjdHMpIGZvciBcbiAqIHRoZSBMYXllcnMgd2hpY2ggYXJlIGRlZmluZWQgaW4gdGhpcyByZWdpb24uXG4gKiBcbiAqIEltcGxlbWVudGF0aW9uIGlzIHN0YXRlbGVzcy5cbiAqIFNldCBvZiBsYXllcnMgaXMgYXNzdW1lZCB0byBiZSBzdGF0aWMuXG4gKi9cblxuZnVuY3Rpb24gY21wX2FzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAxLCBwMilcbn1cblxuZnVuY3Rpb24gY21wX2Rlc2NlbmRpbmcocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmNtcChwMiwgcDEpXG59XG5cbmV4cG9ydCBjbGFzcyBOZWFyYnlJbmRleE1lcmdlIGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKHNvdXJjZXMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fc291cmNlcyA9IHNvdXJjZXM7XG4gICAgICAgIHRoaXMuX2NhY2hlcyA9IG5ldyBNYXAoc291cmNlcy5tYXAoKHNyYykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFtzcmMsIHNyYy5jcmVhdGVDYWNoZSgpXTtcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgb2Zmc2V0ID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuICAgICAgICAvLyBhY2N1bXVsYXRlIG5lYXJieSBmcm9tIGFsbCBzb3VyY2VzXG4gICAgICAgIGNvbnN0IHByZXZfbGlzdCA9IFtdLCBuZXh0X2xpc3QgPSBbXTtcbiAgICAgICAgY29uc3QgY2VudGVyID0gW107XG4gICAgICAgIGNvbnN0IGNlbnRlcl9oaWdoX2xpc3QgPSBbXTtcbiAgICAgICAgY29uc3QgY2VudGVyX2xvd19saXN0ID0gW11cbiAgICAgICAgZm9yIChsZXQgc3JjIG9mIHRoaXMuX3NvdXJjZXMpIHtcbiAgICAgICAgICAgIGxldCBuZWFyYnkgPSBzcmMuaW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgICAgICBsZXQgcHJldl9yZWdpb24gPSBzcmMuaW5kZXguZmluZF9yZWdpb24obmVhcmJ5LCB7ZGlyZWN0aW9uOi0xfSk7XG4gICAgICAgICAgICBsZXQgbmV4dF9yZWdpb24gPSBzcmMuaW5kZXguZmluZF9yZWdpb24obmVhcmJ5LCB7ZGlyZWN0aW9uOjF9KTtcbiAgICAgICAgICAgIGlmIChwcmV2X3JlZ2lvbiAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBwcmV2X2xpc3QucHVzaChlbmRwb2ludC5mcm9tX2ludGVydmFsKHByZXZfcmVnaW9uLml0dilbMV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5leHRfcmVnaW9uICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIG5leHRfbGlzdC5wdXNoKGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmV4dF9yZWdpb24uaXR2KVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobmVhcmJ5LmNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY2VudGVyLnB1c2godGhpcy5fY2FjaGVzLmdldChzcmMpKTtcbiAgICAgICAgICAgICAgICBsZXQgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5lYXJieS5pdHYpO1xuICAgICAgICAgICAgICAgIGNlbnRlcl9oaWdoX2xpc3QucHVzaChoaWdoKTtcbiAgICAgICAgICAgICAgICBjZW50ZXJfbG93X2xpc3QucHVzaChsb3cpOyAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gZmluZCBjbG9zZXN0IGVuZHBvaW50IHRvIHRoZSByaWdodCAobm90IGluIGNlbnRlcilcbiAgICAgICAgbmV4dF9saXN0LnNvcnQoY21wX2FzY2VuZGluZyk7XG4gICAgICAgIGNvbnN0IG5leHRfbG93ID0gbmV4dF9saXN0WzBdIHx8IGVuZHBvaW50LlBPU19JTkY7XG5cbiAgICAgICAgLy8gZmluZCBjbG9zZXN0IGVuZHBvaW50IHRvIHRoZSBsZWZ0IChub3QgaW4gY2VudGVyKVxuICAgICAgICBwcmV2X2xpc3Quc29ydChjbXBfZGVzY2VuZGluZyk7XG4gICAgICAgIGNvbnN0IHByZXZfaGlnaCA9IHByZXZfbGlzdFswXSB8fCBlbmRwb2ludC5ORUdfSU5GO1xuXG4gICAgICAgIHJldHVybiBuZWFyYnlfZnJvbShcbiAgICAgICAgICAgICAgICBwcmV2X2hpZ2gsIFxuICAgICAgICAgICAgICAgIGNlbnRlcl9sb3dfbGlzdCwgXG4gICAgICAgICAgICAgICAgY2VudGVyLFxuICAgICAgICAgICAgICAgIGNlbnRlcl9oaWdoX2xpc3QsXG4gICAgICAgICAgICAgICAgbmV4dF9sb3dcbiAgICAgICAgICAgICk7XG4gICAgfVxufTtcbiIsImltcG9ydCB7IGludGVydmFsLCBlbmRwb2ludH0gZnJvbSBcIi4uL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi4vbmVhcmJ5X2Jhc2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVyX2Jhc2UuanNcIlxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQk9PTEVBTiBMQVlFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKiBcbiAgICBCb29sZWFuIExheWVyIGlzIHJldHVybnMgdmFsdWVzIDAvMSAtIG1ha2luZyBpdCBhIG51bWVyaWMgbGF5ZXJcbiovXG5cblxuZXhwb3J0IGZ1bmN0aW9uIGJvb2xlYW5fbGF5ZXIoc3JjKSB7XG5cbiAgICBjb25zdCBsYXllciA9IG5ldyBMYXllcigpO1xuICAgIGxheWVyLmluZGV4ID0gbmV3IE5lYXJieUluZGV4Qm9vbGVhbihzcmMuaW5kZXgpO1xuICAgIFxuICAgIC8vIHN1YnNjcmliZVxuICAgIHNyYy5hZGRfY2FsbGJhY2soKGVBcmcpID0+IHtcbiAgICAgICAgbGF5ZXIub25jaGFuZ2UoZUFyZyk7XG4gICAgfSk7XG5cblxuICAgIC8vIHJlc3RyaWN0aW9uc1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShsYXllciwgXCJudW1lcmljXCIsIHtnZXQ6ICgpID0+IHRydWV9KTtcblxuICAgIC8vIGluaXRpYWxpc2VcbiAgICBsYXllci5zcmMgPSBzcmM7XG4gICAgcmV0dXJuIGxheWVyO1xufSBcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQk9PTEVBTiBORUFSQlkgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBXcmFwcGVyIEluZGV4IHdoZXJlIHJlZ2lvbnMgYXJlIHRydWUvZmFsc2UsIGJhc2VkIG9uIFxuICogY29uZGl0aW9uIG9uIG5lYXJieS5jZW50ZXIuXG4gKiBCYWNrLXRvLWJhY2sgcmVnaW9ucyB3aGljaCBhcmUgdHJ1ZSBhcmUgY29sbGFwc2VkIFxuICogaW50byBvbmUgcmVnaW9uXG4gKiBcbiAqL1xuXG5mdW5jdGlvbiBxdWVyeU9iamVjdCAodmFsdWUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBxdWVyeTogZnVuY3Rpb24gKG9mZnNldCkge1xuICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZSwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4Qm9vbGVhbiBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbmRleCwgb3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9pbmRleCA9IGluZGV4O1xuICAgICAgICBsZXQge2NvbmRpdGlvbiA9IChjZW50ZXIpID0+IGNlbnRlci5sZW5ndGggPiAwfSA9IG9wdGlvbnM7XG4gICAgICAgIHRoaXMuX2NvbmRpdGlvbiA9IGNvbmRpdGlvbjtcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIG9mZnNldCA9IGVuZHBvaW50LmZyb21faW5wdXQob2Zmc2V0KTtcbiAgICAgICAgY29uc3QgbmVhcmJ5ID0gdGhpcy5faW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgIFxuICAgICAgICBsZXQgZXZhbHVhdGlvbiA9IHRoaXMuX2NvbmRpdGlvbihuZWFyYnkuY2VudGVyKTsgXG4gICAgICAgIC8qIFxuICAgICAgICAgICAgc2VlayBsZWZ0IGFuZCByaWdodCBmb3IgZmlyc3QgcmVnaW9uXG4gICAgICAgICAgICB3aGljaCBkb2VzIG5vdCBoYXZlIHRoZSBzYW1lIGV2YWx1YXRpb24gXG4gICAgICAgICovXG4gICAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IChjZW50ZXIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9jb25kaXRpb24oY2VudGVyKSAhPSBldmFsdWF0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZXhwYW5kIHJpZ2h0XG4gICAgICAgIGxldCByaWdodDtcbiAgICAgICAgbGV0IHJpZ2h0X25lYXJieSA9IHRoaXMuX2luZGV4LmZpbmRfcmVnaW9uKG5lYXJieSwge1xuICAgICAgICAgICAgZGlyZWN0aW9uOjEsIGNvbmRpdGlvblxuICAgICAgICB9KTsgICAgICAgIFxuICAgICAgICBpZiAocmlnaHRfbmVhcmJ5ICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmlnaHQgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKHJpZ2h0X25lYXJieS5pdHYpWzBdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZXhwYW5kIGxlZnRcbiAgICAgICAgbGV0IGxlZnQ7XG4gICAgICAgIGxldCBsZWZ0X25lYXJieSA9IHRoaXMuX2luZGV4LmZpbmRfcmVnaW9uKG5lYXJieSwge1xuICAgICAgICAgICAgZGlyZWN0aW9uOi0xLCBjb25kaXRpb25cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChsZWZ0X25lYXJieSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGxlZnQgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGxlZnRfbmVhcmJ5Lml0dilbMV07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBleHBhbmQgdG8gaW5maW5pdHlcbiAgICAgICAgbGVmdCA9IGxlZnQgfHwgZW5kcG9pbnQuTkVHX0lORjtcbiAgICAgICAgcmlnaHQgPSByaWdodCB8fCBlbmRwb2ludC5QT1NfSU5GO1xuICAgICAgICBjb25zdCBsb3cgPSBlbmRwb2ludC5mbGlwKGxlZnQpO1xuICAgICAgICBjb25zdCBoaWdoID0gZW5kcG9pbnQuZmxpcChyaWdodClcbiAgICAgICAgY29uc3QgdmFsdWUgPSBldmFsdWF0aW9uID8gMSA6IDA7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpdHY6IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCksXG4gICAgICAgICAgICBjZW50ZXIgOiBbcXVlcnlPYmplY3QodmFsdWUpXSxcbiAgICAgICAgICAgIGxlZnQsXG4gICAgICAgICAgICByaWdodCxcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVyX2Jhc2UuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4Qm9vbGVhbiB9IGZyb20gXCIuL2Jvb2xlYW4uanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4TWVyZ2UgfSBmcm9tIFwiLi9tZXJnZS5qc1wiO1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dpY2FsX21lcmdlX2xheWVyKHNvdXJjZXMsIG9wdGlvbnM9e30pIHtcblxuICAgIGNvbnN0IHtleHByfSA9IG9wdGlvbnM7XG4gICAgbGV0IGNvbmRpdGlvbjtcbiAgICBpZiAoZXhwcikge1xuICAgICAgICBjb25kaXRpb24gPSAoY2VudGVyKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gZXhwci5ldmFsKGNlbnRlcik7XG4gICAgICAgIH0gICAgXG4gICAgfVxuXG4gICAgY29uc3QgbGF5ZXIgPSBuZXcgTGF5ZXIoKTtcbiAgICBjb25zdCBpbmRleCA9IG5ldyBOZWFyYnlJbmRleE1lcmdlKHNvdXJjZXMpO1xuICAgIGxheWVyLmluZGV4ID0gbmV3IE5lYXJieUluZGV4Qm9vbGVhbihpbmRleCwge2NvbmRpdGlvbn0pO1xuXG4gICAgLy8gc3Vic2NyaWJlIHRvIGNhbGxiYWNrcyBmcm9tIHNvdXJjZXNcbiAgICBzb3VyY2VzLm1hcCgoc3JjKSA9PiB7XG4gICAgICAgIHJldHVybiBzcmMuYWRkX2NhbGxiYWNrKGxheWVyLm9uY2hhbmdlKTtcbiAgICB9KTtcbiAgICBcbiAgICBsYXllci5zb3VyY2VzID0gc291cmNlcztcblxuICAgIC8vIHJlc3RyaWN0aW9uc1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShsYXllciwgXCJudW1lcmljXCIsIHtnZXQ6ICgpID0+IHRydWV9KTtcblxuICAgIHJldHVybiBsYXllcjtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gbG9naWNhbF9leHByIChzcmMpIHtcbiAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBMYXllcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBtdXN0IGJlIGxheWVyICR7c3JjfWApXG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGNhY2hlIG9mIGNlbnRlcikge1xuICAgICAgICAgICAgICAgIGlmIChjYWNoZS5zcmMgPT0gc3JjKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxubG9naWNhbF9leHByLmFuZCA9IGZ1bmN0aW9uIGFuZCguLi5leHBycykge1xuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBleHBycy5ldmVyeSgoZXhwcikgPT4gZXhwci5ldmFsKGNlbnRlcikpO1xuICAgICAgICB9ICAgIFxuICAgIH1cbn1cblxubG9naWNhbF9leHByLm9yID0gZnVuY3Rpb24gb3IoLi4uZXhwcnMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBldmFsOiBmdW5jdGlvbiAoY2VudGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwcnMuc29tZSgoZXhwcikgPT4gZXhwci5ldmFsKGNlbnRlcikpO1xuICAgICAgICB9ICAgIFxuICAgIH1cbn1cblxubG9naWNhbF9leHByLnhvciA9IGZ1bmN0aW9uIHhvcihleHByMSwgZXhwcjIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBldmFsOiBmdW5jdGlvbiAoY2VudGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwcjEuZXZhbChjZW50ZXIpICE9IGV4cHIyLmV2YWwoY2VudGVyKTtcbiAgICAgICAgfSAgICBcbiAgICB9XG59XG5cbmxvZ2ljYWxfZXhwci5ub3QgPSBmdW5jdGlvbiBub3QoZXhwcikge1xuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiAhZXhwci5ldmFsKGNlbnRlcik7XG4gICAgICAgIH0gICAgXG4gICAgfVxufVxuXG5cblxuXG4iLCJpbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuLi91dGlsL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4uL25lYXJieV9iYXNlLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcl9iYXNlLmpzXCJcbmltcG9ydCAqIGFzIHNyY3Byb3AgZnJvbSBcIi4uL3V0aWwvYXBpX3NyY3Byb3AuanNcIjtcblxuXG4vKipcbiAqIGFmZmluZSB0cmFuc2Zvcm0gMUQgYnkgc2hpZnQgYW5kIHNjYWxlIGZhY3RvclxuICovXG5cbmZ1bmN0aW9uIHRyYW5zZm9ybShwLCB7c2hpZnQ9MCwgc2NhbGU9MX0pIHtcbiAgICBpZiAocCA9PSB1bmRlZmluZWQgfHwgIWlzRmluaXRlKHApKSB7XG4gICAgICAgIC8vIHAgLSBub29wXG4gICAgICAgIHJldHVybiBwO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2YgcCA9PSBcIm51bWJlclwiKSB7XG4gICAgICAgIC8vIHAgaXMgbnVtYmVyIC0gdHJhbnNmb3JtXG4gICAgICAgIHJldHVybiAocCpzY2FsZSkgKyBzaGlmdDtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocCkgJiYgcC5sZW5ndGggPiAxKSB7XG4gICAgICAgIC8vIHAgaXMgZW5kcG9pbnQgLSB0cmFuc2Zvcm0gdmFsdWVcbiAgICAgICAgbGV0IFt2YWwsIGJyYWNrZXRdID0gcDtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW5wdXQoWyh2YWwqc2NhbGUpK3NoaWZ0LCBicmFja2V0XSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZXZlcnNlKHAsIHtzaGlmdD0wLCBzY2FsZT0xfSkge1xuICAgIGlmIChwID09IHVuZGVmaW5lZCB8fCAhaXNGaW5pdGUocCkpIHtcbiAgICAgICAgLy8gcCAtIG5vb3BcbiAgICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBwID09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgLy8gcCBpcyBudW1iZXIgLSB0cmFuc2Zvcm1cbiAgICAgICAgcmV0dXJuIChwLXNoaWZ0KS9zY2FsZTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocCkgJiYgcC5sZW5ndGggPiAxKSB7XG4gICAgICAgIC8vIHAgaXMgZW5kcG9pbnQgLSB0cmFuc2Zvcm0gdmFsdWVcbiAgICAgICAgbGV0IFt2YWwsIGJyYWNrZXRdID0gcDtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW5wdXQoWygodmFsLXNoaWZ0KS9zY2FsZSksIGJyYWNrZXRdKTtcbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE5FQVJCWSBJTkRFWCAtIEFGRklORSBUSU1FTElORSBUUkFOU0ZPUk1cbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuY2xhc3MgTmVhcmJ5SW5kZXhBVFQgZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKGxheWVyLCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIHRoaXMuX2NhY2hlID0gbGF5ZXIuY3JlYXRlQ2FjaGUoKTtcbiAgICAgICAgdGhpcy5fb3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgICAgIFxuICAgICAgICAvLyB0cmFuc2Zvcm0gY2FjaGVcbiAgICAgICAgdGhpcy5fdHJhbnNmb3JtX2NhY2hlID0ge1xuICAgICAgICAgICAgcXVlcnk6IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICAgICAgICAgICAgICAvLyByZXZlcnNlIHRyYW5zZm9ybSBxdWVyeVxuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5fY2FjaGUucXVlcnkocmV2ZXJzZShvZmZzZXQsIHRoaXMuX29wdGlvbnMpKTtcbiAgICAgICAgICAgICAgICAvLyBrZWVwIG9yaWdpbmFsIG9mZnNldCAoaW5zdGVhZCBvZiByZXZlcnNpbmcgcmVzdWx0KVxuICAgICAgICAgICAgICAgIHJldHVybiB7Li4uc3RhdGUsIG9mZnNldH07XG4gICAgICAgICAgICB9LmJpbmQodGhpcylcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIG9mZnNldCA9IGVuZHBvaW50LmZyb21faW5wdXQob2Zmc2V0KTtcbiAgICAgICAgLy8gcmV2ZXJzZSB0cmFuc2Zvcm0gcXVlcnkgb2Zmc2V0XG4gICAgICAgIGNvbnN0IG5lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShyZXZlcnNlKG9mZnNldCwgdGhpcy5fb3B0aW9ucykpO1xuICAgICAgICAvLyB0cmFuc2Zvcm0gcXVlcnkgcmVzdWx0IFxuICAgICAgICBjb25zdCBpdHYgPSBuZWFyYnkuaXR2LnNsaWNlKCk7XG4gICAgICAgIGl0dlswXSA9IHRyYW5zZm9ybShuZWFyYnkuaXR2WzBdLCB0aGlzLl9vcHRpb25zKTtcbiAgICAgICAgaXR2WzFdID0gdHJhbnNmb3JtKG5lYXJieS5pdHZbMV0sIHRoaXMuX29wdGlvbnMpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXR2LFxuICAgICAgICAgICAgbGVmdDogdHJhbnNmb3JtKG5lYXJieS5sZWZ0LCB0aGlzLl9vcHRpb25zKSxcbiAgICAgICAgICAgIHJpZ2h0OiB0cmFuc2Zvcm0obmVhcmJ5LnJpZ2h0LCB0aGlzLl9vcHRpb25zKSxcbiAgICAgICAgICAgIGNlbnRlcjogbmVhcmJ5LmNlbnRlci5tYXAoKCkgPT4gdGhpcy5fdHJhbnNmb3JtX2NhY2hlKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBUSU1FTElORSBUUkFOU0ZPUk0gTEFZRVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBTaGlmdGluZyBhbmQgc2NhbGluZyB0aGUgdGltZWxpbmUgb2YgYSBsYXllclxuICogXG4gKiBvcHRpb25zOlxuICogLSBzaGlmdDogYSB2YWx1ZSBvZiAyIGVmZmVjdGl2ZWx5IG1lYW5zIHRoYXQgbGF5ZXIgY29udGVudHMgXG4gKiAgIGFyZSBzaGlmdGVkIHRvIHRoZSByaWdodCBvbiB0aGUgdGltZWxpbmUsIGJ5IDIgdW5pdHNcbiAqIC0gc2NhbGU6IGEgdmFsdWUgb2YgMiBtZWFucyB0aGF0IHRoZSBsYXllciBpcyBzdHJldGNoZWRcbiAqICAgYnkgYSBmYWN0b3Igb2YgMlxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiB0aW1lbGluZV90cmFuc2Zvcm0gKHNyYywgb3B0aW9ucz17fSkge1xuXG4gICAgY29uc3QgbGF5ZXIgPSBuZXcgTGF5ZXIoKTtcblxuICAgIC8vIHNldHVwIHNyYyBwcm9wZXJ0eVxuICAgIHNyY3Byb3AuYWRkU3RhdGUobGF5ZXIpO1xuICAgIHNyY3Byb3AuYWRkTWV0aG9kcyhsYXllcik7XG4gICAgbGF5ZXIuc3JjcHJvcF9yZWdpc3RlcihcInNyY1wiKTtcbiAgICAgICAgXG4gICAgbGF5ZXIuc3JjcHJvcF9jaGVjayA9IGZ1bmN0aW9uKHByb3BOYW1lLCBzcmMpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIExheWVyICR7c3JjfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNyYzsgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsYXllci5zcmNwcm9wX29uY2hhbmdlID0gZnVuY3Rpb24ocHJvcE5hbWUsIGVBcmcpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmIChlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXggPSBuZXcgTmVhcmJ5SW5kZXhBVFQodGhpcy5zcmMsIG9wdGlvbnMpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgbGF5ZXIub25jaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlc3RyaWN0aW9uc1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShsYXllciwgXCJudW1lcmljXCIsIHtnZXQ6ICgpID0+IHNyYy5udW1lcmljfSk7XG5cbiAgICAvLyBpbml0aWFsaXNlXG4gICAgbGF5ZXIuc3JjID0gc3JjO1xuXG5cblxuICAgIFxuICAgIHJldHVybiBsYXllcjtcbn1cblxuIiwiaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4uL2N1cnNvcl9iYXNlLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcl9iYXNlLmpzXCJcbmltcG9ydCB7IE5lYXJieUluZGV4U3JjIH0gZnJvbSBcIi4uL25lYXJieV9iYXNlLmpzXCJcblxuXG5cbi8vIFRPRE8gLSBlbnVzdXJlIG51bWVyaWMgaWYgc2V0IHRvIHRydWVcblxuZnVuY3Rpb24gdHJhbnNmb3JtU3RhdGUoc3RhdGUsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7dmFsdWVGdW5jLCBzdGF0ZUZ1bmN9ID0gb3B0aW9ucztcbiAgICBpZiAodmFsdWVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBzdGF0ZS52YWx1ZSA9IHZhbHVlRnVuYyhzdGF0ZS52YWx1ZSk7XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9IGVsc2UgaWYgKHN0YXRlRnVuYyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlRnVuYyhzdGF0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDdXJzb3IgVHJhbnNmb3JtXG4gKiBDcmVhdGUgYSBuZXcgQ3Vyc29yIHdoaWNoIGlzIGEgdHJhbnNmb3JtYXRpb24gb2YgYSBzcmMgQ3Vyc29yLlxuICogXG4gKiBUaGUgbmV3IHRyYW5zZm9ybWVkIEN1cnNvciBkb2VzIG5vdCBoYXZlIGEgc3JjIChsYXllcikgYW5kIGFuZCBhIGN0cmwgKGN1cnNvcilcbiAqIHByb3BlcnR5LCBzaW5jZSBpdCBvbmx5IGRlcGVuZHMgb24gdGhlIHNyYyBjdXJzb3IuXG4gKiBcbiAqIEFsc28sIHRoZSBuZXcgdHJhbnNmb3JtZWQgY3Vyc29yIGRvZXMgbm90IG5lZWQgYW55IHBsYXliYWNrIGxvZ2ljIG9uIGl0cyBvd25cbiAqIGFzIGxvbmcgYXMgdGhlIG5hdHVyZSBvZiB0aGUgdHJhbnNmb3JtYXRpb24gaXMgYSBwbGFpbiB2YWx1ZS9zdGF0ZSB0cmFuc2l0aW9uLiBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGN1cnNvcl90cmFuc2Zvcm0oc3JjLCBvcHRpb25zPXt9KSB7XG5cbiAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBDdXJzb3IpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgc3JjIG11c3QgYmUgYSBDdXJzb3IgJHtzcmN9YCk7XG4gICAgfVxuXG4gICAgY29uc3Qge251bWVyaWMsIHZhbHVlRnVuYywgc3RhdGVGdW5jfSA9IG9wdGlvbnM7XG4gICAgY29uc3QgY3Vyc29yID0gbmV3IEN1cnNvcigpO1xuXG4gICAgLy8gaW1wbGVtZW50IHF1ZXJ5XG4gICAgY3Vyc29yLnF1ZXJ5ID0gZnVuY3Rpb24gcXVlcnkoKSB7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3JjLnF1ZXJ5KCk7XG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm1TdGF0ZShzdGF0ZSwge3N0YXRlRnVuYywgdmFsdWVGdW5jfSk7XG4gICAgfVxuXG4gICAgLy8gbnVtYmVyaWMgY2FuIGJlIHNldCB0byB0cnVlIGJ5IG9wdGlvbnNcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3Vyc29yLCBcIm51bWVyaWNcIiwge2dldDogKCkgPT4ge1xuICAgICAgICByZXR1cm4gKG51bWVyaWMgPT0gdW5kZWZpbmVkKSA/IHNyYy5udW1lcmljIDogbnVtZXJpYzsgXG4gICAgfX0pO1xuICAgIC8vIGZpeGVkUmF0ZSBpcyBpbmhlcml0ZWQgZnJvbSBzcmNcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3Vyc29yLCBcImZpeGVkUmF0ZVwiLCB7Z2V0OiAoKSA9PiBzcmMuZml4ZWRSYXRlfSk7XG5cbiAgICBpZiAoc3JjLmZpeGVkUmF0ZSkge1xuICAgICAgICAvLyBwcm9wYWdhdGUgcmF0ZSBwcm9wZXJ0eSBmcm9tIHNyY1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3Vyc29yLCBcInJhdGVcIiwge2dldDogKCkgPT4gc3JjLnJhdGV9KTtcbiAgICB9XG5cbiAgICAvLyBjYWxsYmFja3MgZnJvbSBzcmMtY3Vyc29yXG4gICAgc3JjLmFkZF9jYWxsYmFjaygoKSA9PiB7Y3Vyc29yLm9uY2hhbmdlKCl9KTtcbiAgICByZXR1cm4gY3Vyc29yO1xufVxuXG5cbi8qKlxuICogTGF5ZXIgVHJhbnNmb3JtXG4gKiBDcmVhdGUgYSBuZXcgTGF5ZXIgd2hpY2ggaXMgYSB0cmFuc2Zvcm1hdGlvbiBvZiB0aGUgc3JjIExheWVyXG4gKi9cblxuZnVuY3Rpb24gd3JhcHBlZFZhbHVlRnVuYyh2YWx1ZUZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHtzb3VyY2VzLCBzdGF0ZXMsIG9mZnNldH0pIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlRnVuYyhzdGF0ZXNbMF0udmFsdWUpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gd3JhcHBlZFN0YXRlRnVuYyhzdGF0ZUZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHtzb3VyY2VzLCBzdGF0ZXMsIG9mZnNldH0pIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlRnVuYyhzdGF0ZXNbMF0pO1xuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxheWVyX3RyYW5zZm9ybShzcmMsIG9wdGlvbnM9e30pIHtcblxuICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNyYyBtdXN0IGJlIGEgTGF5ZXIgJHtzcmN9YCk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3BzID0ge307XG4gICAgb3BzLnZhbHVlRnVuYyA9IHdyYXBwZWRWYWx1ZUZ1bmMob3B0aW9ucy52YWx1ZUZ1bmMpO1xuICAgIG9wcy5zdGF0ZUZ1bmMgPSB3cmFwcGVkU3RhdGVGdW5jKG9wdGlvbnMuc3RhdGVGdW5jKTtcblxuICAgIGNvbnN0IGxheWVyID0gbmV3IExheWVyKG9wcyk7XG4gICAgbGF5ZXIuaW5kZXggPSBuZXcgTmVhcmJ5SW5kZXhTcmMoc3JjKTtcbiAgICBsYXllci5zcmMgPSBzcmM7XG4gICAgbGF5ZXIuc3JjLmFkZF9jYWxsYmFjaygoZUFyZykgPT4ge2xheWVyLm9uY2hhbmdlKGVBcmcpfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobGF5ZXIsIFwibnVtZXJpY1wiLCB7Z2V0OiAoKSA9PiBzcmMubnVtZXJpY30pO1xuXG4gICAgcmV0dXJuIGxheWVyO1xufVxuXG5cblxuIiwiaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4uL2N1cnNvcl9iYXNlLmpzXCI7XG5pbXBvcnQgeyBsb2NhbF9jbG9jayB9IGZyb20gXCIuLi91dGlsL2NvbW1vbi5qc1wiO1xuXG4vKipcbiAqIHJlY29yZCBjdXJzb3IgaW50byBsYXllclxuICogXG4gKiAgIE1BSU4gSURFQVxuICogLSByZWNvcmQgdGhlIGN1cnJlbnQgdmFsdWUgb2YgYSBjdXJzb3IgKHNyYykgaW50byBhIGxheWVyIChkc3QpXG4gKiBcbiAqIC0gcmVjb3JkaW5nIGlzIGVzc2VudGlhbGx5IGEgY29weSBvcGVyYXRpb24gZnJvbSB0aGVcbiAqICAgc3RhdGVQcm92aWRlciBvZiBhIGN1cnNvciAoc3JjKSB0byB0aGUgc3RhdGVQcm92aWRlciBvZiB0aGUgbGF5ZXIgKGRzdCkuXG4gKiAtIG1vcmUgZ2VuZXJhbGx5IGNvcHkgc3RhdGUgKGl0ZW1zKSBmcm9tIGN1cnNvciB0byBsYXllci4gXG4gKiAtIHJlY29yZGluZyB0aGVyZWZvciBvbmx5IGFwcGxpZXMgdG8gY3Vyc29ycyB0aGF0IHJ1biBkaXJlY3RseSBvbiBhIGxheWVyIHdpdGggaXRlbXNcbiAqIC0gbW9yZW92ZXIsIHRoZSB0YXJnZXQgbGF5ZXIgbXVzdCBoYXZlIGl0ZW1zICh0eXBpY2FsbHkgYSBsZWFmbGF5ZXIpXG4gKlxuICogXG4gKiAgIFRJTUVGUkFNRVMgXG4gKiAtIHRoZSByZWNvcmRpbmcgdG8gKGRzdCkgbGF5ZXIgaXMgZHJpdmVuIGJ5IGEgY2xvY2sgKGN0cmwpOiA8RFNUX0NMT0NLPlxuICogLSBkdXJpbmcgcmVjb3JkaW5nIC0gY3VycmVudCB2YWx1ZSBvZiB0aGUgc3JjIGN1cnNvciB3aWxsIGJlIGNvcGllZCwgYW5kXG4gKiAgIGNvbnZlcnRlZCBpbnRvIHRoZSB0aW1lbGluZSBvZiB0aGUgPERTVF9DTE9DSz5cbiAqIC0gcmVjb3JkaW5nIGlzIGFjdGl2ZSBvbmx5IHdoZW4gPERTVF9DTE9DSz4gaXMgcHJvZ3Jlc3Npbmcgd2l0aCByYXRlPT0xLjBcbiAqIC0gdGhpcyBvcGVucyBmb3IgTElWRSByZWNvcmRpbmcgKDxEU1RfQ0xPQ0s+IGlzIGZpeGVkUmF0ZSBjdXJzb3IpIG9yXG4gKiAgIGl0ZXJhdGl2ZSByZWNvcmRpbmcgdXNpbmcgYSAoTnVtYmVyaWNWYXJpYWJsZSksIGFsbG93aW5nIG11bHRpcGxlIHRha2VzLCBcbiAqIFxuICogXG4gKiAgIFJFQ09SRElOR1xuICogLSByZWNvcmRpbmcgaXMgZG9uZSBieSBhcHBlbmRpbmcgaXRlbXMgdG8gdGhlIGRzdCBsYXllciBcbiAqIC0gd2hlbiB0aGUgY3Vyc29yIHN0YXRlIGNoYW5nZXMgKGVudGlyZSBjdXJzb3Iuc3JjIGxheWVyIGlzIHJlc2V0KSBcbiAqIC0gdGhlIHBhcnQgd2hpY2ggZGVzY3JpYmVzIHRoZSBmdXR1cmUgd2lsbCBvdmVyd3JpdGUgdGhlIHJlbGV2YW50XG4gKiAtIHBhcnQgb2YgdGhlIHRoZSBsYXllciB0aW1lbGluZVxuICogLSB0aGUgZGVsaW5lYXRpb24gYmV0d2VlbiBwYXN0IGFuZCBmdXR1cmUgaXMgZGV0ZXJtaW5lZCBieSBcbiAqIC0gZnJlc2ggdGltZXN0YW1wIDxUUz4gZnJvbSA8RFNUX0NMT0NLPlxuICogLSBpZiBhbiBpdGVtIG92ZXJsYXBzIHdpdGggPFRTPiBpdCB3aWxsIGJlIHRydW5jYXRlcyBzbyB0aGF0IG9ubHkgdGhlIHBhcnRcbiAqIC0gdGhhdCBpcyBpbiB0aGUgZnV0dXJlIHdpbGwgYmUgcmVjb3JkZWQgKGNvcGllZCkgdG8gdGhlIGxheWVyLlxuICogLSBpbiBjYXNlIChjdHJsKSBpcyBhIG1lZGlhIGNvbnRyb2wgLSByZWNvcmRpbmcgY2FuIG9ubHkgaGFwcGVuXG4gKiAgIHdoZW4gdGhlIChjdHJsKSBpcyBtb3ZpbmcgZm9yd2FyZFxuICogXG4gKiAgIElOUFVUXG4gKiAtIChjdHJsKVxuICogICAgICAtIG51bWVyaWMgY3Vyc29yIChjdHJsLmZpeGVkUmF0ZSwgb3IgXG4gKiAgICAgIC0gbWVkaWEgY29udHJvbCAoY3RybC5jdHJsLmZpeGVkUmF0ZSAmJiBjdHJsLnNyYy5pdGVtc09ubHkpXG4gKiAtIChzcmMpIC0gY3Vyc29yIHdpdGggbGF5ZXIgd2l0aCBpdGVtcyAoc3JjLml0ZW1zT25seSkgXG4gKiAtIChkc3QpIC0gbGF5ZXIgb2YgaXRlbXMgKGRzdC5pdGVtc09ubHkgJiYgZHN0Lm11dGFibGUpXG4gKlxuICogICBOT1RFXG4gKiAtIGltcGxlbWVudGF0aW9uIGFzc3VtZXMgXG4gKiAgICAgIC0gKGRzdCkgbGF5ZXIgaXMgbm90IHRoZSBzYW1lIGFzIHRoZSAoc3JjKSBsYXllclxuICogICAgICAtIChzcmMpIGN1cnNvciBjYW4gbm90IGJlIGNsb2NrIGN1cnNvciAobWFrZXMgbm8gc2Vuc2UgdG8gcmVjb3JkIGEgY2xvY2tcbiAqICAgXG4gKi9cblxuXG5leHBvcnQgZnVuY3Rpb24gbGF5ZXJfcmVjb3JkZXIob3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHtjdHJsLCBzcmMsIGRzdH0gPSBvcHRpb25zO1xuXG4gICAgLy8gY2hlY2sgLSBjdHJsXG4gICAgaWYgKCEoY3RybCBpbnN0YW5jZW9mIEN1cnNvcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjdHJsIG11c3QgYmUgYSBjdXJzb3IgJHtjdHJsfWApO1xuICAgIH1cbiAgICBpZiAoXG4gICAgICAgICFjdHJsLmZpeGVkUmF0ZSAmJiAhY3RybC5jdHJsLmZpeGVkUmF0ZVxuICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGN0cmwgb3IgY3RybC5jdHJsIG11c3QgYmUgZml4ZWRSYXRlICR7Y3RybH1gKTtcbiAgICB9XG4gICAgaWYgKCFjdHJsLmZpeGVkUmF0ZSkge1xuICAgICAgICBpZiAoY3RybC5jdHJsLmZpeGVkUmF0ZSAmJiAhY3RybC5pdGVtc09ubHkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZ2l2ZW4gY3RybC5jdHJsLmZpeGVkUmF0ZSwgY3RybCBtdXN0IGJlIGl0ZW1zT25seSAke2N0cmx9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjaGVjayAtIHNyY1xuICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIEN1cnNvcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzcmMgbXVzdCBiZSBhIGN1cnNvciAke3NyY31gKTtcbiAgICB9XG4gICAgaWYgKChzcmMuZml4ZWRSYXRlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGN1cnNvciBzcmMgY2FuIG5vdCBiZSBmaXhlZFJhdGUgY3Vyc29yICR7c3JjfWApO1xuICAgIH1cbiAgICBpZiAoIXNyYy5pdGVtc09ubHkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjdXJzb3Igc3JjIG11c3QgYmUgaXRlbXNPbmx5ICR7c3JjfWApO1xuICAgIH1cbiAgICBpZiAoIXNyYy5tdXRhYmxlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgY3Vyc29yIHNyYyBtdXN0IGJlIG11dGFibGUgJHtzcmN9YCk7XG4gICAgfVxuXG4gICAgLy8gY2hlY2sgLSBzdGF0ZVByb3ZpZGVyc1xuICAgIGNvbnN0IHNyY19zdGF0ZVByb3ZpZGVyID0gc3JjLnNyYy5wcm92aWRlcjtcbiAgICBjb25zdCBkc3Rfc3RhdGVQcm92aWRlciA9IGRzdC5wcm92aWRlcjtcbiAgICBpZiAoc3JjX3N0YXRlUHJvdmlkZXIgPT09IGRzdF9zdGF0ZVByb3ZpZGVyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgc3JjIGFuZCBkc3QgY2FuIG5vdCBoYXZlIHRoZSBzYW1lIHN0YXRlUHJvdmlkZXJgKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIHR1cm4gdGhpcyBhcm91bmQ/XG4gICAgICogaGF2ZSBzdGFydCBhbmQgc3RvcCByZWNvcmRpbmdcbiAgICAgKiBtZXRob2RzIGRpcmVjdCB0aGUgY29udHJvbD9cbiAgICAgKiBcbiAgICAgKiByZWNvcmRpbmcgd2l0aCBsaXZlIGNsb2NrIHJlcXVpcmVzXG4gICAgICogc3RhcnQgYW5kIHN0b3AgbWV0aG9kc1xuICAgICAqIFxuICAgICAqIHdoYXQgYWJvdXQgYSBtZWRpYSBjbG9jayA/XG4gICAgICogc2hvdWxkIGJlIGEgbWVkaWEgY2xvY2sgdGhhdCBjYW4gb25seSBtb3ZlIGZvcndhcmRcbiAgICAgKiBpdCBhY3R1YWxseSBtYWtlcyBzZW5zZSB0byBiZSBpbiByZWNvcmQgbW9kZSBldmVuIGlmIG1lZGlhY2xvY2sgaXMgcGF1c2VkXG4gICAgICogYmVjYXVzZSByZWNvcmRpbmcgb25seSBoYXBwZW5zIG9uIHN0YXRlIGNoYW5nZVxuICAgICAqIHBhdXNlZCBtZWFucyB5b3Ugb3ZlcndyaXRlIG9uIHRoZSBzYW1lIHNwb3RcbiAgICAgKiBza2lwcGluZyBiYWNrIHdoaWxlIGluIHJlY29yZCBtb2RlIC0gc2hvdWxkIHRoYXQgdHJpZ2dlciB3cml0ZSBjdXJyZW50XG4gICAgICogc3RhdGUgbG9uZ2VyIGJhY2tcbiAgICAgKiBcbiAgICAgKiBza2lwcGluZyBhbHdheXMgZXhpdCByZWNvcmQgbW9kZVxuICAgICAqIHJlY29yZCBtb2RlIGFsd2F5cyBzdGFydHNcbiAgICAgKiBtZWRpYSBjb250cm9sIG1heSBiZSBjb250cm9sbGVkIGV4dGVybmFsbHlcbiAgICAgKiBcbiAgICAgKiBzcGxpdCBiZXR3ZWVuIGEgbGl2ZSBhbmQgYSBtZWRpYSBjbG9jayByZWNvcmRlcj9cbiAgICAgKiBcbiAgICAgKi9cblxuICAgIC8vIGludGVybmFsIHN0YXRlXG4gICAgbGV0IGlzX3JlY29yZGluZyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogc3RhdGUgY2hhbmdlIGluIHNyYyBzdGF0ZVByb3ZpZGVyXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBvbl9zcmNfY2hhbmdlICgpIHtcbiAgICAgICAgaWYgKCFpc19yZWNvcmRpbmcpIHJldHVybjtcbiAgICAgICAgcmVjb3JkKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc3RhdGUgY2hhbmdlIGluIGN0cmxcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBvbl9jdHJsX2NoYW5nZSAoKSB7XG4gICAgICAgIC8vIGZpZ3VyZSBvdXQgaWYgcmVjb3JkaW5nIHN0YXJ0cyBvciBzdG9wc1xuICAgICAgICBjb25zdCB3YXNfcmVjb3JkaW5nID0gaXNfcmVjb3JkaW5nO1xuICAgICAgICBpc19yZWNvcmRpbmcgPSBmYWxzZTtcbiAgICAgICAgaWYgKGN0cmwuZml4ZWRSYXRlKSB7XG4gICAgICAgICAgICBpc19yZWNvcmRpbmcgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgY3RybF90cyA9IGN0cmwuY3RybC52YWx1ZTtcbiAgICAgICAgICAgIGNvbnN0IGl0ZW1zID0gY3RybC5zcmMuaW5kZXgubmVhcmJ5KGN0cmxfdHMpLmNlbnRlcjtcbiAgICAgICAgICAgIGlmIChpdGVtcy5sZW5ndGggPT0gMSlcbiAgICAgICAgICAgICAgICBpZiAoaXRlbXNbMF0udHlwZSA9PSBcIm1vdGlvblwiICkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBbcCx2LGEsdF0gPSBpdGVtc1swXS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICBpZiAodiA+IDAgfHwgdiA9PSAwICYmIGEgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpc19yZWNvcmRpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF3YXNfcmVjb3JkaW5nICYmIGlzX3JlY29yZGluZykge1xuICAgICAgICAgICAgc3RhcnRfcmVjb3JkaW5nKCk7XG4gICAgICAgIH0gZWxzZSBpZiAod2FzX3JlY29yZGluZyAmJiAhaXNfcmVjb3JkaW5nKSB7XG4gICAgICAgICAgICBzdG9wX3JlY29yZGluZygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVjb3JkXG4gICAgICovXG4gICAgZnVuY3Rpb24gc3RhcnRfcmVjb3JkaW5nKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcInN0YXJ0IHJlY29yZGluZ1wiKVxuICAgICAgICByZWNvcmQoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdG9wX3JlY29yZGluZygpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJzdG9wIHJlY29yZGluZ1wiKVxuICAgICAgICAvLyBjbG9zZSBsYXN0IGl0ZW1cbiAgICAgICAgY29uc3QgdHMgPSBsb2NhbF9jbG9jay5ub3coKTtcbiAgICAgICAgY29uc3QgZHN0X29mZnNldCA9IGN0cmwucXVlcnkodHMpLnZhbHVlO1xuICAgICAgICBjb25zdCBpdGVtcyA9IGRzdC5pbmRleC5uZWFyYnkoZHN0X29mZnNldCkuY2VudGVyO1xuICAgICAgICBjb25zdCBpbnNlcnQgPSBpdGVtcy5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG5ld19pdGVtID0gey4uLml0ZW19O1xuICAgICAgICAgICAgbmV3X2l0ZW0uaXR2WzFdID0gZHN0X29mZnNldDtcbiAgICAgICAgICAgIG5ld19pdGVtLml0dlszXSA9IGZhbHNlO1xuICAgICAgICAgICAgcmV0dXJuIG5ld19pdGVtO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGl0ZW1zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGRzdC51cGRhdGUoe2luc2VydCwgcmVzZXQ6ZmFsc2V9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlY29yZCgpIHtcbiAgICAgICAgY29uc3QgdHMgPSBsb2NhbF9jbG9jay5ub3coKTtcbiAgICAgICAgY29uc3Qgc3JjX29mZnNldCA9IHNyYy5xdWVyeSh0cykub2Zmc2V0O1xuICAgICAgICBjb25zdCBkc3Rfb2Zmc2V0ID0gY3RybC5xdWVyeSh0cykudmFsdWU7XG4gICAgICAgIC8vIGdldCBjdXJyZW50IHNyYyBpdGVtc1xuICAgICAgICAvLyBjcnVjaWFsIHRvIGNsb25lIHRoZSBpdGVtcyBiZWZvcmUgY2hhbmdpbmcgYW5kXG4gICAgICAgIC8vIHN0b3JpbmcgdGhlbSBpbiB0aGUgZHN0IGxheWVyXG4gICAgICAgIGxldCBzcmNfaXRlbXMgPSBzdHJ1Y3R1cmVkQ2xvbmUoc3JjX3N0YXRlUHJvdmlkZXIuZ2V0KCkpO1xuXG4gICAgICAgIC8vIHJlLWVuY29kZSBpdGVtcyBpbiBkc3QgdGltZWZyYW1lLCBpZiBuZWVkZWRcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gZHN0X29mZnNldCAtIHNyY19vZmZzZXQ7XG4gICAgICAgIGlmIChvZmZzZXQgIT0gMCkge1xuICAgICAgICAgICAgY29uc3QgZHN0X2l0ZW1zID0gc3JjX2l0ZW1zLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aW1lc2hpZnRfaXRlbShpdGVtLCBvZmZzZXQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBkc3QuYXBwZW5kKGRzdF9pdGVtcywgZHN0X29mZnNldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkc3QuYXBwZW5kKHNyY19pdGVtcywgc3JjX29mZnNldCk7XG4gICAgICAgIH0gICAgICAgIFxuICAgIH1cblxuICAgIC8vIHJlZ2lzdGVyIGNhbGxiYWNrc1xuICAgIHNyY19zdGF0ZVByb3ZpZGVyLmFkZF9jYWxsYmFjayhvbl9zcmNfY2hhbmdlKTtcbiAgICBjdHJsLmFkZF9jYWxsYmFjayhvbl9jdHJsX2NoYW5nZSk7XG4gICAgb25fY3RybF9jaGFuZ2UoKTtcblxuICAgIHJldHVybiBkc3Q7XG59XG5cblxuLyoqXG4gKiB0aW1lc2hpZnQgcGFyYW1ldGVycyBvZiB0aW1lIGJ5IG9mZnNldFxuICovXG5mdW5jdGlvbiB0aW1lc2hpZnRfaXRlbSAoaXRlbSwgb2Zmc2V0KSB7XG4gICAgaXRlbSA9IHsuLi5pdGVtfTtcbiAgICBpdGVtLml0dlswXSA9IChpdGVtLml0dlswXSAhPSBudWxsKSA/IGl0ZW0uaXR2WzBdICsgb2Zmc2V0IDogbnVsbDtcbiAgICBpdGVtLml0dlsxXSA9IChpdGVtLml0dlsxXSAhPSBudWxsKSA/IGl0ZW0uaXR2WzFdICsgb2Zmc2V0IDogbnVsbDtcbiAgICAvLyBUT0RPIC0gcGVyaGFwcyBjaGFuZ2UgaW1wbGVtZW50YXRpb24gb2YgbW90aW9uIGFuZCB0cmFuc2l0aW9uIHNlZ21lbnRcbiAgICAvLyB0byB1c2UgdGltZXN0YW1wcyByZWxhdGl2ZSB0byB0aGUgc3RhcnQgb2YgdGhlIHNlZ21lbnQsXG4gICAgLy8gc2ltaWxhciB0byBpbnRlcnBvbGF0aW9uP1xuICAgIGlmIChpdGVtLnR5cGUgPT0gXCJtb3Rpb25cIikge1xuICAgICAgICBpdGVtLmRhdGEudGltZXN0YW1wID0gaXRlbS5kYXRhLnRpbWVzdGFtcCArIG9mZnNldDtcbiAgICB9IGVsc2UgaWYgKGl0ZW0udHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICBpdGVtLmRhdGEudDAgPSBpdGVtLmRhdGEudDAgKyBvZmZzZXQ7XG4gICAgICAgIGl0ZW0uZGF0YS50MSA9IGl0ZW0uZGF0YS50MSArIG9mZnNldDtcbiAgICB9XG4gICAgcmV0dXJuIGl0ZW07XG59XG5cblxuXG4iLCJpbXBvcnQge2VuZHBvaW50fSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuLypcbiAgICBTdGF0ZSBQcm92aWRlciBWaWV3ZXJcbiovXG5cbmZ1bmN0aW9uIGl0ZW0yc3RyaW5nKGl0ZW0sIG9wdGlvbnMpIHtcbiAgICAvLyB0eHRcbiAgICBjb25zdCBpZF90eHQgPSBpdGVtLmlkO1xuICAgIGNvbnN0IHR5cGVfdHh0ID0gaXRlbS50eXBlO1xuICAgIGxldCBpdHZfdHh0ID0gXCJcIjtcbiAgICBpZiAoaXRlbS5pdHYgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IFtsb3csIGhpZ2gsIGxvd0luY2x1ZGUsIGhpZ2hJbmNsdWRlXSA9IGl0ZW0uaXR2O1xuICAgICAgICBjb25zdCBsb3dfdHh0ID0gKGxvdyA9PSBudWxsKSA/IFwibnVsbFwiIDogbG93LnRvRml4ZWQoMik7XG4gICAgICAgIGNvbnN0IGhpZ2hfdHh0ID0gKGhpZ2ggPT0gbnVsbCkgPyBcIm51bGxcIiA6IGhpZ2gudG9GaXhlZCgyKTtcbiAgICAgICAgaXR2X3R4dCA9IGBbJHtsb3dfdHh0fSwke2hpZ2hfdHh0fSwke2xvd0luY2x1ZGV9LCR7aGlnaEluY2x1ZGV9XWA7IFxuICAgIH1cbiAgICBsZXQgZGF0YV90eHQgPSBKU09OLnN0cmluZ2lmeShpdGVtLmRhdGEpO1xuXG4gICAgLy8gaHRtbFxuICAgIGxldCBpZF9odG1sID0gYDxzcGFuIGNsYXNzPVwiaXRlbS1pZFwiPiR7aWRfdHh0fTwvc3Bhbj5gO1xuICAgIGxldCBpdHZfaHRtbCA9IGA8c3BhbiBjbGFzcz1cIml0ZW0taXR2XCI+JHtpdHZfdHh0fTwvc3Bhbj5gO1xuICAgIGxldCB0eXBlX2h0bWwgPSBgPHNwYW4gY2xhc3M9XCJpdGVtLXR5cGVcIj4ke3R5cGVfdHh0fTwvc3Bhbj5gXG4gICAgbGV0IGRhdGFfaHRtbCA9IGA8c3BhbiBjbGFzcz1cIml0ZW0tZGF0YVwiPiR7ZGF0YV90eHR9PC9zcGFuPmA7XG4gICAgXG4gICAgLy8gZGVsZXRlIEJ1dHRvblxuICAgIGNvbnN0IHtkZWxldGVfYWxsb3dlZD1mYWxzZX0gPSBvcHRpb25zO1xuICAgIGlmIChkZWxldGVfYWxsb3dlZCkge1xuICAgICAgICByZXR1cm4gYFxuICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgPGJ1dHRvbiBpZD1cImRlbGV0ZVwiPlg8L2J1dHRvbj5cbiAgICAgICAgICAgICR7aWRfaHRtbH06ICR7dHlwZV9odG1sfSAke2l0dl9odG1sfSAke2RhdGFfaHRtbH1cbiAgICAgICAgPC9kaXY+YDtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYFxuICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgJHtpZF9odG1sfTogJHt0eXBlX2h0bWx9ICR7aXR2X2h0bWx9ICR7ZGF0YV9odG1sfVxuICAgICAgICA8L2Rpdj5gOyAgICAgICAgXG4gICAgfVxufVxuXG5cbmV4cG9ydCBjbGFzcyBTdGF0ZVByb3ZpZGVyVmlld2VyIHtcblxuICAgIGNvbnN0cnVjdG9yKHN0YXRlUHJvdmlkZXIsIGVsZW0sIG9wdGlvbnM9e30pIHtcbiAgICAgICAgdGhpcy5fc3AgPSBzdGF0ZVByb3ZpZGVyO1xuICAgICAgICB0aGlzLl9lbGVtID0gZWxlbTtcbiAgICAgICAgdGhpcy5faGFuZGxlID0gdGhpcy5fc3AuYWRkX2NhbGxiYWNrKHRoaXMuX29uY2hhbmdlLmJpbmQodGhpcykpOyBcblxuICAgICAgICAvLyBvcHRpb25zXG4gICAgICAgIGxldCBkZWZhdWx0cyA9IHtcbiAgICAgICAgICAgIHRvU3RyaW5nOml0ZW0yc3RyaW5nXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX29wdGlvbnMgPSB7Li4uZGVmYXVsdHMsIC4uLm9wdGlvbnN9O1xuXG4gICAgICAgIC8qXG4gICAgICAgICAgICBTdXBwb3J0IGRlbGV0ZVxuICAgICAgICAqL1xuICAgICAgICBpZiAodGhpcy5fb3B0aW9ucy5kZWxldGVfYWxsb3dlZCkge1xuICAgICAgICAgICAgLy8gbGlzdGVuIGZvciBjbGljayBldmVudHMgb24gcm9vdCBlbGVtZW50XG4gICAgICAgICAgICBlbGVtLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIGNhdGNoIGNsaWNrIGV2ZW50IGZyb20gZGVsZXRlIGJ1dHRvblxuICAgICAgICAgICAgICAgIGNvbnN0IGRlbGV0ZUJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoXCIjZGVsZXRlXCIpO1xuICAgICAgICAgICAgICAgIGlmIChkZWxldGVCdG4pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlzdEl0ZW0gPSBkZWxldGVCdG4uY2xvc2VzdChcIi5saXN0LWl0ZW1cIik7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaXN0SXRlbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc3AudXBkYXRlKHtyZW1vdmU6W2xpc3RJdGVtLmlkXX0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLypcbiAgICAgICAgICAgIHJlbmRlciBpbml0aWFsIHN0YXRlXG4gICAgICAgICovIFxuICAgICAgICB0aGlzLl9vbmNoYW5nZSgpO1xuICAgIH1cblxuICAgIF9vbmNoYW5nZSgpIHtcbiAgICAgICAgY29uc3QgaXRlbXMgPSB0aGlzLl9zcC5nZXQoKSB8fCBbXTtcblxuICAgICAgICAvLyBzb3J0IGJ5IGxvdyBlbmRwb2ludFxuICAgICAgICBpdGVtcy5zb3J0KChpdGVtX2EsIGl0ZW1fYikgPT4ge1xuICAgICAgICAgICAgbGV0IGxvd0VwX2EgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1fYS5pdHYpWzBdO1xuICAgICAgICAgICAgbGV0IGxvd0VwX2IgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1fYi5pdHYpWzBdO1xuICAgICAgICAgICAgcmV0dXJuIGVuZHBvaW50LmNtcChsb3dFcF9hLCBsb3dFcF9iKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gY2xlYXJcbiAgICAgICAgdGhpcy5fZWxlbS5yZXBsYWNlQ2hpbGRyZW4oKTtcbiAgICAgICAgLy8gcmVidWlsZFxuICAgICAgICBjb25zdCB7dG9TdHJpbmd9ID0gdGhpcy5fb3B0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaXRlbSBvZiBpdGVtcykge1xuICAgICAgICAgICAgLy8gYWRkXG4gICAgICAgICAgICBsZXQgbm9kZSA9IHRoaXMuX2VsZW0ucXVlcnlTZWxlY3RvcihgIyR7aXRlbS5pZH1gKTtcbiAgICAgICAgICAgIGlmIChub2RlID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICAgICAgICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShcImlkXCIsIGl0ZW0uaWQpO1xuICAgICAgICAgICAgICAgIG5vZGUuY2xhc3NMaXN0LmFkZChcImxpc3QtaXRlbVwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9lbGVtLmFwcGVuZENoaWxkKG5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbm9kZS5pbm5lckhUTUwgPSB0b1N0cmluZyhpdGVtLCB0aGlzLl9vcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyX3Byb3ZpZGVyKHN0YXRlUHJvdmlkZXIsIHNlbGVjdG9yLCBvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgZWxlbXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICByZXR1cm4gbmV3IFN0YXRlUHJvdmlkZXJWaWV3ZXIoc3RhdGVQcm92aWRlciwgZWxlbXMsIG9wdGlvbnMpO1xufVxuIiwiLy8gY2xhc3Nlc1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4vbmVhcmJ5X2Jhc2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4vbGF5ZXJfYmFzZS5qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4vY3Vyc29yX2Jhc2UuanNcIjtcblxuLy8gc3RhdGVQcm92aWRlcnNcbmltcG9ydCB7IGNsb2NrX3Byb3ZpZGVyIH0gZnJvbSBcIi4vcHJvdmlkZXJfY2xvY2suanNcIjtcbmltcG9ydCB7IENvbGxlY3Rpb25Qcm92aWRlciB9IGZyb20gXCIuL3Byb3ZpZGVyX2NvbGxlY3Rpb24uanNcIjtcbmltcG9ydCB7IE9iamVjdFByb3ZpZGVyIH0gZnJvbSBcIi4vcHJvdmlkZXJfb2JqZWN0LmpzXCI7XG5cbi8vIGZhY3RvcnkgZnVuY3Rpb25zXG5pbXBvcnQgeyBsZWFmX2xheWVyIH0gZnJvbSBcIi4vbGF5ZXJfbGVhZi5qc1wiO1xuaW1wb3J0IHsgY2xvY2tfY3Vyc29yIH0gZnJvbSBcIi4vY3Vyc29yX2Nsb2NrLmpzXCJcbmltcG9ydCB7IG9iamVjdF9jdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3Jfb2JqZWN0LmpzXCI7XG5pbXBvcnQgeyBwbGF5YmFja19jdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3JfcGxheWJhY2suanNcIjtcbmltcG9ydCB7IGxheWVyX2Zyb21fY3Vyc29yIH0gZnJvbSBcIi4vb3BzL2xheWVyX2Zyb21fY3Vyc29yLmpzXCI7XG5pbXBvcnQgeyBtZXJnZV9sYXllciB9IGZyb20gXCIuL29wcy9tZXJnZS5qc1wiO1xuaW1wb3J0IHsgYm9vbGVhbl9sYXllciB9IGZyb20gXCIuL29wcy9ib29sZWFuLmpzXCJcbmltcG9ydCB7IGxvZ2ljYWxfbWVyZ2VfbGF5ZXIsIGxvZ2ljYWxfZXhwcn0gZnJvbSBcIi4vb3BzL2xvZ2ljYWxfbWVyZ2UuanNcIjtcbmltcG9ydCB7IHRpbWVsaW5lX3RyYW5zZm9ybSB9IGZyb20gXCIuL29wcy90aW1lbGluZV90cmFuc2Zvcm0uanNcIjtcbmltcG9ydCB7IGN1cnNvcl90cmFuc2Zvcm0sIGxheWVyX3RyYW5zZm9ybSB9IGZyb20gXCIuL29wcy90cmFuc2Zvcm0uanNcIjtcbmltcG9ydCB7IGxheWVyX3JlY29yZGVyIH0gZnJvbSBcIi4vb3BzL3JlY29yZC5qc1wiO1xuXG5cbi8vIHV0aWxcbmltcG9ydCB7IGxvY2FsX2Nsb2NrLCByZW5kZXJfY3Vyc29yLCBjaGVja19pdGVtcyB9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5pbXBvcnQgeyByZW5kZXJfcHJvdmlkZXIgfSBmcm9tIFwiLi91dGlsL3Byb3ZpZGVyX3ZpZXdlci5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUiBGQUNUT1JJRVNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gbGF5ZXIob3B0aW9ucz17fSkge1xuICAgIGxldCB7c3JjLCBwcm92aWRlciwgaXRlbXM9W10sIHZhbHVlLCAuLi5vcHRzfSA9IG9wdGlvbnM7XG4gICAgaWYgKHNyYyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHNyYyBpbnN0YW5jZW9mIExheWVyKSB7XG4gICAgICAgICAgICByZXR1cm4gc3JjO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChwcm92aWRlciA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgaXRlbXMgPSBjaGVja19pdGVtcyhbe1xuICAgICAgICAgICAgICAgIGl0djogW251bGwsIG51bGwsIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgICAgIGRhdGE6IHZhbHVlXG4gICAgICAgICAgICB9XSlcbiAgICAgICAgICAgIHByb3ZpZGVyID0gbmV3IE9iamVjdFByb3ZpZGVyKHtpdGVtc30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaXRlbXMgPSBjaGVja19pdGVtcyhpdGVtcyk7XG4gICAgICAgICAgICBwcm92aWRlciA9IG5ldyBDb2xsZWN0aW9uUHJvdmlkZXIoe2l0ZW1zfSk7XG4gICAgICAgIH0gXG4gICAgfVxuICAgIHJldHVybiBsZWFmX2xheWVyKHtwcm92aWRlciwgLi4ub3B0c30pOyBcbn1cblxuZnVuY3Rpb24gcmVjb3JkIChvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgZHN0ID0gbGF5ZXIoe211dGFibGU6dHJ1ZX0pO1xuICAgIGxldCB7Y3RybCwgc3JjfSA9IG9wdGlvbnM7XG4gICAgaWYgKGN0cmwgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGN0cmwgPSBjbG9jaygpO1xuICAgIH1cbiAgICByZXR1cm4gbGF5ZXJfcmVjb3JkZXIoe2N0cmwsIHNyYywgZHN0fSk7XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBDVVJTT1IgRkFDVE9SSUVTXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmZ1bmN0aW9uIGNsb2NrKG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7Y2xvY2ssIHZlY3RvciwgLi4ub3B0c30gPSBvcHRpb25zO1xuICAgIGNvbnN0IHByb3ZpZGVyID0gY2xvY2tfcHJvdmlkZXIoe2Nsb2NrLCB2ZWN0b3J9KTtcbiAgICByZXR1cm4gY2xvY2tfY3Vyc29yKHtwcm92aWRlciwgLi4ub3B0c30pO1xufVxuXG5mdW5jdGlvbiBvYmplY3Qob3B0aW9ucz17fSkge1xuICAgIGxldCB7Y3RybCwgc3JjLCAuLi5zcmNfb3B0c30gPSBvcHRpb25zO1xuICAgIGlmIChjdHJsID09IHVuZGVmaW5lZCkge1xuICAgICAgICBjdHJsID0gY2xvY2soKTtcbiAgICB9XG4gICAgaWYgKHNyYyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3JjID0gbGF5ZXIoc3JjX29wdHMpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0X2N1cnNvcih7Y3RybCwgc3JjfSk7XG59XG5cbmZ1bmN0aW9uIHBsYXliYWNrKG9wdGlvbnM9e30pIHtcbiAgICBsZXQge2N0cmwsIHNyYywgLi4uc3JjX29wdHN9ID0gb3B0aW9ucztcbiAgICBpZiAoY3RybCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY3RybCA9IGNsb2NrKCk7XG4gICAgfVxuICAgIGlmIChzcmMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNyYyA9IGxheWVyKHNyY19vcHRzKTtcbiAgICB9XG4gICAgcmV0dXJuIHBsYXliYWNrX2N1cnNvcih7Y3RybCwgc3JjfSk7XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEVYUE9SVFNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IHtcbiAgICBDb2xsZWN0aW9uUHJvdmlkZXIsIE9iamVjdFByb3ZpZGVyLFxuICAgIGxvY2FsX2Nsb2NrLFxuICAgIExheWVyLCBDdXJzb3IsIE5lYXJieUluZGV4QmFzZSxcbiAgICBsYXllciwgXG4gICAgY2xvY2ssXG4gICAgb2JqZWN0LFxuICAgIHBsYXliYWNrLFxuICAgIHJlY29yZCxcbiAgICBtZXJnZV9sYXllciBhcyBtZXJnZSwgXG4gICAgYm9vbGVhbl9sYXllciBhcyBib29sZWFuLFxuICAgIGxvZ2ljYWxfbWVyZ2VfbGF5ZXIgYXMgbG9naWNhbF9tZXJnZSwgXG4gICAgbG9naWNhbF9leHByLFxuICAgIGxheWVyX2Zyb21fY3Vyc29yLFxuICAgIGxheWVyX3RyYW5zZm9ybSxcbiAgICBjdXJzb3JfdHJhbnNmb3JtLFxuICAgIHRpbWVsaW5lX3RyYW5zZm9ybSxcbiAgICByZW5kZXJfcHJvdmlkZXIsXG4gICAgcmVuZGVyX2N1cnNvclxufSJdLCJuYW1lcyI6WyJjbXBfYXNjZW5kaW5nIiwiY21wX2Rlc2NlbmRpbmciLCJQUkVGSVgiLCJhZGRTdGF0ZSIsImFkZE1ldGhvZHMiLCJjYWxsYmFjay5hZGRTdGF0ZSIsImV2ZW50aWZ5LmFkZFN0YXRlIiwiY2FsbGJhY2suYWRkTWV0aG9kcyIsImV2ZW50aWZ5LmFkZE1ldGhvZHMiLCJjYWxsYmFjay5pc19jYWxsYmFja19hcGkiLCJzcmNwcm9wLmFkZFN0YXRlIiwic3JjcHJvcC5hZGRNZXRob2RzIl0sIm1hcHBpbmdzIjoiOzs7SUFBQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxTQUFTLFFBQVEsQ0FBQyxDQUFDLEVBQUU7SUFDckIsSUFBSSxPQUFPLE9BQU8sQ0FBQyxJQUFJLFFBQVE7SUFDL0I7O0lBRUEsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUM5QixJQUFJLFNBQVMsRUFBRSxHQUFHO0lBQ2xCLElBQUksV0FBVyxFQUFFLEdBQUc7SUFDcEIsSUFBSSxLQUFLLEVBQUUsRUFBRTtJQUNiLElBQUksVUFBVSxFQUFFLEdBQUc7SUFDbkIsSUFBSSxRQUFRLEVBQUU7SUFDZCxDQUFDLENBQUM7O0lBRUYsU0FBUyxVQUFVLENBQUMsS0FBSyxFQUFFO0lBQzNCLElBQUksT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7SUFDakQ7O0lBRUEsTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDM0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQzVC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
