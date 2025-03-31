import {local_clock, local_epoch} from "./util/common.js";


/**
 * clock provider must have a now() method
 */
export function is_clock_provider(obj) {
    if (obj == undefined) return false;
    if (!("now" in obj)) return false;
    if (typeof obj.now != 'function') return false;
    return true;
}


/**
 * CLOCK gives epoch values, but is implemented
 * using performance now for better
 * time resolution and protection against system 
 * time adjustments.
 */
export const LOCAL_CLOCK_PROVIDER = function () {
    const t0 = local_clock.now();
    const t0_epoch = local_epoch.now();
    return {
        now (local_ts = local_clock.now()) {
            return t0_epoch + (local_ts - t0);
        }
    }
}();

