
/* global describe, test, expect */
import { motion_utils } from "../src/util";

const {
    get_real_solutions,
    time_ranges_from_pos_range:trfpr
} = motion_utils;

// Add your test cases here
describe('MotionUtils', () => {

    test('real solutions', () => {

        // no motion
        let v = [0,0,0,0];
        expect(get_real_solutions(v, 4)).toEqual([]);
        expect(get_real_solutions(v, 0)).toEqual(undefined);

        // constant velocity
        // up
        v = [0,1,0,0];
        expect(get_real_solutions(v, 4)).toEqual([4]);
        expect(get_real_solutions(v, 0)).toEqual([0]);
        // down
        v = [0,-1,0,0];
        expect(get_real_solutions(v, 4)).toEqual([-4]);
        expect(get_real_solutions(v, 0)).toEqual([0]);

        // constant acceleration
        // top-down
        v = [0,0,1,0];
        console.log(get_real_solutions(v, 2))
        expect(get_real_solutions(v, 2)).toEqual([-2, 2]);
        expect(get_real_solutions(v, 0)).toEqual([0]);
        expect(get_real_solutions(v, -2)).toEqual([]);
        
        // top-up
        v = [0,0,-1,0];
        expect(get_real_solutions(v, -2)).toEqual([-2, 2]);
        expect(get_real_solutions(v, 0)).toEqual([0]);
        expect(get_real_solutions(v, 2)).toEqual([]);
       
    });

    test('time range from pos range', () => {
        // no motion
        let v = [0,0,0,0];
        expect(trfpr(v, [null,null])).toEqual([[null,null]]);
        expect(trfpr(v, [null,-10])).toEqual([]);
        expect(trfpr(v, [null,10])).toEqual([[null,null]]);
        expect(trfpr(v, [10,null])).toEqual([]);
        expect(trfpr(v, [0,null])).toEqual([[null,null]]);
        expect(trfpr(v, [0,10])).toEqual([[null,null]]);

        // constant velocity
        // up
        v = [0,1,0,0];
        expect(trfpr(v, [null, null])).toEqual([[null,null]]);
        expect(trfpr(v, [null, 0])).toEqual([[null, 0]]);
        expect(trfpr(v, [0, 10])).toEqual([[0,10]]);
        expect(trfpr(v, [10, null])).toEqual([[10,null]]);
        // down
        v = [0,-1,0,0];
        expect(trfpr(v, [null, null])).toEqual([[null,null]]);
        expect(trfpr(v, [null, 0])).toEqual([[0, null]]);
        expect(trfpr(v, [0, 10])).toEqual([[-10,0]]);
        expect(trfpr(v, [10, null])).toEqual([[null, -10]]);

        // constant acceleration
        // top-down
        v = [0,0,1,0];
        expect(trfpr(v, [null, null])).toEqual([[null,null]]);
        expect(trfpr(v, [null, 0])).toEqual([]);
        expect(trfpr(v, [0, null])).toEqual([[null,null]]);
        // 3 solutions
        expect(trfpr(v, [0, 2])).toEqual([[-2,2]]);
        // shift 1 down - to get 4 solutions
        v = [-1,0,1,0];
        expect(trfpr(v, [0, 2])).toEqual([
            [-Math.sqrt(6), -Math.sqrt(2)],
            [Math.sqrt(2), Math.sqrt(6)]
        ]);
        // shift 1 up - to get 2 solutions
        v = [1,0,1,0];
        expect(trfpr(v, [0, 2])).toEqual([[-Math.sqrt(2), Math.sqrt(2)]]);
        // shift 2 up - to get 1 solution
        v = [2,0,1,0];
        expect(trfpr(v, [0, 2])).toEqual([]);


    });



});