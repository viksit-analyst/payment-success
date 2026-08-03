/**
 * mission-control.js
 * ---------------------------------------------------------------------------
 * App controller for Mission Control. Owns:
 *  - sidebar routing (single-page view switching, no reloads)
 *  - top-nav interactions (search modal, notifications dropdown, sidebar collapse)
 *  - the Dashboard view (fully built, Phase 1)
 *  - a placeholder renderer for not-yet-built modules (Phases 2–6), so the
 *    shell is fully navigable today without dead links or console errors.
 *
 * Every module file added in later phases should export a single
 * `MC.registerView('customers', renderFn)` call — see bottom of this file.
 * ---------------------------------------------------------------------------
 */

const MC = (() => {
  const state = {
    currentView: 'dashboard',
    views: {},          // viewName -> render function
    dashboardData: null,
    chartInstances: {},
  };

  const PHASE_LABELS = {
    'Phase 2': 'Customer & subscription management — search, filters, detail drawers, bulk actions.',
    'Phase 3': 'Payment center and the renewal engine — reminders, payment links, history.',
    'Phase 4': 'Broker connections, bot fleet control, and trading infrastructure monitoring.',
    'Phase 5': 'Email queue and support ticketing, wired into the notification center.',
    'Phase 6': 'Analytics, reports, logs, audit trail, system health, and settings.',
  };

  const VIEW_TITLES = {
    customers: 'Customers', subscriptions: 'Subscriptions', payments: 'Payment Center',
    renewals: 'Renewal Engine', brokers: 'Broker Connections', bots: 'Bot Management',
    infrastructure: 'Trading Infrastructure', emails: 'Email Queue', support: 'Support Center',
    analytics: 'Analytics', reports: 'Reports', logs: 'Logs', audit: 'Audit Trail',
    health: 'System Health', settings: 'Settings',
  };

  /* ============================ ROUTING ============================ */
  function registerView(name, renderFn) {
    state.views[name] = renderFn;
  }

  function navigate(viewName) {
    if (state.currentView === viewName) return;
    document.querySelectorAll('.mc-view').forEach((v) => v.classList.remove('active'));
    document.querySelectorAll('.mc-nav-item').forEach((i) => i.classList.remove('active'));

    const target = document.getElementById(`view-${viewName}`);
    const navItem = document.querySelector(`.mc-nav-item[data-view="${viewName}"]`);
    if (!target) return;

    target.classList.add('active');
    if (navItem) navItem.classList.add('active');
    state.currentView = viewName;

    // Lazy-render: build the view's DOM the first time it's opened
    if (!target.dataset.rendered) {
      if (state.views[viewName]) {
        state.views[viewName](target);
      } else if (target.dataset.phase) {
        renderPlaceholder(target, viewName, target.dataset.phase);
      }
      target.dataset.rendered = 'true';
    }

    // collapse mobile sidebar on navigation
    document.getElementById('mcApp').classList.remove('mc-sidebar-open');
  }

  function renderPlaceholder(el, viewName, phase) {
    const title = VIEW_TITLES[viewName] || viewName;
    const desc = PHASE_LABELS[phase] || 'Coming soon.';
    el.innerHTML = `
      <div class="mc-view-head">
        <div>
          <div class="mc-eyebrow">${phase}</div>
          <h1>${title}</h1>
        </div>
      </div>
      <div class="mc-placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3" stroke-dasharray="3 3"/><path d="M9 9h6v6H9z" stroke-dasharray="2 2"/></svg>
        <h3>${title} module ships in ${phase}</h3>
        <p>${desc}</p>
        <span class="mc-phase-tag">Shell + adminAPI ready · UI pending</span>
      </div>`;
  }

  /* ============================ DASHBOARD ============================ */
  const STAT_DEFS = [
    { key: 'revenueToday', label: "Today's Revenue", fmt: (v) => `₹${v.toLocaleString('en-IN')}`, color: 'var(--color-accent)' },
    { key: 'revenueMonth', label: 'Monthly Revenue', fmt: (v) => `₹${v.toLocaleString('en-IN')}`, color: 'var(--color-ivrv)' },
    { key: 'activeCustomers', label: 'Active Customers', fmt: (v) => v, color: 'var(--color-success)' },
    { key: 'botsRunning', label: 'Bots Running', fmt: (v) => v, color: 'var(--color-vwap)' },
    { key: 'expiringSubscriptions', label: 'Expiring ≤3 Days', fmt: (v) => v, color: 'var(--color-warning)' },
    { key: 'failedPayments', label: 'Failed Payments', fmt: (v) => v, color: 'var(--color-error)' },
  ];

  function renderStatSkeletons() {
    const grid = document.getElementById('mcStatGrid');
    grid.innerHTML = STAT_DEFS.map(() => `
      <div class="mc-stat">
        <div class="mc-skel" style="width:70%;height:10px;margin-bottom:12px;"></div>
        <div class="mc-skel" style="width:50%;height:22px;"></div>
      </div>`).join('');
  }

  function renderStats(stats) {
    const grid = document.getElementById('mcStatGrid');
    grid.innerHTML = STAT_DEFS.map((d) => `
      <div class="mc-stat" style="--stat-color:${d.color}">
        <div class="mc-stat-accent"></div>
        <div class="mc-stat-label">${d.label}</div>
        <div class="mc-stat-value ${d.key.includes('revenue') ? 'mono' : ''}">${d.fmt(stats[d.key])}</div>
      </div>`).join('');
  }

  function renderExpiringTable(rows) {
    const body = document.getElementById('mcExpiringTable');
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="4" style="color:var(--mc-text-tertiary);text-align:center;padding:20px 0;">No renewals due in the next 3 days.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map((c) => {
      const status = c.renewalDaysRemaining < 0 ? 'critical' : c.renewalDaysRemaining <= 1 ? 'warning' : 'grace_period';
      const label = c.renewalDaysRemaining < 0 ? `${Math.abs(c.renewalDaysRemaining)}d overdue` : `${c.renewalDaysRemaining}d left`;
      return `
        <tr>
          <td>${c.name}<div class="mc-cell-sub mc-mono">${c.id}</div></td>
          <td><span class="mc-badge-status" style="background:rgba(255,255,255,0.06);color:${c.strategyColor}"><span class="mc-dot"></span>${c.strategy}</span></td>
          <td><span class="mc-badge-status ${status}"><span class="mc-dot"></span>${label}</span></td>
          <td class="mc-mono">${c.renewalDate}</td>
        </tr>`;
    }).join('');
  }

  function renderFailedPaymentsTable(rows) {
    const body = document.getElementById('mcFailedPaymentsTable');
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="4" style="color:var(--mc-text-tertiary);text-align:center;padding:20px 0;">No failed payments in range. Clean run.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map((p) => `
      <tr>
        <td class="mc-mono">${p.id}</td>
        <td>${p.customerName}<div class="mc-cell-sub mc-mono">${p.customerId}</div></td>
        <td class="mc-mono">₹${p.amount}</td>
        <td><span class="mc-badge-status failed"><span class="mc-dot"></span>Failed</span></td>
      </tr>`).join('');
  }

  function destroyCharts() {
    Object.values(state.chartInstances).forEach((c) => c && c.destroy());
    state.chartInstances = {};
  }

  // Low-priority audit item — see the matching note in charts.js.
  function prefersReducedMotion_() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function chartDefaults() {
    return {
      responsive: true, maintainAspectRatio: false,
      animation: prefersReducedMotion_() ? false : undefined,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: 'rgba(248,250,252,0.42)', font: { family: 'IBM Plex Mono', size: 10 }, maxTicksLimit: 7 } },
        y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(248,250,252,0.42)', font: { family: 'IBM Plex Mono', size: 10 } } },
      },
    };
  }

  function renderRevenueChart(series) {
    const ctx = document.getElementById('chartRevenue');
    state.chartInstances.revenue = new Chart(ctx, {
      type: 'line',
      data: {
        labels: series.labels,
        datasets: [{
          data: series.revenue,
          borderColor: '#FF9933',
          backgroundColor: 'rgba(255,153,51,0.12)',
          fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2,
        }],
      },
      options: chartDefaults(),
    });
    document.getElementById('mcRevTotal').textContent = `₹${series.revenue.reduce((a, b) => a + b, 0).toLocaleString('en-IN')}`;
  }

  function renderStrategyChart(dist) {
    const ctx = document.getElementById('chartStrategy');
    state.chartInstances.strategy = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(dist),
        datasets: [{
          data: Object.values(dist),
          backgroundColor: ['#2E6BE6', '#FF9933', '#1FA971'],
          borderColor: '#0B1F3A', borderWidth: 3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        animation: prefersReducedMotion_() ? false : undefined,
        plugins: { legend: { position: 'bottom', labels: { color: 'rgba(248,250,252,0.66)', font: { family: 'Inter', size: 11 }, padding: 14, usePointStyle: true, pointStyle: 'circle' } } },
      },
    });
  }

  function renderGrowthChart(series) {
    const ctx = document.getElementById('chartGrowth');
    state.chartInstances.growth = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: series.labels,
        datasets: [{
          data: series.customerGrowth,
          backgroundColor: 'rgba(46,107,230,0.55)',
          borderRadius: 3, maxBarThickness: 10,
        }],
      },
      options: chartDefaults(),
    });
  }

  async function loadDashboard() {
    renderStatSkeletons();
    const data = await adminAPI.loadDashboard();
    state.dashboardData = data;
    renderStats(data.stats);
    renderExpiringTable(data.expiringSoon);
    renderFailedPaymentsTable(data.recentFailedPayments);
    destroyCharts();
    renderRevenueChart(data.series);
    renderStrategyChart(data.strategyDistribution);
    renderGrowthChart(data.series);
    updateSystemStatusPill(data.systemStatus);
    document.getElementById('mcSupportFlag').textContent = data.stats.pendingTickets;
  }

  function updateSystemStatusPill(status) {
    const pill = document.getElementById('mcSystemStatus');
    pill.classList.remove('mc-status-warning', 'mc-status-critical');
    const map = {
      OPERATIONAL: { label: 'Operational', cls: '' },
      WARNING: { label: 'Warning', cls: 'mc-status-warning' },
      DEGRADED: { label: 'Degraded', cls: 'mc-status-warning' },
      MAINTENANCE: { label: 'Maintenance', cls: 'mc-status-warning' },
      OFFLINE: { label: 'Offline', cls: 'mc-status-critical' },
    };
    const m = map[status] || map.OPERATIONAL;
    if (m.cls) pill.classList.add(m.cls);
    pill.querySelector('span:last-child').textContent = m.label;
  }

  /* ============================ NOTIFICATIONS ============================ */
  async function loadNotifications() {
    const { items, unreadCount } = await adminAPI.loadNotifications();
    const list = document.getElementById('mcNotifList');
    list.innerHTML = items.map((n) => `
      <div class="mc-notif-item">
        <span class="mc-notif-dot ${n.type}"></span>
        <div class="mc-notif-body"><p>${n.text}</p><span>${n.time}</span></div>
      </div>`).join('');
    const badge = document.getElementById('mcNotifBadge');
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
  }

  function wireNotifications() {
    const btn = document.getElementById('mcNotifBtn');
    const dropdown = document.getElementById('mcNotifDropdown');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.getElementById('mcNotifMarkRead').addEventListener('click', () => {
      document.getElementById('mcNotifBadge').style.display = 'none';
      dropdown.classList.remove('open');
    });
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== btn) dropdown.classList.remove('open');
    });
  }

  /* ============================ GLOBAL SEARCH ============================ */
  function wireSearch() {
    const panel = document.getElementById('mcSearchPanel');
    const input = document.getElementById('mcSearchInput');
    const resultsEl = document.getElementById('mcSearchResults');
    let debounceTimer;

    function open() {
      panel.classList.add('open');
      setTimeout(() => input.focus(), 50);
    }
    function close() {
      panel.classList.remove('open');
      input.value = '';
      resultsEl.innerHTML = '';
    }

    document.getElementById('mcSearchTrigger').addEventListener('click', open);
    panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
      if (e.key === 'Escape') close();
    });

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = input.value;
      debounceTimer = setTimeout(async () => {
        if (q.length < 2) { resultsEl.innerHTML = ''; return; }
        const { results } = await adminAPI.globalSearch(q);
        resultsEl.innerHTML = results.length
          ? results.map((r) => `
              <div class="mc-search-result">
                <div class="mc-sr-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg></div>
                <div><div class="mc-sr-title">${r.title}</div><div class="mc-sr-sub">${r.type} · ${r.sub}</div></div>
              </div>`).join('')
          : `<div style="padding:24px;text-align:center;color:var(--mc-text-tertiary);font-size:13px;">No matches for "${q}"</div>`;
      }, 200);
    });
  }

  /* ============================ SHELL WIRING ============================ */
  function wireSidebar() {
    document.querySelectorAll('.mc-nav-item[data-view]').forEach((item) => {
      item.addEventListener('click', () => navigate(item.dataset.view));
    });
    document.querySelectorAll('[data-view-link]').forEach((link) => {
      link.addEventListener('click', (e) => { e.preventDefault(); navigate(link.dataset.viewLink); });
    });
    document.getElementById('mcSidebarToggle').addEventListener('click', () => {
      const app = document.getElementById('mcApp');
      if (window.innerWidth <= 900) app.classList.toggle('mc-sidebar-open');
      else app.classList.toggle('mc-sidebar-collapsed');
    });
  }

  function init() {
    wireSidebar();
    wireSearch();
    wireNotifications();
    registerView('dashboard', () => {}); // already rendered server-side in HTML
    loadDashboard();
    loadNotifications();
    document.getElementById('mcRefreshDashboard').addEventListener('click', loadDashboard);
  }

  // M5 fix: previously ran unconditionally on DOMContentLoaded, which
  // meant every visitor — including ones adminGuard.js was about to deny —
  // paid the cost of wiring up the dashboard and calling adminAPI.js, and
  // assumed Chart.js (now lazy-loaded, see adminGuard.js) was already on
  // the page. Now waits for BOTH the DOM and adminGuard's "va:admin-ready"
  // signal, handling either firing first.
  let domReady = false;
  let adminReady = false;
  function maybeInit() {
    if (domReady && adminReady) init();
  }
  document.addEventListener('DOMContentLoaded', () => { domReady = true; maybeInit(); });
  document.addEventListener('va:admin-ready', () => { adminReady = true; maybeInit(); }, { once: true });

  return { navigate, registerView };
})();
