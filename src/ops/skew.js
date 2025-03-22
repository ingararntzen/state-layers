/**
 * Cursor transform
 * returns a cursor that is transformed by a function
 */

import { Cursor } from "../cursor_base.js";

export function skew_cursor(src, options={}) {
    const {skew=0, scale=1} = options;

    if (!(src instanceof Cursor)) {
        throw new Error(`src must be a Cursor ${src}`);
    }

    const cursor = new Cursor();

    // implement query
    cursor.query = function query() {
        const state = src.query();
        state.value = skew + state.value * scale;
        return state;
    }

    // subscribe to src events
    src.add_callback(() => {
        cursor.onchange()
    });

    cursor.src = src;
    return cursor;
}

