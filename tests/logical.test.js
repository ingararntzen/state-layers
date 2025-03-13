/* global describe, test, expect */
import * as sl from "../src/index.js";


// Add your test cases here
describe('Test Logical Merge', () => {

    test('Check values of Logical Merge Layer', () => {

        const l1 = sl.layer({insert:[
            {itv: [0, 1, true, false], data: 0},
            {itv: [1, 5, true, false], data: 1},
        ]});

        const l2 = sl.layer({insert:[
            {itv: [3, 4, true, false], data: 3},
            {itv: [4, 10, true, false], data: 4},    
        ]});

        const r = sl.logical_expr;
        const expr = r.and(r(l1), r(l2));
        const l3 = sl.logical_merge([l1, l2], {expr});

        /* 
            l3 should be true only in regions where 
            both l1 and l2 are defined
        */

        const regions = [...l3.regions()]

        expect(regions.length).toBe(3);
        expect(regions[0].itv).toStrictEqual([null, 3, true, false]);
        expect(regions[1].itv).toStrictEqual([3, 5, true, false]);
        expect(regions[2].itv).toStrictEqual([5, null, true, true]);
        
        expect(l3.query(-1).value).toBe(false);
        expect(l3.query(4).value).toBe(true);
        expect(l3.query(10).value).toBe(false);
    });


    
});