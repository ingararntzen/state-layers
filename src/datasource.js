import * as callback from "./api_callback.js";
import { NearbyIndexSimple } from "./nearbyindex_simple";
import { interval } from "./intervals.js";
import * as segment from "./segments.js";
import { toState } from "./util.js";
import * as layersource from "./api_layersource.js";

/**
 * Datasource is an internal class, wrapping a 
 * state provider so that it can be used as datasource
 * for a Layer.
 * 
 * Since datasources wrap stateproviders, they 
 * maintain an index and a segment cache (nearby cache)
 */

export class Datasource {

    constructor (stateProvider, valueFunc) {
        // callbacks
        callback.addToInstance(this);
        // state provider
        this._sp = stateProvider;
        // layer source api
        layersource.addToInstance(this, DatasourceCache, valueFunc)
        // index
        this._index = new NearbyIndexSimple(this._sp)
        // subscribe to callbacks
        this._sp.add_callback(this._handle_callback.bind(this));        
    }

    _handle_callback() {
        // change in state provider
        this.clearCaches();
        // Forward callback from wrapped state provider
        this.notify_callbacks();
    }
}
callback.addToPrototype(Datasource.prototype);
layersource.addToPrototype(Datasource.prototype);


/*********************************************************************
    DATASOURCE CACHE
*********************************************************************/

/*
    This implements a cache in front of a Datasource.    
    - index of datasource contains segment items
*/

export class DatasourceCache {
    constructor(datasource) {
        // datasource
        this._ds = datasource;
        // cached nearby object
        this._nearby = undefined;
        // cached segment
        this._segment = undefined;
    }

    query(offset) {
        // check cache
        if (
            this._nearby == undefined ||
            !interval.covers_point(this._nearby.itv, offset)
        ) {
            // cache miss
            this._nearby = this._ds.index.nearby(offset);
            let {itv, center} = this._nearby;
            this._segments = center.map((item) => {
                return create_segment(itv, item);
            });
        }
        // query
        const states = this._segments.map((seg) => {
            return seg.query(offset);
        });
        return toState(states, this._ds.valueFunc)
    }

    clear() {
        this._nearby = undefined;
        this._segment = undefined;
    }
}

/*********************************************************************
    LOAD SEGMENT
*********************************************************************/

function create_segment(itv, item) {
    let {type, data} = item;
    if (type == "static") {
        return new segment.StaticSegment(itv, data);
    } else if (type == "transition") {
        return new segment.TransitionSegment(itv, data);
    } else if (type == "interpolation") {
        return new segment.InterpolationSegment(itv, data);
    } else if (type == "motion") {
        return new segment.MotionSegment(itv, data);
    } else {
        console.log("unrecognized segment type", type);
    }
}

