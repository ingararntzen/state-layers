import { MergeIndex } from "./merge.js";
import { boolean, BooleanLayer } from "./boolean.js";
import { Layer } from "../layers.js";


class LogicalMergeLayer extends Layer {

    constructor(sources, options={}) {
        // make sure sources are BooleanLayers
        sources = sources.map((src) => {
            if (src instanceof BooleanLayer) {
                return src;
            }
            if (src instanceof Layer) {
                return new BooleanLayer(src);
            }
            throw new Error(`sources not supported ${sources}`);
        });

        // set up stateFunc - default OR
        let {expr=Builder.or(...sources)} = options
            
        function stateFunc({offset}) {
            return {value:expr.eval(offset), dynamic:false, offset};
        } 

        super({stateFunc});
        
        // subscribe to callbacks from sources
        const handler = this._onchange.bind(this);
        for (let src of sources) {
            src.add_callback(handler);
        }

        // index
        this._index = new MergeIndex(sources);
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
    if (!src instanceof Layer) {
        throw new Error(`must be layer ${src}`)
    }
    return {
        eval: function (offset) {
            src.query(offset).value;
        }
    }
}

logical_expr.and = function and(...exprs) {
    return {
        eval: function (offset) {
            return exprs.every((expr) => expr.eval(offset));
        }    
    }
}

logical_expr.or = function or(...exprs) {
    return {
        eval: function (offset) {
            return exprs.some((expr) => expr.eval(offset));
        }    
    }
}

logical_expr.xor = function xor(expr1, expr2) {
    return {
        eval: function (offset) {
            return expr1.eval(offset) != expr2.eval(offset);
        }    
    }
}

logical_expr.not = function not(expr) {
    return {
        eval: function (offset) {
            return !expr.eval(offset);
        }    
    }
}




