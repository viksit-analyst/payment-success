// cardShell.js
// The only file in components/ that isn't a specific card. Holds the tiny
// bit of DOM-building boilerplate every card would otherwise repeat: a
// title row with an icon, a skeleton state, and a key/value list renderer.
// Keeps each card file focused purely on its own content (Single
// Responsibility, per VABR Coding Philosophy).

import { escapeHtml } from '../js/utils.js';

export function cardHeader(title, sub = '', icon = '') {
  return `
    <div class="dash-card-head">
      <div>
        <div class="dash-card-title">${icon}${escapeHtml(title)}</div>
        ${sub ? `<div class="dash-card-sub">${escapeHtml(sub)}</div>` : ''}
      </div>
    </div>`;
}

export function kvList(rows) {
  return `<dl style="margin:0;">${rows
    .map(([label, value]) => `<div class="kv-row"><dt>${escapeHtml(label)}</dt><dd>${value ?? '—'}</dd></div>`)
    .join('')}</dl>`;
}

export function skeleton(lines = 3) {
  return `
    <div class="skel skel-title"></div>
    ${Array.from({ length: lines }).map(() => '<div class="skel skel-line"></div>').join('')}`;
}

export function badge(label, variant) {
  return `<span class="badge badge-${variant}"><span class="status-dot"></span>${escapeHtml(label)}</span>`;
}

/** Renders `renderFn(state)` into `el` only when its inputs actually changed. */
export function bindCard(el, renderFn, selectFn) {
  let lastKey = null;
  return (state) => {
    const slice = selectFn ? selectFn(state) : state;
    const key = JSON.stringify(slice);
    if (key === lastKey) return;
    lastKey = key;
    el.innerHTML = renderFn(slice, state);
  };
}
