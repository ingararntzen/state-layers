

import { StateProviderBase, CursorBase } from "./bases.js";
import { source } from "./util.js";
import { SimpleStateProvider } from "./stateprovider_simple.js";
import { nearby } from "./common.js";
import { cmd } from "./cmd.js";


/************************************************
 * CLOCK CURSORS
 ************************************************/

// CLOCK (counting seconds since page load)
class LocalClock extends CursorBase {
    query () {
        let offset = performance.now()/1000.0;
        return {value:offset, dynamic:true, offset};
    }
}

// CLOCK (counting seconds since epoch (1970)
class LocalEpoch extends CursorBase {
    query () {
        let offset = (Date.now() / 1000.0)
        return {value:offset, dynamic:true, offset};
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
        // nearby
        nearby.addToInstance(this);
        // initialse clock

        // initialise ctrl
        let {ctrl} = options;
        if (ctrl == undefined) {
            ctrl = local_clock;
        }
        this.ctrl = ctrl;

        // initialise state
        let {src} = options;
        if (src == undefined) {
            src = new SimpleStateProvider();
        }
        this.src = src
    }

    // check ctrl
    __ctrl_check(ctrl) {
        if (!(ctrl instanceof CursorBase)) {
            throw new Error(`"ctrl" must be cursor ${ctrl}`)
        }
    }
    
    // check src
    __src_check(src) {
        if (!(src instanceof StateProviderBase)) {
            throw new Error(`"src" must be state provider ${source}`);
        }
    }

    // ctrl or src changes
    __ctrl_onchange() {
        this.__onchange();
    }
    __src_onchange() {
        this.__onchange();
    }
    __onchange() {
        if (this.src && this.ctrl) {
            let items = this.src.items;
            this.__nearby_update(items);
            // trigger change event for cursor
            this.eventifyTrigger("change", this.query());    
        }
    }

    /**********************************************************
     * QUERY
     **********************************************************/
    query () {
        let {value:offset} = this.ctrl.query()
        if (typeof offset !== 'number') {
            throw new Error(`warning: ctrl state must be number ${offset}`);
        }
        return this.__nearby_cache.query(offset);
    }

    /**********************************************************
     * CONVENIENCE
     **********************************************************/

    get value () {return this.query().value};

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
nearby.addToPrototype(Cursor.prototype);
