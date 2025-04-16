import { Cursor } from "./cursor_base.js";
import { Layer } from "./layer_base.js";
import * as srcprop from "./util/api_srcprop.js";

/*****************************************************
 * PLAYBACK
 *****************************************************/

/**
 * generic playback operation
 * 
 * "src" is a layer
 * "ctrl" is cursor (Number)
 * returns a cursor
 */

export function playback(ctrl, src, options={}) {

    const {isReadOnly=false} = options;

    const cursor = new Cursor();

    // property overrides
    Object.defineProperty(cursor, "isNumberOnly", {get: () => {
        return (cursor.src != undefined) ? cursor.src.isNumberOnly : false;
    }});
    Object.defineProperty(cursor, "isReadOnly", {get: () => {
        return (cursor.src != undefined) ? (cursor.src.isReadOnly || isReadOnly) : true;
    }});

    // cache for src-layer
    let src_cache;

    // setup src property
    srcprop.addState(cursor);
    srcprop.addMethods(cursor);
    cursor.srcprop_register("ctrl");
    cursor.srcprop_register("src");

    cursor.srcprop_check = function (propName, obj) {
        if (propName == "ctrl") {
            if (!(obj instanceof Cursor) || obj.isNumberOnly == false) {
                throw new Error(`"ctrl" property must be a Number cursor ${obj}`);
            }
            return obj;
        }
        if (propName == "src") {
            if (!(obj instanceof Layer)) {
                throw new Error(`"src" property must be a layer ${obj}`);
            }
            return obj;
        }
    }
    cursor.srcprop_onchange = function (propName, eArg) {
        if (cursor.src == undefined || cursor.ctrl == undefined) {
            return;
        }
        if (propName == "src") {
            if (eArg == "reset") {
                src_cache = cursor.src.createCache();
            } else {
                src_cache.clear();                
            }
        }
        cursor.onchange();
    }

    cursor.query = function query(local_ts) {
        const offset = cursor.ctrl.query(local_ts).value;
        return src_cache.query(offset);
    }
        
    // initialize
    cursor.ctrl = ctrl;
    cursor.src = src;
    return cursor;
}

