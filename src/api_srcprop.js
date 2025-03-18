import { is_callback_api } from "./api_callback.js";

/************************************************
 * SOURCE PROPERTY (SRCPROP)
 ************************************************/

/**
 * Functions for extending a class with support for 
 * external source on a named property.
 * 
 * option: mutable:true means that propery may be reset 
 * 
 * source object is assumed to support the callback interface,
 * or be a list of objects all supporting the callback interface
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
            mutable,
            entity: undefined,
            handles: []
        });

        // register getters and setters
        Object.defineProperty(this, propName, {
            get: function () {
                return map.get(propName).entity;
            },
            set: function (entity) {
                if (this[`${NAME}_check`]) {
                    entity = this[`${NAME}_check`](propName, entity);
                }
                if (entity != map.get(propName).entity) {
                    this[`${PREFIX}_attach`](propName, entity);
                }
            }
        });
    }

    function attatch(propName, entity) {

        const map = this[`${PREFIX}`];
        const state = map.get(propName)

        if (state.init && !state.mutable) {
            throw new Error(`${propName} can not be reassigned`);
        }

        const entities = (Array.isArray(entity)) ? entity : [entity];

        // unsubscribe from entities
        if (state.handles.length > 0) {
            for (const [idx, e] of Object.entries(entities)) {
                if (is_callback_api(e)) {
                    e.remove_callback(state.handles[idx]);
                }
            }    
        }
        state.handles = [];

        // attatch new entity
        state.entity = entity;
        state.init = true;

        // subscribe to callback from source
        if (this[`${NAME}_onchange`]) {
            const handler = function (eArg) {
                this[`${NAME}_onchange`](propName, eArg);
            }.bind(this);
            for (const e of entities) {
                if (is_callback_api(e)) {
                    state.handles.push(e.add_callback(handler));
                }
            }
            this[`${NAME}_onchange`](propName, "reset"); 
        }
    }

    const api = {};
    api[`${NAME}_register`] = register;
    api[`${PREFIX}_attach`] = attatch;
    Object.assign(_prototype, api);
}

