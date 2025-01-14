
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var LAYERS = (function (exports) {
    'use strict';

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

    function endpoint_cmp (p1, p2) {
        let [v1, s1] = p1;
        let [v2, s2] = p2;
        let diff = v1 - v2;
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
        from_endpoints: interval_from_endpoints
    };

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
        LAYERS SEGMENT
    *********************************************************************/

    class LayersSegment extends BaseSegment {

    	constructor(itv, args) {
            super(itv);
    		this._layers = args.layers;
            this._value_func = args.value_func;

            // TODO - figure out dynamic here?
        }

    	state(offset) {
            // TODO - use value func
            // for now - just use first layer
            return {...this._layers[0].query(offset), offset};
    	}
    }


    /********************************************************************
        STATIC SEGMENT
    *********************************************************************/

    class StaticSegment extends BaseSegment {

    	constructor(itv, args) {
            super(itv);
    		this._value = args.value;
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
        
        constructor(itv, args) {
            super(itv);
            const {
                position:p0, velocity:v0, timestamp:t0
            } = args;
            // create motion transition
            const a0 = 0;
            this._velocity = v0;
            this._position = function (ts) {
                let d = ts - t0;
                return p0 + v0*d + 0.5*a0*d*d;
            };   
        }

        state(offset) {
            return {
                value: this._position(offset), 
                rate: this._velocity, 
                dynamic: this._velocity != 0
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

    	constructor(itv, args) {
    		super(itv);
            let {v0, v1, easing} = args;
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

        constructor(itv, args) {
            super(itv);
            // setup interpolation function
            this._trans = interpolate$1(args.tuples);
        }

        state(offset) {
            return {value: this._trans(offset), dynamic:true};
        }
    }

    var segments = /*#__PURE__*/Object.freeze({
        __proto__: null,
        BaseSegment: BaseSegment,
        InterpolationSegment: InterpolationSegment,
        LayersSegment: LayersSegment,
        MotionSegment: MotionSegment,
        StaticSegment: StaticSegment,
        TransitionSegment: TransitionSegment
    });

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

    const eventify = function () {
    	return {
    		addToInstance: eventifyInstance,
    		addToPrototype: eventifyPrototype
    	}
    }();

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
        This adds basic (synchronous) callback support to an object.
    */

    const callback = function () {

        function addToInstance(object) {
            object.__callback_callbacks = [];
        }

        function add_callback (handler) {
            let handle = {
                handler: handler
            };
            this.__callback_callbacks.push(handle);
            return handle;
        }
        function remove_callback (handle) {
            let index = this.__callback_callbacks.indexof(handle);
            if (index > -1) {
                this.__callback_callbacks.splice(index, 1);
            }
        }
        function notify_callbacks (eArg) {
            this.__callback_callbacks.forEach(function(handle) {
                handle.handler(eArg);
            });
        }

        function addToPrototype (_prototype) {
            const api = {
                add_callback, remove_callback, notify_callbacks
            };
            Object.assign(_prototype, api);
        }

        return {addToInstance, addToPrototype}
    }();


    /************************************************
     * SOURCE
     ************************************************/

    /**
     * Extend a class with support for external source on 
     * a named property.
     * 
     * option: mutable:true means that propery may be reset 
     * 
     * source object is assumed to support the callback interface
     */


    const source = function () {

        function propnames (propName) {
            return {
                prop: `__${propName}`,
                init: `__${propName}_init`,
                handle: `__${propName}_handle`,
                onchange: `__${propName}_onchange`,
                detatch: `__${propName}_detatch`,
                attatch: `__${propName}_attatch`,
                check: `__${propName}_check`
            }
        }

        function addToInstance (object, propName) {
            const p = propnames(propName);
            object[p.prop] = undefined;
            object[p.init] = false;
            object[p.handle] = undefined;
        }

        function addToPrototype (_prototype, propName, options={}) {

            const p = propnames(propName);

            function detatch() {
                // unsubscribe from source change event
                let {mutable=false} = options;
                if (mutable && this[p.prop]) {
                    let handle = this[p.handle];
                    this[p.prop].remove_callback(handle);
                    this[p.handle] = undefined;
                }
                this[p.prop] = undefined;
            }
        
            function attatch(source) {
                let {mutable=false} = options;
                if (!this[p.init] || mutable) {
                    this[p.prop] = source;
                    this[p.init] = true;
                    // subscribe to callback from source
                    const handler = this[p.onchange].bind(this);
                    this[p.handle] = source.add_callback(handler);
                    handler();
                } else {
                    throw new Error(`${propName} can not be reassigned`);
                }
            }


            /**
             * 
             * object must implement
             * __{propName}_onchange() {}
             * 
             * object can implement
             * __{propName}_check(source) {}
             */

            // getter and setter
            Object.defineProperty(_prototype, propName, {
                get: function () {
                    return this[p.prop];
                },
                set: function (src) {
                    if (this[p.check]) {
                        this[p.check](src);
                    }
                    if (src != this[p.prop]) {
                        this[p.detatch]();
                        this[p.attatch](src);
                    }
                }

            });

            const api = {};
            api[p.detatch] = detatch;
            api[p.attatch] = attatch;

            Object.assign(_prototype, api);
        }
        return {addToInstance, addToPrototype};
    }();

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

    /************************************************
     * STATE PROVIDER BASE
     ************************************************/

    /*
        Base class for all state providers

        - object with collection of items
        - could be local - or proxy to online source

        represents a dynamic collection of items
        {itv, type, ...data}
    */

    class StateProviderBase {

        constructor() {
            callback.addToInstance(this);
        }

        // public update function
        update(items){
            return Promise.resolve()
                .then(() => {
                    return this._update(items);
                });
        }

        handle_update(items) {
            throw new Error("not implemented");
        }

        get items() {
            throw new Error("not implemented");
        }
    }
    callback.addToPrototype(StateProviderBase.prototype);


    /************************************************
     * LAYER BASE
     ************************************************/

    class LayerBase {

        constructor() {
            callback.addToInstance(this);
        }

        /**********************************************************
         * QUERY
         **********************************************************/

        query (offset) {
            throw new Error("Not implemented");
        }
    }
    callback.addToPrototype(LayerBase.prototype);


    /************************************************
     * CURSOR BASE
     ************************************************/

    class CursorBase {

        constructor () {
            callback.addToInstance(this);
            // define change event
            eventify.addToInstance(this);
            this.eventifyDefine("change", {init:true});
        }
        
        /**********************************************************
         * QUERY
         **********************************************************/

        query () {
            throw new Error("Not implemented");
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
            return bind(this, callback, delay, options);
        }
        release(handle) {
            return release(handle);
        }

    }
    callback.addToPrototype(CursorBase.prototype);
    eventify.addToPrototype(CursorBase.prototype);

    /***************************************************************
        SIMPLE STATE PROVIDER (LOCAL)
    ***************************************************************/

    /**
     * Local Array with non overlapping items.
     */

    class SimpleStateProvider extends StateProviderBase {

        constructor(options={}) {
            super();
            this._items = [];
            let {items} = options;
            if (items) {
                this.handle_update(items);  
            }
        }

        // internal update function
        _update (items) {
            this._items = check_input$1(items);
            this.notify_callbacks();
        }

        get items () {
            return this._items;
        }

        get info () {
            return {dynamic: true, overlapping: false, local:true};
        }
    }


    function check_input$1(items) {
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
     * NEARBY
     * The nearby method returns information about the neighborhood around offset. 
     * 
     * Returns {
     *      left - high interval endpoint of the first ITEM to the left which does not cover offset, else undefined
     *      center - list of ITEMS covering offset, else []
     *      right - low interval endpoint of the first ITEM to the right which does not cover offset, else undefined
     * }
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


    class SimpleNearbyIndex {

        constructor(options={}) {
            callback.addToInstance(this);
            this._items = [];
            let {items} = options;
            if (items) {
                this.update(items);
            }
        }

        update (items) {
            this._items = check_input(items);
        }


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
            let items = this._items;
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
    callback.addToPrototype(SimpleNearbyIndex.prototype);

    /*********************************************************************
    	UTILS
    *********************************************************************/


    // check input
    function check_input(items) {

        if (items == undefined) {
            items = [];
        }

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

    /*********************************************************************
        NEARBY CACHE
    *********************************************************************/

    /*
        This implements a cache in front of a NearbyIndex.
        
        The purpose of caching is to optimize for repeated
        queries to a NearbyIndex to nearby offsets.

        The cache state includes the nearby state from the 
        index, and also the cached segments corresponding
        to that state. This way, on a cache hit, the 
        query may be satisfied directly from the cache.

        The cache is marked as dirty when the Nearby indexes changes.
    */

    class NearbyCache {

        constructor (nearbyIndex) {
            // nearby index
            this._index = nearbyIndex;
            // cached nearby object
            this._nearby = undefined;
            // cached segment
            this._segment = undefined;
            // dirty flag
            this._dirty = false;
        }

        /**************************************************
            Accessors for Cache state
        ***************************************************/
        
        get nearby () {
            return this._nearby;
        }

        load_segment () {
            // lazy load segment
            if (this._nearby && !this._segment) {
                this._segment = load_segment(this._nearby);
            }
            return this._segment
        }

        /**************************************************
            Dirty Cache
        ***************************************************/

        dirty() {
            this._dirty = true;
        }

        /**************************************************
            Refresh Cache
        ***************************************************/

        /*
            refresh if necessary - else NOOP
            - if nearby is not defined
            - if offset is outside nearby.itv
            - if cache is dirty
        */
        refresh (offset) {
            if (typeof offset === 'number') {
                offset = [offset, 0];
            }
            if (this._nearby == undefined || this._dirty) {
                return this._refresh(offset);
            }
            if (!interval.covers_endpoint(this._nearby.itv, offset)) {
                return this._refresh(offset)
            }
            return false;
        }

        _refresh (offset) {
            this._nearby = this._index.nearby(offset);
            this._segment = undefined;
            this._dirty = false;
            return true;
        }

        /**************************************************
            Query Cache
        ***************************************************/

        query(offset) {
            if (offset == undefined) {
                throw new Error("cache query offset cannot be undefined")
            }
            this.refresh(offset);
            if (!this._segment) {
                this._segment = load_segment(this._nearby);
            }
            return this._segment.query(offset);
        }
    }



    /*********************************************************************
        LOAD SEGMENT
    *********************************************************************/

    function create_segment(itv, type, args) {
        if (type == "static") {
            return new StaticSegment(itv, args);
        } else if (type == "transition") {
            return new TransitionSegment(itv, args);
        } else if (type == "interpolation") {
            return new InterpolationSegment(itv, args);
        } else if (type == "motion") {
            return new MotionSegment(itv, args);
        } else {
            console.log("unrecognized segment type", type);
        }
    }

    function load_segment(nearby) {
        let {itv, center} = nearby;
        if (center.length == 0) {
            return create_segment(itv, "static", {value:undefined});
        }
        if (center.length == 1) {
            let {type="static", args} = center[0];
            return create_segment(itv, type, args);
        }
        if (center.length > 1) {
            throw new Error("ListSegments not yet supported");
        }
    }

    const nearby = function () {

        function addToInstance(object) {
            let index = new SimpleNearbyIndex();
            object.__nearby_index = index;
            object.__nearby_cache = new NearbyCache(index);
        }

        function update(items) {
            this.__nearby_index.update(items);
            this.__nearby_cache.dirty();
        }

        function query (offset) {
            return this.__nearby_cache.query(offset);
        }

        function addToPrototype(_prototype) {
            const api = {};
            api['__nearby_update'] = update;
            api['__nearby_query'] = query;
            Object.assign(_prototype, api);
        }

        return {addToInstance, addToPrototype}
    }();

    const METHODS = {assign, move, transition, interpolate};


    function cmd (target) {
        if (!(target instanceof CursorBase)) {
            throw new Error(`target must be cursor ${target}`);
        }
        if (!(target.src instanceof StateProviderBase)) {
            throw new Error(`target.src must be stateprovider ${target}`);
        }
        let entries = Object.entries(METHODS)
            .map(([name, method]) => {
                return [
                    name,
                    function(...args) { 
                        let items = method.call(this, target, ...args);
                        return target.src.update(items);  
                    }
                ]
            });
        return Object.fromEntries(entries);
    }

    function assign(target, value) {
        if (value == undefined) {
            return [];
        } else {
            let item = {
                itv: [-Infinity, Infinity, true, true],
                type: "static",
                args: {value}                 
            };
            return [item];
        }
    }

    function move(target, vector={}) {
        let {value, rate, offset} = target.query();
        let {position=value, velocity=rate} = vector;
        let item = {
            itv: [-Infinity, Infinity, true, true],
            type: "motion",
            args: {position, velocity, timestamp:offset}                 
        };
        return [item];
    }

    function transition(target, v0, v1, t0, t1, easing) {
        let items = [
            {
                itv: [-Infinity, t0, true, false],
                type: "static",
                args: {value:v0}
            },
            {
                itv: [t0, t1, true, false],
                type: "transition",
                args: {v0, v1, t0, t1, easing}
            },
            {
                itv: [t1, Infinity, true, true],
                type: "static",
                args: {value: v1}
            }
        ];
        return items;
    }

    function interpolate(target, tuples) {
        let [v0, t0] = tuples[0];
        let [v1, t1] = tuples[tuples.length-1];

        let items = [
            {
                itv: [-Infinity, t0, true, false],
                type: "static",
                args: {value:v0}
            },
            {
                itv: [t0, t1, true, false],
                type: "interpolation",
                args: {tuples}
            },
            {
                itv: [t1, Infinity, true, true],
                type: "static",
                args: {value: v1}
            }
        ];    
        return items;
    }

    /************************************************
     * CLOCK CURSORS
     ************************************************/

    // CLOCK (counting seconds since page load)
    class LocalClock extends CursorBase {
        query () {
            let offset = performance.now()/1000.0;
            return {value:offset, dynamic:true, offset};
        }
    }

    // CLOCK (counting seconds since epoch (1970)
    class LocalEpoch extends CursorBase {
        query () {
            let offset = (Date.now() / 1000.0);
            return {value:offset, dynamic:true, offset};
        }
    }

    const local_clock = new LocalClock();
    new LocalEpoch();



    /************************************************
     * CURSOR
     ************************************************/

    /**
     * 
     * Cursor is a variable
     * - has mutable ctrl cursor (default local clock)
     * - has mutable state provider (src) (default state undefined)
     * - methods for assign, move, transition, intepolation
     * 
     */

    class Cursor extends CursorBase {

        constructor (options={}) {
            super();
            // ctrl
            source.addToInstance(this, "ctrl");
            // src
            source.addToInstance(this, "src");
            // nearby
            nearby.addToInstance(this);
            // initialse clock

            // initialise ctrl
            let {ctrl} = options;
            if (ctrl == undefined) {
                ctrl = local_clock;
            }
            this.ctrl = ctrl;

            // initialise state
            let {src} = options;
            if (src == undefined) {
                src = new SimpleStateProvider();
            }
            this.src = src;
        }

        // check ctrl
        __ctrl_check(ctrl) {
            if (!(ctrl instanceof CursorBase)) {
                throw new Error(`"ctrl" must be cursor ${ctrl}`)
            }
        }
        
        // check src
        __src_check(src) {
            if (!(src instanceof StateProviderBase)) {
                throw new Error(`"src" must be state provider ${source}`);
            }
        }

        // ctrl or src changes
        __ctrl_onchange() {
            this.__onchange();
        }
        __src_onchange() {
            this.__onchange();
        }
        __onchange() {
            if (this.src && this.ctrl) {
                let items = this.src.items;
                this.__nearby_update(items);
                // trigger change event for cursor
                this.eventifyTrigger("change", this.query());    
            }
        }

        /**********************************************************
         * QUERY
         **********************************************************/
        query () {
            let {value:offset} = this.ctrl.query();
            if (typeof offset !== 'number') {
                throw new Error(`warning: ctrl state must be number ${offset}`);
            }
            return this.__nearby_cache.query(offset);
        }

        /**********************************************************
         * CONVENIENCE
         **********************************************************/

        get value () {return this.query().value};

        assign(value) {
            return cmd(this).assign(value);
        }
        move ({position, velocity}) {
            let {value, rate, offset:timestamp} = this.query();
            if (typeof value !== 'number') {
                throw new Error(`warning: cursor state must be number ${value}`);
            }
            position = (position != undefined) ? position : value;
            velocity = (velocity != undefined) ? velocity: rate;
            return cmd(this).move({position, velocity, timestamp});
        }
        transition ({target, duration, easing}) {
            let {value:v0, offset:t0} = this.query();
            if (typeof v0 !== 'number') {
                throw new Error(`warning: cursor state must be number ${v0}`);
            }
            return cmd(this).transition(v0, target, t0, t0 + duration, easing);
        }
        interpolate ({tuples, duration}) {
            let t0 = this.query().offset;
            // assuming timstamps are in range [0,1]
            // scale timestamps to duration
            tuples = tuples.map(([v,t]) => {
                return [v, t0 + t*duration];
            });
            return cmd(this).interpolate(tuples);
        }


    }
    source.addToPrototype(Cursor.prototype, "src", {mutable:true});
    source.addToPrototype(Cursor.prototype, "ctrl", {mutable:true});
    nearby.addToPrototype(Cursor.prototype);

    exports.Cursor = Cursor;
    exports.cmd = cmd;
    exports.segments = segments;

    return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pbnRlcnZhbHMuanMiLCIuLi8uLi9zcmMvc2VnbWVudHMuanMiLCIuLi8uLi9zcmMvZXZlbnRpZnkuanMiLCIuLi8uLi9zcmMvdXRpbC5qcyIsIi4uLy4uL3NyYy9tb25pdG9yLmpzIiwiLi4vLi4vc3JjL2Jhc2VzLmpzIiwiLi4vLi4vc3JjL3N0YXRlcHJvdmlkZXJfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL25lYXJieWluZGV4X3NpbXBsZS5qcyIsIi4uLy4uL3NyYy9uZWFyYnljYWNoZS5qcyIsIi4uLy4uL3NyYy9jb21tb24uanMiLCIuLi8uLi9zcmMvY21kLmpzIiwiLi4vLi4vc3JjL2N1cnNvcnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gICAgKiBcbiAgICAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAgICAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICAgICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gICAgKiBcbiAgICAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICAgICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAgICAqIFxuICAgICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG5cbiovXG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuXG5cbiAgICBOT1RFIFxuICAgIC0gY21wKDRdLFs0ICkgPT0gMCAtIHNpbmNlIHRoZXNlIGFyZSB0aGUgc2FtZSB3aXRoIHJlc3BlY3QgdG8gc29ydGluZ1xuICAgIC0gYnV0IGlmIHlvdSB3YW50IHRvIHNlZSBpZiB0d28gaW50ZXJ2YWxzIGFyZSBvdmVybGFwcGluZyBpbiB0aGUgZW5kcG9pbnRzXG4gICAgY21wKGhpZ2hfYSwgbG93X2IpID4gMCB0aGlzIHdpbGwgbm90IGJlIGdvb2RcbiAgICBcbiovIFxuXG5mdW5jdGlvbiBlbmRwb2ludF9jbXAgKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIGxldCBkaWZmID0gdjEgLSB2MjtcbiAgICByZXR1cm4gKGRpZmYgIT0gMCkgPyBkaWZmIDogczEgLSBzMjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludCB0byB0aGUgb3RoZXIgc2lkZVxuICogXG4gKiB1c2VmdWwgZm9yIG1ha2luZyBiYWNrLXRvLWJhY2sgaW50ZXJ2YWxzIFxuICogXG4gKiBoaWdoKSA8LT4gW2xvd1xuICogaGlnaF0gPC0+IChsb3dcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKHAsIHRhcmdldCkge1xuICAgIGxldCBbdixzXSA9IHA7XG4gICAgaWYgKHRhcmdldCA9PSBcImxvd1wiKSB7XG4gICAgXHQvLyBhc3N1bWUgcG9pbnQgaXMgaGlnaDogc2lnbiBtdXN0IGJlIC0xIG9yIDBcbiAgICBcdGlmIChzID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBsb3dcIik7ICAgIFx0XHRcbiAgICBcdH1cbiAgICAgICAgcCA9IFt2LCBzKzFdO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09IFwiaGlnaFwiKSB7XG5cdFx0Ly8gYXNzdW1lIHBvaW50IGlzIGxvdzogc2lnbiBpcyAwIG9yIDFcbiAgICBcdGlmIChzIDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBoaWdoXCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcy0xXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0eXBlXCIsIHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBsZXQgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBsZXQgbG93X3AgPSAobG93Q2xvc2VkKSA/IFtsb3csIDBdIDogW2xvdywgMV07IFxuICAgIGxldCBoaWdoX3AgPSAoaGlnaENsb3NlZCkgPyBbaGlnaCwgMF0gOiBbaGlnaCwgLTFdO1xuICAgIHJldHVybiBbbG93X3AsIGhpZ2hfcF07XG59XG5cblxuLypcbiAgICBJTlRFUlZBTFNcblxuICAgIEludGVydmFscyBhcmUgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXVxuXG4qLyBcblxuLypcbiAgICByZXR1cm4gdHJ1ZSBpZiBwb2ludCBwIGlzIGNvdmVyZWQgYnkgaW50ZXJ2YWwgaXR2XG4gICAgcG9pbnQgcCBjYW4gYmUgbnVtYmVyIHAgb3IgYSBwb2ludCBbcCxzXVxuXG4gICAgaW1wbGVtZW50ZWQgYnkgY29tcGFyaW5nIHBvaW50c1xuICAgIGV4Y2VwdGlvbiBpZiBpbnRlcnZhbCBpcyBub3QgZGVmaW5lZFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIHApIHtcbiAgICBsZXQgW2xvd19wLCBoaWdoX3BdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAvLyBjb3ZlcnM6IGxvdyA8PSBwIDw9IGhpZ2hcbiAgICByZXR1cm4gZW5kcG9pbnRfbGUobG93X3AsIHApICYmIGVuZHBvaW50X2xlKHAsIGhpZ2hfcCk7XG59XG4vLyBjb252ZW5pZW5jZVxuZnVuY3Rpb24gaW50ZXJ2YWxfY292ZXJzX3BvaW50KGl0diwgcCkge1xuICAgIHJldHVybiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBbcCwgMF0pO1xufVxuXG5cblxuLypcbiAgICBSZXR1cm4gdHJ1ZSBpZiBpbnRlcnZhbCBoYXMgbGVuZ3RoIDBcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9pc19zaW5ndWxhcihpbnRlcnZhbCkge1xuICAgIHJldHVybiBpbnRlcnZhbFswXSA9PSBpbnRlcnZhbFsxXVxufVxuXG4vKlxuICAgIENyZWF0ZSBpbnRlcnZhbCBmcm9tIGVuZHBvaW50c1xuKi9cbmZ1bmN0aW9uIGludGVydmFsX2Zyb21fZW5kcG9pbnRzKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIC8vIHAxIG11c3QgYmUgYSBsb3cgcG9pbnRcbiAgICBpZiAoczEgPT0gLTEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBsb3cgcG9pbnRcIiwgcDEpO1xuICAgIH1cbiAgICBpZiAoczIgPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2VhbCBoaWdoIHBvaW50XCIsIHAyKTsgICBcbiAgICB9XG4gICAgcmV0dXJuIFt2MSwgdjIsIChzMT09MCksIChzMj09MCldXG59XG5cblxuZXhwb3J0IGNvbnN0IGVuZHBvaW50ID0ge1xuICAgIGxlOiBlbmRwb2ludF9sZSxcbiAgICBsdDogZW5kcG9pbnRfbHQsXG4gICAgZ2U6IGVuZHBvaW50X2dlLFxuICAgIGd0OiBlbmRwb2ludF9ndCxcbiAgICBjbXA6IGVuZHBvaW50X2NtcCxcbiAgICBlcTogZW5kcG9pbnRfZXEsXG4gICAgbWluOiBlbmRwb2ludF9taW4sXG4gICAgbWF4OiBlbmRwb2ludF9tYXgsXG4gICAgZmxpcDogZW5kcG9pbnRfZmxpcCxcbiAgICBmcm9tX2ludGVydmFsOiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbFxufVxuZXhwb3J0IGNvbnN0IGludGVydmFsID0ge1xuICAgIGNvdmVyc19lbmRwb2ludDogaW50ZXJ2YWxfY292ZXJzX2VuZHBvaW50LFxuICAgIGNvdmVyc19wb2ludDogaW50ZXJ2YWxfY292ZXJzX3BvaW50LCBcbiAgICBpc19zaW5ndWxhcjogaW50ZXJ2YWxfaXNfc2luZ3VsYXIsXG4gICAgZnJvbV9lbmRwb2ludHM6IGludGVydmFsX2Zyb21fZW5kcG9pbnRzXG59XG4iLCJpbXBvcnQge2ludGVydmFsfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbkJBU0UgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLypcblx0QWJzdHJhY3QgQmFzZSBDbGFzcyBmb3IgU2VnbWVudHNcblxuICAgIGNvbnN0cnVjdG9yKGludGVydmFsKVxuXG4gICAgLSBpbnRlcnZhbDogaW50ZXJ2YWwgb2YgdmFsaWRpdHkgb2Ygc2VnbWVudFxuICAgIC0gZHluYW1pYzogdHJ1ZSBpZiBzZWdtZW50IGlzIGR5bmFtaWNcbiAgICAtIHZhbHVlKG9mZnNldCk6IHZhbHVlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4gICAgLSBxdWVyeShvZmZzZXQpOiBzdGF0ZSBvZiBzZWdtZW50IGF0IG9mZnNldFxuKi9cblxuZXhwb3J0IGNsYXNzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYpIHtcblx0XHR0aGlzLl9pdHYgPSBpdHY7XG5cdH1cblxuXHRnZXQgaXR2KCkge3JldHVybiB0aGlzLl9pdHY7fVxuXG4gICAgLyoqIFxuICAgICAqIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzXG4gICAgICogcmV0dXJucyB7dmFsdWUsIGR5bmFtaWN9O1xuICAgICovXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgXHR0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY29udmVuaWVuY2UgZnVuY3Rpb24gcmV0dXJuaW5nIHRoZSBzdGF0ZSBvZiB0aGUgc2VnbWVudFxuICAgICAqIEBwYXJhbSB7Kn0gb2Zmc2V0IFxuICAgICAqIEByZXR1cm5zIFxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX2l0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHsuLi50aGlzLnN0YXRlKG9mZnNldCksIG9mZnNldH07XG4gICAgICAgIH0gXG4gICAgICAgIHJldHVybiB7dmFsdWU6IHVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUlMgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJzU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcblx0XHR0aGlzLl9sYXllcnMgPSBhcmdzLmxheWVycztcbiAgICAgICAgdGhpcy5fdmFsdWVfZnVuYyA9IGFyZ3MudmFsdWVfZnVuY1xuXG4gICAgICAgIC8vIFRPRE8gLSBmaWd1cmUgb3V0IGR5bmFtaWMgaGVyZT9cbiAgICB9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIC8vIFRPRE8gLSB1c2UgdmFsdWUgZnVuY1xuICAgICAgICAvLyBmb3Igbm93IC0ganVzdCB1c2UgZmlyc3QgbGF5ZXJcbiAgICAgICAgcmV0dXJuIHsuLi50aGlzLl9sYXllcnNbMF0ucXVlcnkob2Zmc2V0KSwgb2Zmc2V0fTtcblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNUQVRJQyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX3ZhbHVlID0gYXJncy52YWx1ZTtcblx0fVxuXG5cdHN0YXRlKCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl92YWx1ZSwgZHluYW1pYzpmYWxzZX1cblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE1PVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuICAgIEltcGxlbWVudHMgZGV0ZXJtaW5pc3RpYyBwcm9qZWN0aW9uIGJhc2VkIG9uIGluaXRpYWwgY29uZGl0aW9ucyBcbiAgICAtIG1vdGlvbiB2ZWN0b3IgZGVzY3JpYmVzIG1vdGlvbiB1bmRlciBjb25zdGFudCBhY2NlbGVyYXRpb25cbiovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBwb3NpdGlvbjpwMCwgdmVsb2NpdHk6djAsIHRpbWVzdGFtcDp0MFxuICAgICAgICB9ID0gYXJncztcbiAgICAgICAgLy8gY3JlYXRlIG1vdGlvbiB0cmFuc2l0aW9uXG4gICAgICAgIGNvbnN0IGEwID0gMDtcbiAgICAgICAgdGhpcy5fdmVsb2NpdHkgPSB2MDtcbiAgICAgICAgdGhpcy5fcG9zaXRpb24gPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIGxldCBkID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHJldHVybiBwMCArIHYwKmQgKyAwLjUqYTAqZCpkO1xuICAgICAgICB9OyAgIFxuICAgIH1cblxuICAgIHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmFsdWU6IHRoaXMuX3Bvc2l0aW9uKG9mZnNldCksIFxuICAgICAgICAgICAgcmF0ZTogdGhpcy5fdmVsb2NpdHksIFxuICAgICAgICAgICAgZHluYW1pYzogdGhpcy5fdmVsb2NpdHkgIT0gMFxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRSQU5TSVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIFN1cHBvcnRlZCBlYXNpbmcgZnVuY3Rpb25zXG4gICAgXCJlYXNlLWluXCI6XG4gICAgXCJlYXNlLW91dFwiOlxuICAgIFwiZWFzZS1pbi1vdXRcIlxuKi9cblxuZnVuY3Rpb24gZWFzZWluICh0cykge1xuICAgIHJldHVybiBNYXRoLnBvdyh0cywyKTsgIFxufVxuZnVuY3Rpb24gZWFzZW91dCAodHMpIHtcbiAgICByZXR1cm4gMSAtIGVhc2VpbigxIC0gdHMpO1xufVxuZnVuY3Rpb24gZWFzZWlub3V0ICh0cykge1xuICAgIGlmICh0cyA8IC41KSB7XG4gICAgICAgIHJldHVybiBlYXNlaW4oMiAqIHRzKSAvIDI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICgyIC0gZWFzZWluKDIgKiAoMSAtIHRzKSkpIC8gMjtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFuc2l0aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcblx0XHRzdXBlcihpdHYpO1xuICAgICAgICBsZXQge3YwLCB2MSwgZWFzaW5nfSA9IGFyZ3M7XG4gICAgICAgIGxldCBbdDAsIHQxXSA9IHRoaXMuX2l0di5zbGljZSgwLDIpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgdHJhbnNpdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl9keW5hbWljID0gdjEtdjAgIT0gMDtcbiAgICAgICAgdGhpcy5fdHJhbnMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgdHMgdG8gW3QwLHQxXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzaGlmdCBmcm9tIFt0MCx0MV0tc3BhY2UgdG8gWzAsKHQxLXQwKV0tc3BhY2VcbiAgICAgICAgICAgIC8vIC0gc2NhbGUgZnJvbSBbMCwodDEtdDApXS1zcGFjZSB0byBbMCwxXS1zcGFjZVxuICAgICAgICAgICAgdHMgPSB0cyAtIHQwO1xuICAgICAgICAgICAgdHMgPSB0cy9wYXJzZUZsb2F0KHQxLXQwKTtcbiAgICAgICAgICAgIC8vIGVhc2luZyBmdW5jdGlvbnMgc3RyZXRjaGVzIG9yIGNvbXByZXNzZXMgdGhlIHRpbWUgc2NhbGUgXG4gICAgICAgICAgICBpZiAoZWFzaW5nID09IFwiZWFzZS1pblwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW4odHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlb3V0KHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWFzaW5nID09IFwiZWFzZS1pbi1vdXRcIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZWlub3V0KHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc2l0aW9uIGZyb20gdjAgdG8gdjEsIGZvciB0aW1lIHZhbHVlcyBbMCwxXVxuICAgICAgICAgICAgdHMgPSBNYXRoLm1heCh0cywgMCk7XG4gICAgICAgICAgICB0cyA9IE1hdGgubWluKHRzLCAxKTtcbiAgICAgICAgICAgIHJldHVybiB2MCArICh2MS12MCkqdHM7XG4gICAgICAgIH1cblx0fVxuXG5cdHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl90cmFucyhvZmZzZXQpLCBkeW5hbWljOnRoaXMuX2R5bmFtaWN9XG5cdH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElOVEVSUE9MQVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9uIHRvIGNyZWF0ZSBhbiBpbnRlcnBvbGF0b3IgZm9yIG5lYXJlc3QgbmVpZ2hib3IgaW50ZXJwb2xhdGlvbiB3aXRoXG4gKiBleHRyYXBvbGF0aW9uIHN1cHBvcnQuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdHVwbGVzIC0gQW4gYXJyYXkgb2YgW3ZhbHVlLCBvZmZzZXRdIHBhaXJzLCB3aGVyZSB2YWx1ZSBpcyB0aGVcbiAqIHBvaW50J3MgdmFsdWUgYW5kIG9mZnNldCBpcyB0aGUgY29ycmVzcG9uZGluZyBvZmZzZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gQSBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIG9mZnNldCBhbmQgcmV0dXJucyB0aGVcbiAqIGludGVycG9sYXRlZCBvciBleHRyYXBvbGF0ZWQgdmFsdWUuXG4gKi9cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUodHVwbGVzKSB7XG5cbiAgICBpZiAodHVwbGVzLmxlbmd0aCA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHVuZGVmaW5lZDt9XG4gICAgfSBlbHNlIGlmICh0dXBsZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHR1cGxlc1swXVswXTt9XG4gICAgfVxuXG4gICAgLy8gU29ydCB0aGUgdHVwbGVzIGJ5IHRoZWlyIG9mZnNldHNcbiAgICBjb25zdCBzb3J0ZWRUdXBsZXMgPSBbLi4udHVwbGVzXS5zb3J0KChhLCBiKSA9PiBhWzFdIC0gYlsxXSk7XG4gIFxuICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3Iob2Zmc2V0KSB7XG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBiZWZvcmUgdGhlIGZpcnN0IHBvaW50XG4gICAgICBpZiAob2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1swXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1swXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbMV07XG4gICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gSGFuZGxlIGV4dHJhcG9sYXRpb24gYWZ0ZXIgdGhlIGxhc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMl07XG4gICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICBcbiAgICAgIC8vIEZpbmQgdGhlIG5lYXJlc3QgcG9pbnRzIHRvIHRoZSBsZWZ0IGFuZCByaWdodFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW2ldWzFdICYmIG9mZnNldCA8PSBzb3J0ZWRUdXBsZXNbaSArIDFdWzFdKSB7XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbaV07XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbaSArIDFdO1xuICAgICAgICAgIC8vIExpbmVhciBpbnRlcnBvbGF0aW9uIGZvcm11bGE6IHkgPSB5MSArICggKHggLSB4MSkgKiAoeTIgLSB5MSkgLyAoeDIgLSB4MSkgKVxuICAgICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICBcbiAgICAgIC8vIEluIGNhc2UgdGhlIG9mZnNldCBkb2VzIG5vdCBmYWxsIHdpdGhpbiBhbnkgcmFuZ2UgKHNob3VsZCBiZSBjb3ZlcmVkIGJ5IHRoZSBwcmV2aW91cyBjb25kaXRpb25zKVxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9O1xufVxuICBcblxuZXhwb3J0IGNsYXNzIEludGVycG9sYXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG4gICAgY29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIC8vIHNldHVwIGludGVycG9sYXRpb24gZnVuY3Rpb25cbiAgICAgICAgdGhpcy5fdHJhbnMgPSBpbnRlcnBvbGF0ZShhcmdzLnR1cGxlcyk7XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dHJ1ZX07XG4gICAgfVxufVxuXG5cbiIsIi8qXG5cdENvcHlyaWdodCAyMDIwXG5cdEF1dGhvciA6IEluZ2FyIEFybnR6ZW5cblxuXHRUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgVGltaW5nc3JjIG1vZHVsZS5cblxuXHRUaW1pbmdzcmMgaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeVxuXHRpdCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnlcblx0dGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbiwgZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3Jcblx0KGF0IHlvdXIgb3B0aW9uKSBhbnkgbGF0ZXIgdmVyc2lvbi5cblxuXHRUaW1pbmdzcmMgaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCxcblx0YnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZOyB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2Zcblx0TUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLiAgU2VlIHRoZVxuXHRHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cblxuXHRZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2Vcblx0YWxvbmcgd2l0aCBUaW1pbmdzcmMuICBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz4uXG4qL1xuXG5cblxuLypcblx0RXZlbnRcblx0LSBuYW1lOiBldmVudCBuYW1lXG5cdC0gcHVibGlzaGVyOiB0aGUgb2JqZWN0IHdoaWNoIGRlZmluZWQgdGhlIGV2ZW50XG5cdC0gaW5pdDogdHJ1ZSBpZiB0aGUgZXZlbnQgc3VwcHBvcnRzIGluaXQgZXZlbnRzXG5cdC0gc3Vic2NyaXB0aW9uczogc3Vic2NyaXB0aW5zIHRvIHRoaXMgZXZlbnRcblxuKi9cblxuY2xhc3MgRXZlbnQge1xuXG5cdGNvbnN0cnVjdG9yIChwdWJsaXNoZXIsIG5hbWUsIG9wdGlvbnMpIHtcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXHRcdHRoaXMucHVibGlzaGVyID0gcHVibGlzaGVyO1xuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdFx0dGhpcy5pbml0ID0gKG9wdGlvbnMuaW5pdCA9PT0gdW5kZWZpbmVkKSA/IGZhbHNlIDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucyA9IFtdO1xuXHR9XG5cblx0Lypcblx0XHRzdWJzY3JpYmUgdG8gZXZlbnRcblx0XHQtIHN1YnNjcmliZXI6IHN1YnNjcmliaW5nIG9iamVjdFxuXHRcdC0gY2FsbGJhY2s6IGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGludm9rZVxuXHRcdC0gb3B0aW9uczpcblx0XHRcdGluaXQ6IGlmIHRydWUgc3Vic2NyaWJlciB3YW50cyBpbml0IGV2ZW50c1xuXHQqL1xuXHRzdWJzY3JpYmUgKGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0aWYgKCFjYWxsYmFjayB8fCB0eXBlb2YgY2FsbGJhY2sgIT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgbm90IGEgZnVuY3Rpb25cIiwgY2FsbGJhY2spO1xuXHRcdH1cblx0XHRjb25zdCBzdWIgPSBuZXcgU3Vic2NyaXB0aW9uKHRoaXMsIGNhbGxiYWNrLCBvcHRpb25zKTtcblx0XHR0aGlzLnN1YnNjcmlwdGlvbnMucHVzaChzdWIpO1xuXHQgICAgLy8gSW5pdGlhdGUgaW5pdCBjYWxsYmFjayBmb3IgdGhpcyBzdWJzY3JpcHRpb25cblx0ICAgIGlmICh0aGlzLmluaXQgJiYgc3ViLmluaXQpIHtcblx0ICAgIFx0c3ViLmluaXRfcGVuZGluZyA9IHRydWU7XG5cdCAgICBcdGxldCBzZWxmID0gdGhpcztcblx0ICAgIFx0UHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICBcdFx0Y29uc3QgZUFyZ3MgPSBzZWxmLnB1Ymxpc2hlci5ldmVudGlmeUluaXRFdmVudEFyZ3Moc2VsZi5uYW1lKSB8fCBbXTtcblx0ICAgIFx0XHRzdWIuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdCAgICBcdFx0Zm9yIChsZXQgZUFyZyBvZiBlQXJncykge1xuXHQgICAgXHRcdFx0c2VsZi50cmlnZ2VyKGVBcmcsIFtzdWJdLCB0cnVlKTtcblx0ICAgIFx0XHR9XG5cdCAgICBcdH0pO1xuXHQgICAgfVxuXHRcdHJldHVybiBzdWJcblx0fVxuXG5cdC8qXG5cdFx0dHJpZ2dlciBldmVudFxuXG5cdFx0LSBpZiBzdWIgaXMgdW5kZWZpbmVkIC0gcHVibGlzaCB0byBhbGwgc3Vic2NyaXB0aW9uc1xuXHRcdC0gaWYgc3ViIGlzIGRlZmluZWQgLSBwdWJsaXNoIG9ubHkgdG8gZ2l2ZW4gc3Vic2NyaXB0aW9uXG5cdCovXG5cdHRyaWdnZXIgKGVBcmcsIHN1YnMsIGluaXQpIHtcblx0XHRsZXQgZUluZm8sIGN0eDtcblx0XHRmb3IgKGNvbnN0IHN1YiBvZiBzdWJzKSB7XG5cdFx0XHQvLyBpZ25vcmUgdGVybWluYXRlZCBzdWJzY3JpcHRpb25zXG5cdFx0XHRpZiAoc3ViLnRlcm1pbmF0ZWQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRlSW5mbyA9IHtcblx0XHRcdFx0c3JjOiB0aGlzLnB1Ymxpc2hlcixcblx0XHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0XHRzdWI6IHN1Yixcblx0XHRcdFx0aW5pdDogaW5pdFxuXHRcdFx0fVxuXHRcdFx0Y3R4ID0gc3ViLmN0eCB8fCB0aGlzLnB1Ymxpc2hlcjtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHN1Yi5jYWxsYmFjay5jYWxsKGN0eCwgZUFyZywgZUluZm8pO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBFcnJvciBpbiAke3RoaXMubmFtZX06ICR7c3ViLmNhbGxiYWNrfSAke2Vycn1gKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKlxuXHR1bnN1YnNjcmliZSBmcm9tIGV2ZW50XG5cdC0gdXNlIHN1YnNjcmlwdGlvbiByZXR1cm5lZCBieSBwcmV2aW91cyBzdWJzY3JpYmVcblx0Ki9cblx0dW5zdWJzY3JpYmUoc3ViKSB7XG5cdFx0bGV0IGlkeCA9IHRoaXMuc3Vic2NyaXB0aW9ucy5pbmRleE9mKHN1Yik7XG5cdFx0aWYgKGlkeCA+IC0xKSB7XG5cdFx0XHR0aGlzLnN1YnNjcmlwdGlvbnMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRzdWIudGVybWluYXRlKCk7XG5cdFx0fVxuXHR9XG59XG5cblxuLypcblx0U3Vic2NyaXB0aW9uIGNsYXNzXG4qL1xuXG5jbGFzcyBTdWJzY3JpcHRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKGV2ZW50LCBjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5ldmVudCA9IGV2ZW50O1xuXHRcdHRoaXMubmFtZSA9IGV2ZW50Lm5hbWU7XG5cdFx0dGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrXG5cdFx0dGhpcy5pbml0ID0gKG9wdGlvbnMuaW5pdCA9PT0gdW5kZWZpbmVkKSA/IHRoaXMuZXZlbnQuaW5pdCA6IG9wdGlvbnMuaW5pdDtcblx0XHR0aGlzLmluaXRfcGVuZGluZyA9IGZhbHNlO1xuXHRcdHRoaXMudGVybWluYXRlZCA9IGZhbHNlO1xuXHRcdHRoaXMuY3R4ID0gb3B0aW9ucy5jdHg7XG5cdH1cblxuXHR0ZXJtaW5hdGUoKSB7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gdHJ1ZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuZXZlbnQudW5zdWJzY3JpYmUodGhpcyk7XG5cdH1cbn1cblxuXG4vKlxuXG5cdEVWRU5USUZZIElOU1RBTkNFXG5cblx0RXZlbnRpZnkgYnJpbmdzIGV2ZW50aW5nIGNhcGFiaWxpdGllcyB0byBhbnkgb2JqZWN0LlxuXG5cdEluIHBhcnRpY3VsYXIsIGV2ZW50aWZ5IHN1cHBvcnRzIHRoZSBpbml0aWFsLWV2ZW50IHBhdHRlcm4uXG5cdE9wdC1pbiBmb3IgaW5pdGlhbCBldmVudHMgcGVyIGV2ZW50IHR5cGUuXG5cblx0ZXZlbnRpZnlJbml0RXZlbnRBcmdzKG5hbWUpIHtcblx0XHRpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG5cdFx0XHRyZXR1cm4gW3RoaXMuX3ZhbHVlXTtcblx0XHR9XG5cdH1cblxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5SW5zdGFuY2UgKG9iamVjdCkge1xuXHRvYmplY3QuX19ldmVudGlmeV9ldmVudE1hcCA9IG5ldyBNYXAoKTtcblx0b2JqZWN0Ll9fZXZlbnRpZnlfYnVmZmVyID0gW107XG5cdHJldHVybiBvYmplY3Q7XG59O1xuXG5cbi8qXG5cdEVWRU5USUZZIFBST1RPVFlQRVxuXG5cdEFkZCBldmVudGlmeSBmdW5jdGlvbmFsaXR5IHRvIHByb3RvdHlwZSBvYmplY3RcbiovXG5cbmV4cG9ydCBmdW5jdGlvbiBldmVudGlmeVByb3RvdHlwZShfcHJvdG90eXBlKSB7XG5cblx0ZnVuY3Rpb24gZXZlbnRpZnlHZXRFdmVudChvYmplY3QsIG5hbWUpIHtcblx0XHRjb25zdCBldmVudCA9IG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwLmdldChuYW1lKTtcblx0XHRpZiAoZXZlbnQgPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCB1bmRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHJldHVybiBldmVudDtcblx0fVxuXG5cdC8qXG5cdFx0REVGSU5FIEVWRU5UXG5cdFx0LSB1c2VkIG9ubHkgYnkgZXZlbnQgc291cmNlXG5cdFx0LSBuYW1lOiBuYW1lIG9mIGV2ZW50XG5cdFx0LSBvcHRpb25zOiB7aW5pdDp0cnVlfSBzcGVjaWZpZXMgaW5pdC1ldmVudCBzZW1hbnRpY3MgZm9yIGV2ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5RGVmaW5lKG5hbWUsIG9wdGlvbnMpIHtcblx0XHQvLyBjaGVjayB0aGF0IGV2ZW50IGRvZXMgbm90IGFscmVhZHkgZXhpc3Rcblx0XHRpZiAodGhpcy5fX2V2ZW50aWZ5X2V2ZW50TWFwLmhhcyhuYW1lKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRXZlbnQgYWxyZWFkeSBkZWZpbmVkXCIsIG5hbWUpO1xuXHRcdH1cblx0XHR0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuc2V0KG5hbWUsIG5ldyBFdmVudCh0aGlzLCBuYW1lLCBvcHRpb25zKSk7XG5cdH07XG5cblx0Lypcblx0XHRPTlxuXHRcdC0gdXNlZCBieSBzdWJzY3JpYmVyXG5cdFx0cmVnaXN0ZXIgY2FsbGJhY2sgb24gZXZlbnQuXG5cdCovXG5cdGZ1bmN0aW9uIG9uKG5hbWUsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSkuc3Vic2NyaWJlKGNhbGxiYWNrLCBvcHRpb25zKTtcblx0fTtcblxuXHQvKlxuXHRcdE9GRlxuXHRcdC0gdXNlZCBieSBzdWJzY3JpYmVyXG5cdFx0VW4tcmVnaXN0ZXIgYSBoYW5kbGVyIGZyb20gYSBzcGVjZmljIGV2ZW50IHR5cGVcblx0Ki9cblx0ZnVuY3Rpb24gb2ZmKHN1Yikge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIHN1Yi5uYW1lKS51bnN1YnNjcmliZShzdWIpO1xuXHR9O1xuXG5cblx0ZnVuY3Rpb24gZXZlbnRpZnlTdWJzY3JpcHRpb25zKG5hbWUpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpcHRpb25zO1xuXHR9XG5cblxuXG5cdC8qXG5cdFx0VHJpZ2dlciBsaXN0IG9mIGV2ZW50SXRlbXMgb24gb2JqZWN0XG5cblx0XHRldmVudEl0ZW06ICB7bmFtZTouLiwgZUFyZzouLn1cblxuXHRcdGNvcHkgYWxsIGV2ZW50SXRlbXMgaW50byBidWZmZXIuXG5cdFx0cmVxdWVzdCBlbXB0eWluZyB0aGUgYnVmZmVyLCBpLmUuIGFjdHVhbGx5IHRyaWdnZXJpbmcgZXZlbnRzLFxuXHRcdGV2ZXJ5IHRpbWUgdGhlIGJ1ZmZlciBnb2VzIGZyb20gZW1wdHkgdG8gbm9uLWVtcHR5XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsbChldmVudEl0ZW1zKSB7XG5cdFx0aWYgKGV2ZW50SXRlbXMubGVuZ3RoID09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBtYWtlIHRyaWdnZXIgaXRlbXNcblx0XHQvLyByZXNvbHZlIG5vbi1wZW5kaW5nIHN1YnNjcmlwdGlvbnMgbm93XG5cdFx0Ly8gZWxzZSBzdWJzY3JpcHRpb25zIG1heSBjaGFuZ2UgZnJvbSBwZW5kaW5nIHRvIG5vbi1wZW5kaW5nXG5cdFx0Ly8gYmV0d2VlbiBoZXJlIGFuZCBhY3R1YWwgdHJpZ2dlcmluZ1xuXHRcdC8vIG1ha2UgbGlzdCBvZiBbZXYsIGVBcmcsIHN1YnNdIHR1cGxlc1xuXHRcdGxldCB0cmlnZ2VySXRlbXMgPSBldmVudEl0ZW1zLm1hcCgoaXRlbSkgPT4ge1xuXHRcdFx0bGV0IHtuYW1lLCBlQXJnfSA9IGl0ZW07XG5cdFx0XHRsZXQgZXYgPSBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpO1xuXHRcdFx0bGV0IHN1YnMgPSBldi5zdWJzY3JpcHRpb25zLmZpbHRlcihzdWIgPT4gc3ViLmluaXRfcGVuZGluZyA9PSBmYWxzZSk7XG5cdFx0XHRyZXR1cm4gW2V2LCBlQXJnLCBzdWJzXTtcblx0XHR9LCB0aGlzKTtcblxuXHRcdC8vIGFwcGVuZCB0cmlnZ2VyIEl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGNvbnN0IGxlbiA9IHRyaWdnZXJJdGVtcy5sZW5ndGg7XG5cdFx0Y29uc3QgYnVmID0gdGhpcy5fX2V2ZW50aWZ5X2J1ZmZlcjtcblx0XHRjb25zdCBidWZfbGVuID0gdGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGg7XG5cdFx0Ly8gcmVzZXJ2ZSBtZW1vcnkgLSBzZXQgbmV3IGxlbmd0aFxuXHRcdHRoaXMuX19ldmVudGlmeV9idWZmZXIubGVuZ3RoID0gYnVmX2xlbiArIGxlbjtcblx0XHQvLyBjb3B5IHRyaWdnZXJJdGVtcyB0byBidWZmZXJcblx0XHRmb3IgKGxldCBpPTA7IGk8bGVuOyBpKyspIHtcblx0XHRcdGJ1ZltidWZfbGVuK2ldID0gdHJpZ2dlckl0ZW1zW2ldO1xuXHRcdH1cblx0XHQvLyByZXF1ZXN0IGVtcHR5aW5nIG9mIHRoZSBidWZmZXJcblx0XHRpZiAoYnVmX2xlbiA9PSAwKSB7XG5cdFx0XHRsZXQgc2VsZiA9IHRoaXM7XG5cdFx0XHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRmb3IgKGxldCBbZXYsIGVBcmcsIHN1YnNdIG9mIHNlbGYuX19ldmVudGlmeV9idWZmZXIpIHtcblx0XHRcdFx0XHQvLyBhY3R1YWwgZXZlbnQgdHJpZ2dlcmluZ1xuXHRcdFx0XHRcdGV2LnRyaWdnZXIoZUFyZywgc3VicywgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGYuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdC8qXG5cdFx0VHJpZ2dlciBtdWx0aXBsZSBldmVudHMgb2Ygc2FtZSB0eXBlIChuYW1lKVxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXJBbGlrZShuYW1lLCBlQXJncykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChlQXJncy5tYXAoZUFyZyA9PiB7XG5cdFx0XHRyZXR1cm4ge25hbWUsIGVBcmd9O1xuXHRcdH0pKTtcblx0fVxuXG5cdC8qXG5cdFx0VHJpZ2dlciBzaW5nbGUgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyKG5hbWUsIGVBcmcpIHtcblx0XHRyZXR1cm4gdGhpcy5ldmVudGlmeVRyaWdnZXJBbGwoW3tuYW1lLCBlQXJnfV0pO1xuXHR9XG5cblx0X3Byb3RvdHlwZS5ldmVudGlmeURlZmluZSA9IGV2ZW50aWZ5RGVmaW5lO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlciA9IGV2ZW50aWZ5VHJpZ2dlcjtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXJBbGlrZSA9IGV2ZW50aWZ5VHJpZ2dlckFsaWtlO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsbCA9IGV2ZW50aWZ5VHJpZ2dlckFsbDtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVN1YnNjcmlwdGlvbnMgPSBldmVudGlmeVN1YnNjcmlwdGlvbnM7XG5cdF9wcm90b3R5cGUub24gPSBvbjtcblx0X3Byb3RvdHlwZS5vZmYgPSBvZmY7XG59O1xuXG5cbmV4cG9ydCBjb25zdCBldmVudGlmeSA9IGZ1bmN0aW9uICgpIHtcblx0cmV0dXJuIHtcblx0XHRhZGRUb0luc3RhbmNlOiBldmVudGlmeUluc3RhbmNlLFxuXHRcdGFkZFRvUHJvdG90eXBlOiBldmVudGlmeVByb3RvdHlwZVxuXHR9XG59KCk7XG5cbi8qXG5cdEV2ZW50IFZhcmlhYmxlXG5cblx0T2JqZWN0cyB3aXRoIGEgc2luZ2xlIFwiY2hhbmdlXCIgZXZlbnRcbiovXG5cbmV4cG9ydCBjbGFzcyBFdmVudFZhcmlhYmxlIHtcblxuXHRjb25zdHJ1Y3RvciAodmFsdWUpIHtcblx0XHRldmVudGlmeUluc3RhbmNlKHRoaXMpO1xuXHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0dGhpcy5ldmVudGlmeURlZmluZShcImNoYW5nZVwiLCB7aW5pdDp0cnVlfSk7XG5cdH1cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG5cdGdldCB2YWx1ZSAoKSB7cmV0dXJuIHRoaXMuX3ZhbHVlfTtcblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdGlmICh2YWx1ZSAhPSB0aGlzLl92YWx1ZSkge1xuXHRcdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHRcdHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHZhbHVlKTtcblx0XHR9XG5cdH1cbn1cbmV2ZW50aWZ5UHJvdG90eXBlKEV2ZW50VmFyaWFibGUucHJvdG90eXBlKTtcblxuLypcblx0RXZlbnQgQm9vbGVhblxuXG5cblx0Tm90ZSA6IGltcGxlbWVudGF0aW9uIHVzZXMgZmFsc2luZXNzIG9mIGlucHV0IHBhcmFtZXRlciB0byBjb25zdHJ1Y3RvciBhbmQgc2V0KCkgb3BlcmF0aW9uLFxuXHRzbyBldmVudEJvb2xlYW4oLTEpIHdpbGwgYWN0dWFsbHkgc2V0IGl0IHRvIHRydWUgYmVjYXVzZVxuXHQoLTEpID8gdHJ1ZSA6IGZhbHNlIC0+IHRydWUgIVxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50Qm9vbGVhbiBleHRlbmRzIEV2ZW50VmFyaWFibGUge1xuXHRjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuXHRcdHN1cGVyKEJvb2xlYW4odmFsdWUpKTtcblx0fVxuXG5cdHNldCB2YWx1ZSAodmFsdWUpIHtcblx0XHRzdXBlci52YWx1ZSA9IEJvb2xlYW4odmFsdWUpO1xuXHR9XG5cdGdldCB2YWx1ZSAoKSB7cmV0dXJuIHN1cGVyLnZhbHVlfTtcbn1cblxuXG4vKlxuXHRtYWtlIGEgcHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aGVuIEV2ZW50Qm9vbGVhbiBjaGFuZ2VzXG5cdHZhbHVlLlxuKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWtlUHJvbWlzZShldmVudE9iamVjdCwgY29uZGl0aW9uRnVuYykge1xuXHRjb25kaXRpb25GdW5jID0gY29uZGl0aW9uRnVuYyB8fCBmdW5jdGlvbih2YWwpIHtyZXR1cm4gdmFsID09IHRydWV9O1xuXHRyZXR1cm4gbmV3IFByb21pc2UgKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0XHRsZXQgc3ViID0gZXZlbnRPYmplY3Qub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHRpZiAoY29uZGl0aW9uRnVuYyh2YWx1ZSkpIHtcblx0XHRcdFx0cmVzb2x2ZSh2YWx1ZSk7XG5cdFx0XHRcdGV2ZW50T2JqZWN0Lm9mZihzdWIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcbn07XG5cbi8vIG1vZHVsZSBhcGlcbmV4cG9ydCBkZWZhdWx0IHtcblx0ZXZlbnRpZnlQcm90b3R5cGUsXG5cdGV2ZW50aWZ5SW5zdGFuY2UsXG5cdEV2ZW50VmFyaWFibGUsXG5cdEV2ZW50Qm9vbGVhbixcblx0bWFrZVByb21pc2Vcbn07XG5cbiIsIlxuLy8gb3Z2ZXJyaWRlIG1vZHVsbyB0byBiZWhhdmUgYmV0dGVyIGZvciBuZWdhdGl2ZSBudW1iZXJzXG5leHBvcnQgZnVuY3Rpb24gbW9kKG4sIG0pIHtcbiAgICByZXR1cm4gKChuICUgbSkgKyBtKSAlIG07XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZGl2bW9kKHgsIGJhc2UpIHtcbiAgICBsZXQgbiA9IE1hdGguZmxvb3IoeCAvIGJhc2UpXG4gICAgbGV0IHIgPSBtb2QoeCwgYmFzZSk7XG4gICAgcmV0dXJuIFtuLCByXTtcbn1cblxuXG4vKlxuICAgIFRoaXMgYWRkcyBiYXNpYyAoc3luY2hyb25vdXMpIGNhbGxiYWNrIHN1cHBvcnQgdG8gYW4gb2JqZWN0LlxuKi9cblxuZXhwb3J0IGNvbnN0IGNhbGxiYWNrID0gZnVuY3Rpb24gKCkge1xuXG4gICAgZnVuY3Rpb24gYWRkVG9JbnN0YW5jZShvYmplY3QpIHtcbiAgICAgICAgb2JqZWN0Ll9fY2FsbGJhY2tfY2FsbGJhY2tzID0gW107XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkX2NhbGxiYWNrIChoYW5kbGVyKSB7XG4gICAgICAgIGxldCBoYW5kbGUgPSB7XG4gICAgICAgICAgICBoYW5kbGVyOiBoYW5kbGVyXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fX2NhbGxiYWNrX2NhbGxiYWNrcy5wdXNoKGhhbmRsZSk7XG4gICAgICAgIHJldHVybiBoYW5kbGU7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIHJlbW92ZV9jYWxsYmFjayAoaGFuZGxlKSB7XG4gICAgICAgIGxldCBpbmRleCA9IHRoaXMuX19jYWxsYmFja19jYWxsYmFja3MuaW5kZXhvZihoYW5kbGUpO1xuICAgICAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICAgICAgdGhpcy5fX2NhbGxiYWNrX2NhbGxiYWNrcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIG5vdGlmeV9jYWxsYmFja3MgKGVBcmcpIHtcbiAgICAgICAgdGhpcy5fX2NhbGxiYWNrX2NhbGxiYWNrcy5mb3JFYWNoKGZ1bmN0aW9uKGhhbmRsZSkge1xuICAgICAgICAgICAgaGFuZGxlLmhhbmRsZXIoZUFyZyk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cblxuICAgIGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlIChfcHJvdG90eXBlKSB7XG4gICAgICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgICAgIGFkZF9jYWxsYmFjaywgcmVtb3ZlX2NhbGxiYWNrLCBub3RpZnlfY2FsbGJhY2tzXG4gICAgICAgIH1cbiAgICAgICAgT2JqZWN0LmFzc2lnbihfcHJvdG90eXBlLCBhcGkpO1xuICAgIH1cblxuICAgIHJldHVybiB7YWRkVG9JbnN0YW5jZSwgYWRkVG9Qcm90b3R5cGV9XG59KCk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU09VUkNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEV4dGVuZCBhIGNsYXNzIHdpdGggc3VwcG9ydCBmb3IgZXh0ZXJuYWwgc291cmNlIG9uIFxuICogYSBuYW1lZCBwcm9wZXJ0eS5cbiAqIFxuICogb3B0aW9uOiBtdXRhYmxlOnRydWUgbWVhbnMgdGhhdCBwcm9wZXJ5IG1heSBiZSByZXNldCBcbiAqIFxuICogc291cmNlIG9iamVjdCBpcyBhc3N1bWVkIHRvIHN1cHBvcnQgdGhlIGNhbGxiYWNrIGludGVyZmFjZVxuICovXG5cblxuZXhwb3J0IGNvbnN0IHNvdXJjZSA9IGZ1bmN0aW9uICgpIHtcblxuICAgIGZ1bmN0aW9uIHByb3BuYW1lcyAocHJvcE5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHByb3A6IGBfXyR7cHJvcE5hbWV9YCxcbiAgICAgICAgICAgIGluaXQ6IGBfXyR7cHJvcE5hbWV9X2luaXRgLFxuICAgICAgICAgICAgaGFuZGxlOiBgX18ke3Byb3BOYW1lfV9oYW5kbGVgLFxuICAgICAgICAgICAgb25jaGFuZ2U6IGBfXyR7cHJvcE5hbWV9X29uY2hhbmdlYCxcbiAgICAgICAgICAgIGRldGF0Y2g6IGBfXyR7cHJvcE5hbWV9X2RldGF0Y2hgLFxuICAgICAgICAgICAgYXR0YXRjaDogYF9fJHtwcm9wTmFtZX1fYXR0YXRjaGAsXG4gICAgICAgICAgICBjaGVjazogYF9fJHtwcm9wTmFtZX1fY2hlY2tgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRUb0luc3RhbmNlIChvYmplY3QsIHByb3BOYW1lKSB7XG4gICAgICAgIGNvbnN0IHAgPSBwcm9wbmFtZXMocHJvcE5hbWUpXG4gICAgICAgIG9iamVjdFtwLnByb3BdID0gdW5kZWZpbmVkXG4gICAgICAgIG9iamVjdFtwLmluaXRdID0gZmFsc2U7XG4gICAgICAgIG9iamVjdFtwLmhhbmRsZV0gPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkVG9Qcm90b3R5cGUgKF9wcm90b3R5cGUsIHByb3BOYW1lLCBvcHRpb25zPXt9KSB7XG5cbiAgICAgICAgY29uc3QgcCA9IHByb3BuYW1lcyhwcm9wTmFtZSlcblxuICAgICAgICBmdW5jdGlvbiBkZXRhdGNoKCkge1xuICAgICAgICAgICAgLy8gdW5zdWJzY3JpYmUgZnJvbSBzb3VyY2UgY2hhbmdlIGV2ZW50XG4gICAgICAgICAgICBsZXQge211dGFibGU9ZmFsc2V9ID0gb3B0aW9ucztcbiAgICAgICAgICAgIGlmIChtdXRhYmxlICYmIHRoaXNbcC5wcm9wXSkge1xuICAgICAgICAgICAgICAgIGxldCBoYW5kbGUgPSB0aGlzW3AuaGFuZGxlXTtcbiAgICAgICAgICAgICAgICB0aGlzW3AucHJvcF0ucmVtb3ZlX2NhbGxiYWNrKGhhbmRsZSk7XG4gICAgICAgICAgICAgICAgdGhpc1twLmhhbmRsZV0gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzW3AucHJvcF0gPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICBcbiAgICAgICAgZnVuY3Rpb24gYXR0YXRjaChzb3VyY2UpIHtcbiAgICAgICAgICAgIGxldCB7bXV0YWJsZT1mYWxzZX0gPSBvcHRpb25zO1xuICAgICAgICAgICAgaWYgKCF0aGlzW3AuaW5pdF0gfHwgbXV0YWJsZSkge1xuICAgICAgICAgICAgICAgIHRoaXNbcC5wcm9wXSA9IHNvdXJjZTtcbiAgICAgICAgICAgICAgICB0aGlzW3AuaW5pdF0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIC8vIHN1YnNjcmliZSB0byBjYWxsYmFjayBmcm9tIHNvdXJjZVxuICAgICAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSB0aGlzW3Aub25jaGFuZ2VdLmJpbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpc1twLmhhbmRsZV0gPSBzb3VyY2UuYWRkX2NhbGxiYWNrKGhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIGhhbmRsZXIoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3Byb3BOYW1lfSBjYW4gbm90IGJlIHJlYXNzaWduZWRgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFxuICAgICAgICAgKiBvYmplY3QgbXVzdCBpbXBsZW1lbnRcbiAgICAgICAgICogX197cHJvcE5hbWV9X29uY2hhbmdlKCkge31cbiAgICAgICAgICogXG4gICAgICAgICAqIG9iamVjdCBjYW4gaW1wbGVtZW50XG4gICAgICAgICAqIF9fe3Byb3BOYW1lfV9jaGVjayhzb3VyY2UpIHt9XG4gICAgICAgICAqL1xuXG4gICAgICAgIC8vIGdldHRlciBhbmQgc2V0dGVyXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShfcHJvdG90eXBlLCBwcm9wTmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXNbcC5wcm9wXTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uIChzcmMpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1twLmNoZWNrXSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzW3AuY2hlY2tdKHNyYylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNyYyAhPSB0aGlzW3AucHJvcF0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1twLmRldGF0Y2hdKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbcC5hdHRhdGNoXShzcmMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBhcGkgPSB7fTtcbiAgICAgICAgYXBpW3AuZGV0YXRjaF0gPSBkZXRhdGNoO1xuICAgICAgICBhcGlbcC5hdHRhdGNoXSA9IGF0dGF0Y2g7XG5cbiAgICAgICAgT2JqZWN0LmFzc2lnbihfcHJvdG90eXBlLCBhcGkpO1xuICAgIH1cbiAgICByZXR1cm4ge2FkZFRvSW5zdGFuY2UsIGFkZFRvUHJvdG90eXBlfTtcbn0oKTtcblxuIiwiaW1wb3J0IHtkaXZtb2R9IGZyb20gXCIuL3V0aWwuanNcIjtcblxuLypcbiAgICBUaW1lb3V0IE1vbml0b3JcblxuICAgIFRpbWVvdXQgTW9uaXRvciBpcyBzaW1pbGFyIHRvIHNldEludGVydmFsLCBpbiB0aGUgc2Vuc2UgdGhhdCBcbiAgICBpdCBhbGxvd3MgY2FsbGJhY2tzIHRvIGJlIGZpcmVkIHBlcmlvZGljYWxseSBcbiAgICB3aXRoIGEgZ2l2ZW4gZGVsYXkgKGluIG1pbGxpcykuICBcbiAgICBcbiAgICBUaW1lb3V0IE1vbml0b3IgaXMgbWFkZSB0byBzYW1wbGUgdGhlIHN0YXRlIFxuICAgIG9mIGEgZHluYW1pYyBvYmplY3QsIHBlcmlvZGljYWxseS4gRm9yIHRoaXMgcmVhc29uLCBlYWNoIGNhbGxiYWNrIGlzIFxuICAgIGJvdW5kIHRvIGEgbW9uaXRvcmVkIG9iamVjdCwgd2hpY2ggd2UgaGVyZSBjYWxsIGEgdmFyaWFibGUuIFxuICAgIE9uIGVhY2ggaW52b2NhdGlvbiwgYSBjYWxsYmFjayB3aWxsIHByb3ZpZGUgYSBmcmVzaGx5IHNhbXBsZWQgXG4gICAgdmFsdWUgZnJvbSB0aGUgdmFyaWFibGUuXG5cbiAgICBUaGlzIHZhbHVlIGlzIGFzc3VtZWQgdG8gYmUgYXZhaWxhYmxlIGJ5IHF1ZXJ5aW5nIHRoZSB2YXJpYWJsZS4gXG5cbiAgICAgICAgdi5xdWVyeSgpIC0+IHt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0LCB0c31cblxuICAgIEluIGFkZGl0aW9uLCB0aGUgdmFyaWFibGUgb2JqZWN0IG1heSBzd2l0Y2ggYmFjayBhbmQgXG4gICAgZm9ydGggYmV0d2VlbiBkeW5hbWljIGFuZCBzdGF0aWMgYmVoYXZpb3IuIFRoZSBUaW1lb3V0IE1vbml0b3JcbiAgICB0dXJucyBwb2xsaW5nIG9mZiB3aGVuIHRoZSB2YXJpYWJsZSBpcyBubyBsb25nZXIgZHluYW1pYywgXG4gICAgYW5kIHJlc3VtZXMgcG9sbGluZyB3aGVuIHRoZSBvYmplY3QgYmVjb21lcyBkeW5hbWljLlxuXG4gICAgU3RhdGUgY2hhbmdlcyBhcmUgZXhwZWN0ZWQgdG8gYmUgc2lnbmFsbGVkIHRocm91Z2ggYSA8Y2hhbmdlPiBldmVudC5cblxuICAgICAgICBzdWIgPSB2Lm9uKFwiY2hhbmdlXCIsIGNhbGxiYWNrKVxuICAgICAgICB2Lm9mZihzdWIpXG5cbiAgICBDYWxsYmFja3MgYXJlIGludm9rZWQgb24gZXZlcnkgPGNoYW5nZT4gZXZlbnQsIGFzIHdlbGxcbiAgICBhcyBwZXJpb2RpY2FsbHkgd2hlbiB0aGUgb2JqZWN0IGlzIGluIDxkeW5hbWljPiBzdGF0ZS5cblxuICAgICAgICBjYWxsYmFjayh7dmFsdWUsIGR5bmFtaWMsIG9mZnNldCwgdHN9KVxuXG4gICAgRnVydGhlcm1vcmUsIGluIG9yZGVyIHRvIHN1cHBvcnQgY29uc2lzdGVudCByZW5kZXJpbmcgb2ZcbiAgICBzdGF0ZSBjaGFuZ2VzIGZyb20gbWFueSBkeW5hbWljIHZhcmlhYmxlcywgaXQgaXMgaW1wb3J0YW50IHRoYXRcbiAgICBjYWxsYmFja3MgYXJlIGludm9rZWQgYXQgdGhlIHNhbWUgdGltZSBhcyBtdWNoIGFzIHBvc3NpYmxlLCBzb1xuICAgIHRoYXQgY2hhbmdlcyB0aGF0IG9jY3VyIG5lYXIgaW4gdGltZSBjYW4gYmUgcGFydCBvZiB0aGUgc2FtZVxuICAgIHNjcmVlbiByZWZyZXNoLiBcblxuICAgIEZvciB0aGlzIHJlYXNvbiwgdGhlIFRpbWVvdXRNb25pdG9yIGdyb3VwcyBjYWxsYmFja3MgaW4gdGltZVxuICAgIGFuZCBpbnZva2VzIGNhbGxiYWNrcyBhdCBhdCBmaXhlZCBtYXhpbXVtIHJhdGUgKDIwSHovNTBtcykuXG4gICAgVGhpcyBpbXBsaWVzIHRoYXQgcG9sbGluZyBjYWxsYmFja3Mgd2lsbCBmYWxsIG9uIGEgc2hhcmVkIFxuICAgIHBvbGxpbmcgZnJlcXVlbmN5LlxuXG4gICAgQXQgdGhlIHNhbWUgdGltZSwgY2FsbGJhY2tzIG1heSBoYXZlIGluZGl2aWR1YWwgZnJlcXVlbmNpZXMgdGhhdFxuICAgIGFyZSBtdWNoIGxvd2VyIHJhdGUgdGhhbiB0aGUgbWF4aW11bSByYXRlLiBUaGUgaW1wbGVtZW50YXRpb25cbiAgICBkb2VzIG5vdCByZWx5IG9uIGEgZml4ZWQgNTBtcyB0aW1lb3V0IGZyZXF1ZW5jeSwgYnV0IGlzIHRpbWVvdXQgYmFzZWQsXG4gICAgdGh1cyB0aGVyZSBpcyBubyBwcm9jZXNzaW5nIG9yIHRpbWVvdXQgYmV0d2VlbiBjYWxsYmFja3MsIGV2ZW5cbiAgICBpZiBhbGwgY2FsbGJhY2tzIGhhdmUgbG93IHJhdGVzLlxuXG4gICAgSXQgaXMgc2FmZSB0byBkZWZpbmUgbXVsdGlwbGUgY2FsbGFiYWNrcyBmb3IgYSBzaW5nbGUgdmFyaWFibGUsIGVhY2hcbiAgICBjYWxsYmFjayB3aXRoIGEgZGlmZmVyZW50IHBvbGxpbmcgZnJlcXVlbmN5LlxuXG4gICAgb3B0aW9uc1xuICAgICAgICA8cmF0ZT4gLSBkZWZhdWx0IDUwOiBzcGVjaWZ5IG1pbmltdW0gZnJlcXVlbmN5IGluIG1zXG5cbiovXG5cblxuY29uc3QgUkFURV9NUyA9IDUwXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRJTUVPVVQgTU9OSVRPUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIEJhc2UgY2xhc3MgZm9yIFRpbWVvdXQgTW9uaXRvciBhbmQgRnJhbWVyYXRlIE1vbml0b3JcbiovXG5cbmNsYXNzIFRpbWVvdXRNb25pdG9yIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcblxuICAgICAgICB0aGlzLl9vcHRpb25zID0gT2JqZWN0LmFzc2lnbih7cmF0ZTogUkFURV9NU30sIG9wdGlvbnMpO1xuICAgICAgICBpZiAodGhpcy5fb3B0aW9ucy5yYXRlIDwgUkFURV9NUykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbGxlZ2FsIHJhdGUgJHtyYXRlfSwgbWluaW11bSByYXRlIGlzICR7UkFURV9NU31gKTtcbiAgICAgICAgfVxuICAgICAgICAvKlxuICAgICAgICAgICAgbWFwXG4gICAgICAgICAgICBoYW5kbGUgLT4ge2NhbGxiYWNrLCB2YXJpYWJsZSwgZGVsYXl9XG4gICAgICAgICAgICAtIHZhcmlhYmxlOiB0YXJnZXQgZm9yIHNhbXBsaW5nXG4gICAgICAgICAgICAtIGNhbGxiYWNrOiBmdW5jdGlvbih2YWx1ZSlcbiAgICAgICAgICAgIC0gZGVsYXk6IGJldHdlZW4gc2FtcGxlcyAod2hlbiB2YXJpYWJsZSBpcyBkeW5hbWljKVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zZXQgPSBuZXcgU2V0KCk7XG4gICAgICAgIC8qXG4gICAgICAgICAgICB2YXJpYWJsZSBtYXBcbiAgICAgICAgICAgIHZhcmlhYmxlIC0+IHtzdWIsIHBvbGxpbmcsIGhhbmRsZXM6W119XG4gICAgICAgICAgICAtIHN1YiBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAgICAgICAgIC0gcG9sbGluZzogdHJ1ZSBpZiB2YXJpYWJsZSBuZWVkcyBwb2xsaW5nXG4gICAgICAgICAgICAtIGhhbmRsZXM6IGxpc3Qgb2YgaGFuZGxlcyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICAvLyB2YXJpYWJsZSBjaGFuZ2UgaGFuZGxlclxuICAgICAgICB0aGlzLl9fb252YXJpYWJsZWNoYW5nZSA9IHRoaXMuX29udmFyaWFibGVjaGFuZ2UuYmluZCh0aGlzKTtcbiAgICB9XG5cbiAgICBiaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICAgICAgLy8gcmVnaXN0ZXIgYmluZGluZ1xuICAgICAgICBsZXQgaGFuZGxlID0ge2NhbGxiYWNrLCB2YXJpYWJsZSwgZGVsYXl9O1xuICAgICAgICB0aGlzLl9zZXQuYWRkKGhhbmRsZSk7XG4gICAgICAgIC8vIHJlZ2lzdGVyIHZhcmlhYmxlXG4gICAgICAgIGlmICghdGhpcy5fdmFyaWFibGVfbWFwLmhhcyh2YXJpYWJsZSkpIHtcbiAgICAgICAgICAgIGxldCBzdWIgPSB2YXJpYWJsZS5vbihcImNoYW5nZVwiLCB0aGlzLl9fb252YXJpYWJsZWNoYW5nZSk7XG4gICAgICAgICAgICBsZXQgaXRlbSA9IHtzdWIsIHBvbGxpbmc6ZmFsc2UsIGhhbmRsZXM6IFtoYW5kbGVdfTtcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5zZXQodmFyaWFibGUsIGl0ZW0pO1xuICAgICAgICAgICAgLy90aGlzLl9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSkuaGFuZGxlcy5wdXNoKGhhbmRsZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhhbmRsZTtcbiAgICB9XG5cbiAgICByZWxlYXNlKGhhbmRsZSkge1xuICAgICAgICAvLyBjbGVhbnVwXG4gICAgICAgIGxldCByZW1vdmVkID0gdGhpcy5fc2V0LmRlbGV0ZShoYW5kbGUpO1xuICAgICAgICBpZiAoIXJlbW92ZWQpIHJldHVybjtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2xlYW51cCB2YXJpYWJsZSBtYXBcbiAgICAgICAgbGV0IHZhcmlhYmxlID0gaGFuZGxlLnZhcmlhYmxlO1xuICAgICAgICBsZXQge3N1YiwgaGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IGlkeCA9IGhhbmRsZXMuaW5kZXhPZihoYW5kbGUpO1xuICAgICAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgICAgIGhhbmRsZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhhbmRsZXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIC8vIHZhcmlhYmxlIGhhcyBubyBoYW5kbGVzXG4gICAgICAgICAgICAvLyBjbGVhbnVwIHZhcmlhYmxlIG1hcFxuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLmRlbGV0ZSh2YXJpYWJsZSk7XG4gICAgICAgICAgICB2YXJpYWJsZS5vZmYoc3ViKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHZhcmlhYmxlIGVtaXRzIGEgY2hhbmdlIGV2ZW50XG4gICAgKi9cbiAgICBfb252YXJpYWJsZWNoYW5nZSAoZUFyZywgZUluZm8pIHtcbiAgICAgICAgbGV0IHZhcmlhYmxlID0gZUluZm8uc3JjO1xuICAgICAgICAvLyBkaXJlY3QgY2FsbGJhY2sgLSBjb3VsZCB1c2UgZUFyZyBoZXJlXG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IHN0YXRlID0gZUFyZztcbiAgICAgICAgLy8gcmVldmFsdWF0ZSBwb2xsaW5nXG4gICAgICAgIHRoaXMuX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSwgc3RhdGUpO1xuICAgICAgICAvLyBjYWxsYmFja3NcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIGhhbmRsZS5jYWxsYmFjayhzdGF0ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBzdGFydCBvciBzdG9wIHBvbGxpbmcgaWYgbmVlZGVkXG4gICAgKi9cbiAgICBfcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlLCBzdGF0ZSkge1xuICAgICAgICBsZXQgaXRlbSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQge3BvbGxpbmc6d2FzX3BvbGxpbmd9ID0gaXRlbTtcbiAgICAgICAgc3RhdGUgPSBzdGF0ZSB8fCB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICBsZXQgc2hvdWxkX2JlX3BvbGxpbmcgPSBzdGF0ZS5keW5hbWljO1xuICAgICAgICBpZiAoIXdhc19wb2xsaW5nICYmIHNob3VsZF9iZV9wb2xsaW5nKSB7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXRzKHZhcmlhYmxlKTtcbiAgICAgICAgfSBlbHNlIGlmICh3YXNfcG9sbGluZyAmJiAhc2hvdWxkX2JlX3BvbGxpbmcpIHtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fY2xlYXJfdGltZW91dHModmFyaWFibGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgc2V0IHRpbWVvdXQgZm9yIGFsbCBjYWxsYmFja3MgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgKi9cbiAgICBfc2V0X3RpbWVvdXRzKHZhcmlhYmxlKSB7XG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc2V0X3RpbWVvdXQoaGFuZGxlKSB7XG4gICAgICAgIGxldCBkZWx0YSA9IHRoaXMuX2NhbGN1bGF0ZV9kZWx0YShoYW5kbGUuZGVsYXkpO1xuICAgICAgICBsZXQgaGFuZGxlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZV90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHNldFRpbWVvdXQoaGFuZGxlciwgZGVsdGEpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGFkanVzdCBkZWxheSBzbyB0aGF0IGlmIGZhbGxzIG9uXG4gICAgICAgIHRoZSBtYWluIHRpY2sgcmF0ZVxuICAgICovXG4gICAgX2NhbGN1bGF0ZV9kZWx0YShkZWxheSkge1xuICAgICAgICBsZXQgcmF0ZSA9IHRoaXMuX29wdGlvbnMucmF0ZTtcbiAgICAgICAgbGV0IG5vdyA9IE1hdGgucm91bmQocGVyZm9ybWFuY2Uubm93KCkpO1xuICAgICAgICBsZXQgW25vd19uLCBub3dfcl0gPSBkaXZtb2Qobm93LCByYXRlKTtcbiAgICAgICAgbGV0IFtuLCByXSA9IGRpdm1vZChub3cgKyBkZWxheSwgcmF0ZSk7XG4gICAgICAgIGxldCB0YXJnZXQgPSBNYXRoLm1heChuLCBub3dfbiArIDEpKnJhdGU7XG4gICAgICAgIHJldHVybiB0YXJnZXQgLSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBjbGVhciBhbGwgdGltZW91dHMgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgKi9cbiAgICBfY2xlYXJfdGltZW91dHModmFyaWFibGUpIHtcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgaWYgKGhhbmRsZS50aWQgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGhhbmRsZS50aWQpO1xuICAgICAgICAgICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBoYW5kbGUgdGltZW91dFxuICAgICovXG4gICAgX2hhbmRsZV90aW1lb3V0KGhhbmRsZSkge1xuICAgICAgICAvLyBkcm9wIGlmIGhhbmRsZSB0aWQgaGFzIGJlZW4gY2xlYXJlZFxuICAgICAgICBpZiAoaGFuZGxlLnRpZCA9PSB1bmRlZmluZWQpIHJldHVybjtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2FsbGJhY2tcbiAgICAgICAgbGV0IHt2YXJpYWJsZX0gPSBoYW5kbGU7XG4gICAgICAgIGxldCBzdGF0ZSA9IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgIC8vIHJlc2NoZWR1bGUgdGltZW91dHMgZm9yIGNhbGxiYWNrc1xuICAgICAgICBpZiAoc3RhdGUuZHluYW1pYykge1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgbWFrZSBzdXJlIHBvbGxpbmcgc3RhdGUgaXMgYWxzbyBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMgd291bGQgb25seSBvY2N1ciBpZiB0aGUgdmFyaWFibGVcbiAgICAgICAgICAgICAgICB3ZW50IGZyb20gcmVwb3J0aW5nIGR5bmFtaWMgdHJ1ZSB0byBkeW5hbWljIGZhbHNlLFxuICAgICAgICAgICAgICAgIHdpdGhvdXQgZW1taXR0aW5nIGEgY2hhbmdlIGV2ZW50IC0gdGh1c1xuICAgICAgICAgICAgICAgIHZpb2xhdGluZyB0aGUgYXNzdW1wdGlvbi4gVGhpcyBwcmVzZXJ2ZXNcbiAgICAgICAgICAgICAgICBpbnRlcm5hbCBpbnRlZ3JpdHkgaSB0aGUgbW9uaXRvci5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBsZXQgaXRlbSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy9cbiAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHN0YXRlKTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgRlJBTUVSQVRFIE1PTklUT1JcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuXG5jbGFzcyBGcmFtZXJhdGVNb25pdG9yIGV4dGVuZHMgVGltZW91dE1vbml0b3Ige1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgICAgdGhpcy5faGFuZGxlO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHRpbWVvdXRzIGFyZSBvYnNvbGV0ZVxuICAgICovXG4gICAgX3NldF90aW1lb3V0cyh2YXJpYWJsZSkge31cbiAgICBfc2V0X3RpbWVvdXQoaGFuZGxlKSB7fVxuICAgIF9jYWxjdWxhdGVfZGVsdGEoZGVsYXkpIHt9XG4gICAgX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKSB7fVxuICAgIF9oYW5kbGVfdGltZW91dChoYW5kbGUpIHt9XG5cbiAgICBfb252YXJpYWJsZWNoYW5nZSAoZUFyZywgZUluZm8pIHtcbiAgICAgICAgc3VwZXIuX29udmFyaWFibGVjaGFuZ2UoZUFyZywgZUluZm8pO1xuICAgICAgICAvLyBraWNrIG9mZiBjYWxsYmFjayBsb29wIGRyaXZlbiBieSByZXF1ZXN0IGFuaW1hdGlvbmZyYW1lXG4gICAgICAgIHRoaXMuX2NhbGxiYWNrKCk7XG4gICAgfVxuXG4gICAgX2NhbGxiYWNrKCkge1xuICAgICAgICAvLyBjYWxsYmFjayB0byBhbGwgdmFyaWFibGVzIHdoaWNoIHJlcXVpcmUgcG9sbGluZ1xuICAgICAgICBsZXQgdmFyaWFibGVzID0gWy4uLnRoaXMuX3ZhcmlhYmxlX21hcC5lbnRyaWVzKCldXG4gICAgICAgICAgICAuZmlsdGVyKChbdmFyaWFibGUsIGl0ZW1dKSA9PiBpdGVtLnBvbGxpbmcpXG4gICAgICAgICAgICAubWFwKChbdmFyaWFibGUsIGl0ZW1dKSA9PiB2YXJpYWJsZSk7XG4gICAgICAgIGlmICh2YXJpYWJsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgLy8gY2FsbGJhY2tcbiAgICAgICAgICAgIGZvciAobGV0IHZhcmlhYmxlIG9mIHZhcmlhYmxlcykge1xuICAgICAgICAgICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgICAgICAgICBsZXQgcmVzID0gdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgICAgICAgICBoYW5kbGUuY2FsbGJhY2socmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBcbiAgICAgICAgICAgICAgICByZXF1ZXN0IG5leHQgY2FsbGJhY2sgYXMgbG9uZyBhcyBhdCBsZWFzdCBvbmUgdmFyaWFibGUgXG4gICAgICAgICAgICAgICAgaXMgcmVxdWlyaW5nIHBvbGxpbmdcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9oYW5kbGUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5fY2FsbGJhY2suYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEJJTkQgUkVMRUFTRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jb25zdCBtb25pdG9yID0gbmV3IFRpbWVvdXRNb25pdG9yKCk7XG5jb25zdCBmcmFtZXJhdGVfbW9uaXRvciA9IG5ldyBGcmFtZXJhdGVNb25pdG9yKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICBsZXQgaGFuZGxlO1xuICAgIGlmIChCb29sZWFuKHBhcnNlRmxvYXQoZGVsYXkpKSkge1xuICAgICAgICBoYW5kbGUgPSBtb25pdG9yLmJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBbXCJ0aW1lb3V0XCIsIGhhbmRsZV07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaGFuZGxlID0gZnJhbWVyYXRlX21vbml0b3IuYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIDAsIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gW1wiZnJhbWVyYXRlXCIsIGhhbmRsZV07XG4gICAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgbGV0IFt0eXBlLCBfaGFuZGxlXSA9IGhhbmRsZTtcbiAgICBpZiAodHlwZSA9PSBcInRpbWVvdXRcIikge1xuICAgICAgICByZXR1cm4gbW9uaXRvci5yZWxlYXNlKF9oYW5kbGUpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcImZyYW1lcmF0ZVwiKSB7XG4gICAgICAgIHJldHVybiBmcmFtZXJhdGVfbW9uaXRvci5yZWxlYXNlKF9oYW5kbGUpO1xuICAgIH1cbn1cblxuIiwiaW1wb3J0IHsgZXZlbnRpZnkgfSBmcm9tIFwiLi9ldmVudGlmeS5qc1wiO1xuaW1wb3J0IHsgY2FsbGJhY2sgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5pbXBvcnQgeyBiaW5kLCByZWxlYXNlIH0gZnJvbSBcIi4vbW9uaXRvci5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTVEFURSBQUk9WSURFUiBCQVNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIEJhc2UgY2xhc3MgZm9yIGFsbCBzdGF0ZSBwcm92aWRlcnNcblxuICAgIC0gb2JqZWN0IHdpdGggY29sbGVjdGlvbiBvZiBpdGVtc1xuICAgIC0gY291bGQgYmUgbG9jYWwgLSBvciBwcm94eSB0byBvbmxpbmUgc291cmNlXG5cbiAgICByZXByZXNlbnRzIGEgZHluYW1pYyBjb2xsZWN0aW9uIG9mIGl0ZW1zXG4gICAge2l0diwgdHlwZSwgLi4uZGF0YX1cbiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0ZVByb3ZpZGVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICB9XG5cbiAgICAvLyBwdWJsaWMgdXBkYXRlIGZ1bmN0aW9uXG4gICAgdXBkYXRlKGl0ZW1zKXtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3VwZGF0ZShpdGVtcyk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBoYW5kbGVfdXBkYXRlKGl0ZW1zKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICBnZXQgaXRlbXMoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShTdGF0ZVByb3ZpZGVyQmFzZS5wcm90b3R5cGUpO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExBWUVSIEJBU0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBMYXllckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBRVUVSWVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgcXVlcnkgKG9mZnNldCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoTGF5ZXJCYXNlLnByb3RvdHlwZSk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ1VSU09SIEJBU0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBDdXJzb3JCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgLy8gZGVmaW5lIGNoYW5nZSBldmVudFxuICAgICAgICBldmVudGlmeS5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcbiAgICB9XG4gICAgXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBRVUVSWVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgcXVlcnkgKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgRXZlbnRpZnk6IGltbWVkaWF0ZSBldmVudHNcbiAgICAqL1xuICAgIGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG4gICAgICAgIGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBbdGhpcy5xdWVyeSgpXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogQklORCBSRUxFQVNFIChjb252ZW5pZW5jZSlcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGJpbmQoY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHJldHVybiBiaW5kKHRoaXMsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgICAgIHJldHVybiByZWxlYXNlKGhhbmRsZSk7XG4gICAgfVxuXG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShDdXJzb3JCYXNlLnByb3RvdHlwZSk7XG5ldmVudGlmeS5hZGRUb1Byb3RvdHlwZShDdXJzb3JCYXNlLnByb3RvdHlwZSk7XG5cbiIsImltcG9ydCB7U3RhdGVQcm92aWRlckJhc2V9IGZyb20gXCIuL2Jhc2VzLmpzXCI7XG5pbXBvcnQge2VuZHBvaW50fSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNJTVBMRSBTVEFURSBQUk9WSURFUiAoTE9DQUwpXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogTG9jYWwgQXJyYXkgd2l0aCBub24gb3ZlcmxhcHBpbmcgaXRlbXMuXG4gKi9cblxuZXhwb3J0IGNsYXNzIFNpbXBsZVN0YXRlUHJvdmlkZXIgZXh0ZW5kcyBTdGF0ZVByb3ZpZGVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2l0ZW1zID0gW107XG4gICAgICAgIGxldCB7aXRlbXN9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKGl0ZW1zKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZV91cGRhdGUoaXRlbXMpOyAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBpbnRlcm5hbCB1cGRhdGUgZnVuY3Rpb25cbiAgICBfdXBkYXRlIChpdGVtcykge1xuICAgICAgICB0aGlzLl9pdGVtcyA9IGNoZWNrX2lucHV0KGl0ZW1zKTtcbiAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgfVxuXG4gICAgZ2V0IGl0ZW1zICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2l0ZW1zO1xuICAgIH1cblxuICAgIGdldCBpbmZvICgpIHtcbiAgICAgICAgcmV0dXJuIHtkeW5hbWljOiB0cnVlLCBvdmVybGFwcGluZzogZmFsc2UsIGxvY2FsOnRydWV9O1xuICAgIH1cbn1cblxuXG5mdW5jdGlvbiBjaGVja19pbnB1dChpdGVtcykge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShpdGVtcykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW5wdXQgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICB9XG4gICAgLy8gc29ydCBpdGVtcyBiYXNlZCBvbiBpbnRlcnZhbCBsb3cgZW5kcG9pbnRcbiAgICBpdGVtcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGxldCBhX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYS5pdHYpWzBdO1xuICAgICAgICBsZXQgYl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGIuaXR2KVswXTtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmNtcChhX2xvdywgYl9sb3cpO1xuICAgIH0pO1xuICAgIC8vIGNoZWNrIHRoYXQgaXRlbSBpbnRlcnZhbHMgYXJlIG5vbi1vdmVybGFwcGluZ1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IHByZXZfaGlnaCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaSAtIDFdLml0dilbMV07XG4gICAgICAgIGxldCBjdXJyX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaV0uaXR2KVswXTtcbiAgICAgICAgLy8gdmVyaWZ5IHRoYXQgcHJldiBoaWdoIGlzIGxlc3MgdGhhdCBjdXJyIGxvd1xuICAgICAgICBpZiAoIWVuZHBvaW50Lmx0KHByZXZfaGlnaCwgY3Vycl9sb3cpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPdmVybGFwcGluZyBpbnRlcnZhbHMgZm91bmRcIik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG4iLCJpbXBvcnQge2ludGVydmFsLCBlbmRwb2ludH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQge2NhbGxiYWNrfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5cbi8qKlxuICogXG4gKiBOZWFyYnkgSW5kZXggU2ltcGxlXG4gKiBcbiAqIC0gaXRlbXMgYXJlIGFzc3VtZWQgdG8gYmUgbm9uLW92ZXJsYXBwaW5nIG9uIHRoZSB0aW1lbGluZSwgXG4gKiAtIGltcGx5aW5nIHRoYXQgbmVhcmJ5LmNlbnRlciB3aWxsIGJlIGEgbGlzdCBvZiBhdCBtb3N0IG9uZSBJVEVNLiBcbiAqIC0gZXhjZXB0aW9uIHdpbGwgYmUgcmFpc2VkIGlmIG92ZXJsYXBwaW5nIElURU1TIGFyZSBmb3VuZFxuICogLSBJVEVNUyBpcyBhc3N1bWJlZCB0byBiZSBpbW11dGFibGUgYXJyYXkgLSBjaGFuZ2UgSVRFTVMgYnkgcmVwbGFjaW5nIGFycmF5XG4gKiBcbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgYXJvdW5kIG9mZnNldC4gXG4gKiBcbiAqIFJldHVybnMge1xuICogICAgICBsZWZ0IC0gaGlnaCBpbnRlcnZhbCBlbmRwb2ludCBvZiB0aGUgZmlyc3QgSVRFTSB0byB0aGUgbGVmdCB3aGljaCBkb2VzIG5vdCBjb3ZlciBvZmZzZXQsIGVsc2UgdW5kZWZpbmVkXG4gKiAgICAgIGNlbnRlciAtIGxpc3Qgb2YgSVRFTVMgY292ZXJpbmcgb2Zmc2V0LCBlbHNlIFtdXG4gKiAgICAgIHJpZ2h0IC0gbG93IGludGVydmFsIGVuZHBvaW50IG9mIHRoZSBmaXJzdCBJVEVNIHRvIHRoZSByaWdodCB3aGljaCBkb2VzIG5vdCBjb3ZlciBvZmZzZXQsIGVsc2UgdW5kZWZpbmVkXG4gKiB9XG4gKiBcbiAqL1xuXG5cbi8vIGdldCBpbnRlcnZhbCBsb3cgcG9pbnRcbmZ1bmN0aW9uIGdldF9sb3dfdmFsdWUoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLml0dlswXTtcbn1cblxuLy8gZ2V0IGludGVydmFsIGxvdyBlbmRwb2ludFxuZnVuY3Rpb24gZ2V0X2xvd19lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzBdXG59XG5cbi8vIGdldCBpbnRlcnZhbCBoaWdoIGVuZHBvaW50XG5mdW5jdGlvbiBnZXRfaGlnaF9lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzFdXG59XG5cblxuZXhwb3J0IGNsYXNzIFNpbXBsZU5lYXJieUluZGV4IHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBbXTtcbiAgICAgICAgbGV0IHtpdGVtc30gPSBvcHRpb25zO1xuICAgICAgICBpZiAoaXRlbXMpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlKGl0ZW1zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZSAoaXRlbXMpIHtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBjaGVja19pbnB1dChpdGVtcylcbiAgICB9XG5cblxuICAgIC8qXG4gICAgICAgIG5lYXJieSBieSBvZmZzZXRcbiAgICAgICAgXG4gICAgICAgIHJldHVybnMge2xlZnQsIGNlbnRlciwgcmlnaHR9XG5cbiAgICAgICAgYmluYXJ5IHNlYXJjaCBiYXNlZCBvbiBvZmZzZXRcbiAgICAgICAgMSkgZm91bmQsIGlkeFxuICAgICAgICAgICAgb2Zmc2V0IG1hdGNoZXMgdmFsdWUgb2YgaW50ZXJ2YWwubG93IG9mIGFuIGl0ZW1cbiAgICAgICAgICAgIGlkeCBnaXZlcyB0aGUgaW5kZXggb2YgdGhpcyBpdGVtIGluIHRoZSBhcnJheVxuICAgICAgICAyKSBub3QgZm91bmQsIGlkeFxuICAgICAgICAgICAgb2Zmc2V0IGlzIGVpdGhlciBjb3ZlcmVkIGJ5IGl0ZW0gYXQgKGlkeC0xKSxcbiAgICAgICAgICAgIG9yIGl0IGlzIG5vdCA9PiBiZXR3ZWVuIGVudHJpZXNcbiAgICAgICAgICAgIGluIHRoaXMgY2FzZSAtIGlkeCBnaXZlcyB0aGUgaW5kZXggd2hlcmUgYW4gaXRlbVxuICAgICAgICAgICAgc2hvdWxkIGJlIGluc2VydGVkIC0gaWYgaXQgaGFkIGxvdyA9PSBvZmZzZXRcbiAgICAqL1xuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvZmZzZXQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBbb2Zmc2V0LCAwXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkob2Zmc2V0KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW5kcG9pbnQgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgICAgICBjZW50ZXI6IFtdLFxuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICBsZWZ0OiB1bmRlZmluZWQsXG4gICAgICAgICAgICByaWdodDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgcHJldjogdW5kZWZpbmVkLFxuICAgICAgICAgICAgbmV4dDogdW5kZWZpbmVkXG4gICAgICAgIH07XG4gICAgICAgIGxldCBpdGVtcyA9IHRoaXMuX2l0ZW1zO1xuICAgICAgICBsZXQgaW5kZXhlcywgaXRlbTtcbiAgICAgICAgY29uc3Qgc2l6ZSA9IGl0ZW1zLmxlbmd0aDtcbiAgICAgICAgaWYgKHNpemUgPT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDsgXG4gICAgICAgIH1cbiAgICAgICAgbGV0IFtmb3VuZCwgaWR4XSA9IGZpbmRfaW5kZXgob2Zmc2V0WzBdLCBpdGVtcywgZ2V0X2xvd192YWx1ZSk7XG4gICAgICAgIGlmIChmb3VuZCkge1xuICAgICAgICAgICAgLy8gc2VhcmNoIG9mZnNldCBtYXRjaGVzIGl0ZW0gbG93IGV4YWN0bHlcbiAgICAgICAgICAgIC8vIGNoZWNrIHRoYXQgaXQgaW5kZWVkIGNvdmVyZWQgYnkgaXRlbSBpbnRlcnZhbFxuICAgICAgICAgICAgaXRlbSA9IGl0ZW1zW2lkeF1cbiAgICAgICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfZW5kcG9pbnQoaXRlbS5pdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTEsIGNlbnRlcjppZHgsIHJpZ2h0OmlkeCsxfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5kZXhlcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIHByZXYgaXRlbVxuICAgICAgICAgICAgaXRlbSA9IGl0ZW1zW2lkeC0xXTtcbiAgICAgICAgICAgIGlmIChpdGVtICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIHNlYXJjaCBvZmZzZXQgaXMgY292ZXJlZCBieSBpdGVtIGludGVydmFsXG4gICAgICAgICAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19lbmRwb2ludChpdGVtLml0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTIsIGNlbnRlcjppZHgtMSwgcmlnaHQ6aWR4fTtcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgfVxuICAgICAgICB9XHRcbiAgICAgICAgaWYgKGluZGV4ZXMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBwcmV2IGl0ZW0gZWl0aGVyIGRvZXMgbm90IGV4aXN0IG9yIGlzIG5vdCByZWxldmFudFxuICAgICAgICAgICAgaW5kZXhlcyA9IHtsZWZ0OmlkeC0xLCBjZW50ZXI6LTEsIHJpZ2h0OmlkeH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjZW50ZXJcbiAgICAgICAgaWYgKDAgPD0gaW5kZXhlcy5jZW50ZXIgJiYgaW5kZXhlcy5jZW50ZXIgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQuY2VudGVyID0gIFtpdGVtc1tpbmRleGVzLmNlbnRlcl1dO1xuICAgICAgICB9XG4gICAgICAgIC8vIHByZXYvbmV4dFxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLmxlZnQgJiYgaW5kZXhlcy5sZWZ0IDwgc2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0LnByZXYgPSAgZ2V0X2hpZ2hfZW5kcG9pbnQoaXRlbXNbaW5kZXhlcy5sZWZ0XSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKDAgPD0gaW5kZXhlcy5yaWdodCAmJiBpbmRleGVzLnJpZ2h0IDwgc2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0Lm5leHQgPSAgZ2V0X2xvd19lbmRwb2ludChpdGVtc1tpbmRleGVzLnJpZ2h0XSk7XG4gICAgICAgIH0gICAgICAgIFxuICAgICAgICAvLyBsZWZ0L3JpZ2h0XG4gICAgICAgIGxldCBsb3csIGhpZ2g7XG4gICAgICAgIGlmIChyZXN1bHQuY2VudGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxldCBpdHYgPSByZXN1bHQuY2VudGVyWzBdLml0djtcbiAgICAgICAgICAgIFtsb3csIGhpZ2hdID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdHYpO1xuICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSAobG93WzBdID4gLUluZmluaXR5KSA/IGVuZHBvaW50LmZsaXAobG93LCBcImhpZ2hcIikgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSAoaGlnaFswXSA8IEluZmluaXR5KSA/IGVuZHBvaW50LmZsaXAoaGlnaCwgXCJsb3dcIikgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICByZXN1bHQuaXR2ID0gcmVzdWx0LmNlbnRlclswXS5pdHY7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IHJlc3VsdC5wcmV2O1xuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gcmVzdWx0Lm5leHQ7XG4gICAgICAgICAgICAvLyBpbnRlcnZhbFxuICAgICAgICAgICAgbGV0IGxlZnQgPSByZXN1bHQubGVmdDtcbiAgICAgICAgICAgIGxvdyA9IChsZWZ0ID09IHVuZGVmaW5lZCkgPyBbLUluZmluaXR5LCAwXSA6IGVuZHBvaW50LmZsaXAobGVmdCwgXCJsb3dcIik7XG4gICAgICAgICAgICBsZXQgcmlnaHQgPSByZXN1bHQucmlnaHQ7XG4gICAgICAgICAgICBoaWdoID0gKHJpZ2h0ID09IHVuZGVmaW5lZCkgPyBbSW5maW5pdHksIDBdIDogZW5kcG9pbnQuZmxpcChyaWdodCwgXCJoaWdoXCIpO1xuICAgICAgICAgICAgcmVzdWx0Lml0diA9IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShTaW1wbGVOZWFyYnlJbmRleC5wcm90b3R5cGUpO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG5cdFVUSUxTXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuLy8gY2hlY2sgaW5wdXRcbmZ1bmN0aW9uIGNoZWNrX2lucHV0KGl0ZW1zKSB7XG5cbiAgICBpZiAoaXRlbXMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGl0ZW1zID0gW107XG4gICAgfVxuXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnB1dCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgIH1cblxuICAgIC8vIHNvcnQgaXRlbXMgYmFzZWQgb24gaW50ZXJ2YWwgbG93IGVuZHBvaW50XG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBsZXQgYV9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGEuaXR2KVswXTtcbiAgICAgICAgbGV0IGJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChiLml0dilbMF07XG4gICAgICAgIHJldHVybiBlbmRwb2ludC5jbXAoYV9sb3csIGJfbG93KTtcbiAgICB9KTtcblxuICAgIC8vIGNoZWNrIHRoYXQgaXRlbSBpbnRlcnZhbHMgYXJlIG5vbi1vdmVybGFwcGluZ1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IHByZXZfaGlnaCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaSAtIDFdLml0dilbMV07XG4gICAgICAgIGxldCBjdXJyX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaV0uaXR2KVswXTtcbiAgICAgICAgLy8gdmVyaWZ5IHRoYXQgcHJldiBoaWdoIGlzIGxlc3MgdGhhdCBjdXJyIGxvd1xuICAgICAgICBpZiAoIWVuZHBvaW50Lmx0KHByZXZfaGlnaCwgY3Vycl9sb3cpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPdmVybGFwcGluZyBpbnRlcnZhbHMgZm91bmRcIik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5cbi8qXG5cdGJpbmFyeSBzZWFyY2ggZm9yIGZpbmRpbmcgdGhlIGNvcnJlY3QgaW5zZXJ0aW9uIGluZGV4IGludG9cblx0dGhlIHNvcnRlZCBhcnJheSAoYXNjZW5kaW5nKSBvZiBpdGVtc1xuXHRcblx0YXJyYXkgY29udGFpbnMgb2JqZWN0cywgYW5kIHZhbHVlIGZ1bmMgcmV0cmVhdmVzIGEgdmFsdWVcblx0ZnJvbSBlYWNoIG9iamVjdC5cblxuXHRyZXR1cm4gW2ZvdW5kLCBpbmRleF1cbiovXG5cbmZ1bmN0aW9uIGZpbmRfaW5kZXgodGFyZ2V0LCBhcnIsIHZhbHVlX2Z1bmMpIHtcblxuICAgIGZ1bmN0aW9uIGRlZmF1bHRfdmFsdWVfZnVuYyhlbCkge1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgfVxuICAgIFxuICAgIGxldCBsZWZ0ID0gMDtcblx0bGV0IHJpZ2h0ID0gYXJyLmxlbmd0aCAtIDE7XG5cdHZhbHVlX2Z1bmMgPSB2YWx1ZV9mdW5jIHx8IGRlZmF1bHRfdmFsdWVfZnVuYztcblx0d2hpbGUgKGxlZnQgPD0gcmlnaHQpIHtcblx0XHRjb25zdCBtaWQgPSBNYXRoLmZsb29yKChsZWZ0ICsgcmlnaHQpIC8gMik7XG5cdFx0bGV0IG1pZF92YWx1ZSA9IHZhbHVlX2Z1bmMoYXJyW21pZF0pO1xuXHRcdGlmIChtaWRfdmFsdWUgPT09IHRhcmdldCkge1xuXHRcdFx0cmV0dXJuIFt0cnVlLCBtaWRdOyAvLyBUYXJnZXQgYWxyZWFkeSBleGlzdHMgaW4gdGhlIGFycmF5XG5cdFx0fSBlbHNlIGlmIChtaWRfdmFsdWUgPCB0YXJnZXQpIHtcblx0XHRcdCAgbGVmdCA9IG1pZCArIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSByaWdodFxuXHRcdH0gZWxzZSB7XG5cdFx0XHQgIHJpZ2h0ID0gbWlkIC0gMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIGxlZnRcblx0XHR9XG5cdH1cbiAgXHRyZXR1cm4gW2ZhbHNlLCBsZWZ0XTsgLy8gUmV0dXJuIHRoZSBpbmRleCB3aGVyZSB0YXJnZXQgc2hvdWxkIGJlIGluc2VydGVkXG59XG4iLCJpbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0ICogYXMgc2VnbWVudCBmcm9tIFwiLi9zZWdtZW50cy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTkVBUkJZIENBQ0hFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgVGhpcyBpbXBsZW1lbnRzIGEgY2FjaGUgaW4gZnJvbnQgb2YgYSBOZWFyYnlJbmRleC5cbiAgICBcbiAgICBUaGUgcHVycG9zZSBvZiBjYWNoaW5nIGlzIHRvIG9wdGltaXplIGZvciByZXBlYXRlZFxuICAgIHF1ZXJpZXMgdG8gYSBOZWFyYnlJbmRleCB0byBuZWFyYnkgb2Zmc2V0cy5cblxuICAgIFRoZSBjYWNoZSBzdGF0ZSBpbmNsdWRlcyB0aGUgbmVhcmJ5IHN0YXRlIGZyb20gdGhlIFxuICAgIGluZGV4LCBhbmQgYWxzbyB0aGUgY2FjaGVkIHNlZ21lbnRzIGNvcnJlc3BvbmRpbmdcbiAgICB0byB0aGF0IHN0YXRlLiBUaGlzIHdheSwgb24gYSBjYWNoZSBoaXQsIHRoZSBcbiAgICBxdWVyeSBtYXkgYmUgc2F0aXNmaWVkIGRpcmVjdGx5IGZyb20gdGhlIGNhY2hlLlxuXG4gICAgVGhlIGNhY2hlIGlzIG1hcmtlZCBhcyBkaXJ0eSB3aGVuIHRoZSBOZWFyYnkgaW5kZXhlcyBjaGFuZ2VzLlxuKi9cblxuZXhwb3J0IGNsYXNzIE5lYXJieUNhY2hlIHtcblxuICAgIGNvbnN0cnVjdG9yIChuZWFyYnlJbmRleCkge1xuICAgICAgICAvLyBuZWFyYnkgaW5kZXhcbiAgICAgICAgdGhpcy5faW5kZXggPSBuZWFyYnlJbmRleDtcbiAgICAgICAgLy8gY2FjaGVkIG5lYXJieSBvYmplY3RcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjYWNoZWQgc2VnbWVudFxuICAgICAgICB0aGlzLl9zZWdtZW50ID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBkaXJ0eSBmbGFnXG4gICAgICAgIHRoaXMuX2RpcnR5ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIEFjY2Vzc29ycyBmb3IgQ2FjaGUgc3RhdGVcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgXG4gICAgZ2V0IG5lYXJieSAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9uZWFyYnk7XG4gICAgfVxuXG4gICAgbG9hZF9zZWdtZW50ICgpIHtcbiAgICAgICAgLy8gbGF6eSBsb2FkIHNlZ21lbnRcbiAgICAgICAgaWYgKHRoaXMuX25lYXJieSAmJiAhdGhpcy5fc2VnbWVudCkge1xuICAgICAgICAgICAgdGhpcy5fc2VnbWVudCA9IGxvYWRfc2VnbWVudCh0aGlzLl9uZWFyYnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9zZWdtZW50XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIERpcnR5IENhY2hlXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgZGlydHkoKSB7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgUmVmcmVzaCBDYWNoZVxuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIC8qXG4gICAgICAgIHJlZnJlc2ggaWYgbmVjZXNzYXJ5IC0gZWxzZSBOT09QXG4gICAgICAgIC0gaWYgbmVhcmJ5IGlzIG5vdCBkZWZpbmVkXG4gICAgICAgIC0gaWYgb2Zmc2V0IGlzIG91dHNpZGUgbmVhcmJ5Lml0dlxuICAgICAgICAtIGlmIGNhY2hlIGlzIGRpcnR5XG4gICAgKi9cbiAgICByZWZyZXNoIChvZmZzZXQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvZmZzZXQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBbb2Zmc2V0LCAwXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fbmVhcmJ5ID09IHVuZGVmaW5lZCB8fCB0aGlzLl9kaXJ0eSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlZnJlc2gob2Zmc2V0KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWludGVydmFsLmNvdmVyc19lbmRwb2ludCh0aGlzLl9uZWFyYnkuaXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVmcmVzaChvZmZzZXQpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIF9yZWZyZXNoIChvZmZzZXQpIHtcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdGhpcy5faW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gZmFsc2U7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBRdWVyeSBDYWNoZVxuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBpZiAob2Zmc2V0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY2FjaGUgcXVlcnkgb2Zmc2V0IGNhbm5vdCBiZSB1bmRlZmluZWRcIilcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlZnJlc2gob2Zmc2V0KTtcbiAgICAgICAgaWYgKCF0aGlzLl9zZWdtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9zZWdtZW50ID0gbG9hZF9zZWdtZW50KHRoaXMuX25lYXJieSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3NlZ21lbnQucXVlcnkob2Zmc2V0KTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTE9BRCBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmZ1bmN0aW9uIGNyZWF0ZV9zZWdtZW50KGl0diwgdHlwZSwgYXJncykge1xuICAgIGlmICh0eXBlID09IFwic3RhdGljXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LlN0YXRpY1NlZ21lbnQoaXR2LCBhcmdzKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJ0cmFuc2l0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LlRyYW5zaXRpb25TZWdtZW50KGl0diwgYXJncyk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwiaW50ZXJwb2xhdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5JbnRlcnBvbGF0aW9uU2VnbWVudChpdHYsIGFyZ3MpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5Nb3Rpb25TZWdtZW50KGl0diwgYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJ1bnJlY29nbml6ZWQgc2VnbWVudCB0eXBlXCIsIHR5cGUpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gbG9hZF9zZWdtZW50KG5lYXJieSkge1xuICAgIGxldCB7aXR2LCBjZW50ZXJ9ID0gbmVhcmJ5O1xuICAgIGlmIChjZW50ZXIubGVuZ3RoID09IDApIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZV9zZWdtZW50KGl0diwgXCJzdGF0aWNcIiwge3ZhbHVlOnVuZGVmaW5lZH0pO1xuICAgIH1cbiAgICBpZiAoY2VudGVyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGxldCB7dHlwZT1cInN0YXRpY1wiLCBhcmdzfSA9IGNlbnRlclswXTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZV9zZWdtZW50KGl0diwgdHlwZSwgYXJncyk7XG4gICAgfVxuICAgIGlmIChjZW50ZXIubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJMaXN0U2VnbWVudHMgbm90IHlldCBzdXBwb3J0ZWRcIik7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgU2ltcGxlTmVhcmJ5SW5kZXggfSBmcm9tIFwiLi9uZWFyYnlpbmRleF9zaW1wbGVcIjtcbmltcG9ydCB7IE5lYXJieUNhY2hlIH0gZnJvbSBcIi4vbmVhcmJ5Y2FjaGVcIjtcblxuZXhwb3J0IGNvbnN0IG5lYXJieSA9IGZ1bmN0aW9uICgpIHtcblxuICAgIGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2Uob2JqZWN0KSB7XG4gICAgICAgIGxldCBpbmRleCA9IG5ldyBTaW1wbGVOZWFyYnlJbmRleCgpO1xuICAgICAgICBvYmplY3QuX19uZWFyYnlfaW5kZXggPSBpbmRleDtcbiAgICAgICAgb2JqZWN0Ll9fbmVhcmJ5X2NhY2hlID0gbmV3IE5lYXJieUNhY2hlKGluZGV4KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB1cGRhdGUoaXRlbXMpIHtcbiAgICAgICAgdGhpcy5fX25lYXJieV9pbmRleC51cGRhdGUoaXRlbXMpO1xuICAgICAgICB0aGlzLl9fbmVhcmJ5X2NhY2hlLmRpcnR5KCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcXVlcnkgKG9mZnNldCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fX25lYXJieV9jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlKF9wcm90b3R5cGUpIHtcbiAgICAgICAgY29uc3QgYXBpID0ge307XG4gICAgICAgIGFwaVsnX19uZWFyYnlfdXBkYXRlJ10gPSB1cGRhdGU7XG4gICAgICAgIGFwaVsnX19uZWFyYnlfcXVlcnknXSA9IHF1ZXJ5O1xuICAgICAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHthZGRUb0luc3RhbmNlLCBhZGRUb1Byb3RvdHlwZX1cbn0oKTtcbiIsIlxuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UsIEN1cnNvckJhc2UgfSBmcm9tIFwiLi9iYXNlc1wiO1xuY29uc3QgTUVUSE9EUyA9IHthc3NpZ24sIG1vdmUsIHRyYW5zaXRpb24sIGludGVycG9sYXRlfTtcblxuXG5leHBvcnQgZnVuY3Rpb24gY21kICh0YXJnZXQpIHtcbiAgICBpZiAoISh0YXJnZXQgaW5zdGFuY2VvZiBDdXJzb3JCYXNlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhcmdldCBtdXN0IGJlIGN1cnNvciAke3RhcmdldH1gKTtcbiAgICB9XG4gICAgaWYgKCEodGFyZ2V0LnNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhcmdldC5zcmMgbXVzdCBiZSBzdGF0ZXByb3ZpZGVyICR7dGFyZ2V0fWApO1xuICAgIH1cbiAgICBsZXQgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKE1FVEhPRFMpXG4gICAgICAgIC5tYXAoKFtuYW1lLCBtZXRob2RdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oLi4uYXJncykgeyBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGl0ZW1zID0gbWV0aG9kLmNhbGwodGhpcywgdGFyZ2V0LCAuLi5hcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldC5zcmMudXBkYXRlKGl0ZW1zKTsgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhlbnRyaWVzKTtcbn1cblxuZnVuY3Rpb24gYXNzaWduKHRhcmdldCwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgaXRlbSA9IHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZX0gICAgICAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbaXRlbV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBtb3ZlKHRhcmdldCwgdmVjdG9yPXt9KSB7XG4gICAgbGV0IHt2YWx1ZSwgcmF0ZSwgb2Zmc2V0fSA9IHRhcmdldC5xdWVyeSgpO1xuICAgIGxldCB7cG9zaXRpb249dmFsdWUsIHZlbG9jaXR5PXJhdGV9ID0gdmVjdG9yO1xuICAgIGxldCBpdGVtID0ge1xuICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgdHlwZTogXCJtb3Rpb25cIixcbiAgICAgICAgYXJnczoge3Bvc2l0aW9uLCB2ZWxvY2l0eSwgdGltZXN0YW1wOm9mZnNldH0gICAgICAgICAgICAgICAgIFxuICAgIH1cbiAgICByZXR1cm4gW2l0ZW1dO1xufVxuXG5mdW5jdGlvbiB0cmFuc2l0aW9uKHRhcmdldCwgdjAsIHYxLCB0MCwgdDEsIGVhc2luZykge1xuICAgIGxldCBpdGVtcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTp2MH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDAsIHQxLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcInRyYW5zaXRpb25cIixcbiAgICAgICAgICAgIGFyZ3M6IHt2MCwgdjEsIHQwLCB0MSwgZWFzaW5nfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTogdjF9XG4gICAgICAgIH1cbiAgICBdXG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZSh0YXJnZXQsIHR1cGxlcykge1xuICAgIGxldCBbdjAsIHQwXSA9IHR1cGxlc1swXTtcbiAgICBsZXQgW3YxLCB0MV0gPSB0dXBsZXNbdHVwbGVzLmxlbmd0aC0xXTtcblxuICAgIGxldCBpdGVtcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTp2MH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDAsIHQxLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcImludGVycG9sYXRpb25cIixcbiAgICAgICAgICAgIGFyZ3M6IHt0dXBsZXN9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgYXJnczoge3ZhbHVlOiB2MX1cbiAgICAgICAgfVxuICAgIF0gICAgXG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5cblxuIiwiXG5cbmltcG9ydCB7IFN0YXRlUHJvdmlkZXJCYXNlLCBDdXJzb3JCYXNlIH0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7IHNvdXJjZSB9IGZyb20gXCIuL3V0aWwuanNcIjtcbmltcG9ydCB7IFNpbXBsZVN0YXRlUHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX3NpbXBsZS5qc1wiO1xuaW1wb3J0IHsgbmVhcmJ5IH0gZnJvbSBcIi4vY29tbW9uLmpzXCI7XG5pbXBvcnQgeyBjbWQgfSBmcm9tIFwiLi9jbWQuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBDTE9DSyBDVVJTT1JTXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vLyBDTE9DSyAoY291bnRpbmcgc2Vjb25kcyBzaW5jZSBwYWdlIGxvYWQpXG5jbGFzcyBMb2NhbENsb2NrIGV4dGVuZHMgQ3Vyc29yQmFzZSB7XG4gICAgcXVlcnkgKCkge1xuICAgICAgICBsZXQgb2Zmc2V0ID0gcGVyZm9ybWFuY2Uubm93KCkvMTAwMC4wO1xuICAgICAgICByZXR1cm4ge3ZhbHVlOm9mZnNldCwgZHluYW1pYzp0cnVlLCBvZmZzZXR9O1xuICAgIH1cbn1cblxuLy8gQ0xPQ0sgKGNvdW50aW5nIHNlY29uZHMgc2luY2UgZXBvY2ggKDE5NzApXG5jbGFzcyBMb2NhbEVwb2NoIGV4dGVuZHMgQ3Vyc29yQmFzZSB7XG4gICAgcXVlcnkgKCkge1xuICAgICAgICBsZXQgb2Zmc2V0ID0gKERhdGUubm93KCkgLyAxMDAwLjApXG4gICAgICAgIHJldHVybiB7dmFsdWU6b2Zmc2V0LCBkeW5hbWljOnRydWUsIG9mZnNldH07XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgbG9jYWxfY2xvY2sgPSBuZXcgTG9jYWxDbG9jaygpO1xuZXhwb3J0IGNvbnN0IGxvY2FsX2Vwb2NoID0gbmV3IExvY2FsRXBvY2goKVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ1VSU09SXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFxuICogQ3Vyc29yIGlzIGEgdmFyaWFibGVcbiAqIC0gaGFzIG11dGFibGUgY3RybCBjdXJzb3IgKGRlZmF1bHQgbG9jYWwgY2xvY2spXG4gKiAtIGhhcyBtdXRhYmxlIHN0YXRlIHByb3ZpZGVyIChzcmMpIChkZWZhdWx0IHN0YXRlIHVuZGVmaW5lZClcbiAqIC0gbWV0aG9kcyBmb3IgYXNzaWduLCBtb3ZlLCB0cmFuc2l0aW9uLCBpbnRlcG9sYXRpb25cbiAqIFxuICovXG5cbmV4cG9ydCBjbGFzcyBDdXJzb3IgZXh0ZW5kcyBDdXJzb3JCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8vIGN0cmxcbiAgICAgICAgc291cmNlLmFkZFRvSW5zdGFuY2UodGhpcywgXCJjdHJsXCIpO1xuICAgICAgICAvLyBzcmNcbiAgICAgICAgc291cmNlLmFkZFRvSW5zdGFuY2UodGhpcywgXCJzcmNcIik7XG4gICAgICAgIC8vIG5lYXJieVxuICAgICAgICBuZWFyYnkuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgLy8gaW5pdGlhbHNlIGNsb2NrXG5cbiAgICAgICAgLy8gaW5pdGlhbGlzZSBjdHJsXG4gICAgICAgIGxldCB7Y3RybH0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoY3RybCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGN0cmwgPSBsb2NhbF9jbG9jaztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmN0cmwgPSBjdHJsO1xuXG4gICAgICAgIC8vIGluaXRpYWxpc2Ugc3RhdGVcbiAgICAgICAgbGV0IHtzcmN9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHNyYyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNyYyA9IG5ldyBTaW1wbGVTdGF0ZVByb3ZpZGVyKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zcmMgPSBzcmNcbiAgICB9XG5cbiAgICAvLyBjaGVjayBjdHJsXG4gICAgX19jdHJsX2NoZWNrKGN0cmwpIHtcbiAgICAgICAgaWYgKCEoY3RybCBpbnN0YW5jZW9mIEN1cnNvckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwiY3RybFwiIG11c3QgYmUgY3Vyc29yICR7Y3RybH1gKVxuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIGNoZWNrIHNyY1xuICAgIF9fc3JjX2NoZWNrKHNyYykge1xuICAgICAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBTdGF0ZVByb3ZpZGVyQmFzZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIHN0YXRlIHByb3ZpZGVyICR7c291cmNlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY3RybCBvciBzcmMgY2hhbmdlc1xuICAgIF9fY3RybF9vbmNoYW5nZSgpIHtcbiAgICAgICAgdGhpcy5fX29uY2hhbmdlKCk7XG4gICAgfVxuICAgIF9fc3JjX29uY2hhbmdlKCkge1xuICAgICAgICB0aGlzLl9fb25jaGFuZ2UoKTtcbiAgICB9XG4gICAgX19vbmNoYW5nZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuc3JjICYmIHRoaXMuY3RybCkge1xuICAgICAgICAgICAgbGV0IGl0ZW1zID0gdGhpcy5zcmMuaXRlbXM7XG4gICAgICAgICAgICB0aGlzLl9fbmVhcmJ5X3VwZGF0ZShpdGVtcyk7XG4gICAgICAgICAgICAvLyB0cmlnZ2VyIGNoYW5nZSBldmVudCBmb3IgY3Vyc29yXG4gICAgICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiLCB0aGlzLnF1ZXJ5KCkpOyAgICBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUllcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBxdWVyeSAoKSB7XG4gICAgICAgIGxldCB7dmFsdWU6b2Zmc2V0fSA9IHRoaXMuY3RybC5xdWVyeSgpXG4gICAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdHJsIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7b2Zmc2V0fWApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9fbmVhcmJ5X2NhY2hlLnF1ZXJ5KG9mZnNldCk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBDT05WRU5JRU5DRVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgZ2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5xdWVyeSgpLnZhbHVlfTtcblxuICAgIGFzc2lnbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gY21kKHRoaXMpLmFzc2lnbih2YWx1ZSk7XG4gICAgfVxuICAgIG1vdmUgKHtwb3NpdGlvbiwgdmVsb2NpdHl9KSB7XG4gICAgICAgIGxldCB7dmFsdWUsIHJhdGUsIG9mZnNldDp0aW1lc3RhbXB9ID0gdGhpcy5xdWVyeSgpO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3Igc3RhdGUgbXVzdCBiZSBudW1iZXIgJHt2YWx1ZX1gKTtcbiAgICAgICAgfVxuICAgICAgICBwb3NpdGlvbiA9IChwb3NpdGlvbiAhPSB1bmRlZmluZWQpID8gcG9zaXRpb24gOiB2YWx1ZTtcbiAgICAgICAgdmVsb2NpdHkgPSAodmVsb2NpdHkgIT0gdW5kZWZpbmVkKSA/IHZlbG9jaXR5OiByYXRlO1xuICAgICAgICByZXR1cm4gY21kKHRoaXMpLm1vdmUoe3Bvc2l0aW9uLCB2ZWxvY2l0eSwgdGltZXN0YW1wfSk7XG4gICAgfVxuICAgIHRyYW5zaXRpb24gKHt0YXJnZXQsIGR1cmF0aW9uLCBlYXNpbmd9KSB7XG4gICAgICAgIGxldCB7dmFsdWU6djAsIG9mZnNldDp0MH0gPSB0aGlzLnF1ZXJ5KCk7XG4gICAgICAgIGlmICh0eXBlb2YgdjAgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhcm5pbmc6IGN1cnNvciBzdGF0ZSBtdXN0IGJlIG51bWJlciAke3YwfWApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjbWQodGhpcykudHJhbnNpdGlvbih2MCwgdGFyZ2V0LCB0MCwgdDAgKyBkdXJhdGlvbiwgZWFzaW5nKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUgKHt0dXBsZXMsIGR1cmF0aW9ufSkge1xuICAgICAgICBsZXQgdDAgPSB0aGlzLnF1ZXJ5KCkub2Zmc2V0O1xuICAgICAgICAvLyBhc3N1bWluZyB0aW1zdGFtcHMgYXJlIGluIHJhbmdlIFswLDFdXG4gICAgICAgIC8vIHNjYWxlIHRpbWVzdGFtcHMgdG8gZHVyYXRpb25cbiAgICAgICAgdHVwbGVzID0gdHVwbGVzLm1hcCgoW3YsdF0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbdiwgdDAgKyB0KmR1cmF0aW9uXTtcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzKS5pbnRlcnBvbGF0ZSh0dXBsZXMpO1xuICAgIH1cblxuXG59XG5zb3VyY2UuYWRkVG9Qcm90b3R5cGUoQ3Vyc29yLnByb3RvdHlwZSwgXCJzcmNcIiwge211dGFibGU6dHJ1ZX0pO1xuc291cmNlLmFkZFRvUHJvdG90eXBlKEN1cnNvci5wcm90b3R5cGUsIFwiY3RybFwiLCB7bXV0YWJsZTp0cnVlfSk7XG5uZWFyYnkuYWRkVG9Qcm90b3R5cGUoQ3Vyc29yLnByb3RvdHlwZSk7XG4iXSwibmFtZXMiOlsiaW50ZXJwb2xhdGUiLCJjaGVja19pbnB1dCIsInNlZ21lbnQuU3RhdGljU2VnbWVudCIsInNlZ21lbnQuVHJhbnNpdGlvblNlZ21lbnQiLCJzZWdtZW50LkludGVycG9sYXRpb25TZWdtZW50Iiwic2VnbWVudC5Nb3Rpb25TZWdtZW50Il0sIm1hcHBpbmdzIjoiOzs7OztJQUFBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQSxTQUFTLFlBQVksRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0lBQy9CLElBQUksSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxFQUFFO0lBQ3JCLElBQUksSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxFQUFFO0lB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
