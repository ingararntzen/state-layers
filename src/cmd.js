
import { is_collection_provider } from "./provider_collection.js";
const METHODS = {assign, move, transition, interpolate};


export function cmd (target) {
    if (!(is_collection_provider(target))) {
        throw new Error(`target.src must be stateprovider ${target}`);
    }
    let entries = Object.entries(METHODS)
        .map(([name, method]) => {
            return [
                name,
                function(...args) { 
                    let items = method.call(this, ...args);
                    return target.update({insert:items, reset:true});  
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
            data: value                 
        }
        return [item];
    }
}

function move(vector) {
    let item = {
        itv: [-Infinity, Infinity, true, true],
        type: "motion",
        data: vector  
    }
    return [item];
}

function transition(v0, v1, t0, t1, easing) {
    let items = [
        {
            itv: [-Infinity, t0, true, false],
            type: "static",
            data: v0
        },
        {
            itv: [t0, t1, true, false],
            type: "transition",
            data: {v0, v1, t0, t1, easing}
        },
        {
            itv: [t1, Infinity, true, true],
            type: "static",
            data: v1
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
            data: v0
        },
        {
            itv: [t0, t1, true, false],
            type: "interpolation",
            data: tuples
        },
        {
            itv: [t1, Infinity, true, true],
            type: "static",
            data: v1
        }
    ]    
    return items;
}



