import { LocalStateProvider } from "./stateprovider_simple.js";
import { merge } from "./ops/merge.js"
import { skew } from "./ops/skew.js";
import { InputLayer, Layer } from "./layers.js";
import { Cursor } from "./cursors.js";
import { cmd } from "./cmd.js";

/*********************************************************************
    LAYER FACTORY
*********************************************************************/

function layer(options={}) {
    let {src, items=[], value, ...opts} = options;
    if (src instanceof Layer) {
        return src;
    } 
    if (src == undefined) {
        if (value != undefined) {
            items = [{
                itv: [-Infinity, Infinity],
                data: value
            }];
        } 
        src = new LocalStateProvider({items});
    }
    return new InputLayer({src, ...opts}); 
}

/*********************************************************************
    CURSOR FACTORY
*********************************************************************/

function cursor(options={}) {
    const {ctrl, ...opts} = options;
    const src = layer(opts);    
    return new Cursor({ctrl, src});
}

export { layer, cursor, merge, skew, cmd }