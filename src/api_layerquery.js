/************************************************
 * LAYER QUERY INTERFACE
 ************************************************/

/**
 * Decorate an object/prototype of a Layer to implement 
 * the LayerQuery interface.
 * 
 * The layer query interface implements a query
 * mechanism for layers, with built-in caching
 * 
 * Example use
 * cache = object.getCache() 
 * cache.query();
 * 
 * - clearCaches is for internal use
 * - index is the actual target of of the query
 * - valueFunc specializes the query output
 * 
 * 
 * NOTE - this might be part of the BaseLayer class instead.
 */

const PREFIX = "__layerquery";

export function addToInstance (object, CacheClass, valueFunc) {
    object[`${PREFIX}_index`];
    object[`${PREFIX}_valueFunc`] = valueFunc;
    object[`${PREFIX}_cacheClass`] = CacheClass;
    object[`${PREFIX}_cacheObjects`] = [];
}

export function addToPrototype (_prototype) {

    Object.defineProperty(_prototype, "index", {
        get: function () {
            return this[`${PREFIX}_index`];
        },
        set: function (index) {
            this[`${PREFIX}_index`] = index;
        }
    });
    Object.defineProperty(_prototype, "valueFunc", {
        get: function () {
            return this[`${PREFIX}_valueFunc`];
        }
    });

    function getCache () {
        let CacheClass = this[`${PREFIX}_cacheClass`]
        console.log(CacheClass)
        const cache = new CacheClass(this);
        this[`${PREFIX}_cacheObjects`].push(cache);
        return cache;
    }

    function clearCaches () {
        for (let cache of this[`${PREFIX}_cacheObjects`]) {
            cache.clear();
        }
    }
    
    Object.assign(_prototype, {getCache, clearCaches});
}

