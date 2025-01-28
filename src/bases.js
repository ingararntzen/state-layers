import { eventify } from "./eventify.js";
import { callback } from "./util.js";
import { bind, release } from "./monitor.js";
import { endpoint } from "./intervals.js";
import { range } from "./util.js";


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

export class ClockProviderBase {
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

export class MotionProviderBase {

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
            }
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

export class StateProviderBase {

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

export class LayerBase {

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

export class CursorBase {

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

