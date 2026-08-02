/**
 * api.js
 * ─────────────────────────────────────────────────────────────────────────
 * The ONLY file in this module that calls `fetch()`. Every other module
 * (auth.js, session.js, routeGuard.js) goes through the functions exported
 * here. This keeps request construction, error shaping, timeouts, and auth
 * headers in exactly one place.
 *
 * Backend contract
 * ─────────────────
 * This module talks to a single Google Apps Script Web App endpoint using
 * `?action=<name>` query params (Apps Script exposes one URL, not a REST
 * router). Every response is expected to be JSON of the shape:
 *
 *   Success:  { success: true,  ...payload }
 *   Failure:  { success: false, code: 'SOME_ERROR_CODE', message: 'Human readable' }
 *
 * If your backend responds differently, this is the only file you need to
 * change — every caller in this module receives a normalized result.
 *
 * Depends on: config.js (window.VA_AUTH_CONFIG)
 * Exposes:    window.VA_API
 * ───────────────────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  const CONFIG = global.VA_AUTH_CONFIG;
  if (!CONFIG) {
    throw new Error('[api.js] VA_AUTH_CONFIG is missing — load config.js first.');
  }

  /**
   * Standard error shape thrown by every function in this file.
   * Callers should catch ApiError specifically to branch on `.code`.
   */
  class ApiError extends Error {
    constructor(code, message, status) {
      super(message || code);
      this.name = 'ApiError';
      this.code = code || 'UNKNOWN_ERROR';
      this.status = status ?? null;
    }
  }

  /**
   * Known, stable error codes the UI layer branches on. The backend is
   * expected to return one of these in `code` where applicable; anything
   * else surfaces as SERVER_ERROR with the backend's message preserved.
   */
  const ErrorCodes = Object.freeze({
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    SERVER_ERROR: 'SERVER_ERROR',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    UNAUTHORIZED: 'UNAUTHORIZED',
    EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',
    INVALID_EMAIL: 'INVALID_EMAIL',
    OTP_EXPIRED: 'OTP_EXPIRED',
    OTP_INVALID: 'OTP_INVALID',
    OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
    RESEND_TOO_SOON: 'RESEND_TOO_SOON',
    RESEND_LIMIT_REACHED: 'RESEND_LIMIT_REACHED',
    RATE_LIMITED: 'RATE_LIMITED',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    CONFIG_ERROR: 'CONFIG_ERROR',
  });

  function isPlaceholderBaseUrl() {
    return !CONFIG.API_BASE_URL || CONFIG.API_BASE_URL.includes('REPLACE_WITH_YOUR_DEPLOYMENT_ID');
  }

  /**
   * Core request function. Every exported API call funnels through here.
   *
   * @param {string} action       - one of CONFIG.ENDPOINTS values
   * @param {'GET'|'POST'} method
   * @param {object} [body]       - JSON-serializable payload for POST
   * @param {object} [opts]
   * @param {boolean} [opts.auth] - attach Authorization header from session token
   * @returns {Promise<object>}  - the parsed `payload` on success
   * @throws {ApiError}
   */
  async function request(action, method, body, opts = {}) {
    if (isPlaceholderBaseUrl()) {
      throw new ApiError(
        ErrorCodes.CONFIG_ERROR,
        'Authentication backend is not configured yet. Set API_BASE_URL in config.js to your Apps Script Web App URL.'
      );
    }

    const url = new URL(CONFIG.API_BASE_URL);
    url.searchParams.set('action', action);

    const headers = {};
    
    if (opts.auth) {
      // Lazily read the token so api.js has no hard dependency on session.js
      // load order beyond "loaded before this call is made".
      const token = global.VA_SESSION && global.VA_SESSION.getToken ? global.VA_SESSION.getToken() : null;
      if (!token) {
        throw new ApiError(ErrorCodes.UNAUTHORIZED, 'No active session.');
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        // Apps Script web apps do not support custom preflight-triggering
        // headers well with credentials; the session token travels in the
        // Authorization header above instead of a cookie.
        body: method === 'GET'
            ? undefined
            : new URLSearchParams(body || {}),
        signal: controller.signal,
        redirect: 'follow',
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new ApiError(ErrorCodes.TIMEOUT, 'The request took too long. Please check your connection and try again.');
      }
      throw new ApiError(ErrorCodes.NETWORK_ERROR, 'Could not reach the server. Please check your connection and try again.');
    }
    clearTimeout(timeout);

    let json;
    try {
      json = await response.json();
    } catch (err) {
      throw new ApiError(
        ErrorCodes.INVALID_RESPONSE,
        'The server returned an unexpected response.',
        response.status
      );
    }

    if (!response.ok || json.success !== true) {
      const code = json && json.code ? json.code : ErrorCodes.SERVER_ERROR;
      const message = (json && json.message) || 'Something went wrong. Please try again.';
      throw new ApiError(code, message, response.status);
    }

    // Strip the envelope, return just the payload.
    const { success, code, message, ...payload } = json;
    return payload;
  }

  // ── Public API surface ────────────────────────────────────────────────
  // Exactly the function set requested by the auth spec. Each function
  // does ONE thing: build the request and return a normalized payload.
  // All UI/flow logic (attempt counters, cooldowns, redirects) lives in
  // auth.js — not here.

  /**
   * POST /action=sendOTP
   * @param {string} email
   * @param {boolean} rememberDevice
   * @returns {Promise<{ otpExpiresInSeconds?: number, resendAvailableInSeconds?: number }>}
   */
    function sendOTP(email, rememberDevice) {
        const url = new URL(CONFIG.API_BASE_URL);
    
        url.searchParams.set("action", CONFIG.ENDPOINTS.SEND_OTP);
        url.searchParams.set("email", email);
        url.searchParams.set("rememberDevice", rememberDevice);
    
        return fetch(url)
            .then(r => r.json())
            .then(handleResponse);
    }

  /**
   * POST /action=verifyOTP
   * @param {string} email
   * @param {string} otp
   * @param {boolean} rememberDevice
   * @returns {Promise<{ sessionToken: string, expiresAt: string, user: object }>}
   */
  function verifyOTP(email, otp, rememberDevice) {
    return request(CONFIG.ENDPOINTS.VERIFY_OTP, 'POST', { email, otp, rememberDevice: !!rememberDevice });
  }

  /**
   * POST /action=logout — best-effort server-side session invalidation.
   * Callers should clear local session state regardless of outcome.
   */
  function logout() {
    return request(CONFIG.ENDPOINTS.LOGOUT, 'POST', {}, { auth: true }).catch(() => {
      // Logout must never block the user from being logged out locally.
      return {};
    });
  }

  /**
   * GET /action=validateSession — confirms the current token is still
   * valid server-side. Never trust the locally-stored expiry alone for
   * granting access to protected content.
   * @returns {Promise<{ valid: boolean, expiresAt?: string, user?: object }>}
   */
  function validateSession() {
    return request(CONFIG.ENDPOINTS.VALIDATE_SESSION, 'GET', undefined, { auth: true });
  }

  /**
   * POST /action=refreshSession — extends / rotates the current session.
   * @returns {Promise<{ sessionToken: string, expiresAt: string }>}
   */
  function refreshSession() {
    return request(CONFIG.ENDPOINTS.REFRESH_SESSION, 'POST', {}, { auth: true });
  }

  /**
   * GET /action=loadProfile
   * @returns {Promise<{ user: object }>}
   */
  function loadProfile() {
    return request(CONFIG.ENDPOINTS.LOAD_PROFILE, 'GET', undefined, { auth: true });
  }

  global.VA_API = Object.freeze({
    ErrorCodes,
    ApiError,
    sendOTP,
    verifyOTP,
    logout,
    validateSession,
    refreshSession,
    loadProfile,
  });
})(window);
