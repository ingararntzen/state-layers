/* global describe, test, expect */

import {endpoint, interval} from '../src/intervals.js';


describe('EndpointTest', () => {
    test('endpoints', () => {
        const high_1 = [4, -1];
        const high_2 = [4, 0];
        const low = [4, 0];

        expect(endpoint.cmp(high_1, high_2)).toBeLessThan(0);
        expect(endpoint.lt(high_1, high_2)).toBe(true);
        expect(endpoint.le(high_1, high_2)).toBe(true);
        expect(endpoint.gt(high_1, high_2)).toBe(false);
        expect(endpoint.ge(high_1, high_2)).toBe(false);
        expect(endpoint.eq(high_1, high_2)).toBe(false);

        expect(endpoint.cmp(high_2, low)).toBe(0);
        expect(endpoint.lt(high_2, low)).toBe(false);
        expect(endpoint.le(high_2, low)).toBe(true);
        expect(endpoint.gt(high_2, low)).toBe(false);
        expect(endpoint.ge(high_2, low)).toBe(true);
        expect(endpoint.eq(high_2, low)).toBe(true);
    });

    test('min and max endpoints', () => {
        const high_1 = [4, -1];
        const high_2 = [4, 0];
        const low = [3, 0];

        expect(endpoint.min(high_1, high_2)).toEqual(high_1);
        expect(endpoint.max(high_1, high_2)).toEqual(high_2);
        expect(endpoint.min(low, high_1)).toEqual(low);
        expect(endpoint.max(low, high_1)).toEqual(high_1);
    });

    test('infinity values', () => {
        console.log("running")
        const p = [-Infinity, 0];
        const itv = [-Infinity, 0, true, false];
        expect(interval.covers_endpoint(itv, p)).toEqual(true);
    });

    // Add more test cases as needed
});