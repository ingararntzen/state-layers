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
 * - queryOptions specializes the query output
 * 
 * 
 * NOTE - this might be part of the BaseLayer class instead.
 */

const PREFIX = "__layerquery";

export function addToInstance (object, queryOptions, CacheClass) {
    object[`${PREFIX}_index`];
    object[`${PREFIX}_queryOptions`] = queryOptions;
    object[`${PREFIX}_cacheClass`] = CacheClass;
    object[`${PREFIX}_cacheObject`] = new CacheClass(object);
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
    Object.defineProperty(_prototype, "queryOptions", {
        get: function () {
            return this[`${PREFIX}_queryOptions`];
        }
    });

    function getCache () {
        let CacheClass = this[`${PREFIX}_cacheClass`];
        const cache = new CacheClass(this);
        this[`${PREFIX}_cacheObjects`].push(cache);
        return cache;
    }

    function clearCaches () {
        this[`${PREFIX}_cacheObject`].clear();
        for (let cache of this[`${PREFIX}_cacheObjects`]) {
            cache.clear();
        }
    }

    function query (offset) {
        return this[`${PREFIX}_cacheObject`].query(offset);
    }

    
    Object.assign(_prototype, {getCache, clearCaches, query});
}

