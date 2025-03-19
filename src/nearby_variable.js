import { random_string } from "./util.js";
import { endpoint, interval } from "./intervals.js";
import { NearbyIndexBase } from "./nearby_base.js";
import { load_segment } from "./segments.js";

/**
 * NearbyIndexVariable
 * 
 * This class implements a NearbyIndex for VariableProvider
 * 
 * VariableProvider returns 
 *  - either a single item {id, itv, type, data} 
 *  - or undefined.
 * 
 * If itv is bounded on the timeline, either on the left side,
 * on the right side, or both, static items will be created
 * on the side so that the timeline is fully covered.
 */

export class NearbyIndexVariable extends NearbyIndexBase {

    constructor(variableProvider) {
        super();
        this._vp = variableProvider;
        this.refresh();
    }

    refresh(diff) {}

    nearby(offset) {
        const ep = endpoint.from_input(offset);        
        const item = this._vp.get();

        if (item == undefined) {
            return {
                itv: [null, null, true, true],
                center: [],
                right: endpoint.POS_INF,
                left: endpoint.NEG_INF
            }
        }

        const [ep_low, ep_high] = endpoint.from_interval(item.itv);    
        const right = endpoint.flip(ep_high); 
        const left = endpoint.flip(ep_low);
        
        if (interval.covers_endpoint(item.itv, ep)) {
            return {
                itv: item.itv, center: [item], right, left 
            }
        }

        // invent region left or right
        // calculate boundary values
        const segment = load_segment(item.itv, item);
        const low_value = segment.query(ep_low[0]);
        const high_value = segment.query(ep_high[0]);
        const id = random_string(10);

        if (endpoint.lt(ep, ep_low)) {
            // outside on the left
            const itv = interval.from_endpoints(endpoint.NEG_INF, left);
            return {
                itv,
                left: endpoint.NEG_INF,
                right: ep_low,
                center: [{id, itv, type:"static", data: low_value}]
            }
        } else {
            // outside on the right
            const itv = interval.from_endpoints(right, endpoint.POS_INF);
            return {
                itv,
                left: ep_high,
                right: endpoint.POS_INF,
                center: [{id, itv, type:"static", data: high_value}]
            }
        }    
    }
}
