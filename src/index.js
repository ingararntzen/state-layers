// stateProviders
import { CollectionProvider } from "./provider_collection.js";
import { VariableProvider } from "./provider_variable.js";
// layers and cursors
import { segments_layer } from "./layer_segments.js";
import { clock } from "./cursor_clock.js"
import { variable_cursor } from "./cursor_variable.js";
import { playback_cursor } from "./cursor_playback.js";
// operations
import { layer_from_cursor } from "./ops/layer_from_cursor.js";
import { merge_layer } from "./ops/merge.js";
import { boolean_layer } from "./ops/boolean.js"
import { logical_merge_layer, logical_expr} from "./ops/logical_merge.js";
import { timeline_transform } from "./ops/timeline_transform.js";
import { cursor_transform, layer_transform } from "./ops/transform.js";



/*********************************************************************
    LAYER FACTORY
*********************************************************************/

function layer(options={}) {
    let {src, insert, value, ...opts} = options;
    if (src == undefined) {
        if (value != undefined) {
            src = new VariableProvider({value});
        } else {
            src = new CollectionProvider({insert});
        }
    }
    return segments_layer({src, ...opts}); 
}

/*********************************************************************
    CURSOR FACTORIES
*********************************************************************/

function variable(options={}) {
    let {ctrl, ...opts} = options;
    const src = layer(opts);
    return variable_cursor({ctrl, src});
}

function playback(options={}) {
    let {ctrl, src} = options;
    return playback_cursor({ctrl, src});
}

/*********************************************************************
    EXPORTS
*********************************************************************/

export { 
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
    timeline_transform
}