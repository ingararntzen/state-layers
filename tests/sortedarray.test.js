/* global describe, test, expect */
import { SortedArray } from "../src/sortedarray.js";

// Add your test cases here
describe('SkewLayerTest', () => {

    test('test GEINDEXOF', () => {

        const b = new SortedArray();
        const a = [0.1, 1, 1.1, 6.9, 7.1];
        b.update([], a);

        expect(b.geIndexOf(6.8)).toBe(3)

        expect(b.geIndexOf(6.9)).toBe(3);
        expect(b.geIndexOf(7.0)).toBe(4)
        expect(b.geIndexOf(10.0)).toBe(-1);
        expect(b.geIndexOf(-10.0)).toBe(0);

        expect(b.geIndexOf([6.9, -1])).toBe(3);
        expect(b.geIndexOf([6.9, 0])).toBe(3);
        expect(b.geIndexOf([6.9, 1])).toBe(4);
    });

    test('test GTINDEXOF', () => {

        const b = new SortedArray();
        const a = [0.1, 1, 1.1, 6.9, 7.1];
        b.update([], a);

        expect(b.gtIndexOf(6.8)).toBe(3)

        expect(b.gtIndexOf(6.9)).toBe(4);
        expect(b.gtIndexOf(7.0)).toBe(4)
        expect(b.gtIndexOf(10.0)).toBe(-1);
        expect(b.gtIndexOf(-10.0)).toBe(0);

        expect(b.gtIndexOf([6.9, -1])).toBe(3);
        expect(b.gtIndexOf([6.9, 0])).toBe(4);
        expect(b.gtIndexOf([6.9, 1])).toBe(4);
    });

    test('test LEINDEXOF', () => {

        const b = new SortedArray();
        const a = [0.1, 1, 1.1, 6.9, 7.1];
        b.update([], a);

        expect(b.leIndexOf(6.8)).toBe(2)
        expect(b.leIndexOf(6.9)).toBe(3);
        expect(b.leIndexOf(7.0)).toBe(3)
        expect(b.leIndexOf(10.0)).toBe(4);
        expect(b.leIndexOf(-10.0)).toBe(-1);

        expect(b.leIndexOf([6.9, -1])).toBe(2);
        expect(b.leIndexOf([6.9, 0])).toBe(3);
        expect(b.leIndexOf([6.9, 1])).toBe(3);
    });

    test('test LTINDEXOF', () => {

        const b = new SortedArray();
        const a = [0.1, 1, 1.1, 6.9, 7.1];
        b.update([], a);

        expect(b.ltIndexOf(6.8)).toBe(2)
        expect(b.ltIndexOf(6.9)).toBe(2);
        expect(b.ltIndexOf(7.0)).toBe(3)
        expect(b.ltIndexOf(10.0)).toBe(4);
        expect(b.ltIndexOf(-10.0)).toBe(-1);

        expect(b.ltIndexOf([6.9, -1])).toBe(2);
        expect(b.ltIndexOf([6.9, 0])).toBe(2);
        expect(b.ltIndexOf([6.9, 1])).toBe(3);
    });

    test('test LOOKUP', () => {

        let b = new SortedArray();
        let batch = [1, 1, 1, 1, 1, 2, 3, 4, 4, 4, 5, 6, 6, 7, 7, 7, 7, 7];
        b.update([], batch);
        expect(b.size).toBe(7);
    
        let values;
    
        values = b.lookup([4, 7, true, true]);
        expect(values[0]).toBe(4)
        expect(values.slice(-1)[0]).toBe(7);
    
        values = b.lookup([4, 7, true, false]);
        expect(values[0]).toBe(4)
        expect(values.slice(-1)[0]).toBe(6);
    
        values = b.lookup([4, 7, false, true]);
        expect(values[0]).toBe(5)
        expect(values.slice(-1)[0]).toBe(7);
    
        values = b.lookup([4, 7, false, false]);
        expect(values[0]).toBe(5)
        expect(values.slice(-1)[0]).toBe(6);
    
        values = b.lookup([10, 20, true, false]);
        expect(values.length).toBe(0)
        
        values = b.lookup([-20, -10, true, false]);
        expect(values.length).toBe(0)
    
        values = b.lookup([4, 4, true, true]);
        expect(values.length).toBe(1)
        expect(values[0]).toBe(4)
    
        values = b.lookup([4.5, 4.5, true, true]);
        expect(values.length).toBe(0)
    
    });

    test('test ENDPOINTS', () => {
        let b = new SortedArray();
        let batch = [1, [2,-1], 4];
        b.update([], batch);

        let values;

        values = b.lookup([2, 3, true, false]);
        expect(values.length).toBe(0)

        values = b.lookup([1, 2, false, false]);
        expect(values.length).toBe(1)
        expect(values[0][0]).toBe(2)
        expect(values[0][1]).toBe(-1)
    });


    test('test REMOVE', () => {
        let b = new SortedArray();
        let batch = [1, 1, 1, 1, 1, 2, 3, 4, 4, 4, 5, 6, 6, 7, 7, 7, 7, 7];
        b.update([], batch);

        let [found, idx] = b.indexOf(4);
        expect(found);

        // remove
        b.update([4], []);

        [found, idx] = b.indexOf(4);
        expect(!found);

        // remove all
        b.update(b._array, []);
        expect(b.size == 0);

    });



});