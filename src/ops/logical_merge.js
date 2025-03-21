import { Layer } from "../layer_base.js";
import { NearbyIndexBoolean } from "./boolean.js";
import { NearbyIndexMerge } from "./merge.js";


export function logical_merge_layer(sources, options={}) {

    const {expr} = options;
    let condition;
    if (expr) {
        condition = (center) => {
            return expr.eval(center);
        }    
    }

    const layer = new Layer();
    const index = new NearbyIndexMerge(sources);
    layer.index = new NearbyIndexBoolean(index, {condition});

    // subscribe to callbacks from sources
    sources.map((src) => {
        return src.add_callback(layer.onchange);
    });
    
    layer.sources = sources;

    return layer;
}


export function logical_expr (src) {
    if (!(src instanceof Layer)) {
        throw new Error(`must be layer ${src}`)
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




