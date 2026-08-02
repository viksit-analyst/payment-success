// healthCard.js — the "is anything about to break" card. Pulls straight
// from BrokerHealth.gs's response shape; this file only decides how to
// paint it.

import { cardHeader, skeleton, bindCard } from './cardShell.js';

const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h4l2 6 4-14 2 8h6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function dotClass(ok) {
  if (ok === true) return 'ok';
  if (ok === false) return 'fail';
  return 'warn';
}

function row(label, value, ok) {
  return `
    <div class="health-row">
      <span class="health-dot ${dotClass(ok)}"></span>
      <span class="health-label">${label}</span>
      <span class="health-value">${value}</span>
    </div>`;
}

function render({ health, brokerStatus }) {
  if (brokerStatus === 'NOT_CONNECTED') {
    return `${cardHeader('Connection Health', '', icon)}<p style="font-size:var(--fs-xs); color:var(--text-tertiary);">Nothing to monitor yet.</p>`;
  }
  if (!health) return `${cardHeader('Connection Health', '', icon)}${skeleton(5)}`;

  return `
    ${cardHeader('Connection Health', `Last checked ${new Date(health.checkedAt).toLocaleTimeString()}`, icon)}
    ${row('Broker API', health.brokerStatus === 'UP' ? 'Reachable' : 'Unreachable', health.brokerStatus === 'UP')}
    ${row('API latency', `${health.latencyMs ?? '—'} ms`, health.latencyMs != null && health.latencyMs < 800)}
    ${row('Server status', health.serverStatus || '—', health.serverStatus === 'UP')}
    ${row('Internet', health.internetStatus || '—', health.internetStatus === 'UP')}
    ${row('VM status', health.vmStatus || '—', health.vmStatus === 'UP')}
  `;
}

export function mountHealthCard(el) {
  return bindCard(el, render, (s) => ({ health: s.health, brokerStatus: s.brokerStatus }));
}
