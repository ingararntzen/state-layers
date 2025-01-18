/* global describe, test, expect */

import {nearby} from "../src/merge.js";
import {Layer} from "../src/layers.js";

function testrun(acase) {
    return acase.layers.map((layer_intervals) => {
        const items = layer_intervals.map((itv) => {
            return {itv, type: "static", args: data};
        });
        return new Layer({items});
    });
}

const data = "data";
const offset = 4;
const cases = [
    {
        /**
         * two empty layers
         */
        layers: [
            [], 
            []
        ],
        expected: {
            itv: [-Infinity, Infinity, true, true],
            center_length: 0,
            left: undefined,
            prev: undefined,
            right: undefined,
            next: undefined
        }
    },
    {
        /**
         * empty center, layers on both sides
         */
        layers: [
            [[-1, 1, true, false],], 
            [[8, 10, true, false],]
        ],
        expected: {
            itv: [1, 8, true, false],
            center_length: 0,
            left: [1,-1],
            prev: [1,-1],
            right: [8,0],
            next: [8,0]
        }
    },
    {
        /**
         * single center, empty on sides
         */
        layers: [
            [[1, 8, true, false],]
        ],
        expected: {
            itv: [1, 8, true, false],
            center_length: 1,
            left: [1, -1],
            prev: undefined,
            right: [8,0],
            next: undefined
        }
    },

    {
        /**
         * single center, non-empty on sides, gaps
         */
        layers: [
            [[1, 8, true, false],],
            [[-10, 0, true, false]],
            [[10, 20, true, false]]
        ],
        expected: {
            itv: [1, 8, true, false],
            center_length: 1,
            left: [1, -1],
            prev: [0, -1],
            right: [8,0],
            next: [10,0]
        }
    },

    {
        /**
         * multiple non-equal centers, empty on sides
         */
        layers: [
            [[1, 8, true, false]],
            [[0, 7, true, false]],
        ],
        expected: {
            itv: [1, 7, true, false],
            center_length: 2,
            left: [1, -1],
            prev: [1, -1],
            right: [7,0],
            next: [7,0]
        }
    },

    {
        /**
         * multiple equal centers, non-empty on sides
         * overlap - prev/next closer to offset
         * 
         */
        layers: [
            [[1, 8, true, false]],
            [[1, 8, true, false]],
            [[-10, 3, true, false]],
            [[5, 20, true, false]]
        ],
        expected: {
            itv: [3, 5, true, false],
            center_length: 2,
            left: [3, -1],
            prev: [3, -1],
            right: [5,0],
            next: [5,0]
        }
    },

    {
        /**
         * multiple non-equal centers, non-empty on sides
         * overlap - center closer to offset
         * 
         */
        layers: [
            [[1, 8, true, false]],
            [[3, 5, true, false]],
            [[-10, 2, true, false]],
            [[6, 20, true, false]]
        ],
        expected: {
            itv: [3, 5, true, false],
            center_length: 2,
            left: [3, -1],
            prev: [3, -1],
            right: [5,0],
            next: [5,0]
        }
    },

];

describe('MergeTest', () => {

    test('TestAllCases', () => {
        for (let acase of cases) {
            let layers = testrun(acase);
            let result = nearby(layers, offset);
            console.log("result", result);
            expect(acase.expected.itv).toStrictEqual(result.itv);
            expect(acase.expected.left).toStrictEqual(result.left);
            expect(acase.expected.prev).toStrictEqual(result.prev);
            expect(acase.expected.right).toStrictEqual(result.right);
            expect(acase.expected.center_length).toStrictEqual(result.center.length);    
        }
    });
        // Add more test cases as needed
});


