import { SimpleNearbyIndex } from "./nearbyindex_simple";
import { NearbyCache } from "./nearbycache";

export const nearby = function () {

    function addToInstance(object) {
        let index = new SimpleNearbyIndex();
        object.__nearby_index = index;
        object.__nearby_cache = new NearbyCache(index);
    }

    function update(items) {
        this.__nearby_index.update(items);
        this.__nearby_cache.dirty();
    }

    function query (offset) {
        return this.__nearby_cache.query(offset);
    }

    function addToPrototype(_prototype) {
        const api = {};
        api['__nearby_update'] = update;
        api['__nearby_query'] = query;
        Object.assign(_prototype, api);
    }

    return {addToInstance, addToPrototype}
}();
