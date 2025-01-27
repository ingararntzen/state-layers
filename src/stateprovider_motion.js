import { 
    StateProviderBase,
    MotionProviderBase 
} from "./bases.js";
import { MotionSegment } from "./segments.js";


/***************************************************************
    LOCAL MOTION PROVIDER 
***************************************************************/

/**
 * This implements a local MotionProvider
 *  
 * state = {
 *      position: 0,
 *      velocity: 0,
 *      acceleration: 0,
 *      timestamp: 0
 *      range: [undefined, undefined]
 * }
 * 
 * Input/output checking is performed by the wrapper.
 * 
 */

export class LocalMotionProvider extends MotionProviderBase {

    set_state (state) {
        return Promise.resolve()
            .then(() => {
                this._state = state;
                this.notify_callbacks();
            });
    }
}


/***************************************************************
    MOTION STATE PROVIDER
***************************************************************/

/**
 * Wraps the simpler motion provider to ensure 
 * checking of state and implement the StateProvider 
 * interface.
 */

export class MotionStateProvider extends StateProviderBase {

    constructor(mp) {
        super();
        if (!(mp instanceof MotionProviderBase)) {
            throw new Error(`must be MotionProviderBase ${mp}`)
        }
        // motion provider
        this._mp = mp;
        // check initial state of motion provider
        this._mp._state = check_state(this._mp._state)
        // subscribe to callbacks
        this._mp.add_callback(this._handle_callback.bind(this));
    }

    _handle_callback() {
        // Forward callback from wrapped motion provider
        this.notify_callbacks();
    }

    /**
     * update motion state
     */

    update(items, options={}) {
        // TODO - items should be coverted to motion state
        let state = state_from_items(items);
        state = check_state(state);
        // forward updates to wrapped motion provider
        return this._mp.set_state(state);
    }

    get_state() {
        // resolve state from wrapped motion provider
        let state = this._mp.get_state();
        state = check_state(state)
        return items_from_state(state);
    }

    get info () {
        return {overlapping: false};
    }
}


/***************************************************************
    UTIL
***************************************************************/

function check_state(state) {
    let {
        position=0, 
        velocity=0, 
        acceleration=0,
        timestamp=0,
        range=[undefined, undefined] 
    } = state || {};
    state = {
        position, 
        velocity,
        acceleration,
        timestamp,
        range
    }
    // vector values must be finite numbers
    const props = ["position", "velocity", "acceleration", "timestamp"];
    for (let prop of props) {
        let n = state[prop];
        if (!isFiniteNumber(n)) {
            throw new Error(`${prop} must be number ${n}`);
        }
    }

    // range values can be undefined or a number
    for (let n of range) {
        if (!(n == undefined || isFiniteNumber(n))) {
            throw new Error(`range value must be undefined or number ${n}`);
        }
    }
    let [low, high] = range;
    if (low != undefined && low != undefined) {
        if (low >= high) {
            throw new Error(`low > high [${low}, ${high}]`)
        } 
    }
    return {position, velocity, acceleration, timestamp, range};
}

function isFiniteNumber(n) {
    return (typeof n == "number") && isFinite(n);
}

/**
 * convert item list into motion state
 */

function state_from_items(items) {
    // pick one item of motion type
    const item = items.find((item) => {
        return item.type == "motion";
    })
    if (item != undefined) {
        return item.data;
    }
}

/**
 * convert motion state into items list
 */

function items_from_state (state) {
    // motion segment for calculation
    let [low, high] = state.range;
    const seg = new MotionSegment([low, high, true, true], state);
    const {value:value_low} = seg.state(low);
    const {value:value_high} = seg.state(high);

    // set up items
    if (low == undefined && high == undefined) {
        return [{
            itv:[-Infinity, Infinity, true, true], 
            type: "motion",
            args: state
        }];
    } else if (low == undefined) {
        return [
            {
                itv:[-Infinity, high, true, true], 
                type: "motion",
                args: state
            },
            {
                itv:[high, Infinity, false, true], 
                type: "static",
                args: value_high
            },
        ];
    } else if (high == undefined) {
        return [
            {
                itv:[-Infinity, low, true, false], 
                type: "static",
                args: value_low
            },
            {
                itv:[low, Infinity, true, true], 
                type: "motion",
                args: state
            },
        ];
    } else {
        return [
            {
                itv:[-Infinity, low, true, false], 
                type: "static",
                args: value_low
            },
            {
                itv:[low, high, true, true], 
                type: "motion",
                args: state
            },
            {
                itv:[high, Infinity, false, true], 
                type: "static",
                args: value_high
            },
        ];
    }
}

