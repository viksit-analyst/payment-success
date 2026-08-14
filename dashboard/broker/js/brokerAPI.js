// brokerAPI.js
// The ONE place that knows how to talk to the backend. Every other module
// calls through here — never fetch() directly elsewhere (VABR: no duplicated
// fetch code). Speaks the VADS API Response Standard:
//   { success, timestamp, version, data, message, error }
//
// IMPORTANT: this layer never receives, stores, or forwards a broker access
// token or refresh token. The backend keeps those server-side (see
// TokenStore.gs). The browser only ever sees derived, non-secret status.

import { getConfig, showToast } from './utils.js';

class BrokerApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'BrokerApiError';
    this.code = code || 'ERR000';
    this.status = status;
  }
}

async function callBackend(action, { method = 'GET', body, silent = false } = {}) {
  const { apiBase, customerId, sessionToken } = getConfig();

  // M2 fix: previously apiBase silently defaulted to '/api' (see
  // utils.js#getConfig) and this just fetch()'d it like anything else —
  // the resulting failure was indistinguishable from a real, temporary
  // network blip. Fail fast with a specific message instead.
  if (!apiBase) {
    if (!silent) showToast('Broker backend isn\u2019t configured for this session. Contact support if this persists.', 'error');
    throw new BrokerApiError('apiBase not configured', 'ERR_NOT_CONFIGURED');
  }

  const url = new URL(apiBase, window.location.origin);
  url.searchParams.set('action', action);
  // AUDIT FIX: Apps Script's doGet(e)/doPost(e) never exposes custom HTTP
  // headers (see BrokerRouter.gs authenticateRequest_, and
  // PaymentWebhookHandler.gs's own note on this same platform limitation)
  // — an `Authorization` header was silently invisible server-side, so
  // every call here was failing auth. BrokerRouter.gs actually reads the
  // token from e.parameter.authorization, so it has to travel as a query
  // param instead.
  if (sessionToken) url.searchParams.set('authorization', sessionToken);
  if (method === 'GET' && customerId) url.searchParams.set('customerId', customerId);

  const init = {
    method,
    headers: {
      // AUDIT FIX: 'application/json' is not a CORS-safelisted
      // Content-Type, so it forces a preflight OPTIONS request — which
      // Apps Script Web Apps cannot answer (no doOptions handler, by
      // platform design), so the browser blocked every one of these
      // calls before it ever reached Google's servers. text/plain keeps
      // this a "simple request" (no preflight); BrokerRouter.gs already
      // just JSON.parses the raw body regardless of the declared
      // Content-Type, so this is safe.
      'Content-Type': 'text/plain;charset=utf-8',
    },
  };
  if (method !== 'GET') {
    init.body = JSON.stringify({ customerId, ...body });
  }

  let response;
  try {
    response = await fetch(url.toString(), init);
  } catch (networkErr) {
    if (!silent) showToast('Network error reaching Viksit Analyst servers. Retrying automatically.', 'error');
    throw new BrokerApiError('Network failure', 'ERR_NETWORK');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new BrokerApiError('Malformed response from server', 'ERR_PARSE', response.status);
  }

  if (!response.ok || payload.success === false) {
    const message = payload?.message || 'Request failed';
    if (!silent) showToast(message, 'error');
    throw new BrokerApiError(message, payload?.error?.code, response.status);
  }

  return payload.data;
}

/* -------------------------------------------------------------------- */
/*  Connection lifecycle                                                 */
/* -------------------------------------------------------------------- */

/** Returns { brokerId, brokerStatus, connectedAt, profile, permissions, health } */
export function fetchBrokerStatus(opts) {
  return callBackend('brokerStatus', { method: 'GET', ...opts });
}

/** Server builds the OAuth URL (client_id / redirect_uri never touch the browser bundle). */
export function requestAuthUrl(brokerId = 'BR001') {
  return callBackend('brokerAuthUrl', { method: 'POST', body: { brokerId } });
}

/** Exchanges an authorization code the browser received on the OAuth callback redirect. */
export function exchangeAuthCode({ brokerId, code, state }) {
  return callBackend('brokerExchangeToken', { method: 'POST', body: { brokerId, code, state } });
}

export function disconnectBroker(brokerId = 'BR001') {
  return callBackend('brokerDisconnect', { method: 'POST', body: { brokerId } });
}

/**
 * Submits Upstox login credentials for automated daily reconnection.
 * See BrokerRouter.gs's brokerEnableAutoLogin case / TokenStore.gs's
 * enableAutoLogin_ — this is a SEPARATE, explicit-consent action from
 * requestAuthUrl()/exchangeAuthCode() above, not a replacement wired
 * into the same flow. `payload` = { mobile, pin, totpSecret,
 * apiKey, apiSecret, redirectUri }.
 */
export function enableAutoLogin(payload, brokerId = 'BR001') {
  return callBackend('brokerEnableAutoLogin', { method: 'POST', body: { brokerId, ...payload } });
}

/** Clears all stored auto-login credentials server-side (see TokenStore.gs's disableAutoLogin_). */
export function disableAutoLogin(brokerId = 'BR001') {
  return callBackend('brokerDisableAutoLogin', { method: 'POST', body: { brokerId } });
}

export function refreshBroker(brokerId = 'BR001') {
  return callBackend('brokerRefresh', { method: 'POST', body: { brokerId }, silent: true });
}

/* -------------------------------------------------------------------- */
/*  Read-only account data (all proxied — backend calls the broker adapter) */
/* -------------------------------------------------------------------- */

export function fetchProfile() { return callBackend('brokerProfile', { silent: true }); }
export function fetchFunds() { return callBackend('brokerFunds', { silent: true }); }
export function fetchHoldings() { return callBackend('brokerHoldings', { silent: true }); }
export function fetchPositions() { return callBackend('brokerPositions', { silent: true }); }
export function fetchOrders() { return callBackend('brokerOrders', { silent: true }); }
export function fetchMargins() { return callBackend('brokerMargins', { silent: true }); }
export function getMarketStatus() { return callBackend('marketStatus', { silent: true }); }
export function verifyPermissions() { return callBackend('brokerPermissions', { silent: true }); }

/* -------------------------------------------------------------------- */
/*  Health / VM / heartbeat                                              */
/* -------------------------------------------------------------------- */

export function fetchBrokerHealth() { return callBackend('brokerHealth', { silent: true }); }
export function fetchBotStatus() { return callBackend('botStatus', { silent: true }); }

/* -------------------------------------------------------------------- */
/*  Strategy activation                                                  */
/* -------------------------------------------------------------------- */

export function activateStrategy(strategyId) {
  return callBackend('strategyActivate', { method: 'POST', body: { strategyId } });
}

export function deactivateStrategy(strategyId) {
  return callBackend('strategyDeactivate', { method: 'POST', body: { strategyId } });
}

/* -------------------------------------------------------------------- */
/*  Automated daily reconnection (explicit opt-in — see README security  */
/*  notes before wiring this up for real customers)                      */
/* -------------------------------------------------------------------- */

export function enableAutoLogin({ totpSecret, pin }) {
  return callBackend('brokerEnableAutoLogin', { method: 'POST', body: { totpSecret, pin } });
}

export function disableAutoLogin() {
  return callBackend('brokerDisableAutoLogin', { method: 'POST' });
}

export { BrokerApiError };

