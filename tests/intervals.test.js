/* global describe, test, expect */

import {endpoint, interval} from '../src/intervals.js';


describe('EndpointTest', () => {
    test('endpoints', () => {

        // 4 intervals which all have endpoints at 4
        const itv_1 = [0, 4, true, false];
        const itv_2 = [0, 4, true, true];
        const itv_3 = [4, 8, true, false];
        const itv_4 = [4, 8, false, true];

        const high_1 = endpoint.from_interval(itv_1)[1];
        const high_2 = endpoint.from_interval(itv_2)[1];
        const low_3 = endpoint.from_interval(itv_3)[0];
        const low_4 = endpoint.from_interval(itv_4)[0];
        

        expect(endpoint.cmp(high_1, high_2) < 0 );
        expect(endpoint.lt(high_1, high_2) == true);
        expect(endpoint.le(high_1, high_2) == true);
        expect(endpoint.gt(high_1, high_2) == false);
        expect(endpoint.ge(high_1, high_2) == false);
        expect(endpoint.eq(high_1, high_2) == false);

        expect(endpoint.cmp(low_3, low_4) < 0 );
        expect(endpoint.lt(low_3, low_4) == true);
        expect(endpoint.le(low_3, low_4) == true);
        expect(endpoint.gt(low_3, low_4) == false);
        expect(endpoint.ge(low_3, low_4) == false);
        expect(endpoint.eq(low_3, low_4) == false);

        expect(endpoint.cmp(high_2, low_3) == 0);
        expect(endpoint.lt(high_2, low_3) == false);
        expect(endpoint.le(high_2, low_3) == true);
        expect(endpoint.gt(high_2, low_3) == false);
        expect(endpoint.ge(high_2, low_3) == true);
        expect(endpoint.eq(high_2, low_3) == true);
    });

    test('min and max endpoints', () => {
   
        // 4 intervals which all have endpoints at 4
        const itv_1 = [0, 4, true, false];
        const itv_2 = [0, 4, true, true];
        const itv_3 = [3, 8, true, false];

        const high_1 = endpoint.from_interval(itv_1)[1];
        const high_2 = endpoint.from_interval(itv_2)[1];
        const low_3 = endpoint.from_interval(itv_3)[0];
        
        expect(endpoint.min(high_1, high_2)).toEqual(high_1);
        expect(endpoint.max(high_1, high_2)).toEqual(high_2);
        expect(endpoint.min(low_3, high_1)).toEqual(low_3);
        expect(endpoint.max(low_3, high_1)).toEqual(high_1);
    });

    test('infinity values', () => {
        const itv_1 = [null, 0, true, false];
        const itv_2 = [0, null, false, true];
        const itv_3 = [null, null, true, true];

        const p = [-Infinity, 0];
        const itv = [-Infinity, 0, true, false];

        expect(interval.covers_endpoint(itv_1, -Infinity) == true);
        expect(interval.covers_endpoint(itv_1, 0) == false);
        expect(interval.covers_endpoint(itv_1, Infinity) == true);

        expect(interval.covers_endpoint(itv_2, -Infinity) == false);
        expect(interval.covers_endpoint(itv_2, 0) == true);
        expect(interval.covers_endpoint(itv_2, Infinity) == true);
        
        expect(interval.covers_endpoint(itv_3, -Infinity) == true);
        expect(interval.covers_endpoint(itv_3, 0) == true);
        expect(interval.covers_endpoint(itv_3, Infinity) == true);

    });

    // Add more test cases as needed
});