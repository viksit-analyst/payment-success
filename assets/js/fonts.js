/* ==========================================================================
   VIKSIT ANALYST — ASYNC FONT LOADING
   Every page uses the standard "preload + media=print swap" technique for
   the Google Fonts stylesheet: a <link rel="stylesheet" media="print"> is
   non-render-blocking, and used to switch to media="all" (applying it)
   via an inline onload="this.media='all'" attribute once loaded.

   AUDIT FIX: that inline attribute is exactly what this site's own CSP
   blocks. script-src is 'self' with no 'unsafe-inline', which — per the
   CSP spec — governs inline event-handler attributes (onload, onclick,
   etc.) the same as inline <script> blocks. On any browser actually
   enforcing the policy, onload="" silently never fires, media stays
   "print" forever, and the custom fonts never apply on screen. Moving the
   same swap into this external, same-origin file fixes it without
   weakening the CSP — 'self' already allows this script.

   Markup change: the stylesheet link now carries data-font-swap instead
   of onload; see index.html/auth/dashboard/admin/onboarding for the
   corresponding one-line change.
   ========================================================================== */
(() => {
  'use strict';
  document.querySelectorAll('link[data-font-swap]').forEach((link) => {
    const swap = () => { link.media = 'all'; };
    // Handles the (common, with <script defer>) case where the stylesheet
    // already finished loading before this ran — the 'load' event would
    // otherwise never fire again for a listener attached after the fact.
    if (link.sheet) { swap(); return; }
    link.addEventListener('load', swap, { once: true });
  });
})();
