// classes
import { NearbyIndexBase } from "./nearby_base.js";
import { Layer } from "./layer_base.js";
import { Cursor } from "./cursor_base.js";

// stateProviders
import { clock_provider } from "./provider_clock.js";
import { CollectionProvider } from "./provider_collection.js";
import { ObjectProvider } from "./provider_object.js";

// factory functions
import { leaf_layer } from "./layer_leaf.js";
import { clock_cursor } from "./cursor_clock.js"
import { variable_cursor } from "./cursor_variable.js";
import { playback_cursor } from "./cursor_playback.js";
import { layer_from_cursor } from "./ops/layer_from_cursor.js";
import { merge_layer } from "./ops/merge.js";
import { boolean_layer } from "./ops/boolean.js"
import { logical_merge_layer, logical_expr} from "./ops/logical_merge.js";
import { timeline_transform } from "./ops/timeline_transform.js";
import { cursor_transform, layer_transform } from "./ops/transform.js";
import { layer_recorder } from "./ops/record.js";


// util
import { local_clock, render_cursor, check_items } from "./util/common.js";
import { render_provider } from "./util/provider_viewer.js";


/*********************************************************************
    LAYER FACTORIES
*********************************************************************/

function layer(options={}) {
    let {src, provider, items=[], value, ...opts} = options;
    if (src != undefined) {
        if (src instanceof Layer) {
            return src;
        }
    }
    if (provider == undefined) {
        if (value != undefined) {
            const items = check_items([{
                itv: [null, null, true, true],
                data: value
            }])
            provider = new ObjectProvider({items});
        } else {
            items = check_items(items);
            provider = new CollectionProvider({items});
        } 
    }
    return leaf_layer({provider, ...opts}); 
}

function record (options={}) {
    const dst = layer({mutable:true});
    let {ctrl, src} = options;
    if (ctrl == undefined) {
        ctrl = clock();
    }
    return layer_recorder({ctrl, src, dst});
}

/*********************************************************************
    CURSOR FACTORIES
*********************************************************************/

function clock(options={}) {
    const {clock, vector, ...opts} = options;
    const provider = clock_provider({clock, vector});
    return clock_cursor({provider, ...opts});
}

function variable(options={}) {
    let {ctrl, src, ...src_opts} = options;
    if (ctrl == undefined) {
        ctrl = clock();
    }
    if (src == undefined) {
        src = layer(src_opts);
    }
    return variable_cursor({ctrl, src});
}

function playback(options={}) {
    let {ctrl, src, ...src_opts} = options;
    if (ctrl == undefined) {
        ctrl = clock();
    }
    if (src == undefined) {
        src = layer(src_opts);
    }
    return playback_cursor({ctrl, src});
}


/*********************************************************************
    EXPORTS
*********************************************************************/

export {
    CollectionProvider, ObjectProvider,
    Layer, Cursor, NearbyIndexBase,
    layer, 
    clock,
    variable,
    playback,
    record,
    merge_layer as merge, 
    boolean_layer as boolean,
    logical_merge_layer as logical_merge, 
    logical_expr,
    layer_from_cursor,
    layer_transform,
    cursor_transform,
    timeline_transform,
    render_provider,
    render_cursor,
    local_clock
}