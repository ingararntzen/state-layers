/************************************************
 * LAYER SOURCE INTERFACE
 ************************************************/

/**
 * Decorate an object/prototype to implement 
 * the LayerSource interface.
 * 
 * - index
 * - valueFunc
 * - getCache
 * - clearCaches
 */

const PREFIX = "__layersource";

export function addToInstance (object, options={}) {
    const {CacheClass, valueFunc} = options;
    object[`${PREFIX}_index`];
    object[`${PREFIX}_valueFunc`] = valueFunc;
    object[`${PREFIX}_cacheClass`] = CacheClass;
    object[`${PREFIX}_cache_objects`] = [];
}

export function addToPrototype (_prototype) {

    Object.defineProperty(_prototype, "index", {
        get: function () {
            return this[`${PREFIX}_index`];
        }
    });
    Object.defineProperty(_prototype, "valueFunc", {
        get: function () {
            return this[`${PREFIX}_valueFunc`];
        }
    });

    function getCache () {
        const cache = new this[`${PREFIX}_cacheClass`](this);
        this[`${PREFIX}_cache_objects`].push(cache);
        return cache;
    }

    function clearCaches () {
        for (let cache of this[`${PREFIX}_cache_objects`]) {
            cache.clear();
        }
    }
    
    Object.assign(_prototype, {getCache, clearCaches});
}

