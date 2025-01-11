import { eventify } from "./eventify.js";

export class CursorBase {

    constructor () {
        // define cursor events
        eventify.theInstance(this);
        this.eventifyDefine("change", {init:true});
    }
    /**********************************************************
     * QUERY
     **********************************************************/

    query () {
        throw new Error("Not implemented");
    }

    // Convenience
    get dynamic () {return this.query().dynamic;}
    get value () {return this.query().value;}

    /*
        Eventify: immediate events
    */
    eventifyInitEventArgs(name) {
        if (name == "change") {
            return [this.query()];
        }
    }

}
eventify.thePrototype(CursorBase.prototype);
