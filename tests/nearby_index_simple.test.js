/* global describe, test, expect */

import {NearbyIndexSimple} from '../src/nearby_index_simple.js';

// Add your test cases here
describe('NearbyIndexSimple', () => {
    test('should create an instance of NearbyIndexSimple', () => {
        const index = new NearbyIndexSimple();
        expect(index).toBeInstanceOf(NearbyIndexSimple);

        const intervals = [
            [-Infinity, 0, true, false],
            [0, 1, true, true],
            [1, Infinity, false, true],
        ]

        const items = intervals.map(interval => {
            return {interval};
        })
        index.set(items)

        // hit first item
        let nearby = index.nearby(-1);
        expect(nearby.left).toBe(undefined);
        expect(nearby.center[0]).toBe(items[0]);
        expect(nearby.right).toStrictEqual([0, 0]);

        // last endpoint that hits first item
        nearby = index.nearby([0, -1]);
        expect(nearby.left).toBe(undefined);
        expect(nearby.center[0]).toBe(items[0]);
        expect(nearby.right).toStrictEqual([0, 0]);

        // first endpoint that hits second item
        nearby = index.nearby(0);
        expect(nearby.left).toStrictEqual([0, -1]);
        expect(nearby.center[0]).toBe(items[1]);
        expect(nearby.right).toStrictEqual([1, 1]);

        // last endpoint that hits second item
        nearby = index.nearby([1, 0]);
        expect(nearby.left).toStrictEqual([0, -1]);
        expect(nearby.center[0]).toBe(items[1]);
        expect(nearby.right).toStrictEqual([1, 1]);

        // first endpoint that hits third item
        nearby = index.nearby([1,1]);
        expect(nearby.left).toStrictEqual([1, 0]);
        expect(nearby.center[0]).toBe(items[2]);
        expect(nearby.right).toBe(undefined);

        // last endpoint that hits third item
        nearby = index.nearby(2);
        expect(nearby.left).toStrictEqual([1, 0]);
        expect(nearby.center[0]).toBe(items[2]);
        expect(nearby.right).toStrictEqual(undefined);
    });

    // Add more test cases as needed
});