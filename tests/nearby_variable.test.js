/* global describe, test, expect */
import { endpoint } from "../src/intervals.js";
import { NearbyIndexVariable } from "../src/layer_variable.js";

function create_variable(_value) {
    return {
        get value () {
            return _value;
        }
    }
}

// Add your test cases here
describe('Test NearbyIndex for Variable', () => {

    test('test motion with ranges', () => {
    
        const item = {
            id: "jalla",
            itv: [1, 5, true, true],
            type: "motion",
            data: {position:0, velocity:1, timestamp:0}
        }
        const v = create_variable(item);

        const index = new NearbyIndexVariable(v);
        let nearby;

        // test inside

        nearby = index.nearby(2.5);
        expect(nearby.itv).toStrictEqual(item.itv);
        expect(nearby.center[0]).toStrictEqual(item);

        // test outside left
        nearby = index.nearby(-1);
        expect(nearby.itv).toStrictEqual([null, 1, true, false]);
        expect(nearby.center[0].type == "static");
        expect(nearby.center[0].data == 0);
        
        // test outside right
        nearby = index.nearby(7);
        expect(nearby.itv).toStrictEqual([5, null, false, true]);
        expect(nearby.center[0].type == "static");
        expect(nearby.center[0].data == 4);
    });

    test('test motion with ranges - non-inclusive', () => {
        const item = {
            id: "jalla",
            itv: [1, 5, false, false],
            type: "motion",
            data: {position:0, velocity:1, timestamp:0}
        }
        const v = create_variable(item);

        const index = new NearbyIndexVariable(v);
        let nearby;

        // test inside

        nearby = index.nearby(2.5);
        expect(nearby.itv).toStrictEqual(item.itv);
        expect(nearby.center[0]).toStrictEqual(item);

        // test outside left
        nearby = index.nearby(-1);
        expect(nearby.itv).toStrictEqual([null, 1, true, true]);
        expect(nearby.center[0].type == "static");
        expect(nearby.center[0].data == 0);
        
        // test outside right
        nearby = index.nearby(7);
        expect(nearby.itv).toStrictEqual([5, null, true, true]);
        expect(nearby.center[0].type == "static");
        expect(nearby.center[0].data == 4);
    });
});