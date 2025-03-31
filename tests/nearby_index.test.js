/* global describe, test, expect */
import { CollectionProvider } from "../src/provider_collection.js";
import { NearbyIndex } from "../src/nearby_index.js";
import { endpoint } from "../src/util/intervals.js";

const EP_POS_INF = endpoint.POS_INF;
const EP_NEG_INF = endpoint.NEG_INF;

function setup(options) {
    const sp = new CollectionProvider(options);
    const index = new NearbyIndex(sp);
    sp.add_callback((diffs) => {
        index.refresh(diffs);
    });
    return [sp, index];
}

// Add your test cases here
describe('Test NearbyIndex', () => {

    test('test nearbyindex covers', () => {
    
        const items = [
            // outside 3.5 left
            {type: "static", itv: [1, 3, true, false], value: 1.0},

            // touch 3.5 left
            {type: "static", itv: [1.5, 3.5, true, false], value: 2.0},
            {type: "static", itv: [1.5, 3.5, false, true], value: 3.0},

            // cover 3.5
            {type: "static", itv: [2, 4, true, false], value: 4.0},
            
            // touch 3.5 right                
            {type: "static", itv: [3.5, 5.5, true, false], value: 5.0},
            {type: "static", itv: [3.5, 5.5, false, true], value: 6.0},

            // outside 3.5 right
            {type: "static", itv: [4, 6, true, false], value: 7.0},
        ];
        let [sp, index] = setup({insert:items});

        let values = new Set(index._covers(3.5).map(item => item.value));
        expect(values.has(3));
        expect(values.has(4));
        expect(values.has(5));
        expect(values.size == 3)

        values = new Set(index._covers(0).map(item => item.value));
        expect(values.size == 0)
    });

    test('should handle -Infinity and Infinity correctly', () => {

        const intervals = [
            [null, 0, true, false],
            [0, 1, true, true],
            // gap
            [2, null, false, true],
        ]

        const items = intervals.map(itv => {
            return {itv};
        });

        const [sp, index] = setup({insert:items});

        // Test -Infinity
        let nearby = index.nearby(-Infinity);

        expect(nearby.center[0]).toBe(items[0]);
        expect(nearby.itv).toStrictEqual(intervals[0]);

        // Test Infinity
        nearby = index.nearby(Infinity);
        expect(nearby.center[0]).toBe(items[2]);
        expect(nearby.itv).toStrictEqual(intervals[2]);
    });

    test('test nearbyindex nearby', () => {
    
        const intervals = [
            [null, 0, true, false],
            [0, 1, true, true],
            // gap
            [2, null, false, true],
        ]

        const items = intervals.map(itv => {
            return {itv};
        })

        const [sp, index] = setup({insert:items});

        // FIRST ITEM

        // hit within first item
        let nearby = index.nearby(-1);
        expect(nearby.center[0]).toBe(items[0]);
        // last endpoint that hits first item
        nearby = index.nearby([0, ")"]);
        expect(nearby.center[0]).toBe(items[0]);
        // interval
        expect(nearby.itv).toStrictEqual(intervals[0]);
        // left/right
        expect(nearby.left).toStrictEqual(EP_NEG_INF);
        expect(nearby.right).toStrictEqual([0, "["]);

        // SECOND ITEM

        // first endpoint that hits second item
        nearby = index.nearby(0);
        expect(nearby.center[0]).toBe(items[1]);
        // last endpoint that hits second item
        nearby = index.nearby(1);
        expect(nearby.center[0]).toBe(items[1]);
        // interval
        expect(nearby.itv).toStrictEqual(intervals[1]);
        // left/right
        expect(nearby.left).toStrictEqual([0, ")"]);
        expect(nearby.right).toStrictEqual([1, "("]);

        // THIRD ITEM

        // first endpoint that hits third item
        nearby = index.nearby([2, "("]);
        expect(nearby.center[0]).toBe(items[2]);
        // endpoint that hits within third item
        nearby = index.nearby(3);
        expect(nearby.center[0]).toBe(items[2]);
        // interval
        expect(nearby.itv).toStrictEqual(intervals[2]);
        // left/right
        expect(nearby.left).toStrictEqual([2, "]"]);
        expect(nearby.right).toStrictEqual(EP_POS_INF);

        // GAP
        // endpoint within gap
        nearby = index.nearby(1.5);
        expect(nearby.center).toStrictEqual([]);
        expect(nearby.itv).toStrictEqual([1, 2, false, true]);
        // left/right
        expect(nearby.left).toStrictEqual([1, "]"]);
        expect(nearby.right).toStrictEqual([2, "("]);
    });

    test('should update the index with one item and check nearby.center', () => {

        const [sp, index] = setup();

        // Check nearby.center before update
        let nearby = index.nearby(1.5);
        expect(nearby.center).toStrictEqual([]);

        // Update the index with a new item
        const new_item = {
            itv: [null, null, true, true], 
            data: {value:1}
        }
        sp.update({insert:[new_item], reset:true}).then(() => {
            // Check nearby.center after update
            nearby = index.nearby(1.5);
            expect(nearby.center.length == 0)
            expect(nearby.center[0]).toStrictEqual(new_item);
        });
    });

    test('index should be correct after index refresh removes removes an item', () => {

        // initialise with one item
        const item_1 = {
            id: "a",
            itv: [null, null, true, true], 
            data: {value:1}
        }
        const [sp, index] = setup({insert:[item_1]});

        // verify initialization
        let nearby = index.nearby(1.5);
        expect(nearby.center.length == 1);
        expect(nearby.center[0]).toStrictEqual(item_1);

        // update to another item
        const item_2 = {
            id: "b",
            itv: [null, null, true, true], 
            data: {value:2}
        }
        sp.update({insert:[item_2], reset:true}).then(() => {
            // Check nearby.center after update
            nearby = index.nearby(1.5);
            expect(nearby.center.length == 1);
        });
    });
});