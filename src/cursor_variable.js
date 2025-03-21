import { Cursor } from "./cursor_base.js";
import { 
    LOCAL_CLOCK_PROVIDER, 
    is_clock_provider 
} from "./provider_clock.js";
import { is_collection_provider } from "./provider_collection.js";
import { is_variable_provider } from "./provider_variable.js";
import { is_segments_layer } from "./layer_segments.js";
import * as srcprop from "./api_srcprop.js";
import { random_string, set_timeout, check_number, motion_utils } from "./util.js";
const check_range = motion_utils.check_range;

export function variable_cursor(options={}) {

    const {src, ctrl=LOCAL_CLOCK_PROVIDER} = options;
    const cursor = new Cursor();

    // cache for src
    let src_cache;
    // timeout
    let tid;

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
        detect_future_event();
        cursor.onchange();
    }

    /**
     * cursor.ctrl (clock) defines an active region of cursor.src (layer)
     * at some point in the future, the cursor.ctrl will leave this region.
     * in that moment, cursor should reevaluate its state - so we need to 
     * detect this event by timeout  
     */

    function detect_future_event() {
        if (tid) {tid.cancel();}
        // ctrl 
        const ts = cursor.ctrl.now();
        // nearby from src
        const nearby = cursor.src.index.nearby(ts);
        const region_high = nearby.itv[1] || Infinity;        

        if (region_high == Infinity) {
            // no future leave event
            return;
        }
        const delta_ms = (region_high - ts) * 1000;
        tid = set_timeout(() => {
            cursor.onchange();
        }, delta_ms);
    }

    cursor.query = function query() {
        const offset = cursor.ctrl.now();
        return src_cache.query(offset);
    }

    /*
        return the currently active items of the cursor
        - basis for segment and current value
        - typically just one
    */
    cursor.get_items = function get_items() {
        const offset = cursor.ctrl.now();
        return cursor.src.get_items(offset);
    }
    
    /**
     * UPDATE API for Variable Cursor
     */    
    cursor.set = function set(value) {
        return set_value(cursor, value);
    }
    cursor.motion = function motion(vector) {
        return set_motion(cursor, vector);
    }
    cursor.transition = function transition({target, duration, easing}) {
        return set_transition(cursor, target, duration, easing);
    }
    cursor.interpolate = function interpolate ({tuples, duration}) {
        return set_interpolation(cursor, tuples, duration);
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

function set_value(cursor, value) {
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

function set_motion(cursor, vector={}) {
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
    const ctr = motion_utils.calculate_time_ranges;
    const time_ranges = ctr([p1,v1,a1,t1], range);
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

/**
 * set transition - to target position using in <duration> seconds.
 */

function set_transition(cursor, target, duration, easing) {
    const {value:v0, offset:t0} = cursor.query();
    const v1 = target;
    const t1 = t0 + duration;
    check_number("position", v0);
    check_number("position", v1);
    check_number("position", t0);
    check_number("position", t1);
    let items = [
        {
            id: random_string(10),
            itv: [null, t0, true, false],
            type: "static",
            data: v0
        },
        {
            id: random_string(10),
            itv: [t0, t1, true, true],
            type: "transition",
            data: {v0, v1, t0, t1, easing}
        },
        {
            id: random_string(10),
            itv: [t1, null, false, true],
            type: "static",
            data: v1
        }
    ]
    return update(cursor, items);
}

/**
 * set interpolation
 * 
 * assumes timestamps are in range [0,1]
 * scale timestamps to duration and offset by t0
 * assuming interpolation starts at t0
 */

function set_interpolation(cursor, tuples, duration) {
    const now = cursor.ctrl.now();
    tuples = tuples.map(([v,t]) => {
        check_number("ts", t);
        check_number("val", v);
        return [v, now + t*duration];
    })
    const [v0, t0] = tuples[0];
    const [v1, t1] = tuples[tuples.length-1];
    const items = [
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
    return update(cursor, items);
}


/**
 * get stateProvider from cursor
 * check if it exists
 * check if it is a variable provider
 */

function get_provider(cursor) {
    if (cursor.src == undefined) {
        throw new Error(`Drop update: src undefined ${cursor.src}`);
    }
    if (cursor.src.src == undefined) {
        throw new Error(`Drop update: src.src undefined ${cursor.src.src}`)
    }
    return cursor.src.src;
}

/**
 * update the stateProvider with items according to type of provider
 */

function update(cursor, items) {
    const provider = get_provider(cursor);
    if (is_variable_provider(provider)) {
        return provider.set(items);
    } else if (is_collection_provider(provider)) {
        return provider.update({insert:items, reset:true});
    }
}
