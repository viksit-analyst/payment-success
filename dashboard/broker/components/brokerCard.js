// brokerCard.js — the hero card: which broker is connected, and the
// primary connect/disconnect/reconnect action for it.

import { cardHeader, bindCard } from './cardShell.js';
import { statusToBadgeVariant, statusToLabel } from '../brokerValidator.js';
import { timeAgo, escapeHtml } from '../utils.js';
import { beginConnect } from '../oauth.js';
import { disconnectBroker } from '../brokerAPI.js';
import { setState } from '../brokerSession.js';

const brokerIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12h4l2-6 4 12 2-6h4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function actionButton(brokerStatus, brokerId) {
  if (brokerStatus === 'NOT_CONNECTED') {
    return `<button class="btn btn-primary" data-action="connect">Connect Upstox</button>`;
  }
  if (brokerStatus === 'LOGIN_REQUIRED' || brokerStatus === 'TOKEN_EXPIRED') {
    return `<button class="btn btn-accent" data-action="connect">Reconnect</button>`;
  }
  return `<button class="btn btn-secondary" data-action="disconnect">Disconnect</button>`;
}

function render({ brokerId, brokerName, brokerStatus, connectedAt, lastSync }) {
  return `
    ${cardHeader('Current Broker', brokerName ? `Connected ${timeAgo(connectedAt)}` : 'Not connected', brokerIcon)}
    <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
      <div style="display:flex; align-items:center; gap:14px;">
        <div style="width:44px;height:44px;border-radius:12px;background:var(--bg-sunken);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:700;">
          ${brokerName ? escapeHtml(brokerName[0]) : 'U'}
        </div>
        <div>
          <div style="font-family:var(--font-display);font-weight:600;font-size:var(--fs-md);">${escapeHtml(brokerName || 'Upstox')}</div>
          <div style="font-size:var(--fs-2xs);color:var(--text-tertiary);">Last sync ${timeAgo(lastSync)}</div>
        </div>
      </div>
      <span class="badge badge-${statusToBadgeVariant(brokerStatus)}"><span class="status-dot"></span>${statusToLabel(brokerStatus)}</span>
    </div>
    <div>${actionButton(brokerStatus, brokerId)}</div>
  `;
}

export function mountBrokerCard(el) {
  const update = bindCard(el, render, (s) => ({
    brokerId: s.brokerId, brokerName: s.brokerName, brokerStatus: s.brokerStatus,
    connectedAt: s.connectedAt, lastSync: s.lastSync,
  }));

  el.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'connect') await beginConnect('BR001');
    if (action === 'disconnect') {
      const result = await disconnectBroker('BR001');
      setState({ brokerStatus: result.brokerStatus, profile: null, permissions: null, tokenExpiry: null });
    }
  });

  return update;
}
