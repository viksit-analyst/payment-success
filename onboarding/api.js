/* ==========================================================================
   VIKSIT ANALYST — ONBOARDING · API LAYER
   Vanilla ES2023. No dependencies. No build step.

   Talks to the same Google Apps Script Web App that app.js already calls
   for checkout (see SCRIPT_URL below — identical endpoint, same project).
   Every call follows the exact contract reverse-engineered from app.js's
   buy(): GET `${SCRIPT_URL}?action=<name>&<params>`, JSON response shaped
   `{ success: true, ...payload }` or `{ success: false, error: "..." }`.

   BACKEND CONTRACT — new `action` values this file expects the Apps
   Script project to implement. None of these existed before this pass;
   they're listed here (and in README.md) as the exact spec the backend
   needs to satisfy, since the Apps Script source itself lives in a
   separate project this handoff didn't include:

     action=getCustomer        &token=<sessionToken>
     action=getSubscription    &token=<sessionToken>
     action=getProgress        &token=<sessionToken>
     action=saveProgress       &token=<sessionToken>  [POST-style payload, see saveProgress()]
     action=getBrokerStatus    &token=<sessionToken>
     action=startBrokerAuth    &token=<sessionToken>&broker=upstox
     action=validateBroker     &token=<sessionToken>
     action=generateBotConfig  &token=<sessionToken>&strategy=<id>
     action=checkInfrastructure&token=<sessionToken>
     action=activateBot        &token=<sessionToken>
     action=completeOnboarding &token=<sessionToken>

   Every response envelope also carries `customerId` once authenticated,
   so the frontend never has to invent or store one itself.
   ========================================================================== */

const Api = (() => {
  'use strict';

  // Same Apps Script Web App project app.js already calls.
  const SCRIPT_URL =
    'https://script.google.com/macros/s/AKfycbxzbo25oQHBZRB-oZUgdtKiXo_R1EP0Gsu7Q5D_vGhgnzCowsLNBkEmUMC-YuwGRkxU/exec';

  const REQUEST_TIMEOUT_MS = 15000;

  /**
   * Session token — resolved once from the URL (the emailed
   * authentication link, per success.html) and held in memory for the
   * page's lifetime. Never written to localStorage/sessionStorage —
   * the site's established convention (see script.js's theme toggle
   * comment) is in-memory, session-scoped state only. "Resume later"
   * works because the emailed link IS the resumable bookmark; every
   * internal onboarding link carries ?token= forward.
   */
  let _cachedToken = null;

  function getSessionToken() {
    if (_cachedToken) return _cachedToken;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) _cachedToken = token;
    return _cachedToken;
  }

  class ApiError extends Error {
    constructor(message, { code, status } = {}) {
      super(message);
      this.name = 'ApiError';
      this.code = code || 'UNKNOWN';
      this.status = status || null;
    }
  }

  /**
   * Core request helper. GET-only, query-string params — matches
   * app.js's existing pattern exactly (Apps Script Web Apps handle
   * GET with query params more predictably across deployments than
   * POST bodies, which is presumably why app.js already does this).
   */
  async function request(action, params = {}) {
    const url = new URL(SCRIPT_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url.toString(), { signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new ApiError('The server took too long to respond.', { code: 'TIMEOUT' });
      }
      throw new ApiError('Network error — check your connection and try again.', { code: 'NETWORK' });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new ApiError(`Server error (${response.status})`, {
        code: 'HTTP_ERROR',
        status: response.status,
      });
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError('Received an invalid response from the server.', { code: 'BAD_JSON' });
    }

    if (!data || data.success !== true) {
      throw new ApiError((data && data.error) || 'Request failed.', {
        code: (data && data.errorCode) || 'REQUEST_FAILED',
      });
    }

    return data;
  }

  function requireToken() {
    const token = getSessionToken();
    if (!token) {
      throw new ApiError(
        'Your onboarding link is missing or expired. Check your email for the authentication link.',
        { code: 'NO_TOKEN' }
      );
    }
    return token;
  }

  // ------------------------------------------------------------------
  // Public API — one function per onboarding data need.
  // ------------------------------------------------------------------

  /** Customer identity + welcome-screen fields (name, email, phone, subscription expiry). */
  async function loadCustomer() {
    const token = requireToken();
    const data = await request('getCustomer', { token });
    return data.customer;
  }

  /** Subscription + purchased-plan details. */
  async function loadSubscription() {
    const token = requireToken();
    const data = await request('getSubscription', { token });
    return data.subscription;
  }

  /** Current onboarding progress: step, completed steps, timestamps, percent. */
  async function loadProgress() {
    const token = requireToken();
    const data = await request('getProgress', { token });
    return data.progress;
  }

  /**
   * Persist progress. Called by progressTracker.js after every step
   * transition — this is the "auto-save" mechanism, backend-side by
   * design (see file header).
   */
  async function saveProgress({ currentStep, completedSteps, progressPct }) {
    const token = requireToken();
    const data = await request('saveProgress', {
      token,
      currentStep,
      completedSteps: JSON.stringify(completedSteps),
      progressPct,
    });
    return data.progress;
  }

  /** Current broker connection status (used to render Step 3/4 on load/resume). */
  async function loadBrokerStatus() {
    const token = requireToken();
    const data = await request('getBrokerStatus', { token });
    return data.broker;
  }

  /**
   * Begins the Upstox OAuth handoff. Returns a redirect URL the caller
   * navigates the browser to; Upstox redirects back to
   * onboarding.html?token=...&step=broker-verify&oauth=success (or
   * ...&oauth=failed&reason=...) once the customer completes auth.
   */
  async function connectBroker(broker = 'upstox') {
    const token = requireToken();
    const data = await request('startBrokerAuth', { token, broker });
    return data.redirectUrl;
  }

  /** Runs the post-connection verification checklist (Step 4). */
  async function validateBroker() {
    const token = requireToken();
    const data = await request('validateBroker', { token });
    return data.checks; // { tradingEnabled, fnoEnabled, apiEnabled, margins, exchangePermissions, latencyMs }
  }

  /** Generates and stores the bot configuration for the allocated strategy (Step 6). */
  async function generateBotConfig(strategyId) {
    const token = requireToken();
    const data = await request('generateBotConfig', { token, strategy: strategyId });
    return data.config; // { strategy, broker, customerId, server, region, botVersion, status }
  }

  /** Infrastructure health check (Step 7). */
  async function checkInfrastructure() {
    const token = requireToken();
    const data = await request('checkInfrastructure', { token });
    return data.infrastructure; // { backend, vm, broker, api, scheduler, database, network, heartbeat }
  }

  /** Triggers bot activation (Step 9). Long-running on the backend — poll loadProgress() or re-call for status. */
  async function activateBot() {
    const token = requireToken();
    const data = await request('activateBot', { token });
    return data.activation; // { status: 'in_progress' | 'active' | 'failed', stages: {...} }
  }

  /** Marks onboarding complete — backend flips the flag that suppresses onboarding on the dashboard going forward. */
  async function completeOnboarding() {
    const token = requireToken();
    const data = await request('completeOnboarding', { token });
    return data.customer;
  }

  return {
    ApiError,
    getSessionToken,
    loadCustomer,
    loadSubscription,
    loadProgress,
    saveProgress,
    loadBrokerStatus,
    connectBroker,
    validateBroker,
    generateBotConfig,
    checkInfrastructure,
    activateBot,
    completeOnboarding,
  };
})();

export default Api;
