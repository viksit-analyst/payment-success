// broker.js — the page's entry point. Its only job is orchestration:
// handle an OAuth callback if we just landed on one, mount every card,
// subscribe them all to brokerSession, then start the polling + token
// watch loops. No business logic lives in this file.

import { handleCallbackIfPresent, beginConnect } from './oauth.js';
import { startPolling } from './connectionStatus.js';
import { startTokenWatch } from './tokenManager.js';
import { getState, onChange, isConnected } from './brokerSession.js';
import { waitForAuthenticatedConfig } from './sessionBridge.js';

import { mountBrokerCard } from '../components/brokerCard.js';
import { mountStatusCard } from '../components/statusCard.js';
import { mountAccountCard } from '../components/accountCard.js';
import { mountPermissionCard } from '../components/permissionCard.js';
import { mountTokenCard } from '../components/tokenCard.js';
import { mountHealthCard } from '../components/healthCard.js';
import { mountHeartbeatCard } from '../components/heartbeatCard.js';
import { mountServerCard } from '../components/serverCard.js';
import { mountBotCard } from '../components/botCard.js';
import { mountStrategyCard } from '../components/strategyCard.js';

function initTheme() {
  const toggle = document.getElementById('themeToggle');
  const stored = localStorageSafe('va_theme');
  if (stored) document.documentElement.setAttribute('data-theme', stored);
  toggle?.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorageSafe('va_theme', next);
  });
}

// Wrapped so a locked-down browser (privacy mode, embedded webview) can
// never throw and break page init just because of a storage read/write.
function localStorageSafe(key, value) {
  try {
    if (value === undefined) return window.localStorage.getItem(key);
    window.localStorage.setItem(key, value);
  } catch { /* no-op */ }
  return null;
}

function toggleSections() {
  const connectSection = document.getElementById('connectSection');
  const brokerGrid = document.getElementById('brokerGrid');
  const connected = isConnected();
  connectSection.hidden = connected;
  brokerGrid.hidden = !connected;
}

function setPlatformBadge() {
  const el = document.getElementById('platformBadge');
  el.className = 'badge badge-connected';
  el.innerHTML = '<span class="status-dot"></span>Operational';
}

async function main() {
  initTheme();

  // Gate on the real, logged-in customer before touching brokerAPI.js —
  // routeGuard (loaded on broker.html) has already kept the page hidden
  // and redirected anonymous visitors to login by this point, so a
  // rejection here means the auth layer isn't wired into the page.
  try {
    await waitForAuthenticatedConfig();
  } catch (err) {
    console.error(err);
    document.body.innerHTML = '<div class="ob-empty" style="margin:80px auto;text-align:center;">Unable to verify your session. Please <a href="/auth/login.html">sign in again</a>.</div>';
    document.documentElement.classList.remove('va-preauth-hidden'); // C3 fix — reveal the error message itself
    return;
  }

  document.documentElement.classList.remove('va-preauth-hidden'); // C3 fix — auth confirmed, safe to show the real app now

  setPlatformBadge();

  document.getElementById('connectUpstoxBtn')?.addEventListener('click', () => beginConnect('BR001'));

  await handleCallbackIfPresent();

  const updaters = [
    mountBrokerCard(document.getElementById('brokerCard')),
    mountStatusCard(document.getElementById('statusCard')),
    mountAccountCard(document.getElementById('accountCard')),
    mountPermissionCard(document.getElementById('permissionCard')),
    mountTokenCard(document.getElementById('tokenCard')),
    mountHealthCard(document.getElementById('healthCard')),
    mountHeartbeatCard(document.getElementById('heartbeatCard')),
    mountServerCard(document.getElementById('serverCard')),
    mountBotCard(document.getElementById('botCard')),
  ];
  const paintStrategyCard = mountStrategyCard(document.getElementById('strategyCard'), getState);

  onChange((state) => {
    toggleSections();
    updaters.forEach((update) => update(state));
    paintStrategyCard();
  });

  toggleSections();
  startPolling();
  startTokenWatch();
}

main();
