import { Cursor } from "./cursor_base.js";
import { 
    LOCAL_CLOCK_PROVIDER, 
    is_clock_provider 
} from "./provider_clock.js";
import { is_collection_provider } from "./provider_collection.js";
import { is_variable_provider } from "./provider_variable.js";
import { is_segments_layer } from "./layer_segments.js";
import * as srcprop from "./api_srcprop.js";
import { random_string, set_timeout, motion_utils } from "./util.js";
import { load_segment } from "./segments.js";
import { endpoint, interval } from "./intervals.js";

function is_finite_number(obj) {
    return (typeof obj == 'number') && isFinite(obj);
}

function check_number(name, obj) {
    if (!is_finite_number(obj)) {
        throw new Error(`${name} must be finite number ${obj}`);
    }
}

function check_range(obj) {
    if (Array.isArray(obj) && obj.length != 2) {
        throw new Error(`range must have two elements ${obj}`);
    }
    obj[0] == null || check_number("low", obj[0]);
    obj[1] == null || check_number("high", obj[1]);
}


export function variable_cursor(options={}) {

    const {src, ctrl=LOCAL_CLOCK_PROVIDER} = options;
    const cursor = new Cursor();

    // cache for src
    let src_cache;
    // timeout
    let timeout;

    // setup src property
    srcprop.addState(cursor);
    srcprop.addMethods(cursor);
    cursor.srcprop_register("ctrl");
    cursor.srcprop_register("src");

    cursor.srcprop_check = function (propName, obj) {
        if (propName == "ctrl") {
            if (!is_clock_provider(obj)) {
                throw new Error(`ctrl must be a clock provider ${obj}`);
            }
            return obj;
        }
        if (propName == "src") {
            if (!is_segments_layer(obj)) {
                throw new Error(`src must be a segments layer ${obj}`);
            }
            return obj;
        }
    }
    cursor.srcprop_onchange = function (propName, eArg) {
        if (cursor.src == undefined || cursor.ctrl == undefined) {
            return;
        }
        if (propName == "src") {
            if (eArg == "reset") {
                src_cache = cursor.src.createCache();
            } else {
                src_cache.clear();                
            }
        }
        detect_future_change();
        cursor.onchange();
    }

    function detect_future_change() {
        if (timeout) {
            timeout.cancel();
            timeout = undefined;
        }
        // ctrl 
        const ts = cursor.ctrl.now();
        // nearby from src
        const nearby = cursor.src.index.nearby(ts);
        const high = nearby.itv[1] || Infinity;        
        if (isFinite(high)) {
            const delta_ms = (high - ts) * 1000;
            timeout = set_timeout(() => {
                cursor.onchange();
            }, delta_ms);
        }
    }

    cursor.query = function () {
        const offset = cursor.ctrl.now();
        return src_cache.query(offset);
    }

    /**
     * UPDATE API for Variable Cursor
     */    
    cursor.set = function (value) {
        return cursor_set(cursor, value);
    }
    cursor.motion = function (vector) {
        return cursor_motion(cursor, vector);
    }
    
    // initialize
    cursor.ctrl = ctrl;
    cursor.src = src;
    return cursor;
}


/*
    CURSOR UPDATE API
*/

/**
 * set value of cursor
 */

function cursor_set(cursor, value) {
    const items = [{
        id: random_string(10),
        itv: [null, null, true, true],
        type: "static",
        data: value                 
    }];
    return update(cursor, items);
}

/**
 * set motion state
 *  
 * motion only makes sense if variable cursor is restricted to number values,
 * which in turn implies that the cursor.src (Segment Layer) should be
 * restricted to number values. 
 * If non-number values occur - we simply replace with 0.
 * Also, segment layer should have one segment/item in nearby center.
 * 
 * if position is omitted in vector - current position will be assumed
 * if timestamp is omittted in vector - current timestamp will be assumed
 * if velocity and acceleration are ommitted in vector 
 * - these will be set to zero.
 */

function cursor_motion(cursor, vector={}) {
    // get the current state of the cursor
    let {value:p0, offset:t0} = cursor.query();
    // ensure that p0 is number type
    if (typeof p0 !== 'number' || !isFinite(p0)) {
        p0 = 0;
    }
    // fetch new values from vector
    const {
        position:p1=p0,
        velocity:v1=0,
        acceleration:a1=0,
        timestamp:t1=t0,
        range=[null, null]
    } = vector;
    check_range(range);
    check_number("position", p1);
    check_number("velocity", v1);
    check_number("acceleration", a1);
    check_number("timestamp", t1);

    const items = [];

    /**
     * if pos range is bounded low or high or both,
     * this potentially corresponds to multiple time ranges [[t0, t1]] 
     * where the motion position is legal  
     * low <= p <= high 
     */
    const trfpr = motion_utils.time_ranges_from_pos_range;
    const time_ranges = trfpr([p1,v1,a1,t1], range);
    // pick a time range which contains t1
    const ts = cursor.ctrl.now();
    const time_range = time_ranges.find((tr) => {
        return tr[0] <= ts && ts <= tr[1];
    });
    if (time_range != undefined) {
        
        items.push({
            id: random_string(10),
            itv: [null, time_range[0], true, false],
            type: "static",
            data: range[0]
        });
        items.push({
            id: random_string(10),
            itv: [time_range[0], time_range[1], true, true],
            type: "motion",
            data: {position:p1, velocity:v1, acceleration:a1, timestamp:t1}
        });
        items.push({
            id: random_string(10),
            itv: [time_range[1], null, false, true],
            type: "static",
            data: range[1]
        });
    } else {
        /* 
            no time_range found
            
            p1 is outside the pos_range
            if p1 is less than low, then use low
            if p1 is greater than high, then use high
        */
        items.push({
            id: random_string(10),
            itv: [null, null, true, true],
            type: "static",
            data: p1
        });
    }
    return update(cursor, items);
}



function get_provider(cursor) {
    if (cursor.src == undefined) {
        throw new Error(`Drop update: src undefined ${cursor.src}`);
    }
    if (cursor.src.src == undefined) {
        throw new Error(`Drop update: src.src undefined ${cursor.src.src}`)
    }
    return cursor.src.src;
}

function update(cursor, items) {
    const provider = get_provider(cursor);
    if (is_variable_provider(provider)) {
        return provider.set(items);
    } else if (is_collection_provider(provider)) {
        return provider.update({insert:items, reset:true});
    }
}
