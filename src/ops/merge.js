import { endpoint, interval } from "../intervals.js";
import { NearbyIndexBase } from "../nearbyindex.js";
import { Layer } from "../newlayer.js"


/**
 * Returns a Layer representing a layer
 * representing the merging of sources.
 */


export function merge (sources, valueFunc) {

    const index = new MergeIndex(sources);

    // create layer
    return new Layer({index, valueFunc});
}




/************************************************
 * MERGE LAYER
 ************************************************/




class MergeLayerCacheObject {

    constructor (layer) {
        this._layer = layer;
        this._cache_objects = layer.sources.map((layer) => {
            return layer.getQueryObject()
        });
    }

    query(offset) {
        if (offset == undefined) {
            throw new Error("Layer: query offset can not be undefined");
        }
        const vector = this._cache_objects.map((cache_object) => {
            return cache_object.query(offset);
        });
        const valueFunc = this._layer.valueFunc;
        const dynamic = vector.map((v) => v.dynamic).some(e => e == true);
        const values = vector.map((v) => v.value);
        const value = (valueFunc) ? valueFunc(values) : values;
        return {value, dynamic, offset};
    }

    dirty() {
        // Noop - as long as queryobject is stateless
    }

    refresh(offset) {
        // Noop - as long as queryobject is stateless
    }

    get nearby() {
        throw new Error("not implemented")
    }


}


export class MergeLayer extends LayerBase {

    constructor (options={}) {
        super();

        this._cache_objects = [];

        // value func
        let {valueFunc=undefined} = options;
        if (typeof valueFunc == "function") {
            this._valueFunc = valueFunc
        }

        // sources (layers)
        this._sources;
        let {sources} = options;
        if (sources) {
            this.sources = sources;
        }
 
        // subscribe to callbacks from sources
    }



    /**********************************************************
     * QUERY API
     **********************************************************/

    get valueFunc () {
        return this._valueFunc;
    }

    getQueryObject () {
        const cache_object = new MergeLayerCacheObject(this);
        this._cache_objects.push(cache_object);
        return cache_object;
    }

    /*
    query(offset) {
        if (offset == undefined) {
            throw new Error("Layer: query offset can not be undefined");
        }
        let values = this._sources.map((layer) => {
            return layer.query(offset);
        });
        // TODO - apply function to arrive at single value for layer.
        return values;
    }
    */

    /**********************************************************
     * UPDATE API
     **********************************************************/
    
    get sources () {
        return this._sources;
    }
    set sources (sources) {
        this._sources = sources;
        let indexes = sources.map((layer) => layer.index);
        this._index = new NearbyIndexMerge(indexes);
    }

}








function cmp_ascending(p1, p2) {
    return endpoint.cmp(p1, p2)
}

function cmp_descending(p1, p2) {
    return endpoint.cmp(p2, p1)
}

/**
 * Merging indexes from multiple sources into a single index.
 * 
 * A source is an object with an index.
 * - layer
 * - datasource
 * 
 * The merged index gives a temporal structure for the
 * collection of sources, computing a list of
 * sources which are defined at a given offset
 * 
 * nearby(offset).center is a list of items
 * [{itv, src}]
 * 
 * Implementaion is stateless.
 */

export class MergeIndex extends NearbyIndexBase {

    constructor(sources) {
        super();
        this._sources = sources;
    }

    nearby(offset) {
        // accumulate nearby from all sources
        const prev_list = [], center_list = [], next_list = [];
        for (let src of this._sources) {
            let {itv, prev, center, next} = src.index.nearby(offset);
            if (prev != undefined) prev_list.push(prev);            
            if (next != undefined) next_list.push(next);
            if (center > 0) {
                center_list.push({itv, src});
            }
        }
        
        // find closest endpoint to the right (not in center)
        next_list.sort(cmp_ascending);
        const min_next_low = next_list[0] || [Infinity, 0];

        // find closest endpoint to the left (not in center)
        prev_list.sort(cmp_descending);
        const max_prev_high = prev_list[0] || [-Infinity, 0];

        // nearby
        let low, high; 
        const result = {
            center: center_list, 
        }

        if (center_list.length == 0) {

            // empty center
            result.right = min_next_low;       
            result.next = min_next_low;
            result.left = max_prev_high;
            result.prev = max_prev_high;

        } else {

            // non-empty center

            // center high
            let center_high_list = center_list.map((item) => {
                return endpoint.from_interval(item.itv)[1];
            }).sort(cmp_ascending);
            let min_center_high = center_high_list[0];
            let max_center_high = center_high_list.slice(-1)[0];
            let multiple_center_high = !endpoint.eq(min_center_high, max_center_high)

            // center low
            let center_low_list = center_list.map((item) => {
                return endpoint.from_interval(item.itv)[0]
            }).sort(cmp_descending);
            let max_center_low = center_low_list[0];
            let min_center_low = center_low_list.slice(-1)[0];
            let multiple_center_low = !endpoint.eq(max_center_low, min_center_low)

            // next/right
            if (endpoint.le(min_next_low, min_center_high)) {
                result.right = min_next_low;
            } else {
                result.right = endpoint.flip(min_center_high, "low")
            }
            result.next = (multiple_center_high) ? result.right : min_next_low;

            // prev/left
            if (endpoint.ge(max_prev_high, max_center_low)) {
                result.left = max_prev_high;
            } else {
                result.left = endpoint.flip(max_center_low, "high");
            }
            result.prev = (multiple_center_low) ? result.left : max_prev_high;    
        }

        // interval from left/right
        low = endpoint.flip(result.left, "low");
        high = endpoint.flip(result.right, "high");
        result.itv = interval.from_endpoints(low, high);

        // switch to undefined
        if (result.prev[0] == -Infinity) {
            result.prev = undefined;
        }
        if (result.left[0] == -Infinity) {
            result.left = undefined;
        }
        if (result.next[0] == Infinity) {
            result.next = undefined;
        }
        if (result.right[0] == Infinity) {
            result.right = undefined;
        }

        return result;
    }
};

