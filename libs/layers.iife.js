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
      returns endpoints from interval
  */

  function endpoint_from_input(offset) {
      if (typeof offset === 'number') {
          return [offset, 0];
      }
      if (!Array.isArray(offset) || offset.length != 2) {
          throw new Error("Endpoint must be a length-2 array");
      }
      let [value, sign] = offset;
      if (typeof value !== "number") {
          throw new Error("Endpoint value must be number");
      }
      return [value, Math.sign(sign)];
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
      from_interval: endpoints_from_interval,
      from_input: endpoint_from_input
  };
  const interval = {
      covers_endpoint: interval_covers_endpoint,
      covers_point: interval_covers_point, 
      is_singular: interval_is_singular,
      from_endpoints: interval_from_endpoints,
      from_input: interval_from_input
  };

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


  function random_string(length) {
      var text = "";
      var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      for(var i = 0; i < length; i++) {
          text += possible.charAt(Math.floor(Math.random() * possible.length));
      }
      return text;
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
      let index = this[`${PREFIX$1}_handlers`].indexOf(handle);
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

  function implements_callback (obj) {
      const methods = ["add_callback", "remove_callback"];
      for (const prop of methods) {
          if (!(prop in obj)) return false;
          if (typeof obj[prop] != 'function') return false;
      }
      return true;
  }

  function check_item(item) {
      item.itv = interval.from_input(item.itv);
      item.id = item.id || random_string(10);
      return item;
  }


  function is_stateprovider(obj) {
      if (!implements_callback(obj)) return false;
      if (!("get_items" in obj)) return false;
      if (typeof obj.get_items != 'function') return false;
      return true;
  }


  /***************************************************************
      LOCAL STATE PROVIDER
  ***************************************************************/

  /**
   * local state provider
   * collection of items
   * 
   * changes = {
   *   remove=[],
   *   insert=[],
   *   reset=false 
   * }
   * 
  */

  class LocalStateProvider {

      constructor(options={}) {
          addToInstance$1(this);
          this._map = new Map();
          this._initialise(options);
      }

      /**
       * Local stateprovider support initialisation with
       * by giving items or a value. 
       */
      _initialise(options={}) {
          // initialization with items or single value 
          let {insert, value} = options;
          if (value != undefined) {
              // initialize from value
              insert = [{
                  itv: [-Infinity, Infinity, true, true], 
                  type: "static",
                  data: value
              }];
          }
          if (insert != undefined) {
              this._update({insert, reset:true});
          }
      }

      /**
       * Local stateproviders decouple update request from
       * update processing, and returns Promise.
       */
      update (changes) {
          return Promise.resolve()
          .then(() => {
              let diffs;
              if (changes != undefined) {
                  diffs = this._update(changes);
                  this.notify_callbacks(diffs);
              }
              return diffs;
          });
      }

      _update(changes) {
          const diff_map = new Map();
          let {
              insert=[],
              remove=[],
              reset=false
          } = changes;


          if (reset) {
              for (const [id, item] of this._map.entries()) {
                  diff_map.set(id, {id, new:undefined, old:item});
              }
              // clear all items
              this._map = new Map();
          } else {
              // remove items by id
              for (const id of remove) {
                  let item = this._map.get(id);
                  if (item != undefined) {
                      diff_map.set(item.id, {
                          id:item.id, new:undefined, old:item
                      });
                      this._map.delete(id);
                  }
              }
          }
          // insert items
          for (let item of insert) {
              item = check_item(item);
              const diff = diff_map.get(item.id);
              const old = (diff != undefined) ? diff.old : this._map.get(item.id);
              diff_map.set(item.id, {id:item.id, new:item, old});
              this._map.set(item.id, item);
          }
          return [...diff_map.values()];
      }

      get_items() {
          return [...this._map.values()];
      };
  }
  addToPrototype$1(LocalStateProvider.prototype);

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
   * NearbyIndex provides indexing support of effectively
   * looking up regions by offset, 
   * given that
   * (i) each region is associated with an interval and,
   * (ii) regions are non-overlapping.
   * 
   * NEARBY
   * The nearby method returns information about the neighborhood 
   * around endpoint. 
   * 
   * Returns {
   *      center: list of objects covered by region,
   *      itv: region interval - validity of center 
   *      left:
   *          first interval endpoint to the left 
   *          which will produce different {center}
   *          always a high-endpoint or [-Infinity, 0]
   *      right:
   *          first interval endpoint to the right
   *          which will produce different {center}
   *          always a low-endpoint or [Infinity, 0]    
   * 
   * 
   * The nearby state is well-defined for every endpoint
   * on the timeline.
   * 
   * INTERVALS
   * 
   * [low, high, lowInclusive, highInclusive]
   * 
   * This representation ensures that the interval endpoints 
   * are ordered and allows intervals to be exclusive or inclusive, 
   * yet cover the entire real line 
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
   *  
   */


  /**
   * return first high endpoint on the left from nearby,
   * which is not in center
   */
  function left_endpoint (nearby) {
      const low = endpoint.from_interval(nearby.itv)[0];
      return endpoint.flip(low, "high");
  }

  /**
   * return first low endpoint on the right from nearby,
   * which is not in center
   */

  function right_endpoint (nearby) {
      const high = endpoint.from_interval(nearby.itv)[1];
      return endpoint.flip(high, "low");
  }



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


      /**
       * return nearby of first region to the right
       * which is not the center region. If not exists, return
       * undefined. 
       */
      right_region(nearby) {
          const right = right_endpoint(nearby);
          if (right[0] == Infinity) {
              return undefined;
          }
          return this.nearby(right);
      }

      /**
       * return nearby of first region to the left
       * which is not the center region. If not exists, return
       * undefined. 
       */
      left_region(nearby) {
          const left = left_endpoint(nearby);
          if (left[0] == -Infinity) {
              return undefined;
          }
          return this.nearby(left);    
      }

      /**
       * find first region to the "right" or "left"
       * which is not the center region, and which meets
       * a condition on nearby.center.
       * Default condition is center non-empty
       * If not exists, return undefined. 
       */
      
      find_region(nearby, options={}) {
          let {
              direction = 1,
              condition = (center) => center.length > 0
          } = options;
          let next_nearby;
          while(true) {
              if (direction == 1) {
                  next_nearby = this.right_region(nearby);
              } else {
                  next_nearby = this.left_region(nearby);
              }
              if (next_nearby == undefined) {
                  return undefined;
              }
              if (condition(next_nearby.center)) {
                  // found region 
                  return next_nearby;
              }
              // region not found
              // continue searching the right
              nearby = next_nearby;
          }
      }

      regions(options) {
          return new RegionIterator(this, options);
      }

  }


  /*
      Iterate regions of index from left to right

      Iteration limited to interval [start, stop] on the timeline.
      Returns list of item-lists.
      options
      - start
      - stop
      - includeEmpty
  */

  class RegionIterator {

      constructor(index, options={}) {
          let {
              start=-Infinity, 
              stop=Infinity, 
              includeEmpty=true
          } = options;
          if (start > stop) {
              throw new Error ("stop must be larger than start", start, stop)
          }
          this._index = index;
          this._start = [start, 0];
          this._stop = [stop, 0];

          if (includeEmpty) {
              this._condition = () => true;
          } else {
              this._condition = (center) => center.length > 0;
          }
          this._current;
      }

      next() {
          if (this._current == undefined) {
              // initialse
              this._current = this._index.nearby(this._start);
              if (this._condition(this._current.center)) {
                  return {value:this._current, done:false};
              }
          }
          let options = {condition:this._condition, direction:1};
          this._current = this._index.find_region(this._current, options);
          if (this._current == undefined) {
              return {value:undefined, done:true};
          } else {
              return {value:this._current, done:false}
          }
      }

      [Symbol.iterator]() {
          return this;
      }
  }

  /**
   * nearby_from
   * 
   * utility function for creating a nearby object in circumstances
   * where there are overlapping intervals This could be when a 
   * stateprovider for a layer has overlapping items or when 
   * multiple nearby indexes are merged into one.
   * 
   * 
   * @param {*} prev_high : the rightmost high-endpoint left of offset
   * @param {*} center_low_list : low-endpoints of center
   * @param {*} center : center
   * @param {*} center_high_list : high-endpoints of center
   * @param {*} next_low : the leftmost low-endpoint right of offset
   * @returns 
   */

  function cmp_ascending$1(p1, p2) {
      return endpoint.cmp(p1, p2)
  }

  function cmp_descending$1(p1, p2) {
      return endpoint.cmp(p2, p1)
  }

  function nearby_from (
      prev_high, 
      center_low_list, 
      center,
      center_high_list,
      next_low) {

      // nearby
      const result = {center};

      if (center.length == 0) {
          // empty center
          result.right = next_low;
          result.left = prev_high;
      } else {
          // non-empty center
          
          // center high
          center_high_list.sort(cmp_ascending$1);
          let min_center_high = center_high_list[0];
          let max_center_high = center_high_list.slice(-1)[0];
          let multiple_center_high = !endpoint.eq(min_center_high, max_center_high);

          // center low
          center_low_list.sort(cmp_descending$1);
          let max_center_low = center_low_list[0];
          let min_center_low = center_low_list.slice(-1)[0];
          let multiple_center_low = !endpoint.eq(max_center_low, min_center_low);

          // next/right
          if (endpoint.le(next_low, min_center_high)) {
              result.right = next_low;
          } else {
              result.right = endpoint.flip(min_center_high, "low");
          }
          result.next = (multiple_center_high) ? result.right : next_low;

          // prev/left
          if (endpoint.ge(prev_high, max_center_low)) {
              result.left = prev_high;
          } else {
              result.left = endpoint.flip(max_center_low, "high");
          }
          result.prev = (multiple_center_low) ? result.left : prev_high;

      }

      // interval from left/right
      let low = endpoint.flip(result.left, "low");
      let high = endpoint.flip(result.right, "high");
      result.itv = interval.from_endpoints(low, high);

      return result;
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
   * SOURCE PROPERTY (SRCPROP)
   ************************************************/

  /**
   * Functions for extending a class with support for 
   * external source on a named property.
   * 
   * option: mutable:true means that propery may be reset 
   * 
   * source object is assumed to support the callback interface,
   * or be a list of objects all supporting the callback interface
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
              mutable,
              entity: undefined,
              handles: []
          });

          // register getters and setters
          Object.defineProperty(this, propName, {
              get: function () {
                  return map.get(propName).entity;
              },
              set: function (entity) {
                  if (this[`${NAME}_check`]) {
                      entity = this[`${NAME}_check`](propName, entity);
                  }
                  if (entity != map.get(propName).entity) {
                      this[`${PREFIX}_attach`](propName, entity);
                  }
              }
          });
      }

      function attatch(propName, entity) {

          const map = this[`${PREFIX}`];
          const state = map.get(propName);

          if (state.init && !state.mutable) {
              throw new Error(`${propName} can not be reassigned`);
          }

          const entities = (Array.isArray(entity)) ? entity : [entity];

          // unsubscribe from entities
          if (state.handles.length > 0) {
              for (const [idx, e] of Object.entries(entities)) {
                  if (implements_callback(e)) {
                      e.remove_callback(state.handles[idx]);
                  }
              }    
          }
          state.handles = [];

          // attatch new entity
          state.entity = entity;
          state.init = true;

          // subscribe to callback from source
          if (this[`${NAME}_onchange`]) {
              const handler = function (eArg) {
                  this[`${NAME}_onchange`](propName, eArg);
              }.bind(this);
              for (const e of entities) {
                  if (implements_callback(e)) {
                      state.handles.push(e.add_callback(handler));
                  }
              }
              this[`${NAME}_onchange`](propName, "reset"); 
          }
      }

      const api = {};
      api[`${NAME}_register`] = register;
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

      constructor(itv, tuples) {
          super(itv);
          // setup interpolation function
          this._trans = interpolate$1(tuples);
      }

      state(offset) {
          return {value: this._trans(offset), dynamic:true};
      }
  }

  function lt (p1, p2) {
  	return endpoint.lt(endpoint.from_input(p1), endpoint.from_input(p2));
  }
  function eq (p1, p2) {
  	return endpoint.eq(endpoint.from_input(p1), endpoint.from_input(p2));
  }
  function cmp (p1, p2) {
  	return endpoint.cmp(endpoint.from_input(p1), endpoint.from_input(p2));
  }


  /*********************************************************************
  	SORTED ARRAY
  *********************************************************************/

  /*
  	Sorted array of values.
  	- Elements are sorted in ascending order.
  	- No duplicates are allowed.
  	- Binary search used for lookup

  	values can be regular number values (float) or points [float, sign]
  		>a : [a, -1] - largest value smaller than a
  		a  : [a, 0]  - a
  		a< : [a, +1] - smallest value larger than a
  */

  class SortedArray {

  	constructor(){
  		this._array = [];
  	}

  	get size() {return this._array.length;}
  	get array() {return this._array;}
  	/*
  		find index of given value

  		return [found, index]

  		if found is true, then index is the index of the found object
  		if found is false, then index is the index where the object should
  		be inserted

  		- uses binary search		
  		- array does not include any duplicate values
  	*/
  	indexOf(target_value) {
  		let left_idx = 0;
  		let right_idx = this._array.length - 1;
  		while (left_idx <= right_idx) {
  			const mid_idx = Math.floor((left_idx + right_idx) / 2);
  			let mid_value = this._array[mid_idx];
  			if (eq(mid_value, target_value)) {
  				return [true, mid_idx]; // Target already exists in the array
  			} else if (lt(mid_value, target_value)) {
  				  left_idx = mid_idx + 1; // Move search range to the right
  			} else {
  				  right_idx = mid_idx - 1; // Move search range to the left
  			}
  		}
  	  	return [false, left_idx]; // Return the index where target should be inserted
  	}

  	/*
  		find index of smallest value which is greater than or equal to target value
  		returns -1 if no such value exists
  	*/
  	geIndexOf(target_value) {
  		let [found, idx] = this.indexOf(target_value);
  		return (idx < this._array.length) ? idx : -1  
  	}

  	/*
  		find index of largest value which is less than or equal to target value
  		returns -1 if no such value exists
  	*/
  	leIndexOf(target_value) {
  		let [found, idx] = this.indexOf(target_value);
  		idx = (found) ? idx : idx-1;
  		return (idx >= 0) ? idx : -1;
  	}

  	/*
  		find index of smallest value which is greater than target value
  		returns -1 if no such value exists
  	*/
  	gtIndexOf(target_value) {
  		let [found, idx] = this.indexOf(target_value);
  		idx = (found) ? idx + 1 : idx;
  		return (idx < this._array.length) ? idx : -1  
  	}

  	/*
  		find index of largest value which is less than target value
  		returns -1 if no such value exists
  	*/
  	ltIndexOf(target_value) {
  		let [found, idx] = this.indexOf(target_value);
  		idx = idx-1;
  		return (idx >= 0) ? idx : -1;	
  	}

  	/*
  		UPDATE

  		approach - make all neccessary changes and then sort

  		as a rule of thumb - compared to removing and inserting elements
  		one by one, this is more effective for larger batches, say > 100.
  		Even though this might not be the common case, penalties for
  		choosing the wrong approach is higher for larger batches.

  		remove is processed first, so if a value appears in both 
  		remove and insert, it will remain.
  		undefined values can not be inserted 

  	*/

  	update(remove_list=[], insert_list=[]) {

  		/*
  			remove

  			remove by flagging elements as undefined
  			- collect all indexes first
  			- flag as undefined only after all indexes have been found,
  			  as inserting undefined values breakes the assumption that
  			  the array is sorted.
  			- later sort will move them to the end, where they can be
  			  truncated off
  		*/
  		let remove_idx_list = [];
  		for (let value of remove_list) {
  			let [found, idx] = this.indexOf(value);
  			if (found) {
  				remove_idx_list.push(idx);
  			}		
  		}
  		for (let idx of remove_idx_list) {
  			this._array[idx] = undefined;
  		}
  		let any_removes = remove_idx_list.length > 0;

  		/*
  			insert

  			insert might introduce duplications, either because
  			the insert list includes duplicates, or because the
  			insert list duplicates preexisting values.

  			Instead of looking up and checking each insert value,
  			we instead insert everything at the end of the array,
  			and remove duplicates only after we have sorted.
  		*/
  		let any_inserts = insert_list.length > 0;
  		if (any_inserts) {
  			concat_in_place(this._array, insert_list);
  		}

  		/*
  			sort
  			this pushes any undefined values to the end 
  		*/
  		if (any_removes || any_inserts) {
  			this._array.sort(cmp);
  		}

  		/*
  			remove undefined 
  			all undefined values are pushed to the end
  		*/
  		if (any_removes) {
  			this._array.length -= remove_idx_list.length;
  		}

  		/*
  			remove duplicates from sorted array
  			- assuming there are going to be few duplicates,
  			  it is ok to remove them one by one

  		*/
  		if (any_inserts) {
  			remove_duplicates(this._array);
  		}
  	}

  	/*
  		get element by index
  	*/
  	get_by_index(idx) {
  		if (idx > -1 && idx < this._array.length) {
  			return this._array[idx];
  		}
  	}

  	/*
  		lookup values within interval
  	*/
  	lookup(itv) {
  		if (itv == undefined) {
  			itv = [-Infinity, Infinity, true, true];
  		}
  		let [p0, p1] = endpoint.from_interval(itv);
  		let p0_idx = this.geIndexOf(p0);
  		let p1_idx = this.leIndexOf(p1);
  		if (p0_idx == -1 || p1_idx == -1) {
  			return [];
  		} else {
  			return this._array.slice(p0_idx, p1_idx+1);
  		}
  	}

  	lt (offset) {
  		return this.get_by_index(this.ltIndexOf(offset));
  	}
  	le (offset) {
  		return this.get_by_index(this.leIndexOf(offset));
  	}
  	get (offset) {
  		let [found, idx] = this.indexOf(offset);
  		if (found) {
  			return this._array[idx];
  		} 
  	}
  	gt (offset) {
  		return this.get_by_index(this.gtIndexOf(offset));
  	}
  	ge (offset) {
  		return this.get_by_index(this.geIndexOf(offset));
  	}
  }


  /*********************************************************************
  	UTILS
  *********************************************************************/

  /*
  	Concatinate two arrays by appending the second array to the first array. 
  */

  function concat_in_place(first_arr, second_arr) {
  	const first_arr_length = first_arr.length;
  	const second_arr_length = second_arr.length;
    	first_arr.length += second_arr_length;
    	for (let i = 0; i < second_arr_length; i++) {
      	first_arr[first_arr_length + i] = second_arr[i];
    	}
  }

  /*
  	remove duplicates in a sorted array
  */
  function remove_duplicates(sorted_arr) {
  	let i = 0;
  	while (true) {
  		if (i + 1 >= sorted_arr.length) {
  			break;
  		}
  		if (sorted_arr[i] == sorted_arr[i + 1]) {
  			sorted_arr.splice(i + 1, 1);
  		} else {
  			i += 1;
  		}
  	}
  }

  // Set of unique [value, sign] endpoints
  class EndpointSet {
  	constructor() {
  		this._map = new Map([
  			[-1, new Set()], 
  			[0, new Set()], 
  			[1, new Set()]
  		]);
  	}
  	add([value, sign]) {
  		return this._map.get(sign).add(value);
  	}
  	has ([value, sign]) {
  		return this._map.get(sign).has(value);
  	}
  	get([value, sign]) {
  		return this._map.get(sign).get(value);
  	}

  	list() {
  		const lists = [-1, 0, 1].map((sign) => {
  			return [...this._map.get(sign).values()]
  				.map((val) => [val, sign]);
  		});
  		return [].concat(...lists);
  	}
  }

  /**
   * ITEMS MAP
   * 
   * mapping endpoint -> [[item, status],...]
   * status: endpoint is either LOW,HIGH or COVERED for a given item.
   */


  const LOW = "low";
  const ACTIVE = "active";
  const HIGH = "high";

  class ItemsMap {

  	constructor () {
  		// map endpoint -> {low: [items], active: [items], high:[items]}
  		this._map = new Map([
  			[-1, new Map()], 
  			[0, new Map()], 
  			[1, new Map()]
  		]);
  	}

  	get_items_by_role ([value, sign], role) {
  		const entry = this._map.get(sign).get(value);
  		return (entry != undefined) ? entry[role] : [];
  	}

  	/*
  		register item with endpoint (idempotent)
  		return true if this was the first LOW or HIGH 
  	 */
  	register([value, sign], item, role) {
  		const sign_map = this._map.get(sign);
  		if (!sign_map.has(value)) {
  			sign_map.set(value, {low: [], active:[], high:[]});
  		}
  		const entry = sign_map.get(value);
  		const was_empty = entry[LOW].length + entry[HIGH].length == 0;
  		let idx = entry[role].findIndex((_item) => {
  			return _item.id == item.id;
  		});
  		if (idx == -1) {
  			entry[role].push(item);
  		}
  		const is_empty = entry[LOW].length + entry[HIGH].length == 0;
  		return was_empty && !is_empty;
  	}

  	/*
  		unregister item with endpoint (independent of role)
  		return true if this removed last LOW or HIGH
  	 */
  	unregister([value, sign], item) {
  		const sign_map = this._map.get(sign);
  		const entry = sign_map.get(value);
  		if (entry != undefined) {
  			const was_empty = entry[LOW].length + entry[HIGH].length == 0;
  			// remove all mentiones of item
  			for (const role of [LOW, ACTIVE, HIGH]) {
  				let idx = entry[role].findIndex((_item) => {
  					return _item.id == item.id;
  				});
  				if (idx > -1) {
  					entry[role].splice(idx, 1);
  				}	
  			}
  			const is_empty = entry[LOW].length + entry[HIGH].length == 0;
  			if (!was_empty && is_empty) {
  				// clean up entry
  				sign_map.delete(value);
  				return true;
  			}
  		}
  		return false;
  	}
  }


  class NearbyIndex extends NearbyIndexBase {

      constructor(stateProvider) {
          super();

          if (!(is_stateprovider(stateProvider))) {
              throw new Error(`must be stateprovider ${stateProvider}`);
          }
          this._sp = stateProvider;
  		this._initialise();
  		this.refresh();
  	}

      get src () {return this._sp;}


  	_initialise() {
  		// register items with endpoints
  		this._itemsmap = new ItemsMap();
  		// sorted index
  		this._endpoints = new SortedArray();
  		// swipe index
  		this._index = [];
  	}


  	refresh(diffs) {

  		const remove_endpoints = new EndpointSet();
  		const insert_endpoints = new EndpointSet();

  		let insert_items = [];
  		let remove_items = [];

  		if (diffs == undefined) {
  			insert_items = this.src.get_items();
  			// clear all state
  			this._initialise();
  		} else {
  			// collect insert items and remove items
  			for (const diff of diffs) {
  				if (diff.new != undefined) {
  					insert_items.push(diff.new);
  				}
  				if (diff.old != undefined) {
  					remove_items.push(diff.old);
  				}
  			}
  		}

  		/*
  			unregister remove items across all endpoints 
  			where they were registered (LOW, ACTIVE, HIGH) 
  		*/
  		for (const item of remove_items) {			
  			this._endpoints.lookup(item.itv);
  			for (const ep of this._endpoints.lookup(item.itv)) {
  				// TODO: check if this is correct
  				const became_empty = this._itemsmap.unregister(ep, item);
  				if (became_empty) remove_endpoints.add(ep);
  			}	
  		}

  		/*
  			register new items across all endpoints 
  			where they should be registered (LOW, HIGH) 
  		*/
  		let became_nonempty;
  		for (const item of insert_items) {
  			const [low, high] = endpoint.from_interval(item.itv);
  			became_nonempty = this._itemsmap.register(low, item, LOW);
  			if (became_nonempty) insert_endpoints.add(low);
  			became_nonempty = this._itemsmap.register(high, item, HIGH);
  			if (became_nonempty) insert_endpoints.add(high);
  		}

  		/*
  			refresh sorted endpoints
  			possible that an endpoint is present in both lists
  			this is presumably not a problem with SortedArray.
  		*/
  		this._endpoints.update(
  			remove_endpoints.list(), 
  			insert_endpoints.list()
  		);

  		/*
  			swipe over to ensure that all items are activate
  		*/
  		const activeSet = new Set();
  		for (const ep of this._endpoints.array) {	
  			// Add items with ep as low point
  			for (let item of this._itemsmap.get_items_by_role(ep, LOW)) {
  				activeSet.add(item);
  			}			// activate using activeSet
  			for (let item of activeSet) {
  				this._itemsmap.register(ep, item, ACTIVE);
  			}
  			// Remove items with p1 as high point
  			for (let item of this._itemsmap.get_items_by_role(ep, HIGH)) {
  				activeSet.delete(item);
  			}		}
  	}

  	_covers (offset) {
  		const ep1 = this._endpoints.le(offset) || [-Infinity, 0];
  		const ep2 = this._endpoints.ge(offset) || [Infinity, 0];
  		if (endpoint.eq(ep1, ep2)) {
  			return this._itemsmap.get_items_by_role(ep1, ACTIVE);	
  		} else {
  			// get items for both endpoints
  			const items1 = this._itemsmap.get_items_by_role(ep1, ACTIVE);
  			const items2 = this._itemsmap.get_items_by_role(ep2, ACTIVE);
  			// return all items that are active in both endpoints
  			const idSet = new Set(items1.map(item => item.id));
  			return items2.filter(item => idSet.has(item.id));
  		}
  	}

      /*
  		nearby (offset)
      */
  	nearby(offset) { 
  		offset = endpoint.from_input(offset);

  		// center
  		let center = this._covers(offset);
  		const center_high_list = [];
  		const center_low_list = [];
  		for (const item of center) {
  			const [low, high] = endpoint.from_interval(item.itv);
  			center_high_list.push(high);
  			center_low_list.push(low);    
  		}

  		// prev high
  		let prev_high = offset;
  		let items;
  		while (true) {
  			prev_high = this._endpoints.lt(prev_high) || [-Infinity, 0];
  			if (prev_high[0] == -Infinity) {
  				break
  			}
  			items = this._itemsmap.get_items_by_role(prev_high, HIGH);
  			if (items.length > 0) {
  				break
  			}
  		}

  		// next low
  		let next_low = offset;
  		while (true) {
  			next_low = this._endpoints.gt(next_low) || [Infinity, 0];
  			if (next_low[0] == Infinity) {
  				break
  			}
  			items = this._itemsmap.get_items_by_role(next_low, LOW);
  			if (items.length > 0) {
  				break
  			}
  		}

  		return nearby_from(
  			prev_high, 
  			center_low_list, 
  			center,
  			center_high_list,
  			next_low
  		);
  	}
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
          const {CacheClass=LayerCache} = options;
          const {valueFunc, stateFunc} = options;
          // callbacks
          addToInstance$1(this);
          // layer query api
          //layerquery.addToInstance(this, CacheClass, {valueFunc, stateFunc});
          // define change event
          eventifyInstance(this);
          this.eventifyDefine("change", {init:true});

          // index
          this._index;
          // cache
          this._CacheClass = CacheClass;
          this._cache_object;
          this._cache_objects = [];

          // query options
          this._queryOptions = {valueFunc, stateFunc};
      }

      // index
      get index () {return this._index}
      set index (index) {this._index = index;}

      // queryOptions
      get queryOptions () {
          return this._queryOptions;
      }

      // cache
      get cache () {
          if (this._cache_object == undefined) {
              this._cache_object = new this._CacheClass(this);
          }
          return this._cache_object;
      }

      getCache () {
          const cache = new this._CacheClass(this);
          this._cache_objects.push(cache);
          return cache;
      }

      clearCaches() {
          for (const cache of this._cache_objects){
              cache.clear();
          }
      }

      query(offset) {
          return this.cache.query(offset);
      }

      regions (options) {
          return this.index.regions(options);
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
  eventifyPrototype(Layer.prototype);


  /************************************************
   * LAYER CACHE
   ************************************************/

  /**
   * This implements a Cache to be used with Layer objects
   * Query results are obtained from the cache objects in the
   * layer index and cached only if they describe a static value. 
   */

  class LayerCache {

      constructor(layer) {
          this._layer = layer;
          // cached nearby state
          this._nearby;
          // cached result
          this._state;
      }

      get src() {return this._layer};

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
          }
          // perform queries
          const states = this._nearby.center.map((cache) => {
              return cache.query(offset);
          });
          const state = toState(this._nearby.center, states, offset, this._layer.queryOptions);
          // cache state only if not dynamic
          this._state = (state.dynamic) ? undefined : state;
          return state    
      }

      clear() {
          this._nearby = undefined;
          this._state = undefined;
      }
  }



  /*********************************************************************
      INPUT LAYER
  *********************************************************************/

  /**
   * Layer with a StateProvider as src
   */

  class InputLayer extends Layer {

      constructor(options={}) {
          const {src, valueFunc, stateFunc} = options;
          super({CacheClass:InputLayerCache, valueFunc, stateFunc});
          // setup src propterty
          addToInstance(this);
          this.srcprop_register("src");
          // initialize
          this.src = src;
      }

      srcprop_check(propName, src) {
          if (propName == "src") {
              if (!(is_stateprovider(src))) {
                  throw new Error(`"src" must be state provider ${src}`);
              }
              return src;    
          }
      }

      srcprop_onchange(propName, eArg) {
          if (propName == "src") {
              if (this.index == undefined || eArg == "reset") {
                  this.index = new NearbyIndex(this.src);
              } 
              if (eArg != "reset") {
                  this.index.refresh(eArg);
              }
              this.clearCaches();
              this.notify_callbacks();
              this.eventifyTrigger("change");
          }        
      }
  }
  addToPrototype(InputLayer.prototype);



  /*********************************************************************
      INPUT LAYER CACHE
  *********************************************************************/

  /*
      Layer with a StateProvider uses a specific cache implementation.    

      The cache will instantiate segments corresponding to
      items in the index. 
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

      get src() {return this._layer};

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
   * Convenience merge options
   */
  const merge_options = {
      sum: {
          valueFunc: function (info) {
              // returns the sum of values of active layers
              return info.states
                  .map(state => state.value) 
                  .reduce((acc, value) => acc + value, 0);
          }
      },
      stack: {
          stateFunc: function (info) {
              // returns values from first active layer
              return {...info.states[0]}
          }
      },
      array: {
          valueFunc: function (info) {
              // returns an array with values from active layers
              return info.states.map(state => state.value);
          }
      }
  };


  /**
   * 
   * This implements a merge operation for layers.
   * List of sources is immutable.
   * 
   */

  function merge (sources, options={}) {
      const {type=""} = options;

      if (type in merge_options) {
          return new MergeLayer(sources, merge_options[type])
      } else {
          return new MergeLayer(sources, options);
      }
  }


  class MergeLayer extends Layer {

      constructor(sources, options) {
          super(options);

          // setup sources property
          addToInstance(this);
          this.srcprop_register("sources", {mutable:false});
          this.sources = sources;
      }

      srcprop_check(propName, sources) {
          if (propName == "sources") {
              // check that sources is array of layers
              if (!Array.isArray(sources)) {
                  throw new Error(`sources must be array ${sources}`)
              }
              const all_layers = sources.map((e) => e instanceof Layer).every(e => e);
              if (!all_layers) {
                  throw new Error(`sources must all be layers ${sources}`);
              }
          }
          return sources;
      }

      srcprop_onchange(propName, eArg) {
          if (propName == "sources") {
              if (this.index == undefined || eArg == "reset") {
                  this.index = new MergeIndex(this.sources);
              } 
              this.clearCaches();
              this.notify_callbacks();
              this.eventifyTrigger("change");
          }
      }
  }
  addToPrototype(MergeLayer.prototype);



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
          this._caches = new Map(sources.map((src) => {
              return [src, src.getCache()];
          }));
      }

      nearby(offset) {
          offset = endpoint.from_input(offset);
          // accumulate nearby from all sources
          const prev_list = [], next_list = [];
          const center = [];
          const center_high_list = [];
          const center_low_list = [];
          for (let src of this._sources) {
              let nearby = src.index.nearby(offset);
              let prev_region = src.index.find_region(nearby, {direction:-1});
              let next_region = src.index.find_region(nearby, {direction:1});
              if (prev_region != undefined) {
                  prev_list.push(endpoint.from_interval(prev_region.itv)[1]);
              }
              if (next_region != undefined) {
                  next_list.push(endpoint.from_interval(next_region.itv)[0]);
              }
              if (nearby.center.length > 0) {
                  center.push(this._caches.get(src));
                  let [low, high] = endpoint.from_interval(nearby.itv);
                  center_high_list.push(high);
                  center_low_list.push(low);    
              }
          }
          
          // find closest endpoint to the right (not in center)
          next_list.sort(cmp_ascending);
          const next_low = next_list[0] || [Infinity, 0];

          // find closest endpoint to the left (not in center)
          prev_list.sort(cmp_descending);
          const prev_high = prev_list[0] || [-Infinity, 0];

          return nearby_from(
                  prev_high, 
                  center_low_list, 
                  center,
                  center_high_list,
                  next_low
              );
      }
  }

  function shifted(p, offset) {
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
      SHIFT INDEX
  *********************************************************************/

  class ShiftIndex extends NearbyIndexBase {

      constructor (layer, skew) {
          super();
          this._layer = layer;
          this._skew = skew;
          this._cache = layer.getCache();

          // skewing cache object
          this._shifted_cache = {
              query: function (offset) {
                  // skew query (negative) - override result offset
                  return {...this._cache.query(shifted(offset, -this._skew)), offset};
              }.bind(this)
          };
      }

      // skewing index.nearby
      nearby(offset) {
          offset = endpoint.from_input(offset);
          // skew query (negative)
          const nearby = this._layer.index.nearby(shifted(offset, -this._skew));
          // skew result (positive) 
          const itv = nearby.itv.slice();
          itv[0] = shifted(nearby.itv[0], this._skew);
          itv[1] = shifted(nearby.itv[1], this._skew);
          return {
              itv,
              left: shifted(nearby.left, this._skew),
              right: shifted(nearby.right, this._skew),
              center: nearby.center.map(() => this._shifted_cache)
          }
      }
  }


  /*********************************************************************
      SHIFT LAYER
  *********************************************************************/


  class ShiftLayer extends Layer {

      constructor(layer, skew, options={}) {
          super(options);
          this._skew = skew;
          // setup src propterty
          addToInstance(this);
          this.srcprop_register("src");
          this.src = layer;
      }

      srcprop_check(propName, src) {
          if (propName == "src") {
              if (!(src instanceof Layer)) {
                  throw new Error(`"src" must be Layer ${src}`);
              }
              return src;    
          }
      }

      srcprop_onchange(propName, eArg) {
          if (propName == "src") {
              if (this.index == undefined || eArg == "reset") {
                  this.index = new ShiftIndex(this.src, this._skew);
              } 
              this.clearCaches();
              this.notify_callbacks();
              this.eventifyTrigger("change");    
          }
      }
  }
  addToPrototype(ShiftLayer.prototype);

  /**
   * Skewing a Layer by an offset
   * 
   * a positive value for offset means that
   * the layer is shifted to the right on the timeline
   * 
   * 
   */

  function shift (layer, offset) {
      return new ShiftLayer(layer, offset);
  }

  // webpage clock - performance now - seconds
  const local = {
      now: function() {
          return performance.now()/1000.0;
      }
  };
  // system clock - epoch - seconds
  const epoch = {
      now: function() {
          return new Date()/1000.0;
      }
  };

  /**
   * CLOCK gives epoch values, but is implemented
   * using performance now for better
   * time resolution and protection against system 
   * time adjustments.
   */

  const LOCAL_CLOCK_PROVIDER = function () {
      const t0_local = local.now();
      const t0_epoch = epoch.now();
      return {
          now: function () {
              const t1_local = local.now();
              return t0_epoch + (t1_local - t0_local);
          }
      };
  }();

  function is_clockprovider(obj) {
      return (
          ("now" in obj) && typeof (obj.now == "function")
      )
  }

  const METHODS = {assign, move, transition, interpolate};


  function cmd (target) {
      if (!(is_stateprovider(target))) {
          throw new Error(`target.src must be stateprovider ${target}`);
      }
      let entries = Object.entries(METHODS)
          .map(([name, method]) => {
              return [
                  name,
                  function(...args) { 
                      let items = method.call(this, ...args);
                      return target.update({insert:items, reset:true});  
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

  function interpolate(tuples) {
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

  /**
   * Cursor emulates Layer interface.
   * Part of this is to prove an index for the timeline. 
   * However, when considered as a layer, the cursor value is 
   * independent of timeline offset, which is to say that
   * it has the same value for all timeline offsets.
   * 
   * Unlike other Layers, the Cursor do not actually
   * use this index to resolve queries. It is only needed
   * for some generic Layer functionnality, like sampling,
   * which uses index.first() and index.last().
   */

  class CursorIndex extends NearbyIndexBase {

      constructor(cursor) {
          super();
          this._cache = cursor.getCache();
      }

      nearby(offset) {
          // cursor index is defined for entire timeline
          return {
              itv: [-Infinity, Infinity, true, true],
              center: [this._cache],
              left: [-Infinity, 0],
              prev: [-Infinity, 0],
              right: [Infinity, 0],
              next: [Infinity, 0],
          }
      }
  }

  /**
   * 
   * Cursor cache implements the query operation for 
   * the Cursor, ignoring the given offset, replacing it 
   * with an offset from the ctrl instead. 
   * The layer cache is used to resolve the query 
   */

  class CursorCache {
      constructor(cursor) {
          this._cursor = cursor;
          this._cache = this._cursor.src.getCache();
      }

      query() {
          const offset = this._cursor._get_ctrl_state().value; 
          return this._cache.query(offset);
      }

      clear() {
          this._cache.clear();
      }
  }


  /************************************************
   * CURSOR
   ************************************************/

  /**
   * 
   * Cursor glides along a layer and exposes the current layer
   * value at any time
   * - has mutable ctrl (localClockProvider or Cursor)
   * - has mutable src (layer)
   * - methods for assign, move, transition, interpolation
   */

  class Cursor extends Layer {

      constructor (options={}) {
          super({CacheClass:CursorCache});

          // setup src properties
          addToInstance(this);
          this.srcprop_register("src");
          this.srcprop_register("ctrl");

          // timeout
          this._tid;
          // polling
          this._pid;

          // initialise ctrl, src
          let {src, ctrl} = options;
          this.ctrl = ctrl || LOCAL_CLOCK_PROVIDER;
          this.src = src;
      }

      /**********************************************************
       * SRCPROP: CTRL and SRC
       **********************************************************/

      srcprop_check(propName, obj) {
          if (propName == "ctrl") {
              if (!(is_clockprovider(obj) || obj instanceof Cursor)) {
                  throw new Error(`"ctrl" must be clockProvider or Cursor ${obj}`)
              }
          } else if (propName == "src") {
              if (!(obj instanceof Layer)) {
                  throw new Error(`"src" must be Layer ${obj}`);
              }
          }
          return obj;
      }

      srcprop_onchange(propName, eArg) {
          this.__handle_change(propName, eArg);
      }

      /**********************************************************
       * CALLBACK
       **********************************************************/

      __handle_change(origin, eArg) {
          clearTimeout(this._tid);
          clearInterval(this._pid);
          if (this.src && this.ctrl) {
              if (this.index == undefined || eArg == "reset") {
                  // NOT used for cursor query 
                  this.index = new CursorIndex(this);
              }
              this.clearCaches();
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
       * can be calculated. This is trivial if ctrl is a ClockProvider, and
       * it is fairly easy if the ctrl is Cursor representing motion
       * or linear transition. However, calculations can become more
       * complex if motion supports acceleration, or if transitions
       * are set up with non-linear easing.
       *   
       * Note, however, that these calculations assume that the cursor.ctrl is 
       * a ClockProvider, or that cursor.ctrl.ctrl is a ClockProider. 
       * In principle, though, there could be a recursive chain of cursors,
       * (cursor.ctrl.ctrl....ctrl) of some length, where only the last is a 
       * ClockProvider. In order to do deterministic calculations in the general
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
       * is predicated on cursor.ctrl being a ClockProvider. Also, there 
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
       * (i) if ctrl is a ClockProvider && nearby.itv.high < Infinity
       * or
       * (ii) ctrl.ctrl is a ClockProvider
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
          if (is_clockprovider(this.ctrl)) {
              if (isFinite(high)) {
                  this.__set_timeout(high, current_pos, 1.0, current_ts);
                  return;
              }
              // no future event to detect
              return;
          } 
          if (is_clockprovider(this.ctrl.ctrl)) {
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
          if (is_clockprovider(this.ctrl)) {
              let ts = this.ctrl.now();
              return {value:ts, dynamic:true, offset:ts};
          } else {
              let state = this.ctrl.query();
              // protect against non-float values
              if (typeof state.value !== 'number') {
                  throw new Error(`warning: ctrl state must be number ${state.value}`);
              }
              return state;
          }
      }

      get value () {return this.query().value};
      
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
  addToPrototype(Cursor.prototype);
  addToPrototype(Cursor.prototype);

  class BooleanLayer extends Layer {

      constructor(layer) {
          super();
          this.index = new BooleanIndex(layer.index);
      
          // subscribe
          const handler = this._onchange.bind(this);
          layer.add_callback(handler);
      }

      _onchange(eArg) {
          this.clearCaches();
          this.notify_callbacks();
          this.eventifyTrigger("change");
      }
  }

  function boolean(layer) {
      return new BooleanLayer(layer);
  } 


  /*********************************************************************
      BOOLEAN NEARBY INDEX
  *********************************************************************/

  /**
   * Wrapper Index where regions are true/false, based on 
   * condition on nearby.center.
   * Back-to-back regions which are true are collapsed 
   * into one region
   * 
   */

  function queryObject (value) {
      return {
          query: function (offset) {
              return {value, dynamic:false, offset};
          }
      }
  }

  class BooleanIndex extends NearbyIndexBase {

      constructor(index, options={}) {
          super();
          this._index = index;
          let {condition = (center) => center.length > 0} = options;
          this._condition = condition;
      }

      nearby(offset) {
          offset = endpoint.from_input(offset);
          const nearby = this._index.nearby(offset);
          
          let evaluation = this._condition(nearby.center); 
          /* 
              seek left and right for first region
              which does not have the same evaluation 
          */
          const condition = (center) => {
              return this._condition(center) != evaluation;
          };

          // expand right
          let right;
          let right_nearby = this._index.find_region(nearby, {
              direction:1, condition
          });        
          if (right_nearby != undefined) {
              right = endpoint.from_interval(right_nearby.itv)[0];
          }

          // expand left
          let left;
          let left_nearby = this._index.find_region(nearby, {
              direction:-1, condition
          });
          if (left_nearby != undefined) {
              left = endpoint.from_interval(left_nearby.itv)[1];
          }

          // expand to infinity
          left = left || [-Infinity, 0];
          right = right || [Infinity, 0];
          const low = endpoint.flip(left, "low");
          const high = endpoint.flip(right, "high");
          return {
              itv: interval.from_endpoints(low, high),
              center : [queryObject(evaluation)],
              left,
              right,
          }
      }
  }

  class LogicalMergeLayer extends Layer {

      constructor(sources, options={}) {
          super();

          const {expr} = options;

          let condition;
          if (expr) {
              condition = (center) => {
                  return expr.eval(center);
              };    
          }
                      
          // subscribe to callbacks from sources
          const handler = this._onchange.bind(this);
          for (let src of sources) {
              src.add_callback(handler);
          }

          // index
          let index = new MergeIndex(sources);
          this._index = new BooleanIndex(index, {condition});
      }

      get index () {return this._index};

      _onchange(eArg) {
          this.clearCaches();
          this.notify_callbacks();
          this.eventifyTrigger("change");
      }
  }


  function logical_merge(sources, options) {
      return new LogicalMergeLayer(sources, options);
  }


  function logical_expr (src) {
      if (!(src instanceof Layer)) {
          throw new Error(`must be layer ${src}`)
      }
      return {
          eval: function (center) {
              for (let cache of center) {
                  if (cache.src == src) {
                      return true;
                  }
              }
              return false;
          }
      }
  }

  logical_expr.and = function and(...exprs) {
      return {
          eval: function (center) {
              return exprs.every((expr) => expr.eval(center));
          }    
      }
  };

  logical_expr.or = function or(...exprs) {
      return {
          eval: function (center) {
              return exprs.some((expr) => expr.eval(center));
          }    
      }
  };

  logical_expr.xor = function xor(expr1, expr2) {
      return {
          eval: function (center) {
              return expr1.eval(center) != expr2.eval(center);
          }    
      }
  };

  logical_expr.not = function not(expr) {
      return {
          eval: function (center) {
              return !expr.eval(center);
          }    
      }
  };

  /*********************************************************************
      LAYER FACTORY
  *********************************************************************/

  function layer(options={}) {
      let {src, ...opts} = options;
      if (src instanceof Layer) {
          return src;
      } 
      if (src == undefined) {
          src = new LocalStateProvider(opts);
      }
      return new InputLayer({src, ...opts}); 
  }

  /*********************************************************************
      CURSOR FACTORIES
  *********************************************************************/

  function cursor(options={}) {
      const {ctrl, ...opts} = options;
      const src = layer(opts);    
      return new Cursor({ctrl, src});
  }

  exports.boolean = boolean;
  exports.cmd = cmd;
  exports.cursor = cursor;
  exports.layer = layer;
  exports.logical_expr = logical_expr;
  exports.logical_merge = logical_merge;
  exports.merge = merge;
  exports.playback = cursor;
  exports.shift = shift;
  exports.variable = cursor;

  return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXJzLmlpZmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9pbnRlcnZhbHMuanMiLCIuLi8uLi9zcmMvdXRpbC5qcyIsIi4uLy4uL3NyYy9hcGlfY2FsbGJhY2suanMiLCIuLi8uLi9zcmMvc3RhdGVwcm92aWRlci5qcyIsIi4uLy4uL3NyYy9uZWFyYnlpbmRleF9iYXNlLmpzIiwiLi4vLi4vc3JjL2FwaV9ldmVudGlmeS5qcyIsIi4uLy4uL3NyYy9hcGlfc3JjcHJvcC5qcyIsIi4uLy4uL3NyYy9zZWdtZW50cy5qcyIsIi4uLy4uL3NyYy9zb3J0ZWRhcnJheS5qcyIsIi4uLy4uL3NyYy9uZWFyYnlpbmRleC5qcyIsIi4uLy4uL3NyYy9sYXllcnMuanMiLCIuLi8uLi9zcmMvb3BzL21lcmdlLmpzIiwiLi4vLi4vc3JjL29wcy9zaGlmdC5qcyIsIi4uLy4uL3NyYy9jbG9ja3Byb3ZpZGVyLmpzIiwiLi4vLi4vc3JjL2NtZC5qcyIsIi4uLy4uL3NyYy9tb25pdG9yLmpzIiwiLi4vLi4vc3JjL2N1cnNvcnMuanMiLCIuLi8uLi9zcmMvb3BzL2Jvb2xlYW4uanMiLCIuLi8uLi9zcmMvb3BzL2xvZ2ljYWxfbWVyZ2UuanMiLCIuLi8uLi9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAgICBcbiAgICBJTlRFUlZBTCBFTkRQT0lOVFNcblxuICAgICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gICAgKiBcbiAgICAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAgICAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICAgICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gICAgKiBcbiAgICAqIFRoaXMgcmVwcmVzZW50YXRpb24gZW5zdXJlcyB0aGF0IHRoZSBpbnRlcnZhbCBlbmRwb2ludHMgYXJlIG9yZGVyZWQgYW5kIGFsbG93c1xuICAgICogaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIHlldCBjb3ZlciB0aGUgZW50aXJlIHJlYWwgbGluZSBcbiAgICAqIFxuICAgICogW2EsYl0sIChhLGIpLCBbYSxiKSwgW2EsIGIpIGFyZSBhbGwgdmFsaWQgaW50ZXJ2YWxzXG5cbiovXG5cbi8qXG4gICAgRW5kcG9pbnQgY29tcGFyaXNvblxuICAgIHJldHVybnMgXG4gICAgICAgIC0gbmVnYXRpdmUgOiBjb3JyZWN0IG9yZGVyXG4gICAgICAgIC0gMCA6IGVxdWFsXG4gICAgICAgIC0gcG9zaXRpdmUgOiB3cm9uZyBvcmRlclxuXG5cbiAgICBOT1RFIFxuICAgIC0gY21wKDRdLFs0ICkgPT0gMCAtIHNpbmNlIHRoZXNlIGFyZSB0aGUgc2FtZSB3aXRoIHJlc3BlY3QgdG8gc29ydGluZ1xuICAgIC0gYnV0IGlmIHlvdSB3YW50IHRvIHNlZSBpZiB0d28gaW50ZXJ2YWxzIGFyZSBvdmVybGFwcGluZyBpbiB0aGUgZW5kcG9pbnRzXG4gICAgY21wKGhpZ2hfYSwgbG93X2IpID4gMCB0aGlzIHdpbGwgbm90IGJlIGdvb2RcbiAgICBcbiovIFxuXG5cbmZ1bmN0aW9uIGNtcE51bWJlcnMoYSwgYikge1xuICAgIGlmIChhID09PSBiKSByZXR1cm4gMDtcbiAgICBpZiAoYSA9PT0gSW5maW5pdHkpIHJldHVybiAxO1xuICAgIGlmIChiID09PSBJbmZpbml0eSkgcmV0dXJuIC0xO1xuICAgIGlmIChhID09PSAtSW5maW5pdHkpIHJldHVybiAtMTtcbiAgICBpZiAoYiA9PT0gLUluZmluaXR5KSByZXR1cm4gMTtcbiAgICByZXR1cm4gYSAtIGI7XG4gIH1cblxuZnVuY3Rpb24gZW5kcG9pbnRfY21wIChwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICBsZXQgZGlmZiA9IGNtcE51bWJlcnModjEsIHYyKTtcbiAgICByZXR1cm4gKGRpZmYgIT0gMCkgPyBkaWZmIDogczEgLSBzMjtcbn1cblxuZnVuY3Rpb24gZW5kcG9pbnRfbHQgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA8IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2xlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPD0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZ3QgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA+IDBcbn1cbmZ1bmN0aW9uIGVuZHBvaW50X2dlIChwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnRfY21wKHAxLCBwMikgPj0gMFxufVxuZnVuY3Rpb24gZW5kcG9pbnRfZXEgKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludF9jbXAocDEsIHAyKSA9PSAwXG59XG5mdW5jdGlvbiBlbmRwb2ludF9taW4ocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9sZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5mdW5jdGlvbiBlbmRwb2ludF9tYXgocDEsIHAyKSB7XG4gICAgcmV0dXJuIChlbmRwb2ludF9nZShwMSwgcDIpKSA/IHAxIDogcDI7XG59XG5cbi8qKlxuICogZmxpcCBlbmRwb2ludCB0byB0aGUgb3RoZXIgc2lkZVxuICogXG4gKiB1c2VmdWwgZm9yIG1ha2luZyBiYWNrLXRvLWJhY2sgaW50ZXJ2YWxzIFxuICogXG4gKiBoaWdoKSA8LT4gW2xvd1xuICogaGlnaF0gPC0+IChsb3dcbiAqL1xuXG5mdW5jdGlvbiBlbmRwb2ludF9mbGlwKHAsIHRhcmdldCkge1xuICAgIGxldCBbdixzXSA9IHA7XG4gICAgaWYgKCFpc0Zpbml0ZSh2KSkge1xuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgaWYgKHRhcmdldCA9PSBcImxvd1wiKSB7XG4gICAgXHQvLyBhc3N1bWUgcG9pbnQgaXMgaGlnaDogc2lnbiBtdXN0IGJlIC0xIG9yIDBcbiAgICBcdGlmIChzID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBsb3dcIik7ICAgIFx0XHRcbiAgICBcdH1cbiAgICAgICAgcCA9IFt2LCBzKzFdO1xuICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09IFwiaGlnaFwiKSB7XG5cdFx0Ly8gYXNzdW1lIHBvaW50IGlzIGxvdzogc2lnbiBpcyAwIG9yIDFcbiAgICBcdGlmIChzIDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5kcG9pbnQgaXMgYWxyZWFkeSBoaWdoXCIpOyAgICBcdFx0XG4gICAgXHR9XG4gICAgICAgIHAgPSBbdiwgcy0xXTtcbiAgICB9IGVsc2Uge1xuICAgIFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0eXBlXCIsIHRhcmdldCk7XG4gICAgfVxuICAgIHJldHVybiBwO1xufVxuXG5cbi8qXG4gICAgcmV0dXJucyBsb3cgYW5kIGhpZ2ggZW5kcG9pbnRzIGZyb20gaW50ZXJ2YWxcbiovXG5mdW5jdGlvbiBlbmRwb2ludHNfZnJvbV9pbnRlcnZhbChpdHYpIHtcbiAgICBsZXQgW2xvdywgaGlnaCwgbG93Q2xvc2VkLCBoaWdoQ2xvc2VkXSA9IGl0djtcbiAgICBsZXQgbG93X3AgPSAobG93Q2xvc2VkKSA/IFtsb3csIDBdIDogW2xvdywgMV07IFxuICAgIGxldCBoaWdoX3AgPSAoaGlnaENsb3NlZCkgPyBbaGlnaCwgMF0gOiBbaGlnaCwgLTFdO1xuICAgIHJldHVybiBbbG93X3AsIGhpZ2hfcF07XG59XG5cbi8qXG4gICAgcmV0dXJucyBlbmRwb2ludHMgZnJvbSBpbnRlcnZhbFxuKi9cblxuZnVuY3Rpb24gZW5kcG9pbnRfZnJvbV9pbnB1dChvZmZzZXQpIHtcbiAgICBpZiAodHlwZW9mIG9mZnNldCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgcmV0dXJuIFtvZmZzZXQsIDBdO1xuICAgIH1cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkob2Zmc2V0KSB8fCBvZmZzZXQubGVuZ3RoICE9IDIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW5kcG9pbnQgbXVzdCBiZSBhIGxlbmd0aC0yIGFycmF5XCIpO1xuICAgIH1cbiAgICBsZXQgW3ZhbHVlLCBzaWduXSA9IG9mZnNldDtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkVuZHBvaW50IHZhbHVlIG11c3QgYmUgbnVtYmVyXCIpO1xuICAgIH1cbiAgICByZXR1cm4gW3ZhbHVlLCBNYXRoLnNpZ24oc2lnbildO1xufVxuXG5cbi8qXG4gICAgSU5URVJWQUxTXG5cbiAgICBJbnRlcnZhbHMgYXJlIFtsb3csIGhpZ2gsIGxvd0Nsb3NlZCwgaGlnaENsb3NlZF1cblxuKi8gXG5cbi8qXG4gICAgcmV0dXJuIHRydWUgaWYgcG9pbnQgcCBpcyBjb3ZlcmVkIGJ5IGludGVydmFsIGl0dlxuICAgIHBvaW50IHAgY2FuIGJlIG51bWJlciBwIG9yIGEgcG9pbnQgW3Asc11cblxuICAgIGltcGxlbWVudGVkIGJ5IGNvbXBhcmluZyBwb2ludHNcbiAgICBleGNlcHRpb24gaWYgaW50ZXJ2YWwgaXMgbm90IGRlZmluZWRcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9jb3ZlcnNfZW5kcG9pbnQoaXR2LCBwKSB7XG4gICAgbGV0IFtsb3dfcCwgaGlnaF9wXSA9IGVuZHBvaW50c19mcm9tX2ludGVydmFsKGl0dik7XG4gICAgLy8gY292ZXJzOiBsb3cgPD0gcCA8PSBoaWdoXG4gICAgcmV0dXJuIGVuZHBvaW50X2xlKGxvd19wLCBwKSAmJiBlbmRwb2ludF9sZShwLCBoaWdoX3ApO1xufVxuLy8gY29udmVuaWVuY2VcbmZ1bmN0aW9uIGludGVydmFsX2NvdmVyc19wb2ludChpdHYsIHApIHtcbiAgICByZXR1cm4gaW50ZXJ2YWxfY292ZXJzX2VuZHBvaW50KGl0diwgW3AsIDBdKTtcbn1cblxuXG5cbi8qXG4gICAgUmV0dXJuIHRydWUgaWYgaW50ZXJ2YWwgaGFzIGxlbmd0aCAwXG4qL1xuZnVuY3Rpb24gaW50ZXJ2YWxfaXNfc2luZ3VsYXIoaW50ZXJ2YWwpIHtcbiAgICByZXR1cm4gaW50ZXJ2YWxbMF0gPT0gaW50ZXJ2YWxbMV1cbn1cblxuLypcbiAgICBDcmVhdGUgaW50ZXJ2YWwgZnJvbSBlbmRwb2ludHNcbiovXG5mdW5jdGlvbiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyhwMSwgcDIpIHtcbiAgICBsZXQgW3YxLCBzMV0gPSBwMTtcbiAgICBsZXQgW3YyLCBzMl0gPSBwMjtcbiAgICAvLyBwMSBtdXN0IGJlIGEgbG93IHBvaW50XG4gICAgaWYgKHMxID09IC0xKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgbG93IHBvaW50XCIsIHAxKTtcbiAgICB9XG4gICAgaWYgKHMyID09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaWxsZWdlYWwgaGlnaCBwb2ludFwiLCBwMik7ICAgXG4gICAgfVxuICAgIHJldHVybiBbdjEsIHYyLCAoczE9PTApLCAoczI9PTApXVxufVxuXG5mdW5jdGlvbiBpc051bWJlcihuKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBuID09IFwibnVtYmVyXCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbnRlcnZhbF9mcm9tX2lucHV0KGlucHV0KXtcbiAgICBsZXQgaXR2ID0gaW5wdXQ7XG4gICAgaWYgKGl0diA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaW5wdXQgaXMgdW5kZWZpbmVkXCIpO1xuICAgIH1cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoaXR2KSkge1xuICAgICAgICBpZiAoaXNOdW1iZXIoaXR2KSkge1xuICAgICAgICAgICAgLy8gaW5wdXQgaXMgc2luZ3VsYXIgbnVtYmVyXG4gICAgICAgICAgICBpdHYgPSBbaXR2LCBpdHYsIHRydWUsIHRydWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbnB1dDogJHtpbnB1dH06IG11c3QgYmUgQXJyYXkgb3IgTnVtYmVyYClcbiAgICAgICAgfVxuICAgIH07XG4gICAgLy8gbWFrZSBzdXJlIGludGVydmFsIGlzIGxlbmd0aCA0XG4gICAgaWYgKGl0di5sZW5ndGggPT0gMSkge1xuICAgICAgICBpdHYgPSBbaXR2WzBdLCBpdHZbMF0sIHRydWUsIHRydWVdXG4gICAgfSBlbHNlIGlmIChpdHYubGVuZ3RoID09IDIpIHtcbiAgICAgICAgaXR2ID0gaXR2LmNvbmNhdChbdHJ1ZSwgZmFsc2VdKTtcbiAgICB9IGVsc2UgaWYgKGl0di5sZW5ndGggPT0gMykge1xuICAgICAgICBpdHYgPSBpdHYucHVzaChmYWxzZSk7XG4gICAgfSBlbHNlIGlmIChpdHYubGVuZ3RoID4gNCkge1xuICAgICAgICBpdHYgPSBpdHYuc2xpY2UoMCw0KTtcbiAgICB9XG4gICAgbGV0IFtsb3csIGhpZ2gsIGxvd0luY2x1ZGUsIGhpZ2hJbmNsdWRlXSA9IGl0djtcbiAgICAvLyB1bmRlZmluZWRcbiAgICBpZiAobG93ID09IHVuZGVmaW5lZCB8fCBsb3cgPT0gbnVsbCkge1xuICAgICAgICBsb3cgPSAtSW5maW5pdHk7XG4gICAgfVxuICAgIGlmIChoaWdoID09IHVuZGVmaW5lZCB8fCBoaWdoID09IG51bGwpIHtcbiAgICAgICAgaGlnaCA9IEluZmluaXR5O1xuICAgIH1cbiAgICAvLyBjaGVjayB0aGF0IGxvdyBhbmQgaGlnaCBhcmUgbnVtYmVyc1xuICAgIGlmICghaXNOdW1iZXIobG93KSkgdGhyb3cgbmV3IEVycm9yKFwibG93IG5vdCBhIG51bWJlclwiLCBsb3cpO1xuICAgIGlmICghaXNOdW1iZXIoaGlnaCkpIHRocm93IG5ldyBFcnJvcihcImhpZ2ggbm90IGEgbnVtYmVyXCIsIGhpZ2gpO1xuICAgIC8vIGNoZWNrIHRoYXQgbG93IDw9IGhpZ2hcbiAgICBpZiAobG93ID4gaGlnaCkgdGhyb3cgbmV3IEVycm9yKFwibG93ID4gaGlnaFwiLCBsb3csIGhpZ2gpO1xuICAgIC8vIHNpbmdsZXRvblxuICAgIGlmIChsb3cgPT0gaGlnaCkge1xuICAgICAgICBsb3dJbmNsdWRlID0gdHJ1ZTtcbiAgICAgICAgaGlnaEluY2x1ZGUgPSB0cnVlO1xuICAgIH1cbiAgICAvLyBjaGVjayBpbmZpbml0eSB2YWx1ZXNcbiAgICBpZiAobG93ID09IC1JbmZpbml0eSkge1xuICAgICAgICBsb3dJbmNsdWRlID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGhpZ2ggPT0gSW5maW5pdHkpIHtcbiAgICAgICAgaGlnaEluY2x1ZGUgPSB0cnVlO1xuICAgIH1cbiAgICAvLyBjaGVjayB0aGF0IGxvd0luY2x1ZGUsIGhpZ2hJbmNsdWRlIGFyZSBib29sZWFuc1xuICAgIGlmICh0eXBlb2YgbG93SW5jbHVkZSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibG93SW5jbHVkZSBub3QgYm9vbGVhblwiKTtcbiAgICB9IFxuICAgIGlmICh0eXBlb2YgaGlnaEluY2x1ZGUgIT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImhpZ2hJbmNsdWRlIG5vdCBib29sZWFuXCIpO1xuICAgIH1cbiAgICByZXR1cm4gW2xvdywgaGlnaCwgbG93SW5jbHVkZSwgaGlnaEluY2x1ZGVdO1xufVxuXG5cblxuXG5leHBvcnQgY29uc3QgZW5kcG9pbnQgPSB7XG4gICAgbGU6IGVuZHBvaW50X2xlLFxuICAgIGx0OiBlbmRwb2ludF9sdCxcbiAgICBnZTogZW5kcG9pbnRfZ2UsXG4gICAgZ3Q6IGVuZHBvaW50X2d0LFxuICAgIGNtcDogZW5kcG9pbnRfY21wLFxuICAgIGVxOiBlbmRwb2ludF9lcSxcbiAgICBtaW46IGVuZHBvaW50X21pbixcbiAgICBtYXg6IGVuZHBvaW50X21heCxcbiAgICBmbGlwOiBlbmRwb2ludF9mbGlwLFxuICAgIGZyb21faW50ZXJ2YWw6IGVuZHBvaW50c19mcm9tX2ludGVydmFsLFxuICAgIGZyb21faW5wdXQ6IGVuZHBvaW50X2Zyb21faW5wdXRcbn1cbmV4cG9ydCBjb25zdCBpbnRlcnZhbCA9IHtcbiAgICBjb3ZlcnNfZW5kcG9pbnQ6IGludGVydmFsX2NvdmVyc19lbmRwb2ludCxcbiAgICBjb3ZlcnNfcG9pbnQ6IGludGVydmFsX2NvdmVyc19wb2ludCwgXG4gICAgaXNfc2luZ3VsYXI6IGludGVydmFsX2lzX3Npbmd1bGFyLFxuICAgIGZyb21fZW5kcG9pbnRzOiBpbnRlcnZhbF9mcm9tX2VuZHBvaW50cyxcbiAgICBmcm9tX2lucHV0OiBpbnRlcnZhbF9mcm9tX2lucHV0XG59XG4iLCJpbXBvcnQgeyBlbmRwb2ludCwgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHNcIjtcblxuXG4vLyBvdnZlcnJpZGUgbW9kdWxvIHRvIGJlaGF2ZSBiZXR0ZXIgZm9yIG5lZ2F0aXZlIG51bWJlcnNcbmV4cG9ydCBmdW5jdGlvbiBtb2QobiwgbSkge1xuICAgIHJldHVybiAoKG4gJSBtKSArIG0pICUgbTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBkaXZtb2QoeCwgYmFzZSkge1xuICAgIGxldCBuID0gTWF0aC5mbG9vcih4IC8gYmFzZSlcbiAgICBsZXQgciA9IG1vZCh4LCBiYXNlKTtcbiAgICByZXR1cm4gW24sIHJdO1xufVxuXG5cbi8qXG4gICAgc2ltaWxhciB0byByYW5nZSBmdW5jdGlvbiBpbiBweXRob25cbiovXG5cbmV4cG9ydCBmdW5jdGlvbiByYW5nZSAoc3RhcnQsIGVuZCwgc3RlcCA9IDEsIG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICBjb25zdCB7aW5jbHVkZV9lbmQ9ZmFsc2V9ID0gb3B0aW9ucztcbiAgICBpZiAoc3RlcCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0ZXAgY2Fubm90IGJlIHplcm8uJyk7XG4gICAgfVxuICAgIGlmIChzdGFydCA8IGVuZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gc3RlcCkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChzdGFydCA+IGVuZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnQ7IGkgPiBlbmQ7IGkgLT0gc3RlcCkge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGkpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChpbmNsdWRlX2VuZCkge1xuICAgICAgICByZXN1bHQucHVzaChlbmQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5cbi8qKlxuICogQ3JlYXRlIGEgc2luZ2xlIHN0YXRlIGZyb20gYSBsaXN0IG9mIHN0YXRlcywgdXNpbmcgYSB2YWx1ZUZ1bmNcbiAqIHN0YXRlOnt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0fVxuICogXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIHRvU3RhdGUoc291cmNlcywgc3RhdGVzLCBvZmZzZXQsIG9wdGlvbnM9e30pIHtcbiAgICBsZXQge3ZhbHVlRnVuYywgc3RhdGVGdW5jfSA9IG9wdGlvbnM7IFxuICAgIGlmICh2YWx1ZUZ1bmMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGxldCB2YWx1ZSA9IHZhbHVlRnVuYyh7c291cmNlcywgc3RhdGVzLCBvZmZzZXR9KTtcbiAgICAgICAgbGV0IGR5bmFtaWMgPSBzdGF0ZXMubWFwKCh2KSA9PiB2LmR5bWFtaWMpLnNvbWUoZT0+ZSk7XG4gICAgICAgIHJldHVybiB7dmFsdWUsIGR5bmFtaWMsIG9mZnNldH07XG4gICAgfSBlbHNlIGlmIChzdGF0ZUZ1bmMgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiB7Li4uc3RhdGVGdW5jKHtzb3VyY2VzLCBzdGF0ZXMsIG9mZnNldH0pLCBvZmZzZXR9O1xuICAgIH1cbiAgICAvLyBubyB2YWx1ZUZ1bmMgb3Igc3RhdGVGdW5jXG4gICAgaWYgKHN0YXRlcy5sZW5ndGggPT0gMCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOnVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fVxuICAgIH1cbiAgICAvLyBmYWxsYmFjayAtIGp1c3QgdXNlIGZpcnN0IHN0YXRlXG4gICAgbGV0IHN0YXRlID0gc3RhdGVzWzBdO1xuICAgIHJldHVybiB7Li4uc3RhdGUsIG9mZnNldH07IFxufVxuXG5cbi8qKlxuICogY2hlY2sgaW5wdXQgaXRlbXMgdG8gbG9jYWwgc3RhdGUgcHJvdmlkZXJzXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrX2lucHV0KGl0ZW1zKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnB1dCBtdXN0IGJlIGFuIGFycmF5XCIpO1xuICAgIH1cbiAgICAvLyBtYWtlIHN1cmUgdGhhdCBpbnRlcnZhbHMgYXJlIHdlbGwgZm9ybWVkXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICAgIGl0ZW0uaXR2ID0gaW50ZXJ2YWwuZnJvbV9pbnB1dChpdGVtLml0dik7XG4gICAgfVxuICAgIC8vIHNvcnQgaXRlbXMgYmFzZWQgb24gaW50ZXJ2YWwgbG93IGVuZHBvaW50XG4gICAgaXRlbXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBsZXQgYV9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGEuaXR2KVswXTtcbiAgICAgICAgbGV0IGJfbG93ID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChiLml0dilbMF07XG4gICAgICAgIHJldHVybiBlbmRwb2ludC5jbXAoYV9sb3csIGJfbG93KTtcbiAgICB9KTtcbiAgICAvLyBjaGVjayB0aGF0IGl0ZW0gaW50ZXJ2YWxzIGFyZSBub24tb3ZlcmxhcHBpbmdcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8IGl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGxldCBwcmV2X2hpZ2ggPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2kgLSAxXS5pdHYpWzFdO1xuICAgICAgICBsZXQgY3Vycl9sb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKGl0ZW1zW2ldLml0dilbMF07XG4gICAgICAgIC8vIHZlcmlmeSB0aGF0IHByZXYgaGlnaCBpcyBsZXNzIHRoYXQgY3VyciBsb3dcbiAgICAgICAgaWYgKCFlbmRwb2ludC5sdChwcmV2X2hpZ2gsIGN1cnJfbG93KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT3ZlcmxhcHBpbmcgaW50ZXJ2YWxzIGZvdW5kXCIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpdGVtcztcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gcmFuZG9tX3N0cmluZyhsZW5ndGgpIHtcbiAgICB2YXIgdGV4dCA9IFwiXCI7XG4gICAgdmFyIHBvc3NpYmxlID0gXCJBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6XCI7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRleHQgKz0gcG9zc2libGUuY2hhckF0KE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHBvc3NpYmxlLmxlbmd0aCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGV4dDtcbn0iLCIvKlxuICAgIFRoaXMgZGVjb3JhdGVzIGFuIG9iamVjdC9wcm90b3R5cGUgd2l0aCBiYXNpYyAoc3luY2hyb25vdXMpIGNhbGxiYWNrIHN1cHBvcnQuXG4qL1xuXG5jb25zdCBQUkVGSVggPSBcIl9fY2FsbGJhY2tcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvSW5zdGFuY2Uob2JqZWN0KSB7XG4gICAgb2JqZWN0W2Ake1BSRUZJWH1faGFuZGxlcnNgXSA9IFtdO1xufVxuXG5mdW5jdGlvbiBhZGRfY2FsbGJhY2sgKGhhbmRsZXIpIHtcbiAgICBsZXQgaGFuZGxlID0ge1xuICAgICAgICBoYW5kbGVyOiBoYW5kbGVyXG4gICAgfVxuICAgIHRoaXNbYCR7UFJFRklYfV9oYW5kbGVyc2BdLnB1c2goaGFuZGxlKTtcbiAgICByZXR1cm4gaGFuZGxlO1xufTtcblxuZnVuY3Rpb24gcmVtb3ZlX2NhbGxiYWNrIChoYW5kbGUpIHtcbiAgICBsZXQgaW5kZXggPSB0aGlzW2Ake1BSRUZJWH1faGFuZGxlcnNgXS5pbmRleE9mKGhhbmRsZSk7XG4gICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBub3RpZnlfY2FsbGJhY2tzIChlQXJnKSB7XG4gICAgdGhpc1tgJHtQUkVGSVh9X2hhbmRsZXJzYF0uZm9yRWFjaChmdW5jdGlvbihoYW5kbGUpIHtcbiAgICAgICAgaGFuZGxlLmhhbmRsZXIoZUFyZyk7XG4gICAgfSk7XG59O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUb1Byb3RvdHlwZSAoX3Byb3RvdHlwZSkge1xuICAgIGNvbnN0IGFwaSA9IHtcbiAgICAgICAgYWRkX2NhbGxiYWNrLCByZW1vdmVfY2FsbGJhY2ssIG5vdGlmeV9jYWxsYmFja3NcbiAgICB9XG4gICAgT2JqZWN0LmFzc2lnbihfcHJvdG90eXBlLCBhcGkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW1wbGVtZW50c19jYWxsYmFjayAob2JqKSB7XG4gICAgY29uc3QgbWV0aG9kcyA9IFtcImFkZF9jYWxsYmFja1wiLCBcInJlbW92ZV9jYWxsYmFja1wiXTtcbiAgICBmb3IgKGNvbnN0IHByb3Agb2YgbWV0aG9kcykge1xuICAgICAgICBpZiAoIShwcm9wIGluIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKHR5cGVvZiBvYmpbcHJvcF0gIT0gJ2Z1bmN0aW9uJykgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn0iLCJpbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgcmFuZG9tX3N0cmluZyB9IGZyb20gXCIuL3V0aWwuanNcIjtcbmltcG9ydCAqIGFzIGNhbGxiYWNrIGZyb20gXCIuL2FwaV9jYWxsYmFjay5qc1wiO1xuXG5cbmZ1bmN0aW9uIGNoZWNrX2l0ZW0oaXRlbSkge1xuICAgIGl0ZW0uaXR2ID0gaW50ZXJ2YWwuZnJvbV9pbnB1dChpdGVtLml0dik7XG4gICAgaXRlbS5pZCA9IGl0ZW0uaWQgfHwgcmFuZG9tX3N0cmluZygxMCk7XG4gICAgcmV0dXJuIGl0ZW07XG59XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGlzX3N0YXRlcHJvdmlkZXIob2JqKSB7XG4gICAgaWYgKCFjYWxsYmFjay5pbXBsZW1lbnRzX2NhbGxiYWNrKG9iaikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIShcImdldF9pdGVtc1wiIGluIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHlwZW9mIG9iai5nZXRfaXRlbXMgIT0gJ2Z1bmN0aW9uJykgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMT0NBTCBTVEFURSBQUk9WSURFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIGxvY2FsIHN0YXRlIHByb3ZpZGVyXG4gKiBjb2xsZWN0aW9uIG9mIGl0ZW1zXG4gKiBcbiAqIGNoYW5nZXMgPSB7XG4gKiAgIHJlbW92ZT1bXSxcbiAqICAgaW5zZXJ0PVtdLFxuICogICByZXNldD1mYWxzZSBcbiAqIH1cbiAqIFxuKi9cblxuZXhwb3J0IGNsYXNzIExvY2FsU3RhdGVQcm92aWRlciB7XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zPXt9KSB7XG4gICAgICAgIGNhbGxiYWNrLmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuX21hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgdGhpcy5faW5pdGlhbGlzZShvcHRpb25zKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2NhbCBzdGF0ZXByb3ZpZGVyIHN1cHBvcnQgaW5pdGlhbGlzYXRpb24gd2l0aFxuICAgICAqIGJ5IGdpdmluZyBpdGVtcyBvciBhIHZhbHVlLiBcbiAgICAgKi9cbiAgICBfaW5pdGlhbGlzZShvcHRpb25zPXt9KSB7XG4gICAgICAgIC8vIGluaXRpYWxpemF0aW9uIHdpdGggaXRlbXMgb3Igc2luZ2xlIHZhbHVlIFxuICAgICAgICBsZXQge2luc2VydCwgdmFsdWV9ID0gb3B0aW9ucztcbiAgICAgICAgaWYgKHZhbHVlICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gaW5pdGlhbGl6ZSBmcm9tIHZhbHVlXG4gICAgICAgICAgICBpbnNlcnQgPSBbe1xuICAgICAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLCBcbiAgICAgICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgICAgIGRhdGE6IHZhbHVlXG4gICAgICAgICAgICB9XTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5zZXJ0ICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlKHtpbnNlcnQsIHJlc2V0OnRydWV9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvY2FsIHN0YXRlcHJvdmlkZXJzIGRlY291cGxlIHVwZGF0ZSByZXF1ZXN0IGZyb21cbiAgICAgKiB1cGRhdGUgcHJvY2Vzc2luZywgYW5kIHJldHVybnMgUHJvbWlzZS5cbiAgICAgKi9cbiAgICB1cGRhdGUgKGNoYW5nZXMpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIGxldCBkaWZmcztcbiAgICAgICAgICAgIGlmIChjaGFuZ2VzICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGRpZmZzID0gdGhpcy5fdXBkYXRlKGNoYW5nZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcyhkaWZmcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZGlmZnM7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIF91cGRhdGUoY2hhbmdlcykge1xuICAgICAgICBjb25zdCBkaWZmX21hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgbGV0IHtcbiAgICAgICAgICAgIGluc2VydD1bXSxcbiAgICAgICAgICAgIHJlbW92ZT1bXSxcbiAgICAgICAgICAgIHJlc2V0PWZhbHNlXG4gICAgICAgIH0gPSBjaGFuZ2VzO1xuXG5cbiAgICAgICAgaWYgKHJlc2V0KSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtpZCwgaXRlbV0gb2YgdGhpcy5fbWFwLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgICAgIGRpZmZfbWFwLnNldChpZCwge2lkLCBuZXc6dW5kZWZpbmVkLCBvbGQ6aXRlbX0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gY2xlYXIgYWxsIGl0ZW1zXG4gICAgICAgICAgICB0aGlzLl9tYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyByZW1vdmUgaXRlbXMgYnkgaWRcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWQgb2YgcmVtb3ZlKSB7XG4gICAgICAgICAgICAgICAgbGV0IGl0ZW0gPSB0aGlzLl9tYXAuZ2V0KGlkKTtcbiAgICAgICAgICAgICAgICBpZiAoaXRlbSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgZGlmZl9tYXAuc2V0KGl0ZW0uaWQsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOml0ZW0uaWQsIG5ldzp1bmRlZmluZWQsIG9sZDppdGVtXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXAuZGVsZXRlKGlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gaW5zZXJ0IGl0ZW1zXG4gICAgICAgIGZvciAobGV0IGl0ZW0gb2YgaW5zZXJ0KSB7XG4gICAgICAgICAgICBpdGVtID0gY2hlY2tfaXRlbShpdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IGRpZmYgPSBkaWZmX21hcC5nZXQoaXRlbS5pZClcbiAgICAgICAgICAgIGNvbnN0IG9sZCA9IChkaWZmICE9IHVuZGVmaW5lZCkgPyBkaWZmLm9sZCA6IHRoaXMuX21hcC5nZXQoaXRlbS5pZCk7XG4gICAgICAgICAgICBkaWZmX21hcC5zZXQoaXRlbS5pZCwge2lkOml0ZW0uaWQsIG5ldzppdGVtLCBvbGR9KTtcbiAgICAgICAgICAgIHRoaXMuX21hcC5zZXQoaXRlbS5pZCwgaXRlbSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFsuLi5kaWZmX21hcC52YWx1ZXMoKV07XG4gICAgfVxuXG4gICAgZ2V0X2l0ZW1zKCkge1xuICAgICAgICByZXR1cm4gWy4uLnRoaXMuX21hcC52YWx1ZXMoKV07XG4gICAgfTtcbn1cbmNhbGxiYWNrLmFkZFRvUHJvdG90eXBlKExvY2FsU3RhdGVQcm92aWRlci5wcm90b3R5cGUpO1xuIiwiaW1wb3J0IHsgZW5kcG9pbnQsIGludGVydmFsIH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBORUFSQlkgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBBYnN0cmFjdCBzdXBlcmNsYXNzIGZvciBOZWFyYnlJbmRleGUuXG4gKiBcbiAqIFN1cGVyY2xhc3MgdXNlZCB0byBjaGVjayB0aGF0IGEgY2xhc3MgaW1wbGVtZW50cyB0aGUgbmVhcmJ5KCkgbWV0aG9kLCBcbiAqIGFuZCBwcm92aWRlIHNvbWUgY29udmVuaWVuY2UgbWV0aG9kcy5cbiAqIFxuICogTkVBUkJZIElOREVYXG4gKiBcbiAqIE5lYXJieUluZGV4IHByb3ZpZGVzIGluZGV4aW5nIHN1cHBvcnQgb2YgZWZmZWN0aXZlbHlcbiAqIGxvb2tpbmcgdXAgcmVnaW9ucyBieSBvZmZzZXQsIFxuICogZ2l2ZW4gdGhhdFxuICogKGkpIGVhY2ggcmVnaW9uIGlzIGFzc29jaWF0ZWQgd2l0aCBhbiBpbnRlcnZhbCBhbmQsXG4gKiAoaWkpIHJlZ2lvbnMgYXJlIG5vbi1vdmVybGFwcGluZy5cbiAqIFxuICogTkVBUkJZXG4gKiBUaGUgbmVhcmJ5IG1ldGhvZCByZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZWlnaGJvcmhvb2QgXG4gKiBhcm91bmQgZW5kcG9pbnQuIFxuICogXG4gKiBSZXR1cm5zIHtcbiAqICAgICAgY2VudGVyOiBsaXN0IG9mIG9iamVjdHMgY292ZXJlZCBieSByZWdpb24sXG4gKiAgICAgIGl0djogcmVnaW9uIGludGVydmFsIC0gdmFsaWRpdHkgb2YgY2VudGVyIFxuICogICAgICBsZWZ0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIGxlZnQgXG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBoaWdoLWVuZHBvaW50IG9yIFstSW5maW5pdHksIDBdXG4gKiAgICAgIHJpZ2h0OlxuICogICAgICAgICAgZmlyc3QgaW50ZXJ2YWwgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0XG4gKiAgICAgICAgICB3aGljaCB3aWxsIHByb2R1Y2UgZGlmZmVyZW50IHtjZW50ZXJ9XG4gKiAgICAgICAgICBhbHdheXMgYSBsb3ctZW5kcG9pbnQgb3IgW0luZmluaXR5LCAwXSAgICBcbiAqIFxuICogXG4gKiBUaGUgbmVhcmJ5IHN0YXRlIGlzIHdlbGwtZGVmaW5lZCBmb3IgZXZlcnkgZW5kcG9pbnRcbiAqIG9uIHRoZSB0aW1lbGluZS5cbiAqIFxuICogSU5URVJWQUxTXG4gKiBcbiAqIFtsb3csIGhpZ2gsIGxvd0luY2x1c2l2ZSwgaGlnaEluY2x1c2l2ZV1cbiAqIFxuICogVGhpcyByZXByZXNlbnRhdGlvbiBlbnN1cmVzIHRoYXQgdGhlIGludGVydmFsIGVuZHBvaW50cyBcbiAqIGFyZSBvcmRlcmVkIGFuZCBhbGxvd3MgaW50ZXJ2YWxzIHRvIGJlIGV4Y2x1c2l2ZSBvciBpbmNsdXNpdmUsIFxuICogeWV0IGNvdmVyIHRoZSBlbnRpcmUgcmVhbCBsaW5lIFxuICogXG4gKiBbYSxiXSwgKGEsYiksIFthLGIpLCBbYSwgYikgYXJlIGFsbCB2YWxpZCBpbnRlcnZhbHNcbiAqIFxuICogXG4gKiBJTlRFUlZBTCBFTkRQT0lOVFNcbiAqIFxuICogaW50ZXJ2YWwgZW5kcG9pbnRzIGFyZSBkZWZpbmVkIGJ5IFt2YWx1ZSwgc2lnbl0sIGZvciBleGFtcGxlXG4gKiBcbiAqIDQpIC0+IFs0LC0xXSAtIGVuZHBvaW50IGlzIG9uIHRoZSBsZWZ0IG9mIDRcbiAqIFs0LCA0LCA0XSAtPiBbNCwgMF0gLSBlbmRwb2ludCBpcyBhdCA0IFxuICogKDQgLT4gWzQsIDFdIC0gZW5kcG9pbnQgaXMgb24gdGhlIHJpZ2h0IG9mIDQpXG4gKiBcbiAqICBcbiAqL1xuXG5cbi8qKlxuICogcmV0dXJuIGZpcnN0IGhpZ2ggZW5kcG9pbnQgb24gdGhlIGxlZnQgZnJvbSBuZWFyYnksXG4gKiB3aGljaCBpcyBub3QgaW4gY2VudGVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsZWZ0X2VuZHBvaW50IChuZWFyYnkpIHtcbiAgICBjb25zdCBsb3cgPSBlbmRwb2ludC5mcm9tX2ludGVydmFsKG5lYXJieS5pdHYpWzBdO1xuICAgIHJldHVybiBlbmRwb2ludC5mbGlwKGxvdywgXCJoaWdoXCIpO1xufVxuXG4vKipcbiAqIHJldHVybiBmaXJzdCBsb3cgZW5kcG9pbnQgb24gdGhlIHJpZ2h0IGZyb20gbmVhcmJ5LFxuICogd2hpY2ggaXMgbm90IGluIGNlbnRlclxuICovXG5cbmV4cG9ydCBmdW5jdGlvbiByaWdodF9lbmRwb2ludCAobmVhcmJ5KSB7XG4gICAgY29uc3QgaGlnaCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmVhcmJ5Lml0dilbMV07XG4gICAgcmV0dXJuIGVuZHBvaW50LmZsaXAoaGlnaCwgXCJsb3dcIik7XG59XG5cblxuXG5leHBvcnQgY2xhc3MgTmVhcmJ5SW5kZXhCYXNlIHtcblxuXG4gICAgLyogXG4gICAgICAgIE5lYXJieSBtZXRob2RcbiAgICAqL1xuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm90IGltcGxlbWVudGVkXCIpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHJldHVybiBsb3cgcG9pbnQgb2YgbGVmdG1vc3QgZW50cnlcbiAgICAqL1xuICAgIGZpcnN0KCkge1xuICAgICAgICBsZXQge2NlbnRlciwgcmlnaHR9ID0gdGhpcy5uZWFyYnkoWy1JbmZpbml0eSwgMF0pO1xuICAgICAgICByZXR1cm4gKGNlbnRlci5sZW5ndGggPiAwKSA/IFstSW5maW5pdHksIDBdIDogcmlnaHQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgcmV0dXJuIGhpZ2ggcG9pbnQgb2YgcmlnaHRtb3N0IGVudHJ5XG4gICAgKi9cbiAgICBsYXN0KCkge1xuICAgICAgICBsZXQge2xlZnQsIGNlbnRlcn0gPSB0aGlzLm5lYXJieShbSW5maW5pdHksIDBdKTtcbiAgICAgICAgcmV0dXJuIChjZW50ZXIubGVuZ3RoID4gMCkgPyBbSW5maW5pdHksIDBdIDogbGVmdFxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogcmV0dXJuIG5lYXJieSBvZiBmaXJzdCByZWdpb24gdG8gdGhlIHJpZ2h0XG4gICAgICogd2hpY2ggaXMgbm90IHRoZSBjZW50ZXIgcmVnaW9uLiBJZiBub3QgZXhpc3RzLCByZXR1cm5cbiAgICAgKiB1bmRlZmluZWQuIFxuICAgICAqL1xuICAgIHJpZ2h0X3JlZ2lvbihuZWFyYnkpIHtcbiAgICAgICAgY29uc3QgcmlnaHQgPSByaWdodF9lbmRwb2ludChuZWFyYnkpO1xuICAgICAgICBpZiAocmlnaHRbMF0gPT0gSW5maW5pdHkpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubmVhcmJ5KHJpZ2h0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZXR1cm4gbmVhcmJ5IG9mIGZpcnN0IHJlZ2lvbiB0byB0aGUgbGVmdFxuICAgICAqIHdoaWNoIGlzIG5vdCB0aGUgY2VudGVyIHJlZ2lvbi4gSWYgbm90IGV4aXN0cywgcmV0dXJuXG4gICAgICogdW5kZWZpbmVkLiBcbiAgICAgKi9cbiAgICBsZWZ0X3JlZ2lvbihuZWFyYnkpIHtcbiAgICAgICAgY29uc3QgbGVmdCA9IGxlZnRfZW5kcG9pbnQobmVhcmJ5KTtcbiAgICAgICAgaWYgKGxlZnRbMF0gPT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm5lYXJieShsZWZ0KTsgICAgXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogZmluZCBmaXJzdCByZWdpb24gdG8gdGhlIFwicmlnaHRcIiBvciBcImxlZnRcIlxuICAgICAqIHdoaWNoIGlzIG5vdCB0aGUgY2VudGVyIHJlZ2lvbiwgYW5kIHdoaWNoIG1lZXRzXG4gICAgICogYSBjb25kaXRpb24gb24gbmVhcmJ5LmNlbnRlci5cbiAgICAgKiBEZWZhdWx0IGNvbmRpdGlvbiBpcyBjZW50ZXIgbm9uLWVtcHR5XG4gICAgICogSWYgbm90IGV4aXN0cywgcmV0dXJuIHVuZGVmaW5lZC4gXG4gICAgICovXG4gICAgXG4gICAgZmluZF9yZWdpb24obmVhcmJ5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIGxldCB7XG4gICAgICAgICAgICBkaXJlY3Rpb24gPSAxLFxuICAgICAgICAgICAgY29uZGl0aW9uID0gKGNlbnRlcikgPT4gY2VudGVyLmxlbmd0aCA+IDBcbiAgICAgICAgfSA9IG9wdGlvbnM7XG4gICAgICAgIGxldCBuZXh0X25lYXJieTtcbiAgICAgICAgd2hpbGUodHJ1ZSkge1xuICAgICAgICAgICAgaWYgKGRpcmVjdGlvbiA9PSAxKSB7XG4gICAgICAgICAgICAgICAgbmV4dF9uZWFyYnkgPSB0aGlzLnJpZ2h0X3JlZ2lvbihuZWFyYnkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXh0X25lYXJieSA9IHRoaXMubGVmdF9yZWdpb24obmVhcmJ5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChuZXh0X25lYXJieSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGNvbmRpdGlvbihuZXh0X25lYXJieS5jZW50ZXIpKSB7XG4gICAgICAgICAgICAgICAgLy8gZm91bmQgcmVnaW9uIFxuICAgICAgICAgICAgICAgIHJldHVybiBuZXh0X25lYXJieTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHJlZ2lvbiBub3QgZm91bmRcbiAgICAgICAgICAgIC8vIGNvbnRpbnVlIHNlYXJjaGluZyB0aGUgcmlnaHRcbiAgICAgICAgICAgIG5lYXJieSA9IG5leHRfbmVhcmJ5O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVnaW9ucyhvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVnaW9uSXRlcmF0b3IodGhpcywgb3B0aW9ucyk7XG4gICAgfVxuXG59XG5cblxuLypcbiAgICBJdGVyYXRlIHJlZ2lvbnMgb2YgaW5kZXggZnJvbSBsZWZ0IHRvIHJpZ2h0XG5cbiAgICBJdGVyYXRpb24gbGltaXRlZCB0byBpbnRlcnZhbCBbc3RhcnQsIHN0b3BdIG9uIHRoZSB0aW1lbGluZS5cbiAgICBSZXR1cm5zIGxpc3Qgb2YgaXRlbS1saXN0cy5cbiAgICBvcHRpb25zXG4gICAgLSBzdGFydFxuICAgIC0gc3RvcFxuICAgIC0gaW5jbHVkZUVtcHR5XG4qL1xuXG5jbGFzcyBSZWdpb25JdGVyYXRvciB7XG5cbiAgICBjb25zdHJ1Y3RvcihpbmRleCwgb3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge1xuICAgICAgICAgICAgc3RhcnQ9LUluZmluaXR5LCBcbiAgICAgICAgICAgIHN0b3A9SW5maW5pdHksIFxuICAgICAgICAgICAgaW5jbHVkZUVtcHR5PXRydWVcbiAgICAgICAgfSA9IG9wdGlvbnM7XG4gICAgICAgIGlmIChzdGFydCA+IHN0b3ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciAoXCJzdG9wIG11c3QgYmUgbGFyZ2VyIHRoYW4gc3RhcnRcIiwgc3RhcnQsIHN0b3ApXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faW5kZXggPSBpbmRleDtcbiAgICAgICAgdGhpcy5fc3RhcnQgPSBbc3RhcnQsIDBdO1xuICAgICAgICB0aGlzLl9zdG9wID0gW3N0b3AsIDBdO1xuXG4gICAgICAgIGlmIChpbmNsdWRlRW1wdHkpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbmRpdGlvbiA9ICgpID0+IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jb25kaXRpb24gPSAoY2VudGVyKSA9PiBjZW50ZXIubGVuZ3RoID4gMDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jdXJyZW50O1xuICAgIH1cblxuICAgIG5leHQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50ID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gaW5pdGlhbHNlXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50ID0gdGhpcy5faW5kZXgubmVhcmJ5KHRoaXMuX3N0YXJ0KTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jb25kaXRpb24odGhpcy5fY3VycmVudC5jZW50ZXIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZTp0aGlzLl9jdXJyZW50LCBkb25lOmZhbHNlfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBsZXQgb3B0aW9ucyA9IHtjb25kaXRpb246dGhpcy5fY29uZGl0aW9uLCBkaXJlY3Rpb246MX1cbiAgICAgICAgdGhpcy5fY3VycmVudCA9IHRoaXMuX2luZGV4LmZpbmRfcmVnaW9uKHRoaXMuX2N1cnJlbnQsIG9wdGlvbnMpO1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudCA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiB7dmFsdWU6dW5kZWZpbmVkLCBkb25lOnRydWV9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHt2YWx1ZTp0aGlzLl9jdXJyZW50LCBkb25lOmZhbHNlfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn1cblxuLyoqXG4gKiBuZWFyYnlfZnJvbVxuICogXG4gKiB1dGlsaXR5IGZ1bmN0aW9uIGZvciBjcmVhdGluZyBhIG5lYXJieSBvYmplY3QgaW4gY2lyY3Vtc3RhbmNlc1xuICogd2hlcmUgdGhlcmUgYXJlIG92ZXJsYXBwaW5nIGludGVydmFscyBUaGlzIGNvdWxkIGJlIHdoZW4gYSBcbiAqIHN0YXRlcHJvdmlkZXIgZm9yIGEgbGF5ZXIgaGFzIG92ZXJsYXBwaW5nIGl0ZW1zIG9yIHdoZW4gXG4gKiBtdWx0aXBsZSBuZWFyYnkgaW5kZXhlcyBhcmUgbWVyZ2VkIGludG8gb25lLlxuICogXG4gKiBcbiAqIEBwYXJhbSB7Kn0gcHJldl9oaWdoIDogdGhlIHJpZ2h0bW9zdCBoaWdoLWVuZHBvaW50IGxlZnQgb2Ygb2Zmc2V0XG4gKiBAcGFyYW0geyp9IGNlbnRlcl9sb3dfbGlzdCA6IGxvdy1lbmRwb2ludHMgb2YgY2VudGVyXG4gKiBAcGFyYW0geyp9IGNlbnRlciA6IGNlbnRlclxuICogQHBhcmFtIHsqfSBjZW50ZXJfaGlnaF9saXN0IDogaGlnaC1lbmRwb2ludHMgb2YgY2VudGVyXG4gKiBAcGFyYW0geyp9IG5leHRfbG93IDogdGhlIGxlZnRtb3N0IGxvdy1lbmRwb2ludCByaWdodCBvZiBvZmZzZXRcbiAqIEByZXR1cm5zIFxuICovXG5cbmZ1bmN0aW9uIGNtcF9hc2NlbmRpbmcocDEsIHAyKSB7XG4gICAgcmV0dXJuIGVuZHBvaW50LmNtcChwMSwgcDIpXG59XG5cbmZ1bmN0aW9uIGNtcF9kZXNjZW5kaW5nKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludC5jbXAocDIsIHAxKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbmVhcmJ5X2Zyb20gKFxuICAgIHByZXZfaGlnaCwgXG4gICAgY2VudGVyX2xvd19saXN0LCBcbiAgICBjZW50ZXIsXG4gICAgY2VudGVyX2hpZ2hfbGlzdCxcbiAgICBuZXh0X2xvdykge1xuXG4gICAgLy8gbmVhcmJ5XG4gICAgY29uc3QgcmVzdWx0ID0ge2NlbnRlcn07XG5cbiAgICBpZiAoY2VudGVyLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgIC8vIGVtcHR5IGNlbnRlclxuICAgICAgICByZXN1bHQucmlnaHQgPSBuZXh0X2xvdztcbiAgICAgICAgcmVzdWx0LmxlZnQgPSBwcmV2X2hpZ2g7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gbm9uLWVtcHR5IGNlbnRlclxuICAgICAgICBcbiAgICAgICAgLy8gY2VudGVyIGhpZ2hcbiAgICAgICAgY2VudGVyX2hpZ2hfbGlzdC5zb3J0KGNtcF9hc2NlbmRpbmcpO1xuICAgICAgICBsZXQgbWluX2NlbnRlcl9oaWdoID0gY2VudGVyX2hpZ2hfbGlzdFswXTtcbiAgICAgICAgbGV0IG1heF9jZW50ZXJfaGlnaCA9IGNlbnRlcl9oaWdoX2xpc3Quc2xpY2UoLTEpWzBdO1xuICAgICAgICBsZXQgbXVsdGlwbGVfY2VudGVyX2hpZ2ggPSAhZW5kcG9pbnQuZXEobWluX2NlbnRlcl9oaWdoLCBtYXhfY2VudGVyX2hpZ2gpXG5cbiAgICAgICAgLy8gY2VudGVyIGxvd1xuICAgICAgICBjZW50ZXJfbG93X2xpc3Quc29ydChjbXBfZGVzY2VuZGluZyk7XG4gICAgICAgIGxldCBtYXhfY2VudGVyX2xvdyA9IGNlbnRlcl9sb3dfbGlzdFswXTtcbiAgICAgICAgbGV0IG1pbl9jZW50ZXJfbG93ID0gY2VudGVyX2xvd19saXN0LnNsaWNlKC0xKVswXTtcbiAgICAgICAgbGV0IG11bHRpcGxlX2NlbnRlcl9sb3cgPSAhZW5kcG9pbnQuZXEobWF4X2NlbnRlcl9sb3csIG1pbl9jZW50ZXJfbG93KVxuXG4gICAgICAgIC8vIG5leHQvcmlnaHRcbiAgICAgICAgaWYgKGVuZHBvaW50LmxlKG5leHRfbG93LCBtaW5fY2VudGVyX2hpZ2gpKSB7XG4gICAgICAgICAgICByZXN1bHQucmlnaHQgPSBuZXh0X2xvdztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5yaWdodCA9IGVuZHBvaW50LmZsaXAobWluX2NlbnRlcl9oaWdoLCBcImxvd1wiKVxuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5uZXh0ID0gKG11bHRpcGxlX2NlbnRlcl9oaWdoKSA/IHJlc3VsdC5yaWdodCA6IG5leHRfbG93O1xuXG4gICAgICAgIC8vIHByZXYvbGVmdFxuICAgICAgICBpZiAoZW5kcG9pbnQuZ2UocHJldl9oaWdoLCBtYXhfY2VudGVyX2xvdykpIHtcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ID0gcHJldl9oaWdoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0LmxlZnQgPSBlbmRwb2ludC5mbGlwKG1heF9jZW50ZXJfbG93LCBcImhpZ2hcIik7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LnByZXYgPSAobXVsdGlwbGVfY2VudGVyX2xvdykgPyByZXN1bHQubGVmdCA6IHByZXZfaGlnaDtcblxuICAgIH1cblxuICAgIC8vIGludGVydmFsIGZyb20gbGVmdC9yaWdodFxuICAgIGxldCBsb3cgPSBlbmRwb2ludC5mbGlwKHJlc3VsdC5sZWZ0LCBcImxvd1wiKTtcbiAgICBsZXQgaGlnaCA9IGVuZHBvaW50LmZsaXAocmVzdWx0LnJpZ2h0LCBcImhpZ2hcIik7XG4gICAgcmVzdWx0Lml0diA9IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG4iLCIvKlxuXHRDb3B5cmlnaHQgMjAyMFxuXHRBdXRob3IgOiBJbmdhciBBcm50emVuXG5cblx0VGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFRpbWluZ3NyYyBtb2R1bGUuXG5cblx0VGltaW5nc3JjIGlzIGZyZWUgc29mdHdhcmU6IHlvdSBjYW4gcmVkaXN0cmlidXRlIGl0IGFuZC9vciBtb2RpZnlcblx0aXQgdW5kZXIgdGhlIHRlcm1zIG9mIHRoZSBHTlUgTGVzc2VyIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5XG5cdHRoZSBGcmVlIFNvZnR3YXJlIEZvdW5kYXRpb24sIGVpdGhlciB2ZXJzaW9uIDMgb2YgdGhlIExpY2Vuc2UsIG9yXG5cdChhdCB5b3VyIG9wdGlvbikgYW55IGxhdGVyIHZlcnNpb24uXG5cblx0VGltaW5nc3JjIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsXG5cdGJ1dCBXSVRIT1VUIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mXG5cdE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRS4gIFNlZSB0aGVcblx0R05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlIGRldGFpbHMuXG5cblx0WW91IHNob3VsZCBoYXZlIHJlY2VpdmVkIGEgY29weSBvZiB0aGUgR05VIExlc3NlciBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlXG5cdGFsb25nIHdpdGggVGltaW5nc3JjLiAgSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+LlxuKi9cblxuXG5cbi8qXG5cdEV2ZW50XG5cdC0gbmFtZTogZXZlbnQgbmFtZVxuXHQtIHB1Ymxpc2hlcjogdGhlIG9iamVjdCB3aGljaCBkZWZpbmVkIHRoZSBldmVudFxuXHQtIGluaXQ6IHRydWUgaWYgdGhlIGV2ZW50IHN1cHBwb3J0cyBpbml0IGV2ZW50c1xuXHQtIHN1YnNjcmlwdGlvbnM6IHN1YnNjcmlwdGlucyB0byB0aGlzIGV2ZW50XG5cbiovXG5cbmNsYXNzIEV2ZW50IHtcblxuXHRjb25zdHJ1Y3RvciAocHVibGlzaGVyLCBuYW1lLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge31cblx0XHR0aGlzLnB1Ymxpc2hlciA9IHB1Ymxpc2hlcjtcblx0XHR0aGlzLm5hbWUgPSBuYW1lO1xuXHRcdHRoaXMuaW5pdCA9IChvcHRpb25zLmluaXQgPT09IHVuZGVmaW5lZCkgPyBmYWxzZSA6IG9wdGlvbnMuaW5pdDtcblx0XHR0aGlzLnN1YnNjcmlwdGlvbnMgPSBbXTtcblx0fVxuXG5cdC8qXG5cdFx0c3Vic2NyaWJlIHRvIGV2ZW50XG5cdFx0LSBzdWJzY3JpYmVyOiBzdWJzY3JpYmluZyBvYmplY3Rcblx0XHQtIGNhbGxiYWNrOiBjYWxsYmFjayBmdW5jdGlvbiB0byBpbnZva2Vcblx0XHQtIG9wdGlvbnM6XG5cdFx0XHRpbml0OiBpZiB0cnVlIHN1YnNjcmliZXIgd2FudHMgaW5pdCBldmVudHNcblx0Ki9cblx0c3Vic2NyaWJlIChjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdGlmICghY2FsbGJhY2sgfHwgdHlwZW9mIGNhbGxiYWNrICE9PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkNhbGxiYWNrIG5vdCBhIGZ1bmN0aW9uXCIsIGNhbGxiYWNrKTtcblx0XHR9XG5cdFx0Y29uc3Qgc3ViID0gbmV3IFN1YnNjcmlwdGlvbih0aGlzLCBjYWxsYmFjaywgb3B0aW9ucyk7XG5cdFx0dGhpcy5zdWJzY3JpcHRpb25zLnB1c2goc3ViKTtcblx0ICAgIC8vIEluaXRpYXRlIGluaXQgY2FsbGJhY2sgZm9yIHRoaXMgc3Vic2NyaXB0aW9uXG5cdCAgICBpZiAodGhpcy5pbml0ICYmIHN1Yi5pbml0KSB7XG5cdCAgICBcdHN1Yi5pbml0X3BlbmRpbmcgPSB0cnVlO1xuXHQgICAgXHRsZXQgc2VsZiA9IHRoaXM7XG5cdCAgICBcdFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24gKCkge1xuXHQgICAgXHRcdGNvbnN0IGVBcmdzID0gc2VsZi5wdWJsaXNoZXIuZXZlbnRpZnlJbml0RXZlbnRBcmdzKHNlbGYubmFtZSkgfHwgW107XG5cdCAgICBcdFx0c3ViLmluaXRfcGVuZGluZyA9IGZhbHNlO1xuXHQgICAgXHRcdGZvciAobGV0IGVBcmcgb2YgZUFyZ3MpIHtcblx0ICAgIFx0XHRcdHNlbGYudHJpZ2dlcihlQXJnLCBbc3ViXSwgdHJ1ZSk7XG5cdCAgICBcdFx0fVxuXHQgICAgXHR9KTtcblx0ICAgIH1cblx0XHRyZXR1cm4gc3ViXG5cdH1cblxuXHQvKlxuXHRcdHRyaWdnZXIgZXZlbnRcblxuXHRcdC0gaWYgc3ViIGlzIHVuZGVmaW5lZCAtIHB1Ymxpc2ggdG8gYWxsIHN1YnNjcmlwdGlvbnNcblx0XHQtIGlmIHN1YiBpcyBkZWZpbmVkIC0gcHVibGlzaCBvbmx5IHRvIGdpdmVuIHN1YnNjcmlwdGlvblxuXHQqL1xuXHR0cmlnZ2VyIChlQXJnLCBzdWJzLCBpbml0KSB7XG5cdFx0bGV0IGVJbmZvLCBjdHg7XG5cdFx0Zm9yIChjb25zdCBzdWIgb2Ygc3Vicykge1xuXHRcdFx0Ly8gaWdub3JlIHRlcm1pbmF0ZWQgc3Vic2NyaXB0aW9uc1xuXHRcdFx0aWYgKHN1Yi50ZXJtaW5hdGVkKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0ZUluZm8gPSB7XG5cdFx0XHRcdHNyYzogdGhpcy5wdWJsaXNoZXIsXG5cdFx0XHRcdG5hbWU6IHRoaXMubmFtZSxcblx0XHRcdFx0c3ViOiBzdWIsXG5cdFx0XHRcdGluaXQ6IGluaXRcblx0XHRcdH1cblx0XHRcdGN0eCA9IHN1Yi5jdHggfHwgdGhpcy5wdWJsaXNoZXI7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzdWIuY2FsbGJhY2suY2FsbChjdHgsIGVBcmcsIGVJbmZvKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgRXJyb3IgaW4gJHt0aGlzLm5hbWV9OiAke3N1Yi5jYWxsYmFja30gJHtlcnJ9YCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0dW5zdWJzY3JpYmUgZnJvbSBldmVudFxuXHQtIHVzZSBzdWJzY3JpcHRpb24gcmV0dXJuZWQgYnkgcHJldmlvdXMgc3Vic2NyaWJlXG5cdCovXG5cdHVuc3Vic2NyaWJlKHN1Yikge1xuXHRcdGxldCBpZHggPSB0aGlzLnN1YnNjcmlwdGlvbnMuaW5kZXhPZihzdWIpO1xuXHRcdGlmIChpZHggPiAtMSkge1xuXHRcdFx0dGhpcy5zdWJzY3JpcHRpb25zLnNwbGljZShpZHgsIDEpO1xuXHRcdFx0c3ViLnRlcm1pbmF0ZSgpO1xuXHRcdH1cblx0fVxufVxuXG5cbi8qXG5cdFN1YnNjcmlwdGlvbiBjbGFzc1xuKi9cblxuY2xhc3MgU3Vic2NyaXB0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcihldmVudCwgY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXHRcdHRoaXMuZXZlbnQgPSBldmVudDtcblx0XHR0aGlzLm5hbWUgPSBldmVudC5uYW1lO1xuXHRcdHRoaXMuY2FsbGJhY2sgPSBjYWxsYmFja1xuXHRcdHRoaXMuaW5pdCA9IChvcHRpb25zLmluaXQgPT09IHVuZGVmaW5lZCkgPyB0aGlzLmV2ZW50LmluaXQgOiBvcHRpb25zLmluaXQ7XG5cdFx0dGhpcy5pbml0X3BlbmRpbmcgPSBmYWxzZTtcblx0XHR0aGlzLnRlcm1pbmF0ZWQgPSBmYWxzZTtcblx0XHR0aGlzLmN0eCA9IG9wdGlvbnMuY3R4O1xuXHR9XG5cblx0dGVybWluYXRlKCkge1xuXHRcdHRoaXMudGVybWluYXRlZCA9IHRydWU7XG5cdFx0dGhpcy5jYWxsYmFjayA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmV2ZW50LnVuc3Vic2NyaWJlKHRoaXMpO1xuXHR9XG59XG5cblxuLypcblxuXHRFVkVOVElGWSBJTlNUQU5DRVxuXG5cdEV2ZW50aWZ5IGJyaW5ncyBldmVudGluZyBjYXBhYmlsaXRpZXMgdG8gYW55IG9iamVjdC5cblxuXHRJbiBwYXJ0aWN1bGFyLCBldmVudGlmeSBzdXBwb3J0cyB0aGUgaW5pdGlhbC1ldmVudCBwYXR0ZXJuLlxuXHRPcHQtaW4gZm9yIGluaXRpYWwgZXZlbnRzIHBlciBldmVudCB0eXBlLlxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cbiovXG5cbmV4cG9ydCBmdW5jdGlvbiBldmVudGlmeUluc3RhbmNlIChvYmplY3QpIHtcblx0b2JqZWN0Ll9fZXZlbnRpZnlfZXZlbnRNYXAgPSBuZXcgTWFwKCk7XG5cdG9iamVjdC5fX2V2ZW50aWZ5X2J1ZmZlciA9IFtdO1xuXHRyZXR1cm4gb2JqZWN0O1xufTtcblxuXG4vKlxuXHRFVkVOVElGWSBQUk9UT1RZUEVcblxuXHRBZGQgZXZlbnRpZnkgZnVuY3Rpb25hbGl0eSB0byBwcm90b3R5cGUgb2JqZWN0XG4qL1xuXG5leHBvcnQgZnVuY3Rpb24gZXZlbnRpZnlQcm90b3R5cGUoX3Byb3RvdHlwZSkge1xuXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5R2V0RXZlbnQob2JqZWN0LCBuYW1lKSB7XG5cdFx0Y29uc3QgZXZlbnQgPSBvYmplY3QuX19ldmVudGlmeV9ldmVudE1hcC5nZXQobmFtZSk7XG5cdFx0aWYgKGV2ZW50ID09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiRXZlbnQgdW5kZWZpbmVkXCIsIG5hbWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gZXZlbnQ7XG5cdH1cblxuXHQvKlxuXHRcdERFRklORSBFVkVOVFxuXHRcdC0gdXNlZCBvbmx5IGJ5IGV2ZW50IHNvdXJjZVxuXHRcdC0gbmFtZTogbmFtZSBvZiBldmVudFxuXHRcdC0gb3B0aW9uczoge2luaXQ6dHJ1ZX0gc3BlY2lmaWVzIGluaXQtZXZlbnQgc2VtYW50aWNzIGZvciBldmVudFxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeURlZmluZShuYW1lLCBvcHRpb25zKSB7XG5cdFx0Ly8gY2hlY2sgdGhhdCBldmVudCBkb2VzIG5vdCBhbHJlYWR5IGV4aXN0XG5cdFx0aWYgKHRoaXMuX19ldmVudGlmeV9ldmVudE1hcC5oYXMobmFtZSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkV2ZW50IGFscmVhZHkgZGVmaW5lZFwiLCBuYW1lKTtcblx0XHR9XG5cdFx0dGhpcy5fX2V2ZW50aWZ5X2V2ZW50TWFwLnNldChuYW1lLCBuZXcgRXZlbnQodGhpcywgbmFtZSwgb3B0aW9ucykpO1xuXHR9O1xuXG5cdC8qXG5cdFx0T05cblx0XHQtIHVzZWQgYnkgc3Vic2NyaWJlclxuXHRcdHJlZ2lzdGVyIGNhbGxiYWNrIG9uIGV2ZW50LlxuXHQqL1xuXHRmdW5jdGlvbiBvbihuYW1lLCBjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdHJldHVybiBldmVudGlmeUdldEV2ZW50KHRoaXMsIG5hbWUpLnN1YnNjcmliZShjYWxsYmFjaywgb3B0aW9ucyk7XG5cdH07XG5cblx0Lypcblx0XHRPRkZcblx0XHQtIHVzZWQgYnkgc3Vic2NyaWJlclxuXHRcdFVuLXJlZ2lzdGVyIGEgaGFuZGxlciBmcm9tIGEgc3BlY2ZpYyBldmVudCB0eXBlXG5cdCovXG5cdGZ1bmN0aW9uIG9mZihzdWIpIHtcblx0XHRyZXR1cm4gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBzdWIubmFtZSkudW5zdWJzY3JpYmUoc3ViKTtcblx0fTtcblxuXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5U3Vic2NyaXB0aW9ucyhuYW1lKSB7XG5cdFx0cmV0dXJuIGV2ZW50aWZ5R2V0RXZlbnQodGhpcywgbmFtZSkuc3Vic2NyaXB0aW9ucztcblx0fVxuXG5cblxuXHQvKlxuXHRcdFRyaWdnZXIgbGlzdCBvZiBldmVudEl0ZW1zIG9uIG9iamVjdFxuXG5cdFx0ZXZlbnRJdGVtOiAge25hbWU6Li4sIGVBcmc6Li59XG5cblx0XHRjb3B5IGFsbCBldmVudEl0ZW1zIGludG8gYnVmZmVyLlxuXHRcdHJlcXVlc3QgZW1wdHlpbmcgdGhlIGJ1ZmZlciwgaS5lLiBhY3R1YWxseSB0cmlnZ2VyaW5nIGV2ZW50cyxcblx0XHRldmVyeSB0aW1lIHRoZSBidWZmZXIgZ29lcyBmcm9tIGVtcHR5IHRvIG5vbi1lbXB0eVxuXHQqL1xuXHRmdW5jdGlvbiBldmVudGlmeVRyaWdnZXJBbGwoZXZlbnRJdGVtcykge1xuXHRcdGlmIChldmVudEl0ZW1zLmxlbmd0aCA9PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gbWFrZSB0cmlnZ2VyIGl0ZW1zXG5cdFx0Ly8gcmVzb2x2ZSBub24tcGVuZGluZyBzdWJzY3JpcHRpb25zIG5vd1xuXHRcdC8vIGVsc2Ugc3Vic2NyaXB0aW9ucyBtYXkgY2hhbmdlIGZyb20gcGVuZGluZyB0byBub24tcGVuZGluZ1xuXHRcdC8vIGJldHdlZW4gaGVyZSBhbmQgYWN0dWFsIHRyaWdnZXJpbmdcblx0XHQvLyBtYWtlIGxpc3Qgb2YgW2V2LCBlQXJnLCBzdWJzXSB0dXBsZXNcblx0XHRsZXQgdHJpZ2dlckl0ZW1zID0gZXZlbnRJdGVtcy5tYXAoKGl0ZW0pID0+IHtcblx0XHRcdGxldCB7bmFtZSwgZUFyZ30gPSBpdGVtO1xuXHRcdFx0bGV0IGV2ID0gZXZlbnRpZnlHZXRFdmVudCh0aGlzLCBuYW1lKTtcblx0XHRcdGxldCBzdWJzID0gZXYuc3Vic2NyaXB0aW9ucy5maWx0ZXIoc3ViID0+IHN1Yi5pbml0X3BlbmRpbmcgPT0gZmFsc2UpO1xuXHRcdFx0cmV0dXJuIFtldiwgZUFyZywgc3Vic107XG5cdFx0fSwgdGhpcyk7XG5cblx0XHQvLyBhcHBlbmQgdHJpZ2dlciBJdGVtcyB0byBidWZmZXJcblx0XHRjb25zdCBsZW4gPSB0cmlnZ2VySXRlbXMubGVuZ3RoO1xuXHRcdGNvbnN0IGJ1ZiA9IHRoaXMuX19ldmVudGlmeV9idWZmZXI7XG5cdFx0Y29uc3QgYnVmX2xlbiA9IHRoaXMuX19ldmVudGlmeV9idWZmZXIubGVuZ3RoO1xuXHRcdC8vIHJlc2VydmUgbWVtb3J5IC0gc2V0IG5ldyBsZW5ndGhcblx0XHR0aGlzLl9fZXZlbnRpZnlfYnVmZmVyLmxlbmd0aCA9IGJ1Zl9sZW4gKyBsZW47XG5cdFx0Ly8gY29weSB0cmlnZ2VySXRlbXMgdG8gYnVmZmVyXG5cdFx0Zm9yIChsZXQgaT0wOyBpPGxlbjsgaSsrKSB7XG5cdFx0XHRidWZbYnVmX2xlbitpXSA9IHRyaWdnZXJJdGVtc1tpXTtcblx0XHR9XG5cdFx0Ly8gcmVxdWVzdCBlbXB0eWluZyBvZiB0aGUgYnVmZmVyXG5cdFx0aWYgKGJ1Zl9sZW4gPT0gMCkge1xuXHRcdFx0bGV0IHNlbGYgPSB0aGlzO1xuXHRcdFx0UHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0Zm9yIChsZXQgW2V2LCBlQXJnLCBzdWJzXSBvZiBzZWxmLl9fZXZlbnRpZnlfYnVmZmVyKSB7XG5cdFx0XHRcdFx0Ly8gYWN0dWFsIGV2ZW50IHRyaWdnZXJpbmdcblx0XHRcdFx0XHRldi50cmlnZ2VyKGVBcmcsIHN1YnMsIGZhbHNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWxmLl9fZXZlbnRpZnlfYnVmZmVyID0gW107XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHQvKlxuXHRcdFRyaWdnZXIgbXVsdGlwbGUgZXZlbnRzIG9mIHNhbWUgdHlwZSAobmFtZSlcblx0Ki9cblx0ZnVuY3Rpb24gZXZlbnRpZnlUcmlnZ2VyQWxpa2UobmFtZSwgZUFyZ3MpIHtcblx0XHRyZXR1cm4gdGhpcy5ldmVudGlmeVRyaWdnZXJBbGwoZUFyZ3MubWFwKGVBcmcgPT4ge1xuXHRcdFx0cmV0dXJuIHtuYW1lLCBlQXJnfTtcblx0XHR9KSk7XG5cdH1cblxuXHQvKlxuXHRcdFRyaWdnZXIgc2luZ2xlIGV2ZW50XG5cdCovXG5cdGZ1bmN0aW9uIGV2ZW50aWZ5VHJpZ2dlcihuYW1lLCBlQXJnKSB7XG5cdFx0cmV0dXJuIHRoaXMuZXZlbnRpZnlUcmlnZ2VyQWxsKFt7bmFtZSwgZUFyZ31dKTtcblx0fVxuXG5cdF9wcm90b3R5cGUuZXZlbnRpZnlEZWZpbmUgPSBldmVudGlmeURlZmluZTtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXIgPSBldmVudGlmeVRyaWdnZXI7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlUcmlnZ2VyQWxpa2UgPSBldmVudGlmeVRyaWdnZXJBbGlrZTtcblx0X3Byb3RvdHlwZS5ldmVudGlmeVRyaWdnZXJBbGwgPSBldmVudGlmeVRyaWdnZXJBbGw7XG5cdF9wcm90b3R5cGUuZXZlbnRpZnlTdWJzY3JpcHRpb25zID0gZXZlbnRpZnlTdWJzY3JpcHRpb25zO1xuXHRfcHJvdG90eXBlLm9uID0gb247XG5cdF9wcm90b3R5cGUub2ZmID0gb2ZmO1xufTtcblxuXG5leHBvcnQge2V2ZW50aWZ5SW5zdGFuY2UgYXMgYWRkVG9JbnN0YW5jZX07XG5leHBvcnQge2V2ZW50aWZ5UHJvdG90eXBlIGFzIGFkZFRvUHJvdG90eXBlfTtcblxuLypcblx0RXZlbnQgVmFyaWFibGVcblxuXHRPYmplY3RzIHdpdGggYSBzaW5nbGUgXCJjaGFuZ2VcIiBldmVudFxuKi9cblxuZXhwb3J0IGNsYXNzIEV2ZW50VmFyaWFibGUge1xuXG5cdGNvbnN0cnVjdG9yICh2YWx1ZSkge1xuXHRcdGV2ZW50aWZ5SW5zdGFuY2UodGhpcyk7XG5cdFx0dGhpcy5fdmFsdWUgPSB2YWx1ZTtcblx0XHR0aGlzLmV2ZW50aWZ5RGVmaW5lKFwiY2hhbmdlXCIsIHtpbml0OnRydWV9KTtcblx0fVxuXG5cdGV2ZW50aWZ5SW5pdEV2ZW50QXJncyhuYW1lKSB7XG5cdFx0aWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl92YWx1ZV07XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5fdmFsdWV9O1xuXHRzZXQgdmFsdWUgKHZhbHVlKSB7XG5cdFx0aWYgKHZhbHVlICE9IHRoaXMuX3ZhbHVlKSB7XG5cdFx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlO1xuXHRcdFx0dGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIiwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuZXZlbnRpZnlQcm90b3R5cGUoRXZlbnRWYXJpYWJsZS5wcm90b3R5cGUpO1xuXG4vKlxuXHRFdmVudCBCb29sZWFuXG5cblxuXHROb3RlIDogaW1wbGVtZW50YXRpb24gdXNlcyBmYWxzaW5lc3Mgb2YgaW5wdXQgcGFyYW1ldGVyIHRvIGNvbnN0cnVjdG9yIGFuZCBzZXQoKSBvcGVyYXRpb24sXG5cdHNvIGV2ZW50Qm9vbGVhbigtMSkgd2lsbCBhY3R1YWxseSBzZXQgaXQgdG8gdHJ1ZSBiZWNhdXNlXG5cdCgtMSkgPyB0cnVlIDogZmFsc2UgLT4gdHJ1ZSAhXG4qL1xuXG5leHBvcnQgY2xhc3MgRXZlbnRCb29sZWFuIGV4dGVuZHMgRXZlbnRWYXJpYWJsZSB7XG5cdGNvbnN0cnVjdG9yKHZhbHVlKSB7XG5cdFx0c3VwZXIoQm9vbGVhbih2YWx1ZSkpO1xuXHR9XG5cblx0c2V0IHZhbHVlICh2YWx1ZSkge1xuXHRcdHN1cGVyLnZhbHVlID0gQm9vbGVhbih2YWx1ZSk7XG5cdH1cblx0Z2V0IHZhbHVlICgpIHtyZXR1cm4gc3VwZXIudmFsdWV9O1xufVxuXG5cbi8qXG5cdG1ha2UgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdoZW4gRXZlbnRCb29sZWFuIGNoYW5nZXNcblx0dmFsdWUuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQcm9taXNlKGV2ZW50T2JqZWN0LCBjb25kaXRpb25GdW5jKSB7XG5cdGNvbmRpdGlvbkZ1bmMgPSBjb25kaXRpb25GdW5jIHx8IGZ1bmN0aW9uKHZhbCkge3JldHVybiB2YWwgPT0gdHJ1ZX07XG5cdHJldHVybiBuZXcgUHJvbWlzZSAoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXHRcdGxldCBzdWIgPSBldmVudE9iamVjdC5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAodmFsdWUpIHtcblx0XHRcdGlmIChjb25kaXRpb25GdW5jKHZhbHVlKSkge1xuXHRcdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHRcdFx0ZXZlbnRPYmplY3Qub2ZmKHN1Yik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xufTtcblxuLy8gbW9kdWxlIGFwaVxuZXhwb3J0IGRlZmF1bHQge1xuXHRldmVudGlmeVByb3RvdHlwZSxcblx0ZXZlbnRpZnlJbnN0YW5jZSxcblx0RXZlbnRWYXJpYWJsZSxcblx0RXZlbnRCb29sZWFuLFxuXHRtYWtlUHJvbWlzZVxufTtcblxuIiwiaW1wb3J0IHsgaW1wbGVtZW50c19jYWxsYmFjayB9IGZyb20gXCIuL2FwaV9jYWxsYmFja1wiO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBTT1VSQ0UgUFJPUEVSVFkgKFNSQ1BST1ApXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9ucyBmb3IgZXh0ZW5kaW5nIGEgY2xhc3Mgd2l0aCBzdXBwb3J0IGZvciBcbiAqIGV4dGVybmFsIHNvdXJjZSBvbiBhIG5hbWVkIHByb3BlcnR5LlxuICogXG4gKiBvcHRpb246IG11dGFibGU6dHJ1ZSBtZWFucyB0aGF0IHByb3BlcnkgbWF5IGJlIHJlc2V0IFxuICogXG4gKiBzb3VyY2Ugb2JqZWN0IGlzIGFzc3VtZWQgdG8gc3VwcG9ydCB0aGUgY2FsbGJhY2sgaW50ZXJmYWNlLFxuICogb3IgYmUgYSBsaXN0IG9mIG9iamVjdHMgYWxsIHN1cHBvcnRpbmcgdGhlIGNhbGxiYWNrIGludGVyZmFjZVxuICovXG5cbmNvbnN0IE5BTUUgPSBcInNyY3Byb3BcIjtcbmNvbnN0IFBSRUZJWCA9IGBfXyR7TkFNRX1gO1xuXG5leHBvcnQgZnVuY3Rpb24gYWRkVG9JbnN0YW5jZSAob2JqZWN0KSB7XG4gICAgb2JqZWN0W2Ake1BSRUZJWH1gXSA9IG5ldyBNYXAoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRvUHJvdG90eXBlIChfcHJvdG90eXBlKSB7XG5cbiAgICBmdW5jdGlvbiByZWdpc3Rlcihwcm9wTmFtZSwgb3B0aW9ucz17fSkge1xuICAgICAgICBsZXQge211dGFibGU9dHJ1ZX0gPSBvcHRpb25zO1xuICAgICAgICBjb25zdCBtYXAgPSB0aGlzW2Ake1BSRUZJWH1gXTsgXG4gICAgICAgIG1hcC5zZXQocHJvcE5hbWUsIHtcbiAgICAgICAgICAgIGluaXQ6ZmFsc2UsXG4gICAgICAgICAgICBtdXRhYmxlLFxuICAgICAgICAgICAgZW50aXR5OiB1bmRlZmluZWQsXG4gICAgICAgICAgICBoYW5kbGVzOiBbXVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyByZWdpc3RlciBnZXR0ZXJzIGFuZCBzZXR0ZXJzXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBwcm9wTmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1hcC5nZXQocHJvcE5hbWUpLmVudGl0eTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uIChlbnRpdHkpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpc1tgJHtOQU1FfV9jaGVja2BdKSB7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eSA9IHRoaXNbYCR7TkFNRX1fY2hlY2tgXShwcm9wTmFtZSwgZW50aXR5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGVudGl0eSAhPSBtYXAuZ2V0KHByb3BOYW1lKS5lbnRpdHkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpc1tgJHtQUkVGSVh9X2F0dGFjaGBdKHByb3BOYW1lLCBlbnRpdHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXR0YXRjaChwcm9wTmFtZSwgZW50aXR5KSB7XG5cbiAgICAgICAgY29uc3QgbWFwID0gdGhpc1tgJHtQUkVGSVh9YF07XG4gICAgICAgIGNvbnN0IHN0YXRlID0gbWFwLmdldChwcm9wTmFtZSlcblxuICAgICAgICBpZiAoc3RhdGUuaW5pdCAmJiAhc3RhdGUubXV0YWJsZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3Byb3BOYW1lfSBjYW4gbm90IGJlIHJlYXNzaWduZWRgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGVudGl0aWVzID0gKEFycmF5LmlzQXJyYXkoZW50aXR5KSkgPyBlbnRpdHkgOiBbZW50aXR5XTtcblxuICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIGVudGl0aWVzXG4gICAgICAgIGlmIChzdGF0ZS5oYW5kbGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2lkeCwgZV0gb2YgT2JqZWN0LmVudHJpZXMoZW50aXRpZXMpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGltcGxlbWVudHNfY2FsbGJhY2soZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZS5yZW1vdmVfY2FsbGJhY2soc3RhdGUuaGFuZGxlc1tpZHhdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9ICAgIFxuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmhhbmRsZXMgPSBbXTtcblxuICAgICAgICAvLyBhdHRhdGNoIG5ldyBlbnRpdHlcbiAgICAgICAgc3RhdGUuZW50aXR5ID0gZW50aXR5O1xuICAgICAgICBzdGF0ZS5pbml0ID0gdHJ1ZTtcblxuICAgICAgICAvLyBzdWJzY3JpYmUgdG8gY2FsbGJhY2sgZnJvbSBzb3VyY2VcbiAgICAgICAgaWYgKHRoaXNbYCR7TkFNRX1fb25jaGFuZ2VgXSkge1xuICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IGZ1bmN0aW9uIChlQXJnKSB7XG4gICAgICAgICAgICAgICAgdGhpc1tgJHtOQU1FfV9vbmNoYW5nZWBdKHByb3BOYW1lLCBlQXJnKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZSBvZiBlbnRpdGllcykge1xuICAgICAgICAgICAgICAgIGlmIChpbXBsZW1lbnRzX2NhbGxiYWNrKGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlLmhhbmRsZXMucHVzaChlLmFkZF9jYWxsYmFjayhoYW5kbGVyKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpc1tgJHtOQU1FfV9vbmNoYW5nZWBdKHByb3BOYW1lLCBcInJlc2V0XCIpOyBcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGFwaSA9IHt9O1xuICAgIGFwaVtgJHtOQU1FfV9yZWdpc3RlcmBdID0gcmVnaXN0ZXI7XG4gICAgYXBpW2Ake1BSRUZJWH1fYXR0YWNoYF0gPSBhdHRhdGNoO1xuICAgIE9iamVjdC5hc3NpZ24oX3Byb3RvdHlwZSwgYXBpKTtcbn1cblxuIiwiaW1wb3J0IHsgaW50ZXJ2YWwgfSBmcm9tIFwiLi9pbnRlcnZhbHMuanNcIjtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbkJBU0UgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLypcblx0QWJzdHJhY3QgQmFzZSBDbGFzcyBmb3IgU2VnbWVudHNcblxuICAgIGNvbnN0cnVjdG9yKGludGVydmFsKVxuXG4gICAgLSBpbnRlcnZhbDogaW50ZXJ2YWwgb2YgdmFsaWRpdHkgb2Ygc2VnbWVudFxuICAgIC0gZHluYW1pYzogdHJ1ZSBpZiBzZWdtZW50IGlzIGR5bmFtaWNcbiAgICAtIHZhbHVlKG9mZnNldCk6IHZhbHVlIG9mIHNlZ21lbnQgYXQgb2Zmc2V0XG4gICAgLSBxdWVyeShvZmZzZXQpOiBzdGF0ZSBvZiBzZWdtZW50IGF0IG9mZnNldFxuKi9cblxuZXhwb3J0IGNsYXNzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYpIHtcblx0XHR0aGlzLl9pdHYgPSBpdHY7XG5cdH1cblxuXHRnZXQgaXR2KCkge3JldHVybiB0aGlzLl9pdHY7fVxuXG4gICAgLyoqIFxuICAgICAqIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzXG4gICAgICogcmV0dXJucyB7dmFsdWUsIGR5bmFtaWN9O1xuICAgICovXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgXHR0aHJvdyBuZXcgRXJyb3IoXCJub3QgaW1wbGVtZW50ZWRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY29udmVuaWVuY2UgZnVuY3Rpb24gcmV0dXJuaW5nIHRoZSBzdGF0ZSBvZiB0aGUgc2VnbWVudFxuICAgICAqIEBwYXJhbSB7Kn0gb2Zmc2V0IFxuICAgICAqIEByZXR1cm5zIFxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBpZiAoaW50ZXJ2YWwuY292ZXJzX3BvaW50KHRoaXMuX2l0diwgb2Zmc2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuIHsuLi50aGlzLnN0YXRlKG9mZnNldCksIG9mZnNldH07XG4gICAgICAgIH0gXG4gICAgICAgIHJldHVybiB7dmFsdWU6IHVuZGVmaW5lZCwgZHluYW1pYzpmYWxzZSwgb2Zmc2V0fTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBMQVlFUlMgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJzU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGFyZ3MpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcblx0XHR0aGlzLl9sYXllcnMgPSBhcmdzLmxheWVycztcbiAgICAgICAgdGhpcy5fdmFsdWVfZnVuYyA9IGFyZ3MudmFsdWVfZnVuY1xuXG4gICAgICAgIC8vIFRPRE8gLSBmaWd1cmUgb3V0IGR5bmFtaWMgaGVyZT9cbiAgICB9XG5cblx0c3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIC8vIFRPRE8gLSB1c2UgdmFsdWUgZnVuY1xuICAgICAgICAvLyBmb3Igbm93IC0ganVzdCB1c2UgZmlyc3QgbGF5ZXJcbiAgICAgICAgcmV0dXJuIHsuLi50aGlzLl9sYXllcnNbMF0ucXVlcnkob2Zmc2V0KSwgb2Zmc2V0fTtcblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFNUQVRJQyBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmV4cG9ydCBjbGFzcyBTdGF0aWNTZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG5cdGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuICAgICAgICBzdXBlcihpdHYpO1xuXHRcdHRoaXMuX3ZhbHVlID0gZGF0YTtcblx0fVxuXG5cdHN0YXRlKCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl92YWx1ZSwgZHluYW1pYzpmYWxzZX1cblx0fVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIE1PVElPTiBTRUdNRU5UXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKlxuICAgIEltcGxlbWVudHMgZGV0ZXJtaW5pc3RpYyBwcm9qZWN0aW9uIGJhc2VkIG9uIGluaXRpYWwgY29uZGl0aW9ucyBcbiAgICAtIG1vdGlvbiB2ZWN0b3IgZGVzY3JpYmVzIG1vdGlvbiB1bmRlciBjb25zdGFudCBhY2NlbGVyYXRpb25cbiovXG5cbmV4cG9ydCBjbGFzcyBNb3Rpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuICAgIFxuICAgIGNvbnN0cnVjdG9yKGl0diwgZGF0YSkge1xuICAgICAgICBzdXBlcihpdHYpO1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBwb3NpdGlvbjpwMD0wLCBcbiAgICAgICAgICAgIHZlbG9jaXR5OnYwPTAsIFxuICAgICAgICAgICAgYWNjZWxlcmF0aW9uOmEwPTAsIFxuICAgICAgICAgICAgdGltZXN0YW1wOnQwPTBcbiAgICAgICAgfSA9IGRhdGE7XG4gICAgICAgIC8vIGNyZWF0ZSBtb3Rpb24gdHJhbnNpdGlvblxuICAgICAgICB0aGlzLl9wb3NfZnVuYyA9IGZ1bmN0aW9uICh0cykge1xuICAgICAgICAgICAgbGV0IGQgPSB0cyAtIHQwO1xuICAgICAgICAgICAgcmV0dXJuIHAwICsgdjAqZCArIDAuNSphMCpkKmQ7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuX3ZlbF9mdW5jID0gZnVuY3Rpb24gKHRzKSB7XG4gICAgICAgICAgICBsZXQgZCA9IHRzIC0gdDA7XG4gICAgICAgICAgICByZXR1cm4gdjAgKyBhMCpkO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2FjY19mdW5jID0gZnVuY3Rpb24gKHRzKSB7XG4gICAgICAgICAgICByZXR1cm4gYTA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0ZShvZmZzZXQpIHtcbiAgICAgICAgbGV0IHBvcyA9IHRoaXMuX3Bvc19mdW5jKG9mZnNldCk7XG4gICAgICAgIGxldCB2ZWwgPSB0aGlzLl92ZWxfZnVuYyhvZmZzZXQpO1xuICAgICAgICBsZXQgYWNjID0gdGhpcy5fYWNjX2Z1bmMob2Zmc2V0KTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBwb3MsXG4gICAgICAgICAgICB2ZWxvY2l0eTogdmVsLFxuICAgICAgICAgICAgYWNjZWxlcmF0aW9uOiBhY2MsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IG9mZnNldCxcbiAgICAgICAgICAgIHZhbHVlOiBwb3MsXG4gICAgICAgICAgICBkeW5hbWljOiAodmVsICE9IDAgfHwgYWNjICE9IDAgKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRSQU5TSVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIFN1cHBvcnRlZCBlYXNpbmcgZnVuY3Rpb25zXG4gICAgXCJlYXNlLWluXCI6XG4gICAgXCJlYXNlLW91dFwiOlxuICAgIFwiZWFzZS1pbi1vdXRcIlxuKi9cblxuZnVuY3Rpb24gZWFzZWluICh0cykge1xuICAgIHJldHVybiBNYXRoLnBvdyh0cywyKTsgIFxufVxuZnVuY3Rpb24gZWFzZW91dCAodHMpIHtcbiAgICByZXR1cm4gMSAtIGVhc2VpbigxIC0gdHMpO1xufVxuZnVuY3Rpb24gZWFzZWlub3V0ICh0cykge1xuICAgIGlmICh0cyA8IC41KSB7XG4gICAgICAgIHJldHVybiBlYXNlaW4oMiAqIHRzKSAvIDI7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICgyIC0gZWFzZWluKDIgKiAoMSAtIHRzKSkpIC8gMjtcbiAgICB9XG59XG5cbmV4cG9ydCBjbGFzcyBUcmFuc2l0aW9uU2VnbWVudCBleHRlbmRzIEJhc2VTZWdtZW50IHtcblxuXHRjb25zdHJ1Y3RvcihpdHYsIGRhdGEpIHtcblx0XHRzdXBlcihpdHYpO1xuICAgICAgICBsZXQge3YwLCB2MSwgZWFzaW5nfSA9IGRhdGE7XG4gICAgICAgIGxldCBbdDAsIHQxXSA9IHRoaXMuX2l0di5zbGljZSgwLDIpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgdHJhbnNpdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl9keW5hbWljID0gdjEtdjAgIT0gMDtcbiAgICAgICAgdGhpcy5fdHJhbnMgPSBmdW5jdGlvbiAodHMpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgdHMgdG8gW3QwLHQxXS1zcGFjZVxuICAgICAgICAgICAgLy8gLSBzaGlmdCBmcm9tIFt0MCx0MV0tc3BhY2UgdG8gWzAsKHQxLXQwKV0tc3BhY2VcbiAgICAgICAgICAgIC8vIC0gc2NhbGUgZnJvbSBbMCwodDEtdDApXS1zcGFjZSB0byBbMCwxXS1zcGFjZVxuICAgICAgICAgICAgdHMgPSB0cyAtIHQwO1xuICAgICAgICAgICAgdHMgPSB0cy9wYXJzZUZsb2F0KHQxLXQwKTtcbiAgICAgICAgICAgIC8vIGVhc2luZyBmdW5jdGlvbnMgc3RyZXRjaGVzIG9yIGNvbXByZXNzZXMgdGhlIHRpbWUgc2NhbGUgXG4gICAgICAgICAgICBpZiAoZWFzaW5nID09IFwiZWFzZS1pblwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlaW4odHMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChlYXNpbmcgPT0gXCJlYXNlLW91dFwiKSB7XG4gICAgICAgICAgICAgICAgdHMgPSBlYXNlb3V0KHRzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZWFzaW5nID09IFwiZWFzZS1pbi1vdXRcIikge1xuICAgICAgICAgICAgICAgIHRzID0gZWFzZWlub3V0KHRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc2l0aW9uIGZyb20gdjAgdG8gdjEsIGZvciB0aW1lIHZhbHVlcyBbMCwxXVxuICAgICAgICAgICAgdHMgPSBNYXRoLm1heCh0cywgMCk7XG4gICAgICAgICAgICB0cyA9IE1hdGgubWluKHRzLCAxKTtcbiAgICAgICAgICAgIHJldHVybiB2MCArICh2MS12MCkqdHM7XG4gICAgICAgIH1cblx0fVxuXG5cdHN0YXRlKG9mZnNldCkge1xuICAgICAgICByZXR1cm4ge3ZhbHVlOiB0aGlzLl90cmFucyhvZmZzZXQpLCBkeW5hbWljOnRoaXMuX2R5bmFtaWN9XG5cdH1cbn1cblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIElOVEVSUE9MQVRJT04gU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIEZ1bmN0aW9uIHRvIGNyZWF0ZSBhbiBpbnRlcnBvbGF0b3IgZm9yIG5lYXJlc3QgbmVpZ2hib3IgaW50ZXJwb2xhdGlvbiB3aXRoXG4gKiBleHRyYXBvbGF0aW9uIHN1cHBvcnQuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gdHVwbGVzIC0gQW4gYXJyYXkgb2YgW3ZhbHVlLCBvZmZzZXRdIHBhaXJzLCB3aGVyZSB2YWx1ZSBpcyB0aGVcbiAqIHBvaW50J3MgdmFsdWUgYW5kIG9mZnNldCBpcyB0aGUgY29ycmVzcG9uZGluZyBvZmZzZXQuXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IC0gQSBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIG9mZnNldCBhbmQgcmV0dXJucyB0aGVcbiAqIGludGVycG9sYXRlZCBvciBleHRyYXBvbGF0ZWQgdmFsdWUuXG4gKi9cblxuZnVuY3Rpb24gaW50ZXJwb2xhdGUodHVwbGVzKSB7XG5cbiAgICBpZiAodHVwbGVzLmxlbmd0aCA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHVuZGVmaW5lZDt9XG4gICAgfSBlbHNlIGlmICh0dXBsZXMubGVuZ3RoID09IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGludGVycG9sYXRvciAoKSB7cmV0dXJuIHR1cGxlc1swXVswXTt9XG4gICAgfVxuXG4gICAgLy8gU29ydCB0aGUgdHVwbGVzIGJ5IHRoZWlyIG9mZnNldHNcbiAgICBjb25zdCBzb3J0ZWRUdXBsZXMgPSBbLi4udHVwbGVzXS5zb3J0KChhLCBiKSA9PiBhWzFdIC0gYlsxXSk7XG4gIFxuICAgIHJldHVybiBmdW5jdGlvbiBpbnRlcnBvbGF0b3Iob2Zmc2V0KSB7XG4gICAgICAvLyBIYW5kbGUgZXh0cmFwb2xhdGlvbiBiZWZvcmUgdGhlIGZpcnN0IHBvaW50XG4gICAgICBpZiAob2Zmc2V0IDw9IHNvcnRlZFR1cGxlc1swXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1swXTtcbiAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbMV07XG4gICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gSGFuZGxlIGV4dHJhcG9sYXRpb24gYWZ0ZXIgdGhlIGxhc3QgcG9pbnRcbiAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXVsxXSkge1xuICAgICAgICBjb25zdCBbdmFsdWUxLCBvZmZzZXQxXSA9IHNvcnRlZFR1cGxlc1tzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMl07XG4gICAgICAgIGNvbnN0IFt2YWx1ZTIsIG9mZnNldDJdID0gc29ydGVkVHVwbGVzW3NvcnRlZFR1cGxlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgcmV0dXJuIHZhbHVlMSArICgob2Zmc2V0IC0gb2Zmc2V0MSkgKiAodmFsdWUyIC0gdmFsdWUxKSAvIChvZmZzZXQyIC0gb2Zmc2V0MSkpO1xuICAgICAgfVxuICBcbiAgICAgIC8vIEZpbmQgdGhlIG5lYXJlc3QgcG9pbnRzIHRvIHRoZSBsZWZ0IGFuZCByaWdodFxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3J0ZWRUdXBsZXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGlmIChvZmZzZXQgPj0gc29ydGVkVHVwbGVzW2ldWzFdICYmIG9mZnNldCA8PSBzb3J0ZWRUdXBsZXNbaSArIDFdWzFdKSB7XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMSwgb2Zmc2V0MV0gPSBzb3J0ZWRUdXBsZXNbaV07XG4gICAgICAgICAgY29uc3QgW3ZhbHVlMiwgb2Zmc2V0Ml0gPSBzb3J0ZWRUdXBsZXNbaSArIDFdO1xuICAgICAgICAgIC8vIExpbmVhciBpbnRlcnBvbGF0aW9uIGZvcm11bGE6IHkgPSB5MSArICggKHggLSB4MSkgKiAoeTIgLSB5MSkgLyAoeDIgLSB4MSkgKVxuICAgICAgICAgIHJldHVybiB2YWx1ZTEgKyAoKG9mZnNldCAtIG9mZnNldDEpICogKHZhbHVlMiAtIHZhbHVlMSkgLyAob2Zmc2V0MiAtIG9mZnNldDEpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICBcbiAgICAgIC8vIEluIGNhc2UgdGhlIG9mZnNldCBkb2VzIG5vdCBmYWxsIHdpdGhpbiBhbnkgcmFuZ2UgKHNob3VsZCBiZSBjb3ZlcmVkIGJ5IHRoZSBwcmV2aW91cyBjb25kaXRpb25zKVxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9O1xufVxuICBcblxuZXhwb3J0IGNsYXNzIEludGVycG9sYXRpb25TZWdtZW50IGV4dGVuZHMgQmFzZVNlZ21lbnQge1xuXG4gICAgY29uc3RydWN0b3IoaXR2LCB0dXBsZXMpIHtcbiAgICAgICAgc3VwZXIoaXR2KTtcbiAgICAgICAgLy8gc2V0dXAgaW50ZXJwb2xhdGlvbiBmdW5jdGlvblxuICAgICAgICB0aGlzLl90cmFucyA9IGludGVycG9sYXRlKHR1cGxlcyk7XG4gICAgfVxuXG4gICAgc3RhdGUob2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiB7dmFsdWU6IHRoaXMuX3RyYW5zKG9mZnNldCksIGR5bmFtaWM6dHJ1ZX07XG4gICAgfVxufVxuXG5cbiIsImltcG9ydCB7IGVuZHBvaW50IH0gZnJvbSBcIi4vaW50ZXJ2YWxzLmpzXCI7XG5cbmZ1bmN0aW9uIGx0IChwMSwgcDIpIHtcblx0cmV0dXJuIGVuZHBvaW50Lmx0KGVuZHBvaW50LmZyb21faW5wdXQocDEpLCBlbmRwb2ludC5mcm9tX2lucHV0KHAyKSk7XG59XG5mdW5jdGlvbiBlcSAocDEsIHAyKSB7XG5cdHJldHVybiBlbmRwb2ludC5lcShlbmRwb2ludC5mcm9tX2lucHV0KHAxKSwgZW5kcG9pbnQuZnJvbV9pbnB1dChwMikpO1xufVxuZnVuY3Rpb24gY21wIChwMSwgcDIpIHtcblx0cmV0dXJuIGVuZHBvaW50LmNtcChlbmRwb2ludC5mcm9tX2lucHV0KHAxKSwgZW5kcG9pbnQuZnJvbV9pbnB1dChwMikpO1xufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcblx0U09SVEVEIEFSUkFZXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG5cdFNvcnRlZCBhcnJheSBvZiB2YWx1ZXMuXG5cdC0gRWxlbWVudHMgYXJlIHNvcnRlZCBpbiBhc2NlbmRpbmcgb3JkZXIuXG5cdC0gTm8gZHVwbGljYXRlcyBhcmUgYWxsb3dlZC5cblx0LSBCaW5hcnkgc2VhcmNoIHVzZWQgZm9yIGxvb2t1cFxuXG5cdHZhbHVlcyBjYW4gYmUgcmVndWxhciBudW1iZXIgdmFsdWVzIChmbG9hdCkgb3IgcG9pbnRzIFtmbG9hdCwgc2lnbl1cblx0XHQ+YSA6IFthLCAtMV0gLSBsYXJnZXN0IHZhbHVlIHNtYWxsZXIgdGhhbiBhXG5cdFx0YSAgOiBbYSwgMF0gIC0gYVxuXHRcdGE8IDogW2EsICsxXSAtIHNtYWxsZXN0IHZhbHVlIGxhcmdlciB0aGFuIGFcbiovXG5cbmV4cG9ydCBjbGFzcyBTb3J0ZWRBcnJheSB7XG5cblx0Y29uc3RydWN0b3IoKXtcblx0XHR0aGlzLl9hcnJheSA9IFtdO1xuXHR9XG5cblx0Z2V0IHNpemUoKSB7cmV0dXJuIHRoaXMuX2FycmF5Lmxlbmd0aDt9XG5cdGdldCBhcnJheSgpIHtyZXR1cm4gdGhpcy5fYXJyYXk7fVxuXHQvKlxuXHRcdGZpbmQgaW5kZXggb2YgZ2l2ZW4gdmFsdWVcblxuXHRcdHJldHVybiBbZm91bmQsIGluZGV4XVxuXG5cdFx0aWYgZm91bmQgaXMgdHJ1ZSwgdGhlbiBpbmRleCBpcyB0aGUgaW5kZXggb2YgdGhlIGZvdW5kIG9iamVjdFxuXHRcdGlmIGZvdW5kIGlzIGZhbHNlLCB0aGVuIGluZGV4IGlzIHRoZSBpbmRleCB3aGVyZSB0aGUgb2JqZWN0IHNob3VsZFxuXHRcdGJlIGluc2VydGVkXG5cblx0XHQtIHVzZXMgYmluYXJ5IHNlYXJjaFx0XHRcblx0XHQtIGFycmF5IGRvZXMgbm90IGluY2x1ZGUgYW55IGR1cGxpY2F0ZSB2YWx1ZXNcblx0Ki9cblx0aW5kZXhPZih0YXJnZXRfdmFsdWUpIHtcblx0XHRsZXQgbGVmdF9pZHggPSAwO1xuXHRcdGxldCByaWdodF9pZHggPSB0aGlzLl9hcnJheS5sZW5ndGggLSAxO1xuXHRcdHdoaWxlIChsZWZ0X2lkeCA8PSByaWdodF9pZHgpIHtcblx0XHRcdGNvbnN0IG1pZF9pZHggPSBNYXRoLmZsb29yKChsZWZ0X2lkeCArIHJpZ2h0X2lkeCkgLyAyKTtcblx0XHRcdGxldCBtaWRfdmFsdWUgPSB0aGlzLl9hcnJheVttaWRfaWR4XTtcblx0XHRcdGlmIChlcShtaWRfdmFsdWUsIHRhcmdldF92YWx1ZSkpIHtcblx0XHRcdFx0cmV0dXJuIFt0cnVlLCBtaWRfaWR4XTsgLy8gVGFyZ2V0IGFscmVhZHkgZXhpc3RzIGluIHRoZSBhcnJheVxuXHRcdFx0fSBlbHNlIGlmIChsdChtaWRfdmFsdWUsIHRhcmdldF92YWx1ZSkpIHtcblx0XHRcdFx0ICBsZWZ0X2lkeCA9IG1pZF9pZHggKyAxOyAvLyBNb3ZlIHNlYXJjaCByYW5nZSB0byB0aGUgcmlnaHRcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdCAgcmlnaHRfaWR4ID0gbWlkX2lkeCAtIDE7IC8vIE1vdmUgc2VhcmNoIHJhbmdlIHRvIHRoZSBsZWZ0XG5cdFx0XHR9XG5cdFx0fVxuXHQgIFx0cmV0dXJuIFtmYWxzZSwgbGVmdF9pZHhdOyAvLyBSZXR1cm4gdGhlIGluZGV4IHdoZXJlIHRhcmdldCBzaG91bGQgYmUgaW5zZXJ0ZWRcblx0fVxuXG5cdC8qXG5cdFx0ZmluZCBpbmRleCBvZiBzbWFsbGVzdCB2YWx1ZSB3aGljaCBpcyBncmVhdGVyIHRoYW4gb3IgZXF1YWwgdG8gdGFyZ2V0IHZhbHVlXG5cdFx0cmV0dXJucyAtMSBpZiBubyBzdWNoIHZhbHVlIGV4aXN0c1xuXHQqL1xuXHRnZUluZGV4T2YodGFyZ2V0X3ZhbHVlKSB7XG5cdFx0bGV0IFtmb3VuZCwgaWR4XSA9IHRoaXMuaW5kZXhPZih0YXJnZXRfdmFsdWUpO1xuXHRcdHJldHVybiAoaWR4IDwgdGhpcy5fYXJyYXkubGVuZ3RoKSA/IGlkeCA6IC0xICBcblx0fVxuXG5cdC8qXG5cdFx0ZmluZCBpbmRleCBvZiBsYXJnZXN0IHZhbHVlIHdoaWNoIGlzIGxlc3MgdGhhbiBvciBlcXVhbCB0byB0YXJnZXQgdmFsdWVcblx0XHRyZXR1cm5zIC0xIGlmIG5vIHN1Y2ggdmFsdWUgZXhpc3RzXG5cdCovXG5cdGxlSW5kZXhPZih0YXJnZXRfdmFsdWUpIHtcblx0XHRsZXQgW2ZvdW5kLCBpZHhdID0gdGhpcy5pbmRleE9mKHRhcmdldF92YWx1ZSk7XG5cdFx0aWR4ID0gKGZvdW5kKSA/IGlkeCA6IGlkeC0xO1xuXHRcdHJldHVybiAoaWR4ID49IDApID8gaWR4IDogLTE7XG5cdH1cblxuXHQvKlxuXHRcdGZpbmQgaW5kZXggb2Ygc21hbGxlc3QgdmFsdWUgd2hpY2ggaXMgZ3JlYXRlciB0aGFuIHRhcmdldCB2YWx1ZVxuXHRcdHJldHVybnMgLTEgaWYgbm8gc3VjaCB2YWx1ZSBleGlzdHNcblx0Ki9cblx0Z3RJbmRleE9mKHRhcmdldF92YWx1ZSkge1xuXHRcdGxldCBbZm91bmQsIGlkeF0gPSB0aGlzLmluZGV4T2YodGFyZ2V0X3ZhbHVlKTtcblx0XHRpZHggPSAoZm91bmQpID8gaWR4ICsgMSA6IGlkeDtcblx0XHRyZXR1cm4gKGlkeCA8IHRoaXMuX2FycmF5Lmxlbmd0aCkgPyBpZHggOiAtMSAgXG5cdH1cblxuXHQvKlxuXHRcdGZpbmQgaW5kZXggb2YgbGFyZ2VzdCB2YWx1ZSB3aGljaCBpcyBsZXNzIHRoYW4gdGFyZ2V0IHZhbHVlXG5cdFx0cmV0dXJucyAtMSBpZiBubyBzdWNoIHZhbHVlIGV4aXN0c1xuXHQqL1xuXHRsdEluZGV4T2YodGFyZ2V0X3ZhbHVlKSB7XG5cdFx0bGV0IFtmb3VuZCwgaWR4XSA9IHRoaXMuaW5kZXhPZih0YXJnZXRfdmFsdWUpO1xuXHRcdGlkeCA9IGlkeC0xO1xuXHRcdHJldHVybiAoaWR4ID49IDApID8gaWR4IDogLTE7XHRcblx0fVxuXG5cdC8qXG5cdFx0VVBEQVRFXG5cblx0XHRhcHByb2FjaCAtIG1ha2UgYWxsIG5lY2Nlc3NhcnkgY2hhbmdlcyBhbmQgdGhlbiBzb3J0XG5cblx0XHRhcyBhIHJ1bGUgb2YgdGh1bWIgLSBjb21wYXJlZCB0byByZW1vdmluZyBhbmQgaW5zZXJ0aW5nIGVsZW1lbnRzXG5cdFx0b25lIGJ5IG9uZSwgdGhpcyBpcyBtb3JlIGVmZmVjdGl2ZSBmb3IgbGFyZ2VyIGJhdGNoZXMsIHNheSA+IDEwMC5cblx0XHRFdmVuIHRob3VnaCB0aGlzIG1pZ2h0IG5vdCBiZSB0aGUgY29tbW9uIGNhc2UsIHBlbmFsdGllcyBmb3Jcblx0XHRjaG9vc2luZyB0aGUgd3JvbmcgYXBwcm9hY2ggaXMgaGlnaGVyIGZvciBsYXJnZXIgYmF0Y2hlcy5cblxuXHRcdHJlbW92ZSBpcyBwcm9jZXNzZWQgZmlyc3QsIHNvIGlmIGEgdmFsdWUgYXBwZWFycyBpbiBib3RoIFxuXHRcdHJlbW92ZSBhbmQgaW5zZXJ0LCBpdCB3aWxsIHJlbWFpbi5cblx0XHR1bmRlZmluZWQgdmFsdWVzIGNhbiBub3QgYmUgaW5zZXJ0ZWQgXG5cblx0Ki9cblxuXHR1cGRhdGUocmVtb3ZlX2xpc3Q9W10sIGluc2VydF9saXN0PVtdKSB7XG5cblx0XHQvKlxuXHRcdFx0cmVtb3ZlXG5cblx0XHRcdHJlbW92ZSBieSBmbGFnZ2luZyBlbGVtZW50cyBhcyB1bmRlZmluZWRcblx0XHRcdC0gY29sbGVjdCBhbGwgaW5kZXhlcyBmaXJzdFxuXHRcdFx0LSBmbGFnIGFzIHVuZGVmaW5lZCBvbmx5IGFmdGVyIGFsbCBpbmRleGVzIGhhdmUgYmVlbiBmb3VuZCxcblx0XHRcdCAgYXMgaW5zZXJ0aW5nIHVuZGVmaW5lZCB2YWx1ZXMgYnJlYWtlcyB0aGUgYXNzdW1wdGlvbiB0aGF0XG5cdFx0XHQgIHRoZSBhcnJheSBpcyBzb3J0ZWQuXG5cdFx0XHQtIGxhdGVyIHNvcnQgd2lsbCBtb3ZlIHRoZW0gdG8gdGhlIGVuZCwgd2hlcmUgdGhleSBjYW4gYmVcblx0XHRcdCAgdHJ1bmNhdGVkIG9mZlxuXHRcdCovXG5cdFx0bGV0IHJlbW92ZV9pZHhfbGlzdCA9IFtdO1xuXHRcdGZvciAobGV0IHZhbHVlIG9mIHJlbW92ZV9saXN0KSB7XG5cdFx0XHRsZXQgW2ZvdW5kLCBpZHhdID0gdGhpcy5pbmRleE9mKHZhbHVlKTtcblx0XHRcdGlmIChmb3VuZCkge1xuXHRcdFx0XHRyZW1vdmVfaWR4X2xpc3QucHVzaChpZHgpO1xuXHRcdFx0fVx0XHRcblx0XHR9XG5cdFx0Zm9yIChsZXQgaWR4IG9mIHJlbW92ZV9pZHhfbGlzdCkge1xuXHRcdFx0dGhpcy5fYXJyYXlbaWR4XSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0bGV0IGFueV9yZW1vdmVzID0gcmVtb3ZlX2lkeF9saXN0Lmxlbmd0aCA+IDA7XG5cblx0XHQvKlxuXHRcdFx0aW5zZXJ0XG5cblx0XHRcdGluc2VydCBtaWdodCBpbnRyb2R1Y2UgZHVwbGljYXRpb25zLCBlaXRoZXIgYmVjYXVzZVxuXHRcdFx0dGhlIGluc2VydCBsaXN0IGluY2x1ZGVzIGR1cGxpY2F0ZXMsIG9yIGJlY2F1c2UgdGhlXG5cdFx0XHRpbnNlcnQgbGlzdCBkdXBsaWNhdGVzIHByZWV4aXN0aW5nIHZhbHVlcy5cblxuXHRcdFx0SW5zdGVhZCBvZiBsb29raW5nIHVwIGFuZCBjaGVja2luZyBlYWNoIGluc2VydCB2YWx1ZSxcblx0XHRcdHdlIGluc3RlYWQgaW5zZXJ0IGV2ZXJ5dGhpbmcgYXQgdGhlIGVuZCBvZiB0aGUgYXJyYXksXG5cdFx0XHRhbmQgcmVtb3ZlIGR1cGxpY2F0ZXMgb25seSBhZnRlciB3ZSBoYXZlIHNvcnRlZC5cblx0XHQqL1xuXHRcdGxldCBhbnlfaW5zZXJ0cyA9IGluc2VydF9saXN0Lmxlbmd0aCA+IDA7XG5cdFx0aWYgKGFueV9pbnNlcnRzKSB7XG5cdFx0XHRjb25jYXRfaW5fcGxhY2UodGhpcy5fYXJyYXksIGluc2VydF9saXN0KTtcblx0XHR9XG5cblx0XHQvKlxuXHRcdFx0c29ydFxuXHRcdFx0dGhpcyBwdXNoZXMgYW55IHVuZGVmaW5lZCB2YWx1ZXMgdG8gdGhlIGVuZCBcblx0XHQqL1xuXHRcdGlmIChhbnlfcmVtb3ZlcyB8fCBhbnlfaW5zZXJ0cykge1xuXHRcdFx0dGhpcy5fYXJyYXkuc29ydChjbXApO1xuXHRcdH1cblxuXHRcdC8qXG5cdFx0XHRyZW1vdmUgdW5kZWZpbmVkIFxuXHRcdFx0YWxsIHVuZGVmaW5lZCB2YWx1ZXMgYXJlIHB1c2hlZCB0byB0aGUgZW5kXG5cdFx0Ki9cblx0XHRpZiAoYW55X3JlbW92ZXMpIHtcblx0XHRcdHRoaXMuX2FycmF5Lmxlbmd0aCAtPSByZW1vdmVfaWR4X2xpc3QubGVuZ3RoO1xuXHRcdH1cblxuXHRcdC8qXG5cdFx0XHRyZW1vdmUgZHVwbGljYXRlcyBmcm9tIHNvcnRlZCBhcnJheVxuXHRcdFx0LSBhc3N1bWluZyB0aGVyZSBhcmUgZ29pbmcgdG8gYmUgZmV3IGR1cGxpY2F0ZXMsXG5cdFx0XHQgIGl0IGlzIG9rIHRvIHJlbW92ZSB0aGVtIG9uZSBieSBvbmVcblxuXHRcdCovXG5cdFx0aWYgKGFueV9pbnNlcnRzKSB7XG5cdFx0XHRyZW1vdmVfZHVwbGljYXRlcyh0aGlzLl9hcnJheSk7XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRnZXQgZWxlbWVudCBieSBpbmRleFxuXHQqL1xuXHRnZXRfYnlfaW5kZXgoaWR4KSB7XG5cdFx0aWYgKGlkeCA+IC0xICYmIGlkeCA8IHRoaXMuX2FycmF5Lmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FycmF5W2lkeF07XG5cdFx0fVxuXHR9XG5cblx0Lypcblx0XHRsb29rdXAgdmFsdWVzIHdpdGhpbiBpbnRlcnZhbFxuXHQqL1xuXHRsb29rdXAoaXR2KSB7XG5cdFx0aWYgKGl0diA9PSB1bmRlZmluZWQpIHtcblx0XHRcdGl0diA9IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXTtcblx0XHR9XG5cdFx0bGV0IFtwMCwgcDFdID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdHYpO1xuXHRcdGxldCBwMF9pZHggPSB0aGlzLmdlSW5kZXhPZihwMCk7XG5cdFx0bGV0IHAxX2lkeCA9IHRoaXMubGVJbmRleE9mKHAxKTtcblx0XHRpZiAocDBfaWR4ID09IC0xIHx8IHAxX2lkeCA9PSAtMSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fYXJyYXkuc2xpY2UocDBfaWR4LCBwMV9pZHgrMSk7XG5cdFx0fVxuXHR9XG5cblx0bHQgKG9mZnNldCkge1xuXHRcdHJldHVybiB0aGlzLmdldF9ieV9pbmRleCh0aGlzLmx0SW5kZXhPZihvZmZzZXQpKTtcblx0fVxuXHRsZSAob2Zmc2V0KSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0X2J5X2luZGV4KHRoaXMubGVJbmRleE9mKG9mZnNldCkpO1xuXHR9XG5cdGdldCAob2Zmc2V0KSB7XG5cdFx0bGV0IFtmb3VuZCwgaWR4XSA9IHRoaXMuaW5kZXhPZihvZmZzZXQpO1xuXHRcdGlmIChmb3VuZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2FycmF5W2lkeF07XG5cdFx0fSBcblx0fVxuXHRndCAob2Zmc2V0KSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0X2J5X2luZGV4KHRoaXMuZ3RJbmRleE9mKG9mZnNldCkpO1xuXHR9XG5cdGdlIChvZmZzZXQpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRfYnlfaW5kZXgodGhpcy5nZUluZGV4T2Yob2Zmc2V0KSk7XG5cdH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG5cdFVUSUxTXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbi8qXG5cdENvbmNhdGluYXRlIHR3byBhcnJheXMgYnkgYXBwZW5kaW5nIHRoZSBzZWNvbmQgYXJyYXkgdG8gdGhlIGZpcnN0IGFycmF5LiBcbiovXG5cbmZ1bmN0aW9uIGNvbmNhdF9pbl9wbGFjZShmaXJzdF9hcnIsIHNlY29uZF9hcnIpIHtcblx0Y29uc3QgZmlyc3RfYXJyX2xlbmd0aCA9IGZpcnN0X2Fyci5sZW5ndGg7XG5cdGNvbnN0IHNlY29uZF9hcnJfbGVuZ3RoID0gc2Vjb25kX2Fyci5sZW5ndGg7XG4gIFx0Zmlyc3RfYXJyLmxlbmd0aCArPSBzZWNvbmRfYXJyX2xlbmd0aDtcbiAgXHRmb3IgKGxldCBpID0gMDsgaSA8IHNlY29uZF9hcnJfbGVuZ3RoOyBpKyspIHtcbiAgICBcdGZpcnN0X2FycltmaXJzdF9hcnJfbGVuZ3RoICsgaV0gPSBzZWNvbmRfYXJyW2ldO1xuICBcdH1cbn1cblxuLypcblx0cmVtb3ZlIGR1cGxpY2F0ZXMgaW4gYSBzb3J0ZWQgYXJyYXlcbiovXG5mdW5jdGlvbiByZW1vdmVfZHVwbGljYXRlcyhzb3J0ZWRfYXJyKSB7XG5cdGxldCBpID0gMDtcblx0d2hpbGUgKHRydWUpIHtcblx0XHRpZiAoaSArIDEgPj0gc29ydGVkX2Fyci5sZW5ndGgpIHtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRpZiAoc29ydGVkX2FycltpXSA9PSBzb3J0ZWRfYXJyW2kgKyAxXSkge1xuXHRcdFx0c29ydGVkX2Fyci5zcGxpY2UoaSArIDEsIDEpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpICs9IDE7XG5cdFx0fVxuXHR9XG59XG4iLCJpbXBvcnQgeyBlbmRwb2ludCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlLCBuZWFyYnlfZnJvbSB9IGZyb20gXCIuL25lYXJieWluZGV4X2Jhc2UuanNcIjtcbmltcG9ydCB7IFNvcnRlZEFycmF5IH0gZnJvbSBcIi4vc29ydGVkYXJyYXkuanNcIjtcbmltcG9ydCB7IGlzX3N0YXRlcHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyLmpzXCI7XG5cbi8vIFNldCBvZiB1bmlxdWUgW3ZhbHVlLCBzaWduXSBlbmRwb2ludHNcbmNsYXNzIEVuZHBvaW50U2V0IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5fbWFwID0gbmV3IE1hcChbXG5cdFx0XHRbLTEsIG5ldyBTZXQoKV0sIFxuXHRcdFx0WzAsIG5ldyBTZXQoKV0sIFxuXHRcdFx0WzEsIG5ldyBTZXQoKV1cblx0XHRdKTtcblx0fVxuXHRhZGQoW3ZhbHVlLCBzaWduXSkge1xuXHRcdHJldHVybiB0aGlzLl9tYXAuZ2V0KHNpZ24pLmFkZCh2YWx1ZSk7XG5cdH1cblx0aGFzIChbdmFsdWUsIHNpZ25dKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21hcC5nZXQoc2lnbikuaGFzKHZhbHVlKTtcblx0fVxuXHRnZXQoW3ZhbHVlLCBzaWduXSkge1xuXHRcdHJldHVybiB0aGlzLl9tYXAuZ2V0KHNpZ24pLmdldCh2YWx1ZSk7XG5cdH1cblxuXHRsaXN0KCkge1xuXHRcdGNvbnN0IGxpc3RzID0gWy0xLCAwLCAxXS5tYXAoKHNpZ24pID0+IHtcblx0XHRcdHJldHVybiBbLi4udGhpcy5fbWFwLmdldChzaWduKS52YWx1ZXMoKV1cblx0XHRcdFx0Lm1hcCgodmFsKSA9PiBbdmFsLCBzaWduXSk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIFtdLmNvbmNhdCguLi5saXN0cyk7XG5cdH1cbn1cblxuLyoqXG4gKiBJVEVNUyBNQVBcbiAqIFxuICogbWFwcGluZyBlbmRwb2ludCAtPiBbW2l0ZW0sIHN0YXR1c10sLi4uXVxuICogc3RhdHVzOiBlbmRwb2ludCBpcyBlaXRoZXIgTE9XLEhJR0ggb3IgQ09WRVJFRCBmb3IgYSBnaXZlbiBpdGVtLlxuICovXG5cblxuY29uc3QgTE9XID0gXCJsb3dcIjtcbmNvbnN0IEFDVElWRSA9IFwiYWN0aXZlXCI7XG5jb25zdCBISUdIID0gXCJoaWdoXCI7XG5cbmNsYXNzIEl0ZW1zTWFwIHtcblxuXHRjb25zdHJ1Y3RvciAoKSB7XG5cdFx0Ly8gbWFwIGVuZHBvaW50IC0+IHtsb3c6IFtpdGVtc10sIGFjdGl2ZTogW2l0ZW1zXSwgaGlnaDpbaXRlbXNdfVxuXHRcdHRoaXMuX21hcCA9IG5ldyBNYXAoW1xuXHRcdFx0Wy0xLCBuZXcgTWFwKCldLCBcblx0XHRcdFswLCBuZXcgTWFwKCldLCBcblx0XHRcdFsxLCBuZXcgTWFwKCldXG5cdFx0XSk7XG5cdH1cblxuXHRnZXRfaXRlbXNfYnlfcm9sZSAoW3ZhbHVlLCBzaWduXSwgcm9sZSkge1xuXHRcdGNvbnN0IGVudHJ5ID0gdGhpcy5fbWFwLmdldChzaWduKS5nZXQodmFsdWUpO1xuXHRcdHJldHVybiAoZW50cnkgIT0gdW5kZWZpbmVkKSA/IGVudHJ5W3JvbGVdIDogW107XG5cdH1cblxuXHQvKlxuXHRcdHJlZ2lzdGVyIGl0ZW0gd2l0aCBlbmRwb2ludCAoaWRlbXBvdGVudClcblx0XHRyZXR1cm4gdHJ1ZSBpZiB0aGlzIHdhcyB0aGUgZmlyc3QgTE9XIG9yIEhJR0ggXG5cdCAqL1xuXHRyZWdpc3RlcihbdmFsdWUsIHNpZ25dLCBpdGVtLCByb2xlKSB7XG5cdFx0Y29uc3Qgc2lnbl9tYXAgPSB0aGlzLl9tYXAuZ2V0KHNpZ24pO1xuXHRcdGlmICghc2lnbl9tYXAuaGFzKHZhbHVlKSkge1xuXHRcdFx0c2lnbl9tYXAuc2V0KHZhbHVlLCB7bG93OiBbXSwgYWN0aXZlOltdLCBoaWdoOltdfSk7XG5cdFx0fVxuXHRcdGNvbnN0IGVudHJ5ID0gc2lnbl9tYXAuZ2V0KHZhbHVlKTtcblx0XHRjb25zdCB3YXNfZW1wdHkgPSBlbnRyeVtMT1ddLmxlbmd0aCArIGVudHJ5W0hJR0hdLmxlbmd0aCA9PSAwO1xuXHRcdGxldCBpZHggPSBlbnRyeVtyb2xlXS5maW5kSW5kZXgoKF9pdGVtKSA9PiB7XG5cdFx0XHRyZXR1cm4gX2l0ZW0uaWQgPT0gaXRlbS5pZDtcblx0XHR9KTtcblx0XHRpZiAoaWR4ID09IC0xKSB7XG5cdFx0XHRlbnRyeVtyb2xlXS5wdXNoKGl0ZW0pO1xuXHRcdH1cblx0XHRjb25zdCBpc19lbXB0eSA9IGVudHJ5W0xPV10ubGVuZ3RoICsgZW50cnlbSElHSF0ubGVuZ3RoID09IDA7XG5cdFx0cmV0dXJuIHdhc19lbXB0eSAmJiAhaXNfZW1wdHk7XG5cdH1cblxuXHQvKlxuXHRcdHVucmVnaXN0ZXIgaXRlbSB3aXRoIGVuZHBvaW50IChpbmRlcGVuZGVudCBvZiByb2xlKVxuXHRcdHJldHVybiB0cnVlIGlmIHRoaXMgcmVtb3ZlZCBsYXN0IExPVyBvciBISUdIXG5cdCAqL1xuXHR1bnJlZ2lzdGVyKFt2YWx1ZSwgc2lnbl0sIGl0ZW0pIHtcblx0XHRjb25zdCBzaWduX21hcCA9IHRoaXMuX21hcC5nZXQoc2lnbik7XG5cdFx0Y29uc3QgZW50cnkgPSBzaWduX21hcC5nZXQodmFsdWUpO1xuXHRcdGlmIChlbnRyeSAhPSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IHdhc19lbXB0eSA9IGVudHJ5W0xPV10ubGVuZ3RoICsgZW50cnlbSElHSF0ubGVuZ3RoID09IDA7XG5cdFx0XHQvLyByZW1vdmUgYWxsIG1lbnRpb25lcyBvZiBpdGVtXG5cdFx0XHRmb3IgKGNvbnN0IHJvbGUgb2YgW0xPVywgQUNUSVZFLCBISUdIXSkge1xuXHRcdFx0XHRsZXQgaWR4ID0gZW50cnlbcm9sZV0uZmluZEluZGV4KChfaXRlbSkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBfaXRlbS5pZCA9PSBpdGVtLmlkO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKGlkeCA+IC0xKSB7XG5cdFx0XHRcdFx0ZW50cnlbcm9sZV0uc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRcdH1cdFxuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaXNfZW1wdHkgPSBlbnRyeVtMT1ddLmxlbmd0aCArIGVudHJ5W0hJR0hdLmxlbmd0aCA9PSAwO1xuXHRcdFx0aWYgKCF3YXNfZW1wdHkgJiYgaXNfZW1wdHkpIHtcblx0XHRcdFx0Ly8gY2xlYW4gdXAgZW50cnlcblx0XHRcdFx0c2lnbl9tYXAuZGVsZXRlKHZhbHVlKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuXG5cbmV4cG9ydCBjbGFzcyBOZWFyYnlJbmRleCBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihzdGF0ZVByb3ZpZGVyKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgaWYgKCEoaXNfc3RhdGVwcm92aWRlcihzdGF0ZVByb3ZpZGVyKSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgbXVzdCBiZSBzdGF0ZXByb3ZpZGVyICR7c3RhdGVQcm92aWRlcn1gKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9zcCA9IHN0YXRlUHJvdmlkZXI7XG5cdFx0dGhpcy5faW5pdGlhbGlzZSgpO1xuXHRcdHRoaXMucmVmcmVzaCgpO1xuXHR9XG5cbiAgICBnZXQgc3JjICgpIHtyZXR1cm4gdGhpcy5fc3A7fVxuXG5cblx0X2luaXRpYWxpc2UoKSB7XG5cdFx0Ly8gcmVnaXN0ZXIgaXRlbXMgd2l0aCBlbmRwb2ludHNcblx0XHR0aGlzLl9pdGVtc21hcCA9IG5ldyBJdGVtc01hcCgpO1xuXHRcdC8vIHNvcnRlZCBpbmRleFxuXHRcdHRoaXMuX2VuZHBvaW50cyA9IG5ldyBTb3J0ZWRBcnJheSgpO1xuXHRcdC8vIHN3aXBlIGluZGV4XG5cdFx0dGhpcy5faW5kZXggPSBbXTtcblx0fVxuXG5cblx0cmVmcmVzaChkaWZmcykge1xuXG5cdFx0Y29uc3QgcmVtb3ZlX2VuZHBvaW50cyA9IG5ldyBFbmRwb2ludFNldCgpO1xuXHRcdGNvbnN0IGluc2VydF9lbmRwb2ludHMgPSBuZXcgRW5kcG9pbnRTZXQoKTtcblxuXHRcdGxldCBpbnNlcnRfaXRlbXMgPSBbXTtcblx0XHRsZXQgcmVtb3ZlX2l0ZW1zID0gW107XG5cblx0XHRpZiAoZGlmZnMgPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRpbnNlcnRfaXRlbXMgPSB0aGlzLnNyYy5nZXRfaXRlbXMoKTtcblx0XHRcdC8vIGNsZWFyIGFsbCBzdGF0ZVxuXHRcdFx0dGhpcy5faW5pdGlhbGlzZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBjb2xsZWN0IGluc2VydCBpdGVtcyBhbmQgcmVtb3ZlIGl0ZW1zXG5cdFx0XHRmb3IgKGNvbnN0IGRpZmYgb2YgZGlmZnMpIHtcblx0XHRcdFx0aWYgKGRpZmYubmV3ICE9IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGluc2VydF9pdGVtcy5wdXNoKGRpZmYubmV3KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZGlmZi5vbGQgIT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0cmVtb3ZlX2l0ZW1zLnB1c2goZGlmZi5vbGQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRcdHVucmVnaXN0ZXIgcmVtb3ZlIGl0ZW1zIGFjcm9zcyBhbGwgZW5kcG9pbnRzIFxuXHRcdFx0d2hlcmUgdGhleSB3ZXJlIHJlZ2lzdGVyZWQgKExPVywgQUNUSVZFLCBISUdIKSBcblx0XHQqL1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiByZW1vdmVfaXRlbXMpIHtcdFx0XHRcblx0XHRcdGNvbnN0IGVwcyA9IHRoaXMuX2VuZHBvaW50cy5sb29rdXAoaXRlbS5pdHYpO1xuXHRcdFx0Zm9yIChjb25zdCBlcCBvZiB0aGlzLl9lbmRwb2ludHMubG9va3VwKGl0ZW0uaXR2KSkge1xuXHRcdFx0XHQvLyBUT0RPOiBjaGVjayBpZiB0aGlzIGlzIGNvcnJlY3Rcblx0XHRcdFx0Y29uc3QgYmVjYW1lX2VtcHR5ID0gdGhpcy5faXRlbXNtYXAudW5yZWdpc3RlcihlcCwgaXRlbSk7XG5cdFx0XHRcdGlmIChiZWNhbWVfZW1wdHkpIHJlbW92ZV9lbmRwb2ludHMuYWRkKGVwKTtcblx0XHRcdH1cdFxuXHRcdH1cblxuXHRcdC8qXG5cdFx0XHRyZWdpc3RlciBuZXcgaXRlbXMgYWNyb3NzIGFsbCBlbmRwb2ludHMgXG5cdFx0XHR3aGVyZSB0aGV5IHNob3VsZCBiZSByZWdpc3RlcmVkIChMT1csIEhJR0gpIFxuXHRcdCovXG5cdFx0bGV0IGJlY2FtZV9ub25lbXB0eTtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgaW5zZXJ0X2l0ZW1zKSB7XG5cdFx0XHRjb25zdCBbbG93LCBoaWdoXSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwoaXRlbS5pdHYpO1xuXHRcdFx0YmVjYW1lX25vbmVtcHR5ID0gdGhpcy5faXRlbXNtYXAucmVnaXN0ZXIobG93LCBpdGVtLCBMT1cpO1xuXHRcdFx0aWYgKGJlY2FtZV9ub25lbXB0eSkgaW5zZXJ0X2VuZHBvaW50cy5hZGQobG93KTtcblx0XHRcdGJlY2FtZV9ub25lbXB0eSA9IHRoaXMuX2l0ZW1zbWFwLnJlZ2lzdGVyKGhpZ2gsIGl0ZW0sIEhJR0gpO1xuXHRcdFx0aWYgKGJlY2FtZV9ub25lbXB0eSkgaW5zZXJ0X2VuZHBvaW50cy5hZGQoaGlnaCk7XG5cdFx0fVxuXG5cdFx0Lypcblx0XHRcdHJlZnJlc2ggc29ydGVkIGVuZHBvaW50c1xuXHRcdFx0cG9zc2libGUgdGhhdCBhbiBlbmRwb2ludCBpcyBwcmVzZW50IGluIGJvdGggbGlzdHNcblx0XHRcdHRoaXMgaXMgcHJlc3VtYWJseSBub3QgYSBwcm9ibGVtIHdpdGggU29ydGVkQXJyYXkuXG5cdFx0Ki9cblx0XHR0aGlzLl9lbmRwb2ludHMudXBkYXRlKFxuXHRcdFx0cmVtb3ZlX2VuZHBvaW50cy5saXN0KCksIFxuXHRcdFx0aW5zZXJ0X2VuZHBvaW50cy5saXN0KClcblx0XHQpO1xuXG5cdFx0Lypcblx0XHRcdHN3aXBlIG92ZXIgdG8gZW5zdXJlIHRoYXQgYWxsIGl0ZW1zIGFyZSBhY3RpdmF0ZVxuXHRcdCovXG5cdFx0Y29uc3QgYWN0aXZlU2V0ID0gbmV3IFNldCgpO1xuXHRcdGZvciAoY29uc3QgZXAgb2YgdGhpcy5fZW5kcG9pbnRzLmFycmF5KSB7XHRcblx0XHRcdC8vIEFkZCBpdGVtcyB3aXRoIGVwIGFzIGxvdyBwb2ludFxuXHRcdFx0Zm9yIChsZXQgaXRlbSBvZiB0aGlzLl9pdGVtc21hcC5nZXRfaXRlbXNfYnlfcm9sZShlcCwgTE9XKSkge1xuXHRcdFx0XHRhY3RpdmVTZXQuYWRkKGl0ZW0pO1xuXHRcdFx0fTtcblx0XHRcdC8vIGFjdGl2YXRlIHVzaW5nIGFjdGl2ZVNldFxuXHRcdFx0Zm9yIChsZXQgaXRlbSBvZiBhY3RpdmVTZXQpIHtcblx0XHRcdFx0dGhpcy5faXRlbXNtYXAucmVnaXN0ZXIoZXAsIGl0ZW0sIEFDVElWRSk7XG5cdFx0XHR9XG5cdFx0XHQvLyBSZW1vdmUgaXRlbXMgd2l0aCBwMSBhcyBoaWdoIHBvaW50XG5cdFx0XHRmb3IgKGxldCBpdGVtIG9mIHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKGVwLCBISUdIKSkge1xuXHRcdFx0XHRhY3RpdmVTZXQuZGVsZXRlKGl0ZW0pO1xuXHRcdFx0fTtcdFxuXHRcdH1cblx0fVxuXG5cdF9jb3ZlcnMgKG9mZnNldCkge1xuXHRcdGNvbnN0IGVwMSA9IHRoaXMuX2VuZHBvaW50cy5sZShvZmZzZXQpIHx8IFstSW5maW5pdHksIDBdO1xuXHRcdGNvbnN0IGVwMiA9IHRoaXMuX2VuZHBvaW50cy5nZShvZmZzZXQpIHx8IFtJbmZpbml0eSwgMF07XG5cdFx0aWYgKGVuZHBvaW50LmVxKGVwMSwgZXAyKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2l0ZW1zbWFwLmdldF9pdGVtc19ieV9yb2xlKGVwMSwgQUNUSVZFKTtcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBnZXQgaXRlbXMgZm9yIGJvdGggZW5kcG9pbnRzXG5cdFx0XHRjb25zdCBpdGVtczEgPSB0aGlzLl9pdGVtc21hcC5nZXRfaXRlbXNfYnlfcm9sZShlcDEsIEFDVElWRSk7XG5cdFx0XHRjb25zdCBpdGVtczIgPSB0aGlzLl9pdGVtc21hcC5nZXRfaXRlbXNfYnlfcm9sZShlcDIsIEFDVElWRSk7XG5cdFx0XHQvLyByZXR1cm4gYWxsIGl0ZW1zIHRoYXQgYXJlIGFjdGl2ZSBpbiBib3RoIGVuZHBvaW50c1xuXHRcdFx0Y29uc3QgaWRTZXQgPSBuZXcgU2V0KGl0ZW1zMS5tYXAoaXRlbSA9PiBpdGVtLmlkKSk7XG5cdFx0XHRyZXR1cm4gaXRlbXMyLmZpbHRlcihpdGVtID0+IGlkU2V0LmhhcyhpdGVtLmlkKSk7XG5cdFx0fVxuXHR9XG5cbiAgICAvKlxuXHRcdG5lYXJieSAob2Zmc2V0KVxuICAgICovXG5cdG5lYXJieShvZmZzZXQpIHsgXG5cdFx0b2Zmc2V0ID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuXG5cdFx0Ly8gY2VudGVyXG5cdFx0bGV0IGNlbnRlciA9IHRoaXMuX2NvdmVycyhvZmZzZXQpXG5cdFx0Y29uc3QgY2VudGVyX2hpZ2hfbGlzdCA9IFtdO1xuXHRcdGNvbnN0IGNlbnRlcl9sb3dfbGlzdCA9IFtdO1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBjZW50ZXIpIHtcblx0XHRcdGNvbnN0IFtsb3csIGhpZ2hdID0gZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChpdGVtLml0dik7XG5cdFx0XHRjZW50ZXJfaGlnaF9saXN0LnB1c2goaGlnaCk7XG5cdFx0XHRjZW50ZXJfbG93X2xpc3QucHVzaChsb3cpOyAgICBcblx0XHR9XG5cblx0XHQvLyBwcmV2IGhpZ2hcblx0XHRsZXQgcHJldl9oaWdoID0gb2Zmc2V0O1xuXHRcdGxldCBpdGVtcztcblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0cHJldl9oaWdoID0gdGhpcy5fZW5kcG9pbnRzLmx0KHByZXZfaGlnaCkgfHwgWy1JbmZpbml0eSwgMF07XG5cdFx0XHRpZiAocHJldl9oaWdoWzBdID09IC1JbmZpbml0eSkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXHRcdFx0aXRlbXMgPSB0aGlzLl9pdGVtc21hcC5nZXRfaXRlbXNfYnlfcm9sZShwcmV2X2hpZ2gsIEhJR0gpO1xuXHRcdFx0aWYgKGl0ZW1zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBuZXh0IGxvd1xuXHRcdGxldCBuZXh0X2xvdyA9IG9mZnNldDtcblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0bmV4dF9sb3cgPSB0aGlzLl9lbmRwb2ludHMuZ3QobmV4dF9sb3cpIHx8IFtJbmZpbml0eSwgMF07XG5cdFx0XHRpZiAobmV4dF9sb3dbMF0gPT0gSW5maW5pdHkpIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHRcdGl0ZW1zID0gdGhpcy5faXRlbXNtYXAuZ2V0X2l0ZW1zX2J5X3JvbGUobmV4dF9sb3csIExPVyk7XG5cdFx0XHRpZiAoaXRlbXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBuZWFyYnlfZnJvbShcblx0XHRcdHByZXZfaGlnaCwgXG5cdFx0XHRjZW50ZXJfbG93X2xpc3QsIFxuXHRcdFx0Y2VudGVyLFxuXHRcdFx0Y2VudGVyX2hpZ2hfbGlzdCxcblx0XHRcdG5leHRfbG93XG5cdFx0KTtcblx0fVxufSIsImltcG9ydCAqIGFzIGV2ZW50aWZ5IGZyb20gXCIuL2FwaV9ldmVudGlmeS5qc1wiO1xuaW1wb3J0ICogYXMgY2FsbGJhY2sgZnJvbSBcIi4vYXBpX2NhbGxiYWNrLmpzXCI7XG5pbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuL2FwaV9zcmNwcm9wLmpzXCI7XG5pbXBvcnQgKiBhcyBzZWdtZW50IGZyb20gXCIuL3NlZ21lbnRzLmpzXCI7XG5cbmltcG9ydCB7IGludGVydmFsLCBlbmRwb2ludCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgcmFuZ2UsIHRvU3RhdGUgfSBmcm9tIFwiLi91dGlsLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleCB9IGZyb20gXCIuL25lYXJieWluZGV4LmpzXCI7XG5pbXBvcnQgeyBMb2NhbFN0YXRlUHJvdmlkZXIsIGlzX3N0YXRlcHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyLmpzXCI7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIExBWUVSXG4gKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIExheWVyIGlzIGFic3RyYWN0IGJhc2UgY2xhc3MgZm9yIExheWVyc1xuICogXG4gKiBMYXllciBpbnRlcmZhY2UgaXMgZGVmaW5lZCBieSAoaW5kZXgsIENhY2hlQ2xhc3MsIHZhbHVlRnVuYylcbiAqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXIge1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBjb25zdCB7Q2FjaGVDbGFzcz1MYXllckNhY2hlfSA9IG9wdGlvbnM7XG4gICAgICAgIGNvbnN0IHt2YWx1ZUZ1bmMsIHN0YXRlRnVuY30gPSBvcHRpb25zO1xuICAgICAgICAvLyBjYWxsYmFja3NcbiAgICAgICAgY2FsbGJhY2suYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgLy8gbGF5ZXIgcXVlcnkgYXBpXG4gICAgICAgIC8vbGF5ZXJxdWVyeS5hZGRUb0luc3RhbmNlKHRoaXMsIENhY2hlQ2xhc3MsIHt2YWx1ZUZ1bmMsIHN0YXRlRnVuY30pO1xuICAgICAgICAvLyBkZWZpbmUgY2hhbmdlIGV2ZW50XG4gICAgICAgIGV2ZW50aWZ5LmFkZFRvSW5zdGFuY2UodGhpcyk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlEZWZpbmUoXCJjaGFuZ2VcIiwge2luaXQ6dHJ1ZX0pO1xuXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIHRoaXMuX2luZGV4O1xuICAgICAgICAvLyBjYWNoZVxuICAgICAgICB0aGlzLl9DYWNoZUNsYXNzID0gQ2FjaGVDbGFzcztcbiAgICAgICAgdGhpcy5fY2FjaGVfb2JqZWN0O1xuICAgICAgICB0aGlzLl9jYWNoZV9vYmplY3RzID0gW107XG5cbiAgICAgICAgLy8gcXVlcnkgb3B0aW9uc1xuICAgICAgICB0aGlzLl9xdWVyeU9wdGlvbnMgPSB7dmFsdWVGdW5jLCBzdGF0ZUZ1bmN9O1xuICAgIH1cblxuICAgIC8vIGluZGV4XG4gICAgZ2V0IGluZGV4ICgpIHtyZXR1cm4gdGhpcy5faW5kZXh9XG4gICAgc2V0IGluZGV4IChpbmRleCkge3RoaXMuX2luZGV4ID0gaW5kZXh9XG5cbiAgICAvLyBxdWVyeU9wdGlvbnNcbiAgICBnZXQgcXVlcnlPcHRpb25zICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3F1ZXJ5T3B0aW9ucztcbiAgICB9XG5cbiAgICAvLyBjYWNoZVxuICAgIGdldCBjYWNoZSAoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jYWNoZV9vYmplY3QgPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl9jYWNoZV9vYmplY3QgPSBuZXcgdGhpcy5fQ2FjaGVDbGFzcyh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY2FjaGVfb2JqZWN0O1xuICAgIH1cblxuICAgIGdldENhY2hlICgpIHtcbiAgICAgICAgY29uc3QgY2FjaGUgPSBuZXcgdGhpcy5fQ2FjaGVDbGFzcyh0aGlzKTtcbiAgICAgICAgdGhpcy5fY2FjaGVfb2JqZWN0cy5wdXNoKGNhY2hlKTtcbiAgICAgICAgcmV0dXJuIGNhY2hlO1xuICAgIH1cblxuICAgIGNsZWFyQ2FjaGVzKCkge1xuICAgICAgICBmb3IgKGNvbnN0IGNhY2hlIG9mIHRoaXMuX2NhY2hlX29iamVjdHMpe1xuICAgICAgICAgICAgY2FjaGUuY2xlYXIoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jYWNoZS5xdWVyeShvZmZzZXQpO1xuICAgIH1cblxuICAgIHJlZ2lvbnMgKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW5kZXgucmVnaW9ucyhvcHRpb25zKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBTYW1wbGUgTGF5ZXIgYnkgdGltZWxpbmUgb2Zmc2V0IGluY3JlbWVudHNcbiAgICAgICAgcmV0dXJuIGxpc3Qgb2YgdHVwbGVzIFt2YWx1ZSwgb2Zmc2V0XVxuICAgICAgICBvcHRpb25zXG4gICAgICAgIC0gc3RhcnRcbiAgICAgICAgLSBzdG9wXG4gICAgICAgIC0gc3RlcFxuICAgICovXG4gICAgc2FtcGxlKG9wdGlvbnM9e30pIHtcbiAgICAgICAgbGV0IHtzdGFydD0tSW5maW5pdHksIHN0b3A9SW5maW5pdHksIHN0ZXA9MX0gPSBvcHRpb25zO1xuICAgICAgICBpZiAoc3RhcnQgPiBzdG9wKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IgKFwic3RvcCBtdXN0IGJlIGxhcmdlciB0aGFuIHN0YXJ0XCIsIHN0YXJ0LCBzdG9wKVxuICAgICAgICB9XG4gICAgICAgIHN0YXJ0ID0gW3N0YXJ0LCAwXTtcbiAgICAgICAgc3RvcCA9IFtzdG9wLCAwXTtcbiAgICAgICAgc3RhcnQgPSBlbmRwb2ludC5tYXgodGhpcy5pbmRleC5maXJzdCgpLCBzdGFydCk7XG4gICAgICAgIHN0b3AgPSBlbmRwb2ludC5taW4odGhpcy5pbmRleC5sYXN0KCksIHN0b3ApO1xuICAgICAgICBjb25zdCBjYWNoZSA9IHRoaXMuZ2V0Q2FjaGUoKTtcbiAgICAgICAgcmV0dXJuIHJhbmdlKHN0YXJ0WzBdLCBzdG9wWzBdLCBzdGVwLCB7aW5jbHVkZV9lbmQ6dHJ1ZX0pXG4gICAgICAgICAgICAubWFwKChvZmZzZXQpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gW2NhY2hlLnF1ZXJ5KG9mZnNldCkudmFsdWUsIG9mZnNldF07XG4gICAgICAgICAgICB9KTtcbiAgICB9XG59XG5jYWxsYmFjay5hZGRUb1Byb3RvdHlwZShMYXllci5wcm90b3R5cGUpO1xuZXZlbnRpZnkuYWRkVG9Qcm90b3R5cGUoTGF5ZXIucHJvdG90eXBlKTtcblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gKiBMQVlFUiBDQUNIRVxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBUaGlzIGltcGxlbWVudHMgYSBDYWNoZSB0byBiZSB1c2VkIHdpdGggTGF5ZXIgb2JqZWN0c1xuICogUXVlcnkgcmVzdWx0cyBhcmUgb2J0YWluZWQgZnJvbSB0aGUgY2FjaGUgb2JqZWN0cyBpbiB0aGVcbiAqIGxheWVyIGluZGV4IGFuZCBjYWNoZWQgb25seSBpZiB0aGV5IGRlc2NyaWJlIGEgc3RhdGljIHZhbHVlLiBcbiAqL1xuXG5leHBvcnQgY2xhc3MgTGF5ZXJDYWNoZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihsYXllcikge1xuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICAvLyBjYWNoZWQgbmVhcmJ5IHN0YXRlXG4gICAgICAgIHRoaXMuX25lYXJieTtcbiAgICAgICAgLy8gY2FjaGVkIHJlc3VsdFxuICAgICAgICB0aGlzLl9zdGF0ZTtcbiAgICB9XG5cbiAgICBnZXQgc3JjKCkge3JldHVybiB0aGlzLl9sYXllcn07XG5cbiAgICAvKipcbiAgICAgKiBxdWVyeSBjYWNoZVxuICAgICAqL1xuICAgIHF1ZXJ5KG9mZnNldCkge1xuICAgICAgICBjb25zdCBuZWVkX25lYXJieSA9IChcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICFpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5fbmVhcmJ5Lml0diwgb2Zmc2V0KVxuICAgICAgICApO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICAhbmVlZF9uZWFyYnkgJiYgXG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSAhPSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICF0aGlzLl9zdGF0ZS5keW5hbWljXG4gICAgICAgICkge1xuICAgICAgICAgICAgLy8gY2FjaGUgaGl0XG4gICAgICAgICAgICByZXR1cm4gey4uLnRoaXMuX3N0YXRlLCBvZmZzZXR9O1xuICAgICAgICB9XG4gICAgICAgIC8vIGNhY2hlIG1pc3NcbiAgICAgICAgaWYgKG5lZWRfbmVhcmJ5KSB7XG4gICAgICAgICAgICB0aGlzLl9uZWFyYnkgPSB0aGlzLl9sYXllci5pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgfVxuICAgICAgICAvLyBwZXJmb3JtIHF1ZXJpZXNcbiAgICAgICAgY29uc3Qgc3RhdGVzID0gdGhpcy5fbmVhcmJ5LmNlbnRlci5tYXAoKGNhY2hlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gY2FjaGUucXVlcnkob2Zmc2V0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHN0YXRlID0gdG9TdGF0ZSh0aGlzLl9uZWFyYnkuY2VudGVyLCBzdGF0ZXMsIG9mZnNldCwgdGhpcy5fbGF5ZXIucXVlcnlPcHRpb25zKVxuICAgICAgICAvLyBjYWNoZSBzdGF0ZSBvbmx5IGlmIG5vdCBkeW5hbWljXG4gICAgICAgIHRoaXMuX3N0YXRlID0gKHN0YXRlLmR5bmFtaWMpID8gdW5kZWZpbmVkIDogc3RhdGU7XG4gICAgICAgIHJldHVybiBzdGF0ZSAgICBcbiAgICB9XG5cbiAgICBjbGVhcigpIHtcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IHVuZGVmaW5lZDtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgSU5QVVQgTEFZRVJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBMYXllciB3aXRoIGEgU3RhdGVQcm92aWRlciBhcyBzcmNcbiAqL1xuXG5leHBvcnQgY2xhc3MgSW5wdXRMYXllciBleHRlbmRzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcbiAgICAgICAgY29uc3Qge3NyYywgdmFsdWVGdW5jLCBzdGF0ZUZ1bmN9ID0gb3B0aW9ucztcbiAgICAgICAgc3VwZXIoe0NhY2hlQ2xhc3M6SW5wdXRMYXllckNhY2hlLCB2YWx1ZUZ1bmMsIHN0YXRlRnVuY30pO1xuICAgICAgICAvLyBzZXR1cCBzcmMgcHJvcHRlcnR5XG4gICAgICAgIHNyY3Byb3AuYWRkVG9JbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgdGhpcy5zcmNwcm9wX3JlZ2lzdGVyKFwic3JjXCIpO1xuICAgICAgICAvLyBpbml0aWFsaXplXG4gICAgICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIH1cblxuICAgIHNyY3Byb3BfY2hlY2socHJvcE5hbWUsIHNyYykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzcmNcIikge1xuICAgICAgICAgICAgaWYgKCEoaXNfc3RhdGVwcm92aWRlcihzcmMpKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIHN0YXRlIHByb3ZpZGVyICR7c3JjfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHNyYzsgICAgXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzcmNwcm9wX29uY2hhbmdlKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleCA9PSB1bmRlZmluZWQgfHwgZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4ID0gbmV3IE5lYXJieUluZGV4KHRoaXMuc3JjKTtcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICBpZiAoZUFyZyAhPSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4LnJlZnJlc2goZUFyZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmNsZWFyQ2FjaGVzKCk7XG4gICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIpO1xuICAgICAgICB9ICAgICAgICBcbiAgICB9XG59XG5zcmNwcm9wLmFkZFRvUHJvdG90eXBlKElucHV0TGF5ZXIucHJvdG90eXBlKTtcblxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBJTlBVVCBMQVlFUiBDQUNIRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIExheWVyIHdpdGggYSBTdGF0ZVByb3ZpZGVyIHVzZXMgYSBzcGVjaWZpYyBjYWNoZSBpbXBsZW1lbnRhdGlvbi4gICAgXG5cbiAgICBUaGUgY2FjaGUgd2lsbCBpbnN0YW50aWF0ZSBzZWdtZW50cyBjb3JyZXNwb25kaW5nIHRvXG4gICAgaXRlbXMgaW4gdGhlIGluZGV4LiBcbiovXG5cbmV4cG9ydCBjbGFzcyBJbnB1dExheWVyQ2FjaGUge1xuICAgIGNvbnN0cnVjdG9yKGxheWVyKSB7XG4gICAgICAgIC8vIGxheWVyXG4gICAgICAgIHRoaXMuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIC8vIGNhY2hlZCBuZWFyYnkgb2JqZWN0XG4gICAgICAgIHRoaXMuX25lYXJieSA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2FjaGVkIHNlZ21lbnRcbiAgICAgICAgdGhpcy5fc2VnbWVudCA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBnZXQgc3JjKCkge3JldHVybiB0aGlzLl9sYXllcn07XG5cbiAgICBxdWVyeShvZmZzZXQpIHtcbiAgICAgICAgY29uc3QgY2FjaGVfbWlzcyA9IChcbiAgICAgICAgICAgIHRoaXMuX25lYXJieSA9PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICFpbnRlcnZhbC5jb3ZlcnNfcG9pbnQodGhpcy5fbmVhcmJ5Lml0diwgb2Zmc2V0KVxuICAgICAgICApO1xuICAgICAgICBpZiAoY2FjaGVfbWlzcykge1xuICAgICAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdGhpcy5fbGF5ZXIuaW5kZXgubmVhcmJ5KG9mZnNldCk7XG4gICAgICAgICAgICBsZXQge2l0diwgY2VudGVyfSA9IHRoaXMuX25lYXJieTtcbiAgICAgICAgICAgIHRoaXMuX3NlZ21lbnRzID0gY2VudGVyLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBsb2FkX3NlZ21lbnQoaXR2LCBpdGVtKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIHF1ZXJ5IHNlZ21lbnRzXG4gICAgICAgIGNvbnN0IHN0YXRlcyA9IHRoaXMuX3NlZ21lbnRzLm1hcCgoc2VnKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gc2VnLnF1ZXJ5KG9mZnNldCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdG9TdGF0ZSh0aGlzLl9zZWdtZW50cywgc3RhdGVzLCBvZmZzZXQsIHRoaXMuX2xheWVyLnF1ZXJ5T3B0aW9ucylcbiAgICB9XG5cbiAgICBjbGVhcigpIHtcbiAgICAgICAgdGhpcy5fbmVhcmJ5ID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9zZWdtZW50ID0gdW5kZWZpbmVkO1xuICAgIH1cbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExPQUQgU0VHTUVOVFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5mdW5jdGlvbiBsb2FkX3NlZ21lbnQoaXR2LCBpdGVtKSB7XG4gICAgbGV0IHt0eXBlPVwic3RhdGljXCIsIGRhdGF9ID0gaXRlbTtcbiAgICBpZiAodHlwZSA9PSBcInN0YXRpY1wiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5TdGF0aWNTZWdtZW50KGl0diwgZGF0YSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09IFwidHJhbnNpdGlvblwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgc2VnbWVudC5UcmFuc2l0aW9uU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcImludGVycG9sYXRpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuSW50ZXJwb2xhdGlvblNlZ21lbnQoaXR2LCBkYXRhKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT0gXCJtb3Rpb25cIikge1xuICAgICAgICByZXR1cm4gbmV3IHNlZ21lbnQuTW90aW9uU2VnbWVudChpdHYsIGRhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwidW5yZWNvZ25pemVkIHNlZ21lbnQgdHlwZVwiLCB0eXBlKTtcbiAgICB9XG59XG5cblxuXG4iLCJpbXBvcnQgeyBlbmRwb2ludCwgaW50ZXJ2YWwgfSBmcm9tIFwiLi4vaW50ZXJ2YWxzLmpzXCI7XG5pbXBvcnQgeyBOZWFyYnlJbmRleEJhc2UsIG5lYXJieV9mcm9tIH0gZnJvbSBcIi4uL25lYXJieWluZGV4X2Jhc2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVycy5qc1wiXG5pbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuLi9hcGlfc3JjcHJvcC5qc1wiO1xuXG5cbi8qKlxuICogQ29udmVuaWVuY2UgbWVyZ2Ugb3B0aW9uc1xuICovXG5jb25zdCBtZXJnZV9vcHRpb25zID0ge1xuICAgIHN1bToge1xuICAgICAgICB2YWx1ZUZ1bmM6IGZ1bmN0aW9uIChpbmZvKSB7XG4gICAgICAgICAgICAvLyByZXR1cm5zIHRoZSBzdW0gb2YgdmFsdWVzIG9mIGFjdGl2ZSBsYXllcnNcbiAgICAgICAgICAgIHJldHVybiBpbmZvLnN0YXRlc1xuICAgICAgICAgICAgICAgIC5tYXAoc3RhdGUgPT4gc3RhdGUudmFsdWUpIFxuICAgICAgICAgICAgICAgIC5yZWR1Y2UoKGFjYywgdmFsdWUpID0+IGFjYyArIHZhbHVlLCAwKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc3RhY2s6IHtcbiAgICAgICAgc3RhdGVGdW5jOiBmdW5jdGlvbiAoaW5mbykge1xuICAgICAgICAgICAgLy8gcmV0dXJucyB2YWx1ZXMgZnJvbSBmaXJzdCBhY3RpdmUgbGF5ZXJcbiAgICAgICAgICAgIHJldHVybiB7Li4uaW5mby5zdGF0ZXNbMF19XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGFycmF5OiB7XG4gICAgICAgIHZhbHVlRnVuYzogZnVuY3Rpb24gKGluZm8pIHtcbiAgICAgICAgICAgIC8vIHJldHVybnMgYW4gYXJyYXkgd2l0aCB2YWx1ZXMgZnJvbSBhY3RpdmUgbGF5ZXJzXG4gICAgICAgICAgICByZXR1cm4gaW5mby5zdGF0ZXMubWFwKHN0YXRlID0+IHN0YXRlLnZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuXG4vKipcbiAqIFxuICogVGhpcyBpbXBsZW1lbnRzIGEgbWVyZ2Ugb3BlcmF0aW9uIGZvciBsYXllcnMuXG4gKiBMaXN0IG9mIHNvdXJjZXMgaXMgaW1tdXRhYmxlLlxuICogXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlIChzb3VyY2VzLCBvcHRpb25zPXt9KSB7XG4gICAgY29uc3Qge3R5cGU9XCJcIn0gPSBvcHRpb25zO1xuXG4gICAgaWYgKHR5cGUgaW4gbWVyZ2Vfb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gbmV3IE1lcmdlTGF5ZXIoc291cmNlcywgbWVyZ2Vfb3B0aW9uc1t0eXBlXSlcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV3IE1lcmdlTGF5ZXIoc291cmNlcywgb3B0aW9ucyk7XG4gICAgfVxufVxuXG5cbmNsYXNzIE1lcmdlTGF5ZXIgZXh0ZW5kcyBMYXllciB7XG5cbiAgICBjb25zdHJ1Y3Rvcihzb3VyY2VzLCBvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgICAgIC8vIHNldHVwIHNvdXJjZXMgcHJvcGVydHlcbiAgICAgICAgc3JjcHJvcC5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLnNyY3Byb3BfcmVnaXN0ZXIoXCJzb3VyY2VzXCIsIHttdXRhYmxlOmZhbHNlfSk7XG4gICAgICAgIHRoaXMuc291cmNlcyA9IHNvdXJjZXM7XG4gICAgfVxuXG4gICAgc3JjcHJvcF9jaGVjayhwcm9wTmFtZSwgc291cmNlcykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzb3VyY2VzXCIpIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIHRoYXQgc291cmNlcyBpcyBhcnJheSBvZiBsYXllcnNcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShzb3VyY2VzKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgc291cmNlcyBtdXN0IGJlIGFycmF5ICR7c291cmNlc31gKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYWxsX2xheWVycyA9IHNvdXJjZXMubWFwKChlKSA9PiBlIGluc3RhbmNlb2YgTGF5ZXIpLmV2ZXJ5KGUgPT4gZSk7XG4gICAgICAgICAgICBpZiAoIWFsbF9sYXllcnMpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHNvdXJjZXMgbXVzdCBhbGwgYmUgbGF5ZXJzICR7c291cmNlc31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc291cmNlcztcbiAgICB9XG5cbiAgICBzcmNwcm9wX29uY2hhbmdlKHByb3BOYW1lLCBlQXJnKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNvdXJjZXNcIikge1xuICAgICAgICAgICAgaWYgKHRoaXMuaW5kZXggPT0gdW5kZWZpbmVkIHx8IGVBcmcgPT0gXCJyZXNldFwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRleCA9IG5ldyBNZXJnZUluZGV4KHRoaXMuc291cmNlcylcbiAgICAgICAgICAgIH0gXG4gICAgICAgICAgICB0aGlzLmNsZWFyQ2FjaGVzKCk7XG4gICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIpO1xuICAgICAgICB9XG4gICAgfVxufVxuc3JjcHJvcC5hZGRUb1Byb3RvdHlwZShNZXJnZUxheWVyLnByb3RvdHlwZSk7XG5cblxuXG4vKipcbiAqIE1lcmdpbmcgaW5kZXhlcyBmcm9tIG11bHRpcGxlIHNvdXJjZXMgaW50byBhIHNpbmdsZSBpbmRleC5cbiAqIFxuICogQSBzb3VyY2UgaXMgYW4gb2JqZWN0IHdpdGggYW4gaW5kZXguXG4gKiAtIGxheWVyIChjdXJzb3IpXG4gKiBcbiAqIFRoZSBtZXJnZWQgaW5kZXggZ2l2ZXMgYSB0ZW1wb3JhbCBzdHJ1Y3R1cmUgZm9yIHRoZVxuICogY29sbGVjdGlvbiBvZiBzb3VyY2VzLCBjb21wdXRpbmcgYSBsaXN0IG9mXG4gKiBzb3VyY2VzIHdoaWNoIGFyZSBkZWZpbmVkIGF0IGEgZ2l2ZW4gb2Zmc2V0XG4gKiBcbiAqIG5lYXJieShvZmZzZXQpLmNlbnRlciBpcyBhIGxpc3Qgb2YgaXRlbXNcbiAqIFt7aXR2LCBzcmN9XVxuICogXG4gKiBJbXBsZW1lbnRhaW9uIGlzIHN0YXRlbGVzcy5cbiAqL1xuXG5mdW5jdGlvbiBjbXBfYXNjZW5kaW5nKHAxLCBwMikge1xuICAgIHJldHVybiBlbmRwb2ludC5jbXAocDEsIHAyKVxufVxuXG5mdW5jdGlvbiBjbXBfZGVzY2VuZGluZyhwMSwgcDIpIHtcbiAgICByZXR1cm4gZW5kcG9pbnQuY21wKHAyLCBwMSlcbn1cblxuZXhwb3J0IGNsYXNzIE1lcmdlSW5kZXggZXh0ZW5kcyBOZWFyYnlJbmRleEJhc2Uge1xuXG4gICAgY29uc3RydWN0b3Ioc291cmNlcykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9zb3VyY2VzID0gc291cmNlcztcbiAgICAgICAgdGhpcy5fY2FjaGVzID0gbmV3IE1hcChzb3VyY2VzLm1hcCgoc3JjKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3NyYywgc3JjLmdldENhY2hlKCldO1xuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBvZmZzZXQgPSBlbmRwb2ludC5mcm9tX2lucHV0KG9mZnNldCk7XG4gICAgICAgIC8vIGFjY3VtdWxhdGUgbmVhcmJ5IGZyb20gYWxsIHNvdXJjZXNcbiAgICAgICAgY29uc3QgcHJldl9saXN0ID0gW10sIG5leHRfbGlzdCA9IFtdO1xuICAgICAgICBjb25zdCBjZW50ZXIgPSBbXTtcbiAgICAgICAgY29uc3QgY2VudGVyX2hpZ2hfbGlzdCA9IFtdO1xuICAgICAgICBjb25zdCBjZW50ZXJfbG93X2xpc3QgPSBbXVxuICAgICAgICBmb3IgKGxldCBzcmMgb2YgdGhpcy5fc291cmNlcykge1xuICAgICAgICAgICAgbGV0IG5lYXJieSA9IHNyYy5pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgICAgIGxldCBwcmV2X3JlZ2lvbiA9IHNyYy5pbmRleC5maW5kX3JlZ2lvbihuZWFyYnksIHtkaXJlY3Rpb246LTF9KTtcbiAgICAgICAgICAgIGxldCBuZXh0X3JlZ2lvbiA9IHNyYy5pbmRleC5maW5kX3JlZ2lvbihuZWFyYnksIHtkaXJlY3Rpb246MX0pO1xuICAgICAgICAgICAgaWYgKHByZXZfcmVnaW9uICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHByZXZfbGlzdC5wdXNoKGVuZHBvaW50LmZyb21faW50ZXJ2YWwocHJldl9yZWdpb24uaXR2KVsxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobmV4dF9yZWdpb24gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgbmV4dF9saXN0LnB1c2goZW5kcG9pbnQuZnJvbV9pbnRlcnZhbChuZXh0X3JlZ2lvbi5pdHYpWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChuZWFyYnkuY2VudGVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjZW50ZXIucHVzaCh0aGlzLl9jYWNoZXMuZ2V0KHNyYykpO1xuICAgICAgICAgICAgICAgIGxldCBbbG93LCBoaWdoXSA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobmVhcmJ5Lml0dik7XG4gICAgICAgICAgICAgICAgY2VudGVyX2hpZ2hfbGlzdC5wdXNoKGhpZ2gpO1xuICAgICAgICAgICAgICAgIGNlbnRlcl9sb3dfbGlzdC5wdXNoKGxvdyk7ICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBmaW5kIGNsb3Nlc3QgZW5kcG9pbnQgdG8gdGhlIHJpZ2h0IChub3QgaW4gY2VudGVyKVxuICAgICAgICBuZXh0X2xpc3Quc29ydChjbXBfYXNjZW5kaW5nKTtcbiAgICAgICAgY29uc3QgbmV4dF9sb3cgPSBuZXh0X2xpc3RbMF0gfHwgW0luZmluaXR5LCAwXTtcblxuICAgICAgICAvLyBmaW5kIGNsb3Nlc3QgZW5kcG9pbnQgdG8gdGhlIGxlZnQgKG5vdCBpbiBjZW50ZXIpXG4gICAgICAgIHByZXZfbGlzdC5zb3J0KGNtcF9kZXNjZW5kaW5nKTtcbiAgICAgICAgY29uc3QgcHJldl9oaWdoID0gcHJldl9saXN0WzBdIHx8IFstSW5maW5pdHksIDBdO1xuXG4gICAgICAgIHJldHVybiBuZWFyYnlfZnJvbShcbiAgICAgICAgICAgICAgICBwcmV2X2hpZ2gsIFxuICAgICAgICAgICAgICAgIGNlbnRlcl9sb3dfbGlzdCwgXG4gICAgICAgICAgICAgICAgY2VudGVyLFxuICAgICAgICAgICAgICAgIGNlbnRlcl9oaWdoX2xpc3QsXG4gICAgICAgICAgICAgICAgbmV4dF9sb3dcbiAgICAgICAgICAgICk7XG4gICAgfVxufTtcblxuXG5cbiIsImltcG9ydCB7IGVuZHBvaW50IH0gZnJvbSBcIi4uL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4uL25lYXJieWluZGV4X2Jhc2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVycy5qc1wiXG5pbXBvcnQgKiBhcyBzcmNwcm9wIGZyb20gXCIuLi9hcGlfc3JjcHJvcC5qc1wiO1xuXG5mdW5jdGlvbiBzaGlmdGVkKHAsIG9mZnNldCkge1xuICAgIGlmIChwID09IHVuZGVmaW5lZCB8fCAhaXNGaW5pdGUocCkpIHtcbiAgICAgICAgLy8gcCAtIG5vIHNrZXdcbiAgICAgICAgcmV0dXJuIHA7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBwID09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgLy8gcCBpcyBudW1iZXIgLSBza2V3XG4gICAgICAgIHJldHVybiBwICsgb2Zmc2V0O1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwKSAmJiBwLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgLy8gcCBpcyBlbmRwb2ludCAtIHNrZXcgdmFsdWVcbiAgICAgICAgbGV0IFt2YWwsIHNpZ25dID0gcDtcbiAgICAgICAgcmV0dXJuIFt2YWwgKyBvZmZzZXQsIHNpZ25dO1xuICAgIH1cbn1cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgU0hJRlQgSU5ERVhcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuY2xhc3MgU2hpZnRJbmRleCBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvciAobGF5ZXIsIHNrZXcpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgdGhpcy5fc2tldyA9IHNrZXc7XG4gICAgICAgIHRoaXMuX2NhY2hlID0gbGF5ZXIuZ2V0Q2FjaGUoKTtcblxuICAgICAgICAvLyBza2V3aW5nIGNhY2hlIG9iamVjdFxuICAgICAgICB0aGlzLl9zaGlmdGVkX2NhY2hlID0ge1xuICAgICAgICAgICAgcXVlcnk6IGZ1bmN0aW9uIChvZmZzZXQpIHtcbiAgICAgICAgICAgICAgICAvLyBza2V3IHF1ZXJ5IChuZWdhdGl2ZSkgLSBvdmVycmlkZSByZXN1bHQgb2Zmc2V0XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsuLi50aGlzLl9jYWNoZS5xdWVyeShzaGlmdGVkKG9mZnNldCwgLXRoaXMuX3NrZXcpKSwgb2Zmc2V0fTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIHNrZXdpbmcgaW5kZXgubmVhcmJ5XG4gICAgbmVhcmJ5KG9mZnNldCkge1xuICAgICAgICBvZmZzZXQgPSBlbmRwb2ludC5mcm9tX2lucHV0KG9mZnNldCk7XG4gICAgICAgIC8vIHNrZXcgcXVlcnkgKG5lZ2F0aXZlKVxuICAgICAgICBjb25zdCBuZWFyYnkgPSB0aGlzLl9sYXllci5pbmRleC5uZWFyYnkoc2hpZnRlZChvZmZzZXQsIC10aGlzLl9za2V3KSk7XG4gICAgICAgIC8vIHNrZXcgcmVzdWx0IChwb3NpdGl2ZSkgXG4gICAgICAgIGNvbnN0IGl0diA9IG5lYXJieS5pdHYuc2xpY2UoKTtcbiAgICAgICAgaXR2WzBdID0gc2hpZnRlZChuZWFyYnkuaXR2WzBdLCB0aGlzLl9za2V3KTtcbiAgICAgICAgaXR2WzFdID0gc2hpZnRlZChuZWFyYnkuaXR2WzFdLCB0aGlzLl9za2V3KVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXR2LFxuICAgICAgICAgICAgbGVmdDogc2hpZnRlZChuZWFyYnkubGVmdCwgdGhpcy5fc2tldyksXG4gICAgICAgICAgICByaWdodDogc2hpZnRlZChuZWFyYnkucmlnaHQsIHRoaXMuX3NrZXcpLFxuICAgICAgICAgICAgY2VudGVyOiBuZWFyYnkuY2VudGVyLm1hcCgoKSA9PiB0aGlzLl9zaGlmdGVkX2NhY2hlKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBTSElGVCBMQVlFUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5cbmNsYXNzIFNoaWZ0TGF5ZXIgZXh0ZW5kcyBMYXllciB7XG5cbiAgICBjb25zdHJ1Y3RvcihsYXllciwgc2tldywgb3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgICAgdGhpcy5fc2tldyA9IHNrZXc7XG4gICAgICAgIC8vIHNldHVwIHNyYyBwcm9wdGVydHlcbiAgICAgICAgc3JjcHJvcC5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLnNyY3Byb3BfcmVnaXN0ZXIoXCJzcmNcIik7XG4gICAgICAgIHRoaXMuc3JjID0gbGF5ZXI7XG4gICAgfVxuXG4gICAgc3JjcHJvcF9jaGVjayhwcm9wTmFtZSwgc3JjKSB7XG4gICAgICAgIGlmIChwcm9wTmFtZSA9PSBcInNyY1wiKSB7XG4gICAgICAgICAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBMYXllcikpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFwic3JjXCIgbXVzdCBiZSBMYXllciAke3NyY31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzcmM7ICAgIFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3JjcHJvcF9vbmNoYW5nZShwcm9wTmFtZSwgZUFyZykge1xuICAgICAgICBpZiAocHJvcE5hbWUgPT0gXCJzcmNcIikge1xuICAgICAgICAgICAgaWYgKHRoaXMuaW5kZXggPT0gdW5kZWZpbmVkIHx8IGVBcmcgPT0gXCJyZXNldFwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRleCA9IG5ldyBTaGlmdEluZGV4KHRoaXMuc3JjLCB0aGlzLl9za2V3KVxuICAgICAgICAgICAgfSBcbiAgICAgICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgICAgIHRoaXMubm90aWZ5X2NhbGxiYWNrcygpO1xuICAgICAgICAgICAgdGhpcy5ldmVudGlmeVRyaWdnZXIoXCJjaGFuZ2VcIik7ICAgIFxuICAgICAgICB9XG4gICAgfVxufVxuc3JjcHJvcC5hZGRUb1Byb3RvdHlwZShTaGlmdExheWVyLnByb3RvdHlwZSk7XG5cbi8qKlxuICogU2tld2luZyBhIExheWVyIGJ5IGFuIG9mZnNldFxuICogXG4gKiBhIHBvc2l0aXZlIHZhbHVlIGZvciBvZmZzZXQgbWVhbnMgdGhhdFxuICogdGhlIGxheWVyIGlzIHNoaWZ0ZWQgdG8gdGhlIHJpZ2h0IG9uIHRoZSB0aW1lbGluZVxuICogXG4gKiBcbiAqL1xuXG5leHBvcnQgZnVuY3Rpb24gc2hpZnQgKGxheWVyLCBvZmZzZXQpIHtcbiAgICByZXR1cm4gbmV3IFNoaWZ0TGF5ZXIobGF5ZXIsIG9mZnNldCk7XG59XG4iLCIvLyB3ZWJwYWdlIGNsb2NrIC0gcGVyZm9ybWFuY2Ugbm93IC0gc2Vjb25kc1xuY29uc3QgbG9jYWwgPSB7XG4gICAgbm93OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHBlcmZvcm1hbmNlLm5vdygpLzEwMDAuMDtcbiAgICB9XG59XG4vLyBzeXN0ZW0gY2xvY2sgLSBlcG9jaCAtIHNlY29uZHNcbmNvbnN0IGVwb2NoID0ge1xuICAgIG5vdzogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGF0ZSgpLzEwMDAuMDtcbiAgICB9XG59XG5cbi8qKlxuICogQ0xPQ0sgZ2l2ZXMgZXBvY2ggdmFsdWVzLCBidXQgaXMgaW1wbGVtZW50ZWRcbiAqIHVzaW5nIHBlcmZvcm1hbmNlIG5vdyBmb3IgYmV0dGVyXG4gKiB0aW1lIHJlc29sdXRpb24gYW5kIHByb3RlY3Rpb24gYWdhaW5zdCBzeXN0ZW0gXG4gKiB0aW1lIGFkanVzdG1lbnRzLlxuICovXG5cbmV4cG9ydCBjb25zdCBMT0NBTF9DTE9DS19QUk9WSURFUiA9IGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCB0MF9sb2NhbCA9IGxvY2FsLm5vdygpO1xuICAgIGNvbnN0IHQwX2Vwb2NoID0gZXBvY2gubm93KCk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgbm93OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjb25zdCB0MV9sb2NhbCA9IGxvY2FsLm5vdygpO1xuICAgICAgICAgICAgcmV0dXJuIHQwX2Vwb2NoICsgKHQxX2xvY2FsIC0gdDBfbG9jYWwpO1xuICAgICAgICB9XG4gICAgfTtcbn0oKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2Nsb2NrcHJvdmlkZXIob2JqKSB7XG4gICAgcmV0dXJuIChcbiAgICAgICAgKFwibm93XCIgaW4gb2JqKSAmJiB0eXBlb2YgKG9iai5ub3cgPT0gXCJmdW5jdGlvblwiKVxuICAgIClcbn0iLCJcbmltcG9ydCB7IGlzX3N0YXRlcHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyLmpzXCI7XG5jb25zdCBNRVRIT0RTID0ge2Fzc2lnbiwgbW92ZSwgdHJhbnNpdGlvbiwgaW50ZXJwb2xhdGV9O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBjbWQgKHRhcmdldCkge1xuICAgIGlmICghKGlzX3N0YXRlcHJvdmlkZXIodGFyZ2V0KSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YXJnZXQuc3JjIG11c3QgYmUgc3RhdGVwcm92aWRlciAke3RhcmdldH1gKTtcbiAgICB9XG4gICAgbGV0IGVudHJpZXMgPSBPYmplY3QuZW50cmllcyhNRVRIT0RTKVxuICAgICAgICAubWFwKChbbmFtZSwgbWV0aG9kXSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uKC4uLmFyZ3MpIHsgXG4gICAgICAgICAgICAgICAgICAgIGxldCBpdGVtcyA9IG1ldGhvZC5jYWxsKHRoaXMsIC4uLmFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGFyZ2V0LnVwZGF0ZSh7aW5zZXJ0Oml0ZW1zLCByZXNldDp0cnVlfSk7ICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuICAgIHJldHVybiBPYmplY3QuZnJvbUVudHJpZXMoZW50cmllcyk7XG59XG5cbmZ1bmN0aW9uIGFzc2lnbih2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBpdGVtID0ge1xuICAgICAgICAgICAgaXR2OiBbLUluZmluaXR5LCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdmFsdWUgICAgICAgICAgICAgICAgIFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbaXRlbV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBtb3ZlKHZlY3Rvcikge1xuICAgIGxldCBpdGVtID0ge1xuICAgICAgICBpdHY6IFstSW5maW5pdHksIEluZmluaXR5LCB0cnVlLCB0cnVlXSxcbiAgICAgICAgdHlwZTogXCJtb3Rpb25cIixcbiAgICAgICAgZGF0YTogdmVjdG9yICBcbiAgICB9XG4gICAgcmV0dXJuIFtpdGVtXTtcbn1cblxuZnVuY3Rpb24gdHJhbnNpdGlvbih2MCwgdjEsIHQwLCB0MSwgZWFzaW5nKSB7XG4gICAgbGV0IGl0ZW1zID0gW1xuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFstSW5maW5pdHksIHQwLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdjBcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgaXR2OiBbdDAsIHQxLCB0cnVlLCBmYWxzZV0sXG4gICAgICAgICAgICB0eXBlOiBcInRyYW5zaXRpb25cIixcbiAgICAgICAgICAgIGRhdGE6IHt2MCwgdjEsIHQwLCB0MSwgZWFzaW5nfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgdHlwZTogXCJzdGF0aWNcIixcbiAgICAgICAgICAgIGRhdGE6IHYxXG4gICAgICAgIH1cbiAgICBdXG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5mdW5jdGlvbiBpbnRlcnBvbGF0ZSh0dXBsZXMpIHtcbiAgICBsZXQgW3YwLCB0MF0gPSB0dXBsZXNbMF07XG4gICAgbGV0IFt2MSwgdDFdID0gdHVwbGVzW3R1cGxlcy5sZW5ndGgtMV07XG5cbiAgICBsZXQgaXRlbXMgPSBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgdDAsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwic3RhdGljXCIsXG4gICAgICAgICAgICBkYXRhOiB2MFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBpdHY6IFt0MCwgdDEsIHRydWUsIGZhbHNlXSxcbiAgICAgICAgICAgIHR5cGU6IFwiaW50ZXJwb2xhdGlvblwiLFxuICAgICAgICAgICAgZGF0YTogdHVwbGVzXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIGl0djogW3QxLCBJbmZpbml0eSwgdHJ1ZSwgdHJ1ZV0sXG4gICAgICAgICAgICB0eXBlOiBcInN0YXRpY1wiLFxuICAgICAgICAgICAgZGF0YTogdjFcbiAgICAgICAgfVxuICAgIF0gICAgXG4gICAgcmV0dXJuIGl0ZW1zO1xufVxuXG5cblxuIiwiaW1wb3J0IHtkaXZtb2R9IGZyb20gXCIuL3V0aWwuanNcIjtcblxuLypcbiAgICBUaW1lb3V0IE1vbml0b3JcblxuICAgIFRpbWVvdXQgTW9uaXRvciBpcyBzaW1pbGFyIHRvIHNldEludGVydmFsLCBpbiB0aGUgc2Vuc2UgdGhhdCBcbiAgICBpdCBhbGxvd3MgY2FsbGJhY2tzIHRvIGJlIGZpcmVkIHBlcmlvZGljYWxseSBcbiAgICB3aXRoIGEgZ2l2ZW4gZGVsYXkgKGluIG1pbGxpcykuICBcbiAgICBcbiAgICBUaW1lb3V0IE1vbml0b3IgaXMgbWFkZSB0byBzYW1wbGUgdGhlIHN0YXRlIFxuICAgIG9mIGEgZHluYW1pYyBvYmplY3QsIHBlcmlvZGljYWxseS4gRm9yIHRoaXMgcmVhc29uLCBlYWNoIGNhbGxiYWNrIGlzIFxuICAgIGJvdW5kIHRvIGEgbW9uaXRvcmVkIG9iamVjdCwgd2hpY2ggd2UgaGVyZSBjYWxsIGEgdmFyaWFibGUuIFxuICAgIE9uIGVhY2ggaW52b2NhdGlvbiwgYSBjYWxsYmFjayB3aWxsIHByb3ZpZGUgYSBmcmVzaGx5IHNhbXBsZWQgXG4gICAgdmFsdWUgZnJvbSB0aGUgdmFyaWFibGUuXG5cbiAgICBUaGlzIHZhbHVlIGlzIGFzc3VtZWQgdG8gYmUgYXZhaWxhYmxlIGJ5IHF1ZXJ5aW5nIHRoZSB2YXJpYWJsZS4gXG5cbiAgICAgICAgdi5xdWVyeSgpIC0+IHt2YWx1ZSwgZHluYW1pYywgb2Zmc2V0LCB0c31cblxuICAgIEluIGFkZGl0aW9uLCB0aGUgdmFyaWFibGUgb2JqZWN0IG1heSBzd2l0Y2ggYmFjayBhbmQgXG4gICAgZm9ydGggYmV0d2VlbiBkeW5hbWljIGFuZCBzdGF0aWMgYmVoYXZpb3IuIFRoZSBUaW1lb3V0IE1vbml0b3JcbiAgICB0dXJucyBwb2xsaW5nIG9mZiB3aGVuIHRoZSB2YXJpYWJsZSBpcyBubyBsb25nZXIgZHluYW1pYywgXG4gICAgYW5kIHJlc3VtZXMgcG9sbGluZyB3aGVuIHRoZSBvYmplY3QgYmVjb21lcyBkeW5hbWljLlxuXG4gICAgU3RhdGUgY2hhbmdlcyBhcmUgZXhwZWN0ZWQgdG8gYmUgc2lnbmFsbGVkIHRocm91Z2ggYSA8Y2hhbmdlPiBldmVudC5cblxuICAgICAgICBzdWIgPSB2Lm9uKFwiY2hhbmdlXCIsIGNhbGxiYWNrKVxuICAgICAgICB2Lm9mZihzdWIpXG5cbiAgICBDYWxsYmFja3MgYXJlIGludm9rZWQgb24gZXZlcnkgPGNoYW5nZT4gZXZlbnQsIGFzIHdlbGxcbiAgICBhcyBwZXJpb2RpY2FsbHkgd2hlbiB0aGUgb2JqZWN0IGlzIGluIDxkeW5hbWljPiBzdGF0ZS5cblxuICAgICAgICBjYWxsYmFjayh7dmFsdWUsIGR5bmFtaWMsIG9mZnNldCwgdHN9KVxuXG4gICAgRnVydGhlcm1vcmUsIGluIG9yZGVyIHRvIHN1cHBvcnQgY29uc2lzdGVudCByZW5kZXJpbmcgb2ZcbiAgICBzdGF0ZSBjaGFuZ2VzIGZyb20gbWFueSBkeW5hbWljIHZhcmlhYmxlcywgaXQgaXMgaW1wb3J0YW50IHRoYXRcbiAgICBjYWxsYmFja3MgYXJlIGludm9rZWQgYXQgdGhlIHNhbWUgdGltZSBhcyBtdWNoIGFzIHBvc3NpYmxlLCBzb1xuICAgIHRoYXQgY2hhbmdlcyB0aGF0IG9jY3VyIG5lYXIgaW4gdGltZSBjYW4gYmUgcGFydCBvZiB0aGUgc2FtZVxuICAgIHNjcmVlbiByZWZyZXNoLiBcblxuICAgIEZvciB0aGlzIHJlYXNvbiwgdGhlIFRpbWVvdXRNb25pdG9yIGdyb3VwcyBjYWxsYmFja3MgaW4gdGltZVxuICAgIGFuZCBpbnZva2VzIGNhbGxiYWNrcyBhdCBhdCBmaXhlZCBtYXhpbXVtIHJhdGUgKDIwSHovNTBtcykuXG4gICAgVGhpcyBpbXBsaWVzIHRoYXQgcG9sbGluZyBjYWxsYmFja3Mgd2lsbCBmYWxsIG9uIGEgc2hhcmVkIFxuICAgIHBvbGxpbmcgZnJlcXVlbmN5LlxuXG4gICAgQXQgdGhlIHNhbWUgdGltZSwgY2FsbGJhY2tzIG1heSBoYXZlIGluZGl2aWR1YWwgZnJlcXVlbmNpZXMgdGhhdFxuICAgIGFyZSBtdWNoIGxvd2VyIHJhdGUgdGhhbiB0aGUgbWF4aW11bSByYXRlLiBUaGUgaW1wbGVtZW50YXRpb25cbiAgICBkb2VzIG5vdCByZWx5IG9uIGEgZml4ZWQgNTBtcyB0aW1lb3V0IGZyZXF1ZW5jeSwgYnV0IGlzIHRpbWVvdXQgYmFzZWQsXG4gICAgdGh1cyB0aGVyZSBpcyBubyBwcm9jZXNzaW5nIG9yIHRpbWVvdXQgYmV0d2VlbiBjYWxsYmFja3MsIGV2ZW5cbiAgICBpZiBhbGwgY2FsbGJhY2tzIGhhdmUgbG93IHJhdGVzLlxuXG4gICAgSXQgaXMgc2FmZSB0byBkZWZpbmUgbXVsdGlwbGUgY2FsbGFiYWNrcyBmb3IgYSBzaW5nbGUgdmFyaWFibGUsIGVhY2hcbiAgICBjYWxsYmFjayB3aXRoIGEgZGlmZmVyZW50IHBvbGxpbmcgZnJlcXVlbmN5LlxuXG4gICAgb3B0aW9uc1xuICAgICAgICA8cmF0ZT4gLSBkZWZhdWx0IDUwOiBzcGVjaWZ5IG1pbmltdW0gZnJlcXVlbmN5IGluIG1zXG5cbiovXG5cblxuY29uc3QgUkFURV9NUyA9IDUwXG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIFRJTUVPVVQgTU9OSVRPUlxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKlxuICAgIEJhc2UgY2xhc3MgZm9yIFRpbWVvdXQgTW9uaXRvciBhbmQgRnJhbWVyYXRlIE1vbml0b3JcbiovXG5cbmNsYXNzIFRpbWVvdXRNb25pdG9yIHtcblxuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnM9e30pIHtcblxuICAgICAgICB0aGlzLl9vcHRpb25zID0gT2JqZWN0LmFzc2lnbih7cmF0ZTogUkFURV9NU30sIG9wdGlvbnMpO1xuICAgICAgICBpZiAodGhpcy5fb3B0aW9ucy5yYXRlIDwgUkFURV9NUykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbGxlZ2FsIHJhdGUgJHtyYXRlfSwgbWluaW11bSByYXRlIGlzICR7UkFURV9NU31gKTtcbiAgICAgICAgfVxuICAgICAgICAvKlxuICAgICAgICAgICAgbWFwXG4gICAgICAgICAgICBoYW5kbGUgLT4ge2NhbGxiYWNrLCB2YXJpYWJsZSwgZGVsYXl9XG4gICAgICAgICAgICAtIHZhcmlhYmxlOiB0YXJnZXQgZm9yIHNhbXBsaW5nXG4gICAgICAgICAgICAtIGNhbGxiYWNrOiBmdW5jdGlvbih2YWx1ZSlcbiAgICAgICAgICAgIC0gZGVsYXk6IGJldHdlZW4gc2FtcGxlcyAod2hlbiB2YXJpYWJsZSBpcyBkeW5hbWljKVxuICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zZXQgPSBuZXcgU2V0KCk7XG4gICAgICAgIC8qXG4gICAgICAgICAgICB2YXJpYWJsZSBtYXBcbiAgICAgICAgICAgIHZhcmlhYmxlIC0+IHtzdWIsIHBvbGxpbmcsIGhhbmRsZXM6W119XG4gICAgICAgICAgICAtIHN1YiBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAgICAgICAgIC0gcG9sbGluZzogdHJ1ZSBpZiB2YXJpYWJsZSBuZWVkcyBwb2xsaW5nXG4gICAgICAgICAgICAtIGhhbmRsZXM6IGxpc3Qgb2YgaGFuZGxlcyBhc3NvY2lhdGVkIHdpdGggdmFyaWFibGVcbiAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwID0gbmV3IE1hcCgpO1xuICAgICAgICAvLyB2YXJpYWJsZSBjaGFuZ2UgaGFuZGxlclxuICAgICAgICB0aGlzLl9fb252YXJpYWJsZWNoYW5nZSA9IHRoaXMuX29udmFyaWFibGVjaGFuZ2UuYmluZCh0aGlzKTtcbiAgICB9XG5cbiAgICBiaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICAgICAgLy8gcmVnaXN0ZXIgYmluZGluZ1xuICAgICAgICBsZXQgaGFuZGxlID0ge2NhbGxiYWNrLCB2YXJpYWJsZSwgZGVsYXl9O1xuICAgICAgICB0aGlzLl9zZXQuYWRkKGhhbmRsZSk7XG4gICAgICAgIC8vIHJlZ2lzdGVyIHZhcmlhYmxlXG4gICAgICAgIGlmICghdGhpcy5fdmFyaWFibGVfbWFwLmhhcyh2YXJpYWJsZSkpIHtcbiAgICAgICAgICAgIGxldCBzdWIgPSB2YXJpYWJsZS5vbihcImNoYW5nZVwiLCB0aGlzLl9fb252YXJpYWJsZWNoYW5nZSk7XG4gICAgICAgICAgICBsZXQgaXRlbSA9IHtzdWIsIHBvbGxpbmc6ZmFsc2UsIGhhbmRsZXM6IFtoYW5kbGVdfTtcbiAgICAgICAgICAgIHRoaXMuX3ZhcmlhYmxlX21hcC5zZXQodmFyaWFibGUsIGl0ZW0pO1xuICAgICAgICAgICAgLy90aGlzLl9yZWV2YWx1YXRlX3BvbGxpbmcodmFyaWFibGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLmdldCh2YXJpYWJsZSkuaGFuZGxlcy5wdXNoKGhhbmRsZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhhbmRsZTtcbiAgICB9XG5cbiAgICByZWxlYXNlKGhhbmRsZSkge1xuICAgICAgICAvLyBjbGVhbnVwXG4gICAgICAgIGxldCByZW1vdmVkID0gdGhpcy5fc2V0LmRlbGV0ZShoYW5kbGUpO1xuICAgICAgICBpZiAoIXJlbW92ZWQpIHJldHVybjtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2xlYW51cCB2YXJpYWJsZSBtYXBcbiAgICAgICAgbGV0IHZhcmlhYmxlID0gaGFuZGxlLnZhcmlhYmxlO1xuICAgICAgICBsZXQge3N1YiwgaGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IGlkeCA9IGhhbmRsZXMuaW5kZXhPZihoYW5kbGUpO1xuICAgICAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgICAgIGhhbmRsZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhhbmRsZXMubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIC8vIHZhcmlhYmxlIGhhcyBubyBoYW5kbGVzXG4gICAgICAgICAgICAvLyBjbGVhbnVwIHZhcmlhYmxlIG1hcFxuICAgICAgICAgICAgdGhpcy5fdmFyaWFibGVfbWFwLmRlbGV0ZSh2YXJpYWJsZSk7XG4gICAgICAgICAgICB2YXJpYWJsZS5vZmYoc3ViKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHZhcmlhYmxlIGVtaXRzIGEgY2hhbmdlIGV2ZW50XG4gICAgKi9cbiAgICBfb252YXJpYWJsZWNoYW5nZSAoZUFyZywgZUluZm8pIHtcbiAgICAgICAgbGV0IHZhcmlhYmxlID0gZUluZm8uc3JjO1xuICAgICAgICAvLyBkaXJlY3QgY2FsbGJhY2sgLSBjb3VsZCB1c2UgZUFyZyBoZXJlXG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgbGV0IHN0YXRlID0gZUFyZztcbiAgICAgICAgLy8gcmVldmFsdWF0ZSBwb2xsaW5nXG4gICAgICAgIHRoaXMuX3JlZXZhbHVhdGVfcG9sbGluZyh2YXJpYWJsZSwgc3RhdGUpO1xuICAgICAgICAvLyBjYWxsYmFja3NcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIGhhbmRsZS5jYWxsYmFjayhzdGF0ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBzdGFydCBvciBzdG9wIHBvbGxpbmcgaWYgbmVlZGVkXG4gICAgKi9cbiAgICBfcmVldmFsdWF0ZV9wb2xsaW5nKHZhcmlhYmxlLCBzdGF0ZSkge1xuICAgICAgICBsZXQgaXRlbSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBsZXQge3BvbGxpbmc6d2FzX3BvbGxpbmd9ID0gaXRlbTtcbiAgICAgICAgc3RhdGUgPSBzdGF0ZSB8fCB2YXJpYWJsZS5xdWVyeSgpO1xuICAgICAgICBsZXQgc2hvdWxkX2JlX3BvbGxpbmcgPSBzdGF0ZS5keW5hbWljO1xuICAgICAgICBpZiAoIXdhc19wb2xsaW5nICYmIHNob3VsZF9iZV9wb2xsaW5nKSB7XG4gICAgICAgICAgICBpdGVtLnBvbGxpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXRzKHZhcmlhYmxlKTtcbiAgICAgICAgfSBlbHNlIGlmICh3YXNfcG9sbGluZyAmJiAhc2hvdWxkX2JlX3BvbGxpbmcpIHtcbiAgICAgICAgICAgIGl0ZW0ucG9sbGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fY2xlYXJfdGltZW91dHModmFyaWFibGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICAgc2V0IHRpbWVvdXQgZm9yIGFsbCBjYWxsYmFja3MgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgKi9cbiAgICBfc2V0X3RpbWVvdXRzKHZhcmlhYmxlKSB7XG4gICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgZm9yIChsZXQgaGFuZGxlIG9mIGhhbmRsZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldF90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc2V0X3RpbWVvdXQoaGFuZGxlKSB7XG4gICAgICAgIGxldCBkZWx0YSA9IHRoaXMuX2NhbGN1bGF0ZV9kZWx0YShoYW5kbGUuZGVsYXkpO1xuICAgICAgICBsZXQgaGFuZGxlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZV90aW1lb3V0KGhhbmRsZSk7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHNldFRpbWVvdXQoaGFuZGxlciwgZGVsdGEpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIGFkanVzdCBkZWxheSBzbyB0aGF0IGlmIGZhbGxzIG9uXG4gICAgICAgIHRoZSBtYWluIHRpY2sgcmF0ZVxuICAgICovXG4gICAgX2NhbGN1bGF0ZV9kZWx0YShkZWxheSkge1xuICAgICAgICBsZXQgcmF0ZSA9IHRoaXMuX29wdGlvbnMucmF0ZTtcbiAgICAgICAgbGV0IG5vdyA9IE1hdGgucm91bmQocGVyZm9ybWFuY2Uubm93KCkpO1xuICAgICAgICBsZXQgW25vd19uLCBub3dfcl0gPSBkaXZtb2Qobm93LCByYXRlKTtcbiAgICAgICAgbGV0IFtuLCByXSA9IGRpdm1vZChub3cgKyBkZWxheSwgcmF0ZSk7XG4gICAgICAgIGxldCB0YXJnZXQgPSBNYXRoLm1heChuLCBub3dfbiArIDEpKnJhdGU7XG4gICAgICAgIHJldHVybiB0YXJnZXQgLSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBjbGVhciBhbGwgdGltZW91dHMgYXNzb2NpYXRlZCB3aXRoIHZhcmlhYmxlXG4gICAgKi9cbiAgICBfY2xlYXJfdGltZW91dHModmFyaWFibGUpIHtcbiAgICAgICAgbGV0IHtoYW5kbGVzfSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgaWYgKGhhbmRsZS50aWQgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGhhbmRsZS50aWQpO1xuICAgICAgICAgICAgICAgIGhhbmRsZS50aWQgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKlxuICAgICAgICBoYW5kbGUgdGltZW91dFxuICAgICovXG4gICAgX2hhbmRsZV90aW1lb3V0KGhhbmRsZSkge1xuICAgICAgICAvLyBkcm9wIGlmIGhhbmRsZSB0aWQgaGFzIGJlZW4gY2xlYXJlZFxuICAgICAgICBpZiAoaGFuZGxlLnRpZCA9PSB1bmRlZmluZWQpIHJldHVybjtcbiAgICAgICAgaGFuZGxlLnRpZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gY2FsbGJhY2tcbiAgICAgICAgbGV0IHt2YXJpYWJsZX0gPSBoYW5kbGU7XG4gICAgICAgIGxldCBzdGF0ZSA9IHZhcmlhYmxlLnF1ZXJ5KCk7XG4gICAgICAgIC8vIHJlc2NoZWR1bGUgdGltZW91dHMgZm9yIGNhbGxiYWNrc1xuICAgICAgICBpZiAoc3RhdGUuZHluYW1pYykge1xuICAgICAgICAgICAgdGhpcy5fc2V0X3RpbWVvdXQoaGFuZGxlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgICAgbWFrZSBzdXJlIHBvbGxpbmcgc3RhdGUgaXMgYWxzbyBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMgd291bGQgb25seSBvY2N1ciBpZiB0aGUgdmFyaWFibGVcbiAgICAgICAgICAgICAgICB3ZW50IGZyb20gcmVwb3J0aW5nIGR5bmFtaWMgdHJ1ZSB0byBkeW5hbWljIGZhbHNlLFxuICAgICAgICAgICAgICAgIHdpdGhvdXQgZW1taXR0aW5nIGEgY2hhbmdlIGV2ZW50IC0gdGh1c1xuICAgICAgICAgICAgICAgIHZpb2xhdGluZyB0aGUgYXNzdW1wdGlvbi4gVGhpcyBwcmVzZXJ2ZXNcbiAgICAgICAgICAgICAgICBpbnRlcm5hbCBpbnRlZ3JpdHkgaSB0aGUgbW9uaXRvci5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBsZXQgaXRlbSA9IHRoaXMuX3ZhcmlhYmxlX21hcC5nZXQodmFyaWFibGUpO1xuICAgICAgICAgICAgaXRlbS5wb2xsaW5nID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgLy9cbiAgICAgICAgaGFuZGxlLmNhbGxiYWNrKHN0YXRlKTtcbiAgICB9XG59XG5cblxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgRlJBTUVSQVRFIE1PTklUT1JcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuXG5jbGFzcyBGcmFtZXJhdGVNb25pdG9yIGV4dGVuZHMgVGltZW91dE1vbml0b3Ige1xuXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucz17fSkge1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgICAgdGhpcy5faGFuZGxlO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgIHRpbWVvdXRzIGFyZSBvYnNvbGV0ZVxuICAgICovXG4gICAgX3NldF90aW1lb3V0cyh2YXJpYWJsZSkge31cbiAgICBfc2V0X3RpbWVvdXQoaGFuZGxlKSB7fVxuICAgIF9jYWxjdWxhdGVfZGVsdGEoZGVsYXkpIHt9XG4gICAgX2NsZWFyX3RpbWVvdXRzKHZhcmlhYmxlKSB7fVxuICAgIF9oYW5kbGVfdGltZW91dChoYW5kbGUpIHt9XG5cbiAgICBfb252YXJpYWJsZWNoYW5nZSAoZUFyZywgZUluZm8pIHtcbiAgICAgICAgc3VwZXIuX29udmFyaWFibGVjaGFuZ2UoZUFyZywgZUluZm8pO1xuICAgICAgICAvLyBraWNrIG9mZiBjYWxsYmFjayBsb29wIGRyaXZlbiBieSByZXF1ZXN0IGFuaW1hdGlvbmZyYW1lXG4gICAgICAgIHRoaXMuX2NhbGxiYWNrKCk7XG4gICAgfVxuXG4gICAgX2NhbGxiYWNrKCkge1xuICAgICAgICAvLyBjYWxsYmFjayB0byBhbGwgdmFyaWFibGVzIHdoaWNoIHJlcXVpcmUgcG9sbGluZ1xuICAgICAgICBsZXQgdmFyaWFibGVzID0gWy4uLnRoaXMuX3ZhcmlhYmxlX21hcC5lbnRyaWVzKCldXG4gICAgICAgICAgICAuZmlsdGVyKChbdmFyaWFibGUsIGl0ZW1dKSA9PiBpdGVtLnBvbGxpbmcpXG4gICAgICAgICAgICAubWFwKChbdmFyaWFibGUsIGl0ZW1dKSA9PiB2YXJpYWJsZSk7XG4gICAgICAgIGlmICh2YXJpYWJsZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgLy8gY2FsbGJhY2tcbiAgICAgICAgICAgIGZvciAobGV0IHZhcmlhYmxlIG9mIHZhcmlhYmxlcykge1xuICAgICAgICAgICAgICAgIGxldCB7aGFuZGxlc30gPSB0aGlzLl92YXJpYWJsZV9tYXAuZ2V0KHZhcmlhYmxlKTtcbiAgICAgICAgICAgICAgICBsZXQgcmVzID0gdmFyaWFibGUucXVlcnkoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBoYW5kbGUgb2YgaGFuZGxlcykge1xuICAgICAgICAgICAgICAgICAgICBoYW5kbGUuY2FsbGJhY2socmVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBcbiAgICAgICAgICAgICAgICByZXF1ZXN0IG5leHQgY2FsbGJhY2sgYXMgbG9uZyBhcyBhdCBsZWFzdCBvbmUgdmFyaWFibGUgXG4gICAgICAgICAgICAgICAgaXMgcmVxdWlyaW5nIHBvbGxpbmdcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9oYW5kbGUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5fY2FsbGJhY2suYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIEJJTkQgUkVMRUFTRVxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5jb25zdCBtb25pdG9yID0gbmV3IFRpbWVvdXRNb25pdG9yKCk7XG5jb25zdCBmcmFtZXJhdGVfbW9uaXRvciA9IG5ldyBGcmFtZXJhdGVNb25pdG9yKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kKHZhcmlhYmxlLCBjYWxsYmFjaywgZGVsYXksIG9wdGlvbnM9e30pIHtcbiAgICBsZXQgaGFuZGxlO1xuICAgIGlmIChCb29sZWFuKHBhcnNlRmxvYXQoZGVsYXkpKSkge1xuICAgICAgICBoYW5kbGUgPSBtb25pdG9yLmJpbmQodmFyaWFibGUsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBbXCJ0aW1lb3V0XCIsIGhhbmRsZV07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaGFuZGxlID0gZnJhbWVyYXRlX21vbml0b3IuYmluZCh2YXJpYWJsZSwgY2FsbGJhY2ssIDAsIG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gW1wiZnJhbWVyYXRlXCIsIGhhbmRsZV07XG4gICAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgbGV0IFt0eXBlLCBfaGFuZGxlXSA9IGhhbmRsZTtcbiAgICBpZiAodHlwZSA9PSBcInRpbWVvdXRcIikge1xuICAgICAgICByZXR1cm4gbW9uaXRvci5yZWxlYXNlKF9oYW5kbGUpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PSBcImZyYW1lcmF0ZVwiKSB7XG4gICAgICAgIHJldHVybiBmcmFtZXJhdGVfbW9uaXRvci5yZWxlYXNlKF9oYW5kbGUpO1xuICAgIH1cbn1cblxuIiwiaW1wb3J0ICogYXMgc3JjcHJvcCBmcm9tIFwiLi9hcGlfc3JjcHJvcC5qc1wiO1xuaW1wb3J0IHsgTE9DQUxfQ0xPQ0tfUFJPVklERVIsIGlzX2Nsb2NrcHJvdmlkZXIgfSBmcm9tIFwiLi9jbG9ja3Byb3ZpZGVyLmpzXCI7XG5pbXBvcnQgeyBjbWQgfSBmcm9tIFwiLi9jbWQuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4vbGF5ZXJzLmpzXCI7XG5pbXBvcnQgeyBpbnRlcnZhbCB9IGZyb20gXCIuL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgYmluZCwgcmVsZWFzZSB9IGZyb20gXCIuL21vbml0b3IuanNcIjtcbmltcG9ydCB7IE5lYXJieUluZGV4QmFzZSB9IGZyb20gXCIuL25lYXJieWluZGV4X2Jhc2UuanNcIjtcblxuXG5cbi8qKlxuICogQ3Vyc29yIGVtdWxhdGVzIExheWVyIGludGVyZmFjZS5cbiAqIFBhcnQgb2YgdGhpcyBpcyB0byBwcm92ZSBhbiBpbmRleCBmb3IgdGhlIHRpbWVsaW5lLiBcbiAqIEhvd2V2ZXIsIHdoZW4gY29uc2lkZXJlZCBhcyBhIGxheWVyLCB0aGUgY3Vyc29yIHZhbHVlIGlzIFxuICogaW5kZXBlbmRlbnQgb2YgdGltZWxpbmUgb2Zmc2V0LCB3aGljaCBpcyB0byBzYXkgdGhhdFxuICogaXQgaGFzIHRoZSBzYW1lIHZhbHVlIGZvciBhbGwgdGltZWxpbmUgb2Zmc2V0cy5cbiAqIFxuICogVW5saWtlIG90aGVyIExheWVycywgdGhlIEN1cnNvciBkbyBub3QgYWN0dWFsbHlcbiAqIHVzZSB0aGlzIGluZGV4IHRvIHJlc29sdmUgcXVlcmllcy4gSXQgaXMgb25seSBuZWVkZWRcbiAqIGZvciBzb21lIGdlbmVyaWMgTGF5ZXIgZnVuY3Rpb25uYWxpdHksIGxpa2Ugc2FtcGxpbmcsXG4gKiB3aGljaCB1c2VzIGluZGV4LmZpcnN0KCkgYW5kIGluZGV4Lmxhc3QoKS5cbiAqL1xuXG5jbGFzcyBDdXJzb3JJbmRleCBleHRlbmRzIE5lYXJieUluZGV4QmFzZSB7XG5cbiAgICBjb25zdHJ1Y3RvcihjdXJzb3IpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fY2FjaGUgPSBjdXJzb3IuZ2V0Q2FjaGUoKTtcbiAgICB9XG5cbiAgICBuZWFyYnkob2Zmc2V0KSB7XG4gICAgICAgIC8vIGN1cnNvciBpbmRleCBpcyBkZWZpbmVkIGZvciBlbnRpcmUgdGltZWxpbmVcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGl0djogWy1JbmZpbml0eSwgSW5maW5pdHksIHRydWUsIHRydWVdLFxuICAgICAgICAgICAgY2VudGVyOiBbdGhpcy5fY2FjaGVdLFxuICAgICAgICAgICAgbGVmdDogWy1JbmZpbml0eSwgMF0sXG4gICAgICAgICAgICBwcmV2OiBbLUluZmluaXR5LCAwXSxcbiAgICAgICAgICAgIHJpZ2h0OiBbSW5maW5pdHksIDBdLFxuICAgICAgICAgICAgbmV4dDogW0luZmluaXR5LCAwXSxcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiBcbiAqIEN1cnNvciBjYWNoZSBpbXBsZW1lbnRzIHRoZSBxdWVyeSBvcGVyYXRpb24gZm9yIFxuICogdGhlIEN1cnNvciwgaWdub3JpbmcgdGhlIGdpdmVuIG9mZnNldCwgcmVwbGFjaW5nIGl0IFxuICogd2l0aCBhbiBvZmZzZXQgZnJvbSB0aGUgY3RybCBpbnN0ZWFkLiBcbiAqIFRoZSBsYXllciBjYWNoZSBpcyB1c2VkIHRvIHJlc29sdmUgdGhlIHF1ZXJ5IFxuICovXG5cbmNsYXNzIEN1cnNvckNhY2hlIHtcbiAgICBjb25zdHJ1Y3RvcihjdXJzb3IpIHtcbiAgICAgICAgdGhpcy5fY3Vyc29yID0gY3Vyc29yO1xuICAgICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX2N1cnNvci5zcmMuZ2V0Q2FjaGUoKTtcbiAgICB9XG5cbiAgICBxdWVyeSgpIHtcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gdGhpcy5fY3Vyc29yLl9nZXRfY3RybF9zdGF0ZSgpLnZhbHVlOyBcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlLnF1ZXJ5KG9mZnNldCk7XG4gICAgfVxuXG4gICAgY2xlYXIoKSB7XG4gICAgICAgIHRoaXMuX2NhY2hlLmNsZWFyKCk7XG4gICAgfVxufVxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAqIENVUlNPUlxuICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLyoqXG4gKiBcbiAqIEN1cnNvciBnbGlkZXMgYWxvbmcgYSBsYXllciBhbmQgZXhwb3NlcyB0aGUgY3VycmVudCBsYXllclxuICogdmFsdWUgYXQgYW55IHRpbWVcbiAqIC0gaGFzIG11dGFibGUgY3RybCAobG9jYWxDbG9ja1Byb3ZpZGVyIG9yIEN1cnNvcilcbiAqIC0gaGFzIG11dGFibGUgc3JjIChsYXllcilcbiAqIC0gbWV0aG9kcyBmb3IgYXNzaWduLCBtb3ZlLCB0cmFuc2l0aW9uLCBpbnRlcnBvbGF0aW9uXG4gKi9cblxuZXhwb3J0IGNsYXNzIEN1cnNvciBleHRlbmRzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKHtDYWNoZUNsYXNzOkN1cnNvckNhY2hlfSk7XG5cbiAgICAgICAgLy8gc2V0dXAgc3JjIHByb3BlcnRpZXNcbiAgICAgICAgc3JjcHJvcC5hZGRUb0luc3RhbmNlKHRoaXMpO1xuICAgICAgICB0aGlzLnNyY3Byb3BfcmVnaXN0ZXIoXCJzcmNcIik7XG4gICAgICAgIHRoaXMuc3JjcHJvcF9yZWdpc3RlcihcImN0cmxcIik7XG5cbiAgICAgICAgLy8gdGltZW91dFxuICAgICAgICB0aGlzLl90aWQ7XG4gICAgICAgIC8vIHBvbGxpbmdcbiAgICAgICAgdGhpcy5fcGlkO1xuXG4gICAgICAgIC8vIGluaXRpYWxpc2UgY3RybCwgc3JjXG4gICAgICAgIGxldCB7c3JjLCBjdHJsfSA9IG9wdGlvbnM7XG4gICAgICAgIHRoaXMuY3RybCA9IGN0cmwgfHwgTE9DQUxfQ0xPQ0tfUFJPVklERVI7XG4gICAgICAgIHRoaXMuc3JjID0gc3JjO1xuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogU1JDUFJPUDogQ1RSTCBhbmQgU1JDXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBzcmNwcm9wX2NoZWNrKHByb3BOYW1lLCBvYmopIHtcbiAgICAgICAgaWYgKHByb3BOYW1lID09IFwiY3RybFwiKSB7XG4gICAgICAgICAgICBpZiAoIShpc19jbG9ja3Byb3ZpZGVyKG9iaikgfHwgb2JqIGluc3RhbmNlb2YgQ3Vyc29yKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJjdHJsXCIgbXVzdCBiZSBjbG9ja1Byb3ZpZGVyIG9yIEN1cnNvciAke29ian1gKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHByb3BOYW1lID09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmICghKG9iaiBpbnN0YW5jZW9mIExheWVyKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgXCJzcmNcIiBtdXN0IGJlIExheWVyICR7b2JqfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuXG4gICAgc3JjcHJvcF9vbmNoYW5nZShwcm9wTmFtZSwgZUFyZykge1xuICAgICAgICB0aGlzLl9faGFuZGxlX2NoYW5nZShwcm9wTmFtZSwgZUFyZyk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBDQUxMQkFDS1xuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgX19oYW5kbGVfY2hhbmdlKG9yaWdpbiwgZUFyZykge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fdGlkKTtcbiAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLl9waWQpO1xuICAgICAgICBpZiAodGhpcy5zcmMgJiYgdGhpcy5jdHJsKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5pbmRleCA9PSB1bmRlZmluZWQgfHwgZUFyZyA9PSBcInJlc2V0XCIpIHtcbiAgICAgICAgICAgICAgICAvLyBOT1QgdXNlZCBmb3IgY3Vyc29yIHF1ZXJ5IFxuICAgICAgICAgICAgICAgIHRoaXMuaW5kZXggPSBuZXcgQ3Vyc29ySW5kZXgodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmNsZWFyQ2FjaGVzKCk7XG4gICAgICAgICAgICB0aGlzLm5vdGlmeV9jYWxsYmFja3MoKTtcbiAgICAgICAgICAgIC8vIHRyaWdnZXIgY2hhbmdlIGV2ZW50IGZvciBjdXJzb3JcbiAgICAgICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIsIHRoaXMucXVlcnkoKSk7XG4gICAgICAgICAgICAvLyBkZXRlY3QgZnV0dXJlIGNoYW5nZSBldmVudCAtIGlmIG5lZWRlZFxuICAgICAgICAgICAgdGhpcy5fX2RldGVjdF9mdXR1cmVfY2hhbmdlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBERVRFQ1QgRlVUVVJFIENIQU5HRVxuICAgICAqIFxuICAgICAqIFBST0JMRU06XG4gICAgICogXG4gICAgICogRHVyaW5nIHBsYXliYWNrIChjdXJzb3IuY3RybCBpcyBkeW5hbWljKSwgdGhlcmUgaXMgYSBuZWVkIHRvIFxuICAgICAqIGRldGVjdCB0aGUgcGFzc2luZyBmcm9tIG9uZSBzZWdtZW50IGludGVydmFsIG9mIHNyY1xuICAgICAqIHRvIHRoZSBuZXh0IC0gaWRlYWxseSBhdCBwcmVjaXNlbHkgdGhlIGNvcnJlY3QgdGltZVxuICAgICAqIFxuICAgICAqIG5lYXJieS5pdHYgKGRlcml2ZWQgZnJvbSBjdXJzb3Iuc3JjKSBnaXZlcyB0aGUgXG4gICAgICogaW50ZXJ2YWwgKGkpIHdlIGFyZSBjdXJyZW50bHkgaW4sIGkuZS4sIFxuICAgICAqIGNvbnRhaW5pbmcgdGhlIGN1cnJlbnQgb2Zmc2V0ICh2YWx1ZSBvZiBjdXJzb3IuY3RybCksIFxuICAgICAqIGFuZCAoaWkpIHdoZXJlIG5lYXJieS5jZW50ZXIgc3RheXMgY29uc3RhbnRcbiAgICAgKiBcbiAgICAgKiBUaGUgZXZlbnQgdGhhdCBuZWVkcyB0byBiZSBkZXRlY3RlZCBpcyB0aGVyZWZvcmUgdGhlXG4gICAgICogbW9tZW50IHdoZW4gd2UgbGVhdmUgdGhpcyBpbnRlcnZhbCwgdGhyb3VnaCBlaXRoZXJcbiAgICAgKiB0aGUgbG93IG9yIGhpZ2ggaW50ZXJ2YWwgZW5kcG9pbnRcbiAgICAgKiBcbiAgICAgKiBHT0FMOlxuICAgICAqIFxuICAgICAqIEF0IHRoaXMgbW9tZW50LCB3ZSBzaW1wbHkgbmVlZCB0byByZWV2YWx1YXRlIHRoZSBzdGF0ZSAocXVlcnkpIGFuZFxuICAgICAqIGVtaXQgYSBjaGFuZ2UgZXZlbnQgdG8gbm90aWZ5IG9ic2VydmVycy4gXG4gICAgICogXG4gICAgICogQVBQUk9BQ0hFUzpcbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbMF0gXG4gICAgICogVGhlIHRyaXZpYWwgc29sdXRpb24gaXMgdG8gZG8gbm90aGluZywgaW4gd2hpY2ggY2FzZVxuICAgICAqIG9ic2VydmVycyB3aWxsIHNpbXBseSBmaW5kIG91dCB0aGVtc2VsdmVzIGFjY29yZGluZyB0byB0aGVpciBcbiAgICAgKiBvd24gcG9sbCBmcmVxdWVuY3kuIFRoaXMgaXMgc3Vib3B0aW1hbCwgcGFydGljdWxhcmx5IGZvciBsb3cgZnJlcXVlbmN5IFxuICAgICAqIG9ic2VydmVycy4gSWYgdGhlcmUgaXMgYXQgbGVhc3Qgb25lIGhpZ2gtZnJlcXVlbmN5IHBvbGxlciwgXG4gICAgICogdGhpcyB3b3VsZCB0cmlnZ2VyIHRyaWdnZXIgdGhlIHN0YXRlIGNoYW5nZSwgY2F1c2luZyBhbGxcbiAgICAgKiBvYnNlcnZlcnMgdG8gYmUgbm90aWZpZWQuIFRoZSBwcm9ibGVtIHRob3VnaCwgaXMgaWYgbm8gb2JzZXJ2ZXJzXG4gICAgICogYXJlIGFjdGl2ZWx5IHBvbGxpbmcsIGJ1dCBvbmx5IGRlcGVuZGluZyBvbiBjaGFuZ2UgZXZlbnRzLlxuICAgICAqIFxuICAgICAqIEFwcHJvYWNoIFsxXSBcbiAgICAgKiBJbiBjYXNlcyB3aGVyZSB0aGUgY3RybCBpcyBkZXRlcm1pbmlzdGljLCBhIHRpbWVvdXRcbiAgICAgKiBjYW4gYmUgY2FsY3VsYXRlZC4gVGhpcyBpcyB0cml2aWFsIGlmIGN0cmwgaXMgYSBDbG9ja1Byb3ZpZGVyLCBhbmRcbiAgICAgKiBpdCBpcyBmYWlybHkgZWFzeSBpZiB0aGUgY3RybCBpcyBDdXJzb3IgcmVwcmVzZW50aW5nIG1vdGlvblxuICAgICAqIG9yIGxpbmVhciB0cmFuc2l0aW9uLiBIb3dldmVyLCBjYWxjdWxhdGlvbnMgY2FuIGJlY29tZSBtb3JlXG4gICAgICogY29tcGxleCBpZiBtb3Rpb24gc3VwcG9ydHMgYWNjZWxlcmF0aW9uLCBvciBpZiB0cmFuc2l0aW9uc1xuICAgICAqIGFyZSBzZXQgdXAgd2l0aCBub24tbGluZWFyIGVhc2luZy5cbiAgICAgKiAgIFxuICAgICAqIE5vdGUsIGhvd2V2ZXIsIHRoYXQgdGhlc2UgY2FsY3VsYXRpb25zIGFzc3VtZSB0aGF0IHRoZSBjdXJzb3IuY3RybCBpcyBcbiAgICAgKiBhIENsb2NrUHJvdmlkZXIsIG9yIHRoYXQgY3Vyc29yLmN0cmwuY3RybCBpcyBhIENsb2NrUHJvaWRlci4gXG4gICAgICogSW4gcHJpbmNpcGxlLCB0aG91Z2gsIHRoZXJlIGNvdWxkIGJlIGEgcmVjdXJzaXZlIGNoYWluIG9mIGN1cnNvcnMsXG4gICAgICogKGN1cnNvci5jdHJsLmN0cmwuLi4uY3RybCkgb2Ygc29tZSBsZW5ndGgsIHdoZXJlIG9ubHkgdGhlIGxhc3QgaXMgYSBcbiAgICAgKiBDbG9ja1Byb3ZpZGVyLiBJbiBvcmRlciB0byBkbyBkZXRlcm1pbmlzdGljIGNhbGN1bGF0aW9ucyBpbiB0aGUgZ2VuZXJhbFxuICAgICAqIGNhc2UsIGFsbCBjdXJzb3JzIGluIHRoZSBjaGFpbiB3b3VsZCBoYXZlIHRvIGJlIGxpbWl0ZWQgdG8gXG4gICAgICogZGV0ZXJtaW5pc3RpYyBsaW5lYXIgdHJhbnNmb3JtYXRpb25zLlxuICAgICAqIFxuICAgICAqIEFwcHJvY2ggWzJdIFxuICAgICAqIEl0IG1pZ2h0IGFsc28gYmUgcG9zc2libGUgdG8gc2FtcGxlIGZ1dHVyZSB2YWx1ZXMgb2YgXG4gICAgICogY3Vyc29yLmN0cmwgdG8gc2VlIGlmIHRoZSB2YWx1ZXMgdmlvbGF0ZSB0aGUgbmVhcmJ5Lml0diBhdCBzb21lIHBvaW50LiBcbiAgICAgKiBUaGlzIHdvdWxkIGVzc2VudGlhbGx5IGJlIHRyZWF0aW5nIGN0cmwgYXMgYSBsYXllciBhbmQgc2FtcGxpbmcgXG4gICAgICogZnV0dXJlIHZhbHVlcy4gVGhpcyBhcHByb2NoIHdvdWxkIHdvcmsgZm9yIGFsbCB0eXBlcywgXG4gICAgICogYnV0IHRoZXJlIGlzIG5vIGtub3dpbmcgaG93IGZhciBpbnRvIHRoZSBmdXR1cmUgb25lIFxuICAgICAqIHdvdWxkIGhhdmUgdG8gc2Vlay4gSG93ZXZlciwgYWdhaW4gLSBhcyBpbiBbMV0gdGhlIGFiaWxpdHkgdG8gc2FtcGxlIGZ1dHVyZSB2YWx1ZXNcbiAgICAgKiBpcyBwcmVkaWNhdGVkIG9uIGN1cnNvci5jdHJsIGJlaW5nIGEgQ2xvY2tQcm92aWRlci4gQWxzbywgdGhlcmUgXG4gICAgICogaXMgbm8gd2F5IG9mIGtub3dpbmcgaG93IGxvbmcgaW50byB0aGUgZnV0dXJlIHNhbXBsaW5nIHdvdWxkIGJlIG5lY2Vzc2FyeS5cbiAgICAgKiBcbiAgICAgKiBBcHByb2FjaCBbM10gXG4gICAgICogSW4gdGhlIGdlbmVyYWwgY2FzZSwgdGhlIG9ubHkgd2F5IHRvIHJlbGlhYmxleSBkZXRlY3QgdGhlIGV2ZW50IGlzIHRocm91Z2ggcmVwZWF0ZWRcbiAgICAgKiBwb2xsaW5nLiBBcHByb2FjaCBbM10gaXMgc2ltcGx5IHRoZSBpZGVhIHRoYXQgdGhpcyBwb2xsaW5nIGlzIHBlcmZvcm1lZFxuICAgICAqIGludGVybmFsbHkgYnkgdGhlIGN1cnNvciBpdHNlbGYsIGFzIGEgd2F5IG9mIHNlY3VyaW5nIGl0cyBvd24gY29uc2lzdGVudFxuICAgICAqIHN0YXRlLCBhbmQgZW5zdXJpbmcgdGhhdCBvYnNlcnZlciBnZXQgY2hhbmdlIGV2ZW50cyBpbiBhIHRpbWVseSBtYW5uZXIsIGV2ZW50XG4gICAgICogaWYgdGhleSBkbyBsb3ctZnJlcXVlbmN5IHBvbGxpbmcsIG9yIGRvIG5vdCBkbyBwb2xsaW5nIGF0IGFsbC4gXG4gICAgICogXG4gICAgICogU09MVVRJT046XG4gICAgICogQXMgdGhlcmUgaXMgbm8gcGVyZmVjdCBzb2x1dGlvbiBpbiB0aGUgZ2VuZXJhbCBjYXNlLCB3ZSBvcHBvcnR1bmlzdGljYWxseVxuICAgICAqIHVzZSBhcHByb2FjaCBbMV0gd2hlbiB0aGlzIGlzIHBvc3NpYmxlLiBJZiBub3QsIHdlIGFyZSBmYWxsaW5nIGJhY2sgb24gXG4gICAgICogYXBwcm9hY2ggWzNdXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIE5PIGV2ZW50IGRldGVjdGlvbiBpcyBuZWVkZWQgKE5PT1ApXG4gICAgICogKGkpIGN1cnNvci5jdHJsIGlzIG5vdCBkeW5hbWljXG4gICAgICogb3JcbiAgICAgKiAoaWkpIG5lYXJieS5pdHYgc3RyZXRjaGVzIGludG8gaW5maW5pdHkgaW4gYm90aCBkaXJlY3Rpb25zXG4gICAgICogXG4gICAgICogQ09ORElUSU9OUyB3aGVuIGFwcHJvYWNoIFsxXSBjYW4gYmUgdXNlZFxuICAgICAqIFxuICAgICAqIChpKSBpZiBjdHJsIGlzIGEgQ2xvY2tQcm92aWRlciAmJiBuZWFyYnkuaXR2LmhpZ2ggPCBJbmZpbml0eVxuICAgICAqIG9yXG4gICAgICogKGlpKSBjdHJsLmN0cmwgaXMgYSBDbG9ja1Byb3ZpZGVyXG4gICAgICogICAgICAoYSkgY3RybC5uZWFyYnkuY2VudGVyIGhhcyBleGFjdGx5IDEgaXRlbVxuICAgICAqICAgICAgJiZcbiAgICAgKiAgICAgIChiKSBjdHJsLm5lYXJieS5jZW50ZXJbMF0udHlwZSA9PSAoXCJtb3Rpb25cIikgfHwgKFwidHJhbnNpdGlvblwiICYmIGVhc2luZz09XCJsaW5lYXJcIilcbiAgICAgKiAgICAgICYmXG4gICAgICogICAgICAoYykgY3RybC5uZWFyYnkuY2VudGVyWzBdLmRhdGEudmVsb2NpdHkgIT0gMC4wXG4gICAgICogICAgICAmJiBcbiAgICAgKiAgICAgIChkKSBmdXR1cmUgaW50ZXJzZWN0b24gcG9pbnQgd2l0aCBjYWNoZS5uZWFyYnkuaXR2IFxuICAgICAqICAgICAgICAgIGlzIG5vdCAtSW5maW5pdHkgb3IgSW5maW5pdHlcbiAgICAgKiBcbiAgICAgKiBUaG91Z2ggaXQgc2VlbXMgY29tcGxleCwgY29uZGl0aW9ucyBmb3IgWzFdIHNob3VsZCBiZSBtZXQgZm9yIGNvbW1vbiBjYXNlcyBpbnZvbHZpbmdcbiAgICAgKiBwbGF5YmFjay4gQWxzbywgdXNlIG9mIHRyYW5zaXRpb24gZXRjIG1pZ2h0IGJlIHJhcmUuXG4gICAgICogXG4gICAgICovXG5cbiAgICBfX2RldGVjdF9mdXR1cmVfY2hhbmdlKCkge1xuXG4gICAgICAgIC8vIGN0cmwgXG4gICAgICAgIGNvbnN0IGN0cmxfdmVjdG9yID0gdGhpcy5fZ2V0X2N0cmxfc3RhdGUoKTtcbiAgICAgICAgY29uc3Qge3ZhbHVlOmN1cnJlbnRfcG9zLCBvZmZzZXQ6Y3VycmVudF90c30gPSBjdHJsX3ZlY3RvcjtcblxuICAgICAgICAvLyBjdHJsIG11c3QgYmUgZHluYW1pY1xuICAgICAgICBpZiAoIWN0cmxfdmVjdG9yLmR5bmFtaWMpIHtcbiAgICAgICAgICAgIC8vIG5vIGZ1dHVyZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGdldCBuZWFyYnkgZnJvbSBzcmMgLSB1c2UgdmFsdWUgZnJvbSBjdHJsXG4gICAgICAgIGNvbnN0IHNyY19uZWFyYnkgPSB0aGlzLnNyYy5pbmRleC5uZWFyYnkoY3VycmVudF9wb3MpO1xuICAgICAgICBjb25zdCBbbG93LCBoaWdoXSA9IHNyY19uZWFyYnkuaXR2LnNsaWNlKDAsMik7XG5cbiAgICAgICAgLy8gYXBwcm9hY2ggWzFdXG4gICAgICAgIGlmIChpc19jbG9ja3Byb3ZpZGVyKHRoaXMuY3RybCkpIHtcbiAgICAgICAgICAgIGlmIChpc0Zpbml0ZShoaWdoKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dChoaWdoLCBjdXJyZW50X3BvcywgMS4wLCBjdXJyZW50X3RzKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBubyBmdXR1cmUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gXG4gICAgICAgIGlmIChpc19jbG9ja3Byb3ZpZGVyKHRoaXMuY3RybC5jdHJsKSkge1xuICAgICAgICAgICAgLyoqIFxuICAgICAgICAgICAgICogdGhpcy5jdHJsIFxuICAgICAgICAgICAgICogXG4gICAgICAgICAgICAgKiBoYXMgbWFueSBwb3NzaWJsZSBiZWhhdmlvcnNcbiAgICAgICAgICAgICAqIHRoaXMuY3RybCBoYXMgYW4gaW5kZXggdXNlIHRoaXMgdG8gZmlndXJlIG91dCB3aGljaFxuICAgICAgICAgICAgICogYmVoYXZpb3VyIGlzIGN1cnJlbnQuXG4gICAgICAgICAgICAgKiBcbiAgICAgICAgICAgICovXG4gICAgICAgICAgICAvLyB1c2UgdGhlIHNhbWUgb2Zmc2V0IHRoYXQgd2FzIHVzZWQgaW4gdGhlIGN0cmwucXVlcnlcbiAgICAgICAgICAgIGNvbnN0IGN0cmxfbmVhcmJ5ID0gdGhpcy5jdHJsLmluZGV4Lm5lYXJieShjdXJyZW50X3RzKTtcblxuICAgICAgICAgICAgaWYgKCFpc0Zpbml0ZShsb3cpICYmICFpc0Zpbml0ZShoaWdoKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vIGZ1dHVyZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoY3RybF9uZWFyYnkuY2VudGVyLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY3RybF9pdGVtID0gY3RybF9uZWFyYnkuY2VudGVyWzBdO1xuICAgICAgICAgICAgICAgIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcIm1vdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHt2ZWxvY2l0eSwgYWNjZWxlcmF0aW9uPTAuMH0gPSBjdHJsX2l0ZW0uZGF0YTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFjY2VsZXJhdGlvbiA9PSAwLjApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdGFyZ2V0X3BvcyA9ICh2ZWxvY2l0eSA+IDApID8gaGlnaCA6IGxvdztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0Zpbml0ZSh0YXJnZXRfcG9zKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjsgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBubyBmdXR1cmUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gYWNjZWxlcmF0aW9uIC0gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjdHJsX2l0ZW0udHlwZSA9PSBcInRyYW5zaXRpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7djA6cDAsIHYxOnAxLCB0MCwgdDEsIGVhc2luZz1cImxpbmVhclwifSA9IGN0cmxfaXRlbS5kYXRhO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZWFzaW5nID09IFwibGluZWFyXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxpbmVhciB0cmFuc3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2ZWxvY2l0eSA9IChwMS1wMCkvKHQxLXQwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpZ3VyZSBvdXQgd2hpY2ggYm91bmRhcnkgd2UgaGl0IGZpcnN0XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRfcG9zID0gKHZlbG9jaXR5ID4gMCkgPyBNYXRoLm1pbihoaWdoLCBwMSkgOiBNYXRoLm1heChsb3csIHAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19zZXRfdGltZW91dCh0YXJnZXRfcG9zLCBjdXJyZW50X3BvcywgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVsb2NpdHksIGN1cnJlbnRfdHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBvdGhlciBlYXNpbmcgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gb3RoZXIgdHlwZSAoaW50ZXJwb2xhdGlvbikgLSBwb3NzaWJsZSBldmVudCB0byBkZXRlY3RcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIG1vcmUgdGhhbiBvbmUgc2VnbWVudCAtIHBvc3NpYmxlIGV2ZW50IHRvIGRldGVjdFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcG9zc2libGUgZXZlbnQgdG8gZGV0ZWN0IC0gYXBwcm9hY2ggWzNdXG4gICAgICAgIHRoaXMuX19zZXRfcG9sbGluZyhzcmNfbmVhcmJ5Lml0dik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc2V0IHRpbWVvdXRcbiAgICAgKiAtIHByb3RlY3RzIGFnYWluc3QgdG9vIGVhcmx5IGNhbGxiYWNrcyBieSByZXNjaGVkdWxpbmdcbiAgICAgKiB0aW1lb3V0IGlmIG5lY2Nlc3NhcnkuXG4gICAgICogLSBhZGRzIGEgbWlsbGlzZWNvbmQgdG8gb3JpZ2luYWwgdGltZW91dCB0byBhdm9pZFxuICAgICAqIGZyZXF1ZW50IHJlc2NoZWR1bGluZyBcbiAgICAgKi9cblxuICAgIF9fc2V0X3RpbWVvdXQodGFyZ2V0X3BvcywgY3VycmVudF9wb3MsIHZlbG9jaXR5LCBjdXJyZW50X3RzKSB7XG4gICAgICAgIGNvbnN0IGRlbHRhX3NlYyA9ICh0YXJnZXRfcG9zIC0gY3VycmVudF9wb3MpIC8gdmVsb2NpdHk7XG4gICAgICAgIGNvbnN0IHRhcmdldF90cyA9IGN1cnJlbnRfdHMgKyBkZWx0YV9zZWM7XG4gICAgICAgIHRoaXMuX3RpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV90aW1lb3V0KHRhcmdldF90cyk7XG4gICAgICAgIH0sIGRlbHRhX3NlYyoxMDAwICsgMSk7XG4gICAgfVxuXG4gICAgX19oYW5kbGVfdGltZW91dCh0YXJnZXRfdHMpIHtcbiAgICAgICAgY29uc3QgdHMgPSB0aGlzLl9nZXRfY3RybF9zdGF0ZSgpLm9mZnNldDtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nX3NlYyA9IHRhcmdldF90cyAtIHRzOyBcbiAgICAgICAgaWYgKHJlbWFpbmluZ19zZWMgPD0gMCkge1xuICAgICAgICAgICAgLy8gZG9uZVxuICAgICAgICAgICAgdGhpcy5fX2hhbmRsZV9jaGFuZ2UoXCJ0aW1lb3V0XCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcmVzY2hlZHVsZSB0aW1lb3V0XG4gICAgICAgICAgICB0aGlzLl90aWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9faGFuZGxlX3RpbWVvdXQodGFyZ2V0X3RzKVxuICAgICAgICAgICAgfSwgcmVtYWluaW5nX3NlYyoxMDAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNldCBwb2xsaW5nXG4gICAgICovXG5cbiAgICBfX3NldF9wb2xsaW5nKGl0dikge1xuICAgICAgICB0aGlzLl9waWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9faGFuZGxlX3BvbGwoaXR2KTtcbiAgICAgICAgfSwgMTAwKTtcbiAgICB9XG5cbiAgICBfX2hhbmRsZV9wb2xsKGl0dikge1xuICAgICAgICBsZXQgb2Zmc2V0ID0gdGhpcy5xdWVyeSgpLnZhbHVlO1xuICAgICAgICBpZiAoIWludGVydmFsLmNvdmVyc19wb2ludChpdHYsIG9mZnNldCkpIHtcbiAgICAgICAgICAgIHRoaXMuX19oYW5kbGVfY2hhbmdlKFwidGltZW91dFwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogUVVFUlkgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBfZ2V0X2N0cmxfc3RhdGUgKCkge1xuICAgICAgICBpZiAoaXNfY2xvY2twcm92aWRlcih0aGlzLmN0cmwpKSB7XG4gICAgICAgICAgICBsZXQgdHMgPSB0aGlzLmN0cmwubm93KCk7XG4gICAgICAgICAgICByZXR1cm4ge3ZhbHVlOnRzLCBkeW5hbWljOnRydWUsIG9mZnNldDp0c307XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgc3RhdGUgPSB0aGlzLmN0cmwucXVlcnkoKTtcbiAgICAgICAgICAgIC8vIHByb3RlY3QgYWdhaW5zdCBub24tZmxvYXQgdmFsdWVzXG4gICAgICAgICAgICBpZiAodHlwZW9mIHN0YXRlLnZhbHVlICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3RybCBzdGF0ZSBtdXN0IGJlIG51bWJlciAke3N0YXRlLnZhbHVlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHZhbHVlICgpIHtyZXR1cm4gdGhpcy5xdWVyeSgpLnZhbHVlfTtcbiAgICBcbiAgICAvKlxuICAgICAgICBFdmVudGlmeTogaW1tZWRpYXRlIGV2ZW50c1xuICAgICovXG4gICAgZXZlbnRpZnlJbml0RXZlbnRBcmdzKG5hbWUpIHtcbiAgICAgICAgaWYgKG5hbWUgPT0gXCJjaGFuZ2VcIikge1xuICAgICAgICAgICAgcmV0dXJuIFt0aGlzLnF1ZXJ5KCldO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogQklORCBSRUxFQVNFIChjb252ZW5pZW5jZSlcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIGJpbmQoY2FsbGJhY2ssIGRlbGF5LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHJldHVybiBiaW5kKHRoaXMsIGNhbGxiYWNrLCBkZWxheSwgb3B0aW9ucyk7XG4gICAgfVxuICAgIHJlbGVhc2UoaGFuZGxlKSB7XG4gICAgICAgIHJldHVybiByZWxlYXNlKGhhbmRsZSk7XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBVUERBVEUgQVBJXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbiAgICBhc3NpZ24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzLnNyYy5zcmMpLmFzc2lnbih2YWx1ZSk7XG4gICAgfVxuICAgIG1vdmUgKHtwb3NpdGlvbiwgdmVsb2NpdHl9KSB7XG4gICAgICAgIGxldCB7dmFsdWUsIG9mZnNldDp0aW1lc3RhbXB9ID0gdGhpcy5xdWVyeSgpO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YXJuaW5nOiBjdXJzb3Igc3RhdGUgbXVzdCBiZSBudW1iZXIgJHt2YWx1ZX1gKTtcbiAgICAgICAgfVxuICAgICAgICBwb3NpdGlvbiA9IChwb3NpdGlvbiAhPSB1bmRlZmluZWQpID8gcG9zaXRpb24gOiB2YWx1ZTtcbiAgICAgICAgdmVsb2NpdHkgPSAodmVsb2NpdHkgIT0gdW5kZWZpbmVkKSA/IHZlbG9jaXR5OiAwO1xuICAgICAgICByZXR1cm4gY21kKHRoaXMuc3JjLnNyYykubW92ZSh7cG9zaXRpb24sIHZlbG9jaXR5LCB0aW1lc3RhbXB9KTtcbiAgICB9XG4gICAgdHJhbnNpdGlvbiAoe3RhcmdldCwgZHVyYXRpb24sIGVhc2luZ30pIHtcbiAgICAgICAgbGV0IHt2YWx1ZTp2MCwgb2Zmc2V0OnQwfSA9IHRoaXMucXVlcnkoKTtcbiAgICAgICAgaWYgKHR5cGVvZiB2MCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgd2FybmluZzogY3Vyc29yIHN0YXRlIG11c3QgYmUgbnVtYmVyICR7djB9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNtZCh0aGlzLnNyYy5zcmMpLnRyYW5zaXRpb24odjAsIHRhcmdldCwgdDAsIHQwICsgZHVyYXRpb24sIGVhc2luZyk7XG4gICAgfVxuICAgIGludGVycG9sYXRlICh7dHVwbGVzLCBkdXJhdGlvbn0pIHtcbiAgICAgICAgbGV0IHQwID0gdGhpcy5xdWVyeSgpLm9mZnNldDtcbiAgICAgICAgLy8gYXNzdW1pbmcgdGltc3RhbXBzIGFyZSBpbiByYW5nZSBbMCwxXVxuICAgICAgICAvLyBzY2FsZSB0aW1lc3RhbXBzIHRvIGR1cmF0aW9uXG4gICAgICAgIHR1cGxlcyA9IHR1cGxlcy5tYXAoKFt2LHRdKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gW3YsIHQwICsgdCpkdXJhdGlvbl07XG4gICAgICAgIH0pXG4gICAgICAgIHJldHVybiBjbWQodGhpcy5zcmMuc3JjKS5pbnRlcnBvbGF0ZSh0dXBsZXMpO1xuICAgIH1cblxufVxuc3JjcHJvcC5hZGRUb1Byb3RvdHlwZShDdXJzb3IucHJvdG90eXBlKTtcbnNyY3Byb3AuYWRkVG9Qcm90b3R5cGUoQ3Vyc29yLnByb3RvdHlwZSk7XG5cbiIsImltcG9ydCB7IGludGVydmFsLCBlbmRwb2ludH0gZnJvbSBcIi4uL2ludGVydmFscy5qc1wiO1xuaW1wb3J0IHsgTmVhcmJ5SW5kZXhCYXNlIH0gZnJvbSBcIi4uL25lYXJieWluZGV4X2Jhc2UuanNcIjtcbmltcG9ydCB7IExheWVyIH0gZnJvbSBcIi4uL2xheWVycy5qc1wiXG5cbmV4cG9ydCBjbGFzcyBCb29sZWFuTGF5ZXIgZXh0ZW5kcyBMYXllciB7XG5cbiAgICBjb25zdHJ1Y3RvcihsYXllcikge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmluZGV4ID0gbmV3IEJvb2xlYW5JbmRleChsYXllci5pbmRleCk7XG4gICAgXG4gICAgICAgIC8vIHN1YnNjcmliZVxuICAgICAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5fb25jaGFuZ2UuYmluZCh0aGlzKTtcbiAgICAgICAgbGF5ZXIuYWRkX2NhbGxiYWNrKGhhbmRsZXIpO1xuICAgIH1cblxuICAgIF9vbmNoYW5nZShlQXJnKSB7XG4gICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIpO1xuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJvb2xlYW4obGF5ZXIpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xlYW5MYXllcihsYXllcik7XG59IFxuXG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICBCT09MRUFOIE5FQVJCWSBJTkRFWFxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vKipcbiAqIFdyYXBwZXIgSW5kZXggd2hlcmUgcmVnaW9ucyBhcmUgdHJ1ZS9mYWxzZSwgYmFzZWQgb24gXG4gKiBjb25kaXRpb24gb24gbmVhcmJ5LmNlbnRlci5cbiAqIEJhY2stdG8tYmFjayByZWdpb25zIHdoaWNoIGFyZSB0cnVlIGFyZSBjb2xsYXBzZWQgXG4gKiBpbnRvIG9uZSByZWdpb25cbiAqIFxuICovXG5cbmZ1bmN0aW9uIHF1ZXJ5T2JqZWN0ICh2YWx1ZSkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHF1ZXJ5OiBmdW5jdGlvbiAob2Zmc2V0KSB7XG4gICAgICAgICAgICByZXR1cm4ge3ZhbHVlLCBkeW5hbWljOmZhbHNlLCBvZmZzZXR9O1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm9vbGVhbkluZGV4IGV4dGVuZHMgTmVhcmJ5SW5kZXhCYXNlIHtcblxuICAgIGNvbnN0cnVjdG9yKGluZGV4LCBvcHRpb25zPXt9KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gICAgICAgIGxldCB7Y29uZGl0aW9uID0gKGNlbnRlcikgPT4gY2VudGVyLmxlbmd0aCA+IDB9ID0gb3B0aW9ucztcbiAgICAgICAgdGhpcy5fY29uZGl0aW9uID0gY29uZGl0aW9uO1xuICAgIH1cblxuICAgIG5lYXJieShvZmZzZXQpIHtcbiAgICAgICAgb2Zmc2V0ID0gZW5kcG9pbnQuZnJvbV9pbnB1dChvZmZzZXQpO1xuICAgICAgICBjb25zdCBuZWFyYnkgPSB0aGlzLl9pbmRleC5uZWFyYnkob2Zmc2V0KTtcbiAgICAgICAgXG4gICAgICAgIGxldCBldmFsdWF0aW9uID0gdGhpcy5fY29uZGl0aW9uKG5lYXJieS5jZW50ZXIpOyBcbiAgICAgICAgLyogXG4gICAgICAgICAgICBzZWVrIGxlZnQgYW5kIHJpZ2h0IGZvciBmaXJzdCByZWdpb25cbiAgICAgICAgICAgIHdoaWNoIGRvZXMgbm90IGhhdmUgdGhlIHNhbWUgZXZhbHVhdGlvbiBcbiAgICAgICAgKi9cbiAgICAgICAgY29uc3QgY29uZGl0aW9uID0gKGNlbnRlcikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2NvbmRpdGlvbihjZW50ZXIpICE9IGV2YWx1YXRpb247XG4gICAgICAgIH1cblxuICAgICAgICAvLyBleHBhbmQgcmlnaHRcbiAgICAgICAgbGV0IHJpZ2h0O1xuICAgICAgICBsZXQgcmlnaHRfbmVhcmJ5ID0gdGhpcy5faW5kZXguZmluZF9yZWdpb24obmVhcmJ5LCB7XG4gICAgICAgICAgICBkaXJlY3Rpb246MSwgY29uZGl0aW9uXG4gICAgICAgIH0pOyAgICAgICAgXG4gICAgICAgIGlmIChyaWdodF9uZWFyYnkgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByaWdodCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwocmlnaHRfbmVhcmJ5Lml0dilbMF07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBleHBhbmQgbGVmdFxuICAgICAgICBsZXQgbGVmdDtcbiAgICAgICAgbGV0IGxlZnRfbmVhcmJ5ID0gdGhpcy5faW5kZXguZmluZF9yZWdpb24obmVhcmJ5LCB7XG4gICAgICAgICAgICBkaXJlY3Rpb246LTEsIGNvbmRpdGlvblxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGxlZnRfbmVhcmJ5ICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbGVmdCA9IGVuZHBvaW50LmZyb21faW50ZXJ2YWwobGVmdF9uZWFyYnkuaXR2KVsxXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGV4cGFuZCB0byBpbmZpbml0eVxuICAgICAgICBsZWZ0ID0gbGVmdCB8fCBbLUluZmluaXR5LCAwXTtcbiAgICAgICAgcmlnaHQgPSByaWdodCB8fCBbSW5maW5pdHksIDBdO1xuICAgICAgICBjb25zdCBsb3cgPSBlbmRwb2ludC5mbGlwKGxlZnQsIFwibG93XCIpO1xuICAgICAgICBjb25zdCBoaWdoID0gZW5kcG9pbnQuZmxpcChyaWdodCwgXCJoaWdoXCIpXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpdHY6IGludGVydmFsLmZyb21fZW5kcG9pbnRzKGxvdywgaGlnaCksXG4gICAgICAgICAgICBjZW50ZXIgOiBbcXVlcnlPYmplY3QoZXZhbHVhdGlvbildLFxuICAgICAgICAgICAgbGVmdCxcbiAgICAgICAgICAgIHJpZ2h0LFxuICAgICAgICB9XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgTWVyZ2VJbmRleCB9IGZyb20gXCIuL21lcmdlLmpzXCI7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gXCIuLi9sYXllcnMuanNcIjtcbmltcG9ydCB7IEJvb2xlYW5JbmRleCB9IGZyb20gXCIuL2Jvb2xlYW4uanNcIjtcblxuXG5jbGFzcyBMb2dpY2FsTWVyZ2VMYXllciBleHRlbmRzIExheWVyIHtcblxuICAgIGNvbnN0cnVjdG9yKHNvdXJjZXMsIG9wdGlvbnM9e30pIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICBjb25zdCB7ZXhwcn0gPSBvcHRpb25zO1xuXG4gICAgICAgIGxldCBjb25kaXRpb247XG4gICAgICAgIGlmIChleHByKSB7XG4gICAgICAgICAgICBjb25kaXRpb24gPSAoY2VudGVyKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4cHIuZXZhbChjZW50ZXIpO1xuICAgICAgICAgICAgfSAgICBcbiAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgLy8gc3Vic2NyaWJlIHRvIGNhbGxiYWNrcyBmcm9tIHNvdXJjZXNcbiAgICAgICAgY29uc3QgaGFuZGxlciA9IHRoaXMuX29uY2hhbmdlLmJpbmQodGhpcyk7XG4gICAgICAgIGZvciAobGV0IHNyYyBvZiBzb3VyY2VzKSB7XG4gICAgICAgICAgICBzcmMuYWRkX2NhbGxiYWNrKGhhbmRsZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgbGV0IGluZGV4ID0gbmV3IE1lcmdlSW5kZXgoc291cmNlcyk7XG4gICAgICAgIHRoaXMuX2luZGV4ID0gbmV3IEJvb2xlYW5JbmRleChpbmRleCwge2NvbmRpdGlvbn0pO1xuICAgIH1cblxuICAgIGdldCBpbmRleCAoKSB7cmV0dXJuIHRoaXMuX2luZGV4fTtcblxuICAgIF9vbmNoYW5nZShlQXJnKSB7XG4gICAgICAgIHRoaXMuY2xlYXJDYWNoZXMoKTtcbiAgICAgICAgdGhpcy5ub3RpZnlfY2FsbGJhY2tzKCk7XG4gICAgICAgIHRoaXMuZXZlbnRpZnlUcmlnZ2VyKFwiY2hhbmdlXCIpO1xuICAgIH1cbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gbG9naWNhbF9tZXJnZShzb3VyY2VzLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyBMb2dpY2FsTWVyZ2VMYXllcihzb3VyY2VzLCBvcHRpb25zKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gbG9naWNhbF9leHByIChzcmMpIHtcbiAgICBpZiAoIShzcmMgaW5zdGFuY2VvZiBMYXllcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBtdXN0IGJlIGxheWVyICR7c3JjfWApXG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGNhY2hlIG9mIGNlbnRlcikge1xuICAgICAgICAgICAgICAgIGlmIChjYWNoZS5zcmMgPT0gc3JjKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxubG9naWNhbF9leHByLmFuZCA9IGZ1bmN0aW9uIGFuZCguLi5leHBycykge1xuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBleHBycy5ldmVyeSgoZXhwcikgPT4gZXhwci5ldmFsKGNlbnRlcikpO1xuICAgICAgICB9ICAgIFxuICAgIH1cbn1cblxubG9naWNhbF9leHByLm9yID0gZnVuY3Rpb24gb3IoLi4uZXhwcnMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBldmFsOiBmdW5jdGlvbiAoY2VudGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwcnMuc29tZSgoZXhwcikgPT4gZXhwci5ldmFsKGNlbnRlcikpO1xuICAgICAgICB9ICAgIFxuICAgIH1cbn1cblxubG9naWNhbF9leHByLnhvciA9IGZ1bmN0aW9uIHhvcihleHByMSwgZXhwcjIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBldmFsOiBmdW5jdGlvbiAoY2VudGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwcjEuZXZhbChjZW50ZXIpICE9IGV4cHIyLmV2YWwoY2VudGVyKTtcbiAgICAgICAgfSAgICBcbiAgICB9XG59XG5cbmxvZ2ljYWxfZXhwci5ub3QgPSBmdW5jdGlvbiBub3QoZXhwcikge1xuICAgIHJldHVybiB7XG4gICAgICAgIGV2YWw6IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiAhZXhwci5ldmFsKGNlbnRlcik7XG4gICAgICAgIH0gICAgXG4gICAgfVxufVxuXG5cblxuXG4iLCJpbXBvcnQgeyBMb2NhbFN0YXRlUHJvdmlkZXIgfSBmcm9tIFwiLi9zdGF0ZXByb3ZpZGVyLmpzXCI7XG5pbXBvcnQgeyBtZXJnZSB9IGZyb20gXCIuL29wcy9tZXJnZS5qc1wiXG5pbXBvcnQgeyBzaGlmdCB9IGZyb20gXCIuL29wcy9zaGlmdC5qc1wiO1xuaW1wb3J0IHsgSW5wdXRMYXllciwgTGF5ZXIgfSBmcm9tIFwiLi9sYXllcnMuanNcIjtcbmltcG9ydCB7IEN1cnNvciB9IGZyb20gXCIuL2N1cnNvcnMuanNcIjtcbmltcG9ydCB7IGJvb2xlYW4gfSBmcm9tIFwiLi9vcHMvYm9vbGVhbi5qc1wiXG5pbXBvcnQgeyBjbWQgfSBmcm9tIFwiLi9jbWQuanNcIjtcbmltcG9ydCB7IGxvZ2ljYWxfbWVyZ2UsIGxvZ2ljYWxfZXhwcn0gZnJvbSBcIi4vb3BzL2xvZ2ljYWxfbWVyZ2UuanNcIjtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIExBWUVSIEZBQ1RPUllcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gbGF5ZXIob3B0aW9ucz17fSkge1xuICAgIGxldCB7c3JjLCAuLi5vcHRzfSA9IG9wdGlvbnM7XG4gICAgaWYgKHNyYyBpbnN0YW5jZW9mIExheWVyKSB7XG4gICAgICAgIHJldHVybiBzcmM7XG4gICAgfSBcbiAgICBpZiAoc3JjID09IHVuZGVmaW5lZCkge1xuICAgICAgICBzcmMgPSBuZXcgTG9jYWxTdGF0ZVByb3ZpZGVyKG9wdHMpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IElucHV0TGF5ZXIoe3NyYywgLi4ub3B0c30pOyBcbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgIENVUlNPUiBGQUNUT1JJRVNcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuZnVuY3Rpb24gY3Vyc29yKG9wdGlvbnM9e30pIHtcbiAgICBjb25zdCB7Y3RybCwgLi4ub3B0c30gPSBvcHRpb25zO1xuICAgIGNvbnN0IHNyYyA9IGxheWVyKG9wdHMpOyAgICBcbiAgICByZXR1cm4gbmV3IEN1cnNvcih7Y3RybCwgc3JjfSk7XG59XG5cbmV4cG9ydCB7IFxuICAgIGxheWVyLCBjdXJzb3IsIG1lcmdlLCBzaGlmdCwgY21kLCBcbiAgICBjdXJzb3IgYXMgdmFyaWFibGUsIFxuICAgIGN1cnNvciBhcyBwbGF5YmFjaywgXG4gICAgYm9vbGVhbiwgbG9naWNhbF9tZXJnZSwgbG9naWNhbF9leHByXG59Il0sIm5hbWVzIjpbIlBSRUZJWCIsImFkZFRvSW5zdGFuY2UiLCJhZGRUb1Byb3RvdHlwZSIsImNhbGxiYWNrLmltcGxlbWVudHNfY2FsbGJhY2siLCJjYWxsYmFjay5hZGRUb0luc3RhbmNlIiwiY2FsbGJhY2suYWRkVG9Qcm90b3R5cGUiLCJjbXBfYXNjZW5kaW5nIiwiY21wX2Rlc2NlbmRpbmciLCJpbnRlcnBvbGF0ZSIsImV2ZW50aWZ5LmFkZFRvSW5zdGFuY2UiLCJldmVudGlmeS5hZGRUb1Byb3RvdHlwZSIsInNyY3Byb3AuYWRkVG9JbnN0YW5jZSIsInNyY3Byb3AuYWRkVG9Qcm90b3R5cGUiLCJzZWdtZW50LlN0YXRpY1NlZ21lbnQiLCJzZWdtZW50LlRyYW5zaXRpb25TZWdtZW50Iiwic2VnbWVudC5JbnRlcnBvbGF0aW9uU2VnbWVudCIsInNlZ21lbnQu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LEVBQUUsTUFBTSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7RUFDckQ7RUFDQSxFQUFFLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDO0VBQ25DLEVBQUUsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUM7RUFDL0QsRUFBRSxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsS0FBSyxLQUFLO0VBQzdDLEdBQUcsT0FBTyxLQUFLLENBQUMsRUFBRSxJQUFJLElBQUksQ0FBQyxFQUFFO0VBQzdCLEdBQUcsQ0FBQztFQUNKLEVBQUUsSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUU7RUFDakIsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztFQUN6QjtFQUNBLEVBQUUsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUM7RUFDOUQsRUFBRSxPQUFPLFNBQVMsSUFBSSxDQUFDLFFBQVE7RUFDL0I7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUU7RUFDakMsRUFBRSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7RUFDdEMsRUFBRSxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQztFQUNuQyxFQUFFLElBQUksS0FBSyxJQUFJLFNBQVMsRUFBRTtFQUMxQixHQUFHLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEdBQUcs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
