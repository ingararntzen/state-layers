import { endpoint } from "../util/intervals.js";
import { NearbyIndexBase } from "../nearby_base.js";
import { Layer } from "../layer_base.js"
import * as srcprop from "../util/api_srcprop.js";


/**
 * affine transform 1D by shift and scale factor
 */

function transform(p, {shift=0, scale=1}) {
    if (p == undefined || !isFinite(p)) {
        // p - noop
        return p;
    }
    else if (typeof p == "number") {
        // p is number - transform
        return (p*scale) + shift;
    } else if (Array.isArray(p) && p.length > 1) {
        // p is endpoint - transform value
        let [val, bracket] = p;
        return endpoint.from_input([(val*scale)+shift, bracket]);
    }
}

function reverse(p, {shift=0, scale=1}) {
    if (p == undefined || !isFinite(p)) {
        // p - noop
        return p;
    }
    else if (typeof p == "number") {
        // p is number - transform
        return (p-shift)/scale;
    } else if (Array.isArray(p) && p.length > 1) {
        // p is endpoint - transform value
        let [val, bracket] = p;
        return endpoint.from_input([((val-shift)/scale), bracket]);
    }
}


/*********************************************************************
    NEARBY INDEX - AFFINE TIMELINE TRANSFORM
*********************************************************************/

class NearbyIndexATT extends NearbyIndexBase {

    constructor (layer, options={}) {
        super();
        this._layer = layer;
        this._cache = layer.createCache();
        this._options = options;
        
        // transform cache
        this._transform_cache = {
            query: function (offset) {
                // reverse transform query
                const state = this._cache.query(reverse(offset, this._options));
                // keep original offset (instead of reversing result)
                return {...state, offset};
            }.bind(this)
        };
    }

    nearby(offset) {
        offset = endpoint.from_input(offset);
        // reverse transform query offset
        const nearby = this._layer.index.nearby(reverse(offset, this._options));
        // transform query result 
        const itv = nearby.itv.slice();
        itv[0] = transform(nearby.itv[0], this._options);
        itv[1] = transform(nearby.itv[1], this._options);
        return {
            itv,
            left: transform(nearby.left, this._options),
            right: transform(nearby.right, this._options),
            center: nearby.center.map(() => this._transform_cache)
        }
    }
}


/*********************************************************************
    TIMELINE TRANSFORM LAYER
*********************************************************************/

/**
 * Shifting and scaling the timeline of a layer
 * 
 * options:
 * - shift: a value of 2 effectively means that layer contents 
 *   are shifted to the right on the timeline, by 2 units
 * - scale: a value of 2 means that the layer is stretched
 *   by a factor of 2
 */

export function timeline_transform (src, options={}) {

    const layer = new Layer();

    // setup src property
    srcprop.addState(layer);
    srcprop.addMethods(layer);
    layer.srcprop_register("src");
        
    layer.srcprop_check = function(propName, src) {
        if (propName == "src") {
            if (!(src instanceof Layer)) {
                throw new Error(`"src" must be Layer ${src}`);
            }
            return src;    
        }
    }

    layer.srcprop_onchange = function(propName, eArg) {
        if (propName == "src") {
            if (eArg == "reset") {
                this.index = new NearbyIndexATT(this.src, options)
            } 
            layer.onchange();
        }
    }

    // initialise
    layer.src = src;
    
    return layer;
}

