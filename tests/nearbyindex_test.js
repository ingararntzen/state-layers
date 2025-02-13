/* global describe, test, expect */
import { NewLocalStateProvider } from "../src/stateprovider.js";
import { NearbyIndex } from "../src/nearbyindex.js";


function setup(changes) {
    const sp = new NewLocalStateProvider();
    const index = new NearbyIndex(sp);

    sp.add_callback((_changes) => {
        index.refresh(_changes);
    });
    sp._update(changes);
}

// Add your test cases here
describe('Test NearbyIndex', () => {

    test('test covers', () => {
    
        let data = [
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

        let index = setup(data);

        let values = new Set(index.covers(3.5).map(item => item.value));
        expect(values.has(3));
        expect(values.has(4));
        expect(values.has(5));
        expect(values.size == 3)

        values = new Set(index.covers(0).map(item => item.value));
        expect(values.size == 0)
    });
});