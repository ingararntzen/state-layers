import { Cursor } from "../cursor_base.js";

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

    const cursor = new Cursor();

    // implement query
    cursor.query = function query() {
        const {position, velocity, acceleration, timestamp} = src.query();
        const dynamic = (velocity != 0 || acceleration != 0);
        return {value:position, dynamic, offset:timestamp};
    }

    // numeric
    Object.defineProperty(cursor, "numeric", {get: () => true});
    // fixedRate
    Object.defineProperty(cursor, "fixedRate", {get: () => false});

    // callbacks from timing object
    src.on("change", () => {cursor.onchange()});
    return cursor;
}
