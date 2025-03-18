import { interval, endpoint} from "../intervals.js";
import { NearbyIndexBase } from "../nearby_base.js";
import { Layer } from "../layers.js"

export class BooleanLayer extends Layer {

    constructor(layer) {
        super();
        this.index = new BooleanIndex(layer.index);
    
        // subscribe
        const handler = this._onchange.bind(this);
        layer.add_callback(handler);
    }

    _onchange(eArg) {
        this.clearCaches();
        this.notify_callbacks();
        this.eventifyTrigger("change");
    }
}

export function boolean(layer) {
    return new BooleanLayer(layer);
} 


/*********************************************************************
    BOOLEAN NEARBY INDEX
*********************************************************************/

/**
 * Wrapper Index where regions are true/false, based on 
 * condition on nearby.center.
 * Back-to-back regions which are true are collapsed 
 * into one region
 * 
 */

function queryObject (value) {
    return {
        query: function (offset) {
            return {value, dynamic:false, offset};
        }
    }
}

export class BooleanIndex extends NearbyIndexBase {

    constructor(index, options={}) {
        super();
        this._index = index;
        let {condition = (center) => center.length > 0} = options;
        this._condition = condition;
    }

    nearby(offset) {
        offset = endpoint.from_input(offset);
        const nearby = this._index.nearby(offset);
        
        let evaluation = this._condition(nearby.center); 
        /* 
            seek left and right for first region
            which does not have the same evaluation 
        */
        const condition = (center) => {
            return this._condition(center) != evaluation;
        }

        // expand right
        let right;
        let right_nearby = this._index.find_region(nearby, {
            direction:1, condition
        });        
        if (right_nearby != undefined) {
            right = endpoint.from_interval(right_nearby.itv)[0];
        }

        // expand left
        let left;
        let left_nearby = this._index.find_region(nearby, {
            direction:-1, condition
        });
        if (left_nearby != undefined) {
            left = endpoint.from_interval(left_nearby.itv)[1];
        }

        // expand to infinity
        left = left || endpoint.NEG_INF;
        right = right || endpoint.POS_INF;
        const low = endpoint.flip(left);
        const high = endpoint.flip(right)
        return {
            itv: interval.from_endpoints(low, high),
            center : [queryObject(evaluation)],
            left,
            right,
        }
    }
}
