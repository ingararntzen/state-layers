

import { CursorBase } from "./bases.js";
import { source } from "./util.js";
import { SimpleStateProvider } from "./stateprovider_simple.js";
import { nearby } from "./common.js";

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

// TODO online clock

/************************************************
 * MEDIA CLOCK
 ************************************************/

export class MediaClock extends CursorBase {

    constructor(options={}) {
        super();
        // src
        source.addToInstance(this, "src");
        // nearby
        nearby.addToInstance(this);
        // initialse clock
        let {src, clock=local_clock} = options;
        this._clock = clock;

        // initialise state
        if (src == undefined) {
            src = new SimpleStateProvider();
            src._update([{
                interval: [-Infinity, Infinity, true, true],
                type: "motion",
                args: {vector: {
                    position: 0,
                    velocity: 0,
                    timestamp: clock.query().value
                }}
            }]);
        }
        this.src = src
    }

    get clock () {return this._clock;}

    __src_onchange() {
        console.log("OK");
        let items = this.src.items;
        this.__nearby_update(items);
    }

    /**********************************************************
     * QUERY
     **********************************************************/
    query () {
        let {value:offset} = this._clock.query()
        return this.__nearby_cache.query(offset);
    }
}
source.addToPrototype(MediaClock.prototype, "src", {mutable:false});
nearby.addToPrototype(MediaClock.prototype);

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



