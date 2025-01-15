

import { StateProviderBase, CursorBase } from "./bases.js";
import { source } from "./util.js";
import { SimpleStateProvider } from "./stateprovider_simple.js";
import { cmd } from "./cmd.js";
import { SimpleNearbyIndex } from "./nearbyindex_simple.js";
import { NearbyCache } from "./nearbycache.js";


/************************************************
 * CLOCK CURSORS
 ************************************************/

// CLOCK (counting seconds since page load)
class LocalClock extends CursorBase {
    query () {
        let offset = performance.now()/1000.0;
        return {value:offset, dynamic:true, rate:1, offset};
    }
}

// CLOCK (counting seconds since epoch (1970)
class LocalEpoch extends CursorBase {
    query () {
        let offset = (Date.now() / 1000.0)
        return {value:offset, dynamic:true, rate:1, offset};
    }
}

export const local_clock = new LocalClock();
export const local_epoch = new LocalEpoch()



/************************************************
 * CURSOR
 ************************************************/

/**
 * 
 * Cursor is a variable
 * - has mutable ctrl cursor (default local clock)
 * - has mutable state provider (src) (default state undefined)
 * - methods for assign, move, transition, intepolation
 * 
 */

export class Cursor extends CursorBase {

    constructor (options={}) {
        super();
        // ctrl
        source.addToInstance(this, "ctrl");
        // src
        source.addToInstance(this, "src");
        // index
        this._index = new SimpleNearbyIndex();
        // cache
        this._cache = new NearbyCache(this._index);
        
        let {src, ctrl, ...opts} = options;

        // initialise ctrl
        if (ctrl == undefined) {
            ctrl = local_clock;
        }
        this.ctrl = ctrl;

        // initialise state
        if (src == undefined) {
            src = new SimpleStateProvider(opts);
        }
        this.src = src
    }

    /**********************************************************
     * CTRL (cursor)
     **********************************************************/

    __ctrl_check(ctrl) {
        if (!(ctrl instanceof CursorBase)) {
            throw new Error(`"ctrl" must be cursor ${ctrl}`)
        }
    }
    __ctrl_handle_change() {
        this.__handle_change();
    }

    /**********************************************************
     * SRC (stateprovider)
     **********************************************************/

    __src_check(src) {
        if (!(src instanceof StateProviderBase)) {
            throw new Error(`"src" must be state provider ${source}`);
        }
    }    
    __src_handle_change() {
        this.__handle_change();
    }

    /**********************************************************
     * CALLBACK
     **********************************************************/

    __handle_change() {
        if (this.src && this.ctrl) {
            let items = this.src.items;
            this._index.update(items);
            this._cache.dirty();
            // trigger change event for cursor
            this.eventifyTrigger("change", this.query());    
        }
    }

    /**********************************************************
     * QUERY API
     **********************************************************/
    
    query () {
        let {value:offset} = this.ctrl.query()
        if (typeof offset !== 'number') {
            throw new Error(`warning: ctrl state must be number ${offset}`);
        }
        return this._cache.query(offset);
    }

    get value () {return this.query().value};


    /**********************************************************
     * UPDATE API
     **********************************************************/

    assign(value) {
        return cmd(this).assign(value);
    }
    move ({position, velocity}) {
        let {value, rate, offset:timestamp} = this.query();
        if (typeof value !== 'number') {
            throw new Error(`warning: cursor state must be number ${value}`);
        }
        position = (position != undefined) ? position : value;
        velocity = (velocity != undefined) ? velocity: rate;
        return cmd(this).move({position, velocity, timestamp});
    }
    transition ({target, duration, easing}) {
        let {value:v0, offset:t0} = this.query();
        if (typeof v0 !== 'number') {
            throw new Error(`warning: cursor state must be number ${v0}`);
        }
        return cmd(this).transition(v0, target, t0, t0 + duration, easing);
    }
    interpolate ({tuples, duration}) {
        let t0 = this.query().offset;
        // assuming timstamps are in range [0,1]
        // scale timestamps to duration
        tuples = tuples.map(([v,t]) => {
            return [v, t0 + t*duration];
        })
        return cmd(this).interpolate(tuples);
    }

}
source.addToPrototype(Cursor.prototype, "src", {mutable:true});
source.addToPrototype(Cursor.prototype, "ctrl", {mutable:true});

