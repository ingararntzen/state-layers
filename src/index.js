// classes
import { NearbyIndexBase } from "./nearby_base.js";
import { Layer } from "./layer_base.js";
import { Cursor } from "./cursor_base.js";

// stateProviders
import { 
    LOCAL_CLOCK_PROVIDER
} from "./provider_clock.js";
import { CollectionProvider } from "./provider_collection.js";
import { VariableProvider } from "./provider_variable.js";

// factory functions
import { items_layer } from "./layer_items.js";
import { clock_cursor } from "./cursor_clock.js"
import { variable_cursor } from "./cursor_variable.js";
import { playback_cursor } from "./cursor_playback.js";
import { layer_from_cursor } from "./ops/layer_from_cursor.js";
import { merge_layer } from "./ops/merge.js";
import { boolean_layer } from "./ops/boolean.js"
import { logical_merge_layer, logical_expr} from "./ops/logical_merge.js";
import { timeline_transform } from "./ops/timeline_transform.js";
import { cursor_transform, layer_transform } from "./ops/transform.js";
import { layer_recorder } from "./ops/recorder.js";


// util
import { local_clock, render_cursor } from "./util/common.js";
import { render_provider } from "./util/provider_viewer.js";


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
    return items_layer({src, ...opts}); 
}

function recorder (options={}) {
    let {ctrl=LOCAL_CLOCK_PROVIDER, src, dst} = options;
    return layer_recorder(ctrl, src, dst);
}

/*********************************************************************
    CURSOR FACTORIES
*********************************************************************/

function clock (src) {
    return clock_cursor(src);
}

function variable(options={}) {
    let {clock, ...opts} = options;
    const src = layer(opts);
    return variable_cursor(clock, src);
}

function playback(options={}) {
    let {ctrl, ...opts} = options;
    const src = layer(opts);
    return playback_cursor(ctrl, src);
}

function skew (src, offset) {
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
    recorder,
    skew,
    render_provider,
    render_cursor,
    local_clock
}