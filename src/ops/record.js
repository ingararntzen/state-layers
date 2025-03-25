import { Cursor } from "../cursor_base.js";
import { is_clock_cursor } from "../cursor_clock.js";
import { is_segments_layer } from "../layer_segments.js";

export function record_layer(ctrl, src, dst) {

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
    if (!is_segments_layer(src.src)) {
        throw new Error(`cursor src must be a segment layer ${src.src}`);
    }

    // dst must be segments layer
    if (!is_segments_layer(dst)) {
        throw new Error(`dst must be a segment layer ${dst}`);
    }

    /**
     * record cursor (src)
     */
    src.add_callback(on_cursor_change);

    function on_cursor_change (eArg) {
        console.log("on cursor change", eArg);
    }

    return dst;
}