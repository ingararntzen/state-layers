import { interval, endpoint} from "../intervals.js";
import { NearbyIndexBase } from "../nearbyindex.js";
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
 * on whether the source index is defined or not.
 * Back-to-back regions which are defined 
 * are collapsed into one region
 * 
 * Boolean Index is stateless.
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

    constructor(index) {
        super();
        this._index = index;
        this._trueObject = queryObject(true);
        this._falseObject = queryObject(false);
    }

    nearby(offset) {
        offset = this.check(offset);
        const nearby = this._index.nearby(offset);

        // left, right is unchanged if center is empty
        if (nearby.center.length == 0) {
            nearby.center = [this._falseObject];
            return nearby;
        }

        // seek left and right for next gap - expand region
        let [low, high] = endpoint.from_interval(nearby.itv)
        let current_nearby;

        // seek right
        current_nearby = nearby;
        while (true) {
            // region on the right
            const next_nearby = this._index.nearby(current_nearby.right);
            if (next_nearby.center.length > 0) {
                // expand region
                high = endpoint.from_interval(next_nearby.itv)[1];
                // check if this is last region
                if (next_nearby.right[0] == Infinity) {
                    break;
                } else {
                    // continue
                    current_nearby = next_nearby;
                }
            } else {
                // found gap
                break;
            }
        }

        // seek left
        current_nearby = nearby;
        while (true) {
            // region on the left
            const next_nearby = this._index.nearby(current_nearby.left);
            if (next_nearby.center.length > 0) {
                // expand region
                low = endpoint.from_interval(next_nearby.itv)[0];
                // check if this is last region
                if (next_nearby.left[0] == -Infinity) {
                    break;
                } else {
                    // continue
                    current_nearby = next_nearby;
                }
            } else {
                // found gap
                break;
            }
        }

        return {
            itv: interval.from_endpoints(low, high),
            center : [this._trueObject],
            left: endpoint.flip(low, "high"),
            right: endpoint.flip(high, "low"),
        }
    }
}
