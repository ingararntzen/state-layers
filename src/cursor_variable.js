import { Cursor } from "./cursor_base.js";
import { is_items_layer, items_layer } from "./layer_items.js";
import * as srcprop from "./util/api_srcprop.js";
import { random_string, set_timeout, check_number, motion_utils } from "./util/common.js";
import { is_clock_cursor, clock_cursor } from "./cursor_clock.js";
import { is_clock_provider, LOCAL_CLOCK_PROVIDER } from "./provider_clock.js";
import { is_collection_provider } from "./provider_collection.js";
import { is_variable_provider } from "./provider_variable.js";
import { load_segment } from "./util/segments.js";

const check_range = motion_utils.check_range;

/*****************************************************
 * VARIABLE CURSOR
 *****************************************************/

/**
 * "src" is a layer or a stateProvider
 * "clock" is a clockCursor or a clockProvider
 * 
 * - clockProvider is wrapped as clockCursor
 * to ensure that "clock" property of cursors is always a cursor
 * 
 * if no "clock" is provided - local clockProvider is used
 * 
 * - stateProvider is wrapped as itemsLayer
 * to ensure that "src" property of cursors is always a layer
 * this also ensures that variable cursor can easily
 * support live recording, which depends on the nearbyindex of the layer.
 * 
 */

/**
 * TODO - media control is a special case of variable cursors
 * where src layer is number type and defined on the entire
 * timeline. And protected agoinst other types of state
 * Could perhaps make a special type of layer for this,
 * and then make a special type of control cursor with
 * the appropriate restriction on the src layer.
 */


export function variable_cursor(ctrl, src, options={}) {

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

    cursor.srcprop_check = function (propName, obj=LOCAL_CLOCK_PROVIDER) {
        if (propName == "ctrl") {
            if (is_clock_provider(obj)) {
                obj = clock_cursor(obj);
            }
            if (!is_clock_cursor(obj)) {
                throw new Error(`"ctrl" property must be a clock cursor ${obj}`);
            }
            return obj;
        }
        if (propName == "src") {
            if (is_collection_provider(obj) || is_variable_provider(obj)) {
                obj = items_layer({src:obj});
            }
            if (!is_items_layer(obj)) {
                throw new Error(`"src" property must be an item layer ${obj}`);
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
        // ctrl may change if clockProvider is reset - but
        // this does not require any particular changes to the src cache        
        detect_future_event();
        cursor.onchange();
    }

    /**
     * cursor.ctrl defines an active region of cursor.src (layer)
     * at some point in the future, the cursor.ctrl will leave this region.
     * in that moment, cursor should reevaluate its state - so we need to 
     * detect this event by timeout  
     */

    function detect_future_event() {
        if (tid) {tid.cancel();}
        const ts = cursor.ctrl.value;
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

    cursor.query = function query(local_ts) {
        const offset = cursor.ctrl.query(local_ts).value;
        return src_cache.query(offset);
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
    cursor.options = options;
    cursor.ctrl = ctrl;
    cursor.src = src;
    return cursor;
}


/******************************************************************
 * CURSOR UPDATE API
 * ***************************************************************/

/**
 * set value of cursor
 */

function set_value(cursor, value) {
    let items = [];
    if (value != undefined) {
        items = [{
            id: random_string(10),
            itv: [null, null, true, true],
            type: "static",
            data: value              
        }];
    }
    return cursor_update (cursor, items);
}

/**
 * set motion state
 *  
 * motion only makes sense if variable cursor is restricted to number values,
 * which in turn implies that the cursor.src (Items Layer) should be
 * restricted to number values. 
 * If non-number values occur - we simply replace with 0.
 * Also, items layer should have a single item in nearby center.
 * 
 * if position is omitted in vector - current position will be assumed
 * if timestamp is omitted in vector - current timestamp will be assumed
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
    const ts = cursor.ctrl.value;

    const time_range = time_ranges.find((tr) => {
        const low = tr[0] ?? -Infinity;
        const high = tr[1] ?? Infinity;
        return low <= ts && ts <= high;
    });
    if (time_range != undefined) {
        const [low, high] = time_range;
        items.push({
            id: random_string(10),
            itv: [low, high, true, true],
            type: "motion",
            data: [p1, v1, a1, t1]
        });
        // add left if needed
        if (low != null) {
            items.push({
                id: random_string(10),
                itv: [null, low, true, false],
                type: "static",
                data: range[0]
            });
        }
        // add right if needed
        if (high != null) {
            items.push({
                id: random_string(10),
                itv: [high, null, false, true],
                type: "static",
                data: range[1]
            });
        }
    } else {
        /* 
            no time_range found
            
            p1 is outside the pos_range
            if p1 is less than low, then use low
            if p1 is greater than high, then use high
        */
        const val = (p1 < range[0]) ? range[0] : range[1];
        items.push({
            id: random_string(10),
            itv: [null, null, true, true],
            type: "static",
            data: val
        });
    }
    return cursor_update (cursor, items);
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
    return cursor_update (cursor, items);
}

/**
 * set interpolation
 * 
 */

function set_interpolation(cursor, tuples, duration) {
    const now = cursor.ctrl.value;
    tuples = tuples.map(([v,t]) => {
        check_number("ts", t);
        check_number("val", v);
        return [v, now + t];
    })

    // inflate segment to calculate boundary conditions
    const seg = load_segment([null, null, true, true], {
        type: "interpolation",
        data: tuples
    });

    const t0 = now;
    const t1 = t0 + duration;
    const v0 = seg.state(t0).value;
    const v1 = seg.state(t1).value;
    const items = [
        {
            id: random_string(10),
            itv: [-Infinity, t0, true, false],
            type: "static",
            data: v0
        },
        {
            id: random_string(10),
            itv: [t0, t1, true, false],
            type: "interpolation",
            data: tuples
        },
        {
            id: random_string(10),
            itv: [t1, Infinity, true, true],
            type: "static",
            data: v1
        }
    ]
    return cursor_update (cursor, items);
}


function cursor_update(cursor, items) {
    const {record=false} = cursor.options;
    if (record) {
        return cursor.src.append(items, cursor.ctrl.value);
    } else {
        return cursor.src.update({insert:items, reset:true});
    }
}