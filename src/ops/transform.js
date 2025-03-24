import { Cursor } from "../cursor_base.js";
import { Layer } from "../layer_base.js"
import { NearbyIndexSrc } from "../nearby_base.js"


function toState(state, options={}) {
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
 * Create a new Cursor which is a transformation of the src Cursor
 */
export function cursor_transform(src, options={}) {

    if (!(src instanceof Cursor)) {
        throw new Error(`src must be a Cursor ${src}`);
    }

    const cursor = new Cursor();

    // implement query
    cursor.query = function query() {
        const state = src.query();
        return toState(state, options);
    }

    // adopt ctrl from src cursor
    cursor.ctrl = src.ctrl;
    // add callbacks
    if (cursor.ctrl instanceof Cursor) {
        cursor.ctrl.add_callback(() => {cursor.onchange()});
    }
    cursor.src = src.src;
    cursor.src.add_callback(() => {cursor.onchange()});
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
    return layer;
}



