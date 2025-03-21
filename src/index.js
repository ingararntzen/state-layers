import { CollectionProvider } from "./provider_collection.js";
import { VariableProvider } from "./provider_variable.js";
import { segments_layer } from "./layer_segments.js";
import { merge_layer } from "./ops/layer_merge.js";
import { shift_layer } from "./ops/layer_shift.js";
import { boolean_layer } from "./ops/layer_boolean.js"
import { logical_merge_layer, logical_expr} from "./ops/layer_logical_merge.js";
import { clock_cursor } from "./cursor_clock.js";
import { variable_cursor } from "./cursor_variable.js";
import { playback_cursor } from "./cursor_playback.js";

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
    const {ctrl, ...opts} = options;
    const src = layer(opts);
    return variable_cursor({ctrl, src});
}

function playback(options={}) {
    const {ctrl, src} = options;
    return playback_cursor({ctrl, src});
}


export { 
    layer, 
    merge_layer as merge, 
    shift_layer as shift,
    boolean_layer as boolean,
    logical_merge_layer as logical_merge, 
    logical_expr,
    clock_cursor as clock,
    variable,
    playback
}