import { CollectionProvider } from "./provider_collection.js";
import { VariableProvider } from "./provider_variable.js";
import { Layer } from "./layer_base.js";
import { input_layer } from "./layer_input.js";
import { merge_layer } from "./layer_merge.js";
import { shift_layer } from "./ops/layer_shift.js";
import { boolean_layer } from "./ops/layer_boolean.js"
import { logical_merge_layer, logical_expr} from "./ops/layer_logical_merge.js";

import { Cursor } from "./cursors.js";
import { cmd } from "./cmd.js";


/*********************************************************************
    LAYER FACTORY
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
    return input_layer({src, ...opts}); 
}

/*********************************************************************
    CURSOR FACTORIES
*********************************************************************/

function cursor(options={}) {
    const {ctrl, ...opts} = options;
    const src = layer(opts);    
    return new Cursor({ctrl, src});
}

export { 
    layer, 
    merge_layer as merge, 
    shift_layer as shift,
    boolean_layer as boolean,
    logical_merge_layer as logical_merge, 
    logical_expr,
    cmd,
    cursor, 
    cursor as variable, 
    cursor as playback, 
}