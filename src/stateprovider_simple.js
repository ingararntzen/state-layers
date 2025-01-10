import {StateProviderBase} from "./stateprovider_base.js";
import {endpoint} from "./intervals.js";


/***************************************************************
    SIMPLE STATE PROVIDER (LOCAL)
***************************************************************/

/**
 * Local Array with non overlapping items.
 */

export class SimpleStateProvider extends StateProviderBase {

    constructor(options={}) {
        super(options);
        this._items = [];
    }

    update (items) {
        this._items = check_input(items);
        this.notify_callbacks();
    }

    get items () {
        return this._items;
    }

    get size () {
        return this._items.length;
    }

    get type () {
        return {dynamic: true, overlapping: false, local:true};
    }

    /**
     * Convenience update methods
     */

    set value (value) {
        if (value == undefined) {
            this._update([]);
        } else {
            let item = {
                interval: [-Infinity, Infinity, true, true],
                type: "static",
                args: {value}                 
            }
            this._update([item])
        }
    }

    move(vector) {
        let item = {
            interval: [-Infinity, Infinity, true, true],
            type: "motion",
            args: {vector}                 
        }
        this._update([item])    
    }

    transition(v0, v1, t0, t1, easing) {
        let items = [
            {
                interval: [-Inifinity, t0, true, false],
                type: "static",
                args: {value:v0}
            },
            {
                interval: [t0, t1, true, false],
                type: "transition",
                args: {v0, v1, t0, t1, easing}
            },
            {
                interval: [t1, Infinity, true, true],
                type: "static",
                args: {value: v1}
            }
        ]
        this._update(items);
    }

    interpolate(tuples) {
        let items = [
            {
                interval: [-Inifinity, t0, true, false],
                type: "static",
                args: {value:v0}
            },
            {
                interval: [t0, t1, true, false],
                type: "interpolation",
                args: {tuples}
            },
            {
                interval: [t1, Infinity, true, true],
                type: "static",
                args: {value: v1}
            }
        ]
        this._update(items);
    }
}


function check_input(items) {
    if (!Array.isArray(items)) {
        throw new Error("Input must be an array");
    }
    // sort items based on interval low endpoint
    items.sort((a, b) => {
        let a_low = endpoint.from_interval(a.interval)[0];
        let b_low = endpoint.from_interval(b.interval)[0];
        return endpoint.cmp(a_low, b_low);
    });
    // check that item intervals are non-overlapping
    for (let i = 1; i < items.length; i++) {
        let prev_high = endpoint.from_interval(items[i - 1].interval)[1];
        let curr_low = endpoint.from_interval(items[i].interval)[0];
        // verify that prev high is less that curr low
        if (!endpoint.lt(prev_high, curr_low)) {
            throw new Error("Overlapping intervals found");
        }
    }
    return items;
}

