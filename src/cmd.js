
import {StateProviderBase} from "./stateprovider_base.js";
import {CursorBase} from "./cursor_base.js";

function get_target(obj) {
    if (obj instanceof CursorBase) {
        return obj.src;
    } else if (obj instanceof StateProviderBase) {
        return obj;
    } else {
        throw new Error(`do: obj not supported ${obj}`);
    }
}

const METHODS = {assign, move, transition, interpolate};


export function cmd (obj) {
    let target = get_target(obj);
    let entries = Object.entries(METHODS)
        .map(([name, method]) => {
            return [
                name,
                function(...args) { 
                    let items = method.call(this, ...args);
                    return target.update(items);  
                }
            ]
        });
    return Object.fromEntries(entries);
}

export function assign(value) {
    if (value == undefined) {
        return [];
    } else {
        let item = {
            interval: [-Infinity, Infinity, true, true],
            type: "static",
            args: {value}                 
        }
        return [item];
    }
}

export function move(vector={}, old_vector={}) {
    let {position=0, velocity=0} = vector;
    let item = {
        interval: [-Infinity, Infinity, true, true],
        type: "motion",
        args: {vector: [position, velocity, 0, offset]}                 
    }
    return [item];
}

export function transition(v0, v1, t0, t1, easing) {
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
    return items;
}

export function interpolate(tuples) {
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
    return items;
}



