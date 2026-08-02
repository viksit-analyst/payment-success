// permissionCard.js — surfaces exactly what the broker account is allowed
// to do, so a missing permission is caught before a strategy activation
// attempt rather than surfacing as a cryptic order rejection later.

import { cardHeader, skeleton, bindCard } from './cardShell.js';

const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/></svg>`;

function chip(label, enabled) {
  return `
    <div class="perm-chip ${enabled ? 'is-enabled' : ''}">
      <span class="health-dot ${enabled ? 'ok' : ''}" style="background:${enabled ? '' : 'var(--border-default)'}"></span>
      ${label}
    </div>`;
}

function render({ permissions, brokerStatus }) {
  if (brokerStatus === 'NOT_CONNECTED') {
    return `${cardHeader('Permissions', '', icon)}<p style="font-size:var(--fs-xs); color:var(--text-tertiary);">Connect a broker to see permissions.</p>`;
  }
  if (!permissions) return `${cardHeader('Permissions', '', icon)}${skeleton(3)}`;

  return `
    ${cardHeader('Permissions', permissions.mode === 'LIVE' ? 'Live trading' : 'Read only', icon)}
    <div class="perm-grid">
      ${chip('Equity', permissions.equity)}
      ${chip('F&O', permissions.fno)}
      ${chip('Currency', permissions.currency)}
      ${chip('Commodity', permissions.commodity)}
      ${chip('API enabled', permissions.apiEnabled)}
      ${chip('Trading enabled', permissions.tradingEnabled)}
    </div>
  `;
}

export function mountPermissionCard(el) {
  return bindCard(el, render, (s) => ({ permissions: s.permissions, brokerStatus: s.brokerStatus }));
}
