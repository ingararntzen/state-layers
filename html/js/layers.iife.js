
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

	    state() {
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
	    }

	    update (items) {
	        return Promise.resolve()
	            .then(() => {
	                this._items = check_input$1(items);
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
	 * CLOCKS
	 ************************************************/

	const CLOCK = function () {
	    return performance.now()/1000.0;
	};

	/*
	    NOTE 
	    epoch should only be used for visualization,
	    as it has time resolution limited to ms
	*/

	const EPOCH = function () {
	    return Date.now()/1000.0;
	};


	/************************************************
	 * CLOCK CURSORS
	 ************************************************/

	// CLOCK (counting seconds since page load)
	class ClockCursor extends CursorBase {

	    constructor (clock) {
	        super();
	        this._clock = clock;
	        // items
	        const t0 = this._clock();
	        this._items = [{
	            itv: [-Infinity, Infinity, true, true],
	            type: "motion",
	            args: {position: t0, velocity: 1, offset: t0}
	        }];    
	    }

	    query () {
	        let ts = this._clock(); 
	        return {value:ts, dynamic:true, offset:ts};
	    }

	    items () {
	        return this._items;
	    }
	}

	const local_clock = new ClockCursor(CLOCK);
	new ClockCursor(EPOCH);



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
	        // timeout
	        this._tid;

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
	        // clean up old timeout
	        clearTimeout(this._tid);

	        if (this.src && this.ctrl) {
	            this._index.update(this.src.items);
	            this._cache.dirty();
	            // trigger change event for cursor
	            this.eventifyTrigger("change", this.query());
	            /**
	             * Playback support
	             * 
	             * During playback (ctrl signaling dynamic change)
	             * there is a need to detect passing from one segment interval
	             * to the next - ideally at precisely the correct time
	             * 
	             * cache.nearby.itv (derived from src) gives the 
	             * interval where nearby stays constant, and we are 
	             * currently in this interval so the timeout
	             * shold target the momen when we leave this interval.
	             * 
	             * 
	             * Approach [0] 
	             * The trivial solution is to do nothing, in which case
	             * observers will simply find out themselves according to their 
	             * own poll frequency. This is suboptimal, particularly for
	             * low frequency observers. If there is at least one high-
	             * frequency poller, this could trigger the timeout for all
	             * to be notified. The problem though, is if no observers
	             * are polling.
	             * 
	             * 
	             * Approach [1] 
	             * In cases where the ctrl is deterministic, a timeout
	             * can be calculated. This, though, can be more tricky 
	             * than expected. 
	             * 
	             * - a) 
	             * Motion and linear transitions are easy to calculate, 
	             * but with acceleration in motion, or non-linear easing, 
	             * calculations quickly become more complex
	             * 
	             * - b)
	             * These calculations also assume that the ctrl.ctrl 
	             * is not a monotonic clock with velocity 1. In principle,
	             * there could be a recursive chain of ctrl.ctrl.ctrl.clock
	             * of some length, where all controls would have to be
	             * linear transformations, in order to calculate a deterministic
	             * timeout.
	             * 
	             * Approch [2] 
	             * It would also be possible to sampling future values of the
	             * ctrl to see if the values violate the nearby.itv at some point. 
	             * This would essentially be treating ctrl as a layer and sampling 
	             * future values. This approch would work for all types, 
	             * but there is no knowing how far into the future one 
	             * would have to seek
	             * 
	             * Approach [3] 
	             * It would also be possible to detect the event by
	             * repeatedly polling internally. This would ensure timely
	             * detection, even if all observers are low-frequency pollers..
	             * This would essentially be equivalent to [2], only with 
	             * sampling spread out in time. 
	             *   
	             * 
	             * Note also that an incorrect timeout would NOT ruin things.
	             * It would essentially be equivalent to [0], but would wake up
	             * observers unnessarsarily 
	             * 
	             * 
	             * SOLUTION
	             * As there is no perfect solution, we make the pragmatic 
	             * solution to do approach [1] when the following conditions
	             * hold:
	             * (i) if ctrl is a clock || ctrl.ctrl is a clock
	             * (ii) ctrl.nearby.center has exactly 1 item
	             * (iii) ctrl.nearby.center[0].type == "motion"
	             * (iv) ctrl.nearby.center[0].args.velocity != 0.0 
	             * (v) the prospective cache.nearby.itv low or high 
	             *     are not -Infinity or Infinity
	             * 
	             * This is presumably likely the most common case for playback, 
	             * where precise timing would be of importance
	             * 
	             * In all other cases, we do approach [3], as this is easier than
	             * [2].
	             */
	            let {
	                value: ctrl_offset, 
	                dynamic: ctrl_dynamic,
	            } = this.ctrl.query();
	    
	            /**
	             * - no need for playback timeout if there is no playback
	             */

	            if (!ctrl_dynamic) {
	                return;
	            }

	            /**
	             * - no need for playback timeout if current segment has no boundary
	             * boundary of current segment - low and high
	             */
	            this._cache.refresh(ctrl_offset);
	            const itv = this._cache.nearby.itv;
	            const [low, high] = itv.slice(0,2);
	            if (low == -Infinity && high == Infinity) {
	                return;
	            }

	            /**
	             * - no need for playback timeout if ctrl is not deterministic
	             * - must have exactly on segment item - type motion
	             */
	            let ctrl_items = this.ctrl.items();
	            if (ctrl_items.length != 1) {
	                console.log(`warning: ctrl has multiple items ${this.ctrl}`);
	                return;
	            }
	            const ctrl_item = ctrl_items[0];

	            /**
	             * option [1] 
	             * - deterministic motion
	             * - TODO - expand to fixed duration transitions
	             * 
	             * calculate the time to ctrl.value first hits low or high
	             * i.e. time to end for current motion or transition
	             */
	            if (ctrl_item.type == "motion") {
	                // calculate the time to ctrl.value first hits low or high
	                const {velocity:v0} = ctrl_item.args;
	                // figur out which boundary we hit first
	                // assuming we are currently between low and high
	                let target_position = (v0 > 0) ? high : low;
	                // no need for timeout if boundary is infinity
	                if (isFinite(target_position)) {
	                    // calculate time until hitting target
	                    const delta_sec = Math.abs(target_position - ctrl_offset)/v0;
	                    console.log("set timeout");
	                    this._tid = setTimeout(this.__handle_timeout.bind(this), delta_sec*1000);
	                    return;
	                }

	            }

	            /**
	             * option [2] - polling until ctrl.value is no longer witin itv
	             * NOT SUPPORTED
	             * 
	             * option [3] - do nothing
	             */

	        }
	    }

	    __handle_timeout() {
	        // trigger change event for cursor
	        console.log("timeout");
	        this.eventifyTrigger("change");
	    }



	    /**********************************************************
	     * QUERY API
	     **********************************************************/
	    
	    query () {
	        let {value:offset} = this.ctrl.query();
	        if (typeof offset !== 'number') {
	            throw new Error(`warning: ctrl state must be number ${offset}`);
	        }
	        /**
	         * TODO - if query causes a cache miss, we should generate an
	         * event to let consumers know cursor state has changed.
	         */
	        return this._cache.query(offset);
	    }

	    get value () {return this.query().value};

	    state () {
	        // nearby.center represents the state of the cursor
	        // the ensure that the cache is not stale - run a query first
	        return this._cache.nearby.center;
	    }

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
	        this._index.update(this.src.items);
	        this._cache.dirty();
	        // trigger change event for cursor
	        this.eventifyTrigger("change", this.query());   
	    }

	    /**********************************************************
	     * QUERY API
	     **********************************************************/

	    query(offset) {
	        if (offset == undefined) {
	            throw new Error("Layer: query offset can not be undefined");
	        }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ldmVudGlmeS5qcyIsIi4uLy4uL3NyYy91dGlsLmpzIiwiLi4vLi4vc3JjL21vbml0b3IuanMiLCIuLi8uLi9zcmMvYmFzZXMuanMiLCIuLi8uLi9zcmMvaW50ZXJ2YWxzLmpzIiwiLi4vLi4vc3JjL3N0YXRlcHJvdmlkZXJfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL2NtZC5qcyIsIi4uLy4uL3NyYy9zZWdtZW50cy5qcyIsIi4uLy4uL3NyYy9uZWFyYnljYWNoZS5qcyIsIi4uLy4uL3NyYy9uZWFyYnlpbmRleC5qcyIsIi4uLy4uL3NyYy9uZWFyYnlpbmRleF9zaW1wbGUuanMiLCIuLi8uLi9zcmMvY3Vyc29ycy5qcyIsIi4uLy4uL3NyYy9sYXllcnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcblx0Q29weXJpZ2h0IDIwMjBcblx0QXV0aG9yIDogSW5nYXIgQXJudHplblxuXG5cdFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUaW1pbmdzcmMgbW9kdWxlLlxuXG5cdFRpbWluZ3NyYyBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG5cdGl0IHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieVxuXHR0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvclxuXHQoYXQgeW91ciBvcHRpb24pIGFueSBsYXRlciB2ZXJzaW9uLlxuXG5cdFRpbWluZ3NyYyBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLFxuXHRidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7IHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZlxuXHRNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG5cdEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuXG5cdFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZVxuXHRhbG9uZyB3aXRoIFRpbWluZ3NyYy4gIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiovXG5cblxuXG4vKlxuXHRFdmVudFxuXHQtIG5hbWU6IGV2ZW50IG5hbWVcblx0LSBwdWJsaXNoZXI6IHRoZSBvYmplY3Qgd2hpY2ggZGVmaW5lZCB0aGUgZXZlbnRcblx0LSBpbml0OiB0cnVlIGlmIHRoZSBldmVudCBzdXBwcG9ydHMgaW5pdCBldmVudHNcblx0LSBzdWJzY3JpcHRpb25zOiBzdWJzY3JpcHRpbnMgdG8gdGhpcyBldmVudFxuXG4qL1xuXG5jbGFzcyBFdmVudCB7XG5cblx0Y29uc3RydWN0b3IgKHB1Ymxpc2hlciwgbmFtZSwgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5wdWJsaXNoZXIgPSBwdWJsaXNoZXI7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gZmFsc2UgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zID0gW107XG5cdH1cblxuXHQvKlxuXHRcdHN1YnNjcmliZSB0byBldmVudFxuXHRcdC0gc3Vic2NyaWJlcjogc3Vic2NyaWJpbmcgb2JqZWN0XG5cdFx0LSBjYWxsYmFjazogY2FsbGJhY2sgZnVuY3Rpb24gdG8gaW52b2tlXG5cdFx0LSBvcHRpb25zOlxuXHRcdFx0aW5pdDogaWYgdHJ1ZSBzdWJzY3JpYmVyIHdhbnRzIGluaXQgZXZlbnRzXG5cdCovXG5cdHN1YnNjcmliZSAoY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRpZiAoIWNhbGxiYWNrIHx8IHR5cGVvZiBjYWxsYmFjayAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayBub3QgYSBmdW5jdGlvblwiLCBjYWxsYmFjayk7XG5cdFx0fVxuXHRcdGNvbnN0IHN1YiA9IG5ldyBTdWJzY3JpcHRpb24odGhpcywgY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5wdXNoKHN1Yik7XG5cdCAgICAvLyBJbml0aWF0ZSBpbml0IGNhbGxiYWNrIGZvciB0aGlzIHN1YnNjcmlwdGlvblxuXHQgICAgaWYgKHRoaXMuaW5pdCAmJiBzdWIuaW5pdCkge1xuXHQgICAgXHRzdWIuaW5pdF9wZW5kaW5nID0gdHJ1ZTtcblx0ICAgIFx0bGV0IHNlbGYgPSB0aGlzO1xuXHQgICAgXHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgIFx0XHRjb25zdCBlQXJncyA9IHNlbGYucHVibGlzaGVyLmV2ZW50aWZ5SW5pdEV2ZW50QXJncyhzZWxmLm5hbWUpIHx8IFtdO1xuXHQgICAgXHRcdHN1Yi5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0ICAgIFx0XHRmb3IgKGxldCBlQXJnIG9mIGVBcmdzKSB7XG5cdCAgICBcdFx0XHRzZWxmLnRyaWdnZXIoZUFyZywgW3N1Yl0sIHRydWUpO1xuXHQgICAgXHRcdH1cblx0ICAgIFx0fSk7XG5cdCAgICB9XG5cdFx0cmV0dXJuIHN1YlxuXHR9XG5cblx0Lypcblx0XHR0cmlnZ2VyIGV2ZW50XG5cblx0XHQtIGlmIHN1YiBpcyB1bmRlZmluZWQgLSBwdWJsaXNoIHRvIGFsbCBzdWJzY3JpcHRpb25zXG5cdFx0LSBpZiBzdWIgaXMgZGVmaW5lZCAtIHB1Ymxpc2ggb25seSB0byBnaXZlbiBzdWJzY3JpcHRpb25cblx0Ki9cblx0dHJpZ2dlciAoZUFyZywgc3VicywgaW5pdCkge1xuXHRcdGxldCBlSW5mbywgY3R4O1xuXHRcdGZvciAoY29uc3Qgc3ViIG9mIHN1YnMpIHtcblx0XHRcdC8vIGlnbm9yZSB0ZXJtaW5hdGVkIHN1YnNjcmlwdGlvbnNcblx0XHRcdGlmIChzdWIudGVybWluYXRlZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGVJbmZvID0ge1xuXHRcdFx0XHRzcmM6IHRoaXMucHVibGlzaGVyLFxuXHRcdFx0XHRuYW1lOiB0aGlzLm5hbWUsXG5cdFx0XHRcdHN1Yjogc3ViLFxuXHRcdFx0XHRpbml0OiBpbml0XG5cdFx0XHR9XG5cdFx0XHRjdHggPSBzdWIuY3R4IHx8IHRoaXMucHVibGlzaGVyO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0c3ViLmNhbGxiYWNrLmNhbGwoY3R4LCBlQXJnLCBlSW5mbyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYEVycm9yIGluICR7dGhpcy5uYW1lfTogJHtzdWIuY2FsbGJhY2t9ICR7ZXJyfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qXG5cdHVuc3Vic2NyaWJlIGZyb20gZXZlbnRcblx0LSB1c2Ugc3Vic2NyaXB0aW9uIHJldHVybmVkIGJ5IHByZXZpb3VzIHN1YnNjcmliZVxuXHQqL1xuXHR1bnN1YnNjcmliZShzdWIpIHtcblx0XHRsZXQgaWR4ID0gdGhpcy5zdWJzY3JpcHRpb25zLmluZGV4T2Yoc3ViKTtcblx0XHRpZiAoaWR4ID4gLTEpIHtcblx0XHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdHN1Yi50ZXJtaW5hdGUoKTtcblx0XHR9XG5cdH1cbn1cblxuXG4vKlxuXHRTdWJzY3JpcHRpb24gY2xhc3NcbiovXG5cbmNsYXNzIFN1YnNjcmlwdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoZXZlbnQsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLmV2ZW50ID0gZXZlbnQ7XG5cdFx0dGhpcy5uYW1lID0gZXZlbnQubmFtZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2tcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gdGhpcy5ldmVudC5pbml0IDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gZmFsc2U7XG5cdFx0dGhpcy5jdHggPSBvcHRpb25zLmN0eDtcblx0fVxuXG5cdHRlcm1pbmF0ZSgpIHtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSB0cnVlO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5ldmVudC51bnN1YnNjcmliZSh0aGlzKTtcblx0fVxufVxuXG5cbi8qXG5cblx0RVZFTlRJRlkgSU5TVEFOQ0VcblxuXHRFdmVudGlmeSBicmluZ3MgZXZlbnRpbmcgY2FwYWJpbGl0aWVzIHRvIGFueSBvYmplY3QuXG5cblx0SW4gcGFydGljdWxhciwgZXZlbnRpZnkgc3VwcG9ydHMgdGhlIGluaXRpYWwtZXZlbnQgcGF0dGVybi5cblx0T3B0LWluIGZvciBpbml0aWFsIGV2ZW50cyBwZXIgZXZlbnQgdHlwZS5cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlJbnN0YW5jZSAob2JqZWN0KSB7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwID0gbmV3IE1hcCgpO1xuXHRvYmplY3QuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0cmV0dXJuIG9iamVjdDtcbn07XG5cblxuLypcblx0RVZFTlRJRlkgUFJPVE9UWVBFXG5cblx0QWRkIGV2ZW50aWZ5IGZ1bmN0aW9uYWxpdHkgdG8gcHJvdG90eXBlIG9iamVjdFxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5UHJvdG90eXBlKF9wcm90b3R5cGUpIHtcblxuXHRmdW5jdGlvbiBldmVudGlmeUdldEV2ZW50KG9iamVjdCwgbmFtZSkge1xuXHRcdGNvbnN0IGV2ZW50ID0gb2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAuZ2V0KG5hbWUpO1xuXHRcdGlmIChldmVudCA9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IHVuZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0cmV0dXJuIGV2ZW50O1xuXHR9XG5cblx0Lypcblx0XHRERUZJTkUgRVZFTlRcblx0XHQtIHVzZWQgb25seSBieSBldmVudCBzb3VyY2Vcblx0XHQtIG5hbWU6IG5hbWUgb2YgZXZlbnRcblx0XHQtIG9wdGlvbnM6IHtpbml0OnRydWV9IHNwZWNpZmllcyBpbml0LWV2ZW50IHNlbWFudGljcyBmb3IgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlEZWZpbmUobmFtZSwgb3B0aW9ucykge1xuXHRcdC8vIGNoZWNrIHRoYXQgZXZlbnQgZG9lcyBub3QgYWxyZWFkeSBleGlzdFxuXHRcdGlmICh0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuaGFzKG5hbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCBhbHJlYWR5IGRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5zZXQobmFtZSwgbmV3IEV2ZW50KHRoaXMsIG5hbWUsIG9wdGlvbnMpKTtcblx0fTtcblxuXHQvKlxuXHRcdE9OXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRyZWdpc3RlciBjYWxsYmFjayBvbiBldmVudC5cblx0Ki9cblx0ZnVuY3Rpb24gb24obmFtZSwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpYmUoY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T0ZGXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRVbi1yZWdpc3RlciBhIGhhbmRsZXIgZnJvbSBhIHNwZWNmaWMgZXZlbnQgdHlwZVxuXHQqL1xuXHRmdW5jdGlvbiBvZmYoc3ViKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgc3ViLm5hbWUpLnVuc3Vic2NyaWJlKHN1Yik7XG5cdH07XG5cblxuXHRmdW5jdGlvbiBldmVudGlmeVN1YnNjcmlwdGlvbnMobmFtZSkge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmlwdGlvbnM7XG5cdH1cblxuXG5cblx0Lypcblx0XHRUcmlnZ2VyIGxpc3Qgb2YgZXZlbnRJdGVtcyBvbiBvYmplY3RcblxuXHRcdGV2ZW50SXRlbTogIHtuYW1lOi4uLCBlQXJnOi4ufVxuXG5cdFx0Y29weSBhbGwgZXZlbnRJdGVtcyBpbnRvIGJ1ZmZlci5cblx0XHRyZXF1ZXN0IGVtcHR5aW5nIHRoZSBidWZmZXIsIGkuZS4gYWN0dWFsbHkgdHJpZ2dlcmluZyBldmVudHMsXG5cdFx0ZXZlcnkgdGltZSB0aGUgYnVmZmVyIGdvZXMgZnJvbSBlbXB0eSB0byBub24tZW1wdHlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxsKGV2ZW50SXRlbXMpIHtcblx0XHRpZiAoZXZlbnRJdGVtcy5sZW5ndGggPT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIG1ha2UgdHJpZ2dlciBpdGVtc1xuXHRcdC8vIHJlc29sdmUgbm9uLXBlbmRpbmcgc3Vic2NyaXB0aW9ucyBub3dcblx0XHQvLyBlbHNlIHN1YnNjcmlwdGlvbnMgbWF5IGNoYW5nZSBmcm9tIHBlbmRpbmcgdG8gbm9uLXBlbmRpbmdcblx0XHQvLyBiZXR3ZWVuIGhlcmUgYW5kIGFjdHVhbCB0cmlnZ2VyaW5nXG5cdFx0Ly8gbWFrZSBsaXN0IG9mIFtldiwgZUFyZywgc3Vic10gdHVwbGVzXG5cdFx0bGV0IHRyaWdnZXJJdGVtcyA9IGV2ZW50SXRlbXMubWFwKChpdGVtKSA9PiB7XG5cdFx0XHRsZXQge25hbWUsIGVBcmd9ID0gaXRlbTtcblx0XHRcdGxldCBldiA9IGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSk7XG5cdFx0XHRsZXQgc3VicyA9IGV2LnN1YnNjcmlwdGlvbnMuZmlsdGVyKHN1YiA9PiBzdWIuaW5pdF9wZW5kaW5nID09IGZhbHNlKTtcblx0XHRcdHJldHVybiBbZXYsIGVBcmcsIHN1YnNdO1xuXHRcdH0sIHRoaXMpO1xuXG5cdFx0Ly8gYXBwZW5kIHRyaWdnZXIgSXRlbXMgdG8gYnVmZmVyXG5cdFx0Y29uc3QgbGVuID0gdHJpZ2dlckl0ZW1zLmxlbmd0aDtcblx0XHRjb25zdCBidWYgPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyO1xuXHRcdGNvbnN0IGJ1Zl9sZW4gPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aDtcblx0XHQvLyByZXNlcnZlIG1lbW9yeSAtIHNldCBuZXcgbGVuZ3RoXG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGggPSBidWZfbGVuICsgbGVuO1xuXHRcdC8vIGNvcHkgdHJpZ2dlckl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGZvciAobGV0IGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0YnVmW2J1Zl9sZW4raV0gPSB0cmlnZ2VySXRlbXNbaV07XG5cdFx0fVxuXHRcdC8vIHJlcXVlc3QgZW1wdHlpbmcgb2YgdGhlIGJ1ZmZlclxuXHRcdGlmIChidWZfbGVuID09IDApIHtcblx0XHRcdGxldCBzZWxmID0gdGhpcztcblx0XHRcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGZvciAobGV0IFtldiwgZUFyZywgc3Vic10gb2Ygc2VsZi5fX2V2ZW50aWZ5X2J1ZmZlcikge1xuXHRcdFx0XHRcdC8vIGFjdHVhbCBldmVudCB0cmlnZ2VyaW5nXG5cdFx0XHRcdFx0ZXYudHJpZ2dlcihlQXJnLCBzdWJzLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZi5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIG11bHRpcGxlIGV2ZW50cyBvZiBzYW1lIHR5cGUgKG5hbWUpXG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsaWtlKG5hbWUsIGVBcmdzKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKGVBcmdzLm1hcChlQXJnID0+IHtcblx0XHRcdHJldHVybiB7bmFtZSwgZUFyZ307XG5cdFx0fSkpO1xuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIHNpbmdsZSBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXIobmFtZSwgZUFyZykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChbe25hbWUsIGVBcmd9XSk7XG5cdH1cblxuXHRfcHJvdG90eXBlLmV2ZW50aWZ5RGVmaW5lID0gZXZlbnRpZnlEZWZpbmU7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyID0gZXZlbnRpZnlUcmlnZ2VyO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsaWtlID0gZXZlbnRpZnlUcmlnZ2VyQWxpa2U7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxsID0gZXZlbnRpZnlUcmlnZ2VyQWxsO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5U3Vic2NyaXB0aW9ucyA9IGV2ZW50aWZ5U3Vic2NyaXB0aW9ucztcblx0X3Byb3RvdHlwZS5vbiA9IG9uO1xuXHRfcHJvdG90eXBlLm9mZiA9IG9mZjtcbn07XG5cblxuZXhwb3J0IGNvbnN0IGV2ZW50aWZ5ID0gZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4ge1xuXHRcdGFkZFRvSW5zdGFuY2U6IGV2ZW50aWZ5SW5zdGFuY2UsXG5cdFx0YWRkVG9Qcm90b3R5cGU6IGV2ZW50aWZ5UHJvdG90eXBlXG5cdH1cbn0oKTtcblxuLypcblx0RXZlbnQgVmFyaWFibGVcblxuXHRPYmplY3RzIHdpdGggYSBzaW5nbGUgXCJjaGFuZ2VcIiBldmVudFxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50VmFyaWFibGUge1xuXG5cdGNvbnN0cnVjdG9yICh2YWx1ZSkge1xuXHRcdGV2ZW50aWZ5SW5zdGFuY2UodGhpcyk7XG5cdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHR0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcblx0fVxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5fdmFsdWV9O1xuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlICE9IHRoaXMuX3ZhbHVlKSB7XG5cdFx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuZXZlbnRpZnlQcm90b3R5cGUoRXZlbnRWYXJpYWJsZS5wcm90b3R5cGUpO1xuXG4vKlxuXHRFdmVudCBCb29sZWFuXG5cblxuXHROb3RlIDogaW1wbGVtZW50YXRpb24gdXNlcyBmYWxzaW5lc3Mgb2YgaW5wdXQgcGFyYW1ldGVyIHRvIGNvbnN0cnVjdG9yIGFuZCBzZXQoKSBvcGVyYXRpb24sXG5cdHNvIGV2ZW50Qm9vbGVhbigtMSkgd2lsbCBhY3R1YWxseSBzZXQgaXQgdG8gdHJ1ZSBiZWNhdXNlXG5cdCgtMSkgPyB0cnVlIDogZmFsc2UgLT4gdHJ1ZSAhXG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRCb29sZWFuIGV4dGVuZHMgRXZlbnRWYXJpYWJsZSB7XG5cdGNvbnN0cnVjdG9yKHZhbHVlKSB7XG5cdFx0c3VwZXIoQm9vbGVhbih2YWx1ZSkpO1xuXHR9XG5cblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdHN1cGVyLnZhbHVlID0gQm9vbGVhbih2YWx1ZSk7XG5cdH1cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gc3VwZXIudmFsdWV9O1xufVxuXG5cbi8qXG5cdG1ha2UgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gRXZlbnRCb29sZWFuIGNoYW5nZXNcblx0dmFsdWUuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQcm9taXNlKGV2ZW50T2JqZWN0LCBjb25kaXRpb25GdW5jKSB7XG5cdGNvbmRpdGlvbkZ1bmMgPSBjb25kaXRpb25GdW5jIHx8IGZ1bmN0aW9uKHZhbCkge3JldHVybiB2YWwgPT0gdHJ1ZX07XG5cdHJldHVybiBuZXcgUHJvbWlzZSAoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdGxldCBzdWIgPSBldmVudE9iamVjdC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdGlmIChjb25kaXRpb25GdW5jKHZhbHVlKSkge1xuXHRcdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHRcdFx0ZXZlbnRPYmplY3Qub2ZmKHN1Yik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufTtcblxuLy8gbW9kdWxlIGFwaVxuZXhwb3J0IGRlZmF1bHQge1xuXHRldmVudGlmeVByb3RvdHlwZSxcblx0ZXZlbnRpZnlJbnN0YW5jZSxcblx0RXZlbnRWYXJpYWJsZSxcblx0RXZlbnRCb29sZWFuLFxuXHRtYWtlUHJvbWlzZVxufTtcblxuIiwiXG4vLyBvdnZlcnJpZGUgbW9kdWxvIHRvIGJlaGF2ZSBiZXR0ZXIgZm9yIG5lZ2F0aXZlIG51bWJlcnNcbmV4cG9ydCBmdW5jdGlvbiBtb2QobiwgbSkge1xuICAgIHJldHVybiAoKG4gJSBtKSArIG0pICUgbTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBkaXZtb2QoeCwgYmFzZSkge1xuICAgIGxldCBuID0gTWF0aC5mbG9vcih4IC8gYmFzZSlcbiAgICBsZXQgciA9IG1vZCh4LCBiYXNlKTtcbiAgICByZXR1cm4gW24sIHJdO1xufVxuXG5cbi8qXG4gICAgc2ltaWxhciB0byByYW5nZSBmdW5jdGlvbiBpbiBweXRob25cbiovXG5cbmV4cG9ydCBmdW5jdGlvbiByYW5nZSAoc3RhcnQsIGVuZCwgc3RlcCA9IDEsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICBjb25zdCB7aW5jbHVkZV9lbmQ9ZmFsc2V9ID0gb3B0aW9ucztcbiAgICBpZiAoc3RlcCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0ZXAgY2Fubm90IGJlIHplcm8uJyk7XG4gICAgfVxuICAgIGlmIChzdGFydCA8IGVuZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gc3RlcCkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChzdGFydCA+IGVuZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPiBlbmQ7IGkgLT0gc3RlcCkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChpbmNsdWRlX2VuZCkge1xuICAgICAgICByZXN1bHQucHVzaChlbmQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5cblxuLypcbiAgICBUaGlzIGFkZHMgYmFzaWMgKHN5bmNocm9ub3VzKSBjYWxsYmFjayBzdXBwb3J0IHRvIGFuIG9iamVjdC5cbiovXG5cbmV4cG9ydCBjb25zdCBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHtcblxuICAgIGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2Uob2JqZWN0KSB7XG4gICAgICAgIG9iamVjdC5fX2NhbGxiYWNrX2NhbGxiYWNrcyA9IFtdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZF9jYWxsYmFjayAoaGFuZGxlcikge1xuICAgICAgICBsZXQgaGFuZGxlID0ge1xuICAgICAgICAgICAgaGFuZGxlcjogaGFuZGxlclxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX19jYWxsYmFja19jYWxsYmFja3MucHVzaChoYW5kbGUpO1xuICAgICAgICByZXR1cm4gaGFuZGxlO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiByZW1vdmVfY2FsbGJhY2sgKGhhbmRsZSkge1xuICAgICAgICBsZXQgaW5kZXggPSB0aGlzLl9fY2FsbGJhY2tfY2FsbGJhY2tzLmluZGV4b2YoaGFuZGxlKTtcbiAgICAgICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuX19jYWxsYmFja19jYWxsYmFja3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBub3RpZnlfY2FsbGJhY2tzIChlQXJnKSB7XG4gICAgICAgIHRoaXMuX19jYWxsYmFja19jYWxsYmFja3MuZm9yRWFjaChmdW5jdGlvbihoYW5kbGUpIHtcbiAgICAgICAgICAgIGhhbmRsZS5oYW5kbGVyKGVBcmcpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG5cbiAgICBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuICAgICAgICBjb25zdCBhcGkgPSB7XG4gICAgICAgICAgICBhZGRfY2FsbGJhY2ssIHJlbW92ZV9jYWxsYmFjaywgbm90aWZ5X2NhbGxiYWNrc1xuICAgICAgICB9XG4gICAgICAgIE9iamVjdC5hc3NpZ24oX3Byb3RvdHlwZSwgYXBpKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge2FkZFRvSW5zdGFuY2UsIGFkZFRvUHJvdG90eXBlfVxufSgpO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIFNPVVJDRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBFeHRlbmQgYSBjbGFzcyB3aXRoIHN1cHBvcnQgZm9yIGV4dGVybmFsIHNvdXJjZSBvbiBcbiAqIGEgbmFtZWQgcHJvcGVydHkuXG4gKiBcbiAqIG9wdGlvbjogbXV0YWJsZTp0cnVlIG1lYW5zIHRoYXQgcHJvcGVyeSBtYXkgYmUgcmVzZXQgXG4gKiBcbiAqIHNvdXJjZSBvYmplY3QgaXMgYXNzdW1lZCB0byBzdXBwb3J0IHRoZSBjYWxsYmFjayBpbnRlcmZhY2VcbiAqL1xuXG5cbmV4cG9ydCBjb25zdCBzb3VyY2UgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICBmdW5jdGlvbiBwcm9wbmFtZXMgKHByb3BOYW1lKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwcm9wOiBgX18ke3Byb3BOYW1lfWAsXG4gICAgICAgICAgICBpbml0OiBgX18ke3Byb3BOYW1lfV9pbml0YCxcbiAgICAgICAgICAgIGhhbmRsZTogYF9fJHtwcm9wTmFtZX1faGFuZGxlYCxcbiAgICAgICAgICAgIGNoYW5nZTogYF9fJHtwcm9wTmFtZX1faGFuZGxlX2NoYW5nZWAsXG4gICAgICAgICAgICBkZXRhdGNoOiBgX18ke3Byb3BOYW1lfV9kZXRhdGNoYCxcbiAgICAgICAgICAgIGF0dGF0Y2g6IGBfXyR7cHJvcE5hbWV9X2F0dGF0Y2hgLFxuICAgICAgICAgICAgY2hlY2s6IGBfXyR7cHJvcE5hbWV9X2NoZWNrYFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkVG9JbnN0YW5jZSAob2JqZWN0LCBwcm9wTmFtZSkge1xuICAgICAgICBjb25zdCBwID0gcHJvcG5hbWVzKHByb3BOYW1lKVxuICAgICAgICBvYmplY3RbcC5wcm9wXSA9IHVuZGVmaW5lZFxuICAgICAgICBvYmplY3RbcC5pbml0XSA9IGZhbHNlO1xuICAgICAgICBvYmplY3RbcC5oYW5kbGVdID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlIChfcHJvdG90eXBlLCBwcm9wTmFtZSwgb3B0aW9ucz17fSkge1xuXG4gICAgICAgIGNvbnN0IHAgPSBwcm9wbmFtZXMocHJvcE5hbWUpXG5cbiAgICAgICAgZnVuY3Rpb24gZGV0YXRjaCgpIHtcbiAgICAgICAgICAgIC8vIHVuc3Vic2NyaWJlIGZyb20gc291cmNlIGNoYW5nZSBldmVudFxuICAgICAgICAgICAgbGV0IHttdXRhYmxlPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgICAgICAgICBpZiAobXV0YWJsZSAmJiB0aGlzW3AucHJvcF0pIHtcbiAgICAgICAgICAgICAgICBsZXQgaGFuZGxlID0gdGhpc1twLmhhbmRsZV07XG4gICAgICAgICAgICAgICAgdGhpc1twLnByb3BdLnJlbW92ZV9jYWxsYmFjayhoYW5kbGUpO1xuICAgICAgICAgICAgICAgIHRoaXNbcC5oYW5kbGVdID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpc1twLnByb3BdID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIGZ1bmN0aW9uIGF0dGF0Y2goc291cmNlKSB7XG4gICAgICAgICAgICBsZXQge211dGFibGU9ZmFsc2V9ID0gb3B0aW9ucztcbiAgICAgICAgICAgIGlmICghdGhpc1twLmluaXRdIHx8IG11dGFibGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzW3AucHJvcF0gPSBzb3VyY2U7XG4gICAgICAgICAgICAgICAgdGhpc1twLmluaXRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAvLyBzdWJzY3JpYmUgdG8gY2FsbGJhY2sgZnJvbSBzb3VyY2VcbiAgICAgICAgICAgICAgICBpZiAodGhpc1twLmNoYW5nZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IHRoaXNbcC5jaGFuZ2VdLmJpbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbcC5oYW5kbGVdID0gc291cmNlLmFkZF9jYWxsYmFjayhoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlcigpOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtwcm9wTmFtZX0gY2FuIG5vdCBiZSByZWFzc2lnbmVkYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogXG4gICAgICAgICAqIG9iamVjdCBtdXN0IGltcGxlbWVudFxuICAgICAgICAgKiBfX3twcm9wTmFtZX1faGFuZGxlX2NoYW5nZSgpIHt9XG4gICAgICAgICAqIFxuICAgICAgICAgKiBvYmplY3QgY2FuIGltcGxlbWVudFxuICAgICAgICAgKiBfX3twcm9wTmFtZX1fY2hlY2soc291cmNlKSB7fVxuICAgICAgICAgKi9cblxuICAgICAgICAvLyBnZXR0ZXIgYW5kIHNldHRlclxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoX3Byb3RvdHlwZSwgcHJvcE5hbWUsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzW3AucHJvcF07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAoc3JjKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXNbcC5jaGVja10pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1twLmNoZWNrXShzcmMpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzcmMgIT0gdGhpc1twLnByb3BdKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbcC5kZXRhdGNoXSgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzW3AuYXR0YXRjaF0oc3JjKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgYXBpID0ge307XG4gICAgICAgIGFwaVtwLmRldGF0Y2hdID0gZGV0YXRjaDtcbiAgICAgICAgYXBpW3AuYXR0YXRjaF0gPSBhdHRhdGNoO1xuXG4gICAgICAgIE9iamVjdC5hc3NpZ24oX3Byb3RvdHlwZSwgYXBpKTtcbiAgICB9XG4gICAgcmV0dXJuIHthZGRUb0luc3RhbmNlLCBhZGRUb1Byb3RvdHlwZX07XG59KCk7XG5cbiIsImltcG9ydCB7ZGl2bW9kfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5cbi8qXG4gICAgVGltZW91dCBNb25pdG9yXG5cbiAgICBUaW1lb3V0IE1vbml0b3IgaXMgc2ltaWxhciB0byBzZXRJbnRlcnZhbCwgaW4gdGhlIHNlbnNlIHRoYXQgXG4gICAgaXQgYWxsb3dzIGNhbGxiYWNrcyB0byBiZSBmaXJlZCBwZXJpb2RpY2FsbHkgXG4gICAgd2l0aCBhIGdpdmVuIGRlbGF5IChpbiBtaWxsaXMpLiAgXG4gICAgXG4gICAgVGltZW91dCBNb25pdG9yIGlzIG1hZGUgdG8gc2FtcGxlIHRoZSBzdGF0ZSBcbiAgICBvZiBhIGR5bmFtaWMgb2JqZWN0LCBwZXJpb2RpY2FsbHkuIEZvciB0aGlzIHJlYXNvbiwgZWFjaCBjYWxsYmFjayBpcyBcbiAgICBib3VuZCB0byBhIG1vbml0b3JlZCBvYmplY3QsIHdoaWNoIHdlIGhlcmUgY2FsbCBhIHZhcmlhYmxlLiBcbiAgICBPbiBlYWNoIGludm9jYXRpb24sIGEgY2FsbGJhY2sgd2lsbCBwcm92aWRlIGEgZnJlc2hseSBzYW1wbGVkIFxuICAgIHZhbHVlIGZyb20gdGhlIHZhcmlhYmxlLlxuXG4gICAgVGhpcyB2YWx1ZSBpcyBhc3N1bWVkIHRvIGJlIGF2YWlsYWJsZSBieSBxdWVyeWluZyB0aGUgdmFyaWFibGUuIFxuXG4gICAgICAgIHYucXVlcnkoKSAtPiB7dmFsdWUsIGR5bmFtaWMsIG9mZnNldCwgdHN9XG5cbiAgICBJbiBhZGRpdGlvbiwgdGhlIHZhcmlhYmxlIG9iamVjdCBtYXkgc3dpdGNoIGJhY2sgYW5kIFxuICAgIGZvcnRoIGJldHdlZW4gZHluYW1pYyBhbmQgc3RhdGljIGJlaGF2aW9yLiBUaGUgVGltZW91dCBNb25pdG9yXG4gICAgdHVybnMgcG9sbGluZyBvZmYgd2hlbiB0aGUgdmFyaWFibGUgaXMgbm8gbG9uZ2VyIGR5bmFtaWMsIFxuICAgIGFuZCByZXN1bWVzIHBvbGxpbmcgd2hlbiB0aGUgb2JqZWN0IGJlY29tZXMgZHluYW1pYy5cblxuICAgIFN0YXRlIGNoYW5nZXMgYXJlIGV4cGVjdGVkIHRvIGJlIHNpZ25hbGxlZCB0aHJvdWdoIGEgPGNoYW5nZT4gZXZlbnQuXG5cbiAgICAgICAgc3ViID0gdi5vbihcImNoYW5nZVwiLCBjYWxsYmFjaylcbiAgICAgICAgdi5vZmYoc3ViKVxuXG4gICAgQ2FsbGJhY2tzIGFyZSBpbnZva2VkIG9uIGV2ZXJ5IDxjaGFuZ2U+IGV2ZW50LCBhcyB3ZWxsXG4gICAgYXMgcGVyaW9kaWNhbGx5IHdoZW4gdGhlIG9iamVjdCBpcyBpbiA8ZHluYW1pYz4gc3RhdGUuXG5cbiAgICAgICAgY2FsbGJhY2soe3ZhbHVlLCBkeW5hbWljLCBvZmZzZXQsIHRzfSlcblxuICAgIEZ1cnRoZXJtb3JlLCBpbiBvcmRlciB0byBzdXBwb3J0IGNvbnNpc3RlbnQgcmVuZGVyaW5nIG9mXG4gICAgc3RhdGUgY2hhbmdlcyBmcm9tIG1hbnkgZHluYW1pYyB2YXJpYWJsZXMsIGl0IGlzIGltcG9ydGFudCB0aGF0XG4gICAgY2FsbGJhY2tzIGFyZSBpbnZva2VkIGF0IHRoZSBzYW1lIHRpbWUgYXMgbXVjaCBhcyBwb3NzaWJsZSwgc29cbiAgICB0aGF0IGNoYW5nZXMgdGhhdCBvY2N1ciBuZWFyIGluIHRpbWUgY2FuIGJlIHBhcnQgb2YgdGhlIHNhbWVcbiAgICBzY3JlZW4gcmVmcmVzaC4gXG5cbiAgICBGb3IgdGhpcyByZWFzb24sIHRoZSBUaW1lb3V0TW9uaXRvciBncm91cHMgY2FsbGJhY2tzIGluIHRpbWVcbiAgICBhbmQgaW52b2tlcyBjYWxsYmFja3MgYXQgYXQgZml4ZWQgbWF4aW11bSByYXRlICgyMEh6LzUwbXMpLlxuICAgIFRoaXMgaW1wbGllcyB0aGF0IHBvbGxpbmcgY2FsbGJhY2tzIHdpbGwgZmFsbCBvbiBhIHNoYXJlZCBcbiAgICBwb2xsaW5nIGZyZXF1ZW5jeS5cblxuICAgIEF0IHRoZSBzYW1lIHRpbWUsIGNhbGxiYWNrcyBtYXkgaGF2ZSBpbmRpdmlkdWFsIGZyZXF1ZW5jaWVzIHRoYXRcbiAgICBhcmUgbXVjaCBsb3dlciByYXRlIHRoYW4gdGhlIG1heGltdW0gcmF0ZS4gVGhlIGltcGxlbWVudGF0aW9uXG4gICAgZG9lcyBub3QgcmVseSBvbiBhIGZpeGVkIDUwbXMgdGltZW91dCBmcmVxdWVuY3ksIGJ1dCBpcyB0aW1lb3V0IGJhc2VkLFxuICAgIHRodXMgdGhlcmUgaXMgbm8gcHJvY2Vzc2luZyBvciB0aW1lb3V0IGJldHdlZW4gY2FsbGJhY2tzLCBldmVuXG4gICAgaWYgYWxsIGNhbGxiYWNrcyBoYXZlIGxvdyByYXRlcy5cblxuICAgIEl0IGlzIHNhZmUgdG8gZGVmaW5lIG11bHRpcGxlIGNhbGxhYmFja3MgZm9yIGEgc2luZ2xlIHZhcmlhYmxlLCBlYWNoXG4gICAgY2FsbGJhY2sgd2l0aCBhIGRpZmZlcmVudCBwb2xsaW5nIGZyZXF1ZW5jeS5cblxuICAgIG9wdGlvbnNcbiAgICAgICAgPHJhdGU+IC0gZGVmYXVsdCA1MDogc3BlY2lmeSBtaW5pbXVtIGZyZXF1ZW5jeSBpbiBtc1xuXG4qL1xuXG5cbmNvbnN0IFJBVEVfTVMgPSA1MFxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBUSU1FT1VUIE1PTklUT1JcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBCYXNlIGNsYXNzIGZvciBUaW1lb3V0IE1vbml0b3IgYW5kIEZyYW1lcmF0ZSBNb25pdG9yXG4qL1xuXG5jbGFzcyBUaW1lb3V0TW9uaXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG5cbiAgICAgICAgdGhpcy5fb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe3JhdGU6IFJBVEVfTVN9LCBvcHRpb25zKTtcbiAgICAgICAgaWYgKHRoaXMuX29wdGlvbnMucmF0ZSA8IFJBVEVfTVMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgaWxsZWdhbCByYXRlICR7cmF0ZX0sIG1pbmltdW0gcmF0ZSBpcyAke1JBVEVfTVN9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLypcbiAgICAgICAgICAgIG1hcFxuICAgICAgICAgICAgaGFuZGxlIC0+IHtjYWxsYmFjaywgdmFyaWFibGUsIGRlbGF5fVxuICAgICAgICAgICAgLSB2YXJpYWJsZTogdGFyZ2V0IGZvciBzYW1wbGluZ1xuICAgICAgICAgICAgLSBjYWxsYmFjazogZnVuY3Rpb24odmFsdWUpXG4gICAgICAgICAgICAtIGRlbGF5OiBiZXR3ZWVuIHNhbXBsZXMgKHdoZW4gdmFyaWFibGUgaXMgZHluYW1pYylcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2V0ID0gbmV3IFNldCgpO1xuICAgICAgICAvKlxuICAgICAgICAgICAgdmFyaWFibGUgbWFwXG4gICAgICAgICAgICB2YXJpYWJsZSAtPiB7c3ViLCBwb2xsaW5nLCBoYW5kbGVzOltdfVxuICAgICAgICAgICAgLSBzdWIgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgICAgICAgICAtIHBvbGxpbmc6IHRydWUgaWYgdmFyaWFibGUgbmVlZHMgcG9sbGluZ1xuICAgICAgICAgICAgLSBoYW5kbGVzOiBsaXN0IG9mIGhhbmRsZXMgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgICAgICovXG4gICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgLy8gdmFyaWFibGUgY2hhbmdlIGhhbmRsZXJcbiAgICAgICAgdGhpcy5fX29udmFyaWFibGVjaGFuZ2UgPSB0aGlzLl9vbnZhcmlhYmxlY2hhbmdlLmJpbmQodGhpcyk7XG4gICAgfVxuXG4gICAgYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIC8vIHJlZ2lzdGVyIGJpbmRpbmdcbiAgICAgICAgbGV0IGhhbmRsZSA9IHtjYWxsYmFjaywgdmFyaWFibGUsIGRlbGF5fTtcbiAgICAgICAgdGhpcy5fc2V0LmFkZChoYW5kbGUpO1xuICAgICAgICAvLyByZWdpc3RlciB2YXJpYWJsZVxuICAgICAgICBpZiAoIXRoaXMuX3ZhcmlhYmxlX21hcC5oYXModmFyaWFibGUpKSB7XG4gICAgICAgICAgICBsZXQgc3ViID0gdmFyaWFibGUub24oXCJjaGFuZ2VcIiwgdGhpcy5fX29udmFyaWFibGVjaGFuZ2UpO1xuICAgICAgICAgICAgbGV0IGl0ZW0gPSB7c3ViLCBwb2xsaW5nOmZhbHNlLCBoYW5kbGVzOiBbaGFuZGxlXX07XG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuc2V0KHZhcmlhYmxlLCBpdGVtKTtcbiAgICAgICAgICAgIC8vdGhpcy5fcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpLmhhbmRsZXMucHVzaChoYW5kbGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBoYW5kbGU7XG4gICAgfVxuXG4gICAgcmVsZWFzZShoYW5kbGUpIHtcbiAgICAgICAgLy8gY2xlYW51cFxuICAgICAgICBsZXQgcmVtb3ZlZCA9IHRoaXMuX3NldC5kZWxldGUoaGFuZGxlKTtcbiAgICAgICAgaWYgKCFyZW1vdmVkKSByZXR1cm47XG4gICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNsZWFudXAgdmFyaWFibGUgbWFwXG4gICAgICAgIGxldCB2YXJpYWJsZSA9IGhhbmRsZS52YXJpYWJsZTtcbiAgICAgICAgbGV0IHtzdWIsIGhhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCBpZHggPSBoYW5kbGVzLmluZGV4T2YoaGFuZGxlKTtcbiAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICBoYW5kbGVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChoYW5kbGVzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAvLyB2YXJpYWJsZSBoYXMgbm8gaGFuZGxlc1xuICAgICAgICAgICAgLy8gY2xlYW51cCB2YXJpYWJsZSBtYXBcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5kZWxldGUodmFyaWFibGUpO1xuICAgICAgICAgICAgdmFyaWFibGUub2ZmKHN1Yik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICB2YXJpYWJsZSBlbWl0cyBhIGNoYW5nZSBldmVudFxuICAgICovXG4gICAgX29udmFyaWFibGVjaGFuZ2UgKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIGxldCB2YXJpYWJsZSA9IGVJbmZvLnNyYztcbiAgICAgICAgLy8gZGlyZWN0IGNhbGxiYWNrIC0gY291bGQgdXNlIGVBcmcgaGVyZVxuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCBzdGF0ZSA9IGVBcmc7XG4gICAgICAgIC8vIHJlZXZhbHVhdGUgcG9sbGluZ1xuICAgICAgICB0aGlzLl9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUsIHN0YXRlKTtcbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICBoYW5kbGUuY2FsbGJhY2soc3RhdGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgc3RhcnQgb3Igc3RvcCBwb2xsaW5nIGlmIG5lZWRlZFxuICAgICovXG4gICAgX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSwgc3RhdGUpIHtcbiAgICAgICAgbGV0IGl0ZW0gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IHtwb2xsaW5nOndhc19wb2xsaW5nfSA9IGl0ZW07XG4gICAgICAgIHN0YXRlID0gc3RhdGUgfHwgdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgbGV0IHNob3VsZF9iZV9wb2xsaW5nID0gc3RhdGUuZHluYW1pYztcbiAgICAgICAgaWYgKCF3YXNfcG9sbGluZyAmJiBzaG91bGRfYmVfcG9sbGluZykge1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0cyh2YXJpYWJsZSk7XG4gICAgICAgIH0gZWxzZSBpZiAod2FzX3BvbGxpbmcgJiYgIXNob3VsZF9iZV9wb2xsaW5nKSB7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHNldCB0aW1lb3V0IGZvciBhbGwgY2FsbGJhY2tzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICovXG4gICAgX3NldF90aW1lb3V0cyh2YXJpYWJsZSkge1xuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3NldF90aW1lb3V0KGhhbmRsZSkge1xuICAgICAgICBsZXQgZGVsdGEgPSB0aGlzLl9jYWxjdWxhdGVfZGVsdGEoaGFuZGxlLmRlbGF5KTtcbiAgICAgICAgbGV0IGhhbmRsZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLl9oYW5kbGVfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIGhhbmRsZS50aWQgPSBzZXRUaW1lb3V0KGhhbmRsZXIsIGRlbHRhKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBhZGp1c3QgZGVsYXkgc28gdGhhdCBpZiBmYWxscyBvblxuICAgICAgICB0aGUgbWFpbiB0aWNrIHJhdGVcbiAgICAqL1xuICAgIF9jYWxjdWxhdGVfZGVsdGEoZGVsYXkpIHtcbiAgICAgICAgbGV0IHJhdGUgPSB0aGlzLl9vcHRpb25zLnJhdGU7XG4gICAgICAgIGxldCBub3cgPSBNYXRoLnJvdW5kKHBlcmZvcm1hbmNlLm5vdygpKTtcbiAgICAgICAgbGV0IFtub3dfbiwgbm93X3JdID0gZGl2bW9kKG5vdywgcmF0ZSk7XG4gICAgICAgIGxldCBbbiwgcl0gPSBkaXZtb2Qobm93ICsgZGVsYXksIHJhdGUpO1xuICAgICAgICBsZXQgdGFyZ2V0ID0gTWF0aC5tYXgobiwgbm93X24gKyAxKSpyYXRlO1xuICAgICAgICByZXR1cm4gdGFyZ2V0IC0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgY2xlYXIgYWxsIHRpbWVvdXRzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICovXG4gICAgX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKSB7XG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIGlmIChoYW5kbGUudGlkICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dChoYW5kbGUudGlkKTtcbiAgICAgICAgICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgaGFuZGxlIHRpbWVvdXRcbiAgICAqL1xuICAgIF9oYW5kbGVfdGltZW91dChoYW5kbGUpIHtcbiAgICAgICAgLy8gZHJvcCBpZiBoYW5kbGUgdGlkIGhhcyBiZWVuIGNsZWFyZWRcbiAgICAgICAgaWYgKGhhbmRsZS50aWQgPT0gdW5kZWZpbmVkKSByZXR1cm47XG4gICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhbGxiYWNrXG4gICAgICAgIGxldCB7dmFyaWFibGV9ID0gaGFuZGxlO1xuICAgICAgICBsZXQgc3RhdGUgPSB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICAvLyByZXNjaGVkdWxlIHRpbWVvdXRzIGZvciBjYWxsYmFja3NcbiAgICAgICAgaWYgKHN0YXRlLmR5bmFtaWMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvKlxuICAgICAgICAgICAgICAgIG1ha2Ugc3VyZSBwb2xsaW5nIHN0YXRlIGlzIGFsc28gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzIHdvdWxkIG9ubHkgb2NjdXIgaWYgdGhlIHZhcmlhYmxlXG4gICAgICAgICAgICAgICAgd2VudCBmcm9tIHJlcG9ydGluZyBkeW5hbWljIHRydWUgdG8gZHluYW1pYyBmYWxzZSxcbiAgICAgICAgICAgICAgICB3aXRob3V0IGVtbWl0dGluZyBhIGNoYW5nZSBldmVudCAtIHRodXNcbiAgICAgICAgICAgICAgICB2aW9sYXRpbmcgdGhlIGFzc3VtcHRpb24uIFRoaXMgcHJlc2VydmVzXG4gICAgICAgICAgICAgICAgaW50ZXJuYWwgaW50ZWdyaXR5IGkgdGhlIG1vbml0b3IuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgbGV0IGl0ZW0gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIC8vXG4gICAgICAgIGhhbmRsZS5jYWxsYmFjayhzdGF0ZSk7XG4gICAgfVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEZSQU1FUkFURSBNT05JVE9SXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuY2xhc3MgRnJhbWVyYXRlTW9uaXRvciBleHRlbmRzIFRpbWVvdXRNb25pdG9yIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICAgIHRoaXMuX2hhbmRsZTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICB0aW1lb3V0cyBhcmUgb2Jzb2xldGVcbiAgICAqL1xuICAgIF9zZXRfdGltZW91dHModmFyaWFibGUpIHt9XG4gICAgX3NldF90aW1lb3V0KGhhbmRsZSkge31cbiAgICBfY2FsY3VsYXRlX2RlbHRhKGRlbGF5KSB7fVxuICAgIF9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSkge31cbiAgICBfaGFuZGxlX3RpbWVvdXQoaGFuZGxlKSB7fVxuXG4gICAgX29udmFyaWFibGVjaGFuZ2UgKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIHN1cGVyLl9vbnZhcmlhYmxlY2hhbmdlKGVBcmcsIGVJbmZvKTtcbiAgICAgICAgLy8ga2ljayBvZmYgY2FsbGJhY2sgbG9vcCBkcml2ZW4gYnkgcmVxdWVzdCBhbmltYXRpb25mcmFtZVxuICAgICAgICB0aGlzLl9jYWxsYmFjaygpO1xuICAgIH1cblxuICAgIF9jYWxsYmFjaygpIHtcbiAgICAgICAgLy8gY2FsbGJhY2sgdG8gYWxsIHZhcmlhYmxlcyB3aGljaCByZXF1aXJlIHBvbGxpbmdcbiAgICAgICAgbGV0IHZhcmlhYmxlcyA9IFsuLi50aGlzLl92YXJpYWJsZV9tYXAuZW50cmllcygpXVxuICAgICAgICAgICAgLmZpbHRlcigoW3ZhcmlhYmxlLCBpdGVtXSkgPT4gaXRlbS5wb2xsaW5nKVxuICAgICAgICAgICAgLm1hcCgoW3ZhcmlhYmxlLCBpdGVtXSkgPT4gdmFyaWFibGUpO1xuICAgICAgICBpZiAodmFyaWFibGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIGNhbGxiYWNrXG4gICAgICAgICAgICBmb3IgKGxldCB2YXJpYWJsZSBvZiB2YXJpYWJsZXMpIHtcbiAgICAgICAgICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgICAgICAgICAgbGV0IHJlcyA9IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHJlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogXG4gICAgICAgICAgICAgICAgcmVxdWVzdCBuZXh0IGNhbGxiYWNrIGFzIGxvbmcgYXMgYXQgbGVhc3Qgb25lIHZhcmlhYmxlIFxuICAgICAgICAgICAgICAgIGlzIHJlcXVpcmluZyBwb2xsaW5nXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMuX2NhbGxiYWNrLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBCSU5EIFJFTEVBU0VcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuY29uc3QgbW9uaXRvciA9IG5ldyBUaW1lb3V0TW9uaXRvcigpO1xuY29uc3QgZnJhbWVyYXRlX21vbml0b3IgPSBuZXcgRnJhbWVyYXRlTW9uaXRvcigpO1xuXG5leHBvcnQgZnVuY3Rpb24gYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgbGV0IGhhbmRsZTtcbiAgICBpZiAoQm9vbGVhbihwYXJzZUZsb2F0KGRlbGF5KSkpIHtcbiAgICAgICAgaGFuZGxlID0gbW9uaXRvci5iaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gW1widGltZW91dFwiLCBoYW5kbGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGhhbmRsZSA9IGZyYW1lcmF0ZV9tb25pdG9yLmJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCAwLCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIFtcImZyYW1lcmF0ZVwiLCBoYW5kbGVdO1xuICAgIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiByZWxlYXNlKGhhbmRsZSkge1xuICAgIGxldCBbdHlwZSwgX2hhbmRsZV0gPSBoYW5kbGU7XG4gICAgaWYgKHR5cGUgPT0gXCJ0aW1lb3V0XCIpIHtcbiAgICAgICAgcmV0dXJuIG1vbml0b3IucmVsZWFzZShfaGFuZGxlKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJmcmFtZXJhdGVcIikge1xuICAgICAgICByZXR1cm4gZnJhbWVyYXRlX21vbml0b3IucmVsZWFzZShfaGFuZGxlKTtcbiAgICB9XG59XG5cbiIsImltcG9ydCB7IGV2ZW50aWZ5IH0gZnJvbSBcIi4vZXZlbnRpZnkuanNcIjtcbmltcG9ydCB7IGNhbGxiYWNrIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgYmluZCwgcmVsZWFzZSB9IGZyb20gXCIuL21vbml0b3IuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU1RBVEUgUFJPVklERVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBCYXNlIGNsYXNzIGZvciBhbGwgc3RhdGUgcHJvdmlkZXJzXG5cbiAgICAtIG9iamVjdCB3aXRoIGNvbGxlY3Rpb24gb2YgaXRlbXNcbiAgICAtIGNvdWxkIGJlIGxvY2FsIC0gb3IgcHJveHkgdG8gb25saW5lIHNvdXJjZVxuXG4gICAgcmVwcmVzZW50cyBhIGR5bmFtaWMgY29sbGVjdGlvbiBvZiBpdGVtc1xuICAgIHtpdHYsIHR5cGUsIC4uLmRhdGF9XG4qL1xuXG5leHBvcnQgY2xhc3MgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogdXBkYXRlIGZ1bmN0aW9uXG4gICAgICogY2FsbGVkIGZyb20gY3Vyc29yIG9yIGxheWVyIG9iamVjdHNcbiAgICAgKiBmb3Igb25saW5lIGltcGxlbWVudGF0aW9uLCB0aGlzIHdpbGxcbiAgICAgKiB0eXBpY2FsbHkgcmVzdWx0IGluIGEgbmV0d29yayByZXF1ZXN0IFxuICAgICAqIHRvIHVwZGF0ZSBzb21lIG9ubGluZSBpdGVtIGNvbGxlY3Rpb25cbiAgICAgKi9cbiAgICB1cGRhdGUoaXRlbXMpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIGFycmF5IHdpdGggYWxsIGl0ZW1zIGluIGNvbGxlY3Rpb24gXG4gICAgICogLSBubyByZXF1aXJlbWVudCB3cnQgb3JkZXJcbiAgICAgKi9cblxuICAgIGdldCBpdGVtcygpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNpZ25hbCBpZiBpdGVtcyBjYW4gYmUgb3ZlcmxhcHBpbmcgb3Igbm90XG4gICAgICovXG5cbiAgICBnZXQgaW5mbyAoKSB7XG4gICAgICAgIHJldHVybiB7b3ZlcmxhcHBpbmc6IHRydWV9O1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKFN0YXRlUHJvdmlkZXJCYXNlLnByb3RvdHlwZSk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTEFZRVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIExheWVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFFVRVJZXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBxdWVyeSAob2Zmc2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShMYXllckJhc2UucHJvdG90eXBlKTtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBDVVJTT1IgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIEN1cnNvckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICBjYWxsYmFjay5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICAvLyBkZWZpbmUgY2hhbmdlIGV2ZW50XG4gICAgICAgIGV2ZW50aWZ5LmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlEZWZpbmUoXCJjaGFuZ2VcIiwge2luaXQ6dHJ1ZX0pO1xuICAgIH1cbiAgICBcbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFFVRVJZXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBxdWVyeSAoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICBzdGF0ZSgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuXG4gICAgLypcbiAgICAgICAgRXZlbnRpZnk6IGltbWVkaWF0ZSBldmVudHNcbiAgICAqL1xuICAgIGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG4gICAgICAgIGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBbdGhpcy5xdWVyeSgpXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogQklORCBSRUxFQVNFIChjb252ZW5pZW5jZSlcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGJpbmQoY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHJldHVybiBiaW5kKHRoaXMsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgICAgIHJldHVybiByZWxlYXNlKGhhbmRsZSk7XG4gICAgfVxuXG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShDdXJzb3JCYXNlLnByb3RvdHlwZSk7XG5ldmVudGlmeS5hZGRUb1Byb3RvdHlwZShDdXJzb3JCYXNlLnByb3RvdHlwZSk7XG5cbiIsIi8qXG4gICAgXG4gICAgSU5URVJWQUwgRU5EUE9JTlRTXG5cbiAgICAqIGludGVydmFsIGVuZHBvaW50cyBhcmUgZGVmaW5lZCBieSBbdmFsdWUsIHNpZ25dLCBmb3IgZXhhbXBsZVxuICAgICogXG4gICAgKiA0KSAtPiBbNCwtMV0gLSBlbmRwb2ludCBpcyBvbiB0aGUgbGVmdCBvZiA0XG4gICAgKiBbNCwgNCwgNF0gLT4gWzQsIDBdIC0gZW5kcG9pbnQgaXMgYXQgNCBcbiAgICAqICg0IC0+IFs0LCAxXSAtIGVuZHBvaW50IGlzIG9uIHRoZSByaWdodCBvZiA0KVxuICAgICogXG4gICAgKiBUaGlzIHJlcHJlc2VudGF0aW9uIGVuc3VyZXMgdGhhdCB0aGUgaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBvcmRlcmVkIGFuZCBhbGxvd3NcbiAgICAqIGludGVydmFscyB0byBiZSBleGNsdXNpdmUgb3IgaW5jbHVzaXZlLCB5ZXQgY292ZXIgdGhlIGVudGlyZSByZWFsIGxpbmUgXG4gICAgKiBcbiAgICAqIFthLGJdLCAoYSxiKSwgW2EsYiksIFthLCBiKSBhcmUgYWxsIHZhbGlkIGludGVydmFsc1xuXG4qL1xuXG4vKlxuICAgIEVuZHBvaW50IGNvbXBhcmlzb25cbiAgICByZXR1cm5zIFxuICAgICAgICAtIG5lZ2F0aXZlIDogY29ycmVjdCBvcmRlclxuICAgICAgICAtIDAgOiBlcXVhbFxuICAgICAgICAtIHBvc2l0aXZlIDogd3Jvbmcgb3JkZXJcblxuXG4gICAgTk9URSBcbiAgICAtIGNtcCg0XSxbNCApID09IDAgLSBzaW5jZSB0aGVzZSBhcmUgdGhlIHNhbWUgd2l0aCByZXNwZWN0IHRvIHNvcnRpbmdcbiAgICAtIGJ1dCBpZiB5b3Ugd2FudCB0byBzZWUgaWYgdHdvIGludGVydmFscyBhcmUgb3ZlcmxhcHBpbmcgaW4gdGhlIGVuZHBvaW50c1xuICAgIGNtcChoaWdoX2EsIGxvd19iKSA+IDAgdGhpcyB3aWxsIG5vdCBiZSBnb29kXG4gICAgXG4qLyBcblxuXG5mdW5jdGlvbiBjbXBOdW1iZXJzKGEsIGIpIHtcbiAgICBpZiAoYSA9PT0gYikgcmV0dXJuIDA7XG4gICAgaWYgKGEgPT09IEluZmluaXR5KSByZXR1cm4gMTtcbiAgICBpZiAoYiA9PT0gSW5maW5pdHkpIHJldHVybiAtMTtcbiAgICBpZiAoYSA9PT0gLUluZmluaXR5KSByZXR1cm4gLTE7XG4gICAgaWYgKGIgPT09IC1JbmZpbml0eSkgcmV0dXJuIDE7XG4gICAgcmV0dXJuIGEgLSBiO1xuICB9XG5cbmZ1bmN0aW9uIGVuZHBvaW50X2NtcCAocDEsIHAyKSB7XG4gICAgbGV0IFt2MSwgczFdID0gcDE7XG4gICAgbGV0IFt2MiwgczJdID0gcDI7XG4gICAgbGV0IGRpZmYgPSBjbXBOdW1iZXJzKHYxLCB2Mik7XG4gICAgcmV0dXJuIChkaWZmICE9IDApID8gZGlmZiA6IHMxIC0gczI7XG59XG5cbmZ1bmN0aW9uIGVuZHBvaW50X2x0IChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPCAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9sZSAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpIDw9IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2d0IChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPiAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9nZSAocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50X2NtcChwMSwgcDIpID49IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2VxIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPT0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfbWluKHAxLCBwMikge1xuICAgIHJldHVybiAoZW5kcG9pbnRfbGUocDEsIHAyKSkgPyBwMSA6IHAyO1xufVxuZnVuY3Rpb24gZW5kcG9pbnRfbWF4KHAxLCBwMikge1xuICAgIHJldHVybiAoZW5kcG9pbnRfZ2UocDEsIHAyKSkgPyBwMSA6IHAyO1xufVxuXG4vKipcbiAqIGZsaXAgZW5kcG9pbnQgdG8gdGhlIG90aGVyIHNpZGVcbiAqIFxuICogdXNlZnVsIGZvciBtYWtpbmcgYmFjay10by1iYWNrIGludGVydmFscyBcbiAqIFxuICogaGlnaCkgPC0+IFtsb3dcbiAqIGhpZ2hdIDwtPiAobG93XG4gKi9cblxuZnVuY3Rpb24gZW5kcG9pbnRfZmxpcChwLCB0YXJnZXQpIHtcbiAgICBsZXQgW3Ysc10gPSBwO1xuICAgIGlmICh0YXJnZXQgPT0gXCJsb3dcIikge1xuICAgIFx0Ly8gYXNzdW1lIHBvaW50IGlzIGhpZ2g6IHNpZ24gbXVzdCBiZSAtMSBvciAwXG4gICAgXHRpZiAocyA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcImVuZHBvaW50IGlzIGFscmVhZHkgbG93XCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcysxXTtcbiAgICB9IGVsc2UgaWYgKHRhcmdldCA9PSBcImhpZ2hcIikge1xuXHRcdC8vIGFzc3VtZSBwb2ludCBpcyBsb3c6IHNpZ24gaXMgMCBvciAxXG4gICAgXHRpZiAocyA8IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcImVuZHBvaW50IGlzIGFscmVhZHkgaGlnaFwiKTsgICAgXHRcdFxuICAgIFx0fVxuICAgICAgICBwID0gW3YsIHMtMV07XG4gICAgfSBlbHNlIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgdHlwZVwiLCB0YXJnZXQpO1xuICAgIH1cbiAgICByZXR1cm4gcDtcbn1cblxuXG4vKlxuICAgIHJldHVybnMgbG93IGFuZCBoaWdoIGVuZHBvaW50cyBmcm9tIGludGVydmFsXG4qL1xuZnVuY3Rpb24gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KSB7XG4gICAgbGV0IFtsb3csIGhpZ2gsIGxvd0Nsb3NlZCwgaGlnaENsb3NlZF0gPSBpdHY7XG4gICAgbGV0IGxvd19wID0gKGxvd0Nsb3NlZCkgPyBbbG93LCAwXSA6IFtsb3csIDFdOyBcbiAgICBsZXQgaGlnaF9wID0gKGhpZ2hDbG9zZWQpID8gW2hpZ2gsIDBdIDogW2hpZ2gsIC0xXTtcbiAgICByZXR1cm4gW2xvd19wLCBoaWdoX3BdO1xufVxuXG5cbi8qXG4gICAgSU5URVJWQUxTXG5cbiAgICBJbnRlcnZhbHMgYXJlIFtsb3csIGhpZ2gsIGxvd0Nsb3NlZCwgaGlnaENsb3NlZF1cblxuKi8gXG5cbi8qXG4gICAgcmV0dXJuIHRydWUgaWYgcG9pbnQgcCBpcyBjb3ZlcmVkIGJ5IGludGVydmFsIGl0dlxuICAgIHBvaW50IHAgY2FuIGJlIG51bWJlciBwIG9yIGEgcG9pbnQgW3Asc11cblxuICAgIGltcGxlbWVudGVkIGJ5IGNvbXBhcmluZyBwb2ludHNcbiAgICBleGNlcHRpb24gaWYgaW50ZXJ2YWwgaXMgbm90IGRlZmluZWRcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBwKSB7XG4gICAgbGV0IFtsb3dfcCwgaGlnaF9wXSA9IGVuZHBvaW50c19mcm9tX2ludGVydmFsKGl0dik7XG4gICAgLy8gY292ZXJzOiBsb3cgPD0gcCA8PSBoaWdoXG4gICAgcmV0dXJuIGVuZHBvaW50X2xlKGxvd19wLCBwKSAmJiBlbmRwb2ludF9sZShwLCBoaWdoX3ApO1xufVxuLy8gY29udmVuaWVuY2VcbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19wb2ludChpdHYsIHApIHtcbiAgICByZXR1cm4gaW50ZXJ2YWxfY292ZXJzX2VuZHBvaW50KGl0diwgW3AsIDBdKTtcbn1cblxuXG5cbi8qXG4gICAgUmV0dXJuIHRydWUgaWYgaW50ZXJ2YWwgaGFzIGxlbmd0aCAwXG4qL1xuZnVuY3Rpb24gaW50ZXJ2YWxfaXNfc2luZ3VsYXIoaW50ZXJ2YWwpIHtcbiAgICByZXR1cm4gaW50ZXJ2YWxbMF0gPT0gaW50ZXJ2YWxbMV1cbn1cblxuLypcbiAgICBDcmVhdGUgaW50ZXJ2YWwgZnJvbSBlbmRwb2ludHNcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyhwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICAvLyBwMSBtdXN0IGJlIGEgbG93IHBvaW50XG4gICAgaWYgKHMxID09IC0xKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgbG93IHBvaW50XCIsIHAxKTtcbiAgICB9XG4gICAgaWYgKHMyID09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdlYWwgaGlnaCBwb2ludFwiLCBwMik7ICAgXG4gICAgfVxuICAgIHJldHVybiBbdjEsIHYyLCAoczE9PTApLCAoczI9PTApXVxufVxuXG5cbmV4cG9ydCBjb25zdCBlbmRwb2ludCA9IHtcbiAgICBsZTogZW5kcG9pbnRfbGUsXG4gICAgbHQ6IGVuZHBvaW50X2x0LFxuICAgIGdlOiBlbmRwb2ludF9nZSxcbiAgICBndDogZW5kcG9pbnRfZ3QsXG4gICAgY21wOiBlbmRwb2ludF9jbXAsXG4gICAgZXE6IGVuZHBvaW50X2VxLFxuICAgIG1pbjogZW5kcG9pbnRfbWluLFxuICAgIG1heDogZW5kcG9pbnRfbWF4LFxuICAgIGZsaXA6IGVuZHBvaW50X2ZsaXAsXG4gICAgZnJvbV9pbnRlcnZhbDogZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWxcbn1cbmV4cG9ydCBjb25zdCBpbnRlcnZhbCA9IHtcbiAgICBjb3ZlcnNfZW5kcG9pbnQ6IGludGVydmFsX2NvdmVyc19lbmRwb2ludCxcbiAgICBjb3ZlcnNfcG9pbnQ6IGludGVydmFsX2NvdmVyc19wb2ludCwgXG4gICAgaXNfc2luZ3VsYXI6IGludGVydmFsX2lzX3Npbmd1bGFyLFxuICAgIGZyb21fZW5kcG9pbnRzOiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50c1xufVxuIiwiaW1wb3J0IHtTdGF0ZVByb3ZpZGVyQmFzZX0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7ZW5kcG9pbnR9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU0lNUExFIFNUQVRFIFBST1ZJREVSIChMT0NBTClcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMb2NhbCBBcnJheSB3aXRoIG5vbi1vdmVybGFwcGluZyBpdGVtcy5cbiAqL1xuXG5leHBvcnQgY2xhc3MgU2ltcGxlU3RhdGVQcm92aWRlciBleHRlbmRzIFN0YXRlUHJvdmlkZXJCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLy8gaW5pdGlhbGl6YXRpb25cbiAgICAgICAgbGV0IHtpdGVtcywgdmFsdWV9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKGl0ZW1zICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5faXRlbXMgPSBjaGVja19pbnB1dChpdGVtcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9pdGVtcyA9IFt7aXR2OlstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSwgYXJnczp7dmFsdWV9fV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9pdGVtcyA9IFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlIChpdGVtcykge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pdGVtcyA9IGNoZWNrX2lucHV0KGl0ZW1zKTtcbiAgICAgICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldCBpdGVtcyAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pdGVtcy5zbGljZSgpO1xuICAgIH1cblxuICAgIGdldCBpbmZvICgpIHtcbiAgICAgICAgcmV0dXJuIHtkeW5hbWljOiB0cnVlLCBvdmVybGFwcGluZzogZmFsc2UsIGxvY2FsOnRydWV9O1xuICAgIH1cbn1cblxuXG5mdW5jdGlvbiBjaGVja19pbnB1dChpdGVtcykge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShpdGVtcykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW5wdXQgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICB9XG4gICAgLy8gc29ydCBpdGVtcyBiYXNlZCBvbiBpbnRlcnZhbCBsb3cgZW5kcG9pbnRcbiAgICBpdGVtcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGxldCBhX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYS5pdHYpWzBdO1xuICAgICAgICBsZXQgYl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGIuaXR2KVswXTtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmNtcChhX2xvdywgYl9sb3cpO1xuICAgIH0pO1xuICAgIC8vIGNoZWNrIHRoYXQgaXRlbSBpbnRlcnZhbHMgYXJlIG5vbi1vdmVybGFwcGluZ1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IHByZXZfaGlnaCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaSAtIDFdLml0dilbMV07XG4gICAgICAgIGxldCBjdXJyX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaV0uaXR2KVswXTtcbiAgICAgICAgLy8gdmVyaWZ5IHRoYXQgcHJldiBoaWdoIGlzIGxlc3MgdGhhdCBjdXJyIGxvd1xuICAgICAgICBpZiAoIWVuZHBvaW50Lmx0KHByZXZfaGlnaCwgY3Vycl9sb3cpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPdmVybGFwcGluZyBpbnRlcnZhbHMgZm91bmRcIik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG4iLCJcbmltcG9ydCB7IFN0YXRlUHJvdmlkZXJCYXNlLCBDdXJzb3JCYXNlIH0gZnJvbSBcIi4vYmFzZXNcIjtcbmNvbnN0IE1FVEhPRFMgPSB7YXNzaWduLCBtb3ZlLCB0cmFuc2l0aW9uLCBpbnRlcnBvbGF0ZX07XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGNtZCAodGFyZ2V0KSB7XG4gICAgaWYgKCEodGFyZ2V0IGluc3RhbmNlb2YgQ3Vyc29yQmFzZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YXJnZXQgbXVzdCBiZSBjdXJzb3IgJHt0YXJnZXR9YCk7XG4gICAgfVxuICAgIGlmICghKHRhcmdldC5zcmMgaW5zdGFuY2VvZiBTdGF0ZVByb3ZpZGVyQmFzZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YXJnZXQuc3JjIG11c3QgYmUgc3RhdGVwcm92aWRlciAke3RhcmdldH1gKTtcbiAgICB9XG4gICAgbGV0IGVudHJpZXMgPSBPYmplY3QuZW50cmllcyhNRVRIT0RTKVxuICAgICAgICAubWFwKChbbmFtZSwgbWV0aG9kXSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKC4uLmFyZ3MpIHsgXG4gICAgICAgICAgICAgICAgICAgIGxldCBpdGVtcyA9IG1ldGhvZC5jYWxsKHRoaXMsIHRhcmdldCwgLi4uYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXQuc3JjLnVwZGF0ZShpdGVtcyk7ICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuICAgIHJldHVybiBPYmplY3QuZnJvbUVudHJpZXMoZW50cmllcyk7XG59XG5cbmZ1bmN0aW9uIGFzc2lnbih0YXJnZXQsIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IGl0ZW0gPSB7XG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBhcmdzOiB7dmFsdWV9ICAgICAgICAgICAgICAgICBcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW2l0ZW1dO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gbW92ZSh0YXJnZXQsIHZlY3Rvcj17fSkge1xuICAgIGxldCB7dmFsdWUsIHJhdGUsIG9mZnNldH0gPSB0YXJnZXQucXVlcnkoKTtcbiAgICBsZXQge3Bvc2l0aW9uPXZhbHVlLCB2ZWxvY2l0eT1yYXRlfSA9IHZlY3RvcjtcbiAgICBsZXQgaXRlbSA9IHtcbiAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgIHR5cGU6IFwibW90aW9uXCIsXG4gICAgICAgIGFyZ3M6IHtwb3NpdGlvbiwgdmVsb2NpdHksIHRpbWVzdGFtcDpvZmZzZXR9ICAgICAgICAgICAgICAgICBcbiAgICB9XG4gICAgcmV0dXJuIFtpdGVtXTtcbn1cblxuZnVuY3Rpb24gdHJhbnNpdGlvbih0YXJnZXQsIHYwLCB2MSwgdDAsIHQxLCBlYXNpbmcpIHtcbiAgICBsZXQgaXRlbXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgdDAsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBhcmdzOiB7dmFsdWU6djB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJ0cmFuc2l0aW9uXCIsXG4gICAgICAgICAgICBhcmdzOiB7djAsIHYxLCB0MCwgdDEsIGVhc2luZ31cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDEsIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBhcmdzOiB7dmFsdWU6IHYxfVxuICAgICAgICB9XG4gICAgXVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUodGFyZ2V0LCB0dXBsZXMpIHtcbiAgICBsZXQgW3YwLCB0MF0gPSB0dXBsZXNbMF07XG4gICAgbGV0IFt2MSwgdDFdID0gdHVwbGVzW3R1cGxlcy5sZW5ndGgtMV07XG5cbiAgICBsZXQgaXRlbXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgdDAsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBhcmdzOiB7dmFsdWU6djB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJpbnRlcnBvbGF0aW9uXCIsXG4gICAgICAgICAgICBhcmdzOiB7dHVwbGVzfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTogdjF9XG4gICAgICAgIH1cbiAgICBdICAgIFxuICAgIHJldHVybiBpdGVtcztcbn1cblxuXG5cbiIsImltcG9ydCB7aW50ZXJ2YWx9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuQkFTRSBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuXHRBYnN0cmFjdCBCYXNlIENsYXNzIGZvciBTZWdtZW50c1xuXG4gICAgY29uc3RydWN0b3IoaW50ZXJ2YWwpXG5cbiAgICAtIGludGVydmFsOiBpbnRlcnZhbCBvZiB2YWxpZGl0eSBvZiBzZWdtZW50XG4gICAgLSBkeW5hbWljOiB0cnVlIGlmIHNlZ21lbnQgaXMgZHluYW1pY1xuICAgIC0gdmFsdWUob2Zmc2V0KTogdmFsdWUgb2Ygc2VnbWVudCBhdCBvZmZzZXRcbiAgICAtIHF1ZXJ5KG9mZnNldCk6IHN0YXRlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4qL1xuXG5leHBvcnQgY2xhc3MgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0dikge1xuXHRcdHRoaXMuX2l0diA9IGl0djtcblx0fVxuXG5cdGdldCBpdHYoKSB7cmV0dXJuIHRoaXMuX2l0djt9XG5cbiAgICAvKiogXG4gICAgICogaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3NcbiAgICAgKiByZXR1cm5zIHt2YWx1ZSwgZHluYW1pY307XG4gICAgKi9cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjb252ZW5pZW5jZSBmdW5jdGlvbiByZXR1cm5pbmcgdGhlIHN0YXRlIG9mIHRoZSBzZWdtZW50XG4gICAgICogQHBhcmFtIHsqfSBvZmZzZXQgXG4gICAgICogQHJldHVybnMgXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5faXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuc3RhdGUob2Zmc2V0KSwgb2Zmc2V0fTtcbiAgICAgICAgfSBcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdW5kZWZpbmVkLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExBWUVSUyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBMYXllcnNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX2xheWVycyA9IGFyZ3MubGF5ZXJzO1xuICAgICAgICB0aGlzLl92YWx1ZV9mdW5jID0gYXJncy52YWx1ZV9mdW5jXG5cbiAgICAgICAgLy8gVE9ETyAtIGZpZ3VyZSBvdXQgZHluYW1pYyBoZXJlP1xuICAgIH1cblxuXHRzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgLy8gVE9ETyAtIHVzZSB2YWx1ZSBmdW5jXG4gICAgICAgIC8vIGZvciBub3cgLSBqdXN0IHVzZSBmaXJzdCBsYXllclxuICAgICAgICByZXR1cm4gey4uLnRoaXMuX2xheWVyc1swXS5xdWVyeShvZmZzZXQpLCBvZmZzZXR9O1xuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU1RBVElDIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIFN0YXRpY1NlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG5cdFx0dGhpcy5fdmFsdWUgPSBhcmdzLnZhbHVlO1xuXHR9XG5cblx0c3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3ZhbHVlLCBkeW5hbWljOmZhbHNlfVxuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTU9USU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qXG4gICAgSW1wbGVtZW50cyBkZXRlcm1pbmlzdGljIHByb2plY3Rpb24gYmFzZWQgb24gaW5pdGlhbCBjb25kaXRpb25zIFxuICAgIC0gbW90aW9uIHZlY3RvciBkZXNjcmliZXMgbW90aW9uIHVuZGVyIGNvbnN0YW50IGFjY2VsZXJhdGlvblxuKi9cblxuZXhwb3J0IGNsYXNzIE1vdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG4gICAgXG4gICAgY29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOnAwLCB2ZWxvY2l0eTp2MCwgdGltZXN0YW1wOnQwXG4gICAgICAgIH0gPSBhcmdzO1xuICAgICAgICAvLyBjcmVhdGUgbW90aW9uIHRyYW5zaXRpb25cbiAgICAgICAgY29uc3QgYTAgPSAwO1xuICAgICAgICB0aGlzLl92ZWxvY2l0eSA9IHYwO1xuICAgICAgICB0aGlzLl9wb3NpdGlvbiA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgbGV0IGQgPSB0cyAtIHQwO1xuICAgICAgICAgICAgcmV0dXJuIHAwICsgdjAqZCArIDAuNSphMCpkKmQ7XG4gICAgICAgIH07ICAgXG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB2YWx1ZTogdGhpcy5fcG9zaXRpb24ob2Zmc2V0KSwgXG4gICAgICAgICAgICByYXRlOiB0aGlzLl92ZWxvY2l0eSwgXG4gICAgICAgICAgICBkeW5hbWljOiB0aGlzLl92ZWxvY2l0eSAhPSAwXG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVFJBTlNJVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgU3VwcG9ydGVkIGVhc2luZyBmdW5jdGlvbnNcbiAgICBcImVhc2UtaW5cIjpcbiAgICBcImVhc2Utb3V0XCI6XG4gICAgXCJlYXNlLWluLW91dFwiXG4qL1xuXG5mdW5jdGlvbiBlYXNlaW4gKHRzKSB7XG4gICAgcmV0dXJuIE1hdGgucG93KHRzLDIpOyAgXG59XG5mdW5jdGlvbiBlYXNlb3V0ICh0cykge1xuICAgIHJldHVybiAxIC0gZWFzZWluKDEgLSB0cyk7XG59XG5mdW5jdGlvbiBlYXNlaW5vdXQgKHRzKSB7XG4gICAgaWYgKHRzIDwgLjUpIHtcbiAgICAgICAgcmV0dXJuIGVhc2VpbigyICogdHMpIC8gMjtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gKDIgLSBlYXNlaW4oMiAqICgxIC0gdHMpKSkgLyAyO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRyYW5zaXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuXHRcdHN1cGVyKGl0dik7XG4gICAgICAgIGxldCB7djAsIHYxLCBlYXNpbmd9ID0gYXJncztcbiAgICAgICAgbGV0IFt0MCwgdDFdID0gdGhpcy5faXR2LnNsaWNlKDAsMik7XG5cbiAgICAgICAgLy8gY3JlYXRlIHRoZSB0cmFuc2l0aW9uIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuX2R5bmFtaWMgPSB2MS12MCAhPSAwO1xuICAgICAgICB0aGlzLl90cmFucyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgLy8gY29udmVydCB0cyB0byBbdDAsdDFdLXNwYWNlXG4gICAgICAgICAgICAvLyAtIHNoaWZ0IGZyb20gW3QwLHQxXS1zcGFjZSB0byBbMCwodDEtdDApXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzY2FsZSBmcm9tIFswLCh0MS10MCldLXNwYWNlIHRvIFswLDFdLXNwYWNlXG4gICAgICAgICAgICB0cyA9IHRzIC0gdDA7XG4gICAgICAgICAgICB0cyA9IHRzL3BhcnNlRmxvYXQodDEtdDApO1xuICAgICAgICAgICAgLy8gZWFzaW5nIGZ1bmN0aW9ucyBzdHJldGNoZXMgb3IgY29tcHJlc3NlcyB0aGUgdGltZSBzY2FsZSBcbiAgICAgICAgICAgIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluXCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2Vpbih0cyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVhc2luZyA9PSBcImVhc2Utb3V0XCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2VvdXQodHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW5vdXQodHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbGluZWFyIHRyYW5zaXRpb24gZnJvbSB2MCB0byB2MSwgZm9yIHRpbWUgdmFsdWVzIFswLDFdXG4gICAgICAgICAgICB0cyA9IE1hdGgubWF4KHRzLCAwKTtcbiAgICAgICAgICAgIHRzID0gTWF0aC5taW4odHMsIDEpO1xuICAgICAgICAgICAgcmV0dXJuIHYwICsgKHYxLXYwKSp0cztcbiAgICAgICAgfVxuXHR9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dGhpcy5fZHluYW1pY31cblx0fVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgSU5URVJQT0xBVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogRnVuY3Rpb24gdG8gY3JlYXRlIGFuIGludGVycG9sYXRvciBmb3IgbmVhcmVzdCBuZWlnaGJvciBpbnRlcnBvbGF0aW9uIHdpdGhcbiAqIGV4dHJhcG9sYXRpb24gc3VwcG9ydC5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSB0dXBsZXMgLSBBbiBhcnJheSBvZiBbdmFsdWUsIG9mZnNldF0gcGFpcnMsIHdoZXJlIHZhbHVlIGlzIHRoZVxuICogcG9pbnQncyB2YWx1ZSBhbmQgb2Zmc2V0IGlzIHRoZSBjb3JyZXNwb25kaW5nIG9mZnNldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gLSBBIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYW4gb2Zmc2V0IGFuZCByZXR1cm5zIHRoZVxuICogaW50ZXJwb2xhdGVkIG9yIGV4dHJhcG9sYXRlZCB2YWx1ZS5cbiAqL1xuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZSh0dXBsZXMpIHtcblxuICAgIGlmICh0dXBsZXMubGVuZ3RoIDwgMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdW5kZWZpbmVkO31cbiAgICB9IGVsc2UgaWYgKHR1cGxlcy5sZW5ndGggPT0gMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdHVwbGVzWzBdWzBdO31cbiAgICB9XG5cbiAgICAvLyBTb3J0IHRoZSB0dXBsZXMgYnkgdGhlaXIgb2Zmc2V0c1xuICAgIGNvbnN0IHNvcnRlZFR1cGxlcyA9IFsuLi50dXBsZXNdLnNvcnQoKGEsIGIpID0+IGFbMV0gLSBiWzFdKTtcbiAgXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvcihvZmZzZXQpIHtcbiAgICAgIC8vIEhhbmRsZSBleHRyYXBvbGF0aW9uIGJlZm9yZSB0aGUgZmlyc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPD0gc29ydGVkVHVwbGVzWzBdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzWzBdO1xuICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1sxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBhZnRlciB0aGUgbGFzdCBwb2ludFxuICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAyXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdO1xuICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICB9XG4gIFxuICAgICAgLy8gRmluZCB0aGUgbmVhcmVzdCBwb2ludHMgdG8gdGhlIGxlZnQgYW5kIHJpZ2h0XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvcnRlZFR1cGxlcy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbaV1bMV0gJiYgb2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1tpICsgMV1bMV0pIHtcbiAgICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tpXTtcbiAgICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1tpICsgMV07XG4gICAgICAgICAgLy8gTGluZWFyIGludGVycG9sYXRpb24gZm9ybXVsYTogeSA9IHkxICsgKCAoeCAtIHgxKSAqICh5MiAtIHkxKSAvICh4MiAtIHgxKSApXG4gICAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gIFxuICAgICAgLy8gSW4gY2FzZSB0aGUgb2Zmc2V0IGRvZXMgbm90IGZhbGwgd2l0aGluIGFueSByYW5nZSAoc2hvdWxkIGJlIGNvdmVyZWQgYnkgdGhlIHByZXZpb3VzIGNvbmRpdGlvbnMpXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH07XG59XG4gIFxuXG5leHBvcnQgY2xhc3MgSW50ZXJwb2xhdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cbiAgICBjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcbiAgICAgICAgLy8gc2V0dXAgaW50ZXJwb2xhdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl90cmFucyA9IGludGVycG9sYXRlKGFyZ3MudHVwbGVzKTtcbiAgICB9XG5cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdGhpcy5fdHJhbnMob2Zmc2V0KSwgZHluYW1pYzp0cnVlfTtcbiAgICB9XG59XG5cblxuIiwiaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCAqIGFzIHNlZ21lbnQgZnJvbSBcIi4vc2VnbWVudHMuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE5FQVJCWSBDQUNIRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIFRoaXMgaW1wbGVtZW50cyBhIGNhY2hlIGluIGZyb250IG9mIGEgTmVhcmJ5SW5kZXguXG4gICAgXG4gICAgVGhlIHB1cnBvc2Ugb2YgY2FjaGluZyBpcyB0byBvcHRpbWl6ZSBmb3IgcmVwZWF0ZWRcbiAgICBxdWVyaWVzIHRvIGEgTmVhcmJ5SW5kZXggdG8gbmVhcmJ5IG9mZnNldHMuXG5cbiAgICBUaGUgY2FjaGUgc3RhdGUgaW5jbHVkZXMgdGhlIG5lYXJieSBzdGF0ZSBmcm9tIHRoZSBcbiAgICBpbmRleCwgYW5kIGFsc28gdGhlIGNhY2hlZCBzZWdtZW50cyBjb3JyZXNwb25kaW5nXG4gICAgdG8gdGhhdCBzdGF0ZS4gVGhpcyB3YXksIG9uIGEgY2FjaGUgaGl0LCB0aGUgXG4gICAgcXVlcnkgbWF5IGJlIHNhdGlzZmllZCBkaXJlY3RseSBmcm9tIHRoZSBjYWNoZS5cblxuICAgIFRoZSBjYWNoZSBpcyBtYXJrZWQgYXMgZGlydHkgd2hlbiB0aGUgTmVhcmJ5IGluZGV4ZXMgY2hhbmdlcy5cbiovXG5cbmV4cG9ydCBjbGFzcyBOZWFyYnlDYWNoZSB7XG5cbiAgICBjb25zdHJ1Y3RvciAobmVhcmJ5SW5kZXgpIHtcbiAgICAgICAgLy8gbmVhcmJ5IGluZGV4XG4gICAgICAgIHRoaXMuX2luZGV4ID0gbmVhcmJ5SW5kZXg7XG4gICAgICAgIC8vIGNhY2hlZCBuZWFyYnkgb2JqZWN0XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2FjaGVkIHNlZ21lbnRcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gZGlydHkgZmxhZ1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBBY2Nlc3NvcnMgZm9yIENhY2hlIHN0YXRlXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIFxuICAgIGdldCBuZWFyYnkgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbmVhcmJ5O1xuICAgIH1cblxuICAgIGxvYWRfc2VnbWVudCAoKSB7XG4gICAgICAgIC8vIGxhenkgbG9hZCBzZWdtZW50XG4gICAgICAgIGlmICh0aGlzLl9uZWFyYnkgJiYgIXRoaXMuX3NlZ21lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3NlZ21lbnQgPSBsb2FkX3NlZ21lbnQodGhpcy5fbmVhcmJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fc2VnbWVudFxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBEaXJ0eSBDYWNoZVxuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGRpcnR5KCkge1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIFJlZnJlc2ggQ2FjaGVcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICAvKlxuICAgICAgICByZWZyZXNoIGlmIG5lY2Vzc2FyeSAtIGVsc2UgTk9PUFxuICAgICAgICAtIGlmIG5lYXJieSBpcyBub3QgZGVmaW5lZFxuICAgICAgICAtIGlmIG9mZnNldCBpcyBvdXRzaWRlIG5lYXJieS5pdHZcbiAgICAgICAgLSBpZiBjYWNoZSBpcyBkaXJ0eVxuICAgICovXG4gICAgcmVmcmVzaCAob2Zmc2V0KSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgb2Zmc2V0ID0gW29mZnNldCwgMF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX25lYXJieSA9PSB1bmRlZmluZWQgfHwgdGhpcy5fZGlydHkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWZyZXNoKG9mZnNldCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpbnRlcnZhbC5jb3ZlcnNfZW5kcG9pbnQodGhpcy5fbmVhcmJ5Lml0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlZnJlc2gob2Zmc2V0KVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBfcmVmcmVzaCAob2Zmc2V0KSB7XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHRoaXMuX2luZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICB0aGlzLl9zZWdtZW50ID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgUXVlcnkgQ2FjaGVcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBxdWVyeShvZmZzZXQpIHtcbiAgICAgICAgaWYgKG9mZnNldCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhY2hlIHF1ZXJ5IG9mZnNldCBjYW5ub3QgYmUgdW5kZWZpbmVkXCIpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZWZyZXNoKG9mZnNldCk7XG4gICAgICAgIGlmICghdGhpcy5fc2VnbWVudCkge1xuICAgICAgICAgICAgdGhpcy5fc2VnbWVudCA9IGxvYWRfc2VnbWVudCh0aGlzLl9uZWFyYnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9zZWdtZW50LnF1ZXJ5KG9mZnNldCk7XG4gICAgfVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExPQUQgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5mdW5jdGlvbiBjcmVhdGVfc2VnbWVudChpdHYsIHR5cGUsIGFyZ3MpIHtcbiAgICBpZiAodHlwZSA9PSBcInN0YXRpY1wiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5TdGF0aWNTZWdtZW50KGl0diwgYXJncyk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwidHJhbnNpdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5UcmFuc2l0aW9uU2VnbWVudChpdHYsIGFyZ3MpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcImludGVycG9sYXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuSW50ZXJwb2xhdGlvblNlZ21lbnQoaXR2LCBhcmdzKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJtb3Rpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuTW90aW9uU2VnbWVudChpdHYsIGFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwidW5yZWNvZ25pemVkIHNlZ21lbnQgdHlwZVwiLCB0eXBlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGxvYWRfc2VnbWVudChuZWFyYnkpIHtcbiAgICBsZXQge2l0diwgY2VudGVyfSA9IG5lYXJieTtcbiAgICBpZiAoY2VudGVyLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVfc2VnbWVudChpdHYsIFwic3RhdGljXCIsIHt2YWx1ZTp1bmRlZmluZWR9KTtcbiAgICB9XG4gICAgaWYgKGNlbnRlci5sZW5ndGggPT0gMSkge1xuICAgICAgICBsZXQge3R5cGU9XCJzdGF0aWNcIiwgYXJnc30gPSBjZW50ZXJbMF07XG4gICAgICAgIHJldHVybiBjcmVhdGVfc2VnbWVudChpdHYsIHR5cGUsIGFyZ3MpO1xuICAgIH1cbiAgICBpZiAoY2VudGVyLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTGlzdFNlZ21lbnRzIG5vdCB5ZXQgc3VwcG9ydGVkXCIpO1xuICAgIH1cbn1cbiIsImltcG9ydCB7ZW5kcG9pbnR9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHtyYW5nZX0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHtOZWFyYnlDYWNoZX0gZnJvbSBcIi4vbmVhcmJ5Y2FjaGUuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE5FQVJCWSBJTkRFWFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEFic3RyYWN0IHN1cGVyY2xhc3MgZm9yIE5lYXJieUluZGV4ZS5cbiAqIFxuICogU3VwZXJjbGFzcyB1c2VkIHRvIGNoZWNrIHRoYXQgYSBjbGFzcyBpbXBsZW1lbnRzIHRoZSBuZWFyYnkoKSBtZXRob2QsIFxuICogYW5kIHByb3ZpZGUgc29tZSBjb252ZW5pZW5jZSBtZXRob2RzLlxuICogXG4gKiBORUFSQlkgSU5ERVhcbiAqIFxuICogTmVhcmJ5SW5kZXggcHJvdmlkZXMgaW5kZXhpbmcgc3VwcG9ydCBvZiBlZmZlY3RpdmVseWxvb2tpbmcgdXAgSVRFTVMgYnkgb2Zmc2V0LCBcbiAqIGdpdmVuIHRoYXRcbiAqIChpKSBlYWNoIGVudHJpeSBpcyBhc3NvY2lhdGVkIHdpdGggYW4gaW50ZXJ2YWwgYW5kLFxuICogKGlpKSBlbnRyaWVzIGFyZSBub24tb3ZlcmxhcHBpbmcuXG4gKiBFYWNoIElURU0gbXVzdCBiZSBhc3NvY2lhdGVkIHdpdGggYW4gaW50ZXJ2YWwgb24gdGhlIHRpbWVsaW5lIFxuICogXG4gKiBORUFSQllcbiAqIFRoZSBuZWFyYnkgbWV0aG9kIHJldHVybnMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG5laWdoYm9yaG9vZCBhcm91bmQgZW5kcG9pbnQuIFxuICogXG4gKiBQcmltYXJ5IHVzZSBpcyBmb3IgaXRlcmF0aW9uIFxuICogXG4gKiBSZXR1cm5zIHtcbiAqICAgICAgY2VudGVyOiBsaXN0IG9mIElURU1TIGNvdmVyaW5nIGVuZHBvaW50LFxuICogICAgICBpdHY6IGludGVydmFsIHdoZXJlIG5lYXJieSByZXR1cm5zIGlkZW50aWNhbCB7Y2VudGVyfVxuICogICAgICBsZWZ0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIGxlZnQgXG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBoaWdoLWVuZHBvaW50IG9yIHVuZGVmaW5lZFxuICogICAgICByaWdodDpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSByaWdodFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgbG93LWVuZHBvaW50IG9yIHVuZGVmaW5lZCAgICAgICAgIFxuICogICAgICBwcmV2OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIGxlZnQgXG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50ICYmIG5vbi1lbXB0eSB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgaGlnaC1lbmRwb2ludCBvciB1bmRlZmluZWQgaWYgbm8gbW9yZSBpbnRlcnZhbHMgdG8gdGhlIGxlZnRcbiAqICAgICAgbmV4dDpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSByaWdodFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCAmJiBub24tZW1wdHkge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGxvdy1lbmRwb2ludCBvciB1bmRlZmluZWQgaWYgbm8gbW9yZSBpbnRlcnZhbHMgdG8gdGhlIHJpZ2h0XG4gKiB9XG4gKiBcbiAqIFxuICogVGhlIG5lYXJieSBzdGF0ZSBpcyB3ZWxsLWRlZmluZWQgZm9yIGV2ZXJ5IHRpbWVsaW5lIHBvc2l0aW9uLlxuICogXG4gKiBcbiAqIE5PVEUgbGVmdC9yaWdodCBhbmQgcHJldi9uZXh0IGFyZSBtb3N0bHkgdGhlIHNhbWUuIFRoZSBvbmx5IGRpZmZlcmVuY2UgaXMgXG4gKiB0aGF0IHByZXYvbmV4dCB3aWxsIHNraXAgb3ZlciByZWdpb25zIHdoZXJlIHRoZXJlIGFyZSBubyBpbnRlcnZhbHMuIFRoaXNcbiAqIGVuc3VyZXMgcHJhY3RpY2FsIGl0ZXJhdGlvbiBvZiBpdGVtcyBhcyBwcmV2L25leHQgd2lsbCBvbmx5IGJlIHVuZGVmaW5lZCAgXG4gKiBhdCB0aGUgZW5kIG9mIGl0ZXJhdGlvbi5cbiAqIFxuICogSU5URVJWQUxTXG4gKiBcbiAqIFtsb3csIGhpZ2gsIGxvd0luY2x1c2l2ZSwgaGlnaEluY2x1c2l2ZV1cbiAqIFxuICogVGhpcyByZXByZXNlbnRhdGlvbiBlbnN1cmVzIHRoYXQgdGhlIGludGVydmFsIGVuZHBvaW50cyBhcmUgb3JkZXJlZCBhbmQgYWxsb3dzXG4gKiBpbnRlcnZhbHMgdG8gYmUgZXhjbHVzaXZlIG9yIGluY2x1c2l2ZSwgeWV0IGNvdmVyIHRoZSBlbnRpcmUgcmVhbCBsaW5lIFxuICogXG4gKiBbYSxiXSwgKGEsYiksIFthLGIpLCBbYSwgYikgYXJlIGFsbCB2YWxpZCBpbnRlcnZhbHNcbiAqIFxuICogXG4gKiBJTlRFUlZBTCBFTkRQT0lOVFNcbiAqIFxuICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gKiBcbiAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gKiBcbiAqIC8gKi9cblxuIGV4cG9ydCBjbGFzcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgdXBkYXRlIChpdGVtcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyogXG4gICAgICAgIE5lYXJieSBtZXRob2RcbiAgICAqL1xuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGxvdyBwb2ludCBvZiBsZWZ0bW9zdCBlbnRyeVxuICAgICovXG4gICAgZmlyc3QoKSB7XG4gICAgICAgIGxldCB7Y2VudGVyLCByaWdodH0gPSB0aGlzLm5lYXJieShbLUluZmluaXR5LCAwXSk7XG4gICAgICAgIHJldHVybiAoY2VudGVyLmxlbmd0aCA+IDApID8gWy1JbmZpbml0eSwgMF0gOiByaWdodDtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICByZXR1cm4gaGlnaCBwb2ludCBvZiByaWdodG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGxhc3QoKSB7XG4gICAgICAgIGxldCB7bGVmdCwgY2VudGVyfSA9IHRoaXMubmVhcmJ5KFtJbmZpbml0eSwgMF0pO1xuICAgICAgICByZXR1cm4gKGNlbnRlci5sZW5ndGggPiAwKSA/IFtJbmZpbml0eSwgMF0gOiBsZWZ0XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgTGlzdCBpdGVtcyBvZiBOZWFyYnlJbmRleCAob3JkZXIgbGVmdCB0byByaWdodClcbiAgICAgICAgaW50ZXJ2YWwgZGVmaW5lcyBbc3RhcnQsIGVuZF0gb2Zmc2V0IG9uIHRoZSB0aW1lbGluZS5cbiAgICAgICAgUmV0dXJucyBsaXN0IG9mIGl0ZW0tbGlzdHMuXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICAgLSBzdGFydFxuICAgICAgICAtIHN0b3BcbiAgICAqL1xuICAgIGxpc3Qob3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge3N0YXJ0PS1JbmZpbml0eSwgc3RvcD1JbmZpbml0eX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3RhcnQgPiBzdG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgKFwic3RvcCBtdXN0IGJlIGxhcmdlciB0aGFuIHN0YXJ0XCIsIHN0YXJ0LCBzdG9wKVxuICAgICAgICB9XG4gICAgICAgIHN0YXJ0ID0gW3N0YXJ0LCAwXTtcbiAgICAgICAgc3RvcCA9IFtzdG9wLCAwXTtcbiAgICAgICAgbGV0IGN1cnJlbnQgPSBzdGFydDtcbiAgICAgICAgbGV0IG5lYXJieTtcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuICAgICAgICBsZXQgbGltaXQgPSA1XG4gICAgICAgIHdoaWxlIChsaW1pdCkge1xuICAgICAgICAgICAgaWYgKGVuZHBvaW50Lmd0KGN1cnJlbnQsIHN0b3ApKSB7XG4gICAgICAgICAgICAgICAgLy8gZXhoYXVzdGVkXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuZWFyYnkgPSB0aGlzLm5lYXJieShjdXJyZW50KTtcbiAgICAgICAgICAgIGlmIChuZWFyYnkuY2VudGVyLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAgICAgLy8gY2VudGVyIGVtcHR5ICh0eXBpY2FsbHkgZmlyc3QgaXRlcmF0aW9uKVxuICAgICAgICAgICAgICAgIGlmIChuZWFyYnkucmlnaHQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBubyBlbnRyaWVzIC0gYWxyZWFkeSBleGhhdXN0ZWRcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmlnaHQgZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBpbmNyZW1lbnQgb2Zmc2V0XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnQgPSBuZWFyYnkucmlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gobmVhcmJ5LmNlbnRlcik7XG4gICAgICAgICAgICAgICAgaWYgKG5lYXJieS5yaWdodCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmlnaHQgdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgIC8vIGxhc3QgZW50cnkgLSBtYXJrIGl0ZXJhY3RvciBleGhhdXN0ZWRcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmlnaHQgZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBpbmNyZW1lbnQgb2Zmc2V0XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnQgPSBuZWFyYnkucmlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGltaXQtLTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBTYW1wbGUgTmVhcmJ5SW5kZXggYnkgdGltZWxpbmUgb2Zmc2V0IGluY3JlbWVudHNcbiAgICAgICAgcmV0dXJuIGxpc3Qgb2YgdHVwbGVzIFt2YWx1ZSwgb2Zmc2V0XVxuICAgICAgICBvcHRpb25zXG4gICAgICAgIC0gc3RhcnRcbiAgICAgICAgLSBzdG9wXG4gICAgICAgIC0gc3RlcFxuICAgICovXG4gICAgc2FtcGxlKG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtzdGFydD0tSW5maW5pdHksIHN0b3A9SW5maW5pdHksIHN0ZXA9MX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3RhcnQgPiBzdG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgKFwic3RvcCBtdXN0IGJlIGxhcmdlciB0aGFuIHN0YXJ0XCIsIHN0YXJ0LCBzdG9wKVxuICAgICAgICB9XG4gICAgICAgIHN0YXJ0ID0gW3N0YXJ0LCAwXTtcbiAgICAgICAgc3RvcCA9IFtzdG9wLCAwXTtcblxuICAgICAgICBzdGFydCA9IGVuZHBvaW50Lm1heCh0aGlzLmZpcnN0KCksIHN0YXJ0KTtcbiAgICAgICAgc3RvcCA9IGVuZHBvaW50Lm1pbih0aGlzLmxhc3QoKSwgc3RvcCk7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gbmV3IE5lYXJieUNhY2hlKHRoaXMpO1xuICAgICAgICByZXR1cm4gcmFuZ2Uoc3RhcnRbMF0sIHN0b3BbMF0sIHN0ZXAsIHtpbmNsdWRlX2VuZDp0cnVlfSlcbiAgICAgICAgICAgIC5tYXAoKG9mZnNldCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBbY2FjaGUucXVlcnkob2Zmc2V0KS52YWx1ZSwgb2Zmc2V0XTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxufVxuXG5cblxuXG5cbiIsImltcG9ydCB7aW50ZXJ2YWwsIGVuZHBvaW50fSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuL25lYXJieWluZGV4LmpzXCI7XG5cbi8qKlxuICogXG4gKiBOZWFyYnkgSW5kZXggU2ltcGxlXG4gKiBcbiAqIC0gaXRlbXMgYXJlIGFzc3VtZWQgdG8gYmUgbm9uLW92ZXJsYXBwaW5nIG9uIHRoZSB0aW1lbGluZSwgXG4gKiAtIGltcGx5aW5nIHRoYXQgbmVhcmJ5LmNlbnRlciB3aWxsIGJlIGEgbGlzdCBvZiBhdCBtb3N0IG9uZSBJVEVNLiBcbiAqIC0gZXhjZXB0aW9uIHdpbGwgYmUgcmFpc2VkIGlmIG92ZXJsYXBwaW5nIElURU1TIGFyZSBmb3VuZFxuICogLSBJVEVNUyBpcyBhc3N1bWJlZCB0byBiZSBpbW11dGFibGUgYXJyYXkgLSBjaGFuZ2UgSVRFTVMgYnkgcmVwbGFjaW5nIGFycmF5XG4gKiBcbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgYXJvdW5kIG9mZnNldC4gXG4gKiBcbiAqIFJldHVybnMge1xuICogICAgICBsZWZ0IC0gaGlnaCBpbnRlcnZhbCBlbmRwb2ludCBvZiB0aGUgZmlyc3QgSVRFTSB0byB0aGUgbGVmdCB3aGljaCBkb2VzIG5vdCBjb3ZlciBvZmZzZXQsIGVsc2UgdW5kZWZpbmVkXG4gKiAgICAgIGNlbnRlciAtIGxpc3Qgb2YgSVRFTVMgY292ZXJpbmcgb2Zmc2V0LCBlbHNlIFtdXG4gKiAgICAgIHJpZ2h0IC0gbG93IGludGVydmFsIGVuZHBvaW50IG9mIHRoZSBmaXJzdCBJVEVNIHRvIHRoZSByaWdodCB3aGljaCBkb2VzIG5vdCBjb3ZlciBvZmZzZXQsIGVsc2UgdW5kZWZpbmVkXG4gKiB9XG4gKiBcbiAqL1xuXG5cbi8vIGdldCBpbnRlcnZhbCBsb3cgcG9pbnRcbmZ1bmN0aW9uIGdldF9sb3dfdmFsdWUoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLml0dlswXTtcbn1cblxuLy8gZ2V0IGludGVydmFsIGxvdyBlbmRwb2ludFxuZnVuY3Rpb24gZ2V0X2xvd19lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzBdXG59XG5cbi8vIGdldCBpbnRlcnZhbCBoaWdoIGVuZHBvaW50XG5mdW5jdGlvbiBnZXRfaGlnaF9lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzFdXG59XG5cblxuZXhwb3J0IGNsYXNzIFNpbXBsZU5lYXJieUluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBbXTtcbiAgICAgICAgbGV0IHtpdGVtc30gPSBvcHRpb25zO1xuICAgICAgICBpZiAoaXRlbXMpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlKGl0ZW1zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZSAoaXRlbXMpIHtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBjaGVja19pbnB1dChpdGVtcylcbiAgICB9XG5cblxuICAgIC8qXG4gICAgICAgIG5lYXJieSBieSBvZmZzZXRcbiAgICAgICAgXG4gICAgICAgIHJldHVybnMge2xlZnQsIGNlbnRlciwgcmlnaHR9XG5cbiAgICAgICAgYmluYXJ5IHNlYXJjaCBiYXNlZCBvbiBvZmZzZXRcbiAgICAgICAgMSkgZm91bmQsIGlkeFxuICAgICAgICAgICAgb2Zmc2V0IG1hdGNoZXMgdmFsdWUgb2YgaW50ZXJ2YWwubG93IG9mIGFuIGl0ZW1cbiAgICAgICAgICAgIGlkeCBnaXZlcyB0aGUgaW5kZXggb2YgdGhpcyBpdGVtIGluIHRoZSBhcnJheVxuICAgICAgICAyKSBub3QgZm91bmQsIGlkeFxuICAgICAgICAgICAgb2Zmc2V0IGlzIGVpdGhlciBjb3ZlcmVkIGJ5IGl0ZW0gYXQgKGlkeC0xKSxcbiAgICAgICAgICAgIG9yIGl0IGlzIG5vdCA9PiBiZXR3ZWVuIGVudHJpZXNcbiAgICAgICAgICAgIGluIHRoaXMgY2FzZSAtIGlkeCBnaXZlcyB0aGUgaW5kZXggd2hlcmUgYW4gaXRlbVxuICAgICAgICAgICAgc2hvdWxkIGJlIGluc2VydGVkIC0gaWYgaXQgaGFkIGxvdyA9PSBvZmZzZXRcbiAgICAqL1xuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvZmZzZXQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBbb2Zmc2V0LCAwXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkob2Zmc2V0KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW5kcG9pbnQgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgICAgICBjZW50ZXI6IFtdLFxuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICBsZWZ0OiB1bmRlZmluZWQsXG4gICAgICAgICAgICByaWdodDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgcHJldjogdW5kZWZpbmVkLFxuICAgICAgICAgICAgbmV4dDogdW5kZWZpbmVkXG4gICAgICAgIH07XG4gICAgICAgIGxldCBpdGVtcyA9IHRoaXMuX2l0ZW1zO1xuICAgICAgICBsZXQgaW5kZXhlcywgaXRlbTtcbiAgICAgICAgY29uc3Qgc2l6ZSA9IGl0ZW1zLmxlbmd0aDtcbiAgICAgICAgaWYgKHNpemUgPT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDsgXG4gICAgICAgIH1cbiAgICAgICAgbGV0IFtmb3VuZCwgaWR4XSA9IGZpbmRfaW5kZXgob2Zmc2V0WzBdLCBpdGVtcywgZ2V0X2xvd192YWx1ZSk7XG4gICAgICAgIGlmIChmb3VuZCkge1xuICAgICAgICAgICAgLy8gc2VhcmNoIG9mZnNldCBtYXRjaGVzIGl0ZW0gbG93IGV4YWN0bHlcbiAgICAgICAgICAgIC8vIGNoZWNrIHRoYXQgaXQgaW5kZWVkIGNvdmVyZWQgYnkgaXRlbSBpbnRlcnZhbFxuICAgICAgICAgICAgaXRlbSA9IGl0ZW1zW2lkeF1cbiAgICAgICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfZW5kcG9pbnQoaXRlbS5pdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTEsIGNlbnRlcjppZHgsIHJpZ2h0OmlkeCsxfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5kZXhlcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIHByZXYgaXRlbVxuICAgICAgICAgICAgaXRlbSA9IGl0ZW1zW2lkeC0xXTtcbiAgICAgICAgICAgIGlmIChpdGVtICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIHNlYXJjaCBvZmZzZXQgaXMgY292ZXJlZCBieSBpdGVtIGludGVydmFsXG4gICAgICAgICAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19lbmRwb2ludChpdGVtLml0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTIsIGNlbnRlcjppZHgtMSwgcmlnaHQ6aWR4fTtcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgfVxuICAgICAgICB9XHRcbiAgICAgICAgaWYgKGluZGV4ZXMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBwcmV2IGl0ZW0gZWl0aGVyIGRvZXMgbm90IGV4aXN0IG9yIGlzIG5vdCByZWxldmFudFxuICAgICAgICAgICAgaW5kZXhlcyA9IHtsZWZ0OmlkeC0xLCBjZW50ZXI6LTEsIHJpZ2h0OmlkeH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjZW50ZXJcbiAgICAgICAgaWYgKDAgPD0gaW5kZXhlcy5jZW50ZXIgJiYgaW5kZXhlcy5jZW50ZXIgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQuY2VudGVyID0gIFtpdGVtc1tpbmRleGVzLmNlbnRlcl1dO1xuICAgICAgICB9XG4gICAgICAgIC8vIHByZXYvbmV4dFxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLmxlZnQgJiYgaW5kZXhlcy5sZWZ0IDwgc2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0LnByZXYgPSAgZ2V0X2hpZ2hfZW5kcG9pbnQoaXRlbXNbaW5kZXhlcy5sZWZ0XSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKDAgPD0gaW5kZXhlcy5yaWdodCAmJiBpbmRleGVzLnJpZ2h0IDwgc2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0Lm5leHQgPSAgZ2V0X2xvd19lbmRwb2ludChpdGVtc1tpbmRleGVzLnJpZ2h0XSk7XG4gICAgICAgIH0gICAgICAgIFxuICAgICAgICAvLyBsZWZ0L3JpZ2h0XG4gICAgICAgIGxldCBsb3csIGhpZ2g7XG4gICAgICAgIGlmIChyZXN1bHQuY2VudGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxldCBpdHYgPSByZXN1bHQuY2VudGVyWzBdLml0djtcbiAgICAgICAgICAgIFtsb3csIGhpZ2hdID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdHYpO1xuICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSAobG93WzBdID4gLUluZmluaXR5KSA/IGVuZHBvaW50LmZsaXAobG93LCBcImhpZ2hcIikgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSAoaGlnaFswXSA8IEluZmluaXR5KSA/IGVuZHBvaW50LmZsaXAoaGlnaCwgXCJsb3dcIikgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICByZXN1bHQuaXR2ID0gcmVzdWx0LmNlbnRlclswXS5pdHY7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IHJlc3VsdC5wcmV2O1xuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gcmVzdWx0Lm5leHQ7XG4gICAgICAgICAgICAvLyBpbnRlcnZhbFxuICAgICAgICAgICAgbGV0IGxlZnQgPSByZXN1bHQubGVmdDtcbiAgICAgICAgICAgIGxvdyA9IChsZWZ0ID09IHVuZGVmaW5lZCkgPyBbLUluZmluaXR5LCAwXSA6IGVuZHBvaW50LmZsaXAobGVmdCwgXCJsb3dcIik7XG4gICAgICAgICAgICBsZXQgcmlnaHQgPSByZXN1bHQucmlnaHQ7XG4gICAgICAgICAgICBoaWdoID0gKHJpZ2h0ID09IHVuZGVmaW5lZCkgPyBbSW5maW5pdHksIDBdIDogZW5kcG9pbnQuZmxpcChyaWdodCwgXCJoaWdoXCIpO1xuICAgICAgICAgICAgcmVzdWx0Lml0diA9IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblx0VVRJTFNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuXG4vLyBjaGVjayBpbnB1dFxuZnVuY3Rpb24gY2hlY2tfaW5wdXQoaXRlbXMpIHtcblxuICAgIGlmIChpdGVtcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaXRlbXMgPSBbXTtcbiAgICB9XG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIklucHV0IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgfVxuXG4gICAgLy8gc29ydCBpdGVtcyBiYXNlZCBvbiBpbnRlcnZhbCBsb3cgZW5kcG9pbnRcbiAgICBpdGVtcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGxldCBhX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYS5pdHYpWzBdO1xuICAgICAgICBsZXQgYl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGIuaXR2KVswXTtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmNtcChhX2xvdywgYl9sb3cpO1xuICAgIH0pO1xuXG4gICAgLy8gY2hlY2sgdGhhdCBpdGVtIGludGVydmFscyBhcmUgbm9uLW92ZXJsYXBwaW5nXG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBsZXQgcHJldl9oaWdoID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpIC0gMV0uaXR2KVsxXTtcbiAgICAgICAgbGV0IGN1cnJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpXS5pdHYpWzBdO1xuICAgICAgICAvLyB2ZXJpZnkgdGhhdCBwcmV2IGhpZ2ggaXMgbGVzcyB0aGF0IGN1cnIgbG93XG4gICAgICAgIGlmICghZW5kcG9pbnQubHQocHJldl9oaWdoLCBjdXJyX2xvdykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk92ZXJsYXBwaW5nIGludGVydmFscyBmb3VuZFwiKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cblxuLypcblx0YmluYXJ5IHNlYXJjaCBmb3IgZmluZGluZyB0aGUgY29ycmVjdCBpbnNlcnRpb24gaW5kZXggaW50b1xuXHR0aGUgc29ydGVkIGFycmF5IChhc2NlbmRpbmcpIG9mIGl0ZW1zXG5cdFxuXHRhcnJheSBjb250YWlucyBvYmplY3RzLCBhbmQgdmFsdWUgZnVuYyByZXRyZWF2ZXMgYSB2YWx1ZVxuXHRmcm9tIGVhY2ggb2JqZWN0LlxuXG5cdHJldHVybiBbZm91bmQsIGluZGV4XVxuKi9cblxuZnVuY3Rpb24gZmluZF9pbmRleCh0YXJnZXQsIGFyciwgdmFsdWVfZnVuYykge1xuXG4gICAgZnVuY3Rpb24gZGVmYXVsdF92YWx1ZV9mdW5jKGVsKSB7XG4gICAgICAgIHJldHVybiBlbDtcbiAgICB9XG4gICAgXG4gICAgbGV0IGxlZnQgPSAwO1xuXHRsZXQgcmlnaHQgPSBhcnIubGVuZ3RoIC0gMTtcblx0dmFsdWVfZnVuYyA9IHZhbHVlX2Z1bmMgfHwgZGVmYXVsdF92YWx1ZV9mdW5jO1xuXHR3aGlsZSAobGVmdCA8PSByaWdodCkge1xuXHRcdGNvbnN0IG1pZCA9IE1hdGguZmxvb3IoKGxlZnQgKyByaWdodCkgLyAyKTtcblx0XHRsZXQgbWlkX3ZhbHVlID0gdmFsdWVfZnVuYyhhcnJbbWlkXSk7XG5cdFx0aWYgKG1pZF92YWx1ZSA9PT0gdGFyZ2V0KSB7XG5cdFx0XHRyZXR1cm4gW3RydWUsIG1pZF07IC8vIFRhcmdldCBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgYXJyYXlcblx0XHR9IGVsc2UgaWYgKG1pZF92YWx1ZSA8IHRhcmdldCkge1xuXHRcdFx0ICBsZWZ0ID0gbWlkICsgMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIHJpZ2h0XG5cdFx0fSBlbHNlIHtcblx0XHRcdCAgcmlnaHQgPSBtaWQgLSAxOyAvLyBNb3ZlIHNlYXJjaCByYW5nZSB0byB0aGUgbGVmdFxuXHRcdH1cblx0fVxuICBcdHJldHVybiBbZmFsc2UsIGxlZnRdOyAvLyBSZXR1cm4gdGhlIGluZGV4IHdoZXJlIHRhcmdldCBzaG91bGQgYmUgaW5zZXJ0ZWRcbn1cbiIsIlxuXG5pbXBvcnQgeyBTdGF0ZVByb3ZpZGVyQmFzZSwgQ3Vyc29yQmFzZSB9IGZyb20gXCIuL2Jhc2VzLmpzXCI7XG5pbXBvcnQgeyBzb3VyY2UgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5pbXBvcnQgeyBTaW1wbGVTdGF0ZVByb3ZpZGVyIH0gZnJvbSBcIi4vc3RhdGVwcm92aWRlcl9zaW1wbGUuanNcIjtcbmltcG9ydCB7IGNtZCB9IGZyb20gXCIuL2NtZC5qc1wiO1xuaW1wb3J0IHsgU2ltcGxlTmVhcmJ5SW5kZXggfSBmcm9tIFwiLi9uZWFyYnlpbmRleF9zaW1wbGUuanNcIjtcbmltcG9ydCB7IE5lYXJieUNhY2hlIH0gZnJvbSBcIi4vbmVhcmJ5Y2FjaGUuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ0xPQ0tTXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jb25zdCBDTE9DSyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gcGVyZm9ybWFuY2Uubm93KCkvMTAwMC4wO1xufVxuXG4vKlxuICAgIE5PVEUgXG4gICAgZXBvY2ggc2hvdWxkIG9ubHkgYmUgdXNlZCBmb3IgdmlzdWFsaXphdGlvbixcbiAgICBhcyBpdCBoYXMgdGltZSByZXNvbHV0aW9uIGxpbWl0ZWQgdG8gbXNcbiovXG5cbmNvbnN0IEVQT0NIID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBEYXRlLm5vdygpLzEwMDAuMDtcbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBDTE9DSyBDVVJTT1JTXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vLyBDTE9DSyAoY291bnRpbmcgc2Vjb25kcyBzaW5jZSBwYWdlIGxvYWQpXG5jbGFzcyBDbG9ja0N1cnNvciBleHRlbmRzIEN1cnNvckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKGNsb2NrKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2Nsb2NrID0gY2xvY2s7XG4gICAgICAgIC8vIGl0ZW1zXG4gICAgICAgIGNvbnN0IHQwID0gdGhpcy5fY2xvY2soKTtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBbe1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICAgICAgYXJnczoge3Bvc2l0aW9uOiB0MCwgdmVsb2NpdHk6IDEsIG9mZnNldDogdDB9XG4gICAgICAgIH1dOyAgICBcbiAgICB9XG5cbiAgICBxdWVyeSAoKSB7XG4gICAgICAgIGxldCB0cyA9IHRoaXMuX2Nsb2NrKCk7IFxuICAgICAgICByZXR1cm4ge3ZhbHVlOnRzLCBkeW5hbWljOnRydWUsIG9mZnNldDp0c307XG4gICAgfVxuXG4gICAgaXRlbXMgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXRlbXM7XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgbG9jYWxfY2xvY2sgPSBuZXcgQ2xvY2tDdXJzb3IoQ0xPQ0spO1xuZXhwb3J0IGNvbnN0IGxvY2FsX2Vwb2NoID0gbmV3IENsb2NrQ3Vyc29yKEVQT0NIKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBcbiAqIEN1cnNvciBpcyBhIHZhcmlhYmxlXG4gKiAtIGhhcyBtdXRhYmxlIGN0cmwgY3Vyc29yIChkZWZhdWx0IGxvY2FsIGNsb2NrKVxuICogLSBoYXMgbXV0YWJsZSBzdGF0ZSBwcm92aWRlciAoc3JjKSAoZGVmYXVsdCBzdGF0ZSB1bmRlZmluZWQpXG4gKiAtIG1ldGhvZHMgZm9yIGFzc2lnbiwgbW92ZSwgdHJhbnNpdGlvbiwgaW50ZXBvbGF0aW9uXG4gKiBcbiAqL1xuXG5leHBvcnQgY2xhc3MgQ3Vyc29yIGV4dGVuZHMgQ3Vyc29yQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvLyBjdHJsXG4gICAgICAgIHNvdXJjZS5hZGRUb0luc3RhbmNlKHRoaXMsIFwiY3RybFwiKTtcbiAgICAgICAgLy8gc3JjXG4gICAgICAgIHNvdXJjZS5hZGRUb0luc3RhbmNlKHRoaXMsIFwic3JjXCIpO1xuICAgICAgICAvLyBpbmRleFxuICAgICAgICB0aGlzLl9pbmRleCA9IG5ldyBTaW1wbGVOZWFyYnlJbmRleCgpO1xuICAgICAgICAvLyBjYWNoZVxuICAgICAgICB0aGlzLl9jYWNoZSA9IG5ldyBOZWFyYnlDYWNoZSh0aGlzLl9pbmRleCk7XG4gICAgICAgIC8vIHRpbWVvdXRcbiAgICAgICAgdGhpcy5fdGlkO1xuXG4gICAgICAgIGxldCB7c3JjLCBjdHJsLCAuLi5vcHRzfSA9IG9wdGlvbnM7XG5cbiAgICAgICAgLy8gaW5pdGlhbGlzZSBjdHJsXG4gICAgICAgIGlmIChjdHJsID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY3RybCA9IGxvY2FsX2Nsb2NrO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY3RybCA9IGN0cmw7XG5cbiAgICAgICAgLy8gaW5pdGlhbGlzZSBzdGF0ZVxuICAgICAgICBpZiAoc3JjID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3JjID0gbmV3IFNpbXBsZVN0YXRlUHJvdmlkZXIob3B0cyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zcmMgPSBzcmNcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIENUUkwgKGN1cnNvcilcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIF9fY3RybF9jaGVjayhjdHJsKSB7XG4gICAgICAgIGlmICghKGN0cmwgaW5zdGFuY2VvZiBDdXJzb3JCYXNlKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcImN0cmxcIiBtdXN0IGJlIGN1cnNvciAke2N0cmx9YClcbiAgICAgICAgfVxuICAgIH1cbiAgICBfX2N0cmxfaGFuZGxlX2NoYW5nZSgpIHtcbiAgICAgICAgdGhpcy5fX2hhbmRsZV9jaGFuZ2UoKTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFNSQyAoc3RhdGVwcm92aWRlcilcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIF9fc3JjX2NoZWNrKHNyYykge1xuICAgICAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBTdGF0ZVByb3ZpZGVyQmFzZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIHN0YXRlIHByb3ZpZGVyICR7c291cmNlfWApO1xuICAgICAgICB9XG4gICAgfSAgICBcbiAgICBfX3NyY19oYW5kbGVfY2hhbmdlKCkge1xuICAgICAgICB0aGlzLl9faGFuZGxlX2NoYW5nZSgpO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogQ0FMTEJBQ0tcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIF9faGFuZGxlX2NoYW5nZSgpIHtcbiAgICAgICAgLy8gY2xlYW4gdXAgb2xkIHRpbWVvdXRcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3RpZClcblxuICAgICAgICBpZiAodGhpcy5zcmMgJiYgdGhpcy5jdHJsKSB7XG4gICAgICAgICAgICB0aGlzLl9pbmRleC51cGRhdGUodGhpcy5zcmMuaXRlbXMpO1xuICAgICAgICAgICAgdGhpcy5fY2FjaGUuZGlydHkoKTtcbiAgICAgICAgICAgIC8vIHRyaWdnZXIgY2hhbmdlIGV2ZW50IGZvciBjdXJzb3JcbiAgICAgICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHRoaXMucXVlcnkoKSk7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFBsYXliYWNrIHN1cHBvcnRcbiAgICAgICAgICAgICAqIFxuICAgICAgICAgICAgICogRHVyaW5nIHBsYXliYWNrIChjdHJsIHNpZ25hbGluZyBkeW5hbWljIGNoYW5nZSlcbiAgICAgICAgICAgICAqIHRoZXJlIGlzIGEgbmVlZCB0byBkZXRlY3QgcGFzc2luZyBmcm9tIG9uZSBzZWdtZW50IGludGVydmFsXG4gICAgICAgICAgICAgKiB0byB0aGUgbmV4dCAtIGlkZWFsbHkgYXQgcHJlY2lzZWx5IHRoZSBjb3JyZWN0IHRpbWVcbiAgICAgICAgICAgICAqIFxuICAgICAgICAgICAgICogY2FjaGUubmVhcmJ5Lml0diAoZGVyaXZlZCBmcm9tIHNyYykgZ2l2ZXMgdGhlIFxuICAgICAgICAgICAgICogaW50ZXJ2YWwgd2hlcmUgbmVhcmJ5IHN0YXlzIGNvbnN0YW50LCBhbmQgd2UgYXJlIFxuICAgICAgICAgICAgICogY3VycmVudGx5IGluIHRoaXMgaW50ZXJ2YWwgc28gdGhlIHRpbWVvdXRcbiAgICAgICAgICAgICAqIHNob2xkIHRhcmdldCB0aGUgbW9tZW4gd2hlbiB3ZSBsZWF2ZSB0aGlzIGludGVydmFsLlxuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAgKiBcbiAgICAgICAgICAgICAqIEFwcHJvYWNoIFswXSBcbiAgICAgICAgICAgICAqIFRoZSB0cml2aWFsIHNvbHV0aW9uIGlzIHRvIGRvIG5vdGhpbmcsIGluIHdoaWNoIGNhc2VcbiAgICAgICAgICAgICAqIG9ic2VydmVycyB3aWxsIHNpbXBseSBmaW5kIG91dCB0aGVtc2VsdmVzIGFjY29yZGluZyB0byB0aGVpciBcbiAgICAgICAgICAgICAqIG93biBwb2xsIGZyZXF1ZW5jeS4gVGhpcyBpcyBzdWJvcHRpbWFsLCBwYXJ0aWN1bGFybHkgZm9yXG4gICAgICAgICAgICAgKiBsb3cgZnJlcXVlbmN5IG9ic2VydmVycy4gSWYgdGhlcmUgaXMgYXQgbGVhc3Qgb25lIGhpZ2gtXG4gICAgICAgICAgICAgKiBmcmVxdWVuY3kgcG9sbGVyLCB0aGlzIGNvdWxkIHRyaWdnZXIgdGhlIHRpbWVvdXQgZm9yIGFsbFxuICAgICAgICAgICAgICogdG8gYmUgbm90aWZpZWQuIFRoZSBwcm9ibGVtIHRob3VnaCwgaXMgaWYgbm8gb2JzZXJ2ZXJzXG4gICAgICAgICAgICAgKiBhcmUgcG9sbGluZy5cbiAgICAgICAgICAgICAqIFxuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAgKiBBcHByb2FjaCBbMV0gXG4gICAgICAgICAgICAgKiBJbiBjYXNlcyB3aGVyZSB0aGUgY3RybCBpcyBkZXRlcm1pbmlzdGljLCBhIHRpbWVvdXRcbiAgICAgICAgICAgICAqIGNhbiBiZSBjYWxjdWxhdGVkLiBUaGlzLCB0aG91Z2gsIGNhbiBiZSBtb3JlIHRyaWNreSBcbiAgICAgICAgICAgICAqIHRoYW4gZXhwZWN0ZWQuIFxuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAgKiAtIGEpIFxuICAgICAgICAgICAgICogTW90aW9uIGFuZCBsaW5lYXIgdHJhbnNpdGlvbnMgYXJlIGVhc3kgdG8gY2FsY3VsYXRlLCBcbiAgICAgICAgICAgICAqIGJ1dCB3aXRoIGFjY2VsZXJhdGlvbiBpbiBtb3Rpb24sIG9yIG5vbi1saW5lYXIgZWFzaW5nLCBcbiAgICAgICAgICAgICAqIGNhbGN1bGF0aW9ucyBxdWlja2x5IGJlY29tZSBtb3JlIGNvbXBsZXhcbiAgICAgICAgICAgICAqIFxuICAgICAgICAgICAgICogLSBiKVxuICAgICAgICAgICAgICogVGhlc2UgY2FsY3VsYXRpb25zIGFsc28gYXNzdW1lIHRoYXQgdGhlIGN0cmwuY3RybCBcbiAgICAgICAgICAgICAqIGlzIG5vdCBhIG1vbm90b25pYyBjbG9jayB3aXRoIHZlbG9jaXR5IDEuIEluIHByaW5jaXBsZSxcbiAgICAgICAgICAgICAqIHRoZXJlIGNvdWxkIGJlIGEgcmVjdXJzaXZlIGNoYWluIG9mIGN0cmwuY3RybC5jdHJsLmNsb2NrXG4gICAgICAgICAgICAgKiBvZiBzb21lIGxlbmd0aCwgd2hlcmUgYWxsIGNvbnRyb2xzIHdvdWxkIGhhdmUgdG8gYmVcbiAgICAgICAgICAgICAqIGxpbmVhciB0cmFuc2Zvcm1hdGlvbnMsIGluIG9yZGVyIHRvIGNhbGN1bGF0ZSBhIGRldGVybWluaXN0aWNcbiAgICAgICAgICAgICAqIHRpbWVvdXQuXG4gICAgICAgICAgICAgKiBcbiAgICAgICAgICAgICAqIEFwcHJvY2ggWzJdIFxuICAgICAgICAgICAgICogSXQgd291bGQgYWxzbyBiZSBwb3NzaWJsZSB0byBzYW1wbGluZyBmdXR1cmUgdmFsdWVzIG9mIHRoZVxuICAgICAgICAgICAgICogY3RybCB0byBzZWUgaWYgdGhlIHZhbHVlcyB2aW9sYXRlIHRoZSBuZWFyYnkuaXR2IGF0IHNvbWUgcG9pbnQuIFxuICAgICAgICAgICAgICogVGhpcyB3b3VsZCBlc3NlbnRpYWxseSBiZSB0cmVhdGluZyBjdHJsIGFzIGEgbGF5ZXIgYW5kIHNhbXBsaW5nIFxuICAgICAgICAgICAgICogZnV0dXJlIHZhbHVlcy4gVGhpcyBhcHByb2NoIHdvdWxkIHdvcmsgZm9yIGFsbCB0eXBlcywgXG4gICAgICAgICAgICAgKiBidXQgdGhlcmUgaXMgbm8ga25vd2luZyBob3cgZmFyIGludG8gdGhlIGZ1dHVyZSBvbmUgXG4gICAgICAgICAgICAgKiB3b3VsZCBoYXZlIHRvIHNlZWtcbiAgICAgICAgICAgICAqIFxuICAgICAgICAgICAgICogQXBwcm9hY2ggWzNdIFxuICAgICAgICAgICAgICogSXQgd291bGQgYWxzbyBiZSBwb3NzaWJsZSB0byBkZXRlY3QgdGhlIGV2ZW50IGJ5XG4gICAgICAgICAgICAgKiByZXBlYXRlZGx5IHBvbGxpbmcgaW50ZXJuYWxseS4gVGhpcyB3b3VsZCBlbnN1cmUgdGltZWx5XG4gICAgICAgICAgICAgKiBkZXRlY3Rpb24sIGV2ZW4gaWYgYWxsIG9ic2VydmVycyBhcmUgbG93LWZyZXF1ZW5jeSBwb2xsZXJzLi5cbiAgICAgICAgICAgICAqIFRoaXMgd291bGQgZXNzZW50aWFsbHkgYmUgZXF1aXZhbGVudCB0byBbMl0sIG9ubHkgd2l0aCBcbiAgICAgICAgICAgICAqIHNhbXBsaW5nIHNwcmVhZCBvdXQgaW4gdGltZS4gXG4gICAgICAgICAgICAgKiAgIFxuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAgKiBOb3RlIGFsc28gdGhhdCBhbiBpbmNvcnJlY3QgdGltZW91dCB3b3VsZCBOT1QgcnVpbiB0aGluZ3MuXG4gICAgICAgICAgICAgKiBJdCB3b3VsZCBlc3NlbnRpYWxseSBiZSBlcXVpdmFsZW50IHRvIFswXSwgYnV0IHdvdWxkIHdha2UgdXBcbiAgICAgICAgICAgICAqIG9ic2VydmVycyB1bm5lc3NhcnNhcmlseSBcbiAgICAgICAgICAgICAqIFxuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAgKiBTT0xVVElPTlxuICAgICAgICAgICAgICogQXMgdGhlcmUgaXMgbm8gcGVyZmVjdCBzb2x1dGlvbiwgd2UgbWFrZSB0aGUgcHJhZ21hdGljIFxuICAgICAgICAgICAgICogc29sdXRpb24gdG8gZG8gYXBwcm9hY2ggWzFdIHdoZW4gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zXG4gICAgICAgICAgICAgKiBob2xkOlxuICAgICAgICAgICAgICogKGkpIGlmIGN0cmwgaXMgYSBjbG9jayB8fCBjdHJsLmN0cmwgaXMgYSBjbG9ja1xuICAgICAgICAgICAgICogKGlpKSBjdHJsLm5lYXJieS5jZW50ZXIgaGFzIGV4YWN0bHkgMSBpdGVtXG4gICAgICAgICAgICAgKiAoaWlpKSBjdHJsLm5lYXJieS5jZW50ZXJbMF0udHlwZSA9PSBcIm1vdGlvblwiXG4gICAgICAgICAgICAgKiAoaXYpIGN0cmwubmVhcmJ5LmNlbnRlclswXS5hcmdzLnZlbG9jaXR5ICE9IDAuMCBcbiAgICAgICAgICAgICAqICh2KSB0aGUgcHJvc3BlY3RpdmUgY2FjaGUubmVhcmJ5Lml0diBsb3cgb3IgaGlnaCBcbiAgICAgICAgICAgICAqICAgICBhcmUgbm90IC1JbmZpbml0eSBvciBJbmZpbml0eVxuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAgKiBUaGlzIGlzIHByZXN1bWFibHkgbGlrZWx5IHRoZSBtb3N0IGNvbW1vbiBjYXNlIGZvciBwbGF5YmFjaywgXG4gICAgICAgICAgICAgKiB3aGVyZSBwcmVjaXNlIHRpbWluZyB3b3VsZCBiZSBvZiBpbXBvcnRhbmNlXG4gICAgICAgICAgICAgKiBcbiAgICAgICAgICAgICAqIEluIGFsbCBvdGhlciBjYXNlcywgd2UgZG8gYXBwcm9hY2ggWzNdLCBhcyB0aGlzIGlzIGVhc2llciB0aGFuXG4gICAgICAgICAgICAgKiBbMl0uXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGxldCB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IGN0cmxfb2Zmc2V0LCBcbiAgICAgICAgICAgICAgICBkeW5hbWljOiBjdHJsX2R5bmFtaWMsXG4gICAgICAgICAgICB9ID0gdGhpcy5jdHJsLnF1ZXJ5KCk7XG4gICAgXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIC0gbm8gbmVlZCBmb3IgcGxheWJhY2sgdGltZW91dCBpZiB0aGVyZSBpcyBubyBwbGF5YmFja1xuICAgICAgICAgICAgICovXG5cbiAgICAgICAgICAgIGlmICghY3RybF9keW5hbWljKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIC0gbm8gbmVlZCBmb3IgcGxheWJhY2sgdGltZW91dCBpZiBjdXJyZW50IHNlZ21lbnQgaGFzIG5vIGJvdW5kYXJ5XG4gICAgICAgICAgICAgKiBib3VuZGFyeSBvZiBjdXJyZW50IHNlZ21lbnQgLSBsb3cgYW5kIGhpZ2hcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5fY2FjaGUucmVmcmVzaChjdHJsX29mZnNldCk7XG4gICAgICAgICAgICBjb25zdCBpdHYgPSB0aGlzLl9jYWNoZS5uZWFyYnkuaXR2O1xuICAgICAgICAgICAgY29uc3QgW2xvdywgaGlnaF0gPSBpdHYuc2xpY2UoMCwyKTtcbiAgICAgICAgICAgIGlmIChsb3cgPT0gLUluZmluaXR5ICYmIGhpZ2ggPT0gSW5maW5pdHkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogLSBubyBuZWVkIGZvciBwbGF5YmFjayB0aW1lb3V0IGlmIGN0cmwgaXMgbm90IGRldGVybWluaXN0aWNcbiAgICAgICAgICAgICAqIC0gbXVzdCBoYXZlIGV4YWN0bHkgb24gc2VnbWVudCBpdGVtIC0gdHlwZSBtb3Rpb25cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgbGV0IGN0cmxfaXRlbXMgPSB0aGlzLmN0cmwuaXRlbXMoKTtcbiAgICAgICAgICAgIGlmIChjdHJsX2l0ZW1zLmxlbmd0aCAhPSAxKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYHdhcm5pbmc6IGN0cmwgaGFzIG11bHRpcGxlIGl0ZW1zICR7dGhpcy5jdHJsfWApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGN0cmxfaXRlbSA9IGN0cmxfaXRlbXNbMF07XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogb3B0aW9uIFsxXSBcbiAgICAgICAgICAgICAqIC0gZGV0ZXJtaW5pc3RpYyBtb3Rpb25cbiAgICAgICAgICAgICAqIC0gVE9ETyAtIGV4cGFuZCB0byBmaXhlZCBkdXJhdGlvbiB0cmFuc2l0aW9uc1xuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAgKiBjYWxjdWxhdGUgdGhlIHRpbWUgdG8gY3RybC52YWx1ZSBmaXJzdCBoaXRzIGxvdyBvciBoaWdoXG4gICAgICAgICAgICAgKiBpLmUuIHRpbWUgdG8gZW5kIGZvciBjdXJyZW50IG1vdGlvbiBvciB0cmFuc2l0aW9uXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgLy8gY2FsY3VsYXRlIHRoZSB0aW1lIHRvIGN0cmwudmFsdWUgZmlyc3QgaGl0cyBsb3cgb3IgaGlnaFxuICAgICAgICAgICAgICAgIGNvbnN0IHt2ZWxvY2l0eTp2MH0gPSBjdHJsX2l0ZW0uYXJncztcbiAgICAgICAgICAgICAgICAvLyBmaWd1ciBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgLy8gYXNzdW1pbmcgd2UgYXJlIGN1cnJlbnRseSBiZXR3ZWVuIGxvdyBhbmQgaGlnaFxuICAgICAgICAgICAgICAgIGxldCB0YXJnZXRfcG9zaXRpb24gPSAodjAgPiAwKSA/IGhpZ2ggOiBsb3c7XG4gICAgICAgICAgICAgICAgLy8gbm8gbmVlZCBmb3IgdGltZW91dCBpZiBib3VuZGFyeSBpcyBpbmZpbml0eVxuICAgICAgICAgICAgICAgIGlmIChpc0Zpbml0ZSh0YXJnZXRfcG9zaXRpb24pKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSB0aW1lIHVudGlsIGhpdHRpbmcgdGFyZ2V0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlbHRhX3NlYyA9IE1hdGguYWJzKHRhcmdldF9wb3NpdGlvbiAtIGN0cmxfb2Zmc2V0KS92MDtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzZXQgdGltZW91dFwiKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl90aWQgPSBzZXRUaW1lb3V0KHRoaXMuX19oYW5kbGVfdGltZW91dC5iaW5kKHRoaXMpLCBkZWx0YV9zZWMqMTAwMCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBvcHRpb24gWzJdIC0gcG9sbGluZyB1bnRpbCBjdHJsLnZhbHVlIGlzIG5vIGxvbmdlciB3aXRpbiBpdHZcbiAgICAgICAgICAgICAqIE5PVCBTVVBQT1JURURcbiAgICAgICAgICAgICAqIFxuICAgICAgICAgICAgICogb3B0aW9uIFszXSAtIGRvIG5vdGhpbmdcbiAgICAgICAgICAgICAqL1xuXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfX2hhbmRsZV90aW1lb3V0KCkge1xuICAgICAgICAvLyB0cmlnZ2VyIGNoYW5nZSBldmVudCBmb3IgY3Vyc29yXG4gICAgICAgIGNvbnNvbGUubG9nKFwidGltZW91dFwiKTtcbiAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIik7XG4gICAgfVxuXG5cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgXG4gICAgcXVlcnkgKCkge1xuICAgICAgICBsZXQge3ZhbHVlOm9mZnNldH0gPSB0aGlzLmN0cmwucXVlcnkoKVxuICAgICAgICBpZiAodHlwZW9mIG9mZnNldCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3RybCBzdGF0ZSBtdXN0IGJlIG51bWJlciAke29mZnNldH1gKTtcbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgICogVE9ETyAtIGlmIHF1ZXJ5IGNhdXNlcyBhIGNhY2hlIG1pc3MsIHdlIHNob3VsZCBnZW5lcmF0ZSBhblxuICAgICAgICAgKiBldmVudCB0byBsZXQgY29uc3VtZXJzIGtub3cgY3Vyc29yIHN0YXRlIGhhcyBjaGFuZ2VkLlxuICAgICAgICAgKi9cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlLnF1ZXJ5KG9mZnNldCk7XG4gICAgfVxuXG4gICAgZ2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5xdWVyeSgpLnZhbHVlfTtcblxuICAgIHN0YXRlICgpIHtcbiAgICAgICAgLy8gbmVhcmJ5LmNlbnRlciByZXByZXNlbnRzIHRoZSBzdGF0ZSBvZiB0aGUgY3Vyc29yXG4gICAgICAgIC8vIHRoZSBlbnN1cmUgdGhhdCB0aGUgY2FjaGUgaXMgbm90IHN0YWxlIC0gcnVuIGEgcXVlcnkgZmlyc3RcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlLm5lYXJieS5jZW50ZXI7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBVUERBVEUgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBhc3NpZ24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzKS5hc3NpZ24odmFsdWUpO1xuICAgIH1cbiAgICBtb3ZlICh7cG9zaXRpb24sIHZlbG9jaXR5fSkge1xuICAgICAgICBsZXQge3ZhbHVlLCByYXRlLCBvZmZzZXQ6dGltZXN0YW1wfSA9IHRoaXMucXVlcnkoKTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3Vyc29yIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7dmFsdWV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcG9zaXRpb24gPSAocG9zaXRpb24gIT0gdW5kZWZpbmVkKSA/IHBvc2l0aW9uIDogdmFsdWU7XG4gICAgICAgIHZlbG9jaXR5ID0gKHZlbG9jaXR5ICE9IHVuZGVmaW5lZCkgPyB2ZWxvY2l0eTogcmF0ZTtcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzKS5tb3ZlKHtwb3NpdGlvbiwgdmVsb2NpdHksIHRpbWVzdGFtcH0pO1xuICAgIH1cbiAgICB0cmFuc2l0aW9uICh7dGFyZ2V0LCBkdXJhdGlvbiwgZWFzaW5nfSkge1xuICAgICAgICBsZXQge3ZhbHVlOnYwLCBvZmZzZXQ6dDB9ID0gdGhpcy5xdWVyeSgpO1xuICAgICAgICBpZiAodHlwZW9mIHYwICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3Igc3RhdGUgbXVzdCBiZSBudW1iZXIgJHt2MH1gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY21kKHRoaXMpLnRyYW5zaXRpb24odjAsIHRhcmdldCwgdDAsIHQwICsgZHVyYXRpb24sIGVhc2luZyk7XG4gICAgfVxuICAgIGludGVycG9sYXRlICh7dHVwbGVzLCBkdXJhdGlvbn0pIHtcbiAgICAgICAgbGV0IHQwID0gdGhpcy5xdWVyeSgpLm9mZnNldDtcbiAgICAgICAgLy8gYXNzdW1pbmcgdGltc3RhbXBzIGFyZSBpbiByYW5nZSBbMCwxXVxuICAgICAgICAvLyBzY2FsZSB0aW1lc3RhbXBzIHRvIGR1cmF0aW9uXG4gICAgICAgIHR1cGxlcyA9IHR1cGxlcy5tYXAoKFt2LHRdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3YsIHQwICsgdCpkdXJhdGlvbl07XG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiBjbWQodGhpcykuaW50ZXJwb2xhdGUodHVwbGVzKTtcbiAgICB9XG5cbn1cbnNvdXJjZS5hZGRUb1Byb3RvdHlwZShDdXJzb3IucHJvdG90eXBlLCBcInNyY1wiLCB7bXV0YWJsZTp0cnVlfSk7XG5zb3VyY2UuYWRkVG9Qcm90b3R5cGUoQ3Vyc29yLnByb3RvdHlwZSwgXCJjdHJsXCIsIHttdXRhYmxlOnRydWV9KTtcblxuIiwiXG5pbXBvcnQgeyBMYXllckJhc2UsIFN0YXRlUHJvdmlkZXJCYXNlIH0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7IHNvdXJjZSB9IGZyb20gXCIuL3V0aWwuanNcIjtcbmltcG9ydCB7IFNpbXBsZVN0YXRlUHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX3NpbXBsZS5qc1wiO1xuaW1wb3J0IHsgU2ltcGxlTmVhcmJ5SW5kZXggfSBmcm9tIFwiLi9uZWFyYnlpbmRleF9zaW1wbGUuanNcIjtcbmltcG9ydCB7IE5lYXJieUNhY2hlIH0gZnJvbSBcIi4vbmVhcmJ5Y2FjaGUuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTEFZRVJcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogXG4gKiBMYXllclxuICogLSBoYXMgbXV0YWJsZSBzdGF0ZSBwcm92aWRlciAoc3JjKSAoZGVmYXVsdCBzdGF0ZSB1bmRlZmluZWQpXG4gKiAtIG1ldGhvZHMgZm9yIGxpc3QgYW5kIHNhbXBsZVxuICogXG4gKi9cblxuXG5leHBvcnQgY2xhc3MgTGF5ZXIgZXh0ZW5kcyBMYXllckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICAvLyBzcmNcbiAgICAgICAgc291cmNlLmFkZFRvSW5zdGFuY2UodGhpcywgXCJzcmNcIik7XG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIHRoaXMuX2luZGV4ID0gbmV3IFNpbXBsZU5lYXJieUluZGV4KCk7XG4gICAgICAgIC8vIGNhY2hlXG4gICAgICAgIHRoaXMuX2NhY2hlID0gbmV3IE5lYXJieUNhY2hlKHRoaXMuX2luZGV4KTtcblxuICAgICAgICAvLyBpbml0aWFsaXNlIHdpdGggc3RhdGVwcm92aWRlclxuICAgICAgICBsZXQge3NyYywgLi4ub3B0c30gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3JjID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3JjID0gbmV3IFNpbXBsZVN0YXRlUHJvdmlkZXIob3B0cyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgU3RhdGVQcm92aWRlckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzcmMgbXVzdCBiZSBTdGF0ZXByb3ZpZGVyQmFzZVwiKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogU1JDIChzdGF0ZXByb3ZpZGVyKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgX19zcmNfY2hlY2soc3JjKSB7XG4gICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcInNyY1wiIG11c3QgYmUgc3RhdGUgcHJvdmlkZXIgJHtzb3VyY2V9YCk7XG4gICAgICAgIH1cbiAgICB9ICAgIFxuICAgIF9fc3JjX2hhbmRsZV9jaGFuZ2UoKSB7XG4gICAgICAgIHRoaXMuX2luZGV4LnVwZGF0ZSh0aGlzLnNyYy5pdGVtcyk7XG4gICAgICAgIHRoaXMuX2NhY2hlLmRpcnR5KCk7XG4gICAgICAgIC8vIHRyaWdnZXIgY2hhbmdlIGV2ZW50IGZvciBjdXJzb3JcbiAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdGhpcy5xdWVyeSgpKTsgICBcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFFVRVJZIEFQSVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChvZmZzZXQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJMYXllcjogcXVlcnkgb2Zmc2V0IGNhbiBub3QgYmUgdW5kZWZpbmVkXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIGxpc3QgKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2luZGV4Lmxpc3Qob3B0aW9ucyk7XG4gICAgfVxuXG4gICAgc2FtcGxlIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbmRleC5zYW1wbGUob3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBVUERBVEUgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICAvLyBUT0RPIC0gYWRkIG1ldGhvZHMgZm9yIHVwZGF0ZT9cblxufVxuc291cmNlLmFkZFRvUHJvdG90eXBlKExheWVyLnByb3RvdHlwZSwgXCJzcmNcIiwge211dGFibGU6dHJ1ZX0pO1xuIl0sIm5hbWVzIjpbImNoZWNrX2lucHV0IiwiaW50ZXJwb2xhdGUiLCJzZWdtZW50LlN0YXRpY1NlZ21lbnQiLCJzZWdtZW50LlRyYW5zaXRpb25TZWdtZW50Iiwic2VnbWVudC5JbnRlcnBvbGF0aW9uU2VnbWVudCIsInNlZ21lbnQuTW90aW9uU2VnbWVudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Q0FBQTtDQUNBO0NBQ0E7O0NBRUE7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTtDQUNBO0NBQ0E7O0NBRUE7Q0FDQTtDQUNBOzs7O0NBSUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBOztDQUVBOztDQUVBLE1BQU0sS0FBSyxDQUFDOztDQUVaLENBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUU7Q0FDeEMsRUFBRSxPQUFPLEdBQUcsT0FBTyxJQUFJO0NB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RSxDQUFDLEtBQUssQ0FBQzs7Q0FFNUMsSUFBSSxLQUFLLENBQUMsR0FBRztDQUNiO0NBQ0E7Q0FDQSxRQUFRLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTTtDQUN4Qzs7Q0FFQTtDQUNBO0NBQ0E7O0NBRUEsSUFBSSxNQUFNLENBQUMsS0FBSyxFQUFFO0NBQ2xCLFFBQVEsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztDQUN0QztDQUNBLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLEVBQUU7Q0FDaEMsUUFBUSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRTtDQUMxRCxRQUFRLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO0NBQ3ZDLFlBQVksTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLHFDQUFxQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7Q0FDNUU7Q0FDQSxRQUFRLFFBQVEsR0FBRyxDQUFDLFFBQVEsSUFBSSxTQUFTLElBQUksUUFBUSxHQUFHLEtBQUs7Q0FDN0QsUUFBUSxRQUFRLEdBQUcsQ0FBQyxRQUFRLElBQUksU0FBUyxJQUFJLFFBQVEsRUFBRSxJQUFJO0NBQzNELFFBQVEsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztDQUM5RDtDQUNBLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxFQUFFO0NBQzVDLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUU7Q0FDaEQsUUFBUSxJQUFJLE9BQU8sRUFBRSxLQUFLLFFBQVEsRUFBRTtDQUNwQyxZQUFZ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
