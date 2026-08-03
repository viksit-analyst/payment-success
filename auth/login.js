/**
 * login.js
 * ─────────────────────────────────────────────────────────────────────────
 * Thin DOM binding for login.html. All actual logic (validation, the
 * sendOTP call, pending-state storage) lives in auth.js — this file only
 * reads the form, shows/hides UI state, and hands off to auth.js.
 *
 * Depends on: config.js, api.js, session.js, auth.js, components/toast.js
 * ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  const CONFIG = window.VA_AUTH_CONFIG;
  const API = window.VA_API;
  const AUTH = window.VA_AUTH;
  const TOAST = window.VA_TOAST;

  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('emailError');
  const termsCheckbox = document.getElementById('acceptTerms');
  const termsError = document.getElementById('termsError');
  const rememberCheckbox = document.getElementById('rememberDevice');
  const continueBtn = document.getElementById('continueBtn');
  const formStatus = document.getElementById('formStatus');
  const resumeBanner = document.getElementById('resumeBanner');
  const resumeBannerText = document.getElementById('resumeBannerText');
  const resumeContinueBtn = document.getElementById('resumeContinue');

  let submitting = false;

  // ── H3 fix: a logged-in visitor landing here (bookmark, back button,
  //    stale tab) shouldn't see the login form again — bounce them
  //    straight to the dashboard. This mirrors routeGuard.js's own fast
  //    LOCAL check (isValidLocally()); it deliberately does not also call
  //    the authoritative API.validateSession() here — that round trip
  //    happens on the destination page itself (routeGuard.js), so a
  //    revoked-but-not-yet-expired session still gets caught immediately
  //    after the bounce instead of delaying this redirect on a network call.
  function redirectIfAlreadyLoggedIn() {
    if (window.VA_SESSION && window.VA_SESSION.isValidLocally()) {
      window.location.replace(withRedirectParam(CONFIG.ROUTES.DEFAULT_AFTER_LOGIN));
      return true;
    }
    return false;
  }

  // ── If a pending login already exists (e.g. user hit "back" from
  //    verify.html), offer to resume it instead of starting over silently.
  function checkForPendingLogin() {
    const pending = AUTH.getPendingLogin();
    if (!pending) return;

    resumeBannerText.textContent = `We already sent a code to ${AUTH.maskEmail(pending.email)}.`;
    resumeBanner.hidden = false;
    emailInput.value = pending.email;
  }

  resumeContinueBtn?.addEventListener('click', () => {
    window.location.href = withRedirectParam(CONFIG.ROUTES.VERIFY);
  });

  function withRedirectParam(basePath) {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (!redirect) return basePath;
    const url = new URL(basePath, window.location.origin);
    url.searchParams.set('redirect', redirect);
    return url.pathname + url.search;
  }

  function setFieldError(inputEl, errorEl, message) {
    errorEl.textContent = message || '';
    inputEl.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function clearErrors() {
    setFieldError(emailInput, emailError, '');
    termsError.textContent = '';
    formStatus.hidden = true;
    formStatus.textContent = '';
  }

  function setLoading(isLoading) {
    submitting = isLoading;
    continueBtn.disabled = isLoading;
    continueBtn.classList.toggle('is-loading', isLoading);
    continueBtn.querySelector('.va-btn-label').toggleAttribute('hidden', isLoading);
    continueBtn.querySelector('.va-btn-loading').toggleAttribute('hidden', !isLoading);
  }

  function showFormError(message) {
    formStatus.textContent = message;
    formStatus.hidden = false;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    clearErrors();

    const email = emailInput.value.trim();
    const remember = rememberCheckbox.checked;

    // Client-side validation first — cheap, instant feedback, zero network cost.
    const { valid, reason } = AUTH.validateEmail(email);
    if (!valid) {
      setFieldError(emailInput, emailError, reason);
      emailInput.focus();
      return;
    }
    if (!termsCheckbox.checked) {
      termsError.textContent = 'Please accept the Terms of Service and Privacy Policy to continue.';
      termsCheckbox.focus();
      return;
    }

    setLoading(true);
    try {
      await AUTH.startLogin(email, remember);
      window.location.href = withRedirectParam(CONFIG.ROUTES.VERIFY);
      // Intentionally no setLoading(false) on success — we're navigating away.
    } catch (err) {
      setLoading(false);
      const message = AUTH.describeError(err);
      if (err instanceof API.ApiError && err.code === API.ErrorCodes.INVALID_EMAIL) {
        setFieldError(emailInput, emailError, message);
        emailInput.focus();
      } else if (err instanceof API.ApiError && err.code === API.ErrorCodes.EMAIL_NOT_FOUND) {
        setFieldError(emailInput, emailError, message);
        emailInput.focus();
      } else {
        showFormError(message);
        TOAST.error(message, { title: 'Couldn\u2019t send code' });
      }
    }
  }

  form.addEventListener('submit', handleSubmit);

  // Clear the inline error the moment the user starts fixing the field —
  // don't make them re-submit just to see the error disappear.
  emailInput.addEventListener('input', () => setFieldError(emailInput, emailError, ''));
  termsCheckbox.addEventListener('change', () => {
    if (termsCheckbox.checked) termsError.textContent = '';
  });

  if (!redirectIfAlreadyLoggedIn()) {
    checkForPendingLogin();
    emailInput.focus();
  }
})();
