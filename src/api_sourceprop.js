
/************************************************
 * SOURCE PROPERTY
 ************************************************/

/**
 * Functions for extending a class with support for 
 * external source on a named property.
 * 
 * option: mutable:true means that propery may be reset 
 * 
 * source object is assumed to support the callback interface
 */

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

export function addToInstance (object, propName) {
    const p = propnames(propName)
    object[p.prop] = undefined
    object[p.init] = false;
    object[p.handle] = undefined;
}

export function addToPrototype (_prototype, propName, options={}) {

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
                src = this[p.check](src)
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

