
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

          console.log("sample", start, stop);
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

      // ctrl
      __ctrl_check(ctrl) {
          if (!(ctrl instanceof CursorBase)) {
              throw new Error(`"ctrl" must be cursor ${ctrl}`)
          }
      }
      __ctrl_handle_change() {
          this.__handle_change();
      }


      // src
      __src_check(src) {
          if (!(src instanceof StateProviderBase)) {
              throw new Error(`"src" must be state provider ${source}`);
          }
      }    
      __src_handle_change() {
          this.__handle_change();
      }

      // ctrl or src changes
      __handle_change() {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pbnRlcnZhbHMuanMiLCIuLi8uLi9zcmMvc2VnbWVudHMuanMiLCIuLi8uLi9zcmMvZXZlbnRpZnkuanMiLCIuLi8uLi9zcmMvdXRpbC5qcyIsIi4uLy4uL3NyYy9tb25pdG9yLmpzIiwiLi4vLi4vc3JjL2Jhc2VzLmpzIiwiLi4vLi4vc3JjL3N0YXRlcHJvdmlkZXJfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL25lYXJieWNhY2hlLmpzIiwiLi4vLi4vc3JjL25lYXJieWluZGV4LmpzIiwiLi4vLi4vc3JjL25lYXJieWluZGV4X3NpbXBsZS5qcyIsIi4uLy4uL3NyYy9jb21tb24uanMiLCIuLi8uLi9zcmMvY21kLmpzIiwiLi4vLi4vc3JjL2N1cnNvcnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gICAgKiBcbiAgICAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAgICAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICAgICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gICAgKiBcbiAgICAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICAgICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAgICAqIFxuICAgICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG5cbiovXG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuXG5cbiAgICBOT1RFIFxuICAgIC0gY21wKDRdLFs0ICkgPT0gMCAtIHNpbmNlIHRoZXNlIGFyZSB0aGUgc2FtZSB3aXRoIHJlc3BlY3QgdG8gc29ydGluZ1xuICAgIC0gYnV0IGlmIHlvdSB3YW50IHRvIHNlZSBpZiB0d28gaW50ZXJ2YWxzIGFyZSBvdmVybGFwcGluZyBpbiB0aGUgZW5kcG9pbnRzXG4gICAgY21wKGhpZ2hfYSwgbG93X2IpID4gMCB0aGlzIHdpbGwgbm90IGJlIGdvb2RcbiAgICBcbiovIFxuXG5cbmZ1bmN0aW9uIGNtcE51bWJlcnMoYSwgYikge1xuICAgIGlmIChhID09PSBiKSByZXR1cm4gMDtcbiAgICBpZiAoYSA9PT0gSW5maW5pdHkpIHJldHVybiAxO1xuICAgIGlmIChiID09PSBJbmZpbml0eSkgcmV0dXJuIC0xO1xuICAgIGlmIChhID09PSAtSW5maW5pdHkpIHJldHVybiAtMTtcbiAgICBpZiAoYiA9PT0gLUluZmluaXR5KSByZXR1cm4gMTtcbiAgICByZXR1cm4gYSAtIGI7XG4gIH1cblxuZnVuY3Rpb24gZW5kcG9pbnRfY21wIChwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICBsZXQgZGlmZiA9IGNtcE51bWJlcnModjEsIHYyKTtcbiAgICByZXR1cm4gKGRpZmYgIT0gMCkgPyBkaWZmIDogczEgLSBzMjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludCB0byB0aGUgb3RoZXIgc2lkZVxuICogXG4gKiB1c2VmdWwgZm9yIG1ha2luZyBiYWNrLXRvLWJhY2sgaW50ZXJ2YWxzIFxuICogXG4gKiBoaWdoKSA8LT4gW2xvd1xuICogaGlnaF0gPC0+IChsb3dcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKHAsIHRhcmdldCkge1xuICAgIGxldCBbdixzXSA9IHA7XG4gICAgaWYgKHRhcmdldCA9PSBcImxvd1wiKSB7XG4gICAgXHQvLyBhc3N1bWUgcG9pbnQgaXMgaGlnaDogc2lnbiBtdXN0IGJlIC0xIG9yIDBcbiAgICBcdGlmIChzID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBsb3dcIik7ICAgIFx0XHRcbiAgICBcdH1cbiAgICAgICAgcCA9IFt2LCBzKzFdO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09IFwiaGlnaFwiKSB7XG5cdFx0Ly8gYXNzdW1lIHBvaW50IGlzIGxvdzogc2lnbiBpcyAwIG9yIDFcbiAgICBcdGlmIChzIDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBoaWdoXCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcy0xXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0eXBlXCIsIHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBsZXQgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBsZXQgbG93X3AgPSAobG93Q2xvc2VkKSA/IFtsb3csIDBdIDogW2xvdywgMV07IFxuICAgIGxldCBoaWdoX3AgPSAoaGlnaENsb3NlZCkgPyBbaGlnaCwgMF0gOiBbaGlnaCwgLTFdO1xuICAgIHJldHVybiBbbG93X3AsIGhpZ2hfcF07XG59XG5cblxuLypcbiAgICBJTlRFUlZBTFNcblxuICAgIEludGVydmFscyBhcmUgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXVxuXG4qLyBcblxuLypcbiAgICByZXR1cm4gdHJ1ZSBpZiBwb2ludCBwIGlzIGNvdmVyZWQgYnkgaW50ZXJ2YWwgaXR2XG4gICAgcG9pbnQgcCBjYW4gYmUgbnVtYmVyIHAgb3IgYSBwb2ludCBbcCxzXVxuXG4gICAgaW1wbGVtZW50ZWQgYnkgY29tcGFyaW5nIHBvaW50c1xuICAgIGV4Y2VwdGlvbiBpZiBpbnRlcnZhbCBpcyBub3QgZGVmaW5lZFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIHApIHtcbiAgICBsZXQgW2xvd19wLCBoaWdoX3BdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAvLyBjb3ZlcnM6IGxvdyA8PSBwIDw9IGhpZ2hcbiAgICByZXR1cm4gZW5kcG9pbnRfbGUobG93X3AsIHApICYmIGVuZHBvaW50X2xlKHAsIGhpZ2hfcCk7XG59XG4vLyBjb252ZW5pZW5jZVxuZnVuY3Rpb24gaW50ZXJ2YWxfY292ZXJzX3BvaW50KGl0diwgcCkge1xuICAgIHJldHVybiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBbcCwgMF0pO1xufVxuXG5cblxuLypcbiAgICBSZXR1cm4gdHJ1ZSBpZiBpbnRlcnZhbCBoYXMgbGVuZ3RoIDBcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9pc19zaW5ndWxhcihpbnRlcnZhbCkge1xuICAgIHJldHVybiBpbnRlcnZhbFswXSA9PSBpbnRlcnZhbFsxXVxufVxuXG4vKlxuICAgIENyZWF0ZSBpbnRlcnZhbCBmcm9tIGVuZHBvaW50c1xuKi9cbmZ1bmN0aW9uIGludGVydmFsX2Zyb21fZW5kcG9pbnRzKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIC8vIHAxIG11c3QgYmUgYSBsb3cgcG9pbnRcbiAgICBpZiAoczEgPT0gLTEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBsb3cgcG9pbnRcIiwgcDEpO1xuICAgIH1cbiAgICBpZiAoczIgPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2VhbCBoaWdoIHBvaW50XCIsIHAyKTsgICBcbiAgICB9XG4gICAgcmV0dXJuIFt2MSwgdjIsIChzMT09MCksIChzMj09MCldXG59XG5cblxuZXhwb3J0IGNvbnN0IGVuZHBvaW50ID0ge1xuICAgIGxlOiBlbmRwb2ludF9sZSxcbiAgICBsdDogZW5kcG9pbnRfbHQsXG4gICAgZ2U6IGVuZHBvaW50X2dlLFxuICAgIGd0OiBlbmRwb2ludF9ndCxcbiAgICBjbXA6IGVuZHBvaW50X2NtcCxcbiAgICBlcTogZW5kcG9pbnRfZXEsXG4gICAgbWluOiBlbmRwb2ludF9taW4sXG4gICAgbWF4OiBlbmRwb2ludF9tYXgsXG4gICAgZmxpcDogZW5kcG9pbnRfZmxpcCxcbiAgICBmcm9tX2ludGVydmFsOiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbFxufVxuZXhwb3J0IGNvbnN0IGludGVydmFsID0ge1xuICAgIGNvdmVyc19lbmRwb2ludDogaW50ZXJ2YWxfY292ZXJzX2VuZHBvaW50LFxuICAgIGNvdmVyc19wb2ludDogaW50ZXJ2YWxfY292ZXJzX3BvaW50LCBcbiAgICBpc19zaW5ndWxhcjogaW50ZXJ2YWxfaXNfc2luZ3VsYXIsXG4gICAgZnJvbV9lbmRwb2ludHM6IGludGVydmFsX2Zyb21fZW5kcG9pbnRzXG59XG4iLCJpbXBvcnQge2ludGVydmFsfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbkJBU0UgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLypcblx0QWJzdHJhY3QgQmFzZSBDbGFzcyBmb3IgU2VnbWVudHNcblxuICAgIGNvbnN0cnVjdG9yKGludGVydmFsKVxuXG4gICAgLSBpbnRlcnZhbDogaW50ZXJ2YWwgb2YgdmFsaWRpdHkgb2Ygc2VnbWVudFxuICAgIC0gZHluYW1pYzogdHJ1ZSBpZiBzZWdtZW50IGlzIGR5bmFtaWNcbiAgICAtIHZhbHVlKG9mZnNldCk6IHZhbHVlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4gICAgLSBxdWVyeShvZmZzZXQpOiBzdGF0ZSBvZiBzZWdtZW50IGF0IG9mZnNldFxuKi9cblxuZXhwb3J0IGNsYXNzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYpIHtcblx0XHR0aGlzLl9pdHYgPSBpdHY7XG5cdH1cblxuXHRnZXQgaXR2KCkge3JldHVybiB0aGlzLl9pdHY7fVxuXG4gICAgLyoqIFxuICAgICAqIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzXG4gICAgICogcmV0dXJucyB7dmFsdWUsIGR5bmFtaWN9O1xuICAgICovXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgXHR0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY29udmVuaWVuY2UgZnVuY3Rpb24gcmV0dXJuaW5nIHRoZSBzdGF0ZSBvZiB0aGUgc2VnbWVudFxuICAgICAqIEBwYXJhbSB7Kn0gb2Zmc2V0IFxuICAgICAqIEByZXR1cm5zIFxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX2l0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHsuLi50aGlzLnN0YXRlKG9mZnNldCksIG9mZnNldH07XG4gICAgICAgIH0gXG4gICAgICAgIHJldHVybiB7dmFsdWU6IHVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUlMgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJzU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcblx0XHR0aGlzLl9sYXllcnMgPSBhcmdzLmxheWVycztcbiAgICAgICAgdGhpcy5fdmFsdWVfZnVuYyA9IGFyZ3MudmFsdWVfZnVuY1xuXG4gICAgICAgIC8vIFRPRE8gLSBmaWd1cmUgb3V0IGR5bmFtaWMgaGVyZT9cbiAgICB9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIC8vIFRPRE8gLSB1c2UgdmFsdWUgZnVuY1xuICAgICAgICAvLyBmb3Igbm93IC0ganVzdCB1c2UgZmlyc3QgbGF5ZXJcbiAgICAgICAgcmV0dXJuIHsuLi50aGlzLl9sYXllcnNbMF0ucXVlcnkob2Zmc2V0KSwgb2Zmc2V0fTtcblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNUQVRJQyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX3ZhbHVlID0gYXJncy52YWx1ZTtcblx0fVxuXG5cdHN0YXRlKCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl92YWx1ZSwgZHluYW1pYzpmYWxzZX1cblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE1PVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuICAgIEltcGxlbWVudHMgZGV0ZXJtaW5pc3RpYyBwcm9qZWN0aW9uIGJhc2VkIG9uIGluaXRpYWwgY29uZGl0aW9ucyBcbiAgICAtIG1vdGlvbiB2ZWN0b3IgZGVzY3JpYmVzIG1vdGlvbiB1bmRlciBjb25zdGFudCBhY2NlbGVyYXRpb25cbiovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBwb3NpdGlvbjpwMCwgdmVsb2NpdHk6djAsIHRpbWVzdGFtcDp0MFxuICAgICAgICB9ID0gYXJncztcbiAgICAgICAgLy8gY3JlYXRlIG1vdGlvbiB0cmFuc2l0aW9uXG4gICAgICAgIGNvbnN0IGEwID0gMDtcbiAgICAgICAgdGhpcy5fdmVsb2NpdHkgPSB2MDtcbiAgICAgICAgdGhpcy5fcG9zaXRpb24gPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIGxldCBkID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHJldHVybiBwMCArIHYwKmQgKyAwLjUqYTAqZCpkO1xuICAgICAgICB9OyAgIFxuICAgIH1cblxuICAgIHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmFsdWU6IHRoaXMuX3Bvc2l0aW9uKG9mZnNldCksIFxuICAgICAgICAgICAgcmF0ZTogdGhpcy5fdmVsb2NpdHksIFxuICAgICAgICAgICAgZHluYW1pYzogdGhpcy5fdmVsb2NpdHkgIT0gMFxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRSQU5TSVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIFN1cHBvcnRlZCBlYXNpbmcgZnVuY3Rpb25zXG4gICAgXCJlYXNlLWluXCI6XG4gICAgXCJlYXNlLW91dFwiOlxuICAgIFwiZWFzZS1pbi1vdXRcIlxuKi9cblxuZnVuY3Rpb24gZWFzZWluICh0cykge1xuICAgIHJldHVybiBNYXRoLnBvdyh0cywyKTsgIFxufVxuZnVuY3Rpb24gZWFzZW91dCAodHMpIHtcbiAgICByZXR1cm4gMSAtIGVhc2VpbigxIC0gdHMpO1xufVxuZnVuY3Rpb24gZWFzZWlub3V0ICh0cykge1xuICAgIGlmICh0cyA8IC41KSB7XG4gICAgICAgIHJldHVybiBlYXNlaW4oMiAqIHRzKSAvIDI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICgyIC0gZWFzZWluKDIgKiAoMSAtIHRzKSkpIC8gMjtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFuc2l0aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcblx0XHRzdXBlcihpdHYpO1xuICAgICAgICBsZXQge3YwLCB2MSwgZWFzaW5nfSA9IGFyZ3M7XG4gICAgICAgIGxldCBbdDAsIHQxXSA9IHRoaXMuX2l0di5zbGljZSgwLDIpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgdHJhbnNpdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl9keW5hbWljID0gdjEtdjAgIT0gMDtcbiAgICAgICAgdGhpcy5fdHJhbnMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgdHMgdG8gW3QwLHQxXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzaGlmdCBmcm9tIFt0MCx0MV0tc3BhY2UgdG8gWzAsKHQxLXQwKV0tc3BhY2VcbiAgICAgICAgICAgIC8vIC0gc2NhbGUgZnJvbSBbMCwodDEtdDApXS1zcGFjZSB0byBbMCwxXS1zcGFjZVxuICAgICAgICAgICAgdHMgPSB0cyAtIHQwO1xuICAgICAgICAgICAgdHMgPSB0cy9wYXJzZUZsb2F0KHQxLXQwKTtcbiAgICAgICAgICAgIC8vIGVhc2luZyBmdW5jdGlvbnMgc3RyZXRjaGVzIG9yIGNvbXByZXNzZXMgdGhlIHRpbWUgc2NhbGUgXG4gICAgICAgICAgICBpZiAoZWFzaW5nID09IFwiZWFzZS1pblwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW4odHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlb3V0KHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWFzaW5nID09IFwiZWFzZS1pbi1vdXRcIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZWlub3V0KHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc2l0aW9uIGZyb20gdjAgdG8gdjEsIGZvciB0aW1lIHZhbHVlcyBbMCwxXVxuICAgICAgICAgICAgdHMgPSBNYXRoLm1heCh0cywgMCk7XG4gICAgICAgICAgICB0cyA9IE1hdGgubWluKHRzLCAxKTtcbiAgICAgICAgICAgIHJldHVybiB2MCArICh2MS12MCkqdHM7XG4gICAgICAgIH1cblx0fVxuXG5cdHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl90cmFucyhvZmZzZXQpLCBkeW5hbWljOnRoaXMuX2R5bmFtaWN9XG5cdH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElOVEVSUE9MQVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9uIHRvIGNyZWF0ZSBhbiBpbnRlcnBvbGF0b3IgZm9yIG5lYXJlc3QgbmVpZ2hib3IgaW50ZXJwb2xhdGlvbiB3aXRoXG4gKiBleHRyYXBvbGF0aW9uIHN1cHBvcnQuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdHVwbGVzIC0gQW4gYXJyYXkgb2YgW3ZhbHVlLCBvZmZzZXRdIHBhaXJzLCB3aGVyZSB2YWx1ZSBpcyB0aGVcbiAqIHBvaW50J3MgdmFsdWUgYW5kIG9mZnNldCBpcyB0aGUgY29ycmVzcG9uZGluZyBvZmZzZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gQSBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIG9mZnNldCBhbmQgcmV0dXJucyB0aGVcbiAqIGludGVycG9sYXRlZCBvciBleHRyYXBvbGF0ZWQgdmFsdWUuXG4gKi9cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUodHVwbGVzKSB7XG5cbiAgICBpZiAodHVwbGVzLmxlbmd0aCA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHVuZGVmaW5lZDt9XG4gICAgfSBlbHNlIGlmICh0dXBsZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHR1cGxlc1swXVswXTt9XG4gICAgfVxuXG4gICAgLy8gU29ydCB0aGUgdHVwbGVzIGJ5IHRoZWlyIG9mZnNldHNcbiAgICBjb25zdCBzb3J0ZWRUdXBsZXMgPSBbLi4udHVwbGVzXS5zb3J0KChhLCBiKSA9PiBhWzFdIC0gYlsxXSk7XG4gIFxuICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3Iob2Zmc2V0KSB7XG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBiZWZvcmUgdGhlIGZpcnN0IHBvaW50XG4gICAgICBpZiAob2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1swXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1swXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbMV07XG4gICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gSGFuZGxlIGV4dHJhcG9sYXRpb24gYWZ0ZXIgdGhlIGxhc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMl07XG4gICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICBcbiAgICAgIC8vIEZpbmQgdGhlIG5lYXJlc3QgcG9pbnRzIHRvIHRoZSBsZWZ0IGFuZCByaWdodFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW2ldWzFdICYmIG9mZnNldCA8PSBzb3J0ZWRUdXBsZXNbaSArIDFdWzFdKSB7XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbaV07XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbaSArIDFdO1xuICAgICAgICAgIC8vIExpbmVhciBpbnRlcnBvbGF0aW9uIGZvcm11bGE6IHkgPSB5MSArICggKHggLSB4MSkgKiAoeTIgLSB5MSkgLyAoeDIgLSB4MSkgKVxuICAgICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICBcbiAgICAgIC8vIEluIGNhc2UgdGhlIG9mZnNldCBkb2VzIG5vdCBmYWxsIHdpdGhpbiBhbnkgcmFuZ2UgKHNob3VsZCBiZSBjb3ZlcmVkIGJ5IHRoZSBwcmV2aW91cyBjb25kaXRpb25zKVxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9O1xufVxuICBcblxuZXhwb3J0IGNsYXNzIEludGVycG9sYXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG4gICAgY29uc3RydWN0b3IoaXR2LCBhcmdzKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIC8vIHNldHVwIGludGVycG9sYXRpb24gZnVuY3Rpb25cbiAgICAgICAgdGhpcy5fdHJhbnMgPSBpbnRlcnBvbGF0ZShhcmdzLnR1cGxlcyk7XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dHJ1ZX07XG4gICAgfVxufVxuXG5cbiIsIi8qXG5cdENvcHlyaWdodCAyMDIwXG5cdEF1dGhvciA6IEluZ2FyIEFybnR6ZW5cblxuXHRUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgVGltaW5nc3JjIG1vZHVsZS5cblxuXHRUaW1pbmdzcmMgaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeVxuXHRpdCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnlcblx0dGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbiwgZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3Jcblx0KGF0IHlvdXIgb3B0aW9uKSBhbnkgbGF0ZXIgdmVyc2lvbi5cblxuXHRUaW1pbmdzcmMgaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCxcblx0YnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZOyB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2Zcblx0TUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLiAgU2VlIHRoZVxuXHRHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cblxuXHRZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2Vcblx0YWxvbmcgd2l0aCBUaW1pbmdzcmMuICBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz4uXG4qL1xuXG5cblxuLypcblx0RXZlbnRcblx0LSBuYW1lOiBldmVudCBuYW1lXG5cdC0gcHVibGlzaGVyOiB0aGUgb2JqZWN0IHdoaWNoIGRlZmluZWQgdGhlIGV2ZW50XG5cdC0gaW5pdDogdHJ1ZSBpZiB0aGUgZXZlbnQgc3VwcHBvcnRzIGluaXQgZXZlbnRzXG5cdC0gc3Vic2NyaXB0aW9uczogc3Vic2NyaXB0aW5zIHRvIHRoaXMgZXZlbnRcblxuKi9cblxuY2xhc3MgRXZlbnQge1xuXG5cdGNvbnN0cnVjdG9yIChwdWJsaXNoZXIsIG5hbWUsIG9wdGlvbnMpIHtcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXHRcdHRoaXMucHVibGlzaGVyID0gcHVibGlzaGVyO1xuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdFx0dGhpcy5pbml0ID0gKG9wdGlvbnMuaW5pdCA9PT0gdW5kZWZpbmVkKSA/IGZhbHNlIDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucyA9IFtdO1xuXHR9XG5cblx0Lypcblx0XHRzdWJzY3JpYmUgdG8gZXZlbnRcblx0XHQtIHN1YnNjcmliZXI6IHN1YnNjcmliaW5nIG9iamVjdFxuXHRcdC0gY2FsbGJhY2s6IGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGludm9rZVxuXHRcdC0gb3B0aW9uczpcblx0XHRcdGluaXQ6IGlmIHRydWUgc3Vic2NyaWJlciB3YW50cyBpbml0IGV2ZW50c1xuXHQqL1xuXHRzdWJzY3JpYmUgKGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0aWYgKCFjYWxsYmFjayB8fCB0eXBlb2YgY2FsbGJhY2sgIT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgbm90IGEgZnVuY3Rpb25cIiwgY2FsbGJhY2spO1xuXHRcdH1cblx0XHRjb25zdCBzdWIgPSBuZXcgU3Vic2NyaXB0aW9uKHRoaXMsIGNhbGxiYWNrLCBvcHRpb25zKTtcblx0XHR0aGlzLnN1YnNjcmlwdGlvbnMucHVzaChzdWIpO1xuXHQgICAgLy8gSW5pdGlhdGUgaW5pdCBjYWxsYmFjayBmb3IgdGhpcyBzdWJzY3JpcHRpb25cblx0ICAgIGlmICh0aGlzLmluaXQgJiYgc3ViLmluaXQpIHtcblx0ICAgIFx0c3ViLmluaXRfcGVuZGluZyA9IHRydWU7XG5cdCAgICBcdGxldCBzZWxmID0gdGhpcztcblx0ICAgIFx0UHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICBcdFx0Y29uc3QgZUFyZ3MgPSBzZWxmLnB1Ymxpc2hlci5ldmVudGlmeUluaXRFdmVudEFyZ3Moc2VsZi5uYW1lKSB8fCBbXTtcblx0ICAgIFx0XHRzdWIuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdCAgICBcdFx0Zm9yIChsZXQgZUFyZyBvZiBlQXJncykge1xuXHQgICAgXHRcdFx0c2VsZi50cmlnZ2VyKGVBcmcsIFtzdWJdLCB0cnVlKTtcblx0ICAgIFx0XHR9XG5cdCAgICBcdH0pO1xuXHQgICAgfVxuXHRcdHJldHVybiBzdWJcblx0fVxuXG5cdC8qXG5cdFx0dHJpZ2dlciBldmVudFxuXG5cdFx0LSBpZiBzdWIgaXMgdW5kZWZpbmVkIC0gcHVibGlzaCB0byBhbGwgc3Vic2NyaXB0aW9uc1xuXHRcdC0gaWYgc3ViIGlzIGRlZmluZWQgLSBwdWJsaXNoIG9ubHkgdG8gZ2l2ZW4gc3Vic2NyaXB0aW9uXG5cdCovXG5cdHRyaWdnZXIgKGVBcmcsIHN1YnMsIGluaXQpIHtcblx0XHRsZXQgZUluZm8sIGN0eDtcblx0XHRmb3IgKGNvbnN0IHN1YiBvZiBzdWJzKSB7XG5cdFx0XHQvLyBpZ25vcmUgdGVybWluYXRlZCBzdWJzY3JpcHRpb25zXG5cdFx0XHRpZiAoc3ViLnRlcm1pbmF0ZWQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRlSW5mbyA9IHtcblx0XHRcdFx0c3JjOiB0aGlzLnB1Ymxpc2hlcixcblx0XHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0XHRzdWI6IHN1Yixcblx0XHRcdFx0aW5pdDogaW5pdFxuXHRcdFx0fVxuXHRcdFx0Y3R4ID0gc3ViLmN0eCB8fCB0aGlzLnB1Ymxpc2hlcjtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHN1Yi5jYWxsYmFjay5jYWxsKGN0eCwgZUFyZywgZUluZm8pO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBFcnJvciBpbiAke3RoaXMubmFtZX06ICR7c3ViLmNhbGxiYWNrfSAke2Vycn1gKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKlxuXHR1bnN1YnNjcmliZSBmcm9tIGV2ZW50XG5cdC0gdXNlIHN1YnNjcmlwdGlvbiByZXR1cm5lZCBieSBwcmV2aW91cyBzdWJzY3JpYmVcblx0Ki9cblx0dW5zdWJzY3JpYmUoc3ViKSB7XG5cdFx0bGV0IGlkeCA9IHRoaXMuc3Vic2NyaXB0aW9ucy5pbmRleE9mKHN1Yik7XG5cdFx0aWYgKGlkeCA+IC0xKSB7XG5cdFx0XHR0aGlzLnN1YnNjcmlwdGlvbnMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRzdWIudGVybWluYXRlKCk7XG5cdFx0fVxuXHR9XG59XG5cblxuLypcblx0U3Vic2NyaXB0aW9uIGNsYXNzXG4qL1xuXG5jbGFzcyBTdWJzY3JpcHRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKGV2ZW50LCBjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5ldmVudCA9IGV2ZW50O1xuXHRcdHRoaXMubmFtZSA9IGV2ZW50Lm5hbWU7XG5cdFx0dGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrXG5cdFx0dGhpcy5pbml0ID0gKG9wdGlvbnMuaW5pdCA9PT0gdW5kZWZpbmVkKSA/IHRoaXMuZXZlbnQuaW5pdCA6IG9wdGlvbnMuaW5pdDtcblx0XHR0aGlzLmluaXRfcGVuZGluZyA9IGZhbHNlO1xuXHRcdHRoaXMudGVybWluYXRlZCA9IGZhbHNlO1xuXHRcdHRoaXMuY3R4ID0gb3B0aW9ucy5jdHg7XG5cdH1cblxuXHR0ZXJtaW5hdGUoKSB7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gdHJ1ZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuZXZlbnQudW5zdWJzY3JpYmUodGhpcyk7XG5cdH1cbn1cblxuXG4vKlxuXG5cdEVWRU5USUZZIElOU1RBTkNFXG5cblx0RXZlbnRpZnkgYnJpbmdzIGV2ZW50aW5nIGNhcGFiaWxpdGllcyB0byBhbnkgb2JqZWN0LlxuXG5cdEluIHBhcnRpY3VsYXIsIGV2ZW50aWZ5IHN1cHBvcnRzIHRoZSBpbml0aWFsLWV2ZW50IHBhdHRlcm4uXG5cdE9wdC1pbiBmb3IgaW5pdGlhbCBldmVudHMgcGVyIGV2ZW50IHR5cGUuXG5cblx0ZXZlbnRpZnlJbml0RXZlbnRBcmdzKG5hbWUpIHtcblx0XHRpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG5cdFx0XHRyZXR1cm4gW3RoaXMuX3ZhbHVlXTtcblx0XHR9XG5cdH1cblxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5SW5zdGFuY2UgKG9iamVjdCkge1xuXHRvYmplY3QuX19ldmVudGlmeV9ldmVudE1hcCA9IG5ldyBNYXAoKTtcblx0b2JqZWN0Ll9fZXZlbnRpZnlfYnVmZmVyID0gW107XG5cdHJldHVybiBvYmplY3Q7XG59O1xuXG5cbi8qXG5cdEVWRU5USUZZIFBST1RPVFlQRVxuXG5cdEFkZCBldmVudGlmeSBmdW5jdGlvbmFsaXR5IHRvIHByb3RvdHlwZSBvYmplY3RcbiovXG5cbmV4cG9ydCBmdW5jdGlvbiBldmVudGlmeVByb3RvdHlwZShfcHJvdG90eXBlKSB7XG5cblx0ZnVuY3Rpb24gZXZlbnRpZnlHZXRFdmVudChvYmplY3QsIG5hbWUpIHtcblx0XHRjb25zdCBldmVudCA9IG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwLmdldChuYW1lKTtcblx0XHRpZiAoZXZlbnQgPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCB1bmRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHJldHVybiBldmVudDtcblx0fVxuXG5cdC8qXG5cdFx0REVGSU5FIEVWRU5UXG5cdFx0LSB1c2VkIG9ubHkgYnkgZXZlbnQgc291cmNlXG5cdFx0LSBuYW1lOiBuYW1lIG9mIGV2ZW50XG5cdFx0LSBvcHRpb25zOiB7aW5pdDp0cnVlfSBzcGVjaWZpZXMgaW5pdC1ldmVudCBzZW1hbnRpY3MgZm9yIGV2ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5RGVmaW5lKG5hbWUsIG9wdGlvbnMpIHtcblx0XHQvLyBjaGVjayB0aGF0IGV2ZW50IGRvZXMgbm90IGFscmVhZHkgZXhpc3Rcblx0XHRpZiAodGhpcy5fX2V2ZW50aWZ5X2V2ZW50TWFwLmhhcyhuYW1lKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRXZlbnQgYWxyZWFkeSBkZWZpbmVkXCIsIG5hbWUpO1xuXHRcdH1cblx0XHR0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuc2V0KG5hbWUsIG5ldyBFdmVudCh0aGlzLCBuYW1lLCBvcHRpb25zKSk7XG5cdH07XG5cblx0Lypcblx0XHRPTlxuXHRcdC0gdXNlZCBieSBzdWJzY3JpYmVyXG5cdFx0cmVnaXN0ZXIgY2FsbGJhY2sgb24gZXZlbnQuXG5cdCovXG5cdGZ1bmN0aW9uIG9uKG5hbWUsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSkuc3Vic2NyaWJlKGNhbGxiYWNrLCBvcHRpb25zKTtcblx0fTtcblxuXHQvKlxuXHRcdE9GRlxuXHRcdC0gdXNlZCBieSBzdWJzY3JpYmVyXG5cdFx0VW4tcmVnaXN0ZXIgYSBoYW5kbGVyIGZyb20gYSBzcGVjZmljIGV2ZW50IHR5cGVcblx0Ki9cblx0ZnVuY3Rpb24gb2ZmKHN1Yikge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIHN1Yi5uYW1lKS51bnN1YnNjcmliZShzdWIpO1xuXHR9O1xuXG5cblx0ZnVuY3Rpb24gZXZlbnRpZnlTdWJzY3JpcHRpb25zKG5hbWUpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpcHRpb25zO1xuXHR9XG5cblxuXG5cdC8qXG5cdFx0VHJpZ2dlciBsaXN0IG9mIGV2ZW50SXRlbXMgb24gb2JqZWN0XG5cblx0XHRldmVudEl0ZW06ICB7bmFtZTouLiwgZUFyZzouLn1cblxuXHRcdGNvcHkgYWxsIGV2ZW50SXRlbXMgaW50byBidWZmZXIuXG5cdFx0cmVxdWVzdCBlbXB0eWluZyB0aGUgYnVmZmVyLCBpLmUuIGFjdHVhbGx5IHRyaWdnZXJpbmcgZXZlbnRzLFxuXHRcdGV2ZXJ5IHRpbWUgdGhlIGJ1ZmZlciBnb2VzIGZyb20gZW1wdHkgdG8gbm9uLWVtcHR5XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsbChldmVudEl0ZW1zKSB7XG5cdFx0aWYgKGV2ZW50SXRlbXMubGVuZ3RoID09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBtYWtlIHRyaWdnZXIgaXRlbXNcblx0XHQvLyByZXNvbHZlIG5vbi1wZW5kaW5nIHN1YnNjcmlwdGlvbnMgbm93XG5cdFx0Ly8gZWxzZSBzdWJzY3JpcHRpb25zIG1heSBjaGFuZ2UgZnJvbSBwZW5kaW5nIHRvIG5vbi1wZW5kaW5nXG5cdFx0Ly8gYmV0d2VlbiBoZXJlIGFuZCBhY3R1YWwgdHJpZ2dlcmluZ1xuXHRcdC8vIG1ha2UgbGlzdCBvZiBbZXYsIGVBcmcsIHN1YnNdIHR1cGxlc1xuXHRcdGxldCB0cmlnZ2VySXRlbXMgPSBldmVudEl0ZW1zLm1hcCgoaXRlbSkgPT4ge1xuXHRcdFx0bGV0IHtuYW1lLCBlQXJnfSA9IGl0ZW07XG5cdFx0XHRsZXQgZXYgPSBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpO1xuXHRcdFx0bGV0IHN1YnMgPSBldi5zdWJzY3JpcHRpb25zLmZpbHRlcihzdWIgPT4gc3ViLmluaXRfcGVuZGluZyA9PSBmYWxzZSk7XG5cdFx0XHRyZXR1cm4gW2V2LCBlQXJnLCBzdWJzXTtcblx0XHR9LCB0aGlzKTtcblxuXHRcdC8vIGFwcGVuZCB0cmlnZ2VyIEl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGNvbnN0IGxlbiA9IHRyaWdnZXJJdGVtcy5sZW5ndGg7XG5cdFx0Y29uc3QgYnVmID0gdGhpcy5fX2V2ZW50aWZ5X2J1ZmZlcjtcblx0XHRjb25zdCBidWZfbGVuID0gdGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGg7XG5cdFx0Ly8gcmVzZXJ2ZSBtZW1vcnkgLSBzZXQgbmV3IGxlbmd0aFxuXHRcdHRoaXMuX19ldmVudGlmeV9idWZmZXIubGVuZ3RoID0gYnVmX2xlbiArIGxlbjtcblx0XHQvLyBjb3B5IHRyaWdnZXJJdGVtcyB0byBidWZmZXJcblx0XHRmb3IgKGxldCBpPTA7IGk8bGVuOyBpKyspIHtcblx0XHRcdGJ1ZltidWZfbGVuK2ldID0gdHJpZ2dlckl0ZW1zW2ldO1xuXHRcdH1cblx0XHQvLyByZXF1ZXN0IGVtcHR5aW5nIG9mIHRoZSBidWZmZXJcblx0XHRpZiAoYnVmX2xlbiA9PSAwKSB7XG5cdFx0XHRsZXQgc2VsZiA9IHRoaXM7XG5cdFx0XHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRmb3IgKGxldCBbZXYsIGVBcmcsIHN1YnNdIG9mIHNlbGYuX19ldmVudGlmeV9idWZmZXIpIHtcblx0XHRcdFx0XHQvLyBhY3R1YWwgZXZlbnQgdHJpZ2dlcmluZ1xuXHRcdFx0XHRcdGV2LnRyaWdnZXIoZUFyZywgc3VicywgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGYuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdC8qXG5cdFx0VHJpZ2dlciBtdWx0aXBsZSBldmVudHMgb2Ygc2FtZSB0eXBlIChuYW1lKVxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXJBbGlrZShuYW1lLCBlQXJncykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChlQXJncy5tYXAoZUFyZyA9PiB7XG5cdFx0XHRyZXR1cm4ge25hbWUsIGVBcmd9O1xuXHRcdH0pKTtcblx0fVxuXG5cdC8qXG5cdFx0VHJpZ2dlciBzaW5nbGUgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyKG5hbWUsIGVBcmcpIHtcblx0XHRyZXR1cm4gdGhpcy5ldmVudGlmeVRyaWdnZXJBbGwoW3tuYW1lLCBlQXJnfV0pO1xuXHR9XG5cblx0X3Byb3RvdHlwZS5ldmVudGlmeURlZmluZSA9IGV2ZW50aWZ5RGVmaW5lO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlciA9IGV2ZW50aWZ5VHJpZ2dlcjtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXJBbGlrZSA9IGV2ZW50aWZ5VHJpZ2dlckFsaWtlO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsbCA9IGV2ZW50aWZ5VHJpZ2dlckFsbDtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVN1YnNjcmlwdGlvbnMgPSBldmVudGlmeVN1YnNjcmlwdGlvbnM7XG5cdF9wcm90b3R5cGUub24gPSBvbjtcblx0X3Byb3RvdHlwZS5vZmYgPSBvZmY7XG59O1xuXG5cbmV4cG9ydCBjb25zdCBldmVudGlmeSA9IGZ1bmN0aW9uICgpIHtcblx0cmV0dXJuIHtcblx0XHRhZGRUb0luc3RhbmNlOiBldmVudGlmeUluc3RhbmNlLFxuXHRcdGFkZFRvUHJvdG90eXBlOiBldmVudGlmeVByb3RvdHlwZVxuXHR9XG59KCk7XG5cbi8qXG5cdEV2ZW50IFZhcmlhYmxlXG5cblx0T2JqZWN0cyB3aXRoIGEgc2luZ2xlIFwiY2hhbmdlXCIgZXZlbnRcbiovXG5cbmV4cG9ydCBjbGFzcyBFdmVudFZhcmlhYmxlIHtcblxuXHRjb25zdHJ1Y3RvciAodmFsdWUpIHtcblx0XHRldmVudGlmeUluc3RhbmNlKHRoaXMpO1xuXHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0dGhpcy5ldmVudGlmeURlZmluZShcImNoYW5nZVwiLCB7aW5pdDp0cnVlfSk7XG5cdH1cblxuXHRldmVudGlmeUluaXRFdmVudEFyZ3MobmFtZSkge1xuXHRcdGlmIChuYW1lID09IFwiY2hhbmdlXCIpIHtcblx0XHRcdHJldHVybiBbdGhpcy5fdmFsdWVdO1xuXHRcdH1cblx0fVxuXG5cdGdldCB2YWx1ZSAoKSB7cmV0dXJuIHRoaXMuX3ZhbHVlfTtcblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdGlmICh2YWx1ZSAhPSB0aGlzLl92YWx1ZSkge1xuXHRcdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHRcdHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHZhbHVlKTtcblx0XHR9XG5cdH1cbn1cbmV2ZW50aWZ5UHJvdG90eXBlKEV2ZW50VmFyaWFibGUucHJvdG90eXBlKTtcblxuLypcblx0RXZlbnQgQm9vbGVhblxuXG5cblx0Tm90ZSA6IGltcGxlbWVudGF0aW9uIHVzZXMgZmFsc2luZXNzIG9mIGlucHV0IHBhcmFtZXRlciB0byBjb25zdHJ1Y3RvciBhbmQgc2V0KCkgb3BlcmF0aW9uLFxuXHRzbyBldmVudEJvb2xlYW4oLTEpIHdpbGwgYWN0dWFsbHkgc2V0IGl0IHRvIHRydWUgYmVjYXVzZVxuXHQoLTEpID8gdHJ1ZSA6IGZhbHNlIC0+IHRydWUgIVxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50Qm9vbGVhbiBleHRlbmRzIEV2ZW50VmFyaWFibGUge1xuXHRjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuXHRcdHN1cGVyKEJvb2xlYW4odmFsdWUpKTtcblx0fVxuXG5cdHNldCB2YWx1ZSAodmFsdWUpIHtcblx0XHRzdXBlci52YWx1ZSA9IEJvb2xlYW4odmFsdWUpO1xuXHR9XG5cdGdldCB2YWx1ZSAoKSB7cmV0dXJuIHN1cGVyLnZhbHVlfTtcbn1cblxuXG4vKlxuXHRtYWtlIGEgcHJvbWlzZSB3aGljaCBpcyByZXNvbHZlZCB3aGVuIEV2ZW50Qm9vbGVhbiBjaGFuZ2VzXG5cdHZhbHVlLlxuKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWtlUHJvbWlzZShldmVudE9iamVjdCwgY29uZGl0aW9uRnVuYykge1xuXHRjb25kaXRpb25GdW5jID0gY29uZGl0aW9uRnVuYyB8fCBmdW5jdGlvbih2YWwpIHtyZXR1cm4gdmFsID09IHRydWV9O1xuXHRyZXR1cm4gbmV3IFByb21pc2UgKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0XHRsZXQgc3ViID0gZXZlbnRPYmplY3Qub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKHZhbHVlKSB7XG5cdFx0XHRpZiAoY29uZGl0aW9uRnVuYyh2YWx1ZSkpIHtcblx0XHRcdFx0cmVzb2x2ZSh2YWx1ZSk7XG5cdFx0XHRcdGV2ZW50T2JqZWN0Lm9mZihzdWIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcbn07XG5cbi8vIG1vZHVsZSBhcGlcbmV4cG9ydCBkZWZhdWx0IHtcblx0ZXZlbnRpZnlQcm90b3R5cGUsXG5cdGV2ZW50aWZ5SW5zdGFuY2UsXG5cdEV2ZW50VmFyaWFibGUsXG5cdEV2ZW50Qm9vbGVhbixcblx0bWFrZVByb21pc2Vcbn07XG5cbiIsIlxuLy8gb3Z2ZXJyaWRlIG1vZHVsbyB0byBiZWhhdmUgYmV0dGVyIGZvciBuZWdhdGl2ZSBudW1iZXJzXG5leHBvcnQgZnVuY3Rpb24gbW9kKG4sIG0pIHtcbiAgICByZXR1cm4gKChuICUgbSkgKyBtKSAlIG07XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZGl2bW9kKHgsIGJhc2UpIHtcbiAgICBsZXQgbiA9IE1hdGguZmxvb3IoeCAvIGJhc2UpXG4gICAgbGV0IHIgPSBtb2QoeCwgYmFzZSk7XG4gICAgcmV0dXJuIFtuLCByXTtcbn1cblxuXG4vKlxuICAgIHNpbWlsYXIgdG8gcmFuZ2UgZnVuY3Rpb24gaW4gcHl0aG9uXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gcmFuZ2UgKHN0YXJ0LCBlbmQsIHN0ZXAgPSAxLCBvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgY29uc3Qge2luY2x1ZGVfZW5kPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgaWYgKHN0ZXAgPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTdGVwIGNhbm5vdCBiZSB6ZXJvLicpO1xuICAgIH1cbiAgICBpZiAoc3RhcnQgPCBlbmQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IHN0ZXApIHtcbiAgICAgICAgICByZXN1bHQucHVzaChpKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RhcnQgPiBlbmQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpID4gZW5kOyBpIC09IHN0ZXApIHtcbiAgICAgICAgICByZXN1bHQucHVzaChpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoaW5jbHVkZV9lbmQpIHtcbiAgICAgICAgcmVzdWx0LnB1c2goZW5kKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuXG5cbi8qXG4gICAgVGhpcyBhZGRzIGJhc2ljIChzeW5jaHJvbm91cykgY2FsbGJhY2sgc3VwcG9ydCB0byBhbiBvYmplY3QuXG4qL1xuXG5leHBvcnQgY29uc3QgY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICBmdW5jdGlvbiBhZGRUb0luc3RhbmNlKG9iamVjdCkge1xuICAgICAgICBvYmplY3QuX19jYWxsYmFja19jYWxsYmFja3MgPSBbXTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRfY2FsbGJhY2sgKGhhbmRsZXIpIHtcbiAgICAgICAgbGV0IGhhbmRsZSA9IHtcbiAgICAgICAgICAgIGhhbmRsZXI6IGhhbmRsZXJcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9fY2FsbGJhY2tfY2FsbGJhY2tzLnB1c2goaGFuZGxlKTtcbiAgICAgICAgcmV0dXJuIGhhbmRsZTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gcmVtb3ZlX2NhbGxiYWNrIChoYW5kbGUpIHtcbiAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5fX2NhbGxiYWNrX2NhbGxiYWNrcy5pbmRleG9mKGhhbmRsZSk7XG4gICAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgICAgICB0aGlzLl9fY2FsbGJhY2tfY2FsbGJhY2tzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gbm90aWZ5X2NhbGxiYWNrcyAoZUFyZykge1xuICAgICAgICB0aGlzLl9fY2FsbGJhY2tfY2FsbGJhY2tzLmZvckVhY2goZnVuY3Rpb24oaGFuZGxlKSB7XG4gICAgICAgICAgICBoYW5kbGUuaGFuZGxlcihlQXJnKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuXG4gICAgZnVuY3Rpb24gYWRkVG9Qcm90b3R5cGUgKF9wcm90b3R5cGUpIHtcbiAgICAgICAgY29uc3QgYXBpID0ge1xuICAgICAgICAgICAgYWRkX2NhbGxiYWNrLCByZW1vdmVfY2FsbGJhY2ssIG5vdGlmeV9jYWxsYmFja3NcbiAgICAgICAgfVxuICAgICAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHthZGRUb0luc3RhbmNlLCBhZGRUb1Byb3RvdHlwZX1cbn0oKTtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTT1VSQ0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogRXh0ZW5kIGEgY2xhc3Mgd2l0aCBzdXBwb3J0IGZvciBleHRlcm5hbCBzb3VyY2Ugb24gXG4gKiBhIG5hbWVkIHByb3BlcnR5LlxuICogXG4gKiBvcHRpb246IG11dGFibGU6dHJ1ZSBtZWFucyB0aGF0IHByb3BlcnkgbWF5IGJlIHJlc2V0IFxuICogXG4gKiBzb3VyY2Ugb2JqZWN0IGlzIGFzc3VtZWQgdG8gc3VwcG9ydCB0aGUgY2FsbGJhY2sgaW50ZXJmYWNlXG4gKi9cblxuXG5leHBvcnQgY29uc3Qgc291cmNlID0gZnVuY3Rpb24gKCkge1xuXG4gICAgZnVuY3Rpb24gcHJvcG5hbWVzIChwcm9wTmFtZSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcHJvcDogYF9fJHtwcm9wTmFtZX1gLFxuICAgICAgICAgICAgaW5pdDogYF9fJHtwcm9wTmFtZX1faW5pdGAsXG4gICAgICAgICAgICBoYW5kbGU6IGBfXyR7cHJvcE5hbWV9X2hhbmRsZWAsXG4gICAgICAgICAgICBjaGFuZ2U6IGBfXyR7cHJvcE5hbWV9X2hhbmRsZV9jaGFuZ2VgLFxuICAgICAgICAgICAgZGV0YXRjaDogYF9fJHtwcm9wTmFtZX1fZGV0YXRjaGAsXG4gICAgICAgICAgICBhdHRhdGNoOiBgX18ke3Byb3BOYW1lfV9hdHRhdGNoYCxcbiAgICAgICAgICAgIGNoZWNrOiBgX18ke3Byb3BOYW1lfV9jaGVja2BcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2UgKG9iamVjdCwgcHJvcE5hbWUpIHtcbiAgICAgICAgY29uc3QgcCA9IHByb3BuYW1lcyhwcm9wTmFtZSlcbiAgICAgICAgb2JqZWN0W3AucHJvcF0gPSB1bmRlZmluZWRcbiAgICAgICAgb2JqZWN0W3AuaW5pdF0gPSBmYWxzZTtcbiAgICAgICAgb2JqZWN0W3AuaGFuZGxlXSA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSwgcHJvcE5hbWUsIG9wdGlvbnM9e30pIHtcblxuICAgICAgICBjb25zdCBwID0gcHJvcG5hbWVzKHByb3BOYW1lKVxuXG4gICAgICAgIGZ1bmN0aW9uIGRldGF0Y2goKSB7XG4gICAgICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIHNvdXJjZSBjaGFuZ2UgZXZlbnRcbiAgICAgICAgICAgIGxldCB7bXV0YWJsZT1mYWxzZX0gPSBvcHRpb25zO1xuICAgICAgICAgICAgaWYgKG11dGFibGUgJiYgdGhpc1twLnByb3BdKSB7XG4gICAgICAgICAgICAgICAgbGV0IGhhbmRsZSA9IHRoaXNbcC5oYW5kbGVdO1xuICAgICAgICAgICAgICAgIHRoaXNbcC5wcm9wXS5yZW1vdmVfY2FsbGJhY2soaGFuZGxlKTtcbiAgICAgICAgICAgICAgICB0aGlzW3AuaGFuZGxlXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXNbcC5wcm9wXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICBmdW5jdGlvbiBhdHRhdGNoKHNvdXJjZSkge1xuICAgICAgICAgICAgbGV0IHttdXRhYmxlPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgICAgICAgICBpZiAoIXRoaXNbcC5pbml0XSB8fCBtdXRhYmxlKSB7XG4gICAgICAgICAgICAgICAgdGhpc1twLnByb3BdID0gc291cmNlO1xuICAgICAgICAgICAgICAgIHRoaXNbcC5pbml0XSA9IHRydWU7XG4gICAgICAgICAgICAgICAgLy8gc3Vic2NyaWJlIHRvIGNhbGxiYWNrIGZyb20gc291cmNlXG4gICAgICAgICAgICAgICAgaWYgKHRoaXNbcC5jaGFuZ2VdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSB0aGlzW3AuY2hhbmdlXS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzW3AuaGFuZGxlXSA9IHNvdXJjZS5hZGRfY2FsbGJhY2soaGFuZGxlcik7XG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZXIoKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7cHJvcE5hbWV9IGNhbiBub3QgYmUgcmVhc3NpZ25lZGApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFxuICAgICAgICAgKiBvYmplY3QgbXVzdCBpbXBsZW1lbnRcbiAgICAgICAgICogX197cHJvcE5hbWV9X2hhbmRsZV9jaGFuZ2UoKSB7fVxuICAgICAgICAgKiBcbiAgICAgICAgICogb2JqZWN0IGNhbiBpbXBsZW1lbnRcbiAgICAgICAgICogX197cHJvcE5hbWV9X2NoZWNrKHNvdXJjZSkge31cbiAgICAgICAgICovXG5cbiAgICAgICAgLy8gZ2V0dGVyIGFuZCBzZXR0ZXJcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KF9wcm90b3R5cGUsIHByb3BOYW1lLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpc1twLnByb3BdO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHNyYykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzW3AuY2hlY2tdKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXNbcC5jaGVja10oc3JjKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc3JjICE9IHRoaXNbcC5wcm9wXSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzW3AuZGV0YXRjaF0oKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1twLmF0dGF0Y2hdKHNyYyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGFwaSA9IHt9O1xuICAgICAgICBhcGlbcC5kZXRhdGNoXSA9IGRldGF0Y2g7XG4gICAgICAgIGFwaVtwLmF0dGF0Y2hdID0gYXR0YXRjaDtcblxuICAgICAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG4gICAgfVxuICAgIHJldHVybiB7YWRkVG9JbnN0YW5jZSwgYWRkVG9Qcm90b3R5cGV9O1xufSgpO1xuXG4iLCJpbXBvcnQge2Rpdm1vZH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuXG4vKlxuICAgIFRpbWVvdXQgTW9uaXRvclxuXG4gICAgVGltZW91dCBNb25pdG9yIGlzIHNpbWlsYXIgdG8gc2V0SW50ZXJ2YWwsIGluIHRoZSBzZW5zZSB0aGF0IFxuICAgIGl0IGFsbG93cyBjYWxsYmFja3MgdG8gYmUgZmlyZWQgcGVyaW9kaWNhbGx5IFxuICAgIHdpdGggYSBnaXZlbiBkZWxheSAoaW4gbWlsbGlzKS4gIFxuICAgIFxuICAgIFRpbWVvdXQgTW9uaXRvciBpcyBtYWRlIHRvIHNhbXBsZSB0aGUgc3RhdGUgXG4gICAgb2YgYSBkeW5hbWljIG9iamVjdCwgcGVyaW9kaWNhbGx5LiBGb3IgdGhpcyByZWFzb24sIGVhY2ggY2FsbGJhY2sgaXMgXG4gICAgYm91bmQgdG8gYSBtb25pdG9yZWQgb2JqZWN0LCB3aGljaCB3ZSBoZXJlIGNhbGwgYSB2YXJpYWJsZS4gXG4gICAgT24gZWFjaCBpbnZvY2F0aW9uLCBhIGNhbGxiYWNrIHdpbGwgcHJvdmlkZSBhIGZyZXNobHkgc2FtcGxlZCBcbiAgICB2YWx1ZSBmcm9tIHRoZSB2YXJpYWJsZS5cblxuICAgIFRoaXMgdmFsdWUgaXMgYXNzdW1lZCB0byBiZSBhdmFpbGFibGUgYnkgcXVlcnlpbmcgdGhlIHZhcmlhYmxlLiBcblxuICAgICAgICB2LnF1ZXJ5KCkgLT4ge3ZhbHVlLCBkeW5hbWljLCBvZmZzZXQsIHRzfVxuXG4gICAgSW4gYWRkaXRpb24sIHRoZSB2YXJpYWJsZSBvYmplY3QgbWF5IHN3aXRjaCBiYWNrIGFuZCBcbiAgICBmb3J0aCBiZXR3ZWVuIGR5bmFtaWMgYW5kIHN0YXRpYyBiZWhhdmlvci4gVGhlIFRpbWVvdXQgTW9uaXRvclxuICAgIHR1cm5zIHBvbGxpbmcgb2ZmIHdoZW4gdGhlIHZhcmlhYmxlIGlzIG5vIGxvbmdlciBkeW5hbWljLCBcbiAgICBhbmQgcmVzdW1lcyBwb2xsaW5nIHdoZW4gdGhlIG9iamVjdCBiZWNvbWVzIGR5bmFtaWMuXG5cbiAgICBTdGF0ZSBjaGFuZ2VzIGFyZSBleHBlY3RlZCB0byBiZSBzaWduYWxsZWQgdGhyb3VnaCBhIDxjaGFuZ2U+IGV2ZW50LlxuXG4gICAgICAgIHN1YiA9IHYub24oXCJjaGFuZ2VcIiwgY2FsbGJhY2spXG4gICAgICAgIHYub2ZmKHN1YilcblxuICAgIENhbGxiYWNrcyBhcmUgaW52b2tlZCBvbiBldmVyeSA8Y2hhbmdlPiBldmVudCwgYXMgd2VsbFxuICAgIGFzIHBlcmlvZGljYWxseSB3aGVuIHRoZSBvYmplY3QgaXMgaW4gPGR5bmFtaWM+IHN0YXRlLlxuXG4gICAgICAgIGNhbGxiYWNrKHt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0LCB0c30pXG5cbiAgICBGdXJ0aGVybW9yZSwgaW4gb3JkZXIgdG8gc3VwcG9ydCBjb25zaXN0ZW50IHJlbmRlcmluZyBvZlxuICAgIHN0YXRlIGNoYW5nZXMgZnJvbSBtYW55IGR5bmFtaWMgdmFyaWFibGVzLCBpdCBpcyBpbXBvcnRhbnQgdGhhdFxuICAgIGNhbGxiYWNrcyBhcmUgaW52b2tlZCBhdCB0aGUgc2FtZSB0aW1lIGFzIG11Y2ggYXMgcG9zc2libGUsIHNvXG4gICAgdGhhdCBjaGFuZ2VzIHRoYXQgb2NjdXIgbmVhciBpbiB0aW1lIGNhbiBiZSBwYXJ0IG9mIHRoZSBzYW1lXG4gICAgc2NyZWVuIHJlZnJlc2guIFxuXG4gICAgRm9yIHRoaXMgcmVhc29uLCB0aGUgVGltZW91dE1vbml0b3IgZ3JvdXBzIGNhbGxiYWNrcyBpbiB0aW1lXG4gICAgYW5kIGludm9rZXMgY2FsbGJhY2tzIGF0IGF0IGZpeGVkIG1heGltdW0gcmF0ZSAoMjBIei81MG1zKS5cbiAgICBUaGlzIGltcGxpZXMgdGhhdCBwb2xsaW5nIGNhbGxiYWNrcyB3aWxsIGZhbGwgb24gYSBzaGFyZWQgXG4gICAgcG9sbGluZyBmcmVxdWVuY3kuXG5cbiAgICBBdCB0aGUgc2FtZSB0aW1lLCBjYWxsYmFja3MgbWF5IGhhdmUgaW5kaXZpZHVhbCBmcmVxdWVuY2llcyB0aGF0XG4gICAgYXJlIG11Y2ggbG93ZXIgcmF0ZSB0aGFuIHRoZSBtYXhpbXVtIHJhdGUuIFRoZSBpbXBsZW1lbnRhdGlvblxuICAgIGRvZXMgbm90IHJlbHkgb24gYSBmaXhlZCA1MG1zIHRpbWVvdXQgZnJlcXVlbmN5LCBidXQgaXMgdGltZW91dCBiYXNlZCxcbiAgICB0aHVzIHRoZXJlIGlzIG5vIHByb2Nlc3Npbmcgb3IgdGltZW91dCBiZXR3ZWVuIGNhbGxiYWNrcywgZXZlblxuICAgIGlmIGFsbCBjYWxsYmFja3MgaGF2ZSBsb3cgcmF0ZXMuXG5cbiAgICBJdCBpcyBzYWZlIHRvIGRlZmluZSBtdWx0aXBsZSBjYWxsYWJhY2tzIGZvciBhIHNpbmdsZSB2YXJpYWJsZSwgZWFjaFxuICAgIGNhbGxiYWNrIHdpdGggYSBkaWZmZXJlbnQgcG9sbGluZyBmcmVxdWVuY3kuXG5cbiAgICBvcHRpb25zXG4gICAgICAgIDxyYXRlPiAtIGRlZmF1bHQgNTA6IHNwZWNpZnkgbWluaW11bSBmcmVxdWVuY3kgaW4gbXNcblxuKi9cblxuXG5jb25zdCBSQVRFX01TID0gNTBcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVElNRU9VVCBNT05JVE9SXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgQmFzZSBjbGFzcyBmb3IgVGltZW91dCBNb25pdG9yIGFuZCBGcmFtZXJhdGUgTW9uaXRvclxuKi9cblxuY2xhc3MgVGltZW91dE1vbml0b3Ige1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuXG4gICAgICAgIHRoaXMuX29wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtyYXRlOiBSQVRFX01TfSwgb3B0aW9ucyk7XG4gICAgICAgIGlmICh0aGlzLl9vcHRpb25zLnJhdGUgPCBSQVRFX01TKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlsbGVnYWwgcmF0ZSAke3JhdGV9LCBtaW5pbXVtIHJhdGUgaXMgJHtSQVRFX01TfWApO1xuICAgICAgICB9XG4gICAgICAgIC8qXG4gICAgICAgICAgICBtYXBcbiAgICAgICAgICAgIGhhbmRsZSAtPiB7Y2FsbGJhY2ssIHZhcmlhYmxlLCBkZWxheX1cbiAgICAgICAgICAgIC0gdmFyaWFibGU6IHRhcmdldCBmb3Igc2FtcGxpbmdcbiAgICAgICAgICAgIC0gY2FsbGJhY2s6IGZ1bmN0aW9uKHZhbHVlKVxuICAgICAgICAgICAgLSBkZWxheTogYmV0d2VlbiBzYW1wbGVzICh3aGVuIHZhcmlhYmxlIGlzIGR5bmFtaWMpXG4gICAgICAgICovXG4gICAgICAgIHRoaXMuX3NldCA9IG5ldyBTZXQoKTtcbiAgICAgICAgLypcbiAgICAgICAgICAgIHZhcmlhYmxlIG1hcFxuICAgICAgICAgICAgdmFyaWFibGUgLT4ge3N1YiwgcG9sbGluZywgaGFuZGxlczpbXX1cbiAgICAgICAgICAgIC0gc3ViIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICAgICAgICAgLSBwb2xsaW5nOiB0cnVlIGlmIHZhcmlhYmxlIG5lZWRzIHBvbGxpbmdcbiAgICAgICAgICAgIC0gaGFuZGxlczogbGlzdCBvZiBoYW5kbGVzIGFzc29jaWF0ZWQgd2l0aCB2YXJpYWJsZVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIC8vIHZhcmlhYmxlIGNoYW5nZSBoYW5kbGVyXG4gICAgICAgIHRoaXMuX19vbnZhcmlhYmxlY2hhbmdlID0gdGhpcy5fb252YXJpYWJsZWNoYW5nZS5iaW5kKHRoaXMpO1xuICAgIH1cblxuICAgIGJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgICAgICAvLyByZWdpc3RlciBiaW5kaW5nXG4gICAgICAgIGxldCBoYW5kbGUgPSB7Y2FsbGJhY2ssIHZhcmlhYmxlLCBkZWxheX07XG4gICAgICAgIHRoaXMuX3NldC5hZGQoaGFuZGxlKTtcbiAgICAgICAgLy8gcmVnaXN0ZXIgdmFyaWFibGVcbiAgICAgICAgaWYgKCF0aGlzLl92YXJpYWJsZV9tYXAuaGFzKHZhcmlhYmxlKSkge1xuICAgICAgICAgICAgbGV0IHN1YiA9IHZhcmlhYmxlLm9uKFwiY2hhbmdlXCIsIHRoaXMuX19vbnZhcmlhYmxlY2hhbmdlKTtcbiAgICAgICAgICAgIGxldCBpdGVtID0ge3N1YiwgcG9sbGluZzpmYWxzZSwgaGFuZGxlczogW2hhbmRsZV19O1xuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLnNldCh2YXJpYWJsZSwgaXRlbSk7XG4gICAgICAgICAgICAvL3RoaXMuX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKS5oYW5kbGVzLnB1c2goaGFuZGxlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaGFuZGxlO1xuICAgIH1cblxuICAgIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgICAgIC8vIGNsZWFudXBcbiAgICAgICAgbGV0IHJlbW92ZWQgPSB0aGlzLl9zZXQuZGVsZXRlKGhhbmRsZSk7XG4gICAgICAgIGlmICghcmVtb3ZlZCkgcmV0dXJuO1xuICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjbGVhbnVwIHZhcmlhYmxlIG1hcFxuICAgICAgICBsZXQgdmFyaWFibGUgPSBoYW5kbGUudmFyaWFibGU7XG4gICAgICAgIGxldCB7c3ViLCBoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQgaWR4ID0gaGFuZGxlcy5pbmRleE9mKGhhbmRsZSk7XG4gICAgICAgIGlmIChpZHggPiAtMSkge1xuICAgICAgICAgICAgaGFuZGxlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGFuZGxlcy5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgLy8gdmFyaWFibGUgaGFzIG5vIGhhbmRsZXNcbiAgICAgICAgICAgIC8vIGNsZWFudXAgdmFyaWFibGUgbWFwXG4gICAgICAgICAgICB0aGlzLl92YXJpYWJsZV9tYXAuZGVsZXRlKHZhcmlhYmxlKTtcbiAgICAgICAgICAgIHZhcmlhYmxlLm9mZihzdWIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgdmFyaWFibGUgZW1pdHMgYSBjaGFuZ2UgZXZlbnRcbiAgICAqL1xuICAgIF9vbnZhcmlhYmxlY2hhbmdlIChlQXJnLCBlSW5mbykge1xuICAgICAgICBsZXQgdmFyaWFibGUgPSBlSW5mby5zcmM7XG4gICAgICAgIC8vIGRpcmVjdCBjYWxsYmFjayAtIGNvdWxkIHVzZSBlQXJnIGhlcmVcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQgc3RhdGUgPSBlQXJnO1xuICAgICAgICAvLyByZWV2YWx1YXRlIHBvbGxpbmdcbiAgICAgICAgdGhpcy5fcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlLCBzdGF0ZSk7XG4gICAgICAgIC8vIGNhbGxiYWNrc1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHN0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHN0YXJ0IG9yIHN0b3AgcG9sbGluZyBpZiBuZWVkZWRcbiAgICAqL1xuICAgIF9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUsIHN0YXRlKSB7XG4gICAgICAgIGxldCBpdGVtID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGxldCB7cG9sbGluZzp3YXNfcG9sbGluZ30gPSBpdGVtO1xuICAgICAgICBzdGF0ZSA9IHN0YXRlIHx8IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgIGxldCBzaG91bGRfYmVfcG9sbGluZyA9IHN0YXRlLmR5bmFtaWM7XG4gICAgICAgIGlmICghd2FzX3BvbGxpbmcgJiYgc2hvdWxkX2JlX3BvbGxpbmcpIHtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dHModmFyaWFibGUpO1xuICAgICAgICB9IGVsc2UgaWYgKHdhc19wb2xsaW5nICYmICFzaG91bGRfYmVfcG9sbGluZykge1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBzZXQgdGltZW91dCBmb3IgYWxsIGNhbGxiYWNrcyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAqL1xuICAgIF9zZXRfdGltZW91dHModmFyaWFibGUpIHtcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9zZXRfdGltZW91dChoYW5kbGUpIHtcbiAgICAgICAgbGV0IGRlbHRhID0gdGhpcy5fY2FsY3VsYXRlX2RlbHRhKGhhbmRsZS5kZWxheSk7XG4gICAgICAgIGxldCBoYW5kbGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5faGFuZGxlX3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICBoYW5kbGUudGlkID0gc2V0VGltZW91dChoYW5kbGVyLCBkZWx0YSk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgYWRqdXN0IGRlbGF5IHNvIHRoYXQgaWYgZmFsbHMgb25cbiAgICAgICAgdGhlIG1haW4gdGljayByYXRlXG4gICAgKi9cbiAgICBfY2FsY3VsYXRlX2RlbHRhKGRlbGF5KSB7XG4gICAgICAgIGxldCByYXRlID0gdGhpcy5fb3B0aW9ucy5yYXRlO1xuICAgICAgICBsZXQgbm93ID0gTWF0aC5yb3VuZChwZXJmb3JtYW5jZS5ub3coKSk7XG4gICAgICAgIGxldCBbbm93X24sIG5vd19yXSA9IGRpdm1vZChub3csIHJhdGUpO1xuICAgICAgICBsZXQgW24sIHJdID0gZGl2bW9kKG5vdyArIGRlbGF5LCByYXRlKTtcbiAgICAgICAgbGV0IHRhcmdldCA9IE1hdGgubWF4KG4sIG5vd19uICsgMSkqcmF0ZTtcbiAgICAgICAgcmV0dXJuIHRhcmdldCAtIHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGNsZWFyIGFsbCB0aW1lb3V0cyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAqL1xuICAgIF9jbGVhcl90aW1lb3V0cyh2YXJpYWJsZSkge1xuICAgICAgICBsZXQge2hhbmRsZXN9ID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICBpZiAoaGFuZGxlLnRpZCAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoaGFuZGxlLnRpZCk7XG4gICAgICAgICAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGhhbmRsZSB0aW1lb3V0XG4gICAgKi9cbiAgICBfaGFuZGxlX3RpbWVvdXQoaGFuZGxlKSB7XG4gICAgICAgIC8vIGRyb3AgaWYgaGFuZGxlIHRpZCBoYXMgYmVlbiBjbGVhcmVkXG4gICAgICAgIGlmIChoYW5kbGUudGlkID09IHVuZGVmaW5lZCkgcmV0dXJuO1xuICAgICAgICBoYW5kbGUudGlkID0gdW5kZWZpbmVkO1xuICAgICAgICAvLyBjYWxsYmFja1xuICAgICAgICBsZXQge3ZhcmlhYmxlfSA9IGhhbmRsZTtcbiAgICAgICAgbGV0IHN0YXRlID0gdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgLy8gcmVzY2hlZHVsZSB0aW1lb3V0cyBmb3IgY2FsbGJhY2tzXG4gICAgICAgIGlmIChzdGF0ZS5keW5hbWljKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRfdGltZW91dChoYW5kbGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICBtYWtlIHN1cmUgcG9sbGluZyBzdGF0ZSBpcyBhbHNvIGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcyB3b3VsZCBvbmx5IG9jY3VyIGlmIHRoZSB2YXJpYWJsZVxuICAgICAgICAgICAgICAgIHdlbnQgZnJvbSByZXBvcnRpbmcgZHluYW1pYyB0cnVlIHRvIGR5bmFtaWMgZmFsc2UsXG4gICAgICAgICAgICAgICAgd2l0aG91dCBlbW1pdHRpbmcgYSBjaGFuZ2UgZXZlbnQgLSB0aHVzXG4gICAgICAgICAgICAgICAgdmlvbGF0aW5nIHRoZSBhc3N1bXB0aW9uLiBUaGlzIHByZXNlcnZlc1xuICAgICAgICAgICAgICAgIGludGVybmFsIGludGVncml0eSBpIHRoZSBtb25pdG9yLlxuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGxldCBpdGVtID0gdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSk7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICAvL1xuICAgICAgICBoYW5kbGUuY2FsbGJhY2soc3RhdGUpO1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBGUkFNRVJBVEUgTU9OSVRPUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5cbmNsYXNzIEZyYW1lcmF0ZU1vbml0b3IgZXh0ZW5kcyBUaW1lb3V0TW9uaXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgICB0aGlzLl9oYW5kbGU7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgdGltZW91dHMgYXJlIG9ic29sZXRlXG4gICAgKi9cbiAgICBfc2V0X3RpbWVvdXRzKHZhcmlhYmxlKSB7fVxuICAgIF9zZXRfdGltZW91dChoYW5kbGUpIHt9XG4gICAgX2NhbGN1bGF0ZV9kZWx0YShkZWxheSkge31cbiAgICBfY2xlYXJfdGltZW91dHModmFyaWFibGUpIHt9XG4gICAgX2hhbmRsZV90aW1lb3V0KGhhbmRsZSkge31cblxuICAgIF9vbnZhcmlhYmxlY2hhbmdlIChlQXJnLCBlSW5mbykge1xuICAgICAgICBzdXBlci5fb252YXJpYWJsZWNoYW5nZShlQXJnLCBlSW5mbyk7XG4gICAgICAgIC8vIGtpY2sgb2ZmIGNhbGxiYWNrIGxvb3AgZHJpdmVuIGJ5IHJlcXVlc3QgYW5pbWF0aW9uZnJhbWVcbiAgICAgICAgdGhpcy5fY2FsbGJhY2soKTtcbiAgICB9XG5cbiAgICBfY2FsbGJhY2soKSB7XG4gICAgICAgIC8vIGNhbGxiYWNrIHRvIGFsbCB2YXJpYWJsZXMgd2hpY2ggcmVxdWlyZSBwb2xsaW5nXG4gICAgICAgIGxldCB2YXJpYWJsZXMgPSBbLi4udGhpcy5fdmFyaWFibGVfbWFwLmVudHJpZXMoKV1cbiAgICAgICAgICAgIC5maWx0ZXIoKFt2YXJpYWJsZSwgaXRlbV0pID0+IGl0ZW0ucG9sbGluZylcbiAgICAgICAgICAgIC5tYXAoKFt2YXJpYWJsZSwgaXRlbV0pID0+IHZhcmlhYmxlKTtcbiAgICAgICAgaWYgKHZhcmlhYmxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBjYWxsYmFja1xuICAgICAgICAgICAgZm9yIChsZXQgdmFyaWFibGUgb2YgdmFyaWFibGVzKSB7XG4gICAgICAgICAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICAgICAgICAgIGxldCByZXMgPSB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGhhbmRsZSBvZiBoYW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGhhbmRsZS5jYWxsYmFjayhyZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8qIFxuICAgICAgICAgICAgICAgIHJlcXVlc3QgbmV4dCBjYWxsYmFjayBhcyBsb25nIGFzIGF0IGxlYXN0IG9uZSB2YXJpYWJsZSBcbiAgICAgICAgICAgICAgICBpcyByZXF1aXJpbmcgcG9sbGluZ1xuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSh0aGlzLl9jYWxsYmFjay5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQklORCBSRUxFQVNFXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmNvbnN0IG1vbml0b3IgPSBuZXcgVGltZW91dE1vbml0b3IoKTtcbmNvbnN0IGZyYW1lcmF0ZV9tb25pdG9yID0gbmV3IEZyYW1lcmF0ZU1vbml0b3IoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucz17fSkge1xuICAgIGxldCBoYW5kbGU7XG4gICAgaWYgKEJvb2xlYW4ocGFyc2VGbG9hdChkZWxheSkpKSB7XG4gICAgICAgIGhhbmRsZSA9IG1vbml0b3IuYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIFtcInRpbWVvdXRcIiwgaGFuZGxlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBoYW5kbGUgPSBmcmFtZXJhdGVfbW9uaXRvci5iaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgMCwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBbXCJmcmFtZXJhdGVcIiwgaGFuZGxlXTtcbiAgICB9XG59XG5leHBvcnQgZnVuY3Rpb24gcmVsZWFzZShoYW5kbGUpIHtcbiAgICBsZXQgW3R5cGUsIF9oYW5kbGVdID0gaGFuZGxlO1xuICAgIGlmICh0eXBlID09IFwidGltZW91dFwiKSB7XG4gICAgICAgIHJldHVybiBtb25pdG9yLnJlbGVhc2UoX2hhbmRsZSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwiZnJhbWVyYXRlXCIpIHtcbiAgICAgICAgcmV0dXJuIGZyYW1lcmF0ZV9tb25pdG9yLnJlbGVhc2UoX2hhbmRsZSk7XG4gICAgfVxufVxuXG4iLCJpbXBvcnQgeyBldmVudGlmeSB9IGZyb20gXCIuL2V2ZW50aWZ5LmpzXCI7XG5pbXBvcnQgeyBjYWxsYmFjayB9IGZyb20gXCIuL3V0aWwuanNcIjtcbmltcG9ydCB7IGJpbmQsIHJlbGVhc2UgfSBmcm9tIFwiLi9tb25pdG9yLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIFNUQVRFIFBST1ZJREVSIEJBU0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgQmFzZSBjbGFzcyBmb3IgYWxsIHN0YXRlIHByb3ZpZGVyc1xuXG4gICAgLSBvYmplY3Qgd2l0aCBjb2xsZWN0aW9uIG9mIGl0ZW1zXG4gICAgLSBjb3VsZCBiZSBsb2NhbCAtIG9yIHByb3h5IHRvIG9ubGluZSBzb3VyY2VcblxuICAgIHJlcHJlc2VudHMgYSBkeW5hbWljIGNvbGxlY3Rpb24gb2YgaXRlbXNcbiAgICB7aXR2LCB0eXBlLCAuLi5kYXRhfVxuKi9cblxuZXhwb3J0IGNsYXNzIFN0YXRlUHJvdmlkZXJCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBjYWxsYmFjay5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgIH1cblxuICAgIC8vIHB1YmxpYyB1cGRhdGUgZnVuY3Rpb25cbiAgICB1cGRhdGUoaXRlbXMpe1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fdXBkYXRlKGl0ZW1zKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIGhhbmRsZV91cGRhdGUoaXRlbXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIGdldCBpdGVtcygpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKFN0YXRlUHJvdmlkZXJCYXNlLnByb3RvdHlwZSk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTEFZRVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIExheWVyQmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFFVRVJZXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBxdWVyeSAob2Zmc2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShMYXllckJhc2UucHJvdG90eXBlKTtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBDVVJTT1IgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIEN1cnNvckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgICBjYWxsYmFjay5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICAvLyBkZWZpbmUgY2hhbmdlIGV2ZW50XG4gICAgICAgIGV2ZW50aWZ5LmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlEZWZpbmUoXCJjaGFuZ2VcIiwge2luaXQ6dHJ1ZX0pO1xuICAgIH1cbiAgICBcbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIFFVRVJZXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBxdWVyeSAoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBFdmVudGlmeTogaW1tZWRpYXRlIGV2ZW50c1xuICAgICovXG4gICAgZXZlbnRpZnlJbml0RXZlbnRBcmdzKG5hbWUpIHtcbiAgICAgICAgaWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuICAgICAgICAgICAgcmV0dXJuIFt0aGlzLnF1ZXJ5KCldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBCSU5EIFJFTEVBU0UgKGNvbnZlbmllbmNlKVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgYmluZChjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICAgICAgcmV0dXJuIGJpbmQodGhpcywgY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zKTtcbiAgICB9XG4gICAgcmVsZWFzZShoYW5kbGUpIHtcbiAgICAgICAgcmV0dXJuIHJlbGVhc2UoaGFuZGxlKTtcbiAgICB9XG5cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKEN1cnNvckJhc2UucHJvdG90eXBlKTtcbmV2ZW50aWZ5LmFkZFRvUHJvdG90eXBlKEN1cnNvckJhc2UucHJvdG90eXBlKTtcblxuIiwiaW1wb3J0IHtTdGF0ZVByb3ZpZGVyQmFzZX0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7ZW5kcG9pbnR9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU0lNUExFIFNUQVRFIFBST1ZJREVSIChMT0NBTClcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMb2NhbCBBcnJheSB3aXRoIG5vbiBvdmVybGFwcGluZyBpdGVtcy5cbiAqL1xuXG5leHBvcnQgY2xhc3MgU2ltcGxlU3RhdGVQcm92aWRlciBleHRlbmRzIFN0YXRlUHJvdmlkZXJCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5faXRlbXMgPSBbXTtcbiAgICAgICAgbGV0IHtpdGVtc30gPSBvcHRpb25zO1xuICAgICAgICBpZiAoaXRlbXMpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlX3VwZGF0ZShpdGVtcyk7ICBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGludGVybmFsIHVwZGF0ZSBmdW5jdGlvblxuICAgIF91cGRhdGUgKGl0ZW1zKSB7XG4gICAgICAgIHRoaXMuX2l0ZW1zID0gY2hlY2tfaW5wdXQoaXRlbXMpO1xuICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICB9XG5cbiAgICBnZXQgaXRlbXMgKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXRlbXM7XG4gICAgfVxuXG4gICAgZ2V0IGluZm8gKCkge1xuICAgICAgICByZXR1cm4ge2R5bmFtaWM6IHRydWUsIG92ZXJsYXBwaW5nOiBmYWxzZSwgbG9jYWw6dHJ1ZX07XG4gICAgfVxufVxuXG5cbmZ1bmN0aW9uIGNoZWNrX2lucHV0KGl0ZW1zKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnB1dCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgIH1cbiAgICAvLyBzb3J0IGl0ZW1zIGJhc2VkIG9uIGludGVydmFsIGxvdyBlbmRwb2ludFxuICAgIGl0ZW1zLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgbGV0IGFfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChhLml0dilbMF07XG4gICAgICAgIGxldCBiX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYi5pdHYpWzBdO1xuICAgICAgICByZXR1cm4gZW5kcG9pbnQuY21wKGFfbG93LCBiX2xvdyk7XG4gICAgfSk7XG4gICAgLy8gY2hlY2sgdGhhdCBpdGVtIGludGVydmFscyBhcmUgbm9uLW92ZXJsYXBwaW5nXG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBsZXQgcHJldl9oaWdoID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpIC0gMV0uaXR2KVsxXTtcbiAgICAgICAgbGV0IGN1cnJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtc1tpXS5pdHYpWzBdO1xuICAgICAgICAvLyB2ZXJpZnkgdGhhdCBwcmV2IGhpZ2ggaXMgbGVzcyB0aGF0IGN1cnIgbG93XG4gICAgICAgIGlmICghZW5kcG9pbnQubHQocHJldl9oaWdoLCBjdXJyX2xvdykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk92ZXJsYXBwaW5nIGludGVydmFscyBmb3VuZFwiKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaXRlbXM7XG59XG5cbiIsImltcG9ydCB7IGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgKiBhcyBzZWdtZW50IGZyb20gXCIuL3NlZ21lbnRzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBORUFSQlkgQ0FDSEVcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBUaGlzIGltcGxlbWVudHMgYSBjYWNoZSBpbiBmcm9udCBvZiBhIE5lYXJieUluZGV4LlxuICAgIFxuICAgIFRoZSBwdXJwb3NlIG9mIGNhY2hpbmcgaXMgdG8gb3B0aW1pemUgZm9yIHJlcGVhdGVkXG4gICAgcXVlcmllcyB0byBhIE5lYXJieUluZGV4IHRvIG5lYXJieSBvZmZzZXRzLlxuXG4gICAgVGhlIGNhY2hlIHN0YXRlIGluY2x1ZGVzIHRoZSBuZWFyYnkgc3RhdGUgZnJvbSB0aGUgXG4gICAgaW5kZXgsIGFuZCBhbHNvIHRoZSBjYWNoZWQgc2VnbWVudHMgY29ycmVzcG9uZGluZ1xuICAgIHRvIHRoYXQgc3RhdGUuIFRoaXMgd2F5LCBvbiBhIGNhY2hlIGhpdCwgdGhlIFxuICAgIHF1ZXJ5IG1heSBiZSBzYXRpc2ZpZWQgZGlyZWN0bHkgZnJvbSB0aGUgY2FjaGUuXG5cbiAgICBUaGUgY2FjaGUgaXMgbWFya2VkIGFzIGRpcnR5IHdoZW4gdGhlIE5lYXJieSBpbmRleGVzIGNoYW5nZXMuXG4qL1xuXG5leHBvcnQgY2xhc3MgTmVhcmJ5Q2FjaGUge1xuXG4gICAgY29uc3RydWN0b3IgKG5lYXJieUluZGV4KSB7XG4gICAgICAgIC8vIG5lYXJieSBpbmRleFxuICAgICAgICB0aGlzLl9pbmRleCA9IG5lYXJieUluZGV4O1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IG9iamVjdFxuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhY2hlZCBzZWdtZW50XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGRpcnR5IGZsYWdcbiAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgQWNjZXNzb3JzIGZvciBDYWNoZSBzdGF0ZVxuICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBcbiAgICBnZXQgbmVhcmJ5ICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX25lYXJieTtcbiAgICB9XG5cbiAgICBsb2FkX3NlZ21lbnQgKCkge1xuICAgICAgICAvLyBsYXp5IGxvYWQgc2VnbWVudFxuICAgICAgICBpZiAodGhpcy5fbmVhcmJ5ICYmICF0aGlzLl9zZWdtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9zZWdtZW50ID0gbG9hZF9zZWdtZW50KHRoaXMuX25lYXJieSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3NlZ21lbnRcbiAgICB9XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgICAgRGlydHkgQ2FjaGVcbiAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBkaXJ0eSgpIHtcbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAgICBSZWZyZXNoIENhY2hlXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgLypcbiAgICAgICAgcmVmcmVzaCBpZiBuZWNlc3NhcnkgLSBlbHNlIE5PT1BcbiAgICAgICAgLSBpZiBuZWFyYnkgaXMgbm90IGRlZmluZWRcbiAgICAgICAgLSBpZiBvZmZzZXQgaXMgb3V0c2lkZSBuZWFyYnkuaXR2XG4gICAgICAgIC0gaWYgY2FjaGUgaXMgZGlydHlcbiAgICAqL1xuICAgIHJlZnJlc2ggKG9mZnNldCkge1xuICAgICAgICBpZiAodHlwZW9mIG9mZnNldCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIG9mZnNldCA9IFtvZmZzZXQsIDBdO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9uZWFyYnkgPT0gdW5kZWZpbmVkIHx8IHRoaXMuX2RpcnR5KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVmcmVzaChvZmZzZXQpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KHRoaXMuX25lYXJieS5pdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWZyZXNoKG9mZnNldClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX3JlZnJlc2ggKG9mZnNldCkge1xuICAgICAgICB0aGlzLl9uZWFyYnkgPSB0aGlzLl9pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgIFF1ZXJ5IENhY2hlXG4gICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChvZmZzZXQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjYWNoZSBxdWVyeSBvZmZzZXQgY2Fubm90IGJlIHVuZGVmaW5lZFwiKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVmcmVzaChvZmZzZXQpO1xuICAgICAgICBpZiAoIXRoaXMuX3NlZ21lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3NlZ21lbnQgPSBsb2FkX3NlZ21lbnQodGhpcy5fbmVhcmJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fc2VnbWVudC5xdWVyeShvZmZzZXQpO1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0FEIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gY3JlYXRlX3NlZ21lbnQoaXR2LCB0eXBlLCBhcmdzKSB7XG4gICAgaWYgKHR5cGUgPT0gXCJzdGF0aWNcIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuU3RhdGljU2VnbWVudChpdHYsIGFyZ3MpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuVHJhbnNpdGlvblNlZ21lbnQoaXR2LCBhcmdzKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJpbnRlcnBvbGF0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LkludGVycG9sYXRpb25TZWdtZW50KGl0diwgYXJncyk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwibW90aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50Lk1vdGlvblNlZ21lbnQoaXR2LCBhcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhcInVucmVjb2duaXplZCBzZWdtZW50IHR5cGVcIiwgdHlwZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBsb2FkX3NlZ21lbnQobmVhcmJ5KSB7XG4gICAgbGV0IHtpdHYsIGNlbnRlcn0gPSBuZWFyYnk7XG4gICAgaWYgKGNlbnRlci5sZW5ndGggPT0gMCkge1xuICAgICAgICByZXR1cm4gY3JlYXRlX3NlZ21lbnQoaXR2LCBcInN0YXRpY1wiLCB7dmFsdWU6dW5kZWZpbmVkfSk7XG4gICAgfVxuICAgIGlmIChjZW50ZXIubGVuZ3RoID09IDEpIHtcbiAgICAgICAgbGV0IHt0eXBlPVwic3RhdGljXCIsIGFyZ3N9ID0gY2VudGVyWzBdO1xuICAgICAgICByZXR1cm4gY3JlYXRlX3NlZ21lbnQoaXR2LCB0eXBlLCBhcmdzKTtcbiAgICB9XG4gICAgaWYgKGNlbnRlci5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkxpc3RTZWdtZW50cyBub3QgeWV0IHN1cHBvcnRlZFwiKTtcbiAgICB9XG59XG4iLCJpbXBvcnQge2VuZHBvaW50fSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7cmFuZ2V9IGZyb20gXCIuL3V0aWwuanNcIjtcbmltcG9ydCB7TmVhcmJ5Q2FjaGV9IGZyb20gXCIuL25lYXJieWNhY2hlLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBORUFSQlkgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBBYnN0cmFjdCBzdXBlcmNsYXNzIGZvciBOZWFyYnlJbmRleGUuXG4gKiBcbiAqIFN1cGVyY2xhc3MgdXNlZCB0byBjaGVjayB0aGF0IGEgY2xhc3MgaW1wbGVtZW50cyB0aGUgbmVhcmJ5KCkgbWV0aG9kLCBcbiAqIGFuZCBwcm92aWRlIHNvbWUgY29udmVuaWVuY2UgbWV0aG9kcy5cbiAqIFxuICogTkVBUkJZIElOREVYXG4gKiBcbiAqIE5lYXJieUluZGV4IHByb3ZpZGVzIGluZGV4aW5nIHN1cHBvcnQgb2YgZWZmZWN0aXZlbHlsb29raW5nIHVwIElURU1TIGJ5IG9mZnNldCwgXG4gKiBnaXZlbiB0aGF0XG4gKiAoaSkgZWFjaCBlbnRyaXkgaXMgYXNzb2NpYXRlZCB3aXRoIGFuIGludGVydmFsIGFuZCxcbiAqIChpaSkgZW50cmllcyBhcmUgbm9uLW92ZXJsYXBwaW5nLlxuICogRWFjaCBJVEVNIG11c3QgYmUgYXNzb2NpYXRlZCB3aXRoIGFuIGludGVydmFsIG9uIHRoZSB0aW1lbGluZSBcbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgYXJvdW5kIGVuZHBvaW50LiBcbiAqIFxuICogUHJpbWFyeSB1c2UgaXMgZm9yIGl0ZXJhdGlvbiBcbiAqIFxuICogUmV0dXJucyB7XG4gKiAgICAgIGNlbnRlcjogbGlzdCBvZiBJVEVNUyBjb3ZlcmluZyBlbmRwb2ludCxcbiAqICAgICAgaXR2OiBpbnRlcnZhbCB3aGVyZSBuZWFyYnkgcmV0dXJucyBpZGVudGljYWwge2NlbnRlcn1cbiAqICAgICAgbGVmdDpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSBsZWZ0IFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgaGlnaC1lbmRwb2ludCBvciB1bmRlZmluZWRcbiAqICAgICAgcmlnaHQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgcmlnaHRcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGxvdy1lbmRwb2ludCBvciB1bmRlZmluZWQgICAgICAgICBcbiAqICAgICAgcHJldjpcbiAqICAgICAgICAgIGZpcnN0IGludGVydmFsIGVuZHBvaW50IHRvIHRoZSBsZWZ0IFxuICogICAgICAgICAgd2hpY2ggd2lsbCBwcm9kdWNlIGRpZmZlcmVudCAmJiBub24tZW1wdHkge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGhpZ2gtZW5kcG9pbnQgb3IgdW5kZWZpbmVkIGlmIG5vIG1vcmUgaW50ZXJ2YWxzIHRvIHRoZSBsZWZ0XG4gKiAgICAgIG5leHQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgcmlnaHRcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQgJiYgbm9uLWVtcHR5IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBsb3ctZW5kcG9pbnQgb3IgdW5kZWZpbmVkIGlmIG5vIG1vcmUgaW50ZXJ2YWxzIHRvIHRoZSByaWdodFxuICogfVxuICogXG4gKiBcbiAqIFRoZSBuZWFyYnkgc3RhdGUgaXMgd2VsbC1kZWZpbmVkIGZvciBldmVyeSB0aW1lbGluZSBwb3NpdGlvbi5cbiAqIFxuICogXG4gKiBOT1RFIGxlZnQvcmlnaHQgYW5kIHByZXYvbmV4dCBhcmUgbW9zdGx5IHRoZSBzYW1lLiBUaGUgb25seSBkaWZmZXJlbmNlIGlzIFxuICogdGhhdCBwcmV2L25leHQgd2lsbCBza2lwIG92ZXIgcmVnaW9ucyB3aGVyZSB0aGVyZSBhcmUgbm8gaW50ZXJ2YWxzLiBUaGlzXG4gKiBlbnN1cmVzIHByYWN0aWNhbCBpdGVyYXRpb24gb2YgaXRlbXMgYXMgcHJldi9uZXh0IHdpbGwgb25seSBiZSB1bmRlZmluZWQgIFxuICogYXQgdGhlIGVuZCBvZiBpdGVyYXRpb24uXG4gKiBcbiAqIElOVEVSVkFMU1xuICogXG4gKiBbbG93LCBoaWdoLCBsb3dJbmNsdXNpdmUsIGhpZ2hJbmNsdXNpdmVdXG4gKiBcbiAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAqIFxuICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG4gKiBcbiAqIFxuICogSU5URVJWQUwgRU5EUE9JTlRTXG4gKiBcbiAqIGludGVydmFsIGVuZHBvaW50cyBhcmUgZGVmaW5lZCBieSBbdmFsdWUsIHNpZ25dLCBmb3IgZXhhbXBsZVxuICogXG4gKiA0KSAtPiBbNCwtMV0gLSBlbmRwb2ludCBpcyBvbiB0aGUgbGVmdCBvZiA0XG4gKiBbNCwgNCwgNF0gLT4gWzQsIDBdIC0gZW5kcG9pbnQgaXMgYXQgNCBcbiAqICg0IC0+IFs0LCAxXSAtIGVuZHBvaW50IGlzIG9uIHRoZSByaWdodCBvZiA0KVxuICogXG4gKiAvICovXG5cbiBleHBvcnQgY2xhc3MgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIHVwZGF0ZSAoaXRlbXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qIFxuICAgICAgICBOZWFyYnkgbWV0aG9kXG4gICAgKi9cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cblxuICAgIC8qXG4gICAgICAgIHJldHVybiBsb3cgcG9pbnQgb2YgbGVmdG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGZpcnN0KCkge1xuICAgICAgICBsZXQge2NlbnRlciwgcmlnaHR9ID0gdGhpcy5uZWFyYnkoWy1JbmZpbml0eSwgMF0pO1xuICAgICAgICByZXR1cm4gKGNlbnRlci5sZW5ndGggPiAwKSA/IFstSW5maW5pdHksIDBdIDogcmlnaHQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGhpZ2ggcG9pbnQgb2YgcmlnaHRtb3N0IGVudHJ5XG4gICAgKi9cbiAgICBsYXN0KCkge1xuICAgICAgICBsZXQge2xlZnQsIGNlbnRlcn0gPSB0aGlzLm5lYXJieShbSW5maW5pdHksIDBdKTtcbiAgICAgICAgcmV0dXJuIChjZW50ZXIubGVuZ3RoID4gMCkgPyBbSW5maW5pdHksIDBdIDogbGVmdFxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIExpc3QgaXRlbXMgb2YgTmVhcmJ5SW5kZXggKG9yZGVyIGxlZnQgdG8gcmlnaHQpXG4gICAgICAgIGludGVydmFsIGRlZmluZXMgW3N0YXJ0LCBlbmRdIG9mZnNldCBvbiB0aGUgdGltZWxpbmUuXG4gICAgICAgIFJldHVybnMgbGlzdCBvZiBpdGVtLWxpc3RzLlxuICAgICAgICBvcHRpb25zXG4gICAgICAgIC0gc3RhcnRcbiAgICAgICAgLSBzdG9wXG4gICAgKi9cbiAgICBsaXN0KG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtzdGFydD0tSW5maW5pdHksIHN0b3A9SW5maW5pdHl9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHN0YXJ0ID4gc3RvcCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIChcInN0b3AgbXVzdCBiZSBsYXJnZXIgdGhhbiBzdGFydFwiLCBzdGFydCwgc3RvcClcbiAgICAgICAgfVxuICAgICAgICBzdGFydCA9IFtzdGFydCwgMF07XG4gICAgICAgIHN0b3AgPSBbc3RvcCwgMF07XG4gICAgICAgIGxldCBjdXJyZW50ID0gc3RhcnQ7XG4gICAgICAgIGxldCBuZWFyYnk7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICAgICAgbGV0IGxpbWl0ID0gNVxuICAgICAgICB3aGlsZSAobGltaXQpIHtcbiAgICAgICAgICAgIGlmIChlbmRwb2ludC5ndChjdXJyZW50LCBzdG9wKSkge1xuICAgICAgICAgICAgICAgIC8vIGV4aGF1c3RlZFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmVhcmJ5ID0gdGhpcy5uZWFyYnkoY3VycmVudCk7XG4gICAgICAgICAgICBpZiAobmVhcmJ5LmNlbnRlci5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgICAgIC8vIGNlbnRlciBlbXB0eSAodHlwaWNhbGx5IGZpcnN0IGl0ZXJhdGlvbilcbiAgICAgICAgICAgICAgICBpZiAobmVhcmJ5LnJpZ2h0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyByaWdodCB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gbm8gZW50cmllcyAtIGFscmVhZHkgZXhoYXVzdGVkXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IGRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IG9mZnNldFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gbmVhcmJ5LnJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKG5lYXJieS5jZW50ZXIpO1xuICAgICAgICAgICAgICAgIGlmIChuZWFyYnkucmlnaHQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBsYXN0IGVudHJ5IC0gbWFyayBpdGVyYWN0b3IgZXhoYXVzdGVkXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IGRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IG9mZnNldFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gbmVhcmJ5LnJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxpbWl0LS07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgU2FtcGxlIE5lYXJieUluZGV4IGJ5IHRpbWVsaW5lIG9mZnNldCBpbmNyZW1lbnRzXG4gICAgICAgIHJldHVybiBsaXN0IG9mIHR1cGxlcyBbdmFsdWUsIG9mZnNldF1cbiAgICAgICAgb3B0aW9uc1xuICAgICAgICAtIHN0YXJ0XG4gICAgICAgIC0gc3RvcFxuICAgICAgICAtIHN0ZXBcbiAgICAqL1xuICAgIHNhbXBsZShvcHRpb25zPXt9KSB7XG4gICAgICAgIGxldCB7c3RhcnQ9LUluZmluaXR5LCBzdG9wPUluZmluaXR5LCBzdGVwPTF9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHN0YXJ0ID4gc3RvcCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIChcInN0b3AgbXVzdCBiZSBsYXJnZXIgdGhhbiBzdGFydFwiLCBzdGFydCwgc3RvcClcbiAgICAgICAgfVxuICAgICAgICBzdGFydCA9IFtzdGFydCwgMF07XG4gICAgICAgIHN0b3AgPSBbc3RvcCwgMF07XG5cbiAgICAgICAgc3RhcnQgPSBlbmRwb2ludC5tYXgodGhpcy5maXJzdCgpLCBzdGFydCk7XG4gICAgICAgIHN0b3AgPSBlbmRwb2ludC5taW4odGhpcy5sYXN0KCksIHN0b3ApO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKFwic2FtcGxlXCIsIHN0YXJ0LCBzdG9wKTtcbiAgICAgICAgY29uc3QgY2FjaGUgPSBuZXcgTmVhcmJ5Q2FjaGUodGhpcyk7XG4gICAgICAgIHJldHVybiByYW5nZShzdGFydFswXSwgc3RvcFswXSwgc3RlcCwge2luY2x1ZGVfZW5kOnRydWV9KVxuICAgICAgICAgICAgLm1hcCgob2Zmc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtjYWNoZS5xdWVyeShvZmZzZXQpLnZhbHVlLCBvZmZzZXRdO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG59XG5cblxuXG5cblxuIiwiaW1wb3J0IHtpbnRlcnZhbCwgZW5kcG9pbnR9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4vbmVhcmJ5aW5kZXguanNcIjtcblxuLyoqXG4gKiBcbiAqIE5lYXJieSBJbmRleCBTaW1wbGVcbiAqIFxuICogLSBpdGVtcyBhcmUgYXNzdW1lZCB0byBiZSBub24tb3ZlcmxhcHBpbmcgb24gdGhlIHRpbWVsaW5lLCBcbiAqIC0gaW1wbHlpbmcgdGhhdCBuZWFyYnkuY2VudGVyIHdpbGwgYmUgYSBsaXN0IG9mIGF0IG1vc3Qgb25lIElURU0uIFxuICogLSBleGNlcHRpb24gd2lsbCBiZSByYWlzZWQgaWYgb3ZlcmxhcHBpbmcgSVRFTVMgYXJlIGZvdW5kXG4gKiAtIElURU1TIGlzIGFzc3VtYmVkIHRvIGJlIGltbXV0YWJsZSBhcnJheSAtIGNoYW5nZSBJVEVNUyBieSByZXBsYWNpbmcgYXJyYXlcbiAqIFxuICogXG4gKiBORUFSQllcbiAqIFRoZSBuZWFyYnkgbWV0aG9kIHJldHVybnMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIG5laWdoYm9yaG9vZCBhcm91bmQgb2Zmc2V0LiBcbiAqIFxuICogUmV0dXJucyB7XG4gKiAgICAgIGxlZnQgLSBoaWdoIGludGVydmFsIGVuZHBvaW50IG9mIHRoZSBmaXJzdCBJVEVNIHRvIHRoZSBsZWZ0IHdoaWNoIGRvZXMgbm90IGNvdmVyIG9mZnNldCwgZWxzZSB1bmRlZmluZWRcbiAqICAgICAgY2VudGVyIC0gbGlzdCBvZiBJVEVNUyBjb3ZlcmluZyBvZmZzZXQsIGVsc2UgW11cbiAqICAgICAgcmlnaHQgLSBsb3cgaW50ZXJ2YWwgZW5kcG9pbnQgb2YgdGhlIGZpcnN0IElURU0gdG8gdGhlIHJpZ2h0IHdoaWNoIGRvZXMgbm90IGNvdmVyIG9mZnNldCwgZWxzZSB1bmRlZmluZWRcbiAqIH1cbiAqIFxuICovXG5cblxuLy8gZ2V0IGludGVydmFsIGxvdyBwb2ludFxuZnVuY3Rpb24gZ2V0X2xvd192YWx1ZShpdGVtKSB7XG4gICAgcmV0dXJuIGl0ZW0uaXR2WzBdO1xufVxuXG4vLyBnZXQgaW50ZXJ2YWwgbG93IGVuZHBvaW50XG5mdW5jdGlvbiBnZXRfbG93X2VuZHBvaW50KGl0ZW0pIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMF1cbn1cblxuLy8gZ2V0IGludGVydmFsIGhpZ2ggZW5kcG9pbnRcbmZ1bmN0aW9uIGdldF9oaWdoX2VuZHBvaW50KGl0ZW0pIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMV1cbn1cblxuXG5leHBvcnQgY2xhc3MgU2ltcGxlTmVhcmJ5SW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9pdGVtcyA9IFtdO1xuICAgICAgICBsZXQge2l0ZW1zfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChpdGVtcykge1xuICAgICAgICAgICAgdGhpcy51cGRhdGUoaXRlbXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlIChpdGVtcykge1xuICAgICAgICB0aGlzLl9pdGVtcyA9IGNoZWNrX2lucHV0KGl0ZW1zKVxuICAgIH1cblxuXG4gICAgLypcbiAgICAgICAgbmVhcmJ5IGJ5IG9mZnNldFxuICAgICAgICBcbiAgICAgICAgcmV0dXJucyB7bGVmdCwgY2VudGVyLCByaWdodH1cblxuICAgICAgICBiaW5hcnkgc2VhcmNoIGJhc2VkIG9uIG9mZnNldFxuICAgICAgICAxKSBmb3VuZCwgaWR4XG4gICAgICAgICAgICBvZmZzZXQgbWF0Y2hlcyB2YWx1ZSBvZiBpbnRlcnZhbC5sb3cgb2YgYW4gaXRlbVxuICAgICAgICAgICAgaWR4IGdpdmVzIHRoZSBpbmRleCBvZiB0aGlzIGl0ZW0gaW4gdGhlIGFycmF5XG4gICAgICAgIDIpIG5vdCBmb3VuZCwgaWR4XG4gICAgICAgICAgICBvZmZzZXQgaXMgZWl0aGVyIGNvdmVyZWQgYnkgaXRlbSBhdCAoaWR4LTEpLFxuICAgICAgICAgICAgb3IgaXQgaXMgbm90ID0+IGJldHdlZW4gZW50cmllc1xuICAgICAgICAgICAgaW4gdGhpcyBjYXNlIC0gaWR4IGdpdmVzIHRoZSBpbmRleCB3aGVyZSBhbiBpdGVtXG4gICAgICAgICAgICBzaG91bGQgYmUgaW5zZXJ0ZWQgLSBpZiBpdCBoYWQgbG93ID09IG9mZnNldFxuICAgICovXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBpZiAodHlwZW9mIG9mZnNldCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIG9mZnNldCA9IFtvZmZzZXQsIDBdO1xuICAgICAgICB9XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShvZmZzZXQpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFbmRwb2ludCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgICAgICAgIGNlbnRlcjogW10sXG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgICAgIGxlZnQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHJpZ2h0OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBwcmV2OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBuZXh0OiB1bmRlZmluZWRcbiAgICAgICAgfTtcbiAgICAgICAgbGV0IGl0ZW1zID0gdGhpcy5faXRlbXM7XG4gICAgICAgIGxldCBpbmRleGVzLCBpdGVtO1xuICAgICAgICBjb25zdCBzaXplID0gaXRlbXMubGVuZ3RoO1xuICAgICAgICBpZiAoc2l6ZSA9PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0OyBcbiAgICAgICAgfVxuICAgICAgICBsZXQgW2ZvdW5kLCBpZHhdID0gZmluZF9pbmRleChvZmZzZXRbMF0sIGl0ZW1zLCBnZXRfbG93X3ZhbHVlKTtcbiAgICAgICAgaWYgKGZvdW5kKSB7XG4gICAgICAgICAgICAvLyBzZWFyY2ggb2Zmc2V0IG1hdGNoZXMgaXRlbSBsb3cgZXhhY3RseVxuICAgICAgICAgICAgLy8gY2hlY2sgdGhhdCBpdCBpbmRlZWQgY292ZXJlZCBieSBpdGVtIGludGVydmFsXG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4XVxuICAgICAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19lbmRwb2ludChpdGVtLml0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgIGluZGV4ZXMgPSB7bGVmdDppZHgtMSwgY2VudGVyOmlkeCwgcmlnaHQ6aWR4KzF9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChpbmRleGVzID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gY2hlY2sgcHJldiBpdGVtXG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4LTFdO1xuICAgICAgICAgICAgaWYgKGl0ZW0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgaWYgc2VhcmNoIG9mZnNldCBpcyBjb3ZlcmVkIGJ5IGl0ZW0gaW50ZXJ2YWxcbiAgICAgICAgICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KGl0ZW0uaXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ZXMgPSB7bGVmdDppZHgtMiwgY2VudGVyOmlkeC0xLCByaWdodDppZHh9O1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cdFxuICAgICAgICBpZiAoaW5kZXhlcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIHByZXYgaXRlbSBlaXRoZXIgZG9lcyBub3QgZXhpc3Qgb3IgaXMgbm90IHJlbGV2YW50XG4gICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTEsIGNlbnRlcjotMSwgcmlnaHQ6aWR4fTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNlbnRlclxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLmNlbnRlciAmJiBpbmRleGVzLmNlbnRlciA8IHNpemUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5jZW50ZXIgPSAgW2l0ZW1zW2luZGV4ZXMuY2VudGVyXV07XG4gICAgICAgIH1cbiAgICAgICAgLy8gcHJldi9uZXh0XG4gICAgICAgIGlmICgwIDw9IGluZGV4ZXMubGVmdCAmJiBpbmRleGVzLmxlZnQgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQucHJldiA9ICBnZXRfaGlnaF9lbmRwb2ludChpdGVtc1tpbmRleGVzLmxlZnRdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLnJpZ2h0ICYmIGluZGV4ZXMucmlnaHQgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQubmV4dCA9ICBnZXRfbG93X2VuZHBvaW50KGl0ZW1zW2luZGV4ZXMucmlnaHRdKTtcbiAgICAgICAgfSAgICAgICAgXG4gICAgICAgIC8vIGxlZnQvcmlnaHRcbiAgICAgICAgbGV0IGxvdywgaGlnaDtcbiAgICAgICAgaWYgKHJlc3VsdC5jZW50ZXIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IGl0diA9IHJlc3VsdC5jZW50ZXJbMF0uaXR2O1xuICAgICAgICAgICAgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0dik7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IChsb3dbMF0gPiAtSW5maW5pdHkpID8gZW5kcG9pbnQuZmxpcChsb3csIFwiaGlnaFwiKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IChoaWdoWzBdIDwgSW5maW5pdHkpID8gZW5kcG9pbnQuZmxpcChoaWdoLCBcImxvd1wiKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VsdC5pdHYgPSByZXN1bHQuY2VudGVyWzBdLml0djtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gcmVzdWx0LnByZXY7XG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSByZXN1bHQubmV4dDtcbiAgICAgICAgICAgIC8vIGludGVydmFsXG4gICAgICAgICAgICBsZXQgbGVmdCA9IHJlc3VsdC5sZWZ0O1xuICAgICAgICAgICAgbG93ID0gKGxlZnQgPT0gdW5kZWZpbmVkKSA/IFstSW5maW5pdHksIDBdIDogZW5kcG9pbnQuZmxpcChsZWZ0LCBcImxvd1wiKTtcbiAgICAgICAgICAgIGxldCByaWdodCA9IHJlc3VsdC5yaWdodDtcbiAgICAgICAgICAgIGhpZ2ggPSAocmlnaHQgPT0gdW5kZWZpbmVkKSA/IFtJbmZpbml0eSwgMF0gOiBlbmRwb2ludC5mbGlwKHJpZ2h0LCBcImhpZ2hcIik7XG4gICAgICAgICAgICByZXN1bHQuaXR2ID0gaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXHRVVElMU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5cbi8vIGNoZWNrIGlucHV0XG5mdW5jdGlvbiBjaGVja19pbnB1dChpdGVtcykge1xuXG4gICAgaWYgKGl0ZW1zID09IHVuZGVmaW5lZCkge1xuICAgICAgICBpdGVtcyA9IFtdO1xuICAgIH1cblxuICAgIGlmICghQXJyYXkuaXNBcnJheShpdGVtcykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW5wdXQgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICB9XG5cbiAgICAvLyBzb3J0IGl0ZW1zIGJhc2VkIG9uIGludGVydmFsIGxvdyBlbmRwb2ludFxuICAgIGl0ZW1zLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgbGV0IGFfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChhLml0dilbMF07XG4gICAgICAgIGxldCBiX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYi5pdHYpWzBdO1xuICAgICAgICByZXR1cm4gZW5kcG9pbnQuY21wKGFfbG93LCBiX2xvdyk7XG4gICAgfSk7XG5cbiAgICAvLyBjaGVjayB0aGF0IGl0ZW0gaW50ZXJ2YWxzIGFyZSBub24tb3ZlcmxhcHBpbmdcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBwcmV2X2hpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2kgLSAxXS5pdHYpWzFdO1xuICAgICAgICBsZXQgY3Vycl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2ldLml0dilbMF07XG4gICAgICAgIC8vIHZlcmlmeSB0aGF0IHByZXYgaGlnaCBpcyBsZXNzIHRoYXQgY3VyciBsb3dcbiAgICAgICAgaWYgKCFlbmRwb2ludC5sdChwcmV2X2hpZ2gsIGN1cnJfbG93KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT3ZlcmxhcHBpbmcgaW50ZXJ2YWxzIGZvdW5kXCIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuXG4vKlxuXHRiaW5hcnkgc2VhcmNoIGZvciBmaW5kaW5nIHRoZSBjb3JyZWN0IGluc2VydGlvbiBpbmRleCBpbnRvXG5cdHRoZSBzb3J0ZWQgYXJyYXkgKGFzY2VuZGluZykgb2YgaXRlbXNcblx0XG5cdGFycmF5IGNvbnRhaW5zIG9iamVjdHMsIGFuZCB2YWx1ZSBmdW5jIHJldHJlYXZlcyBhIHZhbHVlXG5cdGZyb20gZWFjaCBvYmplY3QuXG5cblx0cmV0dXJuIFtmb3VuZCwgaW5kZXhdXG4qL1xuXG5mdW5jdGlvbiBmaW5kX2luZGV4KHRhcmdldCwgYXJyLCB2YWx1ZV9mdW5jKSB7XG5cbiAgICBmdW5jdGlvbiBkZWZhdWx0X3ZhbHVlX2Z1bmMoZWwpIHtcbiAgICAgICAgcmV0dXJuIGVsO1xuICAgIH1cbiAgICBcbiAgICBsZXQgbGVmdCA9IDA7XG5cdGxldCByaWdodCA9IGFyci5sZW5ndGggLSAxO1xuXHR2YWx1ZV9mdW5jID0gdmFsdWVfZnVuYyB8fCBkZWZhdWx0X3ZhbHVlX2Z1bmM7XG5cdHdoaWxlIChsZWZ0IDw9IHJpZ2h0KSB7XG5cdFx0Y29uc3QgbWlkID0gTWF0aC5mbG9vcigobGVmdCArIHJpZ2h0KSAvIDIpO1xuXHRcdGxldCBtaWRfdmFsdWUgPSB2YWx1ZV9mdW5jKGFyclttaWRdKTtcblx0XHRpZiAobWlkX3ZhbHVlID09PSB0YXJnZXQpIHtcblx0XHRcdHJldHVybiBbdHJ1ZSwgbWlkXTsgLy8gVGFyZ2V0IGFscmVhZHkgZXhpc3RzIGluIHRoZSBhcnJheVxuXHRcdH0gZWxzZSBpZiAobWlkX3ZhbHVlIDwgdGFyZ2V0KSB7XG5cdFx0XHQgIGxlZnQgPSBtaWQgKyAxOyAvLyBNb3ZlIHNlYXJjaCByYW5nZSB0byB0aGUgcmlnaHRcblx0XHR9IGVsc2Uge1xuXHRcdFx0ICByaWdodCA9IG1pZCAtIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSBsZWZ0XG5cdFx0fVxuXHR9XG4gIFx0cmV0dXJuIFtmYWxzZSwgbGVmdF07IC8vIFJldHVybiB0aGUgaW5kZXggd2hlcmUgdGFyZ2V0IHNob3VsZCBiZSBpbnNlcnRlZFxufVxuIiwiaW1wb3J0IHsgU2ltcGxlTmVhcmJ5SW5kZXggfSBmcm9tIFwiLi9uZWFyYnlpbmRleF9zaW1wbGVcIjtcbmltcG9ydCB7IE5lYXJieUNhY2hlIH0gZnJvbSBcIi4vbmVhcmJ5Y2FjaGVcIjtcblxuZXhwb3J0IGNvbnN0IG5lYXJieSA9IGZ1bmN0aW9uICgpIHtcblxuICAgIGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2Uob2JqZWN0KSB7XG4gICAgICAgIGxldCBpbmRleCA9IG5ldyBTaW1wbGVOZWFyYnlJbmRleCgpO1xuICAgICAgICBvYmplY3QuX19uZWFyYnlfaW5kZXggPSBpbmRleDtcbiAgICAgICAgb2JqZWN0Ll9fbmVhcmJ5X2NhY2hlID0gbmV3IE5lYXJieUNhY2hlKGluZGV4KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB1cGRhdGUoaXRlbXMpIHtcbiAgICAgICAgdGhpcy5fX25lYXJieV9pbmRleC51cGRhdGUoaXRlbXMpO1xuICAgICAgICB0aGlzLl9fbmVhcmJ5X2NhY2hlLmRpcnR5KCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcXVlcnkgKG9mZnNldCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fX25lYXJieV9jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlKF9wcm90b3R5cGUpIHtcbiAgICAgICAgY29uc3QgYXBpID0ge307XG4gICAgICAgIGFwaVsnX19uZWFyYnlfdXBkYXRlJ10gPSB1cGRhdGU7XG4gICAgICAgIGFwaVsnX19uZWFyYnlfcXVlcnknXSA9IHF1ZXJ5O1xuICAgICAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIGFwaSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHthZGRUb0luc3RhbmNlLCBhZGRUb1Byb3RvdHlwZX1cbn0oKTtcbiIsIlxuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UsIEN1cnNvckJhc2UgfSBmcm9tIFwiLi9iYXNlc1wiO1xuY29uc3QgTUVUSE9EUyA9IHthc3NpZ24sIG1vdmUsIHRyYW5zaXRpb24sIGludGVycG9sYXRlfTtcblxuXG5leHBvcnQgZnVuY3Rpb24gY21kICh0YXJnZXQpIHtcbiAgICBpZiAoISh0YXJnZXQgaW5zdGFuY2VvZiBDdXJzb3JCYXNlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhcmdldCBtdXN0IGJlIGN1cnNvciAke3RhcmdldH1gKTtcbiAgICB9XG4gICAgaWYgKCEodGFyZ2V0LnNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhcmdldC5zcmMgbXVzdCBiZSBzdGF0ZXByb3ZpZGVyICR7dGFyZ2V0fWApO1xuICAgIH1cbiAgICBsZXQgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKE1FVEhPRFMpXG4gICAgICAgIC5tYXAoKFtuYW1lLCBtZXRob2RdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24oLi4uYXJncykgeyBcbiAgICAgICAgICAgICAgICAgICAgbGV0IGl0ZW1zID0gbWV0aG9kLmNhbGwodGhpcywgdGFyZ2V0LCAuLi5hcmdzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldC5zcmMudXBkYXRlKGl0ZW1zKTsgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhlbnRyaWVzKTtcbn1cblxuZnVuY3Rpb24gYXNzaWduKHRhcmdldCwgdmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgaXRlbSA9IHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZX0gICAgICAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbaXRlbV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBtb3ZlKHRhcmdldCwgdmVjdG9yPXt9KSB7XG4gICAgbGV0IHt2YWx1ZSwgcmF0ZSwgb2Zmc2V0fSA9IHRhcmdldC5xdWVyeSgpO1xuICAgIGxldCB7cG9zaXRpb249dmFsdWUsIHZlbG9jaXR5PXJhdGV9ID0gdmVjdG9yO1xuICAgIGxldCBpdGVtID0ge1xuICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgdHlwZTogXCJtb3Rpb25cIixcbiAgICAgICAgYXJnczoge3Bvc2l0aW9uLCB2ZWxvY2l0eSwgdGltZXN0YW1wOm9mZnNldH0gICAgICAgICAgICAgICAgIFxuICAgIH1cbiAgICByZXR1cm4gW2l0ZW1dO1xufVxuXG5mdW5jdGlvbiB0cmFuc2l0aW9uKHRhcmdldCwgdjAsIHYxLCB0MCwgdDEsIGVhc2luZykge1xuICAgIGxldCBpdGVtcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTp2MH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDAsIHQxLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcInRyYW5zaXRpb25cIixcbiAgICAgICAgICAgIGFyZ3M6IHt2MCwgdjEsIHQwLCB0MSwgZWFzaW5nfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTogdjF9XG4gICAgICAgIH1cbiAgICBdXG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZSh0YXJnZXQsIHR1cGxlcykge1xuICAgIGxldCBbdjAsIHQwXSA9IHR1cGxlc1swXTtcbiAgICBsZXQgW3YxLCB0MV0gPSB0dXBsZXNbdHVwbGVzLmxlbmd0aC0xXTtcblxuICAgIGxldCBpdGVtcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCB0MCwgdHJ1ZSwgZmFsc2VdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGFyZ3M6IHt2YWx1ZTp2MH1cbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDAsIHQxLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcImludGVycG9sYXRpb25cIixcbiAgICAgICAgICAgIGFyZ3M6IHt0dXBsZXN9XG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgYXJnczoge3ZhbHVlOiB2MX1cbiAgICAgICAgfVxuICAgIF0gICAgXG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5cblxuIiwiXG5cbmltcG9ydCB7IFN0YXRlUHJvdmlkZXJCYXNlLCBDdXJzb3JCYXNlIH0gZnJvbSBcIi4vYmFzZXMuanNcIjtcbmltcG9ydCB7IHNvdXJjZSB9IGZyb20gXCIuL3V0aWwuanNcIjtcbmltcG9ydCB7IFNpbXBsZVN0YXRlUHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX3NpbXBsZS5qc1wiO1xuaW1wb3J0IHsgbmVhcmJ5IH0gZnJvbSBcIi4vY29tbW9uLmpzXCI7XG5pbXBvcnQgeyBjbWQgfSBmcm9tIFwiLi9jbWQuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBDTE9DSyBDVVJTT1JTXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vLyBDTE9DSyAoY291bnRpbmcgc2Vjb25kcyBzaW5jZSBwYWdlIGxvYWQpXG5jbGFzcyBMb2NhbENsb2NrIGV4dGVuZHMgQ3Vyc29yQmFzZSB7XG4gICAgcXVlcnkgKCkge1xuICAgICAgICBsZXQgb2Zmc2V0ID0gcGVyZm9ybWFuY2Uubm93KCkvMTAwMC4wO1xuICAgICAgICByZXR1cm4ge3ZhbHVlOm9mZnNldCwgZHluYW1pYzp0cnVlLCBvZmZzZXR9O1xuICAgIH1cbn1cblxuLy8gQ0xPQ0sgKGNvdW50aW5nIHNlY29uZHMgc2luY2UgZXBvY2ggKDE5NzApXG5jbGFzcyBMb2NhbEVwb2NoIGV4dGVuZHMgQ3Vyc29yQmFzZSB7XG4gICAgcXVlcnkgKCkge1xuICAgICAgICBsZXQgb2Zmc2V0ID0gKERhdGUubm93KCkgLyAxMDAwLjApXG4gICAgICAgIHJldHVybiB7dmFsdWU6b2Zmc2V0LCBkeW5hbWljOnRydWUsIG9mZnNldH07XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgbG9jYWxfY2xvY2sgPSBuZXcgTG9jYWxDbG9jaygpO1xuZXhwb3J0IGNvbnN0IGxvY2FsX2Vwb2NoID0gbmV3IExvY2FsRXBvY2goKVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ1VSU09SXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFxuICogQ3Vyc29yIGlzIGEgdmFyaWFibGVcbiAqIC0gaGFzIG11dGFibGUgY3RybCBjdXJzb3IgKGRlZmF1bHQgbG9jYWwgY2xvY2spXG4gKiAtIGhhcyBtdXRhYmxlIHN0YXRlIHByb3ZpZGVyIChzcmMpIChkZWZhdWx0IHN0YXRlIHVuZGVmaW5lZClcbiAqIC0gbWV0aG9kcyBmb3IgYXNzaWduLCBtb3ZlLCB0cmFuc2l0aW9uLCBpbnRlcG9sYXRpb25cbiAqIFxuICovXG5cbmV4cG9ydCBjbGFzcyBDdXJzb3IgZXh0ZW5kcyBDdXJzb3JCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8vIGN0cmxcbiAgICAgICAgc291cmNlLmFkZFRvSW5zdGFuY2UodGhpcywgXCJjdHJsXCIpO1xuICAgICAgICAvLyBzcmNcbiAgICAgICAgc291cmNlLmFkZFRvSW5zdGFuY2UodGhpcywgXCJzcmNcIik7XG4gICAgICAgIC8vIG5lYXJieVxuICAgICAgICBuZWFyYnkuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgLy8gaW5pdGlhbHNlIGNsb2NrXG5cbiAgICAgICAgLy8gaW5pdGlhbGlzZSBjdHJsXG4gICAgICAgIGxldCB7Y3RybH0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoY3RybCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGN0cmwgPSBsb2NhbF9jbG9jaztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmN0cmwgPSBjdHJsO1xuXG4gICAgICAgIC8vIGluaXRpYWxpc2Ugc3RhdGVcbiAgICAgICAgbGV0IHtzcmN9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHNyYyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNyYyA9IG5ldyBTaW1wbGVTdGF0ZVByb3ZpZGVyKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zcmMgPSBzcmNcbiAgICB9XG5cbiAgICAvLyBjdHJsXG4gICAgX19jdHJsX2NoZWNrKGN0cmwpIHtcbiAgICAgICAgaWYgKCEoY3RybCBpbnN0YW5jZW9mIEN1cnNvckJhc2UpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwiY3RybFwiIG11c3QgYmUgY3Vyc29yICR7Y3RybH1gKVxuICAgICAgICB9XG4gICAgfVxuICAgIF9fY3RybF9oYW5kbGVfY2hhbmdlKCkge1xuICAgICAgICB0aGlzLl9faGFuZGxlX2NoYW5nZSgpO1xuICAgIH1cblxuXG4gICAgLy8gc3JjXG4gICAgX19zcmNfY2hlY2soc3JjKSB7XG4gICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBcInNyY1wiIG11c3QgYmUgc3RhdGUgcHJvdmlkZXIgJHtzb3VyY2V9YCk7XG4gICAgICAgIH1cbiAgICB9ICAgIFxuICAgIF9fc3JjX2hhbmRsZV9jaGFuZ2UoKSB7XG4gICAgICAgIHRoaXMuX19oYW5kbGVfY2hhbmdlKCk7XG4gICAgfVxuXG4gICAgLy8gY3RybCBvciBzcmMgY2hhbmdlc1xuICAgIF9faGFuZGxlX2NoYW5nZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuc3JjICYmIHRoaXMuY3RybCkge1xuICAgICAgICAgICAgbGV0IGl0ZW1zID0gdGhpcy5zcmMuaXRlbXM7XG4gICAgICAgICAgICB0aGlzLl9fbmVhcmJ5X3VwZGF0ZShpdGVtcyk7XG4gICAgICAgICAgICAvLyB0cmlnZ2VyIGNoYW5nZSBldmVudCBmb3IgY3Vyc29yXG4gICAgICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiLCB0aGlzLnF1ZXJ5KCkpOyAgICBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUllcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICBxdWVyeSAoKSB7XG4gICAgICAgIGxldCB7dmFsdWU6b2Zmc2V0fSA9IHRoaXMuY3RybC5xdWVyeSgpXG4gICAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdHJsIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7b2Zmc2V0fWApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9fbmVhcmJ5X2NhY2hlLnF1ZXJ5KG9mZnNldCk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBDT05WRU5JRU5DRVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgZ2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5xdWVyeSgpLnZhbHVlfTtcblxuICAgIGFzc2lnbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gY21kKHRoaXMpLmFzc2lnbih2YWx1ZSk7XG4gICAgfVxuICAgIG1vdmUgKHtwb3NpdGlvbiwgdmVsb2NpdHl9KSB7XG4gICAgICAgIGxldCB7dmFsdWUsIHJhdGUsIG9mZnNldDp0aW1lc3RhbXB9ID0gdGhpcy5xdWVyeSgpO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3Igc3RhdGUgbXVzdCBiZSBudW1iZXIgJHt2YWx1ZX1gKTtcbiAgICAgICAgfVxuICAgICAgICBwb3NpdGlvbiA9IChwb3NpdGlvbiAhPSB1bmRlZmluZWQpID8gcG9zaXRpb24gOiB2YWx1ZTtcbiAgICAgICAgdmVsb2NpdHkgPSAodmVsb2NpdHkgIT0gdW5kZWZpbmVkKSA/IHZlbG9jaXR5OiByYXRlO1xuICAgICAgICByZXR1cm4gY21kKHRoaXMpLm1vdmUoe3Bvc2l0aW9uLCB2ZWxvY2l0eSwgdGltZXN0YW1wfSk7XG4gICAgfVxuICAgIHRyYW5zaXRpb24gKHt0YXJnZXQsIGR1cmF0aW9uLCBlYXNpbmd9KSB7XG4gICAgICAgIGxldCB7dmFsdWU6djAsIG9mZnNldDp0MH0gPSB0aGlzLnF1ZXJ5KCk7XG4gICAgICAgIGlmICh0eXBlb2YgdjAgIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHdhcm5pbmc6IGN1cnNvciBzdGF0ZSBtdXN0IGJlIG51bWJlciAke3YwfWApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjbWQodGhpcykudHJhbnNpdGlvbih2MCwgdGFyZ2V0LCB0MCwgdDAgKyBkdXJhdGlvbiwgZWFzaW5nKTtcbiAgICB9XG4gICAgaW50ZXJwb2xhdGUgKHt0dXBsZXMsIGR1cmF0aW9ufSkge1xuICAgICAgICBsZXQgdDAgPSB0aGlzLnF1ZXJ5KCkub2Zmc2V0O1xuICAgICAgICAvLyBhc3N1bWluZyB0aW1zdGFtcHMgYXJlIGluIHJhbmdlIFswLDFdXG4gICAgICAgIC8vIHNjYWxlIHRpbWVzdGFtcHMgdG8gZHVyYXRpb25cbiAgICAgICAgdHVwbGVzID0gdHVwbGVzLm1hcCgoW3YsdF0pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBbdiwgdDAgKyB0KmR1cmF0aW9uXTtcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzKS5pbnRlcnBvbGF0ZSh0dXBsZXMpO1xuICAgIH1cblxuXG59XG5zb3VyY2UuYWRkVG9Qcm90b3R5cGUoQ3Vyc29yLnByb3RvdHlwZSwgXCJzcmNcIiwge211dGFibGU6dHJ1ZX0pO1xuc291cmNlLmFkZFRvUHJvdG90eXBlKEN1cnNvci5wcm90b3R5cGUsIFwiY3RybFwiLCB7bXV0YWJsZTp0cnVlfSk7XG5uZWFyYnkuYWRkVG9Qcm90b3R5cGUoQ3Vyc29yLnByb3RvdHlwZSk7XG4iXSwibmFtZXMiOlsiaW50ZXJwb2xhdGUiLCJjaGVja19pbnB1dCIsInNlZ21lbnQuU3RhdGljU2VnbWVudCIsInNlZ21lbnQuVHJhbnNpdGlvblNlZ21lbnQiLCJzZWdtZW50LkludGVycG9sYXRpb25TZWdtZW50Iiwic2VnbWVudC5Nb3Rpb25TZWdtZW50Il0sIm1hcHBpbmdzIjoiOzs7OztFQUFBO0VBQ0E7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7RUFFQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7OztFQUdBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7O0VBR0EsU0FBUyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtFQUMxQixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxPQUFPLENBQUM7RUFDekIsSUFBSSxJQUFJLENBQUMsS0FBSyxRQUFRLEVBQUUsT0FBTyxDQUFDO0VBQ2hDLElBQUksSUFBSSxDQUFDLEtBQUssUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0VBQ2pDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7RUFDbEMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUM7RUFDakMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDO0VBQ2hCOztFQUVBLFNBQVMsWUFBWSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7RUFDL0IsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7RUFDckIsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7RUFDckIsSUFBSSxJQUFJLElBQUksR0FBRyxVQUFVLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQztFQUNq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
