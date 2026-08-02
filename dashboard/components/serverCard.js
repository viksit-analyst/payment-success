// serverCard.js — the Ubuntu Trading VM's own vitals, as reported by the
// backend's VM health proxy. Read-only; there is nothing to control here.

import { cardHeader, kvList, skeleton, bindCard } from './cardShell.js';

const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><circle cx="7" cy="7.5" r="0.8" fill="currentColor"/><circle cx="7" cy="16.5" r="0.8" fill="currentColor"/></svg>`;

function render({ bot, health }) {
  if (!bot && !health) return `${cardHeader('Server', '', icon)}${skeleton(3)}`;

  return `
    ${cardHeader('Server', bot?.server?.region || '', icon)}
    ${kvList([
      ['Server', `<span class="mono">${bot?.server?.name || '—'}</span>`],
      ['Status', health?.vmStatus === 'UP' ? '<span style="color:var(--color-success);">Operational</span>' : (health?.vmStatus || '—')],
      ['Latency', `<span class="mono">${bot?.latencyMs ?? '—'} ms</span>`],
    ])}
  `;
}

export function mountServerCard(el) {
  return bindCard(el, render, (s) => ({ bot: s.bot, health: s.health }));
}
