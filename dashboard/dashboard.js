/* ==========================================================================
   VIKSIT ANALYST — CUSTOMER DASHBOARD
   dashboard.js
   Vanilla JS. No frameworks. Component-based rendering, a small hash router,
   and a mock API layer shaped exactly like the Viksit Analyst Data
   Specification (VADS) so swapping in real endpoints later is a drop-in
   replacement — every render function already consumes the VADS contract.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   0. SEEDED RANDOM — deterministic demo data across reloads
   -------------------------------------------------------------------------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260801);
const randRange = (min, max) => min + rng() * (max - min);
const randInt = (min, max) => Math.floor(randRange(min, max + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];

/* --------------------------------------------------------------------------
   1. ICON LIBRARY — outline icons, Lucide-style, inlined as template strings
   -------------------------------------------------------------------------- */
const ICONS = {
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12l7 7 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3"/><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H16a2.5 2.5 0 0 0 0 5h4"/></svg>',
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17l6-6 4 4 8-9" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 6h6v6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18" stroke-linecap="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01" stroke-linecap="round"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h4l2 7 4-14 2 7h6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12c2 0 2-5 4-5s2 5 4 5 2-5 4-5 2 5 4 5 2-5 4-5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" stroke-linecap="round"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" stroke-linecap="round"/></svg>',
  unlink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 15L3 21m0-6l6 6M15 9l6-6m0 6l-6-6" stroke-linecap="round"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4v6h6M20 20v-6h-6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 15a8 8 0 0 0 13.9 2.5M18.5 9A8 8 0 0 0 4.6 6.5" stroke-linecap="round"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fileText: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5M8 13h8M8 17h5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3Z"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="15" rx="2"/><path d="M2 10h20M6 15h4" stroke-linecap="round"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" stroke-linecap="round"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke-linecap="round"/><path d="M16 17l5-5-5-5M21 12H9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.7 21a2 2 0 0 1-3.4 0" stroke-linecap="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.3 2.3L16 9.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  alertTriangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.3 3.9 1.9 18a1.5 1.5 0 0 0 1.3 2.3h17.6a1.5 1.5 0 0 0 1.3-2.3L13.7 3.9a1.5 1.5 0 0 0-2.6 0Z" stroke-linejoin="round"/><path d="M12 9v4M12 17h.01" stroke-linecap="round"/></svg>',
  alertCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01" stroke-linecap="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="M11 12l8-8m-3 3 2 2m-6-1 2 2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke-linecap="round"/></svg>',
  monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4" stroke-linecap="round"/></svg>',
  smartphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2" stroke-linecap="round"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v4a2 2 0 0 1-2 2C9.6 21 3 14.4 3 6a2 2 0 0 1 1-2Z" stroke-linejoin="round"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" stroke-linecap="round"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" stroke-linejoin="round"/><circle cx="12" cy="14" r="3.5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" stroke-linejoin="round"/></svg>',
  chip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="7" width="10" height="10" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" stroke-linecap="round"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h5l2 3h4l2-3h5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 12v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6l-3-7H6l-3 7Z" stroke-linejoin="round"/></svg>',
  cloudOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M9.5 6.5A6 6 0 0 1 20 10a4.5 4.5 0 0 1-.6 8.9H10M6.5 9.1A4.5 4.5 0 0 0 6 18h1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bookOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 6c-2-1.5-4.5-2-7-1.5v13c2.5-.5 5 0 7 1.5 2-1.5 4.5-2 7-1.5v-13c-2.5-.5-5 0-7 1.5Z" stroke-linejoin="round"/><path d="M12 6v13" /></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l9 5-9 5-9-5 9-5Z" stroke-linejoin="round"/><path d="M3 13l9 5 9-5M3 8l9 5 9-5" stroke-linejoin="round"/></svg>',
  wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 8.5a16 16 0 0 1 20 0M5.5 12a11 11 0 0 1 13 0M9 15.5a6 6 0 0 1 6 0" stroke-linecap="round"/><path d="M12 19h.01" stroke-linecap="round"/></svg>',
};
function icon(name, cls) { return `<span class="${cls||''}" aria-hidden="true">${ICONS[name]||''}</span>`; }

/* --------------------------------------------------------------------------
   2. UTILITIES
   -------------------------------------------------------------------------- */
function escapeHTML(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtINR(n, opts) {
  opts = opts || {};
  const sign = n < 0 ? '-' : '';
  const val = Math.abs(n);
  const str = val.toLocaleString('en-IN', { maximumFractionDigits: opts.decimals ?? 0, minimumFractionDigits: opts.decimals ?? 0 });
  return `${sign}₹${str}`;
}
function fmtNum(n, decimals) { return Number(n).toLocaleString('en-IN', { maximumFractionDigits: decimals ?? 2, minimumFractionDigits: decimals ?? 2 }); }
function fmtDate(d, opts) {
  const date = (d instanceof Date) ? d : new Date(d);
  return date.toLocaleDateString('en-IN', opts || { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(d) {
  const date = (d instanceof Date) ? d : new Date(d);
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtRelative(d) {
  const date = (d instanceof Date) ? d : new Date(d);
  const diffMs = Date.now() - date.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return fmtDate(date);
}
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }
function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

/* Simulated network latency wrapper — swap this file's DB_* constants for
   real fetch() calls to your API; every render function below already
   consumes data shaped exactly like the VADS contract. */
function apiCall(resolveValue, { latency = [220, 620], failRate = 0 } = {}) {
  const delay = randRange(latency[0], latency[1]);
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (rng() < failRate) reject(new Error('NETWORK_ERROR'));
      else resolve(JSON.parse(JSON.stringify(resolveValue)));
    }, delay);
  });
}

/* --------------------------------------------------------------------------
   3. MOCK DATA LAYER — shaped to VADS (Viksit Analyst Data Specification)
   -------------------------------------------------------------------------- */
const STRATEGIES_DB = [
  { id: 'STR001', code: 'IVRV', name: 'IVRV', fullName: 'Implied vs Realized Volatility', color: 'ivrv', version: '4.2', researchVersion: '19', status: 'POSITION_OPEN', expectedFrequency: '2–4 trades / week', holdingPeriod: '1–3 days', capitalRequirement: 300000, riskProfile: 'Moderate', updated: '2026-07-29T18:10:00' },
  { id: 'STR002', code: 'GAMMA', name: 'Gamma Flip', fullName: 'Gamma Exposure Flip', color: 'gamma', version: '3.1', researchVersion: '19', status: 'MONITORING', expectedFrequency: '1–2 trades / week', holdingPeriod: 'Intraday', capitalRequirement: 500000, riskProfile: 'Moderate–High', updated: '2026-07-30T09:05:00' },
  { id: 'STR003', code: 'VWAP', name: 'VWAP', fullName: 'VWAP Mean Reversion', color: 'vwap', version: '2.6', researchVersion: '19', status: 'WAITING', expectedFrequency: '3–6 trades / week', holdingPeriod: 'Intraday', capitalRequirement: 300000, riskProfile: 'Low–Moderate', updated: '2026-07-31T15:40:00' },
];

const CUSTOMER = {
  id: 'CUS004821',
  name: 'Rohan Deshmukh',
  email: 'rohan.deshmukh@gmail.com',
  phone: '+91 98765 43210',
  company: 'Individual',
  country: 'India',
  timezone: 'Asia/Kolkata (IST, UTC+5:30)',
  strategyId: 'STR002',
  brokerId: 'BR001',
  brokerStatus: 'TOKEN_VALID',
  subscriptionStatus: 'ACTIVE',
  capitalRange: '₹5,00,000 – ₹10,00,000',
  createdDate: '2025-11-14',
  renewalDate: '2026-08-18',
  nextPaymentAmount: 50000,
  lastLogin: new Date(Date.now() - 1000 * 60 * 46).toISOString(),
  plan: 'Gamma Flip — Annual',
  twoFAEnabled: true,
};

const BROKERS_CATALOG = [
  { id: 'BR001', name: 'Upstox', short: 'UX', supported: true },
  { id: 'BR002', name: 'Zerodha', short: 'ZD', supported: true },
  { id: 'BR003', name: 'Angel One', short: 'AO', supported: false, note: 'Coming soon' },
  { id: 'BR004', name: 'Groww', short: 'GW', supported: false, note: 'Future ready' },
  { id: 'BR005', name: 'ICICI Direct', short: 'IC', supported: false, note: 'Future ready' },
];

const BROKER_CONNECTION = {
  customerId: CUSTOMER.id,
  brokerId: 'BR001',
  userId: 'UX8213',
  status: 'TOKEN_VALID',
  accessTokenStatus: 'Valid — expires 3:30 AM tomorrow',
  lastSync: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  portfolioValue: 742350,
  updated: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
};

const BOT_STATUS = {
  state: 'RUNNING', // RUNNING | PAUSED | STOPPED
  connected: true,
  lastHeartbeat: new Date(Date.now() - 1000 * 18).toISOString(),
  version: 'v4.2.1',
  latencyMs: 142,
  server: 'mumbai-vm-02',
  brokerConnected: true,
  autoRefresh: true,
};

const MISSION_CONTROL = {
  platformVersion: 'v2.7.0',
  researchVersion: '19',
  websiteVersion: 'v1.4.2',
  updated: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
  modules: [
    { name: 'Execution', status: 'OPERATIONAL' },
    { name: 'Research', status: 'OPERATIONAL' },
    { name: 'Reporting', status: 'OPERATIONAL' },
    { name: 'Payments', status: 'OPERATIONAL' },
    { name: 'Website', status: 'OPERATIONAL' },
  ],
};

// ---- Trade history generation (Trade Database schema) ----
const INSTRUMENTS = ['NIFTY 24800 CE', 'NIFTY 24700 PE', 'BANKNIFTY 52400 CE', 'BANKNIFTY 52200 PE', 'NIFTY 24900 CE', 'FINNIFTY 23600 PE', 'NIFTY FUT', 'BANKNIFTY FUT'];
function genTrades(count) {
  const trades = [];
  let t = new Date('2026-07-31T15:20:00');
  for (let i = 0; i < count; i++) {
    const strat = pick(STRATEGIES_DB);
    const entry = randRange(120, 640);
    const win = rng() < 0.58;
    const pnlPct = win ? randRange(0.02, 0.22) : -randRange(0.02, 0.16);
    const qty = pick([25, 50, 75, 100, 150, 200]);
    const exit = entry * (1 + pnlPct);
    const pnl = Math.round((exit - entry) * qty);
    const fees = Math.round(qty * randRange(0.8, 2.1));
    const durMin = randInt(6, 340);
    const closedDate = new Date(t.getTime() - i * (1000 * 60 * randInt(40, 260)));
    const createdDate = new Date(closedDate.getTime() - durMin * 60000);
    trades.push({
      id: `TRD${String(100450 - i).padStart(6, '0')}`,
      customer: CUSTOMER.id,
      strategy: strat.id,
      strategyName: strat.name,
      strategyColor: strat.color,
      broker: 'BR001',
      signalId: `SIG${String(220310 - i).padStart(6, '0')}`,
      instrument: pick(INSTRUMENTS),
      entry: Math.round(entry * 100) / 100,
      exit: Math.round(exit * 100) / 100,
      quantity: qty,
      pnl,
      fees,
      duration: durMin,
      status: i === 0 && rng() < 0.3 ? 'PARTIAL' : 'FILLED',
      version: strat.version,
      created: createdDate.toISOString(),
      closed: closedDate.toISOString(),
    });
  }
  return trades;
}
const TRADES_DB = genTrades(146);

// ---- Equity curve series ----
function genEquitySeries(days) {
  let equity = 500000;
  const series = [];
  const start = new Date();
  start.setDate(start.getDate() - days);
  for (let i = 0; i <= days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      equity += randRange(-9000, 13500);
    }
    series.push({ date: d.toISOString().slice(0, 10), value: Math.round(equity) });
  }
  return series;
}
const EQUITY_SERIES = { '1M': genEquitySeries(30), '3M': genEquitySeries(90), '1Y': genEquitySeries(365), 'ALL': genEquitySeries(430) };

function genMonthlyReturns() {
  const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  return months.map((m) => ({ month: m, value: Math.round(randRange(-4.5, 9.5) * 100) / 100 }));
}
const MONTHLY_RETURNS = genMonthlyReturns();

function genDailyPnl(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(Math.round(randRange(-14000, 19000)));
  return out;
}
const DAILY_PNL = genDailyPnl(22);

// ---- Performance metrics ----
const totalPnl = TRADES_DB.reduce((s, t) => s + t.pnl, 0);
const wins = TRADES_DB.filter((t) => t.pnl > 0);
const losses = TRADES_DB.filter((t) => t.pnl <= 0);
const PERFORMANCE_METRICS = {
  cagr: 27.4, sharpe: 1.82, sortino: 2.31, calmar: 1.94,
  maxDrawdown: -8.6, winRate: Math.round((wins.length / TRADES_DB.length) * 1000) / 10,
  avgWin: Math.round(wins.reduce((s, t) => s + t.pnl, 0) / wins.length),
  avgLoss: Math.round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length),
  profitFactor: Math.round((wins.reduce((s, t) => s + t.pnl, 0) / Math.abs(losses.reduce((s, t) => s + t.pnl, 0))) * 100) / 100,
  expectancy: Math.round(totalPnl / TRADES_DB.length),
  totalTrades: TRADES_DB.length,
};

// ---- Reports ----
const REPORTS_CATALOG = [
  { type: 'Monthly Report', icon: 'file', desc: 'Full breakdown of trades, PnL and strategy activity for the calendar month.' },
  { type: 'Annual Report', icon: 'fileText', desc: 'Consolidated yearly performance across all active strategies.' },
  { type: 'Tax Report', icon: 'fileText', desc: 'Realized gains summary formatted for ITR filing.' },
  { type: 'Broker Report', icon: 'building', desc: 'Reconciliation between broker contract notes and platform trade logs.' },
  { type: 'Performance Report', icon: 'trend', desc: 'CAGR, Sharpe, Sortino, drawdown and win-rate over the selected period.' },
  { type: 'Drawdown Report', icon: 'activity', desc: 'Peak-to-trough analysis with recovery duration for each drawdown.' },
  { type: 'Risk Report', icon: 'shield', desc: 'Position sizing, margin utilisation and risk-limit adherence.' },
];

// ---- Downloads ----
const DOWNLOADS_CATALOG = {
  strategyFiles: [
    { name: 'Gamma Flip Execution Bot', version: 'v4.2.1', size: '18.4 MB', date: '2026-07-22', checksum: 'a1c9e2f4b8d0173e5f6a9c2b1d4e7f80' },
  ],
  docs: [
    { name: 'Setup Guide', icon: 'bookOpen', format: 'PDF', size: '2.1 MB' },
    { name: 'User Manual', icon: 'fileText', format: 'PDF', size: '4.6 MB' },
    { name: 'Changelog', icon: 'layers', format: 'PDF', size: '640 KB' },
  ],
  previousVersions: [
    { version: 'v4.1.0', date: '2026-06-02', notes: 'Improved slippage handling on BANKNIFTY legs.' },
    { version: 'v4.0.4', date: '2026-05-11', notes: 'Broker session refresh reliability fix.' },
    { version: 'v3.9.0', date: '2026-04-03', notes: 'Added Gamma Flip v3 research parameters.' },
  ],
};

// ---- Billing ----
const INVOICES_DB = [
  { id: 'INV-2026-0148', date: '2025-08-18', amount: 50000, plan: 'Gamma Flip — Annual', status: 'PAID', gst: 'GSTIN27ABCDE1234F1Z5' },
  { id: 'INV-2025-0091', date: '2024-08-18', amount: 45000, plan: 'Gamma Flip — Annual', status: 'PAID', gst: 'GSTIN27ABCDE1234F1Z5' },
];
const PAYMENT_METHOD = { brand: 'HDFC Bank', last4: '4821', type: 'UPI Autopay', expiry: null };

// ---- Notifications ----
const NOTIFICATIONS_DB = [
  { id: 'N1', type: 'payment', title: 'Payment Successful', desc: '₹50,000 received for Gamma Flip — Annual renewal.', time: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), unread: true },
  { id: 'N2', type: 'strategy', title: 'Strategy Updated', desc: 'Gamma Flip promoted to research version 19.', time: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(), unread: true },
  { id: 'N3', type: 'broker', title: 'Broker Reconnected', desc: 'Upstox access token refreshed successfully.', time: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), unread: false },
  { id: 'N4', type: 'system', title: 'System Maintenance', desc: 'Scheduled maintenance on Aug 3, 12:00–12:30 AM IST.', time: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), unread: false },
  { id: 'N5', type: 'subscription', title: 'Subscription Renewed', desc: 'Your plan has been extended to Aug 18, 2027.', time: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), unread: false },
];

// ---- Support ----
const TICKETS_DB = [
  { id: 'TCK-3312', subject: 'Delay in broker token refresh this morning', priority: 'Medium', status: 'In Progress', created: '2026-07-30', updated: '2026-07-31' },
  { id: 'TCK-3287', subject: 'Request to update registered phone number', priority: 'Low', status: 'Resolved', created: '2026-07-18', updated: '2026-07-19' },
];
const FAQ_DB = [
  { q: 'How does automated execution work?', a: 'Every signal passes through a fixed sequence — risk validation, subscription check, broker validation and margin check — before an order is placed automatically.' },
  { q: 'What happens if my broker token expires?', a: 'Trading is disabled immediately, you receive an email, and the platform retries the login automatically at the next session window.' },
  { q: 'Can I pause my subscription temporarily?', a: 'Yes. Pausing stops new orders while keeping your account and history intact — resume anytime from Billing.' },
  { q: 'How often are strategies updated?', a: 'Strategies are continuously researched. Meaningful changes pass through internal validation and limited live testing before reaching production.' },
];

// ---- Sessions ----
const SESSIONS_DB = [
  { device: 'Chrome on Windows', location: 'Pune, Maharashtra', icon: 'monitor', current: true, lastActive: new Date().toISOString() },
  { device: 'Viksit Analyst App — Android', location: 'Pune, Maharashtra', icon: 'smartphone', current: false, lastActive: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString() },
];

/* --------------------------------------------------------------------------
   4. GLOBAL STATE
   -------------------------------------------------------------------------- */
const STATE = {
  route: 'dashboard',
  session: 'valid', // 'valid' | 'expired'
  theme: localStorage.getItem('va_theme') || 'dark',
  sidebarCollapsed: localStorage.getItem('va_sidebar') === '1',
  equityRange: '1M',
  trades: { page: 1, pageSize: 10, sortKey: 'closed', sortDir: 'desc', search: '', strategy: 'all', status: 'all' },
  settingsPanel: 'general',
};

/* --------------------------------------------------------------------------
   5. TOASTS
   -------------------------------------------------------------------------- */
function toast({ type = 'info', title, desc = '', duration = 4200 }) {
  const stack = qs('#toastStack');
  const iconName = { success: 'checkCircle', error: 'alertCircle', warning: 'alertTriangle', info: 'bell' }[type];
  const node = el(`
    <div class="toast" role="status">
      <span class="toast-icon ${type}">${ICONS[iconName]}</span>
      <div class="toast-body">
        <div class="toast-title">${escapeHTML(title)}</div>
        ${desc ? `<div class="toast-desc">${escapeHTML(desc)}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Dismiss">${ICONS.x}</button>
    </div>`);
  stack.appendChild(node);
  const remove = () => { node.classList.add('is-leaving'); setTimeout(() => node.remove(), 180); };
  node.querySelector('.toast-close').addEventListener('click', remove);
  setTimeout(remove, duration);
}

/* --------------------------------------------------------------------------
   6. GENERIC MODAL
   -------------------------------------------------------------------------- */
// H4 fix: focus-trap state. The Escape-to-close behavior already existed
// (see the document-level keydown handler in section 11 below); what was
// missing was (a) trapping Tab/Shift+Tab inside the modal so keyboard
// users can't tab into hidden background content, and (b) returning focus
// to whatever triggered the modal once it closes.
let modalReturnFocusEl_ = null;
let modalKeydownHandler_ = null;

function getFocusableEls_(container) {
  return qsa(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    container
  ).filter((el) => el.offsetParent !== null); // visible only
}

function openModal(html, { size = '' } = {}) {
  const overlay = qs('#genericModalOverlay');
  const modal = qs('#genericModal');
  modal.className = `modal ${size}`;
  modal.innerHTML = html;
  overlay.classList.add('is-open');

  modalReturnFocusEl_ = document.activeElement;

  const first = modal.querySelector('[autofocus]') || modal.querySelector('button, input');
  if (first) first.focus();
  qsa('[data-close-modal]', modal).forEach((b) => b.addEventListener('click', closeModal));

  modalKeydownHandler_ = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = getFocusableEls_(modal);
    if (!focusable.length) { e.preventDefault(); return; }
    const firstEl = focusable[0];
    const lastEl = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  };
  overlay.addEventListener('keydown', modalKeydownHandler_);
}
function closeModal() {
  const overlay = qs('#genericModalOverlay');
  overlay.classList.remove('is-open');
  if (modalKeydownHandler_) {
    overlay.removeEventListener('keydown', modalKeydownHandler_);
    modalKeydownHandler_ = null;
  }
  // Return focus to whatever triggered the modal so keyboard users don't
  // lose their place in the page when it closes.
  if (modalReturnFocusEl_ && typeof modalReturnFocusEl_.focus === 'function') {
    modalReturnFocusEl_.focus();
  }
  modalReturnFocusEl_ = null;
}
qs('#genericModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'genericModalOverlay') closeModal(); });

function confirmAction({ title, desc, confirmLabel = 'Confirm', danger = false, onConfirm }) {
  openModal(`
    <div class="modal-head"><div class="modal-title">${escapeHTML(title)}</div><button class="icon-btn" data-close-modal>${ICONS.x}</button></div>
    <div class="modal-body"><p class="text-sm text-secondary" style="line-height:1.6;">${escapeHTML(desc)}</p></div>
    <div class="modal-foot">
      <button class="btn btn-secondary" data-close-modal>Cancel</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmActionBtn">${escapeHTML(confirmLabel)}</button>
    </div>`);
  qs('#confirmActionBtn').addEventListener('click', () => { closeModal(); onConfirm && onConfirm(); });
}

/* --------------------------------------------------------------------------
   7. RIPPLE (button micro-interaction)
   -------------------------------------------------------------------------- */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn, .qa-tile, .page-btn, .nav-item');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  const prevPos = getComputedStyle(btn).position;
  if (prevPos === 'static') btn.style.position = 'relative';
  btn.style.overflow = btn.style.overflow || 'hidden';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

/* --------------------------------------------------------------------------
   8. THEME + SIDEBAR
   -------------------------------------------------------------------------- */
function applyTheme() {
  document.body.setAttribute('data-theme', STATE.theme);
  localStorage.setItem('va_theme', STATE.theme);
}
qs('#themeToggle').addEventListener('click', () => {
  STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  toast({ type: 'info', title: `Switched to ${STATE.theme} theme` });
});

function applySidebar() {
  qs('#appShell').classList.toggle('is-collapsed', STATE.sidebarCollapsed);
  localStorage.setItem('va_sidebar', STATE.sidebarCollapsed ? '1' : '0');
}
qs('#collapseBtn').addEventListener('click', () => { STATE.sidebarCollapsed = !STATE.sidebarCollapsed; applySidebar(); });
qs('#mobileMenuBtn').addEventListener('click', () => { qs('#appShell').classList.add('is-mobile-open'); qs('#sidebarScrim').classList.add('is-open'); });
qs('#sidebarScrim').addEventListener('click', closeMobileSidebar);
function closeMobileSidebar() { qs('#appShell').classList.remove('is-mobile-open'); qs('#sidebarScrim').classList.remove('is-open'); }

/* --------------------------------------------------------------------------
   9. ROUTER
   -------------------------------------------------------------------------- */
const VIEW_TITLES = {
  dashboard: 'Dashboard', strategies: 'Strategies', performance: 'Performance', trades: 'Trade History',
  broker: 'Broker', reports: 'Reports', downloads: 'Downloads', billing: 'Billing', support: 'Support',
  profile: 'Profile', settings: 'Settings',
};
const RENDERERS = {}; // populated below, one render fn per route

function navigate(route) {
  if (!VIEW_TITLES[route]) route = 'dashboard';
  STATE.route = route;
  window.location.hash = route;
  renderRoute(route);
  closeMobileSidebar();
}

function renderRoute(route) {
  qsa('.nav-item[data-route]').forEach((b) => b.classList.toggle('is-active', b.dataset.route === route));
  document.title = `${VIEW_TITLES[route]} — Viksit Analyst`;

  if (route === 'dashboard') {
    qsa('.view').forEach((v) => v.classList.toggle('is-active', v.id === 'view-dashboard'));
    if (!STATE._dashboardLoaded) { STATE._dashboardLoaded = true; RENDERERS.dashboard(); }
    return;
  }
  qsa('.view').forEach((v) => v.classList.remove('is-active'));
  const outlet = qs('#viewOutlet');
  let target = qs(`#view-${route}`);
  if (!target) {
    target = el(`<section class="view" id="view-${route}" data-view="${route}"></section>`);
    outlet.appendChild(target);
  }
  target.classList.add('is-active');
  if (RENDERERS[route] && !target.dataset.loaded) {
    target.dataset.loaded = '1';
    RENDERERS[route](target);
  }
}

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-route]');
  if (trigger) { e.preventDefault(); navigate(trigger.dataset.route); }
});
window.addEventListener('hashchange', () => navigate(window.location.hash.slice(1) || 'dashboard'));

/* --------------------------------------------------------------------------
   10. TOPBAR: NOTIFICATIONS + PROFILE DROPDOWNS
   -------------------------------------------------------------------------- */
function closeAllDropdowns() { qsa('.dropdown-panel').forEach((p) => p.classList.remove('is-open')); }
document.addEventListener('click', (e) => {
  if (!e.target.closest('#notifBtn') && !e.target.closest('#notifPanel')) qs('#notifPanel').classList.remove('is-open');
  if (!e.target.closest('#profileBtn') && !e.target.closest('#profilePanel')) qs('#profilePanel').classList.remove('is-open');
});

const NOTIF_META = {
  payment: { icon: 'card', bg: 'rgba(31,169,113,0.12)', color: 'var(--color-success)' },
  strategy: { icon: 'trend', bg: 'rgba(46,107,230,0.12)', color: '#6FA0FF' },
  broker: { icon: 'link', bg: 'rgba(255,153,51,0.12)', color: 'var(--color-accent)' },
  system: { icon: 'server', bg: 'rgba(245,166,35,0.12)', color: 'var(--color-warning)' },
  subscription: { icon: 'refresh', bg: 'rgba(31,169,113,0.12)', color: 'var(--color-success)' },
};
function renderNotifPanel() {
  const unread = NOTIFICATIONS_DB.filter((n) => n.unread).length;
  qs('#notifDot').hidden = unread === 0;
  const panel = qs('#notifPanel');
  panel.innerHTML = `
    <div class="dropdown-head">
      <div class="dropdown-head-title">Notifications ${unread ? `<span class="badge badge-accent" style="margin-left:6px;">${unread} new</span>` : ''}</div>
      <button class="btn btn-ghost btn-sm" id="markAllReadBtn">Mark all read</button>
    </div>
    <div class="dropdown-list">
      ${NOTIFICATIONS_DB.length ? NOTIFICATIONS_DB.map((n) => {
        const m = NOTIF_META[n.type] || NOTIF_META.system;
        return `<div class="notif-item ${n.unread ? 'is-unread' : ''}">
          <span class="notif-icon" style="background:${m.bg};color:${m.color};">${ICONS[m.icon]}</span>
          <div class="notif-body">
            <div class="notif-title">${escapeHTML(n.title)}</div>
            <div class="notif-desc">${escapeHTML(n.desc)}</div>
            <div class="notif-time">${fmtRelative(n.time)}</div>
          </div>
        </div>`;
      }).join('') : `<div class="cmdk-empty">You're all caught up.</div>`}
    </div>
    <div class="dropdown-foot"><button data-route="support">View all in Support</button></div>`;
  const mark = qs('#markAllReadBtn');
  if (mark) mark.addEventListener('click', () => { NOTIFICATIONS_DB.forEach((n) => (n.unread = false)); renderNotifPanel(); });
}
qs('#notifBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  qs('#profilePanel').classList.remove('is-open');
  renderNotifPanel();
  qs('#notifPanel').classList.toggle('is-open');
});

function renderProfilePanel() {
  qs('#profilePanel').innerHTML = `
    <button class="profile-menu-item" data-route="profile">${ICONS.user}Profile</button>
    <button class="profile-menu-item" data-route="settings">${ICONS.settings}Settings</button>
    <button class="profile-menu-item" data-route="billing">${ICONS.card}Billing</button>
    <div class="divider" style="margin:6px 0;"></div>
    <button class="profile-menu-item" id="logoutBtn" style="color:var(--color-error);">${ICONS.logout}Log out</button>`;
  qs('#logoutBtn').addEventListener('click', () => {
    confirmAction({
      title: 'Log out of Viksit Analyst?',
      desc: 'You will need to sign in again to access your dashboard.',
      confirmLabel: 'Log out',
      danger: true,
      // Reuses the shared, frozen auth service (auth/auth.js) — calls the
      // backend logout endpoint, clears the session, and redirects to
      // /auth/login.html. Falls back to the old mock screen only if the
      // auth layer somehow isn't loaded on this page.
      onConfirm: () => (window.VA_AUTH ? VA_AUTH.logout() : showSessionExpired()),
    });
  });
}
qs('#profileBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  qs('#notifPanel').classList.remove('is-open');
  renderProfilePanel();
  qs('#profilePanel').classList.toggle('is-open');
});

/* --------------------------------------------------------------------------
   11. COMMAND PALETTE (global search)
   -------------------------------------------------------------------------- */
function buildSearchIndex() {
  const idx = [];
  STRATEGIES_DB.forEach((s) => idx.push({ group: 'Strategies', label: s.name, meta: s.status.replace('_', ' '), route: 'strategies', icon: 'trend' }));
  TRADES_DB.slice(0, 40).forEach((t) => idx.push({ group: 'Trades', label: `${t.instrument} · ${t.id}`, meta: fmtDate(t.closed), route: 'trades', icon: 'activity' }));
  INVOICES_DB.forEach((i) => idx.push({ group: 'Invoices', label: `${i.id} — ${i.plan}`, meta: fmtINR(i.amount), route: 'billing', icon: 'card' }));
  TICKETS_DB.forEach((t) => idx.push({ group: 'Support Tickets', label: `${t.id} — ${t.subject}`, meta: t.status, route: 'support', icon: 'ticket' }));
  REPORTS_CATALOG.forEach((r) => idx.push({ group: 'Reports', label: r.type, meta: 'Generate', route: 'reports', icon: 'file' }));
  DOWNLOADS_CATALOG.docs.forEach((d) => idx.push({ group: 'Downloads', label: d.name, meta: d.format, route: 'downloads', icon: 'download' }));
  return idx;
}
const SEARCH_INDEX = buildSearchIndex();

function openCmdk() {
  qs('#cmdkOverlay').classList.add('is-open');
  qs('#cmdkInput').value = '';
  renderCmdkResults('');
  setTimeout(() => qs('#cmdkInput').focus(), 60);
}
function closeCmdk() { qs('#cmdkOverlay').classList.remove('is-open'); }
function renderCmdkResults(query) {
  const results = qs('#cmdkResults');
  const q = query.trim().toLowerCase();
  const matches = q ? SEARCH_INDEX.filter((i) => i.label.toLowerCase().includes(q)) : SEARCH_INDEX.slice(0, 8);
  if (!matches.length) { results.innerHTML = `<div class="cmdk-empty">No results for “${escapeHTML(query)}”.</div>`; return; }
  const groups = {};
  matches.forEach((m) => { (groups[m.group] = groups[m.group] || []).push(m); });
  results.innerHTML = Object.entries(groups).map(([g, items]) => `
    <div class="cmdk-group-title">${g}</div>
    ${items.map((i) => `<button class="cmdk-item" data-route="${i.route}">${ICONS[i.icon]}<span>${escapeHTML(i.label)}</span><span class="cmdk-item-meta">${escapeHTML(i.meta)}</span></button>`).join('')}
  `).join('');
  qsa('.cmdk-item', results).forEach((btn) => btn.addEventListener('click', () => { closeCmdk(); navigate(btn.dataset.route); }));
}
qs('#searchTrigger').addEventListener('click', openCmdk);
qs('#cmdkOverlay').addEventListener('click', (e) => { if (e.target.id === 'cmdkOverlay') closeCmdk(); });
qs('#cmdkInput').addEventListener('input', debounce((e) => renderCmdkResults(e.target.value), 90));
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); }
  if (e.key === 'Escape') { closeCmdk(); closeModal(); closeAllDropdowns(); }
});

/* --------------------------------------------------------------------------
   12. CANVAS CHARTS — vanilla, DPI-aware, no chart library
   -------------------------------------------------------------------------- */
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.parentElement.clientWidth;
  const h = parseInt(canvas.getAttribute('height'), 10) || 220;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w, h };
}
function cssVar(name) { return getComputedStyle(document.body).getPropertyValue(name).trim(); }

function drawLineChart(canvas, series, { positiveColor, tooltipEl } = {}) {
  if (!canvas || !series.length) return;
  const { ctx, w, h } = setupCanvas(canvas);
  const pad = { top: 16, right: 8, bottom: 24, left: 8 };
  const values = series.map((d) => d.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const stepX = (w - pad.left - pad.right) / (series.length - 1 || 1);
  const up = values[values.length - 1] >= values[0];
  const lineColor = positiveColor || (up ? cssVar('--color-success') : cssVar('--color-error'));

  ctx.clearRect(0, 0, w, h);

  // gridlines
  ctx.strokeStyle = cssVar('--border-subtle');
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = pad.top + ((h - pad.top - pad.bottom) / 3) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
  }

  const pointAt = (i) => {
    const x = pad.left + stepX * i;
    const y = pad.top + (h - pad.top - pad.bottom) * (1 - (values[i] - min) / range);
    return [x, y];
  };

  // gradient fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
  grad.addColorStop(0, lineColor + '33');
  grad.addColorStop(1, lineColor + '00');
  ctx.beginPath();
  series.forEach((_, i) => { const [x, y] = pointAt(i); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.lineTo(w - pad.right, h - pad.bottom); ctx.lineTo(pad.left, h - pad.bottom); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // line
  ctx.beginPath();
  series.forEach((_, i) => { const [x, y] = pointAt(i); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.strokeStyle = lineColor; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

  // end dot
  const [lx, ly] = pointAt(series.length - 1);
  ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fillStyle = lineColor; ctx.fill();
  ctx.beginPath(); ctx.arc(lx, ly, 6, 0, Math.PI * 2); ctx.strokeStyle = lineColor + '55'; ctx.lineWidth = 2; ctx.stroke();

  if (tooltipEl) {
    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      let idx = Math.round((mx - pad.left) / stepX);
      idx = Math.max(0, Math.min(series.length - 1, idx));
      const [px, py] = pointAt(idx);
      tooltipEl.style.left = px + 12 + 'px';
      tooltipEl.style.top = py - 8 + 'px';
      tooltipEl.innerHTML = `<strong class="mono">${fmtINR(series[idx].value)}</strong><br><span style="color:var(--text-tertiary)">${fmtDate(series[idx].date)}</span>`;
      tooltipEl.classList.add('is-visible');
    };
    canvas.onmouseleave = () => tooltipEl.classList.remove('is-visible');
  }
}

function drawBarChart(canvas, data, { labelKey = 'month', valueKey = 'value', positiveColor, negativeColor } = {}) {
  if (!canvas || !data.length) return;
  const { ctx, w, h } = setupCanvas(canvas);
  const pad = { top: 16, right: 8, bottom: 26, left: 8 };
  const values = data.map((d) => d[valueKey]);
  const max = Math.max(...values.map(Math.abs), 1);
  const barW = ((w - pad.left - pad.right) / data.length) * 0.55;
  const gap = ((w - pad.left - pad.right) / data.length);
  const zeroY = pad.top + (h - pad.top - pad.bottom) / 2;
  const posColor = positiveColor || cssVar('--color-success');
  const negColor = negativeColor || cssVar('--color-error');

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = cssVar('--border-subtle'); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(w - pad.right, zeroY); ctx.stroke();

  data.forEach((d, i) => {
    const val = d[valueKey];
    const barH = (Math.abs(val) / max) * ((h - pad.top - pad.bottom) / 2 - 6);
    const x = pad.left + gap * i + (gap - barW) / 2;
    const y = val >= 0 ? zeroY - barH : zeroY;
    ctx.fillStyle = val >= 0 ? posColor : negColor;
    roundRect(ctx, x, y, barW, Math.max(barH, 2), 3);
    ctx.fill();
    ctx.fillStyle = cssVar('--text-tertiary');
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d[labelKey], x + barW / 2, h - 8);
  });
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderHeatmap(container, values) {
  const max = Math.max(...values.map(Math.abs), 1);
  container.innerHTML = values.map((v) => {
    const intensity = Math.min(Math.abs(v) / max, 1);
    const color = v >= 0
      ? `rgba(31,169,113,${0.12 + intensity * 0.7})`
      : `rgba(214,69,69,${0.12 + intensity * 0.7})`;
    return `<div class="heatmap-cell tooltip" data-tooltip="${fmtINR(v)}" style="background:${color}"></div>`;
  }).join('');
}

/* --------------------------------------------------------------------------
   13. STATUS BADGE HELPERS (VADS-consistent labels/colors across the app)
   -------------------------------------------------------------------------- */
const SUBSCRIPTION_BADGE = {
  ACTIVE: ['success', 'Active'], PENDING: ['neutral', 'Pending'], GRACE_PERIOD: ['warning', 'Grace Period'],
  PAUSED: ['warning', 'Paused'], CANCELLED: ['neutral', 'Cancelled'], EXPIRED: ['error', 'Expired'], ARCHIVED: ['neutral', 'Archived'],
};
const BROKER_BADGE = {
  NOT_CONNECTED: ['neutral', 'Not Connected'], CONNECTED: ['success', 'Connected'], TOKEN_PENDING: ['warning', 'Token Pending'],
  TOKEN_VALID: ['success', 'Connected'], TOKEN_EXPIRED: ['error', 'Token Expired'], LOGIN_REQUIRED: ['error', 'Login Required'], DISABLED: ['neutral', 'Disabled'],
};
const STRATEGY_STATUS_BADGE = {
  MONITORING: ['info', 'Monitoring'], WAITING: ['neutral', 'Waiting'], ENTRY_READY: ['accent', 'Entry Ready'],
  POSITION_OPEN: ['success', 'Position Open'], EXIT_READY: ['warning', 'Exit Ready'], COMPLETED: ['neutral', 'Completed'], DISABLED: ['neutral', 'Disabled'],
};
const ORDER_STATUS_BADGE = {
  FILLED: ['success', 'Filled'], PARTIAL: ['warning', 'Partial'], CANCELLED: ['neutral', 'Cancelled'], REJECTED: ['error', 'Rejected'], FAILED: ['error', 'Failed'],
};
function badge([tone, label]) { return `<span class="badge badge-${tone}">${escapeHTML(label)}</span>`; }

/* --------------------------------------------------------------------------
   14. DASHBOARD HOME
   -------------------------------------------------------------------------- */
RENDERERS.dashboard = async function renderDashboard() {
  renderDashboardBanner();

  qs('#welcomeTitle').textContent = `Welcome back, ${CUSTOMER.name.split(' ')[0]}`;
  qs('#welcomeSubtitle').textContent = `Last login ${fmtRelative(CUSTOMER.lastLogin)} · Customer ID ${CUSTOMER.id}`;
  qs('#topbarAvatar').textContent = CUSTOMER.name.split(' ').map((s) => s[0]).slice(0, 2).join('');
  qs('#topbarName').textContent = CUSTOMER.name;
  qs('#topbarPlan').textContent = CUSTOMER.plan;

  try {
    await apiCall(true, { latency: [300, 700] }); // simulated loadCustomer()
    const daysLeft = daysBetween(new Date(), CUSTOMER.renewalDate);
    const strategy = STRATEGIES_DB.find((s) => s.id === CUSTOMER.strategyId);

    qs('#statCards').innerHTML = `
      ${statCard({ label: 'Subscription Status', icon: 'shield', value: SUBSCRIPTION_BADGE[CUSTOMER.subscriptionStatus][1], valueHtml: badge(SUBSCRIPTION_BADGE[CUSTOMER.subscriptionStatus]), footnote: `Renews ${fmtDate(CUSTOMER.renewalDate)}` })}
      ${statCard({ label: 'Days Remaining', icon: 'calendar', value: daysLeft, footnote: `Next payment ${fmtINR(CUSTOMER.nextPaymentAmount)}` })}
      ${statCard({ label: "Today's PnL", icon: 'wallet', value: fmtINR(DAILY_PNL[DAILY_PNL.length - 1]), valueClass: DAILY_PNL[DAILY_PNL.length - 1] >= 0 ? 'pos' : 'neg', delta: DAILY_PNL[DAILY_PNL.length - 1] >= 0 ? 'up' : 'down', deltaLabel: `${TRADES_DB.filter(t=>daysBetween(t.closed,new Date())===0).length} trades today` })}
      ${statCard({ label: 'Bot Status', icon: 'bolt', value: BOT_STATUS.state === 'RUNNING' ? 'Running' : BOT_STATUS.state === 'PAUSED' ? 'Paused' : 'Stopped', valueHtml: `<span class="flex items-center gap-8"><span class="pulse-dot ${BOT_STATUS.state === 'RUNNING' ? 'success' : BOT_STATUS.state === 'PAUSED' ? 'warning' : 'error'}"></span>${BOT_STATUS.state === 'RUNNING' ? 'Running' : BOT_STATUS.state === 'PAUSED' ? 'Paused' : 'Stopped'}</span>`, footnote: `v${BOT_STATUS.version.replace('v','')} · ${BOT_STATUS.latencyMs}ms` })}
    `;

    qs('#subscriptionCard').innerHTML = `
      <div class="card-head">
        <div>
          <div class="card-title">${ICONS.shield}Subscription</div>
          <div class="card-sub">Strategy plan &amp; renewal</div>
        </div>
        ${badge(SUBSCRIPTION_BADGE[CUSTOMER.subscriptionStatus])}
      </div>
      <div class="flex items-center gap-12 mb-16">
        <span class="strategy-dot ${strategy.color}" style="width:11px;height:11px;"></span>
        <div>
          <div style="font-family:var(--font-display);font-weight:600;font-size:var(--fs-md);">${escapeHTML(strategy.name)}</div>
          <div class="text-tertiary text-xs">${escapeHTML(strategy.fullName)} · v${strategy.version}</div>
        </div>
      </div>
      <div class="grid grid-3" style="gap:12px;margin-bottom:18px;">
        <div class="card-flat"><div class="text-tertiary text-xs mb-16" style="margin-bottom:6px;">Expiry Date</div><div class="font-mono font-semibold text-sm">${fmtDate(CUSTOMER.renewalDate)}</div></div>
        <div class="card-flat"><div class="text-tertiary text-xs" style="margin-bottom:6px;">Next Payment</div><div class="font-mono font-semibold text-sm">${fmtINR(CUSTOMER.nextPaymentAmount)}</div></div>
        <div class="card-flat"><div class="text-tertiary text-xs" style="margin-bottom:6px;">Capital Range</div><div class="font-mono font-semibold text-sm">${escapeHTML(CUSTOMER.capitalRange.split(' – ')[0])}+</div></div>
      </div>
      <div class="text-tertiary text-xs mb-16" style="margin-bottom:6px;display:flex;justify-content:space-between;"><span>${daysLeft} days remaining</span><span>${fmtDate(CUSTOMER.createdDate)} → ${fmtDate(CUSTOMER.renewalDate)}</span></div>
      <div class="progress"><div class="progress-bar ${daysLeft < 10 ? 'error' : daysLeft < 30 ? 'warning' : ''}" style="width:${Math.max(4, Math.min(100, 100 - (daysLeft / 365) * 100))}%"></div></div>
      <div class="flex gap-10 mt-20">
        <button class="btn btn-primary" data-action="renew">${ICONS.refresh}Renew Now</button>
        <button class="btn btn-secondary" data-route="billing">View History</button>
      </div>`;

    qs('#botStatusCard').innerHTML = `
      <div class="card-head"><div class="card-title">${ICONS.bolt}Bot Status</div></div>
      <div class="bot-hero" style="margin-bottom:18px;">
        <div class="bot-orb ${BOT_STATUS.state.toLowerCase()}">${ICONS.bolt}</div>
        <div>
          <div style="font-weight:600;font-size:var(--fs-md);text-transform:capitalize;">${BOT_STATUS.state.toLowerCase()}</div>
          <div class="text-tertiary text-xs">Heartbeat ${fmtRelative(BOT_STATUS.lastHeartbeat)}</div>
        </div>
      </div>
      <div class="flex justify-between" style="padding:9px 0;border-top:1px solid var(--border-subtle);"><span class="text-tertiary text-xs">Version</span><span class="font-mono text-xs">${BOT_STATUS.version}</span></div>
      <div class="flex justify-between" style="padding:9px 0;border-top:1px solid var(--border-subtle);"><span class="text-tertiary text-xs">Latency</span><span class="font-mono text-xs">${BOT_STATUS.latencyMs}ms</span></div>
      <div class="flex justify-between" style="padding:9px 0;border-top:1px solid var(--border-subtle);"><span class="text-tertiary text-xs">Server</span><span class="font-mono text-xs">${BOT_STATUS.server}</span></div>
      <div class="flex justify-between" style="padding:9px 0;border-top:1px solid var(--border-subtle);"><span class="text-tertiary text-xs">Broker</span><span>${badge(BROKER_BADGE[CUSTOMER.brokerStatus])}</span></div>
      <div class="flex justify-between" style="padding:9px 0;border-top:1px solid var(--border-subtle);">
        <span class="text-tertiary text-xs">Auto Refresh</span>
        <label class="switch"><input type="checkbox" ${BOT_STATUS.autoRefresh ? 'checked' : ''} id="autoRefreshToggle"><span class="switch-track"></span></label>
      </div>`;
    const arToggle = qs('#autoRefreshToggle');
    if (arToggle) arToggle.addEventListener('change', (e) => { BOT_STATUS.autoRefresh = e.target.checked; toast({ type: 'info', title: `Auto refresh ${e.target.checked ? 'enabled' : 'disabled'}` }); });

    const bkr = BROKERS_CATALOG.find((b) => b.id === CUSTOMER.brokerId);
    qs('#brokerMiniCard').innerHTML = `
      <div class="card-head"><div class="card-title">${ICONS.link}Broker</div>${badge(BROKER_BADGE[CUSTOMER.brokerStatus])}</div>
      <div class="broker-card" style="background:transparent;border:none;padding:0;margin-bottom:16px;">
        <div class="broker-logo">${bkr.short}</div>
        <div class="broker-info">
          <div class="broker-name">${bkr.name}</div>
          <div class="broker-meta">Portfolio ${fmtINR(BROKER_CONNECTION.portfolioValue)}</div>
        </div>
      </div>
      <div class="text-tertiary text-xs" style="margin-bottom:14px;">Last sync ${fmtRelative(BROKER_CONNECTION.lastSync)}</div>
      <button class="btn btn-secondary btn-block" data-route="broker">Manage Broker</button>`;

    renderEquityChart();
    qsa('#equityRangeTabs .chart-tab').forEach((tab) => tab.addEventListener('click', () => {
      qsa('#equityRangeTabs .chart-tab').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      STATE.equityRange = tab.dataset.range;
      renderEquityChart();
    }));
  } catch (err) {
    qs('#statCards').innerHTML = errorStateHTML();
  }
};

function renderDashboardBanner() {
  const days = daysBetween(new Date(), CUSTOMER.renewalDate);
  const banner = qs('#dashboardBanner');
  if (CUSTOMER.subscriptionStatus === 'GRACE_PERIOD') {
    banner.innerHTML = `<div class="banner banner-warning"><span class="banner-icon">${ICONS.alertTriangle}</span><div class="banner-body"><div class="banner-title">Your subscription is in its grace period</div><div class="banner-desc">Trading continues uninterrupted, but renew soon to avoid a pause.</div></div><button class="btn btn-primary btn-sm" data-action="renew">Renew Now</button></div>`;
  } else if (CUSTOMER.subscriptionStatus === 'EXPIRED') {
    banner.innerHTML = `<div class="banner banner-error"><span class="banner-icon">${ICONS.alertCircle}</span><div class="banner-body"><div class="banner-title">Your subscription has expired</div><div class="banner-desc">Execution has been paused. Renew to resume automated trading.</div></div><button class="btn btn-primary btn-sm" data-action="renew">Renew Now</button></div>`;
  } else if (days <= 7) {
    banner.innerHTML = `<div class="banner banner-warning"><span class="banner-icon">${ICONS.calendar}</span><div class="banner-body"><div class="banner-title">Your plan renews in ${days} day${days===1?'':'s'}</div><div class="banner-desc">Renew ahead of time to keep the bot running without interruption.</div></div><button class="btn btn-primary btn-sm" data-action="renew">Renew Now</button></div>`;
  } else {
    banner.innerHTML = '';
  }
}

function statCard({ label, icon, value, valueHtml, valueClass = '', footnote, delta, deltaLabel }) {
  return `
    <div class="card stat-card is-interactive">
      <div class="stat-label"><span>${escapeHTML(label)}</span><span class="stat-icon-wrap">${ICONS[icon]}</span></div>
      <div class="stat-value ${valueClass}">${valueHtml || escapeHTML(value)}</div>
      ${delta ? `<div class="stat-delta ${delta}">${delta === 'up' ? ICONS.arrowUp : ICONS.arrowDown}<span>${escapeHTML(deltaLabel || '')}</span></div>` : (footnote ? `<div class="stat-footnote">${escapeHTML(footnote)}</div>` : '')}
    </div>`;
}

function renderEquityChart() {
  const canvas = qs('#equityChart');
  if (!canvas) return;
  drawLineChart(canvas, EQUITY_SERIES[STATE.equityRange], { tooltipEl: qs('#equityTooltip') });
}
window.addEventListener('resize', debounce(() => { if (STATE.route === 'dashboard') renderEquityChart(); }, 200));

/* --------------------------------------------------------------------------
   15. SHARED STATE PANELS
   -------------------------------------------------------------------------- */
function emptyStateHTML({ title, desc, iconName = 'inbox', actionLabel, actionRoute, actionHandler }) {
  return `
    <div class="state-panel">
      <span class="state-illo">${ICONS[iconName]}</span>
      <div class="state-title">${escapeHTML(title)}</div>
      <div class="state-desc">${escapeHTML(desc)}</div>
      ${actionLabel ? `<div class="state-actions"><button class="btn btn-primary" ${actionRoute ? `data-route="${actionRoute}"` : ''} ${actionHandler ? `data-action="${actionHandler}"` : ''}>${escapeHTML(actionLabel)}</button></div>` : ''}
    </div>`;
}
function errorStateHTML(msg) {
  return `
    <div class="state-panel">
      <span class="state-illo text-error">${ICONS.cloudOff}</span>
      <div class="state-title">Connection lost</div>
      <div class="state-desc">${escapeHTML(msg || "We couldn't reach the server. We'll retry automatically — or you can try again now.")}</div>
      <div class="state-actions"><button class="btn btn-secondary" onclick="location.reload()">${ICONS.refresh} Retry</button></div>
    </div>`;
}
function loadingLineHTML(label) { return `<div class="loading-line"><span class="spinner"></span>${escapeHTML(label || 'Loading…')}</div>`; }

/* --------------------------------------------------------------------------
   16. STRATEGIES VIEW
   -------------------------------------------------------------------------- */
RENDERERS.strategies = function (target) {
  target.innerHTML = `
    <div class="view-head"><div><div class="view-title">Strategies</div><div class="view-subtitle">Research-driven, versioned, and continuously monitored.</div></div></div>
    <div class="grid grid-3" id="strategyCards"></div>`;
  qs('#strategyCards', target).innerHTML = STRATEGIES_DB.map((s) => `
    <div class="card is-interactive">
      <div class="card-head">
        <div class="flex items-center gap-10">
          <span class="qa-tile-icon" style="background:rgba(${s.color === 'ivrv' ? '46,107,230' : s.color === 'gamma' ? '255,153,51' : '31,169,113'},0.14);color:var(--color-${s.color});">${ICONS[s.color === 'ivrv' ? 'wave' : s.color === 'gamma' ? 'bolt' : 'trend']}</span>
          <div>
            <div style="font-weight:600;">${escapeHTML(s.name)}</div>
            <div class="text-tertiary text-xs">${escapeHTML(s.id)}</div>
          </div>
        </div>
        ${s.id === CUSTOMER.strategyId ? '<span class="badge badge-accent">Your Plan</span>' : ''}
      </div>
      <p class="text-sm text-secondary" style="line-height:1.6;margin-bottom:16px;">${escapeHTML(s.fullName)}. Version ${s.version}, research version ${s.researchVersion}.</p>
      <div class="metric-mini-grid" style="margin-bottom:16px;">
        <div class="metric-mini"><div class="metric-mini-label">Status</div><div style="margin-top:2px;">${badge(STRATEGY_STATUS_BADGE[s.status])}</div></div>
        <div class="metric-mini"><div class="metric-mini-label">Risk Profile</div><div class="text-sm font-semibold" style="margin-top:4px;">${escapeHTML(s.riskProfile)}</div></div>
      </div>
      <div class="text-xs text-tertiary" style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border-subtle);"><span>Frequency</span><span class="text-secondary">${escapeHTML(s.expectedFrequency)}</span></div>
      <div class="text-xs text-tertiary" style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border-subtle);"><span>Holding Period</span><span class="text-secondary">${escapeHTML(s.holdingPeriod)}</span></div>
      <div class="text-xs text-tertiary" style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--border-subtle);"><span>Capital Requirement</span><span class="font-mono text-secondary">${fmtINR(s.capitalRequirement)}</span></div>
      <div class="text-xs text-tertiary" style="display:flex;justify-content:space-between;padding:8px 0 0;border-top:1px solid var(--border-subtle);"><span>Updated</span><span class="text-secondary">${fmtRelative(s.updated)}</span></div>
    </div>`).join('');
};

/* --------------------------------------------------------------------------
   17. PERFORMANCE VIEW
   -------------------------------------------------------------------------- */
RENDERERS.performance = function (target) {
  const m = PERFORMANCE_METRICS;
  target.innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Performance</div><div class="view-subtitle">Every number your strategy has produced, nothing exaggerated.</div></div>
      <button class="btn btn-secondary" data-route="reports">${ICONS.download}Export Report</button>
    </div>
    <div class="grid grid-4">
      ${statCard({ label: 'CAGR', icon: 'trend', value: `${m.cagr}%`, valueClass: 'pos' })}
      ${statCard({ label: 'Sharpe Ratio', icon: 'activity', value: m.sharpe })}
      ${statCard({ label: 'Sortino Ratio', icon: 'activity', value: m.sortino })}
      ${statCard({ label: 'Max Drawdown', icon: 'arrowDown', value: `${m.maxDrawdown}%`, valueClass: 'neg' })}
    </div>
    <div class="grid grid-4 mt-20">
      ${statCard({ label: 'Win Rate', icon: 'checkCircle', value: `${m.winRate}%` })}
      ${statCard({ label: 'Profit Factor', icon: 'trend', value: m.profitFactor })}
      ${statCard({ label: 'Avg Win / Avg Loss', icon: 'wallet', value: `${fmtINR(m.avgWin)} / ${fmtINR(m.avgLoss)}` })}
      ${statCard({ label: 'Expectancy / Trade', icon: 'bolt', value: fmtINR(m.expectancy) })}
    </div>

    <div class="grid grid-12 mt-20">
      <div class="col-7">
        <div class="card">
          <div class="card-head"><div><div class="card-title">${ICONS.trend}Monthly Returns</div><div class="card-sub">% return by calendar month</div></div></div>
          <canvas id="monthlyReturnsChart" height="220"></canvas>
        </div>
      </div>
      <div class="col-5">
        <div class="card">
          <div class="card-head"><div><div class="card-title">${ICONS.activity}Daily PnL</div><div class="card-sub">Last ${DAILY_PNL.length} sessions</div></div></div>
          <canvas id="dailyPnlChart" height="220"></canvas>
        </div>
      </div>
    </div>

    <div class="grid grid-12 mt-20">
      <div class="col-12">
        <div class="card">
          <div class="card-head"><div><div class="card-title">${ICONS.calendar}Monthly Heatmap</div><div class="card-sub">Daily PnL intensity, current month</div></div></div>
          <div class="heatmap-grid" id="heatmapGrid"></div>
        </div>
      </div>
    </div>

    <div class="grid grid-12 mt-20">
      <div class="col-6">
        <div class="card">
          <div class="card-head"><div class="card-title">${ICONS.trend}Rolling 20-Trade Win Rate</div></div>
          <canvas id="rollingChart" height="180"></canvas>
        </div>
      </div>
      <div class="col-6">
        <div class="card">
          <div class="card-head"><div class="card-title">${ICONS.clock}Trade Duration Distribution</div></div>
          <canvas id="durationChart" height="180"></canvas>
        </div>
      </div>
    </div>`;

  drawBarChart(qs('#monthlyReturnsChart', target), MONTHLY_RETURNS, { labelKey: 'month', valueKey: 'value' });
  drawBarChart(qs('#dailyPnlChart', target), DAILY_PNL.map((v, i) => ({ label: i + 1, value: v })), { labelKey: 'label', valueKey: 'value' });
  renderHeatmap(qs('#heatmapGrid', target), genDailyPnl(31));

  // rolling win rate
  const rolling = [];
  for (let i = 20; i < TRADES_DB.length; i += 4) {
    const window = TRADES_DB.slice(i - 20, i);
    rolling.push({ date: window[0].closed, value: Math.round((window.filter((t) => t.pnl > 0).length / 20) * 1000) / 10 });
  }
  drawLineChart(qs('#rollingChart', target), rolling.reverse(), { positiveColor: cssVar('--color-ivrv') });

  const durationBuckets = [
    { label: '<15m', value: TRADES_DB.filter((t) => t.duration < 15).length },
    { label: '15-60m', value: TRADES_DB.filter((t) => t.duration >= 15 && t.duration < 60).length },
    { label: '1-3h', value: TRADES_DB.filter((t) => t.duration >= 60 && t.duration < 180).length },
    { label: '3h+', value: TRADES_DB.filter((t) => t.duration >= 180).length },
  ];
  drawBarChart(qs('#durationChart', target), durationBuckets, { labelKey: 'label', valueKey: 'value', negativeColor: cssVar('--color-ivrv') });
};

/* --------------------------------------------------------------------------
   18. TRADE HISTORY VIEW
   -------------------------------------------------------------------------- */
RENDERERS.trades = function (target) {
  target.innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Trade History</div><div class="view-subtitle">${TRADES_DB.length} trades logged across all strategies.</div></div>
      <button class="btn btn-secondary" id="exportCsvBtn">${ICONS.download}Export CSV</button>
    </div>
    <div class="table-toolbar">
      <div class="input-wrap">${ICONS.search}<input class="input" id="tradeSearch" placeholder="Search instrument or trade ID…"></div>
      <select class="select" id="tradeStrategyFilter" style="width:160px;height:38px;background:var(--bg-sunken);border:1px solid var(--border-default);border-radius:var(--radius-sm);padding:0 10px;">
        <option value="all">All Strategies</option>
        ${STRATEGIES_DB.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
      </select>
      <select class="select" id="tradeStatusFilter" style="width:140px;height:38px;background:var(--bg-sunken);border:1px solid var(--border-default);border-radius:var(--radius-sm);padding:0 10px;">
        <option value="all">All Status</option>
        <option value="FILLED">Filled</option>
        <option value="PARTIAL">Partial</option>
      </select>
      <div class="table-toolbar-spacer"></div>
      <span class="chip">${ICONS.filter}<span id="tradeResultCount"></span></span>
    </div>
    <div class="table-wrap" id="tradeTableWrap"></div>`;

  qs('#tradeSearch', target).addEventListener('input', debounce((e) => { STATE.trades.search = e.target.value; STATE.trades.page = 1; renderTradeTable(target); }, 180));
  qs('#tradeStrategyFilter', target).addEventListener('change', (e) => { STATE.trades.strategy = e.target.value; STATE.trades.page = 1; renderTradeTable(target); });
  qs('#tradeStatusFilter', target).addEventListener('change', (e) => { STATE.trades.status = e.target.value; STATE.trades.page = 1; renderTradeTable(target); });
  qs('#exportCsvBtn', target).addEventListener('click', exportTradesCsv);

  renderTradeTable(target);
};

function getFilteredTrades() {
  const { search, strategy, status, sortKey, sortDir } = STATE.trades;
  let rows = TRADES_DB.filter((t) => {
    if (strategy !== 'all' && t.strategy !== strategy) return false;
    if (status !== 'all' && t.status !== status) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!t.instrument.toLowerCase().includes(s) && !t.id.toLowerCase().includes(s)) return false;
    }
    return true;
  });
  rows.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (sortKey === 'closed' || sortKey === 'created') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return rows;
}

const TRADE_COLUMNS = [
  { key: 'closed', label: 'Date' }, { key: 'instrument', label: 'Instrument' }, { key: 'entry', label: 'Entry', num: true },
  { key: 'exit', label: 'Exit', num: true }, { key: 'quantity', label: 'Qty', num: true }, { key: 'strategyName', label: 'Strategy' },
  { key: 'pnl', label: 'P&L', num: true }, { key: 'status', label: 'Status' },
];

function renderTradeTable(target) {
  const wrap = qs('#tradeTableWrap', target);
  const all = getFilteredTrades();
  const { page, pageSize } = STATE.trades;
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const rows = all.slice((curPage - 1) * pageSize, curPage * pageSize);
  qs('#tradeResultCount', target).textContent = `${all.length} results`;

  if (!all.length) {
    wrap.innerHTML = emptyStateHTML({ title: 'No trades match your filters', desc: 'Try a different search term, or clear the strategy and status filters.', iconName: 'activity' });
    return;
  }

  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>${TRADE_COLUMNS.map((c) => `<th class="${c.num ? 'num' : ''} ${STATE.trades.sortKey === c.key ? 'is-sorted' : ''}" data-sort="${c.key}">${c.label}<span class="sort-icon">${STATE.trades.sortKey === c.key ? (STATE.trades.sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map((t) => `
          <tr>
            <td>${fmtDate(t.closed)}<div class="text-tertiary" style="font-size:10px;">${fmtDateTime(t.closed).split(',')[1]}</div></td>
            <td class="font-mono">${escapeHTML(t.instrument)}</td>
            <td class="num font-mono">${fmtNum(t.entry)}</td>
            <td class="num font-mono">${fmtNum(t.exit)}</td>
            <td class="num font-mono">${t.quantity}</td>
            <td><span class="cell-strategy"><span class="strategy-dot ${t.strategyColor}"></span>${escapeHTML(t.strategyName)}</span></td>
            <td class="num cell-pnl ${t.pnl >= 0 ? 'pos' : 'neg'}">${t.pnl >= 0 ? '+' : ''}${fmtINR(t.pnl)}</td>
            <td>${badge(ORDER_STATUS_BADGE[t.status])}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="table-footer">
      <span class="table-footer-count">Showing ${(curPage - 1) * pageSize + 1}–${Math.min(curPage * pageSize, all.length)} of ${all.length}</span>
      <div class="pagination" id="tradePagination"></div>
    </div>`;

  qsa('th[data-sort]', wrap).forEach((th) => th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (STATE.trades.sortKey === key) STATE.trades.sortDir = STATE.trades.sortDir === 'asc' ? 'desc' : 'asc';
    else { STATE.trades.sortKey = key; STATE.trades.sortDir = 'desc'; }
    renderTradeTable(target);
  }));

  renderPagination(qs('#tradePagination', wrap), curPage, totalPages, (p) => { STATE.trades.page = p; renderTradeTable(target); });
}

function renderPagination(container, current, total, onChange) {
  let pages = [];
  const push = (p) => pages.push(p);
  push(1);
  for (let p = current - 1; p <= current + 1; p++) if (p > 1 && p < total) push(p);
  if (total > 1) push(total);
  pages = [...new Set(pages)].sort((a, b) => a - b);
  let html = `<button class="page-btn" ${current === 1 ? 'disabled' : ''} data-p="${current - 1}">‹</button>`;
  let prev = 0;
  pages.forEach((p) => {
    if (p - prev > 1) html += `<span class="page-btn" style="pointer-events:none;">…</span>`;
    html += `<button class="page-btn ${p === current ? 'is-active' : ''}" data-p="${p}">${p}</button>`;
    prev = p;
  });
  html += `<button class="page-btn" ${current === total ? 'disabled' : ''} data-p="${current + 1}">›</button>`;
  container.innerHTML = html;
  qsa('button[data-p]', container).forEach((b) => b.addEventListener('click', () => onChange(parseInt(b.dataset.p, 10))));
}

function exportTradesCsv() {
  const rows = getFilteredTrades();
  const header = ['Trade ID', 'Date', 'Instrument', 'Strategy', 'Entry', 'Exit', 'Quantity', 'PnL', 'Fees', 'Status'];
  const lines = [header.join(',')].concat(rows.map((t) => [t.id, fmtDate(t.closed), t.instrument, t.strategyName, t.entry, t.exit, t.quantity, t.pnl, t.fees, t.status].join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `trades_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast({ type: 'success', title: 'CSV exported', desc: `${rows.length} trades downloaded.` });
}

/* --------------------------------------------------------------------------
   19. BROKER VIEW
   -------------------------------------------------------------------------- */
RENDERERS.broker = function (target) {
  const active = BROKERS_CATALOG.find((b) => b.id === CUSTOMER.brokerId);
  target.innerHTML = `
    <div class="view-head"><div><div class="view-title">Broker</div><div class="view-subtitle">Connection status and account routing for order execution.</div></div></div>
    <div class="grid grid-12">
      <div class="col-7">
        <div class="card">
          <div class="card-head"><div><div class="card-title">${ICONS.link}Connected Broker</div></div>${badge(BROKER_BADGE[CUSTOMER.brokerStatus])}</div>
          <div class="broker-card">
            <div class="broker-logo">${active.short}</div>
            <div class="broker-info">
              <div class="broker-name">${active.name}</div>
              <div class="broker-meta">User ID ${BROKER_CONNECTION.userId}</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="reconnectBtn">${ICONS.refresh}Reconnect</button>
          </div>
          <div class="metric-mini-grid mt-20">
            <div class="metric-mini"><div class="metric-mini-label">Access Token</div><div class="text-sm font-semibold" style="margin-top:4px;color:var(--color-success);">Valid</div></div>
            <div class="metric-mini"><div class="metric-mini-label">Last Sync</div><div class="text-sm font-semibold" style="margin-top:4px;">${fmtRelative(BROKER_CONNECTION.lastSync)}</div></div>
            <div class="metric-mini"><div class="metric-mini-label">Portfolio Value</div><div class="text-sm font-semibold font-mono" style="margin-top:4px;">${fmtINR(BROKER_CONNECTION.portfolioValue)}</div></div>
          </div>
          <div class="flex gap-10 mt-20">
            <button class="btn btn-secondary" id="disconnectBtn">${ICONS.unlink}Disconnect</button>
          </div>
        </div>
      </div>
      <div class="col-5">
        <div class="card" style="height:100%;">
          <div class="card-head"><div class="card-title">${ICONS.shield}API Status</div></div>
          <div class="systems-row"><span class="systems-row-label"><span class="pulse-dot success"></span>Broker Status</span><span>${badge(BROKER_BADGE[CUSTOMER.brokerStatus])}</span></div>
          <div class="systems-row"><span class="systems-row-label"><span class="pulse-dot success"></span>Access Token</span><span class="text-xs font-mono text-secondary">${BROKER_CONNECTION.accessTokenStatus}</span></div>
          <div class="systems-row"><span class="systems-row-label"><span class="pulse-dot success"></span>Auto Refresh</span><span class="text-xs text-secondary">Enabled</span></div>
        </div>
      </div>
    </div>

    <div class="card mt-20">
      <div class="card-head"><div><div class="card-title">${ICONS.building}Supported Brokers</div><div class="card-sub">Switching brokers pauses execution until reconnected.</div></div></div>
      <div class="brokers-list">
        ${BROKERS_CATALOG.map((b) => `
          <div class="broker-option ${!b.supported ? 'is-disabled' : ''}">
            <div class="broker-logo" style="width:36px;height:36px;font-size:12px;">${b.short}</div>
            <div class="broker-info"><div class="broker-name" style="font-size:var(--fs-sm);">${b.name}</div><div class="broker-meta">${b.id === CUSTOMER.brokerId ? 'Currently connected' : (b.supported ? 'Available' : b.note)}</div></div>
            ${b.id === CUSTOMER.brokerId ? '<span class="badge badge-success">Active</span>' : (b.supported ? `<button class="btn btn-secondary btn-sm" data-connect-broker="${b.id}">Connect</button>` : '<span class="badge badge-neutral">Future Ready</span>')}
          </div>`).join('')}
      </div>
    </div>`;

  qs('#reconnectBtn', target).addEventListener('click', () => toast({ type: 'success', title: 'Broker reconnected', desc: 'Session refreshed successfully.' }));
  qsa('[data-connect-broker]', target).forEach((b) => b.addEventListener('click', () => connectBroker(b.dataset.connectBroker)));
  qs('#disconnectBtn', target).addEventListener('click', () => confirmAction({
    title: 'Disconnect broker?', desc: 'Automated execution will pause immediately until you reconnect a broker.', confirmLabel: 'Disconnect', danger: true,
    onConfirm: () => toast({ type: 'warning', title: 'Broker disconnected', desc: 'Execution is paused until reconnected.' }),
  }));
};

/* --------------------------------------------------------------------------
   20. REPORTS VIEW
   -------------------------------------------------------------------------- */
RENDERERS.reports = function (target) {
  target.innerHTML = `
    <div class="view-head"><div><div class="view-title">Reports</div><div class="view-subtitle">Generated fresh from your trade ledger — never estimated.</div></div></div>
    <div class="grid grid-3" id="reportCards"></div>`;
  qs('#reportCards', target).innerHTML = REPORTS_CATALOG.map((r, i) => `
    <div class="card">
      <div class="card-head"><span class="stat-icon-wrap">${ICONS[r.icon]}</span></div>
      <div style="font-weight:600;margin-bottom:6px;">${escapeHTML(r.type)}</div>
      <p class="text-xs text-tertiary" style="line-height:1.6;margin-bottom:18px;min-height:52px;">${escapeHTML(r.desc)}</p>
      <div class="flex gap-8">
        <button class="btn btn-secondary btn-sm w-full" data-report="${i}" data-format="pdf">${ICONS.download}PDF</button>
        <button class="btn btn-secondary btn-sm w-full" data-report="${i}" data-format="csv">${ICONS.download}CSV</button>
      </div>
    </div>`).join('');
  qsa('button[data-report]', target).forEach((b) => b.addEventListener('click', () => {
    const r = REPORTS_CATALOG[b.dataset.report];
    toast({ type: 'success', title: `Generating ${r.type}`, desc: `Preparing your ${b.dataset.format.toUpperCase()} — it will download shortly.` });
    setTimeout(() => toast({ type: 'success', title: `${r.type} ready`, desc: 'Download started.' }), 1400);
  }));
};

/* --------------------------------------------------------------------------
   21. DOWNLOADS VIEW
   -------------------------------------------------------------------------- */
RENDERERS.downloads = function (target) {
  // Require active subscription — customers without a live subscription
  // don't get the bot binary or docs, only a path back to billing.
  const ACTIVE_STATUSES = ['ACTIVE', 'GRACE_PERIOD'];
  if (!ACTIVE_STATUSES.includes(CUSTOMER.subscriptionStatus)) {
    target.innerHTML = `
      <div class="view-head"><div><div class="view-title">Downloads</div><div class="view-subtitle">Execution bot, documentation and version history.</div></div></div>
      ${emptyStateHTML({ title: 'Downloads unlock with an active subscription', desc: `Your subscription is currently ${escapeHTML(SUBSCRIPTION_BADGE[CUSTOMER.subscriptionStatus] ? SUBSCRIPTION_BADGE[CUSTOMER.subscriptionStatus][1] : CUSTOMER.subscriptionStatus)}. Renew or activate a plan to download the bot, documentation and version history.`, iconName: 'download', actionLabel: 'Go to Billing', actionRoute: 'billing' })}`;
    return;
  }

  const bot = DOWNLOADS_CATALOG.strategyFiles[0];
  target.innerHTML = `
    <div class="view-head"><div><div class="view-title">Downloads</div><div class="view-subtitle">Execution bot, documentation and version history.</div></div></div>
    <div class="grid grid-12">
      <div class="col-7">
        <div class="card download-card">
          <div class="card-head"><div><div class="card-title">${ICONS.bolt}${escapeHTML(bot.name)}</div><div class="card-sub">Latest version — ${bot.version}</div></div><span class="badge badge-success">Latest</span></div>
          <div class="metric-mini-grid">
            <div class="metric-mini"><div class="metric-mini-label">Version</div><div class="text-sm font-semibold font-mono" style="margin-top:4px;">${bot.version}</div></div>
            <div class="metric-mini"><div class="metric-mini-label">Size</div><div class="text-sm font-semibold" style="margin-top:4px;">${bot.size}</div></div>
            <div class="metric-mini"><div class="metric-mini-label">Released</div><div class="text-sm font-semibold" style="margin-top:4px;">${fmtDate(bot.date)}</div></div>
          </div>
          <div>
            <div class="field-hint mb-16" style="margin-bottom:6px;">SHA-256 Checksum</div>
            <div class="checksum">${bot.checksum}</div>
          </div>
          <button class="btn btn-primary btn-block" data-action="download-bot">${ICONS.download}Download v${bot.version.replace('v','')}</button>
        </div>

        <div class="card mt-20">
          <div class="card-head"><div class="card-title">${ICONS.layers}Previous Versions</div></div>
          ${DOWNLOADS_CATALOG.previousVersions.map((v) => `
            <div class="invoice-row" style="padding-left:0;padding-right:0;">
              <span class="file-icon">${ICONS.file}</span>
              <div style="flex:1;min-width:0;">
                <div class="text-sm font-semibold font-mono">${v.version} <span class="text-tertiary font-mono" style="font-weight:400;">· ${fmtDate(v.date)}</span></div>
                <div class="text-xs text-tertiary">${escapeHTML(v.notes)}</div>
              </div>
              <button class="btn btn-ghost btn-sm">${ICONS.download}</button>
            </div>`).join('')}
        </div>
      </div>
      <div class="col-5">
        <div class="card">
          <div class="card-head"><div class="card-title">${ICONS.bookOpen}Documentation</div></div>
          ${DOWNLOADS_CATALOG.docs.map((d) => `
            <div class="invoice-row" style="padding-left:0;padding-right:0;">
              <span class="file-icon">${ICONS[d.icon]}</span>
              <div style="flex:1;min-width:0;"><div class="text-sm font-semibold">${escapeHTML(d.name)}</div><div class="text-xs text-tertiary">${d.format} · ${d.size}</div></div>
              <button class="btn btn-ghost btn-sm">${ICONS.download}</button>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
};

/* --------------------------------------------------------------------------
   22. BILLING VIEW
   -------------------------------------------------------------------------- */
// ⚠ PRODUCTION TODO (audit finding H5): every "save"/"update"/"cancel"
// action in RENDERERS.billing, .profile, and .settings below only calls
// toast({ type: 'success', ... }) — nothing is actually persisted, and
// there is no backend endpoint yet to persist it to (see AdminService.gs /
// DashboardApi.gs — no write actions exist for these fields today).
// That's expected at this stage, but today it's indistinguishable in the
// UI from a real save. Before this ships: wire each handler to a real
// API call with its own loading/error state, and until that exists,
// treat every "success" toast in this section as a demo confirmation,
// not a persisted change.
RENDERERS.billing = function (target) {
  target.innerHTML = `
    <div class="view-head"><div><div class="view-title">Billing</div><div class="view-subtitle">Subscription, payment method and invoice history.</div></div></div>
    <div class="grid grid-12">
      <div class="col-7">
        <div class="plan-card is-current">
          <div class="plan-badge-ribbon">Current Plan</div>
          <div class="text-tertiary text-xs" style="margin-bottom:4px;">Active Subscription</div>
          <div style="font-family:var(--font-display);font-size:var(--fs-xl);font-weight:600;margin-bottom:14px;">${escapeHTML(CUSTOMER.plan)}</div>
          <div class="grid grid-3" style="gap:12px;margin-bottom:18px;">
            <div class="card-flat"><div class="text-tertiary text-xs">Status</div><div style="margin-top:6px;">${badge(SUBSCRIPTION_BADGE[CUSTOMER.subscriptionStatus])}</div></div>
            <div class="card-flat"><div class="text-tertiary text-xs">Renewal Date</div><div class="font-mono text-sm font-semibold mt-8" style="margin-top:6px;">${fmtDate(CUSTOMER.renewalDate)}</div></div>
            <div class="card-flat"><div class="text-tertiary text-xs">Amount</div><div class="font-mono text-sm font-semibold" style="margin-top:6px;">${fmtINR(CUSTOMER.nextPaymentAmount)}</div></div>
          </div>
          <div class="flex gap-10">
            <button class="btn btn-primary" data-action="renew">${ICONS.refresh}Renew</button>
            <button class="btn btn-secondary" id="upgradeBtn">Upgrade Plan</button>
            <button class="btn btn-danger" id="cancelPlanBtn">Cancel</button>
          </div>
        </div>

        <div class="card mt-20">
          <div class="card-head"><div class="card-title">${ICONS.fileText}Invoices &amp; Payment History</div></div>
          ${INVOICES_DB.map((inv) => `
            <div class="invoice-row" style="padding-left:0;padding-right:0;">
              <span class="file-icon">${ICONS.fileText}</span>
              <div style="flex:1;min-width:0;">
                <div class="text-sm font-semibold">${inv.id} <span class="text-tertiary" style="font-weight:400;">· ${escapeHTML(inv.plan)}</span></div>
                <div class="text-xs text-tertiary font-mono">${fmtDate(inv.date)} · ${inv.gst}</div>
              </div>
              <span class="font-mono font-semibold text-sm" style="margin-right:6px;">${fmtINR(inv.amount)}</span>
              ${badge(['success', 'Paid'])}
              <button class="btn btn-ghost btn-sm">${ICONS.download}</button>
            </div>`).join('')}
        </div>
      </div>
      <div class="col-5">
        <div class="card">
          <div class="card-head"><div class="card-title">${ICONS.card}Payment Method</div></div>
          <div class="broker-card">
            <div class="broker-logo" style="background:var(--bg-raised);">${ICONS.card}</div>
            <div class="broker-info"><div class="broker-name">${PAYMENT_METHOD.brand}</div><div class="broker-meta">${PAYMENT_METHOD.type} •••• ${PAYMENT_METHOD.last4}</div></div>
          </div>
          <button class="btn btn-secondary btn-block mt-16">Update Payment Method</button>
        </div>
      </div>
    </div>`;

  qs('#upgradeBtn', target).addEventListener('click', () => toast({ type: 'info', title: 'Upgrade flow', desc: 'Contact support to switch strategy plans.' }));
  qs('#cancelPlanBtn', target).addEventListener('click', () => confirmAction({
    title: 'Cancel your subscription?', desc: 'Execution will stop at the end of your current billing period. Your history and account remain intact.', confirmLabel: 'Cancel Subscription', danger: true,
    onConfirm: () => toast({ type: 'warning', title: 'Cancellation scheduled', desc: `Access continues until ${fmtDate(CUSTOMER.renewalDate)}.` }),
  }));
};

/* --------------------------------------------------------------------------
   23. SUPPORT VIEW
   -------------------------------------------------------------------------- */
const TICKET_STATUS_BADGE = { Open: ['info', 'Open'], 'In Progress': ['warning', 'In Progress'], Resolved: ['success', 'Resolved'], Closed: ['neutral', 'Closed'] };
RENDERERS.support = function (target) {
  target.innerHTML = `
    <div class="view-head">
      <div><div class="view-title">Support</div><div class="view-subtitle">Track tickets, browse FAQs, or reach the team directly.</div></div>
      <button class="btn btn-primary" data-action="new-ticket">${ICONS.plus}Create Ticket</button>
    </div>
    <div class="grid grid-12">
      <div class="col-7">
        <div class="card">
          <div class="card-head"><div class="card-title">${ICONS.ticket}Your Tickets</div></div>
          <div id="ticketList">
            ${TICKETS_DB.length ? TICKETS_DB.map((t) => `
              <div class="ticket-item">
                <span class="file-icon">${ICONS.ticket}</span>
                <div style="flex:1;min-width:0;">
                  <div class="text-sm font-semibold truncate">${escapeHTML(t.subject)}</div>
                  <div class="text-xs text-tertiary font-mono">${t.id} · Updated ${fmtDate(t.updated)}</div>
                </div>
                <span class="badge badge-neutral">${t.priority}</span>
                ${badge(TICKET_STATUS_BADGE[t.status])}
              </div>`).join('') : emptyStateHTML({ title: 'No tickets yet', desc: 'Questions about billing, broker connection, or strategy behaviour? Raise a ticket and the team will respond.', iconName: 'ticket', actionLabel: 'Create Ticket', actionHandler: 'new-ticket' })}
          </div>
        </div>

        <div class="card mt-20">
          <div class="card-head"><div class="card-title">${ICONS.bookOpen}Frequently Asked Questions</div></div>
          <div id="faqList">
            ${FAQ_DB.map((f, i) => `
              <div class="faq-item" data-idx="${i}">
                <button class="faq-q">${escapeHTML(f.q)}${ICONS.plus}</button>
                <div class="faq-a"><div class="faq-a-inner">${escapeHTML(f.a)}</div></div>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="col-5">
        <div class="card">
          <div class="card-head"><div class="card-title">${ICONS.mail}Contact Support</div></div>
          <p class="text-sm text-secondary" style="line-height:1.7;margin-bottom:16px;">Typical first response within 4 business hours on trading days.</p>
          <div class="flex items-center gap-10 mb-16" style="margin-bottom:12px;"><span class="stat-icon-wrap">${ICONS.mail}</span><span class="text-sm font-mono">analyst@viksitanalyst.com</span></div>
          <div class="flex items-center gap-10" style="margin-bottom:16px;"><span class="stat-icon-wrap">${ICONS.clock}</span><span class="text-sm">Mon–Fri, 9:00 AM – 6:00 PM IST</span></div>
          <button class="btn btn-secondary btn-block" id="liveChatBtn">Live Chat</button>
        </div>
        <div class="card mt-20">
          <div class="card-head"><div class="card-title">${ICONS.bookOpen}Knowledge Base</div></div>
          <p class="text-sm text-secondary" style="line-height:1.7;margin-bottom:16px;">Setup guides, broker onboarding steps, and strategy explainers.</p>
          <button class="btn btn-secondary btn-block" data-route="downloads">Browse Documentation</button>
        </div>
      </div>
    </div>`;

  qsa('.faq-q', target).forEach((btn) => btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const answer = item.querySelector('.faq-a');
    const wasOpen = item.classList.contains('is-open');
    qsa('.faq-item', target).forEach((f) => { f.classList.remove('is-open'); f.querySelector('.faq-a').style.maxHeight = null; });
    if (!wasOpen) { item.classList.add('is-open'); answer.style.maxHeight = answer.scrollHeight + 'px'; }
  }));
  qs('#liveChatBtn', target).addEventListener('click', () => toast({ type: 'info', title: 'Live chat coming soon', desc: 'For now, please raise a ticket or email support.' }));
};

function openNewTicketModal() {
  openModal(`
    <div class="modal-head"><div class="modal-title">Create Support Ticket</div><button class="icon-btn" data-close-modal>${ICONS.x}</button></div>
    <div class="modal-body">
      <div class="field mb-16" style="margin-bottom:14px;"><label>Subject</label><input class="input" id="ticketSubject" placeholder="Briefly describe the issue" autofocus></div>
      <div class="field mb-16" style="margin-bottom:14px;"><label>Priority</label>
        <select class="select input" id="ticketPriority"><option>Low</option><option selected>Medium</option><option>High</option><option>Urgent</option></select>
      </div>
      <div class="field"><label>Details</label><textarea class="input" id="ticketDetails" placeholder="Include any relevant dates, strategy names, or error messages…"></textarea></div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="submitTicketBtn">Submit Ticket</button></div>`);
  qs('#submitTicketBtn').addEventListener('click', () => {
    const subject = qs('#ticketSubject').value.trim();
    if (!subject) { toast({ type: 'error', title: 'Subject is required' }); return; }
    const newId = `TCK-${randInt(3400, 3999)}`;
    TICKETS_DB.unshift({ id: newId, subject, priority: qs('#ticketPriority').value, status: 'Open', created: new Date().toISOString().slice(0, 10), updated: new Date().toISOString().slice(0, 10) });
    closeModal();
    toast({ type: 'success', title: 'Ticket created', desc: `${newId} has been logged. We'll follow up by email.` });
    if (STATE.route === 'support') RENDERERS.support(qs('#view-support'));
  });
}

/* --------------------------------------------------------------------------
   24. PROFILE VIEW
   ⚠ Fake-success only, not yet persisted — see the H5 TODO above
   RENDERERS.billing for the full note; applies to #saveProfileBtn and
   #savePwBtn below too.
   -------------------------------------------------------------------------- */
RENDERERS.profile = function (target) {
  target.innerHTML = `
    <div class="view-head"><div><div class="view-title">Profile</div><div class="view-subtitle">Your account details and security.</div></div></div>
    <div class="grid grid-12">
      <div class="col-4">
        <div class="card" style="text-align:center;">
          <div class="avatar avatar-lg" style="margin:0 auto 16px;">${CUSTOMER.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}</div>
          <div style="font-weight:600;font-size:var(--fs-md);">${escapeHTML(CUSTOMER.name)}</div>
          <div class="text-tertiary text-xs font-mono" style="margin-top:2px;">${CUSTOMER.id}</div>
          <button class="btn btn-secondary btn-sm mt-16" id="changePhotoBtn">${ICONS.camera}Change Photo</button>
        </div>
        <div class="card mt-20">
          <div class="card-head"><div class="card-title">${ICONS.monitor}Active Sessions</div></div>
          ${SESSIONS_DB.map((s) => `
            <div class="session-item">
              <span class="session-icon">${ICONS[s.icon]}</span>
              <div style="flex:1;min-width:0;">
                <div class="text-sm font-semibold">${escapeHTML(s.device)} ${s.current ? '<span class="badge badge-success" style="margin-left:6px;">This device</span>' : ''}</div>
                <div class="text-xs text-tertiary">${escapeHTML(s.location)} · ${fmtRelative(s.lastActive)}</div>
              </div>
              ${!s.current ? `<button class="btn btn-ghost btn-sm" style="color:var(--color-error);">Revoke</button>` : ''}
            </div>`).join('')}
        </div>
      </div>
      <div class="col-8">
        <div class="card">
          <div class="card-head"><div class="card-title">${ICONS.user}Personal Information</div></div>
          <div class="form-row">
            <div class="field"><label>Full Name</label><input class="input" value="${escapeHTML(CUSTOMER.name)}"></div>
            <div class="field"><label>Email</label><input class="input" value="${escapeHTML(CUSTOMER.email)}" type="email"></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Phone</label><input class="input" value="${escapeHTML(CUSTOMER.phone)}"></div>
            <div class="field"><label>Company</label><input class="input" value="${escapeHTML(CUSTOMER.company)}"></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Country</label><input class="input" value="${escapeHTML(CUSTOMER.country)}"></div>
            <div class="field"><label>Timezone</label><input class="input" value="${escapeHTML(CUSTOMER.timezone)}"></div>
          </div>
          <button class="btn btn-primary" id="saveProfileBtn">Save Changes</button>
        </div>

        <div class="card mt-20">
          <div class="card-head"><div class="card-title">${ICONS.shield}Security</div></div>
          <div class="pref-row">
            <div><div class="pref-row-label">Password</div><div class="pref-row-desc">Last changed 4 months ago</div></div>
            <button class="btn btn-secondary btn-sm" id="changePasswordBtn">Change Password</button>
          </div>
          <div class="pref-row">
            <div><div class="pref-row-label">Two-Factor Authentication</div><div class="pref-row-desc">Adds an extra step when signing in</div></div>
            <label class="switch"><input type="checkbox" ${CUSTOMER.twoFAEnabled ? 'checked' : ''} id="twoFaToggle"><span class="switch-track"></span></label>
          </div>
          <div class="pref-row">
            <div><div class="pref-row-label">Login History</div><div class="pref-row-desc">View recent sign-ins to your account</div></div>
            <button class="btn btn-ghost btn-sm">View</button>
          </div>
        </div>
      </div>
    </div>`;

  qs('#saveProfileBtn', target).addEventListener('click', () => toast({ type: 'success', title: 'Profile updated' }));
  qs('#changePhotoBtn', target).addEventListener('click', () => toast({ type: 'info', title: 'Upload coming soon' }));
  qs('#changePasswordBtn', target).addEventListener('click', () => openModal(`
    <div class="modal-head"><div class="modal-title">Change Password</div><button class="icon-btn" data-close-modal>${ICONS.x}</button></div>
    <div class="modal-body">
      <div class="field mb-16" style="margin-bottom:14px;"><label>Current Password</label><input class="input" type="password" autofocus></div>
      <div class="field mb-16" style="margin-bottom:14px;"><label>New Password</label><input class="input" type="password"></div>
      <div class="field"><label>Confirm New Password</label><input class="input" type="password"></div>
    </div>
    <div class="modal-foot"><button class="btn btn-secondary" data-close-modal>Cancel</button><button class="btn btn-primary" id="savePwBtn">Update Password</button></div>`));
  document.addEventListener('click', function pwHandler(e) { if (e.target.id === 'savePwBtn') { closeModal(); toast({ type: 'success', title: 'Password updated' }); } });
  const tfa = qs('#twoFaToggle', target);
  if (tfa) tfa.addEventListener('change', (e) => toast({ type: 'info', title: `Two-factor authentication ${e.target.checked ? 'enabled' : 'disabled'}` }));
};

/* --------------------------------------------------------------------------
   25. SETTINGS VIEW
   ⚠ Fake-success only, not yet persisted — see the H5 TODO above
   RENDERERS.billing.
   -------------------------------------------------------------------------- */
const SETTINGS_PANELS = ['general', 'notifications', 'privacy', 'api', 'devices', 'danger'];
const SETTINGS_LABELS = { general: 'General', notifications: 'Notifications', privacy: 'Privacy', api: 'API Keys', devices: 'Connected Devices', danger: 'Danger Zone' };
const SETTINGS_ICONS = { general: 'settings', notifications: 'bell', privacy: 'shield', api: 'key', devices: 'smartphone', danger: 'trash' };

RENDERERS.settings = function (target) {
  target.innerHTML = `
    <div class="view-head"><div><div class="view-title">Settings</div><div class="view-subtitle">Preferences for theme, notifications and access.</div></div></div>
    <div class="settings-layout">
      <nav class="settings-nav">${SETTINGS_PANELS.map((p) => `<button data-panel="${p}" class="${p === 'general' ? 'is-active' : ''}">${ICONS[SETTINGS_ICONS[p]]}${SETTINGS_LABELS[p]}</button>`).join('')}</nav>
      <div>
        <div class="settings-panel is-active" data-panel="general">
          <div class="card">
            <div class="card-head"><div class="card-title">${ICONS.settings}Appearance</div></div>
            <div class="pref-row"><div><div class="pref-row-label">Theme</div><div class="pref-row-desc">Dark is recommended for extended trading sessions</div></div>
              <div class="chart-tabs"><button class="chart-tab ${STATE.theme==='dark'?'is-active':''}" data-theme-btn="dark">Dark</button><button class="chart-tab ${STATE.theme==='light'?'is-active':''}" data-theme-btn="light">Light</button></div>
            </div>
            <div class="pref-row"><div><div class="pref-row-label">Language</div><div class="pref-row-desc">Interface language</div></div>
              <select class="select input" style="width:160px;"><option>English (India)</option><option>हिन्दी</option><option>मराठी</option></select>
            </div>
          </div>
        </div>

        <div class="settings-panel" data-panel="notifications">
          <div class="card">
            <div class="card-head"><div class="card-title">${ICONS.bell}Notification Preferences</div></div>
            ${['Payment confirmations', 'Subscription renewals', 'Broker disconnections', 'Bot offline alerts', 'Strategy updates', 'System maintenance'].map((label, i) => `
              <div class="pref-row"><div><div class="pref-row-label">${label}</div><div class="pref-row-desc">Email · SMS</div></div>
                <div class="flex gap-16"><label class="switch"><input type="checkbox" checked><span class="switch-track"></span></label></div>
              </div>`).join('')}
          </div>
        </div>

        <div class="settings-panel" data-panel="privacy">
          <div class="card">
            <div class="card-head"><div class="card-title">${ICONS.shield}Privacy</div></div>
            <div class="pref-row"><div><div class="pref-row-label">Share anonymised performance data</div><div class="pref-row-desc">Helps improve strategy research — never includes account identifiers</div></div><label class="switch"><input type="checkbox"><span class="switch-track"></span></label></div>
            <div class="pref-row"><div><div class="pref-row-label">Marketing communications</div><div class="pref-row-desc">Occasional product updates by email</div></div><label class="switch"><input type="checkbox" checked><span class="switch-track"></span></label></div>
          </div>
        </div>

        <div class="settings-panel" data-panel="api">
          <div class="card">
            <div class="card-head"><div><div class="card-title">${ICONS.key}API Keys</div><div class="card-sub">For advanced integrations. Keep these secret.</div></div><button class="btn btn-secondary btn-sm">${ICONS.plus}New Key</button></div>
            <div class="invoice-row" style="padding-left:0;padding-right:0;"><span class="file-icon">${ICONS.key}</span><div style="flex:1;"><div class="text-sm font-semibold font-mono">va_live_••••••••3f2c</div><div class="text-xs text-tertiary">Created Jun 2, 2026 · Last used 3d ago</div></div><button class="btn btn-ghost btn-sm" style="color:var(--color-error);">Revoke</button></div>
          </div>
        </div>

        <div class="settings-panel" data-panel="devices">
          <div class="card">
            <div class="card-head"><div class="card-title">${ICONS.smartphone}Connected Devices</div></div>
            ${SESSIONS_DB.map((s) => `<div class="session-item"><span class="session-icon">${ICONS[s.icon]}</span><div style="flex:1;"><div class="text-sm font-semibold">${escapeHTML(s.device)}</div><div class="text-xs text-tertiary">${escapeHTML(s.location)} · ${fmtRelative(s.lastActive)}</div></div>${!s.current ? '<button class="btn btn-ghost btn-sm" style="color:var(--color-error);">Remove</button>' : ''}</div>`).join('')}
          </div>
        </div>

        <div class="settings-panel" data-panel="danger">
          <div class="danger-zone">
            <div class="card-title" style="color:var(--color-error);margin-bottom:6px;">${ICONS.trash}Danger Zone</div>
            <p class="text-sm text-secondary" style="line-height:1.7;margin-bottom:16px;">Deleting your account permanently removes access to the dashboard. Your trade and billing history is retained per regulatory requirements even after deletion, in line with our data retention policy.</p>
            <button class="btn btn-danger" id="deleteAccountBtn">${ICONS.trash}Delete Account</button>
          </div>
        </div>
      </div>
    </div>`;

  qsa('.settings-nav button', target).forEach((b) => b.addEventListener('click', () => {
    qsa('.settings-nav button', target).forEach((x) => x.classList.remove('is-active'));
    b.classList.add('is-active');
    qsa('.settings-panel', target).forEach((p) => p.classList.toggle('is-active', p.dataset.panel === b.dataset.panel));
  }));
  qsa('[data-theme-btn]', target).forEach((b) => b.addEventListener('click', () => {
    STATE.theme = b.dataset.themeBtn; applyTheme();
    qsa('[data-theme-btn]', target).forEach((x) => x.classList.toggle('is-active', x.dataset.themeBtn === STATE.theme));
  }));
  qs('#deleteAccountBtn', target).addEventListener('click', () => confirmAction({
    title: 'Delete your account?', desc: 'This cannot be undone from the dashboard. Please contact support to complete account deletion — regulatory records are retained per policy.', confirmLabel: 'Contact Support', danger: true,
    onConfirm: () => navigate('support'),
  }));
};

/* --------------------------------------------------------------------------
   26. BROKER OAUTH CONNECT
   -------------------------------------------------------------------------- */
// Per VABR security rules, the dashboard never collects or stores broker
// credentials directly — the customer authenticates on the broker's own
// domain via standard OAuth2 (authorization_code grant), and only the
// resulting session status is reflected here. api_key/redirect_uri below
// are populated by the backend template at render time in production.
const BROKER_OAUTH_CONFIG = {
  BR001: { name: 'Upstox', authUrl: 'https://api.upstox.com/v2/login/authorization/dialog', clientIdParam: 'client_id', extraParams: { response_type: 'code' } },
  BR002: { name: 'Zerodha', authUrl: 'https://kite.zerodha.com/connect/login', clientIdParam: 'api_key', extraParams: { v: '3' } },
};
function connectBroker(brokerId) {
  const cfg = BROKER_OAUTH_CONFIG[brokerId];
  const broker = BROKERS_CATALOG.find((b) => b.id === brokerId);
  if (!cfg) { toast({ type: 'info', title: `${broker.name} integration coming soon` }); return; }
  toast({ type: 'info', title: `Redirecting to ${cfg.name}…`, desc: 'Complete login on the broker\u2019s own secure page. We never see your password.' });
  // In production this URL is assembled server-side with the account's
  // registered client_id and redirect_uri, then the browser is sent here:
  //   `${cfg.authUrl}?${cfg.clientIdParam}=<CLIENT_ID>&redirect_uri=<REDIRECT_URI>&${new URLSearchParams(cfg.extraParams)}`
  // Demo build has no live backend to exchange the resulting auth code, so
  // we simulate the round trip instead of opening a dead popup.
  setTimeout(() => toast({ type: 'success', title: `${cfg.name} connected`, desc: 'Access token issued. Execution will resume shortly.' }), 1600);
}

/* --------------------------------------------------------------------------
   27. GLOBAL ACTION HANDLER (data-action="…")
   -------------------------------------------------------------------------- */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'renew') {
    confirmAction({
      title: 'Renew Subscription', desc: `Renew ${CUSTOMER.plan} for ${fmtINR(CUSTOMER.nextPaymentAmount)}? Your new expiry will be ${fmtDate(new Date(new Date(CUSTOMER.renewalDate).setFullYear(new Date(CUSTOMER.renewalDate).getFullYear() + 1)))}.`,
      confirmLabel: 'Proceed to Payment',
      onConfirm: () => { toast({ type: 'info', title: 'Redirecting to secure checkout…' }); setTimeout(() => toast({ type: 'success', title: 'Payment successful', desc: 'Your subscription has been renewed.' }), 1600); },
    });
  } else if (action === 'download-bot') {
    toast({ type: 'success', title: 'Preparing download…', desc: 'Gamma Flip Execution Bot v4.2.1' });
    setTimeout(() => toast({ type: 'success', title: 'Download started', desc: 'Check your browser downloads.' }), 1200);
  } else if (action === 'new-ticket') {
    openNewTicketModal();
  }
});

/* --------------------------------------------------------------------------
   28. SESSION / ERROR SCREENS (401 style)
   -------------------------------------------------------------------------- */
function showSessionExpired() {
  document.body.innerHTML = `
    <div class="session-screen">
      <div class="session-panel">
        <svg class="brand-mark" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:40px;height:26px;">
          <path d="M1 15L8 8L13 12L21 4L31 6" stroke="#2E6BE6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="21" cy="4" r="2.5" fill="#FF9933"/>
        </svg>
        <span class="state-illo" style="margin:8px auto 18px;">${ICONS.shield}</span>
        <div class="state-title">Your session has ended</div>
        <div class="state-desc" style="margin:8px auto 22px;">For your security, you've been signed out. Sign back in to return to your dashboard.</div>
        <button class="btn btn-primary btn-lg" onclick="location.reload()">Sign In Again</button>
      </div>
    </div>`;
}

/* --------------------------------------------------------------------------
   28b. AUTH INTEGRATION — full platform integration
   Bridges the shared portal auth layer (auth/session.js, auth/api.js,
   auth/routeGuard.js — frozen, included on dashboard/index.html before this
   file) into the CUSTOMER object every RENDERERS.* function already reads.
   No renderer, no route, no component below this point changes shape:
   CUSTOMER stays the same object identity, we only patch its fields once
   the real profile loads, then re-render whatever view is on screen.
   -------------------------------------------------------------------------- */
async function hydrateCustomerFromSession() {
  if (!window.VA_SESSION || !window.VA_API) return; // auth layer not present — keep demo data

  const sessionUser = VA_SESSION.getUser() || {};
  const token = VA_SESSION.getToken();

  // 1) Immediate, synchronous hydration from whatever routeGuard already
  //    validated (name/email at minimum), so the topbar never shows the
  //    wrong person even before the network call below resolves.
  Object.assign(CUSTOMER, {
    id: sessionUser.customerId || sessionUser.id || CUSTOMER.id,
    name: sessionUser.name || CUSTOMER.name,
    email: sessionUser.email || CUSTOMER.email,
  });
  // M1 fix: BROKER_CONNECTION.customerId was captured once at
  // module-evaluation time (`customerId: CUSTOMER.id` above, before this
  // function ever ran) and never updated again, so the mini broker card
  // on the dashboard home view could show a stale/mock customer ID.
  // Re-sync it every time CUSTOMER.id changes instead.
  BROKER_CONNECTION.customerId = CUSTOMER.id;

  // 2) Authoritative profile fetch — VA_API.me() is the existing, frozen
  //    auth API client's real backend call (AuthApi.gs → action=me),
  //    already used by no one else on this page. { customerId, name,
  //    email, bot } per auth/api.js.
  if (!token) return;
  try {
    const profile = await VA_API.me(token);
    if (!profile) return;
    Object.assign(CUSTOMER, {
      id: profile.customerId || CUSTOMER.id,
      name: profile.name || CUSTOMER.name,
      email: profile.email || CUSTOMER.email,
    });
    BROKER_CONNECTION.customerId = CUSTOMER.id; // M1 fix — see note above
    if (profile.bot) {
      // Real bot status, when the backend includes it — everything else
      // in BOT_STATUS (server, latencyMs, ...) stays on demo data until
      // a dedicated bot-status endpoint exists (see production TODO).
      Object.assign(BOT_STATUS, profile.bot);
    }
  } catch (err) {
    // A failed profile fetch shouldn't block the dashboard — routeGuard
    // already confirmed the session is valid; this is best-effort
    // enrichment, not the auth check itself.
    console.warn('[dashboard] VA_API.me() failed, showing session data only:', err);
  }
}

/* --------------------------------------------------------------------------
   29. BOOTSTRAP
   -------------------------------------------------------------------------- */
// M4 fix: previously an untracked setInterval with no way to clear it.
// Harmless while this page never tears down its own init()'s scope, but
// there was no teardown hook at all — tracking the handle and clearing it
// on pagehide costs nothing and means this survives becoming embedded /
// re-initialized elsewhere (e.g. inside an SPA shell) without leaking.
let heartbeatIntervalId_ = null;

function init() {
  applyTheme();
  applySidebar();
  const startRoute = window.location.hash.slice(1) || 'dashboard';
  navigate(startRoute);

  // simulate loadNotifications() / loadBroker() background polling
  if (heartbeatIntervalId_) clearInterval(heartbeatIntervalId_);
  heartbeatIntervalId_ = setInterval(() => {
    BOT_STATUS.lastHeartbeat = new Date().toISOString();
    const dot = qs('#sidebarSystemDot');
    if (dot) { dot.classList.remove('success'); void dot.offsetWidth; dot.classList.add('success'); }
  }, 15000);
}

window.addEventListener('pagehide', () => {
  if (heartbeatIntervalId_) {
    clearInterval(heartbeatIntervalId_);
    heartbeatIntervalId_ = null;
  }
});

async function boot() {
  if (window.VA_ROUTE_GUARD) {
    // routeGuard (auth/routeGuard.js, loaded before this file) keeps the
    // page hidden and redirects unauthenticated visitors to login on its
    // own. We just wait for it to say "this is a real, validated session"
    // before hydrating real customer data and rendering the SPA.
    await new Promise((resolve) => VA_ROUTE_GUARD.onReady(resolve));
    await hydrateCustomerFromSession();
  } else {
    console.warn('[dashboard] VA_ROUTE_GUARD not found — running unauthenticated with demo data. Include auth/*.js on dashboard/index.html.');
  }
  init();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
