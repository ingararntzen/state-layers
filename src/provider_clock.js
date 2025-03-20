/**
 * clock provider must have a now() method
 */
export function is_clock_provider(obj) {
    if (obj == undefined) return false;
    if (!("now" in obj)) return false;
    if (typeof obj.now != 'function') return false;
    return true;
}

// webpage clock - performance now - seconds
function local () {
    return performance.now()/1000.0;
}

// system clock - epoch - seconds
function epoch () {
    return new Date()/1000.0;
}

/**
 * CLOCK gives epoch values, but is implemented
 * using performance now for better
 * time resolution and protection against system 
 * time adjustments.
 */
export const LOCAL_CLOCK_PROVIDER = function () {
    const t0_local = local();
    const t0_epoch = epoch();
    return {
        now () {
            const t1_local = local();
            return t0_epoch + (t1_local - t0_local);
        }
    }
}();

