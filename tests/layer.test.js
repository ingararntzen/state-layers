/* global describe, test, expect */
import * as sl from "../src/index.js";

// Add your test cases here
describe('Test Layer', () => {

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

    test('test layer from cursor', () => {

        const cursor = sl.variable({value:5});
        const layer = sl.layer_from_cursor(cursor);
        
        let result = layer.sample({start:2, stop:8});       
        expect(result.length).toBe(8-2+1);
        result.forEach((tup, index) => {
            expect(tup[1]).toBe(2 + index);
            expect(tup[0] == 5);
        });
    });

    test('test transform', () => {
        const items = [
            {itv: [2, 4, true, false], data: 0.5},
            {itv: [6, 8, true, false], data: 1.0},
        ];
        const l1 = sl.layer({insert:items});

        function valueFunc(value) {
            if (typeof value == "number") {
                return value + 2;
            }
            return value;
        }

        const l2 = sl.layer_transform(l1, {valueFunc});
        let result1 = l1.sample({start:2, stop:8});        
        let result2 = l2.sample({start:2, stop:8});
        for (let i=0; i<result1.length; i++) {
            const [v1, t1] = result1[i];
            const [v2, t2] = result2[i];
            expect(t1==t2)
            if (v1 == undefined) {
                expect(v1 == v2)
            } else {
                expect(v1 + 2 == v2)
            }

        }        
    });


    test('Test layer append', () => {

        const init_items = [
            {id: "0", itv: [0, 1, true, false], data: 0},
            {id: "1", itv: [1, 2, true, false], data: 1},
            {id: "2", itv: [2, 3, true, false], data: 2},
            {id: "3", itv: [3, 4, true, false], data: 3},
            {id: "4", itv: [4, 5, true, false], data: 4},
            {id: "5", itv: [5, 6, true, false], data: 5},
            {id: "6", itv: [6, 7, true, false], data: 6},
            {id: "7", itv: [7, 8, true, false], data: 7},
        ]
        const l1 = sl.layer({insert:init_items});


        const new_items = [
            {id: "a", itv: [2.5, 3.5, true, false], data: 20},
            {id: "b", itv: [3.5, 4.5, true, false], data: 30},
            {id: "c", itv: [4.5, 5.5, true, false], data: 40},
            {id: "d", itv: [5.5, 6.5, true, false], data: 50},
            {id: "e", itv: [6.5, 7.5, true, false], data: 60},
            {id: "f", itv: [7.5, 8.5, true, false], data: 70},
        ]


        l1.append(new_items, 4.5).then(() => {            
            const result = l1.src.get();

            expect(result[0]).toStrictEqual(init_items[0]);
            expect(result[1]).toStrictEqual(init_items[1]);
            expect(result[2]).toStrictEqual(init_items[2]);
            expect(result[3]).toStrictEqual(init_items[3]);

            // truncated high
            expect(result[4].data == init_items[4].data)
            expect(result[4].itv[1] == 4.5)
            expect(result[4].itv[3] == false)
            
            // truncated low
            expect(result[5]).toStrictEqual(new_items[2]);
            expect(result[6]).toStrictEqual(new_items[3]);
            expect(result[7]).toStrictEqual(new_items[4]);
            expect(result[8]).toStrictEqual(new_items[5]);
        });
    });


    test.only('Test layer append supporting correctly with repeated state', () => {

        const init_items = [
            {id: "0", itv: [null, 1, true, false], data: 0},
            {id: "1", itv: [1, 2, true, false], data: 1},
            {id: "2", itv: [2, null, true, false], data: 2},
        ]
        const l1 = sl.layer({insert:init_items});


        const new_items = [
            {id: "0", itv: [null, 1, true, false], data: 0},
            {id: "1", itv: [1, 2, true, false], data: 1},
            {id: "2", itv: [2, null, true, false], data: 2},
        ]

        // TODO - implementation should be strengthened to support
        // repetition of state.

        l1.append(new_items,1.5).then(() => {            
            const result = l1.src.get();
            // expect(result[0]).toStrictEqual(new_items[0]);
            // expect(result[1]).toStrictEqual(new_items[1]);
            // expect(result[2]).toStrictEqual(new_items[2]);
            console.log(result)
        });
    });





});