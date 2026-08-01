// brokerValidator.js
// Client-side gating and human-readable error mapping. This is a UX layer
// only — every rule here is re-enforced server-side (BrokerRouter.gs +
// StrategyActivation.gs) because the browser is never a trust boundary.

// Mirrors VADS Error Standard so the UI and backend never disagree about
// what a code means.
const ERROR_MESSAGES = {
  ERR001: 'Your subscription is not active, so trading can\u2019t be enabled yet.',
  ERR002: 'Upstox looks offline right now. We\u2019ll keep retrying automatically.',
  ERR003: 'Your broker session has expired. Reconnect to continue trading.',
  ERR004: 'The broker rejected that order.',
  ERR005: 'Insufficient margin for this strategy\u2019s minimum capital requirement.',
  ERR_NETWORK: 'Couldn\u2019t reach Viksit Analyst. Check your connection and try again.',
};

export function describeError(code) {
  return ERROR_MESSAGES[code] || 'Something went wrong. We\u2019ll retry automatically.';
}

/**
 * Can the customer activate a strategy right now?
 * Returns { allowed, reason } — reason is a plain-language string ready to
 * render, never a raw code.
 */
export function validateActivation({ brokerStatus, permissions, subscriptionStatus }) {
  if (subscriptionStatus && subscriptionStatus !== 'ACTIVE' && subscriptionStatus !== 'GRACE_PERIOD') {
    return { allowed: false, reason: 'Your subscription must be active to activate a strategy.' };
  }
  if (brokerStatus !== 'TOKEN_VALID') {
    return { allowed: false, reason: 'Connect and verify your broker before activating a strategy.' };
  }
  if (permissions && permissions.tradingEnabled === false) {
    return { allowed: false, reason: 'Trading permission is not enabled on this broker account yet.' };
  }
  if (permissions && permissions.apiEnabled === false) {
    return { allowed: false, reason: 'API access is not enabled on this broker account. Enable it in your Upstox developer console, then reconnect.' };
  }
  return { allowed: true, reason: null };
}

/** Checks the permission set required by a given strategy before activation. */
export function validateStrategyRequirements(strategyId, permissions) {
  const requirements = {
    STR001: ['equity'],       // IVRV
    STR002: ['fno'],          // Gamma Flip
    STR003: ['equity', 'fno'], // VWAP
  };
  const required = requirements[strategyId] || [];
  const missing = required.filter((key) => !permissions?.[key]);
  if (missing.length) {
    return { allowed: false, reason: `This strategy needs ${missing.join(' + ').toUpperCase()} permission on your broker account.` };
  }
  return { allowed: true, reason: null };
}

/** Maps a Broker Status enum value to the badge variant class used across cards. */
export function statusToBadgeVariant(brokerStatus) {
  switch (brokerStatus) {
    case 'TOKEN_VALID':
    case 'CONNECTED':
      return 'connected';
    case 'TOKEN_EXPIRED':
    case 'DISABLED':
      return 'expired';
    case 'LOGIN_REQUIRED':
      return 'error';
    case 'TOKEN_PENDING':
      return 'reconnecting';
    default:
      return 'disconnected';
  }
}

export function statusToLabel(brokerStatus) {
  switch (brokerStatus) {
    case 'TOKEN_VALID': return 'Connected';
    case 'CONNECTED': return 'Connected';
    case 'TOKEN_PENDING': return 'Reconnecting';
    case 'TOKEN_EXPIRED': return 'Expired';
    case 'LOGIN_REQUIRED': return 'Login required';
    case 'DISABLED': return 'Disabled';
    default: return 'Disconnected';
  }
}
