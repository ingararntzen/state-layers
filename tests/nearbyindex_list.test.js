/* global describe, test, expect */

import { StateProviderSimple } from '../src/stateprovider_simple.js';
import { NearbyIndexSimple } from '../src/nearbyindex_simple.js';

// Add your test cases here
describe('NearbyIndexList', () => {
    test('should list items of nearby index', () => {

        const intervals = [
            [-Infinity, 0, true, false],
            [0, 1, true, true],
            // gap
            [2, Infinity, false, true],
        ]

        const items = intervals.map(itv => {
            return {itv};
        })

        const src = new StateProviderSimple({items});
        const index = new NearbyIndexSimple(src);

        let result = index.list();

        expect(result.length).toBe(3);
        result.forEach((items, index) => {
            expect(items.length).toBe(1);
            expect(items[0].itv).toStrictEqual(intervals[index])
        });
    });


});