/**
 * components/toast.js
 * ─────────────────────────────────────────────────────────────────────────
 * Toast notification manager for the Viksit Analyst authentication module
 * (login.html, verify.html) and anything else that loads it. Plain browser
 * script — no ES module syntax, no `import`/`export`. Include with a
 * regular <script> tag and it attaches itself to `window`.
 *
 * Usage:
 *   VA_TOAST.success('Signed in successfully.');
 *   VA_TOAST.error('That code isn\u2019t right.', { title: 'Verification failed' });
 *   VA_TOAST.warning('Your session will expire soon.');
 *   VA_TOAST.info('A new code is on its way.');
 *
 * Design system: uses only CSS custom properties and classes already
 * defined in styles.css and components/auth.css (--bg-raised, --border-*,
 * --text-*, --color-success/--color-error/--color-accent/--color-ivrv,
 * --radius-*, --shadow-lg, --dur-*, --ease-*, .va-toast*). Defines no
 * colors or fonts of its own. Never uses window.alert().
 *
 * Security: every piece of dynamic text passed in here (message, title)
 * is rendered via `textContent`, never `innerHTML`. Only the fixed,
 * hardcoded icon markup below is ever set via innerHTML.
 *
 * Exposes: window.VA_TOAST
 * ───────────────────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  var region = null;
  var liveRegion = null;

  function ensureRegion() {
    if (region) return region;

    region = document.createElement('div');
    region.className = 'va-toast-region';
    region.setAttribute('role', 'presentation');
    document.body.appendChild(region);

    // Visually-hidden live region so screen readers announce toasts even
    // though the visible toast markup itself is decorative/presentational.
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.className = 'va-sr-only';
    document.body.appendChild(liveRegion);

    return region;
  }

  // Fixed, non-dynamic SVG path markup only — never built from user- or
  // server-provided strings.
  var ICONS = {
    success: '<path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01" stroke-linecap="round"/>',
    warning: '<path d="M12 9v4M12 17h.01" stroke-linecap="round"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke-linejoin="round"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1" stroke-linecap="round"/>',
  };

  var DEFAULT_DURATIONS = {
    success: 4000,
    info: 4000,
    warning: 5000,
    error: 6000,
  };

  /**
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {string} message
   * @param {{ title?: string, duration?: number }} [opts]
   * @returns {{ dismiss: function(): void }}
   */
  function show(type, message, opts) {
    opts = opts || {};
    ensureRegion();

    var duration = typeof opts.duration === 'number' ? opts.duration : DEFAULT_DURATIONS[type] || 4000;

    var el = document.createElement('div');
    el.className = 'va-toast va-toast--' + type;
    el.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');

    var iconWrap = document.createElement('svg');
    iconWrap.setAttribute('class', 'va-toast-icon');
    iconWrap.setAttribute('viewBox', '0 0 24 24');
    iconWrap.setAttribute('fill', 'none');
    iconWrap.setAttribute('stroke', 'currentColor');
    iconWrap.setAttribute('stroke-width', '2');
    iconWrap.setAttribute('aria-hidden', 'true');
    iconWrap.innerHTML = ICONS[type] || ICONS.info; // fixed, non-dynamic markup only — see header note

    var body = document.createElement('div');
    body.className = 'va-toast-body';

    if (opts.title) {
      var titleEl = document.createElement('p');
      titleEl.className = 'va-toast-title';
      titleEl.textContent = opts.title; // safe: textContent, never innerHTML
      body.appendChild(titleEl);
    }

    var msgEl = document.createElement('p');
    msgEl.className = 'va-toast-message';
    msgEl.textContent = message; // safe: textContent, never innerHTML
    body.appendChild(msgEl);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'va-toast-close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>';

    el.appendChild(iconWrap);
    el.appendChild(body);
    el.appendChild(closeBtn);
    region.appendChild(el);

    liveRegion.textContent = (opts.title ? opts.title + ': ' : '') + message;

    var dismissTimer = null;

    function dismiss() {
      if (el.dataset.leaving) return;
      el.dataset.leaving = 'true';
      el.classList.add('is-leaving');
      if (dismissTimer) clearTimeout(dismissTimer);
      el.addEventListener('animationend', function () { el.remove(); }, { once: true });
      setTimeout(function () { if (el.parentNode) el.remove(); }, 400); // fallback if animationend never fires
    }

    closeBtn.addEventListener('click', dismiss);
    if (duration > 0) dismissTimer = setTimeout(dismiss, duration);

    return { dismiss: dismiss };
  }

  global.VA_TOAST = Object.freeze({
    success: function (message, opts) { return show('success', message, opts); },
    error: function (message, opts) { return show('error', message, opts); },
    warning: function (message, opts) { return show('warning', message, opts); },
    info: function (message, opts) { return show('info', message, opts); },
  });
})(window);
