import * as callback from "./api_callback.js";
import { check_input, random_string} from "./util.js";


/************************************************
 * STATE PROVIDER BASE
 ************************************************/

/*
    Base class for StateProviders

    - collection of items
    - {key, itv, type, data}
*/

export class StateProviderBase {

    constructor() {
        callback.addToInstance(this);
    }

    /**
     * update function
     * 
     * If ItemsProvider is a proxy to an online
     * Items collection, update requests will 
     * imply a network request
     * 
     * options - support reset flag 
     */
    update(items, options={}){
        throw new Error("not implemented");
    }

    /**
     * return array with all items in collection 
     * - no requirement wrt order
     */

    get_items() {
        throw new Error("not implemented");
    }

    /**
     * signal if items can be overlapping or not
     */

    get info () {
        return {overlapping: true};
    }
}
callback.addToPrototype(StateProviderBase.prototype);



/************************************************
 * LOCAL STATE PROVIDER BASE
 ************************************************/


export class LocalStateProviderBase extends StateProviderBase {


    initialise(options={}) {
        // initialization with items or single value 
        let {items, value} = options;
        if (items != undefined) {
            // initialize from items
            this._update(check_input(items));
        } else if (value != undefined) {
            // initialize from value
            this._update([{
                itv:[-Infinity, Infinity, true, true], 
                type: "static",
                data:value
            }]);
        }        
    }


    update (items, options={}) {
        items = check_input(items);
        return Promise.resolve()
            .then(() => {
                const eArgList = this._update(items, options);
                this.notify_callbacks(eArgList);
            });
    }


    get (id) {
        throw new Error("not implemented");
    }

    /**
     * common - check input 
     * - calculate eArgs
     * 
     * */

    _update (items, options={}) {

        // support single item
        if (!Array.isArray(items)) {
            items = [items];
        }

        const {clear=false} = options;


    	const batchMap = new Map();
    	let eArg;

		// create batchmap with eArgs
    	for (let item of items) {
            if (item.id == undefined) {
                item.id = random_string(10);
            }
            let id = item.id;
            if (batchMap.has(id)) {
                eArg = {id, old: batchMap.get(id).old};
            } else {
                eArg = {id, old: this.get(id)};
            }
    		// if id property is only propery of item - this means delete
			if (Object.keys(item).length == 1) {
                eArg.new = undefined;
            } else {
                eArg.new = item;
            }
            if (eArg.new == undefined && eArg.old == undefined) {
                batchMap.delete(eArg.id);
            } else {
                batchMap.set(id, eArg);                
            }
    	}
        

    }
}

