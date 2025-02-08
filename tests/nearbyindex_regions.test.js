/* global describe, test, expect */

import { LocalStateProvider } from '../src/stateprovider_simple.js';
import { NearbyIndexSimple } from '../src/nearbyindex_simple.js';
import { BooleanIndex } from '../src/nearbyindex.js';

// Add your test cases here
describe('NearbyIndex Regions', () => {
    test('test region iterator', () => {

        const intervals = [
            [-Infinity, 0, true, false],
            [0, 1, true, true],
            // gap
            [2, Infinity, false, true],
        ]

        const items = intervals.map(itv => {
            return {itv};
        })

        const src = new LocalStateProvider({items});
        const index = new NearbyIndexSimple(src);

        let result = [...index.regions({includeEmpty:false})];

        expect(result.length).toBe(3);
        result.forEach((items, index) => {
            expect(items.center.length).toBe(1);
            expect(items.itv).toStrictEqual(intervals[index])
        });
    });



    test('test region iterator', () => {

        const intervals = [
            [-Infinity, 0, true, false],
            [0, 1, true, false],
            // gap
            [2, Infinity, true, true],
        ]

        const items = intervals.map(itv => {
            return {itv};
        })

        const src = new LocalStateProvider({items});
        const index = new NearbyIndexSimple(src);

        let regions = [...index.regions({includeEmpty:true})];

        expect(regions.length).toBe(4);
        expect(regions[0].center.length).toBe(1);
        expect(regions[1].center.length).toBe(1);
        expect(regions[2].center.length).toBe(0);
        expect(regions[3].center.length).toBe(1);

        expect(regions[0].itv).toStrictEqual(intervals[0])
        expect(regions[1].itv).toStrictEqual(intervals[1])
        expect(regions[2].itv).toStrictEqual([1,2,true,false])
        expect(regions[3].itv).toStrictEqual(intervals[2])

    });



    test('test region iterator with ranges', () => {

        const intervals = [
            [-Infinity, 0, true, false],
            [0, 1, true, false],
            // gap
            [2, 4, true, false],
            [4, Infinity, true, true],
        ]

        const items = intervals.map(itv => {
            return {itv};
        })

        const src = new LocalStateProvider({items});
        const index = new NearbyIndexSimple(src);
        const regions = [...index.regions({start:1.5, stop:5})];

        expect(regions.length).toBe(3);
        expect(regions[0].itv).toStrictEqual([1, 2, true, false]);
        expect(regions[1].itv).toStrictEqual([2, 4, true, false]);
        expect(regions[2].itv).toStrictEqual([4, Infinity, true, true]);
    });




    test('test next prev', () => {

        const intervals = [
            // gap
            [0, 1, true, false],
            // gap
            [3, 4, true, false],
            // gap
        ]

        const items = intervals.map(itv => {
            return {itv, data: "data"};
        });

        const src = new LocalStateProvider({items});
        const index = new NearbyIndexSimple(src);
        let nearby, next, prev;

        nearby = index.nearby(2);
        next = index.next_region(nearby);
        expect(next.itv).toStrictEqual(intervals[1]);
        prev = index.prev_region(nearby);
        expect(prev.itv).toStrictEqual(intervals[0]);

        nearby = index.nearby(0.5)
        next = index.next_region(nearby);
        expect(next.itv).toStrictEqual(intervals[1]);
        prev = index.prev_region(nearby);
        expect(prev).toBe(undefined);

        nearby = index.nearby(-1)
        next = index.next_region(nearby);
        expect(next.itv).toStrictEqual(intervals[0]);
        prev = index.prev_region(nearby);
        expect(prev).toBe(undefined);

    });



    test('test next prev 2', () => {

        const intervals = [
            [-Infinity, 0, true, false],
            [0, 1, true, true],
            // gap
            [2, Infinity, false, true],
        ]

        const items = intervals.map(itv => {
            return {itv, data: "data"};
        });

        const src = new LocalStateProvider({items});
        const index = new NearbyIndexSimple(src);
        let nearby, next, prev;

        nearby = index.nearby(-Infinity);
        next = index.next_region(nearby);
        expect(next.itv).toStrictEqual(intervals[1]);
        next = index.next_region(next);
        expect(next.itv).toStrictEqual(intervals[2]);
        next = index.next_region(next);
        expect(next).toBe(undefined);
    });


});