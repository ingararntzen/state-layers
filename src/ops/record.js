import { Cursor } from "../cursor_base.js";
import { local_clock } from "../util/common.js";

/**
 * record cursor into layer
 * 
 *   MAIN IDEA
 * - record the current value of a cursor (src) into a layer (dst)
 * 
 * - recording is essentially a copy operation from the
 *   stateProvider of a cursor (src) to the stateProvider of the layer (dst).
 * - more generally copy state (items) from cursor to layer. 
 * - recording therefor only applies to cursors that run directly on a layer with items
 * - moreover, the target layer must have items (typically a leaflayer)
 *
 * 
 *   TIMEFRAMES 
 * - the recording to (dst) layer is driven by a clock (ctrl): <DST_CLOCK>
 * - during recording - current value of the src cursor will be copied, and
 *   converted into the timeline of the <DST_CLOCK>
 * - recording is active only when <DST_CLOCK> is progressing with rate==1.0
 * - this opens for LIVE recording (<DST_CLOCK> is fixedRate cursor) or
 *   iterative recording using a (NumbericVariable), allowing multiple takes, 
 * 
 * 
 *   RECORDING
 * - recording is done by appending items to the dst layer 
 * - when the cursor state changes (entire cursor.src layer is reset) 
 * - the part which describes the future will overwrite the relevant
 * - part of the the layer timeline
 * - the delineation between past and future is determined by 
 * - fresh timestamp <TS> from <DST_CLOCK>
 * - if an item overlaps with <TS> it will be truncates so that only the part
 * - that is in the future will be recorded (copied) to the layer.
 * - in case (ctrl) is a media control - recording can only happen
 *   when the (ctrl) is moving forward
 * 
 *   INPUT
 * - (ctrl)
 *      - numeric cursor (ctrl.fixedRate, or 
 *      - media control (ctrl.ctrl.fixedRate && ctrl.src.itemsOnly)
 * - (src) - cursor with layer with items (src.itemsOnly) 
 * - (dst) - layer of items (dst.itemsOnly && dst.mutable)
 *
 *   NOTE
 * - implementation assumes 
 *      - (dst) layer is not the same as the (src) layer
 *      - (src) cursor can not be clock cursor (makes no sense to record a clock
 *   
 */


export function layer_recorder(options={}) {
    const {ctrl, src, dst} = options;

    // check - ctrl
    if (!(ctrl instanceof Cursor)) {
        throw new Error(`ctrl must be a cursor ${ctrl}`);
    }
    if (
        !ctrl.fixedRate && !ctrl.ctrl.fixedRate
    ) {
        throw new Error(`ctrl or ctrl.ctrl must be fixedRate ${ctrl}`);
    }
    if (!ctrl.fixedRate) {
        if (ctrl.ctrl.fixedRate && !ctrl.itemsOnly) {
            throw new Error(`given ctrl.ctrl.fixedRate, ctrl must be itemsOnly ${ctrl}`);
        }
    }

    // check - src
    if (!(src instanceof Cursor)) {
        throw new Error(`src must be a cursor ${src}`);
    }
    if ((src.fixedRate)) {
        throw new Error(`cursor src can not be fixedRate cursor ${src}`);
    }
    if (!src.itemsOnly) {
        throw new Error(`cursor src must be itemsOnly ${src}`);
    }
    if (!src.mutable) {
        throw new Error(`cursor src must be mutable ${src}`);
    }

    // check - stateProviders
    const src_stateProvider = src.src.provider;
    const dst_stateProvider = dst.provider;
    if (src_stateProvider === dst_stateProvider) {
        throw new Error(`src and dst can not have the same stateProvider`);
    }


    /**
     * turn this around?
     * have start and stop recording
     * methods direct the control?
     * 
     * recording with live clock requires
     * start and stop methods
     * 
     * what about a media clock ?
     * should be a media clock that can only move forward
     * it actually makes sense to be in record mode even if mediaclock is paused
     * because recording only happens on state change
     * paused means you overwrite on the same spot
     * skipping back while in record mode - should that trigger write current
     * state longer back
     * 
     * skipping always exit record mode
     * record mode always starts
     * media control may be controlled externally
     * 
     * split between a live and a media clock recorder?
     * 
     */

    // internal state
    let is_recording = false;

    /**
     * state change in src stateProvider
     */

    function on_src_change () {
        if (!is_recording) return;
        record();
    }

    /**
     * state change in ctrl
     */
    function on_ctrl_change () {
        // figure out if recording starts or stops
        const was_recording = is_recording;
        is_recording = false;
        if (ctrl.fixedRate) {
            is_recording = true;
        } else {
            const ctrl_ts = ctrl.ctrl.value;
            const items = ctrl.src.index.nearby(ctrl_ts).center;
            if (items.length == 1)
                if (items[0].type == "motion" ) {
                    const [p,v,a,t] = items[0].data;
                    if (v > 0 || v == 0 && a > 0) {
                        is_recording = true;
                    }
            }
        }
        if (!was_recording && is_recording) {
            start_recording();
        } else if (was_recording && !is_recording) {
            stop_recording();
        }
    }

    /**
     * record
     */
    function start_recording() {
        console.log("start recording")
        record();
    }

    function stop_recording() {
        console.log("stop recording")
        // close last item
        const ts = local_clock.now();
        const dst_offset = ctrl.query(ts).value;
        const items = dst.index.nearby(dst_offset).center;
        const insert = items.map((item) => {
            const new_item = {...item};
            new_item.itv[1] = dst_offset;
            new_item.itv[3] = false;
            return new_item;
        });
        if (items.length > 0) {
            dst.update({insert, reset:false});
        }
    }

    function record() {
        const ts = local_clock.now();
        const src_offset = src.query(ts).offset;
        const dst_offset = ctrl.query(ts).value;
        // get current src items
        let src_items = src_stateProvider.get();
        // re-encode items in dst timeframe, if needed
        const offset = dst_offset - src_offset;
        if (offset != 0) {
            const dst_items = src_items.map((item) => {
                return timeshift_item(item, offset);
            });
            dst.append(dst_items, dst_offset);
        } else {
            dst.append(src_items, src_offset);
        }        
    }

    // register callbacks
    src_stateProvider.add_callback(on_src_change);
    ctrl.add_callback(on_ctrl_change);
    on_ctrl_change();

    return dst;
}


/**
 * timeshift parameters of time by offset
 */
function timeshift_item (item, offset) {
    item = {...item};
    item.itv[0] = (item.itv[0] != null) ? item.itv[0] + offset : null;
    item.itv[1] = (item.itv[1] != null) ? item.itv[1] + offset : null;
    // TODO - perhaps change implementation of motion and transition segment
    // to use timestamps relative to the start of the segment,
    // similar to interpolation?
    if (item.type == "motion") {
        item.data.timestamp = item.data.timestamp + offset;
    } else if (item.type == "transition") {
        item.data.t0 = item.data.t0 + offset;
        item.data.t1 = item.data.t1 + offset;
    }
    return item;
}



