import { endpoint } from "./intervals.js";
import { NearbyIndexBase, nearby_from } from "./nearby_base.js";
import { SortedArray } from "./sortedarray.js";
import { is_collection_provider } from "./provider_collection.js";

const {LOW_CLOSED, LOW_OPEN, HIGH_CLOSED, HIGH_OPEN} = endpoint.types;
const EP_TYPES = [LOW_CLOSED, LOW_OPEN, HIGH_CLOSED, HIGH_OPEN];


// Set of unique [v, t] endpoints
class EndpointSet {
	constructor() {
		this._map = new Map([
			[LOW_CLOSED, new Set()],
			[LOW_OPEN, new Set()], 
			[HIGH_CLOSED, new Set()], 
			[HIGH_OPEN, new Set()]
		]);
	}
	add(ep) {
		const [value, type] = ep;
		return this._map.get(type).add(value);
	}
	has (ep) {
		const [value, type] = ep;
		return this._map.get(type).has(value);
	}
	get(ep) {
		const [value, type] = ep;
		return this._map.get(type).get(value);
	}

	list() {
		const lists = EP_TYPES.map((type) => {
			return [...this._map.get(type).values()]
				.map((value) => [value, type]);
		});
		return [].concat(...lists);
	}
}

/**
 * ITEMS MAP
 * 
 * map endpoint -> {
 * 	low: [items], 
 *  active: [items], 
 *  high:[items]
 * }
 * 
 * in order to use endpoint [v,t] as a map key we create a two level
 * map - using t as the first variable. 
 * 
 */


const LOW = "low";
const ACTIVE = "active";
const HIGH = "high";


class ItemsMap {

	constructor () {
		// map endpoint -> {low: [items], active: [items], high:[items]}
		this._map = new Map([
			[LOW_CLOSED, new Map()],
			[LOW_OPEN, new Map()], 
			[HIGH_CLOSED, new Map()], 
			[HIGH_OPEN, new Map()]
		]);
	}

	get_items_by_role (ep, role) {
		const [value, type] = ep;
		const entry = this._map.get(type).get(value);
		return (entry != undefined) ? entry[role] : [];
	}

	/*
		register item with endpoint (idempotent)
		return true if this was the first LOW or HIGH 
	 */
	register(ep, item, role) {
		const [value, type] = ep;
		const type_map = this._map.get(type);
		if (!type_map.has(value)) {
			type_map.set(value, {low: [], active:[], high:[]});
		}
		const entry = type_map.get(value);
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
	unregister(ep, item) {
		const [value, type] = ep;
		const type_map = this._map.get(type);
		const entry = type_map.get(value);
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
				type_map.delete(value);
				return true;
			}
		}
		return false;
	}
}


/**
 * NearbyIndexCollection
 * 
 * NearbyIndex for CollectionProvider
 */

export class NearbyIndexCollection extends NearbyIndexBase {

    constructor(collectionProvider) {
        super();

        if (!(is_collection_provider(collectionProvider))) {
            throw new Error(`must be collection provider ${collectionProvider}`);
        }
        this._cp = collectionProvider;
		this._initialise();
		this.refresh();
	}

    get src () {return this._cp;}


	_initialise() {
		// register items with endpoints
		this._itemsmap = new ItemsMap();
		// sorted index
		this._endpoints = new SortedArray();
		// swipe index
		this._index = [];
	}


	refresh(diffs) {

		const remove_endpoints = new EndpointSet();
		const insert_endpoints = new EndpointSet();

		let insert_items = [];
		let remove_items = [];

		if (diffs == undefined) {
			insert_items = this.src.get_all();
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
			const eps = this._endpoints.lookup(item.itv);
			for (const ep of this._endpoints.lookup(item.itv)) {
				// TODO: check if this is correct
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
		const ep = endpoint.from_input(offset);
		const ep1 = this._endpoints.le(ep) || endpoint.NEG_INF;
		const ep2 = this._endpoints.ge(ep) || endpoint.POS_INF;
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
		const ep = endpoint.from_input(offset);

		// center
		let center = this._covers(ep)
		const center_high_list = [];
		const center_low_list = [];
		for (const item of center) {
			const [low, high] = endpoint.from_interval(item.itv);
			center_high_list.push(high);
			center_low_list.push(low);    
		}

		// prev high
		let prev_high = ep;
		let items;
		while (true) {
			prev_high = this._endpoints.lt(prev_high) || endpoint.NEG_INF;
			if (prev_high[0] == null) {
				break
			}
			items = this._itemsmap.get_items_by_role(prev_high, HIGH);
			if (items.length > 0) {
				break
			}
		}

		// next low
		let next_low = ep;
		while (true) {
			next_low = this._endpoints.gt(next_low) || endpoint.POS_INF
			if (next_low[0] == null) {
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