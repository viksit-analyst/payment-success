// statusCard.js — the single, unambiguous "is trading possible right now"
// indicator. Deliberately simple: one badge, one line of context.

import { cardHeader, bindCard } from './cardShell.js';
import { statusToBadgeVariant, statusToLabel } from '../js/brokerValidator.js';

const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const CONTEXT = {
  TOKEN_VALID: 'Trading is enabled.',
  CONNECTED: 'Verifying account permissions…',
  TOKEN_PENDING: 'Finishing the broker handshake…',
  TOKEN_EXPIRED: 'Reconnect to resume trading.',
  LOGIN_REQUIRED: 'Your broker session needs a fresh login.',
  DISABLED: 'This connection has been disabled.',
  NOT_CONNECTED: 'Connect a broker to enable trading.',
};

function render({ brokerStatus }) {
  return `
    ${cardHeader('Broker Status', '', icon)}
    <span class="badge badge-${statusToBadgeVariant(brokerStatus)}" style="font-size:var(--fs-xs); padding:8px 14px;">
      <span class="status-dot"></span>${statusToLabel(brokerStatus)}
    </span>
    <p style="font-size:var(--fs-xs); color:var(--text-secondary); margin:0;">${CONTEXT[brokerStatus] || CONTEXT.NOT_CONNECTED}</p>
  `;
}

export function mountStatusCard(el) {
  return bindCard(el, render, (s) => ({ brokerStatus: s.brokerStatus }));
}
