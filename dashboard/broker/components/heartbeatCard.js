// heartbeatCard.js — a single, calm pulse. This is the "customers love
// seeing systems alive" moment from the design system, so it stays quiet
// and literal rather than decorative (no bouncing, no spinning — VDS).

import { cardHeader, skeleton, bindCard } from './cardShell.js';
import { isBotAlive } from '../js/vmConnector.js';
import { timeAgo } from '../js/utils.js';

const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h4l2 6 3-12 2 8 2-4h5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function render({ bot, brokerStatus }) {
  if (brokerStatus === 'NOT_CONNECTED') {
    return `${cardHeader('Heartbeat', '', icon)}<p style="font-size:var(--fs-xs); color:var(--text-tertiary);">No bot running.</p>`;
  }
  if (!bot) return `${cardHeader('Heartbeat', '', icon)}${skeleton(2)}`;

  const alive = isBotAlive(bot);
  return `
    ${cardHeader('Heartbeat', alive ? 'Bot is alive' : 'No recent heartbeat', icon)}
    <div style="display:flex; align-items:center; gap:12px;">
      <span class="heartbeat-pulse ${alive ? '' : 'is-flat'}"></span>
      <div>
        <div class="mono" style="font-size:var(--fs-md); font-weight:600;">${timeAgo(bot.heartbeatAt)}</div>
        <div style="font-size:var(--fs-2xs); color:var(--text-tertiary);">Expected every 60s</div>
      </div>
    </div>
  `;
}

export function mountHeartbeatCard(el) {
  const update = bindCard(el, render, (s) => ({ bot: s.bot, brokerStatus: s.brokerStatus }));
  // Liveness ("alive" vs "flat") depends on wall-clock time passing, not
  // just on state changes, so re-paint on a light interval too.
  let last = { bot: null, brokerStatus: 'NOT_CONNECTED' };
  const wrapped = (state) => { last = { bot: state.bot, brokerStatus: state.brokerStatus }; update(state); };
  setInterval(() => { el.innerHTML = render(last); }, 15000);
  return wrapped;
}
