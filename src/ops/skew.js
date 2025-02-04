import { NearbyIndexBase } from "../nearbyindex.js";
import { Layer } from "../layers.js"
import * as srcprop from "../api_srcprop.js";

function skewed(p, offset) {
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
    SKEW INDEX
*********************************************************************/

class SkewIndex extends NearbyIndexBase {

    constructor (layer, skew) {
        super();
        this._layer = layer;
        this._skew = skew;
        this._cache = layer.getCache();

        // skewing cache object
        this._skewed_cache = {
            query: function (offset) {
                // skew query (negative) - override result offset
                return {...this._cache.query(skewed(offset, -this._skew)), offset};
            }.bind(this)
        };
    }

    // skewing index.nearby
    nearby(offset) {
        // skew query (negative)
        const nearby = this._layer.index.nearby(skewed(offset, -this._skew));
        // skew result (positive) 
        const itv = nearby.itv.slice();
        itv[0] = skewed(nearby.itv[0], this._skew);
        itv[1] = skewed(nearby.itv[1], this._skew)
        return {
            itv,
            left: skewed(nearby.left, this._skew),
            right: skewed(nearby.right, this._skew),
            next: skewed(nearby.next, this._skew),
            prev: skewed(nearby.prev, this._skew),
            center: nearby.center.map(() => this._skewed_cache)
        }
    }
}


/*********************************************************************
    SKEW LAYER
*********************************************************************/

/**
 * Todo - make SkewLayer use a dynamic Skew Cursor
 * as ctrl.
 */


class SkewLayer extends Layer {

    constructor(layer, skew, options={}) {
        super(options);
        this._skew = skew;
        // setup src propterty
        srcprop.addToInstance(this);
        this.srcpropRegister("src");
        this.src = layer;
    }

    propCheck(propName, src) {
        if (propName == "src") {
            if (!(src instanceof Layer)) {
                throw new Error(`"src" must be Layer ${src}`);
            }
            return src;    
        }
    }

    propChange(propName, eArg) {
        if (propName == "src") {
            if (this.index == undefined || eArg == "reset") {
                this.index = new SkewIndex(this.src, this._skew)
            } else {
                this.clearCaches();
            }
            this.notify_callbacks();
            this.eventifyTrigger("change");    
        }
    }
}
srcprop.addToPrototype(SkewLayer.prototype);

/**
 * Skewing a Layer by an offset
 * 
 * a positive value for offset means that
 * the layer is shifted to the right on the timeline
 * 
 * 
 */

export function skew (layer, offset) {
    return new SkewLayer(layer, offset);
}
