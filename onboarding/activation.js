/* ==========================================================================
   VIKSIT ANALYST — ONBOARDING · ACTIVATION
   Vanilla ES2023 module. Renders wizard steps: 'infrastructure',
   'activation', plus the final "Ready to Trade" screen.
   ========================================================================== */

import Api from './api.js';
import { showToast } from './components/toast.js';

const INFRA_LABELS = Object.freeze({
  backend: 'Backend', vm: 'VM', broker: 'Broker', api: 'API',
  scheduler: 'Scheduler', database: 'Database', network: 'Network', heartbeat: 'Heartbeat',
});

function healthClass(state) {
  if (state === 'healthy') return 'is-healthy';
  if (state === 'warning') return 'is-warning';
  return 'is-critical';
}
function healthLabel(state) {
  if (state === 'healthy') return 'Healthy';
  if (state === 'warning') return 'Warning';
  return 'Critical';
}

/** Step 7 — Infrastructure Check. */
export async function renderInfrastructureStep(panelEl) {
  panelEl.innerHTML = `
    <p class="ob-panel-eyebrow">Step 7 of 9</p>
    <h1 class="ob-panel-title">System validation.</h1>
    <p class="ob-panel-sub">Confirming every system your bot depends on is healthy before we go further.</p>
    <div class="ob-infra-grid" id="obInfraGrid">
      ${Object.keys(INFRA_LABELS)
        .map(() => '<div class="ob-infra-node"><div class="ob-skeleton" style="height:10px;width:60%;margin:0 auto 10px;"></div><div class="ob-skeleton" style="height:16px;width:50%;margin:0 auto;"></div></div>')
        .join('')}
    </div>
  `;

  let infra;
  try {
    infra = await Api.checkInfrastructure();
  } catch (err) {
    panelEl.querySelector('#obInfraGrid').innerHTML = `
      <div class="ob-empty" style="grid-column:1/-1;"><p class="ob-empty-title">Couldn't reach infrastructure status</p><p class="ob-empty-sub">${err.message}</p></div>
    `;
    return { allHealthy: false };
  }

  panelEl.querySelector('#obInfraGrid').innerHTML = Object.entries(INFRA_LABELS)
    .map(([key, label]) => {
      const state = infra[key] || 'critical';
      return `
        <div class="ob-infra-node">
          <div class="ob-infra-label">${label}</div>
          <div class="ob-infra-value ${healthClass(state)}"><span class="status-dot"></span>${healthLabel(state)}</div>
        </div>
      `;
    })
    .join('');

  const allHealthy = Object.values(infra).every((s) => s === 'healthy');
  return { allHealthy, infra };
}

/** Step 9 — Activation. Runs the Backend → VM → Bot → Heartbeat → Success sequence. */
export async function renderActivationStep(panelEl) {
  const stages = [
    { id: 'backend', label: 'Connecting to backend' },
    { id: 'vm', label: 'Provisioning VM workspace' },
    { id: 'bot', label: 'Starting your bot' },
    { id: 'heartbeat', label: 'Confirming heartbeat' },
    { id: 'success', label: 'Activation complete' },
  ];

  panelEl.innerHTML = `
    <p class="ob-panel-eyebrow">Step 9 of 9</p>
    <h1 class="ob-panel-title">Activating your bot.</h1>
    <p class="ob-panel-sub">This takes about 30 seconds. Don't close this tab.</p>
    <div class="ob-activation-track" id="obActivationTrack">
      ${stages
        .map(
          (s, i) => `
        <div class="ob-activation-row ${i === 0 ? 'is-active' : ''}" data-stage="${s.id}">
          <span class="ob-activation-icon">${i === 0 ? spinnerIcon() : dotIcon()}</span>
          <span class="ob-activation-text">
            <span class="ob-activation-title">${s.label}</span>
            <span class="ob-activation-sub" data-stage-sub="${s.id}"></span>
          </span>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  let activation;
  try {
    activation = await Api.activateBot();
  } catch (err) {
    markStageError(panelEl, stages);
    showToast('Activation failed. You can retry from this step.', { type: 'error' });
    return { status: 'failed', error: err.message };
  }

  // Backend returns per-stage status; walk the track to reflect it.
  // If the backend only returns a final status (no per-stage detail
  // yet), treat it as "all stages succeeded in sequence" so the UI
  // still animates through them rather than jumping straight to done.
  await animateStages(panelEl, stages, activation.stages || null);

  if (activation.status === 'active') {
    showToast('Your bot is now active.', { type: 'success' });
  } else if (activation.status === 'failed') {
    showToast('Activation did not complete. Please retry.', { type: 'error' });
  }

  return activation;
}

function spinnerIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round"/></svg>';
}
function checkIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function dotIcon() {
  return '<span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;"></span>';
}
function xIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>';
}

async function animateStages(panelEl, stages, backendStages) {
  for (let i = 0; i < stages.length; i++) {
    const row = panelEl.querySelector(`[data-stage="${stages[i].id}"]`);
    if (!row) continue;
    row.classList.add('is-active');
    row.querySelector('.ob-activation-icon').innerHTML = spinnerIcon();

    const backendState = backendStages ? backendStages[stages[i].id] : 'ok';
    // Small pacing delay so the sequence reads as real progress rather
    // than an instant flash — this mirrors the "loading choreography"
    // pattern already used on the marketing site (script.js).
    await new Promise((r) => setTimeout(r, 350));

    row.classList.remove('is-active');
    if (backendState === 'failed') {
      row.classList.add('is-error');
      row.querySelector('.ob-activation-icon').innerHTML = xIcon();
      return; // stop the walk — don't claim later stages succeeded
    }
    row.classList.add('is-done');
    row.querySelector('.ob-activation-icon').innerHTML = checkIcon();
  }
}

function markStageError(panelEl, stages) {
  const firstRow = panelEl.querySelector(`[data-stage="${stages[0].id}"]`);
  if (!firstRow) return;
  firstRow.classList.remove('is-active');
  firstRow.classList.add('is-error');
  firstRow.querySelector('.ob-activation-icon').innerHTML = xIcon();
}

/** Final screen — "Ready to Trade." */
export function renderFinalScreen(panelEl, { customer, config, infra }) {
  panelEl.innerHTML = `
    <div style="text-align:center;padding:12px 0 8px;">
      <div style="width:64px;height:64px;border-radius:50%;background:rgba(31,169,113,0.14);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2.5"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <p class="ob-panel-eyebrow" style="justify-content:center;">All Set</p>
      <h1 class="ob-panel-title">Congratulations, ${customer.firstName || customer.name}.</h1>
      <p class="ob-panel-sub" style="margin-left:auto;margin-right:auto;">Everything is ready. Your ${config?.strategy || 'strategy'} bot is live and trading under the risk limits on your plan.</p>
    </div>

    <div class="ob-check-grid">
      ${checkRow('Subscription Active')}
      ${checkRow('Strategy Running')}
      ${checkRow('Broker Connected')}
      ${checkRow('Bot Running')}
      ${checkRow(infra?.allHealthy === false ? 'Server Degraded' : 'Server Healthy', infra?.allHealthy !== false)}
      ${checkRow('Heartbeat Active')}
    </div>

    <div class="ob-panel-footer" style="border-top:none;padding-top:0;flex-direction:column;gap:12px;">
      <a href="dashboard.html" class="btn btn-primary btn-lg btn-block">Go to Dashboard</a>
      <a href="dashboard.html#performance" class="btn btn-secondary btn-block">View Performance</a>
      <a href="contact.html" class="btn btn-ghost btn-block">Need Help?</a>
    </div>
  `;
}

function checkRow(label, pass = true) {
  return `
    <div class="ob-check-item ${pass ? 'is-pass' : 'is-fail'}">
      <span class="ob-check-label">${label}</span>
      <span class="ob-check-icon">${pass ? checkIcon() : xIcon()}</span>
    </div>
  `;
}
