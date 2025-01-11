/* global describe, test, expect */

import { SimpleStateProvider } from '../src/stateprovider_simple.js';
import { SimpleNearbyIndex } from '../src/nearbyindex_simple.js';
import { NearbyCache} from '../src/nearbycache.js';

/**
 * 
 * set up a stateprovider simple, set its value to 1,
 * connect it with a simple nearby index,
 * put a nearby cache in front of it, and test that the query returns 1
 */
test('query returns 1 from nearby cache', () => {
    // Set up a state provider and set its value to 1
    const src = new SimpleStateProvider();
    src.value = 1;

    // Connect it with a simple nearby index
    const index = new SimpleNearbyIndex();
    index.update(src.items);

    // Put a nearby cache in front of it
    const cache = new NearbyCache(index);

    // Test that the query returns 1
    const result = cache.query(44);
    expect(result.value).toBe(1)
});