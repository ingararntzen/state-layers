
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

    function addToInstance (object, CacheClass, valueFunc) {
        object[`${PREFIX}_index`];
        object[`${PREFIX}_valueFunc`] = valueFunc;
        object[`${PREFIX}_cacheClass`] = CacheClass;
        object[`${PREFIX}_cacheObjects`] = [];
    }

    function addToPrototype (_prototype) {

        Object.defineProperty(_prototype, "index", {
            get: function () {
                return this[`${PREFIX}_index`];
            },
            set: function (index) {
                this[`${PREFIX}_index`] = index;
            }
        });
        Object.defineProperty(_prototype, "valueFunc", {
            get: function () {
                return this[`${PREFIX}_valueFunc`];
            }
        });

        function getCache () {
            let CacheClass = this[`${PREFIX}_cacheClass`];
            console.log(CacheClass);
            const cache = new CacheClass(this);
            this[`${PREFIX}_cacheObjects`].push(cache);
            return cache;
        }

        function clearCaches () {
            for (let cache of this[`${PREFIX}_cacheObjects`]) {
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

        constructor(CacheClass, valueFunc) {
            // callbacks
            addToInstance$2(this);
            // layer source api
            addToInstance(this, CacheClass, valueFunc);
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

    /*********************************************************************
        INPUT LAYER
    *********************************************************************/

    /**
     * InputLayer is a Layer with a stateprovider.
     * 
     * .src : stateprovider.
     */

    class InputLayer extends Layer {

        constructor(options={}) {
            let {src, valueFunc, ...opts} = options;
            super(InputLayerCache, valueFunc);
            // src
            addToInstance$1(this, "src");

            // initialise stateprovider
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
            if (this.index == undefined) {
                this.index = new NearbyIndexSimple(this.src);
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
        This implements a cache for an InputLayer 
        Since InputLayer has a state provider, its index is
        items, and the cache will instantiate segments corresponding to
        these items. 
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

    exports.Cursor = Cursor;
    exports.InputLayer = InputLayer;
    exports.cmd = cmd;
    exports.merge = merge;

    return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsLmpzIiwiLi4vLi4vc3JjL2V2ZW50aWZ5LmpzIiwiLi4vLi4vc3JjL21vbml0b3IuanMiLCIuLi8uLi9zcmMvaW50ZXJ2YWxzLmpzIiwiLi4vLi4vc3JjL2FwaV9jYWxsYmFjay5qcyIsIi4uLy4uL3NyYy9iYXNlcy5qcyIsIi4uLy4uL3NyYy9zb3VyY2Vwcm9wLmpzIiwiLi4vLi4vc3JjL2NtZC5qcyIsIi4uLy4uL3NyYy9hcGlfbGF5ZXJzb3VyY2UuanMiLCIuLi8uLi9zcmMvbmV3bGF5ZXIuanMiLCIuLi8uLi9zcmMvc3RhdGVwcm92aWRlcl9zaW1wbGUuanMiLCIuLi8uLi9zcmMvc2VnbWVudHMuanMiLCIuLi8uLi9zcmMvc3RhdGVwcm92aWRlcl9tb3Rpb24uanMiLCIuLi8uLi9zcmMvY3Vyc29ycy5qcyIsIi4uLy4uL3NyYy9uZWFyYnlpbmRleC5qcyIsIi4uLy4uL3NyYy9vcHMvbWVyZ2UuanMiLCIuLi8uLi9zcmMvbmVhcmJ5aW5kZXhfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL2lucHV0X2xheWVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIENMT0NLU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIGNsb2NrcyBjb3VudGluZyBpbiBzZWNvbmRzXG4gKi9cblxuY29uc3QgbG9jYWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHBlcmZvcm1hbmNlLm5vdygpLzEwMDAuMDtcbn1cblxuY29uc3QgZXBvY2ggPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIG5ldyBEYXRlKCkvMTAwMC4wO1xufVxuXG4vKipcbiAqIHRoZSBjbG9jayBnaXZlcyBlcG9jaCB2YWx1ZXMsIGJ1dCBpcyBpbXBsZW1lbnRlZFxuICogdXNpbmcgYSBoaWdoIHBlcmZvcm1hbmNlIGxvY2FsIGNsb2NrIGZvciBiZXR0ZXJcbiAqIHRpbWUgcmVzb2x1dGlvbiBhbmQgcHJvdGVjdGlvbiBhZ2FpbnN0IHN5c3RlbSBcbiAqIHRpbWUgYWRqdXN0bWVudHMuXG4gKi9cblxuZXhwb3J0IGNvbnN0IENMT0NLID0gZnVuY3Rpb24gKCkge1xuICAgIGNvbnN0IHQwX2xvY2FsID0gbG9jYWwoKTtcbiAgICBjb25zdCB0MF9lcG9jaCA9IGVwb2NoKCk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgbm93OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdDBfZXBvY2ggKyAobG9jYWwoKSAtIHQwX2xvY2FsKVxuICAgICAgICB9XG4gICAgfVxufSgpO1xuXG5cbi8vIG92dmVycmlkZSBtb2R1bG8gdG8gYmVoYXZlIGJldHRlciBmb3IgbmVnYXRpdmUgbnVtYmVyc1xuZXhwb3J0IGZ1bmN0aW9uIG1vZChuLCBtKSB7XG4gICAgcmV0dXJuICgobiAlIG0pICsgbSkgJSBtO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRpdm1vZCh4LCBiYXNlKSB7XG4gICAgbGV0IG4gPSBNYXRoLmZsb29yKHggLyBiYXNlKVxuICAgIGxldCByID0gbW9kKHgsIGJhc2UpO1xuICAgIHJldHVybiBbbiwgcl07XG59XG5cblxuLypcbiAgICBzaW1pbGFyIHRvIHJhbmdlIGZ1bmN0aW9uIGluIHB5dGhvblxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmdlIChzdGFydCwgZW5kLCBzdGVwID0gMSwgb3B0aW9ucz17fSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgIGNvbnN0IHtpbmNsdWRlX2VuZD1mYWxzZX0gPSBvcHRpb25zO1xuICAgIGlmIChzdGVwID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU3RlcCBjYW5ub3QgYmUgemVyby4nKTtcbiAgICB9XG4gICAgaWYgKHN0YXJ0IDwgZW5kKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSBzdGVwKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goaSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHN0YXJ0ID4gZW5kKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydDsgaSA+IGVuZDsgaSAtPSBzdGVwKSB7XG4gICAgICAgICAgcmVzdWx0LnB1c2goaSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGluY2x1ZGVfZW5kKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKGVuZCk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cblxuLyoqXG4gKiBDcmVhdGUgYSBzaW5nbGUgc3RhdGUgZnJvbSBhIGxpc3Qgb2Ygc3RhdGVzLCB1c2luZyBhIHN0YXRlRnVuY1xuICogc3RhdGVzOnt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0fVxuICogXG4gKiBcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gdG9TdGF0ZShzdGF0ZXMsIHZhbHVlRnVuYywgb2Zmc2V0KSB7XG4gICAgaWYgKHN0YXRlcy5sZW5ndGggPT0gMCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOnVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fVxuICAgICAgICAvKipcbiAgICAgICAgICAgIFRPRE8gLSBkbyBzb21ldGhpbmcgd2l0aCB2YWx1ZUZ1bmNcbiAgICAgICAgICAgIGNvbnN0IGR5bmFtaWMgPSBzdGF0ZXMubWFwKCh2KSA9PiB2LmR5bmFtaWMpO1xuICAgICAgICAgICAgY29uc3QgdmFsdWVzID0gc3RhdGVzLm1hcCgodikgPT4gdi52YWx1ZSk7XG4gICAgICAgIFxuICAgICAgICAgICAgRm9yIG5vdyAtIGp1c3QgcmV0dXJuIHRoZSBmaXJzdCBzdGF0ZVxuICAgICAgICAqL1xuICAgIH1cbiAgICBsZXQgc3RhdGUgPSBzdGF0ZXNbMF07XG4gICAgcmV0dXJuIHsuLi5zdGF0ZSwgb2Zmc2V0fTsgXG59IiwiLypcblx0Q29weXJpZ2h0IDIwMjBcblx0QXV0aG9yIDogSW5nYXIgQXJudHplblxuXG5cdFRoaXMgZmlsZSBpcyBwYXJ0IG9mIHRoZSBUaW1pbmdzcmMgbW9kdWxlLlxuXG5cdFRpbWluZ3NyYyBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5XG5cdGl0IHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieVxuXHR0aGUgRnJlZSBTb2Z0d2FyZSBGb3VuZGF0aW9uLCBlaXRoZXIgdmVyc2lvbiAzIG9mIHRoZSBMaWNlbnNlLCBvclxuXHQoYXQgeW91ciBvcHRpb24pIGFueSBsYXRlciB2ZXJzaW9uLlxuXG5cdFRpbWluZ3NyYyBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLFxuXHRidXQgV0lUSE9VVCBBTlkgV0FSUkFOVFk7IHdpdGhvdXQgZXZlbiB0aGUgaW1wbGllZCB3YXJyYW50eSBvZlxuXHRNRVJDSEFOVEFCSUxJVFkgb3IgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuICBTZWUgdGhlXG5cdEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZSBkZXRhaWxzLlxuXG5cdFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZVxuXHRhbG9uZyB3aXRoIFRpbWluZ3NyYy4gIElmIG5vdCwgc2VlIDxodHRwOi8vd3d3LmdudS5vcmcvbGljZW5zZXMvPi5cbiovXG5cblxuXG4vKlxuXHRFdmVudFxuXHQtIG5hbWU6IGV2ZW50IG5hbWVcblx0LSBwdWJsaXNoZXI6IHRoZSBvYmplY3Qgd2hpY2ggZGVmaW5lZCB0aGUgZXZlbnRcblx0LSBpbml0OiB0cnVlIGlmIHRoZSBldmVudCBzdXBwcG9ydHMgaW5pdCBldmVudHNcblx0LSBzdWJzY3JpcHRpb25zOiBzdWJzY3JpcHRpbnMgdG8gdGhpcyBldmVudFxuXG4qL1xuXG5jbGFzcyBFdmVudCB7XG5cblx0Y29uc3RydWN0b3IgKHB1Ymxpc2hlciwgbmFtZSwgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5wdWJsaXNoZXIgPSBwdWJsaXNoZXI7XG5cdFx0dGhpcy5uYW1lID0gbmFtZTtcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gZmFsc2UgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zID0gW107XG5cdH1cblxuXHQvKlxuXHRcdHN1YnNjcmliZSB0byBldmVudFxuXHRcdC0gc3Vic2NyaWJlcjogc3Vic2NyaWJpbmcgb2JqZWN0XG5cdFx0LSBjYWxsYmFjazogY2FsbGJhY2sgZnVuY3Rpb24gdG8gaW52b2tlXG5cdFx0LSBvcHRpb25zOlxuXHRcdFx0aW5pdDogaWYgdHJ1ZSBzdWJzY3JpYmVyIHdhbnRzIGluaXQgZXZlbnRzXG5cdCovXG5cdHN1YnNjcmliZSAoY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRpZiAoIWNhbGxiYWNrIHx8IHR5cGVvZiBjYWxsYmFjayAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJDYWxsYmFjayBub3QgYSBmdW5jdGlvblwiLCBjYWxsYmFjayk7XG5cdFx0fVxuXHRcdGNvbnN0IHN1YiA9IG5ldyBTdWJzY3JpcHRpb24odGhpcywgY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5wdXNoKHN1Yik7XG5cdCAgICAvLyBJbml0aWF0ZSBpbml0IGNhbGxiYWNrIGZvciB0aGlzIHN1YnNjcmlwdGlvblxuXHQgICAgaWYgKHRoaXMuaW5pdCAmJiBzdWIuaW5pdCkge1xuXHQgICAgXHRzdWIuaW5pdF9wZW5kaW5nID0gdHJ1ZTtcblx0ICAgIFx0bGV0IHNlbGYgPSB0aGlzO1xuXHQgICAgXHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uICgpIHtcblx0ICAgIFx0XHRjb25zdCBlQXJncyA9IHNlbGYucHVibGlzaGVyLmV2ZW50aWZ5SW5pdEV2ZW50QXJncyhzZWxmLm5hbWUpIHx8IFtdO1xuXHQgICAgXHRcdHN1Yi5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0ICAgIFx0XHRmb3IgKGxldCBlQXJnIG9mIGVBcmdzKSB7XG5cdCAgICBcdFx0XHRzZWxmLnRyaWdnZXIoZUFyZywgW3N1Yl0sIHRydWUpO1xuXHQgICAgXHRcdH1cblx0ICAgIFx0fSk7XG5cdCAgICB9XG5cdFx0cmV0dXJuIHN1YlxuXHR9XG5cblx0Lypcblx0XHR0cmlnZ2VyIGV2ZW50XG5cblx0XHQtIGlmIHN1YiBpcyB1bmRlZmluZWQgLSBwdWJsaXNoIHRvIGFsbCBzdWJzY3JpcHRpb25zXG5cdFx0LSBpZiBzdWIgaXMgZGVmaW5lZCAtIHB1Ymxpc2ggb25seSB0byBnaXZlbiBzdWJzY3JpcHRpb25cblx0Ki9cblx0dHJpZ2dlciAoZUFyZywgc3VicywgaW5pdCkge1xuXHRcdGxldCBlSW5mbywgY3R4O1xuXHRcdGZvciAoY29uc3Qgc3ViIG9mIHN1YnMpIHtcblx0XHRcdC8vIGlnbm9yZSB0ZXJtaW5hdGVkIHN1YnNjcmlwdGlvbnNcblx0XHRcdGlmIChzdWIudGVybWluYXRlZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGVJbmZvID0ge1xuXHRcdFx0XHRzcmM6IHRoaXMucHVibGlzaGVyLFxuXHRcdFx0XHRuYW1lOiB0aGlzLm5hbWUsXG5cdFx0XHRcdHN1Yjogc3ViLFxuXHRcdFx0XHRpbml0OiBpbml0XG5cdFx0XHR9XG5cdFx0XHRjdHggPSBzdWIuY3R4IHx8IHRoaXMucHVibGlzaGVyO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0c3ViLmNhbGxiYWNrLmNhbGwoY3R4LCBlQXJnLCBlSW5mbyk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYEVycm9yIGluICR7dGhpcy5uYW1lfTogJHtzdWIuY2FsbGJhY2t9ICR7ZXJyfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qXG5cdHVuc3Vic2NyaWJlIGZyb20gZXZlbnRcblx0LSB1c2Ugc3Vic2NyaXB0aW9uIHJldHVybmVkIGJ5IHByZXZpb3VzIHN1YnNjcmliZVxuXHQqL1xuXHR1bnN1YnNjcmliZShzdWIpIHtcblx0XHRsZXQgaWR4ID0gdGhpcy5zdWJzY3JpcHRpb25zLmluZGV4T2Yoc3ViKTtcblx0XHRpZiAoaWR4ID4gLTEpIHtcblx0XHRcdHRoaXMuc3Vic2NyaXB0aW9ucy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdHN1Yi50ZXJtaW5hdGUoKTtcblx0XHR9XG5cdH1cbn1cblxuXG4vKlxuXHRTdWJzY3JpcHRpb24gY2xhc3NcbiovXG5cbmNsYXNzIFN1YnNjcmlwdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoZXZlbnQsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLmV2ZW50ID0gZXZlbnQ7XG5cdFx0dGhpcy5uYW1lID0gZXZlbnQubmFtZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gY2FsbGJhY2tcblx0XHR0aGlzLmluaXQgPSAob3B0aW9ucy5pbml0ID09PSB1bmRlZmluZWQpID8gdGhpcy5ldmVudC5pbml0IDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gZmFsc2U7XG5cdFx0dGhpcy5jdHggPSBvcHRpb25zLmN0eDtcblx0fVxuXG5cdHRlcm1pbmF0ZSgpIHtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSB0cnVlO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5ldmVudC51bnN1YnNjcmliZSh0aGlzKTtcblx0fVxufVxuXG5cbi8qXG5cblx0RVZFTlRJRlkgSU5TVEFOQ0VcblxuXHRFdmVudGlmeSBicmluZ3MgZXZlbnRpbmcgY2FwYWJpbGl0aWVzIHRvIGFueSBvYmplY3QuXG5cblx0SW4gcGFydGljdWxhciwgZXZlbnRpZnkgc3VwcG9ydHMgdGhlIGluaXRpYWwtZXZlbnQgcGF0dGVybi5cblx0T3B0LWluIGZvciBpbml0aWFsIGV2ZW50cyBwZXIgZXZlbnQgdHlwZS5cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlJbnN0YW5jZSAob2JqZWN0KSB7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwID0gbmV3IE1hcCgpO1xuXHRvYmplY3QuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0cmV0dXJuIG9iamVjdDtcbn07XG5cblxuLypcblx0RVZFTlRJRlkgUFJPVE9UWVBFXG5cblx0QWRkIGV2ZW50aWZ5IGZ1bmN0aW9uYWxpdHkgdG8gcHJvdG90eXBlIG9iamVjdFxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5UHJvdG90eXBlKF9wcm90b3R5cGUpIHtcblxuXHRmdW5jdGlvbiBldmVudGlmeUdldEV2ZW50KG9iamVjdCwgbmFtZSkge1xuXHRcdGNvbnN0IGV2ZW50ID0gb2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAuZ2V0KG5hbWUpO1xuXHRcdGlmIChldmVudCA9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IHVuZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0cmV0dXJuIGV2ZW50O1xuXHR9XG5cblx0Lypcblx0XHRERUZJTkUgRVZFTlRcblx0XHQtIHVzZWQgb25seSBieSBldmVudCBzb3VyY2Vcblx0XHQtIG5hbWU6IG5hbWUgb2YgZXZlbnRcblx0XHQtIG9wdGlvbnM6IHtpbml0OnRydWV9IHNwZWNpZmllcyBpbml0LWV2ZW50IHNlbWFudGljcyBmb3IgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlEZWZpbmUobmFtZSwgb3B0aW9ucykge1xuXHRcdC8vIGNoZWNrIHRoYXQgZXZlbnQgZG9lcyBub3QgYWxyZWFkeSBleGlzdFxuXHRcdGlmICh0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuaGFzKG5hbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCBhbHJlYWR5IGRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5zZXQobmFtZSwgbmV3IEV2ZW50KHRoaXMsIG5hbWUsIG9wdGlvbnMpKTtcblx0fTtcblxuXHQvKlxuXHRcdE9OXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRyZWdpc3RlciBjYWxsYmFjayBvbiBldmVudC5cblx0Ki9cblx0ZnVuY3Rpb24gb24obmFtZSwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpYmUoY2FsbGJhY2ssIG9wdGlvbnMpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T0ZGXG5cdFx0LSB1c2VkIGJ5IHN1YnNjcmliZXJcblx0XHRVbi1yZWdpc3RlciBhIGhhbmRsZXIgZnJvbSBhIHNwZWNmaWMgZXZlbnQgdHlwZVxuXHQqL1xuXHRmdW5jdGlvbiBvZmYoc3ViKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgc3ViLm5hbWUpLnVuc3Vic2NyaWJlKHN1Yik7XG5cdH07XG5cblxuXHRmdW5jdGlvbiBldmVudGlmeVN1YnNjcmlwdGlvbnMobmFtZSkge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmlwdGlvbnM7XG5cdH1cblxuXG5cblx0Lypcblx0XHRUcmlnZ2VyIGxpc3Qgb2YgZXZlbnRJdGVtcyBvbiBvYmplY3RcblxuXHRcdGV2ZW50SXRlbTogIHtuYW1lOi4uLCBlQXJnOi4ufVxuXG5cdFx0Y29weSBhbGwgZXZlbnRJdGVtcyBpbnRvIGJ1ZmZlci5cblx0XHRyZXF1ZXN0IGVtcHR5aW5nIHRoZSBidWZmZXIsIGkuZS4gYWN0dWFsbHkgdHJpZ2dlcmluZyBldmVudHMsXG5cdFx0ZXZlcnkgdGltZSB0aGUgYnVmZmVyIGdvZXMgZnJvbSBlbXB0eSB0byBub24tZW1wdHlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxsKGV2ZW50SXRlbXMpIHtcblx0XHRpZiAoZXZlbnRJdGVtcy5sZW5ndGggPT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIG1ha2UgdHJpZ2dlciBpdGVtc1xuXHRcdC8vIHJlc29sdmUgbm9uLXBlbmRpbmcgc3Vic2NyaXB0aW9ucyBub3dcblx0XHQvLyBlbHNlIHN1YnNjcmlwdGlvbnMgbWF5IGNoYW5nZSBmcm9tIHBlbmRpbmcgdG8gbm9uLXBlbmRpbmdcblx0XHQvLyBiZXR3ZWVuIGhlcmUgYW5kIGFjdHVhbCB0cmlnZ2VyaW5nXG5cdFx0Ly8gbWFrZSBsaXN0IG9mIFtldiwgZUFyZywgc3Vic10gdHVwbGVzXG5cdFx0bGV0IHRyaWdnZXJJdGVtcyA9IGV2ZW50SXRlbXMubWFwKChpdGVtKSA9PiB7XG5cdFx0XHRsZXQge25hbWUsIGVBcmd9ID0gaXRlbTtcblx0XHRcdGxldCBldiA9IGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSk7XG5cdFx0XHRsZXQgc3VicyA9IGV2LnN1YnNjcmlwdGlvbnMuZmlsdGVyKHN1YiA9PiBzdWIuaW5pdF9wZW5kaW5nID09IGZhbHNlKTtcblx0XHRcdHJldHVybiBbZXYsIGVBcmcsIHN1YnNdO1xuXHRcdH0sIHRoaXMpO1xuXG5cdFx0Ly8gYXBwZW5kIHRyaWdnZXIgSXRlbXMgdG8gYnVmZmVyXG5cdFx0Y29uc3QgbGVuID0gdHJpZ2dlckl0ZW1zLmxlbmd0aDtcblx0XHRjb25zdCBidWYgPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyO1xuXHRcdGNvbnN0IGJ1Zl9sZW4gPSB0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aDtcblx0XHQvLyByZXNlcnZlIG1lbW9yeSAtIHNldCBuZXcgbGVuZ3RoXG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGggPSBidWZfbGVuICsgbGVuO1xuXHRcdC8vIGNvcHkgdHJpZ2dlckl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGZvciAobGV0IGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0YnVmW2J1Zl9sZW4raV0gPSB0cmlnZ2VySXRlbXNbaV07XG5cdFx0fVxuXHRcdC8vIHJlcXVlc3QgZW1wdHlpbmcgb2YgdGhlIGJ1ZmZlclxuXHRcdGlmIChidWZfbGVuID09IDApIHtcblx0XHRcdGxldCBzZWxmID0gdGhpcztcblx0XHRcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGZvciAobGV0IFtldiwgZUFyZywgc3Vic10gb2Ygc2VsZi5fX2V2ZW50aWZ5X2J1ZmZlcikge1xuXHRcdFx0XHRcdC8vIGFjdHVhbCBldmVudCB0cmlnZ2VyaW5nXG5cdFx0XHRcdFx0ZXYudHJpZ2dlcihlQXJnLCBzdWJzLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2VsZi5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIG11bHRpcGxlIGV2ZW50cyBvZiBzYW1lIHR5cGUgKG5hbWUpXG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsaWtlKG5hbWUsIGVBcmdzKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKGVBcmdzLm1hcChlQXJnID0+IHtcblx0XHRcdHJldHVybiB7bmFtZSwgZUFyZ307XG5cdFx0fSkpO1xuXHR9XG5cblx0Lypcblx0XHRUcmlnZ2VyIHNpbmdsZSBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXIobmFtZSwgZUFyZykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChbe25hbWUsIGVBcmd9XSk7XG5cdH1cblxuXHRfcHJvdG90eXBlLmV2ZW50aWZ5RGVmaW5lID0gZXZlbnRpZnlEZWZpbmU7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyID0gZXZlbnRpZnlUcmlnZ2VyO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsaWtlID0gZXZlbnRpZnlUcmlnZ2VyQWxpa2U7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxsID0gZXZlbnRpZnlUcmlnZ2VyQWxsO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5U3Vic2NyaXB0aW9ucyA9IGV2ZW50aWZ5U3Vic2NyaXB0aW9ucztcblx0X3Byb3RvdHlwZS5vbiA9IG9uO1xuXHRfcHJvdG90eXBlLm9mZiA9IG9mZjtcbn07XG5cblxuZXhwb3J0IGNvbnN0IGV2ZW50aWZ5ID0gZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4ge1xuXHRcdGFkZFRvSW5zdGFuY2U6IGV2ZW50aWZ5SW5zdGFuY2UsXG5cdFx0YWRkVG9Qcm90b3R5cGU6IGV2ZW50aWZ5UHJvdG90eXBlXG5cdH1cbn0oKTtcblxuLypcblx0RXZlbnQgVmFyaWFibGVcblxuXHRPYmplY3RzIHdpdGggYSBzaW5nbGUgXCJjaGFuZ2VcIiBldmVudFxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50VmFyaWFibGUge1xuXG5cdGNvbnN0cnVjdG9yICh2YWx1ZSkge1xuXHRcdGV2ZW50aWZ5SW5zdGFuY2UodGhpcyk7XG5cdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHR0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcblx0fVxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5fdmFsdWV9O1xuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlICE9IHRoaXMuX3ZhbHVlKSB7XG5cdFx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuZXZlbnRpZnlQcm90b3R5cGUoRXZlbnRWYXJpYWJsZS5wcm90b3R5cGUpO1xuXG4vKlxuXHRFdmVudCBCb29sZWFuXG5cblxuXHROb3RlIDogaW1wbGVtZW50YXRpb24gdXNlcyBmYWxzaW5lc3Mgb2YgaW5wdXQgcGFyYW1ldGVyIHRvIGNvbnN0cnVjdG9yIGFuZCBzZXQoKSBvcGVyYXRpb24sXG5cdHNvIGV2ZW50Qm9vbGVhbigtMSkgd2lsbCBhY3R1YWxseSBzZXQgaXQgdG8gdHJ1ZSBiZWNhdXNlXG5cdCgtMSkgPyB0cnVlIDogZmFsc2UgLT4gdHJ1ZSAhXG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRCb29sZWFuIGV4dGVuZHMgRXZlbnRWYXJpYWJsZSB7XG5cdGNvbnN0cnVjdG9yKHZhbHVlKSB7XG5cdFx0c3VwZXIoQm9vbGVhbih2YWx1ZSkpO1xuXHR9XG5cblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdHN1cGVyLnZhbHVlID0gQm9vbGVhbih2YWx1ZSk7XG5cdH1cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gc3VwZXIudmFsdWV9O1xufVxuXG5cbi8qXG5cdG1ha2UgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gRXZlbnRCb29sZWFuIGNoYW5nZXNcblx0dmFsdWUuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQcm9taXNlKGV2ZW50T2JqZWN0LCBjb25kaXRpb25GdW5jKSB7XG5cdGNvbmRpdGlvbkZ1bmMgPSBjb25kaXRpb25GdW5jIHx8IGZ1bmN0aW9uKHZhbCkge3JldHVybiB2YWwgPT0gdHJ1ZX07XG5cdHJldHVybiBuZXcgUHJvbWlzZSAoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdGxldCBzdWIgPSBldmVudE9iamVjdC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdGlmIChjb25kaXRpb25GdW5jKHZhbHVlKSkge1xuXHRcdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHRcdFx0ZXZlbnRPYmplY3Qub2ZmKHN1Yik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufTtcblxuLy8gbW9kdWxlIGFwaVxuZXhwb3J0IGRlZmF1bHQge1xuXHRldmVudGlmeVByb3RvdHlwZSxcblx0ZXZlbnRpZnlJbnN0YW5jZSxcblx0RXZlbnRWYXJpYWJsZSxcblx0RXZlbnRCb29sZWFuLFxuXHRtYWtlUHJvbWlzZVxufTtcblxuIiwiaW1wb3J0IHtkaXZtb2R9IGZyb20gXCIuL3V0aWwuanNcIjtcblxuLypcbiAgICBUaW1lb3V0IE1vbml0b3JcblxuICAgIFRpbWVvdXQgTW9uaXRvciBpcyBzaW1pbGFyIHRvIHNldEludGVydmFsLCBpbiB0aGUgc2Vuc2UgdGhhdCBcbiAgICBpdCBhbGxvd3MgY2FsbGJhY2tzIHRvIGJlIGZpcmVkIHBlcmlvZGljYWxseSBcbiAgICB3aXRoIGEgZ2l2ZW4gZGVsYXkgKGluIG1pbGxpcykuICBcbiAgICBcbiAgICBUaW1lb3V0IE1vbml0b3IgaXMgbWFkZSB0byBzYW1wbGUgdGhlIHN0YXRlIFxuICAgIG9mIGEgZHluYW1pYyBvYmplY3QsIHBlcmlvZGljYWxseS4gRm9yIHRoaXMgcmVhc29uLCBlYWNoIGNhbGxiYWNrIGlzIFxuICAgIGJvdW5kIHRvIGEgbW9uaXRvcmVkIG9iamVjdCwgd2hpY2ggd2UgaGVyZSBjYWxsIGEgdmFyaWFibGUuIFxuICAgIE9uIGVhY2ggaW52b2NhdGlvbiwgYSBjYWxsYmFjayB3aWxsIHByb3ZpZGUgYSBmcmVzaGx5IHNhbXBsZWQgXG4gICAgdmFsdWUgZnJvbSB0aGUgdmFyaWFibGUuXG5cbiAgICBUaGlzIHZhbHVlIGlzIGFzc3VtZWQgdG8gYmUgYXZhaWxhYmxlIGJ5IHF1ZXJ5aW5nIHRoZSB2YXJpYWJsZS4gXG5cbiAgICAgICAgdi5xdWVyeSgpIC0+IHt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0LCB0c31cblxuICAgIEluIGFkZGl0aW9uLCB0aGUgdmFyaWFibGUgb2JqZWN0IG1heSBzd2l0Y2ggYmFjayBhbmQgXG4gICAgZm9ydGggYmV0d2VlbiBkeW5hbWljIGFuZCBzdGF0aWMgYmVoYXZpb3IuIFRoZSBUaW1lb3V0IE1vbml0b3JcbiAgICB0dXJucyBwb2xsaW5nIG9mZiB3aGVuIHRoZSB2YXJpYWJsZSBpcyBubyBsb25nZXIgZHluYW1pYywgXG4gICAgYW5kIHJlc3VtZXMgcG9sbGluZyB3aGVuIHRoZSBvYmplY3QgYmVjb21lcyBkeW5hbWljLlxuXG4gICAgU3RhdGUgY2hhbmdlcyBhcmUgZXhwZWN0ZWQgdG8gYmUgc2lnbmFsbGVkIHRocm91Z2ggYSA8Y2hhbmdlPiBldmVudC5cblxuICAgICAgICBzdWIgPSB2Lm9uKFwiY2hhbmdlXCIsIGNhbGxiYWNrKVxuICAgICAgICB2Lm9mZihzdWIpXG5cbiAgICBDYWxsYmFja3MgYXJlIGludm9rZWQgb24gZXZlcnkgPGNoYW5nZT4gZXZlbnQsIGFzIHdlbGxcbiAgICBhcyBwZXJpb2RpY2FsbHkgd2hlbiB0aGUgb2JqZWN0IGlzIGluIDxkeW5hbWljPiBzdGF0ZS5cblxuICAgICAgICBjYWxsYmFjayh7dmFsdWUsIGR5bmFtaWMsIG9mZnNldCwgdHN9KVxuXG4gICAgRnVydGhlcm1vcmUsIGluIG9yZGVyIHRvIHN1cHBvcnQgY29uc2lzdGVudCByZW5kZXJpbmcgb2ZcbiAgICBzdGF0ZSBjaGFuZ2VzIGZyb20gbWFueSBkeW5hbWljIHZhcmlhYmxlcywgaXQgaXMgaW1wb3J0YW50IHRoYXRcbiAgICBjYWxsYmFja3MgYXJlIGludm9rZWQgYXQgdGhlIHNhbWUgdGltZSBhcyBtdWNoIGFzIHBvc3NpYmxlLCBzb1xuICAgIHRoYXQgY2hhbmdlcyB0aGF0IG9jY3VyIG5lYXIgaW4gdGltZSBjYW4gYmUgcGFydCBvZiB0aGUgc2FtZVxuICAgIHNjcmVlbiByZWZyZXNoLiBcblxuICAgIEZvciB0aGlzIHJlYXNvbiwgdGhlIFRpbWVvdXRNb25pdG9yIGdyb3VwcyBjYWxsYmFja3MgaW4gdGltZVxuICAgIGFuZCBpbnZva2VzIGNhbGxiYWNrcyBhdCBhdCBmaXhlZCBtYXhpbXVtIHJhdGUgKDIwSHovNTBtcykuXG4gICAgVGhpcyBpbXBsaWVzIHRoYXQgcG9sbGluZyBjYWxsYmFja3Mgd2lsbCBmYWxsIG9uIGEgc2hhcmVkIFxuICAgIHBvbGxpbmcgZnJlcXVlbmN5LlxuXG4gICAgQXQgdGhlIHNhbWUgdGltZSwgY2FsbGJhY2tzIG1heSBoYXZlIGluZGl2aWR1YWwgZnJlcXVlbmNpZXMgdGhhdFxuICAgIGFyZSBtdWNoIGxvd2VyIHJhdGUgdGhhbiB0aGUgbWF4aW11bSByYXRlLiBUaGUgaW1wbGVtZW50YXRpb25cbiAgICBkb2VzIG5vdCByZWx5IG9uIGEgZml4ZWQgNTBtcyB0aW1lb3V0IGZyZXF1ZW5jeSwgYnV0IGlzIHRpbWVvdXQgYmFzZWQsXG4gICAgdGh1cyB0aGVyZSBpcyBubyBwcm9jZXNzaW5nIG9yIHRpbWVvdXQgYmV0d2VlbiBjYWxsYmFja3MsIGV2ZW5cbiAgICBpZiBhbGwgY2FsbGJhY2tzIGhhdmUgbG93IHJhdGVzLlxuXG4gICAgSXQgaXMgc2FmZSB0byBkZWZpbmUgbXVsdGlwbGUgY2FsbGFiYWNrcyBmb3IgYSBzaW5nbGUgdmFyaWFibGUsIGVhY2hcbiAgICBjYWxsYmFjayB3aXRoIGEgZGlmZmVyZW50IHBvbGxpbmcgZnJlcXVlbmN5LlxuXG4gICAgb3B0aW9uc1xuICAgICAgICA8cmF0ZT4gLSBkZWZhdWx0IDUwOiBzcGVjaWZ5IG1pbmltdW0gZnJlcXVlbmN5IGluIG1zXG5cbiovXG5cblxuY29uc3QgUkFURV9NUyA9IDUwXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRJTUVPVVQgTU9OSVRPUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIEJhc2UgY2xhc3MgZm9yIFRpbWVvdXQgTW9uaXRvciBhbmQgRnJhbWVyYXRlIE1vbml0b3JcbiovXG5cbmNsYXNzIFRpbWVvdXRNb25pdG9yIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcblxuICAgICAgICB0aGlzLl9vcHRpb25zID0gT2JqZWN0LmFzc2lnbih7cmF0ZTogUkFURV9NU30sIG9wdGlvbnMpO1xuICAgICAgICBpZiAodGhpcy5fb3B0aW9ucy5yYXRlIDwgUkFURV9NUykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbGxlZ2FsIHJhdGUgJHtyYXRlfSwgbWluaW11bSByYXRlIGlzICR7UkFURV9NU31gKTtcbiAgICAgICAgfVxuICAgICAgICAvKlxuICAgICAgICAgICAgbWFwXG4gICAgICAgICAgICBoYW5kbGUgLT4ge2NhbGxiYWNrLCB2YXJpYWJsZSwgZGVsYXl9XG4gICAgICAgICAgICAtIHZhcmlhYmxlOiB0YXJnZXQgZm9yIHNhbXBsaW5nXG4gICAgICAgICAgICAtIGNhbGxiYWNrOiBmdW5jdGlvbih2YWx1ZSlcbiAgICAgICAgICAgIC0gZGVsYXk6IGJldHdlZW4gc2FtcGxlcyAod2hlbiB2YXJpYWJsZSBpcyBkeW5hbWljKVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zZXQgPSBuZXcgU2V0KCk7XG4gICAgICAgIC8qXG4gICAgICAgICAgICB2YXJpYWJsZSBtYXBcbiAgICAgICAgICAgIHZhcmlhYmxlIC0+IHtzdWIsIHBvbGxpbmcsIGhhbmRsZXM6W119XG4gICAgICAgICAgICAtIHN1YiBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAgICAgICAgIC0gcG9sbGluZzogdHJ1ZSBpZiB2YXJpYWJsZSBuZWVkcyBwb2xsaW5nXG4gICAgICAgICAgICAtIGhhbmRsZXM6IGxpc3Qgb2YgaGFuZGxlcyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICAvLyB2YXJpYWJsZSBjaGFuZ2UgaGFuZGxlclxuICAgICAgICB0aGlzLl9fb252YXJpYWJsZWNoYW5nZSA9IHRoaXMuX29udmFyaWFibGVjaGFuZ2UuYmluZCh0aGlzKTtcbiAgICB9XG5cbiAgICBiaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICAgICAgLy8gcmVnaXN0ZXIgYmluZGluZ1xuICAgICAgICBsZXQgaGFuZGxlID0ge2NhbGxiYWNrLCB2YXJpYWJsZSwgZGVsYXl9O1xuICAgICAgICB0aGlzLl9zZXQuYWRkKGhhbmRsZSk7XG4gICAgICAgIC8vIHJlZ2lzdGVyIHZhcmlhYmxlXG4gICAgICAgIGlmICghdGhpcy5fdmFyaWFibGVfbWFwLmhhcyh2YXJpYWJsZSkpIHtcbiAgICAgICAgICAgIGxldCBzdWIgPSB2YXJpYWJsZS5vbihcImNoYW5nZVwiLCB0aGlzLl9fb252YXJpYWJsZWNoYW5nZSk7XG4gICAgICAgICAgICBsZXQgaXRlbSA9IHtzdWIsIHBvbGxpbmc6ZmFsc2UsIGhhbmRsZXM6IFtoYW5kbGVdfTtcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5zZXQodmFyaWFibGUsIGl0ZW0pO1xuICAgICAgICAgICAgLy90aGlzLl9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSkuaGFuZGxlcy5wdXNoKGhhbmRsZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhhbmRsZTtcbiAgICB9XG5cbiAgICByZWxlYXNlKGhhbmRsZSkge1xuICAgICAgICAvLyBjbGVhbnVwXG4gICAgICAgIGxldCByZW1vdmVkID0gdGhpcy5fc2V0LmRlbGV0ZShoYW5kbGUpO1xuICAgICAgICBpZiAoIXJlbW92ZWQpIHJldHVybjtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2xlYW51cCB2YXJpYWJsZSBtYXBcbiAgICAgICAgbGV0IHZhcmlhYmxlID0gaGFuZGxlLnZhcmlhYmxlO1xuICAgICAgICBsZXQge3N1YiwgaGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IGlkeCA9IGhhbmRsZXMuaW5kZXhPZihoYW5kbGUpO1xuICAgICAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgICAgIGhhbmRsZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhhbmRsZXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIC8vIHZhcmlhYmxlIGhhcyBubyBoYW5kbGVzXG4gICAgICAgICAgICAvLyBjbGVhbnVwIHZhcmlhYmxlIG1hcFxuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLmRlbGV0ZSh2YXJpYWJsZSk7XG4gICAgICAgICAgICB2YXJpYWJsZS5vZmYoc3ViKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHZhcmlhYmxlIGVtaXRzIGEgY2hhbmdlIGV2ZW50XG4gICAgKi9cbiAgICBfb252YXJpYWJsZWNoYW5nZSAoZUFyZywgZUluZm8pIHtcbiAgICAgICAgbGV0IHZhcmlhYmxlID0gZUluZm8uc3JjO1xuICAgICAgICAvLyBkaXJlY3QgY2FsbGJhY2sgLSBjb3VsZCB1c2UgZUFyZyBoZXJlXG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IHN0YXRlID0gZUFyZztcbiAgICAgICAgLy8gcmVldmFsdWF0ZSBwb2xsaW5nXG4gICAgICAgIHRoaXMuX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSwgc3RhdGUpO1xuICAgICAgICAvLyBjYWxsYmFja3NcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIGhhbmRsZS5jYWxsYmFjayhzdGF0ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBzdGFydCBvciBzdG9wIHBvbGxpbmcgaWYgbmVlZGVkXG4gICAgKi9cbiAgICBfcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlLCBzdGF0ZSkge1xuICAgICAgICBsZXQgaXRlbSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQge3BvbGxpbmc6d2FzX3BvbGxpbmd9ID0gaXRlbTtcbiAgICAgICAgc3RhdGUgPSBzdGF0ZSB8fCB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICBsZXQgc2hvdWxkX2JlX3BvbGxpbmcgPSBzdGF0ZS5keW5hbWljO1xuICAgICAgICBpZiAoIXdhc19wb2xsaW5nICYmIHNob3VsZF9iZV9wb2xsaW5nKSB7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXRzKHZhcmlhYmxlKTtcbiAgICAgICAgfSBlbHNlIGlmICh3YXNfcG9sbGluZyAmJiAhc2hvdWxkX2JlX3BvbGxpbmcpIHtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fY2xlYXJfdGltZW91dHModmFyaWFibGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgc2V0IHRpbWVvdXQgZm9yIGFsbCBjYWxsYmFja3MgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgKi9cbiAgICBfc2V0X3RpbWVvdXRzKHZhcmlhYmxlKSB7XG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc2V0X3RpbWVvdXQoaGFuZGxlKSB7XG4gICAgICAgIGxldCBkZWx0YSA9IHRoaXMuX2NhbGN1bGF0ZV9kZWx0YShoYW5kbGUuZGVsYXkpO1xuICAgICAgICBsZXQgaGFuZGxlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZV90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHNldFRpbWVvdXQoaGFuZGxlciwgZGVsdGEpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGFkanVzdCBkZWxheSBzbyB0aGF0IGlmIGZhbGxzIG9uXG4gICAgICAgIHRoZSBtYWluIHRpY2sgcmF0ZVxuICAgICovXG4gICAgX2NhbGN1bGF0ZV9kZWx0YShkZWxheSkge1xuICAgICAgICBsZXQgcmF0ZSA9IHRoaXMuX29wdGlvbnMucmF0ZTtcbiAgICAgICAgbGV0IG5vdyA9IE1hdGgucm91bmQocGVyZm9ybWFuY2Uubm93KCkpO1xuICAgICAgICBsZXQgW25vd19uLCBub3dfcl0gPSBkaXZtb2Qobm93LCByYXRlKTtcbiAgICAgICAgbGV0IFtuLCByXSA9IGRpdm1vZChub3cgKyBkZWxheSwgcmF0ZSk7XG4gICAgICAgIGxldCB0YXJnZXQgPSBNYXRoLm1heChuLCBub3dfbiArIDEpKnJhdGU7XG4gICAgICAgIHJldHVybiB0YXJnZXQgLSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBjbGVhciBhbGwgdGltZW91dHMgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgKi9cbiAgICBfY2xlYXJfdGltZW91dHModmFyaWFibGUpIHtcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgaWYgKGhhbmRsZS50aWQgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGhhbmRsZS50aWQpO1xuICAgICAgICAgICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBoYW5kbGUgdGltZW91dFxuICAgICovXG4gICAgX2hhbmRsZV90aW1lb3V0KGhhbmRsZSkge1xuICAgICAgICAvLyBkcm9wIGlmIGhhbmRsZSB0aWQgaGFzIGJlZW4gY2xlYXJlZFxuICAgICAgICBpZiAoaGFuZGxlLnRpZCA9PSB1bmRlZmluZWQpIHJldHVybjtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2FsbGJhY2tcbiAgICAgICAgbGV0IHt2YXJpYWJsZX0gPSBoYW5kbGU7XG4gICAgICAgIGxldCBzdGF0ZSA9IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgIC8vIHJlc2NoZWR1bGUgdGltZW91dHMgZm9yIGNhbGxiYWNrc1xuICAgICAgICBpZiAoc3RhdGUuZHluYW1pYykge1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgbWFrZSBzdXJlIHBvbGxpbmcgc3RhdGUgaXMgYWxzbyBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMgd291bGQgb25seSBvY2N1ciBpZiB0aGUgdmFyaWFibGVcbiAgICAgICAgICAgICAgICB3ZW50IGZyb20gcmVwb3J0aW5nIGR5bmFtaWMgdHJ1ZSB0byBkeW5hbWljIGZhbHNlLFxuICAgICAgICAgICAgICAgIHdpdGhvdXQgZW1taXR0aW5nIGEgY2hhbmdlIGV2ZW50IC0gdGh1c1xuICAgICAgICAgICAgICAgIHZpb2xhdGluZyB0aGUgYXNzdW1wdGlvbi4gVGhpcyBwcmVzZXJ2ZXNcbiAgICAgICAgICAgICAgICBpbnRlcm5hbCBpbnRlZ3JpdHkgaSB0aGUgbW9uaXRvci5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBsZXQgaXRlbSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy9cbiAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHN0YXRlKTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgRlJBTUVSQVRFIE1PTklUT1JcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuXG5jbGFzcyBGcmFtZXJhdGVNb25pdG9yIGV4dGVuZHMgVGltZW91dE1vbml0b3Ige1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgICAgdGhpcy5faGFuZGxlO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHRpbWVvdXRzIGFyZSBvYnNvbGV0ZVxuICAgICovXG4gICAgX3NldF90aW1lb3V0cyh2YXJpYWJsZSkge31cbiAgICBfc2V0X3RpbWVvdXQoaGFuZGxlKSB7fVxuICAgIF9jYWxjdWxhdGVfZGVsdGEoZGVsYXkpIHt9XG4gICAgX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKSB7fVxuICAgIF9oYW5kbGVfdGltZW91dChoYW5kbGUpIHt9XG5cbiAgICBfb252YXJpYWJsZWNoYW5nZSAoZUFyZywgZUluZm8pIHtcbiAgICAgICAgc3VwZXIuX29udmFyaWFibGVjaGFuZ2UoZUFyZywgZUluZm8pO1xuICAgICAgICAvLyBraWNrIG9mZiBjYWxsYmFjayBsb29wIGRyaXZlbiBieSByZXF1ZXN0IGFuaW1hdGlvbmZyYW1lXG4gICAgICAgIHRoaXMuX2NhbGxiYWNrKCk7XG4gICAgfVxuXG4gICAgX2NhbGxiYWNrKCkge1xuICAgICAgICAvLyBjYWxsYmFjayB0byBhbGwgdmFyaWFibGVzIHdoaWNoIHJlcXVpcmUgcG9sbGluZ1xuICAgICAgICBsZXQgdmFyaWFibGVzID0gWy4uLnRoaXMuX3ZhcmlhYmxlX21hcC5lbnRyaWVzKCldXG4gICAgICAgICAgICAuZmlsdGVyKChbdmFyaWFibGUsIGl0ZW1dKSA9PiBpdGVtLnBvbGxpbmcpXG4gICAgICAgICAgICAubWFwKChbdmFyaWFibGUsIGl0ZW1dKSA9PiB2YXJpYWJsZSk7XG4gICAgICAgIGlmICh2YXJpYWJsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgLy8gY2FsbGJhY2tcbiAgICAgICAgICAgIGZvciAobGV0IHZhcmlhYmxlIG9mIHZhcmlhYmxlcykge1xuICAgICAgICAgICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgICAgICAgICBsZXQgcmVzID0gdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgICAgICAgICBoYW5kbGUuY2FsbGJhY2socmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBcbiAgICAgICAgICAgICAgICByZXF1ZXN0IG5leHQgY2FsbGJhY2sgYXMgbG9uZyBhcyBhdCBsZWFzdCBvbmUgdmFyaWFibGUgXG4gICAgICAgICAgICAgICAgaXMgcmVxdWlyaW5nIHBvbGxpbmdcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9oYW5kbGUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5fY2FsbGJhY2suYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEJJTkQgUkVMRUFTRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jb25zdCBtb25pdG9yID0gbmV3IFRpbWVvdXRNb25pdG9yKCk7XG5jb25zdCBmcmFtZXJhdGVfbW9uaXRvciA9IG5ldyBGcmFtZXJhdGVNb25pdG9yKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICBsZXQgaGFuZGxlO1xuICAgIGlmIChCb29sZWFuKHBhcnNlRmxvYXQoZGVsYXkpKSkge1xuICAgICAgICBoYW5kbGUgPSBtb25pdG9yLmJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBbXCJ0aW1lb3V0XCIsIGhhbmRsZV07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaGFuZGxlID0gZnJhbWVyYXRlX21vbml0b3IuYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIDAsIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gW1wiZnJhbWVyYXRlXCIsIGhhbmRsZV07XG4gICAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgbGV0IFt0eXBlLCBfaGFuZGxlXSA9IGhhbmRsZTtcbiAgICBpZiAodHlwZSA9PSBcInRpbWVvdXRcIikge1xuICAgICAgICByZXR1cm4gbW9uaXRvci5yZWxlYXNlKF9oYW5kbGUpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcImZyYW1lcmF0ZVwiKSB7XG4gICAgICAgIHJldHVybiBmcmFtZXJhdGVfbW9uaXRvci5yZWxlYXNlKF9oYW5kbGUpO1xuICAgIH1cbn1cblxuIiwiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gICAgKiBcbiAgICAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAgICAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICAgICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gICAgKiBcbiAgICAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICAgICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAgICAqIFxuICAgICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG5cbiovXG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuXG5cbiAgICBOT1RFIFxuICAgIC0gY21wKDRdLFs0ICkgPT0gMCAtIHNpbmNlIHRoZXNlIGFyZSB0aGUgc2FtZSB3aXRoIHJlc3BlY3QgdG8gc29ydGluZ1xuICAgIC0gYnV0IGlmIHlvdSB3YW50IHRvIHNlZSBpZiB0d28gaW50ZXJ2YWxzIGFyZSBvdmVybGFwcGluZyBpbiB0aGUgZW5kcG9pbnRzXG4gICAgY21wKGhpZ2hfYSwgbG93X2IpID4gMCB0aGlzIHdpbGwgbm90IGJlIGdvb2RcbiAgICBcbiovIFxuXG5cbmZ1bmN0aW9uIGNtcE51bWJlcnMoYSwgYikge1xuICAgIGlmIChhID09PSBiKSByZXR1cm4gMDtcbiAgICBpZiAoYSA9PT0gSW5maW5pdHkpIHJldHVybiAxO1xuICAgIGlmIChiID09PSBJbmZpbml0eSkgcmV0dXJuIC0xO1xuICAgIGlmIChhID09PSAtSW5maW5pdHkpIHJldHVybiAtMTtcbiAgICBpZiAoYiA9PT0gLUluZmluaXR5KSByZXR1cm4gMTtcbiAgICByZXR1cm4gYSAtIGI7XG4gIH1cblxuZnVuY3Rpb24gZW5kcG9pbnRfY21wIChwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICBsZXQgZGlmZiA9IGNtcE51bWJlcnModjEsIHYyKTtcbiAgICByZXR1cm4gKGRpZmYgIT0gMCkgPyBkaWZmIDogczEgLSBzMjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludCB0byB0aGUgb3RoZXIgc2lkZVxuICogXG4gKiB1c2VmdWwgZm9yIG1ha2luZyBiYWNrLXRvLWJhY2sgaW50ZXJ2YWxzIFxuICogXG4gKiBoaWdoKSA8LT4gW2xvd1xuICogaGlnaF0gPC0+IChsb3dcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKHAsIHRhcmdldCkge1xuICAgIGxldCBbdixzXSA9IHA7XG4gICAgaWYgKCFpc0Zpbml0ZSh2KSkge1xuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgaWYgKHRhcmdldCA9PSBcImxvd1wiKSB7XG4gICAgXHQvLyBhc3N1bWUgcG9pbnQgaXMgaGlnaDogc2lnbiBtdXN0IGJlIC0xIG9yIDBcbiAgICBcdGlmIChzID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBsb3dcIik7ICAgIFx0XHRcbiAgICBcdH1cbiAgICAgICAgcCA9IFt2LCBzKzFdO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09IFwiaGlnaFwiKSB7XG5cdFx0Ly8gYXNzdW1lIHBvaW50IGlzIGxvdzogc2lnbiBpcyAwIG9yIDFcbiAgICBcdGlmIChzIDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBoaWdoXCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcy0xXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0eXBlXCIsIHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBsZXQgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBsZXQgbG93X3AgPSAobG93Q2xvc2VkKSA/IFtsb3csIDBdIDogW2xvdywgMV07IFxuICAgIGxldCBoaWdoX3AgPSAoaGlnaENsb3NlZCkgPyBbaGlnaCwgMF0gOiBbaGlnaCwgLTFdO1xuICAgIHJldHVybiBbbG93X3AsIGhpZ2hfcF07XG59XG5cblxuLypcbiAgICBJTlRFUlZBTFNcblxuICAgIEludGVydmFscyBhcmUgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXVxuXG4qLyBcblxuLypcbiAgICByZXR1cm4gdHJ1ZSBpZiBwb2ludCBwIGlzIGNvdmVyZWQgYnkgaW50ZXJ2YWwgaXR2XG4gICAgcG9pbnQgcCBjYW4gYmUgbnVtYmVyIHAgb3IgYSBwb2ludCBbcCxzXVxuXG4gICAgaW1wbGVtZW50ZWQgYnkgY29tcGFyaW5nIHBvaW50c1xuICAgIGV4Y2VwdGlvbiBpZiBpbnRlcnZhbCBpcyBub3QgZGVmaW5lZFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIHApIHtcbiAgICBsZXQgW2xvd19wLCBoaWdoX3BdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAvLyBjb3ZlcnM6IGxvdyA8PSBwIDw9IGhpZ2hcbiAgICByZXR1cm4gZW5kcG9pbnRfbGUobG93X3AsIHApICYmIGVuZHBvaW50X2xlKHAsIGhpZ2hfcCk7XG59XG4vLyBjb252ZW5pZW5jZVxuZnVuY3Rpb24gaW50ZXJ2YWxfY292ZXJzX3BvaW50KGl0diwgcCkge1xuICAgIHJldHVybiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBbcCwgMF0pO1xufVxuXG5cblxuLypcbiAgICBSZXR1cm4gdHJ1ZSBpZiBpbnRlcnZhbCBoYXMgbGVuZ3RoIDBcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9pc19zaW5ndWxhcihpbnRlcnZhbCkge1xuICAgIHJldHVybiBpbnRlcnZhbFswXSA9PSBpbnRlcnZhbFsxXVxufVxuXG4vKlxuICAgIENyZWF0ZSBpbnRlcnZhbCBmcm9tIGVuZHBvaW50c1xuKi9cbmZ1bmN0aW9uIGludGVydmFsX2Zyb21fZW5kcG9pbnRzKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIC8vIHAxIG11c3QgYmUgYSBsb3cgcG9pbnRcbiAgICBpZiAoczEgPT0gLTEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBsb3cgcG9pbnRcIiwgcDEpO1xuICAgIH1cbiAgICBpZiAoczIgPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2VhbCBoaWdoIHBvaW50XCIsIHAyKTsgICBcbiAgICB9XG4gICAgcmV0dXJuIFt2MSwgdjIsIChzMT09MCksIChzMj09MCldXG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKG4pIHtcbiAgICByZXR1cm4gdHlwZW9mIG4gPT0gXCJudW1iZXJcIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGludGVydmFsX2Zyb21faW5wdXQoaW5wdXQpe1xuICAgIGxldCBpdHYgPSBpbnB1dDtcbiAgICBpZiAoaXR2ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnB1dCBpcyB1bmRlZmluZWRcIik7XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShpdHYpKSB7XG4gICAgICAgIGlmIChpc051bWJlcihpdHYpKSB7XG4gICAgICAgICAgICAvLyBpbnB1dCBpcyBzaW5ndWxhciBudW1iZXJcbiAgICAgICAgICAgIGl0diA9IFtpdHYsIGl0diwgdHJ1ZSwgdHJ1ZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlucHV0OiAke2lucHV0fTogbXVzdCBiZSBBcnJheSBvciBOdW1iZXJgKVxuICAgICAgICB9XG4gICAgfTtcbiAgICAvLyBtYWtlIHN1cmUgaW50ZXJ2YWwgaXMgbGVuZ3RoIDRcbiAgICBpZiAoaXR2Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGl0diA9IFtpdHZbMF0sIGl0dlswXSwgdHJ1ZSwgdHJ1ZV1cbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMikge1xuICAgICAgICBpdHYgPSBpdHYuY29uY2F0KFt0cnVlLCBmYWxzZV0pO1xuICAgIH0gZWxzZSBpZiAoaXR2Lmxlbmd0aCA9PSAzKSB7XG4gICAgICAgIGl0diA9IGl0di5wdXNoKGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPiA0KSB7XG4gICAgICAgIGl0diA9IGl0di5zbGljZSgwLDQpO1xuICAgIH1cbiAgICBsZXQgW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdID0gaXR2O1xuICAgIC8vIHVuZGVmaW5lZFxuICAgIGlmIChsb3cgPT0gdW5kZWZpbmVkIHx8IGxvdyA9PSBudWxsKSB7XG4gICAgICAgIGxvdyA9IC1JbmZpbml0eTtcbiAgICB9XG4gICAgaWYgKGhpZ2ggPT0gdW5kZWZpbmVkIHx8IGhpZ2ggPT0gbnVsbCkge1xuICAgICAgICBoaWdoID0gSW5maW5pdHk7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93IGFuZCBoaWdoIGFyZSBudW1iZXJzXG4gICAgaWYgKCFpc051bWJlcihsb3cpKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgbm90IGEgbnVtYmVyXCIsIGxvdyk7XG4gICAgaWYgKCFpc051bWJlcihoaWdoKSkgdGhyb3cgbmV3IEVycm9yKFwiaGlnaCBub3QgYSBudW1iZXJcIiwgaGlnaCk7XG4gICAgLy8gY2hlY2sgdGhhdCBsb3cgPD0gaGlnaFxuICAgIGlmIChsb3cgPiBoaWdoKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgPiBoaWdoXCIsIGxvdywgaGlnaCk7XG4gICAgLy8gc2luZ2xldG9uXG4gICAgaWYgKGxvdyA9PSBoaWdoKSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIGluZmluaXR5IHZhbHVlc1xuICAgIGlmIChsb3cgPT0gLUluZmluaXR5KSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoaGlnaCA9PSBJbmZpbml0eSkge1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGUgYXJlIGJvb2xlYW5zXG4gICAgaWYgKHR5cGVvZiBsb3dJbmNsdWRlICE9PSBcImJvb2xlYW5cIikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJsb3dJbmNsdWRlIG5vdCBib29sZWFuXCIpO1xuICAgIH0gXG4gICAgaWYgKHR5cGVvZiBoaWdoSW5jbHVkZSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaGlnaEluY2x1ZGUgbm90IGJvb2xlYW5cIik7XG4gICAgfVxuICAgIHJldHVybiBbbG93LCBoaWdoLCBsb3dJbmNsdWRlLCBoaWdoSW5jbHVkZV07XG59XG5cblxuXG5cbmV4cG9ydCBjb25zdCBlbmRwb2ludCA9IHtcbiAgICBsZTogZW5kcG9pbnRfbGUsXG4gICAgbHQ6IGVuZHBvaW50X2x0LFxuICAgIGdlOiBlbmRwb2ludF9nZSxcbiAgICBndDogZW5kcG9pbnRfZ3QsXG4gICAgY21wOiBlbmRwb2ludF9jbXAsXG4gICAgZXE6IGVuZHBvaW50X2VxLFxuICAgIG1pbjogZW5kcG9pbnRfbWluLFxuICAgIG1heDogZW5kcG9pbnRfbWF4LFxuICAgIGZsaXA6IGVuZHBvaW50X2ZsaXAsXG4gICAgZnJvbV9pbnRlcnZhbDogZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWxcbn1cbmV4cG9ydCBjb25zdCBpbnRlcnZhbCA9IHtcbiAgICBjb3ZlcnNfZW5kcG9pbnQ6IGludGVydmFsX2NvdmVyc19lbmRwb2ludCxcbiAgICBjb3ZlcnNfcG9pbnQ6IGludGVydmFsX2NvdmVyc19wb2ludCwgXG4gICAgaXNfc2luZ3VsYXI6IGludGVydmFsX2lzX3Npbmd1bGFyLFxuICAgIGZyb21fZW5kcG9pbnRzOiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyxcbiAgICBmcm9tX2lucHV0OiBpbnRlcnZhbF9mcm9tX2lucHV0XG59XG4iLCIvKlxuICAgIFRoaXMgZGVjb3JhdGVzIGFuIG9iamVjdC9wcm90b3R5cGUgd2l0aCBiYXNpYyAoc3luY2hyb25vdXMpIGNhbGxiYWNrIHN1cHBvcnQuXG4qL1xuXG5jb25zdCBQUkVGSVggPSBcIl9fY2FsbGJhY2tcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2Uob2JqZWN0KSB7XG4gICAgb2JqZWN0W2Ake1BSRUZJWH1faGFuZGxlcnNgXSA9IFtdO1xufVxuXG5mdW5jdGlvbiBhZGRfY2FsbGJhY2sgKGhhbmRsZXIpIHtcbiAgICBsZXQgaGFuZGxlID0ge1xuICAgICAgICBoYW5kbGVyOiBoYW5kbGVyXG4gICAgfVxuICAgIHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLnB1c2goaGFuZGxlKTtcbiAgICByZXR1cm4gaGFuZGxlO1xufTtcblxuZnVuY3Rpb24gcmVtb3ZlX2NhbGxiYWNrIChoYW5kbGUpIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5pbmRleG9mKGhhbmRsZSk7XG4gICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBub3RpZnlfY2FsbGJhY2tzIChlQXJnKSB7XG4gICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uZm9yRWFjaChmdW5jdGlvbihoYW5kbGUpIHtcbiAgICAgICAgaGFuZGxlLmhhbmRsZXIoZUFyZyk7XG4gICAgfSk7XG59O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgYWRkX2NhbGxiYWNrLCByZW1vdmVfY2FsbGJhY2ssIG5vdGlmeV9jYWxsYmFja3NcbiAgICB9XG4gICAgT2JqZWN0LmFzc2lnbihfcHJvdG90eXBlLCBhcGkpO1xufVxuXG5cbiIsImltcG9ydCB7IGV2ZW50aWZ5IH0gZnJvbSBcIi4vZXZlbnRpZnkuanNcIjtcbmltcG9ydCB7IGJpbmQsIHJlbGVhc2UgfSBmcm9tIFwiLi9tb25pdG9yLmpzXCI7XG5pbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgcmFuZ2UgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5pbXBvcnQgKiBhcyBjYWxsYmFjayBmcm9tIFwiLi9hcGlfY2FsbGJhY2suanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ0xPQ0sgUFJPVklERVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBCYXNlIGNsYXNzIGZvciBDbG9ja1Byb3ZpZGVyc1xuICogXG4gKiBDbG9jayBQcm92aWRlcnMgaW1wbGVtZW50IHRoZSBjYWxsYmFja1xuICogaW50ZXJmYWNlIHRvIGJlIGNvbXBhdGlibGUgd2l0aCBvdGhlciBzdGF0ZVxuICogcHJvdmlkZXJzLCBldmVuIHRob3VnaCB0aGV5IGFyZSBub3QgcmVxdWlyZWQgdG9cbiAqIHByb3ZpZGUgYW55IGNhbGxiYWNrcyBhZnRlciBjbG9jayBhZGp1c3RtZW50c1xuICovXG5cbmV4cG9ydCBjbGFzcyBDbG9ja1Byb3ZpZGVyQmFzZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuICAgIG5vdyAoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShDbG9ja1Byb3ZpZGVyQmFzZS5wcm90b3R5cGUpO1xuXG5cbi8qKlxuICogQmFzZSBjbGFzcyBmb3IgTW90aW9uUHJvdmlkZXJzXG4gKiBcbiAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBjbGFzcyBvZmZlcmluZyBhIHNpbXBsZXIgd2F5XG4gKiBvZiBpbXBsZW1lbnRpbmcgc3RhdGUgcHJvdmlkZXIgd2hpY2ggZGVhbCBleGNsdXNpdmVseVxuICogd2l0aCBtb3Rpb24gc2VnbWVudHMuXG4gKiBcbiAqIE1vdGlvbnByb3ZpZGVycyBkbyBub3QgZGVhbCB3aXRoIGl0ZW1zLCBidXQgd2l0aCBzaW1wbGVyXG4gKiBzdGF0ZW1lbnRzIG9mIG1vdGlvbiBzdGF0ZVxuICogXG4gKiBzdGF0ZSA9IHtcbiAqICAgICAgcG9zaXRpb246IDAsXG4gKiAgICAgIHZlbG9jaXR5OiAwLFxuICogICAgICBhY2NlbGVyYXRpb246IDAsXG4gKiAgICAgIHRpbWVzdGFtcDogMFxuICogICAgICByYW5nZTogW3VuZGVmaW5lZCwgdW5kZWZpbmVkXVxuICogfVxuICogXG4gKiBJbnRlcm5hbGx5LCBNb3Rpb25Qcm92aWRlciB3aWxsIGJlIHdyYXBwZWQgc28gdGhhdCB0aGV5XG4gKiBiZWNvbWUgcHJvcGVyIFN0YXRlUHJvdmlkZXJzLlxuICovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25Qcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBjYWxsYmFjay5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICBsZXQge3N0YXRlfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzdGF0ZSA9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5fc3RhdGUgPSB7XG4gICAgICAgICAgICAgICAgcG9zaXRpb246IDAsXG4gICAgICAgICAgICAgICAgdmVsb2NpdHk6IDAsXG4gICAgICAgICAgICAgICAgYWNjZWxlcmF0aW9uOiAwLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogMCxcbiAgICAgICAgICAgICAgICByYW5nZTogW3VuZGVmaW5lZCwgdW5kZWZpbmVkXVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3RhdGUgPSBzdGF0ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNldCBtb3Rpb24gc3RhdGVcbiAgICAgKiBcbiAgICAgKiBpbXBsZW1lbnRhdGlvbnMgb2Ygb25saW5lIG1vdGlvbiBwcm92aWRlcnMgd2lsbFxuICAgICAqIHVzZSB0aGlzIHRvIHNlbmQgYW4gdXBkYXRlIHJlcXVlc3QsXG4gICAgICogYW5kIHNldCBfc3RhdGUgb24gcmVzcG9uc2UgYW5kIHRoZW4gY2FsbCBub3RpZnlfY2FsbGJha3NcbiAgICAgKiBJZiB0aGUgcHJveHkgd2FudHMgdG8gc2V0IHRoZSBzdGF0ZSBpbW1lZGlhdGVkbHkgLSBcbiAgICAgKiBpdCBzaG91bGQgYmUgZG9uZSB1c2luZyBhIFByb21pc2UgLSB0byBicmVhayB0aGUgY29udHJvbCBmbG93LlxuICAgICAqIFxuICAgICAqIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAqICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAqICAgICAgICAgICB0aGlzLl9zdGF0ZSA9IHN0YXRlO1xuICAgICAqICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgKiAgICAgICB9KTtcbiAgICAgKiBcbiAgICAgKi9cbiAgICBzZXRfc3RhdGUgKHN0YXRlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gY3VycmVudCBtb3Rpb24gc3RhdGVcbiAgICBnZXRfc3RhdGUgKCkge1xuICAgICAgICByZXR1cm4gey4uLnRoaXMuX3N0YXRlfTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShNb3Rpb25Qcm92aWRlckJhc2UucHJvdG90eXBlKTtcblxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU1RBVEUgUFJPVklERVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBCYXNlIGNsYXNzIGZvciBTdGF0ZVByb3ZpZGVyc1xuXG4gICAgLSBjb2xsZWN0aW9uIG9mIGl0ZW1zXG4gICAgLSB7a2V5LCBpdHYsIHR5cGUsIGRhdGF9XG4qL1xuXG5leHBvcnQgY2xhc3MgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogdXBkYXRlIGZ1bmN0aW9uXG4gICAgICogXG4gICAgICogSWYgSXRlbXNQcm92aWRlciBpcyBhIHByb3h5IHRvIGFuIG9ubGluZVxuICAgICAqIEl0ZW1zIGNvbGxlY3Rpb24sIHVwZGF0ZSByZXF1ZXN0cyB3aWxsIFxuICAgICAqIGltcGx5IGEgbmV0d29yayByZXF1ZXN0XG4gICAgICogXG4gICAgICogb3B0aW9ucyAtIHN1cHBvcnQgcmVzZXQgZmxhZyBcbiAgICAgKi9cbiAgICB1cGRhdGUoaXRlbXMsIG9wdGlvbnM9e30pe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIGFycmF5IHdpdGggYWxsIGl0ZW1zIGluIGNvbGxlY3Rpb24gXG4gICAgICogLSBubyByZXF1aXJlbWVudCB3cnQgb3JkZXJcbiAgICAgKi9cblxuICAgIGdldF9pdGVtcygpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNpZ25hbCBpZiBpdGVtcyBjYW4gYmUgb3ZlcmxhcHBpbmcgb3Igbm90XG4gICAgICovXG5cbiAgICBnZXQgaW5mbyAoKSB7XG4gICAgICAgIHJldHVybiB7b3ZlcmxhcHBpbmc6IHRydWV9O1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKFN0YXRlUHJvdmlkZXJCYXNlLnByb3RvdHlwZSk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTEFZRVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIExheWVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5faW5kZXg7XG5cbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgLy8gZGVmaW5lIGNoYW5nZSBldmVudFxuICAgICAgICBldmVudGlmeS5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFFVRVJZIEFQSVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgZ2V0UXVlcnlPYmplY3QgKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7ICAgICBcbiAgICB9XG5cbiAgICBnZXQgaW5kZXggKCkge3JldHVybiB0aGlzLl9pbmRleH07XG4gICAgXG5cbiAgICAvKlxuICAgICAgICBTYW1wbGUgTGF5ZXIgYnkgdGltZWxpbmUgb2Zmc2V0IGluY3JlbWVudHNcbiAgICAgICAgcmV0dXJuIGxpc3Qgb2YgdHVwbGVzIFt2YWx1ZSwgb2Zmc2V0XVxuICAgICAgICBvcHRpb25zXG4gICAgICAgIC0gc3RhcnRcbiAgICAgICAgLSBzdG9wXG4gICAgICAgIC0gc3RlcFxuICAgICovXG4gICAgc2FtcGxlKG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtzdGFydD0tSW5maW5pdHksIHN0b3A9SW5maW5pdHksIHN0ZXA9MX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3RhcnQgPiBzdG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgKFwic3RvcCBtdXN0IGJlIGxhcmdlciB0aGFuIHN0YXJ0XCIsIHN0YXJ0LCBzdG9wKVxuICAgICAgICB9XG4gICAgICAgIHN0YXJ0ID0gW3N0YXJ0LCAwXTtcbiAgICAgICAgc3RvcCA9IFtzdG9wLCAwXTtcblxuICAgICAgICBzdGFydCA9IGVuZHBvaW50Lm1heCh0aGlzLmluZGV4LmZpcnN0KCksIHN0YXJ0KTtcbiAgICAgICAgc3RvcCA9IGVuZHBvaW50Lm1pbih0aGlzLmluZGV4Lmxhc3QoKSwgc3RvcCk7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5nZXRRdWVyeU9iamVjdCgpO1xuICAgICAgICByZXR1cm4gcmFuZ2Uoc3RhcnRbMF0sIHN0b3BbMF0sIHN0ZXAsIHtpbmNsdWRlX2VuZDp0cnVlfSlcbiAgICAgICAgICAgIC5tYXAoKG9mZnNldCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBbY2FjaGUucXVlcnkob2Zmc2V0KS52YWx1ZSwgb2Zmc2V0XTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKExheWVyQmFzZS5wcm90b3R5cGUpO1xuZXZlbnRpZnkuYWRkVG9Qcm90b3R5cGUoTGF5ZXJCYXNlLnByb3RvdHlwZSk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ1VSU09SIEJBU0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBDdXJzb3JCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgLy8gZGVmaW5lIGNoYW5nZSBldmVudFxuICAgICAgICBldmVudGlmeS5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcbiAgICB9XG4gICAgXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBRVUVSWVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgcXVlcnkgKCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgZ2V0IGluZGV4KCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgRXZlbnRpZnk6IGltbWVkaWF0ZSBldmVudHNcbiAgICAqL1xuICAgIGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG4gICAgICAgIGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBbdGhpcy5xdWVyeSgpXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogQklORCBSRUxFQVNFIChjb252ZW5pZW5jZSlcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGJpbmQoY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHJldHVybiBiaW5kKHRoaXMsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgICAgIHJldHVybiByZWxlYXNlKGhhbmRsZSk7XG4gICAgfVxuXG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShDdXJzb3JCYXNlLnByb3RvdHlwZSk7XG5ldmVudGlmeS5hZGRUb1Byb3RvdHlwZShDdXJzb3JCYXNlLnByb3RvdHlwZSk7XG5cbiIsIlxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU09VUkNFIFBST1BFUlRZXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9ucyBmb3IgZXh0ZW5kaW5nIGEgY2xhc3Mgd2l0aCBzdXBwb3J0IGZvciBcbiAqIGV4dGVybmFsIHNvdXJjZSBvbiBhIG5hbWVkIHByb3BlcnR5LlxuICogXG4gKiBvcHRpb246IG11dGFibGU6dHJ1ZSBtZWFucyB0aGF0IHByb3BlcnkgbWF5IGJlIHJlc2V0IFxuICogXG4gKiBzb3VyY2Ugb2JqZWN0IGlzIGFzc3VtZWQgdG8gc3VwcG9ydCB0aGUgY2FsbGJhY2sgaW50ZXJmYWNlXG4gKi9cblxuZnVuY3Rpb24gcHJvcG5hbWVzIChwcm9wTmFtZSkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHByb3A6IGBfXyR7cHJvcE5hbWV9YCxcbiAgICAgICAgaW5pdDogYF9fJHtwcm9wTmFtZX1faW5pdGAsXG4gICAgICAgIGhhbmRsZTogYF9fJHtwcm9wTmFtZX1faGFuZGxlYCxcbiAgICAgICAgY2hhbmdlOiBgX18ke3Byb3BOYW1lfV9oYW5kbGVfY2hhbmdlYCxcbiAgICAgICAgZGV0YXRjaDogYF9fJHtwcm9wTmFtZX1fZGV0YXRjaGAsXG4gICAgICAgIGF0dGF0Y2g6IGBfXyR7cHJvcE5hbWV9X2F0dGF0Y2hgLFxuICAgICAgICBjaGVjazogYF9fJHtwcm9wTmFtZX1fY2hlY2tgXG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYWRkVG9JbnN0YW5jZSAob2JqZWN0LCBwcm9wTmFtZSkge1xuICAgIGNvbnN0IHAgPSBwcm9wbmFtZXMocHJvcE5hbWUpXG4gICAgb2JqZWN0W3AucHJvcF0gPSB1bmRlZmluZWRcbiAgICBvYmplY3RbcC5pbml0XSA9IGZhbHNlO1xuICAgIG9iamVjdFtwLmhhbmRsZV0gPSB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSwgcHJvcE5hbWUsIG9wdGlvbnM9e30pIHtcblxuICAgIGNvbnN0IHAgPSBwcm9wbmFtZXMocHJvcE5hbWUpXG5cbiAgICBmdW5jdGlvbiBkZXRhdGNoKCkge1xuICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIHNvdXJjZSBjaGFuZ2UgZXZlbnRcbiAgICAgICAgbGV0IHttdXRhYmxlPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChtdXRhYmxlICYmIHRoaXNbcC5wcm9wXSkge1xuICAgICAgICAgICAgbGV0IGhhbmRsZSA9IHRoaXNbcC5oYW5kbGVdO1xuICAgICAgICAgICAgdGhpc1twLnByb3BdLnJlbW92ZV9jYWxsYmFjayhoYW5kbGUpO1xuICAgICAgICAgICAgdGhpc1twLmhhbmRsZV0gPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgdGhpc1twLnByb3BdID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGF0dGF0Y2goc291cmNlKSB7XG4gICAgICAgIGxldCB7bXV0YWJsZT1mYWxzZX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoIXRoaXNbcC5pbml0XSB8fCBtdXRhYmxlKSB7XG4gICAgICAgICAgICB0aGlzW3AucHJvcF0gPSBzb3VyY2U7XG4gICAgICAgICAgICB0aGlzW3AuaW5pdF0gPSB0cnVlO1xuICAgICAgICAgICAgLy8gc3Vic2NyaWJlIHRvIGNhbGxiYWNrIGZyb20gc291cmNlXG4gICAgICAgICAgICBpZiAodGhpc1twLmNoYW5nZV0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gdGhpc1twLmNoYW5nZV0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzW3AuaGFuZGxlXSA9IHNvdXJjZS5hZGRfY2FsbGJhY2soaGFuZGxlcik7XG4gICAgICAgICAgICAgICAgaGFuZGxlcihcInJlc2V0XCIpOyBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtwcm9wTmFtZX0gY2FuIG5vdCBiZSByZWFzc2lnbmVkYCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBvYmplY3QgbXVzdCBpbXBsZW1lbnRcbiAgICAgKiBfX3twcm9wTmFtZX1faGFuZGxlX2NoYW5nZSgpIHt9XG4gICAgICogXG4gICAgICogb2JqZWN0IGNhbiBpbXBsZW1lbnRcbiAgICAgKiBfX3twcm9wTmFtZX1fY2hlY2soc291cmNlKSB7fVxuICAgICAqL1xuXG4gICAgLy8gZ2V0dGVyIGFuZCBzZXR0ZXJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoX3Byb3RvdHlwZSwgcHJvcE5hbWUsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpc1twLnByb3BdO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChzcmMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzW3AuY2hlY2tdKSB7XG4gICAgICAgICAgICAgICAgc3JjID0gdGhpc1twLmNoZWNrXShzcmMpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3JjICE9IHRoaXNbcC5wcm9wXSkge1xuICAgICAgICAgICAgICAgIHRoaXNbcC5kZXRhdGNoXSgpO1xuICAgICAgICAgICAgICAgIHRoaXNbcC5hdHRhdGNoXShzcmMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICB9KTtcblxuICAgIGNvbnN0IGFwaSA9IHt9O1xuICAgIGFwaVtwLmRldGF0Y2hdID0gZGV0YXRjaDtcbiAgICBhcGlbcC5hdHRhdGNoXSA9IGF0dGF0Y2g7XG5cbiAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG59XG5cbiIsIlxuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2V9IGZyb20gXCIuL2Jhc2VzXCI7XG5jb25zdCBNRVRIT0RTID0ge2Fzc2lnbiwgbW92ZSwgdHJhbnNpdGlvbiwgaW50ZXJwb2xhdGV9O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBjbWQgKHRhcmdldCkge1xuICAgIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhcmdldC5zcmMgbXVzdCBiZSBzdGF0ZXByb3ZpZGVyICR7dGFyZ2V0fWApO1xuICAgIH1cbiAgICBsZXQgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKE1FVEhPRFMpXG4gICAgICAgIC5tYXAoKFtuYW1lLCBtZXRob2RdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oLi4uYXJncykgeyBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGl0ZW1zID0gbWV0aG9kLmNhbGwodGhpcywgLi4uYXJncyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXQudXBkYXRlKGl0ZW1zKTsgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhlbnRyaWVzKTtcbn1cblxuZnVuY3Rpb24gYXNzaWduKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IGl0ZW0gPSB7XG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2YWx1ZSAgICAgICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtpdGVtXTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIG1vdmUodmVjdG9yKSB7XG4gICAgbGV0IGl0ZW0gPSB7XG4gICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICBkYXRhOiB2ZWN0b3IgIFxuICAgIH1cbiAgICByZXR1cm4gW2l0ZW1dO1xufVxuXG5mdW5jdGlvbiB0cmFuc2l0aW9uKHYwLCB2MSwgdDAsIHQxLCBlYXNpbmcpIHtcbiAgICBsZXQgaXRlbXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgdDAsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MCwgdDEsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwidHJhbnNpdGlvblwiLFxuICAgICAgICAgICAgZGF0YToge3YwLCB2MSwgdDAsIHQxLCBlYXNpbmd9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdjFcbiAgICAgICAgfVxuICAgIF1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cbmZ1bmN0aW9uIGludGVycG9sYXRlKHR1cGxlcykge1xuICAgIGxldCBbdjAsIHQwXSA9IHR1cGxlc1swXTtcbiAgICBsZXQgW3YxLCB0MV0gPSB0dXBsZXNbdHVwbGVzLmxlbmd0aC0xXTtcblxuICAgIGxldCBpdGVtcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYwXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QwLCB0MSwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJpbnRlcnBvbGF0aW9uXCIsXG4gICAgICAgICAgICBkYXRhOiB0dXBsZXNcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDEsIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MVxuICAgICAgICB9XG4gICAgXSAgICBcbiAgICByZXR1cm4gaXRlbXM7XG59XG5cblxuXG4iLCIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUiBTT1VSQ0UgSU5URVJGQUNFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIERlY29yYXRlIGFuIG9iamVjdC9wcm90b3R5cGUgdG8gaW1wbGVtZW50IFxuICogdGhlIExheWVyU291cmNlIGludGVyZmFjZS5cbiAqIFxuICogLSBpbmRleFxuICogLSB2YWx1ZUZ1bmNcbiAqIC0gZ2V0Q2FjaGVcbiAqIC0gY2xlYXJDYWNoZXNcbiAqL1xuXG5jb25zdCBQUkVGSVggPSBcIl9fbGF5ZXJzb3VyY2VcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2UgKG9iamVjdCwgQ2FjaGVDbGFzcywgdmFsdWVGdW5jKSB7XG4gICAgb2JqZWN0W2Ake1BSRUZJWH1faW5kZXhgXTtcbiAgICBvYmplY3RbYCR7UFJFRklYfV92YWx1ZUZ1bmNgXSA9IHZhbHVlRnVuYztcbiAgICBvYmplY3RbYCR7UFJFRklYfV9jYWNoZUNsYXNzYF0gPSBDYWNoZUNsYXNzO1xuICAgIG9iamVjdFtgJHtQUkVGSVh9X2NhY2hlT2JqZWN0c2BdID0gW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KF9wcm90b3R5cGUsIFwiaW5kZXhcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzW2Ake1BSRUZJWH1faW5kZXhgXTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICAgICAgICAgIHRoaXNbYCR7UFJFRklYfV9pbmRleGBdID0gaW5kZXg7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoX3Byb3RvdHlwZSwgXCJ2YWx1ZUZ1bmNcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzW2Ake1BSRUZJWH1fdmFsdWVGdW5jYF07XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGdldENhY2hlICgpIHtcbiAgICAgICAgbGV0IENhY2hlQ2xhc3MgPSB0aGlzW2Ake1BSRUZJWH1fY2FjaGVDbGFzc2BdXG4gICAgICAgIGNvbnNvbGUubG9nKENhY2hlQ2xhc3MpXG4gICAgICAgIGNvbnN0IGNhY2hlID0gbmV3IENhY2hlQ2xhc3ModGhpcyk7XG4gICAgICAgIHRoaXNbYCR7UFJFRklYfV9jYWNoZU9iamVjdHNgXS5wdXNoKGNhY2hlKTtcbiAgICAgICAgcmV0dXJuIGNhY2hlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNsZWFyQ2FjaGVzICgpIHtcbiAgICAgICAgZm9yIChsZXQgY2FjaGUgb2YgdGhpc1tgJHtQUkVGSVh9X2NhY2hlT2JqZWN0c2BdKSB7XG4gICAgICAgICAgICBjYWNoZS5jbGVhcigpO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIE9iamVjdC5hc3NpZ24oX3Byb3RvdHlwZSwge2dldENhY2hlLCBjbGVhckNhY2hlc30pO1xufVxuXG4iLCJpbXBvcnQgeyBldmVudGlmeSB9IGZyb20gXCIuL2V2ZW50aWZ5LmpzXCI7XG5pbXBvcnQgeyBpbnRlcnZhbCwgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IHJhbmdlIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0ICogYXMgbGF5ZXJzb3VyY2UgZnJvbSBcIi4vYXBpX2xheWVyc291cmNlLmpzXCI7XG5pbXBvcnQgKiBhcyBjYWxsYmFjayBmcm9tIFwiLi9hcGlfY2FsbGJhY2suanNcIjtcbmltcG9ydCB7IHRvU3RhdGUgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTEFZRVJcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogTGF5ZXIgaXMgYmFzZSBjbGFzcyBmb3IgTGF5ZXJzXG4gKiBkZWZpbmVkIGJ5IGFuIGluZGV4IGFuZCBhIHZhbHVlRnVuY1xuICovXG5cbmV4cG9ydCBjbGFzcyBMYXllciB7XG5cbiAgICBjb25zdHJ1Y3RvcihDYWNoZUNsYXNzLCB2YWx1ZUZ1bmMpIHtcbiAgICAgICAgLy8gY2FsbGJhY2tzXG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIC8vIGxheWVyIHNvdXJjZSBhcGlcbiAgICAgICAgbGF5ZXJzb3VyY2UuYWRkVG9JbnN0YW5jZSh0aGlzLCBDYWNoZUNsYXNzLCB2YWx1ZUZ1bmMpO1xuICAgICAgICAvLyBkZWZpbmUgY2hhbmdlIGV2ZW50XG4gICAgICAgIGV2ZW50aWZ5LmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlEZWZpbmUoXCJjaGFuZ2VcIiwge2luaXQ6dHJ1ZX0pO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIFNhbXBsZSBMYXllciBieSB0aW1lbGluZSBvZmZzZXQgaW5jcmVtZW50c1xuICAgICAgICByZXR1cm4gbGlzdCBvZiB0dXBsZXMgW3ZhbHVlLCBvZmZzZXRdXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICAgLSBzdGFydFxuICAgICAgICAtIHN0b3BcbiAgICAgICAgLSBzdGVwXG4gICAgKi9cbiAgICBzYW1wbGUob3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge3N0YXJ0PS1JbmZpbml0eSwgc3RvcD1JbmZpbml0eSwgc3RlcD0xfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzdGFydCA+IHN0b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciAoXCJzdG9wIG11c3QgYmUgbGFyZ2VyIHRoYW4gc3RhcnRcIiwgc3RhcnQsIHN0b3ApXG4gICAgICAgIH1cbiAgICAgICAgc3RhcnQgPSBbc3RhcnQsIDBdO1xuICAgICAgICBzdG9wID0gW3N0b3AsIDBdO1xuICAgICAgICBzdGFydCA9IGVuZHBvaW50Lm1heCh0aGlzLmluZGV4LmZpcnN0KCksIHN0YXJ0KTtcbiAgICAgICAgc3RvcCA9IGVuZHBvaW50Lm1pbih0aGlzLmluZGV4Lmxhc3QoKSwgc3RvcCk7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gdGhpcy5nZXRDYWNoZSgpO1xuICAgICAgICByZXR1cm4gcmFuZ2Uoc3RhcnRbMF0sIHN0b3BbMF0sIHN0ZXAsIHtpbmNsdWRlX2VuZDp0cnVlfSlcbiAgICAgICAgICAgIC5tYXAoKG9mZnNldCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBbY2FjaGUucXVlcnkob2Zmc2V0KS52YWx1ZSwgb2Zmc2V0XTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKExheWVyLnByb3RvdHlwZSk7XG5sYXllcnNvdXJjZS5hZGRUb1Byb3RvdHlwZShMYXllci5wcm90b3R5cGUpO1xuZXZlbnRpZnkuYWRkVG9Qcm90b3R5cGUoTGF5ZXIucHJvdG90eXBlKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExBWUVSIENBQ0hFXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFRoaXMgaW1wbGVtZW50cyBhIENhY2hlIHRvIGJlIHVzZWQgd2l0aCBMYXllciBvYmplY3RzXG4gKiBcbiAqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJDYWNoZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihsYXllcikge1xuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IHN0YXRlXG4gICAgICAgIHRoaXMuX25lYXJieTtcbiAgICAgICAgLy8gY2FjaGVkIHJlc3VsdFxuICAgICAgICB0aGlzLl9zdGF0ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBxdWVyeSBjYWNoZVxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBjb25zdCBuZWVkX25lYXJieSA9IChcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICFpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5fbmVhcmJ5Lml0diwgb2Zmc2V0KVxuICAgICAgICApO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICAhbmVlZF9uZWFyYnkgJiYgXG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSAhPSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICF0aGlzLl9zdGF0ZS5keW5hbWljXG4gICAgICAgICkge1xuICAgICAgICAgICAgLy8gY2FjaGUgaGl0XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuX3N0YXRlLCBvZmZzZXR9O1xuICAgICAgICB9XG4gICAgICAgIC8vIGNhY2hlIG1pc3NcbiAgICAgICAgaWYgKG5lZWRfbmVhcmJ5KSB7XG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPSB0aGlzLl9sYXllci5pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBwZXJmb3JtIGFjdHVhbCBxdWVyeVxuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9uZWFyYnkuY2VudGVyLm1hcCgoaXRlbSkgPT4gaXRlbS5zcmMucXVlcnkob2Zmc2V0KSk7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gdG9TdGF0ZShzdGF0ZXMsIHRoaXMuX2xheWVyLnZhbHVlRnVuYylcbiAgICAgICAgLy8gY2FjaGUgc3RhdGUgb25seSBpZiBub3QgZHluYW1pY1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IChzdGF0ZS5keW5hbWljKSA/IHVuZGVmaW5lZCA6IHN0YXRlO1xuICAgICAgICByZXR1cm4gc3RhdGUgICAgXG4gICAgfVxuXG4gICAgY2xlYXIoKSB7XG4gICAgICAgIHRoaXMuX2l0diA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gICAgfVxufVxuXG5cblxuXG5cbiIsImltcG9ydCB7IFN0YXRlUHJvdmlkZXJCYXNlIH0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7IGVuZHBvaW50IH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0NBTCBTVEFURSBQUk9WSURFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIExvY2FsIEFycmF5IHdpdGggbm9uLW92ZXJsYXBwaW5nIGl0ZW1zLlxuICovXG5cbmV4cG9ydCBjbGFzcyBMb2NhbFN0YXRlUHJvdmlkZXIgZXh0ZW5kcyBTdGF0ZVByb3ZpZGVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8vIGluaXRpYWxpemF0aW9uXG4gICAgICAgIGxldCB7aXRlbXMsIHZhbHVlfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChpdGVtcyAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIGluaXRpYWxpemUgZnJvbSBpdGVtc1xuICAgICAgICAgICAgdGhpcy5faXRlbXMgPSBjaGVja19pbnB1dChpdGVtcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBpbml0aWFsaXplIGZyb20gdmFsdWVcbiAgICAgICAgICAgIHRoaXMuX2l0ZW1zID0gW3tcbiAgICAgICAgICAgICAgICBpdHY6Wy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLCBcbiAgICAgICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgICAgIGRhdGE6dmFsdWVcbiAgICAgICAgICAgIH1dO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5faXRlbXMgPSBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZSAoaXRlbXMsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5faXRlbXMgPSBjaGVja19pbnB1dChpdGVtcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBnZXRfaXRlbXMgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXRlbXMuc2xpY2UoKTtcbiAgICB9XG5cbiAgICBnZXQgaW5mbyAoKSB7XG4gICAgICAgIHJldHVybiB7b3ZlcmxhcHBpbmc6IGZhbHNlfTtcbiAgICB9XG59XG5cblxuZnVuY3Rpb24gY2hlY2tfaW5wdXQoaXRlbXMpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIklucHV0IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgfVxuICAgIC8vIHNvcnQgaXRlbXMgYmFzZWQgb24gaW50ZXJ2YWwgbG93IGVuZHBvaW50XG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBsZXQgYV9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGEuaXR2KVswXTtcbiAgICAgICAgbGV0IGJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChiLml0dilbMF07XG4gICAgICAgIHJldHVybiBlbmRwb2ludC5jbXAoYV9sb3csIGJfbG93KTtcbiAgICB9KTtcbiAgICAvLyBjaGVjayB0aGF0IGl0ZW0gaW50ZXJ2YWxzIGFyZSBub24tb3ZlcmxhcHBpbmdcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBwcmV2X2hpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2kgLSAxXS5pdHYpWzFdO1xuICAgICAgICBsZXQgY3Vycl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2ldLml0dilbMF07XG4gICAgICAgIC8vIHZlcmlmeSB0aGF0IHByZXYgaGlnaCBpcyBsZXNzIHRoYXQgY3VyciBsb3dcbiAgICAgICAgaWYgKCFlbmRwb2ludC5sdChwcmV2X2hpZ2gsIGN1cnJfbG93KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT3ZlcmxhcHBpbmcgaW50ZXJ2YWxzIGZvdW5kXCIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuXG5cblxuIiwiaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbkJBU0UgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLypcblx0QWJzdHJhY3QgQmFzZSBDbGFzcyBmb3IgU2VnbWVudHNcblxuICAgIGNvbnN0cnVjdG9yKGludGVydmFsKVxuXG4gICAgLSBpbnRlcnZhbDogaW50ZXJ2YWwgb2YgdmFsaWRpdHkgb2Ygc2VnbWVudFxuICAgIC0gZHluYW1pYzogdHJ1ZSBpZiBzZWdtZW50IGlzIGR5bmFtaWNcbiAgICAtIHZhbHVlKG9mZnNldCk6IHZhbHVlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4gICAgLSBxdWVyeShvZmZzZXQpOiBzdGF0ZSBvZiBzZWdtZW50IGF0IG9mZnNldFxuKi9cblxuZXhwb3J0IGNsYXNzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYpIHtcblx0XHR0aGlzLl9pdHYgPSBpdHY7XG5cdH1cblxuXHRnZXQgaXR2KCkge3JldHVybiB0aGlzLl9pdHY7fVxuXG4gICAgLyoqIFxuICAgICAqIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzXG4gICAgICogcmV0dXJucyB7dmFsdWUsIGR5bmFtaWN9O1xuICAgICovXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgXHR0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY29udmVuaWVuY2UgZnVuY3Rpb24gcmV0dXJuaW5nIHRoZSBzdGF0ZSBvZiB0aGUgc2VnbWVudFxuICAgICAqIEBwYXJhbSB7Kn0gb2Zmc2V0IFxuICAgICAqIEByZXR1cm5zIFxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX2l0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHsuLi50aGlzLnN0YXRlKG9mZnNldCksIG9mZnNldH07XG4gICAgICAgIH0gXG4gICAgICAgIHJldHVybiB7dmFsdWU6IHVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUlMgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJzU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcblx0XHR0aGlzLl9sYXllcnMgPSBhcmdzLmxheWVycztcbiAgICAgICAgdGhpcy5fdmFsdWVfZnVuYyA9IGFyZ3MudmFsdWVfZnVuY1xuXG4gICAgICAgIC8vIFRPRE8gLSBmaWd1cmUgb3V0IGR5bmFtaWMgaGVyZT9cbiAgICB9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIC8vIFRPRE8gLSB1c2UgdmFsdWUgZnVuY1xuICAgICAgICAvLyBmb3Igbm93IC0ganVzdCB1c2UgZmlyc3QgbGF5ZXJcbiAgICAgICAgcmV0dXJuIHsuLi50aGlzLl9sYXllcnNbMF0ucXVlcnkob2Zmc2V0KSwgb2Zmc2V0fTtcblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNUQVRJQyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX3ZhbHVlID0gZGF0YTtcblx0fVxuXG5cdHN0YXRlKCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl92YWx1ZSwgZHluYW1pYzpmYWxzZX1cblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE1PVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuICAgIEltcGxlbWVudHMgZGV0ZXJtaW5pc3RpYyBwcm9qZWN0aW9uIGJhc2VkIG9uIGluaXRpYWwgY29uZGl0aW9ucyBcbiAgICAtIG1vdGlvbiB2ZWN0b3IgZGVzY3JpYmVzIG1vdGlvbiB1bmRlciBjb25zdGFudCBhY2NlbGVyYXRpb25cbiovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuICAgICAgICBzdXBlcihpdHYpO1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBwb3NpdGlvbjpwMD0wLCBcbiAgICAgICAgICAgIHZlbG9jaXR5OnYwPTAsIFxuICAgICAgICAgICAgYWNjZWxlcmF0aW9uOmEwPTAsIFxuICAgICAgICAgICAgdGltZXN0YW1wOnQwPTBcbiAgICAgICAgfSA9IGRhdGE7XG4gICAgICAgIC8vIGNyZWF0ZSBtb3Rpb24gdHJhbnNpdGlvblxuICAgICAgICB0aGlzLl9wb3NfZnVuYyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgbGV0IGQgPSB0cyAtIHQwO1xuICAgICAgICAgICAgcmV0dXJuIHAwICsgdjAqZCArIDAuNSphMCpkKmQ7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX3ZlbF9mdW5jID0gZnVuY3Rpb24gKHRzKSB7XG4gICAgICAgICAgICBsZXQgZCA9IHRzIC0gdDA7XG4gICAgICAgICAgICByZXR1cm4gdjAgKyBhMCpkO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2FjY19mdW5jID0gZnVuY3Rpb24gKHRzKSB7XG4gICAgICAgICAgICByZXR1cm4gYTA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgbGV0IHBvcyA9IHRoaXMuX3Bvc19mdW5jKG9mZnNldCk7XG4gICAgICAgIGxldCB2ZWwgPSB0aGlzLl92ZWxfZnVuYyhvZmZzZXQpO1xuICAgICAgICBsZXQgYWNjID0gdGhpcy5fYWNjX2Z1bmMob2Zmc2V0KTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBwb3MsXG4gICAgICAgICAgICB2ZWxvY2l0eTogdmVsLFxuICAgICAgICAgICAgYWNjZWxlcmF0aW9uOiBhY2MsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IG9mZnNldCxcbiAgICAgICAgICAgIHZhbHVlOiBwb3MsXG4gICAgICAgICAgICBkeW5hbWljOiAodmVsICE9IDAgfHwgYWNjICE9IDAgKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRSQU5TSVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIFN1cHBvcnRlZCBlYXNpbmcgZnVuY3Rpb25zXG4gICAgXCJlYXNlLWluXCI6XG4gICAgXCJlYXNlLW91dFwiOlxuICAgIFwiZWFzZS1pbi1vdXRcIlxuKi9cblxuZnVuY3Rpb24gZWFzZWluICh0cykge1xuICAgIHJldHVybiBNYXRoLnBvdyh0cywyKTsgIFxufVxuZnVuY3Rpb24gZWFzZW91dCAodHMpIHtcbiAgICByZXR1cm4gMSAtIGVhc2VpbigxIC0gdHMpO1xufVxuZnVuY3Rpb24gZWFzZWlub3V0ICh0cykge1xuICAgIGlmICh0cyA8IC41KSB7XG4gICAgICAgIHJldHVybiBlYXNlaW4oMiAqIHRzKSAvIDI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICgyIC0gZWFzZWluKDIgKiAoMSAtIHRzKSkpIC8gMjtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFuc2l0aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGRhdGEpIHtcblx0XHRzdXBlcihpdHYpO1xuICAgICAgICBsZXQge3YwLCB2MSwgZWFzaW5nfSA9IGRhdGE7XG4gICAgICAgIGxldCBbdDAsIHQxXSA9IHRoaXMuX2l0di5zbGljZSgwLDIpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgdHJhbnNpdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl9keW5hbWljID0gdjEtdjAgIT0gMDtcbiAgICAgICAgdGhpcy5fdHJhbnMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgdHMgdG8gW3QwLHQxXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzaGlmdCBmcm9tIFt0MCx0MV0tc3BhY2UgdG8gWzAsKHQxLXQwKV0tc3BhY2VcbiAgICAgICAgICAgIC8vIC0gc2NhbGUgZnJvbSBbMCwodDEtdDApXS1zcGFjZSB0byBbMCwxXS1zcGFjZVxuICAgICAgICAgICAgdHMgPSB0cyAtIHQwO1xuICAgICAgICAgICAgdHMgPSB0cy9wYXJzZUZsb2F0KHQxLXQwKTtcbiAgICAgICAgICAgIC8vIGVhc2luZyBmdW5jdGlvbnMgc3RyZXRjaGVzIG9yIGNvbXByZXNzZXMgdGhlIHRpbWUgc2NhbGUgXG4gICAgICAgICAgICBpZiAoZWFzaW5nID09IFwiZWFzZS1pblwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW4odHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlb3V0KHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWFzaW5nID09IFwiZWFzZS1pbi1vdXRcIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZWlub3V0KHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc2l0aW9uIGZyb20gdjAgdG8gdjEsIGZvciB0aW1lIHZhbHVlcyBbMCwxXVxuICAgICAgICAgICAgdHMgPSBNYXRoLm1heCh0cywgMCk7XG4gICAgICAgICAgICB0cyA9IE1hdGgubWluKHRzLCAxKTtcbiAgICAgICAgICAgIHJldHVybiB2MCArICh2MS12MCkqdHM7XG4gICAgICAgIH1cblx0fVxuXG5cdHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl90cmFucyhvZmZzZXQpLCBkeW5hbWljOnRoaXMuX2R5bmFtaWN9XG5cdH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElOVEVSUE9MQVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9uIHRvIGNyZWF0ZSBhbiBpbnRlcnBvbGF0b3IgZm9yIG5lYXJlc3QgbmVpZ2hib3IgaW50ZXJwb2xhdGlvbiB3aXRoXG4gKiBleHRyYXBvbGF0aW9uIHN1cHBvcnQuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdHVwbGVzIC0gQW4gYXJyYXkgb2YgW3ZhbHVlLCBvZmZzZXRdIHBhaXJzLCB3aGVyZSB2YWx1ZSBpcyB0aGVcbiAqIHBvaW50J3MgdmFsdWUgYW5kIG9mZnNldCBpcyB0aGUgY29ycmVzcG9uZGluZyBvZmZzZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gQSBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIG9mZnNldCBhbmQgcmV0dXJucyB0aGVcbiAqIGludGVycG9sYXRlZCBvciBleHRyYXBvbGF0ZWQgdmFsdWUuXG4gKi9cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUodHVwbGVzKSB7XG5cbiAgICBpZiAodHVwbGVzLmxlbmd0aCA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHVuZGVmaW5lZDt9XG4gICAgfSBlbHNlIGlmICh0dXBsZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHR1cGxlc1swXVswXTt9XG4gICAgfVxuXG4gICAgLy8gU29ydCB0aGUgdHVwbGVzIGJ5IHRoZWlyIG9mZnNldHNcbiAgICBjb25zdCBzb3J0ZWRUdXBsZXMgPSBbLi4udHVwbGVzXS5zb3J0KChhLCBiKSA9PiBhWzFdIC0gYlsxXSk7XG4gIFxuICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3Iob2Zmc2V0KSB7XG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBiZWZvcmUgdGhlIGZpcnN0IHBvaW50XG4gICAgICBpZiAob2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1swXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1swXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbMV07XG4gICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gSGFuZGxlIGV4dHJhcG9sYXRpb24gYWZ0ZXIgdGhlIGxhc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMl07XG4gICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICBcbiAgICAgIC8vIEZpbmQgdGhlIG5lYXJlc3QgcG9pbnRzIHRvIHRoZSBsZWZ0IGFuZCByaWdodFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW2ldWzFdICYmIG9mZnNldCA8PSBzb3J0ZWRUdXBsZXNbaSArIDFdWzFdKSB7XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbaV07XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbaSArIDFdO1xuICAgICAgICAgIC8vIExpbmVhciBpbnRlcnBvbGF0aW9uIGZvcm11bGE6IHkgPSB5MSArICggKHggLSB4MSkgKiAoeTIgLSB5MSkgLyAoeDIgLSB4MSkgKVxuICAgICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICBcbiAgICAgIC8vIEluIGNhc2UgdGhlIG9mZnNldCBkb2VzIG5vdCBmYWxsIHdpdGhpbiBhbnkgcmFuZ2UgKHNob3VsZCBiZSBjb3ZlcmVkIGJ5IHRoZSBwcmV2aW91cyBjb25kaXRpb25zKVxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9O1xufVxuICBcblxuZXhwb3J0IGNsYXNzIEludGVycG9sYXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG4gICAgY29uc3RydWN0b3IoaXR2LCB0dXBsZXMpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcbiAgICAgICAgLy8gc2V0dXAgaW50ZXJwb2xhdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl90cmFucyA9IGludGVycG9sYXRlKHR1cGxlcyk7XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dHJ1ZX07XG4gICAgfVxufVxuXG5cbiIsImltcG9ydCB7IFxuICAgIFN0YXRlUHJvdmlkZXJCYXNlLFxuICAgIE1vdGlvblByb3ZpZGVyQmFzZSBcbn0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7IE1vdGlvblNlZ21lbnQgfSBmcm9tIFwiLi9zZWdtZW50cy5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0NBTCBNT1RJT04gUFJPVklERVIgXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogVGhpcyBpbXBsZW1lbnRzIGEgbG9jYWwgTW90aW9uUHJvdmlkZXJcbiAqICBcbiAqIHN0YXRlID0ge1xuICogICAgICBwb3NpdGlvbjogMCxcbiAqICAgICAgdmVsb2NpdHk6IDAsXG4gKiAgICAgIGFjY2VsZXJhdGlvbjogMCxcbiAqICAgICAgdGltZXN0YW1wOiAwXG4gKiAgICAgIHJhbmdlOiBbdW5kZWZpbmVkLCB1bmRlZmluZWRdXG4gKiB9XG4gKiBcbiAqIElucHV0L291dHB1dCBjaGVja2luZyBpcyBwZXJmb3JtZWQgYnkgdGhlIHdyYXBwZXIuXG4gKiBcbiAqL1xuXG5leHBvcnQgY2xhc3MgTG9jYWxNb3Rpb25Qcm92aWRlciBleHRlbmRzIE1vdGlvblByb3ZpZGVyQmFzZSB7XG5cbiAgICBzZXRfc3RhdGUgKHN0YXRlKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0YXRlID0gc3RhdGU7XG4gICAgICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE1PVElPTiBTVEFURSBQUk9WSURFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFdyYXBzIHRoZSBzaW1wbGVyIG1vdGlvbiBwcm92aWRlciB0byBlbnN1cmUgXG4gKiBjaGVja2luZyBvZiBzdGF0ZSBhbmQgaW1wbGVtZW50IHRoZSBTdGF0ZVByb3ZpZGVyIFxuICogaW50ZXJmYWNlLlxuICovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25TdGF0ZVByb3ZpZGVyIGV4dGVuZHMgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IobXApIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgaWYgKCEobXAgaW5zdGFuY2VvZiBNb3Rpb25Qcm92aWRlckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG11c3QgYmUgTW90aW9uUHJvdmlkZXJCYXNlICR7bXB9YClcbiAgICAgICAgfVxuICAgICAgICAvLyBtb3Rpb24gcHJvdmlkZXJcbiAgICAgICAgdGhpcy5fbXAgPSBtcDtcbiAgICAgICAgLy8gY2hlY2sgaW5pdGlhbCBzdGF0ZSBvZiBtb3Rpb24gcHJvdmlkZXJcbiAgICAgICAgdGhpcy5fbXAuX3N0YXRlID0gY2hlY2tfc3RhdGUodGhpcy5fbXAuX3N0YXRlKVxuICAgICAgICAvLyBzdWJzY3JpYmUgdG8gY2FsbGJhY2tzXG4gICAgICAgIHRoaXMuX21wLmFkZF9jYWxsYmFjayh0aGlzLl9oYW5kbGVfY2FsbGJhY2suYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgX2hhbmRsZV9jYWxsYmFjaygpIHtcbiAgICAgICAgLy8gRm9yd2FyZCBjYWxsYmFjayBmcm9tIHdyYXBwZWQgbW90aW9uIHByb3ZpZGVyXG4gICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHVwZGF0ZSBtb3Rpb24gc3RhdGVcbiAgICAgKi9cblxuICAgIHVwZGF0ZShpdGVtcywgb3B0aW9ucz17fSkge1xuICAgICAgICAvLyBUT0RPIC0gaXRlbXMgc2hvdWxkIGJlIGNvdmVydGVkIHRvIG1vdGlvbiBzdGF0ZVxuICAgICAgICBsZXQgc3RhdGUgPSBzdGF0ZV9mcm9tX2l0ZW1zKGl0ZW1zKTtcbiAgICAgICAgc3RhdGUgPSBjaGVja19zdGF0ZShzdGF0ZSk7XG4gICAgICAgIC8vIGZvcndhcmQgdXBkYXRlcyB0byB3cmFwcGVkIG1vdGlvbiBwcm92aWRlclxuICAgICAgICByZXR1cm4gdGhpcy5fbXAuc2V0X3N0YXRlKHN0YXRlKTtcbiAgICB9XG5cbiAgICBnZXRfc3RhdGUoKSB7XG4gICAgICAgIC8vIHJlc29sdmUgc3RhdGUgZnJvbSB3cmFwcGVkIG1vdGlvbiBwcm92aWRlclxuICAgICAgICBsZXQgc3RhdGUgPSB0aGlzLl9tcC5nZXRfc3RhdGUoKTtcbiAgICAgICAgc3RhdGUgPSBjaGVja19zdGF0ZShzdGF0ZSlcbiAgICAgICAgcmV0dXJuIGl0ZW1zX2Zyb21fc3RhdGUoc3RhdGUpO1xuICAgIH1cblxuICAgIGdldCBpbmZvICgpIHtcbiAgICAgICAgcmV0dXJuIHtvdmVybGFwcGluZzogZmFsc2V9O1xuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVVRJTFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5mdW5jdGlvbiBjaGVja19zdGF0ZShzdGF0ZSkge1xuICAgIGxldCB7XG4gICAgICAgIHBvc2l0aW9uPTAsIFxuICAgICAgICB2ZWxvY2l0eT0wLCBcbiAgICAgICAgYWNjZWxlcmF0aW9uPTAsXG4gICAgICAgIHRpbWVzdGFtcD0wLFxuICAgICAgICByYW5nZT1bdW5kZWZpbmVkLCB1bmRlZmluZWRdIFxuICAgIH0gPSBzdGF0ZSB8fCB7fTtcbiAgICBzdGF0ZSA9IHtcbiAgICAgICAgcG9zaXRpb24sIFxuICAgICAgICB2ZWxvY2l0eSxcbiAgICAgICAgYWNjZWxlcmF0aW9uLFxuICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgIHJhbmdlXG4gICAgfVxuICAgIC8vIHZlY3RvciB2YWx1ZXMgbXVzdCBiZSBmaW5pdGUgbnVtYmVyc1xuICAgIGNvbnN0IHByb3BzID0gW1wicG9zaXRpb25cIiwgXCJ2ZWxvY2l0eVwiLCBcImFjY2VsZXJhdGlvblwiLCBcInRpbWVzdGFtcFwiXTtcbiAgICBmb3IgKGxldCBwcm9wIG9mIHByb3BzKSB7XG4gICAgICAgIGxldCBuID0gc3RhdGVbcHJvcF07XG4gICAgICAgIGlmICghaXNGaW5pdGVOdW1iZXIobikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtwcm9wfSBtdXN0IGJlIG51bWJlciAke259YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByYW5nZSB2YWx1ZXMgY2FuIGJlIHVuZGVmaW5lZCBvciBhIG51bWJlclxuICAgIGZvciAobGV0IG4gb2YgcmFuZ2UpIHtcbiAgICAgICAgaWYgKCEobiA9PSB1bmRlZmluZWQgfHwgaXNGaW5pdGVOdW1iZXIobikpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHJhbmdlIHZhbHVlIG11c3QgYmUgdW5kZWZpbmVkIG9yIG51bWJlciAke259YCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgbGV0IFtsb3csIGhpZ2hdID0gcmFuZ2U7XG4gICAgaWYgKGxvdyAhPSB1bmRlZmluZWQgJiYgbG93ICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAobG93ID49IGhpZ2gpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgbG93ID4gaGlnaCBbJHtsb3d9LCAke2hpZ2h9XWApXG4gICAgICAgIH0gXG4gICAgfVxuICAgIHJldHVybiB7cG9zaXRpb24sIHZlbG9jaXR5LCBhY2NlbGVyYXRpb24sIHRpbWVzdGFtcCwgcmFuZ2V9O1xufVxuXG5mdW5jdGlvbiBpc0Zpbml0ZU51bWJlcihuKSB7XG4gICAgcmV0dXJuICh0eXBlb2YgbiA9PSBcIm51bWJlclwiKSAmJiBpc0Zpbml0ZShuKTtcbn1cblxuLyoqXG4gKiBjb252ZXJ0IGl0ZW0gbGlzdCBpbnRvIG1vdGlvbiBzdGF0ZVxuICovXG5cbmZ1bmN0aW9uIHN0YXRlX2Zyb21faXRlbXMoaXRlbXMpIHtcbiAgICAvLyBwaWNrIG9uZSBpdGVtIG9mIG1vdGlvbiB0eXBlXG4gICAgY29uc3QgaXRlbSA9IGl0ZW1zLmZpbmQoKGl0ZW0pID0+IHtcbiAgICAgICAgcmV0dXJuIGl0ZW0udHlwZSA9PSBcIm1vdGlvblwiO1xuICAgIH0pXG4gICAgaWYgKGl0ZW0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBpdGVtLmRhdGE7XG4gICAgfVxufVxuXG4vKipcbiAqIGNvbnZlcnQgbW90aW9uIHN0YXRlIGludG8gaXRlbXMgbGlzdFxuICovXG5cbmZ1bmN0aW9uIGl0ZW1zX2Zyb21fc3RhdGUgKHN0YXRlKSB7XG4gICAgLy8gbW90aW9uIHNlZ21lbnQgZm9yIGNhbGN1bGF0aW9uXG4gICAgbGV0IFtsb3csIGhpZ2hdID0gc3RhdGUucmFuZ2U7XG4gICAgY29uc3Qgc2VnID0gbmV3IE1vdGlvblNlZ21lbnQoW2xvdywgaGlnaCwgdHJ1ZSwgdHJ1ZV0sIHN0YXRlKTtcbiAgICBjb25zdCB7dmFsdWU6dmFsdWVfbG93fSA9IHNlZy5zdGF0ZShsb3cpO1xuICAgIGNvbnN0IHt2YWx1ZTp2YWx1ZV9oaWdofSA9IHNlZy5zdGF0ZShoaWdoKTtcblxuICAgIC8vIHNldCB1cCBpdGVtc1xuICAgIGlmIChsb3cgPT0gdW5kZWZpbmVkICYmIGhpZ2ggPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBbe1xuICAgICAgICAgICAgaXR2OlstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSwgXG4gICAgICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICAgICAgYXJnczogc3RhdGVcbiAgICAgICAgfV07XG4gICAgfSBlbHNlIGlmIChsb3cgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaXR2OlstSW5maW5pdHksIGhpZ2gsIHRydWUsIHRydWVdLCBcbiAgICAgICAgICAgICAgICB0eXBlOiBcIm1vdGlvblwiLFxuICAgICAgICAgICAgICAgIGFyZ3M6IHN0YXRlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGl0djpbaGlnaCwgSW5maW5pdHksIGZhbHNlLCB0cnVlXSwgXG4gICAgICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgICAgICBhcmdzOiB2YWx1ZV9oaWdoXG4gICAgICAgICAgICB9LFxuICAgICAgICBdO1xuICAgIH0gZWxzZSBpZiAoaGlnaCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpdHY6Wy1JbmZpbml0eSwgbG93LCB0cnVlLCBmYWxzZV0sIFxuICAgICAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICAgICAgYXJnczogdmFsdWVfbG93XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGl0djpbbG93LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sIFxuICAgICAgICAgICAgICAgIHR5cGU6IFwibW90aW9uXCIsXG4gICAgICAgICAgICAgICAgYXJnczogc3RhdGVcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpdHY6Wy1JbmZpbml0eSwgbG93LCB0cnVlLCBmYWxzZV0sIFxuICAgICAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICAgICAgYXJnczogdmFsdWVfbG93XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGl0djpbbG93LCBoaWdoLCB0cnVlLCB0cnVlXSwgXG4gICAgICAgICAgICAgICAgdHlwZTogXCJtb3Rpb25cIixcbiAgICAgICAgICAgICAgICBhcmdzOiBzdGF0ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpdHY6W2hpZ2gsIEluZmluaXR5LCBmYWxzZSwgdHJ1ZV0sIFxuICAgICAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICAgICAgYXJnczogdmFsdWVfaGlnaFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXTtcbiAgICB9XG59XG5cbiIsImltcG9ydCB7IENMT0NLIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgXG4gICAgQ2xvY2tQcm92aWRlckJhc2UsXG4gICAgTW90aW9uUHJvdmlkZXJCYXNlLFxuICAgIFN0YXRlUHJvdmlkZXJCYXNlLFxuICAgIEN1cnNvckJhc2UsIFxufSBmcm9tIFwiLi9iYXNlcy5qc1wiO1xuaW1wb3J0ICogYXMgc291cmNlcHJvcCBmcm9tIFwiLi9zb3VyY2Vwcm9wLmpzXCI7XG5pbXBvcnQgeyBjbWQgfSBmcm9tIFwiLi9jbWQuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4vbmV3bGF5ZXIuanNcIjtcbmltcG9ydCB7IExvY2FsU3RhdGVQcm92aWRlciB9IGZyb20gXCIuL3N0YXRlcHJvdmlkZXJfc2ltcGxlLmpzXCI7XG5pbXBvcnQgeyBNb3Rpb25TdGF0ZVByb3ZpZGVyIH0gZnJvbSBcIi4vc3RhdGVwcm92aWRlcl9tb3Rpb24uanNcIjtcbmltcG9ydCB7IGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExPQ0FMIENMT0NLIFBST1ZJREVSXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jbGFzcyBMb2NhbENsb2NrUHJvdmlkZXIgZXh0ZW5kcyBDbG9ja1Byb3ZpZGVyQmFzZSB7XG4gICAgbm93ICgpIHtcbiAgICAgICAgcmV0dXJuIENMT0NLLm5vdygpO1xuICAgIH1cbn1cbmNvbnN0IGxvY2FsQ2xvY2tQcm92aWRlciA9IG5ldyBMb2NhbENsb2NrUHJvdmlkZXIoKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBcbiAqIEN1cnNvciBpcyBhIHZhcmlhYmxlXG4gKiAtIGhhcyBtdXRhYmxlIGN0cmwgY3Vyc29yIChkZWZhdWx0IExvY2FsQ2xvY2tQcm92aWRlcilcbiAqIC0gaGFzIG11dGFibGUgc3RhdGUgcHJvdmlkZXIgKHNyYykgKGRlZmF1bHQgc3RhdGUgdW5kZWZpbmVkKVxuICogLSBtZXRob2RzIGZvciBhc3NpZ24sIG1vdmUsIHRyYW5zaXRpb24sIGludGVwb2xhdGlvblxuICogXG4gKi9cblxuZXhwb3J0IGNsYXNzIEN1cnNvciBleHRlbmRzIEN1cnNvckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLy8gY3RybFxuICAgICAgICBzb3VyY2Vwcm9wLmFkZFRvSW5zdGFuY2UodGhpcywgXCJjdHJsXCIpO1xuICAgICAgICAvLyBzcmNcbiAgICAgICAgc291cmNlcHJvcC5hZGRUb0luc3RhbmNlKHRoaXMsIFwic3JjXCIpO1xuICAgICAgICAvLyBpbmRleFxuICAgICAgICB0aGlzLl9pbmRleDtcbiAgICAgICAgLy8gY3Vyc29yIG1haW50YWlucyBhIGNhc2hlIG9iamVjdCBmb3IgcXVlcnlpbmcgc3JjIGxheWVyXG4gICAgICAgIHRoaXMuX2NhY2hlO1xuICAgICAgICAvLyB0aW1lb3V0XG4gICAgICAgIHRoaXMuX3RpZDtcbiAgICAgICAgLy8gcG9sbGluZ1xuICAgICAgICB0aGlzLl9waWQ7XG4gICAgICAgIC8vIG9wdGlvbnNcbiAgICAgICAgbGV0IHtzcmMsIGN0cmwsIC4uLm9wdHN9ID0gb3B0aW9ucztcblxuICAgICAgICAvLyBpbml0aWFsaXNlIGN0cmxcbiAgICAgICAgdGhpcy5jdHJsID0gY3RybCB8fCBsb2NhbENsb2NrUHJvdmlkZXI7XG4gICAgICAgIC8vIGluaXRpYWxpc2Ugc3JjXG4gICAgICAgIHRoaXMuc3JjID0gc3JjIHx8IG5ldyBMb2NhbFN0YXRlUHJvdmlkZXIob3B0cyk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBDVFJMIChjdXJzb3IpXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfX2N0cmxfY2hlY2soY3RybCkge1xuICAgICAgICBpZiAoY3RybCBpbnN0YW5jZW9mIENsb2NrUHJvdmlkZXJCYXNlKSB7XG4gICAgICAgICAgICByZXR1cm4gY3RybDtcbiAgICAgICAgfSBlbHNlIGlmIChjdHJsIGluc3RhbmNlb2YgQ3Vyc29yQmFzZSkge1xuICAgICAgICAgICAgcmV0dXJuIGN0cmw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwiY3RybFwiIG11c3QgYmUgY3Vyc29yICR7Y3RybH1gKVxuICAgICAgICB9XG4gICAgfVxuICAgIF9fY3RybF9oYW5kbGVfY2hhbmdlKHJlYXNvbikge1xuICAgICAgICB0aGlzLl9faGFuZGxlX2NoYW5nZShcImN0cmxcIiwgcmVhc29uKTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFNSQyAobGF5ZXIpXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfX3NyY19jaGVjayhzcmMpIHtcbiAgICAgICAgaWYgKHNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IExheWVyKHtzcmN9KTtcbiAgICAgICAgfSBlbHNlIGlmIChzcmMgaW5zdGFuY2VvZiBMYXllcikge1xuICAgICAgICAgICAgcmV0dXJuIHNyYztcbiAgICAgICAgfSBlbHNlICBpZiAoc3JjIGluc3RhbmNlb2YgTW90aW9uUHJvdmlkZXJCYXNlKSB7XG4gICAgICAgICAgICBzcmMgPSBuZXcgTW90aW9uU3RhdGVQcm92aWRlcihzcmMpO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBMYXllcih7c3JjfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwic3JjXCIgbXVzdCBiZSBMYXllciAke3NyY31gKTtcbiAgICAgICAgfVxuICAgIH0gICAgXG4gICAgX19zcmNfaGFuZGxlX2NoYW5nZShyZWFzb24pIHtcbiAgICAgICAgdGhpcy5fX2hhbmRsZV9jaGFuZ2UoXCJzcmNcIiwgcmVhc29uKTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIENBTExCQUNLXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfX2hhbmRsZV9jaGFuZ2Uob3JpZ2luLCBtc2cpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3RpZCk7XG4gICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5fcGlkKTtcbiAgICAgICAgaWYgKHRoaXMuc3JjICYmIHRoaXMuY3RybCkge1xuICAgICAgICAgICAgaWYgKG9yaWdpbiA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2NhY2hlID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuc3JjLmdldFF1ZXJ5T2JqZWN0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9yaWdpbiA9PSBcInNyY1wiIHx8IG9yaWdpbiA9PSBcImN0cmxcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlLmNsZWFyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIC8vIHRyaWdnZXIgY2hhbmdlIGV2ZW50IGZvciBjdXJzb3JcbiAgICAgICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHRoaXMucXVlcnkoKSk7XG4gICAgICAgICAgICAvLyBkZXRlY3QgZnV0dXJlIGNoYW5nZSBldmVudCAtIGlmIG5lZWRlZFxuICAgICAgICAgICAgdGhpcy5fX2RldGVjdF9mdXR1cmVfY2hhbmdlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBERVRFQ1QgRlVUVVJFIENIQU5HRVxuICAgICAqIFxuICAgICAqIFBST0JMRU06XG4gICAgICogXG4gICAgICogRHVyaW5nIHBsYXliYWNrIChjdXJzb3IuY3RybCBpcyBkeW5hbWljKSwgdGhlcmUgaXMgYSBuZWVkIHRvIFxuICAgICAqIGRldGVjdCB0aGUgcGFzc2luZyBmcm9tIG9uZSBzZWdtZW50IGludGVydmFsIG9mIHNyY1xuICAgICAqIHRvIHRoZSBuZXh0IC0gaWRlYWxseSBhdCBwcmVjaXNlbHkgdGhlIGNvcnJlY3QgdGltZVxuICAgICAqIFxuICAgICAqIG5lYXJieS5pdHYgKGRlcml2ZWQgZnJvbSBjdXJzb3Iuc3JjKSBnaXZlcyB0aGUgXG4gICAgICogaW50ZXJ2YWwgKGkpIHdlIGFyZSBjdXJyZW50bHkgaW4sIGkuZS4sIFxuICAgICAqIGNvbnRhaW5pbmcgdGhlIGN1cnJlbnQgb2Zmc2V0ICh2YWx1ZSBvZiBjdXJzb3IuY3RybCksIFxuICAgICAqIGFuZCAoaWkpIHdoZXJlIG5lYXJieS5jZW50ZXIgc3RheXMgY29uc3RhbnRcbiAgICAgKiBcbiAgICAgKiBUaGUgZXZlbnQgdGhhdCBuZWVkcyB0byBiZSBkZXRlY3RlZCBpcyB0aGVyZWZvcmUgdGhlXG4gICAgICogbW9tZW50IHdoZW4gd2UgbGVhdmUgdGhpcyBpbnRlcnZhbCwgdGhyb3VnaCBlaXRoZXJcbiAgICAgKiB0aGUgbG93IG9yIGhpZ2ggaW50ZXJ2YWwgZW5kcG9pbnRcbiAgICAgKiBcbiAgICAgKiBHT0FMOlxuICAgICAqIFxuICAgICAqIEF0IHRoaXMgbW9tZW50LCB3ZSBzaW1wbHkgbmVlZCB0byByZWV2YWx1YXRlIHRoZSBzdGF0ZSAocXVlcnkpIGFuZFxuICAgICAqIGVtaXQgYSBjaGFuZ2UgZXZlbnQgdG8gbm90aWZ5IG9ic2VydmVycy4gXG4gICAgICogXG4gICAgICogQVBQUk9BQ0hFUzpcbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbMF0gXG4gICAgICogVGhlIHRyaXZpYWwgc29sdXRpb24gaXMgdG8gZG8gbm90aGluZywgaW4gd2hpY2ggY2FzZVxuICAgICAqIG9ic2VydmVycyB3aWxsIHNpbXBseSBmaW5kIG91dCB0aGVtc2VsdmVzIGFjY29yZGluZyB0byB0aGVpciBcbiAgICAgKiBvd24gcG9sbCBmcmVxdWVuY3kuIFRoaXMgaXMgc3Vib3B0aW1hbCwgcGFydGljdWxhcmx5IGZvciBsb3cgZnJlcXVlbmN5IFxuICAgICAqIG9ic2VydmVycy4gSWYgdGhlcmUgaXMgYXQgbGVhc3Qgb25lIGhpZ2gtZnJlcXVlbmN5IHBvbGxlciwgXG4gICAgICogdGhpcyB3b3VsZCB0cmlnZ2VyIHRyaWdnZXIgdGhlIHN0YXRlIGNoYW5nZSwgY2F1c2luZyBhbGxcbiAgICAgKiBvYnNlcnZlcnMgdG8gYmUgbm90aWZpZWQuIFRoZSBwcm9ibGVtIHRob3VnaCwgaXMgaWYgbm8gb2JzZXJ2ZXJzXG4gICAgICogYXJlIGFjdGl2ZWx5IHBvbGxpbmcsIGJ1dCBvbmx5IGRlcGVuZGluZyBvbiBjaGFuZ2UgZXZlbnRzLlxuICAgICAqIFxuICAgICAqIEFwcHJvYWNoIFsxXSBcbiAgICAgKiBJbiBjYXNlcyB3aGVyZSB0aGUgY3RybCBpcyBkZXRlcm1pbmlzdGljLCBhIHRpbWVvdXRcbiAgICAgKiBjYW4gYmUgY2FsY3VsYXRlZC4gVGhpcyBpcyB0cml2aWFsIGlmIGN0cmwgaXMgYSBDbG9ja0N1cnNvciwgYW5kXG4gICAgICogaXQgaXMgZmFpcmx5IGVhc3kgaWYgdGhlIGN0cmwgaXMgQ3Vyc29yIHJlcHJlc2VudGluZyBtb3Rpb25cbiAgICAgKiBvciBsaW5lYXIgdHJhbnNpdGlvbi4gSG93ZXZlciwgY2FsY3VsYXRpb25zIGNhbiBiZWNvbWUgbW9yZVxuICAgICAqIGNvbXBsZXggaWYgbW90aW9uIHN1cHBvcnRzIGFjY2VsZXJhdGlvbiwgb3IgaWYgdHJhbnNpdGlvbnNcbiAgICAgKiBhcmUgc2V0IHVwIHdpdGggbm9uLWxpbmVhciBlYXNpbmcuXG4gICAgICogICBcbiAgICAgKiBOb3RlLCBob3dldmVyLCB0aGF0IHRoZXNlIGNhbGN1bGF0aW9ucyBhc3N1bWUgdGhhdCB0aGUgY3Vyc29yLmN0cmwgaXMgXG4gICAgICogYSBDbG9ja0N1cnNvciwgb3IgdGhhdCBjdXJzb3IuY3RybC5jdHJsIGlzIGEgQ2xvY2tDdXJzb3IuIFxuICAgICAqIEluIHByaW5jaXBsZSwgdGhvdWdoLCB0aGVyZSBjb3VsZCBiZSBhIHJlY3Vyc2l2ZSBjaGFpbiBvZiBjdXJzb3JzLFxuICAgICAqIChjdXJzb3IuY3RybC5jdHJsLi4uLmN0cmwpIG9mIHNvbWUgbGVuZ3RoLCB3aGVyZSBvbmx5IHRoZSBsYXN0IGlzIGEgXG4gICAgICogQ2xvY2tDdXJzb3IuIEluIG9yZGVyIHRvIGRvIGRldGVybWluaXN0aWMgY2FsY3VsYXRpb25zIGluIHRoZSBnZW5lcmFsXG4gICAgICogY2FzZSwgYWxsIGN1cnNvcnMgaW4gdGhlIGNoYWluIHdvdWxkIGhhdmUgdG8gYmUgbGltaXRlZCB0byBcbiAgICAgKiBkZXRlcm1pbmlzdGljIGxpbmVhciB0cmFuc2Zvcm1hdGlvbnMuXG4gICAgICogXG4gICAgICogQXBwcm9jaCBbMl0gXG4gICAgICogSXQgbWlnaHQgYWxzbyBiZSBwb3NzaWJsZSB0byBzYW1wbGUgZnV0dXJlIHZhbHVlcyBvZiBcbiAgICAgKiBjdXJzb3IuY3RybCB0byBzZWUgaWYgdGhlIHZhbHVlcyB2aW9sYXRlIHRoZSBuZWFyYnkuaXR2IGF0IHNvbWUgcG9pbnQuIFxuICAgICAqIFRoaXMgd291bGQgZXNzZW50aWFsbHkgYmUgdHJlYXRpbmcgY3RybCBhcyBhIGxheWVyIGFuZCBzYW1wbGluZyBcbiAgICAgKiBmdXR1cmUgdmFsdWVzLiBUaGlzIGFwcHJvY2ggd291bGQgd29yayBmb3IgYWxsIHR5cGVzLCBcbiAgICAgKiBidXQgdGhlcmUgaXMgbm8ga25vd2luZyBob3cgZmFyIGludG8gdGhlIGZ1dHVyZSBvbmUgXG4gICAgICogd291bGQgaGF2ZSB0byBzZWVrLiBIb3dldmVyLCBhZ2FpbiAtIGFzIGluIFsxXSB0aGUgYWJpbGl0eSB0byBzYW1wbGUgZnV0dXJlIHZhbHVlc1xuICAgICAqIGlzIHByZWRpY2F0ZWQgb24gY3Vyc29yLmN0cmwgYmVpbmcgYSBDbG9ja0N1cnNvci4gQWxzbywgdGhlcmUgXG4gICAgICogaXMgbm8gd2F5IG9mIGtub3dpbmcgaG93IGxvbmcgaW50byB0aGUgZnV0dXJlIHNhbXBsaW5nIHdvdWxkIGJlIG5lY2Vzc2FyeS5cbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbM10gXG4gICAgICogSW4gdGhlIGdlbmVyYWwgY2FzZSwgdGhlIG9ubHkgd2F5IHRvIHJlbGlhYmxleSBkZXRlY3QgdGhlIGV2ZW50IGlzIHRocm91Z2ggcmVwZWF0ZWRcbiAgICAgKiBwb2xsaW5nLiBBcHByb2FjaCBbM10gaXMgc2ltcGx5IHRoZSBpZGVhIHRoYXQgdGhpcyBwb2xsaW5nIGlzIHBlcmZvcm1lZFxuICAgICAqIGludGVybmFsbHkgYnkgdGhlIGN1cnNvciBpdHNlbGYsIGFzIGEgd2F5IG9mIHNlY3VyaW5nIGl0cyBvd24gY29uc2lzdGVudFxuICAgICAqIHN0YXRlLCBhbmQgZW5zdXJpbmcgdGhhdCBvYnNlcnZlciBnZXQgY2hhbmdlIGV2ZW50cyBpbiBhIHRpbWVseSBtYW5uZXIsIGV2ZW50XG4gICAgICogaWYgdGhleSBkbyBsb3ctZnJlcXVlbmN5IHBvbGxpbmcsIG9yIGRvIG5vdCBkbyBwb2xsaW5nIGF0IGFsbC4gXG4gICAgICogXG4gICAgICogU09MVVRJT046XG4gICAgICogQXMgdGhlcmUgaXMgbm8gcGVyZmVjdCBzb2x1dGlvbiBpbiB0aGUgZ2VuZXJhbCBjYXNlLCB3ZSBvcHBvcnR1bmlzdGljYWxseVxuICAgICAqIHVzZSBhcHByb2FjaCBbMV0gd2hlbiB0aGlzIGlzIHBvc3NpYmxlLiBJZiBub3QsIHdlIGFyZSBmYWxsaW5nIGJhY2sgb24gXG4gICAgICogYXBwcm9hY2ggWzNdXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIE5PIGV2ZW50IGRldGVjdGlvbiBpcyBuZWVkZWQgKE5PT1ApXG4gICAgICogKGkpIGN1cnNvci5jdHJsIGlzIG5vdCBkeW5hbWljXG4gICAgICogb3JcbiAgICAgKiAoaWkpIG5lYXJieS5pdHYgc3RyZXRjaGVzIGludG8gaW5maW5pdHkgaW4gYm90aCBkaXJlY3Rpb25zXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIGFwcHJvYWNoIFsxXSBjYW4gYmUgdXNlZFxuICAgICAqIFxuICAgICAqIChpKSBpZiBjdHJsIGlzIGEgQ2xvY2tDdXJzb3IgJiYgbmVhcmJ5Lml0di5oaWdoIDwgSW5maW5pdHlcbiAgICAgKiBvclxuICAgICAqIChpaSkgY3RybC5jdHJsIGlzIGEgQ2xvY2tDdXJzb3JcbiAgICAgKiAgICAgIChhKSBjdHJsLm5lYXJieS5jZW50ZXIgaGFzIGV4YWN0bHkgMSBpdGVtXG4gICAgICogICAgICAmJlxuICAgICAqICAgICAgKGIpIGN0cmwubmVhcmJ5LmNlbnRlclswXS50eXBlID09IChcIm1vdGlvblwiKSB8fCAoXCJ0cmFuc2l0aW9uXCIgJiYgZWFzaW5nPT1cImxpbmVhclwiKVxuICAgICAqICAgICAgJiZcbiAgICAgKiAgICAgIChjKSBjdHJsLm5lYXJieS5jZW50ZXJbMF0uZGF0YS52ZWxvY2l0eSAhPSAwLjBcbiAgICAgKiAgICAgICYmIFxuICAgICAqICAgICAgKGQpIGZ1dHVyZSBpbnRlcnNlY3RvbiBwb2ludCB3aXRoIGNhY2hlLm5lYXJieS5pdHYgXG4gICAgICogICAgICAgICAgaXMgbm90IC1JbmZpbml0eSBvciBJbmZpbml0eVxuICAgICAqIFxuICAgICAqIFRob3VnaCBpdCBzZWVtcyBjb21wbGV4LCBjb25kaXRpb25zIGZvciBbMV0gc2hvdWxkIGJlIG1ldCBmb3IgY29tbW9uIGNhc2VzIGludm9sdmluZ1xuICAgICAqIHBsYXliYWNrLiBBbHNvLCB1c2Ugb2YgdHJhbnNpdGlvbiBldGMgbWlnaHQgYmUgcmFyZS5cbiAgICAgKiBcbiAgICAgKi9cblxuICAgIF9fZGV0ZWN0X2Z1dHVyZV9jaGFuZ2UoKSB7XG5cbiAgICAgICAgLy8gY3RybCBcbiAgICAgICAgY29uc3QgY3RybF92ZWN0b3IgPSB0aGlzLl9nZXRfY3RybF9zdGF0ZSgpO1xuICAgICAgICBjb25zdCB7dmFsdWU6Y3VycmVudF9wb3MsIG9mZnNldDpjdXJyZW50X3RzfSA9IGN0cmxfdmVjdG9yO1xuXG4gICAgICAgIC8vIGN0cmwgbXVzdCBiZSBkeW5hbWljXG4gICAgICAgIGlmICghY3RybF92ZWN0b3IuZHluYW1pYykge1xuICAgICAgICAgICAgLy8gbm8gZnV0dXJlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2V0IG5lYXJieSBmcm9tIHNyYyAtIHVzZSB2YWx1ZSBmcm9tIGN0cmxcbiAgICAgICAgY29uc3Qgc3JjX25lYXJieSA9IHRoaXMuc3JjLmluZGV4Lm5lYXJieShjdXJyZW50X3Bvcyk7XG4gICAgICAgIGNvbnN0IFtsb3csIGhpZ2hdID0gc3JjX25lYXJieS5pdHYuc2xpY2UoMCwyKTtcblxuICAgICAgICAvLyBhcHByb2FjaCBbMV1cbiAgICAgICAgaWYgKHRoaXMuY3RybCBpbnN0YW5jZW9mIENsb2NrUHJvdmlkZXJCYXNlKSB7XG4gICAgICAgICAgICBpZiAoaXNGaW5pdGUoaGlnaCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9fc2V0X3RpbWVvdXQoaGlnaCwgY3VycmVudF9wb3MsIDEuMCwgY3VycmVudF90cyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbm8gZnV0dXJlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IFxuICAgICAgICBpZiAodGhpcy5jdHJsLmN0cmwgaW5zdGFuY2VvZiBDbG9ja1Byb3ZpZGVyQmFzZSkge1xuICAgICAgICAgICAgLyoqIFxuICAgICAgICAgICAgICogdGhpcy5jdHJsIFxuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAgKiBoYXMgbWFueSBwb3NzaWJsZSBiZWhhdmlvcnNcbiAgICAgICAgICAgICAqIHRoaXMuY3RybCBoYXMgYW4gaW5kZXggdXNlIHRoaXMgdG8gZmlndXJlIG91dCB3aGljaFxuICAgICAgICAgICAgICogYmVoYXZpb3VyIGlzIGN1cnJlbnQuXG4gICAgICAgICAgICAgKiBcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICAvLyB1c2UgdGhlIHNhbWUgb2Zmc2V0IHRoYXQgd2FzIHVzZWQgaW4gdGhlIGN0cmwucXVlcnlcbiAgICAgICAgICAgIGNvbnN0IGN0cmxfbmVhcmJ5ID0gdGhpcy5jdHJsLmluZGV4Lm5lYXJieShjdXJyZW50X3RzKTtcblxuICAgICAgICAgICAgaWYgKCFpc0Zpbml0ZShsb3cpICYmICFpc0Zpbml0ZShoaWdoKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vIGZ1dHVyZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY3RybF9uZWFyYnkuY2VudGVyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY3RybF9pdGVtID0gY3RybF9uZWFyYnkuY2VudGVyWzBdO1xuICAgICAgICAgICAgICAgIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHt2ZWxvY2l0eSwgYWNjZWxlcmF0aW9uPTAuMH0gPSBjdHJsX2l0ZW0uZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjY2VsZXJhdGlvbiA9PSAwLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdGFyZ2V0X3BvcyA9ICh2ZWxvY2l0eSA+IDApID8gaGlnaCA6IGxvdztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0Zpbml0ZSh0YXJnZXRfcG9zKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjsgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBubyBmdXR1cmUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gYWNjZWxlcmF0aW9uIC0gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7djA6cDAsIHYxOnAxLCB0MCwgdDEsIGVhc2luZz1cImxpbmVhclwifSA9IGN0cmxfaXRlbS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZWFzaW5nID09IFwibGluZWFyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2ZWxvY2l0eSA9IChwMS1wMCkvKHQxLXQwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRfcG9zID0gKHZlbG9jaXR5ID4gMCkgPyBNYXRoLm1pbihoaWdoLCBwMSkgOiBNYXRoLm1heChsb3csIHAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBvdGhlciBlYXNpbmcgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gb3RoZXIgdHlwZSAoaW50ZXJwb2xhdGlvbikgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIG1vcmUgdGhhbiBvbmUgc2VnbWVudCAtIHBvc3NpYmxlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0IC0gYXBwcm9hY2ggWzNdXG4gICAgICAgIHRoaXMuX19zZXRfcG9sbGluZyhzcmNfbmVhcmJ5Lml0dik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc2V0IHRpbWVvdXRcbiAgICAgKiAtIHByb3RlY3RzIGFnYWluc3QgdG9vIGVhcmx5IGNhbGxiYWNrcyBieSByZXNjaGVkdWxpbmdcbiAgICAgKiB0aW1lb3V0IGlmIG5lY2Nlc3NhcnkuXG4gICAgICogLSBhZGRzIGEgbWlsbGlzZWNvbmQgdG8gb3JpZ2luYWwgdGltZW91dCB0byBhdm9pZFxuICAgICAqIGZyZXF1ZW50IHJlc2NoZWR1bGluZyBcbiAgICAgKi9cblxuICAgIF9fc2V0X3RpbWVvdXQodGFyZ2V0X3BvcywgY3VycmVudF9wb3MsIHZlbG9jaXR5LCBjdXJyZW50X3RzKSB7XG4gICAgICAgIGNvbnN0IGRlbHRhX3NlYyA9ICh0YXJnZXRfcG9zIC0gY3VycmVudF9wb3MpIC8gdmVsb2NpdHk7XG4gICAgICAgIGNvbnN0IHRhcmdldF90cyA9IGN1cnJlbnRfdHMgKyBkZWx0YV9zZWM7XG4gICAgICAgIHRoaXMuX3RpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV90aW1lb3V0KHRhcmdldF90cyk7XG4gICAgICAgIH0sIGRlbHRhX3NlYyoxMDAwICsgMSk7XG4gICAgfVxuXG4gICAgX19oYW5kbGVfdGltZW91dCh0YXJnZXRfdHMpIHtcbiAgICAgICAgY29uc3QgdHMgPSB0aGlzLl9nZXRfY3RybF9zdGF0ZSgpLm9mZnNldDtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nX3NlYyA9IHRhcmdldF90cyAtIHRzOyBcbiAgICAgICAgaWYgKHJlbWFpbmluZ19zZWMgPD0gMCkge1xuICAgICAgICAgICAgLy8gZG9uZVxuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV9jaGFuZ2UoXCJ0aW1lb3V0XCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcmVzY2hlZHVsZSB0aW1lb3V0XG4gICAgICAgICAgICB0aGlzLl90aWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9faGFuZGxlX3RpbWVvdXQodGFyZ2V0X3RzKVxuICAgICAgICAgICAgfSwgcmVtYWluaW5nX3NlYyoxMDAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNldCBwb2xsaW5nXG4gICAgICovXG5cbiAgICBfX3NldF9wb2xsaW5nKGl0dikge1xuICAgICAgICB0aGlzLl9waWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9faGFuZGxlX3BvbGwoaXR2KTtcbiAgICAgICAgfSwgMTAwKTtcbiAgICB9XG5cbiAgICBfX2hhbmRsZV9wb2xsKGl0dikge1xuICAgICAgICBsZXQgb2Zmc2V0ID0gdGhpcy5xdWVyeSgpLnZhbHVlO1xuICAgICAgICBpZiAoIWludGVydmFsLmNvdmVyc19wb2ludChpdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgIHRoaXMuX19oYW5kbGVfY2hhbmdlKFwidGltZW91dFwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfZ2V0X2N0cmxfc3RhdGUgKCkge1xuICAgICAgICBpZiAodGhpcy5jdHJsIGluc3RhbmNlb2YgQ2xvY2tQcm92aWRlckJhc2UpIHtcbiAgICAgICAgICAgIGxldCB0cyA9IHRoaXMuY3RybC5ub3coKTtcbiAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dHMsIGR5bmFtaWM6dHJ1ZSwgb2Zmc2V0OnRzfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBzdGF0ZSA9IHRoaXMuY3RybC5xdWVyeSgpO1xuICAgICAgICAgICAgLy8gVE9ETyAtIHByb3RlY3QgYWdhaW5zdCBub24tZmxvYXQgdmFsdWVzXG4gICAgICAgICAgICBpZiAodHlwZW9mIHN0YXRlLnZhbHVlICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3RybCBzdGF0ZSBtdXN0IGJlIG51bWJlciAke3N0YXRlLnZhbHVlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcXVlcnkgKCkge1xuICAgICAgICBjb25zdCBvZmZzZXQgPSB0aGlzLl9nZXRfY3RybF9zdGF0ZSgpLnZhbHVlOyAgXG4gICAgICAgIHJldHVybiB0aGlzLl9jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIGdldCB2YWx1ZSAoKSB7cmV0dXJuIHRoaXMucXVlcnkoKS52YWx1ZX07XG4gICAgZ2V0IGluZGV4ICgpIHtyZXR1cm4gdGhpcy5zcmMuaW5kZXh9O1xuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBVUERBVEUgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBhc3NpZ24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzLnNyYy5zcmMuc3JjKS5hc3NpZ24odmFsdWUpO1xuICAgIH1cbiAgICBtb3ZlICh7cG9zaXRpb24sIHZlbG9jaXR5fSkge1xuICAgICAgICBsZXQge3ZhbHVlLCBvZmZzZXQ6dGltZXN0YW1wfSA9IHRoaXMucXVlcnkoKTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3Vyc29yIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7dmFsdWV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcG9zaXRpb24gPSAocG9zaXRpb24gIT0gdW5kZWZpbmVkKSA/IHBvc2l0aW9uIDogdmFsdWU7XG4gICAgICAgIHZlbG9jaXR5ID0gKHZlbG9jaXR5ICE9IHVuZGVmaW5lZCkgPyB2ZWxvY2l0eTogMDtcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzLnNyYy5zcmMuc3JjKS5tb3ZlKHtwb3NpdGlvbiwgdmVsb2NpdHksIHRpbWVzdGFtcH0pO1xuICAgIH1cbiAgICB0cmFuc2l0aW9uICh7dGFyZ2V0LCBkdXJhdGlvbiwgZWFzaW5nfSkge1xuICAgICAgICBsZXQge3ZhbHVlOnYwLCBvZmZzZXQ6dDB9ID0gdGhpcy5xdWVyeSgpO1xuICAgICAgICBpZiAodHlwZW9mIHYwICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3Igc3RhdGUgbXVzdCBiZSBudW1iZXIgJHt2MH1gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY21kKHRoaXMuc3JjLnNyYy5zcmMpLnRyYW5zaXRpb24odjAsIHRhcmdldCwgdDAsIHQwICsgZHVyYXRpb24sIGVhc2luZyk7XG4gICAgfVxuICAgIGludGVycG9sYXRlICh7dHVwbGVzLCBkdXJhdGlvbn0pIHtcbiAgICAgICAgbGV0IHQwID0gdGhpcy5xdWVyeSgpLm9mZnNldDtcbiAgICAgICAgLy8gYXNzdW1pbmcgdGltc3RhbXBzIGFyZSBpbiByYW5nZSBbMCwxXVxuICAgICAgICAvLyBzY2FsZSB0aW1lc3RhbXBzIHRvIGR1cmF0aW9uXG4gICAgICAgIHR1cGxlcyA9IHR1cGxlcy5tYXAoKFt2LHRdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3YsIHQwICsgdCpkdXJhdGlvbl07XG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiBjbWQodGhpcy5zcmMuc3JjLnNyYykuaW50ZXJwb2xhdGUodHVwbGVzKTtcbiAgICB9XG5cbn1cbnNvdXJjZXByb3AuYWRkVG9Qcm90b3R5cGUoQ3Vyc29yLnByb3RvdHlwZSwgXCJzcmNcIiwge211dGFibGU6dHJ1ZX0pO1xuc291cmNlcHJvcC5hZGRUb1Byb3RvdHlwZShDdXJzb3IucHJvdG90eXBlLCBcImN0cmxcIiwge211dGFibGU6dHJ1ZX0pO1xuXG4iLCJpbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTkVBUkJZIElOREVYXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogQWJzdHJhY3Qgc3VwZXJjbGFzcyBmb3IgTmVhcmJ5SW5kZXhlLlxuICogXG4gKiBTdXBlcmNsYXNzIHVzZWQgdG8gY2hlY2sgdGhhdCBhIGNsYXNzIGltcGxlbWVudHMgdGhlIG5lYXJieSgpIG1ldGhvZCwgXG4gKiBhbmQgcHJvdmlkZSBzb21lIGNvbnZlbmllbmNlIG1ldGhvZHMuXG4gKiBcbiAqIE5FQVJCWSBJTkRFWFxuICogXG4gKiBOZWFyYnlJbmRleCBwcm92aWRlcyBpbmRleGluZyBzdXBwb3J0IG9mIGVmZmVjdGl2ZWx5bG9va2luZyB1cCBJVEVNUyBieSBvZmZzZXQsIFxuICogZ2l2ZW4gdGhhdFxuICogKGkpIGVhY2ggZW50cml5IGlzIGFzc29jaWF0ZWQgd2l0aCBhbiBpbnRlcnZhbCBhbmQsXG4gKiAoaWkpIGVudHJpZXMgYXJlIG5vbi1vdmVybGFwcGluZy5cbiAqIEVhY2ggSVRFTSBtdXN0IGJlIGFzc29jaWF0ZWQgd2l0aCBhbiBpbnRlcnZhbCBvbiB0aGUgdGltZWxpbmUgXG4gKiBcbiAqIE5FQVJCWVxuICogVGhlIG5lYXJieSBtZXRob2QgcmV0dXJucyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbmVpZ2hib3Job29kIGFyb3VuZCBlbmRwb2ludC4gXG4gKiBcbiAqIFByaW1hcnkgdXNlIGlzIGZvciBpdGVyYXRpb24gXG4gKiBcbiAqIFJldHVybnMge1xuICogICAgICBjZW50ZXI6IGxpc3Qgb2YgSVRFTVMgY292ZXJpbmcgZW5kcG9pbnQsXG4gKiAgICAgIGl0djogaW50ZXJ2YWwgd2hlcmUgbmVhcmJ5IHJldHVybnMgaWRlbnRpY2FsIHtjZW50ZXJ9XG4gKiAgICAgIGxlZnQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgbGVmdCBcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGhpZ2gtZW5kcG9pbnQgb3IgdW5kZWZpbmVkXG4gKiAgICAgIHJpZ2h0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0XG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBsb3ctZW5kcG9pbnQgb3IgdW5kZWZpbmVkICAgICAgICAgXG4gKiAgICAgIHByZXY6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgbGVmdCBcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQgJiYgbm9uLWVtcHR5IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBoaWdoLWVuZHBvaW50IG9yIHVuZGVmaW5lZCBpZiBubyBtb3JlIGludGVydmFscyB0byB0aGUgbGVmdFxuICogICAgICBuZXh0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0XG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50ICYmIG5vbi1lbXB0eSB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgbG93LWVuZHBvaW50IG9yIHVuZGVmaW5lZCBpZiBubyBtb3JlIGludGVydmFscyB0byB0aGUgcmlnaHRcbiAqIH1cbiAqIFxuICogXG4gKiBUaGUgbmVhcmJ5IHN0YXRlIGlzIHdlbGwtZGVmaW5lZCBmb3IgZXZlcnkgdGltZWxpbmUgcG9zaXRpb24uXG4gKiBcbiAqIFxuICogTk9URSBsZWZ0L3JpZ2h0IGFuZCBwcmV2L25leHQgYXJlIG1vc3RseSB0aGUgc2FtZS4gVGhlIG9ubHkgZGlmZmVyZW5jZSBpcyBcbiAqIHRoYXQgcHJldi9uZXh0IHdpbGwgc2tpcCBvdmVyIHJlZ2lvbnMgd2hlcmUgdGhlcmUgYXJlIG5vIGludGVydmFscy4gVGhpc1xuICogZW5zdXJlcyBwcmFjdGljYWwgaXRlcmF0aW9uIG9mIGl0ZW1zIGFzIHByZXYvbmV4dCB3aWxsIG9ubHkgYmUgdW5kZWZpbmVkICBcbiAqIGF0IHRoZSBlbmQgb2YgaXRlcmF0aW9uLlxuICogXG4gKiBJTlRFUlZBTFNcbiAqIFxuICogW2xvdywgaGlnaCwgbG93SW5jbHVzaXZlLCBoaWdoSW5jbHVzaXZlXVxuICogXG4gKiBUaGlzIHJlcHJlc2VudGF0aW9uIGVuc3VyZXMgdGhhdCB0aGUgaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBvcmRlcmVkIGFuZCBhbGxvd3NcbiAqIGludGVydmFscyB0byBiZSBleGNsdXNpdmUgb3IgaW5jbHVzaXZlLCB5ZXQgY292ZXIgdGhlIGVudGlyZSByZWFsIGxpbmUgXG4gKiBcbiAqIFthLGJdLCAoYSxiKSwgW2EsYiksIFthLCBiKSBhcmUgYWxsIHZhbGlkIGludGVydmFsc1xuICogXG4gKiBcbiAqIElOVEVSVkFMIEVORFBPSU5UU1xuICogXG4gKiBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIGRlZmluZWQgYnkgW3ZhbHVlLCBzaWduXSwgZm9yIGV4YW1wbGVcbiAqIFxuICogNCkgLT4gWzQsLTFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIGxlZnQgb2YgNFxuICogWzQsIDQsIDRdIC0+IFs0LCAwXSAtIGVuZHBvaW50IGlzIGF0IDQgXG4gKiAoNCAtPiBbNCwgMV0gLSBlbmRwb2ludCBpcyBvbiB0aGUgcmlnaHQgb2YgNClcbiAqIFxuICogLyAqL1xuXG4gZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4QmFzZSB7XG5cblxuICAgIC8qIFxuICAgICAgICBOZWFyYnkgbWV0aG9kXG4gICAgKi9cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cblxuICAgIC8qXG4gICAgICAgIHJldHVybiBsb3cgcG9pbnQgb2YgbGVmdG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGZpcnN0KCkge1xuICAgICAgICBsZXQge2NlbnRlciwgcmlnaHR9ID0gdGhpcy5uZWFyYnkoWy1JbmZpbml0eSwgMF0pO1xuICAgICAgICByZXR1cm4gKGNlbnRlci5sZW5ndGggPiAwKSA/IFstSW5maW5pdHksIDBdIDogcmlnaHQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGhpZ2ggcG9pbnQgb2YgcmlnaHRtb3N0IGVudHJ5XG4gICAgKi9cbiAgICBsYXN0KCkge1xuICAgICAgICBsZXQge2xlZnQsIGNlbnRlcn0gPSB0aGlzLm5lYXJieShbSW5maW5pdHksIDBdKTtcbiAgICAgICAgcmV0dXJuIChjZW50ZXIubGVuZ3RoID4gMCkgPyBbSW5maW5pdHksIDBdIDogbGVmdFxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIExpc3QgaXRlbXMgb2YgTmVhcmJ5SW5kZXggKG9yZGVyIGxlZnQgdG8gcmlnaHQpXG4gICAgICAgIGludGVydmFsIGRlZmluZXMgW3N0YXJ0LCBlbmRdIG9mZnNldCBvbiB0aGUgdGltZWxpbmUuXG4gICAgICAgIFJldHVybnMgbGlzdCBvZiBpdGVtLWxpc3RzLlxuICAgICAgICBvcHRpb25zXG4gICAgICAgIC0gc3RhcnRcbiAgICAgICAgLSBzdG9wXG4gICAgKi9cbiAgICBsaXN0KG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtzdGFydD0tSW5maW5pdHksIHN0b3A9SW5maW5pdHl9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHN0YXJ0ID4gc3RvcCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIChcInN0b3AgbXVzdCBiZSBsYXJnZXIgdGhhbiBzdGFydFwiLCBzdGFydCwgc3RvcClcbiAgICAgICAgfVxuICAgICAgICBzdGFydCA9IFtzdGFydCwgMF07XG4gICAgICAgIHN0b3AgPSBbc3RvcCwgMF07XG4gICAgICAgIGxldCBjdXJyZW50ID0gc3RhcnQ7XG4gICAgICAgIGxldCBuZWFyYnk7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICAgICAgbGV0IGxpbWl0ID0gNVxuICAgICAgICB3aGlsZSAobGltaXQpIHtcbiAgICAgICAgICAgIGlmIChlbmRwb2ludC5ndChjdXJyZW50LCBzdG9wKSkge1xuICAgICAgICAgICAgICAgIC8vIGV4aGF1c3RlZFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmVhcmJ5ID0gdGhpcy5uZWFyYnkoY3VycmVudCk7XG4gICAgICAgICAgICBpZiAobmVhcmJ5LmNlbnRlci5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgICAgIC8vIGNlbnRlciBlbXB0eSAodHlwaWNhbGx5IGZpcnN0IGl0ZXJhdGlvbilcbiAgICAgICAgICAgICAgICBpZiAobmVhcmJ5LnJpZ2h0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyByaWdodCB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gbm8gZW50cmllcyAtIGFscmVhZHkgZXhoYXVzdGVkXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IGRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IG9mZnNldFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gbmVhcmJ5LnJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKG5lYXJieS5jZW50ZXIpO1xuICAgICAgICAgICAgICAgIGlmIChuZWFyYnkucmlnaHQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBsYXN0IGVudHJ5IC0gbWFyayBpdGVyYWN0b3IgZXhoYXVzdGVkXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IGRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IG9mZnNldFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gbmVhcmJ5LnJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxpbWl0LS07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxufVxuXG5cblxuXG5cbiIsImltcG9ydCB7IGVuZHBvaW50LCBpbnRlcnZhbCB9IGZyb20gXCIuLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuLi9uZWFyYnlpbmRleC5qc1wiO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tIFwiLi4vbmV3bGF5ZXIuanNcIlxuXG5cbi8qKlxuICogUmV0dXJucyBhIExheWVyIHJlcHJlc2VudGluZyBhIGxheWVyXG4gKiByZXByZXNlbnRpbmcgdGhlIG1lcmdpbmcgb2Ygc291cmNlcy5cbiAqL1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZSAoc291cmNlcywgdmFsdWVGdW5jKSB7XG5cbiAgICBjb25zdCBpbmRleCA9IG5ldyBNZXJnZUluZGV4KHNvdXJjZXMpO1xuXG4gICAgLy8gY3JlYXRlIGxheWVyXG4gICAgcmV0dXJuIG5ldyBMYXllcih7aW5kZXgsIHZhbHVlRnVuY30pO1xufVxuXG5cblxuXG5cblxuZnVuY3Rpb24gY21wX2FzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAxLCBwMilcbn1cblxuZnVuY3Rpb24gY21wX2Rlc2NlbmRpbmcocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmNtcChwMiwgcDEpXG59XG5cbi8qKlxuICogTWVyZ2luZyBpbmRleGVzIGZyb20gbXVsdGlwbGUgc291cmNlcyBpbnRvIGEgc2luZ2xlIGluZGV4LlxuICogXG4gKiBBIHNvdXJjZSBpcyBhbiBvYmplY3Qgd2l0aCBhbiBpbmRleC5cbiAqIC0gbGF5ZXJcbiAqIC0gZGF0YXNvdXJjZVxuICogXG4gKiBUaGUgbWVyZ2VkIGluZGV4IGdpdmVzIGEgdGVtcG9yYWwgc3RydWN0dXJlIGZvciB0aGVcbiAqIGNvbGxlY3Rpb24gb2Ygc291cmNlcywgY29tcHV0aW5nIGEgbGlzdCBvZlxuICogc291cmNlcyB3aGljaCBhcmUgZGVmaW5lZCBhdCBhIGdpdmVuIG9mZnNldFxuICogXG4gKiBuZWFyYnkob2Zmc2V0KS5jZW50ZXIgaXMgYSBsaXN0IG9mIGl0ZW1zXG4gKiBbe2l0diwgc3JjfV1cbiAqIFxuICogSW1wbGVtZW50YWlvbiBpcyBzdGF0ZWxlc3MuXG4gKi9cblxuZXhwb3J0IGNsYXNzIE1lcmdlSW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Ioc291cmNlcykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9zb3VyY2VzID0gc291cmNlcztcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIC8vIGFjY3VtdWxhdGUgbmVhcmJ5IGZyb20gYWxsIHNvdXJjZXNcbiAgICAgICAgY29uc3QgcHJldl9saXN0ID0gW10sIGNlbnRlcl9saXN0ID0gW10sIG5leHRfbGlzdCA9IFtdO1xuICAgICAgICBmb3IgKGxldCBzcmMgb2YgdGhpcy5fc291cmNlcykge1xuICAgICAgICAgICAgbGV0IHtpdHYsIHByZXYsIGNlbnRlciwgbmV4dH0gPSBzcmMuaW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgICAgICBpZiAocHJldiAhPSB1bmRlZmluZWQpIHByZXZfbGlzdC5wdXNoKHByZXYpOyAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKG5leHQgIT0gdW5kZWZpbmVkKSBuZXh0X2xpc3QucHVzaChuZXh0KTtcbiAgICAgICAgICAgIGlmIChjZW50ZXIgPiAwKSB7XG4gICAgICAgICAgICAgICAgY2VudGVyX2xpc3QucHVzaCh7aXR2LCBzcmN9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gZmluZCBjbG9zZXN0IGVuZHBvaW50IHRvIHRoZSByaWdodCAobm90IGluIGNlbnRlcilcbiAgICAgICAgbmV4dF9saXN0LnNvcnQoY21wX2FzY2VuZGluZyk7XG4gICAgICAgIGNvbnN0IG1pbl9uZXh0X2xvdyA9IG5leHRfbGlzdFswXSB8fCBbSW5maW5pdHksIDBdO1xuXG4gICAgICAgIC8vIGZpbmQgY2xvc2VzdCBlbmRwb2ludCB0byB0aGUgbGVmdCAobm90IGluIGNlbnRlcilcbiAgICAgICAgcHJldl9saXN0LnNvcnQoY21wX2Rlc2NlbmRpbmcpO1xuICAgICAgICBjb25zdCBtYXhfcHJldl9oaWdoID0gcHJldl9saXN0WzBdIHx8IFstSW5maW5pdHksIDBdO1xuXG4gICAgICAgIC8vIG5lYXJieVxuICAgICAgICBsZXQgbG93LCBoaWdoOyBcbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgICAgY2VudGVyOiBjZW50ZXJfbGlzdCwgXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2VudGVyX2xpc3QubGVuZ3RoID09IDApIHtcblxuICAgICAgICAgICAgLy8gZW1wdHkgY2VudGVyXG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSBtaW5fbmV4dF9sb3c7ICAgICAgIFxuICAgICAgICAgICAgcmVzdWx0Lm5leHQgPSBtaW5fbmV4dF9sb3c7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IG1heF9wcmV2X2hpZ2g7XG4gICAgICAgICAgICByZXN1bHQucHJldiA9IG1heF9wcmV2X2hpZ2g7XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gbm9uLWVtcHR5IGNlbnRlclxuXG4gICAgICAgICAgICAvLyBjZW50ZXIgaGlnaFxuICAgICAgICAgICAgbGV0IGNlbnRlcl9oaWdoX2xpc3QgPSBjZW50ZXJfbGlzdC5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMV07XG4gICAgICAgICAgICB9KS5zb3J0KGNtcF9hc2NlbmRpbmcpO1xuICAgICAgICAgICAgbGV0IG1pbl9jZW50ZXJfaGlnaCA9IGNlbnRlcl9oaWdoX2xpc3RbMF07XG4gICAgICAgICAgICBsZXQgbWF4X2NlbnRlcl9oaWdoID0gY2VudGVyX2hpZ2hfbGlzdC5zbGljZSgtMSlbMF07XG4gICAgICAgICAgICBsZXQgbXVsdGlwbGVfY2VudGVyX2hpZ2ggPSAhZW5kcG9pbnQuZXEobWluX2NlbnRlcl9oaWdoLCBtYXhfY2VudGVyX2hpZ2gpXG5cbiAgICAgICAgICAgIC8vIGNlbnRlciBsb3dcbiAgICAgICAgICAgIGxldCBjZW50ZXJfbG93X2xpc3QgPSBjZW50ZXJfbGlzdC5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMF1cbiAgICAgICAgICAgIH0pLnNvcnQoY21wX2Rlc2NlbmRpbmcpO1xuICAgICAgICAgICAgbGV0IG1heF9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0WzBdO1xuICAgICAgICAgICAgbGV0IG1pbl9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0LnNsaWNlKC0xKVswXTtcbiAgICAgICAgICAgIGxldCBtdWx0aXBsZV9jZW50ZXJfbG93ID0gIWVuZHBvaW50LmVxKG1heF9jZW50ZXJfbG93LCBtaW5fY2VudGVyX2xvdylcblxuICAgICAgICAgICAgLy8gbmV4dC9yaWdodFxuICAgICAgICAgICAgaWYgKGVuZHBvaW50LmxlKG1pbl9uZXh0X2xvdywgbWluX2NlbnRlcl9oaWdoKSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IG1pbl9uZXh0X2xvdztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gZW5kcG9pbnQuZmxpcChtaW5fY2VudGVyX2hpZ2gsIFwibG93XCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQubmV4dCA9IChtdWx0aXBsZV9jZW50ZXJfaGlnaCkgPyByZXN1bHQucmlnaHQgOiBtaW5fbmV4dF9sb3c7XG5cbiAgICAgICAgICAgIC8vIHByZXYvbGVmdFxuICAgICAgICAgICAgaWYgKGVuZHBvaW50LmdlKG1heF9wcmV2X2hpZ2gsIG1heF9jZW50ZXJfbG93KSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gbWF4X3ByZXZfaGlnaDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSBlbmRwb2ludC5mbGlwKG1heF9jZW50ZXJfbG93LCBcImhpZ2hcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQucHJldiA9IChtdWx0aXBsZV9jZW50ZXJfbG93KSA/IHJlc3VsdC5sZWZ0IDogbWF4X3ByZXZfaGlnaDsgICAgXG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnRlcnZhbCBmcm9tIGxlZnQvcmlnaHRcbiAgICAgICAgbG93ID0gZW5kcG9pbnQuZmxpcChyZXN1bHQubGVmdCwgXCJsb3dcIik7XG4gICAgICAgIGhpZ2ggPSBlbmRwb2ludC5mbGlwKHJlc3VsdC5yaWdodCwgXCJoaWdoXCIpO1xuICAgICAgICByZXN1bHQuaXR2ID0gaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKTtcblxuICAgICAgICAvLyBzd2l0Y2ggdG8gdW5kZWZpbmVkXG4gICAgICAgIGlmIChyZXN1bHQucHJldlswXSA9PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJlc3VsdC5wcmV2ID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQubGVmdFswXSA9PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQubmV4dFswXSA9PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgcmVzdWx0Lm5leHQgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdC5yaWdodFswXSA9PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59O1xuXG4iLCJpbXBvcnQgeyBpbnRlcnZhbCwgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuL25lYXJieWluZGV4LmpzXCI7XG5cbi8qKlxuICogXG4gKiBOZWFyYnkgSW5kZXggU2ltcGxlXG4gKiBcbiAqIC0gaXRlbXMgYXJlIGFzc3VtZWQgdG8gYmUgbm9uLW92ZXJsYXBwaW5nIG9uIHRoZSB0aW1lbGluZSwgXG4gKiAtIGltcGx5aW5nIHRoYXQgbmVhcmJ5LmNlbnRlciB3aWxsIGJlIGEgbGlzdCBvZiBhdCBtb3N0IG9uZSBJVEVNLiBcbiAqIC0gZXhjZXB0aW9uIHdpbGwgYmUgcmFpc2VkIGlmIG92ZXJsYXBwaW5nIElURU1TIGFyZSBmb3VuZFxuICogLSBJVEVNUyBpcyBhc3N1bWJlZCB0byBiZSBpbW11dGFibGUgYXJyYXkgLSBjaGFuZ2UgSVRFTVMgYnkgcmVwbGFjaW5nIGFycmF5XG4gKiBcbiAqICBcbiAqL1xuXG5cbi8vIGdldCBpbnRlcnZhbCBsb3cgcG9pbnRcbmZ1bmN0aW9uIGdldF9sb3dfdmFsdWUoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLml0dlswXTtcbn1cblxuLy8gZ2V0IGludGVydmFsIGxvdyBlbmRwb2ludFxuZnVuY3Rpb24gZ2V0X2xvd19lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzBdXG59XG5cbi8vIGdldCBpbnRlcnZhbCBoaWdoIGVuZHBvaW50XG5mdW5jdGlvbiBnZXRfaGlnaF9lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzFdXG59XG5cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4U2ltcGxlIGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKHNyYykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9zcmMgPSBzcmM7XG4gICAgfVxuXG4gICAgZ2V0IHNyYyAoKSB7cmV0dXJuIHRoaXMuX3NyYzt9XG5cbiAgICAvKlxuICAgICAgICBuZWFyYnkgYnkgb2Zmc2V0XG4gICAgICAgIFxuICAgICAgICByZXR1cm5zIHtsZWZ0LCBjZW50ZXIsIHJpZ2h0fVxuXG4gICAgICAgIGJpbmFyeSBzZWFyY2ggYmFzZWQgb24gb2Zmc2V0XG4gICAgICAgIDEpIGZvdW5kLCBpZHhcbiAgICAgICAgICAgIG9mZnNldCBtYXRjaGVzIHZhbHVlIG9mIGludGVydmFsLmxvdyBvZiBhbiBpdGVtXG4gICAgICAgICAgICBpZHggZ2l2ZXMgdGhlIGluZGV4IG9mIHRoaXMgaXRlbSBpbiB0aGUgYXJyYXlcbiAgICAgICAgMikgbm90IGZvdW5kLCBpZHhcbiAgICAgICAgICAgIG9mZnNldCBpcyBlaXRoZXIgY292ZXJlZCBieSBpdGVtIGF0IChpZHgtMSksXG4gICAgICAgICAgICBvciBpdCBpcyBub3QgPT4gYmV0d2VlbiBlbnRyaWVzXG4gICAgICAgICAgICBpbiB0aGlzIGNhc2UgLSBpZHggZ2l2ZXMgdGhlIGluZGV4IHdoZXJlIGFuIGl0ZW1cbiAgICAgICAgICAgIHNob3VsZCBiZSBpbnNlcnRlZCAtIGlmIGl0IGhhZCBsb3cgPT0gb2Zmc2V0XG4gICAgKi9cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgb2Zmc2V0ID0gW29mZnNldCwgMF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG9mZnNldCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVuZHBvaW50IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgICAgY2VudGVyOiBbXSxcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgbGVmdDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgcmlnaHQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHByZXY6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIG5leHQ6IHVuZGVmaW5lZFxuICAgICAgICB9O1xuICAgICAgICBsZXQgaXRlbXMgPSB0aGlzLl9zcmMuZ2V0X2l0ZW1zKCk7XG4gICAgICAgIGxldCBpbmRleGVzLCBpdGVtO1xuICAgICAgICBjb25zdCBzaXplID0gaXRlbXMubGVuZ3RoO1xuICAgICAgICBpZiAoc2l6ZSA9PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0OyBcbiAgICAgICAgfVxuICAgICAgICBsZXQgW2ZvdW5kLCBpZHhdID0gZmluZF9pbmRleChvZmZzZXRbMF0sIGl0ZW1zLCBnZXRfbG93X3ZhbHVlKTtcbiAgICAgICAgaWYgKGZvdW5kKSB7XG4gICAgICAgICAgICAvLyBzZWFyY2ggb2Zmc2V0IG1hdGNoZXMgaXRlbSBsb3cgZXhhY3RseVxuICAgICAgICAgICAgLy8gY2hlY2sgdGhhdCBpdCBpbmRlZWQgY292ZXJlZCBieSBpdGVtIGludGVydmFsXG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4XVxuICAgICAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19lbmRwb2ludChpdGVtLml0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgIGluZGV4ZXMgPSB7bGVmdDppZHgtMSwgY2VudGVyOmlkeCwgcmlnaHQ6aWR4KzF9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChpbmRleGVzID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gY2hlY2sgcHJldiBpdGVtXG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4LTFdO1xuICAgICAgICAgICAgaWYgKGl0ZW0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgaWYgc2VhcmNoIG9mZnNldCBpcyBjb3ZlcmVkIGJ5IGl0ZW0gaW50ZXJ2YWxcbiAgICAgICAgICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KGl0ZW0uaXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ZXMgPSB7bGVmdDppZHgtMiwgY2VudGVyOmlkeC0xLCByaWdodDppZHh9O1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cdFxuICAgICAgICBpZiAoaW5kZXhlcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIHByZXYgaXRlbSBlaXRoZXIgZG9lcyBub3QgZXhpc3Qgb3IgaXMgbm90IHJlbGV2YW50XG4gICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTEsIGNlbnRlcjotMSwgcmlnaHQ6aWR4fTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNlbnRlclxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLmNlbnRlciAmJiBpbmRleGVzLmNlbnRlciA8IHNpemUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5jZW50ZXIgPSAgW2l0ZW1zW2luZGV4ZXMuY2VudGVyXV07XG4gICAgICAgIH1cbiAgICAgICAgLy8gcHJldi9uZXh0XG4gICAgICAgIGlmICgwIDw9IGluZGV4ZXMubGVmdCAmJiBpbmRleGVzLmxlZnQgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQucHJldiA9ICBnZXRfaGlnaF9lbmRwb2ludChpdGVtc1tpbmRleGVzLmxlZnRdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLnJpZ2h0ICYmIGluZGV4ZXMucmlnaHQgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQubmV4dCA9ICBnZXRfbG93X2VuZHBvaW50KGl0ZW1zW2luZGV4ZXMucmlnaHRdKTtcbiAgICAgICAgfSAgICAgICAgXG4gICAgICAgIC8vIGxlZnQvcmlnaHRcbiAgICAgICAgbGV0IGxvdywgaGlnaDtcbiAgICAgICAgaWYgKHJlc3VsdC5jZW50ZXIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IGl0diA9IHJlc3VsdC5jZW50ZXJbMF0uaXR2O1xuICAgICAgICAgICAgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0dik7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IChsb3dbMF0gPiAtSW5maW5pdHkpID8gZW5kcG9pbnQuZmxpcChsb3csIFwiaGlnaFwiKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IChoaWdoWzBdIDwgSW5maW5pdHkpID8gZW5kcG9pbnQuZmxpcChoaWdoLCBcImxvd1wiKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VsdC5pdHYgPSByZXN1bHQuY2VudGVyWzBdLml0djtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gcmVzdWx0LnByZXY7XG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSByZXN1bHQubmV4dDtcbiAgICAgICAgICAgIC8vIGludGVydmFsXG4gICAgICAgICAgICBsZXQgbGVmdCA9IHJlc3VsdC5sZWZ0O1xuICAgICAgICAgICAgbG93ID0gKGxlZnQgPT0gdW5kZWZpbmVkKSA/IFstSW5maW5pdHksIDBdIDogZW5kcG9pbnQuZmxpcChsZWZ0LCBcImxvd1wiKTtcbiAgICAgICAgICAgIGxldCByaWdodCA9IHJlc3VsdC5yaWdodDtcbiAgICAgICAgICAgIGhpZ2ggPSAocmlnaHQgPT0gdW5kZWZpbmVkKSA/IFtJbmZpbml0eSwgMF0gOiBlbmRwb2ludC5mbGlwKHJpZ2h0LCBcImhpZ2hcIik7XG4gICAgICAgICAgICByZXN1bHQuaXR2ID0gaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXHRVVElMU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5cbi8qXG5cdGJpbmFyeSBzZWFyY2ggZm9yIGZpbmRpbmcgdGhlIGNvcnJlY3QgaW5zZXJ0aW9uIGluZGV4IGludG9cblx0dGhlIHNvcnRlZCBhcnJheSAoYXNjZW5kaW5nKSBvZiBpdGVtc1xuXHRcblx0YXJyYXkgY29udGFpbnMgb2JqZWN0cywgYW5kIHZhbHVlIGZ1bmMgcmV0cmVhdmVzIGEgdmFsdWVcblx0ZnJvbSBlYWNoIG9iamVjdC5cblxuXHRyZXR1cm4gW2ZvdW5kLCBpbmRleF1cbiovXG5cbmZ1bmN0aW9uIGZpbmRfaW5kZXgodGFyZ2V0LCBhcnIsIHZhbHVlX2Z1bmMpIHtcblxuICAgIGZ1bmN0aW9uIGRlZmF1bHRfdmFsdWVfZnVuYyhlbCkge1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgfVxuICAgIFxuICAgIGxldCBsZWZ0ID0gMDtcblx0bGV0IHJpZ2h0ID0gYXJyLmxlbmd0aCAtIDE7XG5cdHZhbHVlX2Z1bmMgPSB2YWx1ZV9mdW5jIHx8IGRlZmF1bHRfdmFsdWVfZnVuYztcblx0d2hpbGUgKGxlZnQgPD0gcmlnaHQpIHtcblx0XHRjb25zdCBtaWQgPSBNYXRoLmZsb29yKChsZWZ0ICsgcmlnaHQpIC8gMik7XG5cdFx0bGV0IG1pZF92YWx1ZSA9IHZhbHVlX2Z1bmMoYXJyW21pZF0pO1xuXHRcdGlmIChtaWRfdmFsdWUgPT09IHRhcmdldCkge1xuXHRcdFx0cmV0dXJuIFt0cnVlLCBtaWRdOyAvLyBUYXJnZXQgYWxyZWFkeSBleGlzdHMgaW4gdGhlIGFycmF5XG5cdFx0fSBlbHNlIGlmIChtaWRfdmFsdWUgPCB0YXJnZXQpIHtcblx0XHRcdCAgbGVmdCA9IG1pZCArIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSByaWdodFxuXHRcdH0gZWxzZSB7XG5cdFx0XHQgIHJpZ2h0ID0gbWlkIC0gMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIGxlZnRcblx0XHR9XG5cdH1cbiAgXHRyZXR1cm4gW2ZhbHNlLCBsZWZ0XTsgLy8gUmV0dXJuIHRoZSBpbmRleCB3aGVyZSB0YXJnZXQgc2hvdWxkIGJlIGluc2VydGVkXG59XG4iLCJpbXBvcnQge0xheWVyfSBmcm9tIFwiLi9uZXdsYXllci5qc1wiO1xuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UgfSBmcm9tIFwiLi9iYXNlcy5qc1wiO1xuaW1wb3J0ICogYXMgc291cmNlcHJvcCBmcm9tIFwiLi9zb3VyY2Vwcm9wLmpzXCI7XG5pbXBvcnQgeyBMb2NhbFN0YXRlUHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX3NpbXBsZS5qc1wiO1xuaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4U2ltcGxlIH0gZnJvbSBcIi4vbmVhcmJ5aW5kZXhfc2ltcGxlXCI7XG5pbXBvcnQgeyB0b1N0YXRlIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0ICogYXMgc2VnbWVudCBmcm9tIFwiLi9zZWdtZW50cy5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBJTlBVVCBMQVlFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIElucHV0TGF5ZXIgaXMgYSBMYXllciB3aXRoIGEgc3RhdGVwcm92aWRlci5cbiAqIFxuICogLnNyYyA6IHN0YXRlcHJvdmlkZXIuXG4gKi9cblxuZXhwb3J0IGNsYXNzIElucHV0TGF5ZXIgZXh0ZW5kcyBMYXllciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIGxldCB7c3JjLCB2YWx1ZUZ1bmMsIC4uLm9wdHN9ID0gb3B0aW9ucztcbiAgICAgICAgc3VwZXIoSW5wdXRMYXllckNhY2hlLCB2YWx1ZUZ1bmMpO1xuICAgICAgICAvLyBzcmNcbiAgICAgICAgc291cmNlcHJvcC5hZGRUb0luc3RhbmNlKHRoaXMsIFwic3JjXCIpO1xuXG4gICAgICAgIC8vIGluaXRpYWxpc2Ugc3RhdGVwcm92aWRlclxuICAgICAgICBpZiAoc3JjID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3JjID0gbmV3IExvY2FsU3RhdGVQcm92aWRlcihvcHRzKTtcbiAgICAgICAgfSAgICAgICAgXG4gICAgICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogU1JDIChzdGF0ZXByb3ZpZGVyKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgX19zcmNfY2hlY2soc3JjKSB7XG4gICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcInNyY1wiIG11c3QgYmUgc3RhdGUgcHJvdmlkZXIgJHtzcmN9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNyYztcbiAgICB9ICAgIFxuICAgIF9fc3JjX2hhbmRsZV9jaGFuZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLmluZGV4ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5pbmRleCA9IG5ldyBOZWFyYnlJbmRleFNpbXBsZSh0aGlzLnNyYylcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgLy8gdHJpZ2dlciBjaGFuZ2UgZXZlbnQgZm9yIGN1cnNvclxuICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiKTsgICBcbiAgICB9XG59XG5zb3VyY2Vwcm9wLmFkZFRvUHJvdG90eXBlKElucHV0TGF5ZXIucHJvdG90eXBlLCBcInNyY1wiLCB7bXV0YWJsZTp0cnVlfSk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElOUFVUTEFZRVIgQ0FDSEVcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBUaGlzIGltcGxlbWVudHMgYSBjYWNoZSBmb3IgYW4gSW5wdXRMYXllciBcbiAgICBTaW5jZSBJbnB1dExheWVyIGhhcyBhIHN0YXRlIHByb3ZpZGVyLCBpdHMgaW5kZXggaXNcbiAgICBpdGVtcywgYW5kIHRoZSBjYWNoZSB3aWxsIGluc3RhbnRpYXRlIHNlZ21lbnRzIGNvcnJlc3BvbmRpbmcgdG9cbiAgICB0aGVzZSBpdGVtcy4gXG4qL1xuXG5leHBvcnQgY2xhc3MgSW5wdXRMYXllckNhY2hlIHtcbiAgICBjb25zdHJ1Y3RvcihsYXllcikge1xuICAgICAgICAvLyBsYXllclxuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IG9iamVjdFxuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhY2hlZCBzZWdtZW50XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IGNhY2hlX21pc3MgPSAoXG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAhaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX25lYXJieS5pdHYsIG9mZnNldClcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKGNhY2hlX21pc3MpIHtcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICAgICAgbGV0IHtpdHYsIGNlbnRlcn0gPSB0aGlzLl9uZWFyYnk7XG4gICAgICAgICAgICB0aGlzLl9zZWdtZW50cyA9IGNlbnRlci5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbG9hZF9zZWdtZW50KGl0diwgaXRlbSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBxdWVyeSBzZWdtZW50c1xuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9zZWdtZW50cy5tYXAoKHNlZykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHNlZy5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRvU3RhdGUoc3RhdGVzLCB0aGlzLl9sYXllci52YWx1ZUZ1bmMpXG4gICAgfVxuXG4gICAgY2xlYXIoKSB7XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICB9XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0FEIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gbG9hZF9zZWdtZW50KGl0diwgaXRlbSkge1xuICAgIGxldCB7dHlwZT1cInN0YXRpY1wiLCBkYXRhfSA9IGl0ZW07XG4gICAgaWYgKHR5cGUgPT0gXCJzdGF0aWNcIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuU3RhdGljU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuVHJhbnNpdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJpbnRlcnBvbGF0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LkludGVycG9sYXRpb25TZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwibW90aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50Lk1vdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhcInVucmVjb2duaXplZCBzZWdtZW50IHR5cGVcIiwgdHlwZSk7XG4gICAgfVxufVxuIl0sIm5hbWVzIjpbIlBSRUZJWCIsImFkZFRvSW5zdGFuY2UiLCJhZGRUb1Byb3RvdHlwZSIsImNhbGxiYWNrLmFkZFRvSW5zdGFuY2UiLCJjYWxsYmFjay5hZGRUb1Byb3RvdHlwZSIsImludGVycG9sYXRlIiwibGF5ZXJzb3VyY2UuYWRkVG9JbnN0YW5jZSIsImxheWVyc291cmNlLmFkZFRvUHJvdG90eXBlIiwic291cmNlcHJvcC5hZGRUb0luc3RhbmNlIiwic291cmNlcHJvcC5hZGRUb1Byb3RvdHlwZSIsInNlZ21lbnQuU3RhdGljU2VnbWVudCIsInNlZ21lbnQuVHJhbnNpdGlvblNlZ21lbnQiLCJzZWdtZW50LkludGVycG9sYXRpb25TZWdtZW50Iiwic2VnbWVudC5Nb3Rpb25TZWdtZW50Il0sIm1hcHBpbmdzIjoiOzs7OztJQUNBO0lBQ0E7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
