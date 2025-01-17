
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


/************************************************
 * SOURCE
 ************************************************/

/**
 * Extend a class with support for external source on 
 * a named property.
 * 
 * option: mutable:true means that propery may be reset 
 * 
 * source object is assumed to support the callback interface
 */


export const source = function () {

    function propnames (propName) {
        return {
            prop: `__${propName}`,
            init: `__${propName}_init`,
            handle: `__${propName}_handle`,
            change: `__${propName}_handle_change`,
            detatch: `__${propName}_detatch`,
            attatch: `__${propName}_attatch`,
            check: `__${propName}_check`
        }
    }

    function addToInstance (object, propName) {
        const p = propnames(propName)
        object[p.prop] = undefined
        object[p.init] = false;
        object[p.handle] = undefined;
    }

    function addToPrototype (_prototype, propName, options={}) {

        const p = propnames(propName)

        function detatch() {
            // unsubscribe from source change event
            let {mutable=false} = options;
            if (mutable && this[p.prop]) {
                let handle = this[p.handle];
                this[p.prop].remove_callback(handle);
                this[p.handle] = undefined;
            }
            this[p.prop] = undefined;
        }
    
        function attatch(source) {
            let {mutable=false} = options;
            if (!this[p.init] || mutable) {
                this[p.prop] = source;
                this[p.init] = true;
                // subscribe to callback from source
                if (this[p.change]) {
                    const handler = this[p.change].bind(this);
                    this[p.handle] = source.add_callback(handler);
                    handler("reset"); 
                }
            } else {
                throw new Error(`${propName} can not be reassigned`);
            }
        }

        /**
         * 
         * object must implement
         * __{propName}_handle_change() {}
         * 
         * object can implement
         * __{propName}_check(source) {}
         */

        // getter and setter
        Object.defineProperty(_prototype, propName, {
            get: function () {
                return this[p.prop];
            },
            set: function (src) {
                if (this[p.check]) {
                    this[p.check](src)
                }
                if (src != this[p.prop]) {
                    this[p.detatch]();
                    this[p.attatch](src);
                }
            }

        });

        const api = {};
        api[p.detatch] = detatch;
        api[p.attatch] = attatch;

        Object.assign(_prototype, api);
    }
    return {addToInstance, addToPrototype};
}();

