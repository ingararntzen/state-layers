
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

    	get interval() {return this._itv;}

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
        {interval, ...data}
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
            let a_low = endpoint.from_interval(a.interval)[0];
            let b_low = endpoint.from_interval(b.interval)[0];
            return endpoint.cmp(a_low, b_low);
        });
        // check that item intervals are non-overlapping
        for (let i = 1; i < items.length; i++) {
            let prev_high = endpoint.from_interval(items[i - 1].interval)[1];
            let curr_low = endpoint.from_interval(items[i].interval)[0];
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
        return item.interval[0];
    }

    // get interval low endpoint
    function get_low_endpoint(item) {
        return endpoint.from_interval(item.interval)[0]
    }

    // get interval high endpoint
    function get_high_endpoint(item) {
        return endpoint.from_interval(item.interval)[1]
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
                interval: [-Infinity, Infinity, true, true],
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
                if (interval.covers_endpoint(item.interval, offset)) {
                    indexes = {left:idx-1, center:idx, right:idx+1};
                }
            }
            if (indexes == undefined) {
                // check prev item
                item = items[idx-1];
                if (item != undefined) {
                    // check if search offset is covered by item interval
                    if (interval.covers_endpoint(item.interval, offset)) {
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
                let itv = result.center[0].interval;
                [low, high] = endpoint.from_interval(itv);
                result.left = (low[0] > -Infinity) ? endpoint.flip(low, "high") : undefined;
                result.right = (high[0] < Infinity) ? endpoint.flip(high, "low") : undefined;
                result.interval = result.center[0].interval;
            } else {
                result.left = result.prev;
                result.right = result.next;
                // interval
                let left = result.left;
                low = (left == undefined) ? [-Infinity, 0] : endpoint.flip(left, "low");
                let right = result.right;
                high = (right == undefined) ? [Infinity, 0] : endpoint.flip(right, "high");
                result.interval = interval.from_endpoints(low, high);
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
            let a_low = endpoint.from_interval(a.interval)[0];
            let b_low = endpoint.from_interval(b.interval)[0];
            return endpoint.cmp(a_low, b_low);
        });

        // check that item intervals are non-overlapping
        for (let i = 1; i < items.length; i++) {
            let prev_high = endpoint.from_interval(items[i - 1].interval)[1];
            let curr_low = endpoint.from_interval(items[i].interval)[0];
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
            - if offset is outside nearby.interval
            - if cache is dirty
        */
        refresh (offset) {
            if (typeof offset === 'number') {
                offset = [offset, 0];
            }
            if (this._nearby == undefined || this._dirty) {
                return this._refresh(offset);
            }
            if (!interval.covers_endpoint(this._nearby.interval, offset)) {
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

    function create_segment(interval, type, args) {
        if (type == "static") {
            return new StaticSegment(interval, args);
        } else if (type == "transition") {
            return new TransitionSegment(interval, args);
        } else if (type == "interpolation") {
            return new InterpolationSegment(interval, args);
        } else if (type == "motion") {
            return new MotionSegment(interval, args);
        } else {
            console.log("unrecognized segment type", type);
        }
    }

    function load_segment(nearby) {
        let {interval:itv, center} = nearby;
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
                interval: [-Infinity, Infinity, true, true],
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
            interval: [-Infinity, Infinity, true, true],
            type: "motion",
            args: {position, velocity, timestamp:offset}                 
        };
        return [item];
    }

    function transition(target, v0, v1, t0, t1, easing) {
        let items = [
            {
                interval: [-Infinity, t0, true, false],
                type: "static",
                args: {value:v0}
            },
            {
                interval: [t0, t1, true, false],
                type: "transition",
                args: {v0, v1, t0, t1, easing}
            },
            {
                interval: [t1, Infinity, true, true],
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
                interval: [-Infinity, t0, true, false],
                type: "static",
                args: {value:v0}
            },
            {
                interval: [t0, t1, true, false],
                type: "interpolation",
                args: {tuples}
            },
            {
                interval: [t1, Infinity, true, true],
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pbnRlcnZhbHMuanMiLCIuLi8uLi9zcmMvc2VnbWVudHMuanMiLCIuLi8uLi9zcmMvZXZlbnRpZnkuanMiLCIuLi8uLi9zcmMvdXRpbC5qcyIsIi4uLy4uL3NyYy9tb25pdG9yLmpzIiwiLi4vLi4vc3JjL2Jhc2VzLmpzIiwiLi4vLi4vc3JjL3N0YXRlcHJvdmlkZXJfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL25lYXJieWluZGV4X3NpbXBsZS5qcyIsIi4uLy4uL3NyYy9uZWFyYnljYWNoZS5qcyIsIi4uLy4uL3NyYy9jb21tb24uanMiLCIuLi8uLi9zcmMvY21kLmpzIiwiLi4vLi4vc3JjL2N1cnNvcnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gICAgKiBcbiAgICAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAgICAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICAgICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gICAgKiBcbiAgICAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICAgICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAgICAqIFxuICAgICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG5cbiovXG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuXG5cbiAgICBOT1RFIFxuICAgIC0gY21wKDRdLFs0ICkgPT0gMCAtIHNpbmNlIHRoZXNlIGFyZSB0aGUgc2FtZSB3aXRoIHJlc3BlY3QgdG8gc29ydGluZ1xuICAgIC0gYnV0IGlmIHlvdSB3YW50IHRvIHNlZSBpZiB0d28gaW50ZXJ2YWxzIGFyZSBvdmVybGFwcGluZyBpbiB0aGUgZW5kcG9pbnRzXG4gICAgY21wKGhpZ2hfYSwgbG93X2IpID4gMCB0aGlzIHdpbGwgbm90IGJlIGdvb2RcbiAgICBcbiovIFxuXG5mdW5jdGlvbiBlbmRwb2ludF9jbXAgKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIGxldCBkaWZmID0gdjEgLSB2MjtcbiAgICByZXR1cm4gKGRpZmYgIT0gMCkgPyBkaWZmIDogczEgLSBzMjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludCB0byB0aGUgb3RoZXIgc2lkZVxuICogXG4gKiB1c2VmdWwgZm9yIG1ha2luZyBiYWNrLXRvLWJhY2sgaW50ZXJ2YWxzIFxuICogXG4gKiBoaWdoKSA8LT4gW2xvd1xuICogaGlnaF0gPC0+IChsb3dcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKHAsIHRhcmdldCkge1xuICAgIGxldCBbdixzXSA9IHA7XG4gICAgaWYgKHRhcmdldCA9PSBcImxvd1wiKSB7XG4gICAgXHQvLyBhc3N1bWUgcG9pbnQgaXMgaGlnaDogc2lnbiBtdXN0IGJlIC0xIG9yIDBcbiAgICBcdGlmIChzID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBsb3dcIik7ICAgIFx0XHRcbiAgICBcdH1cbiAgICAgICAgcCA9IFt2LCBzKzFdO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09IFwiaGlnaFwiKSB7XG5cdFx0Ly8gYXNzdW1lIHBvaW50IGlzIGxvdzogc2lnbiBpcyAwIG9yIDFcbiAgICBcdGlmIChzIDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBoaWdoXCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcy0xXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0eXBlXCIsIHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBsZXQgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBsZXQgbG93X3AgPSAobG93Q2xvc2VkKSA/IFtsb3csIDBdIDogW2xvdywgMV07IFxuICAgIGxldCBoaWdoX3AgPSAoaGlnaENsb3NlZCkgPyBbaGlnaCwgMF0gOiBbaGlnaCwgLTFdO1xuICAgIHJldHVybiBbbG93X3AsIGhpZ2hfcF07XG59XG5cblxuLypcbiAgICBJTlRFUlZBTFNcblxuICAgIEludGVydmFscyBhcmUgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXVxuXG4qLyBcblxuLypcbiAgICByZXR1cm4gdHJ1ZSBpZiBwb2ludCBwIGlzIGNvdmVyZWQgYnkgaW50ZXJ2YWwgaXR2XG4gICAgcG9pbnQgcCBjYW4gYmUgbnVtYmVyIHAgb3IgYSBwb2ludCBbcCxzXVxuXG4gICAgaW1wbGVtZW50ZWQgYnkgY29tcGFyaW5nIHBvaW50c1xuICAgIGV4Y2VwdGlvbiBpZiBpbnRlcnZhbCBpcyBub3QgZGVmaW5lZFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIHApIHtcbiAgICBsZXQgW2xvd19wLCBoaWdoX3BdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAvLyBjb3ZlcnM6IGxvdyA8PSBwIDw9IGhpZ2hcbiAgICByZXR1cm4gZW5kcG9pbnRfbGUobG93X3AsIHApICYmIGVuZHBvaW50X2xlKHAsIGhpZ2hfcCk7XG59XG4vLyBjb252ZW5pZW5jZVxuZnVuY3Rpb24gaW50ZXJ2YWxfY292ZXJzX3BvaW50KGl0diwgcCkge1xuICAgIHJldHVybiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBbcCwgMF0pO1xufVxuXG5cblxuLypcbiAgICBSZXR1cm4gdHJ1ZSBpZiBpbnRlcnZhbCBoYXMgbGVuZ3RoIDBcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9pc19zaW5ndWxhcihpbnRlcnZhbCkge1xuICAgIHJldHVybiBpbnRlcnZhbFswXSA9PSBpbnRlcnZhbFsxXVxufVxuXG4vKlxuICAgIENyZWF0ZSBpbnRlcnZhbCBmcm9tIGVuZHBvaW50c1xuKi9cbmZ1bmN0aW9uIGludGVydmFsX2Zyb21fZW5kcG9pbnRzKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIC8vIHAxIG11c3QgYmUgYSBsb3cgcG9pbnRcbiAgICBpZiAoczEgPT0gLTEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBsb3cgcG9pbnRcIiwgcDEpO1xuICAgIH1cbiAgICBpZiAoczIgPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2VhbCBoaWdoIHBvaW50XCIsIHAyKTsgICBcbiAgICB9XG4gICAgcmV0dXJuIFt2MSwgdjIsIChzMT09MCksIChzMj09MCldXG59XG5cblxuZXhwb3J0IGNvbnN0IGVuZHBvaW50ID0ge1xuICAgIGxlOiBlbmRwb2ludF9sZSxcbiAgICBsdDogZW5kcG9pbnRfbHQsXG4gICAgZ2U6IGVuZHBvaW50X2dlLFxuICAgIGd0OiBlbmRwb2ludF9ndCxcbiAgICBjbXA6IGVuZHBvaW50X2NtcCxcbiAgICBlcTogZW5kcG9pbnRfZXEsXG4gICAgbWluOiBlbmRwb2ludF9taW4sXG4gICAgbWF4OiBlbmRwb2ludF9tYXgsXG4gICAgZmxpcDogZW5kcG9pbnRfZmxpcCxcbiAgICBmcm9tX2ludGVydmFsOiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbFxufVxuZXhwb3J0IGNvbnN0IGludGVydmFsID0ge1xuICAgIGNvdmVyc19lbmRwb2ludDogaW50ZXJ2YWxfY292ZXJzX2VuZHBvaW50LFxuICAgIGNvdmVyc19wb2ludDogaW50ZXJ2YWxfY292ZXJzX3BvaW50LCBcbiAgICBpc19zaW5ndWxhcjogaW50ZXJ2YWxfaXNfc2luZ3VsYXIsXG4gICAgZnJvbV9lbmRwb2ludHM6IGludGVydmFsX2Zyb21fZW5kcG9pbnRzXG59XG4iLCJpbXBvcnQge2ludGVydmFsfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbkJBU0UgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLypcblx0QWJzdHJhY3QgQmFzZSBDbGFzcyBmb3IgU2VnbWVudHNcblxuICAgIGNvbnN0cnVjdG9yKGludGVydmFsKVxuXG4gICAgLSBpbnRlcnZhbDogaW50ZXJ2YWwgb2YgdmFsaWRpdHkgb2Ygc2VnbWVudFxuICAgIC0gZHluYW1pYzogdHJ1ZSBpZiBzZWdtZW50IGlzIGR5bmFtaWNcbiAgICAtIHZhbHVlKG9mZnNldCk6IHZhbHVlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4gICAgLSBxdWVyeShvZmZzZXQpOiBzdGF0ZSBvZiBzZWdtZW50IGF0IG9mZnNldFxuKi9cblxuZXhwb3J0IGNsYXNzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYpIHtcblx0XHR0aGlzLl9pdHYgPSBpdHY7XG5cdH1cblxuXHRnZXQgaW50ZXJ2YWwoKSB7cmV0dXJuIHRoaXMuX2l0djt9XG5cbiAgICAvKiogXG4gICAgICogaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3NcbiAgICAgKiByZXR1cm5zIHt2YWx1ZSwgZHluYW1pY307XG4gICAgKi9cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjb252ZW5pZW5jZSBmdW5jdGlvbiByZXR1cm5pbmcgdGhlIHN0YXRlIG9mIHRoZSBzZWdtZW50XG4gICAgICogQHBhcmFtIHsqfSBvZmZzZXQgXG4gICAgICogQHJldHVybnMgXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5faXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuc3RhdGUob2Zmc2V0KSwgb2Zmc2V0fTtcbiAgICAgICAgfSBcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdW5kZWZpbmVkLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExBWUVSUyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBMYXllcnNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX2xheWVycyA9IGFyZ3MubGF5ZXJzO1xuICAgICAgICB0aGlzLl92YWx1ZV9mdW5jID0gYXJncy52YWx1ZV9mdW5jXG5cbiAgICAgICAgLy8gVE9ETyAtIGZpZ3VyZSBvdXQgZHluYW1pYyBoZXJlP1xuICAgIH1cblxuXHRzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgLy8gVE9ETyAtIHVzZSB2YWx1ZSBmdW5jXG4gICAgICAgIC8vIGZvciBub3cgLSBqdXN0IHVzZSBmaXJzdCBsYXllclxuICAgICAgICByZXR1cm4gey4uLnRoaXMuX2xheWVyc1swXS5xdWVyeShvZmZzZXQpLCBvZmZzZXR9O1xuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU1RBVElDIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIFN0YXRpY1NlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG5cdFx0dGhpcy5fdmFsdWUgPSBhcmdzLnZhbHVlO1xuXHR9XG5cblx0c3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3ZhbHVlLCBkeW5hbWljOmZhbHNlfVxuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTU9USU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qXG4gICAgSW1wbGVtZW50cyBkZXRlcm1pbmlzdGljIHByb2plY3Rpb24gYmFzZWQgb24gaW5pdGlhbCBjb25kaXRpb25zIFxuICAgIC0gbW90aW9uIHZlY3RvciBkZXNjcmliZXMgbW90aW9uIHVuZGVyIGNvbnN0YW50IGFjY2VsZXJhdGlvblxuKi9cblxuZXhwb3J0IGNsYXNzIE1vdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG4gICAgXG4gICAgY29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOnAwLCB2ZWxvY2l0eTp2MCwgdGltZXN0YW1wOnQwXG4gICAgICAgIH0gPSBhcmdzO1xuICAgICAgICAvLyBjcmVhdGUgbW90aW9uIHRyYW5zaXRpb25cbiAgICAgICAgY29uc3QgYTAgPSAwO1xuICAgICAgICB0aGlzLl92ZWxvY2l0eSA9IHYwO1xuICAgICAgICB0aGlzLl9wb3NpdGlvbiA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgbGV0IGQgPSB0cyAtIHQwO1xuICAgICAgICAgICAgcmV0dXJuIHAwICsgdjAqZCArIDAuNSphMCpkKmQ7XG4gICAgICAgIH07ICAgXG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB2YWx1ZTogdGhpcy5fcG9zaXRpb24ob2Zmc2V0KSwgXG4gICAgICAgICAgICByYXRlOiB0aGlzLl92ZWxvY2l0eSwgXG4gICAgICAgICAgICBkeW5hbWljOiB0aGlzLl92ZWxvY2l0eSAhPSAwXG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVFJBTlNJVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgU3VwcG9ydGVkIGVhc2luZyBmdW5jdGlvbnNcbiAgICBcImVhc2UtaW5cIjpcbiAgICBcImVhc2Utb3V0XCI6XG4gICAgXCJlYXNlLWluLW91dFwiXG4qL1xuXG5mdW5jdGlvbiBlYXNlaW4gKHRzKSB7XG4gICAgcmV0dXJuIE1hdGgucG93KHRzLDIpOyAgXG59XG5mdW5jdGlvbiBlYXNlb3V0ICh0cykge1xuICAgIHJldHVybiAxIC0gZWFzZWluKDEgLSB0cyk7XG59XG5mdW5jdGlvbiBlYXNlaW5vdXQgKHRzKSB7XG4gICAgaWYgKHRzIDwgLjUpIHtcbiAgICAgICAgcmV0dXJuIGVhc2VpbigyICogdHMpIC8gMjtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gKDIgLSBlYXNlaW4oMiAqICgxIC0gdHMpKSkgLyAyO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRyYW5zaXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuXHRcdHN1cGVyKGl0dik7XG4gICAgICAgIGxldCB7djAsIHYxLCBlYXNpbmd9ID0gYXJncztcbiAgICAgICAgbGV0IFt0MCwgdDFdID0gdGhpcy5faXR2LnNsaWNlKDAsMik7XG5cbiAgICAgICAgLy8gY3JlYXRlIHRoZSB0cmFuc2l0aW9uIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuX2R5bmFtaWMgPSB2MS12MCAhPSAwO1xuICAgICAgICB0aGlzLl90cmFucyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgLy8gY29udmVydCB0cyB0byBbdDAsdDFdLXNwYWNlXG4gICAgICAgICAgICAvLyAtIHNoaWZ0IGZyb20gW3QwLHQxXS1zcGFjZSB0byBbMCwodDEtdDApXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzY2FsZSBmcm9tIFswLCh0MS10MCldLXNwYWNlIHRvIFswLDFdLXNwYWNlXG4gICAgICAgICAgICB0cyA9IHRzIC0gdDA7XG4gICAgICAgICAgICB0cyA9IHRzL3BhcnNlRmxvYXQodDEtdDApO1xuICAgICAgICAgICAgLy8gZWFzaW5nIGZ1bmN0aW9ucyBzdHJldGNoZXMgb3IgY29tcHJlc3NlcyB0aGUgdGltZSBzY2FsZSBcbiAgICAgICAgICAgIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluXCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2Vpbih0cyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVhc2luZyA9PSBcImVhc2Utb3V0XCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2VvdXQodHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW5vdXQodHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbGluZWFyIHRyYW5zaXRpb24gZnJvbSB2MCB0byB2MSwgZm9yIHRpbWUgdmFsdWVzIFswLDFdXG4gICAgICAgICAgICB0cyA9IE1hdGgubWF4KHRzLCAwKTtcbiAgICAgICAgICAgIHRzID0gTWF0aC5taW4odHMsIDEpO1xuICAgICAgICAgICAgcmV0dXJuIHYwICsgKHYxLXYwKSp0cztcbiAgICAgICAgfVxuXHR9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dGhpcy5fZHluYW1pY31cblx0fVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgSU5URVJQT0xBVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogRnVuY3Rpb24gdG8gY3JlYXRlIGFuIGludGVycG9sYXRvciBmb3IgbmVhcmVzdCBuZWlnaGJvciBpbnRlcnBvbGF0aW9uIHdpdGhcbiAqIGV4dHJhcG9sYXRpb24gc3VwcG9ydC5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSB0dXBsZXMgLSBBbiBhcnJheSBvZiBbdmFsdWUsIG9mZnNldF0gcGFpcnMsIHdoZXJlIHZhbHVlIGlzIHRoZVxuICogcG9pbnQncyB2YWx1ZSBhbmQgb2Zmc2V0IGlzIHRoZSBjb3JyZXNwb25kaW5nIG9mZnNldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gLSBBIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYW4gb2Zmc2V0IGFuZCByZXR1cm5zIHRoZVxuICogaW50ZXJwb2xhdGVkIG9yIGV4dHJhcG9sYXRlZCB2YWx1ZS5cbiAqL1xuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZSh0dXBsZXMpIHtcblxuICAgIGlmICh0dXBsZXMubGVuZ3RoIDwgMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdW5kZWZpbmVkO31cbiAgICB9IGVsc2UgaWYgKHR1cGxlcy5sZW5ndGggPT0gMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdHVwbGVzWzBdWzBdO31cbiAgICB9XG5cbiAgICAvLyBTb3J0IHRoZSB0dXBsZXMgYnkgdGhlaXIgb2Zmc2V0c1xuICAgIGNvbnN0IHNvcnRlZFR1cGxlcyA9IFsuLi50dXBsZXNdLnNvcnQoKGEsIGIpID0+IGFbMV0gLSBiWzFdKTtcbiAgXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvcihvZmZzZXQpIHtcbiAgICAgIC8vIEhhbmRsZSBleHRyYXBvbGF0aW9uIGJlZm9yZSB0aGUgZmlyc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPD0gc29ydGVkVHVwbGVzWzBdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzWzBdO1xuICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1sxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBhZnRlciB0aGUgbGFzdCBwb2ludFxuICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAyXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdO1xuICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICB9XG4gIFxuICAgICAgLy8gRmluZCB0aGUgbmVhcmVzdCBwb2ludHMgdG8gdGhlIGxlZnQgYW5kIHJpZ2h0XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvcnRlZFR1cGxlcy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbaV1bMV0gJiYgb2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1tpICsgMV1bMV0pIHtcbiAgICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tpXTtcbiAgICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1tpICsgMV07XG4gICAgICAgICAgLy8gTGluZWFyIGludGVycG9sYXRpb24gZm9ybXVsYTogeSA9IHkxICsgKCAoeCAtIHgxKSAqICh5MiAtIHkxKSAvICh4MiAtIHgxKSApXG4gICAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gIFxuICAgICAgLy8gSW4gY2FzZSB0aGUgb2Zmc2V0IGRvZXMgbm90IGZhbGwgd2l0aGluIGFueSByYW5nZSAoc2hvdWxkIGJlIGNvdmVyZWQgYnkgdGhlIHByZXZpb3VzIGNvbmRpdGlvbnMpXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH07XG59XG4gIFxuXG5leHBvcnQgY2xhc3MgSW50ZXJwb2xhdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cbiAgICBjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcbiAgICAgICAgLy8gc2V0dXAgaW50ZXJwb2xhdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl90cmFucyA9IGludGVycG9sYXRlKGFyZ3MudHVwbGVzKTtcbiAgICB9XG5cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdGhpcy5fdHJhbnMob2Zmc2V0KSwgZHluYW1pYzp0cnVlfTtcbiAgICB9XG59XG5cblxuIiwiLypcblx0Q29weXJpZ2h0IDIwMjBcblx0QXV0aG9yIDogSW5nYXIgQXJudHplblxuXG5cdFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUaW1pbmdzcmMgbW9kdWxlLlxuXG5cdFRpbWluZ3NyYyBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG5cdGl0IHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieVxuXHR0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvclxuXHQoYXQgeW91ciBvcHRpb24pIGFueSBsYXRlciB2ZXJzaW9uLlxuXG5cdFRpbWluZ3NyYyBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLFxuXHRidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7IHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZlxuXHRNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG5cdEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuXG5cdFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZVxuXHRhbG9uZyB3aXRoIFRpbWluZ3NyYy4gIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiovXG5cblxuXG4vKlxuXHRFdmVudFxuXHQtIG5hbWU6IGV2ZW50IG5hbWVcblx0LSBwdWJsaXNoZXI6IHRoZSBvYmplY3Qgd2hpY2ggZGVmaW5lZCB0aGUgZXZlbnRcblx0LSBpbml0OiB0cnVlIGlmIHRoZSBldmVudCBzdXBwcG9ydHMgaW5pdCBldmVudHNcblx0LSBzdWJzY3JpcHRpb25zOiBzdWJzY3JpcHRpbnMgdG8gdGhpcyBldmVudFxuXG4qL1xuXG5jbGFzcyBFdmVudCB7XG5cblx0Y29uc3RydWN0b3IgKHB1Ymxpc2hlciwgbmFtZSwgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5wdWJsaXNoZXIgPSBwdWJsaXNoZXI7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gZmFsc2UgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zID0gW107XG5cdH1cblxuXHQvKlxuXHRcdHN1YnNjcmliZSB0byBldmVudFxuXHRcdC0gc3Vic2NyaWJlcjogc3Vic2NyaWJpbmcgb2JqZWN0XG5cdFx0LSBjYWxsYmFjazogY2FsbGJhY2sgZnVuY3Rpb24gdG8gaW52b2tlXG5cdFx0LSBvcHRpb25zOlxuXHRcdFx0aW5pdDogaWYgdHJ1ZSBzdWJzY3JpYmVyIHdhbnRzIGluaXQgZXZlbnRzXG5cdCovXG5cdHN1YnNjcmliZSAoY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRpZiAoIWNhbGxiYWNrIHx8IHR5cGVvZiBjYWxsYmFjayAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayBub3QgYSBmdW5jdGlvblwiLCBjYWxsYmFjayk7XG5cdFx0fVxuXHRcdGNvbnN0IHN1YiA9IG5ldyBTdWJzY3JpcHRpb24odGhpcywgY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5wdXNoKHN1Yik7XG5cdCAgICAvLyBJbml0aWF0ZSBpbml0IGNhbGxiYWNrIGZvciB0aGlzIHN1YnNjcmlwdGlvblxuXHQgICAgaWYgKHRoaXMuaW5pdCAmJiBzdWIuaW5pdCkge1xuXHQgICAgXHRzdWIuaW5pdF9wZW5kaW5nID0gdHJ1ZTtcblx0ICAgIFx0bGV0IHNlbGYgPSB0aGlzO1xuXHQgICAgXHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgIFx0XHRjb25zdCBlQXJncyA9IHNlbGYucHVibGlzaGVyLmV2ZW50aWZ5SW5pdEV2ZW50QXJncyhzZWxmLm5hbWUpIHx8IFtdO1xuXHQgICAgXHRcdHN1Yi5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0ICAgIFx0XHRmb3IgKGxldCBlQXJnIG9mIGVBcmdzKSB7XG5cdCAgICBcdFx0XHRzZWxmLnRyaWdnZXIoZUFyZywgW3N1Yl0sIHRydWUpO1xuXHQgICAgXHRcdH1cblx0ICAgIFx0fSk7XG5cdCAgICB9XG5cdFx0cmV0dXJuIHN1YlxuXHR9XG5cblx0Lypcblx0XHR0cmlnZ2VyIGV2ZW50XG5cblx0XHQtIGlmIHN1YiBpcyB1bmRlZmluZWQgLSBwdWJsaXNoIHRvIGFsbCBzdWJzY3JpcHRpb25zXG5cdFx0LSBpZiBzdWIgaXMgZGVmaW5lZCAtIHB1Ymxpc2ggb25seSB0byBnaXZlbiBzdWJzY3JpcHRpb25cblx0Ki9cblx0dHJpZ2dlciAoZUFyZywgc3VicywgaW5pdCkge1xuXHRcdGxldCBlSW5mbywgY3R4O1xuXHRcdGZvciAoY29uc3Qgc3ViIG9mIHN1YnMpIHtcblx0XHRcdC8vIGlnbm9yZSB0ZXJtaW5hdGVkIHN1YnNjcmlwdGlvbnNcblx0XHRcdGlmIChzdWIudGVybWluYXRlZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGVJbmZvID0ge1xuXHRcdFx0XHRzcmM6IHRoaXMucHVibGlzaGVyLFxuXHRcdFx0XHRuYW1lOiB0aGlzLm5hbWUsXG5cdFx0XHRcdHN1Yjogc3ViLFxuXHRcdFx0XHRpbml0OiBpbml0XG5cdFx0XHR9XG5cdFx0XHRjdHggPSBzdWIuY3R4IHx8IHRoaXMucHVibGlzaGVyO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0c3ViLmNhbGxiYWNrLmNhbGwoY3R4LCBlQXJnLCBlSW5mbyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYEVycm9yIGluICR7dGhpcy5uYW1lfTogJHtzdWIuY2FsbGJhY2t9ICR7ZXJyfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qXG5cdHVuc3Vic2NyaWJlIGZyb20gZXZlbnRcblx0LSB1c2Ugc3Vic2NyaXB0aW9uIHJldHVybmVkIGJ5IHByZXZpb3VzIHN1YnNjcmliZVxuXHQqL1xuXHR1bnN1YnNjcmliZShzdWIpIHtcblx0XHRsZXQgaWR4ID0gdGhpcy5zdWJzY3JpcHRpb25zLmluZGV4T2Yoc3ViKTtcblx0XHRpZiAoaWR4ID4gLTEpIHtcblx0XHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdHN1Yi50ZXJtaW5hdGUoKTtcblx0XHR9XG5cdH1cbn1cblxuXG4vKlxuXHRTdWJzY3JpcHRpb24gY2xhc3NcbiovXG5cbmNsYXNzIFN1YnNjcmlwdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoZXZlbnQsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLmV2ZW50ID0gZXZlbnQ7XG5cdFx0dGhpcy5uYW1lID0gZXZlbnQubmFtZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2tcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gdGhpcy5ldmVudC5pbml0IDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gZmFsc2U7XG5cdFx0dGhpcy5jdHggPSBvcHRpb25zLmN0eDtcblx0fVxuXG5cdHRlcm1pbmF0ZSgpIHtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSB0cnVlO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5ldmVudC51bnN1YnNjcmliZSh0aGlzKTtcblx0fVxufVxuXG5cbi8qXG5cblx0RVZFTlRJRlkgSU5TVEFOQ0VcblxuXHRFdmVudGlmeSBicmluZ3MgZXZlbnRpbmcgY2FwYWJpbGl0aWVzIHRvIGFueSBvYmplY3QuXG5cblx0SW4gcGFydGljdWxhciwgZXZlbnRpZnkgc3VwcG9ydHMgdGhlIGluaXRpYWwtZXZlbnQgcGF0dGVybi5cblx0T3B0LWluIGZvciBpbml0aWFsIGV2ZW50cyBwZXIgZXZlbnQgdHlwZS5cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlJbnN0YW5jZSAob2JqZWN0KSB7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwID0gbmV3IE1hcCgpO1xuXHRvYmplY3QuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0cmV0dXJuIG9iamVjdDtcbn07XG5cblxuLypcblx0RVZFTlRJRlkgUFJPVE9UWVBFXG5cblx0QWRkIGV2ZW50aWZ5IGZ1bmN0aW9uYWxpdHkgdG8gcHJvdG90eXBlIG9iamVjdFxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5UHJvdG90eXBlKF9wcm90b3R5cGUpIHtcblxuXHRmdW5jdGlvbiBldmVudGlmeUdldEV2ZW50KG9iamVjdCwgbmFtZSkge1xuXHRcdGNvbnN0IGV2ZW50ID0gb2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAuZ2V0KG5hbWUpO1xuXHRcdGlmIChldmVudCA9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IHVuZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0cmV0dXJuIGV2ZW50O1xuXHR9XG5cblx0Lypcblx0XHRERUZJTkUgRVZFTlRcblx0XHQtIHVzZWQgb25seSBieSBldmVudCBzb3VyY2Vcblx0XHQtIG5hbWU6IG5hbWUgb2YgZXZlbnRcblx0XHQtIG9wdGlvbnM6IHtpbml0OnRydWV9IHNwZWNpZmllcyBpbml0LWV2ZW50IHNlbWFudGljcyBmb3IgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlEZWZpbmUobmFtZSwgb3B0aW9ucykge1xuXHRcdC8vIGNoZWNrIHRoYXQgZXZlbnQgZG9lcyBub3QgYWxyZWFkeSBleGlzdFxuXHRcdGlmICh0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuaGFzKG5hbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCBhbHJlYWR5IGRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5zZXQobmFtZSwgbmV3IEV2ZW50KHRoaXMsIG5hbWUsIG9wdGlvbnMpKTtcblx0fTtcblxuXHQvKlxuXHRcdE9OXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRyZWdpc3RlciBjYWxsYmFjayBvbiBldmVudC5cblx0Ki9cblx0ZnVuY3Rpb24gb24obmFtZSwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpYmUoY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T0ZGXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRVbi1yZWdpc3RlciBhIGhhbmRsZXIgZnJvbSBhIHNwZWNmaWMgZXZlbnQgdHlwZVxuXHQqL1xuXHRmdW5jdGlvbiBvZmYoc3ViKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgc3ViLm5hbWUpLnVuc3Vic2NyaWJlKHN1Yik7XG5cdH07XG5cblxuXHRmdW5jdGlvbiBldmVudGlmeVN1YnNjcmlwdGlvbnMobmFtZSkge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmlwdGlvbnM7XG5cdH1cblxuXG5cblx0Lypcblx0XHRUcmlnZ2VyIGxpc3Qgb2YgZXZlbnRJdGVtcyBvbiBvYmplY3RcblxuXHRcdGV2ZW50SXRlbTogIHtuYW1lOi4uLCBlQXJnOi4ufVxuXG5cdFx0Y29weSBhbGwgZXZlbnRJdGVtcyBpbnRvIGJ1ZmZlci5cblx0XHRyZXF1ZXN0IGVtcHR5aW5nIHRoZSBidWZmZXIsIGkuZS4gYWN0dWFsbHkgdHJpZ2dlcmluZyBldmVudHMsXG5cdFx0ZXZlcnkgdGltZSB0aGUgYnVmZmVyIGdvZXMgZnJvbSBlbXB0eSB0byBub24tZW1wdHlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxsKGV2ZW50SXRlbXMpIHtcblx0XHRpZiAoZXZlbnRJdGVtcy5sZW5ndGggPT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIG1ha2UgdHJpZ2dlciBpdGVtc1xuXHRcdC8vIHJlc29sdmUgbm9uLXBlbmRpbmcgc3Vic2NyaXB0aW9ucyBub3dcblx0XHQvLyBlbHNlIHN1YnNjcmlwdGlvbnMgbWF5IGNoYW5nZSBmcm9tIHBlbmRpbmcgdG8gbm9uLXBlbmRpbmdcblx0XHQvLyBiZXR3ZWVuIGhlcmUgYW5kIGFjdHVhbCB0cmlnZ2VyaW5nXG5cdFx0Ly8gbWFrZSBsaXN0IG9mIFtldiwgZUFyZywgc3Vic10gdHVwbGVzXG5cdFx0bGV0IHRyaWdnZXJJdGVtcyA9IGV2ZW50SXRlbXMubWFwKChpdGVtKSA9PiB7XG5cdFx0XHRsZXQge25hbWUsIGVBcmd9ID0gaXRlbTtcblx0XHRcdGxldCBldiA9IGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSk7XG5cdFx0XHRsZXQgc3VicyA9IGV2LnN1YnNjcmlwdGlvbnMuZmlsdGVyKHN1YiA9PiBzdWIuaW5pdF9wZW5kaW5nID09IGZhbHNlKTtcblx0XHRcdHJldHVybiBbZXYsIGVBcmcsIHN1YnNdO1xuXHRcdH0sIHRoaXMpO1xuXG5cdFx0Ly8gYXBwZW5kIHRyaWdnZXIgSXRlbXMgdG8gYnVmZmVyXG5cdFx0Y29uc3QgbGVuID0gdHJpZ2dlckl0ZW1zLmxlbmd0aDtcblx0XHRjb25zdCBidWYgPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyO1xuXHRcdGNvbnN0IGJ1Zl9sZW4gPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aDtcblx0XHQvLyByZXNlcnZlIG1lbW9yeSAtIHNldCBuZXcgbGVuZ3RoXG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGggPSBidWZfbGVuICsgbGVuO1xuXHRcdC8vIGNvcHkgdHJpZ2dlckl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGZvciAobGV0IGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0YnVmW2J1Zl9sZW4raV0gPSB0cmlnZ2VySXRlbXNbaV07XG5cdFx0fVxuXHRcdC8vIHJlcXVlc3QgZW1wdHlpbmcgb2YgdGhlIGJ1ZmZlclxuXHRcdGlmIChidWZfbGVuID09IDApIHtcblx0XHRcdGxldCBzZWxmID0gdGhpcztcblx0XHRcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGZvciAobGV0IFtldiwgZUFyZywgc3Vic10gb2Ygc2VsZi5fX2V2ZW50aWZ5X2J1ZmZlcikge1xuXHRcdFx0XHRcdC8vIGFjdHVhbCBldmVudCB0cmlnZ2VyaW5nXG5cdFx0XHRcdFx0ZXYudHJpZ2dlcihlQXJnLCBzdWJzLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZi5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIG11bHRpcGxlIGV2ZW50cyBvZiBzYW1lIHR5cGUgKG5hbWUpXG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsaWtlKG5hbWUsIGVBcmdzKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKGVBcmdzLm1hcChlQXJnID0+IHtcblx0XHRcdHJldHVybiB7bmFtZSwgZUFyZ307XG5cdFx0fSkpO1xuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIHNpbmdsZSBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXIobmFtZSwgZUFyZykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChbe25hbWUsIGVBcmd9XSk7XG5cdH1cblxuXHRfcHJvdG90eXBlLmV2ZW50aWZ5RGVmaW5lID0gZXZlbnRpZnlEZWZpbmU7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyID0gZXZlbnRpZnlUcmlnZ2VyO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsaWtlID0gZXZlbnRpZnlUcmlnZ2VyQWxpa2U7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxsID0gZXZlbnRpZnlUcmlnZ2VyQWxsO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5U3Vic2NyaXB0aW9ucyA9IGV2ZW50aWZ5U3Vic2NyaXB0aW9ucztcblx0X3Byb3RvdHlwZS5vbiA9IG9uO1xuXHRfcHJvdG90eXBlLm9mZiA9IG9mZjtcbn07XG5cblxuZXhwb3J0IGNvbnN0IGV2ZW50aWZ5ID0gZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4ge1xuXHRcdGFkZFRvSW5zdGFuY2U6IGV2ZW50aWZ5SW5zdGFuY2UsXG5cdFx0YWRkVG9Qcm90b3R5cGU6IGV2ZW50aWZ5UHJvdG90eXBlXG5cdH1cbn0oKTtcblxuLypcblx0RXZlbnQgVmFyaWFibGVcblxuXHRPYmplY3RzIHdpdGggYSBzaW5nbGUgXCJjaGFuZ2VcIiBldmVudFxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50VmFyaWFibGUge1xuXG5cdGNvbnN0cnVjdG9yICh2YWx1ZSkge1xuXHRcdGV2ZW50aWZ5SW5zdGFuY2UodGhpcyk7XG5cdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHR0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcblx0fVxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5fdmFsdWV9O1xuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlICE9IHRoaXMuX3ZhbHVlKSB7XG5cdFx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuZXZlbnRpZnlQcm90b3R5cGUoRXZlbnRWYXJpYWJsZS5wcm90b3R5cGUpO1xuXG4vKlxuXHRFdmVudCBCb29sZWFuXG5cblxuXHROb3RlIDogaW1wbGVtZW50YXRpb24gdXNlcyBmYWxzaW5lc3Mgb2YgaW5wdXQgcGFyYW1ldGVyIHRvIGNvbnN0cnVjdG9yIGFuZCBzZXQoKSBvcGVyYXRpb24sXG5cdHNvIGV2ZW50Qm9vbGVhbigtMSkgd2lsbCBhY3R1YWxseSBzZXQgaXQgdG8gdHJ1ZSBiZWNhdXNlXG5cdCgtMSkgPyB0cnVlIDogZmFsc2UgLT4gdHJ1ZSAhXG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRCb29sZWFuIGV4dGVuZHMgRXZlbnRWYXJpYWJsZSB7XG5cdGNvbnN0cnVjdG9yKHZhbHVlKSB7XG5cdFx0c3VwZXIoQm9vbGVhbih2YWx1ZSkpO1xuXHR9XG5cblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdHN1cGVyLnZhbHVlID0gQm9vbGVhbih2YWx1ZSk7XG5cdH1cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gc3VwZXIudmFsdWV9O1xufVxuXG5cbi8qXG5cdG1ha2UgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gRXZlbnRCb29sZWFuIGNoYW5nZXNcblx0dmFsdWUuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQcm9taXNlKGV2ZW50T2JqZWN0LCBjb25kaXRpb25GdW5jKSB7XG5cdGNvbmRpdGlvbkZ1bmMgPSBjb25kaXRpb25GdW5jIHx8IGZ1bmN0aW9uKHZhbCkge3JldHVybiB2YWwgPT0gdHJ1ZX07XG5cdHJldHVybiBuZXcgUHJvbWlzZSAoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdGxldCBzdWIgPSBldmVudE9iamVjdC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdGlmIChjb25kaXRpb25GdW5jKHZhbHVlKSkge1xuXHRcdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHRcdFx0ZXZlbnRPYmplY3Qub2ZmKHN1Yik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufTtcblxuLy8gbW9kdWxlIGFwaVxuZXhwb3J0IGRlZmF1bHQge1xuXHRldmVudGlmeVByb3RvdHlwZSxcblx0ZXZlbnRpZnlJbnN0YW5jZSxcblx0RXZlbnRWYXJpYWJsZSxcblx0RXZlbnRCb29sZWFuLFxuXHRtYWtlUHJvbWlzZVxufTtcblxuIiwiXG4vLyBvdnZlcnJpZGUgbW9kdWxvIHRvIGJlaGF2ZSBiZXR0ZXIgZm9yIG5lZ2F0aXZlIG51bWJlcnNcbmV4cG9ydCBmdW5jdGlvbiBtb2QobiwgbSkge1xuICAgIHJldHVybiAoKG4gJSBtKSArIG0pICUgbTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBkaXZtb2QoeCwgYmFzZSkge1xuICAgIGxldCBuID0gTWF0aC5mbG9vcih4IC8gYmFzZSlcbiAgICBsZXQgciA9IG1vZCh4LCBiYXNlKTtcbiAgICByZXR1cm4gW24sIHJdO1xufVxuXG5cbi8qXG4gICAgVGhpcyBhZGRzIGJhc2ljIChzeW5jaHJvbm91cykgY2FsbGJhY2sgc3VwcG9ydCB0byBhbiBvYmplY3QuXG4qL1xuXG5leHBvcnQgY29uc3QgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICBmdW5jdGlvbiBhZGRUb0luc3RhbmNlKG9iamVjdCkge1xuICAgICAgICBvYmplY3QuX19jYWxsYmFja19jYWxsYmFja3MgPSBbXTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRfY2FsbGJhY2sgKGhhbmRsZXIpIHtcbiAgICAgICAgbGV0IGhhbmRsZSA9IHtcbiAgICAgICAgICAgIGhhbmRsZXI6IGhhbmRsZXJcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9fY2FsbGJhY2tfY2FsbGJhY2tzLnB1c2goaGFuZGxlKTtcbiAgICAgICAgcmV0dXJuIGhhbmRsZTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gcmVtb3ZlX2NhbGxiYWNrIChoYW5kbGUpIHtcbiAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5fX2NhbGxiYWNrX2NhbGxiYWNrcy5pbmRleG9mKGhhbmRsZSk7XG4gICAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgICAgICB0aGlzLl9fY2FsbGJhY2tfY2FsbGJhY2tzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gbm90aWZ5X2NhbGxiYWNrcyAoZUFyZykge1xuICAgICAgICB0aGlzLl9fY2FsbGJhY2tfY2FsbGJhY2tzLmZvckVhY2goZnVuY3Rpb24oaGFuZGxlKSB7XG4gICAgICAgICAgICBoYW5kbGUuaGFuZGxlcihlQXJnKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuXG4gICAgZnVuY3Rpb24gYWRkVG9Qcm90b3R5cGUgKF9wcm90b3R5cGUpIHtcbiAgICAgICAgY29uc3QgYXBpID0ge1xuICAgICAgICAgICAgYWRkX2NhbGxiYWNrLCByZW1vdmVfY2FsbGJhY2ssIG5vdGlmeV9jYWxsYmFja3NcbiAgICAgICAgfVxuICAgICAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHthZGRUb0luc3RhbmNlLCBhZGRUb1Byb3RvdHlwZX1cbn0oKTtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTT1VSQ0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogRXh0ZW5kIGEgY2xhc3Mgd2l0aCBzdXBwb3J0IGZvciBleHRlcm5hbCBzb3VyY2Ugb24gXG4gKiBhIG5hbWVkIHByb3BlcnR5LlxuICogXG4gKiBvcHRpb246IG11dGFibGU6dHJ1ZSBtZWFucyB0aGF0IHByb3BlcnkgbWF5IGJlIHJlc2V0IFxuICogXG4gKiBzb3VyY2Ugb2JqZWN0IGlzIGFzc3VtZWQgdG8gc3VwcG9ydCB0aGUgY2FsbGJhY2sgaW50ZXJmYWNlXG4gKi9cblxuXG5leHBvcnQgY29uc3Qgc291cmNlID0gZnVuY3Rpb24gKCkge1xuXG4gICAgZnVuY3Rpb24gcHJvcG5hbWVzIChwcm9wTmFtZSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcHJvcDogYF9fJHtwcm9wTmFtZX1gLFxuICAgICAgICAgICAgaW5pdDogYF9fJHtwcm9wTmFtZX1faW5pdGAsXG4gICAgICAgICAgICBoYW5kbGU6IGBfXyR7cHJvcE5hbWV9X2hhbmRsZWAsXG4gICAgICAgICAgICBvbmNoYW5nZTogYF9fJHtwcm9wTmFtZX1fb25jaGFuZ2VgLFxuICAgICAgICAgICAgZGV0YXRjaDogYF9fJHtwcm9wTmFtZX1fZGV0YXRjaGAsXG4gICAgICAgICAgICBhdHRhdGNoOiBgX18ke3Byb3BOYW1lfV9hdHRhdGNoYCxcbiAgICAgICAgICAgIGNoZWNrOiBgX18ke3Byb3BOYW1lfV9jaGVja2BcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2UgKG9iamVjdCwgcHJvcE5hbWUpIHtcbiAgICAgICAgY29uc3QgcCA9IHByb3BuYW1lcyhwcm9wTmFtZSlcbiAgICAgICAgb2JqZWN0W3AucHJvcF0gPSB1bmRlZmluZWRcbiAgICAgICAgb2JqZWN0W3AuaW5pdF0gPSBmYWxzZTtcbiAgICAgICAgb2JqZWN0W3AuaGFuZGxlXSA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSwgcHJvcE5hbWUsIG9wdGlvbnM9e30pIHtcblxuICAgICAgICBjb25zdCBwID0gcHJvcG5hbWVzKHByb3BOYW1lKVxuXG4gICAgICAgIGZ1bmN0aW9uIGRldGF0Y2goKSB7XG4gICAgICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIHNvdXJjZSBjaGFuZ2UgZXZlbnRcbiAgICAgICAgICAgIGxldCB7bXV0YWJsZT1mYWxzZX0gPSBvcHRpb25zO1xuICAgICAgICAgICAgaWYgKG11dGFibGUgJiYgdGhpc1twLnByb3BdKSB7XG4gICAgICAgICAgICAgICAgbGV0IGhhbmRsZSA9IHRoaXNbcC5oYW5kbGVdO1xuICAgICAgICAgICAgICAgIHRoaXNbcC5wcm9wXS5yZW1vdmVfY2FsbGJhY2soaGFuZGxlKTtcbiAgICAgICAgICAgICAgICB0aGlzW3AuaGFuZGxlXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXNbcC5wcm9wXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICBmdW5jdGlvbiBhdHRhdGNoKHNvdXJjZSkge1xuICAgICAgICAgICAgbGV0IHttdXRhYmxlPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgICAgICAgICBpZiAoIXRoaXNbcC5pbml0XSB8fCBtdXRhYmxlKSB7XG4gICAgICAgICAgICAgICAgdGhpc1twLnByb3BdID0gc291cmNlO1xuICAgICAgICAgICAgICAgIHRoaXNbcC5pbml0XSA9IHRydWU7XG4gICAgICAgICAgICAgICAgLy8gc3Vic2NyaWJlIHRvIGNhbGxiYWNrIGZyb20gc291cmNlXG4gICAgICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IHRoaXNbcC5vbmNoYW5nZV0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzW3AuaGFuZGxlXSA9IHNvdXJjZS5hZGRfY2FsbGJhY2soaGFuZGxlcik7XG4gICAgICAgICAgICAgICAgaGFuZGxlcigpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7cHJvcE5hbWV9IGNhbiBub3QgYmUgcmVhc3NpZ25lZGApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogXG4gICAgICAgICAqIG9iamVjdCBtdXN0IGltcGxlbWVudFxuICAgICAgICAgKiBfX3twcm9wTmFtZX1fb25jaGFuZ2UoKSB7fVxuICAgICAgICAgKiBcbiAgICAgICAgICogb2JqZWN0IGNhbiBpbXBsZW1lbnRcbiAgICAgICAgICogX197cHJvcE5hbWV9X2NoZWNrKHNvdXJjZSkge31cbiAgICAgICAgICovXG5cbiAgICAgICAgLy8gZ2V0dGVyIGFuZCBzZXR0ZXJcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KF9wcm90b3R5cGUsIHByb3BOYW1lLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpc1twLnByb3BdO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHNyYykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzW3AuY2hlY2tdKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbcC5jaGVja10oc3JjKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc3JjICE9IHRoaXNbcC5wcm9wXSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzW3AuZGV0YXRjaF0oKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1twLmF0dGF0Y2hdKHNyYyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGFwaSA9IHt9O1xuICAgICAgICBhcGlbcC5kZXRhdGNoXSA9IGRldGF0Y2g7XG4gICAgICAgIGFwaVtwLmF0dGF0Y2hdID0gYXR0YXRjaDtcblxuICAgICAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG4gICAgfVxuICAgIHJldHVybiB7YWRkVG9JbnN0YW5jZSwgYWRkVG9Qcm90b3R5cGV9O1xufSgpO1xuXG4iLCJpbXBvcnQge2Rpdm1vZH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuXG4vKlxuICAgIFRpbWVvdXQgTW9uaXRvclxuXG4gICAgVGltZW91dCBNb25pdG9yIGlzIHNpbWlsYXIgdG8gc2V0SW50ZXJ2YWwsIGluIHRoZSBzZW5zZSB0aGF0IFxuICAgIGl0IGFsbG93cyBjYWxsYmFja3MgdG8gYmUgZmlyZWQgcGVyaW9kaWNhbGx5IFxuICAgIHdpdGggYSBnaXZlbiBkZWxheSAoaW4gbWlsbGlzKS4gIFxuICAgIFxuICAgIFRpbWVvdXQgTW9uaXRvciBpcyBtYWRlIHRvIHNhbXBsZSB0aGUgc3RhdGUgXG4gICAgb2YgYSBkeW5hbWljIG9iamVjdCwgcGVyaW9kaWNhbGx5LiBGb3IgdGhpcyByZWFzb24sIGVhY2ggY2FsbGJhY2sgaXMgXG4gICAgYm91bmQgdG8gYSBtb25pdG9yZWQgb2JqZWN0LCB3aGljaCB3ZSBoZXJlIGNhbGwgYSB2YXJpYWJsZS4gXG4gICAgT24gZWFjaCBpbnZvY2F0aW9uLCBhIGNhbGxiYWNrIHdpbGwgcHJvdmlkZSBhIGZyZXNobHkgc2FtcGxlZCBcbiAgICB2YWx1ZSBmcm9tIHRoZSB2YXJpYWJsZS5cblxuICAgIFRoaXMgdmFsdWUgaXMgYXNzdW1lZCB0byBiZSBhdmFpbGFibGUgYnkgcXVlcnlpbmcgdGhlIHZhcmlhYmxlLiBcblxuICAgICAgICB2LnF1ZXJ5KCkgLT4ge3ZhbHVlLCBkeW5hbWljLCBvZmZzZXQsIHRzfVxuXG4gICAgSW4gYWRkaXRpb24sIHRoZSB2YXJpYWJsZSBvYmplY3QgbWF5IHN3aXRjaCBiYWNrIGFuZCBcbiAgICBmb3J0aCBiZXR3ZWVuIGR5bmFtaWMgYW5kIHN0YXRpYyBiZWhhdmlvci4gVGhlIFRpbWVvdXQgTW9uaXRvclxuICAgIHR1cm5zIHBvbGxpbmcgb2ZmIHdoZW4gdGhlIHZhcmlhYmxlIGlzIG5vIGxvbmdlciBkeW5hbWljLCBcbiAgICBhbmQgcmVzdW1lcyBwb2xsaW5nIHdoZW4gdGhlIG9iamVjdCBiZWNvbWVzIGR5bmFtaWMuXG5cbiAgICBTdGF0ZSBjaGFuZ2VzIGFyZSBleHBlY3RlZCB0byBiZSBzaWduYWxsZWQgdGhyb3VnaCBhIDxjaGFuZ2U+IGV2ZW50LlxuXG4gICAgICAgIHN1YiA9IHYub24oXCJjaGFuZ2VcIiwgY2FsbGJhY2spXG4gICAgICAgIHYub2ZmKHN1YilcblxuICAgIENhbGxiYWNrcyBhcmUgaW52b2tlZCBvbiBldmVyeSA8Y2hhbmdlPiBldmVudCwgYXMgd2VsbFxuICAgIGFzIHBlcmlvZGljYWxseSB3aGVuIHRoZSBvYmplY3QgaXMgaW4gPGR5bmFtaWM+IHN0YXRlLlxuXG4gICAgICAgIGNhbGxiYWNrKHt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0LCB0c30pXG5cbiAgICBGdXJ0aGVybW9yZSwgaW4gb3JkZXIgdG8gc3VwcG9ydCBjb25zaXN0ZW50IHJlbmRlcmluZyBvZlxuICAgIHN0YXRlIGNoYW5nZXMgZnJvbSBtYW55IGR5bmFtaWMgdmFyaWFibGVzLCBpdCBpcyBpbXBvcnRhbnQgdGhhdFxuICAgIGNhbGxiYWNrcyBhcmUgaW52b2tlZCBhdCB0aGUgc2FtZSB0aW1lIGFzIG11Y2ggYXMgcG9zc2libGUsIHNvXG4gICAgdGhhdCBjaGFuZ2VzIHRoYXQgb2NjdXIgbmVhciBpbiB0aW1lIGNhbiBiZSBwYXJ0IG9mIHRoZSBzYW1lXG4gICAgc2NyZWVuIHJlZnJlc2guIFxuXG4gICAgRm9yIHRoaXMgcmVhc29uLCB0aGUgVGltZW91dE1vbml0b3IgZ3JvdXBzIGNhbGxiYWNrcyBpbiB0aW1lXG4gICAgYW5kIGludm9rZXMgY2FsbGJhY2tzIGF0IGF0IGZpeGVkIG1heGltdW0gcmF0ZSAoMjBIei81MG1zKS5cbiAgICBUaGlzIGltcGxpZXMgdGhhdCBwb2xsaW5nIGNhbGxiYWNrcyB3aWxsIGZhbGwgb24gYSBzaGFyZWQgXG4gICAgcG9sbGluZyBmcmVxdWVuY3kuXG5cbiAgICBBdCB0aGUgc2FtZSB0aW1lLCBjYWxsYmFja3MgbWF5IGhhdmUgaW5kaXZpZHVhbCBmcmVxdWVuY2llcyB0aGF0XG4gICAgYXJlIG11Y2ggbG93ZXIgcmF0ZSB0aGFuIHRoZSBtYXhpbXVtIHJhdGUuIFRoZSBpbXBsZW1lbnRhdGlvblxuICAgIGRvZXMgbm90IHJlbHkgb24gYSBmaXhlZCA1MG1zIHRpbWVvdXQgZnJlcXVlbmN5LCBidXQgaXMgdGltZW91dCBiYXNlZCxcbiAgICB0aHVzIHRoZXJlIGlzIG5vIHByb2Nlc3Npbmcgb3IgdGltZW91dCBiZXR3ZWVuIGNhbGxiYWNrcywgZXZlblxuICAgIGlmIGFsbCBjYWxsYmFja3MgaGF2ZSBsb3cgcmF0ZXMuXG5cbiAgICBJdCBpcyBzYWZlIHRvIGRlZmluZSBtdWx0aXBsZSBjYWxsYWJhY2tzIGZvciBhIHNpbmdsZSB2YXJpYWJsZSwgZWFjaFxuICAgIGNhbGxiYWNrIHdpdGggYSBkaWZmZXJlbnQgcG9sbGluZyBmcmVxdWVuY3kuXG5cbiAgICBvcHRpb25zXG4gICAgICAgIDxyYXRlPiAtIGRlZmF1bHQgNTA6IHNwZWNpZnkgbWluaW11bSBmcmVxdWVuY3kgaW4gbXNcblxuKi9cblxuXG5jb25zdCBSQVRFX01TID0gNTBcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVElNRU9VVCBNT05JVE9SXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgQmFzZSBjbGFzcyBmb3IgVGltZW91dCBNb25pdG9yIGFuZCBGcmFtZXJhdGUgTW9uaXRvclxuKi9cblxuY2xhc3MgVGltZW91dE1vbml0b3Ige1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuXG4gICAgICAgIHRoaXMuX29wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtyYXRlOiBSQVRFX01TfSwgb3B0aW9ucyk7XG4gICAgICAgIGlmICh0aGlzLl9vcHRpb25zLnJhdGUgPCBSQVRFX01TKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlsbGVnYWwgcmF0ZSAke3JhdGV9LCBtaW5pbXVtIHJhdGUgaXMgJHtSQVRFX01TfWApO1xuICAgICAgICB9XG4gICAgICAgIC8qXG4gICAgICAgICAgICBtYXBcbiAgICAgICAgICAgIGhhbmRsZSAtPiB7Y2FsbGJhY2ssIHZhcmlhYmxlLCBkZWxheX1cbiAgICAgICAgICAgIC0gdmFyaWFibGU6IHRhcmdldCBmb3Igc2FtcGxpbmdcbiAgICAgICAgICAgIC0gY2FsbGJhY2s6IGZ1bmN0aW9uKHZhbHVlKVxuICAgICAgICAgICAgLSBkZWxheTogYmV0d2VlbiBzYW1wbGVzICh3aGVuIHZhcmlhYmxlIGlzIGR5bmFtaWMpXG4gICAgICAgICovXG4gICAgICAgIHRoaXMuX3NldCA9IG5ldyBTZXQoKTtcbiAgICAgICAgLypcbiAgICAgICAgICAgIHZhcmlhYmxlIG1hcFxuICAgICAgICAgICAgdmFyaWFibGUgLT4ge3N1YiwgcG9sbGluZywgaGFuZGxlczpbXX1cbiAgICAgICAgICAgIC0gc3ViIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICAgICAgICAgLSBwb2xsaW5nOiB0cnVlIGlmIHZhcmlhYmxlIG5lZWRzIHBvbGxpbmdcbiAgICAgICAgICAgIC0gaGFuZGxlczogbGlzdCBvZiBoYW5kbGVzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIC8vIHZhcmlhYmxlIGNoYW5nZSBoYW5kbGVyXG4gICAgICAgIHRoaXMuX19vbnZhcmlhYmxlY2hhbmdlID0gdGhpcy5fb252YXJpYWJsZWNoYW5nZS5iaW5kKHRoaXMpO1xuICAgIH1cblxuICAgIGJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgICAgICAvLyByZWdpc3RlciBiaW5kaW5nXG4gICAgICAgIGxldCBoYW5kbGUgPSB7Y2FsbGJhY2ssIHZhcmlhYmxlLCBkZWxheX07XG4gICAgICAgIHRoaXMuX3NldC5hZGQoaGFuZGxlKTtcbiAgICAgICAgLy8gcmVnaXN0ZXIgdmFyaWFibGVcbiAgICAgICAgaWYgKCF0aGlzLl92YXJpYWJsZV9tYXAuaGFzKHZhcmlhYmxlKSkge1xuICAgICAgICAgICAgbGV0IHN1YiA9IHZhcmlhYmxlLm9uKFwiY2hhbmdlXCIsIHRoaXMuX19vbnZhcmlhYmxlY2hhbmdlKTtcbiAgICAgICAgICAgIGxldCBpdGVtID0ge3N1YiwgcG9sbGluZzpmYWxzZSwgaGFuZGxlczogW2hhbmRsZV19O1xuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLnNldCh2YXJpYWJsZSwgaXRlbSk7XG4gICAgICAgICAgICAvL3RoaXMuX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKS5oYW5kbGVzLnB1c2goaGFuZGxlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaGFuZGxlO1xuICAgIH1cblxuICAgIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgICAgIC8vIGNsZWFudXBcbiAgICAgICAgbGV0IHJlbW92ZWQgPSB0aGlzLl9zZXQuZGVsZXRlKGhhbmRsZSk7XG4gICAgICAgIGlmICghcmVtb3ZlZCkgcmV0dXJuO1xuICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjbGVhbnVwIHZhcmlhYmxlIG1hcFxuICAgICAgICBsZXQgdmFyaWFibGUgPSBoYW5kbGUudmFyaWFibGU7XG4gICAgICAgIGxldCB7c3ViLCBoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQgaWR4ID0gaGFuZGxlcy5pbmRleE9mKGhhbmRsZSk7XG4gICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgaGFuZGxlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGFuZGxlcy5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgLy8gdmFyaWFibGUgaGFzIG5vIGhhbmRsZXNcbiAgICAgICAgICAgIC8vIGNsZWFudXAgdmFyaWFibGUgbWFwXG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuZGVsZXRlKHZhcmlhYmxlKTtcbiAgICAgICAgICAgIHZhcmlhYmxlLm9mZihzdWIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgdmFyaWFibGUgZW1pdHMgYSBjaGFuZ2UgZXZlbnRcbiAgICAqL1xuICAgIF9vbnZhcmlhYmxlY2hhbmdlIChlQXJnLCBlSW5mbykge1xuICAgICAgICBsZXQgdmFyaWFibGUgPSBlSW5mby5zcmM7XG4gICAgICAgIC8vIGRpcmVjdCBjYWxsYmFjayAtIGNvdWxkIHVzZSBlQXJnIGhlcmVcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQgc3RhdGUgPSBlQXJnO1xuICAgICAgICAvLyByZWV2YWx1YXRlIHBvbGxpbmdcbiAgICAgICAgdGhpcy5fcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlLCBzdGF0ZSk7XG4gICAgICAgIC8vIGNhbGxiYWNrc1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHN0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHN0YXJ0IG9yIHN0b3AgcG9sbGluZyBpZiBuZWVkZWRcbiAgICAqL1xuICAgIF9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUsIHN0YXRlKSB7XG4gICAgICAgIGxldCBpdGVtID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCB7cG9sbGluZzp3YXNfcG9sbGluZ30gPSBpdGVtO1xuICAgICAgICBzdGF0ZSA9IHN0YXRlIHx8IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgIGxldCBzaG91bGRfYmVfcG9sbGluZyA9IHN0YXRlLmR5bmFtaWM7XG4gICAgICAgIGlmICghd2FzX3BvbGxpbmcgJiYgc2hvdWxkX2JlX3BvbGxpbmcpIHtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dHModmFyaWFibGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHdhc19wb2xsaW5nICYmICFzaG91bGRfYmVfcG9sbGluZykge1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBzZXQgdGltZW91dCBmb3IgYWxsIGNhbGxiYWNrcyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAqL1xuICAgIF9zZXRfdGltZW91dHModmFyaWFibGUpIHtcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9zZXRfdGltZW91dChoYW5kbGUpIHtcbiAgICAgICAgbGV0IGRlbHRhID0gdGhpcy5fY2FsY3VsYXRlX2RlbHRhKGhhbmRsZS5kZWxheSk7XG4gICAgICAgIGxldCBoYW5kbGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlX3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBoYW5kbGUudGlkID0gc2V0VGltZW91dChoYW5kbGVyLCBkZWx0YSk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgYWRqdXN0IGRlbGF5IHNvIHRoYXQgaWYgZmFsbHMgb25cbiAgICAgICAgdGhlIG1haW4gdGljayByYXRlXG4gICAgKi9cbiAgICBfY2FsY3VsYXRlX2RlbHRhKGRlbGF5KSB7XG4gICAgICAgIGxldCByYXRlID0gdGhpcy5fb3B0aW9ucy5yYXRlO1xuICAgICAgICBsZXQgbm93ID0gTWF0aC5yb3VuZChwZXJmb3JtYW5jZS5ub3coKSk7XG4gICAgICAgIGxldCBbbm93X24sIG5vd19yXSA9IGRpdm1vZChub3csIHJhdGUpO1xuICAgICAgICBsZXQgW24sIHJdID0gZGl2bW9kKG5vdyArIGRlbGF5LCByYXRlKTtcbiAgICAgICAgbGV0IHRhcmdldCA9IE1hdGgubWF4KG4sIG5vd19uICsgMSkqcmF0ZTtcbiAgICAgICAgcmV0dXJuIHRhcmdldCAtIHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGNsZWFyIGFsbCB0aW1lb3V0cyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAqL1xuICAgIF9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSkge1xuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICBpZiAoaGFuZGxlLnRpZCAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoaGFuZGxlLnRpZCk7XG4gICAgICAgICAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGhhbmRsZSB0aW1lb3V0XG4gICAgKi9cbiAgICBfaGFuZGxlX3RpbWVvdXQoaGFuZGxlKSB7XG4gICAgICAgIC8vIGRyb3AgaWYgaGFuZGxlIHRpZCBoYXMgYmVlbiBjbGVhcmVkXG4gICAgICAgIGlmIChoYW5kbGUudGlkID09IHVuZGVmaW5lZCkgcmV0dXJuO1xuICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjYWxsYmFja1xuICAgICAgICBsZXQge3ZhcmlhYmxlfSA9IGhhbmRsZTtcbiAgICAgICAgbGV0IHN0YXRlID0gdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgLy8gcmVzY2hlZHVsZSB0aW1lb3V0cyBmb3IgY2FsbGJhY2tzXG4gICAgICAgIGlmIChzdGF0ZS5keW5hbWljKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICBtYWtlIHN1cmUgcG9sbGluZyBzdGF0ZSBpcyBhbHNvIGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcyB3b3VsZCBvbmx5IG9jY3VyIGlmIHRoZSB2YXJpYWJsZVxuICAgICAgICAgICAgICAgIHdlbnQgZnJvbSByZXBvcnRpbmcgZHluYW1pYyB0cnVlIHRvIGR5bmFtaWMgZmFsc2UsXG4gICAgICAgICAgICAgICAgd2l0aG91dCBlbW1pdHRpbmcgYSBjaGFuZ2UgZXZlbnQgLSB0aHVzXG4gICAgICAgICAgICAgICAgdmlvbGF0aW5nIHRoZSBhc3N1bXB0aW9uLiBUaGlzIHByZXNlcnZlc1xuICAgICAgICAgICAgICAgIGludGVybmFsIGludGVncml0eSBpIHRoZSBtb25pdG9yLlxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGxldCBpdGVtID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICAvL1xuICAgICAgICBoYW5kbGUuY2FsbGJhY2soc3RhdGUpO1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBGUkFNRVJBVEUgTU9OSVRPUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5cbmNsYXNzIEZyYW1lcmF0ZU1vbml0b3IgZXh0ZW5kcyBUaW1lb3V0TW9uaXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgICB0aGlzLl9oYW5kbGU7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgdGltZW91dHMgYXJlIG9ic29sZXRlXG4gICAgKi9cbiAgICBfc2V0X3RpbWVvdXRzKHZhcmlhYmxlKSB7fVxuICAgIF9zZXRfdGltZW91dChoYW5kbGUpIHt9XG4gICAgX2NhbGN1bGF0ZV9kZWx0YShkZWxheSkge31cbiAgICBfY2xlYXJfdGltZW91dHModmFyaWFibGUpIHt9XG4gICAgX2hhbmRsZV90aW1lb3V0KGhhbmRsZSkge31cblxuICAgIF9vbnZhcmlhYmxlY2hhbmdlIChlQXJnLCBlSW5mbykge1xuICAgICAgICBzdXBlci5fb252YXJpYWJsZWNoYW5nZShlQXJnLCBlSW5mbyk7XG4gICAgICAgIC8vIGtpY2sgb2ZmIGNhbGxiYWNrIGxvb3AgZHJpdmVuIGJ5IHJlcXVlc3QgYW5pbWF0aW9uZnJhbWVcbiAgICAgICAgdGhpcy5fY2FsbGJhY2soKTtcbiAgICB9XG5cbiAgICBfY2FsbGJhY2soKSB7XG4gICAgICAgIC8vIGNhbGxiYWNrIHRvIGFsbCB2YXJpYWJsZXMgd2hpY2ggcmVxdWlyZSBwb2xsaW5nXG4gICAgICAgIGxldCB2YXJpYWJsZXMgPSBbLi4udGhpcy5fdmFyaWFibGVfbWFwLmVudHJpZXMoKV1cbiAgICAgICAgICAgIC5maWx0ZXIoKFt2YXJpYWJsZSwgaXRlbV0pID0+IGl0ZW0ucG9sbGluZylcbiAgICAgICAgICAgIC5tYXAoKFt2YXJpYWJsZSwgaXRlbV0pID0+IHZhcmlhYmxlKTtcbiAgICAgICAgaWYgKHZhcmlhYmxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBjYWxsYmFja1xuICAgICAgICAgICAgZm9yIChsZXQgdmFyaWFibGUgb2YgdmFyaWFibGVzKSB7XG4gICAgICAgICAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICAgICAgICAgIGxldCByZXMgPSB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZS5jYWxsYmFjayhyZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8qIFxuICAgICAgICAgICAgICAgIHJlcXVlc3QgbmV4dCBjYWxsYmFjayBhcyBsb25nIGFzIGF0IGxlYXN0IG9uZSB2YXJpYWJsZSBcbiAgICAgICAgICAgICAgICBpcyByZXF1aXJpbmcgcG9sbGluZ1xuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLl9jYWxsYmFjay5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQklORCBSRUxFQVNFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmNvbnN0IG1vbml0b3IgPSBuZXcgVGltZW91dE1vbml0b3IoKTtcbmNvbnN0IGZyYW1lcmF0ZV9tb25pdG9yID0gbmV3IEZyYW1lcmF0ZU1vbml0b3IoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgIGxldCBoYW5kbGU7XG4gICAgaWYgKEJvb2xlYW4ocGFyc2VGbG9hdChkZWxheSkpKSB7XG4gICAgICAgIGhhbmRsZSA9IG1vbml0b3IuYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIFtcInRpbWVvdXRcIiwgaGFuZGxlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBoYW5kbGUgPSBmcmFtZXJhdGVfbW9uaXRvci5iaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgMCwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBbXCJmcmFtZXJhdGVcIiwgaGFuZGxlXTtcbiAgICB9XG59XG5leHBvcnQgZnVuY3Rpb24gcmVsZWFzZShoYW5kbGUpIHtcbiAgICBsZXQgW3R5cGUsIF9oYW5kbGVdID0gaGFuZGxlO1xuICAgIGlmICh0eXBlID09IFwidGltZW91dFwiKSB7XG4gICAgICAgIHJldHVybiBtb25pdG9yLnJlbGVhc2UoX2hhbmRsZSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwiZnJhbWVyYXRlXCIpIHtcbiAgICAgICAgcmV0dXJuIGZyYW1lcmF0ZV9tb25pdG9yLnJlbGVhc2UoX2hhbmRsZSk7XG4gICAgfVxufVxuXG4iLCJpbXBvcnQgeyBldmVudGlmeSB9IGZyb20gXCIuL2V2ZW50aWZ5LmpzXCI7XG5pbXBvcnQgeyBjYWxsYmFjayB9IGZyb20gXCIuL3V0aWwuanNcIjtcbmltcG9ydCB7IGJpbmQsIHJlbGVhc2UgfSBmcm9tIFwiLi9tb25pdG9yLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIFNUQVRFIFBST1ZJREVSIEJBU0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgQmFzZSBjbGFzcyBmb3IgYWxsIHN0YXRlIHByb3ZpZGVyc1xuXG4gICAgLSBvYmplY3Qgd2l0aCBjb2xsZWN0aW9uIG9mIGl0ZW1zXG4gICAgLSBjb3VsZCBiZSBsb2NhbCAtIG9yIHByb3h5IHRvIG9ubGluZSBzb3VyY2VcblxuICAgIHJlcHJlc2VudHMgYSBkeW5hbWljIGNvbGxlY3Rpb24gb2YgaXRlbXNcbiAgICB7aW50ZXJ2YWwsIC4uLmRhdGF9XG4qL1xuXG5leHBvcnQgY2xhc3MgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuXG4gICAgLy8gcHVibGljIHVwZGF0ZSBmdW5jdGlvblxuICAgIHVwZGF0ZShpdGVtcyl7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl91cGRhdGUoaXRlbXMpO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaGFuZGxlX3VwZGF0ZShpdGVtcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgZ2V0IGl0ZW1zKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoU3RhdGVQcm92aWRlckJhc2UucHJvdG90eXBlKTtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUiBCQVNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBjYWxsYmFjay5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUllcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIHF1ZXJ5IChvZmZzZXQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKExheWVyQmFzZS5wcm90b3R5cGUpO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUiBCQVNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgQ3Vyc29yQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIC8vIGRlZmluZSBjaGFuZ2UgZXZlbnRcbiAgICAgICAgZXZlbnRpZnkuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5ldmVudGlmeURlZmluZShcImNoYW5nZVwiLCB7aW5pdDp0cnVlfSk7XG4gICAgfVxuICAgIFxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUllcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIHF1ZXJ5ICgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIEV2ZW50aWZ5OiBpbW1lZGlhdGUgZXZlbnRzXG4gICAgKi9cbiAgICBldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuICAgICAgICBpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG4gICAgICAgICAgICByZXR1cm4gW3RoaXMucXVlcnkoKV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIEJJTkQgUkVMRUFTRSAoY29udmVuaWVuY2UpXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBiaW5kKGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgICAgICByZXR1cm4gYmluZCh0aGlzLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnMpO1xuICAgIH1cbiAgICByZWxlYXNlKGhhbmRsZSkge1xuICAgICAgICByZXR1cm4gcmVsZWFzZShoYW5kbGUpO1xuICAgIH1cblxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoQ3Vyc29yQmFzZS5wcm90b3R5cGUpO1xuZXZlbnRpZnkuYWRkVG9Qcm90b3R5cGUoQ3Vyc29yQmFzZS5wcm90b3R5cGUpO1xuXG4iLCJpbXBvcnQge1N0YXRlUHJvdmlkZXJCYXNlfSBmcm9tIFwiLi9iYXNlcy5qc1wiO1xuaW1wb3J0IHtlbmRwb2ludH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBTSU1QTEUgU1RBVEUgUFJPVklERVIgKExPQ0FMKVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIExvY2FsIEFycmF5IHdpdGggbm9uIG92ZXJsYXBwaW5nIGl0ZW1zLlxuICovXG5cbmV4cG9ydCBjbGFzcyBTaW1wbGVTdGF0ZVByb3ZpZGVyIGV4dGVuZHMgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9pdGVtcyA9IFtdO1xuICAgICAgICBsZXQge2l0ZW1zfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChpdGVtcykge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVfdXBkYXRlKGl0ZW1zKTsgIFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gaW50ZXJuYWwgdXBkYXRlIGZ1bmN0aW9uXG4gICAgX3VwZGF0ZSAoaXRlbXMpIHtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBjaGVja19pbnB1dChpdGVtcyk7XG4gICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgIH1cblxuICAgIGdldCBpdGVtcyAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pdGVtcztcbiAgICB9XG5cbiAgICBnZXQgaW5mbyAoKSB7XG4gICAgICAgIHJldHVybiB7ZHluYW1pYzogdHJ1ZSwgb3ZlcmxhcHBpbmc6IGZhbHNlLCBsb2NhbDp0cnVlfTtcbiAgICB9XG59XG5cblxuZnVuY3Rpb24gY2hlY2tfaW5wdXQoaXRlbXMpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIklucHV0IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgfVxuICAgIC8vIHNvcnQgaXRlbXMgYmFzZWQgb24gaW50ZXJ2YWwgbG93IGVuZHBvaW50XG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBsZXQgYV9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGEuaW50ZXJ2YWwpWzBdO1xuICAgICAgICBsZXQgYl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGIuaW50ZXJ2YWwpWzBdO1xuICAgICAgICByZXR1cm4gZW5kcG9pbnQuY21wKGFfbG93LCBiX2xvdyk7XG4gICAgfSk7XG4gICAgLy8gY2hlY2sgdGhhdCBpdGVtIGludGVydmFscyBhcmUgbm9uLW92ZXJsYXBwaW5nXG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBsZXQgcHJldl9oaWdoID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpIC0gMV0uaW50ZXJ2YWwpWzFdO1xuICAgICAgICBsZXQgY3Vycl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2ldLmludGVydmFsKVswXTtcbiAgICAgICAgLy8gdmVyaWZ5IHRoYXQgcHJldiBoaWdoIGlzIGxlc3MgdGhhdCBjdXJyIGxvd1xuICAgICAgICBpZiAoIWVuZHBvaW50Lmx0KHByZXZfaGlnaCwgY3Vycl9sb3cpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPdmVybGFwcGluZyBpbnRlcnZhbHMgZm91bmRcIik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG4iLCJpbXBvcnQge2ludGVydmFsLCBlbmRwb2ludH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQge2NhbGxiYWNrfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5cbi8qKlxuICogXG4gKiBOZWFyYnkgSW5kZXggU2ltcGxlXG4gKiBcbiAqIC0gaXRlbXMgYXJlIGFzc3VtZWQgdG8gYmUgbm9uLW92ZXJsYXBwaW5nIG9uIHRoZSB0aW1lbGluZSwgXG4gKiAtIGltcGx5aW5nIHRoYXQgbmVhcmJ5LmNlbnRlciB3aWxsIGJlIGEgbGlzdCBvZiBhdCBtb3N0IG9uZSBJVEVNLiBcbiAqIC0gZXhjZXB0aW9uIHdpbGwgYmUgcmFpc2VkIGlmIG92ZXJsYXBwaW5nIElURU1TIGFyZSBmb3VuZFxuICogLSBJVEVNUyBpcyBhc3N1bWJlZCB0byBiZSBpbW11dGFibGUgYXJyYXkgLSBjaGFuZ2UgSVRFTVMgYnkgcmVwbGFjaW5nIGFycmF5XG4gKiBcbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgYXJvdW5kIG9mZnNldC4gXG4gKiBcbiAqIFJldHVybnMge1xuICogICAgICBsZWZ0IC0gaGlnaCBpbnRlcnZhbCBlbmRwb2ludCBvZiB0aGUgZmlyc3QgSVRFTSB0byB0aGUgbGVmdCB3aGljaCBkb2VzIG5vdCBjb3ZlciBvZmZzZXQsIGVsc2UgdW5kZWZpbmVkXG4gKiAgICAgIGNlbnRlciAtIGxpc3Qgb2YgSVRFTVMgY292ZXJpbmcgb2Zmc2V0LCBlbHNlIFtdXG4gKiAgICAgIHJpZ2h0IC0gbG93IGludGVydmFsIGVuZHBvaW50IG9mIHRoZSBmaXJzdCBJVEVNIHRvIHRoZSByaWdodCB3aGljaCBkb2VzIG5vdCBjb3ZlciBvZmZzZXQsIGVsc2UgdW5kZWZpbmVkXG4gKiB9XG4gKiBcbiAqL1xuXG5cbi8vIGdldCBpbnRlcnZhbCBsb3cgcG9pbnRcbmZ1bmN0aW9uIGdldF9sb3dfdmFsdWUoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLmludGVydmFsWzBdO1xufVxuXG4vLyBnZXQgaW50ZXJ2YWwgbG93IGVuZHBvaW50XG5mdW5jdGlvbiBnZXRfbG93X2VuZHBvaW50KGl0ZW0pIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLmludGVydmFsKVswXVxufVxuXG4vLyBnZXQgaW50ZXJ2YWwgaGlnaCBlbmRwb2ludFxuZnVuY3Rpb24gZ2V0X2hpZ2hfZW5kcG9pbnQoaXRlbSkge1xuICAgIHJldHVybiBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW0uaW50ZXJ2YWwpWzFdXG59XG5cblxuZXhwb3J0IGNsYXNzIFNpbXBsZU5lYXJieUluZGV4IHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBbXTtcbiAgICAgICAgbGV0IHtpdGVtc30gPSBvcHRpb25zO1xuICAgICAgICBpZiAoaXRlbXMpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlKGl0ZW1zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZSAoaXRlbXMpIHtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBjaGVja19pbnB1dChpdGVtcylcbiAgICB9XG5cblxuICAgIC8qXG4gICAgICAgIG5lYXJieSBieSBvZmZzZXRcbiAgICAgICAgXG4gICAgICAgIHJldHVybnMge2xlZnQsIGNlbnRlciwgcmlnaHR9XG5cbiAgICAgICAgYmluYXJ5IHNlYXJjaCBiYXNlZCBvbiBvZmZzZXRcbiAgICAgICAgMSkgZm91bmQsIGlkeFxuICAgICAgICAgICAgb2Zmc2V0IG1hdGNoZXMgdmFsdWUgb2YgaW50ZXJ2YWwubG93IG9mIGFuIGl0ZW1cbiAgICAgICAgICAgIGlkeCBnaXZlcyB0aGUgaW5kZXggb2YgdGhpcyBpdGVtIGluIHRoZSBhcnJheVxuICAgICAgICAyKSBub3QgZm91bmQsIGlkeFxuICAgICAgICAgICAgb2Zmc2V0IGlzIGVpdGhlciBjb3ZlcmVkIGJ5IGl0ZW0gYXQgKGlkeC0xKSxcbiAgICAgICAgICAgIG9yIGl0IGlzIG5vdCA9PiBiZXR3ZWVuIGVudHJpZXNcbiAgICAgICAgICAgIGluIHRoaXMgY2FzZSAtIGlkeCBnaXZlcyB0aGUgaW5kZXggd2hlcmUgYW4gaXRlbVxuICAgICAgICAgICAgc2hvdWxkIGJlIGluc2VydGVkIC0gaWYgaXQgaGFkIGxvdyA9PSBvZmZzZXRcbiAgICAqL1xuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvZmZzZXQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBbb2Zmc2V0LCAwXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkob2Zmc2V0KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW5kcG9pbnQgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgICAgICBjZW50ZXI6IFtdLFxuICAgICAgICAgICAgaW50ZXJ2YWw6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIGxlZnQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHJpZ2h0OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBwcmV2OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBuZXh0OiB1bmRlZmluZWRcbiAgICAgICAgfTtcbiAgICAgICAgbGV0IGl0ZW1zID0gdGhpcy5faXRlbXM7XG4gICAgICAgIGxldCBpbmRleGVzLCBpdGVtO1xuICAgICAgICBjb25zdCBzaXplID0gaXRlbXMubGVuZ3RoO1xuICAgICAgICBpZiAoc2l6ZSA9PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0OyBcbiAgICAgICAgfVxuICAgICAgICBsZXQgW2ZvdW5kLCBpZHhdID0gZmluZF9pbmRleChvZmZzZXRbMF0sIGl0ZW1zLCBnZXRfbG93X3ZhbHVlKTtcbiAgICAgICAgaWYgKGZvdW5kKSB7XG4gICAgICAgICAgICAvLyBzZWFyY2ggb2Zmc2V0IG1hdGNoZXMgaXRlbSBsb3cgZXhhY3RseVxuICAgICAgICAgICAgLy8gY2hlY2sgdGhhdCBpdCBpbmRlZWQgY292ZXJlZCBieSBpdGVtIGludGVydmFsXG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4XVxuICAgICAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19lbmRwb2ludChpdGVtLmludGVydmFsLCBvZmZzZXQpKSB7XG4gICAgICAgICAgICAgICAgaW5kZXhlcyA9IHtsZWZ0OmlkeC0xLCBjZW50ZXI6aWR4LCByaWdodDppZHgrMX07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGluZGV4ZXMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBjaGVjayBwcmV2IGl0ZW1cbiAgICAgICAgICAgIGl0ZW0gPSBpdGVtc1tpZHgtMV07XG4gICAgICAgICAgICBpZiAoaXRlbSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiBzZWFyY2ggb2Zmc2V0IGlzIGNvdmVyZWQgYnkgaXRlbSBpbnRlcnZhbFxuICAgICAgICAgICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfZW5kcG9pbnQoaXRlbS5pbnRlcnZhbCwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTIsIGNlbnRlcjppZHgtMSwgcmlnaHQ6aWR4fTtcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgfVxuICAgICAgICB9XHRcbiAgICAgICAgaWYgKGluZGV4ZXMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBwcmV2IGl0ZW0gZWl0aGVyIGRvZXMgbm90IGV4aXN0IG9yIGlzIG5vdCByZWxldmFudFxuICAgICAgICAgICAgaW5kZXhlcyA9IHtsZWZ0OmlkeC0xLCBjZW50ZXI6LTEsIHJpZ2h0OmlkeH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjZW50ZXJcbiAgICAgICAgaWYgKDAgPD0gaW5kZXhlcy5jZW50ZXIgJiYgaW5kZXhlcy5jZW50ZXIgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQuY2VudGVyID0gIFtpdGVtc1tpbmRleGVzLmNlbnRlcl1dO1xuICAgICAgICB9XG4gICAgICAgIC8vIHByZXYvbmV4dFxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLmxlZnQgJiYgaW5kZXhlcy5sZWZ0IDwgc2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0LnByZXYgPSAgZ2V0X2hpZ2hfZW5kcG9pbnQoaXRlbXNbaW5kZXhlcy5sZWZ0XSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKDAgPD0gaW5kZXhlcy5yaWdodCAmJiBpbmRleGVzLnJpZ2h0IDwgc2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0Lm5leHQgPSAgZ2V0X2xvd19lbmRwb2ludChpdGVtc1tpbmRleGVzLnJpZ2h0XSk7XG4gICAgICAgIH0gICAgICAgIFxuICAgICAgICAvLyBsZWZ0L3JpZ2h0XG4gICAgICAgIGxldCBsb3csIGhpZ2g7XG4gICAgICAgIGlmIChyZXN1bHQuY2VudGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxldCBpdHYgPSByZXN1bHQuY2VudGVyWzBdLmludGVydmFsO1xuICAgICAgICAgICAgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0dik7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IChsb3dbMF0gPiAtSW5maW5pdHkpID8gZW5kcG9pbnQuZmxpcChsb3csIFwiaGlnaFwiKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IChoaWdoWzBdIDwgSW5maW5pdHkpID8gZW5kcG9pbnQuZmxpcChoaWdoLCBcImxvd1wiKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VsdC5pbnRlcnZhbCA9IHJlc3VsdC5jZW50ZXJbMF0uaW50ZXJ2YWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IHJlc3VsdC5wcmV2O1xuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gcmVzdWx0Lm5leHQ7XG4gICAgICAgICAgICAvLyBpbnRlcnZhbFxuICAgICAgICAgICAgbGV0IGxlZnQgPSByZXN1bHQubGVmdDtcbiAgICAgICAgICAgIGxvdyA9IChsZWZ0ID09IHVuZGVmaW5lZCkgPyBbLUluZmluaXR5LCAwXSA6IGVuZHBvaW50LmZsaXAobGVmdCwgXCJsb3dcIik7XG4gICAgICAgICAgICBsZXQgcmlnaHQgPSByZXN1bHQucmlnaHQ7XG4gICAgICAgICAgICBoaWdoID0gKHJpZ2h0ID09IHVuZGVmaW5lZCkgPyBbSW5maW5pdHksIDBdIDogZW5kcG9pbnQuZmxpcChyaWdodCwgXCJoaWdoXCIpO1xuICAgICAgICAgICAgcmVzdWx0LmludGVydmFsID0gaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKFNpbXBsZU5lYXJieUluZGV4LnByb3RvdHlwZSk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblx0VVRJTFNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuXG4vLyBjaGVjayBpbnB1dFxuZnVuY3Rpb24gY2hlY2tfaW5wdXQoaXRlbXMpIHtcblxuICAgIGlmIChpdGVtcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaXRlbXMgPSBbXTtcbiAgICB9XG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIklucHV0IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgfVxuXG4gICAgLy8gc29ydCBpdGVtcyBiYXNlZCBvbiBpbnRlcnZhbCBsb3cgZW5kcG9pbnRcbiAgICBpdGVtcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGxldCBhX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYS5pbnRlcnZhbClbMF07XG4gICAgICAgIGxldCBiX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYi5pbnRlcnZhbClbMF07XG4gICAgICAgIHJldHVybiBlbmRwb2ludC5jbXAoYV9sb3csIGJfbG93KTtcbiAgICB9KTtcblxuICAgIC8vIGNoZWNrIHRoYXQgaXRlbSBpbnRlcnZhbHMgYXJlIG5vbi1vdmVybGFwcGluZ1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IHByZXZfaGlnaCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaSAtIDFdLmludGVydmFsKVsxXTtcbiAgICAgICAgbGV0IGN1cnJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpXS5pbnRlcnZhbClbMF07XG4gICAgICAgIC8vIHZlcmlmeSB0aGF0IHByZXYgaGlnaCBpcyBsZXNzIHRoYXQgY3VyciBsb3dcbiAgICAgICAgaWYgKCFlbmRwb2ludC5sdChwcmV2X2hpZ2gsIGN1cnJfbG93KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT3ZlcmxhcHBpbmcgaW50ZXJ2YWxzIGZvdW5kXCIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuXG4vKlxuXHRiaW5hcnkgc2VhcmNoIGZvciBmaW5kaW5nIHRoZSBjb3JyZWN0IGluc2VydGlvbiBpbmRleCBpbnRvXG5cdHRoZSBzb3J0ZWQgYXJyYXkgKGFzY2VuZGluZykgb2YgaXRlbXNcblx0XG5cdGFycmF5IGNvbnRhaW5zIG9iamVjdHMsIGFuZCB2YWx1ZSBmdW5jIHJldHJlYXZlcyBhIHZhbHVlXG5cdGZyb20gZWFjaCBvYmplY3QuXG5cblx0cmV0dXJuIFtmb3VuZCwgaW5kZXhdXG4qL1xuXG5mdW5jdGlvbiBmaW5kX2luZGV4KHRhcmdldCwgYXJyLCB2YWx1ZV9mdW5jKSB7XG5cbiAgICBmdW5jdGlvbiBkZWZhdWx0X3ZhbHVlX2Z1bmMoZWwpIHtcbiAgICAgICAgcmV0dXJuIGVsO1xuICAgIH1cbiAgICBcbiAgICBsZXQgbGVmdCA9IDA7XG5cdGxldCByaWdodCA9IGFyci5sZW5ndGggLSAxO1xuXHR2YWx1ZV9mdW5jID0gdmFsdWVfZnVuYyB8fCBkZWZhdWx0X3ZhbHVlX2Z1bmM7XG5cdHdoaWxlIChsZWZ0IDw9IHJpZ2h0KSB7XG5cdFx0Y29uc3QgbWlkID0gTWF0aC5mbG9vcigobGVmdCArIHJpZ2h0KSAvIDIpO1xuXHRcdGxldCBtaWRfdmFsdWUgPSB2YWx1ZV9mdW5jKGFyclttaWRdKTtcblx0XHRpZiAobWlkX3ZhbHVlID09PSB0YXJnZXQpIHtcblx0XHRcdHJldHVybiBbdHJ1ZSwgbWlkXTsgLy8gVGFyZ2V0IGFscmVhZHkgZXhpc3RzIGluIHRoZSBhcnJheVxuXHRcdH0gZWxzZSBpZiAobWlkX3ZhbHVlIDwgdGFyZ2V0KSB7XG5cdFx0XHQgIGxlZnQgPSBtaWQgKyAxOyAvLyBNb3ZlIHNlYXJjaCByYW5nZSB0byB0aGUgcmlnaHRcblx0XHR9IGVsc2Uge1xuXHRcdFx0ICByaWdodCA9IG1pZCAtIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSBsZWZ0XG5cdFx0fVxuXHR9XG4gIFx0cmV0dXJuIFtmYWxzZSwgbGVmdF07IC8vIFJldHVybiB0aGUgaW5kZXggd2hlcmUgdGFyZ2V0IHNob3VsZCBiZSBpbnNlcnRlZFxufVxuIiwiaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCAqIGFzIHNlZ21lbnQgZnJvbSBcIi4vc2VnbWVudHMuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE5FQVJCWSBDQUNIRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIFRoaXMgaW1wbGVtZW50cyBhIGNhY2hlIGluIGZyb250IG9mIGEgTmVhcmJ5SW5kZXguXG4gICAgXG4gICAgVGhlIHB1cnBvc2Ugb2YgY2FjaGluZyBpcyB0byBvcHRpbWl6ZSBmb3IgcmVwZWF0ZWRcbiAgICBxdWVyaWVzIHRvIGEgTmVhcmJ5SW5kZXggdG8gbmVhcmJ5IG9mZnNldHMuXG5cbiAgICBUaGUgY2FjaGUgc3RhdGUgaW5jbHVkZXMgdGhlIG5lYXJieSBzdGF0ZSBmcm9tIHRoZSBcbiAgICBpbmRleCwgYW5kIGFsc28gdGhlIGNhY2hlZCBzZWdtZW50cyBjb3JyZXNwb25kaW5nXG4gICAgdG8gdGhhdCBzdGF0ZS4gVGhpcyB3YXksIG9uIGEgY2FjaGUgaGl0LCB0aGUgXG4gICAgcXVlcnkgbWF5IGJlIHNhdGlzZmllZCBkaXJlY3RseSBmcm9tIHRoZSBjYWNoZS5cblxuICAgIFRoZSBjYWNoZSBpcyBtYXJrZWQgYXMgZGlydHkgd2hlbiB0aGUgTmVhcmJ5IGluZGV4ZXMgY2hhbmdlcy5cbiovXG5cbmV4cG9ydCBjbGFzcyBOZWFyYnlDYWNoZSB7XG5cbiAgICBjb25zdHJ1Y3RvciAobmVhcmJ5SW5kZXgpIHtcbiAgICAgICAgLy8gbmVhcmJ5IGluZGV4XG4gICAgICAgIHRoaXMuX2luZGV4ID0gbmVhcmJ5SW5kZXg7XG4gICAgICAgIC8vIGNhY2hlZCBuZWFyYnkgb2JqZWN0XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2FjaGVkIHNlZ21lbnRcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gZGlydHkgZmxhZ1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBBY2Nlc3NvcnMgZm9yIENhY2hlIHN0YXRlXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIFxuICAgIGdldCBuZWFyYnkgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbmVhcmJ5O1xuICAgIH1cblxuICAgIGxvYWRfc2VnbWVudCAoKSB7XG4gICAgICAgIC8vIGxhenkgbG9hZCBzZWdtZW50XG4gICAgICAgIGlmICh0aGlzLl9uZWFyYnkgJiYgIXRoaXMuX3NlZ21lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3NlZ21lbnQgPSBsb2FkX3NlZ21lbnQodGhpcy5fbmVhcmJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fc2VnbWVudFxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBEaXJ0eSBDYWNoZVxuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGRpcnR5KCkge1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIFJlZnJlc2ggQ2FjaGVcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICAvKlxuICAgICAgICByZWZyZXNoIGlmIG5lY2Vzc2FyeSAtIGVsc2UgTk9PUFxuICAgICAgICAtIGlmIG5lYXJieSBpcyBub3QgZGVmaW5lZFxuICAgICAgICAtIGlmIG9mZnNldCBpcyBvdXRzaWRlIG5lYXJieS5pbnRlcnZhbFxuICAgICAgICAtIGlmIGNhY2hlIGlzIGRpcnR5XG4gICAgKi9cbiAgICByZWZyZXNoIChvZmZzZXQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvZmZzZXQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBbb2Zmc2V0LCAwXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fbmVhcmJ5ID09IHVuZGVmaW5lZCB8fCB0aGlzLl9kaXJ0eSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlZnJlc2gob2Zmc2V0KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWludGVydmFsLmNvdmVyc19lbmRwb2ludCh0aGlzLl9uZWFyYnkuaW50ZXJ2YWwsIG9mZnNldCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWZyZXNoKG9mZnNldClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX3JlZnJlc2ggKG9mZnNldCkge1xuICAgICAgICB0aGlzLl9uZWFyYnkgPSB0aGlzLl9pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIFF1ZXJ5IENhY2hlXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChvZmZzZXQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjYWNoZSBxdWVyeSBvZmZzZXQgY2Fubm90IGJlIHVuZGVmaW5lZFwiKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVmcmVzaChvZmZzZXQpO1xuICAgICAgICBpZiAoIXRoaXMuX3NlZ21lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3NlZ21lbnQgPSBsb2FkX3NlZ21lbnQodGhpcy5fbmVhcmJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fc2VnbWVudC5xdWVyeShvZmZzZXQpO1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0FEIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gY3JlYXRlX3NlZ21lbnQoaW50ZXJ2YWwsIHR5cGUsIGFyZ3MpIHtcbiAgICBpZiAodHlwZSA9PSBcInN0YXRpY1wiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5TdGF0aWNTZWdtZW50KGludGVydmFsLCBhcmdzKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJ0cmFuc2l0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LlRyYW5zaXRpb25TZWdtZW50KGludGVydmFsLCBhcmdzKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJpbnRlcnBvbGF0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LkludGVycG9sYXRpb25TZWdtZW50KGludGVydmFsLCBhcmdzKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJtb3Rpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuTW90aW9uU2VnbWVudChpbnRlcnZhbCwgYXJncyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJ1bnJlY29nbml6ZWQgc2VnbWVudCB0eXBlXCIsIHR5cGUpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gbG9hZF9zZWdtZW50KG5lYXJieSkge1xuICAgIGxldCB7aW50ZXJ2YWw6aXR2LCBjZW50ZXJ9ID0gbmVhcmJ5O1xuICAgIGlmIChjZW50ZXIubGVuZ3RoID09IDApIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZV9zZWdtZW50KGl0diwgXCJzdGF0aWNcIiwge3ZhbHVlOnVuZGVmaW5lZH0pO1xuICAgIH1cbiAgICBpZiAoY2VudGVyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGxldCB7dHlwZT1cInN0YXRpY1wiLCBhcmdzfSA9IGNlbnRlclswXTtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZV9zZWdtZW50KGl0diwgdHlwZSwgYXJncyk7XG4gICAgfVxuICAgIGlmIChjZW50ZXIubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJMaXN0U2VnbWVudHMgbm90IHlldCBzdXBwb3J0ZWRcIik7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgU2ltcGxlTmVhcmJ5SW5kZXggfSBmcm9tIFwiLi9uZWFyYnlpbmRleF9zaW1wbGVcIjtcbmltcG9ydCB7IE5lYXJieUNhY2hlIH0gZnJvbSBcIi4vbmVhcmJ5Y2FjaGVcIjtcblxuZXhwb3J0IGNvbnN0IG5lYXJieSA9IGZ1bmN0aW9uICgpIHtcblxuICAgIGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2Uob2JqZWN0KSB7XG4gICAgICAgIGxldCBpbmRleCA9IG5ldyBTaW1wbGVOZWFyYnlJbmRleCgpO1xuICAgICAgICBvYmplY3QuX19uZWFyYnlfaW5kZXggPSBpbmRleDtcbiAgICAgICAgb2JqZWN0Ll9fbmVhcmJ5X2NhY2hlID0gbmV3IE5lYXJieUNhY2hlKGluZGV4KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB1cGRhdGUoaXRlbXMpIHtcbiAgICAgICAgdGhpcy5fX25lYXJieV9pbmRleC51cGRhdGUoaXRlbXMpO1xuICAgICAgICB0aGlzLl9fbmVhcmJ5X2NhY2hlLmRpcnR5KCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcXVlcnkgKG9mZnNldCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fX25lYXJieV9jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlKF9wcm90b3R5cGUpIHtcbiAgICAgICAgY29uc3QgYXBpID0ge307XG4gICAgICAgIGFwaVsnX19uZWFyYnlfdXBkYXRlJ10gPSB1cGRhdGU7XG4gICAgICAgIGFwaVsnX19uZWFyYnlfcXVlcnknXSA9IHF1ZXJ5O1xuICAgICAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHthZGRUb0luc3RhbmNlLCBhZGRUb1Byb3RvdHlwZX1cbn0oKTtcbiIsIlxuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UsIEN1cnNvckJhc2UgfSBmcm9tIFwiLi9iYXNlc1wiO1xuY29uc3QgTUVUSE9EUyA9IHthc3NpZ24sIG1vdmUsIHRyYW5zaXRpb24sIGludGVycG9sYXRlfTtcblxuXG5leHBvcnQgZnVuY3Rpb24gY21kICh0YXJnZXQpIHtcbiAgICBpZiAoISh0YXJnZXQgaW5zdGFuY2VvZiBDdXJzb3JCYXNlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhcmdldCBtdXN0IGJlIGN1cnNvciAke3RhcmdldH1gKTtcbiAgICB9XG4gICAgaWYgKCEodGFyZ2V0LnNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhcmdldC5zcmMgbXVzdCBiZSBzdGF0ZXByb3ZpZGVyICR7dGFyZ2V0fWApO1xuICAgIH1cbiAgICBsZXQgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKE1FVEhPRFMpXG4gICAgICAgIC5tYXAoKFtuYW1lLCBtZXRob2RdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oLi4uYXJncykgeyBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGl0ZW1zID0gbWV0aG9kLmNhbGwodGhpcywgdGFyZ2V0LCAuLi5hcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldC5zcmMudXBkYXRlKGl0ZW1zKTsgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhlbnRyaWVzKTtcbn1cblxuZnVuY3Rpb24gYXNzaWduKHRhcmdldCwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgaXRlbSA9IHtcbiAgICAgICAgICAgIGludGVydmFsOiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgYXJnczoge3ZhbHVlfSAgICAgICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtpdGVtXTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG1vdmUodGFyZ2V0LCB2ZWN0b3I9e30pIHtcbiAgICBsZXQge3ZhbHVlLCByYXRlLCBvZmZzZXR9ID0gdGFyZ2V0LnF1ZXJ5KCk7XG4gICAgbGV0IHtwb3NpdGlvbj12YWx1ZSwgdmVsb2NpdHk9cmF0ZX0gPSB2ZWN0b3I7XG4gICAgbGV0IGl0ZW0gPSB7XG4gICAgICAgIGludGVydmFsOiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgIHR5cGU6IFwibW90aW9uXCIsXG4gICAgICAgIGFyZ3M6IHtwb3NpdGlvbiwgdmVsb2NpdHksIHRpbWVzdGFtcDpvZmZzZXR9ICAgICAgICAgICAgICAgICBcbiAgICB9XG4gICAgcmV0dXJuIFtpdGVtXTtcbn1cblxuZnVuY3Rpb24gdHJhbnNpdGlvbih0YXJnZXQsIHYwLCB2MSwgdDAsIHQxLCBlYXNpbmcpIHtcbiAgICBsZXQgaXRlbXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGludGVydmFsOiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTp2MH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaW50ZXJ2YWw6IFt0MCwgdDEsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwidHJhbnNpdGlvblwiLFxuICAgICAgICAgICAgYXJnczoge3YwLCB2MSwgdDAsIHQxLCBlYXNpbmd9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGludGVydmFsOiBbdDEsIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBhcmdzOiB7dmFsdWU6IHYxfVxuICAgICAgICB9XG4gICAgXVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUodGFyZ2V0LCB0dXBsZXMpIHtcbiAgICBsZXQgW3YwLCB0MF0gPSB0dXBsZXNbMF07XG4gICAgbGV0IFt2MSwgdDFdID0gdHVwbGVzW3R1cGxlcy5sZW5ndGgtMV07XG5cbiAgICBsZXQgaXRlbXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGludGVydmFsOiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTp2MH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaW50ZXJ2YWw6IFt0MCwgdDEsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwiaW50ZXJwb2xhdGlvblwiLFxuICAgICAgICAgICAgYXJnczoge3R1cGxlc31cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaW50ZXJ2YWw6IFt0MSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTogdjF9XG4gICAgICAgIH1cbiAgICBdICAgIFxuICAgIHJldHVybiBpdGVtcztcbn1cblxuXG5cbiIsIlxuXG5pbXBvcnQgeyBTdGF0ZVByb3ZpZGVyQmFzZSwgQ3Vyc29yQmFzZSB9IGZyb20gXCIuL2Jhc2VzLmpzXCI7XG5pbXBvcnQgeyBzb3VyY2UgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5pbXBvcnQgeyBTaW1wbGVTdGF0ZVByb3ZpZGVyIH0gZnJvbSBcIi4vc3RhdGVwcm92aWRlcl9zaW1wbGUuanNcIjtcbmltcG9ydCB7IG5lYXJieSB9IGZyb20gXCIuL2NvbW1vbi5qc1wiO1xuaW1wb3J0IHsgY21kIH0gZnJvbSBcIi4vY21kLmpzXCI7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ0xPQ0sgQ1VSU09SU1xuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLy8gQ0xPQ0sgKGNvdW50aW5nIHNlY29uZHMgc2luY2UgcGFnZSBsb2FkKVxuY2xhc3MgTG9jYWxDbG9jayBleHRlbmRzIEN1cnNvckJhc2Uge1xuICAgIHF1ZXJ5ICgpIHtcbiAgICAgICAgbGV0IG9mZnNldCA9IHBlcmZvcm1hbmNlLm5vdygpLzEwMDAuMDtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTpvZmZzZXQsIGR5bmFtaWM6dHJ1ZSwgb2Zmc2V0fTtcbiAgICB9XG59XG5cbi8vIENMT0NLIChjb3VudGluZyBzZWNvbmRzIHNpbmNlIGVwb2NoICgxOTcwKVxuY2xhc3MgTG9jYWxFcG9jaCBleHRlbmRzIEN1cnNvckJhc2Uge1xuICAgIHF1ZXJ5ICgpIHtcbiAgICAgICAgbGV0IG9mZnNldCA9IChEYXRlLm5vdygpIC8gMTAwMC4wKVxuICAgICAgICByZXR1cm4ge3ZhbHVlOm9mZnNldCwgZHluYW1pYzp0cnVlLCBvZmZzZXR9O1xuICAgIH1cbn1cblxuZXhwb3J0IGNvbnN0IGxvY2FsX2Nsb2NrID0gbmV3IExvY2FsQ2xvY2soKTtcbmV4cG9ydCBjb25zdCBsb2NhbF9lcG9jaCA9IG5ldyBMb2NhbEVwb2NoKClcblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBcbiAqIEN1cnNvciBpcyBhIHZhcmlhYmxlXG4gKiAtIGhhcyBtdXRhYmxlIGN0cmwgY3Vyc29yIChkZWZhdWx0IGxvY2FsIGNsb2NrKVxuICogLSBoYXMgbXV0YWJsZSBzdGF0ZSBwcm92aWRlciAoc3JjKSAoZGVmYXVsdCBzdGF0ZSB1bmRlZmluZWQpXG4gKiAtIG1ldGhvZHMgZm9yIGFzc2lnbiwgbW92ZSwgdHJhbnNpdGlvbiwgaW50ZXBvbGF0aW9uXG4gKiBcbiAqL1xuXG5leHBvcnQgY2xhc3MgQ3Vyc29yIGV4dGVuZHMgQ3Vyc29yQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvLyBjdHJsXG4gICAgICAgIHNvdXJjZS5hZGRUb0luc3RhbmNlKHRoaXMsIFwiY3RybFwiKTtcbiAgICAgICAgLy8gc3JjXG4gICAgICAgIHNvdXJjZS5hZGRUb0luc3RhbmNlKHRoaXMsIFwic3JjXCIpO1xuICAgICAgICAvLyBuZWFyYnlcbiAgICAgICAgbmVhcmJ5LmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIC8vIGluaXRpYWxzZSBjbG9ja1xuXG4gICAgICAgIC8vIGluaXRpYWxpc2UgY3RybFxuICAgICAgICBsZXQge2N0cmx9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKGN0cmwgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjdHJsID0gbG9jYWxfY2xvY2s7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jdHJsID0gY3RybDtcblxuICAgICAgICAvLyBpbml0aWFsaXNlIHN0YXRlXG4gICAgICAgIGxldCB7c3JjfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzcmMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzcmMgPSBuZXcgU2ltcGxlU3RhdGVQcm92aWRlcigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3JjID0gc3JjXG4gICAgfVxuXG4gICAgLy8gY2hlY2sgY3RybFxuICAgIF9fY3RybF9jaGVjayhjdHJsKSB7XG4gICAgICAgIGlmICghKGN0cmwgaW5zdGFuY2VvZiBDdXJzb3JCYXNlKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcImN0cmxcIiBtdXN0IGJlIGN1cnNvciAke2N0cmx9YClcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBjaGVjayBzcmNcbiAgICBfX3NyY19jaGVjayhzcmMpIHtcbiAgICAgICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgU3RhdGVQcm92aWRlckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwic3JjXCIgbXVzdCBiZSBzdGF0ZSBwcm92aWRlciAke3NvdXJjZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGN0cmwgb3Igc3JjIGNoYW5nZXNcbiAgICBfX2N0cmxfb25jaGFuZ2UoKSB7XG4gICAgICAgIHRoaXMuX19vbmNoYW5nZSgpO1xuICAgIH1cbiAgICBfX3NyY19vbmNoYW5nZSgpIHtcbiAgICAgICAgdGhpcy5fX29uY2hhbmdlKCk7XG4gICAgfVxuICAgIF9fb25jaGFuZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLnNyYyAmJiB0aGlzLmN0cmwpIHtcbiAgICAgICAgICAgIGxldCBpdGVtcyA9IHRoaXMuc3JjLml0ZW1zO1xuICAgICAgICAgICAgdGhpcy5fX25lYXJieV91cGRhdGUoaXRlbXMpO1xuICAgICAgICAgICAgLy8gdHJpZ2dlciBjaGFuZ2UgZXZlbnQgZm9yIGN1cnNvclxuICAgICAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdGhpcy5xdWVyeSgpKTsgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFFVRVJZXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgcXVlcnkgKCkge1xuICAgICAgICBsZXQge3ZhbHVlOm9mZnNldH0gPSB0aGlzLmN0cmwucXVlcnkoKVxuICAgICAgICBpZiAodHlwZW9mIG9mZnNldCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3RybCBzdGF0ZSBtdXN0IGJlIG51bWJlciAke29mZnNldH1gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fX25lYXJieV9jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogQ09OVkVOSUVOQ0VcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGdldCB2YWx1ZSAoKSB7cmV0dXJuIHRoaXMucXVlcnkoKS52YWx1ZX07XG5cbiAgICBhc3NpZ24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzKS5hc3NpZ24odmFsdWUpO1xuICAgIH1cbiAgICBtb3ZlICh7cG9zaXRpb24sIHZlbG9jaXR5fSkge1xuICAgICAgICBsZXQge3ZhbHVlLCByYXRlLCBvZmZzZXQ6dGltZXN0YW1wfSA9IHRoaXMucXVlcnkoKTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3Vyc29yIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7dmFsdWV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcG9zaXRpb24gPSAocG9zaXRpb24gIT0gdW5kZWZpbmVkKSA/IHBvc2l0aW9uIDogdmFsdWU7XG4gICAgICAgIHZlbG9jaXR5ID0gKHZlbG9jaXR5ICE9IHVuZGVmaW5lZCkgPyB2ZWxvY2l0eTogcmF0ZTtcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzKS5tb3ZlKHtwb3NpdGlvbiwgdmVsb2NpdHksIHRpbWVzdGFtcH0pO1xuICAgIH1cbiAgICB0cmFuc2l0aW9uICh7dGFyZ2V0LCBkdXJhdGlvbiwgZWFzaW5nfSkge1xuICAgICAgICBsZXQge3ZhbHVlOnYwLCBvZmZzZXQ6dDB9ID0gdGhpcy5xdWVyeSgpO1xuICAgICAgICBpZiAodHlwZW9mIHYwICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3Igc3RhdGUgbXVzdCBiZSBudW1iZXIgJHt2MH1gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY21kKHRoaXMpLnRyYW5zaXRpb24odjAsIHRhcmdldCwgdDAsIHQwICsgZHVyYXRpb24sIGVhc2luZyk7XG4gICAgfVxuICAgIGludGVycG9sYXRlICh7dHVwbGVzLCBkdXJhdGlvbn0pIHtcbiAgICAgICAgbGV0IHQwID0gdGhpcy5xdWVyeSgpLm9mZnNldDtcbiAgICAgICAgLy8gYXNzdW1pbmcgdGltc3RhbXBzIGFyZSBpbiByYW5nZSBbMCwxXVxuICAgICAgICAvLyBzY2FsZSB0aW1lc3RhbXBzIHRvIGR1cmF0aW9uXG4gICAgICAgIHR1cGxlcyA9IHR1cGxlcy5tYXAoKFt2LHRdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3YsIHQwICsgdCpkdXJhdGlvbl07XG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiBjbWQodGhpcykuaW50ZXJwb2xhdGUodHVwbGVzKTtcbiAgICB9XG5cblxufVxuc291cmNlLmFkZFRvUHJvdG90eXBlKEN1cnNvci5wcm90b3R5cGUsIFwic3JjXCIsIHttdXRhYmxlOnRydWV9KTtcbnNvdXJjZS5hZGRUb1Byb3RvdHlwZShDdXJzb3IucHJvdG90eXBlLCBcImN0cmxcIiwge211dGFibGU6dHJ1ZX0pO1xubmVhcmJ5LmFkZFRvUHJvdG90eXBlKEN1cnNvci5wcm90b3R5cGUpO1xuIl0sIm5hbWVzIjpbImludGVycG9sYXRlIiwiY2hlY2tfaW5wdXQiLCJzZWdtZW50LlN0YXRpY1NlZ21lbnQiLCJzZWdtZW50LlRyYW5zaXRpb25TZWdtZW50Iiwic2VnbWVudC5JbnRlcnBvbGF0aW9uU2VnbWVudCIsInNlZ21lbnQuTW90aW9uU2VnbWVudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7SUFBQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNB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QyxDQUFDLFFBQVEsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQztJQUNsRCxZQUFZLElBQUksRUFBRSxRQUFRO0lBQzFCLFlBQVksSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLEVBQUU7SUFDM0IsU0FBUztJQUNULFFBQVE7SUFDUixZQUFZLFFBQVEsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQztJQUMzQyxZQUFZLElBQUksRUFBRSxZQUFZO0lBQzlCLFlBQVksSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLE1BQU07SUFDekMsU0FBUztJQUNULFFBQVE7SUFDUixZQUFZLFFBQVEsRUFBRSxDQUFDLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztJQUNoRCxZQUFZLElBQUksRUFBRSxRQUFRO0lBQzFCLFlBQVksSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUU7SUFDNUI7SUFDQTtJQUNBLElBQUksT0FBTyxLQUFLO0lBQ2hCOztJQUVBLFNBQVMsV0FBVyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUU7SUFDckMsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDNUIsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQzs7SUFFMUMsSUFBSSxJQUFJLEtBQUssR0FBRztJQUNoQixRQUFRO0lBQ1IsWUFBWSxRQUFRLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQztJQUNsRCxZQUFZLElBQUksRUFBRSxRQUFRO0lBQzFCLFlBQVksSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLEVBQUU7SUFDM0IsU0FBUztJQUNULFFBQVE7SUFDUixZQUFZLFFBQVEsRUFBRSxDQUFD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
