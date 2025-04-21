import {local_clock, check_number} from "./util/common.js";


/**
 * CLOCK PROVIDER
 * 
 * ts (sec) - timestamp from official *local_clock*
 * value (sec) - value of clock at time ts
 * rate (sec/sec) - rate of clock (default 1.0)
 * 
 * Clock Provider uses official *local clock* (performace.now()/1000.0)
 * The official clock is exported by the statelayers framework, so application
 * code can use the this clock to initialize new ClockProviders.
 * 
 * Given a different clock, this can be represented as a clock provider, 
 * simply the value of this clock, and the base clock, at the same time.
 *   
 */


export class ClockProvider {
    constructor(vector) {
        let {ts, value, rate=1.0} = vector;
        if (ts == undefined) {
            ts = local_clock.now();
        }
        check_number("ts", ts);
        check_number("value", value);
        check_number("rate", rate);
        this._t0 = ts;
        this._value = value;
        this._rate = rate;
    }

    now (local_ts = local_clock.now()) {
        return this._value + (local_ts - this._t0)*this._rate;
    }

    get rate() {return this._rate;}
}


/**
 * LOCAL CLOCK PROVIDER represent local epoch time
 */

const t0 = local_clock.now();
const epoch_t0 = new Date()/1000.0

export const LOCAL_CLOCK_PROVIDER = new ClockProvider({
    ts: t0, 
    value: epoch_t0, 
    rate: 1.0
});

