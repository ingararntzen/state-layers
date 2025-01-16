
import { StateProviderBase} from "./bases";
const METHODS = {assign, move, transition, interpolate};


export function cmd (target) {
    if (!(target instanceof StateProviderBase)) {
        throw new Error(`target.src must be stateprovider ${target}`);
    }
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

function assign(value) {
    if (value == undefined) {
        return [];
    } else {
        let item = {
            itv: [-Infinity, Infinity, true, true],
            type: "static",
            args: {value}                 
        }
        return [item];
    }
}

function move(vector) {
    let item = {
        itv: [-Infinity, Infinity, true, true],
        type: "motion",
        args: vector  
    }
    return [item];
}

function transition(v0, v1, t0, t1, easing) {
    let items = [
        {
            itv: [-Infinity, t0, true, false],
            type: "static",
            args: {value:v0}
        },
        {
            itv: [t0, t1, true, false],
            type: "transition",
            args: {v0, v1, t0, t1, easing}
        },
        {
            itv: [t1, Infinity, true, true],
            type: "static",
            args: {value: v1}
        }
    ]
    return items;
}

function interpolate(tuples) {
    let [v0, t0] = tuples[0];
    let [v1, t1] = tuples[tuples.length-1];

    let items = [
        {
            itv: [-Infinity, t0, true, false],
            type: "static",
            args: {value:v0}
        },
        {
            itv: [t0, t1, true, false],
            type: "interpolation",
            args: {tuples}
        },
        {
            itv: [t1, Infinity, true, true],
            type: "static",
            args: {value: v1}
        }
    ]    
    return items;
}



