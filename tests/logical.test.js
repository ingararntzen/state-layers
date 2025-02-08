/* global describe, test, expect */
import * as sl from "../src/index.js";

// Add your test cases here
describe('Test Logical Layer', () => {

    test('Check values of Logical Layer', () => {

        const l1 = sl.layer({items:[
            {itv: [0, 1, true, false], data: 0},
            {itv: [1, 2, true, false], data: 1},
            {itv: [2, 3, true, false], data: 2},
            {itv: [3, 4, true, false], data: 3},
            {itv: [4, 5, true, false], data: 4},
            {itv: [5, 6, true, false], data: 5},
            {itv: [6, 7, true, false], data: 6},
            {itv: [7, 8, true, false], data: 7},

        ]});

        const l2 = sl.logical(l1);

        // regions
        const regions = [...l2.regions()]
        expect(regions.length).toBe(3);
        expect(regions[0].itv).toStrictEqual([-Infinity, 0, true, false]);
        expect(regions[1].itv).toStrictEqual([0, 8, true, false]);
        expect(regions[2].itv).toStrictEqual([8, Infinity, true, true]);
        

        // values
        expect(l2.query(-1).value).toBe(false);
        expect(l2.query(4).value).toBe(true);
        expect(l2.query(10).value).toBe(false);
        

        
    });
});