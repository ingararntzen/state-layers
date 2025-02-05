// import { Cursor } from "./cursors.js";
// import { cmd } from "./cmd.js";

import { LocalStateProvider } from "./stateprovider_simple.js";
import { merge } from "./ops/merge.js"
import { skew } from "./ops/skew.js";
import { InputLayer } from "./layers.js";

/*********************************************************************
    LAYER FACTORY
*********************************************************************/

function layer(options={}) {
    let {src, items, ...opts} = options;
    if (src == undefined) {
        src = new LocalStateProvider({items})
    }
    const layer = new InputLayer(opts);
    layer.src = src;
    return layer;
}

export { layer, merge, skew }