
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
            offset = this.check(offset);
            // accumulate nearby from all sources
            const prev_list = [], next_list = [];
            const center_list = [];
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
            offset = this.check(offset);
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
    exports.logical_expr = logical_expr;
    exports.logical_merge = logical_merge;
    exports.merge = merge;
    exports.playback = cursor;
    exports.shift = shift;
    exports.variable = cursor;

    return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hcGlfY2FsbGJhY2suanMiLCIuLi8uLi9zcmMvc3RhdGVwcm92aWRlcl9iYXNlcy5qcyIsIi4uLy4uL3NyYy9pbnRlcnZhbHMuanMiLCIuLi8uLi9zcmMvc3RhdGVwcm92aWRlcl9zaW1wbGUuanMiLCIuLi8uLi9zcmMvbmVhcmJ5aW5kZXguanMiLCIuLi8uLi9zcmMvYXBpX2V2ZW50aWZ5LmpzIiwiLi4vLi4vc3JjL2FwaV9zcmNwcm9wLmpzIiwiLi4vLi4vc3JjL3NlZ21lbnRzLmpzIiwiLi4vLi4vc3JjL3V0aWwuanMiLCIuLi8uLi9zcmMvbmVhcmJ5aW5kZXhfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL2xheWVycy5qcyIsIi4uLy4uL3NyYy9vcHMvbWVyZ2UuanMiLCIuLi8uLi9zcmMvb3BzL3NoaWZ0LmpzIiwiLi4vLi4vc3JjL3N0YXRlcHJvdmlkZXJfY2xvY2suanMiLCIuLi8uLi9zcmMvY21kLmpzIiwiLi4vLi4vc3JjL21vbml0b3IuanMiLCIuLi8uLi9zcmMvY3Vyc29ycy5qcyIsIi4uLy4uL3NyYy9vcHMvYm9vbGVhbi5qcyIsIi4uLy4uL3NyYy9vcHMvbG9naWNhbF9tZXJnZS5qcyIsIi4uLy4uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICAgIFRoaXMgZGVjb3JhdGVzIGFuIG9iamVjdC9wcm90b3R5cGUgd2l0aCBiYXNpYyAoc3luY2hyb25vdXMpIGNhbGxiYWNrIHN1cHBvcnQuXG4qL1xuXG5jb25zdCBQUkVGSVggPSBcIl9fY2FsbGJhY2tcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2Uob2JqZWN0KSB7XG4gICAgb2JqZWN0W2Ake1BSRUZJWH1faGFuZGxlcnNgXSA9IFtdO1xufVxuXG5mdW5jdGlvbiBhZGRfY2FsbGJhY2sgKGhhbmRsZXIpIHtcbiAgICBsZXQgaGFuZGxlID0ge1xuICAgICAgICBoYW5kbGVyOiBoYW5kbGVyXG4gICAgfVxuICAgIHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLnB1c2goaGFuZGxlKTtcbiAgICByZXR1cm4gaGFuZGxlO1xufTtcblxuZnVuY3Rpb24gcmVtb3ZlX2NhbGxiYWNrIChoYW5kbGUpIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5pbmRleG9mKGhhbmRsZSk7XG4gICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBub3RpZnlfY2FsbGJhY2tzIChlQXJnKSB7XG4gICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uZm9yRWFjaChmdW5jdGlvbihoYW5kbGUpIHtcbiAgICAgICAgaGFuZGxlLmhhbmRsZXIoZUFyZyk7XG4gICAgfSk7XG59O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgYWRkX2NhbGxiYWNrLCByZW1vdmVfY2FsbGJhY2ssIG5vdGlmeV9jYWxsYmFja3NcbiAgICB9XG4gICAgT2JqZWN0LmFzc2lnbihfcHJvdG90eXBlLCBhcGkpO1xufVxuXG5cbiIsImltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL2FwaV9jYWxsYmFjay5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTVEFURSBQUk9WSURFUiBCQVNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIEJhc2UgY2xhc3MgZm9yIFN0YXRlUHJvdmlkZXJzXG5cbiAgICAtIGNvbGxlY3Rpb24gb2YgaXRlbXNcbiAgICAtIHtrZXksIGl0diwgdHlwZSwgZGF0YX1cbiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0ZVByb3ZpZGVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiB1cGRhdGUgZnVuY3Rpb25cbiAgICAgKiBcbiAgICAgKiBJZiBJdGVtc1Byb3ZpZGVyIGlzIGEgcHJveHkgdG8gYW4gb25saW5lXG4gICAgICogSXRlbXMgY29sbGVjdGlvbiwgdXBkYXRlIHJlcXVlc3RzIHdpbGwgXG4gICAgICogaW1wbHkgYSBuZXR3b3JrIHJlcXVlc3RcbiAgICAgKiBcbiAgICAgKiBvcHRpb25zIC0gc3VwcG9ydCByZXNldCBmbGFnIFxuICAgICAqL1xuICAgIHVwZGF0ZShpdGVtcywgb3B0aW9ucz17fSl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZXR1cm4gYXJyYXkgd2l0aCBhbGwgaXRlbXMgaW4gY29sbGVjdGlvbiBcbiAgICAgKiAtIG5vIHJlcXVpcmVtZW50IHdydCBvcmRlclxuICAgICAqL1xuXG4gICAgZ2V0X2l0ZW1zKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc2lnbmFsIGlmIGl0ZW1zIGNhbiBiZSBvdmVybGFwcGluZyBvciBub3RcbiAgICAgKi9cblxuICAgIGdldCBpbmZvICgpIHtcbiAgICAgICAgcmV0dXJuIHtvdmVybGFwcGluZzogdHJ1ZX07XG4gICAgfVxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoU3RhdGVQcm92aWRlckJhc2UucHJvdG90eXBlKTtcblxuXG5cblxuIiwiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gICAgKiBcbiAgICAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAgICAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICAgICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gICAgKiBcbiAgICAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICAgICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAgICAqIFxuICAgICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG5cbiovXG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuXG5cbiAgICBOT1RFIFxuICAgIC0gY21wKDRdLFs0ICkgPT0gMCAtIHNpbmNlIHRoZXNlIGFyZSB0aGUgc2FtZSB3aXRoIHJlc3BlY3QgdG8gc29ydGluZ1xuICAgIC0gYnV0IGlmIHlvdSB3YW50IHRvIHNlZSBpZiB0d28gaW50ZXJ2YWxzIGFyZSBvdmVybGFwcGluZyBpbiB0aGUgZW5kcG9pbnRzXG4gICAgY21wKGhpZ2hfYSwgbG93X2IpID4gMCB0aGlzIHdpbGwgbm90IGJlIGdvb2RcbiAgICBcbiovIFxuXG5cbmZ1bmN0aW9uIGNtcE51bWJlcnMoYSwgYikge1xuICAgIGlmIChhID09PSBiKSByZXR1cm4gMDtcbiAgICBpZiAoYSA9PT0gSW5maW5pdHkpIHJldHVybiAxO1xuICAgIGlmIChiID09PSBJbmZpbml0eSkgcmV0dXJuIC0xO1xuICAgIGlmIChhID09PSAtSW5maW5pdHkpIHJldHVybiAtMTtcbiAgICBpZiAoYiA9PT0gLUluZmluaXR5KSByZXR1cm4gMTtcbiAgICByZXR1cm4gYSAtIGI7XG4gIH1cblxuZnVuY3Rpb24gZW5kcG9pbnRfY21wIChwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICBsZXQgZGlmZiA9IGNtcE51bWJlcnModjEsIHYyKTtcbiAgICByZXR1cm4gKGRpZmYgIT0gMCkgPyBkaWZmIDogczEgLSBzMjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludCB0byB0aGUgb3RoZXIgc2lkZVxuICogXG4gKiB1c2VmdWwgZm9yIG1ha2luZyBiYWNrLXRvLWJhY2sgaW50ZXJ2YWxzIFxuICogXG4gKiBoaWdoKSA8LT4gW2xvd1xuICogaGlnaF0gPC0+IChsb3dcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKHAsIHRhcmdldCkge1xuICAgIGxldCBbdixzXSA9IHA7XG4gICAgaWYgKCFpc0Zpbml0ZSh2KSkge1xuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgaWYgKHRhcmdldCA9PSBcImxvd1wiKSB7XG4gICAgXHQvLyBhc3N1bWUgcG9pbnQgaXMgaGlnaDogc2lnbiBtdXN0IGJlIC0xIG9yIDBcbiAgICBcdGlmIChzID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBsb3dcIik7ICAgIFx0XHRcbiAgICBcdH1cbiAgICAgICAgcCA9IFt2LCBzKzFdO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09IFwiaGlnaFwiKSB7XG5cdFx0Ly8gYXNzdW1lIHBvaW50IGlzIGxvdzogc2lnbiBpcyAwIG9yIDFcbiAgICBcdGlmIChzIDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBoaWdoXCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcy0xXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0eXBlXCIsIHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBsZXQgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBsZXQgbG93X3AgPSAobG93Q2xvc2VkKSA/IFtsb3csIDBdIDogW2xvdywgMV07IFxuICAgIGxldCBoaWdoX3AgPSAoaGlnaENsb3NlZCkgPyBbaGlnaCwgMF0gOiBbaGlnaCwgLTFdO1xuICAgIHJldHVybiBbbG93X3AsIGhpZ2hfcF07XG59XG5cblxuLypcbiAgICBJTlRFUlZBTFNcblxuICAgIEludGVydmFscyBhcmUgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXVxuXG4qLyBcblxuLypcbiAgICByZXR1cm4gdHJ1ZSBpZiBwb2ludCBwIGlzIGNvdmVyZWQgYnkgaW50ZXJ2YWwgaXR2XG4gICAgcG9pbnQgcCBjYW4gYmUgbnVtYmVyIHAgb3IgYSBwb2ludCBbcCxzXVxuXG4gICAgaW1wbGVtZW50ZWQgYnkgY29tcGFyaW5nIHBvaW50c1xuICAgIGV4Y2VwdGlvbiBpZiBpbnRlcnZhbCBpcyBub3QgZGVmaW5lZFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIHApIHtcbiAgICBsZXQgW2xvd19wLCBoaWdoX3BdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAvLyBjb3ZlcnM6IGxvdyA8PSBwIDw9IGhpZ2hcbiAgICByZXR1cm4gZW5kcG9pbnRfbGUobG93X3AsIHApICYmIGVuZHBvaW50X2xlKHAsIGhpZ2hfcCk7XG59XG4vLyBjb252ZW5pZW5jZVxuZnVuY3Rpb24gaW50ZXJ2YWxfY292ZXJzX3BvaW50KGl0diwgcCkge1xuICAgIHJldHVybiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBbcCwgMF0pO1xufVxuXG5cblxuLypcbiAgICBSZXR1cm4gdHJ1ZSBpZiBpbnRlcnZhbCBoYXMgbGVuZ3RoIDBcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9pc19zaW5ndWxhcihpbnRlcnZhbCkge1xuICAgIHJldHVybiBpbnRlcnZhbFswXSA9PSBpbnRlcnZhbFsxXVxufVxuXG4vKlxuICAgIENyZWF0ZSBpbnRlcnZhbCBmcm9tIGVuZHBvaW50c1xuKi9cbmZ1bmN0aW9uIGludGVydmFsX2Zyb21fZW5kcG9pbnRzKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIC8vIHAxIG11c3QgYmUgYSBsb3cgcG9pbnRcbiAgICBpZiAoczEgPT0gLTEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBsb3cgcG9pbnRcIiwgcDEpO1xuICAgIH1cbiAgICBpZiAoczIgPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2VhbCBoaWdoIHBvaW50XCIsIHAyKTsgICBcbiAgICB9XG4gICAgcmV0dXJuIFt2MSwgdjIsIChzMT09MCksIChzMj09MCldXG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKG4pIHtcbiAgICByZXR1cm4gdHlwZW9mIG4gPT0gXCJudW1iZXJcIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGludGVydmFsX2Zyb21faW5wdXQoaW5wdXQpe1xuICAgIGxldCBpdHYgPSBpbnB1dDtcbiAgICBpZiAoaXR2ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnB1dCBpcyB1bmRlZmluZWRcIik7XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShpdHYpKSB7XG4gICAgICAgIGlmIChpc051bWJlcihpdHYpKSB7XG4gICAgICAgICAgICAvLyBpbnB1dCBpcyBzaW5ndWxhciBudW1iZXJcbiAgICAgICAgICAgIGl0diA9IFtpdHYsIGl0diwgdHJ1ZSwgdHJ1ZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlucHV0OiAke2lucHV0fTogbXVzdCBiZSBBcnJheSBvciBOdW1iZXJgKVxuICAgICAgICB9XG4gICAgfTtcbiAgICAvLyBtYWtlIHN1cmUgaW50ZXJ2YWwgaXMgbGVuZ3RoIDRcbiAgICBpZiAoaXR2Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGl0diA9IFtpdHZbMF0sIGl0dlswXSwgdHJ1ZSwgdHJ1ZV1cbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMikge1xuICAgICAgICBpdHYgPSBpdHYuY29uY2F0KFt0cnVlLCBmYWxzZV0pO1xuICAgIH0gZWxzZSBpZiAoaXR2Lmxlbmd0aCA9PSAzKSB7XG4gICAgICAgIGl0diA9IGl0di5wdXNoKGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPiA0KSB7XG4gICAgICAgIGl0diA9IGl0di5zbGljZSgwLDQpO1xuICAgIH1cbiAgICBsZXQgW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdID0gaXR2O1xuICAgIC8vIHVuZGVmaW5lZFxuICAgIGlmIChsb3cgPT0gdW5kZWZpbmVkIHx8IGxvdyA9PSBudWxsKSB7XG4gICAgICAgIGxvdyA9IC1JbmZpbml0eTtcbiAgICB9XG4gICAgaWYgKGhpZ2ggPT0gdW5kZWZpbmVkIHx8IGhpZ2ggPT0gbnVsbCkge1xuICAgICAgICBoaWdoID0gSW5maW5pdHk7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93IGFuZCBoaWdoIGFyZSBudW1iZXJzXG4gICAgaWYgKCFpc051bWJlcihsb3cpKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgbm90IGEgbnVtYmVyXCIsIGxvdyk7XG4gICAgaWYgKCFpc051bWJlcihoaWdoKSkgdGhyb3cgbmV3IEVycm9yKFwiaGlnaCBub3QgYSBudW1iZXJcIiwgaGlnaCk7XG4gICAgLy8gY2hlY2sgdGhhdCBsb3cgPD0gaGlnaFxuICAgIGlmIChsb3cgPiBoaWdoKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgPiBoaWdoXCIsIGxvdywgaGlnaCk7XG4gICAgLy8gc2luZ2xldG9uXG4gICAgaWYgKGxvdyA9PSBoaWdoKSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIGluZmluaXR5IHZhbHVlc1xuICAgIGlmIChsb3cgPT0gLUluZmluaXR5KSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoaGlnaCA9PSBJbmZpbml0eSkge1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGUgYXJlIGJvb2xlYW5zXG4gICAgaWYgKHR5cGVvZiBsb3dJbmNsdWRlICE9PSBcImJvb2xlYW5cIikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJsb3dJbmNsdWRlIG5vdCBib29sZWFuXCIpO1xuICAgIH0gXG4gICAgaWYgKHR5cGVvZiBoaWdoSW5jbHVkZSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaGlnaEluY2x1ZGUgbm90IGJvb2xlYW5cIik7XG4gICAgfVxuICAgIHJldHVybiBbbG93LCBoaWdoLCBsb3dJbmNsdWRlLCBoaWdoSW5jbHVkZV07XG59XG5cblxuXG5cbmV4cG9ydCBjb25zdCBlbmRwb2ludCA9IHtcbiAgICBsZTogZW5kcG9pbnRfbGUsXG4gICAgbHQ6IGVuZHBvaW50X2x0LFxuICAgIGdlOiBlbmRwb2ludF9nZSxcbiAgICBndDogZW5kcG9pbnRfZ3QsXG4gICAgY21wOiBlbmRwb2ludF9jbXAsXG4gICAgZXE6IGVuZHBvaW50X2VxLFxuICAgIG1pbjogZW5kcG9pbnRfbWluLFxuICAgIG1heDogZW5kcG9pbnRfbWF4LFxuICAgIGZsaXA6IGVuZHBvaW50X2ZsaXAsXG4gICAgZnJvbV9pbnRlcnZhbDogZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWxcbn1cbmV4cG9ydCBjb25zdCBpbnRlcnZhbCA9IHtcbiAgICBjb3ZlcnNfZW5kcG9pbnQ6IGludGVydmFsX2NvdmVyc19lbmRwb2ludCxcbiAgICBjb3ZlcnNfcG9pbnQ6IGludGVydmFsX2NvdmVyc19wb2ludCwgXG4gICAgaXNfc2luZ3VsYXI6IGludGVydmFsX2lzX3Npbmd1bGFyLFxuICAgIGZyb21fZW5kcG9pbnRzOiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyxcbiAgICBmcm9tX2lucHV0OiBpbnRlcnZhbF9mcm9tX2lucHV0XG59XG4iLCJpbXBvcnQgeyBTdGF0ZVByb3ZpZGVyQmFzZSB9IGZyb20gXCIuL3N0YXRlcHJvdmlkZXJfYmFzZXMuanNcIjtcbmltcG9ydCB7IGVuZHBvaW50LCBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTE9DQUwgU1RBVEUgUFJPVklERVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMb2NhbCBBcnJheSB3aXRoIG5vbi1vdmVybGFwcGluZyBpdGVtcy5cbiAqL1xuXG5leHBvcnQgY2xhc3MgTG9jYWxTdGF0ZVByb3ZpZGVyIGV4dGVuZHMgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvLyBpbml0aWFsaXphdGlvblxuICAgICAgICBsZXQge2l0ZW1zLCB2YWx1ZX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoaXRlbXMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBpbml0aWFsaXplIGZyb20gaXRlbXNcbiAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gY2hlY2tfaW5wdXQoaXRlbXMpO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gaW5pdGlhbGl6ZSBmcm9tIHZhbHVlXG4gICAgICAgICAgICB0aGlzLl9pdGVtcyA9IFt7XG4gICAgICAgICAgICAgICAgaXR2OlstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSwgXG4gICAgICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgICAgICBkYXRhOnZhbHVlXG4gICAgICAgICAgICB9XTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGUgKGl0ZW1zLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gY2hlY2tfaW5wdXQoaXRlbXMpO1xuICAgICAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ2V0X2l0ZW1zICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2l0ZW1zLnNsaWNlKCk7XG4gICAgfVxuXG4gICAgZ2V0IGluZm8gKCkge1xuICAgICAgICByZXR1cm4ge292ZXJsYXBwaW5nOiBmYWxzZX07XG4gICAgfVxufVxuXG5cbmZ1bmN0aW9uIGNoZWNrX2lucHV0KGl0ZW1zKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnB1dCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgIH1cbiAgICAvLyBtYWtlIHN1cmUgdGhhdCBpbnRlcnZhbHMgYXJlIHdlbGwgZm9ybWVkXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICAgIGl0ZW0uaXR2ID0gaW50ZXJ2YWwuZnJvbV9pbnB1dChpdGVtLml0dik7XG4gICAgfVxuICAgIC8vIHNvcnQgaXRlbXMgYmFzZWQgb24gaW50ZXJ2YWwgbG93IGVuZHBvaW50XG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBsZXQgYV9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGEuaXR2KVswXTtcbiAgICAgICAgbGV0IGJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChiLml0dilbMF07XG4gICAgICAgIHJldHVybiBlbmRwb2ludC5jbXAoYV9sb3csIGJfbG93KTtcbiAgICB9KTtcbiAgICAvLyBjaGVjayB0aGF0IGl0ZW0gaW50ZXJ2YWxzIGFyZSBub24tb3ZlcmxhcHBpbmdcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBwcmV2X2hpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2kgLSAxXS5pdHYpWzFdO1xuICAgICAgICBsZXQgY3Vycl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2ldLml0dilbMF07XG4gICAgICAgIC8vIHZlcmlmeSB0aGF0IHByZXYgaGlnaCBpcyBsZXNzIHRoYXQgY3VyciBsb3dcbiAgICAgICAgaWYgKCFlbmRwb2ludC5sdChwcmV2X2hpZ2gsIGN1cnJfbG93KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT3ZlcmxhcHBpbmcgaW50ZXJ2YWxzIGZvdW5kXCIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuXG5cblxuIiwiaW1wb3J0IHsgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE5FQVJCWSBJTkRFWFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEFic3RyYWN0IHN1cGVyY2xhc3MgZm9yIE5lYXJieUluZGV4ZS5cbiAqIFxuICogU3VwZXJjbGFzcyB1c2VkIHRvIGNoZWNrIHRoYXQgYSBjbGFzcyBpbXBsZW1lbnRzIHRoZSBuZWFyYnkoKSBtZXRob2QsIFxuICogYW5kIHByb3ZpZGUgc29tZSBjb252ZW5pZW5jZSBtZXRob2RzLlxuICogXG4gKiBORUFSQlkgSU5ERVhcbiAqIFxuICogTmVhcmJ5SW5kZXggcHJvdmlkZXMgaW5kZXhpbmcgc3VwcG9ydCBvZiBlZmZlY3RpdmVseVxuICogbG9va2luZyB1cCByZWdpb25zIGJ5IG9mZnNldCwgXG4gKiBnaXZlbiB0aGF0XG4gKiAoaSkgZWFjaCByZWdpb24gaXMgYXNzb2NpYXRlZCB3aXRoIGFuIGludGVydmFsIGFuZCxcbiAqIChpaSkgcmVnaW9ucyBhcmUgbm9uLW92ZXJsYXBwaW5nLlxuICogXG4gKiBORUFSQllcbiAqIFRoZSBuZWFyYnkgbWV0aG9kIHJldHVybnMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG5laWdoYm9yaG9vZCBcbiAqIGFyb3VuZCBlbmRwb2ludC4gXG4gKiBcbiAqIFJldHVybnMge1xuICogICAgICBjZW50ZXI6IGxpc3Qgb2Ygb2JqZWN0cyBjb3ZlcmVkIGJ5IHJlZ2lvbixcbiAqICAgICAgaXR2OiByZWdpb24gaW50ZXJ2YWwgLSB2YWxpZGl0eSBvZiBjZW50ZXIgXG4gKiAgICAgIGxlZnQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgbGVmdCBcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGhpZ2gtZW5kcG9pbnQgb3IgWy1JbmZpbml0eSwgMF1cbiAqICAgICAgcmlnaHQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgcmlnaHRcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGxvdy1lbmRwb2ludCBvciBbSW5maW5pdHksIDBdICAgIFxuICogXG4gKiBcbiAqIFRoZSBuZWFyYnkgc3RhdGUgaXMgd2VsbC1kZWZpbmVkIGZvciBldmVyeSBlbmRwb2ludFxuICogb24gdGhlIHRpbWVsaW5lLlxuICogXG4gKiBJTlRFUlZBTFNcbiAqIFxuICogW2xvdywgaGlnaCwgbG93SW5jbHVzaXZlLCBoaWdoSW5jbHVzaXZlXVxuICogXG4gKiBUaGlzIHJlcHJlc2VudGF0aW9uIGVuc3VyZXMgdGhhdCB0aGUgaW50ZXJ2YWwgZW5kcG9pbnRzIFxuICogYXJlIG9yZGVyZWQgYW5kIGFsbG93cyBpbnRlcnZhbHMgdG8gYmUgZXhjbHVzaXZlIG9yIGluY2x1c2l2ZSwgXG4gKiB5ZXQgY292ZXIgdGhlIGVudGlyZSByZWFsIGxpbmUgXG4gKiBcbiAqIFthLGJdLCAoYSxiKSwgW2EsYiksIFthLCBiKSBhcmUgYWxsIHZhbGlkIGludGVydmFsc1xuICogXG4gKiBcbiAqIElOVEVSVkFMIEVORFBPSU5UU1xuICogXG4gKiBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIGRlZmluZWQgYnkgW3ZhbHVlLCBzaWduXSwgZm9yIGV4YW1wbGVcbiAqIFxuICogNCkgLT4gWzQsLTFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIGxlZnQgb2YgNFxuICogWzQsIDQsIDRdIC0+IFs0LCAwXSAtIGVuZHBvaW50IGlzIGF0IDQgXG4gKiAoNCAtPiBbNCwgMV0gLSBlbmRwb2ludCBpcyBvbiB0aGUgcmlnaHQgb2YgNClcbiAqIFxuICogIFxuICovXG5cblxuLyoqXG4gKiByZXR1cm4gZmlyc3QgaGlnaCBlbmRwb2ludCBvbiB0aGUgbGVmdCBmcm9tIG5lYXJieSxcbiAqIHdoaWNoIGlzIG5vdCBpbiBjZW50ZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxlZnRfZW5kcG9pbnQgKG5lYXJieSkge1xuICAgIGNvbnN0IGxvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmVhcmJ5Lml0dilbMF07XG4gICAgcmV0dXJuIGVuZHBvaW50LmZsaXAobG93LCBcImhpZ2hcIik7XG59XG5cbi8qKlxuICogcmV0dXJuIGZpcnN0IGxvdyBlbmRwb2ludCBvbiB0aGUgcmlnaHQgZnJvbSBuZWFyYnksXG4gKiB3aGljaCBpcyBub3QgaW4gY2VudGVyXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHJpZ2h0X2VuZHBvaW50IChuZWFyYnkpIHtcbiAgICBjb25zdCBoaWdoID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChuZWFyYnkuaXR2KVsxXTtcbiAgICByZXR1cm4gZW5kcG9pbnQuZmxpcChoaWdoLCBcImxvd1wiKTtcbn1cblxuXG5cbmV4cG9ydCBjbGFzcyBOZWFyYnlJbmRleEJhc2Uge1xuXG5cbiAgICAvKiBcbiAgICAgICAgTmVhcmJ5IG1ldGhvZFxuICAgICovXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgY2hlY2sob2Zmc2V0KSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgb2Zmc2V0ID0gW29mZnNldCwgMF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG9mZnNldCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVuZHBvaW50IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9mZnNldDtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICByZXR1cm4gbG93IHBvaW50IG9mIGxlZnRtb3N0IGVudHJ5XG4gICAgKi9cbiAgICBmaXJzdCgpIHtcbiAgICAgICAgbGV0IHtjZW50ZXIsIHJpZ2h0fSA9IHRoaXMubmVhcmJ5KFstSW5maW5pdHksIDBdKTtcbiAgICAgICAgcmV0dXJuIChjZW50ZXIubGVuZ3RoID4gMCkgPyBbLUluZmluaXR5LCAwXSA6IHJpZ2h0O1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHJldHVybiBoaWdoIHBvaW50IG9mIHJpZ2h0bW9zdCBlbnRyeVxuICAgICovXG4gICAgbGFzdCgpIHtcbiAgICAgICAgbGV0IHtsZWZ0LCBjZW50ZXJ9ID0gdGhpcy5uZWFyYnkoW0luZmluaXR5LCAwXSk7XG4gICAgICAgIHJldHVybiAoY2VudGVyLmxlbmd0aCA+IDApID8gW0luZmluaXR5LCAwXSA6IGxlZnRcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIHJldHVybiBuZWFyYnkgb2YgZmlyc3QgcmVnaW9uIHRvIHRoZSByaWdodFxuICAgICAqIHdoaWNoIGlzIG5vdCB0aGUgY2VudGVyIHJlZ2lvbi4gSWYgbm90IGV4aXN0cywgcmV0dXJuXG4gICAgICogdW5kZWZpbmVkLiBcbiAgICAgKi9cbiAgICByaWdodF9yZWdpb24obmVhcmJ5KSB7XG4gICAgICAgIGNvbnN0IHJpZ2h0ID0gcmlnaHRfZW5kcG9pbnQobmVhcmJ5KTtcbiAgICAgICAgaWYgKHJpZ2h0WzBdID09IEluZmluaXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm5lYXJieShyaWdodCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIG5lYXJieSBvZiBmaXJzdCByZWdpb24gdG8gdGhlIGxlZnRcbiAgICAgKiB3aGljaCBpcyBub3QgdGhlIGNlbnRlciByZWdpb24uIElmIG5vdCBleGlzdHMsIHJldHVyblxuICAgICAqIHVuZGVmaW5lZC4gXG4gICAgICovXG4gICAgbGVmdF9yZWdpb24obmVhcmJ5KSB7XG4gICAgICAgIGNvbnN0IGxlZnQgPSBsZWZ0X2VuZHBvaW50KG5lYXJieSk7XG4gICAgICAgIGlmIChsZWZ0WzBdID09IC1JbmZpbml0eSkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5uZWFyYnkobGVmdCk7ICAgIFxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGZpbmQgZmlyc3QgcmVnaW9uIHRvIHRoZSBcInJpZ2h0XCIgb3IgXCJsZWZ0XCJcbiAgICAgKiB3aGljaCBpcyBub3QgdGhlIGNlbnRlciByZWdpb24sIGFuZCB3aGljaCBtZWV0c1xuICAgICAqIGEgY29uZGl0aW9uIG9uIG5lYXJieS5jZW50ZXIuXG4gICAgICogRGVmYXVsdCBjb25kaXRpb24gaXMgY2VudGVyIG5vbi1lbXB0eVxuICAgICAqIElmIG5vdCBleGlzdHMsIHJldHVybiB1bmRlZmluZWQuIFxuICAgICAqL1xuICAgIFxuICAgIGZpbmRfcmVnaW9uKG5lYXJieSwgb3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge1xuICAgICAgICAgICAgZGlyZWN0aW9uID0gMSxcbiAgICAgICAgICAgIGNvbmRpdGlvbiA9IChjZW50ZXIpID0+IGNlbnRlci5sZW5ndGggPiAwXG4gICAgICAgIH0gPSBvcHRpb25zO1xuICAgICAgICBsZXQgbmV4dF9uZWFyYnk7XG4gICAgICAgIHdoaWxlKHRydWUpIHtcbiAgICAgICAgICAgIGlmIChkaXJlY3Rpb24gPT0gMSkge1xuICAgICAgICAgICAgICAgIG5leHRfbmVhcmJ5ID0gdGhpcy5yaWdodF9yZWdpb24obmVhcmJ5KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmV4dF9uZWFyYnkgPSB0aGlzLmxlZnRfcmVnaW9uKG5lYXJieSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobmV4dF9uZWFyYnkgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjb25kaXRpb24obmV4dF9uZWFyYnkuY2VudGVyKSkge1xuICAgICAgICAgICAgICAgIC8vIGZvdW5kIHJlZ2lvbiBcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV4dF9uZWFyYnk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyByZWdpb24gbm90IGZvdW5kXG4gICAgICAgICAgICAvLyBjb250aW51ZSBzZWFyY2hpbmcgdGhlIHJpZ2h0XG4gICAgICAgICAgICBuZWFyYnkgPSBuZXh0X25lYXJieTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlZ2lvbnMob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gbmV3IFJlZ2lvbkl0ZXJhdG9yKHRoaXMsIG9wdGlvbnMpO1xuICAgIH1cblxufVxuXG5cbi8qXG4gICAgSXRlcmF0ZSByZWdpb25zIG9mIGluZGV4IGZyb20gbGVmdCB0byByaWdodFxuXG4gICAgSXRlcmF0aW9uIGxpbWl0ZWQgdG8gaW50ZXJ2YWwgW3N0YXJ0LCBzdG9wXSBvbiB0aGUgdGltZWxpbmUuXG4gICAgUmV0dXJucyBsaXN0IG9mIGl0ZW0tbGlzdHMuXG4gICAgb3B0aW9uc1xuICAgIC0gc3RhcnRcbiAgICAtIHN0b3BcbiAgICAtIGluY2x1ZGVFbXB0eVxuKi9cblxuY2xhc3MgUmVnaW9uSXRlcmF0b3Ige1xuXG4gICAgY29uc3RydWN0b3IoaW5kZXgsIG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtcbiAgICAgICAgICAgIHN0YXJ0PS1JbmZpbml0eSwgXG4gICAgICAgICAgICBzdG9wPUluZmluaXR5LCBcbiAgICAgICAgICAgIGluY2x1ZGVFbXB0eT10cnVlXG4gICAgICAgIH0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3RhcnQgPiBzdG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgKFwic3RvcCBtdXN0IGJlIGxhcmdlciB0aGFuIHN0YXJ0XCIsIHN0YXJ0LCBzdG9wKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gICAgICAgIHRoaXMuX3N0YXJ0ID0gW3N0YXJ0LCAwXTtcbiAgICAgICAgdGhpcy5fc3RvcCA9IFtzdG9wLCAwXTtcblxuICAgICAgICBpZiAoaW5jbHVkZUVtcHR5KSB7XG4gICAgICAgICAgICB0aGlzLl9jb25kaXRpb24gPSAoKSA9PiB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY29uZGl0aW9uID0gKGNlbnRlcikgPT4gY2VudGVyLmxlbmd0aCA+IDA7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY3VycmVudDtcbiAgICB9XG5cbiAgICBuZXh0KCkge1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIGluaXRpYWxzZVxuICAgICAgICAgICAgdGhpcy5fY3VycmVudCA9IHRoaXMuX2luZGV4Lm5lYXJieSh0aGlzLl9zdGFydCk7XG4gICAgICAgICAgICBpZiAodGhpcy5fY29uZGl0aW9uKHRoaXMuX2N1cnJlbnQuY2VudGVyKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dGhpcy5fY3VycmVudCwgZG9uZTpmYWxzZX07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbGV0IG9wdGlvbnMgPSB7Y29uZGl0aW9uOnRoaXMuX2NvbmRpdGlvbiwgZGlyZWN0aW9uOjF9XG4gICAgICAgIHRoaXMuX2N1cnJlbnQgPSB0aGlzLl9pbmRleC5maW5kX3JlZ2lvbih0aGlzLl9jdXJyZW50LCBvcHRpb25zKTtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4ge3ZhbHVlOnVuZGVmaW5lZCwgZG9uZTp0cnVlfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dGhpcy5fY3VycmVudCwgZG9uZTpmYWxzZX1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIFtTeW1ib2wuaXRlcmF0b3JdKCkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59XG5cblxuXG4iLCIvKlxuXHRDb3B5cmlnaHQgMjAyMFxuXHRBdXRob3IgOiBJbmdhciBBcm50emVuXG5cblx0VGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFRpbWluZ3NyYyBtb2R1bGUuXG5cblx0VGltaW5nc3JjIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnlcblx0aXQgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5XG5cdHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yXG5cdChhdCB5b3VyIG9wdGlvbikgYW55IGxhdGVyIHZlcnNpb24uXG5cblx0VGltaW5nc3JjIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsXG5cdGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mXG5cdE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS4gIFNlZSB0aGVcblx0R05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG5cblx0WW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlXG5cdGFsb25nIHdpdGggVGltaW5nc3JjLiAgSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+LlxuKi9cblxuXG5cbi8qXG5cdEV2ZW50XG5cdC0gbmFtZTogZXZlbnQgbmFtZVxuXHQtIHB1Ymxpc2hlcjogdGhlIG9iamVjdCB3aGljaCBkZWZpbmVkIHRoZSBldmVudFxuXHQtIGluaXQ6IHRydWUgaWYgdGhlIGV2ZW50IHN1cHBwb3J0cyBpbml0IGV2ZW50c1xuXHQtIHN1YnNjcmlwdGlvbnM6IHN1YnNjcmlwdGlucyB0byB0aGlzIGV2ZW50XG5cbiovXG5cbmNsYXNzIEV2ZW50IHtcblxuXHRjb25zdHJ1Y3RvciAocHVibGlzaGVyLCBuYW1lLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLnB1Ymxpc2hlciA9IHB1Ymxpc2hlcjtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMuaW5pdCA9IChvcHRpb25zLmluaXQgPT09IHVuZGVmaW5lZCkgPyBmYWxzZSA6IG9wdGlvbnMuaW5pdDtcblx0XHR0aGlzLnN1YnNjcmlwdGlvbnMgPSBbXTtcblx0fVxuXG5cdC8qXG5cdFx0c3Vic2NyaWJlIHRvIGV2ZW50XG5cdFx0LSBzdWJzY3JpYmVyOiBzdWJzY3JpYmluZyBvYmplY3Rcblx0XHQtIGNhbGxiYWNrOiBjYWxsYmFjayBmdW5jdGlvbiB0byBpbnZva2Vcblx0XHQtIG9wdGlvbnM6XG5cdFx0XHRpbml0OiBpZiB0cnVlIHN1YnNjcmliZXIgd2FudHMgaW5pdCBldmVudHNcblx0Ki9cblx0c3Vic2NyaWJlIChjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdGlmICghY2FsbGJhY2sgfHwgdHlwZW9mIGNhbGxiYWNrICE9PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIG5vdCBhIGZ1bmN0aW9uXCIsIGNhbGxiYWNrKTtcblx0XHR9XG5cdFx0Y29uc3Qgc3ViID0gbmV3IFN1YnNjcmlwdGlvbih0aGlzLCBjYWxsYmFjaywgb3B0aW9ucyk7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zLnB1c2goc3ViKTtcblx0ICAgIC8vIEluaXRpYXRlIGluaXQgY2FsbGJhY2sgZm9yIHRoaXMgc3Vic2NyaXB0aW9uXG5cdCAgICBpZiAodGhpcy5pbml0ICYmIHN1Yi5pbml0KSB7XG5cdCAgICBcdHN1Yi5pbml0X3BlbmRpbmcgPSB0cnVlO1xuXHQgICAgXHRsZXQgc2VsZiA9IHRoaXM7XG5cdCAgICBcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgXHRcdGNvbnN0IGVBcmdzID0gc2VsZi5wdWJsaXNoZXIuZXZlbnRpZnlJbml0RXZlbnRBcmdzKHNlbGYubmFtZSkgfHwgW107XG5cdCAgICBcdFx0c3ViLmluaXRfcGVuZGluZyA9IGZhbHNlO1xuXHQgICAgXHRcdGZvciAobGV0IGVBcmcgb2YgZUFyZ3MpIHtcblx0ICAgIFx0XHRcdHNlbGYudHJpZ2dlcihlQXJnLCBbc3ViXSwgdHJ1ZSk7XG5cdCAgICBcdFx0fVxuXHQgICAgXHR9KTtcblx0ICAgIH1cblx0XHRyZXR1cm4gc3ViXG5cdH1cblxuXHQvKlxuXHRcdHRyaWdnZXIgZXZlbnRcblxuXHRcdC0gaWYgc3ViIGlzIHVuZGVmaW5lZCAtIHB1Ymxpc2ggdG8gYWxsIHN1YnNjcmlwdGlvbnNcblx0XHQtIGlmIHN1YiBpcyBkZWZpbmVkIC0gcHVibGlzaCBvbmx5IHRvIGdpdmVuIHN1YnNjcmlwdGlvblxuXHQqL1xuXHR0cmlnZ2VyIChlQXJnLCBzdWJzLCBpbml0KSB7XG5cdFx0bGV0IGVJbmZvLCBjdHg7XG5cdFx0Zm9yIChjb25zdCBzdWIgb2Ygc3Vicykge1xuXHRcdFx0Ly8gaWdub3JlIHRlcm1pbmF0ZWQgc3Vic2NyaXB0aW9uc1xuXHRcdFx0aWYgKHN1Yi50ZXJtaW5hdGVkKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0ZUluZm8gPSB7XG5cdFx0XHRcdHNyYzogdGhpcy5wdWJsaXNoZXIsXG5cdFx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdFx0c3ViOiBzdWIsXG5cdFx0XHRcdGluaXQ6IGluaXRcblx0XHRcdH1cblx0XHRcdGN0eCA9IHN1Yi5jdHggfHwgdGhpcy5wdWJsaXNoZXI7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzdWIuY2FsbGJhY2suY2FsbChjdHgsIGVBcmcsIGVJbmZvKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgRXJyb3IgaW4gJHt0aGlzLm5hbWV9OiAke3N1Yi5jYWxsYmFja30gJHtlcnJ9YCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0dW5zdWJzY3JpYmUgZnJvbSBldmVudFxuXHQtIHVzZSBzdWJzY3JpcHRpb24gcmV0dXJuZWQgYnkgcHJldmlvdXMgc3Vic2NyaWJlXG5cdCovXG5cdHVuc3Vic2NyaWJlKHN1Yikge1xuXHRcdGxldCBpZHggPSB0aGlzLnN1YnNjcmlwdGlvbnMuaW5kZXhPZihzdWIpO1xuXHRcdGlmIChpZHggPiAtMSkge1xuXHRcdFx0dGhpcy5zdWJzY3JpcHRpb25zLnNwbGljZShpZHgsIDEpO1xuXHRcdFx0c3ViLnRlcm1pbmF0ZSgpO1xuXHRcdH1cblx0fVxufVxuXG5cbi8qXG5cdFN1YnNjcmlwdGlvbiBjbGFzc1xuKi9cblxuY2xhc3MgU3Vic2NyaXB0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcihldmVudCwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXHRcdHRoaXMuZXZlbnQgPSBldmVudDtcblx0XHR0aGlzLm5hbWUgPSBldmVudC5uYW1lO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFja1xuXHRcdHRoaXMuaW5pdCA9IChvcHRpb25zLmluaXQgPT09IHVuZGVmaW5lZCkgPyB0aGlzLmV2ZW50LmluaXQgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSBmYWxzZTtcblx0XHR0aGlzLmN0eCA9IG9wdGlvbnMuY3R4O1xuXHR9XG5cblx0dGVybWluYXRlKCkge1xuXHRcdHRoaXMudGVybWluYXRlZCA9IHRydWU7XG5cdFx0dGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmV2ZW50LnVuc3Vic2NyaWJlKHRoaXMpO1xuXHR9XG59XG5cblxuLypcblxuXHRFVkVOVElGWSBJTlNUQU5DRVxuXG5cdEV2ZW50aWZ5IGJyaW5ncyBldmVudGluZyBjYXBhYmlsaXRpZXMgdG8gYW55IG9iamVjdC5cblxuXHRJbiBwYXJ0aWN1bGFyLCBldmVudGlmeSBzdXBwb3J0cyB0aGUgaW5pdGlhbC1ldmVudCBwYXR0ZXJuLlxuXHRPcHQtaW4gZm9yIGluaXRpYWwgZXZlbnRzIHBlciBldmVudCB0eXBlLlxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cbiovXG5cbmV4cG9ydCBmdW5jdGlvbiBldmVudGlmeUluc3RhbmNlIChvYmplY3QpIHtcblx0b2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAgPSBuZXcgTWFwKCk7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRyZXR1cm4gb2JqZWN0O1xufTtcblxuXG4vKlxuXHRFVkVOVElGWSBQUk9UT1RZUEVcblxuXHRBZGQgZXZlbnRpZnkgZnVuY3Rpb25hbGl0eSB0byBwcm90b3R5cGUgb2JqZWN0XG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlQcm90b3R5cGUoX3Byb3RvdHlwZSkge1xuXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5R2V0RXZlbnQob2JqZWN0LCBuYW1lKSB7XG5cdFx0Y29uc3QgZXZlbnQgPSBvYmplY3QuX19ldmVudGlmeV9ldmVudE1hcC5nZXQobmFtZSk7XG5cdFx0aWYgKGV2ZW50ID09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRXZlbnQgdW5kZWZpbmVkXCIsIG5hbWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gZXZlbnQ7XG5cdH1cblxuXHQvKlxuXHRcdERFRklORSBFVkVOVFxuXHRcdC0gdXNlZCBvbmx5IGJ5IGV2ZW50IHNvdXJjZVxuXHRcdC0gbmFtZTogbmFtZSBvZiBldmVudFxuXHRcdC0gb3B0aW9uczoge2luaXQ6dHJ1ZX0gc3BlY2lmaWVzIGluaXQtZXZlbnQgc2VtYW50aWNzIGZvciBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeURlZmluZShuYW1lLCBvcHRpb25zKSB7XG5cdFx0Ly8gY2hlY2sgdGhhdCBldmVudCBkb2VzIG5vdCBhbHJlYWR5IGV4aXN0XG5cdFx0aWYgKHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5oYXMobmFtZSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IGFscmVhZHkgZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2V2ZW50TWFwLnNldChuYW1lLCBuZXcgRXZlbnQodGhpcywgbmFtZSwgb3B0aW9ucykpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T05cblx0XHQtIHVzZWQgYnkgc3Vic2NyaWJlclxuXHRcdHJlZ2lzdGVyIGNhbGxiYWNrIG9uIGV2ZW50LlxuXHQqL1xuXHRmdW5jdGlvbiBvbihuYW1lLCBjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmliZShjYWxsYmFjaywgb3B0aW9ucyk7XG5cdH07XG5cblx0Lypcblx0XHRPRkZcblx0XHQtIHVzZWQgYnkgc3Vic2NyaWJlclxuXHRcdFVuLXJlZ2lzdGVyIGEgaGFuZGxlciBmcm9tIGEgc3BlY2ZpYyBldmVudCB0eXBlXG5cdCovXG5cdGZ1bmN0aW9uIG9mZihzdWIpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBzdWIubmFtZSkudW5zdWJzY3JpYmUoc3ViKTtcblx0fTtcblxuXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5U3Vic2NyaXB0aW9ucyhuYW1lKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSkuc3Vic2NyaXB0aW9ucztcblx0fVxuXG5cblxuXHQvKlxuXHRcdFRyaWdnZXIgbGlzdCBvZiBldmVudEl0ZW1zIG9uIG9iamVjdFxuXG5cdFx0ZXZlbnRJdGVtOiAge25hbWU6Li4sIGVBcmc6Li59XG5cblx0XHRjb3B5IGFsbCBldmVudEl0ZW1zIGludG8gYnVmZmVyLlxuXHRcdHJlcXVlc3QgZW1wdHlpbmcgdGhlIGJ1ZmZlciwgaS5lLiBhY3R1YWxseSB0cmlnZ2VyaW5nIGV2ZW50cyxcblx0XHRldmVyeSB0aW1lIHRoZSBidWZmZXIgZ29lcyBmcm9tIGVtcHR5IHRvIG5vbi1lbXB0eVxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXJBbGwoZXZlbnRJdGVtcykge1xuXHRcdGlmIChldmVudEl0ZW1zLmxlbmd0aCA9PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gbWFrZSB0cmlnZ2VyIGl0ZW1zXG5cdFx0Ly8gcmVzb2x2ZSBub24tcGVuZGluZyBzdWJzY3JpcHRpb25zIG5vd1xuXHRcdC8vIGVsc2Ugc3Vic2NyaXB0aW9ucyBtYXkgY2hhbmdlIGZyb20gcGVuZGluZyB0byBub24tcGVuZGluZ1xuXHRcdC8vIGJldHdlZW4gaGVyZSBhbmQgYWN0dWFsIHRyaWdnZXJpbmdcblx0XHQvLyBtYWtlIGxpc3Qgb2YgW2V2LCBlQXJnLCBzdWJzXSB0dXBsZXNcblx0XHRsZXQgdHJpZ2dlckl0ZW1zID0gZXZlbnRJdGVtcy5tYXAoKGl0ZW0pID0+IHtcblx0XHRcdGxldCB7bmFtZSwgZUFyZ30gPSBpdGVtO1xuXHRcdFx0bGV0IGV2ID0gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKTtcblx0XHRcdGxldCBzdWJzID0gZXYuc3Vic2NyaXB0aW9ucy5maWx0ZXIoc3ViID0+IHN1Yi5pbml0X3BlbmRpbmcgPT0gZmFsc2UpO1xuXHRcdFx0cmV0dXJuIFtldiwgZUFyZywgc3Vic107XG5cdFx0fSwgdGhpcyk7XG5cblx0XHQvLyBhcHBlbmQgdHJpZ2dlciBJdGVtcyB0byBidWZmZXJcblx0XHRjb25zdCBsZW4gPSB0cmlnZ2VySXRlbXMubGVuZ3RoO1xuXHRcdGNvbnN0IGJ1ZiA9IHRoaXMuX19ldmVudGlmeV9idWZmZXI7XG5cdFx0Y29uc3QgYnVmX2xlbiA9IHRoaXMuX19ldmVudGlmeV9idWZmZXIubGVuZ3RoO1xuXHRcdC8vIHJlc2VydmUgbWVtb3J5IC0gc2V0IG5ldyBsZW5ndGhcblx0XHR0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aCA9IGJ1Zl9sZW4gKyBsZW47XG5cdFx0Ly8gY29weSB0cmlnZ2VySXRlbXMgdG8gYnVmZmVyXG5cdFx0Zm9yIChsZXQgaT0wOyBpPGxlbjsgaSsrKSB7XG5cdFx0XHRidWZbYnVmX2xlbitpXSA9IHRyaWdnZXJJdGVtc1tpXTtcblx0XHR9XG5cdFx0Ly8gcmVxdWVzdCBlbXB0eWluZyBvZiB0aGUgYnVmZmVyXG5cdFx0aWYgKGJ1Zl9sZW4gPT0gMCkge1xuXHRcdFx0bGV0IHNlbGYgPSB0aGlzO1xuXHRcdFx0UHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0Zm9yIChsZXQgW2V2LCBlQXJnLCBzdWJzXSBvZiBzZWxmLl9fZXZlbnRpZnlfYnVmZmVyKSB7XG5cdFx0XHRcdFx0Ly8gYWN0dWFsIGV2ZW50IHRyaWdnZXJpbmdcblx0XHRcdFx0XHRldi50cmlnZ2VyKGVBcmcsIHN1YnMsIGZhbHNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxmLl9fZXZlbnRpZnlfYnVmZmVyID0gW107XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHQvKlxuXHRcdFRyaWdnZXIgbXVsdGlwbGUgZXZlbnRzIG9mIHNhbWUgdHlwZSAobmFtZSlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxpa2UobmFtZSwgZUFyZ3MpIHtcblx0XHRyZXR1cm4gdGhpcy5ldmVudGlmeVRyaWdnZXJBbGwoZUFyZ3MubWFwKGVBcmcgPT4ge1xuXHRcdFx0cmV0dXJuIHtuYW1lLCBlQXJnfTtcblx0XHR9KSk7XG5cdH1cblxuXHQvKlxuXHRcdFRyaWdnZXIgc2luZ2xlIGV2ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlcihuYW1lLCBlQXJnKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKFt7bmFtZSwgZUFyZ31dKTtcblx0fVxuXG5cdF9wcm90b3R5cGUuZXZlbnRpZnlEZWZpbmUgPSBldmVudGlmeURlZmluZTtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXIgPSBldmVudGlmeVRyaWdnZXI7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxpa2UgPSBldmVudGlmeVRyaWdnZXJBbGlrZTtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXJBbGwgPSBldmVudGlmeVRyaWdnZXJBbGw7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlTdWJzY3JpcHRpb25zID0gZXZlbnRpZnlTdWJzY3JpcHRpb25zO1xuXHRfcHJvdG90eXBlLm9uID0gb247XG5cdF9wcm90b3R5cGUub2ZmID0gb2ZmO1xufTtcblxuXG5leHBvcnQge2V2ZW50aWZ5SW5zdGFuY2UgYXMgYWRkVG9JbnN0YW5jZX07XG5leHBvcnQge2V2ZW50aWZ5UHJvdG90eXBlIGFzIGFkZFRvUHJvdG90eXBlfTtcblxuLypcblx0RXZlbnQgVmFyaWFibGVcblxuXHRPYmplY3RzIHdpdGggYSBzaW5nbGUgXCJjaGFuZ2VcIiBldmVudFxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50VmFyaWFibGUge1xuXG5cdGNvbnN0cnVjdG9yICh2YWx1ZSkge1xuXHRcdGV2ZW50aWZ5SW5zdGFuY2UodGhpcyk7XG5cdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHR0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcblx0fVxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5fdmFsdWV9O1xuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlICE9IHRoaXMuX3ZhbHVlKSB7XG5cdFx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuZXZlbnRpZnlQcm90b3R5cGUoRXZlbnRWYXJpYWJsZS5wcm90b3R5cGUpO1xuXG4vKlxuXHRFdmVudCBCb29sZWFuXG5cblxuXHROb3RlIDogaW1wbGVtZW50YXRpb24gdXNlcyBmYWxzaW5lc3Mgb2YgaW5wdXQgcGFyYW1ldGVyIHRvIGNvbnN0cnVjdG9yIGFuZCBzZXQoKSBvcGVyYXRpb24sXG5cdHNvIGV2ZW50Qm9vbGVhbigtMSkgd2lsbCBhY3R1YWxseSBzZXQgaXQgdG8gdHJ1ZSBiZWNhdXNlXG5cdCgtMSkgPyB0cnVlIDogZmFsc2UgLT4gdHJ1ZSAhXG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRCb29sZWFuIGV4dGVuZHMgRXZlbnRWYXJpYWJsZSB7XG5cdGNvbnN0cnVjdG9yKHZhbHVlKSB7XG5cdFx0c3VwZXIoQm9vbGVhbih2YWx1ZSkpO1xuXHR9XG5cblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdHN1cGVyLnZhbHVlID0gQm9vbGVhbih2YWx1ZSk7XG5cdH1cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gc3VwZXIudmFsdWV9O1xufVxuXG5cbi8qXG5cdG1ha2UgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gRXZlbnRCb29sZWFuIGNoYW5nZXNcblx0dmFsdWUuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQcm9taXNlKGV2ZW50T2JqZWN0LCBjb25kaXRpb25GdW5jKSB7XG5cdGNvbmRpdGlvbkZ1bmMgPSBjb25kaXRpb25GdW5jIHx8IGZ1bmN0aW9uKHZhbCkge3JldHVybiB2YWwgPT0gdHJ1ZX07XG5cdHJldHVybiBuZXcgUHJvbWlzZSAoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdGxldCBzdWIgPSBldmVudE9iamVjdC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdGlmIChjb25kaXRpb25GdW5jKHZhbHVlKSkge1xuXHRcdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHRcdFx0ZXZlbnRPYmplY3Qub2ZmKHN1Yik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufTtcblxuLy8gbW9kdWxlIGFwaVxuZXhwb3J0IGRlZmF1bHQge1xuXHRldmVudGlmeVByb3RvdHlwZSxcblx0ZXZlbnRpZnlJbnN0YW5jZSxcblx0RXZlbnRWYXJpYWJsZSxcblx0RXZlbnRCb29sZWFuLFxuXHRtYWtlUHJvbWlzZVxufTtcblxuIiwiXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTT1VSQ0UgUFJPUEVSVFkgKFNSQ1BST1ApXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9ucyBmb3IgZXh0ZW5kaW5nIGEgY2xhc3Mgd2l0aCBzdXBwb3J0IGZvciBcbiAqIGV4dGVybmFsIHNvdXJjZSBvbiBhIG5hbWVkIHByb3BlcnR5LlxuICogXG4gKiBvcHRpb246IG11dGFibGU6dHJ1ZSBtZWFucyB0aGF0IHByb3BlcnkgbWF5IGJlIHJlc2V0IFxuICogXG4gKiBzb3VyY2Ugb2JqZWN0IGlzIGFzc3VtZWQgdG8gc3VwcG9ydCB0aGUgY2FsbGJhY2sgaW50ZXJmYWNlLFxuICogb3IgYmUgYSBsaXN0IG9mIG9iamVjdHMgYWxsIHN1cHBvcnRpbmcgdGhlIGNhbGxiYWNrIGludGVyZmFjZVxuICovXG5cbmNvbnN0IE5BTUUgPSBcInNyY3Byb3BcIjtcbmNvbnN0IFBSRUZJWCA9IGBfXyR7TkFNRX1gO1xuXG5leHBvcnQgZnVuY3Rpb24gYWRkVG9JbnN0YW5jZSAob2JqZWN0KSB7XG4gICAgb2JqZWN0W2Ake1BSRUZJWH1gXSA9IG5ldyBNYXAoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlIChfcHJvdG90eXBlKSB7XG5cbiAgICBmdW5jdGlvbiByZWdpc3Rlcihwcm9wTmFtZSwgb3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge211dGFibGU9dHJ1ZX0gPSBvcHRpb25zO1xuICAgICAgICBjb25zdCBtYXAgPSB0aGlzW2Ake1BSRUZJWH1gXTsgXG4gICAgICAgIG1hcC5zZXQocHJvcE5hbWUsIHtcbiAgICAgICAgICAgIGluaXQ6ZmFsc2UsXG4gICAgICAgICAgICBtdXRhYmxlLFxuICAgICAgICAgICAgZW50aXR5OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBoYW5kbGVzOiBbXVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyByZWdpc3RlciBnZXR0ZXJzIGFuZCBzZXR0ZXJzXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wTmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1hcC5nZXQocHJvcE5hbWUpLmVudGl0eTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uIChlbnRpdHkpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1tgJHtOQU1FfV9jaGVja2BdKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eSA9IHRoaXNbYCR7TkFNRX1fY2hlY2tgXShwcm9wTmFtZSwgZW50aXR5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eSAhPSBtYXAuZ2V0KHByb3BOYW1lKS5lbnRpdHkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1tgJHtQUkVGSVh9X2F0dGFjaGBdKHByb3BOYW1lLCBlbnRpdHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXR0YXRjaChwcm9wTmFtZSwgZW50aXR5KSB7XG5cbiAgICAgICAgY29uc3QgbWFwID0gdGhpc1tgJHtQUkVGSVh9YF07XG4gICAgICAgIGNvbnN0IHN0YXRlID0gbWFwLmdldChwcm9wTmFtZSlcblxuICAgICAgICBpZiAoc3RhdGUuaW5pdCAmJiAhc3RhdGUubXV0YWJsZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3Byb3BOYW1lfSBjYW4gbm90IGJlIHJlYXNzaWduZWRgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGVudGl0aWVzID0gKEFycmF5LmlzQXJyYXkoZW50aXR5KSkgPyBlbnRpdHkgOiBbZW50aXR5XTtcblxuICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIGVudGl0aWVzXG4gICAgICAgIGlmIChzdGF0ZS5oYW5kbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2lkeCwgZV0gb2YgT2JqZWN0LmVudHJpZXMoZW50aXRpZXMpKSB7XG4gICAgICAgICAgICAgICAgZS5yZW1vdmVfY2FsbGJhY2soc3RhdGUuaGFuZGxlc1tpZHhdKTtcbiAgICAgICAgICAgIH0gICAgXG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUuaGFuZGxlcyA9IFtdO1xuXG4gICAgICAgIC8vIGF0dGF0Y2ggbmV3IGVudGl0eVxuICAgICAgICBzdGF0ZS5lbnRpdHkgPSBlbnRpdHk7XG4gICAgICAgIHN0YXRlLmluaXQgPSB0cnVlO1xuXG4gICAgICAgIC8vIHN1YnNjcmliZSB0byBjYWxsYmFjayBmcm9tIHNvdXJjZVxuICAgICAgICBpZiAodGhpc1tgJHtOQU1FfV9vbmNoYW5nZWBdKSB7XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gZnVuY3Rpb24gKGVBcmcpIHtcbiAgICAgICAgICAgICAgICB0aGlzW2Ake05BTUV9X29uY2hhbmdlYF0ocHJvcE5hbWUsIGVBcmcpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBlIG9mIGVudGl0aWVzKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUuaGFuZGxlcy5wdXNoKGUuYWRkX2NhbGxiYWNrKGhhbmRsZXIpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXNbYCR7TkFNRX1fb25jaGFuZ2VgXShwcm9wTmFtZSwgXCJyZXNldFwiKTsgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBhcGkgPSB7fTtcbiAgICBhcGlbYCR7TkFNRX1fcmVnaXN0ZXJgXSA9IHJlZ2lzdGVyO1xuICAgIGFwaVtgJHtQUkVGSVh9X2F0dGFjaGBdID0gYXR0YXRjaDtcbiAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG59XG5cbiIsImltcG9ydCB7IGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG5CQVNFIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qXG5cdEFic3RyYWN0IEJhc2UgQ2xhc3MgZm9yIFNlZ21lbnRzXG5cbiAgICBjb25zdHJ1Y3RvcihpbnRlcnZhbClcblxuICAgIC0gaW50ZXJ2YWw6IGludGVydmFsIG9mIHZhbGlkaXR5IG9mIHNlZ21lbnRcbiAgICAtIGR5bmFtaWM6IHRydWUgaWYgc2VnbWVudCBpcyBkeW5hbWljXG4gICAgLSB2YWx1ZShvZmZzZXQpOiB2YWx1ZSBvZiBzZWdtZW50IGF0IG9mZnNldFxuICAgIC0gcXVlcnkob2Zmc2V0KTogc3RhdGUgb2Ygc2VnbWVudCBhdCBvZmZzZXRcbiovXG5cbmV4cG9ydCBjbGFzcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2KSB7XG5cdFx0dGhpcy5faXR2ID0gaXR2O1xuXHR9XG5cblx0Z2V0IGl0digpIHtyZXR1cm4gdGhpcy5faXR2O31cblxuICAgIC8qKiBcbiAgICAgKiBpbXBsZW1lbnRlZCBieSBzdWJjbGFzc1xuICAgICAqIHJldHVybnMge3ZhbHVlLCBkeW5hbWljfTtcbiAgICAqL1xuICAgIHN0YXRlKG9mZnNldCkge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwibm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNvbnZlbmllbmNlIGZ1bmN0aW9uIHJldHVybmluZyB0aGUgc3RhdGUgb2YgdGhlIHNlZ21lbnRcbiAgICAgKiBAcGFyYW0geyp9IG9mZnNldCBcbiAgICAgKiBAcmV0dXJucyBcbiAgICAgKi9cbiAgICBxdWVyeShvZmZzZXQpIHtcbiAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19wb2ludCh0aGlzLl9pdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgIHJldHVybiB7Li4udGhpcy5zdGF0ZShvZmZzZXQpLCBvZmZzZXR9O1xuICAgICAgICB9IFxuICAgICAgICByZXR1cm4ge3ZhbHVlOiB1bmRlZmluZWQsIGR5bmFtaWM6ZmFsc2UsIG9mZnNldH07XG4gICAgfVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTEFZRVJTIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIExheWVyc1NlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG5cdFx0dGhpcy5fbGF5ZXJzID0gYXJncy5sYXllcnM7XG4gICAgICAgIHRoaXMuX3ZhbHVlX2Z1bmMgPSBhcmdzLnZhbHVlX2Z1bmNcblxuICAgICAgICAvLyBUT0RPIC0gZmlndXJlIG91dCBkeW5hbWljIGhlcmU/XG4gICAgfVxuXG5cdHN0YXRlKG9mZnNldCkge1xuICAgICAgICAvLyBUT0RPIC0gdXNlIHZhbHVlIGZ1bmNcbiAgICAgICAgLy8gZm9yIG5vdyAtIGp1c3QgdXNlIGZpcnN0IGxheWVyXG4gICAgICAgIHJldHVybiB7Li4udGhpcy5fbGF5ZXJzWzBdLnF1ZXJ5KG9mZnNldCksIG9mZnNldH07XG5cdH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBTVEFUSUMgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgU3RhdGljU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGRhdGEpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcblx0XHR0aGlzLl92YWx1ZSA9IGRhdGE7XG5cdH1cblxuXHRzdGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdGhpcy5fdmFsdWUsIGR5bmFtaWM6ZmFsc2V9XG5cdH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBNT1RJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLypcbiAgICBJbXBsZW1lbnRzIGRldGVybWluaXN0aWMgcHJvamVjdGlvbiBiYXNlZCBvbiBpbml0aWFsIGNvbmRpdGlvbnMgXG4gICAgLSBtb3Rpb24gdmVjdG9yIGRlc2NyaWJlcyBtb3Rpb24gdW5kZXIgY29uc3RhbnQgYWNjZWxlcmF0aW9uXG4qL1xuXG5leHBvcnQgY2xhc3MgTW90aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcbiAgICBcbiAgICBjb25zdHJ1Y3RvcihpdHYsIGRhdGEpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcbiAgICAgICAgY29uc3Qge1xuICAgICAgICAgICAgcG9zaXRpb246cDA9MCwgXG4gICAgICAgICAgICB2ZWxvY2l0eTp2MD0wLCBcbiAgICAgICAgICAgIGFjY2VsZXJhdGlvbjphMD0wLCBcbiAgICAgICAgICAgIHRpbWVzdGFtcDp0MD0wXG4gICAgICAgIH0gPSBkYXRhO1xuICAgICAgICAvLyBjcmVhdGUgbW90aW9uIHRyYW5zaXRpb25cbiAgICAgICAgdGhpcy5fcG9zX2Z1bmMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIGxldCBkID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHJldHVybiBwMCArIHYwKmQgKyAwLjUqYTAqZCpkO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLl92ZWxfZnVuYyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgbGV0IGQgPSB0cyAtIHQwO1xuICAgICAgICAgICAgcmV0dXJuIHYwICsgYTAqZDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9hY2NfZnVuYyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgcmV0dXJuIGEwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIGxldCBwb3MgPSB0aGlzLl9wb3NfZnVuYyhvZmZzZXQpO1xuICAgICAgICBsZXQgdmVsID0gdGhpcy5fdmVsX2Z1bmMob2Zmc2V0KTtcbiAgICAgICAgbGV0IGFjYyA9IHRoaXMuX2FjY19mdW5jKG9mZnNldCk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwb3NpdGlvbjogcG9zLFxuICAgICAgICAgICAgdmVsb2NpdHk6IHZlbCxcbiAgICAgICAgICAgIGFjY2VsZXJhdGlvbjogYWNjLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBvZmZzZXQsXG4gICAgICAgICAgICB2YWx1ZTogcG9zLFxuICAgICAgICAgICAgZHluYW1pYzogKHZlbCAhPSAwIHx8IGFjYyAhPSAwIClcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBUUkFOU0lUSU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBTdXBwb3J0ZWQgZWFzaW5nIGZ1bmN0aW9uc1xuICAgIFwiZWFzZS1pblwiOlxuICAgIFwiZWFzZS1vdXRcIjpcbiAgICBcImVhc2UtaW4tb3V0XCJcbiovXG5cbmZ1bmN0aW9uIGVhc2VpbiAodHMpIHtcbiAgICByZXR1cm4gTWF0aC5wb3codHMsMik7ICBcbn1cbmZ1bmN0aW9uIGVhc2VvdXQgKHRzKSB7XG4gICAgcmV0dXJuIDEgLSBlYXNlaW4oMSAtIHRzKTtcbn1cbmZ1bmN0aW9uIGVhc2Vpbm91dCAodHMpIHtcbiAgICBpZiAodHMgPCAuNSkge1xuICAgICAgICByZXR1cm4gZWFzZWluKDIgKiB0cykgLyAyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAoMiAtIGVhc2VpbigyICogKDEgLSB0cykpKSAvIDI7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgVHJhbnNpdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG5cdFx0c3VwZXIoaXR2KTtcbiAgICAgICAgbGV0IHt2MCwgdjEsIGVhc2luZ30gPSBkYXRhO1xuICAgICAgICBsZXQgW3QwLCB0MV0gPSB0aGlzLl9pdHYuc2xpY2UoMCwyKTtcblxuICAgICAgICAvLyBjcmVhdGUgdGhlIHRyYW5zaXRpb24gZnVuY3Rpb25cbiAgICAgICAgdGhpcy5fZHluYW1pYyA9IHYxLXYwICE9IDA7XG4gICAgICAgIHRoaXMuX3RyYW5zID0gZnVuY3Rpb24gKHRzKSB7XG4gICAgICAgICAgICAvLyBjb252ZXJ0IHRzIHRvIFt0MCx0MV0tc3BhY2VcbiAgICAgICAgICAgIC8vIC0gc2hpZnQgZnJvbSBbdDAsdDFdLXNwYWNlIHRvIFswLCh0MS10MCldLXNwYWNlXG4gICAgICAgICAgICAvLyAtIHNjYWxlIGZyb20gWzAsKHQxLXQwKV0tc3BhY2UgdG8gWzAsMV0tc3BhY2VcbiAgICAgICAgICAgIHRzID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHRzID0gdHMvcGFyc2VGbG9hdCh0MS10MCk7XG4gICAgICAgICAgICAvLyBlYXNpbmcgZnVuY3Rpb25zIHN0cmV0Y2hlcyBvciBjb21wcmVzc2VzIHRoZSB0aW1lIHNjYWxlIFxuICAgICAgICAgICAgaWYgKGVhc2luZyA9PSBcImVhc2UtaW5cIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZWluKHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWFzaW5nID09IFwiZWFzZS1vdXRcIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZW91dCh0cyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVhc2luZyA9PSBcImVhc2UtaW4tb3V0XCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2Vpbm91dCh0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBsaW5lYXIgdHJhbnNpdGlvbiBmcm9tIHYwIHRvIHYxLCBmb3IgdGltZSB2YWx1ZXMgWzAsMV1cbiAgICAgICAgICAgIHRzID0gTWF0aC5tYXgodHMsIDApO1xuICAgICAgICAgICAgdHMgPSBNYXRoLm1pbih0cywgMSk7XG4gICAgICAgICAgICByZXR1cm4gdjAgKyAodjEtdjApKnRzO1xuICAgICAgICB9XG5cdH1cblxuXHRzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdGhpcy5fdHJhbnMob2Zmc2V0KSwgZHluYW1pYzp0aGlzLl9keW5hbWljfVxuXHR9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBJTlRFUlBPTEFUSU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBGdW5jdGlvbiB0byBjcmVhdGUgYW4gaW50ZXJwb2xhdG9yIGZvciBuZWFyZXN0IG5laWdoYm9yIGludGVycG9sYXRpb24gd2l0aFxuICogZXh0cmFwb2xhdGlvbiBzdXBwb3J0LlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHR1cGxlcyAtIEFuIGFycmF5IG9mIFt2YWx1ZSwgb2Zmc2V0XSBwYWlycywgd2hlcmUgdmFsdWUgaXMgdGhlXG4gKiBwb2ludCdzIHZhbHVlIGFuZCBvZmZzZXQgaXMgdGhlIGNvcnJlc3BvbmRpbmcgb2Zmc2V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSAtIEEgZnVuY3Rpb24gdGhhdCB0YWtlcyBhbiBvZmZzZXQgYW5kIHJldHVybnMgdGhlXG4gKiBpbnRlcnBvbGF0ZWQgb3IgZXh0cmFwb2xhdGVkIHZhbHVlLlxuICovXG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKHR1cGxlcykge1xuXG4gICAgaWYgKHR1cGxlcy5sZW5ndGggPCAxKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3IgKCkge3JldHVybiB1bmRlZmluZWQ7fVxuICAgIH0gZWxzZSBpZiAodHVwbGVzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3IgKCkge3JldHVybiB0dXBsZXNbMF1bMF07fVxuICAgIH1cblxuICAgIC8vIFNvcnQgdGhlIHR1cGxlcyBieSB0aGVpciBvZmZzZXRzXG4gICAgY29uc3Qgc29ydGVkVHVwbGVzID0gWy4uLnR1cGxlc10uc29ydCgoYSwgYikgPT4gYVsxXSAtIGJbMV0pO1xuICBcbiAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yKG9mZnNldCkge1xuICAgICAgLy8gSGFuZGxlIGV4dHJhcG9sYXRpb24gYmVmb3JlIHRoZSBmaXJzdCBwb2ludFxuICAgICAgaWYgKG9mZnNldCA8PSBzb3J0ZWRUdXBsZXNbMF1bMV0pIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbMF07XG4gICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzWzFdO1xuICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEhhbmRsZSBleHRyYXBvbGF0aW9uIGFmdGVyIHRoZSBsYXN0IHBvaW50XG4gICAgICBpZiAob2Zmc2V0ID49IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMV1bMV0pIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDJdO1xuICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMV07XG4gICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgIH1cbiAgXG4gICAgICAvLyBGaW5kIHRoZSBuZWFyZXN0IHBvaW50cyB0byB0aGUgbGVmdCBhbmQgcmlnaHRcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc29ydGVkVHVwbGVzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICBpZiAob2Zmc2V0ID49IHNvcnRlZFR1cGxlc1tpXVsxXSAmJiBvZmZzZXQgPD0gc29ydGVkVHVwbGVzW2kgKyAxXVsxXSkge1xuICAgICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzW2ldO1xuICAgICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzW2kgKyAxXTtcbiAgICAgICAgICAvLyBMaW5lYXIgaW50ZXJwb2xhdGlvbiBmb3JtdWxhOiB5ID0geTEgKyAoICh4IC0geDEpICogKHkyIC0geTEpIC8gKHgyIC0geDEpIClcbiAgICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgXG4gICAgICAvLyBJbiBjYXNlIHRoZSBvZmZzZXQgZG9lcyBub3QgZmFsbCB3aXRoaW4gYW55IHJhbmdlIChzaG91bGQgYmUgY292ZXJlZCBieSB0aGUgcHJldmlvdXMgY29uZGl0aW9ucylcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfTtcbn1cbiAgXG5cbmV4cG9ydCBjbGFzcyBJbnRlcnBvbGF0aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuICAgIGNvbnN0cnVjdG9yKGl0diwgdHVwbGVzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIC8vIHNldHVwIGludGVycG9sYXRpb24gZnVuY3Rpb25cbiAgICAgICAgdGhpcy5fdHJhbnMgPSBpbnRlcnBvbGF0ZSh0dXBsZXMpO1xuICAgIH1cblxuICAgIHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl90cmFucyhvZmZzZXQpLCBkeW5hbWljOnRydWV9O1xuICAgIH1cbn1cblxuXG4iLCJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBDTE9DS1NcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBjbG9ja3MgY291bnRpbmcgaW4gc2Vjb25kc1xuICovXG5cbmNvbnN0IGxvY2FsID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBwZXJmb3JtYW5jZS5ub3coKS8xMDAwLjA7XG59XG5cbmNvbnN0IGVwb2NoID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgRGF0ZSgpLzEwMDAuMDtcbn1cblxuLyoqXG4gKiB0aGUgY2xvY2sgZ2l2ZXMgZXBvY2ggdmFsdWVzLCBidXQgaXMgaW1wbGVtZW50ZWRcbiAqIHVzaW5nIGEgaGlnaCBwZXJmb3JtYW5jZSBsb2NhbCBjbG9jayBmb3IgYmV0dGVyXG4gKiB0aW1lIHJlc29sdXRpb24gYW5kIHByb3RlY3Rpb24gYWdhaW5zdCBzeXN0ZW0gXG4gKiB0aW1lIGFkanVzdG1lbnRzLlxuICovXG5cbmV4cG9ydCBjb25zdCBDTE9DSyA9IGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCB0MF9sb2NhbCA9IGxvY2FsKCk7XG4gICAgY29uc3QgdDBfZXBvY2ggPSBlcG9jaCgpO1xuICAgIHJldHVybiB7XG4gICAgICAgIG5vdzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHQwX2Vwb2NoICsgKGxvY2FsKCkgLSB0MF9sb2NhbClcbiAgICAgICAgfVxuICAgIH1cbn0oKTtcblxuXG4vLyBvdnZlcnJpZGUgbW9kdWxvIHRvIGJlaGF2ZSBiZXR0ZXIgZm9yIG5lZ2F0aXZlIG51bWJlcnNcbmV4cG9ydCBmdW5jdGlvbiBtb2QobiwgbSkge1xuICAgIHJldHVybiAoKG4gJSBtKSArIG0pICUgbTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBkaXZtb2QoeCwgYmFzZSkge1xuICAgIGxldCBuID0gTWF0aC5mbG9vcih4IC8gYmFzZSlcbiAgICBsZXQgciA9IG1vZCh4LCBiYXNlKTtcbiAgICByZXR1cm4gW24sIHJdO1xufVxuXG5cbi8qXG4gICAgc2ltaWxhciB0byByYW5nZSBmdW5jdGlvbiBpbiBweXRob25cbiovXG5cbmV4cG9ydCBmdW5jdGlvbiByYW5nZSAoc3RhcnQsIGVuZCwgc3RlcCA9IDEsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICBjb25zdCB7aW5jbHVkZV9lbmQ9ZmFsc2V9ID0gb3B0aW9ucztcbiAgICBpZiAoc3RlcCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0ZXAgY2Fubm90IGJlIHplcm8uJyk7XG4gICAgfVxuICAgIGlmIChzdGFydCA8IGVuZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gc3RlcCkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChzdGFydCA+IGVuZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPiBlbmQ7IGkgLT0gc3RlcCkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChpbmNsdWRlX2VuZCkge1xuICAgICAgICByZXN1bHQucHVzaChlbmQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5cbi8qKlxuICogQ3JlYXRlIGEgc2luZ2xlIHN0YXRlIGZyb20gYSBsaXN0IG9mIHN0YXRlcywgdXNpbmcgYSB2YWx1ZUZ1bmNcbiAqIHN0YXRlOnt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0fVxuICogXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHRvU3RhdGUoc291cmNlcywgc3RhdGVzLCBvZmZzZXQsIG9wdGlvbnM9e30pIHtcbiAgICBsZXQge3ZhbHVlRnVuYywgc3RhdGVGdW5jfSA9IG9wdGlvbnM7IFxuICAgIGlmICh2YWx1ZUZ1bmMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGxldCB2YWx1ZSA9IHZhbHVlRnVuYyh7c291cmNlcywgc3RhdGVzLCBvZmZzZXR9KTtcbiAgICAgICAgbGV0IGR5bmFtaWMgPSBzdGF0ZXMubWFwKCh2KSA9PiB2LmR5bWFtaWMpLnNvbWUoZT0+ZSk7XG4gICAgICAgIHJldHVybiB7dmFsdWUsIGR5bmFtaWMsIG9mZnNldH07XG4gICAgfSBlbHNlIGlmIChzdGF0ZUZ1bmMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiB7Li4uc3RhdGVGdW5jKHtzb3VyY2VzLCBzdGF0ZXMsIG9mZnNldH0pLCBvZmZzZXR9O1xuICAgIH1cbiAgICAvLyBubyB2YWx1ZUZ1bmMgb3Igc3RhdGVGdW5jXG4gICAgaWYgKHN0YXRlcy5sZW5ndGggPT0gMCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOnVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fVxuICAgIH1cbiAgICAvLyBmYWxsYmFjayAtIGp1c3QgdXNlIGZpcnN0IHN0YXRlXG4gICAgbGV0IHN0YXRlID0gc3RhdGVzWzBdO1xuICAgIHJldHVybiB7Li4uc3RhdGUsIG9mZnNldH07IFxufSIsImltcG9ydCB7IGludGVydmFsLCBlbmRwb2ludCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4vbmVhcmJ5aW5kZXguanNcIjtcblxuLyoqXG4gKiBcbiAqIE5lYXJieSBJbmRleCBTaW1wbGVcbiAqIFxuICogLSBpdGVtcyBhcmUgYXNzdW1lZCB0byBiZSBub24tb3ZlcmxhcHBpbmcgb24gdGhlIHRpbWVsaW5lLCBcbiAqIC0gaW1wbHlpbmcgdGhhdCBuZWFyYnkuY2VudGVyIHdpbGwgYmUgYSBsaXN0IG9mIGF0IG1vc3Qgb25lIElURU0uIFxuICogLSBleGNlcHRpb24gd2lsbCBiZSByYWlzZWQgaWYgb3ZlcmxhcHBpbmcgSVRFTVMgYXJlIGZvdW5kXG4gKiAtIElURU1TIGlzIGFzc3VtYmVkIHRvIGJlIGltbXV0YWJsZSBhcnJheSAtIGNoYW5nZSBJVEVNUyBieSByZXBsYWNpbmcgYXJyYXlcbiAqIFxuICogIFxuICovXG5cblxuLy8gZ2V0IGludGVydmFsIGxvdyBwb2ludFxuZnVuY3Rpb24gZ2V0X2xvd192YWx1ZShpdGVtKSB7XG4gICAgcmV0dXJuIGl0ZW0uaXR2WzBdO1xufVxuXG4vLyBnZXQgaW50ZXJ2YWwgbG93IGVuZHBvaW50XG5mdW5jdGlvbiBnZXRfbG93X2VuZHBvaW50KGl0ZW0pIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMF1cbn1cblxuLy8gZ2V0IGludGVydmFsIGhpZ2ggZW5kcG9pbnRcbmZ1bmN0aW9uIGdldF9oaWdoX2VuZHBvaW50KGl0ZW0pIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMV1cbn1cblxuXG5leHBvcnQgY2xhc3MgTmVhcmJ5SW5kZXhTaW1wbGUgZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Ioc3JjKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX3NyYyA9IHNyYztcbiAgICB9XG5cbiAgICBnZXQgc3JjICgpIHtyZXR1cm4gdGhpcy5fc3JjO31cblxuXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBvZmZzZXQgPSB0aGlzLmNoZWNrKG9mZnNldCk7XG4gICAgICAgIGxldCBpdGVtID0gdW5kZWZpbmVkO1xuICAgICAgICBsZXQgY2VudGVyX2lkeCA9IHVuZGVmaW5lZDtcbiAgICAgICAgbGV0IGl0ZW1zID0gdGhpcy5fc3JjLmdldF9pdGVtcygpO1xuXG4gICAgICAgIC8vIGJpbmFyeSBzZWFyY2ggZm9yIGluZGV4XG4gICAgICAgIGxldCBbZm91bmQsIGlkeF0gPSBmaW5kX2luZGV4KG9mZnNldFswXSwgaXRlbXMsIGdldF9sb3dfdmFsdWUpO1xuICAgICAgICBpZiAoZm91bmQpIHtcbiAgICAgICAgICAgIC8vIHNlYXJjaCBvZmZzZXQgbWF0Y2hlcyBpdGVtIGxvdyBleGFjdGx5XG4gICAgICAgICAgICAvLyBjaGVjayB0aGF0IGl0IGlzIGluZGVlZCBjb3ZlcmVkIGJ5IGl0ZW0gaW50ZXJ2YWxcbiAgICAgICAgICAgIGl0ZW0gPSBpdGVtc1tpZHhdXG4gICAgICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KGl0ZW0uaXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICAgICAgY2VudGVyX2lkeCA9IGlkeFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChjZW50ZXJfaWR4ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgcHJldmlvdXMgaXRlbSBjb3ZlcnMgb2Zmc2V0XG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4LTFdO1xuICAgICAgICAgICAgaWYgKGl0ZW0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19lbmRwb2ludChpdGVtLml0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgICAgICBjZW50ZXJfaWR4ID0gaWR4LTE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIFxuICAgICAgICAgICAgY2VudGVyIGlzIG5vbi1lbXB0eSBcbiAgICAgICAgKi9cbiAgICAgICAgaWYgKGNlbnRlcl9pZHggIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbY2VudGVyX2lkeF07XG4gICAgICAgICAgICBjb25zdCBbbG93LCBoaWdoXSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBjZW50ZXI6IFtpdGVtXSxcbiAgICAgICAgICAgICAgICBpdHY6IGl0ZW0uaXR2LFxuICAgICAgICAgICAgICAgIGxlZnQ6IGVuZHBvaW50LmZsaXAobG93LCBcImhpZ2hcIiksXG4gICAgICAgICAgICAgICAgcmlnaHQ6IGVuZHBvaW50LmZsaXAoaGlnaCwgXCJsb3dcIilcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qIFxuICAgICAgICAgICAgY2VudGVyIGlzIGVtcHR5IFxuICAgICAgICAqL1xuICAgICAgICAvLyBsZWZ0IGlzIGJhc2VkIG9uIHByZXZpb3VzIGl0ZW1cbiAgICAgICAgaXRlbSA9IGl0ZW1zW2lkeC0xXTtcbiAgICAgICAgbGV0IGxlZnQgPSBbLUluZmluaXR5LCAwXTtcbiAgICAgICAgaWYgKGl0ZW0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsZWZ0ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMV07XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmlnaHQgaXMgYmFzZWQgb24gbmV4dCBpdGVtXG4gICAgICAgIGl0ZW0gPSBpdGVtc1tpZHhdO1xuICAgICAgICBsZXQgcmlnaHQgPSBbSW5maW5pdHksIDBdO1xuICAgICAgICBpZiAoaXRlbSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJpZ2h0ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMF07XG4gICAgICAgIH1cbiAgICAgICAgLy8gaXR2IGJhc2VkIG9uIGxlZnQgYW5kIHJpZ2h0ICAgICAgICBcbiAgICAgICAgbGV0IGxvdyA9IGVuZHBvaW50LmZsaXAobGVmdCwgXCJsb3dcIik7XG4gICAgICAgIGxldCBoaWdoID0gZW5kcG9pbnQuZmxpcChyaWdodCwgXCJoaWdoXCIpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjZW50ZXI6IFtdLCBsZWZ0LCByaWdodCxcbiAgICAgICAgICAgIGl0djogaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKVxuICAgICAgICB9O1xuICAgIH1cbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXHRVVElMU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5cbi8qXG5cdGJpbmFyeSBzZWFyY2ggZm9yIGZpbmRpbmcgdGhlIGNvcnJlY3QgaW5zZXJ0aW9uIGluZGV4IGludG9cblx0dGhlIHNvcnRlZCBhcnJheSAoYXNjZW5kaW5nKSBvZiBpdGVtc1xuXHRcblx0YXJyYXkgY29udGFpbnMgb2JqZWN0cywgYW5kIHZhbHVlIGZ1bmMgcmV0cmVhdmVzIGEgdmFsdWVcblx0ZnJvbSBlYWNoIG9iamVjdC5cblxuXHRyZXR1cm4gW2ZvdW5kLCBpbmRleF1cbiovXG5cbmZ1bmN0aW9uIGZpbmRfaW5kZXgodGFyZ2V0LCBhcnIsIHZhbHVlX2Z1bmMpIHtcblxuICAgIGZ1bmN0aW9uIGRlZmF1bHRfdmFsdWVfZnVuYyhlbCkge1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgfVxuICAgIFxuICAgIGxldCBsZWZ0ID0gMDtcblx0bGV0IHJpZ2h0ID0gYXJyLmxlbmd0aCAtIDE7XG5cdHZhbHVlX2Z1bmMgPSB2YWx1ZV9mdW5jIHx8IGRlZmF1bHRfdmFsdWVfZnVuYztcblx0d2hpbGUgKGxlZnQgPD0gcmlnaHQpIHtcblx0XHRjb25zdCBtaWQgPSBNYXRoLmZsb29yKChsZWZ0ICsgcmlnaHQpIC8gMik7XG5cdFx0bGV0IG1pZF92YWx1ZSA9IHZhbHVlX2Z1bmMoYXJyW21pZF0pO1xuXHRcdGlmIChtaWRfdmFsdWUgPT09IHRhcmdldCkge1xuXHRcdFx0cmV0dXJuIFt0cnVlLCBtaWRdOyAvLyBUYXJnZXQgYWxyZWFkeSBleGlzdHMgaW4gdGhlIGFycmF5XG5cdFx0fSBlbHNlIGlmIChtaWRfdmFsdWUgPCB0YXJnZXQpIHtcblx0XHRcdCAgbGVmdCA9IG1pZCArIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSByaWdodFxuXHRcdH0gZWxzZSB7XG5cdFx0XHQgIHJpZ2h0ID0gbWlkIC0gMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIGxlZnRcblx0XHR9XG5cdH1cbiAgXHRyZXR1cm4gW2ZhbHNlLCBsZWZ0XTsgLy8gUmV0dXJuIHRoZSBpbmRleCB3aGVyZSB0YXJnZXQgc2hvdWxkIGJlIGluc2VydGVkXG59XG4iLCJpbXBvcnQgKiBhcyBldmVudGlmeSBmcm9tIFwiLi9hcGlfZXZlbnRpZnkuanNcIjtcbmltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL2FwaV9jYWxsYmFjay5qc1wiO1xuaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi9hcGlfc3JjcHJvcC5qc1wiO1xuaW1wb3J0ICogYXMgc2VnbWVudCBmcm9tIFwiLi9zZWdtZW50cy5qc1wiO1xuXG5pbXBvcnQgeyBpbnRlcnZhbCwgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IHJhbmdlLCB0b1N0YXRlIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX2Jhc2VzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleFNpbXBsZSB9IGZyb20gXCIuL25lYXJieWluZGV4X3NpbXBsZVwiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExBWUVSXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIExheWVyIGlzIGFic3RyYWN0IGJhc2UgY2xhc3MgZm9yIExheWVyc1xuICogXG4gKiBMYXllciBpbnRlcmZhY2UgaXMgZGVmaW5lZCBieSAoaW5kZXgsIENhY2hlQ2xhc3MsIHZhbHVlRnVuYylcbiAqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXIge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBjb25zdCB7Q2FjaGVDbGFzcz1MYXllckNhY2hlfSA9IG9wdGlvbnM7XG4gICAgICAgIGNvbnN0IHt2YWx1ZUZ1bmMsIHN0YXRlRnVuY30gPSBvcHRpb25zO1xuICAgICAgICAvLyBjYWxsYmFja3NcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgLy8gbGF5ZXIgcXVlcnkgYXBpXG4gICAgICAgIC8vbGF5ZXJxdWVyeS5hZGRUb0luc3RhbmNlKHRoaXMsIENhY2hlQ2xhc3MsIHt2YWx1ZUZ1bmMsIHN0YXRlRnVuY30pO1xuICAgICAgICAvLyBkZWZpbmUgY2hhbmdlIGV2ZW50XG4gICAgICAgIGV2ZW50aWZ5LmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlEZWZpbmUoXCJjaGFuZ2VcIiwge2luaXQ6dHJ1ZX0pO1xuXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIHRoaXMuX2luZGV4O1xuICAgICAgICAvLyBjYWNoZVxuICAgICAgICB0aGlzLl9DYWNoZUNsYXNzID0gQ2FjaGVDbGFzcztcbiAgICAgICAgdGhpcy5fY2FjaGVfb2JqZWN0O1xuICAgICAgICB0aGlzLl9jYWNoZV9vYmplY3RzID0gW107XG5cbiAgICAgICAgLy8gcXVlcnkgb3B0aW9uc1xuICAgICAgICB0aGlzLl9xdWVyeU9wdGlvbnMgPSB7dmFsdWVGdW5jLCBzdGF0ZUZ1bmN9O1xuXG4gICAgfVxuXG4gICAgLy8gaW5kZXhcbiAgICBnZXQgaW5kZXggKCkge3JldHVybiB0aGlzLl9pbmRleH1cbiAgICBzZXQgaW5kZXggKGluZGV4KSB7dGhpcy5faW5kZXggPSBpbmRleH1cblxuICAgIC8vIHF1ZXJ5T3B0aW9uc1xuICAgIGdldCBxdWVyeU9wdGlvbnMgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcXVlcnlPcHRpb25zO1xuICAgIH1cblxuICAgIC8vIGNhY2hlXG4gICAgZ2V0IGNhY2hlICgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NhY2hlX29iamVjdCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2NhY2hlX29iamVjdCA9IG5ldyB0aGlzLl9DYWNoZUNsYXNzKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZV9vYmplY3Q7XG4gICAgfVxuXG4gICAgZ2V0Q2FjaGUgKCkge1xuICAgICAgICBjb25zdCBjYWNoZSA9IG5ldyB0aGlzLl9DYWNoZUNsYXNzKHRoaXMpO1xuICAgICAgICB0aGlzLl9jYWNoZV9vYmplY3RzLnB1c2goY2FjaGUpO1xuICAgICAgICByZXR1cm4gY2FjaGU7XG4gICAgfVxuXG4gICAgY2xlYXJDYWNoZXMoKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2FjaGUgb2YgdGhpcy5fY2FjaGVfb2JqZWN0cyl7XG4gICAgICAgICAgICBjYWNoZS5jbGVhcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhY2hlLnF1ZXJ5KG9mZnNldCk7XG4gICAgfVxuXG4gICAgcmVnaW9ucyAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5pbmRleC5yZWdpb25zKG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIFNhbXBsZSBMYXllciBieSB0aW1lbGluZSBvZmZzZXQgaW5jcmVtZW50c1xuICAgICAgICByZXR1cm4gbGlzdCBvZiB0dXBsZXMgW3ZhbHVlLCBvZmZzZXRdXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICAgLSBzdGFydFxuICAgICAgICAtIHN0b3BcbiAgICAgICAgLSBzdGVwXG4gICAgKi9cbiAgICBzYW1wbGUob3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge3N0YXJ0PS1JbmZpbml0eSwgc3RvcD1JbmZpbml0eSwgc3RlcD0xfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzdGFydCA+IHN0b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciAoXCJzdG9wIG11c3QgYmUgbGFyZ2VyIHRoYW4gc3RhcnRcIiwgc3RhcnQsIHN0b3ApXG4gICAgICAgIH1cbiAgICAgICAgc3RhcnQgPSBbc3RhcnQsIDBdO1xuICAgICAgICBzdG9wID0gW3N0b3AsIDBdO1xuICAgICAgICBzdGFydCA9IGVuZHBvaW50Lm1heCh0aGlzLmluZGV4LmZpcnN0KCksIHN0YXJ0KTtcbiAgICAgICAgc3RvcCA9IGVuZHBvaW50Lm1pbih0aGlzLmluZGV4Lmxhc3QoKSwgc3RvcCk7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5nZXRDYWNoZSgpO1xuICAgICAgICByZXR1cm4gcmFuZ2Uoc3RhcnRbMF0sIHN0b3BbMF0sIHN0ZXAsIHtpbmNsdWRlX2VuZDp0cnVlfSlcbiAgICAgICAgICAgIC5tYXAoKG9mZnNldCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBbY2FjaGUucXVlcnkob2Zmc2V0KS52YWx1ZSwgb2Zmc2V0XTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKExheWVyLnByb3RvdHlwZSk7XG5ldmVudGlmeS5hZGRUb1Byb3RvdHlwZShMYXllci5wcm90b3R5cGUpO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExBWUVSIENBQ0hFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFRoaXMgaW1wbGVtZW50cyBhIENhY2hlIHRvIGJlIHVzZWQgd2l0aCBMYXllciBvYmplY3RzXG4gKiBRdWVyeSByZXN1bHRzIGFyZSBvYnRhaW5lZCBmcm9tIHRoZSBjYWNoZSBvYmplY3RzIGluIHRoZVxuICogbGF5ZXIgaW5kZXggYW5kIGNhY2hlZCBvbmx5IGlmIHRoZXkgZGVzY3JpYmUgYSBzdGF0aWMgdmFsdWUuIFxuICovXG5cbmV4cG9ydCBjbGFzcyBMYXllckNhY2hlIHtcblxuICAgIGNvbnN0cnVjdG9yKGxheWVyKSB7XG4gICAgICAgIHRoaXMuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIC8vIGNhY2hlZCBuZWFyYnkgc3RhdGVcbiAgICAgICAgdGhpcy5fbmVhcmJ5O1xuICAgICAgICAvLyBjYWNoZWQgcmVzdWx0XG4gICAgICAgIHRoaXMuX3N0YXRlO1xuICAgIH1cblxuICAgIGdldCBzcmMoKSB7cmV0dXJuIHRoaXMuX2xheWVyfTtcblxuICAgIC8qKlxuICAgICAqIHF1ZXJ5IGNhY2hlXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IG5lZWRfbmVhcmJ5ID0gKFxuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgIWludGVydmFsLmNvdmVyc19wb2ludCh0aGlzLl9uZWFyYnkuaXR2LCBvZmZzZXQpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICFuZWVkX25lYXJieSAmJiBcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlICE9IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgIXRoaXMuX3N0YXRlLmR5bmFtaWNcbiAgICAgICAgKSB7XG4gICAgICAgICAgICAvLyBjYWNoZSBoaXRcbiAgICAgICAgICAgIHJldHVybiB7Li4udGhpcy5fc3RhdGUsIG9mZnNldH07XG4gICAgICAgIH1cbiAgICAgICAgLy8gY2FjaGUgbWlzc1xuICAgICAgICBpZiAobmVlZF9uZWFyYnkpIHtcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICB9XG4gICAgICAgIC8vIHBlcmZvcm0gcXVlcmllc1xuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9uZWFyYnkuY2VudGVyLm1hcCgoY2FjaGUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBjYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3Qgc3RhdGUgPSB0b1N0YXRlKHRoaXMuX25lYXJieS5jZW50ZXIsIHN0YXRlcywgb2Zmc2V0LCB0aGlzLl9sYXllci5xdWVyeU9wdGlvbnMpXG4gICAgICAgIC8vIGNhY2hlIHN0YXRlIG9ubHkgaWYgbm90IGR5bmFtaWNcbiAgICAgICAgdGhpcy5fc3RhdGUgPSAoc3RhdGUuZHluYW1pYykgPyB1bmRlZmluZWQgOiBzdGF0ZTtcbiAgICAgICAgcmV0dXJuIHN0YXRlICAgIFxuICAgIH1cblxuICAgIGNsZWFyKCkge1xuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX3N0YXRlID0gdW5kZWZpbmVkO1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBJTlBVVCBMQVlFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIExheWVyIHdpdGggYSBTdGF0ZVByb3ZpZGVyIGFzIHNyY1xuICovXG5cbmV4cG9ydCBjbGFzcyBJbnB1dExheWVyIGV4dGVuZHMgTGF5ZXIge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBjb25zdCB7c3JjLCB2YWx1ZUZ1bmMsIHN0YXRlRnVuY30gPSBvcHRpb25zO1xuICAgICAgICBzdXBlcih7Q2FjaGVDbGFzczpJbnB1dExheWVyQ2FjaGUsIHZhbHVlRnVuYywgc3RhdGVGdW5jfSk7XG4gICAgICAgIC8vIHNldHVwIHNyYyBwcm9wdGVydHlcbiAgICAgICAgc3JjcHJvcC5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLnNyY3Byb3BfcmVnaXN0ZXIoXCJzcmNcIik7XG4gICAgICAgIC8vIGluaXRpYWxpemVcbiAgICAgICAgdGhpcy5zcmMgPSBzcmM7XG4gICAgfVxuXG4gICAgc3JjcHJvcF9jaGVjayhwcm9wTmFtZSwgc3JjKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBTdGF0ZVByb3ZpZGVyQmFzZSkpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwic3JjXCIgbXVzdCBiZSBzdGF0ZSBwcm92aWRlciAke3NyY31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzcmM7ICAgIFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3JjcHJvcF9vbmNoYW5nZShwcm9wTmFtZSwgZUFyZykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzcmNcIikge1xuICAgICAgICAgICAgaWYgKHRoaXMuaW5kZXggPT0gdW5kZWZpbmVkIHx8IGVBcmcgPT0gXCJyZXNldFwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRleCA9IG5ldyBOZWFyYnlJbmRleFNpbXBsZSh0aGlzLnNyYylcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICB0aGlzLmNsZWFyQ2FjaGVzKCk7XG4gICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIpO1xuICAgICAgICB9ICAgICAgICBcbiAgICB9XG59XG5zcmNwcm9wLmFkZFRvUHJvdG90eXBlKElucHV0TGF5ZXIucHJvdG90eXBlKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBJTlBVVCBMQVlFUiBDQUNIRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIExheWVyIHdpdGggYSBTdGF0ZVByb3ZpZGVyIHVzZXMgYSBzcGVjaWZpYyBjYWNoZSBpbXBsZW1lbnRhdGlvbi4gICAgXG5cbiAgICBUaGUgY2FjaGUgd2lsbCBpbnN0YW50aWF0ZSBzZWdtZW50cyBjb3JyZXNwb25kaW5nIHRvXG4gICAgaXRlbXMgaW4gdGhlIGluZGV4LiBcbiovXG5cbmV4cG9ydCBjbGFzcyBJbnB1dExheWVyQ2FjaGUge1xuICAgIGNvbnN0cnVjdG9yKGxheWVyKSB7XG4gICAgICAgIC8vIGxheWVyXG4gICAgICAgIHRoaXMuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIC8vIGNhY2hlZCBuZWFyYnkgb2JqZWN0XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2FjaGVkIHNlZ21lbnRcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBnZXQgc3JjKCkge3JldHVybiB0aGlzLl9sYXllcn07XG5cbiAgICBxdWVyeShvZmZzZXQpIHtcbiAgICAgICAgY29uc3QgY2FjaGVfbWlzcyA9IChcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICFpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5fbmVhcmJ5Lml0diwgb2Zmc2V0KVxuICAgICAgICApO1xuICAgICAgICBpZiAoY2FjaGVfbWlzcykge1xuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdGhpcy5fbGF5ZXIuaW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgICAgICBsZXQge2l0diwgY2VudGVyfSA9IHRoaXMuX25lYXJieTtcbiAgICAgICAgICAgIHRoaXMuX3NlZ21lbnRzID0gY2VudGVyLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBsb2FkX3NlZ21lbnQoaXR2LCBpdGVtKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIHF1ZXJ5IHNlZ21lbnRzXG4gICAgICAgIGNvbnN0IHN0YXRlcyA9IHRoaXMuX3NlZ21lbnRzLm1hcCgoc2VnKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gc2VnLnF1ZXJ5KG9mZnNldCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdG9TdGF0ZSh0aGlzLl9zZWdtZW50cywgc3RhdGVzLCBvZmZzZXQsIHRoaXMuX2xheWVyLnF1ZXJ5T3B0aW9ucylcbiAgICB9XG5cbiAgICBjbGVhcigpIHtcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9zZWdtZW50ID0gdW5kZWZpbmVkO1xuICAgIH1cbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExPQUQgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5mdW5jdGlvbiBsb2FkX3NlZ21lbnQoaXR2LCBpdGVtKSB7XG4gICAgbGV0IHt0eXBlPVwic3RhdGljXCIsIGRhdGF9ID0gaXRlbTtcbiAgICBpZiAodHlwZSA9PSBcInN0YXRpY1wiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5TdGF0aWNTZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwidHJhbnNpdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5UcmFuc2l0aW9uU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcImludGVycG9sYXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuSW50ZXJwb2xhdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJtb3Rpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuTW90aW9uU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwidW5yZWNvZ25pemVkIHNlZ21lbnQgdHlwZVwiLCB0eXBlKTtcbiAgICB9XG59XG5cblxuXG4iLCJpbXBvcnQgeyBlbmRwb2ludCwgaW50ZXJ2YWwgfSBmcm9tIFwiLi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi4vbmVhcmJ5aW5kZXguanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVycy5qc1wiXG5pbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuLi9hcGlfc3JjcHJvcC5qc1wiO1xuXG5cbi8qKlxuICogQ29udmVuaWVuY2UgbWVyZ2Ugb3B0aW9uc1xuICovXG5jb25zdCBtZXJnZV9vcHRpb25zID0ge1xuICAgIHN1bToge1xuICAgICAgICB2YWx1ZUZ1bmM6IGZ1bmN0aW9uIChpbmZvKSB7XG4gICAgICAgICAgICAvLyByZXR1cm5zIHRoZSBzdW0gb2YgdmFsdWVzIG9mIGFjdGl2ZSBsYXllcnNcbiAgICAgICAgICAgIHJldHVybiBpbmZvLnN0YXRlc1xuICAgICAgICAgICAgICAgIC5tYXAoc3RhdGUgPT4gc3RhdGUudmFsdWUpIFxuICAgICAgICAgICAgICAgIC5yZWR1Y2UoKGFjYywgdmFsdWUpID0+IGFjYyArIHZhbHVlLCAwKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc3RhY2s6IHtcbiAgICAgICAgc3RhdGVGdW5jOiBmdW5jdGlvbiAoaW5mbykge1xuICAgICAgICAgICAgLy8gcmV0dXJucyB2YWx1ZXMgZnJvbSBmaXJzdCBhY3RpdmUgbGF5ZXJcbiAgICAgICAgICAgIHJldHVybiB7Li4uaW5mby5zdGF0ZXNbMF19XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGFycmF5OiB7XG4gICAgICAgIHZhbHVlRnVuYzogZnVuY3Rpb24gKGluZm8pIHtcbiAgICAgICAgICAgIC8vIHJldHVybnMgYW4gYXJyYXkgd2l0aCB2YWx1ZXMgZnJvbSBhY3RpdmUgbGF5ZXJzXG4gICAgICAgICAgICByZXR1cm4gaW5mby5zdGF0ZXMubWFwKHN0YXRlID0+IHN0YXRlLnZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKipcbiAqIFxuICogVGhpcyBpbXBsZW1lbnRzIGEgbWVyZ2Ugb3BlcmF0aW9uIGZvciBsYXllcnMuXG4gKiBMaXN0IG9mIHNvdXJjZXMgaXMgaW1tdXRhYmxlLlxuICogXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlIChzb3VyY2VzLCBvcHRpb25zPXt9KSB7XG4gICAgY29uc3Qge3R5cGU9XCJcIn0gPSBvcHRpb25zO1xuXG4gICAgaWYgKHR5cGUgaW4gbWVyZ2Vfb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gbmV3IE1lcmdlTGF5ZXIoc291cmNlcywgbWVyZ2Vfb3B0aW9uc1t0eXBlXSlcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV3IE1lcmdlTGF5ZXIoc291cmNlcywgb3B0aW9ucyk7XG4gICAgfVxufVxuXG5cbmNsYXNzIE1lcmdlTGF5ZXIgZXh0ZW5kcyBMYXllciB7XG5cbiAgICBjb25zdHJ1Y3Rvcihzb3VyY2VzLCBvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgICAgIC8vIHNldHVwIHNvdXJjZXMgcHJvcGVydHlcbiAgICAgICAgc3JjcHJvcC5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLnNyY3Byb3BfcmVnaXN0ZXIoXCJzb3VyY2VzXCIsIHttdXRhYmxlOmZhbHNlfSk7XG4gICAgICAgIHRoaXMuc291cmNlcyA9IHNvdXJjZXM7XG4gICAgfVxuXG4gICAgc3JjcHJvcF9jaGVjayhwcm9wTmFtZSwgc291cmNlcykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzb3VyY2VzXCIpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIHRoYXQgc291cmNlcyBpcyBhcnJheSBvZiBsYXllcnNcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShzb3VyY2VzKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgc291cmNlcyBtdXN0IGJlIGFycmF5ICR7c291cmNlc31gKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYWxsX2xheWVycyA9IHNvdXJjZXMubWFwKChlKSA9PiBlIGluc3RhbmNlb2YgTGF5ZXIpLmV2ZXJ5KGUgPT4gZSk7XG4gICAgICAgICAgICBpZiAoIWFsbF9sYXllcnMpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNvdXJjZXMgbXVzdCBhbGwgYmUgbGF5ZXJzICR7c291cmNlc31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc291cmNlcztcbiAgICB9XG5cbiAgICBzcmNwcm9wX29uY2hhbmdlKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNvdXJjZXNcIikge1xuICAgICAgICAgICAgaWYgKHRoaXMuaW5kZXggPT0gdW5kZWZpbmVkIHx8IGVBcmcgPT0gXCJyZXNldFwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRleCA9IG5ldyBNZXJnZUluZGV4KHRoaXMuc291cmNlcylcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICB0aGlzLmNsZWFyQ2FjaGVzKCk7XG4gICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIpO1xuICAgICAgICB9XG4gICAgfVxufVxuc3JjcHJvcC5hZGRUb1Byb3RvdHlwZShNZXJnZUxheWVyLnByb3RvdHlwZSk7XG5cblxuXG4vKipcbiAqIE1lcmdpbmcgaW5kZXhlcyBmcm9tIG11bHRpcGxlIHNvdXJjZXMgaW50byBhIHNpbmdsZSBpbmRleC5cbiAqIFxuICogQSBzb3VyY2UgaXMgYW4gb2JqZWN0IHdpdGggYW4gaW5kZXguXG4gKiAtIGxheWVyIChjdXJzb3IpXG4gKiBcbiAqIFRoZSBtZXJnZWQgaW5kZXggZ2l2ZXMgYSB0ZW1wb3JhbCBzdHJ1Y3R1cmUgZm9yIHRoZVxuICogY29sbGVjdGlvbiBvZiBzb3VyY2VzLCBjb21wdXRpbmcgYSBsaXN0IG9mXG4gKiBzb3VyY2VzIHdoaWNoIGFyZSBkZWZpbmVkIGF0IGEgZ2l2ZW4gb2Zmc2V0XG4gKiBcbiAqIG5lYXJieShvZmZzZXQpLmNlbnRlciBpcyBhIGxpc3Qgb2YgaXRlbXNcbiAqIFt7aXR2LCBzcmN9XVxuICogXG4gKiBJbXBsZW1lbnRhaW9uIGlzIHN0YXRlbGVzcy5cbiAqL1xuXG5mdW5jdGlvbiBjbXBfYXNjZW5kaW5nKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludC5jbXAocDEsIHAyKVxufVxuXG5mdW5jdGlvbiBjbXBfZGVzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAyLCBwMSlcbn1cblxuZXhwb3J0IGNsYXNzIE1lcmdlSW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Ioc291cmNlcykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9zb3VyY2VzID0gc291cmNlcztcbiAgICAgICAgdGhpcy5fY2FjaGVzID0gbmV3IE1hcChzb3VyY2VzLm1hcCgoc3JjKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3NyYywgc3JjLmdldENhY2hlKCldO1xuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBvZmZzZXQgPSB0aGlzLmNoZWNrKG9mZnNldCk7XG4gICAgICAgIC8vIGFjY3VtdWxhdGUgbmVhcmJ5IGZyb20gYWxsIHNvdXJjZXNcbiAgICAgICAgY29uc3QgcHJldl9saXN0ID0gW10sIG5leHRfbGlzdCA9IFtdO1xuICAgICAgICBjb25zdCBjZW50ZXJfbGlzdCA9IFtdO1xuICAgICAgICBjb25zdCBjZW50ZXJfaGlnaF9saXN0ID0gW107XG4gICAgICAgIGNvbnN0IGNlbnRlcl9sb3dfbGlzdCA9IFtdXG4gICAgICAgIGZvciAobGV0IHNyYyBvZiB0aGlzLl9zb3VyY2VzKSB7XG4gICAgICAgICAgICBsZXQgbmVhcmJ5ID0gc3JjLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICAgICAgbGV0IHByZXZfcmVnaW9uID0gc3JjLmluZGV4LmZpbmRfcmVnaW9uKG5lYXJieSwge2RpcmVjdGlvbjotMX0pO1xuICAgICAgICAgICAgbGV0IG5leHRfcmVnaW9uID0gc3JjLmluZGV4LmZpbmRfcmVnaW9uKG5lYXJieSwge2RpcmVjdGlvbjoxfSk7XG4gICAgICAgICAgICBpZiAocHJldl9yZWdpb24gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcHJldl9saXN0LnB1c2goZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChwcmV2X3JlZ2lvbi5pdHYpWzFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChuZXh0X3JlZ2lvbiAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBuZXh0X2xpc3QucHVzaChlbmRwb2ludC5mcm9tX2ludGVydmFsKG5leHRfcmVnaW9uLml0dilbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5lYXJieS5jZW50ZXIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNlbnRlcl9saXN0LnB1c2godGhpcy5fY2FjaGVzLmdldChzcmMpKTtcbiAgICAgICAgICAgICAgICBsZXQgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5lYXJieS5pdHYpO1xuICAgICAgICAgICAgICAgIGNlbnRlcl9oaWdoX2xpc3QucHVzaChoaWdoKTtcbiAgICAgICAgICAgICAgICBjZW50ZXJfbG93X2xpc3QucHVzaChsb3cpOyAgICBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gZmluZCBjbG9zZXN0IGVuZHBvaW50IHRvIHRoZSByaWdodCAobm90IGluIGNlbnRlcilcbiAgICAgICAgbmV4dF9saXN0LnNvcnQoY21wX2FzY2VuZGluZyk7XG4gICAgICAgIGNvbnN0IG1pbl9uZXh0X2xvdyA9IG5leHRfbGlzdFswXSB8fCBbSW5maW5pdHksIDBdO1xuXG4gICAgICAgIC8vIGZpbmQgY2xvc2VzdCBlbmRwb2ludCB0byB0aGUgbGVmdCAobm90IGluIGNlbnRlcilcbiAgICAgICAgcHJldl9saXN0LnNvcnQoY21wX2Rlc2NlbmRpbmcpO1xuICAgICAgICBjb25zdCBtYXhfcHJldl9oaWdoID0gcHJldl9saXN0WzBdIHx8IFstSW5maW5pdHksIDBdO1xuXG4gICAgICAgIC8vIG5lYXJieVxuICAgICAgICBsZXQgbG93LCBoaWdoOyBcbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgICAgY2VudGVyOiBjZW50ZXJfbGlzdCwgXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2VudGVyX2xpc3QubGVuZ3RoID09IDApIHtcblxuICAgICAgICAgICAgLy8gZW1wdHkgY2VudGVyXG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSBtaW5fbmV4dF9sb3c7ICBcbiAgICAgICAgICAgIC8vcmVzdWx0Lm5leHQgPSBtaW5fbmV4dF9sb3c7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IG1heF9wcmV2X2hpZ2g7XG4gICAgICAgICAgICAvL3Jlc3VsdC5wcmV2ID0gbWF4X3ByZXZfaGlnaDtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbm9uLWVtcHR5IGNlbnRlclxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBjZW50ZXIgaGlnaFxuICAgICAgICAgICAgY2VudGVyX2hpZ2hfbGlzdC5zb3J0KGNtcF9hc2NlbmRpbmcpO1xuICAgICAgICAgICAgbGV0IG1pbl9jZW50ZXJfaGlnaCA9IGNlbnRlcl9oaWdoX2xpc3RbMF07XG4gICAgICAgICAgICBsZXQgbWF4X2NlbnRlcl9oaWdoID0gY2VudGVyX2hpZ2hfbGlzdC5zbGljZSgtMSlbMF07XG4gICAgICAgICAgICBsZXQgbXVsdGlwbGVfY2VudGVyX2hpZ2ggPSAhZW5kcG9pbnQuZXEobWluX2NlbnRlcl9oaWdoLCBtYXhfY2VudGVyX2hpZ2gpXG5cbiAgICAgICAgICAgIC8vIGNlbnRlciBsb3dcbiAgICAgICAgICAgIGNlbnRlcl9sb3dfbGlzdC5zb3J0KGNtcF9kZXNjZW5kaW5nKTtcbiAgICAgICAgICAgIGxldCBtYXhfY2VudGVyX2xvdyA9IGNlbnRlcl9sb3dfbGlzdFswXTtcbiAgICAgICAgICAgIGxldCBtaW5fY2VudGVyX2xvdyA9IGNlbnRlcl9sb3dfbGlzdC5zbGljZSgtMSlbMF07XG4gICAgICAgICAgICBsZXQgbXVsdGlwbGVfY2VudGVyX2xvdyA9ICFlbmRwb2ludC5lcShtYXhfY2VudGVyX2xvdywgbWluX2NlbnRlcl9sb3cpXG5cbiAgICAgICAgICAgIC8vIG5leHQvcmlnaHRcbiAgICAgICAgICAgIGlmIChlbmRwb2ludC5sZShtaW5fbmV4dF9sb3csIG1pbl9jZW50ZXJfaGlnaCkpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQucmlnaHQgPSBtaW5fbmV4dF9sb3c7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IGVuZHBvaW50LmZsaXAobWluX2NlbnRlcl9oaWdoLCBcImxvd1wiKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0Lm5leHQgPSAobXVsdGlwbGVfY2VudGVyX2hpZ2gpID8gcmVzdWx0LnJpZ2h0IDogbWluX25leHRfbG93O1xuXG4gICAgICAgICAgICAvLyBwcmV2L2xlZnRcbiAgICAgICAgICAgIGlmIChlbmRwb2ludC5nZShtYXhfcHJldl9oaWdoLCBtYXhfY2VudGVyX2xvdykpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQubGVmdCA9IG1heF9wcmV2X2hpZ2g7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gZW5kcG9pbnQuZmxpcChtYXhfY2VudGVyX2xvdywgXCJoaWdoXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0LnByZXYgPSAobXVsdGlwbGVfY2VudGVyX2xvdykgPyByZXN1bHQubGVmdCA6IG1heF9wcmV2X2hpZ2g7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGludGVydmFsIGZyb20gbGVmdC9yaWdodFxuICAgICAgICBsb3cgPSBlbmRwb2ludC5mbGlwKHJlc3VsdC5sZWZ0LCBcImxvd1wiKTtcbiAgICAgICAgaGlnaCA9IGVuZHBvaW50LmZsaXAocmVzdWx0LnJpZ2h0LCBcImhpZ2hcIik7XG4gICAgICAgIHJlc3VsdC5pdHYgPSBpbnRlcnZhbC5mcm9tX2VuZHBvaW50cyhsb3csIGhpZ2gpO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufTtcblxuIiwiaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4uL25lYXJieWluZGV4LmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcnMuanNcIlxuaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi4vYXBpX3NyY3Byb3AuanNcIjtcblxuZnVuY3Rpb24gc2hpZnRlZChwLCBvZmZzZXQpIHtcbiAgICBpZiAocCA9PSB1bmRlZmluZWQgfHwgIWlzRmluaXRlKHApKSB7XG4gICAgICAgIC8vIHAgLSBubyBza2V3XG4gICAgICAgIHJldHVybiBwO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2YgcCA9PSBcIm51bWJlclwiKSB7XG4gICAgICAgIC8vIHAgaXMgbnVtYmVyIC0gc2tld1xuICAgICAgICByZXR1cm4gcCArIG9mZnNldDtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocCkgJiYgcC5sZW5ndGggPiAxKSB7XG4gICAgICAgIC8vIHAgaXMgZW5kcG9pbnQgLSBza2V3IHZhbHVlXG4gICAgICAgIGxldCBbdmFsLCBzaWduXSA9IHA7XG4gICAgICAgIHJldHVybiBbdmFsICsgb2Zmc2V0LCBzaWduXTtcbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNISUZUIElOREVYXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmNsYXNzIFNoaWZ0SW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKGxheWVyLCBza2V3KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIHRoaXMuX3NrZXcgPSBza2V3O1xuICAgICAgICB0aGlzLl9jYWNoZSA9IGxheWVyLmdldENhY2hlKCk7XG5cbiAgICAgICAgLy8gc2tld2luZyBjYWNoZSBvYmplY3RcbiAgICAgICAgdGhpcy5fc2hpZnRlZF9jYWNoZSA9IHtcbiAgICAgICAgICAgIHF1ZXJ5OiBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgLy8gc2tldyBxdWVyeSAobmVnYXRpdmUpIC0gb3ZlcnJpZGUgcmVzdWx0IG9mZnNldFxuICAgICAgICAgICAgICAgIHJldHVybiB7Li4udGhpcy5fY2FjaGUucXVlcnkoc2hpZnRlZChvZmZzZXQsIC10aGlzLl9za2V3KSksIG9mZnNldH07XG4gICAgICAgICAgICB9LmJpbmQodGhpcylcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBza2V3aW5nIGluZGV4Lm5lYXJieVxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgLy8gc2tldyBxdWVyeSAobmVnYXRpdmUpXG4gICAgICAgIGNvbnN0IG5lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShzaGlmdGVkKG9mZnNldCwgLXRoaXMuX3NrZXcpKTtcbiAgICAgICAgLy8gc2tldyByZXN1bHQgKHBvc2l0aXZlKSBcbiAgICAgICAgY29uc3QgaXR2ID0gbmVhcmJ5Lml0di5zbGljZSgpO1xuICAgICAgICBpdHZbMF0gPSBzaGlmdGVkKG5lYXJieS5pdHZbMF0sIHRoaXMuX3NrZXcpO1xuICAgICAgICBpdHZbMV0gPSBzaGlmdGVkKG5lYXJieS5pdHZbMV0sIHRoaXMuX3NrZXcpXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpdHYsXG4gICAgICAgICAgICBsZWZ0OiBzaGlmdGVkKG5lYXJieS5sZWZ0LCB0aGlzLl9za2V3KSxcbiAgICAgICAgICAgIHJpZ2h0OiBzaGlmdGVkKG5lYXJieS5yaWdodCwgdGhpcy5fc2tldyksXG4gICAgICAgICAgICBjZW50ZXI6IG5lYXJieS5jZW50ZXIubWFwKCgpID0+IHRoaXMuX3NoaWZ0ZWRfY2FjaGUpXG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNISUZUIExBWUVSXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuY2xhc3MgU2hpZnRMYXllciBleHRlbmRzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKGxheWVyLCBza2V3LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgICB0aGlzLl9za2V3ID0gc2tldztcbiAgICAgICAgLy8gc2V0dXAgc3JjIHByb3B0ZXJ0eVxuICAgICAgICBzcmNwcm9wLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuc3JjcHJvcF9yZWdpc3RlcihcInNyY1wiKTtcbiAgICAgICAgdGhpcy5zcmMgPSBsYXllcjtcbiAgICB9XG5cbiAgICBzcmNwcm9wX2NoZWNrKHByb3BOYW1lLCBzcmMpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIExheWVyICR7c3JjfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNyYzsgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzcmNwcm9wX29uY2hhbmdlKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleCA9PSB1bmRlZmluZWQgfHwgZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4ID0gbmV3IFNoaWZ0SW5kZXgodGhpcy5zcmMsIHRoaXMuX3NrZXcpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgdGhpcy5jbGVhckNhY2hlcygpO1xuICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiKTsgICAgXG4gICAgICAgIH1cbiAgICB9XG59XG5zcmNwcm9wLmFkZFRvUHJvdG90eXBlKFNoaWZ0TGF5ZXIucHJvdG90eXBlKTtcblxuLyoqXG4gKiBTa2V3aW5nIGEgTGF5ZXIgYnkgYW4gb2Zmc2V0XG4gKiBcbiAqIGEgcG9zaXRpdmUgdmFsdWUgZm9yIG9mZnNldCBtZWFucyB0aGF0XG4gKiB0aGUgbGF5ZXIgaXMgc2hpZnRlZCB0byB0aGUgcmlnaHQgb24gdGhlIHRpbWVsaW5lXG4gKiBcbiAqIFxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBzaGlmdCAobGF5ZXIsIG9mZnNldCkge1xuICAgIHJldHVybiBuZXcgU2hpZnRMYXllcihsYXllciwgb2Zmc2V0KTtcbn1cbiIsImltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL2FwaV9jYWxsYmFjay5qc1wiO1xuaW1wb3J0IHsgQ0xPQ0sgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENMT0NLIFBST1ZJREVSIEJBU0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogQmFzZSBjbGFzcyBmb3IgQ2xvY2tQcm92aWRlcnNcbiAqIFxuICogQ2xvY2sgUHJvdmlkZXJzIGltcGxlbWVudCB0aGUgY2FsbGJhY2tcbiAqIGludGVyZmFjZSB0byBiZSBjb21wYXRpYmxlIHdpdGggb3RoZXIgc3RhdGVcbiAqIHByb3ZpZGVycywgZXZlbiB0aG91Z2ggdGhleSBhcmUgbm90IHJlcXVpcmVkIHRvXG4gKiBwcm92aWRlIGFueSBjYWxsYmFja3MgYWZ0ZXIgY2xvY2sgYWRqdXN0bWVudHNcbiAqL1xuXG5leHBvcnQgY2xhc3MgQ2xvY2tQcm92aWRlckJhc2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBjYWxsYmFjay5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgIH1cbiAgICBub3cgKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoQ2xvY2tQcm92aWRlckJhc2UucHJvdG90eXBlKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExPQ0FMIENMT0NLIFBST1ZJREVSXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jbGFzcyBMb2NhbENsb2NrUHJvdmlkZXIgZXh0ZW5kcyBDbG9ja1Byb3ZpZGVyQmFzZSB7XG4gICAgbm93ICgpIHtcbiAgICAgICAgcmV0dXJuIENMT0NLLm5vdygpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNvbnN0IGxvY2FsQ2xvY2tQcm92aWRlciA9IG5ldyBMb2NhbENsb2NrUHJvdmlkZXIoKTtcbiIsIlxuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX2Jhc2VzXCI7XG5jb25zdCBNRVRIT0RTID0ge2Fzc2lnbiwgbW92ZSwgdHJhbnNpdGlvbiwgaW50ZXJwb2xhdGV9O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBjbWQgKHRhcmdldCkge1xuICAgIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhcmdldC5zcmMgbXVzdCBiZSBzdGF0ZXByb3ZpZGVyICR7dGFyZ2V0fWApO1xuICAgIH1cbiAgICBsZXQgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKE1FVEhPRFMpXG4gICAgICAgIC5tYXAoKFtuYW1lLCBtZXRob2RdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oLi4uYXJncykgeyBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGl0ZW1zID0gbWV0aG9kLmNhbGwodGhpcywgLi4uYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXQudXBkYXRlKGl0ZW1zKTsgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhlbnRyaWVzKTtcbn1cblxuZnVuY3Rpb24gYXNzaWduKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IGl0ZW0gPSB7XG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2YWx1ZSAgICAgICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtpdGVtXTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG1vdmUodmVjdG9yKSB7XG4gICAgbGV0IGl0ZW0gPSB7XG4gICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICBkYXRhOiB2ZWN0b3IgIFxuICAgIH1cbiAgICByZXR1cm4gW2l0ZW1dO1xufVxuXG5mdW5jdGlvbiB0cmFuc2l0aW9uKHYwLCB2MSwgdDAsIHQxLCBlYXNpbmcpIHtcbiAgICBsZXQgaXRlbXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgdDAsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MCwgdDEsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwidHJhbnNpdGlvblwiLFxuICAgICAgICAgICAgZGF0YToge3YwLCB2MSwgdDAsIHQxLCBlYXNpbmd9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdjFcbiAgICAgICAgfVxuICAgIF1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKHR1cGxlcykge1xuICAgIGxldCBbdjAsIHQwXSA9IHR1cGxlc1swXTtcbiAgICBsZXQgW3YxLCB0MV0gPSB0dXBsZXNbdHVwbGVzLmxlbmd0aC0xXTtcblxuICAgIGxldCBpdGVtcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYwXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJpbnRlcnBvbGF0aW9uXCIsXG4gICAgICAgICAgICBkYXRhOiB0dXBsZXNcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDEsIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MVxuICAgICAgICB9XG4gICAgXSAgICBcbiAgICByZXR1cm4gaXRlbXM7XG59XG5cblxuXG4iLCJpbXBvcnQge2Rpdm1vZH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuXG4vKlxuICAgIFRpbWVvdXQgTW9uaXRvclxuXG4gICAgVGltZW91dCBNb25pdG9yIGlzIHNpbWlsYXIgdG8gc2V0SW50ZXJ2YWwsIGluIHRoZSBzZW5zZSB0aGF0IFxuICAgIGl0IGFsbG93cyBjYWxsYmFja3MgdG8gYmUgZmlyZWQgcGVyaW9kaWNhbGx5IFxuICAgIHdpdGggYSBnaXZlbiBkZWxheSAoaW4gbWlsbGlzKS4gIFxuICAgIFxuICAgIFRpbWVvdXQgTW9uaXRvciBpcyBtYWRlIHRvIHNhbXBsZSB0aGUgc3RhdGUgXG4gICAgb2YgYSBkeW5hbWljIG9iamVjdCwgcGVyaW9kaWNhbGx5LiBGb3IgdGhpcyByZWFzb24sIGVhY2ggY2FsbGJhY2sgaXMgXG4gICAgYm91bmQgdG8gYSBtb25pdG9yZWQgb2JqZWN0LCB3aGljaCB3ZSBoZXJlIGNhbGwgYSB2YXJpYWJsZS4gXG4gICAgT24gZWFjaCBpbnZvY2F0aW9uLCBhIGNhbGxiYWNrIHdpbGwgcHJvdmlkZSBhIGZyZXNobHkgc2FtcGxlZCBcbiAgICB2YWx1ZSBmcm9tIHRoZSB2YXJpYWJsZS5cblxuICAgIFRoaXMgdmFsdWUgaXMgYXNzdW1lZCB0byBiZSBhdmFpbGFibGUgYnkgcXVlcnlpbmcgdGhlIHZhcmlhYmxlLiBcblxuICAgICAgICB2LnF1ZXJ5KCkgLT4ge3ZhbHVlLCBkeW5hbWljLCBvZmZzZXQsIHRzfVxuXG4gICAgSW4gYWRkaXRpb24sIHRoZSB2YXJpYWJsZSBvYmplY3QgbWF5IHN3aXRjaCBiYWNrIGFuZCBcbiAgICBmb3J0aCBiZXR3ZWVuIGR5bmFtaWMgYW5kIHN0YXRpYyBiZWhhdmlvci4gVGhlIFRpbWVvdXQgTW9uaXRvclxuICAgIHR1cm5zIHBvbGxpbmcgb2ZmIHdoZW4gdGhlIHZhcmlhYmxlIGlzIG5vIGxvbmdlciBkeW5hbWljLCBcbiAgICBhbmQgcmVzdW1lcyBwb2xsaW5nIHdoZW4gdGhlIG9iamVjdCBiZWNvbWVzIGR5bmFtaWMuXG5cbiAgICBTdGF0ZSBjaGFuZ2VzIGFyZSBleHBlY3RlZCB0byBiZSBzaWduYWxsZWQgdGhyb3VnaCBhIDxjaGFuZ2U+IGV2ZW50LlxuXG4gICAgICAgIHN1YiA9IHYub24oXCJjaGFuZ2VcIiwgY2FsbGJhY2spXG4gICAgICAgIHYub2ZmKHN1YilcblxuICAgIENhbGxiYWNrcyBhcmUgaW52b2tlZCBvbiBldmVyeSA8Y2hhbmdlPiBldmVudCwgYXMgd2VsbFxuICAgIGFzIHBlcmlvZGljYWxseSB3aGVuIHRoZSBvYmplY3QgaXMgaW4gPGR5bmFtaWM+IHN0YXRlLlxuXG4gICAgICAgIGNhbGxiYWNrKHt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0LCB0c30pXG5cbiAgICBGdXJ0aGVybW9yZSwgaW4gb3JkZXIgdG8gc3VwcG9ydCBjb25zaXN0ZW50IHJlbmRlcmluZyBvZlxuICAgIHN0YXRlIGNoYW5nZXMgZnJvbSBtYW55IGR5bmFtaWMgdmFyaWFibGVzLCBpdCBpcyBpbXBvcnRhbnQgdGhhdFxuICAgIGNhbGxiYWNrcyBhcmUgaW52b2tlZCBhdCB0aGUgc2FtZSB0aW1lIGFzIG11Y2ggYXMgcG9zc2libGUsIHNvXG4gICAgdGhhdCBjaGFuZ2VzIHRoYXQgb2NjdXIgbmVhciBpbiB0aW1lIGNhbiBiZSBwYXJ0IG9mIHRoZSBzYW1lXG4gICAgc2NyZWVuIHJlZnJlc2guIFxuXG4gICAgRm9yIHRoaXMgcmVhc29uLCB0aGUgVGltZW91dE1vbml0b3IgZ3JvdXBzIGNhbGxiYWNrcyBpbiB0aW1lXG4gICAgYW5kIGludm9rZXMgY2FsbGJhY2tzIGF0IGF0IGZpeGVkIG1heGltdW0gcmF0ZSAoMjBIei81MG1zKS5cbiAgICBUaGlzIGltcGxpZXMgdGhhdCBwb2xsaW5nIGNhbGxiYWNrcyB3aWxsIGZhbGwgb24gYSBzaGFyZWQgXG4gICAgcG9sbGluZyBmcmVxdWVuY3kuXG5cbiAgICBBdCB0aGUgc2FtZSB0aW1lLCBjYWxsYmFja3MgbWF5IGhhdmUgaW5kaXZpZHVhbCBmcmVxdWVuY2llcyB0aGF0XG4gICAgYXJlIG11Y2ggbG93ZXIgcmF0ZSB0aGFuIHRoZSBtYXhpbXVtIHJhdGUuIFRoZSBpbXBsZW1lbnRhdGlvblxuICAgIGRvZXMgbm90IHJlbHkgb24gYSBmaXhlZCA1MG1zIHRpbWVvdXQgZnJlcXVlbmN5LCBidXQgaXMgdGltZW91dCBiYXNlZCxcbiAgICB0aHVzIHRoZXJlIGlzIG5vIHByb2Nlc3Npbmcgb3IgdGltZW91dCBiZXR3ZWVuIGNhbGxiYWNrcywgZXZlblxuICAgIGlmIGFsbCBjYWxsYmFja3MgaGF2ZSBsb3cgcmF0ZXMuXG5cbiAgICBJdCBpcyBzYWZlIHRvIGRlZmluZSBtdWx0aXBsZSBjYWxsYWJhY2tzIGZvciBhIHNpbmdsZSB2YXJpYWJsZSwgZWFjaFxuICAgIGNhbGxiYWNrIHdpdGggYSBkaWZmZXJlbnQgcG9sbGluZyBmcmVxdWVuY3kuXG5cbiAgICBvcHRpb25zXG4gICAgICAgIDxyYXRlPiAtIGRlZmF1bHQgNTA6IHNwZWNpZnkgbWluaW11bSBmcmVxdWVuY3kgaW4gbXNcblxuKi9cblxuXG5jb25zdCBSQVRFX01TID0gNTBcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVElNRU9VVCBNT05JVE9SXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgQmFzZSBjbGFzcyBmb3IgVGltZW91dCBNb25pdG9yIGFuZCBGcmFtZXJhdGUgTW9uaXRvclxuKi9cblxuY2xhc3MgVGltZW91dE1vbml0b3Ige1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuXG4gICAgICAgIHRoaXMuX29wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtyYXRlOiBSQVRFX01TfSwgb3B0aW9ucyk7XG4gICAgICAgIGlmICh0aGlzLl9vcHRpb25zLnJhdGUgPCBSQVRFX01TKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlsbGVnYWwgcmF0ZSAke3JhdGV9LCBtaW5pbXVtIHJhdGUgaXMgJHtSQVRFX01TfWApO1xuICAgICAgICB9XG4gICAgICAgIC8qXG4gICAgICAgICAgICBtYXBcbiAgICAgICAgICAgIGhhbmRsZSAtPiB7Y2FsbGJhY2ssIHZhcmlhYmxlLCBkZWxheX1cbiAgICAgICAgICAgIC0gdmFyaWFibGU6IHRhcmdldCBmb3Igc2FtcGxpbmdcbiAgICAgICAgICAgIC0gY2FsbGJhY2s6IGZ1bmN0aW9uKHZhbHVlKVxuICAgICAgICAgICAgLSBkZWxheTogYmV0d2VlbiBzYW1wbGVzICh3aGVuIHZhcmlhYmxlIGlzIGR5bmFtaWMpXG4gICAgICAgICovXG4gICAgICAgIHRoaXMuX3NldCA9IG5ldyBTZXQoKTtcbiAgICAgICAgLypcbiAgICAgICAgICAgIHZhcmlhYmxlIG1hcFxuICAgICAgICAgICAgdmFyaWFibGUgLT4ge3N1YiwgcG9sbGluZywgaGFuZGxlczpbXX1cbiAgICAgICAgICAgIC0gc3ViIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICAgICAgICAgLSBwb2xsaW5nOiB0cnVlIGlmIHZhcmlhYmxlIG5lZWRzIHBvbGxpbmdcbiAgICAgICAgICAgIC0gaGFuZGxlczogbGlzdCBvZiBoYW5kbGVzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIC8vIHZhcmlhYmxlIGNoYW5nZSBoYW5kbGVyXG4gICAgICAgIHRoaXMuX19vbnZhcmlhYmxlY2hhbmdlID0gdGhpcy5fb252YXJpYWJsZWNoYW5nZS5iaW5kKHRoaXMpO1xuICAgIH1cblxuICAgIGJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgICAgICAvLyByZWdpc3RlciBiaW5kaW5nXG4gICAgICAgIGxldCBoYW5kbGUgPSB7Y2FsbGJhY2ssIHZhcmlhYmxlLCBkZWxheX07XG4gICAgICAgIHRoaXMuX3NldC5hZGQoaGFuZGxlKTtcbiAgICAgICAgLy8gcmVnaXN0ZXIgdmFyaWFibGVcbiAgICAgICAgaWYgKCF0aGlzLl92YXJpYWJsZV9tYXAuaGFzKHZhcmlhYmxlKSkge1xuICAgICAgICAgICAgbGV0IHN1YiA9IHZhcmlhYmxlLm9uKFwiY2hhbmdlXCIsIHRoaXMuX19vbnZhcmlhYmxlY2hhbmdlKTtcbiAgICAgICAgICAgIGxldCBpdGVtID0ge3N1YiwgcG9sbGluZzpmYWxzZSwgaGFuZGxlczogW2hhbmRsZV19O1xuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLnNldCh2YXJpYWJsZSwgaXRlbSk7XG4gICAgICAgICAgICAvL3RoaXMuX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKS5oYW5kbGVzLnB1c2goaGFuZGxlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaGFuZGxlO1xuICAgIH1cblxuICAgIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgICAgIC8vIGNsZWFudXBcbiAgICAgICAgbGV0IHJlbW92ZWQgPSB0aGlzLl9zZXQuZGVsZXRlKGhhbmRsZSk7XG4gICAgICAgIGlmICghcmVtb3ZlZCkgcmV0dXJuO1xuICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjbGVhbnVwIHZhcmlhYmxlIG1hcFxuICAgICAgICBsZXQgdmFyaWFibGUgPSBoYW5kbGUudmFyaWFibGU7XG4gICAgICAgIGxldCB7c3ViLCBoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQgaWR4ID0gaGFuZGxlcy5pbmRleE9mKGhhbmRsZSk7XG4gICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgaGFuZGxlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGFuZGxlcy5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgLy8gdmFyaWFibGUgaGFzIG5vIGhhbmRsZXNcbiAgICAgICAgICAgIC8vIGNsZWFudXAgdmFyaWFibGUgbWFwXG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuZGVsZXRlKHZhcmlhYmxlKTtcbiAgICAgICAgICAgIHZhcmlhYmxlLm9mZihzdWIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgdmFyaWFibGUgZW1pdHMgYSBjaGFuZ2UgZXZlbnRcbiAgICAqL1xuICAgIF9vbnZhcmlhYmxlY2hhbmdlIChlQXJnLCBlSW5mbykge1xuICAgICAgICBsZXQgdmFyaWFibGUgPSBlSW5mby5zcmM7XG4gICAgICAgIC8vIGRpcmVjdCBjYWxsYmFjayAtIGNvdWxkIHVzZSBlQXJnIGhlcmVcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQgc3RhdGUgPSBlQXJnO1xuICAgICAgICAvLyByZWV2YWx1YXRlIHBvbGxpbmdcbiAgICAgICAgdGhpcy5fcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlLCBzdGF0ZSk7XG4gICAgICAgIC8vIGNhbGxiYWNrc1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHN0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHN0YXJ0IG9yIHN0b3AgcG9sbGluZyBpZiBuZWVkZWRcbiAgICAqL1xuICAgIF9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUsIHN0YXRlKSB7XG4gICAgICAgIGxldCBpdGVtID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCB7cG9sbGluZzp3YXNfcG9sbGluZ30gPSBpdGVtO1xuICAgICAgICBzdGF0ZSA9IHN0YXRlIHx8IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgIGxldCBzaG91bGRfYmVfcG9sbGluZyA9IHN0YXRlLmR5bmFtaWM7XG4gICAgICAgIGlmICghd2FzX3BvbGxpbmcgJiYgc2hvdWxkX2JlX3BvbGxpbmcpIHtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dHModmFyaWFibGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHdhc19wb2xsaW5nICYmICFzaG91bGRfYmVfcG9sbGluZykge1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBzZXQgdGltZW91dCBmb3IgYWxsIGNhbGxiYWNrcyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAqL1xuICAgIF9zZXRfdGltZW91dHModmFyaWFibGUpIHtcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9zZXRfdGltZW91dChoYW5kbGUpIHtcbiAgICAgICAgbGV0IGRlbHRhID0gdGhpcy5fY2FsY3VsYXRlX2RlbHRhKGhhbmRsZS5kZWxheSk7XG4gICAgICAgIGxldCBoYW5kbGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlX3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBoYW5kbGUudGlkID0gc2V0VGltZW91dChoYW5kbGVyLCBkZWx0YSk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgYWRqdXN0IGRlbGF5IHNvIHRoYXQgaWYgZmFsbHMgb25cbiAgICAgICAgdGhlIG1haW4gdGljayByYXRlXG4gICAgKi9cbiAgICBfY2FsY3VsYXRlX2RlbHRhKGRlbGF5KSB7XG4gICAgICAgIGxldCByYXRlID0gdGhpcy5fb3B0aW9ucy5yYXRlO1xuICAgICAgICBsZXQgbm93ID0gTWF0aC5yb3VuZChwZXJmb3JtYW5jZS5ub3coKSk7XG4gICAgICAgIGxldCBbbm93X24sIG5vd19yXSA9IGRpdm1vZChub3csIHJhdGUpO1xuICAgICAgICBsZXQgW24sIHJdID0gZGl2bW9kKG5vdyArIGRlbGF5LCByYXRlKTtcbiAgICAgICAgbGV0IHRhcmdldCA9IE1hdGgubWF4KG4sIG5vd19uICsgMSkqcmF0ZTtcbiAgICAgICAgcmV0dXJuIHRhcmdldCAtIHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGNsZWFyIGFsbCB0aW1lb3V0cyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAqL1xuICAgIF9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSkge1xuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICBpZiAoaGFuZGxlLnRpZCAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoaGFuZGxlLnRpZCk7XG4gICAgICAgICAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGhhbmRsZSB0aW1lb3V0XG4gICAgKi9cbiAgICBfaGFuZGxlX3RpbWVvdXQoaGFuZGxlKSB7XG4gICAgICAgIC8vIGRyb3AgaWYgaGFuZGxlIHRpZCBoYXMgYmVlbiBjbGVhcmVkXG4gICAgICAgIGlmIChoYW5kbGUudGlkID09IHVuZGVmaW5lZCkgcmV0dXJuO1xuICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjYWxsYmFja1xuICAgICAgICBsZXQge3ZhcmlhYmxlfSA9IGhhbmRsZTtcbiAgICAgICAgbGV0IHN0YXRlID0gdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgLy8gcmVzY2hlZHVsZSB0aW1lb3V0cyBmb3IgY2FsbGJhY2tzXG4gICAgICAgIGlmIChzdGF0ZS5keW5hbWljKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICBtYWtlIHN1cmUgcG9sbGluZyBzdGF0ZSBpcyBhbHNvIGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcyB3b3VsZCBvbmx5IG9jY3VyIGlmIHRoZSB2YXJpYWJsZVxuICAgICAgICAgICAgICAgIHdlbnQgZnJvbSByZXBvcnRpbmcgZHluYW1pYyB0cnVlIHRvIGR5bmFtaWMgZmFsc2UsXG4gICAgICAgICAgICAgICAgd2l0aG91dCBlbW1pdHRpbmcgYSBjaGFuZ2UgZXZlbnQgLSB0aHVzXG4gICAgICAgICAgICAgICAgdmlvbGF0aW5nIHRoZSBhc3N1bXB0aW9uLiBUaGlzIHByZXNlcnZlc1xuICAgICAgICAgICAgICAgIGludGVybmFsIGludGVncml0eSBpIHRoZSBtb25pdG9yLlxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGxldCBpdGVtID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICAvL1xuICAgICAgICBoYW5kbGUuY2FsbGJhY2soc3RhdGUpO1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBGUkFNRVJBVEUgTU9OSVRPUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5cbmNsYXNzIEZyYW1lcmF0ZU1vbml0b3IgZXh0ZW5kcyBUaW1lb3V0TW9uaXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgICB0aGlzLl9oYW5kbGU7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgdGltZW91dHMgYXJlIG9ic29sZXRlXG4gICAgKi9cbiAgICBfc2V0X3RpbWVvdXRzKHZhcmlhYmxlKSB7fVxuICAgIF9zZXRfdGltZW91dChoYW5kbGUpIHt9XG4gICAgX2NhbGN1bGF0ZV9kZWx0YShkZWxheSkge31cbiAgICBfY2xlYXJfdGltZW91dHModmFyaWFibGUpIHt9XG4gICAgX2hhbmRsZV90aW1lb3V0KGhhbmRsZSkge31cblxuICAgIF9vbnZhcmlhYmxlY2hhbmdlIChlQXJnLCBlSW5mbykge1xuICAgICAgICBzdXBlci5fb252YXJpYWJsZWNoYW5nZShlQXJnLCBlSW5mbyk7XG4gICAgICAgIC8vIGtpY2sgb2ZmIGNhbGxiYWNrIGxvb3AgZHJpdmVuIGJ5IHJlcXVlc3QgYW5pbWF0aW9uZnJhbWVcbiAgICAgICAgdGhpcy5fY2FsbGJhY2soKTtcbiAgICB9XG5cbiAgICBfY2FsbGJhY2soKSB7XG4gICAgICAgIC8vIGNhbGxiYWNrIHRvIGFsbCB2YXJpYWJsZXMgd2hpY2ggcmVxdWlyZSBwb2xsaW5nXG4gICAgICAgIGxldCB2YXJpYWJsZXMgPSBbLi4udGhpcy5fdmFyaWFibGVfbWFwLmVudHJpZXMoKV1cbiAgICAgICAgICAgIC5maWx0ZXIoKFt2YXJpYWJsZSwgaXRlbV0pID0+IGl0ZW0ucG9sbGluZylcbiAgICAgICAgICAgIC5tYXAoKFt2YXJpYWJsZSwgaXRlbV0pID0+IHZhcmlhYmxlKTtcbiAgICAgICAgaWYgKHZhcmlhYmxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBjYWxsYmFja1xuICAgICAgICAgICAgZm9yIChsZXQgdmFyaWFibGUgb2YgdmFyaWFibGVzKSB7XG4gICAgICAgICAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICAgICAgICAgIGxldCByZXMgPSB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZS5jYWxsYmFjayhyZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8qIFxuICAgICAgICAgICAgICAgIHJlcXVlc3QgbmV4dCBjYWxsYmFjayBhcyBsb25nIGFzIGF0IGxlYXN0IG9uZSB2YXJpYWJsZSBcbiAgICAgICAgICAgICAgICBpcyByZXF1aXJpbmcgcG9sbGluZ1xuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLl9jYWxsYmFjay5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQklORCBSRUxFQVNFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmNvbnN0IG1vbml0b3IgPSBuZXcgVGltZW91dE1vbml0b3IoKTtcbmNvbnN0IGZyYW1lcmF0ZV9tb25pdG9yID0gbmV3IEZyYW1lcmF0ZU1vbml0b3IoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgIGxldCBoYW5kbGU7XG4gICAgaWYgKEJvb2xlYW4ocGFyc2VGbG9hdChkZWxheSkpKSB7XG4gICAgICAgIGhhbmRsZSA9IG1vbml0b3IuYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIFtcInRpbWVvdXRcIiwgaGFuZGxlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBoYW5kbGUgPSBmcmFtZXJhdGVfbW9uaXRvci5iaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgMCwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBbXCJmcmFtZXJhdGVcIiwgaGFuZGxlXTtcbiAgICB9XG59XG5leHBvcnQgZnVuY3Rpb24gcmVsZWFzZShoYW5kbGUpIHtcbiAgICBsZXQgW3R5cGUsIF9oYW5kbGVdID0gaGFuZGxlO1xuICAgIGlmICh0eXBlID09IFwidGltZW91dFwiKSB7XG4gICAgICAgIHJldHVybiBtb25pdG9yLnJlbGVhc2UoX2hhbmRsZSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwiZnJhbWVyYXRlXCIpIHtcbiAgICAgICAgcmV0dXJuIGZyYW1lcmF0ZV9tb25pdG9yLnJlbGVhc2UoX2hhbmRsZSk7XG4gICAgfVxufVxuXG4iLCJpbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuL2FwaV9zcmNwcm9wLmpzXCI7XG5pbXBvcnQgeyBDbG9ja1Byb3ZpZGVyQmFzZSwgbG9jYWxDbG9ja1Byb3ZpZGVyIH0gZnJvbSBcIi4vc3RhdGVwcm92aWRlcl9jbG9jay5qc1wiO1xuaW1wb3J0IHsgY21kIH0gZnJvbSBcIi4vY21kLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuL2xheWVycy5qc1wiO1xuaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IGJpbmQsIHJlbGVhc2UgfSBmcm9tIFwiLi9tb25pdG9yLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi9uZWFyYnlpbmRleC5qc1wiO1xuXG5cblxuLyoqXG4gKiBDdXJzb3IgZW11bGF0ZXMgTGF5ZXIgaW50ZXJmYWNlLlxuICogUGFydCBvZiB0aGlzIGlzIHRvIHByb3ZlIGFuIGluZGV4IGZvciB0aGUgdGltZWxpbmUuIFxuICogSG93ZXZlciwgd2hlbiBjb25zaWRlcmVkIGFzIGEgbGF5ZXIsIHRoZSBjdXJzb3IgdmFsdWUgaXMgXG4gKiBpbmRlcGVuZGVudCBvZiB0aW1lbGluZSBvZmZzZXQsIHdoaWNoIGlzIHRvIHNheSB0aGF0XG4gKiBpdCBoYXMgdGhlIHNhbWUgdmFsdWUgZm9yIGFsbCB0aW1lbGluZSBvZmZzZXRzLlxuICogXG4gKiBVbmxpa2Ugb3RoZXIgTGF5ZXJzLCB0aGUgQ3Vyc29yIGRvIG5vdCBhY3R1YWxseVxuICogdXNlIHRoaXMgaW5kZXggdG8gcmVzb2x2ZSBxdWVyaWVzLiBJdCBpcyBvbmx5IG5lZWRlZFxuICogZm9yIHNvbWUgZ2VuZXJpYyBMYXllciBmdW5jdGlvbm5hbGl0eSwgbGlrZSBzYW1wbGluZyxcbiAqIHdoaWNoIHVzZXMgaW5kZXguZmlyc3QoKSBhbmQgaW5kZXgubGFzdCgpLlxuICovXG5cbmNsYXNzIEN1cnNvckluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKGN1cnNvcikge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9jYWNoZSA9IGN1cnNvci5nZXRDYWNoZSgpO1xuICAgIH1cblxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgLy8gY3Vyc29yIGluZGV4IGlzIGRlZmluZWQgZm9yIGVudGlyZSB0aW1lbGluZVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICBjZW50ZXI6IFt0aGlzLl9jYWNoZV0sXG4gICAgICAgICAgICBsZWZ0OiBbLUluZmluaXR5LCAwXSxcbiAgICAgICAgICAgIHByZXY6IFstSW5maW5pdHksIDBdLFxuICAgICAgICAgICAgcmlnaHQ6IFtJbmZpbml0eSwgMF0sXG4gICAgICAgICAgICBuZXh0OiBbSW5maW5pdHksIDBdLFxuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIFxuICogQ3Vyc29yIGNhY2hlIGltcGxlbWVudHMgdGhlIHF1ZXJ5IG9wZXJhdGlvbiBmb3IgXG4gKiB0aGUgQ3Vyc29yLCBpZ25vcmluZyB0aGUgZ2l2ZW4gb2Zmc2V0LCByZXBsYWNpbmcgaXQgXG4gKiB3aXRoIGFuIG9mZnNldCBmcm9tIHRoZSBjdHJsIGluc3RlYWQuIFxuICogVGhlIGxheWVyIGNhY2hlIGlzIHVzZWQgdG8gcmVzb2x2ZSB0aGUgcXVlcnkgXG4gKi9cblxuY2xhc3MgQ3Vyc29yQ2FjaGUge1xuICAgIGNvbnN0cnVjdG9yKGN1cnNvcikge1xuICAgICAgICB0aGlzLl9jdXJzb3IgPSBjdXJzb3I7XG4gICAgICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fY3Vyc29yLnNyYy5nZXRDYWNoZSgpO1xuICAgIH1cblxuICAgIHF1ZXJ5KCkge1xuICAgICAgICBjb25zdCBvZmZzZXQgPSB0aGlzLl9jdXJzb3IuX2dldF9jdHJsX3N0YXRlKCkudmFsdWU7IFxuICAgICAgICByZXR1cm4gdGhpcy5fY2FjaGUucXVlcnkob2Zmc2V0KTtcbiAgICB9XG5cbiAgICBjbGVhcigpIHtcbiAgICAgICAgdGhpcy5fY2FjaGUuY2xlYXIoKTtcbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ1VSU09SXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFxuICogQ3Vyc29yIGdsaWRlcyBhbG9uZyBhIGxheWVyIGFuZCBleHBvc2VzIHRoZSBjdXJyZW50IGxheWVyXG4gKiB2YWx1ZSBhdCBhbnkgdGltZVxuICogLSBoYXMgbXV0YWJsZSBjdHJsIChsb2NhbENsb2NrUHJvdmlkZXIgb3IgQ3Vyc29yKVxuICogLSBoYXMgbXV0YWJsZSBzcmMgKGxheWVyKVxuICogLSBtZXRob2RzIGZvciBhc3NpZ24sIG1vdmUsIHRyYW5zaXRpb24sIGludGVycG9sYXRpb25cbiAqL1xuXG5leHBvcnQgY2xhc3MgQ3Vyc29yIGV4dGVuZHMgTGF5ZXIge1xuXG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoe0NhY2hlQ2xhc3M6Q3Vyc29yQ2FjaGV9KTtcblxuICAgICAgICAvLyBzZXR1cCBzcmMgcHJvcGVydGllc1xuICAgICAgICBzcmNwcm9wLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuc3JjcHJvcF9yZWdpc3RlcihcInNyY1wiKTtcbiAgICAgICAgdGhpcy5zcmNwcm9wX3JlZ2lzdGVyKFwiY3RybFwiKTtcblxuICAgICAgICAvLyB0aW1lb3V0XG4gICAgICAgIHRoaXMuX3RpZDtcbiAgICAgICAgLy8gcG9sbGluZ1xuICAgICAgICB0aGlzLl9waWQ7XG5cbiAgICAgICAgLy8gaW5pdGlhbGlzZSBjdHJsLCBzcmNcbiAgICAgICAgbGV0IHtzcmMsIGN0cmx9ID0gb3B0aW9ucztcbiAgICAgICAgdGhpcy5jdHJsID0gY3RybCB8fCBsb2NhbENsb2NrUHJvdmlkZXI7XG4gICAgICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogU1JDUFJPUDogQ1RSTCBhbmQgU1JDXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBzcmNwcm9wX2NoZWNrKHByb3BOYW1lLCBvYmopIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwiY3RybFwiKSB7XG4gICAgICAgICAgICBjb25zdCBvayA9IFtDbG9ja1Byb3ZpZGVyQmFzZSwgQ3Vyc29yXVxuICAgICAgICAgICAgICAgIC5tYXAoKGNsKSA9PiBvYmogaW5zdGFuY2VvZiBjbClcbiAgICAgICAgICAgICAgICAuc29tZShlPT5lID09IHRydWUpO1xuICAgICAgICAgICAgaWYgKCFvaykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJjdHJsXCIgbXVzdCBiZSBDbG9ja1Byb3ZpZGVyIG9yIEN1cnNvciAke29ian1gKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICghKG9iaiBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIExheWVyICR7b2JqfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuXG4gICAgc3JjcHJvcF9vbmNoYW5nZShwcm9wTmFtZSwgZUFyZykge1xuICAgICAgICB0aGlzLl9faGFuZGxlX2NoYW5nZShwcm9wTmFtZSwgZUFyZyk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBDQUxMQkFDS1xuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgX19oYW5kbGVfY2hhbmdlKG9yaWdpbiwgZUFyZykge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fdGlkKTtcbiAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLl9waWQpO1xuICAgICAgICBpZiAodGhpcy5zcmMgJiYgdGhpcy5jdHJsKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleCA9PSB1bmRlZmluZWQgfHwgZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICAvLyBOT1QgdXNlZCBmb3IgY3Vyc29yIHF1ZXJ5IFxuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXggPSBuZXcgQ3Vyc29ySW5kZXgodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmNsZWFyQ2FjaGVzKCk7XG4gICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIC8vIHRyaWdnZXIgY2hhbmdlIGV2ZW50IGZvciBjdXJzb3JcbiAgICAgICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHRoaXMucXVlcnkoKSk7XG4gICAgICAgICAgICAvLyBkZXRlY3QgZnV0dXJlIGNoYW5nZSBldmVudCAtIGlmIG5lZWRlZFxuICAgICAgICAgICAgdGhpcy5fX2RldGVjdF9mdXR1cmVfY2hhbmdlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBERVRFQ1QgRlVUVVJFIENIQU5HRVxuICAgICAqIFxuICAgICAqIFBST0JMRU06XG4gICAgICogXG4gICAgICogRHVyaW5nIHBsYXliYWNrIChjdXJzb3IuY3RybCBpcyBkeW5hbWljKSwgdGhlcmUgaXMgYSBuZWVkIHRvIFxuICAgICAqIGRldGVjdCB0aGUgcGFzc2luZyBmcm9tIG9uZSBzZWdtZW50IGludGVydmFsIG9mIHNyY1xuICAgICAqIHRvIHRoZSBuZXh0IC0gaWRlYWxseSBhdCBwcmVjaXNlbHkgdGhlIGNvcnJlY3QgdGltZVxuICAgICAqIFxuICAgICAqIG5lYXJieS5pdHYgKGRlcml2ZWQgZnJvbSBjdXJzb3Iuc3JjKSBnaXZlcyB0aGUgXG4gICAgICogaW50ZXJ2YWwgKGkpIHdlIGFyZSBjdXJyZW50bHkgaW4sIGkuZS4sIFxuICAgICAqIGNvbnRhaW5pbmcgdGhlIGN1cnJlbnQgb2Zmc2V0ICh2YWx1ZSBvZiBjdXJzb3IuY3RybCksIFxuICAgICAqIGFuZCAoaWkpIHdoZXJlIG5lYXJieS5jZW50ZXIgc3RheXMgY29uc3RhbnRcbiAgICAgKiBcbiAgICAgKiBUaGUgZXZlbnQgdGhhdCBuZWVkcyB0byBiZSBkZXRlY3RlZCBpcyB0aGVyZWZvcmUgdGhlXG4gICAgICogbW9tZW50IHdoZW4gd2UgbGVhdmUgdGhpcyBpbnRlcnZhbCwgdGhyb3VnaCBlaXRoZXJcbiAgICAgKiB0aGUgbG93IG9yIGhpZ2ggaW50ZXJ2YWwgZW5kcG9pbnRcbiAgICAgKiBcbiAgICAgKiBHT0FMOlxuICAgICAqIFxuICAgICAqIEF0IHRoaXMgbW9tZW50LCB3ZSBzaW1wbHkgbmVlZCB0byByZWV2YWx1YXRlIHRoZSBzdGF0ZSAocXVlcnkpIGFuZFxuICAgICAqIGVtaXQgYSBjaGFuZ2UgZXZlbnQgdG8gbm90aWZ5IG9ic2VydmVycy4gXG4gICAgICogXG4gICAgICogQVBQUk9BQ0hFUzpcbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbMF0gXG4gICAgICogVGhlIHRyaXZpYWwgc29sdXRpb24gaXMgdG8gZG8gbm90aGluZywgaW4gd2hpY2ggY2FzZVxuICAgICAqIG9ic2VydmVycyB3aWxsIHNpbXBseSBmaW5kIG91dCB0aGVtc2VsdmVzIGFjY29yZGluZyB0byB0aGVpciBcbiAgICAgKiBvd24gcG9sbCBmcmVxdWVuY3kuIFRoaXMgaXMgc3Vib3B0aW1hbCwgcGFydGljdWxhcmx5IGZvciBsb3cgZnJlcXVlbmN5IFxuICAgICAqIG9ic2VydmVycy4gSWYgdGhlcmUgaXMgYXQgbGVhc3Qgb25lIGhpZ2gtZnJlcXVlbmN5IHBvbGxlciwgXG4gICAgICogdGhpcyB3b3VsZCB0cmlnZ2VyIHRyaWdnZXIgdGhlIHN0YXRlIGNoYW5nZSwgY2F1c2luZyBhbGxcbiAgICAgKiBvYnNlcnZlcnMgdG8gYmUgbm90aWZpZWQuIFRoZSBwcm9ibGVtIHRob3VnaCwgaXMgaWYgbm8gb2JzZXJ2ZXJzXG4gICAgICogYXJlIGFjdGl2ZWx5IHBvbGxpbmcsIGJ1dCBvbmx5IGRlcGVuZGluZyBvbiBjaGFuZ2UgZXZlbnRzLlxuICAgICAqIFxuICAgICAqIEFwcHJvYWNoIFsxXSBcbiAgICAgKiBJbiBjYXNlcyB3aGVyZSB0aGUgY3RybCBpcyBkZXRlcm1pbmlzdGljLCBhIHRpbWVvdXRcbiAgICAgKiBjYW4gYmUgY2FsY3VsYXRlZC4gVGhpcyBpcyB0cml2aWFsIGlmIGN0cmwgaXMgYSBDbG9ja0N1cnNvciwgYW5kXG4gICAgICogaXQgaXMgZmFpcmx5IGVhc3kgaWYgdGhlIGN0cmwgaXMgQ3Vyc29yIHJlcHJlc2VudGluZyBtb3Rpb25cbiAgICAgKiBvciBsaW5lYXIgdHJhbnNpdGlvbi4gSG93ZXZlciwgY2FsY3VsYXRpb25zIGNhbiBiZWNvbWUgbW9yZVxuICAgICAqIGNvbXBsZXggaWYgbW90aW9uIHN1cHBvcnRzIGFjY2VsZXJhdGlvbiwgb3IgaWYgdHJhbnNpdGlvbnNcbiAgICAgKiBhcmUgc2V0IHVwIHdpdGggbm9uLWxpbmVhciBlYXNpbmcuXG4gICAgICogICBcbiAgICAgKiBOb3RlLCBob3dldmVyLCB0aGF0IHRoZXNlIGNhbGN1bGF0aW9ucyBhc3N1bWUgdGhhdCB0aGUgY3Vyc29yLmN0cmwgaXMgXG4gICAgICogYSBDbG9ja0N1cnNvciwgb3IgdGhhdCBjdXJzb3IuY3RybC5jdHJsIGlzIGEgQ2xvY2tDdXJzb3IuIFxuICAgICAqIEluIHByaW5jaXBsZSwgdGhvdWdoLCB0aGVyZSBjb3VsZCBiZSBhIHJlY3Vyc2l2ZSBjaGFpbiBvZiBjdXJzb3JzLFxuICAgICAqIChjdXJzb3IuY3RybC5jdHJsLi4uLmN0cmwpIG9mIHNvbWUgbGVuZ3RoLCB3aGVyZSBvbmx5IHRoZSBsYXN0IGlzIGEgXG4gICAgICogQ2xvY2tDdXJzb3IuIEluIG9yZGVyIHRvIGRvIGRldGVybWluaXN0aWMgY2FsY3VsYXRpb25zIGluIHRoZSBnZW5lcmFsXG4gICAgICogY2FzZSwgYWxsIGN1cnNvcnMgaW4gdGhlIGNoYWluIHdvdWxkIGhhdmUgdG8gYmUgbGltaXRlZCB0byBcbiAgICAgKiBkZXRlcm1pbmlzdGljIGxpbmVhciB0cmFuc2Zvcm1hdGlvbnMuXG4gICAgICogXG4gICAgICogQXBwcm9jaCBbMl0gXG4gICAgICogSXQgbWlnaHQgYWxzbyBiZSBwb3NzaWJsZSB0byBzYW1wbGUgZnV0dXJlIHZhbHVlcyBvZiBcbiAgICAgKiBjdXJzb3IuY3RybCB0byBzZWUgaWYgdGhlIHZhbHVlcyB2aW9sYXRlIHRoZSBuZWFyYnkuaXR2IGF0IHNvbWUgcG9pbnQuIFxuICAgICAqIFRoaXMgd291bGQgZXNzZW50aWFsbHkgYmUgdHJlYXRpbmcgY3RybCBhcyBhIGxheWVyIGFuZCBzYW1wbGluZyBcbiAgICAgKiBmdXR1cmUgdmFsdWVzLiBUaGlzIGFwcHJvY2ggd291bGQgd29yayBmb3IgYWxsIHR5cGVzLCBcbiAgICAgKiBidXQgdGhlcmUgaXMgbm8ga25vd2luZyBob3cgZmFyIGludG8gdGhlIGZ1dHVyZSBvbmUgXG4gICAgICogd291bGQgaGF2ZSB0byBzZWVrLiBIb3dldmVyLCBhZ2FpbiAtIGFzIGluIFsxXSB0aGUgYWJpbGl0eSB0byBzYW1wbGUgZnV0dXJlIHZhbHVlc1xuICAgICAqIGlzIHByZWRpY2F0ZWQgb24gY3Vyc29yLmN0cmwgYmVpbmcgYSBDbG9ja0N1cnNvci4gQWxzbywgdGhlcmUgXG4gICAgICogaXMgbm8gd2F5IG9mIGtub3dpbmcgaG93IGxvbmcgaW50byB0aGUgZnV0dXJlIHNhbXBsaW5nIHdvdWxkIGJlIG5lY2Vzc2FyeS5cbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbM10gXG4gICAgICogSW4gdGhlIGdlbmVyYWwgY2FzZSwgdGhlIG9ubHkgd2F5IHRvIHJlbGlhYmxleSBkZXRlY3QgdGhlIGV2ZW50IGlzIHRocm91Z2ggcmVwZWF0ZWRcbiAgICAgKiBwb2xsaW5nLiBBcHByb2FjaCBbM10gaXMgc2ltcGx5IHRoZSBpZGVhIHRoYXQgdGhpcyBwb2xsaW5nIGlzIHBlcmZvcm1lZFxuICAgICAqIGludGVybmFsbHkgYnkgdGhlIGN1cnNvciBpdHNlbGYsIGFzIGEgd2F5IG9mIHNlY3VyaW5nIGl0cyBvd24gY29uc2lzdGVudFxuICAgICAqIHN0YXRlLCBhbmQgZW5zdXJpbmcgdGhhdCBvYnNlcnZlciBnZXQgY2hhbmdlIGV2ZW50cyBpbiBhIHRpbWVseSBtYW5uZXIsIGV2ZW50XG4gICAgICogaWYgdGhleSBkbyBsb3ctZnJlcXVlbmN5IHBvbGxpbmcsIG9yIGRvIG5vdCBkbyBwb2xsaW5nIGF0IGFsbC4gXG4gICAgICogXG4gICAgICogU09MVVRJT046XG4gICAgICogQXMgdGhlcmUgaXMgbm8gcGVyZmVjdCBzb2x1dGlvbiBpbiB0aGUgZ2VuZXJhbCBjYXNlLCB3ZSBvcHBvcnR1bmlzdGljYWxseVxuICAgICAqIHVzZSBhcHByb2FjaCBbMV0gd2hlbiB0aGlzIGlzIHBvc3NpYmxlLiBJZiBub3QsIHdlIGFyZSBmYWxsaW5nIGJhY2sgb24gXG4gICAgICogYXBwcm9hY2ggWzNdXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIE5PIGV2ZW50IGRldGVjdGlvbiBpcyBuZWVkZWQgKE5PT1ApXG4gICAgICogKGkpIGN1cnNvci5jdHJsIGlzIG5vdCBkeW5hbWljXG4gICAgICogb3JcbiAgICAgKiAoaWkpIG5lYXJieS5pdHYgc3RyZXRjaGVzIGludG8gaW5maW5pdHkgaW4gYm90aCBkaXJlY3Rpb25zXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIGFwcHJvYWNoIFsxXSBjYW4gYmUgdXNlZFxuICAgICAqIFxuICAgICAqIChpKSBpZiBjdHJsIGlzIGEgQ2xvY2tDdXJzb3IgJiYgbmVhcmJ5Lml0di5oaWdoIDwgSW5maW5pdHlcbiAgICAgKiBvclxuICAgICAqIChpaSkgY3RybC5jdHJsIGlzIGEgQ2xvY2tDdXJzb3JcbiAgICAgKiAgICAgIChhKSBjdHJsLm5lYXJieS5jZW50ZXIgaGFzIGV4YWN0bHkgMSBpdGVtXG4gICAgICogICAgICAmJlxuICAgICAqICAgICAgKGIpIGN0cmwubmVhcmJ5LmNlbnRlclswXS50eXBlID09IChcIm1vdGlvblwiKSB8fCAoXCJ0cmFuc2l0aW9uXCIgJiYgZWFzaW5nPT1cImxpbmVhclwiKVxuICAgICAqICAgICAgJiZcbiAgICAgKiAgICAgIChjKSBjdHJsLm5lYXJieS5jZW50ZXJbMF0uZGF0YS52ZWxvY2l0eSAhPSAwLjBcbiAgICAgKiAgICAgICYmIFxuICAgICAqICAgICAgKGQpIGZ1dHVyZSBpbnRlcnNlY3RvbiBwb2ludCB3aXRoIGNhY2hlLm5lYXJieS5pdHYgXG4gICAgICogICAgICAgICAgaXMgbm90IC1JbmZpbml0eSBvciBJbmZpbml0eVxuICAgICAqIFxuICAgICAqIFRob3VnaCBpdCBzZWVtcyBjb21wbGV4LCBjb25kaXRpb25zIGZvciBbMV0gc2hvdWxkIGJlIG1ldCBmb3IgY29tbW9uIGNhc2VzIGludm9sdmluZ1xuICAgICAqIHBsYXliYWNrLiBBbHNvLCB1c2Ugb2YgdHJhbnNpdGlvbiBldGMgbWlnaHQgYmUgcmFyZS5cbiAgICAgKiBcbiAgICAgKi9cblxuICAgIF9fZGV0ZWN0X2Z1dHVyZV9jaGFuZ2UoKSB7XG5cbiAgICAgICAgLy8gY3RybCBcbiAgICAgICAgY29uc3QgY3RybF92ZWN0b3IgPSB0aGlzLl9nZXRfY3RybF9zdGF0ZSgpO1xuICAgICAgICBjb25zdCB7dmFsdWU6Y3VycmVudF9wb3MsIG9mZnNldDpjdXJyZW50X3RzfSA9IGN0cmxfdmVjdG9yO1xuXG4gICAgICAgIC8vIGN0cmwgbXVzdCBiZSBkeW5hbWljXG4gICAgICAgIGlmICghY3RybF92ZWN0b3IuZHluYW1pYykge1xuICAgICAgICAgICAgLy8gbm8gZnV0dXJlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2V0IG5lYXJieSBmcm9tIHNyYyAtIHVzZSB2YWx1ZSBmcm9tIGN0cmxcbiAgICAgICAgY29uc3Qgc3JjX25lYXJieSA9IHRoaXMuc3JjLmluZGV4Lm5lYXJieShjdXJyZW50X3Bvcyk7XG4gICAgICAgIGNvbnN0IFtsb3csIGhpZ2hdID0gc3JjX25lYXJieS5pdHYuc2xpY2UoMCwyKTtcblxuICAgICAgICAvLyBhcHByb2FjaCBbMV1cbiAgICAgICAgaWYgKHRoaXMuY3RybCBpbnN0YW5jZW9mIENsb2NrUHJvdmlkZXJCYXNlKSB7XG4gICAgICAgICAgICBpZiAoaXNGaW5pdGUoaGlnaCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9fc2V0X3RpbWVvdXQoaGlnaCwgY3VycmVudF9wb3MsIDEuMCwgY3VycmVudF90cyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbm8gZnV0dXJlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IFxuICAgICAgICBpZiAodGhpcy5jdHJsLmN0cmwgaW5zdGFuY2VvZiBDbG9ja1Byb3ZpZGVyQmFzZSkge1xuICAgICAgICAgICAgLyoqIFxuICAgICAgICAgICAgICogdGhpcy5jdHJsIFxuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAgKiBoYXMgbWFueSBwb3NzaWJsZSBiZWhhdmlvcnNcbiAgICAgICAgICAgICAqIHRoaXMuY3RybCBoYXMgYW4gaW5kZXggdXNlIHRoaXMgdG8gZmlndXJlIG91dCB3aGljaFxuICAgICAgICAgICAgICogYmVoYXZpb3VyIGlzIGN1cnJlbnQuXG4gICAgICAgICAgICAgKiBcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICAvLyB1c2UgdGhlIHNhbWUgb2Zmc2V0IHRoYXQgd2FzIHVzZWQgaW4gdGhlIGN0cmwucXVlcnlcbiAgICAgICAgICAgIGNvbnN0IGN0cmxfbmVhcmJ5ID0gdGhpcy5jdHJsLmluZGV4Lm5lYXJieShjdXJyZW50X3RzKTtcblxuICAgICAgICAgICAgaWYgKCFpc0Zpbml0ZShsb3cpICYmICFpc0Zpbml0ZShoaWdoKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vIGZ1dHVyZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY3RybF9uZWFyYnkuY2VudGVyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY3RybF9pdGVtID0gY3RybF9uZWFyYnkuY2VudGVyWzBdO1xuICAgICAgICAgICAgICAgIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHt2ZWxvY2l0eSwgYWNjZWxlcmF0aW9uPTAuMH0gPSBjdHJsX2l0ZW0uZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjY2VsZXJhdGlvbiA9PSAwLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdGFyZ2V0X3BvcyA9ICh2ZWxvY2l0eSA+IDApID8gaGlnaCA6IGxvdztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0Zpbml0ZSh0YXJnZXRfcG9zKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjsgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBubyBmdXR1cmUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gYWNjZWxlcmF0aW9uIC0gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7djA6cDAsIHYxOnAxLCB0MCwgdDEsIGVhc2luZz1cImxpbmVhclwifSA9IGN0cmxfaXRlbS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZWFzaW5nID09IFwibGluZWFyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2ZWxvY2l0eSA9IChwMS1wMCkvKHQxLXQwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRfcG9zID0gKHZlbG9jaXR5ID4gMCkgPyBNYXRoLm1pbihoaWdoLCBwMSkgOiBNYXRoLm1heChsb3csIHAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBvdGhlciBlYXNpbmcgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gb3RoZXIgdHlwZSAoaW50ZXJwb2xhdGlvbikgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIG1vcmUgdGhhbiBvbmUgc2VnbWVudCAtIHBvc3NpYmxlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0IC0gYXBwcm9hY2ggWzNdXG4gICAgICAgIHRoaXMuX19zZXRfcG9sbGluZyhzcmNfbmVhcmJ5Lml0dik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc2V0IHRpbWVvdXRcbiAgICAgKiAtIHByb3RlY3RzIGFnYWluc3QgdG9vIGVhcmx5IGNhbGxiYWNrcyBieSByZXNjaGVkdWxpbmdcbiAgICAgKiB0aW1lb3V0IGlmIG5lY2Nlc3NhcnkuXG4gICAgICogLSBhZGRzIGEgbWlsbGlzZWNvbmQgdG8gb3JpZ2luYWwgdGltZW91dCB0byBhdm9pZFxuICAgICAqIGZyZXF1ZW50IHJlc2NoZWR1bGluZyBcbiAgICAgKi9cblxuICAgIF9fc2V0X3RpbWVvdXQodGFyZ2V0X3BvcywgY3VycmVudF9wb3MsIHZlbG9jaXR5LCBjdXJyZW50X3RzKSB7XG4gICAgICAgIGNvbnN0IGRlbHRhX3NlYyA9ICh0YXJnZXRfcG9zIC0gY3VycmVudF9wb3MpIC8gdmVsb2NpdHk7XG4gICAgICAgIGNvbnN0IHRhcmdldF90cyA9IGN1cnJlbnRfdHMgKyBkZWx0YV9zZWM7XG4gICAgICAgIHRoaXMuX3RpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV90aW1lb3V0KHRhcmdldF90cyk7XG4gICAgICAgIH0sIGRlbHRhX3NlYyoxMDAwICsgMSk7XG4gICAgfVxuXG4gICAgX19oYW5kbGVfdGltZW91dCh0YXJnZXRfdHMpIHtcbiAgICAgICAgY29uc3QgdHMgPSB0aGlzLl9nZXRfY3RybF9zdGF0ZSgpLm9mZnNldDtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nX3NlYyA9IHRhcmdldF90cyAtIHRzOyBcbiAgICAgICAgaWYgKHJlbWFpbmluZ19zZWMgPD0gMCkge1xuICAgICAgICAgICAgLy8gZG9uZVxuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV9jaGFuZ2UoXCJ0aW1lb3V0XCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcmVzY2hlZHVsZSB0aW1lb3V0XG4gICAgICAgICAgICB0aGlzLl90aWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9faGFuZGxlX3RpbWVvdXQodGFyZ2V0X3RzKVxuICAgICAgICAgICAgfSwgcmVtYWluaW5nX3NlYyoxMDAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNldCBwb2xsaW5nXG4gICAgICovXG5cbiAgICBfX3NldF9wb2xsaW5nKGl0dikge1xuICAgICAgICB0aGlzLl9waWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9faGFuZGxlX3BvbGwoaXR2KTtcbiAgICAgICAgfSwgMTAwKTtcbiAgICB9XG5cbiAgICBfX2hhbmRsZV9wb2xsKGl0dikge1xuICAgICAgICBsZXQgb2Zmc2V0ID0gdGhpcy5xdWVyeSgpLnZhbHVlO1xuICAgICAgICBpZiAoIWludGVydmFsLmNvdmVyc19wb2ludChpdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgIHRoaXMuX19oYW5kbGVfY2hhbmdlKFwidGltZW91dFwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfZ2V0X2N0cmxfc3RhdGUgKCkge1xuICAgICAgICBpZiAodGhpcy5jdHJsIGluc3RhbmNlb2YgQ2xvY2tQcm92aWRlckJhc2UpIHtcbiAgICAgICAgICAgIGxldCB0cyA9IHRoaXMuY3RybC5ub3coKTtcbiAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dHMsIGR5bmFtaWM6dHJ1ZSwgb2Zmc2V0OnRzfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBzdGF0ZSA9IHRoaXMuY3RybC5xdWVyeSgpO1xuICAgICAgICAgICAgLy8gcHJvdGVjdCBhZ2FpbnN0IG5vbi1mbG9hdCB2YWx1ZXNcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc3RhdGUudmFsdWUgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdHJsIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7c3RhdGUudmFsdWV9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdmFsdWUgKCkge3JldHVybiB0aGlzLnF1ZXJ5KCkudmFsdWV9O1xuICAgIFxuICAgIC8qXG4gICAgICAgIEV2ZW50aWZ5OiBpbW1lZGlhdGUgZXZlbnRzXG4gICAgKi9cbiAgICBldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuICAgICAgICBpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG4gICAgICAgICAgICByZXR1cm4gW3RoaXMucXVlcnkoKV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBCSU5EIFJFTEVBU0UgKGNvbnZlbmllbmNlKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgYmluZChjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICAgICAgcmV0dXJuIGJpbmQodGhpcywgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zKTtcbiAgICB9XG4gICAgcmVsZWFzZShoYW5kbGUpIHtcbiAgICAgICAgcmV0dXJuIHJlbGVhc2UoaGFuZGxlKTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFVQREFURSBBUElcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGFzc2lnbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gY21kKHRoaXMuc3JjLnNyYykuYXNzaWduKHZhbHVlKTtcbiAgICB9XG4gICAgbW92ZSAoe3Bvc2l0aW9uLCB2ZWxvY2l0eX0pIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgb2Zmc2V0OnRpbWVzdGFtcH0gPSB0aGlzLnF1ZXJ5KCk7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhcm5pbmc6IGN1cnNvciBzdGF0ZSBtdXN0IGJlIG51bWJlciAke3ZhbHVlfWApO1xuICAgICAgICB9XG4gICAgICAgIHBvc2l0aW9uID0gKHBvc2l0aW9uICE9IHVuZGVmaW5lZCkgPyBwb3NpdGlvbiA6IHZhbHVlO1xuICAgICAgICB2ZWxvY2l0eSA9ICh2ZWxvY2l0eSAhPSB1bmRlZmluZWQpID8gdmVsb2NpdHk6IDA7XG4gICAgICAgIHJldHVybiBjbWQodGhpcy5zcmMuc3JjKS5tb3ZlKHtwb3NpdGlvbiwgdmVsb2NpdHksIHRpbWVzdGFtcH0pO1xuICAgIH1cbiAgICB0cmFuc2l0aW9uICh7dGFyZ2V0LCBkdXJhdGlvbiwgZWFzaW5nfSkge1xuICAgICAgICBsZXQge3ZhbHVlOnYwLCBvZmZzZXQ6dDB9ID0gdGhpcy5xdWVyeSgpO1xuICAgICAgICBpZiAodHlwZW9mIHYwICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3Igc3RhdGUgbXVzdCBiZSBudW1iZXIgJHt2MH1gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY21kKHRoaXMuc3JjLnNyYykudHJhbnNpdGlvbih2MCwgdGFyZ2V0LCB0MCwgdDAgKyBkdXJhdGlvbiwgZWFzaW5nKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUgKHt0dXBsZXMsIGR1cmF0aW9ufSkge1xuICAgICAgICBsZXQgdDAgPSB0aGlzLnF1ZXJ5KCkub2Zmc2V0O1xuICAgICAgICAvLyBhc3N1bWluZyB0aW1zdGFtcHMgYXJlIGluIHJhbmdlIFswLDFdXG4gICAgICAgIC8vIHNjYWxlIHRpbWVzdGFtcHMgdG8gZHVyYXRpb25cbiAgICAgICAgdHVwbGVzID0gdHVwbGVzLm1hcCgoW3YsdF0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbdiwgdDAgKyB0KmR1cmF0aW9uXTtcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzLnNyYy5zcmMpLmludGVycG9sYXRlKHR1cGxlcyk7XG4gICAgfVxuXG59XG5zcmNwcm9wLmFkZFRvUHJvdG90eXBlKEN1cnNvci5wcm90b3R5cGUpO1xuc3JjcHJvcC5hZGRUb1Byb3RvdHlwZShDdXJzb3IucHJvdG90eXBlKTtcblxuIiwiaW1wb3J0IHsgaW50ZXJ2YWwsIGVuZHBvaW50fSBmcm9tIFwiLi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi4vbmVhcmJ5aW5kZXguanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVycy5qc1wiXG5cbmV4cG9ydCBjbGFzcyBCb29sZWFuTGF5ZXIgZXh0ZW5kcyBMYXllciB7XG5cbiAgICBjb25zdHJ1Y3RvcihsYXllcikge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmluZGV4ID0gbmV3IEJvb2xlYW5JbmRleChsYXllci5pbmRleCk7XG4gICAgXG4gICAgICAgIC8vIHN1YnNjcmliZVxuICAgICAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5fb25jaGFuZ2UuYmluZCh0aGlzKTtcbiAgICAgICAgbGF5ZXIuYWRkX2NhbGxiYWNrKGhhbmRsZXIpO1xuICAgIH1cblxuICAgIF9vbmNoYW5nZShlQXJnKSB7XG4gICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIpO1xuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJvb2xlYW4obGF5ZXIpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xlYW5MYXllcihsYXllcik7XG59IFxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBCT09MRUFOIE5FQVJCWSBJTkRFWFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFdyYXBwZXIgSW5kZXggd2hlcmUgcmVnaW9ucyBhcmUgdHJ1ZS9mYWxzZSwgYmFzZWQgb24gXG4gKiBjb25kaXRpb24gb24gbmVhcmJ5LmNlbnRlci5cbiAqIEJhY2stdG8tYmFjayByZWdpb25zIHdoaWNoIGFyZSB0cnVlIGFyZSBjb2xsYXBzZWQgXG4gKiBpbnRvIG9uZSByZWdpb25cbiAqIFxuICovXG5cbmZ1bmN0aW9uIHF1ZXJ5T2JqZWN0ICh2YWx1ZSkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHF1ZXJ5OiBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgICAgICAgICByZXR1cm4ge3ZhbHVlLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm9vbGVhbkluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKGluZGV4LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gICAgICAgIGxldCB7Y29uZGl0aW9uID0gKGNlbnRlcikgPT4gY2VudGVyLmxlbmd0aCA+IDB9ID0gb3B0aW9ucztcbiAgICAgICAgdGhpcy5fY29uZGl0aW9uID0gY29uZGl0aW9uO1xuICAgIH1cblxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgb2Zmc2V0ID0gdGhpcy5jaGVjayhvZmZzZXQpO1xuICAgICAgICBjb25zdCBuZWFyYnkgPSB0aGlzLl9pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgXG4gICAgICAgIGxldCBldmFsdWF0aW9uID0gdGhpcy5fY29uZGl0aW9uKG5lYXJieS5jZW50ZXIpOyBcbiAgICAgICAgLyogXG4gICAgICAgICAgICBzZWVrIGxlZnQgYW5kIHJpZ2h0IGZvciBmaXJzdCByZWdpb25cbiAgICAgICAgICAgIHdoaWNoIGRvZXMgbm90IGhhdmUgdGhlIHNhbWUgZXZhbHVhdGlvbiBcbiAgICAgICAgKi9cbiAgICAgICAgY29uc3QgY29uZGl0aW9uID0gKGNlbnRlcikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2NvbmRpdGlvbihjZW50ZXIpICE9IGV2YWx1YXRpb247XG4gICAgICAgIH1cblxuICAgICAgICAvLyBleHBhbmQgcmlnaHRcbiAgICAgICAgbGV0IHJpZ2h0O1xuICAgICAgICBsZXQgcmlnaHRfbmVhcmJ5ID0gdGhpcy5faW5kZXguZmluZF9yZWdpb24obmVhcmJ5LCB7XG4gICAgICAgICAgICBkaXJlY3Rpb246MSwgY29uZGl0aW9uXG4gICAgICAgIH0pOyAgICAgICAgXG4gICAgICAgIGlmIChyaWdodF9uZWFyYnkgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByaWdodCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwocmlnaHRfbmVhcmJ5Lml0dilbMF07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBleHBhbmQgbGVmdFxuICAgICAgICBsZXQgbGVmdDtcbiAgICAgICAgbGV0IGxlZnRfbmVhcmJ5ID0gdGhpcy5faW5kZXguZmluZF9yZWdpb24obmVhcmJ5LCB7XG4gICAgICAgICAgICBkaXJlY3Rpb246LTEsIGNvbmRpdGlvblxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGxlZnRfbmVhcmJ5ICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGVmdCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobGVmdF9uZWFyYnkuaXR2KVsxXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGV4cGFuZCB0byBpbmZpbml0eVxuICAgICAgICBsZWZ0ID0gbGVmdCB8fCBbLUluZmluaXR5LCAwXTtcbiAgICAgICAgcmlnaHQgPSByaWdodCB8fCBbSW5maW5pdHksIDBdO1xuICAgICAgICBjb25zdCBsb3cgPSBlbmRwb2ludC5mbGlwKGxlZnQsIFwibG93XCIpO1xuICAgICAgICBjb25zdCBoaWdoID0gZW5kcG9pbnQuZmxpcChyaWdodCwgXCJoaWdoXCIpXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpdHY6IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCksXG4gICAgICAgICAgICBjZW50ZXIgOiBbcXVlcnlPYmplY3QoZXZhbHVhdGlvbildLFxuICAgICAgICAgICAgbGVmdCxcbiAgICAgICAgICAgIHJpZ2h0LFxuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgTWVyZ2VJbmRleCB9IGZyb20gXCIuL21lcmdlLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcnMuanNcIjtcbmltcG9ydCB7IEJvb2xlYW5JbmRleCB9IGZyb20gXCIuL2Jvb2xlYW4uanNcIjtcblxuXG5jbGFzcyBMb2dpY2FsTWVyZ2VMYXllciBleHRlbmRzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKHNvdXJjZXMsIG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcblxuXG4gICAgICAgIGNvbnN0IHIgPSBsb2dpY2FsX2V4cHI7XG4gICAgICAgIGNvbnN0IHtleHByfSA9IG9wdGlvbnM7XG5cbiAgICAgICAgbGV0IGNvbmRpdGlvbjtcbiAgICAgICAgaWYgKGV4cHIpIHtcbiAgICAgICAgICAgIGNvbmRpdGlvbiA9IChjZW50ZXIpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhwci5ldmFsKGNlbnRlcik7XG4gICAgICAgICAgICB9ICAgIFxuICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAvLyBzdWJzY3JpYmUgdG8gY2FsbGJhY2tzIGZyb20gc291cmNlc1xuICAgICAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5fb25jaGFuZ2UuYmluZCh0aGlzKTtcbiAgICAgICAgZm9yIChsZXQgc3JjIG9mIHNvdXJjZXMpIHtcbiAgICAgICAgICAgIHNyYy5hZGRfY2FsbGJhY2soaGFuZGxlcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBsZXQgaW5kZXggPSBuZXcgTWVyZ2VJbmRleChzb3VyY2VzKTtcbiAgICAgICAgdGhpcy5faW5kZXggPSBuZXcgQm9vbGVhbkluZGV4KGluZGV4LCB7Y29uZGl0aW9ufSk7XG4gICAgfVxuXG4gICAgZ2V0IGluZGV4ICgpIHtyZXR1cm4gdGhpcy5faW5kZXh9O1xuXG5cbiAgICBfb25jaGFuZ2UoZUFyZykge1xuICAgICAgICB0aGlzLmNsZWFyQ2FjaGVzKCk7XG4gICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiKTtcbiAgICB9XG5cbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gbG9naWNhbF9tZXJnZShzb3VyY2VzLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyBMb2dpY2FsTWVyZ2VMYXllcihzb3VyY2VzLCBvcHRpb25zKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gbG9naWNhbF9leHByIChzcmMpIHtcbiAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBMYXllcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBtdXN0IGJlIGxheWVyICR7c3JjfWApXG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGNhY2hlIG9mIGNlbnRlcikge1xuICAgICAgICAgICAgICAgIGlmIChjYWNoZS5zcmMgPT0gc3JjKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxubG9naWNhbF9leHByLmFuZCA9IGZ1bmN0aW9uIGFuZCguLi5leHBycykge1xuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBleHBycy5ldmVyeSgoZXhwcikgPT4gZXhwci5ldmFsKGNlbnRlcikpO1xuICAgICAgICB9ICAgIFxuICAgIH1cbn1cblxubG9naWNhbF9leHByLm9yID0gZnVuY3Rpb24gb3IoLi4uZXhwcnMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBldmFsOiBmdW5jdGlvbiAoY2VudGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwcnMuc29tZSgoZXhwcikgPT4gZXhwci5ldmFsKGNlbnRlcikpO1xuICAgICAgICB9ICAgIFxuICAgIH1cbn1cblxubG9naWNhbF9leHByLnhvciA9IGZ1bmN0aW9uIHhvcihleHByMSwgZXhwcjIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBldmFsOiBmdW5jdGlvbiAoY2VudGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwcjEuZXZhbChjZW50ZXIpICE9IGV4cHIyLmV2YWwoY2VudGVyKTtcbiAgICAgICAgfSAgICBcbiAgICB9XG59XG5cbmxvZ2ljYWxfZXhwci5ub3QgPSBmdW5jdGlvbiBub3QoZXhwcikge1xuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiAhZXhwci5ldmFsKGNlbnRlcik7XG4gICAgICAgIH0gICAgXG4gICAgfVxufVxuXG5cblxuXG4iLCJpbXBvcnQgeyBMb2NhbFN0YXRlUHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX3NpbXBsZS5qc1wiO1xuaW1wb3J0IHsgbWVyZ2UgfSBmcm9tIFwiLi9vcHMvbWVyZ2UuanNcIlxuaW1wb3J0IHsgc2hpZnQgfSBmcm9tIFwiLi9vcHMvc2hpZnQuanNcIjtcbmltcG9ydCB7IElucHV0TGF5ZXIsIExheWVyIH0gZnJvbSBcIi4vbGF5ZXJzLmpzXCI7XG5pbXBvcnQgeyBDdXJzb3IgfSBmcm9tIFwiLi9jdXJzb3JzLmpzXCI7XG5pbXBvcnQgeyBib29sZWFuIH0gZnJvbSBcIi4vb3BzL2Jvb2xlYW4uanNcIlxuaW1wb3J0IHsgY21kIH0gZnJvbSBcIi4vY21kLmpzXCI7XG5pbXBvcnQgeyBsb2dpY2FsX21lcmdlLCBsb2dpY2FsX2V4cHJ9IGZyb20gXCIuL29wcy9sb2dpY2FsX21lcmdlLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUiBGQUNUT1JZXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmZ1bmN0aW9uIGxheWVyKG9wdGlvbnM9e30pIHtcbiAgICBsZXQge3NyYywgaXRlbXM9W10sIHZhbHVlLCAuLi5vcHRzfSA9IG9wdGlvbnM7XG4gICAgaWYgKHNyYyBpbnN0YW5jZW9mIExheWVyKSB7XG4gICAgICAgIHJldHVybiBzcmM7XG4gICAgfSBcbiAgICBpZiAoc3JjID09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAodmFsdWUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpdGVtcyA9IFt7XG4gICAgICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eV0sXG4gICAgICAgICAgICAgICAgZGF0YTogdmFsdWVcbiAgICAgICAgICAgIH1dO1xuICAgICAgICB9IFxuICAgICAgICBzcmMgPSBuZXcgTG9jYWxTdGF0ZVByb3ZpZGVyKHtpdGVtc30pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IElucHV0TGF5ZXIoe3NyYywgLi4ub3B0c30pOyBcbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIENVUlNPUiBGQUNUT1JJRVNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gY3Vyc29yKG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7Y3RybCwgLi4ub3B0c30gPSBvcHRpb25zO1xuICAgIGNvbnN0IHNyYyA9IGxheWVyKG9wdHMpOyAgICBcbiAgICByZXR1cm4gbmV3IEN1cnNvcih7Y3RybCwgc3JjfSk7XG59XG5cbmV4cG9ydCB7IGxheWVyLCBjdXJzb3IsIG1lcmdlLCBzaGlmdCwgY21kLCBjdXJzb3IgYXMgdmFyaWFibGUsIGN1cnNvciBhcyBwbGF5YmFjaywgYm9vbGVhbiwgbG9naWNhbF9tZXJnZSwgbG9naWNhbF9leHByfSJdLCJuYW1lcyI6WyJQUkVGSVgiLCJhZGRUb0luc3RhbmNlIiwiYWRkVG9Qcm90b3R5cGUiLCJjYWxsYmFjay5hZGRUb0luc3RhbmNlIiwiY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUiLCJpbnRlcnBvbGF0ZSIsImV2ZW50aWZ5LmFkZFRvSW5zdGFuY2UiLCJldmVudGlmeS5hZGRUb1Byb3RvdHlwZSIsInNyY3Byb3AuYWRkVG9JbnN0YW5jZSIsInNyY3Byb3AuYWRkVG9Qcm90b3R5cGUiLCJzZWdtZW50LlN0YXRpY1NlZ21lbnQiLCJzZWdtZW50LlRyYW5zaXRpb25TZWdtZW50Iiwic2VnbWVudC5JbnRlcnBvbGF0aW9uU2VnbWVudCIsInNlZ21lbnQuTW90aW9uU2VnbWVudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7SUFBQTtJQUNBO0lBQ0E7O0lBRUEsTUFBTUEsUUFBTSxHQUFHLFlBQVk7O0lBRXBCLFNBQVNDLGVBQWEsQ0FBQyxNQUFNLEVBQUU7SUFDdEMsSUFBSSxNQUFNLENBQUMsQ0FBQyxFQUFFRCxRQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxFQUFFO0lBQ3JDOztJQUVBLFNBQVMsWUFBWSxFQUFFLE9BQU8sRUFBRTtJQUNoQyxJQUFJLElBQUksTUFBTSxHQUFHO0lBQ2pCLFFBQVEsT0FBTyxFQUFFO0lBQ2pCO0lBQ0EsSUFBSSxJQUFJLENBQUMs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QSxZQUFZLElBQUksV0FBVyxJQUFJLFNBQVMsRUFBRTtJQUMxQyxnQkFBZ0IsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMxRTtJQUNBLFlBQVksSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7SUFDMUMsZ0JBQWdCLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDdkQsZ0JBQWdCLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDO0lBQ3BFLGdCQUFnQixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQzNDLGdCQUFnQixlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzFDO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsUUFBUSxTQUFTLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQztJQUNyQyxRQUFRLE1BQU0sWUFBWSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7O0lBRTFEO0lBQ0EsUUFBUSxTQUFTLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQztJQUN0QyxRQUFRLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQzs7SUFFNUQ7SUFDQSxRQUFRLElBQUksR0FBRyxFQUFFLElBQUksQ0FBQztJQUN0QixRQUFRLE1BQU0sTUFBTSxHQUFHO0lBQ3ZCLFlBQVksTUFBTSxFQUFFLFdBQVc7SUFDL0I7O0lBRUEsUUFBUSxJQUFJLFdBQVcsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFOztJQUVyQztJQUNBLFlBQVksTUFBTSxDQUFDLEtBQUssR0FBRyxZQUFZLENB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
