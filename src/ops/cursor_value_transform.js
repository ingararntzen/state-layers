/**
 * Cursor transform
 * returns a cursor that is transformed by a function
 */

import { Cursor } from "../cursor_base.js";

export function transform_cursor_values(src, options={}) {
    const {shift=0, scale=1} = options;

    if (!(src instanceof Cursor)) {
        throw new Error(`src must be a Cursor ${src}`);
    }

    const cursor = new Cursor();

    // implement query
    cursor.query = function query() {
        const state = src.query();
        state.value = shift + state.value*scale;
        return state;
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