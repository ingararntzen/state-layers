
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
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
        callback.addToInstance(this);
    }
    now () {
        throw new Error("not implemented");
    }
}
callback.addToPrototype(ClockProviderBase.prototype);


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
        callback.addToInstance(this);
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
callback.addToPrototype(MotionProviderBase.prototype);




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
        callback.addToInstance(this);
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

/*********************************************************************
    NEARBY CACHE
*********************************************************************/

/*
    This implements a cache in front of a NearbyIndex.
    
    The purpose of caching is to optimize for repeated
    queries to a NearbyIndex to nearby offsets.

    The cache state includes the nearby state from the 
    index, and also segments corresponding
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

function create_segment(itv, type, data) {
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

function load_segment(nearby) {
    let {itv, center} = nearby;
    if (center.length == 0) {
        return create_segment(itv, "static", undefined);
    }
    if (center.length == 1) {
        let {type="static", data} = center[0];
        return create_segment(itv, type, data);
    }
    if (center.length > 1) {
        throw new Error("ListSegments not yet supported");
    }
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
        this._cache = new NearbyCache(this);
        this._cache_objects = [];

        // initialise with stateprovider
        let {src, ...opts} = options;
        if (src == undefined) {
            src = new LocalStateProvider(opts);
        }
        this.src = src;
    }

    /**********************************************************
     * QUERY API
     **********************************************************/

    getQueryObject () {
        const cache_object = new NearbyCache(this);
        this._cache_objects.push(cache_object);
        return cache_object;
    }
    
    query (offset) {
        return this._cache.query(offset);
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
            this._index = new NearbyIndexSimple(this.src);
        } else {
            this._cache.dirty();
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
            data: obj};
    });
    return new Layer({items});
}

Layer.fromArray = fromArray;

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
        } else if (src instanceof LayerBase) {
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
            let state;
            if (origin == "src") {
                if (this._cache == undefined) {
                    this._cache = this.src.getQueryObject();
                }
            }
            if (origin == "src" || origin == "ctrl") {
                // force cache reevaluate
                this._cache.dirty();
            } else if (origin == "query") {
                state = msg; 
            }
            state = state || this.query();
            this.notify_callbacks();
            // trigger change event for cursor
            this.eventifyTrigger("change", state);
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

    _refresh () {
        const offset = this._get_ctrl_state().value;        
        let refreshed = this._cache.refresh(offset);
        let state = this._cache.query(offset);
        return [state, refreshed];
    }

    query () {
        let [state, refreshed] = this._refresh();
        if (refreshed) {
            this.__handle_change("query", state);
        }
        return state;
    }

    get value () {return this.query().value};
    get cache () {return this._cache};
    get index () {return this.src.index};

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

export { Cursor, Layer, cmd };
