/*********************************************************************
    BASE LINEAR INDEX
*********************************************************************/

/**
 * Abstract superclass for linear indexes.
 * 
 * Superclass used to check that a class implements the nearby() method, 
 * and provide some convenience methods.
 * 
 * LINEAR INDEX
 * 
 * Linear Index provides indexing support of effectivelylooking up entries by offset, 
 * given that
 * (i) each entriy is associated with an interval and,
 * (ii) entries are non-overlapping.
 * 
 * 
 * ITEMS
 * Indexing assumes a collection of ITEMS, each defining an interval property
 * 
 * {interval, ...}
 * 
 * NEARBY
 * The nearby method returns information about the neighboring entries 
 * of a particular offset.
 * 
 * Returns {
 *      left - endpoint of the first entry to the left of the offset, else undefined
 *      center - entry, if an entry is defined for the offset, else undefined
 *      right - endpoint of the first entry to the right of the offset, else undefined
 * }
 * 
 * 
 * ENTRY
 * 
 * Entries are defined by interval and a list of items which cover this interval.
 * 
 * {interval, items:[]}
 * 
 * ENDPOINTS
 * 
 * interval endpoints are defined by [value, sign], for example
 * 
 * 4) -> [4,-1] - endpoint is on the left of 4
 * [4, 4, 4] -> [4, 0] - endpoint is at 4 
 * (4 -> [4, 1] - endpoint is on the right of 4)
 * 
 * This representation ensures that the interval endpoints are ordered and allows
 * intervals to be exclusive or inclusive, yet cover the entire real line 
 * 
 * [a,b], (a,b), [a,b), [a, b) are all valid intervals
 * 
 * 
 * ENTRIES
 * 
 * Entris are assumed to be 
 * 
 * / */

export class BaseLinearIndex {

    /* 
        Nearby method
    */

    nearby(offset) {
        throw new Error("Not implemented");
    }
}


