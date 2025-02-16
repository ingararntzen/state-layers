import { endpoint } from "./intervals.js";
import { NearbyIndexBase, nearby_from } from "./nearbyindex_base.js";
import { StateProviderBase } from "./stateprovider_base.js";
import { SortedArray } from "./sortedarray.js";


// Set of unique [value, sign] endpoints
class EndpointSet {
	constructor() {
		this._map = new Map([
			[-1, new Set()], 
			[0, new Set()], 
			[1, new Set()]
		]);
	}
	add([value, sign]) {
		return this._map.get(sign).add(value);
	}
	has ([value, sign]) {
		return this._map.get(sign).has(value);
	}
	get([value, sign]) {
		return this._map.get(sign).get(value);
	}

	list() {
		const lists = [-1, 0, 1].map((sign) => {
			return [...this._map.get(sign).values()]
				.map((val) => [val, sign]);
		});
		return [].concat(...lists);
	}
}

/**
 * ITEMS MAP
 * 
 * mapping endpoint -> [[item, status],...]
 * status: endpoint is either LOW,HIGH or COVERED for a given item.
 */


const LOW = "low";
const ACTIVE = "active";
const HIGH = "high";

class ItemsMap {

	constructor () {
		// map endpoint -> {low: [items], active: [items], high:[items]}
		this._map = new Map([
			[-1, new Map()], 
			[0, new Map()], 
			[1, new Map()]
		]);
	}

	get_items_with_role ([value, sign], role) {
		const entry = this._map.get(sign).get(value);
		return (entry != undefined) ? entry[role] : [];
	}

	/*
		register item with endpoint (idempotent)
		return true if this was the first LOW or HIGH 
	 */
	register([value, sign], item, role) {
		const sign_map = this._map.get(sign);
		if (!sign_map.has(value)) {
			sign_map.set(value, {low: [], active:[], high:[]});
		}
		const entry = sign_map.get(value);
		const was_empty = entry[LOW].length + entry[HIGH].length == 0;
		let idx = entry[role].findIndex((_item) => {
			return _item.id == item.id;
		});
		if (idx == -1) {
			entry[role].push(item);
		}
		const is_empty = entry[LOW].length + entry[HIGH].length == 0;
		return was_empty && !is_empty;
	}

	/*
		unregister item with endpoint (independent of role)
		return true if this removed last LOW or HIGH
	 */
	unregister([value, sign], item) {
		const sign_map = this._map.get(sign);
		const entry = sign_map.get(value);
		if (entry != undefined) {
			const was_empty = entry[LOW].length + entry[HIGH].length == 0;
			// remove all mentiones of item
			for (const role of [LOW, ACTIVE, HIGH]) {
				let idx = entry[role].findIndex((_item) => {
					return _item.id == item.id;
				});
				if (idx > -1) {
					entry[role].splice(idx, 1);
				}	
			}
			const is_empty = entry[LOW].length + entry[HIGH].length == 0;
			if (!was_empty && is_empty) {
				// clean up entry
				sign_map.delete(value);
				return true;
			}
		}
		return false;
	}

	
}



export class NearbyIndex extends NearbyIndexBase {

    constructor(stateProvider) {
        super();

        if (!(stateProvider instanceof StateProviderBase)) {
            throw new Error(`must be stateprovider ${stateProvider}`);
        }
        this._sp = stateProvider;

		this.refresh({items:this._sp.get_items(), clear:true})
	}

    get src () {return this._sp;}


	_initialise() {
		// register items with endpoints
		this._itemsmap = new ItemsMap();
		// sorted index
		this._endpoints = new SortedArray();
		// swipe index
		this._index = [];
	}


	refresh(changes) {

		const {items=[], remove=[], clear=false} = changes;
		const remove_endpoints = new EndpointSet();
		const insert_endpoints = new EndpointSet();

		if (clear) {
			// clear
			this._initialise();
		} else {
			/*
				unregister removed items across all endpoints 
				where they were registered (LOW, ACTVIE, HIGH) 
			*/
			for (const item of remove) {
				for (const ep in this._endpoints.lookup(item.itv)) {
					const became_empty = this._itemsmap.unregister(ep, item);
					if (became_empty) remove_endpoints.add(ep);
				}
			}
			/* 
				TODO unregister also replaced items
			*/
		}

		/*
			register new items across all endpoints 
			where they should be registered (LOW, ACTVIE, HIGH) 
		*/

		let became_nonempty;
		for (const item of items) {
			// register LOW and HIGH
			const [low, high] = endpoint.from_interval(item.itv);
			became_nonempty = this._itemsmap.register(low, item, LOW);
			if (became_nonempty) insert_endpoints.add(low);
			became_nonempty = this._itemsmap.register(high, item, HIGH);
			if (became_nonempty) insert_endpoints.add(high);
		}

		/*
			refresh sorted endpoints
			possible that an endpoint is present in both lists
			this is presumably not a problem with SortedArray.
		*/

		this._endpoints.update(
			remove_endpoints.list(), 
			insert_endpoints.list()
		);

		/*
			swipe over to ensure that all items are activate
		*/
		const activeSet = new Set();
		for (const ep of this._endpoints.array) {	
			// Add items with ep as low point
			for (let item of this._itemsmap.get_items_with_role(ep, LOW)) {
				activeSet.add(item);
			};

			// activate using activeSet
			for (let item of activeSet) {
				this._itemsmap.register(ep, item, ACTIVE);
			}

			// Remove items with p1 as high point
			for (let item of this._itemsmap.get_items_with_role(ep, HIGH)) {
				activeSet.delete(item);
			};	
		}
	}

	_covers (offset) {
		offset = endpoint.from_input(offset);
		let idx;
		let array = this._endpoints.array;
		// left ep
		const ep1 = this._endpoints.le(offset) || [-Infinity, 0];
		// right ep
		const ep2 = this._endpoints.ge(offset) || [Infinity, 0];
		return this._get_center(ep1, ep2);
	}

	_get_center(ep1, ep2) {
		if (endpoint.eq(ep1, ep2)) {
			return this._itemsmap.get_items_with_role(ep1, ACTIVE);	
		} else {
			// get items for both endpoints
			const items1 = this._itemsmap.get_items_with_role(ep1, ACTIVE);
			const items2 = this._itemsmap.get_items_with_role(ep2, ACTIVE);
			// return all items that are active in both endpoints
			const idSet = new Set(items1.map(item => item.id));
			return items2.filter(item => idSet.has(item.id));
		}
	}


    /*
		nearby (offset)
    */
	nearby(offset) { 
		offset = endpoint.from_input(offset);
		let prev = this._endpoints.le(offset) || [-Infinity, 0];
		let next = this._endpoints.ge(offset) || [Infinity, 0];

		// center
		let center = this._get_center(prev, next);

		const center_empty = center.length == 0;
		const exact_hit = endpoint.eq(prev, next);

		if (exact_hit) {
			if (center_empty) {
				throw new Error("should not happen")
			}
			// move prev and next 
			prev = this._endpoints.lt(offset) || [-Infinity, 0];
			right = this._endpoints.gt(offset) || [Infinity, 0];
			// figure if it is empty on left or right side
			const empty_left = this._get_center(prev, offset).length == 0;
			const empty_right = this._get_center(offset, right).length == 0;
			if (empty_left) {
				prev = offset;
			}
			if (empty_right) {
				next = offset;
			}
		}

		// at this point prev and next points to the correct endpoints
		// but may have to be flipped
		// prev must always be a high point
		// next must always be a low point


		// center lists
		const center_high_list = [];
		const center_low_list = [];
		for (const item of center) {
			const [low, high] = endpoint.from_interval(item.itv);
			center_high_list.push(high);
			center_low_list.push(low);    
		}

		// prev_high - next_low
		/*
			left is not guaranted to be a high endpoint, since
			it could also be a low endpoint belonging from center.
			However, it is only relevant if it is larger than any
			of the center low - so it is enough to make sure it
			is a high point
		*/
		let prev_high = left;
		if (left[1] == 1) {
			prev_high = endpoint.flip(left, "high");			
		}
		// next_low
		let next_low = right;
		if (right[1] == -1) {
			next_low = endpoint.flip(right, "low") 
		}
			
		return nearby_from(
			prev_high, 
			center_low_list, 
			center,
			center_high_list,
			next_low
		);

	}
}