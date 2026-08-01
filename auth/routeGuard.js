/**
 * routeGuard.js
 * ─────────────────────────────────────────────────────────────────────────
 * Include this on every protected page (dashboard.html, billing.html,
 * reports.html, downloads.html, profile.html, settings.html,
 * mission-control.html) — nowhere else.
 *
 *   <script src="/auth/config.js"></script>
 *   <script src="/auth/api.js"></script>
 *   <script src="/auth/session.js"></script>
 *   <script src="/auth/auth.js"></script>
 *   <script src="/auth/components/toast.js"></script>
 *   <script src="/auth/components/toast.css" ... (as a <link>, not here) />
 *   <script src="/auth/components/idle-warning.js"></script>
 *   <script src="/auth/routeGuard.js"></script>
 *
 * What it does, in order:
 *   1. Hides the page (visibility, not display, so layout doesn't jump)
 *      until a session is confirmed, to prevent a "flash of protected
 *      content" for logged-out visitors.
 *   2. Fast local check: if there's no locally-stored, non-expired
 *      session at all, redirect to login immediately — no need to wait
 *      on a network round trip to know a stranger is a stranger.
 *   3. Authoritative check: calls validateSession() against the backend.
 *      The local check is ONLY a fast path for the obvious case — the
 *      server is always the source of truth. If the server says invalid,
 *      the local session is cleared and the visitor is redirected, even
 *      if the local expiry timestamp said otherwise.
 *   4. On success: reveals the page, and arms idle-timeout monitoring,
 *      silent session refresh, and cross-tab logout sync.
 *
 * This file has no exports other than a small manual-control surface
 * (window.VA_ROUTE_GUARD) for pages that need to know once the guard has
 * finished (e.g. to render the signed-in user's name).
 * ───────────────────────────────────────────────────────────────────────── */

(function (global, document) {
  'use strict';

  const CONFIG = global.VA_AUTH_CONFIG;
  const API = global.VA_API;
  const SESSION = global.VA_SESSION;
  const AUTH = global.VA_AUTH;

  if (!CONFIG || !API || !SESSION || !AUTH) {
    throw new Error('[routeGuard.js] Missing dependency — load config.js, api.js, session.js, auth.js first.');
  }

  const readyCallbacks = [];
  let resolved = false;
  let currentUser = null;

  // ── Step 1: hide the page synchronously, before first paint ──────────
  const style = document.createElement('style');
  style.id = 'va-route-guard-style';
  style.textContent = `
    html:not(.va-ready) body { visibility: hidden !important; }
    .va-route-guard-overlay {
      visibility: visible !important;
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: #060A12;
    }
    .va-route-guard-spinner {
      width: 28px; height: 28px; border-radius: 50%;
      border: 3px solid rgba(46,107,230,0.25); border-top-color: #2E6BE6;
      animation: va-route-guard-spin 700ms linear infinite;
    }
    @keyframes va-route-guard-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .va-route-guard-spinner { animation: none; }
    }
  `;
  document.head.appendChild(style);

  function mountOverlay() {
    if (document.getElementById('va-route-guard-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'va-route-guard-overlay';
    overlay.className = 'va-route-guard-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    const spinner = document.createElement('div');
    spinner.className = 'va-route-guard-spinner';
    overlay.appendChild(spinner);
    (document.body || document.documentElement).appendChild(overlay);
  }

  function reveal() {
    document.documentElement.classList.add('va-ready');
    const overlay = document.getElementById('va-route-guard-overlay');
    if (overlay) overlay.remove();
  }

  function redirectToLogin() {
    const target = `${CONFIG.ROUTES.LOGIN}?redirect=${encodeURIComponent(global.location.pathname)}`;
    global.location.replace(target);
  }

  // ── Step 4: idle timeout + silent refresh + cross-tab sync ───────────
  let idleMonitor = null;

  function armSessionLifecycle() {
    const idleModal = global.VA_IDLE_WARNING
      ? global.VA_IDLE_WARNING.createIdleWarningModal({
          onExtend: async () => {
            try {
              const res = await API.refreshSession();
              SESSION.extendSession(res);
              if (idleMonitor) idleMonitor.reset();
            } catch (err) {
              if (global.VA_TOAST) global.VA_TOAST.error(AUTH.describeError(err));
              AUTH.logout();
            }
          },
          onLogout: () => AUTH.logout(),
        })
      : null;

    idleMonitor = SESSION.createIdleMonitor({
      onWarning: () => {
        if (idleModal) idleModal.open();
      },
      onTimeout: () => AUTH.logout(),
    });
    idleMonitor.start();

    const refreshScheduler = SESSION.createSilentRefreshScheduler(async () => {
      try {
        const res = await API.refreshSession();
        SESSION.extendSession(res);
      } catch (err) {
        // A transient network hiccup shouldn't log the user out — only
        // an explicit auth failure should. The next validateSession() on
        // navigation will catch anything the refresh silently missed.
        if (err instanceof API.ApiError && (err.code === API.ErrorCodes.UNAUTHORIZED || err.code === API.ErrorCodes.SESSION_EXPIRED)) {
          AUTH.logout();
        }
      }
    });
    refreshScheduler.start();

    SESSION.onCrossTabLogout(() => {
      if (idleMonitor) idleMonitor.stop();
      refreshScheduler.stop();
      redirectToLogin();
    });
  }

  // ── Main sequence ──────────────────────────────────────────────────────
  async function guard() {
    // Fast path: no local session at all → don't even ask the server.
    if (!SESSION.isValidLocally()) {
      redirectToLogin();
      return;
    }

    try {
      const result = await API.validateSession();
      if (!result || result.valid !== true) {
        throw new API.ApiError(API.ErrorCodes.SESSION_EXPIRED, 'Session is no longer valid.');
      }
      if (result.expiresAt) {
        SESSION.extendSession({ expiresAt: result.expiresAt });
      }
      if (result.user) {
        SESSION.setUser(result.user);
      }
      currentUser = SESSION.getUser();

      reveal();
      armSessionLifecycle();

      resolved = true;
      readyCallbacks.splice(0).forEach((cb) => cb(currentUser));
    } catch (err) {
      SESSION.clearSession();
      redirectToLogin();
    }
  }

  function init() {
    if (document.body) {
      mountOverlay();
    } else {
      document.addEventListener('DOMContentLoaded', mountOverlay, { once: true });
    }
    guard();
  }

  /**
   * Register a callback for when the guard finishes successfully.
   * Fires immediately with the current user if the guard already resolved.
   * @param {(user: object|null) => void} callback
   */
  function onReady(callback) {
    if (typeof callback !== 'function') return;
    if (resolved) {
      callback(currentUser);
    } else {
      readyCallbacks.push(callback);
    }
  }

  global.VA_ROUTE_GUARD = Object.freeze({ onReady });

  init();
})(window, document);
