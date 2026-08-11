const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const indexHtmlRaw = fs.readFileSync(path.join(__dirname, 'dashboard/index.html'), 'utf8');
const indexHtml = indexHtmlRaw
  .replace(/<script src="\.\.\/auth\/[^"]+"><\/script>\s*/g, '')
  .replace(/<link[^>]+fonts\.googleapis[^>]*>\s*/g, '')
  .replace(/<script src="assets\/js\/fonts\.js"[^>]*><\/script>\s*/g, '')
  .replace(/<link rel="stylesheet" href="\.\.\/assets\/css\/dashboard\.css">\s*/g, '')
  .replace(/<script src="dashboardApi\.js"><\/script>\s*/g, '')
  .replace(/<script src="dashboard\.js"><\/script>\s*/g, '');

async function main() {
  const dom = new JSDOM(indexHtml, {
    url: 'https://app.viksitanalyst.com/dashboard/index.html',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', (e) => errors.push(e.error || e.message));
  window.console = console;

  // ---- Stub the auth layer (unchanged by this pass — not under test) ----
  window.VA_AUTH_CONFIG = { API_BASE_URL: 'https://script.google.com/macros/s/FAKE/exec' };
  window.VA_SESSION = {
    getToken: () => 'fake-token',
    getUser: () => ({ customerId: 'CUS000TEST', name: 'Test Customer', email: 'test@example.com' }),
  };
  window.VA_API = { me: async () => ({ customerId: 'CUS000TEST', name: 'Test Customer', email: 'test@example.com', role: 'customer' }) };
  window.VA_ROUTE_GUARD = { onReady: (cb) => cb() };

  // ---- Stub fetch for VA_DASHBOARD_API's two GET-based backends ----
  const fs2 = fs;
  const dashboardApiSrc = fs2.readFileSync(path.join(__dirname, 'dashboard/dashboardApi.js'), 'utf8');
  const dashboardSrc = fs2.readFileSync(path.join(__dirname, 'dashboard/dashboard.js'), 'utf8');
  window.fetch = async (url) => {
    const u = new URL(url);
    const action = u.searchParams.get('action');
    const body = (() => {
      switch (action) {
        case 'customer':
          return { success: true, customer: { id: 'CUS000TEST', name: 'Test Customer', email: 'test@example.com', phone: '+91 90000 00000', status: 'ACTIVE', createdAt: '2026-01-15T00:00:00.000Z', lastPayment: '2026-07-15T00:00:00.000Z' } };
        case 'status':
          return { success: true, customer: { id: 'CUS000TEST', name: 'Test Customer', status: 'ACTIVE' }, subscriptions: [{ bot: 'gammaflip', status: 'ACTIVE', endDate: '2026-09-10T00:00:00.000Z', daysRemaining: 30 }] };
        case 'payments':
          return { success: true, payments: [{ paymentId: 'pay_TEST123', bot: 'gammaflip', amount: 99900, currency: 'INR', status: 'PAID', timestamp: '2026-07-15T00:00:00.000Z' }] };
        case 'subscription':
          return { success: true, subscription: { bot: 'Gamma Flip', status: 'ACTIVE', startDate: '2026-07-15', endDate: '2026-09-10', renewalDate: '2026-09-10', daysRemaining: 30 } };
        case 'renewal':
          return { success: true, renewal: { bot: 'Gamma Flip', status: 'ACTIVE', endDate: '2026-09-10', renewalDate: '2026-09-10', daysRemaining: 30, renewalDue: false } };
        case 'botStatus':
          return { success: true, data: { status: 'RUNNING', activeStrategy: 'gammaflip', heartbeatAt: new Date().toISOString(), server: { name: 'viksit-vm-01', region: 'ap-south-1' }, latencyMs: 118 } };
        default:
          return { success: false, error: 'unknown action in smoketest stub: ' + action };
      }
    })();
    return { ok: true, status: 200, json: async () => body };
  };

  // ---- Load the two files under test as real <script> tags (matches
  //      actual browser semantics for top-level function declarations
  //      attaching to window — window.eval()'s indirect-eval semantics
  //      don't reliably do this in jsdom). ----
  for (const file of ['dashboard/dashboardApi.js', 'dashboard/dashboard.js']) {
    const scriptEl = window.document.createElement('script');
    scriptEl.textContent = fs2.readFileSync(path.join(__dirname, file), 'utf8');
    window.document.body.appendChild(scriptEl);
  }
  await new Promise((r) => setTimeout(r, 100)); // let boot()'s async chain settle

  // ---- Visit every route the sidebar exposes ----
  const routes = ['dashboard', 'strategies', 'performance', 'trades', 'broker', 'reports', 'downloads', 'billing', 'support', 'profile', 'settings'];
  for (const route of routes) {
    window.navigate(route);
    await new Promise((r) => setTimeout(r, 50));
  }

  // ---- Exercise the interactive bits most likely to break ----
  window.qs('#cancelPlanBtn')?.click();
  await new Promise((r) => setTimeout(r, 20));

  if (errors.length) {
    console.error(`\n${errors.length} runtime error(s) captured:`);
    errors.forEach((e, i) => console.error(`\n[${i + 1}]`, e && e.stack ? e.stack : e));
    process.exit(1);
  }
  console.log('SMOKETEST PASSED — no uncaught runtime errors across all routes.');
}

main().catch((err) => {
  console.error('SMOKETEST CRASHED:', err);
  process.exit(1);
});
