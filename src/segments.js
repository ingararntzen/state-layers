import {interval} from "./intervals.js";

/********************************************************************
BASE SEGMENT
*********************************************************************/
/*
	Abstract Base Class for Segments

    constructor(interval, options={})

    - interval: interval of validity of segment
    - dynamic: true if segment is dynamic
    - value(offset): value of segment at offset
    - query(offset): state of segment at offset
*/

export class BaseSegment {

	constructor(itv, options={}) {
		this._itv = itv;
        this._options = options;
	}

    get options() {return this._options;}
	get interval() {return this._itv;}

    /* 
    implemented by subclass
    - returns true or false 
    */
    get dynamic() {
        return false;
    }

    /** 
     * implemented by subclass
     * returns value or undefined
    */
    value() {
    	throw new Error("not implemented");
    }

    /**
     * convenience function returning the state of the segment
     * @param {*} offset 
     * @returns 
     */
    query(offset) {
        let value = undefined, dynamic = false;
        if (interval.covers_point(this._itv, offset)) {
            value = this.value(offset);
            dynamic = this.dynamic;
        }
        return {value, dynamic, offset};
    }
}


/********************************************************************
    STATIC SEGMENT
*********************************************************************/

export class StaticSegment extends BaseSegment {

	constructor(itv, value) {
        super(itv);
		this._value = value;
	}

	value() {
		return this._value;
	}
}


/********************************************************************
    MOTION SEGMENT
*********************************************************************/
/*
    Implements deterministic projection based on initial conditions 
    - motion vector describes motion under constant acceleration
*/

export class MotionSegment extends BaseSegment {
    
    constructor(itv, vector) {
        super(itv);
        this.vector = vector;
        let [p0, v0, a0, t0] = this.vector;

        // create motion transition
        this._dynamic = (v0 != 0 || a0 != 0);
        this._trans = function (ts) {
            let d = ts - t0;
            return p0 + v0*d + 0.5*a0*d*d;
        };   
    }

    get dynamic() {
        return this._dynamic;
    }

    value(offset) {
        return this._trans(offset);
    }
}


/********************************************************************
    TRANSITION SEGMENT
*********************************************************************/

/*
    Supported easing functions
    "ease-in":
    "ease-out":
    "ease-in-out"
*/

function easein (ts) {
    return Math.pow(ts,2);  
}
function easeout (ts) {
    return 1 - easein(1 - ts);
}
function easeinout (ts) {
    if (ts < .5) {
        return easein(2 * ts) / 2;
    } else {
        return (2 - easein(2 * (1 - ts))) / 2;
    }
}

export class TransitionSegment extends BaseSegment {

	constructor(itv, v0, v1, easing) {
		super(itv);
        this.v0 = v0;
        this.v1 = v1;
        this.easing = easing;
        let [t0, t1] = this.itv.slice(0,2);

        // create the transition function
        this._dynamic = v1-v0 != 0;
        this._trans = function (ts) {
            // convert ts to [t0,t1]-space
            // - shift from [t0,t1]-space to [0,(t1-t0)]-space
            // - scale from [0,(t1-t0)]-space to [0,1]-space
            ts = ts - t0;
            ts = ts/parseFloat(t1-t0);
            // easing functions stretches or compresses the time scale 
            if (easing == "ease-in") {
                ts = easein(ts);
            } else if (easing == "ease-out") {
                ts = easeout(ts);
            } else if (easing == "ease-in-out") {
                ts = easeinout(ts);
            }
            // linear transition from v0 to v1, for time values [0,1]
            ts = Math.max(ts, 0);
            ts = Math.min(ts, 1);
            return v0 + (v1-v0)*ts;
        }
	}

	get dynamic() {
        return this._dynamic;
    }

	value(offset) {
        return this._trans(offset);
	}
}



/********************************************************************
    INTERPOLATION SEGMENT
*********************************************************************/

/**
 * Function to create an interpolator for nearest neighbor interpolation with extrapolation support.
 * 
 * @param {Array} tuples - An array of [value, offset] pairs, where value is the point's value and offset is the corresponding offset.
 * @returns {Function} - A function that takes an offset and returns the interpolated or extrapolated value.
 */

function interpolate(tuples) {

    if (tuples.length < 1) {
        return function interpolator () {return undefined;}
    } else if (tuples.length == 1) {
        return function interpolator () {return tuples[0][0];}
    }

    // Sort the tuples by their offsets
    const sortedTuples = [...tuples].sort((a, b) => a[1] - b[1]);
  
    return function interpolator(offset) {
      // Handle extrapolation before the first point
      if (offset <= sortedTuples[0][1]) {
        const [value1, offset1] = sortedTuples[0];
        const [value2, offset2] = sortedTuples[1];
        return value1 + ((offset - offset1) * (value2 - value1) / (offset2 - offset1));
      }
      
      // Handle extrapolation after the last point
      if (offset >= sortedTuples[sortedTuples.length - 1][1]) {
        const [value1, offset1] = sortedTuples[sortedTuples.length - 2];
        const [value2, offset2] = sortedTuples[sortedTuples.length - 1];
        return value1 + ((offset - offset1) * (value2 - value1) / (offset2 - offset1));
      }
  
      // Find the nearest points to the left and right
      for (let i = 0; i < sortedTuples.length - 1; i++) {
        if (offset >= sortedTuples[i][1] && offset <= sortedTuples[i + 1][1]) {
          const [value1, offset1] = sortedTuples[i];
          const [value2, offset2] = sortedTuples[i + 1];
          // Linear interpolation formula: y = y1 + ( (x - x1) * (y2 - y1) / (x2 - x1) )
          return value1 + ((offset - offset1) * (value2 - value1) / (offset2 - offset1));
        }
      }
  
      // In case the offset does not fall within any range (should be covered by the previous conditions)
      return undefined;
    };
}
  

export class InterpolationSegment extends BaseSegment {

    constructor(itv, tuples) {
        super(itv);
        // setup interpolation function
        this._trans = interpolate(tuples);
    }

    get dynamic() {return true;}

    value(offset) {return this._trans(offset);}
}


