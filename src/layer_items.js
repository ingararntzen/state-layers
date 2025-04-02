import * as srcprop from "./util/api_srcprop.js";
import { Layer } from "./layer_base.js";
import { is_collection_provider } from "./provider_collection.js";
import { is_variable_provider} from "./provider_variable.js";
import { NearbyIndex } from "./nearby_index.js";
import { load_segment } from "./util/segments.js";
import { toState } from "./util/common.js";
import { endpoint, interval } from "./util/intervals.js";

/*********************************************************************
    ITEMS LAYER
*********************************************************************/

/**
 * Items Layer has a stateProvider (either collectionProvider or variableProvider)
 * as src property.
 */

export function is_items_layer (obj) {
    if (obj == undefined) return false;
    // is layer
    if (!(obj instanceof Layer)) return false;
    // has src property
    const desc = Object.getOwnPropertyDescriptor(obj, "src");
    if (!!(desc?.get && desc?.set) == false) return false;
    return true;
}

export function items_layer(options={}) {

    const {src, ...opts} = options;
    const layer = new Layer({CacheClass:ItemsLayerCache, ...opts});

    // setup src property
    srcprop.addState(layer);
    srcprop.addMethods(layer);

    layer.srcprop_register("src");
    layer.srcprop_check = function (propName, src) {
        if (propName == "src") {
            if (!(is_collection_provider(src)) && !(is_variable_provider(src))) {
                throw new Error(`"src" must collectionProvider or variableProvider ${src}`);
            }
            return src;    
        }
    }
    layer.srcprop_onchange = function (propName, eArg) {
        if (propName == "src") {
            if (eArg == "reset") {
                if (is_collection_provider(layer.src)) {
                    layer.index = new NearbyIndex(layer.src);
                } else if (is_variable_provider(layer.src)) {
                    layer.index = new NearbyIndex(layer.src);
                }
            } 
            if (layer.index != undefined) {
                if (is_collection_provider(layer.src)) {
                    layer.index.refresh(eArg);
                } else if (is_variable_provider(layer.src)) {
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
    layer.update = function update(changes) {
        return layer_update(layer, changes);
    }
    layer.append = function append(items, offset) {
        return layer_append(layer, items, offset);
    }

    // initialise
    layer.src = src;

    return layer;
}


/*********************************************************************
    ITEMS LAYER CACHE
*********************************************************************/

/*
    Layers with a CollectionProvider or a VariableProvider as src 
    use a specific cache implementation, as objects in the 
    index are assumed to be items from the provider, not layer objects. 
    Thus, queries are not resolved directly on the items in the index, but
    rather from corresponding segment objects, instantiated from items.

    Caching here applies to nearby state and segment objects.
*/

class ItemsLayerCache {
    constructor(layer, options={}) {
        // layer
        this._layer = layer;
        // cached nearby object
        this._nearby = undefined;
        // cached segment
        this._segment = undefined;
        // default value
        this._options = options;

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
        return toState(this._segments, states, offset, this._layer.options);
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
    if (is_collection_provider(layer.src)) {
        return layer.src.update(changes);
    } else if (is_variable_provider(layer.src)) {     
        let {
            insert=[],
            remove=[],
            reset=false
        } = changes;
        if (reset) {
            return layer.src.set(insert);
        } else {
            const map = new Map((layer.src.get() || [])
                .map((item) => [item.id, item]));
            // remove
            remove.forEach((id) => map.delete(id));
            // insert
            insert.forEach((item) => map.set(item.id, item));
            // set
            const items = Array.from(map.values());
            return layer.src.set(items);
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
    const remove = layer.src.get()
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



