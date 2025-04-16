/* global describe, test, expect */
import * as sl from "../src/index.js";
import { CollectionProvider } from '../src/provider_collection.js';
import { NearbyIndex } from '../src/nearby_index.js';
import { NearbyIndexBoolean } from '../src/ops/boolean.js';


function setup(options) {
    const sp = new CollectionProvider(options);
    const index = new NearbyIndex(sp);
    sp.add_callback((diffs) => {
        index.refresh(diffs);
    });
    return [sp, index];
}


// Add your test cases here
describe('Test Logical Layer', () => {

    test('Check values of Logical Layer', () => {

        const l1 = sl.layer({items:[
            {id: "1", itv: [0, 1, true, false], data: 0},
            {id: "2", itv: [1, 2, true, false], data: 1},
            {id: "3", itv: [2, 3, true, false], data: 2},
            {id: "4", itv: [3, 4, true, false], data: 3},
            {id: "5", itv: [4, 5, true, false], data: 4},
            {id: "6", itv: [5, 6, true, false], data: 5},
            {id: "7", itv: [6, 7, true, false], data: 6},
            {id: "8", itv: [7, 8, true, false], data: 7},
        ]});

        const l2 = sl.boolean(l1);

        // regions
        const regions = [...l2.regions()]
        expect(regions.length).toBe(3);
        expect(regions[0].itv).toStrictEqual([null, 0, true, false]);
        expect(regions[1].itv).toStrictEqual([0, 8, true, false]);
        expect(regions[2].itv).toStrictEqual([8, null, true, true]);
        

        // values
        expect(l2.query(-1).value).toBe(false);
        expect(l2.query(4).value).toBe(true);
        expect(l2.query(10).value).toBe(false);
 
    });


    test('test boolean index', () => {

        const intervals = [
            // gap - #0
            [0, 1, true, false], // #1
            // gap - #2
            [2, 3, true, false], // # 3
            [3, 4, true, false], // # 3
            // gap - #4
            [5, 6, true, false], // # 5
            [6, 7, true, false], // # 5
            [7, null, true, true], // # 5
        ]

        const items = intervals.map((itv, idx) => {
            return {id: `${idx}`, itv, data: "data"};
        });

        const [sp, index] = setup({items})
        const bool_index = new NearbyIndexBoolean(index);

        // check values
        const offsets = [-1, 0.5, 1.5, 3.5, 4.5, 19]
        const bools = offsets.map((offset) => {
            return bool_index.nearby(offset).center[0].query(offset).value;
        });
        expect(bools).toStrictEqual([false, true, false, true, false, true]);

        // check regions
        const regions = [...bool_index.regions()];
        expect(regions.length).toBe(6);
                
        // check each region
        expect(regions[0].itv).toStrictEqual([null, 0, true, false]);
        expect(regions[1].itv).toStrictEqual([0, 1, true, false]);
        expect(regions[2].itv).toStrictEqual([1, 2, true, false]);
        expect(regions[3].itv).toStrictEqual([2, 4, true, false]);
        expect(regions[4].itv).toStrictEqual([4, 5, true, false]);
        expect(regions[5].itv).toStrictEqual([5, null, true, true]);

    });
    
});