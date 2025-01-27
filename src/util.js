
/***************************************************************
    CLOCKS
***************************************************************/

/**
 * clocks counting in seconds
 */

const local = function () {
    return performance.now()/1000.0;
}

const epoch = function () {
    return new Date()/1000.0;
}

/**
 * the clock gives epoch values, but is implemented
 * using a high performance local clock for better
 * time resolution and protection against system 
 * time adjustments.
 */

export const CLOCK = function () {
    const t0_local = local();
    const t0_epoch = epoch();
    return {
        now: function () {
            return t0_epoch + (local() - t0_local)
        }
    }
}();


// ovverride modulo to behave better for negative numbers
export function mod(n, m) {
    return ((n % m) + m) % m;
};

export function divmod(x, base) {
    let n = Math.floor(x / base)
    let r = mod(x, base);
    return [n, r];
}


/*
    similar to range function in python
*/

export function range (start, end, step = 1, options={}) {
    const result = [];
    const {include_end=false} = options;
    if (step === 0) {
        throw new Error('Step cannot be zero.');
    }
    if (start < end) {
        for (let i = start; i < end; i += step) {
          result.push(i);
        }
    } else if (start > end) {
        for (let i = start; i > end; i -= step) {
          result.push(i);
        }
    }
    if (include_end) {
        result.push(end);
    }
    return result;
}



/*
    This adds basic (synchronous) callback support to an object.
*/

export const callback = function () {

    function addToInstance(object) {
        object.__callback_callbacks = [];
    }

    function add_callback (handler) {
        let handle = {
            handler: handler
        }
        this.__callback_callbacks.push(handle);
        return handle;
    };

    function remove_callback (handle) {
        let index = this.__callback_callbacks.indexof(handle);
        if (index > -1) {
            this.__callback_callbacks.splice(index, 1);
        }
    };

    function notify_callbacks (eArg) {
        this.__callback_callbacks.forEach(function(handle) {
            handle.handler(eArg);
        });
    };


    function addToPrototype (_prototype) {
        const api = {
            add_callback, remove_callback, notify_callbacks
        }
        Object.assign(_prototype, api);
    }

    return {addToInstance, addToPrototype}
}();

