import { Cursor } from "../cursor_base.js";
import { is_clock_cursor, clock_cursor } from "../cursor_clock.js";
import { is_items_layer } from "../layer_items.js";
import { is_clock_provider, LOCAL_CLOCK_PROVIDER } from "../provider_clock.js";

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
    if (!is_items_layer(src.src)) {
        throw new Error(`cursor src must be a segment layer ${src.src}`);
    }

    // dst must be segments layer
    if (!is_items_layer(dst)) {
        throw new Error(`dst must be a segment layer ${dst}`);
    }

    /**
     * record stateProvider of cursor (src)
     */
    src.src.src.add_callback(on_src_change);

    function on_src_change () {
        // record timestamp
        const ts = ctrl.value;
        // get current items from stateProvider
        const items = src.src.src.get();
        // append items to dst
        dst.append(items, ts);
    }

    /**
     * TODO 
     * - clock should be used as a record clock, implying that
     *   items should be recoded according to this clock?
     * - this implies sensitivity to a difference between 
     *   cursor clock and record clock 
     */


    return dst;
}