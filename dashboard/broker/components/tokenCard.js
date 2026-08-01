// tokenCard.js — shows token STATUS and a countdown only. The actual
// token value is never available to render, by construction (there is no
// field for it anywhere in brokerSession's state shape).

import { cardHeader, kvList, skeleton } from './cardShell.js';
import { getCountdownLabel } from '../tokenManager.js';
import { enableAutoLogin, disableAutoLogin } from '../brokerAPI.js';
import { setState } from '../brokerSession.js';
import { showToast, escapeHtml } from '../utils.js';

function autoLoginSection(autoLoginEnabled) {
  if (autoLoginEnabled) {
    return `
      <div class="kv-row"><dt>Automatic daily login</dt><dd style="color:var(--color-success);">Enabled</dd></div>
      <button class="btn btn-ghost" data-action="disable-auto-login" style="font-size:var(--fs-2xs);">Turn off</button>
    `;
  }
  return `
    <details style="font-size:var(--fs-2xs);">
      <summary style="cursor:pointer; color:var(--text-secondary);">Set up automatic daily login</summary>
      <p style="color:var(--text-tertiary); margin:8px 0;">
        Upstox tokens expire every day, so by default you'll reconnect with one click each morning.
        Automatic login instead stores your TOTP secret and PIN (encrypted) so Viksit Analyst can log in
        for you — this is a materially higher trust level than a token alone, since it can fully sign in
        as you. Only enable this if you understand and accept that trade-off.
      </p>
      <input type="text" data-field="totp-secret" placeholder="Authenticator TOTP secret" style="width:100%; margin-bottom:6px;" />
      <input type="password" data-field="pin" placeholder="4-digit Upstox PIN" style="width:100%; margin-bottom:6px;" />
      <button class="btn btn-secondary" data-action="enable-auto-login">Enable</button>
    </details>
  `;
}

const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>`;

function render({ brokerStatus, tokenExpiry, autoLoginEnabled }) {
  if (brokerStatus === 'NOT_CONNECTED') {
    return `${cardHeader('Token', '', icon)}<p style="font-size:var(--fs-xs); color:var(--text-tertiary);">No active session.</p>`;
  }
  if (!tokenExpiry) return `${cardHeader('Token', '', icon)}${skeleton(2)}`;

  const expired = new Date(tokenExpiry).getTime() <= Date.now();
  return `
    ${cardHeader('Token', 'Encrypted at rest — never shown here or anywhere in the browser', icon)}
    ${kvList([
      ['Expires in', expired ? '<span style="color:var(--color-error);">expired</span>' : `<span class="mono">${getCountdownLabel()}</span>`],
      ['Expiry (local time)', `<span class="mono">${new Date(tokenExpiry).toLocaleString()}</span>`],
    ])}
    ${autoLoginSection(autoLoginEnabled)}
  `;
}

export function mountTokenCard(el) {
  // Deliberately does NOT use cardShell's bindCard memoization: the
  // countdown needs to visibly tick down once a minute even when nothing
  // in brokerSession has actually changed.
  let lastState = { brokerStatus: 'NOT_CONNECTED', tokenExpiry: null, autoLoginEnabled: false };
  const paint = () => { el.innerHTML = render(lastState); };

  setInterval(paint, 60000);

  el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-action="enable-auto-login"]')) {
      const totpSecret = el.querySelector('[data-field="totp-secret"]')?.value?.trim();
      const pin = el.querySelector('[data-field="pin"]')?.value?.trim();
      if (!totpSecret || !pin) { showToast('Enter both the TOTP secret and PIN.', 'warning'); return; }
      try {
        await enableAutoLogin({ totpSecret, pin });
        setState({ autoLoginEnabled: true });
        showToast('Automatic daily login enabled.', 'success');
      } catch { /* brokerAPI already surfaced a toast */ }
    }
    if (e.target.closest('[data-action="disable-auto-login"]')) {
      await disableAutoLogin();
      setState({ autoLoginEnabled: false });
      showToast('Automatic daily login turned off.', 'info');
    }
  });

  return (state) => {
    lastState = { brokerStatus: state.brokerStatus, tokenExpiry: state.tokenExpiry, autoLoginEnabled: state.autoLoginEnabled };
    paint();
  };
}
