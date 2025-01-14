/* global describe, test, expect */

import {SimpleNearbyIndex} from '../src/nearbyindex_simple.js';

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

        const index = new SimpleNearbyIndex({items});

        let result = index.list();

        expect(result.length).toBe(3);
        result.forEach((items, index) => {
            expect(items.length).toBe(1);
            expect(items[0].itv).toStrictEqual(intervals[index])
        });
    });

    test('should sample items of nearby index', () => {

        const items = [
            {itv: [2, 4, true, false], args: {value: 0.5}},
            {itv: [6, 8, true, false], args: {value: 1.0}},
        ];
        const index = new SimpleNearbyIndex({items});
        let result = index.sample();

        expect(result.length).toBe(8-2+1);
        result.forEach((tup, index) => {
            expect(tup[1]).toBe(2 + index);
        });

        expect(result[0][0]).toBe(0.5);
        expect(result[1][0]).toBe(0.5);
        expect(result[2][0]).toBe(undefined);
        expect(result[3][0]).toBe(undefined);
        expect(result[4][0]).toBe(1.0);
        expect(result[5][0]).toBe(1.0);
        expect(result[6][0]).toBe(undefined);        
    });
});