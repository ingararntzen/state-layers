/*
    This decorates an object/prototype with basic (synchronous) callback support.
*/

const PREFIX = "__callback";

export function addState(object) {
    object[`${PREFIX}_handlers`] = [];
}

function add_callback (handler) {
    let handle = {
        handler: handler
    }
    this[`${PREFIX}_handlers`].push(handle);
    return handle;
};

function remove_callback (handle) {
    let index = this[`${PREFIX}_handlers`].indexOf(handle);
    if (index > -1) {
        this[`${PREFIX}_handlers`].splice(index, 1);
    }
};

function notify_callbacks (eArg) {
    this[`${PREFIX}_handlers`].forEach(function(handle) {
        handle.handler(eArg);
    });
};


export function addMethods (obj) {
    const api = {
        add_callback, remove_callback, notify_callbacks
    }
    Object.assign(obj, api);
}

/**
 * test if object implements callback api
 */
export function is_callback_api (obj) {
    if (obj == undefined) return false;
    const methods = ["add_callback", "remove_callback"];
    for (const prop of methods) {
        if (!(prop in obj)) return false;
        if (typeof obj[prop] != 'function') return false;
    }
    return true;
}
