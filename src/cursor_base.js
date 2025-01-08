import { eventify } from "./eventify.js";
import { BaseLinearIndex } from "./linear_index_base.js";

/**
 * Abstract Base Class for all Cursor objects
 */

export class BaseCursor {

    constructor () {
        // define events
        eventify.theInstance(this);
        this.eventifyDefine("change", {init:true});
    }

    // Convenience
    get dynamic () {return this.query().dynamic;}
    get deterministic () {this.query().deterministic;}
    get value () {return this.query().value;}
    
    /*
        Query the current state of the Cursor
        Returns {value, dynamic, offset, deterministic}
    */
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
    
}
eventify.thePrototype(BaseCursor.prototype);


/** 
 * Abstract Base Class for Cursor objects
 * implemented over LinearIndex
*/


export class IndexCursor extends BaseCursor {

    constructor(index) {
        super();
        // linear index
        if (!(index instanceof BaseLinearIndex)) {
            throw new Error("index must be an instance of BaseLinearIndex");
        }
        this._index = index;
    }

    /**
     * TODO - introduce nearby cache
     */

}
