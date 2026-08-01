// tokenManager.js
// Manages token STATUS on the client — never the token itself. This module
// exists so the "Connection Health" card can show a countdown and so the
// dashboard can proactively ask the backend to refresh before expiry,
// without every other module re-implementing a timer.
//
// Broker reality check: Upstox access tokens are single-day and have no
// refresh_token grant — "refresh" for BR001 means the backend silently
// re-validates and, if needed, flips status to LOGIN_REQUIRED so the UI
// can prompt a one-click reconnect. Other adapters (future brokers) may
// implement a true silent refresh; this module doesn't need to know which.

import { refreshBroker } from './brokerAPI.js';
import { getState, setState, onChange } from './brokerSession.js';
import { formatCountdown } from './utils.js';

const REFRESH_LEAD_MS = 15 * 60 * 1000; // try to refresh 15 minutes before expiry
let timerHandle = null;
let refreshInFlight = false;

function msUntilExpiry() {
  const { tokenExpiry } = getState();
  if (!tokenExpiry) return null;
  return new Date(tokenExpiry).getTime() - Date.now();
}

export function getCountdownLabel() {
  const remaining = msUntilExpiry();
  if (remaining == null) return '—';
  return formatCountdown(remaining);
}

async function maybeRefresh() {
  const { brokerId, brokerStatus } = getState();
  if (!brokerId || brokerStatus !== 'TOKEN_VALID' || refreshInFlight) return;

  const remaining = msUntilExpiry();
  if (remaining == null || remaining > REFRESH_LEAD_MS) return;

  refreshInFlight = true;
  try {
    const result = await refreshBroker(brokerId);
    setState({ brokerStatus: result.brokerStatus, tokenExpiry: result.tokenExpiry });
  } catch {
    // Silent by design (brokerAPI already marks silent: true for this call).
    // If the backend couldn't refresh, brokerStatus will already reflect
    // TOKEN_EXPIRED / LOGIN_REQUIRED on the next brokerStatus poll.
  } finally {
    refreshInFlight = false;
  }
}

/** Starts the background loop. Call once from broker.js after first render. */
export function startTokenWatch() {
  stopTokenWatch();
  timerHandle = setInterval(maybeRefresh, 60 * 1000);
  maybeRefresh();
}

export function stopTokenWatch() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

// Re-evaluate immediately whenever session state changes (e.g. right after
// a fresh connect sets a new tokenExpiry).
onChange(() => maybeRefresh());
