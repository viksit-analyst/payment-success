// connectionStatus.js
// Owns the polling loop that keeps brokerSession state fresh: connection
// status, account health, and bot heartbeat. Every card just subscribes to
// brokerSession.onChange() — nothing else needs to know a poll happened.

import {
  fetchBrokerStatus, fetchBrokerHealth, fetchBotStatus, verifyPermissions,
} from './brokerAPI.js';
import { getState, setState } from './brokerSession.js';
import { getConfig } from './utils.js';

let pollHandle = null;

async function pollOnce() {
  try {
    const status = await fetchBrokerStatus();
    setState({
      brokerId: status.brokerId,
      brokerName: status.brokerName,
      brokerStatus: status.brokerStatus,
      connectedAt: status.connectedAt,
      lastSync: new Date().toISOString(),
      profile: status.profile || getState().profile,
      tokenExpiry: status.tokenExpiry,
      autoLoginEnabled: !!status.autoLoginEnabled,
    });

    if (status.brokerStatus === 'NOT_CONNECTED') return;

    const [health, bot, permissions] = await Promise.allSettled([
      fetchBrokerHealth(),
      fetchBotStatus(),
      verifyPermissions(),
    ]);

    if (health.status === 'fulfilled') setState({ health: health.value });
    if (bot.status === 'fulfilled') setState({ bot: bot.value });
    if (permissions.status === 'fulfilled') setState({ permissions: permissions.value });
  } catch {
    // fetchBrokerStatus already surfaces a toast on hard failure; a single
    // missed poll shouldn't flip the whole dashboard into an error state.
  }
}

export function startPolling() {
  stopPolling();
  const { pollIntervalMs } = getConfig();
  pollOnce();
  pollHandle = setInterval(pollOnce, pollIntervalMs);
  document.addEventListener('visibilitychange', handleVisibility);
}

export function stopPolling() {
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = null;
  document.removeEventListener('visibilitychange', handleVisibility);
}

function handleVisibility() {
  // Pause polling in background tabs, refresh immediately on return —
  // avoids hammering the Apps Script quota for tabs nobody is looking at.
  if (document.hidden) {
    if (pollHandle) clearInterval(pollHandle);
  } else {
    pollOnce();
    const { pollIntervalMs } = getConfig();
    pollHandle = setInterval(pollOnce, pollIntervalMs);
  }
}

export { pollOnce as refreshNow };
