/* ==========================================================================
   VIKSIT ANALYST — ONBOARDING · BOT SETUP
   Vanilla ES2023 module. Renders wizard steps: 'strategy', 'bot-config'.

   Strategy metadata (description, risk level, capital, trading hours,
   instruments, execution style) mirrors the exact strategy identities
   already defined in script.js's strategyData object (ivrv / gamma /
   vwap) — not reinvented here, just re-shown in onboarding context.
   ========================================================================== */

import Api from './api.js';
import { showToast } from './components/toast.js';

// Intentionally the same three keys/colors as script.js's strategyData —
// kept as a small local copy rather than importing script.js (which is
// an IIFE, not a module, and scoped to the marketing pages only).
const STRATEGY_META = Object.freeze({
  ivrv: {
    name: 'IVRV', tagline: 'Systematic Volatility Strategy', color: 'var(--color-ivrv)',
    risk: 'Moderate', capital: '\u20b93,00,000+', hours: 'Multi-day holds, monitored continuously',
    instruments: 'Index options (Nifty)', execution: 'Systematic, selective entries',
  },
  gamma: {
    name: 'Gamma Flip', tagline: 'Systematic Momentum Strategy', color: 'var(--color-gamma)',
    risk: 'Higher', capital: '\u20b93,00,000+', hours: 'Intraday, concentrated sessions',
    instruments: 'Index options (Nifty)', execution: 'Rapid, rules-based intraday entries',
  },
  vwap: {
    name: 'VWAP', tagline: 'Systematic Intraday Trend Strategy', color: 'var(--color-vwap)',
    risk: 'Moderate', capital: '\u20b93,00,000+', hours: 'Intraday, trend windows',
    instruments: 'Index options (Nifty)', execution: 'Automated trend participation',
  },
});

/**
 * Step 5 — Strategy Setup. The Professional Plan is a single unified
 * subscription (see README.md's pricing-model note) — this step is
 * where a specific strategy is actually allocated to the customer's
 * bot instance, not a purchase decision.
 */
export function renderStrategyStep(panelEl, subscription) {
  const allocated = subscription.strategyId; // null on first visit — customer picks below
  const options = Object.entries(STRATEGY_META);

  panelEl.innerHTML = `
    <p class="ob-panel-eyebrow">Step 5 of 9</p>
    <h1 class="ob-panel-title">Choose your strategy.</h1>
    <p class="ob-panel-sub">Your Professional Plan covers execution infrastructure for any strategy. Pick which one your bot runs first — you can request a change later from your dashboard.</p>

    <div class="ob-download-grid" id="obStrategyOptions" role="radiogroup" aria-label="Strategy selection">
      ${options
        .map(
          ([id, s]) => `
        <label class="ob-download-card" style="cursor:pointer;align-items:flex-start;flex-direction:column;gap:8px;${allocated === id ? 'border-color:var(--color-primary);' : ''}">
          <input type="radio" name="strategy" value="${id}" style="position:absolute;opacity:0;" ${allocated === id ? 'checked' : ''}>
          <span class="badge" style="background:color-mix(in srgb, ${s.color} 14%, transparent); color:${s.color};"><span class="status-dot" style="background:${s.color}"></span>${s.name}</span>
          <strong style="font-size:var(--fs-sm);">${s.tagline}</strong>
          <span style="font-size:var(--fs-2xs);color:var(--text-tertiary);">Risk: ${s.risk} · ${s.instruments}</span>
        </label>
      `
        )
        .join('')}
    </div>

    <div class="ob-summary" id="obStrategyDetail" style="display:none;"></div>
  `;

  const radios = panelEl.querySelectorAll('input[name="strategy"]');
  const detailEl = panelEl.querySelector('#obStrategyDetail');
  const cards = panelEl.querySelectorAll('.ob-download-card');

  const renderDetail = (id) => {
    const s = STRATEGY_META[id];
    detailEl.style.display = 'grid';
    detailEl.innerHTML = `
      <div class="ob-summary-row"><span class="ob-summary-label">Strategy</span><span class="ob-summary-value">${s.name}</span></div>
      <div class="ob-summary-row"><span class="ob-summary-label">Risk Level</span><span class="ob-summary-value">${s.risk}</span></div>
      <div class="ob-summary-row"><span class="ob-summary-label">Recommended Capital</span><span class="ob-summary-value mono">${s.capital}</span></div>
      <div class="ob-summary-row"><span class="ob-summary-label">Trading Hours</span><span class="ob-summary-value">${s.hours}</span></div>
      <div class="ob-summary-row"><span class="ob-summary-label">Supported Instruments</span><span class="ob-summary-value">${s.instruments}</span></div>
      <div class="ob-summary-row"><span class="ob-summary-label">Execution Style</span><span class="ob-summary-value">${s.execution}</span></div>
    `;
    cards.forEach((c) => c.style.borderColor = '');
    const checked = panelEl.querySelector(`input[value="${id}"]`);
    checked.closest('.ob-download-card').style.borderColor = 'var(--color-primary)';
  };

  radios.forEach((r) => r.addEventListener('change', () => renderDetail(r.value)));
  if (allocated) renderDetail(allocated);
}

export function readSelectedStrategy(panelEl) {
  const checked = panelEl.querySelector('input[name="strategy"]:checked');
  return checked ? checked.value : null;
}

/**
 * Step 6 — Bot Configuration. Displays the generated config summary
 * and triggers config generation if it hasn't run yet for this strategy.
 */
export async function renderBotConfigStep(panelEl, strategyId, customer) {
  panelEl.innerHTML = `
    <p class="ob-panel-eyebrow">Step 6 of 9</p>
    <h1 class="ob-panel-title">Configuring your bot.</h1>
    <p class="ob-panel-sub">Generating a dedicated configuration for your ${STRATEGY_META[strategyId]?.name || strategyId} bot.</p>
    <div class="ob-summary" id="obBotConfigSummary">
      ${Array.from({ length: 7 })
        .map(() => '<div class="ob-summary-row"><div class="ob-skeleton" style="height:14px;width:120px;"></div><div class="ob-skeleton" style="height:14px;width:160px;"></div></div>')
        .join('')}
    </div>
  `;

  let config;
  try {
    config = await Api.generateBotConfig(strategyId);
  } catch (err) {
    panelEl.querySelector('#obBotConfigSummary').innerHTML = `
      <div class="ob-empty"><p class="ob-empty-title">Configuration failed</p><p class="ob-empty-sub">${err.message}</p></div>
    `;
    showToast('Bot configuration failed — you can retry from this step.', { type: 'error' });
    return null;
  }

  panelEl.querySelector('#obBotConfigSummary').innerHTML = `
    <div class="ob-summary-row"><span class="ob-summary-label">Strategy</span><span class="ob-summary-value">${config.strategy}</span></div>
    <div class="ob-summary-row"><span class="ob-summary-label">Broker</span><span class="ob-summary-value">${config.broker}</span></div>
    <div class="ob-summary-row"><span class="ob-summary-label">Customer ID</span><span class="ob-summary-value mono">${config.customerId || customer.id}</span></div>
    <div class="ob-summary-row"><span class="ob-summary-label">Server</span><span class="ob-summary-value mono">${config.server}</span></div>
    <div class="ob-summary-row"><span class="ob-summary-label">Region</span><span class="ob-summary-value">${config.region}</span></div>
    <div class="ob-summary-row"><span class="ob-summary-label">Bot Version</span><span class="ob-summary-value mono">${config.botVersion}</span></div>
    <div class="ob-summary-row"><span class="ob-summary-label">Configuration Status</span><span class="ob-summary-value" style="color:var(--color-success)">${config.status || 'Ready'}</span></div>
  `;

  return config;
}
