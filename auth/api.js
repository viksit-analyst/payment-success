/* ==========================================================================
   VIKSIT ANALYST — AUTH API CLIENT
   Plain global script — no import/export, no type="module". Matches the
   rest of the auth frontend (auth.js, login.js, verify.js, session.js,
   routeGuard.js), all classic <script> tags sharing the page's global
   scope.

   REWRITE NOTE — this version is grounded in the ACTUAL contracts of both
   sides, not assumptions:
     - Backend (AuthApi.gs/AuthService.gs) is authoritative and unchanged.
     - auth.js, routeGuard.js, session.js, login.js, verify.js already
       exist and are extensive, working modules — this file was rewritten
       to match THEM, not the other way around. Concretely, three things
       changed from an earlier draft of this file:

       1. ApiError is now (code, message) — every existing call site in
          auth.js/routeGuard.js constructs it that way
          (`new API.ApiError(API.ErrorCodes.X, 'message')`); this file was
          the one out of step, not them.
       2. validateSession()/logout()/me() now default to
          window.VA_SESSION.getToken() when called with no argument —
          routeGuard.js calls `API.validateSession()` and auth.js calls
          `API.logout()` with zero args throughout, meaning both already
          assume a session-aware client. An explicit token can still be
          passed to override.
       3. ErrorCodes now covers every code actually referenced across
          auth.js/routeGuard.js/login.js/verify.js — see the comment
          above the ErrorCodes object below for which ones the real
          backend can actually produce vs. which are client-side-only.

   REQUEST FORMAT — GET only, query-string params only, for two reasons
   (not just preference):
   1. CORS preflight avoidance — a GET with no custom headers/body is
      always a CORS "simple request."
   2. It's the only format the backend reads for these actions.
      AuthApi.gs's handleAuthApi_(e) is wired into Code.gs's doGet() only;
      doPost() is reserved for Razorpay webhooks and never reads action=.

   NOTE ON refreshSession — deliberately not implemented. The backend has
   no such action; SessionRepository.gs has no "extend expiry" method at
   all (createSession/findSession/validateSession/expireSession/
   cleanupExpiredSessions — nothing else). A session's expiry is fixed at
   login (24h, or 30d if remembered) and cannot be pushed out later. Code
   that wants "is my session still alive" should call validateSession(),
   not a nonexistent refresh. See the accompanying routeGuard.js fix for
   how the silent-refresh timer was adapted to re-validate instead of
   pretending to extend.
   ========================================================================== */

(function () {
  'use strict';

  const AUTH_REQUEST_TIMEOUT_MS = 15000;

  function getApiBaseUrl_() {
    const url = window.VA_AUTH_CONFIG && window.VA_AUTH_CONFIG.API_BASE_URL;
    if (!url) {
      throw new ApiError('CONFIG_ERROR', 'API_BASE_URL is not configured. Make sure config.js loads before api.js.');
    }
    return url;
  }

  /**
   * Resolves a token: explicit argument wins; otherwise falls back to
   * the current session's token via VA_SESSION (session.js). Throws a
   * clear, specific error if neither is available, rather than sending
   * a token-less request the backend will reject with a vaguer message.
   */
  function resolveToken_(explicitToken) {
    if (explicitToken) return explicitToken;
    const fromSession = window.VA_SESSION && window.VA_SESSION.getToken();
    if (fromSession) return fromSession;
    throw new ApiError('UNAUTHORIZED', 'No active session.');
  }

  /**
   * (code, message) — matches every existing call site in auth.js and
   * routeGuard.js. `.code` is always one of ErrorCodes below (or a
   * literal like 'PENDING_EXPIRED' that auth.js constructs itself and
   * never needed a shared constant for).
   */
  class ApiError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'ApiError';
      this.code = code || 'UNKNOWN';
    }
  }

  /**
   * Every code referenced anywhere in the auth frontend, split by where
   * it actually comes from:
   *
   * Produced by THIS file, from real transport/parsing failures:
   *   NETWORK_ERROR, TIMEOUT, SERVER_ERROR, INVALID_RESPONSE, CONFIG_ERROR
   *
   * Produced by THIS file, classified from AuthService.gs's actual
   * (stable, hand-read) message text — see sendOtp()/verifyOtp() below
   * for exactly which substrings map to which code. If AuthService.gs's
   * wording changes, classification silently falls back to
   * REQUEST_FAILED — message text still displays correctly either way,
   * only the specific UI branch (e.g. showLocked()) stops firing:
   *   EMAIL_NOT_FOUND, OTP_EXPIRED, OTP_INVALID, OTP_MAX_ATTEMPTS
   *
   * Never produced by this file — thrown locally BY auth.js itself
   * (client-side email validation, client-side resend counter) or by
   * routeGuard.js (local "no valid session" signal). Included here only
   * so `API.ErrorCodes.X` never resolves to undefined:
   *   INVALID_EMAIL, RESEND_LIMIT_REACHED, UNAUTHORIZED, SESSION_EXPIRED
   *
   * Referenced in auth.js's ERROR_COPY but not currently reachable —
   * the real backend has no rate-limiting/cooldown logic
   * (AuthService.gs enforces OTP_MAX_ATTEMPTS on verification only, no
   * per-email send throttle). Kept as constants so the lookup doesn't
   * break if that's added later:
   *   RESEND_TOO_SOON, RATE_LIMITED
   *
   * Generic fallback for any backend failure that doesn't match a more
   * specific classification above:
   *   REQUEST_FAILED
   */
  const ErrorCodes = Object.freeze({
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    SERVER_ERROR: 'SERVER_ERROR',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    CONFIG_ERROR: 'CONFIG_ERROR',
    EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',
    OTP_EXPIRED: 'OTP_EXPIRED',
    OTP_INVALID: 'OTP_INVALID',
    OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
    INVALID_EMAIL: 'INVALID_EMAIL',
    RESEND_LIMIT_REACHED: 'RESEND_LIMIT_REACHED',
    RESEND_TOO_SOON: 'RESEND_TOO_SOON',
    RATE_LIMITED: 'RATE_LIMITED',
    UNAUTHORIZED: 'UNAUTHORIZED',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    REQUEST_FAILED: 'REQUEST_FAILED',
  });

  async function request_(action, params) {
    params = params || {};

    const url = new URL(getApiBaseUrl_());
    url.searchParams.set('action', action);
    Object.keys(params).forEach(function (key) {
      const value = params[key];
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(function () { controller.abort(); }, AUTH_REQUEST_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new ApiError(ErrorCodes.TIMEOUT, 'That took too long. Please try again.');
      }
      throw new ApiError(ErrorCodes.NETWORK_ERROR, "We couldn't reach Viksit Analyst. Check your connection and try again.");
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new ApiError(ErrorCodes.SERVER_ERROR, 'Server error (' + response.status + ')');
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      throw new ApiError(ErrorCodes.INVALID_RESPONSE, 'Received an invalid response from the server.');
    }

    if (!data || data.success !== true) {
      // Default classification for any backend failure this action
      // doesn't specifically re-classify below.
      throw new ApiError(ErrorCodes.REQUEST_FAILED, (data && data.message) || 'Request failed.');
    }

    return data;
  }

  async function sendOtp(email, remember) {
    try {
      const data = await request_('sendOtp', { email: email });
      return { message: data.message };
    } catch (err) {
      // AuthService.sendOtp's one distinguishable failure mode, by exact
      // message text (see AuthService.gs: findActiveCustomer_ returning
      // null -> "No active subscription found.").
      if (err instanceof ApiError && err.code === ErrorCodes.REQUEST_FAILED
          && /no active subscription/i.test(err.message)) {
        throw new ApiError(ErrorCodes.EMAIL_NOT_FOUND, err.message);
      }
      throw err;
    }
  }

  async function verifyOtp(email, otp, rememberDevice) {
    try {
      const data = await request_('verifyOtp', {
        email: email,
        otp: otp,
        rememberDevice: rememberDevice ? 'true' : 'false',
      });
      return { token: data.token, expiry: data.expiry, customer: data.customer };
    } catch (err) {
      if (err instanceof ApiError && err.code === ErrorCodes.REQUEST_FAILED) {
        // Classified from AuthService.verifyOtp's exact, hand-read
        // message text. Order matters: check the more specific phrases
        // before the generic "Incorrect OTP." prefix.
        if (/expired/i.test(err.message)) {
          throw new ApiError(ErrorCodes.OTP_EXPIRED, err.message);
        }
        if (/too many incorrect attempts/i.test(err.message)) {
          throw new ApiError(ErrorCodes.OTP_MAX_ATTEMPTS, err.message);
        }
        if (/^incorrect otp/i.test(err.message) || /already been used/i.test(err.message)) {
          throw new ApiError(ErrorCodes.OTP_INVALID, err.message);
        }
        if (/no active subscription/i.test(err.message)) {
          throw new ApiError(ErrorCodes.EMAIL_NOT_FOUND, err.message);
        }
      }
      throw err;
    }
  }

  /**
   * Resolves with { valid, expiresAt, user, session } — routeGuard.js
   * reads .valid/.expiresAt/.user; anything else can read the raw
   * .session ({customerId, email, expiry}) directly. Throws (rather
   * than resolving { valid: false }) on an invalid/expired session —
   * routeGuard.js's own try/catch around this call handles that
   * identically to a { valid: false } return, so both shapes work, but
   * throwing matches how every other method here behaves.
   */
  async function validateSession(token) {
    const resolved = resolveToken_(token);
    const data = await request_('validateSession', { token: resolved });
    const session = data.session;
    return {
      valid: true,
      expiresAt: session.expiry,
      user: { customerId: session.customerId, email: session.email },
      session: session,
    };
  }

  async function logout(token) {
    const resolved = resolveToken_(token);
    const data = await request_('logout', { token: resolved });
    return { message: data.message };
  }

  /** Resolves with { customerId, name, email, bot } — the replacement for a previous loadProfile(). */
  async function me(token) {
    const resolved = resolveToken_(token);
    const data = await request_('me', { token: resolved });
    return data.customer;
  }

  window.VA_API = Object.freeze({
    ApiError: ApiError,
    ErrorCodes: ErrorCodes,

    sendOtp: sendOtp,
    sendOTP: sendOtp,

    verifyOtp: verifyOtp,
    verifyOTP: verifyOtp,

    validateSession: validateSession,
    logout: logout,
    me: me,
  });

})();
