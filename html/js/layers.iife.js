
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var LAYERS = (function (exports) {
    'use strict';

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
        let index = this[`${PREFIX$1}_handlers`].indexof(handle);
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
            addToInstance$1(this);
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
    addToPrototype$1(StateProviderBase.prototype);

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
        // make sure that intervals are well formed
        for (const item of items) {
            item.itv = interval.from_input(item.itv);
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
     *      center: list of ITEMS/LAYERS covering endpoint,
     *      itv: interval where nearby returns identical {center}
     *      left:
     *          first interval endpoint to the left 
     *          which will produce different {center}
     *          always a high-endpoint or [-Infinity, 0]
     *      right:
     *          first interval endpoint to the right
     *          which will produce different {center}
     *          always a low-endpoint or [Infinity, 0]    
     *      prev:
     *          first interval endpoint to the left 
     *          which will produce different && non-empty {center}
     *          always a high-endpoint or [-Infinity, 0] if no more intervals to the left
     *      next:
     *          first interval endpoint to the right
     *          which will produce different && non-empty {center}
     *          always a low-endpoint or [Infinity, 0] if no more intervals to the right
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

        check(offset) {
            if (typeof offset === 'number') {
                offset = [offset, 0];
            }
            if (!Array.isArray(offset)) {
                throw new Error("Endpoint must be an array");
            }
            return offset;
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
         * return nearby of first non-empty region to the right
         * which is not the center region. If not exists, return
         * undefined. 
         */
        next_region(nearby) {
            const next_nearby = this.right_region(nearby);
            if (next_nearby == undefined) {
                return undefined;
            }
            if (next_nearby.center.length > 0) {
                // center non-empty 
                return next_nearby;
            }
            // center empty
            // find first non-empty region to the right (recursively)
            return this.next_region(next_nearby);
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
         * return nearby of first non-empty region to the left
         * which is not the center region. If not exists, return
         * undefined. 
        */
        prev_region(nearby) {
            const next_nearby = this.left_region(nearby);
            if (next_nearby == undefined) {
                return undefined;
            }
            if (next_nearby.center.length > 0) {
                // center non-empty 
                return next_nearby;
            }
            // center empty
            // find first non-empty region to the left (recursively)
            return this.prev_region(next_nearby);
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
            this._includeEmpty = includeEmpty;        
            this._current;
            this._done = false;
        }

        next() {
            let current;
            if (this._done) {
                return {value:undefined, done:true};
            }
            if (this._current == undefined) {
                // initialise
                this._current = this._index.nearby(this._start);
            } 
            /* 
                need multiple passes to skip over
                empty regions within this next invocation
            */
            while (true) {
                current = this._current;

                // check if stop < region.low
                let low = endpoint.from_interval(current.itv)[0]; 
                if (endpoint.gt(low, this._stop)) {
                    return {value:undefined, done:true};
                }

                const is_last = current.itv[1] == Infinity;

                /* 
                    check if we need to skip to next within 
                    this next invocation
                */
                const skip_empty = (
                    is_last == false &&
                    this._includeEmpty == false &&
                    current.center.length == 0
                );
                if (skip_empty) {
                    this._current = this._index.right_region(current);
                    if (current == undefined) {
                        return {value:undefined, done:true}
                    }
                    continue;
                }

                if (is_last) {
                    this._done = true;
                } else {
                    // increment current
                    this._current = this._index.right_region(current);
                    if (current == undefined) {
                        this._done = true;
                    }
                }
                return {value:current, done:false};
            }
        }

        [Symbol.iterator]() {
            return this;
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
                    e.remove_callback(state.handles[idx]);
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
                    state.handles.push(e.add_callback(handler));
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

    const CLOCK = function () {
        const t0_local = local();
        const t0_epoch = epoch();
        return {
            now: function () {
                return t0_epoch + (local() - t0_local)
            }
        }
    }();


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
            offset = this.check(offset);
            const result = {
                center: [],
                itv: [-Infinity, Infinity, true, true],
                left: [-Infinity, 0],
                prev: [-Infinity, 0],
                right: [Infinity, 0],
                next: [Infinity, 0]
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
            let low = [-Infinity, 0], high= [Infinity, 0];
            if (result.center.length > 0) {
                let itv = result.center[0].itv;
                [low, high] = endpoint.from_interval(itv);
                result.left = (low[0] > -Infinity) ? endpoint.flip(low, "high") : [-Infinity, 0];
                result.right = (high[0] < Infinity) ? endpoint.flip(high, "low") : [Infinity, 0];
                result.itv = result.center[0].itv;
            } else {
                result.left = result.prev;
                result.right = result.next;
                // interval
                let left = result.left;
                if (low[0] == -Infinity) {
                    low = endpoint.flip(left, "low");
                }
                let right = result.right;
                if (high[0] == Infinity) {
                    high = endpoint.flip(right, "high");
                }
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
                if (!(src instanceof StateProviderBase)) {
                    throw new Error(`"src" must be state provider ${src}`);
                }
                return src;    
            }
        }

        srcprop_onchange(propName, eArg) {
            if (propName == "src") {
                if (this.index == undefined || eArg == "reset") {
                    this.index = new NearbyIndexSimple(this.src);
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
            offset = this.check(offset);
            // accumulate nearby from all sources
            const prev_list = [], next_list = [];
            const center_list = [];
            const center_high_list = [];
            const center_low_list = [];
            for (let src of this._sources) {
                let {prev, center, next, itv} = src.index.nearby(offset);
                if (prev[0] > -Infinity) prev_list.push(prev);            
                if (next[0] < Infinity) next_list.push(next);
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

            return result;
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
                next: shifted(nearby.next, this._skew),
                prev: shifted(nearby.prev, this._skew),
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
            addToInstance$1(this);
        }
        now () {
            throw new Error("not implemented");
        }
    }
    addToPrototype$1(ClockProviderBase.prototype);



    /************************************************
     * LOCAL CLOCK PROVIDER
     ************************************************/

    class LocalClockProvider extends ClockProviderBase {
        now () {
            return CLOCK.now();
        }
    }

    const localClockProvider = new LocalClockProvider();

    const METHODS = {assign, move, transition, interpolate};


    function cmd (target) {
        if (!(target instanceof StateProviderBase)) {
            throw new Error(`target.src must be stateprovider ${target}`);
        }
        let entries = Object.entries(METHODS)
            .map(([name, method]) => {
                return [
                    name,
                    function(...args) { 
                        let items = method.call(this, ...args);
                        return target.update(items);  
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
            this.ctrl = ctrl || localClockProvider;
            this.src = src;
        }

        /**********************************************************
         * SRCPROP: CTRL and SRC
         **********************************************************/

        srcprop_check(propName, obj) {
            if (propName == "ctrl") {
                const ok = [ClockProviderBase, Cursor]
                    .map((cl) => obj instanceof cl)
                    .some(e=>e == true);
                if (!ok) {
                    throw new Error(`"ctrl" must be ClockProvider or Cursor ${obj}`)
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
         * can be calculated. This is trivial if ctrl is a ClockCursor, and
         * it is fairly easy if the ctrl is Cursor representing motion
         * or linear transition. However, calculations can become more
         * complex if motion supports acceleration, or if transitions
         * are set up with non-linear easing.
         *   
         * Note, however, that these calculations assume that the cursor.ctrl is 
         * a ClockCursor, or that cursor.ctrl.ctrl is a ClockCursor. 
         * In principle, though, there could be a recursive chain of cursors,
         * (cursor.ctrl.ctrl....ctrl) of some length, where only the last is a 
         * ClockCursor. In order to do deterministic calculations in the general
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
         * is predicated on cursor.ctrl being a ClockCursor. Also, there 
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
         * (i) if ctrl is a ClockCursor && nearby.itv.high < Infinity
         * or
         * (ii) ctrl.ctrl is a ClockCursor
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
            if (this.ctrl instanceof ClockProviderBase) {
                if (isFinite(high)) {
                    this.__set_timeout(high, current_pos, 1.0, current_ts);
                    return;
                }
                // no future event to detect
                return;
            } 
            if (this.ctrl.ctrl instanceof ClockProviderBase) {
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
            if (this.ctrl instanceof ClockProviderBase) {
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

    /*********************************************************************
        LAYER FACTORY
    *********************************************************************/

    function layer(options={}) {
        let {src, items=[], value, ...opts} = options;
        if (src instanceof Layer) {
            return src;
        } 
        if (src == undefined) {
            if (value != undefined) {
                items = [{
                    itv: [-Infinity, Infinity],
                    data: value
                }];
            } 
            src = new LocalStateProvider({items});
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

    exports.cmd = cmd;
    exports.cursor = cursor;
    exports.layer = layer;
    exports.merge = merge;
    exports.playback = cursor;
    exports.shift = shift;
    exports.variable = cursor;

    return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hcGlfY2FsbGJhY2suanMiLCIuLi8uLi9zcmMvc3RhdGVwcm92aWRlcl9iYXNlcy5qcyIsIi4uLy4uL3NyYy9pbnRlcnZhbHMuanMiLCIuLi8uLi9zcmMvc3RhdGVwcm92aWRlcl9zaW1wbGUuanMiLCIuLi8uLi9zcmMvbmVhcmJ5aW5kZXguanMiLCIuLi8uLi9zcmMvYXBpX2V2ZW50aWZ5LmpzIiwiLi4vLi4vc3JjL2FwaV9zcmNwcm9wLmpzIiwiLi4vLi4vc3JjL3NlZ21lbnRzLmpzIiwiLi4vLi4vc3JjL3V0aWwuanMiLCIuLi8uLi9zcmMvbmVhcmJ5aW5kZXhfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL2xheWVycy5qcyIsIi4uLy4uL3NyYy9vcHMvbWVyZ2UuanMiLCIuLi8uLi9zcmMvb3BzL3NoaWZ0LmpzIiwiLi4vLi4vc3JjL3N0YXRlcHJvdmlkZXJfY2xvY2suanMiLCIuLi8uLi9zcmMvY21kLmpzIiwiLi4vLi4vc3JjL21vbml0b3IuanMiLCIuLi8uLi9zcmMvY3Vyc29ycy5qcyIsIi4uLy4uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICAgIFRoaXMgZGVjb3JhdGVzIGFuIG9iamVjdC9wcm90b3R5cGUgd2l0aCBiYXNpYyAoc3luY2hyb25vdXMpIGNhbGxiYWNrIHN1cHBvcnQuXG4qL1xuXG5jb25zdCBQUkVGSVggPSBcIl9fY2FsbGJhY2tcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2Uob2JqZWN0KSB7XG4gICAgb2JqZWN0W2Ake1BSRUZJWH1faGFuZGxlcnNgXSA9IFtdO1xufVxuXG5mdW5jdGlvbiBhZGRfY2FsbGJhY2sgKGhhbmRsZXIpIHtcbiAgICBsZXQgaGFuZGxlID0ge1xuICAgICAgICBoYW5kbGVyOiBoYW5kbGVyXG4gICAgfVxuICAgIHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLnB1c2goaGFuZGxlKTtcbiAgICByZXR1cm4gaGFuZGxlO1xufTtcblxuZnVuY3Rpb24gcmVtb3ZlX2NhbGxiYWNrIChoYW5kbGUpIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5pbmRleG9mKGhhbmRsZSk7XG4gICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBub3RpZnlfY2FsbGJhY2tzIChlQXJnKSB7XG4gICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uZm9yRWFjaChmdW5jdGlvbihoYW5kbGUpIHtcbiAgICAgICAgaGFuZGxlLmhhbmRsZXIoZUFyZyk7XG4gICAgfSk7XG59O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgYWRkX2NhbGxiYWNrLCByZW1vdmVfY2FsbGJhY2ssIG5vdGlmeV9jYWxsYmFja3NcbiAgICB9XG4gICAgT2JqZWN0LmFzc2lnbihfcHJvdG90eXBlLCBhcGkpO1xufVxuXG5cbiIsImltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL2FwaV9jYWxsYmFjay5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTVEFURSBQUk9WSURFUiBCQVNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIEJhc2UgY2xhc3MgZm9yIFN0YXRlUHJvdmlkZXJzXG5cbiAgICAtIGNvbGxlY3Rpb24gb2YgaXRlbXNcbiAgICAtIHtrZXksIGl0diwgdHlwZSwgZGF0YX1cbiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0ZVByb3ZpZGVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiB1cGRhdGUgZnVuY3Rpb25cbiAgICAgKiBcbiAgICAgKiBJZiBJdGVtc1Byb3ZpZGVyIGlzIGEgcHJveHkgdG8gYW4gb25saW5lXG4gICAgICogSXRlbXMgY29sbGVjdGlvbiwgdXBkYXRlIHJlcXVlc3RzIHdpbGwgXG4gICAgICogaW1wbHkgYSBuZXR3b3JrIHJlcXVlc3RcbiAgICAgKiBcbiAgICAgKiBvcHRpb25zIC0gc3VwcG9ydCByZXNldCBmbGFnIFxuICAgICAqL1xuICAgIHVwZGF0ZShpdGVtcywgb3B0aW9ucz17fSl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZXR1cm4gYXJyYXkgd2l0aCBhbGwgaXRlbXMgaW4gY29sbGVjdGlvbiBcbiAgICAgKiAtIG5vIHJlcXVpcmVtZW50IHdydCBvcmRlclxuICAgICAqL1xuXG4gICAgZ2V0X2l0ZW1zKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc2lnbmFsIGlmIGl0ZW1zIGNhbiBiZSBvdmVybGFwcGluZyBvciBub3RcbiAgICAgKi9cblxuICAgIGdldCBpbmZvICgpIHtcbiAgICAgICAgcmV0dXJuIHtvdmVybGFwcGluZzogdHJ1ZX07XG4gICAgfVxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoU3RhdGVQcm92aWRlckJhc2UucHJvdG90eXBlKTtcblxuXG5cblxuIiwiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gICAgKiBcbiAgICAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAgICAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICAgICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gICAgKiBcbiAgICAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICAgICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAgICAqIFxuICAgICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG5cbiovXG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuXG5cbiAgICBOT1RFIFxuICAgIC0gY21wKDRdLFs0ICkgPT0gMCAtIHNpbmNlIHRoZXNlIGFyZSB0aGUgc2FtZSB3aXRoIHJlc3BlY3QgdG8gc29ydGluZ1xuICAgIC0gYnV0IGlmIHlvdSB3YW50IHRvIHNlZSBpZiB0d28gaW50ZXJ2YWxzIGFyZSBvdmVybGFwcGluZyBpbiB0aGUgZW5kcG9pbnRzXG4gICAgY21wKGhpZ2hfYSwgbG93X2IpID4gMCB0aGlzIHdpbGwgbm90IGJlIGdvb2RcbiAgICBcbiovIFxuXG5cbmZ1bmN0aW9uIGNtcE51bWJlcnMoYSwgYikge1xuICAgIGlmIChhID09PSBiKSByZXR1cm4gMDtcbiAgICBpZiAoYSA9PT0gSW5maW5pdHkpIHJldHVybiAxO1xuICAgIGlmIChiID09PSBJbmZpbml0eSkgcmV0dXJuIC0xO1xuICAgIGlmIChhID09PSAtSW5maW5pdHkpIHJldHVybiAtMTtcbiAgICBpZiAoYiA9PT0gLUluZmluaXR5KSByZXR1cm4gMTtcbiAgICByZXR1cm4gYSAtIGI7XG4gIH1cblxuZnVuY3Rpb24gZW5kcG9pbnRfY21wIChwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICBsZXQgZGlmZiA9IGNtcE51bWJlcnModjEsIHYyKTtcbiAgICByZXR1cm4gKGRpZmYgIT0gMCkgPyBkaWZmIDogczEgLSBzMjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludCB0byB0aGUgb3RoZXIgc2lkZVxuICogXG4gKiB1c2VmdWwgZm9yIG1ha2luZyBiYWNrLXRvLWJhY2sgaW50ZXJ2YWxzIFxuICogXG4gKiBoaWdoKSA8LT4gW2xvd1xuICogaGlnaF0gPC0+IChsb3dcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKHAsIHRhcmdldCkge1xuICAgIGxldCBbdixzXSA9IHA7XG4gICAgaWYgKCFpc0Zpbml0ZSh2KSkge1xuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgaWYgKHRhcmdldCA9PSBcImxvd1wiKSB7XG4gICAgXHQvLyBhc3N1bWUgcG9pbnQgaXMgaGlnaDogc2lnbiBtdXN0IGJlIC0xIG9yIDBcbiAgICBcdGlmIChzID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBsb3dcIik7ICAgIFx0XHRcbiAgICBcdH1cbiAgICAgICAgcCA9IFt2LCBzKzFdO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09IFwiaGlnaFwiKSB7XG5cdFx0Ly8gYXNzdW1lIHBvaW50IGlzIGxvdzogc2lnbiBpcyAwIG9yIDFcbiAgICBcdGlmIChzIDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBoaWdoXCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcy0xXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0eXBlXCIsIHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBsZXQgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBsZXQgbG93X3AgPSAobG93Q2xvc2VkKSA/IFtsb3csIDBdIDogW2xvdywgMV07IFxuICAgIGxldCBoaWdoX3AgPSAoaGlnaENsb3NlZCkgPyBbaGlnaCwgMF0gOiBbaGlnaCwgLTFdO1xuICAgIHJldHVybiBbbG93X3AsIGhpZ2hfcF07XG59XG5cblxuLypcbiAgICBJTlRFUlZBTFNcblxuICAgIEludGVydmFscyBhcmUgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXVxuXG4qLyBcblxuLypcbiAgICByZXR1cm4gdHJ1ZSBpZiBwb2ludCBwIGlzIGNvdmVyZWQgYnkgaW50ZXJ2YWwgaXR2XG4gICAgcG9pbnQgcCBjYW4gYmUgbnVtYmVyIHAgb3IgYSBwb2ludCBbcCxzXVxuXG4gICAgaW1wbGVtZW50ZWQgYnkgY29tcGFyaW5nIHBvaW50c1xuICAgIGV4Y2VwdGlvbiBpZiBpbnRlcnZhbCBpcyBub3QgZGVmaW5lZFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIHApIHtcbiAgICBsZXQgW2xvd19wLCBoaWdoX3BdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAvLyBjb3ZlcnM6IGxvdyA8PSBwIDw9IGhpZ2hcbiAgICByZXR1cm4gZW5kcG9pbnRfbGUobG93X3AsIHApICYmIGVuZHBvaW50X2xlKHAsIGhpZ2hfcCk7XG59XG4vLyBjb252ZW5pZW5jZVxuZnVuY3Rpb24gaW50ZXJ2YWxfY292ZXJzX3BvaW50KGl0diwgcCkge1xuICAgIHJldHVybiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBbcCwgMF0pO1xufVxuXG5cblxuLypcbiAgICBSZXR1cm4gdHJ1ZSBpZiBpbnRlcnZhbCBoYXMgbGVuZ3RoIDBcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9pc19zaW5ndWxhcihpbnRlcnZhbCkge1xuICAgIHJldHVybiBpbnRlcnZhbFswXSA9PSBpbnRlcnZhbFsxXVxufVxuXG4vKlxuICAgIENyZWF0ZSBpbnRlcnZhbCBmcm9tIGVuZHBvaW50c1xuKi9cbmZ1bmN0aW9uIGludGVydmFsX2Zyb21fZW5kcG9pbnRzKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIC8vIHAxIG11c3QgYmUgYSBsb3cgcG9pbnRcbiAgICBpZiAoczEgPT0gLTEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBsb3cgcG9pbnRcIiwgcDEpO1xuICAgIH1cbiAgICBpZiAoczIgPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2VhbCBoaWdoIHBvaW50XCIsIHAyKTsgICBcbiAgICB9XG4gICAgcmV0dXJuIFt2MSwgdjIsIChzMT09MCksIChzMj09MCldXG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKG4pIHtcbiAgICByZXR1cm4gdHlwZW9mIG4gPT0gXCJudW1iZXJcIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGludGVydmFsX2Zyb21faW5wdXQoaW5wdXQpe1xuICAgIGxldCBpdHYgPSBpbnB1dDtcbiAgICBpZiAoaXR2ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnB1dCBpcyB1bmRlZmluZWRcIik7XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShpdHYpKSB7XG4gICAgICAgIGlmIChpc051bWJlcihpdHYpKSB7XG4gICAgICAgICAgICAvLyBpbnB1dCBpcyBzaW5ndWxhciBudW1iZXJcbiAgICAgICAgICAgIGl0diA9IFtpdHYsIGl0diwgdHJ1ZSwgdHJ1ZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlucHV0OiAke2lucHV0fTogbXVzdCBiZSBBcnJheSBvciBOdW1iZXJgKVxuICAgICAgICB9XG4gICAgfTtcbiAgICAvLyBtYWtlIHN1cmUgaW50ZXJ2YWwgaXMgbGVuZ3RoIDRcbiAgICBpZiAoaXR2Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGl0diA9IFtpdHZbMF0sIGl0dlswXSwgdHJ1ZSwgdHJ1ZV1cbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMikge1xuICAgICAgICBpdHYgPSBpdHYuY29uY2F0KFt0cnVlLCBmYWxzZV0pO1xuICAgIH0gZWxzZSBpZiAoaXR2Lmxlbmd0aCA9PSAzKSB7XG4gICAgICAgIGl0diA9IGl0di5wdXNoKGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPiA0KSB7XG4gICAgICAgIGl0diA9IGl0di5zbGljZSgwLDQpO1xuICAgIH1cbiAgICBsZXQgW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdID0gaXR2O1xuICAgIC8vIHVuZGVmaW5lZFxuICAgIGlmIChsb3cgPT0gdW5kZWZpbmVkIHx8IGxvdyA9PSBudWxsKSB7XG4gICAgICAgIGxvdyA9IC1JbmZpbml0eTtcbiAgICB9XG4gICAgaWYgKGhpZ2ggPT0gdW5kZWZpbmVkIHx8IGhpZ2ggPT0gbnVsbCkge1xuICAgICAgICBoaWdoID0gSW5maW5pdHk7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93IGFuZCBoaWdoIGFyZSBudW1iZXJzXG4gICAgaWYgKCFpc051bWJlcihsb3cpKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgbm90IGEgbnVtYmVyXCIsIGxvdyk7XG4gICAgaWYgKCFpc051bWJlcihoaWdoKSkgdGhyb3cgbmV3IEVycm9yKFwiaGlnaCBub3QgYSBudW1iZXJcIiwgaGlnaCk7XG4gICAgLy8gY2hlY2sgdGhhdCBsb3cgPD0gaGlnaFxuICAgIGlmIChsb3cgPiBoaWdoKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgPiBoaWdoXCIsIGxvdywgaGlnaCk7XG4gICAgLy8gc2luZ2xldG9uXG4gICAgaWYgKGxvdyA9PSBoaWdoKSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIGluZmluaXR5IHZhbHVlc1xuICAgIGlmIChsb3cgPT0gLUluZmluaXR5KSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoaGlnaCA9PSBJbmZpbml0eSkge1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGUgYXJlIGJvb2xlYW5zXG4gICAgaWYgKHR5cGVvZiBsb3dJbmNsdWRlICE9PSBcImJvb2xlYW5cIikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJsb3dJbmNsdWRlIG5vdCBib29sZWFuXCIpO1xuICAgIH0gXG4gICAgaWYgKHR5cGVvZiBoaWdoSW5jbHVkZSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaGlnaEluY2x1ZGUgbm90IGJvb2xlYW5cIik7XG4gICAgfVxuICAgIHJldHVybiBbbG93LCBoaWdoLCBsb3dJbmNsdWRlLCBoaWdoSW5jbHVkZV07XG59XG5cblxuXG5cbmV4cG9ydCBjb25zdCBlbmRwb2ludCA9IHtcbiAgICBsZTogZW5kcG9pbnRfbGUsXG4gICAgbHQ6IGVuZHBvaW50X2x0LFxuICAgIGdlOiBlbmRwb2ludF9nZSxcbiAgICBndDogZW5kcG9pbnRfZ3QsXG4gICAgY21wOiBlbmRwb2ludF9jbXAsXG4gICAgZXE6IGVuZHBvaW50X2VxLFxuICAgIG1pbjogZW5kcG9pbnRfbWluLFxuICAgIG1heDogZW5kcG9pbnRfbWF4LFxuICAgIGZsaXA6IGVuZHBvaW50X2ZsaXAsXG4gICAgZnJvbV9pbnRlcnZhbDogZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWxcbn1cbmV4cG9ydCBjb25zdCBpbnRlcnZhbCA9IHtcbiAgICBjb3ZlcnNfZW5kcG9pbnQ6IGludGVydmFsX2NvdmVyc19lbmRwb2ludCxcbiAgICBjb3ZlcnNfcG9pbnQ6IGludGVydmFsX2NvdmVyc19wb2ludCwgXG4gICAgaXNfc2luZ3VsYXI6IGludGVydmFsX2lzX3Npbmd1bGFyLFxuICAgIGZyb21fZW5kcG9pbnRzOiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyxcbiAgICBmcm9tX2lucHV0OiBpbnRlcnZhbF9mcm9tX2lucHV0XG59XG4iLCJpbXBvcnQgeyBTdGF0ZVByb3ZpZGVyQmFzZSB9IGZyb20gXCIuL3N0YXRlcHJvdmlkZXJfYmFzZXMuanNcIjtcbmltcG9ydCB7IGVuZHBvaW50LCBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTE9DQUwgU1RBVEUgUFJPVklERVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMb2NhbCBBcnJheSB3aXRoIG5vbi1vdmVybGFwcGluZyBpdGVtcy5cbiAqL1xuXG5leHBvcnQgY2xhc3MgTG9jYWxTdGF0ZVByb3ZpZGVyIGV4dGVuZHMgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvLyBpbml0aWFsaXphdGlvblxuICAgICAgICBsZXQge2l0ZW1zLCB2YWx1ZX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoaXRlbXMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBpbml0aWFsaXplIGZyb20gaXRlbXNcbiAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gY2hlY2tfaW5wdXQoaXRlbXMpO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gaW5pdGlhbGl6ZSBmcm9tIHZhbHVlXG4gICAgICAgICAgICB0aGlzLl9pdGVtcyA9IFt7XG4gICAgICAgICAgICAgICAgaXR2OlstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSwgXG4gICAgICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgICAgICBkYXRhOnZhbHVlXG4gICAgICAgICAgICB9XTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGUgKGl0ZW1zLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gY2hlY2tfaW5wdXQoaXRlbXMpO1xuICAgICAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ2V0X2l0ZW1zICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2l0ZW1zLnNsaWNlKCk7XG4gICAgfVxuXG4gICAgZ2V0IGluZm8gKCkge1xuICAgICAgICByZXR1cm4ge292ZXJsYXBwaW5nOiBmYWxzZX07XG4gICAgfVxufVxuXG5cbmZ1bmN0aW9uIGNoZWNrX2lucHV0KGl0ZW1zKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnB1dCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgIH1cbiAgICAvLyBtYWtlIHN1cmUgdGhhdCBpbnRlcnZhbHMgYXJlIHdlbGwgZm9ybWVkXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICAgIGl0ZW0uaXR2ID0gaW50ZXJ2YWwuZnJvbV9pbnB1dChpdGVtLml0dik7XG4gICAgfVxuICAgIC8vIHNvcnQgaXRlbXMgYmFzZWQgb24gaW50ZXJ2YWwgbG93IGVuZHBvaW50XG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBsZXQgYV9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGEuaXR2KVswXTtcbiAgICAgICAgbGV0IGJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChiLml0dilbMF07XG4gICAgICAgIHJldHVybiBlbmRwb2ludC5jbXAoYV9sb3csIGJfbG93KTtcbiAgICB9KTtcbiAgICAvLyBjaGVjayB0aGF0IGl0ZW0gaW50ZXJ2YWxzIGFyZSBub24tb3ZlcmxhcHBpbmdcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBwcmV2X2hpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2kgLSAxXS5pdHYpWzFdO1xuICAgICAgICBsZXQgY3Vycl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2ldLml0dilbMF07XG4gICAgICAgIC8vIHZlcmlmeSB0aGF0IHByZXYgaGlnaCBpcyBsZXNzIHRoYXQgY3VyciBsb3dcbiAgICAgICAgaWYgKCFlbmRwb2ludC5sdChwcmV2X2hpZ2gsIGN1cnJfbG93KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT3ZlcmxhcHBpbmcgaW50ZXJ2YWxzIGZvdW5kXCIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuXG5cblxuIiwiaW1wb3J0IHsgZW5kcG9pbnQsIGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBORUFSQlkgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBBYnN0cmFjdCBzdXBlcmNsYXNzIGZvciBOZWFyYnlJbmRleGUuXG4gKiBcbiAqIFN1cGVyY2xhc3MgdXNlZCB0byBjaGVjayB0aGF0IGEgY2xhc3MgaW1wbGVtZW50cyB0aGUgbmVhcmJ5KCkgbWV0aG9kLCBcbiAqIGFuZCBwcm92aWRlIHNvbWUgY29udmVuaWVuY2UgbWV0aG9kcy5cbiAqIFxuICogTkVBUkJZIElOREVYXG4gKiBcbiAqIE5lYXJieUluZGV4IHByb3ZpZGVzIGluZGV4aW5nIHN1cHBvcnQgb2YgZWZmZWN0aXZlbHlsb29raW5nIHVwIElURU1TIGJ5IG9mZnNldCwgXG4gKiBnaXZlbiB0aGF0XG4gKiAoaSkgZWFjaCBlbnRyaXkgaXMgYXNzb2NpYXRlZCB3aXRoIGFuIGludGVydmFsIGFuZCxcbiAqIChpaSkgZW50cmllcyBhcmUgbm9uLW92ZXJsYXBwaW5nLlxuICogRWFjaCBJVEVNIG11c3QgYmUgYXNzb2NpYXRlZCB3aXRoIGFuIGludGVydmFsIG9uIHRoZSB0aW1lbGluZSBcbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgYXJvdW5kIGVuZHBvaW50LiBcbiAqIFxuICogUHJpbWFyeSB1c2UgaXMgZm9yIGl0ZXJhdGlvbiBcbiAqIFxuICogUmV0dXJucyB7XG4gKiAgICAgIGNlbnRlcjogbGlzdCBvZiBJVEVNUy9MQVlFUlMgY292ZXJpbmcgZW5kcG9pbnQsXG4gKiAgICAgIGl0djogaW50ZXJ2YWwgd2hlcmUgbmVhcmJ5IHJldHVybnMgaWRlbnRpY2FsIHtjZW50ZXJ9XG4gKiAgICAgIGxlZnQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgbGVmdCBcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGhpZ2gtZW5kcG9pbnQgb3IgWy1JbmZpbml0eSwgMF1cbiAqICAgICAgcmlnaHQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgcmlnaHRcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGxvdy1lbmRwb2ludCBvciBbSW5maW5pdHksIDBdICAgIFxuICogICAgICBwcmV2OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIGxlZnQgXG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50ICYmIG5vbi1lbXB0eSB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgaGlnaC1lbmRwb2ludCBvciBbLUluZmluaXR5LCAwXSBpZiBubyBtb3JlIGludGVydmFscyB0byB0aGUgbGVmdFxuICogICAgICBuZXh0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0XG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50ICYmIG5vbi1lbXB0eSB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgbG93LWVuZHBvaW50IG9yIFtJbmZpbml0eSwgMF0gaWYgbm8gbW9yZSBpbnRlcnZhbHMgdG8gdGhlIHJpZ2h0XG4gKiB9XG4gKiBcbiAqIFxuICogVGhlIG5lYXJieSBzdGF0ZSBpcyB3ZWxsLWRlZmluZWQgZm9yIGV2ZXJ5IHRpbWVsaW5lIHBvc2l0aW9uLlxuICogXG4gKiBcbiAqIE5PVEUgbGVmdC9yaWdodCBhbmQgcHJldi9uZXh0IGFyZSBtb3N0bHkgdGhlIHNhbWUuIFRoZSBvbmx5IGRpZmZlcmVuY2UgaXMgXG4gKiB0aGF0IHByZXYvbmV4dCB3aWxsIHNraXAgb3ZlciByZWdpb25zIHdoZXJlIHRoZXJlIGFyZSBubyBpbnRlcnZhbHMuIFRoaXNcbiAqIGVuc3VyZXMgcHJhY3RpY2FsIGl0ZXJhdGlvbiBvZiBpdGVtcyBhcyBwcmV2L25leHQgd2lsbCBvbmx5IGJlIHVuZGVmaW5lZCAgXG4gKiBhdCB0aGUgZW5kIG9mIGl0ZXJhdGlvbi5cbiAqIFxuICogSU5URVJWQUxTXG4gKiBcbiAqIFtsb3csIGhpZ2gsIGxvd0luY2x1c2l2ZSwgaGlnaEluY2x1c2l2ZV1cbiAqIFxuICogVGhpcyByZXByZXNlbnRhdGlvbiBlbnN1cmVzIHRoYXQgdGhlIGludGVydmFsIGVuZHBvaW50cyBhcmUgb3JkZXJlZCBhbmQgYWxsb3dzXG4gKiBpbnRlcnZhbHMgdG8gYmUgZXhjbHVzaXZlIG9yIGluY2x1c2l2ZSwgeWV0IGNvdmVyIHRoZSBlbnRpcmUgcmVhbCBsaW5lIFxuICogXG4gKiBbYSxiXSwgKGEsYiksIFthLGIpLCBbYSwgYikgYXJlIGFsbCB2YWxpZCBpbnRlcnZhbHNcbiAqIFxuICogXG4gKiBJTlRFUlZBTCBFTkRQT0lOVFNcbiAqIFxuICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gKiBcbiAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gKiBcbiAqIC8gKi9cblxuXG4vKipcbiAqIHJldHVybiBmaXJzdCBoaWdoIGVuZHBvaW50IG9uIHRoZSBsZWZ0IGZyb20gbmVhcmJ5LFxuICogd2hpY2ggaXMgbm90IGluIGNlbnRlclxuICovXG5leHBvcnQgZnVuY3Rpb24gbGVmdF9lbmRwb2ludCAobmVhcmJ5KSB7XG4gICAgY29uc3QgbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChuZWFyYnkuaXR2KVswXTtcbiAgICByZXR1cm4gZW5kcG9pbnQuZmxpcChsb3csIFwiaGlnaFwiKTtcbn1cblxuLyoqXG4gKiByZXR1cm4gZmlyc3QgbG93IGVuZHBvaW50IG9uIHRoZSByaWdodCBmcm9tIG5lYXJieSxcbiAqIHdoaWNoIGlzIG5vdCBpbiBjZW50ZXJcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gcmlnaHRfZW5kcG9pbnQgKG5lYXJieSkge1xuICAgIGNvbnN0IGhpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5lYXJieS5pdHYpWzFdO1xuICAgIHJldHVybiBlbmRwb2ludC5mbGlwKGhpZ2gsIFwibG93XCIpO1xufVxuXG5cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4QmFzZSB7XG5cblxuICAgIC8qIFxuICAgICAgICBOZWFyYnkgbWV0aG9kXG4gICAgKi9cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICBjaGVjayhvZmZzZXQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvZmZzZXQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBbb2Zmc2V0LCAwXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkob2Zmc2V0KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW5kcG9pbnQgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb2Zmc2V0O1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHJldHVybiBsb3cgcG9pbnQgb2YgbGVmdG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGZpcnN0KCkge1xuICAgICAgICBsZXQge2NlbnRlciwgcmlnaHR9ID0gdGhpcy5uZWFyYnkoWy1JbmZpbml0eSwgMF0pO1xuICAgICAgICByZXR1cm4gKGNlbnRlci5sZW5ndGggPiAwKSA/IFstSW5maW5pdHksIDBdIDogcmlnaHQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGhpZ2ggcG9pbnQgb2YgcmlnaHRtb3N0IGVudHJ5XG4gICAgKi9cbiAgICBsYXN0KCkge1xuICAgICAgICBsZXQge2xlZnQsIGNlbnRlcn0gPSB0aGlzLm5lYXJieShbSW5maW5pdHksIDBdKTtcbiAgICAgICAgcmV0dXJuIChjZW50ZXIubGVuZ3RoID4gMCkgPyBbSW5maW5pdHksIDBdIDogbGVmdFxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIG5lYXJieSBvZiBmaXJzdCByZWdpb24gdG8gdGhlIHJpZ2h0XG4gICAgICogd2hpY2ggaXMgbm90IHRoZSBjZW50ZXIgcmVnaW9uLiBJZiBub3QgZXhpc3RzLCByZXR1cm5cbiAgICAgKiB1bmRlZmluZWQuIFxuICAgICAqL1xuICAgIHJpZ2h0X3JlZ2lvbihuZWFyYnkpIHtcbiAgICAgICAgY29uc3QgcmlnaHQgPSByaWdodF9lbmRwb2ludChuZWFyYnkpO1xuICAgICAgICBpZiAocmlnaHRbMF0gPT0gSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubmVhcmJ5KHJpZ2h0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZXR1cm4gbmVhcmJ5IG9mIGZpcnN0IG5vbi1lbXB0eSByZWdpb24gdG8gdGhlIHJpZ2h0XG4gICAgICogd2hpY2ggaXMgbm90IHRoZSBjZW50ZXIgcmVnaW9uLiBJZiBub3QgZXhpc3RzLCByZXR1cm5cbiAgICAgKiB1bmRlZmluZWQuIFxuICAgICAqL1xuICAgIG5leHRfcmVnaW9uKG5lYXJieSkge1xuICAgICAgICBjb25zdCBuZXh0X25lYXJieSA9IHRoaXMucmlnaHRfcmVnaW9uKG5lYXJieSk7XG4gICAgICAgIGlmIChuZXh0X25lYXJieSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5leHRfbmVhcmJ5LmNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBjZW50ZXIgbm9uLWVtcHR5IFxuICAgICAgICAgICAgcmV0dXJuIG5leHRfbmVhcmJ5O1xuICAgICAgICB9XG4gICAgICAgIC8vIGNlbnRlciBlbXB0eVxuICAgICAgICAvLyBmaW5kIGZpcnN0IG5vbi1lbXB0eSByZWdpb24gdG8gdGhlIHJpZ2h0IChyZWN1cnNpdmVseSlcbiAgICAgICAgcmV0dXJuIHRoaXMubmV4dF9yZWdpb24obmV4dF9uZWFyYnkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJldHVybiBuZWFyYnkgb2YgZmlyc3QgcmVnaW9uIHRvIHRoZSBsZWZ0XG4gICAgICogd2hpY2ggaXMgbm90IHRoZSBjZW50ZXIgcmVnaW9uLiBJZiBub3QgZXhpc3RzLCByZXR1cm5cbiAgICAgKiB1bmRlZmluZWQuIFxuICAgICAqL1xuICAgIGxlZnRfcmVnaW9uKG5lYXJieSkge1xuICAgICAgICBjb25zdCBsZWZ0ID0gbGVmdF9lbmRwb2ludChuZWFyYnkpO1xuICAgICAgICBpZiAobGVmdFswXSA9PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubmVhcmJ5KGxlZnQpOyAgICBcbiAgICB9XG5cbiAgICAvKiogXG4gICAgICogcmV0dXJuIG5lYXJieSBvZiBmaXJzdCBub24tZW1wdHkgcmVnaW9uIHRvIHRoZSBsZWZ0XG4gICAgICogd2hpY2ggaXMgbm90IHRoZSBjZW50ZXIgcmVnaW9uLiBJZiBub3QgZXhpc3RzLCByZXR1cm5cbiAgICAgKiB1bmRlZmluZWQuIFxuICAgICovXG4gICAgcHJldl9yZWdpb24obmVhcmJ5KSB7XG4gICAgICAgIGNvbnN0IG5leHRfbmVhcmJ5ID0gdGhpcy5sZWZ0X3JlZ2lvbihuZWFyYnkpO1xuICAgICAgICBpZiAobmV4dF9uZWFyYnkgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChuZXh0X25lYXJieS5jZW50ZXIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgLy8gY2VudGVyIG5vbi1lbXB0eSBcbiAgICAgICAgICAgIHJldHVybiBuZXh0X25lYXJieTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjZW50ZXIgZW1wdHlcbiAgICAgICAgLy8gZmluZCBmaXJzdCBub24tZW1wdHkgcmVnaW9uIHRvIHRoZSBsZWZ0IChyZWN1cnNpdmVseSlcbiAgICAgICAgcmV0dXJuIHRoaXMucHJldl9yZWdpb24obmV4dF9uZWFyYnkpO1xuICAgIH1cblxuICAgIHJlZ2lvbnMob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gbmV3IFJlZ2lvbkl0ZXJhdG9yKHRoaXMsIG9wdGlvbnMpO1xuICAgIH1cblxufVxuXG5cbi8qXG4gICAgSXRlcmF0ZSByZWdpb25zIG9mIGluZGV4IGZyb20gbGVmdCB0byByaWdodFxuXG4gICAgSXRlcmF0aW9uIGxpbWl0ZWQgdG8gaW50ZXJ2YWwgW3N0YXJ0LCBzdG9wXSBvbiB0aGUgdGltZWxpbmUuXG4gICAgUmV0dXJucyBsaXN0IG9mIGl0ZW0tbGlzdHMuXG4gICAgb3B0aW9uc1xuICAgIC0gc3RhcnRcbiAgICAtIHN0b3BcbiAgICAtIGluY2x1ZGVFbXB0eVxuKi9cblxuY2xhc3MgUmVnaW9uSXRlcmF0b3Ige1xuXG4gICAgY29uc3RydWN0b3IoaW5kZXgsIG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtcbiAgICAgICAgICAgIHN0YXJ0PS1JbmZpbml0eSwgXG4gICAgICAgICAgICBzdG9wPUluZmluaXR5LCBcbiAgICAgICAgICAgIGluY2x1ZGVFbXB0eT10cnVlXG4gICAgICAgIH0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3RhcnQgPiBzdG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgKFwic3RvcCBtdXN0IGJlIGxhcmdlciB0aGFuIHN0YXJ0XCIsIHN0YXJ0LCBzdG9wKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gICAgICAgIHRoaXMuX3N0YXJ0ID0gW3N0YXJ0LCAwXTtcbiAgICAgICAgdGhpcy5fc3RvcCA9IFtzdG9wLCAwXTtcbiAgICAgICAgdGhpcy5faW5jbHVkZUVtcHR5ID0gaW5jbHVkZUVtcHR5OyAgICAgICAgXG4gICAgICAgIHRoaXMuX2N1cnJlbnQ7XG4gICAgICAgIHRoaXMuX2RvbmUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBuZXh0KCkge1xuICAgICAgICBsZXQgY3VycmVudDtcbiAgICAgICAgaWYgKHRoaXMuX2RvbmUpIHtcbiAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dW5kZWZpbmVkLCBkb25lOnRydWV9O1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gaW5pdGlhbGlzZVxuICAgICAgICAgICAgdGhpcy5fY3VycmVudCA9IHRoaXMuX2luZGV4Lm5lYXJieSh0aGlzLl9zdGFydCk7XG4gICAgICAgIH0gXG4gICAgICAgIC8qIFxuICAgICAgICAgICAgbmVlZCBtdWx0aXBsZSBwYXNzZXMgdG8gc2tpcCBvdmVyXG4gICAgICAgICAgICBlbXB0eSByZWdpb25zIHdpdGhpbiB0aGlzIG5leHQgaW52b2NhdGlvblxuICAgICAgICAqL1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgY3VycmVudCA9IHRoaXMuX2N1cnJlbnQ7XG5cbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHN0b3AgPCByZWdpb24ubG93XG4gICAgICAgICAgICBsZXQgbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChjdXJyZW50Lml0dilbMF0gXG4gICAgICAgICAgICBpZiAoZW5kcG9pbnQuZ3QobG93LCB0aGlzLl9zdG9wKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dW5kZWZpbmVkLCBkb25lOnRydWV9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBpc19sYXN0ID0gY3VycmVudC5pdHZbMV0gPT0gSW5maW5pdHk7XG5cbiAgICAgICAgICAgIC8qIFxuICAgICAgICAgICAgICAgIGNoZWNrIGlmIHdlIG5lZWQgdG8gc2tpcCB0byBuZXh0IHdpdGhpbiBcbiAgICAgICAgICAgICAgICB0aGlzIG5leHQgaW52b2NhdGlvblxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGNvbnN0IHNraXBfZW1wdHkgPSAoXG4gICAgICAgICAgICAgICAgaXNfbGFzdCA9PSBmYWxzZSAmJlxuICAgICAgICAgICAgICAgIHRoaXMuX2luY2x1ZGVFbXB0eSA9PSBmYWxzZSAmJlxuICAgICAgICAgICAgICAgIGN1cnJlbnQuY2VudGVyLmxlbmd0aCA9PSAwXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKHNraXBfZW1wdHkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jdXJyZW50ID0gdGhpcy5faW5kZXgucmlnaHRfcmVnaW9uKGN1cnJlbnQpO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge3ZhbHVlOnVuZGVmaW5lZCwgZG9uZTp0cnVlfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGlzX2xhc3QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9kb25lID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IGN1cnJlbnRcbiAgICAgICAgICAgICAgICB0aGlzLl9jdXJyZW50ID0gdGhpcy5faW5kZXgucmlnaHRfcmVnaW9uKGN1cnJlbnQpO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kb25lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4ge3ZhbHVlOmN1cnJlbnQsIGRvbmU6ZmFsc2V9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEJPT0xFQU4gTkVBUkJZIElOREVYXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogV3JhcHBlciBJbmRleCB3aGVyZSByZWdpb25zIGFyZSB0cnVlL2ZhbHNlLCBiYXNlZCBvbiBcbiAqIG9uIHdoZXRoZXIgdGhlIHNvdXJjZSBpbmRleCBpcyBkZWZpbmVkIG9yIG5vdC5cbiAqIEJhY2stdG8tYmFjayByZWdpb25zIHdoaWNoIGFyZSBkZWZpbmVkIFxuICogYXJlIGNvbGxhcHNlZCBpbnRvIG9uZSByZWdpb25cbiAqIFxuICogQm9vbGVhbiBJbmRleCBpcyBzdGF0ZWxlc3MuXG4gKiBcbiAqL1xuXG5mdW5jdGlvbiBxdWVyeU9iamVjdCAodmFsdWUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBxdWVyeTogZnVuY3Rpb24gKG9mZnNldCkge1xuICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZSwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIEJvb2xlYW5JbmRleCBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3Rvcihzb3VyY2UpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5faW5kZXggPSBzb3VyY2U7XG4gICAgICAgIHRoaXMuX3RydWVPYmplY3QgPSBxdWVyeU9iamVjdCh0cnVlKTtcbiAgICAgICAgdGhpcy5fZmFsc2VPYmplY3QgPSBxdWVyeU9iamVjdChmYWxzZSk7XG4gICAgfVxuXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBvZmZzZXQgPSB0aGlzLmNoZWNrKG9mZnNldCk7XG4gICAgICAgIGNvbnN0IG5lYXJieSA9IHRoaXMuX2luZGV4Lm5lYXJieShvZmZzZXQpO1xuXG4gICAgICAgIC8vIGxlZnQsIHJpZ2h0IGlzIHVuY2hhbmdlZCBpZiBjZW50ZXIgaXMgZW1wdHlcbiAgICAgICAgaWYgKG5lYXJieS5jZW50ZXIubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIG5lYXJieS5jZW50ZXIgPSBbdGhpcy5fZmFsc2VPYmplY3RdO1xuICAgICAgICAgICAgcmV0dXJuIG5lYXJieTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNlZWsgbGVmdCBhbmQgcmlnaHQgZm9yIG5leHQgZ2FwIC0gZXhwYW5kIHJlZ2lvblxuICAgICAgICBsZXQgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5lYXJieS5pdHYpXG4gICAgICAgIGxldCBjdXJyZW50X25lYXJieTtcblxuICAgICAgICAvLyBzZWVrIHJpZ2h0XG4gICAgICAgIGN1cnJlbnRfbmVhcmJ5ID0gbmVhcmJ5O1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgLy8gcmVnaW9uIG9uIHRoZSByaWdodFxuICAgICAgICAgICAgY29uc3QgbmV4dF9uZWFyYnkgPSB0aGlzLl9pbmRleC5uZWFyYnkoY3VycmVudF9uZWFyYnkucmlnaHQpO1xuICAgICAgICAgICAgaWYgKG5leHRfbmVhcmJ5LmNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gZXhwYW5kIHJlZ2lvblxuICAgICAgICAgICAgICAgIGhpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5leHRfbmVhcmJ5Lml0dilbMV07XG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgaWYgdGhpcyBpcyBsYXN0IHJlZ2lvblxuICAgICAgICAgICAgICAgIGlmIChuZXh0X25lYXJieS5yaWdodFswXSA9PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb250aW51ZVxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50X25lYXJieSA9IG5leHRfbmVhcmJ5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gZm91bmQgZ2FwXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZWVrIGxlZnRcbiAgICAgICAgY3VycmVudF9uZWFyYnkgPSBuZWFyYnk7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICAvLyByZWdpb24gb24gdGhlIGxlZnRcbiAgICAgICAgICAgIGNvbnN0IG5leHRfbmVhcmJ5ID0gdGhpcy5faW5kZXgubmVhcmJ5KGN1cnJlbnRfbmVhcmJ5LmxlZnQpO1xuICAgICAgICAgICAgaWYgKG5leHRfbmVhcmJ5LmNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gZXhwYW5kIHJlZ2lvblxuICAgICAgICAgICAgICAgIGxvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmV4dF9uZWFyYnkuaXR2KVswXTtcbiAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiB0aGlzIGlzIGxhc3QgcmVnaW9uXG4gICAgICAgICAgICAgICAgaWYgKG5leHRfbmVhcmJ5LmxlZnRbMF0gPT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRfbmVhcmJ5ID0gbmV4dF9uZWFyYnk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBmb3VuZCBnYXBcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpdHY6IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCksXG4gICAgICAgICAgICBjZW50ZXIgOiBbdGhpcy5fdHJ1ZU9iamVjdF0sXG4gICAgICAgICAgICBsZWZ0OiBlbmRwb2ludC5mbGlwKGxvdywgXCJoaWdoXCIpLFxuICAgICAgICAgICAgcmlnaHQ6IGVuZHBvaW50LmZsaXAoaGlnaCwgXCJsb3dcIiksXG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuIiwiLypcblx0Q29weXJpZ2h0IDIwMjBcblx0QXV0aG9yIDogSW5nYXIgQXJudHplblxuXG5cdFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUaW1pbmdzcmMgbW9kdWxlLlxuXG5cdFRpbWluZ3NyYyBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG5cdGl0IHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieVxuXHR0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvclxuXHQoYXQgeW91ciBvcHRpb24pIGFueSBsYXRlciB2ZXJzaW9uLlxuXG5cdFRpbWluZ3NyYyBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLFxuXHRidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7IHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZlxuXHRNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG5cdEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuXG5cdFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZVxuXHRhbG9uZyB3aXRoIFRpbWluZ3NyYy4gIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiovXG5cblxuXG4vKlxuXHRFdmVudFxuXHQtIG5hbWU6IGV2ZW50IG5hbWVcblx0LSBwdWJsaXNoZXI6IHRoZSBvYmplY3Qgd2hpY2ggZGVmaW5lZCB0aGUgZXZlbnRcblx0LSBpbml0OiB0cnVlIGlmIHRoZSBldmVudCBzdXBwcG9ydHMgaW5pdCBldmVudHNcblx0LSBzdWJzY3JpcHRpb25zOiBzdWJzY3JpcHRpbnMgdG8gdGhpcyBldmVudFxuXG4qL1xuXG5jbGFzcyBFdmVudCB7XG5cblx0Y29uc3RydWN0b3IgKHB1Ymxpc2hlciwgbmFtZSwgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5wdWJsaXNoZXIgPSBwdWJsaXNoZXI7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gZmFsc2UgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zID0gW107XG5cdH1cblxuXHQvKlxuXHRcdHN1YnNjcmliZSB0byBldmVudFxuXHRcdC0gc3Vic2NyaWJlcjogc3Vic2NyaWJpbmcgb2JqZWN0XG5cdFx0LSBjYWxsYmFjazogY2FsbGJhY2sgZnVuY3Rpb24gdG8gaW52b2tlXG5cdFx0LSBvcHRpb25zOlxuXHRcdFx0aW5pdDogaWYgdHJ1ZSBzdWJzY3JpYmVyIHdhbnRzIGluaXQgZXZlbnRzXG5cdCovXG5cdHN1YnNjcmliZSAoY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRpZiAoIWNhbGxiYWNrIHx8IHR5cGVvZiBjYWxsYmFjayAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayBub3QgYSBmdW5jdGlvblwiLCBjYWxsYmFjayk7XG5cdFx0fVxuXHRcdGNvbnN0IHN1YiA9IG5ldyBTdWJzY3JpcHRpb24odGhpcywgY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5wdXNoKHN1Yik7XG5cdCAgICAvLyBJbml0aWF0ZSBpbml0IGNhbGxiYWNrIGZvciB0aGlzIHN1YnNjcmlwdGlvblxuXHQgICAgaWYgKHRoaXMuaW5pdCAmJiBzdWIuaW5pdCkge1xuXHQgICAgXHRzdWIuaW5pdF9wZW5kaW5nID0gdHJ1ZTtcblx0ICAgIFx0bGV0IHNlbGYgPSB0aGlzO1xuXHQgICAgXHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgIFx0XHRjb25zdCBlQXJncyA9IHNlbGYucHVibGlzaGVyLmV2ZW50aWZ5SW5pdEV2ZW50QXJncyhzZWxmLm5hbWUpIHx8IFtdO1xuXHQgICAgXHRcdHN1Yi5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0ICAgIFx0XHRmb3IgKGxldCBlQXJnIG9mIGVBcmdzKSB7XG5cdCAgICBcdFx0XHRzZWxmLnRyaWdnZXIoZUFyZywgW3N1Yl0sIHRydWUpO1xuXHQgICAgXHRcdH1cblx0ICAgIFx0fSk7XG5cdCAgICB9XG5cdFx0cmV0dXJuIHN1YlxuXHR9XG5cblx0Lypcblx0XHR0cmlnZ2VyIGV2ZW50XG5cblx0XHQtIGlmIHN1YiBpcyB1bmRlZmluZWQgLSBwdWJsaXNoIHRvIGFsbCBzdWJzY3JpcHRpb25zXG5cdFx0LSBpZiBzdWIgaXMgZGVmaW5lZCAtIHB1Ymxpc2ggb25seSB0byBnaXZlbiBzdWJzY3JpcHRpb25cblx0Ki9cblx0dHJpZ2dlciAoZUFyZywgc3VicywgaW5pdCkge1xuXHRcdGxldCBlSW5mbywgY3R4O1xuXHRcdGZvciAoY29uc3Qgc3ViIG9mIHN1YnMpIHtcblx0XHRcdC8vIGlnbm9yZSB0ZXJtaW5hdGVkIHN1YnNjcmlwdGlvbnNcblx0XHRcdGlmIChzdWIudGVybWluYXRlZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGVJbmZvID0ge1xuXHRcdFx0XHRzcmM6IHRoaXMucHVibGlzaGVyLFxuXHRcdFx0XHRuYW1lOiB0aGlzLm5hbWUsXG5cdFx0XHRcdHN1Yjogc3ViLFxuXHRcdFx0XHRpbml0OiBpbml0XG5cdFx0XHR9XG5cdFx0XHRjdHggPSBzdWIuY3R4IHx8IHRoaXMucHVibGlzaGVyO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0c3ViLmNhbGxiYWNrLmNhbGwoY3R4LCBlQXJnLCBlSW5mbyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYEVycm9yIGluICR7dGhpcy5uYW1lfTogJHtzdWIuY2FsbGJhY2t9ICR7ZXJyfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qXG5cdHVuc3Vic2NyaWJlIGZyb20gZXZlbnRcblx0LSB1c2Ugc3Vic2NyaXB0aW9uIHJldHVybmVkIGJ5IHByZXZpb3VzIHN1YnNjcmliZVxuXHQqL1xuXHR1bnN1YnNjcmliZShzdWIpIHtcblx0XHRsZXQgaWR4ID0gdGhpcy5zdWJzY3JpcHRpb25zLmluZGV4T2Yoc3ViKTtcblx0XHRpZiAoaWR4ID4gLTEpIHtcblx0XHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdHN1Yi50ZXJtaW5hdGUoKTtcblx0XHR9XG5cdH1cbn1cblxuXG4vKlxuXHRTdWJzY3JpcHRpb24gY2xhc3NcbiovXG5cbmNsYXNzIFN1YnNjcmlwdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoZXZlbnQsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLmV2ZW50ID0gZXZlbnQ7XG5cdFx0dGhpcy5uYW1lID0gZXZlbnQubmFtZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2tcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gdGhpcy5ldmVudC5pbml0IDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gZmFsc2U7XG5cdFx0dGhpcy5jdHggPSBvcHRpb25zLmN0eDtcblx0fVxuXG5cdHRlcm1pbmF0ZSgpIHtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSB0cnVlO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5ldmVudC51bnN1YnNjcmliZSh0aGlzKTtcblx0fVxufVxuXG5cbi8qXG5cblx0RVZFTlRJRlkgSU5TVEFOQ0VcblxuXHRFdmVudGlmeSBicmluZ3MgZXZlbnRpbmcgY2FwYWJpbGl0aWVzIHRvIGFueSBvYmplY3QuXG5cblx0SW4gcGFydGljdWxhciwgZXZlbnRpZnkgc3VwcG9ydHMgdGhlIGluaXRpYWwtZXZlbnQgcGF0dGVybi5cblx0T3B0LWluIGZvciBpbml0aWFsIGV2ZW50cyBwZXIgZXZlbnQgdHlwZS5cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlJbnN0YW5jZSAob2JqZWN0KSB7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwID0gbmV3IE1hcCgpO1xuXHRvYmplY3QuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0cmV0dXJuIG9iamVjdDtcbn07XG5cblxuLypcblx0RVZFTlRJRlkgUFJPVE9UWVBFXG5cblx0QWRkIGV2ZW50aWZ5IGZ1bmN0aW9uYWxpdHkgdG8gcHJvdG90eXBlIG9iamVjdFxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5UHJvdG90eXBlKF9wcm90b3R5cGUpIHtcblxuXHRmdW5jdGlvbiBldmVudGlmeUdldEV2ZW50KG9iamVjdCwgbmFtZSkge1xuXHRcdGNvbnN0IGV2ZW50ID0gb2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAuZ2V0KG5hbWUpO1xuXHRcdGlmIChldmVudCA9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IHVuZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0cmV0dXJuIGV2ZW50O1xuXHR9XG5cblx0Lypcblx0XHRERUZJTkUgRVZFTlRcblx0XHQtIHVzZWQgb25seSBieSBldmVudCBzb3VyY2Vcblx0XHQtIG5hbWU6IG5hbWUgb2YgZXZlbnRcblx0XHQtIG9wdGlvbnM6IHtpbml0OnRydWV9IHNwZWNpZmllcyBpbml0LWV2ZW50IHNlbWFudGljcyBmb3IgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlEZWZpbmUobmFtZSwgb3B0aW9ucykge1xuXHRcdC8vIGNoZWNrIHRoYXQgZXZlbnQgZG9lcyBub3QgYWxyZWFkeSBleGlzdFxuXHRcdGlmICh0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuaGFzKG5hbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCBhbHJlYWR5IGRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5zZXQobmFtZSwgbmV3IEV2ZW50KHRoaXMsIG5hbWUsIG9wdGlvbnMpKTtcblx0fTtcblxuXHQvKlxuXHRcdE9OXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRyZWdpc3RlciBjYWxsYmFjayBvbiBldmVudC5cblx0Ki9cblx0ZnVuY3Rpb24gb24obmFtZSwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpYmUoY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T0ZGXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRVbi1yZWdpc3RlciBhIGhhbmRsZXIgZnJvbSBhIHNwZWNmaWMgZXZlbnQgdHlwZVxuXHQqL1xuXHRmdW5jdGlvbiBvZmYoc3ViKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgc3ViLm5hbWUpLnVuc3Vic2NyaWJlKHN1Yik7XG5cdH07XG5cblxuXHRmdW5jdGlvbiBldmVudGlmeVN1YnNjcmlwdGlvbnMobmFtZSkge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmlwdGlvbnM7XG5cdH1cblxuXG5cblx0Lypcblx0XHRUcmlnZ2VyIGxpc3Qgb2YgZXZlbnRJdGVtcyBvbiBvYmplY3RcblxuXHRcdGV2ZW50SXRlbTogIHtuYW1lOi4uLCBlQXJnOi4ufVxuXG5cdFx0Y29weSBhbGwgZXZlbnRJdGVtcyBpbnRvIGJ1ZmZlci5cblx0XHRyZXF1ZXN0IGVtcHR5aW5nIHRoZSBidWZmZXIsIGkuZS4gYWN0dWFsbHkgdHJpZ2dlcmluZyBldmVudHMsXG5cdFx0ZXZlcnkgdGltZSB0aGUgYnVmZmVyIGdvZXMgZnJvbSBlbXB0eSB0byBub24tZW1wdHlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxsKGV2ZW50SXRlbXMpIHtcblx0XHRpZiAoZXZlbnRJdGVtcy5sZW5ndGggPT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIG1ha2UgdHJpZ2dlciBpdGVtc1xuXHRcdC8vIHJlc29sdmUgbm9uLXBlbmRpbmcgc3Vic2NyaXB0aW9ucyBub3dcblx0XHQvLyBlbHNlIHN1YnNjcmlwdGlvbnMgbWF5IGNoYW5nZSBmcm9tIHBlbmRpbmcgdG8gbm9uLXBlbmRpbmdcblx0XHQvLyBiZXR3ZWVuIGhlcmUgYW5kIGFjdHVhbCB0cmlnZ2VyaW5nXG5cdFx0Ly8gbWFrZSBsaXN0IG9mIFtldiwgZUFyZywgc3Vic10gdHVwbGVzXG5cdFx0bGV0IHRyaWdnZXJJdGVtcyA9IGV2ZW50SXRlbXMubWFwKChpdGVtKSA9PiB7XG5cdFx0XHRsZXQge25hbWUsIGVBcmd9ID0gaXRlbTtcblx0XHRcdGxldCBldiA9IGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSk7XG5cdFx0XHRsZXQgc3VicyA9IGV2LnN1YnNjcmlwdGlvbnMuZmlsdGVyKHN1YiA9PiBzdWIuaW5pdF9wZW5kaW5nID09IGZhbHNlKTtcblx0XHRcdHJldHVybiBbZXYsIGVBcmcsIHN1YnNdO1xuXHRcdH0sIHRoaXMpO1xuXG5cdFx0Ly8gYXBwZW5kIHRyaWdnZXIgSXRlbXMgdG8gYnVmZmVyXG5cdFx0Y29uc3QgbGVuID0gdHJpZ2dlckl0ZW1zLmxlbmd0aDtcblx0XHRjb25zdCBidWYgPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyO1xuXHRcdGNvbnN0IGJ1Zl9sZW4gPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aDtcblx0XHQvLyByZXNlcnZlIG1lbW9yeSAtIHNldCBuZXcgbGVuZ3RoXG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGggPSBidWZfbGVuICsgbGVuO1xuXHRcdC8vIGNvcHkgdHJpZ2dlckl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGZvciAobGV0IGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0YnVmW2J1Zl9sZW4raV0gPSB0cmlnZ2VySXRlbXNbaV07XG5cdFx0fVxuXHRcdC8vIHJlcXVlc3QgZW1wdHlpbmcgb2YgdGhlIGJ1ZmZlclxuXHRcdGlmIChidWZfbGVuID09IDApIHtcblx0XHRcdGxldCBzZWxmID0gdGhpcztcblx0XHRcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGZvciAobGV0IFtldiwgZUFyZywgc3Vic10gb2Ygc2VsZi5fX2V2ZW50aWZ5X2J1ZmZlcikge1xuXHRcdFx0XHRcdC8vIGFjdHVhbCBldmVudCB0cmlnZ2VyaW5nXG5cdFx0XHRcdFx0ZXYudHJpZ2dlcihlQXJnLCBzdWJzLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZi5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIG11bHRpcGxlIGV2ZW50cyBvZiBzYW1lIHR5cGUgKG5hbWUpXG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsaWtlKG5hbWUsIGVBcmdzKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKGVBcmdzLm1hcChlQXJnID0+IHtcblx0XHRcdHJldHVybiB7bmFtZSwgZUFyZ307XG5cdFx0fSkpO1xuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIHNpbmdsZSBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXIobmFtZSwgZUFyZykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChbe25hbWUsIGVBcmd9XSk7XG5cdH1cblxuXHRfcHJvdG90eXBlLmV2ZW50aWZ5RGVmaW5lID0gZXZlbnRpZnlEZWZpbmU7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyID0gZXZlbnRpZnlUcmlnZ2VyO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsaWtlID0gZXZlbnRpZnlUcmlnZ2VyQWxpa2U7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxsID0gZXZlbnRpZnlUcmlnZ2VyQWxsO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5U3Vic2NyaXB0aW9ucyA9IGV2ZW50aWZ5U3Vic2NyaXB0aW9ucztcblx0X3Byb3RvdHlwZS5vbiA9IG9uO1xuXHRfcHJvdG90eXBlLm9mZiA9IG9mZjtcbn07XG5cblxuZXhwb3J0IHtldmVudGlmeUluc3RhbmNlIGFzIGFkZFRvSW5zdGFuY2V9O1xuZXhwb3J0IHtldmVudGlmeVByb3RvdHlwZSBhcyBhZGRUb1Byb3RvdHlwZX07XG5cbi8qXG5cdEV2ZW50IFZhcmlhYmxlXG5cblx0T2JqZWN0cyB3aXRoIGEgc2luZ2xlIFwiY2hhbmdlXCIgZXZlbnRcbiovXG5cbmV4cG9ydCBjbGFzcyBFdmVudFZhcmlhYmxlIHtcblxuXHRjb25zdHJ1Y3RvciAodmFsdWUpIHtcblx0XHRldmVudGlmeUluc3RhbmNlKHRoaXMpO1xuXHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0dGhpcy5ldmVudGlmeURlZmluZShcImNoYW5nZVwiLCB7aW5pdDp0cnVlfSk7XG5cdH1cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG5cdGdldCB2YWx1ZSAoKSB7cmV0dXJuIHRoaXMuX3ZhbHVlfTtcblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdGlmICh2YWx1ZSAhPSB0aGlzLl92YWx1ZSkge1xuXHRcdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHRcdHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHZhbHVlKTtcblx0XHR9XG5cdH1cbn1cbmV2ZW50aWZ5UHJvdG90eXBlKEV2ZW50VmFyaWFibGUucHJvdG90eXBlKTtcblxuLypcblx0RXZlbnQgQm9vbGVhblxuXG5cblx0Tm90ZSA6IGltcGxlbWVudGF0aW9uIHVzZXMgZmFsc2luZXNzIG9mIGlucHV0IHBhcmFtZXRlciB0byBjb25zdHJ1Y3RvciBhbmQgc2V0KCkgb3BlcmF0aW9uLFxuXHRzbyBldmVudEJvb2xlYW4oLTEpIHdpbGwgYWN0dWFsbHkgc2V0IGl0IHRvIHRydWUgYmVjYXVzZVxuXHQoLTEpID8gdHJ1ZSA6IGZhbHNlIC0+IHRydWUgIVxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50Qm9vbGVhbiBleHRlbmRzIEV2ZW50VmFyaWFibGUge1xuXHRjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuXHRcdHN1cGVyKEJvb2xlYW4odmFsdWUpKTtcblx0fVxuXG5cdHNldCB2YWx1ZSAodmFsdWUpIHtcblx0XHRzdXBlci52YWx1ZSA9IEJvb2xlYW4odmFsdWUpO1xuXHR9XG5cdGdldCB2YWx1ZSAoKSB7cmV0dXJuIHN1cGVyLnZhbHVlfTtcbn1cblxuXG4vKlxuXHRtYWtlIGEgcHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aGVuIEV2ZW50Qm9vbGVhbiBjaGFuZ2VzXG5cdHZhbHVlLlxuKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWtlUHJvbWlzZShldmVudE9iamVjdCwgY29uZGl0aW9uRnVuYykge1xuXHRjb25kaXRpb25GdW5jID0gY29uZGl0aW9uRnVuYyB8fCBmdW5jdGlvbih2YWwpIHtyZXR1cm4gdmFsID09IHRydWV9O1xuXHRyZXR1cm4gbmV3IFByb21pc2UgKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0XHRsZXQgc3ViID0gZXZlbnRPYmplY3Qub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHRpZiAoY29uZGl0aW9uRnVuYyh2YWx1ZSkpIHtcblx0XHRcdFx0cmVzb2x2ZSh2YWx1ZSk7XG5cdFx0XHRcdGV2ZW50T2JqZWN0Lm9mZihzdWIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcbn07XG5cbi8vIG1vZHVsZSBhcGlcbmV4cG9ydCBkZWZhdWx0IHtcblx0ZXZlbnRpZnlQcm90b3R5cGUsXG5cdGV2ZW50aWZ5SW5zdGFuY2UsXG5cdEV2ZW50VmFyaWFibGUsXG5cdEV2ZW50Qm9vbGVhbixcblx0bWFrZVByb21pc2Vcbn07XG5cbiIsIlxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU09VUkNFIFBST1BFUlRZIChTUkNQUk9QKVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBGdW5jdGlvbnMgZm9yIGV4dGVuZGluZyBhIGNsYXNzIHdpdGggc3VwcG9ydCBmb3IgXG4gKiBleHRlcm5hbCBzb3VyY2Ugb24gYSBuYW1lZCBwcm9wZXJ0eS5cbiAqIFxuICogb3B0aW9uOiBtdXRhYmxlOnRydWUgbWVhbnMgdGhhdCBwcm9wZXJ5IG1heSBiZSByZXNldCBcbiAqIFxuICogc291cmNlIG9iamVjdCBpcyBhc3N1bWVkIHRvIHN1cHBvcnQgdGhlIGNhbGxiYWNrIGludGVyZmFjZSxcbiAqIG9yIGJlIGEgbGlzdCBvZiBvYmplY3RzIGFsbCBzdXBwb3J0aW5nIHRoZSBjYWxsYmFjayBpbnRlcmZhY2VcbiAqL1xuXG5jb25zdCBOQU1FID0gXCJzcmNwcm9wXCI7XG5jb25zdCBQUkVGSVggPSBgX18ke05BTUV9YDtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2UgKG9iamVjdCkge1xuICAgIG9iamVjdFtgJHtQUkVGSVh9YF0gPSBuZXcgTWFwKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuXG4gICAgZnVuY3Rpb24gcmVnaXN0ZXIocHJvcE5hbWUsIG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHttdXRhYmxlPXRydWV9ID0gb3B0aW9ucztcbiAgICAgICAgY29uc3QgbWFwID0gdGhpc1tgJHtQUkVGSVh9YF07IFxuICAgICAgICBtYXAuc2V0KHByb3BOYW1lLCB7XG4gICAgICAgICAgICBpbml0OmZhbHNlLFxuICAgICAgICAgICAgbXV0YWJsZSxcbiAgICAgICAgICAgIGVudGl0eTogdW5kZWZpbmVkLFxuICAgICAgICAgICAgaGFuZGxlczogW11cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gcmVnaXN0ZXIgZ2V0dGVycyBhbmQgc2V0dGVyc1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgcHJvcE5hbWUsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBtYXAuZ2V0KHByb3BOYW1lKS5lbnRpdHk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAoZW50aXR5KSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXNbYCR7TkFNRX1fY2hlY2tgXSkge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkgPSB0aGlzW2Ake05BTUV9X2NoZWNrYF0ocHJvcE5hbWUsIGVudGl0eSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChlbnRpdHkgIT0gbWFwLmdldChwcm9wTmFtZSkuZW50aXR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbYCR7UFJFRklYfV9hdHRhY2hgXShwcm9wTmFtZSwgZW50aXR5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGF0dGF0Y2gocHJvcE5hbWUsIGVudGl0eSkge1xuXG4gICAgICAgIGNvbnN0IG1hcCA9IHRoaXNbYCR7UFJFRklYfWBdO1xuICAgICAgICBjb25zdCBzdGF0ZSA9IG1hcC5nZXQocHJvcE5hbWUpXG5cbiAgICAgICAgaWYgKHN0YXRlLmluaXQgJiYgIXN0YXRlLm11dGFibGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtwcm9wTmFtZX0gY2FuIG5vdCBiZSByZWFzc2lnbmVkYCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBlbnRpdGllcyA9IChBcnJheS5pc0FycmF5KGVudGl0eSkpID8gZW50aXR5IDogW2VudGl0eV07XG5cbiAgICAgICAgLy8gdW5zdWJzY3JpYmUgZnJvbSBlbnRpdGllc1xuICAgICAgICBpZiAoc3RhdGUuaGFuZGxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtpZHgsIGVdIG9mIE9iamVjdC5lbnRyaWVzKGVudGl0aWVzKSkge1xuICAgICAgICAgICAgICAgIGUucmVtb3ZlX2NhbGxiYWNrKHN0YXRlLmhhbmRsZXNbaWR4XSk7XG4gICAgICAgICAgICB9ICAgIFxuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmhhbmRsZXMgPSBbXTtcblxuICAgICAgICAvLyBhdHRhdGNoIG5ldyBlbnRpdHlcbiAgICAgICAgc3RhdGUuZW50aXR5ID0gZW50aXR5O1xuICAgICAgICBzdGF0ZS5pbml0ID0gdHJ1ZTtcblxuICAgICAgICAvLyBzdWJzY3JpYmUgdG8gY2FsbGJhY2sgZnJvbSBzb3VyY2VcbiAgICAgICAgaWYgKHRoaXNbYCR7TkFNRX1fb25jaGFuZ2VgXSkge1xuICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IGZ1bmN0aW9uIChlQXJnKSB7XG4gICAgICAgICAgICAgICAgdGhpc1tgJHtOQU1FfV9vbmNoYW5nZWBdKHByb3BOYW1lLCBlQXJnKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZSBvZiBlbnRpdGllcykge1xuICAgICAgICAgICAgICAgIHN0YXRlLmhhbmRsZXMucHVzaChlLmFkZF9jYWxsYmFjayhoYW5kbGVyKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzW2Ake05BTUV9X29uY2hhbmdlYF0ocHJvcE5hbWUsIFwicmVzZXRcIik7IFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgYXBpID0ge307XG4gICAgYXBpW2Ake05BTUV9X3JlZ2lzdGVyYF0gPSByZWdpc3RlcjtcbiAgICBhcGlbYCR7UFJFRklYfV9hdHRhY2hgXSA9IGF0dGF0Y2g7XG4gICAgT2JqZWN0LmFzc2lnbihfcHJvdG90eXBlLCBhcGkpO1xufVxuXG4iLCJpbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuQkFTRSBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuXHRBYnN0cmFjdCBCYXNlIENsYXNzIGZvciBTZWdtZW50c1xuXG4gICAgY29uc3RydWN0b3IoaW50ZXJ2YWwpXG5cbiAgICAtIGludGVydmFsOiBpbnRlcnZhbCBvZiB2YWxpZGl0eSBvZiBzZWdtZW50XG4gICAgLSBkeW5hbWljOiB0cnVlIGlmIHNlZ21lbnQgaXMgZHluYW1pY1xuICAgIC0gdmFsdWUob2Zmc2V0KTogdmFsdWUgb2Ygc2VnbWVudCBhdCBvZmZzZXRcbiAgICAtIHF1ZXJ5KG9mZnNldCk6IHN0YXRlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4qL1xuXG5leHBvcnQgY2xhc3MgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0dikge1xuXHRcdHRoaXMuX2l0diA9IGl0djtcblx0fVxuXG5cdGdldCBpdHYoKSB7cmV0dXJuIHRoaXMuX2l0djt9XG5cbiAgICAvKiogXG4gICAgICogaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3NcbiAgICAgKiByZXR1cm5zIHt2YWx1ZSwgZHluYW1pY307XG4gICAgKi9cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjb252ZW5pZW5jZSBmdW5jdGlvbiByZXR1cm5pbmcgdGhlIHN0YXRlIG9mIHRoZSBzZWdtZW50XG4gICAgICogQHBhcmFtIHsqfSBvZmZzZXQgXG4gICAgICogQHJldHVybnMgXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5faXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuc3RhdGUob2Zmc2V0KSwgb2Zmc2V0fTtcbiAgICAgICAgfSBcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdW5kZWZpbmVkLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExBWUVSUyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBMYXllcnNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX2xheWVycyA9IGFyZ3MubGF5ZXJzO1xuICAgICAgICB0aGlzLl92YWx1ZV9mdW5jID0gYXJncy52YWx1ZV9mdW5jXG5cbiAgICAgICAgLy8gVE9ETyAtIGZpZ3VyZSBvdXQgZHluYW1pYyBoZXJlP1xuICAgIH1cblxuXHRzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgLy8gVE9ETyAtIHVzZSB2YWx1ZSBmdW5jXG4gICAgICAgIC8vIGZvciBub3cgLSBqdXN0IHVzZSBmaXJzdCBsYXllclxuICAgICAgICByZXR1cm4gey4uLnRoaXMuX2xheWVyc1swXS5xdWVyeShvZmZzZXQpLCBvZmZzZXR9O1xuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU1RBVElDIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIFN0YXRpY1NlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG5cdFx0dGhpcy5fdmFsdWUgPSBkYXRhO1xuXHR9XG5cblx0c3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3ZhbHVlLCBkeW5hbWljOmZhbHNlfVxuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTU9USU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qXG4gICAgSW1wbGVtZW50cyBkZXRlcm1pbmlzdGljIHByb2plY3Rpb24gYmFzZWQgb24gaW5pdGlhbCBjb25kaXRpb25zIFxuICAgIC0gbW90aW9uIHZlY3RvciBkZXNjcmliZXMgbW90aW9uIHVuZGVyIGNvbnN0YW50IGFjY2VsZXJhdGlvblxuKi9cblxuZXhwb3J0IGNsYXNzIE1vdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG4gICAgXG4gICAgY29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOnAwPTAsIFxuICAgICAgICAgICAgdmVsb2NpdHk6djA9MCwgXG4gICAgICAgICAgICBhY2NlbGVyYXRpb246YTA9MCwgXG4gICAgICAgICAgICB0aW1lc3RhbXA6dDA9MFxuICAgICAgICB9ID0gZGF0YTtcbiAgICAgICAgLy8gY3JlYXRlIG1vdGlvbiB0cmFuc2l0aW9uXG4gICAgICAgIHRoaXMuX3Bvc19mdW5jID0gZnVuY3Rpb24gKHRzKSB7XG4gICAgICAgICAgICBsZXQgZCA9IHRzIC0gdDA7XG4gICAgICAgICAgICByZXR1cm4gcDAgKyB2MCpkICsgMC41KmEwKmQqZDtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fdmVsX2Z1bmMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIGxldCBkID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHJldHVybiB2MCArIGEwKmQ7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fYWNjX2Z1bmMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIHJldHVybiBhMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRlKG9mZnNldCkge1xuICAgICAgICBsZXQgcG9zID0gdGhpcy5fcG9zX2Z1bmMob2Zmc2V0KTtcbiAgICAgICAgbGV0IHZlbCA9IHRoaXMuX3ZlbF9mdW5jKG9mZnNldCk7XG4gICAgICAgIGxldCBhY2MgPSB0aGlzLl9hY2NfZnVuYyhvZmZzZXQpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcG9zaXRpb246IHBvcyxcbiAgICAgICAgICAgIHZlbG9jaXR5OiB2ZWwsXG4gICAgICAgICAgICBhY2NlbGVyYXRpb246IGFjYyxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogb2Zmc2V0LFxuICAgICAgICAgICAgdmFsdWU6IHBvcyxcbiAgICAgICAgICAgIGR5bmFtaWM6ICh2ZWwgIT0gMCB8fCBhY2MgIT0gMCApXG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVFJBTlNJVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgU3VwcG9ydGVkIGVhc2luZyBmdW5jdGlvbnNcbiAgICBcImVhc2UtaW5cIjpcbiAgICBcImVhc2Utb3V0XCI6XG4gICAgXCJlYXNlLWluLW91dFwiXG4qL1xuXG5mdW5jdGlvbiBlYXNlaW4gKHRzKSB7XG4gICAgcmV0dXJuIE1hdGgucG93KHRzLDIpOyAgXG59XG5mdW5jdGlvbiBlYXNlb3V0ICh0cykge1xuICAgIHJldHVybiAxIC0gZWFzZWluKDEgLSB0cyk7XG59XG5mdW5jdGlvbiBlYXNlaW5vdXQgKHRzKSB7XG4gICAgaWYgKHRzIDwgLjUpIHtcbiAgICAgICAgcmV0dXJuIGVhc2VpbigyICogdHMpIC8gMjtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gKDIgLSBlYXNlaW4oMiAqICgxIC0gdHMpKSkgLyAyO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRyYW5zaXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuXHRcdHN1cGVyKGl0dik7XG4gICAgICAgIGxldCB7djAsIHYxLCBlYXNpbmd9ID0gZGF0YTtcbiAgICAgICAgbGV0IFt0MCwgdDFdID0gdGhpcy5faXR2LnNsaWNlKDAsMik7XG5cbiAgICAgICAgLy8gY3JlYXRlIHRoZSB0cmFuc2l0aW9uIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuX2R5bmFtaWMgPSB2MS12MCAhPSAwO1xuICAgICAgICB0aGlzLl90cmFucyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgLy8gY29udmVydCB0cyB0byBbdDAsdDFdLXNwYWNlXG4gICAgICAgICAgICAvLyAtIHNoaWZ0IGZyb20gW3QwLHQxXS1zcGFjZSB0byBbMCwodDEtdDApXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzY2FsZSBmcm9tIFswLCh0MS10MCldLXNwYWNlIHRvIFswLDFdLXNwYWNlXG4gICAgICAgICAgICB0cyA9IHRzIC0gdDA7XG4gICAgICAgICAgICB0cyA9IHRzL3BhcnNlRmxvYXQodDEtdDApO1xuICAgICAgICAgICAgLy8gZWFzaW5nIGZ1bmN0aW9ucyBzdHJldGNoZXMgb3IgY29tcHJlc3NlcyB0aGUgdGltZSBzY2FsZSBcbiAgICAgICAgICAgIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluXCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2Vpbih0cyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVhc2luZyA9PSBcImVhc2Utb3V0XCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2VvdXQodHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW5vdXQodHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbGluZWFyIHRyYW5zaXRpb24gZnJvbSB2MCB0byB2MSwgZm9yIHRpbWUgdmFsdWVzIFswLDFdXG4gICAgICAgICAgICB0cyA9IE1hdGgubWF4KHRzLCAwKTtcbiAgICAgICAgICAgIHRzID0gTWF0aC5taW4odHMsIDEpO1xuICAgICAgICAgICAgcmV0dXJuIHYwICsgKHYxLXYwKSp0cztcbiAgICAgICAgfVxuXHR9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dGhpcy5fZHluYW1pY31cblx0fVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgSU5URVJQT0xBVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogRnVuY3Rpb24gdG8gY3JlYXRlIGFuIGludGVycG9sYXRvciBmb3IgbmVhcmVzdCBuZWlnaGJvciBpbnRlcnBvbGF0aW9uIHdpdGhcbiAqIGV4dHJhcG9sYXRpb24gc3VwcG9ydC5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSB0dXBsZXMgLSBBbiBhcnJheSBvZiBbdmFsdWUsIG9mZnNldF0gcGFpcnMsIHdoZXJlIHZhbHVlIGlzIHRoZVxuICogcG9pbnQncyB2YWx1ZSBhbmQgb2Zmc2V0IGlzIHRoZSBjb3JyZXNwb25kaW5nIG9mZnNldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gLSBBIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYW4gb2Zmc2V0IGFuZCByZXR1cm5zIHRoZVxuICogaW50ZXJwb2xhdGVkIG9yIGV4dHJhcG9sYXRlZCB2YWx1ZS5cbiAqL1xuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZSh0dXBsZXMpIHtcblxuICAgIGlmICh0dXBsZXMubGVuZ3RoIDwgMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdW5kZWZpbmVkO31cbiAgICB9IGVsc2UgaWYgKHR1cGxlcy5sZW5ndGggPT0gMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdHVwbGVzWzBdWzBdO31cbiAgICB9XG5cbiAgICAvLyBTb3J0IHRoZSB0dXBsZXMgYnkgdGhlaXIgb2Zmc2V0c1xuICAgIGNvbnN0IHNvcnRlZFR1cGxlcyA9IFsuLi50dXBsZXNdLnNvcnQoKGEsIGIpID0+IGFbMV0gLSBiWzFdKTtcbiAgXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvcihvZmZzZXQpIHtcbiAgICAgIC8vIEhhbmRsZSBleHRyYXBvbGF0aW9uIGJlZm9yZSB0aGUgZmlyc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPD0gc29ydGVkVHVwbGVzWzBdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzWzBdO1xuICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1sxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBhZnRlciB0aGUgbGFzdCBwb2ludFxuICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAyXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdO1xuICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICB9XG4gIFxuICAgICAgLy8gRmluZCB0aGUgbmVhcmVzdCBwb2ludHMgdG8gdGhlIGxlZnQgYW5kIHJpZ2h0XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvcnRlZFR1cGxlcy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbaV1bMV0gJiYgb2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1tpICsgMV1bMV0pIHtcbiAgICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tpXTtcbiAgICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1tpICsgMV07XG4gICAgICAgICAgLy8gTGluZWFyIGludGVycG9sYXRpb24gZm9ybXVsYTogeSA9IHkxICsgKCAoeCAtIHgxKSAqICh5MiAtIHkxKSAvICh4MiAtIHgxKSApXG4gICAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gIFxuICAgICAgLy8gSW4gY2FzZSB0aGUgb2Zmc2V0IGRvZXMgbm90IGZhbGwgd2l0aGluIGFueSByYW5nZSAoc2hvdWxkIGJlIGNvdmVyZWQgYnkgdGhlIHByZXZpb3VzIGNvbmRpdGlvbnMpXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH07XG59XG4gIFxuXG5leHBvcnQgY2xhc3MgSW50ZXJwb2xhdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cbiAgICBjb25zdHJ1Y3RvcihpdHYsIHR1cGxlcykge1xuICAgICAgICBzdXBlcihpdHYpO1xuICAgICAgICAvLyBzZXR1cCBpbnRlcnBvbGF0aW9uIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuX3RyYW5zID0gaW50ZXJwb2xhdGUodHVwbGVzKTtcbiAgICB9XG5cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdGhpcy5fdHJhbnMob2Zmc2V0KSwgZHluYW1pYzp0cnVlfTtcbiAgICB9XG59XG5cblxuIiwiXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQ0xPQ0tTXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogY2xvY2tzIGNvdW50aW5nIGluIHNlY29uZHNcbiAqL1xuXG5jb25zdCBsb2NhbCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gcGVyZm9ybWFuY2Uubm93KCkvMTAwMC4wO1xufVxuXG5jb25zdCBlcG9jaCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS8xMDAwLjA7XG59XG5cbi8qKlxuICogdGhlIGNsb2NrIGdpdmVzIGVwb2NoIHZhbHVlcywgYnV0IGlzIGltcGxlbWVudGVkXG4gKiB1c2luZyBhIGhpZ2ggcGVyZm9ybWFuY2UgbG9jYWwgY2xvY2sgZm9yIGJldHRlclxuICogdGltZSByZXNvbHV0aW9uIGFuZCBwcm90ZWN0aW9uIGFnYWluc3Qgc3lzdGVtIFxuICogdGltZSBhZGp1c3RtZW50cy5cbiAqL1xuXG5leHBvcnQgY29uc3QgQ0xPQ0sgPSBmdW5jdGlvbiAoKSB7XG4gICAgY29uc3QgdDBfbG9jYWwgPSBsb2NhbCgpO1xuICAgIGNvbnN0IHQwX2Vwb2NoID0gZXBvY2goKTtcbiAgICByZXR1cm4ge1xuICAgICAgICBub3c6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0MF9lcG9jaCArIChsb2NhbCgpIC0gdDBfbG9jYWwpXG4gICAgICAgIH1cbiAgICB9XG59KCk7XG5cblxuLy8gb3Z2ZXJyaWRlIG1vZHVsbyB0byBiZWhhdmUgYmV0dGVyIGZvciBuZWdhdGl2ZSBudW1iZXJzXG5leHBvcnQgZnVuY3Rpb24gbW9kKG4sIG0pIHtcbiAgICByZXR1cm4gKChuICUgbSkgKyBtKSAlIG07XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZGl2bW9kKHgsIGJhc2UpIHtcbiAgICBsZXQgbiA9IE1hdGguZmxvb3IoeCAvIGJhc2UpXG4gICAgbGV0IHIgPSBtb2QoeCwgYmFzZSk7XG4gICAgcmV0dXJuIFtuLCByXTtcbn1cblxuXG4vKlxuICAgIHNpbWlsYXIgdG8gcmFuZ2UgZnVuY3Rpb24gaW4gcHl0aG9uXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gcmFuZ2UgKHN0YXJ0LCBlbmQsIHN0ZXAgPSAxLCBvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgY29uc3Qge2luY2x1ZGVfZW5kPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgaWYgKHN0ZXAgPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTdGVwIGNhbm5vdCBiZSB6ZXJvLicpO1xuICAgIH1cbiAgICBpZiAoc3RhcnQgPCBlbmQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IHN0ZXApIHtcbiAgICAgICAgICByZXN1bHQucHVzaChpKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RhcnQgPiBlbmQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpID4gZW5kOyBpIC09IHN0ZXApIHtcbiAgICAgICAgICByZXN1bHQucHVzaChpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoaW5jbHVkZV9lbmQpIHtcbiAgICAgICAgcmVzdWx0LnB1c2goZW5kKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuXG4vKipcbiAqIENyZWF0ZSBhIHNpbmdsZSBzdGF0ZSBmcm9tIGEgbGlzdCBvZiBzdGF0ZXMsIHVzaW5nIGEgdmFsdWVGdW5jXG4gKiBzdGF0ZTp7dmFsdWUsIGR5bmFtaWMsIG9mZnNldH1cbiAqIFxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiB0b1N0YXRlKHNvdXJjZXMsIHN0YXRlcywgb2Zmc2V0LCBvcHRpb25zPXt9KSB7XG4gICAgbGV0IHt2YWx1ZUZ1bmMsIHN0YXRlRnVuY30gPSBvcHRpb25zOyBcbiAgICBpZiAodmFsdWVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBsZXQgdmFsdWUgPSB2YWx1ZUZ1bmMoe3NvdXJjZXMsIHN0YXRlcywgb2Zmc2V0fSk7XG4gICAgICAgIGxldCBkeW5hbWljID0gc3RhdGVzLm1hcCgodikgPT4gdi5keW1hbWljKS5zb21lKGU9PmUpO1xuICAgICAgICByZXR1cm4ge3ZhbHVlLCBkeW5hbWljLCBvZmZzZXR9O1xuICAgIH0gZWxzZSBpZiAoc3RhdGVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gey4uLnN0YXRlRnVuYyh7c291cmNlcywgc3RhdGVzLCBvZmZzZXR9KSwgb2Zmc2V0fTtcbiAgICB9XG4gICAgLy8gbm8gdmFsdWVGdW5jIG9yIHN0YXRlRnVuY1xuICAgIGlmIChzdGF0ZXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTp1bmRlZmluZWQsIGR5bmFtaWM6ZmFsc2UsIG9mZnNldH1cbiAgICB9XG4gICAgLy8gZmFsbGJhY2sgLSBqdXN0IHVzZSBmaXJzdCBzdGF0ZVxuICAgIGxldCBzdGF0ZSA9IHN0YXRlc1swXTtcbiAgICByZXR1cm4gey4uLnN0YXRlLCBvZmZzZXR9OyBcbn0iLCJpbXBvcnQgeyBpbnRlcnZhbCwgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuL25lYXJieWluZGV4LmpzXCI7XG5cbi8qKlxuICogXG4gKiBOZWFyYnkgSW5kZXggU2ltcGxlXG4gKiBcbiAqIC0gaXRlbXMgYXJlIGFzc3VtZWQgdG8gYmUgbm9uLW92ZXJsYXBwaW5nIG9uIHRoZSB0aW1lbGluZSwgXG4gKiAtIGltcGx5aW5nIHRoYXQgbmVhcmJ5LmNlbnRlciB3aWxsIGJlIGEgbGlzdCBvZiBhdCBtb3N0IG9uZSBJVEVNLiBcbiAqIC0gZXhjZXB0aW9uIHdpbGwgYmUgcmFpc2VkIGlmIG92ZXJsYXBwaW5nIElURU1TIGFyZSBmb3VuZFxuICogLSBJVEVNUyBpcyBhc3N1bWJlZCB0byBiZSBpbW11dGFibGUgYXJyYXkgLSBjaGFuZ2UgSVRFTVMgYnkgcmVwbGFjaW5nIGFycmF5XG4gKiBcbiAqICBcbiAqL1xuXG5cbi8vIGdldCBpbnRlcnZhbCBsb3cgcG9pbnRcbmZ1bmN0aW9uIGdldF9sb3dfdmFsdWUoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLml0dlswXTtcbn1cblxuLy8gZ2V0IGludGVydmFsIGxvdyBlbmRwb2ludFxuZnVuY3Rpb24gZ2V0X2xvd19lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzBdXG59XG5cbi8vIGdldCBpbnRlcnZhbCBoaWdoIGVuZHBvaW50XG5mdW5jdGlvbiBnZXRfaGlnaF9lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzFdXG59XG5cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4U2ltcGxlIGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKHNyYykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9zcmMgPSBzcmM7XG4gICAgfVxuXG4gICAgZ2V0IHNyYyAoKSB7cmV0dXJuIHRoaXMuX3NyYzt9XG5cbiAgICAvKlxuICAgICAgICBuZWFyYnkgYnkgb2Zmc2V0XG4gICAgICAgIFxuICAgICAgICByZXR1cm5zIHtsZWZ0LCBjZW50ZXIsIHJpZ2h0fVxuXG4gICAgICAgIGJpbmFyeSBzZWFyY2ggYmFzZWQgb24gb2Zmc2V0XG4gICAgICAgIDEpIGZvdW5kLCBpZHhcbiAgICAgICAgICAgIG9mZnNldCBtYXRjaGVzIHZhbHVlIG9mIGludGVydmFsLmxvdyBvZiBhbiBpdGVtXG4gICAgICAgICAgICBpZHggZ2l2ZXMgdGhlIGluZGV4IG9mIHRoaXMgaXRlbSBpbiB0aGUgYXJyYXlcbiAgICAgICAgMikgbm90IGZvdW5kLCBpZHhcbiAgICAgICAgICAgIG9mZnNldCBpcyBlaXRoZXIgY292ZXJlZCBieSBpdGVtIGF0IChpZHgtMSksXG4gICAgICAgICAgICBvciBpdCBpcyBub3QgPT4gYmV0d2VlbiBlbnRyaWVzXG4gICAgICAgICAgICBpbiB0aGlzIGNhc2UgLSBpZHggZ2l2ZXMgdGhlIGluZGV4IHdoZXJlIGFuIGl0ZW1cbiAgICAgICAgICAgIHNob3VsZCBiZSBpbnNlcnRlZCAtIGlmIGl0IGhhZCBsb3cgPT0gb2Zmc2V0XG4gICAgKi9cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIG9mZnNldCA9IHRoaXMuY2hlY2sob2Zmc2V0KTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgICAgY2VudGVyOiBbXSxcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgbGVmdDogWy1JbmZpbml0eSwgMF0sXG4gICAgICAgICAgICBwcmV2OiBbLUluZmluaXR5LCAwXSxcbiAgICAgICAgICAgIHJpZ2h0OiBbSW5maW5pdHksIDBdLFxuICAgICAgICAgICAgbmV4dDogW0luZmluaXR5LCAwXVxuICAgICAgICB9O1xuICAgICAgICBsZXQgaXRlbXMgPSB0aGlzLl9zcmMuZ2V0X2l0ZW1zKCk7XG4gICAgICAgIGxldCBpbmRleGVzLCBpdGVtO1xuICAgICAgICBjb25zdCBzaXplID0gaXRlbXMubGVuZ3RoO1xuICAgICAgICBpZiAoc2l6ZSA9PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0OyBcbiAgICAgICAgfVxuICAgICAgICBsZXQgW2ZvdW5kLCBpZHhdID0gZmluZF9pbmRleChvZmZzZXRbMF0sIGl0ZW1zLCBnZXRfbG93X3ZhbHVlKTtcbiAgICAgICAgaWYgKGZvdW5kKSB7XG4gICAgICAgICAgICAvLyBzZWFyY2ggb2Zmc2V0IG1hdGNoZXMgaXRlbSBsb3cgZXhhY3RseVxuICAgICAgICAgICAgLy8gY2hlY2sgdGhhdCBpdCBpbmRlZWQgY292ZXJlZCBieSBpdGVtIGludGVydmFsXG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4XVxuICAgICAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19lbmRwb2ludChpdGVtLml0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgIGluZGV4ZXMgPSB7bGVmdDppZHgtMSwgY2VudGVyOmlkeCwgcmlnaHQ6aWR4KzF9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChpbmRleGVzID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gY2hlY2sgcHJldiBpdGVtXG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4LTFdO1xuICAgICAgICAgICAgaWYgKGl0ZW0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgaWYgc2VhcmNoIG9mZnNldCBpcyBjb3ZlcmVkIGJ5IGl0ZW0gaW50ZXJ2YWxcbiAgICAgICAgICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KGl0ZW0uaXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ZXMgPSB7bGVmdDppZHgtMiwgY2VudGVyOmlkeC0xLCByaWdodDppZHh9O1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cdFxuICAgICAgICBpZiAoaW5kZXhlcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIHByZXYgaXRlbSBlaXRoZXIgZG9lcyBub3QgZXhpc3Qgb3IgaXMgbm90IHJlbGV2YW50XG4gICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTEsIGNlbnRlcjotMSwgcmlnaHQ6aWR4fTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNlbnRlclxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLmNlbnRlciAmJiBpbmRleGVzLmNlbnRlciA8IHNpemUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5jZW50ZXIgPSAgW2l0ZW1zW2luZGV4ZXMuY2VudGVyXV07XG4gICAgICAgIH1cbiAgICAgICAgLy8gcHJldi9uZXh0XG4gICAgICAgIGlmICgwIDw9IGluZGV4ZXMubGVmdCAmJiBpbmRleGVzLmxlZnQgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQucHJldiA9ICBnZXRfaGlnaF9lbmRwb2ludChpdGVtc1tpbmRleGVzLmxlZnRdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLnJpZ2h0ICYmIGluZGV4ZXMucmlnaHQgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQubmV4dCA9ICBnZXRfbG93X2VuZHBvaW50KGl0ZW1zW2luZGV4ZXMucmlnaHRdKTtcbiAgICAgICAgfSAgICAgICAgXG4gICAgICAgIC8vIGxlZnQvcmlnaHRcbiAgICAgICAgbGV0IGxvdyA9IFstSW5maW5pdHksIDBdLCBoaWdoPSBbSW5maW5pdHksIDBdO1xuICAgICAgICBpZiAocmVzdWx0LmNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBsZXQgaXR2ID0gcmVzdWx0LmNlbnRlclswXS5pdHY7XG4gICAgICAgICAgICBbbG93LCBoaWdoXSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gKGxvd1swXSA+IC1JbmZpbml0eSkgPyBlbmRwb2ludC5mbGlwKGxvdywgXCJoaWdoXCIpIDogWy1JbmZpbml0eSwgMF07XG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSAoaGlnaFswXSA8IEluZmluaXR5KSA/IGVuZHBvaW50LmZsaXAoaGlnaCwgXCJsb3dcIikgOiBbSW5maW5pdHksIDBdO1xuICAgICAgICAgICAgcmVzdWx0Lml0diA9IHJlc3VsdC5jZW50ZXJbMF0uaXR2O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSByZXN1bHQucHJldjtcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IHJlc3VsdC5uZXh0O1xuICAgICAgICAgICAgLy8gaW50ZXJ2YWxcbiAgICAgICAgICAgIGxldCBsZWZ0ID0gcmVzdWx0LmxlZnQ7XG4gICAgICAgICAgICBpZiAobG93WzBdID09IC1JbmZpbml0eSkge1xuICAgICAgICAgICAgICAgIGxvdyA9IGVuZHBvaW50LmZsaXAobGVmdCwgXCJsb3dcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgcmlnaHQgPSByZXN1bHQucmlnaHQ7XG4gICAgICAgICAgICBpZiAoaGlnaFswXSA9PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgICAgIGhpZ2ggPSBlbmRwb2ludC5mbGlwKHJpZ2h0LCBcImhpZ2hcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQuaXR2ID0gaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXHRVVElMU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5cbi8qXG5cdGJpbmFyeSBzZWFyY2ggZm9yIGZpbmRpbmcgdGhlIGNvcnJlY3QgaW5zZXJ0aW9uIGluZGV4IGludG9cblx0dGhlIHNvcnRlZCBhcnJheSAoYXNjZW5kaW5nKSBvZiBpdGVtc1xuXHRcblx0YXJyYXkgY29udGFpbnMgb2JqZWN0cywgYW5kIHZhbHVlIGZ1bmMgcmV0cmVhdmVzIGEgdmFsdWVcblx0ZnJvbSBlYWNoIG9iamVjdC5cblxuXHRyZXR1cm4gW2ZvdW5kLCBpbmRleF1cbiovXG5cbmZ1bmN0aW9uIGZpbmRfaW5kZXgodGFyZ2V0LCBhcnIsIHZhbHVlX2Z1bmMpIHtcblxuICAgIGZ1bmN0aW9uIGRlZmF1bHRfdmFsdWVfZnVuYyhlbCkge1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgfVxuICAgIFxuICAgIGxldCBsZWZ0ID0gMDtcblx0bGV0IHJpZ2h0ID0gYXJyLmxlbmd0aCAtIDE7XG5cdHZhbHVlX2Z1bmMgPSB2YWx1ZV9mdW5jIHx8IGRlZmF1bHRfdmFsdWVfZnVuYztcblx0d2hpbGUgKGxlZnQgPD0gcmlnaHQpIHtcblx0XHRjb25zdCBtaWQgPSBNYXRoLmZsb29yKChsZWZ0ICsgcmlnaHQpIC8gMik7XG5cdFx0bGV0IG1pZF92YWx1ZSA9IHZhbHVlX2Z1bmMoYXJyW21pZF0pO1xuXHRcdGlmIChtaWRfdmFsdWUgPT09IHRhcmdldCkge1xuXHRcdFx0cmV0dXJuIFt0cnVlLCBtaWRdOyAvLyBUYXJnZXQgYWxyZWFkeSBleGlzdHMgaW4gdGhlIGFycmF5XG5cdFx0fSBlbHNlIGlmIChtaWRfdmFsdWUgPCB0YXJnZXQpIHtcblx0XHRcdCAgbGVmdCA9IG1pZCArIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSByaWdodFxuXHRcdH0gZWxzZSB7XG5cdFx0XHQgIHJpZ2h0ID0gbWlkIC0gMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIGxlZnRcblx0XHR9XG5cdH1cbiAgXHRyZXR1cm4gW2ZhbHNlLCBsZWZ0XTsgLy8gUmV0dXJuIHRoZSBpbmRleCB3aGVyZSB0YXJnZXQgc2hvdWxkIGJlIGluc2VydGVkXG59XG4iLCJpbXBvcnQgKiBhcyBldmVudGlmeSBmcm9tIFwiLi9hcGlfZXZlbnRpZnkuanNcIjtcbmltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL2FwaV9jYWxsYmFjay5qc1wiO1xuaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi9hcGlfc3JjcHJvcC5qc1wiO1xuaW1wb3J0ICogYXMgc2VnbWVudCBmcm9tIFwiLi9zZWdtZW50cy5qc1wiO1xuXG5pbXBvcnQgeyBpbnRlcnZhbCwgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IHJhbmdlLCB0b1N0YXRlIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX2Jhc2VzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleFNpbXBsZSB9IGZyb20gXCIuL25lYXJieWluZGV4X3NpbXBsZVwiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExBWUVSXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIExheWVyIGlzIGFic3RyYWN0IGJhc2UgY2xhc3MgZm9yIExheWVyc1xuICogXG4gKiBMYXllciBpbnRlcmZhY2UgaXMgZGVmaW5lZCBieSAoaW5kZXgsIENhY2hlQ2xhc3MsIHZhbHVlRnVuYylcbiAqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXIge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBjb25zdCB7Q2FjaGVDbGFzcz1MYXllckNhY2hlfSA9IG9wdGlvbnM7XG4gICAgICAgIGNvbnN0IHt2YWx1ZUZ1bmMsIHN0YXRlRnVuY30gPSBvcHRpb25zO1xuICAgICAgICAvLyBjYWxsYmFja3NcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgLy8gbGF5ZXIgcXVlcnkgYXBpXG4gICAgICAgIC8vbGF5ZXJxdWVyeS5hZGRUb0luc3RhbmNlKHRoaXMsIENhY2hlQ2xhc3MsIHt2YWx1ZUZ1bmMsIHN0YXRlRnVuY30pO1xuICAgICAgICAvLyBkZWZpbmUgY2hhbmdlIGV2ZW50XG4gICAgICAgIGV2ZW50aWZ5LmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlEZWZpbmUoXCJjaGFuZ2VcIiwge2luaXQ6dHJ1ZX0pO1xuXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIHRoaXMuX2luZGV4O1xuICAgICAgICAvLyBjYWNoZVxuICAgICAgICB0aGlzLl9DYWNoZUNsYXNzID0gQ2FjaGVDbGFzcztcbiAgICAgICAgdGhpcy5fY2FjaGVfb2JqZWN0O1xuICAgICAgICB0aGlzLl9jYWNoZV9vYmplY3RzID0gW107XG5cbiAgICAgICAgLy8gcXVlcnkgb3B0aW9uc1xuICAgICAgICB0aGlzLl9xdWVyeU9wdGlvbnMgPSB7dmFsdWVGdW5jLCBzdGF0ZUZ1bmN9O1xuXG4gICAgfVxuXG4gICAgLy8gaW5kZXhcbiAgICBnZXQgaW5kZXggKCkge3JldHVybiB0aGlzLl9pbmRleH1cbiAgICBzZXQgaW5kZXggKGluZGV4KSB7dGhpcy5faW5kZXggPSBpbmRleH1cblxuICAgIC8vIHF1ZXJ5T3B0aW9uc1xuICAgIGdldCBxdWVyeU9wdGlvbnMgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcXVlcnlPcHRpb25zO1xuICAgIH1cblxuICAgIC8vIGNhY2hlXG4gICAgZ2V0IGNhY2hlICgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NhY2hlX29iamVjdCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2NhY2hlX29iamVjdCA9IG5ldyB0aGlzLl9DYWNoZUNsYXNzKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZV9vYmplY3Q7XG4gICAgfVxuXG4gICAgZ2V0Q2FjaGUgKCkge1xuICAgICAgICBjb25zdCBjYWNoZSA9IG5ldyB0aGlzLl9DYWNoZUNsYXNzKHRoaXMpO1xuICAgICAgICB0aGlzLl9jYWNoZV9vYmplY3RzLnB1c2goY2FjaGUpO1xuICAgICAgICByZXR1cm4gY2FjaGU7XG4gICAgfVxuXG4gICAgY2xlYXJDYWNoZXMoKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2FjaGUgb2YgdGhpcy5fY2FjaGVfb2JqZWN0cyl7XG4gICAgICAgICAgICBjYWNoZS5jbGVhcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhY2hlLnF1ZXJ5KG9mZnNldCk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgU2FtcGxlIExheWVyIGJ5IHRpbWVsaW5lIG9mZnNldCBpbmNyZW1lbnRzXG4gICAgICAgIHJldHVybiBsaXN0IG9mIHR1cGxlcyBbdmFsdWUsIG9mZnNldF1cbiAgICAgICAgb3B0aW9uc1xuICAgICAgICAtIHN0YXJ0XG4gICAgICAgIC0gc3RvcFxuICAgICAgICAtIHN0ZXBcbiAgICAqL1xuICAgIHNhbXBsZShvcHRpb25zPXt9KSB7XG4gICAgICAgIGxldCB7c3RhcnQ9LUluZmluaXR5LCBzdG9wPUluZmluaXR5LCBzdGVwPTF9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHN0YXJ0ID4gc3RvcCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIChcInN0b3AgbXVzdCBiZSBsYXJnZXIgdGhhbiBzdGFydFwiLCBzdGFydCwgc3RvcClcbiAgICAgICAgfVxuICAgICAgICBzdGFydCA9IFtzdGFydCwgMF07XG4gICAgICAgIHN0b3AgPSBbc3RvcCwgMF07XG4gICAgICAgIHN0YXJ0ID0gZW5kcG9pbnQubWF4KHRoaXMuaW5kZXguZmlyc3QoKSwgc3RhcnQpO1xuICAgICAgICBzdG9wID0gZW5kcG9pbnQubWluKHRoaXMuaW5kZXgubGFzdCgpLCBzdG9wKTtcbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmdldENhY2hlKCk7XG4gICAgICAgIHJldHVybiByYW5nZShzdGFydFswXSwgc3RvcFswXSwgc3RlcCwge2luY2x1ZGVfZW5kOnRydWV9KVxuICAgICAgICAgICAgLm1hcCgob2Zmc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtjYWNoZS5xdWVyeShvZmZzZXQpLnZhbHVlLCBvZmZzZXRdO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoTGF5ZXIucHJvdG90eXBlKTtcbmV2ZW50aWZ5LmFkZFRvUHJvdG90eXBlKExheWVyLnByb3RvdHlwZSk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTEFZRVIgQ0FDSEVcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogVGhpcyBpbXBsZW1lbnRzIGEgQ2FjaGUgdG8gYmUgdXNlZCB3aXRoIExheWVyIG9iamVjdHNcbiAqIFF1ZXJ5IHJlc3VsdHMgYXJlIG9idGFpbmVkIGZyb20gdGhlIGNhY2hlIG9iamVjdHMgaW4gdGhlXG4gKiBsYXllciBpbmRleCBhbmQgY2FjaGVkIG9ubHkgaWYgdGhleSBkZXNjcmliZSBhIHN0YXRpYyB2YWx1ZS4gXG4gKi9cblxuZXhwb3J0IGNsYXNzIExheWVyQ2FjaGUge1xuXG4gICAgY29uc3RydWN0b3IobGF5ZXIpIHtcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgLy8gY2FjaGVkIG5lYXJieSBzdGF0ZVxuICAgICAgICB0aGlzLl9uZWFyYnk7XG4gICAgICAgIC8vIGNhY2hlZCByZXN1bHRcbiAgICAgICAgdGhpcy5fc3RhdGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcXVlcnkgY2FjaGVcbiAgICAgKi9cbiAgICBxdWVyeShvZmZzZXQpIHtcbiAgICAgICAgY29uc3QgbmVlZF9uZWFyYnkgPSAoXG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAhaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX25lYXJieS5pdHYsIG9mZnNldClcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgIW5lZWRfbmVhcmJ5ICYmIFxuICAgICAgICAgICAgdGhpcy5fc3RhdGUgIT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgICAhdGhpcy5fc3RhdGUuZHluYW1pY1xuICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIGNhY2hlIGhpdFxuICAgICAgICAgICAgcmV0dXJuIHsuLi50aGlzLl9zdGF0ZSwgb2Zmc2V0fTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjYWNoZSBtaXNzXG4gICAgICAgIGlmIChuZWVkX25lYXJieSkge1xuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdGhpcy5fbGF5ZXIuaW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gcGVyZm9ybSBxdWVyaWVzXG4gICAgICAgIGNvbnN0IHN0YXRlcyA9IHRoaXMuX25lYXJieS5jZW50ZXIubWFwKChjYWNoZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGNhY2hlLnF1ZXJ5KG9mZnNldCk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBzdGF0ZSA9IHRvU3RhdGUodGhpcy5fbmVhcmJ5LmNlbnRlciwgc3RhdGVzLCBvZmZzZXQsIHRoaXMuX2xheWVyLnF1ZXJ5T3B0aW9ucylcbiAgICAgICAgLy8gY2FjaGUgc3RhdGUgb25seSBpZiBub3QgZHluYW1pY1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IChzdGF0ZS5keW5hbWljKSA/IHVuZGVmaW5lZCA6IHN0YXRlO1xuICAgICAgICByZXR1cm4gc3RhdGUgICAgXG4gICAgfVxuXG4gICAgY2xlYXIoKSB7XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElOUFVUIExBWUVSXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogTGF5ZXIgd2l0aCBhIFN0YXRlUHJvdmlkZXIgYXMgc3JjXG4gKi9cblxuZXhwb3J0IGNsYXNzIElucHV0TGF5ZXIgZXh0ZW5kcyBMYXllciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIGNvbnN0IHtzcmMsIHZhbHVlRnVuYywgc3RhdGVGdW5jfSA9IG9wdGlvbnM7XG4gICAgICAgIHN1cGVyKHtDYWNoZUNsYXNzOklucHV0TGF5ZXJDYWNoZSwgdmFsdWVGdW5jLCBzdGF0ZUZ1bmN9KTtcbiAgICAgICAgLy8gc2V0dXAgc3JjIHByb3B0ZXJ0eVxuICAgICAgICBzcmNwcm9wLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuc3JjcHJvcF9yZWdpc3RlcihcInNyY1wiKTtcbiAgICAgICAgLy8gaW5pdGlhbGl6ZVxuICAgICAgICB0aGlzLnNyYyA9IHNyYztcbiAgICB9XG5cbiAgICBzcmNwcm9wX2NoZWNrKHByb3BOYW1lLCBzcmMpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIHN0YXRlIHByb3ZpZGVyICR7c3JjfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNyYzsgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzcmNwcm9wX29uY2hhbmdlKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleCA9PSB1bmRlZmluZWQgfHwgZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4ID0gbmV3IE5lYXJieUluZGV4U2ltcGxlKHRoaXMuc3JjKVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIik7XG4gICAgICAgIH0gICAgICAgIFxuICAgIH1cbn1cbnNyY3Byb3AuYWRkVG9Qcm90b3R5cGUoSW5wdXRMYXllci5wcm90b3R5cGUpO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElOUFVUIExBWUVSIENBQ0hFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgTGF5ZXIgd2l0aCBhIFN0YXRlUHJvdmlkZXIgdXNlcyBhIHNwZWNpZmljIGNhY2hlIGltcGxlbWVudGF0aW9uLiAgICBcblxuICAgIFRoZSBjYWNoZSB3aWxsIGluc3RhbnRpYXRlIHNlZ21lbnRzIGNvcnJlc3BvbmRpbmcgdG9cbiAgICBpdGVtcyBpbiB0aGUgaW5kZXguIFxuKi9cblxuZXhwb3J0IGNsYXNzIElucHV0TGF5ZXJDYWNoZSB7XG4gICAgY29uc3RydWN0b3IobGF5ZXIpIHtcbiAgICAgICAgLy8gbGF5ZXJcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgLy8gY2FjaGVkIG5lYXJieSBvYmplY3RcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjYWNoZWQgc2VnbWVudFxuICAgICAgICB0aGlzLl9zZWdtZW50ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBjb25zdCBjYWNoZV9taXNzID0gKFxuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgIWludGVydmFsLmNvdmVyc19wb2ludCh0aGlzLl9uZWFyYnkuaXR2LCBvZmZzZXQpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChjYWNoZV9taXNzKSB7XG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPSB0aGlzLl9sYXllci5pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgICAgIGxldCB7aXR2LCBjZW50ZXJ9ID0gdGhpcy5fbmVhcmJ5O1xuICAgICAgICAgICAgdGhpcy5fc2VnbWVudHMgPSBjZW50ZXIubWFwKChpdGVtKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxvYWRfc2VnbWVudChpdHYsIGl0ZW0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gcXVlcnkgc2VnbWVudHNcbiAgICAgICAgY29uc3Qgc3RhdGVzID0gdGhpcy5fc2VnbWVudHMubWFwKChzZWcpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBzZWcucXVlcnkob2Zmc2V0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0b1N0YXRlKHRoaXMuX3NlZ21lbnRzLCBzdGF0ZXMsIG9mZnNldCwgdGhpcy5fbGF5ZXIucXVlcnlPcHRpb25zKVxuICAgIH1cblxuICAgIGNsZWFyKCkge1xuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTE9BRCBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmZ1bmN0aW9uIGxvYWRfc2VnbWVudChpdHYsIGl0ZW0pIHtcbiAgICBsZXQge3R5cGU9XCJzdGF0aWNcIiwgZGF0YX0gPSBpdGVtO1xuICAgIGlmICh0eXBlID09IFwic3RhdGljXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LlN0YXRpY1NlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJ0cmFuc2l0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LlRyYW5zaXRpb25TZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwiaW50ZXJwb2xhdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5JbnRlcnBvbGF0aW9uU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5Nb3Rpb25TZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJ1bnJlY29nbml6ZWQgc2VnbWVudCB0eXBlXCIsIHR5cGUpO1xuICAgIH1cbn1cblxuXG5cbiIsImltcG9ydCB7IGVuZHBvaW50LCBpbnRlcnZhbCB9IGZyb20gXCIuLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuLi9uZWFyYnlpbmRleC5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi4vbGF5ZXJzLmpzXCJcbmltcG9ydCAqIGFzIHNyY3Byb3AgZnJvbSBcIi4uL2FwaV9zcmNwcm9wLmpzXCI7XG5cblxuLyoqXG4gKiBDb252ZW5pZW5jZSBtZXJnZSBvcHRpb25zXG4gKi9cbmNvbnN0IG1lcmdlX29wdGlvbnMgPSB7XG4gICAgc3VtOiB7XG4gICAgICAgIHZhbHVlRnVuYzogZnVuY3Rpb24gKGluZm8pIHtcbiAgICAgICAgICAgIC8vIHJldHVybnMgdGhlIHN1bSBvZiB2YWx1ZXMgb2YgYWN0aXZlIGxheWVyc1xuICAgICAgICAgICAgcmV0dXJuIGluZm8uc3RhdGVzXG4gICAgICAgICAgICAgICAgLm1hcChzdGF0ZSA9PiBzdGF0ZS52YWx1ZSkgXG4gICAgICAgICAgICAgICAgLnJlZHVjZSgoYWNjLCB2YWx1ZSkgPT4gYWNjICsgdmFsdWUsIDApO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBzdGFjazoge1xuICAgICAgICBzdGF0ZUZ1bmM6IGZ1bmN0aW9uIChpbmZvKSB7XG4gICAgICAgICAgICAvLyByZXR1cm5zIHZhbHVlcyBmcm9tIGZpcnN0IGFjdGl2ZSBsYXllclxuICAgICAgICAgICAgcmV0dXJuIHsuLi5pbmZvLnN0YXRlc1swXX1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgYXJyYXk6IHtcbiAgICAgICAgdmFsdWVGdW5jOiBmdW5jdGlvbiAoaW5mbykge1xuICAgICAgICAgICAgLy8gcmV0dXJucyBhbiBhcnJheSB3aXRoIHZhbHVlcyBmcm9tIGFjdGl2ZSBsYXllcnNcbiAgICAgICAgICAgIHJldHVybiBpbmZvLnN0YXRlcy5tYXAoc3RhdGUgPT4gc3RhdGUudmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKlxuICogXG4gKiBUaGlzIGltcGxlbWVudHMgYSBtZXJnZSBvcGVyYXRpb24gZm9yIGxheWVycy5cbiAqIExpc3Qgb2Ygc291cmNlcyBpcyBpbW11dGFibGUuXG4gKiBcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gbWVyZ2UgKHNvdXJjZXMsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7dHlwZT1cIlwifSA9IG9wdGlvbnM7XG5cbiAgICBpZiAodHlwZSBpbiBtZXJnZV9vcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBuZXcgTWVyZ2VMYXllcihzb3VyY2VzLCBtZXJnZV9vcHRpb25zW3R5cGVdKVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgTWVyZ2VMYXllcihzb3VyY2VzLCBvcHRpb25zKTtcbiAgICB9XG59XG5cblxuY2xhc3MgTWVyZ2VMYXllciBleHRlbmRzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKHNvdXJjZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAgICAgLy8gc2V0dXAgc291cmNlcyBwcm9wZXJ0eVxuICAgICAgICBzcmNwcm9wLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuc3JjcHJvcF9yZWdpc3RlcihcInNvdXJjZXNcIiwge211dGFibGU6ZmFsc2V9KTtcbiAgICAgICAgdGhpcy5zb3VyY2VzID0gc291cmNlcztcbiAgICB9XG5cbiAgICBzcmNwcm9wX2NoZWNrKHByb3BOYW1lLCBzb3VyY2VzKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNvdXJjZXNcIikge1xuICAgICAgICAgICAgLy8gY2hlY2sgdGhhdCBzb3VyY2VzIGlzIGFycmF5IG9mIGxheWVyc1xuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHNvdXJjZXMpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzb3VyY2VzIG11c3QgYmUgYXJyYXkgJHtzb3VyY2VzfWApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBhbGxfbGF5ZXJzID0gc291cmNlcy5tYXAoKGUpID0+IGUgaW5zdGFuY2VvZiBMYXllcikuZXZlcnkoZSA9PiBlKTtcbiAgICAgICAgICAgIGlmICghYWxsX2xheWVycykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgc291cmNlcyBtdXN0IGFsbCBiZSBsYXllcnMgJHtzb3VyY2VzfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzb3VyY2VzO1xuICAgIH1cblxuICAgIHNyY3Byb3Bfb25jaGFuZ2UocHJvcE5hbWUsIGVBcmcpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic291cmNlc1wiKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleCA9PSB1bmRlZmluZWQgfHwgZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4ID0gbmV3IE1lcmdlSW5kZXgodGhpcy5zb3VyY2VzKVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIik7XG4gICAgICAgIH1cbiAgICB9XG59XG5zcmNwcm9wLmFkZFRvUHJvdG90eXBlKE1lcmdlTGF5ZXIucHJvdG90eXBlKTtcblxuXG5cblxuXG4vKipcbiAqIE1lcmdpbmcgaW5kZXhlcyBmcm9tIG11bHRpcGxlIHNvdXJjZXMgaW50byBhIHNpbmdsZSBpbmRleC5cbiAqIFxuICogQSBzb3VyY2UgaXMgYW4gb2JqZWN0IHdpdGggYW4gaW5kZXguXG4gKiAtIGxheWVyIChjdXJzb3IpXG4gKiBcbiAqIFRoZSBtZXJnZWQgaW5kZXggZ2l2ZXMgYSB0ZW1wb3JhbCBzdHJ1Y3R1cmUgZm9yIHRoZVxuICogY29sbGVjdGlvbiBvZiBzb3VyY2VzLCBjb21wdXRpbmcgYSBsaXN0IG9mXG4gKiBzb3VyY2VzIHdoaWNoIGFyZSBkZWZpbmVkIGF0IGEgZ2l2ZW4gb2Zmc2V0XG4gKiBcbiAqIG5lYXJieShvZmZzZXQpLmNlbnRlciBpcyBhIGxpc3Qgb2YgaXRlbXNcbiAqIFt7aXR2LCBzcmN9XVxuICogXG4gKiBJbXBsZW1lbnRhaW9uIGlzIHN0YXRlbGVzcy5cbiAqL1xuXG5mdW5jdGlvbiBjbXBfYXNjZW5kaW5nKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludC5jbXAocDEsIHAyKVxufVxuXG5mdW5jdGlvbiBjbXBfZGVzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAyLCBwMSlcbn1cblxuZXhwb3J0IGNsYXNzIE1lcmdlSW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Ioc291cmNlcykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9zb3VyY2VzID0gc291cmNlcztcbiAgICAgICAgdGhpcy5fY2FjaGVzID0gbmV3IE1hcChzb3VyY2VzLm1hcCgoc3JjKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3NyYywgc3JjLmdldENhY2hlKCldO1xuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBvZmZzZXQgPSB0aGlzLmNoZWNrKG9mZnNldCk7XG4gICAgICAgIC8vIGFjY3VtdWxhdGUgbmVhcmJ5IGZyb20gYWxsIHNvdXJjZXNcbiAgICAgICAgY29uc3QgcHJldl9saXN0ID0gW10sIG5leHRfbGlzdCA9IFtdO1xuICAgICAgICBjb25zdCBjZW50ZXJfbGlzdCA9IFtdO1xuICAgICAgICBjb25zdCBjZW50ZXJfaGlnaF9saXN0ID0gW107XG4gICAgICAgIGNvbnN0IGNlbnRlcl9sb3dfbGlzdCA9IFtdXG4gICAgICAgIGZvciAobGV0IHNyYyBvZiB0aGlzLl9zb3VyY2VzKSB7XG4gICAgICAgICAgICBsZXQge3ByZXYsIGNlbnRlciwgbmV4dCwgaXR2fSA9IHNyYy5pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgICAgIGlmIChwcmV2WzBdID4gLUluZmluaXR5KSBwcmV2X2xpc3QucHVzaChwcmV2KTsgICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChuZXh0WzBdIDwgSW5maW5pdHkpIG5leHRfbGlzdC5wdXNoKG5leHQpO1xuICAgICAgICAgICAgaWYgKGNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY2VudGVyX2xpc3QucHVzaCh0aGlzLl9jYWNoZXMuZ2V0KHNyYykpO1xuICAgICAgICAgICAgICAgIGxldCBbbG93LCBoaWdoXSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAgICAgICAgICAgICBjZW50ZXJfaGlnaF9saXN0LnB1c2goaGlnaCk7XG4gICAgICAgICAgICAgICAgY2VudGVyX2xvd19saXN0LnB1c2gobG93KTsgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIGZpbmQgY2xvc2VzdCBlbmRwb2ludCB0byB0aGUgcmlnaHQgKG5vdCBpbiBjZW50ZXIpXG4gICAgICAgIG5leHRfbGlzdC5zb3J0KGNtcF9hc2NlbmRpbmcpO1xuICAgICAgICBjb25zdCBtaW5fbmV4dF9sb3cgPSBuZXh0X2xpc3RbMF0gfHwgW0luZmluaXR5LCAwXTtcblxuICAgICAgICAvLyBmaW5kIGNsb3Nlc3QgZW5kcG9pbnQgdG8gdGhlIGxlZnQgKG5vdCBpbiBjZW50ZXIpXG4gICAgICAgIHByZXZfbGlzdC5zb3J0KGNtcF9kZXNjZW5kaW5nKTtcbiAgICAgICAgY29uc3QgbWF4X3ByZXZfaGlnaCA9IHByZXZfbGlzdFswXSB8fCBbLUluZmluaXR5LCAwXTtcblxuICAgICAgICAvLyBuZWFyYnlcbiAgICAgICAgbGV0IGxvdywgaGlnaDsgXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgICAgICAgIGNlbnRlcjogY2VudGVyX2xpc3QsIFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNlbnRlcl9saXN0Lmxlbmd0aCA9PSAwKSB7XG5cbiAgICAgICAgICAgIC8vIGVtcHR5IGNlbnRlclxuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gbWluX25leHRfbG93OyAgICAgICBcbiAgICAgICAgICAgIHJlc3VsdC5uZXh0ID0gbWluX25leHRfbG93O1xuICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSBtYXhfcHJldl9oaWdoO1xuICAgICAgICAgICAgcmVzdWx0LnByZXYgPSBtYXhfcHJldl9oaWdoO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBub24tZW1wdHkgY2VudGVyXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIGNlbnRlciBoaWdoXG4gICAgICAgICAgICBjZW50ZXJfaGlnaF9saXN0LnNvcnQoY21wX2FzY2VuZGluZyk7XG4gICAgICAgICAgICBsZXQgbWluX2NlbnRlcl9oaWdoID0gY2VudGVyX2hpZ2hfbGlzdFswXTtcbiAgICAgICAgICAgIGxldCBtYXhfY2VudGVyX2hpZ2ggPSBjZW50ZXJfaGlnaF9saXN0LnNsaWNlKC0xKVswXTtcbiAgICAgICAgICAgIGxldCBtdWx0aXBsZV9jZW50ZXJfaGlnaCA9ICFlbmRwb2ludC5lcShtaW5fY2VudGVyX2hpZ2gsIG1heF9jZW50ZXJfaGlnaClcblxuICAgICAgICAgICAgLy8gY2VudGVyIGxvd1xuICAgICAgICAgICAgY2VudGVyX2xvd19saXN0LnNvcnQoY21wX2Rlc2NlbmRpbmcpO1xuICAgICAgICAgICAgbGV0IG1heF9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0WzBdO1xuICAgICAgICAgICAgbGV0IG1pbl9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0LnNsaWNlKC0xKVswXTtcbiAgICAgICAgICAgIGxldCBtdWx0aXBsZV9jZW50ZXJfbG93ID0gIWVuZHBvaW50LmVxKG1heF9jZW50ZXJfbG93LCBtaW5fY2VudGVyX2xvdylcblxuICAgICAgICAgICAgLy8gbmV4dC9yaWdodFxuICAgICAgICAgICAgaWYgKGVuZHBvaW50LmxlKG1pbl9uZXh0X2xvdywgbWluX2NlbnRlcl9oaWdoKSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IG1pbl9uZXh0X2xvdztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gZW5kcG9pbnQuZmxpcChtaW5fY2VudGVyX2hpZ2gsIFwibG93XCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQubmV4dCA9IChtdWx0aXBsZV9jZW50ZXJfaGlnaCkgPyByZXN1bHQucmlnaHQgOiBtaW5fbmV4dF9sb3c7XG5cbiAgICAgICAgICAgIC8vIHByZXYvbGVmdFxuICAgICAgICAgICAgaWYgKGVuZHBvaW50LmdlKG1heF9wcmV2X2hpZ2gsIG1heF9jZW50ZXJfbG93KSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gbWF4X3ByZXZfaGlnaDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSBlbmRwb2ludC5mbGlwKG1heF9jZW50ZXJfbG93LCBcImhpZ2hcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQucHJldiA9IChtdWx0aXBsZV9jZW50ZXJfbG93KSA/IHJlc3VsdC5sZWZ0IDogbWF4X3ByZXZfaGlnaDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW50ZXJ2YWwgZnJvbSBsZWZ0L3JpZ2h0XG4gICAgICAgIGxvdyA9IGVuZHBvaW50LmZsaXAocmVzdWx0LmxlZnQsIFwibG93XCIpO1xuICAgICAgICBoaWdoID0gZW5kcG9pbnQuZmxpcChyZXN1bHQucmlnaHQsIFwiaGlnaFwiKTtcbiAgICAgICAgcmVzdWx0Lml0diA9IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59O1xuXG4iLCJpbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi4vbmVhcmJ5aW5kZXguanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVycy5qc1wiXG5pbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuLi9hcGlfc3JjcHJvcC5qc1wiO1xuXG5mdW5jdGlvbiBzaGlmdGVkKHAsIG9mZnNldCkge1xuICAgIGlmIChwID09IHVuZGVmaW5lZCB8fCAhaXNGaW5pdGUocCkpIHtcbiAgICAgICAgLy8gcCAtIG5vIHNrZXdcbiAgICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBwID09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgLy8gcCBpcyBudW1iZXIgLSBza2V3XG4gICAgICAgIHJldHVybiBwICsgb2Zmc2V0O1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwKSAmJiBwLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgLy8gcCBpcyBlbmRwb2ludCAtIHNrZXcgdmFsdWVcbiAgICAgICAgbGV0IFt2YWwsIHNpZ25dID0gcDtcbiAgICAgICAgcmV0dXJuIFt2YWwgKyBvZmZzZXQsIHNpZ25dO1xuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU0hJRlQgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuY2xhc3MgU2hpZnRJbmRleCBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvciAobGF5ZXIsIHNrZXcpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgdGhpcy5fc2tldyA9IHNrZXc7XG4gICAgICAgIHRoaXMuX2NhY2hlID0gbGF5ZXIuZ2V0Q2FjaGUoKTtcblxuICAgICAgICAvLyBza2V3aW5nIGNhY2hlIG9iamVjdFxuICAgICAgICB0aGlzLl9zaGlmdGVkX2NhY2hlID0ge1xuICAgICAgICAgICAgcXVlcnk6IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICAgICAgICAgICAgICAvLyBza2V3IHF1ZXJ5IChuZWdhdGl2ZSkgLSBvdmVycmlkZSByZXN1bHQgb2Zmc2V0XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsuLi50aGlzLl9jYWNoZS5xdWVyeShzaGlmdGVkKG9mZnNldCwgLXRoaXMuX3NrZXcpKSwgb2Zmc2V0fTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIHNrZXdpbmcgaW5kZXgubmVhcmJ5XG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICAvLyBza2V3IHF1ZXJ5IChuZWdhdGl2ZSlcbiAgICAgICAgY29uc3QgbmVhcmJ5ID0gdGhpcy5fbGF5ZXIuaW5kZXgubmVhcmJ5KHNoaWZ0ZWQob2Zmc2V0LCAtdGhpcy5fc2tldykpO1xuICAgICAgICAvLyBza2V3IHJlc3VsdCAocG9zaXRpdmUpIFxuICAgICAgICBjb25zdCBpdHYgPSBuZWFyYnkuaXR2LnNsaWNlKCk7XG4gICAgICAgIGl0dlswXSA9IHNoaWZ0ZWQobmVhcmJ5Lml0dlswXSwgdGhpcy5fc2tldyk7XG4gICAgICAgIGl0dlsxXSA9IHNoaWZ0ZWQobmVhcmJ5Lml0dlsxXSwgdGhpcy5fc2tldylcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGl0dixcbiAgICAgICAgICAgIGxlZnQ6IHNoaWZ0ZWQobmVhcmJ5LmxlZnQsIHRoaXMuX3NrZXcpLFxuICAgICAgICAgICAgcmlnaHQ6IHNoaWZ0ZWQobmVhcmJ5LnJpZ2h0LCB0aGlzLl9za2V3KSxcbiAgICAgICAgICAgIG5leHQ6IHNoaWZ0ZWQobmVhcmJ5Lm5leHQsIHRoaXMuX3NrZXcpLFxuICAgICAgICAgICAgcHJldjogc2hpZnRlZChuZWFyYnkucHJldiwgdGhpcy5fc2tldyksXG4gICAgICAgICAgICBjZW50ZXI6IG5lYXJieS5jZW50ZXIubWFwKCgpID0+IHRoaXMuX3NoaWZ0ZWRfY2FjaGUpXG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNISUZUIExBWUVSXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuY2xhc3MgU2hpZnRMYXllciBleHRlbmRzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKGxheWVyLCBza2V3LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgICB0aGlzLl9za2V3ID0gc2tldztcbiAgICAgICAgLy8gc2V0dXAgc3JjIHByb3B0ZXJ0eVxuICAgICAgICBzcmNwcm9wLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuc3JjcHJvcF9yZWdpc3RlcihcInNyY1wiKTtcbiAgICAgICAgdGhpcy5zcmMgPSBsYXllcjtcbiAgICB9XG5cbiAgICBzcmNwcm9wX2NoZWNrKHByb3BOYW1lLCBzcmMpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIExheWVyICR7c3JjfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNyYzsgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzcmNwcm9wX29uY2hhbmdlKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleCA9PSB1bmRlZmluZWQgfHwgZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4ID0gbmV3IFNoaWZ0SW5kZXgodGhpcy5zcmMsIHRoaXMuX3NrZXcpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgdGhpcy5jbGVhckNhY2hlcygpO1xuICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiKTsgICAgXG4gICAgICAgIH1cbiAgICB9XG59XG5zcmNwcm9wLmFkZFRvUHJvdG90eXBlKFNoaWZ0TGF5ZXIucHJvdG90eXBlKTtcblxuLyoqXG4gKiBTa2V3aW5nIGEgTGF5ZXIgYnkgYW4gb2Zmc2V0XG4gKiBcbiAqIGEgcG9zaXRpdmUgdmFsdWUgZm9yIG9mZnNldCBtZWFucyB0aGF0XG4gKiB0aGUgbGF5ZXIgaXMgc2hpZnRlZCB0byB0aGUgcmlnaHQgb24gdGhlIHRpbWVsaW5lXG4gKiBcbiAqIFxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBzaGlmdCAobGF5ZXIsIG9mZnNldCkge1xuICAgIHJldHVybiBuZXcgU2hpZnRMYXllcihsYXllciwgb2Zmc2V0KTtcbn1cbiIsImltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL2FwaV9jYWxsYmFjay5qc1wiO1xuaW1wb3J0IHsgQ0xPQ0sgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENMT0NLIFBST1ZJREVSIEJBU0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogQmFzZSBjbGFzcyBmb3IgQ2xvY2tQcm92aWRlcnNcbiAqIFxuICogQ2xvY2sgUHJvdmlkZXJzIGltcGxlbWVudCB0aGUgY2FsbGJhY2tcbiAqIGludGVyZmFjZSB0byBiZSBjb21wYXRpYmxlIHdpdGggb3RoZXIgc3RhdGVcbiAqIHByb3ZpZGVycywgZXZlbiB0aG91Z2ggdGhleSBhcmUgbm90IHJlcXVpcmVkIHRvXG4gKiBwcm92aWRlIGFueSBjYWxsYmFja3MgYWZ0ZXIgY2xvY2sgYWRqdXN0bWVudHNcbiAqL1xuXG5leHBvcnQgY2xhc3MgQ2xvY2tQcm92aWRlckJhc2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBjYWxsYmFjay5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgIH1cbiAgICBub3cgKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoQ2xvY2tQcm92aWRlckJhc2UucHJvdG90eXBlKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExPQ0FMIENMT0NLIFBST1ZJREVSXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jbGFzcyBMb2NhbENsb2NrUHJvdmlkZXIgZXh0ZW5kcyBDbG9ja1Byb3ZpZGVyQmFzZSB7XG4gICAgbm93ICgpIHtcbiAgICAgICAgcmV0dXJuIENMT0NLLm5vdygpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNvbnN0IGxvY2FsQ2xvY2tQcm92aWRlciA9IG5ldyBMb2NhbENsb2NrUHJvdmlkZXIoKTtcbiIsIlxuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX2Jhc2VzXCI7XG5jb25zdCBNRVRIT0RTID0ge2Fzc2lnbiwgbW92ZSwgdHJhbnNpdGlvbiwgaW50ZXJwb2xhdGV9O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBjbWQgKHRhcmdldCkge1xuICAgIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhcmdldC5zcmMgbXVzdCBiZSBzdGF0ZXByb3ZpZGVyICR7dGFyZ2V0fWApO1xuICAgIH1cbiAgICBsZXQgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKE1FVEhPRFMpXG4gICAgICAgIC5tYXAoKFtuYW1lLCBtZXRob2RdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oLi4uYXJncykgeyBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGl0ZW1zID0gbWV0aG9kLmNhbGwodGhpcywgLi4uYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXQudXBkYXRlKGl0ZW1zKTsgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhlbnRyaWVzKTtcbn1cblxuZnVuY3Rpb24gYXNzaWduKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IGl0ZW0gPSB7XG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2YWx1ZSAgICAgICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtpdGVtXTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG1vdmUodmVjdG9yKSB7XG4gICAgbGV0IGl0ZW0gPSB7XG4gICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICBkYXRhOiB2ZWN0b3IgIFxuICAgIH1cbiAgICByZXR1cm4gW2l0ZW1dO1xufVxuXG5mdW5jdGlvbiB0cmFuc2l0aW9uKHYwLCB2MSwgdDAsIHQxLCBlYXNpbmcpIHtcbiAgICBsZXQgaXRlbXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgdDAsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MCwgdDEsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwidHJhbnNpdGlvblwiLFxuICAgICAgICAgICAgZGF0YToge3YwLCB2MSwgdDAsIHQxLCBlYXNpbmd9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdjFcbiAgICAgICAgfVxuICAgIF1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKHR1cGxlcykge1xuICAgIGxldCBbdjAsIHQwXSA9IHR1cGxlc1swXTtcbiAgICBsZXQgW3YxLCB0MV0gPSB0dXBsZXNbdHVwbGVzLmxlbmd0aC0xXTtcblxuICAgIGxldCBpdGVtcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYwXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJpbnRlcnBvbGF0aW9uXCIsXG4gICAgICAgICAgICBkYXRhOiB0dXBsZXNcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDEsIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MVxuICAgICAgICB9XG4gICAgXSAgICBcbiAgICByZXR1cm4gaXRlbXM7XG59XG5cblxuXG4iLCJpbXBvcnQge2Rpdm1vZH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuXG4vKlxuICAgIFRpbWVvdXQgTW9uaXRvclxuXG4gICAgVGltZW91dCBNb25pdG9yIGlzIHNpbWlsYXIgdG8gc2V0SW50ZXJ2YWwsIGluIHRoZSBzZW5zZSB0aGF0IFxuICAgIGl0IGFsbG93cyBjYWxsYmFja3MgdG8gYmUgZmlyZWQgcGVyaW9kaWNhbGx5IFxuICAgIHdpdGggYSBnaXZlbiBkZWxheSAoaW4gbWlsbGlzKS4gIFxuICAgIFxuICAgIFRpbWVvdXQgTW9uaXRvciBpcyBtYWRlIHRvIHNhbXBsZSB0aGUgc3RhdGUgXG4gICAgb2YgYSBkeW5hbWljIG9iamVjdCwgcGVyaW9kaWNhbGx5LiBGb3IgdGhpcyByZWFzb24sIGVhY2ggY2FsbGJhY2sgaXMgXG4gICAgYm91bmQgdG8gYSBtb25pdG9yZWQgb2JqZWN0LCB3aGljaCB3ZSBoZXJlIGNhbGwgYSB2YXJpYWJsZS4gXG4gICAgT24gZWFjaCBpbnZvY2F0aW9uLCBhIGNhbGxiYWNrIHdpbGwgcHJvdmlkZSBhIGZyZXNobHkgc2FtcGxlZCBcbiAgICB2YWx1ZSBmcm9tIHRoZSB2YXJpYWJsZS5cblxuICAgIFRoaXMgdmFsdWUgaXMgYXNzdW1lZCB0byBiZSBhdmFpbGFibGUgYnkgcXVlcnlpbmcgdGhlIHZhcmlhYmxlLiBcblxuICAgICAgICB2LnF1ZXJ5KCkgLT4ge3ZhbHVlLCBkeW5hbWljLCBvZmZzZXQsIHRzfVxuXG4gICAgSW4gYWRkaXRpb24sIHRoZSB2YXJpYWJsZSBvYmplY3QgbWF5IHN3aXRjaCBiYWNrIGFuZCBcbiAgICBmb3J0aCBiZXR3ZWVuIGR5bmFtaWMgYW5kIHN0YXRpYyBiZWhhdmlvci4gVGhlIFRpbWVvdXQgTW9uaXRvclxuICAgIHR1cm5zIHBvbGxpbmcgb2ZmIHdoZW4gdGhlIHZhcmlhYmxlIGlzIG5vIGxvbmdlciBkeW5hbWljLCBcbiAgICBhbmQgcmVzdW1lcyBwb2xsaW5nIHdoZW4gdGhlIG9iamVjdCBiZWNvbWVzIGR5bmFtaWMuXG5cbiAgICBTdGF0ZSBjaGFuZ2VzIGFyZSBleHBlY3RlZCB0byBiZSBzaWduYWxsZWQgdGhyb3VnaCBhIDxjaGFuZ2U+IGV2ZW50LlxuXG4gICAgICAgIHN1YiA9IHYub24oXCJjaGFuZ2VcIiwgY2FsbGJhY2spXG4gICAgICAgIHYub2ZmKHN1YilcblxuICAgIENhbGxiYWNrcyBhcmUgaW52b2tlZCBvbiBldmVyeSA8Y2hhbmdlPiBldmVudCwgYXMgd2VsbFxuICAgIGFzIHBlcmlvZGljYWxseSB3aGVuIHRoZSBvYmplY3QgaXMgaW4gPGR5bmFtaWM+IHN0YXRlLlxuXG4gICAgICAgIGNhbGxiYWNrKHt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0LCB0c30pXG5cbiAgICBGdXJ0aGVybW9yZSwgaW4gb3JkZXIgdG8gc3VwcG9ydCBjb25zaXN0ZW50IHJlbmRlcmluZyBvZlxuICAgIHN0YXRlIGNoYW5nZXMgZnJvbSBtYW55IGR5bmFtaWMgdmFyaWFibGVzLCBpdCBpcyBpbXBvcnRhbnQgdGhhdFxuICAgIGNhbGxiYWNrcyBhcmUgaW52b2tlZCBhdCB0aGUgc2FtZSB0aW1lIGFzIG11Y2ggYXMgcG9zc2libGUsIHNvXG4gICAgdGhhdCBjaGFuZ2VzIHRoYXQgb2NjdXIgbmVhciBpbiB0aW1lIGNhbiBiZSBwYXJ0IG9mIHRoZSBzYW1lXG4gICAgc2NyZWVuIHJlZnJlc2guIFxuXG4gICAgRm9yIHRoaXMgcmVhc29uLCB0aGUgVGltZW91dE1vbml0b3IgZ3JvdXBzIGNhbGxiYWNrcyBpbiB0aW1lXG4gICAgYW5kIGludm9rZXMgY2FsbGJhY2tzIGF0IGF0IGZpeGVkIG1heGltdW0gcmF0ZSAoMjBIei81MG1zKS5cbiAgICBUaGlzIGltcGxpZXMgdGhhdCBwb2xsaW5nIGNhbGxiYWNrcyB3aWxsIGZhbGwgb24gYSBzaGFyZWQgXG4gICAgcG9sbGluZyBmcmVxdWVuY3kuXG5cbiAgICBBdCB0aGUgc2FtZSB0aW1lLCBjYWxsYmFja3MgbWF5IGhhdmUgaW5kaXZpZHVhbCBmcmVxdWVuY2llcyB0aGF0XG4gICAgYXJlIG11Y2ggbG93ZXIgcmF0ZSB0aGFuIHRoZSBtYXhpbXVtIHJhdGUuIFRoZSBpbXBsZW1lbnRhdGlvblxuICAgIGRvZXMgbm90IHJlbHkgb24gYSBmaXhlZCA1MG1zIHRpbWVvdXQgZnJlcXVlbmN5LCBidXQgaXMgdGltZW91dCBiYXNlZCxcbiAgICB0aHVzIHRoZXJlIGlzIG5vIHByb2Nlc3Npbmcgb3IgdGltZW91dCBiZXR3ZWVuIGNhbGxiYWNrcywgZXZlblxuICAgIGlmIGFsbCBjYWxsYmFja3MgaGF2ZSBsb3cgcmF0ZXMuXG5cbiAgICBJdCBpcyBzYWZlIHRvIGRlZmluZSBtdWx0aXBsZSBjYWxsYWJhY2tzIGZvciBhIHNpbmdsZSB2YXJpYWJsZSwgZWFjaFxuICAgIGNhbGxiYWNrIHdpdGggYSBkaWZmZXJlbnQgcG9sbGluZyBmcmVxdWVuY3kuXG5cbiAgICBvcHRpb25zXG4gICAgICAgIDxyYXRlPiAtIGRlZmF1bHQgNTA6IHNwZWNpZnkgbWluaW11bSBmcmVxdWVuY3kgaW4gbXNcblxuKi9cblxuXG5jb25zdCBSQVRFX01TID0gNTBcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVElNRU9VVCBNT05JVE9SXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgQmFzZSBjbGFzcyBmb3IgVGltZW91dCBNb25pdG9yIGFuZCBGcmFtZXJhdGUgTW9uaXRvclxuKi9cblxuY2xhc3MgVGltZW91dE1vbml0b3Ige1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuXG4gICAgICAgIHRoaXMuX29wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtyYXRlOiBSQVRFX01TfSwgb3B0aW9ucyk7XG4gICAgICAgIGlmICh0aGlzLl9vcHRpb25zLnJhdGUgPCBSQVRFX01TKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlsbGVnYWwgcmF0ZSAke3JhdGV9LCBtaW5pbXVtIHJhdGUgaXMgJHtSQVRFX01TfWApO1xuICAgICAgICB9XG4gICAgICAgIC8qXG4gICAgICAgICAgICBtYXBcbiAgICAgICAgICAgIGhhbmRsZSAtPiB7Y2FsbGJhY2ssIHZhcmlhYmxlLCBkZWxheX1cbiAgICAgICAgICAgIC0gdmFyaWFibGU6IHRhcmdldCBmb3Igc2FtcGxpbmdcbiAgICAgICAgICAgIC0gY2FsbGJhY2s6IGZ1bmN0aW9uKHZhbHVlKVxuICAgICAgICAgICAgLSBkZWxheTogYmV0d2VlbiBzYW1wbGVzICh3aGVuIHZhcmlhYmxlIGlzIGR5bmFtaWMpXG4gICAgICAgICovXG4gICAgICAgIHRoaXMuX3NldCA9IG5ldyBTZXQoKTtcbiAgICAgICAgLypcbiAgICAgICAgICAgIHZhcmlhYmxlIG1hcFxuICAgICAgICAgICAgdmFyaWFibGUgLT4ge3N1YiwgcG9sbGluZywgaGFuZGxlczpbXX1cbiAgICAgICAgICAgIC0gc3ViIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICAgICAgICAgLSBwb2xsaW5nOiB0cnVlIGlmIHZhcmlhYmxlIG5lZWRzIHBvbGxpbmdcbiAgICAgICAgICAgIC0gaGFuZGxlczogbGlzdCBvZiBoYW5kbGVzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIC8vIHZhcmlhYmxlIGNoYW5nZSBoYW5kbGVyXG4gICAgICAgIHRoaXMuX19vbnZhcmlhYmxlY2hhbmdlID0gdGhpcy5fb252YXJpYWJsZWNoYW5nZS5iaW5kKHRoaXMpO1xuICAgIH1cblxuICAgIGJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgICAgICAvLyByZWdpc3RlciBiaW5kaW5nXG4gICAgICAgIGxldCBoYW5kbGUgPSB7Y2FsbGJhY2ssIHZhcmlhYmxlLCBkZWxheX07XG4gICAgICAgIHRoaXMuX3NldC5hZGQoaGFuZGxlKTtcbiAgICAgICAgLy8gcmVnaXN0ZXIgdmFyaWFibGVcbiAgICAgICAgaWYgKCF0aGlzLl92YXJpYWJsZV9tYXAuaGFzKHZhcmlhYmxlKSkge1xuICAgICAgICAgICAgbGV0IHN1YiA9IHZhcmlhYmxlLm9uKFwiY2hhbmdlXCIsIHRoaXMuX19vbnZhcmlhYmxlY2hhbmdlKTtcbiAgICAgICAgICAgIGxldCBpdGVtID0ge3N1YiwgcG9sbGluZzpmYWxzZSwgaGFuZGxlczogW2hhbmRsZV19O1xuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLnNldCh2YXJpYWJsZSwgaXRlbSk7XG4gICAgICAgICAgICAvL3RoaXMuX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKS5oYW5kbGVzLnB1c2goaGFuZGxlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaGFuZGxlO1xuICAgIH1cblxuICAgIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgICAgIC8vIGNsZWFudXBcbiAgICAgICAgbGV0IHJlbW92ZWQgPSB0aGlzLl9zZXQuZGVsZXRlKGhhbmRsZSk7XG4gICAgICAgIGlmICghcmVtb3ZlZCkgcmV0dXJuO1xuICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjbGVhbnVwIHZhcmlhYmxlIG1hcFxuICAgICAgICBsZXQgdmFyaWFibGUgPSBoYW5kbGUudmFyaWFibGU7XG4gICAgICAgIGxldCB7c3ViLCBoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQgaWR4ID0gaGFuZGxlcy5pbmRleE9mKGhhbmRsZSk7XG4gICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgaGFuZGxlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGFuZGxlcy5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgLy8gdmFyaWFibGUgaGFzIG5vIGhhbmRsZXNcbiAgICAgICAgICAgIC8vIGNsZWFudXAgdmFyaWFibGUgbWFwXG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuZGVsZXRlKHZhcmlhYmxlKTtcbiAgICAgICAgICAgIHZhcmlhYmxlLm9mZihzdWIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgdmFyaWFibGUgZW1pdHMgYSBjaGFuZ2UgZXZlbnRcbiAgICAqL1xuICAgIF9vbnZhcmlhYmxlY2hhbmdlIChlQXJnLCBlSW5mbykge1xuICAgICAgICBsZXQgdmFyaWFibGUgPSBlSW5mby5zcmM7XG4gICAgICAgIC8vIGRpcmVjdCBjYWxsYmFjayAtIGNvdWxkIHVzZSBlQXJnIGhlcmVcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQgc3RhdGUgPSBlQXJnO1xuICAgICAgICAvLyByZWV2YWx1YXRlIHBvbGxpbmdcbiAgICAgICAgdGhpcy5fcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlLCBzdGF0ZSk7XG4gICAgICAgIC8vIGNhbGxiYWNrc1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHN0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHN0YXJ0IG9yIHN0b3AgcG9sbGluZyBpZiBuZWVkZWRcbiAgICAqL1xuICAgIF9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUsIHN0YXRlKSB7XG4gICAgICAgIGxldCBpdGVtID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCB7cG9sbGluZzp3YXNfcG9sbGluZ30gPSBpdGVtO1xuICAgICAgICBzdGF0ZSA9IHN0YXRlIHx8IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgIGxldCBzaG91bGRfYmVfcG9sbGluZyA9IHN0YXRlLmR5bmFtaWM7XG4gICAgICAgIGlmICghd2FzX3BvbGxpbmcgJiYgc2hvdWxkX2JlX3BvbGxpbmcpIHtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dHModmFyaWFibGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHdhc19wb2xsaW5nICYmICFzaG91bGRfYmVfcG9sbGluZykge1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBzZXQgdGltZW91dCBmb3IgYWxsIGNhbGxiYWNrcyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAqL1xuICAgIF9zZXRfdGltZW91dHModmFyaWFibGUpIHtcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9zZXRfdGltZW91dChoYW5kbGUpIHtcbiAgICAgICAgbGV0IGRlbHRhID0gdGhpcy5fY2FsY3VsYXRlX2RlbHRhKGhhbmRsZS5kZWxheSk7XG4gICAgICAgIGxldCBoYW5kbGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlX3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBoYW5kbGUudGlkID0gc2V0VGltZW91dChoYW5kbGVyLCBkZWx0YSk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgYWRqdXN0IGRlbGF5IHNvIHRoYXQgaWYgZmFsbHMgb25cbiAgICAgICAgdGhlIG1haW4gdGljayByYXRlXG4gICAgKi9cbiAgICBfY2FsY3VsYXRlX2RlbHRhKGRlbGF5KSB7XG4gICAgICAgIGxldCByYXRlID0gdGhpcy5fb3B0aW9ucy5yYXRlO1xuICAgICAgICBsZXQgbm93ID0gTWF0aC5yb3VuZChwZXJmb3JtYW5jZS5ub3coKSk7XG4gICAgICAgIGxldCBbbm93X24sIG5vd19yXSA9IGRpdm1vZChub3csIHJhdGUpO1xuICAgICAgICBsZXQgW24sIHJdID0gZGl2bW9kKG5vdyArIGRlbGF5LCByYXRlKTtcbiAgICAgICAgbGV0IHRhcmdldCA9IE1hdGgubWF4KG4sIG5vd19uICsgMSkqcmF0ZTtcbiAgICAgICAgcmV0dXJuIHRhcmdldCAtIHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGNsZWFyIGFsbCB0aW1lb3V0cyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAqL1xuICAgIF9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSkge1xuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICBpZiAoaGFuZGxlLnRpZCAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoaGFuZGxlLnRpZCk7XG4gICAgICAgICAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGhhbmRsZSB0aW1lb3V0XG4gICAgKi9cbiAgICBfaGFuZGxlX3RpbWVvdXQoaGFuZGxlKSB7XG4gICAgICAgIC8vIGRyb3AgaWYgaGFuZGxlIHRpZCBoYXMgYmVlbiBjbGVhcmVkXG4gICAgICAgIGlmIChoYW5kbGUudGlkID09IHVuZGVmaW5lZCkgcmV0dXJuO1xuICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjYWxsYmFja1xuICAgICAgICBsZXQge3ZhcmlhYmxlfSA9IGhhbmRsZTtcbiAgICAgICAgbGV0IHN0YXRlID0gdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgLy8gcmVzY2hlZHVsZSB0aW1lb3V0cyBmb3IgY2FsbGJhY2tzXG4gICAgICAgIGlmIChzdGF0ZS5keW5hbWljKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICBtYWtlIHN1cmUgcG9sbGluZyBzdGF0ZSBpcyBhbHNvIGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcyB3b3VsZCBvbmx5IG9jY3VyIGlmIHRoZSB2YXJpYWJsZVxuICAgICAgICAgICAgICAgIHdlbnQgZnJvbSByZXBvcnRpbmcgZHluYW1pYyB0cnVlIHRvIGR5bmFtaWMgZmFsc2UsXG4gICAgICAgICAgICAgICAgd2l0aG91dCBlbW1pdHRpbmcgYSBjaGFuZ2UgZXZlbnQgLSB0aHVzXG4gICAgICAgICAgICAgICAgdmlvbGF0aW5nIHRoZSBhc3N1bXB0aW9uLiBUaGlzIHByZXNlcnZlc1xuICAgICAgICAgICAgICAgIGludGVybmFsIGludGVncml0eSBpIHRoZSBtb25pdG9yLlxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGxldCBpdGVtID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICAvL1xuICAgICAgICBoYW5kbGUuY2FsbGJhY2soc3RhdGUpO1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBGUkFNRVJBVEUgTU9OSVRPUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5cbmNsYXNzIEZyYW1lcmF0ZU1vbml0b3IgZXh0ZW5kcyBUaW1lb3V0TW9uaXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgICB0aGlzLl9oYW5kbGU7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgdGltZW91dHMgYXJlIG9ic29sZXRlXG4gICAgKi9cbiAgICBfc2V0X3RpbWVvdXRzKHZhcmlhYmxlKSB7fVxuICAgIF9zZXRfdGltZW91dChoYW5kbGUpIHt9XG4gICAgX2NhbGN1bGF0ZV9kZWx0YShkZWxheSkge31cbiAgICBfY2xlYXJfdGltZW91dHModmFyaWFibGUpIHt9XG4gICAgX2hhbmRsZV90aW1lb3V0KGhhbmRsZSkge31cblxuICAgIF9vbnZhcmlhYmxlY2hhbmdlIChlQXJnLCBlSW5mbykge1xuICAgICAgICBzdXBlci5fb252YXJpYWJsZWNoYW5nZShlQXJnLCBlSW5mbyk7XG4gICAgICAgIC8vIGtpY2sgb2ZmIGNhbGxiYWNrIGxvb3AgZHJpdmVuIGJ5IHJlcXVlc3QgYW5pbWF0aW9uZnJhbWVcbiAgICAgICAgdGhpcy5fY2FsbGJhY2soKTtcbiAgICB9XG5cbiAgICBfY2FsbGJhY2soKSB7XG4gICAgICAgIC8vIGNhbGxiYWNrIHRvIGFsbCB2YXJpYWJsZXMgd2hpY2ggcmVxdWlyZSBwb2xsaW5nXG4gICAgICAgIGxldCB2YXJpYWJsZXMgPSBbLi4udGhpcy5fdmFyaWFibGVfbWFwLmVudHJpZXMoKV1cbiAgICAgICAgICAgIC5maWx0ZXIoKFt2YXJpYWJsZSwgaXRlbV0pID0+IGl0ZW0ucG9sbGluZylcbiAgICAgICAgICAgIC5tYXAoKFt2YXJpYWJsZSwgaXRlbV0pID0+IHZhcmlhYmxlKTtcbiAgICAgICAgaWYgKHZhcmlhYmxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBjYWxsYmFja1xuICAgICAgICAgICAgZm9yIChsZXQgdmFyaWFibGUgb2YgdmFyaWFibGVzKSB7XG4gICAgICAgICAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICAgICAgICAgIGxldCByZXMgPSB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZS5jYWxsYmFjayhyZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8qIFxuICAgICAgICAgICAgICAgIHJlcXVlc3QgbmV4dCBjYWxsYmFjayBhcyBsb25nIGFzIGF0IGxlYXN0IG9uZSB2YXJpYWJsZSBcbiAgICAgICAgICAgICAgICBpcyByZXF1aXJpbmcgcG9sbGluZ1xuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLl9jYWxsYmFjay5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQklORCBSRUxFQVNFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmNvbnN0IG1vbml0b3IgPSBuZXcgVGltZW91dE1vbml0b3IoKTtcbmNvbnN0IGZyYW1lcmF0ZV9tb25pdG9yID0gbmV3IEZyYW1lcmF0ZU1vbml0b3IoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgIGxldCBoYW5kbGU7XG4gICAgaWYgKEJvb2xlYW4ocGFyc2VGbG9hdChkZWxheSkpKSB7XG4gICAgICAgIGhhbmRsZSA9IG1vbml0b3IuYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIFtcInRpbWVvdXRcIiwgaGFuZGxlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBoYW5kbGUgPSBmcmFtZXJhdGVfbW9uaXRvci5iaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgMCwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBbXCJmcmFtZXJhdGVcIiwgaGFuZGxlXTtcbiAgICB9XG59XG5leHBvcnQgZnVuY3Rpb24gcmVsZWFzZShoYW5kbGUpIHtcbiAgICBsZXQgW3R5cGUsIF9oYW5kbGVdID0gaGFuZGxlO1xuICAgIGlmICh0eXBlID09IFwidGltZW91dFwiKSB7XG4gICAgICAgIHJldHVybiBtb25pdG9yLnJlbGVhc2UoX2hhbmRsZSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwiZnJhbWVyYXRlXCIpIHtcbiAgICAgICAgcmV0dXJuIGZyYW1lcmF0ZV9tb25pdG9yLnJlbGVhc2UoX2hhbmRsZSk7XG4gICAgfVxufVxuXG4iLCJpbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuL2FwaV9zcmNwcm9wLmpzXCI7XG5pbXBvcnQgeyBDbG9ja1Byb3ZpZGVyQmFzZSwgbG9jYWxDbG9ja1Byb3ZpZGVyIH0gZnJvbSBcIi4vc3RhdGVwcm92aWRlcl9jbG9jay5qc1wiO1xuaW1wb3J0IHsgY21kIH0gZnJvbSBcIi4vY21kLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuL2xheWVycy5qc1wiO1xuaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IGJpbmQsIHJlbGVhc2UgfSBmcm9tIFwiLi9tb25pdG9yLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi9uZWFyYnlpbmRleC5qc1wiO1xuXG5cblxuLyoqXG4gKiBDdXJzb3IgZW11bGF0ZXMgTGF5ZXIgaW50ZXJmYWNlLlxuICogUGFydCBvZiB0aGlzIGlzIHRvIHByb3ZlIGFuIGluZGV4IGZvciB0aGUgdGltZWxpbmUuIFxuICogSG93ZXZlciwgd2hlbiBjb25zaWRlcmVkIGFzIGEgbGF5ZXIsIHRoZSBjdXJzb3IgdmFsdWUgaXMgXG4gKiBpbmRlcGVuZGVudCBvZiB0aW1lbGluZSBvZmZzZXQsIHdoaWNoIGlzIHRvIHNheSB0aGF0XG4gKiBpdCBoYXMgdGhlIHNhbWUgdmFsdWUgZm9yIGFsbCB0aW1lbGluZSBvZmZzZXRzLlxuICogXG4gKiBVbmxpa2Ugb3RoZXIgTGF5ZXJzLCB0aGUgQ3Vyc29yIGRvIG5vdCBhY3R1YWxseVxuICogdXNlIHRoaXMgaW5kZXggdG8gcmVzb2x2ZSBxdWVyaWVzLiBJdCBpcyBvbmx5IG5lZWRlZFxuICogZm9yIHNvbWUgZ2VuZXJpYyBMYXllciBmdW5jdGlvbm5hbGl0eSwgbGlrZSBzYW1wbGluZyxcbiAqIHdoaWNoIHVzZXMgaW5kZXguZmlyc3QoKSBhbmQgaW5kZXgubGFzdCgpLlxuICovXG5cbmNsYXNzIEN1cnNvckluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKGN1cnNvcikge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9jYWNoZSA9IGN1cnNvci5nZXRDYWNoZSgpO1xuICAgIH1cblxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgLy8gY3Vyc29yIGluZGV4IGlzIGRlZmluZWQgZm9yIGVudGlyZSB0aW1lbGluZVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICBjZW50ZXI6IFt0aGlzLl9jYWNoZV0sXG4gICAgICAgICAgICBsZWZ0OiBbLUluZmluaXR5LCAwXSxcbiAgICAgICAgICAgIHByZXY6IFstSW5maW5pdHksIDBdLFxuICAgICAgICAgICAgcmlnaHQ6IFtJbmZpbml0eSwgMF0sXG4gICAgICAgICAgICBuZXh0OiBbSW5maW5pdHksIDBdLFxuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIFxuICogQ3Vyc29yIGNhY2hlIGltcGxlbWVudHMgdGhlIHF1ZXJ5IG9wZXJhdGlvbiBmb3IgXG4gKiB0aGUgQ3Vyc29yLCBpZ25vcmluZyB0aGUgZ2l2ZW4gb2Zmc2V0LCByZXBsYWNpbmcgaXQgXG4gKiB3aXRoIGFuIG9mZnNldCBmcm9tIHRoZSBjdHJsIGluc3RlYWQuIFxuICogVGhlIGxheWVyIGNhY2hlIGlzIHVzZWQgdG8gcmVzb2x2ZSB0aGUgcXVlcnkgXG4gKi9cblxuY2xhc3MgQ3Vyc29yQ2FjaGUge1xuICAgIGNvbnN0cnVjdG9yKGN1cnNvcikge1xuICAgICAgICB0aGlzLl9jdXJzb3IgPSBjdXJzb3I7XG4gICAgICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fY3Vyc29yLnNyYy5nZXRDYWNoZSgpO1xuICAgIH1cblxuICAgIHF1ZXJ5KCkge1xuICAgICAgICBjb25zdCBvZmZzZXQgPSB0aGlzLl9jdXJzb3IuX2dldF9jdHJsX3N0YXRlKCkudmFsdWU7IFxuICAgICAgICByZXR1cm4gdGhpcy5fY2FjaGUucXVlcnkob2Zmc2V0KTtcbiAgICB9XG5cbiAgICBjbGVhcigpIHtcbiAgICAgICAgdGhpcy5fY2FjaGUuY2xlYXIoKTtcbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ1VSU09SXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFxuICogQ3Vyc29yIGdsaWRlcyBhbG9uZyBhIGxheWVyIGFuZCBleHBvc2VzIHRoZSBjdXJyZW50IGxheWVyXG4gKiB2YWx1ZSBhdCBhbnkgdGltZVxuICogLSBoYXMgbXV0YWJsZSBjdHJsIChsb2NhbENsb2NrUHJvdmlkZXIgb3IgQ3Vyc29yKVxuICogLSBoYXMgbXV0YWJsZSBzcmMgKGxheWVyKVxuICogLSBtZXRob2RzIGZvciBhc3NpZ24sIG1vdmUsIHRyYW5zaXRpb24sIGludGVycG9sYXRpb25cbiAqL1xuXG5leHBvcnQgY2xhc3MgQ3Vyc29yIGV4dGVuZHMgTGF5ZXIge1xuXG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoe0NhY2hlQ2xhc3M6Q3Vyc29yQ2FjaGV9KTtcblxuICAgICAgICAvLyBzZXR1cCBzcmMgcHJvcGVydGllc1xuICAgICAgICBzcmNwcm9wLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuc3JjcHJvcF9yZWdpc3RlcihcInNyY1wiKTtcbiAgICAgICAgdGhpcy5zcmNwcm9wX3JlZ2lzdGVyKFwiY3RybFwiKTtcblxuICAgICAgICAvLyB0aW1lb3V0XG4gICAgICAgIHRoaXMuX3RpZDtcbiAgICAgICAgLy8gcG9sbGluZ1xuICAgICAgICB0aGlzLl9waWQ7XG5cbiAgICAgICAgLy8gaW5pdGlhbGlzZSBjdHJsLCBzcmNcbiAgICAgICAgbGV0IHtzcmMsIGN0cmx9ID0gb3B0aW9ucztcbiAgICAgICAgdGhpcy5jdHJsID0gY3RybCB8fCBsb2NhbENsb2NrUHJvdmlkZXI7XG4gICAgICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogU1JDUFJPUDogQ1RSTCBhbmQgU1JDXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBzcmNwcm9wX2NoZWNrKHByb3BOYW1lLCBvYmopIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwiY3RybFwiKSB7XG4gICAgICAgICAgICBjb25zdCBvayA9IFtDbG9ja1Byb3ZpZGVyQmFzZSwgQ3Vyc29yXVxuICAgICAgICAgICAgICAgIC5tYXAoKGNsKSA9PiBvYmogaW5zdGFuY2VvZiBjbClcbiAgICAgICAgICAgICAgICAuc29tZShlPT5lID09IHRydWUpO1xuICAgICAgICAgICAgaWYgKCFvaykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJjdHJsXCIgbXVzdCBiZSBDbG9ja1Byb3ZpZGVyIG9yIEN1cnNvciAke29ian1gKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICghKG9iaiBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIExheWVyICR7b2JqfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuXG4gICAgc3JjcHJvcF9vbmNoYW5nZShwcm9wTmFtZSwgZUFyZykge1xuICAgICAgICB0aGlzLl9faGFuZGxlX2NoYW5nZShwcm9wTmFtZSwgZUFyZyk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBDQUxMQkFDS1xuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgX19oYW5kbGVfY2hhbmdlKG9yaWdpbiwgZUFyZykge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fdGlkKTtcbiAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLl9waWQpO1xuICAgICAgICBpZiAodGhpcy5zcmMgJiYgdGhpcy5jdHJsKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleCA9PSB1bmRlZmluZWQgfHwgZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICAvLyBOT1QgdXNlZCBmb3IgY3Vyc29yIHF1ZXJ5IFxuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXggPSBuZXcgQ3Vyc29ySW5kZXgodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmNsZWFyQ2FjaGVzKCk7XG4gICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIC8vIHRyaWdnZXIgY2hhbmdlIGV2ZW50IGZvciBjdXJzb3JcbiAgICAgICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHRoaXMucXVlcnkoKSk7XG4gICAgICAgICAgICAvLyBkZXRlY3QgZnV0dXJlIGNoYW5nZSBldmVudCAtIGlmIG5lZWRlZFxuICAgICAgICAgICAgdGhpcy5fX2RldGVjdF9mdXR1cmVfY2hhbmdlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBERVRFQ1QgRlVUVVJFIENIQU5HRVxuICAgICAqIFxuICAgICAqIFBST0JMRU06XG4gICAgICogXG4gICAgICogRHVyaW5nIHBsYXliYWNrIChjdXJzb3IuY3RybCBpcyBkeW5hbWljKSwgdGhlcmUgaXMgYSBuZWVkIHRvIFxuICAgICAqIGRldGVjdCB0aGUgcGFzc2luZyBmcm9tIG9uZSBzZWdtZW50IGludGVydmFsIG9mIHNyY1xuICAgICAqIHRvIHRoZSBuZXh0IC0gaWRlYWxseSBhdCBwcmVjaXNlbHkgdGhlIGNvcnJlY3QgdGltZVxuICAgICAqIFxuICAgICAqIG5lYXJieS5pdHYgKGRlcml2ZWQgZnJvbSBjdXJzb3Iuc3JjKSBnaXZlcyB0aGUgXG4gICAgICogaW50ZXJ2YWwgKGkpIHdlIGFyZSBjdXJyZW50bHkgaW4sIGkuZS4sIFxuICAgICAqIGNvbnRhaW5pbmcgdGhlIGN1cnJlbnQgb2Zmc2V0ICh2YWx1ZSBvZiBjdXJzb3IuY3RybCksIFxuICAgICAqIGFuZCAoaWkpIHdoZXJlIG5lYXJieS5jZW50ZXIgc3RheXMgY29uc3RhbnRcbiAgICAgKiBcbiAgICAgKiBUaGUgZXZlbnQgdGhhdCBuZWVkcyB0byBiZSBkZXRlY3RlZCBpcyB0aGVyZWZvcmUgdGhlXG4gICAgICogbW9tZW50IHdoZW4gd2UgbGVhdmUgdGhpcyBpbnRlcnZhbCwgdGhyb3VnaCBlaXRoZXJcbiAgICAgKiB0aGUgbG93IG9yIGhpZ2ggaW50ZXJ2YWwgZW5kcG9pbnRcbiAgICAgKiBcbiAgICAgKiBHT0FMOlxuICAgICAqIFxuICAgICAqIEF0IHRoaXMgbW9tZW50LCB3ZSBzaW1wbHkgbmVlZCB0byByZWV2YWx1YXRlIHRoZSBzdGF0ZSAocXVlcnkpIGFuZFxuICAgICAqIGVtaXQgYSBjaGFuZ2UgZXZlbnQgdG8gbm90aWZ5IG9ic2VydmVycy4gXG4gICAgICogXG4gICAgICogQVBQUk9BQ0hFUzpcbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbMF0gXG4gICAgICogVGhlIHRyaXZpYWwgc29sdXRpb24gaXMgdG8gZG8gbm90aGluZywgaW4gd2hpY2ggY2FzZVxuICAgICAqIG9ic2VydmVycyB3aWxsIHNpbXBseSBmaW5kIG91dCB0aGVtc2VsdmVzIGFjY29yZGluZyB0byB0aGVpciBcbiAgICAgKiBvd24gcG9sbCBmcmVxdWVuY3kuIFRoaXMgaXMgc3Vib3B0aW1hbCwgcGFydGljdWxhcmx5IGZvciBsb3cgZnJlcXVlbmN5IFxuICAgICAqIG9ic2VydmVycy4gSWYgdGhlcmUgaXMgYXQgbGVhc3Qgb25lIGhpZ2gtZnJlcXVlbmN5IHBvbGxlciwgXG4gICAgICogdGhpcyB3b3VsZCB0cmlnZ2VyIHRyaWdnZXIgdGhlIHN0YXRlIGNoYW5nZSwgY2F1c2luZyBhbGxcbiAgICAgKiBvYnNlcnZlcnMgdG8gYmUgbm90aWZpZWQuIFRoZSBwcm9ibGVtIHRob3VnaCwgaXMgaWYgbm8gb2JzZXJ2ZXJzXG4gICAgICogYXJlIGFjdGl2ZWx5IHBvbGxpbmcsIGJ1dCBvbmx5IGRlcGVuZGluZyBvbiBjaGFuZ2UgZXZlbnRzLlxuICAgICAqIFxuICAgICAqIEFwcHJvYWNoIFsxXSBcbiAgICAgKiBJbiBjYXNlcyB3aGVyZSB0aGUgY3RybCBpcyBkZXRlcm1pbmlzdGljLCBhIHRpbWVvdXRcbiAgICAgKiBjYW4gYmUgY2FsY3VsYXRlZC4gVGhpcyBpcyB0cml2aWFsIGlmIGN0cmwgaXMgYSBDbG9ja0N1cnNvciwgYW5kXG4gICAgICogaXQgaXMgZmFpcmx5IGVhc3kgaWYgdGhlIGN0cmwgaXMgQ3Vyc29yIHJlcHJlc2VudGluZyBtb3Rpb25cbiAgICAgKiBvciBsaW5lYXIgdHJhbnNpdGlvbi4gSG93ZXZlciwgY2FsY3VsYXRpb25zIGNhbiBiZWNvbWUgbW9yZVxuICAgICAqIGNvbXBsZXggaWYgbW90aW9uIHN1cHBvcnRzIGFjY2VsZXJhdGlvbiwgb3IgaWYgdHJhbnNpdGlvbnNcbiAgICAgKiBhcmUgc2V0IHVwIHdpdGggbm9uLWxpbmVhciBlYXNpbmcuXG4gICAgICogICBcbiAgICAgKiBOb3RlLCBob3dldmVyLCB0aGF0IHRoZXNlIGNhbGN1bGF0aW9ucyBhc3N1bWUgdGhhdCB0aGUgY3Vyc29yLmN0cmwgaXMgXG4gICAgICogYSBDbG9ja0N1cnNvciwgb3IgdGhhdCBjdXJzb3IuY3RybC5jdHJsIGlzIGEgQ2xvY2tDdXJzb3IuIFxuICAgICAqIEluIHByaW5jaXBsZSwgdGhvdWdoLCB0aGVyZSBjb3VsZCBiZSBhIHJlY3Vyc2l2ZSBjaGFpbiBvZiBjdXJzb3JzLFxuICAgICAqIChjdXJzb3IuY3RybC5jdHJsLi4uLmN0cmwpIG9mIHNvbWUgbGVuZ3RoLCB3aGVyZSBvbmx5IHRoZSBsYXN0IGlzIGEgXG4gICAgICogQ2xvY2tDdXJzb3IuIEluIG9yZGVyIHRvIGRvIGRldGVybWluaXN0aWMgY2FsY3VsYXRpb25zIGluIHRoZSBnZW5lcmFsXG4gICAgICogY2FzZSwgYWxsIGN1cnNvcnMgaW4gdGhlIGNoYWluIHdvdWxkIGhhdmUgdG8gYmUgbGltaXRlZCB0byBcbiAgICAgKiBkZXRlcm1pbmlzdGljIGxpbmVhciB0cmFuc2Zvcm1hdGlvbnMuXG4gICAgICogXG4gICAgICogQXBwcm9jaCBbMl0gXG4gICAgICogSXQgbWlnaHQgYWxzbyBiZSBwb3NzaWJsZSB0byBzYW1wbGUgZnV0dXJlIHZhbHVlcyBvZiBcbiAgICAgKiBjdXJzb3IuY3RybCB0byBzZWUgaWYgdGhlIHZhbHVlcyB2aW9sYXRlIHRoZSBuZWFyYnkuaXR2IGF0IHNvbWUgcG9pbnQuIFxuICAgICAqIFRoaXMgd291bGQgZXNzZW50aWFsbHkgYmUgdHJlYXRpbmcgY3RybCBhcyBhIGxheWVyIGFuZCBzYW1wbGluZyBcbiAgICAgKiBmdXR1cmUgdmFsdWVzLiBUaGlzIGFwcHJvY2ggd291bGQgd29yayBmb3IgYWxsIHR5cGVzLCBcbiAgICAgKiBidXQgdGhlcmUgaXMgbm8ga25vd2luZyBob3cgZmFyIGludG8gdGhlIGZ1dHVyZSBvbmUgXG4gICAgICogd291bGQgaGF2ZSB0byBzZWVrLiBIb3dldmVyLCBhZ2FpbiAtIGFzIGluIFsxXSB0aGUgYWJpbGl0eSB0byBzYW1wbGUgZnV0dXJlIHZhbHVlc1xuICAgICAqIGlzIHByZWRpY2F0ZWQgb24gY3Vyc29yLmN0cmwgYmVpbmcgYSBDbG9ja0N1cnNvci4gQWxzbywgdGhlcmUgXG4gICAgICogaXMgbm8gd2F5IG9mIGtub3dpbmcgaG93IGxvbmcgaW50byB0aGUgZnV0dXJlIHNhbXBsaW5nIHdvdWxkIGJlIG5lY2Vzc2FyeS5cbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbM10gXG4gICAgICogSW4gdGhlIGdlbmVyYWwgY2FzZSwgdGhlIG9ubHkgd2F5IHRvIHJlbGlhYmxleSBkZXRlY3QgdGhlIGV2ZW50IGlzIHRocm91Z2ggcmVwZWF0ZWRcbiAgICAgKiBwb2xsaW5nLiBBcHByb2FjaCBbM10gaXMgc2ltcGx5IHRoZSBpZGVhIHRoYXQgdGhpcyBwb2xsaW5nIGlzIHBlcmZvcm1lZFxuICAgICAqIGludGVybmFsbHkgYnkgdGhlIGN1cnNvciBpdHNlbGYsIGFzIGEgd2F5IG9mIHNlY3VyaW5nIGl0cyBvd24gY29uc2lzdGVudFxuICAgICAqIHN0YXRlLCBhbmQgZW5zdXJpbmcgdGhhdCBvYnNlcnZlciBnZXQgY2hhbmdlIGV2ZW50cyBpbiBhIHRpbWVseSBtYW5uZXIsIGV2ZW50XG4gICAgICogaWYgdGhleSBkbyBsb3ctZnJlcXVlbmN5IHBvbGxpbmcsIG9yIGRvIG5vdCBkbyBwb2xsaW5nIGF0IGFsbC4gXG4gICAgICogXG4gICAgICogU09MVVRJT046XG4gICAgICogQXMgdGhlcmUgaXMgbm8gcGVyZmVjdCBzb2x1dGlvbiBpbiB0aGUgZ2VuZXJhbCBjYXNlLCB3ZSBvcHBvcnR1bmlzdGljYWxseVxuICAgICAqIHVzZSBhcHByb2FjaCBbMV0gd2hlbiB0aGlzIGlzIHBvc3NpYmxlLiBJZiBub3QsIHdlIGFyZSBmYWxsaW5nIGJhY2sgb24gXG4gICAgICogYXBwcm9hY2ggWzNdXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIE5PIGV2ZW50IGRldGVjdGlvbiBpcyBuZWVkZWQgKE5PT1ApXG4gICAgICogKGkpIGN1cnNvci5jdHJsIGlzIG5vdCBkeW5hbWljXG4gICAgICogb3JcbiAgICAgKiAoaWkpIG5lYXJieS5pdHYgc3RyZXRjaGVzIGludG8gaW5maW5pdHkgaW4gYm90aCBkaXJlY3Rpb25zXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIGFwcHJvYWNoIFsxXSBjYW4gYmUgdXNlZFxuICAgICAqIFxuICAgICAqIChpKSBpZiBjdHJsIGlzIGEgQ2xvY2tDdXJzb3IgJiYgbmVhcmJ5Lml0di5oaWdoIDwgSW5maW5pdHlcbiAgICAgKiBvclxuICAgICAqIChpaSkgY3RybC5jdHJsIGlzIGEgQ2xvY2tDdXJzb3JcbiAgICAgKiAgICAgIChhKSBjdHJsLm5lYXJieS5jZW50ZXIgaGFzIGV4YWN0bHkgMSBpdGVtXG4gICAgICogICAgICAmJlxuICAgICAqICAgICAgKGIpIGN0cmwubmVhcmJ5LmNlbnRlclswXS50eXBlID09IChcIm1vdGlvblwiKSB8fCAoXCJ0cmFuc2l0aW9uXCIgJiYgZWFzaW5nPT1cImxpbmVhclwiKVxuICAgICAqICAgICAgJiZcbiAgICAgKiAgICAgIChjKSBjdHJsLm5lYXJieS5jZW50ZXJbMF0uZGF0YS52ZWxvY2l0eSAhPSAwLjBcbiAgICAgKiAgICAgICYmIFxuICAgICAqICAgICAgKGQpIGZ1dHVyZSBpbnRlcnNlY3RvbiBwb2ludCB3aXRoIGNhY2hlLm5lYXJieS5pdHYgXG4gICAgICogICAgICAgICAgaXMgbm90IC1JbmZpbml0eSBvciBJbmZpbml0eVxuICAgICAqIFxuICAgICAqIFRob3VnaCBpdCBzZWVtcyBjb21wbGV4LCBjb25kaXRpb25zIGZvciBbMV0gc2hvdWxkIGJlIG1ldCBmb3IgY29tbW9uIGNhc2VzIGludm9sdmluZ1xuICAgICAqIHBsYXliYWNrLiBBbHNvLCB1c2Ugb2YgdHJhbnNpdGlvbiBldGMgbWlnaHQgYmUgcmFyZS5cbiAgICAgKiBcbiAgICAgKi9cblxuICAgIF9fZGV0ZWN0X2Z1dHVyZV9jaGFuZ2UoKSB7XG5cbiAgICAgICAgLy8gY3RybCBcbiAgICAgICAgY29uc3QgY3RybF92ZWN0b3IgPSB0aGlzLl9nZXRfY3RybF9zdGF0ZSgpO1xuICAgICAgICBjb25zdCB7dmFsdWU6Y3VycmVudF9wb3MsIG9mZnNldDpjdXJyZW50X3RzfSA9IGN0cmxfdmVjdG9yO1xuXG4gICAgICAgIC8vIGN0cmwgbXVzdCBiZSBkeW5hbWljXG4gICAgICAgIGlmICghY3RybF92ZWN0b3IuZHluYW1pYykge1xuICAgICAgICAgICAgLy8gbm8gZnV0dXJlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2V0IG5lYXJieSBmcm9tIHNyYyAtIHVzZSB2YWx1ZSBmcm9tIGN0cmxcbiAgICAgICAgY29uc3Qgc3JjX25lYXJieSA9IHRoaXMuc3JjLmluZGV4Lm5lYXJieShjdXJyZW50X3Bvcyk7XG4gICAgICAgIGNvbnN0IFtsb3csIGhpZ2hdID0gc3JjX25lYXJieS5pdHYuc2xpY2UoMCwyKTtcblxuICAgICAgICAvLyBhcHByb2FjaCBbMV1cbiAgICAgICAgaWYgKHRoaXMuY3RybCBpbnN0YW5jZW9mIENsb2NrUHJvdmlkZXJCYXNlKSB7XG4gICAgICAgICAgICBpZiAoaXNGaW5pdGUoaGlnaCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9fc2V0X3RpbWVvdXQoaGlnaCwgY3VycmVudF9wb3MsIDEuMCwgY3VycmVudF90cyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbm8gZnV0dXJlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IFxuICAgICAgICBpZiAodGhpcy5jdHJsLmN0cmwgaW5zdGFuY2VvZiBDbG9ja1Byb3ZpZGVyQmFzZSkge1xuICAgICAgICAgICAgLyoqIFxuICAgICAgICAgICAgICogdGhpcy5jdHJsIFxuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAgKiBoYXMgbWFueSBwb3NzaWJsZSBiZWhhdmlvcnNcbiAgICAgICAgICAgICAqIHRoaXMuY3RybCBoYXMgYW4gaW5kZXggdXNlIHRoaXMgdG8gZmlndXJlIG91dCB3aGljaFxuICAgICAgICAgICAgICogYmVoYXZpb3VyIGlzIGN1cnJlbnQuXG4gICAgICAgICAgICAgKiBcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICAvLyB1c2UgdGhlIHNhbWUgb2Zmc2V0IHRoYXQgd2FzIHVzZWQgaW4gdGhlIGN0cmwucXVlcnlcbiAgICAgICAgICAgIGNvbnN0IGN0cmxfbmVhcmJ5ID0gdGhpcy5jdHJsLmluZGV4Lm5lYXJieShjdXJyZW50X3RzKTtcblxuICAgICAgICAgICAgaWYgKCFpc0Zpbml0ZShsb3cpICYmICFpc0Zpbml0ZShoaWdoKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vIGZ1dHVyZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY3RybF9uZWFyYnkuY2VudGVyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY3RybF9pdGVtID0gY3RybF9uZWFyYnkuY2VudGVyWzBdO1xuICAgICAgICAgICAgICAgIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHt2ZWxvY2l0eSwgYWNjZWxlcmF0aW9uPTAuMH0gPSBjdHJsX2l0ZW0uZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjY2VsZXJhdGlvbiA9PSAwLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdGFyZ2V0X3BvcyA9ICh2ZWxvY2l0eSA+IDApID8gaGlnaCA6IGxvdztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0Zpbml0ZSh0YXJnZXRfcG9zKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjsgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBubyBmdXR1cmUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gYWNjZWxlcmF0aW9uIC0gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7djA6cDAsIHYxOnAxLCB0MCwgdDEsIGVhc2luZz1cImxpbmVhclwifSA9IGN0cmxfaXRlbS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZWFzaW5nID09IFwibGluZWFyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2ZWxvY2l0eSA9IChwMS1wMCkvKHQxLXQwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRfcG9zID0gKHZlbG9jaXR5ID4gMCkgPyBNYXRoLm1pbihoaWdoLCBwMSkgOiBNYXRoLm1heChsb3csIHAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBvdGhlciBlYXNpbmcgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gb3RoZXIgdHlwZSAoaW50ZXJwb2xhdGlvbikgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIG1vcmUgdGhhbiBvbmUgc2VnbWVudCAtIHBvc3NpYmxlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0IC0gYXBwcm9hY2ggWzNdXG4gICAgICAgIHRoaXMuX19zZXRfcG9sbGluZyhzcmNfbmVhcmJ5Lml0dik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc2V0IHRpbWVvdXRcbiAgICAgKiAtIHByb3RlY3RzIGFnYWluc3QgdG9vIGVhcmx5IGNhbGxiYWNrcyBieSByZXNjaGVkdWxpbmdcbiAgICAgKiB0aW1lb3V0IGlmIG5lY2Nlc3NhcnkuXG4gICAgICogLSBhZGRzIGEgbWlsbGlzZWNvbmQgdG8gb3JpZ2luYWwgdGltZW91dCB0byBhdm9pZFxuICAgICAqIGZyZXF1ZW50IHJlc2NoZWR1bGluZyBcbiAgICAgKi9cblxuICAgIF9fc2V0X3RpbWVvdXQodGFyZ2V0X3BvcywgY3VycmVudF9wb3MsIHZlbG9jaXR5LCBjdXJyZW50X3RzKSB7XG4gICAgICAgIGNvbnN0IGRlbHRhX3NlYyA9ICh0YXJnZXRfcG9zIC0gY3VycmVudF9wb3MpIC8gdmVsb2NpdHk7XG4gICAgICAgIGNvbnN0IHRhcmdldF90cyA9IGN1cnJlbnRfdHMgKyBkZWx0YV9zZWM7XG4gICAgICAgIHRoaXMuX3RpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV90aW1lb3V0KHRhcmdldF90cyk7XG4gICAgICAgIH0sIGRlbHRhX3NlYyoxMDAwICsgMSk7XG4gICAgfVxuXG4gICAgX19oYW5kbGVfdGltZW91dCh0YXJnZXRfdHMpIHtcbiAgICAgICAgY29uc3QgdHMgPSB0aGlzLl9nZXRfY3RybF9zdGF0ZSgpLm9mZnNldDtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nX3NlYyA9IHRhcmdldF90cyAtIHRzOyBcbiAgICAgICAgaWYgKHJlbWFpbmluZ19zZWMgPD0gMCkge1xuICAgICAgICAgICAgLy8gZG9uZVxuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV9jaGFuZ2UoXCJ0aW1lb3V0XCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcmVzY2hlZHVsZSB0aW1lb3V0XG4gICAgICAgICAgICB0aGlzLl90aWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9faGFuZGxlX3RpbWVvdXQodGFyZ2V0X3RzKVxuICAgICAgICAgICAgfSwgcmVtYWluaW5nX3NlYyoxMDAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNldCBwb2xsaW5nXG4gICAgICovXG5cbiAgICBfX3NldF9wb2xsaW5nKGl0dikge1xuICAgICAgICB0aGlzLl9waWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9faGFuZGxlX3BvbGwoaXR2KTtcbiAgICAgICAgfSwgMTAwKTtcbiAgICB9XG5cbiAgICBfX2hhbmRsZV9wb2xsKGl0dikge1xuICAgICAgICBsZXQgb2Zmc2V0ID0gdGhpcy5xdWVyeSgpLnZhbHVlO1xuICAgICAgICBpZiAoIWludGVydmFsLmNvdmVyc19wb2ludChpdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgIHRoaXMuX19oYW5kbGVfY2hhbmdlKFwidGltZW91dFwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfZ2V0X2N0cmxfc3RhdGUgKCkge1xuICAgICAgICBpZiAodGhpcy5jdHJsIGluc3RhbmNlb2YgQ2xvY2tQcm92aWRlckJhc2UpIHtcbiAgICAgICAgICAgIGxldCB0cyA9IHRoaXMuY3RybC5ub3coKTtcbiAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dHMsIGR5bmFtaWM6dHJ1ZSwgb2Zmc2V0OnRzfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBzdGF0ZSA9IHRoaXMuY3RybC5xdWVyeSgpO1xuICAgICAgICAgICAgLy8gcHJvdGVjdCBhZ2FpbnN0IG5vbi1mbG9hdCB2YWx1ZXNcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc3RhdGUudmFsdWUgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdHJsIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7c3RhdGUudmFsdWV9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdmFsdWUgKCkge3JldHVybiB0aGlzLnF1ZXJ5KCkudmFsdWV9O1xuICAgIFxuICAgIC8qXG4gICAgICAgIEV2ZW50aWZ5OiBpbW1lZGlhdGUgZXZlbnRzXG4gICAgKi9cbiAgICBldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuICAgICAgICBpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG4gICAgICAgICAgICByZXR1cm4gW3RoaXMucXVlcnkoKV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBCSU5EIFJFTEVBU0UgKGNvbnZlbmllbmNlKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgYmluZChjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICAgICAgcmV0dXJuIGJpbmQodGhpcywgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zKTtcbiAgICB9XG4gICAgcmVsZWFzZShoYW5kbGUpIHtcbiAgICAgICAgcmV0dXJuIHJlbGVhc2UoaGFuZGxlKTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFVQREFURSBBUElcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGFzc2lnbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gY21kKHRoaXMuc3JjLnNyYykuYXNzaWduKHZhbHVlKTtcbiAgICB9XG4gICAgbW92ZSAoe3Bvc2l0aW9uLCB2ZWxvY2l0eX0pIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgb2Zmc2V0OnRpbWVzdGFtcH0gPSB0aGlzLnF1ZXJ5KCk7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhcm5pbmc6IGN1cnNvciBzdGF0ZSBtdXN0IGJlIG51bWJlciAke3ZhbHVlfWApO1xuICAgICAgICB9XG4gICAgICAgIHBvc2l0aW9uID0gKHBvc2l0aW9uICE9IHVuZGVmaW5lZCkgPyBwb3NpdGlvbiA6IHZhbHVlO1xuICAgICAgICB2ZWxvY2l0eSA9ICh2ZWxvY2l0eSAhPSB1bmRlZmluZWQpID8gdmVsb2NpdHk6IDA7XG4gICAgICAgIHJldHVybiBjbWQodGhpcy5zcmMuc3JjKS5tb3ZlKHtwb3NpdGlvbiwgdmVsb2NpdHksIHRpbWVzdGFtcH0pO1xuICAgIH1cbiAgICB0cmFuc2l0aW9uICh7dGFyZ2V0LCBkdXJhdGlvbiwgZWFzaW5nfSkge1xuICAgICAgICBsZXQge3ZhbHVlOnYwLCBvZmZzZXQ6dDB9ID0gdGhpcy5xdWVyeSgpO1xuICAgICAgICBpZiAodHlwZW9mIHYwICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3Igc3RhdGUgbXVzdCBiZSBudW1iZXIgJHt2MH1gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY21kKHRoaXMuc3JjLnNyYykudHJhbnNpdGlvbih2MCwgdGFyZ2V0LCB0MCwgdDAgKyBkdXJhdGlvbiwgZWFzaW5nKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUgKHt0dXBsZXMsIGR1cmF0aW9ufSkge1xuICAgICAgICBsZXQgdDAgPSB0aGlzLnF1ZXJ5KCkub2Zmc2V0O1xuICAgICAgICAvLyBhc3N1bWluZyB0aW1zdGFtcHMgYXJlIGluIHJhbmdlIFswLDFdXG4gICAgICAgIC8vIHNjYWxlIHRpbWVzdGFtcHMgdG8gZHVyYXRpb25cbiAgICAgICAgdHVwbGVzID0gdHVwbGVzLm1hcCgoW3YsdF0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbdiwgdDAgKyB0KmR1cmF0aW9uXTtcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzLnNyYy5zcmMpLmludGVycG9sYXRlKHR1cGxlcyk7XG4gICAgfVxuXG59XG5zcmNwcm9wLmFkZFRvUHJvdG90eXBlKEN1cnNvci5wcm90b3R5cGUpO1xuc3JjcHJvcC5hZGRUb1Byb3RvdHlwZShDdXJzb3IucHJvdG90eXBlKTtcblxuIiwiaW1wb3J0IHsgTG9jYWxTdGF0ZVByb3ZpZGVyIH0gZnJvbSBcIi4vc3RhdGVwcm92aWRlcl9zaW1wbGUuanNcIjtcbmltcG9ydCB7IG1lcmdlIH0gZnJvbSBcIi4vb3BzL21lcmdlLmpzXCJcbmltcG9ydCB7IHNoaWZ0IH0gZnJvbSBcIi4vb3BzL3NoaWZ0LmpzXCI7XG5pbXBvcnQgeyBJbnB1dExheWVyLCBMYXllciB9IGZyb20gXCIuL2xheWVycy5qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4vY3Vyc29ycy5qc1wiO1xuaW1wb3J0IHsgY21kIH0gZnJvbSBcIi4vY21kLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUiBGQUNUT1JZXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmZ1bmN0aW9uIGxheWVyKG9wdGlvbnM9e30pIHtcbiAgICBsZXQge3NyYywgaXRlbXM9W10sIHZhbHVlLCAuLi5vcHRzfSA9IG9wdGlvbnM7XG4gICAgaWYgKHNyYyBpbnN0YW5jZW9mIExheWVyKSB7XG4gICAgICAgIHJldHVybiBzcmM7XG4gICAgfSBcbiAgICBpZiAoc3JjID09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodmFsdWUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpdGVtcyA9IFt7XG4gICAgICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eV0sXG4gICAgICAgICAgICAgICAgZGF0YTogdmFsdWVcbiAgICAgICAgICAgIH1dO1xuICAgICAgICB9IFxuICAgICAgICBzcmMgPSBuZXcgTG9jYWxTdGF0ZVByb3ZpZGVyKHtpdGVtc30pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IElucHV0TGF5ZXIoe3NyYywgLi4ub3B0c30pOyBcbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIENVUlNPUiBGQUNUT1JJRVNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gY3Vyc29yKG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7Y3RybCwgLi4ub3B0c30gPSBvcHRpb25zO1xuICAgIGNvbnN0IHNyYyA9IGxheWVyKG9wdHMpOyAgICBcbiAgICByZXR1cm4gbmV3IEN1cnNvcih7Y3RybCwgc3JjfSk7XG59XG5cbmV4cG9ydCB7IGxheWVyLCBjdXJzb3IsIG1lcmdlLCBzaGlmdCwgY21kLCBjdXJzb3IgYXMgdmFyaWFibGUsIGN1cnNvciBhcyBwbGF5YmFja30iXSwibmFtZXMiOlsiUFJFRklYIiwiYWRkVG9JbnN0YW5jZSIsImFkZFRvUHJvdG90eXBlIiwiY2FsbGJhY2suYWRkVG9JbnN0YW5jZSIsImNhbGxiYWNrLmFkZFRvUHJvdG90eXBlIiwiaW50ZXJwb2xhdGUiLCJldmVudGlmeS5hZGRUb0luc3RhbmNlIiwiZXZlbnRpZnkuYWRkVG9Qcm90b3R5cGUiLCJzcmNwcm9wLmFkZFRvSW5zdGFuY2UiLCJzcmNwcm9wLmFkZFRvUHJvdG90eXBlIiwic2VnbWVudC5TdGF0aWNTZWdtZW50Iiwic2VnbWVudC5UcmFuc2l0aW9uU2VnbWVudCIsInNlZ21lbnQuSW50ZXJwb2xhdGlvblNlZ21lbnQiLCJzZWdtZW50Lk1vdGlvblNlZ21lbnQiXSwibWFwcGluZ3MiOiI7Ozs7O0lBQUE7SUFDQTtJQUNBOztJQUVBLE1BQU1BLFFBQU0sR0FBRyxZQUFZOztJQUVwQixTQUFTQyxlQUFhLENBQUMsTUFBTSxFQUFFO0lBQ3RDLElBQUksTUFBTSxDQUFDLENBQUMsRUFBRUQsUUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsRUFBRTtJQUNyQzs7SUFFQSxTQUFTLFlBQVksRUFBRSxPQUFPLEVBQUU7SUFDaEMsSUFBSSxJQUFJLE1BQU0sR0FBRztJQUNqQixRQUFRLE9BQU8sRUFBRTtJQUNqQjtJQUNBLElBQUksSUFBSSxDQUFDLENBQUMsRUFBRUEsUUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUMzQyxJQUFJLE9BQU8sTUFBTTtJQUNqQjtJQUVBLFNBQVMsZUFBZSxFQUFFLE1BQU0sRUFBRTtJQUNsQyxJQUFJLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUVBLFFBQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDMUQsSUFBSSxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRTtJQUNwQixRQUFRLElBQUksQ0FBQyxDQUFDLEVBQUVBLFFBQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ25EO0lBQ0E7SUFFQSxTQUFTLGdCQUFnQixFQUFFLElBQUksRUFBRTtJQUNqQyxJQUFJLElBQUksQ0FBQyxDQUFDLEVBQUVBLFFBQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLE1BQU0sRUFBRTtJQUN4RCxRQUFRLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0lBQzVCLEtBQUssQ0FBQztJQUNOOztJQUdPLFNBQVNFLGdCQUFjLEVBQUUsVUFBVSxFQUFFO0lBQzVDLElBQUksTUFBTSxHQUFHLEdBQUc7SUFDaEIsUUFBUSxZQUFZLEVBQUUsZUFBZSxFQUFFO0lBQ3ZDO0lBQ0EsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUM7SUFDbEM7O0lDbkNBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTs7SUFFTyxNQUFNLGlCQUFpQixDQUFDOztJQUUvQixJQUFJLFdBQVcsR0FBRztJQUNsQixRQUFRQyxlQUFzQixDQUFDLElBQUksQ0FBQztJQUNwQzs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLE1BQU0sQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQztJQUM3QixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUM7SUFDMUM7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7O0lBRUEsSUFBSSxTQUFTLEdBQUc7SUFDaEIsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDO0lBQzFDOztJQUVBO0lBQ0E7SUFDQTs7SUFFQSxJQUFJLElBQUksSUFBSSxDQUFDLEdBQUc7SUFDaEIsUUFBUSxPQUFPLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQztJQUNsQztJQUNBO0FBQ0FDLG9CQUF1QixDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQzs7SUNqRHBEO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7O0lBR0EsU0FBUyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtJQUMxQixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxPQUFPLENBQUM7SUFDekIsSUFBSSxJQUFJLENBQUMsS0FBSyxRQUFRLEVBQUUsT0FBTyxDQUFDO0lBQ2hDLElBQUksSUFBSSxDQUFDLEtBQUssUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ2pDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDbEMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUM7SUFDakMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDO0lBQ2hCOztJQUVBLFNBQVMsWUFBWSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDL0IsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7SUFDckIsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7SUFDckIsSUFBSSxJQUFJLElBQUksR0FBRyxVQUFVLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQztJQUNqQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksR0FBRyxFQUFFLEdBQUcsRUFBRTtJQUN2Qzs7SUFFQSxTQUFTLFdBQVcsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQzlCLElBQUksT0FBTyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHO0lBQ2xDO0lBQ0EsU0FBUyxXQUFXLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUM5QixJQUFJLE9BQU8sWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSTtJQUNuQztJQUNBLFNBQVMsV0FBVyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDOUIsSUFBSSxPQUFPLFlBQVksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUc7SUFDbEM7SUFDQSxTQUFTLFdBQVcsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQzlCLElBQUksT0FBTyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJO0lBQ25DO0lBQ0EsU0FBUyxXQUFXLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUM5QixJQUFJLE9BQU8sWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSTtJQUNuQztJQUNBLFNBQVMsWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDOUIsSUFBSSxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtJQUMxQztJQUNBLFNBQVMsWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDOUIsSUFBSSxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtJQUMxQzs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLFNBQVMsYUFBYSxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUU7SUFDbEMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7SUFDakIsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ3RCLFFBQVEsT0FBTyxDQUFDO0lBQ2hCO0lBQ0EsSUFBSSxJQUFJLE1BQU0sSUFBSSxLQUFLLEVBQUU7SUFDekI7SUFDQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRTtJQUNoQixHQUFHLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM5QztJQUNBLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEIsS0FBSyxNQUFNLElBQUksTUFBTSxJQUFJLE1BQU0sRUFBRTtJQUNqQztJQUNBLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFO0lBQ2hCLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0lBQy9DO0lBQ0EsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwQixLQUFLLE1BQU07SUFDWCxLQUFLLE1BQU0sSUFBSSxLQUFLLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQztJQUM1QztJQUNBLElBQUksT0FBTyxDQUFDO0lBQ1o7OztJQUdBO0lBQ0E7SUFDQTtJQUNBLFNBQVMsdUJBQXVCLENBQUMsR0FBRyxFQUFFO0lBQ3RDLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxHQUFHLEdBQUc7SUFDaEQsSUFBSSxJQUFJLEtBQUssR0FBRyxDQUFDLFNBQVMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsRCxJQUFJLElBQUksTUFBTSxHQUFHLENBQUMsVUFBVSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3RELElBQUksT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUM7SUFDMUI7OztJQUdBO0lBQ0E7O0lBRUE7O0lBRUE7O0lBRUE7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBLFNBQVMsd0JBQXdCLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRTtJQUMxQyxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEdBQUcsdUJBQXVCLENBQUMsR0FBRyxDQUFDO0lBQ3REO0lBQ0EsSUFBSSxPQUFPLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksV0FBVyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUM7SUFDMUQ7SUFDQTtJQUNBLFNBQVMscUJBQXFCLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRTtJQUN2QyxJQUFJLE9BQU8sd0JBQXdCLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2hEOzs7O0lBSUE7SUFDQTtJQUNBO0lBQ0EsU0FBUyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUU7SUFDeEMsSUFBSSxPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQztJQUNwQzs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxTQUFTLHVCQUF1QixDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDekMsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7SUFDckIsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7SUFDckI7SUFDQSxJQUFJLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0lBQ2xCLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLENBQUM7SUFDaEQ7SUFDQSxJQUFJLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRTtJQUNqQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDbkQ7SUFDQSxJQUFJLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7SUFDbkM7O0lBRUEsU0FBUyxRQUFRLENBQUMsQ0FBQyxFQUFFO0lBQ3JCLElBQUksT0FBTyxPQUFPLENBQUMsSUFBSSxRQUFRO0lBQy9COztJQUVPLFNBQVMsbUJBQW1CLENBQUMsS0FBSyxDQUFDO0lBQzFDLElBQUksSUFBSSxHQUFHLEdBQUcsS0FBSztJQUNuQixJQUFJLElBQUksR0FBRyxJQUFJLFNBQVMsRUFBRTtJQUMxQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQW9CLENBQUM7SUFDN0M7SUFDQSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0lBQzdCLFFBQVEsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7SUFDM0I7SUFDQSxZQUFZLEdBQUcsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztJQUN4QyxTQUFTLE1BQU07SUFDZixZQUFZLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLHlCQUF5QixDQUFDO0lBQ3RFO0lBQ0EsS0FDQTtJQUNBLElBQUksSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUN6QixRQUFRLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUk7SUFDekMsS0FBSyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDaEMsUUFBUSxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztJQUN2QyxLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUNoQyxRQUFRLEdBQUcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUM3QixLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtJQUMvQixRQUFRLEdBQUcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUI7SUFDQSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUMsR0FBRyxHQUFHO0lBQ2xEO0lBQ0EsSUFBSSxJQUFJLEdBQUcsSUFBSSxTQUFTLElBQUksR0FBRyxJQUFJLElBQUksRUFBRTtJQUN6QyxRQUFRLEdBQUcsR0FBRyxDQUFDLFFBQVE7SUFDdkI7SUFDQSxJQUFJLElBQUksSUFBSSxJQUFJLFNBQVMsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO0lBQzNDLFFBQVEsSUFBSSxHQUFHLFFBQVE7SUFDdkI7SUFDQTtJQUNBLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixFQUFFLEdBQUcsQ0FBQztJQUNoRSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUM7SUFDbkU7SUFDQSxJQUFJLElBQUksR0FBRyxHQUFHLElBQUksRUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLFlBQVksRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDO0lBQzVEO0lBQ0EsSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUU7SUFDckIsUUFBUSxVQUFVLEdBQUcsSUFBSTtJQUN6QixRQUFRLFdBQVcsR0FBRyxJQUFJO0lBQzFCO0lBQ0E7SUFDQSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFO0lBQzFCLFFBQVEsVUFBVSxHQUFHLElBQUk7SUFDekI7SUFDQSxJQUFJLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtJQUMxQixRQUFRLFdBQVcsR0FBRyxJQUFJO0lBQzFCO0lBQ0E7SUFDQSxJQUFJLElBQUksT0FBTyxVQUFVLEtBQUssU0FBUyxFQUFFO0lBQ3pDLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQztJQUNqRCxLQUFLO0lBQ0wsSUFBSSxJQUFJLE9BQU8sV0FBVyxLQUFLLFNBQVMsRUFBRTtJQUMxQyxRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUM7SUFDbEQ7SUFDQSxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUM7SUFDL0M7Ozs7O0lBS08sTUFBTSxRQUFRLEdBQUc7SUFDeEIsSUFBSSxFQUFFLEVBQUUsV0FBVztJQUNuQixJQUFJLEVBQUUsRUFBRSxXQUFXO0lBQ25CLElBQUksRUFBRSxFQUFFLFdBQVc7SUFDbkIsSUFBSSxFQUFFLEVBQUUsV0FBVztJQUNuQixJQUFJLEdBQUcsRUFBRSxZQUFZO0lBQ3JCLElBQUksRUFBRSxFQUFFLFdBQVc7SUFDbkIsSUFBSSxHQUFHLEVBQUUsWUFBWTtJQUNyQixJQUFJLEdBQUcsRUFBRSxZQUFZO0lBQ3JCLElBQUksSUFBSSxFQUFFLGFBQWE7SUFDdkIsSUFBSSxhQUFhLEVBQUU7SUFDbkI7SUFDTyxNQUFNLFFBQVEsR0FBRztJQUN4QixJQUFJLGVBQWUsRUFBRSx3QkFBd0I7SUFDN0MsSUFBSSxZQUFZLEVBQUUscUJBQXFCO0lBQ3ZDLElBQUksV0FBVyxFQUFFLG9CQUFvQjtJQUNyQyxJQUFJLGNBQWMsRUFBRSx1QkFBdUI7SUFDM0MsSUFBSSxVQUFVLEVBQUU7SUFDaEI7O0lDcFBBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRU8sTUFBTSxrQkFBa0IsU0FBUyxpQkFBaUIsQ0FBQzs7SUFFMUQsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUM1QixRQUFRLEtBQUssRUFBRTtJQUNmO0lBQ0EsUUFBUSxJQUFJLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxHQUFHLE9BQU87SUFDcEMsUUFBUSxJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUU7SUFDaEM7SUFDQSxZQUFZLElBQUksQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQztJQUM1QyxTQUFTLE1BQU0sSUFBSSxLQUFLLElBQUksU0FBUyxFQUFFO0lBQ3ZDO0lBQ0EsWUFBWSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUM7SUFDM0IsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0lBQ3JELGdCQUFnQixJQUFJLEVBQUUsUUFBUTtJQUM5QixnQkFBZ0IsSUFBSSxDQUFDO0lBQ3JCLGFBQWEsQ0FBQztJQUNkLFNBQVMsTUFBTTtJQUNmLFlBQVksSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFO0lBQzVCO0lBQ0E7O0lBRUEsSUFBSSxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFO0lBQzVCLFFBQVEsT0FBTyxPQUFPLENBQUMsT0FBTztJQUM5QixhQUFhLElBQUksQ0FBQyxNQUFNO0lBQ3hCLGdCQUFnQixJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUM7SUFDaEQsZ0JBQWdCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtJQUN2QyxhQUFhLENBQUM7SUFDZDs7SUFFQSxJQUFJLFNBQVMsQ0FBQyxHQUFHO0lBQ2pCLFFBQVEsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRTtJQUNsQzs7SUFFQSxJQUFJLElBQUksSUFBSSxDQUFDLEdBQUc7SUFDaEIsUUFBUSxPQUFPLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQztJQUNuQztJQUNBOzs7SUFHQSxTQUFTLFdBQVcsQ0FBQyxLQUFLLEVBQUU7SUFDNUIsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtJQUMvQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUM7SUFDakQ7SUFDQTtJQUNBLElBQUksS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7SUFDOUIsUUFBUSxJQUFJLENBQUMsR0FBRyxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUNoRDtJQUNBO0lBQ0EsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSztJQUN6QixRQUFRLElBQUksS0FBSyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwRCxRQUFRLElBQUksS0FBSyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwRCxRQUFRLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDO0lBQ3pDLEtBQUssQ0FBQztJQUNOO0lBQ0EsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtJQUMzQyxRQUFRLElBQUksU0FBUyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkUsUUFBUSxJQUFJLFFBQVEsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUQ7SUFDQSxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsRUFBRTtJQUMvQyxZQUFZLE1BQU0sSUFBSSxLQUFLLENBQUMsNkJBQTZCLENBQUM7SUFDMUQ7SUFDQTtJQUNBLElBQUksT0FBTyxLQUFLO0lBQ2hCOztJQ3hFQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7O0lBR0E7SUFDQTtJQUNBO0lBQ0E7SUFDTyxTQUFTLGFBQWEsRUFBRSxNQUFNLEVBQUU7SUFDdkMsSUFBSSxNQUFNLEdBQUcsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckQsSUFBSSxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQztJQUNyQzs7SUFFQTtJQUNBO0lBQ0E7SUFDQTs7SUFFTyxTQUFTLGNBQWMsRUFBRSxNQUFNLEVBQUU7SUFDeEMsSUFBSSxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdEQsSUFBSSxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQztJQUNyQzs7OztJQUlPLE1BQU0sZUFBZSxDQUFDOzs7SUFHN0I7SUFDQTtJQUNBO0lBQ0EsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO0lBQ25CLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQztJQUMxQzs7SUFFQSxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7SUFDbEIsUUFBUSxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRTtJQUN4QyxZQUFZLE1BQU0sR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDaEM7SUFDQSxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0lBQ3BDLFlBQVksTUFBTSxJQUFJLEtBQUssQ0FBQywyQkFBMkIsQ0FBQztJQUN4RDtJQUNBLFFBQVEsT0FBTyxNQUFNO0lBQ3JCOztJQUVBO0lBQ0E7SUFDQTtJQUNBLElBQUksS0FBSyxHQUFHO0lBQ1osUUFBUSxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN6RCxRQUFRLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLEtBQUs7SUFDM0Q7O0lBRUE7SUFDQTtJQUNBO0lBQ0EsSUFBSSxJQUFJLEdBQUc7SUFDWCxRQUFRLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN2RCxRQUFRLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRztJQUNyRDs7O0lBR0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLElBQUksWUFBWSxDQUFDLE1BQU0sRUFBRTtJQUN6QixRQUFRLE1BQU0sS0FBSyxHQUFHLGNBQWMsQ0FBQyxNQUFNLENBQUM7SUFDNUMsUUFBUSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxRQUFRLEVBQUU7SUFDbEMsWUFBWSxPQUFPLFNBQVM7SUFDNUI7SUFDQSxRQUFRLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7SUFDakM7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRTtJQUN4QixRQUFRLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDO0lBQ3JELFFBQVEsSUFBSSxXQUFXLElBQUksU0FBUyxFQUFFO0lBQ3RDLFlBQVksT0FBTyxTQUFTO0lBQzVCO0lBQ0EsUUFBUSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtJQUMzQztJQUNBLFlBQVksT0FBTyxXQUFXO0lBQzlCO0lBQ0E7SUFDQTtJQUNBLFFBQVEsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQztJQUM1Qzs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFO0lBQ3hCLFFBQVEsTUFBTSxJQUFJLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQztJQUMxQyxRQUFRLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFO0lBQ2xDLFlBQVksT0FBTyxTQUFTO0lBQzVCO0lBQ0EsUUFBUSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakM7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRTtJQUN4QixRQUFRLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDO0lBQ3BELFFBQVEsSUFBSSxXQUFXLElBQUksU0FBUyxFQUFFO0lBQ3RDLFlBQVksT0FBTyxTQUFTO0lBQzVCO0lBQ0EsUUFBUSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtJQUMzQztJQUNBLFlBQVksT0FBTyxXQUFXO0lBQzlCO0lBQ0E7SUFDQTtJQUNBLFFBQVEsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQztJQUM1Qzs7SUFFQSxJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUU7SUFDckIsUUFBUSxPQUFPLElBQUksY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUM7SUFDaEQ7O0lBRUE7OztJQUdBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUEsTUFBTSxjQUFjLENBQUM7O0lBRXJCLElBQUksV0FBVyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsRUFBRSxFQUFFO0lBQ25DLFFBQVEsSUFBSTtJQUNaLFlBQVksS0FBSyxDQUFDLENBQUMsUUFBUTtJQUMzQixZQUFZLElBQUksQ0FBQyxRQUFRO0lBQ3pCLFlBQVksWUFBWSxDQUFDO0lBQ3pCLFNBQVMsR0FBRyxPQUFPO0lBQ25CLFFBQVEsSUFBSSxLQUFLLEdBQUcsSUFBSSxFQUFFO0lBQzFCLFlBQVksTUFBTSxJQUFJLEtBQUssRUFBRSxnQ0FBZ0MsRUFBRSxLQUFLLEVBQUUsSUFBSTtJQUMxRTtJQUNBLFFBQVEsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLO0lBQzNCLFFBQVEsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDaEMsUUFBUSxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUM5QixRQUFRLElBQUksQ0FBQyxhQUFhLEdBQUcsWUFBWSxDQUFDO0lBQzFDLFFBQVEsSUFBSSxDQUFDLFFBQVE7SUFDckIsUUFBUSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUs7SUFDMUI7O0lBRUEsSUFBSSxJQUFJLEdBQUc7SUFDWCxRQUFRLElBQUksT0FBTztJQUNuQixRQUFRLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtJQUN4QixZQUFZLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDL0M7SUFDQSxRQUFRLElBQUksSUFBSSxDQUFDLFFBQVEsSUFBSSxTQUFTLEVBQUU7SUFDeEM7SUFDQSxZQUFZLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUMzRCxTQUFTO0lBQ1Q7SUFDQTtJQUNBO0lBQ0E7SUFDQSxRQUFRLE9BQU8sSUFBSSxFQUFFO0lBQ3JCLFlBQVksT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFROztJQUVuQztJQUNBLFlBQVksSUFBSSxHQUFHLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFDO0lBQzVELFlBQVksSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUU7SUFDOUMsZ0JBQWdCLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDbkQ7O0lBRUEsWUFBWSxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLFFBQVE7O0lBRXREO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsWUFBWSxNQUFNLFVBQVU7SUFDNUIsZ0JBQWdCLE9BQU8sSUFBSSxLQUFLO0lBQ2hDLGdCQUFnQixJQUFJLENBQUMsYUFBYSxJQUFJLEtBQUs7SUFDM0MsZ0JBQWdCLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJO0lBQ3pDLGFBQWE7SUFDYixZQUFZLElBQUksVUFBVSxFQUFFO0lBQzVCLGdCQUFnQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQztJQUNqRSxnQkFBZ0IsSUFBSSxPQUFPLElBQUksU0FBUyxFQUFFO0lBQzFDLG9CQUFvQixPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSTtJQUN0RDtJQUNBLGdCQUFnQjtJQUNoQjs7SUFFQSxZQUFZLElBQUksT0FBTyxFQUFFO0lBQ3pCLGdCQUFnQixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUk7SUFDakMsYUFBYSxNQUFNO0lBQ25CO0lBQ0EsZ0JBQWdCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDO0lBQ2pFLGdCQUFnQixJQUFJLE9BQU8sSUFBSSxTQUFTLEVBQUU7SUFDMUMsb0JBQW9CLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSTtJQUNyQztJQUNBO0lBQ0EsWUFBWSxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQzlDO0lBQ0E7O0lBRUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRztJQUN4QixRQUFRLE9BQU8sSUFBSTtJQUNuQjtJQUNBOztJQ3BTQTtJQUNBO0lBQ0E7O0lBRUE7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOzs7O0lBSUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBOztJQUVBLE1BQU0sS0FBSyxDQUFDOztJQUVaLENBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUU7SUFDeEMsRUFBRSxPQUFPLEdBQUcsT0FBTyxJQUFJO0lBQ3ZCLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTO0lBQzVCLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJO0lBQ2xCLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssU0FBUyxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsSUFBSTtJQUNqRSxFQUFFLElBQUksQ0FBQyxhQUFhLEdBQUcsRUFBRTtJQUN6Qjs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLENBQUMsU0FBUyxDQUFDLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRTtJQUMvQixFQUFFLElBQUksQ0FBQyxRQUFRLElBQUksT0FBTyxRQUFRLEtBQUssVUFBVSxFQUFFO0lBQ25ELEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsRUFBRSxRQUFRLENBQUM7SUFDdkQ7SUFDQSxFQUFFLE1BQU0sR0FBRyxHQUFHLElBQUksWUFBWSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDO0lBQ3ZELEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQzlCO0lBQ0EsS0FBSyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLElBQUksRUFBRTtJQUNoQyxNQUFNLEdBQUcsQ0FBQyxZQUFZLEdBQUcsSUFBSTtJQUM3QixNQUFNLElBQUksSUFBSSxHQUFHLElBQUk7SUFDckIsTUFBTSxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVk7SUFDekMsT0FBTyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO0lBQzFFLE9BQU8sR0FBRyxDQUFDLFlBQVksR0FBRyxLQUFLO0lBQy9CLE9BQU8sS0FBSyxJQUFJLElBQUksSUFBSSxLQUFLLEVBQUU7SUFDL0IsUUFBUSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQztJQUN2QztJQUNBLE9BQU8sQ0FBQztJQUNSO0lBQ0EsRUFBRSxPQUFPO0lBQ1Q7O0lBRUE7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFO0lBQzVCLEVBQUUsSUFBSSxLQUFLLEVBQUUsR0FBRztJQUNoQixFQUFFLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFO0lBQzFCO0lBQ0EsR0FBRyxJQUFJLEdBQUcsQ0FBQyxVQUFVLEVBQUU7SUFDdkIsSUFBSTtJQUNKO0lBQ0EsR0FBRyxLQUFLLEdBQUc7SUFDWCxJQUFJLEdBQUcsRUFBRSxJQUFJLENBQUMsU0FBUztJQUN2QixJQUFJLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtJQUNuQixJQUFJLEdBQUcsRUFBRSxHQUFHO0lBQ1osSUFBSSxJQUFJLEVBQUU7SUFDVjtJQUNBLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLFNBQVM7SUFDbEMsR0FBRyxJQUFJO0lBQ1AsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQztJQUN2QyxJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUU7SUFDakIsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDaEU7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFO0lBQ2xCLEVBQUUsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDO0lBQzNDLEVBQUUsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUU7SUFDaEIsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3BDLEdBQUcsR0FBRyxDQUFDLFNBQVMsRUFBRTtJQUNsQjtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTs7SUFFQSxNQUFNLFlBQVksQ0FBQzs7SUFFbkIsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7SUFDdkMsRUFBRSxPQUFPLEdBQUcsT0FBTyxJQUFJO0lBQ3ZCLEVBQUUsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLO0lBQ3BCLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSTtJQUN4QixFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUc7SUFDbEIsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUk7SUFDM0UsRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUs7SUFDM0IsRUFBRSxJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUs7SUFDekIsRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHO0lBQ3hCOztJQUVBLENBQUMsU0FBUyxHQUFHO0lBQ2IsRUFBRSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUk7SUFDeEIsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLFNBQVM7SUFDM0IsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7SUFDOUI7SUFDQTs7O0lBR0E7O0lBRUE7O0lBRUE7O0lBRUE7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBOztJQUVPLFNBQVMsZ0JBQWdCLEVBQUUsTUFBTSxFQUFFO0lBQzFDLENBQUMsTUFBTSxDQUFDLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUFFO0lBQ3ZDLENBQUMsTUFBTSxDQUFDLGlCQUFpQixHQUFHLEVBQUU7SUFDOUIsQ0FBQyxPQUFPLE1BQU07SUFDZDs7SUFHQTtJQUNBOztJQUVBO0lBQ0E7O0lBRU8sU0FBUyxpQkFBaUIsQ0FBQyxVQUFVLEVBQUU7O0lBRTlDLENBQUMsU0FBUyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFO0lBQ3pDLEVBQUUsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7SUFDcEQsRUFBRSxJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUU7SUFDMUIsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQztJQUMzQztJQUNBLEVBQUUsT0FBTyxLQUFLO0lBQ2Q7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxTQUFTLGNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFO0lBQ3hDO0lBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7SUFDMUMsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixFQUFFLElBQUksQ0FBQztJQUNqRDtJQUNBLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNwRTtJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxDQUFDLFNBQVMsRUFBRSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO0lBQ3RDLEVBQUUsT0FBTyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUM7SUFDbEU7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxHQUFHLEVBQUU7SUFDbkIsRUFBRSxPQUFPLGdCQUFnQixDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQztJQUMxRDs7SUFHQSxDQUFDLFNBQVMscUJBQXFCLENBQUMsSUFBSSxFQUFFO0lBQ3RDLEVBQUUsT0FBTyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsYUFBYTtJQUNuRDs7OztJQUlBO0lBQ0E7O0lBRUE7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQSxDQUFDLFNBQVMsa0JBQWtCLENBQUMsVUFBVSxFQUFFO0lBQ3pDLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUM5QixHQUFHO0lBQ0g7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLEVBQUUsSUFBSSxZQUFZLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSztJQUM5QyxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsSUFBSTtJQUMxQixHQUFHLElBQUksRUFBRSxHQUFHLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUM7SUFDeEMsR0FBRyxJQUFJLElBQUksR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksSUFBSSxLQUFLLENBQUM7SUFDdkUsR0FBRyxPQUFPLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7SUFDMUIsR0FBRyxFQUFFLElBQUksQ0FBQzs7SUFFVjtJQUNBLEVBQUUsTUFBTSxHQUFHLEdBQUcsWUFBWSxDQUFDLE1BQU07SUFDakMsRUFBRSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsaUJBQWlCO0lBQ3BDLEVBQUUsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU07SUFDL0M7SUFDQSxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsT0FBTyxHQUFHLEdBQUc7SUFDL0M7SUFDQSxFQUFFLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUU7SUFDNUIsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDbkM7SUFDQTtJQUNBLEVBQUUsSUFBSSxPQUFPLElBQUksQ0FBQyxFQUFFO0lBQ3BCLEdBQUcsSUFBSSxJQUFJLEdBQUcsSUFBSTtJQUNsQixHQUFHLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVztJQUNyQyxJQUFJLEtBQUssSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFO0lBQ3pEO0lBQ0EsS0FBSyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDO0lBQ2xDO0lBQ0EsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsRUFBRTtJQUMvQixJQUFJLENBQUM7SUFDTDtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBLENBQUMsU0FBUyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO0lBQzVDLEVBQUUsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUk7SUFDbkQsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQztJQUN0QixHQUFHLENBQUMsQ0FBQztJQUNMOztJQUVBO0lBQ0E7SUFDQTtJQUNBLENBQUMsU0FBUyxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRTtJQUN0QyxFQUFFLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNoRDs7SUFFQSxDQUFDLFVBQVUsQ0FBQyxjQUFjLEdBQUcsY0FBYztJQUMzQyxDQUFDLFVBQVUsQ0FBQyxlQUFlLEdBQUcsZUFBZTtJQUM3QyxDQUFDLFVBQVUsQ0FBQyxvQkFBb0IsR0FBRyxvQkFBb0I7SUFDdkQsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLEdBQUcsa0JBQWtCO0lBQ25ELENBQUMsVUFBVSxDQUFDLHFCQUFxQixHQUFHLHFCQUFxQjtJQUN6RCxDQUFDLFVBQVUsQ0FBQyxFQUFFLEdBQUcsRUFBRTtJQUNuQixDQUFDLFVBQVUsQ0FBQyxHQUFHLEdBQUcsR0FBRztJQUNyQjtJQU1BO0lBQ0E7O0lBRUE7SUFDQTs7SUFFTyxNQUFNLGFBQWEsQ0FBQzs7SUFFM0IsQ0FBQyxXQUFXLENBQUMsQ0FBQyxLQUFLLEVBQUU7SUFDckIsRUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUM7SUFDeEIsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUs7SUFDckIsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM1Qzs7SUFFQSxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRTtJQUM3QixFQUFFLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtJQUN4QixHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3ZCO0lBQ0E7O0lBRUEsQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ2xDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUU7SUFDbkIsRUFBRSxJQUFJLEtBQUssSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0lBQzVCLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLO0lBQ3RCLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDO0lBQ3hDO0lBQ0E7SUFDQTtJQUNBLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUM7O0lDaFUxQztJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLE1BQU0sSUFBSSxHQUFHLFNBQVM7SUFDdEIsTUFBTSxNQUFNLEdBQUcsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7O0lBRW5CLFNBQVMsYUFBYSxFQUFFLE1BQU0sRUFBRTtJQUN2QyxJQUFJLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0lBQ25DOztJQUVPLFNBQVMsY0FBYyxFQUFFLFVBQVUsRUFBRTs7SUFFNUMsSUFBSSxTQUFTLFFBQVEsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUM1QyxRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsT0FBTztJQUNwQyxRQUFRLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RDLFFBQVEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7SUFDMUIsWUFBWSxJQUFJLENBQUMsS0FBSztJQUN0QixZQUFZLE9BQU87SUFDbkIsWUFBWSxNQUFNLEVBQUUsU0FBUztJQUM3QixZQUFZLE9BQU8sRUFBRTtJQUNyQixTQUFTLENBQUM7O0lBRVY7SUFDQSxRQUFRLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtJQUM5QyxZQUFZLEdBQUcsRUFBRSxZQUFZO0lBQzdCLGdCQUFnQixPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTTtJQUMvQyxhQUFhO0lBQ2IsWUFBWSxHQUFHLEVBQUUsVUFBVSxNQUFNLEVBQUU7SUFDbkMsZ0JBQWdCLElBQUksSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRTtJQUMzQyxvQkFBb0IsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQztJQUNwRTtJQUNBLGdCQUFnQixJQUFJLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sRUFBRTtJQUN4RCxvQkFBb0IsSUFBSSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDO0lBQzlEO0lBQ0E7SUFDQSxTQUFTLENBQUM7SUFDVjs7SUFFQSxJQUFJLFNBQVMsT0FBTyxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUU7O0lBRXZDLFFBQVEsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ3JDLFFBQVEsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFROztJQUV0QyxRQUFRLElBQUksS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUU7SUFDMUMsWUFBWSxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsc0JBQXNCLENBQUMsQ0FBQztJQUNoRTs7SUFFQSxRQUFRLE1BQU0sUUFBUSxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxNQUFNLEdBQUcsQ0FBQyxNQUFNLENBQUM7O0lBRXBFO0lBQ0EsUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtJQUN0QyxZQUFZLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO0lBQzdELGdCQUFnQixDQUFDLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDckQsYUFBYTtJQUNiO0lBQ0EsUUFBUSxLQUFLLENBQUMsT0FBTyxHQUFHLEVBQUU7O0lBRTFCO0lBQ0EsUUFBUSxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQU07SUFDN0IsUUFBUSxLQUFLLENBQUMsSUFBSSxHQUFHLElBQUk7O0lBRXpCO0lBQ0EsUUFBUSxJQUFJLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUU7SUFDdEMsWUFBWSxNQUFNLE9BQU8sR0FBRyxVQUFVLElBQUksRUFBRTtJQUM1QyxnQkFBZ0IsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDO0lBQ3hELGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ3hCLFlBQVksS0FBSyxNQUFNLENBQUMsSUFBSSxRQUFRLEVBQUU7SUFDdEMsZ0JBQWdCLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDM0Q7SUFDQSxZQUFZLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3hEO0lBQ0E7O0lBRUEsSUFBSSxNQUFNLEdBQUcsR0FBRyxFQUFFO0lBQ2xCLElBQUksR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxRQUFRO0lBQ3RDLElBQUksR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxPQUFPO0lBQ3JDLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDO0lBQ2xDOztJQ3RGQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRU8sTUFBTSxXQUFXLENBQUM7O0lBRXpCLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRTtJQUNsQixFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRztJQUNqQjs7SUFFQSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDOztJQUU3QjtJQUNBO0lBQ0E7SUFDQTtJQUNBLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtJQUNsQixLQUFLLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUM7SUFDdkM7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtJQUNsQixRQUFRLElBQUksUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxFQUFFO0lBQ3RELFlBQVksT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUM7SUFDbEQsU0FBUztJQUNULFFBQVEsT0FBTyxDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUM7SUFDeEQ7SUFDQTs7O0lBMEJBO0lBQ0E7SUFDQTs7SUFFTyxNQUFNLGFBQWEsU0FBUyxXQUFXLENBQUM7O0lBRS9DLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUU7SUFDeEIsUUFBUSxLQUFLLENBQUMsR0FBRyxDQUFDO0lBQ2xCLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJO0lBQ3BCOztJQUVBLENBQUMsS0FBSyxHQUFHO0lBQ1QsUUFBUSxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEtBQUs7SUFDakQ7SUFDQTs7O0lBR0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRU8sTUFBTSxhQUFhLFNBQVMsV0FBVyxDQUFDO0lBQy9DO0lBQ0EsSUFBSSxXQUFXLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRTtJQUMzQixRQUFRLEtBQUssQ0FBQyxHQUFHLENBQUM7SUFDbEIsUUFBUSxNQUFNO0lBQ2QsWUFBWSxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDekIsWUFBWSxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDekIsWUFBWSxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDN0IsWUFBWSxTQUFTLENBQUMsRUFBRSxDQUFDO0lBQ3pCLFNBQVMsR0FBRyxJQUFJO0lBQ2hCO0lBQ0EsUUFBUSxJQUFJLENBQUMsU0FBUyxHQUFHLFVBQVUsRUFBRSxFQUFFO0lBQ3ZDLFlBQVksSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUU7SUFDM0IsWUFBWSxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDekMsU0FBUztJQUNULFFBQVEsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLEVBQUUsRUFBRTtJQUN2QyxZQUFZLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFO0lBQzNCLFlBQVksT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDNUI7SUFDQSxRQUFRLElBQUksQ0FBQyxTQUFTLEdBQUcsVUFBVSxFQUFFLEVBQUU7SUFDdkMsWUFBWSxPQUFPLEVBQUU7SUFDckI7SUFDQTs7SUFFQSxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7SUFDbEIsUUFBUSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztJQUN4QyxRQUFRLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0lBQ3hDLFFBQVEsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7SUFDeEMsUUFBUSxPQUFPO0lBQ2YsWUFBWSxRQUFRLEVBQUUsR0FBRztJQUN6QixZQUFZLFFBQVEsRUFBRSxHQUFHO0lBQ3pCLFlBQVksWUFBWSxFQUFFLEdBQUc7SUFDN0IsWUFBWSxTQUFTLEVBQUUsTUFBTTtJQUM3QixZQUFZLEtBQUssRUFBRSxHQUFHO0lBQ3RCLFlBQVksT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7SUFDMUM7SUFDQTtJQUNBOzs7SUFHQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLFNBQVMsTUFBTSxFQUFFLEVBQUUsRUFBRTtJQUNyQixJQUFJLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDMUI7SUFDQSxTQUFTLE9BQU8sRUFBRSxFQUFFLEVBQUU7SUFDdEIsSUFBSSxPQUFPLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUM3QjtJQUNBLFNBQVMsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUN4QixJQUFJLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRTtJQUNqQixRQUFRLE9BQU8sTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDO0lBQ2pDLEtBQUssTUFBTTtJQUNYLFFBQVEsT0FBTyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDN0M7SUFDQTs7SUFFTyxNQUFNLGlCQUFpQixTQUFTLFdBQVcsQ0FBQzs7SUFFbkQsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRTtJQUN4QixFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUM7SUFDWixRQUFRLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLE1BQU0sQ0FBQyxHQUFHLElBQUk7SUFDbkMsUUFBUSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0lBRTNDO0lBQ0EsUUFBUSxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQztJQUNsQyxRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsVUFBVSxFQUFFLEVBQUU7SUFDcEM7SUFDQTtJQUNBO0lBQ0EsWUFBWSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUU7SUFDeEIsWUFBWSxFQUFFLEdBQUcsRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ3JDO0lBQ0EsWUFBWSxJQUFJLE1BQU0sSUFBSSxTQUFTLEVBQUU7SUFDckMsZ0JBQWdCLEVBQUUsR0FBRyxNQUFNLENBQUMsRUFBRSxDQUFDO0lBQy9CLGFBQWEsTUFBTSxJQUFJLE1BQU0sSUFBSSxVQUFVLEVBQUU7SUFDN0MsZ0JBQWdCLEVBQUUsR0FBRyxPQUFPLENBQUMsRUFBRSxDQUFDO0lBQ2hDLGFBQWEsTUFBTSxJQUFJLE1BQU0sSUFBSSxhQUFhLEVBQUU7SUFDaEQsZ0JBQWdCLEVBQUUsR0FBRyxTQUFTLENBQUMsRUFBRSxDQUFDO0lBQ2xDO0lBQ0E7SUFDQSxZQUFZLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDaEMsWUFBWSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ2hDLFlBQVksT0FBTyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUU7SUFDbEM7SUFDQTs7SUFFQSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUU7SUFDZixRQUFRLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVE7SUFDakU7SUFDQTs7OztJQUlBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUEsU0FBU0MsYUFBVyxDQUFDLE1BQU0sRUFBRTs7SUFFN0IsSUFBSSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0lBQzNCLFFBQVEsT0FBTyxTQUFTLFlBQVksSUFBSSxDQUFDLE9BQU8sU0FBUyxDQUFDO0lBQzFELEtBQUssTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO0lBQ25DLFFBQVEsT0FBTyxTQUFTLFlBQVksSUFBSSxDQUFDLE9BQU8sTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzdEOztJQUVBO0lBQ0EsSUFBSSxNQUFNLFlBQVksR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2hFO0lBQ0EsSUFBSSxPQUFPLFNBQVMsWUFBWSxDQUFDLE1BQU0sRUFBRTtJQUN6QztJQUNBLE1BQU0sSUFBSSxNQUFNLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ3hDLFFBQVEsTUFBTSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDO0lBQ2pELFFBQVEsTUFBTSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDO0lBQ2pELFFBQVEsT0FBTyxNQUFNLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxLQUFLLE1BQU0sR0FBRyxNQUFNLENBQUMsSUFBSSxPQUFPLEdBQUcsT0FBTyxDQUFDLENBQUM7SUFDdEY7SUFDQTtJQUNBO0lBQ0EsTUFBTSxJQUFJLE1BQU0sSUFBSSxZQUFZLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtJQUM5RCxRQUFRLE1BQU0sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsWUFBWSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZFLFFBQVEsTUFBTSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDdkUsUUFBUSxPQUFPLE1BQU0sSUFBSSxDQUFDLE1BQU0sR0FBRyxPQUFPLEtBQUssTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsQ0FBQztJQUN0RjtJQUNBO0lBQ0E7SUFDQSxNQUFNLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtJQUN4RCxRQUFRLElBQUksTUFBTSxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLElBQUksWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtJQUM5RSxVQUFVLE1BQU0sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQztJQUNuRCxVQUFVLE1BQU0sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDdkQ7SUFDQSxVQUFVLE9BQU8sTUFBTSxJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sS0FBSyxNQUFNLEdBQUcsTUFBTSxDQUFDLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxDQUFDO0lBQ3hGO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsTUFBTSxPQUFPLFNBQVM7SUFDdEIsS0FBSztJQUNMO0lBQ0E7O0lBRU8sTUFBTSxvQkFBb0IsU0FBUyxXQUFXLENBQUM7O0lBRXRELElBQUksV0FBVyxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUU7SUFDN0IsUUFBUSxLQUFLLENBQUMsR0FBRyxDQUFDO0lBQ2xCO0lBQ0EsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHQSxhQUFXLENBQUMsTUFBTSxDQUFDO0lBQ3pDOztJQUVBLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtJQUNsQixRQUFRLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDO0lBQ3pEO0lBQ0E7O0lDdlFBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRUEsTUFBTSxLQUFLLEdBQUcsWUFBWTtJQUMxQixJQUFJLE9BQU8sV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU07SUFDbkM7O0lBRUEsTUFBTSxLQUFLLEdBQUcsWUFBWTtJQUMxQixJQUFJLE9BQU8sSUFBSSxJQUFJLEVBQUUsQ0FBQyxNQUFNO0lBQzVCOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFTyxNQUFNLEtBQUssR0FBRyxZQUFZO0lBQ2pDLElBQUksTUFBTSxRQUFRLEdBQUcsS0FBSyxFQUFFO0lBQzVCLElBQUksTUFBTSxRQUFRLEdBQUcsS0FBSyxFQUFFO0lBQzVCLElBQUksT0FBTztJQUNYLFFBQVEsR0FBRyxFQUFFLFlBQVk7SUFDekIsWUFBWSxPQUFPLFFBQVEsSUFBSSxLQUFLLEVBQUUsR0FBRyxRQUFRO0lBQ2pEO0lBQ0E7SUFDQSxDQUFDLEVBQUU7OztJQUdIO0lBQ08sU0FBUyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtJQUMxQixJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDNUI7SUFFTyxTQUFTLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFO0lBQ2hDLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsSUFBSTtJQUMvQixJQUFJLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDO0lBQ3hCLElBQUksT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDakI7OztJQUdBO0lBQ0E7SUFDQTs7SUFFTyxTQUFTLEtBQUssRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLElBQUksR0FBRyxDQUFDLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUN6RCxJQUFJLE1BQU0sTUFBTSxHQUFHLEVBQUU7SUFDckIsSUFBSSxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU87SUFDdkMsSUFBSSxJQUFJLElBQUksS0FBSyxDQUFDLEVBQUU7SUFDcEIsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixDQUFDO0lBQy9DO0lBQ0EsSUFBSSxJQUFJLEtBQUssR0FBRyxHQUFHLEVBQUU7SUFDckIsUUFBUSxLQUFLLElBQUksQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsSUFBSSxJQUFJLEVBQUU7SUFDaEQsVUFBVSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN4QjtJQUNBLEtBQUssTUFBTSxJQUFJLEtBQUssR0FBRyxHQUFHLEVBQUU7SUFDNUIsUUFBUSxLQUFLLElBQUksQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsSUFBSSxJQUFJLEVBQUU7SUFDaEQsVUFBVSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN4QjtJQUNBO0lBQ0EsSUFBSSxJQUFJLFdBQVcsRUFBRTtJQUNyQixRQUFRLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ3hCO0lBQ0EsSUFBSSxPQUFPLE1BQU07SUFDakI7OztJQUdBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRU8sU0FBUyxPQUFPLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUM3RCxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLEdBQUcsT0FBTyxDQUFDO0lBQ3pDLElBQUksSUFBSSxTQUFTLElBQUksU0FBUyxFQUFFO0lBQ2hDLFFBQVEsSUFBSSxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUN4RCxRQUFRLElBQUksT0FBTyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzdELFFBQVEsT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDO0lBQ3ZDLEtBQUssTUFBTSxJQUFJLFNBQVMsSUFBSSxTQUFTLEVBQUU7SUFDdkMsUUFBUSxPQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDO0lBQ2hFO0lBQ0E7SUFDQSxJQUFJLElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDNUIsUUFBUSxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLE1BQU07SUFDdEQ7SUFDQTtJQUNBLElBQUksSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUN6QixJQUFJLE9BQU8sQ0FBQyxHQUFHLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM5Qjs7SUM1RkE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7O0lBR0E7SUFDQSxTQUFTLGFBQWEsQ0FBQyxJQUFJLEVBQUU7SUFDN0IsSUFBSSxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ3RCOztJQUVBO0lBQ0EsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7SUFDaEMsSUFBSSxPQUFPLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDN0M7O0lBRUE7SUFDQSxTQUFTLGlCQUFpQixDQUFDLElBQUksRUFBRTtJQUNqQyxJQUFJLE9BQU8sUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUM3Qzs7O0lBR08sTUFBTSxpQkFBaUIsU0FBUyxlQUFlLENBQUM7O0lBRXZELElBQUksV0FBVyxDQUFDLEdBQUcsRUFBRTtJQUNyQixRQUFRLEtBQUssRUFBRTtJQUNmLFFBQVEsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHO0lBQ3ZCOztJQUVBLElBQUksSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQzs7SUFFakM7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7SUFDbkIsUUFBUSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDbkMsUUFBUSxNQUFNLE1BQU0sR0FBRztJQUN2QixZQUFZLE1BQU0sRUFBRSxFQUFFO0lBQ3RCLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7SUFDbEQsWUFBWSxJQUFJLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDaEMsWUFBWSxJQUFJLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDaEMsWUFBWSxLQUFLLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQ2hDLFlBQVksSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDOUIsU0FBUztJQUNULFFBQVEsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUU7SUFDekMsUUFBUSxJQUFJLE9BQU8sRUFBRSxJQUFJO0lBQ3pCLFFBQVEsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLE1BQU07SUFDakMsUUFBUSxJQUFJLElBQUksSUFBSSxDQUFDLEVBQUU7SUFDdkIsWUFBWSxPQUFPLE1BQU0sQ0FBQztJQUMxQjtJQUNBLFFBQVEsSUFBSSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxhQUFhLENBQUM7SUFDdEUsUUFBUSxJQUFJLEtBQUssRUFBRTtJQUNuQjtJQUNBO0lBQ0EsWUFBWSxJQUFJLEdBQUcsS0FBSyxDQUFDLEdBQUc7SUFDNUIsWUFBWSxJQUFJLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsRUFBRTtJQUM1RCxnQkFBZ0IsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUMvRDtJQUNBO0lBQ0EsUUFBUSxJQUFJLE9BQU8sSUFBSSxTQUFTLEVBQUU7SUFDbEM7SUFDQSxZQUFZLElBQUksR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUMvQixZQUFZLElBQUksSUFBSSxJQUFJLFNBQVMsRUFBRTtJQUNuQztJQUNBLGdCQUFnQixJQUFJLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsRUFBRTtJQUNoRSxvQkFBb0IsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQztJQUNuRSxpQkFBaUI7SUFDakI7SUFDQSxTQUFTO0lBQ1QsUUFBUSxJQUFJLE9BQU8sSUFBSSxTQUFTLEVBQUU7SUFDbEM7SUFDQSxZQUFZLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDO0lBQ3hEOztJQUVBO0lBQ0EsUUFBUSxJQUFJLENBQUMsSUFBSSxPQUFPLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxFQUFFO0lBQzFELFlBQVksTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDcEQ7SUFDQTtJQUNBLFFBQVEsSUFBSSxDQUFDLElBQUksT0FBTyxDQUFDLElBQUksSUFBSSxPQUFPLENBQUMsSUFBSSxHQUFHLElBQUksRUFBRTtJQUN0RCxZQUFZLE1BQU0sQ0FBQyxJQUFJLElBQUksaUJBQWlCLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNqRTtJQUNBLFFBQVEsSUFBSSxDQUFDLElBQUksT0FBTyxDQUFDLEtBQUssSUFBSSxPQUFPLENBQUMsS0FBSyxHQUFHLElBQUksRUFBRTtJQUN4RCxZQUFZLE1BQU0sQ0FBQyxJQUFJLElBQUksZ0JBQWdCLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNqRSxTQUFTO0lBQ1Q7SUFDQSxRQUFRLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUNyRCxRQUFRLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0lBQ3RDLFlBQVksSUFBSSxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHO0lBQzFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUM7SUFDckQsWUFBWSxNQUFNLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQzVGLFlBQVksTUFBTSxDQUFDLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQzVGLFlBQVksTUFBTSxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUc7SUFDN0MsU0FBUyxNQUFNO0lBQ2YsWUFBWSxNQUFNLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJO0lBQ3JDLFlBQVksTUFBTSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsSUFBSTtJQUN0QztJQUNBLFlBQVksSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUk7SUFDbEMsWUFBWSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRTtJQUNyQyxnQkFBZ0IsR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQztJQUNoRDtJQUNBLFlBQVksSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUs7SUFDcEMsWUFBWSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxRQUFRLEVBQUU7SUFDckMsZ0JBQWdCLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUM7SUFDbkQ7SUFDQSxZQUFZLE1BQU0sQ0FBQyxHQUFHLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO0lBQzNEO0lBQ0EsUUFBUSxPQUFPLE1BQU07SUFDckI7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBOztJQUVBLFNBQVMsVUFBVSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFOztJQUU3QyxJQUFJLFNBQVMsa0JBQWtCLENBQUMsRUFBRSxFQUFFO0lBQ3BDLFFBQVEsT0FBTyxFQUFFO0lBQ2pCO0lBQ0E7SUFDQSxJQUFJLElBQUksSUFBSSxHQUFHLENBQUM7SUFDaEIsQ0FBQyxJQUFJLEtBQUssR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUM7SUFDM0IsQ0FBQyxVQUFVLEdBQUcsVUFBVSxJQUFJLGtCQUFrQjtJQUM5QyxDQUFDLE9BQU8sSUFBSSxJQUFJLEtBQUssRUFBRTtJQUN2QixFQUFFLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEdBQUcsS0FBSyxJQUFJLENBQUMsQ0FBQztJQUM1QyxFQUFFLElBQUksU0FBUyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDdEMsRUFBRSxJQUFJLFNBQVMsS0FBSyxNQUFNLEVBQUU7SUFDNUIsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3RCLEdBQUcsTUFBTSxJQUFJLFNBQVMsR0FBRyxNQUFNLEVBQUU7SUFDakMsS0FBSyxJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztJQUNwQixHQUFHLE1BQU07SUFDVCxLQUFLLEtBQUssR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCO0lBQ0E7SUFDQSxHQUFHLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDeEI7O0lDOUpBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVPLE1BQU0sS0FBSyxDQUFDOztJQUVuQixJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO0lBQzVCLFFBQVEsTUFBTSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsR0FBRyxPQUFPO0lBQy9DLFFBQVEsTUFBTSxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsR0FBRyxPQUFPO0lBQzlDO0lBQ0EsUUFBUUYsZUFBc0IsQ0FBQyxJQUFJLENBQUM7SUFDcEM7SUFDQTtJQUNBO0lBQ0EsUUFBUUcsZ0JBQXNCLENBQUMsSUFBSSxDQUFDO0lBQ3BDLFFBQVEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7O0lBRWxEO0lBQ0EsUUFBUSxJQUFJLENBQUMsTUFBTTtJQUNuQjtJQUNBLFFBQVEsSUFBSSxDQUFDLFdBQVcsR0FBRyxVQUFVO0lBQ3JDLFFBQVEsSUFBSSxDQUFDLGFBQWE7SUFDMUIsUUFBUSxJQUFJLENBQUMsY0FBYyxHQUFHLEVBQUU7O0lBRWhDO0lBQ0EsUUFBUSxJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQzs7SUFFbkQ7O0lBRUE7SUFDQSxJQUFJLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksQ0FBQyxNQUFNO0lBQ3BDLElBQUksSUFBSSxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQUs7O0lBRTFDO0lBQ0EsSUFBSSxJQUFJLFlBQVksQ0FBQyxHQUFHO0lBQ3hCLFFBQVEsT0FBTyxJQUFJLENBQUMsYUFBYTtJQUNqQzs7SUFFQTtJQUNBLElBQUksSUFBSSxLQUFLLENBQUMsR0FBRztJQUNqQixRQUFRLElBQUksSUFBSSxDQUFDLGFBQWEsSUFBSSxTQUFTLEVBQUU7SUFDN0MsWUFBWSxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7SUFDM0Q7SUFDQSxRQUFRLE9BQU8sSUFBSSxDQUFDLGFBQWE7SUFDakM7O0lBRUEsSUFBSSxRQUFRLENBQUMsR0FBRztJQUNoQixRQUFRLE1BQU0sS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7SUFDaEQsUUFBUSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDdkMsUUFBUSxPQUFPLEtBQUs7SUFDcEI7O0lBRUEsSUFBSSxXQUFXLEdBQUc7SUFDbEIsUUFBUSxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDaEQsWUFBWSxLQUFLLENBQUMsS0FBSyxFQUFFO0lBQ3pCO0lBQ0E7O0lBRUEsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO0lBQ2xCLFFBQVEsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDdkM7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDdkIsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU87SUFDOUQsUUFBUSxJQUFJLEtBQUssR0FBRyxJQUFJLEVBQUU7SUFDMUIsWUFBWSxNQUFNLElBQUksS0FBSyxFQUFFLGdDQUFnQyxFQUFFLEtBQUssRUFBRSxJQUFJO0lBQzFFO0lBQ0EsUUFBUSxLQUFLLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQzFCLFFBQVEsSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUN4QixRQUFRLEtBQUssR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsS0FBSyxDQUFDO0lBQ3ZELFFBQVEsSUFBSSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLENBQUM7SUFDcEQsUUFBUSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFO0lBQ3JDLFFBQVEsT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO0lBQ2hFLGFBQWEsR0FBRyxDQUFDLENBQUMsTUFBTSxLQUFLO0lBQzdCLGdCQUFnQixPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDO0lBQzFELGFBQWEsQ0FBQztJQUNkO0lBQ0E7QUFDQUYsb0JBQXVCLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQztBQUN4Q0cscUJBQXVCLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQzs7O0lBR3hDO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVPLE1BQU0sVUFBVSxDQUFDOztJQUV4QixJQUFJLFdBQVcsQ0FBQyxLQUFLLEVBQUU7SUFDdkIsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUs7SUFDM0I7SUFDQSxRQUFRLElBQUksQ0FBQyxPQUFPO0lBQ3BCO0lBQ0EsUUFBUSxJQUFJLENBQUMsTUFBTTtJQUNuQjs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7SUFDbEIsUUFBUSxNQUFNLFdBQVc7SUFDekIsWUFBWSxJQUFJLENBQUMsT0FBTyxJQUFJLFNBQVM7SUFDckMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsTUFBTTtJQUMzRCxTQUFTO0lBQ1QsUUFBUTtJQUNSLFlBQVksQ0FBQyxXQUFXO0lBQ3hCLFlBQVksSUFBSSxDQUFDLE1BQU0sSUFBSSxTQUFTO0lBQ3BDLFlBQVksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3pCLFVBQVU7SUFDVjtJQUNBLFlBQVksT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUM7SUFDM0M7SUFDQTtJQUNBLFFBQVEsSUFBSSxXQUFXLEVBQUU7SUFDekIsWUFBWSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDM0Q7SUFDQTtJQUNBLFFBQVEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxLQUFLO0lBQzFELFlBQVksT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUN0QyxTQUFTLENBQUM7SUFDVixRQUFRLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWTtJQUMzRjtJQUNBLFFBQVEsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLElBQUksU0FBUyxHQUFHLEtBQUs7SUFDekQsUUFBUSxPQUFPLEtBQUs7SUFDcEI7O0lBRUEsSUFBSSxLQUFLLEdBQUc7SUFDWixRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsU0FBUztJQUNoQyxRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsU0FBUztJQUMvQjtJQUNBOzs7O0lBSUE7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTs7SUFFTyxNQUFNLFVBQVUsU0FBUyxLQUFLLENBQUM7O0lBRXRDLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDNUIsUUFBUSxNQUFNLENBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsR0FBRyxPQUFPO0lBQ25ELFFBQVEsS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDLGVBQWUsRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDakU7SUFDQSxRQUFRQyxhQUFxQixDQUFDLElBQUksQ0FBQztJQUNuQyxRQUFRLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUM7SUFDcEM7SUFDQSxRQUFRLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRztJQUN0Qjs7SUFFQSxJQUFJLGFBQWEsQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFO0lBQ2pDLFFBQVEsSUFBSSxRQUFRLElBQUksS0FBSyxFQUFFO0lBQy9CLFlBQVksSUFBSSxFQUFFLEdBQUcsWUFBWSxpQkFBaUIsQ0FBQyxFQUFFO0lBQ3JELGdCQUFnQixNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsNkJBQTZCLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN0RTtJQUNBLFlBQVksT0FBTyxHQUFHLENBQUM7SUFDdkI7SUFDQTs7SUFFQSxJQUFJLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUU7SUFDckMsUUFBUSxJQUFJLFFBQVEsSUFBSSxLQUFLLEVBQUU7SUFDL0IsWUFBWSxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksU0FBUyxJQUFJLElBQUksSUFBSSxPQUFPLEVBQUU7SUFDNUQsZ0JBQWdCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsR0FBRztJQUMzRCxhQUFhO0lBQ2IsWUFBWSxJQUFJLENBQUMsV0FBVyxFQUFFO0lBQzlCLFlBQVksSUFBSSxDQUFDLGdCQUFnQixFQUFFO0lBQ25DLFlBQVksSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUM7SUFDMUMsU0FBUztJQUNUO0lBQ0E7QUFDQUMsa0JBQXNCLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQzs7OztJQUk1QztJQUNBO0lBQ0E7O0lBRUE7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRU8sTUFBTSxlQUFlLENBQUM7SUFDN0IsSUFBSSxXQUFXLENBQUMsS0FBSyxFQUFFO0lBQ3ZCO0lBQ0EsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUs7SUFDM0I7SUFDQSxRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsU0FBUztJQUNoQztJQUNBLFFBQVEsSUFBSSxDQUFDLFFBQVEsR0FBRyxTQUFTO0lBQ2pDOztJQUVBLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtJQUNsQixRQUFRLE1BQU0sVUFBVTtJQUN4QixZQUFZLElBQUksQ0FBQyxPQUFPLElBQUksU0FBUztJQUNyQyxZQUFZLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxNQUFNO0lBQzNELFNBQVM7SUFDVCxRQUFRLElBQUksVUFBVSxFQUFFO0lBQ3hCLFlBQVksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQzNELFlBQVksSUFBSSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTztJQUM1QyxZQUFZLElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSztJQUNsRCxnQkFBZ0IsT0FBTyxZQUFZLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQztJQUM5QyxhQUFhLENBQUM7SUFDZDtJQUNBO0lBQ0EsUUFBUSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsS0FBSztJQUNuRCxZQUFZLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDcEMsU0FBUyxDQUFDO0lBQ1YsUUFBUSxPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZO0lBQy9FOztJQUVBLElBQUksS0FBSyxHQUFHO0lBQ1osUUFBUSxJQUFJLENBQUMsT0FBTyxHQUFHLFNBQVM7SUFDaEMsUUFBUSxJQUFJLENBQUMsUUFBUSxHQUFHLFNBQVM7SUFDakM7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRUEsU0FBUyxZQUFZLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRTtJQUNqQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxHQUFHLElBQUk7SUFDcEMsSUFBSSxJQUFJLElBQUksSUFBSSxRQUFRLEVBQUU7SUFDMUIsUUFBUSxPQUFPLElBQUlDLGFBQXFCLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQztJQUNuRCxLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksWUFBWSxFQUFFO0lBQ3JDLFFBQVEsT0FBTyxJQUFJQyxpQkFBeUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO0lBQ3ZELEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxlQUFlLEVBQUU7SUFDeEMsUUFBUSxPQUFPLElBQUlDLG9CQUE0QixDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7SUFDMUQsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtJQUNqQyxRQUFRLE9BQU8sSUFBSUMsYUFBcUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO0lBQ25ELEtBQUssTUFBTTtJQUNYLFFBQVEsT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsRUFBRSxJQUFJLENBQUM7SUFDdEQ7SUFDQTs7SUMxUUE7SUFDQTtJQUNBO0lBQ0EsTUFBTSxhQUFhLEdBQUc7SUFDdEIsSUFBSSxHQUFHLEVBQUU7SUFDVCxRQUFRLFNBQVMsRUFBRSxVQUFVLElBQUksRUFBRTtJQUNuQztJQUNBLFlBQVksT0FBTyxJQUFJLENBQUM7SUFDeEIsaUJBQWlCLEdBQUcsQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQztJQUMxQyxpQkFBaUIsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssS0FBSyxHQUFHLEdBQUcsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUN2RDtJQUNBLEtBQUs7SUFDTCxJQUFJLEtBQUssRUFBRTtJQUNYLFFBQVEsU0FBUyxFQUFFLFVBQVUsSUFBSSxFQUFFO0lBQ25DO0lBQ0EsWUFBWSxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUNyQztJQUNBLEtBQUs7SUFDTCxJQUFJLEtBQUssRUFBRTtJQUNYLFFBQVEsU0FBUyxFQUFFLFVBQVUsSUFBSSxFQUFFO0lBQ25DO0lBQ0EsWUFBWSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDO0lBQ3hEO0lBQ0E7SUFDQTs7O0lBR0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVPLFNBQVMsS0FBSyxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsRUFBRSxFQUFFO0lBQzVDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPOztJQUU3QixJQUFJLElBQUksSUFBSSxJQUFJLGFBQWEsRUFBRTtJQUMvQixRQUFRLE9BQU8sSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUM7SUFDMUQsS0FBSyxNQUFNO0lBQ1gsUUFBUSxPQUFPLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUM7SUFDL0M7SUFDQTs7O0lBR0EsTUFBTSxVQUFVLFNBQVMsS0FBSyxDQUFDOztJQUUvQixJQUFJLFdBQVcsQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFO0lBQ2xDLFFBQVEsS0FBSyxDQUFDLE9BQU8sQ0FBQzs7SUFFdEI7SUFDQSxRQUFRTCxhQUFxQixDQUFDLElBQUksQ0FBQztJQUNuQyxRQUFRLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDekQsUUFBUSxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU87SUFDOUI7O0lBRUEsSUFBSSxhQUFhLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRTtJQUNyQyxRQUFRLElBQUksUUFBUSxJQUFJLFNBQVMsRUFBRTtJQUNuQztJQUNBLFlBQVksSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7SUFDekMsZ0JBQWdCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxzQkFBc0IsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNsRTtJQUNBLFlBQVksTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFlBQVksS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkYsWUFBWSxJQUFJLENBQUMsVUFBVSxFQUFFO0lBQzdCLGdCQUFnQixNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsMkJBQTJCLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUN4RTtJQUNBO0lBQ0EsUUFBUSxPQUFPLE9BQU87SUFDdEI7O0lBRUEsSUFBSSxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFO0lBQ3JDLFFBQVEsSUFBSSxRQUFRLElBQUksU0FBUyxFQUFFO0lBQ25DLFlBQVksSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLFNBQVMsSUFBSSxJQUFJLElBQUksT0FBTyxFQUFFO0lBQzVELGdCQUFnQixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPO0lBQ3hELGFBQWE7SUFDYixZQUFZLElBQUksQ0FBQyxXQUFXLEVBQUU7SUFDOUIsWUFBWSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7SUFDbkMsWUFBWSxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQztJQUMxQztJQUNBO0lBQ0E7QUFDQUMsa0JBQXNCLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQzs7Ozs7O0lBTTVDO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxTQUFTLGFBQWEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQy9CLElBQUksT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFO0lBQzlCOztJQUVBLFNBQVMsY0FBYyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDaEMsSUFBSSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUU7SUFDOUI7O0lBRU8sTUFBTSxVQUFVLFNBQVMsZUFBZSxDQUFDOztJQUVoRCxJQUFJLFdBQVcsQ0FBQyxPQUFPLEVBQUU7SUFDekIsUUFBUSxLQUFLLEVBQUU7SUFDZixRQUFRLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTztJQUMvQixRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsS0FBSztJQUNwRCxZQUFZLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3hDLFNBQVMsQ0FBQyxDQUFDO0lBQ1g7O0lBRUEsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO0lBQ25CLFFBQVEsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQ25DO0lBQ0EsUUFBUSxNQUFNLFNBQVMsR0FBRyxFQUFFLEVBQUUsU0FBUyxHQUFHLEVBQUU7SUFDNUMsUUFBUSxNQUFNLFdBQVcsR0FBRyxFQUFFO0lBQzlCLFFBQVEsTUFBTSxnQkFBZ0IsR0FBRyxFQUFFO0lBQ25DLFFBQVEsTUFBTSxlQUFlLEdBQUc7SUFDaEMsUUFBUSxLQUFLLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7SUFDdkMsWUFBWSxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ3BFLFlBQVksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMxRCxZQUFZLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztJQUN4RCxZQUFZLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7SUFDbkMsZ0JBQWdCLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDdkQsZ0JBQWdCLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUM7SUFDN0QsZ0JBQWdCLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDM0MsZ0JBQWdCLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDMUM7SUFDQTtJQUNBO0lBQ0E7SUFDQSxRQUFRLFNBQVMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBQ3JDLFFBQVEsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQzs7SUFFMUQ7SUFDQSxRQUFRLFNBQVMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDO0lBQ3RDLFFBQVEsTUFBTSxhQUFhLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDOztJQUU1RDtJQUNBLFFBQVEsSUFBSSxHQUFHLEVBQUUsSUFBSSxDQUFDO0lBQ3RCLFFBQVEsTUFBTSxNQUFNLEdBQUc7SUFDdkIsWUFBWSxNQUFNLEVBQUUsV0FBVztJQUMvQjs7SUFFQSxRQUFRLElBQUksV0FBVyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7O0lBRXJDO0lBQ0EsWUFBWSxNQUFNLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQztJQUN4QyxZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsWUFBWTtJQUN0QyxZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsYUFBYTtJQUN2QyxZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsYUFBYTs7SUFFdkMsU0FBUyxNQUFNO0lBQ2Y7SUFDQTtJQUNBO0lBQ0EsWUFBWSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBQ2hELFlBQVksSUFBSSxlQUFlLEdBQUcsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO0lBQ3JELFlBQVksSUFBSSxlQUFlLEdBQUcsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQy9ELFlBQVksSUFBSSxvQkFBb0IsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsZUFBZSxFQUFFLGVBQWU7O0lBRXBGO0lBQ0EsWUFBWSxlQUFlLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQztJQUNoRCxZQUFZLElBQUksY0FBYyxHQUFHLGVBQWUsQ0FBQyxDQUFDLENBQUM7SUFDbkQsWUFBWSxJQUFJLGNBQWMsR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzdELFlBQVksSUFBSSxtQkFBbUIsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsY0FBYyxFQUFFLGNBQWM7O0lBRWpGO0lBQ0EsWUFBWSxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsWUFBWSxFQUFFLGVBQWUsQ0FBQyxFQUFFO0lBQzVELGdCQUFnQixNQUFNLENBQUMsS0FBSyxHQUFHLFlBQVk7SUFDM0MsYUFBYSxNQUFNO0lBQ25CLGdCQUFnQixNQUFNLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLEtBQUs7SUFDbkU7SUFDQSxZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxvQkFBb0IsSUFBSSxNQUFNLENBQUMsS0FBSyxHQUFHLFlBQVk7O0lBRTlFO0lBQ0EsWUFBWSxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsYUFBYSxFQUFFLGNBQWMsQ0FBQyxFQUFFO0lBQzVELGdCQUFnQixNQUFNLENBQUMsSUFBSSxHQUFHLGFBQWE7SUFDM0MsYUFBYSxNQUFNO0lBQ25CLGdCQUFnQixNQUFNLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQztJQUNuRTtJQUNBLFlBQVksTUFBTSxDQUFDLElBQUksR0FBRyxDQUFDLG1CQUFtQixJQUFJLE1BQU0sQ0FBQyxJQUFJLEdBQUcsYUFBYTs7SUFFN0U7O0lBRUE7SUFDQSxRQUFRLEdBQUcsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDO0lBQy9DLFFBQVEsSUFBSSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUM7SUFDbEQsUUFBUSxNQUFNLENBQUMsR0FBRyxHQUFHLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQzs7SUFFdkQsUUFBUSxPQUFPLE1BQU07SUFDckI7SUFDQTs7SUM1TUEsU0FBUyxPQUFPLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRTtJQUM1QixJQUFJLElBQUksQ0FBQyxJQUFJLFNBQVMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRTtJQUN4QztJQUNBLFFBQVEsT0FBTyxDQUFDO0lBQ2hCO0lBQ0EsU0FBUyxJQUFJLE9BQU8sQ0FBQyxJQUFJLFFBQVEsRUFBRTtJQUNuQztJQUNBLFFBQVEsT0FBTyxDQUFDLEdBQUcsTUFBTTtJQUN6QixLQUFLLE1BQU0sSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0lBQ2pEO0lBQ0EsUUFBUSxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUM7SUFDM0IsUUFBUSxPQUFPLENBQUMsR0FBRyxHQUFHLE1BQU0sRUFBRSxJQUFJLENBQUM7SUFDbkM7SUFDQTs7O0lBR0E7SUFDQTtJQUNBOztJQUVBLE1BQU0sVUFBVSxTQUFTLGVBQWUsQ0FBQzs7SUFFekMsSUFBSSxXQUFXLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFO0lBQzlCLFFBQVEsS0FBSyxFQUFFO0lBQ2YsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUs7SUFDM0IsUUFBUSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUk7SUFDekIsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxRQUFRLEVBQUU7O0lBRXRDO0lBQ0EsUUFBUSxJQUFJLENBQUMsY0FBYyxHQUFHO0lBQzlCLFlBQVksS0FBSyxFQUFFLFVBQVUsTUFBTSxFQUFFO0lBQ3JDO0lBQ0EsZ0JBQWdCLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUM7SUFDbkYsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJO0lBQ3ZCLFNBQVM7SUFDVDs7SUFFQTtJQUNBLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtJQUNuQjtJQUNBLFFBQVEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDN0U7SUFDQSxRQUFRLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFO0lBQ3RDLFFBQVEsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDbkQsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUs7SUFDbEQsUUFBUSxPQUFPO0lBQ2YsWUFBWSxHQUFHO0lBQ2YsWUFBWSxJQUFJLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNsRCxZQUFZLEtBQUssRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQ3BELFlBQVksSUFBSSxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDbEQsWUFBWSxJQUFJLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNsRCxZQUFZLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxjQUFjO0lBQy9EO0lBQ0E7SUFDQTs7O0lBR0E7SUFDQTtJQUNBOzs7SUFHQSxNQUFNLFVBQVUsU0FBUyxLQUFLLENBQUM7O0lBRS9CLElBQUksV0FBVyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUN6QyxRQUFRLEtBQUssQ0FBQyxPQUFPLENBQUM7SUFDdEIsUUFBUSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUk7SUFDekI7SUFDQSxRQUFRRCxhQUFxQixDQUFDLElBQUksQ0FBQztJQUNuQyxRQUFRLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUM7SUFDcEMsUUFBUSxJQUFJLENBQUMsR0FBRyxHQUFHLEtBQUs7SUFDeEI7O0lBRUEsSUFBSSxhQUFhLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRTtJQUNqQyxRQUFRLElBQUksUUFBUSxJQUFJLEtBQUssRUFBRTtJQUMvQixZQUFZLElBQUksRUFBRSxHQUFHLFlBQVksS0FBSyxDQUFDLEVBQUU7SUFDekMsZ0JBQWdCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzdEO0lBQ0EsWUFBWSxPQUFPLEdBQUcsQ0FBQztJQUN2QjtJQUNBOztJQUVBLElBQUksZ0JBQWdCLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRTtJQUNyQyxRQUFRLElBQUksUUFBUSxJQUFJLEtBQUssRUFBRTtJQUMvQixZQUFZLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxTQUFTLElBQUksSUFBSSxJQUFJLE9BQU8sRUFBRTtJQUM1RCxnQkFBZ0IsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxLQUFLO0lBQ2hFLGFBQWE7SUFDYixZQUFZLElBQUksQ0FBQyxXQUFXLEVBQUU7SUFDOUIsWUFBWSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7SUFDbkMsWUFBWSxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzNDO0lBQ0E7SUFDQTtBQUNBQyxrQkFBc0IsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDOztJQUU1QztJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVPLFNBQVMsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUU7SUFDdEMsSUFBSSxPQUFPLElBQUksVUFBVSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUM7SUFDeEM7O0lDM0dBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVPLE1BQU0saUJBQWlCLENBQUM7SUFDL0IsSUFBSSxXQUFXLEdBQUc7SUFDbEIsUUFBUU4sZUFBc0IsQ0FBQyxJQUFJLENBQUM7SUFDcEM7SUFDQSxJQUFJLEdBQUcsQ0FBQyxHQUFHO0lBQ1gsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDO0lBQzFDO0lBQ0E7QUFDQUMsb0JBQXVCLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDOzs7O0lBSXBEO0lBQ0E7SUFDQTs7SUFFQSxNQUFNLGtCQUFrQixTQUFTLGlCQUFpQixDQUFDO0lBQ25ELElBQUksR0FBRyxDQUFDLEdBQUc7SUFDWCxRQUFRLE9BQU8sS0FBSyxDQUFDLEdBQUcsRUFBRTtJQUMxQjtJQUNBOztJQUVPLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxrQkFBa0IsRUFBRTs7SUNwQzFELE1BQU0sT0FBTyxHQUFHLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsV0FBVyxDQUFDOzs7SUFHaEQsU0FBUyxHQUFHLEVBQUUsTUFBTSxFQUFFO0lBQzdCLElBQUksSUFBSSxFQUFFLE1BQU0sWUFBWSxpQkFBaUIsQ0FBQyxFQUFFO0lBQ2hELFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLGlDQUFpQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDckU7SUFDQSxJQUFJLElBQUksT0FBTyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTztJQUN4QyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxLQUFLO0lBQ2pDLFlBQVksT0FBTztJQUNuQixnQkFBZ0IsSUFBSTtJQUNwQixnQkFBZ0IsU0FBUyxHQUFHLElBQUksRUFBRTtJQUNsQyxvQkFBb0IsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUM7SUFDMUQsb0JBQW9CLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoRDtJQUNBO0lBQ0EsU0FBUyxDQUFDO0lBQ1YsSUFBSSxPQUFPLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDO0lBQ3RDOztJQUVBLFNBQVMsTUFBTSxDQUFDLEtBQUssRUFBRTtJQUN2QixJQUFJLElBQUksS0FBSyxJQUFJLFNBQVMsRUFBRTtJQUM1QixRQUFRLE9BQU8sRUFBRTtJQUNqQixLQUFLLE1BQU07SUFDWCxRQUFRLElBQUksSUFBSSxHQUFHO0lBQ25CLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7SUFDbEQsWUFBWSxJQUFJLEVBQUUsUUFBUTtJQUMxQixZQUFZLElBQUksRUFBRSxLQUFLO0lBQ3ZCO0lBQ0EsUUFBUSxPQUFPLENBQUMsSUFBSSxDQUFDO0lBQ3JCO0lBQ0E7O0lBRUEsU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFO0lBQ3RCLElBQUksSUFBSSxJQUFJLEdBQUc7SUFDZixRQUFRLEdBQUcsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0lBQzlDLFFBQVEsSUFBSSxFQUFFLFFBQVE7SUFDdEIsUUFBUSxJQUFJLEVBQUUsTUFBTTtJQUNwQjtJQUNBLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQztJQUNqQjs7SUFFQSxTQUFTLFVBQVUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFO0lBQzVDLElBQUksSUFBSSxLQUFLLEdBQUc7SUFDaEIsUUFBUTtJQUNSLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUM7SUFDN0MsWUFBWSxJQUFJLEVBQUUsUUFBUTtJQUMxQixZQUFZLElBQUksRUFBRTtJQUNsQixTQUFTO0lBQ1QsUUFBUTtJQUNSLFlBQVksR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDO0lBQ3RDLFlBQVksSUFBSSxFQUFFLFlBQVk7SUFDOUIsWUFBWSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsTUFBTTtJQUN6QyxTQUFTO0lBQ1QsUUFBUTtJQUNSLFlBQVksR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0lBQzNDLFlBQVksSUFBSSxFQUFFLFFBQVE7SUFDMUIsWUFBWSxJQUFJLEVBQUU7SUFDbEI7SUFDQTtJQUNBLElBQUksT0FBTyxLQUFLO0lBQ2hCOztJQUVBLFNBQVMsV0FBVyxDQUFDLE1BQU0sRUFBRTtJQUM3QixJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUM1QixJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDOztJQUUxQyxJQUFJLElBQUksS0FBSyxHQUFHO0lBQ2hCLFFBQVE7SUFDUixZQUFZLEdBQUcsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDO0lBQzdDLFlBQVksSUFBSSxFQUFFLFFBQVE7SUFDMUIsWUFBWSxJQUFJLEVBQUU7SUFDbEIsU0FBUztJQUNULFFBQVE7SUFDUixZQUFZLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQztJQUN0QyxZQUFZLElBQUksRUFBRSxlQUFlO0lBQ2pDLFlBQVksSUFBSSxFQUFFO0lBQ2xCLFNBQVM7SUFDVCxRQUFRO0lBQ1IsWUFBWSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7SUFDM0MsWUFBWSxJQUFJLEVBQUUsUUFBUTtJQUMxQixZQUFZLElBQUksRUFBRTtJQUNsQjtJQUNBLE1BQUs7SUFDTCxJQUFJLE9BQU8sS0FBSztJQUNoQjs7SUNyRkE7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7O0lBRUE7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7O0lBRUE7SUFDQTs7SUFFQTtJQUNBOztJQUVBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBOztJQUVBO0lBQ0E7O0lBRUE7OztJQUdBLE1BQU0sT0FBTyxHQUFHOzs7SUFHaEI7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTs7SUFFQSxNQUFNLGNBQWMsQ0FBQzs7SUFFckIsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRTs7SUFFNUIsUUFBUSxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEVBQUUsT0FBTyxDQUFDO0lBQy9ELFFBQVEsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksR0FBRyxPQUFPLEVBQUU7SUFDMUMsWUFBWSxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQy9FO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxRQUFRLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxHQUFHLEVBQUU7SUFDN0I7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxRQUFRLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxHQUFHLEVBQUU7SUFDdEM7SUFDQSxRQUFRLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztJQUNuRTs7SUFFQSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsRUFBRSxFQUFFO0lBQ2hEO0lBQ0EsUUFBUSxJQUFJLE1BQU0sR0FBRyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDO0lBQ2hELFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDO0lBQzdCO0lBQ0EsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUU7SUFDL0MsWUFBWSxJQUFJLEdBQUcsR0FBRyxRQUFRLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUM7SUFDcEUsWUFBWSxJQUFJLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzlELFlBQVksSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQztJQUNsRDtJQUNBLFNBQVMsTUFBTTtJQUNmLFlBQVksSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDakU7SUFDQSxRQUFRLE9BQU8sTUFBTTtJQUNyQjs7SUFFQSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUU7SUFDcEI7SUFDQSxRQUFRLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUM5QyxRQUFRLElBQUksQ0FBQyxPQUFPLEVBQUU7SUFDdEIsUUFBUSxNQUFNLENBQUMsR0FBRyxHQUFHLFNBQVM7SUFDOUI7SUFDQSxRQUFRLElBQUksUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRO0lBQ3RDLFFBQVEsSUFBSSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7SUFDN0QsUUFBUSxJQUFJLEdBQUcsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztJQUN6QyxRQUFRLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFO0lBQ3RCLFlBQVksT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ2xDO0lBQ0EsUUFBUSxJQUFJLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO0lBQ2pDO0lBQ0E7SUFDQSxZQUFZLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztJQUMvQyxZQUFZLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO0lBQzdCO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0EsSUFBSSxpQkFBaUIsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7SUFDcEMsUUFBUSxJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUMsR0FBRztJQUNoQztJQUNBLFFBQVEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztJQUN4RCxRQUFRLElBQUksS0FBSyxHQUFHLElBQUk7SUFDeEI7SUFDQSxRQUFRLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDO0lBQ2pEO0lBQ0EsUUFBUSxLQUFLLElBQUksTUFBTSxJQUFJLE9BQU8sRUFBRTtJQUNwQyxZQUFZLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO0lBQ2xDO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0EsSUFBSSxtQkFBbUIsQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFO0lBQ3pDLFFBQVEsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO0lBQ25ELFFBQVEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsR0FBRyxJQUFJO0lBQ3hDLFFBQVEsS0FBSyxHQUFHLEtBQUssSUFBSSxRQUFRLENBQUMsS0FBSyxFQUFFO0lBQ3pDLFFBQVEsSUFBSSxpQkFBaUIsR0FBRyxLQUFLLENBQUMsT0FBTztJQUM3QyxRQUFRLElBQUksQ0FBQyxXQUFXLElBQUksaUJBQWlCLEVBQUU7SUFDL0MsWUFBWSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7SUFDL0IsWUFBWSxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQztJQUN4QyxTQUFTLE1BQU0sSUFBSSxXQUFXLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtJQUN0RCxZQUFZLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSztJQUNoQyxZQUFZLElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDO0lBQzFDO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0EsSUFBSSxhQUFhLENBQUMsUUFBUSxFQUFFO0lBQzVCLFFBQVEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztJQUN4RCxRQUFRLEtBQUssSUFBSSxNQUFNLElBQUksT0FBTyxFQUFFO0lBQ3BDLFlBQVksSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7SUFDckM7SUFDQTs7SUFFQSxJQUFJLFlBQVksQ0FBQyxNQUFNLEVBQUU7SUFDekIsUUFBUSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztJQUN2RCxRQUFRLElBQUksT0FBTyxHQUFHLFlBQVk7SUFDbEMsWUFBWSxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQztJQUN4QyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztJQUNwQixRQUFRLE1BQU0sQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUM7SUFDL0M7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLGdCQUFnQixDQUFDLEtBQUssRUFBRTtJQUM1QixRQUFRLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSTtJQUNyQyxRQUFRLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQy9DLFFBQVEsSUFBSSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQztJQUM5QyxRQUFRLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxLQUFLLEVBQUUsSUFBSSxDQUFDO0lBQzlDLFFBQVEsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUk7SUFDaEQsUUFBUSxPQUFPLE1BQU0sR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFO0lBQ3pDOztJQUVBO0lBQ0E7SUFDQTtJQUNBLElBQUksZUFBZSxDQUFDLFFBQVEsRUFBRTtJQUM5QixRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7SUFDeEQsUUFBUSxLQUFLLElBQUksTUFBTSxJQUFJLE9BQU8sRUFBRTtJQUNwQyxZQUFZLElBQUksTUFBTSxDQUFDLEdBQUcsSUFBSSxTQUFTLEVBQUU7SUFDekMsZ0JBQWdCLFlBQVksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDO0lBQ3hDLGdCQUFnQixNQUFNLENBQUMsR0FBRyxHQUFHLFNBQVM7SUFDdEM7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBLElBQUksZUFBZSxDQUFDLE1BQU0sRUFBRTtJQUM1QjtJQUNBLFFBQVEsSUFBSSxNQUFNLENBQUMsR0FBRyxJQUFJLFNBQVMsRUFBRTtJQUNyQyxRQUFRLE1BQU0sQ0FBQyxHQUFHLEdBQUcsU0FBUztJQUM5QjtJQUNBLFFBQVEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLE1BQU07SUFDL0IsUUFBUSxJQUFJLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxFQUFFO0lBQ3BDO0lBQ0EsUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQUU7SUFDM0IsWUFBWSxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQztJQUNyQyxTQUFTLE1BQU07SUFDZjtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsWUFBWSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7SUFDdkQsWUFBWSxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUs7SUFDaEM7SUFDQTtJQUNBLFFBQVEsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUM7SUFDOUI7SUFDQTs7OztJQUlBO0lBQ0E7SUFDQTs7O0lBR0EsTUFBTSxnQkFBZ0IsU0FBUyxjQUFjLENBQUM7O0lBRTlDLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDNUIsUUFBUSxLQUFLLENBQUMsT0FBTyxDQUFDO0lBQ3RCLFFBQVEsSUFBSSxDQUFDLE9BQU87SUFDcEI7O0lBRUE7SUFDQTtJQUNBO0lBQ0EsSUFBSSxhQUFhLENBQUMsUUFBUSxFQUFFO0lBQzVCLElBQUksWUFBWSxDQUFDLE1BQU0sRUFBRTtJQUN6QixJQUFJLGdCQUFnQixDQUFDLEtBQUssRUFBRTtJQUM1QixJQUFJLGVBQWUsQ0FBQyxRQUFRLEVBQUU7SUFDOUIsSUFBSSxlQUFlLENBQUMsTUFBTSxFQUFFOztJQUU1QixJQUFJLGlCQUFpQixDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTtJQUNwQyxRQUFRLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDO0lBQzVDO0lBQ0EsUUFBUSxJQUFJLENBQUMsU0FBUyxFQUFFO0lBQ3hCOztJQUVBLElBQUksU0FBUyxHQUFHO0lBQ2hCO0lBQ0EsUUFBUSxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUU7SUFDeEQsYUFBYSxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsT0FBTztJQUN0RCxhQUFhLEdBQUcsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFLLFFBQVEsQ0FBQztJQUNoRCxRQUFRLElBQUksU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7SUFDbEM7SUFDQSxZQUFZLEtBQUssSUFBSSxRQUFRLElBQUksU0FBUyxFQUFFO0lBQzVDLGdCQUFnQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO0lBQ2hFLGdCQUFnQixJQUFJLEdBQUcsR0FBRyxRQUFRLENBQUMsS0FBSyxFQUFFO0lBQzFDLGdCQUFnQixLQUFLLElBQUksTUFBTSxJQUFJLE9BQU8sRUFBRTtJQUM1QyxvQkFBb0IsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUM7SUFDeEM7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsWUFBWSxJQUFJLENBQUMsT0FBTyxHQUFHLHFCQUFxQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzNFO0lBQ0E7SUFDQTs7O0lBR0E7SUFDQTtJQUNBOztJQUVBLE1BQU0sT0FBTyxHQUFHLElBQUksY0FBYyxFQUFFO0lBQ3BDLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxnQkFBZ0IsRUFBRTs7SUFFekMsU0FBUyxJQUFJLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUM1RCxJQUFJLElBQUksTUFBTTtJQUNkLElBQUksSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7SUFDcEMsUUFBUSxNQUFNLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUM7SUFDakUsUUFBUSxPQUFPLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQztJQUNsQyxLQUFLLE1BQU07SUFDWCxRQUFRLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsT0FBTyxDQUFDO0lBQ3ZFLFFBQVEsT0FBTyxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUM7SUFDcEM7SUFDQTtJQUNPLFNBQVMsT0FBTyxDQUFDLE1BQU0sRUFBRTtJQUNoQyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEdBQUcsTUFBTTtJQUNoQyxJQUFJLElBQUksSUFBSSxJQUFJLFNBQVMsRUFBRTtJQUMzQixRQUFRLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7SUFDdkMsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLFdBQVcsRUFBRTtJQUNwQyxRQUFRLE9BQU8saUJBQWlCLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztJQUNqRDtJQUNBOztJQ3JUQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUEsTUFBTSxXQUFXLFNBQVMsZUFBZSxDQUFDOztJQUUxQyxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUU7SUFDeEIsUUFBUSxLQUFLLEVBQUU7SUFDZixRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLFFBQVEsRUFBRTtJQUN2Qzs7SUFFQSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7SUFDbkI7SUFDQSxRQUFRLE9BQU87SUFDZixZQUFZLEdBQUcsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0lBQ2xELFlBQVksTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNqQyxZQUFZLElBQUksRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUNoQyxZQUFZLElBQUksRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUNoQyxZQUFZLEtBQUssRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDaEMsWUFBWSxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQy9CO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxNQUFNLFdBQVcsQ0FBQztJQUNsQixJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUU7SUFDeEIsUUFBUSxJQUFJLENBQUMsT0FBTyxHQUFHLE1BQU07SUFDN0IsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRTtJQUNqRDs7SUFFQSxJQUFJLEtBQUssR0FBRztJQUNaLFFBQVEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxlQUFlLEVBQUUsQ0FBQyxLQUFLLENBQUM7SUFDNUQsUUFBUSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUN4Qzs7SUFFQSxJQUFJLEtBQUssR0FBRztJQUNaLFFBQVEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUU7SUFDM0I7SUFDQTs7O0lBR0E7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRU8sTUFBTSxNQUFNLFNBQVMsS0FBSyxDQUFDOztJQUVsQyxJQUFJLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDN0IsUUFBUSxLQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUM7O0lBRXZDO0lBQ0EsUUFBUUksYUFBcUIsQ0FBQyxJQUFJLENBQUM7SUFDbkMsUUFBUSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDO0lBQ3BDLFFBQVEsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQzs7SUFFckM7SUFDQSxRQUFRLElBQUksQ0FBQyxJQUFJO0lBQ2pCO0lBQ0EsUUFBUSxJQUFJLENBQUMsSUFBSTs7SUFFakI7SUFDQSxRQUFRLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsT0FBTztJQUNqQyxRQUFRLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxJQUFJLGtCQUFrQjtJQUM5QyxRQUFRLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRztJQUN0Qjs7SUFFQTtJQUNBO0lBQ0E7O0lBRUEsSUFBSSxhQUFhLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRTtJQUNqQyxRQUFRLElBQUksUUFBUSxJQUFJLE1BQU0sRUFBRTtJQUNoQyxZQUFZLE1BQU0sRUFBRSxHQUFHLENBQUMsaUJBQWlCLEVBQUUsTUFBTTtJQUNqRCxpQkFBaUIsR0FBRyxDQUFDLENBQUMsRUFBRSxLQUFLLEdBQUcsWUFBWSxFQUFFO0lBQzlDLGlCQUFpQixJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUM7SUFDbkMsWUFBWSxJQUFJLENBQUMsRUFBRSxFQUFFO0lBQ3JCLGdCQUFnQixNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsdUNBQXVDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDL0U7SUFDQSxTQUFTLE1BQU0sSUFBSSxRQUFRLElBQUksS0FBSyxFQUFFO0lBQ3RDLFlBQVksSUFBSSxFQUFFLEdBQUcsWUFBWSxLQUFLLENBQUMsRUFBRTtJQUN6QyxnQkFBZ0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLG9CQUFvQixFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDN0Q7SUFDQTtJQUNBLFFBQVEsT0FBTyxHQUFHO0lBQ2xCOztJQUVBLElBQUksZ0JBQWdCLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRTtJQUNyQyxRQUFRLElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQztJQUM1Qzs7SUFFQTtJQUNBO0lBQ0E7O0lBRUEsSUFBSSxlQUFlLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRTtJQUNsQyxRQUFRLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQy9CLFFBQVEsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDaEMsUUFBUSxJQUFJLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtJQUNuQyxZQUFZLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxTQUFTLElBQUksSUFBSSxJQUFJLE9BQU8sRUFBRTtJQUM1RDtJQUNBLGdCQUFnQixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksV0FBVyxDQUFDLElBQUksQ0FBQztJQUNsRDtJQUNBLFlBQVksSUFBSSxDQUFDLFdBQVcsRUFBRTtJQUM5QixZQUFZLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtJQUNuQztJQUNBLFlBQVksSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3hEO0lBQ0EsWUFBWSxJQUFJLENBQUMsc0JBQXNCLEVBQUU7SUFDekM7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLElBQUksc0JBQXNCLEdBQUc7O0lBRTdCO0lBQ0EsUUFBUSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFO0lBQ2xELFFBQVEsTUFBTSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLFVBQVUsQ0FBQyxHQUFHLFdBQVc7O0lBRWxFO0lBQ0EsUUFBUSxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRTtJQUNsQztJQUNBLFlBQVk7SUFDWjs7SUFFQTtJQUNBLFFBQVEsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQztJQUM3RCxRQUFRLE1BQU0sQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7SUFFckQ7SUFDQSxRQUFRLElBQUksSUFBSSxDQUFDLElBQUksWUFBWSxpQkFBaUIsRUFBRTtJQUNwRCxZQUFZLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFO0lBQ2hDLGdCQUFnQixJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLFVBQVUsQ0FBQztJQUN0RSxnQkFBZ0I7SUFDaEI7SUFDQTtJQUNBLFlBQVk7SUFDWixTQUFTO0lBQ1QsUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxZQUFZLGlCQUFpQixFQUFFO0lBQ3pEO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLFlBQVksTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQzs7SUFFbEUsWUFBWSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFO0lBQ25EO0lBQ0EsZ0JBQWdCO0lBQ2hCO0lBQ0EsWUFBWSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUNoRCxnQkFBZ0IsTUFBTSxTQUFTLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDdkQsZ0JBQWdCLElBQUksU0FBUyxDQUFDLElBQUksSUFBSSxRQUFRLEVBQUU7SUFDaEQsb0JBQW9CLE1BQU0sQ0FBQyxRQUFRLEVBQUUsWUFBWSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxJQUFJO0lBQ3ZFLG9CQUFvQixJQUFJLFlBQVksSUFBSSxHQUFHLEVBQUU7SUFDN0M7SUFDQSx3QkFBd0IsSUFBSSxVQUFVLEdBQUcsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxHQUFHO0lBQ3BFLHdCQUF3QixJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRTtJQUNsRCw0QkFBNEIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUM7SUFDN0YsNEJBQTRCLE9BQU87SUFDbkMseUJBQXlCO0lBQ3pCO0lBQ0Esd0JBQXdCO0lBQ3hCO0lBQ0E7SUFDQSxpQkFBaUIsTUFBTSxJQUFJLFNBQVMsQ0FBQyxJQUFJLElBQUksWUFBWSxFQUFFO0lBQzNELG9CQUFvQixNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxJQUFJO0lBQ2xGLG9CQUFvQixJQUFJLE1BQU0sSUFBSSxRQUFRLEVBQUU7SUFDNUM7SUFDQSx3QkFBd0IsSUFBSSxRQUFRLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUM7SUFDdEQ7SUFDQSx3QkFBd0IsTUFBTSxVQUFVLEdBQUcsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztJQUNsRyx3QkFBd0IsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEVBQUUsV0FBVztJQUNsRSw0QkFBNEIsUUFBUSxFQUFFLFVBQVUsQ0FBQztJQUNqRDtJQUNBLHdCQUF3QjtJQUN4QjtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBLFFBQVEsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO0lBQzFDOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLElBQUksYUFBYSxDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRTtJQUNqRSxRQUFRLE1BQU0sU0FBUyxHQUFHLENBQUMsVUFBVSxHQUFHLFdBQVcsSUFBSSxRQUFRO0lBQy9ELFFBQVEsTUFBTSxTQUFTLEdBQUcsVUFBVSxHQUFHLFNBQVM7SUFDaEQsUUFBUSxJQUFJLENBQUMsSUFBSSxHQUFHLFVBQVUsQ0FBQyxNQUFNO0lBQ3JDLFlBQVksSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQztJQUM1QyxTQUFTLEVBQUUsU0FBUyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7SUFDOUI7O0lBRUEsSUFBSSxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUU7SUFDaEMsUUFBUSxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsTUFBTTtJQUNoRCxRQUFRLE1BQU0sYUFBYSxHQUFHLFNBQVMsR0FBRyxFQUFFLENBQUM7SUFDN0MsUUFBUSxJQUFJLGFBQWEsSUFBSSxDQUFDLEVBQUU7SUFDaEM7SUFDQSxZQUFZLElBQUksQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDO0lBQzNDLFNBQVMsTUFBTTtJQUNmO0lBQ0EsWUFBWSxJQUFJLENBQUMsSUFBSSxHQUFHLFVBQVUsQ0FBQyxNQUFNO0lBQ3pDLGdCQUFnQixJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUztJQUMvQyxhQUFhLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQztJQUNsQztJQUNBOztJQUVBO0lBQ0E7SUFDQTs7SUFFQSxJQUFJLGFBQWEsQ0FBQyxHQUFHLEVBQUU7SUFDdkIsUUFBUSxJQUFJLENBQUMsSUFBSSxHQUFHLFdBQVcsQ0FBQyxNQUFNO0lBQ3RDLFlBQVksSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUM7SUFDbkMsU0FBUyxFQUFFLEdBQUcsQ0FBQztJQUNmOztJQUVBLElBQUksYUFBYSxDQUFDLEdBQUcsRUFBRTtJQUN2QixRQUFRLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLO0lBQ3ZDLFFBQVEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxFQUFFO0lBQ2pELFlBQVksSUFBSSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUM7SUFDM0M7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRUEsSUFBSSxlQUFlLENBQUMsR0FBRztJQUN2QixRQUFRLElBQUksSUFBSSxDQUFDLElBQUksWUFBWSxpQkFBaUIsRUFBRTtJQUNwRCxZQUFZLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO0lBQ3BDLFlBQVksT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDO0lBQ3RELFNBQVMsTUFBTTtJQUNmLFlBQVksSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUU7SUFDekM7SUFDQSxZQUFZLElBQUksT0FBTyxLQUFLLENBQUMsS0FBSyxLQUFLLFFBQVEsRUFBRTtJQUNqRCxnQkFBZ0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLG1DQUFtQyxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3BGO0lBQ0EsWUFBWSxPQUFPLEtBQUs7SUFDeEI7SUFDQTs7SUFFQSxJQUFJLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLLENBQUM7SUFDNUM7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLHFCQUFxQixDQUFDLElBQUksRUFBRTtJQUNoQyxRQUFRLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtJQUM5QixZQUFZLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDakM7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUN0QyxRQUFRLE9BQU8sSUFBSSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQztJQUNuRDtJQUNBLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRTtJQUNwQixRQUFRLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQztJQUM5Qjs7SUFFQTtJQUNBO0lBQ0E7O0lBRUEsSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFO0lBQ2xCLFFBQVEsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0lBQzlDO0lBQ0EsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRTtJQUNoQyxRQUFRLElBQUksQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUU7SUFDcEQsUUFBUSxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRTtJQUN2QyxZQUFZLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxxQ0FBcUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQzVFO0lBQ0EsUUFBUSxRQUFRLEdBQUcsQ0FBQyxRQUFRLElBQUksU0FBUyxJQUFJLFFBQVEsR0FBRyxLQUFLO0lBQzdELFFBQVEsUUFBUSxHQUFHLENBQUMsUUFBUSxJQUFJLFNBQVMsSUFBSSxRQUFRLEVBQUUsQ0FBQztJQUN4RCxRQUFRLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUN0RTtJQUNBLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxFQUFFO0lBQzVDLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUU7SUFDaEQsUUFBUSxJQUFJLE9BQU8sRUFBRSxLQUFLLFFBQVEsRUFBRTtJQUNwQyxZQUFZLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxxQ0FBcUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3pFO0lBQ0EsUUFBUSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsUUFBUSxFQUFFLE1BQU0sQ0FBQztJQUNsRjtJQUNBLElBQUksV0FBVyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLEVBQUU7SUFDckMsUUFBUSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsTUFBTTtJQUNwQztJQUNBO0lBQ0EsUUFBUSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLO0lBQ3ZDLFlBQVksT0FBTyxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQztJQUN2QyxTQUFTO0lBQ1QsUUFBUSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUM7SUFDcEQ7O0lBRUE7QUFDQUMsa0JBQXNCLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQztBQUN4Q0Esa0JBQXNCLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQzs7SUNyYnhDO0lBQ0E7SUFDQTs7SUFFQSxTQUFTLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO0lBQzNCLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLE9BQU87SUFDakQsSUFBSSxJQUFJLEdBQUcsWUFBWSxLQUFLLEVBQUU7SUFDOUIsUUFBUSxPQUFPLEdBQUc7SUFDbEIsS0FBSztJQUNMLElBQUksSUFBSSxHQUFHLElBQUksU0FBUyxFQUFFO0lBQzFCLFFBQVEsSUFBSSxLQUFLLElBQUksU0FBUyxFQUFFO0lBQ2hDLFlBQVksS0FBSyxHQUFHLENBQUM7SUFDckIsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQztJQUMxQyxnQkFBZ0IsSUFBSSxFQUFFO0lBQ3RCLGFBQWEsQ0FBQztJQUNkLFNBQVM7SUFDVCxRQUFRLEdBQUcsR0FBRyxJQUFJLGtCQUFrQixDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDN0M7SUFDQSxJQUFJLE9BQU8sSUFBSSxVQUFVLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzFDOztJQUVBO0lBQ0E7SUFDQTs7SUFFQSxTQUFTLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO0lBQzVCLElBQUksTUFBTSxDQUFDLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLE9BQU87SUFDbkMsSUFBSSxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDNUIsSUFBSSxPQUFPLElBQUksTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ2xDOzs7Ozs7Ozs7Ozs7Ozs7OyJ9
