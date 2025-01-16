
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
	        // define change event
	        eventify.addToInstance(this);
	        this.eventifyDefine("change", {init:true});
	    }

	    /**********************************************************
	     * QUERY
	     **********************************************************/

	    query (offset) {
	        throw new Error("Not implemented");
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
	        this.notify_callbacks();
	        // trigger change event for cursor
	        this.eventifyTrigger("change");   
	    }

	    /**********************************************************
	     * QUERY API
	     **********************************************************/

	    get cache () {return this._cache};
	    get index () {return this._index};
	    
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
	        this._index;
	        // cache
	        this._cache;
	        // timeout
	        this._tid;
	        // polling
	        this._pid;
	        // options
	        let {src, ctrl, ...opts} = options;

	        // initialise ctrl
	        if (ctrl == undefined) {
	            ctrl = local_clock;
	        }
	        this.ctrl = ctrl;

	        // initialise state
	        if (src == undefined) {
	            src = new Layer(opts);
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
	        this.__handle_change("ctrl");
	    }

	    /**********************************************************
	     * SRC (stateprovider)
	     **********************************************************/

	    __src_check(src) {
	        if (!(src instanceof LayerBase)) {
	            throw new Error(`"src" must be Layer ${src}`);
	        }
	    }    
	    __src_handle_change() {
	        this.__handle_change("src");
	    }

	    /**********************************************************
	     * CALLBACK
	     **********************************************************/

	    __handle_change(origin) {
	        clearTimeout(this._tid);
	        clearInterval(this._pid);
	        if (this.src && this.ctrl) {
	            if (origin == "src") {
	                // reset cursor index to layer index
	                if (this._index != this.src.index) {
	                    this._index = this.src.index;
	                    this._cache = new NearbyCache(this._index);
	                }
	            }
	            if (origin == "src" || origin == "ctrl") {
	                // refresh cache
	                this._cache.dirty();
	                let {value:offset} = this.ctrl.query();
	                if (typeof offset !== 'number') {
	                    throw new Error(`warning: ctrl state must be number ${offset}`);
	                }        
	                this._cache.refresh(offset); 
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
	     * detect the passing from one segment interval
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
	        const {value:current_pos} = ctrl_vector;

	        // nearby.center - low and high
	        this.cache.refresh(ctrl_vector.value);
	        const src_nearby = this.cache.nearby;
	        const [low, high] = src_nearby.itv.slice(0,2);

	        // ctrl must be dynamic
	        if (!ctrl_vector.dynamic) {
	            return;
	        }

	        // approach [1]
	        if (this.ctrl instanceof ClockCursor) {
	            if (isFinite(high)) {
	                this.__set_timeout(high, current_pos, 1.0);
	            }
	            return;
	        } 
	        if (
	            this.ctrl instanceof Cursor && 
	            this.ctrl.ctrl instanceof ClockCursor
	        ) {
	            const ctrl_nearby = this.ctrl.cache.nearby;

	            if (!isFinite(low) && !isFinite(high)) {
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
	                            this.__set_timeout(target_pos, current_pos, velocity);
	                            return;                           
	                        } else {
	                            // no need for timeout
	                            return;
	                        }
	                    }
	                } else if (ctrl_item.type == "transition") {
	                    const {v0:p0, v1:p1, t0, t1, easing="linear"} = ctrl_item.args;
	                    if (easing == "linear") {
	                        // linear transtion
	                        let velocity = (p1-p0)/(t1-t0);
	                        // figure out which boundary we hit first
	                        const target_pos = (velocity > 0) ? Math.min(high, p1) : Math.max(low, p1);
	                        this.__set_timeout(target_pos, current_pos, velocity);
	                        return;
	                    }
	                }
	            }
	        }

	        // approach [3]
	        this.__set_polling();
	    }

	    __set_timeout(target_pos, current_pos, velocity) {
	        const delta_sec = (target_pos - current_pos)/velocity;
	        this._tid = setTimeout(() => {
	            this.__handle_timeout();
	        }, delta_sec*1000);
	    }

	    __handle_timeout() {
	        // trigger change event for cursor
	        this.eventifyTrigger("change", this.query());
	    }

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

	    query () {
	        let {value:offset} = this.ctrl.query();
	        if (typeof offset !== 'number') {
	            throw new Error(`warning: ctrl state must be number ${offset}`);
	        }
	        let refreshed = this._cache.refresh(offset);
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
	        velocity = (velocity != undefined) ? velocity: rate;
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
	source.addToPrototype(Cursor.prototype, "src", {mutable:true});
	source.addToPrototype(Cursor.prototype, "ctrl", {mutable:true});

	exports.Cursor = Cursor;
	exports.Layer = Layer;
	exports.cmd = cmd;

	return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ldmVudGlmeS5qcyIsIi4uLy4uL3NyYy91dGlsLmpzIiwiLi4vLi4vc3JjL21vbml0b3IuanMiLCIuLi8uLi9zcmMvYmFzZXMuanMiLCIuLi8uLi9zcmMvaW50ZXJ2YWxzLmpzIiwiLi4vLi4vc3JjL3N0YXRlcHJvdmlkZXJfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL2NtZC5qcyIsIi4uLy4uL3NyYy9zZWdtZW50cy5qcyIsIi4uLy4uL3NyYy9uZWFyYnljYWNoZS5qcyIsIi4uLy4uL3NyYy9uZWFyYnlpbmRleC5qcyIsIi4uLy4uL3NyYy9uZWFyYnlpbmRleF9zaW1wbGUuanMiLCIuLi8uLi9zcmMvbGF5ZXJzLmpzIiwiLi4vLi4vc3JjL2N1cnNvcnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcblx0Q29weXJpZ2h0IDIwMjBcblx0QXV0aG9yIDogSW5nYXIgQXJudHplblxuXG5cdFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUaW1pbmdzcmMgbW9kdWxlLlxuXG5cdFRpbWluZ3NyYyBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG5cdGl0IHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieVxuXHR0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvclxuXHQoYXQgeW91ciBvcHRpb24pIGFueSBsYXRlciB2ZXJzaW9uLlxuXG5cdFRpbWluZ3NyYyBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLFxuXHRidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7IHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZlxuXHRNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG5cdEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuXG5cdFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZVxuXHRhbG9uZyB3aXRoIFRpbWluZ3NyYy4gIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiovXG5cblxuXG4vKlxuXHRFdmVudFxuXHQtIG5hbWU6IGV2ZW50IG5hbWVcblx0LSBwdWJsaXNoZXI6IHRoZSBvYmplY3Qgd2hpY2ggZGVmaW5lZCB0aGUgZXZlbnRcblx0LSBpbml0OiB0cnVlIGlmIHRoZSBldmVudCBzdXBwcG9ydHMgaW5pdCBldmVudHNcblx0LSBzdWJzY3JpcHRpb25zOiBzdWJzY3JpcHRpbnMgdG8gdGhpcyBldmVudFxuXG4qL1xuXG5jbGFzcyBFdmVudCB7XG5cblx0Y29uc3RydWN0b3IgKHB1Ymxpc2hlciwgbmFtZSwgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5wdWJsaXNoZXIgPSBwdWJsaXNoZXI7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gZmFsc2UgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zID0gW107XG5cdH1cblxuXHQvKlxuXHRcdHN1YnNjcmliZSB0byBldmVudFxuXHRcdC0gc3Vic2NyaWJlcjogc3Vic2NyaWJpbmcgb2JqZWN0XG5cdFx0LSBjYWxsYmFjazogY2FsbGJhY2sgZnVuY3Rpb24gdG8gaW52b2tlXG5cdFx0LSBvcHRpb25zOlxuXHRcdFx0aW5pdDogaWYgdHJ1ZSBzdWJzY3JpYmVyIHdhbnRzIGluaXQgZXZlbnRzXG5cdCovXG5cdHN1YnNjcmliZSAoY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRpZiAoIWNhbGxiYWNrIHx8IHR5cGVvZiBjYWxsYmFjayAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayBub3QgYSBmdW5jdGlvblwiLCBjYWxsYmFjayk7XG5cdFx0fVxuXHRcdGNvbnN0IHN1YiA9IG5ldyBTdWJzY3JpcHRpb24odGhpcywgY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5wdXNoKHN1Yik7XG5cdCAgICAvLyBJbml0aWF0ZSBpbml0IGNhbGxiYWNrIGZvciB0aGlzIHN1YnNjcmlwdGlvblxuXHQgICAgaWYgKHRoaXMuaW5pdCAmJiBzdWIuaW5pdCkge1xuXHQgICAgXHRzdWIuaW5pdF9wZW5kaW5nID0gdHJ1ZTtcblx0ICAgIFx0bGV0IHNlbGYgPSB0aGlzO1xuXHQgICAgXHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgIFx0XHRjb25zdCBlQXJncyA9IHNlbGYucHVibGlzaGVyLmV2ZW50aWZ5SW5pdEV2ZW50QXJncyhzZWxmLm5hbWUpIHx8IFtdO1xuXHQgICAgXHRcdHN1Yi5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0ICAgIFx0XHRmb3IgKGxldCBlQXJnIG9mIGVBcmdzKSB7XG5cdCAgICBcdFx0XHRzZWxmLnRyaWdnZXIoZUFyZywgW3N1Yl0sIHRydWUpO1xuXHQgICAgXHRcdH1cblx0ICAgIFx0fSk7XG5cdCAgICB9XG5cdFx0cmV0dXJuIHN1YlxuXHR9XG5cblx0Lypcblx0XHR0cmlnZ2VyIGV2ZW50XG5cblx0XHQtIGlmIHN1YiBpcyB1bmRlZmluZWQgLSBwdWJsaXNoIHRvIGFsbCBzdWJzY3JpcHRpb25zXG5cdFx0LSBpZiBzdWIgaXMgZGVmaW5lZCAtIHB1Ymxpc2ggb25seSB0byBnaXZlbiBzdWJzY3JpcHRpb25cblx0Ki9cblx0dHJpZ2dlciAoZUFyZywgc3VicywgaW5pdCkge1xuXHRcdGxldCBlSW5mbywgY3R4O1xuXHRcdGZvciAoY29uc3Qgc3ViIG9mIHN1YnMpIHtcblx0XHRcdC8vIGlnbm9yZSB0ZXJtaW5hdGVkIHN1YnNjcmlwdGlvbnNcblx0XHRcdGlmIChzdWIudGVybWluYXRlZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGVJbmZvID0ge1xuXHRcdFx0XHRzcmM6IHRoaXMucHVibGlzaGVyLFxuXHRcdFx0XHRuYW1lOiB0aGlzLm5hbWUsXG5cdFx0XHRcdHN1Yjogc3ViLFxuXHRcdFx0XHRpbml0OiBpbml0XG5cdFx0XHR9XG5cdFx0XHRjdHggPSBzdWIuY3R4IHx8IHRoaXMucHVibGlzaGVyO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0c3ViLmNhbGxiYWNrLmNhbGwoY3R4LCBlQXJnLCBlSW5mbyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYEVycm9yIGluICR7dGhpcy5uYW1lfTogJHtzdWIuY2FsbGJhY2t9ICR7ZXJyfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qXG5cdHVuc3Vic2NyaWJlIGZyb20gZXZlbnRcblx0LSB1c2Ugc3Vic2NyaXB0aW9uIHJldHVybmVkIGJ5IHByZXZpb3VzIHN1YnNjcmliZVxuXHQqL1xuXHR1bnN1YnNjcmliZShzdWIpIHtcblx0XHRsZXQgaWR4ID0gdGhpcy5zdWJzY3JpcHRpb25zLmluZGV4T2Yoc3ViKTtcblx0XHRpZiAoaWR4ID4gLTEpIHtcblx0XHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdHN1Yi50ZXJtaW5hdGUoKTtcblx0XHR9XG5cdH1cbn1cblxuXG4vKlxuXHRTdWJzY3JpcHRpb24gY2xhc3NcbiovXG5cbmNsYXNzIFN1YnNjcmlwdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoZXZlbnQsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLmV2ZW50ID0gZXZlbnQ7XG5cdFx0dGhpcy5uYW1lID0gZXZlbnQubmFtZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2tcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gdGhpcy5ldmVudC5pbml0IDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gZmFsc2U7XG5cdFx0dGhpcy5jdHggPSBvcHRpb25zLmN0eDtcblx0fVxuXG5cdHRlcm1pbmF0ZSgpIHtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSB0cnVlO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5ldmVudC51bnN1YnNjcmliZSh0aGlzKTtcblx0fVxufVxuXG5cbi8qXG5cblx0RVZFTlRJRlkgSU5TVEFOQ0VcblxuXHRFdmVudGlmeSBicmluZ3MgZXZlbnRpbmcgY2FwYWJpbGl0aWVzIHRvIGFueSBvYmplY3QuXG5cblx0SW4gcGFydGljdWxhciwgZXZlbnRpZnkgc3VwcG9ydHMgdGhlIGluaXRpYWwtZXZlbnQgcGF0dGVybi5cblx0T3B0LWluIGZvciBpbml0aWFsIGV2ZW50cyBwZXIgZXZlbnQgdHlwZS5cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlJbnN0YW5jZSAob2JqZWN0KSB7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwID0gbmV3IE1hcCgpO1xuXHRvYmplY3QuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0cmV0dXJuIG9iamVjdDtcbn07XG5cblxuLypcblx0RVZFTlRJRlkgUFJPVE9UWVBFXG5cblx0QWRkIGV2ZW50aWZ5IGZ1bmN0aW9uYWxpdHkgdG8gcHJvdG90eXBlIG9iamVjdFxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5UHJvdG90eXBlKF9wcm90b3R5cGUpIHtcblxuXHRmdW5jdGlvbiBldmVudGlmeUdldEV2ZW50KG9iamVjdCwgbmFtZSkge1xuXHRcdGNvbnN0IGV2ZW50ID0gb2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAuZ2V0KG5hbWUpO1xuXHRcdGlmIChldmVudCA9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IHVuZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0cmV0dXJuIGV2ZW50O1xuXHR9XG5cblx0Lypcblx0XHRERUZJTkUgRVZFTlRcblx0XHQtIHVzZWQgb25seSBieSBldmVudCBzb3VyY2Vcblx0XHQtIG5hbWU6IG5hbWUgb2YgZXZlbnRcblx0XHQtIG9wdGlvbnM6IHtpbml0OnRydWV9IHNwZWNpZmllcyBpbml0LWV2ZW50IHNlbWFudGljcyBmb3IgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlEZWZpbmUobmFtZSwgb3B0aW9ucykge1xuXHRcdC8vIGNoZWNrIHRoYXQgZXZlbnQgZG9lcyBub3QgYWxyZWFkeSBleGlzdFxuXHRcdGlmICh0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuaGFzKG5hbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCBhbHJlYWR5IGRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5zZXQobmFtZSwgbmV3IEV2ZW50KHRoaXMsIG5hbWUsIG9wdGlvbnMpKTtcblx0fTtcblxuXHQvKlxuXHRcdE9OXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRyZWdpc3RlciBjYWxsYmFjayBvbiBldmVudC5cblx0Ki9cblx0ZnVuY3Rpb24gb24obmFtZSwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpYmUoY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T0ZGXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRVbi1yZWdpc3RlciBhIGhhbmRsZXIgZnJvbSBhIHNwZWNmaWMgZXZlbnQgdHlwZVxuXHQqL1xuXHRmdW5jdGlvbiBvZmYoc3ViKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgc3ViLm5hbWUpLnVuc3Vic2NyaWJlKHN1Yik7XG5cdH07XG5cblxuXHRmdW5jdGlvbiBldmVudGlmeVN1YnNjcmlwdGlvbnMobmFtZSkge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmlwdGlvbnM7XG5cdH1cblxuXG5cblx0Lypcblx0XHRUcmlnZ2VyIGxpc3Qgb2YgZXZlbnRJdGVtcyBvbiBvYmplY3RcblxuXHRcdGV2ZW50SXRlbTogIHtuYW1lOi4uLCBlQXJnOi4ufVxuXG5cdFx0Y29weSBhbGwgZXZlbnRJdGVtcyBpbnRvIGJ1ZmZlci5cblx0XHRyZXF1ZXN0IGVtcHR5aW5nIHRoZSBidWZmZXIsIGkuZS4gYWN0dWFsbHkgdHJpZ2dlcmluZyBldmVudHMsXG5cdFx0ZXZlcnkgdGltZSB0aGUgYnVmZmVyIGdvZXMgZnJvbSBlbXB0eSB0byBub24tZW1wdHlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxsKGV2ZW50SXRlbXMpIHtcblx0XHRpZiAoZXZlbnRJdGVtcy5sZW5ndGggPT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIG1ha2UgdHJpZ2dlciBpdGVtc1xuXHRcdC8vIHJlc29sdmUgbm9uLXBlbmRpbmcgc3Vic2NyaXB0aW9ucyBub3dcblx0XHQvLyBlbHNlIHN1YnNjcmlwdGlvbnMgbWF5IGNoYW5nZSBmcm9tIHBlbmRpbmcgdG8gbm9uLXBlbmRpbmdcblx0XHQvLyBiZXR3ZWVuIGhlcmUgYW5kIGFjdHVhbCB0cmlnZ2VyaW5nXG5cdFx0Ly8gbWFrZSBsaXN0IG9mIFtldiwgZUFyZywgc3Vic10gdHVwbGVzXG5cdFx0bGV0IHRyaWdnZXJJdGVtcyA9IGV2ZW50SXRlbXMubWFwKChpdGVtKSA9PiB7XG5cdFx0XHRsZXQge25hbWUsIGVBcmd9ID0gaXRlbTtcblx0XHRcdGxldCBldiA9IGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSk7XG5cdFx0XHRsZXQgc3VicyA9IGV2LnN1YnNjcmlwdGlvbnMuZmlsdGVyKHN1YiA9PiBzdWIuaW5pdF9wZW5kaW5nID09IGZhbHNlKTtcblx0XHRcdHJldHVybiBbZXYsIGVBcmcsIHN1YnNdO1xuXHRcdH0sIHRoaXMpO1xuXG5cdFx0Ly8gYXBwZW5kIHRyaWdnZXIgSXRlbXMgdG8gYnVmZmVyXG5cdFx0Y29uc3QgbGVuID0gdHJpZ2dlckl0ZW1zLmxlbmd0aDtcblx0XHRjb25zdCBidWYgPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyO1xuXHRcdGNvbnN0IGJ1Zl9sZW4gPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aDtcblx0XHQvLyByZXNlcnZlIG1lbW9yeSAtIHNldCBuZXcgbGVuZ3RoXG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGggPSBidWZfbGVuICsgbGVuO1xuXHRcdC8vIGNvcHkgdHJpZ2dlckl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGZvciAobGV0IGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0YnVmW2J1Zl9sZW4raV0gPSB0cmlnZ2VySXRlbXNbaV07XG5cdFx0fVxuXHRcdC8vIHJlcXVlc3QgZW1wdHlpbmcgb2YgdGhlIGJ1ZmZlclxuXHRcdGlmIChidWZfbGVuID09IDApIHtcblx0XHRcdGxldCBzZWxmID0gdGhpcztcblx0XHRcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGZvciAobGV0IFtldiwgZUFyZywgc3Vic10gb2Ygc2VsZi5fX2V2ZW50aWZ5X2J1ZmZlcikge1xuXHRcdFx0XHRcdC8vIGFjdHVhbCBldmVudCB0cmlnZ2VyaW5nXG5cdFx0XHRcdFx0ZXYudHJpZ2dlcihlQXJnLCBzdWJzLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZi5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIG11bHRpcGxlIGV2ZW50cyBvZiBzYW1lIHR5cGUgKG5hbWUpXG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsaWtlKG5hbWUsIGVBcmdzKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKGVBcmdzLm1hcChlQXJnID0+IHtcblx0XHRcdHJldHVybiB7bmFtZSwgZUFyZ307XG5cdFx0fSkpO1xuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIHNpbmdsZSBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXIobmFtZSwgZUFyZykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChbe25hbWUsIGVBcmd9XSk7XG5cdH1cblxuXHRfcHJvdG90eXBlLmV2ZW50aWZ5RGVmaW5lID0gZXZlbnRpZnlEZWZpbmU7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyID0gZXZlbnRpZnlUcmlnZ2VyO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsaWtlID0gZXZlbnRpZnlUcmlnZ2VyQWxpa2U7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxsID0gZXZlbnRpZnlUcmlnZ2VyQWxsO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5U3Vic2NyaXB0aW9ucyA9IGV2ZW50aWZ5U3Vic2NyaXB0aW9ucztcblx0X3Byb3RvdHlwZS5vbiA9IG9uO1xuXHRfcHJvdG90eXBlLm9mZiA9IG9mZjtcbn07XG5cblxuZXhwb3J0IGNvbnN0IGV2ZW50aWZ5ID0gZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4ge1xuXHRcdGFkZFRvSW5zdGFuY2U6IGV2ZW50aWZ5SW5zdGFuY2UsXG5cdFx0YWRkVG9Qcm90b3R5cGU6IGV2ZW50aWZ5UHJvdG90eXBlXG5cdH1cbn0oKTtcblxuLypcblx0RXZlbnQgVmFyaWFibGVcblxuXHRPYmplY3RzIHdpdGggYSBzaW5nbGUgXCJjaGFuZ2VcIiBldmVudFxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50VmFyaWFibGUge1xuXG5cdGNvbnN0cnVjdG9yICh2YWx1ZSkge1xuXHRcdGV2ZW50aWZ5SW5zdGFuY2UodGhpcyk7XG5cdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHR0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcblx0fVxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5fdmFsdWV9O1xuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlICE9IHRoaXMuX3ZhbHVlKSB7XG5cdFx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuZXZlbnRpZnlQcm90b3R5cGUoRXZlbnRWYXJpYWJsZS5wcm90b3R5cGUpO1xuXG4vKlxuXHRFdmVudCBCb29sZWFuXG5cblxuXHROb3RlIDogaW1wbGVtZW50YXRpb24gdXNlcyBmYWxzaW5lc3Mgb2YgaW5wdXQgcGFyYW1ldGVyIHRvIGNvbnN0cnVjdG9yIGFuZCBzZXQoKSBvcGVyYXRpb24sXG5cdHNvIGV2ZW50Qm9vbGVhbigtMSkgd2lsbCBhY3R1YWxseSBzZXQgaXQgdG8gdHJ1ZSBiZWNhdXNlXG5cdCgtMSkgPyB0cnVlIDogZmFsc2UgLT4gdHJ1ZSAhXG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRCb29sZWFuIGV4dGVuZHMgRXZlbnRWYXJpYWJsZSB7XG5cdGNvbnN0cnVjdG9yKHZhbHVlKSB7XG5cdFx0c3VwZXIoQm9vbGVhbih2YWx1ZSkpO1xuXHR9XG5cblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdHN1cGVyLnZhbHVlID0gQm9vbGVhbih2YWx1ZSk7XG5cdH1cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gc3VwZXIudmFsdWV9O1xufVxuXG5cbi8qXG5cdG1ha2UgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gRXZlbnRCb29sZWFuIGNoYW5nZXNcblx0dmFsdWUuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQcm9taXNlKGV2ZW50T2JqZWN0LCBjb25kaXRpb25GdW5jKSB7XG5cdGNvbmRpdGlvbkZ1bmMgPSBjb25kaXRpb25GdW5jIHx8IGZ1bmN0aW9uKHZhbCkge3JldHVybiB2YWwgPT0gdHJ1ZX07XG5cdHJldHVybiBuZXcgUHJvbWlzZSAoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdGxldCBzdWIgPSBldmVudE9iamVjdC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdGlmIChjb25kaXRpb25GdW5jKHZhbHVlKSkge1xuXHRcdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHRcdFx0ZXZlbnRPYmplY3Qub2ZmKHN1Yik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufTtcblxuLy8gbW9kdWxlIGFwaVxuZXhwb3J0IGRlZmF1bHQge1xuXHRldmVudGlmeVByb3RvdHlwZSxcblx0ZXZlbnRpZnlJbnN0YW5jZSxcblx0RXZlbnRWYXJpYWJsZSxcblx0RXZlbnRCb29sZWFuLFxuXHRtYWtlUHJvbWlzZVxufTtcblxuIiwiXG4vLyBvdnZlcnJpZGUgbW9kdWxvIHRvIGJlaGF2ZSBiZXR0ZXIgZm9yIG5lZ2F0aXZlIG51bWJlcnNcbmV4cG9ydCBmdW5jdGlvbiBtb2QobiwgbSkge1xuICAgIHJldHVybiAoKG4gJSBtKSArIG0pICUgbTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBkaXZtb2QoeCwgYmFzZSkge1xuICAgIGxldCBuID0gTWF0aC5mbG9vcih4IC8gYmFzZSlcbiAgICBsZXQgciA9IG1vZCh4LCBiYXNlKTtcbiAgICByZXR1cm4gW24sIHJdO1xufVxuXG5cbi8qXG4gICAgc2ltaWxhciB0byByYW5nZSBmdW5jdGlvbiBpbiBweXRob25cbiovXG5cbmV4cG9ydCBmdW5jdGlvbiByYW5nZSAoc3RhcnQsIGVuZCwgc3RlcCA9IDEsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICBjb25zdCB7aW5jbHVkZV9lbmQ9ZmFsc2V9ID0gb3B0aW9ucztcbiAgICBpZiAoc3RlcCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0ZXAgY2Fubm90IGJlIHplcm8uJyk7XG4gICAgfVxuICAgIGlmIChzdGFydCA8IGVuZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gc3RlcCkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChzdGFydCA+IGVuZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPiBlbmQ7IGkgLT0gc3RlcCkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChpbmNsdWRlX2VuZCkge1xuICAgICAgICByZXN1bHQucHVzaChlbmQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5cblxuLypcbiAgICBUaGlzIGFkZHMgYmFzaWMgKHN5bmNocm9ub3VzKSBjYWxsYmFjayBzdXBwb3J0IHRvIGFuIG9iamVjdC5cbiovXG5cbmV4cG9ydCBjb25zdCBjYWxsYmFjayA9IGZ1bmN0aW9uICgpIHtcblxuICAgIGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2Uob2JqZWN0KSB7XG4gICAgICAgIG9iamVjdC5fX2NhbGxiYWNrX2NhbGxiYWNrcyA9IFtdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZF9jYWxsYmFjayAoaGFuZGxlcikge1xuICAgICAgICBsZXQgaGFuZGxlID0ge1xuICAgICAgICAgICAgaGFuZGxlcjogaGFuZGxlclxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX19jYWxsYmFja19jYWxsYmFja3MucHVzaChoYW5kbGUpO1xuICAgICAgICByZXR1cm4gaGFuZGxlO1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiByZW1vdmVfY2FsbGJhY2sgKGhhbmRsZSkge1xuICAgICAgICBsZXQgaW5kZXggPSB0aGlzLl9fY2FsbGJhY2tfY2FsbGJhY2tzLmluZGV4b2YoaGFuZGxlKTtcbiAgICAgICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuX19jYWxsYmFja19jYWxsYmFja3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBub3RpZnlfY2FsbGJhY2tzIChlQXJnKSB7XG4gICAgICAgIHRoaXMuX19jYWxsYmFja19jYWxsYmFja3MuZm9yRWFjaChmdW5jdGlvbihoYW5kbGUpIHtcbiAgICAgICAgICAgIGhhbmRsZS5oYW5kbGVyKGVBcmcpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG5cbiAgICBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuICAgICAgICBjb25zdCBhcGkgPSB7XG4gICAgICAgICAgICBhZGRfY2FsbGJhY2ssIHJlbW92ZV9jYWxsYmFjaywgbm90aWZ5X2NhbGxiYWNrc1xuICAgICAgICB9XG4gICAgICAgIE9iamVjdC5hc3NpZ24oX3Byb3RvdHlwZSwgYXBpKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge2FkZFRvSW5zdGFuY2UsIGFkZFRvUHJvdG90eXBlfVxufSgpO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIFNPVVJDRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBFeHRlbmQgYSBjbGFzcyB3aXRoIHN1cHBvcnQgZm9yIGV4dGVybmFsIHNvdXJjZSBvbiBcbiAqIGEgbmFtZWQgcHJvcGVydHkuXG4gKiBcbiAqIG9wdGlvbjogbXV0YWJsZTp0cnVlIG1lYW5zIHRoYXQgcHJvcGVyeSBtYXkgYmUgcmVzZXQgXG4gKiBcbiAqIHNvdXJjZSBvYmplY3QgaXMgYXNzdW1lZCB0byBzdXBwb3J0IHRoZSBjYWxsYmFjayBpbnRlcmZhY2VcbiAqL1xuXG5cbmV4cG9ydCBjb25zdCBzb3VyY2UgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICBmdW5jdGlvbiBwcm9wbmFtZXMgKHByb3BOYW1lKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwcm9wOiBgX18ke3Byb3BOYW1lfWAsXG4gICAgICAgICAgICBpbml0OiBgX18ke3Byb3BOYW1lfV9pbml0YCxcbiAgICAgICAgICAgIGhhbmRsZTogYF9fJHtwcm9wTmFtZX1faGFuZGxlYCxcbiAgICAgICAgICAgIGNoYW5nZTogYF9fJHtwcm9wTmFtZX1faGFuZGxlX2NoYW5nZWAsXG4gICAgICAgICAgICBkZXRhdGNoOiBgX18ke3Byb3BOYW1lfV9kZXRhdGNoYCxcbiAgICAgICAgICAgIGF0dGF0Y2g6IGBfXyR7cHJvcE5hbWV9X2F0dGF0Y2hgLFxuICAgICAgICAgICAgY2hlY2s6IGBfXyR7cHJvcE5hbWV9X2NoZWNrYFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYWRkVG9JbnN0YW5jZSAob2JqZWN0LCBwcm9wTmFtZSkge1xuICAgICAgICBjb25zdCBwID0gcHJvcG5hbWVzKHByb3BOYW1lKVxuICAgICAgICBvYmplY3RbcC5wcm9wXSA9IHVuZGVmaW5lZFxuICAgICAgICBvYmplY3RbcC5pbml0XSA9IGZhbHNlO1xuICAgICAgICBvYmplY3RbcC5oYW5kbGVdID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlIChfcHJvdG90eXBlLCBwcm9wTmFtZSwgb3B0aW9ucz17fSkge1xuXG4gICAgICAgIGNvbnN0IHAgPSBwcm9wbmFtZXMocHJvcE5hbWUpXG5cbiAgICAgICAgZnVuY3Rpb24gZGV0YXRjaCgpIHtcbiAgICAgICAgICAgIC8vIHVuc3Vic2NyaWJlIGZyb20gc291cmNlIGNoYW5nZSBldmVudFxuICAgICAgICAgICAgbGV0IHttdXRhYmxlPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgICAgICAgICBpZiAobXV0YWJsZSAmJiB0aGlzW3AucHJvcF0pIHtcbiAgICAgICAgICAgICAgICBsZXQgaGFuZGxlID0gdGhpc1twLmhhbmRsZV07XG4gICAgICAgICAgICAgICAgdGhpc1twLnByb3BdLnJlbW92ZV9jYWxsYmFjayhoYW5kbGUpO1xuICAgICAgICAgICAgICAgIHRoaXNbcC5oYW5kbGVdID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpc1twLnByb3BdID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIGZ1bmN0aW9uIGF0dGF0Y2goc291cmNlKSB7XG4gICAgICAgICAgICBsZXQge211dGFibGU9ZmFsc2V9ID0gb3B0aW9ucztcbiAgICAgICAgICAgIGlmICghdGhpc1twLmluaXRdIHx8IG11dGFibGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzW3AucHJvcF0gPSBzb3VyY2U7XG4gICAgICAgICAgICAgICAgdGhpc1twLmluaXRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAvLyBzdWJzY3JpYmUgdG8gY2FsbGJhY2sgZnJvbSBzb3VyY2VcbiAgICAgICAgICAgICAgICBpZiAodGhpc1twLmNoYW5nZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IHRoaXNbcC5jaGFuZ2VdLmJpbmQodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbcC5oYW5kbGVdID0gc291cmNlLmFkZF9jYWxsYmFjayhoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlcigpOyBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtwcm9wTmFtZX0gY2FuIG5vdCBiZSByZWFzc2lnbmVkYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogXG4gICAgICAgICAqIG9iamVjdCBtdXN0IGltcGxlbWVudFxuICAgICAgICAgKiBfX3twcm9wTmFtZX1faGFuZGxlX2NoYW5nZSgpIHt9XG4gICAgICAgICAqIFxuICAgICAgICAgKiBvYmplY3QgY2FuIGltcGxlbWVudFxuICAgICAgICAgKiBfX3twcm9wTmFtZX1fY2hlY2soc291cmNlKSB7fVxuICAgICAgICAgKi9cblxuICAgICAgICAvLyBnZXR0ZXIgYW5kIHNldHRlclxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoX3Byb3RvdHlwZSwgcHJvcE5hbWUsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzW3AucHJvcF07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAoc3JjKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXNbcC5jaGVja10pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1twLmNoZWNrXShzcmMpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzcmMgIT0gdGhpc1twLnByb3BdKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbcC5kZXRhdGNoXSgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzW3AuYXR0YXRjaF0oc3JjKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgYXBpID0ge307XG4gICAgICAgIGFwaVtwLmRldGF0Y2hdID0gZGV0YXRjaDtcbiAgICAgICAgYXBpW3AuYXR0YXRjaF0gPSBhdHRhdGNoO1xuXG4gICAgICAgIE9iamVjdC5hc3NpZ24oX3Byb3RvdHlwZSwgYXBpKTtcbiAgICB9XG4gICAgcmV0dXJuIHthZGRUb0luc3RhbmNlLCBhZGRUb1Byb3RvdHlwZX07XG59KCk7XG5cbiIsImltcG9ydCB7ZGl2bW9kfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5cbi8qXG4gICAgVGltZW91dCBNb25pdG9yXG5cbiAgICBUaW1lb3V0IE1vbml0b3IgaXMgc2ltaWxhciB0byBzZXRJbnRlcnZhbCwgaW4gdGhlIHNlbnNlIHRoYXQgXG4gICAgaXQgYWxsb3dzIGNhbGxiYWNrcyB0byBiZSBmaXJlZCBwZXJpb2RpY2FsbHkgXG4gICAgd2l0aCBhIGdpdmVuIGRlbGF5IChpbiBtaWxsaXMpLiAgXG4gICAgXG4gICAgVGltZW91dCBNb25pdG9yIGlzIG1hZGUgdG8gc2FtcGxlIHRoZSBzdGF0ZSBcbiAgICBvZiBhIGR5bmFtaWMgb2JqZWN0LCBwZXJpb2RpY2FsbHkuIEZvciB0aGlzIHJlYXNvbiwgZWFjaCBjYWxsYmFjayBpcyBcbiAgICBib3VuZCB0byBhIG1vbml0b3JlZCBvYmplY3QsIHdoaWNoIHdlIGhlcmUgY2FsbCBhIHZhcmlhYmxlLiBcbiAgICBPbiBlYWNoIGludm9jYXRpb24sIGEgY2FsbGJhY2sgd2lsbCBwcm92aWRlIGEgZnJlc2hseSBzYW1wbGVkIFxuICAgIHZhbHVlIGZyb20gdGhlIHZhcmlhYmxlLlxuXG4gICAgVGhpcyB2YWx1ZSBpcyBhc3N1bWVkIHRvIGJlIGF2YWlsYWJsZSBieSBxdWVyeWluZyB0aGUgdmFyaWFibGUuIFxuXG4gICAgICAgIHYucXVlcnkoKSAtPiB7dmFsdWUsIGR5bmFtaWMsIG9mZnNldCwgdHN9XG5cbiAgICBJbiBhZGRpdGlvbiwgdGhlIHZhcmlhYmxlIG9iamVjdCBtYXkgc3dpdGNoIGJhY2sgYW5kIFxuICAgIGZvcnRoIGJldHdlZW4gZHluYW1pYyBhbmQgc3RhdGljIGJlaGF2aW9yLiBUaGUgVGltZW91dCBNb25pdG9yXG4gICAgdHVybnMgcG9sbGluZyBvZmYgd2hlbiB0aGUgdmFyaWFibGUgaXMgbm8gbG9uZ2VyIGR5bmFtaWMsIFxuICAgIGFuZCByZXN1bWVzIHBvbGxpbmcgd2hlbiB0aGUgb2JqZWN0IGJlY29tZXMgZHluYW1pYy5cblxuICAgIFN0YXRlIGNoYW5nZXMgYXJlIGV4cGVjdGVkIHRvIGJlIHNpZ25hbGxlZCB0aHJvdWdoIGEgPGNoYW5nZT4gZXZlbnQuXG5cbiAgICAgICAgc3ViID0gdi5vbihcImNoYW5nZVwiLCBjYWxsYmFjaylcbiAgICAgICAgdi5vZmYoc3ViKVxuXG4gICAgQ2FsbGJhY2tzIGFyZSBpbnZva2VkIG9uIGV2ZXJ5IDxjaGFuZ2U+IGV2ZW50LCBhcyB3ZWxsXG4gICAgYXMgcGVyaW9kaWNhbGx5IHdoZW4gdGhlIG9iamVjdCBpcyBpbiA8ZHluYW1pYz4gc3RhdGUuXG5cbiAgICAgICAgY2FsbGJhY2soe3ZhbHVlLCBkeW5hbWljLCBvZmZzZXQsIHRzfSlcblxuICAgIEZ1cnRoZXJtb3JlLCBpbiBvcmRlciB0byBzdXBwb3J0IGNvbnNpc3RlbnQgcmVuZGVyaW5nIG9mXG4gICAgc3RhdGUgY2hhbmdlcyBmcm9tIG1hbnkgZHluYW1pYyB2YXJpYWJsZXMsIGl0IGlzIGltcG9ydGFudCB0aGF0XG4gICAgY2FsbGJhY2tzIGFyZSBpbnZva2VkIGF0IHRoZSBzYW1lIHRpbWUgYXMgbXVjaCBhcyBwb3NzaWJsZSwgc29cbiAgICB0aGF0IGNoYW5nZXMgdGhhdCBvY2N1ciBuZWFyIGluIHRpbWUgY2FuIGJlIHBhcnQgb2YgdGhlIHNhbWVcbiAgICBzY3JlZW4gcmVmcmVzaC4gXG5cbiAgICBGb3IgdGhpcyByZWFzb24sIHRoZSBUaW1lb3V0TW9uaXRvciBncm91cHMgY2FsbGJhY2tzIGluIHRpbWVcbiAgICBhbmQgaW52b2tlcyBjYWxsYmFja3MgYXQgYXQgZml4ZWQgbWF4aW11bSByYXRlICgyMEh6LzUwbXMpLlxuICAgIFRoaXMgaW1wbGllcyB0aGF0IHBvbGxpbmcgY2FsbGJhY2tzIHdpbGwgZmFsbCBvbiBhIHNoYXJlZCBcbiAgICBwb2xsaW5nIGZyZXF1ZW5jeS5cblxuICAgIEF0IHRoZSBzYW1lIHRpbWUsIGNhbGxiYWNrcyBtYXkgaGF2ZSBpbmRpdmlkdWFsIGZyZXF1ZW5jaWVzIHRoYXRcbiAgICBhcmUgbXVjaCBsb3dlciByYXRlIHRoYW4gdGhlIG1heGltdW0gcmF0ZS4gVGhlIGltcGxlbWVudGF0aW9uXG4gICAgZG9lcyBub3QgcmVseSBvbiBhIGZpeGVkIDUwbXMgdGltZW91dCBmcmVxdWVuY3ksIGJ1dCBpcyB0aW1lb3V0IGJhc2VkLFxuICAgIHRodXMgdGhlcmUgaXMgbm8gcHJvY2Vzc2luZyBvciB0aW1lb3V0IGJldHdlZW4gY2FsbGJhY2tzLCBldmVuXG4gICAgaWYgYWxsIGNhbGxiYWNrcyBoYXZlIGxvdyByYXRlcy5cblxuICAgIEl0IGlzIHNhZmUgdG8gZGVmaW5lIG11bHRpcGxlIGNhbGxhYmFja3MgZm9yIGEgc2luZ2xlIHZhcmlhYmxlLCBlYWNoXG4gICAgY2FsbGJhY2sgd2l0aCBhIGRpZmZlcmVudCBwb2xsaW5nIGZyZXF1ZW5jeS5cblxuICAgIG9wdGlvbnNcbiAgICAgICAgPHJhdGU+IC0gZGVmYXVsdCA1MDogc3BlY2lmeSBtaW5pbXVtIGZyZXF1ZW5jeSBpbiBtc1xuXG4qL1xuXG5cbmNvbnN0IFJBVEVfTVMgPSA1MFxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBUSU1FT1VUIE1PTklUT1JcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBCYXNlIGNsYXNzIGZvciBUaW1lb3V0IE1vbml0b3IgYW5kIEZyYW1lcmF0ZSBNb25pdG9yXG4qL1xuXG5jbGFzcyBUaW1lb3V0TW9uaXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG5cbiAgICAgICAgdGhpcy5fb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe3JhdGU6IFJBVEVfTVN9LCBvcHRpb25zKTtcbiAgICAgICAgaWYgKHRoaXMuX29wdGlvbnMucmF0ZSA8IFJBVEVfTVMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgaWxsZWdhbCByYXRlICR7cmF0ZX0sIG1pbmltdW0gcmF0ZSBpcyAke1JBVEVfTVN9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLypcbiAgICAgICAgICAgIG1hcFxuICAgICAgICAgICAgaGFuZGxlIC0+IHtjYWxsYmFjaywgdmFyaWFibGUsIGRlbGF5fVxuICAgICAgICAgICAgLSB2YXJpYWJsZTogdGFyZ2V0IGZvciBzYW1wbGluZ1xuICAgICAgICAgICAgLSBjYWxsYmFjazogZnVuY3Rpb24odmFsdWUpXG4gICAgICAgICAgICAtIGRlbGF5OiBiZXR3ZWVuIHNhbXBsZXMgKHdoZW4gdmFyaWFibGUgaXMgZHluYW1pYylcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2V0ID0gbmV3IFNldCgpO1xuICAgICAgICAvKlxuICAgICAgICAgICAgdmFyaWFibGUgbWFwXG4gICAgICAgICAgICB2YXJpYWJsZSAtPiB7c3ViLCBwb2xsaW5nLCBoYW5kbGVzOltdfVxuICAgICAgICAgICAgLSBzdWIgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgICAgICAgICAtIHBvbGxpbmc6IHRydWUgaWYgdmFyaWFibGUgbmVlZHMgcG9sbGluZ1xuICAgICAgICAgICAgLSBoYW5kbGVzOiBsaXN0IG9mIGhhbmRsZXMgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgICAgICovXG4gICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgLy8gdmFyaWFibGUgY2hhbmdlIGhhbmRsZXJcbiAgICAgICAgdGhpcy5fX29udmFyaWFibGVjaGFuZ2UgPSB0aGlzLl9vbnZhcmlhYmxlY2hhbmdlLmJpbmQodGhpcyk7XG4gICAgfVxuXG4gICAgYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIC8vIHJlZ2lzdGVyIGJpbmRpbmdcbiAgICAgICAgbGV0IGhhbmRsZSA9IHtjYWxsYmFjaywgdmFyaWFibGUsIGRlbGF5fTtcbiAgICAgICAgdGhpcy5fc2V0LmFkZChoYW5kbGUpO1xuICAgICAgICAvLyByZWdpc3RlciB2YXJpYWJsZVxuICAgICAgICBpZiAoIXRoaXMuX3ZhcmlhYmxlX21hcC5oYXModmFyaWFibGUpKSB7XG4gICAgICAgICAgICBsZXQgc3ViID0gdmFyaWFibGUub24oXCJjaGFuZ2VcIiwgdGhpcy5fX29udmFyaWFibGVjaGFuZ2UpO1xuICAgICAgICAgICAgbGV0IGl0ZW0gPSB7c3ViLCBwb2xsaW5nOmZhbHNlLCBoYW5kbGVzOiBbaGFuZGxlXX07XG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuc2V0KHZhcmlhYmxlLCBpdGVtKTtcbiAgICAgICAgICAgIC8vdGhpcy5fcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpLmhhbmRsZXMucHVzaChoYW5kbGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBoYW5kbGU7XG4gICAgfVxuXG4gICAgcmVsZWFzZShoYW5kbGUpIHtcbiAgICAgICAgLy8gY2xlYW51cFxuICAgICAgICBsZXQgcmVtb3ZlZCA9IHRoaXMuX3NldC5kZWxldGUoaGFuZGxlKTtcbiAgICAgICAgaWYgKCFyZW1vdmVkKSByZXR1cm47XG4gICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNsZWFudXAgdmFyaWFibGUgbWFwXG4gICAgICAgIGxldCB2YXJpYWJsZSA9IGhhbmRsZS52YXJpYWJsZTtcbiAgICAgICAgbGV0IHtzdWIsIGhhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCBpZHggPSBoYW5kbGVzLmluZGV4T2YoaGFuZGxlKTtcbiAgICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgICAgICBoYW5kbGVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChoYW5kbGVzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAvLyB2YXJpYWJsZSBoYXMgbm8gaGFuZGxlc1xuICAgICAgICAgICAgLy8gY2xlYW51cCB2YXJpYWJsZSBtYXBcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5kZWxldGUodmFyaWFibGUpO1xuICAgICAgICAgICAgdmFyaWFibGUub2ZmKHN1Yik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICB2YXJpYWJsZSBlbWl0cyBhIGNoYW5nZSBldmVudFxuICAgICovXG4gICAgX29udmFyaWFibGVjaGFuZ2UgKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIGxldCB2YXJpYWJsZSA9IGVJbmZvLnNyYztcbiAgICAgICAgLy8gZGlyZWN0IGNhbGxiYWNrIC0gY291bGQgdXNlIGVBcmcgaGVyZVxuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCBzdGF0ZSA9IGVBcmc7XG4gICAgICAgIC8vIHJlZXZhbHVhdGUgcG9sbGluZ1xuICAgICAgICB0aGlzLl9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUsIHN0YXRlKTtcbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICBoYW5kbGUuY2FsbGJhY2soc3RhdGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgc3RhcnQgb3Igc3RvcCBwb2xsaW5nIGlmIG5lZWRlZFxuICAgICovXG4gICAgX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSwgc3RhdGUpIHtcbiAgICAgICAgbGV0IGl0ZW0gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IHtwb2xsaW5nOndhc19wb2xsaW5nfSA9IGl0ZW07XG4gICAgICAgIHN0YXRlID0gc3RhdGUgfHwgdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgbGV0IHNob3VsZF9iZV9wb2xsaW5nID0gc3RhdGUuZHluYW1pYztcbiAgICAgICAgaWYgKCF3YXNfcG9sbGluZyAmJiBzaG91bGRfYmVfcG9sbGluZykge1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0cyh2YXJpYWJsZSk7XG4gICAgICAgIH0gZWxzZSBpZiAod2FzX3BvbGxpbmcgJiYgIXNob3VsZF9iZV9wb2xsaW5nKSB7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHNldCB0aW1lb3V0IGZvciBhbGwgY2FsbGJhY2tzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICovXG4gICAgX3NldF90aW1lb3V0cyh2YXJpYWJsZSkge1xuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3NldF90aW1lb3V0KGhhbmRsZSkge1xuICAgICAgICBsZXQgZGVsdGEgPSB0aGlzLl9jYWxjdWxhdGVfZGVsdGEoaGFuZGxlLmRlbGF5KTtcbiAgICAgICAgbGV0IGhhbmRsZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLl9oYW5kbGVfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgIGhhbmRsZS50aWQgPSBzZXRUaW1lb3V0KGhhbmRsZXIsIGRlbHRhKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBhZGp1c3QgZGVsYXkgc28gdGhhdCBpZiBmYWxscyBvblxuICAgICAgICB0aGUgbWFpbiB0aWNrIHJhdGVcbiAgICAqL1xuICAgIF9jYWxjdWxhdGVfZGVsdGEoZGVsYXkpIHtcbiAgICAgICAgbGV0IHJhdGUgPSB0aGlzLl9vcHRpb25zLnJhdGU7XG4gICAgICAgIGxldCBub3cgPSBNYXRoLnJvdW5kKHBlcmZvcm1hbmNlLm5vdygpKTtcbiAgICAgICAgbGV0IFtub3dfbiwgbm93X3JdID0gZGl2bW9kKG5vdywgcmF0ZSk7XG4gICAgICAgIGxldCBbbiwgcl0gPSBkaXZtb2Qobm93ICsgZGVsYXksIHJhdGUpO1xuICAgICAgICBsZXQgdGFyZ2V0ID0gTWF0aC5tYXgobiwgbm93X24gKyAxKSpyYXRlO1xuICAgICAgICByZXR1cm4gdGFyZ2V0IC0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgY2xlYXIgYWxsIHRpbWVvdXRzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICovXG4gICAgX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKSB7XG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIGlmIChoYW5kbGUudGlkICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dChoYW5kbGUudGlkKTtcbiAgICAgICAgICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgaGFuZGxlIHRpbWVvdXRcbiAgICAqL1xuICAgIF9oYW5kbGVfdGltZW91dChoYW5kbGUpIHtcbiAgICAgICAgLy8gZHJvcCBpZiBoYW5kbGUgdGlkIGhhcyBiZWVuIGNsZWFyZWRcbiAgICAgICAgaWYgKGhhbmRsZS50aWQgPT0gdW5kZWZpbmVkKSByZXR1cm47XG4gICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhbGxiYWNrXG4gICAgICAgIGxldCB7dmFyaWFibGV9ID0gaGFuZGxlO1xuICAgICAgICBsZXQgc3RhdGUgPSB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICAvLyByZXNjaGVkdWxlIHRpbWVvdXRzIGZvciBjYWxsYmFja3NcbiAgICAgICAgaWYgKHN0YXRlLmR5bmFtaWMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvKlxuICAgICAgICAgICAgICAgIG1ha2Ugc3VyZSBwb2xsaW5nIHN0YXRlIGlzIGFsc28gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGlzIHdvdWxkIG9ubHkgb2NjdXIgaWYgdGhlIHZhcmlhYmxlXG4gICAgICAgICAgICAgICAgd2VudCBmcm9tIHJlcG9ydGluZyBkeW5hbWljIHRydWUgdG8gZHluYW1pYyBmYWxzZSxcbiAgICAgICAgICAgICAgICB3aXRob3V0IGVtbWl0dGluZyBhIGNoYW5nZSBldmVudCAtIHRodXNcbiAgICAgICAgICAgICAgICB2aW9sYXRpbmcgdGhlIGFzc3VtcHRpb24uIFRoaXMgcHJlc2VydmVzXG4gICAgICAgICAgICAgICAgaW50ZXJuYWwgaW50ZWdyaXR5IGkgdGhlIG1vbml0b3IuXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgbGV0IGl0ZW0gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIC8vXG4gICAgICAgIGhhbmRsZS5jYWxsYmFjayhzdGF0ZSk7XG4gICAgfVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEZSQU1FUkFURSBNT05JVE9SXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblxuY2xhc3MgRnJhbWVyYXRlTW9uaXRvciBleHRlbmRzIFRpbWVvdXRNb25pdG9yIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICAgIHRoaXMuX2hhbmRsZTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICB0aW1lb3V0cyBhcmUgb2Jzb2xldGVcbiAgICAqL1xuICAgIF9zZXRfdGltZW91dHModmFyaWFibGUpIHt9XG4gICAgX3NldF90aW1lb3V0KGhhbmRsZSkge31cbiAgICBfY2FsY3VsYXRlX2RlbHRhKGRlbGF5KSB7fVxuICAgIF9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSkge31cbiAgICBfaGFuZGxlX3RpbWVvdXQoaGFuZGxlKSB7fVxuXG4gICAgX29udmFyaWFibGVjaGFuZ2UgKGVBcmcsIGVJbmZvKSB7XG4gICAgICAgIHN1cGVyLl9vbnZhcmlhYmxlY2hhbmdlKGVBcmcsIGVJbmZvKTtcbiAgICAgICAgLy8ga2ljayBvZmYgY2FsbGJhY2sgbG9vcCBkcml2ZW4gYnkgcmVxdWVzdCBhbmltYXRpb25mcmFtZVxuICAgICAgICB0aGlzLl9jYWxsYmFjaygpO1xuICAgIH1cblxuICAgIF9jYWxsYmFjaygpIHtcbiAgICAgICAgLy8gY2FsbGJhY2sgdG8gYWxsIHZhcmlhYmxlcyB3aGljaCByZXF1aXJlIHBvbGxpbmdcbiAgICAgICAgbGV0IHZhcmlhYmxlcyA9IFsuLi50aGlzLl92YXJpYWJsZV9tYXAuZW50cmllcygpXVxuICAgICAgICAgICAgLmZpbHRlcigoW3ZhcmlhYmxlLCBpdGVtXSkgPT4gaXRlbS5wb2xsaW5nKVxuICAgICAgICAgICAgLm1hcCgoW3ZhcmlhYmxlLCBpdGVtXSkgPT4gdmFyaWFibGUpO1xuICAgICAgICBpZiAodmFyaWFibGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIC8vIGNhbGxiYWNrXG4gICAgICAgICAgICBmb3IgKGxldCB2YXJpYWJsZSBvZiB2YXJpYWJsZXMpIHtcbiAgICAgICAgICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgICAgICAgICAgbGV0IHJlcyA9IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHJlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogXG4gICAgICAgICAgICAgICAgcmVxdWVzdCBuZXh0IGNhbGxiYWNrIGFzIGxvbmcgYXMgYXQgbGVhc3Qgb25lIHZhcmlhYmxlIFxuICAgICAgICAgICAgICAgIGlzIHJlcXVpcmluZyBwb2xsaW5nXG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMuX2NhbGxiYWNrLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBCSU5EIFJFTEVBU0VcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuY29uc3QgbW9uaXRvciA9IG5ldyBUaW1lb3V0TW9uaXRvcigpO1xuY29uc3QgZnJhbWVyYXRlX21vbml0b3IgPSBuZXcgRnJhbWVyYXRlTW9uaXRvcigpO1xuXG5leHBvcnQgZnVuY3Rpb24gYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgbGV0IGhhbmRsZTtcbiAgICBpZiAoQm9vbGVhbihwYXJzZUZsb2F0KGRlbGF5KSkpIHtcbiAgICAgICAgaGFuZGxlID0gbW9uaXRvci5iaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gW1widGltZW91dFwiLCBoYW5kbGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGhhbmRsZSA9IGZyYW1lcmF0ZV9tb25pdG9yLmJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCAwLCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIFtcImZyYW1lcmF0ZVwiLCBoYW5kbGVdO1xuICAgIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiByZWxlYXNlKGhhbmRsZSkge1xuICAgIGxldCBbdHlwZSwgX2hhbmRsZV0gPSBoYW5kbGU7XG4gICAgaWYgKHR5cGUgPT0gXCJ0aW1lb3V0XCIpIHtcbiAgICAgICAgcmV0dXJuIG1vbml0b3IucmVsZWFzZShfaGFuZGxlKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJmcmFtZXJhdGVcIikge1xuICAgICAgICByZXR1cm4gZnJhbWVyYXRlX21vbml0b3IucmVsZWFzZShfaGFuZGxlKTtcbiAgICB9XG59XG5cbiIsImltcG9ydCB7IGV2ZW50aWZ5IH0gZnJvbSBcIi4vZXZlbnRpZnkuanNcIjtcbmltcG9ydCB7IGNhbGxiYWNrIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgYmluZCwgcmVsZWFzZSB9IGZyb20gXCIuL21vbml0b3IuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU1RBVEUgUFJPVklERVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBCYXNlIGNsYXNzIGZvciBhbGwgc3RhdGUgcHJvdmlkZXJzXG5cbiAgICAtIG9iamVjdCB3aXRoIGNvbGxlY3Rpb24gb2YgaXRlbXNcbiAgICAtIGNvdWxkIGJlIGxvY2FsIC0gb3IgcHJveHkgdG8gb25saW5lIHNvdXJjZVxuXG4gICAgcmVwcmVzZW50cyBhIGR5bmFtaWMgY29sbGVjdGlvbiBvZiBpdGVtc1xuICAgIHtpdHYsIHR5cGUsIC4uLmRhdGF9XG4qL1xuXG5leHBvcnQgY2xhc3MgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogdXBkYXRlIGZ1bmN0aW9uXG4gICAgICogY2FsbGVkIGZyb20gY3Vyc29yIG9yIGxheWVyIG9iamVjdHNcbiAgICAgKiBmb3Igb25saW5lIGltcGxlbWVudGF0aW9uLCB0aGlzIHdpbGxcbiAgICAgKiB0eXBpY2FsbHkgcmVzdWx0IGluIGEgbmV0d29yayByZXF1ZXN0IFxuICAgICAqIHRvIHVwZGF0ZSBzb21lIG9ubGluZSBpdGVtIGNvbGxlY3Rpb25cbiAgICAgKi9cbiAgICB1cGRhdGUoaXRlbXMpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIGFycmF5IHdpdGggYWxsIGl0ZW1zIGluIGNvbGxlY3Rpb24gXG4gICAgICogLSBubyByZXF1aXJlbWVudCB3cnQgb3JkZXJcbiAgICAgKi9cblxuICAgIGdldCBpdGVtcygpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNpZ25hbCBpZiBpdGVtcyBjYW4gYmUgb3ZlcmxhcHBpbmcgb3Igbm90XG4gICAgICovXG5cbiAgICBnZXQgaW5mbyAoKSB7XG4gICAgICAgIHJldHVybiB7b3ZlcmxhcHBpbmc6IHRydWV9O1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKFN0YXRlUHJvdmlkZXJCYXNlLnByb3RvdHlwZSk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTEFZRVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIExheWVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgLy8gZGVmaW5lIGNoYW5nZSBldmVudFxuICAgICAgICBldmVudGlmeS5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFFVRVJZXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBxdWVyeSAob2Zmc2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShMYXllckJhc2UucHJvdG90eXBlKTtcbmV2ZW50aWZ5LmFkZFRvUHJvdG90eXBlKExheWVyQmFzZS5wcm90b3R5cGUpO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUiBCQVNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgQ3Vyc29yQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIC8vIGRlZmluZSBjaGFuZ2UgZXZlbnRcbiAgICAgICAgZXZlbnRpZnkuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5ldmVudGlmeURlZmluZShcImNoYW5nZVwiLCB7aW5pdDp0cnVlfSk7XG4gICAgfVxuICAgIFxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUllcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIHF1ZXJ5ICgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIHN0YXRlKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG5cbiAgICAvKlxuICAgICAgICBFdmVudGlmeTogaW1tZWRpYXRlIGV2ZW50c1xuICAgICovXG4gICAgZXZlbnRpZnlJbml0RXZlbnRBcmdzKG5hbWUpIHtcbiAgICAgICAgaWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuICAgICAgICAgICAgcmV0dXJuIFt0aGlzLnF1ZXJ5KCldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBCSU5EIFJFTEVBU0UgKGNvbnZlbmllbmNlKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgYmluZChjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICAgICAgcmV0dXJuIGJpbmQodGhpcywgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zKTtcbiAgICB9XG4gICAgcmVsZWFzZShoYW5kbGUpIHtcbiAgICAgICAgcmV0dXJuIHJlbGVhc2UoaGFuZGxlKTtcbiAgICB9XG5cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKEN1cnNvckJhc2UucHJvdG90eXBlKTtcbmV2ZW50aWZ5LmFkZFRvUHJvdG90eXBlKEN1cnNvckJhc2UucHJvdG90eXBlKTtcblxuIiwiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gICAgKiBcbiAgICAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAgICAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICAgICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gICAgKiBcbiAgICAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICAgICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAgICAqIFxuICAgICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG5cbiovXG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuXG5cbiAgICBOT1RFIFxuICAgIC0gY21wKDRdLFs0ICkgPT0gMCAtIHNpbmNlIHRoZXNlIGFyZSB0aGUgc2FtZSB3aXRoIHJlc3BlY3QgdG8gc29ydGluZ1xuICAgIC0gYnV0IGlmIHlvdSB3YW50IHRvIHNlZSBpZiB0d28gaW50ZXJ2YWxzIGFyZSBvdmVybGFwcGluZyBpbiB0aGUgZW5kcG9pbnRzXG4gICAgY21wKGhpZ2hfYSwgbG93X2IpID4gMCB0aGlzIHdpbGwgbm90IGJlIGdvb2RcbiAgICBcbiovIFxuXG5cbmZ1bmN0aW9uIGNtcE51bWJlcnMoYSwgYikge1xuICAgIGlmIChhID09PSBiKSByZXR1cm4gMDtcbiAgICBpZiAoYSA9PT0gSW5maW5pdHkpIHJldHVybiAxO1xuICAgIGlmIChiID09PSBJbmZpbml0eSkgcmV0dXJuIC0xO1xuICAgIGlmIChhID09PSAtSW5maW5pdHkpIHJldHVybiAtMTtcbiAgICBpZiAoYiA9PT0gLUluZmluaXR5KSByZXR1cm4gMTtcbiAgICByZXR1cm4gYSAtIGI7XG4gIH1cblxuZnVuY3Rpb24gZW5kcG9pbnRfY21wIChwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICBsZXQgZGlmZiA9IGNtcE51bWJlcnModjEsIHYyKTtcbiAgICByZXR1cm4gKGRpZmYgIT0gMCkgPyBkaWZmIDogczEgLSBzMjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludCB0byB0aGUgb3RoZXIgc2lkZVxuICogXG4gKiB1c2VmdWwgZm9yIG1ha2luZyBiYWNrLXRvLWJhY2sgaW50ZXJ2YWxzIFxuICogXG4gKiBoaWdoKSA8LT4gW2xvd1xuICogaGlnaF0gPC0+IChsb3dcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKHAsIHRhcmdldCkge1xuICAgIGxldCBbdixzXSA9IHA7XG4gICAgaWYgKHRhcmdldCA9PSBcImxvd1wiKSB7XG4gICAgXHQvLyBhc3N1bWUgcG9pbnQgaXMgaGlnaDogc2lnbiBtdXN0IGJlIC0xIG9yIDBcbiAgICBcdGlmIChzID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBsb3dcIik7ICAgIFx0XHRcbiAgICBcdH1cbiAgICAgICAgcCA9IFt2LCBzKzFdO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09IFwiaGlnaFwiKSB7XG5cdFx0Ly8gYXNzdW1lIHBvaW50IGlzIGxvdzogc2lnbiBpcyAwIG9yIDFcbiAgICBcdGlmIChzIDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBoaWdoXCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcy0xXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0eXBlXCIsIHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBsZXQgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBsZXQgbG93X3AgPSAobG93Q2xvc2VkKSA/IFtsb3csIDBdIDogW2xvdywgMV07IFxuICAgIGxldCBoaWdoX3AgPSAoaGlnaENsb3NlZCkgPyBbaGlnaCwgMF0gOiBbaGlnaCwgLTFdO1xuICAgIHJldHVybiBbbG93X3AsIGhpZ2hfcF07XG59XG5cblxuLypcbiAgICBJTlRFUlZBTFNcblxuICAgIEludGVydmFscyBhcmUgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXVxuXG4qLyBcblxuLypcbiAgICByZXR1cm4gdHJ1ZSBpZiBwb2ludCBwIGlzIGNvdmVyZWQgYnkgaW50ZXJ2YWwgaXR2XG4gICAgcG9pbnQgcCBjYW4gYmUgbnVtYmVyIHAgb3IgYSBwb2ludCBbcCxzXVxuXG4gICAgaW1wbGVtZW50ZWQgYnkgY29tcGFyaW5nIHBvaW50c1xuICAgIGV4Y2VwdGlvbiBpZiBpbnRlcnZhbCBpcyBub3QgZGVmaW5lZFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIHApIHtcbiAgICBsZXQgW2xvd19wLCBoaWdoX3BdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAvLyBjb3ZlcnM6IGxvdyA8PSBwIDw9IGhpZ2hcbiAgICByZXR1cm4gZW5kcG9pbnRfbGUobG93X3AsIHApICYmIGVuZHBvaW50X2xlKHAsIGhpZ2hfcCk7XG59XG4vLyBjb252ZW5pZW5jZVxuZnVuY3Rpb24gaW50ZXJ2YWxfY292ZXJzX3BvaW50KGl0diwgcCkge1xuICAgIHJldHVybiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBbcCwgMF0pO1xufVxuXG5cblxuLypcbiAgICBSZXR1cm4gdHJ1ZSBpZiBpbnRlcnZhbCBoYXMgbGVuZ3RoIDBcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9pc19zaW5ndWxhcihpbnRlcnZhbCkge1xuICAgIHJldHVybiBpbnRlcnZhbFswXSA9PSBpbnRlcnZhbFsxXVxufVxuXG4vKlxuICAgIENyZWF0ZSBpbnRlcnZhbCBmcm9tIGVuZHBvaW50c1xuKi9cbmZ1bmN0aW9uIGludGVydmFsX2Zyb21fZW5kcG9pbnRzKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIC8vIHAxIG11c3QgYmUgYSBsb3cgcG9pbnRcbiAgICBpZiAoczEgPT0gLTEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBsb3cgcG9pbnRcIiwgcDEpO1xuICAgIH1cbiAgICBpZiAoczIgPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2VhbCBoaWdoIHBvaW50XCIsIHAyKTsgICBcbiAgICB9XG4gICAgcmV0dXJuIFt2MSwgdjIsIChzMT09MCksIChzMj09MCldXG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKG4pIHtcbiAgICByZXR1cm4gdHlwZW9mIG4gPT0gXCJudW1iZXJcIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGludGVydmFsX2Zyb21faW5wdXQoaW5wdXQpe1xuICAgIGxldCBpdHYgPSBpbnB1dDtcbiAgICBpZiAoaXR2ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnB1dCBpcyB1bmRlZmluZWRcIik7XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShpdHYpKSB7XG4gICAgICAgIGlmIChpc051bWJlcihpdHYpKSB7XG4gICAgICAgICAgICAvLyBpbnB1dCBpcyBzaW5ndWxhciBudW1iZXJcbiAgICAgICAgICAgIGl0diA9IFtpdHYsIGl0diwgdHJ1ZSwgdHJ1ZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlucHV0OiAke2lucHV0fTogbXVzdCBiZSBBcnJheSBvciBOdW1iZXJgKVxuICAgICAgICB9XG4gICAgfTtcbiAgICAvLyBtYWtlIHN1cmUgaW50ZXJ2YWwgaXMgbGVuZ3RoIDRcbiAgICBpZiAoaXR2Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGl0diA9IFtpdHZbMF0sIGl0dlswXSwgdHJ1ZSwgdHJ1ZV1cbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMikge1xuICAgICAgICBpdHYgPSBpdHYuY29uY2F0KFt0cnVlLCBmYWxzZV0pO1xuICAgIH0gZWxzZSBpZiAoaXR2Lmxlbmd0aCA9PSAzKSB7XG4gICAgICAgIGl0diA9IGl0di5wdXNoKGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPiA0KSB7XG4gICAgICAgIGl0diA9IGl0di5zbGljZSgwLDQpO1xuICAgIH1cbiAgICBsZXQgW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdID0gaXR2O1xuICAgIC8vIHVuZGVmaW5lZFxuICAgIGlmIChsb3cgPT0gdW5kZWZpbmVkIHx8IGxvdyA9PSBudWxsKSB7XG4gICAgICAgIGxvdyA9IC1JbmZpbml0eTtcbiAgICB9XG4gICAgaWYgKGhpZ2ggPT0gdW5kZWZpbmVkIHx8IGhpZ2ggPT0gbnVsbCkge1xuICAgICAgICBoaWdoID0gSW5maW5pdHk7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93IGFuZCBoaWdoIGFyZSBudW1iZXJzXG4gICAgaWYgKCFpc051bWJlcihsb3cpKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgbm90IGEgbnVtYmVyXCIsIGxvdyk7XG4gICAgaWYgKCFpc051bWJlcihoaWdoKSkgdGhyb3cgbmV3IEVycm9yKFwiaGlnaCBub3QgYSBudW1iZXJcIiwgaGlnaCk7XG4gICAgLy8gY2hlY2sgdGhhdCBsb3cgPD0gaGlnaFxuICAgIGlmIChsb3cgPiBoaWdoKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgPiBoaWdoXCIsIGxvdywgaGlnaCk7XG4gICAgLy8gc2luZ2xldG9uXG4gICAgaWYgKGxvdyA9PSBoaWdoKSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIGluZmluaXR5IHZhbHVlc1xuICAgIGlmIChsb3cgPT0gLUluZmluaXR5KSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoaGlnaCA9PSBJbmZpbml0eSkge1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGUgYXJlIGJvb2xlYW5zXG4gICAgaWYgKHR5cGVvZiBsb3dJbmNsdWRlICE9PSBcImJvb2xlYW5cIikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJsb3dJbmNsdWRlIG5vdCBib29sZWFuXCIpO1xuICAgIH0gXG4gICAgaWYgKHR5cGVvZiBoaWdoSW5jbHVkZSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaGlnaEluY2x1ZGUgbm90IGJvb2xlYW5cIik7XG4gICAgfVxuICAgIHJldHVybiBbbG93LCBoaWdoLCBsb3dJbmNsdWRlLCBoaWdoSW5jbHVkZV07XG59XG5cblxuXG5cbmV4cG9ydCBjb25zdCBlbmRwb2ludCA9IHtcbiAgICBsZTogZW5kcG9pbnRfbGUsXG4gICAgbHQ6IGVuZHBvaW50X2x0LFxuICAgIGdlOiBlbmRwb2ludF9nZSxcbiAgICBndDogZW5kcG9pbnRfZ3QsXG4gICAgY21wOiBlbmRwb2ludF9jbXAsXG4gICAgZXE6IGVuZHBvaW50X2VxLFxuICAgIG1pbjogZW5kcG9pbnRfbWluLFxuICAgIG1heDogZW5kcG9pbnRfbWF4LFxuICAgIGZsaXA6IGVuZHBvaW50X2ZsaXAsXG4gICAgZnJvbV9pbnRlcnZhbDogZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWxcbn1cbmV4cG9ydCBjb25zdCBpbnRlcnZhbCA9IHtcbiAgICBjb3ZlcnNfZW5kcG9pbnQ6IGludGVydmFsX2NvdmVyc19lbmRwb2ludCxcbiAgICBjb3ZlcnNfcG9pbnQ6IGludGVydmFsX2NvdmVyc19wb2ludCwgXG4gICAgaXNfc2luZ3VsYXI6IGludGVydmFsX2lzX3Npbmd1bGFyLFxuICAgIGZyb21fZW5kcG9pbnRzOiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyxcbiAgICBmcm9tX2lucHV0OiBpbnRlcnZhbF9mcm9tX2lucHV0XG59XG4iLCJpbXBvcnQge1N0YXRlUHJvdmlkZXJCYXNlfSBmcm9tIFwiLi9iYXNlcy5qc1wiO1xuaW1wb3J0IHtlbmRwb2ludH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBTSU1QTEUgU1RBVEUgUFJPVklERVIgKExPQ0FMKVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIExvY2FsIEFycmF5IHdpdGggbm9uLW92ZXJsYXBwaW5nIGl0ZW1zLlxuICovXG5cbmV4cG9ydCBjbGFzcyBTaW1wbGVTdGF0ZVByb3ZpZGVyIGV4dGVuZHMgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvLyBpbml0aWFsaXphdGlvblxuICAgICAgICBsZXQge2l0ZW1zLCB2YWx1ZX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoaXRlbXMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9pdGVtcyA9IGNoZWNrX2lucHV0KGl0ZW1zKTtcbiAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gW3tpdHY6Wy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLCBhcmdzOnt2YWx1ZX19XTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGUgKGl0ZW1zKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gY2hlY2tfaW5wdXQoaXRlbXMpO1xuICAgICAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ2V0IGl0ZW1zICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2l0ZW1zLnNsaWNlKCk7XG4gICAgfVxuXG4gICAgZ2V0IGluZm8gKCkge1xuICAgICAgICByZXR1cm4ge2R5bmFtaWM6IHRydWUsIG92ZXJsYXBwaW5nOiBmYWxzZSwgbG9jYWw6dHJ1ZX07XG4gICAgfVxufVxuXG5cbmZ1bmN0aW9uIGNoZWNrX2lucHV0KGl0ZW1zKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnB1dCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgIH1cbiAgICAvLyBzb3J0IGl0ZW1zIGJhc2VkIG9uIGludGVydmFsIGxvdyBlbmRwb2ludFxuICAgIGl0ZW1zLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgbGV0IGFfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChhLml0dilbMF07XG4gICAgICAgIGxldCBiX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYi5pdHYpWzBdO1xuICAgICAgICByZXR1cm4gZW5kcG9pbnQuY21wKGFfbG93LCBiX2xvdyk7XG4gICAgfSk7XG4gICAgLy8gY2hlY2sgdGhhdCBpdGVtIGludGVydmFscyBhcmUgbm9uLW92ZXJsYXBwaW5nXG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBsZXQgcHJldl9oaWdoID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpIC0gMV0uaXR2KVsxXTtcbiAgICAgICAgbGV0IGN1cnJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpXS5pdHYpWzBdO1xuICAgICAgICAvLyB2ZXJpZnkgdGhhdCBwcmV2IGhpZ2ggaXMgbGVzcyB0aGF0IGN1cnIgbG93XG4gICAgICAgIGlmICghZW5kcG9pbnQubHQocHJldl9oaWdoLCBjdXJyX2xvdykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk92ZXJsYXBwaW5nIGludGVydmFscyBmb3VuZFwiKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cbiIsIlxuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2V9IGZyb20gXCIuL2Jhc2VzXCI7XG5jb25zdCBNRVRIT0RTID0ge2Fzc2lnbiwgbW92ZSwgdHJhbnNpdGlvbiwgaW50ZXJwb2xhdGV9O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBjbWQgKHRhcmdldCkge1xuICAgIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhcmdldC5zcmMgbXVzdCBiZSBzdGF0ZXByb3ZpZGVyICR7dGFyZ2V0fWApO1xuICAgIH1cbiAgICBsZXQgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKE1FVEhPRFMpXG4gICAgICAgIC5tYXAoKFtuYW1lLCBtZXRob2RdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oLi4uYXJncykgeyBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGl0ZW1zID0gbWV0aG9kLmNhbGwodGhpcywgLi4uYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXQudXBkYXRlKGl0ZW1zKTsgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhlbnRyaWVzKTtcbn1cblxuZnVuY3Rpb24gYXNzaWduKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IGl0ZW0gPSB7XG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBhcmdzOiB7dmFsdWV9ICAgICAgICAgICAgICAgICBcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW2l0ZW1dO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gbW92ZSh2ZWN0b3IpIHtcbiAgICBsZXQgaXRlbSA9IHtcbiAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgIHR5cGU6IFwibW90aW9uXCIsXG4gICAgICAgIGFyZ3M6IHZlY3RvciAgXG4gICAgfVxuICAgIHJldHVybiBbaXRlbV07XG59XG5cbmZ1bmN0aW9uIHRyYW5zaXRpb24odjAsIHYxLCB0MCwgdDEsIGVhc2luZykge1xuICAgIGxldCBpdGVtcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTp2MH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDAsIHQxLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcInRyYW5zaXRpb25cIixcbiAgICAgICAgICAgIGFyZ3M6IHt2MCwgdjEsIHQwLCB0MSwgZWFzaW5nfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTogdjF9XG4gICAgICAgIH1cbiAgICBdXG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZSh0dXBsZXMpIHtcbiAgICBsZXQgW3YwLCB0MF0gPSB0dXBsZXNbMF07XG4gICAgbGV0IFt2MSwgdDFdID0gdHVwbGVzW3R1cGxlcy5sZW5ndGgtMV07XG5cbiAgICBsZXQgaXRlbXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgdDAsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBhcmdzOiB7dmFsdWU6djB9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJpbnRlcnBvbGF0aW9uXCIsXG4gICAgICAgICAgICBhcmdzOiB7dHVwbGVzfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTogdjF9XG4gICAgICAgIH1cbiAgICBdICAgIFxuICAgIHJldHVybiBpdGVtcztcbn1cblxuXG5cbiIsImltcG9ydCB7aW50ZXJ2YWx9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuQkFTRSBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuXHRBYnN0cmFjdCBCYXNlIENsYXNzIGZvciBTZWdtZW50c1xuXG4gICAgY29uc3RydWN0b3IoaW50ZXJ2YWwpXG5cbiAgICAtIGludGVydmFsOiBpbnRlcnZhbCBvZiB2YWxpZGl0eSBvZiBzZWdtZW50XG4gICAgLSBkeW5hbWljOiB0cnVlIGlmIHNlZ21lbnQgaXMgZHluYW1pY1xuICAgIC0gdmFsdWUob2Zmc2V0KTogdmFsdWUgb2Ygc2VnbWVudCBhdCBvZmZzZXRcbiAgICAtIHF1ZXJ5KG9mZnNldCk6IHN0YXRlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4qL1xuXG5leHBvcnQgY2xhc3MgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0dikge1xuXHRcdHRoaXMuX2l0diA9IGl0djtcblx0fVxuXG5cdGdldCBpdHYoKSB7cmV0dXJuIHRoaXMuX2l0djt9XG5cbiAgICAvKiogXG4gICAgICogaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3NcbiAgICAgKiByZXR1cm5zIHt2YWx1ZSwgZHluYW1pY307XG4gICAgKi9cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjb252ZW5pZW5jZSBmdW5jdGlvbiByZXR1cm5pbmcgdGhlIHN0YXRlIG9mIHRoZSBzZWdtZW50XG4gICAgICogQHBhcmFtIHsqfSBvZmZzZXQgXG4gICAgICogQHJldHVybnMgXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5faXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuc3RhdGUob2Zmc2V0KSwgb2Zmc2V0fTtcbiAgICAgICAgfSBcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdW5kZWZpbmVkLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExBWUVSUyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBMYXllcnNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX2xheWVycyA9IGFyZ3MubGF5ZXJzO1xuICAgICAgICB0aGlzLl92YWx1ZV9mdW5jID0gYXJncy52YWx1ZV9mdW5jXG5cbiAgICAgICAgLy8gVE9ETyAtIGZpZ3VyZSBvdXQgZHluYW1pYyBoZXJlP1xuICAgIH1cblxuXHRzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgLy8gVE9ETyAtIHVzZSB2YWx1ZSBmdW5jXG4gICAgICAgIC8vIGZvciBub3cgLSBqdXN0IHVzZSBmaXJzdCBsYXllclxuICAgICAgICByZXR1cm4gey4uLnRoaXMuX2xheWVyc1swXS5xdWVyeShvZmZzZXQpLCBvZmZzZXR9O1xuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU1RBVElDIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIFN0YXRpY1NlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG5cdFx0dGhpcy5fdmFsdWUgPSBhcmdzLnZhbHVlO1xuXHR9XG5cblx0c3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3ZhbHVlLCBkeW5hbWljOmZhbHNlfVxuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTU9USU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qXG4gICAgSW1wbGVtZW50cyBkZXRlcm1pbmlzdGljIHByb2plY3Rpb24gYmFzZWQgb24gaW5pdGlhbCBjb25kaXRpb25zIFxuICAgIC0gbW90aW9uIHZlY3RvciBkZXNjcmliZXMgbW90aW9uIHVuZGVyIGNvbnN0YW50IGFjY2VsZXJhdGlvblxuKi9cblxuZXhwb3J0IGNsYXNzIE1vdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG4gICAgXG4gICAgY29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOnAwLCB2ZWxvY2l0eTp2MCwgdGltZXN0YW1wOnQwXG4gICAgICAgIH0gPSBhcmdzO1xuICAgICAgICAvLyBjcmVhdGUgbW90aW9uIHRyYW5zaXRpb25cbiAgICAgICAgY29uc3QgYTAgPSAwO1xuICAgICAgICB0aGlzLl92ZWxvY2l0eSA9IHYwO1xuICAgICAgICB0aGlzLl9wb3NpdGlvbiA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgbGV0IGQgPSB0cyAtIHQwO1xuICAgICAgICAgICAgcmV0dXJuIHAwICsgdjAqZCArIDAuNSphMCpkKmQ7XG4gICAgICAgIH07ICAgXG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB2YWx1ZTogdGhpcy5fcG9zaXRpb24ob2Zmc2V0KSwgXG4gICAgICAgICAgICByYXRlOiB0aGlzLl92ZWxvY2l0eSwgXG4gICAgICAgICAgICBkeW5hbWljOiB0aGlzLl92ZWxvY2l0eSAhPSAwXG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVFJBTlNJVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgU3VwcG9ydGVkIGVhc2luZyBmdW5jdGlvbnNcbiAgICBcImVhc2UtaW5cIjpcbiAgICBcImVhc2Utb3V0XCI6XG4gICAgXCJlYXNlLWluLW91dFwiXG4qL1xuXG5mdW5jdGlvbiBlYXNlaW4gKHRzKSB7XG4gICAgcmV0dXJuIE1hdGgucG93KHRzLDIpOyAgXG59XG5mdW5jdGlvbiBlYXNlb3V0ICh0cykge1xuICAgIHJldHVybiAxIC0gZWFzZWluKDEgLSB0cyk7XG59XG5mdW5jdGlvbiBlYXNlaW5vdXQgKHRzKSB7XG4gICAgaWYgKHRzIDwgLjUpIHtcbiAgICAgICAgcmV0dXJuIGVhc2VpbigyICogdHMpIC8gMjtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gKDIgLSBlYXNlaW4oMiAqICgxIC0gdHMpKSkgLyAyO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRyYW5zaXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuXHRcdHN1cGVyKGl0dik7XG4gICAgICAgIGxldCB7djAsIHYxLCBlYXNpbmd9ID0gYXJncztcbiAgICAgICAgbGV0IFt0MCwgdDFdID0gdGhpcy5faXR2LnNsaWNlKDAsMik7XG5cbiAgICAgICAgLy8gY3JlYXRlIHRoZSB0cmFuc2l0aW9uIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuX2R5bmFtaWMgPSB2MS12MCAhPSAwO1xuICAgICAgICB0aGlzLl90cmFucyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgLy8gY29udmVydCB0cyB0byBbdDAsdDFdLXNwYWNlXG4gICAgICAgICAgICAvLyAtIHNoaWZ0IGZyb20gW3QwLHQxXS1zcGFjZSB0byBbMCwodDEtdDApXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzY2FsZSBmcm9tIFswLCh0MS10MCldLXNwYWNlIHRvIFswLDFdLXNwYWNlXG4gICAgICAgICAgICB0cyA9IHRzIC0gdDA7XG4gICAgICAgICAgICB0cyA9IHRzL3BhcnNlRmxvYXQodDEtdDApO1xuICAgICAgICAgICAgLy8gZWFzaW5nIGZ1bmN0aW9ucyBzdHJldGNoZXMgb3IgY29tcHJlc3NlcyB0aGUgdGltZSBzY2FsZSBcbiAgICAgICAgICAgIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluXCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2Vpbih0cyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVhc2luZyA9PSBcImVhc2Utb3V0XCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2VvdXQodHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW5vdXQodHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbGluZWFyIHRyYW5zaXRpb24gZnJvbSB2MCB0byB2MSwgZm9yIHRpbWUgdmFsdWVzIFswLDFdXG4gICAgICAgICAgICB0cyA9IE1hdGgubWF4KHRzLCAwKTtcbiAgICAgICAgICAgIHRzID0gTWF0aC5taW4odHMsIDEpO1xuICAgICAgICAgICAgcmV0dXJuIHYwICsgKHYxLXYwKSp0cztcbiAgICAgICAgfVxuXHR9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dGhpcy5fZHluYW1pY31cblx0fVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgSU5URVJQT0xBVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogRnVuY3Rpb24gdG8gY3JlYXRlIGFuIGludGVycG9sYXRvciBmb3IgbmVhcmVzdCBuZWlnaGJvciBpbnRlcnBvbGF0aW9uIHdpdGhcbiAqIGV4dHJhcG9sYXRpb24gc3VwcG9ydC5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSB0dXBsZXMgLSBBbiBhcnJheSBvZiBbdmFsdWUsIG9mZnNldF0gcGFpcnMsIHdoZXJlIHZhbHVlIGlzIHRoZVxuICogcG9pbnQncyB2YWx1ZSBhbmQgb2Zmc2V0IGlzIHRoZSBjb3JyZXNwb25kaW5nIG9mZnNldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gLSBBIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYW4gb2Zmc2V0IGFuZCByZXR1cm5zIHRoZVxuICogaW50ZXJwb2xhdGVkIG9yIGV4dHJhcG9sYXRlZCB2YWx1ZS5cbiAqL1xuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZSh0dXBsZXMpIHtcblxuICAgIGlmICh0dXBsZXMubGVuZ3RoIDwgMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdW5kZWZpbmVkO31cbiAgICB9IGVsc2UgaWYgKHR1cGxlcy5sZW5ndGggPT0gMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdHVwbGVzWzBdWzBdO31cbiAgICB9XG5cbiAgICAvLyBTb3J0IHRoZSB0dXBsZXMgYnkgdGhlaXIgb2Zmc2V0c1xuICAgIGNvbnN0IHNvcnRlZFR1cGxlcyA9IFsuLi50dXBsZXNdLnNvcnQoKGEsIGIpID0+IGFbMV0gLSBiWzFdKTtcbiAgXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvcihvZmZzZXQpIHtcbiAgICAgIC8vIEhhbmRsZSBleHRyYXBvbGF0aW9uIGJlZm9yZSB0aGUgZmlyc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPD0gc29ydGVkVHVwbGVzWzBdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzWzBdO1xuICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1sxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBhZnRlciB0aGUgbGFzdCBwb2ludFxuICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAyXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdO1xuICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICB9XG4gIFxuICAgICAgLy8gRmluZCB0aGUgbmVhcmVzdCBwb2ludHMgdG8gdGhlIGxlZnQgYW5kIHJpZ2h0XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvcnRlZFR1cGxlcy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbaV1bMV0gJiYgb2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1tpICsgMV1bMV0pIHtcbiAgICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tpXTtcbiAgICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1tpICsgMV07XG4gICAgICAgICAgLy8gTGluZWFyIGludGVycG9sYXRpb24gZm9ybXVsYTogeSA9IHkxICsgKCAoeCAtIHgxKSAqICh5MiAtIHkxKSAvICh4MiAtIHgxKSApXG4gICAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gIFxuICAgICAgLy8gSW4gY2FzZSB0aGUgb2Zmc2V0IGRvZXMgbm90IGZhbGwgd2l0aGluIGFueSByYW5nZSAoc2hvdWxkIGJlIGNvdmVyZWQgYnkgdGhlIHByZXZpb3VzIGNvbmRpdGlvbnMpXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH07XG59XG4gIFxuXG5leHBvcnQgY2xhc3MgSW50ZXJwb2xhdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cbiAgICBjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcbiAgICAgICAgLy8gc2V0dXAgaW50ZXJwb2xhdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl90cmFucyA9IGludGVycG9sYXRlKGFyZ3MudHVwbGVzKTtcbiAgICB9XG5cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdGhpcy5fdHJhbnMob2Zmc2V0KSwgZHluYW1pYzp0cnVlfTtcbiAgICB9XG59XG5cblxuIiwiaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCAqIGFzIHNlZ21lbnQgZnJvbSBcIi4vc2VnbWVudHMuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE5FQVJCWSBDQUNIRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIFRoaXMgaW1wbGVtZW50cyBhIGNhY2hlIGluIGZyb250IG9mIGEgTmVhcmJ5SW5kZXguXG4gICAgXG4gICAgVGhlIHB1cnBvc2Ugb2YgY2FjaGluZyBpcyB0byBvcHRpbWl6ZSBmb3IgcmVwZWF0ZWRcbiAgICBxdWVyaWVzIHRvIGEgTmVhcmJ5SW5kZXggdG8gbmVhcmJ5IG9mZnNldHMuXG5cbiAgICBUaGUgY2FjaGUgc3RhdGUgaW5jbHVkZXMgdGhlIG5lYXJieSBzdGF0ZSBmcm9tIHRoZSBcbiAgICBpbmRleCwgYW5kIGFsc28gdGhlIGNhY2hlZCBzZWdtZW50cyBjb3JyZXNwb25kaW5nXG4gICAgdG8gdGhhdCBzdGF0ZS4gVGhpcyB3YXksIG9uIGEgY2FjaGUgaGl0LCB0aGUgXG4gICAgcXVlcnkgbWF5IGJlIHNhdGlzZmllZCBkaXJlY3RseSBmcm9tIHRoZSBjYWNoZS5cblxuICAgIFRoZSBjYWNoZSBpcyBtYXJrZWQgYXMgZGlydHkgd2hlbiB0aGUgTmVhcmJ5IGluZGV4ZXMgY2hhbmdlcy5cbiovXG5cbmV4cG9ydCBjbGFzcyBOZWFyYnlDYWNoZSB7XG5cbiAgICBjb25zdHJ1Y3RvciAobmVhcmJ5SW5kZXgpIHtcbiAgICAgICAgLy8gbmVhcmJ5IGluZGV4XG4gICAgICAgIHRoaXMuX2luZGV4ID0gbmVhcmJ5SW5kZXg7XG4gICAgICAgIC8vIGNhY2hlZCBuZWFyYnkgb2JqZWN0XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2FjaGVkIHNlZ21lbnRcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gZGlydHkgZmxhZ1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBBY2Nlc3NvcnMgZm9yIENhY2hlIHN0YXRlXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIFxuICAgIGdldCBuZWFyYnkgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbmVhcmJ5O1xuICAgIH1cblxuICAgIGxvYWRfc2VnbWVudCAoKSB7XG4gICAgICAgIC8vIGxhenkgbG9hZCBzZWdtZW50XG4gICAgICAgIGlmICh0aGlzLl9uZWFyYnkgJiYgIXRoaXMuX3NlZ21lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3NlZ21lbnQgPSBsb2FkX3NlZ21lbnQodGhpcy5fbmVhcmJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fc2VnbWVudFxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBEaXJ0eSBDYWNoZVxuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGRpcnR5KCkge1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIFJlZnJlc2ggQ2FjaGVcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICAvKlxuICAgICAgICByZWZyZXNoIGlmIG5lY2Vzc2FyeSAtIGVsc2UgTk9PUFxuICAgICAgICAtIGlmIG5lYXJieSBpcyBub3QgZGVmaW5lZFxuICAgICAgICAtIGlmIG9mZnNldCBpcyBvdXRzaWRlIG5lYXJieS5pdHZcbiAgICAgICAgLSBpZiBjYWNoZSBpcyBkaXJ0eVxuICAgICovXG4gICAgcmVmcmVzaCAob2Zmc2V0KSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgb2Zmc2V0ID0gW29mZnNldCwgMF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX25lYXJieSA9PSB1bmRlZmluZWQgfHwgdGhpcy5fZGlydHkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWZyZXNoKG9mZnNldCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpbnRlcnZhbC5jb3ZlcnNfZW5kcG9pbnQodGhpcy5fbmVhcmJ5Lml0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlZnJlc2gob2Zmc2V0KVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBfcmVmcmVzaCAob2Zmc2V0KSB7XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHRoaXMuX2luZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICB0aGlzLl9zZWdtZW50ID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgUXVlcnkgQ2FjaGVcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBxdWVyeShvZmZzZXQpIHtcbiAgICAgICAgaWYgKG9mZnNldCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhY2hlIHF1ZXJ5IG9mZnNldCBjYW5ub3QgYmUgdW5kZWZpbmVkXCIpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZWZyZXNoKG9mZnNldCk7XG4gICAgICAgIGlmICghdGhpcy5fc2VnbWVudCkge1xuICAgICAgICAgICAgdGhpcy5fc2VnbWVudCA9IGxvYWRfc2VnbWVudCh0aGlzLl9uZWFyYnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9zZWdtZW50LnF1ZXJ5KG9mZnNldCk7XG4gICAgfVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExPQUQgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5mdW5jdGlvbiBjcmVhdGVfc2VnbWVudChpdHYsIHR5cGUsIGFyZ3MpIHtcbiAgICBpZiAodHlwZSA9PSBcInN0YXRpY1wiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5TdGF0aWNTZWdtZW50KGl0diwgYXJncyk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwidHJhbnNpdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5UcmFuc2l0aW9uU2VnbWVudChpdHYsIGFyZ3MpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcImludGVycG9sYXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuSW50ZXJwb2xhdGlvblNlZ21lbnQoaXR2LCBhcmdzKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJtb3Rpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuTW90aW9uU2VnbWVudChpdHYsIGFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwidW5yZWNvZ25pemVkIHNlZ21lbnQgdHlwZVwiLCB0eXBlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGxvYWRfc2VnbWVudChuZWFyYnkpIHtcbiAgICBsZXQge2l0diwgY2VudGVyfSA9IG5lYXJieTtcbiAgICBpZiAoY2VudGVyLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVfc2VnbWVudChpdHYsIFwic3RhdGljXCIsIHt2YWx1ZTp1bmRlZmluZWR9KTtcbiAgICB9XG4gICAgaWYgKGNlbnRlci5sZW5ndGggPT0gMSkge1xuICAgICAgICBsZXQge3R5cGU9XCJzdGF0aWNcIiwgYXJnc30gPSBjZW50ZXJbMF07XG4gICAgICAgIHJldHVybiBjcmVhdGVfc2VnbWVudChpdHYsIHR5cGUsIGFyZ3MpO1xuICAgIH1cbiAgICBpZiAoY2VudGVyLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTGlzdFNlZ21lbnRzIG5vdCB5ZXQgc3VwcG9ydGVkXCIpO1xuICAgIH1cbn1cbiIsImltcG9ydCB7ZW5kcG9pbnR9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHtyYW5nZX0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHtOZWFyYnlDYWNoZX0gZnJvbSBcIi4vbmVhcmJ5Y2FjaGUuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE5FQVJCWSBJTkRFWFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEFic3RyYWN0IHN1cGVyY2xhc3MgZm9yIE5lYXJieUluZGV4ZS5cbiAqIFxuICogU3VwZXJjbGFzcyB1c2VkIHRvIGNoZWNrIHRoYXQgYSBjbGFzcyBpbXBsZW1lbnRzIHRoZSBuZWFyYnkoKSBtZXRob2QsIFxuICogYW5kIHByb3ZpZGUgc29tZSBjb252ZW5pZW5jZSBtZXRob2RzLlxuICogXG4gKiBORUFSQlkgSU5ERVhcbiAqIFxuICogTmVhcmJ5SW5kZXggcHJvdmlkZXMgaW5kZXhpbmcgc3VwcG9ydCBvZiBlZmZlY3RpdmVseWxvb2tpbmcgdXAgSVRFTVMgYnkgb2Zmc2V0LCBcbiAqIGdpdmVuIHRoYXRcbiAqIChpKSBlYWNoIGVudHJpeSBpcyBhc3NvY2lhdGVkIHdpdGggYW4gaW50ZXJ2YWwgYW5kLFxuICogKGlpKSBlbnRyaWVzIGFyZSBub24tb3ZlcmxhcHBpbmcuXG4gKiBFYWNoIElURU0gbXVzdCBiZSBhc3NvY2lhdGVkIHdpdGggYW4gaW50ZXJ2YWwgb24gdGhlIHRpbWVsaW5lIFxuICogXG4gKiBORUFSQllcbiAqIFRoZSBuZWFyYnkgbWV0aG9kIHJldHVybnMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG5laWdoYm9yaG9vZCBhcm91bmQgZW5kcG9pbnQuIFxuICogXG4gKiBQcmltYXJ5IHVzZSBpcyBmb3IgaXRlcmF0aW9uIFxuICogXG4gKiBSZXR1cm5zIHtcbiAqICAgICAgY2VudGVyOiBsaXN0IG9mIElURU1TIGNvdmVyaW5nIGVuZHBvaW50LFxuICogICAgICBpdHY6IGludGVydmFsIHdoZXJlIG5lYXJieSByZXR1cm5zIGlkZW50aWNhbCB7Y2VudGVyfVxuICogICAgICBsZWZ0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIGxlZnQgXG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBoaWdoLWVuZHBvaW50IG9yIHVuZGVmaW5lZFxuICogICAgICByaWdodDpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSByaWdodFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgbG93LWVuZHBvaW50IG9yIHVuZGVmaW5lZCAgICAgICAgIFxuICogICAgICBwcmV2OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIGxlZnQgXG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50ICYmIG5vbi1lbXB0eSB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgaGlnaC1lbmRwb2ludCBvciB1bmRlZmluZWQgaWYgbm8gbW9yZSBpbnRlcnZhbHMgdG8gdGhlIGxlZnRcbiAqICAgICAgbmV4dDpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSByaWdodFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCAmJiBub24tZW1wdHkge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGxvdy1lbmRwb2ludCBvciB1bmRlZmluZWQgaWYgbm8gbW9yZSBpbnRlcnZhbHMgdG8gdGhlIHJpZ2h0XG4gKiB9XG4gKiBcbiAqIFxuICogVGhlIG5lYXJieSBzdGF0ZSBpcyB3ZWxsLWRlZmluZWQgZm9yIGV2ZXJ5IHRpbWVsaW5lIHBvc2l0aW9uLlxuICogXG4gKiBcbiAqIE5PVEUgbGVmdC9yaWdodCBhbmQgcHJldi9uZXh0IGFyZSBtb3N0bHkgdGhlIHNhbWUuIFRoZSBvbmx5IGRpZmZlcmVuY2UgaXMgXG4gKiB0aGF0IHByZXYvbmV4dCB3aWxsIHNraXAgb3ZlciByZWdpb25zIHdoZXJlIHRoZXJlIGFyZSBubyBpbnRlcnZhbHMuIFRoaXNcbiAqIGVuc3VyZXMgcHJhY3RpY2FsIGl0ZXJhdGlvbiBvZiBpdGVtcyBhcyBwcmV2L25leHQgd2lsbCBvbmx5IGJlIHVuZGVmaW5lZCAgXG4gKiBhdCB0aGUgZW5kIG9mIGl0ZXJhdGlvbi5cbiAqIFxuICogSU5URVJWQUxTXG4gKiBcbiAqIFtsb3csIGhpZ2gsIGxvd0luY2x1c2l2ZSwgaGlnaEluY2x1c2l2ZV1cbiAqIFxuICogVGhpcyByZXByZXNlbnRhdGlvbiBlbnN1cmVzIHRoYXQgdGhlIGludGVydmFsIGVuZHBvaW50cyBhcmUgb3JkZXJlZCBhbmQgYWxsb3dzXG4gKiBpbnRlcnZhbHMgdG8gYmUgZXhjbHVzaXZlIG9yIGluY2x1c2l2ZSwgeWV0IGNvdmVyIHRoZSBlbnRpcmUgcmVhbCBsaW5lIFxuICogXG4gKiBbYSxiXSwgKGEsYiksIFthLGIpLCBbYSwgYikgYXJlIGFsbCB2YWxpZCBpbnRlcnZhbHNcbiAqIFxuICogXG4gKiBJTlRFUlZBTCBFTkRQT0lOVFNcbiAqIFxuICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gKiBcbiAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gKiBcbiAqIC8gKi9cblxuIGV4cG9ydCBjbGFzcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgdXBkYXRlIChpdGVtcykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyogXG4gICAgICAgIE5lYXJieSBtZXRob2RcbiAgICAqL1xuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGxvdyBwb2ludCBvZiBsZWZ0bW9zdCBlbnRyeVxuICAgICovXG4gICAgZmlyc3QoKSB7XG4gICAgICAgIGxldCB7Y2VudGVyLCByaWdodH0gPSB0aGlzLm5lYXJieShbLUluZmluaXR5LCAwXSk7XG4gICAgICAgIHJldHVybiAoY2VudGVyLmxlbmd0aCA+IDApID8gWy1JbmZpbml0eSwgMF0gOiByaWdodDtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICByZXR1cm4gaGlnaCBwb2ludCBvZiByaWdodG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGxhc3QoKSB7XG4gICAgICAgIGxldCB7bGVmdCwgY2VudGVyfSA9IHRoaXMubmVhcmJ5KFtJbmZpbml0eSwgMF0pO1xuICAgICAgICByZXR1cm4gKGNlbnRlci5sZW5ndGggPiAwKSA/IFtJbmZpbml0eSwgMF0gOiBsZWZ0XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgTGlzdCBpdGVtcyBvZiBOZWFyYnlJbmRleCAob3JkZXIgbGVmdCB0byByaWdodClcbiAgICAgICAgaW50ZXJ2YWwgZGVmaW5lcyBbc3RhcnQsIGVuZF0gb2Zmc2V0IG9uIHRoZSB0aW1lbGluZS5cbiAgICAgICAgUmV0dXJucyBsaXN0IG9mIGl0ZW0tbGlzdHMuXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICAgLSBzdGFydFxuICAgICAgICAtIHN0b3BcbiAgICAqL1xuICAgIGxpc3Qob3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge3N0YXJ0PS1JbmZpbml0eSwgc3RvcD1JbmZpbml0eX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3RhcnQgPiBzdG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgKFwic3RvcCBtdXN0IGJlIGxhcmdlciB0aGFuIHN0YXJ0XCIsIHN0YXJ0LCBzdG9wKVxuICAgICAgICB9XG4gICAgICAgIHN0YXJ0ID0gW3N0YXJ0LCAwXTtcbiAgICAgICAgc3RvcCA9IFtzdG9wLCAwXTtcbiAgICAgICAgbGV0IGN1cnJlbnQgPSBzdGFydDtcbiAgICAgICAgbGV0IG5lYXJieTtcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuICAgICAgICBsZXQgbGltaXQgPSA1XG4gICAgICAgIHdoaWxlIChsaW1pdCkge1xuICAgICAgICAgICAgaWYgKGVuZHBvaW50Lmd0KGN1cnJlbnQsIHN0b3ApKSB7XG4gICAgICAgICAgICAgICAgLy8gZXhoYXVzdGVkXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuZWFyYnkgPSB0aGlzLm5lYXJieShjdXJyZW50KTtcbiAgICAgICAgICAgIGlmIChuZWFyYnkuY2VudGVyLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAgICAgLy8gY2VudGVyIGVtcHR5ICh0eXBpY2FsbHkgZmlyc3QgaXRlcmF0aW9uKVxuICAgICAgICAgICAgICAgIGlmIChuZWFyYnkucmlnaHQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBubyBlbnRyaWVzIC0gYWxyZWFkeSBleGhhdXN0ZWRcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmlnaHQgZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBpbmNyZW1lbnQgb2Zmc2V0XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnQgPSBuZWFyYnkucmlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2gobmVhcmJ5LmNlbnRlcik7XG4gICAgICAgICAgICAgICAgaWYgKG5lYXJieS5yaWdodCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmlnaHQgdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgIC8vIGxhc3QgZW50cnkgLSBtYXJrIGl0ZXJhY3RvciBleGhhdXN0ZWRcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmlnaHQgZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBpbmNyZW1lbnQgb2Zmc2V0XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnQgPSBuZWFyYnkucmlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGltaXQtLTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBTYW1wbGUgTmVhcmJ5SW5kZXggYnkgdGltZWxpbmUgb2Zmc2V0IGluY3JlbWVudHNcbiAgICAgICAgcmV0dXJuIGxpc3Qgb2YgdHVwbGVzIFt2YWx1ZSwgb2Zmc2V0XVxuICAgICAgICBvcHRpb25zXG4gICAgICAgIC0gc3RhcnRcbiAgICAgICAgLSBzdG9wXG4gICAgICAgIC0gc3RlcFxuICAgICovXG4gICAgc2FtcGxlKG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtzdGFydD0tSW5maW5pdHksIHN0b3A9SW5maW5pdHksIHN0ZXA9MX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3RhcnQgPiBzdG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgKFwic3RvcCBtdXN0IGJlIGxhcmdlciB0aGFuIHN0YXJ0XCIsIHN0YXJ0LCBzdG9wKVxuICAgICAgICB9XG4gICAgICAgIHN0YXJ0ID0gW3N0YXJ0LCAwXTtcbiAgICAgICAgc3RvcCA9IFtzdG9wLCAwXTtcblxuICAgICAgICBzdGFydCA9IGVuZHBvaW50Lm1heCh0aGlzLmZpcnN0KCksIHN0YXJ0KTtcbiAgICAgICAgc3RvcCA9IGVuZHBvaW50Lm1pbih0aGlzLmxhc3QoKSwgc3RvcCk7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gbmV3IE5lYXJieUNhY2hlKHRoaXMpO1xuICAgICAgICByZXR1cm4gcmFuZ2Uoc3RhcnRbMF0sIHN0b3BbMF0sIHN0ZXAsIHtpbmNsdWRlX2VuZDp0cnVlfSlcbiAgICAgICAgICAgIC5tYXAoKG9mZnNldCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBbY2FjaGUucXVlcnkob2Zmc2V0KS52YWx1ZSwgb2Zmc2V0XTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxufVxuXG5cblxuXG5cbiIsImltcG9ydCB7aW50ZXJ2YWwsIGVuZHBvaW50fSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuL25lYXJieWluZGV4LmpzXCI7XG5cbi8qKlxuICogXG4gKiBOZWFyYnkgSW5kZXggU2ltcGxlXG4gKiBcbiAqIC0gaXRlbXMgYXJlIGFzc3VtZWQgdG8gYmUgbm9uLW92ZXJsYXBwaW5nIG9uIHRoZSB0aW1lbGluZSwgXG4gKiAtIGltcGx5aW5nIHRoYXQgbmVhcmJ5LmNlbnRlciB3aWxsIGJlIGEgbGlzdCBvZiBhdCBtb3N0IG9uZSBJVEVNLiBcbiAqIC0gZXhjZXB0aW9uIHdpbGwgYmUgcmFpc2VkIGlmIG92ZXJsYXBwaW5nIElURU1TIGFyZSBmb3VuZFxuICogLSBJVEVNUyBpcyBhc3N1bWJlZCB0byBiZSBpbW11dGFibGUgYXJyYXkgLSBjaGFuZ2UgSVRFTVMgYnkgcmVwbGFjaW5nIGFycmF5XG4gKiBcbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgYXJvdW5kIG9mZnNldC4gXG4gKiBcbiAqIFJldHVybnMge1xuICogICAgICBsZWZ0IC0gaGlnaCBpbnRlcnZhbCBlbmRwb2ludCBvZiB0aGUgZmlyc3QgSVRFTSB0byB0aGUgbGVmdCB3aGljaCBkb2VzIG5vdCBjb3ZlciBvZmZzZXQsIGVsc2UgdW5kZWZpbmVkXG4gKiAgICAgIGNlbnRlciAtIGxpc3Qgb2YgSVRFTVMgY292ZXJpbmcgb2Zmc2V0LCBlbHNlIFtdXG4gKiAgICAgIHJpZ2h0IC0gbG93IGludGVydmFsIGVuZHBvaW50IG9mIHRoZSBmaXJzdCBJVEVNIHRvIHRoZSByaWdodCB3aGljaCBkb2VzIG5vdCBjb3ZlciBvZmZzZXQsIGVsc2UgdW5kZWZpbmVkXG4gKiB9XG4gKiBcbiAqL1xuXG5cbi8vIGdldCBpbnRlcnZhbCBsb3cgcG9pbnRcbmZ1bmN0aW9uIGdldF9sb3dfdmFsdWUoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLml0dlswXTtcbn1cblxuLy8gZ2V0IGludGVydmFsIGxvdyBlbmRwb2ludFxuZnVuY3Rpb24gZ2V0X2xvd19lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzBdXG59XG5cbi8vIGdldCBpbnRlcnZhbCBoaWdoIGVuZHBvaW50XG5mdW5jdGlvbiBnZXRfaGlnaF9lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzFdXG59XG5cblxuZXhwb3J0IGNsYXNzIFNpbXBsZU5lYXJieUluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBbXTtcbiAgICAgICAgbGV0IHtpdGVtc30gPSBvcHRpb25zO1xuICAgICAgICBpZiAoaXRlbXMpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlKGl0ZW1zKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZSAoaXRlbXMpIHtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBjaGVja19pbnB1dChpdGVtcylcbiAgICB9XG5cblxuICAgIC8qXG4gICAgICAgIG5lYXJieSBieSBvZmZzZXRcbiAgICAgICAgXG4gICAgICAgIHJldHVybnMge2xlZnQsIGNlbnRlciwgcmlnaHR9XG5cbiAgICAgICAgYmluYXJ5IHNlYXJjaCBiYXNlZCBvbiBvZmZzZXRcbiAgICAgICAgMSkgZm91bmQsIGlkeFxuICAgICAgICAgICAgb2Zmc2V0IG1hdGNoZXMgdmFsdWUgb2YgaW50ZXJ2YWwubG93IG9mIGFuIGl0ZW1cbiAgICAgICAgICAgIGlkeCBnaXZlcyB0aGUgaW5kZXggb2YgdGhpcyBpdGVtIGluIHRoZSBhcnJheVxuICAgICAgICAyKSBub3QgZm91bmQsIGlkeFxuICAgICAgICAgICAgb2Zmc2V0IGlzIGVpdGhlciBjb3ZlcmVkIGJ5IGl0ZW0gYXQgKGlkeC0xKSxcbiAgICAgICAgICAgIG9yIGl0IGlzIG5vdCA9PiBiZXR3ZWVuIGVudHJpZXNcbiAgICAgICAgICAgIGluIHRoaXMgY2FzZSAtIGlkeCBnaXZlcyB0aGUgaW5kZXggd2hlcmUgYW4gaXRlbVxuICAgICAgICAgICAgc2hvdWxkIGJlIGluc2VydGVkIC0gaWYgaXQgaGFkIGxvdyA9PSBvZmZzZXRcbiAgICAqL1xuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvZmZzZXQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBbb2Zmc2V0LCAwXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkob2Zmc2V0KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW5kcG9pbnQgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgICAgICBjZW50ZXI6IFtdLFxuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICBsZWZ0OiB1bmRlZmluZWQsXG4gICAgICAgICAgICByaWdodDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgcHJldjogdW5kZWZpbmVkLFxuICAgICAgICAgICAgbmV4dDogdW5kZWZpbmVkXG4gICAgICAgIH07XG4gICAgICAgIGxldCBpdGVtcyA9IHRoaXMuX2l0ZW1zO1xuICAgICAgICBsZXQgaW5kZXhlcywgaXRlbTtcbiAgICAgICAgY29uc3Qgc2l6ZSA9IGl0ZW1zLmxlbmd0aDtcbiAgICAgICAgaWYgKHNpemUgPT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDsgXG4gICAgICAgIH1cbiAgICAgICAgbGV0IFtmb3VuZCwgaWR4XSA9IGZpbmRfaW5kZXgob2Zmc2V0WzBdLCBpdGVtcywgZ2V0X2xvd192YWx1ZSk7XG4gICAgICAgIGlmIChmb3VuZCkge1xuICAgICAgICAgICAgLy8gc2VhcmNoIG9mZnNldCBtYXRjaGVzIGl0ZW0gbG93IGV4YWN0bHlcbiAgICAgICAgICAgIC8vIGNoZWNrIHRoYXQgaXQgaW5kZWVkIGNvdmVyZWQgYnkgaXRlbSBpbnRlcnZhbFxuICAgICAgICAgICAgaXRlbSA9IGl0ZW1zW2lkeF1cbiAgICAgICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfZW5kcG9pbnQoaXRlbS5pdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTEsIGNlbnRlcjppZHgsIHJpZ2h0OmlkeCsxfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5kZXhlcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIHByZXYgaXRlbVxuICAgICAgICAgICAgaXRlbSA9IGl0ZW1zW2lkeC0xXTtcbiAgICAgICAgICAgIGlmIChpdGVtICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIHNlYXJjaCBvZmZzZXQgaXMgY292ZXJlZCBieSBpdGVtIGludGVydmFsXG4gICAgICAgICAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19lbmRwb2ludChpdGVtLml0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTIsIGNlbnRlcjppZHgtMSwgcmlnaHQ6aWR4fTtcbiAgICAgICAgICAgICAgICB9IFxuICAgICAgICAgICAgfVxuICAgICAgICB9XHRcbiAgICAgICAgaWYgKGluZGV4ZXMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBwcmV2IGl0ZW0gZWl0aGVyIGRvZXMgbm90IGV4aXN0IG9yIGlzIG5vdCByZWxldmFudFxuICAgICAgICAgICAgaW5kZXhlcyA9IHtsZWZ0OmlkeC0xLCBjZW50ZXI6LTEsIHJpZ2h0OmlkeH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjZW50ZXJcbiAgICAgICAgaWYgKDAgPD0gaW5kZXhlcy5jZW50ZXIgJiYgaW5kZXhlcy5jZW50ZXIgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQuY2VudGVyID0gIFtpdGVtc1tpbmRleGVzLmNlbnRlcl1dO1xuICAgICAgICB9XG4gICAgICAgIC8vIHByZXYvbmV4dFxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLmxlZnQgJiYgaW5kZXhlcy5sZWZ0IDwgc2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0LnByZXYgPSAgZ2V0X2hpZ2hfZW5kcG9pbnQoaXRlbXNbaW5kZXhlcy5sZWZ0XSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKDAgPD0gaW5kZXhlcy5yaWdodCAmJiBpbmRleGVzLnJpZ2h0IDwgc2l6ZSkge1xuICAgICAgICAgICAgcmVzdWx0Lm5leHQgPSAgZ2V0X2xvd19lbmRwb2ludChpdGVtc1tpbmRleGVzLnJpZ2h0XSk7XG4gICAgICAgIH0gICAgICAgIFxuICAgICAgICAvLyBsZWZ0L3JpZ2h0XG4gICAgICAgIGxldCBsb3csIGhpZ2g7XG4gICAgICAgIGlmIChyZXN1bHQuY2VudGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxldCBpdHYgPSByZXN1bHQuY2VudGVyWzBdLml0djtcbiAgICAgICAgICAgIFtsb3csIGhpZ2hdID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdHYpO1xuICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSAobG93WzBdID4gLUluZmluaXR5KSA/IGVuZHBvaW50LmZsaXAobG93LCBcImhpZ2hcIikgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSAoaGlnaFswXSA8IEluZmluaXR5KSA/IGVuZHBvaW50LmZsaXAoaGlnaCwgXCJsb3dcIikgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICByZXN1bHQuaXR2ID0gcmVzdWx0LmNlbnRlclswXS5pdHY7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IHJlc3VsdC5wcmV2O1xuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gcmVzdWx0Lm5leHQ7XG4gICAgICAgICAgICAvLyBpbnRlcnZhbFxuICAgICAgICAgICAgbGV0IGxlZnQgPSByZXN1bHQubGVmdDtcbiAgICAgICAgICAgIGxvdyA9IChsZWZ0ID09IHVuZGVmaW5lZCkgPyBbLUluZmluaXR5LCAwXSA6IGVuZHBvaW50LmZsaXAobGVmdCwgXCJsb3dcIik7XG4gICAgICAgICAgICBsZXQgcmlnaHQgPSByZXN1bHQucmlnaHQ7XG4gICAgICAgICAgICBoaWdoID0gKHJpZ2h0ID09IHVuZGVmaW5lZCkgPyBbSW5maW5pdHksIDBdIDogZW5kcG9pbnQuZmxpcChyaWdodCwgXCJoaWdoXCIpO1xuICAgICAgICAgICAgcmVzdWx0Lml0diA9IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblx0VVRJTFNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuXG4vLyBjaGVjayBpbnB1dFxuZnVuY3Rpb24gY2hlY2tfaW5wdXQoaXRlbXMpIHtcblxuICAgIGlmIChpdGVtcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaXRlbXMgPSBbXTtcbiAgICB9XG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIklucHV0IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgfVxuXG4gICAgLy8gc29ydCBpdGVtcyBiYXNlZCBvbiBpbnRlcnZhbCBsb3cgZW5kcG9pbnRcbiAgICBpdGVtcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGxldCBhX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYS5pdHYpWzBdO1xuICAgICAgICBsZXQgYl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGIuaXR2KVswXTtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmNtcChhX2xvdywgYl9sb3cpO1xuICAgIH0pO1xuXG4gICAgLy8gY2hlY2sgdGhhdCBpdGVtIGludGVydmFscyBhcmUgbm9uLW92ZXJsYXBwaW5nXG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBsZXQgcHJldl9oaWdoID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpIC0gMV0uaXR2KVsxXTtcbiAgICAgICAgbGV0IGN1cnJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpXS5pdHYpWzBdO1xuICAgICAgICAvLyB2ZXJpZnkgdGhhdCBwcmV2IGhpZ2ggaXMgbGVzcyB0aGF0IGN1cnIgbG93XG4gICAgICAgIGlmICghZW5kcG9pbnQubHQocHJldl9oaWdoLCBjdXJyX2xvdykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk92ZXJsYXBwaW5nIGludGVydmFscyBmb3VuZFwiKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cblxuLypcblx0YmluYXJ5IHNlYXJjaCBmb3IgZmluZGluZyB0aGUgY29ycmVjdCBpbnNlcnRpb24gaW5kZXggaW50b1xuXHR0aGUgc29ydGVkIGFycmF5IChhc2NlbmRpbmcpIG9mIGl0ZW1zXG5cdFxuXHRhcnJheSBjb250YWlucyBvYmplY3RzLCBhbmQgdmFsdWUgZnVuYyByZXRyZWF2ZXMgYSB2YWx1ZVxuXHRmcm9tIGVhY2ggb2JqZWN0LlxuXG5cdHJldHVybiBbZm91bmQsIGluZGV4XVxuKi9cblxuZnVuY3Rpb24gZmluZF9pbmRleCh0YXJnZXQsIGFyciwgdmFsdWVfZnVuYykge1xuXG4gICAgZnVuY3Rpb24gZGVmYXVsdF92YWx1ZV9mdW5jKGVsKSB7XG4gICAgICAgIHJldHVybiBlbDtcbiAgICB9XG4gICAgXG4gICAgbGV0IGxlZnQgPSAwO1xuXHRsZXQgcmlnaHQgPSBhcnIubGVuZ3RoIC0gMTtcblx0dmFsdWVfZnVuYyA9IHZhbHVlX2Z1bmMgfHwgZGVmYXVsdF92YWx1ZV9mdW5jO1xuXHR3aGlsZSAobGVmdCA8PSByaWdodCkge1xuXHRcdGNvbnN0IG1pZCA9IE1hdGguZmxvb3IoKGxlZnQgKyByaWdodCkgLyAyKTtcblx0XHRsZXQgbWlkX3ZhbHVlID0gdmFsdWVfZnVuYyhhcnJbbWlkXSk7XG5cdFx0aWYgKG1pZF92YWx1ZSA9PT0gdGFyZ2V0KSB7XG5cdFx0XHRyZXR1cm4gW3RydWUsIG1pZF07IC8vIFRhcmdldCBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgYXJyYXlcblx0XHR9IGVsc2UgaWYgKG1pZF92YWx1ZSA8IHRhcmdldCkge1xuXHRcdFx0ICBsZWZ0ID0gbWlkICsgMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIHJpZ2h0XG5cdFx0fSBlbHNlIHtcblx0XHRcdCAgcmlnaHQgPSBtaWQgLSAxOyAvLyBNb3ZlIHNlYXJjaCByYW5nZSB0byB0aGUgbGVmdFxuXHRcdH1cblx0fVxuICBcdHJldHVybiBbZmFsc2UsIGxlZnRdOyAvLyBSZXR1cm4gdGhlIGluZGV4IHdoZXJlIHRhcmdldCBzaG91bGQgYmUgaW5zZXJ0ZWRcbn1cbiIsIlxuaW1wb3J0IHsgTGF5ZXJCYXNlLCBTdGF0ZVByb3ZpZGVyQmFzZSB9IGZyb20gXCIuL2Jhc2VzLmpzXCI7XG5pbXBvcnQgeyBzb3VyY2UgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5pbXBvcnQgeyBTaW1wbGVTdGF0ZVByb3ZpZGVyIH0gZnJvbSBcIi4vc3RhdGVwcm92aWRlcl9zaW1wbGUuanNcIjtcbmltcG9ydCB7IFNpbXBsZU5lYXJieUluZGV4IH0gZnJvbSBcIi4vbmVhcmJ5aW5kZXhfc2ltcGxlLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlDYWNoZSB9IGZyb20gXCIuL25lYXJieWNhY2hlLmpzXCI7XG5pbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBcbiAqIExheWVyXG4gKiAtIGhhcyBtdXRhYmxlIHN0YXRlIHByb3ZpZGVyIChzcmMpIChkZWZhdWx0IHN0YXRlIHVuZGVmaW5lZClcbiAqIC0gbWV0aG9kcyBmb3IgbGlzdCBhbmQgc2FtcGxlXG4gKiBcbiAqL1xuXG5cbmV4cG9ydCBjbGFzcyBMYXllciBleHRlbmRzIExheWVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIC8vIHNyY1xuICAgICAgICBzb3VyY2UuYWRkVG9JbnN0YW5jZSh0aGlzLCBcInNyY1wiKTtcbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgdGhpcy5faW5kZXggPSBuZXcgU2ltcGxlTmVhcmJ5SW5kZXgoKTtcbiAgICAgICAgLy8gY2FjaGVcbiAgICAgICAgdGhpcy5fY2FjaGUgPSBuZXcgTmVhcmJ5Q2FjaGUodGhpcy5faW5kZXgpO1xuXG4gICAgICAgIC8vIGluaXRpYWxpc2Ugd2l0aCBzdGF0ZXByb3ZpZGVyXG4gICAgICAgIGxldCB7c3JjLCAuLi5vcHRzfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzcmMgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzcmMgPSBuZXcgU2ltcGxlU3RhdGVQcm92aWRlcihvcHRzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBTdGF0ZVByb3ZpZGVyQmFzZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInNyYyBtdXN0IGJlIFN0YXRlcHJvdmlkZXJCYXNlXCIpXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zcmMgPSBzcmM7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBTUkMgKHN0YXRlcHJvdmlkZXIpXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfX3NyY19jaGVjayhzcmMpIHtcbiAgICAgICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgU3RhdGVQcm92aWRlckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwic3JjXCIgbXVzdCBiZSBzdGF0ZSBwcm92aWRlciAke3NvdXJjZX1gKTtcbiAgICAgICAgfVxuICAgIH0gICAgXG4gICAgX19zcmNfaGFuZGxlX2NoYW5nZSgpIHtcbiAgICAgICAgdGhpcy5faW5kZXgudXBkYXRlKHRoaXMuc3JjLml0ZW1zKTtcbiAgICAgICAgdGhpcy5fY2FjaGUuZGlydHkoKTtcbiAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgIC8vIHRyaWdnZXIgY2hhbmdlIGV2ZW50IGZvciBjdXJzb3JcbiAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIik7ICAgXG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBRVUVSWSBBUElcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGdldCBjYWNoZSAoKSB7cmV0dXJuIHRoaXMuX2NhY2hlfTtcbiAgICBnZXQgaW5kZXggKCkge3JldHVybiB0aGlzLl9pbmRleH07XG4gICAgXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChvZmZzZXQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJMYXllcjogcXVlcnkgb2Zmc2V0IGNhbiBub3QgYmUgdW5kZWZpbmVkXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIGxpc3QgKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2luZGV4Lmxpc3Qob3B0aW9ucyk7XG4gICAgfVxuXG4gICAgc2FtcGxlIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbmRleC5zYW1wbGUob3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBVUERBVEUgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICAvLyBUT0RPIC0gYWRkIG1ldGhvZHMgZm9yIHVwZGF0ZT9cblxufVxuc291cmNlLmFkZFRvUHJvdG90eXBlKExheWVyLnByb3RvdHlwZSwgXCJzcmNcIiwge211dGFibGU6dHJ1ZX0pO1xuXG5cbmZ1bmN0aW9uIGZyb21BcnJheSAoYXJyYXkpIHtcbiAgICBjb25zdCBpdGVtcyA9IGFycmF5Lm1hcCgob2JqLCBpbmRleCkgPT4ge1xuICAgICAgICByZXR1cm4geyBcbiAgICAgICAgICAgIGl0djogW2luZGV4LCBpbmRleCsxLCB0cnVlLCBmYWxzZV0sIFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIiwgXG4gICAgICAgICAgICBhcmdzOiB7dmFsdWU6b2JqfX07XG4gICAgfSk7XG4gICAgcmV0dXJuIG5ldyBMYXllcih7aXRlbXN9KTtcbn1cblxuTGF5ZXIuZnJvbUFycmF5ID0gZnJvbUFycmF5OyIsIlxuXG5pbXBvcnQgeyBTdGF0ZVByb3ZpZGVyQmFzZSwgQ3Vyc29yQmFzZSwgTGF5ZXJCYXNlIH0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7IHNvdXJjZSB9IGZyb20gXCIuL3V0aWwuanNcIjtcbmltcG9ydCB7IFNpbXBsZVN0YXRlUHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX3NpbXBsZS5qc1wiO1xuaW1wb3J0IHsgY21kIH0gZnJvbSBcIi4vY21kLmpzXCI7XG5pbXBvcnQgeyBTaW1wbGVOZWFyYnlJbmRleCB9IGZyb20gXCIuL25lYXJieWluZGV4X3NpbXBsZS5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5Q2FjaGUgfSBmcm9tIFwiLi9uZWFyYnljYWNoZS5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi9sYXllcnMuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ0xPQ0tTXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jb25zdCBDTE9DSyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gcGVyZm9ybWFuY2Uubm93KCkvMTAwMC4wO1xufVxuXG4vKlxuICAgIE5PVEUgXG4gICAgZXBvY2ggc2hvdWxkIG9ubHkgYmUgdXNlZCBmb3IgdmlzdWFsaXphdGlvbixcbiAgICBhcyBpdCBoYXMgdGltZSByZXNvbHV0aW9uIGxpbWl0ZWQgdG8gbXNcbiovXG5cbmNvbnN0IEVQT0NIID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBEYXRlLm5vdygpLzEwMDAuMDtcbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBDTE9DSyBDVVJTT1JTXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vLyBDTE9DSyAoY291bnRpbmcgc2Vjb25kcyBzaW5jZSBwYWdlIGxvYWQpXG5jbGFzcyBDbG9ja0N1cnNvciBleHRlbmRzIEN1cnNvckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKGNsb2NrKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2Nsb2NrID0gY2xvY2s7XG4gICAgICAgIC8vIGl0ZW1zXG4gICAgICAgIGNvbnN0IHQwID0gdGhpcy5fY2xvY2soKTtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBbe1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICAgICAgYXJnczoge3Bvc2l0aW9uOiB0MCwgdmVsb2NpdHk6IDEsIG9mZnNldDogdDB9XG4gICAgICAgIH1dOyAgICBcbiAgICB9XG5cbiAgICBxdWVyeSAoKSB7XG4gICAgICAgIGxldCB0cyA9IHRoaXMuX2Nsb2NrKCk7IFxuICAgICAgICByZXR1cm4ge3ZhbHVlOnRzLCBkeW5hbWljOnRydWUsIG9mZnNldDp0c307XG4gICAgfVxuXG4gICAgaXRlbXMgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXRlbXM7XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgbG9jYWxfY2xvY2sgPSBuZXcgQ2xvY2tDdXJzb3IoQ0xPQ0spO1xuZXhwb3J0IGNvbnN0IGxvY2FsX2Vwb2NoID0gbmV3IENsb2NrQ3Vyc29yKEVQT0NIKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBcbiAqIEN1cnNvciBpcyBhIHZhcmlhYmxlXG4gKiAtIGhhcyBtdXRhYmxlIGN0cmwgY3Vyc29yIChkZWZhdWx0IGxvY2FsIGNsb2NrKVxuICogLSBoYXMgbXV0YWJsZSBzdGF0ZSBwcm92aWRlciAoc3JjKSAoZGVmYXVsdCBzdGF0ZSB1bmRlZmluZWQpXG4gKiAtIG1ldGhvZHMgZm9yIGFzc2lnbiwgbW92ZSwgdHJhbnNpdGlvbiwgaW50ZXBvbGF0aW9uXG4gKiBcbiAqL1xuXG5leHBvcnQgY2xhc3MgQ3Vyc29yIGV4dGVuZHMgQ3Vyc29yQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvLyBjdHJsXG4gICAgICAgIHNvdXJjZS5hZGRUb0luc3RhbmNlKHRoaXMsIFwiY3RybFwiKTtcbiAgICAgICAgLy8gc3JjXG4gICAgICAgIHNvdXJjZS5hZGRUb0luc3RhbmNlKHRoaXMsIFwic3JjXCIpO1xuICAgICAgICAvLyBpbmRleFxuICAgICAgICB0aGlzLl9pbmRleDtcbiAgICAgICAgLy8gY2FjaGVcbiAgICAgICAgdGhpcy5fY2FjaGU7XG4gICAgICAgIC8vIHRpbWVvdXRcbiAgICAgICAgdGhpcy5fdGlkO1xuICAgICAgICAvLyBwb2xsaW5nXG4gICAgICAgIHRoaXMuX3BpZDtcbiAgICAgICAgLy8gb3B0aW9uc1xuICAgICAgICBsZXQge3NyYywgY3RybCwgLi4ub3B0c30gPSBvcHRpb25zO1xuXG4gICAgICAgIC8vIGluaXRpYWxpc2UgY3RybFxuICAgICAgICBpZiAoY3RybCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGN0cmwgPSBsb2NhbF9jbG9jaztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmN0cmwgPSBjdHJsO1xuXG4gICAgICAgIC8vIGluaXRpYWxpc2Ugc3RhdGVcbiAgICAgICAgaWYgKHNyYyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNyYyA9IG5ldyBMYXllcihvcHRzKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNyYyA9IHNyY1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogQ1RSTCAoY3Vyc29yKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgX19jdHJsX2NoZWNrKGN0cmwpIHtcbiAgICAgICAgaWYgKCEoY3RybCBpbnN0YW5jZW9mIEN1cnNvckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwiY3RybFwiIG11c3QgYmUgY3Vyc29yICR7Y3RybH1gKVxuICAgICAgICB9XG4gICAgfVxuICAgIF9fY3RybF9oYW5kbGVfY2hhbmdlKCkge1xuICAgICAgICB0aGlzLl9faGFuZGxlX2NoYW5nZShcImN0cmxcIik7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBTUkMgKHN0YXRlcHJvdmlkZXIpXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfX3NyY19jaGVjayhzcmMpIHtcbiAgICAgICAgaWYgKCEoc3JjIGluc3RhbmNlb2YgTGF5ZXJCYXNlKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcInNyY1wiIG11c3QgYmUgTGF5ZXIgJHtzcmN9YCk7XG4gICAgICAgIH1cbiAgICB9ICAgIFxuICAgIF9fc3JjX2hhbmRsZV9jaGFuZ2UoKSB7XG4gICAgICAgIHRoaXMuX19oYW5kbGVfY2hhbmdlKFwic3JjXCIpO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogQ0FMTEJBQ0tcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIF9faGFuZGxlX2NoYW5nZShvcmlnaW4pIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3RpZCk7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5fcGlkKTtcbiAgICAgICAgaWYgKHRoaXMuc3JjICYmIHRoaXMuY3RybCkge1xuICAgICAgICAgICAgaWYgKG9yaWdpbiA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVzZXQgY3Vyc29yIGluZGV4IHRvIGxheWVyIGluZGV4XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2luZGV4ICE9IHRoaXMuc3JjLmluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2luZGV4ID0gdGhpcy5zcmMuaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlID0gbmV3IE5lYXJieUNhY2hlKHRoaXMuX2luZGV4KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAob3JpZ2luID09IFwic3JjXCIgfHwgb3JpZ2luID09IFwiY3RybFwiKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVmcmVzaCBjYWNoZVxuICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlLmRpcnR5KCk7XG4gICAgICAgICAgICAgICAgbGV0IHt2YWx1ZTpvZmZzZXR9ID0gdGhpcy5jdHJsLnF1ZXJ5KCk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBvZmZzZXQgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3RybCBzdGF0ZSBtdXN0IGJlIG51bWJlciAke29mZnNldH1gKTtcbiAgICAgICAgICAgICAgICB9ICAgICAgICBcbiAgICAgICAgICAgICAgICB0aGlzLl9jYWNoZS5yZWZyZXNoKG9mZnNldCk7IFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICAvLyB0cmlnZ2VyIGNoYW5nZSBldmVudCBmb3IgY3Vyc29yXG4gICAgICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiLCB0aGlzLnF1ZXJ5KCkpO1xuICAgICAgICAgICAgLy8gZGV0ZWN0IGZ1dHVyZSBjaGFuZ2UgZXZlbnQgLSBpZiBuZWVkZWRcbiAgICAgICAgICAgIHRoaXMuX19kZXRlY3RfZnV0dXJlX2NoYW5nZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogREVURUNUIEZVVFVSRSBDSEFOR0VcbiAgICAgKiBcbiAgICAgKiBQUk9CTEVNOlxuICAgICAqIFxuICAgICAqIER1cmluZyBwbGF5YmFjayAoY3Vyc29yLmN0cmwgaXMgZHluYW1pYyksIHRoZXJlIGlzIGEgbmVlZCB0byBcbiAgICAgKiBkZXRlY3QgdGhlIHBhc3NpbmcgZnJvbSBvbmUgc2VnbWVudCBpbnRlcnZhbFxuICAgICAqIHRvIHRoZSBuZXh0IC0gaWRlYWxseSBhdCBwcmVjaXNlbHkgdGhlIGNvcnJlY3QgdGltZVxuICAgICAqIFxuICAgICAqIG5lYXJieS5pdHYgKGRlcml2ZWQgZnJvbSBjdXJzb3Iuc3JjKSBnaXZlcyB0aGUgXG4gICAgICogaW50ZXJ2YWwgKGkpIHdlIGFyZSBjdXJyZW50bHkgaW4sIGkuZS4sIFxuICAgICAqIGNvbnRhaW5pbmcgdGhlIGN1cnJlbnQgb2Zmc2V0ICh2YWx1ZSBvZiBjdXJzb3IuY3RybCksIFxuICAgICAqIGFuZCAoaWkpIHdoZXJlIG5lYXJieS5jZW50ZXIgc3RheXMgY29uc3RhbnRcbiAgICAgKiBcbiAgICAgKiBUaGUgZXZlbnQgdGhhdCBuZWVkcyB0byBiZSBkZXRlY3RlZCBpcyB0aGVyZWZvcmUgdGhlXG4gICAgICogbW9tZW50IHdoZW4gd2UgbGVhdmUgdGhpcyBpbnRlcnZhbCwgdGhyb3VnaCBlaXRoZXJcbiAgICAgKiB0aGUgbG93IG9yIGhpZ2ggaW50ZXJ2YWwgZW5kcG9pbnRcbiAgICAgKiBcbiAgICAgKiBHT0FMOlxuICAgICAqIFxuICAgICAqIEF0IHRoaXMgbW9tZW50LCB3ZSBzaW1wbHkgbmVlZCB0byByZWV2YWx1YXRlIHRoZSBzdGF0ZSAocXVlcnkpIGFuZFxuICAgICAqIGVtaXQgYSBjaGFuZ2UgZXZlbnQgdG8gbm90aWZ5IG9ic2VydmVycy4gXG4gICAgICogXG4gICAgICogQVBQUk9BQ0hFUzpcbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbMF0gXG4gICAgICogVGhlIHRyaXZpYWwgc29sdXRpb24gaXMgdG8gZG8gbm90aGluZywgaW4gd2hpY2ggY2FzZVxuICAgICAqIG9ic2VydmVycyB3aWxsIHNpbXBseSBmaW5kIG91dCB0aGVtc2VsdmVzIGFjY29yZGluZyB0byB0aGVpciBcbiAgICAgKiBvd24gcG9sbCBmcmVxdWVuY3kuIFRoaXMgaXMgc3Vib3B0aW1hbCwgcGFydGljdWxhcmx5IGZvciBsb3cgZnJlcXVlbmN5IFxuICAgICAqIG9ic2VydmVycy4gSWYgdGhlcmUgaXMgYXQgbGVhc3Qgb25lIGhpZ2gtZnJlcXVlbmN5IHBvbGxlciwgXG4gICAgICogdGhpcyB3b3VsZCB0cmlnZ2VyIHRyaWdnZXIgdGhlIHN0YXRlIGNoYW5nZSwgY2F1c2luZyBhbGxcbiAgICAgKiBvYnNlcnZlcnMgdG8gYmUgbm90aWZpZWQuIFRoZSBwcm9ibGVtIHRob3VnaCwgaXMgaWYgbm8gb2JzZXJ2ZXJzXG4gICAgICogYXJlIGFjdGl2ZWx5IHBvbGxpbmcsIGJ1dCBvbmx5IGRlcGVuZGluZyBvbiBjaGFuZ2UgZXZlbnRzLlxuICAgICAqIFxuICAgICAqIEFwcHJvYWNoIFsxXSBcbiAgICAgKiBJbiBjYXNlcyB3aGVyZSB0aGUgY3RybCBpcyBkZXRlcm1pbmlzdGljLCBhIHRpbWVvdXRcbiAgICAgKiBjYW4gYmUgY2FsY3VsYXRlZC4gVGhpcyBpcyB0cml2aWFsIGlmIGN0cmwgaXMgYSBDbG9ja0N1cnNvciwgYW5kXG4gICAgICogaXQgaXMgZmFpcmx5IGVhc3kgaWYgdGhlIGN0cmwgaXMgQ3Vyc29yIHJlcHJlc2VudGluZyBtb3Rpb25cbiAgICAgKiBvciBsaW5lYXIgdHJhbnNpdGlvbi4gSG93ZXZlciwgY2FsY3VsYXRpb25zIGNhbiBiZWNvbWUgbW9yZVxuICAgICAqIGNvbXBsZXggaWYgbW90aW9uIHN1cHBvcnRzIGFjY2VsZXJhdGlvbiwgb3IgaWYgdHJhbnNpdGlvbnNcbiAgICAgKiBhcmUgc2V0IHVwIHdpdGggbm9uLWxpbmVhciBlYXNpbmcuXG4gICAgICogICBcbiAgICAgKiBOb3RlLCBob3dldmVyLCB0aGF0IHRoZXNlIGNhbGN1bGF0aW9ucyBhc3N1bWUgdGhhdCB0aGUgY3Vyc29yLmN0cmwgaXMgXG4gICAgICogYSBDbG9ja0N1cnNvciwgb3IgdGhhdCBjdXJzb3IuY3RybC5jdHJsIGlzIGEgQ2xvY2tDdXJzb3IuIFxuICAgICAqIEluIHByaW5jaXBsZSwgdGhvdWdoLCB0aGVyZSBjb3VsZCBiZSBhIHJlY3Vyc2l2ZSBjaGFpbiBvZiBjdXJzb3JzLFxuICAgICAqIChjdXJzb3IuY3RybC5jdHJsLi4uLmN0cmwpIG9mIHNvbWUgbGVuZ3RoLCB3aGVyZSBvbmx5IHRoZSBsYXN0IGlzIGEgXG4gICAgICogQ2xvY2tDdXJzb3IuIEluIG9yZGVyIHRvIGRvIGRldGVybWluaXN0aWMgY2FsY3VsYXRpb25zIGluIHRoZSBnZW5lcmFsXG4gICAgICogY2FzZSwgYWxsIGN1cnNvcnMgaW4gdGhlIGNoYWluIHdvdWxkIGhhdmUgdG8gYmUgbGltaXRlZCB0byBcbiAgICAgKiBkZXRlcm1pbmlzdGljIGxpbmVhciB0cmFuc2Zvcm1hdGlvbnMuXG4gICAgICogXG4gICAgICogQXBwcm9jaCBbMl0gXG4gICAgICogSXQgbWlnaHQgYWxzbyBiZSBwb3NzaWJsZSB0byBzYW1wbGUgZnV0dXJlIHZhbHVlcyBvZiBcbiAgICAgKiBjdXJzb3IuY3RybCB0byBzZWUgaWYgdGhlIHZhbHVlcyB2aW9sYXRlIHRoZSBuZWFyYnkuaXR2IGF0IHNvbWUgcG9pbnQuIFxuICAgICAqIFRoaXMgd291bGQgZXNzZW50aWFsbHkgYmUgdHJlYXRpbmcgY3RybCBhcyBhIGxheWVyIGFuZCBzYW1wbGluZyBcbiAgICAgKiBmdXR1cmUgdmFsdWVzLiBUaGlzIGFwcHJvY2ggd291bGQgd29yayBmb3IgYWxsIHR5cGVzLCBcbiAgICAgKiBidXQgdGhlcmUgaXMgbm8ga25vd2luZyBob3cgZmFyIGludG8gdGhlIGZ1dHVyZSBvbmUgXG4gICAgICogd291bGQgaGF2ZSB0byBzZWVrLiBIb3dldmVyLCBhZ2FpbiAtIGFzIGluIFsxXSB0aGUgYWJpbGl0eSB0byBzYW1wbGUgZnV0dXJlIHZhbHVlc1xuICAgICAqIGlzIHByZWRpY2F0ZWQgb24gY3Vyc29yLmN0cmwgYmVpbmcgYSBDbG9ja0N1cnNvci4gQWxzbywgdGhlcmUgXG4gICAgICogaXMgbm8gd2F5IG9mIGtub3dpbmcgaG93IGxvbmcgaW50byB0aGUgZnV0dXJlIHNhbXBsaW5nIHdvdWxkIGJlIG5lY2Vzc2FyeS5cbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbM10gXG4gICAgICogSW4gdGhlIGdlbmVyYWwgY2FzZSwgdGhlIG9ubHkgd2F5IHRvIHJlbGlhYmxleSBkZXRlY3QgdGhlIGV2ZW50IGlzIHRocm91Z2ggcmVwZWF0ZWRcbiAgICAgKiBwb2xsaW5nLiBBcHByb2FjaCBbM10gaXMgc2ltcGx5IHRoZSBpZGVhIHRoYXQgdGhpcyBwb2xsaW5nIGlzIHBlcmZvcm1lZFxuICAgICAqIGludGVybmFsbHkgYnkgdGhlIGN1cnNvciBpdHNlbGYsIGFzIGEgd2F5IG9mIHNlY3VyaW5nIGl0cyBvd24gY29uc2lzdGVudFxuICAgICAqIHN0YXRlLCBhbmQgZW5zdXJpbmcgdGhhdCBvYnNlcnZlciBnZXQgY2hhbmdlIGV2ZW50cyBpbiBhIHRpbWVseSBtYW5uZXIsIGV2ZW50XG4gICAgICogaWYgdGhleSBkbyBsb3ctZnJlcXVlbmN5IHBvbGxpbmcsIG9yIGRvIG5vdCBkbyBwb2xsaW5nIGF0IGFsbC4gXG4gICAgICogXG4gICAgICogU09MVVRJT046XG4gICAgICogQXMgdGhlcmUgaXMgbm8gcGVyZmVjdCBzb2x1dGlvbiBpbiB0aGUgZ2VuZXJhbCBjYXNlLCB3ZSBvcHBvcnR1bmlzdGljYWxseVxuICAgICAqIHVzZSBhcHByb2FjaCBbMV0gd2hlbiB0aGlzIGlzIHBvc3NpYmxlLiBJZiBub3QsIHdlIGFyZSBmYWxsaW5nIGJhY2sgb24gXG4gICAgICogYXBwcm9hY2ggWzNdXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIE5PIGV2ZW50IGRldGVjdGlvbiBpcyBuZWVkZWQgKE5PT1ApXG4gICAgICogKGkpIGN1cnNvci5jdHJsIGlzIG5vdCBkeW5hbWljXG4gICAgICogb3JcbiAgICAgKiAoaWkpIG5lYXJieS5pdHYgc3RyZXRjaGVzIGludG8gaW5maW5pdHkgaW4gYm90aCBkaXJlY3Rpb25zXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIGFwcHJvYWNoIFsxXSBjYW4gYmUgdXNlZFxuICAgICAqIFxuICAgICAqIChpKSBpZiBjdHJsIGlzIGEgQ2xvY2tDdXJzb3IgJiYgbmVhcmJ5Lml0di5oaWdoIDwgSW5maW5pdHlcbiAgICAgKiBvclxuICAgICAqIChpaSkgY3RybC5jdHJsIGlzIGEgQ2xvY2tDdXJzb3JcbiAgICAgKiAgICAgIChhKSBjdHJsLm5lYXJieS5jZW50ZXIgaGFzIGV4YWN0bHkgMSBpdGVtXG4gICAgICogICAgICAmJlxuICAgICAqICAgICAgKGIpIGN0cmwubmVhcmJ5LmNlbnRlclswXS50eXBlID09IChcIm1vdGlvblwiKSB8fCAoXCJ0cmFuc2l0aW9uXCIgJiYgZWFzaW5nPT1cImxpbmVhclwiKVxuICAgICAqICAgICAgJiZcbiAgICAgKiAgICAgIChjKSBjdHJsLm5lYXJieS5jZW50ZXJbMF0uYXJncy52ZWxvY2l0eSAhPSAwLjBcbiAgICAgKiAgICAgICYmIFxuICAgICAqICAgICAgKGQpIGZ1dHVyZSBpbnRlcnNlY3RvbiBwb2ludCB3aXRoIGNhY2hlLm5lYXJieS5pdHYgXG4gICAgICogICAgICAgICAgaXMgbm90IC1JbmZpbml0eSBvciBJbmZpbml0eVxuICAgICAqIFxuICAgICAqIFRob3VnaCBpdCBzZWVtcyBjb21wbGV4LCBjb25kaXRpb25zIGZvciBbMV0gc2hvdWxkIGJlIG1ldCBmb3IgY29tbW9uIGNhc2VzIGludm9sdmluZ1xuICAgICAqIHBsYXliYWNrLiBBbHNvLCB1c2Ugb2YgdHJhbnNpdGlvbiBldGMgbWlnaHQgYmUgcmFyZS5cbiAgICAgKiBcbiAgICAgKi9cblxuICAgIF9fZGV0ZWN0X2Z1dHVyZV9jaGFuZ2UoKSB7XG5cbiAgICAgICAgLy8gY3RybCBcbiAgICAgICAgY29uc3QgY3RybF92ZWN0b3IgPSB0aGlzLmN0cmwucXVlcnkoKTtcbiAgICAgICAgY29uc3Qge3ZhbHVlOmN1cnJlbnRfcG9zfSA9IGN0cmxfdmVjdG9yO1xuXG4gICAgICAgIC8vIG5lYXJieS5jZW50ZXIgLSBsb3cgYW5kIGhpZ2hcbiAgICAgICAgdGhpcy5jYWNoZS5yZWZyZXNoKGN0cmxfdmVjdG9yLnZhbHVlKTtcbiAgICAgICAgY29uc3Qgc3JjX25lYXJieSA9IHRoaXMuY2FjaGUubmVhcmJ5O1xuICAgICAgICBjb25zdCBbbG93LCBoaWdoXSA9IHNyY19uZWFyYnkuaXR2LnNsaWNlKDAsMik7XG5cbiAgICAgICAgLy8gY3RybCBtdXN0IGJlIGR5bmFtaWNcbiAgICAgICAgaWYgKCFjdHJsX3ZlY3Rvci5keW5hbWljKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhcHByb2FjaCBbMV1cbiAgICAgICAgaWYgKHRoaXMuY3RybCBpbnN0YW5jZW9mIENsb2NrQ3Vyc29yKSB7XG4gICAgICAgICAgICBpZiAoaXNGaW5pdGUoaGlnaCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9fc2V0X3RpbWVvdXQoaGlnaCwgY3VycmVudF9wb3MsIDEuMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIHRoaXMuY3RybCBpbnN0YW5jZW9mIEN1cnNvciAmJiBcbiAgICAgICAgICAgIHRoaXMuY3RybC5jdHJsIGluc3RhbmNlb2YgQ2xvY2tDdXJzb3JcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBjb25zdCBjdHJsX25lYXJieSA9IHRoaXMuY3RybC5jYWNoZS5uZWFyYnk7XG5cbiAgICAgICAgICAgIGlmICghaXNGaW5pdGUobG93KSAmJiAhaXNGaW5pdGUoaGlnaCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY3RybF9uZWFyYnkuY2VudGVyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY3RybF9pdGVtID0gY3RybF9uZWFyYnkuY2VudGVyWzBdO1xuICAgICAgICAgICAgICAgIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHt2ZWxvY2l0eSwgYWNjZWxlcmF0aW9uPTAuMH0gPSBjdHJsX2l0ZW0uYXJncztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjY2VsZXJhdGlvbiA9PSAwLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdGFyZ2V0X3BvcyA9ICh2ZWxvY2l0eSA+IDApID8gaGlnaCA6IGxvdztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0Zpbml0ZSh0YXJnZXRfcG9zKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgdmVsb2NpdHkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjsgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm8gbmVlZCBmb3IgdGltZW91dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY3RybF9pdGVtLnR5cGUgPT0gXCJ0cmFuc2l0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qge3YwOnAwLCB2MTpwMSwgdDAsIHQxLCBlYXNpbmc9XCJsaW5lYXJcIn0gPSBjdHJsX2l0ZW0uYXJncztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVhc2luZyA9PSBcImxpbmVhclwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBsaW5lYXIgdHJhbnN0aW9uXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdmVsb2NpdHkgPSAocDEtcDApLyh0MS10MCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmaWd1cmUgb3V0IHdoaWNoIGJvdW5kYXJ5IHdlIGhpdCBmaXJzdFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0X3BvcyA9ICh2ZWxvY2l0eSA+IDApID8gTWF0aC5taW4oaGlnaCwgcDEpIDogTWF0aC5tYXgobG93LCBwMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9fc2V0X3RpbWVvdXQodGFyZ2V0X3BvcywgY3VycmVudF9wb3MsIHZlbG9jaXR5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFwcHJvYWNoIFszXVxuICAgICAgICB0aGlzLl9fc2V0X3BvbGxpbmcoKTtcbiAgICB9XG5cbiAgICBfX3NldF90aW1lb3V0KHRhcmdldF9wb3MsIGN1cnJlbnRfcG9zLCB2ZWxvY2l0eSkge1xuICAgICAgICBjb25zdCBkZWx0YV9zZWMgPSAodGFyZ2V0X3BvcyAtIGN1cnJlbnRfcG9zKS92ZWxvY2l0eTtcbiAgICAgICAgdGhpcy5fdGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9faGFuZGxlX3RpbWVvdXQoKVxuICAgICAgICB9LCBkZWx0YV9zZWMqMTAwMCk7XG4gICAgfVxuXG4gICAgX19oYW5kbGVfdGltZW91dCgpIHtcbiAgICAgICAgLy8gdHJpZ2dlciBjaGFuZ2UgZXZlbnQgZm9yIGN1cnNvclxuICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiLCB0aGlzLnF1ZXJ5KCkpO1xuICAgIH1cblxuICAgIF9fc2V0X3BvbGxpbmcoKSB7XG4gICAgICAgIHRoaXMuX3BpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX19oYW5kbGVfcG9sbCgpO1xuICAgICAgICB9LCAxMDApO1xuICAgIH1cblxuICAgIF9faGFuZGxlX3BvbGwoKSB7XG4gICAgICAgIHRoaXMucXVlcnkoKTtcbiAgICB9XG5cblxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBRVUVSWSBBUElcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIHF1ZXJ5ICgpIHtcbiAgICAgICAgbGV0IHt2YWx1ZTpvZmZzZXR9ID0gdGhpcy5jdHJsLnF1ZXJ5KCk7XG4gICAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdHJsIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7b2Zmc2V0fWApO1xuICAgICAgICB9XG4gICAgICAgIGxldCByZWZyZXNoZWQgPSB0aGlzLl9jYWNoZS5yZWZyZXNoKG9mZnNldCk7XG4gICAgICAgIGlmIChyZWZyZXNoZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX19oYW5kbGVfY2hhbmdlKFwicXVlcnlcIik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlLnF1ZXJ5KG9mZnNldCk7XG4gICAgfVxuXG4gICAgZ2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5xdWVyeSgpLnZhbHVlfTtcbiAgICBnZXQgY2FjaGUgKCkge3JldHVybiB0aGlzLl9jYWNoZX07XG4gICAgZ2V0IGluZGV4ICgpIHtyZXR1cm4gdGhpcy5faW5kZXh9O1xuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBVUERBVEUgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBhc3NpZ24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzLnNyYy5zcmMpLmFzc2lnbih2YWx1ZSk7XG4gICAgfVxuICAgIG1vdmUgKHtwb3NpdGlvbiwgdmVsb2NpdHl9KSB7XG4gICAgICAgIGxldCB7dmFsdWUsIG9mZnNldDp0aW1lc3RhbXB9ID0gdGhpcy5xdWVyeSgpO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3Igc3RhdGUgbXVzdCBiZSBudW1iZXIgJHt2YWx1ZX1gKTtcbiAgICAgICAgfVxuICAgICAgICBwb3NpdGlvbiA9IChwb3NpdGlvbiAhPSB1bmRlZmluZWQpID8gcG9zaXRpb24gOiB2YWx1ZTtcbiAgICAgICAgdmVsb2NpdHkgPSAodmVsb2NpdHkgIT0gdW5kZWZpbmVkKSA/IHZlbG9jaXR5OiByYXRlO1xuICAgICAgICByZXR1cm4gY21kKHRoaXMuc3JjLnNyYykubW92ZSh7cG9zaXRpb24sIHZlbG9jaXR5LCB0aW1lc3RhbXB9KTtcbiAgICB9XG4gICAgdHJhbnNpdGlvbiAoe3RhcmdldCwgZHVyYXRpb24sIGVhc2luZ30pIHtcbiAgICAgICAgbGV0IHt2YWx1ZTp2MCwgb2Zmc2V0OnQwfSA9IHRoaXMucXVlcnkoKTtcbiAgICAgICAgaWYgKHR5cGVvZiB2MCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3Vyc29yIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7djB9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzLnNyYy5zcmMpLnRyYW5zaXRpb24odjAsIHRhcmdldCwgdDAsIHQwICsgZHVyYXRpb24sIGVhc2luZyk7XG4gICAgfVxuICAgIGludGVycG9sYXRlICh7dHVwbGVzLCBkdXJhdGlvbn0pIHtcbiAgICAgICAgbGV0IHQwID0gdGhpcy5xdWVyeSgpLm9mZnNldDtcbiAgICAgICAgLy8gYXNzdW1pbmcgdGltc3RhbXBzIGFyZSBpbiByYW5nZSBbMCwxXVxuICAgICAgICAvLyBzY2FsZSB0aW1lc3RhbXBzIHRvIGR1cmF0aW9uXG4gICAgICAgIHR1cGxlcyA9IHR1cGxlcy5tYXAoKFt2LHRdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3YsIHQwICsgdCpkdXJhdGlvbl07XG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiBjbWQodGhpcy5zcmMuc3JjKS5pbnRlcnBvbGF0ZSh0dXBsZXMpO1xuICAgIH1cblxufVxuc291cmNlLmFkZFRvUHJvdG90eXBlKEN1cnNvci5wcm90b3R5cGUsIFwic3JjXCIsIHttdXRhYmxlOnRydWV9KTtcbnNvdXJjZS5hZGRUb1Byb3RvdHlwZShDdXJzb3IucHJvdG90eXBlLCBcImN0cmxcIiwge211dGFibGU6dHJ1ZX0pO1xuXG4iXSwibmFtZXMiOlsiY2hlY2tfaW5wdXQiLCJpbnRlcnBvbGF0ZSIsInNlZ21lbnQuU3RhdGljU2VnbWVudCIsInNlZ21lbnQuVHJhbnNpdGlvblNlZ21lbnQiLCJzZWdtZW50LkludGVycG9sYXRpb25TZWdtZW50Iiwic2VnbWVudC5Nb3Rpb25TZWdtZW50Il0sIm1hcHBpbmdzIjoiOzs7OztDQUFBO0NBQ0E7Q0FDQTs7Q0FFQTs7Q0FFQTtDQUNBO0NBQ0E7Q0FD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LENBQUMsRUFBRTtDQUN0QyxZQUFZLElBQUksR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRztDQUMxQyxZQUFZLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDO0NBQ3JELFlBQVksTUFBTSxDQUFDLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsR0FBRyxTQUFTO0NBQ3ZGLFlBQVksTUFBTSxDQUFDLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEdBQUcsU0FBUztDQUN4RixZQUFZLE1BQU0sQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHO0NBQzdDLFNBQVMsTUFBTTtDQUNmLFlBQVksTUFBTSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSTtDQUNyQyxZQUFZLE1BQU0sQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLElBQUk7Q0FDdEM7Q0FDQSxZQUFZLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJO0NBQ2xDLFlBQVksR0FBRyxHQUFHLENBQUMsSUFBSSxJQUFJLFNBQVMsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQztDQUNuRixZQUFZLElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLO0NBQ3BDLFlBQVksSUFBSSxHQUFHLENBQUMsS0FBSyxJQUFJLFNBQVMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUM7Q0FD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
