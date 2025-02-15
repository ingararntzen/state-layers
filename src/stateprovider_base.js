import * as callback from "./api_callback.js";

/************************************************
 * STATE PROVIDER BASE
 ************************************************/

/*
    Base class for StateProviders

    - collection of items
    - {id, itv, type, data}
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
    update(changes){}

    /**
     * return array with all items in collection 
     * - no requirement wrt order
     */
    get_items() {
        throw new Error("not implemented");
    }
}
callback.addToPrototype(StateProviderBase.prototype);
