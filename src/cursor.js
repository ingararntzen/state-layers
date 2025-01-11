
import { NearbyCache } from "./nearbycache.js";
import { SimpleNearbyIndex } from "./nearbyindex_simple.js";
import { SimpleStateProvider } from "./stateprovider_simple.js";
import { bind, release } from "./monitor.js";
import { StateProviderBase } from "./stateprovider_base.js";
import { CursorBase } from "./cursor_base.js";
import { assign } from "./cmd.js";

/**
 * CLOCK (counting seconds since page load)
 */

export class Clock extends CursorBase {}

export class LocalClock extends Clock {
    query () {
        let offset = performance.now()/1000.0;
        return {value:offset, dynamic:true, offset};
    }
}
export const LOCAL_CLOCK = new LocalClock();

export class LocalEpoch extends Clock {
    query () {
        let offset = (Date.now() / 1000.0)
        return {value:offset, dynamic:true, offset};
    }
}
export const LOCAL_EPOCH_CLOCK = new LocalEpoch();


/**
 * 
 * CLOCK CURSORS
 * 
 * 
 * LocalClock - (performance now, epoch) - these are wallclocks
 * 
 * OnlineClock - set up with a fixed clock server (epoch)
 * 
 * MediaClock - set up with a clock (ctrl) (fixed),
 * and stateprovider (src) (switchable)
 * 
 * Cursor - both (ctrl) and (src) are switchable
 * 
 * 
 * CHALLENGES
 * 
 * Media Clock should not support ctrl switching
 * - restrict state to motions
 */



/** 
 * Cursor
 * 
 * - src (state provider)
 * - ctrl (control provider)
 * 
 * Implementation uses a NearbyIndex and a NearbyCache 
*/

export class Cursor extends CursorBase {

    constructor(options={}) {
        super();

        // ctrl
        this._ctrl;
        // src - state provider
        this._src;
        // nearby index
        this._index;
        // nearby cache
        this._cache 

        // initialise with  ctrlprovider
        let {ctrl, offset} = options;
        if (ctrl == undefined) {
            if (offset == undefined) {
                ctrl = LOCAL_CLOCK;
            } else {
                // TODO - Motion
                throw new Error("Motion not implemented yet")
            }
        }
        if (!(ctrl instanceof CursorBase)) {
            throw new Error("ctrl must be CursorBase")
        }
        this.ctrl = ctrl;
        
        // initialise with stateprovider
        let {src, value} = options;
        if (src == undefined) {
            let items = assign(value);
            src = new SimpleStateProvider({items});
        }
        if (!(src instanceof StateProviderBase)) {
            throw new Error("src must be StateproviderBase")
        }
        this.src = src;

    }

    /**********************************************************
     * STATE PROVIDER
     **********************************************************/

    _switch_stateprovider(stateprovider) {
        // remove callback from current state provider
        if (this._src) {
            this._src.remove_callback();
        }
        // switch state provider
        this._src = stateprovider;
        // add callbacks from state provider
        this._src.add_callback(this._onchange_stateprovider.bind(this));        
    }

    // state change in state provider
    _onchange_stateprovider() {
        this._index.update(this._src.items);
        this._cache.dirty();
        // trigger change event for cursor
        this.eventifyTrigger("change", this.query());
    }

    // src accessors - state provider
    get src () {return this._src};
    set src (stateprovider) {
        // TODO - check state provider
        if (stateprovider != this._src) {
            this._switch_stateprovider(stateprovider);
            // refresh index
            let {overlapping} = this._src.info || {};
            if (overlapping) {
                    throw new Error("overlapping not supported yet")
            } else {
                this._index = new SimpleNearbyIndex();
                this._index.update(this.src.items);
            }
            // refresh cache
            if (this._cache) {
                this._cache.dirty();
            } else {
                this._cache = new NearbyCache(this._index);
            }
            // trigger change event for cursor
            this.eventifyTrigger("change", this.query());
        }
    }

    /**********************************************************
     * CTRL PROVIDER
     **********************************************************/

    _switch_ctrlprovider(ctrlprovider) {
        // remove callback from current ctrlprovider
        if (this._ctrl) {
            this._ctrl.off("change");
        }
        // switch ctrlprovider
        this._ctrl = ctrlprovider;
        // add callbacks from state provider
        this._ctrl.on("change", this._onchange_ctrlprovider.bind(this))
    }

    _onchange_ctrlprovider() {
        // TODO - set timeouts based on index



        // trigger change event for cursor
        this.eventifyTrigger("change", this.query());
    }

    // ctrl
    get ctrl () {return this._ctrl;}
    set ctrl (ctrlprovider) {
        // check ctrlprovider
        if (ctrlprovider != this._ctrl) {
            this._switch_ctrlprovider(ctrlprovider);
            // refresh cache
            if (this._cache) {
                this._cache.dirty();
            }
        }
    } 

    /**********************************************************
     * QUERY
     **********************************************************/

    query () {
        let {value:offset} = this._ctrl.query()
        return this._cache.query(offset);
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

