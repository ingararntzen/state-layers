import { endpoint } from "../intervals.js";
import { NearbyIndexBase } from "../nearby_base.js";
import { Layer } from "../layer_base.js"
import * as srcprop from "../api_srcprop.js";

function shifted(p, offset) {
    if (p == undefined || !isFinite(p)) {
        // p - no skew
        return p;
    }
    else if (typeof p == "number") {
        // p is number - skew
        return p + offset;
    } else if (Array.isArray(p) && p.length > 1) {
        // p is endpoint - skew value
        let [val, sign] = p;
        return [val + offset, sign];
    }
}


/*********************************************************************
    SHIFT INDEX
*********************************************************************/

class ShiftIndex extends NearbyIndexBase {

    constructor (layer, skew) {
        super();
        this._layer = layer;
        this._skew = skew;
        this._cache = layer.createCache();

        // skewing cache object
        this._shifted_cache = {
            query: function (offset) {
                // skew query (negative) - override result offset
                return {...this._cache.query(shifted(offset, -this._skew)), offset};
            }.bind(this)
        };
    }

    // skewing index.nearby
    nearby(offset) {
        offset = endpoint.from_input(offset);
        // skew query (negative)
        const nearby = this._layer.index.nearby(shifted(offset, -this._skew));
        // skew result (positive) 
        const itv = nearby.itv.slice();
        itv[0] = shifted(nearby.itv[0], this._skew);
        itv[1] = shifted(nearby.itv[1], this._skew)
        return {
            itv,
            left: shifted(nearby.left, this._skew),
            right: shifted(nearby.right, this._skew),
            center: nearby.center.map(() => this._shifted_cache)
        }
    }
}


/*********************************************************************
    SHIFT LAYER
*********************************************************************/


class ShiftLayer extends Layer {

    constructor(layer, skew, options={}) {
        super(options);
        this._skew = skew;
        // setup src propterty
        srcprop.addState(this);
        this.srcprop_register("src");
        this.src = layer;
    }

    srcprop_check(propName, src) {
        if (propName == "src") {
            if (!(src instanceof Layer)) {
                throw new Error(`"src" must be Layer ${src}`);
            }
            return src;    
        }
    }

    srcprop_onchange(propName, eArg) {
        if (propName == "src") {
            if (this.index == undefined || eArg == "reset") {
                this.index = new ShiftIndex(this.src, this._skew)
            } 
            this.clearCaches();
            this.notify_callbacks();
            this.eventifyTrigger("change");    
        }
    }
}
srcprop.addMethods(ShiftLayer.prototype);

/**
 * Skewing a Layer by an offset
 * 
 * a positive value for offset means that
 * the layer is shifted to the right on the timeline
 * 
 * 
 */

export function shift (layer, offset) {
    return new ShiftLayer(layer, offset);
}
