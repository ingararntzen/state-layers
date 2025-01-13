import { eventify } from "./eventify.js";
import { callback } from "./util.js";
import { bind, release } from "./monitor.js";

/************************************************
 * SOURCE BASE
 ************************************************/

/**
 * Base class for entities which can be used as source
 * 
 * Implement the callback interface.
 */


export class SourceBase {
    constructor() {
        callback.addToInstance(this);
    }
}
callback.addToPrototype(SourceBase.prototype);



/************************************************
 * STATE PROVIDER BASE
 ************************************************/

/*
    Base class for all state providers

    - object with collection of items
    - could be local - or proxy to online source

    represents a dynamic collection of items
    {interval, ...data}
*/

export class StateProviderBase extends SourceBase {

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



/************************************************
 * LAYER BASE
 ************************************************/

export class LayerBase extends SourceBase {

    /**********************************************************
     * QUERY
     **********************************************************/

    query (offset) {
        throw new Error("Not implemented");
    }
}

/************************************************
 * CURSOR BASE
 ************************************************/

export class CursorBase extends SourceBase {

    constructor () {
        super();

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
eventify.addToPrototype(CursorBase.prototype);

/*********************************************************************
    NEARBY INDEX BASE
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
 *      interval: interval where nearby returns identical {center}
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

export class NearbyIndexBase {

    constructor() {
        callback.addToInstance(this);
    }

    update (items) {
        throw new Error("Not implemented");
    }

    /* 
        Nearby method
    */
    nearby(offset) {
        
    }
}
callback.addToPrototype(NearbyIndexBase.prototype);

