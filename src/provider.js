import { is_variable_provider } from "./provider_variable";
import { is_collection_provider } from "./provider_collection";

export function is_state_provider(obj) {
    if (is_variable_provider(obj)) return true;
    if (is_collection_provider(obj)) return true;
    return false;
}

/**
 * wrapper function allowing variableProvider
 * to be updated in the same way as 
 * collectionProvider, essentially masking 
 * the fact that the variableProvider only
 * support resetting the entire item collection
 */
export function update_state_provider (stateProvider, changes={}) {
    if (is_collection_provider(stateProvider)) {
        return stateProvider.update(changes);
    } else if (is_variable_provider(stateProvider)) {   
        let {
            insert=[],
            remove=[],
            reset=false
        } = changes;
        if (reset) {
            return stateProvider.set(insert);
        } else {
            const map = new Map(stateProvider.get()
            .map((item) => [item.id, item]));
            // remove
            remove.forEach((id) => map.delete(id));
            // insert
            insert.forEach((item) => map.set(item.id, item));
            // set
            const items = Array.from(map.values());
            return stateProvider.set(items);
        }
    }
}