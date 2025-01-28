import { LayerBase } from "../bases.js";
import { NearbyIndexBase } from "../nearbyindex.js";


class SkewedNearbyIndex extends NearbyIndexBase {

    constructor (index, skew) {
        super();
        this._index = index;
        this._skew;
    }
    nearby(offset) {
        if (typeof offset === 'number') {
            offset = [offset, 0];
        }
        if (!Array.isArray(offset)) {
            throw new Error("Endpoint must be an array");
        }
        offset[0] = offset[0] + this._skew;
        return this._index.nearby(offset);
    }

}



export class SkewLayer extends LayerBase {


    constructor (layer, skew) {
        super();

        this.src = layer;
        this._skew = skew;
        this._index = new SkewedNearbyIndex(layer.index);
    }


} 