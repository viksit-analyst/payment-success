/**
 * analytics.js — GA4 (Google Analytics 4) initialization for Viksit
 * Analyst's PUBLIC marketing/content pages only.
 *
 * Measurement ID: G-ZERLHNSJWG (current/correct ID — do not swap this
 * for any other Measurement ID without updating it here and only here;
 * this is the single source of truth for the site's GA4 ID).
 *
 * - Same-origin file, loaded with `defer` from each page's <head> or
 *   before </body> (non-blocking either way since `defer` never blocks
 *   parsing).
 * - Injects Google's own gtag.js asynchronously — this file does not
 *   bundle or proxy Google's script, just loads it the standard way.
 * - Basic pageview/event measurement only: no User-ID, no PII, no
 *   Google Signals, no advertising features. Do not add any of those
 *   here without a separate, explicit decision to do so.
 * - Not included on admin, auth, dashboard, onboarding, or payment
 *   success/callback pages by design — see broker.html/success.html
 *   etc., which intentionally do NOT reference this file.
 */
(function () {
  var GA_MEASUREMENT_ID = 'G-ZERLHNSJWG';

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
  document.head.appendChild(script);

  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID);
})();
