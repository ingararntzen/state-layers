import { endpoint, interval } from "./intervals";


// ovverride modulo to behave better for negative numbers
export function mod(n, m) {
    return ((n % m) + m) % m;
};

export function divmod(x, base) {
    let n = Math.floor(x / base)
    let r = mod(x, base);
    return [n, r];
}


/*
    similar to range function in python
*/

export function range (start, end, step = 1, options={}) {
    const result = [];
    const {include_end=false} = options;
    if (step === 0) {
        throw new Error('Step cannot be zero.');
    }
    if (start < end) {
        for (let i = start; i < end; i += step) {
          result.push(i);
        }
    } else if (start > end) {
        for (let i = start; i > end; i -= step) {
          result.push(i);
        }
    }
    if (include_end) {
        result.push(end);
    }
    return result;
}


/**
 * Create a single state from a list of states, using a valueFunc
 * state:{value, dynamic, offset}
 * 
 */

export function toState(sources, states, offset, options={}) {
    let {valueFunc, stateFunc} = options; 
    if (valueFunc != undefined) {
        let value = valueFunc({sources, states, offset});
        let dynamic = states.map((v) => v.dymamic).some(e=>e);
        return {value, dynamic, offset};
    } else if (stateFunc != undefined) {
        return {...stateFunc({sources, states, offset}), offset};
    }
    // no valueFunc or stateFunc
    if (states.length == 0) {
        return {value:undefined, dynamic:false, offset}
    }
    // fallback - just use first state
    let state = states[0];
    return {...state, offset}; 
}


/**
 * check input items to local state providers
 */

export function check_input(items) {
    if (!Array.isArray(items)) {
        throw new Error("Input must be an array");
    }
    // make sure that intervals are well formed
    for (const item of items) {
        item.itv = interval.from_input(item.itv);
    }
    // sort items based on interval low endpoint
    items.sort((a, b) => {
        let a_low = endpoint.from_interval(a.itv)[0];
        let b_low = endpoint.from_interval(b.itv)[0];
        return endpoint.cmp(a_low, b_low);
    });
    // check that item intervals are non-overlapping
    for (let i = 1; i < items.length; i++) {
        let prev_high = endpoint.from_interval(items[i - 1].itv)[1];
        let curr_low = endpoint.from_interval(items[i].itv)[0];
        // verify that prev high is less that curr low
        if (!endpoint.lt(prev_high, curr_low)) {
            throw new Error("Overlapping intervals found");
        }
    }
    return items;
}


export function random_string(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    for(var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}


/**
 * test if object implements callback interface
 */

export function implements_callback (obj) {
    const methods = ["add_callback", "remove_callback"];
    for (const prop of methods) {
        if (!(prop in obj)) return false;
        if (typeof obj[prop] != 'function') return false;
    }
    return true;
}

/**
 * clock providers must have a value property
 */
export function is_clock_provider(obj) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, "value");
    return !!(descriptor && descriptor.get);
}

/**
 * variable providers must have a value property
 * and also implement callback interface
 */
export function is_variable_provider(obj) {
    if (!implements_callback(obj)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(obj, "value");
    return !!(descriptor && descriptor.get);
}

/**
 * collection providers must provide get_all function
 * and also implement callback interface
 */
export function is_collection_provider(obj) {
    if (!callback.implements_callback(obj)) return false;
    if (!("get_all" in obj)) return false;
    if (typeof obj.get_all != 'function') return false;
    return true;
}
