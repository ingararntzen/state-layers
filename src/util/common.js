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

export function is_finite_number(obj) {
    return (typeof obj == 'number') && isFinite(obj);
}

export function check_number(name, obj) {
    if (!is_finite_number(obj)) {
        throw new Error(`${name} must be finite number ${obj}`);
    }
}

/**
 * convenience function to render a cursor 
 */
export function render_cursor (cursor, selector, options={}) {
    const {delay=200, render, novalue} = options;
    const elems = document.querySelector(selector);
    function _render(state) {
        if (state.value == undefined && novalue != undefined) {
            state.value = novalue;
        }
        if (render != undefined) {
            render(state, elems);
        } else {
            elems.textContent = (state.value != undefined) ? `${state.value}` : "";
        }
    }
    return cursor.bind(_render, delay);
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


// webpage clock - performance now - seconds
export const local_clock = function local_clock () {
    return {
        now: () => {
            return performance.now()/1000.0;
        }
    }
}();

// system clock - epoch - seconds
export const local_epoch = function local_epoch () {
    return {
        now: () => {
            return new Date()/1000.0;
        }
    }
}();

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
 * Improved set_timeout
 * 
 * Timeout is defined by a target_ms reading of performance.now().
 * Callback is not invoked until performance.now() >= target_ms. 
 * 
 * This protects against a weakness in basic setTimeout, which may
 * occationally invoke the callback too early. 
 * 
 * schedule timeout 1 ms late, to reduce the likelihood of 
 * having to reschedule a timeout 
 */
export function set_timeout (callback, delta_ms) {
    let ts = performance.now();
    delta_ms = Math.max(delta_ms, 0);
    let target_ms = ts + delta_ms;
    let tid;
    function cancel_timeout() {
        clearTimeout(tid);
    }
    function handle_timeout() {
        const delta_ms = target_ms - performance.now();
        if (delta_ms > 0) {
            // reschedule timeout
            tid = setTimeout(handle_timeout, delta_ms + 1);
        } else {
            callback();
        }
    }
    tid = setTimeout(handle_timeout, delta_ms + 1);
    return {cancel:cancel_timeout};
}

/**
 *  Implements deterministic projection based on initial conditions 
 *  - motion vector describes motion under constant acceleration
 *
 *  motion transition 
 * 
 *  transition from time domain to position under constant acceleration is given by
 *  given initial vector [p0,v0,a0,t0]
 *  p(t) = p0 + v0*(t-t0) + 0.5*a0*(t-t0)*(t-t0)
 *  v(t) = v0 + a0*(t-t0)
 *  a(t) = a0
 *  t(t) = t
 */
export function motion_calculate(vector,t) {
    const [p0,v0,a0,t0] = vector;
    const d = t - t0;
    const p = p0 + v0*d + 0.5*a0*Math.pow(d,2);
    const v = v0 + a0*d;
    const a = a0;
    return [p,v,a,t];
}

/**
 * Given motion determined from [p0,v0,a0,t0].
 * Given equation p(t) = p0 + v0*(t-t0) + 0.5*a0*(t-t0)^2 == p1
 * Calculate if equation has solutions for some real number t.
 * A solution exists if determinant of quadratic equation is non-negative
 * (v0^2 - 2a0(p0-p1)) >= 0
 */
function motion_has_real_solutions(vector, p1) {
    const [p0,v0,a0,t0] = vector;
    return (Math.pow(v0,2) - 2*a0*(p0-p1)) >= 0.0
};

/**
 * Given motion determined from [p0,v0,a0,t0].
 * Given equation p(t) = p0 + v0*(t-t0) + 0.5*a0*(t-t0)^2 == p1
 * Calculate and return real solutions, in ascending order.
*/  
function motion_get_real_solutions (vector, p1) {
    const [p0,v0,a0,t0] = vector;
    // Constant Position
    if (a0 === 0.0 && v0 === 0.0) {
        if (p0 != p1) return [];
        else {
            // any t is a solution
            // NOTE: has real solutions is true
            return undefined;
        };
    }
    // Constant non-zero Velocity
    if (a0 === 0.0) return [t0 + (p1-p0)/v0];
    // Constant Acceleration
    if (motion_has_real_solutions(vector, p1) === false) return [];
    // Exactly on solution
    var discriminant = Math.pow(v0,2) - 2*a0*(p0-p1);
    if (discriminant === 0.0) {
        return [t0-v0/a0];
    }
    var sqrt = Math.sqrt(Math.pow(v0,2) - 2*a0*(p0-p1));
    var d1 = t0 + (-v0 + sqrt)/a0;
    var d2 = t0 + (-v0 - sqrt)/a0;
    return [Math.min(d1,d2),Math.max(d1,d2)];
};

/*
    calculate time range for given position range

    motion transition from time to position is given by
    p(t) = p0 + v*t + 0.5*a*t*t
    find solutions for t so that 
    p(t) = pos

    do this for both values in range [low,high]
    accumulate all candidate solutions t in ascending order
    avoid duplicates
    this can accumulate 0,1,2,3,4 solution
    if 0 solutions - undefined (motion does not intersect with range ever) 
    if 1 solutions - udefined (motion only intersects with range tangentially at one t)
    if 2 solutions - [0,1] (motion intersects with range at two times)
    if 3 solutions - [0,2] (motion intersects with range at three times)
    if 4 solutions - [0,1] and [2,3]

    returns a list of range candidates (at most two but only with acceleration)
*/
function motion_calculate_time_ranges(vector, pos_range) {
    const [p0,v0,a0,t0] = vector;
    let [low, high] = pos_range;
    if (low == null) low = -Infinity;
    if (high == null) high = Infinity;

    // [<-, ->]
    if (low == -Infinity && high == Infinity) {
        // no pos range == entire value space => time range entire timeline
        return [[null, null]];
    } 

    // [FLAT LINE]
    // pos is either within pos range for all t or never  
    if (v0 === 0.0 && a0 === 0.0) {
        // both low and high bound
        return (p0 >= low && p0 <= high) ? [[null, null]] : [];
    }

    // aggregate solutions
    let solutions = [];
    if (-Infinity < low) {
        solutions.push(...motion_get_real_solutions(vector, low));
    } 
    if (high < Infinity) {
        solutions.push(...motion_get_real_solutions(vector, high));
    }
    // remove duplicates
    solutions = [...new Set(solutions)];
    // sort in ascending order
    solutions.sort((a,b) => a-b);

    // [<-, HIGH]
    if (low == -Infinity) {
        // only high bound
        if (solutions.length == 0) {
            // parabola not touching low
            // pos < high or pos > high for all t - just test with t0
            return (p0 <= high) ? [[null, null]] : [];
        }
        else if (solutions.length == 1) {
            if (a0 > 0.0) {
                // parabola - touching high from overside
                // pos > high for all t
                return [];
            } else if (a0 < 0.0) {
                // parabola touching low from underside
                // pos < high for all t
                return [[null, null]];
            } else {
                // a0 == 0.0 > straigth line
                if (v0 > 0.0) {
                    // pos <= high for all t <= solutions[0]
                    return [[null, solutions[0]]];
                } else {
                    // pos <= high for t >= solutions[0]
                    return [[solutions[0], null]];
                }
            }
        } else if (solutions.length == 2) {
            // parabola
            if (a0 > 0.0) {
                // one time range between solutions
                return [[solutions[0], solutions[1]]];
            } else if (a0 < 0.0) {
                // one time range on each side 
                return [[null, solutions[0]], [solutions[1], null]];
            }
        }


    // [LOW, ->]
    } else if (high == Infinity) {
        // only low bound
        if (solutions.length == 0) {
            // parabola not touching low
            // pos > low or pos < low for all t - just test with t0
            return (p0 >= low) ? [[null, null]] : [];
        }
        else if (solutions.length == 1) {
            if (a0 > 0.0) {
                // parabola - touching low from overside
                // pos > low for all t
                return [[null, null]];
            } else if (a0 < 0.0) {
                // parabola touching low from underside
                // pos < low for all t
                return [];
            } else {
                // a0 == 0.0 > straigth line
                if (v0 > 0.0) {
                    // pos >= low for all t >= solutions[0]
                    return [[solutions[0], null]];
                } else {
                    // pos >= low for t <= solutions[0]
                    return [[null, solutions[0]]];
                }
            }
        } else if (solutions.length == 2) {
            // parabola
            if (a0 > 0.0) {
                // one time range on each side 
                return [[null, solutions[0]], [solutions[1], null]];
            } else if (a0 < 0.0) {
                // one time range between solutions
                return [[solutions[0], solutions[1]]];
            }
        }

    // [LOW, HIGH]
    } else {
        // both low and high bound
        if (solutions.length == 0) return [];
        if (solutions.length == 1) return [];
        if (solutions.length == 2) return [[solutions[0], solutions[1]]];
        if (solutions.length == 3) return [[solutions[0], solutions[2]]];
        if (solutions.length == 4) return [[solutions[0], solutions[1]], [solutions[2], solutions[3]]];
    }
}

function motion_check_range(obj) {
    if (Array.isArray(obj) && obj.length != 2) {
        throw new Error(`range must have two elements ${obj}`);
    }
    obj[0] == null || check_number("low", obj[0]);
    obj[1] == null || check_number("high", obj[1]);
}

export const motion_utils = {
    calculate: motion_calculate,
    has_real_solutions: motion_has_real_solutions,
    get_real_solutions: motion_get_real_solutions,
    calculate_time_ranges: motion_calculate_time_ranges,
    check_range: motion_check_range
}
