import { callback } from "./util.js";
import { NearbyIndexSimple } from "./nearbyindex_simple";
import { NearbyCache } from "./nearbycache";




/**
 * Datasource is an internal class, wrapping a 
 * state provider so that it can be used as datasource
 * for a Layer.
 * 
 * Since datasources wrap stateproviders, they 
 * maintain an index and a segment cache (nearby cache)
 */

export class Datasource {

    constructor (stateProvider, valueFunc) {
        callback.addToInstance(this);

        // state provider
        this._sp = stateProvider;
        this._valueFunc = valueFunc;
        // index
        // TODO - NearbyIndex must use valueFunc
        this._index = new NearbyIndexSimple(this._sp)

        // cache objects
        this._cache = new NearbyCache(this);
        this._cache_objects = [];
    
        // subscribe to callbacks
        this._sp.add_callback(this._handle_callback.bind(this));        
    }

    _handle_callback() {
        // change in state provider
        this._cache.clear();
        for (let cache_object of this._cache_objects) {
            cache_object.clear();
        }
        // Forward callback from wrapped state provider
        this.notify_callbacks();
    }

    /**********************************************************
     * QUERY API
     **********************************************************/

    get index () {return this._index}
    get valueFunc () {return this._valueFunc;}
    get src () {return this._sp;}

    getQueryObject () {
        const cache_object = new NearbyCache(this);
        this._cache_objects.push(cache_object);
        return cache_object;
    }
    
    query (offset) {
        return this._cache.query(offset);
    }


}
callback.addToPrototype(Datasource.prototype);