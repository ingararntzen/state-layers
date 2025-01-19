/* global describe, test, expect */

import { NearbyIndexMerge } from "../src/nearbyindex_merge.js";
import { StateProviderSimple } from "../src/stateprovider_simple.js";
import { NearbyIndexSimple } from "../src/nearbyindex_simple.js";
import { Layer, MergeLayer } from "../src/layers.js";


const DATA = "data";
const OFFSET = 4;


function runtest(layers, expected) {
    // make indexes for all layers
    const indexes = layers.map((layer_intervals) => {
        const items = layer_intervals.map((itv) => {
            return {itv, type: "static", args: DATA};
        });
        const src = new StateProviderSimple({items});
        return new NearbyIndexSimple (src);
    });
    let index = new NearbyIndexMerge(indexes);
    let result = index.nearby(OFFSET);
    expect(expected.itv).toStrictEqual(result.itv);
    expect(expected.left).toStrictEqual(result.left);
    expect(expected.prev).toStrictEqual(result.prev);
    expect(expected.right).toStrictEqual(result.right);
    expect(expected.center_length).toStrictEqual(result.center.length);    
}


describe('MergeTest', () => {

    test('EmptyCenter-NoLayersOnSides', () => {
        const layers = [
            [], 
            []
        ]
        const expected = {
            itv: [-Infinity, Infinity, true, true],
            center_length: 0,
            left: undefined,
            prev: undefined,
            right: undefined,
            next: undefined
        };
        runtest(layers, expected);
    });

    test('EmptyCenter-LayersOnSides', () => {
        const layers = [
            [[-1, 1, true, false],], 
            [[8, 10, true, false],]
        ]
        const expected = {
            itv: [1, 8, true, false],
            center_length: 0,
            left: [1,-1],
            prev: [1,-1],
            right: [8,0],
            next: [8,0]
        };
        runtest(layers, expected);
    });

    test('SingleCenter-NoLayersOnSides', () => {

        const layers = [
            [[1, 8, true, false],]
        ]
        const expected = {
            itv: [1, 8, true, false],
            center_length: 1,
            left: [1, -1],
            prev: undefined,
            right: [8,0],
            next: undefined
        };
        runtest(layers, expected);
    });
    
    test('SingleCenter-LayersOnSides-Gaps', () => {
        const layers = [
            [[1, 8, true, false],],
            [[-10, 0, true, false]],
            [[10, 20, true, false]]
        ]
        const expected = {
            itv: [1, 8, true, false],
            center_length: 1,
            left: [1, -1],
            prev: [0, -1],
            right: [8,0],
            next: [10,0]
        };
        runtest(layers, expected);
    });

    test('MultipleNonequalCenter-NoLayersOnSides', () => {
        const layers = [
            [[1, 8, true, false]],
            [[0, 7, true, false]],
        ]
        const expected = {
            itv: [1, 7, true, false],
            center_length: 2,
            left: [1, -1],
            prev: [1, -1],
            right: [7,0],
            next: [7,0]
        };
        runtest(layers, expected);
    });

    test('MultipleEqualCenter-LayersOnSides-Overlap-1', () => {
        // prev/next closer to offset
        const layers = [
            [[1, 8, true, false]],
            [[1, 8, true, false]],
            [[-10, 3, true, false]],
            [[5, 20, true, false]]
        ]
        const expected = {
            itv: [3, 5, true, false],
            center_length: 2,
            left: [3, -1],
            prev: [3, -1],
            right: [5,0],
            next: [5,0]
        };
        runtest(layers, expected);
    });

    test('MultipleNonequalCenter-LayersOnSides-Overlap-2', () => {
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
            left: [3, -1],
            prev: [3, -1],
            right: [5,0],
            next: [5,0]
        };
        runtest(layers, expected);
    });

    test('TestMergeLayer', () => {

        // Datasource 1
        const items_1 = [
            {type: "static", itv: [1, 5, true, false], value: 0.8},
            {type: "static", itv: [10, 15, true, false], value: 0.6},
        ];
        const layer_1 = new Layer({items:items_1});

        // Datasource 2
        const items_2 = [
            {type: "static", itv: [2.5, 7.5, true, false], value: 0.1},
            {type: "static", itv: [12.5, 17.5, true, false], value: 0.3},
        ];
        const layer_2 = new Layer({items:items_2});

        // Merge
        let layer = new MergeLayer({sources:[layer_1, layer_2]});

        const expected = [
            [0.8],
            [0.8, 0.1],
            [0.1],
            [0.6],
            [0.6, 0.3],
            [0.3]
        ];

        let entries = layer.list({start:0, end:20});
        
        for (let [idx, items] of entries.entries()) {
            let values = new Set(items.map((item) => item.value));
            expect(values.size).toBe(expected[idx].length);            
            for (let v of expected[idx]) {
                expect(values.has(v))
            }
        }
    });

    // Add more test cases as needed
});



