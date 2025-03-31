import { local_clock } from "./common.js";

/**
 * polling a callback function periodically with 
 * a fixed delay (ms).
 * If delay is 0, use requestAnimationFrame,
 * else use setTimeout.
 * Delay can be set dynamically. Pause and resume
 * is needed for new delay to take effect.
 */

class Poller {

    constructor(callback) {
        this._callback = callback;
        this._handle;
        this._delay;
    }
    
    set delay (delay_ms) {
        if (typeof delay_ms != "number") {
            throw new Error(`delay must be a number ${delay_ms}`);
        }
        if (this._delay != delay_ms) {   
            this._delay = delay_ms;
        }
    }
    get delay () {return this._delay;}

    is_polling () {
        return this._handle != undefined;
    }

    pause() {
        if (this._handle != undefined) {
            this._handle.cancel();
            this._handle = undefined;
        }
    }

    poll() {
        // poll callback
        this._callback();
        // schedule next poll
        this.pause();
        this.resume();
    }

    resume() {
        if (this._handle == undefined) {
            if (this._delay == 0) {
                // framerate
                const aid = requestAnimationFrame(this.poll.bind(this));
                this._handle = {cancel: () => cancelAnimationFrame(aid)};
            } else {
                // timeout
                const tid = setTimeout(this.poll.bind(this), this._delay);
                this._handle = {cancel: () => clearTimeout(tid)};
            }
        }
    }
}

/**
 * Cursor Monitor
 */

class CursorMonitor {
    constructor() {
        /*
            set of bindings
            poll cursor (when dynamic) periodically with given (minimum) delay, and invoke callback with cursor state 
            binding : {cursor, callback, delay_ms}
            - cursor:
            - callback: function(state)
            - delay: (ms) between samples (when variable is dynamic)
            there can be multiple bindings for the same cursor
        */
        this._binding_set = new Set();

        /*
            cursors
            map: cursor -> {sub, polling, bindings:[]}
        */
        this._cursor_map = new Map();

        // Poller
        this._poller = new Poller(this.onpoll.bind(this));
    }

    bind(cursor, callback, delay) {
        // check delay
        if (delay == undefined) {
            delay = 0;
        } else if (typeof delay != "number") {
            throw new Error(`delay must be a number ${delay}`);
        }
        // register binding
        let binding = {cursor, callback, delay};
        this._binding_set.add(binding);
        // register cursor
        if (!this._cursor_map.has(cursor)) { 
            let sub = cursor.on("change", this.oncursorchange.bind(this));
            this._cursor_map.set(cursor, {
                sub, polling: false, bindings: [binding]
            });
        } else {
            this._cursor_map.get(cursor).bindings.push(binding);
        }
        return binding;
    }

    release (binding) {
        // unregister binding
        const removed = this._binding_set.delete(binding);
        if (!removed) return;
        // cleanup
        const cursor = binding.cursor;
        const {sub, bindings} = this._cursor_map.get(cursor);
        // remove binding
        const idx = bindings.indexOf(binding);
        if (idx >= 0) {
            bindings.splice(idx, 1);
        }
        if (bindings.length == 0) {
            // no more bindings
            cursor.off(sub);
            this._cursor_map.delete(cursor);
        }
    }

    /**
     * a cursor has changed
     * forward change event to all callbacks for this cursor.
     * and reevaluate polling status, pausing or resuming
     * polling if needed.
     */
    oncursorchange(eArg, eInfo) {
        const cursor = eInfo.src;
        const state = eArg;
        // reevaluate polling status
        this._cursor_map.get(cursor).polling = state.dynamic;
        // find cursors which need polling
        const polling_cursors = [...this._cursor_map.values()]
            .filter(entry => entry.polling);
        this.reevaluate_polling(polling_cursors);
        // forward change event to all for this cursor callbacks
        const {bindings} = this._cursor_map.get(cursor);
        for (const binding of bindings) {
            binding.callback(state);
        }
    }

    onpoll() {
        const ts = local_clock.now();
        // poll all cursors with need of polling
        for (const [cursor, entry] of this._cursor_map) {
            if (entry.polling) {
                const state = cursor.query(ts);
                // forward polled state to all callbacks for this cursor
                for (const binding of entry.bindings) {
                    binding.callback(state);
                }
            }
        }
    }

    reevaluate_polling(polling_cursors) {
        if (polling_cursors.length == 0) {
            this._poller.pause();
        } else {
            // find minimum delay
            const delays = polling_cursors.map(entry => {
                return entry.bindings.map(binding => binding.delay);
            });
            const min_delay = Math.min(...delays);
            this._poller.delay = min_delay;
            this._poller.pause();
            this._poller.resume();
        }
    }
}


/*********************************************************************
    BIND RELEASE
*********************************************************************/

// monitor singleton
const monitor = new CursorMonitor();

export function bind(cursor, callback, delay) {
    return monitor.bind(cursor, callback, delay);
}
export function release(binding) {
    return monitor.release(binding);
}

