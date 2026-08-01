# Viksit Analyst — Authentication Module

A production-grade, dependency-free authentication system for the Viksit
Analyst customer platform: **email OTP sign-in + trusted-device sessions**,
built entirely in HTML/CSS/vanilla JavaScript, backed by Google Apps
Script + Google Sheets.

No React, no Vue, no Bootstrap/Tailwind, no Firebase/Auth0/Supabase/Clerk.
No passwords.

---

## 1. Architecture decisions

### 1.1 OTP-only, no passwords — and why the requested `login()` /
    `forgotPassword()` / `resetPassword()` functions don't exist here

The original spec for this module asked for a password-based login with a
forgot-password flow (`login.html`, `login()`, `forgotPassword.html`,
`forgotPassword()`, `resetPassword()`). That was superseded by an explicit
architecture decision to go **OTP-only**, made before any code was written:

- **Smaller attack surface.** There is no password database to hash, salt,
  rate-limit, or leak. There is nothing to phish that grants standing
  access — an intercepted OTP is single-use and expires in 5 minutes.
- **No password-reset flow to secure.** Forgot-password flows are
  historically one of the most exploited surfaces in web auth (predictable
  reset tokens, insufficient rate limiting, email enumeration). Removing
  the flow removes the risk category entirely.
- **Simpler UX for a subscription platform.** Customers already exist as
  paying subscribers (created via the Razorpay webhook, see the main site's
  backend). They don't need to "create an account" — they need to prove
  they own the email address on file. OTP does exactly that in one step.
- **Fits the existing stack.** Google Apps Script + Sheets already sends
  transactional email (subscription confirmations, reports). OTP delivery
  reuses that path; a password system would need a separate, carefully
  secured credential store.

Consequently:

| Requested | Status | Where it went |
|---|---|---|
| `sendOTP()` | ✅ Implemented | `api.js` |
| `verifyOTP()` | ✅ Implemented | `api.js` |
| `logout()` | ✅ Implemented | `api.js` |
| `validateSession()` | ✅ Implemented | `api.js` |
| `refreshSession()` | ✅ Implemented | `api.js` |
| `loadProfile()` | ✅ Implemented | `api.js` |
| `login()` | ❌ Not implemented | OTP verification *is* login — see `submitOtp()` in `auth.js` |
| `forgotPassword()` | ❌ Not implemented | No password exists to forget |
| `resetPassword()` | ❌ Not implemented | No password exists to reset |
| `forgot-password.html` | ❌ Not built | Superseded by the OTP flow |

**If the business later needs password login** (e.g. an enterprise SSO
requirement), add it as an *additional* method alongside OTP, not a
replacement — don't remove OTP to make room for it. `api.js` and `auth.js`
are structured so a `password.js` sibling module could be added without
touching the OTP flow.

### 1.2 Why a Bearer token instead of a cookie

Google Apps Script Web Apps run on `script.google.com`, a different origin
from `www.viksitanalyst.com`. A cross-origin backend cannot set an
`httpOnly` cookie scoped to the frontend's origin, so the classic
"session cookie the browser handles for you, invisible to JS" pattern
isn't available here. Instead:

- `verifyOTP()` returns an opaque `sessionToken` string.
- The frontend stores it (see §3) and sends it as
  `Authorization: Bearer <token>` on every authenticated request.
- This means the token **is** readable by any JavaScript running on the
  page — i.e. it's vulnerable to theft via XSS, same as any
  `localStorage`/`sessionStorage`-based auth. We treat this as an accepted,
  documented tradeoff and mitigate it with:
  - Zero third-party frontend dependencies (nothing to supply-chain-attack).
  - Strict `textContent`-only rendering of any user- or server-provided
    string — see `components/toast.js` and `verify.js`.
  - Short default token lifetime (24h; 30d only if the user opts into
    "remember this device"), plus silent rotation on refresh.
  - A CSP `<meta>` tag on every page as defense-in-depth (see §6).
- If you later move the backend behind a same-origin proxy (e.g. Cloudflare
  Worker on `api.viksitanalyst.com`), you can switch to an `httpOnly`
  cookie and delete the Bearer-token plumbing in `api.js` — the rest of
  this module doesn't need to change.

---

## 2. Folder structure

```
auth/
├── login.html              Email entry screen
├── login.css                Page-specific styles
├── login.js                  DOM bindings for login.html
├── verify.html                OTP entry screen
├── verify.css                 Page-specific styles
├── verify.js                   DOM bindings for verify.html
├── config.js                    Central config: endpoints, timings, routes
├── api.js                        The ONLY file that calls fetch()
├── session.js                     Session storage, idle timer, cross-tab sync
├── auth.js                         Flow controller (login/verify/logout)
├── routeGuard.js                    Include on every protected page
├── components/
│   ├── auth-theme.css                Shared design tokens + base components
│   ├── toast.css / toast.js           Notification toasts
│   ├── idle-warning.css / idle-warning.js   "Are you still there?" modal
│   └── otp-input.js                    Reusable 6-box OTP input widget
└── README.md                             You are here
```

**Load order matters.** Every page loads scripts in this sequence:

```
config.js → api.js → session.js → auth.js → components/*.js → (routeGuard.js | login.js | verify.js)
```

Each file checks its dependencies exist at the top and throws a clear
error if loaded out of order, rather than failing silently later.

---

## 3. Authentication flow

```
 ┌─────────────┐    email     ┌──────────────┐   otp    ┌──────────────┐
 │ login.html  │ ───────────► │ POST sendOTP │ ───────► │  verify.html │
 │ (email +    │              └──────────────┘          │ (6-digit OTP)│
 │  consent)   │                                          └──────┬───────┘
 └─────────────┘                                                 │
                                                          POST verifyOTP
                                                                 │
                                                                 ▼
                                                    ┌────────────────────────┐
                                                    │ session created         │
                                                    │ (localStorage if        │
                                                    │  "remember device",     │
                                                    │  else sessionStorage)   │
                                                    └───────────┬────────────┘
                                                                 │
                                                                 ▼
                                                        dashboard.html
                                                    (protected by routeGuard.js)
```

1. **login.html** — visitor enters their email, optionally checks
   "remember this device," and must accept the Terms/Privacy checkbox.
   `auth.js#startLogin()` validates the email client-side, calls
   `api.js#sendOTP()`, and stores a short-lived **pending auth** record
   (`sessionStorage`, 10-minute TTL) — *not* a real session — before
   redirecting to `verify.html`.
2. **verify.html** — reads the pending record. If it's missing or expired,
   the visitor is bounced back to `login.html`. Renders a 6-box OTP input
   (`components/otp-input.js`) with auto-focus, auto-advance, backspace
   navigation, and full paste support. Auto-submits the moment all 6 boxes
   are filled.
3. On submit, `auth.js#submitOtp()` calls `api.js#verifyOTP()`. On success
   it immediately calls `session.js#createSession()`, which persists the
   token, computes the correct expiry (24h or 30d depending on "remember
   device"), and clears the pending record.
4. The user sees a success checkmark animation, then is redirected to
   either `config.js`'s `ROUTES.DEFAULT_AFTER_LOGIN` (`/dashboard.html`)
   or a `?redirect=` query param — validated to be a same-origin relative
   path only, so this can never become an open redirect.

### Error states handled end-to-end

| State | Where | Behavior |
|---|---|---|
| Invalid email format | login.html | Inline field error, no request sent |
| Email not found | login.html | Inline field error (see §6 for the enumeration tradeoff) |
| Network error / timeout | both | Toast + retry; form stays filled in |
| Server error | both | Toast with calm, non-technical copy |
| Wrong OTP | verify.html | Shake animation, boxes clear, attempts-remaining counter decrements |
| OTP expired | verify.html | Inputs disable, "resend" prompted |
| Too many wrong attempts | verify.html | Locked state, must restart from login.html |
| Too many resend requests | verify.html | Locked state, must restart from login.html |
| Pending login expired (e.g. tab left open >10 min) | verify.html | Redirects to login.html with a toast |
| Session expired mid-visit | any protected page | `routeGuard.js` clears local state and redirects to login with `?redirect=` back to where they were |

---

## 4. Session lifecycle

Handled entirely by `session.js` + `routeGuard.js`.

- **Storage.** "Remember this device" → `localStorage` (survives closing
  the browser; expires in 30 days). Otherwise → `sessionStorage` (cleared
  when the tab closes; expires in 24h anyway as a backstop). The opposite
  storage is always cleared on write, so a session never exists in both
  places at once.
- **Fast local check, authoritative server check.** `routeGuard.js` first
  checks the local expiry timestamp to redirect obviously-logged-out
  visitors instantly, but a page is only ever *revealed* after
  `validateSession()` confirms the token server-side. The client-side
  timestamp is a UX optimization, never the source of truth.
- **Silent refresh.** While a protected page is open, `refreshSession()` is
  called every `SILENT_REFRESH_INTERVAL_MS` (10 min default) to extend the
  session without interrupting the user.
- **Idle timeout.** After 14 minutes with no mouse/keyboard/touch/scroll
  activity, an "Are you still there?" modal appears with a 60-second
  countdown (ring + digit, `components/idle-warning.js`). Clicking
  **Stay Signed In** calls `refreshSession()` and resets the idle clock.
  Letting the countdown hit zero — or clicking **Log Out Now** — calls
  `auth.js#logout()`.
- **Cross-tab sync.** Logging out in one tab (via the idle timeout,
  clicking logout, or a `validateSession()` failure) broadcasts to every
  other open tab via `BroadcastChannel` (with a `localStorage` write/`storage`-event
  fallback for older browsers), and each tab redirects to login
  immediately — no stale "still logged in" tab left behind.
- **Logout.** Always clears local state first, then best-effort notifies
  the backend. A user can never get stuck "logged in" locally because a
  network call failed.

---

## 5. Protecting a new page

Add these five script tags, in this order, before `</body>`:

```html
<script src="/auth/config.js"></script>
<script src="/auth/api.js"></script>
<script src="/auth/session.js"></script>
<script src="/auth/auth.js"></script>
<script src="/auth/components/toast.js"></script>
<script src="/auth/components/idle-warning.js"></script>
<script src="/auth/routeGuard.js"></script>
```

Also include the two stylesheets `routeGuard.js`'s dependencies use:

```html
<link rel="stylesheet" href="/auth/components/toast.css">
<link rel="stylesheet" href="/auth/components/idle-warning.css">
```

That's it — `routeGuard.js` self-initializes. To render the signed-in
user's name once the guard has confirmed the session:

```html
<script>
  VA_ROUTE_GUARD.onReady((user) => {
    document.getElementById('userName').textContent = user?.name ?? '';
  });
</script>
```

Then add the page's filename to `PROTECTED_PAGES` in `config.js` (this list
is currently informational/self-documenting rather than enforced by
`routeGuard.js` itself, since the guard protects whatever page it's
included on — keeping the list in sync is a reviewer aid, not a security
boundary).

---

## 6. Security

- **Input validation.** Client-side email/OTP-format validation exists
  purely for instant feedback. **The backend must independently re-validate
  everything** — email format, OTP correctness, rate limits, session
  validity. Never trust the client.
- **XSS.** Every dynamic string rendered to the DOM anywhere in this module
  uses `textContent`, never `innerHTML` with unsanitized input. The two
  places this matters most are the masked email on `verify.html` and toast
  messages — both are written defensively (see the comments in
  `components/toast.js` and `verify.js`).
- **CSRF.** Because auth uses a Bearer token in the `Authorization` header
  (not a cookie the browser attaches automatically), classic CSRF — which
  relies on the browser silently attaching credentials to a forged
  cross-site request — does not apply here. If you later move to
  cookie-based sessions, add a CSRF token at that point.
- **Content-Security-Policy.** Add a CSP meta tag (or, better, an HTTP
  header at your hosting layer if it supports one) to every auth and
  protected page:
  ```html
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://script.google.com; img-src 'self' data:;">
  ```
  GitHub Pages cannot set custom HTTP headers, so the `<meta>` tag is the
  available baseline; a host that supports custom headers (Cloudflare
  Pages, Netlify, etc.) can enforce a stricter policy at the edge.
- **Rate limiting.** This module includes client-side guardrails (resend
  cooldown, max resend attempts, max verify attempts) purely for UX — a
  malicious client can trivially ignore all of them. **The backend must
  independently enforce rate limits** on `sendOTP` (per email and per IP)
  and `verifyOTP` (per pending OTP) or this system is not actually secure.
- **User enumeration.** `api.js` supports an `EMAIL_NOT_FOUND` error code
  and `login.js` will render it as a field-level error if the backend
  returns it. Returning this specific error lets an attacker enumerate
  which emails are registered customers. **For a fintech product we
  recommend the backend NOT distinguish this case** — have `sendOTP`
  always respond with the same generic success message regardless of
  whether the email exists, and only reveal "no account" (if at all)
  later, post-OTP, via a softer message. This is a backend decision; the
  frontend supports either behavior.
- **No secrets in frontend code.** `config.js` contains only the public
  Apps Script Web App URL — nothing here is a secret. Razorpay keys, OTP
  signing secrets, etc. live exclusively in Apps Script's Script
  Properties, never in this repo.
- **Token storage tradeoff.** See §1.2 — Bearer token in
  `localStorage`/`sessionStorage` is XSS-exposed by nature. This is a
  documented, accepted tradeoff for a static-frontend + cross-origin Apps
  Script backend, not an oversight.

---

## 7. Connecting the Google Apps Script backend

This module expects a **single Web App URL** (Apps Script exposes one
entry point, not a REST router) that dispatches on a `?action=` query
parameter. All requests/responses are JSON.

### 7.1 Response envelope every action must return

```js
// Success
{ "success": true, /* ...action-specific fields... */ }

// Failure
{ "success": false, "code": "OTP_INVALID", "message": "That code isn't right." }
```

`api.js` throws an `ApiError` with `.code` and `.message` for every
non-success response — see the `ErrorCodes` table in `api.js` for the
full list the frontend already knows how to handle.

### 7.2 Actions to implement

| Action | Method | Request body | Success payload |
|---|---|---|---|
| `sendOTP` | POST | `{ email, rememberDevice }` | `{}` (optionally `otpExpiresInSeconds`, `resendAvailableInSeconds`) |
| `verifyOTP` | POST | `{ email, otp, rememberDevice }` | `{ sessionToken, expiresAt, user: { id, name, email, plan } }` |
| `logout` | POST (auth) | `{}` | `{}` |
| `validateSession` | GET (auth) | — | `{ valid: true, expiresAt, user }` |
| `refreshSession` | POST (auth) | `{}` | `{ sessionToken, expiresAt }` |
| `loadProfile` | GET (auth) | — | `{ user }` |

"(auth)" means the request arrives with an `Authorization: Bearer <token>`
header your `doGet`/`doPost` handler must read from
`e.parameter` is **not** where headers land in Apps Script — you'll need to
read it via `e.headers` if using a modern deployment, or have the frontend
pass the token as a query/body parameter instead if your Apps Script
version doesn't expose inbound headers. Adjust `api.js`'s `request()`
function's `auth` branch to match whichever approach your deployment
supports; that's the only place this decision lives.

### 7.3 Skeleton dispatcher (`Code.gs`)

```javascript
function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  const action = e.parameter.action;

  try {
    switch (action) {
      case 'sendOTP':
        return respond(handleSendOTP(body));
      case 'verifyOTP':
        return respond(handleVerifyOTP(body));
      case 'logout':
        return respond(handleLogout(getBearerToken(e)));
      case 'refreshSession':
        return respond(handleRefreshSession(getBearerToken(e)));
      default:
        return respond({ success: false, code: 'NOT_FOUND', message: 'Unknown action.' });
    }
  } catch (err) {
    return respond({ success: false, code: 'SERVER_ERROR', message: err.message });
  }
}

function doGet(e) {
  const action = e.parameter.action;
  try {
    switch (action) {
      case 'validateSession':
        return respond(handleValidateSession(getBearerToken(e)));
      case 'loadProfile':
        return respond(handleLoadProfile(getBearerToken(e)));
      default:
        return respond({ success: false, code: 'NOT_FOUND', message: 'Unknown action.' });
    }
  } catch (err) {
    return respond({ success: false, code: 'SERVER_ERROR', message: err.message });
  }
}

function respond(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
```

`handleSendOTP`, `handleVerifyOTP`, etc. are intentionally not included —
they depend on your `Customers`/`Sessions`/`OtpCodes` sheet schema, which
this frontend module has no opinion about. What the frontend *does*
require of them:

- `handleSendOTP` generates a random 6-digit code, stores it with an
  expiry (matching `CONFIG.OTP_EXPIRY_SECONDS` in `config.js`, currently 5
  minutes) keyed by email, and emails it via `MailApp`/`GmailApp`. It
  should enforce its own resend rate limit — don't rely on the frontend's.
- `handleVerifyOTP` checks the code, enforces its own max-attempts lockout,
  and on success issues a cryptographically random `sessionToken` (e.g.
  `Utilities.getUuid()` chained with a signed component, or a proper JWT if
  you add a signing library), stores it in a `Sessions` sheet with an
  expiry matching `rememberDevice` (24h vs 30d, matching
  `CONFIG.SESSION_DURATION_*_MS`), and returns it.
- `handleValidateSession` / `handleRefreshSession` look up the token,
  check expiry, and either confirm or reject / rotate it.

### 7.4 Configuring the frontend

Edit exactly one value in `config.js`:

```javascript
API_BASE_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
```

Everything else (timings, storage keys, routes) can also be tuned in
`config.js`, but the base URL is the only thing you *must* change before
this module will function.

---

## 8. Local development

No build step. Serve the site root with any static file server and
navigate to `/auth/login.html`:

```bash
python3 -m http.server 8000
# http://localhost:8000/auth/login.html
```

Until `API_BASE_URL` is configured, `api.js` throws a clear
`CONFIG_ERROR` ("Authentication backend is not configured yet…") instead
of a confusing network failure — you'll see this immediately if you try
the form before wiring up the backend.

---

## 9. Deployment checklist

- [ ] Deploy the Apps Script project as a Web App (`Deploy → New deployment
      → Web app`, execute as **Me**, access **Anyone**) and copy the `/exec`
      URL into `config.js`.
- [ ] Confirm `handleSendOTP` enforces its own rate limits — do not rely on
      the frontend's `MAX_RESEND_ATTEMPTS` alone.
- [ ] Confirm `handleVerifyOTP` enforces its own attempt lockout — do not
      rely on the frontend's `MAX_VERIFY_ATTEMPTS` alone.
- [ ] Decide on the email-enumeration tradeoff in §6 and implement
      `sendOTP` accordingly.
- [ ] Add the CSP `<meta>` tag from §6 to every auth and protected page.
- [ ] Add the five script tags from §5 to `dashboard.html`, `billing.html`,
      `reports.html`, `downloads.html`, `profile.html`, `settings.html`,
      and `mission-control.html`.
- [ ] Verify `ROUTES.LOGIN` / `ROUTES.VERIFY` / `ROUTES.DEFAULT_AFTER_LOGIN`
      in `config.js` match your actual folder layout if it differs from
      `/auth/login.html` + `/dashboard.html` at the site root.
- [ ] Test the full flow end-to-end: send OTP → wrong code → resend →
      correct code → dashboard → idle timeout → cross-tab logout.

---

© Viksit Analyst. All rights reserved.
