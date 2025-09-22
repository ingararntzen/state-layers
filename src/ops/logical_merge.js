import { Track } from "../track_base.js";
import { NearbyIndexBoolean } from "./boolean.js";
import { NearbyIndexMerge } from "./merge.js";


export function logical_merge_track(sources, options={}) {

    const {expr} = options;
    let condition;
    if (expr) {
        condition = (center) => {
            return expr.eval(center);
        }    
    }

    const track = new Track();
    const index = new NearbyIndexMerge(sources);
    track.index = new NearbyIndexBoolean(index, {condition});

    // subscribe to callbacks from sources
    sources.map((src) => {
        return src.add_callback(track.onchange);
    });
    
    track.sources = sources;

    // restrictions
    Object.defineProperty(track, "numeric", {get: () => true});

    return track;
}


export function logical_expr (src) {
    if (!(src instanceof Track)) {
        throw new Error(`must be track ${src}`)
    }
    return {
        eval: function (center) {
            for (let cache of center) {
                if (cache.src == src) {
                    return true;
                }
            }
            return false;
        }
    }
}

logical_expr.and = function and(...exprs) {
    return {
        eval: function (center) {
            return exprs.every((expr) => expr.eval(center));
        }    
    }
}

logical_expr.or = function or(...exprs) {
    return {
        eval: function (center) {
            return exprs.some((expr) => expr.eval(center));
        }    
    }
}

logical_expr.xor = function xor(expr1, expr2) {
    return {
        eval: function (center) {
            return expr1.eval(center) != expr2.eval(center);
        }    
    }
}

logical_expr.not = function not(expr) {
    return {
        eval: function (center) {
            return !expr.eval(center);
        }    
    }
}




