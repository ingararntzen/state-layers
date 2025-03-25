import { Cursor } from "../cursor_base.js";
import { Layer } from "../layer_base.js"
import { NearbyIndexSrc } from "../nearby_base.js"
import { is_clock_cursor } from "../cursor_clock.js";


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

    // adopt the ctrl of the src-cursor
    if (!is_clock_cursor(src)) {
        cursor.ctrl = src.ctrl;
        // add callbacks
        cursor.ctrl.add_callback(() => {cursor.onchange()});
    }

    /* 
        Current definition of Cursor src property is that it is a layer or undefined.
        This leaves cursor transform options.
        1) wrap src cursor as a layer,
        2) let src property be undefined
        3) adopt the src property of the src cursor as its own src

        We go for 3)
    */

    // adopt the src of the src-cursor as src
    if (!is_clock_cursor(src)) {
        cursor.src = src.src;
    }

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
    return layer;
}



