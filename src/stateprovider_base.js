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

const DEAULT_OPTIONS = {};

export class StateProviderBase {
    constructor(options={}) {
        this._options = {...DEAULT_OPTIONS, ...options};
        eventing.theInstance(this);
    }
    update(items) {
        throw new Error("not implemented");
    }

    get items() {
        throw new Error("not implemented");
    }
    get size() {
        throw new Error("not implemented");
    }
    get type () {
        throw new Error("not implemented");
    }
}
eventing.thePrototype(StateProviderBase.prototype);