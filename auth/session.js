/**
 * session.js
 * ─────────────────────────────────────────────────────────────────────────
 * Owns everything about the local session artifact: where it lives
 * (localStorage vs sessionStorage), its shape, its expiry, cross-tab
 * synchronization, idle detection, and silent-refresh scheduling.
 *
 * This module does NOT call the network. It only manages local state and
 * exposes hooks that auth.js / routeGuard.js wire up to api.js.
 *
 * Threat model note (read this before changing storage strategy):
 * Because this is a static frontend (GitHub Pages) talking to a Google
 * Apps Script backend on a different origin, the backend cannot set an
 * httpOnly cookie scoped to this site. The session token therefore has to
 * live in JS-accessible storage, which means it is readable by any script
 * running on this origin — i.e. it is vulnerable to theft via XSS. We treat
 * this as an accepted, documented tradeoff (see README → Security) and
 * mitigate it by: escaping all rendered user input (see components/toast.js
 * and verify.js), keeping the dependency surface at zero third-party JS,
 * short default token lifetimes, and silent rotation on refresh.
 *
 * Depends on: config.js (window.VA_AUTH_CONFIG)
 * Exposes:    window.VA_SESSION
 * ───────────────────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  const CONFIG = global.VA_AUTH_CONFIG;
  if (!CONFIG) {
    throw new Error('[session.js] VA_AUTH_CONFIG is missing — load config.js first.');
  }

  const SESSION_KEY = CONFIG.STORAGE_KEYS.SESSION;
  const PENDING_KEY = CONFIG.STORAGE_KEYS.PENDING_AUTH;
  const BROADCAST_KEY = CONFIG.STORAGE_KEYS.BROADCAST_LOGOUT;

  // ── Low-level storage helpers ──────────────────────────────────────────
  // A "remembered" session is written to localStorage (survives closing the
  // browser, expires after 30 days). A non-remembered session is written to
  // sessionStorage (cleared when the tab closes, expires after 24h anyway).
  // We always clear the OTHER storage on write so there is never a stale
  // duplicate lingering in both places.

  function safeParse(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function readRaw() {
    return safeParse(localStorage.getItem(SESSION_KEY)) || safeParse(sessionStorage.getItem(SESSION_KEY));
  }

  function writeRaw(record, remembered) {
    const json = JSON.stringify(record);
    if (remembered) {
      localStorage.setItem(SESSION_KEY, json);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, json);
      localStorage.removeItem(SESSION_KEY);
    }
  }

  function clearRaw() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  // ── Session lifecycle ──────────────────────────────────────────────────

  /**
   * Persist a new session after a successful verifyOTP().
   * @param {object} params
   * @param {string} params.token
   * @param {string|number} params.expiresAt - ISO string or epoch ms from backend
   * @param {boolean} params.remembered
   * @param {object} [params.user]
   */
  function createSession({ token, expiresAt, remembered, user }) {
    if (!token) throw new Error('[session.js] createSession requires a token.');

    const expiresAtMs = normalizeExpiry(expiresAt, remembered);

    const record = {
      token,
      expiresAt: expiresAtMs,
      remembered: !!remembered,
      user: user || null,
      createdAt: Date.now(),
    };

    writeRaw(record, record.remembered);
    return record;
  }

  /**
   * Backend may return an ISO date, an epoch ms, or nothing (in which case
   * we fall back to the configured default duration for this session type).
   */
  function normalizeExpiry(expiresAt, remembered) {
    if (expiresAt) {
      const parsed = typeof expiresAt === 'number' ? expiresAt : Date.parse(expiresAt);
      if (!Number.isNaN(parsed)) return parsed;
    }
    const fallbackDuration = remembered
      ? CONFIG.SESSION_DURATION_REMEMBERED_MS
      : CONFIG.SESSION_DURATION_DEFAULT_MS;
    return Date.now() + fallbackDuration;
  }

  /** @returns {object|null} the raw session record, or null if none exists */
  function getSession() {
    return readRaw();
  }

  /** @returns {string|null} */
  function getToken() {
    const s = readRaw();
    return s ? s.token : null;
  }

  /** @returns {object|null} */
  function getUser() {
    const s = readRaw();
    return s ? s.user : null;
  }

  function setUser(user) {
    const s = readRaw();
    if (!s) return;
    s.user = user;
    writeRaw(s, s.remembered);
  }

  /** @returns {boolean} true if a session exists and its local expiry hasn't passed */
  function isValidLocally() {
    const s = readRaw();
    if (!s || !s.token) return false;
    return s.expiresAt > Date.now();
  }

  /**
   * Update the expiry (and optionally rotate the token) after a successful
   * validateSession() call, without disturbing anything else in the record.
   * (There is no refreshSession backend action — see routeGuard.js/api.js.)
   */
  function extendSession({ token, expiresAt }) {
    const s = readRaw();
    if (!s) return null;
    if (token) s.token = token;
    s.expiresAt = normalizeExpiry(expiresAt, s.remembered);
    writeRaw(s, s.remembered);
    return s;
  }

  /**
   * Clear the local session and notify other open tabs to do the same.
   * Does NOT call the backend — pair with VA_API.logout() in auth.js.
   */
  function clearSession() {
    clearRaw();
    broadcastLogout();
  }

  // ── Cross-tab synchronization ──────────────────────────────────────────
  // BroadcastChannel is preferred where available; the localStorage
  // write-then-remove pattern is the fallback for older browsers and
  // covers the case where tabs were opened before this module changed.

  const channel = 'BroadcastChannel' in global ? new BroadcastChannel('va-auth') : null;

  function broadcastLogout() {
    if (channel) {
      channel.postMessage({ type: 'logout', at: Date.now() });
    }
    // Fallback path: writing to localStorage fires a `storage` event in
    // OTHER tabs (never the tab that wrote it), which is exactly the
    // semantics we want for a cross-tab logout ping.
    localStorage.setItem(BROADCAST_KEY, String(Date.now()));
  }

  /**
   * @param {() => void} onLogout - called when another tab logs out
   * @returns {() => void} unsubscribe function
   */
  function onCrossTabLogout(onLogout) {
    const handlers = [];

    if (channel) {
      const handler = (event) => {
        if (event.data && event.data.type === 'logout') onLogout();
      };
      channel.addEventListener('message', handler);
      handlers.push(() => channel.removeEventListener('message', handler));
    }

    const storageHandler = (event) => {
      if (event.key === BROADCAST_KEY || event.key === SESSION_KEY) {
        // Re-check local state: if the session is now gone, we were logged out.
        if (!isValidLocally()) onLogout();
      }
    };
    global.addEventListener('storage', storageHandler);
    handlers.push(() => global.removeEventListener('storage', storageHandler));

    return () => handlers.forEach((fn) => fn());
  }

  // ── Idle detection ──────────────────────────────────────────────────────
  // Tracks real user interaction and fires a warning callback after
  // IDLE_WARNING_AFTER_MS, then a logout callback if not extended within
  // IDLE_COUNTDOWN_SECONDS. Pure timers — no DOM. components/idle-warning.js
  // renders the modal and calls back into this controller.

  const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];

  function createIdleMonitor({ onWarning, onTimeout }) {
    let warningTimer = null;
    let logoutTimer = null;
    let active = false;

    function clearTimers() {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
    }

    function schedule() {
      clearTimers();
      warningTimer = setTimeout(() => {
        if (typeof onWarning === 'function') onWarning();
        logoutTimer = setTimeout(() => {
          if (typeof onTimeout === 'function') onTimeout();
        }, CONFIG.IDLE_COUNTDOWN_SECONDS * 1000);
      }, CONFIG.IDLE_WARNING_AFTER_MS);
    }

    function onActivity() {
      // Once the warning has fired, activity alone should NOT silently
      // dismiss it — the user must explicitly click "Extend Session"
      // (handled by calling `reset()` from the idle-warning component).
      // This prevents e.g. a stray scroll event from masking true inactivity.
    }

    function start() {
      if (active) return;
      active = true;
      ACTIVITY_EVENTS.forEach((evt) => global.addEventListener(evt, onActivity, { passive: true }));
      schedule();
    }

    function stop() {
      active = false;
      ACTIVITY_EVENTS.forEach((evt) => global.removeEventListener(evt, onActivity));
      clearTimers();
    }

    /** Call after a successful "Extend Session" or any confirmed refresh. */
    function reset() {
      if (active) schedule();
    }

    return { start, stop, reset };
  }

  // ── Silent re-validation scheduling ─────────────────────────────────────
  // Pure interval scaffolding; routeGuard.js supplies the actual
  // validateSession() network call as the callback so this module stays
  // network-free. (Named "SilentRefresh" for historical/back-compat reasons;
  // it re-validates, it does not extend the server-side expiry.)

  function createSilentRefreshScheduler(callback) {
    let intervalId = null;

    function tick() {
      const s = readRaw();
      if (!s) return;
      const remaining = s.expiresAt - Date.now();
      if (remaining <= 0) return; // expired — routeGuard/idle logic will handle this
      if (remaining <= CONFIG.SILENT_REFRESH_MIN_REMAINING_MS) {
        // Already close to expiry after this interval elapses again — refresh now.
        callback();
        return;
      }
      callback();
    }

    function start() {
      stop();
      intervalId = setInterval(tick, CONFIG.SILENT_REFRESH_INTERVAL_MS);
    }

    function stop() {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
    }

    return { start, stop };
  }

  // ── Pending auth state ──────────────────────────────────────────────────
  // Short-lived state bridging login.html → verify.html. Deliberately
  // separate from the real session so a half-finished login can never be
  // mistaken for an authenticated one.

  function setPendingAuth({ email, remember }) {
    const record = {
      email,
      remember: !!remember,
      sentAt: Date.now(),
      resendCount: 0,
    };
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(record));
    return record;
  }

  function getPendingAuth() {
    const record = safeParse(sessionStorage.getItem(PENDING_KEY));
    if (!record) return null;
    if (Date.now() - record.sentAt > CONFIG.PENDING_AUTH_TTL_MS) {
      clearPendingAuth();
      return null;
    }
    return record;
  }

  function updatePendingAuth(patch) {
    const record = getPendingAuth();
    if (!record) return null;
    const updated = Object.assign({}, record, patch);
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(updated));
    return updated;
  }

  function bumpPendingResendCount() {
    const record = getPendingAuth();
    if (!record) return 0;
    const next = (record.resendCount || 0) + 1;
    updatePendingAuth({ resendCount: next, sentAt: Date.now() });
    return next;
  }

  function clearPendingAuth() {
    sessionStorage.removeItem(PENDING_KEY);
  }

  global.VA_SESSION = Object.freeze({
    createSession,
    getSession,
    getToken,
    getUser,
    setUser,
    isValidLocally,
    extendSession,
    clearSession,
    onCrossTabLogout,
    createIdleMonitor,
    createSilentRefreshScheduler,
    setPendingAuth,
    getPendingAuth,
    updatePendingAuth,
    bumpPendingResendCount,
    clearPendingAuth,
  });
})(window);
