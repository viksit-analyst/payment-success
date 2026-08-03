// sessionBridge.js
// ---------------------------------------------------------------------------
// FULL PLATFORM INTEGRATION — auth bridge for the Broker module.
//
// The broker widget already has its own config contract: utils.js#getConfig()
// reads window.VIKSIT_CONFIG.{apiBase, customerId, sessionToken}. Before this
// change nothing ever set that global, so the broker page ran against
// whatever the (missing) defaults were.
//
// This file is the ONLY place that bridges the two systems. It does not
// duplicate login, API client, or session logic — it reuses the frozen
// auth layer (auth/session.js, auth/routeGuard.js) that already gates this
// page, and simply republishes the logged-in customer + token in the shape
// brokerAPI.js already expects.
// ---------------------------------------------------------------------------

/**
 * Resolves once routeGuard has confirmed a valid session, having populated
 * window.VIKSIT_CONFIG from that real session. Rejects if the auth layer
 * isn't present on the page (broker.html must load auth/*.js first).
 * @returns {Promise<object>} the VIKSIT_CONFIG that was set
 */
export function waitForAuthenticatedConfig() {
  return new Promise((resolve, reject) => {
    if (!window.VA_ROUTE_GUARD || !window.VA_SESSION) {
      reject(new Error(
        '[broker] Shared auth layer not found. Include auth/config.js, ' +
        'auth/api.js, auth/session.js, auth/auth.js and auth/routeGuard.js ' +
        'before js/broker.js on this page.'
      ));
      return;
    }

    // onReady fires once routeGuard has validated the session with the
    // backend (or immediately, if that already happened). It never fires
    // for an unauthenticated visitor — routeGuard redirects those to
    // /auth/login.html before this promise would ever resolve.
    window.VA_ROUTE_GUARD.onReady((user) => {
      if (!user) {
        reject(new Error('[broker] routeGuard resolved without a user.'));
        return;
      }

      const existing = window.VIKSIT_CONFIG || {};
      window.VIKSIT_CONFIG = Object.assign({}, existing, {
        // M2 fix: this used to fall back to the placeholder '/api', which
        // resolves nowhere on this static-hosting setup. BrokerRouter.gs's
        // actions are actually routed through the SAME Apps Script Web
        // App's doGet()/doPost() as the payment/auth backend (see
        // isBrokerApiAction_ in Code.gs) — there's only one deployment URL
        // for this whole platform, already published as
        // window.VA_AUTH_CONFIG.API_BASE_URL by auth/config.js (loaded
        // before this file on every page that includes it). Fall back to
        // that instead; see utils.js#getConfig for the matching default.
        apiBase: existing.apiBase || (window.VA_AUTH_CONFIG && window.VA_AUTH_CONFIG.API_BASE_URL) || null,
        customerId: user.customerId || user.id || null,
        // Same portal session token used for every other authenticated
        // call — never a broker access/refresh token.
        sessionToken: window.VA_SESSION.getToken(),
      });

      resolve(window.VIKSIT_CONFIG);
    });
  });
}
