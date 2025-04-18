import { playback_cursor } from "./cursor_playback.js";
import { random_string, check_number, motion_utils } from "./util/common.js";
import { load_segment } from "./util/segments.js";

/*****************************************************
 * VARIABLE CURSOR
 *****************************************************/

/**
 * cursor supporting updates
 *  
 * "src" is a layer which is mutable
 * "ctrl" is fixed-rate cursor
 * 
 * variable may also support recording
 */

export function variable_cursor(options={}) {

    const {ctrl, src, record=false} = options;

    const cursor = new playback_cursor({ctrl, src, mutable: true});

    /**
     * override to implement restrictions on src and ctrl
     */
    const original_srcprop_check = cursor.srcprop_check;

    cursor.srcprop_check = function (propName, obj) {
        obj = original_srcprop_check(propName, obj);
        if (propName == "ctrl") {
            if (!obj.fixedRate) {
                throw new Error(`"ctrl" property must be a fixedrate cursor ${obj}`);
            }
            return obj;
        }
        if (propName == "src") {
            if (!obj.mutable) {
                throw new Error(`"src" property must be mutable layer ${obj}`);
            }
            return obj;
        }
    }
        

    /**********************************************************
     * UPDATE API
     **********************************************************/
    cursor.set = (value) => {
        const items = create_set_items(cursor, value);
        return cursor.update(items);
    }
    cursor.motion = (vector) => {
        const items = create_motion_items(cursor, vector);
        return cursor.update(items);
    }
    cursor.transition = ({target, duration, easing}) => { 
        const items = create_transition_items(cursor, target, duration, easing);
        return cursor.update(items);

    }
    cursor.interpolate = ({tuples, duration}) => {
        const items = create_interpolation_items(cursor, tuples, duration);
        return cursor.update(items);
    }
    
    cursor.update = (items) => {
        if (cursor.mutable  && cursor.src.mutable) {
            throw new Error("cursor update not allowed, readonly");
        }
        if (record) {
            return cursor.src.append(items, cursor.ctrl.value);
        } else {
            return cursor.src.update({insert:items, reset:true});
        }
    }

    return cursor;
}


/******************************************************************
 * CURSOR UPDATE API
 * ***************************************************************/

/**
 * creaate items for set operation
*/
function create_set_items(cursor, value) {
    let items = [];
    if (value != undefined) {
        items = [{
            id: random_string(10),
            itv: [null, null, true, true],
            type: "static",
            data: value              
        }];
    }
    return items;
}

/**
 * create items for motion operation
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

export function create_motion_items(cursor, vector={}) {

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
    motion_utils.check_range(range);
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
    return items;
}

/**
 * create items for transition operation
 *  
 * transition to target position using in <duration> seconds.
 */

function create_transition_items(cursor, target, duration, easing) {

    const {value:v0, offset:t0} = cursor.query();
    const v1 = target;
    const t1 = t0 + duration;
    check_number("position", v0);
    check_number("position", v1);
    check_number("position", t0);
    check_number("position", t1);
    return [
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
    ];
}

/**
 * create items for interpolation operation
 */

function create_interpolation_items(cursor, tuples, duration) {

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
    return [
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
    ];
}
