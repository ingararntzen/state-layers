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

export class LayerBase {

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

