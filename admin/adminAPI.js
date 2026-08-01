/**
 * adminAPI.js
 * ---------------------------------------------------------------------------
 * Single data-access layer for Mission Control. Every module calls through
 * here — nothing else in the app touches fetch() directly. This keeps the
 * eventual swap from mock data to real Apps Script endpoints a one-file change.
 *
 * Data shapes follow the VIKSIT ANALYST DATA SPECIFICATION (VADS v1.0):
 *  - Customer IDs:   CUS000001
 *  - Strategy IDs:   STR001 (IVRV), STR002 (GAMMA), STR003 (VWAP)
 *  - Broker IDs:     BR001 (Upstox), BR002 (Zerodha)
 *  - Subscription Status: PENDING | ACTIVE | GRACE_PERIOD | PAUSED | CANCELLED | EXPIRED | ARCHIVED
 *  - Customer Status:      NEW | BROKER_PENDING | READY | LIVE | PAUSED | SUSPENDED | DELETED
 *  - Broker Status:        NOT_CONNECTED | CONNECTED | TOKEN_PENDING | TOKEN_VALID | TOKEN_EXPIRED | LOGIN_REQUIRED | DISABLED
 *  - Payment Status:       PENDING | PAID | FAILED | REFUNDED | CHARGEBACK
 *  - Email Status:         QUEUED | SENDING | SENT | FAILED | RETRYING
 *  - Mission Control Status: OPERATIONAL | WARNING | DEGRADED | MAINTENANCE | OFFLINE
 *
 * PHASE 1: endpoints below are placeholders (ENDPOINT_BASE unset) and every
 * load*() function resolves from generated mock data so the UI is fully
 * navigable today. When your Apps Script Web App is deployed, set
 * ADMIN_API_CONFIG.baseUrl and flip ADMIN_API_CONFIG.useMockData to false —
 * no calling code changes.
 * ---------------------------------------------------------------------------
 */

const ADMIN_API_CONFIG = {
  baseUrl: '', // e.g. 'https://script.google.com/macros/s/XXXXX/exec'
  useMockData: true,
  mockLatencyMs: 320, // simulated network latency so loading states are visible/testable
};

/* ============================================================================
   INTERNAL: fetch wrapper (used once real endpoints exist)
   ============================================================================ */
async function _mcFetch(path, options = {}) {
  if (!ADMIN_API_CONFIG.baseUrl) {
    throw new Error(`adminAPI: no baseUrl configured — cannot call "${path}" against a real endpoint yet.`);
  }
  const res = await fetch(`${ADMIN_API_CONFIG.baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`adminAPI: ${path} failed with ${res.status}`);
  return res.json();
}

function _mockDelay(payload) {
  return new Promise((resolve) => setTimeout(() => resolve(payload), ADMIN_API_CONFIG.mockLatencyMs));
}

/* ============================================================================
   MOCK DATA GENERATORS (VADS-shaped)
   ============================================================================ */
const STRATEGIES = [
  { id: 'STR001', code: 'IVRV', name: 'IVRV', color: 'var(--color-ivrv)', status: 'MONITORING' },
  { id: 'STR002', code: 'GAMMA', name: 'Gamma Flip', color: 'var(--color-gamma)', status: 'POSITION_OPEN' },
  { id: 'STR003', code: 'VWAP', name: 'VWAP', color: 'var(--color-vwap)', status: 'WAITING' },
];

const BROKERS = [
  { id: 'BR001', name: 'Upstox' },
  { id: 'BR002', name: 'Zerodha' },
];

const CUSTOMER_STATUSES = ['NEW', 'BROKER_PENDING', 'READY', 'LIVE', 'PAUSED', 'SUSPENDED'];
const SUB_STATUSES = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'GRACE_PERIOD', 'PENDING', 'EXPIRED', 'PAUSED'];
const FIRST_NAMES = ['Aarav', 'Vihaan', 'Ishaan', 'Rohan', 'Kabir', 'Aditi', 'Meera', 'Priya', 'Ananya', 'Kunal', 'Sanya', 'Dev', 'Neha', 'Rahul', 'Tanvi'];
const LAST_NAMES = ['Sharma', 'Verma', 'Iyer', 'Reddy', 'Kapoor', 'Patel', 'Nair', 'Menon', 'Gupta', 'Chauhan', 'Bose', 'Rao'];

function _seedRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const _rand = _seedRandom(42);
function _pick(arr) { return arr[Math.floor(_rand() * arr.length)]; }
function _pad(n, len) { return String(n).padStart(len, '0'); }
function _daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function _daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d; }
function _fmtDate(d) { return d.toISOString().slice(0, 10); }

function _generateCustomers(count = 46) {
  const list = [];
  for (let i = 1; i <= count; i++) {
    const strategy = _pick(STRATEGIES);
    const broker = _pick(BROKERS);
    const subStatus = _pick(SUB_STATUSES);
    const renewalOffset = subStatus === 'GRACE_PERIOD' ? -Math.floor(_rand() * 3)
      : subStatus === 'EXPIRED' ? -Math.floor(_rand() * 20) - 1
      : Math.floor(_rand() * 30) - 3;
    list.push({
      id: `CUS${_pad(i, 6)}`,
      name: `${_pick(FIRST_NAMES)} ${_pick(LAST_NAMES)}`,
      email: `customer${i}@example.com`,
      phone: `+91 9${_pad(Math.floor(_rand() * 900000000) + 100000000, 9)}`,
      strategy: strategy.code,
      strategyColor: strategy.color,
      broker: broker.name,
      brokerStatus: _pick(['CONNECTED', 'CONNECTED', 'TOKEN_VALID', 'TOKEN_EXPIRED', 'LOGIN_REQUIRED']),
      subscriptionStatus: subStatus,
      capitalRange: _pick(['₹3L–5L', '₹5L–10L', '₹10L–25L', '₹25L+']),
      createdDate: _fmtDate(_daysAgo(Math.floor(_rand() * 400) + 5)),
      renewalDate: _fmtDate(_daysFromNow(renewalOffset)),
      renewalDaysRemaining: renewalOffset,
      lastLogin: _fmtDate(_daysAgo(Math.floor(_rand() * 6))),
    });
  }
  return list;
}
const _CUSTOMERS = _generateCustomers();

function _generatePayments(customers, count = 60) {
  const list = [];
  for (let i = 1; i <= count; i++) {
    const cust = _pick(customers);
    const status = _pick(['PAID', 'PAID', 'PAID', 'PAID', 'PENDING', 'FAILED', 'REFUNDED']);
    list.push({
      id: `PAY${_pad(i, 6)}`,
      orderId: `order_${_pad(1000 + i, 5)}`,
      customerId: cust.id,
      customerName: cust.name,
      strategy: cust.strategy,
      amount: 999,
      currency: 'INR',
      method: _pick(['UPI', 'Card', 'Netbanking']),
      status,
      webhookStatus: status === 'FAILED' ? 'FAILED' : 'CONFIRMED',
      timestamp: _fmtDate(_daysAgo(Math.floor(_rand() * 30))),
    });
  }
  return list.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}
const _PAYMENTS = _generatePayments(_CUSTOMERS);

function _generateBots(customers) {
  return customers
    .filter((c) => c.subscriptionStatus === 'ACTIVE')
    .slice(0, 22)
    .map((c, i) => ({
      id: `BOT${_pad(i + 1, 4)}`,
      customerId: c.id,
      customerName: c.name,
      strategy: c.strategy,
      status: _pick(['RUNNING', 'RUNNING', 'RUNNING', 'RUNNING', 'PAUSED', 'STOPPED', 'RESTARTING']),
      cpu: Math.round(_rand() * 40 + 5),
      ram: Math.round(_rand() * 50 + 10),
      latencyMs: Math.round(_rand() * 90 + 10),
      heartbeatSecAgo: Math.round(_rand() * 40),
      server: `vm-exec-0${(i % 3) + 1}`,
      version: 'v2.4.1',
    }));
}
const _BOTS = _generateBots(_CUSTOMERS);

function _generateEmails(customers, count = 24) {
  const templates = ['Welcome', 'Renewal Reminder', 'Payment Success', 'Daily Report', 'Maintenance Notice'];
  const list = [];
  for (let i = 1; i <= count; i++) {
    const cust = _pick(customers);
    list.push({
      id: `EML${_pad(i, 5)}`,
      customerId: cust.id,
      customerName: cust.name,
      template: _pick(templates),
      status: _pick(['SENT', 'SENT', 'SENT', 'QUEUED', 'FAILED', 'RETRYING']),
      scheduled: _fmtDate(_daysAgo(Math.floor(_rand() * 5))),
    });
  }
  return list;
}
const _EMAILS = _generateEmails(_CUSTOMERS);

function _generateTickets(customers, count = 14) {
  const cats = ['Broker Connection', 'Billing', 'Bot Behaviour', 'Account Access', 'General'];
  const list = [];
  for (let i = 1; i <= count; i++) {
    const cust = _pick(customers);
    list.push({
      id: `TCK${_pad(i, 4)}`,
      customerId: cust.id,
      customerName: cust.name,
      category: _pick(cats),
      priority: _pick(['Low', 'Medium', 'High', 'Urgent']),
      status: _pick(['Open', 'Open', 'Pending', 'Resolved']),
      createdDate: _fmtDate(_daysAgo(Math.floor(_rand() * 12))),
    });
  }
  return list;
}
const _TICKETS = _generateTickets(_CUSTOMERS);

/* ============================================================================
   REVENUE / GROWTH SERIES (for dashboard charts)
   ============================================================================ */
function _revenueSeries(days = 30) {
  const labels = [];
  const revenue = [];
  const customerGrowth = [];
  let base = 38;
  let baseCust = 210;
  for (let i = days - 1; i >= 0; i--) {
    const d = _daysAgo(i);
    labels.push(d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
    base += Math.round((_rand() - 0.35) * 6);
    base = Math.max(base, 8);
    revenue.push(base * 999);
    baseCust += _rand() > 0.6 ? 1 : 0;
    customerGrowth.push(baseCust);
  }
  return { labels, revenue, customerGrowth };
}

function _strategyDistribution() {
  const counts = { IVRV: 0, GAMMA: 0, VWAP: 0 };
  _CUSTOMERS.forEach((c) => { counts[c.strategy]++; });
  return counts;
}

/* ============================================================================
   PUBLIC API — load*() functions used by every module
   ============================================================================ */
const adminAPI = {

  async loadDashboard() {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/dashboard');

    const activeSubs = _CUSTOMERS.filter((c) => c.subscriptionStatus === 'ACTIVE').length;
    const expiring = _CUSTOMERS.filter((c) => c.renewalDaysRemaining >= 0 && c.renewalDaysRemaining <= 3).length;
    const failedPayments = _PAYMENTS.filter((p) => p.status === 'FAILED');
    const botsRunning = _BOTS.filter((b) => b.status === 'RUNNING').length;
    const botsOffline = _BOTS.filter((b) => b.status === 'STOPPED' || b.status === 'PAUSED').length;
    const series = _revenueSeries(30);
    const today = _PAYMENTS.filter((p) => p.timestamp === _fmtDate(new Date()) && p.status === 'PAID');

    return _mockDelay({
      stats: {
        revenueToday: today.reduce((s, p) => s + p.amount, 0) || 15984,
        revenueMonth: series.revenue.reduce((a, b) => a + b, 0),
        activeCustomers: activeSubs,
        expiringSubscriptions: expiring,
        renewalsDue: _CUSTOMERS.filter((c) => c.renewalDaysRemaining < 0).length,
        botsRunning,
        botsOffline,
        connectedBrokers: _CUSTOMERS.filter((c) => c.brokerStatus === 'CONNECTED' || c.brokerStatus === 'TOKEN_VALID').length,
        failedPayments: failedPayments.length,
        pendingTickets: _TICKETS.filter((t) => t.status === 'Open').length,
        emailQueueDepth: _EMAILS.filter((e) => e.status === 'QUEUED' || e.status === 'RETRYING').length,
        systemUptime: '99.94%',
      },
      series,
      strategyDistribution: _strategyDistribution(),
      expiringSoon: _CUSTOMERS.filter((c) => c.renewalDaysRemaining >= -1 && c.renewalDaysRemaining <= 3)
        .sort((a, b) => a.renewalDaysRemaining - b.renewalDaysRemaining).slice(0, 6),
      recentFailedPayments: failedPayments.slice(0, 5),
      systemStatus: 'OPERATIONAL', // OPERATIONAL | WARNING | DEGRADED | MAINTENANCE | OFFLINE
    });
  },

  async loadCustomers(params = {}) {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/customers', { method: 'POST', body: JSON.stringify(params) });
    return _mockDelay({ items: _CUSTOMERS, total: _CUSTOMERS.length });
  },

  async loadSubscriptions() {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/subscriptions');
    return _mockDelay({ items: _CUSTOMERS, total: _CUSTOMERS.length });
  },

  async loadPayments() {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/payments');
    return _mockDelay({ items: _PAYMENTS, total: _PAYMENTS.length });
  },

  async loadRenewals() {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/renewals');
    return _mockDelay({ items: _CUSTOMERS.filter((c) => c.renewalDaysRemaining <= 3) });
  },

  async loadBrokers() {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/brokers');
    return _mockDelay({ items: _CUSTOMERS.map((c) => ({ customerId: c.id, customerName: c.name, broker: c.broker, status: c.brokerStatus })) });
  },

  async loadBots() {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/bots');
    return _mockDelay({ items: _BOTS, total: _BOTS.length });
  },

  async loadServers() {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/servers');
    return _mockDelay({
      items: ['vm-exec-01', 'vm-exec-02', 'vm-exec-03'].map((name, i) => ({
        name, status: i === 2 ? 'WARNING' : 'OPERATIONAL',
        cpu: Math.round(_rand() * 50 + 10), ram: Math.round(_rand() * 60 + 15), disk: Math.round(_rand() * 40 + 20),
      })),
    });
  },

  async loadAnalytics() {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/analytics');
    return _mockDelay({ series: _revenueSeries(90), strategyDistribution: _strategyDistribution() });
  },

  async loadEmails() {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/emails');
    return _mockDelay({ items: _EMAILS, total: _EMAILS.length });
  },

  async loadLogs() {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/logs');
    return _mockDelay({ items: [] });
  },

  async loadSupport() {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/support');
    return _mockDelay({ items: _TICKETS, total: _TICKETS.length });
  },

  async loadReports() {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/reports');
    return _mockDelay({ items: [] });
  },

  async loadNotifications() {
    if (!ADMIN_API_CONFIG.useMockData) return _mcFetch('/notifications');
    const items = [
      { id: 1, type: 'critical', text: `Failed payment — ${_PAYMENTS.find(p=>p.status==='FAILED')?.customerName || 'customer'}`, time: '4m ago' },
      { id: 2, type: 'warning', text: `Broker token expiring — ${_CUSTOMERS.find(c=>c.brokerStatus==='TOKEN_EXPIRED')?.name || 'customer'}`, time: '22m ago' },
      { id: 3, type: 'warning', text: 'Bot heartbeat delayed on vm-exec-03', time: '41m ago' },
      { id: 4, type: 'info', text: '6 renewals due within 3 days', time: '1h ago' },
      { id: 5, type: 'info', text: 'Daily reports generated for 46 customers', time: '3h ago' },
    ];
    return _mockDelay({ items, unreadCount: 4 });
  },

  async globalSearch(query) {
    if (!query || query.length < 2) return _mockDelay({ results: [] });
    const q = query.toLowerCase();
    const results = [];
    _CUSTOMERS.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
      .slice(0, 5).forEach((c) => results.push({ type: 'Customer', title: c.name, sub: `${c.id} · ${c.strategy}` }));
    _PAYMENTS.filter((p) => p.id.toLowerCase().includes(q) || p.customerName.toLowerCase().includes(q))
      .slice(0, 3).forEach((p) => results.push({ type: 'Payment', title: `${p.id} · ₹${p.amount}`, sub: p.customerName }));
    _TICKETS.filter((t) => t.customerName.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
      .slice(0, 3).forEach((t) => results.push({ type: 'Ticket', title: t.id, sub: `${t.customerName} · ${t.category}` }));
    return _mockDelay({ results });
  },
};

// Expose globally (no bundler in this stack — plain <script> includes)
window.adminAPI = adminAPI;
