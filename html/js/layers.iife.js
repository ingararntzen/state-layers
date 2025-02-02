
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

  /************************************************
   * LAYER QUERY INTERFACE
   ************************************************/

  /**
   * Decorate an object/prototype of a Layer to implement 
   * the LayerQuery interface.
   * 
   * The layer query interface implements a query
   * mechanism for layers, with built-in caching
   * 
   * Example use
   * cache = object.getCache() 
   * cache.query();
   * 
   * - clearCaches is for internal use
   * - index is the actual target of of the query
   * - queryOptions specializes the query output
   * 
   * 
   * NOTE - this might be part of the BaseLayer class instead.
   */

  const PREFIX$2 = "__layerquery";

  function addToInstance$2 (object, queryOptions, CacheClass) {
      object[`${PREFIX$2}_index`];
      object[`${PREFIX$2}_queryOptions`] = queryOptions;
      object[`${PREFIX$2}_cacheClass`] = CacheClass;
      object[`${PREFIX$2}_cacheObjects`] = [];
  }

  function addToPrototype$2 (_prototype) {

      Object.defineProperty(_prototype, "index", {
          get: function () {
              return this[`${PREFIX$2}_index`];
          },
          set: function (index) {
              this[`${PREFIX$2}_index`] = index;
          }
      });
      Object.defineProperty(_prototype, "queryOptions", {
          get: function () {
              return this[`${PREFIX$2}_queryOptions`];
          }
      });

      function getCache () {
          let CacheClass = this[`${PREFIX$2}_cacheClass`];
          const cache = new CacheClass(this);
          this[`${PREFIX$2}_cacheObjects`].push(cache);
          return cache;
      }

      function clearCaches () {
          for (let cache of this[`${PREFIX$2}_cacheObjects`]) {
              cache.clear();
          }
      }
      
      Object.assign(_prototype, {getCache, clearCaches});
  }

  /*
      This decorates an object/prototype with basic (synchronous) callback support.
  */

  const PREFIX$1 = "__callback";

  function addToInstance$1(object) {
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

  function addToPrototype$1 (_prototype) {
      const api = {
          add_callback, remove_callback, notify_callbacks
      };
      Object.assign(_prototype, api);
  }

  /************************************************
   * SOURCE PROPERTY (SRCPROP)
   ************************************************/

  /**
   * Functions for extending a class with support for 
   * external source on a named property.
   * 
   * option: mutable:true means that propery may be reset 
   * 
   * source object is assumed to support the callback interface
   */

  const NAME = "srcprop";
  const PREFIX = `__${NAME}`;

  function addToInstance (object) {
      object[`${PREFIX}`] = new Map();
  }

  function addToPrototype (_prototype) {

      function register(propName, options={}) {
          let {mutable=true} = options;
          const map = this[`${PREFIX}`]; 
          map.set(propName, {
              init:false,
              handle: undefined,
              src: undefined,
              mutable
          });

          // register getters and setters
          if (mutable) {
              // getter and setter
              Object.defineProperty(this, propName, {
                  get: function () {
                      return map.get(propName).src;
                  },
                  set: function (src) {
                      if (this.propCheck) {
                          src = this.propCheck(propName, src);
                      }
                      if (src != map.get(propName).src) {
                          this[`${PREFIX}_attach`](propName, src);
                      }
                  }
              });
          } else {
              // only getter
              Object.defineProperty(this, propName, {
                  get: function () {
                      return m.get(propName).src;
                  }
              });
          }
      }

      function attatch(propName, src) {
          const map = this[`${PREFIX}`];
          const state = map.get(propName);

          if (state.init && !state.mutable) {
              throw new Error(`${propName} can not be reassigned`);
          }

          // unsubscribe from source change event
          if (state.src) {
              state.src.remove_callback(state.handle);
              state.src = undefined;
              state.handle = undefined;
          }

          // attatch new src
          state.src = src;
          state.init = true;

          // subscribe to callback from source
          if (this.propChange) {
              const handler = function (eArg) {
                  this.propChange(propName, eArg);
              }.bind(this);
              state.handle = src.add_callback(handler);
              this.propChange(propName, "reset"); 
          }
      }

      const api = {};
      api[`${NAME}Register`] = register;
      api[`${PREFIX}_attach`] = attatch;
      Object.assign(_prototype, api);
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

  (function () {
      const t0_local = local();
      const t0_epoch = epoch();
      return {
          now: function () {
              return t0_epoch + (local() - t0_local)
          }
      }
  })();


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
   * Create a single state from a list of states, using a valueFunc
   * state:{value, dynamic, offset}
   * 
   */

  function toState(sources, states, offset, options={}) {
      let {valueFunc, stateFunc} = options; 
      if (valueFunc != undefined) {
          let value = valueFunc({sources, states, offset});
          let dynamic = states.map((v) => v.dymamic).some(e=>e);
          return {value, dynamic, offset};
      } else if (stateFunc != undefined) {
          return {...stateFunc({sources, states, offset}), offset};
      }
      // no valueFunc or stateFunc
      if (states.length == 0) {
          return {value:undefined, dynamic:false, offset}
      }
      // fallback - just use first state
      let state = states[0];
      return {...state, offset}; 
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
          addToInstance$1(this);
      }
      now () {
          throw new Error("not implemented");
      }
  }
  addToPrototype$1(ClockProviderBase.prototype);


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
          addToInstance$1(this);
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
  addToPrototype$1(MotionProviderBase.prototype);




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
          addToInstance$1(this);
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
  addToPrototype$1(StateProviderBase.prototype);

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

  /************************************************
   * LAYER
   ************************************************/

  /**
   * Layer is abstract base class for Layers
   * 
   * Layer interface is defined by (index, CacheClass, valueFunc)
   */

  class Layer {

      constructor(options={}) {
          let {queryFuncs, CacheClass} = options;
          // callbacks
          addToInstance$1(this);
          // layer query api
          addToInstance$2(this, queryFuncs, CacheClass || LayerCache);
          // define change event
          eventifyInstance(this);
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
  addToPrototype$1(Layer.prototype);
  addToPrototype$2(Layer.prototype);
  eventifyPrototype(Layer.prototype);


  /************************************************
   * LAYER CACHE
   ************************************************/

  /**
   * This implements a Cache to be used with Layer objects
   * Query results are obtained from the src objects in the
   * layer index.
   * and cached only if they describe a static value. 
   */

  class LayerCache {

      constructor(layer) {
          this._layer = layer;
          // cached nearby state
          this._nearby;
          // cached result
          this._state;
          // src cache objects (src -> cache)
          this._cache_map = new Map();
          this._caches;
      }

      /**
       * query cache
       */
      query(offset) {
          const need_nearby = (
              this._nearby == undefined ||
              !interval.covers_point(this._nearby.itv, offset)
          );
          if (
              !need_nearby && 
              this._state != undefined &&
              !this._state.dynamic
          ) {
              // cache hit
              return {...this._state, offset};
          }
          // cache miss
          if (need_nearby) {
              this._nearby = this._layer.index.nearby(offset);
              console.log(this._nearby.center);
              this._caches = this._nearby.center
                  // map to layer
                  .map((item) => item.src)
                  // map to cache object
                  .map((layer) => {
                      if (!this._cache_map.has(layer)) {
                          this._cache_map.set(layer, layer.getCache());
                      }
                      return this._cache_map.get(layer);
                  });
          }
          // perform queries
          const states = this._caches.map((cache) => {
              return cache.query(offset);
          });
          const state = toState(this._caches, states, offset, this._layer.queryOptions);
          // cache state only if not dynamic
          this._state = (state.dynamic) ? undefined : state;
          return state    
      }

      clear() {
          this._itv = undefined;
          this._state = undefined;
          this._caches = undefined;
          this._cache_map = new Map();
      }
  }

  /**
   * Layer with a StateProvider as src
   */

  class StateLayer extends Layer {

      constructor(options={}) {
          const {queryFuncs} = options;
          super({queryFuncs, CacheClass:StateLayerCache});
          // setup src propterty
          addToInstance(this);
          this.srcpropRegister("src");
      }

      propCheck(propName, src) {
          if (propName == "src") {
              if (!(src instanceof StateProviderBase)) {
                  throw new Error(`"src" must be state provider ${src}`);
              }
              return src;    
          }
      }

      propChange(propName, eArg) {
          if (propName == "src") {
              if (this.index == undefined || eArg == "reset") {
                  this.index = new NearbyIndexSimple(this.src);
              } else {
                  this.clearCaches();
              }
              this.notify_callbacks();
              this.eventifyTrigger("change");
          }        
      }
  }
  addToPrototype(StateLayer.prototype);

  /*********************************************************************
      LAYER FACTORY
  *********************************************************************/

  function getLayer(options={}) {
      let {src, items, ...opts} = options;
      if (src == undefined) {
          src = new LocalStateProvider({items});
      }
      const layer = new StateLayer(opts);
      layer.src = src;
      return layer;
  }


  /*********************************************************************
      STATE LAYER CACHE
  *********************************************************************/

  /*
      Layer with a StateProvider uses a specific cache implementation.    

      Since Source Layer has a state provider, its index is
      items, and the cache will instantiate segments corresponding to
      these items. 
  */

  class StateLayerCache {
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
          return toState(this._segments, states, offset, this._layer.queryOptions)
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

  /**
   * 
   * This implements a merge operation for layers.
   * List of sources is immutable.
   * 
   */

  function merge (sources, options) {

      const layer = new Layer(options);
      layer.index = new MergeIndex(sources);

      // getter for sources
      Object.defineProperty(layer, "sources", {
          get: function () {
              return sources;
          }
      });
   
      // subscrive to change callbacks from sources 
      function handle_src_change(eArg) {
          layer.clearCaches();
          layer.notify_callback();
          layer.eventifyTrigger("change"); 
      }
      for (let src of sources) {
          src.add_callback(handle_src_change);            
      }
      return layer;
  }


  /**
   * Merging indexes from multiple sources into a single index.
   * 
   * A source is an object with an index.
   * - layer (cursor)
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

  function cmp_ascending(p1, p2) {
      return endpoint.cmp(p1, p2)
  }

  function cmp_descending(p1, p2) {
      return endpoint.cmp(p2, p1)
  }

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
              if (center.length > 0) {
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

  function skewed(p, offset) {
      if (p == undefined || !isFinite(p)) {
          // p - no skew
          return p;
      }
      else if (typeof p == "number") {
          // p is number - skew
          return p + offset;
      } else if (Array.isArray(p) && p.length > 1) {
          // p is endpoint - skew value
          let [val, sign] = p;
          return [val + offset, sign];
      }
  }


  /*********************************************************************
      SKEW INDEX
  *********************************************************************/

  class SkewedIndex extends NearbyIndexBase {

      constructor (layer, skew) {
          super();
          this._layer = layer;
          this._skew = skew;
      }
      nearby(offset) {
          // skew lookup (negative)
          const nearby = this._layer.index.nearby(skewed(offset, -this._skew));
          // skew result (positive) 
          nearby.itv[0] = skewed(nearby.itv[0], this._skew);
          nearby.itv[1] = skewed(nearby.itv[1], this._skew);
          nearby.left = skewed(nearby.left, this._skew);
          nearby.right = skewed(nearby.right, this._skew);
          nearby.prev = skewed(nearby.prev, this._skew);
          nearby.next = skewed(nearby.next, this._skew);
          nearby.center = nearby.center.map((item) => {
              return {src:this._layer}
          });
          return nearby;
      }
  }


  /*********************************************************************
      SKEW LAYER
  *********************************************************************/

  /**
   * Todo - make SkewLayer use a dynamic Skew Cursor
   * as ctrl.
   */


  class SkewLayer extends Layer {

      constructor(layer, skew, options={}) {
          super(options);
          this._skew = skew;
          // setup src propterty
          addToInstance(this);
          this.srcpropRegister("src");
          this.src = layer;
      }

      propCheck(propName, src) {
          if (propName == "src") {
              if (!(src instanceof Layer)) {
                  throw new Error(`"src" must be Layer ${src}`);
              }
              return src;    
          }
      }

      propChange(propName, eArg) {
          if (propName == "src") {
              console.log("create index");
              if (this.index == undefined || eArg == "reset") {
                  this.index = new SkewedIndex(this.src, this._skew);
              } else {
                  this.clearCaches();
              }
              this.notify_callbacks();
              this.eventifyTrigger("change");    
          }
      }
  }
  addToPrototype(SkewLayer.prototype);

  /**
   * Skewing a Layer by an offset
   * 
   * a positive value for offset means that
   * the layer is shifted to the right on the timeline
   * 
   * 
   */

  function skew (layer, offset) {
      return new SkewLayer(layer, offset);
  }

  exports.getLayer = getLayer;
  exports.merge = merge;
  exports.skew = skew;

  return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pbnRlcnZhbHMuanMiLCIuLi8uLi9zcmMvbmVhcmJ5aW5kZXguanMiLCIuLi8uLi9zcmMvYXBpX2V2ZW50aWZ5LmpzIiwiLi4vLi4vc3JjL2FwaV9sYXllcnF1ZXJ5LmpzIiwiLi4vLi4vc3JjL2FwaV9jYWxsYmFjay5qcyIsIi4uLy4uL3NyYy9hcGlfc3JjcHJvcC5qcyIsIi4uLy4uL3NyYy9zZWdtZW50cy5qcyIsIi4uLy4uL3NyYy91dGlsLmpzIiwiLi4vLi4vc3JjL3N0YXRlcHJvdmlkZXJfYmFzZXMuanMiLCIuLi8uLi9zcmMvc3RhdGVwcm92aWRlcl9zaW1wbGUuanMiLCIuLi8uLi9zcmMvbmVhcmJ5aW5kZXhfc2ltcGxlLmpzIiwiLi4vLi4vc3JjL2xheWVycy5qcyIsIi4uLy4uL3NyYy9vcHMvbWVyZ2UuanMiLCIuLi8uLi9zcmMvb3BzL3NrZXcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gICAgKiBcbiAgICAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAgICAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICAgICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gICAgKiBcbiAgICAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICAgICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAgICAqIFxuICAgICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG5cbiovXG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuXG5cbiAgICBOT1RFIFxuICAgIC0gY21wKDRdLFs0ICkgPT0gMCAtIHNpbmNlIHRoZXNlIGFyZSB0aGUgc2FtZSB3aXRoIHJlc3BlY3QgdG8gc29ydGluZ1xuICAgIC0gYnV0IGlmIHlvdSB3YW50IHRvIHNlZSBpZiB0d28gaW50ZXJ2YWxzIGFyZSBvdmVybGFwcGluZyBpbiB0aGUgZW5kcG9pbnRzXG4gICAgY21wKGhpZ2hfYSwgbG93X2IpID4gMCB0aGlzIHdpbGwgbm90IGJlIGdvb2RcbiAgICBcbiovIFxuXG5cbmZ1bmN0aW9uIGNtcE51bWJlcnMoYSwgYikge1xuICAgIGlmIChhID09PSBiKSByZXR1cm4gMDtcbiAgICBpZiAoYSA9PT0gSW5maW5pdHkpIHJldHVybiAxO1xuICAgIGlmIChiID09PSBJbmZpbml0eSkgcmV0dXJuIC0xO1xuICAgIGlmIChhID09PSAtSW5maW5pdHkpIHJldHVybiAtMTtcbiAgICBpZiAoYiA9PT0gLUluZmluaXR5KSByZXR1cm4gMTtcbiAgICByZXR1cm4gYSAtIGI7XG4gIH1cblxuZnVuY3Rpb24gZW5kcG9pbnRfY21wIChwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICBsZXQgZGlmZiA9IGNtcE51bWJlcnModjEsIHYyKTtcbiAgICByZXR1cm4gKGRpZmYgIT0gMCkgPyBkaWZmIDogczEgLSBzMjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludCB0byB0aGUgb3RoZXIgc2lkZVxuICogXG4gKiB1c2VmdWwgZm9yIG1ha2luZyBiYWNrLXRvLWJhY2sgaW50ZXJ2YWxzIFxuICogXG4gKiBoaWdoKSA8LT4gW2xvd1xuICogaGlnaF0gPC0+IChsb3dcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKHAsIHRhcmdldCkge1xuICAgIGxldCBbdixzXSA9IHA7XG4gICAgaWYgKCFpc0Zpbml0ZSh2KSkge1xuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgaWYgKHRhcmdldCA9PSBcImxvd1wiKSB7XG4gICAgXHQvLyBhc3N1bWUgcG9pbnQgaXMgaGlnaDogc2lnbiBtdXN0IGJlIC0xIG9yIDBcbiAgICBcdGlmIChzID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBsb3dcIik7ICAgIFx0XHRcbiAgICBcdH1cbiAgICAgICAgcCA9IFt2LCBzKzFdO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09IFwiaGlnaFwiKSB7XG5cdFx0Ly8gYXNzdW1lIHBvaW50IGlzIGxvdzogc2lnbiBpcyAwIG9yIDFcbiAgICBcdGlmIChzIDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBoaWdoXCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcy0xXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0eXBlXCIsIHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBsZXQgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBsZXQgbG93X3AgPSAobG93Q2xvc2VkKSA/IFtsb3csIDBdIDogW2xvdywgMV07IFxuICAgIGxldCBoaWdoX3AgPSAoaGlnaENsb3NlZCkgPyBbaGlnaCwgMF0gOiBbaGlnaCwgLTFdO1xuICAgIHJldHVybiBbbG93X3AsIGhpZ2hfcF07XG59XG5cblxuLypcbiAgICBJTlRFUlZBTFNcblxuICAgIEludGVydmFscyBhcmUgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXVxuXG4qLyBcblxuLypcbiAgICByZXR1cm4gdHJ1ZSBpZiBwb2ludCBwIGlzIGNvdmVyZWQgYnkgaW50ZXJ2YWwgaXR2XG4gICAgcG9pbnQgcCBjYW4gYmUgbnVtYmVyIHAgb3IgYSBwb2ludCBbcCxzXVxuXG4gICAgaW1wbGVtZW50ZWQgYnkgY29tcGFyaW5nIHBvaW50c1xuICAgIGV4Y2VwdGlvbiBpZiBpbnRlcnZhbCBpcyBub3QgZGVmaW5lZFxuKi9cbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19lbmRwb2ludChpdHYsIHApIHtcbiAgICBsZXQgW2xvd19wLCBoaWdoX3BdID0gZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWwoaXR2KTtcbiAgICAvLyBjb3ZlcnM6IGxvdyA8PSBwIDw9IGhpZ2hcbiAgICByZXR1cm4gZW5kcG9pbnRfbGUobG93X3AsIHApICYmIGVuZHBvaW50X2xlKHAsIGhpZ2hfcCk7XG59XG4vLyBjb252ZW5pZW5jZVxuZnVuY3Rpb24gaW50ZXJ2YWxfY292ZXJzX3BvaW50KGl0diwgcCkge1xuICAgIHJldHVybiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBbcCwgMF0pO1xufVxuXG5cblxuLypcbiAgICBSZXR1cm4gdHJ1ZSBpZiBpbnRlcnZhbCBoYXMgbGVuZ3RoIDBcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9pc19zaW5ndWxhcihpbnRlcnZhbCkge1xuICAgIHJldHVybiBpbnRlcnZhbFswXSA9PSBpbnRlcnZhbFsxXVxufVxuXG4vKlxuICAgIENyZWF0ZSBpbnRlcnZhbCBmcm9tIGVuZHBvaW50c1xuKi9cbmZ1bmN0aW9uIGludGVydmFsX2Zyb21fZW5kcG9pbnRzKHAxLCBwMikge1xuICAgIGxldCBbdjEsIHMxXSA9IHAxO1xuICAgIGxldCBbdjIsIHMyXSA9IHAyO1xuICAgIC8vIHAxIG11c3QgYmUgYSBsb3cgcG9pbnRcbiAgICBpZiAoczEgPT0gLTEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCBsb3cgcG9pbnRcIiwgcDEpO1xuICAgIH1cbiAgICBpZiAoczIgPT0gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2VhbCBoaWdoIHBvaW50XCIsIHAyKTsgICBcbiAgICB9XG4gICAgcmV0dXJuIFt2MSwgdjIsIChzMT09MCksIChzMj09MCldXG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKG4pIHtcbiAgICByZXR1cm4gdHlwZW9mIG4gPT0gXCJudW1iZXJcIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGludGVydmFsX2Zyb21faW5wdXQoaW5wdXQpe1xuICAgIGxldCBpdHYgPSBpbnB1dDtcbiAgICBpZiAoaXR2ID09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnB1dCBpcyB1bmRlZmluZWRcIik7XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShpdHYpKSB7XG4gICAgICAgIGlmIChpc051bWJlcihpdHYpKSB7XG4gICAgICAgICAgICAvLyBpbnB1dCBpcyBzaW5ndWxhciBudW1iZXJcbiAgICAgICAgICAgIGl0diA9IFtpdHYsIGl0diwgdHJ1ZSwgdHJ1ZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlucHV0OiAke2lucHV0fTogbXVzdCBiZSBBcnJheSBvciBOdW1iZXJgKVxuICAgICAgICB9XG4gICAgfTtcbiAgICAvLyBtYWtlIHN1cmUgaW50ZXJ2YWwgaXMgbGVuZ3RoIDRcbiAgICBpZiAoaXR2Lmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGl0diA9IFtpdHZbMF0sIGl0dlswXSwgdHJ1ZSwgdHJ1ZV1cbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMikge1xuICAgICAgICBpdHYgPSBpdHYuY29uY2F0KFt0cnVlLCBmYWxzZV0pO1xuICAgIH0gZWxzZSBpZiAoaXR2Lmxlbmd0aCA9PSAzKSB7XG4gICAgICAgIGl0diA9IGl0di5wdXNoKGZhbHNlKTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPiA0KSB7XG4gICAgICAgIGl0diA9IGl0di5zbGljZSgwLDQpO1xuICAgIH1cbiAgICBsZXQgW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdID0gaXR2O1xuICAgIC8vIHVuZGVmaW5lZFxuICAgIGlmIChsb3cgPT0gdW5kZWZpbmVkIHx8IGxvdyA9PSBudWxsKSB7XG4gICAgICAgIGxvdyA9IC1JbmZpbml0eTtcbiAgICB9XG4gICAgaWYgKGhpZ2ggPT0gdW5kZWZpbmVkIHx8IGhpZ2ggPT0gbnVsbCkge1xuICAgICAgICBoaWdoID0gSW5maW5pdHk7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93IGFuZCBoaWdoIGFyZSBudW1iZXJzXG4gICAgaWYgKCFpc051bWJlcihsb3cpKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgbm90IGEgbnVtYmVyXCIsIGxvdyk7XG4gICAgaWYgKCFpc051bWJlcihoaWdoKSkgdGhyb3cgbmV3IEVycm9yKFwiaGlnaCBub3QgYSBudW1iZXJcIiwgaGlnaCk7XG4gICAgLy8gY2hlY2sgdGhhdCBsb3cgPD0gaGlnaFxuICAgIGlmIChsb3cgPiBoaWdoKSB0aHJvdyBuZXcgRXJyb3IoXCJsb3cgPiBoaWdoXCIsIGxvdywgaGlnaCk7XG4gICAgLy8gc2luZ2xldG9uXG4gICAgaWYgKGxvdyA9PSBoaWdoKSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIGluZmluaXR5IHZhbHVlc1xuICAgIGlmIChsb3cgPT0gLUluZmluaXR5KSB7XG4gICAgICAgIGxvd0luY2x1ZGUgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoaGlnaCA9PSBJbmZpbml0eSkge1xuICAgICAgICBoaWdoSW5jbHVkZSA9IHRydWU7XG4gICAgfVxuICAgIC8vIGNoZWNrIHRoYXQgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGUgYXJlIGJvb2xlYW5zXG4gICAgaWYgKHR5cGVvZiBsb3dJbmNsdWRlICE9PSBcImJvb2xlYW5cIikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJsb3dJbmNsdWRlIG5vdCBib29sZWFuXCIpO1xuICAgIH0gXG4gICAgaWYgKHR5cGVvZiBoaWdoSW5jbHVkZSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaGlnaEluY2x1ZGUgbm90IGJvb2xlYW5cIik7XG4gICAgfVxuICAgIHJldHVybiBbbG93LCBoaWdoLCBsb3dJbmNsdWRlLCBoaWdoSW5jbHVkZV07XG59XG5cblxuXG5cbmV4cG9ydCBjb25zdCBlbmRwb2ludCA9IHtcbiAgICBsZTogZW5kcG9pbnRfbGUsXG4gICAgbHQ6IGVuZHBvaW50X2x0LFxuICAgIGdlOiBlbmRwb2ludF9nZSxcbiAgICBndDogZW5kcG9pbnRfZ3QsXG4gICAgY21wOiBlbmRwb2ludF9jbXAsXG4gICAgZXE6IGVuZHBvaW50X2VxLFxuICAgIG1pbjogZW5kcG9pbnRfbWluLFxuICAgIG1heDogZW5kcG9pbnRfbWF4LFxuICAgIGZsaXA6IGVuZHBvaW50X2ZsaXAsXG4gICAgZnJvbV9pbnRlcnZhbDogZW5kcG9pbnRzX2Zyb21faW50ZXJ2YWxcbn1cbmV4cG9ydCBjb25zdCBpbnRlcnZhbCA9IHtcbiAgICBjb3ZlcnNfZW5kcG9pbnQ6IGludGVydmFsX2NvdmVyc19lbmRwb2ludCxcbiAgICBjb3ZlcnNfcG9pbnQ6IGludGVydmFsX2NvdmVyc19wb2ludCwgXG4gICAgaXNfc2luZ3VsYXI6IGludGVydmFsX2lzX3Npbmd1bGFyLFxuICAgIGZyb21fZW5kcG9pbnRzOiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyxcbiAgICBmcm9tX2lucHV0OiBpbnRlcnZhbF9mcm9tX2lucHV0XG59XG4iLCJpbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTkVBUkJZIElOREVYXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogQWJzdHJhY3Qgc3VwZXJjbGFzcyBmb3IgTmVhcmJ5SW5kZXhlLlxuICogXG4gKiBTdXBlcmNsYXNzIHVzZWQgdG8gY2hlY2sgdGhhdCBhIGNsYXNzIGltcGxlbWVudHMgdGhlIG5lYXJieSgpIG1ldGhvZCwgXG4gKiBhbmQgcHJvdmlkZSBzb21lIGNvbnZlbmllbmNlIG1ldGhvZHMuXG4gKiBcbiAqIE5FQVJCWSBJTkRFWFxuICogXG4gKiBOZWFyYnlJbmRleCBwcm92aWRlcyBpbmRleGluZyBzdXBwb3J0IG9mIGVmZmVjdGl2ZWx5bG9va2luZyB1cCBJVEVNUyBieSBvZmZzZXQsIFxuICogZ2l2ZW4gdGhhdFxuICogKGkpIGVhY2ggZW50cml5IGlzIGFzc29jaWF0ZWQgd2l0aCBhbiBpbnRlcnZhbCBhbmQsXG4gKiAoaWkpIGVudHJpZXMgYXJlIG5vbi1vdmVybGFwcGluZy5cbiAqIEVhY2ggSVRFTSBtdXN0IGJlIGFzc29jaWF0ZWQgd2l0aCBhbiBpbnRlcnZhbCBvbiB0aGUgdGltZWxpbmUgXG4gKiBcbiAqIE5FQVJCWVxuICogVGhlIG5lYXJieSBtZXRob2QgcmV0dXJucyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgbmVpZ2hib3Job29kIGFyb3VuZCBlbmRwb2ludC4gXG4gKiBcbiAqIFByaW1hcnkgdXNlIGlzIGZvciBpdGVyYXRpb24gXG4gKiBcbiAqIFJldHVybnMge1xuICogICAgICBjZW50ZXI6IGxpc3Qgb2YgSVRFTVMgY292ZXJpbmcgZW5kcG9pbnQsXG4gKiAgICAgIGl0djogaW50ZXJ2YWwgd2hlcmUgbmVhcmJ5IHJldHVybnMgaWRlbnRpY2FsIHtjZW50ZXJ9XG4gKiAgICAgIGxlZnQ6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgbGVmdCBcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQge2NlbnRlcn1cbiAqICAgICAgICAgIGFsd2F5cyBhIGhpZ2gtZW5kcG9pbnQgb3IgdW5kZWZpbmVkXG4gKiAgICAgIHJpZ2h0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0XG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBsb3ctZW5kcG9pbnQgb3IgdW5kZWZpbmVkICAgICAgICAgXG4gKiAgICAgIHByZXY6XG4gKiAgICAgICAgICBmaXJzdCBpbnRlcnZhbCBlbmRwb2ludCB0byB0aGUgbGVmdCBcbiAqICAgICAgICAgIHdoaWNoIHdpbGwgcHJvZHVjZSBkaWZmZXJlbnQgJiYgbm9uLWVtcHR5IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBoaWdoLWVuZHBvaW50IG9yIHVuZGVmaW5lZCBpZiBubyBtb3JlIGludGVydmFscyB0byB0aGUgbGVmdFxuICogICAgICBuZXh0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0XG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50ICYmIG5vbi1lbXB0eSB7Y2VudGVyfVxuICogICAgICAgICAgYWx3YXlzIGEgbG93LWVuZHBvaW50IG9yIHVuZGVmaW5lZCBpZiBubyBtb3JlIGludGVydmFscyB0byB0aGUgcmlnaHRcbiAqIH1cbiAqIFxuICogXG4gKiBUaGUgbmVhcmJ5IHN0YXRlIGlzIHdlbGwtZGVmaW5lZCBmb3IgZXZlcnkgdGltZWxpbmUgcG9zaXRpb24uXG4gKiBcbiAqIFxuICogTk9URSBsZWZ0L3JpZ2h0IGFuZCBwcmV2L25leHQgYXJlIG1vc3RseSB0aGUgc2FtZS4gVGhlIG9ubHkgZGlmZmVyZW5jZSBpcyBcbiAqIHRoYXQgcHJldi9uZXh0IHdpbGwgc2tpcCBvdmVyIHJlZ2lvbnMgd2hlcmUgdGhlcmUgYXJlIG5vIGludGVydmFscy4gVGhpc1xuICogZW5zdXJlcyBwcmFjdGljYWwgaXRlcmF0aW9uIG9mIGl0ZW1zIGFzIHByZXYvbmV4dCB3aWxsIG9ubHkgYmUgdW5kZWZpbmVkICBcbiAqIGF0IHRoZSBlbmQgb2YgaXRlcmF0aW9uLlxuICogXG4gKiBJTlRFUlZBTFNcbiAqIFxuICogW2xvdywgaGlnaCwgbG93SW5jbHVzaXZlLCBoaWdoSW5jbHVzaXZlXVxuICogXG4gKiBUaGlzIHJlcHJlc2VudGF0aW9uIGVuc3VyZXMgdGhhdCB0aGUgaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBvcmRlcmVkIGFuZCBhbGxvd3NcbiAqIGludGVydmFscyB0byBiZSBleGNsdXNpdmUgb3IgaW5jbHVzaXZlLCB5ZXQgY292ZXIgdGhlIGVudGlyZSByZWFsIGxpbmUgXG4gKiBcbiAqIFthLGJdLCAoYSxiKSwgW2EsYiksIFthLCBiKSBhcmUgYWxsIHZhbGlkIGludGVydmFsc1xuICogXG4gKiBcbiAqIElOVEVSVkFMIEVORFBPSU5UU1xuICogXG4gKiBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIGRlZmluZWQgYnkgW3ZhbHVlLCBzaWduXSwgZm9yIGV4YW1wbGVcbiAqIFxuICogNCkgLT4gWzQsLTFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIGxlZnQgb2YgNFxuICogWzQsIDQsIDRdIC0+IFs0LCAwXSAtIGVuZHBvaW50IGlzIGF0IDQgXG4gKiAoNCAtPiBbNCwgMV0gLSBlbmRwb2ludCBpcyBvbiB0aGUgcmlnaHQgb2YgNClcbiAqIFxuICogLyAqL1xuXG4gZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4QmFzZSB7XG5cblxuICAgIC8qIFxuICAgICAgICBOZWFyYnkgbWV0aG9kXG4gICAgKi9cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cblxuICAgIC8qXG4gICAgICAgIHJldHVybiBsb3cgcG9pbnQgb2YgbGVmdG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGZpcnN0KCkge1xuICAgICAgICBsZXQge2NlbnRlciwgcmlnaHR9ID0gdGhpcy5uZWFyYnkoWy1JbmZpbml0eSwgMF0pO1xuICAgICAgICByZXR1cm4gKGNlbnRlci5sZW5ndGggPiAwKSA/IFstSW5maW5pdHksIDBdIDogcmlnaHQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGhpZ2ggcG9pbnQgb2YgcmlnaHRtb3N0IGVudHJ5XG4gICAgKi9cbiAgICBsYXN0KCkge1xuICAgICAgICBsZXQge2xlZnQsIGNlbnRlcn0gPSB0aGlzLm5lYXJieShbSW5maW5pdHksIDBdKTtcbiAgICAgICAgcmV0dXJuIChjZW50ZXIubGVuZ3RoID4gMCkgPyBbSW5maW5pdHksIDBdIDogbGVmdFxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIExpc3QgaXRlbXMgb2YgTmVhcmJ5SW5kZXggKG9yZGVyIGxlZnQgdG8gcmlnaHQpXG4gICAgICAgIGludGVydmFsIGRlZmluZXMgW3N0YXJ0LCBlbmRdIG9mZnNldCBvbiB0aGUgdGltZWxpbmUuXG4gICAgICAgIFJldHVybnMgbGlzdCBvZiBpdGVtLWxpc3RzLlxuICAgICAgICBvcHRpb25zXG4gICAgICAgIC0gc3RhcnRcbiAgICAgICAgLSBzdG9wXG4gICAgKi9cbiAgICBsaXN0KG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtzdGFydD0tSW5maW5pdHksIHN0b3A9SW5maW5pdHl9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHN0YXJ0ID4gc3RvcCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIChcInN0b3AgbXVzdCBiZSBsYXJnZXIgdGhhbiBzdGFydFwiLCBzdGFydCwgc3RvcClcbiAgICAgICAgfVxuICAgICAgICBzdGFydCA9IFtzdGFydCwgMF07XG4gICAgICAgIHN0b3AgPSBbc3RvcCwgMF07XG4gICAgICAgIGxldCBjdXJyZW50ID0gc3RhcnQ7XG4gICAgICAgIGxldCBuZWFyYnk7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICAgICAgbGV0IGxpbWl0ID0gNVxuICAgICAgICB3aGlsZSAobGltaXQpIHtcbiAgICAgICAgICAgIGlmIChlbmRwb2ludC5ndChjdXJyZW50LCBzdG9wKSkge1xuICAgICAgICAgICAgICAgIC8vIGV4aGF1c3RlZFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmVhcmJ5ID0gdGhpcy5uZWFyYnkoY3VycmVudCk7XG4gICAgICAgICAgICBpZiAobmVhcmJ5LmNlbnRlci5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgICAgIC8vIGNlbnRlciBlbXB0eSAodHlwaWNhbGx5IGZpcnN0IGl0ZXJhdGlvbilcbiAgICAgICAgICAgICAgICBpZiAobmVhcmJ5LnJpZ2h0ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAvLyByaWdodCB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gbm8gZW50cmllcyAtIGFscmVhZHkgZXhoYXVzdGVkXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IGRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IG9mZnNldFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gbmVhcmJ5LnJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKG5lYXJieS5jZW50ZXIpO1xuICAgICAgICAgICAgICAgIGlmIChuZWFyYnkucmlnaHQgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAvLyBsYXN0IGVudHJ5IC0gbWFyayBpdGVyYWN0b3IgZXhoYXVzdGVkXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IGRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IG9mZnNldFxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gbmVhcmJ5LnJpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxpbWl0LS07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxufVxuXG5cblxuXG5cbiIsIi8qXG5cdENvcHlyaWdodCAyMDIwXG5cdEF1dGhvciA6IEluZ2FyIEFybnR6ZW5cblxuXHRUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgVGltaW5nc3JjIG1vZHVsZS5cblxuXHRUaW1pbmdzcmMgaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeVxuXHRpdCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIEdOVSBMZXNzZXIgR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhcyBwdWJsaXNoZWQgYnlcblx0dGhlIEZyZWUgU29mdHdhcmUgRm91bmRhdGlvbiwgZWl0aGVyIHZlcnNpb24gMyBvZiB0aGUgTGljZW5zZSwgb3Jcblx0KGF0IHlvdXIgb3B0aW9uKSBhbnkgbGF0ZXIgdmVyc2lvbi5cblxuXHRUaW1pbmdzcmMgaXMgZGlzdHJpYnV0ZWQgaW4gdGhlIGhvcGUgdGhhdCBpdCB3aWxsIGJlIHVzZWZ1bCxcblx0YnV0IFdJVEhPVVQgQU5ZIFdBUlJBTlRZOyB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2Zcblx0TUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLiAgU2VlIHRoZVxuXHRHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgZm9yIG1vcmUgZGV0YWlscy5cblxuXHRZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2Vcblx0YWxvbmcgd2l0aCBUaW1pbmdzcmMuICBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz4uXG4qL1xuXG5cblxuLypcblx0RXZlbnRcblx0LSBuYW1lOiBldmVudCBuYW1lXG5cdC0gcHVibGlzaGVyOiB0aGUgb2JqZWN0IHdoaWNoIGRlZmluZWQgdGhlIGV2ZW50XG5cdC0gaW5pdDogdHJ1ZSBpZiB0aGUgZXZlbnQgc3VwcHBvcnRzIGluaXQgZXZlbnRzXG5cdC0gc3Vic2NyaXB0aW9uczogc3Vic2NyaXB0aW5zIHRvIHRoaXMgZXZlbnRcblxuKi9cblxuY2xhc3MgRXZlbnQge1xuXG5cdGNvbnN0cnVjdG9yIChwdWJsaXNoZXIsIG5hbWUsIG9wdGlvbnMpIHtcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXHRcdHRoaXMucHVibGlzaGVyID0gcHVibGlzaGVyO1xuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdFx0dGhpcy5pbml0ID0gKG9wdGlvbnMuaW5pdCA9PT0gdW5kZWZpbmVkKSA/IGZhbHNlIDogb3B0aW9ucy5pbml0O1xuXHRcdHRoaXMuc3Vic2NyaXB0aW9ucyA9IFtdO1xuXHR9XG5cblx0Lypcblx0XHRzdWJzY3JpYmUgdG8gZXZlbnRcblx0XHQtIHN1YnNjcmliZXI6IHN1YnNjcmliaW5nIG9iamVjdFxuXHRcdC0gY2FsbGJhY2s6IGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGludm9rZVxuXHRcdC0gb3B0aW9uczpcblx0XHRcdGluaXQ6IGlmIHRydWUgc3Vic2NyaWJlciB3YW50cyBpbml0IGV2ZW50c1xuXHQqL1xuXHRzdWJzY3JpYmUgKGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0aWYgKCFjYWxsYmFjayB8fCB0eXBlb2YgY2FsbGJhY2sgIT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiQ2FsbGJhY2sgbm90IGEgZnVuY3Rpb25cIiwgY2FsbGJhY2spO1xuXHRcdH1cblx0XHRjb25zdCBzdWIgPSBuZXcgU3Vic2NyaXB0aW9uKHRoaXMsIGNhbGxiYWNrLCBvcHRpb25zKTtcblx0XHR0aGlzLnN1YnNjcmlwdGlvbnMucHVzaChzdWIpO1xuXHQgICAgLy8gSW5pdGlhdGUgaW5pdCBjYWxsYmFjayBmb3IgdGhpcyBzdWJzY3JpcHRpb25cblx0ICAgIGlmICh0aGlzLmluaXQgJiYgc3ViLmluaXQpIHtcblx0ICAgIFx0c3ViLmluaXRfcGVuZGluZyA9IHRydWU7XG5cdCAgICBcdGxldCBzZWxmID0gdGhpcztcblx0ICAgIFx0UHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbiAoKSB7XG5cdCAgICBcdFx0Y29uc3QgZUFyZ3MgPSBzZWxmLnB1Ymxpc2hlci5ldmVudGlmeUluaXRFdmVudEFyZ3Moc2VsZi5uYW1lKSB8fCBbXTtcblx0ICAgIFx0XHRzdWIuaW5pdF9wZW5kaW5nID0gZmFsc2U7XG5cdCAgICBcdFx0Zm9yIChsZXQgZUFyZyBvZiBlQXJncykge1xuXHQgICAgXHRcdFx0c2VsZi50cmlnZ2VyKGVBcmcsIFtzdWJdLCB0cnVlKTtcblx0ICAgIFx0XHR9XG5cdCAgICBcdH0pO1xuXHQgICAgfVxuXHRcdHJldHVybiBzdWJcblx0fVxuXG5cdC8qXG5cdFx0dHJpZ2dlciBldmVudFxuXG5cdFx0LSBpZiBzdWIgaXMgdW5kZWZpbmVkIC0gcHVibGlzaCB0byBhbGwgc3Vic2NyaXB0aW9uc1xuXHRcdC0gaWYgc3ViIGlzIGRlZmluZWQgLSBwdWJsaXNoIG9ubHkgdG8gZ2l2ZW4gc3Vic2NyaXB0aW9uXG5cdCovXG5cdHRyaWdnZXIgKGVBcmcsIHN1YnMsIGluaXQpIHtcblx0XHRsZXQgZUluZm8sIGN0eDtcblx0XHRmb3IgKGNvbnN0IHN1YiBvZiBzdWJzKSB7XG5cdFx0XHQvLyBpZ25vcmUgdGVybWluYXRlZCBzdWJzY3JpcHRpb25zXG5cdFx0XHRpZiAoc3ViLnRlcm1pbmF0ZWQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRlSW5mbyA9IHtcblx0XHRcdFx0c3JjOiB0aGlzLnB1Ymxpc2hlcixcblx0XHRcdFx0bmFtZTogdGhpcy5uYW1lLFxuXHRcdFx0XHRzdWI6IHN1Yixcblx0XHRcdFx0aW5pdDogaW5pdFxuXHRcdFx0fVxuXHRcdFx0Y3R4ID0gc3ViLmN0eCB8fCB0aGlzLnB1Ymxpc2hlcjtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHN1Yi5jYWxsYmFjay5jYWxsKGN0eCwgZUFyZywgZUluZm8pO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBFcnJvciBpbiAke3RoaXMubmFtZX06ICR7c3ViLmNhbGxiYWNrfSAke2Vycn1gKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKlxuXHR1bnN1YnNjcmliZSBmcm9tIGV2ZW50XG5cdC0gdXNlIHN1YnNjcmlwdGlvbiByZXR1cm5lZCBieSBwcmV2aW91cyBzdWJzY3JpYmVcblx0Ki9cblx0dW5zdWJzY3JpYmUoc3ViKSB7XG5cdFx0bGV0IGlkeCA9IHRoaXMuc3Vic2NyaXB0aW9ucy5pbmRleE9mKHN1Yik7XG5cdFx0aWYgKGlkeCA+IC0xKSB7XG5cdFx0XHR0aGlzLnN1YnNjcmlwdGlvbnMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRzdWIudGVybWluYXRlKCk7XG5cdFx0fVxuXHR9XG59XG5cblxuLypcblx0U3Vic2NyaXB0aW9uIGNsYXNzXG4qL1xuXG5jbGFzcyBTdWJzY3JpcHRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKGV2ZW50LCBjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG5cdFx0dGhpcy5ldmVudCA9IGV2ZW50O1xuXHRcdHRoaXMubmFtZSA9IGV2ZW50Lm5hbWU7XG5cdFx0dGhpcy5jYWxsYmFjayA9IGNhbGxiYWNrXG5cdFx0dGhpcy5pbml0ID0gKG9wdGlvbnMuaW5pdCA9PT0gdW5kZWZpbmVkKSA/IHRoaXMuZXZlbnQuaW5pdCA6IG9wdGlvbnMuaW5pdDtcblx0XHR0aGlzLmluaXRfcGVuZGluZyA9IGZhbHNlO1xuXHRcdHRoaXMudGVybWluYXRlZCA9IGZhbHNlO1xuXHRcdHRoaXMuY3R4ID0gb3B0aW9ucy5jdHg7XG5cdH1cblxuXHR0ZXJtaW5hdGUoKSB7XG5cdFx0dGhpcy50ZXJtaW5hdGVkID0gdHJ1ZTtcblx0XHR0aGlzLmNhbGxiYWNrID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuZXZlbnQudW5zdWJzY3JpYmUodGhpcyk7XG5cdH1cbn1cblxuXG4vKlxuXG5cdEVWRU5USUZZIElOU1RBTkNFXG5cblx0RXZlbnRpZnkgYnJpbmdzIGV2ZW50aW5nIGNhcGFiaWxpdGllcyB0byBhbnkgb2JqZWN0LlxuXG5cdEluIHBhcnRpY3VsYXIsIGV2ZW50aWZ5IHN1cHBvcnRzIHRoZSBpbml0aWFsLWV2ZW50IHBhdHRlcm4uXG5cdE9wdC1pbiBmb3IgaW5pdGlhbCBldmVudHMgcGVyIGV2ZW50IHR5cGUuXG5cblx0ZXZlbnRpZnlJbml0RXZlbnRBcmdzKG5hbWUpIHtcblx0XHRpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG5cdFx0XHRyZXR1cm4gW3RoaXMuX3ZhbHVlXTtcblx0XHR9XG5cdH1cblxuKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW50aWZ5SW5zdGFuY2UgKG9iamVjdCkge1xuXHRvYmplY3QuX19ldmVudGlmeV9ldmVudE1hcCA9IG5ldyBNYXAoKTtcblx0b2JqZWN0Ll9fZXZlbnRpZnlfYnVmZmVyID0gW107XG5cdHJldHVybiBvYmplY3Q7XG59O1xuXG5cbi8qXG5cdEVWRU5USUZZIFBST1RPVFlQRVxuXG5cdEFkZCBldmVudGlmeSBmdW5jdGlvbmFsaXR5IHRvIHByb3RvdHlwZSBvYmplY3RcbiovXG5cbmV4cG9ydCBmdW5jdGlvbiBldmVudGlmeVByb3RvdHlwZShfcHJvdG90eXBlKSB7XG5cblx0ZnVuY3Rpb24gZXZlbnRpZnlHZXRFdmVudChvYmplY3QsIG5hbWUpIHtcblx0XHRjb25zdCBldmVudCA9IG9iamVjdC5fX2V2ZW50aWZ5X2V2ZW50TWFwLmdldChuYW1lKTtcblx0XHRpZiAoZXZlbnQgPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCB1bmRlZmluZWRcIiwgbmFtZSk7XG5cdFx0fVxuXHRcdHJldHVybiBldmVudDtcblx0fVxuXG5cdC8qXG5cdFx0REVGSU5FIEVWRU5UXG5cdFx0LSB1c2VkIG9ubHkgYnkgZXZlbnQgc291cmNlXG5cdFx0LSBuYW1lOiBuYW1lIG9mIGV2ZW50XG5cdFx0LSBvcHRpb25zOiB7aW5pdDp0cnVlfSBzcGVjaWZpZXMgaW5pdC1ldmVudCBzZW1hbnRpY3MgZm9yIGV2ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5RGVmaW5lKG5hbWUsIG9wdGlvbnMpIHtcblx0XHQvLyBjaGVjayB0aGF0IGV2ZW50IGRvZXMgbm90IGFscmVhZHkgZXhpc3Rcblx0XHRpZiAodGhpcy5fX2V2ZW50aWZ5X2V2ZW50TWFwLmhhcyhuYW1lKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRXZlbnQgYWxyZWFkeSBkZWZpbmVkXCIsIG5hbWUpO1xuXHRcdH1cblx0XHR0aGlzLl9fZXZlbnRpZnlfZXZlbnRNYXAuc2V0KG5hbWUsIG5ldyBFdmVudCh0aGlzLCBuYW1lLCBvcHRpb25zKSk7XG5cdH07XG5cblx0Lypcblx0XHRPTlxuXHRcdC0gdXNlZCBieSBzdWJzY3JpYmVyXG5cdFx0cmVnaXN0ZXIgY2FsbGJhY2sgb24gZXZlbnQuXG5cdCovXG5cdGZ1bmN0aW9uIG9uKG5hbWUsIGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSkuc3Vic2NyaWJlKGNhbGxiYWNrLCBvcHRpb25zKTtcblx0fTtcblxuXHQvKlxuXHRcdE9GRlxuXHRcdC0gdXNlZCBieSBzdWJzY3JpYmVyXG5cdFx0VW4tcmVnaXN0ZXIgYSBoYW5kbGVyIGZyb20gYSBzcGVjZmljIGV2ZW50IHR5cGVcblx0Ki9cblx0ZnVuY3Rpb24gb2ZmKHN1Yikge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIHN1Yi5uYW1lKS51bnN1YnNjcmliZShzdWIpO1xuXHR9O1xuXG5cblx0ZnVuY3Rpb24gZXZlbnRpZnlTdWJzY3JpcHRpb25zKG5hbWUpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKS5zdWJzY3JpcHRpb25zO1xuXHR9XG5cblxuXG5cdC8qXG5cdFx0VHJpZ2dlciBsaXN0IG9mIGV2ZW50SXRlbXMgb24gb2JqZWN0XG5cblx0XHRldmVudEl0ZW06ICB7bmFtZTouLiwgZUFyZzouLn1cblxuXHRcdGNvcHkgYWxsIGV2ZW50SXRlbXMgaW50byBidWZmZXIuXG5cdFx0cmVxdWVzdCBlbXB0eWluZyB0aGUgYnVmZmVyLCBpLmUuIGFjdHVhbGx5IHRyaWdnZXJpbmcgZXZlbnRzLFxuXHRcdGV2ZXJ5IHRpbWUgdGhlIGJ1ZmZlciBnb2VzIGZyb20gZW1wdHkgdG8gbm9uLWVtcHR5XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlckFsbChldmVudEl0ZW1zKSB7XG5cdFx0aWYgKGV2ZW50SXRlbXMubGVuZ3RoID09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBtYWtlIHRyaWdnZXIgaXRlbXNcblx0XHQvLyByZXNvbHZlIG5vbi1wZW5kaW5nIHN1YnNjcmlwdGlvbnMgbm93XG5cdFx0Ly8gZWxzZSBzdWJzY3JpcHRpb25zIG1heSBjaGFuZ2UgZnJvbSBwZW5kaW5nIHRvIG5vbi1wZW5kaW5nXG5cdFx0Ly8gYmV0d2VlbiBoZXJlIGFuZCBhY3R1YWwgdHJpZ2dlcmluZ1xuXHRcdC8vIG1ha2UgbGlzdCBvZiBbZXYsIGVBcmcsIHN1YnNdIHR1cGxlc1xuXHRcdGxldCB0cmlnZ2VySXRlbXMgPSBldmVudEl0ZW1zLm1hcCgoaXRlbSkgPT4ge1xuXHRcdFx0bGV0IHtuYW1lLCBlQXJnfSA9IGl0ZW07XG5cdFx0XHRsZXQgZXYgPSBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpO1xuXHRcdFx0bGV0IHN1YnMgPSBldi5zdWJzY3JpcHRpb25zLmZpbHRlcihzdWIgPT4gc3ViLmluaXRfcGVuZGluZyA9PSBmYWxzZSk7XG5cdFx0XHRyZXR1cm4gW2V2LCBlQXJnLCBzdWJzXTtcblx0XHR9LCB0aGlzKTtcblxuXHRcdC8vIGFwcGVuZCB0cmlnZ2VyIEl0ZW1zIHRvIGJ1ZmZlclxuXHRcdGNvbnN0IGxlbiA9IHRyaWdnZXJJdGVtcy5sZW5ndGg7XG5cdFx0Y29uc3QgYnVmID0gdGhpcy5fX2V2ZW50aWZ5X2J1ZmZlcjtcblx0XHRjb25zdCBidWZfbGVuID0gdGhpcy5fX2V2ZW50aWZ5X2J1ZmZlci5sZW5ndGg7XG5cdFx0Ly8gcmVzZXJ2ZSBtZW1vcnkgLSBzZXQgbmV3IGxlbmd0aFxuXHRcdHRoaXMuX19ldmVudGlmeV9idWZmZXIubGVuZ3RoID0gYnVmX2xlbiArIGxlbjtcblx0XHQvLyBjb3B5IHRyaWdnZXJJdGVtcyB0byBidWZmZXJcblx0XHRmb3IgKGxldCBpPTA7IGk8bGVuOyBpKyspIHtcblx0XHRcdGJ1ZltidWZfbGVuK2ldID0gdHJpZ2dlckl0ZW1zW2ldO1xuXHRcdH1cblx0XHQvLyByZXF1ZXN0IGVtcHR5aW5nIG9mIHRoZSBidWZmZXJcblx0XHRpZiAoYnVmX2xlbiA9PSAwKSB7XG5cdFx0XHRsZXQgc2VsZiA9IHRoaXM7XG5cdFx0XHRQcm9taXNlLnJlc29sdmUoKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRmb3IgKGxldCBbZXYsIGVBcmcsIHN1YnNdIG9mIHNlbGYuX19ldmVudGlmeV9idWZmZXIpIHtcblx0XHRcdFx0XHQvLyBhY3R1YWwgZXZlbnQgdHJpZ2dlcmluZ1xuXHRcdFx0XHRcdGV2LnRyaWdnZXIoZUFyZywgc3VicywgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGYuX19ldmVudGlmeV9idWZmZXIgPSBbXTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdC8qXG5cdFx0VHJpZ2dlciBtdWx0aXBsZSBldmVudHMgb2Ygc2FtZSB0eXBlIChuYW1lKVxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXJBbGlrZShuYW1lLCBlQXJncykge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50aWZ5VHJpZ2dlckFsbChlQXJncy5tYXAoZUFyZyA9PiB7XG5cdFx0XHRyZXR1cm4ge25hbWUsIGVBcmd9O1xuXHRcdH0pKTtcblx0fVxuXG5cdC8qXG5cdFx0VHJpZ2dlciBzaW5nbGUgZXZlbnRcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyKG5hbWUsIGVBcmcpIHtcblx0XHRyZXR1cm4gdGhpcy5ldmVudGlmeVRyaWdnZXJBbGwoW3tuYW1lLCBlQXJnfV0pO1xuXHR9XG5cblx0X3Byb3RvdHlwZS5ldmVudGlmeURlZmluZSA9IGV2ZW50aWZ5RGVmaW5lO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlciA9IGV2ZW50aWZ5VHJpZ2dlcjtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXJBbGlrZSA9IGV2ZW50aWZ5VHJpZ2dlckFsaWtlO1xuXHRfcHJvdG90eXBlLmV2ZW50aWZ5VHJpZ2dlckFsbCA9IGV2ZW50aWZ5VHJpZ2dlckFsbDtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVN1YnNjcmlwdGlvbnMgPSBldmVudGlmeVN1YnNjcmlwdGlvbnM7XG5cdF9wcm90b3R5cGUub24gPSBvbjtcblx0X3Byb3RvdHlwZS5vZmYgPSBvZmY7XG59O1xuXG5cbmV4cG9ydCB7ZXZlbnRpZnlJbnN0YW5jZSBhcyBhZGRUb0luc3RhbmNlfTtcbmV4cG9ydCB7ZXZlbnRpZnlQcm90b3R5cGUgYXMgYWRkVG9Qcm90b3R5cGV9O1xuXG4vKlxuXHRFdmVudCBWYXJpYWJsZVxuXG5cdE9iamVjdHMgd2l0aCBhIHNpbmdsZSBcImNoYW5nZVwiIGV2ZW50XG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRWYXJpYWJsZSB7XG5cblx0Y29uc3RydWN0b3IgKHZhbHVlKSB7XG5cdFx0ZXZlbnRpZnlJbnN0YW5jZSh0aGlzKTtcblx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdHRoaXMuZXZlbnRpZnlEZWZpbmUoXCJjaGFuZ2VcIiwge2luaXQ6dHJ1ZX0pO1xuXHR9XG5cblx0ZXZlbnRpZnlJbml0RXZlbnRBcmdzKG5hbWUpIHtcblx0XHRpZiAobmFtZSA9PSBcImNoYW5nZVwiKSB7XG5cdFx0XHRyZXR1cm4gW3RoaXMuX3ZhbHVlXTtcblx0XHR9XG5cdH1cblxuXHRnZXQgdmFsdWUgKCkge3JldHVybiB0aGlzLl92YWx1ZX07XG5cdHNldCB2YWx1ZSAodmFsdWUpIHtcblx0XHRpZiAodmFsdWUgIT0gdGhpcy5fdmFsdWUpIHtcblx0XHRcdHRoaXMuX3ZhbHVlID0gdmFsdWU7XG5cdFx0XHR0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiLCB2YWx1ZSk7XG5cdFx0fVxuXHR9XG59XG5ldmVudGlmeVByb3RvdHlwZShFdmVudFZhcmlhYmxlLnByb3RvdHlwZSk7XG5cbi8qXG5cdEV2ZW50IEJvb2xlYW5cblxuXG5cdE5vdGUgOiBpbXBsZW1lbnRhdGlvbiB1c2VzIGZhbHNpbmVzcyBvZiBpbnB1dCBwYXJhbWV0ZXIgdG8gY29uc3RydWN0b3IgYW5kIHNldCgpIG9wZXJhdGlvbixcblx0c28gZXZlbnRCb29sZWFuKC0xKSB3aWxsIGFjdHVhbGx5IHNldCBpdCB0byB0cnVlIGJlY2F1c2Vcblx0KC0xKSA/IHRydWUgOiBmYWxzZSAtPiB0cnVlICFcbiovXG5cbmV4cG9ydCBjbGFzcyBFdmVudEJvb2xlYW4gZXh0ZW5kcyBFdmVudFZhcmlhYmxlIHtcblx0Y29uc3RydWN0b3IodmFsdWUpIHtcblx0XHRzdXBlcihCb29sZWFuKHZhbHVlKSk7XG5cdH1cblxuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0c3VwZXIudmFsdWUgPSBCb29sZWFuKHZhbHVlKTtcblx0fVxuXHRnZXQgdmFsdWUgKCkge3JldHVybiBzdXBlci52YWx1ZX07XG59XG5cblxuLypcblx0bWFrZSBhIHByb21pc2Ugd2hpY2ggaXMgcmVzb2x2ZWQgd2hlbiBFdmVudEJvb2xlYW4gY2hhbmdlc1xuXHR2YWx1ZS5cbiovXG5leHBvcnQgZnVuY3Rpb24gbWFrZVByb21pc2UoZXZlbnRPYmplY3QsIGNvbmRpdGlvbkZ1bmMpIHtcblx0Y29uZGl0aW9uRnVuYyA9IGNvbmRpdGlvbkZ1bmMgfHwgZnVuY3Rpb24odmFsKSB7cmV0dXJuIHZhbCA9PSB0cnVlfTtcblx0cmV0dXJuIG5ldyBQcm9taXNlIChmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG5cdFx0bGV0IHN1YiA9IGV2ZW50T2JqZWN0Lm9uKFwiY2hhbmdlXCIsIGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRcdFx0aWYgKGNvbmRpdGlvbkZ1bmModmFsdWUpKSB7XG5cdFx0XHRcdHJlc29sdmUodmFsdWUpO1xuXHRcdFx0XHRldmVudE9iamVjdC5vZmYoc3ViKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG59O1xuXG4vLyBtb2R1bGUgYXBpXG5leHBvcnQgZGVmYXVsdCB7XG5cdGV2ZW50aWZ5UHJvdG90eXBlLFxuXHRldmVudGlmeUluc3RhbmNlLFxuXHRFdmVudFZhcmlhYmxlLFxuXHRFdmVudEJvb2xlYW4sXG5cdG1ha2VQcm9taXNlXG59O1xuXG4iLCIvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUiBRVUVSWSBJTlRFUkZBQ0VcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogRGVjb3JhdGUgYW4gb2JqZWN0L3Byb3RvdHlwZSBvZiBhIExheWVyIHRvIGltcGxlbWVudCBcbiAqIHRoZSBMYXllclF1ZXJ5IGludGVyZmFjZS5cbiAqIFxuICogVGhlIGxheWVyIHF1ZXJ5IGludGVyZmFjZSBpbXBsZW1lbnRzIGEgcXVlcnlcbiAqIG1lY2hhbmlzbSBmb3IgbGF5ZXJzLCB3aXRoIGJ1aWx0LWluIGNhY2hpbmdcbiAqIFxuICogRXhhbXBsZSB1c2VcbiAqIGNhY2hlID0gb2JqZWN0LmdldENhY2hlKCkgXG4gKiBjYWNoZS5xdWVyeSgpO1xuICogXG4gKiAtIGNsZWFyQ2FjaGVzIGlzIGZvciBpbnRlcm5hbCB1c2VcbiAqIC0gaW5kZXggaXMgdGhlIGFjdHVhbCB0YXJnZXQgb2Ygb2YgdGhlIHF1ZXJ5XG4gKiAtIHF1ZXJ5T3B0aW9ucyBzcGVjaWFsaXplcyB0aGUgcXVlcnkgb3V0cHV0XG4gKiBcbiAqIFxuICogTk9URSAtIHRoaXMgbWlnaHQgYmUgcGFydCBvZiB0aGUgQmFzZUxheWVyIGNsYXNzIGluc3RlYWQuXG4gKi9cblxuY29uc3QgUFJFRklYID0gXCJfX2xheWVycXVlcnlcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2UgKG9iamVjdCwgcXVlcnlPcHRpb25zLCBDYWNoZUNsYXNzKSB7XG4gICAgb2JqZWN0W2Ake1BSRUZJWH1faW5kZXhgXTtcbiAgICBvYmplY3RbYCR7UFJFRklYfV9xdWVyeU9wdGlvbnNgXSA9IHF1ZXJ5T3B0aW9ucztcbiAgICBvYmplY3RbYCR7UFJFRklYfV9jYWNoZUNsYXNzYF0gPSBDYWNoZUNsYXNzO1xuICAgIG9iamVjdFtgJHtQUkVGSVh9X2NhY2hlT2JqZWN0c2BdID0gW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KF9wcm90b3R5cGUsIFwiaW5kZXhcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzW2Ake1BSRUZJWH1faW5kZXhgXTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICAgICAgICAgIHRoaXNbYCR7UFJFRklYfV9pbmRleGBdID0gaW5kZXg7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoX3Byb3RvdHlwZSwgXCJxdWVyeU9wdGlvbnNcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzW2Ake1BSRUZJWH1fcXVlcnlPcHRpb25zYF07XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGdldENhY2hlICgpIHtcbiAgICAgICAgbGV0IENhY2hlQ2xhc3MgPSB0aGlzW2Ake1BSRUZJWH1fY2FjaGVDbGFzc2BdO1xuICAgICAgICBjb25zdCBjYWNoZSA9IG5ldyBDYWNoZUNsYXNzKHRoaXMpO1xuICAgICAgICB0aGlzW2Ake1BSRUZJWH1fY2FjaGVPYmplY3RzYF0ucHVzaChjYWNoZSk7XG4gICAgICAgIHJldHVybiBjYWNoZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjbGVhckNhY2hlcyAoKSB7XG4gICAgICAgIGZvciAobGV0IGNhY2hlIG9mIHRoaXNbYCR7UFJFRklYfV9jYWNoZU9iamVjdHNgXSkge1xuICAgICAgICAgICAgY2FjaGUuY2xlYXIoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBPYmplY3QuYXNzaWduKF9wcm90b3R5cGUsIHtnZXRDYWNoZSwgY2xlYXJDYWNoZXN9KTtcbn1cblxuIiwiLypcbiAgICBUaGlzIGRlY29yYXRlcyBhbiBvYmplY3QvcHJvdG90eXBlIHdpdGggYmFzaWMgKHN5bmNocm9ub3VzKSBjYWxsYmFjayBzdXBwb3J0LlxuKi9cblxuY29uc3QgUFJFRklYID0gXCJfX2NhbGxiYWNrXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb0luc3RhbmNlKG9iamVjdCkge1xuICAgIG9iamVjdFtgJHtQUkVGSVh9X2hhbmRsZXJzYF0gPSBbXTtcbn1cblxuZnVuY3Rpb24gYWRkX2NhbGxiYWNrIChoYW5kbGVyKSB7XG4gICAgbGV0IGhhbmRsZSA9IHtcbiAgICAgICAgaGFuZGxlcjogaGFuZGxlclxuICAgIH1cbiAgICB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5wdXNoKGhhbmRsZSk7XG4gICAgcmV0dXJuIGhhbmRsZTtcbn07XG5cbmZ1bmN0aW9uIHJlbW92ZV9jYWxsYmFjayAoaGFuZGxlKSB7XG4gICAgbGV0IGluZGV4ID0gdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uaW5kZXhvZihoYW5kbGUpO1xuICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgIHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLnNwbGljZShpbmRleCwgMSk7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gbm90aWZ5X2NhbGxiYWNrcyAoZUFyZykge1xuICAgIHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLmZvckVhY2goZnVuY3Rpb24oaGFuZGxlKSB7XG4gICAgICAgIGhhbmRsZS5oYW5kbGVyKGVBcmcpO1xuICAgIH0pO1xufTtcblxuXG5leHBvcnQgZnVuY3Rpb24gYWRkVG9Qcm90b3R5cGUgKF9wcm90b3R5cGUpIHtcbiAgICBjb25zdCBhcGkgPSB7XG4gICAgICAgIGFkZF9jYWxsYmFjaywgcmVtb3ZlX2NhbGxiYWNrLCBub3RpZnlfY2FsbGJhY2tzXG4gICAgfVxuICAgIE9iamVjdC5hc3NpZ24oX3Byb3RvdHlwZSwgYXBpKTtcbn1cblxuXG4iLCJcbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIFNPVVJDRSBQUk9QRVJUWSAoU1JDUFJPUClcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogRnVuY3Rpb25zIGZvciBleHRlbmRpbmcgYSBjbGFzcyB3aXRoIHN1cHBvcnQgZm9yIFxuICogZXh0ZXJuYWwgc291cmNlIG9uIGEgbmFtZWQgcHJvcGVydHkuXG4gKiBcbiAqIG9wdGlvbjogbXV0YWJsZTp0cnVlIG1lYW5zIHRoYXQgcHJvcGVyeSBtYXkgYmUgcmVzZXQgXG4gKiBcbiAqIHNvdXJjZSBvYmplY3QgaXMgYXNzdW1lZCB0byBzdXBwb3J0IHRoZSBjYWxsYmFjayBpbnRlcmZhY2VcbiAqL1xuXG5jb25zdCBOQU1FID0gXCJzcmNwcm9wXCI7XG5jb25zdCBQUkVGSVggPSBgX18ke05BTUV9YDtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2UgKG9iamVjdCkge1xuICAgIG9iamVjdFtgJHtQUkVGSVh9YF0gPSBuZXcgTWFwKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuXG4gICAgZnVuY3Rpb24gcmVnaXN0ZXIocHJvcE5hbWUsIG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHttdXRhYmxlPXRydWV9ID0gb3B0aW9ucztcbiAgICAgICAgY29uc3QgbWFwID0gdGhpc1tgJHtQUkVGSVh9YF07IFxuICAgICAgICBtYXAuc2V0KHByb3BOYW1lLCB7XG4gICAgICAgICAgICBpbml0OmZhbHNlLFxuICAgICAgICAgICAgaGFuZGxlOiB1bmRlZmluZWQsXG4gICAgICAgICAgICBzcmM6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIG11dGFibGVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gcmVnaXN0ZXIgZ2V0dGVycyBhbmQgc2V0dGVyc1xuICAgICAgICBpZiAobXV0YWJsZSkge1xuICAgICAgICAgICAgLy8gZ2V0dGVyIGFuZCBzZXR0ZXJcbiAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wTmFtZSwge1xuICAgICAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWFwLmdldChwcm9wTmFtZSkuc3JjO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAoc3JjKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnByb3BDaGVjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3JjID0gdGhpcy5wcm9wQ2hlY2socHJvcE5hbWUsIHNyYylcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoc3JjICE9IG1hcC5nZXQocHJvcE5hbWUpLnNyYykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1tgJHtQUkVGSVh9X2F0dGFjaGBdKHByb3BOYW1lLCBzcmMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBvbmx5IGdldHRlclxuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIHByb3BOYW1lLCB7XG4gICAgICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtLmdldChwcm9wTmFtZSkuc3JjO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXR0YXRjaChwcm9wTmFtZSwgc3JjKSB7XG4gICAgICAgIGNvbnN0IG1hcCA9IHRoaXNbYCR7UFJFRklYfWBdO1xuICAgICAgICBjb25zdCBzdGF0ZSA9IG1hcC5nZXQocHJvcE5hbWUpXG5cbiAgICAgICAgaWYgKHN0YXRlLmluaXQgJiYgIXN0YXRlLm11dGFibGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtwcm9wTmFtZX0gY2FuIG5vdCBiZSByZWFzc2lnbmVkYCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIHNvdXJjZSBjaGFuZ2UgZXZlbnRcbiAgICAgICAgaWYgKHN0YXRlLnNyYykge1xuICAgICAgICAgICAgc3RhdGUuc3JjLnJlbW92ZV9jYWxsYmFjayhzdGF0ZS5oYW5kbGUpO1xuICAgICAgICAgICAgc3RhdGUuc3JjID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgc3RhdGUuaGFuZGxlID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYXR0YXRjaCBuZXcgc3JjXG4gICAgICAgIHN0YXRlLnNyYyA9IHNyYztcbiAgICAgICAgc3RhdGUuaW5pdCA9IHRydWU7XG5cbiAgICAgICAgLy8gc3Vic2NyaWJlIHRvIGNhbGxiYWNrIGZyb20gc291cmNlXG4gICAgICAgIGlmICh0aGlzLnByb3BDaGFuZ2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBmdW5jdGlvbiAoZUFyZykge1xuICAgICAgICAgICAgICAgIHRoaXMucHJvcENoYW5nZShwcm9wTmFtZSwgZUFyZyk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgICAgICBzdGF0ZS5oYW5kbGUgPSBzcmMuYWRkX2NhbGxiYWNrKGhhbmRsZXIpO1xuICAgICAgICAgICAgdGhpcy5wcm9wQ2hhbmdlKHByb3BOYW1lLCBcInJlc2V0XCIpOyBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGFwaSA9IHt9O1xuICAgIGFwaVtgJHtOQU1FfVJlZ2lzdGVyYF0gPSByZWdpc3RlcjtcbiAgICBhcGlbYCR7UFJFRklYfV9hdHRhY2hgXSA9IGF0dGF0Y2g7XG4gICAgT2JqZWN0LmFzc2lnbihfcHJvdG90eXBlLCBhcGkpO1xufVxuXG4iLCJpbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuQkFTRSBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuXHRBYnN0cmFjdCBCYXNlIENsYXNzIGZvciBTZWdtZW50c1xuXG4gICAgY29uc3RydWN0b3IoaW50ZXJ2YWwpXG5cbiAgICAtIGludGVydmFsOiBpbnRlcnZhbCBvZiB2YWxpZGl0eSBvZiBzZWdtZW50XG4gICAgLSBkeW5hbWljOiB0cnVlIGlmIHNlZ21lbnQgaXMgZHluYW1pY1xuICAgIC0gdmFsdWUob2Zmc2V0KTogdmFsdWUgb2Ygc2VnbWVudCBhdCBvZmZzZXRcbiAgICAtIHF1ZXJ5KG9mZnNldCk6IHN0YXRlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4qL1xuXG5leHBvcnQgY2xhc3MgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0dikge1xuXHRcdHRoaXMuX2l0diA9IGl0djtcblx0fVxuXG5cdGdldCBpdHYoKSB7cmV0dXJuIHRoaXMuX2l0djt9XG5cbiAgICAvKiogXG4gICAgICogaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3NcbiAgICAgKiByZXR1cm5zIHt2YWx1ZSwgZHluYW1pY307XG4gICAgKi9cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICBcdHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjb252ZW5pZW5jZSBmdW5jdGlvbiByZXR1cm5pbmcgdGhlIHN0YXRlIG9mIHRoZSBzZWdtZW50XG4gICAgICogQHBhcmFtIHsqfSBvZmZzZXQgXG4gICAgICogQHJldHVybnMgXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGlmIChpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5faXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuc3RhdGUob2Zmc2V0KSwgb2Zmc2V0fTtcbiAgICAgICAgfSBcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdW5kZWZpbmVkLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExBWUVSUyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBMYXllcnNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgYXJncykge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX2xheWVycyA9IGFyZ3MubGF5ZXJzO1xuICAgICAgICB0aGlzLl92YWx1ZV9mdW5jID0gYXJncy52YWx1ZV9mdW5jXG5cbiAgICAgICAgLy8gVE9ETyAtIGZpZ3VyZSBvdXQgZHluYW1pYyBoZXJlP1xuICAgIH1cblxuXHRzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgLy8gVE9ETyAtIHVzZSB2YWx1ZSBmdW5jXG4gICAgICAgIC8vIGZvciBub3cgLSBqdXN0IHVzZSBmaXJzdCBsYXllclxuICAgICAgICByZXR1cm4gey4uLnRoaXMuX2xheWVyc1swXS5xdWVyeShvZmZzZXQpLCBvZmZzZXR9O1xuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU1RBVElDIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGNsYXNzIFN0YXRpY1NlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cblx0Y29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG5cdFx0dGhpcy5fdmFsdWUgPSBkYXRhO1xuXHR9XG5cblx0c3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3ZhbHVlLCBkeW5hbWljOmZhbHNlfVxuXHR9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgTU9USU9OIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qXG4gICAgSW1wbGVtZW50cyBkZXRlcm1pbmlzdGljIHByb2plY3Rpb24gYmFzZWQgb24gaW5pdGlhbCBjb25kaXRpb25zIFxuICAgIC0gbW90aW9uIHZlY3RvciBkZXNjcmliZXMgbW90aW9uIHVuZGVyIGNvbnN0YW50IGFjY2VsZXJhdGlvblxuKi9cblxuZXhwb3J0IGNsYXNzIE1vdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG4gICAgXG4gICAgY29uc3RydWN0b3IoaXR2LCBkYXRhKSB7XG4gICAgICAgIHN1cGVyKGl0dik7XG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOnAwPTAsIFxuICAgICAgICAgICAgdmVsb2NpdHk6djA9MCwgXG4gICAgICAgICAgICBhY2NlbGVyYXRpb246YTA9MCwgXG4gICAgICAgICAgICB0aW1lc3RhbXA6dDA9MFxuICAgICAgICB9ID0gZGF0YTtcbiAgICAgICAgLy8gY3JlYXRlIG1vdGlvbiB0cmFuc2l0aW9uXG4gICAgICAgIHRoaXMuX3Bvc19mdW5jID0gZnVuY3Rpb24gKHRzKSB7XG4gICAgICAgICAgICBsZXQgZCA9IHRzIC0gdDA7XG4gICAgICAgICAgICByZXR1cm4gcDAgKyB2MCpkICsgMC41KmEwKmQqZDtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5fdmVsX2Z1bmMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIGxldCBkID0gdHMgLSB0MDtcbiAgICAgICAgICAgIHJldHVybiB2MCArIGEwKmQ7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fYWNjX2Z1bmMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIHJldHVybiBhMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRlKG9mZnNldCkge1xuICAgICAgICBsZXQgcG9zID0gdGhpcy5fcG9zX2Z1bmMob2Zmc2V0KTtcbiAgICAgICAgbGV0IHZlbCA9IHRoaXMuX3ZlbF9mdW5jKG9mZnNldCk7XG4gICAgICAgIGxldCBhY2MgPSB0aGlzLl9hY2NfZnVuYyhvZmZzZXQpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcG9zaXRpb246IHBvcyxcbiAgICAgICAgICAgIHZlbG9jaXR5OiB2ZWwsXG4gICAgICAgICAgICBhY2NlbGVyYXRpb246IGFjYyxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogb2Zmc2V0LFxuICAgICAgICAgICAgdmFsdWU6IHBvcyxcbiAgICAgICAgICAgIGR5bmFtaWM6ICh2ZWwgIT0gMCB8fCBhY2MgIT0gMCApXG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgVFJBTlNJVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG4gICAgU3VwcG9ydGVkIGVhc2luZyBmdW5jdGlvbnNcbiAgICBcImVhc2UtaW5cIjpcbiAgICBcImVhc2Utb3V0XCI6XG4gICAgXCJlYXNlLWluLW91dFwiXG4qL1xuXG5mdW5jdGlvbiBlYXNlaW4gKHRzKSB7XG4gICAgcmV0dXJuIE1hdGgucG93KHRzLDIpOyAgXG59XG5mdW5jdGlvbiBlYXNlb3V0ICh0cykge1xuICAgIHJldHVybiAxIC0gZWFzZWluKDEgLSB0cyk7XG59XG5mdW5jdGlvbiBlYXNlaW5vdXQgKHRzKSB7XG4gICAgaWYgKHRzIDwgLjUpIHtcbiAgICAgICAgcmV0dXJuIGVhc2VpbigyICogdHMpIC8gMjtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gKDIgLSBlYXNlaW4oMiAqICgxIC0gdHMpKSkgLyAyO1xuICAgIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRyYW5zaXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuXHRcdHN1cGVyKGl0dik7XG4gICAgICAgIGxldCB7djAsIHYxLCBlYXNpbmd9ID0gZGF0YTtcbiAgICAgICAgbGV0IFt0MCwgdDFdID0gdGhpcy5faXR2LnNsaWNlKDAsMik7XG5cbiAgICAgICAgLy8gY3JlYXRlIHRoZSB0cmFuc2l0aW9uIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuX2R5bmFtaWMgPSB2MS12MCAhPSAwO1xuICAgICAgICB0aGlzLl90cmFucyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgLy8gY29udmVydCB0cyB0byBbdDAsdDFdLXNwYWNlXG4gICAgICAgICAgICAvLyAtIHNoaWZ0IGZyb20gW3QwLHQxXS1zcGFjZSB0byBbMCwodDEtdDApXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzY2FsZSBmcm9tIFswLCh0MS10MCldLXNwYWNlIHRvIFswLDFdLXNwYWNlXG4gICAgICAgICAgICB0cyA9IHRzIC0gdDA7XG4gICAgICAgICAgICB0cyA9IHRzL3BhcnNlRmxvYXQodDEtdDApO1xuICAgICAgICAgICAgLy8gZWFzaW5nIGZ1bmN0aW9ucyBzdHJldGNoZXMgb3IgY29tcHJlc3NlcyB0aGUgdGltZSBzY2FsZSBcbiAgICAgICAgICAgIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluXCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2Vpbih0cyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGVhc2luZyA9PSBcImVhc2Utb3V0XCIpIHtcbiAgICAgICAgICAgICAgICB0cyA9IGVhc2VvdXQodHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLWluLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW5vdXQodHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbGluZWFyIHRyYW5zaXRpb24gZnJvbSB2MCB0byB2MSwgZm9yIHRpbWUgdmFsdWVzIFswLDFdXG4gICAgICAgICAgICB0cyA9IE1hdGgubWF4KHRzLCAwKTtcbiAgICAgICAgICAgIHRzID0gTWF0aC5taW4odHMsIDEpO1xuICAgICAgICAgICAgcmV0dXJuIHYwICsgKHYxLXYwKSp0cztcbiAgICAgICAgfVxuXHR9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dGhpcy5fZHluYW1pY31cblx0fVxufVxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgSU5URVJQT0xBVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogRnVuY3Rpb24gdG8gY3JlYXRlIGFuIGludGVycG9sYXRvciBmb3IgbmVhcmVzdCBuZWlnaGJvciBpbnRlcnBvbGF0aW9uIHdpdGhcbiAqIGV4dHJhcG9sYXRpb24gc3VwcG9ydC5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSB0dXBsZXMgLSBBbiBhcnJheSBvZiBbdmFsdWUsIG9mZnNldF0gcGFpcnMsIHdoZXJlIHZhbHVlIGlzIHRoZVxuICogcG9pbnQncyB2YWx1ZSBhbmQgb2Zmc2V0IGlzIHRoZSBjb3JyZXNwb25kaW5nIG9mZnNldC5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gLSBBIGZ1bmN0aW9uIHRoYXQgdGFrZXMgYW4gb2Zmc2V0IGFuZCByZXR1cm5zIHRoZVxuICogaW50ZXJwb2xhdGVkIG9yIGV4dHJhcG9sYXRlZCB2YWx1ZS5cbiAqL1xuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZSh0dXBsZXMpIHtcblxuICAgIGlmICh0dXBsZXMubGVuZ3RoIDwgMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdW5kZWZpbmVkO31cbiAgICB9IGVsc2UgaWYgKHR1cGxlcy5sZW5ndGggPT0gMSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gaW50ZXJwb2xhdG9yICgpIHtyZXR1cm4gdHVwbGVzWzBdWzBdO31cbiAgICB9XG5cbiAgICAvLyBTb3J0IHRoZSB0dXBsZXMgYnkgdGhlaXIgb2Zmc2V0c1xuICAgIGNvbnN0IHNvcnRlZFR1cGxlcyA9IFsuLi50dXBsZXNdLnNvcnQoKGEsIGIpID0+IGFbMV0gLSBiWzFdKTtcbiAgXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvcihvZmZzZXQpIHtcbiAgICAgIC8vIEhhbmRsZSBleHRyYXBvbGF0aW9uIGJlZm9yZSB0aGUgZmlyc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPD0gc29ydGVkVHVwbGVzWzBdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzWzBdO1xuICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1sxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBhZnRlciB0aGUgbGFzdCBwb2ludFxuICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdWzFdKSB7XG4gICAgICAgIGNvbnN0IFt2YWx1ZTEsIG9mZnNldDFdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAyXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbc29ydGVkVHVwbGVzLmxlbmd0aCAtIDFdO1xuICAgICAgICByZXR1cm4gdmFsdWUxICsgKChvZmZzZXQgLSBvZmZzZXQxKSAqICh2YWx1ZTIgLSB2YWx1ZTEpIC8gKG9mZnNldDIgLSBvZmZzZXQxKSk7XG4gICAgICB9XG4gIFxuICAgICAgLy8gRmluZCB0aGUgbmVhcmVzdCBwb2ludHMgdG8gdGhlIGxlZnQgYW5kIHJpZ2h0XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvcnRlZFR1cGxlcy5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgaWYgKG9mZnNldCA+PSBzb3J0ZWRUdXBsZXNbaV1bMV0gJiYgb2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1tpICsgMV1bMV0pIHtcbiAgICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tpXTtcbiAgICAgICAgICBjb25zdCBbdmFsdWUyLCBvZmZzZXQyXSA9IHNvcnRlZFR1cGxlc1tpICsgMV07XG4gICAgICAgICAgLy8gTGluZWFyIGludGVycG9sYXRpb24gZm9ybXVsYTogeSA9IHkxICsgKCAoeCAtIHgxKSAqICh5MiAtIHkxKSAvICh4MiAtIHgxKSApXG4gICAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gIFxuICAgICAgLy8gSW4gY2FzZSB0aGUgb2Zmc2V0IGRvZXMgbm90IGZhbGwgd2l0aGluIGFueSByYW5nZSAoc2hvdWxkIGJlIGNvdmVyZWQgYnkgdGhlIHByZXZpb3VzIGNvbmRpdGlvbnMpXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH07XG59XG4gIFxuXG5leHBvcnQgY2xhc3MgSW50ZXJwb2xhdGlvblNlZ21lbnQgZXh0ZW5kcyBCYXNlU2VnbWVudCB7XG5cbiAgICBjb25zdHJ1Y3RvcihpdHYsIHR1cGxlcykge1xuICAgICAgICBzdXBlcihpdHYpO1xuICAgICAgICAvLyBzZXR1cCBpbnRlcnBvbGF0aW9uIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuX3RyYW5zID0gaW50ZXJwb2xhdGUodHVwbGVzKTtcbiAgICB9XG5cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTogdGhpcy5fdHJhbnMob2Zmc2V0KSwgZHluYW1pYzp0cnVlfTtcbiAgICB9XG59XG5cblxuIiwiXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgQ0xPQ0tTXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogY2xvY2tzIGNvdW50aW5nIGluIHNlY29uZHNcbiAqL1xuXG5jb25zdCBsb2NhbCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gcGVyZm9ybWFuY2Uubm93KCkvMTAwMC4wO1xufVxuXG5jb25zdCBlcG9jaCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS8xMDAwLjA7XG59XG5cbi8qKlxuICogdGhlIGNsb2NrIGdpdmVzIGVwb2NoIHZhbHVlcywgYnV0IGlzIGltcGxlbWVudGVkXG4gKiB1c2luZyBhIGhpZ2ggcGVyZm9ybWFuY2UgbG9jYWwgY2xvY2sgZm9yIGJldHRlclxuICogdGltZSByZXNvbHV0aW9uIGFuZCBwcm90ZWN0aW9uIGFnYWluc3Qgc3lzdGVtIFxuICogdGltZSBhZGp1c3RtZW50cy5cbiAqL1xuXG5leHBvcnQgY29uc3QgQ0xPQ0sgPSBmdW5jdGlvbiAoKSB7XG4gICAgY29uc3QgdDBfbG9jYWwgPSBsb2NhbCgpO1xuICAgIGNvbnN0IHQwX2Vwb2NoID0gZXBvY2goKTtcbiAgICByZXR1cm4ge1xuICAgICAgICBub3c6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0MF9lcG9jaCArIChsb2NhbCgpIC0gdDBfbG9jYWwpXG4gICAgICAgIH1cbiAgICB9XG59KCk7XG5cblxuLy8gb3Z2ZXJyaWRlIG1vZHVsbyB0byBiZWhhdmUgYmV0dGVyIGZvciBuZWdhdGl2ZSBudW1iZXJzXG5leHBvcnQgZnVuY3Rpb24gbW9kKG4sIG0pIHtcbiAgICByZXR1cm4gKChuICUgbSkgKyBtKSAlIG07XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZGl2bW9kKHgsIGJhc2UpIHtcbiAgICBsZXQgbiA9IE1hdGguZmxvb3IoeCAvIGJhc2UpXG4gICAgbGV0IHIgPSBtb2QoeCwgYmFzZSk7XG4gICAgcmV0dXJuIFtuLCByXTtcbn1cblxuXG4vKlxuICAgIHNpbWlsYXIgdG8gcmFuZ2UgZnVuY3Rpb24gaW4gcHl0aG9uXG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gcmFuZ2UgKHN0YXJ0LCBlbmQsIHN0ZXAgPSAxLCBvcHRpb25zPXt9KSB7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgY29uc3Qge2luY2x1ZGVfZW5kPWZhbHNlfSA9IG9wdGlvbnM7XG4gICAgaWYgKHN0ZXAgPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTdGVwIGNhbm5vdCBiZSB6ZXJvLicpO1xuICAgIH1cbiAgICBpZiAoc3RhcnQgPCBlbmQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IHN0ZXApIHtcbiAgICAgICAgICByZXN1bHQucHVzaChpKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoc3RhcnQgPiBlbmQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0OyBpID4gZW5kOyBpIC09IHN0ZXApIHtcbiAgICAgICAgICByZXN1bHQucHVzaChpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoaW5jbHVkZV9lbmQpIHtcbiAgICAgICAgcmVzdWx0LnB1c2goZW5kKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuXG4vKipcbiAqIENyZWF0ZSBhIHNpbmdsZSBzdGF0ZSBmcm9tIGEgbGlzdCBvZiBzdGF0ZXMsIHVzaW5nIGEgdmFsdWVGdW5jXG4gKiBzdGF0ZTp7dmFsdWUsIGR5bmFtaWMsIG9mZnNldH1cbiAqIFxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiB0b1N0YXRlKHNvdXJjZXMsIHN0YXRlcywgb2Zmc2V0LCBvcHRpb25zPXt9KSB7XG4gICAgbGV0IHt2YWx1ZUZ1bmMsIHN0YXRlRnVuY30gPSBvcHRpb25zOyBcbiAgICBpZiAodmFsdWVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICBsZXQgdmFsdWUgPSB2YWx1ZUZ1bmMoe3NvdXJjZXMsIHN0YXRlcywgb2Zmc2V0fSk7XG4gICAgICAgIGxldCBkeW5hbWljID0gc3RhdGVzLm1hcCgodikgPT4gdi5keW1hbWljKS5zb21lKGU9PmUpO1xuICAgICAgICByZXR1cm4ge3ZhbHVlLCBkeW5hbWljLCBvZmZzZXR9O1xuICAgIH0gZWxzZSBpZiAoc3RhdGVGdW5jICE9IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gey4uLnN0YXRlRnVuYyh7c291cmNlcywgc3RhdGVzLCBvZmZzZXR9KSwgb2Zmc2V0fTtcbiAgICB9XG4gICAgLy8gbm8gdmFsdWVGdW5jIG9yIHN0YXRlRnVuY1xuICAgIGlmIChzdGF0ZXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgcmV0dXJuIHt2YWx1ZTp1bmRlZmluZWQsIGR5bmFtaWM6ZmFsc2UsIG9mZnNldH1cbiAgICB9XG4gICAgLy8gZmFsbGJhY2sgLSBqdXN0IHVzZSBmaXJzdCBzdGF0ZVxuICAgIGxldCBzdGF0ZSA9IHN0YXRlc1swXTtcbiAgICByZXR1cm4gey4uLnN0YXRlLCBvZmZzZXR9OyBcbn0iLCJpbXBvcnQgKiBhcyBjYWxsYmFjayBmcm9tIFwiLi9hcGlfY2FsbGJhY2suanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogQ0xPQ0sgUFJPVklERVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBCYXNlIGNsYXNzIGZvciBDbG9ja1Byb3ZpZGVyc1xuICogXG4gKiBDbG9jayBQcm92aWRlcnMgaW1wbGVtZW50IHRoZSBjYWxsYmFja1xuICogaW50ZXJmYWNlIHRvIGJlIGNvbXBhdGlibGUgd2l0aCBvdGhlciBzdGF0ZVxuICogcHJvdmlkZXJzLCBldmVuIHRob3VnaCB0aGV5IGFyZSBub3QgcmVxdWlyZWQgdG9cbiAqIHByb3ZpZGUgYW55IGNhbGxiYWNrcyBhZnRlciBjbG9jayBhZGp1c3RtZW50c1xuICovXG5cbmV4cG9ydCBjbGFzcyBDbG9ja1Byb3ZpZGVyQmFzZSB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuICAgIG5vdyAoKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShDbG9ja1Byb3ZpZGVyQmFzZS5wcm90b3R5cGUpO1xuXG5cbi8qKlxuICogQmFzZSBjbGFzcyBmb3IgTW90aW9uUHJvdmlkZXJzXG4gKiBcbiAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBjbGFzcyBvZmZlcmluZyBhIHNpbXBsZXIgd2F5XG4gKiBvZiBpbXBsZW1lbnRpbmcgc3RhdGUgcHJvdmlkZXIgd2hpY2ggZGVhbCBleGNsdXNpdmVseVxuICogd2l0aCBtb3Rpb24gc2VnbWVudHMuXG4gKiBcbiAqIE1vdGlvbnByb3ZpZGVycyBkbyBub3QgZGVhbCB3aXRoIGl0ZW1zLCBidXQgd2l0aCBzaW1wbGVyXG4gKiBzdGF0ZW1lbnRzIG9mIG1vdGlvbiBzdGF0ZVxuICogXG4gKiBzdGF0ZSA9IHtcbiAqICAgICAgcG9zaXRpb246IDAsXG4gKiAgICAgIHZlbG9jaXR5OiAwLFxuICogICAgICBhY2NlbGVyYXRpb246IDAsXG4gKiAgICAgIHRpbWVzdGFtcDogMFxuICogICAgICByYW5nZTogW3VuZGVmaW5lZCwgdW5kZWZpbmVkXVxuICogfVxuICogXG4gKiBJbnRlcm5hbGx5LCBNb3Rpb25Qcm92aWRlciB3aWxsIGJlIHdyYXBwZWQgc28gdGhhdCB0aGV5XG4gKiBiZWNvbWUgcHJvcGVyIFN0YXRlUHJvdmlkZXJzLlxuICovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25Qcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBjYWxsYmFjay5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICBsZXQge3N0YXRlfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzdGF0ZSA9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5fc3RhdGUgPSB7XG4gICAgICAgICAgICAgICAgcG9zaXRpb246IDAsXG4gICAgICAgICAgICAgICAgdmVsb2NpdHk6IDAsXG4gICAgICAgICAgICAgICAgYWNjZWxlcmF0aW9uOiAwLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogMCxcbiAgICAgICAgICAgICAgICByYW5nZTogW3VuZGVmaW5lZCwgdW5kZWZpbmVkXVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3RhdGUgPSBzdGF0ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNldCBtb3Rpb24gc3RhdGVcbiAgICAgKiBcbiAgICAgKiBpbXBsZW1lbnRhdGlvbnMgb2Ygb25saW5lIG1vdGlvbiBwcm92aWRlcnMgd2lsbFxuICAgICAqIHVzZSB0aGlzIHRvIHNlbmQgYW4gdXBkYXRlIHJlcXVlc3QsXG4gICAgICogYW5kIHNldCBfc3RhdGUgb24gcmVzcG9uc2UgYW5kIHRoZW4gY2FsbCBub3RpZnlfY2FsbGJha3NcbiAgICAgKiBJZiB0aGUgcHJveHkgd2FudHMgdG8gc2V0IHRoZSBzdGF0ZSBpbW1lZGlhdGVkbHkgLSBcbiAgICAgKiBpdCBzaG91bGQgYmUgZG9uZSB1c2luZyBhIFByb21pc2UgLSB0byBicmVhayB0aGUgY29udHJvbCBmbG93LlxuICAgICAqIFxuICAgICAqIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAqICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAqICAgICAgICAgICB0aGlzLl9zdGF0ZSA9IHN0YXRlO1xuICAgICAqICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgKiAgICAgICB9KTtcbiAgICAgKiBcbiAgICAgKi9cbiAgICBzZXRfc3RhdGUgKHN0YXRlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIm5vdCBpbXBsZW1lbnRlZFwiKTtcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gY3VycmVudCBtb3Rpb24gc3RhdGVcbiAgICBnZXRfc3RhdGUgKCkge1xuICAgICAgICByZXR1cm4gey4uLnRoaXMuX3N0YXRlfTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShNb3Rpb25Qcm92aWRlckJhc2UucHJvdG90eXBlKTtcblxuXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogU1RBVEUgUFJPVklERVIgQkFTRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBCYXNlIGNsYXNzIGZvciBTdGF0ZVByb3ZpZGVyc1xuXG4gICAgLSBjb2xsZWN0aW9uIG9mIGl0ZW1zXG4gICAgLSB7a2V5LCBpdHYsIHR5cGUsIGRhdGF9XG4qL1xuXG5leHBvcnQgY2xhc3MgU3RhdGVQcm92aWRlckJhc2Uge1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogdXBkYXRlIGZ1bmN0aW9uXG4gICAgICogXG4gICAgICogSWYgSXRlbXNQcm92aWRlciBpcyBhIHByb3h5IHRvIGFuIG9ubGluZVxuICAgICAqIEl0ZW1zIGNvbGxlY3Rpb24sIHVwZGF0ZSByZXF1ZXN0cyB3aWxsIFxuICAgICAqIGltcGx5IGEgbmV0d29yayByZXF1ZXN0XG4gICAgICogXG4gICAgICogb3B0aW9ucyAtIHN1cHBvcnQgcmVzZXQgZmxhZyBcbiAgICAgKi9cbiAgICB1cGRhdGUoaXRlbXMsIG9wdGlvbnM9e30pe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIGFycmF5IHdpdGggYWxsIGl0ZW1zIGluIGNvbGxlY3Rpb24gXG4gICAgICogLSBubyByZXF1aXJlbWVudCB3cnQgb3JkZXJcbiAgICAgKi9cblxuICAgIGdldF9pdGVtcygpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNpZ25hbCBpZiBpdGVtcyBjYW4gYmUgb3ZlcmxhcHBpbmcgb3Igbm90XG4gICAgICovXG5cbiAgICBnZXQgaW5mbyAoKSB7XG4gICAgICAgIHJldHVybiB7b3ZlcmxhcHBpbmc6IHRydWV9O1xuICAgIH1cbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKFN0YXRlUHJvdmlkZXJCYXNlLnByb3RvdHlwZSk7XG5cblxuXG5cbiIsImltcG9ydCB7IFN0YXRlUHJvdmlkZXJCYXNlIH0gZnJvbSBcIi4vc3RhdGVwcm92aWRlcl9iYXNlcy5qc1wiO1xuaW1wb3J0IHsgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExPQ0FMIFNUQVRFIFBST1ZJREVSXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogTG9jYWwgQXJyYXkgd2l0aCBub24tb3ZlcmxhcHBpbmcgaXRlbXMuXG4gKi9cblxuZXhwb3J0IGNsYXNzIExvY2FsU3RhdGVQcm92aWRlciBleHRlbmRzIFN0YXRlUHJvdmlkZXJCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLy8gaW5pdGlhbGl6YXRpb25cbiAgICAgICAgbGV0IHtpdGVtcywgdmFsdWV9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKGl0ZW1zICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gaW5pdGlhbGl6ZSBmcm9tIGl0ZW1zXG4gICAgICAgICAgICB0aGlzLl9pdGVtcyA9IGNoZWNrX2lucHV0KGl0ZW1zKTtcbiAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIGluaXRpYWxpemUgZnJvbSB2YWx1ZVxuICAgICAgICAgICAgdGhpcy5faXRlbXMgPSBbe1xuICAgICAgICAgICAgICAgIGl0djpbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sIFxuICAgICAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICAgICAgZGF0YTp2YWx1ZVxuICAgICAgICAgICAgfV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9pdGVtcyA9IFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlIChpdGVtcywgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pdGVtcyA9IGNoZWNrX2lucHV0KGl0ZW1zKTtcbiAgICAgICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIGdldF9pdGVtcyAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pdGVtcy5zbGljZSgpO1xuICAgIH1cblxuICAgIGdldCBpbmZvICgpIHtcbiAgICAgICAgcmV0dXJuIHtvdmVybGFwcGluZzogZmFsc2V9O1xuICAgIH1cbn1cblxuXG5mdW5jdGlvbiBjaGVja19pbnB1dChpdGVtcykge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShpdGVtcykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW5wdXQgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICB9XG4gICAgLy8gc29ydCBpdGVtcyBiYXNlZCBvbiBpbnRlcnZhbCBsb3cgZW5kcG9pbnRcbiAgICBpdGVtcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGxldCBhX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoYS5pdHYpWzBdO1xuICAgICAgICBsZXQgYl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGIuaXR2KVswXTtcbiAgICAgICAgcmV0dXJuIGVuZHBvaW50LmNtcChhX2xvdywgYl9sb3cpO1xuICAgIH0pO1xuICAgIC8vIGNoZWNrIHRoYXQgaXRlbSBpbnRlcnZhbHMgYXJlIG5vbi1vdmVybGFwcGluZ1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IHByZXZfaGlnaCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaSAtIDFdLml0dilbMV07XG4gICAgICAgIGxldCBjdXJyX2xvdyA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbXNbaV0uaXR2KVswXTtcbiAgICAgICAgLy8gdmVyaWZ5IHRoYXQgcHJldiBoaWdoIGlzIGxlc3MgdGhhdCBjdXJyIGxvd1xuICAgICAgICBpZiAoIWVuZHBvaW50Lmx0KHByZXZfaGlnaCwgY3Vycl9sb3cpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJPdmVybGFwcGluZyBpbnRlcnZhbHMgZm91bmRcIik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5cblxuXG4iLCJpbXBvcnQgeyBpbnRlcnZhbCwgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuL25lYXJieWluZGV4LmpzXCI7XG5cbi8qKlxuICogXG4gKiBOZWFyYnkgSW5kZXggU2ltcGxlXG4gKiBcbiAqIC0gaXRlbXMgYXJlIGFzc3VtZWQgdG8gYmUgbm9uLW92ZXJsYXBwaW5nIG9uIHRoZSB0aW1lbGluZSwgXG4gKiAtIGltcGx5aW5nIHRoYXQgbmVhcmJ5LmNlbnRlciB3aWxsIGJlIGEgbGlzdCBvZiBhdCBtb3N0IG9uZSBJVEVNLiBcbiAqIC0gZXhjZXB0aW9uIHdpbGwgYmUgcmFpc2VkIGlmIG92ZXJsYXBwaW5nIElURU1TIGFyZSBmb3VuZFxuICogLSBJVEVNUyBpcyBhc3N1bWJlZCB0byBiZSBpbW11dGFibGUgYXJyYXkgLSBjaGFuZ2UgSVRFTVMgYnkgcmVwbGFjaW5nIGFycmF5XG4gKiBcbiAqICBcbiAqL1xuXG5cbi8vIGdldCBpbnRlcnZhbCBsb3cgcG9pbnRcbmZ1bmN0aW9uIGdldF9sb3dfdmFsdWUoaXRlbSkge1xuICAgIHJldHVybiBpdGVtLml0dlswXTtcbn1cblxuLy8gZ2V0IGludGVydmFsIGxvdyBlbmRwb2ludFxuZnVuY3Rpb24gZ2V0X2xvd19lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzBdXG59XG5cbi8vIGdldCBpbnRlcnZhbCBoaWdoIGVuZHBvaW50XG5mdW5jdGlvbiBnZXRfaGlnaF9lbmRwb2ludChpdGVtKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpWzFdXG59XG5cblxuZXhwb3J0IGNsYXNzIE5lYXJieUluZGV4U2ltcGxlIGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKHNyYykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9zcmMgPSBzcmM7XG4gICAgfVxuXG4gICAgZ2V0IHNyYyAoKSB7cmV0dXJuIHRoaXMuX3NyYzt9XG5cbiAgICAvKlxuICAgICAgICBuZWFyYnkgYnkgb2Zmc2V0XG4gICAgICAgIFxuICAgICAgICByZXR1cm5zIHtsZWZ0LCBjZW50ZXIsIHJpZ2h0fVxuXG4gICAgICAgIGJpbmFyeSBzZWFyY2ggYmFzZWQgb24gb2Zmc2V0XG4gICAgICAgIDEpIGZvdW5kLCBpZHhcbiAgICAgICAgICAgIG9mZnNldCBtYXRjaGVzIHZhbHVlIG9mIGludGVydmFsLmxvdyBvZiBhbiBpdGVtXG4gICAgICAgICAgICBpZHggZ2l2ZXMgdGhlIGluZGV4IG9mIHRoaXMgaXRlbSBpbiB0aGUgYXJyYXlcbiAgICAgICAgMikgbm90IGZvdW5kLCBpZHhcbiAgICAgICAgICAgIG9mZnNldCBpcyBlaXRoZXIgY292ZXJlZCBieSBpdGVtIGF0IChpZHgtMSksXG4gICAgICAgICAgICBvciBpdCBpcyBub3QgPT4gYmV0d2VlbiBlbnRyaWVzXG4gICAgICAgICAgICBpbiB0aGlzIGNhc2UgLSBpZHggZ2l2ZXMgdGhlIGluZGV4IHdoZXJlIGFuIGl0ZW1cbiAgICAgICAgICAgIHNob3VsZCBiZSBpbnNlcnRlZCAtIGlmIGl0IGhhZCBsb3cgPT0gb2Zmc2V0XG4gICAgKi9cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIGlmICh0eXBlb2Ygb2Zmc2V0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgb2Zmc2V0ID0gW29mZnNldCwgMF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG9mZnNldCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVuZHBvaW50IG11c3QgYmUgYW4gYXJyYXlcIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgICAgY2VudGVyOiBbXSxcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgbGVmdDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgcmlnaHQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHByZXY6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIG5leHQ6IHVuZGVmaW5lZFxuICAgICAgICB9O1xuICAgICAgICBsZXQgaXRlbXMgPSB0aGlzLl9zcmMuZ2V0X2l0ZW1zKCk7XG4gICAgICAgIGxldCBpbmRleGVzLCBpdGVtO1xuICAgICAgICBjb25zdCBzaXplID0gaXRlbXMubGVuZ3RoO1xuICAgICAgICBpZiAoc2l6ZSA9PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0OyBcbiAgICAgICAgfVxuICAgICAgICBsZXQgW2ZvdW5kLCBpZHhdID0gZmluZF9pbmRleChvZmZzZXRbMF0sIGl0ZW1zLCBnZXRfbG93X3ZhbHVlKTtcbiAgICAgICAgaWYgKGZvdW5kKSB7XG4gICAgICAgICAgICAvLyBzZWFyY2ggb2Zmc2V0IG1hdGNoZXMgaXRlbSBsb3cgZXhhY3RseVxuICAgICAgICAgICAgLy8gY2hlY2sgdGhhdCBpdCBpbmRlZWQgY292ZXJlZCBieSBpdGVtIGludGVydmFsXG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4XVxuICAgICAgICAgICAgaWYgKGludGVydmFsLmNvdmVyc19lbmRwb2ludChpdGVtLml0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgICAgIGluZGV4ZXMgPSB7bGVmdDppZHgtMSwgY2VudGVyOmlkeCwgcmlnaHQ6aWR4KzF9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChpbmRleGVzID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gY2hlY2sgcHJldiBpdGVtXG4gICAgICAgICAgICBpdGVtID0gaXRlbXNbaWR4LTFdO1xuICAgICAgICAgICAgaWYgKGl0ZW0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgaWYgc2VhcmNoIG9mZnNldCBpcyBjb3ZlcmVkIGJ5IGl0ZW0gaW50ZXJ2YWxcbiAgICAgICAgICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX2VuZHBvaW50KGl0ZW0uaXR2LCBvZmZzZXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ZXMgPSB7bGVmdDppZHgtMiwgY2VudGVyOmlkeC0xLCByaWdodDppZHh9O1xuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cdFxuICAgICAgICBpZiAoaW5kZXhlcyA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIHByZXYgaXRlbSBlaXRoZXIgZG9lcyBub3QgZXhpc3Qgb3IgaXMgbm90IHJlbGV2YW50XG4gICAgICAgICAgICBpbmRleGVzID0ge2xlZnQ6aWR4LTEsIGNlbnRlcjotMSwgcmlnaHQ6aWR4fTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNlbnRlclxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLmNlbnRlciAmJiBpbmRleGVzLmNlbnRlciA8IHNpemUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5jZW50ZXIgPSAgW2l0ZW1zW2luZGV4ZXMuY2VudGVyXV07XG4gICAgICAgIH1cbiAgICAgICAgLy8gcHJldi9uZXh0XG4gICAgICAgIGlmICgwIDw9IGluZGV4ZXMubGVmdCAmJiBpbmRleGVzLmxlZnQgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQucHJldiA9ICBnZXRfaGlnaF9lbmRwb2ludChpdGVtc1tpbmRleGVzLmxlZnRdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoMCA8PSBpbmRleGVzLnJpZ2h0ICYmIGluZGV4ZXMucmlnaHQgPCBzaXplKSB7XG4gICAgICAgICAgICByZXN1bHQubmV4dCA9ICBnZXRfbG93X2VuZHBvaW50KGl0ZW1zW2luZGV4ZXMucmlnaHRdKTtcbiAgICAgICAgfSAgICAgICAgXG4gICAgICAgIC8vIGxlZnQvcmlnaHRcbiAgICAgICAgbGV0IGxvdywgaGlnaDtcbiAgICAgICAgaWYgKHJlc3VsdC5jZW50ZXIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IGl0diA9IHJlc3VsdC5jZW50ZXJbMF0uaXR2O1xuICAgICAgICAgICAgW2xvdywgaGlnaF0gPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0dik7XG4gICAgICAgICAgICByZXN1bHQubGVmdCA9IChsb3dbMF0gPiAtSW5maW5pdHkpID8gZW5kcG9pbnQuZmxpcChsb3csIFwiaGlnaFwiKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IChoaWdoWzBdIDwgSW5maW5pdHkpID8gZW5kcG9pbnQuZmxpcChoaWdoLCBcImxvd1wiKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHJlc3VsdC5pdHYgPSByZXN1bHQuY2VudGVyWzBdLml0djtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gcmVzdWx0LnByZXY7XG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSByZXN1bHQubmV4dDtcbiAgICAgICAgICAgIC8vIGludGVydmFsXG4gICAgICAgICAgICBsZXQgbGVmdCA9IHJlc3VsdC5sZWZ0O1xuICAgICAgICAgICAgbG93ID0gKGxlZnQgPT0gdW5kZWZpbmVkKSA/IFstSW5maW5pdHksIDBdIDogZW5kcG9pbnQuZmxpcChsZWZ0LCBcImxvd1wiKTtcbiAgICAgICAgICAgIGxldCByaWdodCA9IHJlc3VsdC5yaWdodDtcbiAgICAgICAgICAgIGhpZ2ggPSAocmlnaHQgPT0gdW5kZWZpbmVkKSA/IFtJbmZpbml0eSwgMF0gOiBlbmRwb2ludC5mbGlwKHJpZ2h0LCBcImhpZ2hcIik7XG4gICAgICAgICAgICByZXN1bHQuaXR2ID0gaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuXHRVVElMU1xuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5cbi8qXG5cdGJpbmFyeSBzZWFyY2ggZm9yIGZpbmRpbmcgdGhlIGNvcnJlY3QgaW5zZXJ0aW9uIGluZGV4IGludG9cblx0dGhlIHNvcnRlZCBhcnJheSAoYXNjZW5kaW5nKSBvZiBpdGVtc1xuXHRcblx0YXJyYXkgY29udGFpbnMgb2JqZWN0cywgYW5kIHZhbHVlIGZ1bmMgcmV0cmVhdmVzIGEgdmFsdWVcblx0ZnJvbSBlYWNoIG9iamVjdC5cblxuXHRyZXR1cm4gW2ZvdW5kLCBpbmRleF1cbiovXG5cbmZ1bmN0aW9uIGZpbmRfaW5kZXgodGFyZ2V0LCBhcnIsIHZhbHVlX2Z1bmMpIHtcblxuICAgIGZ1bmN0aW9uIGRlZmF1bHRfdmFsdWVfZnVuYyhlbCkge1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgfVxuICAgIFxuICAgIGxldCBsZWZ0ID0gMDtcblx0bGV0IHJpZ2h0ID0gYXJyLmxlbmd0aCAtIDE7XG5cdHZhbHVlX2Z1bmMgPSB2YWx1ZV9mdW5jIHx8IGRlZmF1bHRfdmFsdWVfZnVuYztcblx0d2hpbGUgKGxlZnQgPD0gcmlnaHQpIHtcblx0XHRjb25zdCBtaWQgPSBNYXRoLmZsb29yKChsZWZ0ICsgcmlnaHQpIC8gMik7XG5cdFx0bGV0IG1pZF92YWx1ZSA9IHZhbHVlX2Z1bmMoYXJyW21pZF0pO1xuXHRcdGlmIChtaWRfdmFsdWUgPT09IHRhcmdldCkge1xuXHRcdFx0cmV0dXJuIFt0cnVlLCBtaWRdOyAvLyBUYXJnZXQgYWxyZWFkeSBleGlzdHMgaW4gdGhlIGFycmF5XG5cdFx0fSBlbHNlIGlmIChtaWRfdmFsdWUgPCB0YXJnZXQpIHtcblx0XHRcdCAgbGVmdCA9IG1pZCArIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSByaWdodFxuXHRcdH0gZWxzZSB7XG5cdFx0XHQgIHJpZ2h0ID0gbWlkIC0gMTsgLy8gTW92ZSBzZWFyY2ggcmFuZ2UgdG8gdGhlIGxlZnRcblx0XHR9XG5cdH1cbiAgXHRyZXR1cm4gW2ZhbHNlLCBsZWZ0XTsgLy8gUmV0dXJuIHRoZSBpbmRleCB3aGVyZSB0YXJnZXQgc2hvdWxkIGJlIGluc2VydGVkXG59XG4iLCJpbXBvcnQgKiBhcyBldmVudGlmeSBmcm9tIFwiLi9hcGlfZXZlbnRpZnkuanNcIjtcbmltcG9ydCAqIGFzIGxheWVycXVlcnkgZnJvbSBcIi4vYXBpX2xheWVycXVlcnkuanNcIjtcbmltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL2FwaV9jYWxsYmFjay5qc1wiO1xuaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi9hcGlfc3JjcHJvcC5qc1wiO1xuaW1wb3J0ICogYXMgc2VnbWVudCBmcm9tIFwiLi9zZWdtZW50cy5qc1wiO1xuXG5pbXBvcnQgeyBpbnRlcnZhbCwgZW5kcG9pbnQgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcbmltcG9ydCB7IHJhbmdlLCB0b1N0YXRlIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgU3RhdGVQcm92aWRlckJhc2UgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX2Jhc2VzLmpzXCI7XG5pbXBvcnQgeyBMb2NhbFN0YXRlUHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyX3NpbXBsZS5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhTaW1wbGUgfSBmcm9tIFwiLi9uZWFyYnlpbmRleF9zaW1wbGVcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMYXllciBpcyBhYnN0cmFjdCBiYXNlIGNsYXNzIGZvciBMYXllcnNcbiAqIFxuICogTGF5ZXIgaW50ZXJmYWNlIGlzIGRlZmluZWQgYnkgKGluZGV4LCBDYWNoZUNsYXNzLCB2YWx1ZUZ1bmMpXG4gKi9cblxuZXhwb3J0IGNsYXNzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtxdWVyeUZ1bmNzLCBDYWNoZUNsYXNzfSA9IG9wdGlvbnM7XG4gICAgICAgIC8vIGNhbGxiYWNrc1xuICAgICAgICBjYWxsYmFjay5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICAvLyBsYXllciBxdWVyeSBhcGlcbiAgICAgICAgbGF5ZXJxdWVyeS5hZGRUb0luc3RhbmNlKHRoaXMsIHF1ZXJ5RnVuY3MsIENhY2hlQ2xhc3MgfHwgTGF5ZXJDYWNoZSk7XG4gICAgICAgIC8vIGRlZmluZSBjaGFuZ2UgZXZlbnRcbiAgICAgICAgZXZlbnRpZnkuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5ldmVudGlmeURlZmluZShcImNoYW5nZVwiLCB7aW5pdDp0cnVlfSk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgU2FtcGxlIExheWVyIGJ5IHRpbWVsaW5lIG9mZnNldCBpbmNyZW1lbnRzXG4gICAgICAgIHJldHVybiBsaXN0IG9mIHR1cGxlcyBbdmFsdWUsIG9mZnNldF1cbiAgICAgICAgb3B0aW9uc1xuICAgICAgICAtIHN0YXJ0XG4gICAgICAgIC0gc3RvcFxuICAgICAgICAtIHN0ZXBcbiAgICAqL1xuICAgIHNhbXBsZShvcHRpb25zPXt9KSB7XG4gICAgICAgIGxldCB7c3RhcnQ9LUluZmluaXR5LCBzdG9wPUluZmluaXR5LCBzdGVwPTF9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHN0YXJ0ID4gc3RvcCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yIChcInN0b3AgbXVzdCBiZSBsYXJnZXIgdGhhbiBzdGFydFwiLCBzdGFydCwgc3RvcClcbiAgICAgICAgfVxuICAgICAgICBzdGFydCA9IFtzdGFydCwgMF07XG4gICAgICAgIHN0b3AgPSBbc3RvcCwgMF07XG4gICAgICAgIHN0YXJ0ID0gZW5kcG9pbnQubWF4KHRoaXMuaW5kZXguZmlyc3QoKSwgc3RhcnQpO1xuICAgICAgICBzdG9wID0gZW5kcG9pbnQubWluKHRoaXMuaW5kZXgubGFzdCgpLCBzdG9wKTtcbiAgICAgICAgY29uc3QgY2FjaGUgPSB0aGlzLmdldENhY2hlKCk7XG4gICAgICAgIHJldHVybiByYW5nZShzdGFydFswXSwgc3RvcFswXSwgc3RlcCwge2luY2x1ZGVfZW5kOnRydWV9KVxuICAgICAgICAgICAgLm1hcCgob2Zmc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtjYWNoZS5xdWVyeShvZmZzZXQpLnZhbHVlLCBvZmZzZXRdO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxufVxuY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUoTGF5ZXIucHJvdG90eXBlKTtcbmxheWVycXVlcnkuYWRkVG9Qcm90b3R5cGUoTGF5ZXIucHJvdG90eXBlKTtcbmV2ZW50aWZ5LmFkZFRvUHJvdG90eXBlKExheWVyLnByb3RvdHlwZSk7XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICogTEFZRVIgQ0FDSEVcbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qKlxuICogVGhpcyBpbXBsZW1lbnRzIGEgQ2FjaGUgdG8gYmUgdXNlZCB3aXRoIExheWVyIG9iamVjdHNcbiAqIFF1ZXJ5IHJlc3VsdHMgYXJlIG9idGFpbmVkIGZyb20gdGhlIHNyYyBvYmplY3RzIGluIHRoZVxuICogbGF5ZXIgaW5kZXguXG4gKiBhbmQgY2FjaGVkIG9ubHkgaWYgdGhleSBkZXNjcmliZSBhIHN0YXRpYyB2YWx1ZS4gXG4gKi9cblxuZXhwb3J0IGNsYXNzIExheWVyQ2FjaGUge1xuXG4gICAgY29uc3RydWN0b3IobGF5ZXIpIHtcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgLy8gY2FjaGVkIG5lYXJieSBzdGF0ZVxuICAgICAgICB0aGlzLl9uZWFyYnk7XG4gICAgICAgIC8vIGNhY2hlZCByZXN1bHRcbiAgICAgICAgdGhpcy5fc3RhdGU7XG4gICAgICAgIC8vIHNyYyBjYWNoZSBvYmplY3RzIChzcmMgLT4gY2FjaGUpXG4gICAgICAgIHRoaXMuX2NhY2hlX21hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgdGhpcy5fY2FjaGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHF1ZXJ5IGNhY2hlXG4gICAgICovXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IG5lZWRfbmVhcmJ5ID0gKFxuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgIWludGVydmFsLmNvdmVyc19wb2ludCh0aGlzLl9uZWFyYnkuaXR2LCBvZmZzZXQpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICFuZWVkX25lYXJieSAmJiBcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlICE9IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgIXRoaXMuX3N0YXRlLmR5bmFtaWNcbiAgICAgICAgKSB7XG4gICAgICAgICAgICAvLyBjYWNoZSBoaXRcbiAgICAgICAgICAgIHJldHVybiB7Li4udGhpcy5fc3RhdGUsIG9mZnNldH07XG4gICAgICAgIH1cbiAgICAgICAgLy8gY2FjaGUgbWlzc1xuICAgICAgICBpZiAobmVlZF9uZWFyYnkpIHtcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5fbmVhcmJ5LmNlbnRlcik7XG4gICAgICAgICAgICB0aGlzLl9jYWNoZXMgPSB0aGlzLl9uZWFyYnkuY2VudGVyXG4gICAgICAgICAgICAgICAgLy8gbWFwIHRvIGxheWVyXG4gICAgICAgICAgICAgICAgLm1hcCgoaXRlbSkgPT4gaXRlbS5zcmMpXG4gICAgICAgICAgICAgICAgLy8gbWFwIHRvIGNhY2hlIG9iamVjdFxuICAgICAgICAgICAgICAgIC5tYXAoKGxheWVyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5fY2FjaGVfbWFwLmhhcyhsYXllcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlX21hcC5zZXQobGF5ZXIsIGxheWVyLmdldENhY2hlKCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9jYWNoZV9tYXAuZ2V0KGxheWVyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBwZXJmb3JtIHF1ZXJpZXNcbiAgICAgICAgY29uc3Qgc3RhdGVzID0gdGhpcy5fY2FjaGVzLm1hcCgoY2FjaGUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBjYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3Qgc3RhdGUgPSB0b1N0YXRlKHRoaXMuX2NhY2hlcywgc3RhdGVzLCBvZmZzZXQsIHRoaXMuX2xheWVyLnF1ZXJ5T3B0aW9ucylcbiAgICAgICAgLy8gY2FjaGUgc3RhdGUgb25seSBpZiBub3QgZHluYW1pY1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IChzdGF0ZS5keW5hbWljKSA/IHVuZGVmaW5lZCA6IHN0YXRlO1xuICAgICAgICByZXR1cm4gc3RhdGUgICAgXG4gICAgfVxuXG4gICAgY2xlYXIoKSB7XG4gICAgICAgIHRoaXMuX2l0diA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX2NhY2hlcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fY2FjaGVfbWFwID0gbmV3IE1hcCgpO1xuICAgIH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBTVEFURSBMQVlFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jbGFzcyBTdGF0ZUluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhTaW1wbGUge1xuXG4gICAgY29uc3RydWN0b3IgKHN0YXRlUHJvdmlkZXIpIHtcbiAgICAgICAgc3VwZXIoc3RhdGVQcm92aWRlcik7XG4gICAgfVxuXG4gICAgbmVhcmJ5IChvZmZzZXQpIHtcbiAgICAgICAgY29uc3QgbmVhcmJ5ID0gc3VwZXIubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgIC8vIGNoYW5nZSBjZW50ZXJcbiAgICAgICAgbmVhcmJ5LmNlbnRlciA9IG5lYXJieS5jZW50ZXIubWFwKChpdGVtKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbG9hZF9zZWdtZW50KG5lYXJieS5pdHYsIGl0ZW0pO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIG5lYXJieTtcbiAgICB9XG59XG5cbi8qKlxuICogTGF5ZXIgd2l0aCBhIFN0YXRlUHJvdmlkZXIgYXMgc3JjXG4gKi9cblxuZXhwb3J0IGNsYXNzIFN0YXRlTGF5ZXIgZXh0ZW5kcyBMYXllciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIGNvbnN0IHtxdWVyeUZ1bmNzfSA9IG9wdGlvbnM7XG4gICAgICAgIHN1cGVyKHtxdWVyeUZ1bmNzLCBDYWNoZUNsYXNzOlN0YXRlTGF5ZXJDYWNoZX0pO1xuICAgICAgICAvLyBzZXR1cCBzcmMgcHJvcHRlcnR5XG4gICAgICAgIHNyY3Byb3AuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5zcmNwcm9wUmVnaXN0ZXIoXCJzcmNcIik7XG4gICAgfVxuXG4gICAgcHJvcENoZWNrKHByb3BOYW1lLCBzcmMpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIFN0YXRlUHJvdmlkZXJCYXNlKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIHN0YXRlIHByb3ZpZGVyICR7c3JjfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNyYzsgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcm9wQ2hhbmdlKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleCA9PSB1bmRlZmluZWQgfHwgZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4ID0gbmV3IE5lYXJieUluZGV4U2ltcGxlKHRoaXMuc3JjKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyQ2FjaGVzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIpO1xuICAgICAgICB9ICAgICAgICBcbiAgICB9XG59XG5zcmNwcm9wLmFkZFRvUHJvdG90eXBlKFN0YXRlTGF5ZXIucHJvdG90eXBlKTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExBWUVSIEZBQ1RPUllcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGdldExheWVyKG9wdGlvbnM9e30pIHtcbiAgICBsZXQge3NyYywgaXRlbXMsIC4uLm9wdHN9ID0gb3B0aW9ucztcbiAgICBpZiAoc3JjID09IHVuZGVmaW5lZCkge1xuICAgICAgICBzcmMgPSBuZXcgTG9jYWxTdGF0ZVByb3ZpZGVyKHtpdGVtc30pXG4gICAgfVxuICAgIGNvbnN0IGxheWVyID0gbmV3IFN0YXRlTGF5ZXIob3B0cyk7XG4gICAgbGF5ZXIuc3JjID0gc3JjO1xuICAgIHJldHVybiBsYXllcjtcbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU1RBVEUgTEFZRVIgQ0FDSEVcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLypcbiAgICBMYXllciB3aXRoIGEgU3RhdGVQcm92aWRlciB1c2VzIGEgc3BlY2lmaWMgY2FjaGUgaW1wbGVtZW50YXRpb24uICAgIFxuXG4gICAgU2luY2UgU291cmNlIExheWVyIGhhcyBhIHN0YXRlIHByb3ZpZGVyLCBpdHMgaW5kZXggaXNcbiAgICBpdGVtcywgYW5kIHRoZSBjYWNoZSB3aWxsIGluc3RhbnRpYXRlIHNlZ21lbnRzIGNvcnJlc3BvbmRpbmcgdG9cbiAgICB0aGVzZSBpdGVtcy4gXG4qL1xuXG5leHBvcnQgY2xhc3MgU3RhdGVMYXllckNhY2hlIHtcbiAgICBjb25zdHJ1Y3RvcihsYXllcikge1xuICAgICAgICAvLyBsYXllclxuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IG9iamVjdFxuICAgICAgICB0aGlzLl9uZWFyYnkgPSB1bmRlZmluZWQ7XG4gICAgICAgIC8vIGNhY2hlZCBzZWdtZW50XG4gICAgICAgIHRoaXMuX3NlZ21lbnQgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcXVlcnkob2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IGNhY2hlX21pc3MgPSAoXG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAhaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX25lYXJieS5pdHYsIG9mZnNldClcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKGNhY2hlX21pc3MpIHtcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9IHRoaXMuX2xheWVyLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICAgICAgbGV0IHtpdHYsIGNlbnRlcn0gPSB0aGlzLl9uZWFyYnk7XG4gICAgICAgICAgICB0aGlzLl9zZWdtZW50cyA9IGNlbnRlci5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbG9hZF9zZWdtZW50KGl0diwgaXRlbSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBxdWVyeSBzZWdtZW50c1xuICAgICAgICBjb25zdCBzdGF0ZXMgPSB0aGlzLl9zZWdtZW50cy5tYXAoKHNlZykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHNlZy5xdWVyeShvZmZzZXQpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRvU3RhdGUodGhpcy5fc2VnbWVudHMsIHN0YXRlcywgb2Zmc2V0LCB0aGlzLl9sYXllci5xdWVyeU9wdGlvbnMpXG4gICAgfVxuXG4gICAgY2xlYXIoKSB7XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICB9XG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0FEIFNFR01FTlRcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gbG9hZF9zZWdtZW50KGl0diwgaXRlbSkge1xuICAgIGxldCB7dHlwZT1cInN0YXRpY1wiLCBkYXRhfSA9IGl0ZW07XG4gICAgaWYgKHR5cGUgPT0gXCJzdGF0aWNcIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuU3RhdGljU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuVHJhbnNpdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJpbnRlcnBvbGF0aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50LkludGVycG9sYXRpb25TZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwibW90aW9uXCIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBzZWdtZW50Lk1vdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmxvZyhcInVucmVjb2duaXplZCBzZWdtZW50IHR5cGVcIiwgdHlwZSk7XG4gICAgfVxufVxuXG5cblxuIiwiaW1wb3J0IHsgZW5kcG9pbnQsIGludGVydmFsIH0gZnJvbSBcIi4uL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4uL25lYXJieWluZGV4LmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcnMuanNcIlxuXG4vKipcbiAqIFxuICogVGhpcyBpbXBsZW1lbnRzIGEgbWVyZ2Ugb3BlcmF0aW9uIGZvciBsYXllcnMuXG4gKiBMaXN0IG9mIHNvdXJjZXMgaXMgaW1tdXRhYmxlLlxuICogXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlIChzb3VyY2VzLCBvcHRpb25zKSB7XG5cbiAgICBjb25zdCBsYXllciA9IG5ldyBMYXllcihvcHRpb25zKTtcbiAgICBsYXllci5pbmRleCA9IG5ldyBNZXJnZUluZGV4KHNvdXJjZXMpO1xuXG4gICAgLy8gZ2V0dGVyIGZvciBzb3VyY2VzXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KGxheWVyLCBcInNvdXJjZXNcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBzb3VyY2VzO1xuICAgICAgICB9XG4gICAgfSk7XG4gXG4gICAgLy8gc3Vic2NyaXZlIHRvIGNoYW5nZSBjYWxsYmFja3MgZnJvbSBzb3VyY2VzIFxuICAgIGZ1bmN0aW9uIGhhbmRsZV9zcmNfY2hhbmdlKGVBcmcpIHtcbiAgICAgICAgbGF5ZXIuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgbGF5ZXIubm90aWZ5X2NhbGxiYWNrKCk7XG4gICAgICAgIGxheWVyLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiKTsgXG4gICAgfVxuICAgIGZvciAobGV0IHNyYyBvZiBzb3VyY2VzKSB7XG4gICAgICAgIHNyYy5hZGRfY2FsbGJhY2soaGFuZGxlX3NyY19jaGFuZ2UpOyAgICAgICAgICAgIFxuICAgIH1cbiAgICByZXR1cm4gbGF5ZXI7XG59XG5cblxuLyoqXG4gKiBNZXJnaW5nIGluZGV4ZXMgZnJvbSBtdWx0aXBsZSBzb3VyY2VzIGludG8gYSBzaW5nbGUgaW5kZXguXG4gKiBcbiAqIEEgc291cmNlIGlzIGFuIG9iamVjdCB3aXRoIGFuIGluZGV4LlxuICogLSBsYXllciAoY3Vyc29yKVxuICogXG4gKiBUaGUgbWVyZ2VkIGluZGV4IGdpdmVzIGEgdGVtcG9yYWwgc3RydWN0dXJlIGZvciB0aGVcbiAqIGNvbGxlY3Rpb24gb2Ygc291cmNlcywgY29tcHV0aW5nIGEgbGlzdCBvZlxuICogc291cmNlcyB3aGljaCBhcmUgZGVmaW5lZCBhdCBhIGdpdmVuIG9mZnNldFxuICogXG4gKiBuZWFyYnkob2Zmc2V0KS5jZW50ZXIgaXMgYSBsaXN0IG9mIGl0ZW1zXG4gKiBbe2l0diwgc3JjfV1cbiAqIFxuICogSW1wbGVtZW50YWlvbiBpcyBzdGF0ZWxlc3MuXG4gKi9cblxuZnVuY3Rpb24gY21wX2FzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAxLCBwMilcbn1cblxuZnVuY3Rpb24gY21wX2Rlc2NlbmRpbmcocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmNtcChwMiwgcDEpXG59XG5cbmV4cG9ydCBjbGFzcyBNZXJnZUluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKHNvdXJjZXMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fc291cmNlcyA9IHNvdXJjZXM7XG4gICAgfVxuXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICAvLyBhY2N1bXVsYXRlIG5lYXJieSBmcm9tIGFsbCBzb3VyY2VzXG4gICAgICAgIGNvbnN0IHByZXZfbGlzdCA9IFtdLCBjZW50ZXJfbGlzdCA9IFtdLCBuZXh0X2xpc3QgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgc3JjIG9mIHRoaXMuX3NvdXJjZXMpIHtcbiAgICAgICAgICAgIGxldCB7aXR2LCBwcmV2LCBjZW50ZXIsIG5leHR9ID0gc3JjLmluZGV4Lm5lYXJieShvZmZzZXQpO1xuICAgICAgICAgICAgaWYgKHByZXYgIT0gdW5kZWZpbmVkKSBwcmV2X2xpc3QucHVzaChwcmV2KTsgICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChuZXh0ICE9IHVuZGVmaW5lZCkgbmV4dF9saXN0LnB1c2gobmV4dCk7XG4gICAgICAgICAgICBpZiAoY2VudGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjZW50ZXJfbGlzdC5wdXNoKHtpdHYsIHNyY30pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBmaW5kIGNsb3Nlc3QgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0IChub3QgaW4gY2VudGVyKVxuICAgICAgICBuZXh0X2xpc3Quc29ydChjbXBfYXNjZW5kaW5nKTtcbiAgICAgICAgY29uc3QgbWluX25leHRfbG93ID0gbmV4dF9saXN0WzBdIHx8IFtJbmZpbml0eSwgMF07XG5cbiAgICAgICAgLy8gZmluZCBjbG9zZXN0IGVuZHBvaW50IHRvIHRoZSBsZWZ0IChub3QgaW4gY2VudGVyKVxuICAgICAgICBwcmV2X2xpc3Quc29ydChjbXBfZGVzY2VuZGluZyk7XG4gICAgICAgIGNvbnN0IG1heF9wcmV2X2hpZ2ggPSBwcmV2X2xpc3RbMF0gfHwgWy1JbmZpbml0eSwgMF07XG5cbiAgICAgICAgLy8gbmVhcmJ5XG4gICAgICAgIGxldCBsb3csIGhpZ2g7IFxuICAgICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgICAgICBjZW50ZXI6IGNlbnRlcl9saXN0LCBcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjZW50ZXJfbGlzdC5sZW5ndGggPT0gMCkge1xuXG4gICAgICAgICAgICAvLyBlbXB0eSBjZW50ZXJcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IG1pbl9uZXh0X2xvdzsgICAgICAgXG4gICAgICAgICAgICByZXN1bHQubmV4dCA9IG1pbl9uZXh0X2xvdztcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gbWF4X3ByZXZfaGlnaDtcbiAgICAgICAgICAgIHJlc3VsdC5wcmV2ID0gbWF4X3ByZXZfaGlnaDtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbm9uLWVtcHR5IGNlbnRlclxuXG4gICAgICAgICAgICAvLyBjZW50ZXIgaGlnaFxuICAgICAgICAgICAgbGV0IGNlbnRlcl9oaWdoX2xpc3QgPSBjZW50ZXJfbGlzdC5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMV07XG4gICAgICAgICAgICB9KS5zb3J0KGNtcF9hc2NlbmRpbmcpO1xuICAgICAgICAgICAgbGV0IG1pbl9jZW50ZXJfaGlnaCA9IGNlbnRlcl9oaWdoX2xpc3RbMF07XG4gICAgICAgICAgICBsZXQgbWF4X2NlbnRlcl9oaWdoID0gY2VudGVyX2hpZ2hfbGlzdC5zbGljZSgtMSlbMF07XG4gICAgICAgICAgICBsZXQgbXVsdGlwbGVfY2VudGVyX2hpZ2ggPSAhZW5kcG9pbnQuZXEobWluX2NlbnRlcl9oaWdoLCBtYXhfY2VudGVyX2hpZ2gpXG5cbiAgICAgICAgICAgIC8vIGNlbnRlciBsb3dcbiAgICAgICAgICAgIGxldCBjZW50ZXJfbG93X2xpc3QgPSBjZW50ZXJfbGlzdC5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dilbMF1cbiAgICAgICAgICAgIH0pLnNvcnQoY21wX2Rlc2NlbmRpbmcpO1xuICAgICAgICAgICAgbGV0IG1heF9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0WzBdO1xuICAgICAgICAgICAgbGV0IG1pbl9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0LnNsaWNlKC0xKVswXTtcbiAgICAgICAgICAgIGxldCBtdWx0aXBsZV9jZW50ZXJfbG93ID0gIWVuZHBvaW50LmVxKG1heF9jZW50ZXJfbG93LCBtaW5fY2VudGVyX2xvdylcblxuICAgICAgICAgICAgLy8gbmV4dC9yaWdodFxuICAgICAgICAgICAgaWYgKGVuZHBvaW50LmxlKG1pbl9uZXh0X2xvdywgbWluX2NlbnRlcl9oaWdoKSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IG1pbl9uZXh0X2xvdztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gZW5kcG9pbnQuZmxpcChtaW5fY2VudGVyX2hpZ2gsIFwibG93XCIpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQubmV4dCA9IChtdWx0aXBsZV9jZW50ZXJfaGlnaCkgPyByZXN1bHQucmlnaHQgOiBtaW5fbmV4dF9sb3c7XG5cbiAgICAgICAgICAgIC8vIHByZXYvbGVmdFxuICAgICAgICAgICAgaWYgKGVuZHBvaW50LmdlKG1heF9wcmV2X2hpZ2gsIG1heF9jZW50ZXJfbG93KSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gbWF4X3ByZXZfaGlnaDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSBlbmRwb2ludC5mbGlwKG1heF9jZW50ZXJfbG93LCBcImhpZ2hcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQucHJldiA9IChtdWx0aXBsZV9jZW50ZXJfbG93KSA/IHJlc3VsdC5sZWZ0IDogbWF4X3ByZXZfaGlnaDsgICAgXG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnRlcnZhbCBmcm9tIGxlZnQvcmlnaHRcbiAgICAgICAgbG93ID0gZW5kcG9pbnQuZmxpcChyZXN1bHQubGVmdCwgXCJsb3dcIik7XG4gICAgICAgIGhpZ2ggPSBlbmRwb2ludC5mbGlwKHJlc3VsdC5yaWdodCwgXCJoaWdoXCIpO1xuICAgICAgICByZXN1bHQuaXR2ID0gaW50ZXJ2YWwuZnJvbV9lbmRwb2ludHMobG93LCBoaWdoKTtcblxuICAgICAgICAvLyBzd2l0Y2ggdG8gdW5kZWZpbmVkXG4gICAgICAgIGlmIChyZXN1bHQucHJldlswXSA9PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJlc3VsdC5wcmV2ID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQubGVmdFswXSA9PSAtSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQubmV4dFswXSA9PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgcmVzdWx0Lm5leHQgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdC5yaWdodFswXSA9PSBJbmZpbml0eSkge1xuICAgICAgICAgICAgcmVzdWx0LnJpZ2h0ID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufTtcblxuIiwiaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4uL25lYXJieWluZGV4LmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcnMuanNcIlxuaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi4vYXBpX3NyY3Byb3AuanNcIjtcblxuZnVuY3Rpb24gc2tld2VkKHAsIG9mZnNldCkge1xuICAgIGlmIChwID09IHVuZGVmaW5lZCB8fCAhaXNGaW5pdGUocCkpIHtcbiAgICAgICAgLy8gcCAtIG5vIHNrZXdcbiAgICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBwID09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgLy8gcCBpcyBudW1iZXIgLSBza2V3XG4gICAgICAgIHJldHVybiBwICsgb2Zmc2V0O1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwKSAmJiBwLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgLy8gcCBpcyBlbmRwb2ludCAtIHNrZXcgdmFsdWVcbiAgICAgICAgbGV0IFt2YWwsIHNpZ25dID0gcDtcbiAgICAgICAgcmV0dXJuIFt2YWwgKyBvZmZzZXQsIHNpZ25dO1xuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU0tFVyBJTkRFWFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jbGFzcyBTa2V3ZWRJbmRleCBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvciAobGF5ZXIsIHNrZXcpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgdGhpcy5fc2tldyA9IHNrZXc7XG4gICAgfVxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgLy8gc2tldyBsb29rdXAgKG5lZ2F0aXZlKVxuICAgICAgICBjb25zdCBuZWFyYnkgPSB0aGlzLl9sYXllci5pbmRleC5uZWFyYnkoc2tld2VkKG9mZnNldCwgLXRoaXMuX3NrZXcpKTtcbiAgICAgICAgLy8gc2tldyByZXN1bHQgKHBvc2l0aXZlKSBcbiAgICAgICAgbmVhcmJ5Lml0dlswXSA9IHNrZXdlZChuZWFyYnkuaXR2WzBdLCB0aGlzLl9za2V3KTtcbiAgICAgICAgbmVhcmJ5Lml0dlsxXSA9IHNrZXdlZChuZWFyYnkuaXR2WzFdLCB0aGlzLl9za2V3KTtcbiAgICAgICAgbmVhcmJ5LmxlZnQgPSBza2V3ZWQobmVhcmJ5LmxlZnQsIHRoaXMuX3NrZXcpO1xuICAgICAgICBuZWFyYnkucmlnaHQgPSBza2V3ZWQobmVhcmJ5LnJpZ2h0LCB0aGlzLl9za2V3KTtcbiAgICAgICAgbmVhcmJ5LnByZXYgPSBza2V3ZWQobmVhcmJ5LnByZXYsIHRoaXMuX3NrZXcpO1xuICAgICAgICBuZWFyYnkubmV4dCA9IHNrZXdlZChuZWFyYnkubmV4dCwgdGhpcy5fc2tldyk7XG4gICAgICAgIG5lYXJieS5jZW50ZXIgPSBuZWFyYnkuY2VudGVyLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHtzcmM6dGhpcy5fbGF5ZXJ9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbmVhcmJ5O1xuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU0tFVyBMQVlFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFRvZG8gLSBtYWtlIFNrZXdMYXllciB1c2UgYSBkeW5hbWljIFNrZXcgQ3Vyc29yXG4gKiBhcyBjdHJsLlxuICovXG5cblxuY2xhc3MgU2tld0xheWVyIGV4dGVuZHMgTGF5ZXIge1xuXG4gICAgY29uc3RydWN0b3IobGF5ZXIsIHNrZXcsIG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICAgIHRoaXMuX3NrZXcgPSBza2V3O1xuICAgICAgICAvLyBzZXR1cCBzcmMgcHJvcHRlcnR5XG4gICAgICAgIHNyY3Byb3AuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5zcmNwcm9wUmVnaXN0ZXIoXCJzcmNcIik7XG4gICAgICAgIHRoaXMuc3JjID0gbGF5ZXI7XG4gICAgfVxuXG4gICAgcHJvcENoZWNrKHByb3BOYW1lLCBzcmMpIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICghKHNyYyBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIExheWVyICR7c3JjfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNyYzsgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcm9wQ2hhbmdlKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImNyZWF0ZSBpbmRleFwiKVxuICAgICAgICAgICAgaWYgKHRoaXMuaW5kZXggPT0gdW5kZWZpbmVkIHx8IGVBcmcgPT0gXCJyZXNldFwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRleCA9IG5ldyBTa2V3ZWRJbmRleCh0aGlzLnNyYywgdGhpcy5fc2tldylcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGVhckNhY2hlcygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgICAgICB0aGlzLmV2ZW50aWZ5VHJpZ2dlcihcImNoYW5nZVwiKTsgICAgXG4gICAgICAgIH1cbiAgICB9XG59XG5zcmNwcm9wLmFkZFRvUHJvdG90eXBlKFNrZXdMYXllci5wcm90b3R5cGUpO1xuXG4vKipcbiAqIFNrZXdpbmcgYSBMYXllciBieSBhbiBvZmZzZXRcbiAqIFxuICogYSBwb3NpdGl2ZSB2YWx1ZSBmb3Igb2Zmc2V0IG1lYW5zIHRoYXRcbiAqIHRoZSBsYXllciBpcyBzaGlmdGVkIHRvIHRoZSByaWdodCBvbiB0aGUgdGltZWxpbmVcbiAqIFxuICogXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHNrZXcgKGxheWVyLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gbmV3IFNrZXdMYXllcihsYXllciwgb2Zmc2V0KTtcbn1cbiJdLCJuYW1lcyI6WyJQUkVGSVgiLCJhZGRUb0luc3RhbmNlIiwiYWRkVG9Qcm90b3R5cGUiLCJjYWxsYmFjay5hZGRUb0luc3RhbmNlIiwiY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUiLCJsYXllcnF1ZXJ5LmFkZFRvSW5zdGFuY2UiLCJldmVudGlmeS5hZGRUb0luc3RhbmNlIiwibGF5ZXJxdWVyeS5hZGRUb1Byb3RvdHlwZSIsImV2ZW50aWZ5LmFkZFRvUHJvdG90eXBlIiwic3JjcHJvcC5hZGRUb0luc3RhbmNlIiwic3JjcHJvcC5hZGRUb1Byb3RvdHlwZSIsInNlZ21lbnQuU3RhdGljU2VnbWVudCIsInNlZ21lbnQuVHJhbnNpdGlvblNlZ21lbnQiLCJzZWdtZW50LkludGVycG9sYXRpb25TZWdtZW50Iiwic2VnbWVudC5Nb3Rpb25TZWdtZW50Il0sIm1hcHBpbmdzIjoiOzs7OztFQUFBO0VBQ0E7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7RUFFQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7OztFQUdBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7O0VBR0EsU0FBUyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtFQUMxQixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxPQUFPLENBQUM7RUFDekIsSUFBSSxJQUFJLENBQUMsS0FBSyxRQUFRLEVBQUUsT0FBTyxDQUFDO0VBQ2hDLElBQUksSUFBSSxDQUFDLEtBQUssUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0VBQ2pDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7RUFDbEMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUM7RUFDakMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDO0VBQ2hCOztFQUVBLFNBQVMsWUFBWSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7RUFDL0IsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7RUFDckIsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7RUFDckIsSUFBSSxJQUFJLElBQUksR0FBRyxVQUFVLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQztFQUNqQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksR0FBRyxFQUFFLEdBQUcsRUFBRTtFQUN2Qzs7RUFFQSxTQUFTLFdBQVcsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0VBQzlCLElBQUksT0FBTyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHO0VBQ2xDO0VBQ0EsU0FBUyxXQUFXLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtFQUM5QixJQUFJLE9BQU8sWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSTtFQUNuQztFQUNBLFNBQVMsV0FBVyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7RUFDOUIsSUFBSSxPQUFPLFlBQVksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUc7RUFDbEM7RUFDQSxTQUFTLFdBQVcsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO0VBQzlCLElBQUksT0FBTyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJO0VBQ25DO0VBQ0EsU0FBUyxXQUFXLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtFQUM5QixJQUFJLE9BQU8sWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSTtFQUNuQztFQUNBLFNBQVMsWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUU7RUFDOUIsSUFBSSxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtFQUMxQztFQUNBLFNBQVMsWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUU7RUFDOUIsSUFBSSxPQUFPLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtFQUMxQzs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBOztFQUVBLFNBQVMsYUFBYSxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUU7RUFDbEMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7RUFDakIsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFO0VBQ3RCLFFBQVEsT0FBTyxDQUFDO0VBQ2hCO0VBQ0EsSUFBSSxJQUFJLE1BQU0sSUFBSSxLQUFLLEVBQUU7RUFDekI7RUFDQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRTtFQUNoQixHQUFHLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztFQUM5QztFQUNBLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDcEIsS0FBSyxNQUFNLElBQUksTUFBTSxJQUFJLE1BQU0sRUFBRTtFQUNqQztFQUNBLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFO0VBQ2hCLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0VBQy9DO0VBQ0EsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUNwQixLQUFLLE1BQU07RUFDWCxLQUFLLE1BQU0sSUFBSSxLQUFLLENBQUMsY0FBYyxFQUFFLE1BQU0sQ0FBQztFQUM1QztFQUNBLElBQUksT0FBTyxDQUFDO0VBQ1o7OztFQUdBO0VBQ0E7RUFDQTtFQUNBLFNBQVMsdUJBQXVCLENBQUMsR0FBRyxFQUFFO0VBQ3RDLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxHQUFHLEdBQUc7RUFDaEQsSUFBSSxJQUFJLEtBQUssR0FBRyxDQUFDLFNBQVMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztFQUNsRCxJQUFJLElBQUksTUFBTSxHQUFHLENBQUMsVUFBVSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0VBQ3RELElBQUksT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUM7RUFDMUI7OztFQUdBO0VBQ0E7O0VBRUE7O0VBRUE7O0VBRUE7RUFDQTtFQUNBOztFQUVBO0VBQ0E7RUFDQTtFQUNBLFNBQVMsd0JBQXdCLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRTtFQUMxQyxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEdBQUcsdUJBQXVCLENBQUMsR0FBRyxDQUFDO0VBQ3REO0VBQ0EsSUFBSSxPQUFPLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLElBQUksV0FBVyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUM7RUFDMUQ7RUFDQTtFQUNBLFNBQVMscUJBQXFCLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRTtFQUN2QyxJQUFJLE9BQU8sd0JBQXdCLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0VBQ2hEOzs7O0VBSUE7RUFDQTtFQUNBO0VBQ0EsU0FBUyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUU7RUFDeEMsSUFBSSxPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQztFQUNwQzs7RUFFQTtFQUNBO0VBQ0E7RUFDQSxTQUFTLHVCQUF1QixDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUU7RUFDekMsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7RUFDckIsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUU7RUFDckI7RUFDQSxJQUFJLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0VBQ2xCLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLENBQUM7RUFDaEQ7RUFDQSxJQUFJLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRTtFQUNqQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLEVBQUUsRUFBRSxDQUFDLENBQUM7RUFDbkQ7RUFDQSxJQUFJLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7RUFDbkM7O0VBRUEsU0FBUyxRQUFRLENBQUMsQ0FBQyxFQUFFO0VBQ3JCLElBQUksT0FBTyxPQUFPLENBQUMsSUFBSSxRQUFRO0VBQy9COztFQUVPLFNBQVMsbUJBQW1CLENBQUMsS0FBSyxDQUFDO0VBQzFDLElBQUksSUFBSSxHQUFHLEdBQUcsS0FBSztFQUNuQixJQUFJLElBQUksR0FBRyxJQUFJLFNBQVMsRUFBRTtFQUMxQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQW9CLENBQUM7RUFDN0M7RUFDQSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0VBQzdCLFFBQVEsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7RUFDM0I7RUFDQSxZQUFZLEdBQUcsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QyxTQUFTLE1BQU07RUFDZixZQUFZLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLHlCQUF5QixDQUFDO0VBQ3RFO0VBQ0EsS0FDQTtFQUNBLElBQUksSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtFQUN6QixRQUFRLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUk7RUFDekMsS0FBSyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7RUFDaEMsUUFBUSxHQUFHLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztFQUN2QyxLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtFQUNoQyxRQUFRLEdBQUcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztFQUM3QixLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtFQUMvQixRQUFRLEdBQUcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDNUI7RUFDQSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUMsR0FBRyxHQUFHO0VBQ2xEO0VBQ0EsSUFBSSxJQUFJLEdBQUcsSUFBSSxTQUFTLElBQUksR0FBRyxJQUFJLElBQUksRUFBRTtFQUN6QyxRQUFRLEdBQUcsR0FBRyxDQUFDLFFBQVE7RUFDdkI7RUFDQSxJQUFJLElBQUksSUFBSSxJQUFJLFNBQVMsSUFBSSxJQUFJLElBQUksSUFBSSxFQUFFO0VBQzNDLFFBQVEsSUFBSSxHQUFHLFFBQVE7RUFDdkI7RUFDQTtFQUNBLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixFQUFFLEdBQUcsQ0FBQztFQUNoRSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUM7RUFDbkU7RUFDQSxJQUFJLElBQUksR0FBRyxHQUFHLElBQUksRUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLFlBQVksRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDO0VBQzVEO0VBQ0EsSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUU7RUFDckIsUUFBUSxVQUFVLEdBQUcsSUFBSTtFQUN6QixRQUFRLFdBQVcsR0FBRyxJQUFJO0VBQzFCO0VBQ0E7RUFDQSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFO0VBQzFCLFFBQVEsVUFBVSxHQUFHLElBQUk7RUFDekI7RUFDQSxJQUFJLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtFQUMxQixRQUFRLFdBQVcsR0FBRyxJQUFJO0VBQzFCO0VBQ0E7RUFDQSxJQUFJLElBQUksT0FBTyxVQUFVLEtBQUssU0FBUyxFQUFFO0VBQ3pDLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQztFQUNqRCxLQUFLO0VBQ0wsSUFBSSxJQUFJLE9BQU8sV0FBVyxLQUFLLFNBQVMsRUFBRTtFQUMxQyxRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUM7RUFDbEQ7RUFDQSxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxXQUFXLENBQUM7RUFDL0M7Ozs7O0VBS08sTUFBTSxRQUFRLEdBQUc7RUFDeEIsSUFBSSxFQUFFLEVBQUUsV0FBVztFQUNuQixJQUFJLEVBQUUsRUFBRSxXQUFXO0VBQ25CLElBQUksRUFBRSxFQUFFLFdBQVc7RUFDbkIsSUFBSSxFQUFFLEVBQUUsV0FBVztFQUNuQixJQUFJLEdBQUcsRUFBRSxZQUFZO0VBQ3JCLElBQUksRUFBRSxFQUFFLFdBQVc7RUFDbkIsSUFBSSxHQUFHLEVBQUUsWUFBWTtFQUNyQixJQUFJLEdBQUcsRUFBRSxZQUFZO0VBQ3JCLElBQUksSUFBSSxFQUFFLGFBQWE7RUFDdkIsSUFBSSxhQUFhLEVBQUU7RUFDbkI7RUFDTyxNQUFNLFFBQVEsR0FBRztFQUN4QixJQUFJLGVBQWUsRUFBRSx3QkFBd0I7RUFDN0MsSUFBSSxZQUFZLEVBQUUscUJBQXFCO0VBQ3ZDLElBQUksV0FBVyxFQUFFLG9CQUFvQjtFQUNyQyxJQUFJLGNBQWMsRUFBRSx1QkFBdUI7RUFDM0MsSUFBSSxVQUFVLEVBQUU7RUFDaEI7O0VDclBBO0VBQ0E7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBOztFQUVBLENBQVEsTUFBTSxlQUFlLENBQUM7OztFQUc5QjtFQUNBO0VBQ0E7RUFDQSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7RUFDbkIsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDO0VBQzFDOzs7RUFHQTtFQUNBO0VBQ0E7RUFDQSxJQUFJLEtBQUssR0FBRztFQUNaLFFBQVEsSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7RUFDekQsUUFBUSxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxLQUFLO0VBQzNEOztFQUVBO0VBQ0E7RUFDQTtFQUNBLElBQUksSUFBSSxHQUFHO0VBQ1gsUUFBUSxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7RUFDdkQsUUFBUSxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUc7RUFDckQ7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7RUFDckIsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxPQUFPO0VBQ3RELFFBQVEsSUFBSSxLQUFLLEdBQUcsSUFBSSxFQUFFO0VBQzFCLFlBQVksTUFBTSxJQUFJLEtBQUssRUFBRSxnQ0FBZ0MsRUFBRSxLQUFLLEVBQUUsSUFBSTtFQUMxRTtFQUNBLFFBQVEsS0FBSyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztFQUMxQixRQUFRLElBQUksR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7RUFDeEIsUUFBUSxJQUFJLE9BQU8sR0FBRyxLQUFLO0VBQzNCLFFBQVEsSUFBSSxNQUFNO0VBQ2xCLFFBQVEsTUFBTSxPQUFPLEdBQUcsRUFBRTtFQUMxQixRQUFRLElBQUksS0FBSyxHQUFHO0VBQ3BCLFFBQVEsT0FBTyxLQUFLLEVBQUU7RUFDdEIsWUFBWSxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxFQUFFO0VBQzVDO0VBQ0EsZ0JBQWdCO0VBQ2hCO0VBQ0EsWUFBWSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7RUFDekMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtFQUMzQztFQUNBLGdCQUFnQixJQUFJLE1BQU0sQ0FBQyxLQUFLLElBQUksU0FBUyxFQUFFO0VBQy9DO0VBQ0E7RUFDQSxvQkFBb0I7RUFDcEIsaUJBQWlCLE1BQU07RUFDdkI7RUFDQTtFQUNBLG9CQUFvQixPQUFPLEdBQUcsTUFBTSxDQUFDLEtBQUs7RUFDMUM7RUFDQSxhQUFhLE1BQU07RUFDbkIsZ0JBQWdCLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztFQUMzQyxnQkFBZ0IsSUFBSSxNQUFNLENBQUMsS0FBSyxJQUFJLFNBQVMsRUFBRTtFQUMvQztFQUNBO0VBQ0Esb0JBQW9CO0VBQ3BCLGlCQUFpQixNQUFNO0VBQ3ZCO0VBQ0E7RUFDQSxvQkFBb0IsT0FBTyxHQUFHLE1BQU0sQ0FBQyxLQUFLO0VBQzFDO0VBQ0E7RUFDQSxZQUFZLEtBQUssRUFBRTtFQUNuQjtFQUNBLFFBQVEsT0FBTyxPQUFPO0VBQ3RCO0VBQ0E7O0VDMUpBO0VBQ0E7RUFDQTs7RUFFQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7Ozs7RUFJQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7O0VBRUE7O0VBRUEsTUFBTSxLQUFLLENBQUM7O0VBRVosQ0FBQyxXQUFXLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRTtFQUN4QyxFQUFFLE9BQU8sR0FBRyxPQUFPLElBQUk7RUFDdkIsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVM7RUFDNUIsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUk7RUFDbEIsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxTQUFTLElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQyxJQUFJO0VBQ2pFLEVBQUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxFQUFFO0VBQ3pCOztFQUVBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFO0VBQy9CLEVBQUUsSUFBSSxDQUFDLFFBQVEsSUFBSSxPQUFPLFFBQVEsS0FBSyxVQUFVLEVBQUU7RUFDbkQsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixFQUFFLFFBQVEsQ0FBQztFQUN2RDtFQUNBLEVBQUUsTUFBTSxHQUFHLEdBQUcsSUFBSSxZQUFZLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUM7RUFDdkQsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7RUFDOUI7RUFDQSxLQUFLLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFO0VBQ2hDLE1BQU0sR0FBRyxDQUFDLFlBQVksR0FBRyxJQUFJO0VBQzdCLE1BQU0sSUFBSSxJQUFJLEdBQUcsSUFBSTtFQUNyQixNQUFNLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWTtFQUN6QyxPQUFPLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUU7RUFDMUUsT0FBTyxHQUFHLENBQUMsWUFBWSxHQUFHLEtBQUs7RUFDL0IsT0FBTyxLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRTtFQUMvQixRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDO0VBQ3ZDO0VBQ0EsT0FBTyxDQUFDO0VBQ1I7RUFDQSxFQUFFLE9BQU87RUFDVDs7RUFFQTtFQUNBOztFQUVBO0VBQ0E7RUFDQTtFQUNBLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUU7RUFDNUIsRUFBRSxJQUFJLEtBQUssRUFBRSxHQUFHO0VBQ2hCLEVBQUUsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLEVBQUU7RUFDMUI7RUFDQSxHQUFHLElBQUksR0FBRyxDQUFDLFVBQVUsRUFBRTtFQUN2QixJQUFJO0VBQ0o7RUFDQSxHQUFHLEtBQUssR0FBRztFQUNYLElBQUksR0FBRyxFQUFFLElBQUksQ0FBQyxTQUFTO0VBQ3ZCLElBQUksSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO0VBQ25CLElBQUksR0FBRyxFQUFFLEdBQUc7RUFDWixJQUFJLElBQUksRUFBRTtFQUNWO0VBQ0EsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsU0FBUztFQUNsQyxHQUFHLElBQUk7RUFDUCxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDO0VBQ3ZDLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRTtFQUNqQixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztFQUNoRTtFQUNBO0VBQ0E7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUU7RUFDbEIsRUFBRSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7RUFDM0MsRUFBRSxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRTtFQUNoQixHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7RUFDcEMsR0FBRyxHQUFHLENBQUMsU0FBUyxFQUFFO0VBQ2xCO0VBQ0E7RUFDQTs7O0VBR0E7RUFDQTtFQUNBOztFQUVBLE1BQU0sWUFBWSxDQUFDOztFQUVuQixDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRTtFQUN2QyxFQUFFLE9BQU8sR0FBRyxPQUFPLElBQUk7RUFDdkIsRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUs7RUFDcEIsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJO0VBQ3hCLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRztFQUNsQixFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLFNBQVMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSTtFQUMzRSxFQUFFLElBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSztFQUMzQixFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSztFQUN6QixFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUc7RUFDeEI7O0VBRUEsQ0FBQyxTQUFTLEdBQUc7RUFDYixFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSTtFQUN4QixFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsU0FBUztFQUMzQixFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztFQUM5QjtFQUNBOzs7RUFHQTs7RUFFQTs7RUFFQTs7RUFFQTtFQUNBOztFQUVBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7O0VBRUE7O0VBRU8sU0FBUyxnQkFBZ0IsRUFBRSxNQUFNLEVBQUU7RUFDMUMsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxHQUFHLEVBQUU7RUFDdkMsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLEdBQUcsRUFBRTtFQUM5QixDQUFDLE9BQU8sTUFBTTtFQUNkOztFQUdBO0VBQ0E7O0VBRUE7RUFDQTs7RUFFTyxTQUFTLGlCQUFpQixDQUFDLFVBQVUsRUFBRTs7RUFFOUMsQ0FBQyxTQUFTLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUU7RUFDekMsRUFBRSxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztFQUNwRCxFQUFFLElBQUksS0FBSyxJQUFJLFNBQVMsRUFBRTtFQUMxQixHQUFHLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDO0VBQzNDO0VBQ0EsRUFBRSxPQUFPLEtBQUs7RUFDZDs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxDQUFDLFNBQVMsY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUU7RUFDeEM7RUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtFQUMxQyxHQUFHLE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXVCLEVBQUUsSUFBSSxDQUFDO0VBQ2pEO0VBQ0EsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0VBQ3BFO0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLENBQUMsU0FBUyxFQUFFLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUU7RUFDdEMsRUFBRSxPQUFPLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQztFQUNsRTtFQUVBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxDQUFDLFNBQVMsR0FBRyxDQUFDLEdBQUcsRUFBRTtFQUNuQixFQUFFLE9BQU8sZ0JBQWdCLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDO0VBQzFEOztFQUdBLENBQUMsU0FBUyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUU7RUFDdEMsRUFBRSxPQUFPLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxhQUFhO0VBQ25EOzs7O0VBSUE7RUFDQTs7RUFFQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLENBQUMsU0FBUyxrQkFBa0IsQ0FBQyxVQUFVLEVBQUU7RUFDekMsRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO0VBQzlCLEdBQUc7RUFDSDs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBRSxJQUFJLFlBQVksR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxLQUFLO0VBQzlDLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxJQUFJO0VBQzFCLEdBQUcsSUFBSSxFQUFFLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN4QyxHQUFHLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsWUFBWSxJQUFJLEtBQUssQ0FBQztFQUN2RSxHQUFHLE9BQU8sQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQztFQUMxQixHQUFHLEVBQUUsSUFBSSxDQUFDOztFQUVWO0VBQ0EsRUFBRSxNQUFNLEdBQUcsR0FBRyxZQUFZLENBQUMsTUFBTTtFQUNqQyxFQUFFLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxpQkFBaUI7RUFDcEMsRUFBRSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTTtFQUMvQztFQUNBLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sR0FBRyxPQUFPLEdBQUcsR0FBRztFQUMvQztFQUNBLEVBQUUsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRTtFQUM1QixHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQztFQUNuQztFQUNBO0VBQ0EsRUFBRSxJQUFJLE9BQU8sSUFBSSxDQUFDLEVBQUU7RUFDcEIsR0FBRyxJQUFJLElBQUksR0FBRyxJQUFJO0VBQ2xCLEdBQUcsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXO0VBQ3JDLElBQUksS0FBSyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUU7RUFDekQ7RUFDQSxLQUFLLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUM7RUFDbEM7RUFDQSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxFQUFFO0VBQy9CLElBQUksQ0FBQztFQUNMO0VBQ0E7O0VBRUE7RUFDQTtFQUNBO0VBQ0EsQ0FBQyxTQUFTLG9CQUFvQixDQUFDLElBQUksRUFBRSxLQUFLLEVBQUU7RUFDNUMsRUFBRSxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSTtFQUNuRCxHQUFHLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3RCLEdBQUcsQ0FBQyxDQUFDO0VBQ0w7O0VBRUE7RUFDQTtFQUNBO0VBQ0EsQ0FBQyxTQUFTLGVBQWUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFO0VBQ3RDLEVBQUUsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0VBQ2hEOztFQUVBLENBQUMsVUFBVSxDQUFDLGNBQWMsR0FBRyxjQUFjO0VBQzNDLENBQUMsVUFBVSxDQUFDLGVBQWUsR0FBRyxlQUFlO0VBQzdDLENBQUMsVUFBVSxDQUFDLG9CQUFvQixHQUFHLG9CQUFvQjtFQUN2RCxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsR0FBRyxrQkFBa0I7RUFDbkQsQ0FBQyxVQUFVLENBQUMscUJBQXFCLEdBQUcscUJBQXFCO0VBQ3pELENBQUMsVUFBVSxDQUFDLEVBQUUsR0FBRyxFQUFFO0VBQ25CLENBQUMsVUFBVSxDQUFDLEdBQUcsR0FBRyxHQUFHO0VBQ3JCO0VBTUE7RUFDQTs7RUFFQTtFQUNBOztFQUVPLE1BQU0sYUFBYSxDQUFDOztFQUUzQixDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssRUFBRTtFQUNyQixFQUFFLGdCQUFnQixDQUFDLElBQUksQ0FBQztFQUN4QixFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztFQUNyQixFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0VBQzVDOztFQUVBLENBQUMscUJBQXFCLENBQUMsSUFBSSxFQUFFO0VBQzdCLEVBQUUsSUFBSSxJQUFJLElBQUksUUFBUSxFQUFFO0VBQ3hCLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7RUFDdkI7RUFDQTs7RUFFQSxDQUFDLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7RUFDbEMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLEtBQUssRUFBRTtFQUNuQixFQUFFLElBQUksS0FBSyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7RUFDNUIsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUs7RUFDdEIsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUM7RUFDeEM7RUFDQTtFQUNBO0VBQ0EsaUJBQWlCLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQzs7RUNqVTFDO0VBQ0E7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7O0VBRUEsTUFBTUEsUUFBTSxHQUFHLGNBQWM7O0VBRXRCLFNBQVNDLGVBQWEsRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBRTtFQUNqRSxJQUFJLE1BQU0sQ0FBQyxDQUFDLEVBQUVELFFBQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztFQUM3QixJQUFJLE1BQU0sQ0FBQyxDQUFDLEVBQUVBLFFBQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLFlBQVk7RUFDbkQsSUFBSSxNQUFNLENBQUMsQ0FBQyxFQUFFQSxRQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsR0FBRyxVQUFVO0VBQy9DLElBQUksTUFBTSxDQUFDLENBQUMsRUFBRUEsUUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEdBQUcsRUFBRTtFQUN6Qzs7RUFFTyxTQUFTRSxnQkFBYyxFQUFFLFVBQVUsRUFBRTs7RUFFNUMsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLFVBQVUsRUFBRSxPQUFPLEVBQUU7RUFDL0MsUUFBUSxHQUFHLEVBQUUsWUFBWTtFQUN6QixZQUFZLE9BQU8sSUFBSSxDQUFDLENBQUMsRUFBRUYsUUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0VBQzFDLFNBQVM7RUFDVCxRQUFRLEdBQUcsRUFBRSxVQUFVLEtBQUssRUFBRTtFQUM5QixZQUFZLElBQUksQ0FBQyxDQUFDLEVBQUVBLFFBQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUs7RUFDM0M7RUFDQSxLQUFLLENBQUM7RUFDTixJQUFJLE1BQU0sQ0FBQyxjQUFjLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRTtFQUN0RCxRQUFRLEdBQUcsRUFBRSxZQUFZO0VBQ3pCLFlBQVksT0FBTyxJQUFJLENBQUMsQ0FBQyxFQUFFQSxRQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7RUFDakQ7RUFDQSxLQUFLLENBQUM7O0VBRU4sSUFBSSxTQUFTLFFBQVEsSUFBSTtFQUN6QixRQUFRLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUVBLFFBQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQztFQUNyRCxRQUFRLE1BQU0sS0FBSyxHQUFHLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQztFQUMxQyxRQUFRLElBQUksQ0FBQyxDQUFDLEVBQUVBLFFBQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7RUFDbEQsUUFBUSxPQUFPLEtBQUs7RUFDcEI7O0VBRUEsSUFBSSxTQUFTLFdBQVcsSUFBSTtFQUM1QixRQUFRLEtBQUssSUFBSSxLQUFLLElBQUksSUFBSSxDQUFDLENBQUMsRUFBRUEsUUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEVBQUU7RUFDMUQsWUFBWSxLQUFLLENBQUMsS0FBSyxFQUFFO0VBQ3pCO0VBQ0E7RUFDQTtFQUNBLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUM7RUFDdEQ7O0VDOURBO0VBQ0E7RUFDQTs7RUFFQSxNQUFNQSxRQUFNLEdBQUcsWUFBWTs7RUFFcEIsU0FBU0MsZUFBYSxDQUFDLE1BQU0sRUFBRTtFQUN0QyxJQUFJLE1BQU0sQ0FBQyxDQUFDLEVBQUVELFFBQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLEVBQUU7RUFDckM7O0VBRUEsU0FBUyxZQUFZLEVBQUUsT0FBTyxFQUFFO0VBQ2hDLElBQUksSUFBSSxNQUFNLEdBQUc7RUFDakIsUUFBUSxPQUFPLEVBQUU7RUFDakI7RUFDQSxJQUFJLElBQUksQ0FBQyxDQUFDLEVBQUVBLFFBQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7RUFDM0MsSUFBSSxPQUFPLE1BQU07RUFDakI7RUFFQSxTQUFTLGVBQWUsRUFBRSxNQUFNLEVBQUU7RUFDbEMsSUFBSSxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFQSxRQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO0VBQzFELElBQUksSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUU7RUFDcEIsUUFBUSxJQUFJLENBQUMsQ0FBQyxFQUFFQSxRQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztFQUNuRDtFQUNBO0VBRUEsU0FBUyxnQkFBZ0IsRUFBRSxJQUFJLEVBQUU7RUFDakMsSUFBSSxJQUFJLENBQUMsQ0FBQyxFQUFFQSxRQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxNQUFNLEVBQUU7RUFDeEQsUUFBUSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztFQUM1QixLQUFLLENBQUM7RUFDTjs7RUFHTyxTQUFTRSxnQkFBYyxFQUFFLFVBQVUsRUFBRTtFQUM1QyxJQUFJLE1BQU0sR0FBRyxHQUFHO0VBQ2hCLFFBQVEsWUFBWSxFQUFFLGVBQWUsRUFBRTtFQUN2QztFQUNBLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDO0VBQ2xDOztFQ3BDQTtFQUNBO0VBQ0E7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7RUFFQSxNQUFNLElBQUksR0FBRyxTQUFTO0VBQ3RCLE1BQU0sTUFBTSxHQUFHLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDOztFQUVuQixTQUFTLGFBQWEsRUFBRSxNQUFNLEVBQUU7RUFDdkMsSUFBSSxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtFQUNuQzs7RUFFTyxTQUFTLGNBQWMsRUFBRSxVQUFVLEVBQUU7O0VBRTVDLElBQUksU0FBUyxRQUFRLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7RUFDNUMsUUFBUSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLE9BQU87RUFDcEMsUUFBUSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUN0QyxRQUFRLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFO0VBQzFCLFlBQVksSUFBSSxDQUFDLEtBQUs7RUFDdEIsWUFBWSxNQUFNLEVBQUUsU0FBUztFQUM3QixZQUFZLEdBQUcsRUFBRSxTQUFTO0VBQzFCLFlBQVk7RUFDWixTQUFTLENBQUM7O0VBRVY7RUFDQSxRQUFRLElBQUksT0FBTyxFQUFFO0VBQ3JCO0VBQ0EsWUFBWSxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7RUFDbEQsZ0JBQWdCLEdBQUcsRUFBRSxZQUFZO0VBQ2pDLG9CQUFvQixPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRztFQUNoRCxpQkFBaUI7RUFDakIsZ0JBQWdCLEdBQUcsRUFBRSxVQUFVLEdBQUcsRUFBRTtFQUNwQyxvQkFBb0IsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO0VBQ3hDLHdCQUF3QixHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsR0FBRztFQUMxRDtFQUNBLG9CQUFvQixJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsRUFBRTtFQUN0RCx3QkFBd0IsSUFBSSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDO0VBQy9EO0VBQ0E7RUFDQSxhQUFhLENBQUM7RUFDZCxTQUFTLE1BQU07RUFDZjtFQUNBLFlBQVksTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFO0VBQ2xELGdCQUFnQixHQUFHLEVBQUUsWUFBWTtFQUNqQyxvQkFBb0IsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUc7RUFDOUM7RUFDQSxhQUFhLENBQUM7RUFDZDtFQUNBOztFQUVBLElBQUksU0FBUyxPQUFPLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRTtFQUNwQyxRQUFRLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztFQUNyQyxRQUFRLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUTs7RUFFdEMsUUFBUSxJQUFJLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFO0VBQzFDLFlBQVksTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLHNCQUFzQixDQUFDLENBQUM7RUFDaEU7O0VBRUE7RUFDQSxRQUFRLElBQUksS0FBSyxDQUFDLEdBQUcsRUFBRTtFQUN2QixZQUFZLEtBQUssQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7RUFDbkQsWUFBWSxLQUFLLENBQUMsR0FBRyxHQUFHLFNBQVM7RUFDakMsWUFBWSxLQUFLLENBQUMsTUFBTSxHQUFHLFNBQVM7RUFDcEM7O0VBRUE7RUFDQSxRQUFRLEtBQUssQ0FBQyxHQUFHLEdBQUcsR0FBRztFQUN2QixRQUFRLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSTs7RUFFekI7RUFDQSxRQUFRLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtFQUM3QixZQUFZLE1BQU0sT0FBTyxHQUFHLFVBQVUsSUFBSSxFQUFFO0VBQzVDLGdCQUFnQixJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUM7RUFDL0MsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7RUFDeEIsWUFBWSxLQUFLLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDO0VBQ3BELFlBQVksSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7RUFDL0M7RUFDQTs7RUFFQSxJQUFJLE1BQU0sR0FBRyxHQUFHLEVBQUU7RUFDbEIsSUFBSSxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLFFBQVE7RUFDckMsSUFBSSxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFHLE9BQU87RUFDckMsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUM7RUFDbEM7O0VDekZBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7O0VBRUE7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7RUFFTyxNQUFNLFdBQVcsQ0FBQzs7RUFFekIsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFO0VBQ2xCLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHO0VBQ2pCOztFQUVBLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUM7O0VBRTdCO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO0VBQ2xCLEtBQUssTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQztFQUN2Qzs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO0VBQ2xCLFFBQVEsSUFBSSxRQUFRLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLEVBQUU7RUFDdEQsWUFBWSxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sQ0FBQztFQUNsRCxTQUFTO0VBQ1QsUUFBUSxPQUFPLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztFQUN4RDtFQUNBOzs7RUEwQkE7RUFDQTtFQUNBOztFQUVPLE1BQU0sYUFBYSxTQUFTLFdBQVcsQ0FBQzs7RUFFL0MsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRTtFQUN4QixRQUFRLEtBQUssQ0FBQyxHQUFHLENBQUM7RUFDbEIsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUk7RUFDcEI7O0VBRUEsQ0FBQyxLQUFLLEdBQUc7RUFDVCxRQUFRLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsS0FBSztFQUNqRDtFQUNBOzs7RUFHQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7RUFFTyxNQUFNLGFBQWEsU0FBUyxXQUFXLENBQUM7RUFDL0M7RUFDQSxJQUFJLFdBQVcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFO0VBQzNCLFFBQVEsS0FBSyxDQUFDLEdBQUcsQ0FBQztFQUNsQixRQUFRLE1BQU07RUFDZCxZQUFZLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztFQUN6QixZQUFZLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztFQUN6QixZQUFZLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztFQUM3QixZQUFZLFNBQVMsQ0FBQyxFQUFFLENBQUM7RUFDekIsU0FBUyxHQUFHLElBQUk7RUFDaEI7RUFDQSxRQUFRLElBQUksQ0FBQyxTQUFTLEdBQUcsVUFBVSxFQUFFLEVBQUU7RUFDdkMsWUFBWSxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRTtFQUMzQixZQUFZLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUN6QyxTQUFTO0VBQ1QsUUFBUSxJQUFJLENBQUMsU0FBUyxHQUFHLFVBQVUsRUFBRSxFQUFFO0VBQ3ZDLFlBQVksSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUU7RUFDM0IsWUFBWSxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztFQUM1QjtFQUNBLFFBQVEsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLEVBQUUsRUFBRTtFQUN2QyxZQUFZLE9BQU8sRUFBRTtFQUNyQjtFQUNBOztFQUVBLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtFQUNsQixRQUFRLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0VBQ3hDLFFBQVEsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7RUFDeEMsUUFBUSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztFQUN4QyxRQUFRLE9BQU87RUFDZixZQUFZLFFBQVEsRUFBRSxHQUFHO0VBQ3pCLFlBQVksUUFBUSxFQUFFLEdBQUc7RUFDekIsWUFBWSxZQUFZLEVBQUUsR0FBRztFQUM3QixZQUFZLFNBQVMsRUFBRSxNQUFNO0VBQzdCLFlBQVksS0FBSyxFQUFFLEdBQUc7RUFDdEIsWUFBWSxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztFQUMxQztFQUNBO0VBQ0E7OztFQUdBO0VBQ0E7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7O0VBRUEsU0FBUyxNQUFNLEVBQUUsRUFBRSxFQUFFO0VBQ3JCLElBQUksT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUMxQjtFQUNBLFNBQVMsT0FBTyxFQUFFLEVBQUUsRUFBRTtFQUN0QixJQUFJLE9BQU8sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO0VBQzdCO0VBQ0EsU0FBUyxTQUFTLEVBQUUsRUFBRSxFQUFFO0VBQ3hCLElBQUksSUFBSSxFQUFFLEdBQUcsRUFBRSxFQUFFO0VBQ2pCLFFBQVEsT0FBTyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUM7RUFDakMsS0FBSyxNQUFNO0VBQ1gsUUFBUSxPQUFPLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQztFQUM3QztFQUNBOztFQUVPLE1BQU0saUJBQWlCLFNBQVMsV0FBVyxDQUFDOztFQUVuRCxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFO0VBQ3hCLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQztFQUNaLFFBQVEsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsTUFBTSxDQUFDLEdBQUcsSUFBSTtFQUNuQyxRQUFRLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7RUFFM0M7RUFDQSxRQUFRLElBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDO0VBQ2xDLFFBQVEsSUFBSSxDQUFDLE1BQU0sR0FBRyxVQUFVLEVBQUUsRUFBRTtFQUNwQztFQUNBO0VBQ0E7RUFDQSxZQUFZLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRTtFQUN4QixZQUFZLEVBQUUsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7RUFDckM7RUFDQSxZQUFZLElBQUksTUFBTSxJQUFJLFNBQVMsRUFBRTtFQUNyQyxnQkFBZ0IsRUFBRSxHQUFHLE1BQU0sQ0FBQyxFQUFFLENBQUM7RUFDL0IsYUFBYSxNQUFNLElBQUksTUFBTSxJQUFJLFVBQVUsRUFBRTtFQUM3QyxnQkFBZ0IsRUFBRSxHQUFHLE9BQU8sQ0FBQyxFQUFFLENBQUM7RUFDaEMsYUFBYSxNQUFNLElBQUksTUFBTSxJQUFJLGFBQWEsRUFBRTtFQUNoRCxnQkFBZ0IsRUFBRSxHQUFHLFNBQVMsQ0FBQyxFQUFFLENBQUM7RUFDbEM7RUFDQTtFQUNBLFlBQVksRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztFQUNoQyxZQUFZLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7RUFDaEMsWUFBWSxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRTtFQUNsQztFQUNBOztFQUVBLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRTtFQUNmLFFBQVEsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUTtFQUNqRTtFQUNBOzs7O0VBSUE7RUFDQTtFQUNBOztFQUVBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7RUFFQSxTQUFTLFdBQVcsQ0FBQyxNQUFNLEVBQUU7O0VBRTdCLElBQUksSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtFQUMzQixRQUFRLE9BQU8sU0FBUyxZQUFZLElBQUksQ0FBQyxPQUFPLFNBQVMsQ0FBQztFQUMxRCxLQUFLLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtFQUNuQyxRQUFRLE9BQU8sU0FBUyxZQUFZLElBQUksQ0FBQyxPQUFPLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUM3RDs7RUFFQTtFQUNBLElBQUksTUFBTSxZQUFZLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUNoRTtFQUNBLElBQUksT0FBTyxTQUFTLFlBQVksQ0FBQyxNQUFNLEVBQUU7RUFDekM7RUFDQSxNQUFNLElBQUksTUFBTSxJQUFJLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtFQUN4QyxRQUFRLE1BQU0sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQztFQUNqRCxRQUFRLE1BQU0sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQztFQUNqRCxRQUFRLE9BQU8sTUFBTSxJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sS0FBSyxNQUFNLEdBQUcsTUFBTSxDQUFDLElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxDQUFDO0VBQ3RGO0VBQ0E7RUFDQTtFQUNBLE1BQU0sSUFBSSxNQUFNLElBQUksWUFBWSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7RUFDOUQsUUFBUSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztFQUN2RSxRQUFRLE1BQU0sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsWUFBWSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0VBQ3ZFLFFBQVEsT0FBTyxNQUFNLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxLQUFLLE1BQU0sR0FBRyxNQUFNLENBQUMsSUFBSSxPQUFPLEdBQUcsT0FBTyxDQUFDLENBQUM7RUFDdEY7RUFDQTtFQUNBO0VBQ0EsTUFBTSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7RUFDeEQsUUFBUSxJQUFJLE1BQU0sSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxJQUFJLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7RUFDOUUsVUFBVSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUM7RUFDbkQsVUFBVSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0VBQ3ZEO0VBQ0EsVUFBVSxPQUFPLE1BQU0sSUFBSSxDQUFDLE1BQU0sR0FBRyxPQUFPLEtBQUssTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsQ0FBQztFQUN4RjtFQUNBO0VBQ0E7RUFDQTtFQUNBLE1BQU0sT0FBTyxTQUFTO0VBQ3RCLEtBQUs7RUFDTDtFQUNBOztFQUVPLE1BQU0sb0JBQW9CLFNBQVMsV0FBVyxDQUFDOztFQUV0RCxJQUFJLFdBQVcsQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFO0VBQzdCLFFBQVEsS0FBSyxDQUFDLEdBQUcsQ0FBQztFQUNsQjtFQUNBLFFBQVEsSUFBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDO0VBQ3pDOztFQUVBLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtFQUNsQixRQUFRLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDO0VBQ3pEO0VBQ0E7O0VDdlFBO0VBQ0E7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7O0VBRUEsTUFBTSxLQUFLLEdBQUcsWUFBWTtFQUMxQixJQUFJLE9BQU8sV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU07RUFDbkM7O0VBRUEsTUFBTSxLQUFLLEdBQUcsWUFBWTtFQUMxQixJQUFJLE9BQU8sSUFBSSxJQUFJLEVBQUUsQ0FBQyxNQUFNO0VBQzVCOztFQUVBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7R0FFcUIsWUFBWTtFQUNqQyxJQUFJLE1BQU0sUUFBUSxHQUFHLEtBQUssRUFBRTtFQUM1QixJQUFJLE1BQU0sUUFBUSxHQUFHLEtBQUssRUFBRTtFQUM1QixJQUFJLE9BQU87RUFDWCxRQUFRLEdBQUcsRUFBRSxZQUFZO0VBQ3pCLFlBQVksT0FBTyxRQUFRLElBQUksS0FBSyxFQUFFLEdBQUcsUUFBUTtFQUNqRDtFQUNBO0VBQ0EsRUFBQzs7O0VBZUQ7RUFDQTtFQUNBOztFQUVPLFNBQVMsS0FBSyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsSUFBSSxHQUFHLENBQUMsRUFBRSxPQUFPLENBQUMsRUFBRSxFQUFFO0VBQ3pELElBQUksTUFBTSxNQUFNLEdBQUcsRUFBRTtFQUNyQixJQUFJLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTztFQUN2QyxJQUFJLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRTtFQUNwQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUM7RUFDL0M7RUFDQSxJQUFJLElBQUksS0FBSyxHQUFHLEdBQUcsRUFBRTtFQUNyQixRQUFRLEtBQUssSUFBSSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLElBQUksRUFBRTtFQUNoRCxVQUFVLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0VBQ3hCO0VBQ0EsS0FBSyxNQUFNLElBQUksS0FBSyxHQUFHLEdBQUcsRUFBRTtFQUM1QixRQUFRLEtBQUssSUFBSSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLElBQUksRUFBRTtFQUNoRCxVQUFVLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0VBQ3hCO0VBQ0E7RUFDQSxJQUFJLElBQUksV0FBVyxFQUFFO0VBQ3JCLFFBQVEsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7RUFDeEI7RUFDQSxJQUFJLE9BQU8sTUFBTTtFQUNqQjs7O0VBR0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7RUFFTyxTQUFTLE9BQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsRUFBRSxFQUFFO0VBQzdELElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsR0FBRyxPQUFPLENBQUM7RUFDekMsSUFBSSxJQUFJLFNBQVMsSUFBSSxTQUFTLEVBQUU7RUFDaEMsUUFBUSxJQUFJLEtBQUssR0FBRyxTQUFTLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0VBQ3hELFFBQVEsSUFBSSxPQUFPLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7RUFDN0QsUUFBUSxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUM7RUFDdkMsS0FBSyxNQUFNLElBQUksU0FBUyxJQUFJLFNBQVMsRUFBRTtFQUN2QyxRQUFRLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUM7RUFDaEU7RUFDQTtFQUNBLElBQUksSUFBSSxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtFQUM1QixRQUFRLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsTUFBTTtFQUN0RDtFQUNBO0VBQ0EsSUFBSSxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO0VBQ3pCLElBQUksT0FBTyxDQUFDLEdBQUcsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0VBQzlCOztFQzdGQTtFQUNBO0VBQ0E7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7RUFFTyxNQUFNLGlCQUFpQixDQUFDO0VBQy9CLElBQUksV0FBVyxHQUFHO0VBQ2xCLFFBQVFDLGVBQXNCLENBQUMsSUFBSSxDQUFDO0VBQ3BDO0VBQ0EsSUFBSSxHQUFHLENBQUMsR0FBRztFQUNYLFFBQVEsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQztFQUMxQztFQUNBO0FBQ0FDLGtCQUF1QixDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQzs7O0VBR3BEO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7RUFFTyxNQUFNLGtCQUFrQixDQUFDOztFQUVoQyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO0VBQzVCLFFBQVFELGVBQXNCLENBQUMsSUFBSSxDQUFDO0VBQ3BDLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU87RUFDN0IsUUFBUSxJQUFJLEtBQUssR0FBRyxTQUFTLEVBQUU7RUFDL0IsWUFBWSxJQUFJLENBQUMsTUFBTSxHQUFHO0VBQzFCLGdCQUFnQixRQUFRLEVBQUUsQ0FBQztFQUMzQixnQkFBZ0IsUUFBUSxFQUFFLENBQUM7RUFDM0IsZ0JBQWdCLFlBQVksRUFBRSxDQUFDO0VBQy9CLGdCQUFnQixTQUFTLEVBQUUsQ0FBQztFQUM1QixnQkFBZ0IsS0FBSyxFQUFFLENBQUMsU0FBUyxFQUFFLFNBQVM7RUFDNUM7RUFDQSxTQUFTLE1BQU07RUFDZixZQUFZLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztFQUMvQjtFQUNBOztFQUVBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSSxTQUFTLENBQUMsQ0FBQyxLQUFLLEVBQUU7RUFDdEIsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDO0VBQzFDOztFQUVBO0VBQ0EsSUFBSSxTQUFTLENBQUMsR0FBRztFQUNqQixRQUFRLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7RUFDL0I7RUFDQTtBQUNBQyxrQkFBdUIsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUM7Ozs7O0VBS3JEO0VBQ0E7RUFDQTs7RUFFQTtFQUNBOztFQUVBO0VBQ0E7RUFDQTs7RUFFTyxNQUFNLGlCQUFpQixDQUFDOztFQUUvQixJQUFJLFdBQVcsR0FBRztFQUNsQixRQUFRRCxlQUFzQixDQUFDLElBQUksQ0FBQztFQUNwQzs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxJQUFJLE1BQU0sQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQztFQUM3QixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUM7RUFDMUM7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7O0VBRUEsSUFBSSxTQUFTLEdBQUc7RUFDaEIsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDO0VBQzFDOztFQUVBO0VBQ0E7RUFDQTs7RUFFQSxJQUFJLElBQUksSUFBSSxDQUFDLEdBQUc7RUFDaEIsUUFBUSxPQUFPLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQztFQUNsQztFQUNBO0FBQ0FDLGtCQUF1QixDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQzs7RUM1SXBEO0VBQ0E7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7O0VBRU8sTUFBTSxrQkFBa0IsU0FBUyxpQkFBaUIsQ0FBQzs7RUFFMUQsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRTtFQUM1QixRQUFRLEtBQUssRUFBRTtFQUNmO0VBQ0EsUUFBUSxJQUFJLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxHQUFHLE9BQU87RUFDcEMsUUFBUSxJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUU7RUFDaEM7RUFDQSxZQUFZLElBQUksQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQztFQUM1QyxTQUFTLE1BQU0sSUFBSSxLQUFLLElBQUksU0FBUyxFQUFFO0VBQ3ZDO0VBQ0EsWUFBWSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUM7RUFDM0IsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3JELGdCQUFnQixJQUFJLEVBQUUsUUFBUTtFQUM5QixnQkFBZ0IsSUFBSSxDQUFDO0VBQ3JCLGFBQWEsQ0FBQztFQUNkLFNBQVMsTUFBTTtFQUNmLFlBQVksSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFO0VBQzVCO0VBQ0E7O0VBRUEsSUFBSSxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFO0VBQzVCLFFBQVEsT0FBTyxPQUFPLENBQUMsT0FBTztFQUM5QixhQUFhLElBQUksQ0FBQyxNQUFNO0VBQ3hCLGdCQUFnQixJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUM7RUFDaEQsZ0JBQWdCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtFQUN2QyxhQUFhLENBQUM7RUFDZDs7RUFFQSxJQUFJLFNBQVMsQ0FBQyxHQUFHO0VBQ2pCLFFBQVEsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRTtFQUNsQzs7RUFFQSxJQUFJLElBQUksSUFBSSxDQUFDLEdBQUc7RUFDaEIsUUFBUSxPQUFPLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQztFQUNuQztFQUNBOzs7RUFHQSxTQUFTLFdBQVcsQ0FBQyxLQUFLLEVBQUU7RUFDNUIsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtFQUMvQixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUM7RUFDakQ7RUFDQTtFQUNBLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUs7RUFDekIsUUFBUSxJQUFJLEtBQUssR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDcEQsUUFBUSxJQUFJLEtBQUssR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDcEQsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQztFQUN6QyxLQUFLLENBQUM7RUFDTjtFQUNBLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7RUFDM0MsUUFBUSxJQUFJLFNBQVMsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQ25FLFFBQVEsSUFBSSxRQUFRLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQzlEO0VBQ0EsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLEVBQUU7RUFDL0MsWUFBWSxNQUFNLElBQUksS0FBSyxDQUFDLDZCQUE2QixDQUFDO0VBQzFEO0VBQ0E7RUFDQSxJQUFJLE9BQU8sS0FBSztFQUNoQjs7RUNuRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7O0VBR0E7RUFDQSxTQUFTLGFBQWEsQ0FBQyxJQUFJLEVBQUU7RUFDN0IsSUFBSSxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0VBQ3RCOztFQUVBO0VBQ0EsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7RUFDaEMsSUFBSSxPQUFPLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7RUFDN0M7O0VBRUE7RUFDQSxTQUFTLGlCQUFpQixDQUFDLElBQUksRUFBRTtFQUNqQyxJQUFJLE9BQU8sUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztFQUM3Qzs7O0VBR08sTUFBTSxpQkFBaUIsU0FBUyxlQUFlLENBQUM7O0VBRXZELElBQUksV0FBVyxDQUFDLEdBQUcsRUFBRTtFQUNyQixRQUFRLEtBQUssRUFBRTtFQUNmLFFBQVEsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHO0VBQ3ZCOztFQUVBLElBQUksSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQzs7RUFFakM7RUFDQTtFQUNBO0VBQ0E7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7RUFDbkIsUUFBUSxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRTtFQUN4QyxZQUFZLE1BQU0sR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7RUFDaEM7RUFDQSxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0VBQ3BDLFlBQVksTUFBTSxJQUFJLEtBQUssQ0FBQywyQkFBMkIsQ0FBQztFQUN4RDtFQUNBLFFBQVEsTUFBTSxNQUFNLEdBQUc7RUFDdkIsWUFBWSxNQUFNLEVBQUUsRUFBRTtFQUN0QixZQUFZLEdBQUcsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ2xELFlBQVksSUFBSSxFQUFFLFNBQVM7RUFDM0IsWUFBWSxLQUFLLEVBQUUsU0FBUztFQUM1QixZQUFZLElBQUksRUFBRSxTQUFTO0VBQzNCLFlBQVksSUFBSSxFQUFFO0VBQ2xCLFNBQVM7RUFDVCxRQUFRLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFO0VBQ3pDLFFBQVEsSUFBSSxPQUFPLEVBQUUsSUFBSTtFQUN6QixRQUFRLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxNQUFNO0VBQ2pDLFFBQVEsSUFBSSxJQUFJLElBQUksQ0FBQyxFQUFFO0VBQ3ZCLFlBQVksT0FBTyxNQUFNLENBQUM7RUFDMUI7RUFDQSxRQUFRLElBQUksQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsYUFBYSxDQUFDO0VBQ3RFLFFBQVEsSUFBSSxLQUFLLEVBQUU7RUFDbkI7RUFDQTtFQUNBLFlBQVksSUFBSSxHQUFHLEtBQUssQ0FBQyxHQUFHO0VBQzVCLFlBQVksSUFBSSxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEVBQUU7RUFDNUQsZ0JBQWdCLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7RUFDL0Q7RUFDQTtFQUNBLFFBQVEsSUFBSSxPQUFPLElBQUksU0FBUyxFQUFFO0VBQ2xDO0VBQ0EsWUFBWSxJQUFJLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7RUFDL0IsWUFBWSxJQUFJLElBQUksSUFBSSxTQUFTLEVBQUU7RUFDbkM7RUFDQSxnQkFBZ0IsSUFBSSxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEVBQUU7RUFDaEUsb0JBQW9CLE9BQU8sR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUM7RUFDbkUsaUJBQWlCO0VBQ2pCO0VBQ0EsU0FBUztFQUNULFFBQVEsSUFBSSxPQUFPLElBQUksU0FBUyxFQUFFO0VBQ2xDO0VBQ0EsWUFBWSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQztFQUN4RDs7RUFFQTtFQUNBLFFBQVEsSUFBSSxDQUFDLElBQUksT0FBTyxDQUFDLE1BQU0sSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLElBQUksRUFBRTtFQUMxRCxZQUFZLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0VBQ3BEO0VBQ0E7RUFDQSxRQUFRLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxJQUFJLElBQUksT0FBTyxDQUFDLElBQUksR0FBRyxJQUFJLEVBQUU7RUFDdEQsWUFBWSxNQUFNLENBQUMsSUFBSSxJQUFJLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7RUFDakU7RUFDQSxRQUFRLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLElBQUksT0FBTyxDQUFDLEtBQUssR0FBRyxJQUFJLEVBQUU7RUFDeEQsWUFBWSxNQUFNLENBQUMsSUFBSSxJQUFJLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDakUsU0FBUztFQUNUO0VBQ0EsUUFBUSxJQUFJLEdBQUcsRUFBRSxJQUFJO0VBQ3JCLFFBQVEsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7RUFDdEMsWUFBWSxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUc7RUFDMUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQztFQUNyRCxZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUcsU0FBUztFQUN2RixZQUFZLE1BQU0sQ0FBQyxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxHQUFHLFNBQVM7RUFDeEYsWUFBWSxNQUFNLENBQUMsR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRztFQUM3QyxTQUFTLE1BQU07RUFDZixZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUk7RUFDckMsWUFBWSxNQUFNLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJO0VBQ3RDO0VBQ0EsWUFBWSxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSTtFQUNsQyxZQUFZLEdBQUcsR0FBRyxDQUFDLElBQUksSUFBSSxTQUFTLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUM7RUFDbkYsWUFBWSxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSztFQUNwQyxZQUFZLElBQUksR0FBRyxDQUFDLEtBQUssSUFBSSxTQUFTLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDO0VBQ3RGLFlBQVksTUFBTSxDQUFDLEdBQUcsR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7RUFDM0Q7RUFDQSxRQUFRLE9BQU8sTUFBTTtFQUNyQjtFQUNBOztFQUVBO0VBQ0E7RUFDQTs7O0VBR0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBOztFQUVBO0VBQ0E7O0VBRUEsU0FBUyxVQUFVLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxVQUFVLEVBQUU7O0VBRTdDLElBQUksU0FBUyxrQkFBa0IsQ0FBQyxFQUFFLEVBQUU7RUFDcEMsUUFBUSxPQUFPLEVBQUU7RUFDakI7RUFDQTtFQUNBLElBQUksSUFBSSxJQUFJLEdBQUcsQ0FBQztFQUNoQixDQUFDLElBQUksS0FBSyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQztFQUMzQixDQUFDLFVBQVUsR0FBRyxVQUFVLElBQUksa0JBQWtCO0VBQzlDLENBQUMsT0FBTyxJQUFJLElBQUksS0FBSyxFQUFFO0VBQ3ZCLEVBQUUsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksR0FBRyxLQUFLLElBQUksQ0FBQyxDQUFDO0VBQzVDLEVBQUUsSUFBSSxTQUFTLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztFQUN0QyxFQUFFLElBQUksU0FBUyxLQUFLLE1BQU0sRUFBRTtFQUM1QixHQUFHLE9BQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7RUFDdEIsR0FBRyxNQUFNLElBQUksU0FBUyxHQUFHLE1BQU0sRUFBRTtFQUNqQyxLQUFLLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0VBQ3BCLEdBQUcsTUFBTTtFQUNULEtBQUssS0FBSyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7RUFDckI7RUFDQTtFQUNBLEdBQUcsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztFQUN4Qjs7RUM3SkE7RUFDQTtFQUNBOztFQUVBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7O0VBRU8sTUFBTSxLQUFLLENBQUM7O0VBRW5CLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7RUFDNUIsUUFBUSxJQUFJLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxHQUFHLE9BQU87RUFDOUM7RUFDQSxRQUFRRCxlQUFzQixDQUFDLElBQUksQ0FBQztFQUNwQztFQUNBLFFBQVFFLGVBQXdCLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxVQUFVLElBQUksVUFBVSxDQUFDO0VBQzVFO0VBQ0EsUUFBUUMsZ0JBQXNCLENBQUMsSUFBSSxDQUFDO0VBQ3BDLFFBQVEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7RUFDbEQ7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7RUFDdkIsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLE9BQU87RUFDOUQsUUFBUSxJQUFJLEtBQUssR0FBRyxJQUFJLEVBQUU7RUFDMUIsWUFBWSxNQUFNLElBQUksS0FBSyxFQUFFLGdDQUFnQyxFQUFFLEtBQUssRUFBRSxJQUFJO0VBQzFFO0VBQ0EsUUFBUSxLQUFLLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0VBQzFCLFFBQVEsSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztFQUN4QixRQUFRLEtBQUssR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsS0FBSyxDQUFDO0VBQ3ZELFFBQVEsSUFBSSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLENBQUM7RUFDcEQsUUFBUSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxFQUFFO0VBQ3JDLFFBQVEsT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO0VBQ2hFLGFBQWEsR0FBRyxDQUFDLENBQUMsTUFBTSxLQUFLO0VBQzdCLGdCQUFnQixPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDO0VBQzFELGFBQWEsQ0FBQztFQUNkO0VBQ0E7QUFDQUYsa0JBQXVCLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQztBQUN4Q0csa0JBQXlCLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQztBQUMxQ0MsbUJBQXVCLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQzs7O0VBR3hDO0VBQ0E7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7O0VBRU8sTUFBTSxVQUFVLENBQUM7O0VBRXhCLElBQUksV0FBVyxDQUFDLEtBQUssRUFBRTtFQUN2QixRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztFQUMzQjtFQUNBLFFBQVEsSUFBSSxDQUFDLE9BQU87RUFDcEI7RUFDQSxRQUFRLElBQUksQ0FBQyxNQUFNO0VBQ25CO0VBQ0EsUUFBUSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFO0VBQ25DLFFBQVEsSUFBSSxDQUFDLE9BQU87RUFDcEI7O0VBRUE7RUFDQTtFQUNBO0VBQ0EsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO0VBQ2xCLFFBQVEsTUFBTSxXQUFXO0VBQ3pCLFlBQVksSUFBSSxDQUFDLE9BQU8sSUFBSSxTQUFTO0VBQ3JDLFlBQVksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE1BQU07RUFDM0QsU0FBUztFQUNULFFBQVE7RUFDUixZQUFZLENBQUMsV0FBVztFQUN4QixZQUFZLElBQUksQ0FBQyxNQUFNLElBQUksU0FBUztFQUNwQyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztFQUN6QixVQUFVO0VBQ1Y7RUFDQSxZQUFZLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDO0VBQzNDO0VBQ0E7RUFDQSxRQUFRLElBQUksV0FBVyxFQUFFO0VBQ3pCLFlBQVksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO0VBQzNELFlBQVksT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztFQUM1QyxZQUFZLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztFQUN4QztFQUNBLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUc7RUFDdkM7RUFDQSxpQkFBaUIsR0FBRyxDQUFDLENBQUMsS0FBSyxLQUFLO0VBQ2hDLG9CQUFvQixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUU7RUFDckQsd0JBQXdCLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUM7RUFDcEU7RUFDQSxvQkFBb0IsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUM7RUFDckQsaUJBQWlCLENBQUM7RUFDbEI7RUFDQTtFQUNBLFFBQVEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEtBQUs7RUFDbkQsWUFBWSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO0VBQ3RDLFNBQVMsQ0FBQztFQUNWLFFBQVEsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVk7RUFDcEY7RUFDQSxRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxJQUFJLFNBQVMsR0FBRyxLQUFLO0VBQ3pELFFBQVEsT0FBTyxLQUFLO0VBQ3BCOztFQUVBLElBQUksS0FBSyxHQUFHO0VBQ1osUUFBUSxJQUFJLENBQUMsSUFBSSxHQUFHLFNBQVM7RUFDN0IsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLFNBQVM7RUFDL0IsUUFBUSxJQUFJLENBQUMsT0FBTyxHQUFHLFNBQVM7RUFDaEMsUUFBUSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFO0VBQ25DO0VBQ0E7O0VBd0JBO0VBQ0E7RUFDQTs7RUFFTyxNQUFNLFVBQVUsU0FBUyxLQUFLLENBQUM7O0VBRXRDLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUU7RUFDNUIsUUFBUSxNQUFNLENBQUMsVUFBVSxDQUFDLEdBQUcsT0FBTztFQUNwQyxRQUFRLEtBQUssQ0FBQyxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsZUFBZSxDQUFDLENBQUM7RUFDdkQ7RUFDQSxRQUFRQyxhQUFxQixDQUFDLElBQUksQ0FBQztFQUNuQyxRQUFRLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDO0VBQ25DOztFQUVBLElBQUksU0FBUyxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUU7RUFDN0IsUUFBUSxJQUFJLFFBQVEsSUFBSSxLQUFLLEVBQUU7RUFDL0IsWUFBWSxJQUFJLEVBQUUsR0FBRyxZQUFZLGlCQUFpQixDQUFDLEVBQUU7RUFDckQsZ0JBQWdCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBQyw2QkFBNkIsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0VBQ3RFO0VBQ0EsWUFBWSxPQUFPLEdBQUcsQ0FBQztFQUN2QjtFQUNBOztFQUVBLElBQUksVUFBVSxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUU7RUFDL0IsUUFBUSxJQUFJLFFBQVEsSUFBSSxLQUFLLEVBQUU7RUFDL0IsWUFBWSxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUksU0FBUyxJQUFJLElBQUksSUFBSSxPQUFPLEVBQUU7RUFDNUQsZ0JBQWdCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsR0FBRztFQUMzRCxhQUFhLE1BQU07RUFDbkIsZ0JBQWdCLElBQUksQ0FBQyxXQUFXLEVBQUU7RUFDbEM7RUFDQSxZQUFZLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtFQUNuQyxZQUFZLElBQUksQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDO0VBQzFDLFNBQVM7RUFDVDtFQUNBO0FBQ0FDLGdCQUFzQixDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUM7O0VBRTVDO0VBQ0E7RUFDQTs7RUFFTyxTQUFTLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFO0VBQ3JDLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxPQUFPO0VBQ3ZDLElBQUksSUFBSSxHQUFHLElBQUksU0FBUyxFQUFFO0VBQzFCLFFBQVEsR0FBRyxHQUFHLElBQUksa0JBQWtCLENBQUMsQ0FBQyxLQUFLLENBQUM7RUFDNUM7RUFDQSxJQUFJLE1BQU0sS0FBSyxHQUFHLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQztFQUN0QyxJQUFJLEtBQUssQ0FBQyxHQUFHLEdBQUcsR0FBRztFQUNuQixJQUFJLE9BQU8sS0FBSztFQUNoQjs7O0VBR0E7RUFDQTtFQUNBOztFQUVBO0VBQ0E7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7O0VBRU8sTUFBTSxlQUFlLENBQUM7RUFDN0IsSUFBSSxXQUFXLENBQUMsS0FBSyxFQUFFO0VBQ3ZCO0VBQ0EsUUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUs7RUFDM0I7RUFDQSxRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsU0FBUztFQUNoQztFQUNBLFFBQVEsSUFBSSxDQUFDLFFBQVEsR0FBRyxTQUFTO0VBQ2pDOztFQUVBLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtFQUNsQixRQUFRLE1BQU0sVUFBVTtFQUN4QixZQUFZLElBQUksQ0FBQyxPQUFPLElBQUksU0FBUztFQUNyQyxZQUFZLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxNQUFNO0VBQzNELFNBQVM7RUFDVCxRQUFRLElBQUksVUFBVSxFQUFFO0VBQ3hCLFlBQVksSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO0VBQzNELFlBQVksSUFBSSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsT0FBTztFQUM1QyxZQUFZLElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSztFQUNsRCxnQkFBZ0IsT0FBTyxZQUFZLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQztFQUM5QyxhQUFhLENBQUM7RUFDZDtFQUNBO0VBQ0EsUUFBUSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsS0FBSztFQUNuRCxZQUFZLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7RUFDcEMsU0FBUyxDQUFDO0VBQ1YsUUFBUSxPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZO0VBQy9FOztFQUVBLElBQUksS0FBSyxHQUFHO0VBQ1osUUFBUSxJQUFJLENBQUMsT0FBTyxHQUFHLFNBQVM7RUFDaEMsUUFBUSxJQUFJLENBQUMsUUFBUSxHQUFHLFNBQVM7RUFDakM7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7O0VBRUEsU0FBUyxZQUFZLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRTtFQUNqQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxHQUFHLElBQUk7RUFDcEMsSUFBSSxJQUFJLElBQUksSUFBSSxRQUFRLEVBQUU7RUFDMUIsUUFBUSxPQUFPLElBQUlDLGFBQXFCLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQztFQUNuRCxLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksWUFBWSxFQUFFO0VBQ3JDLFFBQVEsT0FBTyxJQUFJQyxpQkFBeUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO0VBQ3ZELEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxlQUFlLEVBQUU7RUFDeEMsUUFBUSxPQUFPLElBQUlDLG9CQUE0QixDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7RUFDMUQsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLFFBQVEsRUFBRTtFQUNqQyxRQUFRLE9BQU8sSUFBSUMsYUFBcUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO0VBQ25ELEtBQUssTUFBTTtFQUNYLFFBQVEsT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsRUFBRSxJQUFJLENBQUM7RUFDdEQ7RUFDQTs7RUNoUkE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBOztFQUVPLFNBQVMsS0FBSyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUU7O0VBRXpDLElBQUksTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDO0VBQ3BDLElBQUksS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUM7O0VBRXpDO0VBQ0EsSUFBSSxNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUU7RUFDNUMsUUFBUSxHQUFHLEVBQUUsWUFBWTtFQUN6QixZQUFZLE9BQU8sT0FBTztFQUMxQjtFQUNBLEtBQUssQ0FBQztFQUNOO0VBQ0E7RUFDQSxJQUFJLFNBQVMsaUJBQWlCLENBQUMsSUFBSSxFQUFFO0VBQ3JDLFFBQVEsS0FBSyxDQUFDLFdBQVcsRUFBRTtFQUMzQixRQUFRLEtBQUssQ0FBQyxlQUFlLEVBQUU7RUFDL0IsUUFBUSxLQUFLLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0VBQ3hDO0VBQ0EsSUFBSSxLQUFLLElBQUksR0FBRyxJQUFJLE9BQU8sRUFBRTtFQUM3QixRQUFRLEdBQUcsQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsQ0FBQztFQUM1QztFQUNBLElBQUksT0FBTyxLQUFLO0VBQ2hCOzs7RUFHQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7O0VBRUEsU0FBUyxhQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRTtFQUMvQixJQUFJLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRTtFQUM5Qjs7RUFFQSxTQUFTLGNBQWMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFO0VBQ2hDLElBQUksT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFO0VBQzlCOztFQUVPLE1BQU0sVUFBVSxTQUFTLGVBQWUsQ0FBQzs7RUFFaEQsSUFBSSxXQUFXLENBQUMsT0FBTyxFQUFFO0VBQ3pCLFFBQVEsS0FBSyxFQUFFO0VBQ2YsUUFBUSxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU87RUFDL0I7O0VBRUEsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO0VBQ25CO0VBQ0EsUUFBUSxNQUFNLFNBQVMsR0FBRyxFQUFFLEVBQUUsV0FBVyxHQUFHLEVBQUUsRUFBRSxTQUFTLEdBQUcsRUFBRTtFQUM5RCxRQUFRLEtBQUssSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRTtFQUN2QyxZQUFZLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7RUFDcEUsWUFBWSxJQUFJLElBQUksSUFBSSxTQUFTLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUN4RCxZQUFZLElBQUksSUFBSSxJQUFJLFNBQVMsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztFQUN2RCxZQUFZLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7RUFDbkMsZ0JBQWdCLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7RUFDNUM7RUFDQTtFQUNBO0VBQ0E7RUFDQSxRQUFRLFNBQVMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO0VBQ3JDLFFBQVEsTUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQzs7RUFFMUQ7RUFDQSxRQUFRLFNBQVMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDO0VBQ3RDLFFBQVEsTUFBTSxhQUFhLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDOztFQUU1RDtFQUNBLFFBQVEsSUFBSSxHQUFHLEVBQUUsSUFBSSxDQUFDO0VBQ3RCLFFBQVEsTUFBTSxNQUFNLEdBQUc7RUFDdkIsWUFBWSxNQUFNLEVBQUUsV0FBVztFQUMvQjs7RUFFQSxRQUFRLElBQUksV0FBVyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7O0VBRXJDO0VBQ0EsWUFBWSxNQUFNLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQztFQUN4QyxZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsWUFBWTtFQUN0QyxZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsYUFBYTtFQUN2QyxZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsYUFBYTs7RUFFdkMsU0FBUyxNQUFNO0VBQ2Y7O0VBRUE7RUFDQSxZQUFZLElBQUksZ0JBQWdCLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSztFQUM3RCxnQkFBZ0IsT0FBTyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDMUQsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQztFQUNsQyxZQUFZLElBQUksZUFBZSxHQUFHLGdCQUFnQixDQUFDLENBQUMsQ0FBQztFQUNyRCxZQUFZLElBQUksZUFBZSxHQUFHLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUMvRCxZQUFZLElBQUksb0JBQW9CLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLGVBQWUsRUFBRSxlQUFlOztFQUVwRjtFQUNBLFlBQVksSUFBSSxlQUFlLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSztFQUM1RCxnQkFBZ0IsT0FBTyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0VBQ3pELGFBQWEsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7RUFDbkMsWUFBWSxJQUFJLGNBQWMsR0FBRyxlQUFlLENBQUMsQ0FBQyxDQUFDO0VBQ25ELFlBQVksSUFBSSxjQUFjLEdBQUcsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUM3RCxZQUFZLElBQUksbUJBQW1CLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLGNBQWMsRUFBRSxjQUFjOztFQUVqRjtFQUNBLFlBQVksSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLFlBQVksRUFBRSxlQUFlLENBQUMsRUFBRTtFQUM1RCxnQkFBZ0IsTUFBTSxDQUFDLEtBQUssR0FBRyxZQUFZO0VBQzNDLGFBQWEsTUFBTTtFQUNuQixnQkFBZ0IsTUFBTSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxLQUFLO0VBQ25FO0VBQ0EsWUFBWSxNQUFNLENBQUMsSUFBSSxHQUFHLENBQUMsb0JBQW9CLElBQUksTUFBTSxDQUFDLEtBQUssR0FBRyxZQUFZOztFQUU5RTtFQUNBLFlBQVksSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLGFBQWEsRUFBRSxjQUFjLENBQUMsRUFBRTtFQUM1RCxnQkFBZ0IsTUFBTSxDQUFDLElBQUksR0FBRyxhQUFhO0VBQzNDLGFBQWEsTUFBTTtFQUNuQixnQkFBZ0IsTUFBTSxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUM7RUFDbkU7RUFDQSxZQUFZLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxtQkFBbUIsSUFBSSxNQUFNLENBQUMsSUFBSSxHQUFHLGFBQWEsQ0FBQztFQUM5RTs7RUFFQTtFQUNBLFFBQVEsR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUM7RUFDL0MsUUFBUSxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQztFQUNsRCxRQUFRLE1BQU0sQ0FBQyxHQUFHLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDOztFQUV2RDtFQUNBLFFBQVEsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFO0VBQ3pDLFlBQVksTUFBTSxDQUFDLElBQUksR0FBRyxTQUFTO0VBQ25DO0VBQ0EsUUFBUSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUU7RUFDekMsWUFBWSxNQUFNLENBQUMsSUFBSSxHQUFHLFNBQVM7RUFDbkM7RUFDQSxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxRQUFRLEVBQUU7RUFDeEMsWUFBWSxNQUFNLENBQUMsSUFBSSxHQUFHLFNBQVM7RUFDbkM7RUFDQSxRQUFRLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxRQUFRLEVBQUU7RUFDekMsWUFBWSxNQUFNLENBQUMsS0FBSyxHQUFHLFNBQVM7RUFDcEM7RUFDQSxRQUFRLE9BQU8sTUFBTTtFQUNyQjtFQUNBOztFQ3pKQSxTQUFTLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFO0VBQzNCLElBQUksSUFBSSxDQUFDLElBQUksU0FBUyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFO0VBQ3hDO0VBQ0EsUUFBUSxPQUFPLENBQUM7RUFDaEI7RUFDQSxTQUFTLElBQUksT0FBTyxDQUFDLElBQUksUUFBUSxFQUFFO0VBQ25DO0VBQ0EsUUFBUSxPQUFPLENBQUMsR0FBRyxNQUFNO0VBQ3pCLEtBQUssTUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7RUFDakQ7RUFDQSxRQUFRLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQztFQUMzQixRQUFRLE9BQU8sQ0FBQyxHQUFHLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQztFQUNuQztFQUNBOzs7RUFHQTtFQUNBO0VBQ0E7O0VBRUEsTUFBTSxXQUFXLFNBQVMsZUFBZSxDQUFDOztFQUUxQyxJQUFJLFdBQVcsQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUU7RUFDOUIsUUFBUSxLQUFLLEVBQUU7RUFDZixRQUFRLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztFQUMzQixRQUFRLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSTtFQUN6QjtFQUNBLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtFQUNuQjtFQUNBLFFBQVEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDNUU7RUFDQSxRQUFRLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQztFQUN6RCxRQUFRLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQztFQUN6RCxRQUFRLE1BQU0sQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQztFQUNyRCxRQUFRLE1BQU0sQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQztFQUN2RCxRQUFRLE1BQU0sQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQztFQUNyRCxRQUFRLE1BQU0sQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQztFQUNyRCxRQUFRLE1BQU0sQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEtBQUs7RUFDcEQsWUFBWSxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNO0VBQ25DLFNBQVMsQ0FBQztFQUNWLFFBQVEsT0FBTyxNQUFNO0VBQ3JCO0VBQ0E7OztFQUdBO0VBQ0E7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTs7O0VBR0EsTUFBTSxTQUFTLFNBQVMsS0FBSyxDQUFDOztFQUU5QixJQUFJLFdBQVcsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLEVBQUU7RUFDekMsUUFBUSxLQUFLLENBQUMsT0FBTyxDQUFDO0VBQ3RCLFFBQVEsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJO0VBQ3pCO0VBQ0EsUUFBUUwsYUFBcUIsQ0FBQyxJQUFJLENBQUM7RUFDbkMsUUFBUSxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQztFQUNuQyxRQUFRLElBQUksQ0FBQyxHQUFHLEdBQUcsS0FBSztFQUN4Qjs7RUFFQSxJQUFJLFNBQVMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFO0VBQzdCLFFBQVEsSUFBSSxRQUFRLElBQUksS0FBSyxFQUFFO0VBQy9CLFlBQVksSUFBSSxFQUFFLEdBQUcsWUFBWSxLQUFLLENBQUMsRUFBRTtFQUN6QyxnQkFBZ0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLG9CQUFvQixFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7RUFDN0Q7RUFDQSxZQUFZLE9BQU8sR0FBRyxDQUFDO0VBQ3ZCO0VBQ0E7O0VBRUEsSUFBSSxVQUFVLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRTtFQUMvQixRQUFRLElBQUksUUFBUSxJQUFJLEtBQUssRUFBRTtFQUMvQixZQUFZLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYztFQUN0QyxZQUFZLElBQUksSUFBSSxDQUFDLEtBQUssSUFBSSxTQUFTLElBQUksSUFBSSxJQUFJLE9BQU8sRUFBRTtFQUM1RCxnQkFBZ0IsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxLQUFLO0VBQ2pFLGFBQWEsTUFBTTtFQUNuQixnQkFBZ0IsSUFBSSxDQUFDLFdBQVcsRUFBRTtFQUNsQztFQUNBLFlBQVksSUFBSSxDQUFDLGdCQUFnQixFQUFFO0VBQ25DLFlBQVksSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztFQUMzQztFQUNBO0VBQ0E7QUFDQUMsZ0JBQXNCLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQzs7RUFFM0M7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7RUFFTyxTQUFTLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFO0VBQ3JDLElBQUksT0FBTyxJQUFJLFNBQVMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDO0VBQ3ZDOzs7Ozs7Ozs7Ozs7In0=
