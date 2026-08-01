/* ==========================================================================
   VIKSIT ANALYST — INTERACTIONS
   Vanilla ES2023. No dependencies.
   ========================================================================== */

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------------
     Brand sparkline texture — generated once, reused as a background pattern
     on the hero and Mission Control sections. Keeps the "thin blue curve /
     orange node" motif consistent without shipping a raster asset.
     ------------------------------------------------------------------------ */
  function applySparklineTexture(el) {
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
  }
  applySparklineTexture(document.getElementById('heroTexture'));
  applySparklineTexture(document.getElementById('missionTexture'));

  /* ------------------------------------------------------------------------
     Sticky nav — blur + solid background once the page has scrolled past hero
     ------------------------------------------------------------------------ */
  const nav = document.getElementById('siteNav');
  const onScroll = () => {
    if (window.scrollY > 24) nav.classList.add('is-scrolled');
    else nav.classList.remove('is-scrolled');
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------------------
     Mobile drawer
     ------------------------------------------------------------------------ */
  const navToggle = document.getElementById('navToggle');
  const drawer = document.getElementById('mobileDrawer');
  navToggle.addEventListener('click', () => {
    const isOpen = drawer.classList.toggle('is-open');
    navToggle.classList.toggle('is-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    drawer.classList.remove('is-open');
    navToggle.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }));

  /* ------------------------------------------------------------------------
     Theme toggle (in-memory only — no storage API, session-scoped by design)
     ------------------------------------------------------------------------ */
  const themeToggle = document.getElementById('themeToggle');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) document.documentElement.setAttribute('data-theme', 'dark');
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  });

  /* ------------------------------------------------------------------------
     Hero load choreography — arm the page-load animation sequence once,
     shortly after paint, so fonts/layout settle first.
     ------------------------------------------------------------------------ */
  if (reduceMotion) {
    document.body.classList.add('is-armed');
  } else {
    requestAnimationFrame(() => {
      setTimeout(() => document.body.classList.add('is-armed'), 60);
    });
  }

  /* ------------------------------------------------------------------------
     Scroll-reveal via IntersectionObserver
     ------------------------------------------------------------------------ */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  /* ------------------------------------------------------------------------
     FAQ accordion
     ------------------------------------------------------------------------ */
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      document.querySelectorAll('.faq-item.is-open').forEach(openItem => {
        if (openItem !== item) {
          openItem.classList.remove('is-open');
          openItem.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
          openItem.querySelector('.faq-a').style.maxHeight = null;
        }
      });
      item.classList.toggle('is-open', !isOpen);
      q.setAttribute('aria-expanded', String(!isOpen));
      a.style.maxHeight = !isOpen ? a.scrollHeight + 'px' : null;
    });
  });

  /* ------------------------------------------------------------------------
     Mission Control — "last updated" ticks upward, timestamp set to now
     ------------------------------------------------------------------------ */
  const lastUpdateEl = document.getElementById('lastUpdateText');
  const missionTimestampEl = document.getElementById('missionTimestamp');
  if (missionTimestampEl) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    missionTimestampEl.textContent = `${dateStr} · Website v2.3.1 · Research v19`;
  }
  if (lastUpdateEl) {
    let seconds = 0;
    setInterval(() => {
      seconds += 6;
      if (seconds < 60) lastUpdateEl.textContent = `${seconds}s ago`;
      else lastUpdateEl.textContent = `${Math.floor(seconds / 60)}m ago`;
    }, 6000);
  }

  /* ------------------------------------------------------------------------
     Footer year
     ------------------------------------------------------------------------ */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------------
     Strategy detail modal — content sourced from the strategy detail specs
     ------------------------------------------------------------------------ */
  const strategyData = {
    ivrv: {
      color: 'var(--color-ivrv)',
      name: 'IVRV',
      tagline: 'Systematic Volatility Trading',
      desc: 'IVRV is a quantitative volatility strategy designed to identify periods where implied and realized market volatility diverge meaningfully. Rather than predicting market direction, it focuses on statistically significant volatility conditions and executes according to predefined quantitative rules.',
      highlights: [
        ['Strategy Type', 'Volatility'], ['Trading Style', 'Systematic'], ['Holding Period', 'Several Days'],
        ['Expected Trades', '15–30 / yr'], ['Recommended Capital', '₹3L+'], ['Status', 'Operational'],
      ],
      why: 'Many trading systems rely solely on price. IVRV instead evaluates market behaviour through volatility conditions — waiting for statistically favourable environments to reduce unnecessary exposure while maintaining disciplined execution.',
      suited: ['Prefer quality over quantity', 'Are comfortable with lower trade frequency', 'Appreciate research-driven strategies', 'Value disciplined risk management'],
      snapshot: { period: '2024–2026', trades: '25', winRate: '68%', drawdown: '5.95%', ret: '15.49%', pf: '1.84' },
      faq: [
        ['Why are there so few trades?', 'Because the strategy is intentionally selective and only participates when predefined quantitative conditions are satisfied.'],
        ['Does no trade mean something is wrong?', 'No. Periods without trades are expected and reflect disciplined execution rather than inactivity.'],
      ],
      cta: 'Start IVRV Subscription',
    },
    gamma: {
      color: 'var(--color-gamma)',
      name: 'Gamma Flip',
      tagline: 'Systematic Momentum Trading',
      desc: 'Gamma Flip is an intraday quantitative momentum strategy designed to respond to high-conviction market movements through rapid, rules-based execution, while maintaining disciplined risk controls throughout the session.',
      highlights: [
        ['Trading Style', 'Momentum'], ['Holding Period', 'Seconds–Minutes'], ['Typical Activity', '1–6 / active day'],
        ['Frequency', 'Concentrated sessions'], ['Recommended Capital', '₹3L+'], ['Status', 'Operational'],
      ],
      why: 'Not every intraday move deserves participation. Gamma Flip is designed to engage only when quantitative conditions indicate a strong momentum opportunity — the emphasis is on disciplined participation, not continuous trading.',
      suited: ['Prefer higher activity than IVRV', 'Are comfortable with intraday exposure', 'Want fully automated execution', 'Value systematic decision-making'],
      snapshot: { period: '2024–2026', trades: '20', winRate: '60%', drawdown: '11.78%', ret: '73.12%', pf: '3.43' },
      faq: [
        ["Why doesn't it trade every day?", 'Because market conditions are not equally favourable every session.'],
        ['Why are some trades extremely short?', 'The strategy responds to changing market conditions automatically, closing positions as soon as those conditions change.'],
      ],
      cta: 'Subscribe to Gamma Flip',
    },
    vwap: {
      color: 'var(--color-vwap)',
      name: 'VWAP',
      tagline: 'Institutional Trend Participation',
      desc: 'VWAP is a systematic intraday trend-following strategy inspired by institutional execution principles. Rather than forecasting reversals, it seeks disciplined participation in established intraday directional movement.',
      highlights: [
        ['Trading Style', 'Trend Following'], ['Holding Period', 'Minutes–Hours'], ['Typical Activity', 'Several / week'],
        ['Execution', 'Automated'], ['Recommended Capital', '₹3L+'], ['Status', 'Operational'],
      ],
      why: 'Institutional participants frequently execute alongside established trends rather than anticipating turning points. VWAP follows the same philosophy, participating only when quantitative conditions support sustained directional movement.',
      suited: ['Want intraday exposure', 'Prefer trend participation over reversal-timing', 'Want fully automated execution', 'Value disciplined, rules-based trading'],
      snapshot: null,
      faq: [
        ['Does it trade every day?', 'Only when predefined trend conditions are satisfied.'],
        ['Does it predict market reversals?', 'No. It participates in established directional movement rather than forecasting turning points.'],
      ],
      cta: 'Subscribe to VWAP',
    },
  };

  const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function renderStrategyModal(key) {
    const s = strategyData[key];
    if (!s) return '';
    const highlightsHtml = s.highlights.map(([label, val]) =>
      `<div><span>${label}</span><b>${val}</b></div>`).join('');
    const suitedHtml = s.suited.map(item => `<li>${checkIcon}${item}</li>`).join('');
    const faqHtml = s.faq.map(([q, a]) =>
      `<div class="modal-faq-item"><p>${q}</p><p style="color:var(--text-secondary);font-size:var(--fs-sm)">${a}</p></div>`).join('');

    const snapshotHtml = s.snapshot ? `
      <div class="modal-section">
        <h4>Historical Snapshot</h4>
        <div class="snapshot-grid">
          <div><span>Period</span><b>${s.snapshot.period}</b></div>
          <div><span>Trades</span><b>${s.snapshot.trades}</b></div>
          <div><span>Win Rate</span><b>${s.snapshot.winRate}</b></div>
          <div><span>Max Drawdown</span><b>${s.snapshot.drawdown}</b></div>
          <div><span>Net Return</span><b>${s.snapshot.ret}</b></div>
          <div><span>Profit Factor</span><b>${s.snapshot.pf}</b></div>
        </div>
        <p class="snapshot-note">Historical analysis is provided for informational purposes only and should not be interpreted as a guarantee of future performance.</p>
      </div>` : `
      <div class="modal-section">
        <h4>Historical Snapshot</h4>
        <p style="font-style:italic;color:var(--text-tertiary);font-size:var(--fs-xs)">Updated after each research cycle. This strategy's validated snapshot will appear here once the current cycle completes.</p>
      </div>`;

    return `
      <p class="modal-eyebrow">${s.tagline}</p>
      <h2 id="modalTitle">${s.name}</h2>
      <p class="modal-desc">${s.desc}</p>
      <div class="modal-highlights">${highlightsHtml}</div>
      <div class="modal-section">
        <h4>Why It Exists</h4>
        <p>${s.why}</p>
      </div>
      <div class="modal-section">
        <h4>Best Suited For</h4>
        <ul class="modal-checklist">${suitedHtml}</ul>
      </div>
      ${snapshotHtml}
      <div class="modal-section">
        <h4>Frequently Asked</h4>
        ${faqHtml}
      </div>
      <div class="modal-cta">
        <a href="#pricing" class="btn btn-primary" id="modalCtaBtn">${s.cta}</a>
      </div>
    `;
  }

  const modalOverlay = document.getElementById('strategyModal');
  const modalBody = document.getElementById('modalBody');
  const modalContent = document.getElementById('modalContent');
  const modalClose = document.getElementById('modalClose');
  let lastFocusedEl = null;

  function openModal(key) {
    const s = strategyData[key];
    if (!s) return;
    modalBody.innerHTML = renderStrategyModal(key);
    modalContent.style.setProperty('--strategy-color', s.color);
    lastFocusedEl = document.activeElement;
    modalOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    modalClose.focus();
    const ctaBtn = document.getElementById('modalCtaBtn');
    if (ctaBtn) ctaBtn.addEventListener('click', closeModal);
  }

  function closeModal() {
    modalOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastFocusedEl) lastFocusedEl.focus();
  }

  document.querySelectorAll('[data-strategy-open]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.getAttribute('data-strategy-open')));
  });
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('is-open')) closeModal();
  });

  /* ------------------------------------------------------------------------
     Smooth-scroll offset for the sticky nav on in-page anchor links
     ------------------------------------------------------------------------ */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href').slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.scrollY - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 76) + 1;
      window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

})();
