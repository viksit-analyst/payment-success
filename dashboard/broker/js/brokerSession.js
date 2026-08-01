// brokerSession.js
// In-memory (tab-lifetime) state for the currently connected broker.
// Holds ONLY what the UI needs to render: status enums, display fields,
// and timestamps. Never holds an access token, refresh token, API secret,
// or client secret — those never leave the backend (see TokenStore.gs).
//
// State shape mirrors the VADS "Broker Status" enum exactly, so the UI
// never invents its own status strings:
//   NOT_CONNECTED | CONNECTED | TOKEN_PENDING | TOKEN_VALID |
//   TOKEN_EXPIRED | LOGIN_REQUIRED | DISABLED

import { createEventBus } from './utils.js';

const bus = createEventBus();

const state = {
  brokerId: null,
  brokerName: null,
  brokerStatus: 'NOT_CONNECTED',
  connectedAt: null,
  lastSync: null,
  profile: null,        // { userId, clientId, registeredName, exchanges: [] }
  permissions: null,    // { equity, fno, currency, commodity, apiEnabled, tradingEnabled, mode }
  tokenExpiry: null,    // ISO string — display/countdown only
  autoLoginEnabled: false, // whether the Selenium-based automated daily reconnection is opted into
  health: null,         // { latencyMs, apiResponseMs, brokerStatus, serverStatus, internetStatus, vmStatus }
  bot: null,            // { status, heartbeatAt, server, latencyMs, activeStrategy }
};

export function getState() {
  return { ...state };
}

export function setState(patch) {
  Object.assign(state, patch);
  bus.emit('change', getState());
}

export function onChange(fn) {
  return bus.on('change', fn);
}

export function isConnected() {
  return state.brokerStatus !== 'NOT_CONNECTED' && state.brokerStatus !== 'DISABLED';
}

export function canTrade() {
  // Mirrors VABR Broker Rules: customer cannot trade unless Broker Status == TOKEN_VALID.
  return state.brokerStatus === 'TOKEN_VALID';
}

export function reset() {
  setState({
    brokerId: null,
    brokerName: null,
    brokerStatus: 'NOT_CONNECTED',
    connectedAt: null,
    lastSync: null,
    profile: null,
    permissions: null,
    tokenExpiry: null,
    autoLoginEnabled: false,
    health: null,
    bot: null,
  });
}
