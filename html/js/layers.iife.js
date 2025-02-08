
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


    class NearbyIndexSimple extends NearbyIndexBase {

        constructor(src) {
            super();
            this._src = src;
        }

        get src () {return this._src;}


        nearby(offset) {
            offset = this.check(offset);
            let item = undefined;
            let center_idx = undefined;
            let items = this._src.get_items();

            // binary search for index
            let [found, idx] = find_index(offset[0], items, get_low_value);
            if (found) {
                // search offset matches item low exactly
                // check that it is indeed covered by item interval
                item = items[idx];
                if (interval.covers_endpoint(item.itv, offset)) {
                    center_idx = idx;
                }
            }
            if (center_idx == undefined) {
                // check if previous item covers offset
                item = items[idx-1];
                if (item != undefined) {
                    if (interval.covers_endpoint(item.itv, offset)) {
                        center_idx = idx-1;
                    }
                } 
            }

            /* 
                center is non-empty 
            */
            if (center_idx != undefined) {
                item = items[center_idx];
                const [low, high] = endpoint.from_interval(item.itv);
                return {
                    center: [item],
                    itv: item.itv,
                    left: endpoint.flip(low, "high"),
                    right: endpoint.flip(high, "low")
                }
            }

            /* 
                center is empty 
            */
            // left is based on previous item
            item = items[idx-1];
            let left = [-Infinity, 0];
            if (item != undefined) {
                left = endpoint.from_interval(item.itv)[1];
            }
            // right is based on next item
            item = items[idx];
            let right = [Infinity, 0];
            if (item != undefined) {
                right = endpoint.from_interval(item.itv)[0];
            }
            // itv based on left and right        
            let low = endpoint.flip(left, "low");
            let high = endpoint.flip(right, "high");

            return {
                center: [], left, right,
                itv: interval.from_endpoints(low, high)
            };
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
                let nearby = src.index.nearby(offset);
                let prev_region = src.index.prev_region(nearby);
                let next_region = src.index.next_region(nearby);
                if (prev_region != undefined) {
                    prev_list.push(endpoint.from_interval(prev_region.itv)[1]);
                }
                if (next_region != undefined) {
                    next_list.push(endpoint.from_interval(next_region.itv)[0]);
                }
                if (nearby.center.length > 0) {
                    center_list.push(this._caches.get(src));
                    let [low, high] = endpoint.from_interval(nearby.itv);
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
                //result.next = min_next_low;
                result.left = max_prev_high;
                //result.prev = max_prev_high;

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
     * on whether the source index is defined or not.
     * Back-to-back regions which are defined 
     * are collapsed into one region
     * 
     * Boolean Index is stateless.
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

        constructor(index) {
            super();
            this._index = index;
            this._trueObject = queryObject(true);
            this._falseObject = queryObject(false);
        }

        nearby(offset) {
            offset = this.check(offset);
            const nearby = this._index.nearby(offset);

            // left, right is unchanged if center is empty
            if (nearby.center.length == 0) {
                nearby.center = [this._falseObject];
                return nearby;
            }

            // seek left and right for next gap - expand region
            let [low, high] = endpoint.from_interval(nearby.itv);
            let current_nearby;

            // seek right
            current_nearby = nearby;
            while (true) {
                // region on the right
                const next_nearby = this._index.nearby(current_nearby.right);
                if (next_nearby.center.length > 0) {
                    // expand region
                    high = endpoint.from_interval(next_nearby.itv)[1];
                    // check if this is last region
                    if (next_nearby.right[0] == Infinity) {
                        break;
                    } else {
                        // continue
                        current_nearby = next_nearby;
                    }
                } else {
                    // found gap
                    break;
                }
            }

            // seek left
            current_nearby = nearby;
            while (true) {
                // region on the left
                const next_nearby = this._index.nearby(current_nearby.left);
                if (next_nearby.center.length > 0) {
                    // expand region
                    low = endpoint.from_interval(next_nearby.itv)[0];
                    // check if this is last region
                    if (next_nearby.left[0] == -Infinity) {
                        break;
                    } else {
                        // continue
                        current_nearby = next_nearby;
                    }
                } else {
                    // found gap
                    break;
                }
            }

            return {
                itv: interval.from_endpoints(low, high),
                center : [this._trueObject],
                left: endpoint.flip(low, "high"),
                right: endpoint.flip(high, "low"),
            }
        }
    }

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

    exports.boolean = boolean;
    exports.cmd = cmd;
    exports.cursor = cursor;
    exports.layer = layer;
    exports.merge = merge;
    exports.playback = cursor;
    exports.shift = shift;
    exports.variable = cursor;

    return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hcGlfY2FsbGJhY2suanMiLCIuLi8uLi9zcmMvc3RhdGVwcm92aWRlcl9iYXNlcy5qcyIsIi4uLy4uL3NyYy9pbnRlcnZhbHMuanMiLCIuLi8uLi9zcmMvc3RhdGVwcm92aWRlcl9zaW1wbGUuanMiLCIuLi8uLi9zcmMvbmVhcmJ5aW5kZXguanMiLCIuLi8uLi9zcmMvYXBpX2V2ZW50aWZ5LmpzIiwiLi4vLi4vc3JjL2FwaV9zcmNwcm9wLmpzIiwiLi4vLi4vc3JjL3NlZ21lbnRzLmpzIiwiLi4vLi4vc3JjL3V0aWwuanMiLCIuLi8uLi9zcmMvbmVhcmJ5aW5kZXhfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL2xheWVycy5qcyIsIi4uLy4uL3NyYy9vcHMvbWVyZ2UuanMiLCIuLi8uLi9zcmMvb3BzL3NoaWZ0LmpzIiwiLi4vLi4vc3JjL3N0YXRlcHJvdmlkZXJfY2xvY2suanMiLCIuLi8uLi9zcmMvY21kLmpzIiwiLi4vLi4vc3JjL21vbml0b3IuanMiLCIuLi8uLi9zcmMvY3Vyc29ycy5qcyIsIi4uLy4uL3NyYy9vcHMvYm9vbGVhbi5qcyIsIi4uLy4uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICAgIFRoaXMgZGVjb3JhdGVzIGFuIG9iamVjdC9wcm90b3R5cGUgd2l0aCBiYXNpYyAoc3luY2hyb25vdXMpIGNhbGxiYWNrIHN1cHBvcnQuXG4qL1xuXG5jb25zdCBQUkVGSVggPSBcIl9fY2FsbGJhY2tcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2Uob2JqZWN0KSB7XG4gICAgb2JqZWN0W2Ake1BSRUZJWH1faGFuZGxlcnNgXSA9IFtdO1xufVxuXG5mdW5jdGlvbiBhZGRfY2FsbGJhY2sgKGhhbmRsZXIpIHtcbiAgICBsZXQgaGFuZGxlID0ge1xuICAgICAgICBoYW5kbGVyOiBoYW5kbGVyXG4gICAgfVxuICAgIHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLnB1c2goaGFuZGxlKTtcbiAgICByZXR1cm4gaGFuZGxlO1xufTtcblxuZnVuY3Rpb24gcmVtb3ZlX2NhbGxiYWNrIChoYW5kbGUpIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5pbmRleG9mKGhhbmRsZSk7XG4gICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBub3RpZnlfY2FsbGJhY2tzIChlQXJnKSB7XG4gICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uZm9yRWFjaChmdW5jdGlvbihoYW5kbGUpIHtcbiAgICAgICAgaGFuZGxlLmhhbmRsZXIoZUFyZyk7XG4gICAgfSk7XG59O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgYWRkX2NhbGxiYWNrLCByZW1vdmVfY2FsbGJhY2ssIG5vdGlmeV9jYWxsYmFja3NcbiAgICB9XG4gICAgT2JqZWN0LmFzc2lnbihfcHJvdG90eXBlLCBhcGkpO1xufVxuXG5cbiIsImltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL2FwaV9jYWxsYmFjay5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTVEFURSBQUk9WSURFUiBCQVNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIEJhc2UgY2xhc3MgZm9yIFN0YXRlUHJvdmlkZXJzXG5cbiAgICAtIGNvbGxlY3Rpb24gb2YgaXRlbXNcbiAgICAtIHtrZXksIGl0diwgdHlwZSwgZGF0YX1cbiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0ZVByb3ZpZGVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiB1cGRhdGUgZnVuY3Rpb25cbiAgICAgKiBcbiAgICAgKiBJZiBJdGVtc1Byb3ZpZGVyIGlzIGEgcHJveHkgdG8gYW4gb25saW5lXG4gICAgICogSXRlbXMgY29sbGVjdGlvbiwgdXBkYXRlIHJlcXVlc3RzIHdpbGwgXG4gICAgICogaW1wbHkgYSBuZXR3b3JrIHJlcXVlc3RcbiAgICAgKiBcbiAgICAgKiBvcHRpb25zIC0gc3VwcG9ydCByZXNldCBmbGFnIFxuICAgICAqL1xuICAgIHVwZGF0ZShpdGVtcywgb3B0aW9ucz17fSl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZXR1cm4gYXJyYXkgd2l0aCBhbGwgaXRlbXMgaW4gY29sbGVjdGlvbiBcbiAgICAgKiAtIG5vIHJlcXVpcmVtZW50IHdydCBvcmRlclxuICAgICAqL1xuXG4gICAgZ2V0X2l0ZW1zKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc2lnbmFsIGlmIGl0ZW1zIGNhbiBiZSBvdmVybGFwcGluZyBvciBub3RcbiAgICAgKi9cblxuICAgIGdldCBpbmZvICgpIHtcbiAgICAgICAgcmV0dXJuIHtvdmVybGFwcGluZzogdHJ1ZX07XG4gICAgfVxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoU3RhdGVQcm92aWRlckJhc2UucHJvdG90eXBlKTtcblxuXG5cblxuIiwiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gICAgKiBcbiAgICAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAgICAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICAgICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gICAgKiBcbiAgICAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICAgICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAgICAqIFxuICAgICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG5cbiovXG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuXG5cbiAgICBOT1RFIFxuICAgIC0gY21wKDRdLFs0ICkgPT0gMCAtIHNpbmNlIHRoZXNlIGFyZSB0aGUgc2FtZSB3aXRoIHJlc3BlY3QgdG8gc29ydGluZ1xuICAgIC0gYnV0IGlmIHlvdSB3YW50IHRvIHNlZSBpZiB0d28gaW50ZXJ2YWxzIGFyZSBvdmVybGFwcGluZyBpbiB0aGUgZW5kcG9pbnRzXG4gICAgY21wKGhpZ2hfYSwgbG93X2IpID4gMCB0aGlzIHdpbGwgbm90IGJlIGdvb2RcbiAgICBcbiovIFxuXG5cbmZ1bmN0aW9uIGNtcE51bWJlcnMoYSwgYikge1xuICAgIGlmIChhID09PSBiKSByZXR1cm4gMDtcbiAgICBpZiAoYSA9PT0gSW5maW5pdHkpIHJldHVybiAxO1xuICAgIGlmIChiID09PSBJbmZpbml0eSkgcmV0dXJuIC0xO1xuICAgIGlmIChhID09PSAtSW5maW5pdHkpIHJldHVybiAtMTtcbiAgICBpZiAoYiA9PT0gLUluZmluaXR5KSByZXR1cm4gMTtcbiAgICByZXR1cm4gYSAtIGI7XG4gIH1cblxuZnVuY3Rpb24gZW5kcG9pbnRfY21wIChwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICBsZXQgZGlmZiA9IGNtcE51bWJlcnModjEsIHYyKTtcbiAgICByZXR1cm4gKGRpZmYgIT0gMCkgPyBkaWZmIDogczEgLSBzMjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludCB0byB0aGUgb3RoZXIgc2lkZVxuICogXG4gKiB1c2VmdWwgZm9yIG1ha2luZyBiYWNrLXRvLWJhY2sgaW50ZXJ2YWxzIFxuICogXG4gKiBoaWdoKSA8LT4gW2xvd1xuICogaGlnaF0gPC0+IChsb3dcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKHAsIHRhcmdldCkge1xuICAgIGxldCBbdixzXSA9IHA7XG4gICAgaWYgKCFpc0Zpbml0ZSh2KSkge1xuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgaWYgKHRhcmdldCA9PSBcImxvd1wiKSB7XG4gICAgXHQvLyBhc3N1bWUgcG9pbnQgaXMgaGlnaDogc2lnbiBtdXN0IGJlIC0xIG9yIDBcbiAgICBcdGlmIChzID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBsb3dcIik7ICAgIFx0XHRcbiAgICBcdH1cbiAgICAgICAgcCA9IFt2LCBzKzFdO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09IFwiaGlnaFwiKSB7XG5cdFx0Ly8gYXNzdW1lIHBvaW50IGlzIGxvdzogc2lnbiBpcyAwIG9yIDFcbiAgICBcdGlmIChzIDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBoaWdoXCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcy0xXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0eXBlXCIsIHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBsZXQgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBsZXQgbG93X3AgPSAobG93Q2xvc2VkKSA/IFtsb3csIDBdIDogW2xvdywgMV07IFxuICAgIGxldCBoaWdoX3AgPSAoaGlnaENsb3NlZCkgPyBbaGlnaCwgMF0gOiBbaGlnaCwgLTFdO1xuICAgIHJldHVybiBbbG93X3AsIGhpZ2hfcF07XG59XG5cblxuLypcbiAgICBJTlRFUlZBTFNcblxuICAgIEludGVydmFscyBhcmUgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXVxuXG4qLyBcblxuLypcbiAgICByZXR1cm4gdHJ1ZSBpZiBwb2ludCBwIGlzIGNvdmVyZWQgYnkgaW50ZXJ2YWwgaXR2XG4gICAgcG9pbnQgcCBjYW4gYmUgbnVtYmVyIHAgb3IgYSBwb2ludCBbcCxzXVxuXG4gICAgaW1wbGVtZW50ZWQgYnkgY29tcGFyaW5nIHBvaW50c1xuICAgIGV4Y2VwdGlvbiBpZiBpbnRlcnZhbCBpcyBub3QgZGVmaW5lZFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIHApIHtcbiAgICBsZXQgW2xvd19wLCBoaWdoX3BdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAvLyBjb3ZlcnM6IGxvdyA8PSBwIDw9IGhpZ2hcbiAgICByZXR1cm4gZW5kcG9pbnRfbGUobG93X3AsIHApICYmIGVuZHBvaW50X2xlKHAsIGhpZ2hfcCk7XG59XG4vLyBjb252ZW5pZW5jZVxuZnVuY3Rpb24gaW50ZXJ2YWxfY292ZXJzX3BvaW50KGl0diwgcCkge1xuICAgIHJldHVybiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBbcCwgMF0pO1xufVxuXG5cblxuLypcbiAgICBSZXR1cm4gdHJ1ZSBpZiBpbnRlcnZhbCBoYXMgbGVuZ3RoIDBcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9pc19zaW5ndWxhcihpbnRlcnZhbCkge1xuICAgIHJldHVybiBpbnRlcnZhbFswXSA9PSBpbnRlcnZhbFsxXVxufVxuXG4vKlxuICAgIENyZWF0ZSBpbnRlcnZhbCBmcm9tIGVuZHBvaW50c1xuKi9cbmZ1bmN0aW9uIGludGVydmFsX2Zyb21fZW5kcG9pbnRzKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIC8vIHAxIG11c3QgYmUgYSBsb3cgcG9pbnRcbiAgICBpZiAoczEgPT0gLTEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBsb3cgcG9pbnRcIiwgcDEpO1xuICAgIH1cbiAgICBpZiAoczIgPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2VhbCBoaWdoIHBvaW50XCIsIHAyKTsgICBcbiAgICB9XG4gICAgcmV0dXJuIFt2MSwgdjIsIChzMT09MCksIChzMj09MCldXG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKG4pIHtcbiAgICByZXR1cm4gdHlwZW9mIG4gPT0gXCJudW1iZXJcIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGludGVydmFsX2Zyb21faW5wdXQoaW5wdXQpe1xuICAgIGxldCBpdHYgPSBpbnB1dDtcbiAgICBpZiAoaXR2ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnB1dCBpcyB1bmRlZmluZWRcIik7XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShpdHYpKSB7XG4gICAgICAgIGlmIChpc051bWJlcihpdHYpKSB7XG4gICAgICAgICAgICAvLyBpbnB1dCBpcyBzaW5ndWxhciBudW1iZXJcbiAgICAgICAgICAgIGl0diA9IFtpdHYsIGl0diwgdHJ1ZSwgdHJ1ZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlucHV0OiAke2lucHV0fTogbXVzdCBiZSBBcnJheSBvciBOdW1iZXJgKVxuICAgICAgICB9XG4gICAgfTtcbiAgICAvLyBtYWtlIHN1cmUgaW50ZXJ2YWwgaXMgbGVuZ3RoIDRcbiAgICBpZiAoaXR2Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGl0diA9IFtpdHZbMF0sIGl0dlswXSwgdHJ1ZSwgdHJ1ZV1cbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMikge1xuICAgICAgICBpdHYgPSBpdHYuY29uY2F0KFt0cnVlLCBmYWxzZV0pO1xuICAgIH0gZWxzZSBpZiAoaXR2Lmxlbmd0aCA9PSAzKSB7XG4gICAgICAgIGl0diA9IGl0di5wdXNoKGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPiA0KSB7XG4gICAgICAgIGl0diA9IGl0di5zbGljZSgwLDQpO1xuICAgIH1cbiAgICBsZXQgW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdID0gaXR2O1xuICAgIC8vIHVuZGVmaW5lZFxuICAgIGlmIChsb3cgPT0gdW5kZWZpbmVkIHx8IGxvdyA9PSBudWxsKSB7XG4gICAgICAgIGxvdyA9IC1JbmZpbml0eTtcbiAgICB9XG4gICAgaWYgKGhpZ2ggPT0gdW5kZWZpbmVkIHx8IGhpZ2ggPT0gbnVsbCkge1xuICAgICAgICBoaWdoID0gSW5maW5pdHk7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93IGFuZCBoaWdoIGFyZSBudW1iZXJzXG4gICAgaWYgKCFpc051bWJlcihsb3cpKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgbm90IGEgbnVtYmVyXCIsIGxvdyk7XG4gICAgaWYgKCFpc051bWJlcihoaWdoKSkgdGhyb3cgbmV3IEVycm9yKFwiaGlnaCBub3QgYSBudW1iZXJcIiwgaGlnaCk7XG4gICAgLy8gY2hlY2sgdGhhdCBsb3cgPD0gaGlnaFxuICAgIGlmIChsb3cgPiBoaWdoKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgPiBoaWdoXCIsIGxvdywgaGlnaCk7XG4gICAgLy8gc2luZ2xldG9uXG4gICAgaWYgKGxvdyA9PSBoaWdoKSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIGluZmluaXR5IHZhbHVlc1xuICAgIGlmIChsb3cgPT0gLUluZmluaXR5KSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoaGlnaCA9PSBJbmZpbml0eSkge1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGUgYXJlIGJvb2xlYW5zXG4gICAgaWYgKHR5cGVvZiBsb3dJbmNsdWRlICE9PSBcImJvb2xlYW5cIikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJsb3dJbmNsdWRlIG5vdCBib29sZWFuXCIpO1xuICAgIH0gXG4gICAgaWYgKHR5cGVvZiBoaWdoSW5jbHVkZSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaGlnaEluY2x1ZGUgbm90IGJvb2xlYW5cIik7XG4gICAgfVxuICAgIHJldHVybiBbbG93LCBoaWdoLCBsb3dJbmNsdWRlLCBoaWdoSW5jbHVkZV07XG59XG5cblxuXG5cbmV4cG9ydCBjb25zdCBlbmRwb2ludCA9IHtcbiAgICBsZTogZW5kcG9pbnRfbGUsXG4gICAgbHQ6IGVuZHBvaW50X2x0LFxuICAgIGdlOiBlbmRwb2ludF9nZSxcbiAgICBndDogZW5kcG9pbnRfZ3QsXG4gICAgY21wOiBlbmRwb2ludF9jbXAsXG4gICAgZXE6IGVuZHBvaW50X2VxLFxuICAgIG1pbjogZW5kcG9pbnRfbWluLFxuICAgIG1heDogZW5kcG9pbnRfbWF4LFxuICAgIGZsaXA6IGVuZHBvaW50X2ZsaXAsXG4gICAgZnJvbV9pbnRlcnZhbDogZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWxcbn1cbmV4cG9ydCBjb25zdCBpbnRlcnZhbCA9IHtcbiAgICBjb3ZlcnNfZW5kcG9pbnQ6IGludGVydmFsX2NvdmVyc19lbmRwb2ludCxcbiAgICBjb3ZlcnNfcG9pbnQ6IGludGVydmFsX2NvdmVyc19wb2ludCwgXG4gICAgaXNfc2luZ3VsYXI6IGludGVydmFsX2lzX3Npbmd1bGFyLFxuICAgIGZyb21fZW5kcG9pbnRzOiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyxcbiAgICBmcm9tX2lucHV0OiBpbnRlcnZhbF9mcm9tX2lucHV0XG59XG4iLCJpbXBvcnQgeyBTdGF0ZVByb3ZpZGVyQmFzZSB9IGZyb20gXCIuL3N0YXRlcHJvdmlkZXJfYmFzZXMuanNcIjtcbmltcG9ydCB7IGVuZHBvaW50LCBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTE9DQUwgU1RBVEUgUFJPVklERVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMb2NhbCBBcnJheSB3aXRoIG5vbi1vdmVybGFwcGluZyBpdGVtcy5cbiAqL1xuXG5leHBvcnQgY2xhc3MgTG9jYWxTdGF0ZVByb3ZpZGVyIGV4dGVuZHMgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvLyBpbml0aWFsaXphdGlvblxuICAgICAgICBsZXQge2l0ZW1zLCB2YWx1ZX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoaXRlbXMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBpbml0aWFsaXplIGZyb20gaXRlbXNcbiAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gY2hlY2tfaW5wdXQoaXRlbXMpO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gaW5pdGlhbGl6ZSBmcm9tIHZhbHVlXG4gICAgICAgICAgICB0aGlzLl9pdGVtcyA9IFt7XG4gICAgICAgICAgICAgICAgaXR2OlstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSwgXG4gICAgICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgICAgICBkYXRhOnZhbHVlXG4gICAgICAgICAgICB9XTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGUgKGl0ZW1zLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gY2hlY2tfaW5wdXQoaXRlbXMpO1xuICAgICAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ2V0X2l0ZW1zICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2l0ZW1zLnNsaWNlKCk7XG4gICAgfVxuXG4gICAgZ2V0IGluZm8gKCkge1xuICAgICAgICByZXR1cm4ge292ZXJsYXBwaW5nOiBmYWxzZX07XG4gICAgfVxufVxuXG5cbmZ1bmN0aW9uIGNoZWNrX2lucHV0KGl0ZW1zKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnB1dCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgIH1cbiAgICAvLyBtYWtlIHN1cmUgdGhhdCBpbnRlcnZhbHMgYXJlIHdlbGwgZm9ybWVkXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICAgIGl0ZW0uaXR2ID0gaW50ZXJ2YWwuZnJvbV9pbnB1dChpdGVtLml0dik7XG4gICAgfVxuICAgIC8vIHNvcnQgaXRlbXMgYmFzZWQgb24gaW50ZXJ2YWwgbG93IGVuZHBvaW50XG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBsZXQgYV9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGEuaXR2KVswXTtcbiAgICAgICAgbGV0IGJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChiLml0dilbMF07XG4gICAgICAgIHJldHVybiBlbmRwb2ludC5jbXAoYV9sb3csIGJfbG93KTtcbiAgICB9KTtcbiAgICAvLyBjaGVjayB0aGF0IGl0ZW0gaW50ZXJ2YWxzIGFyZSBub24tb3ZlcmxhcHBpbmdcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBwcmV2X2hpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2kgLSAxXS5pdHYpWzFdO1xuICAgICAgICBsZXQgY3Vycl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2ldLml0dilbMF07XG4gICAgICAgIC8vIHZlcmlmeSB0aGF0IHByZXYgaGlnaCBpcyBsZXNzIHRoYXQgY3VyciBsb3dcbiAgICAgICAgaWYgKCFlbmRwb2ludC5sdChwcmV2X2hpZ2gsIGN1cnJfbG93KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT3ZlcmxhcHBpbmcgaW50ZXJ2YWxzIGZvdW5kXCIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuXG5cblxuIiwiaW1wb3J0IHsgZW5kcG9pbnQsIGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBORUFSQlkgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBBYnN0cmFjdCBzdXBlcmNsYXNzIGZvciBOZWFyYnlJbmRleGUuXG4gKiBcbiAqIFN1cGVyY2xhc3MgdXNlZCB0byBjaGVjayB0aGF0IGEgY2xhc3MgaW1wbGVtZW50cyB0aGUgbmVhcmJ5KCkgbWV0aG9kLCBcbiAqIGFuZCBwcm92aWRlIHNvbWUgY29udmVuaWVuY2UgbWV0aG9kcy5cbiAqIFxuICogTkVBUkJZIElOREVYXG4gKiBcbiAqIE5lYXJieUluZGV4IHByb3ZpZGVzIGluZGV4aW5nIHN1cHBvcnQgb2YgZWZmZWN0aXZlbHlcbiAqIGxvb2tpbmcgdXAgcmVnaW9ucyBieSBvZmZzZXQsIFxuICogZ2l2ZW4gdGhhdFxuICogKGkpIGVhY2ggcmVnaW9uIGlzIGFzc29jaWF0ZWQgd2l0aCBhbiBpbnRlcnZhbCBhbmQsXG4gKiAoaWkpIHJlZ2lvbnMgYXJlIG5vbi1vdmVybGFwcGluZy5cbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgXG4gKiBhcm91bmQgZW5kcG9pbnQuIFxuICogXG4gKiBSZXR1cm5zIHtcbiAqICAgICAgY2VudGVyOiBsaXN0IG9mIG9iamVjdHMgY292ZXJlZCBieSByZWdpb24sXG4gKiAgICAgIGl0djogcmVnaW9uIGludGVydmFsIC0gdmFsaWRpdHkgb2YgY2VudGVyIFxuICogICAgICBsZWZ0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIGxlZnQgXG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBoaWdoLWVuZHBvaW50IG9yIFstSW5maW5pdHksIDBdXG4gKiAgICAgIHJpZ2h0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0XG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBsb3ctZW5kcG9pbnQgb3IgW0luZmluaXR5LCAwXSAgICBcbiAqIFxuICogXG4gKiBUaGUgbmVhcmJ5IHN0YXRlIGlzIHdlbGwtZGVmaW5lZCBmb3IgZXZlcnkgZW5kcG9pbnRcbiAqIG9uIHRoZSB0aW1lbGluZS5cbiAqIFxuICogSU5URVJWQUxTXG4gKiBcbiAqIFtsb3csIGhpZ2gsIGxvd0luY2x1c2l2ZSwgaGlnaEluY2x1c2l2ZV1cbiAqIFxuICogVGhpcyByZXByZXNlbnRhdGlvbiBlbnN1cmVzIHRoYXQgdGhlIGludGVydmFsIGVuZHBvaW50cyBcbiAqIGFyZSBvcmRlcmVkIGFuZCBhbGxvd3MgaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIFxuICogeWV0IGNvdmVyIHRoZSBlbnRpcmUgcmVhbCBsaW5lIFxuICogXG4gKiBbYSxiXSwgKGEsYiksIFthLGIpLCBbYSwgYikgYXJlIGFsbCB2YWxpZCBpbnRlcnZhbHNcbiAqIFxuICogXG4gKiBJTlRFUlZBTCBFTkRQT0lOVFNcbiAqIFxuICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gKiBcbiAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gKiBcbiAqICBcbiAqL1xuXG5cbi8qKlxuICogcmV0dXJuIGZpcnN0IGhpZ2ggZW5kcG9pbnQgb24gdGhlIGxlZnQgZnJvbSBuZWFyYnksXG4gKiB3aGljaCBpcyBub3QgaW4gY2VudGVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsZWZ0X2VuZHBvaW50IChuZWFyYnkpIHtcbiAgICBjb25zdCBsb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5lYXJieS5pdHYpWzBdO1xuICAgIHJldHVybiBlbmRwb2ludC5mbGlwKGxvdywgXCJoaWdoXCIpO1xufVxuXG4vKipcbiAqIHJldHVybiBmaXJzdCBsb3cgZW5kcG9pbnQgb24gdGhlIHJpZ2h0IGZyb20gbmVhcmJ5LFxuICogd2hpY2ggaXMgbm90IGluIGNlbnRlclxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiByaWdodF9lbmRwb2ludCAobmVhcmJ5KSB7XG4gICAgY29uc3QgaGlnaCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmVhcmJ5Lml0dilbMV07XG4gICAgcmV0dXJuIGVuZHBvaW50LmZsaXAoaGlnaCwgXCJsb3dcIik7XG59XG5cblxuXG5leHBvcnQgY2xhc3MgTmVhcmJ5SW5kZXhCYXNlIHtcblxuXG4gICAgLyogXG4gICAgICAgIE5lYXJieSBtZXRob2RcbiAgICAqL1xuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIGNoZWNrKG9mZnNldCkge1xuICAgICAgICBpZiAodHlwZW9mIG9mZnNldCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIG9mZnNldCA9IFtvZmZzZXQsIDBdO1xuICAgICAgICB9XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShvZmZzZXQpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFbmRwb2ludCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvZmZzZXQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGxvdyBwb2ludCBvZiBsZWZ0bW9zdCBlbnRyeVxuICAgICovXG4gICAgZmlyc3QoKSB7XG4gICAgICAgIGxldCB7Y2VudGVyLCByaWdodH0gPSB0aGlzLm5lYXJieShbLUluZmluaXR5LCAwXSk7XG4gICAgICAgIHJldHVybiAoY2VudGVyLmxlbmd0aCA+IDApID8gWy1JbmZpbml0eSwgMF0gOiByaWdodDtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICByZXR1cm4gaGlnaCBwb2ludCBvZiByaWdodG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGxhc3QoKSB7XG4gICAgICAgIGxldCB7bGVmdCwgY2VudGVyfSA9IHRoaXMubmVhcmJ5KFtJbmZpbml0eSwgMF0pO1xuICAgICAgICByZXR1cm4gKGNlbnRlci5sZW5ndGggPiAwKSA/IFtJbmZpbml0eSwgMF0gOiBsZWZ0XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiByZXR1cm4gbmVhcmJ5IG9mIGZpcnN0IHJlZ2lvbiB0byB0aGUgcmlnaHRcbiAgICAgKiB3aGljaCBpcyBub3QgdGhlIGNlbnRlciByZWdpb24uIElmIG5vdCBleGlzdHMsIHJldHVyblxuICAgICAqIHVuZGVmaW5lZC4gXG4gICAgICovXG4gICAgcmlnaHRfcmVnaW9uKG5lYXJieSkge1xuICAgICAgICBjb25zdCByaWdodCA9IHJpZ2h0X2VuZHBvaW50KG5lYXJieSk7XG4gICAgICAgIGlmIChyaWdodFswXSA9PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5uZWFyYnkocmlnaHQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJldHVybiBuZWFyYnkgb2YgZmlyc3Qgbm9uLWVtcHR5IHJlZ2lvbiB0byB0aGUgcmlnaHRcbiAgICAgKiB3aGljaCBpcyBub3QgdGhlIGNlbnRlciByZWdpb24uIElmIG5vdCBleGlzdHMsIHJldHVyblxuICAgICAqIHVuZGVmaW5lZC4gXG4gICAgICovXG4gICAgbmV4dF9yZWdpb24obmVhcmJ5KSB7XG4gICAgICAgIGNvbnN0IG5leHRfbmVhcmJ5ID0gdGhpcy5yaWdodF9yZWdpb24obmVhcmJ5KTtcbiAgICAgICAgaWYgKG5leHRfbmVhcmJ5ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobmV4dF9uZWFyYnkuY2VudGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIGNlbnRlciBub24tZW1wdHkgXG4gICAgICAgICAgICByZXR1cm4gbmV4dF9uZWFyYnk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gY2VudGVyIGVtcHR5XG4gICAgICAgIC8vIGZpbmQgZmlyc3Qgbm9uLWVtcHR5IHJlZ2lvbiB0byB0aGUgcmlnaHQgKHJlY3Vyc2l2ZWx5KVxuICAgICAgICByZXR1cm4gdGhpcy5uZXh0X3JlZ2lvbihuZXh0X25lYXJieSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIG5lYXJieSBvZiBmaXJzdCByZWdpb24gdG8gdGhlIGxlZnRcbiAgICAgKiB3aGljaCBpcyBub3QgdGhlIGNlbnRlciByZWdpb24uIElmIG5vdCBleGlzdHMsIHJldHVyblxuICAgICAqIHVuZGVmaW5lZC4gXG4gICAgICovXG4gICAgbGVmdF9yZWdpb24obmVhcmJ5KSB7XG4gICAgICAgIGNvbnN0IGxlZnQgPSBsZWZ0X2VuZHBvaW50KG5lYXJieSk7XG4gICAgICAgIGlmIChsZWZ0WzBdID09IC1JbmZpbml0eSkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5uZWFyYnkobGVmdCk7ICAgIFxuICAgIH1cblxuICAgIC8qKiBcbiAgICAgKiByZXR1cm4gbmVhcmJ5IG9mIGZpcnN0IG5vbi1lbXB0eSByZWdpb24gdG8gdGhlIGxlZnRcbiAgICAgKiB3aGljaCBpcyBub3QgdGhlIGNlbnRlciByZWdpb24uIElmIG5vdCBleGlzdHMsIHJldHVyblxuICAgICAqIHVuZGVmaW5lZC4gXG4gICAgKi9cbiAgICBwcmV2X3JlZ2lvbihuZWFyYnkpIHtcbiAgICAgICAgY29uc3QgbmV4dF9uZWFyYnkgPSB0aGlzLmxlZnRfcmVnaW9uKG5lYXJieSk7XG4gICAgICAgIGlmIChuZXh0X25lYXJieSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5leHRfbmVhcmJ5LmNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBjZW50ZXIgbm9uLWVtcHR5IFxuICAgICAgICAgICAgcmV0dXJuIG5leHRfbmVhcmJ5O1xuICAgICAgICB9XG4gICAgICAgIC8vIGNlbnRlciBlbXB0eVxuICAgICAgICAvLyBmaW5kIGZpcnN0IG5vbi1lbXB0eSByZWdpb24gdG8gdGhlIGxlZnQgKHJlY3Vyc2l2ZWx5KVxuICAgICAgICByZXR1cm4gdGhpcy5wcmV2X3JlZ2lvbihuZXh0X25lYXJieSk7XG4gICAgfVxuXG4gICAgcmVnaW9ucyhvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVnaW9uSXRlcmF0b3IodGhpcywgb3B0aW9ucyk7XG4gICAgfVxuXG59XG5cblxuLypcbiAgICBJdGVyYXRlIHJlZ2lvbnMgb2YgaW5kZXggZnJvbSBsZWZ0IHRvIHJpZ2h0XG5cbiAgICBJdGVyYXRpb24gbGltaXRlZCB0byBpbnRlcnZhbCBbc3RhcnQsIHN0b3BdIG9uIHRoZSB0aW1lbGluZS5cbiAgICBSZXR1cm5zIGxpc3Qgb2YgaXRlbS1saXN0cy5cbiAgICBvcHRpb25zXG4gICAgLSBzdGFydFxuICAgIC0gc3RvcFxuICAgIC0gaW5jbHVkZUVtcHR5XG4qL1xuXG5jbGFzcyBSZWdpb25JdGVyYXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbmRleCwgb3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge1xuICAgICAgICAgICAgc3RhcnQ9LUluZmluaXR5LCBcbiAgICAgICAgICAgIHN0b3A9SW5maW5pdHksIFxuICAgICAgICAgICAgaW5jbHVkZUVtcHR5PXRydWVcbiAgICAgICAgfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzdGFydCA+IHN0b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciAoXCJzdG9wIG11c3QgYmUgbGFyZ2VyIHRoYW4gc3RhcnRcIiwgc3RhcnQsIHN0b3ApXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faW5kZXggPSBpbmRleDtcbiAgICAgICAgdGhpcy5fc3RhcnQgPSBbc3RhcnQsIDBdO1xuICAgICAgICB0aGlzLl9zdG9wID0gW3N0b3AsIDBdO1xuICAgICAgICB0aGlzLl9pbmNsdWRlRW1wdHkgPSBpbmNsdWRlRW1wdHk7ICAgICAgICBcbiAgICAgICAgdGhpcy5fY3VycmVudDtcbiAgICAgICAgdGhpcy5fZG9uZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIG5leHQoKSB7XG4gICAgICAgIGxldCBjdXJyZW50O1xuICAgICAgICBpZiAodGhpcy5fZG9uZSkge1xuICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZTp1bmRlZmluZWQsIGRvbmU6dHJ1ZX07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBpbml0aWFsaXNlXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50ID0gdGhpcy5faW5kZXgubmVhcmJ5KHRoaXMuX3N0YXJ0KTtcbiAgICAgICAgfSBcbiAgICAgICAgLyogXG4gICAgICAgICAgICBuZWVkIG11bHRpcGxlIHBhc3NlcyB0byBza2lwIG92ZXJcbiAgICAgICAgICAgIGVtcHR5IHJlZ2lvbnMgd2l0aGluIHRoaXMgbmV4dCBpbnZvY2F0aW9uXG4gICAgICAgICovXG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICBjdXJyZW50ID0gdGhpcy5fY3VycmVudDtcblxuICAgICAgICAgICAgLy8gY2hlY2sgaWYgc3RvcCA8IHJlZ2lvbi5sb3dcbiAgICAgICAgICAgIGxldCBsb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGN1cnJlbnQuaXR2KVswXSBcbiAgICAgICAgICAgIGlmIChlbmRwb2ludC5ndChsb3csIHRoaXMuX3N0b3ApKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZTp1bmRlZmluZWQsIGRvbmU6dHJ1ZX07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGlzX2xhc3QgPSBjdXJyZW50Lml0dlsxXSA9PSBJbmZpbml0eTtcblxuICAgICAgICAgICAgLyogXG4gICAgICAgICAgICAgICAgY2hlY2sgaWYgd2UgbmVlZCB0byBza2lwIHRvIG5leHQgd2l0aGluIFxuICAgICAgICAgICAgICAgIHRoaXMgbmV4dCBpbnZvY2F0aW9uXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgY29uc3Qgc2tpcF9lbXB0eSA9IChcbiAgICAgICAgICAgICAgICBpc19sYXN0ID09IGZhbHNlICYmXG4gICAgICAgICAgICAgICAgdGhpcy5faW5jbHVkZUVtcHR5ID09IGZhbHNlICYmXG4gICAgICAgICAgICAgICAgY3VycmVudC5jZW50ZXIubGVuZ3RoID09IDBcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpZiAoc2tpcF9lbXB0eSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2N1cnJlbnQgPSB0aGlzLl9pbmRleC5yaWdodF9yZWdpb24oY3VycmVudCk7XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dW5kZWZpbmVkLCBkb25lOnRydWV9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoaXNfbGFzdCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2RvbmUgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBpbmNyZW1lbnQgY3VycmVudFxuICAgICAgICAgICAgICAgIHRoaXMuX2N1cnJlbnQgPSB0aGlzLl9pbmRleC5yaWdodF9yZWdpb24oY3VycmVudCk7XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RvbmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7dmFsdWU6Y3VycmVudCwgZG9uZTpmYWxzZX07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufVxuXG5cblxuIiwiLypcblx0Q29weXJpZ2h0IDIwMjBcblx0QXV0aG9yIDogSW5nYXIgQXJudHplblxuXG5cdFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUaW1pbmdzcmMgbW9kdWxlLlxuXG5cdFRpbWluZ3NyYyBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG5cdGl0IHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieVxuXHR0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvclxuXHQoYXQgeW91ciBvcHRpb24pIGFueSBsYXRlciB2ZXJzaW9uLlxuXG5cdFRpbWluZ3NyYyBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLFxuXHRidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7IHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZlxuXHRNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG5cdEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuXG5cdFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZVxuXHRhbG9uZyB3aXRoIFRpbWluZ3NyYy4gIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiovXG5cblxuXG4vKlxuXHRFdmVudFxuXHQtIG5hbWU6IGV2ZW50IG5hbWVcblx0LSBwdWJsaXNoZXI6IHRoZSBvYmplY3Qgd2hpY2ggZGVmaW5lZCB0aGUgZXZlbnRcblx0LSBpbml0OiB0cnVlIGlmIHRoZSBldmVudCBzdXBwcG9ydHMgaW5pdCBldmVudHNcblx0LSBzdWJzY3JpcHRpb25zOiBzdWJzY3JpcHRpbnMgdG8gdGhpcyBldmVudFxuXG4qL1xuXG5jbGFzcyBFdmVudCB7XG5cblx0Y29uc3RydWN0b3IgKHB1Ymxpc2hlciwgbmFtZSwgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5wdWJsaXNoZXIgPSBwdWJsaXNoZXI7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gZmFsc2UgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zID0gW107XG5cdH1cblxuXHQvKlxuXHRcdHN1YnNjcmliZSB0byBldmVudFxuXHRcdC0gc3Vic2NyaWJlcjogc3Vic2NyaWJpbmcgb2JqZWN0XG5cdFx0LSBjYWxsYmFjazogY2FsbGJhY2sgZnVuY3Rpb24gdG8gaW52b2tlXG5cdFx0LSBvcHRpb25zOlxuXHRcdFx0aW5pdDogaWYgdHJ1ZSBzdWJzY3JpYmVyIHdhbnRzIGluaXQgZXZlbnRzXG5cdCovXG5cdHN1YnNjcmliZSAoY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRpZiAoIWNhbGxiYWNrIHx8IHR5cGVvZiBjYWxsYmFjayAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayBub3QgYSBmdW5jdGlvblwiLCBjYWxsYmFjayk7XG5cdFx0fVxuXHRcdGNvbnN0IHN1YiA9IG5ldyBTdWJzY3JpcHRpb24odGhpcywgY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5wdXNoKHN1Yik7XG5cdCAgICAvLyBJbml0aWF0ZSBpbml0IGNhbGxiYWNrIGZvciB0aGlzIHN1YnNjcmlwdGlvblxuXHQgICAgaWYgKHRoaXMuaW5pdCAmJiBzdWIuaW5pdCkge1xuXHQgICAgXHRzdWIuaW5pdF9wZW5kaW5nID0gdHJ1ZTtcblx0ICAgIFx0bGV0IHNlbGYgPSB0aGlzO1xuXHQgICAgXHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgIFx0XHRjb25zdCBlQXJncyA9IHNlbGYucHVibGlzaGVyLmV2ZW50aWZ5SW5pdEV2ZW50QXJncyhzZWxmLm5hbWUpIHx8IFtdO1xuXHQgICAgXHRcdHN1Yi5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0ICAgIFx0XHRmb3IgKGxldCBlQXJnIG9mIGVBcmdzKSB7XG5cdCAgICBcdFx0XHRzZWxmLnRyaWdnZXIoZUFyZywgW3N1Yl0sIHRydWUpO1xuXHQgICAgXHRcdH1cblx0ICAgIFx0fSk7XG5cdCAgICB9XG5cdFx0cmV0dXJuIHN1YlxuXHR9XG5cblx0Lypcblx0XHR0cmlnZ2VyIGV2ZW50XG5cblx0XHQtIGlmIHN1YiBpcyB1bmRlZmluZWQgLSBwdWJsaXNoIHRvIGFsbCBzdWJzY3JpcHRpb25zXG5cdFx0LSBpZiBzdWIgaXMgZGVmaW5lZCAtIHB1Ymxpc2ggb25seSB0byBnaXZlbiBzdWJzY3JpcHRpb25cblx0Ki9cblx0dHJpZ2dlciAoZUFyZywgc3VicywgaW5pdCkge1xuXHRcdGxldCBlSW5mbywgY3R4O1xuXHRcdGZvciAoY29uc3Qgc3ViIG9mIHN1YnMpIHtcblx0XHRcdC8vIGlnbm9yZSB0ZXJtaW5hdGVkIHN1YnNjcmlwdGlvbnNcblx0XHRcdGlmIChzdWIudGVybWluYXRlZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGVJbmZvID0ge1xuXHRcdFx0XHRzcmM6IHRoaXMucHVibGlzaGVyLFxuXHRcdFx0XHRuYW1lOiB0aGlzLm5hbWUsXG5cdFx0XHRcdHN1Yjogc3ViLFxuXHRcdFx0XHRpbml0OiBpbml0XG5cdFx0XHR9XG5cdFx0XHRjdHggPSBzdWIuY3R4IHx8IHRoaXMucHVibGlzaGVyO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0c3ViLmNhbGxiYWNrLmNhbGwoY3R4LCBlQXJnLCBlSW5mbyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYEVycm9yIGluICR7dGhpcy5uYW1lfTogJHtzdWIuY2FsbGJhY2t9ICR7ZXJyfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qXG5cdHVuc3Vic2NyaWJlIGZyb20gZXZlbnRcblx0LSB1c2Ugc3Vic2NyaXB0aW9uIHJldHVybmVkIGJ5IHByZXZpb3VzIHN1YnNjcmliZVxuXHQqL1xuXHR1bnN1YnNjcmliZShzdWIpIHtcblx0XHRsZXQgaWR4ID0gdGhpcy5zdWJzY3JpcHRpb25zLmluZGV4T2Yoc3ViKTtcblx0XHRpZiAoaWR4ID4gLTEpIHtcblx0XHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdHN1Yi50ZXJtaW5hdGUoKTtcblx0XHR9XG5cdH1cbn1cblxuXG4vKlxuXHRTdWJzY3JpcHRpb24gY2xhc3NcbiovXG5cbmNsYXNzIFN1YnNjcmlwdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoZXZlbnQsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLmV2ZW50ID0gZXZlbnQ7XG5cdFx0dGhpcy5uYW1lID0gZXZlbnQubmFtZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2tcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gdGhpcy5ldmVudC5pbml0IDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gZmFsc2U7XG5cdFx0dGhpcy5jdHggPSBvcHRpb25zLmN0eDtcblx0fVxuXG5cdHRlcm1pbmF0ZSgpIHtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSB0cnVlO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5ldmVudC51bnN1YnNjcmliZSh0aGlzKTtcblx0fVxufVxuXG5cbi8qXG5cblx0RVZFTlRJRlkgSU5TVEFOQ0VcblxuXHRFdmVudGlmeSBicmluZ3MgZXZlbnRpbmcgY2FwYWJpbGl0aWVzIHRvIGFueSBvYmplY3QuXG5cblx0SW4gcGFydGljdWxhciwgZXZlbnRpZnkgc3VwcG9ydHMgdGhlIGluaXRpYWwtZXZlbnQgcGF0dGVybi5cblx0T3B0LWluIGZvciBpbml0aWFsIGV2ZW50cyBwZXIgZXZlbnQgdHlwZS5cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlJbnN0YW5jZSAob2JqZWN0KSB7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwID0gbmV3IE1hcCgpO1xuXHRvYmplY3QuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0cmV0dXJuIG9iamVjdDtcbn07XG5cblxuLypcblx0RVZFTlRJRlkgUFJPVE9UWVBFXG5cblx0QWRkIGV2ZW50aWZ5IGZ1bmN0aW9uYWxpdHkgdG8gcHJvdG90eXBlIG9iamVjdFxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5UHJvdG90eXBlKF9wcm90b3R5cGUpIHtcblxuXHRmdW5jdGlvbiBldmVudGlmeUdldEV2ZW50KG9iamVjdCwgbmFtZSkge1xuXHRcdGNvbnN0IGV2ZW50ID0gb2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAuZ2V0KG5hbWUpO1xuXHRcdGlmIChldmVudCA9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IHVuZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0cmV0dXJuIGV2ZW50O1xuXHR9XG5cblx0Lypcblx0XHRERUZJTkUgRVZFTlRcblx0XHQtIHVzZWQgb25seSBieSBldmVudCBzb3VyY2Vcblx0XHQtIG5hbWU6IG5hbWUgb2YgZXZlbnRcblx0XHQtIG9wdGlvbnM6IHtpbml0OnRydWV9IHNwZWNpZmllcyBpbml0LWV2ZW50IHNlbWFudGljcyBmb3IgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlEZWZpbmUobmFtZSwgb3B0aW9ucykge1xuXHRcdC8vIGNoZWNrIHRoYXQgZXZlbnQgZG9lcyBub3QgYWxyZWFkeSBleGlzdFxuXHRcdGlmICh0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuaGFzKG5hbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCBhbHJlYWR5IGRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5zZXQobmFtZSwgbmV3IEV2ZW50KHRoaXMsIG5hbWUsIG9wdGlvbnMpKTtcblx0fTtcblxuXHQvKlxuXHRcdE9OXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRyZWdpc3RlciBjYWxsYmFjayBvbiBldmVudC5cblx0Ki9cblx0ZnVuY3Rpb24gb24obmFtZSwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpYmUoY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T0ZGXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRVbi1yZWdpc3RlciBhIGhhbmRsZXIgZnJvbSBhIHNwZWNmaWMgZXZlbnQgdHlwZVxuXHQqL1xuXHRmdW5jdGlvbiBvZmYoc3ViKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgc3ViLm5hbWUpLnVuc3Vic2NyaWJlKHN1Yik7XG5cdH07XG5cblxuXHRmdW5jdGlvbiBldmVudGlmeVN1YnNjcmlwdGlvbnMobmFtZSkge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmlwdGlvbnM7XG5cdH1cblxuXG5cblx0Lypcblx0XHRUcmlnZ2VyIGxpc3Qgb2YgZXZlbnRJdGVtcyBvbiBvYmplY3RcblxuXHRcdGV2ZW50SXRlbTogIHtuYW1lOi4uLCBlQXJnOi4ufVxuXG5cdFx0Y29weSBhbGwgZXZlbnRJdGVtcyBpbnRvIGJ1ZmZlci5cblx0XHRyZXF1ZXN0IGVtcHR5aW5nIHRoZSBidWZmZXIsIGkuZS4gYWN0dWFsbHkgdHJpZ2dlcmluZyBldmVudHMsXG5cdFx0ZXZlcnkgdGltZSB0aGUgYnVmZmVyIGdvZXMgZnJvbSBlbXB0eSB0byBub24tZW1wdHlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxsKGV2ZW50SXRlbXMpIHtcblx0XHRpZiAoZXZlbnRJdGVtcy5sZW5ndGggPT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIG1ha2UgdHJpZ2dlciBpdGVtc1xuXHRcdC8vIHJlc29sdmUgbm9uLXBlbmRpbmcgc3Vic2NyaXB0aW9ucyBub3dcblx0XHQvLyBlbHNlIHN1YnNjcmlwdGlvbnMgbWF5IGNoYW5nZSBmcm9tIHBlbmRpbmcgdG8gbm9uLXBlbmRpbmdcblx0XHQvLyBiZXR3ZWVuIGhlcmUgYW5kIGFjdHVhbCB0cmlnZ2VyaW5nXG5cdFx0Ly8gbWFrZSBsaXN0IG9mIFtldiwgZUFyZywgc3Vic10gdHVwbGVzXG5cdFx0bGV0IHRyaWdnZXJJdGVtcyA9IGV2ZW50SXRlbXMubWFwKChpdGVtKSA9PiB7XG5cdFx0XHRsZXQge25hbWUsIGVBcmd9ID0gaXRlbTtcblx0XHRcdGxldCBldiA9IGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSk7XG5cdFx0XHRsZXQgc3VicyA9IGV2LnN1YnNjcmlwdGlvbnMuZmlsdGVyKHN1YiA9PiBzdWIuaW5pdF9wZW5kaW5nID09IGZhbHNlKTtcblx0XHRcdHJldHVybiBbZXYsIGVBcmcsIHN1YnNdO1xuXHRcdH0sIHRoaXMpO1xuXG5cdFx0Ly8gYXBwZW5kIHRyaWdnZXIgSXRlbXMgdG8gYnVmZmVyXG5cdFx0Y29uc3QgbGVuID0gdHJpZ2dlckl0ZW1zLmxlbmd0aDtcblx0XHRjb25zdCBidWYgPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyO1xuXHRcdGNvbnN0IGJ1Zl9sZW4gPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aDtcblx0XHQvLyByZXNlcnZlIG1lbW9yeSAtIHNldCBuZXcgbGVuZ3RoXG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGggPSBidWZfbGVuICsgbGVuO1xuXHRcdC8vIGNvcHkgdHJpZ2dlckl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGZvciAobGV0IGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0YnVmW2J1Zl9sZW4raV0gPSB0cmlnZ2VySXRlbXNbaV07XG5cdFx0fVxuXHRcdC8vIHJlcXVlc3QgZW1wdHlpbmcgb2YgdGhlIGJ1ZmZlclxuXHRcdGlmIChidWZfbGVuID09IDApIHtcblx0XHRcdGxldCBzZWxmID0gdGhpcztcblx0XHRcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGZvciAobGV0IFtldiwgZUFyZywgc3Vic10gb2Ygc2VsZi5fX2V2ZW50aWZ5X2J1ZmZlcikge1xuXHRcdFx0XHRcdC8vIGFjdHVhbCBldmVudCB0cmlnZ2VyaW5nXG5cdFx0XHRcdFx0ZXYudHJpZ2dlcihlQXJnLCBzdWJzLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZi5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIG11bHRpcGxlIGV2ZW50cyBvZiBzYW1lIHR5cGUgKG5hbWUpXG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsaWtlKG5hbWUsIGVBcmdzKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKGVBcmdzLm1hcChlQXJnID0+IHtcblx0XHRcdHJldHVybiB7bmFtZSwgZUFyZ307XG5cdFx0fSkpO1xuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIHNpbmdsZSBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXIobmFtZSwgZUFyZykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChbe25hbWUsIGVBcmd9XSk7XG5cdH1cblxuXHRfcHJvdG90eXBlLmV2ZW50aWZ5RGVmaW5lID0gZXZlbnRpZnlEZWZpbmU7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyID0gZXZlbnRpZnlUcmlnZ2VyO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsaWtlID0gZXZlbnRpZnlUcmlnZ2VyQWxpa2U7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxsID0gZXZlbnRpZnlUcmlnZ2VyQWxsO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5U3Vic2NyaXB0aW9ucyA9IGV2ZW50aWZ5U3Vic2NyaXB0aW9ucztcblx0X3Byb3RvdHlwZS5vbiA9IG9uO1xuXHRfcHJvdG90eXBlLm9mZiA9IG9mZjtcbn07XG5cblxuZXhwb3J0IHtldmVudGlmeUluc3RhbmNlIGFzIGFkZFRvSW5zdGFuY2V9O1xuZXhwb3J0IHtldmVudGlmeVByb3RvdHlwZSBhcyBhZGRUb1Byb3RvdHlwZX07XG5cbi8qXG5cdEV2ZW50IFZhcmlhYmxlXG5cblx0T2JqZWN0cyB3aXRoIGEgc2luZ2xlIFwiY2hhbmdlXCIgZXZlbnRcbiovXG5cbmV4cG9ydCBjbGFzcyBFdmVudFZhcmlhYmxlIHtcblxuXHRjb25zdHJ1Y3RvciAodmFsdWUpIHtcblx0XHRldmVudGlmeUluc3RhbmNlKHRoaXMpO1xuXHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0dGhpcy5ldmVudGlmeURlZmluZShcImNoYW5nZVwiLCB7aW5pdDp0cnVlfSk7XG5cdH1cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG5cdGdldCB2YWx1ZSAoKSB7cmV0dXJuIHRoaXMuX3ZhbHVlfTtcblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdGlmICh2YWx1ZSAhPSB0aGlzLl92YWx1ZSkge1xuXHRcdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHRcdHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHZhbHVlKTtcblx0XHR9XG5cdH1cbn1cbmV2ZW50aWZ5UHJvdG90eXBlKEV2ZW50VmFyaWFibGUucHJvdG90eXBlKTtcblxuLypcblx0RXZlbnQgQm9vbGVhblxuXG5cblx0Tm90ZSA6IGltcGxlbWVudGF0aW9uIHVzZXMgZmFsc2luZXNzIG9mIGlucHV0IHBhcmFtZXRlciB0byBjb25zdHJ1Y3RvciBhbmQgc2V0KCkgb3BlcmF0aW9uLFxuXHRzbyBldmVudEJvb2xlYW4oLTEpIHdpbGwgYWN0dWFsbHkgc2V0IGl0IHRvIHRydWUgYmVjYXVzZVxuXHQoLTEpID8gdHJ1ZSA6IGZhbHNlIC0+IHRydWUgIVxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50Qm9vbGVhbiBleHRlbmRzIEV2ZW50VmFyaWFibGUge1xuXHRjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuXHRcdHN1cGVyKEJvb2xlYW4odmFsdWUpKTtcblx0fVxuXG5cdHNldCB2YWx1ZSAodmFsdWUpIHtcblx0XHRzdXBlci52YWx1ZSA9IEJvb2xlYW4odmFsdWUpO1xuXHR9XG5cdGdldCB2YWx1ZSAoKSB7cmV0dXJuIHN1cGVyLnZhbHVlfTtcbn1cblxuXG4vKlxuXHRtYWtlIGEgcHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aGVuIEV2ZW50Qm9vbGVhbiBjaGFuZ2VzXG5cdHZhbHVlLlxuKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWtlUHJvbWlzZShldmVudE9iamVjdCwgY29uZGl0aW9uRnVuYykge1xuXHRjb25kaXRpb25GdW5jID0gY29uZGl0aW9uRnVuYyB8fCBmdW5jdGlvbih2YWwpIHtyZXR1cm4gdmFsID09IHRydWV9O1xuXHRyZXR1cm4gbmV3IFByb21pc2UgKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0XHRsZXQgc3ViID0gZXZlbnRPYmplY3Qub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHRpZiAoY29uZGl0aW9uRnVuYyh2YWx1ZSkpIHtcblx0XHRcdFx0cmVzb2x2ZSh2YWx1ZSk7XG5cdFx0XHRcdGV2ZW50T2JqZWN0Lm9mZihzdWIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcbn07XG5cbi8vIG1vZHVsZSBhcGlcbmV4cG9ydCBkZWZhdWx0IHtcblx0ZXZlbnRpZnlQcm90b3R5cGUsXG5cdGV2ZW50aWZ5SW5zdGFuY2UsXG5cdEV2ZW50VmFyaWFibGUsXG5cdEV2ZW50Qm9vbGVhbixcblx0bWFrZVByb21pc2Vcbn07XG5cbiIsIlxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU09VUkNFIFBST1BFUlRZIChTUkNQUk9QKVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBGdW5jdGlvbnMgZm9yIGV4dGVuZGluZyBhIGNsYXNzIHdpdGggc3VwcG9ydCBmb3IgXG4gKiBleHRlcm5hbCBzb3VyY2Ugb24gYSBuYW1lZCBwcm9wZXJ0eS5cbiAqIFxuICogb3B0aW9uOiBtdXRhYmxlOnRydWUgbWVhbnMgdGhhdCBwcm9wZXJ5IG1heSBiZSByZXNldCBcbiAqIFxuICogc291cmNlIG9iamVjdCBpcyBhc3N1bWVkIHRvIHN1cHBvcnQgdGhlIGNhbGxiYWNrIGludGVyZmFjZSxcbiAqIG9yIGJlIGEgbGlzdCBvZiBvYmplY3RzIGFsbCBzdXBwb3J0aW5nIHRoZSBjYWxsYmFjayBpbnRlcmZhY2VcbiAqL1xuXG5jb25zdCBOQU1FID0gXCJzcmNwcm9wXCI7XG5jb25zdCBQUkVGSVggPSBgX18ke05BTUV9YDtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2UgKG9iamVjdCkge1xuICAgIG9iamVjdFtgJHtQUkVGSVh9YF0gPSBuZXcgTWFwKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuXG4gICAgZnVuY3Rpb24gcmVnaXN0ZXIocHJvcE5hbWUsIG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHttdXRhYmxlPXRydWV9ID0gb3B0aW9ucztcbiAgICAgICAgY29uc3QgbWFwID0gdGhpc1tgJHtQUkVGSVh9YF07IFxuICAgICAgICBtYXAuc2V0KHByb3BOYW1lLCB7XG4gICAgICAgICAgICBpbml0OmZhbHNlLFxuICAgICAgICAgICAgbXV0YWJsZSxcbiAgICAgICAgICAgIGVudGl0eTogdW5kZWZpbmVkLFxuICAgICAgICAgICAgaGFuZGxlczogW11cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gcmVnaXN0ZXIgZ2V0dGVycyBhbmQgc2V0dGVyc1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgcHJvcE5hbWUsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBtYXAuZ2V0KHByb3BOYW1lKS5lbnRpdHk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAoZW50aXR5KSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXNbYCR7TkFNRX1fY2hlY2tgXSkge1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHkgPSB0aGlzW2Ake05BTUV9X2NoZWNrYF0ocHJvcE5hbWUsIGVudGl0eSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChlbnRpdHkgIT0gbWFwLmdldChwcm9wTmFtZSkuZW50aXR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbYCR7UFJFRklYfV9hdHRhY2hgXShwcm9wTmFtZSwgZW50aXR5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGF0dGF0Y2gocHJvcE5hbWUsIGVudGl0eSkge1xuXG4gICAgICAgIGNvbnN0IG1hcCA9IHRoaXNbYCR7UFJFRklYfWBdO1xuICAgICAgICBjb25zdCBzdGF0ZSA9IG1hcC5nZXQocHJvcE5hbWUpXG5cbiAgICAgICAgaWYgKHN0YXRlLmluaXQgJiYgIXN0YXRlLm11dGFibGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtwcm9wTmFtZX0gY2FuIG5vdCBiZSByZWFzc2lnbmVkYCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBlbnRpdGllcyA9IChBcnJheS5pc0FycmF5KGVudGl0eSkpID8gZW50aXR5IDogW2VudGl0eV07XG5cbiAgICAgICAgLy8gdW5zdWJzY3JpYmUgZnJvbSBlbnRpdGllc1xuICAgICAgICBpZiAoc3RhdGUuaGFuZGxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtpZHgsIGVdIG9mIE9iamVjdC5lbnRyaWVzKGVudGl0aWVzKSkge1xuICAgICAgICAgICAgICAgIGUucmVtb3ZlX2NhbGxiYWNrKHN0YXRlLmhhbmRsZXNbaWR4XSk7XG4gICAgICAgICAgICB9ICAgIFxuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmhhbmRsZXMgPSBbXTtcblxuICAgICAgICAvLyBhdHRhdGNoIG5ldyBlbnRpdHlcbiAgICAgICAgc3RhdGUuZW50aXR5ID0gZW50aXR5O1xuICAgICAgICBzdGF0ZS5pbml0ID0gdHJ1ZTtcblxuICAgICAgICAvLyBzdWJzY3JpYmUgdG8gY2FsbGJhY2sgZnJvbSBzb3VyY2VcbiAgICAgICAgaWYgKHRoaXNbYCR7TkFNRX1fb25jaGFuZ2VgXSkge1xuICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IGZ1bmN0aW9uIChlQXJnKSB7XG4gICAgICAgICAgICAgICAgdGhpc1tgJHtOQU1FfV9vbmNoYW5nZWBdKHByb3BOYW1lLCBlQXJnKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZSBvZiBlbnRpdGllcykge1xuICAgICAgICAgICAgICAgIHN0YXRlLmhhbmRsZXMucHVzaChlLmFkZF9jYWxsYmFjayhoYW5kbGVyKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzW2Ake05BTUV9X29uY2hhbmdlYF0ocHJvcE5hbWUsIFwicmVzZXRcIik7IFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgYXBpID0ge307XG4gICAgYXBpW2Ake05BTUV9X3JlZ2lzdGVyYF0gPSByZWdpc3RlcjtcbiAgICBhcGlbYCR7UFJFRklYfV9hdHRhY2hgXSA9IGF0dGF0Y2g7XG4gICAgT2JqZWN0LmFzc2lnbihfcHJvdG90eXBlLCBhcGkpO1xufVxuXG4iLCJpbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuQkFTRSBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuXHRBYnN0cmFjdCBCYXNlIENsYXNzIGZvciBTZWdtZW50c1xuXG4gICAgY29uc3RydWN0b3IoaW50ZXJ2YWwpXG5cbiAgICAtIGludGVydmFsOiBpbnRlcnZhbCBvZiB2YWxpZGl0eSBvZiBzZWdtZW50XG4gICAgLSBkeW5hbWljOiB0cnVlIGlmIHNlZ21lbnQgaXMgZHluYW1pY1xuICAgIC0gdmFsdWUob2Zmc2V0KTogdmFsdWUgb2Ygc2VnbWVudCBhdCBvZmZzZXRcbiAgICAtIHF1ZXJ5KG9mZnNldCk6IHN0YXRlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4qL1xuXG5leHBvcnQgY2xhc3MgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0dikge1xuXHRcdHRoaXMuX2l0diA9IGl0djtcblx0fVxuXG5cdGdldCBpdHYoKSB7cmV0dXJuIHRoaXMuX2l0djt9XG5cbiAgICAvKiogXG4gICAgICogaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3NcbiAgICAgKiByZXR1cm5zIHt2YWx1ZSwgZHluYW1pY307XG4gICAgKi9cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjb252ZW5pZW5jZSBmdW5jdGlvbiByZXR1cm5pbmcgdGhlIHN0YXRlIG9mIHRoZSBzZWdtZW50XG4gICAgICogQHBhcmFtIHsqfSBvZmZzZXQgXG4gICAgICogQHJldHVybnMgXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5faXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuc3RhdGUob2Zmc2V0KSwgb2Zmc2V0fTtcbiAgICAgICAgfSBcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdW5kZWZpbmVkLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExBWUVSUyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBMYXllcnNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX2xheWVycyA9IGFyZ3MubGF5ZXJzO1xuICAgICAgICB0aGlzLl92YWx1ZV9mdW5jID0gYXJncy52YWx1ZV9mdW5jXG5cbiAgICAgICAgLy8gVE9ETyAtIGZpZ3VyZSBvdXQgZHluYW1pYyBoZXJlP1xuICAgIH1cblxuXHRzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgLy8gVE9ETyAtIHVzZSB2YWx1ZSBmdW5jXG4gICAgICAgIC8vIGZvciBub3cgLSBqdXN0IHVzZSBmaXJzdCBsYXllclxuICAgICAgICByZXR1cm4gey4uLnRoaXMuX2xheWVyc1swXS5xdWVyeShvZmZzZXQpLCBvZmZzZXR9O1xuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU1RBVElDIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIFN0YXRpY1NlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG5cdFx0dGhpcy5fdmFsdWUgPSBkYXRhO1xuXHR9XG5cblx0c3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3ZhbHVlLCBkeW5hbWljOmZhbHNlfVxuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTU9USU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qXG4gICAgSW1wbGVtZW50cyBkZXRlcm1pbmlzdGljIHByb2plY3Rpb24gYmFzZWQgb24gaW5pdGlhbCBjb25kaXRpb25zIFxuICAgIC0gbW90aW9uIHZlY3RvciBkZXNjcmliZXMgbW90aW9uIHVuZGVyIGNvbnN0YW50IGFjY2VsZXJhdGlvblxuKi9cblxuZXhwb3J0IGNsYXNzIE1vdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG4gICAgXG4gICAgY29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOnAwPTAsIFxuICAgICAgICAgICAgdmVsb2NpdHk6djA9MCwgXG4gICAgICAgICAgICBhY2NlbGVyYXRpb246YTA9MCwgXG4gICAgICAgICAgICB0aW1lc3RhbXA6dDA9MFxuICAgICAgICB9ID0gZGF0YTtcbiAgICAgICAgLy8gY3JlYXRlIG1vdGlvbiB0cmFuc2l0aW9uXG4gICAgICAgIHRoaXMuX3Bvc19mdW5jID0gZnVuY3Rpb24gKHRzKSB7XG4gICAgICAgICAgICBsZXQgZCA9IHRzIC0gdDA7XG4gICAgICAgICAgICByZXR1cm4gcDAgKyB2MCpkICsgMC41KmEwKmQqZDtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fdmVsX2Z1bmMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIGxldCBkID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHJldHVybiB2MCArIGEwKmQ7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fYWNjX2Z1bmMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIHJldHVybiBhMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRlKG9mZnNldCkge1xuICAgICAgICBsZXQgcG9zID0gdGhpcy5fcG9zX2Z1bmMob2Zmc2V0KTtcbiAgICAgICAgbGV0IHZlbCA9IHRoaXMuX3ZlbF9mdW5jKG9mZnNldCk7XG4gICAgICAgIGxldCBhY2MgPSB0aGlzLl9hY2NfZnVuYyhvZmZzZXQpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcG9zaXRpb246IHBvcyxcbiAgICAgICAgICAgIHZlbG9jaXR5OiB2ZWwsXG4gICAgICAgICAgICBhY2NlbGVyYXRpb246IGFjYyxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogb2Zmc2V0LFxuICAgICAgICAgICAgdmFsdWU6IHBvcyxcbiAgICAgICAgICAgIGR5bmFtaWM6ICh2ZWwgIT0gMCB8fCBhY2MgIT0gMCApXG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVFJBTlNJVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgU3VwcG9ydGVkIGVhc2luZyBmdW5jdGlvbnNcbiAgICBcImVhc2UtaW5cIjpcbiAgICBcImVhc2Utb3V0XCI6XG4gICAgXCJlYXNlLWluLW91dFwiXG4qL1xuXG5mdW5jdGlvbiBlYXNlaW4gKHRzKSB7XG4gICAgcmV0dXJuIE1hdGgucG93KHRzLDIpOyAgXG59XG5mdW5jdGlvbiBlYXNlb3V0ICh0cykge1xuICAgIHJldHVybiAxIC0gZWFzZWluKDEgLSB0cyk7XG59XG5mdW5jdGlvbiBlYXNlaW5vdXQgKHRzKSB7XG4gICAgaWYgKHRzIDwgLjUpIHtcbiAgICAgICAgcmV0dXJuIGVhc2VpbigyICogdHMpIC8gMjtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gKDIgLSBlYXNlaW4oMiAqICgxIC0gdHMpKSkgLyAyO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRyYW5zaXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuXHRcdHN1cGVyKGl0dik7XG4gICAgICAgIGxldCB7djAsIHYxLCBlYXNpbmd9ID0gZGF0YTtcbiAgICAgICAgbGV0IFt0MCwgdDFdID0gdGhpcy5faXR2LnNsaWNlKDAsMik7XG5cbiAgICAgICAgLy8gY3JlYXRlIHRoZSB0cmFuc2l0aW9uIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuX2R5bmFtaWMgPSB2MS12MCAhPSAwO1xuICAgICAgICB0aGlzLl90cmFucyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgLy8gY29udmVydCB0cyB0byBbdDAsdDFdLXNwYWNlXG4gICAgICAgICAgICAvLyAtIHNoaWZ0IGZyb20gW3QwLHQxXS1zcGFjZSB0byBbMCwodDEtdDApXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzY2FsZSBmcm9tIFswLCh0MS10MCldLXNwYWNlIHRvIFswLDFdLXNwYWNlXG4gICAgICAgICAgICB0cyA9IHRzIC0gdDA7XG4gICAgICAgICAgICB0cyA9IHRzL3BhcnNlRmxvYXQodDEtdDApO1xuICAgICAgICAgICAgLy8gZWFzaW5nIGZ1bmN0aW9ucyBzdHJldGNoZXMgb3IgY29tcHJlc3NlcyB0aGUgdGltZSBzY2FsZSBcbiAgICAgICAgICAgIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluXCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2Vpbih0cyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVhc2luZyA9PSBcImVhc2Utb3V0XCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2VvdXQodHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW5vdXQodHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbGluZWFyIHRyYW5zaXRpb24gZnJvbSB2MCB0byB2MSwgZm9yIHRpbWUgdmFsdWVzIFswLDFdXG4gICAgICAgICAgICB0cyA9IE1hdGgubWF4KHRzLCAwKTtcbiAgICAgICAgICAgIHRzID0gTWF0aC5taW4odHMsIDEpO1xuICAgICAgICAgICAgcmV0dXJuIHYwICsgKHYxLXYwKSp0cztcbiAgICAgICAgfVxuXHR9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dGhpcy5fZHluYW1pY31cblx0fVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgSU5URVJQT0xBVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogRnVuY3Rpb24gdG8gY3JlYXRlIGFuIGludGVycG9sYXRvciBmb3IgbmVhcmVzdCBuZWlnaGJvciBpbnRlcnBvbGF0aW9uIHdpdGhcbiAqIGV4dHJhcG9sYXRpb24gc3VwcG9ydC5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSB0dXBsZXMgLSBBbiBhcnJheSBvZiBbdmFsdWUsIG9mZnNldF0gcGFpcnMsIHdoZXJlIHZhbHVlIGlzIHRoZVxuICogcG9pbnQncyB2YWx1ZSBhbmQgb2Zmc2V0IGlzIHRoZSBjb3JyZXNwb25kaW5nIG9mZnNldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gLSBBIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYW4gb2Zmc2V0IGFuZCByZXR1cm5zIHRoZVxuICogaW50ZXJwb2xhdGVkIG9yIGV4dHJhcG9sYXRlZCB2YWx1ZS5cbiAqL1xuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZSh0dXBsZXMpIHtcblxuICAgIGlmICh0dXBsZXMubGVuZ3RoIDwgMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdW5kZWZpbmVkO31cbiAgICB9IGVsc2UgaWYgKHR1cGxlcy5sZW5ndGggPT0gMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdHVwbGVzWzBdWzBdO31cbiAgICB9XG5cbiAgICAvLyBTb3J0IHRoZSB0dXBsZXMgYnkgdGhlaXIgb2Zmc2V0c1xuICAgIGNvbnN0IHNvcnRlZFR1cGxlcyA9IFsuLi50dXBsZXNdLnNvcnQoKGEsIGIpID0+IGFbMV0gLSBiWzFdKTtcbiAgXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvcihvZmZzZXQpIHtcbiAgICAgIC8vIEhhbmRsZSBleHRyYXBvbGF0aW9uIGJlZm9yZSB0aGUgZmlyc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPD0gc29ydGVkVHVwbGVzWzBdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzWzBdO1xuICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1sxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBhZnRlciB0aGUgbGFzdCBwb2ludFxuICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAyXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdO1xuICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICB9XG4gIFxuICAgICAgLy8gRmluZCB0aGUgbmVhcmVzdCBwb2ludHMgdG8gdGhlIGxlZnQgYW5kIHJpZ2h0XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvcnRlZFR1cGxlcy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbaV1bMV0gJiYgb2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1tpICsgMV1bMV0pIHtcbiAgICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tpXTtcbiAgICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1tpICsgMV07XG4gICAgICAgICAgLy8gTGluZWFyIGludGVycG9sYXRpb24gZm9ybXVsYTogeSA9IHkxICsgKCAoeCAtIHgxKSAqICh5MiAtIHkxKSAvICh4MiAtIHgxKSApXG4gICAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gIFxuICAgICAgLy8gSW4gY2FzZSB0aGUgb2Zmc2V0IGRvZXMgbm90IGZhbGwgd2l0aGluIGFueSByYW5nZSAoc2hvdWxkIGJlIGNvdmVyZWQgYnkgdGhlIHByZXZpb3VzIGNvbmRpdGlvbnMpXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH07XG59XG4gIFxuXG5leHBvcnQgY2xhc3MgSW50ZXJwb2xhdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cbiAgICBjb25zdHJ1Y3RvcihpdHYsIHR1cGxlcykge1xuICAgICAgICBzdXBlcihpdHYpO1xuICAgICAgICAvLyBzZXR1cCBpbnRlcnBvbGF0aW9uIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuX3RyYW5zID0gaW50ZXJwb2xhdGUodHVwbGVzKTtcbiAgICB9XG5cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdGhpcy5fdHJhbnMob2Zmc2V0KSwgZHluYW1pYzp0cnVlfTtcbiAgICB9XG59XG5cblxuIiwiXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQ0xPQ0tTXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogY2xvY2tzIGNvdW50aW5nIGluIHNlY29uZHNcbiAqL1xuXG5jb25zdCBsb2NhbCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gcGVyZm9ybWFuY2Uubm93KCkvMTAwMC4wO1xufVxuXG5jb25zdCBlcG9jaCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS8xMDAwLjA7XG59XG5cbi8qKlxuICogdGhlIGNsb2NrIGdpdmVzIGVwb2NoIHZhbHVlcywgYnV0IGlzIGltcGxlbWVudGVkXG4gKiB1c2luZyBhIGhpZ2ggcGVyZm9ybWFuY2UgbG9jYWwgY2xvY2sgZm9yIGJldHRlclxuICogdGltZSByZXNvbHV0aW9uIGFuZCBwcm90ZWN0aW9uIGFnYWluc3Qgc3lzdGVtIFxuICogdGltZSBhZGp1c3RtZW50cy5cbiAqL1xuXG5leHBvcnQgY29uc3QgQ0xPQ0sgPSBmdW5jdGlvbiAoKSB7XG4gICAgY29uc3QgdDBfbG9jYWwgPSBsb2NhbCgpO1xuICAgIGNvbnN0IHQwX2Vwb2NoID0gZXBvY2goKTtcbiAgICByZXR1cm4ge1xuICAgICAgICBub3c6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0MF9lcG9jaCArIChsb2NhbCgpIC0gdDBfbG9jYWwpXG4gICAgICAgIH1cbiAgICB9XG59KCk7XG5cblxuLy8gb3Z2ZXJyaWRlIG1vZHVsbyB0byBiZWhhdmUgYmV0dGVyIGZvciBuZWdhdGl2ZSBudW1iZXJzXG5leHBvcnQgZnVuY3Rpb24gbW9kKG4sIG0pIHtcbiAgICByZXR1cm4gKChuICUgbSkgKyBtKSAlIG07XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZGl2bW9kKHgsIGJhc2UpIHtcbiAgICBsZXQgbiA9IE1hdGguZmxvb3IoeCAvIGJhc2UpXG4gICAgbGV0IHIgPSBtb2QoeCwgYmFzZSk7XG4gICAgcmV0dXJuIFtuLCByXTtcbn1cblxuXG4vKlxuICAgIHNpbWlsYXIgdG8gcmFuZ2UgZnVuY3Rpb24gaW4gcHl0aG9uXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gcmFuZ2UgKHN0YXJ0LCBlbmQsIHN0ZXAgPSAxLCBvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgY29uc3Qge2luY2x1ZGVfZW5kPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgaWYgKHN0ZXAgPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTdGVwIGNhbm5vdCBiZSB6ZXJvLicpO1xuICAgIH1cbiAgICBpZiAoc3RhcnQgPCBlbmQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IHN0ZXApIHtcbiAgICAgICAgICByZXN1bHQucHVzaChpKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RhcnQgPiBlbmQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpID4gZW5kOyBpIC09IHN0ZXApIHtcbiAgICAgICAgICByZXN1bHQucHVzaChpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoaW5jbHVkZV9lbmQpIHtcbiAgICAgICAgcmVzdWx0LnB1c2goZW5kKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuXG4vKipcbiAqIENyZWF0ZSBhIHNpbmdsZSBzdGF0ZSBmcm9tIGEgbGlzdCBvZiBzdGF0ZXMsIHVzaW5nIGEgdmFsdWVGdW5jXG4gKiBzdGF0ZTp7dmFsdWUsIGR5bmFtaWMsIG9mZnNldH1cbiAqIFxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiB0b1N0YXRlKHNvdXJjZXMsIHN0YXRlcywgb2Zmc2V0LCBvcHRpb25zPXt9KSB7XG4gICAgbGV0IHt2YWx1ZUZ1bmMsIHN0YXRlRnVuY30gPSBvcHRpb25zOyBcbiAgICBpZiAodmFsdWVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBsZXQgdmFsdWUgPSB2YWx1ZUZ1bmMoe3NvdXJjZXMsIHN0YXRlcywgb2Zmc2V0fSk7XG4gICAgICAgIGxldCBkeW5hbWljID0gc3RhdGVzLm1hcCgodikgPT4gdi5keW1hbWljKS5zb21lKGU9PmUpO1xuICAgICAgICByZXR1cm4ge3ZhbHVlLCBkeW5hbWljLCBvZmZzZXR9O1xuICAgIH0gZWxzZSBpZiAoc3RhdGVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gey4uLnN0YXRlRnVuYyh7c291cmNlcywgc3RhdGVzLCBvZmZzZXR9KSwgb2Zmc2V0fTtcbiAgICB9XG4gICAgLy8gbm8gdmFsdWVGdW5jIG9yIHN0YXRlRnVuY1xuICAgIGlmIChzdGF0ZXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTp1bmRlZmluZWQsIGR5bmFtaWM6ZmFsc2UsIG9mZnNldH1cbiAgICB9XG4gICAgLy8gZmFsbGJhY2sgLSBqdXN0IHVzZSBmaXJzdCBzdGF0ZVxuICAgIGxldCBzdGF0ZSA9IHN0YXRlc1swXTtcbiAgICByZXR1cm4gey4uLnN0YXRlLCBvZmZzZXR9OyBcbn0iLCJpbXBvcnQgeyBpbnRlcnZhbCwgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuL25lYXJieWluZGV4LmpzXCI7XG5cbi8qKlxuICogXG4gKiBOZWFyYnkgSW5kZXggU2ltcGxlXG4gKiBcbiAqIC0gaXRlbXMgYXJlIGFzc3VtZWQgdG8gYmUgbm9uLW92ZXJsYXBwaW5nIG9uIHRoZSB0aW1lbGluZSwgXG4gKiAtIGltcGx5aW5nIHRoYXQgbmVhcmJ5LmNlbnRlciB3aWxsIGJlIGEgbGlzdCBvZiBhdCBtb3N0IG9uZSBJVEVNLiBcbiAqIC0gZXhjZXB0aW9uIHdpbGwgYmUgcmFpc2VkIGlmIG92ZXJsYXBwaW5nIElURU1TIGFyZSBmb3VuZFxuICogLSBJVEVNUyBpcyBhc3N1bWJlZCB0byBiZSBpbW11dGFibGUgYXJyYXkgLSBjaGFuZ2UgSVRFTVMgYnkgcmVwbGFjaW5nIGFycmF5XG4gKiBcbiAqICBcbiAqL1xuXG5cbi8vIGdldCBpbnRlcnZhbCBsb3cgcG9pbnRcbmZ1bmN0aW9uIGdldF9sb3dfdmFsdWUoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLml0dlswXTtcbn1cblxuLy8gZ2V0IGludGVydmFsIGxvdyBlbmRwb2ludFxuZnVuY3Rpb24gZ2V0X2xvd19lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzBdXG59XG5cbi8vIGdldCBpbnRlcnZhbCBoaWdoIGVuZHBvaW50XG5mdW5jdGlvbiBnZXRfaGlnaF9lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzFdXG59XG5cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4U2ltcGxlIGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKHNyYykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9zcmMgPSBzcmM7XG4gICAgfVxuXG4gICAgZ2V0IHNyYyAoKSB7cmV0dXJuIHRoaXMuX3NyYzt9XG5cblxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgb2Zmc2V0ID0gdGhpcy5jaGVjayhvZmZzZXQpO1xuICAgICAgICBsZXQgaXRlbSA9IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IGNlbnRlcl9pZHggPSB1bmRlZmluZWQ7XG4gICAgICAgIGxldCBpdGVtcyA9IHRoaXMuX3NyYy5nZXRfaXRlbXMoKTtcblxuICAgICAgICAvLyBiaW5hcnkgc2VhcmNoIGZvciBpbmRleFxuICAgICAgICBsZXQgW2ZvdW5kLCBpZHhdID0gZmluZF9pbmRleChvZmZzZXRbMF0sIGl0ZW1zLCBnZXRfbG93X3ZhbHVlKTtcbiAgICAgICAgaWYgKGZvdW5kKSB7XG4gICAgICAgICAgICAvLyBzZWFyY2ggb2Zmc2V0IG1hdGNoZXMgaXRlbSBsb3cgZXhhY3RseVxuICAgICAgICAgICAgLy8gY2hlY2sgdGhhdCBpdCBpcyBpbmRlZWQgY292ZXJlZCBieSBpdGVtIGludGVydmFsXG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4XVxuICAgICAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19lbmRwb2ludChpdGVtLml0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgIGNlbnRlcl9pZHggPSBpZHhcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoY2VudGVyX2lkeCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHByZXZpb3VzIGl0ZW0gY292ZXJzIG9mZnNldFxuICAgICAgICAgICAgaXRlbSA9IGl0ZW1zW2lkeC0xXTtcbiAgICAgICAgICAgIGlmIChpdGVtICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfZW5kcG9pbnQoaXRlbS5pdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY2VudGVyX2lkeCA9IGlkeC0xO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gXG4gICAgICAgIH1cblxuICAgICAgICAvKiBcbiAgICAgICAgICAgIGNlbnRlciBpcyBub24tZW1wdHkgXG4gICAgICAgICovXG4gICAgICAgIGlmIChjZW50ZXJfaWR4ICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaXRlbSA9IGl0ZW1zW2NlbnRlcl9pZHhdO1xuICAgICAgICAgICAgY29uc3QgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW0uaXR2KTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgY2VudGVyOiBbaXRlbV0sXG4gICAgICAgICAgICAgICAgaXR2OiBpdGVtLml0dixcbiAgICAgICAgICAgICAgICBsZWZ0OiBlbmRwb2ludC5mbGlwKGxvdywgXCJoaWdoXCIpLFxuICAgICAgICAgICAgICAgIHJpZ2h0OiBlbmRwb2ludC5mbGlwKGhpZ2gsIFwibG93XCIpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKiBcbiAgICAgICAgICAgIGNlbnRlciBpcyBlbXB0eSBcbiAgICAgICAgKi9cbiAgICAgICAgLy8gbGVmdCBpcyBiYXNlZCBvbiBwcmV2aW91cyBpdGVtXG4gICAgICAgIGl0ZW0gPSBpdGVtc1tpZHgtMV07XG4gICAgICAgIGxldCBsZWZ0ID0gWy1JbmZpbml0eSwgMF07XG4gICAgICAgIGlmIChpdGVtICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGVmdCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzFdO1xuICAgICAgICB9XG4gICAgICAgIC8vIHJpZ2h0IGlzIGJhc2VkIG9uIG5leHQgaXRlbVxuICAgICAgICBpdGVtID0gaXRlbXNbaWR4XTtcbiAgICAgICAgbGV0IHJpZ2h0ID0gW0luZmluaXR5LCAwXTtcbiAgICAgICAgaWYgKGl0ZW0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByaWdodCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzBdO1xuICAgICAgICB9XG4gICAgICAgIC8vIGl0diBiYXNlZCBvbiBsZWZ0IGFuZCByaWdodCAgICAgICAgXG4gICAgICAgIGxldCBsb3cgPSBlbmRwb2ludC5mbGlwKGxlZnQsIFwibG93XCIpO1xuICAgICAgICBsZXQgaGlnaCA9IGVuZHBvaW50LmZsaXAocmlnaHQsIFwiaGlnaFwiKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY2VudGVyOiBbXSwgbGVmdCwgcmlnaHQsXG4gICAgICAgICAgICBpdHY6IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaClcbiAgICAgICAgfTtcbiAgICB9XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblx0VVRJTFNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuXG4vKlxuXHRiaW5hcnkgc2VhcmNoIGZvciBmaW5kaW5nIHRoZSBjb3JyZWN0IGluc2VydGlvbiBpbmRleCBpbnRvXG5cdHRoZSBzb3J0ZWQgYXJyYXkgKGFzY2VuZGluZykgb2YgaXRlbXNcblx0XG5cdGFycmF5IGNvbnRhaW5zIG9iamVjdHMsIGFuZCB2YWx1ZSBmdW5jIHJldHJlYXZlcyBhIHZhbHVlXG5cdGZyb20gZWFjaCBvYmplY3QuXG5cblx0cmV0dXJuIFtmb3VuZCwgaW5kZXhdXG4qL1xuXG5mdW5jdGlvbiBmaW5kX2luZGV4KHRhcmdldCwgYXJyLCB2YWx1ZV9mdW5jKSB7XG5cbiAgICBmdW5jdGlvbiBkZWZhdWx0X3ZhbHVlX2Z1bmMoZWwpIHtcbiAgICAgICAgcmV0dXJuIGVsO1xuICAgIH1cbiAgICBcbiAgICBsZXQgbGVmdCA9IDA7XG5cdGxldCByaWdodCA9IGFyci5sZW5ndGggLSAxO1xuXHR2YWx1ZV9mdW5jID0gdmFsdWVfZnVuYyB8fCBkZWZhdWx0X3ZhbHVlX2Z1bmM7XG5cdHdoaWxlIChsZWZ0IDw9IHJpZ2h0KSB7XG5cdFx0Y29uc3QgbWlkID0gTWF0aC5mbG9vcigobGVmdCArIHJpZ2h0KSAvIDIpO1xuXHRcdGxldCBtaWRfdmFsdWUgPSB2YWx1ZV9mdW5jKGFyclttaWRdKTtcblx0XHRpZiAobWlkX3ZhbHVlID09PSB0YXJnZXQpIHtcblx0XHRcdHJldHVybiBbdHJ1ZSwgbWlkXTsgLy8gVGFyZ2V0IGFscmVhZHkgZXhpc3RzIGluIHRoZSBhcnJheVxuXHRcdH0gZWxzZSBpZiAobWlkX3ZhbHVlIDwgdGFyZ2V0KSB7XG5cdFx0XHQgIGxlZnQgPSBtaWQgKyAxOyAvLyBNb3ZlIHNlYXJjaCByYW5nZSB0byB0aGUgcmlnaHRcblx0XHR9IGVsc2Uge1xuXHRcdFx0ICByaWdodCA9IG1pZCAtIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSBsZWZ0XG5cdFx0fVxuXHR9XG4gIFx0cmV0dXJuIFtmYWxzZSwgbGVmdF07IC8vIFJldHVybiB0aGUgaW5kZXggd2hlcmUgdGFyZ2V0IHNob3VsZCBiZSBpbnNlcnRlZFxufVxuIiwiaW1wb3J0ICogYXMgZXZlbnRpZnkgZnJvbSBcIi4vYXBpX2V2ZW50aWZ5LmpzXCI7XG5pbXBvcnQgKiBhcyBjYWxsYmFjayBmcm9tIFwiLi9hcGlfY2FsbGJhY2suanNcIjtcbmltcG9ydCAqIGFzIHNyY3Byb3AgZnJvbSBcIi4vYXBpX3NyY3Byb3AuanNcIjtcbmltcG9ydCAqIGFzIHNlZ21lbnQgZnJvbSBcIi4vc2VnbWVudHMuanNcIjtcblxuaW1wb3J0IHsgaW50ZXJ2YWwsIGVuZHBvaW50IH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyByYW5nZSwgdG9TdGF0ZSB9IGZyb20gXCIuL3V0aWwuanNcIjtcbmltcG9ydCB7IFN0YXRlUHJvdmlkZXJCYXNlIH0gZnJvbSBcIi4vc3RhdGVwcm92aWRlcl9iYXNlcy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhTaW1wbGUgfSBmcm9tIFwiLi9uZWFyYnlpbmRleF9zaW1wbGVcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMYXllciBpcyBhYnN0cmFjdCBiYXNlIGNsYXNzIGZvciBMYXllcnNcbiAqIFxuICogTGF5ZXIgaW50ZXJmYWNlIGlzIGRlZmluZWQgYnkgKGluZGV4LCBDYWNoZUNsYXNzLCB2YWx1ZUZ1bmMpXG4gKi9cblxuZXhwb3J0IGNsYXNzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgY29uc3Qge0NhY2hlQ2xhc3M9TGF5ZXJDYWNoZX0gPSBvcHRpb25zO1xuICAgICAgICBjb25zdCB7dmFsdWVGdW5jLCBzdGF0ZUZ1bmN9ID0gb3B0aW9ucztcbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIC8vIGxheWVyIHF1ZXJ5IGFwaVxuICAgICAgICAvL2xheWVycXVlcnkuYWRkVG9JbnN0YW5jZSh0aGlzLCBDYWNoZUNsYXNzLCB7dmFsdWVGdW5jLCBzdGF0ZUZ1bmN9KTtcbiAgICAgICAgLy8gZGVmaW5lIGNoYW5nZSBldmVudFxuICAgICAgICBldmVudGlmeS5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcblxuICAgICAgICAvLyBpbmRleFxuICAgICAgICB0aGlzLl9pbmRleDtcbiAgICAgICAgLy8gY2FjaGVcbiAgICAgICAgdGhpcy5fQ2FjaGVDbGFzcyA9IENhY2hlQ2xhc3M7XG4gICAgICAgIHRoaXMuX2NhY2hlX29iamVjdDtcbiAgICAgICAgdGhpcy5fY2FjaGVfb2JqZWN0cyA9IFtdO1xuXG4gICAgICAgIC8vIHF1ZXJ5IG9wdGlvbnNcbiAgICAgICAgdGhpcy5fcXVlcnlPcHRpb25zID0ge3ZhbHVlRnVuYywgc3RhdGVGdW5jfTtcblxuICAgIH1cblxuICAgIC8vIGluZGV4XG4gICAgZ2V0IGluZGV4ICgpIHtyZXR1cm4gdGhpcy5faW5kZXh9XG4gICAgc2V0IGluZGV4IChpbmRleCkge3RoaXMuX2luZGV4ID0gaW5kZXh9XG5cbiAgICAvLyBxdWVyeU9wdGlvbnNcbiAgICBnZXQgcXVlcnlPcHRpb25zICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3F1ZXJ5T3B0aW9ucztcbiAgICB9XG5cbiAgICAvLyBjYWNoZVxuICAgIGdldCBjYWNoZSAoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jYWNoZV9vYmplY3QgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9jYWNoZV9vYmplY3QgPSBuZXcgdGhpcy5fQ2FjaGVDbGFzcyh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2FjaGVfb2JqZWN0O1xuICAgIH1cblxuICAgIGdldENhY2hlICgpIHtcbiAgICAgICAgY29uc3QgY2FjaGUgPSBuZXcgdGhpcy5fQ2FjaGVDbGFzcyh0aGlzKTtcbiAgICAgICAgdGhpcy5fY2FjaGVfb2JqZWN0cy5wdXNoKGNhY2hlKTtcbiAgICAgICAgcmV0dXJuIGNhY2hlO1xuICAgIH1cblxuICAgIGNsZWFyQ2FjaGVzKCkge1xuICAgICAgICBmb3IgKGNvbnN0IGNhY2hlIG9mIHRoaXMuX2NhY2hlX29iamVjdHMpe1xuICAgICAgICAgICAgY2FjaGUuY2xlYXIoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIHJlZ2lvbnMgKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW5kZXgucmVnaW9ucyhvcHRpb25zKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBTYW1wbGUgTGF5ZXIgYnkgdGltZWxpbmUgb2Zmc2V0IGluY3JlbWVudHNcbiAgICAgICAgcmV0dXJuIGxpc3Qgb2YgdHVwbGVzIFt2YWx1ZSwgb2Zmc2V0XVxuICAgICAgICBvcHRpb25zXG4gICAgICAgIC0gc3RhcnRcbiAgICAgICAgLSBzdG9wXG4gICAgICAgIC0gc3RlcFxuICAgICovXG4gICAgc2FtcGxlKG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtzdGFydD0tSW5maW5pdHksIHN0b3A9SW5maW5pdHksIHN0ZXA9MX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3RhcnQgPiBzdG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgKFwic3RvcCBtdXN0IGJlIGxhcmdlciB0aGFuIHN0YXJ0XCIsIHN0YXJ0LCBzdG9wKVxuICAgICAgICB9XG4gICAgICAgIHN0YXJ0ID0gW3N0YXJ0LCAwXTtcbiAgICAgICAgc3RvcCA9IFtzdG9wLCAwXTtcbiAgICAgICAgc3RhcnQgPSBlbmRwb2ludC5tYXgodGhpcy5pbmRleC5maXJzdCgpLCBzdGFydCk7XG4gICAgICAgIHN0b3AgPSBlbmRwb2ludC5taW4odGhpcy5pbmRleC5sYXN0KCksIHN0b3ApO1xuICAgICAgICBjb25zdCBjYWNoZSA9IHRoaXMuZ2V0Q2FjaGUoKTtcbiAgICAgICAgcmV0dXJuIHJhbmdlKHN0YXJ0WzBdLCBzdG9wWzBdLCBzdGVwLCB7aW5jbHVkZV9lbmQ6dHJ1ZX0pXG4gICAgICAgICAgICAubWFwKChvZmZzZXQpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gW2NhY2hlLnF1ZXJ5KG9mZnNldCkudmFsdWUsIG9mZnNldF07XG4gICAgICAgICAgICB9KTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShMYXllci5wcm90b3R5cGUpO1xuZXZlbnRpZnkuYWRkVG9Qcm90b3R5cGUoTGF5ZXIucHJvdG90eXBlKTtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUiBDQUNIRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBUaGlzIGltcGxlbWVudHMgYSBDYWNoZSB0byBiZSB1c2VkIHdpdGggTGF5ZXIgb2JqZWN0c1xuICogUXVlcnkgcmVzdWx0cyBhcmUgb2J0YWluZWQgZnJvbSB0aGUgY2FjaGUgb2JqZWN0cyBpbiB0aGVcbiAqIGxheWVyIGluZGV4IGFuZCBjYWNoZWQgb25seSBpZiB0aGV5IGRlc2NyaWJlIGEgc3RhdGljIHZhbHVlLiBcbiAqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJDYWNoZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihsYXllcikge1xuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IHN0YXRlXG4gICAgICAgIHRoaXMuX25lYXJieTtcbiAgICAgICAgLy8gY2FjaGVkIHJlc3VsdFxuICAgICAgICB0aGlzLl9zdGF0ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBxdWVyeSBjYWNoZVxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBjb25zdCBuZWVkX25lYXJieSA9IChcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICFpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5fbmVhcmJ5Lml0diwgb2Zmc2V0KVxuICAgICAgICApO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICAhbmVlZF9uZWFyYnkgJiYgXG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSAhPSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICF0aGlzLl9zdGF0ZS5keW5hbWljXG4gICAgICAgICkge1xuICAgICAgICAgICAgLy8gY2FjaGUgaGl0XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuX3N0YXRlLCBvZmZzZXR9O1xuICAgICAgICB9XG4gICAgICAgIC8vIGNhY2hlIG1pc3NcbiAgICAgICAgaWYgKG5lZWRfbmVhcmJ5KSB7XG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPSB0aGlzLl9sYXllci5pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBwZXJmb3JtIHF1ZXJpZXNcbiAgICAgICAgY29uc3Qgc3RhdGVzID0gdGhpcy5fbmVhcmJ5LmNlbnRlci5tYXAoKGNhY2hlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gY2FjaGUucXVlcnkob2Zmc2V0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gdG9TdGF0ZSh0aGlzLl9uZWFyYnkuY2VudGVyLCBzdGF0ZXMsIG9mZnNldCwgdGhpcy5fbGF5ZXIucXVlcnlPcHRpb25zKVxuICAgICAgICAvLyBjYWNoZSBzdGF0ZSBvbmx5IGlmIG5vdCBkeW5hbWljXG4gICAgICAgIHRoaXMuX3N0YXRlID0gKHN0YXRlLmR5bmFtaWMpID8gdW5kZWZpbmVkIDogc3RhdGU7XG4gICAgICAgIHJldHVybiBzdGF0ZSAgICBcbiAgICB9XG5cbiAgICBjbGVhcigpIHtcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IHVuZGVmaW5lZDtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgSU5QVVQgTEFZRVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMYXllciB3aXRoIGEgU3RhdGVQcm92aWRlciBhcyBzcmNcbiAqL1xuXG5leHBvcnQgY2xhc3MgSW5wdXRMYXllciBleHRlbmRzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgY29uc3Qge3NyYywgdmFsdWVGdW5jLCBzdGF0ZUZ1bmN9ID0gb3B0aW9ucztcbiAgICAgICAgc3VwZXIoe0NhY2hlQ2xhc3M6SW5wdXRMYXllckNhY2hlLCB2YWx1ZUZ1bmMsIHN0YXRlRnVuY30pO1xuICAgICAgICAvLyBzZXR1cCBzcmMgcHJvcHRlcnR5XG4gICAgICAgIHNyY3Byb3AuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5zcmNwcm9wX3JlZ2lzdGVyKFwic3JjXCIpO1xuICAgICAgICAvLyBpbml0aWFsaXplXG4gICAgICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIH1cblxuICAgIHNyY3Byb3BfY2hlY2socHJvcE5hbWUsIHNyYykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzcmNcIikge1xuICAgICAgICAgICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgU3RhdGVQcm92aWRlckJhc2UpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcInNyY1wiIG11c3QgYmUgc3RhdGUgcHJvdmlkZXIgJHtzcmN9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3JjOyAgICBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNyY3Byb3Bfb25jaGFuZ2UocHJvcE5hbWUsIGVBcmcpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmluZGV4ID09IHVuZGVmaW5lZCB8fCBlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXggPSBuZXcgTmVhcmJ5SW5kZXhTaW1wbGUodGhpcy5zcmMpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgdGhpcy5jbGVhckNhY2hlcygpO1xuICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiKTtcbiAgICAgICAgfSAgICAgICAgXG4gICAgfVxufVxuc3JjcHJvcC5hZGRUb1Byb3RvdHlwZShJbnB1dExheWVyLnByb3RvdHlwZSk7XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgSU5QVVQgTEFZRVIgQ0FDSEVcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBMYXllciB3aXRoIGEgU3RhdGVQcm92aWRlciB1c2VzIGEgc3BlY2lmaWMgY2FjaGUgaW1wbGVtZW50YXRpb24uICAgIFxuXG4gICAgVGhlIGNhY2hlIHdpbGwgaW5zdGFudGlhdGUgc2VnbWVudHMgY29ycmVzcG9uZGluZyB0b1xuICAgIGl0ZW1zIGluIHRoZSBpbmRleC4gXG4qL1xuXG5leHBvcnQgY2xhc3MgSW5wdXRMYXllckNhY2hlIHtcbiAgICBjb25zdHJ1Y3RvcihsYXllcikge1xuICAgICAgICAvLyBsYXllclxuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IG9iamVjdFxuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhY2hlZCBzZWdtZW50XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IGNhY2hlX21pc3MgPSAoXG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAhaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX25lYXJieS5pdHYsIG9mZnNldClcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKGNhY2hlX21pc3MpIHtcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICAgICAgbGV0IHtpdHYsIGNlbnRlcn0gPSB0aGlzLl9uZWFyYnk7XG4gICAgICAgICAgICB0aGlzLl9zZWdtZW50cyA9IGNlbnRlci5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbG9hZF9zZWdtZW50KGl0diwgaXRlbSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBxdWVyeSBzZWdtZW50c1xuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9zZWdtZW50cy5tYXAoKHNlZykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHNlZy5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRvU3RhdGUodGhpcy5fc2VnbWVudHMsIHN0YXRlcywgb2Zmc2V0LCB0aGlzLl9sYXllci5xdWVyeU9wdGlvbnMpXG4gICAgfVxuXG4gICAgY2xlYXIoKSB7XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICB9XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0FEIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gbG9hZF9zZWdtZW50KGl0diwgaXRlbSkge1xuICAgIGxldCB7dHlwZT1cInN0YXRpY1wiLCBkYXRhfSA9IGl0ZW07XG4gICAgaWYgKHR5cGUgPT0gXCJzdGF0aWNcIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuU3RhdGljU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuVHJhbnNpdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJpbnRlcnBvbGF0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LkludGVycG9sYXRpb25TZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwibW90aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50Lk1vdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhcInVucmVjb2duaXplZCBzZWdtZW50IHR5cGVcIiwgdHlwZSk7XG4gICAgfVxufVxuXG5cblxuIiwiaW1wb3J0IHsgZW5kcG9pbnQsIGludGVydmFsIH0gZnJvbSBcIi4uL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4uL25lYXJieWluZGV4LmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcnMuanNcIlxuaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi4vYXBpX3NyY3Byb3AuanNcIjtcblxuXG4vKipcbiAqIENvbnZlbmllbmNlIG1lcmdlIG9wdGlvbnNcbiAqL1xuY29uc3QgbWVyZ2Vfb3B0aW9ucyA9IHtcbiAgICBzdW06IHtcbiAgICAgICAgdmFsdWVGdW5jOiBmdW5jdGlvbiAoaW5mbykge1xuICAgICAgICAgICAgLy8gcmV0dXJucyB0aGUgc3VtIG9mIHZhbHVlcyBvZiBhY3RpdmUgbGF5ZXJzXG4gICAgICAgICAgICByZXR1cm4gaW5mby5zdGF0ZXNcbiAgICAgICAgICAgICAgICAubWFwKHN0YXRlID0+IHN0YXRlLnZhbHVlKSBcbiAgICAgICAgICAgICAgICAucmVkdWNlKChhY2MsIHZhbHVlKSA9PiBhY2MgKyB2YWx1ZSwgMCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHN0YWNrOiB7XG4gICAgICAgIHN0YXRlRnVuYzogZnVuY3Rpb24gKGluZm8pIHtcbiAgICAgICAgICAgIC8vIHJldHVybnMgdmFsdWVzIGZyb20gZmlyc3QgYWN0aXZlIGxheWVyXG4gICAgICAgICAgICByZXR1cm4gey4uLmluZm8uc3RhdGVzWzBdfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBhcnJheToge1xuICAgICAgICB2YWx1ZUZ1bmM6IGZ1bmN0aW9uIChpbmZvKSB7XG4gICAgICAgICAgICAvLyByZXR1cm5zIGFuIGFycmF5IHdpdGggdmFsdWVzIGZyb20gYWN0aXZlIGxheWVyc1xuICAgICAgICAgICAgcmV0dXJuIGluZm8uc3RhdGVzLm1hcChzdGF0ZSA9PiBzdGF0ZS52YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqXG4gKiBcbiAqIFRoaXMgaW1wbGVtZW50cyBhIG1lcmdlIG9wZXJhdGlvbiBmb3IgbGF5ZXJzLlxuICogTGlzdCBvZiBzb3VyY2VzIGlzIGltbXV0YWJsZS5cbiAqIFxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZSAoc291cmNlcywgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHt0eXBlPVwiXCJ9ID0gb3B0aW9ucztcblxuICAgIGlmICh0eXBlIGluIG1lcmdlX29wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNZXJnZUxheWVyKHNvdXJjZXMsIG1lcmdlX29wdGlvbnNbdHlwZV0pXG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG5ldyBNZXJnZUxheWVyKHNvdXJjZXMsIG9wdGlvbnMpO1xuICAgIH1cbn1cblxuXG5jbGFzcyBNZXJnZUxheWVyIGV4dGVuZHMgTGF5ZXIge1xuXG4gICAgY29uc3RydWN0b3Ioc291cmNlcywgb3B0aW9ucykge1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcblxuICAgICAgICAvLyBzZXR1cCBzb3VyY2VzIHByb3BlcnR5XG4gICAgICAgIHNyY3Byb3AuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5zcmNwcm9wX3JlZ2lzdGVyKFwic291cmNlc1wiLCB7bXV0YWJsZTpmYWxzZX0pO1xuICAgICAgICB0aGlzLnNvdXJjZXMgPSBzb3VyY2VzO1xuICAgIH1cblxuICAgIHNyY3Byb3BfY2hlY2socHJvcE5hbWUsIHNvdXJjZXMpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic291cmNlc1wiKSB7XG4gICAgICAgICAgICAvLyBjaGVjayB0aGF0IHNvdXJjZXMgaXMgYXJyYXkgb2YgbGF5ZXJzXG4gICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoc291cmNlcykpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNvdXJjZXMgbXVzdCBiZSBhcnJheSAke3NvdXJjZXN9YClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGFsbF9sYXllcnMgPSBzb3VyY2VzLm1hcCgoZSkgPT4gZSBpbnN0YW5jZW9mIExheWVyKS5ldmVyeShlID0+IGUpO1xuICAgICAgICAgICAgaWYgKCFhbGxfbGF5ZXJzKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzb3VyY2VzIG11c3QgYWxsIGJlIGxheWVycyAke3NvdXJjZXN9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNvdXJjZXM7XG4gICAgfVxuXG4gICAgc3JjcHJvcF9vbmNoYW5nZShwcm9wTmFtZSwgZUFyZykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzb3VyY2VzXCIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmluZGV4ID09IHVuZGVmaW5lZCB8fCBlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXggPSBuZXcgTWVyZ2VJbmRleCh0aGlzLnNvdXJjZXMpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgdGhpcy5jbGVhckNhY2hlcygpO1xuICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbnNyY3Byb3AuYWRkVG9Qcm90b3R5cGUoTWVyZ2VMYXllci5wcm90b3R5cGUpO1xuXG5cbmNsYXNzIExvZ2ljYWxNZXJnZUxheWVyIGV4dGVuZHMgTWVyZ2VMYXllciB7XG4gICAgY29uc3RydWN0b3Ioc291cmNlcywgb3B0aW9ucykge1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcblxuICAgICAgICAvLyBpZiBsYXllcnMgYXJlbnQgYm9vbGVhbiAtIG1ha2UgdGhlbVxuICAgICAgICAvLyBzdXBwb3J0IGFuIGV4cHJlc3Npb25cbiAgICAgICAgLy8gbm90KFwiYVwiKS5hbmQoXCJiXCIsIHhvcihcImNcIiwgXCJkXCIpKVxuXG5cbiAgICB9XG5cbn1cblxuXG4vKipcbiAqIE1lcmdpbmcgaW5kZXhlcyBmcm9tIG11bHRpcGxlIHNvdXJjZXMgaW50byBhIHNpbmdsZSBpbmRleC5cbiAqIFxuICogQSBzb3VyY2UgaXMgYW4gb2JqZWN0IHdpdGggYW4gaW5kZXguXG4gKiAtIGxheWVyIChjdXJzb3IpXG4gKiBcbiAqIFRoZSBtZXJnZWQgaW5kZXggZ2l2ZXMgYSB0ZW1wb3JhbCBzdHJ1Y3R1cmUgZm9yIHRoZVxuICogY29sbGVjdGlvbiBvZiBzb3VyY2VzLCBjb21wdXRpbmcgYSBsaXN0IG9mXG4gKiBzb3VyY2VzIHdoaWNoIGFyZSBkZWZpbmVkIGF0IGEgZ2l2ZW4gb2Zmc2V0XG4gKiBcbiAqIG5lYXJieShvZmZzZXQpLmNlbnRlciBpcyBhIGxpc3Qgb2YgaXRlbXNcbiAqIFt7aXR2LCBzcmN9XVxuICogXG4gKiBJbXBsZW1lbnRhaW9uIGlzIHN0YXRlbGVzcy5cbiAqL1xuXG5mdW5jdGlvbiBjbXBfYXNjZW5kaW5nKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludC5jbXAocDEsIHAyKVxufVxuXG5mdW5jdGlvbiBjbXBfZGVzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAyLCBwMSlcbn1cblxuZXhwb3J0IGNsYXNzIE1lcmdlSW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Ioc291cmNlcykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9zb3VyY2VzID0gc291cmNlcztcbiAgICAgICAgdGhpcy5fY2FjaGVzID0gbmV3IE1hcChzb3VyY2VzLm1hcCgoc3JjKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3NyYywgc3JjLmdldENhY2hlKCldO1xuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBvZmZzZXQgPSB0aGlzLmNoZWNrKG9mZnNldCk7XG4gICAgICAgIC8vIGFjY3VtdWxhdGUgbmVhcmJ5IGZyb20gYWxsIHNvdXJjZXNcbiAgICAgICAgY29uc3QgcHJldl9saXN0ID0gW10sIG5leHRfbGlzdCA9IFtdO1xuICAgICAgICBjb25zdCBjZW50ZXJfbGlzdCA9IFtdO1xuICAgICAgICBjb25zdCBjZW50ZXJfaGlnaF9saXN0ID0gW107XG4gICAgICAgIGNvbnN0IGNlbnRlcl9sb3dfbGlzdCA9IFtdXG4gICAgICAgIGZvciAobGV0IHNyYyBvZiB0aGlzLl9zb3VyY2VzKSB7XG4gICAgICAgICAgICBsZXQgbmVhcmJ5ID0gc3JjLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICAgICAgbGV0IHByZXZfcmVnaW9uID0gc3JjLmluZGV4LnByZXZfcmVnaW9uKG5lYXJieSk7XG4gICAgICAgICAgICBsZXQgbmV4dF9yZWdpb24gPSBzcmMuaW5kZXgubmV4dF9yZWdpb24obmVhcmJ5KTtcbiAgICAgICAgICAgIGlmIChwcmV2X3JlZ2lvbiAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBwcmV2X2xpc3QucHVzaChlbmRwb2ludC5mcm9tX2ludGVydmFsKHByZXZfcmVnaW9uLml0dilbMV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5leHRfcmVnaW9uICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIG5leHRfbGlzdC5wdXNoKGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmV4dF9yZWdpb24uaXR2KVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobmVhcmJ5LmNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY2VudGVyX2xpc3QucHVzaCh0aGlzLl9jYWNoZXMuZ2V0KHNyYykpO1xuICAgICAgICAgICAgICAgIGxldCBbbG93LCBoaWdoXSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmVhcmJ5Lml0dik7XG4gICAgICAgICAgICAgICAgY2VudGVyX2hpZ2hfbGlzdC5wdXNoKGhpZ2gpO1xuICAgICAgICAgICAgICAgIGNlbnRlcl9sb3dfbGlzdC5wdXNoKGxvdyk7ICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBmaW5kIGNsb3Nlc3QgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0IChub3QgaW4gY2VudGVyKVxuICAgICAgICBuZXh0X2xpc3Quc29ydChjbXBfYXNjZW5kaW5nKTtcbiAgICAgICAgY29uc3QgbWluX25leHRfbG93ID0gbmV4dF9saXN0WzBdIHx8IFtJbmZpbml0eSwgMF07XG5cbiAgICAgICAgLy8gZmluZCBjbG9zZXN0IGVuZHBvaW50IHRvIHRoZSBsZWZ0IChub3QgaW4gY2VudGVyKVxuICAgICAgICBwcmV2X2xpc3Quc29ydChjbXBfZGVzY2VuZGluZyk7XG4gICAgICAgIGNvbnN0IG1heF9wcmV2X2hpZ2ggPSBwcmV2X2xpc3RbMF0gfHwgWy1JbmZpbml0eSwgMF07XG5cbiAgICAgICAgLy8gbmVhcmJ5XG4gICAgICAgIGxldCBsb3csIGhpZ2g7IFxuICAgICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgICAgICBjZW50ZXI6IGNlbnRlcl9saXN0LCBcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjZW50ZXJfbGlzdC5sZW5ndGggPT0gMCkge1xuXG4gICAgICAgICAgICAvLyBlbXB0eSBjZW50ZXJcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IG1pbl9uZXh0X2xvdzsgIFxuICAgICAgICAgICAgLy9yZXN1bHQubmV4dCA9IG1pbl9uZXh0X2xvdztcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gbWF4X3ByZXZfaGlnaDtcbiAgICAgICAgICAgIC8vcmVzdWx0LnByZXYgPSBtYXhfcHJldl9oaWdoO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBub24tZW1wdHkgY2VudGVyXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIGNlbnRlciBoaWdoXG4gICAgICAgICAgICBjZW50ZXJfaGlnaF9saXN0LnNvcnQoY21wX2FzY2VuZGluZyk7XG4gICAgICAgICAgICBsZXQgbWluX2NlbnRlcl9oaWdoID0gY2VudGVyX2hpZ2hfbGlzdFswXTtcbiAgICAgICAgICAgIGxldCBtYXhfY2VudGVyX2hpZ2ggPSBjZW50ZXJfaGlnaF9saXN0LnNsaWNlKC0xKVswXTtcbiAgICAgICAgICAgIGxldCBtdWx0aXBsZV9jZW50ZXJfaGlnaCA9ICFlbmRwb2ludC5lcShtaW5fY2VudGVyX2hpZ2gsIG1heF9jZW50ZXJfaGlnaClcblxuICAgICAgICAgICAgLy8gY2VudGVyIGxvd1xuICAgICAgICAgICAgY2VudGVyX2xvd19saXN0LnNvcnQoY21wX2Rlc2NlbmRpbmcpO1xuICAgICAgICAgICAgbGV0IG1heF9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0WzBdO1xuICAgICAgICAgICAgbGV0IG1pbl9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0LnNsaWNlKC0xKVswXTtcbiAgICAgICAgICAgIGxldCBtdWx0aXBsZV9jZW50ZXJfbG93ID0gIWVuZHBvaW50LmVxKG1heF9jZW50ZXJfbG93LCBtaW5fY2VudGVyX2xvdylcblxuICAgICAgICAgICAgLy8gbmV4dC9yaWdodFxuICAgICAgICAgICAgaWYgKGVuZHBvaW50LmxlKG1pbl9uZXh0X2xvdywgbWluX2NlbnRlcl9oaWdoKSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IG1pbl9uZXh0X2xvdztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gZW5kcG9pbnQuZmxpcChtaW5fY2VudGVyX2hpZ2gsIFwibG93XCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQubmV4dCA9IChtdWx0aXBsZV9jZW50ZXJfaGlnaCkgPyByZXN1bHQucmlnaHQgOiBtaW5fbmV4dF9sb3c7XG5cbiAgICAgICAgICAgIC8vIHByZXYvbGVmdFxuICAgICAgICAgICAgaWYgKGVuZHBvaW50LmdlKG1heF9wcmV2X2hpZ2gsIG1heF9jZW50ZXJfbG93KSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gbWF4X3ByZXZfaGlnaDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSBlbmRwb2ludC5mbGlwKG1heF9jZW50ZXJfbG93LCBcImhpZ2hcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQucHJldiA9IChtdWx0aXBsZV9jZW50ZXJfbG93KSA/IHJlc3VsdC5sZWZ0IDogbWF4X3ByZXZfaGlnaDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW50ZXJ2YWwgZnJvbSBsZWZ0L3JpZ2h0XG4gICAgICAgIGxvdyA9IGVuZHBvaW50LmZsaXAocmVzdWx0LmxlZnQsIFwibG93XCIpO1xuICAgICAgICBoaWdoID0gZW5kcG9pbnQuZmxpcChyZXN1bHQucmlnaHQsIFwiaGlnaFwiKTtcbiAgICAgICAgcmVzdWx0Lml0diA9IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59O1xuXG4iLCJpbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi4vbmVhcmJ5aW5kZXguanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVycy5qc1wiXG5pbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuLi9hcGlfc3JjcHJvcC5qc1wiO1xuXG5mdW5jdGlvbiBzaGlmdGVkKHAsIG9mZnNldCkge1xuICAgIGlmIChwID09IHVuZGVmaW5lZCB8fCAhaXNGaW5pdGUocCkpIHtcbiAgICAgICAgLy8gcCAtIG5vIHNrZXdcbiAgICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBwID09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgLy8gcCBpcyBudW1iZXIgLSBza2V3XG4gICAgICAgIHJldHVybiBwICsgb2Zmc2V0O1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwKSAmJiBwLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgLy8gcCBpcyBlbmRwb2ludCAtIHNrZXcgdmFsdWVcbiAgICAgICAgbGV0IFt2YWwsIHNpZ25dID0gcDtcbiAgICAgICAgcmV0dXJuIFt2YWwgKyBvZmZzZXQsIHNpZ25dO1xuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU0hJRlQgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuY2xhc3MgU2hpZnRJbmRleCBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvciAobGF5ZXIsIHNrZXcpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgdGhpcy5fc2tldyA9IHNrZXc7XG4gICAgICAgIHRoaXMuX2NhY2hlID0gbGF5ZXIuZ2V0Q2FjaGUoKTtcblxuICAgICAgICAvLyBza2V3aW5nIGNhY2hlIG9iamVjdFxuICAgICAgICB0aGlzLl9zaGlmdGVkX2NhY2hlID0ge1xuICAgICAgICAgICAgcXVlcnk6IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICAgICAgICAgICAgICAvLyBza2V3IHF1ZXJ5IChuZWdhdGl2ZSkgLSBvdmVycmlkZSByZXN1bHQgb2Zmc2V0XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsuLi50aGlzLl9jYWNoZS5xdWVyeShzaGlmdGVkKG9mZnNldCwgLXRoaXMuX3NrZXcpKSwgb2Zmc2V0fTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIHNrZXdpbmcgaW5kZXgubmVhcmJ5XG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICAvLyBza2V3IHF1ZXJ5IChuZWdhdGl2ZSlcbiAgICAgICAgY29uc3QgbmVhcmJ5ID0gdGhpcy5fbGF5ZXIuaW5kZXgubmVhcmJ5KHNoaWZ0ZWQob2Zmc2V0LCAtdGhpcy5fc2tldykpO1xuICAgICAgICAvLyBza2V3IHJlc3VsdCAocG9zaXRpdmUpIFxuICAgICAgICBjb25zdCBpdHYgPSBuZWFyYnkuaXR2LnNsaWNlKCk7XG4gICAgICAgIGl0dlswXSA9IHNoaWZ0ZWQobmVhcmJ5Lml0dlswXSwgdGhpcy5fc2tldyk7XG4gICAgICAgIGl0dlsxXSA9IHNoaWZ0ZWQobmVhcmJ5Lml0dlsxXSwgdGhpcy5fc2tldylcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGl0dixcbiAgICAgICAgICAgIGxlZnQ6IHNoaWZ0ZWQobmVhcmJ5LmxlZnQsIHRoaXMuX3NrZXcpLFxuICAgICAgICAgICAgcmlnaHQ6IHNoaWZ0ZWQobmVhcmJ5LnJpZ2h0LCB0aGlzLl9za2V3KSxcbiAgICAgICAgICAgIGNlbnRlcjogbmVhcmJ5LmNlbnRlci5tYXAoKCkgPT4gdGhpcy5fc2hpZnRlZF9jYWNoZSlcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU0hJRlQgTEFZRVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuXG5jbGFzcyBTaGlmdExheWVyIGV4dGVuZHMgTGF5ZXIge1xuXG4gICAgY29uc3RydWN0b3IobGF5ZXIsIHNrZXcsIG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICAgIHRoaXMuX3NrZXcgPSBza2V3O1xuICAgICAgICAvLyBzZXR1cCBzcmMgcHJvcHRlcnR5XG4gICAgICAgIHNyY3Byb3AuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5zcmNwcm9wX3JlZ2lzdGVyKFwic3JjXCIpO1xuICAgICAgICB0aGlzLnNyYyA9IGxheWVyO1xuICAgIH1cblxuICAgIHNyY3Byb3BfY2hlY2socHJvcE5hbWUsIHNyYykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzcmNcIikge1xuICAgICAgICAgICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgTGF5ZXIpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcInNyY1wiIG11c3QgYmUgTGF5ZXIgJHtzcmN9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3JjOyAgICBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNyY3Byb3Bfb25jaGFuZ2UocHJvcE5hbWUsIGVBcmcpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmluZGV4ID09IHVuZGVmaW5lZCB8fCBlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXggPSBuZXcgU2hpZnRJbmRleCh0aGlzLnNyYywgdGhpcy5fc2tldylcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICB0aGlzLmNsZWFyQ2FjaGVzKCk7XG4gICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIpOyAgICBcbiAgICAgICAgfVxuICAgIH1cbn1cbnNyY3Byb3AuYWRkVG9Qcm90b3R5cGUoU2hpZnRMYXllci5wcm90b3R5cGUpO1xuXG4vKipcbiAqIFNrZXdpbmcgYSBMYXllciBieSBhbiBvZmZzZXRcbiAqIFxuICogYSBwb3NpdGl2ZSB2YWx1ZSBmb3Igb2Zmc2V0IG1lYW5zIHRoYXRcbiAqIHRoZSBsYXllciBpcyBzaGlmdGVkIHRvIHRoZSByaWdodCBvbiB0aGUgdGltZWxpbmVcbiAqIFxuICogXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHNoaWZ0IChsYXllciwgb2Zmc2V0KSB7XG4gICAgcmV0dXJuIG5ldyBTaGlmdExheWVyKGxheWVyLCBvZmZzZXQpO1xufVxuIiwiaW1wb3J0ICogYXMgY2FsbGJhY2sgZnJvbSBcIi4vYXBpX2NhbGxiYWNrLmpzXCI7XG5pbXBvcnQgeyBDTE9DSyB9IGZyb20gXCIuL3V0aWwuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ0xPQ0sgUFJPVklERVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBCYXNlIGNsYXNzIGZvciBDbG9ja1Byb3ZpZGVyc1xuICogXG4gKiBDbG9jayBQcm92aWRlcnMgaW1wbGVtZW50IHRoZSBjYWxsYmFja1xuICogaW50ZXJmYWNlIHRvIGJlIGNvbXBhdGlibGUgd2l0aCBvdGhlciBzdGF0ZVxuICogcHJvdmlkZXJzLCBldmVuIHRob3VnaCB0aGV5IGFyZSBub3QgcmVxdWlyZWQgdG9cbiAqIHByb3ZpZGUgYW55IGNhbGxiYWNrcyBhZnRlciBjbG9jayBhZGp1c3RtZW50c1xuICovXG5cbmV4cG9ydCBjbGFzcyBDbG9ja1Byb3ZpZGVyQmFzZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuICAgIG5vdyAoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShDbG9ja1Byb3ZpZGVyQmFzZS5wcm90b3R5cGUpO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTE9DQUwgQ0xPQ0sgUFJPVklERVJcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmNsYXNzIExvY2FsQ2xvY2tQcm92aWRlciBleHRlbmRzIENsb2NrUHJvdmlkZXJCYXNlIHtcbiAgICBub3cgKCkge1xuICAgICAgICByZXR1cm4gQ0xPQ0subm93KCk7XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgbG9jYWxDbG9ja1Byb3ZpZGVyID0gbmV3IExvY2FsQ2xvY2tQcm92aWRlcigpO1xuIiwiXG5pbXBvcnQgeyBTdGF0ZVByb3ZpZGVyQmFzZSB9IGZyb20gXCIuL3N0YXRlcHJvdmlkZXJfYmFzZXNcIjtcbmNvbnN0IE1FVEhPRFMgPSB7YXNzaWduLCBtb3ZlLCB0cmFuc2l0aW9uLCBpbnRlcnBvbGF0ZX07XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGNtZCAodGFyZ2V0KSB7XG4gICAgaWYgKCEodGFyZ2V0IGluc3RhbmNlb2YgU3RhdGVQcm92aWRlckJhc2UpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgdGFyZ2V0LnNyYyBtdXN0IGJlIHN0YXRlcHJvdmlkZXIgJHt0YXJnZXR9YCk7XG4gICAgfVxuICAgIGxldCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoTUVUSE9EUylcbiAgICAgICAgLm1hcCgoW25hbWUsIG1ldGhvZF0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiguLi5hcmdzKSB7IFxuICAgICAgICAgICAgICAgICAgICBsZXQgaXRlbXMgPSBtZXRob2QuY2FsbCh0aGlzLCAuLi5hcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldC51cGRhdGUoaXRlbXMpOyAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcbiAgICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKGVudHJpZXMpO1xufVxuXG5mdW5jdGlvbiBhc3NpZ24odmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgaXRlbSA9IHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHZhbHVlICAgICAgICAgICAgICAgICBcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW2l0ZW1dO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gbW92ZSh2ZWN0b3IpIHtcbiAgICBsZXQgaXRlbSA9IHtcbiAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgIHR5cGU6IFwibW90aW9uXCIsXG4gICAgICAgIGRhdGE6IHZlY3RvciAgXG4gICAgfVxuICAgIHJldHVybiBbaXRlbV07XG59XG5cbmZ1bmN0aW9uIHRyYW5zaXRpb24odjAsIHYxLCB0MCwgdDEsIGVhc2luZykge1xuICAgIGxldCBpdGVtcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYwXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJ0cmFuc2l0aW9uXCIsXG4gICAgICAgICAgICBkYXRhOiB7djAsIHYxLCB0MCwgdDEsIGVhc2luZ31cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDEsIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MVxuICAgICAgICB9XG4gICAgXVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUodHVwbGVzKSB7XG4gICAgbGV0IFt2MCwgdDBdID0gdHVwbGVzWzBdO1xuICAgIGxldCBbdjEsIHQxXSA9IHR1cGxlc1t0dXBsZXMubGVuZ3RoLTFdO1xuXG4gICAgbGV0IGl0ZW1zID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIHQwLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdjBcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDAsIHQxLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcImludGVycG9sYXRpb25cIixcbiAgICAgICAgICAgIGRhdGE6IHR1cGxlc1xuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYxXG4gICAgICAgIH1cbiAgICBdICAgIFxuICAgIHJldHVybiBpdGVtcztcbn1cblxuXG5cbiIsImltcG9ydCB7ZGl2bW9kfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5cbi8qXG4gICAgVGltZW91dCBNb25pdG9yXG5cbiAgICBUaW1lb3V0IE1vbml0b3IgaXMgc2ltaWxhciB0byBzZXRJbnRlcnZhbCwgaW4gdGhlIHNlbnNlIHRoYXQgXG4gICAgaXQgYWxsb3dzIGNhbGxiYWNrcyB0byBiZSBmaXJlZCBwZXJpb2RpY2FsbHkgXG4gICAgd2l0aCBhIGdpdmVuIGRlbGF5IChpbiBtaWxsaXMpLiAgXG4gICAgXG4gICAgVGltZW91dCBNb25pdG9yIGlzIG1hZGUgdG8gc2FtcGxlIHRoZSBzdGF0ZSBcbiAgICBvZiBhIGR5bmFtaWMgb2JqZWN0LCBwZXJpb2RpY2FsbHkuIEZvciB0aGlzIHJlYXNvbiwgZWFjaCBjYWxsYmFjayBpcyBcbiAgICBib3VuZCB0byBhIG1vbml0b3JlZCBvYmplY3QsIHdoaWNoIHdlIGhlcmUgY2FsbCBhIHZhcmlhYmxlLiBcbiAgICBPbiBlYWNoIGludm9jYXRpb24sIGEgY2FsbGJhY2sgd2lsbCBwcm92aWRlIGEgZnJlc2hseSBzYW1wbGVkIFxuICAgIHZhbHVlIGZyb20gdGhlIHZhcmlhYmxlLlxuXG4gICAgVGhpcyB2YWx1ZSBpcyBhc3N1bWVkIHRvIGJlIGF2YWlsYWJsZSBieSBxdWVyeWluZyB0aGUgdmFyaWFibGUuIFxuXG4gICAgICAgIHYucXVlcnkoKSAtPiB7dmFsdWUsIGR5bmFtaWMsIG9mZnNldCwgdHN9XG5cbiAgICBJbiBhZGRpdGlvbiwgdGhlIHZhcmlhYmxlIG9iamVjdCBtYXkgc3dpdGNoIGJhY2sgYW5kIFxuICAgIGZvcnRoIGJldHdlZW4gZHluYW1pYyBhbmQgc3RhdGljIGJlaGF2aW9yLiBUaGUgVGltZW91dCBNb25pdG9yXG4gICAgdHVybnMgcG9sbGluZyBvZmYgd2hlbiB0aGUgdmFyaWFibGUgaXMgbm8gbG9uZ2VyIGR5bmFtaWMsIFxuICAgIGFuZCByZXN1bWVzIHBvbGxpbmcgd2hlbiB0aGUgb2JqZWN0IGJlY29tZXMgZHluYW1pYy5cblxuICAgIFN0YXRlIGNoYW5nZXMgYXJlIGV4cGVjdGVkIHRvIGJlIHNpZ25hbGxlZCB0aHJvdWdoIGEgPGNoYW5nZT4gZXZlbnQuXG5cbiAgICAgICAgc3ViID0gdi5vbihcImNoYW5nZVwiLCBjYWxsYmFjaylcbiAgICAgICAgdi5vZmYoc3ViKVxuXG4gICAgQ2FsbGJhY2tzIGFyZSBpbnZva2VkIG9uIGV2ZXJ5IDxjaGFuZ2U+IGV2ZW50LCBhcyB3ZWxsXG4gICAgYXMgcGVyaW9kaWNhbGx5IHdoZW4gdGhlIG9iamVjdCBpcyBpbiA8ZHluYW1pYz4gc3RhdGUuXG5cbiAgICAgICAgY2FsbGJhY2soe3ZhbHVlLCBkeW5hbWljLCBvZmZzZXQsIHRzfSlcblxuICAgIEZ1cnRoZXJtb3JlLCBpbiBvcmRlciB0byBzdXBwb3J0IGNvbnNpc3RlbnQgcmVuZGVyaW5nIG9mXG4gICAgc3RhdGUgY2hhbmdlcyBmcm9tIG1hbnkgZHluYW1pYyB2YXJpYWJsZXMsIGl0IGlzIGltcG9ydGFudCB0aGF0XG4gICAgY2FsbGJhY2tzIGFyZSBpbnZva2VkIGF0IHRoZSBzYW1lIHRpbWUgYXMgbXVjaCBhcyBwb3NzaWJsZSwgc29cbiAgICB0aGF0IGNoYW5nZXMgdGhhdCBvY2N1ciBuZWFyIGluIHRpbWUgY2FuIGJlIHBhcnQgb2YgdGhlIHNhbWVcbiAgICBzY3JlZW4gcmVmcmVzaC4gXG5cbiAgICBGb3IgdGhpcyByZWFzb24sIHRoZSBUaW1lb3V0TW9uaXRvciBncm91cHMgY2FsbGJhY2tzIGluIHRpbWVcbiAgICBhbmQgaW52b2tlcyBjYWxsYmFja3MgYXQgYXQgZml4ZWQgbWF4aW11bSByYXRlICgyMEh6LzUwbXMpLlxuICAgIFRoaXMgaW1wbGllcyB0aGF0IHBvbGxpbmcgY2FsbGJhY2tzIHdpbGwgZmFsbCBvbiBhIHNoYXJlZCBcbiAgICBwb2xsaW5nIGZyZXF1ZW5jeS5cblxuICAgIEF0IHRoZSBzYW1lIHRpbWUsIGNhbGxiYWNrcyBtYXkgaGF2ZSBpbmRpdmlkdWFsIGZyZXF1ZW5jaWVzIHRoYXRcbiAgICBhcmUgbXVjaCBsb3dlciByYXRlIHRoYW4gdGhlIG1heGltdW0gcmF0ZS4gVGhlIGltcGxlbWVudGF0aW9uXG4gICAgZG9lcyBub3QgcmVseSBvbiBhIGZpeGVkIDUwbXMgdGltZW91dCBmcmVxdWVuY3ksIGJ1dCBpcyB0aW1lb3V0IGJhc2VkLFxuICAgIHRodXMgdGhlcmUgaXMgbm8gcHJvY2Vzc2luZyBvciB0aW1lb3V0IGJldHdlZW4gY2FsbGJhY2tzLCBldmVuXG4gICAgaWYgYWxsIGNhbGxiYWNrcyBoYXZlIGxvdyByYXRlcy5cblxuICAgIEl0IGlzIHNhZmUgdG8gZGVmaW5lIG11bHRpcGxlIGNhbGxhYmFja3MgZm9yIGEgc2luZ2xlIHZhcmlhYmxlLCBlYWNoXG4gICAgY2FsbGJhY2sgd2l0aCBhIGRpZmZlcmVudCBwb2xsaW5nIGZyZXF1ZW5jeS5cblxuICAgIG9wdGlvbnNcbiAgICAgICAgPHJhdGU+IC0gZGVmYXVsdCA1MDogc3BlY2lmeSBtaW5pbXVtIGZyZXF1ZW5jeSBpbiBtc1xuXG4qL1xuXG5cbmNvbnN0IFJBVEVfTVMgPSA1MFxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBUSU1FT1VUIE1PTklUT1JcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBCYXNlIGNsYXNzIGZvciBUaW1lb3V0IE1vbml0b3IgYW5kIEZyYW1lcmF0ZSBNb25pdG9yXG4qL1xuXG5jbGFzcyBUaW1lb3V0TW9uaXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG5cbiAgICAgICAgdGhpcy5fb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe3JhdGU6IFJBVEVfTVN9LCBvcHRpb25zKTtcbiAgICAgICAgaWYgKHRoaXMuX29wdGlvbnMucmF0ZSA8IFJBVEVfTVMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgaWxsZWdhbCByYXRlICR7cmF0ZX0sIG1pbmltdW0gcmF0ZSBpcyAke1JBVEVfTVN9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLypcbiAgICAgICAgICAgIG1hcFxuICAgICAgICAgICAgaGFuZGxlIC0+IHtjYWxsYmFjaywgdmFyaWFibGUsIGRlbGF5fVxuICAgICAgICAgICAgLSB2YXJpYWJsZTogdGFyZ2V0IGZvciBzYW1wbGluZ1xuICAgICAgICAgICAgLSBjYWxsYmFjazogZnVuY3Rpb24odmFsdWUpXG4gICAgICAgICAgICAtIGRlbGF5OiBiZXR3ZWVuIHNhbXBsZXMgKHdoZW4gdmFyaWFibGUgaXMgZHluYW1pYylcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2V0ID0gbmV3IFNldCgpO1xuICAgICAgICAvKlxuICAgICAgICAgICAgdmFyaWFibGUgbWFwXG4gICAgICAgICAgICB2YXJpYWJsZSAtPiB7c3ViLCBwb2xsaW5nLCBoYW5kbGVzOltdfVxuICAgICAgICAgICAgLSBzdWIgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgICAgICAgICAtIHBvbGxpbmc6IHRydWUgaWYgdmFyaWFibGUgbmVlZHMgcG9sbGluZ1xuICAgICAgICAgICAgLSBoYW5kbGVzOiBsaXN0IG9mIGhhbmRsZXMgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgICAgICovXG4gICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgLy8gdmFyaWFibGUgY2hhbmdlIGhhbmRsZXJcbiAgICAgICAgdGhpcy5fX29udmFyaWFibGVjaGFuZ2UgPSB0aGlzLl9vbnZhcmlhYmxlY2hhbmdlLmJpbmQodGhpcyk7XG4gICAgfVxuXG4gICAgYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIC8vIHJlZ2lzdGVyIGJpbmRpbmdcbiAgICAgICAgbGV0IGhhbmRsZSA9IHtjYWxsYmFjaywgdmFyaWFibGUsIGRlbGF5fTtcbiAgICAgICAgdGhpcy5fc2V0LmFkZChoYW5kbGUpO1xuICAgICAgICAvLyByZWdpc3RlciB2YXJpYWJsZVxuICAgICAgICBpZiAoIXRoaXMuX3ZhcmlhYmxlX21hcC5oYXModmFyaWFibGUpKSB7XG4gICAgICAgICAgICBsZXQgc3ViID0gdmFyaWFibGUub24oXCJjaGFuZ2VcIiwgdGhpcy5fX29udmFyaWFibGVjaGFuZ2UpO1xuICAgICAgICAgICAgbGV0IGl0ZW0gPSB7c3ViLCBwb2xsaW5nOmZhbHNlLCBoYW5kbGVzOiBbaGFuZGxlXX07XG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuc2V0KHZhcmlhYmxlLCBpdGVtKTtcbiAgICAgICAgICAgIC8vdGhpcy5fcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpLmhhbmRsZXMucHVzaChoYW5kbGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBoYW5kbGU7XG4gICAgfVxuXG4gICAgcmVsZWFzZShoYW5kbGUpIHtcbiAgICAgICAgLy8gY2xlYW51cFxuICAgICAgICBsZXQgcmVtb3ZlZCA9IHRoaXMuX3NldC5kZWxldGUoaGFuZGxlKTtcbiAgICAgICAgaWYgKCFyZW1vdmVkKSByZXR1cm47XG4gICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNsZWFudXAgdmFyaWFibGUgbWFwXG4gICAgICAgIGxldCB2YXJpYWJsZSA9IGhhbmRsZS52YXJpYWJsZTtcbiAgICAgICAgbGV0IHtzdWIsIGhhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCBpZHggPSBoYW5kbGVzLmluZGV4T2YoaGFuZGxlKTtcbiAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICBoYW5kbGVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChoYW5kbGVzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAvLyB2YXJpYWJsZSBoYXMgbm8gaGFuZGxlc1xuICAgICAgICAgICAgLy8gY2xlYW51cCB2YXJpYWJsZSBtYXBcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5kZWxldGUodmFyaWFibGUpO1xuICAgICAgICAgICAgdmFyaWFibGUub2ZmKHN1Yik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICB2YXJpYWJsZSBlbWl0cyBhIGNoYW5nZSBldmVudFxuICAgICovXG4gICAgX29udmFyaWFibGVjaGFuZ2UgKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIGxldCB2YXJpYWJsZSA9IGVJbmZvLnNyYztcbiAgICAgICAgLy8gZGlyZWN0IGNhbGxiYWNrIC0gY291bGQgdXNlIGVBcmcgaGVyZVxuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCBzdGF0ZSA9IGVBcmc7XG4gICAgICAgIC8vIHJlZXZhbHVhdGUgcG9sbGluZ1xuICAgICAgICB0aGlzLl9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUsIHN0YXRlKTtcbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICBoYW5kbGUuY2FsbGJhY2soc3RhdGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgc3RhcnQgb3Igc3RvcCBwb2xsaW5nIGlmIG5lZWRlZFxuICAgICovXG4gICAgX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSwgc3RhdGUpIHtcbiAgICAgICAgbGV0IGl0ZW0gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IHtwb2xsaW5nOndhc19wb2xsaW5nfSA9IGl0ZW07XG4gICAgICAgIHN0YXRlID0gc3RhdGUgfHwgdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgbGV0IHNob3VsZF9iZV9wb2xsaW5nID0gc3RhdGUuZHluYW1pYztcbiAgICAgICAgaWYgKCF3YXNfcG9sbGluZyAmJiBzaG91bGRfYmVfcG9sbGluZykge1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0cyh2YXJpYWJsZSk7XG4gICAgICAgIH0gZWxzZSBpZiAod2FzX3BvbGxpbmcgJiYgIXNob3VsZF9iZV9wb2xsaW5nKSB7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHNldCB0aW1lb3V0IGZvciBhbGwgY2FsbGJhY2tzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICovXG4gICAgX3NldF90aW1lb3V0cyh2YXJpYWJsZSkge1xuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3NldF90aW1lb3V0KGhhbmRsZSkge1xuICAgICAgICBsZXQgZGVsdGEgPSB0aGlzLl9jYWxjdWxhdGVfZGVsdGEoaGFuZGxlLmRlbGF5KTtcbiAgICAgICAgbGV0IGhhbmRsZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLl9oYW5kbGVfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIGhhbmRsZS50aWQgPSBzZXRUaW1lb3V0KGhhbmRsZXIsIGRlbHRhKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBhZGp1c3QgZGVsYXkgc28gdGhhdCBpZiBmYWxscyBvblxuICAgICAgICB0aGUgbWFpbiB0aWNrIHJhdGVcbiAgICAqL1xuICAgIF9jYWxjdWxhdGVfZGVsdGEoZGVsYXkpIHtcbiAgICAgICAgbGV0IHJhdGUgPSB0aGlzLl9vcHRpb25zLnJhdGU7XG4gICAgICAgIGxldCBub3cgPSBNYXRoLnJvdW5kKHBlcmZvcm1hbmNlLm5vdygpKTtcbiAgICAgICAgbGV0IFtub3dfbiwgbm93X3JdID0gZGl2bW9kKG5vdywgcmF0ZSk7XG4gICAgICAgIGxldCBbbiwgcl0gPSBkaXZtb2Qobm93ICsgZGVsYXksIHJhdGUpO1xuICAgICAgICBsZXQgdGFyZ2V0ID0gTWF0aC5tYXgobiwgbm93X24gKyAxKSpyYXRlO1xuICAgICAgICByZXR1cm4gdGFyZ2V0IC0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgY2xlYXIgYWxsIHRpbWVvdXRzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICovXG4gICAgX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKSB7XG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIGlmIChoYW5kbGUudGlkICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dChoYW5kbGUudGlkKTtcbiAgICAgICAgICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgaGFuZGxlIHRpbWVvdXRcbiAgICAqL1xuICAgIF9oYW5kbGVfdGltZW91dChoYW5kbGUpIHtcbiAgICAgICAgLy8gZHJvcCBpZiBoYW5kbGUgdGlkIGhhcyBiZWVuIGNsZWFyZWRcbiAgICAgICAgaWYgKGhhbmRsZS50aWQgPT0gdW5kZWZpbmVkKSByZXR1cm47XG4gICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhbGxiYWNrXG4gICAgICAgIGxldCB7dmFyaWFibGV9ID0gaGFuZGxlO1xuICAgICAgICBsZXQgc3RhdGUgPSB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICAvLyByZXNjaGVkdWxlIHRpbWVvdXRzIGZvciBjYWxsYmFja3NcbiAgICAgICAgaWYgKHN0YXRlLmR5bmFtaWMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvKlxuICAgICAgICAgICAgICAgIG1ha2Ugc3VyZSBwb2xsaW5nIHN0YXRlIGlzIGFsc28gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzIHdvdWxkIG9ubHkgb2NjdXIgaWYgdGhlIHZhcmlhYmxlXG4gICAgICAgICAgICAgICAgd2VudCBmcm9tIHJlcG9ydGluZyBkeW5hbWljIHRydWUgdG8gZHluYW1pYyBmYWxzZSxcbiAgICAgICAgICAgICAgICB3aXRob3V0IGVtbWl0dGluZyBhIGNoYW5nZSBldmVudCAtIHRodXNcbiAgICAgICAgICAgICAgICB2aW9sYXRpbmcgdGhlIGFzc3VtcHRpb24uIFRoaXMgcHJlc2VydmVzXG4gICAgICAgICAgICAgICAgaW50ZXJuYWwgaW50ZWdyaXR5IGkgdGhlIG1vbml0b3IuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgbGV0IGl0ZW0gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIC8vXG4gICAgICAgIGhhbmRsZS5jYWxsYmFjayhzdGF0ZSk7XG4gICAgfVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEZSQU1FUkFURSBNT05JVE9SXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuY2xhc3MgRnJhbWVyYXRlTW9uaXRvciBleHRlbmRzIFRpbWVvdXRNb25pdG9yIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICAgIHRoaXMuX2hhbmRsZTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICB0aW1lb3V0cyBhcmUgb2Jzb2xldGVcbiAgICAqL1xuICAgIF9zZXRfdGltZW91dHModmFyaWFibGUpIHt9XG4gICAgX3NldF90aW1lb3V0KGhhbmRsZSkge31cbiAgICBfY2FsY3VsYXRlX2RlbHRhKGRlbGF5KSB7fVxuICAgIF9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSkge31cbiAgICBfaGFuZGxlX3RpbWVvdXQoaGFuZGxlKSB7fVxuXG4gICAgX29udmFyaWFibGVjaGFuZ2UgKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIHN1cGVyLl9vbnZhcmlhYmxlY2hhbmdlKGVBcmcsIGVJbmZvKTtcbiAgICAgICAgLy8ga2ljayBvZmYgY2FsbGJhY2sgbG9vcCBkcml2ZW4gYnkgcmVxdWVzdCBhbmltYXRpb25mcmFtZVxuICAgICAgICB0aGlzLl9jYWxsYmFjaygpO1xuICAgIH1cblxuICAgIF9jYWxsYmFjaygpIHtcbiAgICAgICAgLy8gY2FsbGJhY2sgdG8gYWxsIHZhcmlhYmxlcyB3aGljaCByZXF1aXJlIHBvbGxpbmdcbiAgICAgICAgbGV0IHZhcmlhYmxlcyA9IFsuLi50aGlzLl92YXJpYWJsZV9tYXAuZW50cmllcygpXVxuICAgICAgICAgICAgLmZpbHRlcigoW3ZhcmlhYmxlLCBpdGVtXSkgPT4gaXRlbS5wb2xsaW5nKVxuICAgICAgICAgICAgLm1hcCgoW3ZhcmlhYmxlLCBpdGVtXSkgPT4gdmFyaWFibGUpO1xuICAgICAgICBpZiAodmFyaWFibGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIGNhbGxiYWNrXG4gICAgICAgICAgICBmb3IgKGxldCB2YXJpYWJsZSBvZiB2YXJpYWJsZXMpIHtcbiAgICAgICAgICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgICAgICAgICAgbGV0IHJlcyA9IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHJlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogXG4gICAgICAgICAgICAgICAgcmVxdWVzdCBuZXh0IGNhbGxiYWNrIGFzIGxvbmcgYXMgYXQgbGVhc3Qgb25lIHZhcmlhYmxlIFxuICAgICAgICAgICAgICAgIGlzIHJlcXVpcmluZyBwb2xsaW5nXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMuX2NhbGxiYWNrLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBCSU5EIFJFTEVBU0VcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuY29uc3QgbW9uaXRvciA9IG5ldyBUaW1lb3V0TW9uaXRvcigpO1xuY29uc3QgZnJhbWVyYXRlX21vbml0b3IgPSBuZXcgRnJhbWVyYXRlTW9uaXRvcigpO1xuXG5leHBvcnQgZnVuY3Rpb24gYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgbGV0IGhhbmRsZTtcbiAgICBpZiAoQm9vbGVhbihwYXJzZUZsb2F0KGRlbGF5KSkpIHtcbiAgICAgICAgaGFuZGxlID0gbW9uaXRvci5iaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gW1widGltZW91dFwiLCBoYW5kbGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGhhbmRsZSA9IGZyYW1lcmF0ZV9tb25pdG9yLmJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCAwLCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIFtcImZyYW1lcmF0ZVwiLCBoYW5kbGVdO1xuICAgIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiByZWxlYXNlKGhhbmRsZSkge1xuICAgIGxldCBbdHlwZSwgX2hhbmRsZV0gPSBoYW5kbGU7XG4gICAgaWYgKHR5cGUgPT0gXCJ0aW1lb3V0XCIpIHtcbiAgICAgICAgcmV0dXJuIG1vbml0b3IucmVsZWFzZShfaGFuZGxlKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJmcmFtZXJhdGVcIikge1xuICAgICAgICByZXR1cm4gZnJhbWVyYXRlX21vbml0b3IucmVsZWFzZShfaGFuZGxlKTtcbiAgICB9XG59XG5cbiIsImltcG9ydCAqIGFzIHNyY3Byb3AgZnJvbSBcIi4vYXBpX3NyY3Byb3AuanNcIjtcbmltcG9ydCB7IENsb2NrUHJvdmlkZXJCYXNlLCBsb2NhbENsb2NrUHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX2Nsb2NrLmpzXCI7XG5pbXBvcnQgeyBjbWQgfSBmcm9tIFwiLi9jbWQuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4vbGF5ZXJzLmpzXCI7XG5pbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgYmluZCwgcmVsZWFzZSB9IGZyb20gXCIuL21vbml0b3IuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuL25lYXJieWluZGV4LmpzXCI7XG5cblxuXG4vKipcbiAqIEN1cnNvciBlbXVsYXRlcyBMYXllciBpbnRlcmZhY2UuXG4gKiBQYXJ0IG9mIHRoaXMgaXMgdG8gcHJvdmUgYW4gaW5kZXggZm9yIHRoZSB0aW1lbGluZS4gXG4gKiBIb3dldmVyLCB3aGVuIGNvbnNpZGVyZWQgYXMgYSBsYXllciwgdGhlIGN1cnNvciB2YWx1ZSBpcyBcbiAqIGluZGVwZW5kZW50IG9mIHRpbWVsaW5lIG9mZnNldCwgd2hpY2ggaXMgdG8gc2F5IHRoYXRcbiAqIGl0IGhhcyB0aGUgc2FtZSB2YWx1ZSBmb3IgYWxsIHRpbWVsaW5lIG9mZnNldHMuXG4gKiBcbiAqIFVubGlrZSBvdGhlciBMYXllcnMsIHRoZSBDdXJzb3IgZG8gbm90IGFjdHVhbGx5XG4gKiB1c2UgdGhpcyBpbmRleCB0byByZXNvbHZlIHF1ZXJpZXMuIEl0IGlzIG9ubHkgbmVlZGVkXG4gKiBmb3Igc29tZSBnZW5lcmljIExheWVyIGZ1bmN0aW9ubmFsaXR5LCBsaWtlIHNhbXBsaW5nLFxuICogd2hpY2ggdXNlcyBpbmRleC5maXJzdCgpIGFuZCBpbmRleC5sYXN0KCkuXG4gKi9cblxuY2xhc3MgQ3Vyc29ySW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoY3Vyc29yKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2NhY2hlID0gY3Vyc29yLmdldENhY2hlKCk7XG4gICAgfVxuXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICAvLyBjdXJzb3IgaW5kZXggaXMgZGVmaW5lZCBmb3IgZW50aXJlIHRpbWVsaW5lXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIGNlbnRlcjogW3RoaXMuX2NhY2hlXSxcbiAgICAgICAgICAgIGxlZnQ6IFstSW5maW5pdHksIDBdLFxuICAgICAgICAgICAgcHJldjogWy1JbmZpbml0eSwgMF0sXG4gICAgICAgICAgICByaWdodDogW0luZmluaXR5LCAwXSxcbiAgICAgICAgICAgIG5leHQ6IFtJbmZpbml0eSwgMF0sXG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogXG4gKiBDdXJzb3IgY2FjaGUgaW1wbGVtZW50cyB0aGUgcXVlcnkgb3BlcmF0aW9uIGZvciBcbiAqIHRoZSBDdXJzb3IsIGlnbm9yaW5nIHRoZSBnaXZlbiBvZmZzZXQsIHJlcGxhY2luZyBpdCBcbiAqIHdpdGggYW4gb2Zmc2V0IGZyb20gdGhlIGN0cmwgaW5zdGVhZC4gXG4gKiBUaGUgbGF5ZXIgY2FjaGUgaXMgdXNlZCB0byByZXNvbHZlIHRoZSBxdWVyeSBcbiAqL1xuXG5jbGFzcyBDdXJzb3JDYWNoZSB7XG4gICAgY29uc3RydWN0b3IoY3Vyc29yKSB7XG4gICAgICAgIHRoaXMuX2N1cnNvciA9IGN1cnNvcjtcbiAgICAgICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9jdXJzb3Iuc3JjLmdldENhY2hlKCk7XG4gICAgfVxuXG4gICAgcXVlcnkoKSB7XG4gICAgICAgIGNvbnN0IG9mZnNldCA9IHRoaXMuX2N1cnNvci5fZ2V0X2N0cmxfc3RhdGUoKS52YWx1ZTsgXG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIGNsZWFyKCkge1xuICAgICAgICB0aGlzLl9jYWNoZS5jbGVhcigpO1xuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBDVVJTT1JcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogXG4gKiBDdXJzb3IgZ2xpZGVzIGFsb25nIGEgbGF5ZXIgYW5kIGV4cG9zZXMgdGhlIGN1cnJlbnQgbGF5ZXJcbiAqIHZhbHVlIGF0IGFueSB0aW1lXG4gKiAtIGhhcyBtdXRhYmxlIGN0cmwgKGxvY2FsQ2xvY2tQcm92aWRlciBvciBDdXJzb3IpXG4gKiAtIGhhcyBtdXRhYmxlIHNyYyAobGF5ZXIpXG4gKiAtIG1ldGhvZHMgZm9yIGFzc2lnbiwgbW92ZSwgdHJhbnNpdGlvbiwgaW50ZXJwb2xhdGlvblxuICovXG5cbmV4cG9ydCBjbGFzcyBDdXJzb3IgZXh0ZW5kcyBMYXllciB7XG5cbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcih7Q2FjaGVDbGFzczpDdXJzb3JDYWNoZX0pO1xuXG4gICAgICAgIC8vIHNldHVwIHNyYyBwcm9wZXJ0aWVzXG4gICAgICAgIHNyY3Byb3AuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5zcmNwcm9wX3JlZ2lzdGVyKFwic3JjXCIpO1xuICAgICAgICB0aGlzLnNyY3Byb3BfcmVnaXN0ZXIoXCJjdHJsXCIpO1xuXG4gICAgICAgIC8vIHRpbWVvdXRcbiAgICAgICAgdGhpcy5fdGlkO1xuICAgICAgICAvLyBwb2xsaW5nXG4gICAgICAgIHRoaXMuX3BpZDtcblxuICAgICAgICAvLyBpbml0aWFsaXNlIGN0cmwsIHNyY1xuICAgICAgICBsZXQge3NyYywgY3RybH0gPSBvcHRpb25zO1xuICAgICAgICB0aGlzLmN0cmwgPSBjdHJsIHx8IGxvY2FsQ2xvY2tQcm92aWRlcjtcbiAgICAgICAgdGhpcy5zcmMgPSBzcmM7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBTUkNQUk9QOiBDVFJMIGFuZCBTUkNcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIHNyY3Byb3BfY2hlY2socHJvcE5hbWUsIG9iaikge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJjdHJsXCIpIHtcbiAgICAgICAgICAgIGNvbnN0IG9rID0gW0Nsb2NrUHJvdmlkZXJCYXNlLCBDdXJzb3JdXG4gICAgICAgICAgICAgICAgLm1hcCgoY2wpID0+IG9iaiBpbnN0YW5jZW9mIGNsKVxuICAgICAgICAgICAgICAgIC5zb21lKGU9PmUgPT0gdHJ1ZSk7XG4gICAgICAgICAgICBpZiAoIW9rKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcImN0cmxcIiBtdXN0IGJlIENsb2NrUHJvdmlkZXIgb3IgQ3Vyc29yICR7b2JqfWApXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocHJvcE5hbWUgPT0gXCJzcmNcIikge1xuICAgICAgICAgICAgaWYgKCEob2JqIGluc3RhbmNlb2YgTGF5ZXIpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcInNyY1wiIG11c3QgYmUgTGF5ZXIgJHtvYmp9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG5cbiAgICBzcmNwcm9wX29uY2hhbmdlKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIHRoaXMuX19oYW5kbGVfY2hhbmdlKHByb3BOYW1lLCBlQXJnKTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIENBTExCQUNLXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfX2hhbmRsZV9jaGFuZ2Uob3JpZ2luLCBlQXJnKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLl90aWQpO1xuICAgICAgICBjbGVhckludGVydmFsKHRoaXMuX3BpZCk7XG4gICAgICAgIGlmICh0aGlzLnNyYyAmJiB0aGlzLmN0cmwpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmluZGV4ID09IHVuZGVmaW5lZCB8fCBlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIC8vIE5PVCB1c2VkIGZvciBjdXJzb3IgcXVlcnkgXG4gICAgICAgICAgICAgICAgdGhpcy5pbmRleCA9IG5ldyBDdXJzb3JJbmRleCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICAgICAgLy8gdHJpZ2dlciBjaGFuZ2UgZXZlbnQgZm9yIGN1cnNvclxuICAgICAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdGhpcy5xdWVyeSgpKTtcbiAgICAgICAgICAgIC8vIGRldGVjdCBmdXR1cmUgY2hhbmdlIGV2ZW50IC0gaWYgbmVlZGVkXG4gICAgICAgICAgICB0aGlzLl9fZGV0ZWN0X2Z1dHVyZV9jaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERFVEVDVCBGVVRVUkUgQ0hBTkdFXG4gICAgICogXG4gICAgICogUFJPQkxFTTpcbiAgICAgKiBcbiAgICAgKiBEdXJpbmcgcGxheWJhY2sgKGN1cnNvci5jdHJsIGlzIGR5bmFtaWMpLCB0aGVyZSBpcyBhIG5lZWQgdG8gXG4gICAgICogZGV0ZWN0IHRoZSBwYXNzaW5nIGZyb20gb25lIHNlZ21lbnQgaW50ZXJ2YWwgb2Ygc3JjXG4gICAgICogdG8gdGhlIG5leHQgLSBpZGVhbGx5IGF0IHByZWNpc2VseSB0aGUgY29ycmVjdCB0aW1lXG4gICAgICogXG4gICAgICogbmVhcmJ5Lml0diAoZGVyaXZlZCBmcm9tIGN1cnNvci5zcmMpIGdpdmVzIHRoZSBcbiAgICAgKiBpbnRlcnZhbCAoaSkgd2UgYXJlIGN1cnJlbnRseSBpbiwgaS5lLiwgXG4gICAgICogY29udGFpbmluZyB0aGUgY3VycmVudCBvZmZzZXQgKHZhbHVlIG9mIGN1cnNvci5jdHJsKSwgXG4gICAgICogYW5kIChpaSkgd2hlcmUgbmVhcmJ5LmNlbnRlciBzdGF5cyBjb25zdGFudFxuICAgICAqIFxuICAgICAqIFRoZSBldmVudCB0aGF0IG5lZWRzIHRvIGJlIGRldGVjdGVkIGlzIHRoZXJlZm9yZSB0aGVcbiAgICAgKiBtb21lbnQgd2hlbiB3ZSBsZWF2ZSB0aGlzIGludGVydmFsLCB0aHJvdWdoIGVpdGhlclxuICAgICAqIHRoZSBsb3cgb3IgaGlnaCBpbnRlcnZhbCBlbmRwb2ludFxuICAgICAqIFxuICAgICAqIEdPQUw6XG4gICAgICogXG4gICAgICogQXQgdGhpcyBtb21lbnQsIHdlIHNpbXBseSBuZWVkIHRvIHJlZXZhbHVhdGUgdGhlIHN0YXRlIChxdWVyeSkgYW5kXG4gICAgICogZW1pdCBhIGNoYW5nZSBldmVudCB0byBub3RpZnkgb2JzZXJ2ZXJzLiBcbiAgICAgKiBcbiAgICAgKiBBUFBST0FDSEVTOlxuICAgICAqIFxuICAgICAqIEFwcHJvYWNoIFswXSBcbiAgICAgKiBUaGUgdHJpdmlhbCBzb2x1dGlvbiBpcyB0byBkbyBub3RoaW5nLCBpbiB3aGljaCBjYXNlXG4gICAgICogb2JzZXJ2ZXJzIHdpbGwgc2ltcGx5IGZpbmQgb3V0IHRoZW1zZWx2ZXMgYWNjb3JkaW5nIHRvIHRoZWlyIFxuICAgICAqIG93biBwb2xsIGZyZXF1ZW5jeS4gVGhpcyBpcyBzdWJvcHRpbWFsLCBwYXJ0aWN1bGFybHkgZm9yIGxvdyBmcmVxdWVuY3kgXG4gICAgICogb2JzZXJ2ZXJzLiBJZiB0aGVyZSBpcyBhdCBsZWFzdCBvbmUgaGlnaC1mcmVxdWVuY3kgcG9sbGVyLCBcbiAgICAgKiB0aGlzIHdvdWxkIHRyaWdnZXIgdHJpZ2dlciB0aGUgc3RhdGUgY2hhbmdlLCBjYXVzaW5nIGFsbFxuICAgICAqIG9ic2VydmVycyB0byBiZSBub3RpZmllZC4gVGhlIHByb2JsZW0gdGhvdWdoLCBpcyBpZiBubyBvYnNlcnZlcnNcbiAgICAgKiBhcmUgYWN0aXZlbHkgcG9sbGluZywgYnV0IG9ubHkgZGVwZW5kaW5nIG9uIGNoYW5nZSBldmVudHMuXG4gICAgICogXG4gICAgICogQXBwcm9hY2ggWzFdIFxuICAgICAqIEluIGNhc2VzIHdoZXJlIHRoZSBjdHJsIGlzIGRldGVybWluaXN0aWMsIGEgdGltZW91dFxuICAgICAqIGNhbiBiZSBjYWxjdWxhdGVkLiBUaGlzIGlzIHRyaXZpYWwgaWYgY3RybCBpcyBhIENsb2NrQ3Vyc29yLCBhbmRcbiAgICAgKiBpdCBpcyBmYWlybHkgZWFzeSBpZiB0aGUgY3RybCBpcyBDdXJzb3IgcmVwcmVzZW50aW5nIG1vdGlvblxuICAgICAqIG9yIGxpbmVhciB0cmFuc2l0aW9uLiBIb3dldmVyLCBjYWxjdWxhdGlvbnMgY2FuIGJlY29tZSBtb3JlXG4gICAgICogY29tcGxleCBpZiBtb3Rpb24gc3VwcG9ydHMgYWNjZWxlcmF0aW9uLCBvciBpZiB0cmFuc2l0aW9uc1xuICAgICAqIGFyZSBzZXQgdXAgd2l0aCBub24tbGluZWFyIGVhc2luZy5cbiAgICAgKiAgIFxuICAgICAqIE5vdGUsIGhvd2V2ZXIsIHRoYXQgdGhlc2UgY2FsY3VsYXRpb25zIGFzc3VtZSB0aGF0IHRoZSBjdXJzb3IuY3RybCBpcyBcbiAgICAgKiBhIENsb2NrQ3Vyc29yLCBvciB0aGF0IGN1cnNvci5jdHJsLmN0cmwgaXMgYSBDbG9ja0N1cnNvci4gXG4gICAgICogSW4gcHJpbmNpcGxlLCB0aG91Z2gsIHRoZXJlIGNvdWxkIGJlIGEgcmVjdXJzaXZlIGNoYWluIG9mIGN1cnNvcnMsXG4gICAgICogKGN1cnNvci5jdHJsLmN0cmwuLi4uY3RybCkgb2Ygc29tZSBsZW5ndGgsIHdoZXJlIG9ubHkgdGhlIGxhc3QgaXMgYSBcbiAgICAgKiBDbG9ja0N1cnNvci4gSW4gb3JkZXIgdG8gZG8gZGV0ZXJtaW5pc3RpYyBjYWxjdWxhdGlvbnMgaW4gdGhlIGdlbmVyYWxcbiAgICAgKiBjYXNlLCBhbGwgY3Vyc29ycyBpbiB0aGUgY2hhaW4gd291bGQgaGF2ZSB0byBiZSBsaW1pdGVkIHRvIFxuICAgICAqIGRldGVybWluaXN0aWMgbGluZWFyIHRyYW5zZm9ybWF0aW9ucy5cbiAgICAgKiBcbiAgICAgKiBBcHByb2NoIFsyXSBcbiAgICAgKiBJdCBtaWdodCBhbHNvIGJlIHBvc3NpYmxlIHRvIHNhbXBsZSBmdXR1cmUgdmFsdWVzIG9mIFxuICAgICAqIGN1cnNvci5jdHJsIHRvIHNlZSBpZiB0aGUgdmFsdWVzIHZpb2xhdGUgdGhlIG5lYXJieS5pdHYgYXQgc29tZSBwb2ludC4gXG4gICAgICogVGhpcyB3b3VsZCBlc3NlbnRpYWxseSBiZSB0cmVhdGluZyBjdHJsIGFzIGEgbGF5ZXIgYW5kIHNhbXBsaW5nIFxuICAgICAqIGZ1dHVyZSB2YWx1ZXMuIFRoaXMgYXBwcm9jaCB3b3VsZCB3b3JrIGZvciBhbGwgdHlwZXMsIFxuICAgICAqIGJ1dCB0aGVyZSBpcyBubyBrbm93aW5nIGhvdyBmYXIgaW50byB0aGUgZnV0dXJlIG9uZSBcbiAgICAgKiB3b3VsZCBoYXZlIHRvIHNlZWsuIEhvd2V2ZXIsIGFnYWluIC0gYXMgaW4gWzFdIHRoZSBhYmlsaXR5IHRvIHNhbXBsZSBmdXR1cmUgdmFsdWVzXG4gICAgICogaXMgcHJlZGljYXRlZCBvbiBjdXJzb3IuY3RybCBiZWluZyBhIENsb2NrQ3Vyc29yLiBBbHNvLCB0aGVyZSBcbiAgICAgKiBpcyBubyB3YXkgb2Yga25vd2luZyBob3cgbG9uZyBpbnRvIHRoZSBmdXR1cmUgc2FtcGxpbmcgd291bGQgYmUgbmVjZXNzYXJ5LlxuICAgICAqIFxuICAgICAqIEFwcHJvYWNoIFszXSBcbiAgICAgKiBJbiB0aGUgZ2VuZXJhbCBjYXNlLCB0aGUgb25seSB3YXkgdG8gcmVsaWFibGV5IGRldGVjdCB0aGUgZXZlbnQgaXMgdGhyb3VnaCByZXBlYXRlZFxuICAgICAqIHBvbGxpbmcuIEFwcHJvYWNoIFszXSBpcyBzaW1wbHkgdGhlIGlkZWEgdGhhdCB0aGlzIHBvbGxpbmcgaXMgcGVyZm9ybWVkXG4gICAgICogaW50ZXJuYWxseSBieSB0aGUgY3Vyc29yIGl0c2VsZiwgYXMgYSB3YXkgb2Ygc2VjdXJpbmcgaXRzIG93biBjb25zaXN0ZW50XG4gICAgICogc3RhdGUsIGFuZCBlbnN1cmluZyB0aGF0IG9ic2VydmVyIGdldCBjaGFuZ2UgZXZlbnRzIGluIGEgdGltZWx5IG1hbm5lciwgZXZlbnRcbiAgICAgKiBpZiB0aGV5IGRvIGxvdy1mcmVxdWVuY3kgcG9sbGluZywgb3IgZG8gbm90IGRvIHBvbGxpbmcgYXQgYWxsLiBcbiAgICAgKiBcbiAgICAgKiBTT0xVVElPTjpcbiAgICAgKiBBcyB0aGVyZSBpcyBubyBwZXJmZWN0IHNvbHV0aW9uIGluIHRoZSBnZW5lcmFsIGNhc2UsIHdlIG9wcG9ydHVuaXN0aWNhbGx5XG4gICAgICogdXNlIGFwcHJvYWNoIFsxXSB3aGVuIHRoaXMgaXMgcG9zc2libGUuIElmIG5vdCwgd2UgYXJlIGZhbGxpbmcgYmFjayBvbiBcbiAgICAgKiBhcHByb2FjaCBbM11cbiAgICAgKiBcbiAgICAgKiBDT05ESVRJT05TIHdoZW4gTk8gZXZlbnQgZGV0ZWN0aW9uIGlzIG5lZWRlZCAoTk9PUClcbiAgICAgKiAoaSkgY3Vyc29yLmN0cmwgaXMgbm90IGR5bmFtaWNcbiAgICAgKiBvclxuICAgICAqIChpaSkgbmVhcmJ5Lml0diBzdHJldGNoZXMgaW50byBpbmZpbml0eSBpbiBib3RoIGRpcmVjdGlvbnNcbiAgICAgKiBcbiAgICAgKiBDT05ESVRJT05TIHdoZW4gYXBwcm9hY2ggWzFdIGNhbiBiZSB1c2VkXG4gICAgICogXG4gICAgICogKGkpIGlmIGN0cmwgaXMgYSBDbG9ja0N1cnNvciAmJiBuZWFyYnkuaXR2LmhpZ2ggPCBJbmZpbml0eVxuICAgICAqIG9yXG4gICAgICogKGlpKSBjdHJsLmN0cmwgaXMgYSBDbG9ja0N1cnNvclxuICAgICAqICAgICAgKGEpIGN0cmwubmVhcmJ5LmNlbnRlciBoYXMgZXhhY3RseSAxIGl0ZW1cbiAgICAgKiAgICAgICYmXG4gICAgICogICAgICAoYikgY3RybC5uZWFyYnkuY2VudGVyWzBdLnR5cGUgPT0gKFwibW90aW9uXCIpIHx8IChcInRyYW5zaXRpb25cIiAmJiBlYXNpbmc9PVwibGluZWFyXCIpXG4gICAgICogICAgICAmJlxuICAgICAqICAgICAgKGMpIGN0cmwubmVhcmJ5LmNlbnRlclswXS5kYXRhLnZlbG9jaXR5ICE9IDAuMFxuICAgICAqICAgICAgJiYgXG4gICAgICogICAgICAoZCkgZnV0dXJlIGludGVyc2VjdG9uIHBvaW50IHdpdGggY2FjaGUubmVhcmJ5Lml0diBcbiAgICAgKiAgICAgICAgICBpcyBub3QgLUluZmluaXR5IG9yIEluZmluaXR5XG4gICAgICogXG4gICAgICogVGhvdWdoIGl0IHNlZW1zIGNvbXBsZXgsIGNvbmRpdGlvbnMgZm9yIFsxXSBzaG91bGQgYmUgbWV0IGZvciBjb21tb24gY2FzZXMgaW52b2x2aW5nXG4gICAgICogcGxheWJhY2suIEFsc28sIHVzZSBvZiB0cmFuc2l0aW9uIGV0YyBtaWdodCBiZSByYXJlLlxuICAgICAqIFxuICAgICAqL1xuXG4gICAgX19kZXRlY3RfZnV0dXJlX2NoYW5nZSgpIHtcblxuICAgICAgICAvLyBjdHJsIFxuICAgICAgICBjb25zdCBjdHJsX3ZlY3RvciA9IHRoaXMuX2dldF9jdHJsX3N0YXRlKCk7XG4gICAgICAgIGNvbnN0IHt2YWx1ZTpjdXJyZW50X3Bvcywgb2Zmc2V0OmN1cnJlbnRfdHN9ID0gY3RybF92ZWN0b3I7XG5cbiAgICAgICAgLy8gY3RybCBtdXN0IGJlIGR5bmFtaWNcbiAgICAgICAgaWYgKCFjdHJsX3ZlY3Rvci5keW5hbWljKSB7XG4gICAgICAgICAgICAvLyBubyBmdXR1cmUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBnZXQgbmVhcmJ5IGZyb20gc3JjIC0gdXNlIHZhbHVlIGZyb20gY3RybFxuICAgICAgICBjb25zdCBzcmNfbmVhcmJ5ID0gdGhpcy5zcmMuaW5kZXgubmVhcmJ5KGN1cnJlbnRfcG9zKTtcbiAgICAgICAgY29uc3QgW2xvdywgaGlnaF0gPSBzcmNfbmVhcmJ5Lml0di5zbGljZSgwLDIpO1xuXG4gICAgICAgIC8vIGFwcHJvYWNoIFsxXVxuICAgICAgICBpZiAodGhpcy5jdHJsIGluc3RhbmNlb2YgQ2xvY2tQcm92aWRlckJhc2UpIHtcbiAgICAgICAgICAgIGlmIChpc0Zpbml0ZShoaWdoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dChoaWdoLCBjdXJyZW50X3BvcywgMS4wLCBjdXJyZW50X3RzKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBubyBmdXR1cmUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gXG4gICAgICAgIGlmICh0aGlzLmN0cmwuY3RybCBpbnN0YW5jZW9mIENsb2NrUHJvdmlkZXJCYXNlKSB7XG4gICAgICAgICAgICAvKiogXG4gICAgICAgICAgICAgKiB0aGlzLmN0cmwgXG4gICAgICAgICAgICAgKiBcbiAgICAgICAgICAgICAqIGhhcyBtYW55IHBvc3NpYmxlIGJlaGF2aW9yc1xuICAgICAgICAgICAgICogdGhpcy5jdHJsIGhhcyBhbiBpbmRleCB1c2UgdGhpcyB0byBmaWd1cmUgb3V0IHdoaWNoXG4gICAgICAgICAgICAgKiBiZWhhdmlvdXIgaXMgY3VycmVudC5cbiAgICAgICAgICAgICAqIFxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIC8vIHVzZSB0aGUgc2FtZSBvZmZzZXQgdGhhdCB3YXMgdXNlZCBpbiB0aGUgY3RybC5xdWVyeVxuICAgICAgICAgICAgY29uc3QgY3RybF9uZWFyYnkgPSB0aGlzLmN0cmwuaW5kZXgubmVhcmJ5KGN1cnJlbnRfdHMpO1xuXG4gICAgICAgICAgICBpZiAoIWlzRmluaXRlKGxvdykgJiYgIWlzRmluaXRlKGhpZ2gpKSB7XG4gICAgICAgICAgICAgICAgLy8gbm8gZnV0dXJlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjdHJsX25lYXJieS5jZW50ZXIubGVuZ3RoID09IDEpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjdHJsX2l0ZW0gPSBjdHJsX25lYXJieS5jZW50ZXJbMF07XG4gICAgICAgICAgICAgICAgaWYgKGN0cmxfaXRlbS50eXBlID09IFwibW90aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qge3ZlbG9jaXR5LCBhY2NlbGVyYXRpb249MC4wfSA9IGN0cmxfaXRlbS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYWNjZWxlcmF0aW9uID09IDAuMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmlndXJlIG91dCB3aGljaCBib3VuZGFyeSB3ZSBoaXQgZmlyc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB0YXJnZXRfcG9zID0gKHZlbG9jaXR5ID4gMCkgPyBoaWdoIDogbG93O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzRmluaXRlKHRhcmdldF9wb3MpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fX3NldF90aW1lb3V0KHRhcmdldF9wb3MsIGN1cnJlbnRfcG9zLCB2ZWxvY2l0eSwgY3VycmVudF90cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuOyAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5vIGZ1dHVyZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBhY2NlbGVyYXRpb24gLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGN0cmxfaXRlbS50eXBlID09IFwidHJhbnNpdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHt2MDpwMCwgdjE6cDEsIHQwLCB0MSwgZWFzaW5nPVwibGluZWFyXCJ9ID0gY3RybF9pdGVtLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlYXNpbmcgPT0gXCJsaW5lYXJcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGluZWFyIHRyYW5zdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHZlbG9jaXR5ID0gKHAxLXAwKS8odDEtdDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmlndXJlIG91dCB3aGljaCBib3VuZGFyeSB3ZSBoaXQgZmlyc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldF9wb3MgPSAodmVsb2NpdHkgPiAwKSA/IE1hdGgubWluKGhpZ2gsIHAxKSA6IE1hdGgubWF4KGxvdywgcDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fX3NldF90aW1lb3V0KHRhcmdldF9wb3MsIGN1cnJlbnRfcG9zLCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2ZWxvY2l0eSwgY3VycmVudF90cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIG90aGVyIGVhc2luZyAtIHBvc3NpYmxlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBvdGhlciB0eXBlIChpbnRlcnBvbGF0aW9uKSAtIHBvc3NpYmxlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbW9yZSB0aGFuIG9uZSBzZWdtZW50IC0gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwb3NzaWJsZSBldmVudCB0byBkZXRlY3QgLSBhcHByb2FjaCBbM11cbiAgICAgICAgdGhpcy5fX3NldF9wb2xsaW5nKHNyY19uZWFyYnkuaXR2KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBzZXQgdGltZW91dFxuICAgICAqIC0gcHJvdGVjdHMgYWdhaW5zdCB0b28gZWFybHkgY2FsbGJhY2tzIGJ5IHJlc2NoZWR1bGluZ1xuICAgICAqIHRpbWVvdXQgaWYgbmVjY2Vzc2FyeS5cbiAgICAgKiAtIGFkZHMgYSBtaWxsaXNlY29uZCB0byBvcmlnaW5hbCB0aW1lb3V0IHRvIGF2b2lkXG4gICAgICogZnJlcXVlbnQgcmVzY2hlZHVsaW5nIFxuICAgICAqL1xuXG4gICAgX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgdmVsb2NpdHksIGN1cnJlbnRfdHMpIHtcbiAgICAgICAgY29uc3QgZGVsdGFfc2VjID0gKHRhcmdldF9wb3MgLSBjdXJyZW50X3BvcykgLyB2ZWxvY2l0eTtcbiAgICAgICAgY29uc3QgdGFyZ2V0X3RzID0gY3VycmVudF90cyArIGRlbHRhX3NlYztcbiAgICAgICAgdGhpcy5fdGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9faGFuZGxlX3RpbWVvdXQodGFyZ2V0X3RzKTtcbiAgICAgICAgfSwgZGVsdGFfc2VjKjEwMDAgKyAxKTtcbiAgICB9XG5cbiAgICBfX2hhbmRsZV90aW1lb3V0KHRhcmdldF90cykge1xuICAgICAgICBjb25zdCB0cyA9IHRoaXMuX2dldF9jdHJsX3N0YXRlKCkub2Zmc2V0O1xuICAgICAgICBjb25zdCByZW1haW5pbmdfc2VjID0gdGFyZ2V0X3RzIC0gdHM7IFxuICAgICAgICBpZiAocmVtYWluaW5nX3NlYyA8PSAwKSB7XG4gICAgICAgICAgICAvLyBkb25lXG4gICAgICAgICAgICB0aGlzLl9faGFuZGxlX2NoYW5nZShcInRpbWVvdXRcIik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyByZXNjaGVkdWxlIHRpbWVvdXRcbiAgICAgICAgICAgIHRoaXMuX3RpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX19oYW5kbGVfdGltZW91dCh0YXJnZXRfdHMpXG4gICAgICAgICAgICB9LCByZW1haW5pbmdfc2VjKjEwMDApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc2V0IHBvbGxpbmdcbiAgICAgKi9cblxuICAgIF9fc2V0X3BvbGxpbmcoaXR2KSB7XG4gICAgICAgIHRoaXMuX3BpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX19oYW5kbGVfcG9sbChpdHYpO1xuICAgICAgICB9LCAxMDApO1xuICAgIH1cblxuICAgIF9faGFuZGxlX3BvbGwoaXR2KSB7XG4gICAgICAgIGxldCBvZmZzZXQgPSB0aGlzLnF1ZXJ5KCkudmFsdWU7XG4gICAgICAgIGlmICghaW50ZXJ2YWwuY292ZXJzX3BvaW50KGl0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV9jaGFuZ2UoXCJ0aW1lb3V0XCIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBRVUVSWSBBUElcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIF9nZXRfY3RybF9zdGF0ZSAoKSB7XG4gICAgICAgIGlmICh0aGlzLmN0cmwgaW5zdGFuY2VvZiBDbG9ja1Byb3ZpZGVyQmFzZSkge1xuICAgICAgICAgICAgbGV0IHRzID0gdGhpcy5jdHJsLm5vdygpO1xuICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZTp0cywgZHluYW1pYzp0cnVlLCBvZmZzZXQ6dHN9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IHN0YXRlID0gdGhpcy5jdHJsLnF1ZXJ5KCk7XG4gICAgICAgICAgICAvLyBwcm90ZWN0IGFnYWluc3Qgbm9uLWZsb2F0IHZhbHVlc1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBzdGF0ZS52YWx1ZSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhcm5pbmc6IGN0cmwgc3RhdGUgbXVzdCBiZSBudW1iZXIgJHtzdGF0ZS52YWx1ZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB2YWx1ZSAoKSB7cmV0dXJuIHRoaXMucXVlcnkoKS52YWx1ZX07XG4gICAgXG4gICAgLypcbiAgICAgICAgRXZlbnRpZnk6IGltbWVkaWF0ZSBldmVudHNcbiAgICAqL1xuICAgIGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG4gICAgICAgIGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBbdGhpcy5xdWVyeSgpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIEJJTkQgUkVMRUFTRSAoY29udmVuaWVuY2UpXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBiaW5kKGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgICAgICByZXR1cm4gYmluZCh0aGlzLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnMpO1xuICAgIH1cbiAgICByZWxlYXNlKGhhbmRsZSkge1xuICAgICAgICByZXR1cm4gcmVsZWFzZShoYW5kbGUpO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogVVBEQVRFIEFQSVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgYXNzaWduKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiBjbWQodGhpcy5zcmMuc3JjKS5hc3NpZ24odmFsdWUpO1xuICAgIH1cbiAgICBtb3ZlICh7cG9zaXRpb24sIHZlbG9jaXR5fSkge1xuICAgICAgICBsZXQge3ZhbHVlLCBvZmZzZXQ6dGltZXN0YW1wfSA9IHRoaXMucXVlcnkoKTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3Vyc29yIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7dmFsdWV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcG9zaXRpb24gPSAocG9zaXRpb24gIT0gdW5kZWZpbmVkKSA/IHBvc2l0aW9uIDogdmFsdWU7XG4gICAgICAgIHZlbG9jaXR5ID0gKHZlbG9jaXR5ICE9IHVuZGVmaW5lZCkgPyB2ZWxvY2l0eTogMDtcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzLnNyYy5zcmMpLm1vdmUoe3Bvc2l0aW9uLCB2ZWxvY2l0eSwgdGltZXN0YW1wfSk7XG4gICAgfVxuICAgIHRyYW5zaXRpb24gKHt0YXJnZXQsIGR1cmF0aW9uLCBlYXNpbmd9KSB7XG4gICAgICAgIGxldCB7dmFsdWU6djAsIG9mZnNldDp0MH0gPSB0aGlzLnF1ZXJ5KCk7XG4gICAgICAgIGlmICh0eXBlb2YgdjAgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhcm5pbmc6IGN1cnNvciBzdGF0ZSBtdXN0IGJlIG51bWJlciAke3YwfWApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjbWQodGhpcy5zcmMuc3JjKS50cmFuc2l0aW9uKHYwLCB0YXJnZXQsIHQwLCB0MCArIGR1cmF0aW9uLCBlYXNpbmcpO1xuICAgIH1cbiAgICBpbnRlcnBvbGF0ZSAoe3R1cGxlcywgZHVyYXRpb259KSB7XG4gICAgICAgIGxldCB0MCA9IHRoaXMucXVlcnkoKS5vZmZzZXQ7XG4gICAgICAgIC8vIGFzc3VtaW5nIHRpbXN0YW1wcyBhcmUgaW4gcmFuZ2UgWzAsMV1cbiAgICAgICAgLy8gc2NhbGUgdGltZXN0YW1wcyB0byBkdXJhdGlvblxuICAgICAgICB0dXBsZXMgPSB0dXBsZXMubWFwKChbdix0XSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFt2LCB0MCArIHQqZHVyYXRpb25dO1xuICAgICAgICB9KVxuICAgICAgICByZXR1cm4gY21kKHRoaXMuc3JjLnNyYykuaW50ZXJwb2xhdGUodHVwbGVzKTtcbiAgICB9XG5cbn1cbnNyY3Byb3AuYWRkVG9Qcm90b3R5cGUoQ3Vyc29yLnByb3RvdHlwZSk7XG5zcmNwcm9wLmFkZFRvUHJvdG90eXBlKEN1cnNvci5wcm90b3R5cGUpO1xuXG4iLCJpbXBvcnQgeyBpbnRlcnZhbCwgZW5kcG9pbnR9IGZyb20gXCIuLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuLi9uZWFyYnlpbmRleC5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi4vbGF5ZXJzLmpzXCJcblxuY2xhc3MgQm9vbGVhbkxheWVyIGV4dGVuZHMgTGF5ZXIge1xuXG4gICAgY29uc3RydWN0b3IobGF5ZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5pbmRleCA9IG5ldyBCb29sZWFuSW5kZXgobGF5ZXIuaW5kZXgpO1xuICAgIFxuICAgICAgICAvLyBzdWJzY3JpYmVcbiAgICAgICAgY29uc3QgaGFuZGxlciA9IHRoaXMuX29uY2hhbmdlLmJpbmQodGhpcyk7XG4gICAgICAgIGxheWVyLmFkZF9jYWxsYmFjayhoYW5kbGVyKTtcbiAgICB9XG5cbiAgICBfb25jaGFuZ2UoZUFyZykge1xuICAgICAgICB0aGlzLmNsZWFyQ2FjaGVzKCk7XG4gICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiKTtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBib29sZWFuKGxheWVyKSB7XG4gICAgcmV0dXJuIG5ldyBCb29sZWFuTGF5ZXIobGF5ZXIpO1xufSBcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQk9PTEVBTiBORUFSQlkgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBXcmFwcGVyIEluZGV4IHdoZXJlIHJlZ2lvbnMgYXJlIHRydWUvZmFsc2UsIGJhc2VkIG9uIFxuICogb24gd2hldGhlciB0aGUgc291cmNlIGluZGV4IGlzIGRlZmluZWQgb3Igbm90LlxuICogQmFjay10by1iYWNrIHJlZ2lvbnMgd2hpY2ggYXJlIGRlZmluZWQgXG4gKiBhcmUgY29sbGFwc2VkIGludG8gb25lIHJlZ2lvblxuICogXG4gKiBCb29sZWFuIEluZGV4IGlzIHN0YXRlbGVzcy5cbiAqIFxuICovXG5cbmZ1bmN0aW9uIHF1ZXJ5T2JqZWN0ICh2YWx1ZSkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHF1ZXJ5OiBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgICAgICAgICByZXR1cm4ge3ZhbHVlLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm9vbGVhbkluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKGluZGV4KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gICAgICAgIHRoaXMuX3RydWVPYmplY3QgPSBxdWVyeU9iamVjdCh0cnVlKTtcbiAgICAgICAgdGhpcy5fZmFsc2VPYmplY3QgPSBxdWVyeU9iamVjdChmYWxzZSk7XG4gICAgfVxuXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBvZmZzZXQgPSB0aGlzLmNoZWNrKG9mZnNldCk7XG4gICAgICAgIGNvbnN0IG5lYXJieSA9IHRoaXMuX2luZGV4Lm5lYXJieShvZmZzZXQpO1xuXG4gICAgICAgIC8vIGxlZnQsIHJpZ2h0IGlzIHVuY2hhbmdlZCBpZiBjZW50ZXIgaXMgZW1wdHlcbiAgICAgICAgaWYgKG5lYXJieS5jZW50ZXIubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIG5lYXJieS5jZW50ZXIgPSBbdGhpcy5fZmFsc2VPYmplY3RdO1xuICAgICAgICAgICAgcmV0dXJuIG5lYXJieTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNlZWsgbGVmdCBhbmQgcmlnaHQgZm9yIG5leHQgZ2FwIC0gZXhwYW5kIHJlZ2lvblxuICAgICAgICBsZXQgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5lYXJieS5pdHYpXG4gICAgICAgIGxldCBjdXJyZW50X25lYXJieTtcblxuICAgICAgICAvLyBzZWVrIHJpZ2h0XG4gICAgICAgIGN1cnJlbnRfbmVhcmJ5ID0gbmVhcmJ5O1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgLy8gcmVnaW9uIG9uIHRoZSByaWdodFxuICAgICAgICAgICAgY29uc3QgbmV4dF9uZWFyYnkgPSB0aGlzLl9pbmRleC5uZWFyYnkoY3VycmVudF9uZWFyYnkucmlnaHQpO1xuICAgICAgICAgICAgaWYgKG5leHRfbmVhcmJ5LmNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gZXhwYW5kIHJlZ2lvblxuICAgICAgICAgICAgICAgIGhpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5leHRfbmVhcmJ5Lml0dilbMV07XG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgaWYgdGhpcyBpcyBsYXN0IHJlZ2lvblxuICAgICAgICAgICAgICAgIGlmIChuZXh0X25lYXJieS5yaWdodFswXSA9PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb250aW51ZVxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50X25lYXJieSA9IG5leHRfbmVhcmJ5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gZm91bmQgZ2FwXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZWVrIGxlZnRcbiAgICAgICAgY3VycmVudF9uZWFyYnkgPSBuZWFyYnk7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICAvLyByZWdpb24gb24gdGhlIGxlZnRcbiAgICAgICAgICAgIGNvbnN0IG5leHRfbmVhcmJ5ID0gdGhpcy5faW5kZXgubmVhcmJ5KGN1cnJlbnRfbmVhcmJ5LmxlZnQpO1xuICAgICAgICAgICAgaWYgKG5leHRfbmVhcmJ5LmNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gZXhwYW5kIHJlZ2lvblxuICAgICAgICAgICAgICAgIGxvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmV4dF9uZWFyYnkuaXR2KVswXTtcbiAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiB0aGlzIGlzIGxhc3QgcmVnaW9uXG4gICAgICAgICAgICAgICAgaWYgKG5leHRfbmVhcmJ5LmxlZnRbMF0gPT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRfbmVhcmJ5ID0gbmV4dF9uZWFyYnk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBmb3VuZCBnYXBcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpdHY6IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCksXG4gICAgICAgICAgICBjZW50ZXIgOiBbdGhpcy5fdHJ1ZU9iamVjdF0sXG4gICAgICAgICAgICBsZWZ0OiBlbmRwb2ludC5mbGlwKGxvdywgXCJoaWdoXCIpLFxuICAgICAgICAgICAgcmlnaHQ6IGVuZHBvaW50LmZsaXAoaGlnaCwgXCJsb3dcIiksXG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBMb2NhbFN0YXRlUHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX3NpbXBsZS5qc1wiO1xuaW1wb3J0IHsgbWVyZ2UgfSBmcm9tIFwiLi9vcHMvbWVyZ2UuanNcIlxuaW1wb3J0IHsgc2hpZnQgfSBmcm9tIFwiLi9vcHMvc2hpZnQuanNcIjtcbmltcG9ydCB7IElucHV0TGF5ZXIsIExheWVyIH0gZnJvbSBcIi4vbGF5ZXJzLmpzXCI7XG5pbXBvcnQgeyBDdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3JzLmpzXCI7XG5pbXBvcnQgeyBib29sZWFuIH0gZnJvbSBcIi4vb3BzL2Jvb2xlYW4uanNcIlxuaW1wb3J0IHsgY21kIH0gZnJvbSBcIi4vY21kLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUiBGQUNUT1JZXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmZ1bmN0aW9uIGxheWVyKG9wdGlvbnM9e30pIHtcbiAgICBsZXQge3NyYywgaXRlbXM9W10sIHZhbHVlLCAuLi5vcHRzfSA9IG9wdGlvbnM7XG4gICAgaWYgKHNyYyBpbnN0YW5jZW9mIExheWVyKSB7XG4gICAgICAgIHJldHVybiBzcmM7XG4gICAgfSBcbiAgICBpZiAoc3JjID09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodmFsdWUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpdGVtcyA9IFt7XG4gICAgICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eV0sXG4gICAgICAgICAgICAgICAgZGF0YTogdmFsdWVcbiAgICAgICAgICAgIH1dO1xuICAgICAgICB9IFxuICAgICAgICBzcmMgPSBuZXcgTG9jYWxTdGF0ZVByb3ZpZGVyKHtpdGVtc30pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IElucHV0TGF5ZXIoe3NyYywgLi4ub3B0c30pOyBcbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIENVUlNPUiBGQUNUT1JJRVNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gY3Vyc29yKG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7Y3RybCwgLi4ub3B0c30gPSBvcHRpb25zO1xuICAgIGNvbnN0IHNyYyA9IGxheWVyKG9wdHMpOyAgICBcbiAgICByZXR1cm4gbmV3IEN1cnNvcih7Y3RybCwgc3JjfSk7XG59XG5cbmV4cG9ydCB7IGxheWVyLCBjdXJzb3IsIG1lcmdlLCBzaGlmdCwgY21kLCBjdXJzb3IgYXMgdmFyaWFibGUsIGN1cnNvciBhcyBwbGF5YmFjaywgYm9vbGVhbn0iXSwibmFtZXMiOlsiUFJFRklYIiwiYWRkVG9JbnN0YW5jZSIsImFkZFRvUHJvdG90eXBlIiwiY2FsbGJhY2suYWRkVG9JbnN0YW5jZSIsImNhbGxiYWNrLmFkZFRvUHJvdG90eXBlIiwiaW50ZXJwb2xhdGUiLCJldmVudGlmeS5hZGRUb0luc3RhbmNlIiwiZXZlbnRpZnkuYWRkVG9Qcm90b3R5cGUiLCJzcmNwcm9wLmFkZFRvSW5zdGFuY2UiLCJzcmNwcm9wLmFkZFRvUHJvdG90eXBlIiwic2VnbWVudC5TdGF0aWNTZWdtZW50Iiwic2VnbWVudC5UcmFuc2l0aW9uU2VnbWVudCIsInNlZ21lbnQuSW50ZXJwb2xhdGlvblNlZ21lbnQiLCJzZWdtZW50Lk1vdGlvblNlZ21lbnQiXSwibWFwcGluZ3MiOiI7Ozs7O0lBQUE7SUFDQTtJQUNBOztJQUVBLE1BQU1BLFFBQU0sR0FBRyxZQUFZOztJQUVwQixTQUFTQyxlQUFhLENBQUMsTUFBTSxFQUFFO0lBQ3RDLElBQUksTUFBTSxDQUFDLENBQUMsRUFBRUQsUUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsRUFBRTtJQUNyQzs7SUFFQSxTQUFTLFlBQVksRUFBRSxPQUFPLEVBQUU7SUFDaEMsSUFBSSxJQUFJLE1BQU0sR0FBRztJQUNqQixRQUFRLE9BQU8sRUFBRTtJQUNqQjtJQUNBLElBQUksSUFBSSxDQUFDLENBQUMsRUFBRUEsUUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUMzQyxJQUFJLE9BQU8sTUFBTTtJQUNqQjtJQUVBLFNBQVMsZUFBZSxFQUFFLE1BQU0sRUFBRTtJQUNsQyxJQUFJLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUVBLFFBQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDMUQsSUFBSSxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRTtJQUNwQixRQUFRLElBQUksQ0FBQyxDQUFDLEVBQUVBLFFBQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ25EO0lBQ0E7SUFFQSxTQUFTLGdCQUFnQixFQUFFLElBQUksRUFBRTtJQUNqQyxJQUFJLElBQUksQ0FBQyxDQUFDLEVBQUVBLFFBQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLE1BQU0sRUFBRTtJQUN4RCxRQUFRLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDO0lBQzVCLEtBQUssQ0FBQztJQUNOOztJQUdPLFNBQVNFLGdCQUFjLEVBQUUsVUFBVSxFQUFFO0lBQzVDLElBQUksTUFBTSxHQUFHLEdBQUc7SUFDaEIsUUFBUSxZQUFZLEVBQUUsZUFBZSxFQUFFO0lBQ3ZDO0lBQ0EsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUM7SUFDbEM7O0lDbkNBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTs7SUFFTyxNQUFNLGlCQUFpQixDQUFDOztJQUUvQixJQUFJLFdBQVcsR0FBRztJQUNsQixRQUFRQyxlQUFzQixDQUFDLElBQUksQ0FBQztJQUNwQzs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLE1BQU0sQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQztJQUM3QixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUM7SUFDMUM7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7O0lBRUEsSUFBSSxTQUFTLEdBQUc7SUFDaEIsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDO0lBQzFDOztJQUVBO0lBQ0E7SUFDQTs7SUFFQSxJQUFJLElBQUksSUFBSSxDQUFDLEdBQUc7SUFDaEIsUUFBUSxPQUFPLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQztJQUNsQztJQUNBO0FBQ0FDLG9CQUF1QixDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQzs7SUNqRHBEO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7O0lBR0EsU0FBUyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtJQUMxQixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxPQUFPLENBQUM7SUFDekIsSUFBSSxJQUFJLENBQUMsS0FBSyxRQUFRLEVBQUUsT0FBTyxDQUFDO0lBQ2hDLElBQUksSUFBSSxDQUFDLEtBQUssUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ2pDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDbEMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUM7SUFDakMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDO0lBQ2hCOztJQUVBLFNBQVMsWUFBWSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDL0IsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7SUFDckIsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7SUFDckIsSUFBSSxJQUFJLElBQUksR0FBRyxVQUFVLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQztJQUNqQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksR0FBRyxFQUFFLEdBQUcsRUFBRTtJQUN2Qzs7SUFFQSxTQUFTLFdBQVcsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQzlCLElBQUksT0FBTyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHO0lBQ2xDO0lBQ0EsU0FBUyxXQUFXLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUM5QixJQUFJLE9BQU8sWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSTtJQUNuQztJQUNBLFNBQVMsV0FBVyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDOUIsSUFBSSxPQUFPLFlBQVksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUc7SUFDbEM7SUFDQSxTQUFTLFdBQVcsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQzlCLElBQUksT0FBTyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJO0lBQ25DO0lBQ0EsU0FBUyxXQUFXLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUM5QixJQUFJLE9BQU8sWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSTtJQUNuQztJQUNBLFNBQVMsWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDOUIsSUFBSSxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtJQUMxQztJQUNBLFNBQVMsWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDOUIsSUFBSSxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtJQUMxQzs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLFNBQVMsYUFBYSxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUU7SUFDbEMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7SUFDakIsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ3RCLFFBQVEsT0FBTyxDQUFDO0lBQ2hCO0lBQ0EsSUFBSSxJQUFJLE1BQU0sSUFBSSxLQUFLLEVBQUU7SUFDekI7SUFDQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRTtJQUNoQixHQUFHLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM5QztJQUNBLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEIsS0FBSyxNQUFNLElBQUksTUFBTSxJQUFJLE1BQU0sRUFBRTtJQUNqQztJQUNBLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFO0lBQ2hCLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0lBQy9DO0lBQ0EsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwQixLQUFLLE1BQU07SUFDWCxLQUFLLE1BQU0sSUFBSSxLQUFLLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQztJQUM1QztJQUNBLElBQUksT0FBTyxDQUFDO0lBQ1o7OztJQUdBO0lBQ0E7SUFDQTtJQUNBLFNBQVMsdUJBQXVCLENBQUMsR0FBRyxFQUFFO0lBQ3RDLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxHQUFHLEdBQUc7SUFDaEQsSUFBSSxJQUFJLEtBQUssR0FBRyxDQUFDLFNBQVMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsRCxJQUFJLElBQUksTUFBTSxHQUFHLENBQUMsVUFBVSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3RELElBQUksT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUM7SUFDMUI7OztJQUdBO0lBQ0E7O0lBRUE7O0lBRUE7O0lBRUE7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBLFNBQVMsd0JBQXdCLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRTtJQUMxQyxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEdBQUcsdUJBQXVCLENBQUMsR0FBRyxDQUFDO0lBQ3REO0lBQ0EsSUFBSSxPQUFPLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksV0FBVyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUM7SUFDMUQ7SUFDQTtJQUNBLFNBQVMscUJBQXFCLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRTtJQUN2QyxJQUFJLE9BQU8sd0JBQXdCLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2hEOzs7O0lBSUE7SUFDQTtJQUNBO0lBQ0EsU0FBUyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUU7SUFDeEMsSUFBSSxPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQztJQUNwQzs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxTQUFTLHVCQUF1QixDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDekMsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7SUFDckIsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7SUFDckI7SUFDQSxJQUFJLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0lBQ2xCLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLENBQUM7SUFDaEQ7SUFDQSxJQUFJLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRTtJQUNqQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDbkQ7SUFDQSxJQUFJLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7SUFDbkM7O0lBRUEsU0FBUyxRQUFRLENBQUMsQ0FBQyxFQUFFO0lBQ3JCLElBQUksT0FBTyxPQUFPLENBQUMsSUFBSSxRQUFRO0lBQy9COztJQUVPLFNBQVMsbUJBQW1CLENBQUMsS0FBSyxDQUFDO0lBQzFDLElBQUksSUFBSSxHQUFHLEdBQUcsS0FBSztJQUNuQixJQUFJLElBQUksR0FBRyxJQUFJLFNBQVMsRUFBRTtJQUMxQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQW9CLENBQUM7SUFDN0M7SUFDQSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0lBQzdCLFFBQVEsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7SUFDM0I7SUFDQSxZQUFZLEdBQUcsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztJQUN4QyxTQUFTLE1BQU07SUFDZixZQUFZLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLHlCQUF5QixDQUFDO0lBQ3RFO0lBQ0EsS0FDQTtJQUNBLElBQUksSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUN6QixRQUFRLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUk7SUFDekMsS0FBSyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDaEMsUUFBUSxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztJQUN2QyxLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUNoQyxRQUFRLEdBQUcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUM3QixLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtJQUMvQixRQUFRLEdBQUcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUI7SUFDQSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUMsR0FBRyxHQUFHO0lBQ2xEO0lBQ0EsSUFBSSxJQUFJLEdBQUcsSUFBSSxTQUFTLElBQUksR0FBRyxJQUFJLElBQUksRUFBRTtJQUN6QyxRQUFRLEdBQUcsR0FBRyxDQUFDLFFBQVE7SUFDdkI7SUFDQSxJQUFJLElBQUksSUFBSSxJQUFJLFNBQVMsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO0lBQzNDLFFBQVEsSUFBSSxHQUFHLFFBQVE7SUFDdkI7SUFDQTtJQUNBLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixFQUFFLEdBQUcsQ0FBQztJQUNoRSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUM7SUFDbkU7SUFDQSxJQUFJLElBQUksR0FBRyxHQUFHLElBQUksRUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLFlBQVksRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDO0lBQzVEO0lBQ0EsSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUU7SUFDckIsUUFBUSxVQUFVLEdBQUcsSUFBSTtJQUN6QixRQUFRLFdBQVcsR0FBRyxJQUFJO0lBQzFCO0lBQ0E7SUFDQSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFO0lBQzFCLFFBQVEsVUFBVSxHQUFHLElBQUk7SUFDekI7SUFDQSxJQUFJLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtJQUMxQixRQUFRLFdBQVcsR0FBRyxJQUFJO0lBQzFCO0lBQ0E7SUFDQSxJQUFJLElBQUksT0FBTyxVQUFVLEtBQUssU0FBUyxFQUFFO0lBQ3pDLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQztJQUNqRCxLQUFLO0lBQ0wsSUFBSSxJQUFJLE9BQU8sV0FBVyxLQUFLLFNBQVMsRUFBRTtJQUMxQyxRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUM7SUFDbEQ7SUFDQSxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUM7SUFDL0M7Ozs7O0lBS08sTUFBTSxRQUFRLEdBQUc7SUFDeEIsSUFBSSxFQUFFLEVBQUUsV0FBVztJQUNuQixJQUFJLEVBQUUsRUFBRSxXQUFXO0lBQ25CLElBQUksRUFBRSxFQUFFLFdBQVc7SUFDbkIsSUFBSSxFQUFFLEVBQUUsV0FBVztJQUNuQixJQUFJLEdBQUcsRUFBRSxZQUFZO0lBQ3JCLElBQUksRUFBRSxFQUFFLFdBQVc7SUFDbkIsSUFBSSxHQUFHLEVBQUUsWUFBWTtJQUNyQixJQUFJLEdBQUcsRUFBRSxZQUFZO0lBQ3JCLElBQUksSUFBSSxFQUFFLGFBQWE7SUFDdkIsSUFBSSxhQUFhLEVBQUU7SUFDbkI7SUFDTyxNQUFNLFFBQVEsR0FBRztJQUN4QixJQUFJLGVBQWUsRUFBRSx3QkFBd0I7SUFDN0MsSUFBSSxZQUFZLEVBQUUscUJBQXFCO0lBQ3ZDLElBQUksV0FBVyxFQUFFLG9CQUFvQjtJQUNyQyxJQUFJLGNBQWMsRUFBRSx1QkFBdUI7SUFDM0MsSUFBSSxVQUFVLEVBQUU7SUFDaEI7O0lDcFBBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRU8sTUFBTSxrQkFBa0IsU0FBUyxpQkFBaUIsQ0FBQzs7SUFFMUQsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUM1QixRQUFRLEtBQUssRUFBRTtJQUNmO0lBQ0EsUUFBUSxJQUFJLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxHQUFHLE9BQU87SUFDcEMsUUFBUSxJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUU7SUFDaEM7SUFDQSxZQUFZLElBQUksQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQztJQUM1QyxTQUFTLE1BQU0sSUFBSSxLQUFLLElBQUksU0FBUyxFQUFFO0lBQ3ZDO0lBQ0EsWUFBWSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUM7SUFDM0IsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0lBQ3JELGdCQUFnQixJQUFJLEVBQUUsUUFBUTtJQUM5QixnQkFBZ0IsSUFBSSxDQUFDO0lBQ3JCLGFBQWEsQ0FBQztJQUNkLFNBQVMsTUFBTTtJQUNmLFlBQVksSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFO0lBQzVCO0lBQ0E7O0lBRUEsSUFBSSxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFO0lBQzVCLFFBQVEsT0FBTyxPQUFPLENBQUMsT0FBTztJQUM5QixhQUFhLElBQUksQ0FBQyxNQUFNO0lBQ3hCLGdCQUFnQixJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUM7SUFDaEQsZ0JBQWdCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtJQUN2QyxhQUFhLENBQUM7SUFDZDs7SUFFQSxJQUFJLFNBQVMsQ0FBQyxHQUFHO0lBQ2pCLFFBQVEsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRTtJQUNsQzs7SUFFQSxJQUFJLElBQUksSUFBSSxDQUFDLEdBQUc7SUFDaEIsUUFBUSxPQUFPLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQztJQUNuQztJQUNBOzs7SUFHQSxTQUFTLFdBQVcsQ0FBQyxLQUFLLEVBQUU7SUFDNUIsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtJQUMvQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUM7SUFDakQ7SUFDQTtJQUNBLElBQUksS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7SUFDOUIsUUFBUSxJQUFJLENBQUMsR0FBRyxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUNoRDtJQUNBO0lBQ0EsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSztJQUN6QixRQUFRLElBQUksS0FBSyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwRCxRQUFRLElBQUksS0FBSyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwRCxRQUFRLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDO0lBQ3pDLEtBQUssQ0FBQztJQUNOO0lBQ0EsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtJQUMzQyxRQUFRLElBQUksU0FBUyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkUsUUFBUSxJQUFJLFFBQVEsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUQ7SUFDQSxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsRUFBRTtJQUMvQyxZQUFZLE1BQU0sSUFBSSxLQUFLLENBQUMsNkJBQTZCLENBQUM7SUFDMUQ7SUFDQTtJQUNBLElBQUksT0FBTyxLQUFLO0lBQ2hCOztJQ3hFQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTtJQUNBO0lBQ08sU0FBUyxhQUFhLEVBQUUsTUFBTSxFQUFFO0lBQ3ZDLElBQUksTUFBTSxHQUFHLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3JELElBQUksT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUM7SUFDckM7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7O0lBRU8sU0FBUyxjQUFjLEVBQUUsTUFBTSxFQUFFO0lBQ3hDLElBQUksTUFBTSxJQUFJLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RELElBQUksT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUM7SUFDckM7Ozs7SUFJTyxNQUFNLGVBQWUsQ0FBQzs7O0lBRzdCO0lBQ0E7SUFDQTtJQUNBLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtJQUNuQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUM7SUFDMUM7O0lBRUEsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO0lBQ2xCLFFBQVEsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUU7SUFDeEMsWUFBWSxNQUFNLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ2hDO0lBQ0EsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtJQUNwQyxZQUFZLE1BQU0sSUFBSSxLQUFLLENBQUMsMkJBQTJCLENBQUM7SUFDeEQ7SUFDQSxRQUFRLE9BQU8sTUFBTTtJQUNyQjs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLEtBQUssR0FBRztJQUNaLFFBQVEsSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDekQsUUFBUSxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxLQUFLO0lBQzNEOztJQUVBO0lBQ0E7SUFDQTtJQUNBLElBQUksSUFBSSxHQUFHO0lBQ1gsUUFBUSxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDdkQsUUFBUSxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUc7SUFDckQ7OztJQUdBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLFlBQVksQ0FBQyxNQUFNLEVBQUU7SUFDekIsUUFBUSxNQUFNLEtBQUssR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDO0lBQzVDLFFBQVEsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksUUFBUSxFQUFFO0lBQ2xDLFlBQVksT0FBTyxTQUFTO0lBQzVCO0lBQ0EsUUFBUSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0lBQ2pDOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUU7SUFDeEIsUUFBUSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQztJQUNyRCxRQUFRLElBQUksV0FBVyxJQUFJLFNBQVMsRUFBRTtJQUN0QyxZQUFZLE9BQU8sU0FBUztJQUM1QjtJQUNBLFFBQVEsSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7SUFDM0M7SUFDQSxZQUFZLE9BQU8sV0FBVztJQUM5QjtJQUNBO0lBQ0E7SUFDQSxRQUFRLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUM7SUFDNUM7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRTtJQUN4QixRQUFRLE1BQU0sSUFBSSxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUM7SUFDMUMsUUFBUSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRTtJQUNsQyxZQUFZLE9BQU8sU0FBUztJQUM1QjtJQUNBLFFBQVEsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2pDOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUU7SUFDeEIsUUFBUSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQztJQUNwRCxRQUFRLElBQUksV0FBVyxJQUFJLFNBQVMsRUFBRTtJQUN0QyxZQUFZLE9BQU8sU0FBUztJQUM1QjtJQUNBLFFBQVEsSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7SUFDM0M7SUFDQSxZQUFZLE9BQU8sV0FBVztJQUM5QjtJQUNBO0lBQ0E7SUFDQSxRQUFRLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUM7SUFDNUM7O0lBRUEsSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFO0lBQ3JCLFFBQVEsT0FBTyxJQUFJLGNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDO0lBQ2hEOztJQUVBOzs7SUFHQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLE1BQU0sY0FBYyxDQUFDOztJQUVyQixJQUFJLFdBQVcsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUNuQyxRQUFRLElBQUk7SUFDWixZQUFZLEtBQUssQ0FBQyxDQUFDLFFBQVE7SUFDM0IsWUFBWSxJQUFJLENBQUMsUUFBUTtJQUN6QixZQUFZLFlBQVksQ0FBQztJQUN6QixTQUFTLEdBQUcsT0FBTztJQUNuQixRQUFRLElBQUksS0FBSyxHQUFHLElBQUksRUFBRTtJQUMxQixZQUFZLE1BQU0sSUFBSSxLQUFLLEVBQUUsZ0NBQWdDLEVBQUUsS0FBSyxFQUFFLElBQUk7SUFDMUU7SUFDQSxRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztJQUMzQixRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ2hDLFFBQVEsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDOUIsUUFBUSxJQUFJLENBQUMsYUFBYSxHQUFHLFlBQVksQ0FBQztJQUMxQyxRQUFRLElBQUksQ0FBQyxRQUFRO0lBQ3JCLFFBQVEsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLO0lBQzFCOztJQUVBLElBQUksSUFBSSxHQUFHO0lBQ1gsUUFBUSxJQUFJLE9BQU87SUFDbkIsUUFBUSxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7SUFDeEIsWUFBWSxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQy9DO0lBQ0EsUUFBUSxJQUFJLElBQUksQ0FBQyxRQUFRLElBQUksU0FBUyxFQUFFO0lBQ3hDO0lBQ0EsWUFBWSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDM0QsU0FBUztJQUNUO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsUUFBUSxPQUFPLElBQUksRUFBRTtJQUNyQixZQUFZLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUTs7SUFFbkM7SUFDQSxZQUFZLElBQUksR0FBRyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBQztJQUM1RCxZQUFZLElBQUksUUFBUSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFO0lBQzlDLGdCQUFnQixPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ25EOztJQUVBLFlBQVksTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxRQUFROztJQUV0RDtJQUNBO0lBQ0E7SUFDQTtJQUNBLFlBQVksTUFBTSxVQUFVO0lBQzVCLGdCQUFnQixPQUFPLElBQUksS0FBSztJQUNoQyxnQkFBZ0IsSUFBSSxDQUFDLGFBQWEsSUFBSSxLQUFLO0lBQzNDLGdCQUFnQixPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSTtJQUN6QyxhQUFhO0lBQ2IsWUFBWSxJQUFJLFVBQVUsRUFBRTtJQUM1QixnQkFBZ0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUM7SUFDakUsZ0JBQWdCLElBQUksT0FBTyxJQUFJLFNBQVMsRUFBRTtJQUMxQyxvQkFBb0IsT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLElBQUk7SUFDdEQ7SUFDQSxnQkFBZ0I7SUFDaEI7O0lBRUEsWUFBWSxJQUFJLE9BQU8sRUFBRTtJQUN6QixnQkFBZ0IsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJO0lBQ2pDLGFBQWEsTUFBTTtJQUNuQjtJQUNBLGdCQUFnQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQztJQUNqRSxnQkFBZ0IsSUFBSSxPQUFPLElBQUksU0FBUyxFQUFFO0lBQzFDLG9CQUFvQixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUk7SUFDckM7SUFDQTtJQUNBLFlBQVksT0FBTyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUM5QztJQUNBOztJQUVBLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUc7SUFDeEIsUUFBUSxPQUFPLElBQUk7SUFDbkI7SUFDQTs7SUN2UkE7SUFDQTtJQUNBOztJQUVBOztJQUVBO0lBQ0E7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTs7OztJQUlBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTs7SUFFQSxNQUFNLEtBQUssQ0FBQzs7SUFFWixDQUFDLFdBQVcsQ0FBQyxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFO0lBQ3hDLEVBQUUsT0FBTyxHQUFHLE9BQU8sSUFBSTtJQUN2QixFQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUztJQUM1QixFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSTtJQUNsQixFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLFNBQVMsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDLElBQUk7SUFDakUsRUFBRSxJQUFJLENBQUMsYUFBYSxHQUFHLEVBQUU7SUFDekI7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUU7SUFDL0IsRUFBRSxJQUFJLENBQUMsUUFBUSxJQUFJLE9BQU8sUUFBUSxLQUFLLFVBQVUsRUFBRTtJQUNuRCxHQUFHLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLEVBQUUsUUFBUSxDQUFDO0lBQ3ZEO0lBQ0EsRUFBRSxNQUFNLEdBQUcsR0FBRyxJQUFJLFlBQVksQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQztJQUN2RCxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUM5QjtJQUNBLEtBQUssSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxJQUFJLEVBQUU7SUFDaEMsTUFBTSxHQUFHLENBQUMsWUFBWSxHQUFHLElBQUk7SUFDN0IsTUFBTSxJQUFJLElBQUksR0FBRyxJQUFJO0lBQ3JCLE1BQU0sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZO0lBQ3pDLE9BQU8sTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRTtJQUMxRSxPQUFPLEdBQUcsQ0FBQyxZQUFZLEdBQUcsS0FBSztJQUMvQixPQUFPLEtBQUssSUFBSSxJQUFJLElBQUksS0FBSyxFQUFFO0lBQy9CLFFBQVEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUM7SUFDdkM7SUFDQSxPQUFPLENBQUM7SUFDUjtJQUNBLEVBQUUsT0FBTztJQUNUOztJQUVBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRTtJQUM1QixFQUFFLElBQUksS0FBSyxFQUFFLEdBQUc7SUFDaEIsRUFBRSxLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRTtJQUMxQjtJQUNBLEdBQUcsSUFBSSxHQUFHLENBQUMsVUFBVSxFQUFFO0lBQ3ZCLElBQUk7SUFDSjtJQUNBLEdBQUcsS0FBSyxHQUFHO0lBQ1gsSUFBSSxHQUFHLEVBQUUsSUFBSSxDQUFDLFNBQVM7SUFDdkIsSUFBSSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7SUFDbkIsSUFBSSxHQUFHLEVBQUUsR0FBRztJQUNaLElBQUksSUFBSSxFQUFFO0lBQ1Y7SUFDQSxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTO0lBQ2xDLEdBQUcsSUFBSTtJQUNQLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUM7SUFDdkMsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFO0lBQ2pCLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ2hFO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRTtJQUNsQixFQUFFLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQztJQUMzQyxFQUFFLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFO0lBQ2hCLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUNwQyxHQUFHLEdBQUcsQ0FBQyxTQUFTLEVBQUU7SUFDbEI7SUFDQTtJQUNBOzs7SUFHQTtJQUNBO0lBQ0E7O0lBRUEsTUFBTSxZQUFZLENBQUM7O0lBRW5CLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO0lBQ3ZDLEVBQUUsT0FBTyxHQUFHLE9BQU8sSUFBSTtJQUN2QixFQUFFLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSztJQUNwQixFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUk7SUFDeEIsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHO0lBQ2xCLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssU0FBUyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJO0lBQzNFLEVBQUUsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLO0lBQzNCLEVBQUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLO0lBQ3pCLEVBQUUsSUFBSSxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUMsR0FBRztJQUN4Qjs7SUFFQSxDQUFDLFNBQVMsR0FBRztJQUNiLEVBQUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJO0lBQ3hCLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxTQUFTO0lBQzNCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO0lBQzlCO0lBQ0E7OztJQUdBOztJQUVBOztJQUVBOztJQUVBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTs7SUFFTyxTQUFTLGdCQUFnQixFQUFFLE1BQU0sRUFBRTtJQUMxQyxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsRUFBRTtJQUN2QyxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsR0FBRyxFQUFFO0lBQzlCLENBQUMsT0FBTyxNQUFNO0lBQ2Q7O0lBR0E7SUFDQTs7SUFFQTtJQUNBOztJQUVPLFNBQVMsaUJBQWlCLENBQUMsVUFBVSxFQUFFOztJQUU5QyxDQUFDLFNBQVMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRTtJQUN6QyxFQUFFLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO0lBQ3BELEVBQUUsSUFBSSxLQUFLLElBQUksU0FBUyxFQUFFO0lBQzFCLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUM7SUFDM0M7SUFDQSxFQUFFLE9BQU8sS0FBSztJQUNkOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLENBQUMsU0FBUyxjQUFjLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRTtJQUN4QztJQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO0lBQzFDLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxJQUFJLENBQUM7SUFDakQ7SUFDQSxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDcEU7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRTtJQUN0QyxFQUFFLE9BQU8sZ0JBQWdCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDO0lBQ2xFO0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLENBQUMsU0FBUyxHQUFHLENBQUMsR0FBRyxFQUFFO0lBQ25CLEVBQUUsT0FBTyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUM7SUFDMUQ7O0lBR0EsQ0FBQyxTQUFTLHFCQUFxQixDQUFDLElBQUksRUFBRTtJQUN0QyxFQUFFLE9BQU8sZ0JBQWdCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLGFBQWE7SUFDbkQ7Ozs7SUFJQTtJQUNBOztJQUVBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxTQUFTLGtCQUFrQixDQUFDLFVBQVUsRUFBRTtJQUN6QyxFQUFFLElBQUksVUFBVSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDOUIsR0FBRztJQUNIOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxFQUFFLElBQUksWUFBWSxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEtBQUs7SUFDOUMsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLElBQUk7SUFDMUIsR0FBRyxJQUFJLEVBQUUsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDO0lBQ3hDLEdBQUcsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxZQUFZLElBQUksS0FBSyxDQUFDO0lBQ3ZFLEdBQUcsT0FBTyxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0lBQzFCLEdBQUcsRUFBRSxJQUFJLENBQUM7O0lBRVY7SUFDQSxFQUFFLE1BQU0sR0FBRyxHQUFHLFlBQVksQ0FBQyxNQUFNO0lBQ2pDLEVBQUUsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLGlCQUFpQjtJQUNwQyxFQUFFLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNO0lBQy9DO0lBQ0EsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxHQUFHLE9BQU8sR0FBRyxHQUFHO0lBQy9DO0lBQ0EsRUFBRSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFO0lBQzVCLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDO0lBQ25DO0lBQ0E7SUFDQSxFQUFFLElBQUksT0FBTyxJQUFJLENBQUMsRUFBRTtJQUNwQixHQUFHLElBQUksSUFBSSxHQUFHLElBQUk7SUFDbEIsR0FBRyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVc7SUFDckMsSUFBSSxLQUFLLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtJQUN6RDtJQUNBLEtBQUssRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQztJQUNsQztJQUNBLElBQUksSUFBSSxDQUFDLGlCQUFpQixHQUFHLEVBQUU7SUFDL0IsSUFBSSxDQUFDO0lBQ0w7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxDQUFDLFNBQVMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTtJQUM1QyxFQUFFLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJO0lBQ25ELEdBQUcsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUM7SUFDdEIsR0FBRyxDQUFDLENBQUM7SUFDTDs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxDQUFDLFNBQVMsZUFBZSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUU7SUFDdEMsRUFBRSxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDaEQ7O0lBRUEsQ0FBQyxVQUFVLENBQUMsY0FBYyxHQUFHLGNBQWM7SUFDM0MsQ0FBQyxVQUFVLENBQUMsZUFBZSxHQUFHLGVBQWU7SUFDN0MsQ0FBQyxVQUFVLENBQUMsb0JBQW9CLEdBQUcsb0JBQW9CO0lBQ3ZELENBQUMsVUFBVSxDQUFDLGtCQUFrQixHQUFHLGtCQUFrQjtJQUNuRCxDQUFDLFVBQVUsQ0FBQyxxQkFBcUIsR0FBRyxxQkFBcUI7SUFDekQsQ0FBQyxVQUFVLENBQUMsRUFBRSxHQUFHLEVBQUU7SUFDbkIsQ0FBQyxVQUFVLENBQUMsR0FBRyxHQUFHLEdBQUc7SUFDckI7SUFNQTtJQUNBOztJQUVBO0lBQ0E7O0lBRU8sTUFBTSxhQUFhLENBQUM7O0lBRTNCLENBQUMsV0FBVyxDQUFDLENBQUMsS0FBSyxFQUFFO0lBQ3JCLEVBQUUsZ0JBQWdCLENBQUMsSUFBSSxDQUFDO0lBQ3hCLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLO0lBQ3JCLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDNUM7O0lBRUEsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUU7SUFDN0IsRUFBRSxJQUFJLElBQUksSUFBSSxRQUFRLEVBQUU7SUFDeEIsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUN2QjtJQUNBOztJQUVBLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNsQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsS0FBSyxFQUFFO0lBQ25CLEVBQUUsSUFBSSxLQUFLLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtJQUM1QixHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztJQUN0QixHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQztJQUN4QztJQUNBO0lBQ0E7SUFDQSxpQkFBaUIsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDOztJQ2hVMUM7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxNQUFNLElBQUksR0FBRyxTQUFTO0lBQ3RCLE1BQU0sTUFBTSxHQUFHLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDOztJQUVuQixTQUFTLGFBQWEsRUFBRSxNQUFNLEVBQUU7SUFDdkMsSUFBSSxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtJQUNuQzs7SUFFTyxTQUFTLGNBQWMsRUFBRSxVQUFVLEVBQUU7O0lBRTVDLElBQUksU0FBUyxRQUFRLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDNUMsUUFBUSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLE9BQU87SUFDcEMsUUFBUSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0QyxRQUFRLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFO0lBQzFCLFlBQVksSUFBSSxDQUFDLEtBQUs7SUFDdEIsWUFBWSxPQUFPO0lBQ25CLFlBQVksTUFBTSxFQUFFLFNBQVM7SUFDN0IsWUFBWSxPQUFPLEVBQUU7SUFDckIsU0FBUyxDQUFDOztJQUVWO0lBQ0EsUUFBUSxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7SUFDOUMsWUFBWSxHQUFHLEVBQUUsWUFBWTtJQUM3QixnQkFBZ0IsT0FBTyxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU07SUFDL0MsYUFBYTtJQUNiLFlBQVksR0FBRyxFQUFFLFVBQVUsTUFBTSxFQUFFO0lBQ25DLGdCQUFnQixJQUFJLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUU7SUFDM0Msb0JBQW9CLE1BQU0sR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUM7SUFDcEU7SUFDQSxnQkFBZ0IsSUFBSSxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLEVBQUU7SUFDeEQsb0JBQW9CLElBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQztJQUM5RDtJQUNBO0lBQ0EsU0FBUyxDQUFDO0lBQ1Y7O0lBRUEsSUFBSSxTQUFTLE9BQU8sQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFOztJQUV2QyxRQUFRLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUNyQyxRQUFRLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUTs7SUFFdEMsUUFBUSxJQUFJLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFO0lBQzFDLFlBQVksTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLHNCQUFzQixDQUFDLENBQUM7SUFDaEU7O0lBRUEsUUFBUSxNQUFNLFFBQVEsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksTUFBTSxHQUFHLENBQUMsTUFBTSxDQUFDOztJQUVwRTtJQUNBLFFBQVEsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7SUFDdEMsWUFBWSxLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRTtJQUM3RCxnQkFBZ0IsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3JELGFBQWE7SUFDYjtJQUNBLFFBQVEsS0FBSyxDQUFDLE9BQU8sR0FBRyxFQUFFOztJQUUxQjtJQUNBLFFBQVEsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFNO0lBQzdCLFFBQVEsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJOztJQUV6QjtJQUNBLFFBQVEsSUFBSSxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFO0lBQ3RDLFlBQVksTUFBTSxPQUFPLEdBQUcsVUFBVSxJQUFJLEVBQUU7SUFDNUMsZ0JBQWdCLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQztJQUN4RCxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztJQUN4QixZQUFZLEtBQUssTUFBTSxDQUFDLElBQUksUUFBUSxFQUFFO0lBQ3RDLGdCQUFnQixLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzNEO0lBQ0EsWUFBWSxJQUFJLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN4RDtJQUNBOztJQUVBLElBQUksTUFBTSxHQUFHLEdBQUcsRUFBRTtJQUNsQixJQUFJLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsUUFBUTtJQUN0QyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsT0FBTztJQUNyQyxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQztJQUNsQzs7SUN0RkE7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVPLE1BQU0sV0FBVyxDQUFDOztJQUV6QixDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUU7SUFDbEIsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLEdBQUc7SUFDakI7O0lBRUEsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQzs7SUFFN0I7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7SUFDbEIsS0FBSyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDO0lBQ3ZDOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7SUFDbEIsUUFBUSxJQUFJLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRTtJQUN0RCxZQUFZLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDO0lBQ2xELFNBQVM7SUFDVCxRQUFRLE9BQU8sQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDO0lBQ3hEO0lBQ0E7OztJQTBCQTtJQUNBO0lBQ0E7O0lBRU8sTUFBTSxhQUFhLFNBQVMsV0FBVyxDQUFDOztJQUUvQyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFO0lBQ3hCLFFBQVEsS0FBSyxDQUFDLEdBQUcsQ0FBQztJQUNsQixFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSTtJQUNwQjs7SUFFQSxDQUFDLEtBQUssR0FBRztJQUNULFFBQVEsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxLQUFLO0lBQ2pEO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVPLE1BQU0sYUFBYSxTQUFTLFdBQVcsQ0FBQztJQUMvQztJQUNBLElBQUksV0FBVyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUU7SUFDM0IsUUFBUSxLQUFLLENBQUMsR0FBRyxDQUFDO0lBQ2xCLFFBQVEsTUFBTTtJQUNkLFlBQVksUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3pCLFlBQVksUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3pCLFlBQVksWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzdCLFlBQVksU0FBUyxDQUFDLEVBQUUsQ0FBQztJQUN6QixTQUFTLEdBQUcsSUFBSTtJQUNoQjtJQUNBLFFBQVEsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLEVBQUUsRUFBRTtJQUN2QyxZQUFZLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFO0lBQzNCLFlBQVksT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3pDLFNBQVM7SUFDVCxRQUFRLElBQUksQ0FBQyxTQUFTLEdBQUcsVUFBVSxFQUFFLEVBQUU7SUFDdkMsWUFBWSxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRTtJQUMzQixZQUFZLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQzVCO0lBQ0EsUUFBUSxJQUFJLENBQUMsU0FBUyxHQUFHLFVBQVUsRUFBRSxFQUFFO0lBQ3ZDLFlBQVksT0FBTyxFQUFFO0lBQ3JCO0lBQ0E7O0lBRUEsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO0lBQ2xCLFFBQVEsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7SUFDeEMsUUFBUSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztJQUN4QyxRQUFRLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0lBQ3hDLFFBQVEsT0FBTztJQUNmLFlBQVksUUFBUSxFQUFFLEdBQUc7SUFDekIsWUFBWSxRQUFRLEVBQUUsR0FBRztJQUN6QixZQUFZLFlBQVksRUFBRSxHQUFHO0lBQzdCLFlBQVksU0FBUyxFQUFFLE1BQU07SUFDN0IsWUFBWSxLQUFLLEVBQUUsR0FBRztJQUN0QixZQUFZLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQzFDO0lBQ0E7SUFDQTs7O0lBR0E7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxTQUFTLE1BQU0sRUFBRSxFQUFFLEVBQUU7SUFDckIsSUFBSSxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzFCO0lBQ0EsU0FBUyxPQUFPLEVBQUUsRUFBRSxFQUFFO0lBQ3RCLElBQUksT0FBTyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDN0I7SUFDQSxTQUFTLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDeEIsSUFBSSxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUU7SUFDakIsUUFBUSxPQUFPLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQztJQUNqQyxLQUFLLE1BQU07SUFDWCxRQUFRLE9BQU8sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQzdDO0lBQ0E7O0lBRU8sTUFBTSxpQkFBaUIsU0FBUyxXQUFXLENBQUM7O0lBRW5ELENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUU7SUFDeEIsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDO0lBQ1osUUFBUSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsR0FBRyxJQUFJO0lBQ25DLFFBQVEsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDOztJQUUzQztJQUNBLFFBQVEsSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUM7SUFDbEMsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLFVBQVUsRUFBRSxFQUFFO0lBQ3BDO0lBQ0E7SUFDQTtJQUNBLFlBQVksRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFO0lBQ3hCLFlBQVksRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztJQUNyQztJQUNBLFlBQVksSUFBSSxNQUFNLElBQUksU0FBUyxFQUFFO0lBQ3JDLGdCQUFnQixFQUFFLEdBQUcsTUFBTSxDQUFDLEVBQUUsQ0FBQztJQUMvQixhQUFhLE1BQU0sSUFBSSxNQUFNLElBQUksVUFBVSxFQUFFO0lBQzdDLGdCQUFnQixFQUFFLEdBQUcsT0FBTyxDQUFDLEVBQUUsQ0FBQztJQUNoQyxhQUFhLE1BQU0sSUFBSSxNQUFNLElBQUksYUFBYSxFQUFFO0lBQ2hELGdCQUFnQixFQUFFLEdBQUcsU0FBUyxDQUFDLEVBQUUsQ0FBQztJQUNsQztJQUNBO0lBQ0EsWUFBWSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ2hDLFlBQVksRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNoQyxZQUFZLE9BQU8sRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFO0lBQ2xDO0lBQ0E7O0lBRUEsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFO0lBQ2YsUUFBUSxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRO0lBQ2pFO0lBQ0E7Ozs7SUFJQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLFNBQVNDLGFBQVcsQ0FBQyxNQUFNLEVBQUU7O0lBRTdCLElBQUksSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtJQUMzQixRQUFRLE9BQU8sU0FBUyxZQUFZLElBQUksQ0FBQyxPQUFPLFNBQVMsQ0FBQztJQUMxRCxLQUFLLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUNuQyxRQUFRLE9BQU8sU0FBUyxZQUFZLElBQUksQ0FBQyxPQUFPLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM3RDs7SUFFQTtJQUNBLElBQUksTUFBTSxZQUFZLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNoRTtJQUNBLElBQUksT0FBTyxTQUFTLFlBQVksQ0FBQyxNQUFNLEVBQUU7SUFDekM7SUFDQSxNQUFNLElBQUksTUFBTSxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtJQUN4QyxRQUFRLE1BQU0sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQztJQUNqRCxRQUFRLE1BQU0sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQztJQUNqRCxRQUFRLE9BQU8sTUFBTSxJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sS0FBSyxNQUFNLEdBQUcsTUFBTSxDQUFDLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxDQUFDO0lBQ3RGO0lBQ0E7SUFDQTtJQUNBLE1BQU0sSUFBSSxNQUFNLElBQUksWUFBWSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7SUFDOUQsUUFBUSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUN2RSxRQUFRLE1BQU0sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsWUFBWSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZFLFFBQVEsT0FBTyxNQUFNLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxLQUFLLE1BQU0sR0FBRyxNQUFNLENBQUMsSUFBSSxPQUFPLEdBQUcsT0FBTyxDQUFDLENBQUM7SUFDdEY7SUFDQTtJQUNBO0lBQ0EsTUFBTSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7SUFDeEQsUUFBUSxJQUFJLE1BQU0sSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxJQUFJLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7SUFDOUUsVUFBVSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDbkQsVUFBVSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZEO0lBQ0EsVUFBVSxPQUFPLE1BQU0sSUFBSSxDQUFDLE1BQU0sR0FBRyxPQUFPLEtBQUssTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsQ0FBQztJQUN4RjtJQUNBO0lBQ0E7SUFDQTtJQUNBLE1BQU0sT0FBTyxTQUFTO0lBQ3RCLEtBQUs7SUFDTDtJQUNBOztJQUVPLE1BQU0sb0JBQW9CLFNBQVMsV0FBVyxDQUFDOztJQUV0RCxJQUFJLFdBQVcsQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFO0lBQzdCLFFBQVEsS0FBSyxDQUFDLEdBQUcsQ0FBQztJQUNsQjtJQUNBLFFBQVEsSUFBSSxDQUFDLE1BQU0sR0FBR0EsYUFBVyxDQUFDLE1BQU0sQ0FBQztJQUN6Qzs7SUFFQSxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7SUFDbEIsUUFBUSxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQztJQUN6RDtJQUNBOztJQ3ZRQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOztJQUVBLE1BQU0sS0FBSyxHQUFHLFlBQVk7SUFDMUIsSUFBSSxPQUFPLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNO0lBQ25DOztJQUVBLE1BQU0sS0FBSyxHQUFHLFlBQVk7SUFDMUIsSUFBSSxPQUFPLElBQUksSUFBSSxFQUFFLENBQUMsTUFBTTtJQUM1Qjs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRU8sTUFBTSxLQUFLLEdBQUcsWUFBWTtJQUNqQyxJQUFJLE1BQU0sUUFBUSxHQUFHLEtBQUssRUFBRTtJQUM1QixJQUFJLE1BQU0sUUFBUSxHQUFHLEtBQUssRUFBRTtJQUM1QixJQUFJLE9BQU87SUFDWCxRQUFRLEdBQUcsRUFBRSxZQUFZO0lBQ3pCLFlBQVksT0FBTyxRQUFRLElBQUksS0FBSyxFQUFFLEdBQUcsUUFBUTtJQUNqRDtJQUNBO0lBQ0EsQ0FBQyxFQUFFOzs7SUFHSDtJQUNPLFNBQVMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7SUFDMUIsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQzVCO0lBRU8sU0FBUyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRTtJQUNoQyxJQUFJLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLElBQUk7SUFDL0IsSUFBSSxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQztJQUN4QixJQUFJLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ2pCOzs7SUFHQTtJQUNBO0lBQ0E7O0lBRU8sU0FBUyxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxJQUFJLEdBQUcsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDekQsSUFBSSxNQUFNLE1BQU0sR0FBRyxFQUFFO0lBQ3JCLElBQUksTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPO0lBQ3ZDLElBQUksSUFBSSxJQUFJLEtBQUssQ0FBQyxFQUFFO0lBQ3BCLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQztJQUMvQztJQUNBLElBQUksSUFBSSxLQUFLLEdBQUcsR0FBRyxFQUFFO0lBQ3JCLFFBQVEsS0FBSyxJQUFJLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFO0lBQ2hELFVBQVUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDeEI7SUFDQSxLQUFLLE1BQU0sSUFBSSxLQUFLLEdBQUcsR0FBRyxFQUFFO0lBQzVCLFFBQVEsS0FBSyxJQUFJLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFO0lBQ2hELFVBQVUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDeEI7SUFDQTtJQUNBLElBQUksSUFBSSxXQUFXLEVBQUU7SUFDckIsUUFBUSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUN4QjtJQUNBLElBQUksT0FBTyxNQUFNO0lBQ2pCOzs7SUFHQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVPLFNBQVMsT0FBTyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDN0QsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxHQUFHLE9BQU8sQ0FBQztJQUN6QyxJQUFJLElBQUksU0FBUyxJQUFJLFNBQVMsRUFBRTtJQUNoQyxRQUFRLElBQUksS0FBSyxHQUFHLFNBQVMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDeEQsUUFBUSxJQUFJLE9BQU8sR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUM3RCxRQUFRLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQztJQUN2QyxLQUFLLE1BQU0sSUFBSSxTQUFTLElBQUksU0FBUyxFQUFFO0lBQ3ZDLFFBQVEsT0FBTyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQztJQUNoRTtJQUNBO0lBQ0EsSUFBSSxJQUFJLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO0lBQzVCLFFBQVEsT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFNO0lBQ3REO0lBQ0E7SUFDQSxJQUFJLElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDekIsSUFBSSxPQUFPLENBQUMsR0FBRyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDOUI7O0lDNUZBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7OztJQUdBO0lBQ0EsU0FBUyxhQUFhLENBQUMsSUFBSSxFQUFFO0lBQzdCLElBQUksT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN0Qjs7O0lBYU8sTUFBTSxpQkFBaUIsU0FBUyxlQUFlLENBQUM7O0lBRXZELElBQUksV0FBVyxDQUFDLEdBQUcsRUFBRTtJQUNyQixRQUFRLEtBQUssRUFBRTtJQUNmLFFBQVEsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHO0lBQ3ZCOztJQUVBLElBQUksSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQzs7O0lBR2pDLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtJQUNuQixRQUFRLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUNuQyxRQUFRLElBQUksSUFBSSxHQUFHLFNBQVM7SUFDNUIsUUFBUSxJQUFJLFVBQVUsR0FBRyxTQUFTO0lBQ2xDLFFBQVEsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUU7O0lBRXpDO0lBQ0EsUUFBUSxJQUFJLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLGFBQWEsQ0FBQztJQUN0RSxRQUFRLElBQUksS0FBSyxFQUFFO0lBQ25CO0lBQ0E7SUFDQSxZQUFZLElBQUksR0FBRyxLQUFLLENBQUMsR0FBRztJQUM1QixZQUFZLElBQUksUUFBUSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxFQUFFO0lBQzVELGdCQUFnQixVQUFVLEdBQUc7SUFDN0I7SUFDQTtJQUNBLFFBQVEsSUFBSSxVQUFVLElBQUksU0FBUyxFQUFFO0lBQ3JDO0lBQ0EsWUFBWSxJQUFJLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDL0IsWUFBWSxJQUFJLElBQUksSUFBSSxTQUFTLEVBQUU7SUFDbkMsZ0JBQWdCLElBQUksUUFBUSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxFQUFFO0lBQ2hFLG9CQUFvQixVQUFVLEdBQUcsR0FBRyxDQUFDLENBQUM7SUFDdEM7SUFDQSxhQUFhO0lBQ2I7O0lBRUE7SUFDQTtJQUNBO0lBQ0EsUUFBUSxJQUFJLFVBQVUsSUFBSSxTQUFTLEVBQUU7SUFDckMsWUFBWSxJQUFJLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQztJQUNwQyxZQUFZLE1BQU0sQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ2hFLFlBQVksT0FBTztJQUNuQixnQkFBZ0IsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDO0lBQzlCLGdCQUFnQixHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUc7SUFDN0IsZ0JBQWdCLElBQUksRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUM7SUFDaEQsZ0JBQWdCLEtBQUssRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLO0lBQ2hEO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQSxRQUFRLElBQUksR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUMzQixRQUFRLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQ2pDLFFBQVEsSUFBSSxJQUFJLElBQUksU0FBUyxFQUFFO0lBQy9CLFlBQVksSUFBSSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0RDtJQUNBO0lBQ0EsUUFBUSxJQUFJLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQztJQUN6QixRQUFRLElBQUksS0FBSyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUNqQyxRQUFRLElBQUksSUFBSSxJQUFJLFNBQVMsRUFBRTtJQUMvQixZQUFZLEtBQUssR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkQ7SUFDQTtJQUNBLFFBQVEsSUFBSSxHQUFHLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDO0lBQzVDLFFBQVEsSUFBSSxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDOztJQUUvQyxRQUFRLE9BQU87SUFDZixZQUFZLE1BQU0sRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUs7SUFDbkMsWUFBWSxHQUFHLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsSUFBSTtJQUNsRCxTQUFTO0lBQ1Q7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBOztJQUVBLFNBQVMsVUFBVSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFOztJQUU3QyxJQUFJLFNBQVMsa0JBQWtCLENBQUMsRUFBRSxFQUFFO0lBQ3BDLFFBQVEsT0FBTyxFQUFFO0lBQ2pCO0lBQ0E7SUFDQSxJQUFJLElBQUksSUFBSSxHQUFHLENBQUM7SUFDaEIsQ0FBQyxJQUFJLEtBQUssR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUM7SUFDM0IsQ0FBQyxVQUFVLEdBQUcsVUFBVSxJQUFJLGtCQUFrQjtJQUM5QyxDQUFDLE9BQU8sSUFBSSxJQUFJLEtBQUssRUFBRTtJQUN2QixFQUFFLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEdBQUcsS0FBSyxJQUFJLENBQUMsQ0FBQztJQUM1QyxFQUFFLElBQUksU0FBUyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDdEMsRUFBRSxJQUFJLFNBQVMsS0FBSyxNQUFNLEVBQUU7SUFDNUIsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3RCLEdBQUcsTUFBTSxJQUFJLFNBQVMsR0FBRyxNQUFNLEVBQUU7SUFDakMsS0FBSyxJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztJQUNwQixHQUFHLE1BQU07SUFDVCxLQUFLLEtBQUssR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCO0lBQ0E7SUFDQSxHQUFHLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDeEI7O0lDcklBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVPLE1BQU0sS0FBSyxDQUFDOztJQUVuQixJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO0lBQzVCLFFBQVEsTUFBTSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsR0FBRyxPQUFPO0lBQy9DLFFBQVEsTUFBTSxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsR0FBRyxPQUFPO0lBQzlDO0lBQ0EsUUFBUUYsZUFBc0IsQ0FBQyxJQUFJLENBQUM7SUFDcEM7SUFDQTtJQUNBO0lBQ0EsUUFBUUcsZ0JBQXNCLENBQUMsSUFBSSxDQUFDO0lBQ3BDLFFBQVEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7O0lBRWxEO0lBQ0EsUUFBUSxJQUFJLENBQUMsTUFBTTtJQUNuQjtJQUNBLFFBQVEsSUFBSSxDQUFDLFdBQVcsR0FBRyxVQUFVO0lBQ3JDLFFBQVEsSUFBSSxDQUFDLGFBQWE7SUFDMUIsUUFBUSxJQUFJLENBQUMsY0FBYyxHQUFHLEVBQUU7O0lBRWhDO0lBQ0EsUUFBUSxJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQzs7SUFFbkQ7O0lBRUE7SUFDQSxJQUFJLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksQ0FBQyxNQUFNO0lBQ3BDLElBQUksSUFBSSxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQUs7O0lBRTFDO0lBQ0EsSUFBSSxJQUFJLFlBQVksQ0FBQyxHQUFHO0lBQ3hCLFFBQVEsT0FBTyxJQUFJLENBQUMsYUFBYTtJQUNqQzs7SUFFQTtJQUNBLElBQUksSUFBSSxLQUFLLENBQUMsR0FBRztJQUNqQixRQUFRLElBQUksSUFBSSxDQUFDLGFBQWEsSUFBSSxTQUFTLEVBQUU7SUFDN0MsWUFBWSxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7SUFDM0Q7SUFDQSxRQUFRLE9BQU8sSUFBSSxDQUFDLGFBQWE7SUFDakM7O0lBRUEsSUFBSSxRQUFRLENBQUMsR0FBRztJQUNoQixRQUFRLE1BQU0sS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7SUFDaEQsUUFBUSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDdkMsUUFBUSxPQUFPLEtBQUs7SUFDcEI7O0lBRUEsSUFBSSxXQUFXLEdBQUc7SUFDbEIsUUFBUSxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDaEQsWUFBWSxLQUFLLENBQUMsS0FBSyxFQUFFO0lBQ3pCO0lBQ0E7O0lBRUEsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO0lBQ2xCLFFBQVEsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDdkM7O0lBRUEsSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUU7SUFDdEIsUUFBUSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztJQUMxQzs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUN2QixRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTztJQUM5RCxRQUFRLElBQUksS0FBSyxHQUFHLElBQUksRUFBRTtJQUMxQixZQUFZLE1BQU0sSUFBSSxLQUFLLEVBQUUsZ0NBQWdDLEVBQUUsS0FBSyxFQUFFLElBQUk7SUFDMUU7SUFDQSxRQUFRLEtBQUssR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDMUIsUUFBUSxJQUFJLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ3hCLFFBQVEsS0FBSyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxLQUFLLENBQUM7SUFDdkQsUUFBUSxJQUFJLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksQ0FBQztJQUNwRCxRQUFRLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUU7SUFDckMsUUFBUSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7SUFDaEUsYUFBYSxHQUFHLENBQUMsQ0FBQyxNQUFNLEtBQUs7SUFDN0IsZ0JBQWdCLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUM7SUFDMUQsYUFBYSxDQUFDO0lBQ2Q7SUFDQTtBQUNBRixvQkFBdUIsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDO0FBQ3hDRyxxQkFBdUIsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDOzs7SUFHeEM7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRU8sTUFBTSxVQUFVLENBQUM7O0lBRXhCLElBQUksV0FBVyxDQUFDLEtBQUssRUFBRTtJQUN2QixRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztJQUMzQjtJQUNBLFFBQVEsSUFBSSxDQUFDLE9BQU87SUFDcEI7SUFDQSxRQUFRLElBQUksQ0FBQyxNQUFNO0lBQ25COztJQUVBO0lBQ0E7SUFDQTtJQUNBLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtJQUNsQixRQUFRLE1BQU0sV0FBVztJQUN6QixZQUFZLElBQUksQ0FBQyxPQUFPLElBQUksU0FBUztJQUNyQyxZQUFZLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxNQUFNO0lBQzNELFNBQVM7SUFDVCxRQUFRO0lBQ1IsWUFBWSxDQUFDLFdBQVc7SUFDeEIsWUFBWSxJQUFJLENBQUMsTUFBTSxJQUFJLFNBQVM7SUFDcEMsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDekIsVUFBVTtJQUNWO0lBQ0EsWUFBWSxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQztJQUMzQztJQUNBO0lBQ0EsUUFBUSxJQUFJLFdBQVcsRUFBRTtJQUN6QixZQUFZLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUMzRDtJQUNBO0lBQ0EsUUFBUSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEtBQUs7SUFDMUQsWUFBWSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQ3RDLFNBQVMsQ0FBQztJQUNWLFFBQVEsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZO0lBQzNGO0lBQ0EsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sSUFBSSxTQUFTLEdBQUcsS0FBSztJQUN6RCxRQUFRLE9BQU8sS0FBSztJQUNwQjs7SUFFQSxJQUFJLEtBQUssR0FBRztJQUNaLFFBQVEsSUFBSSxDQUFDLE9BQU8sR0FBRyxTQUFTO0lBQ2hDLFFBQVEsSUFBSSxDQUFDLE1BQU0sR0FBRyxTQUFTO0lBQy9CO0lBQ0E7Ozs7SUFJQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOztJQUVPLE1BQU0sVUFBVSxTQUFTLEtBQUssQ0FBQzs7SUFFdEMsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUM1QixRQUFRLE1BQU0sQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxHQUFHLE9BQU87SUFDbkQsUUFBUSxLQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsZUFBZSxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNqRTtJQUNBLFFBQVFDLGFBQXFCLENBQUMsSUFBSSxDQUFDO0lBQ25DLFFBQVEsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQztJQUNwQztJQUNBLFFBQVEsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHO0lBQ3RCOztJQUVBLElBQUksYUFBYSxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUU7SUFDakMsUUFBUSxJQUFJLFFBQVEsSUFBSSxLQUFLLEVBQUU7SUFDL0IsWUFBWSxJQUFJLEVBQUUsR0FBRyxZQUFZLGlCQUFpQixDQUFDLEVBQUU7SUFDckQsZ0JBQWdCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyw2QkFBNkIsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ3RFO0lBQ0EsWUFBWSxPQUFPLEdBQUcsQ0FBQztJQUN2QjtJQUNBOztJQUVBLElBQUksZ0JBQWdCLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRTtJQUNyQyxRQUFRLElBQUksUUFBUSxJQUFJLEtBQUssRUFBRTtJQUMvQixZQUFZLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxTQUFTLElBQUksSUFBSSxJQUFJLE9BQU8sRUFBRTtJQUM1RCxnQkFBZ0IsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLGlCQUFpQixDQUFDLElBQUksQ0FBQyxHQUFHO0lBQzNELGFBQWE7SUFDYixZQUFZLElBQUksQ0FBQyxXQUFXLEVBQUU7SUFDOUIsWUFBWSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7SUFDbkMsWUFBWSxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQztJQUMxQyxTQUFTO0lBQ1Q7SUFDQTtBQUNBQyxrQkFBc0IsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDOzs7O0lBSTVDO0lBQ0E7SUFDQTs7SUFFQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTs7SUFFTyxNQUFNLGVBQWUsQ0FBQztJQUM3QixJQUFJLFdBQVcsQ0FBQyxLQUFLLEVBQUU7SUFDdkI7SUFDQSxRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztJQUMzQjtJQUNBLFFBQVEsSUFBSSxDQUFDLE9BQU8sR0FBRyxTQUFTO0lBQ2hDO0lBQ0EsUUFBUSxJQUFJLENBQUMsUUFBUSxHQUFHLFNBQVM7SUFDakM7O0lBRUEsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO0lBQ2xCLFFBQVEsTUFBTSxVQUFVO0lBQ3hCLFlBQVksSUFBSSxDQUFDLE9BQU8sSUFBSSxTQUFTO0lBQ3JDLFlBQVksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE1BQU07SUFDM0QsU0FBUztJQUNULFFBQVEsSUFBSSxVQUFVLEVBQUU7SUFDeEIsWUFBWSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDM0QsWUFBWSxJQUFJLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPO0lBQzVDLFlBQVksSUFBSSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLO0lBQ2xELGdCQUFnQixPQUFPLFlBQVksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO0lBQzlDLGFBQWEsQ0FBQztJQUNkO0lBQ0E7SUFDQSxRQUFRLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxLQUFLO0lBQ25ELFlBQVksT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUNwQyxTQUFTLENBQUM7SUFDVixRQUFRLE9BQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVk7SUFDL0U7O0lBRUEsSUFBSSxLQUFLLEdBQUc7SUFDWixRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsU0FBUztJQUNoQyxRQUFRLElBQUksQ0FBQyxRQUFRLEdBQUcsU0FBUztJQUNqQztJQUNBOztJQUVBO0lBQ0E7SUFDQTs7SUFFQSxTQUFTLFlBQVksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFO0lBQ2pDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEdBQUcsSUFBSTtJQUNwQyxJQUFJLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtJQUMxQixRQUFRLE9BQU8sSUFBSUMsYUFBcUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO0lBQ25ELEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxZQUFZLEVBQUU7SUFDckMsUUFBUSxPQUFPLElBQUlDLGlCQUF5QixDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7SUFDdkQsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLGVBQWUsRUFBRTtJQUN4QyxRQUFRLE9BQU8sSUFBSUMsb0JBQTRCLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQztJQUMxRCxLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksUUFBUSxFQUFFO0lBQ2pDLFFBQVEsT0FBTyxJQUFJQyxhQUFxQixDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7SUFDbkQsS0FBSyxNQUFNO0lBQ1gsUUFBUSxPQUFPLENBQUMsR0FBRyxDQUFDLDJCQUEyQixFQUFFLElBQUksQ0FBQztJQUN0RDtJQUNBOztJQzlRQTtJQUNBO0lBQ0E7SUFDQSxNQUFNLGFBQWEsR0FBRztJQUN0QixJQUFJLEdBQUcsRUFBRTtJQUNULFFBQVEsU0FBUyxFQUFFLFVBQVUsSUFBSSxFQUFFO0lBQ25DO0lBQ0EsWUFBWSxPQUFPLElBQUksQ0FBQztJQUN4QixpQkFBaUIsR0FBRyxDQUFDLEtBQUssSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDO0lBQzFDLGlCQUFpQixNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxLQUFLLEdBQUcsR0FBRyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZEO0lBQ0EsS0FBSztJQUNMLElBQUksS0FBSyxFQUFFO0lBQ1gsUUFBUSxTQUFTLEVBQUUsVUFBVSxJQUFJLEVBQUU7SUFDbkM7SUFDQSxZQUFZLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ3JDO0lBQ0EsS0FBSztJQUNMLElBQUksS0FBSyxFQUFFO0lBQ1gsUUFBUSxTQUFTLEVBQUUsVUFBVSxJQUFJLEVBQUU7SUFDbkM7SUFDQSxZQUFZLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUM7SUFDeEQ7SUFDQTtJQUNBOzs7SUFHQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRU8sU0FBUyxLQUFLLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDNUMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU87O0lBRTdCLElBQUksSUFBSSxJQUFJLElBQUksYUFBYSxFQUFFO0lBQy9CLFFBQVEsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQztJQUMxRCxLQUFLLE1BQU07SUFDWCxRQUFRLE9BQU8sSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQztJQUMvQztJQUNBOzs7SUFHQSxNQUFNLFVBQVUsU0FBUyxLQUFLLENBQUM7O0lBRS9CLElBQUksV0FBVyxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUU7SUFDbEMsUUFBUSxLQUFLLENBQUMsT0FBTyxDQUFDOztJQUV0QjtJQUNBLFFBQVFMLGFBQXFCLENBQUMsSUFBSSxDQUFDO0lBQ25DLFFBQVEsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN6RCxRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTztJQUM5Qjs7SUFFQSxJQUFJLGFBQWEsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFO0lBQ3JDLFFBQVEsSUFBSSxRQUFRLElBQUksU0FBUyxFQUFFO0lBQ25DO0lBQ0EsWUFBWSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtJQUN6QyxnQkFBZ0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLHNCQUFzQixFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ2xFO0lBQ0EsWUFBWSxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsWUFBWSxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNuRixZQUFZLElBQUksQ0FBQyxVQUFVLEVBQUU7SUFDN0IsZ0JBQWdCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQywyQkFBMkIsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3hFO0lBQ0E7SUFDQSxRQUFRLE9BQU8sT0FBTztJQUN0Qjs7SUFFQSxJQUFJLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUU7SUFDckMsUUFBUSxJQUFJLFFBQVEsSUFBSSxTQUFTLEVBQUU7SUFDbkMsWUFBWSxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksU0FBUyxJQUFJLElBQUksSUFBSSxPQUFPLEVBQUU7SUFDNUQsZ0JBQWdCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU87SUFDeEQsYUFBYTtJQUNiLFlBQVksSUFBSSxDQUFDLFdBQVcsRUFBRTtJQUM5QixZQUFZLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtJQUNuQyxZQUFZLElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDO0lBQzFDO0lBQ0E7SUFDQTtBQUNBQyxrQkFBc0IsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDOzs7SUFpQjVDO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxTQUFTLGFBQWEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQy9CLElBQUksT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFO0lBQzlCOztJQUVBLFNBQVMsY0FBYyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDaEMsSUFBSSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUU7SUFDOUI7O0lBRU8sTUFBTSxVQUFVLFNBQVMsZUFBZSxDQUFDOztJQUVoRCxJQUFJLFdBQVcsQ0FBQyxPQUFPLEVBQUU7SUFDekIsUUFBUSxLQUFLLEVBQUU7SUFDZixRQUFRLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTztJQUMvQixRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsS0FBSztJQUNwRCxZQUFZLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3hDLFNBQVMsQ0FBQyxDQUFDO0lBQ1g7O0lBRUEsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO0lBQ25CLFFBQVEsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQ25DO0lBQ0EsUUFBUSxNQUFNLFNBQVMsR0FBRyxFQUFFLEVBQUUsU0FBUyxHQUFHLEVBQUU7SUFDNUMsUUFBUSxNQUFNLFdBQVcsR0FBRyxFQUFFO0lBQzlCLFFBQVEsTUFBTSxnQkFBZ0IsR0FBRyxFQUFFO0lBQ25DLFFBQVEsTUFBTSxlQUFlLEdBQUc7SUFDaEMsUUFBUSxLQUFLLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7SUFDdkMsWUFBWSxJQUFJLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDakQsWUFBWSxJQUFJLFdBQVcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUM7SUFDM0QsWUFBWSxJQUFJLFdBQVcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUM7SUFDM0QsWUFBWSxJQUFJLFdBQVcsSUFBSSxTQUFTLEVBQUU7SUFDMUMsZ0JBQWdCLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDMUU7SUFDQSxZQUFZLElBQUksV0FBVyxJQUFJLFNBQVMsRUFBRTtJQUMxQyxnQkFBZ0IsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMxRTtJQUNBLFlBQVksSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7SUFDMUMsZ0JBQWdCLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDdkQsZ0JBQWdCLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDO0lBQ3BFLGdCQUFnQixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQzNDLGdCQUFnQixlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzFDO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsUUFBUSxTQUFTLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQztJQUNyQyxRQUFRLE1BQU0sWUFBWSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7O0lBRTFEO0lBQ0EsUUFBUSxTQUFTLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQztJQUN0QyxRQUFRLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQzs7SUFFNUQ7SUFDQSxRQUFRLElBQUksR0FBRyxFQUFFLElBQUksQ0FBQztJQUN0QixRQUFRLE1BQU0sTUFBTSxHQUFHO0lBQ3ZCLFlBQVksTUFBTSxFQUFFLFdBQVc7SUFDL0I7O0lBRUEsUUFBUSxJQUFJLFdBQVcsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFOztJQUVyQztJQUNBLFlBQVksTUFBTSxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUM7SUFDeEM7SUFDQSxZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsYUFBYTtJQUN2Qzs7SUFFQSxTQUFTLE1BQU07SUFDZjtJQUNBO0lBQ0E7SUFDQSxZQUFZLGdCQUFnQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7SUFDaEQsWUFBWSxJQUFJLGVBQWUsR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7SUFDckQsWUFBWSxJQUFJLGVBQWUsR0FBRyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDL0QsWUFBWSxJQUFJLG9CQUFvQixHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxlQUFlLEVBQUUsZUFBZTs7SUFFcEY7SUFDQSxZQUFZLGVBQWUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDO0lBQ2hELFlBQVksSUFBSSxjQUFjLEdBQUcsZUFBZSxDQUFDLENBQUMsQ0FBQztJQUNuRCxZQUFZLElBQUksY0FBYyxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDN0QsWUFBWSxJQUFJLG1CQUFtQixHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxjQUFjLEVBQUUsY0FBYzs7SUFFakY7SUFDQSxZQUFZLElBQUksUUFBUSxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQUUsZUFBZSxDQUFDLEVBQUU7SUFDNUQsZ0JBQWdCLE1BQU0sQ0FBQyxLQUFLLEdBQUcsWUFBWTtJQUMzQyxhQUFhLE1BQU07SUFDbkIsZ0JBQWdCLE1BQU0sQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsS0FBSztJQUNuRTtJQUNBLFlBQVksTUFBTSxDQUFDLElBQUksR0FBRyxDQUFDLG9CQUFvQixJQUFJLE1BQU0sQ0FBQyxLQUFLLEdBQUcsWUFBWTs7SUFFOUU7SUFDQSxZQUFZLElBQUksUUFBUSxDQUFDLEVBQUUsQ0FBQyxhQUFhLEVBQUUsY0FBYyxDQUFDLEVBQUU7SUFDNUQsZ0JBQWdCLE1BQU0sQ0FBQyxJQUFJLEdBQUcsYUFBYTtJQUMzQyxhQUFhLE1BQU07SUFDbkIsZ0JBQWdCLE1BQU0sQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsTUFBTSxDQUFDO0lBQ25FO0lBQ0EsWUFBWSxNQUFNLENBQUMsSUFBSSxHQUFHLENBQUMsbUJBQW1CLElBQUksTUFBTSxDQUFDLElBQUksR0FBRyxhQUFhOztJQUU3RTs7SUFFQTtJQUNBLFFBQVEsR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUM7SUFDL0MsUUFBUSxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztJQUNsRCxRQUFRLE1BQU0sQ0FBQyxHQUFHLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDOztJQUV2RCxRQUFRLE9BQU8sTUFBTTtJQUNyQjtJQUNBOztJQzdOQSxTQUFTLE9BQU8sQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFO0lBQzVCLElBQUksSUFBSSxDQUFDLElBQUksU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ3hDO0lBQ0EsUUFBUSxPQUFPLENBQUM7SUFDaEI7SUFDQSxTQUFTLElBQUksT0FBTyxDQUFDLElBQUksUUFBUSxFQUFFO0lBQ25DO0lBQ0EsUUFBUSxPQUFPLENBQUMsR0FBRyxNQUFNO0lBQ3pCLEtBQUssTUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7SUFDakQ7SUFDQSxRQUFRLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUMzQixRQUFRLE9BQU8sQ0FBQyxHQUFHLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQztJQUNuQztJQUNBOzs7SUFHQTtJQUNBO0lBQ0E7O0lBRUEsTUFBTSxVQUFVLFNBQVMsZUFBZSxDQUFDOztJQUV6QyxJQUFJLFdBQVcsQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUU7SUFDOUIsUUFBUSxLQUFLLEVBQUU7SUFDZixRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztJQUMzQixRQUFRLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSTtJQUN6QixRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLFFBQVEsRUFBRTs7SUFFdEM7SUFDQSxRQUFRLElBQUksQ0FBQyxjQUFjLEdBQUc7SUFDOUIsWUFBWSxLQUFLLEVBQUUsVUFBVSxNQUFNLEVBQUU7SUFDckM7SUFDQSxnQkFBZ0IsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQztJQUNuRixhQUFhLENBQUMsSUFBSSxDQUFDLElBQUk7SUFDdkIsU0FBUztJQUNUOztJQUVBO0lBQ0EsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO0lBQ25CO0lBQ0EsUUFBUSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM3RTtJQUNBLFFBQVEsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUU7SUFDdEMsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNuRCxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSztJQUNsRCxRQUFRLE9BQU87SUFDZixZQUFZLEdBQUc7SUFDZixZQUFZLElBQUksRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQ2xELFlBQVksS0FBSyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDcEQsWUFBWSxNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsY0FBYztJQUMvRDtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTs7O0lBR0EsTUFBTSxVQUFVLFNBQVMsS0FBSyxDQUFDOztJQUUvQixJQUFJLFdBQVcsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDekMsUUFBUSxLQUFLLENBQUMsT0FBTyxDQUFDO0lBQ3RCLFFBQVEsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJO0lBQ3pCO0lBQ0EsUUFBUUQsYUFBcUIsQ0FBQyxJQUFJLENBQUM7SUFDbkMsUUFBUSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDO0lBQ3BDLFFBQVEsSUFBSSxDQUFDLEdBQUcsR0FBRyxLQUFLO0lBQ3hCOztJQUVBLElBQUksYUFBYSxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUU7SUFDakMsUUFBUSxJQUFJLFFBQVEsSUFBSSxLQUFLLEVBQUU7SUFDL0IsWUFBWSxJQUFJLEVBQUUsR0FBRyxZQUFZLEtBQUssQ0FBQyxFQUFFO0lBQ3pDLGdCQUFnQixNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUM3RDtJQUNBLFlBQVksT0FBTyxHQUFHLENBQUM7SUFDdkI7SUFDQTs7SUFFQSxJQUFJLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUU7SUFDckMsUUFBUSxJQUFJLFFBQVEsSUFBSSxLQUFLLEVBQUU7SUFDL0IsWUFBWSxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksU0FBUyxJQUFJLElBQUksSUFBSSxPQUFPLEVBQUU7SUFDNUQsZ0JBQWdCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsS0FBSztJQUNoRSxhQUFhO0lBQ2IsWUFBWSxJQUFJLENBQUMsV0FBVyxFQUFFO0lBQzlCLFlBQVksSUFBSSxDQUFDLGdCQUFnQixFQUFFO0lBQ25DLFlBQVksSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMzQztJQUNBO0lBQ0E7QUFDQUMsa0JBQXNCLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQzs7SUFFNUM7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFTyxTQUFTLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFO0lBQ3RDLElBQUksT0FBTyxJQUFJLFVBQVUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDO0lBQ3hDOztJQ3pHQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFTyxNQUFNLGlCQUFpQixDQUFDO0lBQy9CLElBQUksV0FBVyxHQUFHO0lBQ2xCLFFBQVFOLGVBQXNCLENBQUMsSUFBSSxDQUFDO0lBQ3BDO0lBQ0EsSUFBSSxHQUFHLENBQUMsR0FBRztJQUNYLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQztJQUMxQztJQUNBO0FBQ0FDLG9CQUF1QixDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQzs7OztJQUlwRDtJQUNBO0lBQ0E7O0lBRUEsTUFBTSxrQkFBa0IsU0FBUyxpQkFBaUIsQ0FBQztJQUNuRCxJQUFJLEdBQUcsQ0FBQyxHQUFHO0lBQ1gsUUFBUSxPQUFPLEtBQUssQ0FBQyxHQUFHLEVBQUU7SUFDMUI7SUFDQTs7SUFFTyxNQUFNLGtCQUFrQixHQUFHLElBQUksa0JBQWtCLEVBQUU7O0lDcEMxRCxNQUFNLE9BQU8sR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFdBQVcsQ0FBQzs7O0lBR2hELFNBQVMsR0FBRyxFQUFFLE1BQU0sRUFBRTtJQUM3QixJQUFJLElBQUksRUFBRSxNQUFNLFlBQVksaUJBQWlCLENBQUMsRUFBRTtJQUNoRCxRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxpQ0FBaUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ3JFO0lBQ0EsSUFBSSxJQUFJLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU87SUFDeEMsU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsS0FBSztJQUNqQyxZQUFZLE9BQU87SUFDbkIsZ0JBQWdCLElBQUk7SUFDcEIsZ0JBQWdCLFNBQVMsR0FBRyxJQUFJLEVBQUU7SUFDbEMsb0JBQW9CLElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDO0lBQzFELG9CQUFvQixPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDaEQ7SUFDQTtJQUNBLFNBQVMsQ0FBQztJQUNWLElBQUksT0FBTyxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQztJQUN0Qzs7SUFFQSxTQUFTLE1BQU0sQ0FBQyxLQUFLLEVBQUU7SUFDdkIsSUFBSSxJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUU7SUFDNUIsUUFBUSxPQUFPLEVBQUU7SUFDakIsS0FBSyxNQUFNO0lBQ1gsUUFBUSxJQUFJLElBQUksR0FBRztJQUNuQixZQUFZLEdBQUcsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0lBQ2xELFlBQVksSUFBSSxFQUFFLFFBQVE7SUFDMUIsWUFBWSxJQUFJLEVBQUUsS0FBSztJQUN2QjtJQUNBLFFBQVEsT0FBTyxDQUFDLElBQUksQ0FBQztJQUNyQjtJQUNBOztJQUVBLFNBQVMsSUFBSSxDQUFDLE1BQU0sRUFBRTtJQUN0QixJQUFJLElBQUksSUFBSSxHQUFHO0lBQ2YsUUFBUSxHQUFHLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztJQUM5QyxRQUFRLElBQUksRUFBRSxRQUFRO0lBQ3RCLFFBQVEsSUFBSSxFQUFFLE1BQU07SUFDcEI7SUFDQSxJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDakI7O0lBRUEsU0FBUyxVQUFVLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRTtJQUM1QyxJQUFJLElBQUksS0FBSyxHQUFHO0lBQ2hCLFFBQVE7SUFDUixZQUFZLEdBQUcsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDO0lBQzdDLFlBQVksSUFBSSxFQUFFLFFBQVE7SUFDMUIsWUFBWSxJQUFJLEVBQUU7SUFDbEIsU0FBUztJQUNULFFBQVE7SUFDUixZQUFZLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQztJQUN0QyxZQUFZLElBQUksRUFBRSxZQUFZO0lBQzlCLFlBQVksSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLE1BQU07SUFDekMsU0FBUztJQUNULFFBQVE7SUFDUixZQUFZLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztJQUMzQyxZQUFZLElBQUksRUFBRSxRQUFRO0lBQzFCLFlBQVksSUFBSSxFQUFFO0lBQ2xCO0lBQ0E7SUFDQSxJQUFJLE9BQU8sS0FBSztJQUNoQjs7SUFFQSxTQUFTLFdBQVcsQ0FBQyxNQUFNLEVBQUU7SUFDN0IsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDNUIsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQzs7SUFFMUMsSUFBSSxJQUFJLEtBQUssR0FBRztJQUNoQixRQUFRO0lBQ1IsWUFBWSxHQUFHLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQztJQUM3QyxZQUFZLElBQUksRUFBRSxRQUFRO0lBQzFCLFlBQVksSUFBSSxFQUFFO0lBQ2xCLFNBQVM7SUFDVCxRQUFRO0lBQ1IsWUFBWSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUM7SUFDdEMsWUFBWSxJQUFJLEVBQUUsZUFBZTtJQUNqQyxZQUFZLElBQUksRUFBRTtJQUNsQixTQUFTO0lBQ1QsUUFBUTtJQUNSLFlBQVksR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0lBQzNDLFlBQVksSUFBSSxFQUFFLFFBQVE7SUFDMUIsWUFBWSxJQUFJLEVBQUU7SUFDbEI7SUFDQSxNQUFLO0lBQ0wsSUFBSSxPQUFPLEtBQUs7SUFDaEI7O0lDckZBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBOztJQUVBOztJQUVBO0lBQ0E7SUFDQTtJQUNBOztJQUVBOztJQUVBO0lBQ0E7O0lBRUE7SUFDQTs7SUFFQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTs7SUFFQTtJQUNBOztJQUVBOzs7SUFHQSxNQUFNLE9BQU8sR0FBRzs7O0lBR2hCO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRUEsTUFBTSxjQUFjLENBQUM7O0lBRXJCLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7O0lBRTVCLFFBQVEsSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLE9BQU8sQ0FBQztJQUMvRCxRQUFRLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsT0FBTyxFQUFFO0lBQzFDLFlBQVksTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUMvRTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsUUFBUSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksR0FBRyxFQUFFO0lBQzdCO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsUUFBUSxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksR0FBRyxFQUFFO0lBQ3RDO0lBQ0EsUUFBUSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDbkU7O0lBRUEsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtJQUNoRDtJQUNBLFFBQVEsSUFBSSxNQUFNLEdBQUcsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQztJQUNoRCxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztJQUM3QjtJQUNBLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFO0lBQy9DLFlBQVksSUFBSSxHQUFHLEdBQUcsUUFBUSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDO0lBQ3BFLFlBQVksSUFBSSxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM5RCxZQUFZLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUM7SUFDbEQ7SUFDQSxTQUFTLE1BQU07SUFDZixZQUFZLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ2pFO0lBQ0EsUUFBUSxPQUFPLE1BQU07SUFDckI7O0lBRUEsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFO0lBQ3BCO0lBQ0EsUUFBUSxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDOUMsUUFBUSxJQUFJLENBQUMsT0FBTyxFQUFFO0lBQ3RCLFFBQVEsTUFBTSxDQUFDLEdBQUcsR0FBRyxTQUFTO0lBQzlCO0lBQ0EsUUFBUSxJQUFJLFFBQVEsR0FBRyxNQUFNLENBQUMsUUFBUTtJQUN0QyxRQUFRLElBQUksQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO0lBQzdELFFBQVEsSUFBSSxHQUFHLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDekMsUUFBUSxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRTtJQUN0QixZQUFZLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUNsQztJQUNBLFFBQVEsSUFBSSxPQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUNqQztJQUNBO0lBQ0EsWUFBWSxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUM7SUFDL0MsWUFBWSxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQztJQUM3QjtJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBLElBQUksaUJBQWlCLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO0lBQ3BDLFFBQVEsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDLEdBQUc7SUFDaEM7SUFDQSxRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7SUFDeEQsUUFBUSxJQUFJLEtBQUssR0FBRyxJQUFJO0lBQ3hCO0lBQ0EsUUFBUSxJQUFJLENBQUMsbUJBQW1CLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQztJQUNqRDtJQUNBLFFBQVEsS0FBSyxJQUFJLE1BQU0sSUFBSSxPQUFPLEVBQUU7SUFDcEMsWUFBWSxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQztJQUNsQztJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBLElBQUksbUJBQW1CLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRTtJQUN6QyxRQUFRLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztJQUNuRCxRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEdBQUcsSUFBSTtJQUN4QyxRQUFRLEtBQUssR0FBRyxLQUFLLElBQUksUUFBUSxDQUFDLEtBQUssRUFBRTtJQUN6QyxRQUFRLElBQUksaUJBQWlCLEdBQUcsS0FBSyxDQUFDLE9BQU87SUFDN0MsUUFBUSxJQUFJLENBQUMsV0FBVyxJQUFJLGlCQUFpQixFQUFFO0lBQy9DLFlBQVksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJO0lBQy9CLFlBQVksSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUM7SUFDeEMsU0FBUyxNQUFNLElBQUksV0FBVyxJQUFJLENBQUMsaUJBQWlCLEVBQUU7SUFDdEQsWUFBWSxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUs7SUFDaEMsWUFBWSxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQztJQUMxQztJQUNBOztJQUVBO0lBQ0E7SUFDQTtJQUNBLElBQUksYUFBYSxDQUFDLFFBQVEsRUFBRTtJQUM1QixRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7SUFDeEQsUUFBUSxLQUFLLElBQUksTUFBTSxJQUFJLE9BQU8sRUFBRTtJQUNwQyxZQUFZLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDO0lBQ3JDO0lBQ0E7O0lBRUEsSUFBSSxZQUFZLENBQUMsTUFBTSxFQUFFO0lBQ3pCLFFBQVEsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7SUFDdkQsUUFBUSxJQUFJLE9BQU8sR0FBRyxZQUFZO0lBQ2xDLFlBQVksSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUM7SUFDeEMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDcEIsUUFBUSxNQUFNLENBQUMsR0FBRyxHQUFHLFVBQVUsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDO0lBQy9DOztJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsSUFBSSxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUU7SUFDNUIsUUFBUSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUk7SUFDckMsUUFBUSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUMvQyxRQUFRLElBQUksQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7SUFDOUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLEdBQUcsS0FBSyxFQUFFLElBQUksQ0FBQztJQUM5QyxRQUFRLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJO0lBQ2hELFFBQVEsT0FBTyxNQUFNLEdBQUcsV0FBVyxDQUFDLEdBQUcsRUFBRTtJQUN6Qzs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLGVBQWUsQ0FBQyxRQUFRLEVBQUU7SUFDOUIsUUFBUSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO0lBQ3hELFFBQVEsS0FBSyxJQUFJLE1BQU0sSUFBSSxPQUFPLEVBQUU7SUFDcEMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxHQUFHLElBQUksU0FBUyxFQUFFO0lBQ3pDLGdCQUFnQixZQUFZLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQztJQUN4QyxnQkFBZ0IsTUFBTSxDQUFDLEdBQUcsR0FBRyxTQUFTO0lBQ3RDO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLGVBQWUsQ0FBQyxNQUFNLEVBQUU7SUFDNUI7SUFDQSxRQUFRLElBQUksTUFBTSxDQUFDLEdBQUcsSUFBSSxTQUFTLEVBQUU7SUFDckMsUUFBUSxNQUFNLENBQUMsR0FBRyxHQUFHLFNBQVM7SUFDOUI7SUFDQSxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxNQUFNO0lBQy9CLFFBQVEsSUFBSSxLQUFLLEdBQUcsUUFBUSxDQUFDLEtBQUssRUFBRTtJQUNwQztJQUNBLFFBQVEsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFO0lBQzNCLFlBQVksSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7SUFDckMsU0FBUyxNQUFNO0lBQ2Y7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLFlBQVksSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO0lBQ3ZELFlBQVksSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLO0lBQ2hDO0lBQ0E7SUFDQSxRQUFRLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO0lBQzlCO0lBQ0E7Ozs7SUFJQTtJQUNBO0lBQ0E7OztJQUdBLE1BQU0sZ0JBQWdCLFNBQVMsY0FBYyxDQUFDOztJQUU5QyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO0lBQzVCLFFBQVEsS0FBSyxDQUFDLE9BQU8sQ0FBQztJQUN0QixRQUFRLElBQUksQ0FBQyxPQUFPO0lBQ3BCOztJQUVBO0lBQ0E7SUFDQTtJQUNBLElBQUksYUFBYSxDQUFDLFFBQVEsRUFBRTtJQUM1QixJQUFJLFlBQVksQ0FBQyxNQUFNLEVBQUU7SUFDekIsSUFBSSxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUU7SUFDNUIsSUFBSSxlQUFlLENBQUMsUUFBUSxFQUFFO0lBQzlCLElBQUksZUFBZSxDQUFDLE1BQU0sRUFBRTs7SUFFNUIsSUFBSSxpQkFBaUIsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7SUFDcEMsUUFBUSxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQztJQUM1QztJQUNBLFFBQVEsSUFBSSxDQUFDLFNBQVMsRUFBRTtJQUN4Qjs7SUFFQSxJQUFJLFNBQVMsR0FBRztJQUNoQjtJQUNBLFFBQVEsSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFO0lBQ3hELGFBQWEsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLE9BQU87SUFDdEQsYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsS0FBSyxRQUFRLENBQUM7SUFDaEQsUUFBUSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0lBQ2xDO0lBQ0EsWUFBWSxLQUFLLElBQUksUUFBUSxJQUFJLFNBQVMsRUFBRTtJQUM1QyxnQkFBZ0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztJQUNoRSxnQkFBZ0IsSUFBSSxHQUFHLEdBQUcsUUFBUSxDQUFDLEtBQUssRUFBRTtJQUMxQyxnQkFBZ0IsS0FBSyxJQUFJLE1BQU0sSUFBSSxPQUFPLEVBQUU7SUFDNUMsb0JBQW9CLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDO0lBQ3hDO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLFlBQVksSUFBSSxDQUFDLE9BQU8sR0FBRyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMzRTtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTs7SUFFQSxNQUFNLE9BQU8sR0FBRyxJQUFJLGNBQWMsRUFBRTtJQUNwQyxNQUFNLGlCQUFpQixHQUFHLElBQUksZ0JBQWdCLEVBQUU7O0lBRXpDLFNBQVMsSUFBSSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDNUQsSUFBSSxJQUFJLE1BQU07SUFDZCxJQUFJLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO0lBQ3BDLFFBQVEsTUFBTSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDO0lBQ2pFLFFBQVEsT0FBTyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUM7SUFDbEMsS0FBSyxNQUFNO0lBQ1gsUUFBUSxNQUFNLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLE9BQU8sQ0FBQztJQUN2RSxRQUFRLE9BQU8sQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDO0lBQ3BDO0lBQ0E7SUFDTyxTQUFTLE9BQU8sQ0FBQyxNQUFNLEVBQUU7SUFDaEMsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxHQUFHLE1BQU07SUFDaEMsSUFBSSxJQUFJLElBQUksSUFBSSxTQUFTLEVBQUU7SUFDM0IsUUFBUSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO0lBQ3ZDLEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxXQUFXLEVBQUU7SUFDcEMsUUFBUSxPQUFPLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7SUFDakQ7SUFDQTs7SUNyVEE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLE1BQU0sV0FBVyxTQUFTLGVBQWUsQ0FBQzs7SUFFMUMsSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFO0lBQ3hCLFFBQVEsS0FBSyxFQUFFO0lBQ2YsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUU7SUFDdkM7O0lBRUEsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO0lBQ25CO0lBQ0EsUUFBUSxPQUFPO0lBQ2YsWUFBWSxHQUFHLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztJQUNsRCxZQUFZLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDakMsWUFBWSxJQUFJLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDaEMsWUFBWSxJQUFJLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDaEMsWUFBWSxLQUFLLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQ2hDLFlBQVksSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUMvQjtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUEsTUFBTSxXQUFXLENBQUM7SUFDbEIsSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFO0lBQ3hCLFFBQVEsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNO0lBQzdCLFFBQVEsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUU7SUFDakQ7O0lBRUEsSUFBSSxLQUFLLEdBQUc7SUFDWixRQUFRLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsZUFBZSxFQUFFLENBQUMsS0FBSyxDQUFDO0lBQzVELFFBQVEsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDeEM7O0lBRUEsSUFBSSxLQUFLLEdBQUc7SUFDWixRQUFRLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFO0lBQzNCO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVPLE1BQU0sTUFBTSxTQUFTLEtBQUssQ0FBQzs7SUFFbEMsSUFBSSxXQUFXLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO0lBQzdCLFFBQVEsS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDOztJQUV2QztJQUNBLFFBQVFJLGFBQXFCLENBQUMsSUFBSSxDQUFDO0lBQ25DLFFBQVEsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQztJQUNwQyxRQUFRLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUM7O0lBRXJDO0lBQ0EsUUFBUSxJQUFJLENBQUMsSUFBSTtJQUNqQjtJQUNBLFFBQVEsSUFBSSxDQUFDLElBQUk7O0lBRWpCO0lBQ0EsUUFBUSxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLE9BQU87SUFDakMsUUFBUSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksSUFBSSxrQkFBa0I7SUFDOUMsUUFBUSxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUc7SUFDdEI7O0lBRUE7SUFDQTtJQUNBOztJQUVBLElBQUksYUFBYSxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUU7SUFDakMsUUFBUSxJQUFJLFFBQVEsSUFBSSxNQUFNLEVBQUU7SUFDaEMsWUFBWSxNQUFNLEVBQUUsR0FBRyxDQUFDLGlCQUFpQixFQUFFLE1BQU07SUFDakQsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxHQUFHLFlBQVksRUFBRTtJQUM5QyxpQkFBaUIsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDO0lBQ25DLFlBQVksSUFBSSxDQUFDLEVBQUUsRUFBRTtJQUNyQixnQkFBZ0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLHVDQUF1QyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQy9FO0lBQ0EsU0FBUyxNQUFNLElBQUksUUFBUSxJQUFJLEtBQUssRUFBRTtJQUN0QyxZQUFZLElBQUksRUFBRSxHQUFHLFlBQVksS0FBSyxDQUFDLEVBQUU7SUFDekMsZ0JBQWdCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzdEO0lBQ0E7SUFDQSxRQUFRLE9BQU8sR0FBRztJQUNsQjs7SUFFQSxJQUFJLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUU7SUFDckMsUUFBUSxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUM7SUFDNUM7O0lBRUE7SUFDQTtJQUNBOztJQUVBLElBQUksZUFBZSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUU7SUFDbEMsUUFBUSxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztJQUMvQixRQUFRLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ2hDLFFBQVEsSUFBSSxJQUFJLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7SUFDbkMsWUFBWSxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksU0FBUyxJQUFJLElBQUksSUFBSSxPQUFPLEVBQUU7SUFDNUQ7SUFDQSxnQkFBZ0IsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUM7SUFDbEQ7SUFDQSxZQUFZLElBQUksQ0FBQyxXQUFXLEVBQUU7SUFDOUIsWUFBWSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7SUFDbkM7SUFDQSxZQUFZLElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUN4RDtJQUNBLFlBQVksSUFBSSxDQUFDLHNCQUFzQixFQUFFO0lBQ3pDO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxJQUFJLHNCQUFzQixHQUFHOztJQUU3QjtJQUNBLFFBQVEsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFBRTtJQUNsRCxRQUFRLE1BQU0sQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxXQUFXOztJQUVsRTtJQUNBLFFBQVEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUU7SUFDbEM7SUFDQSxZQUFZO0lBQ1o7O0lBRUE7SUFDQSxRQUFRLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUM7SUFDN0QsUUFBUSxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0lBRXJEO0lBQ0EsUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLFlBQVksaUJBQWlCLEVBQUU7SUFDcEQsWUFBWSxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtJQUNoQyxnQkFBZ0IsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRSxVQUFVLENBQUM7SUFDdEUsZ0JBQWdCO0lBQ2hCO0lBQ0E7SUFDQSxZQUFZO0lBQ1osU0FBUztJQUNULFFBQVEsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksWUFBWSxpQkFBaUIsRUFBRTtJQUN6RDtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxZQUFZLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7O0lBRWxFLFlBQVksSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtJQUNuRDtJQUNBLGdCQUFnQjtJQUNoQjtJQUNBLFlBQVksSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7SUFDaEQsZ0JBQWdCLE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ3ZELGdCQUFnQixJQUFJLFNBQVMsQ0FBQyxJQUFJLElBQUksUUFBUSxFQUFFO0lBQ2hELG9CQUFvQixNQUFNLENBQUMsUUFBUSxFQUFFLFlBQVksQ0FBQyxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsSUFBSTtJQUN2RSxvQkFBb0IsSUFBSSxZQUFZLElBQUksR0FBRyxFQUFFO0lBQzdDO0lBQ0Esd0JBQXdCLElBQUksVUFBVSxHQUFHLENBQUMsUUFBUSxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsR0FBRztJQUNwRSx3QkFBd0IsSUFBSSxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUU7SUFDbEQsNEJBQTRCLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDO0lBQzdGLDRCQUE0QixPQUFPO0lBQ25DLHlCQUF5QjtJQUN6QjtJQUNBLHdCQUF3QjtJQUN4QjtJQUNBO0lBQ0EsaUJBQWlCLE1BQU0sSUFBSSxTQUFTLENBQUMsSUFBSSxJQUFJLFlBQVksRUFBRTtJQUMzRCxvQkFBb0IsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxTQUFTLENBQUMsSUFBSTtJQUNsRixvQkFBb0IsSUFBSSxNQUFNLElBQUksUUFBUSxFQUFFO0lBQzVDO0lBQ0Esd0JBQXdCLElBQUksUUFBUSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ3REO0lBQ0Esd0JBQXdCLE1BQU0sVUFBVSxHQUFHLENBQUMsUUFBUSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7SUFDbEcsd0JBQXdCLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxFQUFFLFdBQVc7SUFDbEUsNEJBQTRCLFFBQVEsRUFBRSxVQUFVLENBQUM7SUFDakQ7SUFDQSx3QkFBd0I7SUFDeEI7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQSxRQUFRLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQztJQUMxQzs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxJQUFJLGFBQWEsQ0FBQyxVQUFVLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUU7SUFDakUsUUFBUSxNQUFNLFNBQVMsR0FBRyxDQUFDLFVBQVUsR0FBRyxXQUFXLElBQUksUUFBUTtJQUMvRCxRQUFRLE1BQU0sU0FBUyxHQUFHLFVBQVUsR0FBRyxTQUFTO0lBQ2hELFFBQVEsSUFBSSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUMsTUFBTTtJQUNyQyxZQUFZLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUM7SUFDNUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQzlCOztJQUVBLElBQUksZ0JBQWdCLENBQUMsU0FBUyxFQUFFO0lBQ2hDLFFBQVEsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDLE1BQU07SUFDaEQsUUFBUSxNQUFNLGFBQWEsR0FBRyxTQUFTLEdBQUcsRUFBRSxDQUFDO0lBQzdDLFFBQVEsSUFBSSxhQUFhLElBQUksQ0FBQyxFQUFFO0lBQ2hDO0lBQ0EsWUFBWSxJQUFJLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQztJQUMzQyxTQUFTLE1BQU07SUFDZjtJQUNBLFlBQVksSUFBSSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUMsTUFBTTtJQUN6QyxnQkFBZ0IsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVM7SUFDL0MsYUFBYSxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUM7SUFDbEM7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRUEsSUFBSSxhQUFhLENBQUMsR0FBRyxFQUFFO0lBQ3ZCLFFBQVEsSUFBSSxDQUFDLElBQUksR0FBRyxXQUFXLENBQUMsTUFBTTtJQUN0QyxZQUFZLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDO0lBQ25DLFNBQVMsRUFBRSxHQUFHLENBQUM7SUFDZjs7SUFFQSxJQUFJLGFBQWEsQ0FBQyxHQUFHLEVBQUU7SUFDdkIsUUFBUSxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSztJQUN2QyxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsRUFBRTtJQUNqRCxZQUFZLElBQUksQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDO0lBQzNDO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOztJQUVBLElBQUksZUFBZSxDQUFDLEdBQUc7SUFDdkIsUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLFlBQVksaUJBQWlCLEVBQUU7SUFDcEQsWUFBWSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtJQUNwQyxZQUFZLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQztJQUN0RCxTQUFTLE1BQU07SUFDZixZQUFZLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO0lBQ3pDO0lBQ0EsWUFBWSxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssS0FBSyxRQUFRLEVBQUU7SUFDakQsZ0JBQWdCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxtQ0FBbUMsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNwRjtJQUNBLFlBQVksT0FBTyxLQUFLO0lBQ3hCO0lBQ0E7O0lBRUEsSUFBSSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDO0lBQzVDO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJLEVBQUU7SUFDaEMsUUFBUSxJQUFJLElBQUksSUFBSSxRQUFRLEVBQUU7SUFDOUIsWUFBWSxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ2pDO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDdEMsUUFBUSxPQUFPLElBQUksQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUM7SUFDbkQ7SUFDQSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUU7SUFDcEIsUUFBUSxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDOUI7O0lBRUE7SUFDQTtJQUNBOztJQUVBLElBQUksTUFBTSxDQUFDLEtBQUssRUFBRTtJQUNsQixRQUFRLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztJQUM5QztJQUNBLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLEVBQUU7SUFDaEMsUUFBUSxJQUFJLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFO0lBQ3BELFFBQVEsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7SUFDdkMsWUFBWSxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMscUNBQXFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUM1RTtJQUNBLFFBQVEsUUFBUSxHQUFHLENBQUMsUUFBUSxJQUFJLFNBQVMsSUFBSSxRQUFRLEdBQUcsS0FBSztJQUM3RCxRQUFRLFFBQVEsR0FBRyxDQUFDLFFBQVEsSUFBSSxTQUFTLElBQUksUUFBUSxFQUFFLENBQUM7SUFDeEQsUUFBUSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDdEU7SUFDQSxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsRUFBRTtJQUM1QyxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFO0lBQ2hELFFBQVEsSUFBSSxPQUFPLEVBQUUsS0FBSyxRQUFRLEVBQUU7SUFDcEMsWUFBWSxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMscUNBQXFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN6RTtJQUNBLFFBQVEsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLFFBQVEsRUFBRSxNQUFNLENBQUM7SUFDbEY7SUFDQSxJQUFJLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxFQUFFO0lBQ3JDLFFBQVEsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLE1BQU07SUFDcEM7SUFDQTtJQUNBLFFBQVEsTUFBTSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSztJQUN2QyxZQUFZLE9BQU8sQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUM7SUFDdkMsU0FBUztJQUNULFFBQVEsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDO0lBQ3BEOztJQUVBO0FBQ0FDLGtCQUFzQixDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFDeENBLGtCQUFzQixDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7O0lDeGJ4QyxNQUFNLFlBQVksU0FBUyxLQUFLLENBQUM7O0lBRWpDLElBQUksV0FBVyxDQUFDLEtBQUssRUFBRTtJQUN2QixRQUFRLEtBQUssRUFBRTtJQUNmLFFBQVEsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLFlBQVksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDO0lBQ2xEO0lBQ0E7SUFDQSxRQUFRLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztJQUNqRCxRQUFRLEtBQUssQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDO0lBQ25DOztJQUVBLElBQUksU0FBUyxDQUFDLElBQUksRUFBRTtJQUNwQixRQUFRLElBQUksQ0FBQyxXQUFXLEVBQUU7SUFDMUIsUUFBUSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7SUFDL0IsUUFBUSxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQztJQUN0QztJQUNBOztJQUVPLFNBQVMsT0FBTyxDQUFDLEtBQUssRUFBRTtJQUMvQixJQUFJLE9BQU8sSUFBSSxZQUFZLENBQUMsS0FBSyxDQUFDO0lBQ2xDLENBQUM7OztJQUdEO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUEsU0FBUyxXQUFXLEVBQUUsS0FBSyxFQUFFO0lBQzdCLElBQUksT0FBTztJQUNYLFFBQVEsS0FBSyxFQUFFLFVBQVUsTUFBTSxFQUFFO0lBQ2pDLFlBQVksT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztJQUNqRDtJQUNBO0lBQ0E7O0lBRU8sTUFBTSxZQUFZLFNBQVMsZUFBZSxDQUFDOztJQUVsRCxJQUFJLFdBQVcsQ0FBQyxLQUFLLEVBQUU7SUFDdkIsUUFBUSxLQUFLLEVBQUU7SUFDZixRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztJQUMzQixRQUFRLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQztJQUM1QyxRQUFRLElBQUksQ0FBQyxZQUFZLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQztJQUM5Qzs7SUFFQSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7SUFDbkIsUUFBUSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDbkMsUUFBUSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7O0lBRWpEO0lBQ0EsUUFBUSxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtJQUN2QyxZQUFZLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDO0lBQy9DLFlBQVksT0FBTyxNQUFNO0lBQ3pCOztJQUVBO0lBQ0EsUUFBUSxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEdBQUc7SUFDM0QsUUFBUSxJQUFJLGNBQWM7O0lBRTFCO0lBQ0EsUUFBUSxjQUFjLEdBQUcsTUFBTTtJQUMvQixRQUFRLE9BQU8sSUFBSSxFQUFFO0lBQ3JCO0lBQ0EsWUFBWSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDO0lBQ3hFLFlBQVksSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7SUFDL0M7SUFDQSxnQkFBZ0IsSUFBSSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqRTtJQUNBLGdCQUFnQixJQUFJLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksUUFBUSxFQUFFO0lBQ3RELG9CQUFvQjtJQUNwQixpQkFBaUIsTUFBTTtJQUN2QjtJQUNBLG9CQUFvQixjQUFjLEdBQUcsV0FBVztJQUNoRDtJQUNBLGFBQWEsTUFBTTtJQUNuQjtJQUNBLGdCQUFnQjtJQUNoQjtJQUNBOztJQUVBO0lBQ0EsUUFBUSxjQUFjLEdBQUcsTUFBTTtJQUMvQixRQUFRLE9BQU8sSUFBSSxFQUFFO0lBQ3JCO0lBQ0EsWUFBWSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDO0lBQ3ZFLFlBQVksSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7SUFDL0M7SUFDQSxnQkFBZ0IsR0FBRyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNoRTtJQUNBLGdCQUFnQixJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUU7SUFDdEQsb0JBQW9CO0lBQ3BCLGlCQUFpQixNQUFNO0lBQ3ZCO0lBQ0Esb0JBQW9CLGNBQWMsR0FBRyxXQUFXO0lBQ2hEO0lBQ0EsYUFBYSxNQUFNO0lBQ25CO0lBQ0EsZ0JBQWdCO0lBQ2hCO0lBQ0E7O0lBRUEsUUFBUSxPQUFPO0lBQ2YsWUFBWSxHQUFHLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO0lBQ25ELFlBQVksTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztJQUN2QyxZQUFZLElBQUksRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUM7SUFDNUMsWUFBWSxLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDO0lBQzdDO0lBQ0E7SUFDQTs7SUNqSEE7SUFDQTtJQUNBOztJQUVBLFNBQVMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDM0IsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsT0FBTztJQUNqRCxJQUFJLElBQUksR0FBRyxZQUFZLEtBQUssRUFBRTtJQUM5QixRQUFRLE9BQU8sR0FBRztJQUNsQixLQUFLO0lBQ0wsSUFBSSxJQUFJLEdBQUcsSUFBSSxTQUFTLEVBQUU7SUFDMUIsUUFBUSxJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUU7SUFDaEMsWUFBWSxLQUFLLEdBQUcsQ0FBQztJQUNyQixnQkFBZ0IsR0FBRyxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDO0lBQzFDLGdCQUFnQixJQUFJLEVBQUU7SUFDdEIsYUFBYSxDQUFDO0lBQ2QsU0FBUztJQUNULFFBQVEsR0FBRyxHQUFHLElBQUksa0JBQWtCLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM3QztJQUNBLElBQUksT0FBTyxJQUFJLFVBQVUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDMUM7O0lBRUE7SUFDQTtJQUNBOztJQUVBLFNBQVMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7SUFDNUIsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsT0FBTztJQUNuQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM1QixJQUFJLE9BQU8sSUFBSSxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDbEM7Ozs7Ozs7Ozs7Ozs7Ozs7OyJ9
