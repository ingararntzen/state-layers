import {local_clock, check_number} from "./util/common.js";


/**
 * CLOCK PROVIDER
 * 
 * A ClockProvider can be created in two ways
 * - either by supplying a clock object
 * - or by supplying a vector 
 * 
 * A *clock* is an object that has a now() method which returns the current time.
 * A clock is expected to return a timestamp in seconds, monitonically increasing 
 * at rate 1.0 sec/sec. 
 * 
 * A *vector* initializes a determistic clock based on the official *local_clock*. 
 * - ts (sec) - timestamp from official *local_clock*
 * - value (sec) - value of clock at time ts
 * - rate (sec/sec) - rate of clock (default 1.0)
 * Clock Provider uses official *local clock* (performace.now()/1000.0)
 * The official clock is exported by the statelayers framework, so application
 * code can use it to create an initial timestamps. If ommitted, clock
 * provider creates the timestamp - thereby assuming that the provided value was 
 * sampled immediately before.
 * 
 * 
 * The key difference between *clock* and *vector* is that the clock object can drift 
 * relative to the official *local_clock*, while the vector object is forever locked to
 * the official *local_clock*.
 *   
 */

function is_clock(obj) {
    if (!("now" in obj)) return false;
    if (typeof obj.now != "function") return false;
    return true;
}


export class ClockProvider {

    constructor (options={}) {
        const {clock, vector} = options;

        if (clock !== undefined && is_clock(clock)) {
            this._clock = {
                now: (local_ts) => {
                    // if local_ts is defined it defines a timestamp for
                    // evaluation of the clock - which is not necessarily the same
                    // as now - back-date clock accordingly
                    const diff_ts = (local_ts != undefined) ? local_clock.now() - local_ts : 0;
                    return clock.now() - diff_ts;
                }
            }    
            this._rate = 1.0;
        } else if (vector != undefined) {
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
            this._clock = {
                now: (local_ts = local_clock.now()) => {
                    return this._value + (local_ts - this._t0)*this._rate;
                }
            }
        } else {
            throw new Error("ClockProvider: provide clock or vector");
        }
    }

    now () {
        return this._clock.now();
    }

    get rate() {return this._rate;}
}





/**
 * LOCAL CLOCK PROVIDER represent local epoch time (locked to *local clock*)
 */

export const LOCAL_CLOCK_PROVIDER = new ClockProvider({
    vector: {
        value: new Date()/1000.0, 
        rate: 1.0
    }
});

