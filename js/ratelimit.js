var RATELIMIT = (function() {
  var KEY = "auth_attempts";
  var WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  // Exponential backoff: attempts -> block duration in seconds
  var SCHEDULE = [0, 0, 0, 0, 0, 15, 30, 60, 120, 300];

  function _read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch(e) { return null; }
  }

  function _write(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e) {}
  }

  function blockDuration(count) {
    if (count >= SCHEDULE.length) return SCHEDULE[SCHEDULE.length - 1];
    return SCHEDULE[count];
  }

  function check() {
    var now = Date.now();
    var state = _read();

    // No prior attempts
    if (!state) return { allowed: true, remaining: 0, waitSeconds: 0 };

    // Currently blocked and block hasn't expired
    if (state.blockedUntil && state.blockedUntil > now) {
      var wait = Math.ceil((state.blockedUntil - now) / 1000);
      return { allowed: false, remaining: 0, waitSeconds: wait };
    }

    // Block expired — reset
    if (state.blockedUntil && state.blockedUntil <= now) {
      _write(null);
      return { allowed: true, remaining: 0, waitSeconds: 0 };
    }

    // Window expired — reset
    if (state.firstAttemptTs && (now - state.firstAttemptTs) > WINDOW_MS) {
      _write(null);
      return { allowed: true, remaining: 0, waitSeconds: 0 };
    }

    // Active window, not yet blocked
    var count = state.count || 0;
    var dur = blockDuration(count + 1); // next attempt's block
    return { allowed: true, remaining: 4 - count, waitSeconds: dur };
  }

  function recordFailure() {
    var now = Date.now();
    var state = _read();

    if (!state || !state.firstAttemptTs || (now - state.firstAttemptTs) > WINDOW_MS) {
      state = { count: 0, firstAttemptTs: now, blockedUntil: null };
    }

    state.count += 1;
    var dur = blockDuration(state.count);
    if (dur > 0) {
      state.blockedUntil = now + dur * 1000;
    }

    _write(state);
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch(e) {}
  }

  return { check: check, recordFailure: recordFailure, clear: clear };
})();
