/**
 * success.js
 * AUDIT FIX (H6): payment_id used to be trusted straight from the URL with
 * no server-side check — a hand-crafted link showed this exact "success"
 * screen without anyone paying. Polls DashboardApi.gs's paymentStatus
 * action until the payment is confirmed DONE, and only then shows the
 * real Payment ID.
 *
 * UX ADDITION: a visible spinner runs for the whole verifying/polling
 * window instead of just changing text — the previous version left the
 * user staring at static text with no sense that anything was happening.
 */
(function () {
  'use strict';

  var SCRIPT_URL = window.VA_AUTH_CONFIG && window.VA_AUTH_CONFIG.API_BASE_URL;
  var POLL_INTERVAL_MS = 3000;
  var MAX_POLLS = 20; // ~60s, matches DashboardApi.gs's documented polling contract

  var paymentIdEl = document.getElementById('paymentId');
  var spinnerEl = document.getElementById('paymentSpinner');
  var subtitleEl = document.querySelector('.subtitle');
  var params = new URLSearchParams(window.location.search);
  var paymentId = params.get('payment_id');

  function setSpinner(visible) {
    if (spinnerEl) spinnerEl.style.display = visible ? 'inline-block' : 'none';
  }

  function showUnavailable(message) {
    setSpinner(false);
    paymentIdEl.textContent = 'Unavailable';
    if (subtitleEl && message) subtitleEl.textContent = message;
  }

  if (!paymentId || !SCRIPT_URL) {
    showUnavailable('We could not find a payment reference for this page. If you just paid, check your email for confirmation.');
    return;
  }

  setSpinner(true);
  paymentIdEl.textContent = 'Verifying…';

  var pollCount = 0;
  function poll() {
    pollCount++;
    fetch(SCRIPT_URL + '?action=paymentStatus&paymentId=' + encodeURIComponent(paymentId))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.success) {
          showUnavailable('We could not verify this payment. Contact support with your Payment ID if you were charged.');
          return;
        }
        if (data.status === 'DONE') {
          setSpinner(false);
          paymentIdEl.textContent = paymentId;
          return;
        }
        if (data.status === 'FAILED') {
          showUnavailable(data.message || 'We could not process this payment automatically. Our team has been notified.');
          return;
        }
        if (pollCount < MAX_POLLS) {
          setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          showUnavailable('Still processing — this is taking longer than usual. Contact support with your Payment ID if this persists.');
        }
      })
      .catch(function () {
        if (pollCount < MAX_POLLS) {
          setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          showUnavailable('We could not reach our servers to verify this payment.');
        }
      });
  }

  poll();
})();
