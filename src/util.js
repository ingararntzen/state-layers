
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
    This adds basic (synchronous) callback support to an object.
*/

export const callbacks = function () {

    function add_callback (handler) {
        let handle = {
            handler: handler
        }
        this._callbacks.push(handle);
        return handle;
    };

    function remove_callback (handle) {
        let index = this._callbacks.indexof(handle);
        if (index > -1) {
            this._callbacks.splice(index, 1);
        }
    };

    function notify_callbacks (eArg) {
        this._callbacks.forEach(function(handle) {
            handle.handler(eArg);
        });
    };

    const api = {
        add_callback, remove_callback, notify_callbacks
    }

    return {
        theInstance: (_instance) => {
            _instance._callbacks = [];
        },
        thePrototype: (_prototype) => {
            Object.assign(_prototype, api)
        }
    }
}();
