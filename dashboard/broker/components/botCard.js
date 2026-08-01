// botCard.js — the execution bot's own status, separate from broker
// connectivity: a broker can be TOKEN_VALID while the bot itself is
// stopped, starting, or failed, and this card is the one place that
// distinction is visible.

import { cardHeader, bindCard } from './cardShell.js';
import { stopBot } from '../vmConnector.js';
import { getSelectedStrategyId } from '../strategyActivation.js';

const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9h6v6H9z"/></svg>`;

const STATUS_COPY = {
  RUNNING: { label: 'Running', variant: 'connected' },
  STARTING: { label: 'Starting…', variant: 'reconnecting' },
  STOPPING: { label: 'Stopping…', variant: 'reconnecting' },
  STOPPED: { label: 'Stopped', variant: 'disconnected' },
  FAILED: { label: 'Failed to start', variant: 'error' },
};

function render({ bot, brokerStatus }) {
  if (brokerStatus === 'NOT_CONNECTED') {
    return `${cardHeader('Bot', '', icon)}<p style="font-size:var(--fs-xs); color:var(--text-tertiary);">Connect a broker, then activate a strategy below to start the bot.</p>`;
  }
  if (!bot) {
    return `${cardHeader('Bot', '', icon)}<p style="font-size:var(--fs-xs); color:var(--text-tertiary);">No strategy activated yet.</p>`;
  }

  const status = STATUS_COPY[bot.status] || STATUS_COPY.STOPPED;
  return `
    ${cardHeader('Bot', bot.activeStrategy ? `Running ${bot.activeStrategy}` : 'Idle', icon)}
    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
      <span class="badge badge-${status.variant}"><span class="status-dot"></span>${status.label}</span>
      ${bot.status === 'RUNNING' ? '<button class="btn btn-secondary" data-action="stop-bot">Stop</button>' : ''}
    </div>
  `;
}

export function mountBotCard(el) {
  const update = bindCard(el, render, (s) => ({ bot: s.bot, brokerStatus: s.brokerStatus }));

  el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-action="stop-bot"]')) {
      const strategyId = getSelectedStrategyId();
      if (strategyId) await stopBot(strategyId);
    }
  });

  return update;
}
