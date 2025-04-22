import { Cursor } from "../cursor_base.js";
import { Layer } from "../layer_base.js"
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
 * The new transformed Cursor does not have a src (layer) and and a ctrl (cursor)
 * property, since it only depends on the src cursor.
 * 
 * Also, the new transformed cursor does not need any playback logic on its own
 * as long as the nature of the transformation is a plain value/state transition. 
 */
export function cursor_transform(src, options={}) {

    if (!(src instanceof Cursor)) {
        throw new Error(`src must be a Cursor ${src}`);
    }

    const {numeric=false, valueFunc, stateFunc} = options;
    const cursor = new Cursor();

    // implement query
    cursor.query = function query() {
        const state = src.query();
        return transformState(state, {stateFunc, valueFunc});
    }

    // numberic can be set to true by options
    Object.defineProperty(cursor, "numeric", {get: () => {return numeric;}});
    // fixedRate is inherited from src
    Object.defineProperty(cursor, "fixedRate", {get: () => src.fixedRate});

    // callbacks from src-cursor
    src.add_callback(() => {cursor.onchange()});
    return cursor;
}


/**
 * Layer Transform
 * Create a new Layer which is a transformation of the src Layer
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

export function layer_transform(src, options={}) {

    if (!(src instanceof Layer)) {
        throw new Error(`src must be a Layer ${src}`);
    }

    const ops = {};
    ops.valueFunc = wrappedValueFunc(options.valueFunc);
    ops.stateFunc = wrappedStateFunc(options.stateFunc);

    const layer = new Layer(ops);
    layer.index = new NearbyIndexSrc(src);
    layer.src = src;
    layer.src.add_callback((eArg) => {layer.onchange(eArg)});

    Object.defineProperty(layer, "numeric", {get: () => src.numeric});

    return layer;
}



