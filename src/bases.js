import { eventify } from "./eventify.js";
import { callback } from "./util.js";
import { bind, release } from "./monitor.js";

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
        this._cache;

        callback.addToInstance(this);
        // define change event
        eventify.addToInstance(this);
        this.eventifyDefine("change", {init:true});
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

