import { Cursor } from "../cursor_base.js";
import { is_finite_number } from "../util/common.js";


function check_integer (value) {
    if (value == undefined) {
        throw new Error(`value is undefined`);
    }
    // test that value is number
    if (!is_finite_number(value)) {
        throw new Error(`must be finite number ${value}`);
    }
    // test that value is integer
    if (!Number.isInteger(value)) {
        return Math.floor(value);
    }
}


export function integer_cursor(options={}) {
    const cursor = new Cursor(options);
    const {value} = options;

    if (value != undefined) {
        value = check_integer(value);
    }

    cursor.query = function (local_ts) {
        return {value: Math.floor(value), dynamic:false, offset:local_ts};
    }

    // set method
    cursor.set = function (newValue) {
        newValue = check_integer(newValue);
        if (newValue != value) {
            cursor.onchange();
        }
    }

    // increment method
    cursor.inc = function (delta=1) {
        delta = check_integer(delta);
        const newValue = cursor.get() + delta;
        cursor.set(newValue);
    }

    // decrement method
    cursor.dec = function (delta=1) {
        delta = check_integer(delta);
        const newValue = cursor.get() - delta;
        cursor.set(newValue);
    }


}