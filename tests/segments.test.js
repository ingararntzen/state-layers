/* global describe, test, expect */

import {
    StaticSegment, MotionSegment,
    TransitionSegment, InterpolationSegment
} from '../src/util/segments.js';

describe('StaticSegment class', () => {
    test('should return correct value for offset within interval', () => {

        const intervals = [
            [1, 5, true, true], 
            [1, 5, false, true], 
            [1, 5, true, false], 
            [1, 5, false, false]
        ];
        const offsets = [0, 1, 2, 3, 4, 5, 6];
        const data = 8;

        const results = intervals.map(itv => {
            const segment = new StaticSegment(itv, data);
            return offsets.map(offset => segment.query(offset).value);
        });

        const expected = [
            [undefined, 8, 8, 8, 8, 8, undefined],
            [undefined, undefined, 8, 8, 8, 8, undefined],
            [undefined, 8, 8, 8, 8, undefined, undefined],
            [undefined, undefined, 8, 8, 8, undefined, undefined]
        ];

        expect(results).toEqual(expected);        
    });

    test('should return undefined for offset outside interval', () => {
        const itv = [1, 5, true, true];
        const data = 'static value';
        const segment = new StaticSegment(itv, data);
        const result = segment.query(6);
        expect(result.value).toBeUndefined();
        expect(result.dynamic).toBe(false);
    });
});


describe('MotionSegment class', () => {
    test('should return correct value for offset within interval', () => {
        const itv = [1, 5, true, true];
        const data = [0, 1, 0, 0];
        const segment = new MotionSegment(itv, data);
        const offsets = [0, 1, 2, 3, 4, 5, 6];
        const results = offsets.map(offset => segment.query(offset).value);
        const expected = [undefined, 1, 2, 3, 4, 5, undefined];
        expect(results).toEqual(expected);
    });
});


describe('TransitionSegment class', () => {
    test('should return correct value for offset within interval', () => {
        const itv = [1, 5, true, true];
        const data = {
            v0: 9, v1: 5, easing: "linear"
        }
        const segment = new TransitionSegment(itv, data);
        const offsets = [0, 1, 2, 3, 4, 5, 6];
        const results = offsets.map(offset => segment.query(offset).value);
        const expected = [undefined, 9, 8, 7, 6, 5, undefined];
        expect(results).toEqual(expected);
    });
});

describe('InterpolationSegment class', () => {
    test('should return correct value for offset within interval', () => {
        const itv = [1, 5, true, true];
        const data = [
            [1, 0.5], 
            [2, 1.5], 
            [3, 2.5], 
            [4, 3.5], 
            [5, 4.5]
        ];
        const segment = new InterpolationSegment(itv, data);
        const offsets = [0, 1, 2, 3, 4, 5, 6];
        const results = offsets.map(offset => segment.query(offset).value);
        const expected = [undefined, 1.5, 2.5, 3.5, 4.5, 5.5, undefined];
        expect(results).toEqual(expected);
    });
});
