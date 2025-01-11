import {eventing} from "./eventing.js";

/***************************************************************
    STATE PROVIDER BASE
***************************************************************/

/*

    STATE PROVIDER

    - object with collection of items
    - could be local - or proxy to online source

    Abstract base class for all state providers

    represents a dynamic collection of items (i.e. cues)
    {interval, ...data}
*/

export class StateProviderBase {
    constructor() {
        eventing.theInstance(this);
    }

    // public update function
    update(items){
        return Promise.resolve()
            .then(() => {
                return this.handle_update(items);
            });
    }

    handle_update(items) {
        throw new Error("not implemented");
    }

    get items() {
        throw new Error("not implemented");
    }
}
eventing.thePrototype(StateProviderBase.prototype);