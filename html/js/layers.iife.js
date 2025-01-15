
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
	                    handler(); 
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
	        throw new Error("not implemented");
	    }

	    get items() {
	        throw new Error("not implemented");
	    }

	    get info () {
	        return {dynamic: true, overlapping: true, local:false};
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

	/***************************************************************
	    SIMPLE STATE PROVIDER (LOCAL)
	***************************************************************/

	/**
	 * Local Array with non-overlapping items.
	 */

	class SimpleStateProvider extends StateProviderBase {

	    constructor(options={}) {
	        super();
	        // initialization
	        let {items, value} = options;
	        if (items != undefined) {
	            this._items = check_input$1(items);
	        } else if (value != undefined) {
	            this._items = [{itv:[-Infinity, Infinity, true, true], args:{value}}];
	        } else {
	            this._items = [];
	        }
	        // notify callbacks?
	    }

	    update (items) {
	        this._items = check_input$1(items);
	        return Promise.resolve()
	            .then(() => {
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

	const METHODS = {assign, move, transition, interpolate: interpolate$1};


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

	function interpolate$1(target, tuples) {
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

	    update (items) {
	        throw new Error("Not implemented");
	    }

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

	    /*
	        Sample NearbyIndex by timeline offset increments
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

	        start = endpoint.max(this.first(), start);
	        stop = endpoint.min(this.last(), stop);
	        const cache = new NearbyCache(this);
	        return range(start[0], stop[0], step, {include_end:true})
	            .map((offset) => {
	                return [cache.query(offset).value, offset];
	            });
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

	/************************************************
	 * CLOCK CURSORS
	 ************************************************/

	// CLOCK (counting seconds since page load)
	class LocalClock extends CursorBase {
	    query () {
	        let offset = performance.now()/1000.0;
	        return {value:offset, dynamic:true, rate:1, offset};
	    }
	}

	// CLOCK (counting seconds since epoch (1970)
	class LocalEpoch extends CursorBase {
	    query () {
	        let offset = (Date.now() / 1000.0);
	        return {value:offset, dynamic:true, rate:1, offset};
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
	        // index
	        this._index = new SimpleNearbyIndex();
	        // cache
	        this._cache = new NearbyCache(this._index);
	        
	        let {src, ctrl, ...opts} = options;

	        // initialise ctrl
	        if (ctrl == undefined) {
	            ctrl = local_clock;
	        }
	        this.ctrl = ctrl;

	        // initialise state
	        if (src == undefined) {
	            src = new SimpleStateProvider(opts);
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
	    __ctrl_handle_change() {
	        this.__handle_change();
	    }

	    /**********************************************************
	     * SRC (stateprovider)
	     **********************************************************/

	    __src_check(src) {
	        if (!(src instanceof StateProviderBase)) {
	            throw new Error(`"src" must be state provider ${source}`);
	        }
	    }    
	    __src_handle_change() {
	        this.__handle_change();
	    }

	    /**********************************************************
	     * CALLBACK
	     **********************************************************/

	    __handle_change() {
	        if (this.src && this.ctrl) {
	            let items = this.src.items;
	            this._index.update(items);
	            this._cache.dirty();
	            // trigger change event for cursor
	            this.eventifyTrigger("change", this.query());    
	        }
	    }

	    /**********************************************************
	     * QUERY API
	     **********************************************************/
	    
	    query () {
	        let {value:offset} = this.ctrl.query();
	        if (typeof offset !== 'number') {
	            throw new Error(`warning: ctrl state must be number ${offset}`);
	        }
	        return this._cache.query(offset);
	    }

	    get value () {return this.query().value};


	    /**********************************************************
	     * UPDATE API
	     **********************************************************/

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
	        source.addToInstance(this, "src");
	        // index
	        this._index = new SimpleNearbyIndex();
	        // cache
	        this._cache = new NearbyCache(this._index);

	        // initialise with stateprovider
	        let {src, ...opts} = options;
	        if (src == undefined) {
	            src = new SimpleStateProvider(opts);
	        }
	        if (!(src instanceof StateProviderBase)) {
	            throw new Error("src must be StateproviderBase")
	        }
	        this.src = src;
	    }

	    /**********************************************************
	     * SRC (stateprovider)
	     **********************************************************/

	    __src_check(src) {
	        if (!(src instanceof StateProviderBase)) {
	            throw new Error(`"src" must be state provider ${source}`);
	        }
	    }    
	    __src_handle_change() {
	        let items = this.src.items;
	        this._index.update(items);
	        this._cache.dirty();
	        // trigger change event for cursor
	        this.eventifyTrigger("change", this.query());   
	    }

	    /**********************************************************
	     * QUERY API
	     **********************************************************/

	    query(offset) {
	        return this._cache.query(offset);
	    }

	    list (options) {
	        return this._index.list(options);
	    }

	    sample (options) {
	        return this._index.sample(options);
	    }

	    /**********************************************************
	     * UPDATE API
	     **********************************************************/

	    // TODO - add methods for update?

	}
	source.addToPrototype(Layer.prototype, "src", {mutable:true});

	exports.Cursor = Cursor;
	exports.Layer = Layer;
	exports.cmd = cmd;

	return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ldmVudGlmeS5qcyIsIi4uLy4uL3NyYy91dGlsLmpzIiwiLi4vLi4vc3JjL21vbml0b3IuanMiLCIuLi8uLi9zcmMvYmFzZXMuanMiLCIuLi8uLi9zcmMvaW50ZXJ2YWxzLmpzIiwiLi4vLi4vc3JjL3N0YXRlcHJvdmlkZXJfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL2NtZC5qcyIsIi4uLy4uL3NyYy9zZWdtZW50cy5qcyIsIi4uLy4uL3NyYy9uZWFyYnljYWNoZS5qcyIsIi4uLy4uL3NyYy9uZWFyYnlpbmRleC5qcyIsIi4uLy4uL3NyYy9uZWFyYnlpbmRleF9zaW1wbGUuanMiLCIuLi8uLi9zcmMvY3Vyc29ycy5qcyIsIi4uLy4uL3NyYy9sYXllcnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcblx0Q29weXJpZ2h0IDIwMjBcblx0QXV0aG9yIDogSW5nYXIgQXJudHplblxuXG5cdFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUaW1pbmdzcmMgbW9kdWxlLlxuXG5cdFRpbWluZ3NyYyBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG5cdGl0IHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieVxuXHR0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvclxuXHQoYXQgeW91ciBvcHRpb24pIGFueSBsYXRlciB2ZXJzaW9uLlxuXG5cdFRpbWluZ3NyYyBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLFxuXHRidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7IHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZlxuXHRNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG5cdEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuXG5cdFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZVxuXHRhbG9uZyB3aXRoIFRpbWluZ3NyYy4gIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiovXG5cblxuXG4vKlxuXHRFdmVudFxuXHQtIG5hbWU6IGV2ZW50IG5hbWVcblx0LSBwdWJsaXNoZXI6IHRoZSBvYmplY3Qgd2hpY2ggZGVmaW5lZCB0aGUgZXZlbnRcblx0LSBpbml0OiB0cnVlIGlmIHRoZSBldmVudCBzdXBwcG9ydHMgaW5pdCBldmVudHNcblx0LSBzdWJzY3JpcHRpb25zOiBzdWJzY3JpcHRpbnMgdG8gdGhpcyBldmVudFxuXG4qL1xuXG5jbGFzcyBFdmVudCB7XG5cblx0Y29uc3RydWN0b3IgKHB1Ymxpc2hlciwgbmFtZSwgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5wdWJsaXNoZXIgPSBwdWJsaXNoZXI7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gZmFsc2UgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zID0gW107XG5cdH1cblxuXHQvKlxuXHRcdHN1YnNjcmliZSB0byBldmVudFxuXHRcdC0gc3Vic2NyaWJlcjogc3Vic2NyaWJpbmcgb2JqZWN0XG5cdFx0LSBjYWxsYmFjazogY2FsbGJhY2sgZnVuY3Rpb24gdG8gaW52b2tlXG5cdFx0LSBvcHRpb25zOlxuXHRcdFx0aW5pdDogaWYgdHJ1ZSBzdWJzY3JpYmVyIHdhbnRzIGluaXQgZXZlbnRzXG5cdCovXG5cdHN1YnNjcmliZSAoY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRpZiAoIWNhbGxiYWNrIHx8IHR5cGVvZiBjYWxsYmFjayAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayBub3QgYSBmdW5jdGlvblwiLCBjYWxsYmFjayk7XG5cdFx0fVxuXHRcdGNvbnN0IHN1YiA9IG5ldyBTdWJzY3JpcHRpb24odGhpcywgY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5wdXNoKHN1Yik7XG5cdCAgICAvLyBJbml0aWF0ZSBpbml0IGNhbGxiYWNrIGZvciB0aGlzIHN1YnNjcmlwdGlvblxuXHQgICAgaWYgKHRoaXMuaW5pdCAmJiBzdWIuaW5pdCkge1xuXHQgICAgXHRzdWIuaW5pdF9wZW5kaW5nID0gdHJ1ZTtcblx0ICAgIFx0bGV0IHNlbGYgPSB0aGlzO1xuXHQgICAgXHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgIFx0XHRjb25zdCBlQXJncyA9IHNlbGYucHVibGlzaGVyLmV2ZW50aWZ5SW5pdEV2ZW50QXJncyhzZWxmLm5hbWUpIHx8IFtdO1xuXHQgICAgXHRcdHN1Yi5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0ICAgIFx0XHRmb3IgKGxldCBlQXJnIG9mIGVBcmdzKSB7XG5cdCAgICBcdFx0XHRzZWxmLnRyaWdnZXIoZUFyZywgW3N1Yl0sIHRydWUpO1xuXHQgICAgXHRcdH1cblx0ICAgIFx0fSk7XG5cdCAgICB9XG5cdFx0cmV0dXJuIHN1YlxuXHR9XG5cblx0Lypcblx0XHR0cmlnZ2VyIGV2ZW50XG5cblx0XHQtIGlmIHN1YiBpcyB1bmRlZmluZWQgLSBwdWJsaXNoIHRvIGFsbCBzdWJzY3JpcHRpb25zXG5cdFx0LSBpZiBzdWIgaXMgZGVmaW5lZCAtIHB1Ymxpc2ggb25seSB0byBnaXZlbiBzdWJzY3JpcHRpb25cblx0Ki9cblx0dHJpZ2dlciAoZUFyZywgc3VicywgaW5pdCkge1xuXHRcdGxldCBlSW5mbywgY3R4O1xuXHRcdGZvciAoY29uc3Qgc3ViIG9mIHN1YnMpIHtcblx0XHRcdC8vIGlnbm9yZSB0ZXJtaW5hdGVkIHN1YnNjcmlwdGlvbnNcblx0XHRcdGlmIChzdWIudGVybWluYXRlZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGVJbmZvID0ge1xuXHRcdFx0XHRzcmM6IHRoaXMucHVibGlzaGVyLFxuXHRcdFx0XHRuYW1lOiB0aGlzLm5hbWUsXG5cdFx0XHRcdHN1Yjogc3ViLFxuXHRcdFx0XHRpbml0OiBpbml0XG5cdFx0XHR9XG5cdFx0XHRjdHggPSBzdWIuY3R4IHx8IHRoaXMucHVibGlzaGVyO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0c3ViLmNhbGxiYWNrLmNhbGwoY3R4LCBlQXJnLCBlSW5mbyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYEVycm9yIGluICR7dGhpcy5uYW1lfTogJHtzdWIuY2FsbGJhY2t9ICR7ZXJyfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qXG5cdHVuc3Vic2NyaWJlIGZyb20gZXZlbnRcblx0LSB1c2Ugc3Vic2NyaXB0aW9uIHJldHVybmVkIGJ5IHByZXZpb3VzIHN1YnNjcmliZVxuXHQqL1xuXHR1bnN1YnNjcmliZShzdWIpIHtcblx0XHRsZXQgaWR4ID0gdGhpcy5zdWJzY3JpcHRpb25zLmluZGV4T2Yoc3ViKTtcblx0XHRpZiAoaWR4ID4gLTEpIHtcblx0XHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdHN1Yi50ZXJtaW5hdGUoKTtcblx0XHR9XG5cdH1cbn1cblxuXG4vKlxuXHRTdWJzY3JpcHRpb24gY2xhc3NcbiovXG5cbmNsYXNzIFN1YnNjcmlwdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoZXZlbnQsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLmV2ZW50ID0gZXZlbnQ7XG5cdFx0dGhpcy5uYW1lID0gZXZlbnQubmFtZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2tcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gdGhpcy5ldmVudC5pbml0IDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gZmFsc2U7XG5cdFx0dGhpcy5jdHggPSBvcHRpb25zLmN0eDtcblx0fVxuXG5cdHRlcm1pbmF0ZSgpIHtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSB0cnVlO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5ldmVudC51bnN1YnNjcmliZSh0aGlzKTtcblx0fVxufVxuXG5cbi8qXG5cblx0RVZFTlRJRlkgSU5TVEFOQ0VcblxuXHRFdmVudGlmeSBicmluZ3MgZXZlbnRpbmcgY2FwYWJpbGl0aWVzIHRvIGFueSBvYmplY3QuXG5cblx0SW4gcGFydGljdWxhciwgZXZlbnRpZnkgc3VwcG9ydHMgdGhlIGluaXRpYWwtZXZlbnQgcGF0dGVybi5cblx0T3B0LWluIGZvciBpbml0aWFsIGV2ZW50cyBwZXIgZXZlbnQgdHlwZS5cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlJbnN0YW5jZSAob2JqZWN0KSB7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwID0gbmV3IE1hcCgpO1xuXHRvYmplY3QuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0cmV0dXJuIG9iamVjdDtcbn07XG5cblxuLypcblx0RVZFTlRJRlkgUFJPVE9UWVBFXG5cblx0QWRkIGV2ZW50aWZ5IGZ1bmN0aW9uYWxpdHkgdG8gcHJvdG90eXBlIG9iamVjdFxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5UHJvdG90eXBlKF9wcm90b3R5cGUpIHtcblxuXHRmdW5jdGlvbiBldmVudGlmeUdldEV2ZW50KG9iamVjdCwgbmFtZSkge1xuXHRcdGNvbnN0IGV2ZW50ID0gb2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAuZ2V0KG5hbWUpO1xuXHRcdGlmIChldmVudCA9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IHVuZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0cmV0dXJuIGV2ZW50O1xuXHR9XG5cblx0Lypcblx0XHRERUZJTkUgRVZFTlRcblx0XHQtIHVzZWQgb25seSBieSBldmVudCBzb3VyY2Vcblx0XHQtIG5hbWU6IG5hbWUgb2YgZXZlbnRcblx0XHQtIG9wdGlvbnM6IHtpbml0OnRydWV9IHNwZWNpZmllcyBpbml0LWV2ZW50IHNlbWFudGljcyBmb3IgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlEZWZpbmUobmFtZSwgb3B0aW9ucykge1xuXHRcdC8vIGNoZWNrIHRoYXQgZXZlbnQgZG9lcyBub3QgYWxyZWFkeSBleGlzdFxuXHRcdGlmICh0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuaGFzKG5hbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCBhbHJlYWR5IGRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5zZXQobmFtZSwgbmV3IEV2ZW50KHRoaXMsIG5hbWUsIG9wdGlvbnMpKTtcblx0fTtcblxuXHQvKlxuXHRcdE9OXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRyZWdpc3RlciBjYWxsYmFjayBvbiBldmVudC5cblx0Ki9cblx0ZnVuY3Rpb24gb24obmFtZSwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpYmUoY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T0ZGXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRVbi1yZWdpc3RlciBhIGhhbmRsZXIgZnJvbSBhIHNwZWNmaWMgZXZlbnQgdHlwZVxuXHQqL1xuXHRmdW5jdGlvbiBvZmYoc3ViKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgc3ViLm5hbWUpLnVuc3Vic2NyaWJlKHN1Yik7XG5cdH07XG5cblxuXHRmdW5jdGlvbiBldmVudGlmeVN1YnNjcmlwdGlvbnMobmFtZSkge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmlwdGlvbnM7XG5cdH1cblxuXG5cblx0Lypcblx0XHRUcmlnZ2VyIGxpc3Qgb2YgZXZlbnRJdGVtcyBvbiBvYmplY3RcblxuXHRcdGV2ZW50SXRlbTogIHtuYW1lOi4uLCBlQXJnOi4ufVxuXG5cdFx0Y29weSBhbGwgZXZlbnRJdGVtcyBpbnRvIGJ1ZmZlci5cblx0XHRyZXF1ZXN0IGVtcHR5aW5nIHRoZSBidWZmZXIsIGkuZS4gYWN0dWFsbHkgdHJpZ2dlcmluZyBldmVudHMsXG5cdFx0ZXZlcnkgdGltZSB0aGUgYnVmZmVyIGdvZXMgZnJvbSBlbXB0eSB0byBub24tZW1wdHlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxsKGV2ZW50SXRlbXMpIHtcblx0XHRpZiAoZXZlbnRJdGVtcy5sZW5ndGggPT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIG1ha2UgdHJpZ2dlciBpdGVtc1xuXHRcdC8vIHJlc29sdmUgbm9uLXBlbmRpbmcgc3Vic2NyaXB0aW9ucyBub3dcblx0XHQvLyBlbHNlIHN1YnNjcmlwdGlvbnMgbWF5IGNoYW5nZSBmcm9tIHBlbmRpbmcgdG8gbm9uLXBlbmRpbmdcblx0XHQvLyBiZXR3ZWVuIGhlcmUgYW5kIGFjdHVhbCB0cmlnZ2VyaW5nXG5cdFx0Ly8gbWFrZSBsaXN0IG9mIFtldiwgZUFyZywgc3Vic10gdHVwbGVzXG5cdFx0bGV0IHRyaWdnZXJJdGVtcyA9IGV2ZW50SXRlbXMubWFwKChpdGVtKSA9PiB7XG5cdFx0XHRsZXQge25hbWUsIGVBcmd9ID0gaXRlbTtcblx0XHRcdGxldCBldiA9IGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSk7XG5cdFx0XHRsZXQgc3VicyA9IGV2LnN1YnNjcmlwdGlvbnMuZmlsdGVyKHN1YiA9PiBzdWIuaW5pdF9wZW5kaW5nID09IGZhbHNlKTtcblx0XHRcdHJldHVybiBbZXYsIGVBcmcsIHN1YnNdO1xuXHRcdH0sIHRoaXMpO1xuXG5cdFx0Ly8gYXBwZW5kIHRyaWdnZXIgSXRlbXMgdG8gYnVmZmVyXG5cdFx0Y29uc3QgbGVuID0gdHJpZ2dlckl0ZW1zLmxlbmd0aDtcblx0XHRjb25zdCBidWYgPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyO1xuXHRcdGNvbnN0IGJ1Zl9sZW4gPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aDtcblx0XHQvLyByZXNlcnZlIG1lbW9yeSAtIHNldCBuZXcgbGVuZ3RoXG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGggPSBidWZfbGVuICsgbGVuO1xuXHRcdC8vIGNvcHkgdHJpZ2dlckl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGZvciAobGV0IGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0YnVmW2J1Zl9sZW4raV0gPSB0cmlnZ2VySXRlbXNbaV07XG5cdFx0fVxuXHRcdC8vIHJlcXVlc3QgZW1wdHlpbmcgb2YgdGhlIGJ1ZmZlclxuXHRcdGlmIChidWZfbGVuID09IDApIHtcblx0XHRcdGxldCBzZWxmID0gdGhpcztcblx0XHRcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGZvciAobGV0IFtldiwgZUFyZywgc3Vic10gb2Ygc2VsZi5fX2V2ZW50aWZ5X2J1ZmZlcikge1xuXHRcdFx0XHRcdC8vIGFjdHVhbCBldmVudCB0cmlnZ2VyaW5nXG5cdFx0XHRcdFx0ZXYudHJpZ2dlcihlQXJnLCBzdWJzLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZi5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIG11bHRpcGxlIGV2ZW50cyBvZiBzYW1lIHR5cGUgKG5hbWUpXG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsaWtlKG5hbWUsIGVBcmdzKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKGVBcmdzLm1hcChlQXJnID0+IHtcblx0XHRcdHJldHVybiB7bmFtZSwgZUFyZ307XG5cdFx0fSkpO1xuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIHNpbmdsZSBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXIobmFtZSwgZUFyZykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChbe25hbWUsIGVBcmd9XSk7XG5cdH1cblxuXHRfcHJvdG90eXBlLmV2ZW50aWZ5RGVmaW5lID0gZXZlbnRpZnlEZWZpbmU7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyID0gZXZlbnRpZnlUcmlnZ2VyO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsaWtlID0gZXZlbnRpZnlUcmlnZ2VyQWxpa2U7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxsID0gZXZlbnRpZnlUcmlnZ2VyQWxsO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5U3Vic2NyaXB0aW9ucyA9IGV2ZW50aWZ5U3Vic2NyaXB0aW9ucztcblx0X3Byb3RvdHlwZS5vbiA9IG9uO1xuXHRfcHJvdG90eXBlLm9mZiA9IG9mZjtcbn07XG5cblxuZXhwb3J0IGNvbnN0IGV2ZW50aWZ5ID0gZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4ge1xuXHRcdGFkZFRvSW5zdGFuY2U6IGV2ZW50aWZ5SW5zdGFuY2UsXG5cdFx0YWRkVG9Qcm90b3R5cGU6IGV2ZW50aWZ5UHJvdG90eXBlXG5cdH1cbn0oKTtcblxuLypcblx0RXZlbnQgVmFyaWFibGVcblxuXHRPYmplY3RzIHdpdGggYSBzaW5nbGUgXCJjaGFuZ2VcIiBldmVudFxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50VmFyaWFibGUge1xuXG5cdGNvbnN0cnVjdG9yICh2YWx1ZSkge1xuXHRcdGV2ZW50aWZ5SW5zdGFuY2UodGhpcyk7XG5cdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHR0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcblx0fVxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5fdmFsdWV9O1xuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlICE9IHRoaXMuX3ZhbHVlKSB7XG5cdFx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuZXZlbnRpZnlQcm90b3R5cGUoRXZlbnRWYXJpYWJsZS5wcm90b3R5cGUpO1xuXG4vKlxuXHRFdmVudCBCb29sZWFuXG5cblxuXHROb3RlIDogaW1wbGVtZW50YXRpb24gdXNlcyBmYWxzaW5lc3Mgb2YgaW5wdXQgcGFyYW1ldGVyIHRvIGNvbnN0cnVjdG9yIGFuZCBzZXQoKSBvcGVyYXRpb24sXG5cdHNvIGV2ZW50Qm9vbGVhbigtMSkgd2lsbCBhY3R1YWxseSBzZXQgaXQgdG8gdHJ1ZSBiZWNhdXNlXG5cdCgtMSkgPyB0cnVlIDogZmFsc2UgLT4gdHJ1ZSAhXG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRCb29sZWFuIGV4dGVuZHMgRXZlbnRWYXJpYWJsZSB7XG5cdGNvbnN0cnVjdG9yKHZhbHVlKSB7XG5cdFx0c3VwZXIoQm9vbGVhbih2YWx1ZSkpO1xuXHR9XG5cblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdHN1cGVyLnZhbHVlID0gQm9vbGVhbih2YWx1ZSk7XG5cdH1cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gc3VwZXIudmFsdWV9O1xufVxuXG5cbi8qXG5cdG1ha2UgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gRXZlbnRCb29sZWFuIGNoYW5nZXNcblx0dmFsdWUuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQcm9taXNlKGV2ZW50T2JqZWN0LCBjb25kaXRpb25GdW5jKSB7XG5cdGNvbmRpdGlvbkZ1bmMgPSBjb25kaXRpb25GdW5jIHx8IGZ1bmN0aW9uKHZhbCkge3JldHVybiB2YWwgPT0gdHJ1ZX07XG5cdHJldHVybiBuZXcgUHJvbWlzZSAoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdGxldCBzdWIgPSBldmVudE9iamVjdC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdGlmIChjb25kaXRpb25GdW5jKHZhbHVlKSkge1xuXHRcdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHRcdFx0ZXZlbnRPYmplY3Qub2ZmKHN1Yik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufTtcblxuLy8gbW9kdWxlIGFwaVxuZXhwb3J0IGRlZmF1bHQge1xuXHRldmVudGlmeVByb3RvdHlwZSxcblx0ZXZlbnRpZnlJbnN0YW5jZSxcblx0RXZlbnRWYXJpYWJsZSxcblx0RXZlbnRCb29sZWFuLFxuXHRtYWtlUHJvbWlzZVxufTtcblxuIiwiXG4vLyBvdnZlcnJpZGUgbW9kdWxvIHRvIGJlaGF2ZSBiZXR0ZXIgZm9yIG5lZ2F0aXZlIG51bWJlcnNcbmV4cG9ydCBmdW5jdGlvbiBtb2QobiwgbSkge1xuICAgIHJldHVybiAoKG4gJSBtKSArIG0pICUgbTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBkaXZtb2QoeCwgYmFzZSkge1xuICAgIGxldCBuID0gTWF0aC5mbG9vcih4IC8gYmFzZSlcbiAgICBsZXQgciA9IG1vZCh4LCBiYXNlKTtcbiAgICByZXR1cm4gW24sIHJdO1xufVxuXG5cbi8qXG4gICAgc2ltaWxhciB0byByYW5nZSBmdW5jdGlvbiBpbiBweXRob25cbiovXG5cbmV4cG9ydCBmdW5jdGlvbiByYW5nZSAoc3RhcnQsIGVuZCwgc3RlcCA9IDEsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICBjb25zdCB7aW5jbHVkZV9lbmQ9ZmFsc2V9ID0gb3B0aW9ucztcbiAgICBpZiAoc3RlcCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0ZXAgY2Fubm90IGJlIHplcm8uJyk7XG4gICAgfVxuICAgIGlmIChzdGFydCA8IGVuZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gc3RlcCkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChzdGFydCA+IGVuZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPiBlbmQ7IGkgLT0gc3RlcCkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChpbmNsdWRlX2VuZCkge1xuICAgICAgICByZXN1bHQucHVzaChlbmQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5cblxuLypcbiAgICBUaGlzIGFkZHMgYmFzaWMgKHN5bmNocm9ub3VzKSBjYWxsYmFjayBzdXBwb3J0IHRvIGFuIG9iamVjdC5cbiovXG5cbmV4cG9ydCBjb25zdCBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHtcblxuICAgIGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2Uob2JqZWN0KSB7XG4gICAgICAgIG9iamVjdC5fX2NhbGxiYWNrX2NhbGxiYWNrcyA9IFtdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZF9jYWxsYmFjayAoaGFuZGxlcikge1xuICAgICAgICBsZXQgaGFuZGxlID0ge1xuICAgICAgICAgICAgaGFuZGxlcjogaGFuZGxlclxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX19jYWxsYmFja19jYWxsYmFja3MucHVzaChoYW5kbGUpO1xuICAgICAgICByZXR1cm4gaGFuZGxlO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiByZW1vdmVfY2FsbGJhY2sgKGhhbmRsZSkge1xuICAgICAgICBsZXQgaW5kZXggPSB0aGlzLl9fY2FsbGJhY2tfY2FsbGJhY2tzLmluZGV4b2YoaGFuZGxlKTtcbiAgICAgICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuX19jYWxsYmFja19jYWxsYmFja3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBub3RpZnlfY2FsbGJhY2tzIChlQXJnKSB7XG4gICAgICAgIHRoaXMuX19jYWxsYmFja19jYWxsYmFja3MuZm9yRWFjaChmdW5jdGlvbihoYW5kbGUpIHtcbiAgICAgICAgICAgIGhhbmRsZS5oYW5kbGVyKGVBcmcpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG5cbiAgICBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuICAgICAgICBjb25zdCBhcGkgPSB7XG4gICAgICAgICAgICBhZGRfY2FsbGJhY2ssIHJlbW92ZV9jYWxsYmFjaywgbm90aWZ5X2NhbGxiYWNrc1xuICAgICAgICB9XG4gICAgICAgIE9iamVjdC5hc3NpZ24oX3Byb3RvdHlwZSwgYXBpKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge2FkZFRvSW5zdGFuY2UsIGFkZFRvUHJvdG90eXBlfVxufSgpO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIFNPVVJDRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBFeHRlbmQgYSBjbGFzcyB3aXRoIHN1cHBvcnQgZm9yIGV4dGVybmFsIHNvdXJjZSBvbiBcbiAqIGEgbmFtZWQgcHJvcGVydHkuXG4gKiBcbiAqIG9wdGlvbjogbXV0YWJsZTp0cnVlIG1lYW5zIHRoYXQgcHJvcGVyeSBtYXkgYmUgcmVzZXQgXG4gKiBcbiAqIHNvdXJjZSBvYmplY3QgaXMgYXNzdW1lZCB0byBzdXBwb3J0IHRoZSBjYWxsYmFjayBpbnRlcmZhY2VcbiAqL1xuXG5cbmV4cG9ydCBjb25zdCBzb3VyY2UgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICBmdW5jdGlvbiBwcm9wbmFtZXMgKHByb3BOYW1lKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwcm9wOiBgX18ke3Byb3BOYW1lfWAsXG4gICAgICAgICAgICBpbml0OiBgX18ke3Byb3BOYW1lfV9pbml0YCxcbiAgICAgICAgICAgIGhhbmRsZTogYF9fJHtwcm9wTmFtZX1faGFuZGxlYCxcbiAgICAgICAgICAgIGNoYW5nZTogYF9fJHtwcm9wTmFtZX1faGFuZGxlX2NoYW5nZWAsXG4gICAgICAgICAgICBkZXRhdGNoOiBgX18ke3Byb3BOYW1lfV9kZXRhdGNoYCxcbiAgICAgICAgICAgIGF0dGF0Y2g6IGBfXyR7cHJvcE5hbWV9X2F0dGF0Y2hgLFxuICAgICAgICAgICAgY2hlY2s6IGBfXyR7cHJvcE5hbWV9X2NoZWNrYFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkVG9JbnN0YW5jZSAob2JqZWN0LCBwcm9wTmFtZSkge1xuICAgICAgICBjb25zdCBwID0gcHJvcG5hbWVzKHByb3BOYW1lKVxuICAgICAgICBvYmplY3RbcC5wcm9wXSA9IHVuZGVmaW5lZFxuICAgICAgICBvYmplY3RbcC5pbml0XSA9IGZhbHNlO1xuICAgICAgICBvYmplY3RbcC5oYW5kbGVdID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlIChfcHJvdG90eXBlLCBwcm9wTmFtZSwgb3B0aW9ucz17fSkge1xuXG4gICAgICAgIGNvbnN0IHAgPSBwcm9wbmFtZXMocHJvcE5hbWUpXG5cbiAgICAgICAgZnVuY3Rpb24gZGV0YXRjaCgpIHtcbiAgICAgICAgICAgIC8vIHVuc3Vic2NyaWJlIGZyb20gc291cmNlIGNoYW5nZSBldmVudFxuICAgICAgICAgICAgbGV0IHttdXRhYmxlPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgICAgICAgICBpZiAobXV0YWJsZSAmJiB0aGlzW3AucHJvcF0pIHtcbiAgICAgICAgICAgICAgICBsZXQgaGFuZGxlID0gdGhpc1twLmhhbmRsZV07XG4gICAgICAgICAgICAgICAgdGhpc1twLnByb3BdLnJlbW92ZV9jYWxsYmFjayhoYW5kbGUpO1xuICAgICAgICAgICAgICAgIHRoaXNbcC5oYW5kbGVdID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpc1twLnByb3BdID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIGZ1bmN0aW9uIGF0dGF0Y2goc291cmNlKSB7XG4gICAgICAgICAgICBsZXQge211dGFibGU9ZmFsc2V9ID0gb3B0aW9ucztcbiAgICAgICAgICAgIGlmICghdGhpc1twLmluaXRdIHx8IG11dGFibGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzW3AucHJvcF0gPSBzb3VyY2U7XG4gICAgICAgICAgICAgICAgdGhpc1twLmluaXRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAvLyBzdWJzY3JpYmUgdG8gY2FsbGJhY2sgZnJvbSBzb3VyY2VcbiAgICAgICAgICAgICAgICBpZiAodGhpc1twLmNoYW5nZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IHRoaXNbcC5jaGFuZ2VdLmJpbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbcC5oYW5kbGVdID0gc291cmNlLmFkZF9jYWxsYmFjayhoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlcigpOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtwcm9wTmFtZX0gY2FuIG5vdCBiZSByZWFzc2lnbmVkYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogXG4gICAgICAgICAqIG9iamVjdCBtdXN0IGltcGxlbWVudFxuICAgICAgICAgKiBfX3twcm9wTmFtZX1faGFuZGxlX2NoYW5nZSgpIHt9XG4gICAgICAgICAqIFxuICAgICAgICAgKiBvYmplY3QgY2FuIGltcGxlbWVudFxuICAgICAgICAgKiBfX3twcm9wTmFtZX1fY2hlY2soc291cmNlKSB7fVxuICAgICAgICAgKi9cblxuICAgICAgICAvLyBnZXR0ZXIgYW5kIHNldHRlclxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoX3Byb3RvdHlwZSwgcHJvcE5hbWUsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzW3AucHJvcF07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAoc3JjKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXNbcC5jaGVja10pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1twLmNoZWNrXShzcmMpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzcmMgIT0gdGhpc1twLnByb3BdKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbcC5kZXRhdGNoXSgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzW3AuYXR0YXRjaF0oc3JjKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgYXBpID0ge307XG4gICAgICAgIGFwaVtwLmRldGF0Y2hdID0gZGV0YXRjaDtcbiAgICAgICAgYXBpW3AuYXR0YXRjaF0gPSBhdHRhdGNoO1xuXG4gICAgICAgIE9iamVjdC5hc3NpZ24oX3Byb3RvdHlwZSwgYXBpKTtcbiAgICB9XG4gICAgcmV0dXJuIHthZGRUb0luc3RhbmNlLCBhZGRUb1Byb3RvdHlwZX07XG59KCk7XG5cbiIsImltcG9ydCB7ZGl2bW9kfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5cbi8qXG4gICAgVGltZW91dCBNb25pdG9yXG5cbiAgICBUaW1lb3V0IE1vbml0b3IgaXMgc2ltaWxhciB0byBzZXRJbnRlcnZhbCwgaW4gdGhlIHNlbnNlIHRoYXQgXG4gICAgaXQgYWxsb3dzIGNhbGxiYWNrcyB0byBiZSBmaXJlZCBwZXJpb2RpY2FsbHkgXG4gICAgd2l0aCBhIGdpdmVuIGRlbGF5IChpbiBtaWxsaXMpLiAgXG4gICAgXG4gICAgVGltZW91dCBNb25pdG9yIGlzIG1hZGUgdG8gc2FtcGxlIHRoZSBzdGF0ZSBcbiAgICBvZiBhIGR5bmFtaWMgb2JqZWN0LCBwZXJpb2RpY2FsbHkuIEZvciB0aGlzIHJlYXNvbiwgZWFjaCBjYWxsYmFjayBpcyBcbiAgICBib3VuZCB0byBhIG1vbml0b3JlZCBvYmplY3QsIHdoaWNoIHdlIGhlcmUgY2FsbCBhIHZhcmlhYmxlLiBcbiAgICBPbiBlYWNoIGludm9jYXRpb24sIGEgY2FsbGJhY2sgd2lsbCBwcm92aWRlIGEgZnJlc2hseSBzYW1wbGVkIFxuICAgIHZhbHVlIGZyb20gdGhlIHZhcmlhYmxlLlxuXG4gICAgVGhpcyB2YWx1ZSBpcyBhc3N1bWVkIHRvIGJlIGF2YWlsYWJsZSBieSBxdWVyeWluZyB0aGUgdmFyaWFibGUuIFxuXG4gICAgICAgIHYucXVlcnkoKSAtPiB7dmFsdWUsIGR5bmFtaWMsIG9mZnNldCwgdHN9XG5cbiAgICBJbiBhZGRpdGlvbiwgdGhlIHZhcmlhYmxlIG9iamVjdCBtYXkgc3dpdGNoIGJhY2sgYW5kIFxuICAgIGZvcnRoIGJldHdlZW4gZHluYW1pYyBhbmQgc3RhdGljIGJlaGF2aW9yLiBUaGUgVGltZW91dCBNb25pdG9yXG4gICAgdHVybnMgcG9sbGluZyBvZmYgd2hlbiB0aGUgdmFyaWFibGUgaXMgbm8gbG9uZ2VyIGR5bmFtaWMsIFxuICAgIGFuZCByZXN1bWVzIHBvbGxpbmcgd2hlbiB0aGUgb2JqZWN0IGJlY29tZXMgZHluYW1pYy5cblxuICAgIFN0YXRlIGNoYW5nZXMgYXJlIGV4cGVjdGVkIHRvIGJlIHNpZ25hbGxlZCB0aHJvdWdoIGEgPGNoYW5nZT4gZXZlbnQuXG5cbiAgICAgICAgc3ViID0gdi5vbihcImNoYW5nZVwiLCBjYWxsYmFjaylcbiAgICAgICAgdi5vZmYoc3ViKVxuXG4gICAgQ2FsbGJhY2tzIGFyZSBpbnZva2VkIG9uIGV2ZXJ5IDxjaGFuZ2U+IGV2ZW50LCBhcyB3ZWxsXG4gICAgYXMgcGVyaW9kaWNhbGx5IHdoZW4gdGhlIG9iamVjdCBpcyBpbiA8ZHluYW1pYz4gc3RhdGUuXG5cbiAgICAgICAgY2FsbGJhY2soe3ZhbHVlLCBkeW5hbWljLCBvZmZzZXQsIHRzfSlcblxuICAgIEZ1cnRoZXJtb3JlLCBpbiBvcmRlciB0byBzdXBwb3J0IGNvbnNpc3RlbnQgcmVuZGVyaW5nIG9mXG4gICAgc3RhdGUgY2hhbmdlcyBmcm9tIG1hbnkgZHluYW1pYyB2YXJpYWJsZXMsIGl0IGlzIGltcG9ydGFudCB0aGF0XG4gICAgY2FsbGJhY2tzIGFyZSBpbnZva2VkIGF0IHRoZSBzYW1lIHRpbWUgYXMgbXVjaCBhcyBwb3NzaWJsZSwgc29cbiAgICB0aGF0IGNoYW5nZXMgdGhhdCBvY2N1ciBuZWFyIGluIHRpbWUgY2FuIGJlIHBhcnQgb2YgdGhlIHNhbWVcbiAgICBzY3JlZW4gcmVmcmVzaC4gXG5cbiAgICBGb3IgdGhpcyByZWFzb24sIHRoZSBUaW1lb3V0TW9uaXRvciBncm91cHMgY2FsbGJhY2tzIGluIHRpbWVcbiAgICBhbmQgaW52b2tlcyBjYWxsYmFja3MgYXQgYXQgZml4ZWQgbWF4aW11bSByYXRlICgyMEh6LzUwbXMpLlxuICAgIFRoaXMgaW1wbGllcyB0aGF0IHBvbGxpbmcgY2FsbGJhY2tzIHdpbGwgZmFsbCBvbiBhIHNoYXJlZCBcbiAgICBwb2xsaW5nIGZyZXF1ZW5jeS5cblxuICAgIEF0IHRoZSBzYW1lIHRpbWUsIGNhbGxiYWNrcyBtYXkgaGF2ZSBpbmRpdmlkdWFsIGZyZXF1ZW5jaWVzIHRoYXRcbiAgICBhcmUgbXVjaCBsb3dlciByYXRlIHRoYW4gdGhlIG1heGltdW0gcmF0ZS4gVGhlIGltcGxlbWVudGF0aW9uXG4gICAgZG9lcyBub3QgcmVseSBvbiBhIGZpeGVkIDUwbXMgdGltZW91dCBmcmVxdWVuY3ksIGJ1dCBpcyB0aW1lb3V0IGJhc2VkLFxuICAgIHRodXMgdGhlcmUgaXMgbm8gcHJvY2Vzc2luZyBvciB0aW1lb3V0IGJldHdlZW4gY2FsbGJhY2tzLCBldmVuXG4gICAgaWYgYWxsIGNhbGxiYWNrcyBoYXZlIGxvdyByYXRlcy5cblxuICAgIEl0IGlzIHNhZmUgdG8gZGVmaW5lIG11bHRpcGxlIGNhbGxhYmFja3MgZm9yIGEgc2luZ2xlIHZhcmlhYmxlLCBlYWNoXG4gICAgY2FsbGJhY2sgd2l0aCBhIGRpZmZlcmVudCBwb2xsaW5nIGZyZXF1ZW5jeS5cblxuICAgIG9wdGlvbnNcbiAgICAgICAgPHJhdGU+IC0gZGVmYXVsdCA1MDogc3BlY2lmeSBtaW5pbXVtIGZyZXF1ZW5jeSBpbiBtc1xuXG4qL1xuXG5cbmNvbnN0IFJBVEVfTVMgPSA1MFxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBUSU1FT1VUIE1PTklUT1JcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBCYXNlIGNsYXNzIGZvciBUaW1lb3V0IE1vbml0b3IgYW5kIEZyYW1lcmF0ZSBNb25pdG9yXG4qL1xuXG5jbGFzcyBUaW1lb3V0TW9uaXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG5cbiAgICAgICAgdGhpcy5fb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe3JhdGU6IFJBVEVfTVN9LCBvcHRpb25zKTtcbiAgICAgICAgaWYgKHRoaXMuX29wdGlvbnMucmF0ZSA8IFJBVEVfTVMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgaWxsZWdhbCByYXRlICR7cmF0ZX0sIG1pbmltdW0gcmF0ZSBpcyAke1JBVEVfTVN9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLypcbiAgICAgICAgICAgIG1hcFxuICAgICAgICAgICAgaGFuZGxlIC0+IHtjYWxsYmFjaywgdmFyaWFibGUsIGRlbGF5fVxuICAgICAgICAgICAgLSB2YXJpYWJsZTogdGFyZ2V0IGZvciBzYW1wbGluZ1xuICAgICAgICAgICAgLSBjYWxsYmFjazogZnVuY3Rpb24odmFsdWUpXG4gICAgICAgICAgICAtIGRlbGF5OiBiZXR3ZWVuIHNhbXBsZXMgKHdoZW4gdmFyaWFibGUgaXMgZHluYW1pYylcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2V0ID0gbmV3IFNldCgpO1xuICAgICAgICAvKlxuICAgICAgICAgICAgdmFyaWFibGUgbWFwXG4gICAgICAgICAgICB2YXJpYWJsZSAtPiB7c3ViLCBwb2xsaW5nLCBoYW5kbGVzOltdfVxuICAgICAgICAgICAgLSBzdWIgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgICAgICAgICAtIHBvbGxpbmc6IHRydWUgaWYgdmFyaWFibGUgbmVlZHMgcG9sbGluZ1xuICAgICAgICAgICAgLSBoYW5kbGVzOiBsaXN0IG9mIGhhbmRsZXMgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgICAgICovXG4gICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgLy8gdmFyaWFibGUgY2hhbmdlIGhhbmRsZXJcbiAgICAgICAgdGhpcy5fX29udmFyaWFibGVjaGFuZ2UgPSB0aGlzLl9vbnZhcmlhYmxlY2hhbmdlLmJpbmQodGhpcyk7XG4gICAgfVxuXG4gICAgYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIC8vIHJlZ2lzdGVyIGJpbmRpbmdcbiAgICAgICAgbGV0IGhhbmRsZSA9IHtjYWxsYmFjaywgdmFyaWFibGUsIGRlbGF5fTtcbiAgICAgICAgdGhpcy5fc2V0LmFkZChoYW5kbGUpO1xuICAgICAgICAvLyByZWdpc3RlciB2YXJpYWJsZVxuICAgICAgICBpZiAoIXRoaXMuX3ZhcmlhYmxlX21hcC5oYXModmFyaWFibGUpKSB7XG4gICAgICAgICAgICBsZXQgc3ViID0gdmFyaWFibGUub24oXCJjaGFuZ2VcIiwgdGhpcy5fX29udmFyaWFibGVjaGFuZ2UpO1xuICAgICAgICAgICAgbGV0IGl0ZW0gPSB7c3ViLCBwb2xsaW5nOmZhbHNlLCBoYW5kbGVzOiBbaGFuZGxlXX07XG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuc2V0KHZhcmlhYmxlLCBpdGVtKTtcbiAgICAgICAgICAgIC8vdGhpcy5fcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpLmhhbmRsZXMucHVzaChoYW5kbGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBoYW5kbGU7XG4gICAgfVxuXG4gICAgcmVsZWFzZShoYW5kbGUpIHtcbiAgICAgICAgLy8gY2xlYW51cFxuICAgICAgICBsZXQgcmVtb3ZlZCA9IHRoaXMuX3NldC5kZWxldGUoaGFuZGxlKTtcbiAgICAgICAgaWYgKCFyZW1vdmVkKSByZXR1cm47XG4gICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNsZWFudXAgdmFyaWFibGUgbWFwXG4gICAgICAgIGxldCB2YXJpYWJsZSA9IGhhbmRsZS52YXJpYWJsZTtcbiAgICAgICAgbGV0IHtzdWIsIGhhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCBpZHggPSBoYW5kbGVzLmluZGV4T2YoaGFuZGxlKTtcbiAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICBoYW5kbGVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChoYW5kbGVzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAvLyB2YXJpYWJsZSBoYXMgbm8gaGFuZGxlc1xuICAgICAgICAgICAgLy8gY2xlYW51cCB2YXJpYWJsZSBtYXBcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5kZWxldGUodmFyaWFibGUpO1xuICAgICAgICAgICAgdmFyaWFibGUub2ZmKHN1Yik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICB2YXJpYWJsZSBlbWl0cyBhIGNoYW5nZSBldmVudFxuICAgICovXG4gICAgX29udmFyaWFibGVjaGFuZ2UgKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIGxldCB2YXJpYWJsZSA9IGVJbmZvLnNyYztcbiAgICAgICAgLy8gZGlyZWN0IGNhbGxiYWNrIC0gY291bGQgdXNlIGVBcmcgaGVyZVxuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCBzdGF0ZSA9IGVBcmc7XG4gICAgICAgIC8vIHJlZXZhbHVhdGUgcG9sbGluZ1xuICAgICAgICB0aGlzLl9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUsIHN0YXRlKTtcbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICBoYW5kbGUuY2FsbGJhY2soc3RhdGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgc3RhcnQgb3Igc3RvcCBwb2xsaW5nIGlmIG5lZWRlZFxuICAgICovXG4gICAgX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSwgc3RhdGUpIHtcbiAgICAgICAgbGV0IGl0ZW0gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IHtwb2xsaW5nOndhc19wb2xsaW5nfSA9IGl0ZW07XG4gICAgICAgIHN0YXRlID0gc3RhdGUgfHwgdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgbGV0IHNob3VsZF9iZV9wb2xsaW5nID0gc3RhdGUuZHluYW1pYztcbiAgICAgICAgaWYgKCF3YXNfcG9sbGluZyAmJiBzaG91bGRfYmVfcG9sbGluZykge1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0cyh2YXJpYWJsZSk7XG4gICAgICAgIH0gZWxzZSBpZiAod2FzX3BvbGxpbmcgJiYgIXNob3VsZF9iZV9wb2xsaW5nKSB7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHNldCB0aW1lb3V0IGZvciBhbGwgY2FsbGJhY2tzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICovXG4gICAgX3NldF90aW1lb3V0cyh2YXJpYWJsZSkge1xuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3NldF90aW1lb3V0KGhhbmRsZSkge1xuICAgICAgICBsZXQgZGVsdGEgPSB0aGlzLl9jYWxjdWxhdGVfZGVsdGEoaGFuZGxlLmRlbGF5KTtcbiAgICAgICAgbGV0IGhhbmRsZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLl9oYW5kbGVfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIGhhbmRsZS50aWQgPSBzZXRUaW1lb3V0KGhhbmRsZXIsIGRlbHRhKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBhZGp1c3QgZGVsYXkgc28gdGhhdCBpZiBmYWxscyBvblxuICAgICAgICB0aGUgbWFpbiB0aWNrIHJhdGVcbiAgICAqL1xuICAgIF9jYWxjdWxhdGVfZGVsdGEoZGVsYXkpIHtcbiAgICAgICAgbGV0IHJhdGUgPSB0aGlzLl9vcHRpb25zLnJhdGU7XG4gICAgICAgIGxldCBub3cgPSBNYXRoLnJvdW5kKHBlcmZvcm1hbmNlLm5vdygpKTtcbiAgICAgICAgbGV0IFtub3dfbiwgbm93X3JdID0gZGl2bW9kKG5vdywgcmF0ZSk7XG4gICAgICAgIGxldCBbbiwgcl0gPSBkaXZtb2Qobm93ICsgZGVsYXksIHJhdGUpO1xuICAgICAgICBsZXQgdGFyZ2V0ID0gTWF0aC5tYXgobiwgbm93X24gKyAxKSpyYXRlO1xuICAgICAgICByZXR1cm4gdGFyZ2V0IC0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgY2xlYXIgYWxsIHRpbWVvdXRzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICovXG4gICAgX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKSB7XG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIGlmIChoYW5kbGUudGlkICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dChoYW5kbGUudGlkKTtcbiAgICAgICAgICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgaGFuZGxlIHRpbWVvdXRcbiAgICAqL1xuICAgIF9oYW5kbGVfdGltZW91dChoYW5kbGUpIHtcbiAgICAgICAgLy8gZHJvcCBpZiBoYW5kbGUgdGlkIGhhcyBiZWVuIGNsZWFyZWRcbiAgICAgICAgaWYgKGhhbmRsZS50aWQgPT0gdW5kZWZpbmVkKSByZXR1cm47XG4gICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhbGxiYWNrXG4gICAgICAgIGxldCB7dmFyaWFibGV9ID0gaGFuZGxlO1xuICAgICAgICBsZXQgc3RhdGUgPSB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICAvLyByZXNjaGVkdWxlIHRpbWVvdXRzIGZvciBjYWxsYmFja3NcbiAgICAgICAgaWYgKHN0YXRlLmR5bmFtaWMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvKlxuICAgICAgICAgICAgICAgIG1ha2Ugc3VyZSBwb2xsaW5nIHN0YXRlIGlzIGFsc28gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzIHdvdWxkIG9ubHkgb2NjdXIgaWYgdGhlIHZhcmlhYmxlXG4gICAgICAgICAgICAgICAgd2VudCBmcm9tIHJlcG9ydGluZyBkeW5hbWljIHRydWUgdG8gZHluYW1pYyBmYWxzZSxcbiAgICAgICAgICAgICAgICB3aXRob3V0IGVtbWl0dGluZyBhIGNoYW5nZSBldmVudCAtIHRodXNcbiAgICAgICAgICAgICAgICB2aW9sYXRpbmcgdGhlIGFzc3VtcHRpb24uIFRoaXMgcHJlc2VydmVzXG4gICAgICAgICAgICAgICAgaW50ZXJuYWwgaW50ZWdyaXR5IGkgdGhlIG1vbml0b3IuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgbGV0IGl0ZW0gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIC8vXG4gICAgICAgIGhhbmRsZS5jYWxsYmFjayhzdGF0ZSk7XG4gICAgfVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEZSQU1FUkFURSBNT05JVE9SXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuY2xhc3MgRnJhbWVyYXRlTW9uaXRvciBleHRlbmRzIFRpbWVvdXRNb25pdG9yIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICAgIHRoaXMuX2hhbmRsZTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICB0aW1lb3V0cyBhcmUgb2Jzb2xldGVcbiAgICAqL1xuICAgIF9zZXRfdGltZW91dHModmFyaWFibGUpIHt9XG4gICAgX3NldF90aW1lb3V0KGhhbmRsZSkge31cbiAgICBfY2FsY3VsYXRlX2RlbHRhKGRlbGF5KSB7fVxuICAgIF9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSkge31cbiAgICBfaGFuZGxlX3RpbWVvdXQoaGFuZGxlKSB7fVxuXG4gICAgX29udmFyaWFibGVjaGFuZ2UgKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIHN1cGVyLl9vbnZhcmlhYmxlY2hhbmdlKGVBcmcsIGVJbmZvKTtcbiAgICAgICAgLy8ga2ljayBvZmYgY2FsbGJhY2sgbG9vcCBkcml2ZW4gYnkgcmVxdWVzdCBhbmltYXRpb25mcmFtZVxuICAgICAgICB0aGlzLl9jYWxsYmFjaygpO1xuICAgIH1cblxuICAgIF9jYWxsYmFjaygpIHtcbiAgICAgICAgLy8gY2FsbGJhY2sgdG8gYWxsIHZhcmlhYmxlcyB3aGljaCByZXF1aXJlIHBvbGxpbmdcbiAgICAgICAgbGV0IHZhcmlhYmxlcyA9IFsuLi50aGlzLl92YXJpYWJsZV9tYXAuZW50cmllcygpXVxuICAgICAgICAgICAgLmZpbHRlcigoW3ZhcmlhYmxlLCBpdGVtXSkgPT4gaXRlbS5wb2xsaW5nKVxuICAgICAgICAgICAgLm1hcCgoW3ZhcmlhYmxlLCBpdGVtXSkgPT4gdmFyaWFibGUpO1xuICAgICAgICBpZiAodmFyaWFibGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIGNhbGxiYWNrXG4gICAgICAgICAgICBmb3IgKGxldCB2YXJpYWJsZSBvZiB2YXJpYWJsZXMpIHtcbiAgICAgICAgICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgICAgICAgICAgbGV0IHJlcyA9IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHJlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogXG4gICAgICAgICAgICAgICAgcmVxdWVzdCBuZXh0IGNhbGxiYWNrIGFzIGxvbmcgYXMgYXQgbGVhc3Qgb25lIHZhcmlhYmxlIFxuICAgICAgICAgICAgICAgIGlzIHJlcXVpcmluZyBwb2xsaW5nXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMuX2NhbGxiYWNrLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBCSU5EIFJFTEVBU0VcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuY29uc3QgbW9uaXRvciA9IG5ldyBUaW1lb3V0TW9uaXRvcigpO1xuY29uc3QgZnJhbWVyYXRlX21vbml0b3IgPSBuZXcgRnJhbWVyYXRlTW9uaXRvcigpO1xuXG5leHBvcnQgZnVuY3Rpb24gYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgbGV0IGhhbmRsZTtcbiAgICBpZiAoQm9vbGVhbihwYXJzZUZsb2F0KGRlbGF5KSkpIHtcbiAgICAgICAgaGFuZGxlID0gbW9uaXRvci5iaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gW1widGltZW91dFwiLCBoYW5kbGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGhhbmRsZSA9IGZyYW1lcmF0ZV9tb25pdG9yLmJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCAwLCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIFtcImZyYW1lcmF0ZVwiLCBoYW5kbGVdO1xuICAgIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiByZWxlYXNlKGhhbmRsZSkge1xuICAgIGxldCBbdHlwZSwgX2hhbmRsZV0gPSBoYW5kbGU7XG4gICAgaWYgKHR5cGUgPT0gXCJ0aW1lb3V0XCIpIHtcbiAgICAgICAgcmV0dXJuIG1vbml0b3IucmVsZWFzZShfaGFuZGxlKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJmcmFtZXJhdGVcIikge1xuICAgICAgICByZXR1cm4gZnJhbWVyYXRlX21vbml0b3IucmVsZWFzZShfaGFuZGxlKTtcbiAgICB9XG59XG5cbiIsImltcG9ydCB7IGV2ZW50aWZ5IH0gZnJvbSBcIi4vZXZlbnRpZnkuanNcIjtcbmltcG9ydCB7IGNhbGxiYWNrIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgYmluZCwgcmVsZWFzZSB9IGZyb20gXCIuL21vbml0b3IuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU1RBVEUgUFJPVklERVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBCYXNlIGNsYXNzIGZvciBhbGwgc3RhdGUgcHJvdmlkZXJzXG5cbiAgICAtIG9iamVjdCB3aXRoIGNvbGxlY3Rpb24gb2YgaXRlbXNcbiAgICAtIGNvdWxkIGJlIGxvY2FsIC0gb3IgcHJveHkgdG8gb25saW5lIHNvdXJjZVxuXG4gICAgcmVwcmVzZW50cyBhIGR5bmFtaWMgY29sbGVjdGlvbiBvZiBpdGVtc1xuICAgIHtpdHYsIHR5cGUsIC4uLmRhdGF9XG4qL1xuXG5leHBvcnQgY2xhc3MgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuXG4gICAgLy8gcHVibGljIHVwZGF0ZSBmdW5jdGlvblxuICAgIHVwZGF0ZShpdGVtcyl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICBnZXQgaXRlbXMoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICBnZXQgaW5mbyAoKSB7XG4gICAgICAgIHJldHVybiB7ZHluYW1pYzogdHJ1ZSwgb3ZlcmxhcHBpbmc6IHRydWUsIGxvY2FsOmZhbHNlfTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShTdGF0ZVByb3ZpZGVyQmFzZS5wcm90b3R5cGUpO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExBWUVSIEJBU0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBMYXllckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBRVUVSWVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgcXVlcnkgKG9mZnNldCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoTGF5ZXJCYXNlLnByb3RvdHlwZSk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ1VSU09SIEJBU0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBDdXJzb3JCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgLy8gZGVmaW5lIGNoYW5nZSBldmVudFxuICAgICAgICBldmVudGlmeS5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcbiAgICB9XG4gICAgXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBRVUVSWVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgcXVlcnkgKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgRXZlbnRpZnk6IGltbWVkaWF0ZSBldmVudHNcbiAgICAqL1xuICAgIGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG4gICAgICAgIGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBbdGhpcy5xdWVyeSgpXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogQklORCBSRUxFQVNFIChjb252ZW5pZW5jZSlcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGJpbmQoY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHJldHVybiBiaW5kKHRoaXMsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgICAgIHJldHVybiByZWxlYXNlKGhhbmRsZSk7XG4gICAgfVxuXG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShDdXJzb3JCYXNlLnByb3RvdHlwZSk7XG5ldmVudGlmeS5hZGRUb1Byb3RvdHlwZShDdXJzb3JCYXNlLnByb3RvdHlwZSk7XG5cbiIsIi8qXG4gICAgXG4gICAgSU5URVJWQUwgRU5EUE9JTlRTXG5cbiAgICAqIGludGVydmFsIGVuZHBvaW50cyBhcmUgZGVmaW5lZCBieSBbdmFsdWUsIHNpZ25dLCBmb3IgZXhhbXBsZVxuICAgICogXG4gICAgKiA0KSAtPiBbNCwtMV0gLSBlbmRwb2ludCBpcyBvbiB0aGUgbGVmdCBvZiA0XG4gICAgKiBbNCwgNCwgNF0gLT4gWzQsIDBdIC0gZW5kcG9pbnQgaXMgYXQgNCBcbiAgICAqICg0IC0+IFs0LCAxXSAtIGVuZHBvaW50IGlzIG9uIHRoZSByaWdodCBvZiA0KVxuICAgICogXG4gICAgKiBUaGlzIHJlcHJlc2VudGF0aW9uIGVuc3VyZXMgdGhhdCB0aGUgaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBvcmRlcmVkIGFuZCBhbGxvd3NcbiAgICAqIGludGVydmFscyB0byBiZSBleGNsdXNpdmUgb3IgaW5jbHVzaXZlLCB5ZXQgY292ZXIgdGhlIGVudGlyZSByZWFsIGxpbmUgXG4gICAgKiBcbiAgICAqIFthLGJdLCAoYSxiKSwgW2EsYiksIFthLCBiKSBhcmUgYWxsIHZhbGlkIGludGVydmFsc1xuXG4qL1xuXG4vKlxuICAgIEVuZHBvaW50IGNvbXBhcmlzb25cbiAgICByZXR1cm5zIFxuICAgICAgICAtIG5lZ2F0aXZlIDogY29ycmVjdCBvcmRlclxuICAgICAgICAtIDAgOiBlcXVhbFxuICAgICAgICAtIHBvc2l0aXZlIDogd3Jvbmcgb3JkZXJcblxuXG4gICAgTk9URSBcbiAgICAtIGNtcCg0XSxbNCApID09IDAgLSBzaW5jZSB0aGVzZSBhcmUgdGhlIHNhbWUgd2l0aCByZXNwZWN0IHRvIHNvcnRpbmdcbiAgICAtIGJ1dCBpZiB5b3Ugd2FudCB0byBzZWUgaWYgdHdvIGludGVydmFscyBhcmUgb3ZlcmxhcHBpbmcgaW4gdGhlIGVuZHBvaW50c1xuICAgIGNtcChoaWdoX2EsIGxvd19iKSA+IDAgdGhpcyB3aWxsIG5vdCBiZSBnb29kXG4gICAgXG4qLyBcblxuXG5mdW5jdGlvbiBjbXBOdW1iZXJzKGEsIGIpIHtcbiAgICBpZiAoYSA9PT0gYikgcmV0dXJuIDA7XG4gICAgaWYgKGEgPT09IEluZmluaXR5KSByZXR1cm4gMTtcbiAgICBpZiAoYiA9PT0gSW5maW5pdHkpIHJldHVybiAtMTtcbiAgICBpZiAoYSA9PT0gLUluZmluaXR5KSByZXR1cm4gLTE7XG4gICAgaWYgKGIgPT09IC1JbmZpbml0eSkgcmV0dXJuIDE7XG4gICAgcmV0dXJuIGEgLSBiO1xuICB9XG5cbmZ1bmN0aW9uIGVuZHBvaW50X2NtcCAocDEsIHAyKSB7XG4gICAgbGV0IFt2MSwgczFdID0gcDE7XG4gICAgbGV0IFt2MiwgczJdID0gcDI7XG4gICAgbGV0IGRpZmYgPSBjbXBOdW1iZXJzKHYxLCB2Mik7XG4gICAgcmV0dXJuIChkaWZmICE9IDApID8gZGlmZiA6IHMxIC0gczI7XG59XG5cbmZ1bmN0aW9uIGVuZHBvaW50X2x0IChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPCAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9sZSAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpIDw9IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2d0IChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPiAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9nZSAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpID49IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2VxIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPT0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfbWluKHAxLCBwMikge1xuICAgIHJldHVybiAoZW5kcG9pbnRfbGUocDEsIHAyKSkgPyBwMSA6IHAyO1xufVxuZnVuY3Rpb24gZW5kcG9pbnRfbWF4KHAxLCBwMikge1xuICAgIHJldHVybiAoZW5kcG9pbnRfZ2UocDEsIHAyKSkgPyBwMSA6IHAyO1xufVxuXG4vKipcbiAqIGZsaXAgZW5kcG9pbnQgdG8gdGhlIG90aGVyIHNpZGVcbiAqIFxuICogdXNlZnVsIGZvciBtYWtpbmcgYmFjay10by1iYWNrIGludGVydmFscyBcbiAqIFxuICogaGlnaCkgPC0+IFtsb3dcbiAqIGhpZ2hdIDwtPiAobG93XG4gKi9cblxuZnVuY3Rpb24gZW5kcG9pbnRfZmxpcChwLCB0YXJnZXQpIHtcbiAgICBsZXQgW3Ysc10gPSBwO1xuICAgIGlmICh0YXJnZXQgPT0gXCJsb3dcIikge1xuICAgIFx0Ly8gYXNzdW1lIHBvaW50IGlzIGhpZ2g6IHNpZ24gbXVzdCBiZSAtMSBvciAwXG4gICAgXHRpZiAocyA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcImVuZHBvaW50IGlzIGFscmVhZHkgbG93XCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcysxXTtcbiAgICB9IGVsc2UgaWYgKHRhcmdldCA9PSBcImhpZ2hcIikge1xuXHRcdC8vIGFzc3VtZSBwb2ludCBpcyBsb3c6IHNpZ24gaXMgMCBvciAxXG4gICAgXHRpZiAocyA8IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcImVuZHBvaW50IGlzIGFscmVhZHkgaGlnaFwiKTsgICAgXHRcdFxuICAgIFx0fVxuICAgICAgICBwID0gW3YsIHMtMV07XG4gICAgfSBlbHNlIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgdHlwZVwiLCB0YXJnZXQpO1xuICAgIH1cbiAgICByZXR1cm4gcDtcbn1cblxuXG4vKlxuICAgIHJldHVybnMgbG93IGFuZCBoaWdoIGVuZHBvaW50cyBmcm9tIGludGVydmFsXG4qL1xuZnVuY3Rpb24gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KSB7XG4gICAgbGV0IFtsb3csIGhpZ2gsIGxvd0Nsb3NlZCwgaGlnaENsb3NlZF0gPSBpdHY7XG4gICAgbGV0IGxvd19wID0gKGxvd0Nsb3NlZCkgPyBbbG93LCAwXSA6IFtsb3csIDFdOyBcbiAgICBsZXQgaGlnaF9wID0gKGhpZ2hDbG9zZWQpID8gW2hpZ2gsIDBdIDogW2hpZ2gsIC0xXTtcbiAgICByZXR1cm4gW2xvd19wLCBoaWdoX3BdO1xufVxuXG5cbi8qXG4gICAgSU5URVJWQUxTXG5cbiAgICBJbnRlcnZhbHMgYXJlIFtsb3csIGhpZ2gsIGxvd0Nsb3NlZCwgaGlnaENsb3NlZF1cblxuKi8gXG5cbi8qXG4gICAgcmV0dXJuIHRydWUgaWYgcG9pbnQgcCBpcyBjb3ZlcmVkIGJ5IGludGVydmFsIGl0dlxuICAgIHBvaW50IHAgY2FuIGJlIG51bWJlciBwIG9yIGEgcG9pbnQgW3Asc11cblxuICAgIGltcGxlbWVudGVkIGJ5IGNvbXBhcmluZyBwb2ludHNcbiAgICBleGNlcHRpb24gaWYgaW50ZXJ2YWwgaXMgbm90IGRlZmluZWRcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBwKSB7XG4gICAgbGV0IFtsb3dfcCwgaGlnaF9wXSA9IGVuZHBvaW50c19mcm9tX2ludGVydmFsKGl0dik7XG4gICAgLy8gY292ZXJzOiBsb3cgPD0gcCA8PSBoaWdoXG4gICAgcmV0dXJuIGVuZHBvaW50X2xlKGxvd19wLCBwKSAmJiBlbmRwb2ludF9sZShwLCBoaWdoX3ApO1xufVxuLy8gY29udmVuaWVuY2VcbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19wb2ludChpdHYsIHApIHtcbiAgICByZXR1cm4gaW50ZXJ2YWxfY292ZXJzX2VuZHBvaW50KGl0diwgW3AsIDBdKTtcbn1cblxuXG5cbi8qXG4gICAgUmV0dXJuIHRydWUgaWYgaW50ZXJ2YWwgaGFzIGxlbmd0aCAwXG4qL1xuZnVuY3Rpb24gaW50ZXJ2YWxfaXNfc2luZ3VsYXIoaW50ZXJ2YWwpIHtcbiAgICByZXR1cm4gaW50ZXJ2YWxbMF0gPT0gaW50ZXJ2YWxbMV1cbn1cblxuLypcbiAgICBDcmVhdGUgaW50ZXJ2YWwgZnJvbSBlbmRwb2ludHNcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyhwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICAvLyBwMSBtdXN0IGJlIGEgbG93IHBvaW50XG4gICAgaWYgKHMxID09IC0xKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgbG93IHBvaW50XCIsIHAxKTtcbiAgICB9XG4gICAgaWYgKHMyID09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdlYWwgaGlnaCBwb2ludFwiLCBwMik7ICAgXG4gICAgfVxuICAgIHJldHVybiBbdjEsIHYyLCAoczE9PTApLCAoczI9PTApXVxufVxuXG5cbmV4cG9ydCBjb25zdCBlbmRwb2ludCA9IHtcbiAgICBsZTogZW5kcG9pbnRfbGUsXG4gICAgbHQ6IGVuZHBvaW50X2x0LFxuICAgIGdlOiBlbmRwb2ludF9nZSxcbiAgICBndDogZW5kcG9pbnRfZ3QsXG4gICAgY21wOiBlbmRwb2ludF9jbXAsXG4gICAgZXE6IGVuZHBvaW50X2VxLFxuICAgIG1pbjogZW5kcG9pbnRfbWluLFxuICAgIG1heDogZW5kcG9pbnRfbWF4LFxuICAgIGZsaXA6IGVuZHBvaW50X2ZsaXAsXG4gICAgZnJvbV9pbnRlcnZhbDogZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWxcbn1cbmV4cG9ydCBjb25zdCBpbnRlcnZhbCA9IHtcbiAgICBjb3ZlcnNfZW5kcG9pbnQ6IGludGVydmFsX2NvdmVyc19lbmRwb2ludCxcbiAgICBjb3ZlcnNfcG9pbnQ6IGludGVydmFsX2NvdmVyc19wb2ludCwgXG4gICAgaXNfc2luZ3VsYXI6IGludGVydmFsX2lzX3Npbmd1bGFyLFxuICAgIGZyb21fZW5kcG9pbnRzOiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50c1xufVxuIiwiaW1wb3J0IHtTdGF0ZVByb3ZpZGVyQmFzZX0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7ZW5kcG9pbnR9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU0lNUExFIFNUQVRFIFBST1ZJREVSIChMT0NBTClcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMb2NhbCBBcnJheSB3aXRoIG5vbi1vdmVybGFwcGluZyBpdGVtcy5cbiAqL1xuXG5leHBvcnQgY2xhc3MgU2ltcGxlU3RhdGVQcm92aWRlciBleHRlbmRzIFN0YXRlUHJvdmlkZXJCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLy8gaW5pdGlhbGl6YXRpb25cbiAgICAgICAgbGV0IHtpdGVtcywgdmFsdWV9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKGl0ZW1zICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5faXRlbXMgPSBjaGVja19pbnB1dChpdGVtcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9pdGVtcyA9IFt7aXR2OlstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSwgYXJnczp7dmFsdWV9fV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9pdGVtcyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIC8vIG5vdGlmeSBjYWxsYmFja3M/XG4gICAgfVxuXG4gICAgdXBkYXRlIChpdGVtcykge1xuICAgICAgICB0aGlzLl9pdGVtcyA9IGNoZWNrX2lucHV0KGl0ZW1zKTtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXQgaXRlbXMgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXRlbXMuc2xpY2UoKTtcbiAgICB9XG5cbiAgICBnZXQgaW5mbyAoKSB7XG4gICAgICAgIHJldHVybiB7ZHluYW1pYzogdHJ1ZSwgb3ZlcmxhcHBpbmc6IGZhbHNlLCBsb2NhbDp0cnVlfTtcbiAgICB9XG59XG5cblxuZnVuY3Rpb24gY2hlY2tfaW5wdXQoaXRlbXMpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIklucHV0IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgfVxuICAgIC8vIHNvcnQgaXRlbXMgYmFzZWQgb24gaW50ZXJ2YWwgbG93IGVuZHBvaW50XG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBsZXQgYV9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGEuaXR2KVswXTtcbiAgICAgICAgbGV0IGJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChiLml0dilbMF07XG4gICAgICAgIHJldHVybiBlbmRwb2ludC5jbXAoYV9sb3csIGJfbG93KTtcbiAgICB9KTtcbiAgICAvLyBjaGVjayB0aGF0IGl0ZW0gaW50ZXJ2YWxzIGFyZSBub24tb3ZlcmxhcHBpbmdcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBwcmV2X2hpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2kgLSAxXS5pdHYpWzFdO1xuICAgICAgICBsZXQgY3Vycl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2ldLml0dilbMF07XG4gICAgICAgIC8vIHZlcmlmeSB0aGF0IHByZXYgaGlnaCBpcyBsZXNzIHRoYXQgY3VyciBsb3dcbiAgICAgICAgaWYgKCFlbmRwb2ludC5sdChwcmV2X2hpZ2gsIGN1cnJfbG93KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT3ZlcmxhcHBpbmcgaW50ZXJ2YWxzIGZvdW5kXCIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuIiwiXG5pbXBvcnQgeyBTdGF0ZVByb3ZpZGVyQmFzZSwgQ3Vyc29yQmFzZSB9IGZyb20gXCIuL2Jhc2VzXCI7XG5jb25zdCBNRVRIT0RTID0ge2Fzc2lnbiwgbW92ZSwgdHJhbnNpdGlvbiwgaW50ZXJwb2xhdGV9O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBjbWQgKHRhcmdldCkge1xuICAgIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIEN1cnNvckJhc2UpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgdGFyZ2V0IG11c3QgYmUgY3Vyc29yICR7dGFyZ2V0fWApO1xuICAgIH1cbiAgICBpZiAoISh0YXJnZXQuc3JjIGluc3RhbmNlb2YgU3RhdGVQcm92aWRlckJhc2UpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgdGFyZ2V0LnNyYyBtdXN0IGJlIHN0YXRlcHJvdmlkZXIgJHt0YXJnZXR9YCk7XG4gICAgfVxuICAgIGxldCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoTUVUSE9EUylcbiAgICAgICAgLm1hcCgoW25hbWUsIG1ldGhvZF0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiguLi5hcmdzKSB7IFxuICAgICAgICAgICAgICAgICAgICBsZXQgaXRlbXMgPSBtZXRob2QuY2FsbCh0aGlzLCB0YXJnZXQsIC4uLmFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGFyZ2V0LnNyYy51cGRhdGUoaXRlbXMpOyAgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcbiAgICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKGVudHJpZXMpO1xufVxuXG5mdW5jdGlvbiBhc3NpZ24odGFyZ2V0LCB2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBpdGVtID0ge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgYXJnczoge3ZhbHVlfSAgICAgICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtpdGVtXTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG1vdmUodGFyZ2V0LCB2ZWN0b3I9e30pIHtcbiAgICBsZXQge3ZhbHVlLCByYXRlLCBvZmZzZXR9ID0gdGFyZ2V0LnF1ZXJ5KCk7XG4gICAgbGV0IHtwb3NpdGlvbj12YWx1ZSwgdmVsb2NpdHk9cmF0ZX0gPSB2ZWN0b3I7XG4gICAgbGV0IGl0ZW0gPSB7XG4gICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICBhcmdzOiB7cG9zaXRpb24sIHZlbG9jaXR5LCB0aW1lc3RhbXA6b2Zmc2V0fSAgICAgICAgICAgICAgICAgXG4gICAgfVxuICAgIHJldHVybiBbaXRlbV07XG59XG5cbmZ1bmN0aW9uIHRyYW5zaXRpb24odGFyZ2V0LCB2MCwgdjEsIHQwLCB0MSwgZWFzaW5nKSB7XG4gICAgbGV0IGl0ZW1zID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIHQwLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgYXJnczoge3ZhbHVlOnYwfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MCwgdDEsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwidHJhbnNpdGlvblwiLFxuICAgICAgICAgICAgYXJnczoge3YwLCB2MSwgdDAsIHQxLCBlYXNpbmd9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgYXJnczoge3ZhbHVlOiB2MX1cbiAgICAgICAgfVxuICAgIF1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKHRhcmdldCwgdHVwbGVzKSB7XG4gICAgbGV0IFt2MCwgdDBdID0gdHVwbGVzWzBdO1xuICAgIGxldCBbdjEsIHQxXSA9IHR1cGxlc1t0dXBsZXMubGVuZ3RoLTFdO1xuXG4gICAgbGV0IGl0ZW1zID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIHQwLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgYXJnczoge3ZhbHVlOnYwfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MCwgdDEsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwiaW50ZXJwb2xhdGlvblwiLFxuICAgICAgICAgICAgYXJnczoge3R1cGxlc31cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDEsIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBhcmdzOiB7dmFsdWU6IHYxfVxuICAgICAgICB9XG4gICAgXSAgICBcbiAgICByZXR1cm4gaXRlbXM7XG59XG5cblxuXG4iLCJpbXBvcnQge2ludGVydmFsfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbkJBU0UgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLypcblx0QWJzdHJhY3QgQmFzZSBDbGFzcyBmb3IgU2VnbWVudHNcblxuICAgIGNvbnN0cnVjdG9yKGludGVydmFsKVxuXG4gICAgLSBpbnRlcnZhbDogaW50ZXJ2YWwgb2YgdmFsaWRpdHkgb2Ygc2VnbWVudFxuICAgIC0gZHluYW1pYzogdHJ1ZSBpZiBzZWdtZW50IGlzIGR5bmFtaWNcbiAgICAtIHZhbHVlKG9mZnNldCk6IHZhbHVlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4gICAgLSBxdWVyeShvZmZzZXQpOiBzdGF0ZSBvZiBzZWdtZW50IGF0IG9mZnNldFxuKi9cblxuZXhwb3J0IGNsYXNzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYpIHtcblx0XHR0aGlzLl9pdHYgPSBpdHY7XG5cdH1cblxuXHRnZXQgaXR2KCkge3JldHVybiB0aGlzLl9pdHY7fVxuXG4gICAgLyoqIFxuICAgICAqIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzXG4gICAgICogcmV0dXJucyB7dmFsdWUsIGR5bmFtaWN9O1xuICAgICovXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgXHR0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY29udmVuaWVuY2UgZnVuY3Rpb24gcmV0dXJuaW5nIHRoZSBzdGF0ZSBvZiB0aGUgc2VnbWVudFxuICAgICAqIEBwYXJhbSB7Kn0gb2Zmc2V0IFxuICAgICAqIEByZXR1cm5zIFxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX2l0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHsuLi50aGlzLnN0YXRlKG9mZnNldCksIG9mZnNldH07XG4gICAgICAgIH0gXG4gICAgICAgIHJldHVybiB7dmFsdWU6IHVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUlMgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJzU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcblx0XHR0aGlzLl9sYXllcnMgPSBhcmdzLmxheWVycztcbiAgICAgICAgdGhpcy5fdmFsdWVfZnVuYyA9IGFyZ3MudmFsdWVfZnVuY1xuXG4gICAgICAgIC8vIFRPRE8gLSBmaWd1cmUgb3V0IGR5bmFtaWMgaGVyZT9cbiAgICB9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIC8vIFRPRE8gLSB1c2UgdmFsdWUgZnVuY1xuICAgICAgICAvLyBmb3Igbm93IC0ganVzdCB1c2UgZmlyc3QgbGF5ZXJcbiAgICAgICAgcmV0dXJuIHsuLi50aGlzLl9sYXllcnNbMF0ucXVlcnkob2Zmc2V0KSwgb2Zmc2V0fTtcblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNUQVRJQyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX3ZhbHVlID0gYXJncy52YWx1ZTtcblx0fVxuXG5cdHN0YXRlKCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl92YWx1ZSwgZHluYW1pYzpmYWxzZX1cblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE1PVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuICAgIEltcGxlbWVudHMgZGV0ZXJtaW5pc3RpYyBwcm9qZWN0aW9uIGJhc2VkIG9uIGluaXRpYWwgY29uZGl0aW9ucyBcbiAgICAtIG1vdGlvbiB2ZWN0b3IgZGVzY3JpYmVzIG1vdGlvbiB1bmRlciBjb25zdGFudCBhY2NlbGVyYXRpb25cbiovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBwb3NpdGlvbjpwMCwgdmVsb2NpdHk6djAsIHRpbWVzdGFtcDp0MFxuICAgICAgICB9ID0gYXJncztcbiAgICAgICAgLy8gY3JlYXRlIG1vdGlvbiB0cmFuc2l0aW9uXG4gICAgICAgIGNvbnN0IGEwID0gMDtcbiAgICAgICAgdGhpcy5fdmVsb2NpdHkgPSB2MDtcbiAgICAgICAgdGhpcy5fcG9zaXRpb24gPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIGxldCBkID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHJldHVybiBwMCArIHYwKmQgKyAwLjUqYTAqZCpkO1xuICAgICAgICB9OyAgIFxuICAgIH1cblxuICAgIHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmFsdWU6IHRoaXMuX3Bvc2l0aW9uKG9mZnNldCksIFxuICAgICAgICAgICAgcmF0ZTogdGhpcy5fdmVsb2NpdHksIFxuICAgICAgICAgICAgZHluYW1pYzogdGhpcy5fdmVsb2NpdHkgIT0gMFxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRSQU5TSVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIFN1cHBvcnRlZCBlYXNpbmcgZnVuY3Rpb25zXG4gICAgXCJlYXNlLWluXCI6XG4gICAgXCJlYXNlLW91dFwiOlxuICAgIFwiZWFzZS1pbi1vdXRcIlxuKi9cblxuZnVuY3Rpb24gZWFzZWluICh0cykge1xuICAgIHJldHVybiBNYXRoLnBvdyh0cywyKTsgIFxufVxuZnVuY3Rpb24gZWFzZW91dCAodHMpIHtcbiAgICByZXR1cm4gMSAtIGVhc2VpbigxIC0gdHMpO1xufVxuZnVuY3Rpb24gZWFzZWlub3V0ICh0cykge1xuICAgIGlmICh0cyA8IC41KSB7XG4gICAgICAgIHJldHVybiBlYXNlaW4oMiAqIHRzKSAvIDI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICgyIC0gZWFzZWluKDIgKiAoMSAtIHRzKSkpIC8gMjtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFuc2l0aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcblx0XHRzdXBlcihpdHYpO1xuICAgICAgICBsZXQge3YwLCB2MSwgZWFzaW5nfSA9IGFyZ3M7XG4gICAgICAgIGxldCBbdDAsIHQxXSA9IHRoaXMuX2l0di5zbGljZSgwLDIpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgdHJhbnNpdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl9keW5hbWljID0gdjEtdjAgIT0gMDtcbiAgICAgICAgdGhpcy5fdHJhbnMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgdHMgdG8gW3QwLHQxXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzaGlmdCBmcm9tIFt0MCx0MV0tc3BhY2UgdG8gWzAsKHQxLXQwKV0tc3BhY2VcbiAgICAgICAgICAgIC8vIC0gc2NhbGUgZnJvbSBbMCwodDEtdDApXS1zcGFjZSB0byBbMCwxXS1zcGFjZVxuICAgICAgICAgICAgdHMgPSB0cyAtIHQwO1xuICAgICAgICAgICAgdHMgPSB0cy9wYXJzZUZsb2F0KHQxLXQwKTtcbiAgICAgICAgICAgIC8vIGVhc2luZyBmdW5jdGlvbnMgc3RyZXRjaGVzIG9yIGNvbXByZXNzZXMgdGhlIHRpbWUgc2NhbGUgXG4gICAgICAgICAgICBpZiAoZWFzaW5nID09IFwiZWFzZS1pblwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW4odHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlb3V0KHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWFzaW5nID09IFwiZWFzZS1pbi1vdXRcIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZWlub3V0KHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc2l0aW9uIGZyb20gdjAgdG8gdjEsIGZvciB0aW1lIHZhbHVlcyBbMCwxXVxuICAgICAgICAgICAgdHMgPSBNYXRoLm1heCh0cywgMCk7XG4gICAgICAgICAgICB0cyA9IE1hdGgubWluKHRzLCAxKTtcbiAgICAgICAgICAgIHJldHVybiB2MCArICh2MS12MCkqdHM7XG4gICAgICAgIH1cblx0fVxuXG5cdHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl90cmFucyhvZmZzZXQpLCBkeW5hbWljOnRoaXMuX2R5bmFtaWN9XG5cdH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElOVEVSUE9MQVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9uIHRvIGNyZWF0ZSBhbiBpbnRlcnBvbGF0b3IgZm9yIG5lYXJlc3QgbmVpZ2hib3IgaW50ZXJwb2xhdGlvbiB3aXRoXG4gKiBleHRyYXBvbGF0aW9uIHN1cHBvcnQuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdHVwbGVzIC0gQW4gYXJyYXkgb2YgW3ZhbHVlLCBvZmZzZXRdIHBhaXJzLCB3aGVyZSB2YWx1ZSBpcyB0aGVcbiAqIHBvaW50J3MgdmFsdWUgYW5kIG9mZnNldCBpcyB0aGUgY29ycmVzcG9uZGluZyBvZmZzZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gQSBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIG9mZnNldCBhbmQgcmV0dXJucyB0aGVcbiAqIGludGVycG9sYXRlZCBvciBleHRyYXBvbGF0ZWQgdmFsdWUuXG4gKi9cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUodHVwbGVzKSB7XG5cbiAgICBpZiAodHVwbGVzLmxlbmd0aCA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHVuZGVmaW5lZDt9XG4gICAgfSBlbHNlIGlmICh0dXBsZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHR1cGxlc1swXVswXTt9XG4gICAgfVxuXG4gICAgLy8gU29ydCB0aGUgdHVwbGVzIGJ5IHRoZWlyIG9mZnNldHNcbiAgICBjb25zdCBzb3J0ZWRUdXBsZXMgPSBbLi4udHVwbGVzXS5zb3J0KChhLCBiKSA9PiBhWzFdIC0gYlsxXSk7XG4gIFxuICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3Iob2Zmc2V0KSB7XG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBiZWZvcmUgdGhlIGZpcnN0IHBvaW50XG4gICAgICBpZiAob2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1swXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1swXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbMV07XG4gICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gSGFuZGxlIGV4dHJhcG9sYXRpb24gYWZ0ZXIgdGhlIGxhc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMl07XG4gICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICBcbiAgICAgIC8vIEZpbmQgdGhlIG5lYXJlc3QgcG9pbnRzIHRvIHRoZSBsZWZ0IGFuZCByaWdodFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW2ldWzFdICYmIG9mZnNldCA8PSBzb3J0ZWRUdXBsZXNbaSArIDFdWzFdKSB7XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbaV07XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbaSArIDFdO1xuICAgICAgICAgIC8vIExpbmVhciBpbnRlcnBvbGF0aW9uIGZvcm11bGE6IHkgPSB5MSArICggKHggLSB4MSkgKiAoeTIgLSB5MSkgLyAoeDIgLSB4MSkgKVxuICAgICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICBcbiAgICAgIC8vIEluIGNhc2UgdGhlIG9mZnNldCBkb2VzIG5vdCBmYWxsIHdpdGhpbiBhbnkgcmFuZ2UgKHNob3VsZCBiZSBjb3ZlcmVkIGJ5IHRoZSBwcmV2aW91cyBjb25kaXRpb25zKVxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9O1xufVxuICBcblxuZXhwb3J0IGNsYXNzIEludGVycG9sYXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG4gICAgY29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIC8vIHNldHVwIGludGVycG9sYXRpb24gZnVuY3Rpb25cbiAgICAgICAgdGhpcy5fdHJhbnMgPSBpbnRlcnBvbGF0ZShhcmdzLnR1cGxlcyk7XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dHJ1ZX07XG4gICAgfVxufVxuXG5cbiIsImltcG9ydCB7IGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgKiBhcyBzZWdtZW50IGZyb20gXCIuL3NlZ21lbnRzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBORUFSQlkgQ0FDSEVcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBUaGlzIGltcGxlbWVudHMgYSBjYWNoZSBpbiBmcm9udCBvZiBhIE5lYXJieUluZGV4LlxuICAgIFxuICAgIFRoZSBwdXJwb3NlIG9mIGNhY2hpbmcgaXMgdG8gb3B0aW1pemUgZm9yIHJlcGVhdGVkXG4gICAgcXVlcmllcyB0byBhIE5lYXJieUluZGV4IHRvIG5lYXJieSBvZmZzZXRzLlxuXG4gICAgVGhlIGNhY2hlIHN0YXRlIGluY2x1ZGVzIHRoZSBuZWFyYnkgc3RhdGUgZnJvbSB0aGUgXG4gICAgaW5kZXgsIGFuZCBhbHNvIHRoZSBjYWNoZWQgc2VnbWVudHMgY29ycmVzcG9uZGluZ1xuICAgIHRvIHRoYXQgc3RhdGUuIFRoaXMgd2F5LCBvbiBhIGNhY2hlIGhpdCwgdGhlIFxuICAgIHF1ZXJ5IG1heSBiZSBzYXRpc2ZpZWQgZGlyZWN0bHkgZnJvbSB0aGUgY2FjaGUuXG5cbiAgICBUaGUgY2FjaGUgaXMgbWFya2VkIGFzIGRpcnR5IHdoZW4gdGhlIE5lYXJieSBpbmRleGVzIGNoYW5nZXMuXG4qL1xuXG5leHBvcnQgY2xhc3MgTmVhcmJ5Q2FjaGUge1xuXG4gICAgY29uc3RydWN0b3IgKG5lYXJieUluZGV4KSB7XG4gICAgICAgIC8vIG5lYXJieSBpbmRleFxuICAgICAgICB0aGlzLl9pbmRleCA9IG5lYXJieUluZGV4O1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IG9iamVjdFxuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhY2hlZCBzZWdtZW50XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGRpcnR5IGZsYWdcbiAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgQWNjZXNzb3JzIGZvciBDYWNoZSBzdGF0ZVxuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBcbiAgICBnZXQgbmVhcmJ5ICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX25lYXJieTtcbiAgICB9XG5cbiAgICBsb2FkX3NlZ21lbnQgKCkge1xuICAgICAgICAvLyBsYXp5IGxvYWQgc2VnbWVudFxuICAgICAgICBpZiAodGhpcy5fbmVhcmJ5ICYmICF0aGlzLl9zZWdtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9zZWdtZW50ID0gbG9hZF9zZWdtZW50KHRoaXMuX25lYXJieSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3NlZ21lbnRcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgRGlydHkgQ2FjaGVcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBkaXJ0eSgpIHtcbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBSZWZyZXNoIENhY2hlXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgLypcbiAgICAgICAgcmVmcmVzaCBpZiBuZWNlc3NhcnkgLSBlbHNlIE5PT1BcbiAgICAgICAgLSBpZiBuZWFyYnkgaXMgbm90IGRlZmluZWRcbiAgICAgICAgLSBpZiBvZmZzZXQgaXMgb3V0c2lkZSBuZWFyYnkuaXR2XG4gICAgICAgIC0gaWYgY2FjaGUgaXMgZGlydHlcbiAgICAqL1xuICAgIHJlZnJlc2ggKG9mZnNldCkge1xuICAgICAgICBpZiAodHlwZW9mIG9mZnNldCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIG9mZnNldCA9IFtvZmZzZXQsIDBdO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9uZWFyYnkgPT0gdW5kZWZpbmVkIHx8IHRoaXMuX2RpcnR5KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVmcmVzaChvZmZzZXQpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KHRoaXMuX25lYXJieS5pdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWZyZXNoKG9mZnNldClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX3JlZnJlc2ggKG9mZnNldCkge1xuICAgICAgICB0aGlzLl9uZWFyYnkgPSB0aGlzLl9pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIFF1ZXJ5IENhY2hlXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChvZmZzZXQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjYWNoZSBxdWVyeSBvZmZzZXQgY2Fubm90IGJlIHVuZGVmaW5lZFwiKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVmcmVzaChvZmZzZXQpO1xuICAgICAgICBpZiAoIXRoaXMuX3NlZ21lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3NlZ21lbnQgPSBsb2FkX3NlZ21lbnQodGhpcy5fbmVhcmJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fc2VnbWVudC5xdWVyeShvZmZzZXQpO1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0FEIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gY3JlYXRlX3NlZ21lbnQoaXR2LCB0eXBlLCBhcmdzKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJzdGF0aWNcIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuU3RhdGljU2VnbWVudChpdHYsIGFyZ3MpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuVHJhbnNpdGlvblNlZ21lbnQoaXR2LCBhcmdzKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJpbnRlcnBvbGF0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LkludGVycG9sYXRpb25TZWdtZW50KGl0diwgYXJncyk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwibW90aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50Lk1vdGlvblNlZ21lbnQoaXR2LCBhcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhcInVucmVjb2duaXplZCBzZWdtZW50IHR5cGVcIiwgdHlwZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBsb2FkX3NlZ21lbnQobmVhcmJ5KSB7XG4gICAgbGV0IHtpdHYsIGNlbnRlcn0gPSBuZWFyYnk7XG4gICAgaWYgKGNlbnRlci5sZW5ndGggPT0gMCkge1xuICAgICAgICByZXR1cm4gY3JlYXRlX3NlZ21lbnQoaXR2LCBcInN0YXRpY1wiLCB7dmFsdWU6dW5kZWZpbmVkfSk7XG4gICAgfVxuICAgIGlmIChjZW50ZXIubGVuZ3RoID09IDEpIHtcbiAgICAgICAgbGV0IHt0eXBlPVwic3RhdGljXCIsIGFyZ3N9ID0gY2VudGVyWzBdO1xuICAgICAgICByZXR1cm4gY3JlYXRlX3NlZ21lbnQoaXR2LCB0eXBlLCBhcmdzKTtcbiAgICB9XG4gICAgaWYgKGNlbnRlci5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkxpc3RTZWdtZW50cyBub3QgeWV0IHN1cHBvcnRlZFwiKTtcbiAgICB9XG59XG4iLCJpbXBvcnQge2VuZHBvaW50fSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7cmFuZ2V9IGZyb20gXCIuL3V0aWwuanNcIjtcbmltcG9ydCB7TmVhcmJ5Q2FjaGV9IGZyb20gXCIuL25lYXJieWNhY2hlLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBORUFSQlkgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBBYnN0cmFjdCBzdXBlcmNsYXNzIGZvciBOZWFyYnlJbmRleGUuXG4gKiBcbiAqIFN1cGVyY2xhc3MgdXNlZCB0byBjaGVjayB0aGF0IGEgY2xhc3MgaW1wbGVtZW50cyB0aGUgbmVhcmJ5KCkgbWV0aG9kLCBcbiAqIGFuZCBwcm92aWRlIHNvbWUgY29udmVuaWVuY2UgbWV0aG9kcy5cbiAqIFxuICogTkVBUkJZIElOREVYXG4gKiBcbiAqIE5lYXJieUluZGV4IHByb3ZpZGVzIGluZGV4aW5nIHN1cHBvcnQgb2YgZWZmZWN0aXZlbHlsb29raW5nIHVwIElURU1TIGJ5IG9mZnNldCwgXG4gKiBnaXZlbiB0aGF0XG4gKiAoaSkgZWFjaCBlbnRyaXkgaXMgYXNzb2NpYXRlZCB3aXRoIGFuIGludGVydmFsIGFuZCxcbiAqIChpaSkgZW50cmllcyBhcmUgbm9uLW92ZXJsYXBwaW5nLlxuICogRWFjaCBJVEVNIG11c3QgYmUgYXNzb2NpYXRlZCB3aXRoIGFuIGludGVydmFsIG9uIHRoZSB0aW1lbGluZSBcbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgYXJvdW5kIGVuZHBvaW50LiBcbiAqIFxuICogUHJpbWFyeSB1c2UgaXMgZm9yIGl0ZXJhdGlvbiBcbiAqIFxuICogUmV0dXJucyB7XG4gKiAgICAgIGNlbnRlcjogbGlzdCBvZiBJVEVNUyBjb3ZlcmluZyBlbmRwb2ludCxcbiAqICAgICAgaXR2OiBpbnRlcnZhbCB3aGVyZSBuZWFyYnkgcmV0dXJucyBpZGVudGljYWwge2NlbnRlcn1cbiAqICAgICAgbGVmdDpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSBsZWZ0IFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgaGlnaC1lbmRwb2ludCBvciB1bmRlZmluZWRcbiAqICAgICAgcmlnaHQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgcmlnaHRcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGxvdy1lbmRwb2ludCBvciB1bmRlZmluZWQgICAgICAgICBcbiAqICAgICAgcHJldjpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSBsZWZ0IFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCAmJiBub24tZW1wdHkge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGhpZ2gtZW5kcG9pbnQgb3IgdW5kZWZpbmVkIGlmIG5vIG1vcmUgaW50ZXJ2YWxzIHRvIHRoZSBsZWZ0XG4gKiAgICAgIG5leHQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgcmlnaHRcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQgJiYgbm9uLWVtcHR5IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBsb3ctZW5kcG9pbnQgb3IgdW5kZWZpbmVkIGlmIG5vIG1vcmUgaW50ZXJ2YWxzIHRvIHRoZSByaWdodFxuICogfVxuICogXG4gKiBcbiAqIFRoZSBuZWFyYnkgc3RhdGUgaXMgd2VsbC1kZWZpbmVkIGZvciBldmVyeSB0aW1lbGluZSBwb3NpdGlvbi5cbiAqIFxuICogXG4gKiBOT1RFIGxlZnQvcmlnaHQgYW5kIHByZXYvbmV4dCBhcmUgbW9zdGx5IHRoZSBzYW1lLiBUaGUgb25seSBkaWZmZXJlbmNlIGlzIFxuICogdGhhdCBwcmV2L25leHQgd2lsbCBza2lwIG92ZXIgcmVnaW9ucyB3aGVyZSB0aGVyZSBhcmUgbm8gaW50ZXJ2YWxzLiBUaGlzXG4gKiBlbnN1cmVzIHByYWN0aWNhbCBpdGVyYXRpb24gb2YgaXRlbXMgYXMgcHJldi9uZXh0IHdpbGwgb25seSBiZSB1bmRlZmluZWQgIFxuICogYXQgdGhlIGVuZCBvZiBpdGVyYXRpb24uXG4gKiBcbiAqIElOVEVSVkFMU1xuICogXG4gKiBbbG93LCBoaWdoLCBsb3dJbmNsdXNpdmUsIGhpZ2hJbmNsdXNpdmVdXG4gKiBcbiAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAqIFxuICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG4gKiBcbiAqIFxuICogSU5URVJWQUwgRU5EUE9JTlRTXG4gKiBcbiAqIGludGVydmFsIGVuZHBvaW50cyBhcmUgZGVmaW5lZCBieSBbdmFsdWUsIHNpZ25dLCBmb3IgZXhhbXBsZVxuICogXG4gKiA0KSAtPiBbNCwtMV0gLSBlbmRwb2ludCBpcyBvbiB0aGUgbGVmdCBvZiA0XG4gKiBbNCwgNCwgNF0gLT4gWzQsIDBdIC0gZW5kcG9pbnQgaXMgYXQgNCBcbiAqICg0IC0+IFs0LCAxXSAtIGVuZHBvaW50IGlzIG9uIHRoZSByaWdodCBvZiA0KVxuICogXG4gKiAvICovXG5cbiBleHBvcnQgY2xhc3MgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIHVwZGF0ZSAoaXRlbXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qIFxuICAgICAgICBOZWFyYnkgbWV0aG9kXG4gICAgKi9cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cblxuICAgIC8qXG4gICAgICAgIHJldHVybiBsb3cgcG9pbnQgb2YgbGVmdG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGZpcnN0KCkge1xuICAgICAgICBsZXQge2NlbnRlciwgcmlnaHR9ID0gdGhpcy5uZWFyYnkoWy1JbmZpbml0eSwgMF0pO1xuICAgICAgICByZXR1cm4gKGNlbnRlci5sZW5ndGggPiAwKSA/IFstSW5maW5pdHksIDBdIDogcmlnaHQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGhpZ2ggcG9pbnQgb2YgcmlnaHRtb3N0IGVudHJ5XG4gICAgKi9cbiAgICBsYXN0KCkge1xuICAgICAgICBsZXQge2xlZnQsIGNlbnRlcn0gPSB0aGlzLm5lYXJieShbSW5maW5pdHksIDBdKTtcbiAgICAgICAgcmV0dXJuIChjZW50ZXIubGVuZ3RoID4gMCkgPyBbSW5maW5pdHksIDBdIDogbGVmdFxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIExpc3QgaXRlbXMgb2YgTmVhcmJ5SW5kZXggKG9yZGVyIGxlZnQgdG8gcmlnaHQpXG4gICAgICAgIGludGVydmFsIGRlZmluZXMgW3N0YXJ0LCBlbmRdIG9mZnNldCBvbiB0aGUgdGltZWxpbmUuXG4gICAgICAgIFJldHVybnMgbGlzdCBvZiBpdGVtLWxpc3RzLlxuICAgICAgICBvcHRpb25zXG4gICAgICAgIC0gc3RhcnRcbiAgICAgICAgLSBzdG9wXG4gICAgKi9cbiAgICBsaXN0KG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtzdGFydD0tSW5maW5pdHksIHN0b3A9SW5maW5pdHl9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHN0YXJ0ID4gc3RvcCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIChcInN0b3AgbXVzdCBiZSBsYXJnZXIgdGhhbiBzdGFydFwiLCBzdGFydCwgc3RvcClcbiAgICAgICAgfVxuICAgICAgICBzdGFydCA9IFtzdGFydCwgMF07XG4gICAgICAgIHN0b3AgPSBbc3RvcCwgMF07XG4gICAgICAgIGxldCBjdXJyZW50ID0gc3RhcnQ7XG4gICAgICAgIGxldCBuZWFyYnk7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICAgICAgbGV0IGxpbWl0ID0gNVxuICAgICAgICB3aGlsZSAobGltaXQpIHtcbiAgICAgICAgICAgIGlmIChlbmRwb2ludC5ndChjdXJyZW50LCBzdG9wKSkge1xuICAgICAgICAgICAgICAgIC8vIGV4aGF1c3RlZFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmVhcmJ5ID0gdGhpcy5uZWFyYnkoY3VycmVudCk7XG4gICAgICAgICAgICBpZiAobmVhcmJ5LmNlbnRlci5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgICAgIC8vIGNlbnRlciBlbXB0eSAodHlwaWNhbGx5IGZpcnN0IGl0ZXJhdGlvbilcbiAgICAgICAgICAgICAgICBpZiAobmVhcmJ5LnJpZ2h0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyByaWdodCB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gbm8gZW50cmllcyAtIGFscmVhZHkgZXhoYXVzdGVkXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IGRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IG9mZnNldFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gbmVhcmJ5LnJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKG5lYXJieS5jZW50ZXIpO1xuICAgICAgICAgICAgICAgIGlmIChuZWFyYnkucmlnaHQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBsYXN0IGVudHJ5IC0gbWFyayBpdGVyYWN0b3IgZXhoYXVzdGVkXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IGRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IG9mZnNldFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gbmVhcmJ5LnJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxpbWl0LS07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgU2FtcGxlIE5lYXJieUluZGV4IGJ5IHRpbWVsaW5lIG9mZnNldCBpbmNyZW1lbnRzXG4gICAgICAgIHJldHVybiBsaXN0IG9mIHR1cGxlcyBbdmFsdWUsIG9mZnNldF1cbiAgICAgICAgb3B0aW9uc1xuICAgICAgICAtIHN0YXJ0XG4gICAgICAgIC0gc3RvcFxuICAgICAgICAtIHN0ZXBcbiAgICAqL1xuICAgIHNhbXBsZShvcHRpb25zPXt9KSB7XG4gICAgICAgIGxldCB7c3RhcnQ9LUluZmluaXR5LCBzdG9wPUluZmluaXR5LCBzdGVwPTF9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHN0YXJ0ID4gc3RvcCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIChcInN0b3AgbXVzdCBiZSBsYXJnZXIgdGhhbiBzdGFydFwiLCBzdGFydCwgc3RvcClcbiAgICAgICAgfVxuICAgICAgICBzdGFydCA9IFtzdGFydCwgMF07XG4gICAgICAgIHN0b3AgPSBbc3RvcCwgMF07XG5cbiAgICAgICAgc3RhcnQgPSBlbmRwb2ludC5tYXgodGhpcy5maXJzdCgpLCBzdGFydCk7XG4gICAgICAgIHN0b3AgPSBlbmRwb2ludC5taW4odGhpcy5sYXN0KCksIHN0b3ApO1xuICAgICAgICBjb25zdCBjYWNoZSA9IG5ldyBOZWFyYnlDYWNoZSh0aGlzKTtcbiAgICAgICAgcmV0dXJuIHJhbmdlKHN0YXJ0WzBdLCBzdG9wWzBdLCBzdGVwLCB7aW5jbHVkZV9lbmQ6dHJ1ZX0pXG4gICAgICAgICAgICAubWFwKChvZmZzZXQpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gW2NhY2hlLnF1ZXJ5KG9mZnNldCkudmFsdWUsIG9mZnNldF07XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbn1cblxuXG5cblxuXG4iLCJpbXBvcnQge2ludGVydmFsLCBlbmRwb2ludH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UgfSBmcm9tIFwiLi9uZWFyYnlpbmRleC5qc1wiO1xuXG4vKipcbiAqIFxuICogTmVhcmJ5IEluZGV4IFNpbXBsZVxuICogXG4gKiAtIGl0ZW1zIGFyZSBhc3N1bWVkIHRvIGJlIG5vbi1vdmVybGFwcGluZyBvbiB0aGUgdGltZWxpbmUsIFxuICogLSBpbXBseWluZyB0aGF0IG5lYXJieS5jZW50ZXIgd2lsbCBiZSBhIGxpc3Qgb2YgYXQgbW9zdCBvbmUgSVRFTS4gXG4gKiAtIGV4Y2VwdGlvbiB3aWxsIGJlIHJhaXNlZCBpZiBvdmVybGFwcGluZyBJVEVNUyBhcmUgZm91bmRcbiAqIC0gSVRFTVMgaXMgYXNzdW1iZWQgdG8gYmUgaW1tdXRhYmxlIGFycmF5IC0gY2hhbmdlIElURU1TIGJ5IHJlcGxhY2luZyBhcnJheVxuICogXG4gKiBcbiAqIE5FQVJCWVxuICogVGhlIG5lYXJieSBtZXRob2QgcmV0dXJucyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbmVpZ2hib3Job29kIGFyb3VuZCBvZmZzZXQuIFxuICogXG4gKiBSZXR1cm5zIHtcbiAqICAgICAgbGVmdCAtIGhpZ2ggaW50ZXJ2YWwgZW5kcG9pbnQgb2YgdGhlIGZpcnN0IElURU0gdG8gdGhlIGxlZnQgd2hpY2ggZG9lcyBub3QgY292ZXIgb2Zmc2V0LCBlbHNlIHVuZGVmaW5lZFxuICogICAgICBjZW50ZXIgLSBsaXN0IG9mIElURU1TIGNvdmVyaW5nIG9mZnNldCwgZWxzZSBbXVxuICogICAgICByaWdodCAtIGxvdyBpbnRlcnZhbCBlbmRwb2ludCBvZiB0aGUgZmlyc3QgSVRFTSB0byB0aGUgcmlnaHQgd2hpY2ggZG9lcyBub3QgY292ZXIgb2Zmc2V0LCBlbHNlIHVuZGVmaW5lZFxuICogfVxuICogXG4gKi9cblxuXG4vLyBnZXQgaW50ZXJ2YWwgbG93IHBvaW50XG5mdW5jdGlvbiBnZXRfbG93X3ZhbHVlKGl0ZW0pIHtcbiAgICByZXR1cm4gaXRlbS5pdHZbMF07XG59XG5cbi8vIGdldCBpbnRlcnZhbCBsb3cgZW5kcG9pbnRcbmZ1bmN0aW9uIGdldF9sb3dfZW5kcG9pbnQoaXRlbSkge1xuICAgIHJldHVybiBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW0uaXR2KVswXVxufVxuXG4vLyBnZXQgaW50ZXJ2YWwgaGlnaCBlbmRwb2ludFxuZnVuY3Rpb24gZ2V0X2hpZ2hfZW5kcG9pbnQoaXRlbSkge1xuICAgIHJldHVybiBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW0uaXR2KVsxXVxufVxuXG5cbmV4cG9ydCBjbGFzcyBTaW1wbGVOZWFyYnlJbmRleCBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2l0ZW1zID0gW107XG4gICAgICAgIGxldCB7aXRlbXN9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKGl0ZW1zKSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZShpdGVtcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGUgKGl0ZW1zKSB7XG4gICAgICAgIHRoaXMuX2l0ZW1zID0gY2hlY2tfaW5wdXQoaXRlbXMpXG4gICAgfVxuXG5cbiAgICAvKlxuICAgICAgICBuZWFyYnkgYnkgb2Zmc2V0XG4gICAgICAgIFxuICAgICAgICByZXR1cm5zIHtsZWZ0LCBjZW50ZXIsIHJpZ2h0fVxuXG4gICAgICAgIGJpbmFyeSBzZWFyY2ggYmFzZWQgb24gb2Zmc2V0XG4gICAgICAgIDEpIGZvdW5kLCBpZHhcbiAgICAgICAgICAgIG9mZnNldCBtYXRjaGVzIHZhbHVlIG9mIGludGVydmFsLmxvdyBvZiBhbiBpdGVtXG4gICAgICAgICAgICBpZHggZ2l2ZXMgdGhlIGluZGV4IG9mIHRoaXMgaXRlbSBpbiB0aGUgYXJyYXlcbiAgICAgICAgMikgbm90IGZvdW5kLCBpZHhcbiAgICAgICAgICAgIG9mZnNldCBpcyBlaXRoZXIgY292ZXJlZCBieSBpdGVtIGF0IChpZHgtMSksXG4gICAgICAgICAgICBvciBpdCBpcyBub3QgPT4gYmV0d2VlbiBlbnRyaWVzXG4gICAgICAgICAgICBpbiB0aGlzIGNhc2UgLSBpZHggZ2l2ZXMgdGhlIGluZGV4IHdoZXJlIGFuIGl0ZW1cbiAgICAgICAgICAgIHNob3VsZCBiZSBpbnNlcnRlZCAtIGlmIGl0IGhhZCBsb3cgPT0gb2Zmc2V0XG4gICAgKi9cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgb2Zmc2V0ID0gW29mZnNldCwgMF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG9mZnNldCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVuZHBvaW50IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgICAgY2VudGVyOiBbXSxcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgbGVmdDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgcmlnaHQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHByZXY6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIG5leHQ6IHVuZGVmaW5lZFxuICAgICAgICB9O1xuICAgICAgICBsZXQgaXRlbXMgPSB0aGlzLl9pdGVtcztcbiAgICAgICAgbGV0IGluZGV4ZXMsIGl0ZW07XG4gICAgICAgIGNvbnN0IHNpemUgPSBpdGVtcy5sZW5ndGg7XG4gICAgICAgIGlmIChzaXplID09IDApIHtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7IFxuICAgICAgICB9XG4gICAgICAgIGxldCBbZm91bmQsIGlkeF0gPSBmaW5kX2luZGV4KG9mZnNldFswXSwgaXRlbXMsIGdldF9sb3dfdmFsdWUpO1xuICAgICAgICBpZiAoZm91bmQpIHtcbiAgICAgICAgICAgIC8vIHNlYXJjaCBvZmZzZXQgbWF0Y2hlcyBpdGVtIGxvdyBleGFjdGx5XG4gICAgICAgICAgICAvLyBjaGVjayB0aGF0IGl0IGluZGVlZCBjb3ZlcmVkIGJ5IGl0ZW0gaW50ZXJ2YWxcbiAgICAgICAgICAgIGl0ZW0gPSBpdGVtc1tpZHhdXG4gICAgICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KGl0ZW0uaXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICAgICAgaW5kZXhlcyA9IHtsZWZ0OmlkeC0xLCBjZW50ZXI6aWR4LCByaWdodDppZHgrMX07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGluZGV4ZXMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBjaGVjayBwcmV2IGl0ZW1cbiAgICAgICAgICAgIGl0ZW0gPSBpdGVtc1tpZHgtMV07XG4gICAgICAgICAgICBpZiAoaXRlbSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiBzZWFyY2ggb2Zmc2V0IGlzIGNvdmVyZWQgYnkgaXRlbSBpbnRlcnZhbFxuICAgICAgICAgICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfZW5kcG9pbnQoaXRlbS5pdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhlcyA9IHtsZWZ0OmlkeC0yLCBjZW50ZXI6aWR4LTEsIHJpZ2h0OmlkeH07XG4gICAgICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVx0XG4gICAgICAgIGlmIChpbmRleGVzID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gcHJldiBpdGVtIGVpdGhlciBkb2VzIG5vdCBleGlzdCBvciBpcyBub3QgcmVsZXZhbnRcbiAgICAgICAgICAgIGluZGV4ZXMgPSB7bGVmdDppZHgtMSwgY2VudGVyOi0xLCByaWdodDppZHh9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2VudGVyXG4gICAgICAgIGlmICgwIDw9IGluZGV4ZXMuY2VudGVyICYmIGluZGV4ZXMuY2VudGVyIDwgc2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0LmNlbnRlciA9ICBbaXRlbXNbaW5kZXhlcy5jZW50ZXJdXTtcbiAgICAgICAgfVxuICAgICAgICAvLyBwcmV2L25leHRcbiAgICAgICAgaWYgKDAgPD0gaW5kZXhlcy5sZWZ0ICYmIGluZGV4ZXMubGVmdCA8IHNpemUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5wcmV2ID0gIGdldF9oaWdoX2VuZHBvaW50KGl0ZW1zW2luZGV4ZXMubGVmdF0pO1xuICAgICAgICB9XG4gICAgICAgIGlmICgwIDw9IGluZGV4ZXMucmlnaHQgJiYgaW5kZXhlcy5yaWdodCA8IHNpemUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5uZXh0ID0gIGdldF9sb3dfZW5kcG9pbnQoaXRlbXNbaW5kZXhlcy5yaWdodF0pO1xuICAgICAgICB9ICAgICAgICBcbiAgICAgICAgLy8gbGVmdC9yaWdodFxuICAgICAgICBsZXQgbG93LCBoaWdoO1xuICAgICAgICBpZiAocmVzdWx0LmNlbnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBsZXQgaXR2ID0gcmVzdWx0LmNlbnRlclswXS5pdHY7XG4gICAgICAgICAgICBbbG93LCBoaWdoXSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gKGxvd1swXSA+IC1JbmZpbml0eSkgPyBlbmRwb2ludC5mbGlwKGxvdywgXCJoaWdoXCIpIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gKGhpZ2hbMF0gPCBJbmZpbml0eSkgPyBlbmRwb2ludC5mbGlwKGhpZ2gsIFwibG93XCIpIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgcmVzdWx0Lml0diA9IHJlc3VsdC5jZW50ZXJbMF0uaXR2O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSByZXN1bHQucHJldjtcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IHJlc3VsdC5uZXh0O1xuICAgICAgICAgICAgLy8gaW50ZXJ2YWxcbiAgICAgICAgICAgIGxldCBsZWZ0ID0gcmVzdWx0LmxlZnQ7XG4gICAgICAgICAgICBsb3cgPSAobGVmdCA9PSB1bmRlZmluZWQpID8gWy1JbmZpbml0eSwgMF0gOiBlbmRwb2ludC5mbGlwKGxlZnQsIFwibG93XCIpO1xuICAgICAgICAgICAgbGV0IHJpZ2h0ID0gcmVzdWx0LnJpZ2h0O1xuICAgICAgICAgICAgaGlnaCA9IChyaWdodCA9PSB1bmRlZmluZWQpID8gW0luZmluaXR5LCAwXSA6IGVuZHBvaW50LmZsaXAocmlnaHQsIFwiaGlnaFwiKTtcbiAgICAgICAgICAgIHJlc3VsdC5pdHYgPSBpbnRlcnZhbC5mcm9tX2VuZHBvaW50cyhsb3csIGhpZ2gpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG5cdFVUSUxTXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuLy8gY2hlY2sgaW5wdXRcbmZ1bmN0aW9uIGNoZWNrX2lucHV0KGl0ZW1zKSB7XG5cbiAgICBpZiAoaXRlbXMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGl0ZW1zID0gW107XG4gICAgfVxuXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnB1dCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgIH1cblxuICAgIC8vIHNvcnQgaXRlbXMgYmFzZWQgb24gaW50ZXJ2YWwgbG93IGVuZHBvaW50XG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBsZXQgYV9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGEuaXR2KVswXTtcbiAgICAgICAgbGV0IGJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChiLml0dilbMF07XG4gICAgICAgIHJldHVybiBlbmRwb2ludC5jbXAoYV9sb3csIGJfbG93KTtcbiAgICB9KTtcblxuICAgIC8vIGNoZWNrIHRoYXQgaXRlbSBpbnRlcnZhbHMgYXJlIG5vbi1vdmVybGFwcGluZ1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IHByZXZfaGlnaCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaSAtIDFdLml0dilbMV07XG4gICAgICAgIGxldCBjdXJyX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaV0uaXR2KVswXTtcbiAgICAgICAgLy8gdmVyaWZ5IHRoYXQgcHJldiBoaWdoIGlzIGxlc3MgdGhhdCBjdXJyIGxvd1xuICAgICAgICBpZiAoIWVuZHBvaW50Lmx0KHByZXZfaGlnaCwgY3Vycl9sb3cpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPdmVybGFwcGluZyBpbnRlcnZhbHMgZm91bmRcIik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5cbi8qXG5cdGJpbmFyeSBzZWFyY2ggZm9yIGZpbmRpbmcgdGhlIGNvcnJlY3QgaW5zZXJ0aW9uIGluZGV4IGludG9cblx0dGhlIHNvcnRlZCBhcnJheSAoYXNjZW5kaW5nKSBvZiBpdGVtc1xuXHRcblx0YXJyYXkgY29udGFpbnMgb2JqZWN0cywgYW5kIHZhbHVlIGZ1bmMgcmV0cmVhdmVzIGEgdmFsdWVcblx0ZnJvbSBlYWNoIG9iamVjdC5cblxuXHRyZXR1cm4gW2ZvdW5kLCBpbmRleF1cbiovXG5cbmZ1bmN0aW9uIGZpbmRfaW5kZXgodGFyZ2V0LCBhcnIsIHZhbHVlX2Z1bmMpIHtcblxuICAgIGZ1bmN0aW9uIGRlZmF1bHRfdmFsdWVfZnVuYyhlbCkge1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgfVxuICAgIFxuICAgIGxldCBsZWZ0ID0gMDtcblx0bGV0IHJpZ2h0ID0gYXJyLmxlbmd0aCAtIDE7XG5cdHZhbHVlX2Z1bmMgPSB2YWx1ZV9mdW5jIHx8IGRlZmF1bHRfdmFsdWVfZnVuYztcblx0d2hpbGUgKGxlZnQgPD0gcmlnaHQpIHtcblx0XHRjb25zdCBtaWQgPSBNYXRoLmZsb29yKChsZWZ0ICsgcmlnaHQpIC8gMik7XG5cdFx0bGV0IG1pZF92YWx1ZSA9IHZhbHVlX2Z1bmMoYXJyW21pZF0pO1xuXHRcdGlmIChtaWRfdmFsdWUgPT09IHRhcmdldCkge1xuXHRcdFx0cmV0dXJuIFt0cnVlLCBtaWRdOyAvLyBUYXJnZXQgYWxyZWFkeSBleGlzdHMgaW4gdGhlIGFycmF5XG5cdFx0fSBlbHNlIGlmIChtaWRfdmFsdWUgPCB0YXJnZXQpIHtcblx0XHRcdCAgbGVmdCA9IG1pZCArIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSByaWdodFxuXHRcdH0gZWxzZSB7XG5cdFx0XHQgIHJpZ2h0ID0gbWlkIC0gMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIGxlZnRcblx0XHR9XG5cdH1cbiAgXHRyZXR1cm4gW2ZhbHNlLCBsZWZ0XTsgLy8gUmV0dXJuIHRoZSBpbmRleCB3aGVyZSB0YXJnZXQgc2hvdWxkIGJlIGluc2VydGVkXG59XG4iLCJcblxuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UsIEN1cnNvckJhc2UgfSBmcm9tIFwiLi9iYXNlcy5qc1wiO1xuaW1wb3J0IHsgc291cmNlIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgU2ltcGxlU3RhdGVQcm92aWRlciB9IGZyb20gXCIuL3N0YXRlcHJvdmlkZXJfc2ltcGxlLmpzXCI7XG5pbXBvcnQgeyBjbWQgfSBmcm9tIFwiLi9jbWQuanNcIjtcbmltcG9ydCB7IFNpbXBsZU5lYXJieUluZGV4IH0gZnJvbSBcIi4vbmVhcmJ5aW5kZXhfc2ltcGxlLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlDYWNoZSB9IGZyb20gXCIuL25lYXJieWNhY2hlLmpzXCI7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ0xPQ0sgQ1VSU09SU1xuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLy8gQ0xPQ0sgKGNvdW50aW5nIHNlY29uZHMgc2luY2UgcGFnZSBsb2FkKVxuY2xhc3MgTG9jYWxDbG9jayBleHRlbmRzIEN1cnNvckJhc2Uge1xuICAgIHF1ZXJ5ICgpIHtcbiAgICAgICAgbGV0IG9mZnNldCA9IHBlcmZvcm1hbmNlLm5vdygpLzEwMDAuMDtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTpvZmZzZXQsIGR5bmFtaWM6dHJ1ZSwgcmF0ZToxLCBvZmZzZXR9O1xuICAgIH1cbn1cblxuLy8gQ0xPQ0sgKGNvdW50aW5nIHNlY29uZHMgc2luY2UgZXBvY2ggKDE5NzApXG5jbGFzcyBMb2NhbEVwb2NoIGV4dGVuZHMgQ3Vyc29yQmFzZSB7XG4gICAgcXVlcnkgKCkge1xuICAgICAgICBsZXQgb2Zmc2V0ID0gKERhdGUubm93KCkgLyAxMDAwLjApXG4gICAgICAgIHJldHVybiB7dmFsdWU6b2Zmc2V0LCBkeW5hbWljOnRydWUsIHJhdGU6MSwgb2Zmc2V0fTtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCBsb2NhbF9jbG9jayA9IG5ldyBMb2NhbENsb2NrKCk7XG5leHBvcnQgY29uc3QgbG9jYWxfZXBvY2ggPSBuZXcgTG9jYWxFcG9jaCgpXG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBDVVJTT1JcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogXG4gKiBDdXJzb3IgaXMgYSB2YXJpYWJsZVxuICogLSBoYXMgbXV0YWJsZSBjdHJsIGN1cnNvciAoZGVmYXVsdCBsb2NhbCBjbG9jaylcbiAqIC0gaGFzIG11dGFibGUgc3RhdGUgcHJvdmlkZXIgKHNyYykgKGRlZmF1bHQgc3RhdGUgdW5kZWZpbmVkKVxuICogLSBtZXRob2RzIGZvciBhc3NpZ24sIG1vdmUsIHRyYW5zaXRpb24sIGludGVwb2xhdGlvblxuICogXG4gKi9cblxuZXhwb3J0IGNsYXNzIEN1cnNvciBleHRlbmRzIEN1cnNvckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLy8gY3RybFxuICAgICAgICBzb3VyY2UuYWRkVG9JbnN0YW5jZSh0aGlzLCBcImN0cmxcIik7XG4gICAgICAgIC8vIHNyY1xuICAgICAgICBzb3VyY2UuYWRkVG9JbnN0YW5jZSh0aGlzLCBcInNyY1wiKTtcbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgdGhpcy5faW5kZXggPSBuZXcgU2ltcGxlTmVhcmJ5SW5kZXgoKTtcbiAgICAgICAgLy8gY2FjaGVcbiAgICAgICAgdGhpcy5fY2FjaGUgPSBuZXcgTmVhcmJ5Q2FjaGUodGhpcy5faW5kZXgpO1xuICAgICAgICBcbiAgICAgICAgbGV0IHtzcmMsIGN0cmwsIC4uLm9wdHN9ID0gb3B0aW9ucztcblxuICAgICAgICAvLyBpbml0aWFsaXNlIGN0cmxcbiAgICAgICAgaWYgKGN0cmwgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjdHJsID0gbG9jYWxfY2xvY2s7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jdHJsID0gY3RybDtcblxuICAgICAgICAvLyBpbml0aWFsaXNlIHN0YXRlXG4gICAgICAgIGlmIChzcmMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzcmMgPSBuZXcgU2ltcGxlU3RhdGVQcm92aWRlcihvcHRzKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNyYyA9IHNyY1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogQ1RSTCAoY3Vyc29yKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgX19jdHJsX2NoZWNrKGN0cmwpIHtcbiAgICAgICAgaWYgKCEoY3RybCBpbnN0YW5jZW9mIEN1cnNvckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwiY3RybFwiIG11c3QgYmUgY3Vyc29yICR7Y3RybH1gKVxuICAgICAgICB9XG4gICAgfVxuICAgIF9fY3RybF9oYW5kbGVfY2hhbmdlKCkge1xuICAgICAgICB0aGlzLl9faGFuZGxlX2NoYW5nZSgpO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogU1JDIChzdGF0ZXByb3ZpZGVyKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgX19zcmNfY2hlY2soc3JjKSB7XG4gICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcInNyY1wiIG11c3QgYmUgc3RhdGUgcHJvdmlkZXIgJHtzb3VyY2V9YCk7XG4gICAgICAgIH1cbiAgICB9ICAgIFxuICAgIF9fc3JjX2hhbmRsZV9jaGFuZ2UoKSB7XG4gICAgICAgIHRoaXMuX19oYW5kbGVfY2hhbmdlKCk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBDQUxMQkFDS1xuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgX19oYW5kbGVfY2hhbmdlKCkge1xuICAgICAgICBpZiAodGhpcy5zcmMgJiYgdGhpcy5jdHJsKSB7XG4gICAgICAgICAgICBsZXQgaXRlbXMgPSB0aGlzLnNyYy5pdGVtcztcbiAgICAgICAgICAgIHRoaXMuX2luZGV4LnVwZGF0ZShpdGVtcyk7XG4gICAgICAgICAgICB0aGlzLl9jYWNoZS5kaXJ0eSgpO1xuICAgICAgICAgICAgLy8gdHJpZ2dlciBjaGFuZ2UgZXZlbnQgZm9yIGN1cnNvclxuICAgICAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdGhpcy5xdWVyeSgpKTsgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFFVRVJZIEFQSVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIFxuICAgIHF1ZXJ5ICgpIHtcbiAgICAgICAgbGV0IHt2YWx1ZTpvZmZzZXR9ID0gdGhpcy5jdHJsLnF1ZXJ5KClcbiAgICAgICAgaWYgKHR5cGVvZiBvZmZzZXQgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhcm5pbmc6IGN0cmwgc3RhdGUgbXVzdCBiZSBudW1iZXIgJHtvZmZzZXR9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlLnF1ZXJ5KG9mZnNldCk7XG4gICAgfVxuXG4gICAgZ2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5xdWVyeSgpLnZhbHVlfTtcblxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBVUERBVEUgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBhc3NpZ24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzKS5hc3NpZ24odmFsdWUpO1xuICAgIH1cbiAgICBtb3ZlICh7cG9zaXRpb24sIHZlbG9jaXR5fSkge1xuICAgICAgICBsZXQge3ZhbHVlLCByYXRlLCBvZmZzZXQ6dGltZXN0YW1wfSA9IHRoaXMucXVlcnkoKTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3Vyc29yIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7dmFsdWV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcG9zaXRpb24gPSAocG9zaXRpb24gIT0gdW5kZWZpbmVkKSA/IHBvc2l0aW9uIDogdmFsdWU7XG4gICAgICAgIHZlbG9jaXR5ID0gKHZlbG9jaXR5ICE9IHVuZGVmaW5lZCkgPyB2ZWxvY2l0eTogcmF0ZTtcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzKS5tb3ZlKHtwb3NpdGlvbiwgdmVsb2NpdHksIHRpbWVzdGFtcH0pO1xuICAgIH1cbiAgICB0cmFuc2l0aW9uICh7dGFyZ2V0LCBkdXJhdGlvbiwgZWFzaW5nfSkge1xuICAgICAgICBsZXQge3ZhbHVlOnYwLCBvZmZzZXQ6dDB9ID0gdGhpcy5xdWVyeSgpO1xuICAgICAgICBpZiAodHlwZW9mIHYwICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3Igc3RhdGUgbXVzdCBiZSBudW1iZXIgJHt2MH1gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY21kKHRoaXMpLnRyYW5zaXRpb24odjAsIHRhcmdldCwgdDAsIHQwICsgZHVyYXRpb24sIGVhc2luZyk7XG4gICAgfVxuICAgIGludGVycG9sYXRlICh7dHVwbGVzLCBkdXJhdGlvbn0pIHtcbiAgICAgICAgbGV0IHQwID0gdGhpcy5xdWVyeSgpLm9mZnNldDtcbiAgICAgICAgLy8gYXNzdW1pbmcgdGltc3RhbXBzIGFyZSBpbiByYW5nZSBbMCwxXVxuICAgICAgICAvLyBzY2FsZSB0aW1lc3RhbXBzIHRvIGR1cmF0aW9uXG4gICAgICAgIHR1cGxlcyA9IHR1cGxlcy5tYXAoKFt2LHRdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3YsIHQwICsgdCpkdXJhdGlvbl07XG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiBjbWQodGhpcykuaW50ZXJwb2xhdGUodHVwbGVzKTtcbiAgICB9XG5cbn1cbnNvdXJjZS5hZGRUb1Byb3RvdHlwZShDdXJzb3IucHJvdG90eXBlLCBcInNyY1wiLCB7bXV0YWJsZTp0cnVlfSk7XG5zb3VyY2UuYWRkVG9Qcm90b3R5cGUoQ3Vyc29yLnByb3RvdHlwZSwgXCJjdHJsXCIsIHttdXRhYmxlOnRydWV9KTtcblxuIiwiXG5pbXBvcnQgeyBMYXllckJhc2UsIFN0YXRlUHJvdmlkZXJCYXNlIH0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7IHNvdXJjZSB9IGZyb20gXCIuL3V0aWwuanNcIjtcbmltcG9ydCB7IFNpbXBsZVN0YXRlUHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX3NpbXBsZS5qc1wiO1xuaW1wb3J0IHsgU2ltcGxlTmVhcmJ5SW5kZXggfSBmcm9tIFwiLi9uZWFyYnlpbmRleF9zaW1wbGUuanNcIjtcbmltcG9ydCB7IE5lYXJieUNhY2hlIH0gZnJvbSBcIi4vbmVhcmJ5Y2FjaGUuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTEFZRVJcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogXG4gKiBMYXllclxuICogLSBoYXMgbXV0YWJsZSBzdGF0ZSBwcm92aWRlciAoc3JjKSAoZGVmYXVsdCBzdGF0ZSB1bmRlZmluZWQpXG4gKiAtIG1ldGhvZHMgZm9yIGxpc3QgYW5kIHNhbXBsZVxuICogXG4gKi9cblxuXG5leHBvcnQgY2xhc3MgTGF5ZXIgZXh0ZW5kcyBMYXllckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICAvLyBzcmNcbiAgICAgICAgc291cmNlLmFkZFRvSW5zdGFuY2UodGhpcywgXCJzcmNcIik7XG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIHRoaXMuX2luZGV4ID0gbmV3IFNpbXBsZU5lYXJieUluZGV4KCk7XG4gICAgICAgIC8vIGNhY2hlXG4gICAgICAgIHRoaXMuX2NhY2hlID0gbmV3IE5lYXJieUNhY2hlKHRoaXMuX2luZGV4KTtcblxuICAgICAgICAvLyBpbml0aWFsaXNlIHdpdGggc3RhdGVwcm92aWRlclxuICAgICAgICBsZXQge3NyYywgLi4ub3B0c30gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3JjID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3JjID0gbmV3IFNpbXBsZVN0YXRlUHJvdmlkZXIob3B0cyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgU3RhdGVQcm92aWRlckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzcmMgbXVzdCBiZSBTdGF0ZXByb3ZpZGVyQmFzZVwiKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogU1JDIChzdGF0ZXByb3ZpZGVyKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgX19zcmNfY2hlY2soc3JjKSB7XG4gICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcInNyY1wiIG11c3QgYmUgc3RhdGUgcHJvdmlkZXIgJHtzb3VyY2V9YCk7XG4gICAgICAgIH1cbiAgICB9ICAgIFxuICAgIF9fc3JjX2hhbmRsZV9jaGFuZ2UoKSB7XG4gICAgICAgIGxldCBpdGVtcyA9IHRoaXMuc3JjLml0ZW1zO1xuICAgICAgICB0aGlzLl9pbmRleC51cGRhdGUoaXRlbXMpO1xuICAgICAgICB0aGlzLl9jYWNoZS5kaXJ0eSgpO1xuICAgICAgICAvLyB0cmlnZ2VyIGNoYW5nZSBldmVudCBmb3IgY3Vyc29yXG4gICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHRoaXMucXVlcnkoKSk7ICAgXG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBRVUVSWSBBUElcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FjaGUucXVlcnkob2Zmc2V0KTtcbiAgICB9XG5cbiAgICBsaXN0IChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbmRleC5saXN0KG9wdGlvbnMpO1xuICAgIH1cblxuICAgIHNhbXBsZSAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5faW5kZXguc2FtcGxlKG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogVVBEQVRFIEFQSVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgLy8gVE9ETyAtIGFkZCBtZXRob2RzIGZvciB1cGRhdGU/XG5cbn1cbnNvdXJjZS5hZGRUb1Byb3RvdHlwZShMYXllci5wcm90b3R5cGUsIFwic3JjXCIsIHttdXRhYmxlOnRydWV9KTtcbiJdLCJuYW1lcyI6WyJjaGVja19pbnB1dCIsImludGVycG9sYXRlIiwic2VnbWVudC5TdGF0aWNTZWdtZW50Iiwic2VnbWVudC5UcmFuc2l0aW9uU2VnbWVudCIsInNlZ21lbnQuSW50ZXJwb2xhdGlvblNlZ21lbnQiLCJzZWdtZW50Lk1vdGlvblNlZ21lbnQiXSwibWFwcGluZ3MiOiI7Ozs7O0NBQUE7Q0FDQTtDQUNBOztDQUVBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBO0NBQ0E7Q0FDQTs7OztDQUlBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTs7Q0FFQTs7Q0FFQSxNQUFNLEtBQUssQ0FBQzs7Q0FFWixDQUFDLFdBQVcsQ0FBQyxDQUFDLFNB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QUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsSUFBSSxLQUFLLENBQUMsR0FBRztDQUNiLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUs7Q0FDNUMsUUFBUSxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRTtDQUN4QyxZQUFZLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxtQ0FBbUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0NBQzNFO0NBQ0EsUUFBUSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztDQUN4Qzs7Q0FFQSxJQUFJLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLLENBQUM7OztDQUc1QztDQUNBO0NBQ0E7O0NBRUEsSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFO0NBQ2xCLFFBQVEsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztDQUN0QztDQUNBLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLEVBQUU7Q0FDaEMsUUFBUSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRTtDQUMxRCxRQUFRLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO0NBQ3ZDLFlBQVksTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLHFDQUFxQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7Q0FDNUU7Q0FDQSxRQUFRLFFBQVEsR0FBRyxDQUFDLFFBQVEsSUFBSSxTQUFTLElBQUksUUFBUSxHQUFHLEtBQUs7Q0FDN0QsUUFBUSxRQUFRLEdBQUcsQ0FBQyxRQUFRLElBQUksU0FBUyxJQUFJLFFBQVEsRUFBRSxJQUFJO0NBQzNELFFBQVEsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMs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
