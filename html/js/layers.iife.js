
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var LAYERS = (function (exports) {
    'use strict';

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
     * Create a single state from a list of states, using a stateFunc
     * states:{value, dynamic, offset}
     * 
     * 
     */

    function toState(states, valueFunc, offset) {
        if (states.length == 0) {
            return {value:undefined, dynamic:false, offset}
            /**
                TODO - do something with valueFunc
                const dynamic = states.map((v) => v.dynamic);
                const values = states.map((v) => v.value);
            
                For now - just return the first state
            */
        }
        let state = states[0];
        return {...state, offset}; 
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

    /*
        This decorates an object/prototype with basic (synchronous) callback support.
    */

    const PREFIX$1 = "__callback";

    function addToInstance$2(object) {
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

    function addToPrototype$2 (_prototype) {
        const api = {
            add_callback, remove_callback, notify_callbacks
        };
        Object.assign(_prototype, api);
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
            addToInstance$2(this);
        }
        now () {
            throw new Error("not implemented");
        }
    }
    addToPrototype$2(ClockProviderBase.prototype);


    /**
     * Base class for MotionProviders
     * 
     * This is a convenience class offering a simpler way
     * of implementing state provider which deal exclusively
     * with motion segments.
     * 
     * Motionproviders do not deal with items, but with simpler
     * statements of motion state
     * 
     * state = {
     *      position: 0,
     *      velocity: 0,
     *      acceleration: 0,
     *      timestamp: 0
     *      range: [undefined, undefined]
     * }
     * 
     * Internally, MotionProvider will be wrapped so that they
     * become proper StateProviders.
     */

    class MotionProviderBase {

        constructor(options={}) {
            addToInstance$2(this);
            let {state} = options;
            if (state = undefined) {
                this._state = {
                    position: 0,
                    velocity: 0,
                    acceleration: 0,
                    timestamp: 0,
                    range: [undefined, undefined]
                };
            } else {
                this._state = state;
            }
        }

        /**
         * set motion state
         * 
         * implementations of online motion providers will
         * use this to send an update request,
         * and set _state on response and then call notify_callbaks
         * If the proxy wants to set the state immediatedly - 
         * it should be done using a Promise - to break the control flow.
         * 
         * return Promise.resolve()
         *      .then(() => {
         *           this._state = state;
         *           this.notify_callbacks();
         *       });
         * 
         */
        set_state (state) {
            throw new Error("not implemented");
        }

        // return current motion state
        get_state () {
            return {...this._state};
        }
    }
    addToPrototype$2(MotionProviderBase.prototype);




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
            addToInstance$2(this);
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
    addToPrototype$2(StateProviderBase.prototype);


    /************************************************
     * LAYER BASE
     ************************************************/

    class LayerBase {

        constructor() {
            this._index;

            addToInstance$2(this);
            // define change event
            eventify.addToInstance(this);
            this.eventifyDefine("change", {init:true});
        }

        /**********************************************************
         * QUERY API
         **********************************************************/

        getQueryObject () {
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
            const cache = this.getQueryObject();
            return range(start[0], stop[0], step, {include_end:true})
                .map((offset) => {
                    return [cache.query(offset).value, offset];
                });
        }
    }
    addToPrototype$2(LayerBase.prototype);
    eventify.addToPrototype(LayerBase.prototype);


    /************************************************
     * CURSOR BASE
     ************************************************/

    class CursorBase {

        constructor () {
            addToInstance$2(this);
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
    addToPrototype$2(CursorBase.prototype);
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

    function addToInstance$1 (object, propName) {
        const p = propnames(propName);
        object[p.prop] = undefined;
        object[p.init] = false;
        object[p.handle] = undefined;
    }

    function addToPrototype$1 (_prototype, propName, options={}) {

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
                    src = this[p.check](src);
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

    function interpolate$1(tuples) {
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

    /************************************************
     * LAYER SOURCE INTERFACE
     ************************************************/

    /**
     * Decorate an object/prototype to implement 
     * the LayerSource interface.
     * 
     * - index
     * - valueFunc
     * - getCache
     * - clearCaches
     */

    const PREFIX = "__layersource";

    function addToInstance (object, options={}) {
        const {CacheClass, valueFunc} = options;
        object[`${PREFIX}_index`];
        object[`${PREFIX}_valueFunc`] = valueFunc;
        object[`${PREFIX}_cacheClass`] = CacheClass;
        object[`${PREFIX}_cache_objects`] = [];
    }

    function addToPrototype (_prototype) {

        Object.defineProperty(_prototype, "index", {
            get: function () {
                return this[`${PREFIX}_index`];
            }
        });
        Object.defineProperty(_prototype, "valueFunc", {
            get: function () {
                return this[`${PREFIX}_valueFunc`];
            }
        });

        function getCache () {
            const cache = new this[`${PREFIX}_cacheClass`](this);
            this[`${PREFIX}_cache_objects`].push(cache);
            return cache;
        }

        function clearCaches () {
            for (let cache of this[`${PREFIX}_cache_objects`]) {
                cache.clear();
            }
        }
        
        Object.assign(_prototype, {getCache, clearCaches});
    }

    /************************************************
     * LAYER
     ************************************************/

    /**
     * Layer is base class for Layers
     * defined by an index and a valueFunc
     */

    class Layer {

        constructor(cacheClass, valueFunc) {
            // callbacks
            addToInstance$2(this);
            // layer source api
            addToInstance(this, cacheClass);
            // define change event
            eventify.addToInstance(this);
            this.eventifyDefine("change", {init:true});
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
    addToPrototype$2(Layer.prototype);
    addToPrototype(Layer.prototype);
    eventify.addToPrototype(Layer.prototype);

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

        constructor(itv, tuples) {
            super(itv);
            // setup interpolation function
            this._trans = interpolate(tuples);
        }

        state(offset) {
            return {value: this._trans(offset), dynamic:true};
        }
    }

    /***************************************************************
        MOTION STATE PROVIDER
    ***************************************************************/

    /**
     * Wraps the simpler motion provider to ensure 
     * checking of state and implement the StateProvider 
     * interface.
     */

    class MotionStateProvider extends StateProviderBase {

        constructor(mp) {
            super();
            if (!(mp instanceof MotionProviderBase)) {
                throw new Error(`must be MotionProviderBase ${mp}`)
            }
            // motion provider
            this._mp = mp;
            // check initial state of motion provider
            this._mp._state = check_state(this._mp._state);
            // subscribe to callbacks
            this._mp.add_callback(this._handle_callback.bind(this));
        }

        _handle_callback() {
            // Forward callback from wrapped motion provider
            this.notify_callbacks();
        }

        /**
         * update motion state
         */

        update(items, options={}) {
            // TODO - items should be coverted to motion state
            let state = state_from_items(items);
            state = check_state(state);
            // forward updates to wrapped motion provider
            return this._mp.set_state(state);
        }

        get_state() {
            // resolve state from wrapped motion provider
            let state = this._mp.get_state();
            state = check_state(state);
            return items_from_state(state);
        }

        get info () {
            return {overlapping: false};
        }
    }


    /***************************************************************
        UTIL
    ***************************************************************/

    function check_state(state) {
        let {
            position=0, 
            velocity=0, 
            acceleration=0,
            timestamp=0,
            range=[undefined, undefined] 
        } = state || {};
        state = {
            position, 
            velocity,
            acceleration,
            timestamp,
            range
        };
        // vector values must be finite numbers
        const props = ["position", "velocity", "acceleration", "timestamp"];
        for (let prop of props) {
            let n = state[prop];
            if (!isFiniteNumber(n)) {
                throw new Error(`${prop} must be number ${n}`);
            }
        }

        // range values can be undefined or a number
        for (let n of range) {
            if (!(n == undefined || isFiniteNumber(n))) {
                throw new Error(`range value must be undefined or number ${n}`);
            }
        }
        let [low, high] = range;
        if (low != undefined && low != undefined) {
            if (low >= high) {
                throw new Error(`low > high [${low}, ${high}]`)
            } 
        }
        return {position, velocity, acceleration, timestamp, range};
    }

    function isFiniteNumber(n) {
        return (typeof n == "number") && isFinite(n);
    }

    /**
     * convert item list into motion state
     */

    function state_from_items(items) {
        // pick one item of motion type
        const item = items.find((item) => {
            return item.type == "motion";
        });
        if (item != undefined) {
            return item.data;
        }
    }

    /**
     * convert motion state into items list
     */

    function items_from_state (state) {
        // motion segment for calculation
        let [low, high] = state.range;
        const seg = new MotionSegment([low, high, true, true], state);
        const {value:value_low} = seg.state(low);
        const {value:value_high} = seg.state(high);

        // set up items
        if (low == undefined && high == undefined) {
            return [{
                itv:[-Infinity, Infinity, true, true], 
                type: "motion",
                args: state
            }];
        } else if (low == undefined) {
            return [
                {
                    itv:[-Infinity, high, true, true], 
                    type: "motion",
                    args: state
                },
                {
                    itv:[high, Infinity, false, true], 
                    type: "static",
                    args: value_high
                },
            ];
        } else if (high == undefined) {
            return [
                {
                    itv:[-Infinity, low, true, false], 
                    type: "static",
                    args: value_low
                },
                {
                    itv:[low, Infinity, true, true], 
                    type: "motion",
                    args: state
                },
            ];
        } else {
            return [
                {
                    itv:[-Infinity, low, true, false], 
                    type: "static",
                    args: value_low
                },
                {
                    itv:[low, high, true, true], 
                    type: "motion",
                    args: state
                },
                {
                    itv:[high, Infinity, false, true], 
                    type: "static",
                    args: value_high
                },
            ];
        }
    }

    /************************************************
     * LOCAL CLOCK PROVIDER
     ************************************************/

    class LocalClockProvider extends ClockProviderBase {
        now () {
            return CLOCK.now();
        }
    }
    const localClockProvider = new LocalClockProvider();



    /************************************************
     * CURSOR
     ************************************************/

    /**
     * 
     * Cursor is a variable
     * - has mutable ctrl cursor (default LocalClockProvider)
     * - has mutable state provider (src) (default state undefined)
     * - methods for assign, move, transition, intepolation
     * 
     */

    class Cursor extends CursorBase {

        constructor (options={}) {
            super();
            // ctrl
            addToInstance$1(this, "ctrl");
            // src
            addToInstance$1(this, "src");
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
            this.ctrl = ctrl || localClockProvider;
            // initialise src
            this.src = src || new LocalStateProvider(opts);
        }

        /**********************************************************
         * CTRL (cursor)
         **********************************************************/

        __ctrl_check(ctrl) {
            if (ctrl instanceof ClockProviderBase) {
                return ctrl;
            } else if (ctrl instanceof CursorBase) {
                return ctrl;
            } else {
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
            if (src instanceof StateProviderBase) {
                return new Layer({src});
            } else if (src instanceof Layer) {
                return src;
            } else  if (src instanceof MotionProviderBase) {
                src = new MotionStateProvider(src);
                return new Layer({src});
            } else {
                throw new Error(`"src" must be Layer ${src}`);
            }
        }    
        __src_handle_change(reason) {
            this.__handle_change("src", reason);
        }

        /**********************************************************
         * CALLBACK
         **********************************************************/

        __handle_change(origin, msg) {
            clearTimeout(this._tid);
            clearInterval(this._pid);
            if (this.src && this.ctrl) {
                if (origin == "src") {
                    if (this._cache == undefined) {
                        this._cache = this.src.getQueryObject();
                    }
                }
                if (origin == "src" || origin == "ctrl") {
                    this._cache.clear();
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
                // TODO - protect against non-float values
                if (typeof state.value !== 'number') {
                    throw new Error(`warning: ctrl state must be number ${state.value}`);
                }
                return state;
            }
        }

        query () {
            const offset = this._get_ctrl_state().value;  
            return this._cache.query(offset);
        }

        get value () {return this.query().value};
        get index () {return this.src.index};

        /**********************************************************
         * UPDATE API
         **********************************************************/

        assign(value) {
            return cmd(this.src.src.src).assign(value);
        }
        move ({position, velocity}) {
            let {value, offset:timestamp} = this.query();
            if (typeof value !== 'number') {
                throw new Error(`warning: cursor state must be number ${value}`);
            }
            position = (position != undefined) ? position : value;
            velocity = (velocity != undefined) ? velocity: 0;
            return cmd(this.src.src.src).move({position, velocity, timestamp});
        }
        transition ({target, duration, easing}) {
            let {value:v0, offset:t0} = this.query();
            if (typeof v0 !== 'number') {
                throw new Error(`warning: cursor state must be number ${v0}`);
            }
            return cmd(this.src.src.src).transition(v0, target, t0, t0 + duration, easing);
        }
        interpolate ({tuples, duration}) {
            let t0 = this.query().offset;
            // assuming timstamps are in range [0,1]
            // scale timestamps to duration
            tuples = tuples.map(([v,t]) => {
                return [v, t0 + t*duration];
            });
            return cmd(this.src.src.src).interpolate(tuples);
        }

    }
    addToPrototype$1(Cursor.prototype, "src", {mutable:true});
    addToPrototype$1(Cursor.prototype, "ctrl", {mutable:true});

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
     * Returns a Layer representing a layer
     * representing the merging of sources.
     */


    function merge (sources, valueFunc) {

        const index = new MergeIndex(sources);

        // create layer
        return new Layer({index, valueFunc});
    }






    function cmp_ascending(p1, p2) {
        return endpoint.cmp(p1, p2)
    }

    function cmp_descending(p1, p2) {
        return endpoint.cmp(p2, p1)
    }

    /**
     * Merging indexes from multiple sources into a single index.
     * 
     * A source is an object with an index.
     * - layer
     * - datasource
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

    class MergeIndex extends NearbyIndexBase {

        constructor(sources) {
            super();
            this._sources = sources;
        }

        nearby(offset) {
            // accumulate nearby from all sources
            const prev_list = [], center_list = [], next_list = [];
            for (let src of this._sources) {
                let {itv, prev, center, next} = src.index.nearby(offset);
                if (prev != undefined) prev_list.push(prev);            
                if (next != undefined) next_list.push(next);
                if (center > 0) {
                    center_list.push({itv, src});
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
                result.next = min_next_low;
                result.left = max_prev_high;
                result.prev = max_prev_high;

            } else {

                // non-empty center

                // center high
                let center_high_list = center_list.map((item) => {
                    return endpoint.from_interval(item.itv)[1];
                }).sort(cmp_ascending);
                let min_center_high = center_high_list[0];
                let max_center_high = center_high_list.slice(-1)[0];
                let multiple_center_high = !endpoint.eq(min_center_high, max_center_high);

                // center low
                let center_low_list = center_list.map((item) => {
                    return endpoint.from_interval(item.itv)[0]
                }).sort(cmp_descending);
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

            // switch to undefined
            if (result.prev[0] == -Infinity) {
                result.prev = undefined;
            }
            if (result.left[0] == -Infinity) {
                result.left = undefined;
            }
            if (result.next[0] == Infinity) {
                result.next = undefined;
            }
            if (result.right[0] == Infinity) {
                result.right = undefined;
            }

            return result;
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
            let items = this._src.get_items();
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

    class InputLayer extends Layer {

        constructor(options={}) {
            let {src, valueFunc, ...opts} = options;
            super(InputLayerCache, valueFunc);
            // src
            addToInstance$1(this, "src");

            // initialise with stateprovider
            if (src == undefined) {
                src = new LocalStateProvider(opts);
            }        
            this.src = src;
        }


        /**********************************************************
         * SRC (stateprovider)
         **********************************************************/

        __src_check(src) {
            if (!(src instanceof StateProviderBase)) {
                throw new Error(`"src" must be state provider ${src}`);
            }
            return src;
        }    
        __src_handle_change() {
            if (this._index == undefined) {
                console.log("set index");
                this._index = new NearbyIndexSimple(this.src);
            } else {
                this.clearCaches();
            }
            this.notify_callbacks();
            // trigger change event for cursor
            this.eventifyTrigger("change");   
        }



    }
    addToPrototype$1(InputLayer.prototype, "src", {mutable:true});


    /*********************************************************************
        INPUTLAYER CACHE
    *********************************************************************/

    /*
        This implements a cache in front of a StateProvider    
        - index contains segment items
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
            // check cache
            if (
                this._nearby == undefined ||
                !interval.covers_point(this._nearby.itv, offset)
            ) {
                // cache miss
                this._nearby = this._layer.index.nearby(offset);
                let {itv, center} = this._nearby;
                this._segments = center.map((item) => {
                    return create_segment(itv, item);
                });
            }
            // query
            const states = this._segments.map((seg) => {
                return seg.query(offset);
            });
            return toState(states, this._layer.valueFunc)
        }

        clear() {
            this._nearby = undefined;
            this._segment = undefined;
        }
    }

    /*********************************************************************
        LOAD SEGMENT
    *********************************************************************/

    function create_segment(itv, item) {
        let {type, data} = item;
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

    exports.Cursor = Cursor;
    exports.InputLayer = InputLayer;
    exports.cmd = cmd;
    exports.merge = merge;

    return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsLmpzIiwiLi4vLi4vc3JjL2V2ZW50aWZ5LmpzIiwiLi4vLi4vc3JjL21vbml0b3IuanMiLCIuLi8uLi9zcmMvaW50ZXJ2YWxzLmpzIiwiLi4vLi4vc3JjL2FwaV9jYWxsYmFjay5qcyIsIi4uLy4uL3NyYy9iYXNlcy5qcyIsIi4uLy4uL3NyYy9zb3VyY2Vwcm9wLmpzIiwiLi4vLi4vc3JjL2NtZC5qcyIsIi4uLy4uL3NyYy9hcGlfbGF5ZXJzb3VyY2UuanMiLCIuLi8uLi9zcmMvbmV3bGF5ZXIuanMiLCIuLi8uLi9zcmMvc3RhdGVwcm92aWRlcl9zaW1wbGUuanMiLCIuLi8uLi9zcmMvc2VnbWVudHMuanMiLCIuLi8uLi9zcmMvc3RhdGVwcm92aWRlcl9tb3Rpb24uanMiLCIuLi8uLi9zcmMvY3Vyc29ycy5qcyIsIi4uLy4uL3NyYy9uZWFyYnlpbmRleC5qcyIsIi4uLy4uL3NyYy9vcHMvbWVyZ2UuanMiLCIuLi8uLi9zcmMvbmVhcmJ5aW5kZXhfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL2lucHV0X2xheWVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIENMT0NLU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIGNsb2NrcyBjb3VudGluZyBpbiBzZWNvbmRzXG4gKi9cblxuY29uc3QgbG9jYWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHBlcmZvcm1hbmNlLm5vdygpLzEwMDAuMDtcbn1cblxuY29uc3QgZXBvY2ggPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyBEYXRlKCkvMTAwMC4wO1xufVxuXG4vKipcbiAqIHRoZSBjbG9jayBnaXZlcyBlcG9jaCB2YWx1ZXMsIGJ1dCBpcyBpbXBsZW1lbnRlZFxuICogdXNpbmcgYSBoaWdoIHBlcmZvcm1hbmNlIGxvY2FsIGNsb2NrIGZvciBiZXR0ZXJcbiAqIHRpbWUgcmVzb2x1dGlvbiBhbmQgcHJvdGVjdGlvbiBhZ2FpbnN0IHN5c3RlbSBcbiAqIHRpbWUgYWRqdXN0bWVudHMuXG4gKi9cblxuZXhwb3J0IGNvbnN0IENMT0NLID0gZnVuY3Rpb24gKCkge1xuICAgIGNvbnN0IHQwX2xvY2FsID0gbG9jYWwoKTtcbiAgICBjb25zdCB0MF9lcG9jaCA9IGVwb2NoKCk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgbm93OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdDBfZXBvY2ggKyAobG9jYWwoKSAtIHQwX2xvY2FsKVxuICAgICAgICB9XG4gICAgfVxufSgpO1xuXG5cbi8vIG92dmVycmlkZSBtb2R1bG8gdG8gYmVoYXZlIGJldHRlciBmb3IgbmVnYXRpdmUgbnVtYmVyc1xuZXhwb3J0IGZ1bmN0aW9uIG1vZChuLCBtKSB7XG4gICAgcmV0dXJuICgobiAlIG0pICsgbSkgJSBtO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRpdm1vZCh4LCBiYXNlKSB7XG4gICAgbGV0IG4gPSBNYXRoLmZsb29yKHggLyBiYXNlKVxuICAgIGxldCByID0gbW9kKHgsIGJhc2UpO1xuICAgIHJldHVybiBbbiwgcl07XG59XG5cblxuLypcbiAgICBzaW1pbGFyIHRvIHJhbmdlIGZ1bmN0aW9uIGluIHB5dGhvblxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmdlIChzdGFydCwgZW5kLCBzdGVwID0gMSwgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgIGNvbnN0IHtpbmNsdWRlX2VuZD1mYWxzZX0gPSBvcHRpb25zO1xuICAgIGlmIChzdGVwID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU3RlcCBjYW5ub3QgYmUgemVyby4nKTtcbiAgICB9XG4gICAgaWYgKHN0YXJ0IDwgZW5kKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSBzdGVwKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goaSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHN0YXJ0ID4gZW5kKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA+IGVuZDsgaSAtPSBzdGVwKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goaSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGluY2x1ZGVfZW5kKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGVuZCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cblxuLyoqXG4gKiBDcmVhdGUgYSBzaW5nbGUgc3RhdGUgZnJvbSBhIGxpc3Qgb2Ygc3RhdGVzLCB1c2luZyBhIHN0YXRlRnVuY1xuICogc3RhdGVzOnt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0fVxuICogXG4gKiBcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gdG9TdGF0ZShzdGF0ZXMsIHZhbHVlRnVuYywgb2Zmc2V0KSB7XG4gICAgaWYgKHN0YXRlcy5sZW5ndGggPT0gMCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOnVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fVxuICAgICAgICAvKipcbiAgICAgICAgICAgIFRPRE8gLSBkbyBzb21ldGhpbmcgd2l0aCB2YWx1ZUZ1bmNcbiAgICAgICAgICAgIGNvbnN0IGR5bmFtaWMgPSBzdGF0ZXMubWFwKCh2KSA9PiB2LmR5bmFtaWMpO1xuICAgICAgICAgICAgY29uc3QgdmFsdWVzID0gc3RhdGVzLm1hcCgodikgPT4gdi52YWx1ZSk7XG4gICAgICAgIFxuICAgICAgICAgICAgRm9yIG5vdyAtIGp1c3QgcmV0dXJuIHRoZSBmaXJzdCBzdGF0ZVxuICAgICAgICAqL1xuICAgIH1cbiAgICBsZXQgc3RhdGUgPSBzdGF0ZXNbMF07XG4gICAgcmV0dXJuIHsuLi5zdGF0ZSwgb2Zmc2V0fTsgXG59IiwiLypcblx0Q29weXJpZ2h0IDIwMjBcblx0QXV0aG9yIDogSW5nYXIgQXJudHplblxuXG5cdFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUaW1pbmdzcmMgbW9kdWxlLlxuXG5cdFRpbWluZ3NyYyBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG5cdGl0IHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieVxuXHR0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvclxuXHQoYXQgeW91ciBvcHRpb24pIGFueSBsYXRlciB2ZXJzaW9uLlxuXG5cdFRpbWluZ3NyYyBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLFxuXHRidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7IHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZlxuXHRNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG5cdEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuXG5cdFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZVxuXHRhbG9uZyB3aXRoIFRpbWluZ3NyYy4gIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiovXG5cblxuXG4vKlxuXHRFdmVudFxuXHQtIG5hbWU6IGV2ZW50IG5hbWVcblx0LSBwdWJsaXNoZXI6IHRoZSBvYmplY3Qgd2hpY2ggZGVmaW5lZCB0aGUgZXZlbnRcblx0LSBpbml0OiB0cnVlIGlmIHRoZSBldmVudCBzdXBwcG9ydHMgaW5pdCBldmVudHNcblx0LSBzdWJzY3JpcHRpb25zOiBzdWJzY3JpcHRpbnMgdG8gdGhpcyBldmVudFxuXG4qL1xuXG5jbGFzcyBFdmVudCB7XG5cblx0Y29uc3RydWN0b3IgKHB1Ymxpc2hlciwgbmFtZSwgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5wdWJsaXNoZXIgPSBwdWJsaXNoZXI7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gZmFsc2UgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zID0gW107XG5cdH1cblxuXHQvKlxuXHRcdHN1YnNjcmliZSB0byBldmVudFxuXHRcdC0gc3Vic2NyaWJlcjogc3Vic2NyaWJpbmcgb2JqZWN0XG5cdFx0LSBjYWxsYmFjazogY2FsbGJhY2sgZnVuY3Rpb24gdG8gaW52b2tlXG5cdFx0LSBvcHRpb25zOlxuXHRcdFx0aW5pdDogaWYgdHJ1ZSBzdWJzY3JpYmVyIHdhbnRzIGluaXQgZXZlbnRzXG5cdCovXG5cdHN1YnNjcmliZSAoY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRpZiAoIWNhbGxiYWNrIHx8IHR5cGVvZiBjYWxsYmFjayAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayBub3QgYSBmdW5jdGlvblwiLCBjYWxsYmFjayk7XG5cdFx0fVxuXHRcdGNvbnN0IHN1YiA9IG5ldyBTdWJzY3JpcHRpb24odGhpcywgY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5wdXNoKHN1Yik7XG5cdCAgICAvLyBJbml0aWF0ZSBpbml0IGNhbGxiYWNrIGZvciB0aGlzIHN1YnNjcmlwdGlvblxuXHQgICAgaWYgKHRoaXMuaW5pdCAmJiBzdWIuaW5pdCkge1xuXHQgICAgXHRzdWIuaW5pdF9wZW5kaW5nID0gdHJ1ZTtcblx0ICAgIFx0bGV0IHNlbGYgPSB0aGlzO1xuXHQgICAgXHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgIFx0XHRjb25zdCBlQXJncyA9IHNlbGYucHVibGlzaGVyLmV2ZW50aWZ5SW5pdEV2ZW50QXJncyhzZWxmLm5hbWUpIHx8IFtdO1xuXHQgICAgXHRcdHN1Yi5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0ICAgIFx0XHRmb3IgKGxldCBlQXJnIG9mIGVBcmdzKSB7XG5cdCAgICBcdFx0XHRzZWxmLnRyaWdnZXIoZUFyZywgW3N1Yl0sIHRydWUpO1xuXHQgICAgXHRcdH1cblx0ICAgIFx0fSk7XG5cdCAgICB9XG5cdFx0cmV0dXJuIHN1YlxuXHR9XG5cblx0Lypcblx0XHR0cmlnZ2VyIGV2ZW50XG5cblx0XHQtIGlmIHN1YiBpcyB1bmRlZmluZWQgLSBwdWJsaXNoIHRvIGFsbCBzdWJzY3JpcHRpb25zXG5cdFx0LSBpZiBzdWIgaXMgZGVmaW5lZCAtIHB1Ymxpc2ggb25seSB0byBnaXZlbiBzdWJzY3JpcHRpb25cblx0Ki9cblx0dHJpZ2dlciAoZUFyZywgc3VicywgaW5pdCkge1xuXHRcdGxldCBlSW5mbywgY3R4O1xuXHRcdGZvciAoY29uc3Qgc3ViIG9mIHN1YnMpIHtcblx0XHRcdC8vIGlnbm9yZSB0ZXJtaW5hdGVkIHN1YnNjcmlwdGlvbnNcblx0XHRcdGlmIChzdWIudGVybWluYXRlZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGVJbmZvID0ge1xuXHRcdFx0XHRzcmM6IHRoaXMucHVibGlzaGVyLFxuXHRcdFx0XHRuYW1lOiB0aGlzLm5hbWUsXG5cdFx0XHRcdHN1Yjogc3ViLFxuXHRcdFx0XHRpbml0OiBpbml0XG5cdFx0XHR9XG5cdFx0XHRjdHggPSBzdWIuY3R4IHx8IHRoaXMucHVibGlzaGVyO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0c3ViLmNhbGxiYWNrLmNhbGwoY3R4LCBlQXJnLCBlSW5mbyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYEVycm9yIGluICR7dGhpcy5uYW1lfTogJHtzdWIuY2FsbGJhY2t9ICR7ZXJyfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qXG5cdHVuc3Vic2NyaWJlIGZyb20gZXZlbnRcblx0LSB1c2Ugc3Vic2NyaXB0aW9uIHJldHVybmVkIGJ5IHByZXZpb3VzIHN1YnNjcmliZVxuXHQqL1xuXHR1bnN1YnNjcmliZShzdWIpIHtcblx0XHRsZXQgaWR4ID0gdGhpcy5zdWJzY3JpcHRpb25zLmluZGV4T2Yoc3ViKTtcblx0XHRpZiAoaWR4ID4gLTEpIHtcblx0XHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdHN1Yi50ZXJtaW5hdGUoKTtcblx0XHR9XG5cdH1cbn1cblxuXG4vKlxuXHRTdWJzY3JpcHRpb24gY2xhc3NcbiovXG5cbmNsYXNzIFN1YnNjcmlwdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoZXZlbnQsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLmV2ZW50ID0gZXZlbnQ7XG5cdFx0dGhpcy5uYW1lID0gZXZlbnQubmFtZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2tcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gdGhpcy5ldmVudC5pbml0IDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gZmFsc2U7XG5cdFx0dGhpcy5jdHggPSBvcHRpb25zLmN0eDtcblx0fVxuXG5cdHRlcm1pbmF0ZSgpIHtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSB0cnVlO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5ldmVudC51bnN1YnNjcmliZSh0aGlzKTtcblx0fVxufVxuXG5cbi8qXG5cblx0RVZFTlRJRlkgSU5TVEFOQ0VcblxuXHRFdmVudGlmeSBicmluZ3MgZXZlbnRpbmcgY2FwYWJpbGl0aWVzIHRvIGFueSBvYmplY3QuXG5cblx0SW4gcGFydGljdWxhciwgZXZlbnRpZnkgc3VwcG9ydHMgdGhlIGluaXRpYWwtZXZlbnQgcGF0dGVybi5cblx0T3B0LWluIGZvciBpbml0aWFsIGV2ZW50cyBwZXIgZXZlbnQgdHlwZS5cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlJbnN0YW5jZSAob2JqZWN0KSB7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwID0gbmV3IE1hcCgpO1xuXHRvYmplY3QuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0cmV0dXJuIG9iamVjdDtcbn07XG5cblxuLypcblx0RVZFTlRJRlkgUFJPVE9UWVBFXG5cblx0QWRkIGV2ZW50aWZ5IGZ1bmN0aW9uYWxpdHkgdG8gcHJvdG90eXBlIG9iamVjdFxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5UHJvdG90eXBlKF9wcm90b3R5cGUpIHtcblxuXHRmdW5jdGlvbiBldmVudGlmeUdldEV2ZW50KG9iamVjdCwgbmFtZSkge1xuXHRcdGNvbnN0IGV2ZW50ID0gb2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAuZ2V0KG5hbWUpO1xuXHRcdGlmIChldmVudCA9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IHVuZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0cmV0dXJuIGV2ZW50O1xuXHR9XG5cblx0Lypcblx0XHRERUZJTkUgRVZFTlRcblx0XHQtIHVzZWQgb25seSBieSBldmVudCBzb3VyY2Vcblx0XHQtIG5hbWU6IG5hbWUgb2YgZXZlbnRcblx0XHQtIG9wdGlvbnM6IHtpbml0OnRydWV9IHNwZWNpZmllcyBpbml0LWV2ZW50IHNlbWFudGljcyBmb3IgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlEZWZpbmUobmFtZSwgb3B0aW9ucykge1xuXHRcdC8vIGNoZWNrIHRoYXQgZXZlbnQgZG9lcyBub3QgYWxyZWFkeSBleGlzdFxuXHRcdGlmICh0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuaGFzKG5hbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCBhbHJlYWR5IGRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5zZXQobmFtZSwgbmV3IEV2ZW50KHRoaXMsIG5hbWUsIG9wdGlvbnMpKTtcblx0fTtcblxuXHQvKlxuXHRcdE9OXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRyZWdpc3RlciBjYWxsYmFjayBvbiBldmVudC5cblx0Ki9cblx0ZnVuY3Rpb24gb24obmFtZSwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpYmUoY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T0ZGXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRVbi1yZWdpc3RlciBhIGhhbmRsZXIgZnJvbSBhIHNwZWNmaWMgZXZlbnQgdHlwZVxuXHQqL1xuXHRmdW5jdGlvbiBvZmYoc3ViKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgc3ViLm5hbWUpLnVuc3Vic2NyaWJlKHN1Yik7XG5cdH07XG5cblxuXHRmdW5jdGlvbiBldmVudGlmeVN1YnNjcmlwdGlvbnMobmFtZSkge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmlwdGlvbnM7XG5cdH1cblxuXG5cblx0Lypcblx0XHRUcmlnZ2VyIGxpc3Qgb2YgZXZlbnRJdGVtcyBvbiBvYmplY3RcblxuXHRcdGV2ZW50SXRlbTogIHtuYW1lOi4uLCBlQXJnOi4ufVxuXG5cdFx0Y29weSBhbGwgZXZlbnRJdGVtcyBpbnRvIGJ1ZmZlci5cblx0XHRyZXF1ZXN0IGVtcHR5aW5nIHRoZSBidWZmZXIsIGkuZS4gYWN0dWFsbHkgdHJpZ2dlcmluZyBldmVudHMsXG5cdFx0ZXZlcnkgdGltZSB0aGUgYnVmZmVyIGdvZXMgZnJvbSBlbXB0eSB0byBub24tZW1wdHlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxsKGV2ZW50SXRlbXMpIHtcblx0XHRpZiAoZXZlbnRJdGVtcy5sZW5ndGggPT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIG1ha2UgdHJpZ2dlciBpdGVtc1xuXHRcdC8vIHJlc29sdmUgbm9uLXBlbmRpbmcgc3Vic2NyaXB0aW9ucyBub3dcblx0XHQvLyBlbHNlIHN1YnNjcmlwdGlvbnMgbWF5IGNoYW5nZSBmcm9tIHBlbmRpbmcgdG8gbm9uLXBlbmRpbmdcblx0XHQvLyBiZXR3ZWVuIGhlcmUgYW5kIGFjdHVhbCB0cmlnZ2VyaW5nXG5cdFx0Ly8gbWFrZSBsaXN0IG9mIFtldiwgZUFyZywgc3Vic10gdHVwbGVzXG5cdFx0bGV0IHRyaWdnZXJJdGVtcyA9IGV2ZW50SXRlbXMubWFwKChpdGVtKSA9PiB7XG5cdFx0XHRsZXQge25hbWUsIGVBcmd9ID0gaXRlbTtcblx0XHRcdGxldCBldiA9IGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSk7XG5cdFx0XHRsZXQgc3VicyA9IGV2LnN1YnNjcmlwdGlvbnMuZmlsdGVyKHN1YiA9PiBzdWIuaW5pdF9wZW5kaW5nID09IGZhbHNlKTtcblx0XHRcdHJldHVybiBbZXYsIGVBcmcsIHN1YnNdO1xuXHRcdH0sIHRoaXMpO1xuXG5cdFx0Ly8gYXBwZW5kIHRyaWdnZXIgSXRlbXMgdG8gYnVmZmVyXG5cdFx0Y29uc3QgbGVuID0gdHJpZ2dlckl0ZW1zLmxlbmd0aDtcblx0XHRjb25zdCBidWYgPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyO1xuXHRcdGNvbnN0IGJ1Zl9sZW4gPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aDtcblx0XHQvLyByZXNlcnZlIG1lbW9yeSAtIHNldCBuZXcgbGVuZ3RoXG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGggPSBidWZfbGVuICsgbGVuO1xuXHRcdC8vIGNvcHkgdHJpZ2dlckl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGZvciAobGV0IGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0YnVmW2J1Zl9sZW4raV0gPSB0cmlnZ2VySXRlbXNbaV07XG5cdFx0fVxuXHRcdC8vIHJlcXVlc3QgZW1wdHlpbmcgb2YgdGhlIGJ1ZmZlclxuXHRcdGlmIChidWZfbGVuID09IDApIHtcblx0XHRcdGxldCBzZWxmID0gdGhpcztcblx0XHRcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGZvciAobGV0IFtldiwgZUFyZywgc3Vic10gb2Ygc2VsZi5fX2V2ZW50aWZ5X2J1ZmZlcikge1xuXHRcdFx0XHRcdC8vIGFjdHVhbCBldmVudCB0cmlnZ2VyaW5nXG5cdFx0XHRcdFx0ZXYudHJpZ2dlcihlQXJnLCBzdWJzLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZi5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIG11bHRpcGxlIGV2ZW50cyBvZiBzYW1lIHR5cGUgKG5hbWUpXG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsaWtlKG5hbWUsIGVBcmdzKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKGVBcmdzLm1hcChlQXJnID0+IHtcblx0XHRcdHJldHVybiB7bmFtZSwgZUFyZ307XG5cdFx0fSkpO1xuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIHNpbmdsZSBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXIobmFtZSwgZUFyZykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChbe25hbWUsIGVBcmd9XSk7XG5cdH1cblxuXHRfcHJvdG90eXBlLmV2ZW50aWZ5RGVmaW5lID0gZXZlbnRpZnlEZWZpbmU7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyID0gZXZlbnRpZnlUcmlnZ2VyO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsaWtlID0gZXZlbnRpZnlUcmlnZ2VyQWxpa2U7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxsID0gZXZlbnRpZnlUcmlnZ2VyQWxsO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5U3Vic2NyaXB0aW9ucyA9IGV2ZW50aWZ5U3Vic2NyaXB0aW9ucztcblx0X3Byb3RvdHlwZS5vbiA9IG9uO1xuXHRfcHJvdG90eXBlLm9mZiA9IG9mZjtcbn07XG5cblxuZXhwb3J0IGNvbnN0IGV2ZW50aWZ5ID0gZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4ge1xuXHRcdGFkZFRvSW5zdGFuY2U6IGV2ZW50aWZ5SW5zdGFuY2UsXG5cdFx0YWRkVG9Qcm90b3R5cGU6IGV2ZW50aWZ5UHJvdG90eXBlXG5cdH1cbn0oKTtcblxuLypcblx0RXZlbnQgVmFyaWFibGVcblxuXHRPYmplY3RzIHdpdGggYSBzaW5nbGUgXCJjaGFuZ2VcIiBldmVudFxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50VmFyaWFibGUge1xuXG5cdGNvbnN0cnVjdG9yICh2YWx1ZSkge1xuXHRcdGV2ZW50aWZ5SW5zdGFuY2UodGhpcyk7XG5cdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHR0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcblx0fVxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5fdmFsdWV9O1xuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlICE9IHRoaXMuX3ZhbHVlKSB7XG5cdFx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuZXZlbnRpZnlQcm90b3R5cGUoRXZlbnRWYXJpYWJsZS5wcm90b3R5cGUpO1xuXG4vKlxuXHRFdmVudCBCb29sZWFuXG5cblxuXHROb3RlIDogaW1wbGVtZW50YXRpb24gdXNlcyBmYWxzaW5lc3Mgb2YgaW5wdXQgcGFyYW1ldGVyIHRvIGNvbnN0cnVjdG9yIGFuZCBzZXQoKSBvcGVyYXRpb24sXG5cdHNvIGV2ZW50Qm9vbGVhbigtMSkgd2lsbCBhY3R1YWxseSBzZXQgaXQgdG8gdHJ1ZSBiZWNhdXNlXG5cdCgtMSkgPyB0cnVlIDogZmFsc2UgLT4gdHJ1ZSAhXG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRCb29sZWFuIGV4dGVuZHMgRXZlbnRWYXJpYWJsZSB7XG5cdGNvbnN0cnVjdG9yKHZhbHVlKSB7XG5cdFx0c3VwZXIoQm9vbGVhbih2YWx1ZSkpO1xuXHR9XG5cblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdHN1cGVyLnZhbHVlID0gQm9vbGVhbih2YWx1ZSk7XG5cdH1cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gc3VwZXIudmFsdWV9O1xufVxuXG5cbi8qXG5cdG1ha2UgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gRXZlbnRCb29sZWFuIGNoYW5nZXNcblx0dmFsdWUuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQcm9taXNlKGV2ZW50T2JqZWN0LCBjb25kaXRpb25GdW5jKSB7XG5cdGNvbmRpdGlvbkZ1bmMgPSBjb25kaXRpb25GdW5jIHx8IGZ1bmN0aW9uKHZhbCkge3JldHVybiB2YWwgPT0gdHJ1ZX07XG5cdHJldHVybiBuZXcgUHJvbWlzZSAoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdGxldCBzdWIgPSBldmVudE9iamVjdC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdGlmIChjb25kaXRpb25GdW5jKHZhbHVlKSkge1xuXHRcdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHRcdFx0ZXZlbnRPYmplY3Qub2ZmKHN1Yik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufTtcblxuLy8gbW9kdWxlIGFwaVxuZXhwb3J0IGRlZmF1bHQge1xuXHRldmVudGlmeVByb3RvdHlwZSxcblx0ZXZlbnRpZnlJbnN0YW5jZSxcblx0RXZlbnRWYXJpYWJsZSxcblx0RXZlbnRCb29sZWFuLFxuXHRtYWtlUHJvbWlzZVxufTtcblxuIiwiaW1wb3J0IHtkaXZtb2R9IGZyb20gXCIuL3V0aWwuanNcIjtcblxuLypcbiAgICBUaW1lb3V0IE1vbml0b3JcblxuICAgIFRpbWVvdXQgTW9uaXRvciBpcyBzaW1pbGFyIHRvIHNldEludGVydmFsLCBpbiB0aGUgc2Vuc2UgdGhhdCBcbiAgICBpdCBhbGxvd3MgY2FsbGJhY2tzIHRvIGJlIGZpcmVkIHBlcmlvZGljYWxseSBcbiAgICB3aXRoIGEgZ2l2ZW4gZGVsYXkgKGluIG1pbGxpcykuICBcbiAgICBcbiAgICBUaW1lb3V0IE1vbml0b3IgaXMgbWFkZSB0byBzYW1wbGUgdGhlIHN0YXRlIFxuICAgIG9mIGEgZHluYW1pYyBvYmplY3QsIHBlcmlvZGljYWxseS4gRm9yIHRoaXMgcmVhc29uLCBlYWNoIGNhbGxiYWNrIGlzIFxuICAgIGJvdW5kIHRvIGEgbW9uaXRvcmVkIG9iamVjdCwgd2hpY2ggd2UgaGVyZSBjYWxsIGEgdmFyaWFibGUuIFxuICAgIE9uIGVhY2ggaW52b2NhdGlvbiwgYSBjYWxsYmFjayB3aWxsIHByb3ZpZGUgYSBmcmVzaGx5IHNhbXBsZWQgXG4gICAgdmFsdWUgZnJvbSB0aGUgdmFyaWFibGUuXG5cbiAgICBUaGlzIHZhbHVlIGlzIGFzc3VtZWQgdG8gYmUgYXZhaWxhYmxlIGJ5IHF1ZXJ5aW5nIHRoZSB2YXJpYWJsZS4gXG5cbiAgICAgICAgdi5xdWVyeSgpIC0+IHt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0LCB0c31cblxuICAgIEluIGFkZGl0aW9uLCB0aGUgdmFyaWFibGUgb2JqZWN0IG1heSBzd2l0Y2ggYmFjayBhbmQgXG4gICAgZm9ydGggYmV0d2VlbiBkeW5hbWljIGFuZCBzdGF0aWMgYmVoYXZpb3IuIFRoZSBUaW1lb3V0IE1vbml0b3JcbiAgICB0dXJucyBwb2xsaW5nIG9mZiB3aGVuIHRoZSB2YXJpYWJsZSBpcyBubyBsb25nZXIgZHluYW1pYywgXG4gICAgYW5kIHJlc3VtZXMgcG9sbGluZyB3aGVuIHRoZSBvYmplY3QgYmVjb21lcyBkeW5hbWljLlxuXG4gICAgU3RhdGUgY2hhbmdlcyBhcmUgZXhwZWN0ZWQgdG8gYmUgc2lnbmFsbGVkIHRocm91Z2ggYSA8Y2hhbmdlPiBldmVudC5cblxuICAgICAgICBzdWIgPSB2Lm9uKFwiY2hhbmdlXCIsIGNhbGxiYWNrKVxuICAgICAgICB2Lm9mZihzdWIpXG5cbiAgICBDYWxsYmFja3MgYXJlIGludm9rZWQgb24gZXZlcnkgPGNoYW5nZT4gZXZlbnQsIGFzIHdlbGxcbiAgICBhcyBwZXJpb2RpY2FsbHkgd2hlbiB0aGUgb2JqZWN0IGlzIGluIDxkeW5hbWljPiBzdGF0ZS5cblxuICAgICAgICBjYWxsYmFjayh7dmFsdWUsIGR5bmFtaWMsIG9mZnNldCwgdHN9KVxuXG4gICAgRnVydGhlcm1vcmUsIGluIG9yZGVyIHRvIHN1cHBvcnQgY29uc2lzdGVudCByZW5kZXJpbmcgb2ZcbiAgICBzdGF0ZSBjaGFuZ2VzIGZyb20gbWFueSBkeW5hbWljIHZhcmlhYmxlcywgaXQgaXMgaW1wb3J0YW50IHRoYXRcbiAgICBjYWxsYmFja3MgYXJlIGludm9rZWQgYXQgdGhlIHNhbWUgdGltZSBhcyBtdWNoIGFzIHBvc3NpYmxlLCBzb1xuICAgIHRoYXQgY2hhbmdlcyB0aGF0IG9jY3VyIG5lYXIgaW4gdGltZSBjYW4gYmUgcGFydCBvZiB0aGUgc2FtZVxuICAgIHNjcmVlbiByZWZyZXNoLiBcblxuICAgIEZvciB0aGlzIHJlYXNvbiwgdGhlIFRpbWVvdXRNb25pdG9yIGdyb3VwcyBjYWxsYmFja3MgaW4gdGltZVxuICAgIGFuZCBpbnZva2VzIGNhbGxiYWNrcyBhdCBhdCBmaXhlZCBtYXhpbXVtIHJhdGUgKDIwSHovNTBtcykuXG4gICAgVGhpcyBpbXBsaWVzIHRoYXQgcG9sbGluZyBjYWxsYmFja3Mgd2lsbCBmYWxsIG9uIGEgc2hhcmVkIFxuICAgIHBvbGxpbmcgZnJlcXVlbmN5LlxuXG4gICAgQXQgdGhlIHNhbWUgdGltZSwgY2FsbGJhY2tzIG1heSBoYXZlIGluZGl2aWR1YWwgZnJlcXVlbmNpZXMgdGhhdFxuICAgIGFyZSBtdWNoIGxvd2VyIHJhdGUgdGhhbiB0aGUgbWF4aW11bSByYXRlLiBUaGUgaW1wbGVtZW50YXRpb25cbiAgICBkb2VzIG5vdCByZWx5IG9uIGEgZml4ZWQgNTBtcyB0aW1lb3V0IGZyZXF1ZW5jeSwgYnV0IGlzIHRpbWVvdXQgYmFzZWQsXG4gICAgdGh1cyB0aGVyZSBpcyBubyBwcm9jZXNzaW5nIG9yIHRpbWVvdXQgYmV0d2VlbiBjYWxsYmFja3MsIGV2ZW5cbiAgICBpZiBhbGwgY2FsbGJhY2tzIGhhdmUgbG93IHJhdGVzLlxuXG4gICAgSXQgaXMgc2FmZSB0byBkZWZpbmUgbXVsdGlwbGUgY2FsbGFiYWNrcyBmb3IgYSBzaW5nbGUgdmFyaWFibGUsIGVhY2hcbiAgICBjYWxsYmFjayB3aXRoIGEgZGlmZmVyZW50IHBvbGxpbmcgZnJlcXVlbmN5LlxuXG4gICAgb3B0aW9uc1xuICAgICAgICA8cmF0ZT4gLSBkZWZhdWx0IDUwOiBzcGVjaWZ5IG1pbmltdW0gZnJlcXVlbmN5IGluIG1zXG5cbiovXG5cblxuY29uc3QgUkFURV9NUyA9IDUwXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRJTUVPVVQgTU9OSVRPUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIEJhc2UgY2xhc3MgZm9yIFRpbWVvdXQgTW9uaXRvciBhbmQgRnJhbWVyYXRlIE1vbml0b3JcbiovXG5cbmNsYXNzIFRpbWVvdXRNb25pdG9yIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcblxuICAgICAgICB0aGlzLl9vcHRpb25zID0gT2JqZWN0LmFzc2lnbih7cmF0ZTogUkFURV9NU30sIG9wdGlvbnMpO1xuICAgICAgICBpZiAodGhpcy5fb3B0aW9ucy5yYXRlIDwgUkFURV9NUykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbGxlZ2FsIHJhdGUgJHtyYXRlfSwgbWluaW11bSByYXRlIGlzICR7UkFURV9NU31gKTtcbiAgICAgICAgfVxuICAgICAgICAvKlxuICAgICAgICAgICAgbWFwXG4gICAgICAgICAgICBoYW5kbGUgLT4ge2NhbGxiYWNrLCB2YXJpYWJsZSwgZGVsYXl9XG4gICAgICAgICAgICAtIHZhcmlhYmxlOiB0YXJnZXQgZm9yIHNhbXBsaW5nXG4gICAgICAgICAgICAtIGNhbGxiYWNrOiBmdW5jdGlvbih2YWx1ZSlcbiAgICAgICAgICAgIC0gZGVsYXk6IGJldHdlZW4gc2FtcGxlcyAod2hlbiB2YXJpYWJsZSBpcyBkeW5hbWljKVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zZXQgPSBuZXcgU2V0KCk7XG4gICAgICAgIC8qXG4gICAgICAgICAgICB2YXJpYWJsZSBtYXBcbiAgICAgICAgICAgIHZhcmlhYmxlIC0+IHtzdWIsIHBvbGxpbmcsIGhhbmRsZXM6W119XG4gICAgICAgICAgICAtIHN1YiBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAgICAgICAgIC0gcG9sbGluZzogdHJ1ZSBpZiB2YXJpYWJsZSBuZWVkcyBwb2xsaW5nXG4gICAgICAgICAgICAtIGhhbmRsZXM6IGxpc3Qgb2YgaGFuZGxlcyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICAvLyB2YXJpYWJsZSBjaGFuZ2UgaGFuZGxlclxuICAgICAgICB0aGlzLl9fb252YXJpYWJsZWNoYW5nZSA9IHRoaXMuX29udmFyaWFibGVjaGFuZ2UuYmluZCh0aGlzKTtcbiAgICB9XG5cbiAgICBiaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICAgICAgLy8gcmVnaXN0ZXIgYmluZGluZ1xuICAgICAgICBsZXQgaGFuZGxlID0ge2NhbGxiYWNrLCB2YXJpYWJsZSwgZGVsYXl9O1xuICAgICAgICB0aGlzLl9zZXQuYWRkKGhhbmRsZSk7XG4gICAgICAgIC8vIHJlZ2lzdGVyIHZhcmlhYmxlXG4gICAgICAgIGlmICghdGhpcy5fdmFyaWFibGVfbWFwLmhhcyh2YXJpYWJsZSkpIHtcbiAgICAgICAgICAgIGxldCBzdWIgPSB2YXJpYWJsZS5vbihcImNoYW5nZVwiLCB0aGlzLl9fb252YXJpYWJsZWNoYW5nZSk7XG4gICAgICAgICAgICBsZXQgaXRlbSA9IHtzdWIsIHBvbGxpbmc6ZmFsc2UsIGhhbmRsZXM6IFtoYW5kbGVdfTtcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5zZXQodmFyaWFibGUsIGl0ZW0pO1xuICAgICAgICAgICAgLy90aGlzLl9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSkuaGFuZGxlcy5wdXNoKGhhbmRsZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhhbmRsZTtcbiAgICB9XG5cbiAgICByZWxlYXNlKGhhbmRsZSkge1xuICAgICAgICAvLyBjbGVhbnVwXG4gICAgICAgIGxldCByZW1vdmVkID0gdGhpcy5fc2V0LmRlbGV0ZShoYW5kbGUpO1xuICAgICAgICBpZiAoIXJlbW92ZWQpIHJldHVybjtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2xlYW51cCB2YXJpYWJsZSBtYXBcbiAgICAgICAgbGV0IHZhcmlhYmxlID0gaGFuZGxlLnZhcmlhYmxlO1xuICAgICAgICBsZXQge3N1YiwgaGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IGlkeCA9IGhhbmRsZXMuaW5kZXhPZihoYW5kbGUpO1xuICAgICAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgICAgIGhhbmRsZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhhbmRsZXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIC8vIHZhcmlhYmxlIGhhcyBubyBoYW5kbGVzXG4gICAgICAgICAgICAvLyBjbGVhbnVwIHZhcmlhYmxlIG1hcFxuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLmRlbGV0ZSh2YXJpYWJsZSk7XG4gICAgICAgICAgICB2YXJpYWJsZS5vZmYoc3ViKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHZhcmlhYmxlIGVtaXRzIGEgY2hhbmdlIGV2ZW50XG4gICAgKi9cbiAgICBfb252YXJpYWJsZWNoYW5nZSAoZUFyZywgZUluZm8pIHtcbiAgICAgICAgbGV0IHZhcmlhYmxlID0gZUluZm8uc3JjO1xuICAgICAgICAvLyBkaXJlY3QgY2FsbGJhY2sgLSBjb3VsZCB1c2UgZUFyZyBoZXJlXG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IHN0YXRlID0gZUFyZztcbiAgICAgICAgLy8gcmVldmFsdWF0ZSBwb2xsaW5nXG4gICAgICAgIHRoaXMuX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSwgc3RhdGUpO1xuICAgICAgICAvLyBjYWxsYmFja3NcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIGhhbmRsZS5jYWxsYmFjayhzdGF0ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBzdGFydCBvciBzdG9wIHBvbGxpbmcgaWYgbmVlZGVkXG4gICAgKi9cbiAgICBfcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlLCBzdGF0ZSkge1xuICAgICAgICBsZXQgaXRlbSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQge3BvbGxpbmc6d2FzX3BvbGxpbmd9ID0gaXRlbTtcbiAgICAgICAgc3RhdGUgPSBzdGF0ZSB8fCB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICBsZXQgc2hvdWxkX2JlX3BvbGxpbmcgPSBzdGF0ZS5keW5hbWljO1xuICAgICAgICBpZiAoIXdhc19wb2xsaW5nICYmIHNob3VsZF9iZV9wb2xsaW5nKSB7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXRzKHZhcmlhYmxlKTtcbiAgICAgICAgfSBlbHNlIGlmICh3YXNfcG9sbGluZyAmJiAhc2hvdWxkX2JlX3BvbGxpbmcpIHtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fY2xlYXJfdGltZW91dHModmFyaWFibGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgc2V0IHRpbWVvdXQgZm9yIGFsbCBjYWxsYmFja3MgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgKi9cbiAgICBfc2V0X3RpbWVvdXRzKHZhcmlhYmxlKSB7XG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc2V0X3RpbWVvdXQoaGFuZGxlKSB7XG4gICAgICAgIGxldCBkZWx0YSA9IHRoaXMuX2NhbGN1bGF0ZV9kZWx0YShoYW5kbGUuZGVsYXkpO1xuICAgICAgICBsZXQgaGFuZGxlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZV90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHNldFRpbWVvdXQoaGFuZGxlciwgZGVsdGEpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGFkanVzdCBkZWxheSBzbyB0aGF0IGlmIGZhbGxzIG9uXG4gICAgICAgIHRoZSBtYWluIHRpY2sgcmF0ZVxuICAgICovXG4gICAgX2NhbGN1bGF0ZV9kZWx0YShkZWxheSkge1xuICAgICAgICBsZXQgcmF0ZSA9IHRoaXMuX29wdGlvbnMucmF0ZTtcbiAgICAgICAgbGV0IG5vdyA9IE1hdGgucm91bmQocGVyZm9ybWFuY2Uubm93KCkpO1xuICAgICAgICBsZXQgW25vd19uLCBub3dfcl0gPSBkaXZtb2Qobm93LCByYXRlKTtcbiAgICAgICAgbGV0IFtuLCByXSA9IGRpdm1vZChub3cgKyBkZWxheSwgcmF0ZSk7XG4gICAgICAgIGxldCB0YXJnZXQgPSBNYXRoLm1heChuLCBub3dfbiArIDEpKnJhdGU7XG4gICAgICAgIHJldHVybiB0YXJnZXQgLSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBjbGVhciBhbGwgdGltZW91dHMgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgKi9cbiAgICBfY2xlYXJfdGltZW91dHModmFyaWFibGUpIHtcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgaWYgKGhhbmRsZS50aWQgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGhhbmRsZS50aWQpO1xuICAgICAgICAgICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBoYW5kbGUgdGltZW91dFxuICAgICovXG4gICAgX2hhbmRsZV90aW1lb3V0KGhhbmRsZSkge1xuICAgICAgICAvLyBkcm9wIGlmIGhhbmRsZSB0aWQgaGFzIGJlZW4gY2xlYXJlZFxuICAgICAgICBpZiAoaGFuZGxlLnRpZCA9PSB1bmRlZmluZWQpIHJldHVybjtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2FsbGJhY2tcbiAgICAgICAgbGV0IHt2YXJpYWJsZX0gPSBoYW5kbGU7XG4gICAgICAgIGxldCBzdGF0ZSA9IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgIC8vIHJlc2NoZWR1bGUgdGltZW91dHMgZm9yIGNhbGxiYWNrc1xuICAgICAgICBpZiAoc3RhdGUuZHluYW1pYykge1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgbWFrZSBzdXJlIHBvbGxpbmcgc3RhdGUgaXMgYWxzbyBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMgd291bGQgb25seSBvY2N1ciBpZiB0aGUgdmFyaWFibGVcbiAgICAgICAgICAgICAgICB3ZW50IGZyb20gcmVwb3J0aW5nIGR5bmFtaWMgdHJ1ZSB0byBkeW5hbWljIGZhbHNlLFxuICAgICAgICAgICAgICAgIHdpdGhvdXQgZW1taXR0aW5nIGEgY2hhbmdlIGV2ZW50IC0gdGh1c1xuICAgICAgICAgICAgICAgIHZpb2xhdGluZyB0aGUgYXNzdW1wdGlvbi4gVGhpcyBwcmVzZXJ2ZXNcbiAgICAgICAgICAgICAgICBpbnRlcm5hbCBpbnRlZ3JpdHkgaSB0aGUgbW9uaXRvci5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBsZXQgaXRlbSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy9cbiAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHN0YXRlKTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgRlJBTUVSQVRFIE1PTklUT1JcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuXG5jbGFzcyBGcmFtZXJhdGVNb25pdG9yIGV4dGVuZHMgVGltZW91dE1vbml0b3Ige1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgICAgdGhpcy5faGFuZGxlO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHRpbWVvdXRzIGFyZSBvYnNvbGV0ZVxuICAgICovXG4gICAgX3NldF90aW1lb3V0cyh2YXJpYWJsZSkge31cbiAgICBfc2V0X3RpbWVvdXQoaGFuZGxlKSB7fVxuICAgIF9jYWxjdWxhdGVfZGVsdGEoZGVsYXkpIHt9XG4gICAgX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKSB7fVxuICAgIF9oYW5kbGVfdGltZW91dChoYW5kbGUpIHt9XG5cbiAgICBfb252YXJpYWJsZWNoYW5nZSAoZUFyZywgZUluZm8pIHtcbiAgICAgICAgc3VwZXIuX29udmFyaWFibGVjaGFuZ2UoZUFyZywgZUluZm8pO1xuICAgICAgICAvLyBraWNrIG9mZiBjYWxsYmFjayBsb29wIGRyaXZlbiBieSByZXF1ZXN0IGFuaW1hdGlvbmZyYW1lXG4gICAgICAgIHRoaXMuX2NhbGxiYWNrKCk7XG4gICAgfVxuXG4gICAgX2NhbGxiYWNrKCkge1xuICAgICAgICAvLyBjYWxsYmFjayB0byBhbGwgdmFyaWFibGVzIHdoaWNoIHJlcXVpcmUgcG9sbGluZ1xuICAgICAgICBsZXQgdmFyaWFibGVzID0gWy4uLnRoaXMuX3ZhcmlhYmxlX21hcC5lbnRyaWVzKCldXG4gICAgICAgICAgICAuZmlsdGVyKChbdmFyaWFibGUsIGl0ZW1dKSA9PiBpdGVtLnBvbGxpbmcpXG4gICAgICAgICAgICAubWFwKChbdmFyaWFibGUsIGl0ZW1dKSA9PiB2YXJpYWJsZSk7XG4gICAgICAgIGlmICh2YXJpYWJsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgLy8gY2FsbGJhY2tcbiAgICAgICAgICAgIGZvciAobGV0IHZhcmlhYmxlIG9mIHZhcmlhYmxlcykge1xuICAgICAgICAgICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgICAgICAgICBsZXQgcmVzID0gdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgICAgICAgICBoYW5kbGUuY2FsbGJhY2socmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBcbiAgICAgICAgICAgICAgICByZXF1ZXN0IG5leHQgY2FsbGJhY2sgYXMgbG9uZyBhcyBhdCBsZWFzdCBvbmUgdmFyaWFibGUgXG4gICAgICAgICAgICAgICAgaXMgcmVxdWlyaW5nIHBvbGxpbmdcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9oYW5kbGUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5fY2FsbGJhY2suYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEJJTkQgUkVMRUFTRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jb25zdCBtb25pdG9yID0gbmV3IFRpbWVvdXRNb25pdG9yKCk7XG5jb25zdCBmcmFtZXJhdGVfbW9uaXRvciA9IG5ldyBGcmFtZXJhdGVNb25pdG9yKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICBsZXQgaGFuZGxlO1xuICAgIGlmIChCb29sZWFuKHBhcnNlRmxvYXQoZGVsYXkpKSkge1xuICAgICAgICBoYW5kbGUgPSBtb25pdG9yLmJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBbXCJ0aW1lb3V0XCIsIGhhbmRsZV07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaGFuZGxlID0gZnJhbWVyYXRlX21vbml0b3IuYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIDAsIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gW1wiZnJhbWVyYXRlXCIsIGhhbmRsZV07XG4gICAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgbGV0IFt0eXBlLCBfaGFuZGxlXSA9IGhhbmRsZTtcbiAgICBpZiAodHlwZSA9PSBcInRpbWVvdXRcIikge1xuICAgICAgICByZXR1cm4gbW9uaXRvci5yZWxlYXNlKF9oYW5kbGUpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcImZyYW1lcmF0ZVwiKSB7XG4gICAgICAgIHJldHVybiBmcmFtZXJhdGVfbW9uaXRvci5yZWxlYXNlKF9oYW5kbGUpO1xuICAgIH1cbn1cblxuIiwiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gICAgKiBcbiAgICAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAgICAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICAgICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gICAgKiBcbiAgICAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICAgICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAgICAqIFxuICAgICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG5cbiovXG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuXG5cbiAgICBOT1RFIFxuICAgIC0gY21wKDRdLFs0ICkgPT0gMCAtIHNpbmNlIHRoZXNlIGFyZSB0aGUgc2FtZSB3aXRoIHJlc3BlY3QgdG8gc29ydGluZ1xuICAgIC0gYnV0IGlmIHlvdSB3YW50IHRvIHNlZSBpZiB0d28gaW50ZXJ2YWxzIGFyZSBvdmVybGFwcGluZyBpbiB0aGUgZW5kcG9pbnRzXG4gICAgY21wKGhpZ2hfYSwgbG93X2IpID4gMCB0aGlzIHdpbGwgbm90IGJlIGdvb2RcbiAgICBcbiovIFxuXG5cbmZ1bmN0aW9uIGNtcE51bWJlcnMoYSwgYikge1xuICAgIGlmIChhID09PSBiKSByZXR1cm4gMDtcbiAgICBpZiAoYSA9PT0gSW5maW5pdHkpIHJldHVybiAxO1xuICAgIGlmIChiID09PSBJbmZpbml0eSkgcmV0dXJuIC0xO1xuICAgIGlmIChhID09PSAtSW5maW5pdHkpIHJldHVybiAtMTtcbiAgICBpZiAoYiA9PT0gLUluZmluaXR5KSByZXR1cm4gMTtcbiAgICByZXR1cm4gYSAtIGI7XG4gIH1cblxuZnVuY3Rpb24gZW5kcG9pbnRfY21wIChwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICBsZXQgZGlmZiA9IGNtcE51bWJlcnModjEsIHYyKTtcbiAgICByZXR1cm4gKGRpZmYgIT0gMCkgPyBkaWZmIDogczEgLSBzMjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludCB0byB0aGUgb3RoZXIgc2lkZVxuICogXG4gKiB1c2VmdWwgZm9yIG1ha2luZyBiYWNrLXRvLWJhY2sgaW50ZXJ2YWxzIFxuICogXG4gKiBoaWdoKSA8LT4gW2xvd1xuICogaGlnaF0gPC0+IChsb3dcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKHAsIHRhcmdldCkge1xuICAgIGxldCBbdixzXSA9IHA7XG4gICAgaWYgKCFpc0Zpbml0ZSh2KSkge1xuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgaWYgKHRhcmdldCA9PSBcImxvd1wiKSB7XG4gICAgXHQvLyBhc3N1bWUgcG9pbnQgaXMgaGlnaDogc2lnbiBtdXN0IGJlIC0xIG9yIDBcbiAgICBcdGlmIChzID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBsb3dcIik7ICAgIFx0XHRcbiAgICBcdH1cbiAgICAgICAgcCA9IFt2LCBzKzFdO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09IFwiaGlnaFwiKSB7XG5cdFx0Ly8gYXNzdW1lIHBvaW50IGlzIGxvdzogc2lnbiBpcyAwIG9yIDFcbiAgICBcdGlmIChzIDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBoaWdoXCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcy0xXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0eXBlXCIsIHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBsZXQgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBsZXQgbG93X3AgPSAobG93Q2xvc2VkKSA/IFtsb3csIDBdIDogW2xvdywgMV07IFxuICAgIGxldCBoaWdoX3AgPSAoaGlnaENsb3NlZCkgPyBbaGlnaCwgMF0gOiBbaGlnaCwgLTFdO1xuICAgIHJldHVybiBbbG93X3AsIGhpZ2hfcF07XG59XG5cblxuLypcbiAgICBJTlRFUlZBTFNcblxuICAgIEludGVydmFscyBhcmUgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXVxuXG4qLyBcblxuLypcbiAgICByZXR1cm4gdHJ1ZSBpZiBwb2ludCBwIGlzIGNvdmVyZWQgYnkgaW50ZXJ2YWwgaXR2XG4gICAgcG9pbnQgcCBjYW4gYmUgbnVtYmVyIHAgb3IgYSBwb2ludCBbcCxzXVxuXG4gICAgaW1wbGVtZW50ZWQgYnkgY29tcGFyaW5nIHBvaW50c1xuICAgIGV4Y2VwdGlvbiBpZiBpbnRlcnZhbCBpcyBub3QgZGVmaW5lZFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIHApIHtcbiAgICBsZXQgW2xvd19wLCBoaWdoX3BdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAvLyBjb3ZlcnM6IGxvdyA8PSBwIDw9IGhpZ2hcbiAgICByZXR1cm4gZW5kcG9pbnRfbGUobG93X3AsIHApICYmIGVuZHBvaW50X2xlKHAsIGhpZ2hfcCk7XG59XG4vLyBjb252ZW5pZW5jZVxuZnVuY3Rpb24gaW50ZXJ2YWxfY292ZXJzX3BvaW50KGl0diwgcCkge1xuICAgIHJldHVybiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBbcCwgMF0pO1xufVxuXG5cblxuLypcbiAgICBSZXR1cm4gdHJ1ZSBpZiBpbnRlcnZhbCBoYXMgbGVuZ3RoIDBcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9pc19zaW5ndWxhcihpbnRlcnZhbCkge1xuICAgIHJldHVybiBpbnRlcnZhbFswXSA9PSBpbnRlcnZhbFsxXVxufVxuXG4vKlxuICAgIENyZWF0ZSBpbnRlcnZhbCBmcm9tIGVuZHBvaW50c1xuKi9cbmZ1bmN0aW9uIGludGVydmFsX2Zyb21fZW5kcG9pbnRzKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIC8vIHAxIG11c3QgYmUgYSBsb3cgcG9pbnRcbiAgICBpZiAoczEgPT0gLTEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBsb3cgcG9pbnRcIiwgcDEpO1xuICAgIH1cbiAgICBpZiAoczIgPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2VhbCBoaWdoIHBvaW50XCIsIHAyKTsgICBcbiAgICB9XG4gICAgcmV0dXJuIFt2MSwgdjIsIChzMT09MCksIChzMj09MCldXG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKG4pIHtcbiAgICByZXR1cm4gdHlwZW9mIG4gPT0gXCJudW1iZXJcIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGludGVydmFsX2Zyb21faW5wdXQoaW5wdXQpe1xuICAgIGxldCBpdHYgPSBpbnB1dDtcbiAgICBpZiAoaXR2ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnB1dCBpcyB1bmRlZmluZWRcIik7XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShpdHYpKSB7XG4gICAgICAgIGlmIChpc051bWJlcihpdHYpKSB7XG4gICAgICAgICAgICAvLyBpbnB1dCBpcyBzaW5ndWxhciBudW1iZXJcbiAgICAgICAgICAgIGl0diA9IFtpdHYsIGl0diwgdHJ1ZSwgdHJ1ZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlucHV0OiAke2lucHV0fTogbXVzdCBiZSBBcnJheSBvciBOdW1iZXJgKVxuICAgICAgICB9XG4gICAgfTtcbiAgICAvLyBtYWtlIHN1cmUgaW50ZXJ2YWwgaXMgbGVuZ3RoIDRcbiAgICBpZiAoaXR2Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGl0diA9IFtpdHZbMF0sIGl0dlswXSwgdHJ1ZSwgdHJ1ZV1cbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMikge1xuICAgICAgICBpdHYgPSBpdHYuY29uY2F0KFt0cnVlLCBmYWxzZV0pO1xuICAgIH0gZWxzZSBpZiAoaXR2Lmxlbmd0aCA9PSAzKSB7XG4gICAgICAgIGl0diA9IGl0di5wdXNoKGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPiA0KSB7XG4gICAgICAgIGl0diA9IGl0di5zbGljZSgwLDQpO1xuICAgIH1cbiAgICBsZXQgW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdID0gaXR2O1xuICAgIC8vIHVuZGVmaW5lZFxuICAgIGlmIChsb3cgPT0gdW5kZWZpbmVkIHx8IGxvdyA9PSBudWxsKSB7XG4gICAgICAgIGxvdyA9IC1JbmZpbml0eTtcbiAgICB9XG4gICAgaWYgKGhpZ2ggPT0gdW5kZWZpbmVkIHx8IGhpZ2ggPT0gbnVsbCkge1xuICAgICAgICBoaWdoID0gSW5maW5pdHk7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93IGFuZCBoaWdoIGFyZSBudW1iZXJzXG4gICAgaWYgKCFpc051bWJlcihsb3cpKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgbm90IGEgbnVtYmVyXCIsIGxvdyk7XG4gICAgaWYgKCFpc051bWJlcihoaWdoKSkgdGhyb3cgbmV3IEVycm9yKFwiaGlnaCBub3QgYSBudW1iZXJcIiwgaGlnaCk7XG4gICAgLy8gY2hlY2sgdGhhdCBsb3cgPD0gaGlnaFxuICAgIGlmIChsb3cgPiBoaWdoKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgPiBoaWdoXCIsIGxvdywgaGlnaCk7XG4gICAgLy8gc2luZ2xldG9uXG4gICAgaWYgKGxvdyA9PSBoaWdoKSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIGluZmluaXR5IHZhbHVlc1xuICAgIGlmIChsb3cgPT0gLUluZmluaXR5KSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoaGlnaCA9PSBJbmZpbml0eSkge1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGUgYXJlIGJvb2xlYW5zXG4gICAgaWYgKHR5cGVvZiBsb3dJbmNsdWRlICE9PSBcImJvb2xlYW5cIikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJsb3dJbmNsdWRlIG5vdCBib29sZWFuXCIpO1xuICAgIH0gXG4gICAgaWYgKHR5cGVvZiBoaWdoSW5jbHVkZSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaGlnaEluY2x1ZGUgbm90IGJvb2xlYW5cIik7XG4gICAgfVxuICAgIHJldHVybiBbbG93LCBoaWdoLCBsb3dJbmNsdWRlLCBoaWdoSW5jbHVkZV07XG59XG5cblxuXG5cbmV4cG9ydCBjb25zdCBlbmRwb2ludCA9IHtcbiAgICBsZTogZW5kcG9pbnRfbGUsXG4gICAgbHQ6IGVuZHBvaW50X2x0LFxuICAgIGdlOiBlbmRwb2ludF9nZSxcbiAgICBndDogZW5kcG9pbnRfZ3QsXG4gICAgY21wOiBlbmRwb2ludF9jbXAsXG4gICAgZXE6IGVuZHBvaW50X2VxLFxuICAgIG1pbjogZW5kcG9pbnRfbWluLFxuICAgIG1heDogZW5kcG9pbnRfbWF4LFxuICAgIGZsaXA6IGVuZHBvaW50X2ZsaXAsXG4gICAgZnJvbV9pbnRlcnZhbDogZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWxcbn1cbmV4cG9ydCBjb25zdCBpbnRlcnZhbCA9IHtcbiAgICBjb3ZlcnNfZW5kcG9pbnQ6IGludGVydmFsX2NvdmVyc19lbmRwb2ludCxcbiAgICBjb3ZlcnNfcG9pbnQ6IGludGVydmFsX2NvdmVyc19wb2ludCwgXG4gICAgaXNfc2luZ3VsYXI6IGludGVydmFsX2lzX3Npbmd1bGFyLFxuICAgIGZyb21fZW5kcG9pbnRzOiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyxcbiAgICBmcm9tX2lucHV0OiBpbnRlcnZhbF9mcm9tX2lucHV0XG59XG4iLCIvKlxuICAgIFRoaXMgZGVjb3JhdGVzIGFuIG9iamVjdC9wcm90b3R5cGUgd2l0aCBiYXNpYyAoc3luY2hyb25vdXMpIGNhbGxiYWNrIHN1cHBvcnQuXG4qL1xuXG5jb25zdCBQUkVGSVggPSBcIl9fY2FsbGJhY2tcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2Uob2JqZWN0KSB7XG4gICAgb2JqZWN0W2Ake1BSRUZJWH1faGFuZGxlcnNgXSA9IFtdO1xufVxuXG5mdW5jdGlvbiBhZGRfY2FsbGJhY2sgKGhhbmRsZXIpIHtcbiAgICBsZXQgaGFuZGxlID0ge1xuICAgICAgICBoYW5kbGVyOiBoYW5kbGVyXG4gICAgfVxuICAgIHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLnB1c2goaGFuZGxlKTtcbiAgICByZXR1cm4gaGFuZGxlO1xufTtcblxuZnVuY3Rpb24gcmVtb3ZlX2NhbGxiYWNrIChoYW5kbGUpIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5pbmRleG9mKGhhbmRsZSk7XG4gICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBub3RpZnlfY2FsbGJhY2tzIChlQXJnKSB7XG4gICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uZm9yRWFjaChmdW5jdGlvbihoYW5kbGUpIHtcbiAgICAgICAgaGFuZGxlLmhhbmRsZXIoZUFyZyk7XG4gICAgfSk7XG59O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgYWRkX2NhbGxiYWNrLCByZW1vdmVfY2FsbGJhY2ssIG5vdGlmeV9jYWxsYmFja3NcbiAgICB9XG4gICAgT2JqZWN0LmFzc2lnbihfcHJvdG90eXBlLCBhcGkpO1xufVxuXG5cbiIsImltcG9ydCB7IGV2ZW50aWZ5IH0gZnJvbSBcIi4vZXZlbnRpZnkuanNcIjtcbmltcG9ydCB7IGJpbmQsIHJlbGVhc2UgfSBmcm9tIFwiLi9tb25pdG9yLmpzXCI7XG5pbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgcmFuZ2UgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5pbXBvcnQgKiBhcyBjYWxsYmFjayBmcm9tIFwiLi9hcGlfY2FsbGJhY2suanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ0xPQ0sgUFJPVklERVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBCYXNlIGNsYXNzIGZvciBDbG9ja1Byb3ZpZGVyc1xuICogXG4gKiBDbG9jayBQcm92aWRlcnMgaW1wbGVtZW50IHRoZSBjYWxsYmFja1xuICogaW50ZXJmYWNlIHRvIGJlIGNvbXBhdGlibGUgd2l0aCBvdGhlciBzdGF0ZVxuICogcHJvdmlkZXJzLCBldmVuIHRob3VnaCB0aGV5IGFyZSBub3QgcmVxdWlyZWQgdG9cbiAqIHByb3ZpZGUgYW55IGNhbGxiYWNrcyBhZnRlciBjbG9jayBhZGp1c3RtZW50c1xuICovXG5cbmV4cG9ydCBjbGFzcyBDbG9ja1Byb3ZpZGVyQmFzZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuICAgIG5vdyAoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShDbG9ja1Byb3ZpZGVyQmFzZS5wcm90b3R5cGUpO1xuXG5cbi8qKlxuICogQmFzZSBjbGFzcyBmb3IgTW90aW9uUHJvdmlkZXJzXG4gKiBcbiAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBjbGFzcyBvZmZlcmluZyBhIHNpbXBsZXIgd2F5XG4gKiBvZiBpbXBsZW1lbnRpbmcgc3RhdGUgcHJvdmlkZXIgd2hpY2ggZGVhbCBleGNsdXNpdmVseVxuICogd2l0aCBtb3Rpb24gc2VnbWVudHMuXG4gKiBcbiAqIE1vdGlvbnByb3ZpZGVycyBkbyBub3QgZGVhbCB3aXRoIGl0ZW1zLCBidXQgd2l0aCBzaW1wbGVyXG4gKiBzdGF0ZW1lbnRzIG9mIG1vdGlvbiBzdGF0ZVxuICogXG4gKiBzdGF0ZSA9IHtcbiAqICAgICAgcG9zaXRpb246IDAsXG4gKiAgICAgIHZlbG9jaXR5OiAwLFxuICogICAgICBhY2NlbGVyYXRpb246IDAsXG4gKiAgICAgIHRpbWVzdGFtcDogMFxuICogICAgICByYW5nZTogW3VuZGVmaW5lZCwgdW5kZWZpbmVkXVxuICogfVxuICogXG4gKiBJbnRlcm5hbGx5LCBNb3Rpb25Qcm92aWRlciB3aWxsIGJlIHdyYXBwZWQgc28gdGhhdCB0aGV5XG4gKiBiZWNvbWUgcHJvcGVyIFN0YXRlUHJvdmlkZXJzLlxuICovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25Qcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBjYWxsYmFjay5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICBsZXQge3N0YXRlfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzdGF0ZSA9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5fc3RhdGUgPSB7XG4gICAgICAgICAgICAgICAgcG9zaXRpb246IDAsXG4gICAgICAgICAgICAgICAgdmVsb2NpdHk6IDAsXG4gICAgICAgICAgICAgICAgYWNjZWxlcmF0aW9uOiAwLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogMCxcbiAgICAgICAgICAgICAgICByYW5nZTogW3VuZGVmaW5lZCwgdW5kZWZpbmVkXVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3RhdGUgPSBzdGF0ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNldCBtb3Rpb24gc3RhdGVcbiAgICAgKiBcbiAgICAgKiBpbXBsZW1lbnRhdGlvbnMgb2Ygb25saW5lIG1vdGlvbiBwcm92aWRlcnMgd2lsbFxuICAgICAqIHVzZSB0aGlzIHRvIHNlbmQgYW4gdXBkYXRlIHJlcXVlc3QsXG4gICAgICogYW5kIHNldCBfc3RhdGUgb24gcmVzcG9uc2UgYW5kIHRoZW4gY2FsbCBub3RpZnlfY2FsbGJha3NcbiAgICAgKiBJZiB0aGUgcHJveHkgd2FudHMgdG8gc2V0IHRoZSBzdGF0ZSBpbW1lZGlhdGVkbHkgLSBcbiAgICAgKiBpdCBzaG91bGQgYmUgZG9uZSB1c2luZyBhIFByb21pc2UgLSB0byBicmVhayB0aGUgY29udHJvbCBmbG93LlxuICAgICAqIFxuICAgICAqIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAqICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAqICAgICAgICAgICB0aGlzLl9zdGF0ZSA9IHN0YXRlO1xuICAgICAqICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgKiAgICAgICB9KTtcbiAgICAgKiBcbiAgICAgKi9cbiAgICBzZXRfc3RhdGUgKHN0YXRlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gY3VycmVudCBtb3Rpb24gc3RhdGVcbiAgICBnZXRfc3RhdGUgKCkge1xuICAgICAgICByZXR1cm4gey4uLnRoaXMuX3N0YXRlfTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShNb3Rpb25Qcm92aWRlckJhc2UucHJvdG90eXBlKTtcblxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU1RBVEUgUFJPVklERVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBCYXNlIGNsYXNzIGZvciBTdGF0ZVByb3ZpZGVyc1xuXG4gICAgLSBjb2xsZWN0aW9uIG9mIGl0ZW1zXG4gICAgLSB7a2V5LCBpdHYsIHR5cGUsIGRhdGF9XG4qL1xuXG5leHBvcnQgY2xhc3MgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogdXBkYXRlIGZ1bmN0aW9uXG4gICAgICogXG4gICAgICogSWYgSXRlbXNQcm92aWRlciBpcyBhIHByb3h5IHRvIGFuIG9ubGluZVxuICAgICAqIEl0ZW1zIGNvbGxlY3Rpb24sIHVwZGF0ZSByZXF1ZXN0cyB3aWxsIFxuICAgICAqIGltcGx5IGEgbmV0d29yayByZXF1ZXN0XG4gICAgICogXG4gICAgICogb3B0aW9ucyAtIHN1cHBvcnQgcmVzZXQgZmxhZyBcbiAgICAgKi9cbiAgICB1cGRhdGUoaXRlbXMsIG9wdGlvbnM9e30pe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIGFycmF5IHdpdGggYWxsIGl0ZW1zIGluIGNvbGxlY3Rpb24gXG4gICAgICogLSBubyByZXF1aXJlbWVudCB3cnQgb3JkZXJcbiAgICAgKi9cblxuICAgIGdldF9pdGVtcygpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNpZ25hbCBpZiBpdGVtcyBjYW4gYmUgb3ZlcmxhcHBpbmcgb3Igbm90XG4gICAgICovXG5cbiAgICBnZXQgaW5mbyAoKSB7XG4gICAgICAgIHJldHVybiB7b3ZlcmxhcHBpbmc6IHRydWV9O1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKFN0YXRlUHJvdmlkZXJCYXNlLnByb3RvdHlwZSk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTEFZRVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIExheWVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5faW5kZXg7XG5cbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgLy8gZGVmaW5lIGNoYW5nZSBldmVudFxuICAgICAgICBldmVudGlmeS5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFFVRVJZIEFQSVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgZ2V0UXVlcnlPYmplY3QgKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7ICAgICBcbiAgICB9XG5cbiAgICBnZXQgaW5kZXggKCkge3JldHVybiB0aGlzLl9pbmRleH07XG4gICAgXG5cbiAgICAvKlxuICAgICAgICBTYW1wbGUgTGF5ZXIgYnkgdGltZWxpbmUgb2Zmc2V0IGluY3JlbWVudHNcbiAgICAgICAgcmV0dXJuIGxpc3Qgb2YgdHVwbGVzIFt2YWx1ZSwgb2Zmc2V0XVxuICAgICAgICBvcHRpb25zXG4gICAgICAgIC0gc3RhcnRcbiAgICAgICAgLSBzdG9wXG4gICAgICAgIC0gc3RlcFxuICAgICovXG4gICAgc2FtcGxlKG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtzdGFydD0tSW5maW5pdHksIHN0b3A9SW5maW5pdHksIHN0ZXA9MX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3RhcnQgPiBzdG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgKFwic3RvcCBtdXN0IGJlIGxhcmdlciB0aGFuIHN0YXJ0XCIsIHN0YXJ0LCBzdG9wKVxuICAgICAgICB9XG4gICAgICAgIHN0YXJ0ID0gW3N0YXJ0LCAwXTtcbiAgICAgICAgc3RvcCA9IFtzdG9wLCAwXTtcblxuICAgICAgICBzdGFydCA9IGVuZHBvaW50Lm1heCh0aGlzLmluZGV4LmZpcnN0KCksIHN0YXJ0KTtcbiAgICAgICAgc3RvcCA9IGVuZHBvaW50Lm1pbih0aGlzLmluZGV4Lmxhc3QoKSwgc3RvcCk7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5nZXRRdWVyeU9iamVjdCgpO1xuICAgICAgICByZXR1cm4gcmFuZ2Uoc3RhcnRbMF0sIHN0b3BbMF0sIHN0ZXAsIHtpbmNsdWRlX2VuZDp0cnVlfSlcbiAgICAgICAgICAgIC5tYXAoKG9mZnNldCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBbY2FjaGUucXVlcnkob2Zmc2V0KS52YWx1ZSwgb2Zmc2V0XTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKExheWVyQmFzZS5wcm90b3R5cGUpO1xuZXZlbnRpZnkuYWRkVG9Qcm90b3R5cGUoTGF5ZXJCYXNlLnByb3RvdHlwZSk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ1VSU09SIEJBU0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBDdXJzb3JCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgLy8gZGVmaW5lIGNoYW5nZSBldmVudFxuICAgICAgICBldmVudGlmeS5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcbiAgICB9XG4gICAgXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBRVUVSWVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgcXVlcnkgKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgZ2V0IGluZGV4KCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgRXZlbnRpZnk6IGltbWVkaWF0ZSBldmVudHNcbiAgICAqL1xuICAgIGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG4gICAgICAgIGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBbdGhpcy5xdWVyeSgpXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogQklORCBSRUxFQVNFIChjb252ZW5pZW5jZSlcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGJpbmQoY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHJldHVybiBiaW5kKHRoaXMsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgICAgIHJldHVybiByZWxlYXNlKGhhbmRsZSk7XG4gICAgfVxuXG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShDdXJzb3JCYXNlLnByb3RvdHlwZSk7XG5ldmVudGlmeS5hZGRUb1Byb3RvdHlwZShDdXJzb3JCYXNlLnByb3RvdHlwZSk7XG5cbiIsIlxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU09VUkNFIFBST1BFUlRZXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9ucyBmb3IgZXh0ZW5kaW5nIGEgY2xhc3Mgd2l0aCBzdXBwb3J0IGZvciBcbiAqIGV4dGVybmFsIHNvdXJjZSBvbiBhIG5hbWVkIHByb3BlcnR5LlxuICogXG4gKiBvcHRpb246IG11dGFibGU6dHJ1ZSBtZWFucyB0aGF0IHByb3BlcnkgbWF5IGJlIHJlc2V0IFxuICogXG4gKiBzb3VyY2Ugb2JqZWN0IGlzIGFzc3VtZWQgdG8gc3VwcG9ydCB0aGUgY2FsbGJhY2sgaW50ZXJmYWNlXG4gKi9cblxuZnVuY3Rpb24gcHJvcG5hbWVzIChwcm9wTmFtZSkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHByb3A6IGBfXyR7cHJvcE5hbWV9YCxcbiAgICAgICAgaW5pdDogYF9fJHtwcm9wTmFtZX1faW5pdGAsXG4gICAgICAgIGhhbmRsZTogYF9fJHtwcm9wTmFtZX1faGFuZGxlYCxcbiAgICAgICAgY2hhbmdlOiBgX18ke3Byb3BOYW1lfV9oYW5kbGVfY2hhbmdlYCxcbiAgICAgICAgZGV0YXRjaDogYF9fJHtwcm9wTmFtZX1fZGV0YXRjaGAsXG4gICAgICAgIGF0dGF0Y2g6IGBfXyR7cHJvcE5hbWV9X2F0dGF0Y2hgLFxuICAgICAgICBjaGVjazogYF9fJHtwcm9wTmFtZX1fY2hlY2tgXG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYWRkVG9JbnN0YW5jZSAob2JqZWN0LCBwcm9wTmFtZSkge1xuICAgIGNvbnN0IHAgPSBwcm9wbmFtZXMocHJvcE5hbWUpXG4gICAgb2JqZWN0W3AucHJvcF0gPSB1bmRlZmluZWRcbiAgICBvYmplY3RbcC5pbml0XSA9IGZhbHNlO1xuICAgIG9iamVjdFtwLmhhbmRsZV0gPSB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSwgcHJvcE5hbWUsIG9wdGlvbnM9e30pIHtcblxuICAgIGNvbnN0IHAgPSBwcm9wbmFtZXMocHJvcE5hbWUpXG5cbiAgICBmdW5jdGlvbiBkZXRhdGNoKCkge1xuICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIHNvdXJjZSBjaGFuZ2UgZXZlbnRcbiAgICAgICAgbGV0IHttdXRhYmxlPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChtdXRhYmxlICYmIHRoaXNbcC5wcm9wXSkge1xuICAgICAgICAgICAgbGV0IGhhbmRsZSA9IHRoaXNbcC5oYW5kbGVdO1xuICAgICAgICAgICAgdGhpc1twLnByb3BdLnJlbW92ZV9jYWxsYmFjayhoYW5kbGUpO1xuICAgICAgICAgICAgdGhpc1twLmhhbmRsZV0gPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgdGhpc1twLnByb3BdID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGF0dGF0Y2goc291cmNlKSB7XG4gICAgICAgIGxldCB7bXV0YWJsZT1mYWxzZX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoIXRoaXNbcC5pbml0XSB8fCBtdXRhYmxlKSB7XG4gICAgICAgICAgICB0aGlzW3AucHJvcF0gPSBzb3VyY2U7XG4gICAgICAgICAgICB0aGlzW3AuaW5pdF0gPSB0cnVlO1xuICAgICAgICAgICAgLy8gc3Vic2NyaWJlIHRvIGNhbGxiYWNrIGZyb20gc291cmNlXG4gICAgICAgICAgICBpZiAodGhpc1twLmNoYW5nZV0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gdGhpc1twLmNoYW5nZV0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzW3AuaGFuZGxlXSA9IHNvdXJjZS5hZGRfY2FsbGJhY2soaGFuZGxlcik7XG4gICAgICAgICAgICAgICAgaGFuZGxlcihcInJlc2V0XCIpOyBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtwcm9wTmFtZX0gY2FuIG5vdCBiZSByZWFzc2lnbmVkYCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBvYmplY3QgbXVzdCBpbXBsZW1lbnRcbiAgICAgKiBfX3twcm9wTmFtZX1faGFuZGxlX2NoYW5nZSgpIHt9XG4gICAgICogXG4gICAgICogb2JqZWN0IGNhbiBpbXBsZW1lbnRcbiAgICAgKiBfX3twcm9wTmFtZX1fY2hlY2soc291cmNlKSB7fVxuICAgICAqL1xuXG4gICAgLy8gZ2V0dGVyIGFuZCBzZXR0ZXJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoX3Byb3RvdHlwZSwgcHJvcE5hbWUsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpc1twLnByb3BdO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChzcmMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzW3AuY2hlY2tdKSB7XG4gICAgICAgICAgICAgICAgc3JjID0gdGhpc1twLmNoZWNrXShzcmMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3JjICE9IHRoaXNbcC5wcm9wXSkge1xuICAgICAgICAgICAgICAgIHRoaXNbcC5kZXRhdGNoXSgpO1xuICAgICAgICAgICAgICAgIHRoaXNbcC5hdHRhdGNoXShzcmMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICB9KTtcblxuICAgIGNvbnN0IGFwaSA9IHt9O1xuICAgIGFwaVtwLmRldGF0Y2hdID0gZGV0YXRjaDtcbiAgICBhcGlbcC5hdHRhdGNoXSA9IGF0dGF0Y2g7XG5cbiAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG59XG5cbiIsIlxuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2V9IGZyb20gXCIuL2Jhc2VzXCI7XG5jb25zdCBNRVRIT0RTID0ge2Fzc2lnbiwgbW92ZSwgdHJhbnNpdGlvbiwgaW50ZXJwb2xhdGV9O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBjbWQgKHRhcmdldCkge1xuICAgIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhcmdldC5zcmMgbXVzdCBiZSBzdGF0ZXByb3ZpZGVyICR7dGFyZ2V0fWApO1xuICAgIH1cbiAgICBsZXQgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKE1FVEhPRFMpXG4gICAgICAgIC5tYXAoKFtuYW1lLCBtZXRob2RdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oLi4uYXJncykgeyBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGl0ZW1zID0gbWV0aG9kLmNhbGwodGhpcywgLi4uYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXQudXBkYXRlKGl0ZW1zKTsgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhlbnRyaWVzKTtcbn1cblxuZnVuY3Rpb24gYXNzaWduKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IGl0ZW0gPSB7XG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2YWx1ZSAgICAgICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtpdGVtXTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG1vdmUodmVjdG9yKSB7XG4gICAgbGV0IGl0ZW0gPSB7XG4gICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICBkYXRhOiB2ZWN0b3IgIFxuICAgIH1cbiAgICByZXR1cm4gW2l0ZW1dO1xufVxuXG5mdW5jdGlvbiB0cmFuc2l0aW9uKHYwLCB2MSwgdDAsIHQxLCBlYXNpbmcpIHtcbiAgICBsZXQgaXRlbXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgdDAsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MCwgdDEsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwidHJhbnNpdGlvblwiLFxuICAgICAgICAgICAgZGF0YToge3YwLCB2MSwgdDAsIHQxLCBlYXNpbmd9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdjFcbiAgICAgICAgfVxuICAgIF1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKHR1cGxlcykge1xuICAgIGxldCBbdjAsIHQwXSA9IHR1cGxlc1swXTtcbiAgICBsZXQgW3YxLCB0MV0gPSB0dXBsZXNbdHVwbGVzLmxlbmd0aC0xXTtcblxuICAgIGxldCBpdGVtcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYwXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJpbnRlcnBvbGF0aW9uXCIsXG4gICAgICAgICAgICBkYXRhOiB0dXBsZXNcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDEsIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MVxuICAgICAgICB9XG4gICAgXSAgICBcbiAgICByZXR1cm4gaXRlbXM7XG59XG5cblxuXG4iLCIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUiBTT1VSQ0UgSU5URVJGQUNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIERlY29yYXRlIGFuIG9iamVjdC9wcm90b3R5cGUgdG8gaW1wbGVtZW50IFxuICogdGhlIExheWVyU291cmNlIGludGVyZmFjZS5cbiAqIFxuICogLSBpbmRleFxuICogLSB2YWx1ZUZ1bmNcbiAqIC0gZ2V0Q2FjaGVcbiAqIC0gY2xlYXJDYWNoZXNcbiAqL1xuXG5jb25zdCBQUkVGSVggPSBcIl9fbGF5ZXJzb3VyY2VcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2UgKG9iamVjdCwgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHtDYWNoZUNsYXNzLCB2YWx1ZUZ1bmN9ID0gb3B0aW9ucztcbiAgICBvYmplY3RbYCR7UFJFRklYfV9pbmRleGBdO1xuICAgIG9iamVjdFtgJHtQUkVGSVh9X3ZhbHVlRnVuY2BdID0gdmFsdWVGdW5jO1xuICAgIG9iamVjdFtgJHtQUkVGSVh9X2NhY2hlQ2xhc3NgXSA9IENhY2hlQ2xhc3M7XG4gICAgb2JqZWN0W2Ake1BSRUZJWH1fY2FjaGVfb2JqZWN0c2BdID0gW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KF9wcm90b3R5cGUsIFwiaW5kZXhcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzW2Ake1BSRUZJWH1faW5kZXhgXTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShfcHJvdG90eXBlLCBcInZhbHVlRnVuY1wiLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXNbYCR7UFJFRklYfV92YWx1ZUZ1bmNgXTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gZ2V0Q2FjaGUgKCkge1xuICAgICAgICBjb25zdCBjYWNoZSA9IG5ldyB0aGlzW2Ake1BSRUZJWH1fY2FjaGVDbGFzc2BdKHRoaXMpO1xuICAgICAgICB0aGlzW2Ake1BSRUZJWH1fY2FjaGVfb2JqZWN0c2BdLnB1c2goY2FjaGUpO1xuICAgICAgICByZXR1cm4gY2FjaGU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2xlYXJDYWNoZXMgKCkge1xuICAgICAgICBmb3IgKGxldCBjYWNoZSBvZiB0aGlzW2Ake1BSRUZJWH1fY2FjaGVfb2JqZWN0c2BdKSB7XG4gICAgICAgICAgICBjYWNoZS5jbGVhcigpO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIE9iamVjdC5hc3NpZ24oX3Byb3RvdHlwZSwge2dldENhY2hlLCBjbGVhckNhY2hlc30pO1xufVxuXG4iLCJpbXBvcnQgeyBldmVudGlmeSB9IGZyb20gXCIuL2V2ZW50aWZ5LmpzXCI7XG5pbXBvcnQgeyBpbnRlcnZhbCwgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IHJhbmdlIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0ICogYXMgbGF5ZXJzb3VyY2UgZnJvbSBcIi4vYXBpX2xheWVyc291cmNlLmpzXCI7XG5pbXBvcnQgKiBhcyBjYWxsYmFjayBmcm9tIFwiLi9hcGlfY2FsbGJhY2suanNcIjtcbmltcG9ydCB7IHRvU3RhdGUgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTEFZRVJcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogTGF5ZXIgaXMgYmFzZSBjbGFzcyBmb3IgTGF5ZXJzXG4gKiBkZWZpbmVkIGJ5IGFuIGluZGV4IGFuZCBhIHZhbHVlRnVuY1xuICovXG5cbmV4cG9ydCBjbGFzcyBMYXllciB7XG5cbiAgICBjb25zdHJ1Y3RvcihjYWNoZUNsYXNzLCB2YWx1ZUZ1bmMpIHtcbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIC8vIGxheWVyIHNvdXJjZSBhcGlcbiAgICAgICAgbGF5ZXJzb3VyY2UuYWRkVG9JbnN0YW5jZSh0aGlzLCBjYWNoZUNsYXNzLCB2YWx1ZUZ1bmMpO1xuICAgICAgICAvLyBkZWZpbmUgY2hhbmdlIGV2ZW50XG4gICAgICAgIGV2ZW50aWZ5LmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlEZWZpbmUoXCJjaGFuZ2VcIiwge2luaXQ6dHJ1ZX0pO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIFNhbXBsZSBMYXllciBieSB0aW1lbGluZSBvZmZzZXQgaW5jcmVtZW50c1xuICAgICAgICByZXR1cm4gbGlzdCBvZiB0dXBsZXMgW3ZhbHVlLCBvZmZzZXRdXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICAgLSBzdGFydFxuICAgICAgICAtIHN0b3BcbiAgICAgICAgLSBzdGVwXG4gICAgKi9cbiAgICBzYW1wbGUob3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge3N0YXJ0PS1JbmZpbml0eSwgc3RvcD1JbmZpbml0eSwgc3RlcD0xfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzdGFydCA+IHN0b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciAoXCJzdG9wIG11c3QgYmUgbGFyZ2VyIHRoYW4gc3RhcnRcIiwgc3RhcnQsIHN0b3ApXG4gICAgICAgIH1cbiAgICAgICAgc3RhcnQgPSBbc3RhcnQsIDBdO1xuICAgICAgICBzdG9wID0gW3N0b3AsIDBdO1xuICAgICAgICBzdGFydCA9IGVuZHBvaW50Lm1heCh0aGlzLmluZGV4LmZpcnN0KCksIHN0YXJ0KTtcbiAgICAgICAgc3RvcCA9IGVuZHBvaW50Lm1pbih0aGlzLmluZGV4Lmxhc3QoKSwgc3RvcCk7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5nZXRDYWNoZSgpO1xuICAgICAgICByZXR1cm4gcmFuZ2Uoc3RhcnRbMF0sIHN0b3BbMF0sIHN0ZXAsIHtpbmNsdWRlX2VuZDp0cnVlfSlcbiAgICAgICAgICAgIC5tYXAoKG9mZnNldCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBbY2FjaGUucXVlcnkob2Zmc2V0KS52YWx1ZSwgb2Zmc2V0XTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKExheWVyLnByb3RvdHlwZSk7XG5sYXllcnNvdXJjZS5hZGRUb1Byb3RvdHlwZShMYXllci5wcm90b3R5cGUpO1xuZXZlbnRpZnkuYWRkVG9Qcm90b3R5cGUoTGF5ZXIucHJvdG90eXBlKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExBWUVSIENBQ0hFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFRoaXMgaW1wbGVtZW50cyBhIENhY2hlIHRvIGJlIHVzZWQgd2l0aCBMYXllciBvYmplY3RzXG4gKiBcbiAqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJDYWNoZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihsYXllcikge1xuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IHN0YXRlXG4gICAgICAgIHRoaXMuX25lYXJieTtcbiAgICAgICAgLy8gY2FjaGVkIHJlc3VsdFxuICAgICAgICB0aGlzLl9zdGF0ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBxdWVyeSBjYWNoZVxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBjb25zdCBuZWVkX25lYXJieSA9IChcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICFpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5fbmVhcmJ5Lml0diwgb2Zmc2V0KVxuICAgICAgICApO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICAhbmVlZF9uZWFyYnkgJiYgXG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSAhPSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICF0aGlzLl9zdGF0ZS5keW5hbWljXG4gICAgICAgICkge1xuICAgICAgICAgICAgLy8gY2FjaGUgaGl0XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuX3N0YXRlLCBvZmZzZXR9O1xuICAgICAgICB9XG4gICAgICAgIC8vIGNhY2hlIG1pc3NcbiAgICAgICAgaWYgKG5lZWRfbmVhcmJ5KSB7XG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPSB0aGlzLl9sYXllci5pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBwZXJmb3JtIGFjdHVhbCBxdWVyeVxuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9uZWFyYnkuY2VudGVyLm1hcCgoaXRlbSkgPT4gaXRlbS5zcmMucXVlcnkob2Zmc2V0KSk7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gdG9TdGF0ZShzdGF0ZXMsIHRoaXMuX2xheWVyLnZhbHVlRnVuYylcbiAgICAgICAgLy8gY2FjaGUgc3RhdGUgb25seSBpZiBub3QgZHluYW1pY1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IChzdGF0ZS5keW5hbWljKSA/IHVuZGVmaW5lZCA6IHN0YXRlO1xuICAgICAgICByZXR1cm4gc3RhdGUgICAgXG4gICAgfVxuXG4gICAgY2xlYXIoKSB7XG4gICAgICAgIHRoaXMuX2l0diA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG5cblxuXG5cbiIsImltcG9ydCB7IFN0YXRlUHJvdmlkZXJCYXNlIH0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7IGVuZHBvaW50IH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0NBTCBTVEFURSBQUk9WSURFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIExvY2FsIEFycmF5IHdpdGggbm9uLW92ZXJsYXBwaW5nIGl0ZW1zLlxuICovXG5cbmV4cG9ydCBjbGFzcyBMb2NhbFN0YXRlUHJvdmlkZXIgZXh0ZW5kcyBTdGF0ZVByb3ZpZGVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8vIGluaXRpYWxpemF0aW9uXG4gICAgICAgIGxldCB7aXRlbXMsIHZhbHVlfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChpdGVtcyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIGluaXRpYWxpemUgZnJvbSBpdGVtc1xuICAgICAgICAgICAgdGhpcy5faXRlbXMgPSBjaGVja19pbnB1dChpdGVtcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBpbml0aWFsaXplIGZyb20gdmFsdWVcbiAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gW3tcbiAgICAgICAgICAgICAgICBpdHY6Wy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLCBcbiAgICAgICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgICAgIGRhdGE6dmFsdWVcbiAgICAgICAgICAgIH1dO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5faXRlbXMgPSBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZSAoaXRlbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5faXRlbXMgPSBjaGVja19pbnB1dChpdGVtcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXRfaXRlbXMgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXRlbXMuc2xpY2UoKTtcbiAgICB9XG5cbiAgICBnZXQgaW5mbyAoKSB7XG4gICAgICAgIHJldHVybiB7b3ZlcmxhcHBpbmc6IGZhbHNlfTtcbiAgICB9XG59XG5cblxuZnVuY3Rpb24gY2hlY2tfaW5wdXQoaXRlbXMpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIklucHV0IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgfVxuICAgIC8vIHNvcnQgaXRlbXMgYmFzZWQgb24gaW50ZXJ2YWwgbG93IGVuZHBvaW50XG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBsZXQgYV9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGEuaXR2KVswXTtcbiAgICAgICAgbGV0IGJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChiLml0dilbMF07XG4gICAgICAgIHJldHVybiBlbmRwb2ludC5jbXAoYV9sb3csIGJfbG93KTtcbiAgICB9KTtcbiAgICAvLyBjaGVjayB0aGF0IGl0ZW0gaW50ZXJ2YWxzIGFyZSBub24tb3ZlcmxhcHBpbmdcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBwcmV2X2hpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2kgLSAxXS5pdHYpWzFdO1xuICAgICAgICBsZXQgY3Vycl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2ldLml0dilbMF07XG4gICAgICAgIC8vIHZlcmlmeSB0aGF0IHByZXYgaGlnaCBpcyBsZXNzIHRoYXQgY3VyciBsb3dcbiAgICAgICAgaWYgKCFlbmRwb2ludC5sdChwcmV2X2hpZ2gsIGN1cnJfbG93KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT3ZlcmxhcHBpbmcgaW50ZXJ2YWxzIGZvdW5kXCIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuXG5cblxuIiwiaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbkJBU0UgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLypcblx0QWJzdHJhY3QgQmFzZSBDbGFzcyBmb3IgU2VnbWVudHNcblxuICAgIGNvbnN0cnVjdG9yKGludGVydmFsKVxuXG4gICAgLSBpbnRlcnZhbDogaW50ZXJ2YWwgb2YgdmFsaWRpdHkgb2Ygc2VnbWVudFxuICAgIC0gZHluYW1pYzogdHJ1ZSBpZiBzZWdtZW50IGlzIGR5bmFtaWNcbiAgICAtIHZhbHVlKG9mZnNldCk6IHZhbHVlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4gICAgLSBxdWVyeShvZmZzZXQpOiBzdGF0ZSBvZiBzZWdtZW50IGF0IG9mZnNldFxuKi9cblxuZXhwb3J0IGNsYXNzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYpIHtcblx0XHR0aGlzLl9pdHYgPSBpdHY7XG5cdH1cblxuXHRnZXQgaXR2KCkge3JldHVybiB0aGlzLl9pdHY7fVxuXG4gICAgLyoqIFxuICAgICAqIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzXG4gICAgICogcmV0dXJucyB7dmFsdWUsIGR5bmFtaWN9O1xuICAgICovXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgXHR0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY29udmVuaWVuY2UgZnVuY3Rpb24gcmV0dXJuaW5nIHRoZSBzdGF0ZSBvZiB0aGUgc2VnbWVudFxuICAgICAqIEBwYXJhbSB7Kn0gb2Zmc2V0IFxuICAgICAqIEByZXR1cm5zIFxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX2l0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHsuLi50aGlzLnN0YXRlKG9mZnNldCksIG9mZnNldH07XG4gICAgICAgIH0gXG4gICAgICAgIHJldHVybiB7dmFsdWU6IHVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUlMgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJzU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcblx0XHR0aGlzLl9sYXllcnMgPSBhcmdzLmxheWVycztcbiAgICAgICAgdGhpcy5fdmFsdWVfZnVuYyA9IGFyZ3MudmFsdWVfZnVuY1xuXG4gICAgICAgIC8vIFRPRE8gLSBmaWd1cmUgb3V0IGR5bmFtaWMgaGVyZT9cbiAgICB9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIC8vIFRPRE8gLSB1c2UgdmFsdWUgZnVuY1xuICAgICAgICAvLyBmb3Igbm93IC0ganVzdCB1c2UgZmlyc3QgbGF5ZXJcbiAgICAgICAgcmV0dXJuIHsuLi50aGlzLl9sYXllcnNbMF0ucXVlcnkob2Zmc2V0KSwgb2Zmc2V0fTtcblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNUQVRJQyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX3ZhbHVlID0gZGF0YTtcblx0fVxuXG5cdHN0YXRlKCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl92YWx1ZSwgZHluYW1pYzpmYWxzZX1cblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE1PVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuICAgIEltcGxlbWVudHMgZGV0ZXJtaW5pc3RpYyBwcm9qZWN0aW9uIGJhc2VkIG9uIGluaXRpYWwgY29uZGl0aW9ucyBcbiAgICAtIG1vdGlvbiB2ZWN0b3IgZGVzY3JpYmVzIG1vdGlvbiB1bmRlciBjb25zdGFudCBhY2NlbGVyYXRpb25cbiovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuICAgICAgICBzdXBlcihpdHYpO1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBwb3NpdGlvbjpwMD0wLCBcbiAgICAgICAgICAgIHZlbG9jaXR5OnYwPTAsIFxuICAgICAgICAgICAgYWNjZWxlcmF0aW9uOmEwPTAsIFxuICAgICAgICAgICAgdGltZXN0YW1wOnQwPTBcbiAgICAgICAgfSA9IGRhdGE7XG4gICAgICAgIC8vIGNyZWF0ZSBtb3Rpb24gdHJhbnNpdGlvblxuICAgICAgICB0aGlzLl9wb3NfZnVuYyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgbGV0IGQgPSB0cyAtIHQwO1xuICAgICAgICAgICAgcmV0dXJuIHAwICsgdjAqZCArIDAuNSphMCpkKmQ7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX3ZlbF9mdW5jID0gZnVuY3Rpb24gKHRzKSB7XG4gICAgICAgICAgICBsZXQgZCA9IHRzIC0gdDA7XG4gICAgICAgICAgICByZXR1cm4gdjAgKyBhMCpkO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2FjY19mdW5jID0gZnVuY3Rpb24gKHRzKSB7XG4gICAgICAgICAgICByZXR1cm4gYTA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgbGV0IHBvcyA9IHRoaXMuX3Bvc19mdW5jKG9mZnNldCk7XG4gICAgICAgIGxldCB2ZWwgPSB0aGlzLl92ZWxfZnVuYyhvZmZzZXQpO1xuICAgICAgICBsZXQgYWNjID0gdGhpcy5fYWNjX2Z1bmMob2Zmc2V0KTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBwb3MsXG4gICAgICAgICAgICB2ZWxvY2l0eTogdmVsLFxuICAgICAgICAgICAgYWNjZWxlcmF0aW9uOiBhY2MsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IG9mZnNldCxcbiAgICAgICAgICAgIHZhbHVlOiBwb3MsXG4gICAgICAgICAgICBkeW5hbWljOiAodmVsICE9IDAgfHwgYWNjICE9IDAgKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRSQU5TSVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIFN1cHBvcnRlZCBlYXNpbmcgZnVuY3Rpb25zXG4gICAgXCJlYXNlLWluXCI6XG4gICAgXCJlYXNlLW91dFwiOlxuICAgIFwiZWFzZS1pbi1vdXRcIlxuKi9cblxuZnVuY3Rpb24gZWFzZWluICh0cykge1xuICAgIHJldHVybiBNYXRoLnBvdyh0cywyKTsgIFxufVxuZnVuY3Rpb24gZWFzZW91dCAodHMpIHtcbiAgICByZXR1cm4gMSAtIGVhc2VpbigxIC0gdHMpO1xufVxuZnVuY3Rpb24gZWFzZWlub3V0ICh0cykge1xuICAgIGlmICh0cyA8IC41KSB7XG4gICAgICAgIHJldHVybiBlYXNlaW4oMiAqIHRzKSAvIDI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICgyIC0gZWFzZWluKDIgKiAoMSAtIHRzKSkpIC8gMjtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFuc2l0aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGRhdGEpIHtcblx0XHRzdXBlcihpdHYpO1xuICAgICAgICBsZXQge3YwLCB2MSwgZWFzaW5nfSA9IGRhdGE7XG4gICAgICAgIGxldCBbdDAsIHQxXSA9IHRoaXMuX2l0di5zbGljZSgwLDIpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgdHJhbnNpdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl9keW5hbWljID0gdjEtdjAgIT0gMDtcbiAgICAgICAgdGhpcy5fdHJhbnMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgdHMgdG8gW3QwLHQxXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzaGlmdCBmcm9tIFt0MCx0MV0tc3BhY2UgdG8gWzAsKHQxLXQwKV0tc3BhY2VcbiAgICAgICAgICAgIC8vIC0gc2NhbGUgZnJvbSBbMCwodDEtdDApXS1zcGFjZSB0byBbMCwxXS1zcGFjZVxuICAgICAgICAgICAgdHMgPSB0cyAtIHQwO1xuICAgICAgICAgICAgdHMgPSB0cy9wYXJzZUZsb2F0KHQxLXQwKTtcbiAgICAgICAgICAgIC8vIGVhc2luZyBmdW5jdGlvbnMgc3RyZXRjaGVzIG9yIGNvbXByZXNzZXMgdGhlIHRpbWUgc2NhbGUgXG4gICAgICAgICAgICBpZiAoZWFzaW5nID09IFwiZWFzZS1pblwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW4odHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlb3V0KHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWFzaW5nID09IFwiZWFzZS1pbi1vdXRcIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZWlub3V0KHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc2l0aW9uIGZyb20gdjAgdG8gdjEsIGZvciB0aW1lIHZhbHVlcyBbMCwxXVxuICAgICAgICAgICAgdHMgPSBNYXRoLm1heCh0cywgMCk7XG4gICAgICAgICAgICB0cyA9IE1hdGgubWluKHRzLCAxKTtcbiAgICAgICAgICAgIHJldHVybiB2MCArICh2MS12MCkqdHM7XG4gICAgICAgIH1cblx0fVxuXG5cdHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl90cmFucyhvZmZzZXQpLCBkeW5hbWljOnRoaXMuX2R5bmFtaWN9XG5cdH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElOVEVSUE9MQVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9uIHRvIGNyZWF0ZSBhbiBpbnRlcnBvbGF0b3IgZm9yIG5lYXJlc3QgbmVpZ2hib3IgaW50ZXJwb2xhdGlvbiB3aXRoXG4gKiBleHRyYXBvbGF0aW9uIHN1cHBvcnQuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdHVwbGVzIC0gQW4gYXJyYXkgb2YgW3ZhbHVlLCBvZmZzZXRdIHBhaXJzLCB3aGVyZSB2YWx1ZSBpcyB0aGVcbiAqIHBvaW50J3MgdmFsdWUgYW5kIG9mZnNldCBpcyB0aGUgY29ycmVzcG9uZGluZyBvZmZzZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gQSBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIG9mZnNldCBhbmQgcmV0dXJucyB0aGVcbiAqIGludGVycG9sYXRlZCBvciBleHRyYXBvbGF0ZWQgdmFsdWUuXG4gKi9cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUodHVwbGVzKSB7XG5cbiAgICBpZiAodHVwbGVzLmxlbmd0aCA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHVuZGVmaW5lZDt9XG4gICAgfSBlbHNlIGlmICh0dXBsZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHR1cGxlc1swXVswXTt9XG4gICAgfVxuXG4gICAgLy8gU29ydCB0aGUgdHVwbGVzIGJ5IHRoZWlyIG9mZnNldHNcbiAgICBjb25zdCBzb3J0ZWRUdXBsZXMgPSBbLi4udHVwbGVzXS5zb3J0KChhLCBiKSA9PiBhWzFdIC0gYlsxXSk7XG4gIFxuICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3Iob2Zmc2V0KSB7XG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBiZWZvcmUgdGhlIGZpcnN0IHBvaW50XG4gICAgICBpZiAob2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1swXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1swXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbMV07XG4gICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gSGFuZGxlIGV4dHJhcG9sYXRpb24gYWZ0ZXIgdGhlIGxhc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMl07XG4gICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICBcbiAgICAgIC8vIEZpbmQgdGhlIG5lYXJlc3QgcG9pbnRzIHRvIHRoZSBsZWZ0IGFuZCByaWdodFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW2ldWzFdICYmIG9mZnNldCA8PSBzb3J0ZWRUdXBsZXNbaSArIDFdWzFdKSB7XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbaV07XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbaSArIDFdO1xuICAgICAgICAgIC8vIExpbmVhciBpbnRlcnBvbGF0aW9uIGZvcm11bGE6IHkgPSB5MSArICggKHggLSB4MSkgKiAoeTIgLSB5MSkgLyAoeDIgLSB4MSkgKVxuICAgICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICBcbiAgICAgIC8vIEluIGNhc2UgdGhlIG9mZnNldCBkb2VzIG5vdCBmYWxsIHdpdGhpbiBhbnkgcmFuZ2UgKHNob3VsZCBiZSBjb3ZlcmVkIGJ5IHRoZSBwcmV2aW91cyBjb25kaXRpb25zKVxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9O1xufVxuICBcblxuZXhwb3J0IGNsYXNzIEludGVycG9sYXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG4gICAgY29uc3RydWN0b3IoaXR2LCB0dXBsZXMpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcbiAgICAgICAgLy8gc2V0dXAgaW50ZXJwb2xhdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl90cmFucyA9IGludGVycG9sYXRlKHR1cGxlcyk7XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dHJ1ZX07XG4gICAgfVxufVxuXG5cbiIsImltcG9ydCB7IFxuICAgIFN0YXRlUHJvdmlkZXJCYXNlLFxuICAgIE1vdGlvblByb3ZpZGVyQmFzZSBcbn0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7IE1vdGlvblNlZ21lbnQgfSBmcm9tIFwiLi9zZWdtZW50cy5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0NBTCBNT1RJT04gUFJPVklERVIgXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogVGhpcyBpbXBsZW1lbnRzIGEgbG9jYWwgTW90aW9uUHJvdmlkZXJcbiAqICBcbiAqIHN0YXRlID0ge1xuICogICAgICBwb3NpdGlvbjogMCxcbiAqICAgICAgdmVsb2NpdHk6IDAsXG4gKiAgICAgIGFjY2VsZXJhdGlvbjogMCxcbiAqICAgICAgdGltZXN0YW1wOiAwXG4gKiAgICAgIHJhbmdlOiBbdW5kZWZpbmVkLCB1bmRlZmluZWRdXG4gKiB9XG4gKiBcbiAqIElucHV0L291dHB1dCBjaGVja2luZyBpcyBwZXJmb3JtZWQgYnkgdGhlIHdyYXBwZXIuXG4gKiBcbiAqL1xuXG5leHBvcnQgY2xhc3MgTG9jYWxNb3Rpb25Qcm92aWRlciBleHRlbmRzIE1vdGlvblByb3ZpZGVyQmFzZSB7XG5cbiAgICBzZXRfc3RhdGUgKHN0YXRlKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0YXRlID0gc3RhdGU7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE1PVElPTiBTVEFURSBQUk9WSURFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFdyYXBzIHRoZSBzaW1wbGVyIG1vdGlvbiBwcm92aWRlciB0byBlbnN1cmUgXG4gKiBjaGVja2luZyBvZiBzdGF0ZSBhbmQgaW1wbGVtZW50IHRoZSBTdGF0ZVByb3ZpZGVyIFxuICogaW50ZXJmYWNlLlxuICovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25TdGF0ZVByb3ZpZGVyIGV4dGVuZHMgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IobXApIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgaWYgKCEobXAgaW5zdGFuY2VvZiBNb3Rpb25Qcm92aWRlckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG11c3QgYmUgTW90aW9uUHJvdmlkZXJCYXNlICR7bXB9YClcbiAgICAgICAgfVxuICAgICAgICAvLyBtb3Rpb24gcHJvdmlkZXJcbiAgICAgICAgdGhpcy5fbXAgPSBtcDtcbiAgICAgICAgLy8gY2hlY2sgaW5pdGlhbCBzdGF0ZSBvZiBtb3Rpb24gcHJvdmlkZXJcbiAgICAgICAgdGhpcy5fbXAuX3N0YXRlID0gY2hlY2tfc3RhdGUodGhpcy5fbXAuX3N0YXRlKVxuICAgICAgICAvLyBzdWJzY3JpYmUgdG8gY2FsbGJhY2tzXG4gICAgICAgIHRoaXMuX21wLmFkZF9jYWxsYmFjayh0aGlzLl9oYW5kbGVfY2FsbGJhY2suYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgX2hhbmRsZV9jYWxsYmFjaygpIHtcbiAgICAgICAgLy8gRm9yd2FyZCBjYWxsYmFjayBmcm9tIHdyYXBwZWQgbW90aW9uIHByb3ZpZGVyXG4gICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHVwZGF0ZSBtb3Rpb24gc3RhdGVcbiAgICAgKi9cblxuICAgIHVwZGF0ZShpdGVtcywgb3B0aW9ucz17fSkge1xuICAgICAgICAvLyBUT0RPIC0gaXRlbXMgc2hvdWxkIGJlIGNvdmVydGVkIHRvIG1vdGlvbiBzdGF0ZVxuICAgICAgICBsZXQgc3RhdGUgPSBzdGF0ZV9mcm9tX2l0ZW1zKGl0ZW1zKTtcbiAgICAgICAgc3RhdGUgPSBjaGVja19zdGF0ZShzdGF0ZSk7XG4gICAgICAgIC8vIGZvcndhcmQgdXBkYXRlcyB0byB3cmFwcGVkIG1vdGlvbiBwcm92aWRlclxuICAgICAgICByZXR1cm4gdGhpcy5fbXAuc2V0X3N0YXRlKHN0YXRlKTtcbiAgICB9XG5cbiAgICBnZXRfc3RhdGUoKSB7XG4gICAgICAgIC8vIHJlc29sdmUgc3RhdGUgZnJvbSB3cmFwcGVkIG1vdGlvbiBwcm92aWRlclxuICAgICAgICBsZXQgc3RhdGUgPSB0aGlzLl9tcC5nZXRfc3RhdGUoKTtcbiAgICAgICAgc3RhdGUgPSBjaGVja19zdGF0ZShzdGF0ZSlcbiAgICAgICAgcmV0dXJuIGl0ZW1zX2Zyb21fc3RhdGUoc3RhdGUpO1xuICAgIH1cblxuICAgIGdldCBpbmZvICgpIHtcbiAgICAgICAgcmV0dXJuIHtvdmVybGFwcGluZzogZmFsc2V9O1xuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVVRJTFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5mdW5jdGlvbiBjaGVja19zdGF0ZShzdGF0ZSkge1xuICAgIGxldCB7XG4gICAgICAgIHBvc2l0aW9uPTAsIFxuICAgICAgICB2ZWxvY2l0eT0wLCBcbiAgICAgICAgYWNjZWxlcmF0aW9uPTAsXG4gICAgICAgIHRpbWVzdGFtcD0wLFxuICAgICAgICByYW5nZT1bdW5kZWZpbmVkLCB1bmRlZmluZWRdIFxuICAgIH0gPSBzdGF0ZSB8fCB7fTtcbiAgICBzdGF0ZSA9IHtcbiAgICAgICAgcG9zaXRpb24sIFxuICAgICAgICB2ZWxvY2l0eSxcbiAgICAgICAgYWNjZWxlcmF0aW9uLFxuICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgIHJhbmdlXG4gICAgfVxuICAgIC8vIHZlY3RvciB2YWx1ZXMgbXVzdCBiZSBmaW5pdGUgbnVtYmVyc1xuICAgIGNvbnN0IHByb3BzID0gW1wicG9zaXRpb25cIiwgXCJ2ZWxvY2l0eVwiLCBcImFjY2VsZXJhdGlvblwiLCBcInRpbWVzdGFtcFwiXTtcbiAgICBmb3IgKGxldCBwcm9wIG9mIHByb3BzKSB7XG4gICAgICAgIGxldCBuID0gc3RhdGVbcHJvcF07XG4gICAgICAgIGlmICghaXNGaW5pdGVOdW1iZXIobikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtwcm9wfSBtdXN0IGJlIG51bWJlciAke259YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByYW5nZSB2YWx1ZXMgY2FuIGJlIHVuZGVmaW5lZCBvciBhIG51bWJlclxuICAgIGZvciAobGV0IG4gb2YgcmFuZ2UpIHtcbiAgICAgICAgaWYgKCEobiA9PSB1bmRlZmluZWQgfHwgaXNGaW5pdGVOdW1iZXIobikpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHJhbmdlIHZhbHVlIG11c3QgYmUgdW5kZWZpbmVkIG9yIG51bWJlciAke259YCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgbGV0IFtsb3csIGhpZ2hdID0gcmFuZ2U7XG4gICAgaWYgKGxvdyAhPSB1bmRlZmluZWQgJiYgbG93ICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAobG93ID49IGhpZ2gpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgbG93ID4gaGlnaCBbJHtsb3d9LCAke2hpZ2h9XWApXG4gICAgICAgIH0gXG4gICAgfVxuICAgIHJldHVybiB7cG9zaXRpb24sIHZlbG9jaXR5LCBhY2NlbGVyYXRpb24sIHRpbWVzdGFtcCwgcmFuZ2V9O1xufVxuXG5mdW5jdGlvbiBpc0Zpbml0ZU51bWJlcihuKSB7XG4gICAgcmV0dXJuICh0eXBlb2YgbiA9PSBcIm51bWJlclwiKSAmJiBpc0Zpbml0ZShuKTtcbn1cblxuLyoqXG4gKiBjb252ZXJ0IGl0ZW0gbGlzdCBpbnRvIG1vdGlvbiBzdGF0ZVxuICovXG5cbmZ1bmN0aW9uIHN0YXRlX2Zyb21faXRlbXMoaXRlbXMpIHtcbiAgICAvLyBwaWNrIG9uZSBpdGVtIG9mIG1vdGlvbiB0eXBlXG4gICAgY29uc3QgaXRlbSA9IGl0ZW1zLmZpbmQoKGl0ZW0pID0+IHtcbiAgICAgICAgcmV0dXJuIGl0ZW0udHlwZSA9PSBcIm1vdGlvblwiO1xuICAgIH0pXG4gICAgaWYgKGl0ZW0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBpdGVtLmRhdGE7XG4gICAgfVxufVxuXG4vKipcbiAqIGNvbnZlcnQgbW90aW9uIHN0YXRlIGludG8gaXRlbXMgbGlzdFxuICovXG5cbmZ1bmN0aW9uIGl0ZW1zX2Zyb21fc3RhdGUgKHN0YXRlKSB7XG4gICAgLy8gbW90aW9uIHNlZ21lbnQgZm9yIGNhbGN1bGF0aW9uXG4gICAgbGV0IFtsb3csIGhpZ2hdID0gc3RhdGUucmFuZ2U7XG4gICAgY29uc3Qgc2VnID0gbmV3IE1vdGlvblNlZ21lbnQoW2xvdywgaGlnaCwgdHJ1ZSwgdHJ1ZV0sIHN0YXRlKTtcbiAgICBjb25zdCB7dmFsdWU6dmFsdWVfbG93fSA9IHNlZy5zdGF0ZShsb3cpO1xuICAgIGNvbnN0IHt2YWx1ZTp2YWx1ZV9oaWdofSA9IHNlZy5zdGF0ZShoaWdoKTtcblxuICAgIC8vIHNldCB1cCBpdGVtc1xuICAgIGlmIChsb3cgPT0gdW5kZWZpbmVkICYmIGhpZ2ggPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBbe1xuICAgICAgICAgICAgaXR2OlstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSwgXG4gICAgICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICAgICAgYXJnczogc3RhdGVcbiAgICAgICAgfV07XG4gICAgfSBlbHNlIGlmIChsb3cgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaXR2OlstSW5maW5pdHksIGhpZ2gsIHRydWUsIHRydWVdLCBcbiAgICAgICAgICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICAgICAgICAgIGFyZ3M6IHN0YXRlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGl0djpbaGlnaCwgSW5maW5pdHksIGZhbHNlLCB0cnVlXSwgXG4gICAgICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgICAgICBhcmdzOiB2YWx1ZV9oaWdoXG4gICAgICAgICAgICB9LFxuICAgICAgICBdO1xuICAgIH0gZWxzZSBpZiAoaGlnaCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpdHY6Wy1JbmZpbml0eSwgbG93LCB0cnVlLCBmYWxzZV0sIFxuICAgICAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICAgICAgYXJnczogdmFsdWVfbG93XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGl0djpbbG93LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sIFxuICAgICAgICAgICAgICAgIHR5cGU6IFwibW90aW9uXCIsXG4gICAgICAgICAgICAgICAgYXJnczogc3RhdGVcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpdHY6Wy1JbmZpbml0eSwgbG93LCB0cnVlLCBmYWxzZV0sIFxuICAgICAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICAgICAgYXJnczogdmFsdWVfbG93XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGl0djpbbG93LCBoaWdoLCB0cnVlLCB0cnVlXSwgXG4gICAgICAgICAgICAgICAgdHlwZTogXCJtb3Rpb25cIixcbiAgICAgICAgICAgICAgICBhcmdzOiBzdGF0ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpdHY6W2hpZ2gsIEluZmluaXR5LCBmYWxzZSwgdHJ1ZV0sIFxuICAgICAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICAgICAgYXJnczogdmFsdWVfaGlnaFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXTtcbiAgICB9XG59XG5cbiIsImltcG9ydCB7IENMT0NLIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgXG4gICAgQ2xvY2tQcm92aWRlckJhc2UsXG4gICAgTW90aW9uUHJvdmlkZXJCYXNlLFxuICAgIFN0YXRlUHJvdmlkZXJCYXNlLFxuICAgIEN1cnNvckJhc2UsIFxufSBmcm9tIFwiLi9iYXNlcy5qc1wiO1xuaW1wb3J0ICogYXMgc291cmNlcHJvcCBmcm9tIFwiLi9zb3VyY2Vwcm9wLmpzXCI7XG5pbXBvcnQgeyBjbWQgfSBmcm9tIFwiLi9jbWQuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4vbmV3bGF5ZXIuanNcIjtcbmltcG9ydCB7IExvY2FsU3RhdGVQcm92aWRlciB9IGZyb20gXCIuL3N0YXRlcHJvdmlkZXJfc2ltcGxlLmpzXCI7XG5pbXBvcnQgeyBNb3Rpb25TdGF0ZVByb3ZpZGVyIH0gZnJvbSBcIi4vc3RhdGVwcm92aWRlcl9tb3Rpb24uanNcIjtcbmltcG9ydCB7IGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExPQ0FMIENMT0NLIFBST1ZJREVSXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jbGFzcyBMb2NhbENsb2NrUHJvdmlkZXIgZXh0ZW5kcyBDbG9ja1Byb3ZpZGVyQmFzZSB7XG4gICAgbm93ICgpIHtcbiAgICAgICAgcmV0dXJuIENMT0NLLm5vdygpO1xuICAgIH1cbn1cbmNvbnN0IGxvY2FsQ2xvY2tQcm92aWRlciA9IG5ldyBMb2NhbENsb2NrUHJvdmlkZXIoKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBcbiAqIEN1cnNvciBpcyBhIHZhcmlhYmxlXG4gKiAtIGhhcyBtdXRhYmxlIGN0cmwgY3Vyc29yIChkZWZhdWx0IExvY2FsQ2xvY2tQcm92aWRlcilcbiAqIC0gaGFzIG11dGFibGUgc3RhdGUgcHJvdmlkZXIgKHNyYykgKGRlZmF1bHQgc3RhdGUgdW5kZWZpbmVkKVxuICogLSBtZXRob2RzIGZvciBhc3NpZ24sIG1vdmUsIHRyYW5zaXRpb24sIGludGVwb2xhdGlvblxuICogXG4gKi9cblxuZXhwb3J0IGNsYXNzIEN1cnNvciBleHRlbmRzIEN1cnNvckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLy8gY3RybFxuICAgICAgICBzb3VyY2Vwcm9wLmFkZFRvSW5zdGFuY2UodGhpcywgXCJjdHJsXCIpO1xuICAgICAgICAvLyBzcmNcbiAgICAgICAgc291cmNlcHJvcC5hZGRUb0luc3RhbmNlKHRoaXMsIFwic3JjXCIpO1xuICAgICAgICAvLyBpbmRleFxuICAgICAgICB0aGlzLl9pbmRleDtcbiAgICAgICAgLy8gY3Vyc29yIG1haW50YWlucyBhIGNhc2hlIG9iamVjdCBmb3IgcXVlcnlpbmcgc3JjIGxheWVyXG4gICAgICAgIHRoaXMuX2NhY2hlO1xuICAgICAgICAvLyB0aW1lb3V0XG4gICAgICAgIHRoaXMuX3RpZDtcbiAgICAgICAgLy8gcG9sbGluZ1xuICAgICAgICB0aGlzLl9waWQ7XG4gICAgICAgIC8vIG9wdGlvbnNcbiAgICAgICAgbGV0IHtzcmMsIGN0cmwsIC4uLm9wdHN9ID0gb3B0aW9ucztcblxuICAgICAgICAvLyBpbml0aWFsaXNlIGN0cmxcbiAgICAgICAgdGhpcy5jdHJsID0gY3RybCB8fCBsb2NhbENsb2NrUHJvdmlkZXI7XG4gICAgICAgIC8vIGluaXRpYWxpc2Ugc3JjXG4gICAgICAgIHRoaXMuc3JjID0gc3JjIHx8IG5ldyBMb2NhbFN0YXRlUHJvdmlkZXIob3B0cyk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBDVFJMIChjdXJzb3IpXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfX2N0cmxfY2hlY2soY3RybCkge1xuICAgICAgICBpZiAoY3RybCBpbnN0YW5jZW9mIENsb2NrUHJvdmlkZXJCYXNlKSB7XG4gICAgICAgICAgICByZXR1cm4gY3RybDtcbiAgICAgICAgfSBlbHNlIGlmIChjdHJsIGluc3RhbmNlb2YgQ3Vyc29yQmFzZSkge1xuICAgICAgICAgICAgcmV0dXJuIGN0cmw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwiY3RybFwiIG11c3QgYmUgY3Vyc29yICR7Y3RybH1gKVxuICAgICAgICB9XG4gICAgfVxuICAgIF9fY3RybF9oYW5kbGVfY2hhbmdlKHJlYXNvbikge1xuICAgICAgICB0aGlzLl9faGFuZGxlX2NoYW5nZShcImN0cmxcIiwgcmVhc29uKTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFNSQyAobGF5ZXIpXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfX3NyY19jaGVjayhzcmMpIHtcbiAgICAgICAgaWYgKHNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IExheWVyKHtzcmN9KTtcbiAgICAgICAgfSBlbHNlIGlmIChzcmMgaW5zdGFuY2VvZiBMYXllcikge1xuICAgICAgICAgICAgcmV0dXJuIHNyYztcbiAgICAgICAgfSBlbHNlICBpZiAoc3JjIGluc3RhbmNlb2YgTW90aW9uUHJvdmlkZXJCYXNlKSB7XG4gICAgICAgICAgICBzcmMgPSBuZXcgTW90aW9uU3RhdGVQcm92aWRlcihzcmMpO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBMYXllcih7c3JjfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwic3JjXCIgbXVzdCBiZSBMYXllciAke3NyY31gKTtcbiAgICAgICAgfVxuICAgIH0gICAgXG4gICAgX19zcmNfaGFuZGxlX2NoYW5nZShyZWFzb24pIHtcbiAgICAgICAgdGhpcy5fX2hhbmRsZV9jaGFuZ2UoXCJzcmNcIiwgcmVhc29uKTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIENBTExCQUNLXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfX2hhbmRsZV9jaGFuZ2Uob3JpZ2luLCBtc2cpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3RpZCk7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5fcGlkKTtcbiAgICAgICAgaWYgKHRoaXMuc3JjICYmIHRoaXMuY3RybCkge1xuICAgICAgICAgICAgaWYgKG9yaWdpbiA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2NhY2hlID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuc3JjLmdldFF1ZXJ5T2JqZWN0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9yaWdpbiA9PSBcInNyY1wiIHx8IG9yaWdpbiA9PSBcImN0cmxcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlLmNsZWFyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIC8vIHRyaWdnZXIgY2hhbmdlIGV2ZW50IGZvciBjdXJzb3JcbiAgICAgICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHRoaXMucXVlcnkoKSk7XG4gICAgICAgICAgICAvLyBkZXRlY3QgZnV0dXJlIGNoYW5nZSBldmVudCAtIGlmIG5lZWRlZFxuICAgICAgICAgICAgdGhpcy5fX2RldGVjdF9mdXR1cmVfY2hhbmdlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBERVRFQ1QgRlVUVVJFIENIQU5HRVxuICAgICAqIFxuICAgICAqIFBST0JMRU06XG4gICAgICogXG4gICAgICogRHVyaW5nIHBsYXliYWNrIChjdXJzb3IuY3RybCBpcyBkeW5hbWljKSwgdGhlcmUgaXMgYSBuZWVkIHRvIFxuICAgICAqIGRldGVjdCB0aGUgcGFzc2luZyBmcm9tIG9uZSBzZWdtZW50IGludGVydmFsIG9mIHNyY1xuICAgICAqIHRvIHRoZSBuZXh0IC0gaWRlYWxseSBhdCBwcmVjaXNlbHkgdGhlIGNvcnJlY3QgdGltZVxuICAgICAqIFxuICAgICAqIG5lYXJieS5pdHYgKGRlcml2ZWQgZnJvbSBjdXJzb3Iuc3JjKSBnaXZlcyB0aGUgXG4gICAgICogaW50ZXJ2YWwgKGkpIHdlIGFyZSBjdXJyZW50bHkgaW4sIGkuZS4sIFxuICAgICAqIGNvbnRhaW5pbmcgdGhlIGN1cnJlbnQgb2Zmc2V0ICh2YWx1ZSBvZiBjdXJzb3IuY3RybCksIFxuICAgICAqIGFuZCAoaWkpIHdoZXJlIG5lYXJieS5jZW50ZXIgc3RheXMgY29uc3RhbnRcbiAgICAgKiBcbiAgICAgKiBUaGUgZXZlbnQgdGhhdCBuZWVkcyB0byBiZSBkZXRlY3RlZCBpcyB0aGVyZWZvcmUgdGhlXG4gICAgICogbW9tZW50IHdoZW4gd2UgbGVhdmUgdGhpcyBpbnRlcnZhbCwgdGhyb3VnaCBlaXRoZXJcbiAgICAgKiB0aGUgbG93IG9yIGhpZ2ggaW50ZXJ2YWwgZW5kcG9pbnRcbiAgICAgKiBcbiAgICAgKiBHT0FMOlxuICAgICAqIFxuICAgICAqIEF0IHRoaXMgbW9tZW50LCB3ZSBzaW1wbHkgbmVlZCB0byByZWV2YWx1YXRlIHRoZSBzdGF0ZSAocXVlcnkpIGFuZFxuICAgICAqIGVtaXQgYSBjaGFuZ2UgZXZlbnQgdG8gbm90aWZ5IG9ic2VydmVycy4gXG4gICAgICogXG4gICAgICogQVBQUk9BQ0hFUzpcbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbMF0gXG4gICAgICogVGhlIHRyaXZpYWwgc29sdXRpb24gaXMgdG8gZG8gbm90aGluZywgaW4gd2hpY2ggY2FzZVxuICAgICAqIG9ic2VydmVycyB3aWxsIHNpbXBseSBmaW5kIG91dCB0aGVtc2VsdmVzIGFjY29yZGluZyB0byB0aGVpciBcbiAgICAgKiBvd24gcG9sbCBmcmVxdWVuY3kuIFRoaXMgaXMgc3Vib3B0aW1hbCwgcGFydGljdWxhcmx5IGZvciBsb3cgZnJlcXVlbmN5IFxuICAgICAqIG9ic2VydmVycy4gSWYgdGhlcmUgaXMgYXQgbGVhc3Qgb25lIGhpZ2gtZnJlcXVlbmN5IHBvbGxlciwgXG4gICAgICogdGhpcyB3b3VsZCB0cmlnZ2VyIHRyaWdnZXIgdGhlIHN0YXRlIGNoYW5nZSwgY2F1c2luZyBhbGxcbiAgICAgKiBvYnNlcnZlcnMgdG8gYmUgbm90aWZpZWQuIFRoZSBwcm9ibGVtIHRob3VnaCwgaXMgaWYgbm8gb2JzZXJ2ZXJzXG4gICAgICogYXJlIGFjdGl2ZWx5IHBvbGxpbmcsIGJ1dCBvbmx5IGRlcGVuZGluZyBvbiBjaGFuZ2UgZXZlbnRzLlxuICAgICAqIFxuICAgICAqIEFwcHJvYWNoIFsxXSBcbiAgICAgKiBJbiBjYXNlcyB3aGVyZSB0aGUgY3RybCBpcyBkZXRlcm1pbmlzdGljLCBhIHRpbWVvdXRcbiAgICAgKiBjYW4gYmUgY2FsY3VsYXRlZC4gVGhpcyBpcyB0cml2aWFsIGlmIGN0cmwgaXMgYSBDbG9ja0N1cnNvciwgYW5kXG4gICAgICogaXQgaXMgZmFpcmx5IGVhc3kgaWYgdGhlIGN0cmwgaXMgQ3Vyc29yIHJlcHJlc2VudGluZyBtb3Rpb25cbiAgICAgKiBvciBsaW5lYXIgdHJhbnNpdGlvbi4gSG93ZXZlciwgY2FsY3VsYXRpb25zIGNhbiBiZWNvbWUgbW9yZVxuICAgICAqIGNvbXBsZXggaWYgbW90aW9uIHN1cHBvcnRzIGFjY2VsZXJhdGlvbiwgb3IgaWYgdHJhbnNpdGlvbnNcbiAgICAgKiBhcmUgc2V0IHVwIHdpdGggbm9uLWxpbmVhciBlYXNpbmcuXG4gICAgICogICBcbiAgICAgKiBOb3RlLCBob3dldmVyLCB0aGF0IHRoZXNlIGNhbGN1bGF0aW9ucyBhc3N1bWUgdGhhdCB0aGUgY3Vyc29yLmN0cmwgaXMgXG4gICAgICogYSBDbG9ja0N1cnNvciwgb3IgdGhhdCBjdXJzb3IuY3RybC5jdHJsIGlzIGEgQ2xvY2tDdXJzb3IuIFxuICAgICAqIEluIHByaW5jaXBsZSwgdGhvdWdoLCB0aGVyZSBjb3VsZCBiZSBhIHJlY3Vyc2l2ZSBjaGFpbiBvZiBjdXJzb3JzLFxuICAgICAqIChjdXJzb3IuY3RybC5jdHJsLi4uLmN0cmwpIG9mIHNvbWUgbGVuZ3RoLCB3aGVyZSBvbmx5IHRoZSBsYXN0IGlzIGEgXG4gICAgICogQ2xvY2tDdXJzb3IuIEluIG9yZGVyIHRvIGRvIGRldGVybWluaXN0aWMgY2FsY3VsYXRpb25zIGluIHRoZSBnZW5lcmFsXG4gICAgICogY2FzZSwgYWxsIGN1cnNvcnMgaW4gdGhlIGNoYWluIHdvdWxkIGhhdmUgdG8gYmUgbGltaXRlZCB0byBcbiAgICAgKiBkZXRlcm1pbmlzdGljIGxpbmVhciB0cmFuc2Zvcm1hdGlvbnMuXG4gICAgICogXG4gICAgICogQXBwcm9jaCBbMl0gXG4gICAgICogSXQgbWlnaHQgYWxzbyBiZSBwb3NzaWJsZSB0byBzYW1wbGUgZnV0dXJlIHZhbHVlcyBvZiBcbiAgICAgKiBjdXJzb3IuY3RybCB0byBzZWUgaWYgdGhlIHZhbHVlcyB2aW9sYXRlIHRoZSBuZWFyYnkuaXR2IGF0IHNvbWUgcG9pbnQuIFxuICAgICAqIFRoaXMgd291bGQgZXNzZW50aWFsbHkgYmUgdHJlYXRpbmcgY3RybCBhcyBhIGxheWVyIGFuZCBzYW1wbGluZyBcbiAgICAgKiBmdXR1cmUgdmFsdWVzLiBUaGlzIGFwcHJvY2ggd291bGQgd29yayBmb3IgYWxsIHR5cGVzLCBcbiAgICAgKiBidXQgdGhlcmUgaXMgbm8ga25vd2luZyBob3cgZmFyIGludG8gdGhlIGZ1dHVyZSBvbmUgXG4gICAgICogd291bGQgaGF2ZSB0byBzZWVrLiBIb3dldmVyLCBhZ2FpbiAtIGFzIGluIFsxXSB0aGUgYWJpbGl0eSB0byBzYW1wbGUgZnV0dXJlIHZhbHVlc1xuICAgICAqIGlzIHByZWRpY2F0ZWQgb24gY3Vyc29yLmN0cmwgYmVpbmcgYSBDbG9ja0N1cnNvci4gQWxzbywgdGhlcmUgXG4gICAgICogaXMgbm8gd2F5IG9mIGtub3dpbmcgaG93IGxvbmcgaW50byB0aGUgZnV0dXJlIHNhbXBsaW5nIHdvdWxkIGJlIG5lY2Vzc2FyeS5cbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbM10gXG4gICAgICogSW4gdGhlIGdlbmVyYWwgY2FzZSwgdGhlIG9ubHkgd2F5IHRvIHJlbGlhYmxleSBkZXRlY3QgdGhlIGV2ZW50IGlzIHRocm91Z2ggcmVwZWF0ZWRcbiAgICAgKiBwb2xsaW5nLiBBcHByb2FjaCBbM10gaXMgc2ltcGx5IHRoZSBpZGVhIHRoYXQgdGhpcyBwb2xsaW5nIGlzIHBlcmZvcm1lZFxuICAgICAqIGludGVybmFsbHkgYnkgdGhlIGN1cnNvciBpdHNlbGYsIGFzIGEgd2F5IG9mIHNlY3VyaW5nIGl0cyBvd24gY29uc2lzdGVudFxuICAgICAqIHN0YXRlLCBhbmQgZW5zdXJpbmcgdGhhdCBvYnNlcnZlciBnZXQgY2hhbmdlIGV2ZW50cyBpbiBhIHRpbWVseSBtYW5uZXIsIGV2ZW50XG4gICAgICogaWYgdGhleSBkbyBsb3ctZnJlcXVlbmN5IHBvbGxpbmcsIG9yIGRvIG5vdCBkbyBwb2xsaW5nIGF0IGFsbC4gXG4gICAgICogXG4gICAgICogU09MVVRJT046XG4gICAgICogQXMgdGhlcmUgaXMgbm8gcGVyZmVjdCBzb2x1dGlvbiBpbiB0aGUgZ2VuZXJhbCBjYXNlLCB3ZSBvcHBvcnR1bmlzdGljYWxseVxuICAgICAqIHVzZSBhcHByb2FjaCBbMV0gd2hlbiB0aGlzIGlzIHBvc3NpYmxlLiBJZiBub3QsIHdlIGFyZSBmYWxsaW5nIGJhY2sgb24gXG4gICAgICogYXBwcm9hY2ggWzNdXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIE5PIGV2ZW50IGRldGVjdGlvbiBpcyBuZWVkZWQgKE5PT1ApXG4gICAgICogKGkpIGN1cnNvci5jdHJsIGlzIG5vdCBkeW5hbWljXG4gICAgICogb3JcbiAgICAgKiAoaWkpIG5lYXJieS5pdHYgc3RyZXRjaGVzIGludG8gaW5maW5pdHkgaW4gYm90aCBkaXJlY3Rpb25zXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIGFwcHJvYWNoIFsxXSBjYW4gYmUgdXNlZFxuICAgICAqIFxuICAgICAqIChpKSBpZiBjdHJsIGlzIGEgQ2xvY2tDdXJzb3IgJiYgbmVhcmJ5Lml0di5oaWdoIDwgSW5maW5pdHlcbiAgICAgKiBvclxuICAgICAqIChpaSkgY3RybC5jdHJsIGlzIGEgQ2xvY2tDdXJzb3JcbiAgICAgKiAgICAgIChhKSBjdHJsLm5lYXJieS5jZW50ZXIgaGFzIGV4YWN0bHkgMSBpdGVtXG4gICAgICogICAgICAmJlxuICAgICAqICAgICAgKGIpIGN0cmwubmVhcmJ5LmNlbnRlclswXS50eXBlID09IChcIm1vdGlvblwiKSB8fCAoXCJ0cmFuc2l0aW9uXCIgJiYgZWFzaW5nPT1cImxpbmVhclwiKVxuICAgICAqICAgICAgJiZcbiAgICAgKiAgICAgIChjKSBjdHJsLm5lYXJieS5jZW50ZXJbMF0uZGF0YS52ZWxvY2l0eSAhPSAwLjBcbiAgICAgKiAgICAgICYmIFxuICAgICAqICAgICAgKGQpIGZ1dHVyZSBpbnRlcnNlY3RvbiBwb2ludCB3aXRoIGNhY2hlLm5lYXJieS5pdHYgXG4gICAgICogICAgICAgICAgaXMgbm90IC1JbmZpbml0eSBvciBJbmZpbml0eVxuICAgICAqIFxuICAgICAqIFRob3VnaCBpdCBzZWVtcyBjb21wbGV4LCBjb25kaXRpb25zIGZvciBbMV0gc2hvdWxkIGJlIG1ldCBmb3IgY29tbW9uIGNhc2VzIGludm9sdmluZ1xuICAgICAqIHBsYXliYWNrLiBBbHNvLCB1c2Ugb2YgdHJhbnNpdGlvbiBldGMgbWlnaHQgYmUgcmFyZS5cbiAgICAgKiBcbiAgICAgKi9cblxuICAgIF9fZGV0ZWN0X2Z1dHVyZV9jaGFuZ2UoKSB7XG5cbiAgICAgICAgLy8gY3RybCBcbiAgICAgICAgY29uc3QgY3RybF92ZWN0b3IgPSB0aGlzLl9nZXRfY3RybF9zdGF0ZSgpO1xuICAgICAgICBjb25zdCB7dmFsdWU6Y3VycmVudF9wb3MsIG9mZnNldDpjdXJyZW50X3RzfSA9IGN0cmxfdmVjdG9yO1xuXG4gICAgICAgIC8vIGN0cmwgbXVzdCBiZSBkeW5hbWljXG4gICAgICAgIGlmICghY3RybF92ZWN0b3IuZHluYW1pYykge1xuICAgICAgICAgICAgLy8gbm8gZnV0dXJlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2V0IG5lYXJieSBmcm9tIHNyYyAtIHVzZSB2YWx1ZSBmcm9tIGN0cmxcbiAgICAgICAgY29uc3Qgc3JjX25lYXJieSA9IHRoaXMuc3JjLmluZGV4Lm5lYXJieShjdXJyZW50X3Bvcyk7XG4gICAgICAgIGNvbnN0IFtsb3csIGhpZ2hdID0gc3JjX25lYXJieS5pdHYuc2xpY2UoMCwyKTtcblxuICAgICAgICAvLyBhcHByb2FjaCBbMV1cbiAgICAgICAgaWYgKHRoaXMuY3RybCBpbnN0YW5jZW9mIENsb2NrUHJvdmlkZXJCYXNlKSB7XG4gICAgICAgICAgICBpZiAoaXNGaW5pdGUoaGlnaCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9fc2V0X3RpbWVvdXQoaGlnaCwgY3VycmVudF9wb3MsIDEuMCwgY3VycmVudF90cyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbm8gZnV0dXJlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IFxuICAgICAgICBpZiAodGhpcy5jdHJsLmN0cmwgaW5zdGFuY2VvZiBDbG9ja1Byb3ZpZGVyQmFzZSkge1xuICAgICAgICAgICAgLyoqIFxuICAgICAgICAgICAgICogdGhpcy5jdHJsIFxuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAgKiBoYXMgbWFueSBwb3NzaWJsZSBiZWhhdmlvcnNcbiAgICAgICAgICAgICAqIHRoaXMuY3RybCBoYXMgYW4gaW5kZXggdXNlIHRoaXMgdG8gZmlndXJlIG91dCB3aGljaFxuICAgICAgICAgICAgICogYmVoYXZpb3VyIGlzIGN1cnJlbnQuXG4gICAgICAgICAgICAgKiBcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICAvLyB1c2UgdGhlIHNhbWUgb2Zmc2V0IHRoYXQgd2FzIHVzZWQgaW4gdGhlIGN0cmwucXVlcnlcbiAgICAgICAgICAgIGNvbnN0IGN0cmxfbmVhcmJ5ID0gdGhpcy5jdHJsLmluZGV4Lm5lYXJieShjdXJyZW50X3RzKTtcblxuICAgICAgICAgICAgaWYgKCFpc0Zpbml0ZShsb3cpICYmICFpc0Zpbml0ZShoaWdoKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vIGZ1dHVyZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY3RybF9uZWFyYnkuY2VudGVyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY3RybF9pdGVtID0gY3RybF9uZWFyYnkuY2VudGVyWzBdO1xuICAgICAgICAgICAgICAgIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHt2ZWxvY2l0eSwgYWNjZWxlcmF0aW9uPTAuMH0gPSBjdHJsX2l0ZW0uZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjY2VsZXJhdGlvbiA9PSAwLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdGFyZ2V0X3BvcyA9ICh2ZWxvY2l0eSA+IDApID8gaGlnaCA6IGxvdztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0Zpbml0ZSh0YXJnZXRfcG9zKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjsgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBubyBmdXR1cmUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gYWNjZWxlcmF0aW9uIC0gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7djA6cDAsIHYxOnAxLCB0MCwgdDEsIGVhc2luZz1cImxpbmVhclwifSA9IGN0cmxfaXRlbS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZWFzaW5nID09IFwibGluZWFyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2ZWxvY2l0eSA9IChwMS1wMCkvKHQxLXQwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRfcG9zID0gKHZlbG9jaXR5ID4gMCkgPyBNYXRoLm1pbihoaWdoLCBwMSkgOiBNYXRoLm1heChsb3csIHAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBvdGhlciBlYXNpbmcgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gb3RoZXIgdHlwZSAoaW50ZXJwb2xhdGlvbikgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIG1vcmUgdGhhbiBvbmUgc2VnbWVudCAtIHBvc3NpYmxlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0IC0gYXBwcm9hY2ggWzNdXG4gICAgICAgIHRoaXMuX19zZXRfcG9sbGluZyhzcmNfbmVhcmJ5Lml0dik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc2V0IHRpbWVvdXRcbiAgICAgKiAtIHByb3RlY3RzIGFnYWluc3QgdG9vIGVhcmx5IGNhbGxiYWNrcyBieSByZXNjaGVkdWxpbmdcbiAgICAgKiB0aW1lb3V0IGlmIG5lY2Nlc3NhcnkuXG4gICAgICogLSBhZGRzIGEgbWlsbGlzZWNvbmQgdG8gb3JpZ2luYWwgdGltZW91dCB0byBhdm9pZFxuICAgICAqIGZyZXF1ZW50IHJlc2NoZWR1bGluZyBcbiAgICAgKi9cblxuICAgIF9fc2V0X3RpbWVvdXQodGFyZ2V0X3BvcywgY3VycmVudF9wb3MsIHZlbG9jaXR5LCBjdXJyZW50X3RzKSB7XG4gICAgICAgIGNvbnN0IGRlbHRhX3NlYyA9ICh0YXJnZXRfcG9zIC0gY3VycmVudF9wb3MpIC8gdmVsb2NpdHk7XG4gICAgICAgIGNvbnN0IHRhcmdldF90cyA9IGN1cnJlbnRfdHMgKyBkZWx0YV9zZWM7XG4gICAgICAgIHRoaXMuX3RpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV90aW1lb3V0KHRhcmdldF90cyk7XG4gICAgICAgIH0sIGRlbHRhX3NlYyoxMDAwICsgMSk7XG4gICAgfVxuXG4gICAgX19oYW5kbGVfdGltZW91dCh0YXJnZXRfdHMpIHtcbiAgICAgICAgY29uc3QgdHMgPSB0aGlzLl9nZXRfY3RybF9zdGF0ZSgpLm9mZnNldDtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nX3NlYyA9IHRhcmdldF90cyAtIHRzOyBcbiAgICAgICAgaWYgKHJlbWFpbmluZ19zZWMgPD0gMCkge1xuICAgICAgICAgICAgLy8gZG9uZVxuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV9jaGFuZ2UoXCJ0aW1lb3V0XCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcmVzY2hlZHVsZSB0aW1lb3V0XG4gICAgICAgICAgICB0aGlzLl90aWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9faGFuZGxlX3RpbWVvdXQodGFyZ2V0X3RzKVxuICAgICAgICAgICAgfSwgcmVtYWluaW5nX3NlYyoxMDAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNldCBwb2xsaW5nXG4gICAgICovXG5cbiAgICBfX3NldF9wb2xsaW5nKGl0dikge1xuICAgICAgICB0aGlzLl9waWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9faGFuZGxlX3BvbGwoaXR2KTtcbiAgICAgICAgfSwgMTAwKTtcbiAgICB9XG5cbiAgICBfX2hhbmRsZV9wb2xsKGl0dikge1xuICAgICAgICBsZXQgb2Zmc2V0ID0gdGhpcy5xdWVyeSgpLnZhbHVlO1xuICAgICAgICBpZiAoIWludGVydmFsLmNvdmVyc19wb2ludChpdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgIHRoaXMuX19oYW5kbGVfY2hhbmdlKFwidGltZW91dFwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfZ2V0X2N0cmxfc3RhdGUgKCkge1xuICAgICAgICBpZiAodGhpcy5jdHJsIGluc3RhbmNlb2YgQ2xvY2tQcm92aWRlckJhc2UpIHtcbiAgICAgICAgICAgIGxldCB0cyA9IHRoaXMuY3RybC5ub3coKTtcbiAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dHMsIGR5bmFtaWM6dHJ1ZSwgb2Zmc2V0OnRzfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBzdGF0ZSA9IHRoaXMuY3RybC5xdWVyeSgpO1xuICAgICAgICAgICAgLy8gVE9ETyAtIHByb3RlY3QgYWdhaW5zdCBub24tZmxvYXQgdmFsdWVzXG4gICAgICAgICAgICBpZiAodHlwZW9mIHN0YXRlLnZhbHVlICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3RybCBzdGF0ZSBtdXN0IGJlIG51bWJlciAke3N0YXRlLnZhbHVlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcXVlcnkgKCkge1xuICAgICAgICBjb25zdCBvZmZzZXQgPSB0aGlzLl9nZXRfY3RybF9zdGF0ZSgpLnZhbHVlOyAgXG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIGdldCB2YWx1ZSAoKSB7cmV0dXJuIHRoaXMucXVlcnkoKS52YWx1ZX07XG4gICAgZ2V0IGluZGV4ICgpIHtyZXR1cm4gdGhpcy5zcmMuaW5kZXh9O1xuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBVUERBVEUgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBhc3NpZ24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzLnNyYy5zcmMuc3JjKS5hc3NpZ24odmFsdWUpO1xuICAgIH1cbiAgICBtb3ZlICh7cG9zaXRpb24sIHZlbG9jaXR5fSkge1xuICAgICAgICBsZXQge3ZhbHVlLCBvZmZzZXQ6dGltZXN0YW1wfSA9IHRoaXMucXVlcnkoKTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3Vyc29yIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7dmFsdWV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcG9zaXRpb24gPSAocG9zaXRpb24gIT0gdW5kZWZpbmVkKSA/IHBvc2l0aW9uIDogdmFsdWU7XG4gICAgICAgIHZlbG9jaXR5ID0gKHZlbG9jaXR5ICE9IHVuZGVmaW5lZCkgPyB2ZWxvY2l0eTogMDtcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzLnNyYy5zcmMuc3JjKS5tb3ZlKHtwb3NpdGlvbiwgdmVsb2NpdHksIHRpbWVzdGFtcH0pO1xuICAgIH1cbiAgICB0cmFuc2l0aW9uICh7dGFyZ2V0LCBkdXJhdGlvbiwgZWFzaW5nfSkge1xuICAgICAgICBsZXQge3ZhbHVlOnYwLCBvZmZzZXQ6dDB9ID0gdGhpcy5xdWVyeSgpO1xuICAgICAgICBpZiAodHlwZW9mIHYwICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3Igc3RhdGUgbXVzdCBiZSBudW1iZXIgJHt2MH1gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY21kKHRoaXMuc3JjLnNyYy5zcmMpLnRyYW5zaXRpb24odjAsIHRhcmdldCwgdDAsIHQwICsgZHVyYXRpb24sIGVhc2luZyk7XG4gICAgfVxuICAgIGludGVycG9sYXRlICh7dHVwbGVzLCBkdXJhdGlvbn0pIHtcbiAgICAgICAgbGV0IHQwID0gdGhpcy5xdWVyeSgpLm9mZnNldDtcbiAgICAgICAgLy8gYXNzdW1pbmcgdGltc3RhbXBzIGFyZSBpbiByYW5nZSBbMCwxXVxuICAgICAgICAvLyBzY2FsZSB0aW1lc3RhbXBzIHRvIGR1cmF0aW9uXG4gICAgICAgIHR1cGxlcyA9IHR1cGxlcy5tYXAoKFt2LHRdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3YsIHQwICsgdCpkdXJhdGlvbl07XG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiBjbWQodGhpcy5zcmMuc3JjLnNyYykuaW50ZXJwb2xhdGUodHVwbGVzKTtcbiAgICB9XG5cbn1cbnNvdXJjZXByb3AuYWRkVG9Qcm90b3R5cGUoQ3Vyc29yLnByb3RvdHlwZSwgXCJzcmNcIiwge211dGFibGU6dHJ1ZX0pO1xuc291cmNlcHJvcC5hZGRUb1Byb3RvdHlwZShDdXJzb3IucHJvdG90eXBlLCBcImN0cmxcIiwge211dGFibGU6dHJ1ZX0pO1xuXG4iLCJpbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTkVBUkJZIElOREVYXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogQWJzdHJhY3Qgc3VwZXJjbGFzcyBmb3IgTmVhcmJ5SW5kZXhlLlxuICogXG4gKiBTdXBlcmNsYXNzIHVzZWQgdG8gY2hlY2sgdGhhdCBhIGNsYXNzIGltcGxlbWVudHMgdGhlIG5lYXJieSgpIG1ldGhvZCwgXG4gKiBhbmQgcHJvdmlkZSBzb21lIGNvbnZlbmllbmNlIG1ldGhvZHMuXG4gKiBcbiAqIE5FQVJCWSBJTkRFWFxuICogXG4gKiBOZWFyYnlJbmRleCBwcm92aWRlcyBpbmRleGluZyBzdXBwb3J0IG9mIGVmZmVjdGl2ZWx5bG9va2luZyB1cCBJVEVNUyBieSBvZmZzZXQsIFxuICogZ2l2ZW4gdGhhdFxuICogKGkpIGVhY2ggZW50cml5IGlzIGFzc29jaWF0ZWQgd2l0aCBhbiBpbnRlcnZhbCBhbmQsXG4gKiAoaWkpIGVudHJpZXMgYXJlIG5vbi1vdmVybGFwcGluZy5cbiAqIEVhY2ggSVRFTSBtdXN0IGJlIGFzc29jaWF0ZWQgd2l0aCBhbiBpbnRlcnZhbCBvbiB0aGUgdGltZWxpbmUgXG4gKiBcbiAqIE5FQVJCWVxuICogVGhlIG5lYXJieSBtZXRob2QgcmV0dXJucyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbmVpZ2hib3Job29kIGFyb3VuZCBlbmRwb2ludC4gXG4gKiBcbiAqIFByaW1hcnkgdXNlIGlzIGZvciBpdGVyYXRpb24gXG4gKiBcbiAqIFJldHVybnMge1xuICogICAgICBjZW50ZXI6IGxpc3Qgb2YgSVRFTVMgY292ZXJpbmcgZW5kcG9pbnQsXG4gKiAgICAgIGl0djogaW50ZXJ2YWwgd2hlcmUgbmVhcmJ5IHJldHVybnMgaWRlbnRpY2FsIHtjZW50ZXJ9XG4gKiAgICAgIGxlZnQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgbGVmdCBcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGhpZ2gtZW5kcG9pbnQgb3IgdW5kZWZpbmVkXG4gKiAgICAgIHJpZ2h0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0XG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBsb3ctZW5kcG9pbnQgb3IgdW5kZWZpbmVkICAgICAgICAgXG4gKiAgICAgIHByZXY6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgbGVmdCBcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQgJiYgbm9uLWVtcHR5IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBoaWdoLWVuZHBvaW50IG9yIHVuZGVmaW5lZCBpZiBubyBtb3JlIGludGVydmFscyB0byB0aGUgbGVmdFxuICogICAgICBuZXh0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0XG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50ICYmIG5vbi1lbXB0eSB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgbG93LWVuZHBvaW50IG9yIHVuZGVmaW5lZCBpZiBubyBtb3JlIGludGVydmFscyB0byB0aGUgcmlnaHRcbiAqIH1cbiAqIFxuICogXG4gKiBUaGUgbmVhcmJ5IHN0YXRlIGlzIHdlbGwtZGVmaW5lZCBmb3IgZXZlcnkgdGltZWxpbmUgcG9zaXRpb24uXG4gKiBcbiAqIFxuICogTk9URSBsZWZ0L3JpZ2h0IGFuZCBwcmV2L25leHQgYXJlIG1vc3RseSB0aGUgc2FtZS4gVGhlIG9ubHkgZGlmZmVyZW5jZSBpcyBcbiAqIHRoYXQgcHJldi9uZXh0IHdpbGwgc2tpcCBvdmVyIHJlZ2lvbnMgd2hlcmUgdGhlcmUgYXJlIG5vIGludGVydmFscy4gVGhpc1xuICogZW5zdXJlcyBwcmFjdGljYWwgaXRlcmF0aW9uIG9mIGl0ZW1zIGFzIHByZXYvbmV4dCB3aWxsIG9ubHkgYmUgdW5kZWZpbmVkICBcbiAqIGF0IHRoZSBlbmQgb2YgaXRlcmF0aW9uLlxuICogXG4gKiBJTlRFUlZBTFNcbiAqIFxuICogW2xvdywgaGlnaCwgbG93SW5jbHVzaXZlLCBoaWdoSW5jbHVzaXZlXVxuICogXG4gKiBUaGlzIHJlcHJlc2VudGF0aW9uIGVuc3VyZXMgdGhhdCB0aGUgaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBvcmRlcmVkIGFuZCBhbGxvd3NcbiAqIGludGVydmFscyB0byBiZSBleGNsdXNpdmUgb3IgaW5jbHVzaXZlLCB5ZXQgY292ZXIgdGhlIGVudGlyZSByZWFsIGxpbmUgXG4gKiBcbiAqIFthLGJdLCAoYSxiKSwgW2EsYiksIFthLCBiKSBhcmUgYWxsIHZhbGlkIGludGVydmFsc1xuICogXG4gKiBcbiAqIElOVEVSVkFMIEVORFBPSU5UU1xuICogXG4gKiBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIGRlZmluZWQgYnkgW3ZhbHVlLCBzaWduXSwgZm9yIGV4YW1wbGVcbiAqIFxuICogNCkgLT4gWzQsLTFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIGxlZnQgb2YgNFxuICogWzQsIDQsIDRdIC0+IFs0LCAwXSAtIGVuZHBvaW50IGlzIGF0IDQgXG4gKiAoNCAtPiBbNCwgMV0gLSBlbmRwb2ludCBpcyBvbiB0aGUgcmlnaHQgb2YgNClcbiAqIFxuICogLyAqL1xuXG4gZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4QmFzZSB7XG5cblxuICAgIC8qIFxuICAgICAgICBOZWFyYnkgbWV0aG9kXG4gICAgKi9cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cblxuICAgIC8qXG4gICAgICAgIHJldHVybiBsb3cgcG9pbnQgb2YgbGVmdG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGZpcnN0KCkge1xuICAgICAgICBsZXQge2NlbnRlciwgcmlnaHR9ID0gdGhpcy5uZWFyYnkoWy1JbmZpbml0eSwgMF0pO1xuICAgICAgICByZXR1cm4gKGNlbnRlci5sZW5ndGggPiAwKSA/IFstSW5maW5pdHksIDBdIDogcmlnaHQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGhpZ2ggcG9pbnQgb2YgcmlnaHRtb3N0IGVudHJ5XG4gICAgKi9cbiAgICBsYXN0KCkge1xuICAgICAgICBsZXQge2xlZnQsIGNlbnRlcn0gPSB0aGlzLm5lYXJieShbSW5maW5pdHksIDBdKTtcbiAgICAgICAgcmV0dXJuIChjZW50ZXIubGVuZ3RoID4gMCkgPyBbSW5maW5pdHksIDBdIDogbGVmdFxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIExpc3QgaXRlbXMgb2YgTmVhcmJ5SW5kZXggKG9yZGVyIGxlZnQgdG8gcmlnaHQpXG4gICAgICAgIGludGVydmFsIGRlZmluZXMgW3N0YXJ0LCBlbmRdIG9mZnNldCBvbiB0aGUgdGltZWxpbmUuXG4gICAgICAgIFJldHVybnMgbGlzdCBvZiBpdGVtLWxpc3RzLlxuICAgICAgICBvcHRpb25zXG4gICAgICAgIC0gc3RhcnRcbiAgICAgICAgLSBzdG9wXG4gICAgKi9cbiAgICBsaXN0KG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtzdGFydD0tSW5maW5pdHksIHN0b3A9SW5maW5pdHl9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHN0YXJ0ID4gc3RvcCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIChcInN0b3AgbXVzdCBiZSBsYXJnZXIgdGhhbiBzdGFydFwiLCBzdGFydCwgc3RvcClcbiAgICAgICAgfVxuICAgICAgICBzdGFydCA9IFtzdGFydCwgMF07XG4gICAgICAgIHN0b3AgPSBbc3RvcCwgMF07XG4gICAgICAgIGxldCBjdXJyZW50ID0gc3RhcnQ7XG4gICAgICAgIGxldCBuZWFyYnk7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICAgICAgbGV0IGxpbWl0ID0gNVxuICAgICAgICB3aGlsZSAobGltaXQpIHtcbiAgICAgICAgICAgIGlmIChlbmRwb2ludC5ndChjdXJyZW50LCBzdG9wKSkge1xuICAgICAgICAgICAgICAgIC8vIGV4aGF1c3RlZFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmVhcmJ5ID0gdGhpcy5uZWFyYnkoY3VycmVudCk7XG4gICAgICAgICAgICBpZiAobmVhcmJ5LmNlbnRlci5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgICAgIC8vIGNlbnRlciBlbXB0eSAodHlwaWNhbGx5IGZpcnN0IGl0ZXJhdGlvbilcbiAgICAgICAgICAgICAgICBpZiAobmVhcmJ5LnJpZ2h0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyByaWdodCB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gbm8gZW50cmllcyAtIGFscmVhZHkgZXhoYXVzdGVkXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IGRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IG9mZnNldFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gbmVhcmJ5LnJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKG5lYXJieS5jZW50ZXIpO1xuICAgICAgICAgICAgICAgIGlmIChuZWFyYnkucmlnaHQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBsYXN0IGVudHJ5IC0gbWFyayBpdGVyYWN0b3IgZXhoYXVzdGVkXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IGRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IG9mZnNldFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gbmVhcmJ5LnJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxpbWl0LS07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxufVxuXG5cblxuXG5cbiIsImltcG9ydCB7IGVuZHBvaW50LCBpbnRlcnZhbCB9IGZyb20gXCIuLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuLi9uZWFyYnlpbmRleC5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi4vbmV3bGF5ZXIuanNcIlxuXG5cbi8qKlxuICogUmV0dXJucyBhIExheWVyIHJlcHJlc2VudGluZyBhIGxheWVyXG4gKiByZXByZXNlbnRpbmcgdGhlIG1lcmdpbmcgb2Ygc291cmNlcy5cbiAqL1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZSAoc291cmNlcywgdmFsdWVGdW5jKSB7XG5cbiAgICBjb25zdCBpbmRleCA9IG5ldyBNZXJnZUluZGV4KHNvdXJjZXMpO1xuXG4gICAgLy8gY3JlYXRlIGxheWVyXG4gICAgcmV0dXJuIG5ldyBMYXllcih7aW5kZXgsIHZhbHVlRnVuY30pO1xufVxuXG5cblxuXG5cblxuZnVuY3Rpb24gY21wX2FzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAxLCBwMilcbn1cblxuZnVuY3Rpb24gY21wX2Rlc2NlbmRpbmcocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmNtcChwMiwgcDEpXG59XG5cbi8qKlxuICogTWVyZ2luZyBpbmRleGVzIGZyb20gbXVsdGlwbGUgc291cmNlcyBpbnRvIGEgc2luZ2xlIGluZGV4LlxuICogXG4gKiBBIHNvdXJjZSBpcyBhbiBvYmplY3Qgd2l0aCBhbiBpbmRleC5cbiAqIC0gbGF5ZXJcbiAqIC0gZGF0YXNvdXJjZVxuICogXG4gKiBUaGUgbWVyZ2VkIGluZGV4IGdpdmVzIGEgdGVtcG9yYWwgc3RydWN0dXJlIGZvciB0aGVcbiAqIGNvbGxlY3Rpb24gb2Ygc291cmNlcywgY29tcHV0aW5nIGEgbGlzdCBvZlxuICogc291cmNlcyB3aGljaCBhcmUgZGVmaW5lZCBhdCBhIGdpdmVuIG9mZnNldFxuICogXG4gKiBuZWFyYnkob2Zmc2V0KS5jZW50ZXIgaXMgYSBsaXN0IG9mIGl0ZW1zXG4gKiBbe2l0diwgc3JjfV1cbiAqIFxuICogSW1wbGVtZW50YWlvbiBpcyBzdGF0ZWxlc3MuXG4gKi9cblxuZXhwb3J0IGNsYXNzIE1lcmdlSW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Ioc291cmNlcykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9zb3VyY2VzID0gc291cmNlcztcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIC8vIGFjY3VtdWxhdGUgbmVhcmJ5IGZyb20gYWxsIHNvdXJjZXNcbiAgICAgICAgY29uc3QgcHJldl9saXN0ID0gW10sIGNlbnRlcl9saXN0ID0gW10sIG5leHRfbGlzdCA9IFtdO1xuICAgICAgICBmb3IgKGxldCBzcmMgb2YgdGhpcy5fc291cmNlcykge1xuICAgICAgICAgICAgbGV0IHtpdHYsIHByZXYsIGNlbnRlciwgbmV4dH0gPSBzcmMuaW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgICAgICBpZiAocHJldiAhPSB1bmRlZmluZWQpIHByZXZfbGlzdC5wdXNoKHByZXYpOyAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKG5leHQgIT0gdW5kZWZpbmVkKSBuZXh0X2xpc3QucHVzaChuZXh0KTtcbiAgICAgICAgICAgIGlmIChjZW50ZXIgPiAwKSB7XG4gICAgICAgICAgICAgICAgY2VudGVyX2xpc3QucHVzaCh7aXR2LCBzcmN9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gZmluZCBjbG9zZXN0IGVuZHBvaW50IHRvIHRoZSByaWdodCAobm90IGluIGNlbnRlcilcbiAgICAgICAgbmV4dF9saXN0LnNvcnQoY21wX2FzY2VuZGluZyk7XG4gICAgICAgIGNvbnN0IG1pbl9uZXh0X2xvdyA9IG5leHRfbGlzdFswXSB8fCBbSW5maW5pdHksIDBdO1xuXG4gICAgICAgIC8vIGZpbmQgY2xvc2VzdCBlbmRwb2ludCB0byB0aGUgbGVmdCAobm90IGluIGNlbnRlcilcbiAgICAgICAgcHJldl9saXN0LnNvcnQoY21wX2Rlc2NlbmRpbmcpO1xuICAgICAgICBjb25zdCBtYXhfcHJldl9oaWdoID0gcHJldl9saXN0WzBdIHx8IFstSW5maW5pdHksIDBdO1xuXG4gICAgICAgIC8vIG5lYXJieVxuICAgICAgICBsZXQgbG93LCBoaWdoOyBcbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgICAgY2VudGVyOiBjZW50ZXJfbGlzdCwgXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2VudGVyX2xpc3QubGVuZ3RoID09IDApIHtcblxuICAgICAgICAgICAgLy8gZW1wdHkgY2VudGVyXG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSBtaW5fbmV4dF9sb3c7ICAgICAgIFxuICAgICAgICAgICAgcmVzdWx0Lm5leHQgPSBtaW5fbmV4dF9sb3c7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IG1heF9wcmV2X2hpZ2g7XG4gICAgICAgICAgICByZXN1bHQucHJldiA9IG1heF9wcmV2X2hpZ2g7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gbm9uLWVtcHR5IGNlbnRlclxuXG4gICAgICAgICAgICAvLyBjZW50ZXIgaGlnaFxuICAgICAgICAgICAgbGV0IGNlbnRlcl9oaWdoX2xpc3QgPSBjZW50ZXJfbGlzdC5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMV07XG4gICAgICAgICAgICB9KS5zb3J0KGNtcF9hc2NlbmRpbmcpO1xuICAgICAgICAgICAgbGV0IG1pbl9jZW50ZXJfaGlnaCA9IGNlbnRlcl9oaWdoX2xpc3RbMF07XG4gICAgICAgICAgICBsZXQgbWF4X2NlbnRlcl9oaWdoID0gY2VudGVyX2hpZ2hfbGlzdC5zbGljZSgtMSlbMF07XG4gICAgICAgICAgICBsZXQgbXVsdGlwbGVfY2VudGVyX2hpZ2ggPSAhZW5kcG9pbnQuZXEobWluX2NlbnRlcl9oaWdoLCBtYXhfY2VudGVyX2hpZ2gpXG5cbiAgICAgICAgICAgIC8vIGNlbnRlciBsb3dcbiAgICAgICAgICAgIGxldCBjZW50ZXJfbG93X2xpc3QgPSBjZW50ZXJfbGlzdC5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMF1cbiAgICAgICAgICAgIH0pLnNvcnQoY21wX2Rlc2NlbmRpbmcpO1xuICAgICAgICAgICAgbGV0IG1heF9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0WzBdO1xuICAgICAgICAgICAgbGV0IG1pbl9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0LnNsaWNlKC0xKVswXTtcbiAgICAgICAgICAgIGxldCBtdWx0aXBsZV9jZW50ZXJfbG93ID0gIWVuZHBvaW50LmVxKG1heF9jZW50ZXJfbG93LCBtaW5fY2VudGVyX2xvdylcblxuICAgICAgICAgICAgLy8gbmV4dC9yaWdodFxuICAgICAgICAgICAgaWYgKGVuZHBvaW50LmxlKG1pbl9uZXh0X2xvdywgbWluX2NlbnRlcl9oaWdoKSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IG1pbl9uZXh0X2xvdztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gZW5kcG9pbnQuZmxpcChtaW5fY2VudGVyX2hpZ2gsIFwibG93XCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQubmV4dCA9IChtdWx0aXBsZV9jZW50ZXJfaGlnaCkgPyByZXN1bHQucmlnaHQgOiBtaW5fbmV4dF9sb3c7XG5cbiAgICAgICAgICAgIC8vIHByZXYvbGVmdFxuICAgICAgICAgICAgaWYgKGVuZHBvaW50LmdlKG1heF9wcmV2X2hpZ2gsIG1heF9jZW50ZXJfbG93KSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gbWF4X3ByZXZfaGlnaDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSBlbmRwb2ludC5mbGlwKG1heF9jZW50ZXJfbG93LCBcImhpZ2hcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQucHJldiA9IChtdWx0aXBsZV9jZW50ZXJfbG93KSA/IHJlc3VsdC5sZWZ0IDogbWF4X3ByZXZfaGlnaDsgICAgXG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnRlcnZhbCBmcm9tIGxlZnQvcmlnaHRcbiAgICAgICAgbG93ID0gZW5kcG9pbnQuZmxpcChyZXN1bHQubGVmdCwgXCJsb3dcIik7XG4gICAgICAgIGhpZ2ggPSBlbmRwb2ludC5mbGlwKHJlc3VsdC5yaWdodCwgXCJoaWdoXCIpO1xuICAgICAgICByZXN1bHQuaXR2ID0gaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKTtcblxuICAgICAgICAvLyBzd2l0Y2ggdG8gdW5kZWZpbmVkXG4gICAgICAgIGlmIChyZXN1bHQucHJldlswXSA9PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJlc3VsdC5wcmV2ID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQubGVmdFswXSA9PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQubmV4dFswXSA9PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgcmVzdWx0Lm5leHQgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdC5yaWdodFswXSA9PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59O1xuXG4iLCJpbXBvcnQgeyBpbnRlcnZhbCwgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuL25lYXJieWluZGV4LmpzXCI7XG5cbi8qKlxuICogXG4gKiBOZWFyYnkgSW5kZXggU2ltcGxlXG4gKiBcbiAqIC0gaXRlbXMgYXJlIGFzc3VtZWQgdG8gYmUgbm9uLW92ZXJsYXBwaW5nIG9uIHRoZSB0aW1lbGluZSwgXG4gKiAtIGltcGx5aW5nIHRoYXQgbmVhcmJ5LmNlbnRlciB3aWxsIGJlIGEgbGlzdCBvZiBhdCBtb3N0IG9uZSBJVEVNLiBcbiAqIC0gZXhjZXB0aW9uIHdpbGwgYmUgcmFpc2VkIGlmIG92ZXJsYXBwaW5nIElURU1TIGFyZSBmb3VuZFxuICogLSBJVEVNUyBpcyBhc3N1bWJlZCB0byBiZSBpbW11dGFibGUgYXJyYXkgLSBjaGFuZ2UgSVRFTVMgYnkgcmVwbGFjaW5nIGFycmF5XG4gKiBcbiAqICBcbiAqL1xuXG5cbi8vIGdldCBpbnRlcnZhbCBsb3cgcG9pbnRcbmZ1bmN0aW9uIGdldF9sb3dfdmFsdWUoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLml0dlswXTtcbn1cblxuLy8gZ2V0IGludGVydmFsIGxvdyBlbmRwb2ludFxuZnVuY3Rpb24gZ2V0X2xvd19lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzBdXG59XG5cbi8vIGdldCBpbnRlcnZhbCBoaWdoIGVuZHBvaW50XG5mdW5jdGlvbiBnZXRfaGlnaF9lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzFdXG59XG5cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4U2ltcGxlIGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKHNyYykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9zcmMgPSBzcmM7XG4gICAgfVxuXG4gICAgZ2V0IHNyYyAoKSB7cmV0dXJuIHRoaXMuX3NyYzt9XG5cbiAgICAvKlxuICAgICAgICBuZWFyYnkgYnkgb2Zmc2V0XG4gICAgICAgIFxuICAgICAgICByZXR1cm5zIHtsZWZ0LCBjZW50ZXIsIHJpZ2h0fVxuXG4gICAgICAgIGJpbmFyeSBzZWFyY2ggYmFzZWQgb24gb2Zmc2V0XG4gICAgICAgIDEpIGZvdW5kLCBpZHhcbiAgICAgICAgICAgIG9mZnNldCBtYXRjaGVzIHZhbHVlIG9mIGludGVydmFsLmxvdyBvZiBhbiBpdGVtXG4gICAgICAgICAgICBpZHggZ2l2ZXMgdGhlIGluZGV4IG9mIHRoaXMgaXRlbSBpbiB0aGUgYXJyYXlcbiAgICAgICAgMikgbm90IGZvdW5kLCBpZHhcbiAgICAgICAgICAgIG9mZnNldCBpcyBlaXRoZXIgY292ZXJlZCBieSBpdGVtIGF0IChpZHgtMSksXG4gICAgICAgICAgICBvciBpdCBpcyBub3QgPT4gYmV0d2VlbiBlbnRyaWVzXG4gICAgICAgICAgICBpbiB0aGlzIGNhc2UgLSBpZHggZ2l2ZXMgdGhlIGluZGV4IHdoZXJlIGFuIGl0ZW1cbiAgICAgICAgICAgIHNob3VsZCBiZSBpbnNlcnRlZCAtIGlmIGl0IGhhZCBsb3cgPT0gb2Zmc2V0XG4gICAgKi9cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgb2Zmc2V0ID0gW29mZnNldCwgMF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG9mZnNldCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVuZHBvaW50IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgICAgY2VudGVyOiBbXSxcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgbGVmdDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgcmlnaHQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHByZXY6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIG5leHQ6IHVuZGVmaW5lZFxuICAgICAgICB9O1xuICAgICAgICBsZXQgaXRlbXMgPSB0aGlzLl9zcmMuZ2V0X2l0ZW1zKCk7XG4gICAgICAgIGxldCBpbmRleGVzLCBpdGVtO1xuICAgICAgICBjb25zdCBzaXplID0gaXRlbXMubGVuZ3RoO1xuICAgICAgICBpZiAoc2l6ZSA9PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0OyBcbiAgICAgICAgfVxuICAgICAgICBsZXQgW2ZvdW5kLCBpZHhdID0gZmluZF9pbmRleChvZmZzZXRbMF0sIGl0ZW1zLCBnZXRfbG93X3ZhbHVlKTtcbiAgICAgICAgaWYgKGZvdW5kKSB7XG4gICAgICAgICAgICAvLyBzZWFyY2ggb2Zmc2V0IG1hdGNoZXMgaXRlbSBsb3cgZXhhY3RseVxuICAgICAgICAgICAgLy8gY2hlY2sgdGhhdCBpdCBpbmRlZWQgY292ZXJlZCBieSBpdGVtIGludGVydmFsXG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4XVxuICAgICAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19lbmRwb2ludChpdGVtLml0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgIGluZGV4ZXMgPSB7bGVmdDppZHgtMSwgY2VudGVyOmlkeCwgcmlnaHQ6aWR4KzF9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChpbmRleGVzID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gY2hlY2sgcHJldiBpdGVtXG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4LTFdO1xuICAgICAgICAgICAgaWYgKGl0ZW0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgaWYgc2VhcmNoIG9mZnNldCBpcyBjb3ZlcmVkIGJ5IGl0ZW0gaW50ZXJ2YWxcbiAgICAgICAgICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KGl0ZW0uaXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ZXMgPSB7bGVmdDppZHgtMiwgY2VudGVyOmlkeC0xLCByaWdodDppZHh9O1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cdFxuICAgICAgICBpZiAoaW5kZXhlcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIHByZXYgaXRlbSBlaXRoZXIgZG9lcyBub3QgZXhpc3Qgb3IgaXMgbm90IHJlbGV2YW50XG4gICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTEsIGNlbnRlcjotMSwgcmlnaHQ6aWR4fTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNlbnRlclxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLmNlbnRlciAmJiBpbmRleGVzLmNlbnRlciA8IHNpemUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5jZW50ZXIgPSAgW2l0ZW1zW2luZGV4ZXMuY2VudGVyXV07XG4gICAgICAgIH1cbiAgICAgICAgLy8gcHJldi9uZXh0XG4gICAgICAgIGlmICgwIDw9IGluZGV4ZXMubGVmdCAmJiBpbmRleGVzLmxlZnQgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQucHJldiA9ICBnZXRfaGlnaF9lbmRwb2ludChpdGVtc1tpbmRleGVzLmxlZnRdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLnJpZ2h0ICYmIGluZGV4ZXMucmlnaHQgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQubmV4dCA9ICBnZXRfbG93X2VuZHBvaW50KGl0ZW1zW2luZGV4ZXMucmlnaHRdKTtcbiAgICAgICAgfSAgICAgICAgXG4gICAgICAgIC8vIGxlZnQvcmlnaHRcbiAgICAgICAgbGV0IGxvdywgaGlnaDtcbiAgICAgICAgaWYgKHJlc3VsdC5jZW50ZXIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IGl0diA9IHJlc3VsdC5jZW50ZXJbMF0uaXR2O1xuICAgICAgICAgICAgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0dik7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IChsb3dbMF0gPiAtSW5maW5pdHkpID8gZW5kcG9pbnQuZmxpcChsb3csIFwiaGlnaFwiKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IChoaWdoWzBdIDwgSW5maW5pdHkpID8gZW5kcG9pbnQuZmxpcChoaWdoLCBcImxvd1wiKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VsdC5pdHYgPSByZXN1bHQuY2VudGVyWzBdLml0djtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gcmVzdWx0LnByZXY7XG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSByZXN1bHQubmV4dDtcbiAgICAgICAgICAgIC8vIGludGVydmFsXG4gICAgICAgICAgICBsZXQgbGVmdCA9IHJlc3VsdC5sZWZ0O1xuICAgICAgICAgICAgbG93ID0gKGxlZnQgPT0gdW5kZWZpbmVkKSA/IFstSW5maW5pdHksIDBdIDogZW5kcG9pbnQuZmxpcChsZWZ0LCBcImxvd1wiKTtcbiAgICAgICAgICAgIGxldCByaWdodCA9IHJlc3VsdC5yaWdodDtcbiAgICAgICAgICAgIGhpZ2ggPSAocmlnaHQgPT0gdW5kZWZpbmVkKSA/IFtJbmZpbml0eSwgMF0gOiBlbmRwb2ludC5mbGlwKHJpZ2h0LCBcImhpZ2hcIik7XG4gICAgICAgICAgICByZXN1bHQuaXR2ID0gaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXHRVVElMU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5cbi8qXG5cdGJpbmFyeSBzZWFyY2ggZm9yIGZpbmRpbmcgdGhlIGNvcnJlY3QgaW5zZXJ0aW9uIGluZGV4IGludG9cblx0dGhlIHNvcnRlZCBhcnJheSAoYXNjZW5kaW5nKSBvZiBpdGVtc1xuXHRcblx0YXJyYXkgY29udGFpbnMgb2JqZWN0cywgYW5kIHZhbHVlIGZ1bmMgcmV0cmVhdmVzIGEgdmFsdWVcblx0ZnJvbSBlYWNoIG9iamVjdC5cblxuXHRyZXR1cm4gW2ZvdW5kLCBpbmRleF1cbiovXG5cbmZ1bmN0aW9uIGZpbmRfaW5kZXgodGFyZ2V0LCBhcnIsIHZhbHVlX2Z1bmMpIHtcblxuICAgIGZ1bmN0aW9uIGRlZmF1bHRfdmFsdWVfZnVuYyhlbCkge1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgfVxuICAgIFxuICAgIGxldCBsZWZ0ID0gMDtcblx0bGV0IHJpZ2h0ID0gYXJyLmxlbmd0aCAtIDE7XG5cdHZhbHVlX2Z1bmMgPSB2YWx1ZV9mdW5jIHx8IGRlZmF1bHRfdmFsdWVfZnVuYztcblx0d2hpbGUgKGxlZnQgPD0gcmlnaHQpIHtcblx0XHRjb25zdCBtaWQgPSBNYXRoLmZsb29yKChsZWZ0ICsgcmlnaHQpIC8gMik7XG5cdFx0bGV0IG1pZF92YWx1ZSA9IHZhbHVlX2Z1bmMoYXJyW21pZF0pO1xuXHRcdGlmIChtaWRfdmFsdWUgPT09IHRhcmdldCkge1xuXHRcdFx0cmV0dXJuIFt0cnVlLCBtaWRdOyAvLyBUYXJnZXQgYWxyZWFkeSBleGlzdHMgaW4gdGhlIGFycmF5XG5cdFx0fSBlbHNlIGlmIChtaWRfdmFsdWUgPCB0YXJnZXQpIHtcblx0XHRcdCAgbGVmdCA9IG1pZCArIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSByaWdodFxuXHRcdH0gZWxzZSB7XG5cdFx0XHQgIHJpZ2h0ID0gbWlkIC0gMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIGxlZnRcblx0XHR9XG5cdH1cbiAgXHRyZXR1cm4gW2ZhbHNlLCBsZWZ0XTsgLy8gUmV0dXJuIHRoZSBpbmRleCB3aGVyZSB0YXJnZXQgc2hvdWxkIGJlIGluc2VydGVkXG59XG4iLCJpbXBvcnQge0xheWVyfSBmcm9tIFwiLi9uZXdsYXllci5qc1wiO1xuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UgfSBmcm9tIFwiLi9iYXNlcy5qc1wiO1xuaW1wb3J0ICogYXMgc291cmNlcHJvcCBmcm9tIFwiLi9zb3VyY2Vwcm9wLmpzXCI7XG5pbXBvcnQgeyBMb2NhbFN0YXRlUHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX3NpbXBsZS5qc1wiO1xuaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4U2ltcGxlIH0gZnJvbSBcIi4vbmVhcmJ5aW5kZXhfc2ltcGxlXCI7XG5pbXBvcnQgeyB0b1N0YXRlIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0ICogYXMgc2VnbWVudCBmcm9tIFwiLi9zZWdtZW50cy5qc1wiO1xuXG5leHBvcnQgY2xhc3MgSW5wdXRMYXllciBleHRlbmRzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtzcmMsIHZhbHVlRnVuYywgLi4ub3B0c30gPSBvcHRpb25zO1xuICAgICAgICBzdXBlcihJbnB1dExheWVyQ2FjaGUsIHZhbHVlRnVuYyk7XG4gICAgICAgIC8vIHNyY1xuICAgICAgICBzb3VyY2Vwcm9wLmFkZFRvSW5zdGFuY2UodGhpcywgXCJzcmNcIik7XG5cbiAgICAgICAgLy8gaW5pdGlhbGlzZSB3aXRoIHN0YXRlcHJvdmlkZXJcbiAgICAgICAgaWYgKHNyYyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNyYyA9IG5ldyBMb2NhbFN0YXRlUHJvdmlkZXIob3B0cyk7XG4gICAgICAgIH0gICAgICAgIFxuICAgICAgICB0aGlzLnNyYyA9IHNyYztcbiAgICB9XG5cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogU1JDIChzdGF0ZXByb3ZpZGVyKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgX19zcmNfY2hlY2soc3JjKSB7XG4gICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcInNyY1wiIG11c3QgYmUgc3RhdGUgcHJvdmlkZXIgJHtzcmN9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNyYztcbiAgICB9ICAgIFxuICAgIF9fc3JjX2hhbmRsZV9jaGFuZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbmRleCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwic2V0IGluZGV4XCIpO1xuICAgICAgICAgICAgdGhpcy5faW5kZXggPSBuZXcgTmVhcmJ5SW5kZXhTaW1wbGUodGhpcy5zcmMpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNsZWFyQ2FjaGVzKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgIC8vIHRyaWdnZXIgY2hhbmdlIGV2ZW50IGZvciBjdXJzb3JcbiAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIik7ICAgXG4gICAgfVxuXG5cblxufVxuc291cmNlcHJvcC5hZGRUb1Byb3RvdHlwZShJbnB1dExheWVyLnByb3RvdHlwZSwgXCJzcmNcIiwge211dGFibGU6dHJ1ZX0pO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBJTlBVVExBWUVSIENBQ0hFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgVGhpcyBpbXBsZW1lbnRzIGEgY2FjaGUgaW4gZnJvbnQgb2YgYSBTdGF0ZVByb3ZpZGVyICAgIFxuICAgIC0gaW5kZXggY29udGFpbnMgc2VnbWVudCBpdGVtc1xuKi9cblxuZXhwb3J0IGNsYXNzIElucHV0TGF5ZXJDYWNoZSB7XG4gICAgY29uc3RydWN0b3IobGF5ZXIpIHtcbiAgICAgICAgLy8gbGF5ZXJcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgLy8gY2FjaGVkIG5lYXJieSBvYmplY3RcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjYWNoZWQgc2VnbWVudFxuICAgICAgICB0aGlzLl9zZWdtZW50ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICAvLyBjaGVjayBjYWNoZVxuICAgICAgICBpZiAoXG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAhaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX25lYXJieS5pdHYsIG9mZnNldClcbiAgICAgICAgKSB7XG4gICAgICAgICAgICAvLyBjYWNoZSBtaXNzXG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPSB0aGlzLl9sYXllci5pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgICAgIGxldCB7aXR2LCBjZW50ZXJ9ID0gdGhpcy5fbmVhcmJ5O1xuICAgICAgICAgICAgdGhpcy5fc2VnbWVudHMgPSBjZW50ZXIubWFwKChpdGVtKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZV9zZWdtZW50KGl0diwgaXRlbSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBxdWVyeVxuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9zZWdtZW50cy5tYXAoKHNlZykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHNlZy5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRvU3RhdGUoc3RhdGVzLCB0aGlzLl9sYXllci52YWx1ZUZ1bmMpXG4gICAgfVxuXG4gICAgY2xlYXIoKSB7XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICB9XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0FEIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gY3JlYXRlX3NlZ21lbnQoaXR2LCBpdGVtKSB7XG4gICAgbGV0IHt0eXBlLCBkYXRhfSA9IGl0ZW07XG4gICAgaWYgKHR5cGUgPT0gXCJzdGF0aWNcIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuU3RhdGljU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuVHJhbnNpdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJpbnRlcnBvbGF0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LkludGVycG9sYXRpb25TZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwibW90aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50Lk1vdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhcInVucmVjb2duaXplZCBzZWdtZW50IHR5cGVcIiwgdHlwZSk7XG4gICAgfVxufVxuXG4iXSwibmFtZXMiOlsiUFJFRklYIiwiYWRkVG9JbnN0YW5jZSIsImFkZFRvUHJvdG90eXBlIiwiY2FsbGJhY2suYWRkVG9JbnN0YW5jZSIsImNhbGxiYWNrLmFkZFRvUHJvdG90eXBlIiwiaW50ZXJwb2xhdGUiLCJsYXllcnNvdXJjZS5hZGRUb0luc3RhbmNlIiwibGF5ZXJzb3VyY2UuYWRkVG9Qcm90b3R5cGUiLCJzb3VyY2Vwcm9wLmFkZFRvSW5zdGFuY2UiLCJzb3VyY2Vwcm9wLmFkZFRvUHJvdG90eXBlIiwic2VnbWVudC5TdGF0aWNTZWdtZW50Iiwic2VnbWVudC5UcmFuc2l0aW9uU2VnbWVudCIsInNlZ21lbnQuSW50ZXJwb2xhdGlvblNlZ21lbnQiLCJzZWdtZW50Lk1vdGlvblNlZ21lbnQiXSwibWFwcGluZ3MiOiI7Ozs7O0lBQ0E7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTs7SUFFQSxNQUFNLEtBQUssR0FBRyxZQUFZO0lBQzFCLElBQUksT0FBTyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTTtJQUNuQzs7SUFFQSxNQUFNLEtBQUssR0FBRyxZQUFZO0lBQzFCLElBQUksT0FBTyxJQUFJLElBQUksRUFBRSxDQUFDLE1BQU07SUFDNUI7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVPLE1BQU0sS0FBSyxHQUFHLFlBQVk7SUFDakMsSUFBSSxNQUFNLFFBQVEsR0FBRyxLQUFLLEVBQUU7SUFDNUIsSUFBSSxNQUFNLFFBQVEsR0FBRyxLQUFLLEVBQUU7SUFDNUIsSUFBSSxPQUFPO0lBQ1gsUUFBUSxHQUFHLEVBQUUsWUFBWTtJQUN6QixZQUFZLE9BQU8sUUFBUSxJQUFJLEtBQUssRUFBRSxHQUFHLFFBQVE7SUFDakQ7SUFDQTtJQUNBLENBQUMsRUFBRTs7O0lBR0g7SUFD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QVEsSUFBSSxTQUFTLElBQUksUUFBUSxFQUFFLENBQUM7SUFDeEQsUUFBUSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQzFFO0lBQ0EsSUFBSSxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLEVBQUU7SUFDNUMsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRTtJQUNoRCxRQUFRLElBQUksT0FBTyxFQUFFLEtBQUssUUFBUSxFQUFFO0lBQ3BDLFlBQVksTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLHFDQUFxQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDekU7SUFDQSxRQUFRLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsUUFBUSxFQUFFLE1BQU0sQ0FBQztJQUN0RjtJQUNBLElBQUksV0FBVyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLEVBQUU7SUFDckMsUUFBUSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsTUFBTTtJQUNwQztJQUNBO0lBQ0EsUUFBUSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLO0lBQ3ZDLFlBQVksT0FBTyxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQztJQUN2QyxTQUFTO0lBQ1QsUUFBUSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFH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
