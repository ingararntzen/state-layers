import { Cursor } from "../cursor_base.js";
import { Track } from "../track_base.js"
import { NearbyIndexSrc } from "../nearby_base.js"

// TODO - enusure numeric if set to true

function transformState(state, options={}) {
    const {valueFunc, stateFunc} = options;
    if (valueFunc != undefined) {
        state.value = valueFunc(state.value);
        return state;
    } else if (stateFunc != undefined) {
        return stateFunc(state);
    } else {
        return state;
    }
}

/**
 * Cursor Transform
 * Create a new Cursor which is a transformation of a src Cursor.
 * 
 * The new transformed Cursor does not have a src (track) and and a ctrl (cursor)
 * property, since it only depends on the src cursor.
 * 
 * Also, the new transformed cursor does not need any playback logic on its own
 * as long as the nature of the transformation is a plain value/state transition. 
 */
export function cursor_transform(src, options={}) {

    if (!(src instanceof Cursor)) {
        throw new Error(`src must be a Cursor ${src}`);
    }

    const {numeric, valueFunc, stateFunc} = options;
    const cursor = new Cursor();

    // implement query
    cursor.query = function query() {
        const state = src.query();
        return transformState(state, {stateFunc, valueFunc});
    }

    // numberic can be set to true by options
    Object.defineProperty(cursor, "numeric", {get: () => {
        return (numeric == undefined) ? src.numeric : numeric; 
    }});
    // fixedRate is inherited from src
    Object.defineProperty(cursor, "fixedRate", {get: () => src.fixedRate});

    if (src.fixedRate) {
        // propagate rate property from src
        Object.defineProperty(cursor, "rate", {get: () => src.rate});
    }

    // callbacks from src-cursor
    src.add_callback(() => {cursor.onchange()});
    return cursor;
}


/**
 * Track Transform
 * Create a new Track which is a transformation of the src track
 */

function wrappedValueFunc(valueFunc) {
    return function ({sources, states, offset}) {
        return valueFunc(states[0].value);
    }
}

function wrappedStateFunc(stateFunc) {
    return function ({sources, states, offset}) {
        return stateFunc(states[0]);
    }
}

export function track_transform(src, options={}) {

    if (!(src instanceof Track)) {
        throw new Error(`src must be a Track ${src}`);
    }

    const ops = {};
    ops.valueFunc = wrappedValueFunc(options.valueFunc);
    ops.stateFunc = wrappedStateFunc(options.stateFunc);

    const track = new Track(ops);
    track.index = new NearbyIndexSrc(src);
    track.src = src;
    track.src.add_callback((eArg) => {track.onchange(eArg)});

    Object.defineProperty(track, "numeric", {get: () => src.numeric});

    return track;
}



