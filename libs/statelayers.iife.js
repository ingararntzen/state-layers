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

        const cursor = new Cursor();

        // implement query
        cursor.query = function query() {
            const {position, velocity, acceleration, timestamp} = src.query();
            const dynamic = (velocity != 0 || acceleration != 0);
            return {value:position, dynamic, offset:timestamp};
        };

        // numeric
        Object.defineProperty(cursor, "numeric", {get: () => true});
        // fixedRate
        Object.defineProperty(cursor, "fixedRate", {get: () => false});

        // callbacks from timing object
        src.on("change", () => {cursor.onchange();});
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

    exports.CollectionProvider = CollectionProvider;
    exports.Cursor = Cursor;
    exports.Layer = Layer;
    exports.NearbyIndexBase = NearbyIndexBase;
    exports.ObjectProvider = ObjectProvider;
    exports.boolean = boolean_layer;
    exports.clock = clock;
    exports.cursor_from_timingobject = cursor_from_timingobject;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGVsYXllcnMuaWlmZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWwvaW50ZXJ2YWxzLmpzIiwiLi4vLi4vc3JjL25lYXJieV9iYXNlLmpzIiwiLi4vLi4vc3JjL3V0aWwvYXBpX2V2ZW50aWZ5LmpzIiwiLi4vLi4vc3JjL3V0aWwvYXBpX2NhbGxiYWNrLmpzIiwiLi4vLi4vc3JjL3V0aWwvY29tbW9uLmpzIiwiLi4vLi4vc3JjL2xheWVyX2Jhc2UuanMiLCIuLi8uLi9zcmMvdXRpbC9jdXJzb3JfbW9uaXRvci5qcyIsIi4uLy4uL3NyYy9jdXJzb3JfYmFzZS5qcyIsIi4uLy4uL3NyYy9wcm92aWRlcl9jbG9jay5qcyIsIi4uLy4uL3NyYy9wcm92aWRlcl9jb2xsZWN0aW9uLmpzIiwiLi4vLi4vc3JjL3Byb3ZpZGVyX29iamVjdC5qcyIsIi4uLy4uL3NyYy91dGlsL2FwaV9zcmNwcm9wLmpzIiwiLi4vLi4vc3JjL3V0aWwvc29ydGVkYXJyYXkuanMiLCIuLi8uLi9zcmMvbmVhcmJ5X2luZGV4LmpzIiwiLi4vLi4vc3JjL3V0aWwvc2VnbWVudHMuanMiLCIuLi8uLi9zcmMvbGF5ZXJfbGVhZi5qcyIsIi4uLy4uL3NyYy9jdXJzb3JfY2xvY2suanMiLCIuLi8uLi9zcmMvY3Vyc29yX3BsYXliYWNrLmpzIiwiLi4vLi4vc3JjL2N1cnNvcl9vYmplY3QuanMiLCIuLi8uLi9zcmMvb3BzL2xheWVyX2Zyb21fY3Vyc29yLmpzIiwiLi4vLi4vc3JjL29wcy9tZXJnZS5qcyIsIi4uLy4uL3NyYy9vcHMvYm9vbGVhbi5qcyIsIi4uLy4uL3NyYy9vcHMvbG9naWNhbF9tZXJnZS5qcyIsIi4uLy4uL3NyYy9vcHMvdGltZWxpbmVfdHJhbnNmb3JtLmpzIiwiLi4vLi4vc3JjL29wcy90cmFuc2Zvcm0uanMiLCIuLi8uLi9zcmMvb3BzL3JlY29yZC5qcyIsIi4uLy4uL3NyYy9vcHMvY3Vyc29yX2Zyb21fdGltaW5nb2JqZWN0LmpzIiwiLi4vLi4vc3JjL3V0aWwvcHJvdmlkZXJfdmlld2VyLmpzIiwiLi4vLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG4gICAgXG4gICAgSU5URVJWQUwgRU5EUE9JTlRTXG5cbiAgICAqIGludGVydmFsIGVuZHBvaW50cyBhcmUgZGVmaW5lZCBieSB0cmlwbGV0IFt2YWx1ZSwgdHlwZV1cbiAgICAqXG4gICAgKiAgIHRoZXJlIGFyZSA0IHR5cGVzIG9mIGludGVydmFsIGVuZHBvaW50cyBcbiAgICAqICAgLSB2KSAtIGhpZ2ggZW5kcG9pbnQgYXQgdiwgbm90IGluY2x1c2l2ZVxuICAgICogICAtIHZdIC0gaGlnaCBlbmRwb2ludCBhdCB2LCBpbmNsdXNpdmVcbiAgICAqICAgLSBbdiAtIGxvdyBlbmRwb2ludCBhdCB2LCBub3QgaW5jbHVzaXZlXG4gICAgKiAgIC0gKHYgLSBsb3cgZW5kcG9pbnQgYXQgdiwgaW5jbHVzaXZlXG4gICAgKiBcbiAgICAqICAgQSBzaW5ndWxhciBpbnRlcnZhbCBbMiwyLHRydWUsdHJ1ZV0gd2lsbCBoYXZlIGVuZHBvaW50cyBbMiBhbmQgMl1cbiAgICAqIFxuICAgICogICBBZGRpdGlvbmFsbHksIHRvIHNpbXBsaWZ5IGNvbXBhcmlzb24gYmV0d2VlbiBlbmRwb2ludHMgYW5kIG51bWJlcnNcbiAgICAqICAgd2kgaW50cm9kdWNlIGEgc3BlY2lhbCBlbmRwb2ludCB0eXBlIC0gVkFMVUVcbiAgICAqIFxuICAgICogICBUaHVzIHdlIGRlZmluZSA1IHR5cGVzIG9mIGVuZHBvaW50c1xuICAgICogXG4gICAgKiAgIEhJR0hfT1BFTiA6IHYpXG4gICAgKiAgIEhJR0hfQ0xPU0VEOiB2XVxuICAgICogICBWQUxVRTogdlxuICAgICogICBMT1dfQ0xPU0VEOiBbdlxuICAgICogICBMT1dfT1BFTjogKHYpXG4gICAgKiBcbiAgICAqICAgRm9yIHRoZSBwdXJwb3NlIG9mIGVuZHBvaW50IGNvbXBhcmlzb24gd2UgbWFpbnRhaW5cbiAgICAqICAgYSBsb2dpY2FsIG9yZGVyaW5nIGZvciBlbmRwb2ludHMgd2l0aCB0aGUgc2FtZSB2YWx1ZS5cbiAgICAqICAgXG4gICAgKiAgIHYpIDwgW3YgPT0gdiA9PSB2XSA8ICh2XG4gICAgKiAgXG4gICAgKiAgIFdlIGFzc2lnbiBvcmRlcmluZyB2YWx1ZXNcbiAgICAqICAgXG4gICAgKiAgIEhJR0hfT1BFTjogLTFcbiAgICAqICAgSElHSF9DTE9TRUQsIFZBTFVFLCBMT1dfQ0xPU0VEOiAwXG4gICAgKiAgIExPV19PUEVOOiAxXG4gICAgKiBcbiAgICAqICAgdmFsdWUgY2FuIGJlIG51bGwgb3IgbnVtYmVyLiBJZiB2YWx1ZSBpcyBudWxsLCB0aGlzIG1lYW5zIHVuYm91bmRlZCBlbmRwb2ludFxuICAgICogICBpLmUuIG5vIG90aGVyIGVuZHBvaW50IGNhbiBiZSBsYXJnZXIgb3Igc21hbGxlci5cbiAgICAqICAgYW4gdW5ib3VuZGVkIGxvdyBlbmRwb2ludCBtZWFucyAtSW5maW5pdHlcbiAgICAqICAgYW4gdW5ib3VuZGVkIGhpZ2ggZW5kcG9pbnQgbWVhbnMgSW5maW5pdHlcbiAgICAqXG4qL1xuXG5mdW5jdGlvbiBpc051bWJlcihuKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBuID09IFwibnVtYmVyXCI7XG59XG5cbmNvbnN0IEVQX1RZUEUgPSBPYmplY3QuZnJlZXplKHtcbiAgICBISUdIX09QRU46IFwiKVwiLFxuICAgIEhJR0hfQ0xPU0VEOiBcIl1cIixcbiAgICBWQUxVRTogXCJcIixcbiAgICBMT1dfQ0xPU0VEOiBcIltcIixcbiAgICBMT1dfT1BFTjogXCIoXCJcbn0pO1xuXG5mdW5jdGlvbiBpc19FUF9UWVBFKHZhbHVlKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoRVBfVFlQRSkuaW5jbHVkZXModmFsdWUpO1xufVxuXG5jb25zdCBFUF9PUkRFUiA9IG5ldyBNYXAoW1xuICAgIFtFUF9UWVBFLkhJR0hfT1BFTiwgLTFdLFxuICAgIFtFUF9UWVBFLkhJR0hfQ0xPU0VELCAwXSxcbiAgICBbRVBfVFlQRS5WQUxVRSwgMF0sXG4gICAgW0VQX1RZUEUuTE9XX0NMT1NFRCwgMF0sXG4gICAgW0VQX1RZUEUuTE9XX09QRU4sIDFdXG5dKTtcblxuZnVuY3Rpb24gZW5kcG9pbnRfaXNfbG93KGVwKSB7XG4gICAgcmV0dXJuIGVwWzFdID09IEVQX1RZUEUuTE9XX0NMT1NFRCB8fCBlcFsxXSA9PSBFUF9UWVBFLkxPV19PUEVOO1xufVxuXG5mdW5jdGlvbiBlbmRwb2ludF9pc19oaWdoKGVwKSB7XG4gICAgcmV0dXJuIGVwWzFdID09IEVQX1RZUEUuSElHSF9DTE9TRUQgfHwgZXBbMV0gPT0gRVBfVFlQRS5ISUdIX09QRU47XG59XG5cbi8qXG4gICAgcmV0dXJuIGVuZHBvaW50IGZyb20gaW5wdXRcbiovXG5mdW5jdGlvbiBlbmRwb2ludF9mcm9tX2lucHV0KGVwKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGVwKSkge1xuICAgICAgICBlcCA9IFtlcCwgRVBfVFlQRS5WQUxVRV07XG4gICAgfVxuICAgIGlmIChlcC5sZW5ndGggIT0gMikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFbmRwb2ludCBtdXN0IGJlIGEgbGVuZ3RoLTIgYXJyYXlcIiwgZXApO1xuICAgIH1cbiAgICBsZXQgW3YsdF0gPSBlcDtcbiAgICBpZiAoIWlzX0VQX1RZUEUodCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5zdXBwb3J0ZWQgZW5kcG9pbnQgdHlwZVwiLCB0KTtcbiAgICB9XG4gICAgaWYgKHYgPT0gLUluZmluaXR5KSB7XG4gICAgICAgIHJldHVybiBbbnVsbCwgRVBfVFlQRS5MT1dfQ0xPU0VEXTtcbiAgICB9XG4gICAgaWYgKHYgPT0gSW5maW5pdHkpIHtcbiAgICAgICAgcmV0dXJuIFtudWxsLCBFUF9UWVBFLkhJR0hfQ0xPU0VEXTtcbiAgICB9XG4gICAgaWYgKHYgPT0gdW5kZWZpbmVkIHx8IHYgPT0gbnVsbCB8fCBpc051bWJlcih2KSkge1xuICAgICAgICByZXR1cm4gW3YsIHRdO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJlbmRwb2ludCBtdXN0IGJlIG51bGwgb3IgbnVtYmVyXCIsIHYpO1xufVxuXG5jb25zdCBlbmRwb2ludF9QT1NfSU5GID0gZW5kcG9pbnRfZnJvbV9pbnB1dChJbmZpbml0eSk7XG5jb25zdCBlbmRwb2ludF9ORUdfSU5GID0gZW5kcG9pbnRfZnJvbV9pbnB1dCgtSW5maW5pdHkpO1xuXG4vKipcbiAqIEludGVybmFsIHJlcHJlc2VudGF0aW9uIFxuICogcmVwbGFjaW5nIG51bGwgdmFsdXNlIHdpdGggLUluZmluaXR5IG9yIEluZmluaXR5XG4gKiBpbiBvcmRlciB0byBzaW1wbGlmeSBudW1lcmljYWwgY29tcGFyaXNvblxuICovXG5mdW5jdGlvbiBlbmRwb2ludF9pbnRlcm5hbChlcCkge1xuICAgIGlmIChlcFswXSAhPSBudWxsKSB7XG4gICAgICAgIHJldHVybiBbZXBbMF0sIGVwWzFdXTtcbiAgICB9XG4gICAgaWYgKGVuZHBvaW50X2lzX2xvdyhlcCkpIHtcbiAgICAgICAgcmV0dXJuIFstSW5maW5pdHksIEVQX1RZUEUuTE9XX0NMT1NFRF07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFtJbmZpbml0eSwgRVBfVFlQRS5ISUdIX0NMT1NFRF07XG4gICAgfVxufVxuXG4vKipcbiAqIENvbXBhcmlzb24gZnVuY3Rpb24gZm9yIG51bWJlcnNcbiAqIGF2b2lkIHN1YnRyYWN0aW9uIHRvIHN1cHBvcnQgSW5maW5pdHkgdmFsdWVzXG4gKi9cbmZ1bmN0aW9uIG51bWJlcl9jbXAoYSwgYikge1xuICAgIGlmIChhIDwgYikgcmV0dXJuIC0xOyAvLyBjb3JyZWN0IG9yZGVyXG4gICAgaWYgKGEgPiBiKSByZXR1cm4gMTsgLy8gd3Jvbmcgb3JkZXJcbiAgICByZXR1cm4gMDsgLy8gZXF1YWxpdHlcbn1cblxuLypcbiAgICBFbmRwb2ludCBjb21wYXJpc29uXG4gICAgcmV0dXJucyBcbiAgICAgICAgLSBuZWdhdGl2ZSA6IGNvcnJlY3Qgb3JkZXJcbiAgICAgICAgLSAwIDogZXF1YWxcbiAgICAgICAgLSBwb3NpdGl2ZSA6IHdyb25nIG9yZGVyXG4qLyBcbmZ1bmN0aW9uIGVuZHBvaW50X2NtcChlcDEsIGVwMikgeyAgICBcbiAgICBjb25zdCBbdjEsIHQxXSA9IGVuZHBvaW50X2ludGVybmFsKGVwMSk7XG4gICAgY29uc3QgW3YyLCB0Ml0gPSBlbmRwb2ludF9pbnRlcm5hbChlcDIpO1xuICAgIGNvbnN0IGRpZmYgPSBudW1iZXJfY21wKHYxLCB2Mik7XG4gICAgaWYgKGRpZmYgPT0gMCkge1xuICAgICAgICBjb25zdCBvMSA9IEVQX09SREVSLmdldCh0MSk7XG4gICAgICAgIGNvbnN0IG8yID0gRVBfT1JERVIuZ2V0KHQyKTtcbiAgICAgICAgcmV0dXJuIG51bWJlcl9jbXAobzEsIG8yKTtcbiAgICB9XG4gICAgcmV0dXJuIGRpZmY7XG59XG5cbmZ1bmN0aW9uIGVuZHBvaW50X2x0IChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPCAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9sZSAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpIDw9IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2d0IChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPiAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9nZSAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpID49IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2VxIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPT0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfbWluKHAxLCBwMikge1xuICAgIHJldHVybiAoZW5kcG9pbnRfbGUocDEsIHAyKSkgPyBwMSA6IHAyO1xufVxuZnVuY3Rpb24gZW5kcG9pbnRfbWF4KHAxLCBwMikge1xuICAgIHJldHVybiAoZW5kcG9pbnRfZ2UocDEsIHAyKSkgPyBwMSA6IHAyO1xufVxuXG4vKipcbiAqIGZsaXAgZW5kcG9pbnQ6XG4gKiAtIGllLiBnZXQgYWRqYWNlbnQgZW5kcG9uaXQgb24gdGhlIHRpbWVsaW5lXG4gKiBcbiAqIHYpIDwtPiBbdlxuICogdl0gPC0+ICh2XG4gKiBcbiAqIGZsaXBwaW5nIGhhcyBubyBlZmZlY3Qgb24gZW5kcG9pbnRzIHdpdGggdW5ib3VuZGVkIHZhbHVlXG4gKi9cblxuZnVuY3Rpb24gZW5kcG9pbnRfZmxpcChlcCwgdGFyZ2V0KSB7XG4gICAgaWYgKHRhcmdldCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0YXJnZXQgaXMgZGVwcmVjYXRlZFwiKTtcbiAgICB9XG4gICAgbGV0IFt2LHRdID0gZXA7XG4gICAgaWYgKHYgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gZXA7XG4gICAgfVxuICAgIGlmICh0ID09IEVQX1RZUEUuSElHSF9PUEVOKSB7XG4gICAgICAgIHJldHVybiBbdiwgRVBfVFlQRS5MT1dfQ0xPU0VEXTtcbiAgICB9IGVsc2UgaWYgKHQgPT0gRVBfVFlQRS5ISUdIX0NMT1NFRCkge1xuICAgICAgICByZXR1cm4gW3YsIEVQX1RZUEUuTE9XX09QRU5dO1xuICAgIH0gZWxzZSBpZiAodCA9PSBFUF9UWVBFLkxPV19PUEVOKSB7XG4gICAgICAgIHJldHVybiBbdiwgRVBfVFlQRS5ISUdIX0NMT1NFRF07XG4gICAgfSBlbHNlIGlmICh0ID09IEVQX1RZUEUuTE9XX0NMT1NFRCkge1xuICAgICAgICByZXR1cm4gW3YsIEVQX1RZUEUuSElHSF9PUEVOXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBlbmRwb2ludCB0eXBlXCIsIHQpO1xuICAgIH1cbiAgICByZXR1cm4gcDtcbn1cblxuLypcbiAgICByZXR1cm5zIGxvdyBhbmQgaGlnaCBlbmRwb2ludHMgZnJvbSBpbnRlcnZhbFxuKi9cbmZ1bmN0aW9uIGVuZHBvaW50c19mcm9tX2ludGVydmFsKGl0dikge1xuICAgIGNvbnN0IFtsb3csIGhpZ2gsIGxvd0Nsb3NlZCwgaGlnaENsb3NlZF0gPSBpdHY7XG4gICAgY29uc3QgbG93VHlwZSA9IChsb3dDbG9zZWQpID8gIEVQX1RZUEUuTE9XX0NMT1NFRCA6IEVQX1RZUEUuTE9XX09QRU47XG4gICAgY29uc3QgaGlnaFR5cGUgPSAoaGlnaENsb3NlZCkgPyAgRVBfVFlQRS5ISUdIX0NMT1NFRCA6IEVQX1RZUEUuSElHSF9PUEVOO1xuICAgIGNvbnN0IGxvd0VwID0gZW5kcG9pbnRfZnJvbV9pbnB1dChbbG93LCBsb3dUeXBlXSk7XG4gICAgY29uc3QgaGlnaEVwID0gZW5kcG9pbnRfZnJvbV9pbnB1dChbaGlnaCwgaGlnaFR5cGVdKTtcbiAgICByZXR1cm4gW2xvd0VwLCBoaWdoRXBdO1xufVxuXG5cbi8qXG4gICAgSU5URVJWQUxTXG5cbiAgICBJbnRlcnZhbHMgYXJlIFtsb3csIGhpZ2gsIGxvd0Nsb3NlZCwgaGlnaENsb3NlZF1cblxuKi8gXG5cblxuLypcbiAgICByZXR1cm4gdHJ1ZSBpZiBwb2ludCBvciBlbmRwb2ludCBpcyBjb3ZlcmVkIGJ5IGludGVydmFsXG4gICAgcG9pbnQgcCBjYW4gYmUgbnVtYmVyIHZhbHVlIG9yIGFuIGVuZHBvaW50XG4qL1xuZnVuY3Rpb24gaW50ZXJ2YWxfY292ZXJzX2VuZHBvaW50KGl0diwgZXApIHtcbiAgICBjb25zdCBbbG93X2VwLCBoaWdoX2VwXSA9IGVuZHBvaW50c19mcm9tX2ludGVydmFsKGl0dik7XG4gICAgZXAgPSBlbmRwb2ludF9mcm9tX2lucHV0KGVwKTtcbiAgICAvLyBjb3ZlcnM6IGxvdyA8PSBwIDw9IGhpZ2hcbiAgICByZXR1cm4gZW5kcG9pbnRfbGUobG93X2VwLCBlcCkgJiYgZW5kcG9pbnRfbGUoZXAsIGhpZ2hfZXApO1xufVxuLy8gY29udmVuaWVuY2VcbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19wb2ludChpdHYsIHApIHtcbiAgICByZXR1cm4gaW50ZXJ2YWxfY292ZXJzX2VuZHBvaW50KGl0diwgcCk7XG59XG5cbi8qXG4gICAgUmV0dXJuIHRydWUgaWYgaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBlcXVhbFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2lzX3Npbmd1bGFyKGludGVydmFsKSB7XG4gICAgY29uc3QgW2xvd19lcCwgaGlnaF9lcF0gPSBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpO1xuICAgIHJldHVybiBlbmRwb2ludF9lcShsb3dfZXAsIGhpZ2hfZXApO1xufVxuXG4vKlxuICAgIENyZWF0ZSBpbnRlcnZhbCBmcm9tIGVuZHBvaW50c1xuKi9cbmZ1bmN0aW9uIGludGVydmFsX2Zyb21fZW5kcG9pbnRzKGVwMSwgZXAyKSB7XG4gICAgbGV0IFt2MSwgdDFdID0gZXAxO1xuICAgIGxldCBbdjIsIHQyXSA9IGVwMjtcbiAgICBpZiAoIWVuZHBvaW50X2lzX2xvdyhlcDEpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgbG93IGVuZHBvaW50XCIsIGVwMSk7XG4gICAgfVxuICAgIGlmICghZW5kcG9pbnRfaXNfaGlnaChlcDIpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgaGlnaCBlbmRwb2ludFwiLCBlcDIpO1xuICAgIH1cbiAgICByZXR1cm4gW3YxLCB2MiwgdDEgPT0gRVBfVFlQRS5MT1dfQ0xPU0VELCB0MiA9PSBFUF9UWVBFLkhJR0hfQ0xPU0VEXTtcbn1cblxuXG5mdW5jdGlvbiBpbnRlcnZhbF9mcm9tX2lucHV0KGlucHV0KXtcbiAgICBsZXQgaXR2ID0gaW5wdXQ7XG4gICAgaWYgKGl0diA9PSB1bmRlZmluZWQgfHwgaXR2ID09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaW5wdXQgaXMgdW5kZWZpbmVkXCIpO1xuICAgIH1cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXR2KSkge1xuICAgICAgICBpZiAoaXNOdW1iZXIoaXR2KSkge1xuICAgICAgICAgICAgLy8gaW5wdXQgaXMgc2luZ3VsYXIgbnVtYmVyXG4gICAgICAgICAgICBpdHYgPSBbaXR2LCBpdHYsIHRydWUsIHRydWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbnB1dDogJHtpbnB1dH06IG11c3QgYmUgQXJyYXkgb3IgTnVtYmVyYClcbiAgICAgICAgfVxuICAgIH07XG4gICAgLy8gbWFrZSBzdXJlIGludGVydmFsIGlzIGxlbmd0aCA0XG4gICAgaWYgKGl0di5sZW5ndGggPT0gMSkge1xuICAgICAgICBpdHYgPSBbaXR2WzBdLCBpdHZbMF0sIHRydWUsIHRydWVdO1xuICAgIH0gZWxzZSBpZiAoaXR2Lmxlbmd0aCA9PSAyKSB7XG4gICAgICAgIGl0diA9IFtpdHZbMF0sIGl0dlsxXSwgdHJ1ZSwgZmFsc2VdO1xuICAgIH0gZWxzZSBpZiAoaXR2Lmxlbmd0aCA9PSAzKSB7XG4gICAgICAgIGl0diA9IFtpdHZbMF0sIGl0dlsxXSwgaXR2WzJdLCBmYWxzZV07XG4gICAgfSBlbHNlIGlmIChpdHYubGVuZ3RoID4gNCkge1xuICAgICAgICBpdHYgPSBbaXR2WzBdLCBpdHZbMV0sIGl0dlsyXSwgaXR2WzRdXTtcbiAgICB9XG4gICAgbGV0IFtsb3csIGhpZ2gsIGxvd0luY2x1ZGUsIGhpZ2hJbmNsdWRlXSA9IGl0djtcbiAgICAvLyBib3VuZGFyeSBjb25kaXRpb25zIGFyZSBudW1iZXIgb3IgbnVsbFxuICAgIGlmIChsb3cgPT0gdW5kZWZpbmVkIHx8IGxvdyA9PSAtSW5maW5pdHkpIHtcbiAgICAgICAgbG93ID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKGhpZ2ggPT0gdW5kZWZpbmVkIHx8IGhpZ2ggPT0gSW5maW5pdHkpIHtcbiAgICAgICAgaGlnaCA9IG51bGw7XG4gICAgfVxuICAgIC8vIGNoZWNrIGxvd1xuICAgIGlmIChsb3cgPT0gbnVsbCkge1xuICAgICAgICBsb3dJbmNsdWRlID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoIWlzTnVtYmVyKGxvdykpIHRocm93IG5ldyBFcnJvcihcImxvdyBub3QgYSBudW1iZXJcIiwgbG93KTtcbiAgICB9XG4gICAgLy8gY2hlY2sgaGlnaFxuICAgIGlmIChoaWdoID09IG51bGwpIHtcbiAgICAgICAgaGlnaEluY2x1ZGUgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICghaXNOdW1iZXIoaGlnaCkpIHRocm93IG5ldyBFcnJvcihcImhpZ2ggbm90IGEgbnVtYmVyXCIsIGhpZ2gpO1xuICAgIH0gICAgXG4gICAgLy8gY2hlY2sgdGhhdCBsb3cgPD0gaGlnaFxuICAgIGlmIChsb3cgIT0gbnVsbCAmJiBoaWdoICE9IG51bGwpIHtcbiAgICAgICAgaWYgKGxvdyA+IGhpZ2gpIHRocm93IG5ldyBFcnJvcihcImxvdyA+IGhpZ2hcIiwgbG93LCBoaWdoKTtcbiAgICAgICAgLy8gc2luZ2xldG9uXG4gICAgICAgIGlmIChsb3cgPT0gaGlnaCkge1xuICAgICAgICAgICAgbG93SW5jbHVkZSA9IHRydWU7XG4gICAgICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gY2hlY2sgdGhhdCBsb3dJbmNsdWRlLCBoaWdoSW5jbHVkZSBhcmUgYm9vbGVhbnNcbiAgICBpZiAodHlwZW9mIGxvd0luY2x1ZGUgIT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImxvd0luY2x1ZGUgbm90IGJvb2xlYW5cIik7XG4gICAgfSBcbiAgICBpZiAodHlwZW9mIGhpZ2hJbmNsdWRlICE9PSBcImJvb2xlYW5cIikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJoaWdoSW5jbHVkZSBub3QgYm9vbGVhblwiKTtcbiAgICB9XG4gICAgcmV0dXJuIFtsb3csIGhpZ2gsIGxvd0luY2x1ZGUsIGhpZ2hJbmNsdWRlXTtcbn1cblxuZXhwb3J0IGNvbnN0IGVuZHBvaW50ID0ge1xuICAgIGxlOiBlbmRwb2ludF9sZSxcbiAgICBsdDogZW5kcG9pbnRfbHQsXG4gICAgZ2U6IGVuZHBvaW50X2dlLFxuICAgIGd0OiBlbmRwb2ludF9ndCxcbiAgICBjbXA6IGVuZHBvaW50X2NtcCxcbiAgICBlcTogZW5kcG9pbnRfZXEsXG4gICAgbWluOiBlbmRwb2ludF9taW4sXG4gICAgbWF4OiBlbmRwb2ludF9tYXgsXG4gICAgZmxpcDogZW5kcG9pbnRfZmxpcCxcbiAgICBmcm9tX2ludGVydmFsOiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbCxcbiAgICBmcm9tX2lucHV0OiBlbmRwb2ludF9mcm9tX2lucHV0LFxuICAgIHR5cGVzOiB7Li4uRVBfVFlQRX0sXG4gICAgUE9TX0lORiA6IGVuZHBvaW50X1BPU19JTkYsXG4gICAgTkVHX0lORiA6IGVuZHBvaW50X05FR19JTkZcbn1cbmV4cG9ydCBjb25zdCBpbnRlcnZhbCA9IHtcbiAgICBjb3ZlcnNfZW5kcG9pbnQ6IGludGVydmFsX2NvdmVyc19lbmRwb2ludCxcbiAgICBjb3ZlcnNfcG9pbnQ6IGludGVydmFsX2NvdmVyc19wb2ludCwgXG4gICAgaXNfc2luZ3VsYXI6IGludGVydmFsX2lzX3Npbmd1bGFyLFxuICAgIGZyb21fZW5kcG9pbnRzOiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyxcbiAgICBmcm9tX2lucHV0OiBpbnRlcnZhbF9mcm9tX2lucHV0XG59XG4iLCJpbXBvcnQgeyBlbmRwb2ludCwgaW50ZXJ2YWwgfSBmcm9tIFwiLi91dGlsL2ludGVydmFscy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTkVBUkJZIElOREVYXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogQWJzdHJhY3Qgc3VwZXJjbGFzcyBmb3IgTmVhcmJ5SW5kZXhlLlxuICogXG4gKiBTdXBlcmNsYXNzIHVzZWQgdG8gY2hlY2sgdGhhdCBhIGNsYXNzIGltcGxlbWVudHMgdGhlIG5lYXJieSgpIG1ldGhvZCwgXG4gKiBhbmQgcHJvdmlkZSBzb21lIGNvbnZlbmllbmNlIG1ldGhvZHMuXG4gKiBcbiAqIE5FQVJCWSBJTkRFWFxuICogXG4gKiBOZWFyYnlJbmRleCBwcm92aWRlcyBpbmRleGluZyBzdXBwb3J0IG9mIGVmZmVjdGl2ZWx5XG4gKiBsb29raW5nIHVwIHJlZ2lvbnMgYnkgb2Zmc2V0LCBcbiAqIGdpdmVuIHRoYXRcbiAqIChpKSBlYWNoIHJlZ2lvbiBpcyBhc3NvY2lhdGVkIHdpdGggYW4gaW50ZXJ2YWwgYW5kLFxuICogKGlpKSByZWdpb25zIGFyZSBub24tb3ZlcmxhcHBpbmcuXG4gKiBcbiAqIE5FQVJCWVxuICogVGhlIG5lYXJieSBtZXRob2QgcmV0dXJucyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbmVpZ2hib3Job29kIFxuICogYXJvdW5kIGVuZHBvaW50LiBcbiAqIFxuICogUmV0dXJucyB7XG4gKiAgICAgIGNlbnRlcjogbGlzdCBvZiBvYmplY3RzIGNvdmVyZWQgYnkgcmVnaW9uLFxuICogICAgICBpdHY6IHJlZ2lvbiBpbnRlcnZhbCAtIHZhbGlkaXR5IG9mIGNlbnRlciBcbiAqICAgICAgbGVmdDpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSBsZWZ0IFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgaGlnaC1lbmRwb2ludCBvciBlbmRwb2ludC5ORUdfSU5GXG4gKiAgICAgIHJpZ2h0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0XG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBsb3ctZW5kcG9pbnQgb3IgZW5kdHBvaW50LlBPU19JTkZcbiAqIFxuICogXG4gKiBUaGUgbmVhcmJ5IHN0YXRlIGlzIHdlbGwtZGVmaW5lZCBmb3IgZXZlcnkgZW5kcG9pbnRcbiAqIG9uIHRoZSB0aW1lbGluZS5cbiAqIFxuICogSU5URVJWQUxTXG4gKiBcbiAqIFtsb3csIGhpZ2gsIGxvd0luY2x1c2l2ZSwgaGlnaEluY2x1c2l2ZV1cbiAqIFxuICogVGhpcyByZXByZXNlbnRhdGlvbiBlbnN1cmVzIHRoYXQgdGhlIGludGVydmFsIGVuZHBvaW50cyBcbiAqIGFyZSBvcmRlcmVkIGFuZCBhbGxvd3MgaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIFxuICogeWV0IGNvdmVyIHRoZSBlbnRpcmUgcmVhbCBsaW5lIFxuICogXG4gKiBbYSxiXSwgKGEsYiksIFthLGIpLCBbYSwgYikgYXJlIGFsbCB2YWxpZCBpbnRlcnZhbHNcbiAqIFxuICogXG4gKiBJTlRFUlZBTCBFTkRQT0lOVFNcbiAqIFxuICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgdHlwZV0sIGZvciBleGFtcGxlXG4gKiBcbiAqIDQpIC0+IFs0LFwiKVwiXSAtIGhpZ2ggZW5kcG9pbnQgbGVmdCBvZiA0XG4gKiBbNCAtPiBbNCwgXCJbXCJdIC0gbG93IGVuZHBvaW50IGluY2x1ZGVzIDRcbiAqIDQgIC0+IFs0LCBcIlwiXSAtIHZhbHVlIDRcbiAqIDRdIC0+IFs0LCBcIl1cIl0gLSBoaWdoIGVuZHBvaW50IGluY2x1ZGVzIDRcbiAqICg0IC0+IFs0LCBcIihcIl0gLSBsb3cgZW5kcG9pbnQgaXMgcmlnaHQgb2YgNFxuICogXG4gKi9cblxuXG4vKipcbiAqIHJldHVybiBmaXJzdCBoaWdoIGVuZHBvaW50IG9uIHRoZSBsZWZ0IGZyb20gbmVhcmJ5LFxuICogd2hpY2ggaXMgbm90IGluIGNlbnRlclxuICovXG5leHBvcnQgZnVuY3Rpb24gbGVmdF9lbmRwb2ludCAobmVhcmJ5KSB7XG4gICAgY29uc3QgbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChuZWFyYnkuaXR2KVswXTtcbiAgICByZXR1cm4gZW5kcG9pbnQuZmxpcChsb3cpO1xufVxuXG4vKipcbiAqIHJldHVybiBmaXJzdCBsb3cgZW5kcG9pbnQgb24gdGhlIHJpZ2h0IGZyb20gbmVhcmJ5LFxuICogd2hpY2ggaXMgbm90IGluIGNlbnRlclxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiByaWdodF9lbmRwb2ludCAobmVhcmJ5KSB7XG4gICAgY29uc3QgaGlnaCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmVhcmJ5Lml0dilbMV07XG4gICAgcmV0dXJuIGVuZHBvaW50LmZsaXAoaGlnaCk7XG59XG5cblxuXG5leHBvcnQgY2xhc3MgTmVhcmJ5SW5kZXhCYXNlIHtcblxuXG4gICAgLyogXG4gICAgICAgIE5lYXJieSBtZXRob2RcbiAgICAqL1xuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIGVtcHR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5maXJzdCgpID09IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICByZXR1cm4gbG93IHBvaW50IG9mIGxlZnRtb3N0IGVudHJ5XG4gICAgKi9cbiAgICBmaXJzdCgpIHtcbiAgICAgICAgbGV0IHtjZW50ZXIsIHJpZ2h0fSA9IHRoaXMubmVhcmJ5KGVuZHBvaW50Lk5FR19JTkYpO1xuICAgICAgICBpZiAoY2VudGVyLmxlbmd0aCA+IDAgKSB7XG4gICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuTkVHX0lORjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZW5kcG9pbnQubHQocmlnaHQsIGVuZHBvaW50LlBPU19JTkYpKSB7XG4gICAgICAgICAgICByZXR1cm4gcmlnaHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBlbXB0eVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHJldHVybiBoaWdoIHBvaW50IG9mIHJpZ2h0bW9zdCBlbnRyeVxuICAgICovXG4gICAgbGFzdCgpIHtcbiAgICAgICAgbGV0IHtsZWZ0LCBjZW50ZXJ9ID0gdGhpcy5uZWFyYnkoZW5kcG9pbnQuUE9TX0lORik7XG4gICAgICAgIGlmIChjZW50ZXIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIGVuZHBvaW50LlBPU19JTkY7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVuZHBvaW50Lmd0KGxlZnQsIGVuZHBvaW50Lk5FR19JTkYpKSB7XG4gICAgICAgICAgICByZXR1cm4gbGVmdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGVtcHR5XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiByZXR1cm4gbmVhcmJ5IG9mIGZpcnN0IHJlZ2lvbiB0byB0aGUgcmlnaHRcbiAgICAgKiB3aGljaCBpcyBub3QgdGhlIGNlbnRlciByZWdpb24uIElmIG5vdCBleGlzdHMsIHJldHVyblxuICAgICAqIHVuZGVmaW5lZC4gXG4gICAgICovXG4gICAgcmlnaHRfcmVnaW9uKG5lYXJieSkge1xuICAgICAgICBjb25zdCByaWdodCA9IHJpZ2h0X2VuZHBvaW50KG5lYXJieSk7XG4gICAgICAgIGlmIChyaWdodFswXSA9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm5lYXJieShyaWdodCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIG5lYXJieSBvZiBmaXJzdCByZWdpb24gdG8gdGhlIGxlZnRcbiAgICAgKiB3aGljaCBpcyBub3QgdGhlIGNlbnRlciByZWdpb24uIElmIG5vdCBleGlzdHMsIHJldHVyblxuICAgICAqIHVuZGVmaW5lZC4gXG4gICAgICovXG4gICAgbGVmdF9yZWdpb24obmVhcmJ5KSB7XG4gICAgICAgIGNvbnN0IGxlZnQgPSBsZWZ0X2VuZHBvaW50KG5lYXJieSk7XG4gICAgICAgIGlmIChsZWZ0WzBdID09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubmVhcmJ5KGxlZnQpOyAgICBcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBmaW5kIGZpcnN0IHJlZ2lvbiB0byB0aGUgXCJyaWdodFwiIG9yIFwibGVmdFwiXG4gICAgICogd2hpY2ggaXMgbm90IHRoZSBjZW50ZXIgcmVnaW9uLCBhbmQgd2hpY2ggbWVldHNcbiAgICAgKiBhIGNvbmRpdGlvbiBvbiBuZWFyYnkuY2VudGVyLlxuICAgICAqIERlZmF1bHQgY29uZGl0aW9uIGlzIGNlbnRlciBub24tZW1wdHlcbiAgICAgKiBJZiBub3QgZXhpc3RzLCByZXR1cm4gdW5kZWZpbmVkLiBcbiAgICAgKi9cbiAgICBcbiAgICBmaW5kX3JlZ2lvbihuZWFyYnksIG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtcbiAgICAgICAgICAgIGRpcmVjdGlvbiA9IDEsXG4gICAgICAgICAgICBjb25kaXRpb24gPSAoY2VudGVyKSA9PiBjZW50ZXIubGVuZ3RoID4gMFxuICAgICAgICB9ID0gb3B0aW9ucztcbiAgICAgICAgbGV0IG5leHRfbmVhcmJ5O1xuICAgICAgICB3aGlsZSh0cnVlKSB7XG4gICAgICAgICAgICBpZiAoZGlyZWN0aW9uID09IDEpIHtcbiAgICAgICAgICAgICAgICBuZXh0X25lYXJieSA9IHRoaXMucmlnaHRfcmVnaW9uKG5lYXJieSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5leHRfbmVhcmJ5ID0gdGhpcy5sZWZ0X3JlZ2lvbihuZWFyYnkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5leHRfbmVhcmJ5ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY29uZGl0aW9uKG5leHRfbmVhcmJ5LmNlbnRlcikpIHtcbiAgICAgICAgICAgICAgICAvLyBmb3VuZCByZWdpb24gXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5leHRfbmVhcmJ5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gcmVnaW9uIG5vdCBmb3VuZFxuICAgICAgICAgICAgLy8gY29udGludWUgc2VhcmNoaW5nIHRoZSByaWdodFxuICAgICAgICAgICAgbmVhcmJ5ID0gbmV4dF9uZWFyYnk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZWdpb25zKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWdpb25JdGVyYXRvcih0aGlzLCBvcHRpb25zKTtcbiAgICB9XG5cbn1cblxuXG4vKlxuICAgIEl0ZXJhdGUgcmVnaW9ucyBvZiBpbmRleCBmcm9tIGxlZnQgdG8gcmlnaHRcblxuICAgIEl0ZXJhdGlvbiBsaW1pdGVkIHRvIGludGVydmFsIFtzdGFydCwgc3RvcF0gb24gdGhlIHRpbWVsaW5lLlxuICAgIFJldHVybnMgbGlzdCBvZiBpdGVtLWxpc3RzLlxuICAgIG9wdGlvbnNcbiAgICAtIHN0YXJ0XG4gICAgLSBzdG9wXG4gICAgLSBpbmNsdWRlRW1wdHlcbiovXG5cbmNsYXNzIFJlZ2lvbkl0ZXJhdG9yIHtcblxuICAgIGNvbnN0cnVjdG9yKGluZGV4LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIGxldCB7XG4gICAgICAgICAgICBzdGFydD0tSW5maW5pdHksIFxuICAgICAgICAgICAgc3RvcD1JbmZpbml0eSwgXG4gICAgICAgICAgICBpbmNsdWRlRW1wdHk9dHJ1ZVxuICAgICAgICB9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHN0YXJ0ID4gc3RvcCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIChcInN0b3AgbXVzdCBiZSBsYXJnZXIgdGhhbiBzdGFydFwiLCBzdGFydCwgc3RvcClcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9pbmRleCA9IGluZGV4O1xuICAgICAgICB0aGlzLl9zdGFydCA9IGVuZHBvaW50LmZyb21faW5wdXQoc3RhcnQpO1xuICAgICAgICB0aGlzLl9zdG9wID0gZW5kcG9pbnQuZnJvbV9pbnB1dChzdG9wKTtcblxuICAgICAgICBpZiAoaW5jbHVkZUVtcHR5KSB7XG4gICAgICAgICAgICB0aGlzLl9jb25kaXRpb24gPSAoKSA9PiB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY29uZGl0aW9uID0gKGNlbnRlcikgPT4gY2VudGVyLmxlbmd0aCA+IDA7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY3VycmVudDtcbiAgICB9XG5cbiAgICBuZXh0KCkge1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIGluaXRpYWxzZVxuICAgICAgICAgICAgdGhpcy5fY3VycmVudCA9IHRoaXMuX2luZGV4Lm5lYXJieSh0aGlzLl9zdGFydCk7XG4gICAgICAgICAgICBpZiAodGhpcy5fY29uZGl0aW9uKHRoaXMuX2N1cnJlbnQuY2VudGVyKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dGhpcy5fY3VycmVudCwgZG9uZTpmYWxzZX07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbGV0IG9wdGlvbnMgPSB7Y29uZGl0aW9uOnRoaXMuX2NvbmRpdGlvbiwgZGlyZWN0aW9uOjF9XG4gICAgICAgIHRoaXMuX2N1cnJlbnQgPSB0aGlzLl9pbmRleC5maW5kX3JlZ2lvbih0aGlzLl9jdXJyZW50LCBvcHRpb25zKTtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4ge3ZhbHVlOnVuZGVmaW5lZCwgZG9uZTp0cnVlfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dGhpcy5fY3VycmVudCwgZG9uZTpmYWxzZX1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIFtTeW1ib2wuaXRlcmF0b3JdKCkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59XG5cbi8qKlxuICogbmVhcmJ5X2Zyb21cbiAqIFxuICogdXRpbGl0eSBmdW5jdGlvbiBmb3IgY3JlYXRpbmcgYSBuZWFyYnkgb2JqZWN0IGluIGNpcmN1bXN0YW5jZXNcbiAqIHdoZXJlIHRoZXJlIGFyZSBvdmVybGFwcGluZyBpbnRlcnZhbHMgVGhpcyBjb3VsZCBiZSB3aGVuIGEgXG4gKiBzdGF0ZXByb3ZpZGVyIGZvciBhIGxheWVyIGhhcyBvdmVybGFwcGluZyBpdGVtcyBvciB3aGVuIFxuICogbXVsdGlwbGUgbmVhcmJ5IGluZGV4ZXMgYXJlIG1lcmdlZCBpbnRvIG9uZS5cbiAqIFxuICogXG4gKiBAcGFyYW0geyp9IHByZXZfaGlnaCA6IHRoZSByaWdodG1vc3QgaGlnaC1lbmRwb2ludCBsZWZ0IG9mIG9mZnNldFxuICogQHBhcmFtIHsqfSBjZW50ZXJfbG93X2xpc3QgOiBsb3ctZW5kcG9pbnRzIG9mIGNlbnRlclxuICogQHBhcmFtIHsqfSBjZW50ZXIgOiBjZW50ZXJcbiAqIEBwYXJhbSB7Kn0gY2VudGVyX2hpZ2hfbGlzdCA6IGhpZ2gtZW5kcG9pbnRzIG9mIGNlbnRlclxuICogQHBhcmFtIHsqfSBuZXh0X2xvdyA6IHRoZSBsZWZ0bW9zdCBsb3ctZW5kcG9pbnQgcmlnaHQgb2Ygb2Zmc2V0XG4gKiBAcmV0dXJucyBcbiAqL1xuXG5mdW5jdGlvbiBjbXBfYXNjZW5kaW5nKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludC5jbXAocDEsIHAyKVxufVxuXG5mdW5jdGlvbiBjbXBfZGVzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAyLCBwMSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5lYXJieV9mcm9tIChcbiAgICBwcmV2X2hpZ2gsIFxuICAgIGNlbnRlcl9sb3dfbGlzdCwgXG4gICAgY2VudGVyLFxuICAgIGNlbnRlcl9oaWdoX2xpc3QsXG4gICAgbmV4dF9sb3cpIHtcblxuICAgIC8vIG5lYXJieVxuICAgIGNvbnN0IHJlc3VsdCA9IHtjZW50ZXJ9O1xuXG4gICAgaWYgKGNlbnRlci5sZW5ndGggPT0gMCkge1xuICAgICAgICAvLyBlbXB0eSBjZW50ZXJcbiAgICAgICAgcmVzdWx0LnJpZ2h0ID0gbmV4dF9sb3c7XG4gICAgICAgIHJlc3VsdC5sZWZ0ID0gcHJldl9oaWdoO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG5vbi1lbXB0eSBjZW50ZXJcbiAgICAgICAgXG4gICAgICAgIC8vIGNlbnRlciBoaWdoXG4gICAgICAgIGNlbnRlcl9oaWdoX2xpc3Quc29ydChjbXBfYXNjZW5kaW5nKTtcbiAgICAgICAgbGV0IG1pbl9jZW50ZXJfaGlnaCA9IGNlbnRlcl9oaWdoX2xpc3RbMF07XG4gICAgICAgIGxldCBtYXhfY2VudGVyX2hpZ2ggPSBjZW50ZXJfaGlnaF9saXN0LnNsaWNlKC0xKVswXTtcbiAgICAgICAgbGV0IG11bHRpcGxlX2NlbnRlcl9oaWdoID0gIWVuZHBvaW50LmVxKG1pbl9jZW50ZXJfaGlnaCwgbWF4X2NlbnRlcl9oaWdoKVxuXG4gICAgICAgIC8vIGNlbnRlciBsb3dcbiAgICAgICAgY2VudGVyX2xvd19saXN0LnNvcnQoY21wX2Rlc2NlbmRpbmcpO1xuICAgICAgICBsZXQgbWF4X2NlbnRlcl9sb3cgPSBjZW50ZXJfbG93X2xpc3RbMF07XG4gICAgICAgIGxldCBtaW5fY2VudGVyX2xvdyA9IGNlbnRlcl9sb3dfbGlzdC5zbGljZSgtMSlbMF07XG4gICAgICAgIGxldCBtdWx0aXBsZV9jZW50ZXJfbG93ID0gIWVuZHBvaW50LmVxKG1heF9jZW50ZXJfbG93LCBtaW5fY2VudGVyX2xvdylcblxuICAgICAgICAvLyBuZXh0L3JpZ2h0XG4gICAgICAgIGlmIChlbmRwb2ludC5sZShuZXh0X2xvdywgbWluX2NlbnRlcl9oaWdoKSkge1xuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gbmV4dF9sb3c7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSBlbmRwb2ludC5mbGlwKG1pbl9jZW50ZXJfaGlnaClcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQubmV4dCA9IChtdWx0aXBsZV9jZW50ZXJfaGlnaCkgPyByZXN1bHQucmlnaHQgOiBuZXh0X2xvdztcblxuICAgICAgICAvLyBwcmV2L2xlZnRcbiAgICAgICAgaWYgKGVuZHBvaW50LmdlKHByZXZfaGlnaCwgbWF4X2NlbnRlcl9sb3cpKSB7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IHByZXZfaGlnaDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gZW5kcG9pbnQuZmxpcChtYXhfY2VudGVyX2xvdyk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LnByZXYgPSAobXVsdGlwbGVfY2VudGVyX2xvdykgPyByZXN1bHQubGVmdCA6IHByZXZfaGlnaDtcblxuICAgIH1cblxuICAgIC8vIGludGVydmFsIGZyb20gbGVmdC9yaWdodFxuICAgIGxldCBsb3cgPSBlbmRwb2ludC5mbGlwKHJlc3VsdC5sZWZ0KTtcbiAgICBsZXQgaGlnaCA9IGVuZHBvaW50LmZsaXAocmVzdWx0LnJpZ2h0KTtcbiAgICByZXN1bHQuaXR2ID0gaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cblxuLyoqXG4gKiBDcmVhdGUgYSBOZWFyYnlJbmRleCBmb3IgYSBzcmMgb2JqZWN0IExheWVyLlxuICogXG4gKiBUaGUgc3JjIG9iamVjdCByZXNvbHZlcyBxdWVyaWVzIGZvciB0aGUgZW50aXJlIHRpbWVsaW5lLlxuICogSW4gb3JkZXIgZm9yIHRoZSBkZWZhdWx0IExheWVyQ2FjaGUgdG8gd29yaywgYW5cbiAqIG9iamVjdCB3aXRoIGEgLnF1ZXJ5KG9mZnNldCkgbWV0aG9kIGlzIG5lZWRlZCBpbiBcbiAqIG5lYXJieS5jZW50ZXIuXG4gKi9cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4U3JjIGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKHNyYykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9zcmMgPSBzcmM7XG4gICAgICAgIHRoaXMuX2NhY2hlID0gc3JjLmNyZWF0ZUNhY2hlKCk7XG4gICAgfVxuXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBjb25zdCBuZWFyYnkgPSB0aGlzLl9zcmMuaW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgIG5lYXJieS5jZW50ZXIgPSBbdGhpcy5fY2FjaGVdO1xuICAgICAgICByZXR1cm4gbmVhcmJ5O1xuICAgIH1cbn1cbiIsIi8qXG5cdENvcHlyaWdodCAyMDIwXG5cdEF1dGhvciA6IEluZ2FyIEFybnR6ZW5cblxuXHRUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgVGltaW5nc3JjIG1vZHVsZS5cblxuXHRUaW1pbmdzcmMgaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeVxuXHRpdCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnlcblx0dGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbiwgZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3Jcblx0KGF0IHlvdXIgb3B0aW9uKSBhbnkgbGF0ZXIgdmVyc2lvbi5cblxuXHRUaW1pbmdzcmMgaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCxcblx0YnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZOyB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2Zcblx0TUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLiAgU2VlIHRoZVxuXHRHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cblxuXHRZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2Vcblx0YWxvbmcgd2l0aCBUaW1pbmdzcmMuICBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz4uXG4qL1xuXG5cblxuLypcblx0RXZlbnRcblx0LSBuYW1lOiBldmVudCBuYW1lXG5cdC0gcHVibGlzaGVyOiB0aGUgb2JqZWN0IHdoaWNoIGRlZmluZWQgdGhlIGV2ZW50XG5cdC0gaW5pdDogdHJ1ZSBpZiB0aGUgZXZlbnQgc3VwcHBvcnRzIGluaXQgZXZlbnRzXG5cdC0gc3Vic2NyaXB0aW9uczogc3Vic2NyaXB0aW5zIHRvIHRoaXMgZXZlbnRcblxuKi9cblxuY2xhc3MgRXZlbnQge1xuXG5cdGNvbnN0cnVjdG9yIChwdWJsaXNoZXIsIG5hbWUsIG9wdGlvbnMpIHtcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXHRcdHRoaXMucHVibGlzaGVyID0gcHVibGlzaGVyO1xuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdFx0dGhpcy5pbml0ID0gKG9wdGlvbnMuaW5pdCA9PT0gdW5kZWZpbmVkKSA/IGZhbHNlIDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucyA9IFtdO1xuXHR9XG5cblx0Lypcblx0XHRzdWJzY3JpYmUgdG8gZXZlbnRcblx0XHQtIHN1YnNjcmliZXI6IHN1YnNjcmliaW5nIG9iamVjdFxuXHRcdC0gY2FsbGJhY2s6IGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGludm9rZVxuXHRcdC0gb3B0aW9uczpcblx0XHRcdGluaXQ6IGlmIHRydWUgc3Vic2NyaWJlciB3YW50cyBpbml0IGV2ZW50c1xuXHQqL1xuXHRzdWJzY3JpYmUgKGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0aWYgKCFjYWxsYmFjayB8fCB0eXBlb2YgY2FsbGJhY2sgIT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgbm90IGEgZnVuY3Rpb25cIiwgY2FsbGJhY2spO1xuXHRcdH1cblx0XHRjb25zdCBzdWIgPSBuZXcgU3Vic2NyaXB0aW9uKHRoaXMsIGNhbGxiYWNrLCBvcHRpb25zKTtcblx0XHR0aGlzLnN1YnNjcmlwdGlvbnMucHVzaChzdWIpO1xuXHQgICAgLy8gSW5pdGlhdGUgaW5pdCBjYWxsYmFjayBmb3IgdGhpcyBzdWJzY3JpcHRpb25cblx0ICAgIGlmICh0aGlzLmluaXQgJiYgc3ViLmluaXQpIHtcblx0ICAgIFx0c3ViLmluaXRfcGVuZGluZyA9IHRydWU7XG5cdCAgICBcdGxldCBzZWxmID0gdGhpcztcblx0ICAgIFx0UHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICBcdFx0Y29uc3QgZUFyZ3MgPSBzZWxmLnB1Ymxpc2hlci5ldmVudGlmeUluaXRFdmVudEFyZ3Moc2VsZi5uYW1lKSB8fCBbXTtcblx0ICAgIFx0XHRzdWIuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdCAgICBcdFx0Zm9yIChsZXQgZUFyZyBvZiBlQXJncykge1xuXHQgICAgXHRcdFx0c2VsZi50cmlnZ2VyKGVBcmcsIFtzdWJdLCB0cnVlKTtcblx0ICAgIFx0XHR9XG5cdCAgICBcdH0pO1xuXHQgICAgfVxuXHRcdHJldHVybiBzdWJcblx0fVxuXG5cdC8qXG5cdFx0dHJpZ2dlciBldmVudFxuXG5cdFx0LSBpZiBzdWIgaXMgdW5kZWZpbmVkIC0gcHVibGlzaCB0byBhbGwgc3Vic2NyaXB0aW9uc1xuXHRcdC0gaWYgc3ViIGlzIGRlZmluZWQgLSBwdWJsaXNoIG9ubHkgdG8gZ2l2ZW4gc3Vic2NyaXB0aW9uXG5cdCovXG5cdHRyaWdnZXIgKGVBcmcsIHN1YnMsIGluaXQpIHtcblx0XHRsZXQgZUluZm8sIGN0eDtcblx0XHRmb3IgKGNvbnN0IHN1YiBvZiBzdWJzKSB7XG5cdFx0XHQvLyBpZ25vcmUgdGVybWluYXRlZCBzdWJzY3JpcHRpb25zXG5cdFx0XHRpZiAoc3ViLnRlcm1pbmF0ZWQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRlSW5mbyA9IHtcblx0XHRcdFx0c3JjOiB0aGlzLnB1Ymxpc2hlcixcblx0XHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0XHRzdWI6IHN1Yixcblx0XHRcdFx0aW5pdDogaW5pdFxuXHRcdFx0fVxuXHRcdFx0Y3R4ID0gc3ViLmN0eCB8fCB0aGlzLnB1Ymxpc2hlcjtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHN1Yi5jYWxsYmFjay5jYWxsKGN0eCwgZUFyZywgZUluZm8pO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBFcnJvciBpbiAke3RoaXMubmFtZX06ICR7c3ViLmNhbGxiYWNrfSAke2Vycn1gKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKlxuXHR1bnN1YnNjcmliZSBmcm9tIGV2ZW50XG5cdC0gdXNlIHN1YnNjcmlwdGlvbiByZXR1cm5lZCBieSBwcmV2aW91cyBzdWJzY3JpYmVcblx0Ki9cblx0dW5zdWJzY3JpYmUoc3ViKSB7XG5cdFx0bGV0IGlkeCA9IHRoaXMuc3Vic2NyaXB0aW9ucy5pbmRleE9mKHN1Yik7XG5cdFx0aWYgKGlkeCA+IC0xKSB7XG5cdFx0XHR0aGlzLnN1YnNjcmlwdGlvbnMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRzdWIudGVybWluYXRlKCk7XG5cdFx0fVxuXHR9XG59XG5cblxuLypcblx0U3Vic2NyaXB0aW9uIGNsYXNzXG4qL1xuXG5jbGFzcyBTdWJzY3JpcHRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKGV2ZW50LCBjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5ldmVudCA9IGV2ZW50O1xuXHRcdHRoaXMubmFtZSA9IGV2ZW50Lm5hbWU7XG5cdFx0dGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrXG5cdFx0dGhpcy5pbml0ID0gKG9wdGlvbnMuaW5pdCA9PT0gdW5kZWZpbmVkKSA/IHRoaXMuZXZlbnQuaW5pdCA6IG9wdGlvbnMuaW5pdDtcblx0XHR0aGlzLmluaXRfcGVuZGluZyA9IGZhbHNlO1xuXHRcdHRoaXMudGVybWluYXRlZCA9IGZhbHNlO1xuXHRcdHRoaXMuY3R4ID0gb3B0aW9ucy5jdHg7XG5cdH1cblxuXHR0ZXJtaW5hdGUoKSB7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gdHJ1ZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuZXZlbnQudW5zdWJzY3JpYmUodGhpcyk7XG5cdH1cbn1cblxuXG4vKlxuXG5cdEVWRU5USUZZIElOU1RBTkNFXG5cblx0RXZlbnRpZnkgYnJpbmdzIGV2ZW50aW5nIGNhcGFiaWxpdGllcyB0byBhbnkgb2JqZWN0LlxuXG5cdEluIHBhcnRpY3VsYXIsIGV2ZW50aWZ5IHN1cHBvcnRzIHRoZSBpbml0aWFsLWV2ZW50IHBhdHRlcm4uXG5cdE9wdC1pbiBmb3IgaW5pdGlhbCBldmVudHMgcGVyIGV2ZW50IHR5cGUuXG5cblx0ZXZlbnRpZnlJbml0RXZlbnRBcmdzKG5hbWUpIHtcblx0XHRpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG5cdFx0XHRyZXR1cm4gW3RoaXMuX3ZhbHVlXTtcblx0XHR9XG5cdH1cblxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5SW5zdGFuY2UgKG9iamVjdCkge1xuXHRvYmplY3QuX19ldmVudGlmeV9ldmVudE1hcCA9IG5ldyBNYXAoKTtcblx0b2JqZWN0Ll9fZXZlbnRpZnlfYnVmZmVyID0gW107XG5cdHJldHVybiBvYmplY3Q7XG59O1xuXG5cbi8qXG5cdEVWRU5USUZZIFBST1RPVFlQRVxuXG5cdEFkZCBldmVudGlmeSBmdW5jdGlvbmFsaXR5IHRvIHByb3RvdHlwZSBvYmplY3RcbiovXG5cbmV4cG9ydCBmdW5jdGlvbiBldmVudGlmeVByb3RvdHlwZShfcHJvdG90eXBlKSB7XG5cblx0ZnVuY3Rpb24gZXZlbnRpZnlHZXRFdmVudChvYmplY3QsIG5hbWUpIHtcblx0XHRjb25zdCBldmVudCA9IG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwLmdldChuYW1lKTtcblx0XHRpZiAoZXZlbnQgPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCB1bmRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHJldHVybiBldmVudDtcblx0fVxuXG5cdC8qXG5cdFx0REVGSU5FIEVWRU5UXG5cdFx0LSB1c2VkIG9ubHkgYnkgZXZlbnQgc291cmNlXG5cdFx0LSBuYW1lOiBuYW1lIG9mIGV2ZW50XG5cdFx0LSBvcHRpb25zOiB7aW5pdDp0cnVlfSBzcGVjaWZpZXMgaW5pdC1ldmVudCBzZW1hbnRpY3MgZm9yIGV2ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5RGVmaW5lKG5hbWUsIG9wdGlvbnMpIHtcblx0XHQvLyBjaGVjayB0aGF0IGV2ZW50IGRvZXMgbm90IGFscmVhZHkgZXhpc3Rcblx0XHRpZiAodGhpcy5fX2V2ZW50aWZ5X2V2ZW50TWFwLmhhcyhuYW1lKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRXZlbnQgYWxyZWFkeSBkZWZpbmVkXCIsIG5hbWUpO1xuXHRcdH1cblx0XHR0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuc2V0KG5hbWUsIG5ldyBFdmVudCh0aGlzLCBuYW1lLCBvcHRpb25zKSk7XG5cdH07XG5cblx0Lypcblx0XHRPTlxuXHRcdC0gdXNlZCBieSBzdWJzY3JpYmVyXG5cdFx0cmVnaXN0ZXIgY2FsbGJhY2sgb24gZXZlbnQuXG5cdCovXG5cdGZ1bmN0aW9uIG9uKG5hbWUsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSkuc3Vic2NyaWJlKGNhbGxiYWNrLCBvcHRpb25zKTtcblx0fTtcblxuXHQvKlxuXHRcdE9GRlxuXHRcdC0gdXNlZCBieSBzdWJzY3JpYmVyXG5cdFx0VW4tcmVnaXN0ZXIgYSBoYW5kbGVyIGZyb20gYSBzcGVjZmljIGV2ZW50IHR5cGVcblx0Ki9cblx0ZnVuY3Rpb24gb2ZmKHN1Yikge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIHN1Yi5uYW1lKS51bnN1YnNjcmliZShzdWIpO1xuXHR9O1xuXG5cblx0ZnVuY3Rpb24gZXZlbnRpZnlTdWJzY3JpcHRpb25zKG5hbWUpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpcHRpb25zO1xuXHR9XG5cblxuXG5cdC8qXG5cdFx0VHJpZ2dlciBsaXN0IG9mIGV2ZW50SXRlbXMgb24gb2JqZWN0XG5cblx0XHRldmVudEl0ZW06ICB7bmFtZTouLiwgZUFyZzouLn1cblxuXHRcdGNvcHkgYWxsIGV2ZW50SXRlbXMgaW50byBidWZmZXIuXG5cdFx0cmVxdWVzdCBlbXB0eWluZyB0aGUgYnVmZmVyLCBpLmUuIGFjdHVhbGx5IHRyaWdnZXJpbmcgZXZlbnRzLFxuXHRcdGV2ZXJ5IHRpbWUgdGhlIGJ1ZmZlciBnb2VzIGZyb20gZW1wdHkgdG8gbm9uLWVtcHR5XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsbChldmVudEl0ZW1zKSB7XG5cdFx0aWYgKGV2ZW50SXRlbXMubGVuZ3RoID09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBtYWtlIHRyaWdnZXIgaXRlbXNcblx0XHQvLyByZXNvbHZlIG5vbi1wZW5kaW5nIHN1YnNjcmlwdGlvbnMgbm93XG5cdFx0Ly8gZWxzZSBzdWJzY3JpcHRpb25zIG1heSBjaGFuZ2UgZnJvbSBwZW5kaW5nIHRvIG5vbi1wZW5kaW5nXG5cdFx0Ly8gYmV0d2VlbiBoZXJlIGFuZCBhY3R1YWwgdHJpZ2dlcmluZ1xuXHRcdC8vIG1ha2UgbGlzdCBvZiBbZXYsIGVBcmcsIHN1YnNdIHR1cGxlc1xuXHRcdGxldCB0cmlnZ2VySXRlbXMgPSBldmVudEl0ZW1zLm1hcCgoaXRlbSkgPT4ge1xuXHRcdFx0bGV0IHtuYW1lLCBlQXJnfSA9IGl0ZW07XG5cdFx0XHRsZXQgZXYgPSBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpO1xuXHRcdFx0bGV0IHN1YnMgPSBldi5zdWJzY3JpcHRpb25zLmZpbHRlcihzdWIgPT4gc3ViLmluaXRfcGVuZGluZyA9PSBmYWxzZSk7XG5cdFx0XHRyZXR1cm4gW2V2LCBlQXJnLCBzdWJzXTtcblx0XHR9LCB0aGlzKTtcblxuXHRcdC8vIGFwcGVuZCB0cmlnZ2VyIEl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGNvbnN0IGxlbiA9IHRyaWdnZXJJdGVtcy5sZW5ndGg7XG5cdFx0Y29uc3QgYnVmID0gdGhpcy5fX2V2ZW50aWZ5X2J1ZmZlcjtcblx0XHRjb25zdCBidWZfbGVuID0gdGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGg7XG5cdFx0Ly8gcmVzZXJ2ZSBtZW1vcnkgLSBzZXQgbmV3IGxlbmd0aFxuXHRcdHRoaXMuX19ldmVudGlmeV9idWZmZXIubGVuZ3RoID0gYnVmX2xlbiArIGxlbjtcblx0XHQvLyBjb3B5IHRyaWdnZXJJdGVtcyB0byBidWZmZXJcblx0XHRmb3IgKGxldCBpPTA7IGk8bGVuOyBpKyspIHtcblx0XHRcdGJ1ZltidWZfbGVuK2ldID0gdHJpZ2dlckl0ZW1zW2ldO1xuXHRcdH1cblx0XHQvLyByZXF1ZXN0IGVtcHR5aW5nIG9mIHRoZSBidWZmZXJcblx0XHRpZiAoYnVmX2xlbiA9PSAwKSB7XG5cdFx0XHRsZXQgc2VsZiA9IHRoaXM7XG5cdFx0XHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRmb3IgKGxldCBbZXYsIGVBcmcsIHN1YnNdIG9mIHNlbGYuX19ldmVudGlmeV9idWZmZXIpIHtcblx0XHRcdFx0XHQvLyBhY3R1YWwgZXZlbnQgdHJpZ2dlcmluZ1xuXHRcdFx0XHRcdGV2LnRyaWdnZXIoZUFyZywgc3VicywgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGYuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdC8qXG5cdFx0VHJpZ2dlciBtdWx0aXBsZSBldmVudHMgb2Ygc2FtZSB0eXBlIChuYW1lKVxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXJBbGlrZShuYW1lLCBlQXJncykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChlQXJncy5tYXAoZUFyZyA9PiB7XG5cdFx0XHRyZXR1cm4ge25hbWUsIGVBcmd9O1xuXHRcdH0pKTtcblx0fVxuXG5cdC8qXG5cdFx0VHJpZ2dlciBzaW5nbGUgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyKG5hbWUsIGVBcmcpIHtcblx0XHRyZXR1cm4gdGhpcy5ldmVudGlmeVRyaWdnZXJBbGwoW3tuYW1lLCBlQXJnfV0pO1xuXHR9XG5cblx0X3Byb3RvdHlwZS5ldmVudGlmeURlZmluZSA9IGV2ZW50aWZ5RGVmaW5lO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlciA9IGV2ZW50aWZ5VHJpZ2dlcjtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXJBbGlrZSA9IGV2ZW50aWZ5VHJpZ2dlckFsaWtlO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsbCA9IGV2ZW50aWZ5VHJpZ2dlckFsbDtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVN1YnNjcmlwdGlvbnMgPSBldmVudGlmeVN1YnNjcmlwdGlvbnM7XG5cdF9wcm90b3R5cGUub24gPSBvbjtcblx0X3Byb3RvdHlwZS5vZmYgPSBvZmY7XG59O1xuXG5cbmV4cG9ydCB7ZXZlbnRpZnlJbnN0YW5jZSBhcyBhZGRTdGF0ZX07XG5leHBvcnQge2V2ZW50aWZ5UHJvdG90eXBlIGFzIGFkZE1ldGhvZHN9O1xuXG4vKlxuXHRFdmVudCBWYXJpYWJsZVxuXG5cdE9iamVjdHMgd2l0aCBhIHNpbmdsZSBcImNoYW5nZVwiIGV2ZW50XG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRWYXJpYWJsZSB7XG5cblx0Y29uc3RydWN0b3IgKHZhbHVlKSB7XG5cdFx0ZXZlbnRpZnlJbnN0YW5jZSh0aGlzKTtcblx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMuZXZlbnRpZnlEZWZpbmUoXCJjaGFuZ2VcIiwge2luaXQ6dHJ1ZX0pO1xuXHR9XG5cblx0ZXZlbnRpZnlJbml0RXZlbnRBcmdzKG5hbWUpIHtcblx0XHRpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG5cdFx0XHRyZXR1cm4gW3RoaXMuX3ZhbHVlXTtcblx0XHR9XG5cdH1cblxuXHRnZXQgdmFsdWUgKCkge3JldHVybiB0aGlzLl92YWx1ZX07XG5cdHNldCB2YWx1ZSAodmFsdWUpIHtcblx0XHRpZiAodmFsdWUgIT0gdGhpcy5fdmFsdWUpIHtcblx0XHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0XHR0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiLCB2YWx1ZSk7XG5cdFx0fVxuXHR9XG59XG5ldmVudGlmeVByb3RvdHlwZShFdmVudFZhcmlhYmxlLnByb3RvdHlwZSk7XG5cbi8qXG5cdEV2ZW50IEJvb2xlYW5cblxuXG5cdE5vdGUgOiBpbXBsZW1lbnRhdGlvbiB1c2VzIGZhbHNpbmVzcyBvZiBpbnB1dCBwYXJhbWV0ZXIgdG8gY29uc3RydWN0b3IgYW5kIHNldCgpIG9wZXJhdGlvbixcblx0c28gZXZlbnRCb29sZWFuKC0xKSB3aWxsIGFjdHVhbGx5IHNldCBpdCB0byB0cnVlIGJlY2F1c2Vcblx0KC0xKSA/IHRydWUgOiBmYWxzZSAtPiB0cnVlICFcbiovXG5cbmV4cG9ydCBjbGFzcyBFdmVudEJvb2xlYW4gZXh0ZW5kcyBFdmVudFZhcmlhYmxlIHtcblx0Y29uc3RydWN0b3IodmFsdWUpIHtcblx0XHRzdXBlcihCb29sZWFuKHZhbHVlKSk7XG5cdH1cblxuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0c3VwZXIudmFsdWUgPSBCb29sZWFuKHZhbHVlKTtcblx0fVxuXHRnZXQgdmFsdWUgKCkge3JldHVybiBzdXBlci52YWx1ZX07XG59XG5cblxuLypcblx0bWFrZSBhIHByb21pc2Ugd2hpY2ggaXMgcmVzb2x2ZWQgd2hlbiBFdmVudEJvb2xlYW4gY2hhbmdlc1xuXHR2YWx1ZS5cbiovXG5leHBvcnQgZnVuY3Rpb24gbWFrZVByb21pc2UoZXZlbnRPYmplY3QsIGNvbmRpdGlvbkZ1bmMpIHtcblx0Y29uZGl0aW9uRnVuYyA9IGNvbmRpdGlvbkZ1bmMgfHwgZnVuY3Rpb24odmFsKSB7cmV0dXJuIHZhbCA9PSB0cnVlfTtcblx0cmV0dXJuIG5ldyBQcm9taXNlIChmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0bGV0IHN1YiA9IGV2ZW50T2JqZWN0Lm9uKFwiY2hhbmdlXCIsIGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRcdFx0aWYgKGNvbmRpdGlvbkZ1bmModmFsdWUpKSB7XG5cdFx0XHRcdHJlc29sdmUodmFsdWUpO1xuXHRcdFx0XHRldmVudE9iamVjdC5vZmYoc3ViKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG59O1xuXG4vLyBtb2R1bGUgYXBpXG5leHBvcnQgZGVmYXVsdCB7XG5cdGV2ZW50aWZ5UHJvdG90eXBlLFxuXHRldmVudGlmeUluc3RhbmNlLFxuXHRFdmVudFZhcmlhYmxlLFxuXHRFdmVudEJvb2xlYW4sXG5cdG1ha2VQcm9taXNlXG59O1xuXG4iLCIvKlxuICAgIFRoaXMgZGVjb3JhdGVzIGFuIG9iamVjdC9wcm90b3R5cGUgd2l0aCBiYXNpYyAoc3luY2hyb25vdXMpIGNhbGxiYWNrIHN1cHBvcnQuXG4qL1xuXG5jb25zdCBQUkVGSVggPSBcIl9fY2FsbGJhY2tcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFN0YXRlKG9iamVjdCkge1xuICAgIG9iamVjdFtgJHtQUkVGSVh9X2hhbmRsZXJzYF0gPSBbXTtcbn1cblxuZnVuY3Rpb24gYWRkX2NhbGxiYWNrIChoYW5kbGVyKSB7XG4gICAgbGV0IGhhbmRsZSA9IHtcbiAgICAgICAgaGFuZGxlcjogaGFuZGxlclxuICAgIH1cbiAgICB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5wdXNoKGhhbmRsZSk7XG4gICAgcmV0dXJuIGhhbmRsZTtcbn07XG5cbmZ1bmN0aW9uIHJlbW92ZV9jYWxsYmFjayAoaGFuZGxlKSB7XG4gICAgbGV0IGluZGV4ID0gdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uaW5kZXhPZihoYW5kbGUpO1xuICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgIHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLnNwbGljZShpbmRleCwgMSk7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gbm90aWZ5X2NhbGxiYWNrcyAoZUFyZykge1xuICAgIHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLmZvckVhY2goZnVuY3Rpb24oaGFuZGxlKSB7XG4gICAgICAgIGhhbmRsZS5oYW5kbGVyKGVBcmcpO1xuICAgIH0pO1xufTtcblxuXG5leHBvcnQgZnVuY3Rpb24gYWRkTWV0aG9kcyAob2JqKSB7XG4gICAgY29uc3QgYXBpID0ge1xuICAgICAgICBhZGRfY2FsbGJhY2ssIHJlbW92ZV9jYWxsYmFjaywgbm90aWZ5X2NhbGxiYWNrc1xuICAgIH1cbiAgICBPYmplY3QuYXNzaWduKG9iaiwgYXBpKTtcbn1cblxuLyoqXG4gKiB0ZXN0IGlmIG9iamVjdCBpbXBsZW1lbnRzIGNhbGxiYWNrIGFwaVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNfY2FsbGJhY2tfYXBpIChvYmopIHtcbiAgICBpZiAob2JqID09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IG1ldGhvZHMgPSBbXCJhZGRfY2FsbGJhY2tcIiwgXCJyZW1vdmVfY2FsbGJhY2tcIl07XG4gICAgZm9yIChjb25zdCBwcm9wIG9mIG1ldGhvZHMpIHtcbiAgICAgICAgaWYgKCEocHJvcCBpbiBvYmopKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmICh0eXBlb2Ygb2JqW3Byb3BdICE9ICdmdW5jdGlvbicpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59XG4iLCJpbXBvcnQgeyBlbmRwb2ludCwgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHNcIjtcblxuXG4vLyBvdnZlcnJpZGUgbW9kdWxvIHRvIGJlaGF2ZSBiZXR0ZXIgZm9yIG5lZ2F0aXZlIG51bWJlcnNcbmV4cG9ydCBmdW5jdGlvbiBtb2QobiwgbSkge1xuICAgIHJldHVybiAoKG4gJSBtKSArIG0pICUgbTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBkaXZtb2QoeCwgYmFzZSkge1xuICAgIGxldCBuID0gTWF0aC5mbG9vcih4IC8gYmFzZSlcbiAgICBsZXQgciA9IG1vZCh4LCBiYXNlKTtcbiAgICByZXR1cm4gW24sIHJdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNfZmluaXRlX251bWJlcihvYmopIHtcbiAgICByZXR1cm4gKHR5cGVvZiBvYmogPT0gJ251bWJlcicpICYmIGlzRmluaXRlKG9iaik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjaGVja19udW1iZXIobmFtZSwgb2JqKSB7XG4gICAgaWYgKCFpc19maW5pdGVfbnVtYmVyKG9iaikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke25hbWV9IG11c3QgYmUgZmluaXRlIG51bWJlciAke29ian1gKTtcbiAgICB9XG59XG5cbi8qKlxuICogY29udmVuaWVuY2UgZnVuY3Rpb24gdG8gcmVuZGVyIGEgY3Vyc29yIFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyX2N1cnNvciAoY3Vyc29yLCBzZWxlY3Rvciwgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHtkZWxheT0yMDAsIHJlbmRlciwgbm92YWx1ZX0gPSBvcHRpb25zO1xuICAgIGNvbnN0IGVsZW1zID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gICAgZnVuY3Rpb24gX3JlbmRlcihzdGF0ZSkge1xuICAgICAgICBpZiAoc3RhdGUudmFsdWUgPT0gdW5kZWZpbmVkICYmIG5vdmFsdWUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzdGF0ZS52YWx1ZSA9IG5vdmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlbmRlciAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJlbmRlcihzdGF0ZSwgZWxlbXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZWxlbXMudGV4dENvbnRlbnQgPSAoc3RhdGUudmFsdWUgIT0gdW5kZWZpbmVkKSA/IGAke3N0YXRlLnZhbHVlfWAgOiBcIlwiO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjdXJzb3IuYmluZChfcmVuZGVyLCBkZWxheSk7XG59XG5cblxuXG5cbi8qXG4gICAgc2ltaWxhciB0byByYW5nZSBmdW5jdGlvbiBpbiBweXRob25cbiovXG5cbmV4cG9ydCBmdW5jdGlvbiByYW5nZSAoc3RhcnQsIGVuZCwgc3RlcCA9IDEsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICBjb25zdCB7aW5jbHVkZV9lbmQ9ZmFsc2V9ID0gb3B0aW9ucztcbiAgICBpZiAoc3RlcCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0ZXAgY2Fubm90IGJlIHplcm8uJyk7XG4gICAgfVxuICAgIGlmIChzdGFydCA8IGVuZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gc3RlcCkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChzdGFydCA+IGVuZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPiBlbmQ7IGkgLT0gc3RlcCkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChpbmNsdWRlX2VuZCkge1xuICAgICAgICByZXN1bHQucHVzaChlbmQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5cbi8vIHdlYnBhZ2UgY2xvY2sgLSBwZXJmb3JtYW5jZSBub3cgLSBzZWNvbmRzXG5leHBvcnQgY29uc3QgbG9jYWxfY2xvY2sgPSBmdW5jdGlvbiBsb2NhbF9jbG9jayAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgbm93OiAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gcGVyZm9ybWFuY2Uubm93KCkvMTAwMC4wO1xuICAgICAgICB9XG4gICAgfVxufSgpO1xuXG4vLyBzeXN0ZW0gY2xvY2sgLSBlcG9jaCAtIHNlY29uZHNcbmV4cG9ydCBjb25zdCBsb2NhbF9lcG9jaCA9IGZ1bmN0aW9uIGxvY2FsX2Vwb2NoICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBub3c6ICgpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgRGF0ZSgpLzEwMDAuMDtcbiAgICAgICAgfVxuICAgIH1cbn0oKTtcblxuLyoqXG4gKiBDcmVhdGUgYSBzaW5nbGUgc3RhdGUgZnJvbSBhIGxpc3Qgb2Ygc3RhdGVzLCB1c2luZyBhIHZhbHVlRnVuY1xuICogc3RhdGU6e3ZhbHVlLCBkeW5hbWljLCBvZmZzZXR9XG4gKiBcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gdG9TdGF0ZShzb3VyY2VzLCBzdGF0ZXMsIG9mZnNldCwgb3B0aW9ucz17fSkge1xuICAgIGxldCB7dmFsdWVGdW5jLCBzdGF0ZUZ1bmMsIG51bWVyaWM9ZmFsc2UsIG1hc2t9ID0gb3B0aW9uczsgXG4gICAgbGV0IHN0YXRlO1xuICAgIGlmICh2YWx1ZUZ1bmMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGxldCB2YWx1ZSA9IHZhbHVlRnVuYyh7c291cmNlcywgc3RhdGVzLCBvZmZzZXR9KTtcbiAgICAgICAgbGV0IGR5bmFtaWMgPSBzdGF0ZXMubWFwKCh2KSA9PiB2LmR5bWFtaWMpLnNvbWUoZT0+ZSk7XG4gICAgICAgIHN0YXRlID0ge3ZhbHVlLCBkeW5hbWljLCBvZmZzZXR9O1xuICAgIH0gZWxzZSBpZiAoc3RhdGVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBzdGF0ZSA9IHsuLi5zdGF0ZUZ1bmMoe3NvdXJjZXMsIHN0YXRlcywgb2Zmc2V0fSksIG9mZnNldH07XG4gICAgfSBlbHNlIGlmIChzdGF0ZXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgc3RhdGUgPSB7dmFsdWU6dW5kZWZpbmVkLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgc3RhdGUgPSB7Li4uc3RhdGVzWzBdLCBvZmZzZXR9XG4gICAgfVxuICAgIGlmIChudW1lcmljICYmIHN0YXRlLnZhbHVlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoIWlzX2Zpbml0ZV9udW1iZXIoc3RhdGUudmFsdWUpKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IHt2YWx1ZTptYXNrLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzdGF0ZTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tfaXRlbXMoaXRlbXMpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIklucHV0IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgfVxuICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuICAgICAgICAvLyBtYWtlIHN1ZXIgaXRlbSBoYXMgaWRcbiAgICAgICAgaXRlbS5pZCA9IGl0ZW0uaWQgfHwgcmFuZG9tX3N0cmluZygxMCk7XG4gICAgICAgIC8vIG1ha2Ugc3VyZSBpdGVtIGludGVydmFscyBhcmUgd2VsbCBmb3JtZWRcbiAgICAgICAgaXRlbS5pdHYgPSBpbnRlcnZhbC5mcm9tX2lucHV0KGl0ZW0uaXR2KTtcbiAgICB9XG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiByYW5kb21fc3RyaW5nKGxlbmd0aCkge1xuICAgIHZhciB0ZXh0ID0gXCJcIjtcbiAgICB2YXIgcG9zc2libGUgPSBcIkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpcIjtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGV4dCArPSBwb3NzaWJsZS5jaGFyQXQoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogcG9zc2libGUubGVuZ3RoKSk7XG4gICAgfVxuICAgIHJldHVybiB0ZXh0O1xufVxuXG4vKipcbiAqIEltcHJvdmVkIHNldF90aW1lb3V0XG4gKiBcbiAqIFRpbWVvdXQgaXMgZGVmaW5lZCBieSBhIHRhcmdldF9tcyByZWFkaW5nIG9mIHBlcmZvcm1hbmNlLm5vdygpLlxuICogQ2FsbGJhY2sgaXMgbm90IGludm9rZWQgdW50aWwgcGVyZm9ybWFuY2Uubm93KCkgPj0gdGFyZ2V0X21zLiBcbiAqIFxuICogVGhpcyBwcm90ZWN0cyBhZ2FpbnN0IGEgd2Vha25lc3MgaW4gYmFzaWMgc2V0VGltZW91dCwgd2hpY2ggbWF5XG4gKiBvY2NhdGlvbmFsbHkgaW52b2tlIHRoZSBjYWxsYmFjayB0b28gZWFybHkuIFxuICogXG4gKiBzY2hlZHVsZSB0aW1lb3V0IDEgbXMgbGF0ZSwgdG8gcmVkdWNlIHRoZSBsaWtlbGlob29kIG9mIFxuICogaGF2aW5nIHRvIHJlc2NoZWR1bGUgYSB0aW1lb3V0IFxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0X3RpbWVvdXQgKGNhbGxiYWNrLCBkZWx0YV9tcykge1xuICAgIGxldCB0cyA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIGRlbHRhX21zID0gTWF0aC5tYXgoZGVsdGFfbXMsIDApO1xuICAgIGxldCB0YXJnZXRfbXMgPSB0cyArIGRlbHRhX21zO1xuICAgIGxldCB0aWQ7XG4gICAgZnVuY3Rpb24gY2FuY2VsX3RpbWVvdXQoKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aWQpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBoYW5kbGVfdGltZW91dCgpIHtcbiAgICAgICAgY29uc3QgZGVsdGFfbXMgPSB0YXJnZXRfbXMgLSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgaWYgKGRlbHRhX21zID4gMCkge1xuICAgICAgICAgICAgLy8gcmVzY2hlZHVsZSB0aW1lb3V0XG4gICAgICAgICAgICB0aWQgPSBzZXRUaW1lb3V0KGhhbmRsZV90aW1lb3V0LCBkZWx0YV9tcyArIDEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICB0aWQgPSBzZXRUaW1lb3V0KGhhbmRsZV90aW1lb3V0LCBkZWx0YV9tcyArIDEpO1xuICAgIHJldHVybiB7Y2FuY2VsOmNhbmNlbF90aW1lb3V0fTtcbn1cblxuLyoqXG4gKiAgSW1wbGVtZW50cyBkZXRlcm1pbmlzdGljIHByb2plY3Rpb24gYmFzZWQgb24gaW5pdGlhbCBjb25kaXRpb25zIFxuICogIC0gbW90aW9uIHZlY3RvciBkZXNjcmliZXMgbW90aW9uIHVuZGVyIGNvbnN0YW50IGFjY2VsZXJhdGlvblxuICpcbiAqICBtb3Rpb24gdHJhbnNpdGlvbiBcbiAqIFxuICogIHRyYW5zaXRpb24gZnJvbSB0aW1lIGRvbWFpbiB0byBwb3NpdGlvbiB1bmRlciBjb25zdGFudCBhY2NlbGVyYXRpb24gaXMgZ2l2ZW4gYnlcbiAqICBnaXZlbiBpbml0aWFsIHZlY3RvciBbcDAsdjAsYTAsdDBdXG4gKiAgcCh0KSA9IHAwICsgdjAqKHQtdDApICsgMC41KmEwKih0LXQwKSoodC10MClcbiAqICB2KHQpID0gdjAgKyBhMCoodC10MClcbiAqICBhKHQpID0gYTBcbiAqICB0KHQpID0gdFxuICovXG5leHBvcnQgZnVuY3Rpb24gbW90aW9uX2NhbGN1bGF0ZSh2ZWN0b3IsdCkge1xuICAgIGNvbnN0IFtwMCx2MCxhMCx0MF0gPSB2ZWN0b3I7XG4gICAgY29uc3QgZCA9IHQgLSB0MDtcbiAgICBjb25zdCBwID0gcDAgKyB2MCpkICsgMC41KmEwKk1hdGgucG93KGQsMik7XG4gICAgY29uc3QgdiA9IHYwICsgYTAqZDtcbiAgICBjb25zdCBhID0gYTA7XG4gICAgcmV0dXJuIFtwLHYsYSx0XTtcbn1cblxuLyoqXG4gKiBHaXZlbiBtb3Rpb24gZGV0ZXJtaW5lZCBmcm9tIFtwMCx2MCxhMCx0MF0uXG4gKiBHaXZlbiBlcXVhdGlvbiBwKHQpID0gcDAgKyB2MCoodC10MCkgKyAwLjUqYTAqKHQtdDApXjIgPT0gcDFcbiAqIENhbGN1bGF0ZSBpZiBlcXVhdGlvbiBoYXMgc29sdXRpb25zIGZvciBzb21lIHJlYWwgbnVtYmVyIHQuXG4gKiBBIHNvbHV0aW9uIGV4aXN0cyBpZiBkZXRlcm1pbmFudCBvZiBxdWFkcmF0aWMgZXF1YXRpb24gaXMgbm9uLW5lZ2F0aXZlXG4gKiAodjBeMiAtIDJhMChwMC1wMSkpID49IDBcbiAqL1xuZnVuY3Rpb24gbW90aW9uX2hhc19yZWFsX3NvbHV0aW9ucyh2ZWN0b3IsIHAxKSB7XG4gICAgY29uc3QgW3AwLHYwLGEwLHQwXSA9IHZlY3RvcjtcbiAgICByZXR1cm4gKE1hdGgucG93KHYwLDIpIC0gMiphMCoocDAtcDEpKSA+PSAwLjBcbn07XG5cbi8qKlxuICogR2l2ZW4gbW90aW9uIGRldGVybWluZWQgZnJvbSBbcDAsdjAsYTAsdDBdLlxuICogR2l2ZW4gZXF1YXRpb24gcCh0KSA9IHAwICsgdjAqKHQtdDApICsgMC41KmEwKih0LXQwKV4yID09IHAxXG4gKiBDYWxjdWxhdGUgYW5kIHJldHVybiByZWFsIHNvbHV0aW9ucywgaW4gYXNjZW5kaW5nIG9yZGVyLlxuKi8gIFxuZnVuY3Rpb24gbW90aW9uX2dldF9yZWFsX3NvbHV0aW9ucyAodmVjdG9yLCBwMSkge1xuICAgIGNvbnN0IFtwMCx2MCxhMCx0MF0gPSB2ZWN0b3I7XG4gICAgLy8gQ29uc3RhbnQgUG9zaXRpb25cbiAgICBpZiAoYTAgPT09IDAuMCAmJiB2MCA9PT0gMC4wKSB7XG4gICAgICAgIGlmIChwMCAhPSBwMSkgcmV0dXJuIFtdO1xuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIGFueSB0IGlzIGEgc29sdXRpb25cbiAgICAgICAgICAgIC8vIE5PVEU6IGhhcyByZWFsIHNvbHV0aW9ucyBpcyB0cnVlXG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9O1xuICAgIH1cbiAgICAvLyBDb25zdGFudCBub24temVybyBWZWxvY2l0eVxuICAgIGlmIChhMCA9PT0gMC4wKSByZXR1cm4gW3QwICsgKHAxLXAwKS92MF07XG4gICAgLy8gQ29uc3RhbnQgQWNjZWxlcmF0aW9uXG4gICAgaWYgKG1vdGlvbl9oYXNfcmVhbF9zb2x1dGlvbnModmVjdG9yLCBwMSkgPT09IGZhbHNlKSByZXR1cm4gW107XG4gICAgLy8gRXhhY3RseSBvbiBzb2x1dGlvblxuICAgIHZhciBkaXNjcmltaW5hbnQgPSBNYXRoLnBvdyh2MCwyKSAtIDIqYTAqKHAwLXAxKTtcbiAgICBpZiAoZGlzY3JpbWluYW50ID09PSAwLjApIHtcbiAgICAgICAgcmV0dXJuIFt0MC12MC9hMF07XG4gICAgfVxuICAgIHZhciBzcXJ0ID0gTWF0aC5zcXJ0KE1hdGgucG93KHYwLDIpIC0gMiphMCoocDAtcDEpKTtcbiAgICB2YXIgZDEgPSB0MCArICgtdjAgKyBzcXJ0KS9hMDtcbiAgICB2YXIgZDIgPSB0MCArICgtdjAgLSBzcXJ0KS9hMDtcbiAgICByZXR1cm4gW01hdGgubWluKGQxLGQyKSxNYXRoLm1heChkMSxkMildO1xufTtcblxuLypcbiAgICBjYWxjdWxhdGUgdGltZSByYW5nZSBmb3IgZ2l2ZW4gcG9zaXRpb24gcmFuZ2VcblxuICAgIG1vdGlvbiB0cmFuc2l0aW9uIGZyb20gdGltZSB0byBwb3NpdGlvbiBpcyBnaXZlbiBieVxuICAgIHAodCkgPSBwMCArIHYqdCArIDAuNSphKnQqdFxuICAgIGZpbmQgc29sdXRpb25zIGZvciB0IHNvIHRoYXQgXG4gICAgcCh0KSA9IHBvc1xuXG4gICAgZG8gdGhpcyBmb3IgYm90aCB2YWx1ZXMgaW4gcmFuZ2UgW2xvdyxoaWdoXVxuICAgIGFjY3VtdWxhdGUgYWxsIGNhbmRpZGF0ZSBzb2x1dGlvbnMgdCBpbiBhc2NlbmRpbmcgb3JkZXJcbiAgICBhdm9pZCBkdXBsaWNhdGVzXG4gICAgdGhpcyBjYW4gYWNjdW11bGF0ZSAwLDEsMiwzLDQgc29sdXRpb25cbiAgICBpZiAwIHNvbHV0aW9ucyAtIHVuZGVmaW5lZCAobW90aW9uIGRvZXMgbm90IGludGVyc2VjdCB3aXRoIHJhbmdlIGV2ZXIpIFxuICAgIGlmIDEgc29sdXRpb25zIC0gdWRlZmluZWQgKG1vdGlvbiBvbmx5IGludGVyc2VjdHMgd2l0aCByYW5nZSB0YW5nZW50aWFsbHkgYXQgb25lIHQpXG4gICAgaWYgMiBzb2x1dGlvbnMgLSBbMCwxXSAobW90aW9uIGludGVyc2VjdHMgd2l0aCByYW5nZSBhdCB0d28gdGltZXMpXG4gICAgaWYgMyBzb2x1dGlvbnMgLSBbMCwyXSAobW90aW9uIGludGVyc2VjdHMgd2l0aCByYW5nZSBhdCB0aHJlZSB0aW1lcylcbiAgICBpZiA0IHNvbHV0aW9ucyAtIFswLDFdIGFuZCBbMiwzXVxuXG4gICAgcmV0dXJucyBhIGxpc3Qgb2YgcmFuZ2UgY2FuZGlkYXRlcyAoYXQgbW9zdCB0d28gYnV0IG9ubHkgd2l0aCBhY2NlbGVyYXRpb24pXG4qL1xuZnVuY3Rpb24gbW90aW9uX2NhbGN1bGF0ZV90aW1lX3Jhbmdlcyh2ZWN0b3IsIHBvc19yYW5nZSkge1xuICAgIGNvbnN0IFtwMCx2MCxhMCx0MF0gPSB2ZWN0b3I7XG4gICAgbGV0IFtsb3csIGhpZ2hdID0gcG9zX3JhbmdlO1xuICAgIGlmIChsb3cgPT0gbnVsbCkgbG93ID0gLUluZmluaXR5O1xuICAgIGlmIChoaWdoID09IG51bGwpIGhpZ2ggPSBJbmZpbml0eTtcblxuICAgIC8vIFs8LSwgLT5dXG4gICAgaWYgKGxvdyA9PSAtSW5maW5pdHkgJiYgaGlnaCA9PSBJbmZpbml0eSkge1xuICAgICAgICAvLyBubyBwb3MgcmFuZ2UgPT0gZW50aXJlIHZhbHVlIHNwYWNlID0+IHRpbWUgcmFuZ2UgZW50aXJlIHRpbWVsaW5lXG4gICAgICAgIHJldHVybiBbW251bGwsIG51bGxdXTtcbiAgICB9IFxuXG4gICAgLy8gW0ZMQVQgTElORV1cbiAgICAvLyBwb3MgaXMgZWl0aGVyIHdpdGhpbiBwb3MgcmFuZ2UgZm9yIGFsbCB0IG9yIG5ldmVyICBcbiAgICBpZiAodjAgPT09IDAuMCAmJiBhMCA9PT0gMC4wKSB7XG4gICAgICAgIC8vIGJvdGggbG93IGFuZCBoaWdoIGJvdW5kXG4gICAgICAgIHJldHVybiAocDAgPj0gbG93ICYmIHAwIDw9IGhpZ2gpID8gW1tudWxsLCBudWxsXV0gOiBbXTtcbiAgICB9XG5cbiAgICAvLyBhZ2dyZWdhdGUgc29sdXRpb25zXG4gICAgbGV0IHNvbHV0aW9ucyA9IFtdO1xuICAgIGlmICgtSW5maW5pdHkgPCBsb3cpIHtcbiAgICAgICAgc29sdXRpb25zLnB1c2goLi4ubW90aW9uX2dldF9yZWFsX3NvbHV0aW9ucyh2ZWN0b3IsIGxvdykpO1xuICAgIH0gXG4gICAgaWYgKGhpZ2ggPCBJbmZpbml0eSkge1xuICAgICAgICBzb2x1dGlvbnMucHVzaCguLi5tb3Rpb25fZ2V0X3JlYWxfc29sdXRpb25zKHZlY3RvciwgaGlnaCkpO1xuICAgIH1cbiAgICAvLyByZW1vdmUgZHVwbGljYXRlc1xuICAgIHNvbHV0aW9ucyA9IFsuLi5uZXcgU2V0KHNvbHV0aW9ucyldO1xuICAgIC8vIHNvcnQgaW4gYXNjZW5kaW5nIG9yZGVyXG4gICAgc29sdXRpb25zLnNvcnQoKGEsYikgPT4gYS1iKTtcblxuICAgIC8vIFs8LSwgSElHSF1cbiAgICBpZiAobG93ID09IC1JbmZpbml0eSkge1xuICAgICAgICAvLyBvbmx5IGhpZ2ggYm91bmRcbiAgICAgICAgaWYgKHNvbHV0aW9ucy5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgLy8gcGFyYWJvbGEgbm90IHRvdWNoaW5nIGxvd1xuICAgICAgICAgICAgLy8gcG9zIDwgaGlnaCBvciBwb3MgPiBoaWdoIGZvciBhbGwgdCAtIGp1c3QgdGVzdCB3aXRoIHQwXG4gICAgICAgICAgICByZXR1cm4gKHAwIDw9IGhpZ2gpID8gW1tudWxsLCBudWxsXV0gOiBbXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgIGlmIChhMCA+IDAuMCkge1xuICAgICAgICAgICAgICAgIC8vIHBhcmFib2xhIC0gdG91Y2hpbmcgaGlnaCBmcm9tIG92ZXJzaWRlXG4gICAgICAgICAgICAgICAgLy8gcG9zID4gaGlnaCBmb3IgYWxsIHRcbiAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGEwIDwgMC4wKSB7XG4gICAgICAgICAgICAgICAgLy8gcGFyYWJvbGEgdG91Y2hpbmcgbG93IGZyb20gdW5kZXJzaWRlXG4gICAgICAgICAgICAgICAgLy8gcG9zIDwgaGlnaCBmb3IgYWxsIHRcbiAgICAgICAgICAgICAgICByZXR1cm4gW1tudWxsLCBudWxsXV07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGEwID09IDAuMCA+IHN0cmFpZ3RoIGxpbmVcbiAgICAgICAgICAgICAgICBpZiAodjAgPiAwLjApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcG9zIDw9IGhpZ2ggZm9yIGFsbCB0IDw9IHNvbHV0aW9uc1swXVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW1tudWxsLCBzb2x1dGlvbnNbMF1dXTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBwb3MgPD0gaGlnaCBmb3IgdCA+PSBzb2x1dGlvbnNbMF1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtbc29sdXRpb25zWzBdLCBudWxsXV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHNvbHV0aW9ucy5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgLy8gcGFyYWJvbGFcbiAgICAgICAgICAgIGlmIChhMCA+IDAuMCkge1xuICAgICAgICAgICAgICAgIC8vIG9uZSB0aW1lIHJhbmdlIGJldHdlZW4gc29sdXRpb25zXG4gICAgICAgICAgICAgICAgcmV0dXJuIFtbc29sdXRpb25zWzBdLCBzb2x1dGlvbnNbMV1dXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYTAgPCAwLjApIHtcbiAgICAgICAgICAgICAgICAvLyBvbmUgdGltZSByYW5nZSBvbiBlYWNoIHNpZGUgXG4gICAgICAgICAgICAgICAgcmV0dXJuIFtbbnVsbCwgc29sdXRpb25zWzBdXSwgW3NvbHV0aW9uc1sxXSwgbnVsbF1dO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgIC8vIFtMT1csIC0+XVxuICAgIH0gZWxzZSBpZiAoaGlnaCA9PSBJbmZpbml0eSkge1xuICAgICAgICAvLyBvbmx5IGxvdyBib3VuZFxuICAgICAgICBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAvLyBwYXJhYm9sYSBub3QgdG91Y2hpbmcgbG93XG4gICAgICAgICAgICAvLyBwb3MgPiBsb3cgb3IgcG9zIDwgbG93IGZvciBhbGwgdCAtIGp1c3QgdGVzdCB3aXRoIHQwXG4gICAgICAgICAgICByZXR1cm4gKHAwID49IGxvdykgPyBbW251bGwsIG51bGxdXSA6IFtdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNvbHV0aW9ucy5sZW5ndGggPT0gMSkge1xuICAgICAgICAgICAgaWYgKGEwID4gMC4wKSB7XG4gICAgICAgICAgICAgICAgLy8gcGFyYWJvbGEgLSB0b3VjaGluZyBsb3cgZnJvbSBvdmVyc2lkZVxuICAgICAgICAgICAgICAgIC8vIHBvcyA+IGxvdyBmb3IgYWxsIHRcbiAgICAgICAgICAgICAgICByZXR1cm4gW1tudWxsLCBudWxsXV07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGEwIDwgMC4wKSB7XG4gICAgICAgICAgICAgICAgLy8gcGFyYWJvbGEgdG91Y2hpbmcgbG93IGZyb20gdW5kZXJzaWRlXG4gICAgICAgICAgICAgICAgLy8gcG9zIDwgbG93IGZvciBhbGwgdFxuICAgICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gYTAgPT0gMC4wID4gc3RyYWlndGggbGluZVxuICAgICAgICAgICAgICAgIGlmICh2MCA+IDAuMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBwb3MgPj0gbG93IGZvciBhbGwgdCA+PSBzb2x1dGlvbnNbMF1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtbc29sdXRpb25zWzBdLCBudWxsXV07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcG9zID49IGxvdyBmb3IgdCA8PSBzb2x1dGlvbnNbMF1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtbbnVsbCwgc29sdXRpb25zWzBdXV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHNvbHV0aW9ucy5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgLy8gcGFyYWJvbGFcbiAgICAgICAgICAgIGlmIChhMCA+IDAuMCkge1xuICAgICAgICAgICAgICAgIC8vIG9uZSB0aW1lIHJhbmdlIG9uIGVhY2ggc2lkZSBcbiAgICAgICAgICAgICAgICByZXR1cm4gW1tudWxsLCBzb2x1dGlvbnNbMF1dLCBbc29sdXRpb25zWzFdLCBudWxsXV07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGEwIDwgMC4wKSB7XG4gICAgICAgICAgICAgICAgLy8gb25lIHRpbWUgcmFuZ2UgYmV0d2VlbiBzb2x1dGlvbnNcbiAgICAgICAgICAgICAgICByZXR1cm4gW1tzb2x1dGlvbnNbMF0sIHNvbHV0aW9uc1sxXV1dO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAvLyBbTE9XLCBISUdIXVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGJvdGggbG93IGFuZCBoaWdoIGJvdW5kXG4gICAgICAgIGlmIChzb2x1dGlvbnMubGVuZ3RoID09IDApIHJldHVybiBbXTtcbiAgICAgICAgaWYgKHNvbHV0aW9ucy5sZW5ndGggPT0gMSkgcmV0dXJuIFtdO1xuICAgICAgICBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAyKSByZXR1cm4gW1tzb2x1dGlvbnNbMF0sIHNvbHV0aW9uc1sxXV1dO1xuICAgICAgICBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSAzKSByZXR1cm4gW1tzb2x1dGlvbnNbMF0sIHNvbHV0aW9uc1syXV1dO1xuICAgICAgICBpZiAoc29sdXRpb25zLmxlbmd0aCA9PSA0KSByZXR1cm4gW1tzb2x1dGlvbnNbMF0sIHNvbHV0aW9uc1sxXV0sIFtzb2x1dGlvbnNbMl0sIHNvbHV0aW9uc1szXV1dO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gbW90aW9uX2NoZWNrX3JhbmdlKG9iaikge1xuICAgIGlmIChBcnJheS5pc0FycmF5KG9iaikgJiYgb2JqLmxlbmd0aCAhPSAyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgcmFuZ2UgbXVzdCBoYXZlIHR3byBlbGVtZW50cyAke29ian1gKTtcbiAgICB9XG4gICAgb2JqWzBdID09IG51bGwgfHwgY2hlY2tfbnVtYmVyKFwibG93XCIsIG9ialswXSk7XG4gICAgb2JqWzFdID09IG51bGwgfHwgY2hlY2tfbnVtYmVyKFwiaGlnaFwiLCBvYmpbMV0pO1xufVxuXG5leHBvcnQgY29uc3QgbW90aW9uX3V0aWxzID0ge1xuICAgIGNhbGN1bGF0ZTogbW90aW9uX2NhbGN1bGF0ZSxcbiAgICBoYXNfcmVhbF9zb2x1dGlvbnM6IG1vdGlvbl9oYXNfcmVhbF9zb2x1dGlvbnMsXG4gICAgZ2V0X3JlYWxfc29sdXRpb25zOiBtb3Rpb25fZ2V0X3JlYWxfc29sdXRpb25zLFxuICAgIGNhbGN1bGF0ZV90aW1lX3JhbmdlczogbW90aW9uX2NhbGN1bGF0ZV90aW1lX3JhbmdlcyxcbiAgICBjaGVja19yYW5nZTogbW90aW9uX2NoZWNrX3JhbmdlXG59XG4iLCJpbXBvcnQgKiBhcyBldmVudGlmeSBmcm9tIFwiLi91dGlsL2FwaV9ldmVudGlmeS5qc1wiO1xuaW1wb3J0ICogYXMgY2FsbGJhY2sgZnJvbSBcIi4vdXRpbC9hcGlfY2FsbGJhY2suanNcIjtcbmltcG9ydCB7IGludGVydmFsIH0gZnJvbSBcIi4vdXRpbC9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IHJhbmdlLCB0b1N0YXRlIH0gZnJvbSBcIi4vdXRpbC9jb21tb24uanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTEFZRVJcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogTGF5ZXIgaXMgYWJzdHJhY3QgYmFzZSBjbGFzcyBmb3IgTGF5ZXJzXG4gKiBcbiAqIExheWVyIGludGVyZmFjZSBpcyBkZWZpbmVkIGJ5IChpbmRleCwgQ2FjaGVDbGFzcywgb3B0aW9ucylcbiAqIFxuICogQ2FjaGVDbGFzc1xuICogLS0tLS0tLS0tLVxuICogVGhlIENhY2hlQ2xhc3MgaW1wbGVtZW50cyB0aGUgcXVlcnkgb3BlcmF0aW9uIGZvciB0aGUgbGF5ZXIsIHVzaW5nXG4gKiB0aGUgaW5kZXggZm9yIGxvb2t1cHMgb24gY2FjaGUgbWlzcy4gTGF5ZXIgaGFzIGEgcHJpdmF0ZSBjYWNoZS4gXG4gKiBBZGRpdGlvbmFsbHksIGlmIGxheWVyIGhhcyBtdWx0aXBsZSBjb25zdW1lcnMsIHRoZXkgY2FuIGVhY2ggXG4gKiBjcmVhdGUgdGhlaXIgb3duIHByaXZhdGUgY2FjaGUuIFxuICogXG4gKiBvcHRpb25zXG4gKiAtLS0tLS0tXG4gKiBUaGUgdGhlIHJlc3VsdCBmcm9tIHRoZSBxdWVyeSBvcGVyYXRpb24gY2FuIGJlIGNvbnRyb2xsZWQgYnkgc3VwcGx5aW5nXG4gKiBvcHRpb25hbCBjdXN0b20gZnVuY3Rpb24sIGVpdGhlciB2YWx1ZUZ1bmMgb3IgYSBzdGF0ZUZ1bmMgXG4gKiB7dmFsdWVGdW5jLHN0YXRlRnVuY31cbiAqIFxuICogaW5kZXhcbiAqIC0tLS0tXG4gKiBUaGUgbmVhcmJ5IGluZGV4IGlzIHN1cHBsaWVkIGJ5IExheWVyIGltcGxlbWVudGF0aW9ucywgZWl0aGVyIGJ5IFxuICogc3ViY2xhc3NpbmcgaXQsIG9yIGJ5IGFzc2lnbmluZyB0aGUgaW5kZXguIFxuICovXG5cbmV4cG9ydCBjbGFzcyBMYXllciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG5cbiAgICAgICAgY29uc3Qge1xuICAgICAgICAgICAgQ2FjaGVDbGFzcz1MYXllckNhY2hlLCBcbiAgICAgICAgICAgIHZhbHVlRnVuYz11bmRlZmluZWQsXG4gICAgICAgICAgICBzdGF0ZUZ1bmM9dW5kZWZpbmVkLFxuICAgICAgICB9ID0gb3B0aW9uczsgXG5cbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGNhbGxiYWNrLmFkZFN0YXRlKHRoaXMpO1xuICAgICAgICAvLyBkZWZpbmUgY2hhbmdlIGV2ZW50XG4gICAgICAgIGV2ZW50aWZ5LmFkZFN0YXRlKHRoaXMpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OmZhbHNlfSk7XG5cbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgdGhpcy5pbmRleDtcblxuICAgICAgICAvLyBjYWNoZVxuICAgICAgICB0aGlzLl9DYWNoZUNsYXNzID0gQ2FjaGVDbGFzcztcbiAgICAgICAgdGhpcy5fcHJpdmF0ZV9jYWNoZTtcbiAgICAgICAgdGhpcy5fY29uc3VtZXJfY2FjaGVzID0gW107XG5cbiAgICAgICAgLy8gcHJvcGVydGllc1xuICAgICAgICB0aGlzLl92YWx1ZUZ1bmMgPSB2YWx1ZUZ1bmM7XG4gICAgICAgIHRoaXMuX3N0YXRlRnVuYyA9IHN0YXRlRnVuYztcbiAgICB9XG5cbiAgICAvLyByZXN0cmljdGlvbnMgKGRlZmF1bHRzKVxuICAgIGdldCBudW1lcmljICgpIHtyZXR1cm4gZmFsc2U7fVxuICAgIGdldCBtdXRhYmxlICgpIHtyZXR1cm4gZmFsc2U7fVxuICAgIGdldCBpdGVtc09ubHkgKCkge3JldHVybiBmYWxzZTt9XG5cbiAgICAvLyBxdWVyeSBvcHRpb25zXG4gICAgZ2V0IHZhbHVlRnVuYyAoKSB7cmV0dXJuIHRoaXMuX3ZhbHVlRnVuYzt9XG4gICAgZ2V0IHN0YXRlRnVuYyAoKSB7cmV0dXJuIHRoaXMuX3N0YXRlRnVuYzt9XG5cbiAgICAvLyBwcml2YXRlIGNhY2hlXG4gICAgZ2V0IGNhY2hlICgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3ByaXZhdGVfY2FjaGUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9wcml2YXRlX2NhY2hlID0gbmV3IHRoaXMuX0NhY2hlQ2xhc3ModGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByaXZhdGVfY2FjaGU7XG4gICAgfVxuXG4gICAgLy8gaW52b2tlZCBieSBsYXllciBjb25zdW1lclxuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIC8vIGludm9rZWQgYnkgbGF5ZXIgY29uc3VtZXJcbiAgICBjcmVhdGVDYWNoZSAoKSB7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gbmV3IHRoaXMuX0NhY2hlQ2xhc3ModGhpcyk7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVyX2NhY2hlcy5wdXNoKGNhY2hlKTtcbiAgICAgICAgcmV0dXJuIGNhY2hlO1xuICAgIH1cbiAgICByZWxlYXNlQ2FjaGUgKGNhY2hlKSB7XG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuX2NvbnN1bWVyX2NhY2hlcy5pbmRleE9mKGNhY2hlKTtcbiAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICB0aGlzLl9jb25zdW1lcl9jYWNoZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgY2xlYXJDYWNoZXMoKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2FjaGUgb2YgdGhpcy5fY29uc3VtZXJfY2FjaGVzKXtcbiAgICAgICAgICAgIGNhY2hlLmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX3ByaXZhdGVfY2FjaGUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9wcml2YXRlX2NhY2hlLmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpbnZva2VkIGJ5IHN1YmNsYXNzIHdoZW5ldmVyIGxheWVyIGhhcyBjaGFuZ2VkXG4gICAgb25jaGFuZ2UoKSB7XG4gICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIpOyAgICBcbiAgICB9XG5cbiAgICAvLyBpdGVyYXRvciBmb3IgcmVnaW9ucyBvZiB0aGUgbGF5ZXIgaW5kZXhcbiAgICByZWdpb25zIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluZGV4LnJlZ2lvbnMob3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgU2FtcGxlIGxheWVyIHZhbHVlcyBieSB0aW1lbGluZSBvZmZzZXQgaW5jcmVtZW50c1xuICAgICAgICByZXR1cm4gbGlzdCBvZiB0dXBsZXMgW3ZhbHVlLCBvZmZzZXRdXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICAgLSBzdGFydFxuICAgICAgICAtIHN0b3BcbiAgICAgICAgLSBzdGVwXG5cbiAgICAgICAgVE9ETyAtIHRoaXMgc2hvdWxkIGJlIGFuIGl0ZXJhdG9yXG4gICAgKi9cbiAgICBzYW1wbGUob3B0aW9ucz17fSkge1xuICAgICAgICBpZiAodGhpcy5pbmRleC5lbXB0eSgpKSB7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHtzdGFydCwgc3RvcCwgc3RlcD0xfSA9IG9wdGlvbnM7XG4gICAgICAgIFxuICAgICAgICBpZiAoc3RhcnQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiBpbmRleC5maXJzdCBpcyBhIG51bWJlclxuICAgICAgICAgICAgY29uc3QgZmlyc3QgPSB0aGlzLmluZGV4LmZpcnN0KCk7XG4gICAgICAgICAgICBpZiAoZmlyc3RbMF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHN0YXJ0ID0gZmlyc3RbMF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInVuZGVmaW5lZCBzdGFydFwiKTtcbiAgICAgICAgICAgIH0gICAgXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0b3AgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiBpbmRleC5sYXN0IGlzIGEgbnVtYmVyXG4gICAgICAgICAgICBjb25zdCBsYXN0ID0gdGhpcy5pbmRleC5sYXN0KCk7XG4gICAgICAgICAgICBpZiAobGFzdFswXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgc3RvcCA9IGxhc3RbMF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInVuZGVmaW5lZCBzdG9wXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzdGFydCA+IHN0b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciAoXCJzdG9wIG11c3QgYmUgbGFyZ2VyIHRoYW4gc3RhcnRcIiwgc3RhcnQsIHN0b3ApXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmNyZWF0ZUNhY2hlKCk7XG4gICAgICAgIGNvbnN0IHNhbXBsZXMgPSByYW5nZShzdGFydCwgc3RvcCwgc3RlcCwge2luY2x1ZGVfZW5kOnRydWV9KVxuICAgICAgICAgICAgLm1hcCgob2Zmc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtjYWNoZS5xdWVyeShvZmZzZXQpLnZhbHVlLCBvZmZzZXRdO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmVsZWFzZUNhY2hlKGNhY2hlKTtcbiAgICAgICAgcmV0dXJuIHNhbXBsZXM7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkTWV0aG9kcyhMYXllci5wcm90b3R5cGUpO1xuZXZlbnRpZnkuYWRkTWV0aG9kcyhMYXllci5wcm90b3R5cGUpO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExBWUVSIENBQ0hFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIExheWVyIENhY2hlIGlzIHRoZSByZWd1bGFyIGNhY2hlIHR5cGUsIGludGVuZGVkIGZvclxuICogX2Rlcml2ZWRfIExheWVycyAtIHRoYXQgaXMgYSBsYXllcnMgd2hpY2ggaW5kZXggcmVmZXJlbmNlc1xuICogb3RoZXIgc291cmNlIGxheWVycy5cbiAqIFxuICogQSBxdWVyeSBpcyByZXNvbHZlZCBieSBpZGVudGlmeWluZyB0aGUgcmVsZXZhbnQgcmVnaW9uIGluXG4gKiB0aGUgbmVhcmJ5IGluZGV4IChpbmRleC5uZWFyYnkob2Zmc2V0KSksIGFuZCB0aGVuIHF1ZXJ5aW5nIFxuICogdGhlIHN0YXRlIG9mIGFsbCB0aGUgb2JqZWN0cyBmb3VuZCBpbiB0aGUgcmVnaW9uIChuZWFyYnkuY2VudGVyKS5cbiAqICBcbiAqIE9wdGlvbnMge3ZhbHVlRnVuYyBvciBzdGF0ZUZ1bmN9IGFyZSB1c2VkIHRvIGNvbXB1dGUgYSBcbiAqIHNpbmdsZSBxdWVyeSByZXN1bHQgZnJvbSB0aGUgbGlzdCBvZiBzdGF0ZXMuXG4gKiBcbiAqIFRoZSByZXN1bHQgc3RhdGUgaXMgb25seSBjYWNoZWQgaWYgaXQgaXMgc3RhdGljLlxuICogQ2FjaGUgbWlzcyBpcyB0cmlnZ2VyZWQgaWYgbm8gc3RhdGUgaGFzIGJlZW4gY2FjaGVkLCBvciBpZiBcbiAqIG9mZnNldCBpcyBvdXRzaWRlIHRoZSByZWdpb24gb2YgdGhlIGNhY2hlZCBzdGF0ZS5cbiAqIFxuICovXG5cbmV4cG9ydCBjbGFzcyBMYXllckNhY2hlIHtcblxuICAgIGNvbnN0cnVjdG9yKGxheWVyKSB7XG4gICAgICAgIC8vIGNhY2hlIGJlbG9uZ3MgdG8gbGF5ZXJcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgLy8gY2FjaGVkIG5lYXJieSBzdGF0ZVxuICAgICAgICB0aGlzLl9uZWFyYnk7XG4gICAgICAgIC8vIGNhY2hlZCBzdGF0ZVxuICAgICAgICB0aGlzLl9zdGF0ZTtcbiAgICAgICAgLy8gcXVlcnkgb3B0aW9uc1xuICAgICAgICB0aGlzLl9xdWVyeV9vcHRpb25zID0ge1xuICAgICAgICAgICAgdmFsdWVGdW5jOiB0aGlzLl9sYXllci52YWx1ZUZ1bmMsXG4gICAgICAgICAgICBzdGF0ZUZ1bmM6IHRoaXMuX2xheWVyLnN0YXRlRnVuYyxcbiAgICAgICAgICAgIG51bWJlck9ubHk6IHRoaXMuX2xheWVyLmlzTnVtYmVyT25seSxcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBnZXQgbGF5ZXIoKSB7cmV0dXJuIHRoaXMuX2xheWVyfTtcblxuICAgIC8qKlxuICAgICAqIHF1ZXJ5IGNhY2hlXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IG5lZWRfaW5kZXhfbG9va3VwID0gKFxuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgIWludGVydmFsLmNvdmVyc19lbmRwb2ludCh0aGlzLl9uZWFyYnkuaXR2LCBvZmZzZXQpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICFuZWVkX2luZGV4X2xvb2t1cCAmJiBcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlICE9IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgIXRoaXMuX3N0YXRlLmR5bmFtaWNcbiAgICAgICAgKSB7XG4gICAgICAgICAgICAvLyBjYWNoZSBoaXRcbiAgICAgICAgICAgIHJldHVybiB7Li4udGhpcy5fc3RhdGUsIG9mZnNldH07XG4gICAgICAgIH1cbiAgICAgICAgLy8gY2FjaGUgbWlzc1xuICAgICAgICBpZiAobmVlZF9pbmRleF9sb29rdXApIHtcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICB9XG4gICAgICAgIC8vIHBlcmZvcm0gcXVlcmllc1xuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9uZWFyYnkuY2VudGVyLm1hcCgoY2FjaGUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBjYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gY2FsY3VsYXRlIHNpbmdsZSByZXN1bHQgc3RhdGVcbiAgICAgICAgY29uc3Qgc3RhdGUgPSB0b1N0YXRlKHRoaXMuX25lYXJieS5jZW50ZXIsIHN0YXRlcywgb2Zmc2V0LCB0aGlzLl9xdWVyeV9vcHRpb25zKTtcbiAgICAgICAgLy8gY2FjaGUgc3RhdGUgb25seSBpZiBub3QgZHluYW1pY1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IChzdGF0ZS5keW5hbWljKSA/IHVuZGVmaW5lZCA6IHN0YXRlO1xuICAgICAgICByZXR1cm4gc3RhdGUgICAgXG4gICAgfVxuXG4gICAgY2xlYXIoKSB7XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG4iLCJpbXBvcnQgeyBsb2NhbF9jbG9jayB9IGZyb20gXCIuL2NvbW1vbi5qc1wiO1xuXG4vKipcbiAqIHBvbGxpbmcgYSBjYWxsYmFjayBmdW5jdGlvbiBwZXJpb2RpY2FsbHkgd2l0aCBcbiAqIGEgZml4ZWQgZGVsYXkgKG1zKS5cbiAqIElmIGRlbGF5IGlzIDAsIHVzZSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXG4gKiBlbHNlIHVzZSBzZXRUaW1lb3V0LlxuICogRGVsYXkgY2FuIGJlIHNldCBkeW5hbWljYWxseS4gUGF1c2UgYW5kIHJlc3VtZVxuICogaXMgbmVlZGVkIGZvciBuZXcgZGVsYXkgdG8gdGFrZSBlZmZlY3QuXG4gKi9cblxuY2xhc3MgUG9sbGVyIHtcblxuICAgIGNvbnN0cnVjdG9yKGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuX2NhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgICAgIHRoaXMuX2hhbmRsZTtcbiAgICAgICAgdGhpcy5fZGVsYXk7XG4gICAgfVxuICAgIFxuICAgIHNldCBkZWxheSAoZGVsYXlfbXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBkZWxheV9tcyAhPSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGRlbGF5IG11c3QgYmUgYSBudW1iZXIgJHtkZWxheV9tc31gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fZGVsYXkgIT0gZGVsYXlfbXMpIHsgICBcbiAgICAgICAgICAgIHRoaXMuX2RlbGF5ID0gZGVsYXlfbXM7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZ2V0IGRlbGF5ICgpIHtyZXR1cm4gdGhpcy5fZGVsYXk7fVxuXG4gICAgaXNfcG9sbGluZyAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oYW5kbGUgIT0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHBhdXNlKCkge1xuICAgICAgICBpZiAodGhpcy5faGFuZGxlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlLmNhbmNlbCgpO1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcG9sbCgpIHtcbiAgICAgICAgLy8gcG9sbCBjYWxsYmFja1xuICAgICAgICB0aGlzLl9jYWxsYmFjaygpO1xuICAgICAgICAvLyBzY2hlZHVsZSBuZXh0IHBvbGxcbiAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgICB0aGlzLnJlc3VtZSgpO1xuICAgIH1cblxuICAgIHJlc3VtZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2hhbmRsZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9kZWxheSA9PSAwKSB7XG4gICAgICAgICAgICAgICAgLy8gZnJhbWVyYXRlXG4gICAgICAgICAgICAgICAgY29uc3QgYWlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMucG9sbC5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGUgPSB7Y2FuY2VsOiAoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShhaWQpfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gdGltZW91dFxuICAgICAgICAgICAgICAgIGNvbnN0IHRpZCA9IHNldFRpbWVvdXQodGhpcy5wb2xsLmJpbmQodGhpcyksIHRoaXMuX2RlbGF5KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYW5kbGUgPSB7Y2FuY2VsOiAoKSA9PiBjbGVhclRpbWVvdXQodGlkKX07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogQ3Vyc29yIE1vbml0b3JcbiAqL1xuXG5jbGFzcyBDdXJzb3JNb25pdG9yIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgLypcbiAgICAgICAgICAgIHNldCBvZiBiaW5kaW5nc1xuICAgICAgICAgICAgcG9sbCBjdXJzb3IgKHdoZW4gZHluYW1pYykgcGVyaW9kaWNhbGx5IHdpdGggZ2l2ZW4gKG1pbmltdW0pIGRlbGF5LCBhbmQgaW52b2tlIGNhbGxiYWNrIHdpdGggY3Vyc29yIHN0YXRlIFxuICAgICAgICAgICAgYmluZGluZyA6IHtjdXJzb3IsIGNhbGxiYWNrLCBkZWxheV9tc31cbiAgICAgICAgICAgIC0gY3Vyc29yOlxuICAgICAgICAgICAgLSBjYWxsYmFjazogZnVuY3Rpb24oc3RhdGUpXG4gICAgICAgICAgICAtIGRlbGF5OiAobXMpIGJldHdlZW4gc2FtcGxlcyAod2hlbiB2YXJpYWJsZSBpcyBkeW5hbWljKVxuICAgICAgICAgICAgdGhlcmUgY2FuIGJlIG11bHRpcGxlIGJpbmRpbmdzIGZvciB0aGUgc2FtZSBjdXJzb3JcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmluZGluZ19zZXQgPSBuZXcgU2V0KCk7XG5cbiAgICAgICAgLypcbiAgICAgICAgICAgIGN1cnNvcnNcbiAgICAgICAgICAgIG1hcDogY3Vyc29yIC0+IHtzdWIsIHBvbGxpbmcsIGJpbmRpbmdzOltdfVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jdXJzb3JfbWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIC8vIFBvbGxlclxuICAgICAgICB0aGlzLl9wb2xsZXIgPSBuZXcgUG9sbGVyKHRoaXMub25wb2xsLmJpbmQodGhpcykpO1xuICAgIH1cblxuICAgIGJpbmQoY3Vyc29yLCBjYWxsYmFjaywgZGVsYXkpIHtcbiAgICAgICAgLy8gY2hlY2sgZGVsYXlcbiAgICAgICAgaWYgKGRlbGF5ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGVsYXkgPSAwO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkZWxheSAhPSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGRlbGF5IG11c3QgYmUgYSBudW1iZXIgJHtkZWxheX1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyByZWdpc3RlciBiaW5kaW5nXG4gICAgICAgIGxldCBiaW5kaW5nID0ge2N1cnNvciwgY2FsbGJhY2ssIGRlbGF5fTtcbiAgICAgICAgdGhpcy5fYmluZGluZ19zZXQuYWRkKGJpbmRpbmcpO1xuICAgICAgICAvLyByZWdpc3RlciBjdXJzb3JcbiAgICAgICAgaWYgKCF0aGlzLl9jdXJzb3JfbWFwLmhhcyhjdXJzb3IpKSB7IFxuICAgICAgICAgICAgbGV0IHN1YiA9IGN1cnNvci5vbihcImNoYW5nZVwiLCB0aGlzLm9uY3Vyc29yY2hhbmdlLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgdGhpcy5fY3Vyc29yX21hcC5zZXQoY3Vyc29yLCB7XG4gICAgICAgICAgICAgICAgc3ViLCBwb2xsaW5nOiBmYWxzZSwgYmluZGluZ3M6IFtiaW5kaW5nXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jdXJzb3JfbWFwLmdldChjdXJzb3IpLmJpbmRpbmdzLnB1c2goYmluZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJpbmRpbmc7XG4gICAgfVxuXG4gICAgcmVsZWFzZSAoYmluZGluZykge1xuICAgICAgICAvLyB1bnJlZ2lzdGVyIGJpbmRpbmdcbiAgICAgICAgY29uc3QgcmVtb3ZlZCA9IHRoaXMuX2JpbmRpbmdfc2V0LmRlbGV0ZShiaW5kaW5nKTtcbiAgICAgICAgaWYgKCFyZW1vdmVkKSByZXR1cm47XG4gICAgICAgIC8vIGNsZWFudXBcbiAgICAgICAgY29uc3QgY3Vyc29yID0gYmluZGluZy5jdXJzb3I7XG4gICAgICAgIGNvbnN0IHtzdWIsIGJpbmRpbmdzfSA9IHRoaXMuX2N1cnNvcl9tYXAuZ2V0KGN1cnNvcik7XG4gICAgICAgIC8vIHJlbW92ZSBiaW5kaW5nXG4gICAgICAgIGNvbnN0IGlkeCA9IGJpbmRpbmdzLmluZGV4T2YoYmluZGluZyk7XG4gICAgICAgIGlmIChpZHggPj0gMCkge1xuICAgICAgICAgICAgYmluZGluZ3Muc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJpbmRpbmdzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAvLyBubyBtb3JlIGJpbmRpbmdzXG4gICAgICAgICAgICBjdXJzb3Iub2ZmKHN1Yik7XG4gICAgICAgICAgICB0aGlzLl9jdXJzb3JfbWFwLmRlbGV0ZShjdXJzb3IpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYSBjdXJzb3IgaGFzIGNoYW5nZWRcbiAgICAgKiBmb3J3YXJkIGNoYW5nZSBldmVudCB0byBhbGwgY2FsbGJhY2tzIGZvciB0aGlzIGN1cnNvci5cbiAgICAgKiBhbmQgcmVldmFsdWF0ZSBwb2xsaW5nIHN0YXR1cywgcGF1c2luZyBvciByZXN1bWluZ1xuICAgICAqIHBvbGxpbmcgaWYgbmVlZGVkLlxuICAgICAqL1xuICAgIG9uY3Vyc29yY2hhbmdlKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIGNvbnN0IGN1cnNvciA9IGVJbmZvLnNyYztcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBlQXJnO1xuICAgICAgICAvLyByZWV2YWx1YXRlIHBvbGxpbmcgc3RhdHVzXG4gICAgICAgIHRoaXMuX2N1cnNvcl9tYXAuZ2V0KGN1cnNvcikucG9sbGluZyA9IHN0YXRlLmR5bmFtaWM7XG4gICAgICAgIC8vIGZpbmQgY3Vyc29ycyB3aGljaCBuZWVkIHBvbGxpbmdcbiAgICAgICAgY29uc3QgcG9sbGluZ19jdXJzb3JzID0gWy4uLnRoaXMuX2N1cnNvcl9tYXAudmFsdWVzKCldXG4gICAgICAgICAgICAuZmlsdGVyKGVudHJ5ID0+IGVudHJ5LnBvbGxpbmcpO1xuICAgICAgICB0aGlzLnJlZXZhbHVhdGVfcG9sbGluZyhwb2xsaW5nX2N1cnNvcnMpO1xuICAgICAgICAvLyBmb3J3YXJkIGNoYW5nZSBldmVudCB0byBhbGwgZm9yIHRoaXMgY3Vyc29yIGNhbGxiYWNrc1xuICAgICAgICBjb25zdCB7YmluZGluZ3N9ID0gdGhpcy5fY3Vyc29yX21hcC5nZXQoY3Vyc29yKTtcbiAgICAgICAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGJpbmRpbmdzKSB7XG4gICAgICAgICAgICBiaW5kaW5nLmNhbGxiYWNrKHN0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9ucG9sbCgpIHtcbiAgICAgICAgY29uc3QgdHMgPSBsb2NhbF9jbG9jay5ub3coKTtcbiAgICAgICAgLy8gcG9sbCBhbGwgY3Vyc29ycyB3aXRoIG5lZWQgb2YgcG9sbGluZ1xuICAgICAgICBmb3IgKGNvbnN0IFtjdXJzb3IsIGVudHJ5XSBvZiB0aGlzLl9jdXJzb3JfbWFwKSB7XG4gICAgICAgICAgICBpZiAoZW50cnkucG9sbGluZykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gY3Vyc29yLnF1ZXJ5KHRzKTtcbiAgICAgICAgICAgICAgICAvLyBmb3J3YXJkIHBvbGxlZCBzdGF0ZSB0byBhbGwgY2FsbGJhY2tzIGZvciB0aGlzIGN1cnNvclxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYmluZGluZyBvZiBlbnRyeS5iaW5kaW5ncykge1xuICAgICAgICAgICAgICAgICAgICBiaW5kaW5nLmNhbGxiYWNrKHN0YXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZWV2YWx1YXRlX3BvbGxpbmcocG9sbGluZ19jdXJzb3JzKSB7XG4gICAgICAgIGlmIChwb2xsaW5nX2N1cnNvcnMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3BvbGxlci5wYXVzZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZmluZCBtaW5pbXVtIGRlbGF5XG4gICAgICAgICAgICBjb25zdCBkZWxheXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgcG9sbGluZ19jdXJzb3JzKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBiaW5kaW5nIG9mIGVudHJ5LmJpbmRpbmdzKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGF5cy5wdXNoKGJpbmRpbmcuZGVsYXkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjb25zdCBtaW5fZGVsYXkgPSBNYXRoLm1pbiguLi5kZWxheXMpO1xuICAgICAgICAgICAgdGhpcy5fcG9sbGVyLmRlbGF5ID0gbWluX2RlbGF5O1xuICAgICAgICAgICAgdGhpcy5fcG9sbGVyLnBhdXNlKCk7XG4gICAgICAgICAgICB0aGlzLl9wb2xsZXIucmVzdW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEJJTkQgUkVMRUFTRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vLyBtb25pdG9yIHNpbmdsZXRvblxuY29uc3QgbW9uaXRvciA9IG5ldyBDdXJzb3JNb25pdG9yKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kKGN1cnNvciwgY2FsbGJhY2ssIGRlbGF5KSB7XG4gICAgcmV0dXJuIG1vbml0b3IuYmluZChjdXJzb3IsIGNhbGxiYWNrLCBkZWxheSk7XG59XG5leHBvcnQgZnVuY3Rpb24gcmVsZWFzZShiaW5kaW5nKSB7XG4gICAgcmV0dXJuIG1vbml0b3IucmVsZWFzZShiaW5kaW5nKTtcbn1cblxuIiwiaW1wb3J0ICogYXMgZXZlbnRpZnkgZnJvbSBcIi4vdXRpbC9hcGlfZXZlbnRpZnkuanNcIjtcbmltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL3V0aWwvYXBpX2NhbGxiYWNrLmpzXCI7XG5pbXBvcnQgeyBiaW5kLCByZWxlYXNlIH0gZnJvbSBcIi4vdXRpbC9jdXJzb3JfbW9uaXRvci5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi8gIFxuXG4vKipcbiAqIEFic3RyYWN0IGJhc2UgY2xhc3MgZm9yIEN1cnNvciBpbnRlcmZhY2VcbiAqL1xuXG5leHBvcnQgY2xhc3MgQ3Vyc29yIHtcbiAgICBcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGNhbGxiYWNrLmFkZFN0YXRlKHRoaXMpO1xuICAgICAgICAvLyBkZWZpbmUgY2hhbmdlIGV2ZW50XG4gICAgICAgIGV2ZW50aWZ5LmFkZFN0YXRlKHRoaXMpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcbiAgICB9XG5cbiAgICAvLyByZXN0cmljdGlvbiBkZWZhdWx0c1xuICAgIGdldCBtdXRhYmxlICgpIHtyZXR1cm4gZmFsc2U7fVxuICAgIGdldCBudW1lcmljICgpIHtyZXR1cm4gZmFsc2U7fTtcbiAgICBnZXQgaXRlbXNPbmx5ICgpIHtyZXR1cm4gZmFsc2U7fVxuICAgIGdldCBmaXhlZFJhdGUgKCkge3JldHVybiBmYWxzZX1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBxdWVyeShsb2NhbF90cykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJxdWVyeSgpIG5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG4gICAgZ2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5xdWVyeSgpLnZhbHVlfTtcbiAgICBnZXQgKCkge3JldHVybiB0aGlzLnF1ZXJ5KCkudmFsdWU7fVxuXG4gICAgLyoqXG4gICAgICogRXZlbnRpZnk6IGltbWVkaWF0ZSBldmVudHNcbiAgICAgKi9cbiAgICBldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuICAgICAgICBpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG4gICAgICAgICAgICByZXR1cm4gW3RoaXMucXVlcnkoKV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBCSU5EIFJFTEVBU0UgKGNvbnZlbmllbmNlKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgLyoqXG4gICAgICogYWx0ZXJuYXRpdmUgdG8gbGlzdGVuaW5nIHRvIHRoZSBjaGFuZ2UgZXZlbnRcbiAgICAgKiBiaW5kIHN1YnNjcmliZXMgdG8gdGhlIGNoYW5nZSBldmVudCwgYnV0IGFsc28gYXV0b21hdGljYWxseVxuICAgICAqIHR1cm5zIGxpc3RlbmluZyBvbiBhbmQgb2ZmIHdoZW4gYXMgdGhlIGN1cnNvciBzd2l0Y2hlc1xuICAgICAqIGJldHdlZW4gZHluYW1pYyBhbmQgbm9uLWR5bmFtaWMgYmVoYXZpb3IuXG4gICAgICovXG5cbiAgICBiaW5kKGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgICAgICByZXR1cm4gYmluZCh0aGlzLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnMpO1xuICAgIH1cbiAgICByZWxlYXNlKGhhbmRsZSkge1xuICAgICAgICByZXR1cm4gcmVsZWFzZShoYW5kbGUpO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogQ0hBTkdFIE5PVElGSUNBVElPTlxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgLyoqXG4gICAgICogaW52b2tlZCBieSBjdXJzb3IgaW1wbGVtZW50YXRpb24gdG8gc2lnbmFsIGNoYW5nZSBpbiBjdXJzb3JcbiAgICAgKiBiZWhhdmlvci5cbiAgICAgKi9cbiAgICBvbmNoYW5nZSgpIHtcbiAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHRoaXMucXVlcnkoKSk7XG4gICAgICAgIHRoaXMuZGV0ZWN0X2Z1dHVyZV9ldmVudCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIG92ZXJyaWRlIGJ5IGN1cnNvciBpbXBsZW1lbnRhdGlvbiBpbiBvcmRlciB0byBkZXRlY3RcbiAgICAgKiBhbmQgdHJpZ2dlciBmdXR1cmUgY2hhbmdlIGV2ZW50cyAtIHdoaWNoIGFyZSBub3QgdHJpZ2dlcmVkXG4gICAgICogYnkgc3RhdGUgY2hhbmdlcyAtIGJ1dCBjYXVzZWQgYnkgdGltZSBwcm9ncmVzc2lvblxuICAgICAqIG9yIHBsYXliYWNrLiBUaGlzIGZ1bmN0aW9uIGlzIGludm9rZWQgYWZ0ZXIgZWFjaCBcbiAgICAgKiBvbmNoYW5nZSgpIGV2ZW50LlxuICAgICAqL1xuICAgIGRldGVjdF9mdXR1cmVfZXZlbnQoKSB7fVxufVxuY2FsbGJhY2suYWRkTWV0aG9kcyhDdXJzb3IucHJvdG90eXBlKTtcbmV2ZW50aWZ5LmFkZE1ldGhvZHMoQ3Vyc29yLnByb3RvdHlwZSk7XG4iLCJpbXBvcnQge2xvY2FsX2Nsb2NrLCBjaGVja19udW1iZXJ9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5cblxuLyoqXG4gKiBDTE9DSyBQUk9WSURFUlxuICogXG4gKiBBIENsb2NrUHJvdmlkZXIgY2FuIGJlIGNyZWF0ZWQgaW4gdHdvIHdheXNcbiAqIC0gZWl0aGVyIGJ5IHN1cHBseWluZyBhIGNsb2NrIG9iamVjdFxuICogLSBvciBieSBzdXBwbHlpbmcgYSB2ZWN0b3IgXG4gKiBcbiAqIEEgKmNsb2NrKiBpcyBhbiBvYmplY3QgdGhhdCBoYXMgYSBub3coKSBtZXRob2Qgd2hpY2ggcmV0dXJucyB0aGUgY3VycmVudCB0aW1lLlxuICogQSBjbG9jayBpcyBleHBlY3RlZCB0byByZXR1cm4gYSB0aW1lc3RhbXAgaW4gc2Vjb25kcywgbW9uaXRvbmljYWxseSBpbmNyZWFzaW5nIFxuICogYXQgcmF0ZSAxLjAgc2VjL3NlYy4gXG4gKiBcbiAqIEEgKnZlY3RvciogaW5pdGlhbGl6ZXMgYSBkZXRlcm1pc3RpYyBjbG9jayBiYXNlZCBvbiB0aGUgb2ZmaWNpYWwgKmxvY2FsX2Nsb2NrKi4gXG4gKiAtIHRzIChzZWMpIC0gdGltZXN0YW1wIGZyb20gb2ZmaWNpYWwgKmxvY2FsX2Nsb2NrKlxuICogLSB2YWx1ZSAoc2VjKSAtIHZhbHVlIG9mIGNsb2NrIGF0IHRpbWUgdHNcbiAqIC0gcmF0ZSAoc2VjL3NlYykgLSByYXRlIG9mIGNsb2NrIChkZWZhdWx0IDEuMClcbiAqIENsb2NrIFByb3ZpZGVyIHVzZXMgb2ZmaWNpYWwgKmxvY2FsIGNsb2NrKiAocGVyZm9ybWFjZS5ub3coKS8xMDAwLjApXG4gKiBUaGUgb2ZmaWNpYWwgY2xvY2sgaXMgZXhwb3J0ZWQgYnkgdGhlIHN0YXRlbGF5ZXJzIGZyYW1ld29yaywgc28gYXBwbGljYXRpb25cbiAqIGNvZGUgY2FuIHVzZSBpdCB0byBjcmVhdGUgYW4gaW5pdGlhbCB0aW1lc3RhbXBzLiBJZiBvbW1pdHRlZCwgY2xvY2tcbiAqIHByb3ZpZGVyIGNyZWF0ZXMgdGhlIHRpbWVzdGFtcCAtIHRoZXJlYnkgYXNzdW1pbmcgdGhhdCB0aGUgcHJvdmlkZWQgdmFsdWUgd2FzIFxuICogc2FtcGxlZCBpbW1lZGlhdGVseSBiZWZvcmUuXG4gKiBcbiAqIFxuICogVGhlIGtleSBkaWZmZXJlbmNlIGJldHdlZW4gKmNsb2NrKiBhbmQgKnZlY3RvciogaXMgdGhhdCB0aGUgY2xvY2sgb2JqZWN0IGNhbiBkcmlmdCBcbiAqIHJlbGF0aXZlIHRvIHRoZSBvZmZpY2lhbCAqbG9jYWxfY2xvY2sqLCB3aGlsZSB0aGUgdmVjdG9yIG9iamVjdCBpcyBmb3JldmVyIGxvY2tlZCB0b1xuICogdGhlIG9mZmljaWFsICpsb2NhbF9jbG9jayouXG4gKiAgIFxuICovXG5cbmZ1bmN0aW9uIGlzX2Nsb2NrKG9iaikge1xuICAgIGlmICghKFwibm93XCIgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2Ygb2JqLm5vdyAhPSBcImZ1bmN0aW9uXCIpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGNsYXNzIENsb2NrUHJvdmlkZXIge1xuXG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnM9e30pIHtcbiAgICAgICAgY29uc3Qge2Nsb2NrLCB2ZWN0b3I9TE9DQUxfQ0xPQ0tfVkVDVE9SfSA9IG9wdGlvbnM7XG5cbiAgICAgICAgaWYgKGNsb2NrICE9PSB1bmRlZmluZWQgJiYgaXNfY2xvY2soY2xvY2spKSB7XG4gICAgICAgICAgICB0aGlzLl9jbG9jayA9IHtcbiAgICAgICAgICAgICAgICBub3c6IChsb2NhbF90cykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiBsb2NhbF90cyBpcyBkZWZpbmVkIGl0IGRlZmluZXMgYSB0aW1lc3RhbXAgZm9yXG4gICAgICAgICAgICAgICAgICAgIC8vIGV2YWx1YXRpb24gb2YgdGhlIGNsb2NrIC0gd2hpY2ggaXMgbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lXG4gICAgICAgICAgICAgICAgICAgIC8vIGFzIG5vdyAtIGJhY2stZGF0ZSBjbG9jayBhY2NvcmRpbmdseVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkaWZmX3RzID0gKGxvY2FsX3RzICE9IHVuZGVmaW5lZCkgPyBsb2NhbF9jbG9jay5ub3coKSAtIGxvY2FsX3RzIDogMDtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNsb2NrLm5vdygpIC0gZGlmZl90cztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9ICAgIFxuICAgICAgICAgICAgdGhpcy5fcmF0ZSA9IDEuMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCB7dHMsIHZhbHVlLCByYXRlPTEuMH0gPSB2ZWN0b3I7XG4gICAgICAgICAgICBpZiAodHMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBsb2NhbF9jbG9jay5ub3coKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNoZWNrX251bWJlcihcInRzXCIsIHRzKTtcbiAgICAgICAgICAgIGNoZWNrX251bWJlcihcInZhbHVlXCIsIHZhbHVlKTtcbiAgICAgICAgICAgIGNoZWNrX251bWJlcihcInJhdGVcIiwgcmF0ZSk7XG4gICAgICAgICAgICB0aGlzLl90MCA9IHRzO1xuICAgICAgICAgICAgdGhpcy5fdmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3JhdGUgPSByYXRlO1xuICAgICAgICAgICAgdGhpcy5fY2xvY2sgPSB7XG4gICAgICAgICAgICAgICAgbm93OiAobG9jYWxfdHMgPSBsb2NhbF9jbG9jay5ub3coKSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fdmFsdWUgKyAobG9jYWxfdHMgLSB0aGlzLl90MCkqdGhpcy5fcmF0ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBub3cgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xvY2subm93KCk7XG4gICAgfVxuXG4gICAgZ2V0IHJhdGUoKSB7cmV0dXJuIHRoaXMuX3JhdGU7fVxufVxuXG5cbi8vIGRlZmF1bHQgY2xvY2sgcHJvdmlkZXIgICAgXG5jb25zdCBMT0NBTF9DTE9DS19WRUNUT1IgPSB7XG4gICAgdHM6IGxvY2FsX2Nsb2NrLm5vdygpLFxuICAgIHZhbHVlOiBuZXcgRGF0ZSgpLzEwMDAuMCwgXG4gICAgcmF0ZTogMS4wXG59O1xuY29uc3QgTE9DQUxfQ0xPQ0tfUFJPVklERVIgPSBuZXcgQ2xvY2tQcm92aWRlcih7dmVjdG9yOkxPQ0FMX0NMT0NLX1ZFQ1RPUn0pO1xuXG5leHBvcnQgY29uc3QgY2xvY2tfcHJvdmlkZXIgPSAob3B0aW9ucz17fSkgPT4ge1xuXG4gICAgY29uc3Qge2Nsb2NrLCB2ZWN0b3J9ID0gb3B0aW9ucztcbiAgICBpZiAoY2xvY2sgPT0gdW5kZWZpbmVkICYmIHZlY3RvciA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIExPQ0FMX0NMT0NLX1BST1ZJREVSO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IENsb2NrUHJvdmlkZXIob3B0aW9ucyk7IFxufSIsImltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL3V0aWwvYXBpX2NhbGxiYWNrLmpzXCI7XG5pbXBvcnQgeyBjaGVja19pdGVtcyB9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5cbi8qKlxuICogY29sbGVjdGlvbiBwcm92aWRlcnMgbXVzdCBwcm92aWRlIGdldF9hbGwgZnVuY3Rpb25cbiAqIGFuZCBhbHNvIGltcGxlbWVudCBjYWxsYmFjayBpbnRlcmZhY2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzX2NvbGxlY3Rpb25fcHJvdmlkZXIob2JqKSB7XG4gICAgaWYgKCFjYWxsYmFjay5pc19jYWxsYmFja19hcGkob2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghKFwiZ2V0XCIgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2Ygb2JqLmdldCAhPSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCEoXCJ1cGRhdGVcIiBpbiBvYmopKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiBvYmoudXBkYXRlICE9ICdmdW5jdGlvbicpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQ09MTEVDVElPTiBQUk9WSURFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIGxvY2FsIGNvbGxlY3Rpb24gcHJvdmlkZXJcbiAqIFxuICogXG4gKiBjaGFuZ2VzID0ge1xuICogICByZW1vdmU9W10sXG4gKiAgIGluc2VydD1bXSxcbiAqICAgcmVzZXQ9ZmFsc2UgXG4gKiB9XG4gKiBcbiovXG5cbmV4cG9ydCBjbGFzcyBDb2xsZWN0aW9uUHJvdmlkZXIge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBjYWxsYmFjay5hZGRTdGF0ZSh0aGlzKTtcbiAgICAgICAgdGhpcy5fbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICAvLyBpbml0aWFsaXplXG4gICAgICAgIGxldCB7aXRlbXN9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKGl0ZW1zICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWFwLnNldChpdGVtLmlkLCBpdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvY2FsIHN0YXRlcHJvdmlkZXJzIGRlY291cGxlIHVwZGF0ZSByZXF1ZXN0IGZyb21cbiAgICAgKiB1cGRhdGUgcHJvY2Vzc2luZywgYW5kIHJldHVybnMgUHJvbWlzZS5cbiAgICAgKi9cbiAgICB1cGRhdGUgKGNoYW5nZXMpIHtcbiAgICAgICAgY2hhbmdlcy5pbnNlcnQgPSBjaGVja19pdGVtcyhjaGFuZ2VzLmluc2VydCk7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICBsZXQgZGlmZnM7XG4gICAgICAgICAgICBpZiAoY2hhbmdlcyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBkaWZmcyA9IHRoaXMuX3VwZGF0ZShjaGFuZ2VzKTtcbiAgICAgICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoZGlmZnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGRpZmZzO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBfdXBkYXRlKGNoYW5nZXMpIHtcbiAgICAgICAgY29uc3QgZGlmZl9tYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIGxldCB7XG4gICAgICAgICAgICBpbnNlcnQ9W10sXG4gICAgICAgICAgICByZW1vdmU9W10sXG4gICAgICAgICAgICByZXNldD1mYWxzZVxuICAgICAgICB9ID0gY2hhbmdlcztcblxuXG4gICAgICAgIGlmIChyZXNldCkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBbaWQsIGl0ZW1dIG9mIHRoaXMuX21hcC5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgICAgICBkaWZmX21hcC5zZXQoaWQsIHtpZCwgbmV3OnVuZGVmaW5lZCwgb2xkOml0ZW19KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGNsZWFyIGFsbCBpdGVtc1xuICAgICAgICAgICAgdGhpcy5fbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcmVtb3ZlIGl0ZW1zIGJ5IGlkXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGlkIG9mIHJlbW92ZSkge1xuICAgICAgICAgICAgICAgIGxldCBpdGVtID0gdGhpcy5fbWFwLmdldChpZCk7XG4gICAgICAgICAgICAgICAgaWYgKGl0ZW0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGRpZmZfbWFwLnNldChpdGVtLmlkLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDppdGVtLmlkLCBuZXc6dW5kZWZpbmVkLCBvbGQ6aXRlbVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFwLmRlbGV0ZShpZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIGluc2VydCBpdGVtc1xuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGluc2VydCkge1xuICAgICAgICAgICAgY29uc3QgZGlmZiA9IGRpZmZfbWFwLmdldChpdGVtLmlkKVxuICAgICAgICAgICAgY29uc3Qgb2xkID0gKGRpZmYgIT0gdW5kZWZpbmVkKSA/IGRpZmYub2xkIDogdGhpcy5fbWFwLmdldChpdGVtLmlkKTtcbiAgICAgICAgICAgIGRpZmZfbWFwLnNldChpdGVtLmlkLCB7aWQ6aXRlbS5pZCwgbmV3Oml0ZW0sIG9sZH0pO1xuICAgICAgICAgICAgdGhpcy5fbWFwLnNldChpdGVtLmlkLCBpdGVtKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gWy4uLmRpZmZfbWFwLnZhbHVlcygpXTtcbiAgICB9XG5cbiAgICBnZXQoKSB7XG4gICAgICAgIHJldHVybiBbLi4udGhpcy5fbWFwLnZhbHVlcygpXTtcbiAgICB9O1xufVxuY2FsbGJhY2suYWRkTWV0aG9kcyhDb2xsZWN0aW9uUHJvdmlkZXIucHJvdG90eXBlKTtcbiIsImltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL3V0aWwvYXBpX2NhbGxiYWNrLmpzXCI7XG5pbXBvcnQgeyBjaGVja19pdGVtcyB9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5cbi8qKlxuICogb2JqZWN0IHByb3ZpZGVycyBpbXBsZW1lbnQgZ2V0KCkgYW5kIHNldCgpIG1ldGhvZHNcbiAqIGFuZCB0aGUgY2FsbGJhY2sgaW50ZXJmYWNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc19vYmplY3RfcHJvdmlkZXIob2JqKSB7XG4gICAgaWYgKCFjYWxsYmFjay5pc19jYWxsYmFja19hcGkob2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghKFwiZ2V0XCIgaW4gb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2Ygb2JqLmdldCAhPSAnZnVuY3Rpb24nKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCEoXCJzZXRcIiBpbiBvYmopKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiBvYmouc2V0ICE9ICdmdW5jdGlvbicpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE9CSkVDVCBQUk9WSURFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIE9iamVjdFByb3ZpZGVyIHN0b3JlcyBhbiBvYmplY3Qgb3IgdW5kZWZpbmVkLlxuICovXG5cbmV4cG9ydCBjbGFzcyBPYmplY3RQcm92aWRlciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIGNvbnN0IHtpdGVtc30gPSBvcHRpb25zO1xuICAgICAgICBjYWxsYmFjay5hZGRTdGF0ZSh0aGlzKTtcbiAgICAgICAgdGhpcy5fb2JqZWN0ID0gaXRlbXM7XG4gICAgfVxuXG4gICAgc2V0IChpdGVtcykge1xuICAgICAgICBpdGVtcyA9IGNoZWNrX2l0ZW1zKGl0ZW1zKTtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb2JqZWN0ID0gaXRlbXM7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXQgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb2JqZWN0O1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZE1ldGhvZHMoT2JqZWN0UHJvdmlkZXIucHJvdG90eXBlKTsiLCJpbXBvcnQgeyBpc19jYWxsYmFja19hcGkgfSBmcm9tIFwiLi9hcGlfY2FsbGJhY2suanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU09VUkNFIFBST1BFUlRZIChTUkNQUk9QKVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBGdW5jdGlvbnMgZm9yIGV4dGVuZGluZyBhIGNsYXNzIHdpdGggc3VwcG9ydCBmb3IgXG4gKiBleHRlcm5hbCBzb3VyY2Ugb24gYSBuYW1lZCBwcm9wZXJ0eS5cbiAqIFxuICogb3B0aW9uOiBtdXRhYmxlOnRydWUgbWVhbnMgdGhhdCBwcm9wZXJ5IG1heSBiZSByZXNldCBcbiAqIFxuICogc291cmNlIG9iamVjdCBpcyBhc3N1bWVkIHRvIHN1cHBvcnQgdGhlIGNhbGxiYWNrIGludGVyZmFjZSxcbiAqIG9yIGJlIGEgbGlzdCBvZiBvYmplY3RzIGFsbCBzdXBwb3J0aW5nIHRoZSBjYWxsYmFjayBpbnRlcmZhY2VcbiAqL1xuXG5jb25zdCBOQU1FID0gXCJzcmNwcm9wXCI7XG5jb25zdCBQUkVGSVggPSBgX18ke05BTUV9YDtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFN0YXRlIChvYmplY3QpIHtcbiAgICBvYmplY3RbYCR7UFJFRklYfWBdID0gbmV3IE1hcCgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWRkTWV0aG9kcyAob2JqZWN0KSB7XG5cbiAgICBmdW5jdGlvbiByZWdpc3Rlcihwcm9wTmFtZSwgb3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge211dGFibGU9dHJ1ZX0gPSBvcHRpb25zO1xuICAgICAgICBjb25zdCBtYXAgPSB0aGlzW2Ake1BSRUZJWH1gXTsgXG4gICAgICAgIG1hcC5zZXQocHJvcE5hbWUsIHtcbiAgICAgICAgICAgIGluaXQ6ZmFsc2UsXG4gICAgICAgICAgICBtdXRhYmxlLFxuICAgICAgICAgICAgZW50aXR5OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBoYW5kbGVzOiBbXVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyByZWdpc3RlciBnZXR0ZXJzIGFuZCBzZXR0ZXJzXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wTmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1hcC5nZXQocHJvcE5hbWUpLmVudGl0eTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uIChlbnRpdHkpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1tgJHtOQU1FfV9jaGVja2BdKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eSA9IHRoaXNbYCR7TkFNRX1fY2hlY2tgXShwcm9wTmFtZSwgZW50aXR5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eSAhPSBtYXAuZ2V0KHByb3BOYW1lKS5lbnRpdHkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1tgJHtQUkVGSVh9X2F0dGFjaGBdKHByb3BOYW1lLCBlbnRpdHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXR0YXRjaChwcm9wTmFtZSwgZW50aXR5KSB7XG5cbiAgICAgICAgY29uc3QgbWFwID0gdGhpc1tgJHtQUkVGSVh9YF07XG4gICAgICAgIGNvbnN0IHN0YXRlID0gbWFwLmdldChwcm9wTmFtZSlcblxuICAgICAgICBpZiAoc3RhdGUuaW5pdCAmJiAhc3RhdGUubXV0YWJsZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3Byb3BOYW1lfSBjYW4gbm90IGJlIHJlYXNzaWduZWRgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGVudGl0aWVzID0gKEFycmF5LmlzQXJyYXkoZW50aXR5KSkgPyBlbnRpdHkgOiBbZW50aXR5XTtcblxuICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIGVudGl0aWVzXG4gICAgICAgIGlmIChzdGF0ZS5oYW5kbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2lkeCwgZV0gb2YgT2JqZWN0LmVudHJpZXMoZW50aXRpZXMpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzX2NhbGxiYWNrX2FwaShlKSkge1xuICAgICAgICAgICAgICAgICAgICBlLnJlbW92ZV9jYWxsYmFjayhzdGF0ZS5oYW5kbGVzW2lkeF0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gICAgXG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUuaGFuZGxlcyA9IFtdO1xuXG4gICAgICAgIC8vIGF0dGF0Y2ggbmV3IGVudGl0eVxuICAgICAgICBzdGF0ZS5lbnRpdHkgPSBlbnRpdHk7XG4gICAgICAgIHN0YXRlLmluaXQgPSB0cnVlO1xuXG4gICAgICAgIC8vIHN1YnNjcmliZSB0byBjYWxsYmFjayBmcm9tIHNvdXJjZVxuICAgICAgICBpZiAodGhpc1tgJHtOQU1FfV9vbmNoYW5nZWBdKSB7XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gZnVuY3Rpb24gKGVBcmcpIHtcbiAgICAgICAgICAgICAgICB0aGlzW2Ake05BTUV9X29uY2hhbmdlYF0ocHJvcE5hbWUsIGVBcmcpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBlIG9mIGVudGl0aWVzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzX2NhbGxiYWNrX2FwaShlKSkge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZS5oYW5kbGVzLnB1c2goZS5hZGRfY2FsbGJhY2soaGFuZGxlcikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXNbYCR7TkFNRX1fb25jaGFuZ2VgXShwcm9wTmFtZSwgXCJyZXNldFwiKTsgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBhcGkgPSB7fTtcbiAgICBhcGlbYCR7TkFNRX1fcmVnaXN0ZXJgXSA9IHJlZ2lzdGVyO1xuICAgIGFwaVtgJHtQUkVGSVh9X2F0dGFjaGBdID0gYXR0YXRjaDtcbiAgICBPYmplY3QuYXNzaWduKG9iamVjdCwgYXBpKTtcbn1cblxuIiwiaW1wb3J0IHsgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG5cdFNPUlRFRCBBUlJBWVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuXHRTb3J0ZWQgYXJyYXkgb2YgZW5kcG9pbnRzIFt2YWx1ZSwgdHlwZV0uXG5cdC0gRWxlbWVudHMgYXJlIHNvcnRlZCBpbiBhc2NlbmRpbmcgb3JkZXIuXG5cdC0gTm8gZHVwbGljYXRlcyBhcmUgYWxsb3dlZC5cblx0LSBCaW5hcnkgc2VhcmNoIHVzZWQgZm9yIGxvb2t1cFxuXG5cdHZhbHVlcyBjYW4gYmUgcmVndWxhciBudW1iZXIgdmFsdWVzIChmbG9hdCkgb3IgZW5kcG9pbnRzIFtmbG9hdCwgdHlwZV1cbiovXG5cbmV4cG9ydCBjbGFzcyBTb3J0ZWRBcnJheSB7XG5cblx0Y29uc3RydWN0b3IoKXtcblx0XHR0aGlzLl9hcnJheSA9IFtdO1xuXHR9XG5cblx0Z2V0IHNpemUoKSB7cmV0dXJuIHRoaXMuX2FycmF5Lmxlbmd0aDt9XG5cdGdldCBhcnJheSgpIHtyZXR1cm4gdGhpcy5fYXJyYXk7fVxuXG5cdC8qXG5cdFx0ZmluZCBpbmRleCBvZiBnaXZlbiB2YWx1ZVxuXG5cdFx0cmV0dXJuIFtmb3VuZCwgaW5kZXhdXG5cblx0XHRpZiBmb3VuZCBpcyB0cnVlLCB0aGVuIGluZGV4IGlzIHRoZSBpbmRleCBvZiB0aGUgZm91bmQgb2JqZWN0XG5cdFx0aWYgZm91bmQgaXMgZmFsc2UsIHRoZW4gaW5kZXggaXMgdGhlIGluZGV4IHdoZXJlIHRoZSBvYmplY3Qgc2hvdWxkXG5cdFx0YmUgaW5zZXJ0ZWRcblxuXHRcdC0gdXNlcyBiaW5hcnkgc2VhcmNoXHRcdFxuXHRcdC0gYXJyYXkgZG9lcyBub3QgaW5jbHVkZSBhbnkgZHVwbGljYXRlIHZhbHVlc1xuXHQqL1xuXHRpbmRleE9mKHRhcmdldF92YWx1ZSkge1xuXHRcdGNvbnN0IHRhcmdldF9lcCA9IGVuZHBvaW50LmZyb21faW5wdXQodGFyZ2V0X3ZhbHVlKTtcblx0XHRsZXQgbGVmdF9pZHggPSAwO1xuXHRcdGxldCByaWdodF9pZHggPSB0aGlzLl9hcnJheS5sZW5ndGggLSAxO1xuXHRcdHdoaWxlIChsZWZ0X2lkeCA8PSByaWdodF9pZHgpIHtcblx0XHRcdGNvbnN0IG1pZF9pZHggPSBNYXRoLmZsb29yKChsZWZ0X2lkeCArIHJpZ2h0X2lkeCkgLyAyKTtcblx0XHRcdGxldCBtaWRfdmFsdWUgPSB0aGlzLl9hcnJheVttaWRfaWR4XTtcblx0XHRcdGlmIChlbmRwb2ludC5lcShtaWRfdmFsdWUsIHRhcmdldF9lcCkpIHtcblx0XHRcdFx0cmV0dXJuIFt0cnVlLCBtaWRfaWR4XTsgLy8gVGFyZ2V0IGFscmVhZHkgZXhpc3RzIGluIHRoZSBhcnJheVxuXHRcdFx0fSBlbHNlIGlmIChlbmRwb2ludC5sdChtaWRfdmFsdWUsIHRhcmdldF9lcCkpIHtcblx0XHRcdFx0ICBsZWZ0X2lkeCA9IG1pZF9pZHggKyAxOyAvLyBNb3ZlIHNlYXJjaCByYW5nZSB0byB0aGUgcmlnaHRcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdCAgcmlnaHRfaWR4ID0gbWlkX2lkeCAtIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSBsZWZ0XG5cdFx0XHR9XG5cdFx0fVxuXHQgIFx0cmV0dXJuIFtmYWxzZSwgbGVmdF9pZHhdOyAvLyBSZXR1cm4gdGhlIGluZGV4IHdoZXJlIHRhcmdldCBzaG91bGQgYmUgaW5zZXJ0ZWRcblx0fVxuXG5cdC8qXG5cdFx0ZmluZCBpbmRleCBvZiBzbWFsbGVzdCB2YWx1ZSB3aGljaCBpcyBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gdGFyZ2V0IHZhbHVlXG5cdFx0cmV0dXJucyAtMSBpZiBubyBzdWNoIHZhbHVlIGV4aXN0c1xuXHQqL1xuXHRnZUluZGV4T2YodGFyZ2V0X3ZhbHVlKSB7XG5cdFx0bGV0IFtmb3VuZCwgaWR4XSA9IHRoaXMuaW5kZXhPZih0YXJnZXRfdmFsdWUpO1xuXHRcdHJldHVybiAoaWR4IDwgdGhpcy5fYXJyYXkubGVuZ3RoKSA/IGlkeCA6IC0xICBcblx0fVxuXG5cdC8qXG5cdFx0ZmluZCBpbmRleCBvZiBsYXJnZXN0IHZhbHVlIHdoaWNoIGlzIGxlc3MgdGhhbiBvciBlcXVhbCB0byB0YXJnZXQgdmFsdWVcblx0XHRyZXR1cm5zIC0xIGlmIG5vIHN1Y2ggdmFsdWUgZXhpc3RzXG5cdCovXG5cdGxlSW5kZXhPZih0YXJnZXRfdmFsdWUpIHtcblx0XHRsZXQgW2ZvdW5kLCBpZHhdID0gdGhpcy5pbmRleE9mKHRhcmdldF92YWx1ZSk7XG5cdFx0aWR4ID0gKGZvdW5kKSA/IGlkeCA6IGlkeC0xO1xuXHRcdHJldHVybiAoaWR4ID49IDApID8gaWR4IDogLTE7XG5cdH1cblxuXHQvKlxuXHRcdGZpbmQgaW5kZXggb2Ygc21hbGxlc3QgdmFsdWUgd2hpY2ggaXMgZ3JlYXRlciB0aGFuIHRhcmdldCB2YWx1ZVxuXHRcdHJldHVybnMgLTEgaWYgbm8gc3VjaCB2YWx1ZSBleGlzdHNcblx0Ki9cblx0Z3RJbmRleE9mKHRhcmdldF92YWx1ZSkge1xuXHRcdGxldCBbZm91bmQsIGlkeF0gPSB0aGlzLmluZGV4T2YodGFyZ2V0X3ZhbHVlKTtcblx0XHRpZHggPSAoZm91bmQpID8gaWR4ICsgMSA6IGlkeDtcblx0XHRyZXR1cm4gKGlkeCA8IHRoaXMuX2FycmF5Lmxlbmd0aCkgPyBpZHggOiAtMSAgXG5cdH1cblxuXHQvKlxuXHRcdGZpbmQgaW5kZXggb2YgbGFyZ2VzdCB2YWx1ZSB3aGljaCBpcyBsZXNzIHRoYW4gdGFyZ2V0IHZhbHVlXG5cdFx0cmV0dXJucyAtMSBpZiBubyBzdWNoIHZhbHVlIGV4aXN0c1xuXHQqL1xuXHRsdEluZGV4T2YodGFyZ2V0X3ZhbHVlKSB7XG5cdFx0bGV0IFtmb3VuZCwgaWR4XSA9IHRoaXMuaW5kZXhPZih0YXJnZXRfdmFsdWUpO1xuXHRcdGlkeCA9IGlkeC0xO1xuXHRcdHJldHVybiAoaWR4ID49IDApID8gaWR4IDogLTE7XHRcblx0fVxuXG5cdC8qXG5cdFx0VVBEQVRFXG5cblx0XHRhcHByb2FjaCAtIG1ha2UgYWxsIG5lY2Nlc3NhcnkgY2hhbmdlcyBhbmQgdGhlbiBzb3J0XG5cblx0XHRhcyBhIHJ1bGUgb2YgdGh1bWIgLSBjb21wYXJlZCB0byByZW1vdmluZyBhbmQgaW5zZXJ0aW5nIGVsZW1lbnRzXG5cdFx0b25lIGJ5IG9uZSwgdGhpcyBpcyBtb3JlIGVmZmVjdGl2ZSBmb3IgbGFyZ2VyIGJhdGNoZXMsIHNheSA+IDEwMC5cblx0XHRFdmVuIHRob3VnaCB0aGlzIG1pZ2h0IG5vdCBiZSB0aGUgY29tbW9uIGNhc2UsIHBlbmFsdGllcyBmb3Jcblx0XHRjaG9vc2luZyB0aGUgd3JvbmcgYXBwcm9hY2ggaXMgaGlnaGVyIGZvciBsYXJnZXIgYmF0Y2hlcy5cblxuXHRcdHJlbW92ZSBpcyBwcm9jZXNzZWQgZmlyc3QsIHNvIGlmIGEgdmFsdWUgYXBwZWFycyBpbiBib3RoIFxuXHRcdHJlbW92ZSBhbmQgaW5zZXJ0LCBpdCB3aWxsIHJlbWFpbi5cblx0XHR1bmRlZmluZWQgdmFsdWVzIGNhbiBub3QgYmUgaW5zZXJ0ZWQgXG5cblx0Ki9cblxuXHR1cGRhdGUocmVtb3ZlX2xpc3Q9W10sIGluc2VydF9saXN0PVtdKSB7XG5cblx0XHQvKlxuXHRcdFx0cmVtb3ZlXG5cblx0XHRcdHJlbW92ZSBieSBmbGFnZ2luZyBlbGVtZW50cyBhcyB1bmRlZmluZWRcblx0XHRcdC0gY29sbGVjdCBhbGwgaW5kZXhlcyBmaXJzdFxuXHRcdFx0LSBmbGFnIGFzIHVuZGVmaW5lZCBvbmx5IGFmdGVyIGFsbCBpbmRleGVzIGhhdmUgYmVlbiBmb3VuZCxcblx0XHRcdCAgYXMgaW5zZXJ0aW5nIHVuZGVmaW5lZCB2YWx1ZXMgYnJlYWtlcyB0aGUgYXNzdW1wdGlvbiB0aGF0XG5cdFx0XHQgIHRoZSBhcnJheSBpcyBzb3J0ZWQuXG5cdFx0XHQtIGxhdGVyIHNvcnQgd2lsbCBtb3ZlIHRoZW0gdG8gdGhlIGVuZCwgd2hlcmUgdGhleSBjYW4gYmVcblx0XHRcdCAgdHJ1bmNhdGVkIG9mZlxuXHRcdCovXG5cdFx0bGV0IHJlbW92ZV9pZHhfbGlzdCA9IFtdO1xuXHRcdGZvciAobGV0IHZhbHVlIG9mIHJlbW92ZV9saXN0KSB7XG5cdFx0XHRsZXQgW2ZvdW5kLCBpZHhdID0gdGhpcy5pbmRleE9mKHZhbHVlKTtcblx0XHRcdGlmIChmb3VuZCkge1xuXHRcdFx0XHRyZW1vdmVfaWR4X2xpc3QucHVzaChpZHgpO1xuXHRcdFx0fVx0XHRcblx0XHR9XG5cdFx0Zm9yIChsZXQgaWR4IG9mIHJlbW92ZV9pZHhfbGlzdCkge1xuXHRcdFx0dGhpcy5fYXJyYXlbaWR4XSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0bGV0IGFueV9yZW1vdmVzID0gcmVtb3ZlX2lkeF9saXN0Lmxlbmd0aCA+IDA7XG5cblx0XHQvKlxuXHRcdFx0aW5zZXJ0XG5cblx0XHRcdGluc2VydCBtaWdodCBpbnRyb2R1Y2UgZHVwbGljYXRpb25zLCBlaXRoZXIgYmVjYXVzZVxuXHRcdFx0dGhlIGluc2VydCBsaXN0IGluY2x1ZGVzIGR1cGxpY2F0ZXMsIG9yIGJlY2F1c2UgdGhlXG5cdFx0XHRpbnNlcnQgbGlzdCBkdXBsaWNhdGVzIHByZWV4aXN0aW5nIHZhbHVlcy5cblxuXHRcdFx0SW5zdGVhZCBvZiBsb29raW5nIHVwIGFuZCBjaGVja2luZyBlYWNoIGluc2VydCB2YWx1ZSxcblx0XHRcdHdlIGluc3RlYWQgaW5zZXJ0IGV2ZXJ5dGhpbmcgYXQgdGhlIGVuZCBvZiB0aGUgYXJyYXksXG5cdFx0XHRhbmQgcmVtb3ZlIGR1cGxpY2F0ZXMgb25seSBhZnRlciB3ZSBoYXZlIHNvcnRlZC5cblx0XHQqL1xuXHRcdGxldCBhbnlfaW5zZXJ0cyA9IGluc2VydF9saXN0Lmxlbmd0aCA+IDA7XG5cdFx0aWYgKGFueV9pbnNlcnRzKSB7XG5cdFx0XHRjb25jYXRfaW5fcGxhY2UodGhpcy5fYXJyYXksIGluc2VydF9saXN0KTtcblx0XHR9XG5cblx0XHQvKlxuXHRcdFx0c29ydFxuXHRcdFx0dGhpcyBwdXNoZXMgYW55IHVuZGVmaW5lZCB2YWx1ZXMgdG8gdGhlIGVuZCBcblx0XHQqL1xuXHRcdGlmIChhbnlfcmVtb3ZlcyB8fCBhbnlfaW5zZXJ0cykge1xuXHRcdFx0dGhpcy5fYXJyYXkuc29ydChlbmRwb2ludC5jbXApO1xuXHRcdH1cblxuXHRcdC8qXG5cdFx0XHRyZW1vdmUgdW5kZWZpbmVkIFxuXHRcdFx0YWxsIHVuZGVmaW5lZCB2YWx1ZXMgYXJlIHB1c2hlZCB0byB0aGUgZW5kXG5cdFx0Ki9cblx0XHRpZiAoYW55X3JlbW92ZXMpIHtcblx0XHRcdHRoaXMuX2FycmF5Lmxlbmd0aCAtPSByZW1vdmVfaWR4X2xpc3QubGVuZ3RoO1xuXHRcdH1cblxuXHRcdC8qXG5cdFx0XHRyZW1vdmUgZHVwbGljYXRlcyBmcm9tIHNvcnRlZCBhcnJheVxuXHRcdFx0LSBhc3N1bWluZyB0aGVyZSBhcmUgZ29pbmcgdG8gYmUgZmV3IGR1cGxpY2F0ZXMsXG5cdFx0XHQgIGl0IGlzIG9rIHRvIHJlbW92ZSB0aGVtIG9uZSBieSBvbmVcblxuXHRcdCovXG5cdFx0aWYgKGFueV9pbnNlcnRzKSB7XG5cdFx0XHRyZW1vdmVfZHVwbGljYXRlcyh0aGlzLl9hcnJheSk7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRnZXQgZWxlbWVudCBieSBpbmRleFxuXHQqL1xuXHRnZXRfYnlfaW5kZXgoaWR4KSB7XG5cdFx0aWYgKGlkeCA+IC0xICYmIGlkeCA8IHRoaXMuX2FycmF5Lmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FycmF5W2lkeF07XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRsb29rdXAgdmFsdWVzIHdpdGhpbiBpbnRlcnZhbFxuXHQqL1xuXHRsb29rdXAoaXR2KSB7XG5cdFx0aWYgKGl0diA9PSB1bmRlZmluZWQpIHtcblx0XHRcdGl0diA9IFtudWxsLCBudWxsLCB0cnVlLCB0cnVlXTtcblx0XHR9XG5cdFx0bGV0IFtlcF8wLCBlcF8xXSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXR2KTtcblx0XHRsZXQgaWR4XzAgPSB0aGlzLmdlSW5kZXhPZihlcF8wKTtcblx0XHRsZXQgaWR4XzEgPSB0aGlzLmxlSW5kZXhPZihlcF8xKTtcblx0XHRpZiAoaWR4XzAgPT0gLTEgfHwgaWR4XzEgPT0gLTEpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FycmF5LnNsaWNlKGlkeF8wLCBpZHhfMSsxKTtcblx0XHR9XG5cdH1cblxuXHRsdCAob2Zmc2V0KSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0X2J5X2luZGV4KHRoaXMubHRJbmRleE9mKG9mZnNldCkpO1xuXHR9XG5cdGxlIChvZmZzZXQpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRfYnlfaW5kZXgodGhpcy5sZUluZGV4T2Yob2Zmc2V0KSk7XG5cdH1cblx0Z2V0IChvZmZzZXQpIHtcblx0XHRsZXQgW2ZvdW5kLCBpZHhdID0gdGhpcy5pbmRleE9mKG9mZnNldCk7XG5cdFx0aWYgKGZvdW5kKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYXJyYXlbaWR4XTtcblx0XHR9IFxuXHR9XG5cdGd0IChvZmZzZXQpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRfYnlfaW5kZXgodGhpcy5ndEluZGV4T2Yob2Zmc2V0KSk7XG5cdH1cblx0Z2UgKG9mZnNldCkge1xuXHRcdHJldHVybiB0aGlzLmdldF9ieV9pbmRleCh0aGlzLmdlSW5kZXhPZihvZmZzZXQpKTtcblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblx0VVRJTFNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcblx0Q29uY2F0aW5hdGUgdHdvIGFycmF5cyBieSBhcHBlbmRpbmcgdGhlIHNlY29uZCBhcnJheSB0byB0aGUgZmlyc3QgYXJyYXkuIFxuKi9cblxuZnVuY3Rpb24gY29uY2F0X2luX3BsYWNlKGZpcnN0X2Fyciwgc2Vjb25kX2Fycikge1xuXHRjb25zdCBmaXJzdF9hcnJfbGVuZ3RoID0gZmlyc3RfYXJyLmxlbmd0aDtcblx0Y29uc3Qgc2Vjb25kX2Fycl9sZW5ndGggPSBzZWNvbmRfYXJyLmxlbmd0aDtcbiAgXHRmaXJzdF9hcnIubGVuZ3RoICs9IHNlY29uZF9hcnJfbGVuZ3RoO1xuICBcdGZvciAobGV0IGkgPSAwOyBpIDwgc2Vjb25kX2Fycl9sZW5ndGg7IGkrKykge1xuICAgIFx0Zmlyc3RfYXJyW2ZpcnN0X2Fycl9sZW5ndGggKyBpXSA9IHNlY29uZF9hcnJbaV07XG4gIFx0fVxufVxuXG4vKlxuXHRyZW1vdmUgZHVwbGljYXRlcyBpbiBhIHNvcnRlZCBhcnJheVxuKi9cbmZ1bmN0aW9uIHJlbW92ZV9kdXBsaWNhdGVzKHNvcnRlZF9hcnIpIHtcblx0bGV0IGkgPSAwO1xuXHR3aGlsZSAodHJ1ZSkge1xuXHRcdGlmIChpICsgMSA+PSBzb3J0ZWRfYXJyLmxlbmd0aCkge1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdGlmIChlbmRwb2ludC5lcShzb3J0ZWRfYXJyW2ldLCBzb3J0ZWRfYXJyW2kgKyAxXSkpIHtcblx0XHRcdHNvcnRlZF9hcnIuc3BsaWNlKGkgKyAxLCAxKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aSArPSAxO1xuXHRcdH1cblx0fVxufVxuIiwiaW1wb3J0IHsgZW5kcG9pbnQgfSBmcm9tIFwiLi91dGlsL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlLCBuZWFyYnlfZnJvbSB9IGZyb20gXCIuL25lYXJieV9iYXNlLmpzXCI7XG5pbXBvcnQgeyBTb3J0ZWRBcnJheSB9IGZyb20gXCIuL3V0aWwvc29ydGVkYXJyYXkuanNcIjtcbmltcG9ydCB7IGlzX2NvbGxlY3Rpb25fcHJvdmlkZXIgfSBmcm9tIFwiLi9wcm92aWRlcl9jb2xsZWN0aW9uLmpzXCI7XG5pbXBvcnQgeyBpc19vYmplY3RfcHJvdmlkZXIgfSBmcm9tIFwiLi9wcm92aWRlcl9vYmplY3QuanNcIjtcblxuY29uc3Qge0xPV19DTE9TRUQsIExPV19PUEVOLCBISUdIX0NMT1NFRCwgSElHSF9PUEVOfSA9IGVuZHBvaW50LnR5cGVzO1xuY29uc3QgRVBfVFlQRVMgPSBbTE9XX0NMT1NFRCwgTE9XX09QRU4sIEhJR0hfQ0xPU0VELCBISUdIX09QRU5dO1xuXG5cbi8vIFNldCBvZiB1bmlxdWUgW3YsIHRdIGVuZHBvaW50c1xuY2xhc3MgRW5kcG9pbnRTZXQge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLl9tYXAgPSBuZXcgTWFwKFtcblx0XHRcdFtMT1dfQ0xPU0VELCBuZXcgU2V0KCldLFxuXHRcdFx0W0xPV19PUEVOLCBuZXcgU2V0KCldLCBcblx0XHRcdFtISUdIX0NMT1NFRCwgbmV3IFNldCgpXSwgXG5cdFx0XHRbSElHSF9PUEVOLCBuZXcgU2V0KCldXG5cdFx0XSk7XG5cdH1cblx0YWRkKGVwKSB7XG5cdFx0Y29uc3QgW3ZhbHVlLCB0eXBlXSA9IGVwO1xuXHRcdHJldHVybiB0aGlzLl9tYXAuZ2V0KHR5cGUpLmFkZCh2YWx1ZSk7XG5cdH1cblx0aGFzIChlcCkge1xuXHRcdGNvbnN0IFt2YWx1ZSwgdHlwZV0gPSBlcDtcblx0XHRyZXR1cm4gdGhpcy5fbWFwLmdldCh0eXBlKS5oYXModmFsdWUpO1xuXHR9XG5cdGdldChlcCkge1xuXHRcdGNvbnN0IFt2YWx1ZSwgdHlwZV0gPSBlcDtcblx0XHRyZXR1cm4gdGhpcy5fbWFwLmdldCh0eXBlKS5nZXQodmFsdWUpO1xuXHR9XG5cblx0bGlzdCgpIHtcblx0XHRjb25zdCBsaXN0cyA9IEVQX1RZUEVTLm1hcCgodHlwZSkgPT4ge1xuXHRcdFx0cmV0dXJuIFsuLi50aGlzLl9tYXAuZ2V0KHR5cGUpLnZhbHVlcygpXVxuXHRcdFx0XHQubWFwKCh2YWx1ZSkgPT4gW3ZhbHVlLCB0eXBlXSk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIFtdLmNvbmNhdCguLi5saXN0cyk7XG5cdH1cbn1cblxuLyoqXG4gKiBJVEVNUyBNQVBcbiAqIFxuICogbWFwIGVuZHBvaW50IC0+IHtcbiAqIFx0bG93OiBbaXRlbXNdLCBcbiAqICBhY3RpdmU6IFtpdGVtc10sIFxuICogIGhpZ2g6W2l0ZW1zXVxuICogfVxuICogXG4gKiBpbiBvcmRlciB0byB1c2UgZW5kcG9pbnQgW3YsdF0gYXMgYSBtYXAga2V5IHdlIGNyZWF0ZSBhIHR3byBsZXZlbFxuICogbWFwIC0gdXNpbmcgdCBhcyB0aGUgZmlyc3QgdmFyaWFibGUuIFxuICogXG4gKi9cblxuXG5jb25zdCBMT1cgPSBcImxvd1wiO1xuY29uc3QgQUNUSVZFID0gXCJhY3RpdmVcIjtcbmNvbnN0IEhJR0ggPSBcImhpZ2hcIjtcblxuXG5jbGFzcyBJdGVtc01hcCB7XG5cblx0Y29uc3RydWN0b3IgKCkge1xuXHRcdC8vIG1hcCBlbmRwb2ludCAtPiB7bG93OiBbaXRlbXNdLCBhY3RpdmU6IFtpdGVtc10sIGhpZ2g6W2l0ZW1zXX1cblx0XHR0aGlzLl9tYXAgPSBuZXcgTWFwKFtcblx0XHRcdFtMT1dfQ0xPU0VELCBuZXcgTWFwKCldLFxuXHRcdFx0W0xPV19PUEVOLCBuZXcgTWFwKCldLCBcblx0XHRcdFtISUdIX0NMT1NFRCwgbmV3IE1hcCgpXSwgXG5cdFx0XHRbSElHSF9PUEVOLCBuZXcgTWFwKCldXG5cdFx0XSk7XG5cdH1cblxuXHRnZXRfaXRlbXNfYnlfcm9sZSAoZXAsIHJvbGUpIHtcblx0XHRjb25zdCBbdmFsdWUsIHR5cGVdID0gZXA7XG5cdFx0Y29uc3QgZW50cnkgPSB0aGlzLl9tYXAuZ2V0KHR5cGUpLmdldCh2YWx1ZSk7XG5cdFx0cmV0dXJuIChlbnRyeSAhPSB1bmRlZmluZWQpID8gZW50cnlbcm9sZV0gOiBbXTtcblx0fVxuXG5cdC8qXG5cdFx0cmVnaXN0ZXIgaXRlbSB3aXRoIGVuZHBvaW50IChpZGVtcG90ZW50KVxuXHRcdHJldHVybiB0cnVlIGlmIHRoaXMgd2FzIHRoZSBmaXJzdCBMT1cgb3IgSElHSCBcblx0ICovXG5cdHJlZ2lzdGVyKGVwLCBpdGVtLCByb2xlKSB7XG5cdFx0Y29uc3QgW3ZhbHVlLCB0eXBlXSA9IGVwO1xuXHRcdGNvbnN0IHR5cGVfbWFwID0gdGhpcy5fbWFwLmdldCh0eXBlKTtcblx0XHRpZiAoIXR5cGVfbWFwLmhhcyh2YWx1ZSkpIHtcblx0XHRcdHR5cGVfbWFwLnNldCh2YWx1ZSwge2xvdzogW10sIGFjdGl2ZTpbXSwgaGlnaDpbXX0pO1xuXHRcdH1cblx0XHRjb25zdCBlbnRyeSA9IHR5cGVfbWFwLmdldCh2YWx1ZSk7XG5cdFx0Y29uc3Qgd2FzX2VtcHR5ID0gZW50cnlbTE9XXS5sZW5ndGggKyBlbnRyeVtISUdIXS5sZW5ndGggPT0gMDtcblx0XHRsZXQgaWR4ID0gZW50cnlbcm9sZV0uZmluZEluZGV4KChfaXRlbSkgPT4ge1xuXHRcdFx0cmV0dXJuIF9pdGVtLmlkID09IGl0ZW0uaWQ7XG5cdFx0fSk7XG5cdFx0aWYgKGlkeCA9PSAtMSkge1xuXHRcdFx0ZW50cnlbcm9sZV0ucHVzaChpdGVtKTtcblx0XHR9XG5cdFx0Y29uc3QgaXNfZW1wdHkgPSBlbnRyeVtMT1ddLmxlbmd0aCArIGVudHJ5W0hJR0hdLmxlbmd0aCA9PSAwO1xuXHRcdHJldHVybiB3YXNfZW1wdHkgJiYgIWlzX2VtcHR5O1xuXHR9XG5cblx0Lypcblx0XHR1bnJlZ2lzdGVyIGl0ZW0gd2l0aCBlbmRwb2ludCAoaW5kZXBlbmRlbnQgb2Ygcm9sZSlcblx0XHRyZXR1cm4gdHJ1ZSBpZiB0aGlzIHJlbW92ZWQgbGFzdCBMT1cgb3IgSElHSFxuXHQgKi9cblx0dW5yZWdpc3RlcihlcCwgaXRlbSkge1xuXHRcdGNvbnN0IFt2YWx1ZSwgdHlwZV0gPSBlcDtcblx0XHRjb25zdCB0eXBlX21hcCA9IHRoaXMuX21hcC5nZXQodHlwZSk7XG5cdFx0Y29uc3QgZW50cnkgPSB0eXBlX21hcC5nZXQodmFsdWUpO1xuXHRcdGlmIChlbnRyeSAhPSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IHdhc19lbXB0eSA9IGVudHJ5W0xPV10ubGVuZ3RoICsgZW50cnlbSElHSF0ubGVuZ3RoID09IDA7XG5cdFx0XHQvLyByZW1vdmUgYWxsIG1lbnRpb25lcyBvZiBpdGVtXG5cdFx0XHRmb3IgKGNvbnN0IHJvbGUgb2YgW0xPVywgQUNUSVZFLCBISUdIXSkge1xuXHRcdFx0XHRsZXQgaWR4ID0gZW50cnlbcm9sZV0uZmluZEluZGV4KChfaXRlbSkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBfaXRlbS5pZCA9PSBpdGVtLmlkO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKGlkeCA+IC0xKSB7XG5cdFx0XHRcdFx0ZW50cnlbcm9sZV0uc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRcdH1cdFxuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaXNfZW1wdHkgPSBlbnRyeVtMT1ddLmxlbmd0aCArIGVudHJ5W0hJR0hdLmxlbmd0aCA9PSAwO1xuXHRcdFx0aWYgKCF3YXNfZW1wdHkgJiYgaXNfZW1wdHkpIHtcblx0XHRcdFx0Ly8gY2xlYW4gdXAgZW50cnlcblx0XHRcdFx0dHlwZV9tYXAuZGVsZXRlKHZhbHVlKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuXG5cbi8qKlxuICogTmVhcmJ5SW5kZXhcbiAqIFxuICogTmVhcmJ5SW5kZXggZm9yIENvbGxlY3Rpb25Qcm92aWRlciBvciBWYXJpYWJsZVByb3ZpZGVyXG4gKi9cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKHN0YXRlUHJvdmlkZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcdFx0XG5cblx0XHRpZiAoXG5cdFx0XHQhaXNfY29sbGVjdGlvbl9wcm92aWRlcihzdGF0ZVByb3ZpZGVyKSAmJlxuXHRcdFx0IWlzX29iamVjdF9wcm92aWRlcihzdGF0ZVByb3ZpZGVyKVxuXHRcdCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBzdGF0ZVByb3ZpZGVyIG11c3QgYmUgY29sbGVjdGlvblByb3ZpZGVyIG9yIHZhcmlhYmxlUHJvdmlkZXIgJHtzdGF0ZVByb3ZpZGVyfWApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3NwID0gc3RhdGVQcm92aWRlcjtcblx0XHR0aGlzLl9pbml0aWFsaXNlKCk7XG5cdFx0dGhpcy5yZWZyZXNoKCk7XG5cdH1cblxuICAgIGdldCBzcmMgKCkge3JldHVybiB0aGlzLl9zcDt9XG5cblxuXHRfaW5pdGlhbGlzZSgpIHtcblx0XHQvLyByZWdpc3RlciBpdGVtcyB3aXRoIGVuZHBvaW50c1xuXHRcdHRoaXMuX2l0ZW1zbWFwID0gbmV3IEl0ZW1zTWFwKCk7XG5cdFx0Ly8gc29ydGVkIGluZGV4XG5cdFx0dGhpcy5fZW5kcG9pbnRzID0gbmV3IFNvcnRlZEFycmF5KCk7XG5cdFx0Ly8gc3dpcGUgaW5kZXhcblx0XHR0aGlzLl9pbmRleCA9IFtdO1xuXHR9XG5cblxuXHRyZWZyZXNoKGRpZmZzKSB7XG5cblx0XHRjb25zdCByZW1vdmVfZW5kcG9pbnRzID0gbmV3IEVuZHBvaW50U2V0KCk7XG5cdFx0Y29uc3QgaW5zZXJ0X2VuZHBvaW50cyA9IG5ldyBFbmRwb2ludFNldCgpO1xuXG5cdFx0bGV0IGluc2VydF9pdGVtcyA9IFtdO1xuXHRcdGxldCByZW1vdmVfaXRlbXMgPSBbXTtcblxuXHRcdGlmIChkaWZmcyA9PSB1bmRlZmluZWQpIHtcblx0XHRcdGluc2VydF9pdGVtcyA9IHRoaXMuc3JjLmdldCgpIHx8IFtdO1xuXHRcdFx0Ly8gY2xlYXIgYWxsIHN0YXRlXG5cdFx0XHR0aGlzLl9pbml0aWFsaXNlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGNvbGxlY3QgaW5zZXJ0IGl0ZW1zIGFuZCByZW1vdmUgaXRlbXNcblx0XHRcdGZvciAoY29uc3QgZGlmZiBvZiBkaWZmcykge1xuXHRcdFx0XHRpZiAoZGlmZi5uZXcgIT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0aW5zZXJ0X2l0ZW1zLnB1c2goZGlmZi5uZXcpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChkaWZmLm9sZCAhPSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRyZW1vdmVfaXRlbXMucHVzaChkaWZmLm9sZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKlxuXHRcdFx0dW5yZWdpc3RlciByZW1vdmUgaXRlbXMgYWNyb3NzIGFsbCBlbmRwb2ludHMgXG5cdFx0XHR3aGVyZSB0aGV5IHdlcmUgcmVnaXN0ZXJlZCAoTE9XLCBBQ1RJVkUsIEhJR0gpIFxuXHRcdCovXG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIHJlbW92ZV9pdGVtcykge1x0XHRcdFxuXHRcdFx0Zm9yIChjb25zdCBlcCBvZiB0aGlzLl9lbmRwb2ludHMubG9va3VwKGl0ZW0uaXR2KSkge1xuXHRcdFx0XHQvLyBUT0RPOiBjaGVjayBpZiB0aGlzIGlzIGNvcnJlY3Rcblx0XHRcdFx0Y29uc3QgYmVjYW1lX2VtcHR5ID0gdGhpcy5faXRlbXNtYXAudW5yZWdpc3RlcihlcCwgaXRlbSk7XG5cdFx0XHRcdGlmIChiZWNhbWVfZW1wdHkpIHJlbW92ZV9lbmRwb2ludHMuYWRkKGVwKTtcblx0XHRcdH1cdFxuXHRcdH1cblxuXHRcdC8qXG5cdFx0XHRyZWdpc3RlciBuZXcgaXRlbXMgYWNyb3NzIGFsbCBlbmRwb2ludHMgXG5cdFx0XHR3aGVyZSB0aGV5IHNob3VsZCBiZSByZWdpc3RlcmVkIChMT1csIEhJR0gpIFxuXHRcdCovXG5cdFx0bGV0IGJlY2FtZV9ub25lbXB0eTtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgaW5zZXJ0X2l0ZW1zKSB7XG5cdFx0XHRjb25zdCBbbG93LCBoaWdoXSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpO1xuXHRcdFx0YmVjYW1lX25vbmVtcHR5ID0gdGhpcy5faXRlbXNtYXAucmVnaXN0ZXIobG93LCBpdGVtLCBMT1cpO1xuXHRcdFx0aWYgKGJlY2FtZV9ub25lbXB0eSkgaW5zZXJ0X2VuZHBvaW50cy5hZGQobG93KTtcblx0XHRcdGJlY2FtZV9ub25lbXB0eSA9IHRoaXMuX2l0ZW1zbWFwLnJlZ2lzdGVyKGhpZ2gsIGl0ZW0sIEhJR0gpO1xuXHRcdFx0aWYgKGJlY2FtZV9ub25lbXB0eSkgaW5zZXJ0X2VuZHBvaW50cy5hZGQoaGlnaCk7XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRcdHJlZnJlc2ggc29ydGVkIGVuZHBvaW50c1xuXHRcdFx0cG9zc2libGUgdGhhdCBhbiBlbmRwb2ludCBpcyBwcmVzZW50IGluIGJvdGggbGlzdHNcblx0XHRcdHRoaXMgaXMgcHJlc3VtYWJseSBub3QgYSBwcm9ibGVtIHdpdGggU29ydGVkQXJyYXkuXG5cdFx0Ki9cblx0XHR0aGlzLl9lbmRwb2ludHMudXBkYXRlKFxuXHRcdFx0cmVtb3ZlX2VuZHBvaW50cy5saXN0KCksIFxuXHRcdFx0aW5zZXJ0X2VuZHBvaW50cy5saXN0KClcblx0XHQpO1xuXG5cdFx0Lypcblx0XHRcdHN3aXBlIG92ZXIgdG8gZW5zdXJlIHRoYXQgYWxsIGl0ZW1zIGFyZSBhY3RpdmF0ZVxuXHRcdCovXG5cdFx0Y29uc3QgYWN0aXZlU2V0ID0gbmV3IFNldCgpO1xuXHRcdGZvciAoY29uc3QgZXAgb2YgdGhpcy5fZW5kcG9pbnRzLmFycmF5KSB7XHRcblx0XHRcdC8vIEFkZCBpdGVtcyB3aXRoIGVwIGFzIGxvdyBwb2ludFxuXHRcdFx0Zm9yIChsZXQgaXRlbSBvZiB0aGlzLl9pdGVtc21hcC5nZXRfaXRlbXNfYnlfcm9sZShlcCwgTE9XKSkge1xuXHRcdFx0XHRhY3RpdmVTZXQuYWRkKGl0ZW0pO1xuXHRcdFx0fTtcblx0XHRcdC8vIGFjdGl2YXRlIHVzaW5nIGFjdGl2ZVNldFxuXHRcdFx0Zm9yIChsZXQgaXRlbSBvZiBhY3RpdmVTZXQpIHtcblx0XHRcdFx0dGhpcy5faXRlbXNtYXAucmVnaXN0ZXIoZXAsIGl0ZW0sIEFDVElWRSk7XG5cdFx0XHR9XG5cdFx0XHQvLyBSZW1vdmUgaXRlbXMgd2l0aCBwMSBhcyBoaWdoIHBvaW50XG5cdFx0XHRmb3IgKGxldCBpdGVtIG9mIHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKGVwLCBISUdIKSkge1xuXHRcdFx0XHRhY3RpdmVTZXQuZGVsZXRlKGl0ZW0pO1xuXHRcdFx0fTtcdFxuXHRcdH1cblx0fVxuXG5cdF9jb3ZlcnMgKG9mZnNldCkge1xuXHRcdGNvbnN0IGVwID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuXHRcdGNvbnN0IGVwMSA9IHRoaXMuX2VuZHBvaW50cy5sZShlcCkgfHwgZW5kcG9pbnQuTkVHX0lORjtcblx0XHRjb25zdCBlcDIgPSB0aGlzLl9lbmRwb2ludHMuZ2UoZXApIHx8IGVuZHBvaW50LlBPU19JTkY7XG5cdFx0aWYgKGVuZHBvaW50LmVxKGVwMSwgZXAyKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKGVwMSwgQUNUSVZFKTtcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBnZXQgaXRlbXMgZm9yIGJvdGggZW5kcG9pbnRzXG5cdFx0XHRjb25zdCBpdGVtczEgPSB0aGlzLl9pdGVtc21hcC5nZXRfaXRlbXNfYnlfcm9sZShlcDEsIEFDVElWRSk7XG5cdFx0XHRjb25zdCBpdGVtczIgPSB0aGlzLl9pdGVtc21hcC5nZXRfaXRlbXNfYnlfcm9sZShlcDIsIEFDVElWRSk7XG5cdFx0XHQvLyByZXR1cm4gYWxsIGl0ZW1zIHRoYXQgYXJlIGFjdGl2ZSBpbiBib3RoIGVuZHBvaW50c1xuXHRcdFx0Y29uc3QgaWRTZXQgPSBuZXcgU2V0KGl0ZW1zMS5tYXAoaXRlbSA9PiBpdGVtLmlkKSk7XG5cdFx0XHRyZXR1cm4gaXRlbXMyLmZpbHRlcihpdGVtID0+IGlkU2V0LmhhcyhpdGVtLmlkKSk7XG5cdFx0fVxuXHR9XG5cbiAgICAvKlxuXHRcdG5lYXJieSAob2Zmc2V0KVxuICAgICovXG5cdG5lYXJieShvZmZzZXQpIHtcblx0XHRjb25zdCBlcCA9IGVuZHBvaW50LmZyb21faW5wdXQob2Zmc2V0KTtcblxuXHRcdC8vIGNlbnRlclxuXHRcdGxldCBjZW50ZXIgPSB0aGlzLl9jb3ZlcnMoZXApXG5cdFx0Y29uc3QgY2VudGVyX2hpZ2hfbGlzdCA9IFtdO1xuXHRcdGNvbnN0IGNlbnRlcl9sb3dfbGlzdCA9IFtdO1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBjZW50ZXIpIHtcblx0XHRcdGNvbnN0IFtsb3csIGhpZ2hdID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dik7XG5cdFx0XHRjZW50ZXJfaGlnaF9saXN0LnB1c2goaGlnaCk7XG5cdFx0XHRjZW50ZXJfbG93X2xpc3QucHVzaChsb3cpOyAgICBcblx0XHR9XG5cblx0XHQvLyBwcmV2IGhpZ2hcblx0XHRsZXQgcHJldl9oaWdoID0gZXA7XG5cdFx0bGV0IGl0ZW1zO1xuXHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRwcmV2X2hpZ2ggPSB0aGlzLl9lbmRwb2ludHMubHQocHJldl9oaWdoKSB8fCBlbmRwb2ludC5ORUdfSU5GO1xuXHRcdFx0aWYgKHByZXZfaGlnaFswXSA9PSBudWxsKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0XHRpdGVtcyA9IHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKHByZXZfaGlnaCwgSElHSCk7XG5cdFx0XHRpZiAoaXRlbXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIG5leHQgbG93XG5cdFx0bGV0IG5leHRfbG93ID0gZXA7XG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdG5leHRfbG93ID0gdGhpcy5fZW5kcG9pbnRzLmd0KG5leHRfbG93KSB8fCBlbmRwb2ludC5QT1NfSU5GXG5cdFx0XHRpZiAobmV4dF9sb3dbMF0gPT0gbnVsbCkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXHRcdFx0aXRlbXMgPSB0aGlzLl9pdGVtc21hcC5nZXRfaXRlbXNfYnlfcm9sZShuZXh0X2xvdywgTE9XKTtcblx0XHRcdGlmIChpdGVtcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5lYXJieV9mcm9tKFxuXHRcdFx0cHJldl9oaWdoLCBcblx0XHRcdGNlbnRlcl9sb3dfbGlzdCwgXG5cdFx0XHRjZW50ZXIsXG5cdFx0XHRjZW50ZXJfaGlnaF9saXN0LFxuXHRcdFx0bmV4dF9sb3dcblx0XHQpO1xuXHR9XG59IiwiaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IG1vdGlvbl91dGlscyB9IGZyb20gXCIuL2NvbW1vbi5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbkJBU0UgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLypcblx0QWJzdHJhY3QgQmFzZSBDbGFzcyBmb3IgU2VnbWVudHNcblxuICAgIGNvbnN0cnVjdG9yKGludGVydmFsKVxuXG4gICAgLSBpbnRlcnZhbDogaW50ZXJ2YWwgb2YgdmFsaWRpdHkgb2Ygc2VnbWVudFxuICAgIC0gZHluYW1pYzogdHJ1ZSBpZiBzZWdtZW50IGlzIGR5bmFtaWNcbiAgICAtIHZhbHVlKG9mZnNldCk6IHZhbHVlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4gICAgLSBxdWVyeShvZmZzZXQpOiBzdGF0ZSBvZiBzZWdtZW50IGF0IG9mZnNldFxuKi9cblxuZXhwb3J0IGNsYXNzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYpIHtcblx0XHR0aGlzLl9pdHYgPSBpdHY7XG5cdH1cblxuXHRnZXQgaXR2KCkge3JldHVybiB0aGlzLl9pdHY7fVxuXG4gICAgLyoqIFxuICAgICAqIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzXG4gICAgICogcmV0dXJucyB7dmFsdWUsIGR5bmFtaWN9O1xuICAgICovXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgXHR0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY29udmVuaWVuY2UgZnVuY3Rpb24gcmV0dXJuaW5nIHRoZSBzdGF0ZSBvZiB0aGUgc2VnbWVudFxuICAgICAqIEBwYXJhbSB7Kn0gb2Zmc2V0IFxuICAgICAqIEByZXR1cm5zIFxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX2l0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHsuLi50aGlzLnN0YXRlKG9mZnNldCksIG9mZnNldH07XG4gICAgICAgIH0gXG4gICAgICAgIHJldHVybiB7dmFsdWU6IHVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICB9XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNUQVRJQyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX3ZhbHVlID0gZGF0YTtcblx0fVxuXG5cdHN0YXRlKCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl92YWx1ZSwgZHluYW1pYzpmYWxzZX1cblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE1PVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuICAgICAgICBzdXBlcihpdHYpO1xuICAgICAgICB0aGlzLl92ZWN0b3IgPSBkYXRhO1xuICAgIH1cblxuICAgIHN0YXRlKG9mZnNldCkge1xuICAgICAgICBjb25zdCBbcCx2LGEsdF0gPSBtb3Rpb25fdXRpbHMuY2FsY3VsYXRlKHRoaXMuX3ZlY3Rvciwgb2Zmc2V0KTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHZhbHVlOiBwLCBkeW5hbWljOiAodiAhPSAwIHx8IGEgIT0gMCApLFxuICAgICAgICAgICAgdmVjdG9yOiBbcCwgdiwgYSwgdF0sXG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVFJBTlNJVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgU3VwcG9ydGVkIGVhc2luZyBmdW5jdGlvbnNcbiAgICBcImVhc2UtaW5cIjpcbiAgICBcImVhc2Utb3V0XCI6XG4gICAgXCJlYXNlLWluLW91dFwiXG4qL1xuXG5mdW5jdGlvbiBlYXNlaW4gKHRzKSB7XG4gICAgcmV0dXJuIE1hdGgucG93KHRzLDIpOyAgXG59XG5mdW5jdGlvbiBlYXNlb3V0ICh0cykge1xuICAgIHJldHVybiAxIC0gZWFzZWluKDEgLSB0cyk7XG59XG5mdW5jdGlvbiBlYXNlaW5vdXQgKHRzKSB7XG4gICAgaWYgKHRzIDwgLjUpIHtcbiAgICAgICAgcmV0dXJuIGVhc2VpbigyICogdHMpIC8gMjtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gKDIgLSBlYXNlaW4oMiAqICgxIC0gdHMpKSkgLyAyO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRyYW5zaXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuXHRcdHN1cGVyKGl0dik7XG4gICAgICAgIGxldCB7djAsIHYxLCBlYXNpbmd9ID0gZGF0YTtcbiAgICAgICAgbGV0IFt0MCwgdDFdID0gdGhpcy5faXR2LnNsaWNlKDAsMik7XG5cbiAgICAgICAgLy8gY3JlYXRlIHRoZSB0cmFuc2l0aW9uIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuX2R5bmFtaWMgPSB2MS12MCAhPSAwO1xuICAgICAgICB0aGlzLl90cmFucyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgLy8gY29udmVydCB0cyB0byBbdDAsdDFdLXNwYWNlXG4gICAgICAgICAgICAvLyAtIHNoaWZ0IGZyb20gW3QwLHQxXS1zcGFjZSB0byBbMCwodDEtdDApXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzY2FsZSBmcm9tIFswLCh0MS10MCldLXNwYWNlIHRvIFswLDFdLXNwYWNlXG4gICAgICAgICAgICB0cyA9IHRzIC0gdDA7XG4gICAgICAgICAgICB0cyA9IHRzL3BhcnNlRmxvYXQodDEtdDApO1xuICAgICAgICAgICAgLy8gZWFzaW5nIGZ1bmN0aW9ucyBzdHJldGNoZXMgb3IgY29tcHJlc3NlcyB0aGUgdGltZSBzY2FsZSBcbiAgICAgICAgICAgIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluXCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2Vpbih0cyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVhc2luZyA9PSBcImVhc2Utb3V0XCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2VvdXQodHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW5vdXQodHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbGluZWFyIHRyYW5zaXRpb24gZnJvbSB2MCB0byB2MSwgZm9yIHRpbWUgdmFsdWVzIFswLDFdXG4gICAgICAgICAgICB0cyA9IE1hdGgubWF4KHRzLCAwKTtcbiAgICAgICAgICAgIHRzID0gTWF0aC5taW4odHMsIDEpO1xuICAgICAgICAgICAgcmV0dXJuIHYwICsgKHYxLXYwKSp0cztcbiAgICAgICAgfVxuXHR9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dGhpcy5fZHluYW1pY31cblx0fVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgSU5URVJQT0xBVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogRnVuY3Rpb24gdG8gY3JlYXRlIGFuIGludGVycG9sYXRvciBmb3IgbmVhcmVzdCBuZWlnaGJvciBpbnRlcnBvbGF0aW9uIHdpdGhcbiAqIGV4dHJhcG9sYXRpb24gc3VwcG9ydC5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSB0dXBsZXMgLSBBbiBhcnJheSBvZiBbdmFsdWUsIG9mZnNldF0gcGFpcnMsIHdoZXJlIHZhbHVlIGlzIHRoZVxuICogcG9pbnQncyB2YWx1ZSBhbmQgb2Zmc2V0IGlzIHRoZSBjb3JyZXNwb25kaW5nIG9mZnNldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gLSBBIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYW4gb2Zmc2V0IGFuZCByZXR1cm5zIHRoZVxuICogaW50ZXJwb2xhdGVkIG9yIGV4dHJhcG9sYXRlZCB2YWx1ZS5cbiAqL1xuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZSh0dXBsZXMpIHtcblxuICAgIGlmICh0dXBsZXMubGVuZ3RoIDwgMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdW5kZWZpbmVkO31cbiAgICB9IGVsc2UgaWYgKHR1cGxlcy5sZW5ndGggPT0gMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdHVwbGVzWzBdWzBdO31cbiAgICB9XG5cbiAgICAvLyBTb3J0IHRoZSB0dXBsZXMgYnkgdGhlaXIgb2Zmc2V0c1xuICAgIGNvbnN0IHNvcnRlZFR1cGxlcyA9IFsuLi50dXBsZXNdLnNvcnQoKGEsIGIpID0+IGFbMV0gLSBiWzFdKTtcbiAgXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvcihvZmZzZXQpIHtcbiAgICAgIC8vIEhhbmRsZSBleHRyYXBvbGF0aW9uIGJlZm9yZSB0aGUgZmlyc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPD0gc29ydGVkVHVwbGVzWzBdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzWzBdO1xuICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1sxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBhZnRlciB0aGUgbGFzdCBwb2ludFxuICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAyXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdO1xuICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICB9XG4gIFxuICAgICAgLy8gRmluZCB0aGUgbmVhcmVzdCBwb2ludHMgdG8gdGhlIGxlZnQgYW5kIHJpZ2h0XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvcnRlZFR1cGxlcy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbaV1bMV0gJiYgb2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1tpICsgMV1bMV0pIHtcbiAgICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tpXTtcbiAgICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1tpICsgMV07XG4gICAgICAgICAgLy8gTGluZWFyIGludGVycG9sYXRpb24gZm9ybXVsYTogeSA9IHkxICsgKCAoeCAtIHgxKSAqICh5MiAtIHkxKSAvICh4MiAtIHgxKSApXG4gICAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gIFxuICAgICAgLy8gSW4gY2FzZSB0aGUgb2Zmc2V0IGRvZXMgbm90IGZhbGwgd2l0aGluIGFueSByYW5nZSAoc2hvdWxkIGJlIGNvdmVyZWQgYnkgdGhlIHByZXZpb3VzIGNvbmRpdGlvbnMpXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH07XG59XG4gIFxuXG5leHBvcnQgY2xhc3MgSW50ZXJwb2xhdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cbiAgICBjb25zdHJ1Y3RvcihpdHYsIHR1cGxlcykge1xuICAgICAgICBzdXBlcihpdHYpO1xuICAgICAgICAvLyBzZXR1cCBpbnRlcnBvbGF0aW9uIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuX3RyYW5zID0gaW50ZXJwb2xhdGUodHVwbGVzKTtcbiAgICB9XG5cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdGhpcy5fdHJhbnMob2Zmc2V0KSwgZHluYW1pYzp0cnVlfTtcbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExPQUQgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgZnVuY3Rpb24gbG9hZF9zZWdtZW50KGl0diwgaXRlbSkge1xuICAgIGxldCB7dHlwZT1cInN0YXRpY1wiLCBkYXRhfSA9IGl0ZW07XG4gICAgaWYgKHR5cGUgPT0gXCJzdGF0aWNcIikge1xuICAgICAgICByZXR1cm4gbmV3IFN0YXRpY1NlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJ0cmFuc2l0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBUcmFuc2l0aW9uU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcImludGVycG9sYXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IEludGVycG9sYXRpb25TZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwibW90aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNb3Rpb25TZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJ1bnJlY29nbml6ZWQgc2VnbWVudCB0eXBlXCIsIHR5cGUpO1xuICAgIH1cbn1cbiIsImltcG9ydCAqIGFzIHNyY3Byb3AgZnJvbSBcIi4vdXRpbC9hcGlfc3JjcHJvcC5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi9sYXllcl9iYXNlLmpzXCI7XG5pbXBvcnQgeyBpc19jb2xsZWN0aW9uX3Byb3ZpZGVyIH0gZnJvbSBcIi4vcHJvdmlkZXJfY29sbGVjdGlvbi5qc1wiO1xuaW1wb3J0IHsgaXNfb2JqZWN0X3Byb3ZpZGVyfSBmcm9tIFwiLi9wcm92aWRlcl9vYmplY3QuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4IH0gZnJvbSBcIi4vbmVhcmJ5X2luZGV4LmpzXCI7XG5pbXBvcnQgeyBsb2FkX3NlZ21lbnQgfSBmcm9tIFwiLi91dGlsL3NlZ21lbnRzLmpzXCI7XG5pbXBvcnQgeyB0b1N0YXRlLCBpc19maW5pdGVfbnVtYmVyLCBjaGVja19udW1iZXJ9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5pbXBvcnQgeyBlbmRwb2ludCwgaW50ZXJ2YWwgfSBmcm9tIFwiLi91dGlsL2ludGVydmFscy5qc1wiO1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19sZWFmX2xheWVyKG9iaikge1xuICAgIHJldHVybiAoKG9iaiBpbnN0YW5jZW9mIExheWVyKSAmJiBvYmouaXNMZWFmKTtcbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExFQUYgTEFZRVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGxlYWZfbGF5ZXIob3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHtcbiAgICAgICAgcHJvdmlkZXIsXG4gICAgICAgIG51bWVyaWM9ZmFsc2UsIFxuICAgICAgICBtdXRhYmxlPXRydWUsIFxuICAgICAgICBtYXNrLFxuICAgICAgICAuLi5vcHRzfSA9IG9wdGlvbnM7XG5cbiAgICBjb25zdCBsYXllciA9IG5ldyBMYXllcih7XG4gICAgICAgIENhY2hlQ2xhc3M6TGVhZkxheWVyQ2FjaGUsIFxuICAgICAgICAuLi5vcHRzLFxuICAgIH0pO1xuXG4gICAgLy8gcmVzdHJpY3Rpb25zXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGxheWVyLCBcIm51bWVyaWNcIiwge2dldDogKCkgPT4gbnVtZXJpY30pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShsYXllciwgXCJtdXRhYmxlXCIsIHtnZXQ6ICgpID0+IG11dGFibGV9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobGF5ZXIsIFwiaXRlbXNPbmx5XCIsIHtnZXQ6ICgpID0+IHRydWV9KTtcblxuICAgIC8vIG51bWVyaWMgbWFzayAtIHJlcGxhY2VzIHVuZGVmaW5lZCBmb3IgbnVtZXJpYyBsYXllcnNcbiAgICBpZiAobWFzayAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgY2hlY2tfbnVtYmVyKFwibWFza1wiLCBtYXNrKTtcbiAgICB9XG4gICAgbGF5ZXIubWFzayA9IG1hc2s7XG5cbiAgICAvLyBzZXR1cCBwcm92aWRlciBhcyBwcm9wZXJ0eVxuICAgIHNyY3Byb3AuYWRkU3RhdGUobGF5ZXIpO1xuICAgIHNyY3Byb3AuYWRkTWV0aG9kcyhsYXllcik7XG4gICAgbGF5ZXIuc3JjcHJvcF9yZWdpc3RlcihcInByb3ZpZGVyXCIpO1xuICAgIGxheWVyLnNyY3Byb3BfY2hlY2sgPSBmdW5jdGlvbiAocHJvcE5hbWUsIG9iaikge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJwcm92aWRlclwiKSB7XG4gICAgICAgICAgICBpZiAoIShpc19jb2xsZWN0aW9uX3Byb3ZpZGVyKG9iaikpICYmICEoaXNfb2JqZWN0X3Byb3ZpZGVyKG9iaikpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcIm9ialwiIG11c3QgY29sbGVjdGlvblByb3ZpZGVyIG9yIG9iamVjdFByb3ZpZGVyICR7b2JqfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG9iajsgICAgXG4gICAgICAgIH1cbiAgICB9XG4gICAgbGF5ZXIuc3JjcHJvcF9vbmNoYW5nZSA9IGZ1bmN0aW9uIChwcm9wTmFtZSwgZUFyZykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJwcm92aWRlclwiKSB7XG4gICAgICAgICAgICBpZiAoZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNfY29sbGVjdGlvbl9wcm92aWRlcihsYXllci5wcm92aWRlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIuaW5kZXggPSBuZXcgTmVhcmJ5SW5kZXgobGF5ZXIucHJvdmlkZXIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNfb2JqZWN0X3Byb3ZpZGVyKGxheWVyLnByb3ZpZGVyKSkge1xuICAgICAgICAgICAgICAgICAgICBsYXllci5pbmRleCA9IG5ldyBOZWFyYnlJbmRleChsYXllci5wcm92aWRlcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGlmIChsYXllci5pbmRleCAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNfY29sbGVjdGlvbl9wcm92aWRlcihsYXllci5wcm92aWRlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIuaW5kZXgucmVmcmVzaChlQXJnKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGlzX29iamVjdF9wcm92aWRlcihsYXllci5wcm92aWRlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIuaW5kZXgucmVmcmVzaCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBsYXllci5vbmNoYW5nZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9ICAgICAgICBcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIGNvbnZlbmllbmNlIG1ldGhvZCBmb3IgZ2V0dGluZyBpdGVtcyB2YWxpZCBhdCBvZmZzZXRcbiAgICAgKiBvbmx5IGl0ZW1zIGxheWVyIHN1cHBvcnRzIHRoaXMgbWV0aG9kXG4gICAgICovXG4gICAgbGF5ZXIuZ2V0X2l0ZW1zID0gZnVuY3Rpb24gZ2V0X2l0ZW1zKG9mZnNldCkge1xuICAgICAgICByZXR1cm4gWy4uLmxheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpLmNlbnRlcl07XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIExBWUVSIFVQREFURSBBUElcbiAgICAgKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBpZiAoIWxheWVyLnJlYWRPbmx5KSB7XG4gICAgICAgIGxheWVyLnVwZGF0ZSA9IGZ1bmN0aW9uIHVwZGF0ZShjaGFuZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gbGF5ZXJfdXBkYXRlKGxheWVyLCBjaGFuZ2VzKTtcbiAgICAgICAgfVxuICAgICAgICBsYXllci5hcHBlbmQgPSBmdW5jdGlvbiBhcHBlbmQoaXRlbXMsIG9mZnNldCkge1xuICAgICAgICAgICAgcmV0dXJuIGxheWVyX2FwcGVuZChsYXllciwgaXRlbXMsIG9mZnNldCk7XG4gICAgICAgIH0gICAgXG4gICAgfVxuIFxuICAgIC8vIGluaXRpYWxpc2VcbiAgICBsYXllci5wcm92aWRlciA9IHByb3ZpZGVyO1xuXG4gICAgcmV0dXJuIGxheWVyO1xufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMRUFGIExBWUVSIENBQ0hFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgTGVhZkxheWVycyBoYXZlIGEgQ29sbGVjdGlvblByb3ZpZGVyIG9yIGEgT2JqZWN0UHJvdmlkZXIgYXMgcHJvdmlkZXIgXG4gICAgYW5kIHVzZSBhIHNwZWNpZmljIGNhY2hlIGltcGxlbWVudGF0aW9uLCBhcyBvYmplY3RzIGluIHRoZSBcbiAgICBpbmRleCBhcmUgYXNzdW1lZCB0byBiZSBpdGVtcyBmcm9tIHRoZSBwcm92aWRlciwgbm90IG90aGVyIGxheWVyIG9iamVjdHMuIFxuICAgIE1vcmVvdmVyLCBxdWVyaWVzIGFyZSBub3QgcmVzb2x2ZWQgZGlyZWN0bHkgb24gdGhlIGl0ZW1zIGluIHRoZSBpbmRleCwgYnV0XG4gICAgcmF0aGVyIGZyb20gY29ycmVzcG9uZGluZyBzZWdtZW50IG9iamVjdHMsIGluc3RhbnRpYXRlZCBmcm9tIGl0ZW1zLlxuXG4gICAgQ2FjaGluZyBoZXJlIGFwcGxpZXMgdG8gbmVhcmJ5IHN0YXRlIGFuZCBzZWdtZW50IG9iamVjdHMuXG4qL1xuXG5jbGFzcyBMZWFmTGF5ZXJDYWNoZSB7XG4gICAgY29uc3RydWN0b3IobGF5ZXIpIHtcbiAgICAgICAgLy8gbGF5ZXJcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgLy8gY2FjaGVkIG5lYXJieSBvYmplY3RcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjYWNoZWQgc2VnbWVudFxuICAgICAgICB0aGlzLl9zZWdtZW50ID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBxdWVyeSBvcHRpb25zXG4gICAgICAgIHRoaXMuX3F1ZXJ5X29wdGlvbnMgPSB7XG4gICAgICAgICAgICB2YWx1ZUZ1bmM6IHRoaXMuX2xheWVyLnZhbHVlRnVuYyxcbiAgICAgICAgICAgIHN0YXRlRnVuYzogdGhpcy5fbGF5ZXIuc3RhdGVGdW5jLFxuICAgICAgICAgICAgbnVtZXJpYzogdGhpcy5fbGF5ZXIubnVtZXJpYyxcbiAgICAgICAgICAgIG1hc2s6IHRoaXMuX2xheWVyLm1hc2tcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBnZXQgc3JjKCkge3JldHVybiB0aGlzLl9sYXllcn07XG4gICAgZ2V0IHNlZ21lbnQoKSB7cmV0dXJuIHRoaXMuX3NlZ21lbnR9O1xuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IG5lZWRfaW5kZXhfbG9va3VwID0gKFxuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgIWludGVydmFsLmNvdmVyc19lbmRwb2ludCh0aGlzLl9uZWFyYnkuaXR2LCBvZmZzZXQpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChuZWVkX2luZGV4X2xvb2t1cCkge1xuICAgICAgICAgICAgLy8gY2FjaGUgbWlzc1xuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdGhpcy5fbGF5ZXIuaW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgICAgICBsZXQge2l0diwgY2VudGVyfSA9IHRoaXMuX25lYXJieTtcbiAgICAgICAgICAgIHRoaXMuX3NlZ21lbnRzID0gY2VudGVyLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBsb2FkX3NlZ21lbnQoaXR2LCBpdGVtKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIHBlcmZvcm0gcXVlcmllc1xuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9zZWdtZW50cy5tYXAoKHNlZykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHNlZy5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gY2FsY3VsYXRlIHNpbmdsZSByZXN1bHQgc3RhdGVcbiAgICAgICAgcmV0dXJuIHRvU3RhdGUodGhpcy5fc2VnbWVudHMsIHN0YXRlcywgb2Zmc2V0LCB0aGlzLl9xdWVyeV9vcHRpb25zKTtcbiAgICB9XG5cbiAgICBjbGVhcigpIHtcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9zZWdtZW50ID0gdW5kZWZpbmVkO1xuICAgIH1cbn1cblxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExBWUVSIFVQREFURVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIE5PVEUgLSBsYXllciB1cGRhdGUgaXMgZXNzZW50aWFsbHkgYWJvdXQgc3RhdGVQcm92aWRlciB1cGRhdGUuXG4gKiBzbyB0aGVzZSBtZXRob2RzIGNvdWxkIChmb3IgdGhlIG1vc3QgcGFydCkgYmUgbW92ZWQgdG8gdGhlIHByb3ZpZGVyLlxuICogSG93ZXZlciwgdXBkYXRlX2FwcGVuZCBiZW5lZml0cyBmcm9tIHVzaW5nIHRoZSBpbmRleCBvZiB0aGUgbGF5ZXIsXG4gKiBzbyB3ZSBrZWVwIGl0IGhlcmUgZm9yIG5vdy4gXG4gKi9cblxuLypcbiAgICBJdGVtcyBMYXllciBmb3J3YXJkcyB1cGRhdGUgdG8gc3RhdGVQcm92aWRlclxuKi9cbmZ1bmN0aW9uIGxheWVyX3VwZGF0ZShsYXllciwgY2hhbmdlcz17fSkge1xuXG4gICAgY2hhbmdlcy5pbnNlcnQgPz89IFtdO1xuXG4gICAgLy8gY2hlY2sgbnVtYmVyIHJlc3RyaWN0aW9uXG4gICAgLy8gY2hlY2sgdGhhdCBzdGF0aWMgaXRlbXMgYXJlIHJlc3RyaWN0ZWQgdG8gbnVtYmVyc1xuICAgIC8vIG90aGVyIGl0ZW0gdHlwZXMgYXJlIHJlc3RyaWN0ZWQgdG8gbnVtYmVycyBieSBkZWZhdWx0XG4gICAgaWYgKGxheWVyLmlzTnVtYmVyT25seSkge1xuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGNoYW5nZXMuaW5zZXJ0KSB7XG4gICAgICAgICAgICBpdGVtLnR5cGUgPz89IFwic3RhdGljXCI7XG4gICAgICAgICAgICBpZiAoaXRlbS50eXBlID09IFwic3RhdGljXCIgJiYgIWlzX2Zpbml0ZV9udW1iZXIoaXRlbS5kYXRhKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTGF5ZXIgaXMgbnVtYmVyIG9ubHksIGJ1dCBpdGVtICR7aXRlbX0gaXMgbm90IGEgbnVtYmVyYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaXNfY29sbGVjdGlvbl9wcm92aWRlcihsYXllci5wcm92aWRlcikpIHtcbiAgICAgICAgcmV0dXJuIGxheWVyLnByb3ZpZGVyLnVwZGF0ZShjaGFuZ2VzKTtcbiAgICB9IGVsc2UgaWYgKGlzX29iamVjdF9wcm92aWRlcihsYXllci5wcm92aWRlcikpIHsgICAgIFxuICAgICAgICBsZXQge1xuICAgICAgICAgICAgaW5zZXJ0PVtdLFxuICAgICAgICAgICAgcmVtb3ZlPVtdLFxuICAgICAgICAgICAgcmVzZXQ9ZmFsc2VcbiAgICAgICAgfSA9IGNoYW5nZXM7XG4gICAgICAgIGlmIChyZXNldCkge1xuICAgICAgICAgICAgcmV0dXJuIGxheWVyLnByb3ZpZGVyLnNldChpbnNlcnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgbWFwID0gbmV3IE1hcCgobGF5ZXIucHJvdmlkZXIuZ2V0KCkgfHwgW10pXG4gICAgICAgICAgICAgICAgLm1hcCgoaXRlbSkgPT4gW2l0ZW0uaWQsIGl0ZW1dKSk7XG4gICAgICAgICAgICAvLyByZW1vdmVcbiAgICAgICAgICAgIHJlbW92ZS5mb3JFYWNoKChpZCkgPT4gbWFwLmRlbGV0ZShpZCkpO1xuICAgICAgICAgICAgLy8gaW5zZXJ0XG4gICAgICAgICAgICBpbnNlcnQuZm9yRWFjaCgoaXRlbSkgPT4gbWFwLnNldChpdGVtLmlkLCBpdGVtKSk7XG4gICAgICAgICAgICAvLyBzZXRcbiAgICAgICAgICAgIGNvbnN0IGl0ZW1zID0gQXJyYXkuZnJvbShtYXAudmFsdWVzKCkpO1xuICAgICAgICAgICAgcmV0dXJuIGxheWVyLnByb3ZpZGVyLnNldChpdGVtcyk7XG4gICAgICAgIH1cbiAgICB9XG59XG4gICAgXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUiBBUFBFTkRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBhcHBlbmQgaXRlbXMgdG8gbGF5ZXIgYXQgb2Zmc2V0XG4gKiBcbiAqIGFwcGVuZCBpbXBsaWVzIHRoYXQgcHJlLWV4aXN0aW5nIGl0ZW1zIGJleW9uZCBvZmZzZXQsXG4gKiB3aWxsIGVpdGhlciBiZSByZW1vdmVkIG9yIHRydW5jYXRlZCwgc28gdGhhdCB0aGUgbGF5ZXJcbiAqIGlzIGVtcHR5IGFmdGVyIG9mZnNldC5cbiAqIFxuICogaXRlbXMgd2lsbCBvbmx5IGJlIGluc2VydGVkIGFmdGVyIG9mZnNldCwgc28gYW55IG5ld1xuICogaXRlbSBiZWZvcmUgb2Zmc2V0IHdpbGwgYmUgdHJ1bmNhdGVkIG9yIGRyb3BwZWQuXG4gKiBcbiAqIG5ldyBpdGVtcyB3aWxsIG9ubHkgYmUgYmUgYXBwbGllZCBmb3IgdCA+PSBvZmZzZXRcbiAqIG9sZCBpdGVtcyB3aWxsIGJlIGtlcHQgZm9yIHQgPCBvZmZzZXRcbiAqIFxuICogXG4gKi9cbmZ1bmN0aW9uIGxheWVyX2FwcGVuZChsYXllciwgaXRlbXMsIG9mZnNldCkge1xuICAgIGNvbnN0IGVwID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuICAgIFxuICAgIC8vIHRydW5jYXRlIG9yIHJlbW92ZSBuZXcgaXRlbXMgYmVmb3JlIG9mZnNldFxuICAgIGNvbnN0IGluc2VydF9pdGVtcyA9IGl0ZW1zXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIC8vIGtlZXAgb25seSBpdGVtcyB3aXRoIGl0di5oaWdoID49IG9mZnNldFxuICAgICAgICAgICAgY29uc3QgaGlnaEVwID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMV07XG4gICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuZ2UoaGlnaEVwLCBlcCk7XG4gICAgICAgIH0pXG4gICAgICAgIC5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIC8vIHRydW5jYXRlIGl0ZW0gb3ZlcmxhcHBpbmcgb2Zmc2V0IGl0di5sb3c9b2Zmc2V0XG4gICAgICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KGl0ZW0uaXR2LCBlcCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdfaXRlbSA9IHsuLi5pdGVtfTtcbiAgICAgICAgICAgICAgICBuZXdfaXRlbS5pdHYgPSBbb2Zmc2V0LCBpdGVtLml0dlsxXSwgdHJ1ZSwgaXRlbS5pdHZbM11dO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXdfaXRlbTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgICB9KTtcbiAgICBcbiAgICAvLyBjb25zb2xlLmxvZyhcImluc2VydFwiLCBpbnNlcnRfaXRlbXMpO1xuXG4gICAgLy8gdHJ1bmNhdGUgcHJlLWV4aXN0aW5nIGl0ZW1zIG92ZXJsYXBwaW5nIG9mZnNldFxuICAgIGNvbnN0IG1vZGlmeV9pdGVtcyA9IGxheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpLmNlbnRlci5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgY29uc3QgbmV3X2l0ZW0gPSB7Li4uaXRlbX07XG4gICAgICAgIG5ld19pdGVtLml0diA9IFtpdGVtLml0dlswXSwgb2Zmc2V0LCBpdGVtLml0dlsyXSwgZmFsc2VdO1xuICAgICAgICByZXR1cm4gbmV3X2l0ZW07XG4gICAgfSk7XG4gICAgXG4gICAgLy8gY29uc29sZS5sb2coXCJtb2RpZnlcIiwgbW9kaWZ5X2l0ZW1zKTtcblxuICAgIC8vIHJlbW92ZSBwcmUtZXhpc3RpbmcgZnV0dXJlIC0gaXRlbXMgY292ZXJpbmcgaXR2LmxvdyA+IG9mZnNldFxuICAgIGNvbnN0IHJlbW92ZSA9IGxheWVyLnByb3ZpZGVyLmdldCgpXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGxvd0VwID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMF07XG4gICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuZ3QobG93RXAsIGVwKTtcbiAgICAgICAgfSlcbiAgICAgICAgLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGl0ZW0uaWQ7XG4gICAgICAgIH0pO1xuXG4gICAgLy8gY29uc29sZS5sb2coXCJyZW1vdmVcIiwgcmVtb3ZlKTtcblxuICAgIC8vIGxheWVyIHVwZGF0ZVxuICAgIGNvbnN0IGluc2VydCA9IFsuLi5tb2RpZnlfaXRlbXMsIC4uLmluc2VydF9pdGVtc107XG4gICAgcmV0dXJuIGxheWVyX3VwZGF0ZShsYXllciwge3JlbW92ZSwgaW5zZXJ0LCByZXNldDpmYWxzZX0pXG59XG5cblxuXG4iLCJpbXBvcnQgeyBDdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3JfYmFzZS5qc1wiO1xuaW1wb3J0IHsgQ2xvY2tQcm92aWRlciB9IGZyb20gXCIuL3Byb3ZpZGVyX2Nsb2NrLmpzXCI7XG5pbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuL3V0aWwvYXBpX3NyY3Byb3AuanNcIjtcbmltcG9ydCB7IGxvY2FsX2Nsb2NrIH0gZnJvbSBcIi4vdXRpbC9jb21tb24uanNcIjtcblxuLyoqXG4gKiBDbG9jayBDdXJzb3IgaXMgYSBjdXJzb3IgdGhhdCB3cmFwcyBhIGNsb2NrIHByb3ZpZGVyLCB3aGljaCBpcyBhdmFpbGFibGUgXG4gKiBvbiB0aGUgcHJvdmlkZXIgcHJvcGVydHkuXG4gKiBcbiAqIENsb2NrIGN1cnNvciBkb2VzIG5vdCBkZXBlbmQgb24gYSBzcmMgbGF5ZXIgb3IgYSBjdHJsIGN1cnNvci4gXG4gKiBDbG9jayBjdXJzb3IgaXMgRml4ZWRSYXRlIEN1cnNvciAoYnBtIDEpXG4gKiBDbG9jayBjdXJzb3IgaXMgTnVtYmVyT25seVxuICogXG4gKiBDbG9jayBjdXJzb3IgdGFrZSBvcHRpb25zIHtza2V3LCBzY2FsZX0gdG8gdHJhbnNmb3JtIHRoZSBjbG9jayB2YWx1ZS5cbiAqIFNjYWxlIGlzIG11bHRpcGxpZXIgdG8gdGhlIGNsb2NrIHZhbHVlLCBhcHBsaWVkIGJlZm9yZSB0aGUgc2tldyBzbyB0aGF0XG4gKiBpdCBwcmVzZXJ2ZXMgdGhlIHplcm8gcG9pbnQuXG4gKiBcbiAqIFRoZSBDbG9jayBjdXJzb3IgZ2VuZXJhbGx5IGRvZXMgbm90IGludm9rZSBhbnkgY2FsbGJhY2ssIGFzIGl0IGlzIGFsd2F5cyBpbiBkeW5hbWljIHN0YXRlLlxuICogSG93ZXZlciwgYSBjYWxsYmFjayB3aWxsIGJlIGludm9rZWQgaWYgdGhlIGNsb2NrcHJvdmlkZXIgaXMgY2hhbmdlZCB0aHJvdWdoIFxuICogYXNzaWdubWVudCBvZiB0aGUgcHJvdmlkZXIgcHJvcGVydHkuXG4gKiBcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gY2xvY2tfY3Vyc29yKG9wdGlvbnM9e30pIHtcblxuICAgIGNvbnN0IHtwcm92aWRlciwgc2hpZnQ9MCwgc2NhbGU9MS4wfSA9IG9wdGlvbnM7XG5cbiAgICBjb25zdCBjdXJzb3IgPSBuZXcgQ3Vyc29yKCk7XG5cbiAgICAvLyByZXN0cmljdGlvbnNcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3Vyc29yLCBcIm51bWVyaWNcIiwge2dldDogKCkgPT4gdHJ1ZX0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjdXJzb3IsIFwiZml4ZWRSYXRlXCIsIHtnZXQ6ICgpID0+IHRydWV9KTtcblxuICAgIC8vIHF1ZXJ5XG4gICAgY3Vyc29yLnF1ZXJ5ID0gZnVuY3Rpb24gKGxvY2FsX3RzPWxvY2FsX2Nsb2NrLm5vdygpKSB7XG4gICAgICAgIGNvbnN0IGNsb2NrX3RzID0gcHJvdmlkZXIubm93KGxvY2FsX3RzKTtcbiAgICAgICAgY29uc3QgdmFsdWUgPSAoY2xvY2tfdHMgKiBzY2FsZSkgKyBzaGlmdDtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZSwgZHluYW1pYzp0cnVlLCBvZmZzZXQ6bG9jYWxfdHN9O1xuICAgIH1cblxuICAgIC8vIHNldHVwIHByb3ZpZGVyIGFzIHNldHRhYmxlIHByb3BlcnR5XG4gICAgc3JjcHJvcC5hZGRTdGF0ZShjdXJzb3IpO1xuICAgIHNyY3Byb3AuYWRkTWV0aG9kcyhjdXJzb3IpO1xuICAgIGN1cnNvci5zcmNwcm9wX3JlZ2lzdGVyKFwicHJvdmlkZXJcIik7XG4gICAgY3Vyc29yLnNyY3Byb3BfY2hlY2sgPSBmdW5jdGlvbiAocHJvcE5hbWUsIG9iaikge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJwcm92aWRlclwiKSB7XG4gICAgICAgICAgICBpZiAoIShvYmogaW5zdGFuY2VvZiBDbG9ja1Byb3ZpZGVyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgcHJvdmlkZXIgbXVzdCBiZSBjbG9ja1Byb3ZpZGVyICR7cHJvdmlkZXJ9YCk7XG4gICAgICAgICAgICB9ICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBvYmo7ICAgIFxuICAgICAgICB9XG4gICAgfVxuICAgIGN1cnNvci5zcmNwcm9wX29uY2hhbmdlID0gZnVuY3Rpb24gKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInByb3ZpZGVyXCIpIHtcbiAgICAgICAgICAgIGlmIChlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIGN1cnNvci5vbmNoYW5nZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9ICAgICAgICBcbiAgICB9XG5cbiAgICAvLyBpbml0aWFsaXNlXG4gICAgY3Vyc29yLnJhdGUgPSAxLjAgKiBzY2FsZTtcbiAgICBjdXJzb3IucHJvdmlkZXIgPSBwcm92aWRlcjtcbiAgICByZXR1cm4gY3Vyc29yO1xufVxuIiwiaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4vY3Vyc29yX2Jhc2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4vbGF5ZXJfYmFzZS5qc1wiO1xuaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi91dGlsL2FwaV9zcmNwcm9wLmpzXCI7XG5pbXBvcnQgeyBjaGVja19udW1iZXIsIHNldF90aW1lb3V0fSBmcm9tIFwiLi91dGlsL2NvbW1vbi5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogUExBWUJBQ0sgQ1VSU09SXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogZ2VuZXJpYyBwbGF5YmFjayBjdXJzb3JcbiAqIFxuICogXCJzcmNcIiBpcyBhIGxheWVyXG4gKiBcImN0cmxcIiBpcyBjdXJzb3IgKE51bWJlcilcbiAqIHJldHVybnMgYSBjdXJzb3JcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gcGxheWJhY2tfY3Vyc29yKG9wdGlvbnM9e30pIHtcblxuICAgIGNvbnN0IHtjdHJsLCBzcmMsIFxuICAgICAgICBtdXRhYmxlPWZhbHNlfSA9IG9wdGlvbnM7XG5cbiAgICBsZXQgc3JjX2NhY2hlOyAvLyBjYWNoZSBmb3Igc3JjIGxheWVyXG4gICAgbGV0IHRpZDsgLy8gdGltZW91dFxuICAgIGxldCBwaWQ7IC8vIHBvbGxpbmdcblxuICAgIGNvbnN0IGN1cnNvciA9IG5ldyBDdXJzb3IoKTtcblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUkVTVFJJQ1RJT05TXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3Vyc29yLCBcIm51bWVyaWNcIiwge2dldDogKCkgPT4ge1xuICAgICAgICByZXR1cm4gKGN1cnNvci5zcmMgIT0gdW5kZWZpbmVkKSA/IGN1cnNvci5zcmMubnVtZXJpYyA6IGZhbHNlO1xuICAgIH19KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3Vyc29yLCBcIm11dGFibGVcIiwge2dldDogKCkgPT4ge1xuICAgICAgICByZXR1cm4gKGN1cnNvci5zcmMgIT0gdW5kZWZpbmVkKSA/IChjdXJzb3Iuc3JjLm11dGFibGUgJiYgbXV0YWJsZSkgOiBmYWxzZTtcbiAgICB9fSk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGN1cnNvciwgXCJpdGVtc09ubHlcIiwge2dldDogKCkgPT4ge1xuICAgICAgICByZXR1cm4gKGN1cnNvci5zcmMgIT0gdW5kZWZpbmVkKSA/IGN1cnNvci5zcmMuaXRlbXNPbmx5IDogZmFsc2U7XG4gICAgfX0pO1xuXG4gICAgXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBTUkMgQU5EIENUUkwgUFJPUEVSVElFU1xuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgc3JjcHJvcC5hZGRTdGF0ZShjdXJzb3IpO1xuICAgIHNyY3Byb3AuYWRkTWV0aG9kcyhjdXJzb3IpO1xuICAgIGN1cnNvci5zcmNwcm9wX3JlZ2lzdGVyKFwiY3RybFwiKTtcbiAgICBjdXJzb3Iuc3JjcHJvcF9yZWdpc3RlcihcInNyY1wiKTtcblxuICAgIGN1cnNvci5zcmNwcm9wX2NoZWNrID0gZnVuY3Rpb24gKHByb3BOYW1lLCBvYmopIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwiY3RybFwiKSB7XG4gICAgICAgICAgICBpZiAoIShvYmogaW5zdGFuY2VvZiBDdXJzb3IpIHx8IG9iai5udW1lcmljID09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcImN0cmxcIiBwcm9wZXJ0eSBtdXN0IGJlIGEgbnVtZXJpYyBjdXJzb3IgJHtvYmp9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAoIShvYmogaW5zdGFuY2VvZiBMYXllcikpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwic3JjXCIgcHJvcGVydHkgbXVzdCBiZSBhIGxheWVyICR7b2JqfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgfVxuICAgIH1cbiAgICBjdXJzb3Iuc3JjcHJvcF9vbmNoYW5nZSA9IGZ1bmN0aW9uIChwcm9wTmFtZSwgZUFyZykge1xuICAgICAgICBpZiAoY3Vyc29yLnNyYyA9PSB1bmRlZmluZWQgfHwgY3Vyc29yLmN0cmwgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmIChlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIHNyY19jYWNoZSA9IGN1cnNvci5zcmMuY3JlYXRlQ2FjaGUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3JjX2NhY2hlLmNsZWFyKCk7ICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGN1cnNvci5vbmNoYW5nZSgpO1xuICAgIH1cblxuICAgIGN1cnNvci5xdWVyeSA9IGZ1bmN0aW9uIHF1ZXJ5KGxvY2FsX3RzKSB7XG4gICAgICAgIGxldCBvZmZzZXQgPSBjdXJzb3IuY3RybC5xdWVyeShsb2NhbF90cykudmFsdWU7XG4gICAgICAgIC8vIHNob3VsZCBub3QgaGFwcGVuXG4gICAgICAgIGNoZWNrX251bWJlcihcImN1cnNvci5jdHJsLm9mZnNldFwiLCBvZmZzZXQpO1xuICAgICAgICBjb25zdCBzdGF0ZSA9IHNyY19jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgICAgICAvLyBpZiAoc3JjKSBsYXllciBpcyBudW1lcmljLCBkZWZhdWx0IHZhbHVlIDAgXG4gICAgICAgIC8vIGlzIGFzc3VtZWQgaW4gcmVnaW9ucyB3aGVyZSB0aGUgbGF5ZXIgaXMgdW5kZWZpbmVkXG4gICAgICAgIGlmIChjdXJzb3Iuc3JjLm51bWVyaWMgJiYgc3RhdGUudmFsdWUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzdGF0ZS52YWx1ZSA9IDAuMDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfVxuXG4gICAgY3Vyc29yLmFjdGl2ZV9pdGVtcyA9IGZ1bmN0aW9uIGdldF9pdGVtKGxvY2FsX3RzKSB7XG4gICAgICAgIGlmIChjdXJzb3IuaXRlbXNPbmx5KSB7XG4gICAgICAgICAgICBjb25zdCBvZmZzZXQgPSBjdXJzb3IuY3RybC5xdWVyeShsb2NhbF90cykudmFsdWU7XG4gICAgICAgICAgICByZXR1cm4gY3Vyc29yLnNyYy5pbmRleC5uZWFyYnkob2Zmc2V0KS5jZW50ZXI7ICAgIFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBERVRFQ1QgRlVUVVJFIEVWRU5UXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICAvKipcbiAgICAgKiBmaXhlZCByYXRlIGN1cnNvcnMgbmV2ZXIgY2hhbmdlIHRoZWlyIGJlaGF2aW9yIC0gYW5kXG4gICAgICogY29uc2VxdWVudGx5IG5ldmVyIGhhcyB0byBpbnZva2UgYW55IGNhbGxiYWNrcyAvIGV2ZW50c1xuICAgICAqIFxuICAgICAqIE90aGVyIGN1cnNvcnMgbWF5IGNoYW5nZSBiZWhhdmlvdXIgYXQgYSBmdXR1cmUgdGltZS5cbiAgICAgKiBJZiB0aGlzIGZ1dHVyZSBjaGFuZ2UgaXMgY2F1c2VkIGJ5IGEgc3RhdGUgY2hhbmdlIC0gXG4gICAgICogZWl0aGVyIGluIChzcmMpIGxheWVyIG9yIChjdHJsKSBjdXJzb3IgLSBldmVudHMgd2lsbCBiZSBcbiAgICAgKiB0cmlnZ2VyZWQgaW4gcmVzcG9uc2UgdG8gdGhpcy4gXG4gICAgICogXG4gICAgICogSG93ZXZlciwgY3Vyc29ycyBtYXkgYWxzbyBjaGFuZ2UgYmVoYXZpb3VyIGF0IGEgZnV0dXJlIHRpbWUgbW9tZW50XG4gICAgICogaW4gdGltZSwgd2l0aG91dCBhbnkgY2F1c2luZyBzdGF0ZSBjaGFuZ2UuIFRoaXMgbWF5IGhhcHBlbiBkdXJpbmcgXG4gICAgICogcGxheWJhY2ssIGFzIHRoZSAoY3RybCkgY3Vyc29yIGxlYXZlcyB0aGUgY3VycmVudCByZWdpb24gXG4gICAgICogb2YgdGhlIChzcmMpIGxheWVyIGFuZCBlbnRlcnMgaW50byB0aGUgbmV4dCByZWdpb24uXG4gICAgICogXG4gICAgICogVGhpcyBldmVudCBtdXN0IGJlIGRldGVjdGVkLCBpZGVhbGx5IGF0IHRoZSByaWdodCBtb21lbnQsIFxuICAgICAqIHNvIHRoYXQgdGhlIGN1cnNvciBjYW4gZ2VuZXJhdGUgZXZlbnRzLCBhbGxvd2luZyBvYnNlcnZlcnMgdG9cbiAgICAgKiByZWFjdCB0byB0aGUgY2hhbmdlLiBJZiB0aGUgKGN0cmwpIGN1cnNvciBiZWhhdmVzIGRldGVybWluaXN0aWNhbGx5LCBcbiAgICAgKiB0aGlzIGZ1dHVyZSBldmVudCBjYW4gYmUgY2FsY3VsYXRlZCBhaGVhZCBvZiB0aW1lLCBcbiAgICAgKiBhbmQgZGV0ZWN0ZWQgYnkgdGltZW91dC4gT3RoZXJ3aXNlLCB0aGUgZmFsbGJhY2sgc29sdXRpb24gaXMgdG9cbiAgICAgKiBkZXRlY3Qgc3VjaCBmdXR1cmUgZXZlbnRzIGJ5IHBvbGxpbmcuXG4gICAgICogXG4gICAgICogTk9URSBjb25zdW1lcnMgb2YgY3Vyc29ycyBtaWdodCBwb2xsIHRoZSBjdXJzb3IgdGhlbXNlbHZlcywgdGh1cyBcbiAgICAgKiBjYXVzaW5nIHRoZSBldmVudCB0byBiZSBkZXRlY3RlZCB0aGF0IHdheS4gSG93ZXZlciwgdGhlcmUgaXMgbm8gXG4gICAgICogZ3VhcmFudGVlIHRoYXQgdGhpcyB3aWxsIGhhcHBlbi4gRm9yIGV4YW1wbGUsIGluIGNpcmN1bXN0YW5jZXMgXG4gICAgICogd2hlcmUgdGhlIChzcmMpIGxheWVyIHJlZ2lvbiBpcyBzdGF0aWMsIGNvbnN1bWVycyB3aWxsIHR1cm5cbiAgICAgKiBwb2xsaW5nIG9mZiwgYW5kIGRlcGVuZCBvbiB0aGUgY2hhbmdlIGV2ZW50IGZyb20gdGhlIGN1cnNvciwgaW4gb3JkZXIgXG4gICAgICogdG8gZGV0ZWN0IHRoZSBjaGFuZ2UgaW4gYmVoYXZpb3IuXG4gICAgICogXG4gICAgICovXG4gICAgY3Vyc29yLmRldGVjdF9mdXR1cmVfZXZlbnQgPSBmdW5jdGlvbiBkZXRlY3RfZnV0dXJlX2V2ZW50KCkge1xuXG4gICAgICAgIGNhbmNlbF90aW1lb3V0KCk7XG4gICAgICAgIGNhbmNlbF9wb2xsaW5nKCk7XG5cbiAgICAgICAgLy8gbm8gZnV0dXJlIHRpbWVvdXQgaWYgY3Vyc29yIGl0c2VsZiBpcyBmaXhlZFJhdGVcbiAgICAgICAgaWYgKGN1cnNvci5maXhlZFJhdGUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFsbCBvdGhlciBjdXJzb3JzIG11c3QgaGF2ZSAoc3JjKSBhbmQgKGN0cmwpXG4gICAgICAgIGlmIChjdXJzb3IuY3RybCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImN1cnNvci5jdHJsIGNhbiBub3QgYmUgdW5kZWZpbmVkIHdpdGggaXNGaXhlZFJhdGU9ZmFsc2VcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN1cnNvci5zcmMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjdXJzb3Iuc3JjIGNhbiBub3QgYmUgdW5kZWZpbmVkIHdpdGggaXNGaXhlZFJhdGU9ZmFsc2VcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjdXJyZW50IHN0YXRlIG9mIGN1cnNvci5jdHJsIFxuICAgICAgICBjb25zdCB7dmFsdWU6cG9zMCwgZHluYW1pYywgb2Zmc2V0OnRzMH0gPSBjdXJzb3IuY3RybC5xdWVyeSgpO1xuXG4gICAgICAgIC8vIG5vIGZ1dHVyZSB0aW1lb3V0IGlmIGN1cnNvci5jdHJsIGlzIHN0YXRpY1xuICAgICAgICBpZiAoIWR5bmFtaWMpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGN1cnJlbnQgcmVnaW9uIG9mIGN1cnNvci5zcmNcbiAgICAgICAgY29uc3Qgc3JjX25lYXJieSA9IGN1cnNvci5zcmMuaW5kZXgubmVhcmJ5KHBvczApO1xuICAgICAgICBjb25zdCBzcmNfcmVnaW9uX2xvdyA9IHNyY19uZWFyYnkuaXR2WzBdID8/IC1JbmZpbml0eTtcbiAgICAgICAgY29uc3Qgc3JjX3JlZ2lvbl9oaWdoID0gc3JjX25lYXJieS5pdHZbMV0gPz8gSW5maW5pdHk7XG5cbiAgICAgICAgaWYgKHNyY19yZWdpb25fbG93ID09IC1JbmZpbml0eSAmJiBzcmNfcmVnaW9uX2hpZ2ggPT0gSW5maW5pdHkpIHtcbiAgICAgICAgICAgIC8vIHVuYm91bmRlZCBzcmMgcmVnaW9uIC0gbm8gZXZlbnRcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNoZWNrIGlmIGNvbmRpdGlvbiBmb3IgY2xvY2sgdGltZW91dCBpcyBtZXRcbiAgICAgICAgaWYgKGN1cnNvci5jdHJsLmZpeGVkUmF0ZSkge1xuICAgICAgICAgICAgLyogXG4gICAgICAgICAgICAgICAgY3Vyc29yLmN0cmwgaXMgZml4ZWQgcmF0ZSAoY2xvY2spXG4gICAgICAgICAgICAgICAgZnV0dXJlIHRpbWVvdXQgd2hlbiBjdXJzb3IuY3RybCBsZWF2ZXMgc3JjX3JlZ2lvbiAob24gdGhlIHJpZ2h0KVxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGNvbnN0IHZlY3RvciA9IFtwb3MwLCBjdXJzb3IuY3RybC5yYXRlLCAwLCB0czBdO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gc3JjX3JlZ2lvbl9oaWdoXG4gICAgICAgICAgICBzY2hlZHVsZV90aW1lb3V0KHZlY3RvciwgdGFyZ2V0KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNoZWNrIGlmIGNvbmRpdGlvbnMgZm9yIG1vdGlvbiB0aW1lb3V0IGFyZSBtZXRcbiAgICAgICAgLy8gY3Vyc29yLmN0cmwuY3RybCBtdXN0IGJlIGZpeGVkIHJhdGVcbiAgICAgICAgLy8gY3Vyc29yLmN0cmwuc3JjIG11c3QgaGF2ZSBpdGVtc09ubHkgPT0gdHJ1ZSBcbiAgICAgICAgaWYgKGN1cnNvci5jdHJsLmN0cmwuZml4ZWRSYXRlICYmIGN1cnNvci5jdHJsLnNyYy5pdGVtc09ubHkpIHtcbiAgICAgICAgICAgIC8qIFxuICAgICAgICAgICAgICAgIHBvc3NpYmxlIHRpbWVvdXQgYXNzb2NpYXRlZCB3aXRoIGxlYXZpbmcgcmVnaW9uXG4gICAgICAgICAgICAgICAgdGhyb3VnaCBlaXRoZXIgcmVnaW9uX2xvdyBvciByZWdpb25faGlnaC5cblxuICAgICAgICAgICAgICAgIEhvd2V2ZXIsIHRoaXMgY2FuIG9ubHkgYmUgcHJlZGljdGVkIGlmIGN1cnNvci5jdHJsXG4gICAgICAgICAgICAgICAgaW1wbGVtZW50cyBhIGRldGVybWluaXN0aWMgZnVuY3Rpb24gb2YgdGltZS5cbiAgICAgICAgICAgICAgICBUaGlzIGNhbiBiZSBrbm93biBvbmx5IGlmIGN1cnNvci5jdHJsLnNyYyBpcyBhIGxheWVyIHdpdGggaXRlbXMuXG4gICAgICAgICAgICAgICAgYW5kIGEgc2luZ2xlIGFjdGl2ZSBpdGVtIGRlc2NyaWJlcyBlaXRoZXIgYSBtb3Rpb24gb3IgYSB0cmFuc2l0aW9uIFxuICAgICAgICAgICAgICAgICh3aXRoIGxpbmVhciBlYXNpbmcpLiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBjb25zdCBhY3RpdmVfaXRlbXMgPSBjdXJzb3IuY3RybC5zcmMuZ2V0X2l0ZW1zKHRzMCk7XG4gICAgICAgICAgICBpZiAoYWN0aXZlX2l0ZW1zLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYWN0aXZlX2l0ZW0gPSBhY3RpdmVfaXRlbXNbMF07XG4gICAgICAgICAgICAgICAgaWYgKGFjdGl2ZV9pdGVtLnR5cGUgPT0gXCJtb3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBbcCx2LGEsdF0gPSBhY3RpdmVfaXRlbS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPIGNhbGN1bGF0ZSB0aW1lb3V0IHdpdGggYWNjZWxlcmF0aW9uIHRvb1xuICAgICAgICAgICAgICAgICAgICBpZiAoYSA9PSAwLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggcmVnaW9uIGJvdW5kYXJ5IHdlIGhpdCBmaXJzdFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gKHYgPiAwKSA/IHNyY19yZWdpb25faGlnaCA6IHNyY19yZWdpb25fbG93O1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmVjdG9yID0gW3BvczAsIHYsIDAsIHRzMF07XG4gICAgICAgICAgICAgICAgICAgICAgICBzY2hlZHVsZV90aW1lb3V0KHZlY3RvciwgdGFyZ2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWN0aXZlX2l0ZW0udHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7djAsIHYxLCB0MCwgdDEsIGVhc2luZz1cImxpbmVhclwifSA9IGFjdGl2ZV9pdGVtLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlYXNpbmcgPT0gXCJsaW5lYXJcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGluZWFyIHRyYW5zaXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHYgPSAodjEtdjApLyh0MS10MCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXQgPSAodiA+IDApID8gc3JjX3JlZ2lvbl9oaWdoIDogc3JjX3JlZ2lvbl9sb3c7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2ZWN0b3IgPSBbcG9zMCwgdiwgMCwgdHMwXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjaGVkdWxlX3RpbWVvdXQodmVjdG9yLCB0YXJnZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuOyAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9ICAgICAgICAgICAgXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGRldGVjdGlvbiBvZiBsZWF2ZSBldmVudHMgZmFsbHMgYmFjayBvbiBwb2xsaW5nXG4gICAgICAgICAqL1xuICAgICAgICBzdGFydF9wb2xsaW5nKHNyY19yZWdpb25fbG93LCBzcmNfcmVnaW9uX2hpZ2gpO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogVElNRU9VVFxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgZnVuY3Rpb24gc2NoZWR1bGVfdGltZW91dCh2ZWN0b3IsIHRhcmdldCkge1xuICAgICAgICBjb25zdCBbcCx2LGEsdF0gPSB2ZWN0b3I7XG4gICAgICAgIGlmIChhICE9IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInRpbWVvdXQgbm90IHlldCBpbXBsZW1lbnRlZCBmb3IgYWNjZWxlcmF0aW9uXCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0YXJnZXQgPT0gSW5maW5pdHkgfHwgdGFyZ2V0ID09IC1JbmZpbml0eSkge1xuICAgICAgICAgICAgLy8gbm8gdGltZW91dFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRlbHRhX3NlYyA9ICh0YXJnZXQgLSBwKSAvIHY7XG4gICAgICAgIGlmIChkZWx0YV9zZWMgPD0gMCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJXYXJuaW5nIC0gdGltZW91dCA8PSAwIC0gZHJvcHBpbmdcIiwgZGVsdGFfc2VjKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwidmVjdG9yXCIsIHZlY3Rvcik7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInRhcmdldFwiLCB0YXJnZXQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRpZCA9IHNldF90aW1lb3V0KGhhbmRsZV90aW1lb3V0LCBkZWx0YV9zZWMgKiAxMDAwLjApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhbmRsZV90aW1lb3V0KCkge1xuICAgICAgICAvLyBldmVudCBkZXRlY3RlZFxuICAgICAgICBjdXJzb3Iub25jaGFuZ2UoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYW5jZWxfdGltZW91dCgpIHtcbiAgICAgICAgaWYgKHRpZCAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRpZC5jYW5jZWwoKTsgXG4gICAgICAgIH0gICAgXG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBQT0xMSU5HXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBmdW5jdGlvbiBzdGFydF9wb2xsaW5nKHRhcmdldExvdywgdGFyZ2V0SGlnaCkge1xuICAgICAgICBwaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICBoYW5kbGVfcG9sbGluZyh0YXJnZXRMb3csIHRhcmdldEhpZ2gpO1xuICAgICAgICB9LCAxMDApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhhbmRsZV9wb2xsaW5nKHRhcmdldExvdywgdGFyZ2V0SGlnaCkge1xuICAgICAgICBsZXQgcG9zID0gY3Vyc29yLmN0cmwudmFsdWU7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICh0YXJnZXRMb3cgPiAtSW5maW5pdHkgJiYgcG9zIDwgdGFyZ2V0TG93KSB8fFxuICAgICAgICAgICAgKHRhcmdldEhpZ2ggPCBJbmZpbml0eSAmJiBwb3MgPiB0YXJnZXRIaWdoKVxuICAgICAgICApeyBcbiAgICAgICAgICAgIC8vIGV2ZW50IGRldGVjdGVkXG4gICAgICAgICAgICBjdXJzb3Iub25jaGFuZ2UoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNhbmNlbF9wb2xsaW5nKCkge1xuICAgICAgICBpZiAocGlkICE9IHVuZGVmaW5lZCkgeyBcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwocGlkKTsgXG4gICAgICAgIH1cbiAgICB9XG4gXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBJTklUSUFMSVpBVElPTlxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGN1cnNvci5jdHJsID0gY3RybDtcbiAgICBjdXJzb3Iuc3JjID0gc3JjO1xuICAgIHJldHVybiBjdXJzb3I7XG59XG5cbiIsImltcG9ydCB7IHBsYXliYWNrX2N1cnNvciB9IGZyb20gXCIuL2N1cnNvcl9wbGF5YmFjay5qc1wiO1xuaW1wb3J0IHsgcmFuZG9tX3N0cmluZywgY2hlY2tfbnVtYmVyLCBtb3Rpb25fdXRpbHMgfSBmcm9tIFwiLi91dGlsL2NvbW1vbi5qc1wiO1xuaW1wb3J0IHsgbG9hZF9zZWdtZW50IH0gZnJvbSBcIi4vdXRpbC9zZWdtZW50cy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE9CSkVDVCBDVVJTT1JcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBjdXJzb3Igb2JqZWN0IHN1cHBvcnRpbmcgdXBkYXRlc1xuICogIFxuICogXCJzcmNcIiBpcyBhIGxheWVyIHdoaWNoIGlzIG11dGFibGVcbiAqIFwiY3RybFwiIGlzIGZpeGVkLXJhdGUgY3Vyc29yXG4gKiBcbiAqIG9iamVjdF9jdXJzb3IgbWF5IGFsc28gc3VwcG9ydCByZWNvcmRpbmdcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gb2JqZWN0X2N1cnNvcihvcHRpb25zPXt9KSB7XG5cbiAgICBjb25zdCB7Y3RybCwgc3JjLCByZWNvcmQ9ZmFsc2V9ID0gb3B0aW9ucztcblxuICAgIGNvbnN0IGN1cnNvciA9IG5ldyBwbGF5YmFja19jdXJzb3Ioe2N0cmwsIHNyYywgbXV0YWJsZTogdHJ1ZX0pO1xuXG4gICAgLyoqXG4gICAgICogb3ZlcnJpZGUgdG8gaW1wbGVtZW50IGFkZGl0aW9uYWwgcmVzdHJpY3Rpb25zIFxuICAgICAqIG9uIHNyYyBhbmQgY3RybFxuICAgICAqL1xuICAgIGNvbnN0IG9yaWdpbmFsX3NyY3Byb3BfY2hlY2sgPSBjdXJzb3Iuc3JjcHJvcF9jaGVjaztcblxuICAgIGN1cnNvci5zcmNwcm9wX2NoZWNrID0gZnVuY3Rpb24gKHByb3BOYW1lLCBvYmopIHtcbiAgICAgICAgb2JqID0gb3JpZ2luYWxfc3JjcHJvcF9jaGVjayhwcm9wTmFtZSwgb2JqKTtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwiY3RybFwiKSB7XG4gICAgICAgICAgICBpZiAoIW9iai5maXhlZFJhdGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwiY3RybFwiIHByb3BlcnR5IG11c3QgYmUgYSBmaXhlZHJhdGUgY3Vyc29yICR7b2JqfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG9iajtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzcmNcIikge1xuICAgICAgICAgICAgaWYgKCFvYmoubXV0YWJsZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBwcm9wZXJ0eSBtdXN0IGJlIG11dGFibGUgbGF5ZXIgJHtvYmp9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gb2JqO1xuICAgICAgICB9XG4gICAgfVxuICAgICAgICBcblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogVVBEQVRFIEFQSVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGN1cnNvci5zZXQgPSAodmFsdWUpID0+IHtcbiAgICAgICAgY29uc3QgaXRlbXMgPSBjcmVhdGVfc2V0X2l0ZW1zKGN1cnNvciwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gY3Vyc29yLnVwZGF0ZShpdGVtcyk7XG4gICAgfVxuICAgIGN1cnNvci5tb3Rpb24gPSAodmVjdG9yKSA9PiB7XG4gICAgICAgIGNvbnN0IGl0ZW1zID0gY3JlYXRlX21vdGlvbl9pdGVtcyhjdXJzb3IsIHZlY3Rvcik7XG4gICAgICAgIHJldHVybiBjdXJzb3IudXBkYXRlKGl0ZW1zKTtcbiAgICB9XG4gICAgY3Vyc29yLnRyYW5zaXRpb24gPSAoe3RhcmdldCwgZHVyYXRpb24sIGVhc2luZ30pID0+IHsgXG4gICAgICAgIGNvbnN0IGl0ZW1zID0gY3JlYXRlX3RyYW5zaXRpb25faXRlbXMoY3Vyc29yLCB0YXJnZXQsIGR1cmF0aW9uLCBlYXNpbmcpO1xuICAgICAgICByZXR1cm4gY3Vyc29yLnVwZGF0ZShpdGVtcyk7XG5cbiAgICB9XG4gICAgY3Vyc29yLmludGVycG9sYXRlID0gKHt0dXBsZXMsIGR1cmF0aW9ufSkgPT4ge1xuICAgICAgICBjb25zdCBpdGVtcyA9IGNyZWF0ZV9pbnRlcnBvbGF0aW9uX2l0ZW1zKGN1cnNvciwgdHVwbGVzLCBkdXJhdGlvbik7XG4gICAgICAgIHJldHVybiBjdXJzb3IudXBkYXRlKGl0ZW1zKTtcbiAgICB9XG4gICAgXG4gICAgY3Vyc29yLnVwZGF0ZSA9IChpdGVtcykgPT4ge1xuICAgICAgICBpZiAoaXRlbXMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAocmVjb3JkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnNvci5zcmMuYXBwZW5kKGl0ZW1zLCBjdXJzb3IuY3RybC52YWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBjdXJzb3Iuc3JjLnVwZGF0ZSh7aW5zZXJ0Oml0ZW1zLCByZXNldDp0cnVlfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY3Vyc29yO1xufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUiBVUERBVEUgQVBJXG4gKiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogY3JlYWF0ZSBpdGVtcyBmb3Igc2V0IG9wZXJhdGlvblxuKi9cbmZ1bmN0aW9uIGNyZWF0ZV9zZXRfaXRlbXMoY3Vyc29yLCB2YWx1ZSkge1xuICAgIGxldCBpdGVtcyA9IFtdO1xuICAgIGlmICh2YWx1ZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgaXRlbXMgPSBbe1xuICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgaXR2OiBbbnVsbCwgbnVsbCwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdmFsdWUgICAgICAgICAgICAgIFxuICAgICAgICB9XTtcbiAgICB9XG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG4vKipcbiAqIGNyZWF0ZSBpdGVtcyBmb3IgbW90aW9uIG9wZXJhdGlvblxuICogIFxuICogbW90aW9uIG9ubHkgbWFrZXMgc2Vuc2UgaWYgb2JqZWN0IGN1cnNvciBpcyByZXN0cmljdGVkIHRvIG51bWJlciB2YWx1ZXMsXG4gKiB3aGljaCBpbiB0dXJuIGltcGxpZXMgdGhhdCB0aGUgY3Vyc29yLnNyYyAoSXRlbXMgTGF5ZXIpIHNob3VsZCBiZVxuICogcmVzdHJpY3RlZCB0byBudW1iZXIgdmFsdWVzLiBcbiAqIElmIG5vbi1udW1iZXIgdmFsdWVzIG9jY3VyIC0gd2Ugc2ltcGx5IHJlcGxhY2Ugd2l0aCAwLlxuICogQWxzbywgaXRlbXMgbGF5ZXIgc2hvdWxkIGhhdmUgYSBzaW5nbGUgaXRlbSBpbiBuZWFyYnkgY2VudGVyLlxuICogXG4gKiBpZiBwb3NpdGlvbiBpcyBvbWl0dGVkIGluIHZlY3RvciAtIGN1cnJlbnQgcG9zaXRpb24gd2lsbCBiZSBhc3N1bWVkXG4gKiBpZiB0aW1lc3RhbXAgaXMgb21pdHRlZCBpbiB2ZWN0b3IgLSBjdXJyZW50IHRpbWVzdGFtcCB3aWxsIGJlIGFzc3VtZWRcbiAqIGlmIHZlbG9jaXR5IGFuZCBhY2NlbGVyYXRpb24gYXJlIG9tbWl0dGVkIGluIHZlY3RvciBcbiAqIC0gdGhlc2Ugd2lsbCBiZSBzZXQgdG8gemVyby5cbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlX21vdGlvbl9pdGVtcyhjdXJzb3IsIHZlY3Rvcj17fSkge1xuICAgIC8vIGdldCB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgY3Vyc29yXG4gICAgbGV0IHt2YWx1ZTpwMCwgb2Zmc2V0OnQwfSA9IGN1cnNvci5xdWVyeSgpO1xuICAgIC8vIGVuc3VyZSB0aGF0IHAwIGlzIG51bWJlciB0eXBlXG4gICAgaWYgKHR5cGVvZiBwMCAhPT0gJ251bWJlcicgfHwgIWlzRmluaXRlKHAwKSkge1xuICAgICAgICBwMCA9IDA7XG4gICAgfVxuICAgIC8vIGZldGNoIG5ldyB2YWx1ZXMgZnJvbSB2ZWN0b3JcbiAgICBjb25zdCB7XG4gICAgICAgIHBvc2l0aW9uOnAxPXAwLFxuICAgICAgICB2ZWxvY2l0eTp2MT0wLFxuICAgICAgICBhY2NlbGVyYXRpb246YTE9MCxcbiAgICAgICAgdGltZXN0YW1wOnQxPXQwLFxuICAgICAgICByYW5nZT1bbnVsbCwgbnVsbF1cbiAgICB9ID0gdmVjdG9yO1xuICAgIG1vdGlvbl91dGlscy5jaGVja19yYW5nZShyYW5nZSk7XG4gICAgY2hlY2tfbnVtYmVyKFwicG9zaXRpb25cIiwgcDEpO1xuICAgIGNoZWNrX251bWJlcihcInZlbG9jaXR5XCIsIHYxKTtcbiAgICBjaGVja19udW1iZXIoXCJhY2NlbGVyYXRpb25cIiwgYTEpO1xuICAgIGNoZWNrX251bWJlcihcInRpbWVzdGFtcFwiLCB0MSk7XG5cbiAgICBjb25zdCBpdGVtcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogaWYgcG9zIHJhbmdlIGlzIGJvdW5kZWQgbG93IG9yIGhpZ2ggb3IgYm90aCxcbiAgICAgKiB0aGlzIHBvdGVudGlhbGx5IGNvcnJlc3BvbmRzIHRvIG11bHRpcGxlIHRpbWUgcmFuZ2VzIFtbdDAsIHQxXV0gXG4gICAgICogd2hlcmUgdGhlIG1vdGlvbiBwb3NpdGlvbiBpcyBsZWdhbCAgXG4gICAgICogbG93IDw9IHAgPD0gaGlnaCBcbiAgICAgKi9cbiAgICBjb25zdCBjdHIgPSBtb3Rpb25fdXRpbHMuY2FsY3VsYXRlX3RpbWVfcmFuZ2VzO1xuICAgIGNvbnN0IHRpbWVfcmFuZ2VzID0gY3RyKFtwMSx2MSxhMSx0MV0sIHJhbmdlKTtcbiAgICAvLyBwaWNrIGEgdGltZSByYW5nZSB3aGljaCBjb250YWlucyB0MVxuICAgIGNvbnN0IHRzID0gY3Vyc29yLmN0cmwudmFsdWU7XG5cbiAgICBjb25zdCB0aW1lX3JhbmdlID0gdGltZV9yYW5nZXMuZmluZCgodHIpID0+IHtcbiAgICAgICAgY29uc3QgbG93ID0gdHJbMF0gPz8gLUluZmluaXR5O1xuICAgICAgICBjb25zdCBoaWdoID0gdHJbMV0gPz8gSW5maW5pdHk7XG4gICAgICAgIHJldHVybiBsb3cgPD0gdHMgJiYgdHMgPD0gaGlnaDtcbiAgICB9KTtcbiAgICBpZiAodGltZV9yYW5nZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgW2xvdywgaGlnaF0gPSB0aW1lX3JhbmdlO1xuICAgICAgICBpdGVtcy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiByYW5kb21fc3RyaW5nKDEwKSxcbiAgICAgICAgICAgIGl0djogW2xvdywgaGlnaCwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICAgICAgZGF0YTogW3AxLCB2MSwgYTEsIHQxXVxuICAgICAgICB9KTtcbiAgICAgICAgLy8gYWRkIGxlZnQgaWYgbmVlZGVkXG4gICAgICAgIGlmIChsb3cgIT0gbnVsbCkge1xuICAgICAgICAgICAgaXRlbXMucHVzaCh7XG4gICAgICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgICAgIGl0djogW251bGwsIGxvdywgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICAgICAgZGF0YTogcmFuZ2VbMF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIGFkZCByaWdodCBpZiBuZWVkZWRcbiAgICAgICAgaWYgKGhpZ2ggIT0gbnVsbCkge1xuICAgICAgICAgICAgaXRlbXMucHVzaCh7XG4gICAgICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgICAgIGl0djogW2hpZ2gsIG51bGwsIGZhbHNlLCB0cnVlXSxcbiAgICAgICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgICAgIGRhdGE6IHJhbmdlWzFdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8qIFxuICAgICAgICAgICAgbm8gdGltZV9yYW5nZSBmb3VuZFxuICAgICAgICAgICAgXG4gICAgICAgICAgICBwMSBpcyBvdXRzaWRlIHRoZSBwb3NfcmFuZ2VcbiAgICAgICAgICAgIGlmIHAxIGlzIGxlc3MgdGhhbiBsb3csIHRoZW4gdXNlIGxvd1xuICAgICAgICAgICAgaWYgcDEgaXMgZ3JlYXRlciB0aGFuIGhpZ2gsIHRoZW4gdXNlIGhpZ2hcbiAgICAgICAgKi9cbiAgICAgICAgY29uc3QgdmFsID0gKHAxIDwgcmFuZ2VbMF0pID8gcmFuZ2VbMF0gOiByYW5nZVsxXTtcbiAgICAgICAgaXRlbXMucHVzaCh7XG4gICAgICAgICAgICBpZDogcmFuZG9tX3N0cmluZygxMCksXG4gICAgICAgICAgICBpdHY6IFtudWxsLCBudWxsLCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2YWxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuLyoqXG4gKiBjcmVhdGUgaXRlbXMgZm9yIHRyYW5zaXRpb24gb3BlcmF0aW9uXG4gKiAgXG4gKiB0cmFuc2l0aW9uIHRvIHRhcmdldCBwb3NpdGlvbiB1c2luZyBpbiA8ZHVyYXRpb24+IHNlY29uZHMuXG4gKi9cblxuZnVuY3Rpb24gY3JlYXRlX3RyYW5zaXRpb25faXRlbXMoY3Vyc29yLCB0YXJnZXQsIGR1cmF0aW9uLCBlYXNpbmcpIHtcblxuICAgIGNvbnN0IHt2YWx1ZTp2MCwgb2Zmc2V0OnQwfSA9IGN1cnNvci5xdWVyeSgpO1xuICAgIGNvbnN0IHYxID0gdGFyZ2V0O1xuICAgIGNvbnN0IHQxID0gdDAgKyBkdXJhdGlvbjtcbiAgICBpZiAodjEgPT0gdjApIHtcbiAgICAgICAgLy8gbm9vcFxuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGNoZWNrX251bWJlcihcInBvc2l0aW9uXCIsIHYwKTtcbiAgICBjaGVja19udW1iZXIoXCJwb3NpdGlvblwiLCB2MSk7XG4gICAgY2hlY2tfbnVtYmVyKFwicG9zaXRpb25cIiwgdDApO1xuICAgIGNoZWNrX251bWJlcihcInBvc2l0aW9uXCIsIHQxKTtcbiAgICByZXR1cm4gW1xuICAgICAgICB7XG4gICAgICAgICAgICBpZDogcmFuZG9tX3N0cmluZygxMCksXG4gICAgICAgICAgICBpdHY6IFtudWxsLCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYwXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlkOiByYW5kb21fc3RyaW5nKDEwKSxcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInRyYW5zaXRpb25cIixcbiAgICAgICAgICAgIGRhdGE6IHt2MCwgdjEsIHQwLCB0MSwgZWFzaW5nfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpZDogcmFuZG9tX3N0cmluZygxMCksXG4gICAgICAgICAgICBpdHY6IFt0MSwgbnVsbCwgZmFsc2UsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYxXG4gICAgICAgIH1cbiAgICBdO1xufVxuXG4vKipcbiAqIGNyZWF0ZSBpdGVtcyBmb3IgaW50ZXJwb2xhdGlvbiBvcGVyYXRpb25cbiAqL1xuXG5mdW5jdGlvbiBjcmVhdGVfaW50ZXJwb2xhdGlvbl9pdGVtcyhjdXJzb3IsIHR1cGxlcywgZHVyYXRpb24pIHtcblxuICAgIGNvbnN0IG5vdyA9IGN1cnNvci5jdHJsLnZhbHVlO1xuICAgIHR1cGxlcyA9IHR1cGxlcy5tYXAoKFt2LHRdKSA9PiB7XG4gICAgICAgIGNoZWNrX251bWJlcihcInRzXCIsIHQpO1xuICAgICAgICBjaGVja19udW1iZXIoXCJ2YWxcIiwgdik7XG4gICAgICAgIHJldHVybiBbdiwgbm93ICsgdF07XG4gICAgfSlcblxuICAgIC8vIGluZmxhdGUgc2VnbWVudCB0byBjYWxjdWxhdGUgYm91bmRhcnkgY29uZGl0aW9uc1xuICAgIGNvbnN0IHNlZyA9IGxvYWRfc2VnbWVudChbbnVsbCwgbnVsbCwgdHJ1ZSwgdHJ1ZV0sIHtcbiAgICAgICAgdHlwZTogXCJpbnRlcnBvbGF0aW9uXCIsXG4gICAgICAgIGRhdGE6IHR1cGxlc1xuICAgIH0pO1xuXG4gICAgY29uc3QgdDAgPSBub3c7XG4gICAgY29uc3QgdDEgPSB0MCArIGR1cmF0aW9uO1xuICAgIGNvbnN0IHYwID0gc2VnLnN0YXRlKHQwKS52YWx1ZTtcbiAgICBjb25zdCB2MSA9IHNlZy5zdGF0ZSh0MSkudmFsdWU7XG4gICAgcmV0dXJuIFtcbiAgICAgICAge1xuICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYwXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlkOiByYW5kb21fc3RyaW5nKDEwKSxcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJpbnRlcnBvbGF0aW9uXCIsXG4gICAgICAgICAgICBkYXRhOiB0dXBsZXNcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaWQ6IHJhbmRvbV9zdHJpbmcoMTApLFxuICAgICAgICAgICAgaXR2OiBbdDEsIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MVxuICAgICAgICB9XG4gICAgXTtcbn1cbiIsImltcG9ydCB7IGVuZHBvaW50fSBmcm9tIFwiLi4vdXRpbC9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuLi9uZWFyYnlfYmFzZS5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi4vbGF5ZXJfYmFzZS5qc1wiXG5pbXBvcnQgeyBDdXJzb3IgfSBmcm9tIFwiLi4vY3Vyc29yX2Jhc2UuanNcIjtcblxuLyoqXG4gKiBUaGlzIHdyYXBzIGEgY3Vyc29yIHNvIHRoYXQgaXQgY2FuIGJlIHVzZWQgYXMgYSBsYXllci5cbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gbGF5ZXJfZnJvbV9jdXJzb3Ioc3JjKSB7XG5cbiAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBDdXJzb3IpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgc3JjIG11c3QgYmUgYSBDdXJzb3IgJHtzcmN9YCk7XG4gICAgfVxuIFxuICAgIGNvbnN0IGxheWVyID0gbmV3IExheWVyKCk7XG4gICAgbGF5ZXIuaW5kZXggPSBuZXcgQ3Vyc29ySW5kZXgoc3JjKTtcblxuICAgIC8vIHJlc3RyaWN0aW9uc1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShsYXllciwgXCJudW1lcmljXCIsIHtnZXQ6ICgpID0+IHNyYy5udW1lcmljfSk7XG5cbiAgICAvLyBzdWJzY3JpYmVcbiAgICBzcmMuYWRkX2NhbGxiYWNrKChlQXJnKSA9PiB7XG4gICAgICAgIGxheWVyLm9uY2hhbmdlKGVBcmcpO1xuICAgIH0pO1xuXG4gICAgLy8gaW5pdGlhbGlzZVxuICAgIGxheWVyLnNyYyA9IHNyYztcbiAgICByZXR1cm4gbGF5ZXI7XG59IFxuXG5cbi8qKlxuICogQ3JlYXRlIGEgTmVhcmJ5SW5kZXggZm9yIHRoZSBDdXJzb3IuXG4gKiBcbiAqIFRoZSBjdXJzb3IgdmFsdWUgaXMgaW5kZXBlbmRlbnQgb2YgdGltZWxpbmUgb2Zmc2V0LCBcbiAqIHdoaWNoIGlzIHRvIHNheSB0aGF0IGl0IGhhcyB0aGUgc2FtZSB2YWx1ZSBmb3IgYWxsIFxuICogdGltZWxpbmUgb2Zmc2V0cy5cbiAqIFxuICogSW4gb3JkZXIgZm9yIHRoZSBkZWZhdWx0IExheWVyQ2FjaGUgdG8gd29yaywgYW5cbiAqIG9iamVjdCB3aXRoIGEgLnF1ZXJ5KG9mZnNldCkgbWV0aG9kIGlzIG5lZWRlZCBpbiBcbiAqIG5lYXJieS5jZW50ZXIuIFNpbmNlIGN1cnNvcnMgc3VwcG9ydCB0aGlzIG1ldGhvZFxuICogKGlnbm9yaW5nIHRoZSBvZmZzZXQpLCB3ZSBjYW4gdXNlIHRoZSBjdXJzb3IgZGlyZWN0bHkuXG4gKi9cblxuY2xhc3MgQ3Vyc29ySW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoY3Vyc29yKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2N1cnNvciA9IGN1cnNvcjtcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIC8vIGN1cnNvciBpbmRleCBpcyBkZWZpbmVkIGZvciBlbnRpcmUgdGltZWxpbmVcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGl0djogW251bGwsIG51bGwsIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgY2VudGVyOiBbdGhpcy5fY3Vyc29yXSxcbiAgICAgICAgICAgIGxlZnQ6IGVuZHBvaW50Lk5FR19JTkYsXG4gICAgICAgICAgICBwcmV2OiBlbmRwb2ludC5ORUdfSU5GLFxuICAgICAgICAgICAgcmlnaHQ6IGVuZHBvaW50LlBPU19JTkYsXG4gICAgICAgICAgICBuZXh0OiBlbmRwb2ludC5QT1NfSU5GLFxuICAgICAgICB9XG4gICAgfVxufVxuXG4iLCJpbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuLi91dGlsL2FwaV9zcmNwcm9wLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcl9iYXNlLmpzXCJcbmltcG9ydCB7IGVuZHBvaW50IH0gZnJvbSBcIi4uL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UsIG5lYXJieV9mcm9tIH0gZnJvbSBcIi4uL25lYXJieV9iYXNlLmpzXCI7XG5cblxuLyoqXG4gKiBDb252ZW5pZW5jZSBtZXJnZSBvcHRpb25zXG4gKi9cbmNvbnN0IE1FUkdFX09QVElPTlMgPSB7XG4gICAgc3VtOiB7XG4gICAgICAgIHZhbHVlRnVuYzogZnVuY3Rpb24gKGluZm8pIHtcbiAgICAgICAgICAgIC8vIHJldHVybnMgdGhlIHN1bSBvZiB2YWx1ZXMgb2YgYWN0aXZlIGxheWVyc1xuICAgICAgICAgICAgcmV0dXJuIGluZm8uc3RhdGVzXG4gICAgICAgICAgICAgICAgLm1hcChzdGF0ZSA9PiBzdGF0ZS52YWx1ZSkgXG4gICAgICAgICAgICAgICAgLnJlZHVjZSgoYWNjLCB2YWx1ZSkgPT4gYWNjICsgdmFsdWUsIDApO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBzdGFjazoge1xuICAgICAgICBzdGF0ZUZ1bmM6IGZ1bmN0aW9uIChpbmZvKSB7XG4gICAgICAgICAgICAvLyByZXR1cm5zIHZhbHVlcyBmcm9tIGZpcnN0IGFjdGl2ZSBsYXllclxuICAgICAgICAgICAgcmV0dXJuIHsuLi5pbmZvLnN0YXRlc1swXX1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgYXJyYXk6IHtcbiAgICAgICAgdmFsdWVGdW5jOiBmdW5jdGlvbiAoaW5mbykge1xuICAgICAgICAgICAgLy8gcmV0dXJucyBhbiBhcnJheSB3aXRoIHZhbHVlcyBmcm9tIGFjdGl2ZSBsYXllcnNcbiAgICAgICAgICAgIHJldHVybiBpbmZvLnN0YXRlcy5tYXAoc3RhdGUgPT4gc3RhdGUudmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIFxuICogVGhpcyBpbXBsZW1lbnRzIGEgbWVyZ2Ugb3BlcmF0aW9uIGZvciBsYXllcnMuXG4gKiBMaXN0IG9mIHNvdXJjZXMgaXMgaW1tdXRhYmxlLlxuICogXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlX2xheWVyIChzb3VyY2VzLCBvcHRpb25zPXt9KSB7XG4gICAgbGV0IHt0eXBlPVwiXCIsIC4uLm9wdHN9ID0gb3B0aW9ucztcblxuICAgIC8vIHR5cGUgc3BlY2lmaWVzIHByZWRlZmluZWQgb3B0aW9ucyBmb3IgTGF5ZXJcbiAgICBpZiAodHlwZSBpbiBNRVJHRV9PUFRJT05TKSB7XG4gICAgICAgIG9wdHMgPSBNRVJHRV9PUFRJT05TW3R5cGVdO1xuICAgIH1cbiAgICBjb25zdCBsYXllciA9IG5ldyBMYXllcihvcHRzKTsgICAgXG5cbiAgICAvLyBzZXR1cCBzb3VyY2VzIHByb3BlcnR5XG4gICAgc3JjcHJvcC5hZGRTdGF0ZShsYXllcik7XG4gICAgc3JjcHJvcC5hZGRNZXRob2RzKGxheWVyKTtcbiAgICBsYXllci5zcmNwcm9wX3JlZ2lzdGVyKFwic291cmNlc1wiKTtcblxuICAgIGxheWVyLnNyY3Byb3BfY2hlY2sgPSBmdW5jdGlvbihwcm9wTmFtZSwgc291cmNlcykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzb3VyY2VzXCIpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIHRoYXQgc291cmNlcyBpcyBhcnJheSBvZiBsYXllcnNcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShzb3VyY2VzKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgc291cmNlcyBtdXN0IGJlIGFycmF5ICR7c291cmNlc31gKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYWxsX2xheWVycyA9IHNvdXJjZXMubWFwKChlKSA9PiBlIGluc3RhbmNlb2YgTGF5ZXIpLmV2ZXJ5KGUgPT4gZSk7XG4gICAgICAgICAgICBpZiAoIWFsbF9sYXllcnMpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNvdXJjZXMgbXVzdCBhbGwgYmUgbGF5ZXJzICR7c291cmNlc31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc291cmNlcztcbiAgICB9XG5cbiAgICBsYXllci5zcmNwcm9wX29uY2hhbmdlID0gZnVuY3Rpb24ocHJvcE5hbWUsIGVBcmcpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic291cmNlc1wiKSB7XG4gICAgICAgICAgICBpZiAoZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5pbmRleCA9IG5ldyBOZWFyYnlJbmRleE1lcmdlKGxheWVyLnNvdXJjZXMpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgbGF5ZXIub25jaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlc3RyaWN0aW9uc1xuICAgIGNvbnN0IG51bWVyaWMgPSBzb3VyY2VzLm1hcCgoc3JjKSA9PiBzcmMubnVtZXJpYykuZXZlcnkoZT0+ZSkgIFxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShsYXllciwgXCJudW1lcmljXCIsIHtnZXQ6ICgpID0+IG51bWVyaWN9KTtcblxuICAgIC8vIGluaXRpYWxpc2VcbiAgICBsYXllci5zb3VyY2VzID0gc291cmNlcztcblxuICAgIHJldHVybiBsYXllclxufVxuXG5cblxuLyoqXG4gKiBDcmVhdGluZyBhIG1lcmdlZCBOZWFyYnlJbmRleCBmb3Igc2V0IG9mIExheWVycy5cbiAqICBcbiAqIEEgcmVnaW9uIHdpdGhpbiB0aGUgbWVyZ2VkIGluZGV4IHdpbGwgY29udGFpblxuICogYSBsaXN0IG9mIHJlZmVyZW5jZXMgdG8gKGNhY2hlIG9iamVjdHMpIGZvciBcbiAqIHRoZSBMYXllcnMgd2hpY2ggYXJlIGRlZmluZWQgaW4gdGhpcyByZWdpb24uXG4gKiBcbiAqIEltcGxlbWVudGF0aW9uIGlzIHN0YXRlbGVzcy5cbiAqIFNldCBvZiBsYXllcnMgaXMgYXNzdW1lZCB0byBiZSBzdGF0aWMuXG4gKi9cblxuZnVuY3Rpb24gY21wX2FzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAxLCBwMilcbn1cblxuZnVuY3Rpb24gY21wX2Rlc2NlbmRpbmcocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmNtcChwMiwgcDEpXG59XG5cbmV4cG9ydCBjbGFzcyBOZWFyYnlJbmRleE1lcmdlIGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKHNvdXJjZXMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fc291cmNlcyA9IHNvdXJjZXM7XG4gICAgICAgIHRoaXMuX2NhY2hlcyA9IG5ldyBNYXAoc291cmNlcy5tYXAoKHNyYykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFtzcmMsIHNyYy5jcmVhdGVDYWNoZSgpXTtcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgb2Zmc2V0ID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuICAgICAgICAvLyBhY2N1bXVsYXRlIG5lYXJieSBmcm9tIGFsbCBzb3VyY2VzXG4gICAgICAgIGNvbnN0IHByZXZfbGlzdCA9IFtdLCBuZXh0X2xpc3QgPSBbXTtcbiAgICAgICAgY29uc3QgY2VudGVyID0gW107XG4gICAgICAgIGNvbnN0IGNlbnRlcl9oaWdoX2xpc3QgPSBbXTtcbiAgICAgICAgY29uc3QgY2VudGVyX2xvd19saXN0ID0gW11cbiAgICAgICAgZm9yIChsZXQgc3JjIG9mIHRoaXMuX3NvdXJjZXMpIHtcbiAgICAgICAgICAgIGxldCBuZWFyYnkgPSBzcmMuaW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgICAgICBsZXQgcHJldl9yZWdpb24gPSBzcmMuaW5kZXguZmluZF9yZWdpb24obmVhcmJ5LCB7ZGlyZWN0aW9uOi0xfSk7XG4gICAgICAgICAgICBsZXQgbmV4dF9yZWdpb24gPSBzcmMuaW5kZXguZmluZF9yZWdpb24obmVhcmJ5LCB7ZGlyZWN0aW9uOjF9KTtcbiAgICAgICAgICAgIGlmIChwcmV2X3JlZ2lvbiAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBwcmV2X2xpc3QucHVzaChlbmRwb2ludC5mcm9tX2ludGVydmFsKHByZXZfcmVnaW9uLml0dilbMV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5leHRfcmVnaW9uICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIG5leHRfbGlzdC5wdXNoKGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmV4dF9yZWdpb24uaXR2KVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobmVhcmJ5LmNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY2VudGVyLnB1c2godGhpcy5fY2FjaGVzLmdldChzcmMpKTtcbiAgICAgICAgICAgICAgICBsZXQgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5lYXJieS5pdHYpO1xuICAgICAgICAgICAgICAgIGNlbnRlcl9oaWdoX2xpc3QucHVzaChoaWdoKTtcbiAgICAgICAgICAgICAgICBjZW50ZXJfbG93X2xpc3QucHVzaChsb3cpOyAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gZmluZCBjbG9zZXN0IGVuZHBvaW50IHRvIHRoZSByaWdodCAobm90IGluIGNlbnRlcilcbiAgICAgICAgbmV4dF9saXN0LnNvcnQoY21wX2FzY2VuZGluZyk7XG4gICAgICAgIGNvbnN0IG5leHRfbG93ID0gbmV4dF9saXN0WzBdIHx8IGVuZHBvaW50LlBPU19JTkY7XG5cbiAgICAgICAgLy8gZmluZCBjbG9zZXN0IGVuZHBvaW50IHRvIHRoZSBsZWZ0IChub3QgaW4gY2VudGVyKVxuICAgICAgICBwcmV2X2xpc3Quc29ydChjbXBfZGVzY2VuZGluZyk7XG4gICAgICAgIGNvbnN0IHByZXZfaGlnaCA9IHByZXZfbGlzdFswXSB8fCBlbmRwb2ludC5ORUdfSU5GO1xuXG4gICAgICAgIHJldHVybiBuZWFyYnlfZnJvbShcbiAgICAgICAgICAgICAgICBwcmV2X2hpZ2gsIFxuICAgICAgICAgICAgICAgIGNlbnRlcl9sb3dfbGlzdCwgXG4gICAgICAgICAgICAgICAgY2VudGVyLFxuICAgICAgICAgICAgICAgIGNlbnRlcl9oaWdoX2xpc3QsXG4gICAgICAgICAgICAgICAgbmV4dF9sb3dcbiAgICAgICAgICAgICk7XG4gICAgfVxufTtcbiIsImltcG9ydCB7IGludGVydmFsLCBlbmRwb2ludH0gZnJvbSBcIi4uL3V0aWwvaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi4vbmVhcmJ5X2Jhc2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVyX2Jhc2UuanNcIlxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQk9PTEVBTiBMQVlFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKiBcbiAgICBCb29sZWFuIExheWVyIGlzIHJldHVybnMgdmFsdWVzIDAvMSAtIG1ha2luZyBpdCBhIG51bWVyaWMgbGF5ZXJcbiovXG5cblxuZXhwb3J0IGZ1bmN0aW9uIGJvb2xlYW5fbGF5ZXIoc3JjKSB7XG5cbiAgICBjb25zdCBsYXllciA9IG5ldyBMYXllcigpO1xuICAgIGxheWVyLmluZGV4ID0gbmV3IE5lYXJieUluZGV4Qm9vbGVhbihzcmMuaW5kZXgpO1xuICAgIFxuICAgIC8vIHN1YnNjcmliZVxuICAgIHNyYy5hZGRfY2FsbGJhY2soKGVBcmcpID0+IHtcbiAgICAgICAgbGF5ZXIub25jaGFuZ2UoZUFyZyk7XG4gICAgfSk7XG5cblxuICAgIC8vIHJlc3RyaWN0aW9uc1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShsYXllciwgXCJudW1lcmljXCIsIHtnZXQ6ICgpID0+IHRydWV9KTtcblxuICAgIC8vIGluaXRpYWxpc2VcbiAgICBsYXllci5zcmMgPSBzcmM7XG4gICAgcmV0dXJuIGxheWVyO1xufSBcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQk9PTEVBTiBORUFSQlkgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBXcmFwcGVyIEluZGV4IHdoZXJlIHJlZ2lvbnMgYXJlIHRydWUvZmFsc2UsIGJhc2VkIG9uIFxuICogY29uZGl0aW9uIG9uIG5lYXJieS5jZW50ZXIuXG4gKiBCYWNrLXRvLWJhY2sgcmVnaW9ucyB3aGljaCBhcmUgdHJ1ZSBhcmUgY29sbGFwc2VkIFxuICogaW50byBvbmUgcmVnaW9uXG4gKiBcbiAqL1xuXG5mdW5jdGlvbiBxdWVyeU9iamVjdCAodmFsdWUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBxdWVyeTogZnVuY3Rpb24gKG9mZnNldCkge1xuICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZSwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4Qm9vbGVhbiBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbmRleCwgb3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9pbmRleCA9IGluZGV4O1xuICAgICAgICBsZXQge2NvbmRpdGlvbiA9IChjZW50ZXIpID0+IGNlbnRlci5sZW5ndGggPiAwfSA9IG9wdGlvbnM7XG4gICAgICAgIHRoaXMuX2NvbmRpdGlvbiA9IGNvbmRpdGlvbjtcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIG9mZnNldCA9IGVuZHBvaW50LmZyb21faW5wdXQob2Zmc2V0KTtcbiAgICAgICAgY29uc3QgbmVhcmJ5ID0gdGhpcy5faW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgIFxuICAgICAgICBsZXQgZXZhbHVhdGlvbiA9IHRoaXMuX2NvbmRpdGlvbihuZWFyYnkuY2VudGVyKTsgXG4gICAgICAgIC8qIFxuICAgICAgICAgICAgc2VlayBsZWZ0IGFuZCByaWdodCBmb3IgZmlyc3QgcmVnaW9uXG4gICAgICAgICAgICB3aGljaCBkb2VzIG5vdCBoYXZlIHRoZSBzYW1lIGV2YWx1YXRpb24gXG4gICAgICAgICovXG4gICAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IChjZW50ZXIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9jb25kaXRpb24oY2VudGVyKSAhPSBldmFsdWF0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZXhwYW5kIHJpZ2h0XG4gICAgICAgIGxldCByaWdodDtcbiAgICAgICAgbGV0IHJpZ2h0X25lYXJieSA9IHRoaXMuX2luZGV4LmZpbmRfcmVnaW9uKG5lYXJieSwge1xuICAgICAgICAgICAgZGlyZWN0aW9uOjEsIGNvbmRpdGlvblxuICAgICAgICB9KTsgICAgICAgIFxuICAgICAgICBpZiAocmlnaHRfbmVhcmJ5ICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmlnaHQgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKHJpZ2h0X25lYXJieS5pdHYpWzBdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZXhwYW5kIGxlZnRcbiAgICAgICAgbGV0IGxlZnQ7XG4gICAgICAgIGxldCBsZWZ0X25lYXJieSA9IHRoaXMuX2luZGV4LmZpbmRfcmVnaW9uKG5lYXJieSwge1xuICAgICAgICAgICAgZGlyZWN0aW9uOi0xLCBjb25kaXRpb25cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChsZWZ0X25lYXJieSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGxlZnQgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGxlZnRfbmVhcmJ5Lml0dilbMV07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBleHBhbmQgdG8gaW5maW5pdHlcbiAgICAgICAgbGVmdCA9IGxlZnQgfHwgZW5kcG9pbnQuTkVHX0lORjtcbiAgICAgICAgcmlnaHQgPSByaWdodCB8fCBlbmRwb2ludC5QT1NfSU5GO1xuICAgICAgICBjb25zdCBsb3cgPSBlbmRwb2ludC5mbGlwKGxlZnQpO1xuICAgICAgICBjb25zdCBoaWdoID0gZW5kcG9pbnQuZmxpcChyaWdodClcbiAgICAgICAgY29uc3QgdmFsdWUgPSBldmFsdWF0aW9uID8gMSA6IDA7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpdHY6IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCksXG4gICAgICAgICAgICBjZW50ZXIgOiBbcXVlcnlPYmplY3QodmFsdWUpXSxcbiAgICAgICAgICAgIGxlZnQsXG4gICAgICAgICAgICByaWdodCxcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsImltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVyX2Jhc2UuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4Qm9vbGVhbiB9IGZyb20gXCIuL2Jvb2xlYW4uanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4TWVyZ2UgfSBmcm9tIFwiLi9tZXJnZS5qc1wiO1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dpY2FsX21lcmdlX2xheWVyKHNvdXJjZXMsIG9wdGlvbnM9e30pIHtcblxuICAgIGNvbnN0IHtleHByfSA9IG9wdGlvbnM7XG4gICAgbGV0IGNvbmRpdGlvbjtcbiAgICBpZiAoZXhwcikge1xuICAgICAgICBjb25kaXRpb24gPSAoY2VudGVyKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gZXhwci5ldmFsKGNlbnRlcik7XG4gICAgICAgIH0gICAgXG4gICAgfVxuXG4gICAgY29uc3QgbGF5ZXIgPSBuZXcgTGF5ZXIoKTtcbiAgICBjb25zdCBpbmRleCA9IG5ldyBOZWFyYnlJbmRleE1lcmdlKHNvdXJjZXMpO1xuICAgIGxheWVyLmluZGV4ID0gbmV3IE5lYXJieUluZGV4Qm9vbGVhbihpbmRleCwge2NvbmRpdGlvbn0pO1xuXG4gICAgLy8gc3Vic2NyaWJlIHRvIGNhbGxiYWNrcyBmcm9tIHNvdXJjZXNcbiAgICBzb3VyY2VzLm1hcCgoc3JjKSA9PiB7XG4gICAgICAgIHJldHVybiBzcmMuYWRkX2NhbGxiYWNrKGxheWVyLm9uY2hhbmdlKTtcbiAgICB9KTtcbiAgICBcbiAgICBsYXllci5zb3VyY2VzID0gc291cmNlcztcblxuICAgIC8vIHJlc3RyaWN0aW9uc1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShsYXllciwgXCJudW1lcmljXCIsIHtnZXQ6ICgpID0+IHRydWV9KTtcblxuICAgIHJldHVybiBsYXllcjtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gbG9naWNhbF9leHByIChzcmMpIHtcbiAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBMYXllcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBtdXN0IGJlIGxheWVyICR7c3JjfWApXG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGNhY2hlIG9mIGNlbnRlcikge1xuICAgICAgICAgICAgICAgIGlmIChjYWNoZS5zcmMgPT0gc3JjKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxubG9naWNhbF9leHByLmFuZCA9IGZ1bmN0aW9uIGFuZCguLi5leHBycykge1xuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBleHBycy5ldmVyeSgoZXhwcikgPT4gZXhwci5ldmFsKGNlbnRlcikpO1xuICAgICAgICB9ICAgIFxuICAgIH1cbn1cblxubG9naWNhbF9leHByLm9yID0gZnVuY3Rpb24gb3IoLi4uZXhwcnMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBldmFsOiBmdW5jdGlvbiAoY2VudGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwcnMuc29tZSgoZXhwcikgPT4gZXhwci5ldmFsKGNlbnRlcikpO1xuICAgICAgICB9ICAgIFxuICAgIH1cbn1cblxubG9naWNhbF9leHByLnhvciA9IGZ1bmN0aW9uIHhvcihleHByMSwgZXhwcjIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBldmFsOiBmdW5jdGlvbiAoY2VudGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwcjEuZXZhbChjZW50ZXIpICE9IGV4cHIyLmV2YWwoY2VudGVyKTtcbiAgICAgICAgfSAgICBcbiAgICB9XG59XG5cbmxvZ2ljYWxfZXhwci5ub3QgPSBmdW5jdGlvbiBub3QoZXhwcikge1xuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiAhZXhwci5ldmFsKGNlbnRlcik7XG4gICAgICAgIH0gICAgXG4gICAgfVxufVxuXG5cblxuXG4iLCJpbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuLi91dGlsL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4uL25lYXJieV9iYXNlLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcl9iYXNlLmpzXCJcbmltcG9ydCAqIGFzIHNyY3Byb3AgZnJvbSBcIi4uL3V0aWwvYXBpX3NyY3Byb3AuanNcIjtcblxuXG4vKipcbiAqIGFmZmluZSB0cmFuc2Zvcm0gMUQgYnkgc2hpZnQgYW5kIHNjYWxlIGZhY3RvclxuICovXG5cbmZ1bmN0aW9uIHRyYW5zZm9ybShwLCB7c2hpZnQ9MCwgc2NhbGU9MX0pIHtcbiAgICBpZiAocCA9PSB1bmRlZmluZWQgfHwgIWlzRmluaXRlKHApKSB7XG4gICAgICAgIC8vIHAgLSBub29wXG4gICAgICAgIHJldHVybiBwO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2YgcCA9PSBcIm51bWJlclwiKSB7XG4gICAgICAgIC8vIHAgaXMgbnVtYmVyIC0gdHJhbnNmb3JtXG4gICAgICAgIHJldHVybiAocCpzY2FsZSkgKyBzaGlmdDtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocCkgJiYgcC5sZW5ndGggPiAxKSB7XG4gICAgICAgIC8vIHAgaXMgZW5kcG9pbnQgLSB0cmFuc2Zvcm0gdmFsdWVcbiAgICAgICAgbGV0IFt2YWwsIGJyYWNrZXRdID0gcDtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW5wdXQoWyh2YWwqc2NhbGUpK3NoaWZ0LCBicmFja2V0XSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZXZlcnNlKHAsIHtzaGlmdD0wLCBzY2FsZT0xfSkge1xuICAgIGlmIChwID09IHVuZGVmaW5lZCB8fCAhaXNGaW5pdGUocCkpIHtcbiAgICAgICAgLy8gcCAtIG5vb3BcbiAgICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBwID09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgLy8gcCBpcyBudW1iZXIgLSB0cmFuc2Zvcm1cbiAgICAgICAgcmV0dXJuIChwLXNoaWZ0KS9zY2FsZTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocCkgJiYgcC5sZW5ndGggPiAxKSB7XG4gICAgICAgIC8vIHAgaXMgZW5kcG9pbnQgLSB0cmFuc2Zvcm0gdmFsdWVcbiAgICAgICAgbGV0IFt2YWwsIGJyYWNrZXRdID0gcDtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW5wdXQoWygodmFsLXNoaWZ0KS9zY2FsZSksIGJyYWNrZXRdKTtcbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE5FQVJCWSBJTkRFWCAtIEFGRklORSBUSU1FTElORSBUUkFOU0ZPUk1cbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuY2xhc3MgTmVhcmJ5SW5kZXhBVFQgZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKGxheWVyLCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIHRoaXMuX2NhY2hlID0gbGF5ZXIuY3JlYXRlQ2FjaGUoKTtcbiAgICAgICAgdGhpcy5fb3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgICAgIFxuICAgICAgICAvLyB0cmFuc2Zvcm0gY2FjaGVcbiAgICAgICAgdGhpcy5fdHJhbnNmb3JtX2NhY2hlID0ge1xuICAgICAgICAgICAgcXVlcnk6IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICAgICAgICAgICAgICAvLyByZXZlcnNlIHRyYW5zZm9ybSBxdWVyeVxuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5fY2FjaGUucXVlcnkocmV2ZXJzZShvZmZzZXQsIHRoaXMuX29wdGlvbnMpKTtcbiAgICAgICAgICAgICAgICAvLyBrZWVwIG9yaWdpbmFsIG9mZnNldCAoaW5zdGVhZCBvZiByZXZlcnNpbmcgcmVzdWx0KVxuICAgICAgICAgICAgICAgIHJldHVybiB7Li4uc3RhdGUsIG9mZnNldH07XG4gICAgICAgICAgICB9LmJpbmQodGhpcylcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIG9mZnNldCA9IGVuZHBvaW50LmZyb21faW5wdXQob2Zmc2V0KTtcbiAgICAgICAgLy8gcmV2ZXJzZSB0cmFuc2Zvcm0gcXVlcnkgb2Zmc2V0XG4gICAgICAgIGNvbnN0IG5lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShyZXZlcnNlKG9mZnNldCwgdGhpcy5fb3B0aW9ucykpO1xuICAgICAgICAvLyB0cmFuc2Zvcm0gcXVlcnkgcmVzdWx0IFxuICAgICAgICBjb25zdCBpdHYgPSBuZWFyYnkuaXR2LnNsaWNlKCk7XG4gICAgICAgIGl0dlswXSA9IHRyYW5zZm9ybShuZWFyYnkuaXR2WzBdLCB0aGlzLl9vcHRpb25zKTtcbiAgICAgICAgaXR2WzFdID0gdHJhbnNmb3JtKG5lYXJieS5pdHZbMV0sIHRoaXMuX29wdGlvbnMpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXR2LFxuICAgICAgICAgICAgbGVmdDogdHJhbnNmb3JtKG5lYXJieS5sZWZ0LCB0aGlzLl9vcHRpb25zKSxcbiAgICAgICAgICAgIHJpZ2h0OiB0cmFuc2Zvcm0obmVhcmJ5LnJpZ2h0LCB0aGlzLl9vcHRpb25zKSxcbiAgICAgICAgICAgIGNlbnRlcjogbmVhcmJ5LmNlbnRlci5tYXAoKCkgPT4gdGhpcy5fdHJhbnNmb3JtX2NhY2hlKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBUSU1FTElORSBUUkFOU0ZPUk0gTEFZRVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBTaGlmdGluZyBhbmQgc2NhbGluZyB0aGUgdGltZWxpbmUgb2YgYSBsYXllclxuICogXG4gKiBvcHRpb25zOlxuICogLSBzaGlmdDogYSB2YWx1ZSBvZiAyIGVmZmVjdGl2ZWx5IG1lYW5zIHRoYXQgbGF5ZXIgY29udGVudHMgXG4gKiAgIGFyZSBzaGlmdGVkIHRvIHRoZSByaWdodCBvbiB0aGUgdGltZWxpbmUsIGJ5IDIgdW5pdHNcbiAqIC0gc2NhbGU6IGEgdmFsdWUgb2YgMiBtZWFucyB0aGF0IHRoZSBsYXllciBpcyBzdHJldGNoZWRcbiAqICAgYnkgYSBmYWN0b3Igb2YgMlxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiB0aW1lbGluZV90cmFuc2Zvcm0gKHNyYywgb3B0aW9ucz17fSkge1xuXG4gICAgY29uc3QgbGF5ZXIgPSBuZXcgTGF5ZXIoKTtcblxuICAgIC8vIHNldHVwIHNyYyBwcm9wZXJ0eVxuICAgIHNyY3Byb3AuYWRkU3RhdGUobGF5ZXIpO1xuICAgIHNyY3Byb3AuYWRkTWV0aG9kcyhsYXllcik7XG4gICAgbGF5ZXIuc3JjcHJvcF9yZWdpc3RlcihcInNyY1wiKTtcbiAgICAgICAgXG4gICAgbGF5ZXIuc3JjcHJvcF9jaGVjayA9IGZ1bmN0aW9uKHByb3BOYW1lLCBzcmMpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIExheWVyICR7c3JjfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNyYzsgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsYXllci5zcmNwcm9wX29uY2hhbmdlID0gZnVuY3Rpb24ocHJvcE5hbWUsIGVBcmcpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmIChlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXggPSBuZXcgTmVhcmJ5SW5kZXhBVFQodGhpcy5zcmMsIG9wdGlvbnMpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgbGF5ZXIub25jaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlc3RyaWN0aW9uc1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShsYXllciwgXCJudW1lcmljXCIsIHtnZXQ6ICgpID0+IHNyYy5udW1lcmljfSk7XG5cbiAgICAvLyBpbml0aWFsaXNlXG4gICAgbGF5ZXIuc3JjID0gc3JjO1xuXG5cblxuICAgIFxuICAgIHJldHVybiBsYXllcjtcbn1cblxuIiwiaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4uL2N1cnNvcl9iYXNlLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcl9iYXNlLmpzXCJcbmltcG9ydCB7IE5lYXJieUluZGV4U3JjIH0gZnJvbSBcIi4uL25lYXJieV9iYXNlLmpzXCJcblxuXG5cbi8vIFRPRE8gLSBlbnVzdXJlIG51bWVyaWMgaWYgc2V0IHRvIHRydWVcblxuZnVuY3Rpb24gdHJhbnNmb3JtU3RhdGUoc3RhdGUsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7dmFsdWVGdW5jLCBzdGF0ZUZ1bmN9ID0gb3B0aW9ucztcbiAgICBpZiAodmFsdWVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBzdGF0ZS52YWx1ZSA9IHZhbHVlRnVuYyhzdGF0ZS52YWx1ZSk7XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICB9IGVsc2UgaWYgKHN0YXRlRnVuYyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlRnVuYyhzdGF0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDdXJzb3IgVHJhbnNmb3JtXG4gKiBDcmVhdGUgYSBuZXcgQ3Vyc29yIHdoaWNoIGlzIGEgdHJhbnNmb3JtYXRpb24gb2YgYSBzcmMgQ3Vyc29yLlxuICogXG4gKiBUaGUgbmV3IHRyYW5zZm9ybWVkIEN1cnNvciBkb2VzIG5vdCBoYXZlIGEgc3JjIChsYXllcikgYW5kIGFuZCBhIGN0cmwgKGN1cnNvcilcbiAqIHByb3BlcnR5LCBzaW5jZSBpdCBvbmx5IGRlcGVuZHMgb24gdGhlIHNyYyBjdXJzb3IuXG4gKiBcbiAqIEFsc28sIHRoZSBuZXcgdHJhbnNmb3JtZWQgY3Vyc29yIGRvZXMgbm90IG5lZWQgYW55IHBsYXliYWNrIGxvZ2ljIG9uIGl0cyBvd25cbiAqIGFzIGxvbmcgYXMgdGhlIG5hdHVyZSBvZiB0aGUgdHJhbnNmb3JtYXRpb24gaXMgYSBwbGFpbiB2YWx1ZS9zdGF0ZSB0cmFuc2l0aW9uLiBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGN1cnNvcl90cmFuc2Zvcm0oc3JjLCBvcHRpb25zPXt9KSB7XG5cbiAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBDdXJzb3IpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgc3JjIG11c3QgYmUgYSBDdXJzb3IgJHtzcmN9YCk7XG4gICAgfVxuXG4gICAgY29uc3Qge251bWVyaWMsIHZhbHVlRnVuYywgc3RhdGVGdW5jfSA9IG9wdGlvbnM7XG4gICAgY29uc3QgY3Vyc29yID0gbmV3IEN1cnNvcigpO1xuXG4gICAgLy8gaW1wbGVtZW50IHF1ZXJ5XG4gICAgY3Vyc29yLnF1ZXJ5ID0gZnVuY3Rpb24gcXVlcnkoKSB7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gc3JjLnF1ZXJ5KCk7XG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm1TdGF0ZShzdGF0ZSwge3N0YXRlRnVuYywgdmFsdWVGdW5jfSk7XG4gICAgfVxuXG4gICAgLy8gbnVtYmVyaWMgY2FuIGJlIHNldCB0byB0cnVlIGJ5IG9wdGlvbnNcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3Vyc29yLCBcIm51bWVyaWNcIiwge2dldDogKCkgPT4ge1xuICAgICAgICByZXR1cm4gKG51bWVyaWMgPT0gdW5kZWZpbmVkKSA/IHNyYy5udW1lcmljIDogbnVtZXJpYzsgXG4gICAgfX0pO1xuICAgIC8vIGZpeGVkUmF0ZSBpcyBpbmhlcml0ZWQgZnJvbSBzcmNcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3Vyc29yLCBcImZpeGVkUmF0ZVwiLCB7Z2V0OiAoKSA9PiBzcmMuZml4ZWRSYXRlfSk7XG5cbiAgICBpZiAoc3JjLmZpeGVkUmF0ZSkge1xuICAgICAgICAvLyBwcm9wYWdhdGUgcmF0ZSBwcm9wZXJ0eSBmcm9tIHNyY1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY3Vyc29yLCBcInJhdGVcIiwge2dldDogKCkgPT4gc3JjLnJhdGV9KTtcbiAgICB9XG5cbiAgICAvLyBjYWxsYmFja3MgZnJvbSBzcmMtY3Vyc29yXG4gICAgc3JjLmFkZF9jYWxsYmFjaygoKSA9PiB7Y3Vyc29yLm9uY2hhbmdlKCl9KTtcbiAgICByZXR1cm4gY3Vyc29yO1xufVxuXG5cbi8qKlxuICogTGF5ZXIgVHJhbnNmb3JtXG4gKiBDcmVhdGUgYSBuZXcgTGF5ZXIgd2hpY2ggaXMgYSB0cmFuc2Zvcm1hdGlvbiBvZiB0aGUgc3JjIExheWVyXG4gKi9cblxuZnVuY3Rpb24gd3JhcHBlZFZhbHVlRnVuYyh2YWx1ZUZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHtzb3VyY2VzLCBzdGF0ZXMsIG9mZnNldH0pIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlRnVuYyhzdGF0ZXNbMF0udmFsdWUpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gd3JhcHBlZFN0YXRlRnVuYyhzdGF0ZUZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHtzb3VyY2VzLCBzdGF0ZXMsIG9mZnNldH0pIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlRnVuYyhzdGF0ZXNbMF0pO1xuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxheWVyX3RyYW5zZm9ybShzcmMsIG9wdGlvbnM9e30pIHtcblxuICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNyYyBtdXN0IGJlIGEgTGF5ZXIgJHtzcmN9YCk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3BzID0ge307XG4gICAgb3BzLnZhbHVlRnVuYyA9IHdyYXBwZWRWYWx1ZUZ1bmMob3B0aW9ucy52YWx1ZUZ1bmMpO1xuICAgIG9wcy5zdGF0ZUZ1bmMgPSB3cmFwcGVkU3RhdGVGdW5jKG9wdGlvbnMuc3RhdGVGdW5jKTtcblxuICAgIGNvbnN0IGxheWVyID0gbmV3IExheWVyKG9wcyk7XG4gICAgbGF5ZXIuaW5kZXggPSBuZXcgTmVhcmJ5SW5kZXhTcmMoc3JjKTtcbiAgICBsYXllci5zcmMgPSBzcmM7XG4gICAgbGF5ZXIuc3JjLmFkZF9jYWxsYmFjaygoZUFyZykgPT4ge2xheWVyLm9uY2hhbmdlKGVBcmcpfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobGF5ZXIsIFwibnVtZXJpY1wiLCB7Z2V0OiAoKSA9PiBzcmMubnVtZXJpY30pO1xuXG4gICAgcmV0dXJuIGxheWVyO1xufVxuXG5cblxuIiwiaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4uL2N1cnNvcl9iYXNlLmpzXCI7XG5pbXBvcnQgeyBsb2NhbF9jbG9jayB9IGZyb20gXCIuLi91dGlsL2NvbW1vbi5qc1wiO1xuXG4vKipcbiAqIHJlY29yZCBjdXJzb3IgaW50byBsYXllclxuICogXG4gKiAgIE1BSU4gSURFQVxuICogLSByZWNvcmQgdGhlIGN1cnJlbnQgdmFsdWUgb2YgYSBjdXJzb3IgKHNyYykgaW50byBhIGxheWVyIChkc3QpXG4gKiBcbiAqIC0gcmVjb3JkaW5nIGlzIGVzc2VudGlhbGx5IGEgY29weSBvcGVyYXRpb24gZnJvbSB0aGVcbiAqICAgc3RhdGVQcm92aWRlciBvZiBhIGN1cnNvciAoc3JjKSB0byB0aGUgc3RhdGVQcm92aWRlciBvZiB0aGUgbGF5ZXIgKGRzdCkuXG4gKiAtIG1vcmUgZ2VuZXJhbGx5IGNvcHkgc3RhdGUgKGl0ZW1zKSBmcm9tIGN1cnNvciB0byBsYXllci4gXG4gKiAtIHJlY29yZGluZyB0aGVyZWZvciBvbmx5IGFwcGxpZXMgdG8gY3Vyc29ycyB0aGF0IHJ1biBkaXJlY3RseSBvbiBhIGxheWVyIHdpdGggaXRlbXNcbiAqIC0gbW9yZW92ZXIsIHRoZSB0YXJnZXQgbGF5ZXIgbXVzdCBoYXZlIGl0ZW1zICh0eXBpY2FsbHkgYSBsZWFmbGF5ZXIpXG4gKlxuICogXG4gKiAgIFRJTUVGUkFNRVMgXG4gKiAtIHRoZSByZWNvcmRpbmcgdG8gKGRzdCkgbGF5ZXIgaXMgZHJpdmVuIGJ5IGEgY2xvY2sgKGN0cmwpOiA8RFNUX0NMT0NLPlxuICogLSBkdXJpbmcgcmVjb3JkaW5nIC0gY3VycmVudCB2YWx1ZSBvZiB0aGUgc3JjIGN1cnNvciB3aWxsIGJlIGNvcGllZCwgYW5kXG4gKiAgIGNvbnZlcnRlZCBpbnRvIHRoZSB0aW1lbGluZSBvZiB0aGUgPERTVF9DTE9DSz5cbiAqIC0gcmVjb3JkaW5nIGlzIGFjdGl2ZSBvbmx5IHdoZW4gPERTVF9DTE9DSz4gaXMgcHJvZ3Jlc3Npbmcgd2l0aCByYXRlPT0xLjBcbiAqIC0gdGhpcyBvcGVucyBmb3IgTElWRSByZWNvcmRpbmcgKDxEU1RfQ0xPQ0s+IGlzIGZpeGVkUmF0ZSBjdXJzb3IpIG9yXG4gKiAgIGl0ZXJhdGl2ZSByZWNvcmRpbmcgdXNpbmcgYSAoTnVtYmVyaWNWYXJpYWJsZSksIGFsbG93aW5nIG11bHRpcGxlIHRha2VzLCBcbiAqIFxuICogXG4gKiAgIFJFQ09SRElOR1xuICogLSByZWNvcmRpbmcgaXMgZG9uZSBieSBhcHBlbmRpbmcgaXRlbXMgdG8gdGhlIGRzdCBsYXllciBcbiAqIC0gd2hlbiB0aGUgY3Vyc29yIHN0YXRlIGNoYW5nZXMgKGVudGlyZSBjdXJzb3Iuc3JjIGxheWVyIGlzIHJlc2V0KSBcbiAqIC0gdGhlIHBhcnQgd2hpY2ggZGVzY3JpYmVzIHRoZSBmdXR1cmUgd2lsbCBvdmVyd3JpdGUgdGhlIHJlbGV2YW50XG4gKiAtIHBhcnQgb2YgdGhlIHRoZSBsYXllciB0aW1lbGluZVxuICogLSB0aGUgZGVsaW5lYXRpb24gYmV0d2VlbiBwYXN0IGFuZCBmdXR1cmUgaXMgZGV0ZXJtaW5lZCBieSBcbiAqIC0gZnJlc2ggdGltZXN0YW1wIDxUUz4gZnJvbSA8RFNUX0NMT0NLPlxuICogLSBpZiBhbiBpdGVtIG92ZXJsYXBzIHdpdGggPFRTPiBpdCB3aWxsIGJlIHRydW5jYXRlcyBzbyB0aGF0IG9ubHkgdGhlIHBhcnRcbiAqIC0gdGhhdCBpcyBpbiB0aGUgZnV0dXJlIHdpbGwgYmUgcmVjb3JkZWQgKGNvcGllZCkgdG8gdGhlIGxheWVyLlxuICogLSBpbiBjYXNlIChjdHJsKSBpcyBhIG1lZGlhIGNvbnRyb2wgLSByZWNvcmRpbmcgY2FuIG9ubHkgaGFwcGVuXG4gKiAgIHdoZW4gdGhlIChjdHJsKSBpcyBtb3ZpbmcgZm9yd2FyZFxuICogXG4gKiAgIElOUFVUXG4gKiAtIChjdHJsKVxuICogICAgICAtIG51bWVyaWMgY3Vyc29yIChjdHJsLmZpeGVkUmF0ZSwgb3IgXG4gKiAgICAgIC0gbWVkaWEgY29udHJvbCAoY3RybC5jdHJsLmZpeGVkUmF0ZSAmJiBjdHJsLnNyYy5pdGVtc09ubHkpXG4gKiAtIChzcmMpIC0gY3Vyc29yIHdpdGggbGF5ZXIgd2l0aCBpdGVtcyAoc3JjLml0ZW1zT25seSkgXG4gKiAtIChkc3QpIC0gbGF5ZXIgb2YgaXRlbXMgKGRzdC5pdGVtc09ubHkgJiYgZHN0Lm11dGFibGUpXG4gKlxuICogICBOT1RFXG4gKiAtIGltcGxlbWVudGF0aW9uIGFzc3VtZXMgXG4gKiAgICAgIC0gKGRzdCkgbGF5ZXIgaXMgbm90IHRoZSBzYW1lIGFzIHRoZSAoc3JjKSBsYXllclxuICogICAgICAtIChzcmMpIGN1cnNvciBjYW4gbm90IGJlIGNsb2NrIGN1cnNvciAobWFrZXMgbm8gc2Vuc2UgdG8gcmVjb3JkIGEgY2xvY2tcbiAqICAgXG4gKi9cblxuXG5leHBvcnQgZnVuY3Rpb24gbGF5ZXJfcmVjb3JkZXIob3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHtjdHJsLCBzcmMsIGRzdH0gPSBvcHRpb25zO1xuXG4gICAgLy8gY2hlY2sgLSBjdHJsXG4gICAgaWYgKCEoY3RybCBpbnN0YW5jZW9mIEN1cnNvcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjdHJsIG11c3QgYmUgYSBjdXJzb3IgJHtjdHJsfWApO1xuICAgIH1cbiAgICBpZiAoXG4gICAgICAgICFjdHJsLmZpeGVkUmF0ZSAmJiAhY3RybC5jdHJsLmZpeGVkUmF0ZVxuICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGN0cmwgb3IgY3RybC5jdHJsIG11c3QgYmUgZml4ZWRSYXRlICR7Y3RybH1gKTtcbiAgICB9XG4gICAgaWYgKCFjdHJsLmZpeGVkUmF0ZSkge1xuICAgICAgICBpZiAoY3RybC5jdHJsLmZpeGVkUmF0ZSAmJiAhY3RybC5pdGVtc09ubHkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgZ2l2ZW4gY3RybC5jdHJsLmZpeGVkUmF0ZSwgY3RybCBtdXN0IGJlIGl0ZW1zT25seSAke2N0cmx9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjaGVjayAtIHNyY1xuICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIEN1cnNvcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzcmMgbXVzdCBiZSBhIGN1cnNvciAke3NyY31gKTtcbiAgICB9XG4gICAgaWYgKChzcmMuZml4ZWRSYXRlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGN1cnNvciBzcmMgY2FuIG5vdCBiZSBmaXhlZFJhdGUgY3Vyc29yICR7c3JjfWApO1xuICAgIH1cbiAgICBpZiAoIXNyYy5pdGVtc09ubHkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjdXJzb3Igc3JjIG11c3QgYmUgaXRlbXNPbmx5ICR7c3JjfWApO1xuICAgIH1cbiAgICBpZiAoIXNyYy5tdXRhYmxlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgY3Vyc29yIHNyYyBtdXN0IGJlIG11dGFibGUgJHtzcmN9YCk7XG4gICAgfVxuXG4gICAgLy8gY2hlY2sgLSBzdGF0ZVByb3ZpZGVyc1xuICAgIGNvbnN0IHNyY19zdGF0ZVByb3ZpZGVyID0gc3JjLnNyYy5wcm92aWRlcjtcbiAgICBjb25zdCBkc3Rfc3RhdGVQcm92aWRlciA9IGRzdC5wcm92aWRlcjtcbiAgICBpZiAoc3JjX3N0YXRlUHJvdmlkZXIgPT09IGRzdF9zdGF0ZVByb3ZpZGVyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgc3JjIGFuZCBkc3QgY2FuIG5vdCBoYXZlIHRoZSBzYW1lIHN0YXRlUHJvdmlkZXJgKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIHR1cm4gdGhpcyBhcm91bmQ/XG4gICAgICogaGF2ZSBzdGFydCBhbmQgc3RvcCByZWNvcmRpbmdcbiAgICAgKiBtZXRob2RzIGRpcmVjdCB0aGUgY29udHJvbD9cbiAgICAgKiBcbiAgICAgKiByZWNvcmRpbmcgd2l0aCBsaXZlIGNsb2NrIHJlcXVpcmVzXG4gICAgICogc3RhcnQgYW5kIHN0b3AgbWV0aG9kc1xuICAgICAqIFxuICAgICAqIHdoYXQgYWJvdXQgYSBtZWRpYSBjbG9jayA/XG4gICAgICogc2hvdWxkIGJlIGEgbWVkaWEgY2xvY2sgdGhhdCBjYW4gb25seSBtb3ZlIGZvcndhcmRcbiAgICAgKiBpdCBhY3R1YWxseSBtYWtlcyBzZW5zZSB0byBiZSBpbiByZWNvcmQgbW9kZSBldmVuIGlmIG1lZGlhY2xvY2sgaXMgcGF1c2VkXG4gICAgICogYmVjYXVzZSByZWNvcmRpbmcgb25seSBoYXBwZW5zIG9uIHN0YXRlIGNoYW5nZVxuICAgICAqIHBhdXNlZCBtZWFucyB5b3Ugb3ZlcndyaXRlIG9uIHRoZSBzYW1lIHNwb3RcbiAgICAgKiBza2lwcGluZyBiYWNrIHdoaWxlIGluIHJlY29yZCBtb2RlIC0gc2hvdWxkIHRoYXQgdHJpZ2dlciB3cml0ZSBjdXJyZW50XG4gICAgICogc3RhdGUgbG9uZ2VyIGJhY2tcbiAgICAgKiBcbiAgICAgKiBza2lwcGluZyBhbHdheXMgZXhpdCByZWNvcmQgbW9kZVxuICAgICAqIHJlY29yZCBtb2RlIGFsd2F5cyBzdGFydHNcbiAgICAgKiBtZWRpYSBjb250cm9sIG1heSBiZSBjb250cm9sbGVkIGV4dGVybmFsbHlcbiAgICAgKiBcbiAgICAgKiBzcGxpdCBiZXR3ZWVuIGEgbGl2ZSBhbmQgYSBtZWRpYSBjbG9jayByZWNvcmRlcj9cbiAgICAgKiBcbiAgICAgKi9cblxuICAgIC8vIGludGVybmFsIHN0YXRlXG4gICAgbGV0IGlzX3JlY29yZGluZyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogc3RhdGUgY2hhbmdlIGluIHNyYyBzdGF0ZVByb3ZpZGVyXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBvbl9zcmNfY2hhbmdlICgpIHtcbiAgICAgICAgaWYgKCFpc19yZWNvcmRpbmcpIHJldHVybjtcbiAgICAgICAgcmVjb3JkKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc3RhdGUgY2hhbmdlIGluIGN0cmxcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBvbl9jdHJsX2NoYW5nZSAoKSB7XG4gICAgICAgIC8vIGZpZ3VyZSBvdXQgaWYgcmVjb3JkaW5nIHN0YXJ0cyBvciBzdG9wc1xuICAgICAgICBjb25zdCB3YXNfcmVjb3JkaW5nID0gaXNfcmVjb3JkaW5nO1xuICAgICAgICBpc19yZWNvcmRpbmcgPSBmYWxzZTtcbiAgICAgICAgaWYgKGN0cmwuZml4ZWRSYXRlKSB7XG4gICAgICAgICAgICBpc19yZWNvcmRpbmcgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgY3RybF90cyA9IGN0cmwuY3RybC52YWx1ZTtcbiAgICAgICAgICAgIGNvbnN0IGl0ZW1zID0gY3RybC5zcmMuaW5kZXgubmVhcmJ5KGN0cmxfdHMpLmNlbnRlcjtcbiAgICAgICAgICAgIGlmIChpdGVtcy5sZW5ndGggPT0gMSlcbiAgICAgICAgICAgICAgICBpZiAoaXRlbXNbMF0udHlwZSA9PSBcIm1vdGlvblwiICkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBbcCx2LGEsdF0gPSBpdGVtc1swXS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICBpZiAodiA+IDAgfHwgdiA9PSAwICYmIGEgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpc19yZWNvcmRpbmcgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF3YXNfcmVjb3JkaW5nICYmIGlzX3JlY29yZGluZykge1xuICAgICAgICAgICAgc3RhcnRfcmVjb3JkaW5nKCk7XG4gICAgICAgIH0gZWxzZSBpZiAod2FzX3JlY29yZGluZyAmJiAhaXNfcmVjb3JkaW5nKSB7XG4gICAgICAgICAgICBzdG9wX3JlY29yZGluZygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVjb3JkXG4gICAgICovXG4gICAgZnVuY3Rpb24gc3RhcnRfcmVjb3JkaW5nKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcInN0YXJ0IHJlY29yZGluZ1wiKVxuICAgICAgICByZWNvcmQoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdG9wX3JlY29yZGluZygpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJzdG9wIHJlY29yZGluZ1wiKVxuICAgICAgICAvLyBjbG9zZSBsYXN0IGl0ZW1cbiAgICAgICAgY29uc3QgdHMgPSBsb2NhbF9jbG9jay5ub3coKTtcbiAgICAgICAgY29uc3QgZHN0X29mZnNldCA9IGN0cmwucXVlcnkodHMpLnZhbHVlO1xuICAgICAgICBjb25zdCBpdGVtcyA9IGRzdC5pbmRleC5uZWFyYnkoZHN0X29mZnNldCkuY2VudGVyO1xuICAgICAgICBjb25zdCBpbnNlcnQgPSBpdGVtcy5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG5ld19pdGVtID0gey4uLml0ZW19O1xuICAgICAgICAgICAgbmV3X2l0ZW0uaXR2WzFdID0gZHN0X29mZnNldDtcbiAgICAgICAgICAgIG5ld19pdGVtLml0dlszXSA9IGZhbHNlO1xuICAgICAgICAgICAgcmV0dXJuIG5ld19pdGVtO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGl0ZW1zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGRzdC51cGRhdGUoe2luc2VydCwgcmVzZXQ6ZmFsc2V9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlY29yZCgpIHtcbiAgICAgICAgY29uc3QgdHMgPSBsb2NhbF9jbG9jay5ub3coKTtcbiAgICAgICAgY29uc3Qgc3JjX29mZnNldCA9IHNyYy5xdWVyeSh0cykub2Zmc2V0O1xuICAgICAgICBjb25zdCBkc3Rfb2Zmc2V0ID0gY3RybC5xdWVyeSh0cykudmFsdWU7XG4gICAgICAgIC8vIGdldCBjdXJyZW50IHNyYyBpdGVtc1xuICAgICAgICAvLyBjcnVjaWFsIHRvIGNsb25lIHRoZSBpdGVtcyBiZWZvcmUgY2hhbmdpbmcgYW5kXG4gICAgICAgIC8vIHN0b3JpbmcgdGhlbSBpbiB0aGUgZHN0IGxheWVyXG4gICAgICAgIGxldCBzcmNfaXRlbXMgPSBzdHJ1Y3R1cmVkQ2xvbmUoc3JjX3N0YXRlUHJvdmlkZXIuZ2V0KCkpO1xuXG4gICAgICAgIC8vIHJlLWVuY29kZSBpdGVtcyBpbiBkc3QgdGltZWZyYW1lLCBpZiBuZWVkZWRcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gZHN0X29mZnNldCAtIHNyY19vZmZzZXQ7XG4gICAgICAgIGlmIChvZmZzZXQgIT0gMCkge1xuICAgICAgICAgICAgY29uc3QgZHN0X2l0ZW1zID0gc3JjX2l0ZW1zLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aW1lc2hpZnRfaXRlbShpdGVtLCBvZmZzZXQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBkc3QuYXBwZW5kKGRzdF9pdGVtcywgZHN0X29mZnNldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkc3QuYXBwZW5kKHNyY19pdGVtcywgc3JjX29mZnNldCk7XG4gICAgICAgIH0gICAgICAgIFxuICAgIH1cblxuICAgIC8vIHJlZ2lzdGVyIGNhbGxiYWNrc1xuICAgIHNyY19zdGF0ZVByb3ZpZGVyLmFkZF9jYWxsYmFjayhvbl9zcmNfY2hhbmdlKTtcbiAgICBjdHJsLmFkZF9jYWxsYmFjayhvbl9jdHJsX2NoYW5nZSk7XG4gICAgb25fY3RybF9jaGFuZ2UoKTtcblxuICAgIHJldHVybiBkc3Q7XG59XG5cblxuLyoqXG4gKiB0aW1lc2hpZnQgcGFyYW1ldGVycyBvZiB0aW1lIGJ5IG9mZnNldFxuICovXG5mdW5jdGlvbiB0aW1lc2hpZnRfaXRlbSAoaXRlbSwgb2Zmc2V0KSB7XG4gICAgaXRlbSA9IHsuLi5pdGVtfTtcbiAgICBpdGVtLml0dlswXSA9IChpdGVtLml0dlswXSAhPSBudWxsKSA/IGl0ZW0uaXR2WzBdICsgb2Zmc2V0IDogbnVsbDtcbiAgICBpdGVtLml0dlsxXSA9IChpdGVtLml0dlsxXSAhPSBudWxsKSA/IGl0ZW0uaXR2WzFdICsgb2Zmc2V0IDogbnVsbDtcbiAgICAvLyBUT0RPIC0gcGVyaGFwcyBjaGFuZ2UgaW1wbGVtZW50YXRpb24gb2YgbW90aW9uIGFuZCB0cmFuc2l0aW9uIHNlZ21lbnRcbiAgICAvLyB0byB1c2UgdGltZXN0YW1wcyByZWxhdGl2ZSB0byB0aGUgc3RhcnQgb2YgdGhlIHNlZ21lbnQsXG4gICAgLy8gc2ltaWxhciB0byBpbnRlcnBvbGF0aW9uP1xuICAgIGlmIChpdGVtLnR5cGUgPT0gXCJtb3Rpb25cIikge1xuICAgICAgICBpdGVtLmRhdGEudGltZXN0YW1wID0gaXRlbS5kYXRhLnRpbWVzdGFtcCArIG9mZnNldDtcbiAgICB9IGVsc2UgaWYgKGl0ZW0udHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICBpdGVtLmRhdGEudDAgPSBpdGVtLmRhdGEudDAgKyBvZmZzZXQ7XG4gICAgICAgIGl0ZW0uZGF0YS50MSA9IGl0ZW0uZGF0YS50MSArIG9mZnNldDtcbiAgICB9XG4gICAgcmV0dXJuIGl0ZW07XG59XG5cblxuXG4iLCJpbXBvcnQgeyBDdXJzb3IgfSBmcm9tIFwiLi4vY3Vyc29yX2Jhc2UuanNcIjtcblxuLyoqXG4gKiBUaW1pbmcgT2JqZWN0IEN1cnNvclxuICogQ3JlYXRlIGEgbmV3IEN1cnNvciB3aGljaCBoYXMgYSBUaW1pbmcgT2JqZWN0IGFzIHNyYyBwcm9wZXJ0eS5cbiAqIFxuICogVGhlIG5ldyBDdXJzb3IgZG9lcyBub3QgaGF2ZSBhIHNyYyAobGF5ZXIpIG9yIGEgY3RybCAoY3Vyc29yKVxuICogcHJvcGVydHksIHNpbmNlIGl0IG9ubHkgZGVwZW5kcyBvbiB0aGUgc3JjIFRpbWluZ09iamVjdC5cbiAqIFxuICogQWxzbywgdGhlIG5ldyBjdXJzb3IgZG9lcyBub3QgbmVlZCBhbnkgcGxheWJhY2sgbG9naWMgb24gaXRzIG93blxuICogc2luY2UgaXQgaXMgb25seSBhIHdyYXBwZXIgYW5kIHRoZSB0aW1pbmcgb2JqZWN0IHByb3ZpZGVzIHBsYXliYWNrIHN1cHBvcnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjdXJzb3JfZnJvbV90aW1pbmdvYmplY3Qoc3JjKSB7XG5cbiAgICBpZiAoc3JjLmNvbnN0cnVjdG9yLm5hbWUgIT0gXCJUaW1pbmdPYmplY3RcIikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNyYyBtdXN0IGJlIGEgVGltaW5nT2JqZWN0ICR7c3JjfWApO1xuICAgIH1cblxuICAgIGNvbnN0IGN1cnNvciA9IG5ldyBDdXJzb3IoKTtcblxuICAgIC8vIGltcGxlbWVudCBxdWVyeVxuICAgIGN1cnNvci5xdWVyeSA9IGZ1bmN0aW9uIHF1ZXJ5KCkge1xuICAgICAgICBjb25zdCB7cG9zaXRpb24sIHZlbG9jaXR5LCBhY2NlbGVyYXRpb24sIHRpbWVzdGFtcH0gPSBzcmMucXVlcnkoKTtcbiAgICAgICAgY29uc3QgZHluYW1pYyA9ICh2ZWxvY2l0eSAhPSAwIHx8IGFjY2VsZXJhdGlvbiAhPSAwKTtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTpwb3NpdGlvbiwgZHluYW1pYywgb2Zmc2V0OnRpbWVzdGFtcH07XG4gICAgfVxuXG4gICAgLy8gbnVtZXJpY1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjdXJzb3IsIFwibnVtZXJpY1wiLCB7Z2V0OiAoKSA9PiB0cnVlfSk7XG4gICAgLy8gZml4ZWRSYXRlXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGN1cnNvciwgXCJmaXhlZFJhdGVcIiwge2dldDogKCkgPT4gZmFsc2V9KTtcblxuICAgIC8vIGNhbGxiYWNrcyBmcm9tIHRpbWluZyBvYmplY3RcbiAgICBzcmMub24oXCJjaGFuZ2VcIiwgKCkgPT4ge2N1cnNvci5vbmNoYW5nZSgpfSk7XG4gICAgcmV0dXJuIGN1cnNvcjtcbn1cbiIsImltcG9ydCB7ZW5kcG9pbnR9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG4vKlxuICAgIFN0YXRlIFByb3ZpZGVyIFZpZXdlclxuKi9cblxuZnVuY3Rpb24gaXRlbTJzdHJpbmcoaXRlbSwgb3B0aW9ucykge1xuICAgIC8vIHR4dFxuICAgIGNvbnN0IGlkX3R4dCA9IGl0ZW0uaWQ7XG4gICAgY29uc3QgdHlwZV90eHQgPSBpdGVtLnR5cGU7XG4gICAgbGV0IGl0dl90eHQgPSBcIlwiO1xuICAgIGlmIChpdGVtLml0diAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdID0gaXRlbS5pdHY7XG4gICAgICAgIGNvbnN0IGxvd190eHQgPSAobG93ID09IG51bGwpID8gXCJudWxsXCIgOiBsb3cudG9GaXhlZCgyKTtcbiAgICAgICAgY29uc3QgaGlnaF90eHQgPSAoaGlnaCA9PSBudWxsKSA/IFwibnVsbFwiIDogaGlnaC50b0ZpeGVkKDIpO1xuICAgICAgICBpdHZfdHh0ID0gYFske2xvd190eHR9LCR7aGlnaF90eHR9LCR7bG93SW5jbHVkZX0sJHtoaWdoSW5jbHVkZX1dYDsgXG4gICAgfVxuICAgIGxldCBkYXRhX3R4dCA9IEpTT04uc3RyaW5naWZ5KGl0ZW0uZGF0YSk7XG5cbiAgICAvLyBodG1sXG4gICAgbGV0IGlkX2h0bWwgPSBgPHNwYW4gY2xhc3M9XCJpdGVtLWlkXCI+JHtpZF90eHR9PC9zcGFuPmA7XG4gICAgbGV0IGl0dl9odG1sID0gYDxzcGFuIGNsYXNzPVwiaXRlbS1pdHZcIj4ke2l0dl90eHR9PC9zcGFuPmA7XG4gICAgbGV0IHR5cGVfaHRtbCA9IGA8c3BhbiBjbGFzcz1cIml0ZW0tdHlwZVwiPiR7dHlwZV90eHR9PC9zcGFuPmBcbiAgICBsZXQgZGF0YV9odG1sID0gYDxzcGFuIGNsYXNzPVwiaXRlbS1kYXRhXCI+JHtkYXRhX3R4dH08L3NwYW4+YDtcbiAgICBcbiAgICAvLyBkZWxldGUgQnV0dG9uXG4gICAgY29uc3Qge2RlbGV0ZV9hbGxvd2VkPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgaWYgKGRlbGV0ZV9hbGxvd2VkKSB7XG4gICAgICAgIHJldHVybiBgXG4gICAgICAgIDxkaXY+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPVwiZGVsZXRlXCI+WDwvYnV0dG9uPlxuICAgICAgICAgICAgJHtpZF9odG1sfTogJHt0eXBlX2h0bWx9ICR7aXR2X2h0bWx9ICR7ZGF0YV9odG1sfVxuICAgICAgICA8L2Rpdj5gO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBgXG4gICAgICAgIDxkaXY+XG4gICAgICAgICAgICAke2lkX2h0bWx9OiAke3R5cGVfaHRtbH0gJHtpdHZfaHRtbH0gJHtkYXRhX2h0bWx9XG4gICAgICAgIDwvZGl2PmA7ICAgICAgICBcbiAgICB9XG59XG5cblxuZXhwb3J0IGNsYXNzIFN0YXRlUHJvdmlkZXJWaWV3ZXIge1xuXG4gICAgY29uc3RydWN0b3Ioc3RhdGVQcm92aWRlciwgZWxlbSwgb3B0aW9ucz17fSkge1xuICAgICAgICB0aGlzLl9zcCA9IHN0YXRlUHJvdmlkZXI7XG4gICAgICAgIHRoaXMuX2VsZW0gPSBlbGVtO1xuICAgICAgICB0aGlzLl9oYW5kbGUgPSB0aGlzLl9zcC5hZGRfY2FsbGJhY2sodGhpcy5fb25jaGFuZ2UuYmluZCh0aGlzKSk7IFxuXG4gICAgICAgIC8vIG9wdGlvbnNcbiAgICAgICAgbGV0IGRlZmF1bHRzID0ge1xuICAgICAgICAgICAgdG9TdHJpbmc6aXRlbTJzdHJpbmdcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fb3B0aW9ucyA9IHsuLi5kZWZhdWx0cywgLi4ub3B0aW9uc307XG5cbiAgICAgICAgLypcbiAgICAgICAgICAgIFN1cHBvcnQgZGVsZXRlXG4gICAgICAgICovXG4gICAgICAgIGlmICh0aGlzLl9vcHRpb25zLmRlbGV0ZV9hbGxvd2VkKSB7XG4gICAgICAgICAgICAvLyBsaXN0ZW4gZm9yIGNsaWNrIGV2ZW50cyBvbiByb290IGVsZW1lbnRcbiAgICAgICAgICAgIGVsZW0uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gY2F0Y2ggY2xpY2sgZXZlbnQgZnJvbSBkZWxldGUgYnV0dG9uXG4gICAgICAgICAgICAgICAgY29uc3QgZGVsZXRlQnRuID0gZS50YXJnZXQuY2xvc2VzdChcIiNkZWxldGVcIik7XG4gICAgICAgICAgICAgICAgaWYgKGRlbGV0ZUJ0bikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaXN0SXRlbSA9IGRlbGV0ZUJ0bi5jbG9zZXN0KFwiLmxpc3QtaXRlbVwiKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpc3RJdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zcC51cGRhdGUoe3JlbW92ZTpbbGlzdEl0ZW0uaWRdfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKlxuICAgICAgICAgICAgcmVuZGVyIGluaXRpYWwgc3RhdGVcbiAgICAgICAgKi8gXG4gICAgICAgIHRoaXMuX29uY2hhbmdlKCk7XG4gICAgfVxuXG4gICAgX29uY2hhbmdlKCkge1xuICAgICAgICBjb25zdCBpdGVtcyA9IHRoaXMuX3NwLmdldCgpIHx8IFtdO1xuXG4gICAgICAgIC8vIHNvcnQgYnkgbG93IGVuZHBvaW50XG4gICAgICAgIGl0ZW1zLnNvcnQoKGl0ZW1fYSwgaXRlbV9iKSA9PiB7XG4gICAgICAgICAgICBsZXQgbG93RXBfYSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbV9hLml0dilbMF07XG4gICAgICAgICAgICBsZXQgbG93RXBfYiA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbV9iLml0dilbMF07XG4gICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuY21wKGxvd0VwX2EsIGxvd0VwX2IpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBjbGVhclxuICAgICAgICB0aGlzLl9lbGVtLnJlcGxhY2VDaGlsZHJlbigpO1xuICAgICAgICAvLyByZWJ1aWxkXG4gICAgICAgIGNvbnN0IHt0b1N0cmluZ30gPSB0aGlzLl9vcHRpb25zO1xuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICAgICAgICAvLyBhZGRcbiAgICAgICAgICAgIGxldCBub2RlID0gdGhpcy5fZWxlbS5xdWVyeVNlbGVjdG9yKGAjJHtpdGVtLmlkfWApO1xuICAgICAgICAgICAgaWYgKG5vZGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICAgICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKFwiaWRcIiwgaXRlbS5pZCk7XG4gICAgICAgICAgICAgICAgbm9kZS5jbGFzc0xpc3QuYWRkKFwibGlzdC1pdGVtXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2VsZW0uYXBwZW5kQ2hpbGQobm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBub2RlLmlubmVySFRNTCA9IHRvU3RyaW5nKGl0ZW0sIHRoaXMuX29wdGlvbnMpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJfcHJvdmlkZXIoc3RhdGVQcm92aWRlciwgc2VsZWN0b3IsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCBlbGVtcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICAgIHJldHVybiBuZXcgU3RhdGVQcm92aWRlclZpZXdlcihzdGF0ZVByb3ZpZGVyLCBlbGVtcywgb3B0aW9ucyk7XG59XG4iLCIvLyBjbGFzc2VzXG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi9uZWFyYnlfYmFzZS5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi9sYXllcl9iYXNlLmpzXCI7XG5pbXBvcnQgeyBDdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3JfYmFzZS5qc1wiO1xuXG4vLyBzdGF0ZVByb3ZpZGVyc1xuaW1wb3J0IHsgY2xvY2tfcHJvdmlkZXIgfSBmcm9tIFwiLi9wcm92aWRlcl9jbG9jay5qc1wiO1xuaW1wb3J0IHsgQ29sbGVjdGlvblByb3ZpZGVyIH0gZnJvbSBcIi4vcHJvdmlkZXJfY29sbGVjdGlvbi5qc1wiO1xuaW1wb3J0IHsgT2JqZWN0UHJvdmlkZXIgfSBmcm9tIFwiLi9wcm92aWRlcl9vYmplY3QuanNcIjtcblxuLy8gZmFjdG9yeSBmdW5jdGlvbnNcbmltcG9ydCB7IGxlYWZfbGF5ZXIgfSBmcm9tIFwiLi9sYXllcl9sZWFmLmpzXCI7XG5pbXBvcnQgeyBjbG9ja19jdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3JfY2xvY2suanNcIlxuaW1wb3J0IHsgb2JqZWN0X2N1cnNvciB9IGZyb20gXCIuL2N1cnNvcl9vYmplY3QuanNcIjtcbmltcG9ydCB7IHBsYXliYWNrX2N1cnNvciB9IGZyb20gXCIuL2N1cnNvcl9wbGF5YmFjay5qc1wiO1xuaW1wb3J0IHsgbGF5ZXJfZnJvbV9jdXJzb3IgfSBmcm9tIFwiLi9vcHMvbGF5ZXJfZnJvbV9jdXJzb3IuanNcIjtcbmltcG9ydCB7IG1lcmdlX2xheWVyIH0gZnJvbSBcIi4vb3BzL21lcmdlLmpzXCI7XG5pbXBvcnQgeyBib29sZWFuX2xheWVyIH0gZnJvbSBcIi4vb3BzL2Jvb2xlYW4uanNcIlxuaW1wb3J0IHsgbG9naWNhbF9tZXJnZV9sYXllciwgbG9naWNhbF9leHByfSBmcm9tIFwiLi9vcHMvbG9naWNhbF9tZXJnZS5qc1wiO1xuaW1wb3J0IHsgdGltZWxpbmVfdHJhbnNmb3JtIH0gZnJvbSBcIi4vb3BzL3RpbWVsaW5lX3RyYW5zZm9ybS5qc1wiO1xuaW1wb3J0IHsgY3Vyc29yX3RyYW5zZm9ybSwgbGF5ZXJfdHJhbnNmb3JtIH0gZnJvbSBcIi4vb3BzL3RyYW5zZm9ybS5qc1wiO1xuaW1wb3J0IHsgbGF5ZXJfcmVjb3JkZXIgfSBmcm9tIFwiLi9vcHMvcmVjb3JkLmpzXCI7XG5pbXBvcnQgeyBjdXJzb3JfZnJvbV90aW1pbmdvYmplY3QgfSBmcm9tIFwiLi9vcHMvY3Vyc29yX2Zyb21fdGltaW5nb2JqZWN0LmpzXCI7XG5cbi8vIHV0aWxcbmltcG9ydCB7IGxvY2FsX2Nsb2NrLCByZW5kZXJfY3Vyc29yLCBjaGVja19pdGVtcyB9IGZyb20gXCIuL3V0aWwvY29tbW9uLmpzXCI7XG5pbXBvcnQgeyByZW5kZXJfcHJvdmlkZXIgfSBmcm9tIFwiLi91dGlsL3Byb3ZpZGVyX3ZpZXdlci5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUiBGQUNUT1JJRVNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gbGF5ZXIob3B0aW9ucz17fSkge1xuICAgIGxldCB7c3JjLCBwcm92aWRlciwgaXRlbXM9W10sIHZhbHVlLCAuLi5vcHRzfSA9IG9wdGlvbnM7XG4gICAgaWYgKHNyYyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHNyYyBpbnN0YW5jZW9mIExheWVyKSB7XG4gICAgICAgICAgICByZXR1cm4gc3JjO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChwcm92aWRlciA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgaXRlbXMgPSBjaGVja19pdGVtcyhbe1xuICAgICAgICAgICAgICAgIGl0djogW251bGwsIG51bGwsIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgICAgIGRhdGE6IHZhbHVlXG4gICAgICAgICAgICB9XSlcbiAgICAgICAgICAgIHByb3ZpZGVyID0gbmV3IE9iamVjdFByb3ZpZGVyKHtpdGVtc30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaXRlbXMgPSBjaGVja19pdGVtcyhpdGVtcyk7XG4gICAgICAgICAgICBwcm92aWRlciA9IG5ldyBDb2xsZWN0aW9uUHJvdmlkZXIoe2l0ZW1zfSk7XG4gICAgICAgIH0gXG4gICAgfVxuICAgIHJldHVybiBsZWFmX2xheWVyKHtwcm92aWRlciwgLi4ub3B0c30pOyBcbn1cblxuZnVuY3Rpb24gcmVjb3JkIChvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgZHN0ID0gbGF5ZXIoe211dGFibGU6dHJ1ZX0pO1xuICAgIGxldCB7Y3RybCwgc3JjfSA9IG9wdGlvbnM7XG4gICAgaWYgKGN0cmwgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGN0cmwgPSBjbG9jaygpO1xuICAgIH1cbiAgICByZXR1cm4gbGF5ZXJfcmVjb3JkZXIoe2N0cmwsIHNyYywgZHN0fSk7XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBDVVJTT1IgRkFDVE9SSUVTXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmZ1bmN0aW9uIGNsb2NrKG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7Y2xvY2ssIHZlY3RvciwgLi4ub3B0c30gPSBvcHRpb25zO1xuICAgIGNvbnN0IHByb3ZpZGVyID0gY2xvY2tfcHJvdmlkZXIoe2Nsb2NrLCB2ZWN0b3J9KTtcbiAgICByZXR1cm4gY2xvY2tfY3Vyc29yKHtwcm92aWRlciwgLi4ub3B0c30pO1xufVxuXG5mdW5jdGlvbiBvYmplY3Qob3B0aW9ucz17fSkge1xuICAgIGxldCB7Y3RybCwgc3JjLCAuLi5zcmNfb3B0c30gPSBvcHRpb25zO1xuICAgIGlmIChjdHJsID09IHVuZGVmaW5lZCkge1xuICAgICAgICBjdHJsID0gY2xvY2soKTtcbiAgICB9XG4gICAgaWYgKHNyYyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3JjID0gbGF5ZXIoc3JjX29wdHMpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0X2N1cnNvcih7Y3RybCwgc3JjfSk7XG59XG5cbmZ1bmN0aW9uIHBsYXliYWNrKG9wdGlvbnM9e30pIHtcbiAgICBsZXQge2N0cmwsIHNyYywgLi4uc3JjX29wdHN9ID0gb3B0aW9ucztcbiAgICBpZiAoY3RybCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY3RybCA9IGNsb2NrKCk7XG4gICAgfVxuICAgIGlmIChzcmMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNyYyA9IGxheWVyKHNyY19vcHRzKTtcbiAgICB9XG4gICAgcmV0dXJuIHBsYXliYWNrX2N1cnNvcih7Y3RybCwgc3JjfSk7XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEVYUE9SVFNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IHtcbiAgICBDb2xsZWN0aW9uUHJvdmlkZXIsIE9iamVjdFByb3ZpZGVyLFxuICAgIGxvY2FsX2Nsb2NrLFxuICAgIExheWVyLCBDdXJzb3IsIE5lYXJieUluZGV4QmFzZSxcbiAgICBsYXllciwgXG4gICAgY2xvY2ssXG4gICAgb2JqZWN0LFxuICAgIHBsYXliYWNrLFxuICAgIHJlY29yZCxcbiAgICBtZXJnZV9sYXllciBhcyBtZXJnZSwgXG4gICAgYm9vbGVhbl9sYXllciBhcyBib29sZWFuLFxuICAgIGxvZ2ljYWxfbWVyZ2VfbGF5ZXIgYXMgbG9naWNhbF9tZXJnZSwgXG4gICAgbG9naWNhbF9leHByLFxuICAgIGxheWVyX2Zyb21fY3Vyc29yLFxuICAgIGxheWVyX3RyYW5zZm9ybSxcbiAgICBjdXJzb3JfdHJhbnNmb3JtLFxuICAgIGN1cnNvcl9mcm9tX3RpbWluZ29iamVjdCxcbiAgICB0aW1lbGluZV90cmFuc2Zvcm0sXG4gICAgcmVuZGVyX3Byb3ZpZGVyLFxuICAgIHJlbmRlcl9jdXJzb3Jcbn0iXSwibmFtZXMiOlsiY21wX2FzY2VuZGluZyIsImNtcF9kZXNjZW5kaW5nIiwiUFJFRklYIiwiYWRkU3RhdGUiLCJhZGRNZXRob2RzIiwiY2FsbGJhY2suYWRkU3RhdGUiLCJldmVudGlmeS5hZGRTdGF0ZSIsImNhbGxiYWNrLmFkZE1ldGhvZHMiLCJldmVudGlmeS5hZGRNZXRob2RzIiwiY2FsbGJhY2suaXNfY2FsbGJhY2tfYXBpIiwic3JjcHJvcC5hZGRTdGF0ZSIsInNyY3Byb3AuYWRkTWV0aG9kcyJdLCJtYXBwaW5ncyI6Ijs7O0lBQUE7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNB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QUssQ0FBQyx5QkFBeUIsQ0FBQztJQUN0RTtJQUNBLEtBQ0E7SUFDQSxJQUFJLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDekIsUUFBUSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7SUFDMUMsS0FBSyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDaEMsUUFBUSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUM7SUFDM0MsS0FBSyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDaEMsUUFBUSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUM7SUFDN0MsS0FBSyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7SUFDL0IsUUFBUSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUM7SUFDQSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUMsR0FBRyxHQUFHO0lBQ2xEO0lBQ0EsSUFBSSxJQUFJLEdBQUcsSUFBSSxTQUFTLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFO0lBQzlDLFFBQVEsR0FBRyxHQUFHLElBQUk7SUFDbEI7SUFDQSxJQUFJLElBQUksSUFBSSxJQUFJLFNBQVMsSUFBSSxJQUFJLElBQUksUUFBUSxFQUFFO0lBQy9DLFFB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QUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztJQUN0QyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFO0lBQzVCLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLE1BQU0sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3JEO0lBQ0EsRUFBRSxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQztJQUNuQyxFQUFFLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDO0lBQy9ELEVBQUUsSUFBSSxHQUFHLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEtBQUssS0FBSztJQUM3QyxHQUFHLE9BQU8sS0FBSyxDQUFDLEVBQUUsSUFBSSxJQUFJLENBQUMsRUFBRTtJQUM3QixHQUFHLENBQUM7SUFDSixFQUFFLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFO0lBQ2pCLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDekI7SUFDQSxFQUFFLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDO0lBQzlELEVBQUUsT0FBTyxTQUFTLElBQUksQ0FBQyxRQUFRO0lBQy9COztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRTtJQUN0QixFQUFFLE1BQU0sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtJQUMxQixFQUFFLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENB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Q0FBQyxDQUFDO0lBQ3BELElBQUksT0FBTyxZQUFZLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUM1Qzs7SUFFQSxTQUFTLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO0lBQzVCLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxRQUFRLENBQUMsR0FBRyxPQUFPO0lBQzFDLElBQUksSUFBSSxJQUFJLElBQUksU0FBUyxFQUFFO0lBQzNCLFFBQVEsSUFBSSxHQUFHLEtBQUssRUFBRTtJQUN0QjtJQUNBLElBQUksSUFBSSxHQUFHLElBQUksU0FBUyxFQUFFO0lBQzFCLFFBQVEsR0FBRyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUM7SUFDN0I7SUFDQSxJQUFJLE9BQU8sYUFBYSxDQUFDLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3JDOztJQUVBLFNBQVMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDOUIsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLFFBQVEsQ0FBQyxHQUFHLE9BQU87SUFDMUMsSUFBSSxJQUFJLElBQUksSUFBSSxTQUFTLEVBQUU7SUFDM0IsUUFBUSxJQUFJLEdBQUcsS0FBSyxFQUFFO0lBQ3RCO0lBQ0EsSUFBSSxJQUFJLEdBQUcsSUFBSSxTQUFTLEVBQUU7SUFDMUIsUUFBUSxHQUFHLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQztJQUM3QjtJQUNBLElBQUksT0FBTyxlQUFlLENBQUMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDdkM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7In0=
