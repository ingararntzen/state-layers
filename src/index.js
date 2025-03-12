import { LocalStateProvider } from "./stateprovider.js";
import { merge } from "./ops/merge.js"
import { shift } from "./ops/shift.js";
import { InputLayer, Layer } from "./layers.js";
import { Cursor } from "./cursors.js";
import { boolean } from "./ops/boolean.js"
import { cmd } from "./cmd.js";
import { logical_merge, logical_expr} from "./ops/logical_merge.js";

/*********************************************************************
    LAYER FACTORY
*********************************************************************/

function layer(options={}) {
    let {src, ...opts} = options;
    if (src instanceof Layer) {
        return src;
    } 
    if (src == undefined) {
        src = new LocalStateProvider(opts);
    }
    return new InputLayer({src, ...opts}); 
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
    layer, cursor, merge, shift, cmd, 
    cursor as variable, 
    cursor as playback, 
    boolean, logical_merge, logical_expr
}