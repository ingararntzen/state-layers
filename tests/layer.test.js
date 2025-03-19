/* global describe, test, expect */
import * as sl from "../src/index.js";

// Add your test cases here
describe('NearbyIndexList', () => {

    test('sample layer with collectionProvider', () => {

        const items = [
            {itv: [2, 4, true, false], data: 0.5},
            {itv: [6, 8, true, false], data: 1.0},
        ];
        const layer = sl.layer({insert:items});
        let result = layer.sample();

        expect(result.length).toBe(8-2+1);
        result.forEach((tup, index) => {
            expect(tup[1]).toBe(2 + index);
        });

        expect(result[0][0]).toBe(0.5);
        expect(result[1][0]).toBe(0.5);
        expect(result[2][0]).toBe(undefined);
        expect(result[3][0]).toBe(undefined);
        expect(result[4][0]).toBe(1.0);
        expect(result[5][0]).toBe(1.0);
        expect(result[6][0]).toBe(undefined);        
    });

    test('sample layer with variableProvider', () => {

        const layer = sl.layer({value:5});
        let result = layer.sample({start:2, stop:8});       
        expect(result.length).toBe(8-2+1);
        result.forEach((tup, index) => {
            expect(tup[1]).toBe(2 + index);
            expect(tup[0] == 5);
        });
    });

});