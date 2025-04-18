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

/**
 * Wonder if clock provider should rather be a 
 * static vector [ts (sec), offset (unit), rate (unit/sec)]
 * where the clock has offset at time ts, and where
 * ts is taken from a specific clock (local clock)
 * exposed by the statelayers framework.
 * Example, epoch : [ts, epoch_sec_ts, 1.0]
 * 
 * Then nobody would need to implement a clock provider,
 * but could just send in a vector as option.
 */