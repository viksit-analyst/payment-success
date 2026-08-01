// strategyCard.js — the full-width card where the customer picks IVRV /
// Gamma Flip / VWAP and activates it. Delegates all gating and transport
// to strategyActivation.js; this file only renders and wires clicks.

import { cardHeader } from './cardShell.js';
import { escapeHtml } from '../utils.js';
import {
  STRATEGIES, selectStrategy, getSelectedStrategyId, canActivate, activate, deactivate,
} from '../strategyActivation.js';

const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17l5-5 4 4 9-9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const STRATEGY_ICONS = {
  STR001: `<svg class="strategy-pick-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  STR002: `<svg class="strategy-pick-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 2 4 14h6l-1 8 10-13h-6z" stroke-linejoin="round"/></svg>`,
  STR003: `<svg class="strategy-pick-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 17l5-6 4 3 7-9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function render(state) {
  const selected = getSelectedStrategyId();
  const activeStrategy = state.bot?.activeStrategy;

  const cards = STRATEGIES.map((s) => {
    const isSelected = selected === s.id;
    const isRunning = activeStrategy === s.id && state.bot?.status === 'RUNNING';
    return `
      <button class="strategy-pick ${isSelected ? 'is-selected' : ''}" style="--strategy-color:${s.color}" data-strategy="${s.id}" type="button">
        ${STRATEGY_ICONS[s.id]}
        <div class="strategy-pick-name">${escapeHtml(s.name)}${isRunning ? ' <span style="color:var(--color-success); font-size:var(--fs-2xs);">● running</span>' : ''}</div>
        <div class="strategy-pick-sub">${escapeHtml(s.tagline)}</div>
      </button>`;
  }).join('');

  const check = selected ? canActivate(selected) : { allowed: false, reason: null };
  const activeCard = STRATEGIES.find((s) => s.id === activeStrategy);
  const isRunningSelected = activeStrategy === selected && state.bot?.status === 'RUNNING';

  return `
    ${cardHeader('Activate a strategy', 'Choose one strategy at a time to run on this broker connection.', icon)}
    <div class="strategy-pick-grid">${cards}</div>
    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
      <button class="btn btn-primary" data-action="activate" ${!selected || !check.allowed || isRunningSelected ? 'disabled' : ''}>
        ${isRunningSelected ? 'Running' : 'Activate'}
      </button>
      ${activeStrategy && state.bot?.status === 'RUNNING' ? `<button class="btn btn-ghost" data-action="deactivate">Stop ${escapeHtml(activeCard?.name || '')}</button>` : ''}
      ${selected && !check.allowed && check.reason ? `<span style="font-size:var(--fs-xs); color:var(--text-tertiary);">${escapeHtml(check.reason)}</span>` : ''}
    </div>
  `;
}

export function mountStrategyCard(el, getState) {
  const repaint = () => { el.innerHTML = render(getState()); };

  el.addEventListener('click', async (e) => {
    const pick = e.target.closest('[data-strategy]');
    if (pick) {
      selectStrategy(pick.dataset.strategy);
      repaint();
      return;
    }
    if (e.target.closest('[data-action="activate"]')) {
      const id = getSelectedStrategyId();
      if (id) { await activate(id); repaint(); }
    }
    if (e.target.closest('[data-action="deactivate"]')) {
      const id = getSelectedStrategyId();
      if (id) { await deactivate(id); repaint(); }
    }
  });

  return repaint;
}
