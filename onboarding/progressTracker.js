/* ==========================================================================
   VIKSIT ANALYST — ONBOARDING · PROGRESS TRACKER
   Vanilla ES2023 module.

   Owns the single source of truth for "where is this customer in the
   flow." Persists to the backend via api.js (never localStorage —
   see api.js's file header for why). Holds an in-memory copy for the
   duration of the page so the wizard doesn't re-fetch on every render.
   ========================================================================== */

import Api from './api.js';

export const STEPS = Object.freeze([
  { id: 'welcome', label: 'Welcome' },
  { id: 'profile', label: 'Profile' },
  { id: 'broker-connect', label: 'Connect Broker' },
  { id: 'broker-verify', label: 'Verify Broker' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'bot-config', label: 'Bot Setup' },
  { id: 'infrastructure', label: 'System Check' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'activation', label: 'Activate' },
]);

const STEP_INDEX = new Map(STEPS.map((s, i) => [s.id, i]));

function computePct(completedSteps) {
  if (!STEPS.length) return 0;
  const done = STEPS.filter((s) => completedSteps.includes(s.id)).length;
  return Math.round((done / STEPS.length) * 100);
}

class ProgressTracker {
  constructor() {
    this.currentStep = STEPS[0].id;
    this.completedSteps = [];
    this.lastUpdated = null;
    this.completionTime = null;
    this._loaded = false;
    this._listeners = new Set();
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _notify() {
    this._listeners.forEach((fn) => fn(this.snapshot()));
  }

  snapshot() {
    return {
      currentStep: this.currentStep,
      completedSteps: [...this.completedSteps],
      progressPct: computePct(this.completedSteps),
      lastUpdated: this.lastUpdated,
      completionTime: this.completionTime,
    };
  }

  /** Loads saved progress from the backend. Falls back to step 1 if this is a first visit. */
  async load() {
    try {
      const remote = await Api.loadProgress();
      if (remote && remote.currentStep && STEP_INDEX.has(remote.currentStep)) {
        this.currentStep = remote.currentStep;
        this.completedSteps = Array.isArray(remote.completedSteps) ? remote.completedSteps : [];
        this.lastUpdated = remote.lastUpdated || null;
        this.completionTime = remote.completionTime || null;
      }
    } catch (err) {
      // No saved progress yet (first visit) is expected and not an error
      // worth surfacing — anything else, let the caller decide how to
      // show it (see onboarding.js's boot sequence).
      if (err.code !== 'NO_TOKEN') {
        console.warn('[progressTracker] Could not load saved progress, starting fresh:', err.message);
      } else {
        throw err;
      }
    }
    this._loaded = true;
    this._notify();
    return this.snapshot();
  }

  /** Marks a step complete and advances current step, then persists. */
  async completeStep(stepId) {
    if (!STEP_INDEX.has(stepId)) throw new Error(`Unknown step id: ${stepId}`);
    if (!this.completedSteps.includes(stepId)) {
      this.completedSteps.push(stepId);
    }
    const nextIndex = STEP_INDEX.get(stepId) + 1;
    this.currentStep = nextIndex < STEPS.length ? STEPS[nextIndex].id : stepId;
    await this._persist();
    return this.snapshot();
  }

  /** Moves to an arbitrary step (used by Previous / stepper click on already-completed steps). */
  async goToStep(stepId) {
    if (!STEP_INDEX.has(stepId)) throw new Error(`Unknown step id: ${stepId}`);
    this.currentStep = stepId;
    await this._persist();
    return this.snapshot();
  }

  async _persist() {
    this.lastUpdated = new Date().toISOString();
    const pct = computePct(this.completedSteps);
    if (pct === 100 && !this.completionTime) {
      this.completionTime = this.lastUpdated;
    }
    try {
      await Api.saveProgress({
        currentStep: this.currentStep,
        completedSteps: this.completedSteps,
        progressPct: pct,
      });
    } finally {
      // Reflect the change locally even if the save request is still
      // in flight or fails transiently — the wizard should stay
      // responsive; the next successful save will reconcile.
      this._notify();
    }
  }

  isComplete(stepId) {
    return this.completedSteps.includes(stepId);
  }

  stepIndex(stepId = this.currentStep) {
    return STEP_INDEX.get(stepId) ?? 0;
  }

  isOnboardingDone() {
    return computePct(this.completedSteps) === 100;
  }
}

export default new ProgressTracker();
