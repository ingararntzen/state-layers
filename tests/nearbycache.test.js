/* global describe, test, expect */

import { StateProviderSimple } from '../src/stateprovider_simple.js';
import { NearbyIndexSimple } from '../src/nearbyindex_simple.js';
import { NearbyCache} from '../src/nearbycache.js';

/**
 * 
 * set up a stateprovider simple, set its value to 1,
 * connect it with a simple nearby index,
 * put a nearby cache in front of it, and test that the query returns 1
 */
test('query returns 1 from nearby cache', () => {
    // Set up a state provider and set its value to 1
    const items = [
        {
            itv: [-Infinity, Infinity, true, true],
            args : {value:1}
        }
    ];
    const src = new StateProviderSimple({items});
    // Connect it with a simple nearby index
    const index = new NearbyIndexSimple(src);
    // Put a nearby cache in front of it
    const cache = new NearbyCache({index});
    // Test that the query returns 1
    const result = cache.query(44);
    expect(result.value).toBe(1)
});