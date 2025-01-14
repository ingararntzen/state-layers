/* global describe, test, expect */

import {
    StaticSegment, MotionSegment,
    TransitionSegment, InterpolationSegment
} from '../src/segments.js';

describe('StaticSegment class', () => {
    test('should return correct value for offset within interval', () => {

        const intervals = [
            [1, 5, true, true], 
            [1, 5, false, true], 
            [1, 5, true, false], 
            [1, 5, false, false]
        ];
        const offsets = [0, 1, 2, 3, 4, 5, 6];
        const args = {value:8};

        const results = intervals.map(interval => {
            const segment = new StaticSegment(interval, args);
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
        const interval = [1, 5, true, true];
        const args = {value: 'static value'};
        const segment = new StaticSegment(interval, args);
        const result = segment.query(6);
        expect(result.value).toBeUndefined();
        expect(result.dynamic).toBe(false);
    });
});


describe('MotionSegment class', () => {
    test('should return correct value for offset within interval', () => {
        const interval = [1, 5, true, true];
        const args = {position:0, velocity: 1, timestamp: 0};
        const segment = new MotionSegment(interval, args);
        const offsets = [0, 1, 2, 3, 4, 5, 6];
        const results = offsets.map(offset => segment.query(offset).value);
        const expected = [undefined, 1, 2, 3, 4, 5, undefined];
        expect(results).toEqual(expected);
    });
});


describe('TransitionSegment class', () => {
    test('should return correct value for offset within interval', () => {
        const interval = [1, 5, true, true];
        const args = {
            v0: 9, v1: 5, easing: "linear"
        }
        const segment = new TransitionSegment(interval, args);
        const offsets = [0, 1, 2, 3, 4, 5, 6];
        const results = offsets.map(offset => segment.query(offset).value);
        const expected = [undefined, 9, 8, 7, 6, 5, undefined];
        expect(results).toEqual(expected);
    });
});

describe('InterpolationSegment class', () => {
    test('should return correct value for offset within interval', () => {
        const interval = [1, 5, true, true];
        const args = {
            tuples: [[1, 0.5], [2, 1.5], [3, 2.5], [4, 3.5], [5, 4.5]]
        };
        const segment = new InterpolationSegment(interval, args);
        const offsets = [0, 1, 2, 3, 4, 5, 6];
        const results = offsets.map(offset => segment.query(offset).value);
        const expected = [undefined, 1.5, 2.5, 3.5, 4.5, 5.5, undefined];
        expect(results).toEqual(expected);
    });
});
