
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var LAYERS = (function (exports) {
	'use strict';

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
	    CLOCK PROVIDER BASE
	***************************************************************/

	/**
	 * Defines the interface which needs to be implemented
	 * by clock providers.
	 */

	class ClockProviderBase {

	    constructor() {
	        callback.addToInstance(this);
	    }
	    now() {
	        throw new Error("not implemented");
	    }
	}
	callback.addToPrototype(ClockProviderBase.prototype);



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

	    /**
	     * update function
	     * called from cursor or layer objects
	     * for online implementation, this will
	     * typically result in a network request 
	     * to update some online item collection
	     */
	    update(items){
	        throw new Error("not implemented");
	    }

	    /**
	     * return array with all items in collection 
	     * - no requirement wrt order
	     */

	    get items() {
	        throw new Error("not implemented");
	    }

	    /**
	     * signal if items can be overlapping or not
	     */

	    get info () {
	        return {overlapping: true};
	    }
	}
	callback.addToPrototype(StateProviderBase.prototype);


	/************************************************
	 * LAYER BASE
	 ************************************************/

	class LayerBase {

	    constructor() {
	        this._index;

	        callback.addToInstance(this);
	        // define change event
	        eventify.addToInstance(this);
	        this.eventifyDefine("change", {init:true});
	    }

	    /**********************************************************
	     * QUERY API
	     **********************************************************/

	    getCacheObject () {
	        throw new Error("Not implemented");     
	    }

	    get index () {return this._index};
	    

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
	        const cache = this.getCacheObject();
	        return range(start[0], stop[0], step, {include_end:true})
	            .map((offset) => {
	                return [cache.query(offset).value, offset];
	            });
	    }
	}
	callback.addToPrototype(LayerBase.prototype);
	eventify.addToPrototype(LayerBase.prototype);


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

	    get index() {
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

	/************************************************
	 * SOURCE PROPERTY
	 ************************************************/

	/**
	 * Functions for extending a class with support for 
	 * external source on a named property.
	 * 
	 * option: mutable:true means that propery may be reset 
	 * 
	 * source object is assumed to support the callback interface
	 */

	function propnames (propName) {
	    return {
	        prop: `__${propName}`,
	        init: `__${propName}_init`,
	        handle: `__${propName}_handle`,
	        change: `__${propName}_handle_change`,
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
	            if (this[p.change]) {
	                const handler = this[p.change].bind(this);
	                this[p.handle] = source.add_callback(handler);
	                handler("reset"); 
	            }
	        } else {
	            throw new Error(`${propName} can not be reassigned`);
	        }
	    }

	    /**
	     * 
	     * object must implement
	     * __{propName}_handle_change() {}
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

	const METHODS = {assign, move, transition, interpolate: interpolate$1};


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
	            args: {value}                 
	        };
	        return [item];
	    }
	}

	function move(vector) {
	    let item = {
	        itv: [-Infinity, Infinity, true, true],
	        type: "motion",
	        args: vector  
	    };
	    return [item];
	}

	function transition(v0, v1, t0, t1, easing) {
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

	function interpolate$1(tuples) {
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

	/***************************************************************
	    SIMPLE STATE PROVIDER (LOCAL)
	***************************************************************/

	/**
	 * Local Array with non-overlapping items.
	 */

	class StateProviderSimple extends StateProviderBase {

	    constructor(options={}) {
	        super();
	        // initialization
	        let {items, value} = options;
	        if (items != undefined) {
	            this._items = check_input(items);
	        } else if (value != undefined) {
	            this._items = [{itv:[-Infinity, Infinity, true, true], args:{value}}];
	        } else {
	            this._items = [];
	        }
	    }

	    update (items) {
	        return Promise.resolve()
	            .then(() => {
	                this._items = check_input(items);
	                this.notify_callbacks();
	            });
	    }

	    get items () {
	        return this._items.slice();
	    }

	    get info () {
	        return {dynamic: true, overlapping: false, local:true};
	    }
	}


	function check_input(items) {
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

	    constructor(itv, args) {
	        super(itv);
	        // setup interpolation function
	        this._trans = interpolate(args.tuples);
	    }

	    state(offset) {
	        return {value: this._trans(offset), dynamic:true};
	    }
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

	    constructor (layer) {
	        // nearby index
	        this._index = layer.index;
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
	 *      center: list of ITEMS covering endpoint,
	 *      itv: interval where nearby returns identical {center}
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

	    /*
	        List items of NearbyIndex (order left to right)
	        interval defines [start, end] offset on the timeline.
	        Returns list of item-lists.
	        options
	        - start
	        - stop
	    */
	    list(options={}) {
	        let {start=-Infinity, stop=Infinity} = options;
	        if (start > stop) {
	            throw new Error ("stop must be larger than start", start, stop)
	        }
	        start = [start, 0];
	        stop = [stop, 0];
	        let current = start;
	        let nearby;
	        const results = [];
	        let limit = 5;
	        while (limit) {
	            if (endpoint.gt(current, stop)) {
	                // exhausted
	                break;
	            }
	            nearby = this.nearby(current);
	            if (nearby.center.length == 0) {
	                // center empty (typically first iteration)
	                if (nearby.right == undefined) {
	                    // right undefined
	                    // no entries - already exhausted
	                    break;
	                } else {
	                    // right defined
	                    // increment offset
	                    current = nearby.right;
	                }
	            } else {
	                results.push(nearby.center);
	                if (nearby.right == undefined) {
	                    // right undefined
	                    // last entry - mark iteractor exhausted
	                    break;
	                } else {
	                    // right defined
	                    // increment offset
	                    current = nearby.right;
	                }
	            }
	            limit--;
	        }
	        return results;
	    }
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
	        let items = this._src.items;
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
	 * 
	 * Layer
	 * - has mutable state provider (src) (default state undefined)
	 * - methods for list and sample
	 * 
	 */

	class Layer extends LayerBase {

	    constructor (options={}) {
	        super();

	        // src
	        addToInstance(this, "src");
	        // cache objects
	        this._cache_objects = [];

	        // initialise with stateprovider
	        let {src, ...opts} = options;
	        if (src == undefined) {
	            src = new StateProviderSimple(opts);
	        }
	        if (!(src instanceof StateProviderBase)) {
	            throw new Error("src must be StateproviderBase")
	        }
	        this.src = src;
	    }

	    /**********************************************************
	     * QUERY API
	     **********************************************************/

	    getCacheObject () {
	        const cache_object = new NearbyCache(this);
	        this._cache_objects.push(cache_object);
	        return cache_object;
	    }
	    
	    /**********************************************************
	     * SRC (stateprovider)
	     **********************************************************/

	    __src_check(src) {
	        if (!(src instanceof StateProviderBase)) {
	            throw new Error(`"src" must be state provider ${src}`);
	        }
	    }    
	    __src_handle_change() {
	        if (this._index == undefined) {
	            this._index = new NearbyIndexSimple(this.src);
	        } else {
	            for (let cache_object of this._cache_objects) {
	                cache_object.dirty();
	            }
	        }
	        this.notify_callbacks();
	        // trigger change event for cursor
	        this.eventifyTrigger("change");   
	    }
	}
	addToPrototype(Layer.prototype, "src", {mutable:true});


	function fromArray (array) {
	    const items = array.map((obj, index) => {
	        return { 
	            itv: [index, index+1, true, false], 
	            type: "static", 
	            args: {value:obj}};
	    });
	    return new Layer({items});
	}

	Layer.fromArray = fromArray;

	/***************************************************************
	    CLOCKS
	***************************************************************/

	/**
	 * clocks counting in seconds
	 */

	const local_clock = function () {
	    return performance.now()/1000.0;
	};

	const local_epoch = function () {
	    return new Date()/1000.0;
	};


	/***************************************************************
	    LOCAL CLOCK PROVIDER
	***************************************************************/

	/**
	 * Local high performance clock
	 */

	class LocalClockProvider extends ClockProviderBase {
	    now () { 
	        return local_clock();
	    }
	}
	// singleton
	const LOCAL_CLOCK_PROVIDER = new LocalClockProvider();


	/***************************************************************
	    LOCAL EPOCH CLOCK PROVIDER
	***************************************************************/

	/**
	 * Local Epoch Clock Provider is computed from local high
	 * performance clock. This makes for a better resolution than
	 * the system epoch clock, and protects the clock from system 
	 * clock adjustments during the session.
	 */

	class LocalEpochProvider extends ClockProviderBase {

	    constructor () {
	        super();
	        this._t0 = local_clock();
	        this._t0_epoch = local_epoch();
	    }
	    now () {
	        return this._t0_epoch + (local_clock() - this._t0);            
	    }
	}

	// singleton
	const LOCAL_EPOCH_PROVIDER = new LocalEpochProvider();

	/************************************************
	 * CLOCK CURSOR
	 ************************************************/

	/**
	 * Convenience wrapping around a clock provider.
	 * - makes it easy to visualize a clock like any other cursor
	 * - allows cursor.ctrl to always be cursor type
	 * - allows cursors to be driven by online clocks 
	 */

	class ClockCursor extends CursorBase {

	    constructor (src) {
	        super();
	        // src
	        addToInstance(this, "src");
	        this.src = src;
	    }

	    /**********************************************************
	     * SRC (stateprovider)
	     **********************************************************/

	    __src_check(src) {
	        if (!(src instanceof ClockProviderBase)) {
	            throw new Error(`"src" must be ClockProvider ${src}`);
	        }
	    }    
	    __src_handle_change(reason) {
	        /**
	         * Local ClockProviders never change 
	         * do change - in the sense that and signal change through
	         * this callback.
	         * 
	         * Currently we ignore such changes, on the assumtion
	         * that these changes are small and that
	         * there is no need to inform the application about it.
	         * 
	         * However, we we do not ignore switching between clocks,
	         * which may happen if one switches from a local clock
	         * to an online source. Note however that switching clocks
	         * make most sense if the clocks are within the same time domain
	         * for example, switching from local epoch to global epoch,
	         * whi
	         */
	        // 
	        if (reason == "reset") {
	            this.notify_callbacks();
	        }
	    }

	    query () {
	        let ts =  this.src.now();
	        return {value:ts, dynamic:true, offset:ts}
	    }
	}
	addToPrototype(ClockCursor.prototype, "src", {mutable:true});

	// singleton clock cursors
	const localClockCursor = new ClockCursor(LOCAL_CLOCK_PROVIDER);
	const epochClockCursor = new ClockCursor(LOCAL_EPOCH_PROVIDER);


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
	        addToInstance(this, "ctrl");
	        // src
	        addToInstance(this, "src");
	        // index
	        this._index;
	        // cursor maintains a cashe object for querying src layer
	        this._cache;
	        // timeout
	        this._tid;
	        // polling
	        this._pid;
	        // options
	        let {src, ctrl, ...opts} = options;

	        // initialise ctrl
	        if (ctrl == undefined) {
	            let {epoch=false} = options;
	            ctrl = (epoch) ? epochClockCursor : localClockCursor;
	        }
	        this.ctrl = ctrl;

	        // initialise state
	        if (src == undefined) {
	            src = new Layer(opts);
	        } else if (src instanceof StateProviderBase) {
	            src = new Layer({src});
	        }
	        this.src = src;
	    }

	    /**********************************************************
	     * CTRL (cursor)
	     **********************************************************/

	    __ctrl_check(ctrl) {
	        if (!(ctrl instanceof CursorBase)) {
	            throw new Error(`"ctrl" must be cursor ${ctrl}`)
	        }
	    }
	    __ctrl_handle_change(reason) {
	        this.__handle_change("ctrl", reason);
	    }

	    /**********************************************************
	     * SRC (layer)
	     **********************************************************/

	    __src_check(src) {
	        if (!(src instanceof LayerBase)) {
	            throw new Error(`"src" must be Layer ${src}`);
	        }
	    }    
	    __src_handle_change(reason) {
	        this.__handle_change("src", reason);
	    }

	    /**********************************************************
	     * CALLBACK
	     **********************************************************/

	    __handle_change(origin, reason) {
	        clearTimeout(this._tid);
	        clearInterval(this._pid);
	        if (this.src && this.ctrl) {
	            if (origin == "src") {
	                // reset cursor index to layer index
	                if (this._index != this.src.index) {
	                    this._index = this.src.index;
	                    this._cache = this.src.getCacheObject();
	                }
	            }
	            if (origin == "src" || origin == "ctrl") {
	                // reevaluate the cache
	                this._cache.dirty();
	                this._refresh();
	            }
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
	     *      (c) ctrl.nearby.center[0].args.velocity != 0.0
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
	        const ctrl_vector = this.ctrl.query();
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
	        if (this.ctrl instanceof ClockCursor) {
	            if (isFinite(high)) {
	                this.__set_timeout(high, current_pos, 1.0, current_ts);
	                return;
	            }
	            // no future event to detect
	            return;
	        } 
	        if (
	            this.ctrl instanceof Cursor && 
	            this.ctrl.ctrl instanceof ClockCursor
	        ) {
	            /** 
	             * Ctrl has many possible behaviors
	             * Since Ctrl is not a ClockCursor - 
	             * it has an index - use this to figure out which
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
	                    const {velocity, acceleration=0.0} = ctrl_item.args;
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
	                    const {v0:p0, v1:p1, t0, t1, easing="linear"} = ctrl_item.args;
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
	        this.__set_polling();
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
	        const {offset:ts} = this.ctrl.query();
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

	    __set_polling() {
	        this._pid = setInterval(() => {
	            this.__handle_poll();
	        }, 100);
	    }

	    __handle_poll() {
	        this.query();
	    }

	    /**********************************************************
	     * QUERY API
	     **********************************************************/
	    _refresh () {
	        let {value:offset} = this.ctrl.query();
	        if (typeof offset !== 'number') {
	            throw new Error(`warning: ctrl state must be number ${offset}`);
	        }
	        let refreshed = this._cache.refresh(offset);
	        return [offset, refreshed];
	    }

	    query () {
	        let [offset, refreshed] = this._refresh();
	        if (refreshed) {
	            this.__handle_change("query");
	        }
	        return this._cache.query(offset);
	    }

	    get value () {return this.query().value};
	    get cache () {return this._cache};
	    get index () {return this._index};

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
	addToPrototype(Cursor.prototype, "src", {mutable:true});
	addToPrototype(Cursor.prototype, "ctrl", {mutable:true});

	exports.Cursor = Cursor;
	exports.Layer = Layer;
	exports.cmd = cmd;

	return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ldmVudGlmeS5qcyIsIi4uLy4uL3NyYy91dGlsLmpzIiwiLi4vLi4vc3JjL21vbml0b3IuanMiLCIuLi8uLi9zcmMvaW50ZXJ2YWxzLmpzIiwiLi4vLi4vc3JjL2Jhc2VzLmpzIiwiLi4vLi4vc3JjL3NvdXJjZXByb3AuanMiLCIuLi8uLi9zcmMvY21kLmpzIiwiLi4vLi4vc3JjL3N0YXRlcHJvdmlkZXJfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL3NlZ21lbnRzLmpzIiwiLi4vLi4vc3JjL25lYXJieWNhY2hlLmpzIiwiLi4vLi4vc3JjL25lYXJieWluZGV4LmpzIiwiLi4vLi4vc3JjL25lYXJieWluZGV4X3NpbXBsZS5qcyIsIi4uLy4uL3NyYy9sYXllcnMuanMiLCIuLi8uLi9zcmMvY2xvY2twcm92aWRlcnMuanMiLCIuLi8uLi9zcmMvY3Vyc29ycy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuXHRDb3B5cmlnaHQgMjAyMFxuXHRBdXRob3IgOiBJbmdhciBBcm50emVuXG5cblx0VGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFRpbWluZ3NyYyBtb2R1bGUuXG5cblx0VGltaW5nc3JjIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnlcblx0aXQgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5XG5cdHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yXG5cdChhdCB5b3VyIG9wdGlvbikgYW55IGxhdGVyIHZlcnNpb24uXG5cblx0VGltaW5nc3JjIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsXG5cdGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mXG5cdE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS4gIFNlZSB0aGVcblx0R05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG5cblx0WW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlXG5cdGFsb25nIHdpdGggVGltaW5nc3JjLiAgSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+LlxuKi9cblxuXG5cbi8qXG5cdEV2ZW50XG5cdC0gbmFtZTogZXZlbnQgbmFtZVxuXHQtIHB1Ymxpc2hlcjogdGhlIG9iamVjdCB3aGljaCBkZWZpbmVkIHRoZSBldmVudFxuXHQtIGluaXQ6IHRydWUgaWYgdGhlIGV2ZW50IHN1cHBwb3J0cyBpbml0IGV2ZW50c1xuXHQtIHN1YnNjcmlwdGlvbnM6IHN1YnNjcmlwdGlucyB0byB0aGlzIGV2ZW50XG5cbiovXG5cbmNsYXNzIEV2ZW50IHtcblxuXHRjb25zdHJ1Y3RvciAocHVibGlzaGVyLCBuYW1lLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLnB1Ymxpc2hlciA9IHB1Ymxpc2hlcjtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMuaW5pdCA9IChvcHRpb25zLmluaXQgPT09IHVuZGVmaW5lZCkgPyBmYWxzZSA6IG9wdGlvbnMuaW5pdDtcblx0XHR0aGlzLnN1YnNjcmlwdGlvbnMgPSBbXTtcblx0fVxuXG5cdC8qXG5cdFx0c3Vic2NyaWJlIHRvIGV2ZW50XG5cdFx0LSBzdWJzY3JpYmVyOiBzdWJzY3JpYmluZyBvYmplY3Rcblx0XHQtIGNhbGxiYWNrOiBjYWxsYmFjayBmdW5jdGlvbiB0byBpbnZva2Vcblx0XHQtIG9wdGlvbnM6XG5cdFx0XHRpbml0OiBpZiB0cnVlIHN1YnNjcmliZXIgd2FudHMgaW5pdCBldmVudHNcblx0Ki9cblx0c3Vic2NyaWJlIChjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdGlmICghY2FsbGJhY2sgfHwgdHlwZW9mIGNhbGxiYWNrICE9PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIG5vdCBhIGZ1bmN0aW9uXCIsIGNhbGxiYWNrKTtcblx0XHR9XG5cdFx0Y29uc3Qgc3ViID0gbmV3IFN1YnNjcmlwdGlvbih0aGlzLCBjYWxsYmFjaywgb3B0aW9ucyk7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zLnB1c2goc3ViKTtcblx0ICAgIC8vIEluaXRpYXRlIGluaXQgY2FsbGJhY2sgZm9yIHRoaXMgc3Vic2NyaXB0aW9uXG5cdCAgICBpZiAodGhpcy5pbml0ICYmIHN1Yi5pbml0KSB7XG5cdCAgICBcdHN1Yi5pbml0X3BlbmRpbmcgPSB0cnVlO1xuXHQgICAgXHRsZXQgc2VsZiA9IHRoaXM7XG5cdCAgICBcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgXHRcdGNvbnN0IGVBcmdzID0gc2VsZi5wdWJsaXNoZXIuZXZlbnRpZnlJbml0RXZlbnRBcmdzKHNlbGYubmFtZSkgfHwgW107XG5cdCAgICBcdFx0c3ViLmluaXRfcGVuZGluZyA9IGZhbHNlO1xuXHQgICAgXHRcdGZvciAobGV0IGVBcmcgb2YgZUFyZ3MpIHtcblx0ICAgIFx0XHRcdHNlbGYudHJpZ2dlcihlQXJnLCBbc3ViXSwgdHJ1ZSk7XG5cdCAgICBcdFx0fVxuXHQgICAgXHR9KTtcblx0ICAgIH1cblx0XHRyZXR1cm4gc3ViXG5cdH1cblxuXHQvKlxuXHRcdHRyaWdnZXIgZXZlbnRcblxuXHRcdC0gaWYgc3ViIGlzIHVuZGVmaW5lZCAtIHB1Ymxpc2ggdG8gYWxsIHN1YnNjcmlwdGlvbnNcblx0XHQtIGlmIHN1YiBpcyBkZWZpbmVkIC0gcHVibGlzaCBvbmx5IHRvIGdpdmVuIHN1YnNjcmlwdGlvblxuXHQqL1xuXHR0cmlnZ2VyIChlQXJnLCBzdWJzLCBpbml0KSB7XG5cdFx0bGV0IGVJbmZvLCBjdHg7XG5cdFx0Zm9yIChjb25zdCBzdWIgb2Ygc3Vicykge1xuXHRcdFx0Ly8gaWdub3JlIHRlcm1pbmF0ZWQgc3Vic2NyaXB0aW9uc1xuXHRcdFx0aWYgKHN1Yi50ZXJtaW5hdGVkKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0ZUluZm8gPSB7XG5cdFx0XHRcdHNyYzogdGhpcy5wdWJsaXNoZXIsXG5cdFx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdFx0c3ViOiBzdWIsXG5cdFx0XHRcdGluaXQ6IGluaXRcblx0XHRcdH1cblx0XHRcdGN0eCA9IHN1Yi5jdHggfHwgdGhpcy5wdWJsaXNoZXI7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzdWIuY2FsbGJhY2suY2FsbChjdHgsIGVBcmcsIGVJbmZvKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgRXJyb3IgaW4gJHt0aGlzLm5hbWV9OiAke3N1Yi5jYWxsYmFja30gJHtlcnJ9YCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0dW5zdWJzY3JpYmUgZnJvbSBldmVudFxuXHQtIHVzZSBzdWJzY3JpcHRpb24gcmV0dXJuZWQgYnkgcHJldmlvdXMgc3Vic2NyaWJlXG5cdCovXG5cdHVuc3Vic2NyaWJlKHN1Yikge1xuXHRcdGxldCBpZHggPSB0aGlzLnN1YnNjcmlwdGlvbnMuaW5kZXhPZihzdWIpO1xuXHRcdGlmIChpZHggPiAtMSkge1xuXHRcdFx0dGhpcy5zdWJzY3JpcHRpb25zLnNwbGljZShpZHgsIDEpO1xuXHRcdFx0c3ViLnRlcm1pbmF0ZSgpO1xuXHRcdH1cblx0fVxufVxuXG5cbi8qXG5cdFN1YnNjcmlwdGlvbiBjbGFzc1xuKi9cblxuY2xhc3MgU3Vic2NyaXB0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcihldmVudCwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXHRcdHRoaXMuZXZlbnQgPSBldmVudDtcblx0XHR0aGlzLm5hbWUgPSBldmVudC5uYW1lO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFja1xuXHRcdHRoaXMuaW5pdCA9IChvcHRpb25zLmluaXQgPT09IHVuZGVmaW5lZCkgPyB0aGlzLmV2ZW50LmluaXQgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSBmYWxzZTtcblx0XHR0aGlzLmN0eCA9IG9wdGlvbnMuY3R4O1xuXHR9XG5cblx0dGVybWluYXRlKCkge1xuXHRcdHRoaXMudGVybWluYXRlZCA9IHRydWU7XG5cdFx0dGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmV2ZW50LnVuc3Vic2NyaWJlKHRoaXMpO1xuXHR9XG59XG5cblxuLypcblxuXHRFVkVOVElGWSBJTlNUQU5DRVxuXG5cdEV2ZW50aWZ5IGJyaW5ncyBldmVudGluZyBjYXBhYmlsaXRpZXMgdG8gYW55IG9iamVjdC5cblxuXHRJbiBwYXJ0aWN1bGFyLCBldmVudGlmeSBzdXBwb3J0cyB0aGUgaW5pdGlhbC1ldmVudCBwYXR0ZXJuLlxuXHRPcHQtaW4gZm9yIGluaXRpYWwgZXZlbnRzIHBlciBldmVudCB0eXBlLlxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cbiovXG5cbmV4cG9ydCBmdW5jdGlvbiBldmVudGlmeUluc3RhbmNlIChvYmplY3QpIHtcblx0b2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAgPSBuZXcgTWFwKCk7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRyZXR1cm4gb2JqZWN0O1xufTtcblxuXG4vKlxuXHRFVkVOVElGWSBQUk9UT1RZUEVcblxuXHRBZGQgZXZlbnRpZnkgZnVuY3Rpb25hbGl0eSB0byBwcm90b3R5cGUgb2JqZWN0XG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlQcm90b3R5cGUoX3Byb3RvdHlwZSkge1xuXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5R2V0RXZlbnQob2JqZWN0LCBuYW1lKSB7XG5cdFx0Y29uc3QgZXZlbnQgPSBvYmplY3QuX19ldmVudGlmeV9ldmVudE1hcC5nZXQobmFtZSk7XG5cdFx0aWYgKGV2ZW50ID09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRXZlbnQgdW5kZWZpbmVkXCIsIG5hbWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gZXZlbnQ7XG5cdH1cblxuXHQvKlxuXHRcdERFRklORSBFVkVOVFxuXHRcdC0gdXNlZCBvbmx5IGJ5IGV2ZW50IHNvdXJjZVxuXHRcdC0gbmFtZTogbmFtZSBvZiBldmVudFxuXHRcdC0gb3B0aW9uczoge2luaXQ6dHJ1ZX0gc3BlY2lmaWVzIGluaXQtZXZlbnQgc2VtYW50aWNzIGZvciBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeURlZmluZShuYW1lLCBvcHRpb25zKSB7XG5cdFx0Ly8gY2hlY2sgdGhhdCBldmVudCBkb2VzIG5vdCBhbHJlYWR5IGV4aXN0XG5cdFx0aWYgKHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5oYXMobmFtZSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IGFscmVhZHkgZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2V2ZW50TWFwLnNldChuYW1lLCBuZXcgRXZlbnQodGhpcywgbmFtZSwgb3B0aW9ucykpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T05cblx0XHQtIHVzZWQgYnkgc3Vic2NyaWJlclxuXHRcdHJlZ2lzdGVyIGNhbGxiYWNrIG9uIGV2ZW50LlxuXHQqL1xuXHRmdW5jdGlvbiBvbihuYW1lLCBjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmliZShjYWxsYmFjaywgb3B0aW9ucyk7XG5cdH07XG5cblx0Lypcblx0XHRPRkZcblx0XHQtIHVzZWQgYnkgc3Vic2NyaWJlclxuXHRcdFVuLXJlZ2lzdGVyIGEgaGFuZGxlciBmcm9tIGEgc3BlY2ZpYyBldmVudCB0eXBlXG5cdCovXG5cdGZ1bmN0aW9uIG9mZihzdWIpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBzdWIubmFtZSkudW5zdWJzY3JpYmUoc3ViKTtcblx0fTtcblxuXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5U3Vic2NyaXB0aW9ucyhuYW1lKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSkuc3Vic2NyaXB0aW9ucztcblx0fVxuXG5cblxuXHQvKlxuXHRcdFRyaWdnZXIgbGlzdCBvZiBldmVudEl0ZW1zIG9uIG9iamVjdFxuXG5cdFx0ZXZlbnRJdGVtOiAge25hbWU6Li4sIGVBcmc6Li59XG5cblx0XHRjb3B5IGFsbCBldmVudEl0ZW1zIGludG8gYnVmZmVyLlxuXHRcdHJlcXVlc3QgZW1wdHlpbmcgdGhlIGJ1ZmZlciwgaS5lLiBhY3R1YWxseSB0cmlnZ2VyaW5nIGV2ZW50cyxcblx0XHRldmVyeSB0aW1lIHRoZSBidWZmZXIgZ29lcyBmcm9tIGVtcHR5IHRvIG5vbi1lbXB0eVxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXJBbGwoZXZlbnRJdGVtcykge1xuXHRcdGlmIChldmVudEl0ZW1zLmxlbmd0aCA9PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gbWFrZSB0cmlnZ2VyIGl0ZW1zXG5cdFx0Ly8gcmVzb2x2ZSBub24tcGVuZGluZyBzdWJzY3JpcHRpb25zIG5vd1xuXHRcdC8vIGVsc2Ugc3Vic2NyaXB0aW9ucyBtYXkgY2hhbmdlIGZyb20gcGVuZGluZyB0byBub24tcGVuZGluZ1xuXHRcdC8vIGJldHdlZW4gaGVyZSBhbmQgYWN0dWFsIHRyaWdnZXJpbmdcblx0XHQvLyBtYWtlIGxpc3Qgb2YgW2V2LCBlQXJnLCBzdWJzXSB0dXBsZXNcblx0XHRsZXQgdHJpZ2dlckl0ZW1zID0gZXZlbnRJdGVtcy5tYXAoKGl0ZW0pID0+IHtcblx0XHRcdGxldCB7bmFtZSwgZUFyZ30gPSBpdGVtO1xuXHRcdFx0bGV0IGV2ID0gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKTtcblx0XHRcdGxldCBzdWJzID0gZXYuc3Vic2NyaXB0aW9ucy5maWx0ZXIoc3ViID0+IHN1Yi5pbml0X3BlbmRpbmcgPT0gZmFsc2UpO1xuXHRcdFx0cmV0dXJuIFtldiwgZUFyZywgc3Vic107XG5cdFx0fSwgdGhpcyk7XG5cblx0XHQvLyBhcHBlbmQgdHJpZ2dlciBJdGVtcyB0byBidWZmZXJcblx0XHRjb25zdCBsZW4gPSB0cmlnZ2VySXRlbXMubGVuZ3RoO1xuXHRcdGNvbnN0IGJ1ZiA9IHRoaXMuX19ldmVudGlmeV9idWZmZXI7XG5cdFx0Y29uc3QgYnVmX2xlbiA9IHRoaXMuX19ldmVudGlmeV9idWZmZXIubGVuZ3RoO1xuXHRcdC8vIHJlc2VydmUgbWVtb3J5IC0gc2V0IG5ldyBsZW5ndGhcblx0XHR0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aCA9IGJ1Zl9sZW4gKyBsZW47XG5cdFx0Ly8gY29weSB0cmlnZ2VySXRlbXMgdG8gYnVmZmVyXG5cdFx0Zm9yIChsZXQgaT0wOyBpPGxlbjsgaSsrKSB7XG5cdFx0XHRidWZbYnVmX2xlbitpXSA9IHRyaWdnZXJJdGVtc1tpXTtcblx0XHR9XG5cdFx0Ly8gcmVxdWVzdCBlbXB0eWluZyBvZiB0aGUgYnVmZmVyXG5cdFx0aWYgKGJ1Zl9sZW4gPT0gMCkge1xuXHRcdFx0bGV0IHNlbGYgPSB0aGlzO1xuXHRcdFx0UHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0Zm9yIChsZXQgW2V2LCBlQXJnLCBzdWJzXSBvZiBzZWxmLl9fZXZlbnRpZnlfYnVmZmVyKSB7XG5cdFx0XHRcdFx0Ly8gYWN0dWFsIGV2ZW50IHRyaWdnZXJpbmdcblx0XHRcdFx0XHRldi50cmlnZ2VyKGVBcmcsIHN1YnMsIGZhbHNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxmLl9fZXZlbnRpZnlfYnVmZmVyID0gW107XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHQvKlxuXHRcdFRyaWdnZXIgbXVsdGlwbGUgZXZlbnRzIG9mIHNhbWUgdHlwZSAobmFtZSlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxpa2UobmFtZSwgZUFyZ3MpIHtcblx0XHRyZXR1cm4gdGhpcy5ldmVudGlmeVRyaWdnZXJBbGwoZUFyZ3MubWFwKGVBcmcgPT4ge1xuXHRcdFx0cmV0dXJuIHtuYW1lLCBlQXJnfTtcblx0XHR9KSk7XG5cdH1cblxuXHQvKlxuXHRcdFRyaWdnZXIgc2luZ2xlIGV2ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlcihuYW1lLCBlQXJnKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKFt7bmFtZSwgZUFyZ31dKTtcblx0fVxuXG5cdF9wcm90b3R5cGUuZXZlbnRpZnlEZWZpbmUgPSBldmVudGlmeURlZmluZTtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXIgPSBldmVudGlmeVRyaWdnZXI7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxpa2UgPSBldmVudGlmeVRyaWdnZXJBbGlrZTtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXJBbGwgPSBldmVudGlmeVRyaWdnZXJBbGw7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlTdWJzY3JpcHRpb25zID0gZXZlbnRpZnlTdWJzY3JpcHRpb25zO1xuXHRfcHJvdG90eXBlLm9uID0gb247XG5cdF9wcm90b3R5cGUub2ZmID0gb2ZmO1xufTtcblxuXG5leHBvcnQgY29uc3QgZXZlbnRpZnkgPSBmdW5jdGlvbiAoKSB7XG5cdHJldHVybiB7XG5cdFx0YWRkVG9JbnN0YW5jZTogZXZlbnRpZnlJbnN0YW5jZSxcblx0XHRhZGRUb1Byb3RvdHlwZTogZXZlbnRpZnlQcm90b3R5cGVcblx0fVxufSgpO1xuXG4vKlxuXHRFdmVudCBWYXJpYWJsZVxuXG5cdE9iamVjdHMgd2l0aCBhIHNpbmdsZSBcImNoYW5nZVwiIGV2ZW50XG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRWYXJpYWJsZSB7XG5cblx0Y29uc3RydWN0b3IgKHZhbHVlKSB7XG5cdFx0ZXZlbnRpZnlJbnN0YW5jZSh0aGlzKTtcblx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMuZXZlbnRpZnlEZWZpbmUoXCJjaGFuZ2VcIiwge2luaXQ6dHJ1ZX0pO1xuXHR9XG5cblx0ZXZlbnRpZnlJbml0RXZlbnRBcmdzKG5hbWUpIHtcblx0XHRpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG5cdFx0XHRyZXR1cm4gW3RoaXMuX3ZhbHVlXTtcblx0XHR9XG5cdH1cblxuXHRnZXQgdmFsdWUgKCkge3JldHVybiB0aGlzLl92YWx1ZX07XG5cdHNldCB2YWx1ZSAodmFsdWUpIHtcblx0XHRpZiAodmFsdWUgIT0gdGhpcy5fdmFsdWUpIHtcblx0XHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0XHR0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiLCB2YWx1ZSk7XG5cdFx0fVxuXHR9XG59XG5ldmVudGlmeVByb3RvdHlwZShFdmVudFZhcmlhYmxlLnByb3RvdHlwZSk7XG5cbi8qXG5cdEV2ZW50IEJvb2xlYW5cblxuXG5cdE5vdGUgOiBpbXBsZW1lbnRhdGlvbiB1c2VzIGZhbHNpbmVzcyBvZiBpbnB1dCBwYXJhbWV0ZXIgdG8gY29uc3RydWN0b3IgYW5kIHNldCgpIG9wZXJhdGlvbixcblx0c28gZXZlbnRCb29sZWFuKC0xKSB3aWxsIGFjdHVhbGx5IHNldCBpdCB0byB0cnVlIGJlY2F1c2Vcblx0KC0xKSA/IHRydWUgOiBmYWxzZSAtPiB0cnVlICFcbiovXG5cbmV4cG9ydCBjbGFzcyBFdmVudEJvb2xlYW4gZXh0ZW5kcyBFdmVudFZhcmlhYmxlIHtcblx0Y29uc3RydWN0b3IodmFsdWUpIHtcblx0XHRzdXBlcihCb29sZWFuKHZhbHVlKSk7XG5cdH1cblxuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0c3VwZXIudmFsdWUgPSBCb29sZWFuKHZhbHVlKTtcblx0fVxuXHRnZXQgdmFsdWUgKCkge3JldHVybiBzdXBlci52YWx1ZX07XG59XG5cblxuLypcblx0bWFrZSBhIHByb21pc2Ugd2hpY2ggaXMgcmVzb2x2ZWQgd2hlbiBFdmVudEJvb2xlYW4gY2hhbmdlc1xuXHR2YWx1ZS5cbiovXG5leHBvcnQgZnVuY3Rpb24gbWFrZVByb21pc2UoZXZlbnRPYmplY3QsIGNvbmRpdGlvbkZ1bmMpIHtcblx0Y29uZGl0aW9uRnVuYyA9IGNvbmRpdGlvbkZ1bmMgfHwgZnVuY3Rpb24odmFsKSB7cmV0dXJuIHZhbCA9PSB0cnVlfTtcblx0cmV0dXJuIG5ldyBQcm9taXNlIChmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0bGV0IHN1YiA9IGV2ZW50T2JqZWN0Lm9uKFwiY2hhbmdlXCIsIGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRcdFx0aWYgKGNvbmRpdGlvbkZ1bmModmFsdWUpKSB7XG5cdFx0XHRcdHJlc29sdmUodmFsdWUpO1xuXHRcdFx0XHRldmVudE9iamVjdC5vZmYoc3ViKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG59O1xuXG4vLyBtb2R1bGUgYXBpXG5leHBvcnQgZGVmYXVsdCB7XG5cdGV2ZW50aWZ5UHJvdG90eXBlLFxuXHRldmVudGlmeUluc3RhbmNlLFxuXHRFdmVudFZhcmlhYmxlLFxuXHRFdmVudEJvb2xlYW4sXG5cdG1ha2VQcm9taXNlXG59O1xuXG4iLCJcblxuXG5cbi8vIG92dmVycmlkZSBtb2R1bG8gdG8gYmVoYXZlIGJldHRlciBmb3IgbmVnYXRpdmUgbnVtYmVyc1xuZXhwb3J0IGZ1bmN0aW9uIG1vZChuLCBtKSB7XG4gICAgcmV0dXJuICgobiAlIG0pICsgbSkgJSBtO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRpdm1vZCh4LCBiYXNlKSB7XG4gICAgbGV0IG4gPSBNYXRoLmZsb29yKHggLyBiYXNlKVxuICAgIGxldCByID0gbW9kKHgsIGJhc2UpO1xuICAgIHJldHVybiBbbiwgcl07XG59XG5cblxuLypcbiAgICBzaW1pbGFyIHRvIHJhbmdlIGZ1bmN0aW9uIGluIHB5dGhvblxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmdlIChzdGFydCwgZW5kLCBzdGVwID0gMSwgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgIGNvbnN0IHtpbmNsdWRlX2VuZD1mYWxzZX0gPSBvcHRpb25zO1xuICAgIGlmIChzdGVwID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU3RlcCBjYW5ub3QgYmUgemVyby4nKTtcbiAgICB9XG4gICAgaWYgKHN0YXJ0IDwgZW5kKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSBzdGVwKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goaSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHN0YXJ0ID4gZW5kKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA+IGVuZDsgaSAtPSBzdGVwKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goaSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGluY2x1ZGVfZW5kKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGVuZCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cblxuXG4vKlxuICAgIFRoaXMgYWRkcyBiYXNpYyAoc3luY2hyb25vdXMpIGNhbGxiYWNrIHN1cHBvcnQgdG8gYW4gb2JqZWN0LlxuKi9cblxuZXhwb3J0IGNvbnN0IGNhbGxiYWNrID0gZnVuY3Rpb24gKCkge1xuXG4gICAgZnVuY3Rpb24gYWRkVG9JbnN0YW5jZShvYmplY3QpIHtcbiAgICAgICAgb2JqZWN0Ll9fY2FsbGJhY2tfY2FsbGJhY2tzID0gW107XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkX2NhbGxiYWNrIChoYW5kbGVyKSB7XG4gICAgICAgIGxldCBoYW5kbGUgPSB7XG4gICAgICAgICAgICBoYW5kbGVyOiBoYW5kbGVyXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fX2NhbGxiYWNrX2NhbGxiYWNrcy5wdXNoKGhhbmRsZSk7XG4gICAgICAgIHJldHVybiBoYW5kbGU7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIHJlbW92ZV9jYWxsYmFjayAoaGFuZGxlKSB7XG4gICAgICAgIGxldCBpbmRleCA9IHRoaXMuX19jYWxsYmFja19jYWxsYmFja3MuaW5kZXhvZihoYW5kbGUpO1xuICAgICAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICAgICAgdGhpcy5fX2NhbGxiYWNrX2NhbGxiYWNrcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIG5vdGlmeV9jYWxsYmFja3MgKGVBcmcpIHtcbiAgICAgICAgdGhpcy5fX2NhbGxiYWNrX2NhbGxiYWNrcy5mb3JFYWNoKGZ1bmN0aW9uKGhhbmRsZSkge1xuICAgICAgICAgICAgaGFuZGxlLmhhbmRsZXIoZUFyZyk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cblxuICAgIGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlIChfcHJvdG90eXBlKSB7XG4gICAgICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgICAgIGFkZF9jYWxsYmFjaywgcmVtb3ZlX2NhbGxiYWNrLCBub3RpZnlfY2FsbGJhY2tzXG4gICAgICAgIH1cbiAgICAgICAgT2JqZWN0LmFzc2lnbihfcHJvdG90eXBlLCBhcGkpO1xuICAgIH1cblxuICAgIHJldHVybiB7YWRkVG9JbnN0YW5jZSwgYWRkVG9Qcm90b3R5cGV9XG59KCk7XG5cbiIsImltcG9ydCB7ZGl2bW9kfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5cbi8qXG4gICAgVGltZW91dCBNb25pdG9yXG5cbiAgICBUaW1lb3V0IE1vbml0b3IgaXMgc2ltaWxhciB0byBzZXRJbnRlcnZhbCwgaW4gdGhlIHNlbnNlIHRoYXQgXG4gICAgaXQgYWxsb3dzIGNhbGxiYWNrcyB0byBiZSBmaXJlZCBwZXJpb2RpY2FsbHkgXG4gICAgd2l0aCBhIGdpdmVuIGRlbGF5IChpbiBtaWxsaXMpLiAgXG4gICAgXG4gICAgVGltZW91dCBNb25pdG9yIGlzIG1hZGUgdG8gc2FtcGxlIHRoZSBzdGF0ZSBcbiAgICBvZiBhIGR5bmFtaWMgb2JqZWN0LCBwZXJpb2RpY2FsbHkuIEZvciB0aGlzIHJlYXNvbiwgZWFjaCBjYWxsYmFjayBpcyBcbiAgICBib3VuZCB0byBhIG1vbml0b3JlZCBvYmplY3QsIHdoaWNoIHdlIGhlcmUgY2FsbCBhIHZhcmlhYmxlLiBcbiAgICBPbiBlYWNoIGludm9jYXRpb24sIGEgY2FsbGJhY2sgd2lsbCBwcm92aWRlIGEgZnJlc2hseSBzYW1wbGVkIFxuICAgIHZhbHVlIGZyb20gdGhlIHZhcmlhYmxlLlxuXG4gICAgVGhpcyB2YWx1ZSBpcyBhc3N1bWVkIHRvIGJlIGF2YWlsYWJsZSBieSBxdWVyeWluZyB0aGUgdmFyaWFibGUuIFxuXG4gICAgICAgIHYucXVlcnkoKSAtPiB7dmFsdWUsIGR5bmFtaWMsIG9mZnNldCwgdHN9XG5cbiAgICBJbiBhZGRpdGlvbiwgdGhlIHZhcmlhYmxlIG9iamVjdCBtYXkgc3dpdGNoIGJhY2sgYW5kIFxuICAgIGZvcnRoIGJldHdlZW4gZHluYW1pYyBhbmQgc3RhdGljIGJlaGF2aW9yLiBUaGUgVGltZW91dCBNb25pdG9yXG4gICAgdHVybnMgcG9sbGluZyBvZmYgd2hlbiB0aGUgdmFyaWFibGUgaXMgbm8gbG9uZ2VyIGR5bmFtaWMsIFxuICAgIGFuZCByZXN1bWVzIHBvbGxpbmcgd2hlbiB0aGUgb2JqZWN0IGJlY29tZXMgZHluYW1pYy5cblxuICAgIFN0YXRlIGNoYW5nZXMgYXJlIGV4cGVjdGVkIHRvIGJlIHNpZ25hbGxlZCB0aHJvdWdoIGEgPGNoYW5nZT4gZXZlbnQuXG5cbiAgICAgICAgc3ViID0gdi5vbihcImNoYW5nZVwiLCBjYWxsYmFjaylcbiAgICAgICAgdi5vZmYoc3ViKVxuXG4gICAgQ2FsbGJhY2tzIGFyZSBpbnZva2VkIG9uIGV2ZXJ5IDxjaGFuZ2U+IGV2ZW50LCBhcyB3ZWxsXG4gICAgYXMgcGVyaW9kaWNhbGx5IHdoZW4gdGhlIG9iamVjdCBpcyBpbiA8ZHluYW1pYz4gc3RhdGUuXG5cbiAgICAgICAgY2FsbGJhY2soe3ZhbHVlLCBkeW5hbWljLCBvZmZzZXQsIHRzfSlcblxuICAgIEZ1cnRoZXJtb3JlLCBpbiBvcmRlciB0byBzdXBwb3J0IGNvbnNpc3RlbnQgcmVuZGVyaW5nIG9mXG4gICAgc3RhdGUgY2hhbmdlcyBmcm9tIG1hbnkgZHluYW1pYyB2YXJpYWJsZXMsIGl0IGlzIGltcG9ydGFudCB0aGF0XG4gICAgY2FsbGJhY2tzIGFyZSBpbnZva2VkIGF0IHRoZSBzYW1lIHRpbWUgYXMgbXVjaCBhcyBwb3NzaWJsZSwgc29cbiAgICB0aGF0IGNoYW5nZXMgdGhhdCBvY2N1ciBuZWFyIGluIHRpbWUgY2FuIGJlIHBhcnQgb2YgdGhlIHNhbWVcbiAgICBzY3JlZW4gcmVmcmVzaC4gXG5cbiAgICBGb3IgdGhpcyByZWFzb24sIHRoZSBUaW1lb3V0TW9uaXRvciBncm91cHMgY2FsbGJhY2tzIGluIHRpbWVcbiAgICBhbmQgaW52b2tlcyBjYWxsYmFja3MgYXQgYXQgZml4ZWQgbWF4aW11bSByYXRlICgyMEh6LzUwbXMpLlxuICAgIFRoaXMgaW1wbGllcyB0aGF0IHBvbGxpbmcgY2FsbGJhY2tzIHdpbGwgZmFsbCBvbiBhIHNoYXJlZCBcbiAgICBwb2xsaW5nIGZyZXF1ZW5jeS5cblxuICAgIEF0IHRoZSBzYW1lIHRpbWUsIGNhbGxiYWNrcyBtYXkgaGF2ZSBpbmRpdmlkdWFsIGZyZXF1ZW5jaWVzIHRoYXRcbiAgICBhcmUgbXVjaCBsb3dlciByYXRlIHRoYW4gdGhlIG1heGltdW0gcmF0ZS4gVGhlIGltcGxlbWVudGF0aW9uXG4gICAgZG9lcyBub3QgcmVseSBvbiBhIGZpeGVkIDUwbXMgdGltZW91dCBmcmVxdWVuY3ksIGJ1dCBpcyB0aW1lb3V0IGJhc2VkLFxuICAgIHRodXMgdGhlcmUgaXMgbm8gcHJvY2Vzc2luZyBvciB0aW1lb3V0IGJldHdlZW4gY2FsbGJhY2tzLCBldmVuXG4gICAgaWYgYWxsIGNhbGxiYWNrcyBoYXZlIGxvdyByYXRlcy5cblxuICAgIEl0IGlzIHNhZmUgdG8gZGVmaW5lIG11bHRpcGxlIGNhbGxhYmFja3MgZm9yIGEgc2luZ2xlIHZhcmlhYmxlLCBlYWNoXG4gICAgY2FsbGJhY2sgd2l0aCBhIGRpZmZlcmVudCBwb2xsaW5nIGZyZXF1ZW5jeS5cblxuICAgIG9wdGlvbnNcbiAgICAgICAgPHJhdGU+IC0gZGVmYXVsdCA1MDogc3BlY2lmeSBtaW5pbXVtIGZyZXF1ZW5jeSBpbiBtc1xuXG4qL1xuXG5cbmNvbnN0IFJBVEVfTVMgPSA1MFxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBUSU1FT1VUIE1PTklUT1JcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBCYXNlIGNsYXNzIGZvciBUaW1lb3V0IE1vbml0b3IgYW5kIEZyYW1lcmF0ZSBNb25pdG9yXG4qL1xuXG5jbGFzcyBUaW1lb3V0TW9uaXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG5cbiAgICAgICAgdGhpcy5fb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe3JhdGU6IFJBVEVfTVN9LCBvcHRpb25zKTtcbiAgICAgICAgaWYgKHRoaXMuX29wdGlvbnMucmF0ZSA8IFJBVEVfTVMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgaWxsZWdhbCByYXRlICR7cmF0ZX0sIG1pbmltdW0gcmF0ZSBpcyAke1JBVEVfTVN9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLypcbiAgICAgICAgICAgIG1hcFxuICAgICAgICAgICAgaGFuZGxlIC0+IHtjYWxsYmFjaywgdmFyaWFibGUsIGRlbGF5fVxuICAgICAgICAgICAgLSB2YXJpYWJsZTogdGFyZ2V0IGZvciBzYW1wbGluZ1xuICAgICAgICAgICAgLSBjYWxsYmFjazogZnVuY3Rpb24odmFsdWUpXG4gICAgICAgICAgICAtIGRlbGF5OiBiZXR3ZWVuIHNhbXBsZXMgKHdoZW4gdmFyaWFibGUgaXMgZHluYW1pYylcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2V0ID0gbmV3IFNldCgpO1xuICAgICAgICAvKlxuICAgICAgICAgICAgdmFyaWFibGUgbWFwXG4gICAgICAgICAgICB2YXJpYWJsZSAtPiB7c3ViLCBwb2xsaW5nLCBoYW5kbGVzOltdfVxuICAgICAgICAgICAgLSBzdWIgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgICAgICAgICAtIHBvbGxpbmc6IHRydWUgaWYgdmFyaWFibGUgbmVlZHMgcG9sbGluZ1xuICAgICAgICAgICAgLSBoYW5kbGVzOiBsaXN0IG9mIGhhbmRsZXMgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgICAgICovXG4gICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgLy8gdmFyaWFibGUgY2hhbmdlIGhhbmRsZXJcbiAgICAgICAgdGhpcy5fX29udmFyaWFibGVjaGFuZ2UgPSB0aGlzLl9vbnZhcmlhYmxlY2hhbmdlLmJpbmQodGhpcyk7XG4gICAgfVxuXG4gICAgYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIC8vIHJlZ2lzdGVyIGJpbmRpbmdcbiAgICAgICAgbGV0IGhhbmRsZSA9IHtjYWxsYmFjaywgdmFyaWFibGUsIGRlbGF5fTtcbiAgICAgICAgdGhpcy5fc2V0LmFkZChoYW5kbGUpO1xuICAgICAgICAvLyByZWdpc3RlciB2YXJpYWJsZVxuICAgICAgICBpZiAoIXRoaXMuX3ZhcmlhYmxlX21hcC5oYXModmFyaWFibGUpKSB7XG4gICAgICAgICAgICBsZXQgc3ViID0gdmFyaWFibGUub24oXCJjaGFuZ2VcIiwgdGhpcy5fX29udmFyaWFibGVjaGFuZ2UpO1xuICAgICAgICAgICAgbGV0IGl0ZW0gPSB7c3ViLCBwb2xsaW5nOmZhbHNlLCBoYW5kbGVzOiBbaGFuZGxlXX07XG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuc2V0KHZhcmlhYmxlLCBpdGVtKTtcbiAgICAgICAgICAgIC8vdGhpcy5fcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpLmhhbmRsZXMucHVzaChoYW5kbGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBoYW5kbGU7XG4gICAgfVxuXG4gICAgcmVsZWFzZShoYW5kbGUpIHtcbiAgICAgICAgLy8gY2xlYW51cFxuICAgICAgICBsZXQgcmVtb3ZlZCA9IHRoaXMuX3NldC5kZWxldGUoaGFuZGxlKTtcbiAgICAgICAgaWYgKCFyZW1vdmVkKSByZXR1cm47XG4gICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNsZWFudXAgdmFyaWFibGUgbWFwXG4gICAgICAgIGxldCB2YXJpYWJsZSA9IGhhbmRsZS52YXJpYWJsZTtcbiAgICAgICAgbGV0IHtzdWIsIGhhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCBpZHggPSBoYW5kbGVzLmluZGV4T2YoaGFuZGxlKTtcbiAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICBoYW5kbGVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChoYW5kbGVzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAvLyB2YXJpYWJsZSBoYXMgbm8gaGFuZGxlc1xuICAgICAgICAgICAgLy8gY2xlYW51cCB2YXJpYWJsZSBtYXBcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5kZWxldGUodmFyaWFibGUpO1xuICAgICAgICAgICAgdmFyaWFibGUub2ZmKHN1Yik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICB2YXJpYWJsZSBlbWl0cyBhIGNoYW5nZSBldmVudFxuICAgICovXG4gICAgX29udmFyaWFibGVjaGFuZ2UgKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIGxldCB2YXJpYWJsZSA9IGVJbmZvLnNyYztcbiAgICAgICAgLy8gZGlyZWN0IGNhbGxiYWNrIC0gY291bGQgdXNlIGVBcmcgaGVyZVxuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCBzdGF0ZSA9IGVBcmc7XG4gICAgICAgIC8vIHJlZXZhbHVhdGUgcG9sbGluZ1xuICAgICAgICB0aGlzLl9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUsIHN0YXRlKTtcbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICBoYW5kbGUuY2FsbGJhY2soc3RhdGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgc3RhcnQgb3Igc3RvcCBwb2xsaW5nIGlmIG5lZWRlZFxuICAgICovXG4gICAgX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSwgc3RhdGUpIHtcbiAgICAgICAgbGV0IGl0ZW0gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IHtwb2xsaW5nOndhc19wb2xsaW5nfSA9IGl0ZW07XG4gICAgICAgIHN0YXRlID0gc3RhdGUgfHwgdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgbGV0IHNob3VsZF9iZV9wb2xsaW5nID0gc3RhdGUuZHluYW1pYztcbiAgICAgICAgaWYgKCF3YXNfcG9sbGluZyAmJiBzaG91bGRfYmVfcG9sbGluZykge1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0cyh2YXJpYWJsZSk7XG4gICAgICAgIH0gZWxzZSBpZiAod2FzX3BvbGxpbmcgJiYgIXNob3VsZF9iZV9wb2xsaW5nKSB7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHNldCB0aW1lb3V0IGZvciBhbGwgY2FsbGJhY2tzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICovXG4gICAgX3NldF90aW1lb3V0cyh2YXJpYWJsZSkge1xuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3NldF90aW1lb3V0KGhhbmRsZSkge1xuICAgICAgICBsZXQgZGVsdGEgPSB0aGlzLl9jYWxjdWxhdGVfZGVsdGEoaGFuZGxlLmRlbGF5KTtcbiAgICAgICAgbGV0IGhhbmRsZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLl9oYW5kbGVfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIGhhbmRsZS50aWQgPSBzZXRUaW1lb3V0KGhhbmRsZXIsIGRlbHRhKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBhZGp1c3QgZGVsYXkgc28gdGhhdCBpZiBmYWxscyBvblxuICAgICAgICB0aGUgbWFpbiB0aWNrIHJhdGVcbiAgICAqL1xuICAgIF9jYWxjdWxhdGVfZGVsdGEoZGVsYXkpIHtcbiAgICAgICAgbGV0IHJhdGUgPSB0aGlzLl9vcHRpb25zLnJhdGU7XG4gICAgICAgIGxldCBub3cgPSBNYXRoLnJvdW5kKHBlcmZvcm1hbmNlLm5vdygpKTtcbiAgICAgICAgbGV0IFtub3dfbiwgbm93X3JdID0gZGl2bW9kKG5vdywgcmF0ZSk7XG4gICAgICAgIGxldCBbbiwgcl0gPSBkaXZtb2Qobm93ICsgZGVsYXksIHJhdGUpO1xuICAgICAgICBsZXQgdGFyZ2V0ID0gTWF0aC5tYXgobiwgbm93X24gKyAxKSpyYXRlO1xuICAgICAgICByZXR1cm4gdGFyZ2V0IC0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgY2xlYXIgYWxsIHRpbWVvdXRzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICovXG4gICAgX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKSB7XG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIGlmIChoYW5kbGUudGlkICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dChoYW5kbGUudGlkKTtcbiAgICAgICAgICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgaGFuZGxlIHRpbWVvdXRcbiAgICAqL1xuICAgIF9oYW5kbGVfdGltZW91dChoYW5kbGUpIHtcbiAgICAgICAgLy8gZHJvcCBpZiBoYW5kbGUgdGlkIGhhcyBiZWVuIGNsZWFyZWRcbiAgICAgICAgaWYgKGhhbmRsZS50aWQgPT0gdW5kZWZpbmVkKSByZXR1cm47XG4gICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhbGxiYWNrXG4gICAgICAgIGxldCB7dmFyaWFibGV9ID0gaGFuZGxlO1xuICAgICAgICBsZXQgc3RhdGUgPSB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICAvLyByZXNjaGVkdWxlIHRpbWVvdXRzIGZvciBjYWxsYmFja3NcbiAgICAgICAgaWYgKHN0YXRlLmR5bmFtaWMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvKlxuICAgICAgICAgICAgICAgIG1ha2Ugc3VyZSBwb2xsaW5nIHN0YXRlIGlzIGFsc28gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzIHdvdWxkIG9ubHkgb2NjdXIgaWYgdGhlIHZhcmlhYmxlXG4gICAgICAgICAgICAgICAgd2VudCBmcm9tIHJlcG9ydGluZyBkeW5hbWljIHRydWUgdG8gZHluYW1pYyBmYWxzZSxcbiAgICAgICAgICAgICAgICB3aXRob3V0IGVtbWl0dGluZyBhIGNoYW5nZSBldmVudCAtIHRodXNcbiAgICAgICAgICAgICAgICB2aW9sYXRpbmcgdGhlIGFzc3VtcHRpb24uIFRoaXMgcHJlc2VydmVzXG4gICAgICAgICAgICAgICAgaW50ZXJuYWwgaW50ZWdyaXR5IGkgdGhlIG1vbml0b3IuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgbGV0IGl0ZW0gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIC8vXG4gICAgICAgIGhhbmRsZS5jYWxsYmFjayhzdGF0ZSk7XG4gICAgfVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEZSQU1FUkFURSBNT05JVE9SXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuY2xhc3MgRnJhbWVyYXRlTW9uaXRvciBleHRlbmRzIFRpbWVvdXRNb25pdG9yIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICAgIHRoaXMuX2hhbmRsZTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICB0aW1lb3V0cyBhcmUgb2Jzb2xldGVcbiAgICAqL1xuICAgIF9zZXRfdGltZW91dHModmFyaWFibGUpIHt9XG4gICAgX3NldF90aW1lb3V0KGhhbmRsZSkge31cbiAgICBfY2FsY3VsYXRlX2RlbHRhKGRlbGF5KSB7fVxuICAgIF9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSkge31cbiAgICBfaGFuZGxlX3RpbWVvdXQoaGFuZGxlKSB7fVxuXG4gICAgX29udmFyaWFibGVjaGFuZ2UgKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIHN1cGVyLl9vbnZhcmlhYmxlY2hhbmdlKGVBcmcsIGVJbmZvKTtcbiAgICAgICAgLy8ga2ljayBvZmYgY2FsbGJhY2sgbG9vcCBkcml2ZW4gYnkgcmVxdWVzdCBhbmltYXRpb25mcmFtZVxuICAgICAgICB0aGlzLl9jYWxsYmFjaygpO1xuICAgIH1cblxuICAgIF9jYWxsYmFjaygpIHtcbiAgICAgICAgLy8gY2FsbGJhY2sgdG8gYWxsIHZhcmlhYmxlcyB3aGljaCByZXF1aXJlIHBvbGxpbmdcbiAgICAgICAgbGV0IHZhcmlhYmxlcyA9IFsuLi50aGlzLl92YXJpYWJsZV9tYXAuZW50cmllcygpXVxuICAgICAgICAgICAgLmZpbHRlcigoW3ZhcmlhYmxlLCBpdGVtXSkgPT4gaXRlbS5wb2xsaW5nKVxuICAgICAgICAgICAgLm1hcCgoW3ZhcmlhYmxlLCBpdGVtXSkgPT4gdmFyaWFibGUpO1xuICAgICAgICBpZiAodmFyaWFibGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIGNhbGxiYWNrXG4gICAgICAgICAgICBmb3IgKGxldCB2YXJpYWJsZSBvZiB2YXJpYWJsZXMpIHtcbiAgICAgICAgICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgICAgICAgICAgbGV0IHJlcyA9IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHJlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogXG4gICAgICAgICAgICAgICAgcmVxdWVzdCBuZXh0IGNhbGxiYWNrIGFzIGxvbmcgYXMgYXQgbGVhc3Qgb25lIHZhcmlhYmxlIFxuICAgICAgICAgICAgICAgIGlzIHJlcXVpcmluZyBwb2xsaW5nXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMuX2NhbGxiYWNrLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBCSU5EIFJFTEVBU0VcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuY29uc3QgbW9uaXRvciA9IG5ldyBUaW1lb3V0TW9uaXRvcigpO1xuY29uc3QgZnJhbWVyYXRlX21vbml0b3IgPSBuZXcgRnJhbWVyYXRlTW9uaXRvcigpO1xuXG5leHBvcnQgZnVuY3Rpb24gYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgbGV0IGhhbmRsZTtcbiAgICBpZiAoQm9vbGVhbihwYXJzZUZsb2F0KGRlbGF5KSkpIHtcbiAgICAgICAgaGFuZGxlID0gbW9uaXRvci5iaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gW1widGltZW91dFwiLCBoYW5kbGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGhhbmRsZSA9IGZyYW1lcmF0ZV9tb25pdG9yLmJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCAwLCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIFtcImZyYW1lcmF0ZVwiLCBoYW5kbGVdO1xuICAgIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiByZWxlYXNlKGhhbmRsZSkge1xuICAgIGxldCBbdHlwZSwgX2hhbmRsZV0gPSBoYW5kbGU7XG4gICAgaWYgKHR5cGUgPT0gXCJ0aW1lb3V0XCIpIHtcbiAgICAgICAgcmV0dXJuIG1vbml0b3IucmVsZWFzZShfaGFuZGxlKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJmcmFtZXJhdGVcIikge1xuICAgICAgICByZXR1cm4gZnJhbWVyYXRlX21vbml0b3IucmVsZWFzZShfaGFuZGxlKTtcbiAgICB9XG59XG5cbiIsIi8qXG4gICAgXG4gICAgSU5URVJWQUwgRU5EUE9JTlRTXG5cbiAgICAqIGludGVydmFsIGVuZHBvaW50cyBhcmUgZGVmaW5lZCBieSBbdmFsdWUsIHNpZ25dLCBmb3IgZXhhbXBsZVxuICAgICogXG4gICAgKiA0KSAtPiBbNCwtMV0gLSBlbmRwb2ludCBpcyBvbiB0aGUgbGVmdCBvZiA0XG4gICAgKiBbNCwgNCwgNF0gLT4gWzQsIDBdIC0gZW5kcG9pbnQgaXMgYXQgNCBcbiAgICAqICg0IC0+IFs0LCAxXSAtIGVuZHBvaW50IGlzIG9uIHRoZSByaWdodCBvZiA0KVxuICAgICogXG4gICAgKiBUaGlzIHJlcHJlc2VudGF0aW9uIGVuc3VyZXMgdGhhdCB0aGUgaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBvcmRlcmVkIGFuZCBhbGxvd3NcbiAgICAqIGludGVydmFscyB0byBiZSBleGNsdXNpdmUgb3IgaW5jbHVzaXZlLCB5ZXQgY292ZXIgdGhlIGVudGlyZSByZWFsIGxpbmUgXG4gICAgKiBcbiAgICAqIFthLGJdLCAoYSxiKSwgW2EsYiksIFthLCBiKSBhcmUgYWxsIHZhbGlkIGludGVydmFsc1xuXG4qL1xuXG4vKlxuICAgIEVuZHBvaW50IGNvbXBhcmlzb25cbiAgICByZXR1cm5zIFxuICAgICAgICAtIG5lZ2F0aXZlIDogY29ycmVjdCBvcmRlclxuICAgICAgICAtIDAgOiBlcXVhbFxuICAgICAgICAtIHBvc2l0aXZlIDogd3Jvbmcgb3JkZXJcblxuXG4gICAgTk9URSBcbiAgICAtIGNtcCg0XSxbNCApID09IDAgLSBzaW5jZSB0aGVzZSBhcmUgdGhlIHNhbWUgd2l0aCByZXNwZWN0IHRvIHNvcnRpbmdcbiAgICAtIGJ1dCBpZiB5b3Ugd2FudCB0byBzZWUgaWYgdHdvIGludGVydmFscyBhcmUgb3ZlcmxhcHBpbmcgaW4gdGhlIGVuZHBvaW50c1xuICAgIGNtcChoaWdoX2EsIGxvd19iKSA+IDAgdGhpcyB3aWxsIG5vdCBiZSBnb29kXG4gICAgXG4qLyBcblxuXG5mdW5jdGlvbiBjbXBOdW1iZXJzKGEsIGIpIHtcbiAgICBpZiAoYSA9PT0gYikgcmV0dXJuIDA7XG4gICAgaWYgKGEgPT09IEluZmluaXR5KSByZXR1cm4gMTtcbiAgICBpZiAoYiA9PT0gSW5maW5pdHkpIHJldHVybiAtMTtcbiAgICBpZiAoYSA9PT0gLUluZmluaXR5KSByZXR1cm4gLTE7XG4gICAgaWYgKGIgPT09IC1JbmZpbml0eSkgcmV0dXJuIDE7XG4gICAgcmV0dXJuIGEgLSBiO1xuICB9XG5cbmZ1bmN0aW9uIGVuZHBvaW50X2NtcCAocDEsIHAyKSB7XG4gICAgbGV0IFt2MSwgczFdID0gcDE7XG4gICAgbGV0IFt2MiwgczJdID0gcDI7XG4gICAgbGV0IGRpZmYgPSBjbXBOdW1iZXJzKHYxLCB2Mik7XG4gICAgcmV0dXJuIChkaWZmICE9IDApID8gZGlmZiA6IHMxIC0gczI7XG59XG5cbmZ1bmN0aW9uIGVuZHBvaW50X2x0IChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPCAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9sZSAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpIDw9IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2d0IChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPiAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9nZSAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpID49IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2VxIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPT0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfbWluKHAxLCBwMikge1xuICAgIHJldHVybiAoZW5kcG9pbnRfbGUocDEsIHAyKSkgPyBwMSA6IHAyO1xufVxuZnVuY3Rpb24gZW5kcG9pbnRfbWF4KHAxLCBwMikge1xuICAgIHJldHVybiAoZW5kcG9pbnRfZ2UocDEsIHAyKSkgPyBwMSA6IHAyO1xufVxuXG4vKipcbiAqIGZsaXAgZW5kcG9pbnQgdG8gdGhlIG90aGVyIHNpZGVcbiAqIFxuICogdXNlZnVsIGZvciBtYWtpbmcgYmFjay10by1iYWNrIGludGVydmFscyBcbiAqIFxuICogaGlnaCkgPC0+IFtsb3dcbiAqIGhpZ2hdIDwtPiAobG93XG4gKi9cblxuZnVuY3Rpb24gZW5kcG9pbnRfZmxpcChwLCB0YXJnZXQpIHtcbiAgICBsZXQgW3Ysc10gPSBwO1xuICAgIGlmICghaXNGaW5pdGUodikpIHtcbiAgICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIGlmICh0YXJnZXQgPT0gXCJsb3dcIikge1xuICAgIFx0Ly8gYXNzdW1lIHBvaW50IGlzIGhpZ2g6IHNpZ24gbXVzdCBiZSAtMSBvciAwXG4gICAgXHRpZiAocyA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcImVuZHBvaW50IGlzIGFscmVhZHkgbG93XCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcysxXTtcbiAgICB9IGVsc2UgaWYgKHRhcmdldCA9PSBcImhpZ2hcIikge1xuXHRcdC8vIGFzc3VtZSBwb2ludCBpcyBsb3c6IHNpZ24gaXMgMCBvciAxXG4gICAgXHRpZiAocyA8IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcImVuZHBvaW50IGlzIGFscmVhZHkgaGlnaFwiKTsgICAgXHRcdFxuICAgIFx0fVxuICAgICAgICBwID0gW3YsIHMtMV07XG4gICAgfSBlbHNlIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgdHlwZVwiLCB0YXJnZXQpO1xuICAgIH1cbiAgICByZXR1cm4gcDtcbn1cblxuXG4vKlxuICAgIHJldHVybnMgbG93IGFuZCBoaWdoIGVuZHBvaW50cyBmcm9tIGludGVydmFsXG4qL1xuZnVuY3Rpb24gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KSB7XG4gICAgbGV0IFtsb3csIGhpZ2gsIGxvd0Nsb3NlZCwgaGlnaENsb3NlZF0gPSBpdHY7XG4gICAgbGV0IGxvd19wID0gKGxvd0Nsb3NlZCkgPyBbbG93LCAwXSA6IFtsb3csIDFdOyBcbiAgICBsZXQgaGlnaF9wID0gKGhpZ2hDbG9zZWQpID8gW2hpZ2gsIDBdIDogW2hpZ2gsIC0xXTtcbiAgICByZXR1cm4gW2xvd19wLCBoaWdoX3BdO1xufVxuXG5cbi8qXG4gICAgSU5URVJWQUxTXG5cbiAgICBJbnRlcnZhbHMgYXJlIFtsb3csIGhpZ2gsIGxvd0Nsb3NlZCwgaGlnaENsb3NlZF1cblxuKi8gXG5cbi8qXG4gICAgcmV0dXJuIHRydWUgaWYgcG9pbnQgcCBpcyBjb3ZlcmVkIGJ5IGludGVydmFsIGl0dlxuICAgIHBvaW50IHAgY2FuIGJlIG51bWJlciBwIG9yIGEgcG9pbnQgW3Asc11cblxuICAgIGltcGxlbWVudGVkIGJ5IGNvbXBhcmluZyBwb2ludHNcbiAgICBleGNlcHRpb24gaWYgaW50ZXJ2YWwgaXMgbm90IGRlZmluZWRcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBwKSB7XG4gICAgbGV0IFtsb3dfcCwgaGlnaF9wXSA9IGVuZHBvaW50c19mcm9tX2ludGVydmFsKGl0dik7XG4gICAgLy8gY292ZXJzOiBsb3cgPD0gcCA8PSBoaWdoXG4gICAgcmV0dXJuIGVuZHBvaW50X2xlKGxvd19wLCBwKSAmJiBlbmRwb2ludF9sZShwLCBoaWdoX3ApO1xufVxuLy8gY29udmVuaWVuY2VcbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19wb2ludChpdHYsIHApIHtcbiAgICByZXR1cm4gaW50ZXJ2YWxfY292ZXJzX2VuZHBvaW50KGl0diwgW3AsIDBdKTtcbn1cblxuXG5cbi8qXG4gICAgUmV0dXJuIHRydWUgaWYgaW50ZXJ2YWwgaGFzIGxlbmd0aCAwXG4qL1xuZnVuY3Rpb24gaW50ZXJ2YWxfaXNfc2luZ3VsYXIoaW50ZXJ2YWwpIHtcbiAgICByZXR1cm4gaW50ZXJ2YWxbMF0gPT0gaW50ZXJ2YWxbMV1cbn1cblxuLypcbiAgICBDcmVhdGUgaW50ZXJ2YWwgZnJvbSBlbmRwb2ludHNcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyhwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICAvLyBwMSBtdXN0IGJlIGEgbG93IHBvaW50XG4gICAgaWYgKHMxID09IC0xKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgbG93IHBvaW50XCIsIHAxKTtcbiAgICB9XG4gICAgaWYgKHMyID09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdlYWwgaGlnaCBwb2ludFwiLCBwMik7ICAgXG4gICAgfVxuICAgIHJldHVybiBbdjEsIHYyLCAoczE9PTApLCAoczI9PTApXVxufVxuXG5mdW5jdGlvbiBpc051bWJlcihuKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBuID09IFwibnVtYmVyXCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbnRlcnZhbF9mcm9tX2lucHV0KGlucHV0KXtcbiAgICBsZXQgaXR2ID0gaW5wdXQ7XG4gICAgaWYgKGl0diA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaW5wdXQgaXMgdW5kZWZpbmVkXCIpO1xuICAgIH1cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXR2KSkge1xuICAgICAgICBpZiAoaXNOdW1iZXIoaXR2KSkge1xuICAgICAgICAgICAgLy8gaW5wdXQgaXMgc2luZ3VsYXIgbnVtYmVyXG4gICAgICAgICAgICBpdHYgPSBbaXR2LCBpdHYsIHRydWUsIHRydWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbnB1dDogJHtpbnB1dH06IG11c3QgYmUgQXJyYXkgb3IgTnVtYmVyYClcbiAgICAgICAgfVxuICAgIH07XG4gICAgLy8gbWFrZSBzdXJlIGludGVydmFsIGlzIGxlbmd0aCA0XG4gICAgaWYgKGl0di5sZW5ndGggPT0gMSkge1xuICAgICAgICBpdHYgPSBbaXR2WzBdLCBpdHZbMF0sIHRydWUsIHRydWVdXG4gICAgfSBlbHNlIGlmIChpdHYubGVuZ3RoID09IDIpIHtcbiAgICAgICAgaXR2ID0gaXR2LmNvbmNhdChbdHJ1ZSwgZmFsc2VdKTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMykge1xuICAgICAgICBpdHYgPSBpdHYucHVzaChmYWxzZSk7XG4gICAgfSBlbHNlIGlmIChpdHYubGVuZ3RoID4gNCkge1xuICAgICAgICBpdHYgPSBpdHYuc2xpY2UoMCw0KTtcbiAgICB9XG4gICAgbGV0IFtsb3csIGhpZ2gsIGxvd0luY2x1ZGUsIGhpZ2hJbmNsdWRlXSA9IGl0djtcbiAgICAvLyB1bmRlZmluZWRcbiAgICBpZiAobG93ID09IHVuZGVmaW5lZCB8fCBsb3cgPT0gbnVsbCkge1xuICAgICAgICBsb3cgPSAtSW5maW5pdHk7XG4gICAgfVxuICAgIGlmIChoaWdoID09IHVuZGVmaW5lZCB8fCBoaWdoID09IG51bGwpIHtcbiAgICAgICAgaGlnaCA9IEluZmluaXR5O1xuICAgIH1cbiAgICAvLyBjaGVjayB0aGF0IGxvdyBhbmQgaGlnaCBhcmUgbnVtYmVyc1xuICAgIGlmICghaXNOdW1iZXIobG93KSkgdGhyb3cgbmV3IEVycm9yKFwibG93IG5vdCBhIG51bWJlclwiLCBsb3cpO1xuICAgIGlmICghaXNOdW1iZXIoaGlnaCkpIHRocm93IG5ldyBFcnJvcihcImhpZ2ggbm90IGEgbnVtYmVyXCIsIGhpZ2gpO1xuICAgIC8vIGNoZWNrIHRoYXQgbG93IDw9IGhpZ2hcbiAgICBpZiAobG93ID4gaGlnaCkgdGhyb3cgbmV3IEVycm9yKFwibG93ID4gaGlnaFwiLCBsb3csIGhpZ2gpO1xuICAgIC8vIHNpbmdsZXRvblxuICAgIGlmIChsb3cgPT0gaGlnaCkge1xuICAgICAgICBsb3dJbmNsdWRlID0gdHJ1ZTtcbiAgICAgICAgaGlnaEluY2x1ZGUgPSB0cnVlO1xuICAgIH1cbiAgICAvLyBjaGVjayBpbmZpbml0eSB2YWx1ZXNcbiAgICBpZiAobG93ID09IC1JbmZpbml0eSkge1xuICAgICAgICBsb3dJbmNsdWRlID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGhpZ2ggPT0gSW5maW5pdHkpIHtcbiAgICAgICAgaGlnaEluY2x1ZGUgPSB0cnVlO1xuICAgIH1cbiAgICAvLyBjaGVjayB0aGF0IGxvd0luY2x1ZGUsIGhpZ2hJbmNsdWRlIGFyZSBib29sZWFuc1xuICAgIGlmICh0eXBlb2YgbG93SW5jbHVkZSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibG93SW5jbHVkZSBub3QgYm9vbGVhblwiKTtcbiAgICB9IFxuICAgIGlmICh0eXBlb2YgaGlnaEluY2x1ZGUgIT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImhpZ2hJbmNsdWRlIG5vdCBib29sZWFuXCIpO1xuICAgIH1cbiAgICByZXR1cm4gW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdO1xufVxuXG5cblxuXG5leHBvcnQgY29uc3QgZW5kcG9pbnQgPSB7XG4gICAgbGU6IGVuZHBvaW50X2xlLFxuICAgIGx0OiBlbmRwb2ludF9sdCxcbiAgICBnZTogZW5kcG9pbnRfZ2UsXG4gICAgZ3Q6IGVuZHBvaW50X2d0LFxuICAgIGNtcDogZW5kcG9pbnRfY21wLFxuICAgIGVxOiBlbmRwb2ludF9lcSxcbiAgICBtaW46IGVuZHBvaW50X21pbixcbiAgICBtYXg6IGVuZHBvaW50X21heCxcbiAgICBmbGlwOiBlbmRwb2ludF9mbGlwLFxuICAgIGZyb21faW50ZXJ2YWw6IGVuZHBvaW50c19mcm9tX2ludGVydmFsXG59XG5leHBvcnQgY29uc3QgaW50ZXJ2YWwgPSB7XG4gICAgY292ZXJzX2VuZHBvaW50OiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQsXG4gICAgY292ZXJzX3BvaW50OiBpbnRlcnZhbF9jb3ZlcnNfcG9pbnQsIFxuICAgIGlzX3Npbmd1bGFyOiBpbnRlcnZhbF9pc19zaW5ndWxhcixcbiAgICBmcm9tX2VuZHBvaW50czogaW50ZXJ2YWxfZnJvbV9lbmRwb2ludHMsXG4gICAgZnJvbV9pbnB1dDogaW50ZXJ2YWxfZnJvbV9pbnB1dFxufVxuIiwiaW1wb3J0IHsgZXZlbnRpZnkgfSBmcm9tIFwiLi9ldmVudGlmeS5qc1wiO1xuaW1wb3J0IHsgY2FsbGJhY2sgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5pbXBvcnQgeyBiaW5kLCByZWxlYXNlIH0gZnJvbSBcIi4vbW9uaXRvci5qc1wiO1xuXG5pbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgcmFuZ2UgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIENMT0NLIFBST1ZJREVSIEJBU0VcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBEZWZpbmVzIHRoZSBpbnRlcmZhY2Ugd2hpY2ggbmVlZHMgdG8gYmUgaW1wbGVtZW50ZWRcbiAqIGJ5IGNsb2NrIHByb3ZpZGVycy5cbiAqL1xuXG5leHBvcnQgY2xhc3MgQ2xvY2tQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuICAgIG5vdygpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKENsb2NrUHJvdmlkZXJCYXNlLnByb3RvdHlwZSk7XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTVEFURSBQUk9WSURFUiBCQVNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIEJhc2UgY2xhc3MgZm9yIGFsbCBzdGF0ZSBwcm92aWRlcnNcblxuICAgIC0gb2JqZWN0IHdpdGggY29sbGVjdGlvbiBvZiBpdGVtc1xuICAgIC0gY291bGQgYmUgbG9jYWwgLSBvciBwcm94eSB0byBvbmxpbmUgc291cmNlXG5cbiAgICByZXByZXNlbnRzIGEgZHluYW1pYyBjb2xsZWN0aW9uIG9mIGl0ZW1zXG4gICAge2l0diwgdHlwZSwgLi4uZGF0YX1cbiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0ZVByb3ZpZGVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiB1cGRhdGUgZnVuY3Rpb25cbiAgICAgKiBjYWxsZWQgZnJvbSBjdXJzb3Igb3IgbGF5ZXIgb2JqZWN0c1xuICAgICAqIGZvciBvbmxpbmUgaW1wbGVtZW50YXRpb24sIHRoaXMgd2lsbFxuICAgICAqIHR5cGljYWxseSByZXN1bHQgaW4gYSBuZXR3b3JrIHJlcXVlc3QgXG4gICAgICogdG8gdXBkYXRlIHNvbWUgb25saW5lIGl0ZW0gY29sbGVjdGlvblxuICAgICAqL1xuICAgIHVwZGF0ZShpdGVtcyl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZXR1cm4gYXJyYXkgd2l0aCBhbGwgaXRlbXMgaW4gY29sbGVjdGlvbiBcbiAgICAgKiAtIG5vIHJlcXVpcmVtZW50IHdydCBvcmRlclxuICAgICAqL1xuXG4gICAgZ2V0IGl0ZW1zKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc2lnbmFsIGlmIGl0ZW1zIGNhbiBiZSBvdmVybGFwcGluZyBvciBub3RcbiAgICAgKi9cblxuICAgIGdldCBpbmZvICgpIHtcbiAgICAgICAgcmV0dXJuIHtvdmVybGFwcGluZzogdHJ1ZX07XG4gICAgfVxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoU3RhdGVQcm92aWRlckJhc2UucHJvdG90eXBlKTtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUiBCQVNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLl9pbmRleDtcblxuICAgICAgICBjYWxsYmFjay5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICAvLyBkZWZpbmUgY2hhbmdlIGV2ZW50XG4gICAgICAgIGV2ZW50aWZ5LmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlEZWZpbmUoXCJjaGFuZ2VcIiwge2luaXQ6dHJ1ZX0pO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBnZXRDYWNoZU9iamVjdCAoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTsgICAgIFxuICAgIH1cblxuICAgIGdldCBpbmRleCAoKSB7cmV0dXJuIHRoaXMuX2luZGV4fTtcbiAgICBcblxuICAgIC8qXG4gICAgICAgIFNhbXBsZSBMYXllciBieSB0aW1lbGluZSBvZmZzZXQgaW5jcmVtZW50c1xuICAgICAgICByZXR1cm4gbGlzdCBvZiB0dXBsZXMgW3ZhbHVlLCBvZmZzZXRdXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICAgLSBzdGFydFxuICAgICAgICAtIHN0b3BcbiAgICAgICAgLSBzdGVwXG4gICAgKi9cbiAgICBzYW1wbGUob3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge3N0YXJ0PS1JbmZpbml0eSwgc3RvcD1JbmZpbml0eSwgc3RlcD0xfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzdGFydCA+IHN0b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciAoXCJzdG9wIG11c3QgYmUgbGFyZ2VyIHRoYW4gc3RhcnRcIiwgc3RhcnQsIHN0b3ApXG4gICAgICAgIH1cbiAgICAgICAgc3RhcnQgPSBbc3RhcnQsIDBdO1xuICAgICAgICBzdG9wID0gW3N0b3AsIDBdO1xuXG4gICAgICAgIHN0YXJ0ID0gZW5kcG9pbnQubWF4KHRoaXMuaW5kZXguZmlyc3QoKSwgc3RhcnQpO1xuICAgICAgICBzdG9wID0gZW5kcG9pbnQubWluKHRoaXMuaW5kZXgubGFzdCgpLCBzdG9wKTtcbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmdldENhY2hlT2JqZWN0KCk7XG4gICAgICAgIHJldHVybiByYW5nZShzdGFydFswXSwgc3RvcFswXSwgc3RlcCwge2luY2x1ZGVfZW5kOnRydWV9KVxuICAgICAgICAgICAgLm1hcCgob2Zmc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtjYWNoZS5xdWVyeShvZmZzZXQpLnZhbHVlLCBvZmZzZXRdO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoTGF5ZXJCYXNlLnByb3RvdHlwZSk7XG5ldmVudGlmeS5hZGRUb1Byb3RvdHlwZShMYXllckJhc2UucHJvdG90eXBlKTtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBDVVJTT1IgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIEN1cnNvckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICBjYWxsYmFjay5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICAvLyBkZWZpbmUgY2hhbmdlIGV2ZW50XG4gICAgICAgIGV2ZW50aWZ5LmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlEZWZpbmUoXCJjaGFuZ2VcIiwge2luaXQ6dHJ1ZX0pO1xuICAgIH1cbiAgICBcbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFFVRVJZXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBxdWVyeSAoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICBnZXQgaW5kZXgoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBFdmVudGlmeTogaW1tZWRpYXRlIGV2ZW50c1xuICAgICovXG4gICAgZXZlbnRpZnlJbml0RXZlbnRBcmdzKG5hbWUpIHtcbiAgICAgICAgaWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuICAgICAgICAgICAgcmV0dXJuIFt0aGlzLnF1ZXJ5KCldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBCSU5EIFJFTEVBU0UgKGNvbnZlbmllbmNlKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgYmluZChjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICAgICAgcmV0dXJuIGJpbmQodGhpcywgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zKTtcbiAgICB9XG4gICAgcmVsZWFzZShoYW5kbGUpIHtcbiAgICAgICAgcmV0dXJuIHJlbGVhc2UoaGFuZGxlKTtcbiAgICB9XG5cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKEN1cnNvckJhc2UucHJvdG90eXBlKTtcbmV2ZW50aWZ5LmFkZFRvUHJvdG90eXBlKEN1cnNvckJhc2UucHJvdG90eXBlKTtcblxuIiwiXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTT1VSQ0UgUFJPUEVSVFlcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogRnVuY3Rpb25zIGZvciBleHRlbmRpbmcgYSBjbGFzcyB3aXRoIHN1cHBvcnQgZm9yIFxuICogZXh0ZXJuYWwgc291cmNlIG9uIGEgbmFtZWQgcHJvcGVydHkuXG4gKiBcbiAqIG9wdGlvbjogbXV0YWJsZTp0cnVlIG1lYW5zIHRoYXQgcHJvcGVyeSBtYXkgYmUgcmVzZXQgXG4gKiBcbiAqIHNvdXJjZSBvYmplY3QgaXMgYXNzdW1lZCB0byBzdXBwb3J0IHRoZSBjYWxsYmFjayBpbnRlcmZhY2VcbiAqL1xuXG5mdW5jdGlvbiBwcm9wbmFtZXMgKHByb3BOYW1lKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcHJvcDogYF9fJHtwcm9wTmFtZX1gLFxuICAgICAgICBpbml0OiBgX18ke3Byb3BOYW1lfV9pbml0YCxcbiAgICAgICAgaGFuZGxlOiBgX18ke3Byb3BOYW1lfV9oYW5kbGVgLFxuICAgICAgICBjaGFuZ2U6IGBfXyR7cHJvcE5hbWV9X2hhbmRsZV9jaGFuZ2VgLFxuICAgICAgICBkZXRhdGNoOiBgX18ke3Byb3BOYW1lfV9kZXRhdGNoYCxcbiAgICAgICAgYXR0YXRjaDogYF9fJHtwcm9wTmFtZX1fYXR0YXRjaGAsXG4gICAgICAgIGNoZWNrOiBgX18ke3Byb3BOYW1lfV9jaGVja2BcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb0luc3RhbmNlIChvYmplY3QsIHByb3BOYW1lKSB7XG4gICAgY29uc3QgcCA9IHByb3BuYW1lcyhwcm9wTmFtZSlcbiAgICBvYmplY3RbcC5wcm9wXSA9IHVuZGVmaW5lZFxuICAgIG9iamVjdFtwLmluaXRdID0gZmFsc2U7XG4gICAgb2JqZWN0W3AuaGFuZGxlXSA9IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlIChfcHJvdG90eXBlLCBwcm9wTmFtZSwgb3B0aW9ucz17fSkge1xuXG4gICAgY29uc3QgcCA9IHByb3BuYW1lcyhwcm9wTmFtZSlcblxuICAgIGZ1bmN0aW9uIGRldGF0Y2goKSB7XG4gICAgICAgIC8vIHVuc3Vic2NyaWJlIGZyb20gc291cmNlIGNoYW5nZSBldmVudFxuICAgICAgICBsZXQge211dGFibGU9ZmFsc2V9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKG11dGFibGUgJiYgdGhpc1twLnByb3BdKSB7XG4gICAgICAgICAgICBsZXQgaGFuZGxlID0gdGhpc1twLmhhbmRsZV07XG4gICAgICAgICAgICB0aGlzW3AucHJvcF0ucmVtb3ZlX2NhbGxiYWNrKGhhbmRsZSk7XG4gICAgICAgICAgICB0aGlzW3AuaGFuZGxlXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzW3AucHJvcF0gPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXR0YXRjaChzb3VyY2UpIHtcbiAgICAgICAgbGV0IHttdXRhYmxlPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmICghdGhpc1twLmluaXRdIHx8IG11dGFibGUpIHtcbiAgICAgICAgICAgIHRoaXNbcC5wcm9wXSA9IHNvdXJjZTtcbiAgICAgICAgICAgIHRoaXNbcC5pbml0XSA9IHRydWU7XG4gICAgICAgICAgICAvLyBzdWJzY3JpYmUgdG8gY2FsbGJhY2sgZnJvbSBzb3VyY2VcbiAgICAgICAgICAgIGlmICh0aGlzW3AuY2hhbmdlXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSB0aGlzW3AuY2hhbmdlXS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXNbcC5oYW5kbGVdID0gc291cmNlLmFkZF9jYWxsYmFjayhoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICBoYW5kbGVyKFwicmVzZXRcIik7IFxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3Byb3BOYW1lfSBjYW4gbm90IGJlIHJlYXNzaWduZWRgKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIG9iamVjdCBtdXN0IGltcGxlbWVudFxuICAgICAqIF9fe3Byb3BOYW1lfV9oYW5kbGVfY2hhbmdlKCkge31cbiAgICAgKiBcbiAgICAgKiBvYmplY3QgY2FuIGltcGxlbWVudFxuICAgICAqIF9fe3Byb3BOYW1lfV9jaGVjayhzb3VyY2UpIHt9XG4gICAgICovXG5cbiAgICAvLyBnZXR0ZXIgYW5kIHNldHRlclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShfcHJvdG90eXBlLCBwcm9wTmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzW3AucHJvcF07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHNyYykge1xuICAgICAgICAgICAgaWYgKHRoaXNbcC5jaGVja10pIHtcbiAgICAgICAgICAgICAgICB0aGlzW3AuY2hlY2tdKHNyYylcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzcmMgIT0gdGhpc1twLnByb3BdKSB7XG4gICAgICAgICAgICAgICAgdGhpc1twLmRldGF0Y2hdKCk7XG4gICAgICAgICAgICAgICAgdGhpc1twLmF0dGF0Y2hdKHNyYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH0pO1xuXG4gICAgY29uc3QgYXBpID0ge307XG4gICAgYXBpW3AuZGV0YXRjaF0gPSBkZXRhdGNoO1xuICAgIGFwaVtwLmF0dGF0Y2hdID0gYXR0YXRjaDtcblxuICAgIE9iamVjdC5hc3NpZ24oX3Byb3RvdHlwZSwgYXBpKTtcbn1cblxuIiwiXG5pbXBvcnQgeyBTdGF0ZVByb3ZpZGVyQmFzZX0gZnJvbSBcIi4vYmFzZXNcIjtcbmNvbnN0IE1FVEhPRFMgPSB7YXNzaWduLCBtb3ZlLCB0cmFuc2l0aW9uLCBpbnRlcnBvbGF0ZX07XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGNtZCAodGFyZ2V0KSB7XG4gICAgaWYgKCEodGFyZ2V0IGluc3RhbmNlb2YgU3RhdGVQcm92aWRlckJhc2UpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgdGFyZ2V0LnNyYyBtdXN0IGJlIHN0YXRlcHJvdmlkZXIgJHt0YXJnZXR9YCk7XG4gICAgfVxuICAgIGxldCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoTUVUSE9EUylcbiAgICAgICAgLm1hcCgoW25hbWUsIG1ldGhvZF0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiguLi5hcmdzKSB7IFxuICAgICAgICAgICAgICAgICAgICBsZXQgaXRlbXMgPSBtZXRob2QuY2FsbCh0aGlzLCAuLi5hcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldC51cGRhdGUoaXRlbXMpOyAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcbiAgICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKGVudHJpZXMpO1xufVxuXG5mdW5jdGlvbiBhc3NpZ24odmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgaXRlbSA9IHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZX0gICAgICAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbaXRlbV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBtb3ZlKHZlY3Rvcikge1xuICAgIGxldCBpdGVtID0ge1xuICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgdHlwZTogXCJtb3Rpb25cIixcbiAgICAgICAgYXJnczogdmVjdG9yICBcbiAgICB9XG4gICAgcmV0dXJuIFtpdGVtXTtcbn1cblxuZnVuY3Rpb24gdHJhbnNpdGlvbih2MCwgdjEsIHQwLCB0MSwgZWFzaW5nKSB7XG4gICAgbGV0IGl0ZW1zID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIHQwLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgYXJnczoge3ZhbHVlOnYwfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MCwgdDEsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwidHJhbnNpdGlvblwiLFxuICAgICAgICAgICAgYXJnczoge3YwLCB2MSwgdDAsIHQxLCBlYXNpbmd9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgYXJnczoge3ZhbHVlOiB2MX1cbiAgICAgICAgfVxuICAgIF1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKHR1cGxlcykge1xuICAgIGxldCBbdjAsIHQwXSA9IHR1cGxlc1swXTtcbiAgICBsZXQgW3YxLCB0MV0gPSB0dXBsZXNbdHVwbGVzLmxlbmd0aC0xXTtcblxuICAgIGxldCBpdGVtcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTp2MH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDAsIHQxLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcImludGVycG9sYXRpb25cIixcbiAgICAgICAgICAgIGFyZ3M6IHt0dXBsZXN9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgYXJnczoge3ZhbHVlOiB2MX1cbiAgICAgICAgfVxuICAgIF0gICAgXG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5cblxuIiwiaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UgfSBmcm9tIFwiLi9iYXNlcy5qc1wiO1xuaW1wb3J0IHsgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNJTVBMRSBTVEFURSBQUk9WSURFUiAoTE9DQUwpXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogTG9jYWwgQXJyYXkgd2l0aCBub24tb3ZlcmxhcHBpbmcgaXRlbXMuXG4gKi9cblxuZXhwb3J0IGNsYXNzIFN0YXRlUHJvdmlkZXJTaW1wbGUgZXh0ZW5kcyBTdGF0ZVByb3ZpZGVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8vIGluaXRpYWxpemF0aW9uXG4gICAgICAgIGxldCB7aXRlbXMsIHZhbHVlfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChpdGVtcyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gY2hlY2tfaW5wdXQoaXRlbXMpO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5faXRlbXMgPSBbe2l0djpbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sIGFyZ3M6e3ZhbHVlfX1dO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5faXRlbXMgPSBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZSAoaXRlbXMpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5faXRlbXMgPSBjaGVja19pbnB1dChpdGVtcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXQgaXRlbXMgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXRlbXMuc2xpY2UoKTtcbiAgICB9XG5cbiAgICBnZXQgaW5mbyAoKSB7XG4gICAgICAgIHJldHVybiB7ZHluYW1pYzogdHJ1ZSwgb3ZlcmxhcHBpbmc6IGZhbHNlLCBsb2NhbDp0cnVlfTtcbiAgICB9XG59XG5cblxuZnVuY3Rpb24gY2hlY2tfaW5wdXQoaXRlbXMpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIklucHV0IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgfVxuICAgIC8vIHNvcnQgaXRlbXMgYmFzZWQgb24gaW50ZXJ2YWwgbG93IGVuZHBvaW50XG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBsZXQgYV9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGEuaXR2KVswXTtcbiAgICAgICAgbGV0IGJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChiLml0dilbMF07XG4gICAgICAgIHJldHVybiBlbmRwb2ludC5jbXAoYV9sb3csIGJfbG93KTtcbiAgICB9KTtcbiAgICAvLyBjaGVjayB0aGF0IGl0ZW0gaW50ZXJ2YWxzIGFyZSBub24tb3ZlcmxhcHBpbmdcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBwcmV2X2hpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2kgLSAxXS5pdHYpWzFdO1xuICAgICAgICBsZXQgY3Vycl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2ldLml0dilbMF07XG4gICAgICAgIC8vIHZlcmlmeSB0aGF0IHByZXYgaGlnaCBpcyBsZXNzIHRoYXQgY3VyciBsb3dcbiAgICAgICAgaWYgKCFlbmRwb2ludC5sdChwcmV2X2hpZ2gsIGN1cnJfbG93KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT3ZlcmxhcHBpbmcgaW50ZXJ2YWxzIGZvdW5kXCIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuIiwiaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbkJBU0UgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLypcblx0QWJzdHJhY3QgQmFzZSBDbGFzcyBmb3IgU2VnbWVudHNcblxuICAgIGNvbnN0cnVjdG9yKGludGVydmFsKVxuXG4gICAgLSBpbnRlcnZhbDogaW50ZXJ2YWwgb2YgdmFsaWRpdHkgb2Ygc2VnbWVudFxuICAgIC0gZHluYW1pYzogdHJ1ZSBpZiBzZWdtZW50IGlzIGR5bmFtaWNcbiAgICAtIHZhbHVlKG9mZnNldCk6IHZhbHVlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4gICAgLSBxdWVyeShvZmZzZXQpOiBzdGF0ZSBvZiBzZWdtZW50IGF0IG9mZnNldFxuKi9cblxuZXhwb3J0IGNsYXNzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYpIHtcblx0XHR0aGlzLl9pdHYgPSBpdHY7XG5cdH1cblxuXHRnZXQgaXR2KCkge3JldHVybiB0aGlzLl9pdHY7fVxuXG4gICAgLyoqIFxuICAgICAqIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzXG4gICAgICogcmV0dXJucyB7dmFsdWUsIGR5bmFtaWN9O1xuICAgICovXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgXHR0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY29udmVuaWVuY2UgZnVuY3Rpb24gcmV0dXJuaW5nIHRoZSBzdGF0ZSBvZiB0aGUgc2VnbWVudFxuICAgICAqIEBwYXJhbSB7Kn0gb2Zmc2V0IFxuICAgICAqIEByZXR1cm5zIFxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX2l0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHsuLi50aGlzLnN0YXRlKG9mZnNldCksIG9mZnNldH07XG4gICAgICAgIH0gXG4gICAgICAgIHJldHVybiB7dmFsdWU6IHVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUlMgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJzU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcblx0XHR0aGlzLl9sYXllcnMgPSBhcmdzLmxheWVycztcbiAgICAgICAgdGhpcy5fdmFsdWVfZnVuYyA9IGFyZ3MudmFsdWVfZnVuY1xuXG4gICAgICAgIC8vIFRPRE8gLSBmaWd1cmUgb3V0IGR5bmFtaWMgaGVyZT9cbiAgICB9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIC8vIFRPRE8gLSB1c2UgdmFsdWUgZnVuY1xuICAgICAgICAvLyBmb3Igbm93IC0ganVzdCB1c2UgZmlyc3QgbGF5ZXJcbiAgICAgICAgcmV0dXJuIHsuLi50aGlzLl9sYXllcnNbMF0ucXVlcnkob2Zmc2V0KSwgb2Zmc2V0fTtcblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNUQVRJQyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX3ZhbHVlID0gYXJncy52YWx1ZTtcblx0fVxuXG5cdHN0YXRlKCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl92YWx1ZSwgZHluYW1pYzpmYWxzZX1cblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE1PVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuICAgIEltcGxlbWVudHMgZGV0ZXJtaW5pc3RpYyBwcm9qZWN0aW9uIGJhc2VkIG9uIGluaXRpYWwgY29uZGl0aW9ucyBcbiAgICAtIG1vdGlvbiB2ZWN0b3IgZGVzY3JpYmVzIG1vdGlvbiB1bmRlciBjb25zdGFudCBhY2NlbGVyYXRpb25cbiovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBwb3NpdGlvbjpwMCwgdmVsb2NpdHk6djAsIHRpbWVzdGFtcDp0MFxuICAgICAgICB9ID0gYXJncztcbiAgICAgICAgLy8gY3JlYXRlIG1vdGlvbiB0cmFuc2l0aW9uXG4gICAgICAgIGNvbnN0IGEwID0gMDtcbiAgICAgICAgdGhpcy5fdmVsb2NpdHkgPSB2MDtcbiAgICAgICAgdGhpcy5fcG9zaXRpb24gPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIGxldCBkID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHJldHVybiBwMCArIHYwKmQgKyAwLjUqYTAqZCpkO1xuICAgICAgICB9OyAgIFxuICAgIH1cblxuICAgIHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmFsdWU6IHRoaXMuX3Bvc2l0aW9uKG9mZnNldCksIFxuICAgICAgICAgICAgcmF0ZTogdGhpcy5fdmVsb2NpdHksIFxuICAgICAgICAgICAgZHluYW1pYzogdGhpcy5fdmVsb2NpdHkgIT0gMFxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRSQU5TSVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIFN1cHBvcnRlZCBlYXNpbmcgZnVuY3Rpb25zXG4gICAgXCJlYXNlLWluXCI6XG4gICAgXCJlYXNlLW91dFwiOlxuICAgIFwiZWFzZS1pbi1vdXRcIlxuKi9cblxuZnVuY3Rpb24gZWFzZWluICh0cykge1xuICAgIHJldHVybiBNYXRoLnBvdyh0cywyKTsgIFxufVxuZnVuY3Rpb24gZWFzZW91dCAodHMpIHtcbiAgICByZXR1cm4gMSAtIGVhc2VpbigxIC0gdHMpO1xufVxuZnVuY3Rpb24gZWFzZWlub3V0ICh0cykge1xuICAgIGlmICh0cyA8IC41KSB7XG4gICAgICAgIHJldHVybiBlYXNlaW4oMiAqIHRzKSAvIDI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICgyIC0gZWFzZWluKDIgKiAoMSAtIHRzKSkpIC8gMjtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFuc2l0aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcblx0XHRzdXBlcihpdHYpO1xuICAgICAgICBsZXQge3YwLCB2MSwgZWFzaW5nfSA9IGFyZ3M7XG4gICAgICAgIGxldCBbdDAsIHQxXSA9IHRoaXMuX2l0di5zbGljZSgwLDIpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgdHJhbnNpdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl9keW5hbWljID0gdjEtdjAgIT0gMDtcbiAgICAgICAgdGhpcy5fdHJhbnMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgdHMgdG8gW3QwLHQxXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzaGlmdCBmcm9tIFt0MCx0MV0tc3BhY2UgdG8gWzAsKHQxLXQwKV0tc3BhY2VcbiAgICAgICAgICAgIC8vIC0gc2NhbGUgZnJvbSBbMCwodDEtdDApXS1zcGFjZSB0byBbMCwxXS1zcGFjZVxuICAgICAgICAgICAgdHMgPSB0cyAtIHQwO1xuICAgICAgICAgICAgdHMgPSB0cy9wYXJzZUZsb2F0KHQxLXQwKTtcbiAgICAgICAgICAgIC8vIGVhc2luZyBmdW5jdGlvbnMgc3RyZXRjaGVzIG9yIGNvbXByZXNzZXMgdGhlIHRpbWUgc2NhbGUgXG4gICAgICAgICAgICBpZiAoZWFzaW5nID09IFwiZWFzZS1pblwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW4odHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlb3V0KHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWFzaW5nID09IFwiZWFzZS1pbi1vdXRcIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZWlub3V0KHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc2l0aW9uIGZyb20gdjAgdG8gdjEsIGZvciB0aW1lIHZhbHVlcyBbMCwxXVxuICAgICAgICAgICAgdHMgPSBNYXRoLm1heCh0cywgMCk7XG4gICAgICAgICAgICB0cyA9IE1hdGgubWluKHRzLCAxKTtcbiAgICAgICAgICAgIHJldHVybiB2MCArICh2MS12MCkqdHM7XG4gICAgICAgIH1cblx0fVxuXG5cdHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl90cmFucyhvZmZzZXQpLCBkeW5hbWljOnRoaXMuX2R5bmFtaWN9XG5cdH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElOVEVSUE9MQVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9uIHRvIGNyZWF0ZSBhbiBpbnRlcnBvbGF0b3IgZm9yIG5lYXJlc3QgbmVpZ2hib3IgaW50ZXJwb2xhdGlvbiB3aXRoXG4gKiBleHRyYXBvbGF0aW9uIHN1cHBvcnQuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdHVwbGVzIC0gQW4gYXJyYXkgb2YgW3ZhbHVlLCBvZmZzZXRdIHBhaXJzLCB3aGVyZSB2YWx1ZSBpcyB0aGVcbiAqIHBvaW50J3MgdmFsdWUgYW5kIG9mZnNldCBpcyB0aGUgY29ycmVzcG9uZGluZyBvZmZzZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gQSBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIG9mZnNldCBhbmQgcmV0dXJucyB0aGVcbiAqIGludGVycG9sYXRlZCBvciBleHRyYXBvbGF0ZWQgdmFsdWUuXG4gKi9cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUodHVwbGVzKSB7XG5cbiAgICBpZiAodHVwbGVzLmxlbmd0aCA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHVuZGVmaW5lZDt9XG4gICAgfSBlbHNlIGlmICh0dXBsZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHR1cGxlc1swXVswXTt9XG4gICAgfVxuXG4gICAgLy8gU29ydCB0aGUgdHVwbGVzIGJ5IHRoZWlyIG9mZnNldHNcbiAgICBjb25zdCBzb3J0ZWRUdXBsZXMgPSBbLi4udHVwbGVzXS5zb3J0KChhLCBiKSA9PiBhWzFdIC0gYlsxXSk7XG4gIFxuICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3Iob2Zmc2V0KSB7XG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBiZWZvcmUgdGhlIGZpcnN0IHBvaW50XG4gICAgICBpZiAob2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1swXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1swXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbMV07XG4gICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gSGFuZGxlIGV4dHJhcG9sYXRpb24gYWZ0ZXIgdGhlIGxhc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMl07XG4gICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICBcbiAgICAgIC8vIEZpbmQgdGhlIG5lYXJlc3QgcG9pbnRzIHRvIHRoZSBsZWZ0IGFuZCByaWdodFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW2ldWzFdICYmIG9mZnNldCA8PSBzb3J0ZWRUdXBsZXNbaSArIDFdWzFdKSB7XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbaV07XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbaSArIDFdO1xuICAgICAgICAgIC8vIExpbmVhciBpbnRlcnBvbGF0aW9uIGZvcm11bGE6IHkgPSB5MSArICggKHggLSB4MSkgKiAoeTIgLSB5MSkgLyAoeDIgLSB4MSkgKVxuICAgICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICBcbiAgICAgIC8vIEluIGNhc2UgdGhlIG9mZnNldCBkb2VzIG5vdCBmYWxsIHdpdGhpbiBhbnkgcmFuZ2UgKHNob3VsZCBiZSBjb3ZlcmVkIGJ5IHRoZSBwcmV2aW91cyBjb25kaXRpb25zKVxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9O1xufVxuICBcblxuZXhwb3J0IGNsYXNzIEludGVycG9sYXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG4gICAgY29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIC8vIHNldHVwIGludGVycG9sYXRpb24gZnVuY3Rpb25cbiAgICAgICAgdGhpcy5fdHJhbnMgPSBpbnRlcnBvbGF0ZShhcmdzLnR1cGxlcyk7XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dHJ1ZX07XG4gICAgfVxufVxuXG5cbiIsImltcG9ydCB7IGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgKiBhcyBzZWdtZW50IGZyb20gXCIuL3NlZ21lbnRzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBORUFSQlkgQ0FDSEVcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBUaGlzIGltcGxlbWVudHMgYSBjYWNoZSBpbiBmcm9udCBvZiBhIE5lYXJieUluZGV4LlxuICAgIFxuICAgIFRoZSBwdXJwb3NlIG9mIGNhY2hpbmcgaXMgdG8gb3B0aW1pemUgZm9yIHJlcGVhdGVkXG4gICAgcXVlcmllcyB0byBhIE5lYXJieUluZGV4IHRvIG5lYXJieSBvZmZzZXRzLlxuXG4gICAgVGhlIGNhY2hlIHN0YXRlIGluY2x1ZGVzIHRoZSBuZWFyYnkgc3RhdGUgZnJvbSB0aGUgXG4gICAgaW5kZXgsIGFuZCBhbHNvIHRoZSBjYWNoZWQgc2VnbWVudHMgY29ycmVzcG9uZGluZ1xuICAgIHRvIHRoYXQgc3RhdGUuIFRoaXMgd2F5LCBvbiBhIGNhY2hlIGhpdCwgdGhlIFxuICAgIHF1ZXJ5IG1heSBiZSBzYXRpc2ZpZWQgZGlyZWN0bHkgZnJvbSB0aGUgY2FjaGUuXG5cbiAgICBUaGUgY2FjaGUgaXMgbWFya2VkIGFzIGRpcnR5IHdoZW4gdGhlIE5lYXJieSBpbmRleGVzIGNoYW5nZXMuXG4qL1xuXG5leHBvcnQgY2xhc3MgTmVhcmJ5Q2FjaGUge1xuXG4gICAgY29uc3RydWN0b3IgKGxheWVyKSB7XG4gICAgICAgIC8vIG5lYXJieSBpbmRleFxuICAgICAgICB0aGlzLl9pbmRleCA9IGxheWVyLmluZGV4O1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IG9iamVjdFxuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhY2hlZCBzZWdtZW50XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGRpcnR5IGZsYWdcbiAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgQWNjZXNzb3JzIGZvciBDYWNoZSBzdGF0ZVxuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBcbiAgICBnZXQgbmVhcmJ5ICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX25lYXJieTtcbiAgICB9XG5cbiAgICBsb2FkX3NlZ21lbnQgKCkge1xuICAgICAgICAvLyBsYXp5IGxvYWQgc2VnbWVudFxuICAgICAgICBpZiAodGhpcy5fbmVhcmJ5ICYmICF0aGlzLl9zZWdtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9zZWdtZW50ID0gbG9hZF9zZWdtZW50KHRoaXMuX25lYXJieSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3NlZ21lbnRcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgRGlydHkgQ2FjaGVcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBkaXJ0eSgpIHtcbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBSZWZyZXNoIENhY2hlXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgLypcbiAgICAgICAgcmVmcmVzaCBpZiBuZWNlc3NhcnkgLSBlbHNlIE5PT1BcbiAgICAgICAgLSBpZiBuZWFyYnkgaXMgbm90IGRlZmluZWRcbiAgICAgICAgLSBpZiBvZmZzZXQgaXMgb3V0c2lkZSBuZWFyYnkuaXR2XG4gICAgICAgIC0gaWYgY2FjaGUgaXMgZGlydHlcbiAgICAqL1xuICAgIHJlZnJlc2ggKG9mZnNldCkge1xuICAgICAgICBpZiAodHlwZW9mIG9mZnNldCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIG9mZnNldCA9IFtvZmZzZXQsIDBdO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9uZWFyYnkgPT0gdW5kZWZpbmVkIHx8IHRoaXMuX2RpcnR5KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVmcmVzaChvZmZzZXQpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KHRoaXMuX25lYXJieS5pdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWZyZXNoKG9mZnNldClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX3JlZnJlc2ggKG9mZnNldCkge1xuICAgICAgICB0aGlzLl9uZWFyYnkgPSB0aGlzLl9pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIFF1ZXJ5IENhY2hlXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIHRoaXMucmVmcmVzaChvZmZzZXQpO1xuICAgICAgICBpZiAoIXRoaXMuX3NlZ21lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3NlZ21lbnQgPSBsb2FkX3NlZ21lbnQodGhpcy5fbmVhcmJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fc2VnbWVudC5xdWVyeShvZmZzZXQpO1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0FEIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gY3JlYXRlX3NlZ21lbnQoaXR2LCB0eXBlLCBhcmdzKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJzdGF0aWNcIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuU3RhdGljU2VnbWVudChpdHYsIGFyZ3MpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuVHJhbnNpdGlvblNlZ21lbnQoaXR2LCBhcmdzKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJpbnRlcnBvbGF0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LkludGVycG9sYXRpb25TZWdtZW50KGl0diwgYXJncyk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwibW90aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50Lk1vdGlvblNlZ21lbnQoaXR2LCBhcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhcInVucmVjb2duaXplZCBzZWdtZW50IHR5cGVcIiwgdHlwZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBsb2FkX3NlZ21lbnQobmVhcmJ5KSB7XG4gICAgbGV0IHtpdHYsIGNlbnRlcn0gPSBuZWFyYnk7XG4gICAgaWYgKGNlbnRlci5sZW5ndGggPT0gMCkge1xuICAgICAgICByZXR1cm4gY3JlYXRlX3NlZ21lbnQoaXR2LCBcInN0YXRpY1wiLCB7dmFsdWU6dW5kZWZpbmVkfSk7XG4gICAgfVxuICAgIGlmIChjZW50ZXIubGVuZ3RoID09IDEpIHtcbiAgICAgICAgbGV0IHt0eXBlPVwic3RhdGljXCIsIGFyZ3N9ID0gY2VudGVyWzBdO1xuICAgICAgICByZXR1cm4gY3JlYXRlX3NlZ21lbnQoaXR2LCB0eXBlLCBhcmdzKTtcbiAgICB9XG4gICAgaWYgKGNlbnRlci5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkxpc3RTZWdtZW50cyBub3QgeWV0IHN1cHBvcnRlZFwiKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgcmFuZ2UgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlDYWNoZSB9IGZyb20gXCIuL25lYXJieWNhY2hlLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBORUFSQlkgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBBYnN0cmFjdCBzdXBlcmNsYXNzIGZvciBOZWFyYnlJbmRleGUuXG4gKiBcbiAqIFN1cGVyY2xhc3MgdXNlZCB0byBjaGVjayB0aGF0IGEgY2xhc3MgaW1wbGVtZW50cyB0aGUgbmVhcmJ5KCkgbWV0aG9kLCBcbiAqIGFuZCBwcm92aWRlIHNvbWUgY29udmVuaWVuY2UgbWV0aG9kcy5cbiAqIFxuICogTkVBUkJZIElOREVYXG4gKiBcbiAqIE5lYXJieUluZGV4IHByb3ZpZGVzIGluZGV4aW5nIHN1cHBvcnQgb2YgZWZmZWN0aXZlbHlsb29raW5nIHVwIElURU1TIGJ5IG9mZnNldCwgXG4gKiBnaXZlbiB0aGF0XG4gKiAoaSkgZWFjaCBlbnRyaXkgaXMgYXNzb2NpYXRlZCB3aXRoIGFuIGludGVydmFsIGFuZCxcbiAqIChpaSkgZW50cmllcyBhcmUgbm9uLW92ZXJsYXBwaW5nLlxuICogRWFjaCBJVEVNIG11c3QgYmUgYXNzb2NpYXRlZCB3aXRoIGFuIGludGVydmFsIG9uIHRoZSB0aW1lbGluZSBcbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgYXJvdW5kIGVuZHBvaW50LiBcbiAqIFxuICogUHJpbWFyeSB1c2UgaXMgZm9yIGl0ZXJhdGlvbiBcbiAqIFxuICogUmV0dXJucyB7XG4gKiAgICAgIGNlbnRlcjogbGlzdCBvZiBJVEVNUyBjb3ZlcmluZyBlbmRwb2ludCxcbiAqICAgICAgaXR2OiBpbnRlcnZhbCB3aGVyZSBuZWFyYnkgcmV0dXJucyBpZGVudGljYWwge2NlbnRlcn1cbiAqICAgICAgbGVmdDpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSBsZWZ0IFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgaGlnaC1lbmRwb2ludCBvciB1bmRlZmluZWRcbiAqICAgICAgcmlnaHQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgcmlnaHRcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGxvdy1lbmRwb2ludCBvciB1bmRlZmluZWQgICAgICAgICBcbiAqICAgICAgcHJldjpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSBsZWZ0IFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCAmJiBub24tZW1wdHkge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGhpZ2gtZW5kcG9pbnQgb3IgdW5kZWZpbmVkIGlmIG5vIG1vcmUgaW50ZXJ2YWxzIHRvIHRoZSBsZWZ0XG4gKiAgICAgIG5leHQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgcmlnaHRcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQgJiYgbm9uLWVtcHR5IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBsb3ctZW5kcG9pbnQgb3IgdW5kZWZpbmVkIGlmIG5vIG1vcmUgaW50ZXJ2YWxzIHRvIHRoZSByaWdodFxuICogfVxuICogXG4gKiBcbiAqIFRoZSBuZWFyYnkgc3RhdGUgaXMgd2VsbC1kZWZpbmVkIGZvciBldmVyeSB0aW1lbGluZSBwb3NpdGlvbi5cbiAqIFxuICogXG4gKiBOT1RFIGxlZnQvcmlnaHQgYW5kIHByZXYvbmV4dCBhcmUgbW9zdGx5IHRoZSBzYW1lLiBUaGUgb25seSBkaWZmZXJlbmNlIGlzIFxuICogdGhhdCBwcmV2L25leHQgd2lsbCBza2lwIG92ZXIgcmVnaW9ucyB3aGVyZSB0aGVyZSBhcmUgbm8gaW50ZXJ2YWxzLiBUaGlzXG4gKiBlbnN1cmVzIHByYWN0aWNhbCBpdGVyYXRpb24gb2YgaXRlbXMgYXMgcHJldi9uZXh0IHdpbGwgb25seSBiZSB1bmRlZmluZWQgIFxuICogYXQgdGhlIGVuZCBvZiBpdGVyYXRpb24uXG4gKiBcbiAqIElOVEVSVkFMU1xuICogXG4gKiBbbG93LCBoaWdoLCBsb3dJbmNsdXNpdmUsIGhpZ2hJbmNsdXNpdmVdXG4gKiBcbiAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAqIFxuICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG4gKiBcbiAqIFxuICogSU5URVJWQUwgRU5EUE9JTlRTXG4gKiBcbiAqIGludGVydmFsIGVuZHBvaW50cyBhcmUgZGVmaW5lZCBieSBbdmFsdWUsIHNpZ25dLCBmb3IgZXhhbXBsZVxuICogXG4gKiA0KSAtPiBbNCwtMV0gLSBlbmRwb2ludCBpcyBvbiB0aGUgbGVmdCBvZiA0XG4gKiBbNCwgNCwgNF0gLT4gWzQsIDBdIC0gZW5kcG9pbnQgaXMgYXQgNCBcbiAqICg0IC0+IFs0LCAxXSAtIGVuZHBvaW50IGlzIG9uIHRoZSByaWdodCBvZiA0KVxuICogXG4gKiAvICovXG5cbiBleHBvcnQgY2xhc3MgTmVhcmJ5SW5kZXhCYXNlIHtcblxuXG4gICAgLyogXG4gICAgICAgIE5lYXJieSBtZXRob2RcbiAgICAqL1xuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGxvdyBwb2ludCBvZiBsZWZ0bW9zdCBlbnRyeVxuICAgICovXG4gICAgZmlyc3QoKSB7XG4gICAgICAgIGxldCB7Y2VudGVyLCByaWdodH0gPSB0aGlzLm5lYXJieShbLUluZmluaXR5LCAwXSk7XG4gICAgICAgIHJldHVybiAoY2VudGVyLmxlbmd0aCA+IDApID8gWy1JbmZpbml0eSwgMF0gOiByaWdodDtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICByZXR1cm4gaGlnaCBwb2ludCBvZiByaWdodG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGxhc3QoKSB7XG4gICAgICAgIGxldCB7bGVmdCwgY2VudGVyfSA9IHRoaXMubmVhcmJ5KFtJbmZpbml0eSwgMF0pO1xuICAgICAgICByZXR1cm4gKGNlbnRlci5sZW5ndGggPiAwKSA/IFtJbmZpbml0eSwgMF0gOiBsZWZ0XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgTGlzdCBpdGVtcyBvZiBOZWFyYnlJbmRleCAob3JkZXIgbGVmdCB0byByaWdodClcbiAgICAgICAgaW50ZXJ2YWwgZGVmaW5lcyBbc3RhcnQsIGVuZF0gb2Zmc2V0IG9uIHRoZSB0aW1lbGluZS5cbiAgICAgICAgUmV0dXJucyBsaXN0IG9mIGl0ZW0tbGlzdHMuXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICAgLSBzdGFydFxuICAgICAgICAtIHN0b3BcbiAgICAqL1xuICAgIGxpc3Qob3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge3N0YXJ0PS1JbmZpbml0eSwgc3RvcD1JbmZpbml0eX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3RhcnQgPiBzdG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgKFwic3RvcCBtdXN0IGJlIGxhcmdlciB0aGFuIHN0YXJ0XCIsIHN0YXJ0LCBzdG9wKVxuICAgICAgICB9XG4gICAgICAgIHN0YXJ0ID0gW3N0YXJ0LCAwXTtcbiAgICAgICAgc3RvcCA9IFtzdG9wLCAwXTtcbiAgICAgICAgbGV0IGN1cnJlbnQgPSBzdGFydDtcbiAgICAgICAgbGV0IG5lYXJieTtcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuICAgICAgICBsZXQgbGltaXQgPSA1XG4gICAgICAgIHdoaWxlIChsaW1pdCkge1xuICAgICAgICAgICAgaWYgKGVuZHBvaW50Lmd0KGN1cnJlbnQsIHN0b3ApKSB7XG4gICAgICAgICAgICAgICAgLy8gZXhoYXVzdGVkXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuZWFyYnkgPSB0aGlzLm5lYXJieShjdXJyZW50KTtcbiAgICAgICAgICAgIGlmIChuZWFyYnkuY2VudGVyLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAgICAgLy8gY2VudGVyIGVtcHR5ICh0eXBpY2FsbHkgZmlyc3QgaXRlcmF0aW9uKVxuICAgICAgICAgICAgICAgIGlmIChuZWFyYnkucmlnaHQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBubyBlbnRyaWVzIC0gYWxyZWFkeSBleGhhdXN0ZWRcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmlnaHQgZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBpbmNyZW1lbnQgb2Zmc2V0XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnQgPSBuZWFyYnkucmlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gobmVhcmJ5LmNlbnRlcik7XG4gICAgICAgICAgICAgICAgaWYgKG5lYXJieS5yaWdodCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmlnaHQgdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgIC8vIGxhc3QgZW50cnkgLSBtYXJrIGl0ZXJhY3RvciBleGhhdXN0ZWRcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmlnaHQgZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBpbmNyZW1lbnQgb2Zmc2V0XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnQgPSBuZWFyYnkucmlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGltaXQtLTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG59XG5cblxuXG5cblxuIiwiaW1wb3J0IHsgaW50ZXJ2YWwsIGVuZHBvaW50IH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi9uZWFyYnlpbmRleC5qc1wiO1xuXG4vKipcbiAqIFxuICogTmVhcmJ5IEluZGV4IFNpbXBsZVxuICogXG4gKiAtIGl0ZW1zIGFyZSBhc3N1bWVkIHRvIGJlIG5vbi1vdmVybGFwcGluZyBvbiB0aGUgdGltZWxpbmUsIFxuICogLSBpbXBseWluZyB0aGF0IG5lYXJieS5jZW50ZXIgd2lsbCBiZSBhIGxpc3Qgb2YgYXQgbW9zdCBvbmUgSVRFTS4gXG4gKiAtIGV4Y2VwdGlvbiB3aWxsIGJlIHJhaXNlZCBpZiBvdmVybGFwcGluZyBJVEVNUyBhcmUgZm91bmRcbiAqIC0gSVRFTVMgaXMgYXNzdW1iZWQgdG8gYmUgaW1tdXRhYmxlIGFycmF5IC0gY2hhbmdlIElURU1TIGJ5IHJlcGxhY2luZyBhcnJheVxuICogXG4gKiAgXG4gKi9cblxuXG4vLyBnZXQgaW50ZXJ2YWwgbG93IHBvaW50XG5mdW5jdGlvbiBnZXRfbG93X3ZhbHVlKGl0ZW0pIHtcbiAgICByZXR1cm4gaXRlbS5pdHZbMF07XG59XG5cbi8vIGdldCBpbnRlcnZhbCBsb3cgZW5kcG9pbnRcbmZ1bmN0aW9uIGdldF9sb3dfZW5kcG9pbnQoaXRlbSkge1xuICAgIHJldHVybiBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW0uaXR2KVswXVxufVxuXG4vLyBnZXQgaW50ZXJ2YWwgaGlnaCBlbmRwb2ludFxuZnVuY3Rpb24gZ2V0X2hpZ2hfZW5kcG9pbnQoaXRlbSkge1xuICAgIHJldHVybiBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW0uaXR2KVsxXVxufVxuXG5cbmV4cG9ydCBjbGFzcyBOZWFyYnlJbmRleFNpbXBsZSBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihzcmMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fc3JjID0gc3JjO1xuICAgIH1cblxuICAgIGdldCBzcmMgKCkge3JldHVybiB0aGlzLl9zcmM7fVxuXG4gICAgLypcbiAgICAgICAgbmVhcmJ5IGJ5IG9mZnNldFxuICAgICAgICBcbiAgICAgICAgcmV0dXJucyB7bGVmdCwgY2VudGVyLCByaWdodH1cblxuICAgICAgICBiaW5hcnkgc2VhcmNoIGJhc2VkIG9uIG9mZnNldFxuICAgICAgICAxKSBmb3VuZCwgaWR4XG4gICAgICAgICAgICBvZmZzZXQgbWF0Y2hlcyB2YWx1ZSBvZiBpbnRlcnZhbC5sb3cgb2YgYW4gaXRlbVxuICAgICAgICAgICAgaWR4IGdpdmVzIHRoZSBpbmRleCBvZiB0aGlzIGl0ZW0gaW4gdGhlIGFycmF5XG4gICAgICAgIDIpIG5vdCBmb3VuZCwgaWR4XG4gICAgICAgICAgICBvZmZzZXQgaXMgZWl0aGVyIGNvdmVyZWQgYnkgaXRlbSBhdCAoaWR4LTEpLFxuICAgICAgICAgICAgb3IgaXQgaXMgbm90ID0+IGJldHdlZW4gZW50cmllc1xuICAgICAgICAgICAgaW4gdGhpcyBjYXNlIC0gaWR4IGdpdmVzIHRoZSBpbmRleCB3aGVyZSBhbiBpdGVtXG4gICAgICAgICAgICBzaG91bGQgYmUgaW5zZXJ0ZWQgLSBpZiBpdCBoYWQgbG93ID09IG9mZnNldFxuICAgICovXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBpZiAodHlwZW9mIG9mZnNldCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIG9mZnNldCA9IFtvZmZzZXQsIDBdO1xuICAgICAgICB9XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShvZmZzZXQpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFbmRwb2ludCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgICAgICAgIGNlbnRlcjogW10sXG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIGxlZnQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHJpZ2h0OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBwcmV2OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBuZXh0OiB1bmRlZmluZWRcbiAgICAgICAgfTtcbiAgICAgICAgbGV0IGl0ZW1zID0gdGhpcy5fc3JjLml0ZW1zO1xuICAgICAgICBsZXQgaW5kZXhlcywgaXRlbTtcbiAgICAgICAgY29uc3Qgc2l6ZSA9IGl0ZW1zLmxlbmd0aDtcbiAgICAgICAgaWYgKHNpemUgPT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDsgXG4gICAgICAgIH1cbiAgICAgICAgbGV0IFtmb3VuZCwgaWR4XSA9IGZpbmRfaW5kZXgob2Zmc2V0WzBdLCBpdGVtcywgZ2V0X2xvd192YWx1ZSk7XG4gICAgICAgIGlmIChmb3VuZCkge1xuICAgICAgICAgICAgLy8gc2VhcmNoIG9mZnNldCBtYXRjaGVzIGl0ZW0gbG93IGV4YWN0bHlcbiAgICAgICAgICAgIC8vIGNoZWNrIHRoYXQgaXQgaW5kZWVkIGNvdmVyZWQgYnkgaXRlbSBpbnRlcnZhbFxuICAgICAgICAgICAgaXRlbSA9IGl0ZW1zW2lkeF1cbiAgICAgICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfZW5kcG9pbnQoaXRlbS5pdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTEsIGNlbnRlcjppZHgsIHJpZ2h0OmlkeCsxfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5kZXhlcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIHByZXYgaXRlbVxuICAgICAgICAgICAgaXRlbSA9IGl0ZW1zW2lkeC0xXTtcbiAgICAgICAgICAgIGlmIChpdGVtICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIHNlYXJjaCBvZmZzZXQgaXMgY292ZXJlZCBieSBpdGVtIGludGVydmFsXG4gICAgICAgICAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19lbmRwb2ludChpdGVtLml0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTIsIGNlbnRlcjppZHgtMSwgcmlnaHQ6aWR4fTtcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgfVxuICAgICAgICB9XHRcbiAgICAgICAgaWYgKGluZGV4ZXMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBwcmV2IGl0ZW0gZWl0aGVyIGRvZXMgbm90IGV4aXN0IG9yIGlzIG5vdCByZWxldmFudFxuICAgICAgICAgICAgaW5kZXhlcyA9IHtsZWZ0OmlkeC0xLCBjZW50ZXI6LTEsIHJpZ2h0OmlkeH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjZW50ZXJcbiAgICAgICAgaWYgKDAgPD0gaW5kZXhlcy5jZW50ZXIgJiYgaW5kZXhlcy5jZW50ZXIgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQuY2VudGVyID0gIFtpdGVtc1tpbmRleGVzLmNlbnRlcl1dO1xuICAgICAgICB9XG4gICAgICAgIC8vIHByZXYvbmV4dFxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLmxlZnQgJiYgaW5kZXhlcy5sZWZ0IDwgc2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0LnByZXYgPSAgZ2V0X2hpZ2hfZW5kcG9pbnQoaXRlbXNbaW5kZXhlcy5sZWZ0XSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKDAgPD0gaW5kZXhlcy5yaWdodCAmJiBpbmRleGVzLnJpZ2h0IDwgc2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0Lm5leHQgPSAgZ2V0X2xvd19lbmRwb2ludChpdGVtc1tpbmRleGVzLnJpZ2h0XSk7XG4gICAgICAgIH0gICAgICAgIFxuICAgICAgICAvLyBsZWZ0L3JpZ2h0XG4gICAgICAgIGxldCBsb3csIGhpZ2g7XG4gICAgICAgIGlmIChyZXN1bHQuY2VudGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxldCBpdHYgPSByZXN1bHQuY2VudGVyWzBdLml0djtcbiAgICAgICAgICAgIFtsb3csIGhpZ2hdID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdHYpO1xuICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSAobG93WzBdID4gLUluZmluaXR5KSA/IGVuZHBvaW50LmZsaXAobG93LCBcImhpZ2hcIikgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSAoaGlnaFswXSA8IEluZmluaXR5KSA/IGVuZHBvaW50LmZsaXAoaGlnaCwgXCJsb3dcIikgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICByZXN1bHQuaXR2ID0gcmVzdWx0LmNlbnRlclswXS5pdHY7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IHJlc3VsdC5wcmV2O1xuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gcmVzdWx0Lm5leHQ7XG4gICAgICAgICAgICAvLyBpbnRlcnZhbFxuICAgICAgICAgICAgbGV0IGxlZnQgPSByZXN1bHQubGVmdDtcbiAgICAgICAgICAgIGxvdyA9IChsZWZ0ID09IHVuZGVmaW5lZCkgPyBbLUluZmluaXR5LCAwXSA6IGVuZHBvaW50LmZsaXAobGVmdCwgXCJsb3dcIik7XG4gICAgICAgICAgICBsZXQgcmlnaHQgPSByZXN1bHQucmlnaHQ7XG4gICAgICAgICAgICBoaWdoID0gKHJpZ2h0ID09IHVuZGVmaW5lZCkgPyBbSW5maW5pdHksIDBdIDogZW5kcG9pbnQuZmxpcChyaWdodCwgXCJoaWdoXCIpO1xuICAgICAgICAgICAgcmVzdWx0Lml0diA9IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblx0VVRJTFNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuXG4vLyBjaGVjayBpbnB1dFxuZnVuY3Rpb24gY2hlY2tfaW5wdXQoaXRlbXMpIHtcblxuICAgIGlmIChpdGVtcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaXRlbXMgPSBbXTtcbiAgICB9XG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIklucHV0IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgfVxuXG4gICAgLy8gc29ydCBpdGVtcyBiYXNlZCBvbiBpbnRlcnZhbCBsb3cgZW5kcG9pbnRcbiAgICBpdGVtcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGxldCBhX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYS5pdHYpWzBdO1xuICAgICAgICBsZXQgYl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGIuaXR2KVswXTtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmNtcChhX2xvdywgYl9sb3cpO1xuICAgIH0pO1xuXG4gICAgLy8gY2hlY2sgdGhhdCBpdGVtIGludGVydmFscyBhcmUgbm9uLW92ZXJsYXBwaW5nXG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBsZXQgcHJldl9oaWdoID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpIC0gMV0uaXR2KVsxXTtcbiAgICAgICAgbGV0IGN1cnJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpXS5pdHYpWzBdO1xuICAgICAgICAvLyB2ZXJpZnkgdGhhdCBwcmV2IGhpZ2ggaXMgbGVzcyB0aGF0IGN1cnIgbG93XG4gICAgICAgIGlmICghZW5kcG9pbnQubHQocHJldl9oaWdoLCBjdXJyX2xvdykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk92ZXJsYXBwaW5nIGludGVydmFscyBmb3VuZFwiKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cblxuLypcblx0YmluYXJ5IHNlYXJjaCBmb3IgZmluZGluZyB0aGUgY29ycmVjdCBpbnNlcnRpb24gaW5kZXggaW50b1xuXHR0aGUgc29ydGVkIGFycmF5IChhc2NlbmRpbmcpIG9mIGl0ZW1zXG5cdFxuXHRhcnJheSBjb250YWlucyBvYmplY3RzLCBhbmQgdmFsdWUgZnVuYyByZXRyZWF2ZXMgYSB2YWx1ZVxuXHRmcm9tIGVhY2ggb2JqZWN0LlxuXG5cdHJldHVybiBbZm91bmQsIGluZGV4XVxuKi9cblxuZnVuY3Rpb24gZmluZF9pbmRleCh0YXJnZXQsIGFyciwgdmFsdWVfZnVuYykge1xuXG4gICAgZnVuY3Rpb24gZGVmYXVsdF92YWx1ZV9mdW5jKGVsKSB7XG4gICAgICAgIHJldHVybiBlbDtcbiAgICB9XG4gICAgXG4gICAgbGV0IGxlZnQgPSAwO1xuXHRsZXQgcmlnaHQgPSBhcnIubGVuZ3RoIC0gMTtcblx0dmFsdWVfZnVuYyA9IHZhbHVlX2Z1bmMgfHwgZGVmYXVsdF92YWx1ZV9mdW5jO1xuXHR3aGlsZSAobGVmdCA8PSByaWdodCkge1xuXHRcdGNvbnN0IG1pZCA9IE1hdGguZmxvb3IoKGxlZnQgKyByaWdodCkgLyAyKTtcblx0XHRsZXQgbWlkX3ZhbHVlID0gdmFsdWVfZnVuYyhhcnJbbWlkXSk7XG5cdFx0aWYgKG1pZF92YWx1ZSA9PT0gdGFyZ2V0KSB7XG5cdFx0XHRyZXR1cm4gW3RydWUsIG1pZF07IC8vIFRhcmdldCBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgYXJyYXlcblx0XHR9IGVsc2UgaWYgKG1pZF92YWx1ZSA8IHRhcmdldCkge1xuXHRcdFx0ICBsZWZ0ID0gbWlkICsgMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIHJpZ2h0XG5cdFx0fSBlbHNlIHtcblx0XHRcdCAgcmlnaHQgPSBtaWQgLSAxOyAvLyBNb3ZlIHNlYXJjaCByYW5nZSB0byB0aGUgbGVmdFxuXHRcdH1cblx0fVxuICBcdHJldHVybiBbZmFsc2UsIGxlZnRdOyAvLyBSZXR1cm4gdGhlIGluZGV4IHdoZXJlIHRhcmdldCBzaG91bGQgYmUgaW5zZXJ0ZWRcbn1cbiIsIlxuaW1wb3J0IHsgTGF5ZXJCYXNlLCBTdGF0ZVByb3ZpZGVyQmFzZSB9IGZyb20gXCIuL2Jhc2VzLmpzXCI7XG5pbXBvcnQgKiBhcyBzb3VyY2Vwcm9wIGZyb20gXCIuL3NvdXJjZXByb3AuanNcIjtcbmltcG9ydCB7IFN0YXRlUHJvdmlkZXJTaW1wbGUgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX3NpbXBsZS5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhTaW1wbGUgfSBmcm9tIFwiLi9uZWFyYnlpbmRleF9zaW1wbGUuanNcIjtcbmltcG9ydCB7IE5lYXJieUNhY2hlIH0gZnJvbSBcIi4vbmVhcmJ5Y2FjaGUuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4TWVyZ2UgfSBmcm9tIFwiLi9uZWFyYnlpbmRleF9tZXJnZS5qc1wiO1xuXG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBcbiAqIExheWVyXG4gKiAtIGhhcyBtdXRhYmxlIHN0YXRlIHByb3ZpZGVyIChzcmMpIChkZWZhdWx0IHN0YXRlIHVuZGVmaW5lZClcbiAqIC0gbWV0aG9kcyBmb3IgbGlzdCBhbmQgc2FtcGxlXG4gKiBcbiAqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXIgZXh0ZW5kcyBMYXllckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICAvLyBzcmNcbiAgICAgICAgc291cmNlcHJvcC5hZGRUb0luc3RhbmNlKHRoaXMsIFwic3JjXCIpO1xuICAgICAgICAvLyBjYWNoZSBvYmplY3RzXG4gICAgICAgIHRoaXMuX2NhY2hlX29iamVjdHMgPSBbXTtcblxuICAgICAgICAvLyBpbml0aWFsaXNlIHdpdGggc3RhdGVwcm92aWRlclxuICAgICAgICBsZXQge3NyYywgLi4ub3B0c30gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3JjID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3JjID0gbmV3IFN0YXRlUHJvdmlkZXJTaW1wbGUob3B0cyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgU3RhdGVQcm92aWRlckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzcmMgbXVzdCBiZSBTdGF0ZXByb3ZpZGVyQmFzZVwiKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBnZXRDYWNoZU9iamVjdCAoKSB7XG4gICAgICAgIGNvbnN0IGNhY2hlX29iamVjdCA9IG5ldyBOZWFyYnlDYWNoZSh0aGlzKTtcbiAgICAgICAgdGhpcy5fY2FjaGVfb2JqZWN0cy5wdXNoKGNhY2hlX29iamVjdCk7XG4gICAgICAgIHJldHVybiBjYWNoZV9vYmplY3Q7XG4gICAgfVxuICAgIFxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogU1JDIChzdGF0ZXByb3ZpZGVyKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgX19zcmNfY2hlY2soc3JjKSB7XG4gICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcInNyY1wiIG11c3QgYmUgc3RhdGUgcHJvdmlkZXIgJHtzcmN9YCk7XG4gICAgICAgIH1cbiAgICB9ICAgIFxuICAgIF9fc3JjX2hhbmRsZV9jaGFuZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbmRleCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2luZGV4ID0gbmV3IE5lYXJieUluZGV4U2ltcGxlKHRoaXMuc3JjKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yIChsZXQgY2FjaGVfb2JqZWN0IG9mIHRoaXMuX2NhY2hlX29iamVjdHMpIHtcbiAgICAgICAgICAgICAgICBjYWNoZV9vYmplY3QuZGlydHkoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgLy8gdHJpZ2dlciBjaGFuZ2UgZXZlbnQgZm9yIGN1cnNvclxuICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiKTsgICBcbiAgICB9XG59XG5zb3VyY2Vwcm9wLmFkZFRvUHJvdG90eXBlKExheWVyLnByb3RvdHlwZSwgXCJzcmNcIiwge211dGFibGU6dHJ1ZX0pO1xuXG5cbmZ1bmN0aW9uIGZyb21BcnJheSAoYXJyYXkpIHtcbiAgICBjb25zdCBpdGVtcyA9IGFycmF5Lm1hcCgob2JqLCBpbmRleCkgPT4ge1xuICAgICAgICByZXR1cm4geyBcbiAgICAgICAgICAgIGl0djogW2luZGV4LCBpbmRleCsxLCB0cnVlLCBmYWxzZV0sIFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIiwgXG4gICAgICAgICAgICBhcmdzOiB7dmFsdWU6b2JqfX07XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ldyBMYXllcih7aXRlbXN9KTtcbn1cblxuTGF5ZXIuZnJvbUFycmF5ID0gZnJvbUFycmF5O1xuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTUVSR0UgTEFZRVJcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuXG5cbmNsYXNzIE1lcmdlTGF5ZXJDYWNoZU9iamVjdCB7XG5cbiAgICBjb25zdHJ1Y3RvciAobGF5ZXIpIHtcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgdGhpcy5fY2FjaGVfb2JqZWN0cyA9IGxheWVyLnNvdXJjZXMubWFwKChsYXllcikgPT4gbGF5ZXIuZ2V0Q2FjaGVPYmplY3QoKSk7XG4gICAgfVxuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChvZmZzZXQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJMYXllcjogcXVlcnkgb2Zmc2V0IGNhbiBub3QgYmUgdW5kZWZpbmVkXCIpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHZlY3RvciA9IHRoaXMuX2NhY2hlX29iamVjdHMubWFwKChjYWNoZV9vYmplY3QpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBjYWNoZV9vYmplY3QucXVlcnkob2Zmc2V0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHZhbHVlRnVuYyA9IHRoaXMuX2xheWVyLnZhbHVlRnVuYztcbiAgICAgICAgY29uc3QgZHluYW1pYyA9IHZlY3Rvci5tYXAoKHYpID0+IHYuZHluYW1pYykuc29tZShlID0+IGUgPT0gdHJ1ZSk7XG4gICAgICAgIGNvbnN0IHZhbHVlcyA9IHZlY3Rvci5tYXAoKHYpID0+IHYudmFsdWUpO1xuICAgICAgICBjb25zdCB2YWx1ZSA9ICh2YWx1ZUZ1bmMpID8gdmFsdWVGdW5jKHZhbHVlcykgOiB2YWx1ZXM7XG4gICAgICAgIHJldHVybiB7dmFsdWUsIGR5bmFtaWMsIG9mZnNldH07XG4gICAgfVxuXG4gICAgZGlydHkoKSB7XG4gICAgICAgIC8vIE5vb3AgLSBhcyBsb25nIGFzIHF1ZXJ5b2JqZWN0IGlzIHN0YXRlbGVzc1xuICAgIH1cblxuICAgIHJlZnJlc2gob2Zmc2V0KSB7XG4gICAgICAgIC8vIE5vb3AgLSBhcyBsb25nIGFzIHF1ZXJ5b2JqZWN0IGlzIHN0YXRlbGVzc1xuICAgIH1cblxuICAgIGdldCBuZWFyYnkoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKVxuICAgIH1cblxuXG59XG5cblxuZXhwb3J0IGNsYXNzIE1lcmdlTGF5ZXIgZXh0ZW5kcyBMYXllckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLl9jYWNoZV9vYmplY3RzID0gW107XG5cbiAgICAgICAgLy8gdmFsdWUgZnVuY1xuICAgICAgICBsZXQge3ZhbHVlRnVuYz11bmRlZmluZWR9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZUZ1bmMgPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICB0aGlzLl92YWx1ZUZ1bmMgPSB2YWx1ZUZ1bmNcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNvdXJjZXMgKGxheWVycylcbiAgICAgICAgdGhpcy5fc291cmNlcztcbiAgICAgICAgbGV0IHtzb3VyY2VzfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzb3VyY2VzKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZXMgPSBzb3VyY2VzO1xuICAgICAgICB9XG4gXG4gICAgICAgIC8vIHN1YnNjcmliZSB0byBjYWxsYmFja3MgZnJvbSBzb3VyY2VzXG4gICAgfVxuXG5cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBnZXQgdmFsdWVGdW5jICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZhbHVlRnVuYztcbiAgICB9XG5cbiAgICBnZXRDYWNoZU9iamVjdCAoKSB7XG4gICAgICAgIGNvbnN0IGNhY2hlX29iamVjdCA9IG5ldyBNZXJnZUxheWVyQ2FjaGVPYmplY3QodGhpcyk7XG4gICAgICAgIHRoaXMuX2NhY2hlX29iamVjdHMucHVzaChjYWNoZV9vYmplY3QpO1xuICAgICAgICByZXR1cm4gY2FjaGVfb2JqZWN0O1xuICAgIH1cblxuICAgIC8qXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChvZmZzZXQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJMYXllcjogcXVlcnkgb2Zmc2V0IGNhbiBub3QgYmUgdW5kZWZpbmVkXCIpO1xuICAgICAgICB9XG4gICAgICAgIGxldCB2YWx1ZXMgPSB0aGlzLl9zb3VyY2VzLm1hcCgobGF5ZXIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBsYXllci5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gVE9ETyAtIGFwcGx5IGZ1bmN0aW9uIHRvIGFycml2ZSBhdCBzaW5nbGUgdmFsdWUgZm9yIGxheWVyLlxuICAgICAgICByZXR1cm4gdmFsdWVzO1xuICAgIH1cbiAgICAqL1xuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBVUERBVEUgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgXG4gICAgZ2V0IHNvdXJjZXMgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc291cmNlcztcbiAgICB9XG4gICAgc2V0IHNvdXJjZXMgKHNvdXJjZXMpIHtcbiAgICAgICAgdGhpcy5fc291cmNlcyA9IHNvdXJjZXM7XG4gICAgICAgIGxldCBpbmRleGVzID0gc291cmNlcy5tYXAoKGxheWVyKSA9PiBsYXllci5pbmRleCk7XG4gICAgICAgIHRoaXMuX2luZGV4ID0gbmV3IE5lYXJieUluZGV4TWVyZ2UoaW5kZXhlcyk7XG4gICAgfVxuXG59XG5cblxuIiwiaW1wb3J0IHsgQ2xvY2tQcm92aWRlckJhc2UgfSBmcm9tIFwiLi9iYXNlc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQ0xPQ0tTXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogY2xvY2tzIGNvdW50aW5nIGluIHNlY29uZHNcbiAqL1xuXG5jb25zdCBsb2NhbF9jbG9jayA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gcGVyZm9ybWFuY2Uubm93KCkvMTAwMC4wO1xufVxuXG5jb25zdCBsb2NhbF9lcG9jaCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS8xMDAwLjA7XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExPQ0FMIENMT0NLIFBST1ZJREVSXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogTG9jYWwgaGlnaCBwZXJmb3JtYW5jZSBjbG9ja1xuICovXG5cbmNsYXNzIExvY2FsQ2xvY2tQcm92aWRlciBleHRlbmRzIENsb2NrUHJvdmlkZXJCYXNlIHtcbiAgICBub3cgKCkgeyBcbiAgICAgICAgcmV0dXJuIGxvY2FsX2Nsb2NrKCk7XG4gICAgfVxufVxuLy8gc2luZ2xldG9uXG5leHBvcnQgY29uc3QgTE9DQUxfQ0xPQ0tfUFJPVklERVIgPSBuZXcgTG9jYWxDbG9ja1Byb3ZpZGVyKCk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExPQ0FMIEVQT0NIIENMT0NLIFBST1ZJREVSXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogTG9jYWwgRXBvY2ggQ2xvY2sgUHJvdmlkZXIgaXMgY29tcHV0ZWQgZnJvbSBsb2NhbCBoaWdoXG4gKiBwZXJmb3JtYW5jZSBjbG9jay4gVGhpcyBtYWtlcyBmb3IgYSBiZXR0ZXIgcmVzb2x1dGlvbiB0aGFuXG4gKiB0aGUgc3lzdGVtIGVwb2NoIGNsb2NrLCBhbmQgcHJvdGVjdHMgdGhlIGNsb2NrIGZyb20gc3lzdGVtIFxuICogY2xvY2sgYWRqdXN0bWVudHMgZHVyaW5nIHRoZSBzZXNzaW9uLlxuICovXG5cbmNsYXNzIExvY2FsRXBvY2hQcm92aWRlciBleHRlbmRzIENsb2NrUHJvdmlkZXJCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fdDAgPSBsb2NhbF9jbG9jaygpO1xuICAgICAgICB0aGlzLl90MF9lcG9jaCA9IGxvY2FsX2Vwb2NoKCk7XG4gICAgfVxuICAgIG5vdyAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90MF9lcG9jaCArIChsb2NhbF9jbG9jaygpIC0gdGhpcy5fdDApOyAgICAgICAgICAgIFxuICAgIH1cbn1cblxuLy8gc2luZ2xldG9uXG5leHBvcnQgY29uc3QgTE9DQUxfRVBPQ0hfUFJPVklERVIgPSBuZXcgTG9jYWxFcG9jaFByb3ZpZGVyKCk7XG5cblxuXG4iLCJpbXBvcnQgeyBcbiAgICBDbG9ja1Byb3ZpZGVyQmFzZSxcbiAgICBTdGF0ZVByb3ZpZGVyQmFzZSxcbiAgICBDdXJzb3JCYXNlLCBcbiAgICBMYXllckJhc2Vcbn0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCAqIGFzIHNvdXJjZXByb3AgZnJvbSBcIi4vc291cmNlcHJvcC5qc1wiO1xuaW1wb3J0IHsgY21kIH0gZnJvbSBcIi4vY21kLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuL2xheWVycy5qc1wiO1xuaW1wb3J0IHsgTE9DQUxfQ0xPQ0tfUFJPVklERVIsIExPQ0FMX0VQT0NIX1BST1ZJREVSIH0gZnJvbSBcIi4vY2xvY2twcm92aWRlcnMuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBDTE9DSyBDVVJTT1JcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogQ29udmVuaWVuY2Ugd3JhcHBpbmcgYXJvdW5kIGEgY2xvY2sgcHJvdmlkZXIuXG4gKiAtIG1ha2VzIGl0IGVhc3kgdG8gdmlzdWFsaXplIGEgY2xvY2sgbGlrZSBhbnkgb3RoZXIgY3Vyc29yXG4gKiAtIGFsbG93cyBjdXJzb3IuY3RybCB0byBhbHdheXMgYmUgY3Vyc29yIHR5cGVcbiAqIC0gYWxsb3dzIGN1cnNvcnMgdG8gYmUgZHJpdmVuIGJ5IG9ubGluZSBjbG9ja3MgXG4gKi9cblxuY2xhc3MgQ2xvY2tDdXJzb3IgZXh0ZW5kcyBDdXJzb3JCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yIChzcmMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLy8gc3JjXG4gICAgICAgIHNvdXJjZXByb3AuYWRkVG9JbnN0YW5jZSh0aGlzLCBcInNyY1wiKTtcbiAgICAgICAgdGhpcy5zcmMgPSBzcmM7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBTUkMgKHN0YXRlcHJvdmlkZXIpXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfX3NyY19jaGVjayhzcmMpIHtcbiAgICAgICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgQ2xvY2tQcm92aWRlckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwic3JjXCIgbXVzdCBiZSBDbG9ja1Byb3ZpZGVyICR7c3JjfWApO1xuICAgICAgICB9XG4gICAgfSAgICBcbiAgICBfX3NyY19oYW5kbGVfY2hhbmdlKHJlYXNvbikge1xuICAgICAgICAvKipcbiAgICAgICAgICogTG9jYWwgQ2xvY2tQcm92aWRlcnMgbmV2ZXIgY2hhbmdlIFxuICAgICAgICAgKiBkbyBjaGFuZ2UgLSBpbiB0aGUgc2Vuc2UgdGhhdCBhbmQgc2lnbmFsIGNoYW5nZSB0aHJvdWdoXG4gICAgICAgICAqIHRoaXMgY2FsbGJhY2suXG4gICAgICAgICAqIFxuICAgICAgICAgKiBDdXJyZW50bHkgd2UgaWdub3JlIHN1Y2ggY2hhbmdlcywgb24gdGhlIGFzc3VtdGlvblxuICAgICAgICAgKiB0aGF0IHRoZXNlIGNoYW5nZXMgYXJlIHNtYWxsIGFuZCB0aGF0XG4gICAgICAgICAqIHRoZXJlIGlzIG5vIG5lZWQgdG8gaW5mb3JtIHRoZSBhcHBsaWNhdGlvbiBhYm91dCBpdC5cbiAgICAgICAgICogXG4gICAgICAgICAqIEhvd2V2ZXIsIHdlIHdlIGRvIG5vdCBpZ25vcmUgc3dpdGNoaW5nIGJldHdlZW4gY2xvY2tzLFxuICAgICAgICAgKiB3aGljaCBtYXkgaGFwcGVuIGlmIG9uZSBzd2l0Y2hlcyBmcm9tIGEgbG9jYWwgY2xvY2tcbiAgICAgICAgICogdG8gYW4gb25saW5lIHNvdXJjZS4gTm90ZSBob3dldmVyIHRoYXQgc3dpdGNoaW5nIGNsb2Nrc1xuICAgICAgICAgKiBtYWtlIG1vc3Qgc2Vuc2UgaWYgdGhlIGNsb2NrcyBhcmUgd2l0aGluIHRoZSBzYW1lIHRpbWUgZG9tYWluXG4gICAgICAgICAqIGZvciBleGFtcGxlLCBzd2l0Y2hpbmcgZnJvbSBsb2NhbCBlcG9jaCB0byBnbG9iYWwgZXBvY2gsXG4gICAgICAgICAqIHdoaVxuICAgICAgICAgKi9cbiAgICAgICAgLy8gXG4gICAgICAgIGlmIChyZWFzb24gPT0gXCJyZXNldFwiKSB7XG4gICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHF1ZXJ5ICgpIHtcbiAgICAgICAgbGV0IHRzID0gIHRoaXMuc3JjLm5vdygpO1xuICAgICAgICByZXR1cm4ge3ZhbHVlOnRzLCBkeW5hbWljOnRydWUsIG9mZnNldDp0c31cbiAgICB9XG59XG5zb3VyY2Vwcm9wLmFkZFRvUHJvdG90eXBlKENsb2NrQ3Vyc29yLnByb3RvdHlwZSwgXCJzcmNcIiwge211dGFibGU6dHJ1ZX0pO1xuXG4vLyBzaW5nbGV0b24gY2xvY2sgY3Vyc29yc1xuY29uc3QgbG9jYWxDbG9ja0N1cnNvciA9IG5ldyBDbG9ja0N1cnNvcihMT0NBTF9DTE9DS19QUk9WSURFUik7XG5jb25zdCBlcG9jaENsb2NrQ3Vyc29yID0gbmV3IENsb2NrQ3Vyc29yKExPQ0FMX0VQT0NIX1BST1ZJREVSKTtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBDVVJTT1JcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogXG4gKiBDdXJzb3IgaXMgYSB2YXJpYWJsZVxuICogLSBoYXMgbXV0YWJsZSBjdHJsIGN1cnNvciAoZGVmYXVsdCBsb2NhbCBjbG9jaylcbiAqIC0gaGFzIG11dGFibGUgc3RhdGUgcHJvdmlkZXIgKHNyYykgKGRlZmF1bHQgc3RhdGUgdW5kZWZpbmVkKVxuICogLSBtZXRob2RzIGZvciBhc3NpZ24sIG1vdmUsIHRyYW5zaXRpb24sIGludGVwb2xhdGlvblxuICogXG4gKi9cblxuZXhwb3J0IGNsYXNzIEN1cnNvciBleHRlbmRzIEN1cnNvckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLy8gY3RybFxuICAgICAgICBzb3VyY2Vwcm9wLmFkZFRvSW5zdGFuY2UodGhpcywgXCJjdHJsXCIpO1xuICAgICAgICAvLyBzcmNcbiAgICAgICAgc291cmNlcHJvcC5hZGRUb0luc3RhbmNlKHRoaXMsIFwic3JjXCIpO1xuICAgICAgICAvLyBpbmRleFxuICAgICAgICB0aGlzLl9pbmRleDtcbiAgICAgICAgLy8gY3Vyc29yIG1haW50YWlucyBhIGNhc2hlIG9iamVjdCBmb3IgcXVlcnlpbmcgc3JjIGxheWVyXG4gICAgICAgIHRoaXMuX2NhY2hlO1xuICAgICAgICAvLyB0aW1lb3V0XG4gICAgICAgIHRoaXMuX3RpZDtcbiAgICAgICAgLy8gcG9sbGluZ1xuICAgICAgICB0aGlzLl9waWQ7XG4gICAgICAgIC8vIG9wdGlvbnNcbiAgICAgICAgbGV0IHtzcmMsIGN0cmwsIC4uLm9wdHN9ID0gb3B0aW9ucztcblxuICAgICAgICAvLyBpbml0aWFsaXNlIGN0cmxcbiAgICAgICAgaWYgKGN0cmwgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBsZXQge2Vwb2NoPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgICAgICAgICBjdHJsID0gKGVwb2NoKSA/IGVwb2NoQ2xvY2tDdXJzb3IgOiBsb2NhbENsb2NrQ3Vyc29yO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY3RybCA9IGN0cmw7XG5cbiAgICAgICAgLy8gaW5pdGlhbGlzZSBzdGF0ZVxuICAgICAgICBpZiAoc3JjID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3JjID0gbmV3IExheWVyKG9wdHMpO1xuICAgICAgICB9IGVsc2UgaWYgKHNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSB7XG4gICAgICAgICAgICBzcmMgPSBuZXcgTGF5ZXIoe3NyY30pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3JjID0gc3JjXG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBDVFJMIChjdXJzb3IpXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfX2N0cmxfY2hlY2soY3RybCkge1xuICAgICAgICBpZiAoIShjdHJsIGluc3RhbmNlb2YgQ3Vyc29yQmFzZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJjdHJsXCIgbXVzdCBiZSBjdXJzb3IgJHtjdHJsfWApXG4gICAgICAgIH1cbiAgICB9XG4gICAgX19jdHJsX2hhbmRsZV9jaGFuZ2UocmVhc29uKSB7XG4gICAgICAgIHRoaXMuX19oYW5kbGVfY2hhbmdlKFwiY3RybFwiLCByZWFzb24pO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogU1JDIChsYXllcilcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIF9fc3JjX2NoZWNrKHNyYykge1xuICAgICAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBMYXllckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwic3JjXCIgbXVzdCBiZSBMYXllciAke3NyY31gKTtcbiAgICAgICAgfVxuICAgIH0gICAgXG4gICAgX19zcmNfaGFuZGxlX2NoYW5nZShyZWFzb24pIHtcbiAgICAgICAgdGhpcy5fX2hhbmRsZV9jaGFuZ2UoXCJzcmNcIiwgcmVhc29uKTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIENBTExCQUNLXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfX2hhbmRsZV9jaGFuZ2Uob3JpZ2luLCByZWFzb24pIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3RpZCk7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5fcGlkKTtcbiAgICAgICAgaWYgKHRoaXMuc3JjICYmIHRoaXMuY3RybCkge1xuICAgICAgICAgICAgaWYgKG9yaWdpbiA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVzZXQgY3Vyc29yIGluZGV4IHRvIGxheWVyIGluZGV4XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2luZGV4ICE9IHRoaXMuc3JjLmluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2luZGV4ID0gdGhpcy5zcmMuaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlID0gdGhpcy5zcmMuZ2V0Q2FjaGVPYmplY3QoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAob3JpZ2luID09IFwic3JjXCIgfHwgb3JpZ2luID09IFwiY3RybFwiKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVldmFsdWF0ZSB0aGUgY2FjaGVcbiAgICAgICAgICAgICAgICB0aGlzLl9jYWNoZS5kaXJ0eSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlZnJlc2goKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICAgICAgLy8gdHJpZ2dlciBjaGFuZ2UgZXZlbnQgZm9yIGN1cnNvclxuICAgICAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdGhpcy5xdWVyeSgpKTtcbiAgICAgICAgICAgIC8vIGRldGVjdCBmdXR1cmUgY2hhbmdlIGV2ZW50IC0gaWYgbmVlZGVkXG4gICAgICAgICAgICB0aGlzLl9fZGV0ZWN0X2Z1dHVyZV9jaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERFVEVDVCBGVVRVUkUgQ0hBTkdFXG4gICAgICogXG4gICAgICogUFJPQkxFTTpcbiAgICAgKiBcbiAgICAgKiBEdXJpbmcgcGxheWJhY2sgKGN1cnNvci5jdHJsIGlzIGR5bmFtaWMpLCB0aGVyZSBpcyBhIG5lZWQgdG8gXG4gICAgICogZGV0ZWN0IHRoZSBwYXNzaW5nIGZyb20gb25lIHNlZ21lbnQgaW50ZXJ2YWwgb2Ygc3JjXG4gICAgICogdG8gdGhlIG5leHQgLSBpZGVhbGx5IGF0IHByZWNpc2VseSB0aGUgY29ycmVjdCB0aW1lXG4gICAgICogXG4gICAgICogbmVhcmJ5Lml0diAoZGVyaXZlZCBmcm9tIGN1cnNvci5zcmMpIGdpdmVzIHRoZSBcbiAgICAgKiBpbnRlcnZhbCAoaSkgd2UgYXJlIGN1cnJlbnRseSBpbiwgaS5lLiwgXG4gICAgICogY29udGFpbmluZyB0aGUgY3VycmVudCBvZmZzZXQgKHZhbHVlIG9mIGN1cnNvci5jdHJsKSwgXG4gICAgICogYW5kIChpaSkgd2hlcmUgbmVhcmJ5LmNlbnRlciBzdGF5cyBjb25zdGFudFxuICAgICAqIFxuICAgICAqIFRoZSBldmVudCB0aGF0IG5lZWRzIHRvIGJlIGRldGVjdGVkIGlzIHRoZXJlZm9yZSB0aGVcbiAgICAgKiBtb21lbnQgd2hlbiB3ZSBsZWF2ZSB0aGlzIGludGVydmFsLCB0aHJvdWdoIGVpdGhlclxuICAgICAqIHRoZSBsb3cgb3IgaGlnaCBpbnRlcnZhbCBlbmRwb2ludFxuICAgICAqIFxuICAgICAqIEdPQUw6XG4gICAgICogXG4gICAgICogQXQgdGhpcyBtb21lbnQsIHdlIHNpbXBseSBuZWVkIHRvIHJlZXZhbHVhdGUgdGhlIHN0YXRlIChxdWVyeSkgYW5kXG4gICAgICogZW1pdCBhIGNoYW5nZSBldmVudCB0byBub3RpZnkgb2JzZXJ2ZXJzLiBcbiAgICAgKiBcbiAgICAgKiBBUFBST0FDSEVTOlxuICAgICAqIFxuICAgICAqIEFwcHJvYWNoIFswXSBcbiAgICAgKiBUaGUgdHJpdmlhbCBzb2x1dGlvbiBpcyB0byBkbyBub3RoaW5nLCBpbiB3aGljaCBjYXNlXG4gICAgICogb2JzZXJ2ZXJzIHdpbGwgc2ltcGx5IGZpbmQgb3V0IHRoZW1zZWx2ZXMgYWNjb3JkaW5nIHRvIHRoZWlyIFxuICAgICAqIG93biBwb2xsIGZyZXF1ZW5jeS4gVGhpcyBpcyBzdWJvcHRpbWFsLCBwYXJ0aWN1bGFybHkgZm9yIGxvdyBmcmVxdWVuY3kgXG4gICAgICogb2JzZXJ2ZXJzLiBJZiB0aGVyZSBpcyBhdCBsZWFzdCBvbmUgaGlnaC1mcmVxdWVuY3kgcG9sbGVyLCBcbiAgICAgKiB0aGlzIHdvdWxkIHRyaWdnZXIgdHJpZ2dlciB0aGUgc3RhdGUgY2hhbmdlLCBjYXVzaW5nIGFsbFxuICAgICAqIG9ic2VydmVycyB0byBiZSBub3RpZmllZC4gVGhlIHByb2JsZW0gdGhvdWdoLCBpcyBpZiBubyBvYnNlcnZlcnNcbiAgICAgKiBhcmUgYWN0aXZlbHkgcG9sbGluZywgYnV0IG9ubHkgZGVwZW5kaW5nIG9uIGNoYW5nZSBldmVudHMuXG4gICAgICogXG4gICAgICogQXBwcm9hY2ggWzFdIFxuICAgICAqIEluIGNhc2VzIHdoZXJlIHRoZSBjdHJsIGlzIGRldGVybWluaXN0aWMsIGEgdGltZW91dFxuICAgICAqIGNhbiBiZSBjYWxjdWxhdGVkLiBUaGlzIGlzIHRyaXZpYWwgaWYgY3RybCBpcyBhIENsb2NrQ3Vyc29yLCBhbmRcbiAgICAgKiBpdCBpcyBmYWlybHkgZWFzeSBpZiB0aGUgY3RybCBpcyBDdXJzb3IgcmVwcmVzZW50aW5nIG1vdGlvblxuICAgICAqIG9yIGxpbmVhciB0cmFuc2l0aW9uLiBIb3dldmVyLCBjYWxjdWxhdGlvbnMgY2FuIGJlY29tZSBtb3JlXG4gICAgICogY29tcGxleCBpZiBtb3Rpb24gc3VwcG9ydHMgYWNjZWxlcmF0aW9uLCBvciBpZiB0cmFuc2l0aW9uc1xuICAgICAqIGFyZSBzZXQgdXAgd2l0aCBub24tbGluZWFyIGVhc2luZy5cbiAgICAgKiAgIFxuICAgICAqIE5vdGUsIGhvd2V2ZXIsIHRoYXQgdGhlc2UgY2FsY3VsYXRpb25zIGFzc3VtZSB0aGF0IHRoZSBjdXJzb3IuY3RybCBpcyBcbiAgICAgKiBhIENsb2NrQ3Vyc29yLCBvciB0aGF0IGN1cnNvci5jdHJsLmN0cmwgaXMgYSBDbG9ja0N1cnNvci4gXG4gICAgICogSW4gcHJpbmNpcGxlLCB0aG91Z2gsIHRoZXJlIGNvdWxkIGJlIGEgcmVjdXJzaXZlIGNoYWluIG9mIGN1cnNvcnMsXG4gICAgICogKGN1cnNvci5jdHJsLmN0cmwuLi4uY3RybCkgb2Ygc29tZSBsZW5ndGgsIHdoZXJlIG9ubHkgdGhlIGxhc3QgaXMgYSBcbiAgICAgKiBDbG9ja0N1cnNvci4gSW4gb3JkZXIgdG8gZG8gZGV0ZXJtaW5pc3RpYyBjYWxjdWxhdGlvbnMgaW4gdGhlIGdlbmVyYWxcbiAgICAgKiBjYXNlLCBhbGwgY3Vyc29ycyBpbiB0aGUgY2hhaW4gd291bGQgaGF2ZSB0byBiZSBsaW1pdGVkIHRvIFxuICAgICAqIGRldGVybWluaXN0aWMgbGluZWFyIHRyYW5zZm9ybWF0aW9ucy5cbiAgICAgKiBcbiAgICAgKiBBcHByb2NoIFsyXSBcbiAgICAgKiBJdCBtaWdodCBhbHNvIGJlIHBvc3NpYmxlIHRvIHNhbXBsZSBmdXR1cmUgdmFsdWVzIG9mIFxuICAgICAqIGN1cnNvci5jdHJsIHRvIHNlZSBpZiB0aGUgdmFsdWVzIHZpb2xhdGUgdGhlIG5lYXJieS5pdHYgYXQgc29tZSBwb2ludC4gXG4gICAgICogVGhpcyB3b3VsZCBlc3NlbnRpYWxseSBiZSB0cmVhdGluZyBjdHJsIGFzIGEgbGF5ZXIgYW5kIHNhbXBsaW5nIFxuICAgICAqIGZ1dHVyZSB2YWx1ZXMuIFRoaXMgYXBwcm9jaCB3b3VsZCB3b3JrIGZvciBhbGwgdHlwZXMsIFxuICAgICAqIGJ1dCB0aGVyZSBpcyBubyBrbm93aW5nIGhvdyBmYXIgaW50byB0aGUgZnV0dXJlIG9uZSBcbiAgICAgKiB3b3VsZCBoYXZlIHRvIHNlZWsuIEhvd2V2ZXIsIGFnYWluIC0gYXMgaW4gWzFdIHRoZSBhYmlsaXR5IHRvIHNhbXBsZSBmdXR1cmUgdmFsdWVzXG4gICAgICogaXMgcHJlZGljYXRlZCBvbiBjdXJzb3IuY3RybCBiZWluZyBhIENsb2NrQ3Vyc29yLiBBbHNvLCB0aGVyZSBcbiAgICAgKiBpcyBubyB3YXkgb2Yga25vd2luZyBob3cgbG9uZyBpbnRvIHRoZSBmdXR1cmUgc2FtcGxpbmcgd291bGQgYmUgbmVjZXNzYXJ5LlxuICAgICAqIFxuICAgICAqIEFwcHJvYWNoIFszXSBcbiAgICAgKiBJbiB0aGUgZ2VuZXJhbCBjYXNlLCB0aGUgb25seSB3YXkgdG8gcmVsaWFibGV5IGRldGVjdCB0aGUgZXZlbnQgaXMgdGhyb3VnaCByZXBlYXRlZFxuICAgICAqIHBvbGxpbmcuIEFwcHJvYWNoIFszXSBpcyBzaW1wbHkgdGhlIGlkZWEgdGhhdCB0aGlzIHBvbGxpbmcgaXMgcGVyZm9ybWVkXG4gICAgICogaW50ZXJuYWxseSBieSB0aGUgY3Vyc29yIGl0c2VsZiwgYXMgYSB3YXkgb2Ygc2VjdXJpbmcgaXRzIG93biBjb25zaXN0ZW50XG4gICAgICogc3RhdGUsIGFuZCBlbnN1cmluZyB0aGF0IG9ic2VydmVyIGdldCBjaGFuZ2UgZXZlbnRzIGluIGEgdGltZWx5IG1hbm5lciwgZXZlbnRcbiAgICAgKiBpZiB0aGV5IGRvIGxvdy1mcmVxdWVuY3kgcG9sbGluZywgb3IgZG8gbm90IGRvIHBvbGxpbmcgYXQgYWxsLiBcbiAgICAgKiBcbiAgICAgKiBTT0xVVElPTjpcbiAgICAgKiBBcyB0aGVyZSBpcyBubyBwZXJmZWN0IHNvbHV0aW9uIGluIHRoZSBnZW5lcmFsIGNhc2UsIHdlIG9wcG9ydHVuaXN0aWNhbGx5XG4gICAgICogdXNlIGFwcHJvYWNoIFsxXSB3aGVuIHRoaXMgaXMgcG9zc2libGUuIElmIG5vdCwgd2UgYXJlIGZhbGxpbmcgYmFjayBvbiBcbiAgICAgKiBhcHByb2FjaCBbM11cbiAgICAgKiBcbiAgICAgKiBDT05ESVRJT05TIHdoZW4gTk8gZXZlbnQgZGV0ZWN0aW9uIGlzIG5lZWRlZCAoTk9PUClcbiAgICAgKiAoaSkgY3Vyc29yLmN0cmwgaXMgbm90IGR5bmFtaWNcbiAgICAgKiBvclxuICAgICAqIChpaSkgbmVhcmJ5Lml0diBzdHJldGNoZXMgaW50byBpbmZpbml0eSBpbiBib3RoIGRpcmVjdGlvbnNcbiAgICAgKiBcbiAgICAgKiBDT05ESVRJT05TIHdoZW4gYXBwcm9hY2ggWzFdIGNhbiBiZSB1c2VkXG4gICAgICogXG4gICAgICogKGkpIGlmIGN0cmwgaXMgYSBDbG9ja0N1cnNvciAmJiBuZWFyYnkuaXR2LmhpZ2ggPCBJbmZpbml0eVxuICAgICAqIG9yXG4gICAgICogKGlpKSBjdHJsLmN0cmwgaXMgYSBDbG9ja0N1cnNvclxuICAgICAqICAgICAgKGEpIGN0cmwubmVhcmJ5LmNlbnRlciBoYXMgZXhhY3RseSAxIGl0ZW1cbiAgICAgKiAgICAgICYmXG4gICAgICogICAgICAoYikgY3RybC5uZWFyYnkuY2VudGVyWzBdLnR5cGUgPT0gKFwibW90aW9uXCIpIHx8IChcInRyYW5zaXRpb25cIiAmJiBlYXNpbmc9PVwibGluZWFyXCIpXG4gICAgICogICAgICAmJlxuICAgICAqICAgICAgKGMpIGN0cmwubmVhcmJ5LmNlbnRlclswXS5hcmdzLnZlbG9jaXR5ICE9IDAuMFxuICAgICAqICAgICAgJiYgXG4gICAgICogICAgICAoZCkgZnV0dXJlIGludGVyc2VjdG9uIHBvaW50IHdpdGggY2FjaGUubmVhcmJ5Lml0diBcbiAgICAgKiAgICAgICAgICBpcyBub3QgLUluZmluaXR5IG9yIEluZmluaXR5XG4gICAgICogXG4gICAgICogVGhvdWdoIGl0IHNlZW1zIGNvbXBsZXgsIGNvbmRpdGlvbnMgZm9yIFsxXSBzaG91bGQgYmUgbWV0IGZvciBjb21tb24gY2FzZXMgaW52b2x2aW5nXG4gICAgICogcGxheWJhY2suIEFsc28sIHVzZSBvZiB0cmFuc2l0aW9uIGV0YyBtaWdodCBiZSByYXJlLlxuICAgICAqIFxuICAgICAqL1xuXG4gICAgX19kZXRlY3RfZnV0dXJlX2NoYW5nZSgpIHtcblxuICAgICAgICAvLyBjdHJsIFxuICAgICAgICBjb25zdCBjdHJsX3ZlY3RvciA9IHRoaXMuY3RybC5xdWVyeSgpO1xuICAgICAgICBjb25zdCB7dmFsdWU6Y3VycmVudF9wb3MsIG9mZnNldDpjdXJyZW50X3RzfSA9IGN0cmxfdmVjdG9yO1xuXG4gICAgICAgIC8vIGN0cmwgbXVzdCBiZSBkeW5hbWljXG4gICAgICAgIGlmICghY3RybF92ZWN0b3IuZHluYW1pYykge1xuICAgICAgICAgICAgLy8gbm8gZnV0dXJlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2V0IG5lYXJieSBmcm9tIHNyYyAtIHVzZSB2YWx1ZSBmcm9tIGN0cmxcbiAgICAgICAgY29uc3Qgc3JjX25lYXJieSA9IHRoaXMuc3JjLmluZGV4Lm5lYXJieShjdXJyZW50X3Bvcyk7XG4gICAgICAgIGNvbnN0IFtsb3csIGhpZ2hdID0gc3JjX25lYXJieS5pdHYuc2xpY2UoMCwyKTtcblxuICAgICAgICAvLyBhcHByb2FjaCBbMV1cbiAgICAgICAgaWYgKHRoaXMuY3RybCBpbnN0YW5jZW9mIENsb2NrQ3Vyc29yKSB7XG4gICAgICAgICAgICBpZiAoaXNGaW5pdGUoaGlnaCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9fc2V0X3RpbWVvdXQoaGlnaCwgY3VycmVudF9wb3MsIDEuMCwgY3VycmVudF90cyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbm8gZnV0dXJlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IFxuICAgICAgICBpZiAoXG4gICAgICAgICAgICB0aGlzLmN0cmwgaW5zdGFuY2VvZiBDdXJzb3IgJiYgXG4gICAgICAgICAgICB0aGlzLmN0cmwuY3RybCBpbnN0YW5jZW9mIENsb2NrQ3Vyc29yXG4gICAgICAgICkge1xuICAgICAgICAgICAgLyoqIFxuICAgICAgICAgICAgICogQ3RybCBoYXMgbWFueSBwb3NzaWJsZSBiZWhhdmlvcnNcbiAgICAgICAgICAgICAqIFNpbmNlIEN0cmwgaXMgbm90IGEgQ2xvY2tDdXJzb3IgLSBcbiAgICAgICAgICAgICAqIGl0IGhhcyBhbiBpbmRleCAtIHVzZSB0aGlzIHRvIGZpZ3VyZSBvdXQgd2hpY2hcbiAgICAgICAgICAgICAqIGJlaGF2aW91ciBpcyBjdXJyZW50LlxuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyB1c2UgdGhlIHNhbWUgb2Zmc2V0IHRoYXQgd2FzIHVzZWQgaW4gdGhlIGN0cmwucXVlcnlcbiAgICAgICAgICAgIGNvbnN0IGN0cmxfbmVhcmJ5ID0gdGhpcy5jdHJsLmluZGV4Lm5lYXJieShjdXJyZW50X3RzKTtcblxuICAgICAgICAgICAgaWYgKCFpc0Zpbml0ZShsb3cpICYmICFpc0Zpbml0ZShoaWdoKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vIGZ1dHVyZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY3RybF9uZWFyYnkuY2VudGVyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY3RybF9pdGVtID0gY3RybF9uZWFyYnkuY2VudGVyWzBdO1xuICAgICAgICAgICAgICAgIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHt2ZWxvY2l0eSwgYWNjZWxlcmF0aW9uPTAuMH0gPSBjdHJsX2l0ZW0uYXJncztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjY2VsZXJhdGlvbiA9PSAwLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdGFyZ2V0X3BvcyA9ICh2ZWxvY2l0eSA+IDApID8gaGlnaCA6IGxvdztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0Zpbml0ZSh0YXJnZXRfcG9zKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjsgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBubyBmdXR1cmUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gYWNjZWxlcmF0aW9uIC0gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7djA6cDAsIHYxOnAxLCB0MCwgdDEsIGVhc2luZz1cImxpbmVhclwifSA9IGN0cmxfaXRlbS5hcmdzO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZWFzaW5nID09IFwibGluZWFyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2ZWxvY2l0eSA9IChwMS1wMCkvKHQxLXQwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRfcG9zID0gKHZlbG9jaXR5ID4gMCkgPyBNYXRoLm1pbihoaWdoLCBwMSkgOiBNYXRoLm1heChsb3csIHAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBvdGhlciBlYXNpbmcgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gb3RoZXIgdHlwZSAoaW50ZXJwb2xhdGlvbikgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIG1vcmUgdGhhbiBvbmUgc2VnbWVudCAtIHBvc3NpYmxlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0IC0gYXBwcm9hY2ggWzNdXG4gICAgICAgIHRoaXMuX19zZXRfcG9sbGluZygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNldCB0aW1lb3V0XG4gICAgICogLSBwcm90ZWN0cyBhZ2FpbnN0IHRvbyBlYXJseSBjYWxsYmFja3MgYnkgcmVzY2hlZHVsaW5nXG4gICAgICogdGltZW91dCBpZiBuZWNjZXNzYXJ5LlxuICAgICAqIC0gYWRkcyBhIG1pbGxpc2Vjb25kIHRvIG9yaWdpbmFsIHRpbWVvdXQgdG8gYXZvaWRcbiAgICAgKiBmcmVxdWVudCByZXNjaGVkdWxpbmcgXG4gICAgICovXG5cbiAgICBfX3NldF90aW1lb3V0KHRhcmdldF9wb3MsIGN1cnJlbnRfcG9zLCB2ZWxvY2l0eSwgY3VycmVudF90cykge1xuICAgICAgICBjb25zdCBkZWx0YV9zZWMgPSAodGFyZ2V0X3BvcyAtIGN1cnJlbnRfcG9zKSAvIHZlbG9jaXR5O1xuICAgICAgICBjb25zdCB0YXJnZXRfdHMgPSBjdXJyZW50X3RzICsgZGVsdGFfc2VjO1xuICAgICAgICB0aGlzLl90aWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX19oYW5kbGVfdGltZW91dCh0YXJnZXRfdHMpO1xuICAgICAgICB9LCBkZWx0YV9zZWMqMTAwMCArIDEpO1xuICAgIH1cblxuICAgIF9faGFuZGxlX3RpbWVvdXQodGFyZ2V0X3RzKSB7XG4gICAgICAgIGNvbnN0IHtvZmZzZXQ6dHN9ID0gdGhpcy5jdHJsLnF1ZXJ5KCk7XG4gICAgICAgIGNvbnN0IHJlbWFpbmluZ19zZWMgPSB0YXJnZXRfdHMgLSB0czsgXG4gICAgICAgIGlmIChyZW1haW5pbmdfc2VjIDw9IDApIHtcbiAgICAgICAgICAgIC8vIGRvbmVcbiAgICAgICAgICAgIHRoaXMuX19oYW5kbGVfY2hhbmdlKFwidGltZW91dFwiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHJlc2NoZWR1bGUgdGltZW91dFxuICAgICAgICAgICAgdGhpcy5fdGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV90aW1lb3V0KHRhcmdldF90cylcbiAgICAgICAgICAgIH0sIHJlbWFpbmluZ19zZWMqMTAwMCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBzZXQgcG9sbGluZ1xuICAgICAqL1xuXG4gICAgX19zZXRfcG9sbGluZygpIHtcbiAgICAgICAgdGhpcy5fcGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV9wb2xsKCk7XG4gICAgICAgIH0sIDEwMCk7XG4gICAgfVxuXG4gICAgX19oYW5kbGVfcG9sbCgpIHtcbiAgICAgICAgdGhpcy5xdWVyeSgpO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgX3JlZnJlc2ggKCkge1xuICAgICAgICBsZXQge3ZhbHVlOm9mZnNldH0gPSB0aGlzLmN0cmwucXVlcnkoKTtcbiAgICAgICAgaWYgKHR5cGVvZiBvZmZzZXQgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhcm5pbmc6IGN0cmwgc3RhdGUgbXVzdCBiZSBudW1iZXIgJHtvZmZzZXR9YCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHJlZnJlc2hlZCA9IHRoaXMuX2NhY2hlLnJlZnJlc2gob2Zmc2V0KTtcbiAgICAgICAgcmV0dXJuIFtvZmZzZXQsIHJlZnJlc2hlZF07XG4gICAgfVxuXG4gICAgcXVlcnkgKCkge1xuICAgICAgICBsZXQgW29mZnNldCwgcmVmcmVzaGVkXSA9IHRoaXMuX3JlZnJlc2goKTtcbiAgICAgICAgaWYgKHJlZnJlc2hlZCkge1xuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV9jaGFuZ2UoXCJxdWVyeVwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2FjaGUucXVlcnkob2Zmc2V0KTtcbiAgICB9XG5cbiAgICBnZXQgdmFsdWUgKCkge3JldHVybiB0aGlzLnF1ZXJ5KCkudmFsdWV9O1xuICAgIGdldCBjYWNoZSAoKSB7cmV0dXJuIHRoaXMuX2NhY2hlfTtcbiAgICBnZXQgaW5kZXggKCkge3JldHVybiB0aGlzLl9pbmRleH07XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFVQREFURSBBUElcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGFzc2lnbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gY21kKHRoaXMuc3JjLnNyYykuYXNzaWduKHZhbHVlKTtcbiAgICB9XG4gICAgbW92ZSAoe3Bvc2l0aW9uLCB2ZWxvY2l0eX0pIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgb2Zmc2V0OnRpbWVzdGFtcH0gPSB0aGlzLnF1ZXJ5KCk7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhcm5pbmc6IGN1cnNvciBzdGF0ZSBtdXN0IGJlIG51bWJlciAke3ZhbHVlfWApO1xuICAgICAgICB9XG4gICAgICAgIHBvc2l0aW9uID0gKHBvc2l0aW9uICE9IHVuZGVmaW5lZCkgPyBwb3NpdGlvbiA6IHZhbHVlO1xuICAgICAgICB2ZWxvY2l0eSA9ICh2ZWxvY2l0eSAhPSB1bmRlZmluZWQpID8gdmVsb2NpdHk6IDA7XG4gICAgICAgIHJldHVybiBjbWQodGhpcy5zcmMuc3JjKS5tb3ZlKHtwb3NpdGlvbiwgdmVsb2NpdHksIHRpbWVzdGFtcH0pO1xuICAgIH1cbiAgICB0cmFuc2l0aW9uICh7dGFyZ2V0LCBkdXJhdGlvbiwgZWFzaW5nfSkge1xuICAgICAgICBsZXQge3ZhbHVlOnYwLCBvZmZzZXQ6dDB9ID0gdGhpcy5xdWVyeSgpO1xuICAgICAgICBpZiAodHlwZW9mIHYwICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3Igc3RhdGUgbXVzdCBiZSBudW1iZXIgJHt2MH1gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY21kKHRoaXMuc3JjLnNyYykudHJhbnNpdGlvbih2MCwgdGFyZ2V0LCB0MCwgdDAgKyBkdXJhdGlvbiwgZWFzaW5nKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUgKHt0dXBsZXMsIGR1cmF0aW9ufSkge1xuICAgICAgICBsZXQgdDAgPSB0aGlzLnF1ZXJ5KCkub2Zmc2V0O1xuICAgICAgICAvLyBhc3N1bWluZyB0aW1zdGFtcHMgYXJlIGluIHJhbmdlIFswLDFdXG4gICAgICAgIC8vIHNjYWxlIHRpbWVzdGFtcHMgdG8gZHVyYXRpb25cbiAgICAgICAgdHVwbGVzID0gdHVwbGVzLm1hcCgoW3YsdF0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbdiwgdDAgKyB0KmR1cmF0aW9uXTtcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzLnNyYy5zcmMpLmludGVycG9sYXRlKHR1cGxlcyk7XG4gICAgfVxuXG59XG5zb3VyY2Vwcm9wLmFkZFRvUHJvdG90eXBlKEN1cnNvci5wcm90b3R5cGUsIFwic3JjXCIsIHttdXRhYmxlOnRydWV9KTtcbnNvdXJjZXByb3AuYWRkVG9Qcm90b3R5cGUoQ3Vyc29yLnByb3RvdHlwZSwgXCJjdHJsXCIsIHttdXRhYmxlOnRydWV9KTtcblxuIl0sIm5hbWVzIjpbImludGVycG9sYXRlIiwic2VnbWVudC5TdGF0aWNTZWdtZW50Iiwic2VnbWVudC5UcmFuc2l0aW9uU2VnbWVudCIsInNlZ21lbnQuSW50ZXJwb2xhdGlvblNlZ21lbnQiLCJzZWdtZW50Lk1vdGlvblNlZ21lbnQiLCJzb3VyY2Vwcm9wLmFkZFRvSW5zdGFuY2UiLCJzb3VyY2Vwcm9wLmFkZFRvUHJvdG90eXBlIl0sIm1hcHBpbmdzIjoiOzs7OztDQUFBO0NBQ0E7Q0FDQTs7Q0FFQTs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7Ozs7Q0FJQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7O0NBRUE7O0NBRUEsTUFBTSxLQUFLLENBQUM7O0NBRVosQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRTtDQUN4QyxFQUFFLE9BQU8sR0FBRyxPQUFPLElBQUk7Q0FDdkIsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVM7Q0FDNUIsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUk7Q0FDbEIsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxTQUFTLElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQyxJQUFJO0NBQ2pFLEVBQUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxFQUFFO0NBQ3pCOztDQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFO0NBQy9CLEVBQUUsSUFBSSxDQUFDLFFBQVEsSUFBSSxPQUFPLFFBQVEsS0FBSyxVQUFVLEVBQUU7Q0FDbkQsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixFQUFFLFFBQVEsQ0FBQztDQUN2RDtDQUNBLEVBQUUsTUFBTSxHQUFHLEdBQUcsSUFBSSxZQUFZLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUM7Q0FDdkQsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7Q0FDOUI7Q0FDQSxLQUFLLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFO0NBQ2hDLE1BQU0sR0FBRyxDQUFDLFlBQVksR0FBRyxJQUFJO0NBQzdCLE1BQU0sSUFBSSxJQUFJLEdBQUcsSUFBSTtDQUNyQixNQUFNLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWTtDQUN6QyxPQUFPLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUU7Q0FDMUUsT0FBTyxHQUFHLENBQUMsWUFBWSxHQUFHLEtBQUs7Q0FDL0IsT0FBTyxLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRTtDQUMvQixRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDO0NBQ3ZDO0NBQ0EsT0FBTyxDQUFDO0NBQ1I7Q0FDQSxFQUFFLE9BQU87Q0FDVDs7Q0FFQTtDQUNBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUU7Q0FDNUIsRUFBRSxJQUFJLEtBQUssRUFBRSxHQUFHO0NBQ2hCLEVBQUUsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLEVBQUU7Q0FDMUI7Q0FDQSxHQUFHLElBQUksR0FBRyxDQUFDLFVBQVUsRUFBRTtDQUN2QixJQUFJO0NBQ0o7Q0FDQSxHQUFHLEtBQUssR0FBRztDQUNYLElBQUksR0FBRyxFQUFFLElBQUksQ0FBQyxTQUFTO0NBQ3ZCLElBQUksSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO0NBQ25CLElBQUksR0FBRyxFQUFFLEdBQUc7Q0FDWixJQUFJLElBQUksRUFBRTtDQUNWO0NBQ0EsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsU0FBUztDQUNsQyxHQUFHLElBQUk7Q0FDUCxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDO0NBQ3ZDLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRTtDQUNqQixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUNoRTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUU7Q0FDbEIsRUFBRSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7Q0FDM0MsRUFBRSxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRTtDQUNoQixHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7Q0FDcEMsR0FBRyxHQUFHLENBQUMsU0FBUyxFQUFFO0NBQ2xCO0NBQ0E7Q0FDQTs7O0NBR0E7Q0FDQTtDQUNBOztDQUVBLE1BQU0sWUFBWSxDQUFDOztDQUVuQixDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRTtDQUN2QyxFQUFFLE9BQU8sR0FBRyxPQUFPLElBQUk7Q0FDdkIsRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUs7Q0FDcEIsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJO0NBQ3hCLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRztDQUNsQixFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLFNBQVMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSTtDQUMzRSxFQUFFLElBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSztDQUMzQixFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSztDQUN6QixFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUc7Q0FDeEI7O0NBRUEsQ0FBQyxTQUFTLEdBQUc7Q0FDYixFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSTtDQUN4QixFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsU0FBUztDQUMzQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztDQUM5QjtDQUNBOzs7Q0FHQTs7Q0FFQTs7Q0FFQTs7Q0FFQTtDQUNBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7O0NBRUE7O0NBRU8sU0FBUyxnQkFBZ0IsRUFBRSxNQUFNLEVBQUU7Q0FDMUMsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxHQUFHLEVBQUU7Q0FDdkMsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLEdBQUcsRUFBRTtDQUM5QixDQUFDLE9BQU8sTUFBTTtDQUNkOztDQUdBO0NBQ0E7O0NBRUE7Q0FDQTs7Q0FFTyxTQUFTLGlCQUFpQixDQUFDLFVBQVUsRUFBRTs7Q0FFOUMsQ0FBQyxTQUFTLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUU7Q0FDekMsRUFBRSxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztDQUNwRCxFQUFFLElBQUksS0FBSyxJQUFJLFNBQVMsRUFBRTtDQUMxQixHQUFHLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDO0NBQzNDO0NBQ0EsRUFBRSxPQUFPLEtBQUs7Q0FDZDs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFNBQVMsY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUU7Q0FDeEM7Q0FDQSxFQUFFLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtDQUMxQyxHQUFHLE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXVCLEVBQUUsSUFBSSxDQUFDO0NBQ2pEO0NBQ0EsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0NBQ3BFO0NBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsU0FBUyxFQUFFLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7Q0FDdEMsRUFBRSxPQUFPLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQztDQUNsRTtDQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFNBQVMsR0FBRyxDQUFDLEdBQUcsRUFBRTtDQUNuQixFQUFFLE9BQU8sZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDO0NBQzFEOztDQUdBLENBQUMsU0FBUyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUU7Q0FDdEMsRUFBRSxPQUFPLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxhQUFhO0NBQ25EOzs7O0NBSUE7Q0FDQTs7Q0FFQTs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsU0FBUyxrQkFBa0IsQ0FBQyxVQUFVLEVBQUU7Q0FDekMsRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO0NBQzlCLEdBQUc7Q0FDSDs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxJQUFJLFlBQVksR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLO0NBQzlDLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxJQUFJO0NBQzFCLEdBQUcsSUFBSSxFQUFFLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQztDQUN4QyxHQUFHLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsWUFBWSxJQUFJLEtBQUssQ0FBQztDQUN2RSxHQUFHLE9BQU8sQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztDQUMxQixHQUFHLEVBQUUsSUFBSSxDQUFDOztDQUVWO0NBQ0EsRUFBRSxNQUFNLEdBQUcsR0FBRyxZQUFZLENBQUMsTUFBTTtDQUNqQyxFQUFFLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxpQkFBaUI7Q0FDcEMsRUFBRSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTTtDQUMvQztDQUNBLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sR0FBRyxPQUFPLEdBQUcsR0FBRztDQUMvQztDQUNBLEVBQUUsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRTtDQUM1QixHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQztDQUNuQztDQUNBO0NBQ0EsRUFBRSxJQUFJLE9BQU8sSUFBSSxDQUFDLEVBQUU7Q0FDcEIsR0FBRyxJQUFJLElBQUksR0FBRyxJQUFJO0NBQ2xCLEdBQUcsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXO0NBQ3JDLElBQUksS0FBSyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUU7Q0FDekQ7Q0FDQSxLQUFLLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUM7Q0FDbEM7Q0FDQSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxFQUFFO0NBQy9CLElBQUksQ0FBQztDQUNMO0NBQ0E7O0NBRUE7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxTQUFTLG9CQUFvQixDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7Q0FDNUMsRUFBRSxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSTtDQUNuRCxHQUFHLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDO0NBQ3RCLEdBQUcsQ0FBQyxDQUFDO0NBQ0w7O0NBRUE7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxTQUFTLGVBQWUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFO0NBQ3RDLEVBQUUsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0NBQ2hEOztDQUVBLENBQUMsVUFBVSxDQUFDLGNBQWMsR0FBRyxjQUFjO0NBQzNDLENBQUMsVUFBVSxDQUFDLGVBQWUsR0FBRyxlQUFlO0NBQzdDLENBQUMsVUFBVSxDQUFDLG9CQUFvQixHQUFHLG9CQUFvQjtDQUN2RCxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsR0FBRyxrQkFBa0I7Q0FDbkQsQ0FBQyxVQUFVLENBQUMscUJBQXFCLEdBQUcscUJBQXFCO0NBQ3pELENBQUMsVUFBVSxDQUFDLEVBQUUsR0FBRyxFQUFFO0NBQ25CLENBQUMsVUFBVSxDQUFDLEdBQUcsR0FBRyxHQUFHO0NBQ3JCOztDQUdPLE1BQU0sUUFBUSxHQUFHLFlBQVk7Q0FDcEMsQ0FBQyxPQUFPO0NBQ1IsRUFBRSxhQUFhLEVBQUUsZ0JBQWdCO0NBQ2pDLEVBQUUsY0FBYyxFQUFFO0NBQ2xCO0NBQ0EsQ0FBQyxFQUFFOztDQUVIO0NBQ0E7O0NBRUE7Q0FDQTs7Q0FFTyxNQUFNLGFBQWEsQ0FBQzs7Q0FFM0IsQ0FBQyxXQUFXLENBQUMsQ0FBQyxLQUFLLEVBQUU7Q0FDckIsRUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUM7Q0FDeEIsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUs7Q0FDckIsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUM1Qzs7Q0FFQSxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRTtDQUM3QixFQUFFLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtDQUN4QixHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO0NBQ3ZCO0NBQ0E7O0NBRUEsQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0NBQ2xDLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxLQUFLLEVBQUU7Q0FDbkIsRUFBRSxJQUFJLEtBQUssSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0NBQzVCLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLO0NBQ3RCLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDO0NBQ3hDO0NBQ0E7Q0FDQTtDQUNBLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUM7O0NDalUxQztDQUNPLFNBQVMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7Q0FDMUIsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0NBQzVCO0NBRU8sU0FBUyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRTtDQUNoQyxJQUFJLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLElBQUk7Q0FDL0IsSUFBSSxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQztDQUN4QixJQUFJLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0NBQ2pCOzs7Q0FHQTtDQUNBO0NBQ0E7O0NBRU8sU0FBUyxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxJQUFJLEdBQUcsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7Q0FDekQsSUFBSSxNQUFNLE1BQU0sR0FBRyxFQUFFO0NBQ3JCLElBQUksTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPO0NBQ3ZDLElBQUksSUFBSSxJQUFJLEtBQUssQ0FBQyxFQUFFO0NBQ3BCLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQztDQUMvQztDQUNBLElBQUksSUFBSSxLQUFLLEdBQUcsR0FBRyxFQUFFO0NBQ3JCLFFBQVEsS0FBSyxJQUFJLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFO0NBQ2hELFVBQVUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Q0FDeEI7Q0FDQSxLQUFLLE1BQU0sSUFBSSxLQUFLLEdBQUcsR0FBRyxFQUFFO0NBQzVCLFFBQVEsS0FBSyxJQUFJLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFO0NBQ2hELFVBQVUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Q0FDeEI7Q0FDQTtDQUNBLElBQUksSUFBSSxXQUFXLEVBQUU7Q0FDckIsUUFBUSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztDQUN4QjtDQUNBLElBQUksT0FBTyxNQUFNO0NBQ2pCOzs7O0NBSUE7Q0FDQTtDQUNBOztDQUVPLE1BQU0sUUFBUSxHQUFHLFlBQVk7O0NBRXBDLElBQUksU0FBUyxhQUFhLENBQUMsTUFBTSxFQUFFO0NBQ25DLFFBQVEsTUFBTSxDQUFDLG9CQUFvQixHQUFHLEVBQUU7Q0FDeEM7O0NBRUEsSUFBSSxTQUFTLFlBQVksRUFBRSxPQUFPLEVBQUU7Q0FDcEMsUUFBUSxJQUFJLE1BQU0sR0FBRztDQUNyQixZQUFZLE9BQU8sRUFBRTtDQUNyQjtDQUNBLFFBQVEsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7Q0FDOUMsUUFBUSxPQUFPLE1BQU07Q0FDckI7Q0FFQSxJQUFJLFNBQVMsZUFBZSxFQUFFLE1BQU0sRUFBRTtDQUN0QyxRQUFRLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO0NBQzdELFFBQVEsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUU7Q0FDeEIsWUFBWSxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7Q0FDdEQ7Q0FDQTtDQUVBLElBQUksU0FBUyxnQkFBZ0IsRUFBRSxJQUFJLEVBQUU7Q0FDckMsUUFBUSxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLFNBQVMsTUFBTSxFQUFFO0NBQzNELFlBQVksTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDaEMsU0FBUyxDQUFDO0NBQ1Y7O0NBR0EsSUFBSSxTQUFTLGNBQWMsRUFBRSxVQUFVLEVBQUU7Q0FDekMsUUFBUSxNQUFNLEdBQUcsR0FBRztDQUNwQixZQUFZLFlBQVksRUFBRSxlQUFlLEVBQUU7Q0FDM0M7Q0FDQSxRQUFRLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQztDQUN0Qzs7Q0FFQSxJQUFJLE9BQU8sQ0FBQyxhQUFhLEVBQUUsY0FBYztDQUN6QyxDQUFDLEVBQUU7O0NDakZIO0NBQ0E7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBOztDQUVBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBOztDQUVBO0NBQ0E7O0NBRUE7Q0FDQTs7Q0FFQTs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTs7Q0FFQTtDQUNBOztDQUVBOzs7Q0FHQSxNQUFNLE9BQU8sR0FBRzs7O0NBR2hCO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7O0NBRUEsTUFBTSxjQUFjLENBQUM7O0NBRXJCLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7O0NBRTVCLFFBQVEsSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLE9BQU8sQ0FBQztDQUMvRCxRQUFRLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsT0FBTyxFQUFFO0NBQzFDLFlBQVksTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztDQUMvRTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsUUFBUSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksR0FBRyxFQUFFO0NBQzdCO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsUUFBUSxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksR0FBRyxFQUFFO0NBQ3RDO0NBQ0EsUUFBUSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Q0FDbkU7O0NBRUEsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTtDQUNoRDtDQUNBLFFBQVEsSUFBSSxNQUFNLEdBQUcsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLEtBQUssQ0FBQztDQUNoRCxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztDQUM3QjtDQUNBLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFO0NBQy9DLFlBQVksSUFBSSxHQUFHLEdBQUcsUUFBUSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDO0NBQ3BFLFlBQVksSUFBSSxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUM5RCxZQUFZLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUM7Q0FDbEQ7Q0FDQSxTQUFTLE1BQU07Q0FDZixZQUFZLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO0NBQ2pFO0NBQ0EsUUFBUSxPQUFPLE1BQU07Q0FDckI7O0NBRUEsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFO0NBQ3BCO0NBQ0EsUUFBUSxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7Q0FDOUMsUUFBUSxJQUFJLENBQUMsT0FBTyxFQUFFO0NBQ3RCLFFBQVEsTUFBTSxDQUFDLEdBQUcsR0FBRyxTQUFTO0NBQzlCO0NBQ0EsUUFBUSxJQUFJLFFBQVEsR0FBRyxNQUFNLENBQUMsUUFBUTtDQUN0QyxRQUFRLElBQUksQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO0NBQzdELFFBQVEsSUFBSSxHQUFHLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7Q0FDekMsUUFBUSxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRTtDQUN0QixZQUFZLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztDQUNsQztDQUNBLFFBQVEsSUFBSSxPQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtDQUNqQztDQUNBO0NBQ0EsWUFBWSxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUM7Q0FDL0MsWUFBWSxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQztDQUM3QjtDQUNBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBLElBQUksaUJBQWlCLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO0NBQ3BDLFFBQVEsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDLEdBQUc7Q0FDaEM7Q0FDQSxRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7Q0FDeEQsUUFBUSxJQUFJLEtBQUssR0FBRyxJQUFJO0NBQ3hCO0NBQ0EsUUFBUSxJQUFJLENBQUMsbUJBQW1CLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQztDQUNqRDtDQUNBLFFBQVEsS0FBSyxJQUFJLE1BQU0sSUFBSSxPQUFPLEVBQUU7Q0FDcEMsWUFBWSxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQztDQUNsQztDQUNBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBLElBQUksbUJBQW1CLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRTtDQUN6QyxRQUFRLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztDQUNuRCxRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLEdBQUcsSUFBSTtDQUN4QyxRQUFRLEtBQUssR0FBRyxLQUFLLElBQUksUUFBUSxDQUFDLEtBQUssRUFBRTtDQUN6QyxRQUFRLElBQUksaUJBQWlCLEdBQUcsS0FBSyxDQUFDLE9BQU87Q0FDN0MsUUFBUSxJQUFJLENBQUMsV0FBVyxJQUFJLGlCQUFpQixFQUFFO0NBQy9DLFlBQVksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJO0NBQy9CLFlBQVksSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUM7Q0FDeEMsU0FBUyxNQUFNLElBQUksV0FBVyxJQUFJLENBQUMsaUJBQWlCLEVBQUU7Q0FDdEQsWUFBWSxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUs7Q0FDaEMsWUFBWSxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQztDQUMxQztDQUNBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBLElBQUksYUFBYSxDQUFDLFFBQVEsRUFBRTtDQUM1QixRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7Q0FDeEQsUUFBUSxLQUFLLElBQUksTUFBTSxJQUFJLE9BQU8sRUFBRTtDQUNwQyxZQUFZLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDO0NBQ3JDO0NBQ0E7O0NBRUEsSUFBSSxZQUFZLENBQUMsTUFBTSxFQUFFO0NBQ3pCLFFBQVEsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7Q0FDdkQsUUFBUSxJQUFJLE9BQU8sR0FBRyxZQUFZO0NBQ2xDLFlBQVksSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUM7Q0FDeEMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Q0FDcEIsUUFBUSxNQUFNLENBQUMsR0FBRyxHQUFHLFVBQVUsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDO0NBQy9DOztDQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsSUFBSSxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUU7Q0FDNUIsUUFBUSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUk7Q0FDckMsUUFBUSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztDQUMvQyxRQUFRLElBQUksQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7Q0FDOUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFHLEdBQUcsS0FBSyxFQUFFLElBQUksQ0FBQztDQUM5QyxRQUFRLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJO0NBQ2hELFFBQVEsT0FBTyxNQUFNLEdBQUcsV0FBVyxDQUFDLEdBQUcsRUFBRTtDQUN6Qzs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQSxJQUFJLGVBQWUsQ0FBQyxRQUFRLEVBQUU7Q0FDOUIsUUFBUSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO0NBQ3hELFFBQVEsS0FBSyxJQUFJLE1BQU0sSUFBSSxPQUFPLEVBQUU7Q0FDcEMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxHQUFHLElBQUksU0FBUyxFQUFFO0NBQ3pDLGdCQUFnQixZQUFZLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQztDQUN4QyxnQkFBZ0IsTUFBTSxDQUFDLEdBQUcsR0FBRyxTQUFTO0NBQ3RDO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQSxJQUFJLGVBQWUsQ0FBQyxNQUFNLEVBQUU7Q0FDNUI7Q0FDQSxRQUFRLElBQUksTUFBTSxDQUFDLEdBQUcsSUFBSSxTQUFTLEVBQUU7Q0FDckMsUUFBUSxNQUFNLENBQUMsR0FBRyxHQUFHLFNBQVM7Q0FDOUI7Q0FDQSxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxNQUFNO0NBQy9CLFFBQVEsSUFBSSxLQUFLLEdBQUcsUUFBUSxDQUFDLEtBQUssRUFBRTtDQUNwQztDQUNBLFFBQVEsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFO0NBQzNCLFlBQVksSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7Q0FDckMsU0FBUyxNQUFNO0NBQ2Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLFlBQVksSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO0NBQ3ZELFlBQVksSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLO0NBQ2hDO0NBQ0E7Q0FDQSxRQUFRLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO0NBQzlCO0NBQ0E7Ozs7Q0FJQTtDQUNBO0NBQ0E7OztDQUdBLE1BQU0sZ0JBQWdCLFNBQVMsY0FBYyxDQUFDOztDQUU5QyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO0NBQzVCLFFBQVEsS0FBSyxDQUFDLE9BQU8sQ0FBQztDQUN0QixRQUFRLElBQUksQ0FBQyxPQUFPO0NBQ3BCOztDQUVBO0NBQ0E7Q0FDQTtDQUNBLElBQUksYUFBYSxDQUFDLFFBQVEsRUFBRTtDQUM1QixJQUFJLFlBQVksQ0FBQyxNQUFNLEVBQUU7Q0FDekIsSUFBSSxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUU7Q0FDNUIsSUFBSSxlQUFlLENBQUMsUUFBUSxFQUFFO0NBQzlCLElBQUksZUFBZSxDQUFDLE1BQU0sRUFBRTs7Q0FFNUIsSUFBSSxpQkFBaUIsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7Q0FDcEMsUUFBUSxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQztDQUM1QztDQUNBLFFBQVEsSUFBSSxDQUFDLFNBQVMsRUFBRTtDQUN4Qjs7Q0FFQSxJQUFJLFNBQVMsR0FBRztDQUNoQjtDQUNBLFFBQVEsSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFO0NBQ3hELGFBQWEsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLE9BQU87Q0FDdEQsYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsS0FBSyxRQUFRLENBQUM7Q0FDaEQsUUFBUSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0NBQ2xDO0NBQ0EsWUFBWSxLQUFLLElBQUksUUFBUSxJQUFJLFNBQVMsRUFBRTtDQUM1QyxnQkFBZ0IsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztDQUNoRSxnQkFBZ0IsSUFBSSxHQUFHLEdBQUcsUUFBUSxDQUFDLEtBQUssRUFBRTtDQUMxQyxnQkFBZ0IsS0FBSyxJQUFJLE1BQU0sSUFBSSxPQUFPLEVBQUU7Q0FDNUMsb0JBQW9CLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDO0NBQ3hDO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLFlBQVksSUFBSSxDQUFDLE9BQU8sR0FBRyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUMzRTtDQUNBO0NBQ0E7OztDQUdBO0NBQ0E7Q0FDQTs7Q0FFQSxNQUFNLE9BQU8sR0FBRyxJQUFJLGNBQWMsRUFBRTtDQUNwQyxNQUFNLGlCQUFpQixHQUFHLElBQUksZ0JBQWdCLEVBQUU7O0NBRXpDLFNBQVMsSUFBSSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7Q0FDNUQsSUFBSSxJQUFJLE1BQU07Q0FDZCxJQUFJLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO0NBQ3BDLFFBQVEsTUFBTSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDO0NBQ2pFLFFBQVEsT0FBTyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUM7Q0FDbEMsS0FBSyxNQUFNO0NBQ1gsUUFBUSxNQUFNLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLE9BQU8sQ0FBQztDQUN2RSxRQUFRLE9BQU8sQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDO0NBQ3BDO0NBQ0E7Q0FDTyxTQUFTLE9BQU8sQ0FBQyxNQUFNLEVBQUU7Q0FDaEMsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxHQUFHLE1BQU07Q0FDaEMsSUFBSSxJQUFJLElBQUksSUFBSSxTQUFTLEVBQUU7Q0FDM0IsUUFBUSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO0NBQ3ZDLEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxXQUFXLEVBQUU7Q0FDcEMsUUFBUSxPQUFPLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7Q0FDakQ7Q0FDQTs7Q0MvVEE7Q0FDQTtDQUNBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTs7O0NBR0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBOzs7Q0FHQSxTQUFTLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO0NBQzFCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLE9BQU8sQ0FBQztDQUN6QixJQUFJLElBQUksQ0FBQyxLQUFLLFFBQVEsRUFBRSxPQUFPLENBQUM7Q0FDaEMsSUFBSSxJQUFJLENBQUMsS0FBSyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7Q0FDakMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztDQUNsQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQztDQUNqQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUM7Q0FDaEI7O0NBRUEsU0FBUyxZQUFZLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtDQUMvQixJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsRUFBRTtDQUNyQixJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsRUFBRTtDQUNyQixJQUFJLElBQUksSUFBSSxHQUFHLFVBQVUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDO0NBQ2pDLElBQUksT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxHQUFHLEVBQUUsR0FBRyxFQUFFO0NBQ3ZDOztDQUVBLFNBQVMsV0FBVyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7Q0FDOUIsSUFBSSxPQUFPLFlBQVksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUc7Q0FDbEM7Q0FDQSxTQUFTLFdBQVcsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0NBQzlCLElBQUksT0FBTyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJO0NBQ25DO0NBQ0EsU0FBUyxXQUFXLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtDQUM5QixJQUFJLE9BQU8sWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRztDQUNsQztDQUNBLFNBQVMsV0FBVyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7Q0FDOUIsSUFBSSxPQUFPLFlBQVksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUk7Q0FDbkM7Q0FDQSxTQUFTLFdBQVcsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0NBQzlCLElBQUksT0FBTyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJO0NBQ25DO0NBQ0EsU0FBUyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRTtDQUM5QixJQUFJLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO0NBQzFDO0NBQ0EsU0FBUyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRTtDQUM5QixJQUFJLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFO0NBQzFDOztDQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7O0NBRUEsU0FBUyxhQUFhLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRTtDQUNsQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztDQUNqQixJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUU7Q0FDdEIsUUFBUSxPQUFPLENBQUM7Q0FDaEI7Q0FDQSxJQUFJLElBQUksTUFBTSxJQUFJLEtBQUssRUFBRTtDQUN6QjtDQUNBLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFO0NBQ2hCLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0NBQzlDO0NBQ0EsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNwQixLQUFLLE1BQU0sSUFBSSxNQUFNLElBQUksTUFBTSxFQUFFO0NBQ2pDO0NBQ0EsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7Q0FDaEIsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLDBCQUEwQixDQUFDLENBQUM7Q0FDL0M7Q0FDQSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3BCLEtBQUssTUFBTTtDQUNYLEtBQUssTUFBTSxJQUFJLEtBQUssQ0FBQyxjQUFjLEVBQUUsTUFBTSxDQUFDO0NBQzVDO0NBQ0EsSUFBSSxPQUFPLENBQUM7Q0FDWjs7O0NBR0E7Q0FDQTtDQUNBO0NBQ0EsU0FBUyx1QkFBdUIsQ0FBQyxHQUFHLEVBQUU7Q0FDdEMsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLEdBQUcsR0FBRztDQUNoRCxJQUFJLElBQUksS0FBSyxHQUFHLENBQUMsU0FBUyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO0NBQ2xELElBQUksSUFBSSxNQUFNLEdBQUcsQ0FBQyxVQUFVLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7Q0FDdEQsSUFBSSxPQUFPLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztDQUMxQjs7O0NBR0E7Q0FDQTs7Q0FFQTs7Q0FFQTs7Q0FFQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTtDQUNBO0NBQ0EsU0FBUyx3QkFBd0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFO0NBQzFDLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsR0FBRyx1QkFBdUIsQ0FBQyxHQUFHLENBQUM7Q0FDdEQ7Q0FDQSxJQUFJLE9BQU8sV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxXQUFXLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQztDQUMxRDtDQUNBO0NBQ0EsU0FBUyxxQkFBcUIsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFO0NBQ3ZDLElBQUksT0FBTyx3QkFBd0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Q0FDaEQ7Ozs7Q0FJQTtDQUNBO0NBQ0E7Q0FDQSxTQUFTLG9CQUFvQixDQUFDLFFBQVEsRUFBRTtDQUN4QyxJQUFJLE9BQU8sUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDO0NBQ3BDOztDQUVBO0NBQ0E7Q0FDQTtDQUNBLFNBQVMsdUJBQXVCLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRTtDQUN6QyxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsRUFBRTtDQUNyQixJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsRUFBRTtDQUNyQjtDQUNBLElBQUksSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7Q0FDbEIsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLG1CQUFtQixFQUFFLEVBQUUsQ0FBQztDQUNoRDtDQUNBLElBQUksSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFO0NBQ2pCLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsRUFBRSxFQUFFLENBQUMsQ0FBQztDQUNuRDtDQUNBLElBQUksT0FBTyxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztDQUNuQzs7Q0FFQSxTQUFTLFFBQVEsQ0FBQyxDQUFDLEVBQUU7Q0FDckIsSUFBSSxPQUFPLE9BQU8sQ0FBQyxJQUFJLFFBQVE7Q0FDL0I7O0NBRU8sU0FBUyxtQkFBbUIsQ0FBQyxLQUFLLENBQUM7Q0FDMUMsSUFBSSxJQUFJLEdBQUcsR0FBRyxLQUFLO0NBQ25CLElBQUksSUFBSSxHQUFHLElBQUksU0FBUyxFQUFFO0NBQzFCLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQztDQUM3QztDQUNBLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7Q0FDN0IsUUFBUSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtDQUMzQjtDQUNBLFlBQVksR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0NBQ3hDLFNBQVMsTUFBTTtDQUNmLFlBQVksTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMseUJBQXlCLENBQUM7Q0FDdEU7Q0FDQSxLQUNBO0NBQ0EsSUFBSSxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO0NBQ3pCLFFBQVEsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSTtDQUN6QyxLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtDQUNoQyxRQUFRLEdBQUcsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0NBQ3ZDLEtBQUssTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO0NBQ2hDLFFBQVEsR0FBRyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO0NBQzdCLEtBQUssTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0NBQy9CLFFBQVEsR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUM1QjtDQUNBLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFdBQVcsQ0FBQyxHQUFHLEdBQUc7Q0FDbEQ7Q0FDQSxJQUFJLElBQUksR0FBRyxJQUFJLFNBQVMsSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFO0NBQ3pDLFFBQVEsR0FBRyxHQUFHLENBQUMsUUFBUTtDQUN2QjtDQUNBLElBQUksSUFBSSxJQUFJLElBQUksU0FBUyxJQUFJLElBQUksSUFBSSxJQUFJLEVBQUU7Q0FDM0MsUUFBUSxJQUFJLEdBQUcsUUFBUTtDQUN2QjtDQUNBO0NBQ0EsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLEVBQUUsR0FBRyxDQUFDO0NBQ2hFLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQztDQUNuRTtDQUNBLElBQUksSUFBSSxHQUFHLEdBQUcsSUFBSSxFQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsWUFBWSxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUM7Q0FDNUQ7Q0FDQSxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksRUFBRTtDQUNyQixRQUFRLFVBQVUsR0FBRyxJQUFJO0NBQ3pCLFFBQVEsV0FBVyxHQUFHLElBQUk7Q0FDMUI7Q0FDQTtDQUNBLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUU7Q0FDMUIsUUFBUSxVQUFVLEdBQUcsSUFBSTtDQUN6QjtDQUNBLElBQUksSUFBSSxJQUFJLElBQUksUUFBUSxFQUFFO0NBQzFCLFFBQVEsV0FBVyxHQUFHLElBQUk7Q0FDMUI7Q0FDQTtDQUNBLElBQUksSUFBSSxPQUFPLFVBQVUsS0FBSyxTQUFTLEVBQUU7Q0FDekMsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixDQUFDO0NBQ2pELEtBQUs7Q0FDTCxJQUFJLElBQUksT0FBTyxXQUFXLEtBQUssU0FBUyxFQUFFO0NBQzFDLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQztDQUNsRDtDQUNBLElBQUksT0FBTyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFdBQVcsQ0FBQztDQUMvQzs7Ozs7Q0FLTyxNQUFNLFFBQVEsR0FBRztDQUN4QixJQUFJLEVBQUUsRUFBRSxXQUFXO0NBQ25CLElBQUksRUFBRSxFQUFFLFdBQVc7Q0FDbkIsSUFBSSxFQUFFLEVBQUUsV0FBVztDQUNuQixJQUFJLEVBQUUsRUFBRSxXQUFXO0NBQ25CLElBQUksR0FBRyxFQUFFLFlBQVk7Q0FDckIsSUFBSSxFQUFFLEVBQUUsV0FBVztDQUNuQixJQUFJLEdBQUcsRUFBRSxZQUFZO0NBQ3JCLElBQUksR0FBRyxFQUFFLFlBQVk7Q0FDckIsSUFBSSxJQUFJLEVBQUUsYUFBYTtDQUN2QixJQUFJLGFBQWEsRUFBRTtDQUNuQjtDQUNPLE1BQU0sUUFBUSxHQUFHO0NBQ3hCLElBQUksZUFBZSxFQUFFLHdCQUF3QjtDQUM3QyxJQUFJLFlBQVksRUFBRSxxQkFBcUI7Q0FDdkMsSUFBSSxXQUFXLEVBQUUsb0JBQW9CO0NBQ3JDLElBQUksY0FBYyxFQUFFLHVCQUF1QjtDQUMzQyxJQUFJLFVBQVUsRUFBRTtDQUNoQjs7Q0MvT0E7Q0FDQTtDQUNBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBOztDQUVPLE1BQU0saUJBQWlCLENBQUM7O0NBRS9CLElBQUksV0FBVyxHQUFHO0NBQ2xCLFFBQVEsUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUM7Q0FDcEM7Q0FDQSxJQUFJLEdBQUcsR0FBRztDQUNWLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQztDQUMxQztDQUNBO0NBQ0EsUUFBUSxDQUFDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUM7Ozs7Q0FJcEQ7Q0FDQTtDQUNBOztDQUVBO0NBQ0E7O0NBRUE7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7O0NBRU8sTUFBTSxpQkFBaUIsQ0FBQzs7Q0FFL0IsSUFBSSxXQUFXLEdBQUc7Q0FDbEIsUUFBUSxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQztDQUNwQzs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQztDQUNqQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUM7Q0FDMUM7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7O0NBRUEsSUFBSSxJQUFJLEtBQUssR0FBRztDQUNoQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUM7Q0FDMUM7O0NBRUE7Q0FDQTtDQUNBOztDQUVBLElBQUksSUFBSSxJQUFJLENBQUMsR0FBRztDQUNoQixRQUFRLE9BQU8sQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDO0NBQ2xDO0NBQ0E7Q0FDQSxRQUFRLENBQUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQzs7O0NBR3BEO0NBQ0E7Q0FDQTs7Q0FFTyxNQUFNLFNBQVMsQ0FBQzs7Q0FFdkIsSUFBSSxXQUFXLEdBQUc7Q0FDbEIsUUFBUSxJQUFJLENBQUMsTUFBTTs7Q0FFbkIsUUFBUSxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQztDQUNwQztDQUNBLFFBQVEsUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUM7Q0FDcEMsUUFBUSxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztDQUNsRDs7Q0FFQTtDQUNBO0NBQ0E7O0NBRUEsSUFBSSxjQUFjLENBQUMsR0FBRztDQUN0QixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztDQUMzQzs7Q0FFQSxJQUFJLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7Q0FDckM7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7Q0FDdkIsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU87Q0FDOUQsUUFBUSxJQUFJLEtBQUssR0FBRyxJQUFJLEVBQUU7Q0FDMUIsWUFBWSxNQUFNLElBQUksS0FBSyxFQUFFLGdDQUFnQyxFQUFFLEtBQUssRUFBRSxJQUFJO0NBQzFFO0NBQ0EsUUFBUSxLQUFLLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0NBQzFCLFFBQVEsSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQzs7Q0FFeEIsUUFBUSxLQUFLLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEtBQUssQ0FBQztDQUN2RCxRQUFRLElBQUksR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDO0NBQ3BELFFBQVEsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRTtDQUMzQyxRQUFRLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztDQUNoRSxhQUFhLEdBQUcsQ0FBQyxDQUFDLE1BQU0sS0FBSztDQUM3QixnQkFBZ0IsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztDQUMxRCxhQUFhLENBQUM7Q0FDZDtDQUNBO0NBQ0EsUUFBUSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDO0NBQzVDLFFBQVEsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQzs7O0NBRzVDO0NBQ0E7Q0FDQTs7Q0FFTyxNQUFNLFVBQVUsQ0FBQzs7Q0FFeEIsSUFBSSxXQUFXLENBQUMsR0FBRztDQUNuQixRQUFRLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDO0NBQ3BDO0NBQ0EsUUFBUSxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQztDQUNwQyxRQUFRLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ2xEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7O0NBRUEsSUFBSSxLQUFLLENBQUMsR0FBRztDQUNiLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQztDQUMxQzs7Q0FFQSxJQUFJLElBQUksS0FBSyxHQUFHO0NBQ2hCLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQztDQUMxQzs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQSxJQUFJLHFCQUFxQixDQUFDLElBQUksRUFBRTtDQUNoQyxRQUFRLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtDQUM5QixZQUFZLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Q0FDakM7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7O0NBRUEsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsRUFBRSxFQUFFO0NBQ3RDLFFBQVEsT0FBTyxJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDO0NBQ25EO0NBQ0EsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFO0NBQ3BCLFFBQVEsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDO0NBQzlCOztDQUVBO0NBQ0EsUUFBUSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDO0NBQzdDLFFBQVEsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQzs7Q0N0TDdDO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBLFNBQVMsU0FBUyxFQUFFLFFBQVEsRUFBRTtDQUM5QixJQUFJLE9BQU87Q0FDWCxRQUFRLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQztDQUM3QixRQUFRLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDO0NBQ2xDLFFBQVEsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUM7Q0FDdEMsUUFBUSxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQztDQUM3QyxRQUFRLE9BQU8sRUFBRSxDQUFDLEVBQUUsRUFBRSxRQUFRLENBQUMsUUFBUSxDQUFDO0NBQ3hDLFFBQVEsT0FBTyxFQUFFLENBQUMsRUFBRSxFQUFFLFFBQVEsQ0FBQyxRQUFRLENBQUM7Q0FDeEMsUUFBUSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLE1BQU07Q0FDbkM7Q0FDQTs7Q0FFTyxTQUFTLGFBQWEsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0NBQ2pELElBQUksTUFBTSxDQUFDLEdBQUcsU0FBUyxDQUFDLFFBQVE7Q0FDaEMsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHO0NBQ3JCLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLO0NBQzFCLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxTQUFTO0NBQ2hDOztDQUVPLFNBQVMsY0FBYyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLEVBQUUsRUFBRTs7Q0FFbEUsSUFBSSxNQUFNLENBQUMsR0FBRyxTQUFTLENBQUMsUUFBUTs7Q0FFaEMsSUFBSSxTQUFTLE9BQU8sR0FBRztDQUN2QjtDQUNBLFFBQVEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPO0NBQ3JDLFFBQVEsSUFBSSxPQUFPLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRTtDQUNyQyxZQUFZLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO0NBQ3ZDLFlBQVksSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDO0NBQ2hELFlBQVksSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxTQUFTO0NBQ3RDO0NBQ0EsUUFBUSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVM7Q0FDaEM7O0NBRUEsSUFBSSxTQUFTLE9BQU8sQ0FBQyxNQUFNLEVBQUU7Q0FDN0IsUUFBUSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU87Q0FDckMsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxPQUFPLEVBQUU7Q0FDdEMsWUFBWSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU07Q0FDakMsWUFBWSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUk7Q0FDL0I7Q0FDQSxZQUFZLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRTtDQUNoQyxnQkFBZ0IsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0NBQ3pELGdCQUFnQixJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDO0NBQzdELGdCQUFnQixPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7Q0FDakM7Q0FDQSxTQUFTLE1BQU07Q0FDZixZQUFZLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0NBQ2hFO0NBQ0E7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBLElBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQUUsUUFBUSxFQUFFO0NBQ2hELFFBQVEsR0FBRyxFQUFFLFlBQVk7Q0FDekIsWUFBWSxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0NBQy9CLFNBQVM7Q0FDVCxRQUFRLEdBQUcsRUFBRSxVQUFVLEdBQUcsRUFBRTtDQUM1QixZQUFZLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRTtDQUMvQixnQkFBZ0IsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHO0NBQ2pDO0NBQ0EsWUFBWSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFO0NBQ3JDLGdCQUFnQixJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFO0NBQ2pDLGdCQUFnQixJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQztDQUNwQztDQUNBOztDQUVBLEtBQUssQ0FBQzs7Q0FFTixJQUFJLE1BQU0sR0FBRyxHQUFHLEVBQUU7Q0FDbEIsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLE9BQU87Q0FDNUIsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLE9BQU87O0NBRTVCLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDO0NBQ2xDOztDQzdGQSxNQUFNLE9BQU8sR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsVUFBVSxlQUFFQSxhQUFXLENBQUM7OztDQUdoRCxTQUFTLEdBQUcsRUFBRSxNQUFNLEVBQUU7Q0FDN0IsSUFBSSxJQUFJLEVBQUUsTUFBTSxZQUFZLGlCQUFpQixDQUFDLEVBQUU7Q0FDaEQsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLENBQUMsaUNBQWlDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztDQUNyRTtDQUNBLElBQUksSUFBSSxPQUFPLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPO0NBQ3hDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEtBQUs7Q0FDakMsWUFBWSxPQUFPO0NBQ25CLGdCQUFnQixJQUFJO0NBQ3BCLGdCQUFnQixTQUFTLEdBQUcsSUFBSSxFQUFFO0NBQ2xDLG9CQUFvQixJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQztDQUMxRCxvQkFBb0IsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0NBQ2hEO0NBQ0E7Q0FDQSxTQUFTLENBQUM7Q0FDVixJQUFJLE9BQU8sTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUM7Q0FDdEM7O0NBRUEsU0FBUyxNQUFNLENBQUMsS0FBSyxFQUFFO0NBQ3ZCLElBQUksSUFBSSxLQUFLLElBQUksU0FBUyxFQUFFO0NBQzVCLFFBQVEsT0FBTyxFQUFFO0NBQ2pCLEtBQUssTUFBTTtDQUNYLFFBQVEsSUFBSSxJQUFJLEdBQUc7Q0FDbkIsWUFBWSxHQUFHLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztDQUNsRCxZQUFZLElBQUksRUFBRSxRQUFRO0NBQzFCLFlBQVksSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDO0NBQ3pCO0NBQ0EsUUFBUSxPQUFPLENBQUMsSUFBSSxDQUFDO0NBQ3JCO0NBQ0E7O0NBRUEsU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFO0NBQ3RCLElBQUksSUFBSSxJQUFJLEdBQUc7Q0FDZixRQUFRLEdBQUcsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0NBQzlDLFFBQVEsSUFBSSxFQUFFLFFBQVE7Q0FDdEIsUUFBUSxJQUFJLEVBQUUsTUFBTTtDQUNwQjtDQUNBLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQztDQUNqQjs7Q0FFQSxTQUFTLFVBQVUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFO0NBQzVDLElBQUksSUFBSSxLQUFLLEdBQUc7Q0FDaEIsUUFBUTtDQUNSLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUM7Q0FDN0MsWUFBWSxJQUFJLEVBQUUsUUFBUTtDQUMxQixZQUFZLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxFQUFFO0NBQzNCLFNBQVM7Q0FDVCxRQUFRO0NBQ1IsWUFBWSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUM7Q0FDdEMsWUFBWSxJQUFJLEVBQUUsWUFBWTtDQUM5QixZQUFZLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxNQUFNO0NBQ3pDLFNBQVM7Q0FDVCxRQUFRO0NBQ1IsWUFBWSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7Q0FDM0MsWUFBWSxJQUFJLEVBQUUsUUFBUTtDQUMxQixZQUFZLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO0NBQzVCO0NBQ0E7Q0FDQSxJQUFJLE9BQU8sS0FBSztDQUNoQjs7Q0FFQSxTQUFTQSxhQUFXLENBQUMsTUFBTSxFQUFFO0NBQzdCLElBQUksSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO0NBQzVCLElBQUksSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7O0NBRTFDLElBQUksSUFBSSxLQUFLLEdBQUc7Q0FDaEIsUUFBUTtDQUNSLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUM7Q0FDN0MsWUFBWSxJQUFJLEVBQUUsUUFBUTtDQUMxQixZQUFZLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxFQUFFO0NBQzNCLFNBQVM7Q0FDVCxRQUFRO0NBQ1IsWUFBWSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUM7Q0FDdEMsWUFBWSxJQUFJLEVBQUUsZUFBZTtDQUNqQyxZQUFZLElBQUksRUFBRSxDQUFDLE1BQU07Q0FDekIsU0FBUztDQUNULFFBQVE7Q0FDUixZQUFZLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztDQUMzQyxZQUFZLElBQUksRUFBRSxRQUFRO0NBQzFCLFlBQVksSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUU7Q0FDNUI7Q0FDQSxNQUFLO0NBQ0wsSUFBSSxPQUFPLEtBQUs7Q0FDaEI7O0NDcEZBO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7O0NBRU8sTUFBTSxtQkFBbUIsU0FBUyxpQkFBaUIsQ0FBQzs7Q0FFM0QsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRTtDQUM1QixRQUFRLEtBQUssRUFBRTtDQUNmO0NBQ0EsUUFBUSxJQUFJLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxHQUFHLE9BQU87Q0FDcEMsUUFBUSxJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUU7Q0FDaEMsWUFBWSxJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUM7Q0FDNUMsU0FBUyxNQUFNLElBQUksS0FBSyxJQUFJLFNBQVMsRUFBRTtDQUN2QyxZQUFZLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztDQUNqRixTQUFTLE1BQU07Q0FDZixZQUFZLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRTtDQUM1QjtDQUNBOztDQUVBLElBQUksTUFBTSxDQUFDLENBQUMsS0FBSyxFQUFFO0NBQ25CLFFBQVEsT0FBTyxPQUFPLENBQUMsT0FBTztDQUM5QixhQUFhLElBQUksQ0FBQyxNQUFNO0NBQ3hCLGdCQUFnQixJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUM7Q0FDaEQsZ0JBQWdCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtDQUN2QyxhQUFhLENBQUM7Q0FDZDs7Q0FFQSxJQUFJLElBQUksS0FBSyxDQUFDLEdBQUc7Q0FDakIsUUFBUSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFO0NBQ2xDOztDQUVBLElBQUksSUFBSSxJQUFJLENBQUMsR0FBRztDQUNoQixRQUFRLE9BQU8sQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQztDQUM5RDtDQUNBOzs7Q0FHQSxTQUFTLFdBQVcsQ0FBQyxLQUFLLEVBQUU7Q0FDNUIsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtDQUMvQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUM7Q0FDakQ7Q0FDQTtDQUNBLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUs7Q0FDekIsUUFBUSxJQUFJLEtBQUssR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDcEQsUUFBUSxJQUFJLEtBQUssR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDcEQsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQztDQUN6QyxLQUFLLENBQUM7Q0FDTjtDQUNBLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Q0FDM0MsUUFBUSxJQUFJLFNBQVMsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ25FLFFBQVEsSUFBSSxRQUFRLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzlEO0NBQ0EsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLEVBQUU7Q0FDL0MsWUFBWSxNQUFNLElBQUksS0FBSyxDQUFDLDZCQUE2QixDQUFDO0NBQzFEO0NBQ0E7Q0FDQSxJQUFJLE9BQU8sS0FBSztDQUNoQjs7Q0M3REE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQTs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBOztDQUVPLE1BQU0sV0FBVyxDQUFDOztDQUV6QixDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUU7Q0FDbEIsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLEdBQUc7Q0FDakI7O0NBRUEsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQzs7Q0FFN0I7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7Q0FDbEIsS0FBSyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDO0NBQ3ZDOztDQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7Q0FDbEIsUUFBUSxJQUFJLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRTtDQUN0RCxZQUFZLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDO0NBQ2xELFNBQVM7Q0FDVCxRQUFRLE9BQU8sQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDO0NBQ3hEO0NBQ0E7OztDQTBCQTtDQUNBO0NBQ0E7O0NBRU8sTUFBTSxhQUFhLFNBQVMsV0FBVyxDQUFDOztDQUUvQyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFO0NBQ3hCLFFBQVEsS0FBSyxDQUFDLEdBQUcsQ0FBQztDQUNsQixFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUs7Q0FDMUI7O0NBRUEsQ0FBQyxLQUFLLEdBQUc7Q0FDVCxRQUFRLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsS0FBSztDQUNqRDtDQUNBOzs7Q0FHQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFTyxNQUFNLGFBQWEsU0FBUyxXQUFXLENBQUM7Q0FDL0M7Q0FDQSxJQUFJLFdBQVcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFO0NBQzNCLFFBQVEsS0FBSyxDQUFDLEdBQUcsQ0FBQztDQUNsQixRQUFRLE1BQU07Q0FDZCxZQUFZLFFBQVEsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUM7Q0FDaEQsU0FBUyxHQUFHLElBQUk7Q0FDaEI7Q0FDQSxRQUFRLE1BQU0sRUFBRSxHQUFHLENBQUM7Q0FDcEIsUUFBUSxJQUFJLENBQUMsU0FBUyxHQUFHLEVBQUU7Q0FDM0IsUUFBUSxJQUFJLENBQUMsU0FBUyxHQUFHLFVBQVUsRUFBRSxFQUFFO0NBQ3ZDLFlBQVksSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUU7Q0FDM0IsWUFBWSxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDekMsU0FBUyxDQUFDO0NBQ1Y7O0NBRUEsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO0NBQ2xCLFFBQVEsT0FBTztDQUNmLFlBQVksS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0NBQ3pDLFlBQVksSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTO0NBQ2hDLFlBQVksT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLElBQUk7Q0FDdkM7Q0FDQTtDQUNBOzs7Q0FHQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBLFNBQVMsTUFBTSxFQUFFLEVBQUUsRUFBRTtDQUNyQixJQUFJLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDMUI7Q0FDQSxTQUFTLE9BQU8sRUFBRSxFQUFFLEVBQUU7Q0FDdEIsSUFBSSxPQUFPLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztDQUM3QjtDQUNBLFNBQVMsU0FBUyxFQUFFLEVBQUUsRUFBRTtDQUN4QixJQUFJLElBQUksRUFBRSxHQUFHLEVBQUUsRUFBRTtDQUNqQixRQUFRLE9BQU8sTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDO0NBQ2pDLEtBQUssTUFBTTtDQUNYLFFBQVEsT0FBTyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUM7Q0FDN0M7Q0FDQTs7Q0FFTyxNQUFNLGlCQUFpQixTQUFTLFdBQVcsQ0FBQzs7Q0FFbkQsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRTtDQUN4QixFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUM7Q0FDWixRQUFRLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLE1BQU0sQ0FBQyxHQUFHLElBQUk7Q0FDbkMsUUFBUSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O0NBRTNDO0NBQ0EsUUFBUSxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQztDQUNsQyxRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsVUFBVSxFQUFFLEVBQUU7Q0FDcEM7Q0FDQTtDQUNBO0NBQ0EsWUFBWSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUU7Q0FDeEIsWUFBWSxFQUFFLEdBQUcsRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO0NBQ3JDO0NBQ0EsWUFBWSxJQUFJLE1BQU0sSUFBSSxTQUFTLEVBQUU7Q0FDckMsZ0JBQWdCLEVBQUUsR0FBRyxNQUFNLENBQUMsRUFBRSxDQUFDO0NBQy9CLGFBQWEsTUFBTSxJQUFJLE1BQU0sSUFBSSxVQUFVLEVBQUU7Q0FDN0MsZ0JBQWdCLEVBQUUsR0FBRyxPQUFPLENBQUMsRUFBRSxDQUFDO0NBQ2hDLGFBQWEsTUFBTSxJQUFJLE1BQU0sSUFBSSxhQUFhLEVBQUU7Q0FDaEQsZ0JBQWdCLEVBQUUsR0FBRyxTQUFTLENBQUMsRUFBRSxDQUFDO0NBQ2xDO0NBQ0E7Q0FDQSxZQUFZLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7Q0FDaEMsWUFBWSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0NBQ2hDLFlBQVksT0FBTyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUU7Q0FDbEM7Q0FDQTs7Q0FFQSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUU7Q0FDZixRQUFRLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVE7Q0FDakU7Q0FDQTs7OztDQUlBO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7O0NBRUEsU0FBUyxXQUFXLENBQUMsTUFBTSxFQUFFOztDQUU3QixJQUFJLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Q0FDM0IsUUFBUSxPQUFPLFNBQVMsWUFBWSxJQUFJLENBQUMsT0FBTyxTQUFTLENBQUM7Q0FDMUQsS0FBSyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7Q0FDbkMsUUFBUSxPQUFPLFNBQVMsWUFBWSxJQUFJLENBQUMsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDN0Q7O0NBRUE7Q0FDQSxJQUFJLE1BQU0sWUFBWSxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDaEU7Q0FDQSxJQUFJLE9BQU8sU0FBUyxZQUFZLENBQUMsTUFBTSxFQUFFO0NBQ3pDO0NBQ0EsTUFBTSxJQUFJLE1BQU0sSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7Q0FDeEMsUUFBUSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUM7Q0FDakQsUUFBUSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUM7Q0FDakQsUUFBUSxPQUFPLE1BQU0sSUFBSSxDQUFDLE1BQU0sR0FBRyxPQUFPLEtBQUssTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsQ0FBQztDQUN0RjtDQUNBO0NBQ0E7Q0FDQSxNQUFNLElBQUksTUFBTSxJQUFJLFlBQVksQ0FBQyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO0NBQzlELFFBQVEsTUFBTSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7Q0FDdkUsUUFBUSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztDQUN2RSxRQUFRLE9BQU8sTUFBTSxJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sS0FBSyxNQUFNLEdBQUcsTUFBTSxDQUFDLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxDQUFDO0NBQ3RGO0NBQ0E7Q0FDQTtDQUNBLE1BQU0sS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0NBQ3hELFFBQVEsSUFBSSxNQUFNLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLE1BQU0sSUFBSSxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO0NBQzlFLFVBQVUsTUFBTSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDO0NBQ25ELFVBQVUsTUFBTSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztDQUN2RDtDQUNBLFVBQVUsT0FBTyxNQUFNLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxLQUFLLE1BQU0sR0FBRyxNQUFNLENBQUMsSUFBSSxPQUFPLEdBQUcsT0FBTyxDQUFDLENBQUM7Q0FDeEY7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxNQUFNLE9BQU8sU0FBUztDQUN0QixLQUFLO0NBQ0w7Q0FDQTs7Q0FFTyxNQUFNLG9CQUFvQixTQUFTLFdBQVcsQ0FBQzs7Q0FFdEQsSUFBSSxXQUFXLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRTtDQUMzQixRQUFRLEtBQUssQ0FBQyxHQUFHLENBQUM7Q0FDbEI7Q0FDQSxRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7Q0FDOUM7O0NBRUEsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO0NBQ2xCLFFBQVEsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDekQ7Q0FDQTs7Q0N2UEE7Q0FDQTtDQUNBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTs7Q0FFTyxNQUFNLFdBQVcsQ0FBQzs7Q0FFekIsSUFBSSxXQUFXLENBQUMsQ0FBQyxLQUFLLEVBQUU7Q0FDeEI7Q0FDQSxRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLEtBQUs7Q0FDakM7Q0FDQSxRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsU0FBUztDQUNoQztDQUNBLFFBQVEsSUFBSSxDQUFDLFFBQVEsR0FBRyxTQUFTO0NBQ2pDO0NBQ0EsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUs7Q0FDM0I7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxJQUFJLElBQUksTUFBTSxDQUFDLEdBQUc7Q0FDbEIsUUFBUSxPQUFPLElBQUksQ0FBQyxPQUFPO0NBQzNCOztDQUVBLElBQUksWUFBWSxDQUFDLEdBQUc7Q0FDcEI7Q0FDQSxRQUFRLElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUU7Q0FDNUMsWUFBWSxJQUFJLENBQUMsUUFBUSxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO0NBQ3REO0NBQ0EsUUFBUSxPQUFPLElBQUksQ0FBQztDQUNwQjs7Q0FFQTtDQUNBO0NBQ0E7O0NBRUEsSUFBSSxLQUFLLEdBQUc7Q0FDWixRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSTtDQUMxQjs7Q0FFQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsSUFBSSxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUU7Q0FDckIsUUFBUSxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRTtDQUN4QyxZQUFZLE1BQU0sR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7Q0FDaEM7Q0FDQSxRQUFRLElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxTQUFTLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtDQUN0RCxZQUFZLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7Q0FDeEM7Q0FDQSxRQUFRLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxFQUFFO0NBQ2pFLFlBQVksT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU07Q0FDdkM7Q0FDQSxRQUFRLE9BQU8sS0FBSztDQUNwQjs7Q0FFQSxJQUFJLFFBQVEsQ0FBQyxDQUFDLE1BQU0sRUFBRTtDQUN0QixRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO0NBQ2pELFFBQVEsSUFBSSxDQUFDLFFBQVEsR0FBRyxTQUFTO0NBQ2pDLFFBQVEsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLO0NBQzNCLFFBQVEsT0FBTyxJQUFJO0NBQ25COztDQUVBO0NBQ0E7Q0FDQTs7Q0FFQSxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7Q0FDbEIsUUFBUSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztDQUM1QixRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFO0NBQzVCLFlBQVksSUFBSSxDQUFDLFFBQVEsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQztDQUN0RDtDQUNBLFFBQVEsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7Q0FDMUM7Q0FDQTs7OztDQUlBO0NBQ0E7Q0FDQTs7Q0FFQSxTQUFTLGNBQWMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRTtDQUN6QyxJQUFJLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtDQUMxQixRQUFRLE9BQU8sSUFBSUMsYUFBcUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO0NBQ25ELEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxZQUFZLEVBQUU7Q0FDckMsUUFBUSxPQUFPLElBQUlDLGlCQUF5QixDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7Q0FDdkQsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLGVBQWUsRUFBRTtDQUN4QyxRQUFRLE9BQU8sSUFBSUMsb0JBQTRCLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQztDQUMxRCxLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksUUFBUSxFQUFFO0NBQ2pDLFFBQVEsT0FBTyxJQUFJQyxhQUFxQixDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7Q0FDbkQsS0FBSyxNQUFNO0NBQ1gsUUFBUSxPQUFPLENBQUMsR0FBRyxDQUFDLDJCQUEyQixFQUFFLElBQUksQ0FBQztDQUN0RDtDQUNBOztDQUVBLFNBQVMsWUFBWSxDQUFDLE1BQU0sRUFBRTtDQUM5QixJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUcsTUFBTTtDQUM5QixJQUFJLElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7Q0FDNUIsUUFBUSxPQUFPLGNBQWMsQ0FBQyxHQUFHLEVBQUUsUUFBUSxFQUFFLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0NBQy9EO0NBQ0EsSUFBSSxJQUFJLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO0NBQzVCLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQztDQUM3QyxRQUFRLE9BQU8sY0FBYyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0NBQzlDO0NBQ0EsSUFBSSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0NBQzNCLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQztDQUN6RDtDQUNBOztDQ2pJQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQSxDQUFRLE1BQU0sZUFBZSxDQUFDOzs7Q0FHOUI7Q0FDQTtDQUNBO0NBQ0EsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO0NBQ25CLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQztDQUMxQzs7O0NBR0E7Q0FDQTtDQUNBO0NBQ0EsSUFBSSxLQUFLLEdBQUc7Q0FDWixRQUFRLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDO0NBQ3pELFFBQVEsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsS0FBSztDQUMzRDs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQSxJQUFJLElBQUksR0FBRztDQUNYLFFBQVEsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDO0NBQ3ZELFFBQVEsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHO0NBQ3JEOztDQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO0NBQ3JCLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsT0FBTztDQUN0RCxRQUFRLElBQUksS0FBSyxHQUFHLElBQUksRUFBRTtDQUMxQixZQUFZLE1BQU0sSUFBSSxLQUFLLEVBQUUsZ0NBQWdDLEVBQUUsS0FBSyxFQUFFLElBQUk7Q0FDMUU7Q0FDQSxRQUFRLEtBQUssR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7Q0FDMUIsUUFBUSxJQUFJLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0NBQ3hCLFFBQVEsSUFBSSxPQUFPLEdBQUcsS0FBSztDQUMzQixRQUFRLElBQUksTUFBTTtDQUNsQixRQUFRLE1BQU0sT0FBTyxHQUFHLEVBQUU7Q0FDMUIsUUFBUSxJQUFJLEtBQUssR0FBRztDQUNwQixRQUFRLE9BQU8sS0FBSyxFQUFFO0NBQ3RCLFlBQVksSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsRUFBRTtDQUM1QztDQUNBLGdCQUFnQjtDQUNoQjtDQUNBLFlBQVksTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO0NBQ3pDLFlBQVksSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7Q0FDM0M7Q0FDQSxnQkFBZ0IsSUFBSSxNQUFNLENBQUMsS0FBSyxJQUFJLFNBQVMsRUFBRTtDQUMvQztDQUNBO0NBQ0Esb0JBQW9CO0NBQ3BCLGlCQUFpQixNQUFNO0NBQ3ZCO0NBQ0E7Q0FDQSxvQkFBb0IsT0FBTyxHQUFHLE1BQU0sQ0FBQyxLQUFLO0NBQzFDO0NBQ0EsYUFBYSxNQUFNO0NBQ25CLGdCQUFnQixPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7Q0FDM0MsZ0JBQWdCLElBQUksTUFBTSxDQUFDLEtBQUssSUFBSSxTQUFTLEVBQUU7Q0FDL0M7Q0FDQTtDQUNBLG9CQUFvQjtDQUNwQixpQkFBaUIsTUFBTTtDQUN2QjtDQUNBO0NBQ0Esb0JBQW9CLE9BQU8sR0FBRyxNQUFNLENBQUMsS0FBSztDQUMxQztDQUNBO0NBQ0EsWUFBWSxLQUFLLEVBQUU7Q0FDbkI7Q0FDQSxRQUFRLE9BQU8sT0FBTztDQUN0QjtDQUNBOztDQ3pKQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBOzs7Q0FHQTtDQUNBLFNBQVMsYUFBYSxDQUFDLElBQUksRUFBRTtDQUM3QixJQUFJLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Q0FDdEI7O0NBRUE7Q0FDQSxTQUFTLGdCQUFnQixDQUFDLElBQUksRUFBRTtDQUNoQyxJQUFJLE9BQU8sUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztDQUM3Qzs7Q0FFQTtDQUNBLFNBQVMsaUJBQWlCLENBQUMsSUFBSSxFQUFFO0NBQ2pDLElBQUksT0FBTyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0NBQzdDOzs7Q0FHTyxNQUFNLGlCQUFpQixTQUFTLGVBQWUsQ0FBQzs7Q0FFdkQsSUFBSSxXQUFXLENBQUMsR0FBRyxFQUFFO0NBQ3JCLFFBQVEsS0FBSyxFQUFFO0NBQ2YsUUFBUSxJQUFJLENBQUMsSUFBSSxHQUFHLEdBQUc7Q0FDdkI7O0NBRUEsSUFBSSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDOztDQUVqQztDQUNBO0NBQ0E7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtDQUNuQixRQUFRLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFO0NBQ3hDLFlBQVksTUFBTSxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztDQUNoQztDQUNBLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7Q0FDcEMsWUFBWSxNQUFNLElBQUksS0FBSyxDQUFDLDJCQUEyQixDQUFDO0NBQ3hEO0NBQ0EsUUFBUSxNQUFNLE1BQU0sR0FBRztDQUN2QixZQUFZLE1BQU0sRUFBRSxFQUFFO0NBQ3RCLFlBQVksR0FBRyxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7Q0FDbEQsWUFBWSxJQUFJLEVBQUUsU0FBUztDQUMzQixZQUFZLEtBQUssRUFBRSxTQUFTO0NBQzVCLFlBQVksSUFBSSxFQUFFLFNBQVM7Q0FDM0IsWUFBWSxJQUFJLEVBQUU7Q0FDbEIsU0FBUztDQUNULFFBQVEsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLO0NBQ25DLFFBQVEsSUFBSSxPQUFPLEVBQUUsSUFBSTtDQUN6QixRQUFRLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxNQUFNO0NBQ2pDLFFBQVEsSUFBSSxJQUFJLElBQUksQ0FBQyxFQUFFO0NBQ3ZCLFlBQVksT0FBTyxNQUFNLENBQUM7Q0FDMUI7Q0FDQSxRQUFRLElBQUksQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsYUFBYSxDQUFDO0NBQ3RFLFFBQVEsSUFBSSxLQUFLLEVBQUU7Q0FDbkI7Q0FDQTtDQUNBLFlBQVksSUFBSSxHQUFHLEtBQUssQ0FBQyxHQUFHO0NBQzVCLFlBQVksSUFBSSxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEVBQUU7Q0FDNUQsZ0JBQWdCLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Q0FDL0Q7Q0FDQTtDQUNBLFFBQVEsSUFBSSxPQUFPLElBQUksU0FBUyxFQUFFO0NBQ2xDO0NBQ0EsWUFBWSxJQUFJLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Q0FDL0IsWUFBWSxJQUFJLElBQUksSUFBSSxTQUFTLEVBQUU7Q0FDbkM7Q0FDQSxnQkFBZ0IsSUFBSSxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEVBQUU7Q0FDaEUsb0JBQW9CLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUM7Q0FDbkUsaUJBQWlCO0NBQ2pCO0NBQ0EsU0FBUztDQUNULFFBQVEsSUFBSSxPQUFPLElBQUksU0FBUyxFQUFFO0NBQ2xDO0NBQ0EsWUFBWSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQztDQUN4RDs7Q0FFQTtDQUNBLFFBQVEsSUFBSSxDQUFDLElBQUksT0FBTyxDQUFDLE1BQU0sSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLElBQUksRUFBRTtDQUMxRCxZQUFZLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0NBQ3BEO0NBQ0E7Q0FDQSxRQUFRLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLElBQUksT0FBTyxDQUFDLElBQUksR0FBRyxJQUFJLEVBQUU7Q0FDdEQsWUFBWSxNQUFNLENBQUMsSUFBSSxJQUFJLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7Q0FDakU7Q0FDQSxRQUFRLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLElBQUksT0FBTyxDQUFDLEtBQUssR0FBRyxJQUFJLEVBQUU7Q0FDeEQsWUFBWSxNQUFNLENBQUMsSUFBSSxJQUFJLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7Q0FDakUsU0FBUztDQUNUO0NBQ0EsUUFBUSxJQUFJLEdBQUcsRUFBRSxJQUFJO0NBQ3JCLFFBQVEsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Q0FDdEMsWUFBWSxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUc7Q0FDMUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQztDQUNyRCxZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUcsU0FBUztDQUN2RixZQUFZLE1BQU0sQ0FBQyxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxHQUFHLFNBQVM7Q0FDeEYsWUFBWSxNQUFNLENBQUMsR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRztDQUM3QyxTQUFTLE1BQU07Q0FDZixZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUk7Q0FDckMsWUFBWSxNQUFNLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJO0NBQ3RDO0NBQ0EsWUFBWSxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSTtDQUNsQyxZQUFZLEdBQUcsR0FBRyxDQUFDLElBQUksSUFBSSxTQUFTLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUM7Q0FDbkYsWUFBWSxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSztDQUNwQyxZQUFZLElBQUksR0FBRyxDQUFDLEtBQUssSUFBSSxTQUFTLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDO0NB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c0JBQXNCLEVBQUU7Q0FDekM7Q0FDQTs7Q0FFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBLElBQUksc0JBQXNCLEdBQUc7O0NBRTdCO0NBQ0EsUUFBUSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRTtDQUM3QyxRQUFRLE1BQU0sQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxXQUFXOztDQUVsRTtDQUNBLFFBQVEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUU7Q0FDbEM7Q0FDQSxZQUFZO0NBQ1o7O0NBRUE7Q0FDQSxRQUFRLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUM7Q0FDN0QsUUFBUSxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7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
