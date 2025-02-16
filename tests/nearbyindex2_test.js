/* global describe, test, expect */
import { LocalStateProvider } from "../src/stateprovider.js";
import { NearbyIndex } from "../src/nearbyindex_2.js";

function setup(changes) {
    const sp = new LocalStateProvider();
    const index = new NearbyIndex(sp);

    sp.add_callback((_changes) => {
        index.refresh(_changes);
    });
    sp._update(changes);
    sp.notify_callbacks(changes);
    return index;
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

        let index = setup({items, clear:true});

        let values = new Set(index._covers([3.5,0]).map(item => item.value));
        expect(values.has(3));
        expect(values.has(4));
        expect(values.has(5));
        expect(values.size == 3)

        values = new Set(index._covers([0,0]).map(item => item.value));
        expect(values.size == 0)
    });

    test.only('should handle -Infinity and Infinity correctly', () => {

        const intervals = [
            [-Infinity, 0, true, false],
            [0, 1, true, true],
            // gap
            [2, Infinity, false, true],
        ]

        const items = intervals.map(itv => {
            return {itv};
        });

        const index = setup({items, clear:true});

        // Test -Infinity
        let nearby = index.nearby(-Infinity);

        expect(nearby.center[0]).toBe(items[0]);
        expect(nearby.itv).toStrictEqual(intervals[0]);

        // Test Infinity
        nearby = index.nearby(Infinity);
        expect(nearby.center[0]).toBe(items[2]);
        expect(nearby.itv).toStrictEqual(intervals[2]);
    });


});