/* ==========================================================================
   VIKSIT ANALYST — DASHBOARD API CLIENT
   dashboardApi.js

   Real client for DashboardApi.gs's read-only, session-authenticated
   endpoints (customer / subscription / payments / renewal / status).
   Classic global script — no import/export — loaded after auth/config.js
   and auth/api.js, before dashboard.js, exactly like brokerAPI.js is
   loaded relative to broker.js on the broker sub-page.

   SCOPE NOTE — deliberately does NOT call brokerStatus / botStatus /
   brokerOrders / brokerHoldings / brokerPositions / brokerFunds /
   brokerMargins / brokerProfile / marketStatus on BrokerRouter.gs.
   Tracing those dispatch cases back through TokenStore.gs, BrokerHealth.gs
   and VMConnector.gs shows they call brokerConfig_(), brokerDatabaseSheet_(),
   brokerAppCredentials_(), vmBridgeConfig_(), and every upstoxFetch*_()/
   upstoxBuildAuthUrl_()/upstoxCheckHealth_()/upstoxGetMarketStatus_() /
   upstoxVerifyPermissions_() helper — none of which are defined anywhere
   in this Apps Script project (Config.js has no BROKER or VM_BRIDGE block,
   and no file defines any of the upstox* functions). Calling those actions
   today returns a generic server error, not real broker data. Wiring the
   dashboard to them now would trade fabricated frontend data for a
   frontend that silently breaks against a backend that throws — same
   customer-trust problem, different layer. That gap needs fixing in the
   Apps Script project itself (new Broker Database sheet + config block +
   an actual Upstox API client) before this file's scope can safely grow
   to include it. See the accompanying delivery notes.
   ========================================================================== */

(function (global) {
  'use strict';

  const REQUEST_TIMEOUT_MS = 15000;

  function getApiBaseUrl_() {
    const url = global.VA_AUTH_CONFIG && global.VA_AUTH_CONFIG.API_BASE_URL;
    if (!url) throw new Error('API_BASE_URL is not configured. Make sure config.js loads before dashboardApi.js.');
    return url;
  }

  function getToken_() {
    const token = global.VA_SESSION && typeof global.VA_SESSION.getToken === 'function'
      ? global.VA_SESSION.getToken()
      : null;
    if (!token) throw new Error('No active session.');
    return token;
  }

  class DashboardApiError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'DashboardApiError';
      this.code = code || 'REQUEST_FAILED';
    }
  }

  /**
   * DashboardApi.gs's own contract: GET only, ?action=<name>, session
   * travels as `token` (see requireOwnerSession_ in DashboardApi.gs —
   * NOT `authorization`, which is BrokerRouter.gs's separate convention).
   * Response envelope is `{ success, ...namedFields }` — not wrapped in
   * a `data` key the way BrokerRouter.gs's apiSuccess_() wraps things.
   */
  async function request_(action, params) {
    const url = new URL(getApiBaseUrl_());
    url.searchParams.set('action', action);
    url.searchParams.set('token', getToken_());
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') throw new DashboardApiError('That took too long. Please try again.', 'TIMEOUT');
      throw new DashboardApiError("We couldn't reach Viksit Analyst. Check your connection and try again.", 'NETWORK_ERROR');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) throw new DashboardApiError(`Server error (${response.status})`, 'SERVER_ERROR');

    let data;
    try {
      data = await response.json();
    } catch (err) {
      throw new DashboardApiError('Received an invalid response from the server.', 'INVALID_RESPONSE');
    }

    if (!data || data.success !== true) {
      throw new DashboardApiError((data && data.error) || 'Request failed.', 'REQUEST_FAILED');
    }
    return data;
  }

  /** { id, name, email, phone, status, createdAt, lastPayment } */
  async function getCustomer() {
    const data = await request_('customer');
    return data.customer;
  }

  /** { bot, status, startDate, endDate, renewalDate, daysRemaining } — requires a resolvable bot key/name/alias */
  async function getSubscription(bot) {
    const data = await request_('subscription', { bot });
    return data.subscription;
  }

  /** [{ paymentId, bot, amount, currency, status, timestamp }, ...] */
  async function getPayments() {
    const data = await request_('payments');
    return data.payments;
  }

  /** { bot, status, endDate, renewalDate, daysRemaining, renewalDue } */
  async function getRenewal(bot) {
    const data = await request_('renewal', { bot });
    return data.renewal;
  }

  /**
   * { customer: {id,name,status}, subscriptions: [{bot,status,endDate,daysRemaining}, ...] }
   * The one endpoint that doesn't require already knowing which bot to
   * ask about — use this to discover a customer's active strategy/ies
   * before calling getSubscription()/getRenewal() for bot-specific detail.
   */
  async function getStatus() {
    const data = await request_('status');
    return { customer: data.customer, subscriptions: data.subscriptions };
  }

  /**
   * BrokerRouter.gs's contract differs from DashboardApi.gs's: token
   * travels as `authorization` (see authenticateRequest_ in
   * BrokerRouter.gs), and a successful response wraps its payload in
   * `data` (apiSuccess_() in ErrorCodes.gs) rather than a named
   * top-level field.
   *
   * SCOPE: only `botStatus` is called from here. It's the one
   * BrokerRouter.gs action verified safe to call end-to-end — its chain
   * (getBotStatus_ in BrokerHealth.gs -> fetchVmBotStatus_ in
   * VMConnector.gs -> vmBridgeConfig_) is now fully defined, and
   * getBotStatus_ already degrades to a STOPPED status rather than
   * throwing if the VM is unreachable or unconfigured. Every other
   * BrokerRouter.gs action (brokerStatus, brokerHealth, brokerOrders,
   * brokerHoldings, brokerPositions, brokerFunds, brokerMargins,
   * brokerProfile, marketStatus, ...) still depends on brokerConfig_(),
   * brokerDatabaseSheet_(), brokerAppCredentials_(), and the upstoxFetch*
   * family, none of which exist yet — see DELIVERY_NOTES.md.
   */
  async function callBrokerApi_(action, params) {
    const url = new URL(getApiBaseUrl_());
    url.searchParams.set('action', action);
    url.searchParams.set('authorization', getToken_());
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') throw new DashboardApiError('That took too long. Please try again.', 'TIMEOUT');
      throw new DashboardApiError("We couldn't reach Viksit Analyst. Check your connection and try again.", 'NETWORK_ERROR');
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) throw new DashboardApiError(`Server error (${response.status})`, 'SERVER_ERROR');

    let data;
    try {
      data = await response.json();
    } catch (err) {
      throw new DashboardApiError('Received an invalid response from the server.', 'INVALID_RESPONSE');
    }
    if (!data || data.success !== true) throw new DashboardApiError((data && data.message) || 'Request failed.', 'REQUEST_FAILED');
    return data.data;
  }

  /** { status, activeStrategy, heartbeatAt, server: {name, region} | null, latencyMs } */
  async function getBotStatus() {
    return callBrokerApi_('botStatus');
  }

  global.VA_DASHBOARD_API = Object.freeze({
    DashboardApiError,
    getCustomer,
    getSubscription,
    getPayments,
    getRenewal,
    getStatus,
    getBotStatus,
  });
})(window);
