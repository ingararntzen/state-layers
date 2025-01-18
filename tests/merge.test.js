/* global describe, test, expect */

import {nearby} from "../src/merge.js";
import {Layer} from "../src/layers.js";


const offset = 4;
const cases = [
    {
        name: "empty",
        layers: [
            [], 
            []
        ],
        expected: {
            itv: [-Infinity, Infinity, true, true],
            center: [],
            left: undefined,
            prev: undefined,
            right: undefined,
            next: undefined
        }
    },
    {
        name: "non-empty",
        layers: [
            [[-1, 1, true, false],], 
            [[2, 4, true, false],]
        ],
        expected: {
            itv: [-Infinity, Infinity, true, true],
            center: [],
            left: undefined,
            prev: undefined,
            right: undefined,
            next: undefined
        }
    }

];


function arun(acase) {
    return acase.layers.map((layer_intervals) => {
        const items = layer_intervals.map((itv) => {
            return {itv, type: "static", args: undefined};
        });
        return new Layer({items});
    });
}



describe('MergeTest', () => {

    
    test('TestAllCases', () => {
   
        let acase = cases[0];

        let layers = arun(acase);
        let result = nearby(layers, offset);
        console.log(result);
        expect(acase.expected).toStrictEqual(result);        
    });
        // Add more test cases as needed
});
