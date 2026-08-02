/**
 * components/otp-input.js
 * ─────────────────────────────────────────────────────────────────────────
 * A reusable, accessible N-digit OTP input built from individual
 * <input> boxes (not a single masked field), matching the Stripe/GitHub
 * style verification UI.
 *
 * Features: auto-focus first box, auto-advance on digit entry, backspace
 * navigates to the previous box, full paste support (pasting "482913"
 * anywhere fills all boxes), arrow-key navigation, numeric-only input,
 * fires onComplete once all boxes are filled.
 *
 * Exposes: window.VA_OTP_INPUT
 * ───────────────────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  /**
   * @param {HTMLElement} container - element to render the boxes into
   * @param {object} opts
   * @param {number} opts.length
   * @param {(code: string) => void} [opts.onComplete] - called once, when all boxes fill
   * @param {() => void} [opts.onChange] - called on every keystroke
   * @returns {{ getValue: () => string, clear: (opts?: {focus?: boolean}) => void,
   *             setDisabled: (disabled: boolean) => void, shake: () => void,
   *             focusFirst: () => void }}
   */
  function createOtpInput(container, opts) {
    const length = opts.length;
    const inputs = [];
    let completed = false;

    container.innerHTML = '';
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', `${length}-digit verification code`);

    for (let i = 0; i < length; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.autocomplete = i === 0 ? 'one-time-code' : 'off';
      input.pattern = '[0-9]*';
      input.maxLength = 1;
      input.className = 'va-otp-box';
      input.setAttribute('aria-label', `Digit ${i + 1} of ${length}`);
      input.dataset.index = String(i);

      input.addEventListener('input', (e) => handleInput(e, i));
      input.addEventListener('keydown', (e) => handleKeydown(e, i));
      input.addEventListener('paste', (e) => handlePaste(e, i));
      input.addEventListener('focus', () => input.select());

      container.appendChild(input);
      inputs.push(input);
    }

    function currentValue() {
      return inputs.map((el) => el.value).join('');
    }

    function checkComplete() {
      const value = currentValue();
      if (typeof opts.onChange === 'function') opts.onChange(value);
      if (value.length === length && !completed) {
        completed = true;
        if (typeof opts.onComplete === 'function') opts.onComplete(value);
      } else if (value.length < length) {
        completed = false;
      }
    }

    function handleInput(e, index) {
      const el = e.target;
      // Strip anything non-numeric (handles autofill/IME edge cases).
      el.value = el.value.replace(/[^0-9]/g, '').slice(-1);

      if (el.value && index < length - 1) {
        inputs[index + 1].focus();
      }
      checkComplete();
    }

    function handleKeydown(e, index) {
      const el = e.target;

      if (e.key === 'Backspace') {
        if (!el.value && index > 0) {
          e.preventDefault();
          inputs[index - 1].focus();
          inputs[index - 1].value = '';
          checkComplete();
        }
        return;
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault();
        inputs[index - 1].focus();
        return;
      }
      if (e.key === 'ArrowRight' && index < length - 1) {
        e.preventDefault();
        inputs[index + 1].focus();
        return;
      }
      // Block non-numeric keys outright (except control/navigation keys).
      const isDigit = /^[0-9]$/.test(e.key);
      const isControlKey = e.key.length > 1 || e.metaKey || e.ctrlKey;
      if (!isDigit && !isControlKey) {
        e.preventDefault();
      }
    }

    function handlePaste(e, index) {
      e.preventDefault();
      const pasted = (e.clipboardData || global.clipboardData).getData('text');
      const digits = pasted.replace(/[^0-9]/g, '').slice(0, length);
      if (!digits) return;

      digits.split('').forEach((digit, i) => {
        const targetIndex = index + i;
        if (inputs[targetIndex]) inputs[targetIndex].value = digit;
      });

      const nextEmpty = inputs.findIndex((el) => !el.value);
      const focusTarget = nextEmpty === -1 ? inputs[length - 1] : inputs[nextEmpty];
      focusTarget.focus();

      checkComplete();
    }

    function focusFirst() {
      inputs[0].focus();
    }

    function clear(clearOpts = {}) {
      inputs.forEach((el) => (el.value = ''));
      completed = false;
      if (clearOpts.focus !== false) focusFirst();
    }

    function setDisabled(disabled) {
      inputs.forEach((el) => (el.disabled = disabled));
    }

    function shake() {
      container.classList.remove('va-otp-shake');
      // Force reflow so the animation can be retriggered on repeated errors.
      void container.offsetWidth;
      container.classList.add('va-otp-shake');
    }

    return {
      getValue: currentValue,
      clear,
      setDisabled,
      shake,
      focusFirst,
    };
  }

  global.VA_OTP_INPUT = Object.freeze({ createOtpInput });
})(window);
