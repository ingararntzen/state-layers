import { Cursor } from "../cursor_base.js";
import { is_clock_cursor, clock_cursor } from "../cursor_clock.js";
import { is_items_layer } from "../layer_items.js";
import { is_clock_provider, LOCAL_CLOCK_PROVIDER } from "../provider_clock.js";
import { local_clock } from "../util/common.js";

/**
 * record cursor into layer
 * 
 *   MAIN IDEA
 * - record the current value of a cursor (src) into a layer (dst)
 * - recording is essentially a copy operation from the
 *   stateProvider of the cursor (src) to the stateProvider of the layer (dst).
 * - recording does not apply to derived cursors - only cursors that
 *   are directly connected to a stateProvider.
 *
 * 
 *   TIMEFRAMES
 * - the (src) cursor is driven by a clock (src.ctrl): <SRC_CLOCK> 
 * - the recording to (dst) layer is driven by a clock (ctrl): <DST_CLOCK>
 * - if SRC_CLOCK is not the same as DST_CLOCK, recorded items need to be
 *   converted to the DST_CLOCK time frame.
 * - for example - a common scenario would be to record a cursor with real-time
 *   timestamps into a logical timeline starting at 0, possibly 
 *   rewinding the DST_CLOCK to 0 multiple times in order to do new takes
 * 
 *   RECORDING
 * - recording is done by appending items to the dst layer 
 * - when the cursor state changes (entire timeline reset) 
 * - the part of it which describes the future will overwrite the relevant
 * - part of the the layer timeline
 * - the delineation between past and future is determined by 
 * - fresh timestamp <TS> from <DST_CLOCK>
 * - if an item overlaps with <TS> it will be truncates so that only the part
 * - that is in the future will be recorded (copied) to the layer.
 * - in case (ctrl) is a media control - recording can only happen
 *   when the (ctrl) is moving forward
 * 
 *   INPUT
 * - (ctrl) - clock cursor or clock provider media control 
 *   (ctrl is clock_cursor or ctrl.ctrl is clock_cursor)
 * - (src) - cursor with a itemslayer as src 
 *   (src.src is itemslayer)
 * - (dst) - itemslayer
 *
 *   WARNING
 * - implementation assumes (dst) layer is not the same as the (src) layer
 * - (src) cursor can not be clock cursor (makes no sense to record a clock
 *   - especially when you can make a new one at any time)
 *  
 * - if (dst) is not provided, an empty layer will be created
 * - if (ctrl) is not provided, LOCAL_CLOCK_PROVIDER will be used
 */



export function record_layer(ctrl=LOCAL_CLOCK_PROVIDER, src, dst) {

    // check - ctrl 
    if (is_clock_provider(ctrl)) {
        ctrl = clock_cursor(ctrl);
    }
    if (
        !is_clock_cursor(ctrl) &&
        !is_clock_cursor(ctrl.ctrl)
    ){
        throw new Error(`ctrl or ctrl.ctrl must be a clock cursor ${ctrl}`);
    }    

    // check - src
    if (!(src instanceof Cursor)) {
        throw new Error(`src must be a cursor ${src}`);
    }
    if (is_clock_cursor(src)) {
        throw new Error(`src can not be a clock cursor ${src}`);
    }
    if (!is_items_layer(src.src)) {
        throw new Error(`cursor src must be itemslayer ${src.src}`);
    }

    // check - dst
    if (!is_items_layer(dst)) {
        throw new Error(`dst must be a itemslayer ${dst}`);
    }

    // check - stateProviders
    const src_stateProvider = src.src.src;
    const dst_stateProvider = dst.src;
    if (src_stateProvider === dst_stateProvider) {
        throw new Error(`src and dst can not have the same stateProvider`);
    }

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
        if (is_clock_cursor(ctrl)) {
            is_recording = true;
        } else if (is_clock_cursor(ctrl.ctrl)) {
            const ctrl_ts = ctrl.ctrl.value;
            const items = ctrl.src.index.nearby(ctrl_ts).center;
            if (items.length == 1)
                if (items[0].type == "motion" ) {
                    const {velocity, acceleration} = items[0].data;
                    if (velocity > 0 || velocity == 0 && acceleration > 0) {
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
        record();
    }

    function stop_recording() {
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
        // re-encode items in dst timeframe
        const offset = dst_offset - src_offset;
        const dst_items = src_items.map((item) => {
            return timeshift_item(item, offset);
        });
        dst.append(dst_items, dst_offset);
    }

    // register callbacks
    src_stateProvider.add_callback(on_src_change);
    ctrl.add_callback(on_ctrl_change);

    return dst;
}


/**
 * timeshift parameters of time by offset
 */
function timeshift_item (item, offset) {
    item = {...item};
    item.itv[0] = (item.itv[0] != null) ? item.itv[0] + offset : null;
    item.itv[1] = (item.itv[1] != null) ? item.itv[1] + offset : null;
    if (item.type == "motion") {
        item.data.timestamp = item.data.timestamp + offset;
    } else if (item.type == "transition") {
        item.data.t0 = item.data.t0 + offset;
        item.data.t1 = item.data.t1 + offset;
    }
    return item;
}



