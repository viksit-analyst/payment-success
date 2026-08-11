/* ==========================================================================
   VIKSIT ANALYST — ONBOARDING · WIZARD ORCHESTRATOR
   Vanilla ES2023 module.

   Owns step sequencing and delegates rendering to the per-step modules
   (welcome.js, brokerSetup.js, botSetup.js, activation.js). progressTracker.js is the source of truth for "where
   am I"; this file is purely presentation + transition logic.
   ========================================================================== */

import Api from './api.js';
import progressTracker, { STEPS } from './progressTracker.js';
import { showToast } from './components/toast.js';
import { confirm as confirmDialog } from './components/confirmDialog.js';
import { renderWelcomeStep, renderProfileStep, readProfileForm, notifyWelcomeShown } from './welcome.js';
import { renderBrokerConnectStep, renderBrokerVerifyStep } from './brokerSetup.js';
import { renderStrategyStep, readSelectedStrategy, renderBotConfigStep } from './botSetup.js';
import { renderInfrastructureStep, renderActivationStep, renderFinalScreen } from './activation.js';

// Session-scoped (not persisted) working state accumulated as the
// customer moves forward — avoids re-fetching data every step render.
const session = {
  customer: null,
  subscription: null,
  brokerStatus: null,
  strategyId: null,
  config: null,
  infra: null,
};

let panelEl, stepperEl, fillEl, prevBtnEl, nextBtnEl, progressPctEl;

export function initWizard(root) {
  panelEl = root.querySelector('#obPanel');
  stepperEl = root.querySelector('#obStepper');
  fillEl = root.querySelector('#obStepperFill');
  prevBtnEl = root.querySelector('#obPrevBtn');
  nextBtnEl = root.querySelector('#obNextBtn');
  progressPctEl = root.querySelector('#obProgressPct');

  renderStepperShell();
  progressTracker.onChange(renderStepperState);

  prevBtnEl.addEventListener('click', handlePrev);
  nextBtnEl.addEventListener('click', handleNext);
}

function renderStepperShell() {
  stepperEl.innerHTML = `
    <div class="ob-stepper-fill" id="obStepperFill"></div>
    ${STEPS.map(
      (s) => `
      <div class="ob-step" data-step="${s.id}">
        <span class="ob-step-dot"></span>
        <span class="ob-step-label">${s.label}</span>
      </div>
    `
    ).join('')}
  `;
  fillEl = stepperEl.querySelector('#obStepperFill');

  stepperEl.querySelectorAll('.ob-step').forEach((el) => {
    el.addEventListener('click', () => {
      const stepId = el.dataset.step;
      if (progressTracker.isComplete(stepId) || stepId === progressTracker.currentStep) {
        goTo(stepId);
      }
    });
    el.style.cursor = 'pointer';
  });
}

function renderStepperState({ currentStep, completedSteps, progressPct }) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
  stepperEl.querySelectorAll('.ob-step').forEach((el, i) => {
    el.classList.toggle('is-complete', completedSteps.includes(el.dataset.step));
    el.classList.toggle('is-current', el.dataset.step === currentStep);
  });
  const fillPct = STEPS.length > 1 ? (currentIndex / (STEPS.length - 1)) * 100 : 0;
  if (fillEl) fillEl.style.width = `${Math.max(0, fillPct)}%`;
  if (progressPctEl) progressPctEl.textContent = `${progressPct}%`;
  prevBtnEl.style.visibility = currentIndex <= 0 ? 'hidden' : 'visible';
  nextBtnEl.textContent = currentIndex === STEPS.length - 1 ? 'Activate' : 'Continue';
}

/** Boots the wizard: loads progress, resumes at the saved step (or starts fresh). */
export async function bootWizard() {
  try {
    await progressTracker.load();
  } catch (err) {
    if (err.code === 'NO_TOKEN') {
      renderNoTokenEmptyState();
      return;
    }
    showToast(err.message, { type: 'error' });
  }

  if (progressTracker.isOnboardingDone()) {
    await runStep('activation', { skipToFinal: true });
    return;
  }

  await runStep(progressTracker.currentStep);
}

function renderNoTokenEmptyState() {
  panelEl.innerHTML = `
    <div class="ob-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 8v4l3 2" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/></svg>
      <p class="ob-empty-title">This link has expired or is invalid</p>
      <p class="ob-empty-sub">Check your email for the authentication link we sent after payment, or contact support and we'll resend it.</p>
    </div>
    <div class="ob-panel-footer" style="border-top:none;justify-content:center;">
      <a href="contact.html" class="btn btn-primary">Contact Support</a>
    </div>
  `;
  stepperEl.style.display = 'none';
  document.getElementById('obProgressMeta')?.style && (document.getElementById('obProgressMeta').style.display = 'none');
  prevBtnEl.style.display = 'none';
  nextBtnEl.style.display = 'none';
}

async function goTo(stepId) {
  await progressTracker.goToStep(stepId);
  await runStep(stepId);
}

async function handlePrev() {
  const idx = STEPS.findIndex((s) => s.id === progressTracker.currentStep);
  if (idx <= 0) return;
  await goTo(STEPS[idx - 1].id);
}

async function handleNext() {
  nextBtnEl.disabled = true;
  try {
    const ok = await validateAndAdvance(progressTracker.currentStep);
    if (ok) {
      const snapshot = await progressTracker.completeStep(progressTracker.currentStep);
      if (snapshot.progressPct === 100) {
        await finishOnboarding();
      } else {
        await runStep(snapshot.currentStep);
      }
    }
  } catch (err) {
    showToast(err.message || 'Something went wrong. Please try again.', { type: 'error' });
  } finally {
    nextBtnEl.disabled = false;
  }
}

/**
 * Per-step gate: runs before advancing. Returns true to allow
 * advancing, false to stay (the step module is responsible for
 * showing why, e.g. a failed broker check).
 */
async function validateAndAdvance(stepId) {
  switch (stepId) {
    case 'profile': {
      const { valid } = readProfileForm();
      if (!valid) {
        showToast('Please fill in name, email, and phone before continuing.', { type: 'warning' });
        return false;
      }
      return true;
    }
    case 'broker-connect':
      // Advancing here just moves to verification — connection itself
      // happens via the OAuth redirect, not the Continue button.
      return true;
    case 'broker-verify': {
      const status = await Api.loadBrokerStatus().catch(() => null);
      session.brokerStatus = status;
      const { allPassed } = await renderBrokerVerifyStep(panelEl);
      if (!allPassed) {
        showToast('Some broker checks failed — resolve them before continuing.', { type: 'warning' });
        return false;
      }
      return true;
    }
    case 'strategy': {
      const strategyId = readSelectedStrategy(panelEl);
      if (!strategyId) {
        showToast('Select a strategy to continue.', { type: 'warning' });
        return false;
      }
      session.strategyId = strategyId;
      return true;
    }
    case 'infrastructure': {
      const { allHealthy, infra } = await renderInfrastructureStep(panelEl);
      session.infra = infra;
      if (!allHealthy) {
        const proceed = await confirmDialog({
          title: 'Some systems show warnings',
          message: 'You can continue, but activation may be delayed until every system is healthy.',
          confirmLabel: 'Continue anyway',
          danger: true,
        });
        return proceed;
      }
      return true;
    }
    default:
      return true;
  }
}

/** Renders the panel for a given step id, fetching whatever data that step needs. */
async function runStep(stepId, { skipToFinal = false } = {}) {
  if (skipToFinal) {
    await renderFinal();
    return;
  }

  try {
    switch (stepId) {
      case 'welcome': {
        const { customer, subscription } = await renderWelcomeStep(panelEl);
        session.customer = customer;
        session.subscription = subscription;
        notifyWelcomeShown();
        break;
      }
      case 'profile':
        renderProfileStep(panelEl, session.customer || (await Api.loadCustomer()));
        break;
      case 'broker-connect': {
        const status = session.brokerStatus || (await Api.loadBrokerStatus().catch(() => null));
        session.brokerStatus = status;
        renderBrokerConnectStep(panelEl, status);
        break;
      }
      case 'broker-verify':
        await renderBrokerVerifyStep(panelEl);
        break;
      case 'strategy': {
        const subscription = session.subscription || (await Api.loadSubscription());
        session.subscription = subscription;
        renderStrategyStep(panelEl, subscription);
        break;
      }
      case 'bot-config': {
        const strategyId = session.strategyId || session.subscription?.strategyId;
        const customer = session.customer || (await Api.loadCustomer());
        session.config = await renderBotConfigStep(panelEl, strategyId, customer);
        break;
      }
      case 'infrastructure':
        await renderInfrastructureStep(panelEl);
        break;
      case 'activation':
        nextBtnEl.style.display = 'none';
        prevBtnEl.style.display = 'none';
        await renderActivationStep(panelEl);
        await finishOnboarding();
        return;
      default:
        break;
    }
  } catch (err) {
    showToast(err.message || 'Could not load this step.', { type: 'error' });
  }
}

async function finishOnboarding() {
  let customer = session.customer;
  try {
    customer = await Api.completeOnboarding();
  } catch (err) {
    showToast('Setup finished, but we could not confirm with the server. Refresh to retry.', { type: 'error' });
  }
  showToast('Setup complete — your bot is ready.', { type: 'success' });
  stepperEl.style.display = 'none';
  prevBtnEl.style.display = 'none';
  nextBtnEl.style.display = 'none';
  renderFinalScreen(panelEl, {
    customer: customer || session.customer || { name: 'there' },
    config: session.config,
    infra: session.infra,
  });
}

async function renderFinal() {
  stepperEl.style.display = 'none';
  prevBtnEl.style.display = 'none';
  nextBtnEl.style.display = 'none';
  const customer = session.customer || (await Api.loadCustomer().catch(() => ({ name: 'there' })));
  renderFinalScreen(panelEl, { customer, config: session.config, infra: session.infra });
}
