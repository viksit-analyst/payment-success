// utils.js
// Shared, dependency-free helpers used by every module in this folder.
// Nothing broker-specific lives here — just the small things that would
// otherwise get copy-pasted into every file (VABR Coding Philosophy: no
// duplicated logic).

/**
 * Reads a config value injected by the host page.
 * The portal sets `window.VIKSIT_CONFIG` once, server-side/at build time,
 * so no secrets or environment branching live in committed JS.
 */
export function getConfig() {
  const cfg = window.VIKSIT_CONFIG || {};
  return {
    apiBase: cfg.apiBase || '/api', // Apps Script Web App exec URL, reverse-proxied
    customerId: cfg.customerId || null,
    sessionToken: cfg.sessionToken || null, // portal session JWT, NOT a broker token
    pollIntervalMs: cfg.pollIntervalMs || 15000,
  };
}

/** Formats an ISO date as a short, human relative string ("2m ago"). */
export function timeAgo(iso) {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return '—';
  const s = Math.max(0, Math.floor(diffMs / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Formats milliseconds as a countdown string ("4h 12m"). */
export function formatCountdown(ms) {
  if (ms == null || ms <= 0) return 'expired';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatCurrencyINR(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
}

/** Minimal, dependency-free HTML escaping for text interpolated into templates. */
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let toastStackEl = null;
/** Renders a transient inline alert. Never used for anything requiring confirmation. */
export function showToast(message, variant = 'info') {
  toastStackEl = toastStackEl || document.getElementById('toastStack');
  if (!toastStackEl) return;
  const el = document.createElement('div');
  el.className = `va-toast ${variant === 'error' ? 'is-error' : variant === 'success' ? 'is-success' : variant === 'warning' ? 'is-warning' : ''}`;
  el.textContent = message;
  toastStackEl.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

/** Tiny pub/sub used to keep components in sync without a framework. */
export function createEventBus() {
  const listeners = new Map();
  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => listeners.get(event)?.delete(fn);
    },
    emit(event, payload) {
      listeners.get(event)?.forEach((fn) => fn(payload));
    },
  };
}
