// accountCard.js — read-only identity fields returned by the broker's
// profile endpoint, proxied through the backend. Nothing here is editable.

import { cardHeader, kvList, skeleton, bindCard } from './cardShell.js';
import { escapeHtml } from '../js/utils.js';

const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" stroke-linecap="round"/></svg>`;

function render({ profile, brokerStatus }) {
  if (brokerStatus === 'NOT_CONNECTED') {
    return `${cardHeader('Account', '', icon)}<p style="font-size:var(--fs-xs); color:var(--text-tertiary);">No account linked yet.</p>`;
  }
  if (!profile) return `${cardHeader('Account', '', icon)}${skeleton(4)}`;

  return `
    ${cardHeader('Account', '', icon)}
    ${kvList([
      ['Registered name', escapeHtml(profile.registeredName || '—')],
      ['Client ID', `<span class="mono">${escapeHtml(profile.clientId || '—')}</span>`],
      ['User ID', `<span class="mono">${escapeHtml(profile.userId || '—')}</span>`],
      ['Exchanges', escapeHtml((profile.exchanges || []).join(', ') || '—')],
    ])}
  `;
}

export function mountAccountCard(el) {
  return bindCard(el, render, (s) => ({ profile: s.profile, brokerStatus: s.brokerStatus }));
}
