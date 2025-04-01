import { Cursor } from "../cursor_base.js";
import { is_clock_cursor, clock_cursor } from "../cursor_clock.js";
import { is_items_layer } from "../layer_items.js";
import { is_clock_provider, LOCAL_CLOCK_PROVIDER } from "../provider_clock.js";

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

    if (is_clock_provider(ctrl)) {
        ctrl = clock_cursor(ctrl);
    }
    // ctrl must be clock cursor or media cursor
    if (
        !is_clock_cursor(ctrl) &&
        !is_clock_cursor(ctrl.ctrl)
    ){
        throw new Error(`ctrl or ctrl.ctrl must be a clock cursor ${ctrl}`);
    }    

    // src must be cursor with a segments layer as src
    if (!(src instanceof Cursor)) {
        throw new Error(`src must be a cursor ${src}`);
    }
    if (is_clock_cursor(src)) {
        throw new Error(`src must not be a clock cursor ${src}`);
    }
    if (!is_items_layer(src.src)) {
        throw new Error(`cursor src must be itemslayer ${src.src}`);
    }

    // dst must be segments layer
    if (!is_items_layer(dst)) {
        throw new Error(`dst must be a itemslayer ${dst}`);
    }
    if (src.src === dst) {
        throw new Error(`src and dst must not be the same layer ${src_layer}`);
    }


    // stateProviders
    const src_stateProvider = src.src.src;
    const dst_stateProvider = dst.src;

    // internal state
    const is_recording = is_clock_cursor(ctrl);

    /**
     * state change in src stateProvider
     */

    function on_src_change () {
        if (!is_recording) return;
        
        // record timestamp
        const ts = ctrl.value;
        // get current items from stateProvider
        const items = src.src.src.get();
        // append items to dst
        dst.append(items, ts);
    }

    function on_ctrl_change () {
        const src_ts = src.ctrl.value;
        // figure out if recording starts or stops
        const src_layer = src.src;
        const current_items = src_layer.index.nearby(src_ts);

    }

    // register callbacks
    src_stateProvider.add_callback(on_src_change);
    ctrl.add_callback(on_ctrl_change);


    return dst;
}