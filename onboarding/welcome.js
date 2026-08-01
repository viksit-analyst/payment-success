/* ==========================================================================
   VIKSIT ANALYST — ONBOARDING · WELCOME + PROFILE
   Vanilla ES2023 module. Renders wizard steps: 'welcome', 'profile'.
   ========================================================================== */

import Api from './api.js';
import { showToast } from './components/toast.js';

function renderSkeleton() {
  return `
    <div class="ob-skeleton" style="height:28px;width:60%;margin-bottom:12px;"></div>
    <div class="ob-skeleton" style="height:16px;width:40%;margin-bottom:32px;"></div>
    <div class="ob-summary">
      ${Array.from({ length: 4 })
        .map(() => '<div class="ob-summary-row"><div class="ob-skeleton" style="height:14px;width:120px;"></div><div class="ob-skeleton" style="height:14px;width:160px;"></div></div>')
        .join('')}
    </div>
  `;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * Step 1 — Welcome. Shows customer name, purchased strategy,
 * payment/subscription confirmation, and estimated setup time.
 */
export async function renderWelcomeStep(panelEl) {
  panelEl.innerHTML = renderSkeleton();

  let customer, subscription;
  try {
    [customer, subscription] = await Promise.all([Api.loadCustomer(), Api.loadSubscription()]);
  } catch (err) {
    panelEl.innerHTML = `
      <div class="ob-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01" stroke-linecap="round"/></svg>
        <p class="ob-empty-title">Couldn't load your account</p>
        <p class="ob-empty-sub">${err.message}</p>
      </div>
    `;
    throw err;
  }

  panelEl.innerHTML = `
    <p class="ob-panel-eyebrow">Welcome</p>
    <h1 class="ob-panel-title">Welcome to Viksit Analyst, ${customer.firstName || customer.name}.</h1>
    <p class="ob-panel-sub">Your subscription is active. Let's get your trading bot fully configured — it usually takes 5–10 minutes.</p>

    <div class="ob-summary">
      <div class="ob-summary-row"><span class="ob-summary-label">Customer</span><span class="ob-summary-value">${customer.name}</span></div>
      <div class="ob-summary-row"><span class="ob-summary-label">Plan</span><span class="ob-summary-value">${subscription.planName || 'Professional Plan'}</span></div>
      <div class="ob-summary-row"><span class="ob-summary-label">Email</span><span class="ob-summary-value mono">${customer.email}</span></div>
      <div class="ob-summary-row"><span class="ob-summary-label">Phone</span><span class="ob-summary-value mono">${customer.phone || '—'}</span></div>
      <div class="ob-summary-row"><span class="ob-summary-label">Subscription Expiry</span><span class="ob-summary-value">${fmtDate(subscription.expiresAt)}</span></div>
      <div class="ob-summary-row"><span class="ob-summary-label">Payment</span><span class="ob-summary-value" style="color:var(--color-success)">Successful</span></div>
    </div>

    <div class="ob-infra-node" style="text-align:left;display:flex;align-items:center;gap:14px;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2"><path d="M12 8v4l3 2" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/></svg>
      <div>
        <div style="font-weight:600;font-size:var(--fs-sm);">Estimated setup time: 5–10 minutes</div>
        <div style="font-size:var(--fs-2xs);color:var(--text-tertiary);">You can leave and resume anytime from this same link.</div>
      </div>
    </div>
  `;

  return { customer, subscription };
}

/**
 * Step 2 — Verify Profile. Editable name/email/phone/timezone/country/
 * experience/language, saved back through the backend (no dedicated
 * "save profile" action was in the original spec's API list, so this
 * reuses saveProgress()'s payload extension point — see README.md's
 * backend contract note on this step).
 */
export function renderProfileStep(panelEl, customer) {
  panelEl.innerHTML = `
    <p class="ob-panel-eyebrow">Step 2 of 9</p>
    <h1 class="ob-panel-title">Verify your profile.</h1>
    <p class="ob-panel-sub">This is what we'll use for reports, alerts, and account recovery. Update anything that's changed.</p>

    <form id="obProfileForm" novalidate>
      <div class="ob-form-row">
        <div class="ob-form-group">
          <label for="ob-name">Full name <span class="req">*</span></label>
          <input type="text" id="ob-name" name="name" value="${customer.name || ''}" required autocomplete="name">
        </div>
        <div class="ob-form-group">
          <label for="ob-email">Email <span class="req">*</span></label>
          <input type="email" id="ob-email" name="email" value="${customer.email || ''}" required autocomplete="email">
        </div>
      </div>
      <div class="ob-form-row">
        <div class="ob-form-group">
          <label for="ob-phone">Phone <span class="req">*</span></label>
          <input type="tel" id="ob-phone" name="phone" value="${customer.phone || ''}" required autocomplete="tel">
        </div>
        <div class="ob-form-group">
          <label for="ob-timezone">Timezone</label>
          <select id="ob-timezone" name="timezone">
            <option value="Asia/Kolkata" selected>Asia/Kolkata (IST)</option>
          </select>
        </div>
      </div>
      <div class="ob-form-row">
        <div class="ob-form-group">
          <label for="ob-country">Country</label>
          <input type="text" id="ob-country" name="country" value="${customer.country || 'India'}" autocomplete="country-name">
        </div>
        <div class="ob-form-group">
          <label for="ob-experience">Trading experience</label>
          <select id="ob-experience" name="experience">
            <option value="new">New to trading</option>
            <option value="intermediate">Some experience</option>
            <option value="experienced" selected>Experienced</option>
          </select>
        </div>
      </div>
      <div class="ob-form-group" style="max-width:260px;">
        <label for="ob-language">Preferred language</label>
        <select id="ob-language" name="language">
          <option value="en" selected>English</option>
          <option value="hi">Hindi</option>
        </select>
      </div>
    </form>
  `;
}

export function readProfileForm() {
  const form = document.getElementById('obProfileForm');
  if (!form) return null;
  const data = Object.fromEntries(new FormData(form).entries());
  const requiredOk = data.name && data.email && data.phone;
  return { data, valid: Boolean(requiredOk) };
}

export function notifyWelcomeShown() {
  showToast('Welcome to Viksit Analyst — let\u2019s get you set up.', { type: 'success' });
}
