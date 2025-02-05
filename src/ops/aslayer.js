import { NearbyIndexBase } from "../nearbyindex.js";
import { Layer } from "../layers.js"
import { Cursor } from "../cursors.js"

export function asLayer (cursor) {

    // make a new index
    // subscsribe to callback on underlying cursor
    // or I could bake this functionality into the
    // cursor itself - letting it maintain its own 
    // index instead of exposing src.index as its own
    // which is incorrect basically

} 