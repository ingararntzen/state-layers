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
            timeout = set_timeout(cursor.onchange, (high-ts) * 1000);
        }
    }

    cursor.query = function () {
        const offset = cursor.ctrl.now();
        return src_cache.query(offset);
    }



    /**
     * UPDATE API for CURSOR
     */
    
    /**
     * set value of cursor
     */
    cursor.set = function set(value) {
        const item = {
            id: random_string(10),
            itv: [null, null, true, true],
            type: "static",
            data: value                 
        };
        return update(cursor, item);
    }
    
    /**
     * motion only makes sense if variable cursor is restricted to number values,
     * which in turn implies that the cursor.src (Segment Layer) should be restricted
     * to number values. If non-number values occur - we simply replace with 0.
     * 
     * if position is omitted in vector - current position will be assumed
     * if timestamp is omittted in vector - current timestamp will be assumed
     * if velocity and acceleration are ommitted in vector - these will be set to zero.
     */

    cursor.motion = function motion(vector={}) {
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

        // items
        const items = []

        /**
         * if pos range is bounded low or high or both,
         * this potentially corresponds to multiple time ranges [[t0, t1]] 
         * where the motion position is legal  
         * low <= p <= high 
         */
        const time_ranges = motion_utils.time_ranges_from_pos_range([p1,v1,a1,t1], range);
        if (time_ranges.length == 0) {
            /* 
                no time_ranges exist
                
                motion pos will never be within the pos_range
                this means that at least one bound is defined
                and that pos < low for all t, or pos > high for all t
                create new motion vector which simply flatlines on the correct
                boundary condition for all t.
            */
            const [low_pos, high_pos] = range;
            items.push({
                id: random_string(10),
                itv: [null, null, true, true],
                type: "static",
                data: (high_pos != null && p1 > high_pos) ? high_pos : low_pos
            });
        } else {
            for (const time_range of time_ranges) {
                items.push({
                    id: random_string(10),
                    itv: [time_range[0], time_range[1], true, true],
                    type: "motion",
                    data: {position:p1, velocity:v1, acceleration:a1, timestamp:t1}
                });
            }
        }        
        return update(cursor, items);
    }

    // initialize
    cursor.ctrl = ctrl;
    cursor.src = src;
    return cursor;
}


/*
    CURSOR UPDATE API

    Implementation of updates is different depending on the type of stateProvider
    If the stateProvider is a collectionProvider, then the update is done by
    calling the update() method of the collectionProvider. If the stateProvider is
    a variableProvider, then the update is done by calling the set() method of the
    variableProvider.

    Moreover, the variableProvider only needs one item. If the item is bounded on the
    timeline, then the NearbyIndexVariable will invent the missing items to cover the 
    entire timeline. In contrast, the collectionProvider needs to be explicitly 
    updated with all the items to cover the entire timeline, which means we have to
    do that here.
    
    
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
 * at most two items - which are ordered and not overlapping
 * fill gaps so that the entire timeline is covered
 *  
 */
function fill_gaps(items) {    
    if (items.length == 0) {
        throw new Error("no items");
    }
    const check_middle = items.length == 2;

    // fill left if needed
    const first = items[0];
    const [first_low, first_high] = first.itv.slice(0, 2);
    const first_segment = load_segment(first.itv, first);

    if (first_low != null) { 
        const low_value = first_segment.query(first_low).value;
        items.push({
            id: random_string(10),
            itv: [null, first_low, true, false],
            type: "static",
            data: low_value
        });
    }
    // fill right item if needed
    const last = items.slice(-1)[0];
    const last_segment = load_segment(last.itv, last);
    const [last_low, last_high] = first.itv.slice(0,2);

    if (last_high != null) {
        const high_value = last_segment.query(last_high).value;
        items.push({
            id: random_string(10),
            itv: [last_high, null, false, true],
            type:"static",
            data: high_value
        });
    }
    // fill middle if needed
    if (check_middle) {
        const ep_1 = endpoint.from_interval(first.itv)[1];
        const ep_2 = endpoint.from_interval(last.itv)[0];
        const ep_low = endpoint.flip(ep_1);
        const ep_high = endpoint.flip(ep_2);
        items.push({
            id: random_string(10),
            itv: interval.from_endpoints(ep_low, ep_high),
            type:"static",
            data: first_segment.query(first_high)
        });
    }
    return items;
}

function update(cursor, items) {
    items = fill_gaps(items); 
    const provider = get_provider(cursor);
    if (is_variable_provider(provider)) {
        return provider.set(items);
    } else if (is_collection_provider(provider)) {
        return provider.update({insert:items, reset:true});
    }
}
