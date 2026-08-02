/**
 * utils.js — Mission Control
 * ---------------------------------------------------------------------------
 * Shared, dependency-free helpers used across admin/*.js. Plain global
 * script (no bundler in this project), namespaced under `window.AdminUtils`
 * so it never collides with the `MC` controller in mission-control.js or
 * with adminAPI.js's `adminAPI` namespace.
 *
 * Load order (see admin/index.html): utils.js → charts.js → adminAPI.js →
 * mission-control.js.
 * ---------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  /** Escapes HTML-significant characters. Every render*Table() function in
   * mission-control.js interpolates customer-entered strings (names, emails,
   * ticket subjects) into innerHTML — always pass them through this first. */
  function escapeHtml(value) {
    if (value == null) return '';
    return String(value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function formatINR(amount, { decimals = 0 } = {}) {
    const n = Number(amount) || 0;
    const sign = n < 0 ? '-' : '';
    return `${sign}₹${Math.abs(n).toLocaleString('en-IN', {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    })}`;
  }

  function formatDate(input, opts) {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', opts || { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function timeAgo(input) {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '—';
    const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.round(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return formatDate(d);
  }

  /** Maps a VADS status enum to one of Mission Control's five badge tones
   * (see .mc-badge-status.{tone} in styles.css / mission-control.css) so
   * every module (customers, payments, brokers…) colors statuses the same
   * way instead of re-deriving the mapping per view. */
  const STATUS_TONE = {
    // Subscription Status
    ACTIVE: 'operational', PENDING: 'warning', GRACE_PERIOD: 'warning',
    PAUSED: 'warning', CANCELLED: 'neutral', EXPIRED: 'critical', ARCHIVED: 'neutral',
    // Broker Status
    NOT_CONNECTED: 'neutral', CONNECTED: 'operational', TOKEN_PENDING: 'warning',
    TOKEN_VALID: 'operational', TOKEN_EXPIRED: 'critical', LOGIN_REQUIRED: 'critical', DISABLED: 'neutral',
    // Payment Status
    PAID: 'operational', FAILED: 'critical', REFUNDED: 'neutral', CHARGEBACK: 'critical',
    // Mission Control Status
    OPERATIONAL: 'operational', WARNING: 'warning', DEGRADED: 'warning', MAINTENANCE: 'warning', OFFLINE: 'critical',
  };
  function statusTone(status) { return STATUS_TONE[status] || 'neutral'; }

  function debounce(fn, ms) {
    let t;
    return function debounced(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  global.AdminUtils = { escapeHtml, formatINR, formatDate, timeAgo, statusTone, STATUS_TONE, debounce, clamp };
})(window);
