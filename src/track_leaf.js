import * as srcprop from "./util/api_srcprop.js";
import { Track } from "./track_base.js";
import { is_collection_provider } from "./provider_collection.js";
import { is_object_provider} from "./provider_object.js";
import { NearbyIndex } from "./nearby_index.js";
import { load_segment } from "./util/segments.js";
import { toState, is_finite_number, check_number} from "./util/common.js";
import { endpoint, interval } from "./util/intervals.js";


export function is_leaf_track(obj) {
    return ((obj instanceof Track) && obj.isLeaf);
}

/*********************************************************************
    LEAF TRACK
*********************************************************************/

export function leaf_track(options={}) {
    const {
        provider,
        numeric=false, 
        mutable=true, 
        mask,
        ...opts} = options;

    const track = new Track({
        CacheClass:LeafTrackCache, 
        ...opts,
    });

    // restrictions
    Object.defineProperty(track, "numeric", {get: () => numeric});
    Object.defineProperty(track, "mutable", {get: () => mutable});
    Object.defineProperty(track, "itemsOnly", {get: () => true});

    // numeric mask - replaces undefined for numeric tracks
    if (mask != undefined) {
        check_number("mask", mask);
    }
    track.mask = mask;

    // setup provider as property
    srcprop.addState(track);
    srcprop.addMethods(track);
    track.srcprop_register("provider");
    track.srcprop_check = function (propName, obj) {
        if (propName == "provider") {
            if (!(is_collection_provider(obj)) && !(is_object_provider(obj))) {
                throw new Error(`"obj" must collectionProvider or objectProvider ${obj}`);
            }
            return obj;    
        }
    }
    track.srcprop_onchange = function (propName, eArg) {
        if (propName == "provider") {
            if (eArg == "reset") {
                if (is_collection_provider(track.provider)) {
                    track.index = new NearbyIndex(track.provider);
                } else if (is_object_provider(track.provider)) {
                    track.index = new NearbyIndex(track.provider);
                }
            } 
            if (track.index != undefined) {
                if (is_collection_provider(track.provider)) {
                    track.index.refresh(eArg);
                } else if (is_object_provider(track.provider)) {
                    track.index.refresh();
                }
                track.onchange();
            }
        }        
    }


    /**
     * convenience method for getting items valid at offset
     * only items track supports this method
     */
    track.get_items = function get_items(offset) {
        return [...track.index.nearby(offset).center];
    }

    /******************************************************************
     * TRACK UPDATE API
     * ***************************************************************/

    if (!track.readOnly) {
        track.update = function update(changes) {
            return track_update(track, changes);
        }
        track.append = function append(items, offset) {
            return track_append(track, items, offset);
        }    
    }
 
    // initialise
    track.provider = provider;

    return track;
}


/*********************************************************************
    LEAF TRACK CACHE
*********************************************************************/

/*
    LeafTracks have a CollectionProvider or a ObjectProvider as provider 
    and use a specific cache implementation, as objects in the 
    index are assumed to be items from the provider, not other track objects. 
    Moreover, queries are not resolved directly on the items in the index, but
    rather from corresponding segment objects, instantiated from items.

    Caching here applies to nearby state and segment objects.
*/

class LeafTrackCache {
    constructor(track) {
        // track
        this._track = track;
        // cached nearby object
        this._nearby = undefined;
        // cached segment
        this._segment = undefined;
        // query options
        this._query_options = {
            valueFunc: this._track.valueFunc,
            stateFunc: this._track.stateFunc,
            numeric: this._track.numeric,
            mask: this._track.mask
        };
    }

    get src() {return this._track};
    get segment() {return this._segment};

    query(offset) {
        const need_index_lookup = (
            this._nearby == undefined ||
            !interval.covers_endpoint(this._nearby.itv, offset)
        );
        if (need_index_lookup) {
            // cache miss
            this._nearby = this._track.index.nearby(offset);
            let {itv, center} = this._nearby;
            this._segments = center.map((item) => {
                return load_segment(itv, item);
            });
        }
        // perform queries
        const states = this._segments.map((seg) => {
            return seg.query(offset);
        });
        // calculate single result state
        return toState(this._segments, states, offset, this._query_options);
    }

    clear() {
        this._nearby = undefined;
        this._segment = undefined;
    }
}




/*********************************************************************
    TRACK UPDATE
*********************************************************************/

/**
 * NOTE - track update is essentially about stateProvider update.
 * so these methods could (for the most part) be moved to the provider.
 * However, update_append benefits from using the index of the track,
 * so we keep it here for now. 
 */

/*
    Leaf Track forwards update to stateProvider
*/
function track_update(track, changes={}) {

    changes.insert ??= [];

    // check number restriction
    // check that static items are restricted to numbers
    // other item types are restricted to numbers by default
    if (track.isNumberOnly) {
        for (let item of changes.insert) {
            item.type ??= "static";
            if (item.type == "static" && !is_finite_number(item.data)) {
                throw new Error(`track is number only, but item ${item} is not a number`);
            }
        }
    }

    if (is_collection_provider(track.provider)) {
        return track.provider.update(changes);
    } else if (is_object_provider(track.provider)) {     
        let {
            insert=[],
            remove=[],
            reset=false
        } = changes;
        if (reset) {
            return track.provider.set(insert);
        } else {
            const map = new Map((track.provider.get() || [])
                .map((item) => [item.id, item]));
            // remove
            remove.forEach((id) => map.delete(id));
            // insert
            insert.forEach((item) => map.set(item.id, item));
            // set
            const items = Array.from(map.values());
            return track.provider.set(items);
        }
    }
}
    

/*********************************************************************
    TRACK APPEND
*********************************************************************/

/**
 * append items to track at offset
 * 
 * append implies that pre-existing items beyond offset,
 * will either be removed or truncated, so that the track
 * is empty after offset.
 * 
 * items will only be inserted after offset, so any new
 * item before offset will be truncated or dropped.
 * 
 * new items will only be be applied for t >= offset
 * old items will be kept for t < offset
 * 
 * 
 */
function track_append(track, items, offset) {
    const ep = endpoint.from_input(offset);
    
    // truncate or remove new items before offset
    const insert_items = items
        .filter((item) => {
            // keep only items with itv.high >= offset
            const highEp = endpoint.from_interval(item.itv)[1];
            return endpoint.ge(highEp, ep);
        })
        .map((item) => {
            // truncate item overlapping offset itv.low=offset
            if (interval.covers_endpoint(item.itv, ep)) {
                const new_item = {...item};
                new_item.itv = [offset, item.itv[1], true, item.itv[3]];
                return new_item;
            }
            return item;
        });
    
    // truncate pre-existing items overlapping offset
    const modify_items = track.index.nearby(offset).center.map((item) => {
        const new_item = {...item};
        new_item.itv = [item.itv[0], offset, item.itv[2], false];
        return new_item;
    });
    
    // remove pre-existing future - items covering itv.low > offset
    const remove = track.provider.get()
        .filter((item) => {
            const lowEp = endpoint.from_interval(item.itv)[0];
            return endpoint.gt(lowEp, ep);
        })
        .map((item) => {
            return item.id;
        });

    // console.log("remove", remove);

    // track update
    const insert = [...modify_items, ...insert_items];
    return track_update(track, {remove, insert, reset:false})
}



