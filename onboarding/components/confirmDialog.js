/* ==========================================================================
   VIKSIT ANALYST — ONBOARDING · CONFIRM DIALOG
   Reuses the exact .modal-overlay / .modal / .modal-close markup and
   focus-trap behavior already defined in styles.css and demonstrated by
   the strategy detail modal in script.js — not a new modal system.
   ========================================================================== */

let lastFocusedEl = null;

function getElements() {
  const overlay = document.getElementById('obConfirmOverlay');
  const body = document.getElementById('obConfirmBody');
  const close = document.getElementById('obConfirmClose');
  return { overlay, body, close };
}

function closeConfirm() {
  const { overlay } = getElements();
  if (!overlay) return;
  overlay.classList.remove('is-open');
  document.body.style.overflow = '';
  if (lastFocusedEl) lastFocusedEl.focus();
}

/**
 * Shows a confirm dialog. Returns a Promise<boolean> resolved true if
 * the customer confirmed, false if they cancelled/dismissed.
 * Used for: leaving mid-setup, reconnecting a broker, retrying a
 * failed step, skipping optional steps.
 */
export function confirm({ title, message, confirmLabel = 'Continue', cancelLabel = 'Cancel', danger = false }) {
  const { overlay, body, close } = getElements();
  if (!overlay || !body || !close) {
    // No dialog markup on this page — fail safe to a native confirm()
    // rather than silently doing nothing.
    return Promise.resolve(window.confirm(`${title}\n\n${message}`)); // eslint-disable-line no-alert
  }

  return new Promise((resolve) => {
    body.innerHTML = `
      <h3 id="obConfirmTitle">${title}</h3>
      <p class="ob-confirm-body">${message}</p>
      <div class="ob-confirm-actions">
        <button type="button" class="btn btn-secondary" id="obConfirmCancel">${cancelLabel}</button>
        <button type="button" class="btn ${danger ? 'btn-primary' : 'btn-accent'}" id="obConfirmOk">${confirmLabel}</button>
      </div>
    `;

    const settle = (result) => {
      closeConfirm();
      resolve(result);
    };

    body.querySelector('#obConfirmCancel').addEventListener('click', () => settle(false));
    body.querySelector('#obConfirmOk').addEventListener('click', () => settle(true));
    close.onclick = () => settle(false);
    overlay.onclick = (e) => { if (e.target === overlay) settle(false); };

    lastFocusedEl = document.activeElement;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    body.querySelector('#obConfirmOk').focus();
  });
}

export default { confirm };
