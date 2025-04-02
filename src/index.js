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
import { record_layer } from "./ops/record.js";


// util
import { local_clock } from "./util/common.js";
import { StateProviderViewer } from "./util/provider_viewer.js";

function render_provider(stateProvider, selector, options={}) {
    const elems = document.querySelector(selector);
    return new StateProviderViewer(stateProvider, elems, options);
}

function render_cursor (cursor, selector, options={}) {
    const {delay=200, render, novalue} = options;
    const elems = document.querySelector(selector);
    function _render(state) {
        if (state.value == undefined && novalue != undefined) {
            state.value = novalue;
        }
        if (render != undefined) {
            render(state, elems);
        } else {
            elems.textContent = (state.value != undefined) ? `${state.value}` : "";
        }
    }
    return cursor.bind(_render, delay);
}


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

function record (options={}) {
    let {ctrl=LOCAL_CLOCK_PROVIDER, src, dst, ...ops} = options;
    dst = layer({dst:src, ...ops});
    record_layer(ctrl, src, dst);
    return dst;
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
    record,
    skew,
    render_provider,
    render_cursor,
    local_clock
}