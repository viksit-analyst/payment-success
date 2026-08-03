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

// M7 fix: previously only checked VA_SESSION.isValidLocally() — a purely
// local, unsigned check (just "is there a non-expired-looking record in
// storage"). An expired-but-not-yet-cleared local session would pass that
// and offer a "Go to Dashboard" link that immediately bounces back to
// login via routeGuard.js's own (correct) authoritative check. This does
// that same authoritative check here instead, so the link we offer is
// actually right. Falls back to the local-only check if auth/api.js isn't
// on the page for some reason, and treats a failed validateSession() call
// (invalid session OR a network blip) as "no session" — the Sign In link
// we show either way always works, so this is the safe direction to fail.
async function computeHasSession_() {
  const hasLocalSession = !!(window.VA_SESSION && VA_SESSION.isValidLocally());
  if (!hasLocalSession) return false;
  if (!window.VA_API || typeof VA_API.validateSession !== 'function') {
    return hasLocalSession;
  }
  try {
    const result = await VA_API.validateSession();
    return !!(result && result.valid);
  } catch (err) {
    return false;
  }
}

async function renderMissingTokenState() {
  const shell = document.getElementById('obShell');
  if (!shell) return;

  // Require authentication: if this browser already has a valid portal
  // session (shared auth/session.js — read-only here, no duplicate login
  // logic), send them to their dashboard rather than dead-ending on an
  // "invalid link" screen meant for first-time, pre-account visitors.
  const hasSession = await computeHasSession_();
  const primaryAction = hasSession
    ? `<a href="../dashboard/index.html" class="btn btn-primary">Go to Dashboard</a>`
    : `<a href="../auth/login.html?redirect=${encodeURIComponent(window.location.pathname)}" class="btn btn-primary">Sign In</a>`;

  shell.innerHTML = `
    <div class="ob-panel">
      <div class="ob-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 8v4l3 2" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/></svg>
        <p class="ob-empty-title">No onboarding link found</p>
        <p class="ob-empty-sub">Open the authentication link from your welcome email to continue setup${hasSession ? ', or head to your dashboard' : ', sign in'}, or contact support if you can't find it.</p>
      </div>
      <div class="ob-panel-footer" style="border-top:none;justify-content:center;gap:10px;">
        ${primaryAction}
        <a href="../contact.html" class="btn btn-secondary">Contact Support</a>
      </div>
    </div>
  `;
}

async function boot() {
  handleOAuthReturnParams();

  if (!Api.getSessionToken()) {
    await renderMissingTokenState();
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
