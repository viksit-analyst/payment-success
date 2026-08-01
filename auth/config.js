/**
 * config.js
 * ─────────────────────────────────────────────────────────────────────────
 * Single source of truth for the Viksit Analyst authentication module.
 *
 * Nothing in this file is secret. It is shipped to the browser, so it must
 * never contain API keys, signing secrets, or anything else that grants
 * privilege on its own. It only contains: endpoint paths, timing constants,
 * storage keys, and page routes.
 *
 * Load this file FIRST on every auth page and every protected page, before
 * api.js / session.js / auth.js / routeGuard.js.
 * ───────────────────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  const AUTH_CONFIG = Object.freeze({
    /**
     * Base URL of the Google Apps Script Web App deployment that backs
     * this authentication module. Replace with your deployment's
     * `/exec` URL. See README.md → "Connecting the Apps Script backend".
     *
     * Left as a placeholder intentionally — this repo ships no working
     * backend URL. api.js will throw a clear error if this is not set.
     */
    API_BASE_URL: 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec',

    /**
     * Logical endpoint names. api.js maps these to `?action=<name>` query
     * parameters on the single Apps Script `doPost`/`doGet` entry point,
     * since Apps Script web apps expose one URL, not a REST router.
     * Adjust here — and nowhere else — if your backend uses different
     * action names.
     */
    ENDPOINTS: {
      SEND_OTP: 'sendOTP',
      VERIFY_OTP: 'verifyOTP',
      LOGOUT: 'logout',
      VALIDATE_SESSION: 'validateSession',
      REFRESH_SESSION: 'refreshSession',
      LOAD_PROFILE: 'loadProfile',
    },

    // ── Timing ────────────────────────────────────────────────────────────
    REQUEST_TIMEOUT_MS: 15_000,

    OTP_LENGTH: 6,
    OTP_EXPIRY_SECONDS: 300, // 5 minutes — must match backend TTL
    RESEND_COOLDOWN_SECONDS: 30,
    MAX_RESEND_ATTEMPTS: 3, // resends allowed per login attempt, then force restart
    MAX_VERIFY_ATTEMPTS: 5, // wrong-OTP guesses allowed before lockout

    PENDING_AUTH_TTL_MS: 10 * 60 * 1000, // how long a "we sent you a code" state survives a refresh

    SESSION_DURATION_DEFAULT_MS: 24 * 60 * 60 * 1000, // 24h — not remembered
    SESSION_DURATION_REMEMBERED_MS: 30 * 24 * 60 * 60 * 1000, // 30d — remembered device

    SILENT_REFRESH_INTERVAL_MS: 10 * 60 * 1000, // ping refreshSession every 10 min while active
    SILENT_REFRESH_MIN_REMAINING_MS: 5 * 60 * 1000, // don't bother refreshing if >5min already left after interval

    IDLE_WARNING_AFTER_MS: 14 * 60 * 1000, // show "are you still there" warning after 14 min idle
    IDLE_COUNTDOWN_SECONDS: 60, // then auto-logout after 60s unless extended
    // → effective idle logout ≈ 15 minutes of no interaction

    // ── Storage keys ─────────────────────────────────────────────────────
    // Namespaced to avoid collisions with the dashboard app or marketing site.
    STORAGE_KEYS: {
      SESSION: 'va_auth_session_v1', // { token, expiresAt, remembered, user }
      PENDING_AUTH: 'va_auth_pending_v1', // { email, remember, sentAt, resendCount }
      BROADCAST_LOGOUT: 'va_auth_logout_broadcast_v1', // write-only ping for cross-tab logout
    },

    // ── Routes ───────────────────────────────────────────────────────────
    // Relative to the site root. Adjust if your folder layout differs.
    ROUTES: {
      LOGIN: '/auth/login.html',
      VERIFY: '/auth/verify.html',
      DEFAULT_AFTER_LOGIN: '/dashboard.html',
      HOME: '/index.html',
    },

    // Pages that require an authenticated session. routeGuard.js checks the
    // current pathname against this list (matched by filename, so this
    // module works whether the site is served from a root domain or a
    // sub-path like /app/).
    PROTECTED_PAGES: [
      'dashboard.html',
      'billing.html',
      'reports.html',
      'downloads.html',
      'profile.html',
      'settings.html',
      'mission-control.html',
    ],
  });

  global.VA_AUTH_CONFIG = AUTH_CONFIG;
})(window);
