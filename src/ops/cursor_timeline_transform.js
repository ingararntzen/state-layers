/**
 * Cursor transform
 * returns a cursor that is transformed by a function
 * 
 * shifting a cursor by 2 means that the cursor is shifted to the right
 * on the timeline by 2 units
 */

import { Cursor } from "../cursor_base.js";
import { transform_layer_timeline } from "./layer_timeline_transform.js";

export function transform_cursor_timeline(src, options={}) {

    if (!(src instanceof Cursor)) {
        throw new Error(`src must be a Cursor ${src}`);
    }

    // new cursor
    const cursor = new Cursor();

    // adopt ctrl from src cursor
    cursor.ctrl = src.ctrl;
    // adopt src from src cursor
    const {shift, scale} = options;
    cursor.src = transform_layer_timeline(src.src, {shift:-shift, scale});

    // query
    cursor.query = function query() {
        const offset = cursor.ctrl.now();
        return cursor.src.query(offset);
    }

    // add callbacks
    if (cursor.ctrl instanceof Cursor) {
        cursor.ctrl.add_callback(() => {cursor.onchange()});
    }
    cursor.src.add_callback(() => {cursor.onchange()});

    return cursor;
}

