import * as srcprop from "./util/api_srcprop.js";
import { Layer } from "./layer_base.js";
import { is_collection_provider } from "./provider_collection.js";
import { is_object_provider} from "./provider_object.js";
import { NearbyIndex } from "./nearby_index.js";
import { load_segment } from "./util/segments.js";
import { toState, is_finite_number, check_items} from "./util/common.js";
import { endpoint, interval } from "./util/intervals.js";


export function is_leaf_layer(obj) {
    return ((obj instanceof Layer) && obj.isLeaf);
}

/*********************************************************************
    LEAF LAYER
*********************************************************************/

export function leaf_layer(options={}) {

    const {provider,
        isNumberOnly, 
        isReadOnly, 
        ...opts} = options;

    const layer = new Layer({
        CacheClass:LeafLayerCache, 
        ...opts,
    });

    // properties
    Object.defineProperty(layer, "isNumberOnly", {get: () => isNumberOnly});
    Object.defineProperty(layer, "isReadOnly", {get: () => isReadOnly});
    Object.defineProperty(layer, "isLeaf", {get: () => true});

    // setup provider as property
    srcprop.addState(layer);
    srcprop.addMethods(layer);
    layer.srcprop_register("provider");
    layer.srcprop_check = function (propName, obj) {
        if (propName == "provider") {
            if (!(is_collection_provider(obj)) && !(is_object_provider(obj))) {
                throw new Error(`"obj" must collectionProvider or objectProvider ${obj}`);
            }
            return obj;    
        }
    }
    layer.srcprop_onchange = function (propName, eArg) {
        if (propName == "provider") {
            if (eArg == "reset") {
                if (is_collection_provider(layer.provider)) {
                    layer.index = new NearbyIndex(layer.provider);
                } else if (is_object_provider(layer.provider)) {
                    layer.index = new NearbyIndex(layer.provider);
                }
            } 
            if (layer.index != undefined) {
                if (is_collection_provider(layer.provider)) {
                    layer.index.refresh(eArg);
                } else if (is_object_provider(layer.provider)) {
                    layer.index.refresh();
                }
                layer.onchange();
            }
        }        
    }


    /**
     * convenience method for getting items valid at offset
     * only items layer supports this method
     */
    layer.get_items = function get_items(offset) {
        return [...layer.index.nearby(offset).center];
    }

    /******************************************************************
     * LAYER UPDATE API
     * ***************************************************************/

    if (!layer.isReadOnly) {
        layer.update = function update(changes) {
            return layer_update(layer, changes);
        }
        layer.append = function append(items, offset) {
            return layer_append(layer, items, offset);
        }    
    }
 
    // initialise
    layer.provider = provider;

    return layer;
}


/*********************************************************************
    LEAF LAYER CACHE
*********************************************************************/

/*
    LeafLayers have a CollectionProvider or a ObjectProvider as provider 
    and use a specific cache implementation, as objects in the 
    index are assumed to be items from the provider, not other layer objects. 
    Moreover, queries are not resolved directly on the items in the index, but
    rather from corresponding segment objects, instantiated from items.

    Caching here applies to nearby state and segment objects.
*/

class LeafLayerCache {
    constructor(layer) {
        // layer
        this._layer = layer;
        // cached nearby object
        this._nearby = undefined;
        // cached segment
        this._segment = undefined;
        // query options
        this._query_options = {
            valueFunc: this._layer.valueFunc,
            stateFunc: this._layer.stateFunc,
            numberOnly: this._layer.isNumberOnly,
        };
    }

    get src() {return this._layer};
    get segment() {return this._segment};

    query(offset) {
        const need_index_lookup = (
            this._nearby == undefined ||
            !interval.covers_endpoint(this._nearby.itv, offset)
        );
        if (need_index_lookup) {
            // cache miss
            this._nearby = this._layer.index.nearby(offset);
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
    LAYER UPDATE
*********************************************************************/

/**
 * NOTE - layer update is essentially about stateProvider update.
 * so these methods could (for the most part) be moved to the provider.
 * However, update_append benefits from using the index of the layer,
 * so we keep it here for now. 
 */

/*
    Items Layer forwards update to stateProvider
*/
function layer_update(layer, changes={}) {

    // check items to be inserted
    let {insert=[]} = changes;
    changes.insert = check_items(insert);

    // check number restriction
    // check that static items are restricted to numbers
    // other item types are restricted to numbers by default
    if (layer.isNumberOnly) {
        for (let item of changes.insert) {
            item.type ??= "static";
            if (item.type == "static" && !is_finite_number(item.data)) {
                throw new Error(`Layer is number only, but item ${item} is not a number`);
            }
        }
    }

    if (is_collection_provider(layer.provider)) {
        return layer.provider.update(changes);
    } else if (is_object_provider(layer.provider)) {     
        let {
            insert=[],
            remove=[],
            reset=false
        } = changes;
        if (reset) {
            return layer.provider.set(insert);
        } else {
            const map = new Map((layer.provider.get() || [])
                .map((item) => [item.id, item]));
            // remove
            remove.forEach((id) => map.delete(id));
            // insert
            insert.forEach((item) => map.set(item.id, item));
            // set
            const items = Array.from(map.values());
            return layer.provider.set(items);
        }
    }
}
    

/*********************************************************************
    LAYER APPEND
*********************************************************************/

/**
 * append items to layer at offset
 * 
 * append implies that pre-existing items beyond offset,
 * will either be removed or truncated, so that the layer
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
function layer_append(layer, items, offset) {
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
    
    // console.log("insert", insert_items);

    // truncate pre-existing items overlapping offset
    const modify_items = layer.index.nearby(offset).center.map((item) => {
        const new_item = {...item};
        new_item.itv = [item.itv[0], offset, item.itv[2], false];
        return new_item;
    });
    
    // console.log("modify", modify_items);

    // remove pre-existing future - items covering itv.low > offset
    const remove = layer.provider.get()
        .filter((item) => {
            const lowEp = endpoint.from_interval(item.itv)[0];
            return endpoint.gt(lowEp, ep);
        })
        .map((item) => {
            return item.id;
        });

    // console.log("remove", remove);

    // layer update
    const insert = [...modify_items, ...insert_items];
    return layer_update(layer, {remove, insert, reset:false})
}



