import { endpoint } from "./intervals.js";
import { NearbyIndexBase, nearby_from } from "./nearbyindex_base.js";
import { SortedArray } from "./sortedarray.js";
import { is_stateprovider } from "./stateprovider.js";

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

	get_items_by_role ([value, sign], role) {
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

        if (!(is_stateprovider(stateProvider))) {
            throw new Error(`must be stateprovider ${stateProvider}`);
        }
        this._sp = stateProvider;
		this._initialise();
		this.refresh();
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


	refresh(diffs) {
		console.log("nearbyinde refresh", diffs);

		const remove_endpoints = new EndpointSet();
		const insert_endpoints = new EndpointSet();

		let insert_items = [];
		let remove_items = [];

		if (diffs == undefined) {
			insert_items = this.src.get_items();
			// clear all state
			this._initialise();
		} else {
			// collect insert items and remove items
			for (const diff of diffs) {
				if (diff.new != undefined) {
					insert_items.push(diff.new);
				}
				if (diff.old != undefined) {
					remove_items.push(diff.old);
				}
			}
		}

		/*
			unregister remove items across all endpoints 
			where they were registered (LOW, ACTIVE, HIGH) 
		*/
		for (const item of remove_items) {
			console.log("remove item", item);
			for (const ep in this._endpoints.lookup(item.itv)) {
				// TODO: check if this is correct
				console.log("ep", ep);
				const became_empty = this._itemsmap.unregister(ep, item);
				if (became_empty) remove_endpoints.add(ep);
			}	
		}

		/*
			register new items across all endpoints 
			where they should be registered (LOW, HIGH) 
		*/
		let became_nonempty;
		for (const item of insert_items) {
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
			for (let item of this._itemsmap.get_items_by_role(ep, LOW)) {
				activeSet.add(item);
			};
			// activate using activeSet
			for (let item of activeSet) {
				this._itemsmap.register(ep, item, ACTIVE);
			}
			// Remove items with p1 as high point
			for (let item of this._itemsmap.get_items_by_role(ep, HIGH)) {
				activeSet.delete(item);
			};	
		}
	}

	_covers (offset) {
		const ep1 = this._endpoints.le(offset) || [-Infinity, 0];
		const ep2 = this._endpoints.ge(offset) || [Infinity, 0];
		if (endpoint.eq(ep1, ep2)) {
			return this._itemsmap.get_items_by_role(ep1, ACTIVE);	
		} else {
			// get items for both endpoints
			const items1 = this._itemsmap.get_items_by_role(ep1, ACTIVE);
			const items2 = this._itemsmap.get_items_by_role(ep2, ACTIVE);
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

		// center
		let center = this._covers(offset)
		const center_high_list = [];
		const center_low_list = [];
		for (const item of center) {
			const [low, high] = endpoint.from_interval(item.itv);
			center_high_list.push(high);
			center_low_list.push(low);    
		}

		// prev high
		let prev_high = offset;
		let items;
		while (true) {
			prev_high = this._endpoints.lt(prev_high) || [-Infinity, 0];
			if (prev_high[0] == -Infinity) {
				break
			}
			items = this._itemsmap.get_items_by_role(prev_high, HIGH);
			if (items.length > 0) {
				break
			}
		}

		// next low
		let next_low = offset;
		while (true) {
			next_low = this._endpoints.gt(next_low) || [Infinity, 0];
			if (next_low[0] == Infinity) {
				break
			}
			items = this._itemsmap.get_items_by_role(next_low, LOW);
			if (items.length > 0) {
				break
			}
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