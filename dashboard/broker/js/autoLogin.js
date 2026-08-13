// autoLogin.js
// Drives the (separate, explicit-consent) automatic-daily-reconnection
// form on broker.html. Deliberately its own module, not folded into
// oauth.js — see broker.html's comment on autoLoginSection for why this
// is kept as a second, clearly-labeled step rather than merged into the
// standard OAuth connect flow.

import { enableAutoLogin, disableAutoLogin } from './brokerAPI.js';
import { showToast } from './utils.js';

const FIELDS = ['mobile', 'password', 'pin', 'totpSecret', 'apiKey', 'apiSecret', 'redirectUri'];

function readForm(form) {
  const data = {};
  FIELDS.forEach((name) => {
    data[name] = (form.elements[name]?.value || '').trim();
  });
  return data;
}

function setEnabledState(enabled) {
  document.getElementById('alEnableBtn').hidden = enabled;
  document.getElementById('alDisableBtn').hidden = !enabled;
  document.getElementById('autoLoginForm').querySelectorAll('input').forEach((el) => {
    el.disabled = enabled;
  });
}

/**
 * Call once on page load (broker.js's main()) with the current
 * autoLoginEnabled flag from brokerStatus so the form reflects reality
 * immediately, rather than always starting in "not enabled" state.
 */
export function initAutoLoginSection(autoLoginEnabled) {
  const section = document.getElementById('autoLoginSection');
  if (!section) return;
  section.hidden = false;
  setEnabledState(!!autoLoginEnabled);

  const form = document.getElementById('autoLoginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.elements.consent.checked) {
      showToast('Please check the consent box to continue.', 'warning');
      return;
    }
    const payload = readForm(form);
    if (!payload.pin && !payload.totpSecret) {
      showToast('Enter either a PIN or a TOTP secret — Upstox needs one of these to complete login.', 'warning');
      return;
    }

    const submitBtn = document.getElementById('alEnableBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enabling…';
    try {
      await enableAutoLogin(payload);
      setEnabledState(true);
      showToast('Automatic daily reconnection enabled. Trading begins your next scheduled session.', 'success');
      form.reset();
    } catch (err) {
      showToast('Could not enable auto-reconnect. Please check your details and try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enable Auto-Reconnect';
    }
  });

  document.getElementById('alDisableBtn').addEventListener('click', async () => {
    const disableBtn = document.getElementById('alDisableBtn');
    disableBtn.disabled = true;
    try {
      await disableAutoLogin();
      setEnabledState(false);
      showToast('Automatic daily reconnection disabled. Your stored credentials have been cleared.', 'info');
    } catch (err) {
      showToast('Could not disable auto-reconnect right now. Please try again.', 'error');
    } finally {
      disableBtn.disabled = false;
    }
  });
}
