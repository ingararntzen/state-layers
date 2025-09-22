import { endpoint } from "../util/intervals.js";
import { NearbyIndexBase } from "../nearby_base.js";
import { Track } from "../track_base.js"
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

    constructor (track, options={}) {
        super();
        this._track = track;
        this._cache = track.createCache();
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
        const nearby = this._track.index.nearby(reverse(offset, this._options));
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
    TIMELINE TRANSFORM TRACK
*********************************************************************/

/**
 * Shifting and scaling the timeline of a track
 * 
 * options:
 * - shift: a value of 2 effectively means that track contents 
 *   are shifted to the right on the timeline, by 2 units
 * - scale: a value of 2 means that the track is stretched
 *   by a factor of 2
 */

export function timeline_transform (src, options={}) {

    const track = new Track();

    // setup src property
    srcprop.addState(track);
    srcprop.addMethods(track);
    track.srcprop_register("src");
        
    track.srcprop_check = function(propName, src) {
        if (propName == "src") {
            if (!(src instanceof Track)) {
                throw new Error(`"src" must be Track ${src}`);
            }
            return src;    
        }
    }

    track.srcprop_onchange = function(propName, eArg) {
        if (propName == "src") {
            if (eArg == "reset") {
                this.index = new NearbyIndexATT(this.src, options)
            } 
            track.onchange();
        }
    }

    // restrictions
    Object.defineProperty(track, "numeric", {get: () => src.numeric});

    // initialise
    track.src = src;

    return track;
}

