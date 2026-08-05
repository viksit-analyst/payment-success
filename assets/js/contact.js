/* ==========================================================================
   VIKSIT ANALYST — CONTACT PAGE
   Contact form — mailto composer. Page-specific behavior only; does not
   duplicate anything already handled by script.js.

   AUDIT FIX: this used to be an inline <script> block in contact.html.
   Moved here, unchanged, so the page can carry the same strict CSP
   (script-src 'self', no 'unsafe-inline') every other page uses —
   external same-origin scripts are unaffected by that restriction,
   inline ones are blocked by it.
   ========================================================================== */
(() => {
  'use strict';
  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const topic = form.topic.value;
    const message = form.message.value.trim();
    const subject = encodeURIComponent(`[Viksit Analyst] ${topic} - ${name}`);
    const bodyLines = [
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      `Topic: ${topic}`,
      '',
      message
    ].filter(Boolean);
    const body = encodeURIComponent(bodyLines.join('\n'));
    window.location.href = `mailto:analyst@viksitanalyst.com?subject=${subject}&body=${body}`;
    status.classList.add('is-visible');
  });
})();
