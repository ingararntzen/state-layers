import { CollectionProvider } from "./provider_collection.js";
import { VariableProvider } from "./provider_variable.js";
import { input_layer } from "./layer_input.js";
import { merge_layer } from "./layer_merge.js";
import { shift } from "./ops/shift.js";
import { Layer } from "./layer_base.js";
import { Cursor } from "./cursors.js";
import { boolean } from "./ops/boolean.js"
import { cmd } from "./cmd.js";
import { logical_merge, logical_expr} from "./ops/logical_merge.js";

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
    cmd,
    cursor, merge_layer as merge, 
    cursor as variable, 
    cursor as playback, 
    shift, boolean, logical_merge, logical_expr
}