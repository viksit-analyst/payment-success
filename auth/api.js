/* ==========================================================================
   VIKSIT ANALYST — AUTH API CLIENT
   Plain global script — no import/export, no type="module". Matches the
   rest of the auth frontend (auth.js, login.js, verify.js, session.js),
   which are all classic <script> tags sharing the page's global scope.

   Talks to the already-deployed Apps Script backend's five auth actions
   (see AuthApi.gs): sendOtp, verifyOtp, validateSession, logout, me.
   The backend is fixed and out of scope here — every call below is
   shaped to match what AuthApi.gs actually reads and returns.

   REQUEST FORMAT — GET only, query-string params only. Two things force
   this, not just preference:

   1. CORS preflight avoidance. A GET request with no custom headers and
      no body is always a CORS "simple request" — never triggers an
      OPTIONS preflight. Apps Script Web Apps don't handle OPTIONS, so a
      preflighted request just fails.
   2. It's the only format the backend actually reads for these actions.
      AuthApi.gs's own header is explicit: handleAuthApi_(e) is called
      "from inside Code.gs's existing doGet()" — these five actions are
      wired to GET only. Code.gs's doPost() is reserved exclusively for
      Razorpay webhook events (EVENT_HANDLERS keyed by event name, not
      by e.parameter.action) and never reads action= at all. A POST here
      wouldn't be routed anywhere — GET is the only path that reaches
      the backend as deployed, not a style choice.

   CONFIG — the deployment URL comes from window.VA_AUTH_CONFIG.API_BASE_URL
   (config.js), not hardcoded here. Redeploying Apps Script means updating
   one file, not hunting through every script that calls the backend.

   PUBLIC SURFACE — window.VA_API. sendOtp/verifyOtp exposed under both
   their backend-matching names and the sendOTP/verifyOTP spelling the
   existing frontend already calls — JS is case-sensitive and rewriting
   every caller wasn't worth it for a casing difference. No refreshSession
   (the backend has no such action). No loadProfile — replaced by me(),
   matching the backend's actual action name instead of an invented one.
   ========================================================================== */

(function () {
  'use strict';

  const AUTH_REQUEST_TIMEOUT_MS = 15000;

  /**
   * Every `.code` value ApiError actually throws in this file — nothing
   * more. Not adding a placeholder like INVALID_EMAIL here: this client
   * does no local email/OTP format validation of its own, it just
   * forwards to the backend, which validates server-side and returns a
   * plain message (AuthService.sendOtp: "Email is required.", "No
   * active subscription found.", etc.), not a code. If auth.js branches
   * on API.ErrorCodes.INVALID_EMAIL specifically, that's client-side
   * validation logic that doesn't exist yet anywhere in this file —
   * happy to add it, but it needs to actually do something, not just
   * exist as an unused constant.
   */
   const ErrorCodes = Object.freeze({
   
     NETWORK: 'NETWORK',
     TIMEOUT: 'TIMEOUT',
     HTTP_ERROR: 'HTTP_ERROR',
     BAD_JSON: 'BAD_JSON',
     REQUEST_FAILED: 'REQUEST_FAILED',
     CONFIG_MISSING: 'CONFIG_MISSING',
   
     INVALID_EMAIL: 'INVALID_EMAIL',
     EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',
     OTP_INVALID: 'OTP_INVALID',
     OTP_EXPIRED: 'OTP_EXPIRED',
     OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
     SESSION_EXPIRED: 'SESSION_EXPIRED',
     UNAUTHORIZED: 'UNAUTHORIZED',
     RATE_LIMITED: 'RATE_LIMITED',
     RESEND_TOO_SOON: 'RESEND_TOO_SOON',
     RESEND_LIMIT_REACHED: 'RESEND_LIMIT_REACHED'
   
   });

  /**
   * Resolves the Apps Script Web App URL from config.js each time it's
   * needed (not cached at script-load time) so load order mistakes fail
   * with a clear message instead of a broken "undefined/exec" URL.
   */
  function getApiBaseUrl_() {
    const url = window.VA_AUTH_CONFIG && window.VA_AUTH_CONFIG.API_BASE_URL;
    if (!url) {
      throw new ApiError(
        'API_BASE_URL is not configured. Make sure config.js loads before api.js.',
        { code: 'CONFIG_MISSING' }
      );
    }
    return url;
  }

  /**
   * Thrown for every failure this module surfaces — network/timeout,
   * non-OK HTTP status, malformed JSON, and business-level failures the
   * backend reports as { success: false, message }. Callers catch one
   * error type regardless of which layer failed and read `.message` for
   * display; `.code` is available when a caller wants to branch on
   * failure kind instead of just showing the message.
   */
  class ApiError extends Error {
    constructor(message, options) {
      options = options || {};
      super(message);
      this.name = 'ApiError';
      this.code = options.code || 'UNKNOWN';
      this.status = options.status || null;
    }
  }

  /**
   * Core GET request helper. Every public method below funnels through
   * this — one place enforces "GET, query string only, no custom
   * headers" so a future edit can't accidentally reintroduce a
   * preflight-triggering request shape.
   */
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
      // No headers object, no body -> guaranteed CORS-simple GET.
      response = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new ApiError('The server took too long to respond.', { code: 'TIMEOUT' });
      }
      throw new ApiError('Network error — check your connection and try again.', { code: 'NETWORK' });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new ApiError('Server error (' + response.status + ')', {
        code: 'HTTP_ERROR',
        status: response.status,
      });
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      throw new ApiError('Received an invalid response from the server.', { code: 'BAD_JSON' });
    }

    if (!data || data.success !== true) {
      // AuthApi.gs uses `message` for every failure case (not `error`,
      // which other actions in Code.gs use) — matched exactly here.
      throw new ApiError((data && data.message) || 'Request failed.', { code: 'REQUEST_FAILED' });
    }

    return data;
  }

  /**
   * Starts login for an existing, ACTIVE customer. Resolves with the
   * backend's confirmation message; throws ApiError (e.g. "No active
   * subscription found.") otherwise.
   */
  async function sendOtp(email) {
    const data = await request_('sendOtp', { email: email });
    return { message: data.message };
  }

  /**
   * Completes login. Resolves with exactly what AuthApi.gs's
   * authVerifyOtpApi_ returns on success: { token, expiry, customer }
   * where customer is { customerId, name, email, bot }. Throws ApiError
   * with the backend's message on incorrect/expired/exhausted OTP.
   */
  async function verifyOtp(email, otp, rememberDevice) {
    const data = await request_('verifyOtp', {
      email: email,
      otp: otp,
      rememberDevice: rememberDevice ? 'true' : 'false',
    });
    return { token: data.token, expiry: data.expiry, customer: data.customer };
  }

  /**
   * Checks whether a session token is currently valid. Resolves with
   * { customerId, email, expiry } (note: `session`, not `customer` — the
   * backend deliberately returns a narrower shape here than me() does).
   * Throws ApiError if invalid/expired rather than returning a falsy value.
   */
  async function validateSession(token) {
    const data = await request_('validateSession', { token: token });
    return data.session;
  }

  /** Explicit logout. Resolves with the backend's confirmation message. */
  async function logout(token) {
    const data = await request_('logout', { token: token });
    return { message: data.message };
  }

  /**
   * Resolves a session token to the customer's public profile —
   * { customerId, name, email, bot }. Replacement for the previous
   * loadProfile(); matches the backend's actual action name (`me`).
   */
  async function me(token) {
    const data = await request_('me', { token: token });
    return data.customer;
  }

  window.VA_API = Object.freeze({
    ApiError: ApiError,
    ErrorCodes: ErrorCodes,

    sendOtp: sendOtp,
    sendOTP: sendOtp, // existing frontend (login.js/verify.js) calls this casing

    verifyOtp: verifyOtp,
    verifyOTP: verifyOtp, // same — kept so nothing else needs to change

    validateSession: validateSession,
    logout: logout,
    me: me,
  });

})();
