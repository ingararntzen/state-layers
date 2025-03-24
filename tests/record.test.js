/* global describe, test, expect */
import * as sl from "../src/index.js";
import {endpoint} from "../src/intervals.js";

// Add your test cases here
describe('Test record', () => {


    test('Test Record', () => {

        const l1 = sl.layer({insert:[
            {itv: [0, 1, true, false], data: 0},
            {itv: [1, 2, true, false], data: 1},
            {itv: [2, 3, true, false], data: 2},
            {itv: [3, 4, true, false], data: 3},
            {itv: [4, 5, true, false], data: 4},
            {itv: [5, 6, true, false], data: 5},
            {itv: [6, 7, true, false], data: 6},
            {itv: [7, 8, true, false], data: 7},
        ]});

        const offset = 4.5;

        const current_region = l1.index.nearby(offset);
        console.log("current", current_region)

        // find all items to the right 
        const remove_items = l1.src.get().filter((item) => {
            let ep_low = endpoint.from_interval(item.itv)[0];
            return endpoint.lt(endpoint.from_input(offset), ep_low);
        })
        console.log("remove", remove_items)


    });

});