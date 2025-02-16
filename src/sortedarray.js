import { endpoint } from "./intervals.js";

function lt (p1, p2) {
	return endpoint.lt(endpoint.from_input(p1), endpoint.from_input(p2));
}
function eq (p1, p2) {
	return endpoint.eq(endpoint.from_input(p1), endpoint.from_input(p2));
}
function cmp (p1, p2) {
	return endpoint.cmp(endpoint.from_input(p1), endpoint.from_input(p2));
}


/*********************************************************************
	SORTED ARRAY
*********************************************************************/

/*
	Sorted array of values.
	- Elements are sorted in ascending order.
	- No duplicates are allowed.
	- Binary search used for lookup

	values can be regular number values (float) or points [float, sign]
		>a : [a, -1] - largest value smaller than a
		a  : [a, 0]  - a
		a< : [a, +1] - smallest value larger than a
*/

export class SortedArray {

	constructor(){
		this._array = [];
	}

	get size() {return this._array.length;}
	get array() {return this._array;}
	/*
		find index of given value

		return [found, index]

		if found is true, then index is the index of the found object
		if found is false, then index is the index where the object should
		be inserted

		- uses binary search		
		- array does not include any duplicate values
	*/
	indexOf(target_value) {
		let left_idx = 0;
		let right_idx = this._array.length - 1;
		while (left_idx <= right_idx) {
			const mid_idx = Math.floor((left_idx + right_idx) / 2);
			let mid_value = this._array[mid_idx];
			if (eq(mid_value, target_value)) {
				return [true, mid_idx]; // Target already exists in the array
			} else if (lt(mid_value, target_value)) {
				  left_idx = mid_idx + 1; // Move search range to the right
			} else {
				  right_idx = mid_idx - 1; // Move search range to the left
			}
		}
	  	return [false, left_idx]; // Return the index where target should be inserted
	}

	/*
		find index of smallest value which is greater than or equal to target value
		returns -1 if no such value exists
	*/
	geIndexOf(target_value) {
		let [found, idx] = this.indexOf(target_value);
		return (idx < this._array.length) ? idx : -1  
	}

	/*
		find index of largest value which is less than or equal to target value
		returns -1 if no such value exists
	*/
	leIndexOf(target_value) {
		let [found, idx] = this.indexOf(target_value);
		idx = (found) ? idx : idx-1;
		return (idx >= 0) ? idx : -1;
	}

	/*
		find index of smallest value which is greater than target value
		returns -1 if no such value exists
	*/
	gtIndexOf(target_value) {
		let [found, idx] = this.indexOf(target_value);
		idx = (found) ? idx + 1 : idx;
		return (idx < this._array.length) ? idx : -1  
	}

	/*
		find index of largest value which is less than target value
		returns -1 if no such value exists
	*/
	ltIndexOf(target_value) {
		let [found, idx] = this.indexOf(target_value);
		idx = idx-1;
		return (idx >= 0) ? idx : -1;	
	}

	/*
		UPDATE

		approach - make all neccessary changes and then sort

		as a rule of thumb - compared to removing and inserting elements
		one by one, this is more effective for larger batches, say > 100.
		Even though this might not be the common case, penalties for
		choosing the wrong approach is higher for larger batches.

		remove is processed first, so if a value appears in both 
		remove and insert, it will remain.
		undefined values can not be inserted 

	*/

	update(remove_list=[], insert_list=[]) {

		/*
			remove

			remove by flagging elements as undefined
			- collect all indexes first
			- flag as undefined only after all indexes have been found,
			  as inserting undefined values breakes the assumption that
			  the array is sorted.
			- later sort will move them to the end, where they can be
			  truncated off
		*/
		let remove_idx_list = [];
		for (let value of remove_list) {
			let [found, idx] = this.indexOf(value);
			if (found) {
				remove_idx_list.push(idx);
			}		
		}
		for (let idx of remove_idx_list) {
			this._array[idx] = undefined;
		}
		let any_removes = remove_idx_list.length > 0;

		/*
			insert

			insert might introduce duplications, either because
			the insert list includes duplicates, or because the
			insert list duplicates preexisting values.

			Instead of looking up and checking each insert value,
			we instead insert everything at the end of the array,
			and remove duplicates only after we have sorted.
		*/
		let any_inserts = insert_list.length > 0;
		if (any_inserts) {
			concat_in_place(this._array, insert_list);
		}

		/*
			sort
			this pushes any undefined values to the end 
		*/
		if (any_removes || any_inserts) {
			this._array.sort(cmp);
		}

		/*
			remove undefined 
			all undefined values are pushed to the end
		*/
		if (any_removes) {
			this._array.length -= remove_idx_list.length;
		}

		/*
			remove duplicates from sorted array
			- assuming there are going to be few duplicates,
			  it is ok to remove them one by one

		*/
		if (any_inserts) {
			remove_duplicates(this._array);
		}
	}

	/*
		get element by index
	*/
	get_by_index(idx) {
		if (idx > -1 && idx < this._array.length) {
			return this._array[idx];
		}
	}

	/*
		lookup values within interval
	*/
	lookup(itv) {
		if (itv == undefined) {
			itv = [-Infinity, Infinity, true, true];
		}
		let [p0, p1] = endpoint.from_interval(itv);
		let p0_idx = this.geIndexOf(p0);
		let p1_idx = this.leIndexOf(p1);
		if (p0_idx == -1 || p1_idx == -1) {
			return [];
		} else {
			return this._array.slice(p0_idx, p1_idx+1);
		}
	}

	lt (offset) {
		return this.get_by_index(this.ltIndexOf(offset));
	}
	le (offset) {
		return this.get_by_index(this.leIndexOf(offset));
	}
	get (offset) {
		let [found, idx] = this.indexOf(offset);
		if (found) {
			return this._array[idx];
		} 
	}
	gt (offset) {
		return this.get_by_index(this.gtIndexOf(offset));
	}
	ge (offset) {
		return this.get_by_index(this.geIndexOf(offset));
	}
}


/*********************************************************************
	UTILS
*********************************************************************/

/*
	Concatinate two arrays by appending the second array to the first array. 
*/

function concat_in_place(first_arr, second_arr) {
	const first_arr_length = first_arr.length;
	const second_arr_length = second_arr.length;
  	first_arr.length += second_arr_length;
  	for (let i = 0; i < second_arr_length; i++) {
    	first_arr[first_arr_length + i] = second_arr[i];
  	}
}

/*
	remove duplicates in a sorted array
*/
function remove_duplicates(sorted_arr) {
	let i = 0;
	while (true) {
		if (i + 1 >= sorted_arr.length) {
			break;
		}
		if (sorted_arr[i] == sorted_arr[i + 1]) {
			sorted_arr.splice(i + 1, 1);
		} else {
			i += 1;
		}
	}
}
