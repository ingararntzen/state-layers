/* global describe, test, expect */

import {SimpleNearbyIndex} from '../src/nearbyindex_simple.js';

// Add your test cases here
describe('SimpleNearbyIndex', () => {
    test('should create an instance of SimpleNearbyIndex', () => {

        const intervals = [
            [-Infinity, 0, true, false],
            [0, 1, true, true],
            // gap
            [2, Infinity, false, true],
        ]

        const items = intervals.map(interval => {
            return {interval};
        })

        const index = new SimpleNearbyIndex({items});
        expect(index).toBeInstanceOf(SimpleNearbyIndex);

        // FIRST ITEM

        // hit within first item
        let nearby = index.nearby(-1);
        expect(nearby.center[0]).toBe(items[0]);

        // last endpoint that hits first item
        nearby = index.nearby([0, -1]);
        expect(nearby.center[0]).toBe(items[0]);

        // interval
        expect(nearby.interval).toStrictEqual(intervals[0]);
        // prev/next
        expect(nearby.prev).toBe(undefined);
        expect(nearby.next).toStrictEqual([0, 0]);
        // left/right
        expect(nearby.left).toBe(undefined);
        expect(nearby.right).toStrictEqual([0, 0]);

        // SECOND ITEM

        // first endpoint that hits second item
        nearby = index.nearby(0);
        expect(nearby.center[0]).toBe(items[1]);

        // last endpoint that hits second item
        nearby = index.nearby([1, 0]);
        expect(nearby.center[0]).toBe(items[1]);

        // interval
        expect(nearby.interval).toStrictEqual(intervals[1]);
        // prev/next
        expect(nearby.prev).toStrictEqual([0, -1]);
        expect(nearby.next).toStrictEqual([2, 1]);
        // left/right
        expect(nearby.left).toStrictEqual([0, -1]);
        expect(nearby.right).toStrictEqual([1, 1]);

        // THIRD ITEM

        // first endpoint that hits third item
        nearby = index.nearby([2,1]);
        expect(nearby.center[0]).toBe(items[2]);

        // endpoint that hits within third item
        nearby = index.nearby(3);
        expect(nearby.center[0]).toBe(items[2]);

        // interval
        expect(nearby.interval).toStrictEqual(intervals[2]);
        // prev/next
        expect(nearby.prev).toStrictEqual([1, 0]);
        expect(nearby.next).toStrictEqual(undefined);
        // left/right
        expect(nearby.left).toStrictEqual([2, 0]);
        expect(nearby.right).toBe(undefined);

        // GAP
        // endpoint within gap
        nearby = index.nearby(1.5);
        expect(nearby.center).toStrictEqual([]);
        expect(nearby.interval).toStrictEqual([1, 2, false, true]);

        // prev/next
        expect(nearby.prev).toStrictEqual([1, 0]);
        expect(nearby.next).toStrictEqual([2, 1]);
        // left/right
        expect(nearby.left).toStrictEqual([1, 0]);
        expect(nearby.right).toStrictEqual([2, 1]);

    });

    // Add more test cases as needed
    test('should update the index with one item and check nearby.center', () => {
        const index = new SimpleNearbyIndex();

        // Check nearby.center before update
        let nearby = index.nearby(1.5);
        expect(nearby.center).toStrictEqual([]);

        // Update the index with a new item
        const newItem =             {
            interval: [-Infinity, Infinity, true, true], 
            args: {value:1}
        }
        index.items = [newItem];

        // Check nearby.center after update
        nearby = index.nearby(1.5);
        expect(nearby.center[0]).toBe(newItem);

        console.log(nearby);

    });

});