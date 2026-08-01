/* ==========================================================================
   VIKSIT ANALYST — ONBOARDING · BROKER SETUP
   Vanilla ES2023 module. Renders wizard steps: 'broker-connect', 'broker-verify'.
   ========================================================================== */

import Api from './api.js';
import { showToast } from './components/toast.js';
import { confirm as confirmDialog } from './components/confirmDialog.js';

const passIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const failIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>';
const pendingIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round"/></svg>';

/**
 * Step 3 — Broker Connection. Shows connection status and a Connect/
 * Reconnect CTA that kicks off the Upstox OAuth handoff.
 */
export function renderBrokerConnectStep(panelEl, brokerStatus) {
  const connected = brokerStatus && brokerStatus.status === 'connected';

  panelEl.innerHTML = `
    <p class="ob-panel-eyebrow">Step 3 of 9</p>
    <h1 class="ob-panel-title">Connect your broker.</h1>
    <p class="ob-panel-sub">Your bot trades through your own Upstox account — we never hold your funds. This authorizes the platform to place and manage orders on your behalf, within the limits you control.</p>

    <div class="ob-broker-card">
      <div class="ob-broker-identity">
        <div class="ob-broker-logo">U</div>
        <div>
          <div class="ob-broker-name">Upstox</div>
          <div class="ob-broker-sub">${connected ? `Connected as ${brokerStatus.accountLabel || brokerStatus.clientId}` : 'Not connected yet'}</div>
        </div>
      </div>
      <span class="badge ${connected ? 'badge-operational' : 'badge-soon'}">
        <span class="status-dot"></span>${connected ? 'Connected' : 'Not Connected'}
      </span>
    </div>

    <ul class="modal-checklist" style="margin-bottom:28px;">
      <li>${passIcon}Read-only account details are used only to verify your setup</li>
      <li>${passIcon}Order placement respects the risk limits on your subscription</li>
      <li>${passIcon}You can disconnect the broker link at any time from your dashboard</li>
    </ul>

    <div id="obBrokerConnectError" class="ob-form-error" style="display:none;margin-bottom:16px;"></div>

    <button type="button" class="btn btn-primary btn-lg btn-block" id="obConnectBrokerBtn">
      ${connected ? 'Reconnect Upstox' : 'Connect Upstox'}
    </button>
  `;

  document.getElementById('obConnectBrokerBtn').addEventListener('click', async () => {
    if (connected) {
      const ok = await confirmDialog({
        title: 'Reconnect Upstox?',
        message: 'This restarts the authorization flow. Your current connection stays active until the new one succeeds.',
        confirmLabel: 'Reconnect',
      });
      if (!ok) return;
    }
    await startBrokerConnect();
  });
}

async function startBrokerConnect() {
  const btn = document.getElementById('obConnectBrokerBtn');
  const errorEl = document.getElementById('obBrokerConnectError');
  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Redirecting to Upstox…';

  try {
    const redirectUrl = await Api.connectBroker('upstox');
    window.location.href = redirectUrl;
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Connect Upstox';
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
    showToast('Could not start the broker connection. Please retry.', { type: 'error' });
  }
}

/**
 * Step 4 — Broker Verification. Runs (or re-runs) the post-connection
 * checklist: trading enabled, F&O enabled, API enabled, margins,
 * exchange permissions, latency, profile. All green required to advance.
 */
export async function renderBrokerVerifyStep(panelEl) {
  panelEl.innerHTML = `
    <p class="ob-panel-eyebrow">Step 4 of 9</p>
    <h1 class="ob-panel-title">Verifying your broker connection.</h1>
    <p class="ob-panel-sub">Running the same checks your bot will rely on every trading day.</p>
    <div class="ob-check-grid" id="obBrokerChecks">
      ${renderCheckSkeleton()}
    </div>
  `;

  let checks;
  try {
    checks = await Api.validateBroker();
  } catch (err) {
    panelEl.querySelector('#obBrokerChecks').innerHTML = `
      <div class="ob-empty" style="grid-column:1/-1;">
        <p class="ob-empty-title">Verification failed</p>
        <p class="ob-empty-sub">${err.message}</p>
      </div>
    `;
    return { allPassed: false, checks: null };
  }

  const items = [
    ['tradingEnabled', 'Trading Enabled'],
    ['fnoEnabled', 'F&O Enabled'],
    ['apiEnabled', 'API Enabled'],
    ['margins', 'Margins Sufficient'],
    ['exchangePermissions', 'Exchange Permissions'],
    ['latency', 'Latency'],
  ];

  const allPassed = items.every(([key]) => checks[key] === true || key === 'latency');

  panelEl.querySelector('#obBrokerChecks').innerHTML = items
    .map(([key, label]) => {
      if (key === 'latency') {
        const ms = checks.latencyMs ?? null;
        const state = ms === null ? 'is-pending' : ms < 300 ? 'is-pass' : 'is-fail';
        return checkItemHtml(state, label, ms !== null ? `${ms}ms` : null);
      }
      const state = checks[key] === true ? 'is-pass' : 'is-fail';
      return checkItemHtml(state, label);
    })
    .join('');

  return { allPassed, checks };
}

function renderCheckSkeleton() {
  return Array.from({ length: 6 })
    .map(() => '<div class="ob-check-item"><div class="ob-skeleton" style="height:14px;width:100px;"></div><div class="ob-skeleton" style="height:20px;width:20px;border-radius:50%;"></div></div>')
    .join('');
}

function checkItemHtml(state, label, meta) {
  const icon = state === 'is-pass' ? passIcon : state === 'is-fail' ? failIcon : pendingIcon;
  return `
    <div class="ob-check-item ${state}">
      <span class="ob-check-label">${label}${meta ? ` <span class="mono" style="color:var(--text-tertiary)">(${meta})</span>` : ''}</span>
      <span class="ob-check-icon">${icon}</span>
    </div>
  `;
}
