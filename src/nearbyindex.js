import { interval, endpoint } from "./intervals.js";
import { NearbyIndexBase } from "./nearbyindex_base.js";
import { StateProviderBase } from "./stateprovider_base.js";
import { SortedArray } from "./sortedarray.js";

// get interval low endpoint
function get_low_endpoint(item) {
    return endpoint.from_interval(item.itv)[0]
}

// get interval high endpoint
function get_high_endpoint(item) {
    return endpoint.from_interval(item.itv)[1]
}

function make_set_cache () {
	return new Map([
		[-1, new Set()], 
		[0, new Set()], 
		[1, new Set()]
	]);
}



export class NearbyIndex extends NearbyIndexBase {

    constructor(stateProvider) {
        super();

        if (!(stateProvider instanceof StateProviderBase)) {
            throw new Error(`must be stateprovider ${stateProvider}`);
        }
        this._sp = stateProvider;

		// sorted arrays of endpoints
		this._low_points = new SortedArray();
		this._high_points = new SortedArray();

		/* 
			items by endpoint
			[value, sign] = endpoint
			items.get(sign).get(value) == [item, ..]
			each item will typically appear twice, at two different
			endpoints.
		*/
		this._itemsmap = new Map([
			[-1, new Map()], 
			[0, new Map()], 
			[1, new Map()]
		]);
    }

    get src () {return this._sp;}

    /*
		nearby (offset)
    */
    nearby(offset) { 
        let center = this.covers(offset);
        let left = this._high_points.lt(offset);
        let right = this._low_points.gt(offset);
        return {left, center, right};
    }


	refresh (changes) {
		const low_clear_cache = make_set_cache();
		const high_clear_cache = make_set_cache();
		const low_create_cache = make_set_cache();
		const high_create_cache = make_set_cache();


        


		for (let eArg of eArgList) {
	        // remove
	        if (eArg.old != undefined) {
	        	let [low, high] = pfi(eArg.old.valid);
	        	this._remove(low, eArg.old, low_clear_cache);
	        	this._remove(high, eArg.old, high_clear_cache);        	
			}
			// insert
			if (eArg.new != undefined) {
				let [low, high] = pfi(eArg.new.valid);
	        	this._insert(low, eArg.new, low_create_cache);
	        	this._insert(high, eArg.new, high_create_cache);	
			}
		}
		/*
			flush changes to sorted arrays
			
			After this operation low_points and high_points index should 
			match exactly with endpoints mapped to items in _itemsmap.
			
			This could be solved by rebuilding indexes from
			itemsmap. However, in the event that the indexes are large and 
			changes are small, we can optimise, based on hints collected in
			cleared_once and created_once.

		*/

		const low_clear = [];
		const high_clear = [];
		const low_create = [];
		const high_create = [];

		let cache, array;
		for (let sign of [-1, 0, 1]) {

			// clear
			let clear_tasks = [
				[low_clear, low_clear_cache], 
				[high_clear, high_clear_cache]
			]
			for (let [array, cache] of clear_tasks) {
				for (let value of cache.get(sign).values()) {
					// verify that itemsmap is indeed empty
					if (!this._itemsmap.get(sign).has(value)) {
						array.push([value, sign]);
					}
				}	
			}

			// create			
			let create_tasks = [
				[low_create, low_create_cache], 
				[high_create, high_create_cache]
			]
			for (let [array, cache] of create_tasks) {
				for (let value of cache.get(sign).values()) {
					// verify that itemsmap is indeed non-empty
					if (this._itemsmap.get(sign).has(value)) {
						array.push([value, sign]);
					}
				}
			}		
		}
		
		// update indexes
		this._low_points.update(low_clear, low_create);
		this._high_points.update(high_clear, high_create);


		if (low_clear.length + low_create.length + 
			high_clear.length + high_create.length > 0) {
			// something has changed
			// TODO : figure out what has really has been changed
			let itv = [-Infinity, Infinity, true, true];
			return {change:true, itv};
		}
		return {change:false, itv:undefined};
	}






	/*
		remove item for endpoint
		- if last item to be removed - add to cleared endpoints
	*/

    _remove(endpoint, item, cleared_endpoints) {
    	let [value, sign] = endpoint;
    	let map = this._itemsmap.get(sign);
    	let items = map.get(value);    	
		cleared_endpoints.get(sign).add(value);
        if (items != undefined) {
        	// remove item
        	let idx = items.findIndex((_item) => {
        		return _item.id == item.id;
        	});
        	if (idx > -1) {
        		items.splice(idx, 1);
        	}
        }
    };

    /*
		insert item for endpoint
		- if first item to be inserted - add to created endpoints
    */
	_insert(endpoint, item, created_endpoints) {
    	let [value, sign] = endpoint;
    	let map = this._itemsmap.get(sign);
      	let items = map.get(value);
        created_endpoints.get(sign).add(value);
        if (items == undefined) {
            map.set(value, [item]);
        } else {
            items.push(item);
        }
    }


    /*
		covers : all items which cover offset

		search from offset to the left - use low_points index
		TODO - make more efficient by limiting search
    */
    covers(offset) {
    	let p0 = [-Infinity, 0];
    	let p1 = endpoint.from_input(offset);
    	let itv = ifp(p0, p1);
    	let points = this._low_points.lookup(itv);
    	let len = points.length;
    	let ids = new Set();
    	let items = [];
    	for (let i=len-1; i >= 0; i--) {
    		let [value, sign] = points[i];
    		for (let item of this._itemsmap.get(sign).get(value)) {
    			// avoid duplicates
    			if (ids.has(item.id)) {
    				continue;
    			} else {
    				ids.add(item.id);
    			}
    			// check if item covers offset
    			if (interval.covers_endpoint(item.valid, offset)) {    				
    				items.push(item);
    			}
    		}
    	}
    	return items
    }
}