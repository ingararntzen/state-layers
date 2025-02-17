
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
        - {id, itv, type, data}
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
        update(changes){}

        /**
         * return array with all items in collection 
         * - no requirement wrt order
         */
        get_items() {
            throw new Error("not implemented");
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


    function random_string(length) {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        for(var i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    function check_item(item) {
        item.itv = interval.from_input(item.itv);
        item.id = item.id || random_string(10);
        return item;
    }

    /***************************************************************
        LOCAL STATE PROVIDER
    ***************************************************************/

    /**
     * local state provider
     * collection of items
     * 
     * changes = {
     *   items=[],
     *   remove=[],
     *   clear=false 
     * }
     * 
    */

    class LocalStateProvider extends StateProviderBase {

        constructor(options={}) {
            super();
            this._map = new Map();
            this._initialise(options);
        }

        /**
         * Local StateProviders support initialisation with
         * by giving items or a value. 
         */
        _initialise(options={}) {
            // initialization with items or single value 
            let {items, value} = options;
            if (value != undefined) {
                // initialize from value
                items = [{
                    itv: [-Infinity, Infinity, true, true], 
                    type: "static",
                    data: value
                }];
            }
            if (items != undefined) {
                this._update({items});
            }
        }

        /**
         * Local StateProviders decouple update request from
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
            const diffs = [];
            let {
                items=[],
                remove=[],
                clear=true
            } = changes;
            if (clear) {
                // clear all items
                this._map = new Map();
            } else {
                // remove items by id
                for (const id of remove) {
                    let item = this._map.get(id);
                    if (item != undefined) {
                        diffs.push({id:item.id, old:item});
                        this._map.delete(id);
                    }
                }
            }
            // insert items
            for (let item of items) {
                item = check_item(item);
                let old = this._map.get(item.id);
                if (old != undefined) {
                    diffs.push({id:item.id, new:item, old});
                } else {
                    diffs.push({id:item.id, new:item});
                }
                this._map.set(item.id, item);
            }
            return diffs;
        }

        get_items() {
            return [...this._map.values()];
        };
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

    const pfi = endpoint.from_interval;

    function make_set_cache () {
    	return new Map([
    		[-1, new Set()], 
    		[0, new Set()], 
    		[1, new Set()]
    	]);
    }



    class NearbyIndex extends NearbyIndexBase {

        constructor(stateProvider) {
            super();

            if (!(stateProvider instanceof StateProviderBase)) {
                throw new Error(`must be stateprovider ${stateProvider}`);
            }
            this._sp = stateProvider;
    		this.refresh({items:this._sp.get_items(), clear:true});
        }

        _initialise() {
            // sorted arrays of endpoints
    		this._low_points = new SortedArray();
    		this._high_points = new SortedArray();
    		/* 
    			items by endpoint
    			[value, sign] = endpoint
    			items.get(sign).get(value) == [item, ..]
    			each item will typically appear twice, at two different
    			endpoints.
    		*/
    		this._itemsmap = new Map([
    			[-1, new Map()], 
    			[0, new Map()], 
    			[1, new Map()]
    		]);
        }

        get src () {return this._sp;}

        /*
    		nearby (offset)
        */
        nearby(offset) { 
            offset = endpoint.from_input(offset);
            const center = this._covers(offset);
            const prev_high = this._high_points.lt(offset) || [-Infinity, 0];
            const next_low = this._low_points.gt(offset) || [Infinity, 0];
            const center_low_list = [];
            const center_high_list = [];
            for (const item of center) {
                const [low, high] = endpoint.from_interval(item.itv);
                center_high_list.push(high);
                center_low_list.push(low);    
            }
            return nearby_from(
                prev_high, 
                center_low_list, 
                center,
                center_high_list,
                next_low
            );
        }

        /*
    		refresh index based on changes
        */
    	refresh (changes) {
    		const low_clear_cache = make_set_cache();
    		const high_clear_cache = make_set_cache();
    		const low_create_cache = make_set_cache();
    		const high_create_cache = make_set_cache();

            const {items=[], remove=[], clear=false} = changes;

            if (clear) {
                this._initialise();
            } else {
                for (const item of remove) {
                    let [low, high] = pfi(item.itv);
                    this._remove(low, item, low_clear_cache);
                    this._remove(high, item, high_clear_cache);
                }    
            }

            for (const item of items) {
                let [low, high] = pfi(item.itv);
                this._insert(low, item, low_create_cache);
                this._insert(high, item, high_create_cache);	
            }

    		/*
    			flush changes to sorted arrays
    			
    			Ensure that low_points and high_points indexes 
    			match exactly with endpoints mapped to items in _itemsmap.
    			
    			This could be solved by rebuilding indexes from
    			itemsmap. However, in the event that the indexes are large and 
    			changes are small, we can optimise, based on caches

    		*/
    		const low_clear = [];
    		const high_clear = [];
    		const low_create = [];
    		const high_create = [];

    		for (let sign of [-1, 0, 1]) {

    			// clear
    			const clear_tasks = [
    				[low_clear, low_clear_cache], 
    				[high_clear, high_clear_cache]
    			];
    			for (const [array, cache] of clear_tasks) {
    				for (const value of cache.get(sign).values()) {
    					// verify that itemsmap is indeed empty
    					if (!this._itemsmap.get(sign).has(value)) {
    						array.push([value, sign]);
    					}
    				}	
    			}

    			// create			
    			const create_tasks = [
    				[low_create, low_create_cache], 
    				[high_create, high_create_cache]
    			];
    			for (const [array, cache] of create_tasks) {
    				for (const value of cache.get(sign).values()) {
    					// verify that itemsmap is indeed non-empty
    					if (this._itemsmap.get(sign).has(value)) {
    						array.push([value, sign]);
    					}
    				}
    			}		
    		}
    		
    		// update indexes
            this._low_points.update(low_clear, low_create);
    		this._high_points.update(high_clear, high_create);
    	}

    	/*
    		remove item for endpoint
    		- if last item to be removed - add to cleared endpoints
    	*/
        _remove(endpoint, item, cleared_endpoints) {
        	const [value, sign] = endpoint;
        	const map = this._itemsmap.get(sign);
        	const items = map.get(value);    	
    		cleared_endpoints.get(sign).add(value);
            if (items != undefined) {
            	// remove item
            	let idx = items.findIndex((_item) => {
            		return _item.id == item.id;
            	});
            	if (idx > -1) {
            		items.splice(idx, 1);
            	}
            }
        };

        /*
    		insert item for endpoint
    		- if first item to be inserted - add to created endpoints
        */
    	_insert(endpoint, item, created_endpoints) {
        	const [value, sign] = endpoint;
        	const map = this._itemsmap.get(sign);
          	const items = map.get(value);
            created_endpoints.get(sign).add(value);
            if (items == undefined) {
                map.set(value, [item]);
            } else {
                items.push(item);
            }
        }

        /*
    		covers : return all items which cover offset

    		search from offset to the left - use low_points index
    		TODO - make more efficient by limiting search
        */
        _covers(offset) {
            // check all items with low to the left of offset
        	const checked_ids = new Set();
            const items = [];
            for (const [value, sign] of this._low_points.array) {
                if (endpoint.gt([value, sign], offset)) {
                    break;
                }
                for (const item of this._itemsmap.get(sign).get(value)) {
                    if (checked_ids.has(item.id)) {
                        continue;
                    }
                    // check item
                    if (interval.covers_endpoint(item.itv, offset)) {
                        items.push(item);
                    }
                    checked_ids.add(item.id);
                }
            } 
            return items;
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
                if (!(src instanceof StateProviderBase)) {
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
                        return target.update({items, clear:true});  
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

    exports.StateProviderBase = StateProviderBase;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hcGlfY2FsbGJhY2suanMiLCIuLi8uLi9zcmMvc3RhdGVwcm92aWRlcl9iYXNlLmpzIiwiLi4vLi4vc3JjL2ludGVydmFscy5qcyIsIi4uLy4uL3NyYy91dGlsLmpzIiwiLi4vLi4vc3JjL3N0YXRlcHJvdmlkZXIuanMiLCIuLi8uLi9zcmMvbmVhcmJ5aW5kZXhfYmFzZS5qcyIsIi4uLy4uL3NyYy9hcGlfZXZlbnRpZnkuanMiLCIuLi8uLi9zcmMvYXBpX3NyY3Byb3AuanMiLCIuLi8uLi9zcmMvc2VnbWVudHMuanMiLCIuLi8uLi9zcmMvc29ydGVkYXJyYXkuanMiLCIuLi8uLi9zcmMvbmVhcmJ5aW5kZXguanMiLCIuLi8uLi9zcmMvbGF5ZXJzLmpzIiwiLi4vLi4vc3JjL29wcy9tZXJnZS5qcyIsIi4uLy4uL3NyYy9vcHMvc2hpZnQuanMiLCIuLi8uLi9zcmMvY2xvY2twcm92aWRlci5qcyIsIi4uLy4uL3NyYy9jbWQuanMiLCIuLi8uLi9zcmMvbW9uaXRvci5qcyIsIi4uLy4uL3NyYy9jdXJzb3JzLmpzIiwiLi4vLi4vc3JjL29wcy9ib29sZWFuLmpzIiwiLi4vLi4vc3JjL29wcy9sb2dpY2FsX21lcmdlLmpzIiwiLi4vLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG4gICAgVGhpcyBkZWNvcmF0ZXMgYW4gb2JqZWN0L3Byb3RvdHlwZSB3aXRoIGJhc2ljIChzeW5jaHJvbm91cykgY2FsbGJhY2sgc3VwcG9ydC5cbiovXG5cbmNvbnN0IFBSRUZJWCA9IFwiX19jYWxsYmFja1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gYWRkVG9JbnN0YW5jZShvYmplY3QpIHtcbiAgICBvYmplY3RbYCR7UFJFRklYfV9oYW5kbGVyc2BdID0gW107XG59XG5cbmZ1bmN0aW9uIGFkZF9jYWxsYmFjayAoaGFuZGxlcikge1xuICAgIGxldCBoYW5kbGUgPSB7XG4gICAgICAgIGhhbmRsZXI6IGhhbmRsZXJcbiAgICB9XG4gICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0ucHVzaChoYW5kbGUpO1xuICAgIHJldHVybiBoYW5kbGU7XG59O1xuXG5mdW5jdGlvbiByZW1vdmVfY2FsbGJhY2sgKGhhbmRsZSkge1xuICAgIGxldCBpbmRleCA9IHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLmluZGV4b2YoaGFuZGxlKTtcbiAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIG5vdGlmeV9jYWxsYmFja3MgKGVBcmcpIHtcbiAgICB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5mb3JFYWNoKGZ1bmN0aW9uKGhhbmRsZSkge1xuICAgICAgICBoYW5kbGUuaGFuZGxlcihlQXJnKTtcbiAgICB9KTtcbn07XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlIChfcHJvdG90eXBlKSB7XG4gICAgY29uc3QgYXBpID0ge1xuICAgICAgICBhZGRfY2FsbGJhY2ssIHJlbW92ZV9jYWxsYmFjaywgbm90aWZ5X2NhbGxiYWNrc1xuICAgIH1cbiAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG59XG5cblxuIiwiaW1wb3J0ICogYXMgY2FsbGJhY2sgZnJvbSBcIi4vYXBpX2NhbGxiYWNrLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIFNUQVRFIFBST1ZJREVSIEJBU0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgQmFzZSBjbGFzcyBmb3IgU3RhdGVQcm92aWRlcnNcblxuICAgIC0gY29sbGVjdGlvbiBvZiBpdGVtc1xuICAgIC0ge2lkLCBpdHYsIHR5cGUsIGRhdGF9XG4qL1xuXG5leHBvcnQgY2xhc3MgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogdXBkYXRlIGZ1bmN0aW9uXG4gICAgICogXG4gICAgICogSWYgSXRlbXNQcm92aWRlciBpcyBhIHByb3h5IHRvIGFuIG9ubGluZVxuICAgICAqIEl0ZW1zIGNvbGxlY3Rpb24sIHVwZGF0ZSByZXF1ZXN0cyB3aWxsIFxuICAgICAqIGltcGx5IGEgbmV0d29yayByZXF1ZXN0XG4gICAgICogXG4gICAgICogb3B0aW9ucyAtIHN1cHBvcnQgcmVzZXQgZmxhZyBcbiAgICAgKi9cbiAgICB1cGRhdGUoY2hhbmdlcyl7fVxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIGFycmF5IHdpdGggYWxsIGl0ZW1zIGluIGNvbGxlY3Rpb24gXG4gICAgICogLSBubyByZXF1aXJlbWVudCB3cnQgb3JkZXJcbiAgICAgKi9cbiAgICBnZXRfaXRlbXMoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShTdGF0ZVByb3ZpZGVyQmFzZS5wcm90b3R5cGUpO1xuIiwiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gICAgKiBcbiAgICAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAgICAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICAgICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gICAgKiBcbiAgICAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICAgICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAgICAqIFxuICAgICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG5cbiovXG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuXG5cbiAgICBOT1RFIFxuICAgIC0gY21wKDRdLFs0ICkgPT0gMCAtIHNpbmNlIHRoZXNlIGFyZSB0aGUgc2FtZSB3aXRoIHJlc3BlY3QgdG8gc29ydGluZ1xuICAgIC0gYnV0IGlmIHlvdSB3YW50IHRvIHNlZSBpZiB0d28gaW50ZXJ2YWxzIGFyZSBvdmVybGFwcGluZyBpbiB0aGUgZW5kcG9pbnRzXG4gICAgY21wKGhpZ2hfYSwgbG93X2IpID4gMCB0aGlzIHdpbGwgbm90IGJlIGdvb2RcbiAgICBcbiovIFxuXG5cbmZ1bmN0aW9uIGNtcE51bWJlcnMoYSwgYikge1xuICAgIGlmIChhID09PSBiKSByZXR1cm4gMDtcbiAgICBpZiAoYSA9PT0gSW5maW5pdHkpIHJldHVybiAxO1xuICAgIGlmIChiID09PSBJbmZpbml0eSkgcmV0dXJuIC0xO1xuICAgIGlmIChhID09PSAtSW5maW5pdHkpIHJldHVybiAtMTtcbiAgICBpZiAoYiA9PT0gLUluZmluaXR5KSByZXR1cm4gMTtcbiAgICByZXR1cm4gYSAtIGI7XG4gIH1cblxuZnVuY3Rpb24gZW5kcG9pbnRfY21wIChwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICBsZXQgZGlmZiA9IGNtcE51bWJlcnModjEsIHYyKTtcbiAgICByZXR1cm4gKGRpZmYgIT0gMCkgPyBkaWZmIDogczEgLSBzMjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludCB0byB0aGUgb3RoZXIgc2lkZVxuICogXG4gKiB1c2VmdWwgZm9yIG1ha2luZyBiYWNrLXRvLWJhY2sgaW50ZXJ2YWxzIFxuICogXG4gKiBoaWdoKSA8LT4gW2xvd1xuICogaGlnaF0gPC0+IChsb3dcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKHAsIHRhcmdldCkge1xuICAgIGxldCBbdixzXSA9IHA7XG4gICAgaWYgKCFpc0Zpbml0ZSh2KSkge1xuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgaWYgKHRhcmdldCA9PSBcImxvd1wiKSB7XG4gICAgXHQvLyBhc3N1bWUgcG9pbnQgaXMgaGlnaDogc2lnbiBtdXN0IGJlIC0xIG9yIDBcbiAgICBcdGlmIChzID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBsb3dcIik7ICAgIFx0XHRcbiAgICBcdH1cbiAgICAgICAgcCA9IFt2LCBzKzFdO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09IFwiaGlnaFwiKSB7XG5cdFx0Ly8gYXNzdW1lIHBvaW50IGlzIGxvdzogc2lnbiBpcyAwIG9yIDFcbiAgICBcdGlmIChzIDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBoaWdoXCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcy0xXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0eXBlXCIsIHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBsZXQgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBsZXQgbG93X3AgPSAobG93Q2xvc2VkKSA/IFtsb3csIDBdIDogW2xvdywgMV07IFxuICAgIGxldCBoaWdoX3AgPSAoaGlnaENsb3NlZCkgPyBbaGlnaCwgMF0gOiBbaGlnaCwgLTFdO1xuICAgIHJldHVybiBbbG93X3AsIGhpZ2hfcF07XG59XG5cbi8qXG4gICAgcmV0dXJucyBlbmRwb2ludHMgZnJvbSBpbnRlcnZhbFxuKi9cblxuZnVuY3Rpb24gZW5kcG9pbnRfZnJvbV9pbnB1dChvZmZzZXQpIHtcbiAgICBpZiAodHlwZW9mIG9mZnNldCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgcmV0dXJuIFtvZmZzZXQsIDBdO1xuICAgIH1cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkob2Zmc2V0KSB8fCBvZmZzZXQubGVuZ3RoICE9IDIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW5kcG9pbnQgbXVzdCBiZSBhIGxlbmd0aC0yIGFycmF5XCIpO1xuICAgIH1cbiAgICBsZXQgW3ZhbHVlLCBzaWduXSA9IG9mZnNldDtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVuZHBvaW50IHZhbHVlIG11c3QgYmUgbnVtYmVyXCIpO1xuICAgIH1cbiAgICByZXR1cm4gW3ZhbHVlLCBNYXRoLnNpZ24oc2lnbildO1xufVxuXG5cbi8qXG4gICAgSU5URVJWQUxTXG5cbiAgICBJbnRlcnZhbHMgYXJlIFtsb3csIGhpZ2gsIGxvd0Nsb3NlZCwgaGlnaENsb3NlZF1cblxuKi8gXG5cbi8qXG4gICAgcmV0dXJuIHRydWUgaWYgcG9pbnQgcCBpcyBjb3ZlcmVkIGJ5IGludGVydmFsIGl0dlxuICAgIHBvaW50IHAgY2FuIGJlIG51bWJlciBwIG9yIGEgcG9pbnQgW3Asc11cblxuICAgIGltcGxlbWVudGVkIGJ5IGNvbXBhcmluZyBwb2ludHNcbiAgICBleGNlcHRpb24gaWYgaW50ZXJ2YWwgaXMgbm90IGRlZmluZWRcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBwKSB7XG4gICAgbGV0IFtsb3dfcCwgaGlnaF9wXSA9IGVuZHBvaW50c19mcm9tX2ludGVydmFsKGl0dik7XG4gICAgLy8gY292ZXJzOiBsb3cgPD0gcCA8PSBoaWdoXG4gICAgcmV0dXJuIGVuZHBvaW50X2xlKGxvd19wLCBwKSAmJiBlbmRwb2ludF9sZShwLCBoaWdoX3ApO1xufVxuLy8gY29udmVuaWVuY2VcbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19wb2ludChpdHYsIHApIHtcbiAgICByZXR1cm4gaW50ZXJ2YWxfY292ZXJzX2VuZHBvaW50KGl0diwgW3AsIDBdKTtcbn1cblxuXG5cbi8qXG4gICAgUmV0dXJuIHRydWUgaWYgaW50ZXJ2YWwgaGFzIGxlbmd0aCAwXG4qL1xuZnVuY3Rpb24gaW50ZXJ2YWxfaXNfc2luZ3VsYXIoaW50ZXJ2YWwpIHtcbiAgICByZXR1cm4gaW50ZXJ2YWxbMF0gPT0gaW50ZXJ2YWxbMV1cbn1cblxuLypcbiAgICBDcmVhdGUgaW50ZXJ2YWwgZnJvbSBlbmRwb2ludHNcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyhwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICAvLyBwMSBtdXN0IGJlIGEgbG93IHBvaW50XG4gICAgaWYgKHMxID09IC0xKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgbG93IHBvaW50XCIsIHAxKTtcbiAgICB9XG4gICAgaWYgKHMyID09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdlYWwgaGlnaCBwb2ludFwiLCBwMik7ICAgXG4gICAgfVxuICAgIHJldHVybiBbdjEsIHYyLCAoczE9PTApLCAoczI9PTApXVxufVxuXG5mdW5jdGlvbiBpc051bWJlcihuKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBuID09IFwibnVtYmVyXCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbnRlcnZhbF9mcm9tX2lucHV0KGlucHV0KXtcbiAgICBsZXQgaXR2ID0gaW5wdXQ7XG4gICAgaWYgKGl0diA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaW5wdXQgaXMgdW5kZWZpbmVkXCIpO1xuICAgIH1cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXR2KSkge1xuICAgICAgICBpZiAoaXNOdW1iZXIoaXR2KSkge1xuICAgICAgICAgICAgLy8gaW5wdXQgaXMgc2luZ3VsYXIgbnVtYmVyXG4gICAgICAgICAgICBpdHYgPSBbaXR2LCBpdHYsIHRydWUsIHRydWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbnB1dDogJHtpbnB1dH06IG11c3QgYmUgQXJyYXkgb3IgTnVtYmVyYClcbiAgICAgICAgfVxuICAgIH07XG4gICAgLy8gbWFrZSBzdXJlIGludGVydmFsIGlzIGxlbmd0aCA0XG4gICAgaWYgKGl0di5sZW5ndGggPT0gMSkge1xuICAgICAgICBpdHYgPSBbaXR2WzBdLCBpdHZbMF0sIHRydWUsIHRydWVdXG4gICAgfSBlbHNlIGlmIChpdHYubGVuZ3RoID09IDIpIHtcbiAgICAgICAgaXR2ID0gaXR2LmNvbmNhdChbdHJ1ZSwgZmFsc2VdKTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMykge1xuICAgICAgICBpdHYgPSBpdHYucHVzaChmYWxzZSk7XG4gICAgfSBlbHNlIGlmIChpdHYubGVuZ3RoID4gNCkge1xuICAgICAgICBpdHYgPSBpdHYuc2xpY2UoMCw0KTtcbiAgICB9XG4gICAgbGV0IFtsb3csIGhpZ2gsIGxvd0luY2x1ZGUsIGhpZ2hJbmNsdWRlXSA9IGl0djtcbiAgICAvLyB1bmRlZmluZWRcbiAgICBpZiAobG93ID09IHVuZGVmaW5lZCB8fCBsb3cgPT0gbnVsbCkge1xuICAgICAgICBsb3cgPSAtSW5maW5pdHk7XG4gICAgfVxuICAgIGlmIChoaWdoID09IHVuZGVmaW5lZCB8fCBoaWdoID09IG51bGwpIHtcbiAgICAgICAgaGlnaCA9IEluZmluaXR5O1xuICAgIH1cbiAgICAvLyBjaGVjayB0aGF0IGxvdyBhbmQgaGlnaCBhcmUgbnVtYmVyc1xuICAgIGlmICghaXNOdW1iZXIobG93KSkgdGhyb3cgbmV3IEVycm9yKFwibG93IG5vdCBhIG51bWJlclwiLCBsb3cpO1xuICAgIGlmICghaXNOdW1iZXIoaGlnaCkpIHRocm93IG5ldyBFcnJvcihcImhpZ2ggbm90IGEgbnVtYmVyXCIsIGhpZ2gpO1xuICAgIC8vIGNoZWNrIHRoYXQgbG93IDw9IGhpZ2hcbiAgICBpZiAobG93ID4gaGlnaCkgdGhyb3cgbmV3IEVycm9yKFwibG93ID4gaGlnaFwiLCBsb3csIGhpZ2gpO1xuICAgIC8vIHNpbmdsZXRvblxuICAgIGlmIChsb3cgPT0gaGlnaCkge1xuICAgICAgICBsb3dJbmNsdWRlID0gdHJ1ZTtcbiAgICAgICAgaGlnaEluY2x1ZGUgPSB0cnVlO1xuICAgIH1cbiAgICAvLyBjaGVjayBpbmZpbml0eSB2YWx1ZXNcbiAgICBpZiAobG93ID09IC1JbmZpbml0eSkge1xuICAgICAgICBsb3dJbmNsdWRlID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGhpZ2ggPT0gSW5maW5pdHkpIHtcbiAgICAgICAgaGlnaEluY2x1ZGUgPSB0cnVlO1xuICAgIH1cbiAgICAvLyBjaGVjayB0aGF0IGxvd0luY2x1ZGUsIGhpZ2hJbmNsdWRlIGFyZSBib29sZWFuc1xuICAgIGlmICh0eXBlb2YgbG93SW5jbHVkZSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibG93SW5jbHVkZSBub3QgYm9vbGVhblwiKTtcbiAgICB9IFxuICAgIGlmICh0eXBlb2YgaGlnaEluY2x1ZGUgIT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImhpZ2hJbmNsdWRlIG5vdCBib29sZWFuXCIpO1xuICAgIH1cbiAgICByZXR1cm4gW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdO1xufVxuXG5cblxuXG5leHBvcnQgY29uc3QgZW5kcG9pbnQgPSB7XG4gICAgbGU6IGVuZHBvaW50X2xlLFxuICAgIGx0OiBlbmRwb2ludF9sdCxcbiAgICBnZTogZW5kcG9pbnRfZ2UsXG4gICAgZ3Q6IGVuZHBvaW50X2d0LFxuICAgIGNtcDogZW5kcG9pbnRfY21wLFxuICAgIGVxOiBlbmRwb2ludF9lcSxcbiAgICBtaW46IGVuZHBvaW50X21pbixcbiAgICBtYXg6IGVuZHBvaW50X21heCxcbiAgICBmbGlwOiBlbmRwb2ludF9mbGlwLFxuICAgIGZyb21faW50ZXJ2YWw6IGVuZHBvaW50c19mcm9tX2ludGVydmFsLFxuICAgIGZyb21faW5wdXQ6IGVuZHBvaW50X2Zyb21faW5wdXRcbn1cbmV4cG9ydCBjb25zdCBpbnRlcnZhbCA9IHtcbiAgICBjb3ZlcnNfZW5kcG9pbnQ6IGludGVydmFsX2NvdmVyc19lbmRwb2ludCxcbiAgICBjb3ZlcnNfcG9pbnQ6IGludGVydmFsX2NvdmVyc19wb2ludCwgXG4gICAgaXNfc2luZ3VsYXI6IGludGVydmFsX2lzX3Npbmd1bGFyLFxuICAgIGZyb21fZW5kcG9pbnRzOiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyxcbiAgICBmcm9tX2lucHV0OiBpbnRlcnZhbF9mcm9tX2lucHV0XG59XG4iLCJpbXBvcnQgeyBlbmRwb2ludCwgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIENMT0NLU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIGNsb2NrcyBjb3VudGluZyBpbiBzZWNvbmRzXG4gKi9cblxuY29uc3QgbG9jYWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHBlcmZvcm1hbmNlLm5vdygpLzEwMDAuMDtcbn1cblxuY29uc3QgZXBvY2ggPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyBEYXRlKCkvMTAwMC4wO1xufVxuXG4vKipcbiAqIHRoZSBjbG9jayBnaXZlcyBlcG9jaCB2YWx1ZXMsIGJ1dCBpcyBpbXBsZW1lbnRlZFxuICogdXNpbmcgYSBoaWdoIHBlcmZvcm1hbmNlIGxvY2FsIGNsb2NrIGZvciBiZXR0ZXJcbiAqIHRpbWUgcmVzb2x1dGlvbiBhbmQgcHJvdGVjdGlvbiBhZ2FpbnN0IHN5c3RlbSBcbiAqIHRpbWUgYWRqdXN0bWVudHMuXG4gKi9cblxuZXhwb3J0IGNvbnN0IENMT0NLID0gZnVuY3Rpb24gKCkge1xuICAgIGNvbnN0IHQwX2xvY2FsID0gbG9jYWwoKTtcbiAgICBjb25zdCB0MF9lcG9jaCA9IGVwb2NoKCk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgbm93OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdDBfZXBvY2ggKyAobG9jYWwoKSAtIHQwX2xvY2FsKVxuICAgICAgICB9XG4gICAgfVxufSgpO1xuXG5cbi8vIG92dmVycmlkZSBtb2R1bG8gdG8gYmVoYXZlIGJldHRlciBmb3IgbmVnYXRpdmUgbnVtYmVyc1xuZXhwb3J0IGZ1bmN0aW9uIG1vZChuLCBtKSB7XG4gICAgcmV0dXJuICgobiAlIG0pICsgbSkgJSBtO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRpdm1vZCh4LCBiYXNlKSB7XG4gICAgbGV0IG4gPSBNYXRoLmZsb29yKHggLyBiYXNlKVxuICAgIGxldCByID0gbW9kKHgsIGJhc2UpO1xuICAgIHJldHVybiBbbiwgcl07XG59XG5cblxuLypcbiAgICBzaW1pbGFyIHRvIHJhbmdlIGZ1bmN0aW9uIGluIHB5dGhvblxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmdlIChzdGFydCwgZW5kLCBzdGVwID0gMSwgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgIGNvbnN0IHtpbmNsdWRlX2VuZD1mYWxzZX0gPSBvcHRpb25zO1xuICAgIGlmIChzdGVwID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU3RlcCBjYW5ub3QgYmUgemVyby4nKTtcbiAgICB9XG4gICAgaWYgKHN0YXJ0IDwgZW5kKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSBzdGVwKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goaSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHN0YXJ0ID4gZW5kKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA+IGVuZDsgaSAtPSBzdGVwKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goaSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGluY2x1ZGVfZW5kKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGVuZCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cblxuLyoqXG4gKiBDcmVhdGUgYSBzaW5nbGUgc3RhdGUgZnJvbSBhIGxpc3Qgb2Ygc3RhdGVzLCB1c2luZyBhIHZhbHVlRnVuY1xuICogc3RhdGU6e3ZhbHVlLCBkeW5hbWljLCBvZmZzZXR9XG4gKiBcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gdG9TdGF0ZShzb3VyY2VzLCBzdGF0ZXMsIG9mZnNldCwgb3B0aW9ucz17fSkge1xuICAgIGxldCB7dmFsdWVGdW5jLCBzdGF0ZUZ1bmN9ID0gb3B0aW9uczsgXG4gICAgaWYgKHZhbHVlRnVuYyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgbGV0IHZhbHVlID0gdmFsdWVGdW5jKHtzb3VyY2VzLCBzdGF0ZXMsIG9mZnNldH0pO1xuICAgICAgICBsZXQgZHluYW1pYyA9IHN0YXRlcy5tYXAoKHYpID0+IHYuZHltYW1pYykuc29tZShlPT5lKTtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0fTtcbiAgICB9IGVsc2UgaWYgKHN0YXRlRnVuYyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHsuLi5zdGF0ZUZ1bmMoe3NvdXJjZXMsIHN0YXRlcywgb2Zmc2V0fSksIG9mZnNldH07XG4gICAgfVxuICAgIC8vIG5vIHZhbHVlRnVuYyBvciBzdGF0ZUZ1bmNcbiAgICBpZiAoc3RhdGVzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6dW5kZWZpbmVkLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9XG4gICAgfVxuICAgIC8vIGZhbGxiYWNrIC0ganVzdCB1c2UgZmlyc3Qgc3RhdGVcbiAgICBsZXQgc3RhdGUgPSBzdGF0ZXNbMF07XG4gICAgcmV0dXJuIHsuLi5zdGF0ZSwgb2Zmc2V0fTsgXG59XG5cblxuLyoqXG4gKiBjaGVjayBpbnB1dCBpdGVtcyB0byBsb2NhbCBzdGF0ZSBwcm92aWRlcnNcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tfaW5wdXQoaXRlbXMpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIklucHV0IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgfVxuICAgIC8vIG1ha2Ugc3VyZSB0aGF0IGludGVydmFscyBhcmUgd2VsbCBmb3JtZWRcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICAgICAgaXRlbS5pdHYgPSBpbnRlcnZhbC5mcm9tX2lucHV0KGl0ZW0uaXR2KTtcbiAgICB9XG4gICAgLy8gc29ydCBpdGVtcyBiYXNlZCBvbiBpbnRlcnZhbCBsb3cgZW5kcG9pbnRcbiAgICBpdGVtcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGxldCBhX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYS5pdHYpWzBdO1xuICAgICAgICBsZXQgYl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGIuaXR2KVswXTtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmNtcChhX2xvdywgYl9sb3cpO1xuICAgIH0pO1xuICAgIC8vIGNoZWNrIHRoYXQgaXRlbSBpbnRlcnZhbHMgYXJlIG5vbi1vdmVybGFwcGluZ1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IHByZXZfaGlnaCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaSAtIDFdLml0dilbMV07XG4gICAgICAgIGxldCBjdXJyX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaV0uaXR2KVswXTtcbiAgICAgICAgLy8gdmVyaWZ5IHRoYXQgcHJldiBoaWdoIGlzIGxlc3MgdGhhdCBjdXJyIGxvd1xuICAgICAgICBpZiAoIWVuZHBvaW50Lmx0KHByZXZfaGlnaCwgY3Vycl9sb3cpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPdmVybGFwcGluZyBpbnRlcnZhbHMgZm91bmRcIik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiByYW5kb21fc3RyaW5nKGxlbmd0aCkge1xuICAgIHZhciB0ZXh0ID0gXCJcIjtcbiAgICB2YXIgcG9zc2libGUgPSBcIkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpcIjtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGV4dCArPSBwb3NzaWJsZS5jaGFyQXQoTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogcG9zc2libGUubGVuZ3RoKSk7XG4gICAgfVxuICAgIHJldHVybiB0ZXh0O1xufSIsImltcG9ydCB7IFN0YXRlUHJvdmlkZXJCYXNlIH0gZnJvbSBcIi4vc3RhdGVwcm92aWRlcl9iYXNlLmpzXCI7XG5pbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgcmFuZG9tX3N0cmluZyB9IGZyb20gXCIuL3V0aWwuanNcIjtcblxuZnVuY3Rpb24gY2hlY2tfaXRlbShpdGVtKSB7XG4gICAgaXRlbS5pdHYgPSBpbnRlcnZhbC5mcm9tX2lucHV0KGl0ZW0uaXR2KTtcbiAgICBpdGVtLmlkID0gaXRlbS5pZCB8fCByYW5kb21fc3RyaW5nKDEwKTtcbiAgICByZXR1cm4gaXRlbTtcbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExPQ0FMIFNUQVRFIFBST1ZJREVSXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogbG9jYWwgc3RhdGUgcHJvdmlkZXJcbiAqIGNvbGxlY3Rpb24gb2YgaXRlbXNcbiAqIFxuICogY2hhbmdlcyA9IHtcbiAqICAgaXRlbXM9W10sXG4gKiAgIHJlbW92ZT1bXSxcbiAqICAgY2xlYXI9ZmFsc2UgXG4gKiB9XG4gKiBcbiovXG5cbmV4cG9ydCBjbGFzcyBMb2NhbFN0YXRlUHJvdmlkZXIgZXh0ZW5kcyBTdGF0ZVByb3ZpZGVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX21hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgdGhpcy5faW5pdGlhbGlzZShvcHRpb25zKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2NhbCBTdGF0ZVByb3ZpZGVycyBzdXBwb3J0IGluaXRpYWxpc2F0aW9uIHdpdGhcbiAgICAgKiBieSBnaXZpbmcgaXRlbXMgb3IgYSB2YWx1ZS4gXG4gICAgICovXG4gICAgX2luaXRpYWxpc2Uob3B0aW9ucz17fSkge1xuICAgICAgICAvLyBpbml0aWFsaXphdGlvbiB3aXRoIGl0ZW1zIG9yIHNpbmdsZSB2YWx1ZSBcbiAgICAgICAgbGV0IHtpdGVtcywgdmFsdWV9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHZhbHVlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gaW5pdGlhbGl6ZSBmcm9tIHZhbHVlXG4gICAgICAgICAgICBpdGVtcyA9IFt7XG4gICAgICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sIFxuICAgICAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICAgICAgZGF0YTogdmFsdWVcbiAgICAgICAgICAgIH1dO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpdGVtcyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZSh7aXRlbXN9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvY2FsIFN0YXRlUHJvdmlkZXJzIGRlY291cGxlIHVwZGF0ZSByZXF1ZXN0IGZyb21cbiAgICAgKiB1cGRhdGUgcHJvY2Vzc2luZywgYW5kIHJldHVybnMgUHJvbWlzZS5cbiAgICAgKi9cbiAgICB1cGRhdGUgKGNoYW5nZXMpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIGxldCBkaWZmcztcbiAgICAgICAgICAgIGlmIChjaGFuZ2VzICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGRpZmZzID0gdGhpcy5fdXBkYXRlKGNoYW5nZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcyhkaWZmcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZGlmZnM7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIF91cGRhdGUoY2hhbmdlcykge1xuICAgICAgICBjb25zdCBkaWZmcyA9IFtdO1xuICAgICAgICBsZXQge1xuICAgICAgICAgICAgaXRlbXM9W10sXG4gICAgICAgICAgICByZW1vdmU9W10sXG4gICAgICAgICAgICBjbGVhcj10cnVlXG4gICAgICAgIH0gPSBjaGFuZ2VzO1xuICAgICAgICBpZiAoY2xlYXIpIHtcbiAgICAgICAgICAgIC8vIGNsZWFyIGFsbCBpdGVtc1xuICAgICAgICAgICAgdGhpcy5fbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcmVtb3ZlIGl0ZW1zIGJ5IGlkXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGlkIG9mIHJlbW92ZSkge1xuICAgICAgICAgICAgICAgIGxldCBpdGVtID0gdGhpcy5fbWFwLmdldChpZCk7XG4gICAgICAgICAgICAgICAgaWYgKGl0ZW0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGRpZmZzLnB1c2goe2lkOml0ZW0uaWQsIG9sZDppdGVtfSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hcC5kZWxldGUoaWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBpbnNlcnQgaXRlbXNcbiAgICAgICAgZm9yIChsZXQgaXRlbSBvZiBpdGVtcykge1xuICAgICAgICAgICAgaXRlbSA9IGNoZWNrX2l0ZW0oaXRlbSk7XG4gICAgICAgICAgICBsZXQgb2xkID0gdGhpcy5fbWFwLmdldChpdGVtLmlkKTtcbiAgICAgICAgICAgIGlmIChvbGQgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZGlmZnMucHVzaCh7aWQ6aXRlbS5pZCwgbmV3Oml0ZW0sIG9sZH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkaWZmcy5wdXNoKHtpZDppdGVtLmlkLCBuZXc6aXRlbX0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fbWFwLnNldChpdGVtLmlkLCBpdGVtKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGlmZnM7XG4gICAgfVxuXG4gICAgZ2V0X2l0ZW1zKCkge1xuICAgICAgICByZXR1cm4gWy4uLnRoaXMuX21hcC52YWx1ZXMoKV07XG4gICAgfTtcbn1cblxuIiwiaW1wb3J0IHsgZW5kcG9pbnQsIGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBORUFSQlkgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBBYnN0cmFjdCBzdXBlcmNsYXNzIGZvciBOZWFyYnlJbmRleGUuXG4gKiBcbiAqIFN1cGVyY2xhc3MgdXNlZCB0byBjaGVjayB0aGF0IGEgY2xhc3MgaW1wbGVtZW50cyB0aGUgbmVhcmJ5KCkgbWV0aG9kLCBcbiAqIGFuZCBwcm92aWRlIHNvbWUgY29udmVuaWVuY2UgbWV0aG9kcy5cbiAqIFxuICogTkVBUkJZIElOREVYXG4gKiBcbiAqIE5lYXJieUluZGV4IHByb3ZpZGVzIGluZGV4aW5nIHN1cHBvcnQgb2YgZWZmZWN0aXZlbHlcbiAqIGxvb2tpbmcgdXAgcmVnaW9ucyBieSBvZmZzZXQsIFxuICogZ2l2ZW4gdGhhdFxuICogKGkpIGVhY2ggcmVnaW9uIGlzIGFzc29jaWF0ZWQgd2l0aCBhbiBpbnRlcnZhbCBhbmQsXG4gKiAoaWkpIHJlZ2lvbnMgYXJlIG5vbi1vdmVybGFwcGluZy5cbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgXG4gKiBhcm91bmQgZW5kcG9pbnQuIFxuICogXG4gKiBSZXR1cm5zIHtcbiAqICAgICAgY2VudGVyOiBsaXN0IG9mIG9iamVjdHMgY292ZXJlZCBieSByZWdpb24sXG4gKiAgICAgIGl0djogcmVnaW9uIGludGVydmFsIC0gdmFsaWRpdHkgb2YgY2VudGVyIFxuICogICAgICBsZWZ0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIGxlZnQgXG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBoaWdoLWVuZHBvaW50IG9yIFstSW5maW5pdHksIDBdXG4gKiAgICAgIHJpZ2h0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0XG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBsb3ctZW5kcG9pbnQgb3IgW0luZmluaXR5LCAwXSAgICBcbiAqIFxuICogXG4gKiBUaGUgbmVhcmJ5IHN0YXRlIGlzIHdlbGwtZGVmaW5lZCBmb3IgZXZlcnkgZW5kcG9pbnRcbiAqIG9uIHRoZSB0aW1lbGluZS5cbiAqIFxuICogSU5URVJWQUxTXG4gKiBcbiAqIFtsb3csIGhpZ2gsIGxvd0luY2x1c2l2ZSwgaGlnaEluY2x1c2l2ZV1cbiAqIFxuICogVGhpcyByZXByZXNlbnRhdGlvbiBlbnN1cmVzIHRoYXQgdGhlIGludGVydmFsIGVuZHBvaW50cyBcbiAqIGFyZSBvcmRlcmVkIGFuZCBhbGxvd3MgaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIFxuICogeWV0IGNvdmVyIHRoZSBlbnRpcmUgcmVhbCBsaW5lIFxuICogXG4gKiBbYSxiXSwgKGEsYiksIFthLGIpLCBbYSwgYikgYXJlIGFsbCB2YWxpZCBpbnRlcnZhbHNcbiAqIFxuICogXG4gKiBJTlRFUlZBTCBFTkRQT0lOVFNcbiAqIFxuICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gKiBcbiAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gKiBcbiAqICBcbiAqL1xuXG5cbi8qKlxuICogcmV0dXJuIGZpcnN0IGhpZ2ggZW5kcG9pbnQgb24gdGhlIGxlZnQgZnJvbSBuZWFyYnksXG4gKiB3aGljaCBpcyBub3QgaW4gY2VudGVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsZWZ0X2VuZHBvaW50IChuZWFyYnkpIHtcbiAgICBjb25zdCBsb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5lYXJieS5pdHYpWzBdO1xuICAgIHJldHVybiBlbmRwb2ludC5mbGlwKGxvdywgXCJoaWdoXCIpO1xufVxuXG4vKipcbiAqIHJldHVybiBmaXJzdCBsb3cgZW5kcG9pbnQgb24gdGhlIHJpZ2h0IGZyb20gbmVhcmJ5LFxuICogd2hpY2ggaXMgbm90IGluIGNlbnRlclxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiByaWdodF9lbmRwb2ludCAobmVhcmJ5KSB7XG4gICAgY29uc3QgaGlnaCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmVhcmJ5Lml0dilbMV07XG4gICAgcmV0dXJuIGVuZHBvaW50LmZsaXAoaGlnaCwgXCJsb3dcIik7XG59XG5cblxuXG5leHBvcnQgY2xhc3MgTmVhcmJ5SW5kZXhCYXNlIHtcblxuXG4gICAgLyogXG4gICAgICAgIE5lYXJieSBtZXRob2RcbiAgICAqL1xuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHJldHVybiBsb3cgcG9pbnQgb2YgbGVmdG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGZpcnN0KCkge1xuICAgICAgICBsZXQge2NlbnRlciwgcmlnaHR9ID0gdGhpcy5uZWFyYnkoWy1JbmZpbml0eSwgMF0pO1xuICAgICAgICByZXR1cm4gKGNlbnRlci5sZW5ndGggPiAwKSA/IFstSW5maW5pdHksIDBdIDogcmlnaHQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGhpZ2ggcG9pbnQgb2YgcmlnaHRtb3N0IGVudHJ5XG4gICAgKi9cbiAgICBsYXN0KCkge1xuICAgICAgICBsZXQge2xlZnQsIGNlbnRlcn0gPSB0aGlzLm5lYXJieShbSW5maW5pdHksIDBdKTtcbiAgICAgICAgcmV0dXJuIChjZW50ZXIubGVuZ3RoID4gMCkgPyBbSW5maW5pdHksIDBdIDogbGVmdFxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIG5lYXJieSBvZiBmaXJzdCByZWdpb24gdG8gdGhlIHJpZ2h0XG4gICAgICogd2hpY2ggaXMgbm90IHRoZSBjZW50ZXIgcmVnaW9uLiBJZiBub3QgZXhpc3RzLCByZXR1cm5cbiAgICAgKiB1bmRlZmluZWQuIFxuICAgICAqL1xuICAgIHJpZ2h0X3JlZ2lvbihuZWFyYnkpIHtcbiAgICAgICAgY29uc3QgcmlnaHQgPSByaWdodF9lbmRwb2ludChuZWFyYnkpO1xuICAgICAgICBpZiAocmlnaHRbMF0gPT0gSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubmVhcmJ5KHJpZ2h0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZXR1cm4gbmVhcmJ5IG9mIGZpcnN0IHJlZ2lvbiB0byB0aGUgbGVmdFxuICAgICAqIHdoaWNoIGlzIG5vdCB0aGUgY2VudGVyIHJlZ2lvbi4gSWYgbm90IGV4aXN0cywgcmV0dXJuXG4gICAgICogdW5kZWZpbmVkLiBcbiAgICAgKi9cbiAgICBsZWZ0X3JlZ2lvbihuZWFyYnkpIHtcbiAgICAgICAgY29uc3QgbGVmdCA9IGxlZnRfZW5kcG9pbnQobmVhcmJ5KTtcbiAgICAgICAgaWYgKGxlZnRbMF0gPT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm5lYXJieShsZWZ0KTsgICAgXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogZmluZCBmaXJzdCByZWdpb24gdG8gdGhlIFwicmlnaHRcIiBvciBcImxlZnRcIlxuICAgICAqIHdoaWNoIGlzIG5vdCB0aGUgY2VudGVyIHJlZ2lvbiwgYW5kIHdoaWNoIG1lZXRzXG4gICAgICogYSBjb25kaXRpb24gb24gbmVhcmJ5LmNlbnRlci5cbiAgICAgKiBEZWZhdWx0IGNvbmRpdGlvbiBpcyBjZW50ZXIgbm9uLWVtcHR5XG4gICAgICogSWYgbm90IGV4aXN0cywgcmV0dXJuIHVuZGVmaW5lZC4gXG4gICAgICovXG4gICAgXG4gICAgZmluZF9yZWdpb24obmVhcmJ5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIGxldCB7XG4gICAgICAgICAgICBkaXJlY3Rpb24gPSAxLFxuICAgICAgICAgICAgY29uZGl0aW9uID0gKGNlbnRlcikgPT4gY2VudGVyLmxlbmd0aCA+IDBcbiAgICAgICAgfSA9IG9wdGlvbnM7XG4gICAgICAgIGxldCBuZXh0X25lYXJieTtcbiAgICAgICAgd2hpbGUodHJ1ZSkge1xuICAgICAgICAgICAgaWYgKGRpcmVjdGlvbiA9PSAxKSB7XG4gICAgICAgICAgICAgICAgbmV4dF9uZWFyYnkgPSB0aGlzLnJpZ2h0X3JlZ2lvbihuZWFyYnkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXh0X25lYXJieSA9IHRoaXMubGVmdF9yZWdpb24obmVhcmJ5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChuZXh0X25lYXJieSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNvbmRpdGlvbihuZXh0X25lYXJieS5jZW50ZXIpKSB7XG4gICAgICAgICAgICAgICAgLy8gZm91bmQgcmVnaW9uIFxuICAgICAgICAgICAgICAgIHJldHVybiBuZXh0X25lYXJieTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHJlZ2lvbiBub3QgZm91bmRcbiAgICAgICAgICAgIC8vIGNvbnRpbnVlIHNlYXJjaGluZyB0aGUgcmlnaHRcbiAgICAgICAgICAgIG5lYXJieSA9IG5leHRfbmVhcmJ5O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVnaW9ucyhvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVnaW9uSXRlcmF0b3IodGhpcywgb3B0aW9ucyk7XG4gICAgfVxuXG59XG5cblxuLypcbiAgICBJdGVyYXRlIHJlZ2lvbnMgb2YgaW5kZXggZnJvbSBsZWZ0IHRvIHJpZ2h0XG5cbiAgICBJdGVyYXRpb24gbGltaXRlZCB0byBpbnRlcnZhbCBbc3RhcnQsIHN0b3BdIG9uIHRoZSB0aW1lbGluZS5cbiAgICBSZXR1cm5zIGxpc3Qgb2YgaXRlbS1saXN0cy5cbiAgICBvcHRpb25zXG4gICAgLSBzdGFydFxuICAgIC0gc3RvcFxuICAgIC0gaW5jbHVkZUVtcHR5XG4qL1xuXG5jbGFzcyBSZWdpb25JdGVyYXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbmRleCwgb3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge1xuICAgICAgICAgICAgc3RhcnQ9LUluZmluaXR5LCBcbiAgICAgICAgICAgIHN0b3A9SW5maW5pdHksIFxuICAgICAgICAgICAgaW5jbHVkZUVtcHR5PXRydWVcbiAgICAgICAgfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzdGFydCA+IHN0b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciAoXCJzdG9wIG11c3QgYmUgbGFyZ2VyIHRoYW4gc3RhcnRcIiwgc3RhcnQsIHN0b3ApXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faW5kZXggPSBpbmRleDtcbiAgICAgICAgdGhpcy5fc3RhcnQgPSBbc3RhcnQsIDBdO1xuICAgICAgICB0aGlzLl9zdG9wID0gW3N0b3AsIDBdO1xuXG4gICAgICAgIGlmIChpbmNsdWRlRW1wdHkpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbmRpdGlvbiA9ICgpID0+IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jb25kaXRpb24gPSAoY2VudGVyKSA9PiBjZW50ZXIubGVuZ3RoID4gMDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jdXJyZW50O1xuICAgIH1cblxuICAgIG5leHQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gaW5pdGlhbHNlXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50ID0gdGhpcy5faW5kZXgubmVhcmJ5KHRoaXMuX3N0YXJ0KTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jb25kaXRpb24odGhpcy5fY3VycmVudC5jZW50ZXIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZTp0aGlzLl9jdXJyZW50LCBkb25lOmZhbHNlfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBsZXQgb3B0aW9ucyA9IHtjb25kaXRpb246dGhpcy5fY29uZGl0aW9uLCBkaXJlY3Rpb246MX1cbiAgICAgICAgdGhpcy5fY3VycmVudCA9IHRoaXMuX2luZGV4LmZpbmRfcmVnaW9uKHRoaXMuX2N1cnJlbnQsIG9wdGlvbnMpO1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dW5kZWZpbmVkLCBkb25lOnRydWV9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZTp0aGlzLl9jdXJyZW50LCBkb25lOmZhbHNlfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn1cblxuLyoqXG4gKiBuZWFyYnlfZnJvbVxuICogXG4gKiB1dGlsaXR5IGZ1bmN0aW9uIGZvciBjcmVhdGluZyBhIG5lYXJieSBvYmplY3QgaW4gY2lyY3Vtc3RhbmNlc1xuICogd2hlcmUgdGhlcmUgYXJlIG92ZXJsYXBwaW5nIGludGVydmFscyBUaGlzIGNvdWxkIGJlIHdoZW4gYSBcbiAqIHN0YXRlcHJvdmlkZXIgZm9yIGEgbGF5ZXIgaGFzIG92ZXJsYXBwaW5nIGl0ZW1zIG9yIHdoZW4gXG4gKiBtdWx0aXBsZSBuZWFyYnkgaW5kZXhlcyBhcmUgbWVyZ2VkIGludG8gb25lLlxuICogXG4gKiBcbiAqIEBwYXJhbSB7Kn0gcHJldl9oaWdoIDogdGhlIHJpZ2h0bW9zdCBoaWdoLWVuZHBvaW50IGxlZnQgb2Ygb2Zmc2V0XG4gKiBAcGFyYW0geyp9IGNlbnRlcl9sb3dfbGlzdCA6IGxvdy1lbmRwb2ludHMgb2YgY2VudGVyXG4gKiBAcGFyYW0geyp9IGNlbnRlciA6IGNlbnRlclxuICogQHBhcmFtIHsqfSBjZW50ZXJfaGlnaF9saXN0IDogaGlnaC1lbmRwb2ludHMgb2YgY2VudGVyXG4gKiBAcGFyYW0geyp9IG5leHRfbG93IDogdGhlIGxlZnRtb3N0IGxvdy1lbmRwb2ludCByaWdodCBvZiBvZmZzZXRcbiAqIEByZXR1cm5zIFxuICovXG5cbmZ1bmN0aW9uIGNtcF9hc2NlbmRpbmcocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmNtcChwMSwgcDIpXG59XG5cbmZ1bmN0aW9uIGNtcF9kZXNjZW5kaW5nKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludC5jbXAocDIsIHAxKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbmVhcmJ5X2Zyb20gKFxuICAgIHByZXZfaGlnaCwgXG4gICAgY2VudGVyX2xvd19saXN0LCBcbiAgICBjZW50ZXIsXG4gICAgY2VudGVyX2hpZ2hfbGlzdCxcbiAgICBuZXh0X2xvdykge1xuXG4gICAgLy8gbmVhcmJ5XG4gICAgY29uc3QgcmVzdWx0ID0ge2NlbnRlcn07XG5cbiAgICBpZiAoY2VudGVyLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgIC8vIGVtcHR5IGNlbnRlclxuICAgICAgICByZXN1bHQucmlnaHQgPSBuZXh0X2xvdztcbiAgICAgICAgcmVzdWx0LmxlZnQgPSBwcmV2X2hpZ2g7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gbm9uLWVtcHR5IGNlbnRlclxuICAgICAgICBcbiAgICAgICAgLy8gY2VudGVyIGhpZ2hcbiAgICAgICAgY2VudGVyX2hpZ2hfbGlzdC5zb3J0KGNtcF9hc2NlbmRpbmcpO1xuICAgICAgICBsZXQgbWluX2NlbnRlcl9oaWdoID0gY2VudGVyX2hpZ2hfbGlzdFswXTtcbiAgICAgICAgbGV0IG1heF9jZW50ZXJfaGlnaCA9IGNlbnRlcl9oaWdoX2xpc3Quc2xpY2UoLTEpWzBdO1xuICAgICAgICBsZXQgbXVsdGlwbGVfY2VudGVyX2hpZ2ggPSAhZW5kcG9pbnQuZXEobWluX2NlbnRlcl9oaWdoLCBtYXhfY2VudGVyX2hpZ2gpXG5cbiAgICAgICAgLy8gY2VudGVyIGxvd1xuICAgICAgICBjZW50ZXJfbG93X2xpc3Quc29ydChjbXBfZGVzY2VuZGluZyk7XG4gICAgICAgIGxldCBtYXhfY2VudGVyX2xvdyA9IGNlbnRlcl9sb3dfbGlzdFswXTtcbiAgICAgICAgbGV0IG1pbl9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0LnNsaWNlKC0xKVswXTtcbiAgICAgICAgbGV0IG11bHRpcGxlX2NlbnRlcl9sb3cgPSAhZW5kcG9pbnQuZXEobWF4X2NlbnRlcl9sb3csIG1pbl9jZW50ZXJfbG93KVxuXG4gICAgICAgIC8vIG5leHQvcmlnaHRcbiAgICAgICAgaWYgKGVuZHBvaW50LmxlKG5leHRfbG93LCBtaW5fY2VudGVyX2hpZ2gpKSB7XG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSBuZXh0X2xvdztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IGVuZHBvaW50LmZsaXAobWluX2NlbnRlcl9oaWdoLCBcImxvd1wiKVxuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5uZXh0ID0gKG11bHRpcGxlX2NlbnRlcl9oaWdoKSA/IHJlc3VsdC5yaWdodCA6IG5leHRfbG93O1xuXG4gICAgICAgIC8vIHByZXYvbGVmdFxuICAgICAgICBpZiAoZW5kcG9pbnQuZ2UocHJldl9oaWdoLCBtYXhfY2VudGVyX2xvdykpIHtcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gcHJldl9oaWdoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSBlbmRwb2ludC5mbGlwKG1heF9jZW50ZXJfbG93LCBcImhpZ2hcIik7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LnByZXYgPSAobXVsdGlwbGVfY2VudGVyX2xvdykgPyByZXN1bHQubGVmdCA6IHByZXZfaGlnaDtcblxuICAgIH1cblxuICAgIC8vIGludGVydmFsIGZyb20gbGVmdC9yaWdodFxuICAgIGxldCBsb3cgPSBlbmRwb2ludC5mbGlwKHJlc3VsdC5sZWZ0LCBcImxvd1wiKTtcbiAgICBsZXQgaGlnaCA9IGVuZHBvaW50LmZsaXAocmVzdWx0LnJpZ2h0LCBcImhpZ2hcIik7XG4gICAgcmVzdWx0Lml0diA9IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG4iLCIvKlxuXHRDb3B5cmlnaHQgMjAyMFxuXHRBdXRob3IgOiBJbmdhciBBcm50emVuXG5cblx0VGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFRpbWluZ3NyYyBtb2R1bGUuXG5cblx0VGltaW5nc3JjIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnlcblx0aXQgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5XG5cdHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yXG5cdChhdCB5b3VyIG9wdGlvbikgYW55IGxhdGVyIHZlcnNpb24uXG5cblx0VGltaW5nc3JjIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsXG5cdGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mXG5cdE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS4gIFNlZSB0aGVcblx0R05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG5cblx0WW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlXG5cdGFsb25nIHdpdGggVGltaW5nc3JjLiAgSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+LlxuKi9cblxuXG5cbi8qXG5cdEV2ZW50XG5cdC0gbmFtZTogZXZlbnQgbmFtZVxuXHQtIHB1Ymxpc2hlcjogdGhlIG9iamVjdCB3aGljaCBkZWZpbmVkIHRoZSBldmVudFxuXHQtIGluaXQ6IHRydWUgaWYgdGhlIGV2ZW50IHN1cHBwb3J0cyBpbml0IGV2ZW50c1xuXHQtIHN1YnNjcmlwdGlvbnM6IHN1YnNjcmlwdGlucyB0byB0aGlzIGV2ZW50XG5cbiovXG5cbmNsYXNzIEV2ZW50IHtcblxuXHRjb25zdHJ1Y3RvciAocHVibGlzaGVyLCBuYW1lLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLnB1Ymxpc2hlciA9IHB1Ymxpc2hlcjtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMuaW5pdCA9IChvcHRpb25zLmluaXQgPT09IHVuZGVmaW5lZCkgPyBmYWxzZSA6IG9wdGlvbnMuaW5pdDtcblx0XHR0aGlzLnN1YnNjcmlwdGlvbnMgPSBbXTtcblx0fVxuXG5cdC8qXG5cdFx0c3Vic2NyaWJlIHRvIGV2ZW50XG5cdFx0LSBzdWJzY3JpYmVyOiBzdWJzY3JpYmluZyBvYmplY3Rcblx0XHQtIGNhbGxiYWNrOiBjYWxsYmFjayBmdW5jdGlvbiB0byBpbnZva2Vcblx0XHQtIG9wdGlvbnM6XG5cdFx0XHRpbml0OiBpZiB0cnVlIHN1YnNjcmliZXIgd2FudHMgaW5pdCBldmVudHNcblx0Ki9cblx0c3Vic2NyaWJlIChjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdGlmICghY2FsbGJhY2sgfHwgdHlwZW9mIGNhbGxiYWNrICE9PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIG5vdCBhIGZ1bmN0aW9uXCIsIGNhbGxiYWNrKTtcblx0XHR9XG5cdFx0Y29uc3Qgc3ViID0gbmV3IFN1YnNjcmlwdGlvbih0aGlzLCBjYWxsYmFjaywgb3B0aW9ucyk7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zLnB1c2goc3ViKTtcblx0ICAgIC8vIEluaXRpYXRlIGluaXQgY2FsbGJhY2sgZm9yIHRoaXMgc3Vic2NyaXB0aW9uXG5cdCAgICBpZiAodGhpcy5pbml0ICYmIHN1Yi5pbml0KSB7XG5cdCAgICBcdHN1Yi5pbml0X3BlbmRpbmcgPSB0cnVlO1xuXHQgICAgXHRsZXQgc2VsZiA9IHRoaXM7XG5cdCAgICBcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgXHRcdGNvbnN0IGVBcmdzID0gc2VsZi5wdWJsaXNoZXIuZXZlbnRpZnlJbml0RXZlbnRBcmdzKHNlbGYubmFtZSkgfHwgW107XG5cdCAgICBcdFx0c3ViLmluaXRfcGVuZGluZyA9IGZhbHNlO1xuXHQgICAgXHRcdGZvciAobGV0IGVBcmcgb2YgZUFyZ3MpIHtcblx0ICAgIFx0XHRcdHNlbGYudHJpZ2dlcihlQXJnLCBbc3ViXSwgdHJ1ZSk7XG5cdCAgICBcdFx0fVxuXHQgICAgXHR9KTtcblx0ICAgIH1cblx0XHRyZXR1cm4gc3ViXG5cdH1cblxuXHQvKlxuXHRcdHRyaWdnZXIgZXZlbnRcblxuXHRcdC0gaWYgc3ViIGlzIHVuZGVmaW5lZCAtIHB1Ymxpc2ggdG8gYWxsIHN1YnNjcmlwdGlvbnNcblx0XHQtIGlmIHN1YiBpcyBkZWZpbmVkIC0gcHVibGlzaCBvbmx5IHRvIGdpdmVuIHN1YnNjcmlwdGlvblxuXHQqL1xuXHR0cmlnZ2VyIChlQXJnLCBzdWJzLCBpbml0KSB7XG5cdFx0bGV0IGVJbmZvLCBjdHg7XG5cdFx0Zm9yIChjb25zdCBzdWIgb2Ygc3Vicykge1xuXHRcdFx0Ly8gaWdub3JlIHRlcm1pbmF0ZWQgc3Vic2NyaXB0aW9uc1xuXHRcdFx0aWYgKHN1Yi50ZXJtaW5hdGVkKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0ZUluZm8gPSB7XG5cdFx0XHRcdHNyYzogdGhpcy5wdWJsaXNoZXIsXG5cdFx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdFx0c3ViOiBzdWIsXG5cdFx0XHRcdGluaXQ6IGluaXRcblx0XHRcdH1cblx0XHRcdGN0eCA9IHN1Yi5jdHggfHwgdGhpcy5wdWJsaXNoZXI7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzdWIuY2FsbGJhY2suY2FsbChjdHgsIGVBcmcsIGVJbmZvKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgRXJyb3IgaW4gJHt0aGlzLm5hbWV9OiAke3N1Yi5jYWxsYmFja30gJHtlcnJ9YCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0dW5zdWJzY3JpYmUgZnJvbSBldmVudFxuXHQtIHVzZSBzdWJzY3JpcHRpb24gcmV0dXJuZWQgYnkgcHJldmlvdXMgc3Vic2NyaWJlXG5cdCovXG5cdHVuc3Vic2NyaWJlKHN1Yikge1xuXHRcdGxldCBpZHggPSB0aGlzLnN1YnNjcmlwdGlvbnMuaW5kZXhPZihzdWIpO1xuXHRcdGlmIChpZHggPiAtMSkge1xuXHRcdFx0dGhpcy5zdWJzY3JpcHRpb25zLnNwbGljZShpZHgsIDEpO1xuXHRcdFx0c3ViLnRlcm1pbmF0ZSgpO1xuXHRcdH1cblx0fVxufVxuXG5cbi8qXG5cdFN1YnNjcmlwdGlvbiBjbGFzc1xuKi9cblxuY2xhc3MgU3Vic2NyaXB0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcihldmVudCwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXHRcdHRoaXMuZXZlbnQgPSBldmVudDtcblx0XHR0aGlzLm5hbWUgPSBldmVudC5uYW1lO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFja1xuXHRcdHRoaXMuaW5pdCA9IChvcHRpb25zLmluaXQgPT09IHVuZGVmaW5lZCkgPyB0aGlzLmV2ZW50LmluaXQgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSBmYWxzZTtcblx0XHR0aGlzLmN0eCA9IG9wdGlvbnMuY3R4O1xuXHR9XG5cblx0dGVybWluYXRlKCkge1xuXHRcdHRoaXMudGVybWluYXRlZCA9IHRydWU7XG5cdFx0dGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmV2ZW50LnVuc3Vic2NyaWJlKHRoaXMpO1xuXHR9XG59XG5cblxuLypcblxuXHRFVkVOVElGWSBJTlNUQU5DRVxuXG5cdEV2ZW50aWZ5IGJyaW5ncyBldmVudGluZyBjYXBhYmlsaXRpZXMgdG8gYW55IG9iamVjdC5cblxuXHRJbiBwYXJ0aWN1bGFyLCBldmVudGlmeSBzdXBwb3J0cyB0aGUgaW5pdGlhbC1ldmVudCBwYXR0ZXJuLlxuXHRPcHQtaW4gZm9yIGluaXRpYWwgZXZlbnRzIHBlciBldmVudCB0eXBlLlxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cbiovXG5cbmV4cG9ydCBmdW5jdGlvbiBldmVudGlmeUluc3RhbmNlIChvYmplY3QpIHtcblx0b2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAgPSBuZXcgTWFwKCk7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRyZXR1cm4gb2JqZWN0O1xufTtcblxuXG4vKlxuXHRFVkVOVElGWSBQUk9UT1RZUEVcblxuXHRBZGQgZXZlbnRpZnkgZnVuY3Rpb25hbGl0eSB0byBwcm90b3R5cGUgb2JqZWN0XG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlQcm90b3R5cGUoX3Byb3RvdHlwZSkge1xuXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5R2V0RXZlbnQob2JqZWN0LCBuYW1lKSB7XG5cdFx0Y29uc3QgZXZlbnQgPSBvYmplY3QuX19ldmVudGlmeV9ldmVudE1hcC5nZXQobmFtZSk7XG5cdFx0aWYgKGV2ZW50ID09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRXZlbnQgdW5kZWZpbmVkXCIsIG5hbWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gZXZlbnQ7XG5cdH1cblxuXHQvKlxuXHRcdERFRklORSBFVkVOVFxuXHRcdC0gdXNlZCBvbmx5IGJ5IGV2ZW50IHNvdXJjZVxuXHRcdC0gbmFtZTogbmFtZSBvZiBldmVudFxuXHRcdC0gb3B0aW9uczoge2luaXQ6dHJ1ZX0gc3BlY2lmaWVzIGluaXQtZXZlbnQgc2VtYW50aWNzIGZvciBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeURlZmluZShuYW1lLCBvcHRpb25zKSB7XG5cdFx0Ly8gY2hlY2sgdGhhdCBldmVudCBkb2VzIG5vdCBhbHJlYWR5IGV4aXN0XG5cdFx0aWYgKHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5oYXMobmFtZSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IGFscmVhZHkgZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2V2ZW50TWFwLnNldChuYW1lLCBuZXcgRXZlbnQodGhpcywgbmFtZSwgb3B0aW9ucykpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T05cblx0XHQtIHVzZWQgYnkgc3Vic2NyaWJlclxuXHRcdHJlZ2lzdGVyIGNhbGxiYWNrIG9uIGV2ZW50LlxuXHQqL1xuXHRmdW5jdGlvbiBvbihuYW1lLCBjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmliZShjYWxsYmFjaywgb3B0aW9ucyk7XG5cdH07XG5cblx0Lypcblx0XHRPRkZcblx0XHQtIHVzZWQgYnkgc3Vic2NyaWJlclxuXHRcdFVuLXJlZ2lzdGVyIGEgaGFuZGxlciBmcm9tIGEgc3BlY2ZpYyBldmVudCB0eXBlXG5cdCovXG5cdGZ1bmN0aW9uIG9mZihzdWIpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBzdWIubmFtZSkudW5zdWJzY3JpYmUoc3ViKTtcblx0fTtcblxuXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5U3Vic2NyaXB0aW9ucyhuYW1lKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSkuc3Vic2NyaXB0aW9ucztcblx0fVxuXG5cblxuXHQvKlxuXHRcdFRyaWdnZXIgbGlzdCBvZiBldmVudEl0ZW1zIG9uIG9iamVjdFxuXG5cdFx0ZXZlbnRJdGVtOiAge25hbWU6Li4sIGVBcmc6Li59XG5cblx0XHRjb3B5IGFsbCBldmVudEl0ZW1zIGludG8gYnVmZmVyLlxuXHRcdHJlcXVlc3QgZW1wdHlpbmcgdGhlIGJ1ZmZlciwgaS5lLiBhY3R1YWxseSB0cmlnZ2VyaW5nIGV2ZW50cyxcblx0XHRldmVyeSB0aW1lIHRoZSBidWZmZXIgZ29lcyBmcm9tIGVtcHR5IHRvIG5vbi1lbXB0eVxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXJBbGwoZXZlbnRJdGVtcykge1xuXHRcdGlmIChldmVudEl0ZW1zLmxlbmd0aCA9PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gbWFrZSB0cmlnZ2VyIGl0ZW1zXG5cdFx0Ly8gcmVzb2x2ZSBub24tcGVuZGluZyBzdWJzY3JpcHRpb25zIG5vd1xuXHRcdC8vIGVsc2Ugc3Vic2NyaXB0aW9ucyBtYXkgY2hhbmdlIGZyb20gcGVuZGluZyB0byBub24tcGVuZGluZ1xuXHRcdC8vIGJldHdlZW4gaGVyZSBhbmQgYWN0dWFsIHRyaWdnZXJpbmdcblx0XHQvLyBtYWtlIGxpc3Qgb2YgW2V2LCBlQXJnLCBzdWJzXSB0dXBsZXNcblx0XHRsZXQgdHJpZ2dlckl0ZW1zID0gZXZlbnRJdGVtcy5tYXAoKGl0ZW0pID0+IHtcblx0XHRcdGxldCB7bmFtZSwgZUFyZ30gPSBpdGVtO1xuXHRcdFx0bGV0IGV2ID0gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKTtcblx0XHRcdGxldCBzdWJzID0gZXYuc3Vic2NyaXB0aW9ucy5maWx0ZXIoc3ViID0+IHN1Yi5pbml0X3BlbmRpbmcgPT0gZmFsc2UpO1xuXHRcdFx0cmV0dXJuIFtldiwgZUFyZywgc3Vic107XG5cdFx0fSwgdGhpcyk7XG5cblx0XHQvLyBhcHBlbmQgdHJpZ2dlciBJdGVtcyB0byBidWZmZXJcblx0XHRjb25zdCBsZW4gPSB0cmlnZ2VySXRlbXMubGVuZ3RoO1xuXHRcdGNvbnN0IGJ1ZiA9IHRoaXMuX19ldmVudGlmeV9idWZmZXI7XG5cdFx0Y29uc3QgYnVmX2xlbiA9IHRoaXMuX19ldmVudGlmeV9idWZmZXIubGVuZ3RoO1xuXHRcdC8vIHJlc2VydmUgbWVtb3J5IC0gc2V0IG5ldyBsZW5ndGhcblx0XHR0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aCA9IGJ1Zl9sZW4gKyBsZW47XG5cdFx0Ly8gY29weSB0cmlnZ2VySXRlbXMgdG8gYnVmZmVyXG5cdFx0Zm9yIChsZXQgaT0wOyBpPGxlbjsgaSsrKSB7XG5cdFx0XHRidWZbYnVmX2xlbitpXSA9IHRyaWdnZXJJdGVtc1tpXTtcblx0XHR9XG5cdFx0Ly8gcmVxdWVzdCBlbXB0eWluZyBvZiB0aGUgYnVmZmVyXG5cdFx0aWYgKGJ1Zl9sZW4gPT0gMCkge1xuXHRcdFx0bGV0IHNlbGYgPSB0aGlzO1xuXHRcdFx0UHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0Zm9yIChsZXQgW2V2LCBlQXJnLCBzdWJzXSBvZiBzZWxmLl9fZXZlbnRpZnlfYnVmZmVyKSB7XG5cdFx0XHRcdFx0Ly8gYWN0dWFsIGV2ZW50IHRyaWdnZXJpbmdcblx0XHRcdFx0XHRldi50cmlnZ2VyKGVBcmcsIHN1YnMsIGZhbHNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxmLl9fZXZlbnRpZnlfYnVmZmVyID0gW107XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHQvKlxuXHRcdFRyaWdnZXIgbXVsdGlwbGUgZXZlbnRzIG9mIHNhbWUgdHlwZSAobmFtZSlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxpa2UobmFtZSwgZUFyZ3MpIHtcblx0XHRyZXR1cm4gdGhpcy5ldmVudGlmeVRyaWdnZXJBbGwoZUFyZ3MubWFwKGVBcmcgPT4ge1xuXHRcdFx0cmV0dXJuIHtuYW1lLCBlQXJnfTtcblx0XHR9KSk7XG5cdH1cblxuXHQvKlxuXHRcdFRyaWdnZXIgc2luZ2xlIGV2ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlcihuYW1lLCBlQXJnKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKFt7bmFtZSwgZUFyZ31dKTtcblx0fVxuXG5cdF9wcm90b3R5cGUuZXZlbnRpZnlEZWZpbmUgPSBldmVudGlmeURlZmluZTtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXIgPSBldmVudGlmeVRyaWdnZXI7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxpa2UgPSBldmVudGlmeVRyaWdnZXJBbGlrZTtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXJBbGwgPSBldmVudGlmeVRyaWdnZXJBbGw7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlTdWJzY3JpcHRpb25zID0gZXZlbnRpZnlTdWJzY3JpcHRpb25zO1xuXHRfcHJvdG90eXBlLm9uID0gb247XG5cdF9wcm90b3R5cGUub2ZmID0gb2ZmO1xufTtcblxuXG5leHBvcnQge2V2ZW50aWZ5SW5zdGFuY2UgYXMgYWRkVG9JbnN0YW5jZX07XG5leHBvcnQge2V2ZW50aWZ5UHJvdG90eXBlIGFzIGFkZFRvUHJvdG90eXBlfTtcblxuLypcblx0RXZlbnQgVmFyaWFibGVcblxuXHRPYmplY3RzIHdpdGggYSBzaW5nbGUgXCJjaGFuZ2VcIiBldmVudFxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50VmFyaWFibGUge1xuXG5cdGNvbnN0cnVjdG9yICh2YWx1ZSkge1xuXHRcdGV2ZW50aWZ5SW5zdGFuY2UodGhpcyk7XG5cdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHR0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcblx0fVxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5fdmFsdWV9O1xuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlICE9IHRoaXMuX3ZhbHVlKSB7XG5cdFx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuZXZlbnRpZnlQcm90b3R5cGUoRXZlbnRWYXJpYWJsZS5wcm90b3R5cGUpO1xuXG4vKlxuXHRFdmVudCBCb29sZWFuXG5cblxuXHROb3RlIDogaW1wbGVtZW50YXRpb24gdXNlcyBmYWxzaW5lc3Mgb2YgaW5wdXQgcGFyYW1ldGVyIHRvIGNvbnN0cnVjdG9yIGFuZCBzZXQoKSBvcGVyYXRpb24sXG5cdHNvIGV2ZW50Qm9vbGVhbigtMSkgd2lsbCBhY3R1YWxseSBzZXQgaXQgdG8gdHJ1ZSBiZWNhdXNlXG5cdCgtMSkgPyB0cnVlIDogZmFsc2UgLT4gdHJ1ZSAhXG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRCb29sZWFuIGV4dGVuZHMgRXZlbnRWYXJpYWJsZSB7XG5cdGNvbnN0cnVjdG9yKHZhbHVlKSB7XG5cdFx0c3VwZXIoQm9vbGVhbih2YWx1ZSkpO1xuXHR9XG5cblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdHN1cGVyLnZhbHVlID0gQm9vbGVhbih2YWx1ZSk7XG5cdH1cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gc3VwZXIudmFsdWV9O1xufVxuXG5cbi8qXG5cdG1ha2UgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gRXZlbnRCb29sZWFuIGNoYW5nZXNcblx0dmFsdWUuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQcm9taXNlKGV2ZW50T2JqZWN0LCBjb25kaXRpb25GdW5jKSB7XG5cdGNvbmRpdGlvbkZ1bmMgPSBjb25kaXRpb25GdW5jIHx8IGZ1bmN0aW9uKHZhbCkge3JldHVybiB2YWwgPT0gdHJ1ZX07XG5cdHJldHVybiBuZXcgUHJvbWlzZSAoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdGxldCBzdWIgPSBldmVudE9iamVjdC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdGlmIChjb25kaXRpb25GdW5jKHZhbHVlKSkge1xuXHRcdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHRcdFx0ZXZlbnRPYmplY3Qub2ZmKHN1Yik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufTtcblxuLy8gbW9kdWxlIGFwaVxuZXhwb3J0IGRlZmF1bHQge1xuXHRldmVudGlmeVByb3RvdHlwZSxcblx0ZXZlbnRpZnlJbnN0YW5jZSxcblx0RXZlbnRWYXJpYWJsZSxcblx0RXZlbnRCb29sZWFuLFxuXHRtYWtlUHJvbWlzZVxufTtcblxuIiwiXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTT1VSQ0UgUFJPUEVSVFkgKFNSQ1BST1ApXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9ucyBmb3IgZXh0ZW5kaW5nIGEgY2xhc3Mgd2l0aCBzdXBwb3J0IGZvciBcbiAqIGV4dGVybmFsIHNvdXJjZSBvbiBhIG5hbWVkIHByb3BlcnR5LlxuICogXG4gKiBvcHRpb246IG11dGFibGU6dHJ1ZSBtZWFucyB0aGF0IHByb3BlcnkgbWF5IGJlIHJlc2V0IFxuICogXG4gKiBzb3VyY2Ugb2JqZWN0IGlzIGFzc3VtZWQgdG8gc3VwcG9ydCB0aGUgY2FsbGJhY2sgaW50ZXJmYWNlLFxuICogb3IgYmUgYSBsaXN0IG9mIG9iamVjdHMgYWxsIHN1cHBvcnRpbmcgdGhlIGNhbGxiYWNrIGludGVyZmFjZVxuICovXG5cbmNvbnN0IE5BTUUgPSBcInNyY3Byb3BcIjtcbmNvbnN0IFBSRUZJWCA9IGBfXyR7TkFNRX1gO1xuXG5leHBvcnQgZnVuY3Rpb24gYWRkVG9JbnN0YW5jZSAob2JqZWN0KSB7XG4gICAgb2JqZWN0W2Ake1BSRUZJWH1gXSA9IG5ldyBNYXAoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlIChfcHJvdG90eXBlKSB7XG5cbiAgICBmdW5jdGlvbiByZWdpc3Rlcihwcm9wTmFtZSwgb3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge211dGFibGU9dHJ1ZX0gPSBvcHRpb25zO1xuICAgICAgICBjb25zdCBtYXAgPSB0aGlzW2Ake1BSRUZJWH1gXTsgXG4gICAgICAgIG1hcC5zZXQocHJvcE5hbWUsIHtcbiAgICAgICAgICAgIGluaXQ6ZmFsc2UsXG4gICAgICAgICAgICBtdXRhYmxlLFxuICAgICAgICAgICAgZW50aXR5OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBoYW5kbGVzOiBbXVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyByZWdpc3RlciBnZXR0ZXJzIGFuZCBzZXR0ZXJzXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wTmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1hcC5nZXQocHJvcE5hbWUpLmVudGl0eTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uIChlbnRpdHkpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1tgJHtOQU1FfV9jaGVja2BdKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eSA9IHRoaXNbYCR7TkFNRX1fY2hlY2tgXShwcm9wTmFtZSwgZW50aXR5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eSAhPSBtYXAuZ2V0KHByb3BOYW1lKS5lbnRpdHkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1tgJHtQUkVGSVh9X2F0dGFjaGBdKHByb3BOYW1lLCBlbnRpdHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXR0YXRjaChwcm9wTmFtZSwgZW50aXR5KSB7XG5cbiAgICAgICAgY29uc3QgbWFwID0gdGhpc1tgJHtQUkVGSVh9YF07XG4gICAgICAgIGNvbnN0IHN0YXRlID0gbWFwLmdldChwcm9wTmFtZSlcblxuICAgICAgICBpZiAoc3RhdGUuaW5pdCAmJiAhc3RhdGUubXV0YWJsZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3Byb3BOYW1lfSBjYW4gbm90IGJlIHJlYXNzaWduZWRgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGVudGl0aWVzID0gKEFycmF5LmlzQXJyYXkoZW50aXR5KSkgPyBlbnRpdHkgOiBbZW50aXR5XTtcblxuICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIGVudGl0aWVzXG4gICAgICAgIGlmIChzdGF0ZS5oYW5kbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2lkeCwgZV0gb2YgT2JqZWN0LmVudHJpZXMoZW50aXRpZXMpKSB7XG4gICAgICAgICAgICAgICAgZS5yZW1vdmVfY2FsbGJhY2soc3RhdGUuaGFuZGxlc1tpZHhdKTtcbiAgICAgICAgICAgIH0gICAgXG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUuaGFuZGxlcyA9IFtdO1xuXG4gICAgICAgIC8vIGF0dGF0Y2ggbmV3IGVudGl0eVxuICAgICAgICBzdGF0ZS5lbnRpdHkgPSBlbnRpdHk7XG4gICAgICAgIHN0YXRlLmluaXQgPSB0cnVlO1xuXG4gICAgICAgIC8vIHN1YnNjcmliZSB0byBjYWxsYmFjayBmcm9tIHNvdXJjZVxuICAgICAgICBpZiAodGhpc1tgJHtOQU1FfV9vbmNoYW5nZWBdKSB7XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gZnVuY3Rpb24gKGVBcmcpIHtcbiAgICAgICAgICAgICAgICB0aGlzW2Ake05BTUV9X29uY2hhbmdlYF0ocHJvcE5hbWUsIGVBcmcpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBlIG9mIGVudGl0aWVzKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUuaGFuZGxlcy5wdXNoKGUuYWRkX2NhbGxiYWNrKGhhbmRsZXIpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXNbYCR7TkFNRX1fb25jaGFuZ2VgXShwcm9wTmFtZSwgXCJyZXNldFwiKTsgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBhcGkgPSB7fTtcbiAgICBhcGlbYCR7TkFNRX1fcmVnaXN0ZXJgXSA9IHJlZ2lzdGVyO1xuICAgIGFwaVtgJHtQUkVGSVh9X2F0dGFjaGBdID0gYXR0YXRjaDtcbiAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG59XG5cbiIsImltcG9ydCB7IGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG5CQVNFIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qXG5cdEFic3RyYWN0IEJhc2UgQ2xhc3MgZm9yIFNlZ21lbnRzXG5cbiAgICBjb25zdHJ1Y3RvcihpbnRlcnZhbClcblxuICAgIC0gaW50ZXJ2YWw6IGludGVydmFsIG9mIHZhbGlkaXR5IG9mIHNlZ21lbnRcbiAgICAtIGR5bmFtaWM6IHRydWUgaWYgc2VnbWVudCBpcyBkeW5hbWljXG4gICAgLSB2YWx1ZShvZmZzZXQpOiB2YWx1ZSBvZiBzZWdtZW50IGF0IG9mZnNldFxuICAgIC0gcXVlcnkob2Zmc2V0KTogc3RhdGUgb2Ygc2VnbWVudCBhdCBvZmZzZXRcbiovXG5cbmV4cG9ydCBjbGFzcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2KSB7XG5cdFx0dGhpcy5faXR2ID0gaXR2O1xuXHR9XG5cblx0Z2V0IGl0digpIHtyZXR1cm4gdGhpcy5faXR2O31cblxuICAgIC8qKiBcbiAgICAgKiBpbXBsZW1lbnRlZCBieSBzdWJjbGFzc1xuICAgICAqIHJldHVybnMge3ZhbHVlLCBkeW5hbWljfTtcbiAgICAqL1xuICAgIHN0YXRlKG9mZnNldCkge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwibm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNvbnZlbmllbmNlIGZ1bmN0aW9uIHJldHVybmluZyB0aGUgc3RhdGUgb2YgdGhlIHNlZ21lbnRcbiAgICAgKiBAcGFyYW0geyp9IG9mZnNldCBcbiAgICAgKiBAcmV0dXJucyBcbiAgICAgKi9cbiAgICBxdWVyeShvZmZzZXQpIHtcbiAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19wb2ludCh0aGlzLl9pdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgIHJldHVybiB7Li4udGhpcy5zdGF0ZShvZmZzZXQpLCBvZmZzZXR9O1xuICAgICAgICB9IFxuICAgICAgICByZXR1cm4ge3ZhbHVlOiB1bmRlZmluZWQsIGR5bmFtaWM6ZmFsc2UsIG9mZnNldH07XG4gICAgfVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTEFZRVJTIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIExheWVyc1NlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG5cdFx0dGhpcy5fbGF5ZXJzID0gYXJncy5sYXllcnM7XG4gICAgICAgIHRoaXMuX3ZhbHVlX2Z1bmMgPSBhcmdzLnZhbHVlX2Z1bmNcblxuICAgICAgICAvLyBUT0RPIC0gZmlndXJlIG91dCBkeW5hbWljIGhlcmU/XG4gICAgfVxuXG5cdHN0YXRlKG9mZnNldCkge1xuICAgICAgICAvLyBUT0RPIC0gdXNlIHZhbHVlIGZ1bmNcbiAgICAgICAgLy8gZm9yIG5vdyAtIGp1c3QgdXNlIGZpcnN0IGxheWVyXG4gICAgICAgIHJldHVybiB7Li4udGhpcy5fbGF5ZXJzWzBdLnF1ZXJ5KG9mZnNldCksIG9mZnNldH07XG5cdH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBTVEFUSUMgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgU3RhdGljU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGRhdGEpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcblx0XHR0aGlzLl92YWx1ZSA9IGRhdGE7XG5cdH1cblxuXHRzdGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdGhpcy5fdmFsdWUsIGR5bmFtaWM6ZmFsc2V9XG5cdH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBNT1RJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLypcbiAgICBJbXBsZW1lbnRzIGRldGVybWluaXN0aWMgcHJvamVjdGlvbiBiYXNlZCBvbiBpbml0aWFsIGNvbmRpdGlvbnMgXG4gICAgLSBtb3Rpb24gdmVjdG9yIGRlc2NyaWJlcyBtb3Rpb24gdW5kZXIgY29uc3RhbnQgYWNjZWxlcmF0aW9uXG4qL1xuXG5leHBvcnQgY2xhc3MgTW90aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcbiAgICBcbiAgICBjb25zdHJ1Y3RvcihpdHYsIGRhdGEpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcbiAgICAgICAgY29uc3Qge1xuICAgICAgICAgICAgcG9zaXRpb246cDA9MCwgXG4gICAgICAgICAgICB2ZWxvY2l0eTp2MD0wLCBcbiAgICAgICAgICAgIGFjY2VsZXJhdGlvbjphMD0wLCBcbiAgICAgICAgICAgIHRpbWVzdGFtcDp0MD0wXG4gICAgICAgIH0gPSBkYXRhO1xuICAgICAgICAvLyBjcmVhdGUgbW90aW9uIHRyYW5zaXRpb25cbiAgICAgICAgdGhpcy5fcG9zX2Z1bmMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIGxldCBkID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHJldHVybiBwMCArIHYwKmQgKyAwLjUqYTAqZCpkO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLl92ZWxfZnVuYyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgbGV0IGQgPSB0cyAtIHQwO1xuICAgICAgICAgICAgcmV0dXJuIHYwICsgYTAqZDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9hY2NfZnVuYyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgcmV0dXJuIGEwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIGxldCBwb3MgPSB0aGlzLl9wb3NfZnVuYyhvZmZzZXQpO1xuICAgICAgICBsZXQgdmVsID0gdGhpcy5fdmVsX2Z1bmMob2Zmc2V0KTtcbiAgICAgICAgbGV0IGFjYyA9IHRoaXMuX2FjY19mdW5jKG9mZnNldCk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwb3NpdGlvbjogcG9zLFxuICAgICAgICAgICAgdmVsb2NpdHk6IHZlbCxcbiAgICAgICAgICAgIGFjY2VsZXJhdGlvbjogYWNjLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBvZmZzZXQsXG4gICAgICAgICAgICB2YWx1ZTogcG9zLFxuICAgICAgICAgICAgZHluYW1pYzogKHZlbCAhPSAwIHx8IGFjYyAhPSAwIClcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBUUkFOU0lUSU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBTdXBwb3J0ZWQgZWFzaW5nIGZ1bmN0aW9uc1xuICAgIFwiZWFzZS1pblwiOlxuICAgIFwiZWFzZS1vdXRcIjpcbiAgICBcImVhc2UtaW4tb3V0XCJcbiovXG5cbmZ1bmN0aW9uIGVhc2VpbiAodHMpIHtcbiAgICByZXR1cm4gTWF0aC5wb3codHMsMik7ICBcbn1cbmZ1bmN0aW9uIGVhc2VvdXQgKHRzKSB7XG4gICAgcmV0dXJuIDEgLSBlYXNlaW4oMSAtIHRzKTtcbn1cbmZ1bmN0aW9uIGVhc2Vpbm91dCAodHMpIHtcbiAgICBpZiAodHMgPCAuNSkge1xuICAgICAgICByZXR1cm4gZWFzZWluKDIgKiB0cykgLyAyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAoMiAtIGVhc2VpbigyICogKDEgLSB0cykpKSAvIDI7XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgVHJhbnNpdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG5cdFx0c3VwZXIoaXR2KTtcbiAgICAgICAgbGV0IHt2MCwgdjEsIGVhc2luZ30gPSBkYXRhO1xuICAgICAgICBsZXQgW3QwLCB0MV0gPSB0aGlzLl9pdHYuc2xpY2UoMCwyKTtcblxuICAgICAgICAvLyBjcmVhdGUgdGhlIHRyYW5zaXRpb24gZnVuY3Rpb25cbiAgICAgICAgdGhpcy5fZHluYW1pYyA9IHYxLXYwICE9IDA7XG4gICAgICAgIHRoaXMuX3RyYW5zID0gZnVuY3Rpb24gKHRzKSB7XG4gICAgICAgICAgICAvLyBjb252ZXJ0IHRzIHRvIFt0MCx0MV0tc3BhY2VcbiAgICAgICAgICAgIC8vIC0gc2hpZnQgZnJvbSBbdDAsdDFdLXNwYWNlIHRvIFswLCh0MS10MCldLXNwYWNlXG4gICAgICAgICAgICAvLyAtIHNjYWxlIGZyb20gWzAsKHQxLXQwKV0tc3BhY2UgdG8gWzAsMV0tc3BhY2VcbiAgICAgICAgICAgIHRzID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHRzID0gdHMvcGFyc2VGbG9hdCh0MS10MCk7XG4gICAgICAgICAgICAvLyBlYXNpbmcgZnVuY3Rpb25zIHN0cmV0Y2hlcyBvciBjb21wcmVzc2VzIHRoZSB0aW1lIHNjYWxlIFxuICAgICAgICAgICAgaWYgKGVhc2luZyA9PSBcImVhc2UtaW5cIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZWluKHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWFzaW5nID09IFwiZWFzZS1vdXRcIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZW91dCh0cyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVhc2luZyA9PSBcImVhc2UtaW4tb3V0XCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2Vpbm91dCh0cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBsaW5lYXIgdHJhbnNpdGlvbiBmcm9tIHYwIHRvIHYxLCBmb3IgdGltZSB2YWx1ZXMgWzAsMV1cbiAgICAgICAgICAgIHRzID0gTWF0aC5tYXgodHMsIDApO1xuICAgICAgICAgICAgdHMgPSBNYXRoLm1pbih0cywgMSk7XG4gICAgICAgICAgICByZXR1cm4gdjAgKyAodjEtdjApKnRzO1xuICAgICAgICB9XG5cdH1cblxuXHRzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdGhpcy5fdHJhbnMob2Zmc2V0KSwgZHluYW1pYzp0aGlzLl9keW5hbWljfVxuXHR9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBJTlRFUlBPTEFUSU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBGdW5jdGlvbiB0byBjcmVhdGUgYW4gaW50ZXJwb2xhdG9yIGZvciBuZWFyZXN0IG5laWdoYm9yIGludGVycG9sYXRpb24gd2l0aFxuICogZXh0cmFwb2xhdGlvbiBzdXBwb3J0LlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHR1cGxlcyAtIEFuIGFycmF5IG9mIFt2YWx1ZSwgb2Zmc2V0XSBwYWlycywgd2hlcmUgdmFsdWUgaXMgdGhlXG4gKiBwb2ludCdzIHZhbHVlIGFuZCBvZmZzZXQgaXMgdGhlIGNvcnJlc3BvbmRpbmcgb2Zmc2V0LlxuICogQHJldHVybnMge0Z1bmN0aW9ufSAtIEEgZnVuY3Rpb24gdGhhdCB0YWtlcyBhbiBvZmZzZXQgYW5kIHJldHVybnMgdGhlXG4gKiBpbnRlcnBvbGF0ZWQgb3IgZXh0cmFwb2xhdGVkIHZhbHVlLlxuICovXG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKHR1cGxlcykge1xuXG4gICAgaWYgKHR1cGxlcy5sZW5ndGggPCAxKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3IgKCkge3JldHVybiB1bmRlZmluZWQ7fVxuICAgIH0gZWxzZSBpZiAodHVwbGVzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3IgKCkge3JldHVybiB0dXBsZXNbMF1bMF07fVxuICAgIH1cblxuICAgIC8vIFNvcnQgdGhlIHR1cGxlcyBieSB0aGVpciBvZmZzZXRzXG4gICAgY29uc3Qgc29ydGVkVHVwbGVzID0gWy4uLnR1cGxlc10uc29ydCgoYSwgYikgPT4gYVsxXSAtIGJbMV0pO1xuICBcbiAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yKG9mZnNldCkge1xuICAgICAgLy8gSGFuZGxlIGV4dHJhcG9sYXRpb24gYmVmb3JlIHRoZSBmaXJzdCBwb2ludFxuICAgICAgaWYgKG9mZnNldCA8PSBzb3J0ZWRUdXBsZXNbMF1bMV0pIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbMF07XG4gICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzWzFdO1xuICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIC8vIEhhbmRsZSBleHRyYXBvbGF0aW9uIGFmdGVyIHRoZSBsYXN0IHBvaW50XG4gICAgICBpZiAob2Zmc2V0ID49IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMV1bMV0pIHtcbiAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDJdO1xuICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMV07XG4gICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgIH1cbiAgXG4gICAgICAvLyBGaW5kIHRoZSBuZWFyZXN0IHBvaW50cyB0byB0aGUgbGVmdCBhbmQgcmlnaHRcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc29ydGVkVHVwbGVzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICBpZiAob2Zmc2V0ID49IHNvcnRlZFR1cGxlc1tpXVsxXSAmJiBvZmZzZXQgPD0gc29ydGVkVHVwbGVzW2kgKyAxXVsxXSkge1xuICAgICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzW2ldO1xuICAgICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzW2kgKyAxXTtcbiAgICAgICAgICAvLyBMaW5lYXIgaW50ZXJwb2xhdGlvbiBmb3JtdWxhOiB5ID0geTEgKyAoICh4IC0geDEpICogKHkyIC0geTEpIC8gKHgyIC0geDEpIClcbiAgICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgXG4gICAgICAvLyBJbiBjYXNlIHRoZSBvZmZzZXQgZG9lcyBub3QgZmFsbCB3aXRoaW4gYW55IHJhbmdlIChzaG91bGQgYmUgY292ZXJlZCBieSB0aGUgcHJldmlvdXMgY29uZGl0aW9ucylcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfTtcbn1cbiAgXG5cbmV4cG9ydCBjbGFzcyBJbnRlcnBvbGF0aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuICAgIGNvbnN0cnVjdG9yKGl0diwgdHVwbGVzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIC8vIHNldHVwIGludGVycG9sYXRpb24gZnVuY3Rpb25cbiAgICAgICAgdGhpcy5fdHJhbnMgPSBpbnRlcnBvbGF0ZSh0dXBsZXMpO1xuICAgIH1cblxuICAgIHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl90cmFucyhvZmZzZXQpLCBkeW5hbWljOnRydWV9O1xuICAgIH1cbn1cblxuXG4iLCJpbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG5mdW5jdGlvbiBsdCAocDEsIHAyKSB7XG5cdHJldHVybiBlbmRwb2ludC5sdChlbmRwb2ludC5mcm9tX2lucHV0KHAxKSwgZW5kcG9pbnQuZnJvbV9pbnB1dChwMikpO1xufVxuZnVuY3Rpb24gZXEgKHAxLCBwMikge1xuXHRyZXR1cm4gZW5kcG9pbnQuZXEoZW5kcG9pbnQuZnJvbV9pbnB1dChwMSksIGVuZHBvaW50LmZyb21faW5wdXQocDIpKTtcbn1cbmZ1bmN0aW9uIGNtcCAocDEsIHAyKSB7XG5cdHJldHVybiBlbmRwb2ludC5jbXAoZW5kcG9pbnQuZnJvbV9pbnB1dChwMSksIGVuZHBvaW50LmZyb21faW5wdXQocDIpKTtcbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG5cdFNPUlRFRCBBUlJBWVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuXHRTb3J0ZWQgYXJyYXkgb2YgdmFsdWVzLlxuXHQtIEVsZW1lbnRzIGFyZSBzb3J0ZWQgaW4gYXNjZW5kaW5nIG9yZGVyLlxuXHQtIE5vIGR1cGxpY2F0ZXMgYXJlIGFsbG93ZWQuXG5cdC0gQmluYXJ5IHNlYXJjaCB1c2VkIGZvciBsb29rdXBcblxuXHR2YWx1ZXMgY2FuIGJlIHJlZ3VsYXIgbnVtYmVyIHZhbHVlcyAoZmxvYXQpIG9yIHBvaW50cyBbZmxvYXQsIHNpZ25dXG5cdFx0PmEgOiBbYSwgLTFdIC0gbGFyZ2VzdCB2YWx1ZSBzbWFsbGVyIHRoYW4gYVxuXHRcdGEgIDogW2EsIDBdICAtIGFcblx0XHRhPCA6IFthLCArMV0gLSBzbWFsbGVzdCB2YWx1ZSBsYXJnZXIgdGhhbiBhXG4qL1xuXG5leHBvcnQgY2xhc3MgU29ydGVkQXJyYXkge1xuXG5cdGNvbnN0cnVjdG9yKCl7XG5cdFx0dGhpcy5fYXJyYXkgPSBbXTtcblx0fVxuXG5cdGdldCBzaXplKCkge3JldHVybiB0aGlzLl9hcnJheS5sZW5ndGg7fVxuXHRnZXQgYXJyYXkoKSB7cmV0dXJuIHRoaXMuX2FycmF5O31cblx0Lypcblx0XHRmaW5kIGluZGV4IG9mIGdpdmVuIHZhbHVlXG5cblx0XHRyZXR1cm4gW2ZvdW5kLCBpbmRleF1cblxuXHRcdGlmIGZvdW5kIGlzIHRydWUsIHRoZW4gaW5kZXggaXMgdGhlIGluZGV4IG9mIHRoZSBmb3VuZCBvYmplY3Rcblx0XHRpZiBmb3VuZCBpcyBmYWxzZSwgdGhlbiBpbmRleCBpcyB0aGUgaW5kZXggd2hlcmUgdGhlIG9iamVjdCBzaG91bGRcblx0XHRiZSBpbnNlcnRlZFxuXG5cdFx0LSB1c2VzIGJpbmFyeSBzZWFyY2hcdFx0XG5cdFx0LSBhcnJheSBkb2VzIG5vdCBpbmNsdWRlIGFueSBkdXBsaWNhdGUgdmFsdWVzXG5cdCovXG5cdGluZGV4T2YodGFyZ2V0X3ZhbHVlKSB7XG5cdFx0bGV0IGxlZnRfaWR4ID0gMDtcblx0XHRsZXQgcmlnaHRfaWR4ID0gdGhpcy5fYXJyYXkubGVuZ3RoIC0gMTtcblx0XHR3aGlsZSAobGVmdF9pZHggPD0gcmlnaHRfaWR4KSB7XG5cdFx0XHRjb25zdCBtaWRfaWR4ID0gTWF0aC5mbG9vcigobGVmdF9pZHggKyByaWdodF9pZHgpIC8gMik7XG5cdFx0XHRsZXQgbWlkX3ZhbHVlID0gdGhpcy5fYXJyYXlbbWlkX2lkeF07XG5cdFx0XHRpZiAoZXEobWlkX3ZhbHVlLCB0YXJnZXRfdmFsdWUpKSB7XG5cdFx0XHRcdHJldHVybiBbdHJ1ZSwgbWlkX2lkeF07IC8vIFRhcmdldCBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgYXJyYXlcblx0XHRcdH0gZWxzZSBpZiAobHQobWlkX3ZhbHVlLCB0YXJnZXRfdmFsdWUpKSB7XG5cdFx0XHRcdCAgbGVmdF9pZHggPSBtaWRfaWR4ICsgMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIHJpZ2h0XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQgIHJpZ2h0X2lkeCA9IG1pZF9pZHggLSAxOyAvLyBNb3ZlIHNlYXJjaCByYW5nZSB0byB0aGUgbGVmdFxuXHRcdFx0fVxuXHRcdH1cblx0ICBcdHJldHVybiBbZmFsc2UsIGxlZnRfaWR4XTsgLy8gUmV0dXJuIHRoZSBpbmRleCB3aGVyZSB0YXJnZXQgc2hvdWxkIGJlIGluc2VydGVkXG5cdH1cblxuXHQvKlxuXHRcdGZpbmQgaW5kZXggb2Ygc21hbGxlc3QgdmFsdWUgd2hpY2ggaXMgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIHRhcmdldCB2YWx1ZVxuXHRcdHJldHVybnMgLTEgaWYgbm8gc3VjaCB2YWx1ZSBleGlzdHNcblx0Ki9cblx0Z2VJbmRleE9mKHRhcmdldF92YWx1ZSkge1xuXHRcdGxldCBbZm91bmQsIGlkeF0gPSB0aGlzLmluZGV4T2YodGFyZ2V0X3ZhbHVlKTtcblx0XHRyZXR1cm4gKGlkeCA8IHRoaXMuX2FycmF5Lmxlbmd0aCkgPyBpZHggOiAtMSAgXG5cdH1cblxuXHQvKlxuXHRcdGZpbmQgaW5kZXggb2YgbGFyZ2VzdCB2YWx1ZSB3aGljaCBpcyBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gdGFyZ2V0IHZhbHVlXG5cdFx0cmV0dXJucyAtMSBpZiBubyBzdWNoIHZhbHVlIGV4aXN0c1xuXHQqL1xuXHRsZUluZGV4T2YodGFyZ2V0X3ZhbHVlKSB7XG5cdFx0bGV0IFtmb3VuZCwgaWR4XSA9IHRoaXMuaW5kZXhPZih0YXJnZXRfdmFsdWUpO1xuXHRcdGlkeCA9IChmb3VuZCkgPyBpZHggOiBpZHgtMTtcblx0XHRyZXR1cm4gKGlkeCA+PSAwKSA/IGlkeCA6IC0xO1xuXHR9XG5cblx0Lypcblx0XHRmaW5kIGluZGV4IG9mIHNtYWxsZXN0IHZhbHVlIHdoaWNoIGlzIGdyZWF0ZXIgdGhhbiB0YXJnZXQgdmFsdWVcblx0XHRyZXR1cm5zIC0xIGlmIG5vIHN1Y2ggdmFsdWUgZXhpc3RzXG5cdCovXG5cdGd0SW5kZXhPZih0YXJnZXRfdmFsdWUpIHtcblx0XHRsZXQgW2ZvdW5kLCBpZHhdID0gdGhpcy5pbmRleE9mKHRhcmdldF92YWx1ZSk7XG5cdFx0aWR4ID0gKGZvdW5kKSA/IGlkeCArIDEgOiBpZHg7XG5cdFx0cmV0dXJuIChpZHggPCB0aGlzLl9hcnJheS5sZW5ndGgpID8gaWR4IDogLTEgIFxuXHR9XG5cblx0Lypcblx0XHRmaW5kIGluZGV4IG9mIGxhcmdlc3QgdmFsdWUgd2hpY2ggaXMgbGVzcyB0aGFuIHRhcmdldCB2YWx1ZVxuXHRcdHJldHVybnMgLTEgaWYgbm8gc3VjaCB2YWx1ZSBleGlzdHNcblx0Ki9cblx0bHRJbmRleE9mKHRhcmdldF92YWx1ZSkge1xuXHRcdGxldCBbZm91bmQsIGlkeF0gPSB0aGlzLmluZGV4T2YodGFyZ2V0X3ZhbHVlKTtcblx0XHRpZHggPSBpZHgtMTtcblx0XHRyZXR1cm4gKGlkeCA+PSAwKSA/IGlkeCA6IC0xO1x0XG5cdH1cblxuXHQvKlxuXHRcdFVQREFURVxuXG5cdFx0YXBwcm9hY2ggLSBtYWtlIGFsbCBuZWNjZXNzYXJ5IGNoYW5nZXMgYW5kIHRoZW4gc29ydFxuXG5cdFx0YXMgYSBydWxlIG9mIHRodW1iIC0gY29tcGFyZWQgdG8gcmVtb3ZpbmcgYW5kIGluc2VydGluZyBlbGVtZW50c1xuXHRcdG9uZSBieSBvbmUsIHRoaXMgaXMgbW9yZSBlZmZlY3RpdmUgZm9yIGxhcmdlciBiYXRjaGVzLCBzYXkgPiAxMDAuXG5cdFx0RXZlbiB0aG91Z2ggdGhpcyBtaWdodCBub3QgYmUgdGhlIGNvbW1vbiBjYXNlLCBwZW5hbHRpZXMgZm9yXG5cdFx0Y2hvb3NpbmcgdGhlIHdyb25nIGFwcHJvYWNoIGlzIGhpZ2hlciBmb3IgbGFyZ2VyIGJhdGNoZXMuXG5cblx0XHRyZW1vdmUgaXMgcHJvY2Vzc2VkIGZpcnN0LCBzbyBpZiBhIHZhbHVlIGFwcGVhcnMgaW4gYm90aCBcblx0XHRyZW1vdmUgYW5kIGluc2VydCwgaXQgd2lsbCByZW1haW4uXG5cdFx0dW5kZWZpbmVkIHZhbHVlcyBjYW4gbm90IGJlIGluc2VydGVkIFxuXG5cdCovXG5cblx0dXBkYXRlKHJlbW92ZV9saXN0PVtdLCBpbnNlcnRfbGlzdD1bXSkge1xuXG5cdFx0Lypcblx0XHRcdHJlbW92ZVxuXG5cdFx0XHRyZW1vdmUgYnkgZmxhZ2dpbmcgZWxlbWVudHMgYXMgdW5kZWZpbmVkXG5cdFx0XHQtIGNvbGxlY3QgYWxsIGluZGV4ZXMgZmlyc3Rcblx0XHRcdC0gZmxhZyBhcyB1bmRlZmluZWQgb25seSBhZnRlciBhbGwgaW5kZXhlcyBoYXZlIGJlZW4gZm91bmQsXG5cdFx0XHQgIGFzIGluc2VydGluZyB1bmRlZmluZWQgdmFsdWVzIGJyZWFrZXMgdGhlIGFzc3VtcHRpb24gdGhhdFxuXHRcdFx0ICB0aGUgYXJyYXkgaXMgc29ydGVkLlxuXHRcdFx0LSBsYXRlciBzb3J0IHdpbGwgbW92ZSB0aGVtIHRvIHRoZSBlbmQsIHdoZXJlIHRoZXkgY2FuIGJlXG5cdFx0XHQgIHRydW5jYXRlZCBvZmZcblx0XHQqL1xuXHRcdGxldCByZW1vdmVfaWR4X2xpc3QgPSBbXTtcblx0XHRmb3IgKGxldCB2YWx1ZSBvZiByZW1vdmVfbGlzdCkge1xuXHRcdFx0bGV0IFtmb3VuZCwgaWR4XSA9IHRoaXMuaW5kZXhPZih2YWx1ZSk7XG5cdFx0XHRpZiAoZm91bmQpIHtcblx0XHRcdFx0cmVtb3ZlX2lkeF9saXN0LnB1c2goaWR4KTtcblx0XHRcdH1cdFx0XG5cdFx0fVxuXHRcdGZvciAobGV0IGlkeCBvZiByZW1vdmVfaWR4X2xpc3QpIHtcblx0XHRcdHRoaXMuX2FycmF5W2lkeF0gPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGxldCBhbnlfcmVtb3ZlcyA9IHJlbW92ZV9pZHhfbGlzdC5sZW5ndGggPiAwO1xuXG5cdFx0Lypcblx0XHRcdGluc2VydFxuXG5cdFx0XHRpbnNlcnQgbWlnaHQgaW50cm9kdWNlIGR1cGxpY2F0aW9ucywgZWl0aGVyIGJlY2F1c2Vcblx0XHRcdHRoZSBpbnNlcnQgbGlzdCBpbmNsdWRlcyBkdXBsaWNhdGVzLCBvciBiZWNhdXNlIHRoZVxuXHRcdFx0aW5zZXJ0IGxpc3QgZHVwbGljYXRlcyBwcmVleGlzdGluZyB2YWx1ZXMuXG5cblx0XHRcdEluc3RlYWQgb2YgbG9va2luZyB1cCBhbmQgY2hlY2tpbmcgZWFjaCBpbnNlcnQgdmFsdWUsXG5cdFx0XHR3ZSBpbnN0ZWFkIGluc2VydCBldmVyeXRoaW5nIGF0IHRoZSBlbmQgb2YgdGhlIGFycmF5LFxuXHRcdFx0YW5kIHJlbW92ZSBkdXBsaWNhdGVzIG9ubHkgYWZ0ZXIgd2UgaGF2ZSBzb3J0ZWQuXG5cdFx0Ki9cblx0XHRsZXQgYW55X2luc2VydHMgPSBpbnNlcnRfbGlzdC5sZW5ndGggPiAwO1xuXHRcdGlmIChhbnlfaW5zZXJ0cykge1xuXHRcdFx0Y29uY2F0X2luX3BsYWNlKHRoaXMuX2FycmF5LCBpbnNlcnRfbGlzdCk7XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRcdHNvcnRcblx0XHRcdHRoaXMgcHVzaGVzIGFueSB1bmRlZmluZWQgdmFsdWVzIHRvIHRoZSBlbmQgXG5cdFx0Ki9cblx0XHRpZiAoYW55X3JlbW92ZXMgfHwgYW55X2luc2VydHMpIHtcblx0XHRcdHRoaXMuX2FycmF5LnNvcnQoY21wKTtcblx0XHR9XG5cblx0XHQvKlxuXHRcdFx0cmVtb3ZlIHVuZGVmaW5lZCBcblx0XHRcdGFsbCB1bmRlZmluZWQgdmFsdWVzIGFyZSBwdXNoZWQgdG8gdGhlIGVuZFxuXHRcdCovXG5cdFx0aWYgKGFueV9yZW1vdmVzKSB7XG5cdFx0XHR0aGlzLl9hcnJheS5sZW5ndGggLT0gcmVtb3ZlX2lkeF9saXN0Lmxlbmd0aDtcblx0XHR9XG5cblx0XHQvKlxuXHRcdFx0cmVtb3ZlIGR1cGxpY2F0ZXMgZnJvbSBzb3J0ZWQgYXJyYXlcblx0XHRcdC0gYXNzdW1pbmcgdGhlcmUgYXJlIGdvaW5nIHRvIGJlIGZldyBkdXBsaWNhdGVzLFxuXHRcdFx0ICBpdCBpcyBvayB0byByZW1vdmUgdGhlbSBvbmUgYnkgb25lXG5cblx0XHQqL1xuXHRcdGlmIChhbnlfaW5zZXJ0cykge1xuXHRcdFx0cmVtb3ZlX2R1cGxpY2F0ZXModGhpcy5fYXJyYXkpO1xuXHRcdH1cblx0fVxuXG5cdC8qXG5cdFx0Z2V0IGVsZW1lbnQgYnkgaW5kZXhcblx0Ki9cblx0Z2V0X2J5X2luZGV4KGlkeCkge1xuXHRcdGlmIChpZHggPiAtMSAmJiBpZHggPCB0aGlzLl9hcnJheS5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB0aGlzLl9hcnJheVtpZHhdO1xuXHRcdH1cblx0fVxuXG5cdC8qXG5cdFx0bG9va3VwIHZhbHVlcyB3aXRoaW4gaW50ZXJ2YWxcblx0Ki9cblx0bG9va3VwKGl0dikge1xuXHRcdGlmIChpdHYgPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRpdHYgPSBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV07XG5cdFx0fVxuXHRcdGxldCBbcDAsIHAxXSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXR2KTtcblx0XHRsZXQgcDBfaWR4ID0gdGhpcy5nZUluZGV4T2YocDApO1xuXHRcdGxldCBwMV9pZHggPSB0aGlzLmxlSW5kZXhPZihwMSk7XG5cdFx0aWYgKHAwX2lkeCA9PSAtMSB8fCBwMV9pZHggPT0gLTEpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FycmF5LnNsaWNlKHAwX2lkeCwgcDFfaWR4KzEpO1xuXHRcdH1cblx0fVxuXG5cdGx0IChvZmZzZXQpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRfYnlfaW5kZXgodGhpcy5sdEluZGV4T2Yob2Zmc2V0KSk7XG5cdH1cblx0bGUgKG9mZnNldCkge1xuXHRcdHJldHVybiB0aGlzLmdldF9ieV9pbmRleCh0aGlzLmxlSW5kZXhPZihvZmZzZXQpKTtcblx0fVxuXHRnZXQgKG9mZnNldCkge1xuXHRcdGxldCBbZm91bmQsIGlkeF0gPSB0aGlzLmluZGV4T2Yob2Zmc2V0KTtcblx0XHRpZiAoZm91bmQpIHtcblx0XHRcdHJldHVybiB0aGlzLl9hcnJheVtpZHhdO1xuXHRcdH0gXG5cdH1cblx0Z3QgKG9mZnNldCkge1xuXHRcdHJldHVybiB0aGlzLmdldF9ieV9pbmRleCh0aGlzLmd0SW5kZXhPZihvZmZzZXQpKTtcblx0fVxuXHRnZSAob2Zmc2V0KSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0X2J5X2luZGV4KHRoaXMuZ2VJbmRleE9mKG9mZnNldCkpO1xuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXHRVVElMU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuXHRDb25jYXRpbmF0ZSB0d28gYXJyYXlzIGJ5IGFwcGVuZGluZyB0aGUgc2Vjb25kIGFycmF5IHRvIHRoZSBmaXJzdCBhcnJheS4gXG4qL1xuXG5mdW5jdGlvbiBjb25jYXRfaW5fcGxhY2UoZmlyc3RfYXJyLCBzZWNvbmRfYXJyKSB7XG5cdGNvbnN0IGZpcnN0X2Fycl9sZW5ndGggPSBmaXJzdF9hcnIubGVuZ3RoO1xuXHRjb25zdCBzZWNvbmRfYXJyX2xlbmd0aCA9IHNlY29uZF9hcnIubGVuZ3RoO1xuICBcdGZpcnN0X2Fyci5sZW5ndGggKz0gc2Vjb25kX2Fycl9sZW5ndGg7XG4gIFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzZWNvbmRfYXJyX2xlbmd0aDsgaSsrKSB7XG4gICAgXHRmaXJzdF9hcnJbZmlyc3RfYXJyX2xlbmd0aCArIGldID0gc2Vjb25kX2FycltpXTtcbiAgXHR9XG59XG5cbi8qXG5cdHJlbW92ZSBkdXBsaWNhdGVzIGluIGEgc29ydGVkIGFycmF5XG4qL1xuZnVuY3Rpb24gcmVtb3ZlX2R1cGxpY2F0ZXMoc29ydGVkX2Fycikge1xuXHRsZXQgaSA9IDA7XG5cdHdoaWxlICh0cnVlKSB7XG5cdFx0aWYgKGkgKyAxID49IHNvcnRlZF9hcnIubGVuZ3RoKSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdFx0aWYgKHNvcnRlZF9hcnJbaV0gPT0gc29ydGVkX2FycltpICsgMV0pIHtcblx0XHRcdHNvcnRlZF9hcnIuc3BsaWNlKGkgKyAxLCAxKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aSArPSAxO1xuXHRcdH1cblx0fVxufVxuIiwiaW1wb3J0IHsgaW50ZXJ2YWwsIGVuZHBvaW50IH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UsIG5lYXJieV9mcm9tIH0gZnJvbSBcIi4vbmVhcmJ5aW5kZXhfYmFzZS5qc1wiO1xuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX2Jhc2UuanNcIjtcbmltcG9ydCB7IFNvcnRlZEFycmF5IH0gZnJvbSBcIi4vc29ydGVkYXJyYXkuanNcIjtcblxuXG5jb25zdCBwZmkgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsO1xuY29uc3QgaWZwID0gaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHM7XG5cbmZ1bmN0aW9uIG1ha2Vfc2V0X2NhY2hlICgpIHtcblx0cmV0dXJuIG5ldyBNYXAoW1xuXHRcdFstMSwgbmV3IFNldCgpXSwgXG5cdFx0WzAsIG5ldyBTZXQoKV0sIFxuXHRcdFsxLCBuZXcgU2V0KCldXG5cdF0pO1xufVxuXG5cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKHN0YXRlUHJvdmlkZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICBpZiAoIShzdGF0ZVByb3ZpZGVyIGluc3RhbmNlb2YgU3RhdGVQcm92aWRlckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG11c3QgYmUgc3RhdGVwcm92aWRlciAke3N0YXRlUHJvdmlkZXJ9YCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fc3AgPSBzdGF0ZVByb3ZpZGVyO1xuXHRcdHRoaXMucmVmcmVzaCh7aXRlbXM6dGhpcy5fc3AuZ2V0X2l0ZW1zKCksIGNsZWFyOnRydWV9KVxuICAgIH1cblxuICAgIF9pbml0aWFsaXNlKCkge1xuICAgICAgICAvLyBzb3J0ZWQgYXJyYXlzIG9mIGVuZHBvaW50c1xuXHRcdHRoaXMuX2xvd19wb2ludHMgPSBuZXcgU29ydGVkQXJyYXkoKTtcblx0XHR0aGlzLl9oaWdoX3BvaW50cyA9IG5ldyBTb3J0ZWRBcnJheSgpO1xuXHRcdC8qIFxuXHRcdFx0aXRlbXMgYnkgZW5kcG9pbnRcblx0XHRcdFt2YWx1ZSwgc2lnbl0gPSBlbmRwb2ludFxuXHRcdFx0aXRlbXMuZ2V0KHNpZ24pLmdldCh2YWx1ZSkgPT0gW2l0ZW0sIC4uXVxuXHRcdFx0ZWFjaCBpdGVtIHdpbGwgdHlwaWNhbGx5IGFwcGVhciB0d2ljZSwgYXQgdHdvIGRpZmZlcmVudFxuXHRcdFx0ZW5kcG9pbnRzLlxuXHRcdCovXG5cdFx0dGhpcy5faXRlbXNtYXAgPSBuZXcgTWFwKFtcblx0XHRcdFstMSwgbmV3IE1hcCgpXSwgXG5cdFx0XHRbMCwgbmV3IE1hcCgpXSwgXG5cdFx0XHRbMSwgbmV3IE1hcCgpXVxuXHRcdF0pO1xuICAgIH1cblxuICAgIGdldCBzcmMgKCkge3JldHVybiB0aGlzLl9zcDt9XG5cbiAgICAvKlxuXHRcdG5lYXJieSAob2Zmc2V0KVxuICAgICovXG4gICAgbmVhcmJ5KG9mZnNldCkgeyBcbiAgICAgICAgb2Zmc2V0ID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuICAgICAgICBjb25zdCBjZW50ZXIgPSB0aGlzLl9jb3ZlcnMob2Zmc2V0KTtcbiAgICAgICAgY29uc3QgcHJldl9oaWdoID0gdGhpcy5faGlnaF9wb2ludHMubHQob2Zmc2V0KSB8fCBbLUluZmluaXR5LCAwXTtcbiAgICAgICAgY29uc3QgbmV4dF9sb3cgPSB0aGlzLl9sb3dfcG9pbnRzLmd0KG9mZnNldCkgfHwgW0luZmluaXR5LCAwXTtcbiAgICAgICAgY29uc3QgY2VudGVyX2xvd19saXN0ID0gW107XG4gICAgICAgIGNvbnN0IGNlbnRlcl9oaWdoX2xpc3QgPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGNlbnRlcikge1xuICAgICAgICAgICAgY29uc3QgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW0uaXR2KTtcbiAgICAgICAgICAgIGNlbnRlcl9oaWdoX2xpc3QucHVzaChoaWdoKTtcbiAgICAgICAgICAgIGNlbnRlcl9sb3dfbGlzdC5wdXNoKGxvdyk7ICAgIFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZWFyYnlfZnJvbShcbiAgICAgICAgICAgIHByZXZfaGlnaCwgXG4gICAgICAgICAgICBjZW50ZXJfbG93X2xpc3QsIFxuICAgICAgICAgICAgY2VudGVyLFxuICAgICAgICAgICAgY2VudGVyX2hpZ2hfbGlzdCxcbiAgICAgICAgICAgIG5leHRfbG93XG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgLypcblx0XHRyZWZyZXNoIGluZGV4IGJhc2VkIG9uIGNoYW5nZXNcbiAgICAqL1xuXHRyZWZyZXNoIChjaGFuZ2VzKSB7XG5cdFx0Y29uc3QgbG93X2NsZWFyX2NhY2hlID0gbWFrZV9zZXRfY2FjaGUoKTtcblx0XHRjb25zdCBoaWdoX2NsZWFyX2NhY2hlID0gbWFrZV9zZXRfY2FjaGUoKTtcblx0XHRjb25zdCBsb3dfY3JlYXRlX2NhY2hlID0gbWFrZV9zZXRfY2FjaGUoKTtcblx0XHRjb25zdCBoaWdoX2NyZWF0ZV9jYWNoZSA9IG1ha2Vfc2V0X2NhY2hlKCk7XG5cbiAgICAgICAgY29uc3Qge2l0ZW1zPVtdLCByZW1vdmU9W10sIGNsZWFyPWZhbHNlfSA9IGNoYW5nZXM7XG5cbiAgICAgICAgaWYgKGNsZWFyKSB7XG4gICAgICAgICAgICB0aGlzLl9pbml0aWFsaXNlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgcmVtb3ZlKSB7XG4gICAgICAgICAgICAgICAgbGV0IFtsb3csIGhpZ2hdID0gcGZpKGl0ZW0uaXR2KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW1vdmUobG93LCBpdGVtLCBsb3dfY2xlYXJfY2FjaGUpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbW92ZShoaWdoLCBpdGVtLCBoaWdoX2NsZWFyX2NhY2hlKTtcbiAgICAgICAgICAgIH0gICAgXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICAgICAgICAgIGxldCBbbG93LCBoaWdoXSA9IHBmaShpdGVtLml0dik7XG4gICAgICAgICAgICB0aGlzLl9pbnNlcnQobG93LCBpdGVtLCBsb3dfY3JlYXRlX2NhY2hlKTtcbiAgICAgICAgICAgIHRoaXMuX2luc2VydChoaWdoLCBpdGVtLCBoaWdoX2NyZWF0ZV9jYWNoZSk7XHRcbiAgICAgICAgfVxuXG5cdFx0Lypcblx0XHRcdGZsdXNoIGNoYW5nZXMgdG8gc29ydGVkIGFycmF5c1xuXHRcdFx0XG5cdFx0XHRFbnN1cmUgdGhhdCBsb3dfcG9pbnRzIGFuZCBoaWdoX3BvaW50cyBpbmRleGVzIFxuXHRcdFx0bWF0Y2ggZXhhY3RseSB3aXRoIGVuZHBvaW50cyBtYXBwZWQgdG8gaXRlbXMgaW4gX2l0ZW1zbWFwLlxuXHRcdFx0XG5cdFx0XHRUaGlzIGNvdWxkIGJlIHNvbHZlZCBieSByZWJ1aWxkaW5nIGluZGV4ZXMgZnJvbVxuXHRcdFx0aXRlbXNtYXAuIEhvd2V2ZXIsIGluIHRoZSBldmVudCB0aGF0IHRoZSBpbmRleGVzIGFyZSBsYXJnZSBhbmQgXG5cdFx0XHRjaGFuZ2VzIGFyZSBzbWFsbCwgd2UgY2FuIG9wdGltaXNlLCBiYXNlZCBvbiBjYWNoZXNcblxuXHRcdCovXG5cdFx0Y29uc3QgbG93X2NsZWFyID0gW107XG5cdFx0Y29uc3QgaGlnaF9jbGVhciA9IFtdO1xuXHRcdGNvbnN0IGxvd19jcmVhdGUgPSBbXTtcblx0XHRjb25zdCBoaWdoX2NyZWF0ZSA9IFtdO1xuXG5cdFx0Zm9yIChsZXQgc2lnbiBvZiBbLTEsIDAsIDFdKSB7XG5cblx0XHRcdC8vIGNsZWFyXG5cdFx0XHRjb25zdCBjbGVhcl90YXNrcyA9IFtcblx0XHRcdFx0W2xvd19jbGVhciwgbG93X2NsZWFyX2NhY2hlXSwgXG5cdFx0XHRcdFtoaWdoX2NsZWFyLCBoaWdoX2NsZWFyX2NhY2hlXVxuXHRcdFx0XVxuXHRcdFx0Zm9yIChjb25zdCBbYXJyYXksIGNhY2hlXSBvZiBjbGVhcl90YXNrcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHZhbHVlIG9mIGNhY2hlLmdldChzaWduKS52YWx1ZXMoKSkge1xuXHRcdFx0XHRcdC8vIHZlcmlmeSB0aGF0IGl0ZW1zbWFwIGlzIGluZGVlZCBlbXB0eVxuXHRcdFx0XHRcdGlmICghdGhpcy5faXRlbXNtYXAuZ2V0KHNpZ24pLmhhcyh2YWx1ZSkpIHtcblx0XHRcdFx0XHRcdGFycmF5LnB1c2goW3ZhbHVlLCBzaWduXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XHRcblx0XHRcdH1cblxuXHRcdFx0Ly8gY3JlYXRlXHRcdFx0XG5cdFx0XHRjb25zdCBjcmVhdGVfdGFza3MgPSBbXG5cdFx0XHRcdFtsb3dfY3JlYXRlLCBsb3dfY3JlYXRlX2NhY2hlXSwgXG5cdFx0XHRcdFtoaWdoX2NyZWF0ZSwgaGlnaF9jcmVhdGVfY2FjaGVdXG5cdFx0XHRdXG5cdFx0XHRmb3IgKGNvbnN0IFthcnJheSwgY2FjaGVdIG9mIGNyZWF0ZV90YXNrcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHZhbHVlIG9mIGNhY2hlLmdldChzaWduKS52YWx1ZXMoKSkge1xuXHRcdFx0XHRcdC8vIHZlcmlmeSB0aGF0IGl0ZW1zbWFwIGlzIGluZGVlZCBub24tZW1wdHlcblx0XHRcdFx0XHRpZiAodGhpcy5faXRlbXNtYXAuZ2V0KHNpZ24pLmhhcyh2YWx1ZSkpIHtcblx0XHRcdFx0XHRcdGFycmF5LnB1c2goW3ZhbHVlLCBzaWduXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XHRcdFxuXHRcdH1cblx0XHRcblx0XHQvLyB1cGRhdGUgaW5kZXhlc1xuICAgICAgICB0aGlzLl9sb3dfcG9pbnRzLnVwZGF0ZShsb3dfY2xlYXIsIGxvd19jcmVhdGUpO1xuXHRcdHRoaXMuX2hpZ2hfcG9pbnRzLnVwZGF0ZShoaWdoX2NsZWFyLCBoaWdoX2NyZWF0ZSk7XG5cdH1cblxuXHQvKlxuXHRcdHJlbW92ZSBpdGVtIGZvciBlbmRwb2ludFxuXHRcdC0gaWYgbGFzdCBpdGVtIHRvIGJlIHJlbW92ZWQgLSBhZGQgdG8gY2xlYXJlZCBlbmRwb2ludHNcblx0Ki9cbiAgICBfcmVtb3ZlKGVuZHBvaW50LCBpdGVtLCBjbGVhcmVkX2VuZHBvaW50cykge1xuICAgIFx0Y29uc3QgW3ZhbHVlLCBzaWduXSA9IGVuZHBvaW50O1xuICAgIFx0Y29uc3QgbWFwID0gdGhpcy5faXRlbXNtYXAuZ2V0KHNpZ24pO1xuICAgIFx0Y29uc3QgaXRlbXMgPSBtYXAuZ2V0KHZhbHVlKTsgICAgXHRcblx0XHRjbGVhcmVkX2VuZHBvaW50cy5nZXQoc2lnbikuYWRkKHZhbHVlKTtcbiAgICAgICAgaWYgKGl0ZW1zICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBcdC8vIHJlbW92ZSBpdGVtXG4gICAgICAgIFx0bGV0IGlkeCA9IGl0ZW1zLmZpbmRJbmRleCgoX2l0ZW0pID0+IHtcbiAgICAgICAgXHRcdHJldHVybiBfaXRlbS5pZCA9PSBpdGVtLmlkO1xuICAgICAgICBcdH0pO1xuICAgICAgICBcdGlmIChpZHggPiAtMSkge1xuICAgICAgICBcdFx0aXRlbXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIFx0fVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qXG5cdFx0aW5zZXJ0IGl0ZW0gZm9yIGVuZHBvaW50XG5cdFx0LSBpZiBmaXJzdCBpdGVtIHRvIGJlIGluc2VydGVkIC0gYWRkIHRvIGNyZWF0ZWQgZW5kcG9pbnRzXG4gICAgKi9cblx0X2luc2VydChlbmRwb2ludCwgaXRlbSwgY3JlYXRlZF9lbmRwb2ludHMpIHtcbiAgICBcdGNvbnN0IFt2YWx1ZSwgc2lnbl0gPSBlbmRwb2ludDtcbiAgICBcdGNvbnN0IG1hcCA9IHRoaXMuX2l0ZW1zbWFwLmdldChzaWduKTtcbiAgICAgIFx0Y29uc3QgaXRlbXMgPSBtYXAuZ2V0KHZhbHVlKTtcbiAgICAgICAgY3JlYXRlZF9lbmRwb2ludHMuZ2V0KHNpZ24pLmFkZCh2YWx1ZSk7XG4gICAgICAgIGlmIChpdGVtcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG1hcC5zZXQodmFsdWUsIFtpdGVtXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpdGVtcy5wdXNoKGl0ZW0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcblx0XHRjb3ZlcnMgOiByZXR1cm4gYWxsIGl0ZW1zIHdoaWNoIGNvdmVyIG9mZnNldFxuXG5cdFx0c2VhcmNoIGZyb20gb2Zmc2V0IHRvIHRoZSBsZWZ0IC0gdXNlIGxvd19wb2ludHMgaW5kZXhcblx0XHRUT0RPIC0gbWFrZSBtb3JlIGVmZmljaWVudCBieSBsaW1pdGluZyBzZWFyY2hcbiAgICAqL1xuICAgIF9jb3ZlcnMob2Zmc2V0KSB7XG4gICAgICAgIC8vIGNoZWNrIGFsbCBpdGVtcyB3aXRoIGxvdyB0byB0aGUgbGVmdCBvZiBvZmZzZXRcbiAgICBcdGNvbnN0IGNoZWNrZWRfaWRzID0gbmV3IFNldCgpO1xuICAgICAgICBjb25zdCBpdGVtcyA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IFt2YWx1ZSwgc2lnbl0gb2YgdGhpcy5fbG93X3BvaW50cy5hcnJheSkge1xuICAgICAgICAgICAgaWYgKGVuZHBvaW50Lmd0KFt2YWx1ZSwgc2lnbl0sIG9mZnNldCkpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLl9pdGVtc21hcC5nZXQoc2lnbikuZ2V0KHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGlmIChjaGVja2VkX2lkcy5oYXMoaXRlbS5pZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGl0ZW1cbiAgICAgICAgICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KGl0ZW0uaXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGl0ZW1zLnB1c2goaXRlbSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNoZWNrZWRfaWRzLmFkZChpdGVtLmlkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBcbiAgICAgICAgcmV0dXJuIGl0ZW1zO1xuICAgIH1cbn0iLCJpbXBvcnQgKiBhcyBldmVudGlmeSBmcm9tIFwiLi9hcGlfZXZlbnRpZnkuanNcIjtcbmltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL2FwaV9jYWxsYmFjay5qc1wiO1xuaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi9hcGlfc3JjcHJvcC5qc1wiO1xuaW1wb3J0ICogYXMgc2VnbWVudCBmcm9tIFwiLi9zZWdtZW50cy5qc1wiO1xuXG5pbXBvcnQgeyBpbnRlcnZhbCwgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IHJhbmdlLCB0b1N0YXRlIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX2Jhc2UuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4IH0gZnJvbSBcIi4vbmVhcmJ5aW5kZXguanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMYXllciBpcyBhYnN0cmFjdCBiYXNlIGNsYXNzIGZvciBMYXllcnNcbiAqIFxuICogTGF5ZXIgaW50ZXJmYWNlIGlzIGRlZmluZWQgYnkgKGluZGV4LCBDYWNoZUNsYXNzLCB2YWx1ZUZ1bmMpXG4gKi9cblxuZXhwb3J0IGNsYXNzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgY29uc3Qge0NhY2hlQ2xhc3M9TGF5ZXJDYWNoZX0gPSBvcHRpb25zO1xuICAgICAgICBjb25zdCB7dmFsdWVGdW5jLCBzdGF0ZUZ1bmN9ID0gb3B0aW9ucztcbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIC8vIGxheWVyIHF1ZXJ5IGFwaVxuICAgICAgICAvL2xheWVycXVlcnkuYWRkVG9JbnN0YW5jZSh0aGlzLCBDYWNoZUNsYXNzLCB7dmFsdWVGdW5jLCBzdGF0ZUZ1bmN9KTtcbiAgICAgICAgLy8gZGVmaW5lIGNoYW5nZSBldmVudFxuICAgICAgICBldmVudGlmeS5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcblxuICAgICAgICAvLyBpbmRleFxuICAgICAgICB0aGlzLl9pbmRleDtcbiAgICAgICAgLy8gY2FjaGVcbiAgICAgICAgdGhpcy5fQ2FjaGVDbGFzcyA9IENhY2hlQ2xhc3M7XG4gICAgICAgIHRoaXMuX2NhY2hlX29iamVjdDtcbiAgICAgICAgdGhpcy5fY2FjaGVfb2JqZWN0cyA9IFtdO1xuXG4gICAgICAgIC8vIHF1ZXJ5IG9wdGlvbnNcbiAgICAgICAgdGhpcy5fcXVlcnlPcHRpb25zID0ge3ZhbHVlRnVuYywgc3RhdGVGdW5jfTtcblxuICAgIH1cblxuICAgIC8vIGluZGV4XG4gICAgZ2V0IGluZGV4ICgpIHtyZXR1cm4gdGhpcy5faW5kZXh9XG4gICAgc2V0IGluZGV4IChpbmRleCkge3RoaXMuX2luZGV4ID0gaW5kZXh9XG5cbiAgICAvLyBxdWVyeU9wdGlvbnNcbiAgICBnZXQgcXVlcnlPcHRpb25zICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3F1ZXJ5T3B0aW9ucztcbiAgICB9XG5cbiAgICAvLyBjYWNoZVxuICAgIGdldCBjYWNoZSAoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jYWNoZV9vYmplY3QgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9jYWNoZV9vYmplY3QgPSBuZXcgdGhpcy5fQ2FjaGVDbGFzcyh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2FjaGVfb2JqZWN0O1xuICAgIH1cblxuICAgIGdldENhY2hlICgpIHtcbiAgICAgICAgY29uc3QgY2FjaGUgPSBuZXcgdGhpcy5fQ2FjaGVDbGFzcyh0aGlzKTtcbiAgICAgICAgdGhpcy5fY2FjaGVfb2JqZWN0cy5wdXNoKGNhY2hlKTtcbiAgICAgICAgcmV0dXJuIGNhY2hlO1xuICAgIH1cblxuICAgIGNsZWFyQ2FjaGVzKCkge1xuICAgICAgICBmb3IgKGNvbnN0IGNhY2hlIG9mIHRoaXMuX2NhY2hlX29iamVjdHMpe1xuICAgICAgICAgICAgY2FjaGUuY2xlYXIoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIHJlZ2lvbnMgKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW5kZXgucmVnaW9ucyhvcHRpb25zKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBTYW1wbGUgTGF5ZXIgYnkgdGltZWxpbmUgb2Zmc2V0IGluY3JlbWVudHNcbiAgICAgICAgcmV0dXJuIGxpc3Qgb2YgdHVwbGVzIFt2YWx1ZSwgb2Zmc2V0XVxuICAgICAgICBvcHRpb25zXG4gICAgICAgIC0gc3RhcnRcbiAgICAgICAgLSBzdG9wXG4gICAgICAgIC0gc3RlcFxuICAgICovXG4gICAgc2FtcGxlKG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtzdGFydD0tSW5maW5pdHksIHN0b3A9SW5maW5pdHksIHN0ZXA9MX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3RhcnQgPiBzdG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgKFwic3RvcCBtdXN0IGJlIGxhcmdlciB0aGFuIHN0YXJ0XCIsIHN0YXJ0LCBzdG9wKVxuICAgICAgICB9XG4gICAgICAgIHN0YXJ0ID0gW3N0YXJ0LCAwXTtcbiAgICAgICAgc3RvcCA9IFtzdG9wLCAwXTtcbiAgICAgICAgc3RhcnQgPSBlbmRwb2ludC5tYXgodGhpcy5pbmRleC5maXJzdCgpLCBzdGFydCk7XG4gICAgICAgIHN0b3AgPSBlbmRwb2ludC5taW4odGhpcy5pbmRleC5sYXN0KCksIHN0b3ApO1xuICAgICAgICBjb25zdCBjYWNoZSA9IHRoaXMuZ2V0Q2FjaGUoKTtcbiAgICAgICAgcmV0dXJuIHJhbmdlKHN0YXJ0WzBdLCBzdG9wWzBdLCBzdGVwLCB7aW5jbHVkZV9lbmQ6dHJ1ZX0pXG4gICAgICAgICAgICAubWFwKChvZmZzZXQpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gW2NhY2hlLnF1ZXJ5KG9mZnNldCkudmFsdWUsIG9mZnNldF07XG4gICAgICAgICAgICB9KTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShMYXllci5wcm90b3R5cGUpO1xuZXZlbnRpZnkuYWRkVG9Qcm90b3R5cGUoTGF5ZXIucHJvdG90eXBlKTtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUiBDQUNIRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBUaGlzIGltcGxlbWVudHMgYSBDYWNoZSB0byBiZSB1c2VkIHdpdGggTGF5ZXIgb2JqZWN0c1xuICogUXVlcnkgcmVzdWx0cyBhcmUgb2J0YWluZWQgZnJvbSB0aGUgY2FjaGUgb2JqZWN0cyBpbiB0aGVcbiAqIGxheWVyIGluZGV4IGFuZCBjYWNoZWQgb25seSBpZiB0aGV5IGRlc2NyaWJlIGEgc3RhdGljIHZhbHVlLiBcbiAqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJDYWNoZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihsYXllcikge1xuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IHN0YXRlXG4gICAgICAgIHRoaXMuX25lYXJieTtcbiAgICAgICAgLy8gY2FjaGVkIHJlc3VsdFxuICAgICAgICB0aGlzLl9zdGF0ZTtcbiAgICB9XG5cbiAgICBnZXQgc3JjKCkge3JldHVybiB0aGlzLl9sYXllcn07XG5cbiAgICAvKipcbiAgICAgKiBxdWVyeSBjYWNoZVxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBjb25zdCBuZWVkX25lYXJieSA9IChcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICFpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5fbmVhcmJ5Lml0diwgb2Zmc2V0KVxuICAgICAgICApO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICAhbmVlZF9uZWFyYnkgJiYgXG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSAhPSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICF0aGlzLl9zdGF0ZS5keW5hbWljXG4gICAgICAgICkge1xuICAgICAgICAgICAgLy8gY2FjaGUgaGl0XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuX3N0YXRlLCBvZmZzZXR9O1xuICAgICAgICB9XG4gICAgICAgIC8vIGNhY2hlIG1pc3NcbiAgICAgICAgaWYgKG5lZWRfbmVhcmJ5KSB7XG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPSB0aGlzLl9sYXllci5pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBwZXJmb3JtIHF1ZXJpZXNcbiAgICAgICAgY29uc3Qgc3RhdGVzID0gdGhpcy5fbmVhcmJ5LmNlbnRlci5tYXAoKGNhY2hlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gY2FjaGUucXVlcnkob2Zmc2V0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gdG9TdGF0ZSh0aGlzLl9uZWFyYnkuY2VudGVyLCBzdGF0ZXMsIG9mZnNldCwgdGhpcy5fbGF5ZXIucXVlcnlPcHRpb25zKVxuICAgICAgICAvLyBjYWNoZSBzdGF0ZSBvbmx5IGlmIG5vdCBkeW5hbWljXG4gICAgICAgIHRoaXMuX3N0YXRlID0gKHN0YXRlLmR5bmFtaWMpID8gdW5kZWZpbmVkIDogc3RhdGU7XG4gICAgICAgIHJldHVybiBzdGF0ZSAgICBcbiAgICB9XG5cbiAgICBjbGVhcigpIHtcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IHVuZGVmaW5lZDtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgSU5QVVQgTEFZRVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMYXllciB3aXRoIGEgU3RhdGVQcm92aWRlciBhcyBzcmNcbiAqL1xuXG5leHBvcnQgY2xhc3MgSW5wdXRMYXllciBleHRlbmRzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgY29uc3Qge3NyYywgdmFsdWVGdW5jLCBzdGF0ZUZ1bmN9ID0gb3B0aW9ucztcbiAgICAgICAgc3VwZXIoe0NhY2hlQ2xhc3M6SW5wdXRMYXllckNhY2hlLCB2YWx1ZUZ1bmMsIHN0YXRlRnVuY30pO1xuICAgICAgICAvLyBzZXR1cCBzcmMgcHJvcHRlcnR5XG4gICAgICAgIHNyY3Byb3AuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5zcmNwcm9wX3JlZ2lzdGVyKFwic3JjXCIpO1xuICAgICAgICAvLyBpbml0aWFsaXplXG4gICAgICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIH1cblxuICAgIHNyY3Byb3BfY2hlY2socHJvcE5hbWUsIHNyYykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzcmNcIikge1xuICAgICAgICAgICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgU3RhdGVQcm92aWRlckJhc2UpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcInNyY1wiIG11c3QgYmUgc3RhdGUgcHJvdmlkZXIgJHtzcmN9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3JjOyAgICBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNyY3Byb3Bfb25jaGFuZ2UocHJvcE5hbWUsIGVBcmcpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmluZGV4ID09IHVuZGVmaW5lZCB8fCBlQXJnID09IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXggPSBuZXcgTmVhcmJ5SW5kZXgodGhpcy5zcmMpO1xuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIGlmIChlQXJnICE9IFwicmVzZXRcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXgucmVmcmVzaChlQXJnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIik7XG4gICAgICAgIH0gICAgICAgIFxuICAgIH1cbn1cbnNyY3Byb3AuYWRkVG9Qcm90b3R5cGUoSW5wdXRMYXllci5wcm90b3R5cGUpO1xuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElOUFVUIExBWUVSIENBQ0hFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgTGF5ZXIgd2l0aCBhIFN0YXRlUHJvdmlkZXIgdXNlcyBhIHNwZWNpZmljIGNhY2hlIGltcGxlbWVudGF0aW9uLiAgICBcblxuICAgIFRoZSBjYWNoZSB3aWxsIGluc3RhbnRpYXRlIHNlZ21lbnRzIGNvcnJlc3BvbmRpbmcgdG9cbiAgICBpdGVtcyBpbiB0aGUgaW5kZXguIFxuKi9cblxuZXhwb3J0IGNsYXNzIElucHV0TGF5ZXJDYWNoZSB7XG4gICAgY29uc3RydWN0b3IobGF5ZXIpIHtcbiAgICAgICAgLy8gbGF5ZXJcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgLy8gY2FjaGVkIG5lYXJieSBvYmplY3RcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjYWNoZWQgc2VnbWVudFxuICAgICAgICB0aGlzLl9zZWdtZW50ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGdldCBzcmMoKSB7cmV0dXJuIHRoaXMuX2xheWVyfTtcblxuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBjb25zdCBjYWNoZV9taXNzID0gKFxuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgIWludGVydmFsLmNvdmVyc19wb2ludCh0aGlzLl9uZWFyYnkuaXR2LCBvZmZzZXQpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChjYWNoZV9taXNzKSB7XG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPSB0aGlzLl9sYXllci5pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgICAgIGxldCB7aXR2LCBjZW50ZXJ9ID0gdGhpcy5fbmVhcmJ5O1xuICAgICAgICAgICAgdGhpcy5fc2VnbWVudHMgPSBjZW50ZXIubWFwKChpdGVtKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxvYWRfc2VnbWVudChpdHYsIGl0ZW0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gcXVlcnkgc2VnbWVudHNcbiAgICAgICAgY29uc3Qgc3RhdGVzID0gdGhpcy5fc2VnbWVudHMubWFwKChzZWcpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBzZWcucXVlcnkob2Zmc2V0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0b1N0YXRlKHRoaXMuX3NlZ21lbnRzLCBzdGF0ZXMsIG9mZnNldCwgdGhpcy5fbGF5ZXIucXVlcnlPcHRpb25zKVxuICAgIH1cblxuICAgIGNsZWFyKCkge1xuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTE9BRCBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmZ1bmN0aW9uIGxvYWRfc2VnbWVudChpdHYsIGl0ZW0pIHtcbiAgICBsZXQge3R5cGU9XCJzdGF0aWNcIiwgZGF0YX0gPSBpdGVtO1xuICAgIGlmICh0eXBlID09IFwic3RhdGljXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LlN0YXRpY1NlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJ0cmFuc2l0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LlRyYW5zaXRpb25TZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwiaW50ZXJwb2xhdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5JbnRlcnBvbGF0aW9uU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5Nb3Rpb25TZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJ1bnJlY29nbml6ZWQgc2VnbWVudCB0eXBlXCIsIHR5cGUpO1xuICAgIH1cbn1cblxuXG5cbiIsImltcG9ydCB7IGVuZHBvaW50LCBpbnRlcnZhbCB9IGZyb20gXCIuLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSwgbmVhcmJ5X2Zyb20gfSBmcm9tIFwiLi4vbmVhcmJ5aW5kZXhfYmFzZS5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi4vbGF5ZXJzLmpzXCJcbmltcG9ydCAqIGFzIHNyY3Byb3AgZnJvbSBcIi4uL2FwaV9zcmNwcm9wLmpzXCI7XG5cblxuLyoqXG4gKiBDb252ZW5pZW5jZSBtZXJnZSBvcHRpb25zXG4gKi9cbmNvbnN0IG1lcmdlX29wdGlvbnMgPSB7XG4gICAgc3VtOiB7XG4gICAgICAgIHZhbHVlRnVuYzogZnVuY3Rpb24gKGluZm8pIHtcbiAgICAgICAgICAgIC8vIHJldHVybnMgdGhlIHN1bSBvZiB2YWx1ZXMgb2YgYWN0aXZlIGxheWVyc1xuICAgICAgICAgICAgcmV0dXJuIGluZm8uc3RhdGVzXG4gICAgICAgICAgICAgICAgLm1hcChzdGF0ZSA9PiBzdGF0ZS52YWx1ZSkgXG4gICAgICAgICAgICAgICAgLnJlZHVjZSgoYWNjLCB2YWx1ZSkgPT4gYWNjICsgdmFsdWUsIDApO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBzdGFjazoge1xuICAgICAgICBzdGF0ZUZ1bmM6IGZ1bmN0aW9uIChpbmZvKSB7XG4gICAgICAgICAgICAvLyByZXR1cm5zIHZhbHVlcyBmcm9tIGZpcnN0IGFjdGl2ZSBsYXllclxuICAgICAgICAgICAgcmV0dXJuIHsuLi5pbmZvLnN0YXRlc1swXX1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgYXJyYXk6IHtcbiAgICAgICAgdmFsdWVGdW5jOiBmdW5jdGlvbiAoaW5mbykge1xuICAgICAgICAgICAgLy8gcmV0dXJucyBhbiBhcnJheSB3aXRoIHZhbHVlcyBmcm9tIGFjdGl2ZSBsYXllcnNcbiAgICAgICAgICAgIHJldHVybiBpbmZvLnN0YXRlcy5tYXAoc3RhdGUgPT4gc3RhdGUudmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKlxuICogXG4gKiBUaGlzIGltcGxlbWVudHMgYSBtZXJnZSBvcGVyYXRpb24gZm9yIGxheWVycy5cbiAqIExpc3Qgb2Ygc291cmNlcyBpcyBpbW11dGFibGUuXG4gKiBcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gbWVyZ2UgKHNvdXJjZXMsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7dHlwZT1cIlwifSA9IG9wdGlvbnM7XG5cbiAgICBpZiAodHlwZSBpbiBtZXJnZV9vcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBuZXcgTWVyZ2VMYXllcihzb3VyY2VzLCBtZXJnZV9vcHRpb25zW3R5cGVdKVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgTWVyZ2VMYXllcihzb3VyY2VzLCBvcHRpb25zKTtcbiAgICB9XG59XG5cblxuY2xhc3MgTWVyZ2VMYXllciBleHRlbmRzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKHNvdXJjZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAgICAgLy8gc2V0dXAgc291cmNlcyBwcm9wZXJ0eVxuICAgICAgICBzcmNwcm9wLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuc3JjcHJvcF9yZWdpc3RlcihcInNvdXJjZXNcIiwge211dGFibGU6ZmFsc2V9KTtcbiAgICAgICAgdGhpcy5zb3VyY2VzID0gc291cmNlcztcbiAgICB9XG5cbiAgICBzcmNwcm9wX2NoZWNrKHByb3BOYW1lLCBzb3VyY2VzKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNvdXJjZXNcIikge1xuICAgICAgICAgICAgLy8gY2hlY2sgdGhhdCBzb3VyY2VzIGlzIGFycmF5IG9mIGxheWVyc1xuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHNvdXJjZXMpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzb3VyY2VzIG11c3QgYmUgYXJyYXkgJHtzb3VyY2VzfWApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBhbGxfbGF5ZXJzID0gc291cmNlcy5tYXAoKGUpID0+IGUgaW5zdGFuY2VvZiBMYXllcikuZXZlcnkoZSA9PiBlKTtcbiAgICAgICAgICAgIGlmICghYWxsX2xheWVycykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgc291cmNlcyBtdXN0IGFsbCBiZSBsYXllcnMgJHtzb3VyY2VzfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzb3VyY2VzO1xuICAgIH1cblxuICAgIHNyY3Byb3Bfb25jaGFuZ2UocHJvcE5hbWUsIGVBcmcpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic291cmNlc1wiKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleCA9PSB1bmRlZmluZWQgfHwgZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4ID0gbmV3IE1lcmdlSW5kZXgodGhpcy5zb3VyY2VzKVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIik7XG4gICAgICAgIH1cbiAgICB9XG59XG5zcmNwcm9wLmFkZFRvUHJvdG90eXBlKE1lcmdlTGF5ZXIucHJvdG90eXBlKTtcblxuXG5cbi8qKlxuICogTWVyZ2luZyBpbmRleGVzIGZyb20gbXVsdGlwbGUgc291cmNlcyBpbnRvIGEgc2luZ2xlIGluZGV4LlxuICogXG4gKiBBIHNvdXJjZSBpcyBhbiBvYmplY3Qgd2l0aCBhbiBpbmRleC5cbiAqIC0gbGF5ZXIgKGN1cnNvcilcbiAqIFxuICogVGhlIG1lcmdlZCBpbmRleCBnaXZlcyBhIHRlbXBvcmFsIHN0cnVjdHVyZSBmb3IgdGhlXG4gKiBjb2xsZWN0aW9uIG9mIHNvdXJjZXMsIGNvbXB1dGluZyBhIGxpc3Qgb2ZcbiAqIHNvdXJjZXMgd2hpY2ggYXJlIGRlZmluZWQgYXQgYSBnaXZlbiBvZmZzZXRcbiAqIFxuICogbmVhcmJ5KG9mZnNldCkuY2VudGVyIGlzIGEgbGlzdCBvZiBpdGVtc1xuICogW3tpdHYsIHNyY31dXG4gKiBcbiAqIEltcGxlbWVudGFpb24gaXMgc3RhdGVsZXNzLlxuICovXG5cbmZ1bmN0aW9uIGNtcF9hc2NlbmRpbmcocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmNtcChwMSwgcDIpXG59XG5cbmZ1bmN0aW9uIGNtcF9kZXNjZW5kaW5nKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludC5jbXAocDIsIHAxKVxufVxuXG5leHBvcnQgY2xhc3MgTWVyZ2VJbmRleCBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3Rvcihzb3VyY2VzKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX3NvdXJjZXMgPSBzb3VyY2VzO1xuICAgICAgICB0aGlzLl9jYWNoZXMgPSBuZXcgTWFwKHNvdXJjZXMubWFwKChzcmMpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbc3JjLCBzcmMuZ2V0Q2FjaGUoKV07XG4gICAgICAgIH0pKTtcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIG9mZnNldCA9IGVuZHBvaW50LmZyb21faW5wdXQob2Zmc2V0KTtcbiAgICAgICAgLy8gYWNjdW11bGF0ZSBuZWFyYnkgZnJvbSBhbGwgc291cmNlc1xuICAgICAgICBjb25zdCBwcmV2X2xpc3QgPSBbXSwgbmV4dF9saXN0ID0gW107XG4gICAgICAgIGNvbnN0IGNlbnRlciA9IFtdO1xuICAgICAgICBjb25zdCBjZW50ZXJfaGlnaF9saXN0ID0gW107XG4gICAgICAgIGNvbnN0IGNlbnRlcl9sb3dfbGlzdCA9IFtdXG4gICAgICAgIGZvciAobGV0IHNyYyBvZiB0aGlzLl9zb3VyY2VzKSB7XG4gICAgICAgICAgICBsZXQgbmVhcmJ5ID0gc3JjLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICAgICAgbGV0IHByZXZfcmVnaW9uID0gc3JjLmluZGV4LmZpbmRfcmVnaW9uKG5lYXJieSwge2RpcmVjdGlvbjotMX0pO1xuICAgICAgICAgICAgbGV0IG5leHRfcmVnaW9uID0gc3JjLmluZGV4LmZpbmRfcmVnaW9uKG5lYXJieSwge2RpcmVjdGlvbjoxfSk7XG4gICAgICAgICAgICBpZiAocHJldl9yZWdpb24gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcHJldl9saXN0LnB1c2goZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChwcmV2X3JlZ2lvbi5pdHYpWzFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChuZXh0X3JlZ2lvbiAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBuZXh0X2xpc3QucHVzaChlbmRwb2ludC5mcm9tX2ludGVydmFsKG5leHRfcmVnaW9uLml0dilbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5lYXJieS5jZW50ZXIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNlbnRlci5wdXNoKHRoaXMuX2NhY2hlcy5nZXQoc3JjKSk7XG4gICAgICAgICAgICAgICAgbGV0IFtsb3csIGhpZ2hdID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChuZWFyYnkuaXR2KTtcbiAgICAgICAgICAgICAgICBjZW50ZXJfaGlnaF9saXN0LnB1c2goaGlnaCk7XG4gICAgICAgICAgICAgICAgY2VudGVyX2xvd19saXN0LnB1c2gobG93KTsgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIGZpbmQgY2xvc2VzdCBlbmRwb2ludCB0byB0aGUgcmlnaHQgKG5vdCBpbiBjZW50ZXIpXG4gICAgICAgIG5leHRfbGlzdC5zb3J0KGNtcF9hc2NlbmRpbmcpO1xuICAgICAgICBjb25zdCBuZXh0X2xvdyA9IG5leHRfbGlzdFswXSB8fCBbSW5maW5pdHksIDBdO1xuXG4gICAgICAgIC8vIGZpbmQgY2xvc2VzdCBlbmRwb2ludCB0byB0aGUgbGVmdCAobm90IGluIGNlbnRlcilcbiAgICAgICAgcHJldl9saXN0LnNvcnQoY21wX2Rlc2NlbmRpbmcpO1xuICAgICAgICBjb25zdCBwcmV2X2hpZ2ggPSBwcmV2X2xpc3RbMF0gfHwgWy1JbmZpbml0eSwgMF07XG5cbiAgICAgICAgcmV0dXJuIG5lYXJieV9mcm9tKFxuICAgICAgICAgICAgICAgIHByZXZfaGlnaCwgXG4gICAgICAgICAgICAgICAgY2VudGVyX2xvd19saXN0LCBcbiAgICAgICAgICAgICAgICBjZW50ZXIsXG4gICAgICAgICAgICAgICAgY2VudGVyX2hpZ2hfbGlzdCxcbiAgICAgICAgICAgICAgICBuZXh0X2xvd1xuICAgICAgICAgICAgKTtcbiAgICB9XG59O1xuXG5cblxuIiwiaW1wb3J0IHsgZW5kcG9pbnQgfSBmcm9tIFwiLi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi4vbmVhcmJ5aW5kZXhfYmFzZS5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi4vbGF5ZXJzLmpzXCJcbmltcG9ydCAqIGFzIHNyY3Byb3AgZnJvbSBcIi4uL2FwaV9zcmNwcm9wLmpzXCI7XG5cbmZ1bmN0aW9uIHNoaWZ0ZWQocCwgb2Zmc2V0KSB7XG4gICAgaWYgKHAgPT0gdW5kZWZpbmVkIHx8ICFpc0Zpbml0ZShwKSkge1xuICAgICAgICAvLyBwIC0gbm8gc2tld1xuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZW9mIHAgPT0gXCJudW1iZXJcIikge1xuICAgICAgICAvLyBwIGlzIG51bWJlciAtIHNrZXdcbiAgICAgICAgcmV0dXJuIHAgKyBvZmZzZXQ7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHApICYmIHAubGVuZ3RoID4gMSkge1xuICAgICAgICAvLyBwIGlzIGVuZHBvaW50IC0gc2tldyB2YWx1ZVxuICAgICAgICBsZXQgW3ZhbCwgc2lnbl0gPSBwO1xuICAgICAgICByZXR1cm4gW3ZhbCArIG9mZnNldCwgc2lnbl07XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBTSElGVCBJTkRFWFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jbGFzcyBTaGlmdEluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yIChsYXllciwgc2tldykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICB0aGlzLl9za2V3ID0gc2tldztcbiAgICAgICAgdGhpcy5fY2FjaGUgPSBsYXllci5nZXRDYWNoZSgpO1xuXG4gICAgICAgIC8vIHNrZXdpbmcgY2FjaGUgb2JqZWN0XG4gICAgICAgIHRoaXMuX3NoaWZ0ZWRfY2FjaGUgPSB7XG4gICAgICAgICAgICBxdWVyeTogZnVuY3Rpb24gKG9mZnNldCkge1xuICAgICAgICAgICAgICAgIC8vIHNrZXcgcXVlcnkgKG5lZ2F0aXZlKSAtIG92ZXJyaWRlIHJlc3VsdCBvZmZzZXRcbiAgICAgICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuX2NhY2hlLnF1ZXJ5KHNoaWZ0ZWQob2Zmc2V0LCAtdGhpcy5fc2tldykpLCBvZmZzZXR9O1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gc2tld2luZyBpbmRleC5uZWFyYnlcbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIG9mZnNldCA9IGVuZHBvaW50LmZyb21faW5wdXQob2Zmc2V0KTtcbiAgICAgICAgLy8gc2tldyBxdWVyeSAobmVnYXRpdmUpXG4gICAgICAgIGNvbnN0IG5lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShzaGlmdGVkKG9mZnNldCwgLXRoaXMuX3NrZXcpKTtcbiAgICAgICAgLy8gc2tldyByZXN1bHQgKHBvc2l0aXZlKSBcbiAgICAgICAgY29uc3QgaXR2ID0gbmVhcmJ5Lml0di5zbGljZSgpO1xuICAgICAgICBpdHZbMF0gPSBzaGlmdGVkKG5lYXJieS5pdHZbMF0sIHRoaXMuX3NrZXcpO1xuICAgICAgICBpdHZbMV0gPSBzaGlmdGVkKG5lYXJieS5pdHZbMV0sIHRoaXMuX3NrZXcpXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpdHYsXG4gICAgICAgICAgICBsZWZ0OiBzaGlmdGVkKG5lYXJieS5sZWZ0LCB0aGlzLl9za2V3KSxcbiAgICAgICAgICAgIHJpZ2h0OiBzaGlmdGVkKG5lYXJieS5yaWdodCwgdGhpcy5fc2tldyksXG4gICAgICAgICAgICBjZW50ZXI6IG5lYXJieS5jZW50ZXIubWFwKCgpID0+IHRoaXMuX3NoaWZ0ZWRfY2FjaGUpXG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNISUZUIExBWUVSXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuY2xhc3MgU2hpZnRMYXllciBleHRlbmRzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKGxheWVyLCBza2V3LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgICB0aGlzLl9za2V3ID0gc2tldztcbiAgICAgICAgLy8gc2V0dXAgc3JjIHByb3B0ZXJ0eVxuICAgICAgICBzcmNwcm9wLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuc3JjcHJvcF9yZWdpc3RlcihcInNyY1wiKTtcbiAgICAgICAgdGhpcy5zcmMgPSBsYXllcjtcbiAgICB9XG5cbiAgICBzcmNwcm9wX2NoZWNrKHByb3BOYW1lLCBzcmMpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIExheWVyICR7c3JjfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNyYzsgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzcmNwcm9wX29uY2hhbmdlKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleCA9PSB1bmRlZmluZWQgfHwgZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4ID0gbmV3IFNoaWZ0SW5kZXgodGhpcy5zcmMsIHRoaXMuX3NrZXcpXG4gICAgICAgICAgICB9IFxuICAgICAgICAgICAgdGhpcy5jbGVhckNhY2hlcygpO1xuICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiKTsgICAgXG4gICAgICAgIH1cbiAgICB9XG59XG5zcmNwcm9wLmFkZFRvUHJvdG90eXBlKFNoaWZ0TGF5ZXIucHJvdG90eXBlKTtcblxuLyoqXG4gKiBTa2V3aW5nIGEgTGF5ZXIgYnkgYW4gb2Zmc2V0XG4gKiBcbiAqIGEgcG9zaXRpdmUgdmFsdWUgZm9yIG9mZnNldCBtZWFucyB0aGF0XG4gKiB0aGUgbGF5ZXIgaXMgc2hpZnRlZCB0byB0aGUgcmlnaHQgb24gdGhlIHRpbWVsaW5lXG4gKiBcbiAqIFxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiBzaGlmdCAobGF5ZXIsIG9mZnNldCkge1xuICAgIHJldHVybiBuZXcgU2hpZnRMYXllcihsYXllciwgb2Zmc2V0KTtcbn1cbiIsImltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL2FwaV9jYWxsYmFjay5qc1wiO1xuaW1wb3J0IHsgQ0xPQ0sgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENMT0NLIFBST1ZJREVSIEJBU0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogQmFzZSBjbGFzcyBmb3IgQ2xvY2tQcm92aWRlcnNcbiAqIFxuICogQ2xvY2sgUHJvdmlkZXJzIGltcGxlbWVudCB0aGUgY2FsbGJhY2tcbiAqIGludGVyZmFjZSB0byBiZSBjb21wYXRpYmxlIHdpdGggb3RoZXIgc3RhdGVcbiAqIHByb3ZpZGVycywgZXZlbiB0aG91Z2ggdGhleSBhcmUgbm90IHJlcXVpcmVkIHRvXG4gKiBwcm92aWRlIGFueSBjYWxsYmFja3MgYWZ0ZXIgY2xvY2sgYWRqdXN0bWVudHNcbiAqL1xuXG5leHBvcnQgY2xhc3MgQ2xvY2tQcm92aWRlckJhc2Uge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBjYWxsYmFjay5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgIH1cbiAgICBub3cgKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoQ2xvY2tQcm92aWRlckJhc2UucHJvdG90eXBlKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExPQ0FMIENMT0NLIFBST1ZJREVSXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jbGFzcyBMb2NhbENsb2NrUHJvdmlkZXIgZXh0ZW5kcyBDbG9ja1Byb3ZpZGVyQmFzZSB7XG4gICAgbm93ICgpIHtcbiAgICAgICAgcmV0dXJuIENMT0NLLm5vdygpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNvbnN0IGxvY2FsQ2xvY2tQcm92aWRlciA9IG5ldyBMb2NhbENsb2NrUHJvdmlkZXIoKTtcbiIsIlxuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX2Jhc2VcIjtcbmNvbnN0IE1FVEhPRFMgPSB7YXNzaWduLCBtb3ZlLCB0cmFuc2l0aW9uLCBpbnRlcnBvbGF0ZX07XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGNtZCAodGFyZ2V0KSB7XG4gICAgaWYgKCEodGFyZ2V0IGluc3RhbmNlb2YgU3RhdGVQcm92aWRlckJhc2UpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgdGFyZ2V0LnNyYyBtdXN0IGJlIHN0YXRlcHJvdmlkZXIgJHt0YXJnZXR9YCk7XG4gICAgfVxuICAgIGxldCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoTUVUSE9EUylcbiAgICAgICAgLm1hcCgoW25hbWUsIG1ldGhvZF0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiguLi5hcmdzKSB7IFxuICAgICAgICAgICAgICAgICAgICBsZXQgaXRlbXMgPSBtZXRob2QuY2FsbCh0aGlzLCAuLi5hcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldC51cGRhdGUoe2l0ZW1zLCBjbGVhcjp0cnVlfSk7ICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuICAgIHJldHVybiBPYmplY3QuZnJvbUVudHJpZXMoZW50cmllcyk7XG59XG5cbmZ1bmN0aW9uIGFzc2lnbih2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBpdGVtID0ge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdmFsdWUgICAgICAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbaXRlbV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBtb3ZlKHZlY3Rvcikge1xuICAgIGxldCBpdGVtID0ge1xuICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgdHlwZTogXCJtb3Rpb25cIixcbiAgICAgICAgZGF0YTogdmVjdG9yICBcbiAgICB9XG4gICAgcmV0dXJuIFtpdGVtXTtcbn1cblxuZnVuY3Rpb24gdHJhbnNpdGlvbih2MCwgdjEsIHQwLCB0MSwgZWFzaW5nKSB7XG4gICAgbGV0IGl0ZW1zID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIHQwLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdjBcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDAsIHQxLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcInRyYW5zaXRpb25cIixcbiAgICAgICAgICAgIGRhdGE6IHt2MCwgdjEsIHQwLCB0MSwgZWFzaW5nfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYxXG4gICAgICAgIH1cbiAgICBdXG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZSh0dXBsZXMpIHtcbiAgICBsZXQgW3YwLCB0MF0gPSB0dXBsZXNbMF07XG4gICAgbGV0IFt2MSwgdDFdID0gdHVwbGVzW3R1cGxlcy5sZW5ndGgtMV07XG5cbiAgICBsZXQgaXRlbXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgdDAsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MCwgdDEsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwiaW50ZXJwb2xhdGlvblwiLFxuICAgICAgICAgICAgZGF0YTogdHVwbGVzXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdjFcbiAgICAgICAgfVxuICAgIF0gICAgXG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5cblxuIiwiaW1wb3J0IHtkaXZtb2R9IGZyb20gXCIuL3V0aWwuanNcIjtcblxuLypcbiAgICBUaW1lb3V0IE1vbml0b3JcblxuICAgIFRpbWVvdXQgTW9uaXRvciBpcyBzaW1pbGFyIHRvIHNldEludGVydmFsLCBpbiB0aGUgc2Vuc2UgdGhhdCBcbiAgICBpdCBhbGxvd3MgY2FsbGJhY2tzIHRvIGJlIGZpcmVkIHBlcmlvZGljYWxseSBcbiAgICB3aXRoIGEgZ2l2ZW4gZGVsYXkgKGluIG1pbGxpcykuICBcbiAgICBcbiAgICBUaW1lb3V0IE1vbml0b3IgaXMgbWFkZSB0byBzYW1wbGUgdGhlIHN0YXRlIFxuICAgIG9mIGEgZHluYW1pYyBvYmplY3QsIHBlcmlvZGljYWxseS4gRm9yIHRoaXMgcmVhc29uLCBlYWNoIGNhbGxiYWNrIGlzIFxuICAgIGJvdW5kIHRvIGEgbW9uaXRvcmVkIG9iamVjdCwgd2hpY2ggd2UgaGVyZSBjYWxsIGEgdmFyaWFibGUuIFxuICAgIE9uIGVhY2ggaW52b2NhdGlvbiwgYSBjYWxsYmFjayB3aWxsIHByb3ZpZGUgYSBmcmVzaGx5IHNhbXBsZWQgXG4gICAgdmFsdWUgZnJvbSB0aGUgdmFyaWFibGUuXG5cbiAgICBUaGlzIHZhbHVlIGlzIGFzc3VtZWQgdG8gYmUgYXZhaWxhYmxlIGJ5IHF1ZXJ5aW5nIHRoZSB2YXJpYWJsZS4gXG5cbiAgICAgICAgdi5xdWVyeSgpIC0+IHt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0LCB0c31cblxuICAgIEluIGFkZGl0aW9uLCB0aGUgdmFyaWFibGUgb2JqZWN0IG1heSBzd2l0Y2ggYmFjayBhbmQgXG4gICAgZm9ydGggYmV0d2VlbiBkeW5hbWljIGFuZCBzdGF0aWMgYmVoYXZpb3IuIFRoZSBUaW1lb3V0IE1vbml0b3JcbiAgICB0dXJucyBwb2xsaW5nIG9mZiB3aGVuIHRoZSB2YXJpYWJsZSBpcyBubyBsb25nZXIgZHluYW1pYywgXG4gICAgYW5kIHJlc3VtZXMgcG9sbGluZyB3aGVuIHRoZSBvYmplY3QgYmVjb21lcyBkeW5hbWljLlxuXG4gICAgU3RhdGUgY2hhbmdlcyBhcmUgZXhwZWN0ZWQgdG8gYmUgc2lnbmFsbGVkIHRocm91Z2ggYSA8Y2hhbmdlPiBldmVudC5cblxuICAgICAgICBzdWIgPSB2Lm9uKFwiY2hhbmdlXCIsIGNhbGxiYWNrKVxuICAgICAgICB2Lm9mZihzdWIpXG5cbiAgICBDYWxsYmFja3MgYXJlIGludm9rZWQgb24gZXZlcnkgPGNoYW5nZT4gZXZlbnQsIGFzIHdlbGxcbiAgICBhcyBwZXJpb2RpY2FsbHkgd2hlbiB0aGUgb2JqZWN0IGlzIGluIDxkeW5hbWljPiBzdGF0ZS5cblxuICAgICAgICBjYWxsYmFjayh7dmFsdWUsIGR5bmFtaWMsIG9mZnNldCwgdHN9KVxuXG4gICAgRnVydGhlcm1vcmUsIGluIG9yZGVyIHRvIHN1cHBvcnQgY29uc2lzdGVudCByZW5kZXJpbmcgb2ZcbiAgICBzdGF0ZSBjaGFuZ2VzIGZyb20gbWFueSBkeW5hbWljIHZhcmlhYmxlcywgaXQgaXMgaW1wb3J0YW50IHRoYXRcbiAgICBjYWxsYmFja3MgYXJlIGludm9rZWQgYXQgdGhlIHNhbWUgdGltZSBhcyBtdWNoIGFzIHBvc3NpYmxlLCBzb1xuICAgIHRoYXQgY2hhbmdlcyB0aGF0IG9jY3VyIG5lYXIgaW4gdGltZSBjYW4gYmUgcGFydCBvZiB0aGUgc2FtZVxuICAgIHNjcmVlbiByZWZyZXNoLiBcblxuICAgIEZvciB0aGlzIHJlYXNvbiwgdGhlIFRpbWVvdXRNb25pdG9yIGdyb3VwcyBjYWxsYmFja3MgaW4gdGltZVxuICAgIGFuZCBpbnZva2VzIGNhbGxiYWNrcyBhdCBhdCBmaXhlZCBtYXhpbXVtIHJhdGUgKDIwSHovNTBtcykuXG4gICAgVGhpcyBpbXBsaWVzIHRoYXQgcG9sbGluZyBjYWxsYmFja3Mgd2lsbCBmYWxsIG9uIGEgc2hhcmVkIFxuICAgIHBvbGxpbmcgZnJlcXVlbmN5LlxuXG4gICAgQXQgdGhlIHNhbWUgdGltZSwgY2FsbGJhY2tzIG1heSBoYXZlIGluZGl2aWR1YWwgZnJlcXVlbmNpZXMgdGhhdFxuICAgIGFyZSBtdWNoIGxvd2VyIHJhdGUgdGhhbiB0aGUgbWF4aW11bSByYXRlLiBUaGUgaW1wbGVtZW50YXRpb25cbiAgICBkb2VzIG5vdCByZWx5IG9uIGEgZml4ZWQgNTBtcyB0aW1lb3V0IGZyZXF1ZW5jeSwgYnV0IGlzIHRpbWVvdXQgYmFzZWQsXG4gICAgdGh1cyB0aGVyZSBpcyBubyBwcm9jZXNzaW5nIG9yIHRpbWVvdXQgYmV0d2VlbiBjYWxsYmFja3MsIGV2ZW5cbiAgICBpZiBhbGwgY2FsbGJhY2tzIGhhdmUgbG93IHJhdGVzLlxuXG4gICAgSXQgaXMgc2FmZSB0byBkZWZpbmUgbXVsdGlwbGUgY2FsbGFiYWNrcyBmb3IgYSBzaW5nbGUgdmFyaWFibGUsIGVhY2hcbiAgICBjYWxsYmFjayB3aXRoIGEgZGlmZmVyZW50IHBvbGxpbmcgZnJlcXVlbmN5LlxuXG4gICAgb3B0aW9uc1xuICAgICAgICA8cmF0ZT4gLSBkZWZhdWx0IDUwOiBzcGVjaWZ5IG1pbmltdW0gZnJlcXVlbmN5IGluIG1zXG5cbiovXG5cblxuY29uc3QgUkFURV9NUyA9IDUwXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRJTUVPVVQgTU9OSVRPUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIEJhc2UgY2xhc3MgZm9yIFRpbWVvdXQgTW9uaXRvciBhbmQgRnJhbWVyYXRlIE1vbml0b3JcbiovXG5cbmNsYXNzIFRpbWVvdXRNb25pdG9yIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcblxuICAgICAgICB0aGlzLl9vcHRpb25zID0gT2JqZWN0LmFzc2lnbih7cmF0ZTogUkFURV9NU30sIG9wdGlvbnMpO1xuICAgICAgICBpZiAodGhpcy5fb3B0aW9ucy5yYXRlIDwgUkFURV9NUykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbGxlZ2FsIHJhdGUgJHtyYXRlfSwgbWluaW11bSByYXRlIGlzICR7UkFURV9NU31gKTtcbiAgICAgICAgfVxuICAgICAgICAvKlxuICAgICAgICAgICAgbWFwXG4gICAgICAgICAgICBoYW5kbGUgLT4ge2NhbGxiYWNrLCB2YXJpYWJsZSwgZGVsYXl9XG4gICAgICAgICAgICAtIHZhcmlhYmxlOiB0YXJnZXQgZm9yIHNhbXBsaW5nXG4gICAgICAgICAgICAtIGNhbGxiYWNrOiBmdW5jdGlvbih2YWx1ZSlcbiAgICAgICAgICAgIC0gZGVsYXk6IGJldHdlZW4gc2FtcGxlcyAod2hlbiB2YXJpYWJsZSBpcyBkeW5hbWljKVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zZXQgPSBuZXcgU2V0KCk7XG4gICAgICAgIC8qXG4gICAgICAgICAgICB2YXJpYWJsZSBtYXBcbiAgICAgICAgICAgIHZhcmlhYmxlIC0+IHtzdWIsIHBvbGxpbmcsIGhhbmRsZXM6W119XG4gICAgICAgICAgICAtIHN1YiBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAgICAgICAgIC0gcG9sbGluZzogdHJ1ZSBpZiB2YXJpYWJsZSBuZWVkcyBwb2xsaW5nXG4gICAgICAgICAgICAtIGhhbmRsZXM6IGxpc3Qgb2YgaGFuZGxlcyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICAvLyB2YXJpYWJsZSBjaGFuZ2UgaGFuZGxlclxuICAgICAgICB0aGlzLl9fb252YXJpYWJsZWNoYW5nZSA9IHRoaXMuX29udmFyaWFibGVjaGFuZ2UuYmluZCh0aGlzKTtcbiAgICB9XG5cbiAgICBiaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICAgICAgLy8gcmVnaXN0ZXIgYmluZGluZ1xuICAgICAgICBsZXQgaGFuZGxlID0ge2NhbGxiYWNrLCB2YXJpYWJsZSwgZGVsYXl9O1xuICAgICAgICB0aGlzLl9zZXQuYWRkKGhhbmRsZSk7XG4gICAgICAgIC8vIHJlZ2lzdGVyIHZhcmlhYmxlXG4gICAgICAgIGlmICghdGhpcy5fdmFyaWFibGVfbWFwLmhhcyh2YXJpYWJsZSkpIHtcbiAgICAgICAgICAgIGxldCBzdWIgPSB2YXJpYWJsZS5vbihcImNoYW5nZVwiLCB0aGlzLl9fb252YXJpYWJsZWNoYW5nZSk7XG4gICAgICAgICAgICBsZXQgaXRlbSA9IHtzdWIsIHBvbGxpbmc6ZmFsc2UsIGhhbmRsZXM6IFtoYW5kbGVdfTtcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5zZXQodmFyaWFibGUsIGl0ZW0pO1xuICAgICAgICAgICAgLy90aGlzLl9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSkuaGFuZGxlcy5wdXNoKGhhbmRsZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhhbmRsZTtcbiAgICB9XG5cbiAgICByZWxlYXNlKGhhbmRsZSkge1xuICAgICAgICAvLyBjbGVhbnVwXG4gICAgICAgIGxldCByZW1vdmVkID0gdGhpcy5fc2V0LmRlbGV0ZShoYW5kbGUpO1xuICAgICAgICBpZiAoIXJlbW92ZWQpIHJldHVybjtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2xlYW51cCB2YXJpYWJsZSBtYXBcbiAgICAgICAgbGV0IHZhcmlhYmxlID0gaGFuZGxlLnZhcmlhYmxlO1xuICAgICAgICBsZXQge3N1YiwgaGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IGlkeCA9IGhhbmRsZXMuaW5kZXhPZihoYW5kbGUpO1xuICAgICAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgICAgIGhhbmRsZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhhbmRsZXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIC8vIHZhcmlhYmxlIGhhcyBubyBoYW5kbGVzXG4gICAgICAgICAgICAvLyBjbGVhbnVwIHZhcmlhYmxlIG1hcFxuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLmRlbGV0ZSh2YXJpYWJsZSk7XG4gICAgICAgICAgICB2YXJpYWJsZS5vZmYoc3ViKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHZhcmlhYmxlIGVtaXRzIGEgY2hhbmdlIGV2ZW50XG4gICAgKi9cbiAgICBfb252YXJpYWJsZWNoYW5nZSAoZUFyZywgZUluZm8pIHtcbiAgICAgICAgbGV0IHZhcmlhYmxlID0gZUluZm8uc3JjO1xuICAgICAgICAvLyBkaXJlY3QgY2FsbGJhY2sgLSBjb3VsZCB1c2UgZUFyZyBoZXJlXG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IHN0YXRlID0gZUFyZztcbiAgICAgICAgLy8gcmVldmFsdWF0ZSBwb2xsaW5nXG4gICAgICAgIHRoaXMuX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSwgc3RhdGUpO1xuICAgICAgICAvLyBjYWxsYmFja3NcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIGhhbmRsZS5jYWxsYmFjayhzdGF0ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBzdGFydCBvciBzdG9wIHBvbGxpbmcgaWYgbmVlZGVkXG4gICAgKi9cbiAgICBfcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlLCBzdGF0ZSkge1xuICAgICAgICBsZXQgaXRlbSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQge3BvbGxpbmc6d2FzX3BvbGxpbmd9ID0gaXRlbTtcbiAgICAgICAgc3RhdGUgPSBzdGF0ZSB8fCB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICBsZXQgc2hvdWxkX2JlX3BvbGxpbmcgPSBzdGF0ZS5keW5hbWljO1xuICAgICAgICBpZiAoIXdhc19wb2xsaW5nICYmIHNob3VsZF9iZV9wb2xsaW5nKSB7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXRzKHZhcmlhYmxlKTtcbiAgICAgICAgfSBlbHNlIGlmICh3YXNfcG9sbGluZyAmJiAhc2hvdWxkX2JlX3BvbGxpbmcpIHtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fY2xlYXJfdGltZW91dHModmFyaWFibGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgc2V0IHRpbWVvdXQgZm9yIGFsbCBjYWxsYmFja3MgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgKi9cbiAgICBfc2V0X3RpbWVvdXRzKHZhcmlhYmxlKSB7XG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc2V0X3RpbWVvdXQoaGFuZGxlKSB7XG4gICAgICAgIGxldCBkZWx0YSA9IHRoaXMuX2NhbGN1bGF0ZV9kZWx0YShoYW5kbGUuZGVsYXkpO1xuICAgICAgICBsZXQgaGFuZGxlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZV90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHNldFRpbWVvdXQoaGFuZGxlciwgZGVsdGEpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGFkanVzdCBkZWxheSBzbyB0aGF0IGlmIGZhbGxzIG9uXG4gICAgICAgIHRoZSBtYWluIHRpY2sgcmF0ZVxuICAgICovXG4gICAgX2NhbGN1bGF0ZV9kZWx0YShkZWxheSkge1xuICAgICAgICBsZXQgcmF0ZSA9IHRoaXMuX29wdGlvbnMucmF0ZTtcbiAgICAgICAgbGV0IG5vdyA9IE1hdGgucm91bmQocGVyZm9ybWFuY2Uubm93KCkpO1xuICAgICAgICBsZXQgW25vd19uLCBub3dfcl0gPSBkaXZtb2Qobm93LCByYXRlKTtcbiAgICAgICAgbGV0IFtuLCByXSA9IGRpdm1vZChub3cgKyBkZWxheSwgcmF0ZSk7XG4gICAgICAgIGxldCB0YXJnZXQgPSBNYXRoLm1heChuLCBub3dfbiArIDEpKnJhdGU7XG4gICAgICAgIHJldHVybiB0YXJnZXQgLSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBjbGVhciBhbGwgdGltZW91dHMgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgKi9cbiAgICBfY2xlYXJfdGltZW91dHModmFyaWFibGUpIHtcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgaWYgKGhhbmRsZS50aWQgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGhhbmRsZS50aWQpO1xuICAgICAgICAgICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBoYW5kbGUgdGltZW91dFxuICAgICovXG4gICAgX2hhbmRsZV90aW1lb3V0KGhhbmRsZSkge1xuICAgICAgICAvLyBkcm9wIGlmIGhhbmRsZSB0aWQgaGFzIGJlZW4gY2xlYXJlZFxuICAgICAgICBpZiAoaGFuZGxlLnRpZCA9PSB1bmRlZmluZWQpIHJldHVybjtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2FsbGJhY2tcbiAgICAgICAgbGV0IHt2YXJpYWJsZX0gPSBoYW5kbGU7XG4gICAgICAgIGxldCBzdGF0ZSA9IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgIC8vIHJlc2NoZWR1bGUgdGltZW91dHMgZm9yIGNhbGxiYWNrc1xuICAgICAgICBpZiAoc3RhdGUuZHluYW1pYykge1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgbWFrZSBzdXJlIHBvbGxpbmcgc3RhdGUgaXMgYWxzbyBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMgd291bGQgb25seSBvY2N1ciBpZiB0aGUgdmFyaWFibGVcbiAgICAgICAgICAgICAgICB3ZW50IGZyb20gcmVwb3J0aW5nIGR5bmFtaWMgdHJ1ZSB0byBkeW5hbWljIGZhbHNlLFxuICAgICAgICAgICAgICAgIHdpdGhvdXQgZW1taXR0aW5nIGEgY2hhbmdlIGV2ZW50IC0gdGh1c1xuICAgICAgICAgICAgICAgIHZpb2xhdGluZyB0aGUgYXNzdW1wdGlvbi4gVGhpcyBwcmVzZXJ2ZXNcbiAgICAgICAgICAgICAgICBpbnRlcm5hbCBpbnRlZ3JpdHkgaSB0aGUgbW9uaXRvci5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBsZXQgaXRlbSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy9cbiAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHN0YXRlKTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgRlJBTUVSQVRFIE1PTklUT1JcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuXG5jbGFzcyBGcmFtZXJhdGVNb25pdG9yIGV4dGVuZHMgVGltZW91dE1vbml0b3Ige1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgICAgdGhpcy5faGFuZGxlO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHRpbWVvdXRzIGFyZSBvYnNvbGV0ZVxuICAgICovXG4gICAgX3NldF90aW1lb3V0cyh2YXJpYWJsZSkge31cbiAgICBfc2V0X3RpbWVvdXQoaGFuZGxlKSB7fVxuICAgIF9jYWxjdWxhdGVfZGVsdGEoZGVsYXkpIHt9XG4gICAgX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKSB7fVxuICAgIF9oYW5kbGVfdGltZW91dChoYW5kbGUpIHt9XG5cbiAgICBfb252YXJpYWJsZWNoYW5nZSAoZUFyZywgZUluZm8pIHtcbiAgICAgICAgc3VwZXIuX29udmFyaWFibGVjaGFuZ2UoZUFyZywgZUluZm8pO1xuICAgICAgICAvLyBraWNrIG9mZiBjYWxsYmFjayBsb29wIGRyaXZlbiBieSByZXF1ZXN0IGFuaW1hdGlvbmZyYW1lXG4gICAgICAgIHRoaXMuX2NhbGxiYWNrKCk7XG4gICAgfVxuXG4gICAgX2NhbGxiYWNrKCkge1xuICAgICAgICAvLyBjYWxsYmFjayB0byBhbGwgdmFyaWFibGVzIHdoaWNoIHJlcXVpcmUgcG9sbGluZ1xuICAgICAgICBsZXQgdmFyaWFibGVzID0gWy4uLnRoaXMuX3ZhcmlhYmxlX21hcC5lbnRyaWVzKCldXG4gICAgICAgICAgICAuZmlsdGVyKChbdmFyaWFibGUsIGl0ZW1dKSA9PiBpdGVtLnBvbGxpbmcpXG4gICAgICAgICAgICAubWFwKChbdmFyaWFibGUsIGl0ZW1dKSA9PiB2YXJpYWJsZSk7XG4gICAgICAgIGlmICh2YXJpYWJsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgLy8gY2FsbGJhY2tcbiAgICAgICAgICAgIGZvciAobGV0IHZhcmlhYmxlIG9mIHZhcmlhYmxlcykge1xuICAgICAgICAgICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgICAgICAgICBsZXQgcmVzID0gdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgICAgICAgICBoYW5kbGUuY2FsbGJhY2socmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBcbiAgICAgICAgICAgICAgICByZXF1ZXN0IG5leHQgY2FsbGJhY2sgYXMgbG9uZyBhcyBhdCBsZWFzdCBvbmUgdmFyaWFibGUgXG4gICAgICAgICAgICAgICAgaXMgcmVxdWlyaW5nIHBvbGxpbmdcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9oYW5kbGUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5fY2FsbGJhY2suYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEJJTkQgUkVMRUFTRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jb25zdCBtb25pdG9yID0gbmV3IFRpbWVvdXRNb25pdG9yKCk7XG5jb25zdCBmcmFtZXJhdGVfbW9uaXRvciA9IG5ldyBGcmFtZXJhdGVNb25pdG9yKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICBsZXQgaGFuZGxlO1xuICAgIGlmIChCb29sZWFuKHBhcnNlRmxvYXQoZGVsYXkpKSkge1xuICAgICAgICBoYW5kbGUgPSBtb25pdG9yLmJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBbXCJ0aW1lb3V0XCIsIGhhbmRsZV07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaGFuZGxlID0gZnJhbWVyYXRlX21vbml0b3IuYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIDAsIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gW1wiZnJhbWVyYXRlXCIsIGhhbmRsZV07XG4gICAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgbGV0IFt0eXBlLCBfaGFuZGxlXSA9IGhhbmRsZTtcbiAgICBpZiAodHlwZSA9PSBcInRpbWVvdXRcIikge1xuICAgICAgICByZXR1cm4gbW9uaXRvci5yZWxlYXNlKF9oYW5kbGUpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcImZyYW1lcmF0ZVwiKSB7XG4gICAgICAgIHJldHVybiBmcmFtZXJhdGVfbW9uaXRvci5yZWxlYXNlKF9oYW5kbGUpO1xuICAgIH1cbn1cblxuIiwiaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi9hcGlfc3JjcHJvcC5qc1wiO1xuaW1wb3J0IHsgQ2xvY2tQcm92aWRlckJhc2UsIGxvY2FsQ2xvY2tQcm92aWRlciB9IGZyb20gXCIuL2Nsb2NrcHJvdmlkZXIuanNcIjtcbmltcG9ydCB7IGNtZCB9IGZyb20gXCIuL2NtZC5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi9sYXllcnMuanNcIjtcbmltcG9ydCB7IGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBiaW5kLCByZWxlYXNlIH0gZnJvbSBcIi4vbW9uaXRvci5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4vbmVhcmJ5aW5kZXhfYmFzZS5qc1wiO1xuXG5cblxuLyoqXG4gKiBDdXJzb3IgZW11bGF0ZXMgTGF5ZXIgaW50ZXJmYWNlLlxuICogUGFydCBvZiB0aGlzIGlzIHRvIHByb3ZlIGFuIGluZGV4IGZvciB0aGUgdGltZWxpbmUuIFxuICogSG93ZXZlciwgd2hlbiBjb25zaWRlcmVkIGFzIGEgbGF5ZXIsIHRoZSBjdXJzb3IgdmFsdWUgaXMgXG4gKiBpbmRlcGVuZGVudCBvZiB0aW1lbGluZSBvZmZzZXQsIHdoaWNoIGlzIHRvIHNheSB0aGF0XG4gKiBpdCBoYXMgdGhlIHNhbWUgdmFsdWUgZm9yIGFsbCB0aW1lbGluZSBvZmZzZXRzLlxuICogXG4gKiBVbmxpa2Ugb3RoZXIgTGF5ZXJzLCB0aGUgQ3Vyc29yIGRvIG5vdCBhY3R1YWxseVxuICogdXNlIHRoaXMgaW5kZXggdG8gcmVzb2x2ZSBxdWVyaWVzLiBJdCBpcyBvbmx5IG5lZWRlZFxuICogZm9yIHNvbWUgZ2VuZXJpYyBMYXllciBmdW5jdGlvbm5hbGl0eSwgbGlrZSBzYW1wbGluZyxcbiAqIHdoaWNoIHVzZXMgaW5kZXguZmlyc3QoKSBhbmQgaW5kZXgubGFzdCgpLlxuICovXG5cbmNsYXNzIEN1cnNvckluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKGN1cnNvcikge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9jYWNoZSA9IGN1cnNvci5nZXRDYWNoZSgpO1xuICAgIH1cblxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgLy8gY3Vyc29yIGluZGV4IGlzIGRlZmluZWQgZm9yIGVudGlyZSB0aW1lbGluZVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICBjZW50ZXI6IFt0aGlzLl9jYWNoZV0sXG4gICAgICAgICAgICBsZWZ0OiBbLUluZmluaXR5LCAwXSxcbiAgICAgICAgICAgIHByZXY6IFstSW5maW5pdHksIDBdLFxuICAgICAgICAgICAgcmlnaHQ6IFtJbmZpbml0eSwgMF0sXG4gICAgICAgICAgICBuZXh0OiBbSW5maW5pdHksIDBdLFxuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIFxuICogQ3Vyc29yIGNhY2hlIGltcGxlbWVudHMgdGhlIHF1ZXJ5IG9wZXJhdGlvbiBmb3IgXG4gKiB0aGUgQ3Vyc29yLCBpZ25vcmluZyB0aGUgZ2l2ZW4gb2Zmc2V0LCByZXBsYWNpbmcgaXQgXG4gKiB3aXRoIGFuIG9mZnNldCBmcm9tIHRoZSBjdHJsIGluc3RlYWQuIFxuICogVGhlIGxheWVyIGNhY2hlIGlzIHVzZWQgdG8gcmVzb2x2ZSB0aGUgcXVlcnkgXG4gKi9cblxuY2xhc3MgQ3Vyc29yQ2FjaGUge1xuICAgIGNvbnN0cnVjdG9yKGN1cnNvcikge1xuICAgICAgICB0aGlzLl9jdXJzb3IgPSBjdXJzb3I7XG4gICAgICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fY3Vyc29yLnNyYy5nZXRDYWNoZSgpO1xuICAgIH1cblxuICAgIHF1ZXJ5KCkge1xuICAgICAgICBjb25zdCBvZmZzZXQgPSB0aGlzLl9jdXJzb3IuX2dldF9jdHJsX3N0YXRlKCkudmFsdWU7IFxuICAgICAgICByZXR1cm4gdGhpcy5fY2FjaGUucXVlcnkob2Zmc2V0KTtcbiAgICB9XG5cbiAgICBjbGVhcigpIHtcbiAgICAgICAgdGhpcy5fY2FjaGUuY2xlYXIoKTtcbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ1VSU09SXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFxuICogQ3Vyc29yIGdsaWRlcyBhbG9uZyBhIGxheWVyIGFuZCBleHBvc2VzIHRoZSBjdXJyZW50IGxheWVyXG4gKiB2YWx1ZSBhdCBhbnkgdGltZVxuICogLSBoYXMgbXV0YWJsZSBjdHJsIChsb2NhbENsb2NrUHJvdmlkZXIgb3IgQ3Vyc29yKVxuICogLSBoYXMgbXV0YWJsZSBzcmMgKGxheWVyKVxuICogLSBtZXRob2RzIGZvciBhc3NpZ24sIG1vdmUsIHRyYW5zaXRpb24sIGludGVycG9sYXRpb25cbiAqL1xuXG5leHBvcnQgY2xhc3MgQ3Vyc29yIGV4dGVuZHMgTGF5ZXIge1xuXG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoe0NhY2hlQ2xhc3M6Q3Vyc29yQ2FjaGV9KTtcblxuICAgICAgICAvLyBzZXR1cCBzcmMgcHJvcGVydGllc1xuICAgICAgICBzcmNwcm9wLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuc3JjcHJvcF9yZWdpc3RlcihcInNyY1wiKTtcbiAgICAgICAgdGhpcy5zcmNwcm9wX3JlZ2lzdGVyKFwiY3RybFwiKTtcblxuICAgICAgICAvLyB0aW1lb3V0XG4gICAgICAgIHRoaXMuX3RpZDtcbiAgICAgICAgLy8gcG9sbGluZ1xuICAgICAgICB0aGlzLl9waWQ7XG5cbiAgICAgICAgLy8gaW5pdGlhbGlzZSBjdHJsLCBzcmNcbiAgICAgICAgbGV0IHtzcmMsIGN0cmx9ID0gb3B0aW9ucztcbiAgICAgICAgdGhpcy5jdHJsID0gY3RybCB8fCBsb2NhbENsb2NrUHJvdmlkZXI7XG4gICAgICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogU1JDUFJPUDogQ1RSTCBhbmQgU1JDXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBzcmNwcm9wX2NoZWNrKHByb3BOYW1lLCBvYmopIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwiY3RybFwiKSB7XG4gICAgICAgICAgICBjb25zdCBvayA9IFtDbG9ja1Byb3ZpZGVyQmFzZSwgQ3Vyc29yXVxuICAgICAgICAgICAgICAgIC5tYXAoKGNsKSA9PiBvYmogaW5zdGFuY2VvZiBjbClcbiAgICAgICAgICAgICAgICAuc29tZShlPT5lID09IHRydWUpO1xuICAgICAgICAgICAgaWYgKCFvaykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJjdHJsXCIgbXVzdCBiZSBDbG9ja1Byb3ZpZGVyIG9yIEN1cnNvciAke29ian1gKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICghKG9iaiBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIExheWVyICR7b2JqfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuXG4gICAgc3JjcHJvcF9vbmNoYW5nZShwcm9wTmFtZSwgZUFyZykge1xuICAgICAgICB0aGlzLl9faGFuZGxlX2NoYW5nZShwcm9wTmFtZSwgZUFyZyk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBDQUxMQkFDS1xuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgX19oYW5kbGVfY2hhbmdlKG9yaWdpbiwgZUFyZykge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fdGlkKTtcbiAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLl9waWQpO1xuICAgICAgICBpZiAodGhpcy5zcmMgJiYgdGhpcy5jdHJsKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleCA9PSB1bmRlZmluZWQgfHwgZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICAvLyBOT1QgdXNlZCBmb3IgY3Vyc29yIHF1ZXJ5IFxuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXggPSBuZXcgQ3Vyc29ySW5kZXgodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmNsZWFyQ2FjaGVzKCk7XG4gICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIC8vIHRyaWdnZXIgY2hhbmdlIGV2ZW50IGZvciBjdXJzb3JcbiAgICAgICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHRoaXMucXVlcnkoKSk7XG4gICAgICAgICAgICAvLyBkZXRlY3QgZnV0dXJlIGNoYW5nZSBldmVudCAtIGlmIG5lZWRlZFxuICAgICAgICAgICAgdGhpcy5fX2RldGVjdF9mdXR1cmVfY2hhbmdlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBERVRFQ1QgRlVUVVJFIENIQU5HRVxuICAgICAqIFxuICAgICAqIFBST0JMRU06XG4gICAgICogXG4gICAgICogRHVyaW5nIHBsYXliYWNrIChjdXJzb3IuY3RybCBpcyBkeW5hbWljKSwgdGhlcmUgaXMgYSBuZWVkIHRvIFxuICAgICAqIGRldGVjdCB0aGUgcGFzc2luZyBmcm9tIG9uZSBzZWdtZW50IGludGVydmFsIG9mIHNyY1xuICAgICAqIHRvIHRoZSBuZXh0IC0gaWRlYWxseSBhdCBwcmVjaXNlbHkgdGhlIGNvcnJlY3QgdGltZVxuICAgICAqIFxuICAgICAqIG5lYXJieS5pdHYgKGRlcml2ZWQgZnJvbSBjdXJzb3Iuc3JjKSBnaXZlcyB0aGUgXG4gICAgICogaW50ZXJ2YWwgKGkpIHdlIGFyZSBjdXJyZW50bHkgaW4sIGkuZS4sIFxuICAgICAqIGNvbnRhaW5pbmcgdGhlIGN1cnJlbnQgb2Zmc2V0ICh2YWx1ZSBvZiBjdXJzb3IuY3RybCksIFxuICAgICAqIGFuZCAoaWkpIHdoZXJlIG5lYXJieS5jZW50ZXIgc3RheXMgY29uc3RhbnRcbiAgICAgKiBcbiAgICAgKiBUaGUgZXZlbnQgdGhhdCBuZWVkcyB0byBiZSBkZXRlY3RlZCBpcyB0aGVyZWZvcmUgdGhlXG4gICAgICogbW9tZW50IHdoZW4gd2UgbGVhdmUgdGhpcyBpbnRlcnZhbCwgdGhyb3VnaCBlaXRoZXJcbiAgICAgKiB0aGUgbG93IG9yIGhpZ2ggaW50ZXJ2YWwgZW5kcG9pbnRcbiAgICAgKiBcbiAgICAgKiBHT0FMOlxuICAgICAqIFxuICAgICAqIEF0IHRoaXMgbW9tZW50LCB3ZSBzaW1wbHkgbmVlZCB0byByZWV2YWx1YXRlIHRoZSBzdGF0ZSAocXVlcnkpIGFuZFxuICAgICAqIGVtaXQgYSBjaGFuZ2UgZXZlbnQgdG8gbm90aWZ5IG9ic2VydmVycy4gXG4gICAgICogXG4gICAgICogQVBQUk9BQ0hFUzpcbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbMF0gXG4gICAgICogVGhlIHRyaXZpYWwgc29sdXRpb24gaXMgdG8gZG8gbm90aGluZywgaW4gd2hpY2ggY2FzZVxuICAgICAqIG9ic2VydmVycyB3aWxsIHNpbXBseSBmaW5kIG91dCB0aGVtc2VsdmVzIGFjY29yZGluZyB0byB0aGVpciBcbiAgICAgKiBvd24gcG9sbCBmcmVxdWVuY3kuIFRoaXMgaXMgc3Vib3B0aW1hbCwgcGFydGljdWxhcmx5IGZvciBsb3cgZnJlcXVlbmN5IFxuICAgICAqIG9ic2VydmVycy4gSWYgdGhlcmUgaXMgYXQgbGVhc3Qgb25lIGhpZ2gtZnJlcXVlbmN5IHBvbGxlciwgXG4gICAgICogdGhpcyB3b3VsZCB0cmlnZ2VyIHRyaWdnZXIgdGhlIHN0YXRlIGNoYW5nZSwgY2F1c2luZyBhbGxcbiAgICAgKiBvYnNlcnZlcnMgdG8gYmUgbm90aWZpZWQuIFRoZSBwcm9ibGVtIHRob3VnaCwgaXMgaWYgbm8gb2JzZXJ2ZXJzXG4gICAgICogYXJlIGFjdGl2ZWx5IHBvbGxpbmcsIGJ1dCBvbmx5IGRlcGVuZGluZyBvbiBjaGFuZ2UgZXZlbnRzLlxuICAgICAqIFxuICAgICAqIEFwcHJvYWNoIFsxXSBcbiAgICAgKiBJbiBjYXNlcyB3aGVyZSB0aGUgY3RybCBpcyBkZXRlcm1pbmlzdGljLCBhIHRpbWVvdXRcbiAgICAgKiBjYW4gYmUgY2FsY3VsYXRlZC4gVGhpcyBpcyB0cml2aWFsIGlmIGN0cmwgaXMgYSBDbG9ja0N1cnNvciwgYW5kXG4gICAgICogaXQgaXMgZmFpcmx5IGVhc3kgaWYgdGhlIGN0cmwgaXMgQ3Vyc29yIHJlcHJlc2VudGluZyBtb3Rpb25cbiAgICAgKiBvciBsaW5lYXIgdHJhbnNpdGlvbi4gSG93ZXZlciwgY2FsY3VsYXRpb25zIGNhbiBiZWNvbWUgbW9yZVxuICAgICAqIGNvbXBsZXggaWYgbW90aW9uIHN1cHBvcnRzIGFjY2VsZXJhdGlvbiwgb3IgaWYgdHJhbnNpdGlvbnNcbiAgICAgKiBhcmUgc2V0IHVwIHdpdGggbm9uLWxpbmVhciBlYXNpbmcuXG4gICAgICogICBcbiAgICAgKiBOb3RlLCBob3dldmVyLCB0aGF0IHRoZXNlIGNhbGN1bGF0aW9ucyBhc3N1bWUgdGhhdCB0aGUgY3Vyc29yLmN0cmwgaXMgXG4gICAgICogYSBDbG9ja0N1cnNvciwgb3IgdGhhdCBjdXJzb3IuY3RybC5jdHJsIGlzIGEgQ2xvY2tDdXJzb3IuIFxuICAgICAqIEluIHByaW5jaXBsZSwgdGhvdWdoLCB0aGVyZSBjb3VsZCBiZSBhIHJlY3Vyc2l2ZSBjaGFpbiBvZiBjdXJzb3JzLFxuICAgICAqIChjdXJzb3IuY3RybC5jdHJsLi4uLmN0cmwpIG9mIHNvbWUgbGVuZ3RoLCB3aGVyZSBvbmx5IHRoZSBsYXN0IGlzIGEgXG4gICAgICogQ2xvY2tDdXJzb3IuIEluIG9yZGVyIHRvIGRvIGRldGVybWluaXN0aWMgY2FsY3VsYXRpb25zIGluIHRoZSBnZW5lcmFsXG4gICAgICogY2FzZSwgYWxsIGN1cnNvcnMgaW4gdGhlIGNoYWluIHdvdWxkIGhhdmUgdG8gYmUgbGltaXRlZCB0byBcbiAgICAgKiBkZXRlcm1pbmlzdGljIGxpbmVhciB0cmFuc2Zvcm1hdGlvbnMuXG4gICAgICogXG4gICAgICogQXBwcm9jaCBbMl0gXG4gICAgICogSXQgbWlnaHQgYWxzbyBiZSBwb3NzaWJsZSB0byBzYW1wbGUgZnV0dXJlIHZhbHVlcyBvZiBcbiAgICAgKiBjdXJzb3IuY3RybCB0byBzZWUgaWYgdGhlIHZhbHVlcyB2aW9sYXRlIHRoZSBuZWFyYnkuaXR2IGF0IHNvbWUgcG9pbnQuIFxuICAgICAqIFRoaXMgd291bGQgZXNzZW50aWFsbHkgYmUgdHJlYXRpbmcgY3RybCBhcyBhIGxheWVyIGFuZCBzYW1wbGluZyBcbiAgICAgKiBmdXR1cmUgdmFsdWVzLiBUaGlzIGFwcHJvY2ggd291bGQgd29yayBmb3IgYWxsIHR5cGVzLCBcbiAgICAgKiBidXQgdGhlcmUgaXMgbm8ga25vd2luZyBob3cgZmFyIGludG8gdGhlIGZ1dHVyZSBvbmUgXG4gICAgICogd291bGQgaGF2ZSB0byBzZWVrLiBIb3dldmVyLCBhZ2FpbiAtIGFzIGluIFsxXSB0aGUgYWJpbGl0eSB0byBzYW1wbGUgZnV0dXJlIHZhbHVlc1xuICAgICAqIGlzIHByZWRpY2F0ZWQgb24gY3Vyc29yLmN0cmwgYmVpbmcgYSBDbG9ja0N1cnNvci4gQWxzbywgdGhlcmUgXG4gICAgICogaXMgbm8gd2F5IG9mIGtub3dpbmcgaG93IGxvbmcgaW50byB0aGUgZnV0dXJlIHNhbXBsaW5nIHdvdWxkIGJlIG5lY2Vzc2FyeS5cbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbM10gXG4gICAgICogSW4gdGhlIGdlbmVyYWwgY2FzZSwgdGhlIG9ubHkgd2F5IHRvIHJlbGlhYmxleSBkZXRlY3QgdGhlIGV2ZW50IGlzIHRocm91Z2ggcmVwZWF0ZWRcbiAgICAgKiBwb2xsaW5nLiBBcHByb2FjaCBbM10gaXMgc2ltcGx5IHRoZSBpZGVhIHRoYXQgdGhpcyBwb2xsaW5nIGlzIHBlcmZvcm1lZFxuICAgICAqIGludGVybmFsbHkgYnkgdGhlIGN1cnNvciBpdHNlbGYsIGFzIGEgd2F5IG9mIHNlY3VyaW5nIGl0cyBvd24gY29uc2lzdGVudFxuICAgICAqIHN0YXRlLCBhbmQgZW5zdXJpbmcgdGhhdCBvYnNlcnZlciBnZXQgY2hhbmdlIGV2ZW50cyBpbiBhIHRpbWVseSBtYW5uZXIsIGV2ZW50XG4gICAgICogaWYgdGhleSBkbyBsb3ctZnJlcXVlbmN5IHBvbGxpbmcsIG9yIGRvIG5vdCBkbyBwb2xsaW5nIGF0IGFsbC4gXG4gICAgICogXG4gICAgICogU09MVVRJT046XG4gICAgICogQXMgdGhlcmUgaXMgbm8gcGVyZmVjdCBzb2x1dGlvbiBpbiB0aGUgZ2VuZXJhbCBjYXNlLCB3ZSBvcHBvcnR1bmlzdGljYWxseVxuICAgICAqIHVzZSBhcHByb2FjaCBbMV0gd2hlbiB0aGlzIGlzIHBvc3NpYmxlLiBJZiBub3QsIHdlIGFyZSBmYWxsaW5nIGJhY2sgb24gXG4gICAgICogYXBwcm9hY2ggWzNdXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIE5PIGV2ZW50IGRldGVjdGlvbiBpcyBuZWVkZWQgKE5PT1ApXG4gICAgICogKGkpIGN1cnNvci5jdHJsIGlzIG5vdCBkeW5hbWljXG4gICAgICogb3JcbiAgICAgKiAoaWkpIG5lYXJieS5pdHYgc3RyZXRjaGVzIGludG8gaW5maW5pdHkgaW4gYm90aCBkaXJlY3Rpb25zXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIGFwcHJvYWNoIFsxXSBjYW4gYmUgdXNlZFxuICAgICAqIFxuICAgICAqIChpKSBpZiBjdHJsIGlzIGEgQ2xvY2tDdXJzb3IgJiYgbmVhcmJ5Lml0di5oaWdoIDwgSW5maW5pdHlcbiAgICAgKiBvclxuICAgICAqIChpaSkgY3RybC5jdHJsIGlzIGEgQ2xvY2tDdXJzb3JcbiAgICAgKiAgICAgIChhKSBjdHJsLm5lYXJieS5jZW50ZXIgaGFzIGV4YWN0bHkgMSBpdGVtXG4gICAgICogICAgICAmJlxuICAgICAqICAgICAgKGIpIGN0cmwubmVhcmJ5LmNlbnRlclswXS50eXBlID09IChcIm1vdGlvblwiKSB8fCAoXCJ0cmFuc2l0aW9uXCIgJiYgZWFzaW5nPT1cImxpbmVhclwiKVxuICAgICAqICAgICAgJiZcbiAgICAgKiAgICAgIChjKSBjdHJsLm5lYXJieS5jZW50ZXJbMF0uZGF0YS52ZWxvY2l0eSAhPSAwLjBcbiAgICAgKiAgICAgICYmIFxuICAgICAqICAgICAgKGQpIGZ1dHVyZSBpbnRlcnNlY3RvbiBwb2ludCB3aXRoIGNhY2hlLm5lYXJieS5pdHYgXG4gICAgICogICAgICAgICAgaXMgbm90IC1JbmZpbml0eSBvciBJbmZpbml0eVxuICAgICAqIFxuICAgICAqIFRob3VnaCBpdCBzZWVtcyBjb21wbGV4LCBjb25kaXRpb25zIGZvciBbMV0gc2hvdWxkIGJlIG1ldCBmb3IgY29tbW9uIGNhc2VzIGludm9sdmluZ1xuICAgICAqIHBsYXliYWNrLiBBbHNvLCB1c2Ugb2YgdHJhbnNpdGlvbiBldGMgbWlnaHQgYmUgcmFyZS5cbiAgICAgKiBcbiAgICAgKi9cblxuICAgIF9fZGV0ZWN0X2Z1dHVyZV9jaGFuZ2UoKSB7XG5cbiAgICAgICAgLy8gY3RybCBcbiAgICAgICAgY29uc3QgY3RybF92ZWN0b3IgPSB0aGlzLl9nZXRfY3RybF9zdGF0ZSgpO1xuICAgICAgICBjb25zdCB7dmFsdWU6Y3VycmVudF9wb3MsIG9mZnNldDpjdXJyZW50X3RzfSA9IGN0cmxfdmVjdG9yO1xuXG4gICAgICAgIC8vIGN0cmwgbXVzdCBiZSBkeW5hbWljXG4gICAgICAgIGlmICghY3RybF92ZWN0b3IuZHluYW1pYykge1xuICAgICAgICAgICAgLy8gbm8gZnV0dXJlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2V0IG5lYXJieSBmcm9tIHNyYyAtIHVzZSB2YWx1ZSBmcm9tIGN0cmxcbiAgICAgICAgY29uc3Qgc3JjX25lYXJieSA9IHRoaXMuc3JjLmluZGV4Lm5lYXJieShjdXJyZW50X3Bvcyk7XG4gICAgICAgIGNvbnN0IFtsb3csIGhpZ2hdID0gc3JjX25lYXJieS5pdHYuc2xpY2UoMCwyKTtcblxuICAgICAgICAvLyBhcHByb2FjaCBbMV1cbiAgICAgICAgaWYgKHRoaXMuY3RybCBpbnN0YW5jZW9mIENsb2NrUHJvdmlkZXJCYXNlKSB7XG4gICAgICAgICAgICBpZiAoaXNGaW5pdGUoaGlnaCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9fc2V0X3RpbWVvdXQoaGlnaCwgY3VycmVudF9wb3MsIDEuMCwgY3VycmVudF90cyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbm8gZnV0dXJlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IFxuICAgICAgICBpZiAodGhpcy5jdHJsLmN0cmwgaW5zdGFuY2VvZiBDbG9ja1Byb3ZpZGVyQmFzZSkge1xuICAgICAgICAgICAgLyoqIFxuICAgICAgICAgICAgICogdGhpcy5jdHJsIFxuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAgKiBoYXMgbWFueSBwb3NzaWJsZSBiZWhhdmlvcnNcbiAgICAgICAgICAgICAqIHRoaXMuY3RybCBoYXMgYW4gaW5kZXggdXNlIHRoaXMgdG8gZmlndXJlIG91dCB3aGljaFxuICAgICAgICAgICAgICogYmVoYXZpb3VyIGlzIGN1cnJlbnQuXG4gICAgICAgICAgICAgKiBcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICAvLyB1c2UgdGhlIHNhbWUgb2Zmc2V0IHRoYXQgd2FzIHVzZWQgaW4gdGhlIGN0cmwucXVlcnlcbiAgICAgICAgICAgIGNvbnN0IGN0cmxfbmVhcmJ5ID0gdGhpcy5jdHJsLmluZGV4Lm5lYXJieShjdXJyZW50X3RzKTtcblxuICAgICAgICAgICAgaWYgKCFpc0Zpbml0ZShsb3cpICYmICFpc0Zpbml0ZShoaWdoKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vIGZ1dHVyZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY3RybF9uZWFyYnkuY2VudGVyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY3RybF9pdGVtID0gY3RybF9uZWFyYnkuY2VudGVyWzBdO1xuICAgICAgICAgICAgICAgIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHt2ZWxvY2l0eSwgYWNjZWxlcmF0aW9uPTAuMH0gPSBjdHJsX2l0ZW0uZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjY2VsZXJhdGlvbiA9PSAwLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdGFyZ2V0X3BvcyA9ICh2ZWxvY2l0eSA+IDApID8gaGlnaCA6IGxvdztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0Zpbml0ZSh0YXJnZXRfcG9zKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjsgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBubyBmdXR1cmUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gYWNjZWxlcmF0aW9uIC0gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7djA6cDAsIHYxOnAxLCB0MCwgdDEsIGVhc2luZz1cImxpbmVhclwifSA9IGN0cmxfaXRlbS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZWFzaW5nID09IFwibGluZWFyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2ZWxvY2l0eSA9IChwMS1wMCkvKHQxLXQwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRfcG9zID0gKHZlbG9jaXR5ID4gMCkgPyBNYXRoLm1pbihoaWdoLCBwMSkgOiBNYXRoLm1heChsb3csIHAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBvdGhlciBlYXNpbmcgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gb3RoZXIgdHlwZSAoaW50ZXJwb2xhdGlvbikgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIG1vcmUgdGhhbiBvbmUgc2VnbWVudCAtIHBvc3NpYmxlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0IC0gYXBwcm9hY2ggWzNdXG4gICAgICAgIHRoaXMuX19zZXRfcG9sbGluZyhzcmNfbmVhcmJ5Lml0dik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc2V0IHRpbWVvdXRcbiAgICAgKiAtIHByb3RlY3RzIGFnYWluc3QgdG9vIGVhcmx5IGNhbGxiYWNrcyBieSByZXNjaGVkdWxpbmdcbiAgICAgKiB0aW1lb3V0IGlmIG5lY2Nlc3NhcnkuXG4gICAgICogLSBhZGRzIGEgbWlsbGlzZWNvbmQgdG8gb3JpZ2luYWwgdGltZW91dCB0byBhdm9pZFxuICAgICAqIGZyZXF1ZW50IHJlc2NoZWR1bGluZyBcbiAgICAgKi9cblxuICAgIF9fc2V0X3RpbWVvdXQodGFyZ2V0X3BvcywgY3VycmVudF9wb3MsIHZlbG9jaXR5LCBjdXJyZW50X3RzKSB7XG4gICAgICAgIGNvbnN0IGRlbHRhX3NlYyA9ICh0YXJnZXRfcG9zIC0gY3VycmVudF9wb3MpIC8gdmVsb2NpdHk7XG4gICAgICAgIGNvbnN0IHRhcmdldF90cyA9IGN1cnJlbnRfdHMgKyBkZWx0YV9zZWM7XG4gICAgICAgIHRoaXMuX3RpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV90aW1lb3V0KHRhcmdldF90cyk7XG4gICAgICAgIH0sIGRlbHRhX3NlYyoxMDAwICsgMSk7XG4gICAgfVxuXG4gICAgX19oYW5kbGVfdGltZW91dCh0YXJnZXRfdHMpIHtcbiAgICAgICAgY29uc3QgdHMgPSB0aGlzLl9nZXRfY3RybF9zdGF0ZSgpLm9mZnNldDtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nX3NlYyA9IHRhcmdldF90cyAtIHRzOyBcbiAgICAgICAgaWYgKHJlbWFpbmluZ19zZWMgPD0gMCkge1xuICAgICAgICAgICAgLy8gZG9uZVxuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV9jaGFuZ2UoXCJ0aW1lb3V0XCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcmVzY2hlZHVsZSB0aW1lb3V0XG4gICAgICAgICAgICB0aGlzLl90aWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9faGFuZGxlX3RpbWVvdXQodGFyZ2V0X3RzKVxuICAgICAgICAgICAgfSwgcmVtYWluaW5nX3NlYyoxMDAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNldCBwb2xsaW5nXG4gICAgICovXG5cbiAgICBfX3NldF9wb2xsaW5nKGl0dikge1xuICAgICAgICB0aGlzLl9waWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9faGFuZGxlX3BvbGwoaXR2KTtcbiAgICAgICAgfSwgMTAwKTtcbiAgICB9XG5cbiAgICBfX2hhbmRsZV9wb2xsKGl0dikge1xuICAgICAgICBsZXQgb2Zmc2V0ID0gdGhpcy5xdWVyeSgpLnZhbHVlO1xuICAgICAgICBpZiAoIWludGVydmFsLmNvdmVyc19wb2ludChpdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgIHRoaXMuX19oYW5kbGVfY2hhbmdlKFwidGltZW91dFwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfZ2V0X2N0cmxfc3RhdGUgKCkge1xuICAgICAgICBpZiAodGhpcy5jdHJsIGluc3RhbmNlb2YgQ2xvY2tQcm92aWRlckJhc2UpIHtcbiAgICAgICAgICAgIGxldCB0cyA9IHRoaXMuY3RybC5ub3coKTtcbiAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dHMsIGR5bmFtaWM6dHJ1ZSwgb2Zmc2V0OnRzfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBzdGF0ZSA9IHRoaXMuY3RybC5xdWVyeSgpO1xuICAgICAgICAgICAgLy8gcHJvdGVjdCBhZ2FpbnN0IG5vbi1mbG9hdCB2YWx1ZXNcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc3RhdGUudmFsdWUgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdHJsIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7c3RhdGUudmFsdWV9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdmFsdWUgKCkge3JldHVybiB0aGlzLnF1ZXJ5KCkudmFsdWV9O1xuICAgIFxuICAgIC8qXG4gICAgICAgIEV2ZW50aWZ5OiBpbW1lZGlhdGUgZXZlbnRzXG4gICAgKi9cbiAgICBldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuICAgICAgICBpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG4gICAgICAgICAgICByZXR1cm4gW3RoaXMucXVlcnkoKV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBCSU5EIFJFTEVBU0UgKGNvbnZlbmllbmNlKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgYmluZChjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICAgICAgcmV0dXJuIGJpbmQodGhpcywgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zKTtcbiAgICB9XG4gICAgcmVsZWFzZShoYW5kbGUpIHtcbiAgICAgICAgcmV0dXJuIHJlbGVhc2UoaGFuZGxlKTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFVQREFURSBBUElcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGFzc2lnbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gY21kKHRoaXMuc3JjLnNyYykuYXNzaWduKHZhbHVlKTtcbiAgICB9XG4gICAgbW92ZSAoe3Bvc2l0aW9uLCB2ZWxvY2l0eX0pIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgb2Zmc2V0OnRpbWVzdGFtcH0gPSB0aGlzLnF1ZXJ5KCk7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhcm5pbmc6IGN1cnNvciBzdGF0ZSBtdXN0IGJlIG51bWJlciAke3ZhbHVlfWApO1xuICAgICAgICB9XG4gICAgICAgIHBvc2l0aW9uID0gKHBvc2l0aW9uICE9IHVuZGVmaW5lZCkgPyBwb3NpdGlvbiA6IHZhbHVlO1xuICAgICAgICB2ZWxvY2l0eSA9ICh2ZWxvY2l0eSAhPSB1bmRlZmluZWQpID8gdmVsb2NpdHk6IDA7XG4gICAgICAgIHJldHVybiBjbWQodGhpcy5zcmMuc3JjKS5tb3ZlKHtwb3NpdGlvbiwgdmVsb2NpdHksIHRpbWVzdGFtcH0pO1xuICAgIH1cbiAgICB0cmFuc2l0aW9uICh7dGFyZ2V0LCBkdXJhdGlvbiwgZWFzaW5nfSkge1xuICAgICAgICBsZXQge3ZhbHVlOnYwLCBvZmZzZXQ6dDB9ID0gdGhpcy5xdWVyeSgpO1xuICAgICAgICBpZiAodHlwZW9mIHYwICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3Igc3RhdGUgbXVzdCBiZSBudW1iZXIgJHt2MH1gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY21kKHRoaXMuc3JjLnNyYykudHJhbnNpdGlvbih2MCwgdGFyZ2V0LCB0MCwgdDAgKyBkdXJhdGlvbiwgZWFzaW5nKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUgKHt0dXBsZXMsIGR1cmF0aW9ufSkge1xuICAgICAgICBsZXQgdDAgPSB0aGlzLnF1ZXJ5KCkub2Zmc2V0O1xuICAgICAgICAvLyBhc3N1bWluZyB0aW1zdGFtcHMgYXJlIGluIHJhbmdlIFswLDFdXG4gICAgICAgIC8vIHNjYWxlIHRpbWVzdGFtcHMgdG8gZHVyYXRpb25cbiAgICAgICAgdHVwbGVzID0gdHVwbGVzLm1hcCgoW3YsdF0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbdiwgdDAgKyB0KmR1cmF0aW9uXTtcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzLnNyYy5zcmMpLmludGVycG9sYXRlKHR1cGxlcyk7XG4gICAgfVxuXG59XG5zcmNwcm9wLmFkZFRvUHJvdG90eXBlKEN1cnNvci5wcm90b3R5cGUpO1xuc3JjcHJvcC5hZGRUb1Byb3RvdHlwZShDdXJzb3IucHJvdG90eXBlKTtcblxuIiwiaW1wb3J0IHsgaW50ZXJ2YWwsIGVuZHBvaW50fSBmcm9tIFwiLi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi4vbmVhcmJ5aW5kZXhfYmFzZS5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi4vbGF5ZXJzLmpzXCJcblxuZXhwb3J0IGNsYXNzIEJvb2xlYW5MYXllciBleHRlbmRzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKGxheWVyKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuaW5kZXggPSBuZXcgQm9vbGVhbkluZGV4KGxheWVyLmluZGV4KTtcbiAgICBcbiAgICAgICAgLy8gc3Vic2NyaWJlXG4gICAgICAgIGNvbnN0IGhhbmRsZXIgPSB0aGlzLl9vbmNoYW5nZS5iaW5kKHRoaXMpO1xuICAgICAgICBsYXllci5hZGRfY2FsbGJhY2soaGFuZGxlcik7XG4gICAgfVxuXG4gICAgX29uY2hhbmdlKGVBcmcpIHtcbiAgICAgICAgdGhpcy5jbGVhckNhY2hlcygpO1xuICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIik7XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYm9vbGVhbihsYXllcikge1xuICAgIHJldHVybiBuZXcgQm9vbGVhbkxheWVyKGxheWVyKTtcbn0gXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEJPT0xFQU4gTkVBUkJZIElOREVYXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogV3JhcHBlciBJbmRleCB3aGVyZSByZWdpb25zIGFyZSB0cnVlL2ZhbHNlLCBiYXNlZCBvbiBcbiAqIGNvbmRpdGlvbiBvbiBuZWFyYnkuY2VudGVyLlxuICogQmFjay10by1iYWNrIHJlZ2lvbnMgd2hpY2ggYXJlIHRydWUgYXJlIGNvbGxhcHNlZCBcbiAqIGludG8gb25lIHJlZ2lvblxuICogXG4gKi9cblxuZnVuY3Rpb24gcXVlcnlPYmplY3QgKHZhbHVlKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcXVlcnk6IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICAgICAgICAgIHJldHVybiB7dmFsdWUsIGR5bmFtaWM6ZmFsc2UsIG9mZnNldH07XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCb29sZWFuSW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoaW5kZXgsIG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5faW5kZXggPSBpbmRleDtcbiAgICAgICAgbGV0IHtjb25kaXRpb24gPSAoY2VudGVyKSA9PiBjZW50ZXIubGVuZ3RoID4gMH0gPSBvcHRpb25zO1xuICAgICAgICB0aGlzLl9jb25kaXRpb24gPSBjb25kaXRpb247XG4gICAgfVxuXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBvZmZzZXQgPSBlbmRwb2ludC5mcm9tX2lucHV0KG9mZnNldCk7XG4gICAgICAgIGNvbnN0IG5lYXJieSA9IHRoaXMuX2luZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICBcbiAgICAgICAgbGV0IGV2YWx1YXRpb24gPSB0aGlzLl9jb25kaXRpb24obmVhcmJ5LmNlbnRlcik7IFxuICAgICAgICAvKiBcbiAgICAgICAgICAgIHNlZWsgbGVmdCBhbmQgcmlnaHQgZm9yIGZpcnN0IHJlZ2lvblxuICAgICAgICAgICAgd2hpY2ggZG9lcyBub3QgaGF2ZSB0aGUgc2FtZSBldmFsdWF0aW9uIFxuICAgICAgICAqL1xuICAgICAgICBjb25zdCBjb25kaXRpb24gPSAoY2VudGVyKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fY29uZGl0aW9uKGNlbnRlcikgIT0gZXZhbHVhdGlvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGV4cGFuZCByaWdodFxuICAgICAgICBsZXQgcmlnaHQ7XG4gICAgICAgIGxldCByaWdodF9uZWFyYnkgPSB0aGlzLl9pbmRleC5maW5kX3JlZ2lvbihuZWFyYnksIHtcbiAgICAgICAgICAgIGRpcmVjdGlvbjoxLCBjb25kaXRpb25cbiAgICAgICAgfSk7ICAgICAgICBcbiAgICAgICAgaWYgKHJpZ2h0X25lYXJieSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJpZ2h0ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChyaWdodF9uZWFyYnkuaXR2KVswXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGV4cGFuZCBsZWZ0XG4gICAgICAgIGxldCBsZWZ0O1xuICAgICAgICBsZXQgbGVmdF9uZWFyYnkgPSB0aGlzLl9pbmRleC5maW5kX3JlZ2lvbihuZWFyYnksIHtcbiAgICAgICAgICAgIGRpcmVjdGlvbjotMSwgY29uZGl0aW9uXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAobGVmdF9uZWFyYnkgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsZWZ0ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChsZWZ0X25lYXJieS5pdHYpWzFdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZXhwYW5kIHRvIGluZmluaXR5XG4gICAgICAgIGxlZnQgPSBsZWZ0IHx8IFstSW5maW5pdHksIDBdO1xuICAgICAgICByaWdodCA9IHJpZ2h0IHx8IFtJbmZpbml0eSwgMF07XG4gICAgICAgIGNvbnN0IGxvdyA9IGVuZHBvaW50LmZsaXAobGVmdCwgXCJsb3dcIik7XG4gICAgICAgIGNvbnN0IGhpZ2ggPSBlbmRwb2ludC5mbGlwKHJpZ2h0LCBcImhpZ2hcIilcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGl0djogaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKSxcbiAgICAgICAgICAgIGNlbnRlciA6IFtxdWVyeU9iamVjdChldmFsdWF0aW9uKV0sXG4gICAgICAgICAgICBsZWZ0LFxuICAgICAgICAgICAgcmlnaHQsXG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBNZXJnZUluZGV4IH0gZnJvbSBcIi4vbWVyZ2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVycy5qc1wiO1xuaW1wb3J0IHsgQm9vbGVhbkluZGV4IH0gZnJvbSBcIi4vYm9vbGVhbi5qc1wiO1xuXG5cbmNsYXNzIExvZ2ljYWxNZXJnZUxheWVyIGV4dGVuZHMgTGF5ZXIge1xuXG4gICAgY29uc3RydWN0b3Ioc291cmNlcywgb3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIGNvbnN0IHtleHByfSA9IG9wdGlvbnM7XG5cbiAgICAgICAgbGV0IGNvbmRpdGlvbjtcbiAgICAgICAgaWYgKGV4cHIpIHtcbiAgICAgICAgICAgIGNvbmRpdGlvbiA9IChjZW50ZXIpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhwci5ldmFsKGNlbnRlcik7XG4gICAgICAgICAgICB9ICAgIFxuICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAvLyBzdWJzY3JpYmUgdG8gY2FsbGJhY2tzIGZyb20gc291cmNlc1xuICAgICAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5fb25jaGFuZ2UuYmluZCh0aGlzKTtcbiAgICAgICAgZm9yIChsZXQgc3JjIG9mIHNvdXJjZXMpIHtcbiAgICAgICAgICAgIHNyYy5hZGRfY2FsbGJhY2soaGFuZGxlcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBsZXQgaW5kZXggPSBuZXcgTWVyZ2VJbmRleChzb3VyY2VzKTtcbiAgICAgICAgdGhpcy5faW5kZXggPSBuZXcgQm9vbGVhbkluZGV4KGluZGV4LCB7Y29uZGl0aW9ufSk7XG4gICAgfVxuXG4gICAgZ2V0IGluZGV4ICgpIHtyZXR1cm4gdGhpcy5faW5kZXh9O1xuXG4gICAgX29uY2hhbmdlKGVBcmcpIHtcbiAgICAgICAgdGhpcy5jbGVhckNhY2hlcygpO1xuICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIik7XG4gICAgfVxufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dpY2FsX21lcmdlKHNvdXJjZXMsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IExvZ2ljYWxNZXJnZUxheWVyKHNvdXJjZXMsIG9wdGlvbnMpO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dpY2FsX2V4cHIgKHNyYykge1xuICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG11c3QgYmUgbGF5ZXIgJHtzcmN9YClcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZXZhbDogZnVuY3Rpb24gKGNlbnRlcikge1xuICAgICAgICAgICAgZm9yIChsZXQgY2FjaGUgb2YgY2VudGVyKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNhY2hlLnNyYyA9PSBzcmMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5sb2dpY2FsX2V4cHIuYW5kID0gZnVuY3Rpb24gYW5kKC4uLmV4cHJzKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZXZhbDogZnVuY3Rpb24gKGNlbnRlcikge1xuICAgICAgICAgICAgcmV0dXJuIGV4cHJzLmV2ZXJ5KChleHByKSA9PiBleHByLmV2YWwoY2VudGVyKSk7XG4gICAgICAgIH0gICAgXG4gICAgfVxufVxuXG5sb2dpY2FsX2V4cHIub3IgPSBmdW5jdGlvbiBvciguLi5leHBycykge1xuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBleHBycy5zb21lKChleHByKSA9PiBleHByLmV2YWwoY2VudGVyKSk7XG4gICAgICAgIH0gICAgXG4gICAgfVxufVxuXG5sb2dpY2FsX2V4cHIueG9yID0gZnVuY3Rpb24geG9yKGV4cHIxLCBleHByMikge1xuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBleHByMS5ldmFsKGNlbnRlcikgIT0gZXhwcjIuZXZhbChjZW50ZXIpO1xuICAgICAgICB9ICAgIFxuICAgIH1cbn1cblxubG9naWNhbF9leHByLm5vdCA9IGZ1bmN0aW9uIG5vdChleHByKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZXZhbDogZnVuY3Rpb24gKGNlbnRlcikge1xuICAgICAgICAgICAgcmV0dXJuICFleHByLmV2YWwoY2VudGVyKTtcbiAgICAgICAgfSAgICBcbiAgICB9XG59XG5cblxuXG5cbiIsImltcG9ydCB7IExvY2FsU3RhdGVQcm92aWRlciB9IGZyb20gXCIuL3N0YXRlcHJvdmlkZXIuanNcIjtcbmltcG9ydCB7IG1lcmdlIH0gZnJvbSBcIi4vb3BzL21lcmdlLmpzXCJcbmltcG9ydCB7IHNoaWZ0IH0gZnJvbSBcIi4vb3BzL3NoaWZ0LmpzXCI7XG5pbXBvcnQgeyBJbnB1dExheWVyLCBMYXllciB9IGZyb20gXCIuL2xheWVycy5qc1wiO1xuaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSBcIi4vY3Vyc29ycy5qc1wiO1xuaW1wb3J0IHsgYm9vbGVhbiB9IGZyb20gXCIuL29wcy9ib29sZWFuLmpzXCJcbmltcG9ydCB7IGNtZCB9IGZyb20gXCIuL2NtZC5qc1wiO1xuaW1wb3J0IHsgbG9naWNhbF9tZXJnZSwgbG9naWNhbF9leHByfSBmcm9tIFwiLi9vcHMvbG9naWNhbF9tZXJnZS5qc1wiO1xuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX2Jhc2UuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExBWUVSIEZBQ1RPUllcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gbGF5ZXIob3B0aW9ucz17fSkge1xuICAgIGxldCB7c3JjLCBpdGVtcz1bXSwgdmFsdWUsIC4uLm9wdHN9ID0gb3B0aW9ucztcbiAgICBpZiAoc3JjIGluc3RhbmNlb2YgTGF5ZXIpIHtcbiAgICAgICAgcmV0dXJuIHNyYztcbiAgICB9IFxuICAgIGlmIChzcmMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGl0ZW1zID0gW3tcbiAgICAgICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5XSxcbiAgICAgICAgICAgICAgICBkYXRhOiB2YWx1ZVxuICAgICAgICAgICAgfV07XG4gICAgICAgIH0gXG4gICAgICAgIHNyYyA9IG5ldyBMb2NhbFN0YXRlUHJvdmlkZXIoe2l0ZW1zfSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgSW5wdXRMYXllcih7c3JjLCAuLi5vcHRzfSk7IFxufVxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQ1VSU09SIEZBQ1RPUklFU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5mdW5jdGlvbiBjdXJzb3Iob3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHtjdHJsLCAuLi5vcHRzfSA9IG9wdGlvbnM7XG4gICAgY29uc3Qgc3JjID0gbGF5ZXIob3B0cyk7ICAgIFxuICAgIHJldHVybiBuZXcgQ3Vyc29yKHtjdHJsLCBzcmN9KTtcbn1cblxuZXhwb3J0IHsgbGF5ZXIsIGN1cnNvciwgbWVyZ2UsIHNoaWZ0LCBjbWQsIGN1cnNvciBhcyB2YXJpYWJsZSwgY3Vyc29yIGFzIHBsYXliYWNrLCBib29sZWFuLCBsb2dpY2FsX21lcmdlLCBsb2dpY2FsX2V4cHIsIFN0YXRlUHJvdmlkZXJCYXNlfSJdLCJuYW1lcyI6WyJQUkVGSVgiLCJhZGRUb0luc3RhbmNlIiwiYWRkVG9Qcm90b3R5cGUiLCJjYWxsYmFjay5hZGRUb0luc3RhbmNlIiwiY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUiLCJjbXBfYXNjZW5kaW5nIiwiY21wX2Rlc2NlbmRpbmciLCJpbnRlcnBvbGF0ZSIsImV2ZW50aWZ5LmFkZFRvSW5zdGFuY2UiLCJldmVudGlmeS5hZGRUb1Byb3RvdHlwZSIsInNyY3Byb3AuYWRkVG9JbnN0YW5jZSIsInNyY3Byb3AuYWRkVG9Qcm90b3R5cGUiLCJzZWdtZW50LlN0YXRpY1NlZ21lbnQiLCJzZWdtZW50LlRyYW5zaXRpb25TZWdtZW50Iiwic2VnbWVudC5JbnRlcnBvbGF0aW9uU2VnbWVudCIsInNlZ21lbnQuTW90aW9uU2VnbWVudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7SUFBQTtJQUNBO0lBQ0E7O0lBRUEsTUFBTUEsUUFBTSxHQUFHLFlBQVk7O0lBRXBCLFNBQVNDLGVBQWEsQ0FBQyxNQUFNLEVBQUU7SUFDdEMsSUFBSSxNQUFNLENBQUMsQ0FBQyxFQUFFRCxRQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxFQUFFO0lBQ3JDOztJQUVBLFNBQVMsWUFBWSxFQUFF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QyxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxFQUFFO0lBQ2hDLFFBQVEsSUFBSSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRTtJQUNwRCxRQUFRLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO0lBQ3ZDLFlBQVksTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLHFDQUFxQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDNUU7SUFDQSxRQUFRLFFBQVEsR0FBRyxDQUFDLFFBQVEsSUFBSSxTQUFTLElBQUksUUFBUSxHQUFHLEtBQUs7SUFDN0QsUUFBUSxRQUFRLEdBQUcsQ0FBQyxRQUFRLElBQUksU0FBUyxJQUFJLFFBQVEsRUFBRSxDQUFDO0lBQ3hELFFBQVEsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3RFO0lBQ0EsSUFBSSxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLEVBQUU7SUFDNUMsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRTtJQUNoRCxRQUFRLElBQUksT0FBTyxFQUFFLEtBQUssUUFBUSxFQUFFO0lBQ3BDLFlBQVksTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLHFDQUFxQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDekU7SUFDQSxRQUFRLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxRQUFRLEVBQUUsTUFBTSxDQUFDO0lBQ2xGO0lBQ0EsSUFBSSxXQUFXLENBQUMsQ0FBQyxDQUFDLE1B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
