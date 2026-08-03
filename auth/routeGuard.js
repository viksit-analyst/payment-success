/**
 * routeGuard.js
 * ─────────────────────────────────────────────────────────────────────────
 * Include this on every protected page (dashboard/index.html, and any
 * future page under /dashboard/ that isn't itself part of the SPA) —
 * nowhere else.
 *
 *   <script src="/auth/config.js"></script>
 *   <script src="/auth/api.js"></script>
 *   <script src="/auth/session.js"></script>
 *   <script src="/auth/auth.js"></script>
 *   <script src="/auth/components/toast.js"></script>
 *   <script src="/auth/components/toast.css" ... (as a <link>, not here) />
 *   <script src="/auth/routeGuard.js"></script>
 *
 * idle-warning.js is OPTIONAL and does not currently exist in this repo —
 * this file checks `global.VA_IDLE_WARNING` and simply skips the
 * "are you still there?" modal if it's absent (idle logout itself still
 * works via SESSION.createIdleMonitor's onTimeout, just without a warning
 * first). Add /auth/components/idle-warning.js later if that UX is
 * wanted; nothing here needs to change when it's added — it's picked up
 * automatically.
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

  // NOTE — no refreshSession(). The backend has no such action and
  // SessionRepository.gs has no "extend expiry" method at all; a
  // session's expiry is fixed at login (24h, or 30d if remembered) and
  // cannot be pushed out. Both places that used to call
  // API.refreshSession() below now call API.validateSession() instead —
  // that re-confirms the session is still ACTIVE server-side (catches
  // revocation/logout-elsewhere) without pretending to extend anything.
  // Practically: "Extend Session" resets the LOCAL idle timer (giving
  // more time before the idle-timeout fires), but the token's own
  // server-side expiry is unaffected either way — a session that's 5
  // minutes from its real expiry will still end then, idle or not.
  function armSessionLifecycle() {
    const idleModal = global.VA_IDLE_WARNING
      ? global.VA_IDLE_WARNING.createIdleWarningModal({
          onExtend: async () => {
            try {
              const res = await API.validateSession();
              if (res.expiresAt) SESSION.extendSession({ expiresAt: res.expiresAt });
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

    const revalidateScheduler = SESSION.createSilentRefreshScheduler(async () => {
      try {
        await API.validateSession();
        // Deliberately not extending local expiry from this response —
        // the server-reported expiry hasn't changed and won't; this
        // call exists purely to detect early revocation between full
        // page loads, not to keep the session alive longer than its
        // original grant.
      } catch (err) {
        // A transient network hiccup shouldn't log the user out — only
        // an explicit auth failure should. The next validateSession() on
        // navigation will catch anything this silently missed.
        if (err instanceof API.ApiError && (err.code === API.ErrorCodes.UNAUTHORIZED || err.code === API.ErrorCodes.SESSION_EXPIRED)) {
          AUTH.logout();
        }
      }
    });
    revalidateScheduler.start();

    SESSION.onCrossTabLogout(() => {
      if (idleMonitor) idleMonitor.stop();
      revalidateScheduler.stop();
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
