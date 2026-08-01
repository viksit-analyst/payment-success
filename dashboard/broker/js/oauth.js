// oauth.js
// Drives the customer-facing half of the OAuth 2.0 dance. The browser never
// sees client_id/client_secret — it only asks the backend for a ready-made
// authorization URL, then later hands the returned `code` + `state` back to
// the backend to exchange. This file is broker-agnostic: it works the same
// whether brokerId is BR001 (Upstox) or a future BR00x adapter.

import { requestAuthUrl, exchangeAuthCode } from './brokerAPI.js';
import { setState } from './brokerSession.js';
import { showToast } from './utils.js';

const STATE_STORAGE_KEY = 'va_broker_oauth_state';
const BROKER_STORAGE_KEY = 'va_broker_oauth_broker';

/**
 * Step 1: customer clicks "Connect Upstox".
 * Redirects the full page (not a popup — Upstox does not support iframed
 * login) to the broker's authorization dialog.
 */
export async function beginConnect(brokerId = 'BR001') {
  setState({ brokerStatus: 'TOKEN_PENDING' });
  try {
    const { authUrl, state } = await requestAuthUrl(brokerId);
    // The state value is generated server-side (cryptographically random)
    // and validated again server-side on callback. We also mirror it into
    // sessionStorage purely so the UI can detect a stale/replayed redirect
    // before even calling the backend — defense in depth, not the source
    // of truth for CSRF protection.
    sessionStorage.setItem(STATE_STORAGE_KEY, state);
    sessionStorage.setItem(BROKER_STORAGE_KEY, brokerId);
    window.location.assign(authUrl);
  } catch (err) {
    setState({ brokerStatus: 'NOT_CONNECTED' });
    showToast('Could not start the broker connection. Please try again.', 'error');
  }
}

/**
 * Step 2: customer lands back on /broker.html?code=...&state=...&status=...
 * after approving (or denying) access on upstox.com.
 * Call this once, on page load, before rendering anything else.
 */
export async function handleCallbackIfPresent() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const deniedReason = params.get('error');

  if (!code && !deniedReason) return false; // not a callback load — nothing to do

  // Always scrub the URL immediately so the single-use code and state can
  // never be replayed via browser history, refresh, or a shared link.
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);

  if (deniedReason) {
    setState({ brokerStatus: 'NOT_CONNECTED' });
    showToast('Broker authorization was declined.', 'warning');
    return true;
  }

  const expectedState = sessionStorage.getItem(STATE_STORAGE_KEY);
  const brokerId = sessionStorage.getItem(BROKER_STORAGE_KEY) || 'BR001';
  sessionStorage.removeItem(STATE_STORAGE_KEY);
  sessionStorage.removeItem(BROKER_STORAGE_KEY);

  if (!expectedState || expectedState !== returnedState) {
    setState({ brokerStatus: 'NOT_CONNECTED' });
    showToast('This connection link looks like it was tampered with or reused. Please reconnect.', 'error');
    return true;
  }

  setState({ brokerStatus: 'TOKEN_PENDING' });
  try {
    // The backend re-validates state, exchanges the code server-to-server,
    // encrypts and stores the resulting tokens, then returns only status.
    const result = await exchangeAuthCode({ brokerId, code, state: returnedState });
    setState({
      brokerId,
      brokerStatus: result.brokerStatus,
      connectedAt: result.connectedAt,
      tokenExpiry: result.tokenExpiry,
    });
    showToast('Broker connected successfully.', 'success');
  } catch (err) {
    setState({ brokerStatus: 'LOGIN_REQUIRED' });
    showToast('We could not complete the broker connection. Please try again.', 'error');
  }
  return true;
}
