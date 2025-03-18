
import * as srcprop from "./api_srcprop.js";
import { is_variable_provider, random_string } from "./util.js";
import { endpoint, interval } from "./intervals.js";
import { NearbyIndexBase } from "./nearbyindex_base.js";
import { load_segment } from "./segments.js";

/**
 * NearbyIndex for VariableProvider
 * Stateless
 * 
 * VariableProvider returns single item {id, itv, type, data}.
 * If itv is bounded on the timeline, create static items on the side.
 * 
 */


export class NearbyIndexVariable extends NearbyIndexBase {

    constructor(variableProvider) {
        super();
        this._vp = variableProvider;
    }

	nearby(offset) {
        const ep = endpoint.from_input(offset);        
        const item = this._vp.value;

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
        console.log("SHOULD NOT HAPPEN")
    }
}



export class VariableLayer {


    constructor (variableProvider) {

        // setup src propterty
        srcprop.addToInstance(this);
        this.srcprop_register("src");

        // index
        this.index;

        // initialize
        this.src = variableProvider;
    }

    srcprop_check(propName, src) {
        if (propName == "src") {
            if (!(is_variable_provider(src))) {
                throw new Error(`"src" must be variable provider ${src}`);
            }
            return src;    
        }
    }

    srcprop_onchange(propName, eArg) {
        if (propName == "src") {
            if (this.index == undefined || eArg == "reset") {
                this.index = new NearbyIndex(this.src);
            } 
            if (eArg != "reset") {
                this.index.refresh(eArg);
            }
            this.clearCaches();
            this.notify_callbacks();
            this.eventifyTrigger("change");
        }        
    }





}
srcprop.addToPrototype(VariableLayer.prototype);