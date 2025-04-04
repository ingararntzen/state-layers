import { Cursor } from "./cursor_base.js";
import { is_clock_provider, LOCAL_CLOCK_PROVIDER } from "./provider_clock.js";
/**
 * Clock cursor is a thin wrapper around a clockProvider,
 * so that it can be consumed as a cursor.
 * 
 * The ctrl property of any Cursor is required to be a Cursor or undefined,
 * so in the case of a clock cursor, which is the starting point,
 * the ctrl property is always set to undefined.
 * 
 * Additionally, clock cursor.src is also undefined.
 * 
 * Cursor transformation of a clock cursor will result in a new clock cursor.
 *  
 * Idenfifying a cursor as a clock cursor or not is important for playback
 * logic in cursor implemmentation.
 */

export function is_clock_cursor(obj) {
    return obj instanceof Cursor && obj.ctrl == undefined && obj.src == undefined; 
}

export function clock_cursor(src=LOCAL_CLOCK_PROVIDER) {
    if (!is_clock_provider(src)) {
        throw new Error(`src must be clockProvider ${src}`);
    }
    const cursor = new Cursor();
    cursor.query = function (local_ts) {
        const clock_ts = src.now(local_ts);
        return {value:clock_ts, dynamic:true, offset:local_ts};
    }
    return cursor;
}
