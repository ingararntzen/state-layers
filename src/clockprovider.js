// webpage clock - performance now - seconds
const local = {
    now: function() {
        return performance.now()/1000.0;
    }
}
// system clock - epoch - seconds
const epoch = {
    now: function() {
        return new Date()/1000.0;
    }
}

/**
 * CLOCK gives epoch values, but is implemented
 * using performance now for better
 * time resolution and protection against system 
 * time adjustments.
 */

export const LOCAL_CLOCK_PROVIDER = function () {
    const t0_local = local.now();
    const t0_epoch = epoch.now();
    return {
        now: function () {
            const t1_local = local.now();
            return t0_epoch + (t1_local - t0_local);
        }
    };
}();

export function is_clockprovider(obj) {
    if (!("now" in obj)) return false;
    if (typeof obj.now != "function") return false;
    return true;
}