/* ==========================================================================
   VIKSIT ANALYST — 404 PAGE
   Reuses the same sparkline texture generator pattern as script.js for the
   404 background, scoped to this page only.

   AUDIT FIX: this used to be an inline <script> block in 404.html. Moved
   here, unchanged, so the page can carry the same strict CSP (script-src
   'self', no 'unsafe-inline') every other page uses.
   ========================================================================== */
(() => {
  'use strict';
  const el = document.getElementById('errorTexture');
  if (!el) return;
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='340' height='120' viewBox='0 0 340 120'>
      <path d='M0 90 L40 60 L70 78 L110 40 L150 65 L190 25 L230 55 L270 20 L310 48 L340 30'
            fill='none' stroke='%236FA0FF' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round' opacity='0.9'/>
      <circle cx='110' cy='40' r='3' fill='%23FF9933'/>
      <circle cx='230' cy='55' r='3' fill='%23FF9933'/>
      <circle cx='310' cy='48' r='3' fill='%23FF9933'/>
    </svg>`.replace(/\s+/g, ' ').trim();
  el.style.backgroundImage = `url("data:image/svg+xml,${svg}")`;
})();
