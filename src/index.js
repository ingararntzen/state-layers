// classes
import { NearbyIndexBase } from "./nearby_base.js";
import { Layer } from "./layer_base.js";
import { Cursor } from "./cursor_base.js";

// stateProviders
import { is_clock_provider, LOCAL_CLOCK_PROVIDER } from "./provider_clock.js";
import { CollectionProvider } from "./provider_collection.js";
import { VariableProvider } from "./provider_variable.js";

// factory functions
import { segments_layer } from "./layer_segments.js";
import { clock_cursor, is_clock_cursor } from "./cursor_clock.js"
import { variable_cursor } from "./cursor_variable.js";
import { playback_cursor } from "./cursor_playback.js";
import { layer_from_cursor } from "./ops/layer_from_cursor.js";
import { merge_layer } from "./ops/merge.js";
import { boolean_layer } from "./ops/boolean.js"
import { logical_merge_layer, logical_expr} from "./ops/logical_merge.js";
import { timeline_transform } from "./ops/timeline_transform.js";
import { cursor_transform, layer_transform } from "./ops/transform.js";
import { record_layer } from "./ops/record.js";


/*********************************************************************
    LAYER FACTORIES
*********************************************************************/

function layer(options={}) {
    let {src, insert, value, ...opts} = options;
    if (src instanceof Layer) {
        return src;
    }
    if (src == undefined) {
        if (value != undefined) {
            src = new VariableProvider({value});
        } else {
            src = new CollectionProvider({insert});
        }
    }
    return segments_layer({src, ...opts}); 
}

function record (options={}) {
    let {ctrl, src, dst, ...ops} = options;
    ctrl = cursor(ctrl);
    src = cursor(src);
    dst = layer({dst:src, ...ops});
    record_layer(ctrl, src, dst);
    return dst;
}


/*********************************************************************
    CURSOR FACTORIES
*********************************************************************/


function cursor (src=LOCAL_CLOCK_PROVIDER) {
    if (src instanceof Cursor) {
        return src;
    }
    if (is_clock_cursor(src)) {
        return src;
    }
    if (is_clock_provider(src)) {
        return clock_cursor(src);
    }
    throw new Error(`src must be cursor, clockProvider or undefined ${src}`);
}

function clock (src) {
    return cursor(src);
}

function variable(options={}) {
    let {ctrl, ...opts} = options;
    ctrl = cursor(ctrl);
    const src = layer(opts);
    return variable_cursor(ctrl, src);
}

function playback(options={}) {
    let {ctrl, ...opts} = options;
    ctrl = cursor(ctrl);
    const src = layer(opts);
    return playback_cursor(ctrl, src);
}

function skew (src, offset) {
    src = cursor(src);
    function valueFunc(value) {
        return value + offset;
    } 
    return cursor_transform(src, {valueFunc});
}


/*********************************************************************
    EXPORTS
*********************************************************************/

export {
    Layer, Cursor, NearbyIndexBase,
    layer, 
    merge_layer as merge, 
    boolean_layer as boolean,
    logical_merge_layer as logical_merge, 
    logical_expr,
    clock,
    variable,
    playback,
    layer_from_cursor,
    layer_transform,
    cursor_transform,
    timeline_transform,
    record,
    skew
}