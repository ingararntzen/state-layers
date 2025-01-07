/**
 * Returns true if the point is covered by the interval
 * 
 * @param {*} interval 
 * @param {*} point 
 * @returns 
 */

function covers_point(interval, point) {
    let [low, high, lowClosed, highClosed] = interval;
    if (lowClosed && highClosed) {
        return low <= point && point <= high;
    } else if (lowClosed && !highClosed) {
        return low <= point && point < high;
    } else if (!lowClosed && highClosed) {
        return low < point && point <= high;
    } else {
        return low < point && point < high;
    }
}

/*
    Return true if interval has length 0
*/
function is_singular(interval) {
    return interval[0] == interval[1]
}






export const intervals = {covers_point, is_singular }
