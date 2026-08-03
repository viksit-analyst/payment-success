/**
 * adminGuard.js
 * ─────────────────────────────────────────────────────────────────────────
 * Mission Control is administrator-only. This sits ON TOP of the shared,
 * frozen auth layer (auth/routeGuard.js) rather than duplicating it:
 * routeGuard.js already handles "is this a valid, logged-in session?" —
 * this file only adds the second check, "...and is that customer an
 * administrator?", before revealing anything in #mcApp.
 *
 * Include immediately after auth/routeGuard.js and before utils.js /
 * mission-control.js.
 *
 * ⚠ PRODUCTION TODO: this is a client-side convenience gate only. It reads
 * `user.role` / `user.isAdmin` from VA_API.me(), which the backend does not
 * currently return (see auth/api.js — response shape is today just
 * { customerId, name, email, bot }). Until AuthApi.gs adds a real role
 * field AND every Mission Control / adminAPI.js backend endpoint enforces
 * admin-only access server-side, this screen is UI polish, not security —
 * anyone can bypass it by editing JS. Do not treat this as sufficient
 * authorization on its own.
 * ───────────────────────────────────────────────────────────────────────── */
(function (global, document) {
  'use strict';

  // Hide the page immediately, before first paint, same technique
  // routeGuard.js uses for the login check — prevents a flash of admin
  // content for a logged-in-but-non-admin customer while we wait on
  // routeGuard's own async resolution.
  const style = document.createElement('style');
  style.id = 'va-admin-guard-style';
  style.textContent = `body { visibility: hidden !important; }`;
  document.head.appendChild(style);

  function reveal() {
    const s = document.getElementById('va-admin-guard-style');
    if (s) s.remove();
  }

  function denyAccess() {
    reveal();
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#060A12;color:#E8ECF3;font-family:Inter,system-ui,sans-serif;text-align:center;padding:24px;">
        <div>
          <div style="font-size:15px;font-weight:600;margin-bottom:8px;">Mission Control is restricted to administrators</div>
          <div style="font-size:13px;color:#8B93A7;margin-bottom:20px;">Your account doesn't have access to this area.</div>
          <a href="../dashboard/index.html" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#2E6BE6;color:#fff;text-decoration:none;font-size:13px;font-weight:600;">Back to Dashboard</a>
        </div>
      </div>`;
  }

  // M5 fix: Chart.js is no longer loaded unconditionally in <head> — most
  // visitors here are denied and never touch a chart. Loaded once, lazily,
  // only after admin access is confirmed below; mission-control.js waits
  // for the "va:admin-ready" event (fired once this resolves) before it
  // does any work, instead of running unconditionally on DOMContentLoaded.
  function loadChartJs_() {
    return new Promise((resolve, reject) => {
      if (global.Chart) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Chart.js'));
      document.head.appendChild(script);
    });
  }

  function signalAdminReady_() {
    document.dispatchEvent(new CustomEvent('va:admin-ready'));
  }

  const ROUTE_GUARD = global.VA_ROUTE_GUARD;
  if (!ROUTE_GUARD) {
    // auth/routeGuard.js wasn't loaded before this file — fail closed.
    denyAccess();
    return;
  }

  ROUTE_GUARD.onReady((user) => {
    const isAdmin = !!(user && (user.role === 'admin' || user.isAdmin === true));
    if (!isAdmin) {
      denyAccess();
      return;
    }
    reveal();
    loadChartJs_()
      .then(signalAdminReady_)
      .catch((err) => {
        // Charts won't render, but the rest of Mission Control (stats,
        // tables) doesn't depend on Chart.js — don't block it over this.
        console.error('[adminGuard] Chart.js failed to load:', err);
        signalAdminReady_();
      });
  });
})(window, document);
