
import { StateProviderBase, CursorBase } from "./bases";
const METHODS = {assign, move, transition, interpolate};


export function cmd (target) {
    if (!(target instanceof CursorBase)) {
        throw new Error(`target must be cursor ${target}`);
    }
    if (!(target.src instanceof StateProviderBase)) {
        throw new Error(`target.src must be stateprovider ${target}`);
    }
    let entries = Object.entries(METHODS)
        .map(([name, method]) => {
            return [
                name,
                function(...args) { 
                    let items = method.call(this, target, ...args);
                    return target.src.update(items);  
                }
            ]
        });
    return Object.fromEntries(entries);
}

function assign(target, value) {
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

function move(target, vector={}) {
    let {value, rate, offset} = target.query();
    let {position=value, velocity=rate} = vector;
    let item = {
        interval: [-Infinity, Infinity, true, true],
        type: "motion",
        args: {position, velocity, timestamp:offset}                 
    }
    return [item];
}

function transition(target, v0, v1, t0, t1, easing) {
    let items = [
        {
            interval: [-Infinity, t0, true, false],
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

function interpolate(target, tuples) {
    let [v0, t0] = tuples[0];
    let [v1, t1] = tuples[tuples.length-1];

    let items = [
        {
            interval: [-Infinity, t0, true, false],
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



