/**
 * auth.js
 * ─────────────────────────────────────────────────────────────────────────
 * The authentication flow controller. login.js and verify.js are thin DOM
 * bindings; ALL flow logic (validation, attempt counters, cooldowns, error
 * translation, session creation) lives here so it's testable and reused
 * identically by both pages.
 *
 * Architecture decision — OTP-only, no passwords:
 * This module deliberately implements email OTP + trusted-device sessions
 * instead of a password + forgot-password flow. See README.md →
 * "Architecture Decisions" for the full rationale. Practically, this means
 * there is no login(), forgotPassword(), or resetPassword() call in api.js —
 * sendOTP() + verifyOTP() cover the entire authentication surface.
 *
 * Depends on: config.js, api.js, session.js
 * Exposes:    window.VA_AUTH
 * ───────────────────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  const CONFIG = global.VA_AUTH_CONFIG;
  const API = global.VA_API;
  const SESSION = global.VA_SESSION;

  if (!CONFIG || !API || !SESSION) {
    throw new Error('[auth.js] Missing dependency — load config.js, api.js, session.js first.');
  }

  // ── Validation ───────────────────────────────────────────────────────
  // Deliberately conservative regex: good enough to catch typos before a
  // round trip, NOT a substitute for server-side validation. The backend
  // must re-validate everything here — never trust the client.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateEmail(rawEmail) {
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!email) return { valid: false, email, reason: 'Enter your email address.' };
    if (email.length > 254) return { valid: false, email, reason: 'That email address is too long.' };
    if (!EMAIL_RE.test(email)) return { valid: false, email, reason: 'Enter a valid email address.' };
    return { valid: true, email, reason: null };
  }

  function maskEmail(email) {
    const [local, domain] = String(email).split('@');
    if (!domain) return email;
    const visible = local.slice(0, Math.min(2, local.length));
    const maskedLocal = visible + '•'.repeat(Math.max(local.length - visible.length, 2));
    return `${maskedLocal}@${domain}`;
  }

  // ── Error translation ────────────────────────────────────────────────
  // Maps ApiError codes to calm, specific, non-alarming copy. Falls back
  // to the backend-provided message for anything not explicitly mapped,
  // so new backend error codes degrade gracefully instead of breaking.
  const ERROR_COPY = {
    [API.ErrorCodes.NETWORK_ERROR]: "We couldn't reach Viksit Analyst. Check your connection and try again.",
    [API.ErrorCodes.TIMEOUT]: 'That took too long. Please try again.',
    [API.ErrorCodes.SERVER_ERROR]: 'Something went wrong on our end. Please try again in a moment.',
    [API.ErrorCodes.INVALID_RESPONSE]: 'Something went wrong on our end. Please try again in a moment.',
    [API.ErrorCodes.CONFIG_ERROR]: 'Authentication isn\u2019t configured yet. Please contact support.',
    [API.ErrorCodes.EMAIL_NOT_FOUND]: 'We couldn\u2019t find an account with that email. Double-check it, or subscribe first.',
    [API.ErrorCodes.INVALID_EMAIL]: 'Enter a valid email address.',
    [API.ErrorCodes.OTP_EXPIRED]: 'This code has expired. Request a new one below.',
    [API.ErrorCodes.OTP_INVALID]: 'That code isn\u2019t right. Double-check and try again.',
    [API.ErrorCodes.OTP_MAX_ATTEMPTS]: 'Too many incorrect attempts. Please start over.',
    [API.ErrorCodes.RESEND_TOO_SOON]: 'Please wait a moment before requesting another code.',
    [API.ErrorCodes.RESEND_LIMIT_REACHED]: 'You\u2019ve requested too many codes. Please start over in a few minutes.',
    [API.ErrorCodes.RATE_LIMITED]: 'Too many attempts. Please wait a moment and try again.',
    [API.ErrorCodes.UNAUTHORIZED]: 'Your session has ended. Please sign in again.',
    [API.ErrorCodes.SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
  };

  function describeError(err) {
    if (err instanceof API.ApiError) {
      return ERROR_COPY[err.code] || err.message || 'Something went wrong. Please try again.';
    }
    return 'Something went wrong. Please try again.';
  }

  // ── Login flow (login.html) ─────────────────────────────────────────

  /**
   * Kicks off login: validates the email, requests an OTP, and stashes
   * pending-auth state for verify.html to pick up.
   * @param {string} rawEmail
   * @param {boolean} remember
   * @returns {Promise<{ email: string }>}
   */
  async function startLogin(rawEmail, remember) {
    const { valid, email, reason } = validateEmail(rawEmail);
    if (!valid) {
      throw new API.ApiError(API.ErrorCodes.INVALID_EMAIL, reason);
    }

    await API.sendOTP(email, remember);
    SESSION.setPendingAuth({ email, remember });
    return { email };
  }

  // ── Verify flow (verify.html) ────────────────────────────────────────

  /**
   * @returns {{ email: string, remember: boolean, resendCount: number } | null}
   */
  function getPendingLogin() {
    return SESSION.getPendingAuth();
  }

  /**
   * @param {string} otp
   * @returns {Promise<{ user: object }>}
   */
  async function submitOtp(otp) {
    const pending = SESSION.getPendingAuth();
    if (!pending) {
      throw new API.ApiError('PENDING_EXPIRED', 'Your sign-in attempt expired. Please start again.');
    }
    if (!/^\d{6}$/.test(otp)) {
      throw new API.ApiError(API.ErrorCodes.OTP_INVALID, 'Enter the 6-digit code.');
    }

    const result = await API.verifyOTP(pending.email, otp, pending.remember);

    SESSION.createSession({
      token: result.sessionToken,
      expiresAt: result.expiresAt,
      remembered: pending.remember,
      user: result.user || null,
    });
    SESSION.clearPendingAuth();

    return { user: result.user || null };
  }

  /**
   * Resends the OTP for the current pending login. Enforces the client-side
   * resend limit as a UX guard; the backend must enforce its own limit too.
   * @returns {Promise<void>}
   */
  async function resendOtp() {
    const pending = SESSION.getPendingAuth();
    if (!pending) {
      throw new API.ApiError('PENDING_EXPIRED', 'Your sign-in attempt expired. Please start again.');
    }
    if ((pending.resendCount || 0) >= CONFIG.MAX_RESEND_ATTEMPTS) {
      throw new API.ApiError(API.ErrorCodes.RESEND_LIMIT_REACHED, ERROR_COPY[API.ErrorCodes.RESEND_LIMIT_REACHED]);
    }

    await API.sendOTP(pending.email, pending.remember);
    SESSION.bumpPendingResendCount();
  }

  /** Abandons the current pending login (e.g. "use a different email"). */
  function cancelPendingLogin() {
    SESSION.clearPendingAuth();
  }

  // ── Logout ────────────────────────────────────────────────────────────

  /**
   * Logs out locally AND best-effort server-side, then redirects to login.
   * Local logout always succeeds even if the network call fails — a user
   * must always be able to log out.
   */
  async function logout({ redirect = true } = {}) {
    try {
      await API.logout();
    } finally {
      SESSION.clearSession();
      if (redirect) {
        global.location.href = CONFIG.ROUTES.LOGIN;
      }
    }
  }

  // ── Safe post-login redirect ─────────────────────────────────────────
  // Reads a `?redirect=` query param but only ever honors a same-origin,
  // relative path — never an absolute/external URL — to prevent this
  // becoming an open redirect.
  function resolveRedirectTarget() {
    const params = new URLSearchParams(global.location.search);
    const requested = params.get('redirect');

    if (requested && requested.startsWith('/') && !requested.startsWith('//')) {
      return requested;
    }
    return CONFIG.ROUTES.DEFAULT_AFTER_LOGIN;
  }

  global.VA_AUTH = Object.freeze({
    validateEmail,
    maskEmail,
    describeError,
    startLogin,
    getPendingLogin,
    submitOtp,
    resendOtp,
    cancelPendingLogin,
    logout,
    resolveRedirectTarget,
  });
})(window);
