import { Cursor } from "../cursor_base.js";
import { leaf_layer } from "../layer_leaf.js";
import { ObjectProvider } from "../provider_object.js";

/**
 * Timing Object Cursor
 * Create a new Cursor which has a Timing Object as src property.
 * 
 * The new Cursor does not have a src (layer) or a ctrl (cursor)
 * property, since it only depends on the src TimingObject.
 * 
 * Also, the new cursor does not need any playback logic on its own
 * since it is only a wrapper and the timing object provides playback support.
 */
export function cursor_from_timingobject(src) {

    if (src.constructor.name != "TimingObject") {
        throw new Error(`src must be a TimingObject ${src}`);
    }

    // split timing object into clock and vector

    // make a clock cursor
    const clock = new Cursor();
    clock.query = function query() {
        const {timestamp} = src.query();
        return {value: timestamp, dynamic: true, offset: timestamp}; 
    }
    // numeric
    Object.defineProperty(clock, "numeric", {get: () => {return true}});
    // fixedRate
    Object.defineProperty(clock, "fixedRate", {get: () => {return true}});

    // layer for the vector
    const sp = new ObjectProvider({
        items: [{
            itv: [null, null, true, true],
            data: src.vector
        }]
    });
    const layer = leaf_layer({provider: sp});


    // make a timing object cursor
    const cursor = new Cursor();

    // implement query
    cursor.query = function query() {
        const {position, velocity, acceleration, timestamp} = src.query();
        const dynamic = (velocity != 0 || acceleration != 0);
        return {value:position, dynamic, offset:timestamp};
    }

    // numeric
    Object.defineProperty(cursor, "numeric", {get: () => {return true}});
    // fixedRate
    Object.defineProperty(cursor, "fixedRate", {get: () => {return false}});
    // ctrl
    Object.defineProperty(cursor, "ctrl", {get: () => {return clock}});
    // src
    Object.defineProperty(cursor, "src", {get: () => {return layer}});


    // callbacks from timing object
    src.on("change", () => {
        // update state provider
        layer.provider.set([{
            itv: [null, null, true, true],
            data: src.vector
        }])
        cursor.onchange()
    });
    return cursor;
}
