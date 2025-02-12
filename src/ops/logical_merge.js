import { MergeIndex } from "./merge.js";
import { Layer } from "../layers.js";
import { BooleanIndex } from "./boolean.js";


class LogicalMergeLayer extends Layer {

    constructor(sources, options={}) {
        super();

        const {expr} = options;

        let condition;
        if (expr) {
            condition = (center) => {
                return expr.eval(center);
            }    
        }
                    
        // subscribe to callbacks from sources
        const handler = this._onchange.bind(this);
        for (let src of sources) {
            src.add_callback(handler);
        }

        // index
        let index = new MergeIndex(sources);
        this._index = new BooleanIndex(index, {condition});
    }

    get index () {return this._index};

    _onchange(eArg) {
        this.clearCaches();
        this.notify_callbacks();
        this.eventifyTrigger("change");
    }
}


export function logical_merge(sources, options) {
    return new LogicalMergeLayer(sources, options);
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




