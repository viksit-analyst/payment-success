// strategyActivation.js
// Orchestrates "customer picks a strategy -> activate -> VM starts the bot".
// Talks to vmConnector.js for the actual transport and brokerValidator.js
// for the gating rules; the strategyCard component only renders what this
// module tells it to.

import { startBot, stopBot } from './vmConnector.js';
import { validateActivation, validateStrategyRequirements } from './brokerValidator.js';
import { getState } from './brokerSession.js';
import { showToast } from './utils.js';

export const STRATEGIES = [
  { id: 'STR001', name: 'IVRV', tagline: 'Volatility', color: 'var(--color-ivrv)' },
  { id: 'STR002', name: 'Gamma Flip', tagline: 'Momentum', color: 'var(--color-gamma)' },
  { id: 'STR003', name: 'VWAP', tagline: 'Institutional Team', color: 'var(--color-vwap)' },
];

let selectedStrategyId = null;

export function getSelectedStrategyId() {
  return selectedStrategyId;
}

export function selectStrategy(strategyId) {
  selectedStrategyId = strategyId;
}

/**
 * Runs every gate before hitting the network: subscription, broker token
 * validity, broker-account permissions, then strategy-specific permission
 * requirements (VABR Execution Rules order: Risk -> Subscription -> Broker
 * -> Margin -> Order, here scoped to the activation-time subset).
 */
export function canActivate(strategyId) {
  const { brokerStatus, permissions, subscriptionStatus } = getState();
  const base = validateActivation({ brokerStatus, permissions, subscriptionStatus });
  if (!base.allowed) return base;
  return validateStrategyRequirements(strategyId, permissions);
}

export async function activate(strategyId) {
  const check = canActivate(strategyId);
  if (!check.allowed) {
    showToast(check.reason, 'warning');
    return null;
  }
  return startBot(strategyId);
}

export async function deactivate(strategyId) {
  return stopBot(strategyId);
}
