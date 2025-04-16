/* global describe, test, expect */

import * as sl from "../src/index.js";
import { NearbyIndexMerge } from "../src/ops/merge.js";

const DATA = "data";
const OFFSET = 4;


function runtest(intervals, expected) {
    // make layers
    const layers = intervals.map((intervals) => { 
        return sl.layer({
            items: intervals.map((itv, idx) => {
                return {id: `${idx}`, itv, type: "static", data: DATA};
            })
        });
    });

    let index = new NearbyIndexMerge(layers);
    let result = index.nearby(OFFSET);
    expect(expected.itv).toStrictEqual(result.itv);
    expect(expected.left).toStrictEqual(result.left);
    expect(expected.right).toStrictEqual(result.right);
    expect(expected.center_length).toStrictEqual(result.center.length);    
}


describe('MergeTest', () => {

    test('EmptyCenter-EmptyOnSides', () => {
        const layers = [
            [], 
            []
        ]
        const expected = {
            itv: [null, null, true, true],
            center_length: 0,
            left: [null, "["],
            right: [null, "]"],
        };
        runtest(layers, expected);
    });

    test('EmptyCenter-NonemptyOnSides', () => {
        const layers = [
            [[-1, 1, true, false],], 
            [[8, 10, true, false],]
        ]
        const expected = {
            itv: [1, 8, true, false],
            center_length: 0,
            left: [1, ")"],
            right: [8, "["],
        };
        runtest(layers, expected);
    });

    test('SingleCenter-EmptyOnSides', () => {

        const layers = [
            [[1, 8, true, false]]
        ]
        const expected = {
            itv: [1, 8, true, false],
            center_length: 1,
            left: [1, ")"],
            right: [8,"["],
        };
        runtest(layers, expected);
    });
    
    test('SingleCenter-NonEmptyOnSides-Gaps', () => {
        const layers = [
            [[1, 8, true, false],],
            [[-10, 0, true, false]],
            [[10, 20, true, false]]
        ]
        const expected = {
            itv: [1, 8, true, false],
            center_length: 1,
            left: [1, ")"],
            right: [8, "["],
        };
        runtest(layers, expected);
    });

    test('MultipleNonequalCenter-EmptyOnSides', () => {
        const layers = [
            [[1, 8, true, false]],
            [[0, 7, true, false]],
        ]
        const expected = {
            itv: [1, 7, true, false],
            center_length: 2,
            left: [1, ")"],
            right: [7, "["],
        };
        runtest(layers, expected);
    });

    test('MultipleEqualCenter-NonEmptyOnSides-Overlap-1', () => {
        const layers = [
            [[1, 8, true, false]],
            [[1, 8, true, false]],
            [[-10, 3, true, false]],
            [[5, 20, true, false]]
        ]
        const expected = {
            itv: [3, 5, true, false],
            center_length: 2,
            left: [3, ")"],
            right: [5, "["],
        };
        runtest(layers, expected);
    });

    test('MultipleNonequalCenter-NonemptyOnSides-Overlap-2', () => {
        // center closer to offset
        const layers = [
            [[1, 8, true, false]],
            [[3, 5, true, false]],
            [[-10, 2, true, false]],
            [[6, 20, true, false]]
        ]
        const expected = {
            itv: [3, 5, true, false],
            center_length: 2,
            left: [3, ")"],
            right: [5, "["],
        };
        runtest(layers, expected);
    });

    test('TestMergeLayer List', () => {

        // Datasource 1
        const items_1 = [
            {type: "static", itv: [1, 5, true, false], value: 0.8},
            {type: "static", itv: [10, 15, true, false], value: 0.6},
        ];
        const layer_1 = sl.layer({items:items_1});

        // Datasource 2
        const items_2 = [
            {type: "static", itv: [2.5, 7.5, true, false], value: 0.1},
            {type: "static", itv: [12.5, 17.5, true, false], value: 0.3},
        ];
        const layer_2 = sl.layer({items:items_2});

        // Merge
        let layer = sl.merge([layer_1, layer_2]);

        const expected = [
            [layer_1],
            [layer_1, layer_2],
            [layer_2],
            [layer_1],
            [layer_1, layer_2],
            [layer_2]
        ];

        let regions = [...layer.index.regions({start:0, end:20, includeEmpty:false})];        
        for (let [i, region] of regions.entries()) {
            for (let [j, cache] of region.center.entries()) {
                expect(cache._layer).toBe(expected[i][j]);
            }
        }
    });


    test('TestMergeLayer valueFunc', () => {

        // Datasource 1
        const items_1 = [
            {id: "a", type: "static", itv: [1, 5, true, false], data:0.8},
            {id: "b", type: "static", itv: [10, 15, true, false], data:0.6},
        ];
        const layer_1 = new sl.layer({items:items_1});

        // Datasource 2
        const items_2 = [
            {id: "c", type: "static", itv: [2.5, 7.5, true, false], data:0.1},
            {id: "d", type: "static", itv: [12.5, 17.5, true, false], data:0.3},
        ];
        const layer_2 = sl.layer({items:items_2});

        // valueFunc
        function valueFunc(info) {
            // gives 0 as value even if states is empty list
            return info.states
                .map(state => state.value) 
                .reduce((acc, value) => acc + value, 0);
        }

        // Merge
        let layer = sl.merge([layer_1, layer_2], {valueFunc});


        const expected = [
            [ 0, 0 ],
            [ 0.8, 1 ],
            [ 0.8, 2 ],
            [ 0.9, 3 ],
            [ 0.9, 4 ],
            [ 0.1, 5 ],
            [ 0.1, 6 ],
            [ 0.1, 7 ],
            [ 0, 8 ],
            [ 0, 9 ],
            [ 0.6, 10 ],
            [ 0.6, 11 ],
            [ 0.6, 12 ],
            [ 0.8999999999999999, 13 ],
            [ 0.8999999999999999, 14 ],
            [ 0.3, 15 ],
            [ 0.3, 16 ],
            [ 0.3, 17 ],
            [ 0, 18 ],
            [ 0, 19 ],
            [ 0, 20 ]
        ]
            
        let tups = layer.sample({start:0, stop:20});
        expect(tups).toStrictEqual(expected);
    });


    // Add more test cases as needed
});



