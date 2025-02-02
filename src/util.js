
/***************************************************************
    CLOCKS
***************************************************************/

/**
 * clocks counting in seconds
 */

const local = function () {
    return performance.now()/1000.0;
}

const epoch = function () {
    return new Date()/1000.0;
}

/**
 * the clock gives epoch values, but is implemented
 * using a high performance local clock for better
 * time resolution and protection against system 
 * time adjustments.
 */

export const CLOCK = function () {
    const t0_local = local();
    const t0_epoch = epoch();
    return {
        now: function () {
            return t0_epoch + (local() - t0_local)
        }
    }
}();


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