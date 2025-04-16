/* global describe, test, expect */
import * as sl from "../src/index.js";

// Add your test cases here
describe('SkewLayerTest', () => {

    test('check values of skewed layer', () => {

        const OFFSET = 2

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

        const l2 = sl.timeline_transform(l1, {shift:OFFSET});

        const samples_1 = l2.sample(0,10);
        const samples_2 = l2.sample(0 + OFFSET, 10 + OFFSET);

        expect(samples_1).toStrictEqual(samples_2);
    
    });
});