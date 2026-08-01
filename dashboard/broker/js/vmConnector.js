// vmConnector.js
// The browser never talks to the Ubuntu VM directly — there is no public
// endpoint for it, and there shouldn't be. This module is a thin, named
// wrapper around the backend actions that themselves proxy to the VM
// (see VMConnector.gs), so the rest of the frontend can say
// "start the bot" instead of remembering a raw action string.

import { fetchBotStatus, activateStrategy, deactivateStrategy } from './brokerAPI.js';
import { getState, setState } from './brokerSession.js';
import { showToast } from './utils.js';

/** Pulls the latest heartbeat/latency snapshot for the customer's bot. */
export async function refreshBotStatus() {
  const bot = await fetchBotStatus();
  setState({ bot });
  return bot;
}

/**
 * Sends the customer's chosen strategy to the VM via the backend, which
 * writes strategy.json into the customer's VM folder and signals the
 * scheduler to start the process. See ConfigGenerator.gs + VMConnector.gs.
 */
export async function startBot(strategyId) {
  setState({ bot: { ...getState().bot, status: 'STARTING' } });
  try {
    const result = await activateStrategy(strategyId);
    setState({ bot: result.bot });
    showToast('Strategy activated. The bot will pick up its config within a minute.', 'success');
    return result;
  } catch (err) {
    setState({ bot: { ...getState().bot, status: 'FAILED' } });
    throw err;
  }
}

export async function stopBot(strategyId) {
  setState({ bot: { ...getState().bot, status: 'STOPPING' } });
  try {
    const result = await deactivateStrategy(strategyId);
    setState({ bot: result.bot });
    showToast('Strategy deactivated.', 'info');
    return result;
  } catch (err) {
    // Leave prior status in place; the next poll will reconcile.
    throw err;
  }
}

/** True if the VM has sent a heartbeat within the expected cadence. */
export function isBotAlive(bot, maxAgeMs = 90 * 1000) {
  if (!bot?.heartbeatAt) return false;
  return Date.now() - new Date(bot.heartbeatAt).getTime() < maxAgeMs;
}
