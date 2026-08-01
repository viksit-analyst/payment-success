/* ==========================================================================
   VIKSIT ANALYST — ONBOARDING · ENTRY POINT
   Vanilla ES2023 module. Loaded as <script type="module" src="onboarding.js">
   on onboarding.html only. Nav, theme toggle, and mobile drawer behavior
   stay in script.js (also loaded on this page, unchanged) — this file
   owns only the wizard bootstrap.
   ========================================================================== */

import Api from './api.js';
import { initWizard, bootWizard } from './wizard.js';
import { showToast } from './components/toast.js';

function handleOAuthReturnParams() {
  const params = new URLSearchParams(window.location.search);
  const oauthResult = params.get('oauth');
  if (!oauthResult) return;

  if (oauthResult === 'success') {
    showToast('Broker connected successfully.', { type: 'success' });
  } else if (oauthResult === 'failed') {
    const reason = params.get('reason') || 'Please try again.';
    showToast(`Broker connection failed: ${reason}`, { type: 'error' });
  }

  // Strip oauth/reason from the URL so a refresh doesn't re-show the
  // toast, while preserving ?token= (and ?step=, if the redirect set
  // one) for resumability.
  params.delete('oauth');
  params.delete('reason');
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}

function renderMissingTokenState() {
  const shell = document.getElementById('obShell');
  if (!shell) return;
  shell.innerHTML = `
    <div class="ob-panel">
      <div class="ob-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 8v4l3 2" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/></svg>
        <p class="ob-empty-title">No onboarding link found</p>
        <p class="ob-empty-sub">Open the authentication link from your welcome email to continue setup, or contact support if you can't find it.</p>
      </div>
      <div class="ob-panel-footer" style="border-top:none;justify-content:center;">
        <a href="contact.html" class="btn btn-primary">Contact Support</a>
      </div>
    </div>
  `;
}

async function boot() {
  handleOAuthReturnParams();

  if (!Api.getSessionToken()) {
    renderMissingTokenState();
    return;
  }

  const root = document.getElementById('obShell');
  initWizard(root);
  await bootWizard();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
