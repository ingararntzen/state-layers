import * as eventify from "./util/api_eventify.js";
import * as callback from "./util/api_callback.js";
import { bind, release } from "./util/cursor_monitor.js";
import { random_string, set_timeout, check_number, motion_utils } from "./util/common.js";
import { load_segment } from "./util/segments.js";
import { interval } from "./util/intervals.js";


/************************************************
 * CURSOR
 ************************************************/  

/**
 * Abstract base class for Cursor interface
 */

export class Cursor {
    
    constructor(options={}) {

        // callbacks
        callback.addState(this);
        // define change event
        eventify.addState(this);
        this.eventifyDefine("change", {init:true});

        // timeout
        this._tid;
        // polling
        this._pid;
    }

    // properties defaults
    get isNumberOnly () {return false;}
    get isReadOnly () {return true};
    get isLeaf () {return false;}
    get isFixedRate () {return false}

    /**********************************************************
     * QUERY API
     **********************************************************/

    query(local_ts) {
        throw new Error("query() not implemented");
    }

    get value () {return this.query().value};

    get () {
        return this.query().value;
    }

    /*
        Eventify: immediate events
    */
    eventifyInitEventArgs(name) {
        if (name == "change") {
            return [this.query()];
        }
    }
    
    /**********************************************************
     * BIND RELEASE (convenience)
     **********************************************************/

    bind(callback, delay, options={}) {
        return bind(this, callback, delay, options);
    }
    release(handle) {
        return release(handle);
    }

    // invoked by subclass whenever cursor has changed
    onchange() {
        this.notify_callbacks();
        this.eventifyTrigger("change", this.query());
        this.detect_future_event();
    }

    /**********************************************************
     * DETECT FUTURE EVENT
     **********************************************************/
    /**
     * fixed rate cursors never change their behavior - and
     * consequently never has to invoke any callbacks / events
     * 
     * All other cursors may change behaviour abruptly at a future time.
     * If this change is due to a state change - either in (src) layer or 
     * (ctrl) cursor - events will be triggered. Importanly though, 
     * cursors may also change behaviour abruptly at specific moments
     * in time. This happens as the (ctrl) cursor leaves
     * the current region of the (src) layer, and enters into the next region.
     * 
     * This event must be detected, ideally precisely at the right moment, 
     * so that the cursor can always expose the correct value. If the (ctrl)
     * behaves deterministically, the next event can be calculated ahead of time, 
     * and then detected by a timeout. Otherwise, the fallback solution is
     * polling. 
     * 
     * NOTE consumers of cursors might poll the cursor, thus causing the event to
     * be detected. However, in circumstances where the (src) layer region is
     * static, consumers must be able to turn polling off, and as a consequence,
     * they will depend on a change event from the cursor, in order to detect
     * the new behavior. 
     * 

     */
    detect_future_event() {
        // clear pending timeouts 
        if (this._tid != undefined) { 
            this._tid.cancel(); 
        }
        if (this._pid != undefined) { 
            clearInterval(this._pid); 
        }
        // no future timeout if cursor itself is fixedRate
        if (this.isFixedRate) {
            return;
        }
        // all other cursors must have (src) and (ctrl)
        if (this.ctrl == undefined) {
            throw new Error("cursor.ctrl can not be undefined with isFixedRate=false");
        }
        if (this.src == undefined) {
            throw new Error("cursor.src can not be undefined with isFixedRate=false");
        }

        // current state of cursor.ctrl 
        const {value:pos0, dynamic, offset:ts0} = this.ctrl.query();

        // no future timeout if cursor.ctrl is static
        if (!dynamic) {
            return;
        }

        // current region of cursor.src
        const src_nearby = this.src.index.nearby(pos0);
        const src_region_low = src_nearby.itv[0] ?? -Infinity;
        const src_region_high = src_nearby.itv[1] ?? Infinity;

        // no future timeout if the region is infinite 
        if (src_region_low == -Infinity && src_region_high == Infinity) {
            // will never leave region
            return;
        }

        // check if condition for clock timeout is met
        if (this.ctrl.isFixedRate) {
            /* 
                cursor.ctrl is fixed rate (clock)
                future timeout when cursor.ctrl leaves src_region (on the right)
            */
            const vector = [pos0, this.ctrl.rate, 0, ts0];
            const target = src_region_high
            this.timeout(vector, target);
            return;
        }

        // check if conditions for motion timeout are met
        // cursor.ctrl.ctrl must be fixed rate
        // cursor.ctrl.src must be leaf (so that we can get items) 
        if (this.ctrl.ctrl.isFixedRate && this.ctrl.src.isLeaf) {
            /* 
                possible timeout associated with leaving region
                through either region_low or region_high.

                However, this can only be predicted if cursor.ctrl
                implements a deterministic function of time.
                This can be known only if cursor.ctrl.src is a leaf layer.
                and a single active item describes either a motion or a transition 
                (with linear easing).                
            */
            const active_items = this.ctrl.src.get_items(ts0);
            if (active_items.length == 1) {
                const active_item = active_items[0];
                if (active_item.type == "motion") {
                    const [p,v,a,t] = active_item.data;
                    // TODO calculate timeout with acceleration too
                    if (a == 0.0) {
                        // figure out which region boundary we hit first
                        const target = (v > 0) ? src_region_high : src_region_low;
                        const vector = [pos0, v, 0, ts0];
                        this.timeout(vector, target);
                        return;
                    }
                } else if (active_item.type == "transition") {
                    const {v0, v1, t0, t1, easing="linear"} = active_item.data;
                    if (easing == "linear") {
                        // linear transition
                        const v = (v1-v0)/(t1-t0);
                        let target = (v > 0) ? Math.min(v1, src_region_high) : Math.max(v1, src_region_low);
                        const vector = [pos0, v, 0, ts0];
                        this.timeout(vector, target);
                        return;                           
                    }
                }
            }
        }            

        /**
         * detection of leave events falls back on polling
         */
        this.poll(src_nearby.itv);
    }

    /*
        timeout when target is reached  
    */
    timeout(vector, target) {
        const [p,v,a,t] = vector;
        if (a != 0) {
            throw new Error("timeout not yet implemented for acceleration");
        }
        const delta_sec = (target - p) / v;
        this._tid = set_timeout(() => {
            // event detected
            this.onchange();
        }, delta_sec * 1000.0);
    }

    /**
     * start polling
     */
    poll(itv) {
        this._pid = setInterval(() => {
            this.handle_polling(itv);
        }, 100);
    }

    /**
     * handle polling
     */
    handle_polling(itv) {
        let pos = this.ctrl.value;
        if (!interval.covers_endpoint(itv, pos)) {
            // event detected
            this.onchange();
        }
    }

    /**********************************************************
     * UPDATE API
     **********************************************************/
    set(value) {
        return set_value(this, value);
    }
    motion(vector) {
        return set_motion(this, vector);
    }
    transition({target, duration, easing}) {
        return set_transition(this, target, duration, easing);
    }
    interpolate = function interpolate ({tuples, duration}) {
        return set_interpolation(this, tuples, duration);
    }

}
callback.addMethods(Cursor.prototype);
eventify.addMethods(Cursor.prototype);



/******************************************************************
 * CURSOR UPDATE API
 * ***************************************************************/

/**
 * set value of cursor
 */

export function set_value(cursor, value) {
    if (cursor.isReadOnly) {
        throw new Error("cursor update not allowed, readonly");
    }
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

export function set_motion(cursor, vector={}) {
    if (cursor.isReadOnly) {
        throw new Error("cursor update not allowed, readonly");
    }

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
    return cursor_update (cursor, items);
}

/**
 * set transition - to target position using in <duration> seconds.
 */

export function set_transition(cursor, target, duration, easing) {
    if (cursor.isReadOnly) {
        throw new Error("cursor update not allowed, readonly");
    }

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

export function set_interpolation(cursor, tuples, duration) {

    if (cursor.isReadOnly) {
        throw new Error("cursor update not allowed, readonly");
    }

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


export function cursor_update(cursor, items) {
    const {record=false} = cursor.options;
    if (record) {
        return cursor.src.append(items, cursor.ctrl.value);
    } else {
        return cursor.src.update({insert:items, reset:true});
    }
}
