import { endpoint} from "../util/intervals.js";
import { NearbyIndexBase } from "../nearby_base.js";
import { Track } from "../track_base.js"
import { Cursor } from "../cursor_base.js";

/**
 * This wraps a cursor so that it can be used as a track.
 */

export function track_from_cursor(src) {

    if (!(src instanceof Cursor)) {
        throw new Error(`src must be a Cursor ${src}`);
    }
 
    const track = new Track();
    track.index = new CursorIndex(src);

    // restrictions
    Object.defineProperty(track, "numeric", {get: () => src.numeric});

    // subscribe
    src.add_callback((eArg) => {
        track.onchange(eArg);
    });

    // initialise
    track.src = src;
    return track;
} 


/**
 * Create a NearbyIndex for the Cursor.
 * 
 * The cursor value is independent of timeline offset, 
 * which is to say that it has the same value for all 
 * timeline offsets.
 * 
 * In order for the default TrackCache to work, an
 * object with a .query(offset) method is needed in 
 * nearby.center. Since cursors support this method
 * (ignoring the offset), we can use the cursor directly.
 */

class CursorIndex extends NearbyIndexBase {

    constructor(cursor) {
        super();
        this._cursor = cursor;
    }

    nearby(offset) {
        // cursor index is defined for entire timeline
        return {
            itv: [null, null, true, true],
            center: [this._cursor],
            left: endpoint.NEG_INF,
            prev: endpoint.NEG_INF,
            right: endpoint.POS_INF,
            next: endpoint.POS_INF,
        }
    }
}

