// classes
import { NearbyIndexBase } from "./nearby_base.js";
import { Track } from "./track_base.js";
import { Cursor } from "./cursor_base.js";

// stateProviders
import { clock_provider } from "./provider_clock.js";
import { CollectionProvider } from "./provider_collection.js";
import { ObjectProvider } from "./provider_object.js";

// factory functions
import { leaf_track } from "./track_leaf.js";
import { clock_cursor } from "./cursor_clock.js"
import { object_cursor } from "./cursor_object.js";
import { playback_cursor } from "./cursor_playback.js";
import { track_from_cursor } from "./ops/track_from_cursor.js";
import { merge_track } from "./ops/merge.js";
import { boolean_track } from "./ops/boolean.js"
import { logical_merge_track, logical_expr} from "./ops/logical_merge.js";
import { timeline_transform } from "./ops/timeline_transform.js";
import { cursor_transform, track_transform } from "./ops/transform.js";
import { track_recorder } from "./ops/record.js";
import { cursor_from_timingobject } from "./ops/cursor_from_timingobject.js";

// util
import { local_clock, render_cursor, check_items } from "./util/common.js";
import { render_provider } from "./util/provider_viewer.js";


/*********************************************************************
    TRACK FACTORIES
*********************************************************************/

function track(options={}) {
    let {src, provider, items=[], value, ...opts} = options;
    if (src != undefined) {
        if (src instanceof Track) {
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
    return leaf_track({provider, ...opts}); 
}

function record (options={}) {
    const dst = track({mutable:true});
    let {ctrl, src} = options;
    if (ctrl == undefined) {
        ctrl = clock();
    }
    return track_recorder({ctrl, src, dst});
}

/*********************************************************************
    CURSOR FACTORIES
*********************************************************************/

function clock(options={}) {
    const {clock, vector, ...opts} = options;
    const provider = clock_provider({clock, vector});
    return clock_cursor({provider, ...opts});
}

function object(options={}) {
    let {ctrl, src, ...src_opts} = options;
    if (ctrl == undefined) {
        ctrl = clock();
    }
    if (src == undefined) {
        src = track(src_opts);
    }
    return object_cursor({ctrl, src});
}

function playback(options={}) {
    let {ctrl, src, ...src_opts} = options;
    if (ctrl == undefined) {
        ctrl = clock();
    }
    if (src == undefined) {
        src = track(src_opts);
    }
    return playback_cursor({ctrl, src});
}


/*********************************************************************
    EXPORTS
*********************************************************************/

export {
    CollectionProvider, ObjectProvider,
    local_clock,
    Track, Cursor, NearbyIndexBase,
    track, 
    clock,
    object,
    playback,
    record,
    merge_track as merge, 
    boolean_track as boolean,
    logical_merge_track as logical_merge, 
    logical_expr,
    track_from_cursor,
    track_transform,
    cursor_transform,
    cursor_from_timingobject,
    timeline_transform,
    render_provider,
    render_cursor
}