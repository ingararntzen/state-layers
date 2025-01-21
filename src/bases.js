import { eventify } from "./eventify.js";
import { callback } from "./util.js";
import { bind, release } from "./monitor.js";

import { endpoint } from "./intervals.js";
import { range } from "./util.js";


/***************************************************************
    CLOCK PROVIDER BASE
***************************************************************/

/**
 * Defines the interface which needs to be implemented
 * by clock providers.
 */

export class ClockProviderBase {

    constructor() {
        callback.addToInstance(this);
    }
    now() {
        throw new Error("not implemented");
    }
}
callback.addToPrototype(ClockProviderBase.prototype);



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

export class StateProviderBase {

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

    getCacheObject () {
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
        const cache = this.getCacheObject();
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

