import * as eventify from "./util/api_eventify.js";
import * as callback from "./util/api_callback.js";
import { bind, release } from "./util/cursor_monitor.js";


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

    // restriction defaults
    get mutable () {return false;}
    get numeric () {return false};

    // property defaults
    get leaf () {return false;}
    get itemsOnly () {return false;}
    get fixedRate () {return false}

    /**********************************************************
     * QUERY API
     **********************************************************/

    query(local_ts) {
        throw new Error("query() not implemented");
    }
    get value () {return this.query().value};
    get () {return this.query().value;}

    /**
     * Eventify: immediate events
     */
    eventifyInitEventArgs(name) {
        if (name == "change") {
            return [this.query()];
        }
    }
    
    /**********************************************************
     * BIND RELEASE (convenience)
     **********************************************************/

    /**
     * alternative to listening to the change event
     * bind subscribes to the change event, but also automatically
     * turns listening on and off when as the cursor switches
     * between dynamic and non-dynamic behavior.
     */

    bind(callback, delay, options={}) {
        return bind(this, callback, delay, options);
    }
    release(handle) {
        return release(handle);
    }

    /**********************************************************
     * CHANGE NOTIFICATION
     **********************************************************/

    /**
     * invoked by cursor implementation to signal change in cursor
     * behavior.
     */
    onchange() {
        this.notify_callbacks();
        this.eventifyTrigger("change", this.query());
        this.detect_future_event();
    }

    /**
     * override by cursor implementation in order to detect
     * and trigger future change events - which are not triggered
     * by state changes - but caused by time progression
     * or playback. This function is invoked after each 
     * onchange() event.
     */
    detect_future_event() {}
}
callback.addMethods(Cursor.prototype);
eventify.addMethods(Cursor.prototype);
