/* ==========================================================================
   VIKSIT ANALYST — ONBOARDING · DOWNLOAD CENTER
   Vanilla ES2023 module. Renders wizard step: 'downloads'.

   Links point at the same legal pages already live on the marketing
   site (terms.html's Risk Disclosure section, refund.html) rather than
   duplicating that content — see README.md's integration notes.
   ========================================================================== */

const docIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>';

function docCard({ name, href, meta, downloadable = false }) {
  return `
    <a class="ob-download-card" href="${href}" ${downloadable ? 'download' : 'target="_blank" rel="noopener"'}>
      <span class="ob-download-icon">${docIcon}</span>
      <span>
        <span class="ob-download-name" style="display:block;">${name}</span>
        <span class="ob-download-meta">${meta}</span>
      </span>
    </a>
  `;
}

/**
 * Step 8 — Downloads. userGuideUrl/strategyGuideUrl/configSummaryUrl/
 * invoiceUrl/receiptUrl come from the customer/subscription payloads
 * (per-customer, backend-generated) — everything else links to the
 * existing static legal pages.
 */
export function renderDownloadsStep(panelEl, { customer, subscription, config }) {
  panelEl.innerHTML = `
    <p class="ob-panel-eyebrow">Step 8 of 9</p>
    <h1 class="ob-panel-title">Your setup documents.</h1>
    <p class="ob-panel-sub">Everything you need for reference — save these, they're also always available from your dashboard.</p>

    <div class="ob-download-grid">
      ${docCard({ name: 'User Guide', href: subscription.userGuideUrl || '#', meta: 'PDF · Getting started' })}
      ${docCard({ name: 'Strategy Guide', href: subscription.strategyGuideUrl || '#', meta: `PDF · ${config?.strategy || 'Your strategy'}` })}
      ${docCard({ name: 'Setup Guide', href: subscription.setupGuideUrl || '#', meta: 'PDF · Reference' })}
      ${docCard({ name: 'Risk Disclosure', href: 'terms.html#risk-disclosure', meta: 'Read on-site' })}
      ${docCard({ name: 'Release Notes', href: 'https://github.com/viksitanalyst/viksit-analyst/blob/main/CHANGELOG.md', meta: 'Latest platform changes' })}
      ${docCard({ name: 'Configuration Summary', href: subscription.configSummaryUrl || '#', meta: `${config?.strategy || ''} · ${config?.server || ''}` })}
      ${docCard({ name: 'Invoice', href: subscription.invoiceUrl || '#', meta: `Order ${subscription.orderId || ''}`, downloadable: true })}
      ${docCard({ name: 'Receipt', href: subscription.receiptUrl || '#', meta: 'Payment confirmation', downloadable: true })}
    </div>

    <p class="ob-form-hint">Documents without a live link yet will be emailed to ${customer.email} within 24 hours and added to your dashboard automatically.</p>
  `;
}
