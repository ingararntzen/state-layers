
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
            } = args.vector;
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
                attatch: `__${propName}_attatch`
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


            // getter and setter
            Object.defineProperty(_prototype, propName, {
                get: function () {
                    return this[p.prop];
                },
                set: function (src) {
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
     * SOURCE BASE
     ************************************************/

    /**
     * Base class for entities which can be used as source
     * 
     * Implement the callback interface.
     */


    class SourceBase {
        constructor() {
            callback.addToInstance(this);
        }
    }
    callback.addToPrototype(SourceBase.prototype);



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

    class StateProviderBase extends SourceBase {

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

    /************************************************
     * CURSOR BASE
     ************************************************/

    class CursorBase extends SourceBase {

        constructor () {
            super();

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
    eventify.addToPrototype(CursorBase.prototype);

    /*********************************************************************
        NEARBY INDEX BASE
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
     *      center: list of ITEMS covering endpoint,
     *      interval: interval where nearby returns identical {center}
     *      left:
     *          first interval endpoint to the left 
     *          which will produce different {center}
     *          always a high-endpoint or undefined
     *      right:
     *          first interval endpoint to the right
     *          which will produce different {center}
     *          always a low-endpoint or undefined         
     *      prev:
     *          first interval endpoint to the left 
     *          which will produce different && non-empty {center}
     *          always a high-endpoint or undefined if no more intervals to the left
     *      next:
     *          first interval endpoint to the right
     *          which will produce different && non-empty {center}
     *          always a low-endpoint or undefined if no more intervals to the right
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

    class NearbyIndexBase {

        constructor() {
            callback.addToInstance(this);
        }

        update (items) {
            throw new Error("Not implemented");
        }

        /* 
            Nearby method
        */
        nearby(offset) {
            
        }
    }
    callback.addToPrototype(NearbyIndexBase.prototype);

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


    class SimpleNearbyIndex extends NearbyIndexBase {

        constructor(options={}) {
            super();
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
        let item;
        let {interval:itv, center} = nearby;
        if (center.length == 0) {
            return create_segment(itv, "static", {value:undefined});
        }
        if (center.length == 1) {
            item = center[0];
            return create_segment(itv, item.type, item.args);
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
    const local_epoch = new LocalEpoch();

    // TODO online clock

    /************************************************
     * MEDIA CLOCK
     ************************************************/

    class MediaClock extends CursorBase {

        constructor(options={}) {
            super();
            // src
            source.addToInstance(this, "src");
            // nearby
            nearby.addToInstance(this);
            // initialse clock
            let {src, clock=local_clock} = options;
            this._clock = clock;

            // initialise state
            if (src == undefined) {
                src = new SimpleStateProvider();
                src._update([{
                    interval: [-Infinity, Infinity, true, true],
                    type: "motion",
                    args: {vector: {
                        position: 0,
                        velocity: 0,
                        timestamp: clock.query().value
                    }}
                }]);
            }
            this.src = src;
        }

        get clock () {return this._clock;}

        __src_onchange() {
            console.log("OK");
            let items = this.src.items;
            this.__nearby_update(items);
        }

        /**********************************************************
         * QUERY
         **********************************************************/
        query () {
            let {value:offset} = this._clock.query();
            return this.__nearby_cache.query(offset);
        }
    }
    source.addToPrototype(MediaClock.prototype, "src", {mutable:false});
    nearby.addToPrototype(MediaClock.prototype);

    /**
     * 
     * CLOCK CURSORS
     * 
     * 
     * LocalClock - (performance now, epoch) - these are wallclocks
     * 
     * OnlineClock - set up with a fixed clock server (epoch)
     * 
     * MediaClock - set up with a clock (ctrl) (fixed),
     * and stateprovider (src) (switchable)
     * 
     * Cursor - both (ctrl) and (src) are switchable
     * 
     * 
     * CHALLENGES
     * 
     * Media Clock should not support ctrl switching
     * - restrict state to motions
     */

    const METHODS = {assign, move, transition, interpolate};


    function cmd (target) {
        let entries = Object.entries(METHODS)
            .map(([name, method]) => {
                return [
                    name,
                    function(...args) { 
                        let items = method.call(this, target, ...args);
                        return target.update(items);  
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
            args: {vector: {position, velocity, timestamp:offset}}                 
        };
        return [item];
    }

    function transition(target, v0, v1, t0, t1, easing) {
        let items = [
            {
                interval: [-Inifinity, t0, true, false],
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
        let items = [
            {
                interval: [-Inifinity, t0, true, false],
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

    exports.MediaClock = MediaClock;
    exports.cmd = cmd;
    exports.local_clock = local_clock;
    exports.local_epoch = local_epoch;
    exports.segments = segments;

    return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pbnRlcnZhbHMuanMiLCIuLi8uLi9zcmMvc2VnbWVudHMuanMiLCIuLi8uLi9zcmMvZXZlbnRpZnkuanMiLCIuLi8uLi9zcmMvdXRpbC5qcyIsIi4uLy4uL3NyYy9tb25pdG9yLmpzIiwiLi4vLi4vc3JjL2Jhc2VzLmpzIiwiLi4vLi4vc3JjL3N0YXRlcHJvdmlkZXJfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL25lYXJieWluZGV4X3NpbXBsZS5qcyIsIi4uLy4uL3NyYy9uZWFyYnljYWNoZS5qcyIsIi4uLy4uL3NyYy9jb21tb24uanMiLCIuLi8uLi9zcmMvY3Vyc29ycy5qcyIsIi4uLy4uL3NyYy9jbWQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gICAgKiBcbiAgICAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAgICAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICAgICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gICAgKiBcbiAgICAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICAgICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAgICAqIFxuICAgICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG5cbiovXG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuXG5cbiAgICBOT1RFIFxuICAgIC0gY21wKDRdLFs0ICkgPT0gMCAtIHNpbmNlIHRoZXNlIGFyZSB0aGUgc2FtZSB3aXRoIHJlc3BlY3QgdG8gc29ydGluZ1xuICAgIC0gYnV0IGlmIHlvdSB3YW50IHRvIHNlZSBpZiB0d28gaW50ZXJ2YWxzIGFyZSBvdmVybGFwcGluZyBpbiB0aGUgZW5kcG9pbnRzXG4gICAgY21wKGhpZ2hfYSwgbG93X2IpID4gMCB0aGlzIHdpbGwgbm90IGJlIGdvb2RcbiAgICBcbiovIFxuXG5mdW5jdGlvbiBlbmRwb2ludF9jbXAgKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIGxldCBkaWZmID0gdjEgLSB2MjtcbiAgICByZXR1cm4gKGRpZmYgIT0gMCkgPyBkaWZmIDogczEgLSBzMjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludCB0byB0aGUgb3RoZXIgc2lkZVxuICogXG4gKiB1c2VmdWwgZm9yIG1ha2luZyBiYWNrLXRvLWJhY2sgaW50ZXJ2YWxzIFxuICogXG4gKiBoaWdoKSA8LT4gW2xvd1xuICogaGlnaF0gPC0+IChsb3dcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKHAsIHRhcmdldCkge1xuICAgIGxldCBbdixzXSA9IHA7XG4gICAgaWYgKHRhcmdldCA9PSBcImxvd1wiKSB7XG4gICAgXHQvLyBhc3N1bWUgcG9pbnQgaXMgaGlnaDogc2lnbiBtdXN0IGJlIC0xIG9yIDBcbiAgICBcdGlmIChzID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBsb3dcIik7ICAgIFx0XHRcbiAgICBcdH1cbiAgICAgICAgcCA9IFt2LCBzKzFdO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09IFwiaGlnaFwiKSB7XG5cdFx0Ly8gYXNzdW1lIHBvaW50IGlzIGxvdzogc2lnbiBpcyAwIG9yIDFcbiAgICBcdGlmIChzIDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBoaWdoXCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcy0xXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0eXBlXCIsIHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBsZXQgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBsZXQgbG93X3AgPSAobG93Q2xvc2VkKSA/IFtsb3csIDBdIDogW2xvdywgMV07IFxuICAgIGxldCBoaWdoX3AgPSAoaGlnaENsb3NlZCkgPyBbaGlnaCwgMF0gOiBbaGlnaCwgLTFdO1xuICAgIHJldHVybiBbbG93X3AsIGhpZ2hfcF07XG59XG5cblxuLypcbiAgICBJTlRFUlZBTFNcblxuICAgIEludGVydmFscyBhcmUgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXVxuXG4qLyBcblxuLypcbiAgICByZXR1cm4gdHJ1ZSBpZiBwb2ludCBwIGlzIGNvdmVyZWQgYnkgaW50ZXJ2YWwgaXR2XG4gICAgcG9pbnQgcCBjYW4gYmUgbnVtYmVyIHAgb3IgYSBwb2ludCBbcCxzXVxuXG4gICAgaW1wbGVtZW50ZWQgYnkgY29tcGFyaW5nIHBvaW50c1xuICAgIGV4Y2VwdGlvbiBpZiBpbnRlcnZhbCBpcyBub3QgZGVmaW5lZFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIHApIHtcbiAgICBsZXQgW2xvd19wLCBoaWdoX3BdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAvLyBjb3ZlcnM6IGxvdyA8PSBwIDw9IGhpZ2hcbiAgICByZXR1cm4gZW5kcG9pbnRfbGUobG93X3AsIHApICYmIGVuZHBvaW50X2xlKHAsIGhpZ2hfcCk7XG59XG4vLyBjb252ZW5pZW5jZVxuZnVuY3Rpb24gaW50ZXJ2YWxfY292ZXJzX3BvaW50KGl0diwgcCkge1xuICAgIHJldHVybiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBbcCwgMF0pO1xufVxuXG5cblxuLypcbiAgICBSZXR1cm4gdHJ1ZSBpZiBpbnRlcnZhbCBoYXMgbGVuZ3RoIDBcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9pc19zaW5ndWxhcihpbnRlcnZhbCkge1xuICAgIHJldHVybiBpbnRlcnZhbFswXSA9PSBpbnRlcnZhbFsxXVxufVxuXG4vKlxuICAgIENyZWF0ZSBpbnRlcnZhbCBmcm9tIGVuZHBvaW50c1xuKi9cbmZ1bmN0aW9uIGludGVydmFsX2Zyb21fZW5kcG9pbnRzKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIC8vIHAxIG11c3QgYmUgYSBsb3cgcG9pbnRcbiAgICBpZiAoczEgPT0gLTEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBsb3cgcG9pbnRcIiwgcDEpO1xuICAgIH1cbiAgICBpZiAoczIgPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2VhbCBoaWdoIHBvaW50XCIsIHAyKTsgICBcbiAgICB9XG4gICAgcmV0dXJuIFt2MSwgdjIsIChzMT09MCksIChzMj09MCldXG59XG5cblxuZXhwb3J0IGNvbnN0IGVuZHBvaW50ID0ge1xuICAgIGxlOiBlbmRwb2ludF9sZSxcbiAgICBsdDogZW5kcG9pbnRfbHQsXG4gICAgZ2U6IGVuZHBvaW50X2dlLFxuICAgIGd0OiBlbmRwb2ludF9ndCxcbiAgICBjbXA6IGVuZHBvaW50X2NtcCxcbiAgICBlcTogZW5kcG9pbnRfZXEsXG4gICAgbWluOiBlbmRwb2ludF9taW4sXG4gICAgbWF4OiBlbmRwb2ludF9tYXgsXG4gICAgZmxpcDogZW5kcG9pbnRfZmxpcCxcbiAgICBmcm9tX2ludGVydmFsOiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbFxufVxuZXhwb3J0IGNvbnN0IGludGVydmFsID0ge1xuICAgIGNvdmVyc19lbmRwb2ludDogaW50ZXJ2YWxfY292ZXJzX2VuZHBvaW50LFxuICAgIGNvdmVyc19wb2ludDogaW50ZXJ2YWxfY292ZXJzX3BvaW50LCBcbiAgICBpc19zaW5ndWxhcjogaW50ZXJ2YWxfaXNfc2luZ3VsYXIsXG4gICAgZnJvbV9lbmRwb2ludHM6IGludGVydmFsX2Zyb21fZW5kcG9pbnRzXG59XG4iLCJpbXBvcnQge2ludGVydmFsfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbkJBU0UgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLypcblx0QWJzdHJhY3QgQmFzZSBDbGFzcyBmb3IgU2VnbWVudHNcblxuICAgIGNvbnN0cnVjdG9yKGludGVydmFsKVxuXG4gICAgLSBpbnRlcnZhbDogaW50ZXJ2YWwgb2YgdmFsaWRpdHkgb2Ygc2VnbWVudFxuICAgIC0gZHluYW1pYzogdHJ1ZSBpZiBzZWdtZW50IGlzIGR5bmFtaWNcbiAgICAtIHZhbHVlKG9mZnNldCk6IHZhbHVlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4gICAgLSBxdWVyeShvZmZzZXQpOiBzdGF0ZSBvZiBzZWdtZW50IGF0IG9mZnNldFxuKi9cblxuZXhwb3J0IGNsYXNzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYpIHtcblx0XHR0aGlzLl9pdHYgPSBpdHY7XG5cdH1cblxuXHRnZXQgaW50ZXJ2YWwoKSB7cmV0dXJuIHRoaXMuX2l0djt9XG5cbiAgICAvKiogXG4gICAgICogaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3NcbiAgICAgKiByZXR1cm5zIHt2YWx1ZSwgZHluYW1pY307XG4gICAgKi9cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjb252ZW5pZW5jZSBmdW5jdGlvbiByZXR1cm5pbmcgdGhlIHN0YXRlIG9mIHRoZSBzZWdtZW50XG4gICAgICogQHBhcmFtIHsqfSBvZmZzZXQgXG4gICAgICogQHJldHVybnMgXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5faXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuc3RhdGUob2Zmc2V0KSwgb2Zmc2V0fTtcbiAgICAgICAgfSBcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdW5kZWZpbmVkLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExBWUVSUyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBMYXllcnNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX2xheWVycyA9IGFyZ3MubGF5ZXJzO1xuICAgICAgICB0aGlzLl92YWx1ZV9mdW5jID0gYXJncy52YWx1ZV9mdW5jXG5cbiAgICAgICAgLy8gVE9ETyAtIGZpZ3VyZSBvdXQgZHluYW1pYyBoZXJlP1xuICAgIH1cblxuXHRzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgLy8gVE9ETyAtIHVzZSB2YWx1ZSBmdW5jXG4gICAgICAgIC8vIGZvciBub3cgLSBqdXN0IHVzZSBmaXJzdCBsYXllclxuICAgICAgICByZXR1cm4gey4uLnRoaXMuX2xheWVyc1swXS5xdWVyeShvZmZzZXQpLCBvZmZzZXR9O1xuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU1RBVElDIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIFN0YXRpY1NlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG5cdFx0dGhpcy5fdmFsdWUgPSBhcmdzLnZhbHVlO1xuXHR9XG5cblx0c3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3ZhbHVlLCBkeW5hbWljOmZhbHNlfVxuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTU9USU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qXG4gICAgSW1wbGVtZW50cyBkZXRlcm1pbmlzdGljIHByb2plY3Rpb24gYmFzZWQgb24gaW5pdGlhbCBjb25kaXRpb25zIFxuICAgIC0gbW90aW9uIHZlY3RvciBkZXNjcmliZXMgbW90aW9uIHVuZGVyIGNvbnN0YW50IGFjY2VsZXJhdGlvblxuKi9cblxuZXhwb3J0IGNsYXNzIE1vdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG4gICAgXG4gICAgY29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOnAwLCB2ZWxvY2l0eTp2MCwgdGltZXN0YW1wOnQwXG4gICAgICAgIH0gPSBhcmdzLnZlY3RvcjtcbiAgICAgICAgLy8gY3JlYXRlIG1vdGlvbiB0cmFuc2l0aW9uXG4gICAgICAgIGNvbnN0IGEwID0gMDtcbiAgICAgICAgdGhpcy5fdmVsb2NpdHkgPSB2MDtcbiAgICAgICAgdGhpcy5fcG9zaXRpb24gPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIGxldCBkID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHJldHVybiBwMCArIHYwKmQgKyAwLjUqYTAqZCpkO1xuICAgICAgICB9OyAgIFxuICAgIH1cblxuICAgIHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmFsdWU6IHRoaXMuX3Bvc2l0aW9uKG9mZnNldCksIFxuICAgICAgICAgICAgcmF0ZTogdGhpcy5fdmVsb2NpdHksIFxuICAgICAgICAgICAgZHluYW1pYzogdGhpcy5fdmVsb2NpdHkgIT0gMFxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRSQU5TSVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIFN1cHBvcnRlZCBlYXNpbmcgZnVuY3Rpb25zXG4gICAgXCJlYXNlLWluXCI6XG4gICAgXCJlYXNlLW91dFwiOlxuICAgIFwiZWFzZS1pbi1vdXRcIlxuKi9cblxuZnVuY3Rpb24gZWFzZWluICh0cykge1xuICAgIHJldHVybiBNYXRoLnBvdyh0cywyKTsgIFxufVxuZnVuY3Rpb24gZWFzZW91dCAodHMpIHtcbiAgICByZXR1cm4gMSAtIGVhc2VpbigxIC0gdHMpO1xufVxuZnVuY3Rpb24gZWFzZWlub3V0ICh0cykge1xuICAgIGlmICh0cyA8IC41KSB7XG4gICAgICAgIHJldHVybiBlYXNlaW4oMiAqIHRzKSAvIDI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICgyIC0gZWFzZWluKDIgKiAoMSAtIHRzKSkpIC8gMjtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFuc2l0aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcblx0XHRzdXBlcihpdHYpO1xuICAgICAgICBsZXQge3YwLCB2MSwgZWFzaW5nfSA9IGFyZ3M7XG4gICAgICAgIGxldCBbdDAsIHQxXSA9IHRoaXMuX2l0di5zbGljZSgwLDIpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgdHJhbnNpdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl9keW5hbWljID0gdjEtdjAgIT0gMDtcbiAgICAgICAgdGhpcy5fdHJhbnMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgdHMgdG8gW3QwLHQxXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzaGlmdCBmcm9tIFt0MCx0MV0tc3BhY2UgdG8gWzAsKHQxLXQwKV0tc3BhY2VcbiAgICAgICAgICAgIC8vIC0gc2NhbGUgZnJvbSBbMCwodDEtdDApXS1zcGFjZSB0byBbMCwxXS1zcGFjZVxuICAgICAgICAgICAgdHMgPSB0cyAtIHQwO1xuICAgICAgICAgICAgdHMgPSB0cy9wYXJzZUZsb2F0KHQxLXQwKTtcbiAgICAgICAgICAgIC8vIGVhc2luZyBmdW5jdGlvbnMgc3RyZXRjaGVzIG9yIGNvbXByZXNzZXMgdGhlIHRpbWUgc2NhbGUgXG4gICAgICAgICAgICBpZiAoZWFzaW5nID09IFwiZWFzZS1pblwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW4odHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlb3V0KHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWFzaW5nID09IFwiZWFzZS1pbi1vdXRcIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZWlub3V0KHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc2l0aW9uIGZyb20gdjAgdG8gdjEsIGZvciB0aW1lIHZhbHVlcyBbMCwxXVxuICAgICAgICAgICAgdHMgPSBNYXRoLm1heCh0cywgMCk7XG4gICAgICAgICAgICB0cyA9IE1hdGgubWluKHRzLCAxKTtcbiAgICAgICAgICAgIHJldHVybiB2MCArICh2MS12MCkqdHM7XG4gICAgICAgIH1cblx0fVxuXG5cdHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl90cmFucyhvZmZzZXQpLCBkeW5hbWljOnRoaXMuX2R5bmFtaWN9XG5cdH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElOVEVSUE9MQVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9uIHRvIGNyZWF0ZSBhbiBpbnRlcnBvbGF0b3IgZm9yIG5lYXJlc3QgbmVpZ2hib3IgaW50ZXJwb2xhdGlvbiB3aXRoXG4gKiBleHRyYXBvbGF0aW9uIHN1cHBvcnQuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdHVwbGVzIC0gQW4gYXJyYXkgb2YgW3ZhbHVlLCBvZmZzZXRdIHBhaXJzLCB3aGVyZSB2YWx1ZSBpcyB0aGVcbiAqIHBvaW50J3MgdmFsdWUgYW5kIG9mZnNldCBpcyB0aGUgY29ycmVzcG9uZGluZyBvZmZzZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gQSBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIG9mZnNldCBhbmQgcmV0dXJucyB0aGVcbiAqIGludGVycG9sYXRlZCBvciBleHRyYXBvbGF0ZWQgdmFsdWUuXG4gKi9cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUodHVwbGVzKSB7XG5cbiAgICBpZiAodHVwbGVzLmxlbmd0aCA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHVuZGVmaW5lZDt9XG4gICAgfSBlbHNlIGlmICh0dXBsZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHR1cGxlc1swXVswXTt9XG4gICAgfVxuXG4gICAgLy8gU29ydCB0aGUgdHVwbGVzIGJ5IHRoZWlyIG9mZnNldHNcbiAgICBjb25zdCBzb3J0ZWRUdXBsZXMgPSBbLi4udHVwbGVzXS5zb3J0KChhLCBiKSA9PiBhWzFdIC0gYlsxXSk7XG4gIFxuICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3Iob2Zmc2V0KSB7XG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBiZWZvcmUgdGhlIGZpcnN0IHBvaW50XG4gICAgICBpZiAob2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1swXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1swXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbMV07XG4gICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gSGFuZGxlIGV4dHJhcG9sYXRpb24gYWZ0ZXIgdGhlIGxhc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMl07XG4gICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICBcbiAgICAgIC8vIEZpbmQgdGhlIG5lYXJlc3QgcG9pbnRzIHRvIHRoZSBsZWZ0IGFuZCByaWdodFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW2ldWzFdICYmIG9mZnNldCA8PSBzb3J0ZWRUdXBsZXNbaSArIDFdWzFdKSB7XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbaV07XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbaSArIDFdO1xuICAgICAgICAgIC8vIExpbmVhciBpbnRlcnBvbGF0aW9uIGZvcm11bGE6IHkgPSB5MSArICggKHggLSB4MSkgKiAoeTIgLSB5MSkgLyAoeDIgLSB4MSkgKVxuICAgICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICBcbiAgICAgIC8vIEluIGNhc2UgdGhlIG9mZnNldCBkb2VzIG5vdCBmYWxsIHdpdGhpbiBhbnkgcmFuZ2UgKHNob3VsZCBiZSBjb3ZlcmVkIGJ5IHRoZSBwcmV2aW91cyBjb25kaXRpb25zKVxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9O1xufVxuICBcblxuZXhwb3J0IGNsYXNzIEludGVycG9sYXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG4gICAgY29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIC8vIHNldHVwIGludGVycG9sYXRpb24gZnVuY3Rpb25cbiAgICAgICAgdGhpcy5fdHJhbnMgPSBpbnRlcnBvbGF0ZShhcmdzLnR1cGxlcyk7XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dHJ1ZX07XG4gICAgfVxufVxuXG5cbiIsIi8qXG5cdENvcHlyaWdodCAyMDIwXG5cdEF1dGhvciA6IEluZ2FyIEFybnR6ZW5cblxuXHRUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgVGltaW5nc3JjIG1vZHVsZS5cblxuXHRUaW1pbmdzcmMgaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeVxuXHRpdCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnlcblx0dGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbiwgZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3Jcblx0KGF0IHlvdXIgb3B0aW9uKSBhbnkgbGF0ZXIgdmVyc2lvbi5cblxuXHRUaW1pbmdzcmMgaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCxcblx0YnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZOyB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2Zcblx0TUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLiAgU2VlIHRoZVxuXHRHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cblxuXHRZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2Vcblx0YWxvbmcgd2l0aCBUaW1pbmdzcmMuICBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz4uXG4qL1xuXG5cblxuLypcblx0RXZlbnRcblx0LSBuYW1lOiBldmVudCBuYW1lXG5cdC0gcHVibGlzaGVyOiB0aGUgb2JqZWN0IHdoaWNoIGRlZmluZWQgdGhlIGV2ZW50XG5cdC0gaW5pdDogdHJ1ZSBpZiB0aGUgZXZlbnQgc3VwcHBvcnRzIGluaXQgZXZlbnRzXG5cdC0gc3Vic2NyaXB0aW9uczogc3Vic2NyaXB0aW5zIHRvIHRoaXMgZXZlbnRcblxuKi9cblxuY2xhc3MgRXZlbnQge1xuXG5cdGNvbnN0cnVjdG9yIChwdWJsaXNoZXIsIG5hbWUsIG9wdGlvbnMpIHtcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXHRcdHRoaXMucHVibGlzaGVyID0gcHVibGlzaGVyO1xuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdFx0dGhpcy5pbml0ID0gKG9wdGlvbnMuaW5pdCA9PT0gdW5kZWZpbmVkKSA/IGZhbHNlIDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucyA9IFtdO1xuXHR9XG5cblx0Lypcblx0XHRzdWJzY3JpYmUgdG8gZXZlbnRcblx0XHQtIHN1YnNjcmliZXI6IHN1YnNjcmliaW5nIG9iamVjdFxuXHRcdC0gY2FsbGJhY2s6IGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGludm9rZVxuXHRcdC0gb3B0aW9uczpcblx0XHRcdGluaXQ6IGlmIHRydWUgc3Vic2NyaWJlciB3YW50cyBpbml0IGV2ZW50c1xuXHQqL1xuXHRzdWJzY3JpYmUgKGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0aWYgKCFjYWxsYmFjayB8fCB0eXBlb2YgY2FsbGJhY2sgIT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgbm90IGEgZnVuY3Rpb25cIiwgY2FsbGJhY2spO1xuXHRcdH1cblx0XHRjb25zdCBzdWIgPSBuZXcgU3Vic2NyaXB0aW9uKHRoaXMsIGNhbGxiYWNrLCBvcHRpb25zKTtcblx0XHR0aGlzLnN1YnNjcmlwdGlvbnMucHVzaChzdWIpO1xuXHQgICAgLy8gSW5pdGlhdGUgaW5pdCBjYWxsYmFjayBmb3IgdGhpcyBzdWJzY3JpcHRpb25cblx0ICAgIGlmICh0aGlzLmluaXQgJiYgc3ViLmluaXQpIHtcblx0ICAgIFx0c3ViLmluaXRfcGVuZGluZyA9IHRydWU7XG5cdCAgICBcdGxldCBzZWxmID0gdGhpcztcblx0ICAgIFx0UHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICBcdFx0Y29uc3QgZUFyZ3MgPSBzZWxmLnB1Ymxpc2hlci5ldmVudGlmeUluaXRFdmVudEFyZ3Moc2VsZi5uYW1lKSB8fCBbXTtcblx0ICAgIFx0XHRzdWIuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdCAgICBcdFx0Zm9yIChsZXQgZUFyZyBvZiBlQXJncykge1xuXHQgICAgXHRcdFx0c2VsZi50cmlnZ2VyKGVBcmcsIFtzdWJdLCB0cnVlKTtcblx0ICAgIFx0XHR9XG5cdCAgICBcdH0pO1xuXHQgICAgfVxuXHRcdHJldHVybiBzdWJcblx0fVxuXG5cdC8qXG5cdFx0dHJpZ2dlciBldmVudFxuXG5cdFx0LSBpZiBzdWIgaXMgdW5kZWZpbmVkIC0gcHVibGlzaCB0byBhbGwgc3Vic2NyaXB0aW9uc1xuXHRcdC0gaWYgc3ViIGlzIGRlZmluZWQgLSBwdWJsaXNoIG9ubHkgdG8gZ2l2ZW4gc3Vic2NyaXB0aW9uXG5cdCovXG5cdHRyaWdnZXIgKGVBcmcsIHN1YnMsIGluaXQpIHtcblx0XHRsZXQgZUluZm8sIGN0eDtcblx0XHRmb3IgKGNvbnN0IHN1YiBvZiBzdWJzKSB7XG5cdFx0XHQvLyBpZ25vcmUgdGVybWluYXRlZCBzdWJzY3JpcHRpb25zXG5cdFx0XHRpZiAoc3ViLnRlcm1pbmF0ZWQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRlSW5mbyA9IHtcblx0XHRcdFx0c3JjOiB0aGlzLnB1Ymxpc2hlcixcblx0XHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0XHRzdWI6IHN1Yixcblx0XHRcdFx0aW5pdDogaW5pdFxuXHRcdFx0fVxuXHRcdFx0Y3R4ID0gc3ViLmN0eCB8fCB0aGlzLnB1Ymxpc2hlcjtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHN1Yi5jYWxsYmFjay5jYWxsKGN0eCwgZUFyZywgZUluZm8pO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBFcnJvciBpbiAke3RoaXMubmFtZX06ICR7c3ViLmNhbGxiYWNrfSAke2Vycn1gKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKlxuXHR1bnN1YnNjcmliZSBmcm9tIGV2ZW50XG5cdC0gdXNlIHN1YnNjcmlwdGlvbiByZXR1cm5lZCBieSBwcmV2aW91cyBzdWJzY3JpYmVcblx0Ki9cblx0dW5zdWJzY3JpYmUoc3ViKSB7XG5cdFx0bGV0IGlkeCA9IHRoaXMuc3Vic2NyaXB0aW9ucy5pbmRleE9mKHN1Yik7XG5cdFx0aWYgKGlkeCA+IC0xKSB7XG5cdFx0XHR0aGlzLnN1YnNjcmlwdGlvbnMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRzdWIudGVybWluYXRlKCk7XG5cdFx0fVxuXHR9XG59XG5cblxuLypcblx0U3Vic2NyaXB0aW9uIGNsYXNzXG4qL1xuXG5jbGFzcyBTdWJzY3JpcHRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKGV2ZW50LCBjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5ldmVudCA9IGV2ZW50O1xuXHRcdHRoaXMubmFtZSA9IGV2ZW50Lm5hbWU7XG5cdFx0dGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrXG5cdFx0dGhpcy5pbml0ID0gKG9wdGlvbnMuaW5pdCA9PT0gdW5kZWZpbmVkKSA/IHRoaXMuZXZlbnQuaW5pdCA6IG9wdGlvbnMuaW5pdDtcblx0XHR0aGlzLmluaXRfcGVuZGluZyA9IGZhbHNlO1xuXHRcdHRoaXMudGVybWluYXRlZCA9IGZhbHNlO1xuXHRcdHRoaXMuY3R4ID0gb3B0aW9ucy5jdHg7XG5cdH1cblxuXHR0ZXJtaW5hdGUoKSB7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gdHJ1ZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuZXZlbnQudW5zdWJzY3JpYmUodGhpcyk7XG5cdH1cbn1cblxuXG4vKlxuXG5cdEVWRU5USUZZIElOU1RBTkNFXG5cblx0RXZlbnRpZnkgYnJpbmdzIGV2ZW50aW5nIGNhcGFiaWxpdGllcyB0byBhbnkgb2JqZWN0LlxuXG5cdEluIHBhcnRpY3VsYXIsIGV2ZW50aWZ5IHN1cHBvcnRzIHRoZSBpbml0aWFsLWV2ZW50IHBhdHRlcm4uXG5cdE9wdC1pbiBmb3IgaW5pdGlhbCBldmVudHMgcGVyIGV2ZW50IHR5cGUuXG5cblx0ZXZlbnRpZnlJbml0RXZlbnRBcmdzKG5hbWUpIHtcblx0XHRpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG5cdFx0XHRyZXR1cm4gW3RoaXMuX3ZhbHVlXTtcblx0XHR9XG5cdH1cblxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5SW5zdGFuY2UgKG9iamVjdCkge1xuXHRvYmplY3QuX19ldmVudGlmeV9ldmVudE1hcCA9IG5ldyBNYXAoKTtcblx0b2JqZWN0Ll9fZXZlbnRpZnlfYnVmZmVyID0gW107XG5cdHJldHVybiBvYmplY3Q7XG59O1xuXG5cbi8qXG5cdEVWRU5USUZZIFBST1RPVFlQRVxuXG5cdEFkZCBldmVudGlmeSBmdW5jdGlvbmFsaXR5IHRvIHByb3RvdHlwZSBvYmplY3RcbiovXG5cbmV4cG9ydCBmdW5jdGlvbiBldmVudGlmeVByb3RvdHlwZShfcHJvdG90eXBlKSB7XG5cblx0ZnVuY3Rpb24gZXZlbnRpZnlHZXRFdmVudChvYmplY3QsIG5hbWUpIHtcblx0XHRjb25zdCBldmVudCA9IG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwLmdldChuYW1lKTtcblx0XHRpZiAoZXZlbnQgPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCB1bmRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHJldHVybiBldmVudDtcblx0fVxuXG5cdC8qXG5cdFx0REVGSU5FIEVWRU5UXG5cdFx0LSB1c2VkIG9ubHkgYnkgZXZlbnQgc291cmNlXG5cdFx0LSBuYW1lOiBuYW1lIG9mIGV2ZW50XG5cdFx0LSBvcHRpb25zOiB7aW5pdDp0cnVlfSBzcGVjaWZpZXMgaW5pdC1ldmVudCBzZW1hbnRpY3MgZm9yIGV2ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5RGVmaW5lKG5hbWUsIG9wdGlvbnMpIHtcblx0XHQvLyBjaGVjayB0aGF0IGV2ZW50IGRvZXMgbm90IGFscmVhZHkgZXhpc3Rcblx0XHRpZiAodGhpcy5fX2V2ZW50aWZ5X2V2ZW50TWFwLmhhcyhuYW1lKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRXZlbnQgYWxyZWFkeSBkZWZpbmVkXCIsIG5hbWUpO1xuXHRcdH1cblx0XHR0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuc2V0KG5hbWUsIG5ldyBFdmVudCh0aGlzLCBuYW1lLCBvcHRpb25zKSk7XG5cdH07XG5cblx0Lypcblx0XHRPTlxuXHRcdC0gdXNlZCBieSBzdWJzY3JpYmVyXG5cdFx0cmVnaXN0ZXIgY2FsbGJhY2sgb24gZXZlbnQuXG5cdCovXG5cdGZ1bmN0aW9uIG9uKG5hbWUsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSkuc3Vic2NyaWJlKGNhbGxiYWNrLCBvcHRpb25zKTtcblx0fTtcblxuXHQvKlxuXHRcdE9GRlxuXHRcdC0gdXNlZCBieSBzdWJzY3JpYmVyXG5cdFx0VW4tcmVnaXN0ZXIgYSBoYW5kbGVyIGZyb20gYSBzcGVjZmljIGV2ZW50IHR5cGVcblx0Ki9cblx0ZnVuY3Rpb24gb2ZmKHN1Yikge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIHN1Yi5uYW1lKS51bnN1YnNjcmliZShzdWIpO1xuXHR9O1xuXG5cblx0ZnVuY3Rpb24gZXZlbnRpZnlTdWJzY3JpcHRpb25zKG5hbWUpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpcHRpb25zO1xuXHR9XG5cblxuXG5cdC8qXG5cdFx0VHJpZ2dlciBsaXN0IG9mIGV2ZW50SXRlbXMgb24gb2JqZWN0XG5cblx0XHRldmVudEl0ZW06ICB7bmFtZTouLiwgZUFyZzouLn1cblxuXHRcdGNvcHkgYWxsIGV2ZW50SXRlbXMgaW50byBidWZmZXIuXG5cdFx0cmVxdWVzdCBlbXB0eWluZyB0aGUgYnVmZmVyLCBpLmUuIGFjdHVhbGx5IHRyaWdnZXJpbmcgZXZlbnRzLFxuXHRcdGV2ZXJ5IHRpbWUgdGhlIGJ1ZmZlciBnb2VzIGZyb20gZW1wdHkgdG8gbm9uLWVtcHR5XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsbChldmVudEl0ZW1zKSB7XG5cdFx0aWYgKGV2ZW50SXRlbXMubGVuZ3RoID09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBtYWtlIHRyaWdnZXIgaXRlbXNcblx0XHQvLyByZXNvbHZlIG5vbi1wZW5kaW5nIHN1YnNjcmlwdGlvbnMgbm93XG5cdFx0Ly8gZWxzZSBzdWJzY3JpcHRpb25zIG1heSBjaGFuZ2UgZnJvbSBwZW5kaW5nIHRvIG5vbi1wZW5kaW5nXG5cdFx0Ly8gYmV0d2VlbiBoZXJlIGFuZCBhY3R1YWwgdHJpZ2dlcmluZ1xuXHRcdC8vIG1ha2UgbGlzdCBvZiBbZXYsIGVBcmcsIHN1YnNdIHR1cGxlc1xuXHRcdGxldCB0cmlnZ2VySXRlbXMgPSBldmVudEl0ZW1zLm1hcCgoaXRlbSkgPT4ge1xuXHRcdFx0bGV0IHtuYW1lLCBlQXJnfSA9IGl0ZW07XG5cdFx0XHRsZXQgZXYgPSBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpO1xuXHRcdFx0bGV0IHN1YnMgPSBldi5zdWJzY3JpcHRpb25zLmZpbHRlcihzdWIgPT4gc3ViLmluaXRfcGVuZGluZyA9PSBmYWxzZSk7XG5cdFx0XHRyZXR1cm4gW2V2LCBlQXJnLCBzdWJzXTtcblx0XHR9LCB0aGlzKTtcblxuXHRcdC8vIGFwcGVuZCB0cmlnZ2VyIEl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGNvbnN0IGxlbiA9IHRyaWdnZXJJdGVtcy5sZW5ndGg7XG5cdFx0Y29uc3QgYnVmID0gdGhpcy5fX2V2ZW50aWZ5X2J1ZmZlcjtcblx0XHRjb25zdCBidWZfbGVuID0gdGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGg7XG5cdFx0Ly8gcmVzZXJ2ZSBtZW1vcnkgLSBzZXQgbmV3IGxlbmd0aFxuXHRcdHRoaXMuX19ldmVudGlmeV9idWZmZXIubGVuZ3RoID0gYnVmX2xlbiArIGxlbjtcblx0XHQvLyBjb3B5IHRyaWdnZXJJdGVtcyB0byBidWZmZXJcblx0XHRmb3IgKGxldCBpPTA7IGk8bGVuOyBpKyspIHtcblx0XHRcdGJ1ZltidWZfbGVuK2ldID0gdHJpZ2dlckl0ZW1zW2ldO1xuXHRcdH1cblx0XHQvLyByZXF1ZXN0IGVtcHR5aW5nIG9mIHRoZSBidWZmZXJcblx0XHRpZiAoYnVmX2xlbiA9PSAwKSB7XG5cdFx0XHRsZXQgc2VsZiA9IHRoaXM7XG5cdFx0XHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRmb3IgKGxldCBbZXYsIGVBcmcsIHN1YnNdIG9mIHNlbGYuX19ldmVudGlmeV9idWZmZXIpIHtcblx0XHRcdFx0XHQvLyBhY3R1YWwgZXZlbnQgdHJpZ2dlcmluZ1xuXHRcdFx0XHRcdGV2LnRyaWdnZXIoZUFyZywgc3VicywgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGYuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdC8qXG5cdFx0VHJpZ2dlciBtdWx0aXBsZSBldmVudHMgb2Ygc2FtZSB0eXBlIChuYW1lKVxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXJBbGlrZShuYW1lLCBlQXJncykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChlQXJncy5tYXAoZUFyZyA9PiB7XG5cdFx0XHRyZXR1cm4ge25hbWUsIGVBcmd9O1xuXHRcdH0pKTtcblx0fVxuXG5cdC8qXG5cdFx0VHJpZ2dlciBzaW5nbGUgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyKG5hbWUsIGVBcmcpIHtcblx0XHRyZXR1cm4gdGhpcy5ldmVudGlmeVRyaWdnZXJBbGwoW3tuYW1lLCBlQXJnfV0pO1xuXHR9XG5cblx0X3Byb3RvdHlwZS5ldmVudGlmeURlZmluZSA9IGV2ZW50aWZ5RGVmaW5lO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlciA9IGV2ZW50aWZ5VHJpZ2dlcjtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXJBbGlrZSA9IGV2ZW50aWZ5VHJpZ2dlckFsaWtlO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsbCA9IGV2ZW50aWZ5VHJpZ2dlckFsbDtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVN1YnNjcmlwdGlvbnMgPSBldmVudGlmeVN1YnNjcmlwdGlvbnM7XG5cdF9wcm90b3R5cGUub24gPSBvbjtcblx0X3Byb3RvdHlwZS5vZmYgPSBvZmY7XG59O1xuXG5cbmV4cG9ydCBjb25zdCBldmVudGlmeSA9IGZ1bmN0aW9uICgpIHtcblx0cmV0dXJuIHtcblx0XHRhZGRUb0luc3RhbmNlOiBldmVudGlmeUluc3RhbmNlLFxuXHRcdGFkZFRvUHJvdG90eXBlOiBldmVudGlmeVByb3RvdHlwZVxuXHR9XG59KCk7XG5cbi8qXG5cdEV2ZW50IFZhcmlhYmxlXG5cblx0T2JqZWN0cyB3aXRoIGEgc2luZ2xlIFwiY2hhbmdlXCIgZXZlbnRcbiovXG5cbmV4cG9ydCBjbGFzcyBFdmVudFZhcmlhYmxlIHtcblxuXHRjb25zdHJ1Y3RvciAodmFsdWUpIHtcblx0XHRldmVudGlmeUluc3RhbmNlKHRoaXMpO1xuXHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0dGhpcy5ldmVudGlmeURlZmluZShcImNoYW5nZVwiLCB7aW5pdDp0cnVlfSk7XG5cdH1cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG5cdGdldCB2YWx1ZSAoKSB7cmV0dXJuIHRoaXMuX3ZhbHVlfTtcblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdGlmICh2YWx1ZSAhPSB0aGlzLl92YWx1ZSkge1xuXHRcdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHRcdHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHZhbHVlKTtcblx0XHR9XG5cdH1cbn1cbmV2ZW50aWZ5UHJvdG90eXBlKEV2ZW50VmFyaWFibGUucHJvdG90eXBlKTtcblxuLypcblx0RXZlbnQgQm9vbGVhblxuXG5cblx0Tm90ZSA6IGltcGxlbWVudGF0aW9uIHVzZXMgZmFsc2luZXNzIG9mIGlucHV0IHBhcmFtZXRlciB0byBjb25zdHJ1Y3RvciBhbmQgc2V0KCkgb3BlcmF0aW9uLFxuXHRzbyBldmVudEJvb2xlYW4oLTEpIHdpbGwgYWN0dWFsbHkgc2V0IGl0IHRvIHRydWUgYmVjYXVzZVxuXHQoLTEpID8gdHJ1ZSA6IGZhbHNlIC0+IHRydWUgIVxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50Qm9vbGVhbiBleHRlbmRzIEV2ZW50VmFyaWFibGUge1xuXHRjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuXHRcdHN1cGVyKEJvb2xlYW4odmFsdWUpKTtcblx0fVxuXG5cdHNldCB2YWx1ZSAodmFsdWUpIHtcblx0XHRzdXBlci52YWx1ZSA9IEJvb2xlYW4odmFsdWUpO1xuXHR9XG5cdGdldCB2YWx1ZSAoKSB7cmV0dXJuIHN1cGVyLnZhbHVlfTtcbn1cblxuXG4vKlxuXHRtYWtlIGEgcHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aGVuIEV2ZW50Qm9vbGVhbiBjaGFuZ2VzXG5cdHZhbHVlLlxuKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWtlUHJvbWlzZShldmVudE9iamVjdCwgY29uZGl0aW9uRnVuYykge1xuXHRjb25kaXRpb25GdW5jID0gY29uZGl0aW9uRnVuYyB8fCBmdW5jdGlvbih2YWwpIHtyZXR1cm4gdmFsID09IHRydWV9O1xuXHRyZXR1cm4gbmV3IFByb21pc2UgKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0XHRsZXQgc3ViID0gZXZlbnRPYmplY3Qub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHRpZiAoY29uZGl0aW9uRnVuYyh2YWx1ZSkpIHtcblx0XHRcdFx0cmVzb2x2ZSh2YWx1ZSk7XG5cdFx0XHRcdGV2ZW50T2JqZWN0Lm9mZihzdWIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcbn07XG5cbi8vIG1vZHVsZSBhcGlcbmV4cG9ydCBkZWZhdWx0IHtcblx0ZXZlbnRpZnlQcm90b3R5cGUsXG5cdGV2ZW50aWZ5SW5zdGFuY2UsXG5cdEV2ZW50VmFyaWFibGUsXG5cdEV2ZW50Qm9vbGVhbixcblx0bWFrZVByb21pc2Vcbn07XG5cbiIsIlxuLy8gb3Z2ZXJyaWRlIG1vZHVsbyB0byBiZWhhdmUgYmV0dGVyIGZvciBuZWdhdGl2ZSBudW1iZXJzXG5leHBvcnQgZnVuY3Rpb24gbW9kKG4sIG0pIHtcbiAgICByZXR1cm4gKChuICUgbSkgKyBtKSAlIG07XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZGl2bW9kKHgsIGJhc2UpIHtcbiAgICBsZXQgbiA9IE1hdGguZmxvb3IoeCAvIGJhc2UpXG4gICAgbGV0IHIgPSBtb2QoeCwgYmFzZSk7XG4gICAgcmV0dXJuIFtuLCByXTtcbn1cblxuXG4vKlxuICAgIFRoaXMgYWRkcyBiYXNpYyAoc3luY2hyb25vdXMpIGNhbGxiYWNrIHN1cHBvcnQgdG8gYW4gb2JqZWN0LlxuKi9cblxuZXhwb3J0IGNvbnN0IGNhbGxiYWNrID0gZnVuY3Rpb24gKCkge1xuXG4gICAgZnVuY3Rpb24gYWRkVG9JbnN0YW5jZShvYmplY3QpIHtcbiAgICAgICAgb2JqZWN0Ll9fY2FsbGJhY2tfY2FsbGJhY2tzID0gW107XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkX2NhbGxiYWNrIChoYW5kbGVyKSB7XG4gICAgICAgIGxldCBoYW5kbGUgPSB7XG4gICAgICAgICAgICBoYW5kbGVyOiBoYW5kbGVyXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fX2NhbGxiYWNrX2NhbGxiYWNrcy5wdXNoKGhhbmRsZSk7XG4gICAgICAgIHJldHVybiBoYW5kbGU7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIHJlbW92ZV9jYWxsYmFjayAoaGFuZGxlKSB7XG4gICAgICAgIGxldCBpbmRleCA9IHRoaXMuX19jYWxsYmFja19jYWxsYmFja3MuaW5kZXhvZihoYW5kbGUpO1xuICAgICAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICAgICAgdGhpcy5fX2NhbGxiYWNrX2NhbGxiYWNrcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIG5vdGlmeV9jYWxsYmFja3MgKGVBcmcpIHtcbiAgICAgICAgdGhpcy5fX2NhbGxiYWNrX2NhbGxiYWNrcy5mb3JFYWNoKGZ1bmN0aW9uKGhhbmRsZSkge1xuICAgICAgICAgICAgaGFuZGxlLmhhbmRsZXIoZUFyZyk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cblxuICAgIGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlIChfcHJvdG90eXBlKSB7XG4gICAgICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgICAgIGFkZF9jYWxsYmFjaywgcmVtb3ZlX2NhbGxiYWNrLCBub3RpZnlfY2FsbGJhY2tzXG4gICAgICAgIH1cbiAgICAgICAgT2JqZWN0LmFzc2lnbihfcHJvdG90eXBlLCBhcGkpO1xuICAgIH1cblxuICAgIHJldHVybiB7YWRkVG9JbnN0YW5jZSwgYWRkVG9Qcm90b3R5cGV9XG59KCk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU09VUkNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEV4dGVuZCBhIGNsYXNzIHdpdGggc3VwcG9ydCBmb3IgZXh0ZXJuYWwgc291cmNlIG9uIFxuICogYSBuYW1lZCBwcm9wZXJ0eS5cbiAqIFxuICogb3B0aW9uOiBtdXRhYmxlOnRydWUgbWVhbnMgdGhhdCBwcm9wZXJ5IG1heSBiZSByZXNldCBcbiAqIFxuICogc291cmNlIG9iamVjdCBpcyBhc3N1bWVkIHRvIHN1cHBvcnQgdGhlIGNhbGxiYWNrIGludGVyZmFjZVxuICovXG5cblxuZXhwb3J0IGNvbnN0IHNvdXJjZSA9IGZ1bmN0aW9uICgpIHtcblxuICAgIGZ1bmN0aW9uIHByb3BuYW1lcyAocHJvcE5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHByb3A6IGBfXyR7cHJvcE5hbWV9YCxcbiAgICAgICAgICAgIGluaXQ6IGBfXyR7cHJvcE5hbWV9X2luaXRgLFxuICAgICAgICAgICAgaGFuZGxlOiBgX18ke3Byb3BOYW1lfV9oYW5kbGVgLFxuICAgICAgICAgICAgb25jaGFuZ2U6IGBfXyR7cHJvcE5hbWV9X29uY2hhbmdlYCxcbiAgICAgICAgICAgIGRldGF0Y2g6IGBfXyR7cHJvcE5hbWV9X2RldGF0Y2hgLFxuICAgICAgICAgICAgYXR0YXRjaDogYF9fJHtwcm9wTmFtZX1fYXR0YXRjaGBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2UgKG9iamVjdCwgcHJvcE5hbWUpIHtcbiAgICAgICAgY29uc3QgcCA9IHByb3BuYW1lcyhwcm9wTmFtZSlcbiAgICAgICAgb2JqZWN0W3AucHJvcF0gPSB1bmRlZmluZWRcbiAgICAgICAgb2JqZWN0W3AuaW5pdF0gPSBmYWxzZTtcbiAgICAgICAgb2JqZWN0W3AuaGFuZGxlXSA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSwgcHJvcE5hbWUsIG9wdGlvbnM9e30pIHtcblxuICAgICAgICBjb25zdCBwID0gcHJvcG5hbWVzKHByb3BOYW1lKVxuXG4gICAgICAgIGZ1bmN0aW9uIGRldGF0Y2goKSB7XG4gICAgICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIHNvdXJjZSBjaGFuZ2UgZXZlbnRcbiAgICAgICAgICAgIGxldCB7bXV0YWJsZT1mYWxzZX0gPSBvcHRpb25zO1xuICAgICAgICAgICAgaWYgKG11dGFibGUgJiYgdGhpc1twLnByb3BdKSB7XG4gICAgICAgICAgICAgICAgbGV0IGhhbmRsZSA9IHRoaXNbcC5oYW5kbGVdO1xuICAgICAgICAgICAgICAgIHRoaXNbcC5wcm9wXS5yZW1vdmVfY2FsbGJhY2soaGFuZGxlKTtcbiAgICAgICAgICAgICAgICB0aGlzW3AuaGFuZGxlXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXNbcC5wcm9wXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICBmdW5jdGlvbiBhdHRhdGNoKHNvdXJjZSkge1xuICAgICAgICAgICAgbGV0IHttdXRhYmxlPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgICAgICAgICBpZiAoIXRoaXNbcC5pbml0XSB8fCBtdXRhYmxlKSB7XG4gICAgICAgICAgICAgICAgdGhpc1twLnByb3BdID0gc291cmNlO1xuICAgICAgICAgICAgICAgIHRoaXNbcC5pbml0XSA9IHRydWU7XG4gICAgICAgICAgICAgICAgLy8gc3Vic2NyaWJlIHRvIGNhbGxiYWNrIGZyb20gc291cmNlXG4gICAgICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IHRoaXNbcC5vbmNoYW5nZV0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzW3AuaGFuZGxlXSA9IHNvdXJjZS5hZGRfY2FsbGJhY2soaGFuZGxlcik7XG4gICAgICAgICAgICAgICAgaGFuZGxlcigpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7cHJvcE5hbWV9IGNhbiBub3QgYmUgcmVhc3NpZ25lZGApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICAvLyBnZXR0ZXIgYW5kIHNldHRlclxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoX3Byb3RvdHlwZSwgcHJvcE5hbWUsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzW3AucHJvcF07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAoc3JjKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNyYyAhPSB0aGlzW3AucHJvcF0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1twLmRldGF0Y2hdKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbcC5hdHRhdGNoXShzcmMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBhcGkgPSB7fTtcbiAgICAgICAgYXBpW3AuZGV0YXRjaF0gPSBkZXRhdGNoO1xuICAgICAgICBhcGlbcC5hdHRhdGNoXSA9IGF0dGF0Y2g7XG4gICAgICAgIFxuICAgICAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG4gICAgfVxuICAgIHJldHVybiB7YWRkVG9JbnN0YW5jZSwgYWRkVG9Qcm90b3R5cGV9O1xufSgpO1xuXG4iLCJpbXBvcnQge2Rpdm1vZH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuXG4vKlxuICAgIFRpbWVvdXQgTW9uaXRvclxuXG4gICAgVGltZW91dCBNb25pdG9yIGlzIHNpbWlsYXIgdG8gc2V0SW50ZXJ2YWwsIGluIHRoZSBzZW5zZSB0aGF0IFxuICAgIGl0IGFsbG93cyBjYWxsYmFja3MgdG8gYmUgZmlyZWQgcGVyaW9kaWNhbGx5IFxuICAgIHdpdGggYSBnaXZlbiBkZWxheSAoaW4gbWlsbGlzKS4gIFxuICAgIFxuICAgIFRpbWVvdXQgTW9uaXRvciBpcyBtYWRlIHRvIHNhbXBsZSB0aGUgc3RhdGUgXG4gICAgb2YgYSBkeW5hbWljIG9iamVjdCwgcGVyaW9kaWNhbGx5LiBGb3IgdGhpcyByZWFzb24sIGVhY2ggY2FsbGJhY2sgaXMgXG4gICAgYm91bmQgdG8gYSBtb25pdG9yZWQgb2JqZWN0LCB3aGljaCB3ZSBoZXJlIGNhbGwgYSB2YXJpYWJsZS4gXG4gICAgT24gZWFjaCBpbnZvY2F0aW9uLCBhIGNhbGxiYWNrIHdpbGwgcHJvdmlkZSBhIGZyZXNobHkgc2FtcGxlZCBcbiAgICB2YWx1ZSBmcm9tIHRoZSB2YXJpYWJsZS5cblxuICAgIFRoaXMgdmFsdWUgaXMgYXNzdW1lZCB0byBiZSBhdmFpbGFibGUgYnkgcXVlcnlpbmcgdGhlIHZhcmlhYmxlLiBcblxuICAgICAgICB2LnF1ZXJ5KCkgLT4ge3ZhbHVlLCBkeW5hbWljLCBvZmZzZXQsIHRzfVxuXG4gICAgSW4gYWRkaXRpb24sIHRoZSB2YXJpYWJsZSBvYmplY3QgbWF5IHN3aXRjaCBiYWNrIGFuZCBcbiAgICBmb3J0aCBiZXR3ZWVuIGR5bmFtaWMgYW5kIHN0YXRpYyBiZWhhdmlvci4gVGhlIFRpbWVvdXQgTW9uaXRvclxuICAgIHR1cm5zIHBvbGxpbmcgb2ZmIHdoZW4gdGhlIHZhcmlhYmxlIGlzIG5vIGxvbmdlciBkeW5hbWljLCBcbiAgICBhbmQgcmVzdW1lcyBwb2xsaW5nIHdoZW4gdGhlIG9iamVjdCBiZWNvbWVzIGR5bmFtaWMuXG5cbiAgICBTdGF0ZSBjaGFuZ2VzIGFyZSBleHBlY3RlZCB0byBiZSBzaWduYWxsZWQgdGhyb3VnaCBhIDxjaGFuZ2U+IGV2ZW50LlxuXG4gICAgICAgIHN1YiA9IHYub24oXCJjaGFuZ2VcIiwgY2FsbGJhY2spXG4gICAgICAgIHYub2ZmKHN1YilcblxuICAgIENhbGxiYWNrcyBhcmUgaW52b2tlZCBvbiBldmVyeSA8Y2hhbmdlPiBldmVudCwgYXMgd2VsbFxuICAgIGFzIHBlcmlvZGljYWxseSB3aGVuIHRoZSBvYmplY3QgaXMgaW4gPGR5bmFtaWM+IHN0YXRlLlxuXG4gICAgICAgIGNhbGxiYWNrKHt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0LCB0c30pXG5cbiAgICBGdXJ0aGVybW9yZSwgaW4gb3JkZXIgdG8gc3VwcG9ydCBjb25zaXN0ZW50IHJlbmRlcmluZyBvZlxuICAgIHN0YXRlIGNoYW5nZXMgZnJvbSBtYW55IGR5bmFtaWMgdmFyaWFibGVzLCBpdCBpcyBpbXBvcnRhbnQgdGhhdFxuICAgIGNhbGxiYWNrcyBhcmUgaW52b2tlZCBhdCB0aGUgc2FtZSB0aW1lIGFzIG11Y2ggYXMgcG9zc2libGUsIHNvXG4gICAgdGhhdCBjaGFuZ2VzIHRoYXQgb2NjdXIgbmVhciBpbiB0aW1lIGNhbiBiZSBwYXJ0IG9mIHRoZSBzYW1lXG4gICAgc2NyZWVuIHJlZnJlc2guIFxuXG4gICAgRm9yIHRoaXMgcmVhc29uLCB0aGUgVGltZW91dE1vbml0b3IgZ3JvdXBzIGNhbGxiYWNrcyBpbiB0aW1lXG4gICAgYW5kIGludm9rZXMgY2FsbGJhY2tzIGF0IGF0IGZpeGVkIG1heGltdW0gcmF0ZSAoMjBIei81MG1zKS5cbiAgICBUaGlzIGltcGxpZXMgdGhhdCBwb2xsaW5nIGNhbGxiYWNrcyB3aWxsIGZhbGwgb24gYSBzaGFyZWQgXG4gICAgcG9sbGluZyBmcmVxdWVuY3kuXG5cbiAgICBBdCB0aGUgc2FtZSB0aW1lLCBjYWxsYmFja3MgbWF5IGhhdmUgaW5kaXZpZHVhbCBmcmVxdWVuY2llcyB0aGF0XG4gICAgYXJlIG11Y2ggbG93ZXIgcmF0ZSB0aGFuIHRoZSBtYXhpbXVtIHJhdGUuIFRoZSBpbXBsZW1lbnRhdGlvblxuICAgIGRvZXMgbm90IHJlbHkgb24gYSBmaXhlZCA1MG1zIHRpbWVvdXQgZnJlcXVlbmN5LCBidXQgaXMgdGltZW91dCBiYXNlZCxcbiAgICB0aHVzIHRoZXJlIGlzIG5vIHByb2Nlc3Npbmcgb3IgdGltZW91dCBiZXR3ZWVuIGNhbGxiYWNrcywgZXZlblxuICAgIGlmIGFsbCBjYWxsYmFja3MgaGF2ZSBsb3cgcmF0ZXMuXG5cbiAgICBJdCBpcyBzYWZlIHRvIGRlZmluZSBtdWx0aXBsZSBjYWxsYWJhY2tzIGZvciBhIHNpbmdsZSB2YXJpYWJsZSwgZWFjaFxuICAgIGNhbGxiYWNrIHdpdGggYSBkaWZmZXJlbnQgcG9sbGluZyBmcmVxdWVuY3kuXG5cbiAgICBvcHRpb25zXG4gICAgICAgIDxyYXRlPiAtIGRlZmF1bHQgNTA6IHNwZWNpZnkgbWluaW11bSBmcmVxdWVuY3kgaW4gbXNcblxuKi9cblxuXG5jb25zdCBSQVRFX01TID0gNTBcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVElNRU9VVCBNT05JVE9SXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgQmFzZSBjbGFzcyBmb3IgVGltZW91dCBNb25pdG9yIGFuZCBGcmFtZXJhdGUgTW9uaXRvclxuKi9cblxuY2xhc3MgVGltZW91dE1vbml0b3Ige1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuXG4gICAgICAgIHRoaXMuX29wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtyYXRlOiBSQVRFX01TfSwgb3B0aW9ucyk7XG4gICAgICAgIGlmICh0aGlzLl9vcHRpb25zLnJhdGUgPCBSQVRFX01TKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlsbGVnYWwgcmF0ZSAke3JhdGV9LCBtaW5pbXVtIHJhdGUgaXMgJHtSQVRFX01TfWApO1xuICAgICAgICB9XG4gICAgICAgIC8qXG4gICAgICAgICAgICBtYXBcbiAgICAgICAgICAgIGhhbmRsZSAtPiB7Y2FsbGJhY2ssIHZhcmlhYmxlLCBkZWxheX1cbiAgICAgICAgICAgIC0gdmFyaWFibGU6IHRhcmdldCBmb3Igc2FtcGxpbmdcbiAgICAgICAgICAgIC0gY2FsbGJhY2s6IGZ1bmN0aW9uKHZhbHVlKVxuICAgICAgICAgICAgLSBkZWxheTogYmV0d2VlbiBzYW1wbGVzICh3aGVuIHZhcmlhYmxlIGlzIGR5bmFtaWMpXG4gICAgICAgICovXG4gICAgICAgIHRoaXMuX3NldCA9IG5ldyBTZXQoKTtcbiAgICAgICAgLypcbiAgICAgICAgICAgIHZhcmlhYmxlIG1hcFxuICAgICAgICAgICAgdmFyaWFibGUgLT4ge3N1YiwgcG9sbGluZywgaGFuZGxlczpbXX1cbiAgICAgICAgICAgIC0gc3ViIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICAgICAgICAgLSBwb2xsaW5nOiB0cnVlIGlmIHZhcmlhYmxlIG5lZWRzIHBvbGxpbmdcbiAgICAgICAgICAgIC0gaGFuZGxlczogbGlzdCBvZiBoYW5kbGVzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIC8vIHZhcmlhYmxlIGNoYW5nZSBoYW5kbGVyXG4gICAgICAgIHRoaXMuX19vbnZhcmlhYmxlY2hhbmdlID0gdGhpcy5fb252YXJpYWJsZWNoYW5nZS5iaW5kKHRoaXMpO1xuICAgIH1cblxuICAgIGJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgICAgICAvLyByZWdpc3RlciBiaW5kaW5nXG4gICAgICAgIGxldCBoYW5kbGUgPSB7Y2FsbGJhY2ssIHZhcmlhYmxlLCBkZWxheX07XG4gICAgICAgIHRoaXMuX3NldC5hZGQoaGFuZGxlKTtcbiAgICAgICAgLy8gcmVnaXN0ZXIgdmFyaWFibGVcbiAgICAgICAgaWYgKCF0aGlzLl92YXJpYWJsZV9tYXAuaGFzKHZhcmlhYmxlKSkge1xuICAgICAgICAgICAgbGV0IHN1YiA9IHZhcmlhYmxlLm9uKFwiY2hhbmdlXCIsIHRoaXMuX19vbnZhcmlhYmxlY2hhbmdlKTtcbiAgICAgICAgICAgIGxldCBpdGVtID0ge3N1YiwgcG9sbGluZzpmYWxzZSwgaGFuZGxlczogW2hhbmRsZV19O1xuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLnNldCh2YXJpYWJsZSwgaXRlbSk7XG4gICAgICAgICAgICAvL3RoaXMuX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKS5oYW5kbGVzLnB1c2goaGFuZGxlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaGFuZGxlO1xuICAgIH1cblxuICAgIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgICAgIC8vIGNsZWFudXBcbiAgICAgICAgbGV0IHJlbW92ZWQgPSB0aGlzLl9zZXQuZGVsZXRlKGhhbmRsZSk7XG4gICAgICAgIGlmICghcmVtb3ZlZCkgcmV0dXJuO1xuICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjbGVhbnVwIHZhcmlhYmxlIG1hcFxuICAgICAgICBsZXQgdmFyaWFibGUgPSBoYW5kbGUudmFyaWFibGU7XG4gICAgICAgIGxldCB7c3ViLCBoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQgaWR4ID0gaGFuZGxlcy5pbmRleE9mKGhhbmRsZSk7XG4gICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgaGFuZGxlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGFuZGxlcy5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgLy8gdmFyaWFibGUgaGFzIG5vIGhhbmRsZXNcbiAgICAgICAgICAgIC8vIGNsZWFudXAgdmFyaWFibGUgbWFwXG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuZGVsZXRlKHZhcmlhYmxlKTtcbiAgICAgICAgICAgIHZhcmlhYmxlLm9mZihzdWIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgdmFyaWFibGUgZW1pdHMgYSBjaGFuZ2UgZXZlbnRcbiAgICAqL1xuICAgIF9vbnZhcmlhYmxlY2hhbmdlIChlQXJnLCBlSW5mbykge1xuICAgICAgICBsZXQgdmFyaWFibGUgPSBlSW5mby5zcmM7XG4gICAgICAgIC8vIGRpcmVjdCBjYWxsYmFjayAtIGNvdWxkIHVzZSBlQXJnIGhlcmVcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQgc3RhdGUgPSBlQXJnO1xuICAgICAgICAvLyByZWV2YWx1YXRlIHBvbGxpbmdcbiAgICAgICAgdGhpcy5fcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlLCBzdGF0ZSk7XG4gICAgICAgIC8vIGNhbGxiYWNrc1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHN0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHN0YXJ0IG9yIHN0b3AgcG9sbGluZyBpZiBuZWVkZWRcbiAgICAqL1xuICAgIF9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUsIHN0YXRlKSB7XG4gICAgICAgIGxldCBpdGVtID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCB7cG9sbGluZzp3YXNfcG9sbGluZ30gPSBpdGVtO1xuICAgICAgICBzdGF0ZSA9IHN0YXRlIHx8IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgIGxldCBzaG91bGRfYmVfcG9sbGluZyA9IHN0YXRlLmR5bmFtaWM7XG4gICAgICAgIGlmICghd2FzX3BvbGxpbmcgJiYgc2hvdWxkX2JlX3BvbGxpbmcpIHtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dHModmFyaWFibGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHdhc19wb2xsaW5nICYmICFzaG91bGRfYmVfcG9sbGluZykge1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBzZXQgdGltZW91dCBmb3IgYWxsIGNhbGxiYWNrcyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAqL1xuICAgIF9zZXRfdGltZW91dHModmFyaWFibGUpIHtcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9zZXRfdGltZW91dChoYW5kbGUpIHtcbiAgICAgICAgbGV0IGRlbHRhID0gdGhpcy5fY2FsY3VsYXRlX2RlbHRhKGhhbmRsZS5kZWxheSk7XG4gICAgICAgIGxldCBoYW5kbGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlX3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBoYW5kbGUudGlkID0gc2V0VGltZW91dChoYW5kbGVyLCBkZWx0YSk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgYWRqdXN0IGRlbGF5IHNvIHRoYXQgaWYgZmFsbHMgb25cbiAgICAgICAgdGhlIG1haW4gdGljayByYXRlXG4gICAgKi9cbiAgICBfY2FsY3VsYXRlX2RlbHRhKGRlbGF5KSB7XG4gICAgICAgIGxldCByYXRlID0gdGhpcy5fb3B0aW9ucy5yYXRlO1xuICAgICAgICBsZXQgbm93ID0gTWF0aC5yb3VuZChwZXJmb3JtYW5jZS5ub3coKSk7XG4gICAgICAgIGxldCBbbm93X24sIG5vd19yXSA9IGRpdm1vZChub3csIHJhdGUpO1xuICAgICAgICBsZXQgW24sIHJdID0gZGl2bW9kKG5vdyArIGRlbGF5LCByYXRlKTtcbiAgICAgICAgbGV0IHRhcmdldCA9IE1hdGgubWF4KG4sIG5vd19uICsgMSkqcmF0ZTtcbiAgICAgICAgcmV0dXJuIHRhcmdldCAtIHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGNsZWFyIGFsbCB0aW1lb3V0cyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAqL1xuICAgIF9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSkge1xuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICBpZiAoaGFuZGxlLnRpZCAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoaGFuZGxlLnRpZCk7XG4gICAgICAgICAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGhhbmRsZSB0aW1lb3V0XG4gICAgKi9cbiAgICBfaGFuZGxlX3RpbWVvdXQoaGFuZGxlKSB7XG4gICAgICAgIC8vIGRyb3AgaWYgaGFuZGxlIHRpZCBoYXMgYmVlbiBjbGVhcmVkXG4gICAgICAgIGlmIChoYW5kbGUudGlkID09IHVuZGVmaW5lZCkgcmV0dXJuO1xuICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjYWxsYmFja1xuICAgICAgICBsZXQge3ZhcmlhYmxlfSA9IGhhbmRsZTtcbiAgICAgICAgbGV0IHN0YXRlID0gdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgLy8gcmVzY2hlZHVsZSB0aW1lb3V0cyBmb3IgY2FsbGJhY2tzXG4gICAgICAgIGlmIChzdGF0ZS5keW5hbWljKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICBtYWtlIHN1cmUgcG9sbGluZyBzdGF0ZSBpcyBhbHNvIGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcyB3b3VsZCBvbmx5IG9jY3VyIGlmIHRoZSB2YXJpYWJsZVxuICAgICAgICAgICAgICAgIHdlbnQgZnJvbSByZXBvcnRpbmcgZHluYW1pYyB0cnVlIHRvIGR5bmFtaWMgZmFsc2UsXG4gICAgICAgICAgICAgICAgd2l0aG91dCBlbW1pdHRpbmcgYSBjaGFuZ2UgZXZlbnQgLSB0aHVzXG4gICAgICAgICAgICAgICAgdmlvbGF0aW5nIHRoZSBhc3N1bXB0aW9uLiBUaGlzIHByZXNlcnZlc1xuICAgICAgICAgICAgICAgIGludGVybmFsIGludGVncml0eSBpIHRoZSBtb25pdG9yLlxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGxldCBpdGVtID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICAvL1xuICAgICAgICBoYW5kbGUuY2FsbGJhY2soc3RhdGUpO1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBGUkFNRVJBVEUgTU9OSVRPUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5cbmNsYXNzIEZyYW1lcmF0ZU1vbml0b3IgZXh0ZW5kcyBUaW1lb3V0TW9uaXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgICB0aGlzLl9oYW5kbGU7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgdGltZW91dHMgYXJlIG9ic29sZXRlXG4gICAgKi9cbiAgICBfc2V0X3RpbWVvdXRzKHZhcmlhYmxlKSB7fVxuICAgIF9zZXRfdGltZW91dChoYW5kbGUpIHt9XG4gICAgX2NhbGN1bGF0ZV9kZWx0YShkZWxheSkge31cbiAgICBfY2xlYXJfdGltZW91dHModmFyaWFibGUpIHt9XG4gICAgX2hhbmRsZV90aW1lb3V0KGhhbmRsZSkge31cblxuICAgIF9vbnZhcmlhYmxlY2hhbmdlIChlQXJnLCBlSW5mbykge1xuICAgICAgICBzdXBlci5fb252YXJpYWJsZWNoYW5nZShlQXJnLCBlSW5mbyk7XG4gICAgICAgIC8vIGtpY2sgb2ZmIGNhbGxiYWNrIGxvb3AgZHJpdmVuIGJ5IHJlcXVlc3QgYW5pbWF0aW9uZnJhbWVcbiAgICAgICAgdGhpcy5fY2FsbGJhY2soKTtcbiAgICB9XG5cbiAgICBfY2FsbGJhY2soKSB7XG4gICAgICAgIC8vIGNhbGxiYWNrIHRvIGFsbCB2YXJpYWJsZXMgd2hpY2ggcmVxdWlyZSBwb2xsaW5nXG4gICAgICAgIGxldCB2YXJpYWJsZXMgPSBbLi4udGhpcy5fdmFyaWFibGVfbWFwLmVudHJpZXMoKV1cbiAgICAgICAgICAgIC5maWx0ZXIoKFt2YXJpYWJsZSwgaXRlbV0pID0+IGl0ZW0ucG9sbGluZylcbiAgICAgICAgICAgIC5tYXAoKFt2YXJpYWJsZSwgaXRlbV0pID0+IHZhcmlhYmxlKTtcbiAgICAgICAgaWYgKHZhcmlhYmxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBjYWxsYmFja1xuICAgICAgICAgICAgZm9yIChsZXQgdmFyaWFibGUgb2YgdmFyaWFibGVzKSB7XG4gICAgICAgICAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICAgICAgICAgIGxldCByZXMgPSB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZS5jYWxsYmFjayhyZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8qIFxuICAgICAgICAgICAgICAgIHJlcXVlc3QgbmV4dCBjYWxsYmFjayBhcyBsb25nIGFzIGF0IGxlYXN0IG9uZSB2YXJpYWJsZSBcbiAgICAgICAgICAgICAgICBpcyByZXF1aXJpbmcgcG9sbGluZ1xuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLl9jYWxsYmFjay5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQklORCBSRUxFQVNFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmNvbnN0IG1vbml0b3IgPSBuZXcgVGltZW91dE1vbml0b3IoKTtcbmNvbnN0IGZyYW1lcmF0ZV9tb25pdG9yID0gbmV3IEZyYW1lcmF0ZU1vbml0b3IoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgIGxldCBoYW5kbGU7XG4gICAgaWYgKEJvb2xlYW4ocGFyc2VGbG9hdChkZWxheSkpKSB7XG4gICAgICAgIGhhbmRsZSA9IG1vbml0b3IuYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIFtcInRpbWVvdXRcIiwgaGFuZGxlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBoYW5kbGUgPSBmcmFtZXJhdGVfbW9uaXRvci5iaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgMCwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBbXCJmcmFtZXJhdGVcIiwgaGFuZGxlXTtcbiAgICB9XG59XG5leHBvcnQgZnVuY3Rpb24gcmVsZWFzZShoYW5kbGUpIHtcbiAgICBsZXQgW3R5cGUsIF9oYW5kbGVdID0gaGFuZGxlO1xuICAgIGlmICh0eXBlID09IFwidGltZW91dFwiKSB7XG4gICAgICAgIHJldHVybiBtb25pdG9yLnJlbGVhc2UoX2hhbmRsZSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwiZnJhbWVyYXRlXCIpIHtcbiAgICAgICAgcmV0dXJuIGZyYW1lcmF0ZV9tb25pdG9yLnJlbGVhc2UoX2hhbmRsZSk7XG4gICAgfVxufVxuXG4iLCJpbXBvcnQgeyBldmVudGlmeSB9IGZyb20gXCIuL2V2ZW50aWZ5LmpzXCI7XG5pbXBvcnQgeyBjYWxsYmFjayB9IGZyb20gXCIuL3V0aWwuanNcIjtcbmltcG9ydCB7IGJpbmQsIHJlbGVhc2UgfSBmcm9tIFwiLi9tb25pdG9yLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIFNPVVJDRSBCQVNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEJhc2UgY2xhc3MgZm9yIGVudGl0aWVzIHdoaWNoIGNhbiBiZSB1c2VkIGFzIHNvdXJjZVxuICogXG4gKiBJbXBsZW1lbnQgdGhlIGNhbGxiYWNrIGludGVyZmFjZS5cbiAqL1xuXG5cbmV4cG9ydCBjbGFzcyBTb3VyY2VCYXNlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShTb3VyY2VCYXNlLnByb3RvdHlwZSk7XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTVEFURSBQUk9WSURFUiBCQVNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIEJhc2UgY2xhc3MgZm9yIGFsbCBzdGF0ZSBwcm92aWRlcnNcblxuICAgIC0gb2JqZWN0IHdpdGggY29sbGVjdGlvbiBvZiBpdGVtc1xuICAgIC0gY291bGQgYmUgbG9jYWwgLSBvciBwcm94eSB0byBvbmxpbmUgc291cmNlXG5cbiAgICByZXByZXNlbnRzIGEgZHluYW1pYyBjb2xsZWN0aW9uIG9mIGl0ZW1zXG4gICAge2ludGVydmFsLCAuLi5kYXRhfVxuKi9cblxuZXhwb3J0IGNsYXNzIFN0YXRlUHJvdmlkZXJCYXNlIGV4dGVuZHMgU291cmNlQmFzZSB7XG5cbiAgICAvLyBwdWJsaWMgdXBkYXRlIGZ1bmN0aW9uXG4gICAgdXBkYXRlKGl0ZW1zKXtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3VwZGF0ZShpdGVtcyk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBoYW5kbGVfdXBkYXRlKGl0ZW1zKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICBnZXQgaXRlbXMoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUiBCQVNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJCYXNlIGV4dGVuZHMgU291cmNlQmFzZSB7XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFFVRVJZXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBxdWVyeSAob2Zmc2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUiBCQVNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgQ3Vyc29yQmFzZSBleHRlbmRzIFNvdXJjZUJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIC8vIGRlZmluZSBjaGFuZ2UgZXZlbnRcbiAgICAgICAgZXZlbnRpZnkuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5ldmVudGlmeURlZmluZShcImNoYW5nZVwiLCB7aW5pdDp0cnVlfSk7XG4gICAgfVxuICAgIFxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUllcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIHF1ZXJ5ICgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIEV2ZW50aWZ5OiBpbW1lZGlhdGUgZXZlbnRzXG4gICAgKi9cbiAgICBldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuICAgICAgICBpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG4gICAgICAgICAgICByZXR1cm4gW3RoaXMucXVlcnkoKV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIEJJTkQgUkVMRUFTRSAoY29udmVuaWVuY2UpXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBiaW5kKGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgICAgICByZXR1cm4gYmluZCh0aGlzLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnMpO1xuICAgIH1cbiAgICByZWxlYXNlKGhhbmRsZSkge1xuICAgICAgICByZXR1cm4gcmVsZWFzZShoYW5kbGUpO1xuICAgIH1cblxufVxuZXZlbnRpZnkuYWRkVG9Qcm90b3R5cGUoQ3Vyc29yQmFzZS5wcm90b3R5cGUpO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTkVBUkJZIElOREVYIEJBU0VcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBBYnN0cmFjdCBzdXBlcmNsYXNzIGZvciBOZWFyYnlJbmRleGUuXG4gKiBcbiAqIFN1cGVyY2xhc3MgdXNlZCB0byBjaGVjayB0aGF0IGEgY2xhc3MgaW1wbGVtZW50cyB0aGUgbmVhcmJ5KCkgbWV0aG9kLCBcbiAqIGFuZCBwcm92aWRlIHNvbWUgY29udmVuaWVuY2UgbWV0aG9kcy5cbiAqIFxuICogTkVBUkJZIElOREVYXG4gKiBcbiAqIE5lYXJieUluZGV4IHByb3ZpZGVzIGluZGV4aW5nIHN1cHBvcnQgb2YgZWZmZWN0aXZlbHlsb29raW5nIHVwIElURU1TIGJ5IG9mZnNldCwgXG4gKiBnaXZlbiB0aGF0XG4gKiAoaSkgZWFjaCBlbnRyaXkgaXMgYXNzb2NpYXRlZCB3aXRoIGFuIGludGVydmFsIGFuZCxcbiAqIChpaSkgZW50cmllcyBhcmUgbm9uLW92ZXJsYXBwaW5nLlxuICogRWFjaCBJVEVNIG11c3QgYmUgYXNzb2NpYXRlZCB3aXRoIGFuIGludGVydmFsIG9uIHRoZSB0aW1lbGluZSBcbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgYXJvdW5kIGVuZHBvaW50LiBcbiAqIFxuICogUHJpbWFyeSB1c2UgaXMgZm9yIGl0ZXJhdGlvbiBcbiAqIFxuICogUmV0dXJucyB7XG4gKiAgICAgIGNlbnRlcjogbGlzdCBvZiBJVEVNUyBjb3ZlcmluZyBlbmRwb2ludCxcbiAqICAgICAgaW50ZXJ2YWw6IGludGVydmFsIHdoZXJlIG5lYXJieSByZXR1cm5zIGlkZW50aWNhbCB7Y2VudGVyfVxuICogICAgICBsZWZ0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIGxlZnQgXG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBoaWdoLWVuZHBvaW50IG9yIHVuZGVmaW5lZFxuICogICAgICByaWdodDpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSByaWdodFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgbG93LWVuZHBvaW50IG9yIHVuZGVmaW5lZCAgICAgICAgIFxuICogICAgICBwcmV2OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIGxlZnQgXG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50ICYmIG5vbi1lbXB0eSB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgaGlnaC1lbmRwb2ludCBvciB1bmRlZmluZWQgaWYgbm8gbW9yZSBpbnRlcnZhbHMgdG8gdGhlIGxlZnRcbiAqICAgICAgbmV4dDpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSByaWdodFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCAmJiBub24tZW1wdHkge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGxvdy1lbmRwb2ludCBvciB1bmRlZmluZWQgaWYgbm8gbW9yZSBpbnRlcnZhbHMgdG8gdGhlIHJpZ2h0XG4gKiB9XG4gKiBcbiAqIFxuICogVGhlIG5lYXJieSBzdGF0ZSBpcyB3ZWxsLWRlZmluZWQgZm9yIGV2ZXJ5IHRpbWVsaW5lIHBvc2l0aW9uLlxuICogXG4gKiBcbiAqIE5PVEUgbGVmdC9yaWdodCBhbmQgcHJldi9uZXh0IGFyZSBtb3N0bHkgdGhlIHNhbWUuIFRoZSBvbmx5IGRpZmZlcmVuY2UgaXMgXG4gKiB0aGF0IHByZXYvbmV4dCB3aWxsIHNraXAgb3ZlciByZWdpb25zIHdoZXJlIHRoZXJlIGFyZSBubyBpbnRlcnZhbHMuIFRoaXNcbiAqIGVuc3VyZXMgcHJhY3RpY2FsIGl0ZXJhdGlvbiBvZiBpdGVtcyBhcyBwcmV2L25leHQgd2lsbCBvbmx5IGJlIHVuZGVmaW5lZCAgXG4gKiBhdCB0aGUgZW5kIG9mIGl0ZXJhdGlvbi5cbiAqIFxuICogSU5URVJWQUxTXG4gKiBcbiAqIFtsb3csIGhpZ2gsIGxvd0luY2x1c2l2ZSwgaGlnaEluY2x1c2l2ZV1cbiAqIFxuICogVGhpcyByZXByZXNlbnRhdGlvbiBlbnN1cmVzIHRoYXQgdGhlIGludGVydmFsIGVuZHBvaW50cyBhcmUgb3JkZXJlZCBhbmQgYWxsb3dzXG4gKiBpbnRlcnZhbHMgdG8gYmUgZXhjbHVzaXZlIG9yIGluY2x1c2l2ZSwgeWV0IGNvdmVyIHRoZSBlbnRpcmUgcmVhbCBsaW5lIFxuICogXG4gKiBbYSxiXSwgKGEsYiksIFthLGIpLCBbYSwgYikgYXJlIGFsbCB2YWxpZCBpbnRlcnZhbHNcbiAqIFxuICogXG4gKiBJTlRFUlZBTCBFTkRQT0lOVFNcbiAqIFxuICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gKiBcbiAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gKiBcbiAqIC8gKi9cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICB9XG5cbiAgICB1cGRhdGUgKGl0ZW1zKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKiBcbiAgICAgICAgTmVhcmJ5IG1ldGhvZFxuICAgICovXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShOZWFyYnlJbmRleEJhc2UucHJvdG90eXBlKTtcblxuIiwiaW1wb3J0IHtTdGF0ZVByb3ZpZGVyQmFzZX0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7ZW5kcG9pbnR9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU0lNUExFIFNUQVRFIFBST1ZJREVSIChMT0NBTClcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMb2NhbCBBcnJheSB3aXRoIG5vbiBvdmVybGFwcGluZyBpdGVtcy5cbiAqL1xuXG5leHBvcnQgY2xhc3MgU2ltcGxlU3RhdGVQcm92aWRlciBleHRlbmRzIFN0YXRlUHJvdmlkZXJCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBbXTtcbiAgICAgICAgbGV0IHtpdGVtc30gPSBvcHRpb25zO1xuICAgICAgICBpZiAoaXRlbXMpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlX3VwZGF0ZShpdGVtcyk7ICBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGludGVybmFsIHVwZGF0ZSBmdW5jdGlvblxuICAgIF91cGRhdGUgKGl0ZW1zKSB7XG4gICAgICAgIHRoaXMuX2l0ZW1zID0gY2hlY2tfaW5wdXQoaXRlbXMpO1xuICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICB9XG5cbiAgICBnZXQgaXRlbXMgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXRlbXM7XG4gICAgfVxuXG4gICAgZ2V0IGluZm8gKCkge1xuICAgICAgICByZXR1cm4ge2R5bmFtaWM6IHRydWUsIG92ZXJsYXBwaW5nOiBmYWxzZSwgbG9jYWw6dHJ1ZX07XG4gICAgfVxufVxuXG5cbmZ1bmN0aW9uIGNoZWNrX2lucHV0KGl0ZW1zKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnB1dCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgIH1cbiAgICAvLyBzb3J0IGl0ZW1zIGJhc2VkIG9uIGludGVydmFsIGxvdyBlbmRwb2ludFxuICAgIGl0ZW1zLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgbGV0IGFfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChhLmludGVydmFsKVswXTtcbiAgICAgICAgbGV0IGJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChiLmludGVydmFsKVswXTtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmNtcChhX2xvdywgYl9sb3cpO1xuICAgIH0pO1xuICAgIC8vIGNoZWNrIHRoYXQgaXRlbSBpbnRlcnZhbHMgYXJlIG5vbi1vdmVybGFwcGluZ1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IHByZXZfaGlnaCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaSAtIDFdLmludGVydmFsKVsxXTtcbiAgICAgICAgbGV0IGN1cnJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpXS5pbnRlcnZhbClbMF07XG4gICAgICAgIC8vIHZlcmlmeSB0aGF0IHByZXYgaGlnaCBpcyBsZXNzIHRoYXQgY3VyciBsb3dcbiAgICAgICAgaWYgKCFlbmRwb2ludC5sdChwcmV2X2hpZ2gsIGN1cnJfbG93KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT3ZlcmxhcHBpbmcgaW50ZXJ2YWxzIGZvdW5kXCIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuIiwiaW1wb3J0IHtOZWFyYnlJbmRleEJhc2V9IGZyb20gXCIuL2Jhc2VzLmpzXCI7XG5pbXBvcnQge2ludGVydmFsLCBlbmRwb2ludH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cbi8qKlxuICogXG4gKiBOZWFyYnkgSW5kZXggU2ltcGxlXG4gKiBcbiAqIC0gaXRlbXMgYXJlIGFzc3VtZWQgdG8gYmUgbm9uLW92ZXJsYXBwaW5nIG9uIHRoZSB0aW1lbGluZSwgXG4gKiAtIGltcGx5aW5nIHRoYXQgbmVhcmJ5LmNlbnRlciB3aWxsIGJlIGEgbGlzdCBvZiBhdCBtb3N0IG9uZSBJVEVNLiBcbiAqIC0gZXhjZXB0aW9uIHdpbGwgYmUgcmFpc2VkIGlmIG92ZXJsYXBwaW5nIElURU1TIGFyZSBmb3VuZFxuICogLSBJVEVNUyBpcyBhc3N1bWJlZCB0byBiZSBpbW11dGFibGUgYXJyYXkgLSBjaGFuZ2UgSVRFTVMgYnkgcmVwbGFjaW5nIGFycmF5XG4gKiBcbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgYXJvdW5kIG9mZnNldC4gXG4gKiBcbiAqIFJldHVybnMge1xuICogICAgICBsZWZ0IC0gaGlnaCBpbnRlcnZhbCBlbmRwb2ludCBvZiB0aGUgZmlyc3QgSVRFTSB0byB0aGUgbGVmdCB3aGljaCBkb2VzIG5vdCBjb3ZlciBvZmZzZXQsIGVsc2UgdW5kZWZpbmVkXG4gKiAgICAgIGNlbnRlciAtIGxpc3Qgb2YgSVRFTVMgY292ZXJpbmcgb2Zmc2V0LCBlbHNlIFtdXG4gKiAgICAgIHJpZ2h0IC0gbG93IGludGVydmFsIGVuZHBvaW50IG9mIHRoZSBmaXJzdCBJVEVNIHRvIHRoZSByaWdodCB3aGljaCBkb2VzIG5vdCBjb3ZlciBvZmZzZXQsIGVsc2UgdW5kZWZpbmVkXG4gKiB9XG4gKiBcbiAqL1xuXG5cbi8vIGdldCBpbnRlcnZhbCBsb3cgcG9pbnRcbmZ1bmN0aW9uIGdldF9sb3dfdmFsdWUoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLmludGVydmFsWzBdO1xufVxuXG4vLyBnZXQgaW50ZXJ2YWwgbG93IGVuZHBvaW50XG5mdW5jdGlvbiBnZXRfbG93X2VuZHBvaW50KGl0ZW0pIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLmludGVydmFsKVswXVxufVxuXG4vLyBnZXQgaW50ZXJ2YWwgaGlnaCBlbmRwb2ludFxuZnVuY3Rpb24gZ2V0X2hpZ2hfZW5kcG9pbnQoaXRlbSkge1xuICAgIHJldHVybiBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW0uaW50ZXJ2YWwpWzFdXG59XG5cblxuZXhwb3J0IGNsYXNzIFNpbXBsZU5lYXJieUluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBbXTtcbiAgICAgICAgbGV0IHtpdGVtc30gPSBvcHRpb25zO1xuICAgICAgICBpZiAoaXRlbXMpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlKGl0ZW1zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZSAoaXRlbXMpIHtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBjaGVja19pbnB1dChpdGVtcylcbiAgICB9XG5cblxuICAgIC8qXG4gICAgICAgIG5lYXJieSBieSBvZmZzZXRcbiAgICAgICAgXG4gICAgICAgIHJldHVybnMge2xlZnQsIGNlbnRlciwgcmlnaHR9XG5cbiAgICAgICAgYmluYXJ5IHNlYXJjaCBiYXNlZCBvbiBvZmZzZXRcbiAgICAgICAgMSkgZm91bmQsIGlkeFxuICAgICAgICAgICAgb2Zmc2V0IG1hdGNoZXMgdmFsdWUgb2YgaW50ZXJ2YWwubG93IG9mIGFuIGl0ZW1cbiAgICAgICAgICAgIGlkeCBnaXZlcyB0aGUgaW5kZXggb2YgdGhpcyBpdGVtIGluIHRoZSBhcnJheVxuICAgICAgICAyKSBub3QgZm91bmQsIGlkeFxuICAgICAgICAgICAgb2Zmc2V0IGlzIGVpdGhlciBjb3ZlcmVkIGJ5IGl0ZW0gYXQgKGlkeC0xKSxcbiAgICAgICAgICAgIG9yIGl0IGlzIG5vdCA9PiBiZXR3ZWVuIGVudHJpZXNcbiAgICAgICAgICAgIGluIHRoaXMgY2FzZSAtIGlkeCBnaXZlcyB0aGUgaW5kZXggd2hlcmUgYW4gaXRlbVxuICAgICAgICAgICAgc2hvdWxkIGJlIGluc2VydGVkIC0gaWYgaXQgaGFkIGxvdyA9PSBvZmZzZXRcbiAgICAqL1xuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvZmZzZXQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBbb2Zmc2V0LCAwXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkob2Zmc2V0KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW5kcG9pbnQgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgICAgICBjZW50ZXI6IFtdLFxuICAgICAgICAgICAgaW50ZXJ2YWw6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIGxlZnQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHJpZ2h0OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBwcmV2OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBuZXh0OiB1bmRlZmluZWRcbiAgICAgICAgfTtcbiAgICAgICAgbGV0IGl0ZW1zID0gdGhpcy5faXRlbXM7XG4gICAgICAgIGxldCBpbmRleGVzLCBpdGVtO1xuICAgICAgICBjb25zdCBzaXplID0gaXRlbXMubGVuZ3RoO1xuICAgICAgICBpZiAoc2l6ZSA9PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0OyBcbiAgICAgICAgfVxuICAgICAgICBsZXQgW2ZvdW5kLCBpZHhdID0gZmluZF9pbmRleChvZmZzZXRbMF0sIGl0ZW1zLCBnZXRfbG93X3ZhbHVlKTtcbiAgICAgICAgaWYgKGZvdW5kKSB7XG4gICAgICAgICAgICAvLyBzZWFyY2ggb2Zmc2V0IG1hdGNoZXMgaXRlbSBsb3cgZXhhY3RseVxuICAgICAgICAgICAgLy8gY2hlY2sgdGhhdCBpdCBpbmRlZWQgY292ZXJlZCBieSBpdGVtIGludGVydmFsXG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4XVxuICAgICAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19lbmRwb2ludChpdGVtLmludGVydmFsLCBvZmZzZXQpKSB7XG4gICAgICAgICAgICAgICAgaW5kZXhlcyA9IHtsZWZ0OmlkeC0xLCBjZW50ZXI6aWR4LCByaWdodDppZHgrMX07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGluZGV4ZXMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBjaGVjayBwcmV2IGl0ZW1cbiAgICAgICAgICAgIGl0ZW0gPSBpdGVtc1tpZHgtMV07XG4gICAgICAgICAgICBpZiAoaXRlbSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiBzZWFyY2ggb2Zmc2V0IGlzIGNvdmVyZWQgYnkgaXRlbSBpbnRlcnZhbFxuICAgICAgICAgICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfZW5kcG9pbnQoaXRlbS5pbnRlcnZhbCwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTIsIGNlbnRlcjppZHgtMSwgcmlnaHQ6aWR4fTtcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgfVxuICAgICAgICB9XHRcbiAgICAgICAgaWYgKGluZGV4ZXMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBwcmV2IGl0ZW0gZWl0aGVyIGRvZXMgbm90IGV4aXN0IG9yIGlzIG5vdCByZWxldmFudFxuICAgICAgICAgICAgaW5kZXhlcyA9IHtsZWZ0OmlkeC0xLCBjZW50ZXI6LTEsIHJpZ2h0OmlkeH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjZW50ZXJcbiAgICAgICAgaWYgKDAgPD0gaW5kZXhlcy5jZW50ZXIgJiYgaW5kZXhlcy5jZW50ZXIgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQuY2VudGVyID0gIFtpdGVtc1tpbmRleGVzLmNlbnRlcl1dO1xuICAgICAgICB9XG4gICAgICAgIC8vIHByZXYvbmV4dFxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLmxlZnQgJiYgaW5kZXhlcy5sZWZ0IDwgc2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0LnByZXYgPSAgZ2V0X2hpZ2hfZW5kcG9pbnQoaXRlbXNbaW5kZXhlcy5sZWZ0XSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKDAgPD0gaW5kZXhlcy5yaWdodCAmJiBpbmRleGVzLnJpZ2h0IDwgc2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0Lm5leHQgPSAgZ2V0X2xvd19lbmRwb2ludChpdGVtc1tpbmRleGVzLnJpZ2h0XSk7XG4gICAgICAgIH0gICAgICAgIFxuICAgICAgICAvLyBsZWZ0L3JpZ2h0XG4gICAgICAgIGxldCBsb3csIGhpZ2g7XG4gICAgICAgIGlmIChyZXN1bHQuY2VudGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxldCBpdHYgPSByZXN1bHQuY2VudGVyWzBdLmludGVydmFsO1xuICAgICAgICAgICAgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0dik7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IChsb3dbMF0gPiAtSW5maW5pdHkpID8gZW5kcG9pbnQuZmxpcChsb3csIFwiaGlnaFwiKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IChoaWdoWzBdIDwgSW5maW5pdHkpID8gZW5kcG9pbnQuZmxpcChoaWdoLCBcImxvd1wiKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VsdC5pbnRlcnZhbCA9IHJlc3VsdC5jZW50ZXJbMF0uaW50ZXJ2YWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IHJlc3VsdC5wcmV2O1xuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gcmVzdWx0Lm5leHQ7XG4gICAgICAgICAgICAvLyBpbnRlcnZhbFxuICAgICAgICAgICAgbGV0IGxlZnQgPSByZXN1bHQubGVmdDtcbiAgICAgICAgICAgIGxvdyA9IChsZWZ0ID09IHVuZGVmaW5lZCkgPyBbLUluZmluaXR5LCAwXSA6IGVuZHBvaW50LmZsaXAobGVmdCwgXCJsb3dcIik7XG4gICAgICAgICAgICBsZXQgcmlnaHQgPSByZXN1bHQucmlnaHQ7XG4gICAgICAgICAgICBoaWdoID0gKHJpZ2h0ID09IHVuZGVmaW5lZCkgPyBbSW5maW5pdHksIDBdIDogZW5kcG9pbnQuZmxpcChyaWdodCwgXCJoaWdoXCIpO1xuICAgICAgICAgICAgcmVzdWx0LmludGVydmFsID0gaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG5cdFVUSUxTXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuLy8gY2hlY2sgaW5wdXRcbmZ1bmN0aW9uIGNoZWNrX2lucHV0KGl0ZW1zKSB7XG5cbiAgICBpZiAoaXRlbXMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGl0ZW1zID0gW107XG4gICAgfVxuXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnB1dCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgIH1cblxuICAgIC8vIHNvcnQgaXRlbXMgYmFzZWQgb24gaW50ZXJ2YWwgbG93IGVuZHBvaW50XG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBsZXQgYV9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGEuaW50ZXJ2YWwpWzBdO1xuICAgICAgICBsZXQgYl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGIuaW50ZXJ2YWwpWzBdO1xuICAgICAgICByZXR1cm4gZW5kcG9pbnQuY21wKGFfbG93LCBiX2xvdyk7XG4gICAgfSk7XG5cbiAgICAvLyBjaGVjayB0aGF0IGl0ZW0gaW50ZXJ2YWxzIGFyZSBub24tb3ZlcmxhcHBpbmdcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBwcmV2X2hpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2kgLSAxXS5pbnRlcnZhbClbMV07XG4gICAgICAgIGxldCBjdXJyX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaV0uaW50ZXJ2YWwpWzBdO1xuICAgICAgICAvLyB2ZXJpZnkgdGhhdCBwcmV2IGhpZ2ggaXMgbGVzcyB0aGF0IGN1cnIgbG93XG4gICAgICAgIGlmICghZW5kcG9pbnQubHQocHJldl9oaWdoLCBjdXJyX2xvdykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk92ZXJsYXBwaW5nIGludGVydmFscyBmb3VuZFwiKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cblxuLypcblx0YmluYXJ5IHNlYXJjaCBmb3IgZmluZGluZyB0aGUgY29ycmVjdCBpbnNlcnRpb24gaW5kZXggaW50b1xuXHR0aGUgc29ydGVkIGFycmF5IChhc2NlbmRpbmcpIG9mIGl0ZW1zXG5cdFxuXHRhcnJheSBjb250YWlucyBvYmplY3RzLCBhbmQgdmFsdWUgZnVuYyByZXRyZWF2ZXMgYSB2YWx1ZVxuXHRmcm9tIGVhY2ggb2JqZWN0LlxuXG5cdHJldHVybiBbZm91bmQsIGluZGV4XVxuKi9cblxuZnVuY3Rpb24gZmluZF9pbmRleCh0YXJnZXQsIGFyciwgdmFsdWVfZnVuYykge1xuXG4gICAgZnVuY3Rpb24gZGVmYXVsdF92YWx1ZV9mdW5jKGVsKSB7XG4gICAgICAgIHJldHVybiBlbDtcbiAgICB9XG4gICAgXG4gICAgbGV0IGxlZnQgPSAwO1xuXHRsZXQgcmlnaHQgPSBhcnIubGVuZ3RoIC0gMTtcblx0dmFsdWVfZnVuYyA9IHZhbHVlX2Z1bmMgfHwgZGVmYXVsdF92YWx1ZV9mdW5jO1xuXHR3aGlsZSAobGVmdCA8PSByaWdodCkge1xuXHRcdGNvbnN0IG1pZCA9IE1hdGguZmxvb3IoKGxlZnQgKyByaWdodCkgLyAyKTtcblx0XHRsZXQgbWlkX3ZhbHVlID0gdmFsdWVfZnVuYyhhcnJbbWlkXSk7XG5cdFx0aWYgKG1pZF92YWx1ZSA9PT0gdGFyZ2V0KSB7XG5cdFx0XHRyZXR1cm4gW3RydWUsIG1pZF07IC8vIFRhcmdldCBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgYXJyYXlcblx0XHR9IGVsc2UgaWYgKG1pZF92YWx1ZSA8IHRhcmdldCkge1xuXHRcdFx0ICBsZWZ0ID0gbWlkICsgMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIHJpZ2h0XG5cdFx0fSBlbHNlIHtcblx0XHRcdCAgcmlnaHQgPSBtaWQgLSAxOyAvLyBNb3ZlIHNlYXJjaCByYW5nZSB0byB0aGUgbGVmdFxuXHRcdH1cblx0fVxuICBcdHJldHVybiBbZmFsc2UsIGxlZnRdOyAvLyBSZXR1cm4gdGhlIGluZGV4IHdoZXJlIHRhcmdldCBzaG91bGQgYmUgaW5zZXJ0ZWRcbn1cbiIsImltcG9ydCB7IGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgKiBhcyBzZWdtZW50IGZyb20gXCIuL3NlZ21lbnRzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBORUFSQlkgQ0FDSEVcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBUaGlzIGltcGxlbWVudHMgYSBjYWNoZSBpbiBmcm9udCBvZiBhIE5lYXJieUluZGV4LlxuICAgIFxuICAgIFRoZSBwdXJwb3NlIG9mIGNhY2hpbmcgaXMgdG8gb3B0aW1pemUgZm9yIHJlcGVhdGVkXG4gICAgcXVlcmllcyB0byBhIE5lYXJieUluZGV4IHRvIG5lYXJieSBvZmZzZXRzLlxuXG4gICAgVGhlIGNhY2hlIHN0YXRlIGluY2x1ZGVzIHRoZSBuZWFyYnkgc3RhdGUgZnJvbSB0aGUgXG4gICAgaW5kZXgsIGFuZCBhbHNvIHRoZSBjYWNoZWQgc2VnbWVudHMgY29ycmVzcG9uZGluZ1xuICAgIHRvIHRoYXQgc3RhdGUuIFRoaXMgd2F5LCBvbiBhIGNhY2hlIGhpdCwgdGhlIFxuICAgIHF1ZXJ5IG1heSBiZSBzYXRpc2ZpZWQgZGlyZWN0bHkgZnJvbSB0aGUgY2FjaGUuXG5cbiAgICBUaGUgY2FjaGUgaXMgbWFya2VkIGFzIGRpcnR5IHdoZW4gdGhlIE5lYXJieSBpbmRleGVzIGNoYW5nZXMuXG4qL1xuXG5leHBvcnQgY2xhc3MgTmVhcmJ5Q2FjaGUge1xuXG4gICAgY29uc3RydWN0b3IgKG5lYXJieUluZGV4KSB7XG4gICAgICAgIC8vIG5lYXJieSBpbmRleFxuICAgICAgICB0aGlzLl9pbmRleCA9IG5lYXJieUluZGV4O1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IG9iamVjdFxuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhY2hlZCBzZWdtZW50XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGRpcnR5IGZsYWdcbiAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgQWNjZXNzb3JzIGZvciBDYWNoZSBzdGF0ZVxuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBcbiAgICBnZXQgbmVhcmJ5ICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX25lYXJieTtcbiAgICB9XG5cbiAgICBsb2FkX3NlZ21lbnQgKCkge1xuICAgICAgICAvLyBsYXp5IGxvYWQgc2VnbWVudFxuICAgICAgICBpZiAodGhpcy5fbmVhcmJ5ICYmICF0aGlzLl9zZWdtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9zZWdtZW50ID0gbG9hZF9zZWdtZW50KHRoaXMuX25lYXJieSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3NlZ21lbnRcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgRGlydHkgQ2FjaGVcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBkaXJ0eSgpIHtcbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBSZWZyZXNoIENhY2hlXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgLypcbiAgICAgICAgcmVmcmVzaCBpZiBuZWNlc3NhcnkgLSBlbHNlIE5PT1BcbiAgICAgICAgLSBpZiBuZWFyYnkgaXMgbm90IGRlZmluZWRcbiAgICAgICAgLSBpZiBvZmZzZXQgaXMgb3V0c2lkZSBuZWFyYnkuaW50ZXJ2YWxcbiAgICAgICAgLSBpZiBjYWNoZSBpcyBkaXJ0eVxuICAgICovXG4gICAgcmVmcmVzaCAob2Zmc2V0KSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgb2Zmc2V0ID0gW29mZnNldCwgMF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX25lYXJieSA9PSB1bmRlZmluZWQgfHwgdGhpcy5fZGlydHkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWZyZXNoKG9mZnNldCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpbnRlcnZhbC5jb3ZlcnNfZW5kcG9pbnQodGhpcy5fbmVhcmJ5LmludGVydmFsLCBvZmZzZXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVmcmVzaChvZmZzZXQpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIF9yZWZyZXNoIChvZmZzZXQpIHtcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdGhpcy5faW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gZmFsc2U7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBRdWVyeSBDYWNoZVxuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBpZiAob2Zmc2V0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY2FjaGUgcXVlcnkgb2Zmc2V0IGNhbm5vdCBiZSB1bmRlZmluZWRcIilcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlZnJlc2gob2Zmc2V0KTtcbiAgICAgICAgaWYgKCF0aGlzLl9zZWdtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9zZWdtZW50ID0gbG9hZF9zZWdtZW50KHRoaXMuX25lYXJieSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3NlZ21lbnQucXVlcnkob2Zmc2V0KTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTE9BRCBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmZ1bmN0aW9uIGNyZWF0ZV9zZWdtZW50KGludGVydmFsLCB0eXBlLCBhcmdzKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJzdGF0aWNcIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuU3RhdGljU2VnbWVudChpbnRlcnZhbCwgYXJncyk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwidHJhbnNpdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5UcmFuc2l0aW9uU2VnbWVudChpbnRlcnZhbCwgYXJncyk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwiaW50ZXJwb2xhdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5JbnRlcnBvbGF0aW9uU2VnbWVudChpbnRlcnZhbCwgYXJncyk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwibW90aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50Lk1vdGlvblNlZ21lbnQoaW50ZXJ2YWwsIGFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwidW5yZWNvZ25pemVkIHNlZ21lbnQgdHlwZVwiLCB0eXBlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGxvYWRfc2VnbWVudChuZWFyYnkpIHtcbiAgICBsZXQgaXRlbTtcbiAgICBsZXQge2ludGVydmFsOml0diwgY2VudGVyfSA9IG5lYXJieTtcbiAgICBpZiAoY2VudGVyLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVfc2VnbWVudChpdHYsIFwic3RhdGljXCIsIHt2YWx1ZTp1bmRlZmluZWR9KTtcbiAgICB9XG4gICAgaWYgKGNlbnRlci5sZW5ndGggPT0gMSkge1xuICAgICAgICBpdGVtID0gY2VudGVyWzBdO1xuICAgICAgICByZXR1cm4gY3JlYXRlX3NlZ21lbnQoaXR2LCBpdGVtLnR5cGUsIGl0ZW0uYXJncyk7XG4gICAgfVxuICAgIGlmIChjZW50ZXIubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJMaXN0U2VnbWVudHMgbm90IHlldCBzdXBwb3J0ZWRcIik7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgU2ltcGxlTmVhcmJ5SW5kZXggfSBmcm9tIFwiLi9uZWFyYnlpbmRleF9zaW1wbGVcIjtcbmltcG9ydCB7IE5lYXJieUNhY2hlIH0gZnJvbSBcIi4vbmVhcmJ5Y2FjaGVcIjtcblxuZXhwb3J0IGNvbnN0IG5lYXJieSA9IGZ1bmN0aW9uICgpIHtcblxuICAgIGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2Uob2JqZWN0KSB7XG4gICAgICAgIGxldCBpbmRleCA9IG5ldyBTaW1wbGVOZWFyYnlJbmRleCgpO1xuICAgICAgICBvYmplY3QuX19uZWFyYnlfaW5kZXggPSBpbmRleDtcbiAgICAgICAgb2JqZWN0Ll9fbmVhcmJ5X2NhY2hlID0gbmV3IE5lYXJieUNhY2hlKGluZGV4KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB1cGRhdGUoaXRlbXMpIHtcbiAgICAgICAgdGhpcy5fX25lYXJieV9pbmRleC51cGRhdGUoaXRlbXMpO1xuICAgICAgICB0aGlzLl9fbmVhcmJ5X2NhY2hlLmRpcnR5KCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcXVlcnkgKG9mZnNldCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fX25lYXJieV9jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlKF9wcm90b3R5cGUpIHtcbiAgICAgICAgY29uc3QgYXBpID0ge307XG4gICAgICAgIGFwaVsnX19uZWFyYnlfdXBkYXRlJ10gPSB1cGRhdGU7XG4gICAgICAgIGFwaVsnX19uZWFyYnlfcXVlcnknXSA9IHF1ZXJ5O1xuICAgICAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHthZGRUb0luc3RhbmNlLCBhZGRUb1Byb3RvdHlwZX1cbn0oKTtcbiIsIlxuXG5pbXBvcnQgeyBDdXJzb3JCYXNlIH0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7IHNvdXJjZSB9IGZyb20gXCIuL3V0aWwuanNcIjtcbmltcG9ydCB7IFNpbXBsZVN0YXRlUHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX3NpbXBsZS5qc1wiO1xuaW1wb3J0IHsgbmVhcmJ5IH0gZnJvbSBcIi4vY29tbW9uLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENMT0NLIENVUlNPUlNcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8vIENMT0NLIChjb3VudGluZyBzZWNvbmRzIHNpbmNlIHBhZ2UgbG9hZClcbmNsYXNzIExvY2FsQ2xvY2sgZXh0ZW5kcyBDdXJzb3JCYXNlIHtcbiAgICBxdWVyeSAoKSB7XG4gICAgICAgIGxldCBvZmZzZXQgPSBwZXJmb3JtYW5jZS5ub3coKS8xMDAwLjA7XG4gICAgICAgIHJldHVybiB7dmFsdWU6b2Zmc2V0LCBkeW5hbWljOnRydWUsIG9mZnNldH07XG4gICAgfVxufVxuXG4vLyBDTE9DSyAoY291bnRpbmcgc2Vjb25kcyBzaW5jZSBlcG9jaCAoMTk3MClcbmNsYXNzIExvY2FsRXBvY2ggZXh0ZW5kcyBDdXJzb3JCYXNlIHtcbiAgICBxdWVyeSAoKSB7XG4gICAgICAgIGxldCBvZmZzZXQgPSAoRGF0ZS5ub3coKSAvIDEwMDAuMClcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTpvZmZzZXQsIGR5bmFtaWM6dHJ1ZSwgb2Zmc2V0fTtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCBsb2NhbF9jbG9jayA9IG5ldyBMb2NhbENsb2NrKCk7XG5leHBvcnQgY29uc3QgbG9jYWxfZXBvY2ggPSBuZXcgTG9jYWxFcG9jaCgpXG5cbi8vIFRPRE8gb25saW5lIGNsb2NrXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIE1FRElBIENMT0NLXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgTWVkaWFDbG9jayBleHRlbmRzIEN1cnNvckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvLyBzcmNcbiAgICAgICAgc291cmNlLmFkZFRvSW5zdGFuY2UodGhpcywgXCJzcmNcIik7XG4gICAgICAgIC8vIG5lYXJieVxuICAgICAgICBuZWFyYnkuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgLy8gaW5pdGlhbHNlIGNsb2NrXG4gICAgICAgIGxldCB7c3JjLCBjbG9jaz1sb2NhbF9jbG9ja30gPSBvcHRpb25zO1xuICAgICAgICB0aGlzLl9jbG9jayA9IGNsb2NrO1xuXG4gICAgICAgIC8vIGluaXRpYWxpc2Ugc3RhdGVcbiAgICAgICAgaWYgKHNyYyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNyYyA9IG5ldyBTaW1wbGVTdGF0ZVByb3ZpZGVyKCk7XG4gICAgICAgICAgICBzcmMuX3VwZGF0ZShbe1xuICAgICAgICAgICAgICAgIGludGVydmFsOiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICAgICAgdHlwZTogXCJtb3Rpb25cIixcbiAgICAgICAgICAgICAgICBhcmdzOiB7dmVjdG9yOiB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiAwLFxuICAgICAgICAgICAgICAgICAgICB2ZWxvY2l0eTogMCxcbiAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBjbG9jay5xdWVyeSgpLnZhbHVlXG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgIH1dKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNyYyA9IHNyY1xuICAgIH1cblxuICAgIGdldCBjbG9jayAoKSB7cmV0dXJuIHRoaXMuX2Nsb2NrO31cblxuICAgIF9fc3JjX29uY2hhbmdlKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIk9LXCIpO1xuICAgICAgICBsZXQgaXRlbXMgPSB0aGlzLnNyYy5pdGVtcztcbiAgICAgICAgdGhpcy5fX25lYXJieV91cGRhdGUoaXRlbXMpO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUllcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBxdWVyeSAoKSB7XG4gICAgICAgIGxldCB7dmFsdWU6b2Zmc2V0fSA9IHRoaXMuX2Nsb2NrLnF1ZXJ5KClcbiAgICAgICAgcmV0dXJuIHRoaXMuX19uZWFyYnlfY2FjaGUucXVlcnkob2Zmc2V0KTtcbiAgICB9XG59XG5zb3VyY2UuYWRkVG9Qcm90b3R5cGUoTWVkaWFDbG9jay5wcm90b3R5cGUsIFwic3JjXCIsIHttdXRhYmxlOmZhbHNlfSk7XG5uZWFyYnkuYWRkVG9Qcm90b3R5cGUoTWVkaWFDbG9jay5wcm90b3R5cGUpO1xuXG4vKipcbiAqIFxuICogQ0xPQ0sgQ1VSU09SU1xuICogXG4gKiBcbiAqIExvY2FsQ2xvY2sgLSAocGVyZm9ybWFuY2Ugbm93LCBlcG9jaCkgLSB0aGVzZSBhcmUgd2FsbGNsb2Nrc1xuICogXG4gKiBPbmxpbmVDbG9jayAtIHNldCB1cCB3aXRoIGEgZml4ZWQgY2xvY2sgc2VydmVyIChlcG9jaClcbiAqIFxuICogTWVkaWFDbG9jayAtIHNldCB1cCB3aXRoIGEgY2xvY2sgKGN0cmwpIChmaXhlZCksXG4gKiBhbmQgc3RhdGVwcm92aWRlciAoc3JjKSAoc3dpdGNoYWJsZSlcbiAqIFxuICogQ3Vyc29yIC0gYm90aCAoY3RybCkgYW5kIChzcmMpIGFyZSBzd2l0Y2hhYmxlXG4gKiBcbiAqIFxuICogQ0hBTExFTkdFU1xuICogXG4gKiBNZWRpYSBDbG9jayBzaG91bGQgbm90IHN1cHBvcnQgY3RybCBzd2l0Y2hpbmdcbiAqIC0gcmVzdHJpY3Qgc3RhdGUgdG8gbW90aW9uc1xuICovXG5cblxuXG4iLCJcblxuY29uc3QgTUVUSE9EUyA9IHthc3NpZ24sIG1vdmUsIHRyYW5zaXRpb24sIGludGVycG9sYXRlfTtcblxuXG5leHBvcnQgZnVuY3Rpb24gY21kICh0YXJnZXQpIHtcbiAgICBsZXQgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKE1FVEhPRFMpXG4gICAgICAgIC5tYXAoKFtuYW1lLCBtZXRob2RdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oLi4uYXJncykgeyBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGl0ZW1zID0gbWV0aG9kLmNhbGwodGhpcywgdGFyZ2V0LCAuLi5hcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldC51cGRhdGUoaXRlbXMpOyAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcbiAgICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKGVudHJpZXMpO1xufVxuXG5mdW5jdGlvbiBhc3NpZ24odGFyZ2V0LCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBpdGVtID0ge1xuICAgICAgICAgICAgaW50ZXJ2YWw6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBhcmdzOiB7dmFsdWV9ICAgICAgICAgICAgICAgICBcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW2l0ZW1dO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gbW92ZSh0YXJnZXQsIHZlY3Rvcj17fSkge1xuICAgIGxldCB7dmFsdWUsIHJhdGUsIG9mZnNldH0gPSB0YXJnZXQucXVlcnkoKTtcbiAgICBsZXQge3Bvc2l0aW9uPXZhbHVlLCB2ZWxvY2l0eT1yYXRlfSA9IHZlY3RvcjtcbiAgICBsZXQgaXRlbSA9IHtcbiAgICAgICAgaW50ZXJ2YWw6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgdHlwZTogXCJtb3Rpb25cIixcbiAgICAgICAgYXJnczoge3ZlY3Rvcjoge3Bvc2l0aW9uLCB2ZWxvY2l0eSwgdGltZXN0YW1wOm9mZnNldH19ICAgICAgICAgICAgICAgICBcbiAgICB9XG4gICAgcmV0dXJuIFtpdGVtXTtcbn1cblxuZnVuY3Rpb24gdHJhbnNpdGlvbih0YXJnZXQsIHYwLCB2MSwgdDAsIHQxLCBlYXNpbmcpIHtcbiAgICBsZXQgaXRlbXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGludGVydmFsOiBbLUluaWZpbml0eSwgdDAsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBhcmdzOiB7dmFsdWU6djB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGludGVydmFsOiBbdDAsIHQxLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcInRyYW5zaXRpb25cIixcbiAgICAgICAgICAgIGFyZ3M6IHt2MCwgdjEsIHQwLCB0MSwgZWFzaW5nfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpbnRlcnZhbDogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgYXJnczoge3ZhbHVlOiB2MX1cbiAgICAgICAgfVxuICAgIF1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKHRhcmdldCwgdHVwbGVzKSB7XG4gICAgbGV0IGl0ZW1zID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICBpbnRlcnZhbDogWy1JbmlmaW5pdHksIHQwLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgYXJnczoge3ZhbHVlOnYwfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpbnRlcnZhbDogW3QwLCB0MSwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJpbnRlcnBvbGF0aW9uXCIsXG4gICAgICAgICAgICBhcmdzOiB7dHVwbGVzfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpbnRlcnZhbDogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgYXJnczoge3ZhbHVlOiB2MX1cbiAgICAgICAgfVxuICAgIF0gICAgXG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5cblxuIl0sIm5hbWVzIjpbImludGVycG9sYXRlIiwiY2hlY2tfaW5wdXQiLCJzZWdtZW50LlN0YXRpY1NlZ21lbnQiLCJzZWdtZW50LlRyYW5zaXRpb25TZWdtZW50Iiwic2VnbWVudC5JbnRlcnBvbGF0aW9uU2VnbWVudCIsInNlZ21lbnQuTW90aW9uU2VnbWVudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7SUFBQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUE7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOzs7SUFHQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7O0lBRUEsU0FBUyxZQUFZLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUMvQixJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsRUFBRTtJQUNyQixJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsRUFBRTtJQUNyQixJQUFJLElBQUksSUFBSSxHQUFHLEVBQUUsR0FBRyxFQUFFO0lBQ3RCLElBQUksT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxHQUFHLEVBQUUsR0FBRyxFQUFFO0lBQ3ZDOztJQUVBLFNBQVMsV0FBVyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7SUFDOUIsSUFBSSxPQUFPLFlBQVksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUc7SUFDbEM7SUFDQSxTQUFTLFdBQVcsRUFB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QyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDakUsU0FBUztJQUNUO0lBQ0EsUUFBUSxJQUFJLEdBQUcsRUFBRSxJQUFJO0lBQ3JCLFFBQVEsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7SUFDdEMsWUFBWSxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVE7SUFDL0MsWUFBWSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQztJQUNyRCxZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUcsU0FBUztJQUN2RixZQUFZLE1BQU0sQ0FBQyxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxHQUFHLFNBQVM7SUFDeEYsWUFBWSxNQUFNLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUTtJQUN2RCxTQUFTLE1BQU07SUFDZixZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUk7SUFDckMsWUFBWSxNQUFNLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJO0lBQ3RDO0lBQ0EsWUFBWSxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSTtJQUNsQyxZQUFZLEdBQUcsR0FBRyxDQUFDLElBQUksSUFBSSxTQUFTLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUM7SUFDbkYsWUFBWSxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSztJ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
