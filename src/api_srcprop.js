
/************************************************
 * SOURCE PROPERTY (SRCPROP)
 ************************************************/

/**
 * Functions for extending a class with support for 
 * external source on a named property.
 * 
 * option: mutable:true means that propery may be reset 
 * 
 * source object is assumed to support the callback interface
 */

const NAME = "srcprop";
const PREFIX = `__${NAME}`;

export function addToInstance (object) {
    object[`${PREFIX}`] = new Map();
}

export function addToPrototype (_prototype) {

    function register(propName, options={}) {
        let {mutable=true} = options;
        const map = this[`${PREFIX}`]; 
        map.set(propName, {
            init:false,
            handle: undefined,
            src: undefined,
            mutable
        });

        // register getters and setters
        if (mutable) {
            // getter and setter
            Object.defineProperty(this, propName, {
                get: function () {
                    return map.get(propName).src;
                },
                set: function (src) {
                    if (this.propCheck) {
                        src = this.propCheck(propName, src)
                    }
                    if (src != map.get(propName).src) {
                        this[`${PREFIX}_attach`](propName, src);
                    }
                }
            });
        } else {
            // only getter
            Object.defineProperty(this, propName, {
                get: function () {
                    return m.get(propName).src;
                }
            });
        }
    }

    function attatch(propName, src) {
        const map = this[`${PREFIX}`];
        const state = map.get(propName)

        if (state.init && !state.mutable) {
            throw new Error(`${propName} can not be reassigned`);
        }

        // unsubscribe from source change event
        if (state.src) {
            state.src.remove_callback(state.handle);
            state.src = undefined;
            state.handle = undefined;
        }

        // attatch new src
        state.src = src;
        state.init = true;

        // subscribe to callback from source
        if (this.propChange) {
            const handler = function (eArg) {
                this.propChange(propName, eArg);
            }.bind(this);
            state.handle = src.add_callback(handler);
            this.propChange(propName, "reset"); 
        }
    }

    const api = {};
    api[`${NAME}Register`] = register;
    api[`${PREFIX}_attach`] = attatch;
    Object.assign(_prototype, api);
}

