import { interval, endpoint } from "./intervals.js";
import { NearbyIndexBase, nearby_from } from "./nearbyindex_base.js";
import { StateProviderBase } from "./stateprovider_base.js";
import { SortedArray } from "./sortedarray.js";


const pfi = endpoint.from_interval;
const ifp = interval.from_endpoints;

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

        this._initialise();
    }

    _initialise() {
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
        offset = endpoint.from_input(offset);
        const center = this._covers(offset);
        const prev_high = this._high_points.lt(offset) || [-Infinity, 0];
        const next_low = this._low_points.gt(offset) || [Infinity, 0];
        const center_low_list = [];
        const center_high_list = [];
        for (const item of center) {
            const [low, high] = endpoint.from_interval(item.itv);
            center_high_list.push(high);
            center_low_list.push(low);    
        }
        return nearby_from(
            prev_high, 
            center_low_list, 
            center,
            center_high_list,
            next_low
        );
    }

    /*
		refresh index based on changes
    */
	refresh (changes) {
		const low_clear_cache = make_set_cache();
		const high_clear_cache = make_set_cache();
		const low_create_cache = make_set_cache();
		const high_create_cache = make_set_cache();

        const {items, remove, clear} = changes;

        if (clear) {
            this._initialise();
        } else {
            for (const item of remove) {
                let [low, high] = pfi(item.itv);
                this._remove(low, item, low_clear_cache);
                this._remove(high, item, high_clear_cache);
            }    
        }

        for (const item of items) {
            let [low, high] = pfi(item.itv);
            this._insert(low, item, low_create_cache);
            this._insert(high, item, high_create_cache);	
        }

		/*
			flush changes to sorted arrays
			
			Ensure that low_points and high_points indexes 
			match exactly with endpoints mapped to items in _itemsmap.
			
			This could be solved by rebuilding indexes from
			itemsmap. However, in the event that the indexes are large and 
			changes are small, we can optimise, based on caches

		*/
		const low_clear = [];
		const high_clear = [];
		const low_create = [];
		const high_create = [];

		for (let sign of [-1, 0, 1]) {

			// clear
			const clear_tasks = [
				[low_clear, low_clear_cache], 
				[high_clear, high_clear_cache]
			]
			for (const [array, cache] of clear_tasks) {
				for (const value of cache.get(sign).values()) {
					// verify that itemsmap is indeed empty
					if (!this._itemsmap.get(sign).has(value)) {
						array.push([value, sign]);
					}
				}	
			}

			// create			
			const create_tasks = [
				[low_create, low_create_cache], 
				[high_create, high_create_cache]
			]
			for (const [array, cache] of create_tasks) {
				for (const value of cache.get(sign).values()) {
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
	}

	/*
		remove item for endpoint
		- if last item to be removed - add to cleared endpoints
	*/
    _remove(endpoint, item, cleared_endpoints) {
    	const [value, sign] = endpoint;
    	const map = this._itemsmap.get(sign);
    	const items = map.get(value);    	
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
    	const [value, sign] = endpoint;
    	const map = this._itemsmap.get(sign);
      	const items = map.get(value);
        created_endpoints.get(sign).add(value);
        if (items == undefined) {
            map.set(value, [item]);
        } else {
            items.push(item);
        }
    }

    /*
		covers : return all items which cover offset

		search from offset to the left - use low_points index
		TODO - make more efficient by limiting search
    */
    _covers(offset) {
        // check all items with low to the left of offset
    	const checked_ids = new Set();
        const items = [];
        for (const [value, sign] of this._low_points.array) {
            if (endpoint.gt([value, sign], offset)) {
                break;
            }
            for (const item of this._itemsmap.get(sign).get(value)) {
                if (checked_ids.has(item.id)) {
                    continue;
                }
                // check item
                if (interval.covers_endpoint(item.itv, offset)) {
                    items.push(item);
                }
                checked_ids.add(item.id);
            }
        } 
        return items;
    }
}