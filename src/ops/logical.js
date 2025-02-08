import { endpoint, interval } from "../intervals.js";
import { BooleanIndex } from "../nearbyindex.js";
import { Layer } from "../layers.js"
import * as srcprop from "../api_srcprop.js";

class LogicalLayer extends Layer {

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

export function logical(layer) {
    return new LogicalLayer(layer);
} 