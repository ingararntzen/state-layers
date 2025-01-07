import {BaseLinearIndex} from "./linear_index_base.js";
import {intervals} from "./intervals.js";

/**
 * 
 * Simple Linear Index
 * 
 * - items are assumed to be non-overlapping, implying that any entry will 
 *   include at most one item
 * - exception will be raised if overlapping entries are found
 * - items is assumbed to be immutable array.
 * - change by replacing array
 */


export class SimpleLinearIndex extends BaseLinearIndex {

    constructor() {
        super();
        this._items = [];
    }


    set(items) {
        this._items = items;
    }
     
}