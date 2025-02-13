import * as callback from "./api_callback.js";
import { CLOCK } from "./util.js";

/************************************************
 * CLOCK PROVIDER BASE
 ************************************************/

/**
 * Base class for ClockProviders
 * 
 * Clock Providers implement the callback
 * interface to be compatible with other state
 * providers, even though they are not required to
 * provide any callbacks after clock adjustments
 */

export class ClockProviderBase {
    constructor() {
        callback.addToInstance(this);
    }
    now () {
        throw new Error("not implemented");
    }
}
callback.addToPrototype(ClockProviderBase.prototype);



/************************************************
 * LOCAL CLOCK PROVIDER
 ************************************************/

class LocalClockProvider extends ClockProviderBase {
    now () {
        return CLOCK.now();
    }
}

export const localClockProvider = new LocalClockProvider();
