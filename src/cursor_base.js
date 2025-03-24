import * as eventify from "./api_eventify.js";
import * as callback from "./api_callback.js";
import { bind, release } from "./monitor.js";
import { is_finite_number } from "./util.js";

/**
 * convenience
 * get current state from cursor.ctrl
 * ensure that cursor.ctrl return a number offset
 */
export function get_cursor_ctrl_state (cursor) {
    const state = cursor.ctrl.query();
    if (!is_finite_number(state.value)) {
        throw new Error(`warning: cursor ctrl value must be number ${state.value}`);
    }
    return state;
}

/************************************************
 * CURSOR
 ************************************************/  

/**
 * Abstract base class for Cursor interface
 */

export class Cursor {
    
    constructor() {
        // callbacks
        callback.addState(this);
        // define change event
        eventify.addState(this);
        this.eventifyDefine("change", {init:true});
    }

    /**********************************************************
     * QUERY API
     **********************************************************/

    query() {
        throw new Error("query() not implemented");
    }

    get value () {return this.query().value};

    get () {
        return this.query().value;
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

    // invoked by subclass whenever cursor has changed
    onchange() {
        this.notify_callbacks();
        this.eventifyTrigger("change", this.query());    
    }
}
callback.addMethods(Cursor.prototype);
eventify.addMethods(Cursor.prototype);
