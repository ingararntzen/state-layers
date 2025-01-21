import { ClockProviderBase } from "./bases";

/***************************************************************
    CLOCKS
***************************************************************/

/**
 * clocks counting in seconds
 */

const local_clock = function () {
    return performance.now()/1000.0;
}

const local_epoch = function () {
    return new Date()/1000.0;
}


/***************************************************************
    LOCAL CLOCK PROVIDER
***************************************************************/

/**
 * Local high performance clock
 */

class LocalClockProvider extends ClockProviderBase {
    now () { 
        return local_clock();
    }
}
// singleton
export const LOCAL_CLOCK_PROVIDER = new LocalClockProvider();


/***************************************************************
    LOCAL EPOCH CLOCK PROVIDER
***************************************************************/

/**
 * Local Epoch Clock Provider is computed from local high
 * performance clock. This makes for a better resolution than
 * the system epoch clock, and protects the clock from system 
 * clock adjustments during the session.
 */

class LocalEpochProvider extends ClockProviderBase {

    constructor () {
        super();
        this._t0 = local_clock();
        this._t0_epoch = local_epoch();
    }
    now () {
        return this._t0_epoch + (local_clock() - this._t0);            
    }
}

// singleton
export const LOCAL_EPOCH_PROVIDER = new LocalEpochProvider();



