/**
 * verify.js
 * ─────────────────────────────────────────────────────────────────────────
 * Thin DOM binding for verify.html. Flow logic (verifyOTP call, resend,
 * pending-state storage) lives in auth.js; this file owns timers, the OTP
 * input widget, and the three visual states (form / success / locked).
 *
 * Depends on: config.js, api.js, session.js, auth.js, components/toast.js,
 *             components/otp-input.js
 * ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  const CONFIG = window.VA_AUTH_CONFIG;
  const API = window.VA_API;
  const AUTH = window.VA_AUTH;
  const SESSION = window.VA_SESSION;
  const TOAST = window.VA_TOAST;
  const OTP = window.VA_OTP_INPUT;

  // ── Bail out immediately if there's no pending login to verify ────────
  const pending = AUTH.getPendingLogin();
  if (!pending) {
    window.location.replace(withRedirectParam(CONFIG.ROUTES.LOGIN));
    return; // eslint-disable-line no-useless-return
  }

  function withRedirectParam(basePath) {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    if (!redirect) return basePath;
    const url = new URL(basePath, window.location.origin);
    url.searchParams.set('redirect', redirect);
    return url.pathname + url.search;
  }

  // ── Element refs ────────────────────────────────────────────────────
  const form = document.getElementById('verifyForm');
  const successState = document.getElementById('successState');
  const lockedState = document.getElementById('lockedState');
  const verifyEmailEl = document.getElementById('verifyEmail');
  const otpGroupEl = document.getElementById('otpGroup');
  const otpError = document.getElementById('otpError');
  const attemptsNote = document.getElementById('attemptsNote');
  const verifyBtn = document.getElementById('verifyBtn');
  const otpExpiry = document.getElementById('otpExpiry');
  const otpExpiryText = document.getElementById('otpExpiryText');
  const resendBtn = document.getElementById('resendBtn');
  const resendCooldownText = document.getElementById('resendCooldownText');
  const resendCooldownSpan = document.getElementById('resendCooldown');
  const changeEmailBtn = document.getElementById('changeEmailBtn');
  const restartBtn = document.getElementById('restartBtn');

  verifyEmailEl.textContent = AUTH.maskEmail(pending.email); // textContent only — never innerHTML

  let attempts = pending.attempts || 0;
  let submitting = false;
  let otpIsExpired = false;
  let tickHandle = null;

  const otpInput = OTP.createOtpInput(otpGroupEl, {
    length: CONFIG.OTP_LENGTH,
    onComplete: (code) => handleVerify(code),
  });
  otpInput.focusFirst();

  // ── Timers: OTP expiry + resend cooldown ───────────────────────────────
  // Both are derived from `pending.sentAt` on every tick rather than
  // decremented as local counters, so they stay correct even if the tab
  // was backgrounded/throttled and ticks were skipped.

  function formatMMSS(totalSeconds) {
    const s = Math.max(totalSeconds, 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
  }

  function tick() {
    const current = AUTH.getPendingLogin();
    if (!current) return; // expired/cleared elsewhere (e.g. change email)

    const elapsed = Math.floor((Date.now() - current.sentAt) / 1000);
    const otpRemaining = CONFIG.OTP_EXPIRY_SECONDS - elapsed;
    const cooldownRemaining = CONFIG.RESEND_COOLDOWN_SECONDS - elapsed;

    // OTP expiry display
    if (otpRemaining <= 0) {
      if (!otpIsExpired) {
        otpIsExpired = true;
        otpInput.setDisabled(true);
        verifyBtn.disabled = true;
        otpExpiry.classList.add('is-expired');
        otpExpiry.classList.remove('is-expiring');
      }
      otpExpiryText.textContent = 'Code expired — request a new one below';
    } else {
      otpIsExpired = false;
      otpExpiryText.textContent = `Code expires in ${formatMMSS(otpRemaining)}`;
      otpExpiry.classList.toggle('is-expiring', otpRemaining <= 30);
      otpExpiry.classList.remove('is-expired');
    }

    // Resend cooldown display
    if (cooldownRemaining > 0) {
      resendCooldownText.hidden = false;
      resendBtn.hidden = true;
      resendCooldownSpan.textContent = String(cooldownRemaining);
    } else {
      resendCooldownText.hidden = true;
      resendBtn.hidden = false;
    }
  }

  function startTicker() {
    stopTicker();
    tick();
    tickHandle = setInterval(tick, 1000);
  }
  function stopTicker() {
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;
  }

  startTicker();

  // ── Attempts remaining copy ────────────────────────────────────────────
  function updateAttemptsNote() {
    const remaining = CONFIG.MAX_VERIFY_ATTEMPTS - attempts;
    if (attempts === 0) {
      attemptsNote.textContent = '';
      attemptsNote.classList.remove('is-warning');
      return;
    }
    attemptsNote.textContent = `${remaining} attempt${remaining === 1 ? '' : 's'} remaining`;
    attemptsNote.classList.toggle('is-warning', remaining <= 2);
  }
  updateAttemptsNote();

  // ── State transitions ──────────────────────────────────────────────────
  function showLocked(message) {
    stopTicker();
    form.hidden = true;
    lockedState.hidden = false;
    lockedState.classList.add('is-active', 'va-verify-transition');
    if (message) {
      lockedState.querySelector('p').textContent = message;
    }
  }

  function showSuccess() {
    stopTicker();
    form.hidden = true;
    successState.hidden = false;
    successState.classList.add('is-active', 'va-verify-transition');
  }

  // ── Verify ──────────────────────────────────────────────────────────────
  function setLoading(isLoading) {
    submitting = isLoading;
    verifyBtn.disabled = isLoading;
    otpInput.setDisabled(isLoading);
    verifyBtn.classList.toggle('is-loading', isLoading);
    const label = verifyBtn.querySelector(".va-btn-label");
    const loading = verifyBtn.querySelector(".va-btn-loading");
    
    if (label) {
        label.toggleAttribute("hidden", isLoading);
    }
    
    if (loading) {
        loading.toggleAttribute("hidden", !isLoading);
    }
  }

  async function handleVerify(code) {
    if (submitting || otpIsExpired) return;
    otpError.textContent = '';
    setLoading(true);

    try {
      await AUTH.submitOtp(code);
      setLoading(false);
      showSuccess();
      const redirectTarget = AUTH.resolveRedirectTarget();
      setTimeout(() => {
        window.location.href = redirectTarget;
      }, 900); // let the success checkmark animation land before navigating
    } catch (err) {
      setLoading(false);
      handleVerifyError(err);
    }
  }

  function handleVerifyError(err) {
    if (!(err instanceof API.ApiError)) {
      TOAST.error('Something went wrong. Please try again.');
      otpInput.clear();
      return;
    }

    switch (err.code) {
      case API.ErrorCodes.OTP_INVALID: {
        attempts += 1;
        SESSION.updatePendingAuth({ attempts });
        updateAttemptsNote();
        if (attempts >= CONFIG.MAX_VERIFY_ATTEMPTS) {
          showLocked('You\u2019ve entered the wrong code too many times. Please start over to request a new one.');
        } else {
          otpError.textContent = AUTH.describeError(err);
          otpInput.shake();
          otpInput.clear();
        }
        break;
      }
      case API.ErrorCodes.OTP_EXPIRED: {
        otpIsExpired = true;
        otpInput.setDisabled(true);
        verifyBtn.disabled = true;
        otpError.textContent = AUTH.describeError(err);
        break;
      }
      case API.ErrorCodes.OTP_MAX_ATTEMPTS: {
        showLocked(AUTH.describeError(err));
        break;
      }
      case 'PENDING_EXPIRED': {
        TOAST.info('Your sign-in attempt expired. Please start again.');
        window.location.href = withRedirectParam(CONFIG.ROUTES.LOGIN);
        break;
      }
      default: {
        TOAST.error(AUTH.describeError(err), { title: 'Verification failed' });
        otpInput.clear();
      }
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (otpIsExpired) return;
    const code = otpInput.getValue();
    if (code.length !== CONFIG.OTP_LENGTH) {
      otpError.textContent = `Enter all ${CONFIG.OTP_LENGTH} digits.`;
      return;
    }
    handleVerify(code);
  });

  // ── Resend ──────────────────────────────────────────────────────────────
  resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    try {
      await AUTH.resendOtp();
      attempts = 0;
      SESSION.updatePendingAuth({ attempts: 0 });
      updateAttemptsNote();
      otpIsExpired = false;
      otpInput.setDisabled(false);
      otpInput.clear();
      verifyBtn.disabled = false;
      otpError.textContent = '';
      startTicker();
      TOAST.success('A new code is on its way.');
    } catch (err) {
      if (err instanceof API.ApiError && err.code === API.ErrorCodes.RESEND_LIMIT_REACHED) {
        showLocked(AUTH.describeError(err));
      } else {
        TOAST.error(AUTH.describeError(err), { title: 'Couldn\u2019t resend code' });
      }
    } finally {
      resendBtn.disabled = false;
    }
  });

  // ── Change email / restart ────────────────────────────────────────────
  function backToLogin() {
    AUTH.cancelPendingLogin();
    window.location.href = withRedirectParam(CONFIG.ROUTES.LOGIN);
  }

  changeEmailBtn.addEventListener('click', backToLogin);
  restartBtn.addEventListener('click', backToLogin);
})();
