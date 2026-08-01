/* ==========================================================================
   VIKSIT ANALYST — ONBOARDING · CHECKLIST
   Vanilla ES2023 module.

   Renders the high-level onboarding checklist (distinct from the
   9-step wizard stepper in onboarding.css §2 — this is the coarser,
   customer-facing summary shown on the welcome screen, the dashboard
   "Resume Setup" card, and the final screen). Derives its state from
   progressTracker's completedSteps rather than owning its own state.
   ========================================================================== */

import progressTracker, { STEPS } from './progressTracker.js';

// Maps the 9 fine-grained wizard steps onto the 6 checklist items a
// customer actually thinks in terms of.
const CHECKLIST_ITEMS = Object.freeze([
  { id: 'payment', label: 'Payment', dependsOn: [] }, // always true by the time onboarding loads
  { id: 'account-verified', label: 'Account Verified', dependsOn: ['welcome', 'profile'] },
  { id: 'broker-connected', label: 'Broker Connected', dependsOn: ['broker-connect', 'broker-verify'] },
  { id: 'strategy-assigned', label: 'Strategy Assigned', dependsOn: ['strategy', 'bot-config'] },
  { id: 'bot-activated', label: 'Bot Activated', dependsOn: ['activation'] },
  { id: 'ready', label: 'Ready', dependsOn: STEPS.map((s) => s.id) },
]);

const checkIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function isItemDone(item, completedSteps) {
  if (item.dependsOn.length === 0) return true;
  return item.dependsOn.every((stepId) => completedSteps.includes(stepId));
}

function renderChecklistHtml(completedSteps) {
  return CHECKLIST_ITEMS.map((item) => {
    const done = isItemDone(item, completedSteps);
    return `
      <div class="ob-checklist-item ${done ? 'is-done' : ''}" data-checklist-item="${item.id}">
        <span class="ob-checklist-check">${done ? checkIcon : ''}</span>
        <span class="ob-checklist-label">${item.label}</span>
      </div>
    `;
  }).join('');
}

/**
 * Mounts a live-updating checklist into `container`. Returns an
 * unsubscribe function.
 */
export function mountChecklist(container) {
  if (!container) return () => {};

  const render = ({ completedSteps }) => {
    container.innerHTML = renderChecklistHtml(completedSteps);
  };

  render(progressTracker.snapshot());
  return progressTracker.onChange(render);
}

/** One-shot, non-live render (used in emails/PDF-style summaries and the final screen). */
export function renderChecklistStatic(completedSteps) {
  return `<div class="ob-checklist">${renderChecklistHtml(completedSteps)}</div>`;
}

export default { mountChecklist, renderChecklistStatic, CHECKLIST_ITEMS };
