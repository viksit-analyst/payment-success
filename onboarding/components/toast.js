/* ==========================================================================
   VIKSIT ANALYST — ONBOARDING · TOAST COMPONENT
   Renders into #obToastRegion (see onboarding.html). Respects
   prefers-reduced-motion via CSS (see onboarding.css §13).
   ========================================================================== */

const AUTO_DISMISS_MS = 5000;

function iconFor(type) {
  switch (type) {
    case 'success':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    case 'error':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01" stroke-linecap="round"/></svg>';
    case 'warning':
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke-linejoin="round"/></svg>';
    default:
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M12 12v4" stroke-linecap="round"/></svg>';
  }
}

function getRegion() {
  let region = document.getElementById('obToastRegion');
  if (!region) {
    region = document.createElement('div');
    region.id = 'obToastRegion';
    region.className = 'ob-toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  return region;
}

/**
 * Shows a toast. type: 'info' | 'success' | 'error' | 'warning'.
 * Used for: Payment Success, Welcome, Broker Connected, Bot Activated,
 * Setup Complete, and any inline error surfacing.
 */
export function showToast(message, { type = 'info', duration = AUTO_DISMISS_MS } = {}) {
  const region = getRegion();
  const toast = document.createElement('div');
  toast.className = `ob-toast is-${type}`;
  toast.innerHTML = `${iconFor(type)}<span>${message}</span>`;
  region.appendChild(toast);

  const remove = () => {
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    // Fallback in case animations are disabled (prefers-reduced-motion).
    setTimeout(() => toast.remove(), 260);
  };

  if (duration > 0) setTimeout(remove, duration);
  toast.addEventListener('click', remove);
  return remove;
}

export default { showToast };
