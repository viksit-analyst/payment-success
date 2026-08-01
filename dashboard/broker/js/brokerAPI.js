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
  const url = new URL(apiBase, window.location.origin);
  url.searchParams.set('action', action);
  if (method === 'GET' && customerId) url.searchParams.set('customerId', customerId);

  const init = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
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
