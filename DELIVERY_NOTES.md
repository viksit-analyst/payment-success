Delivery notes — this pass
Read this before deploying anything. It's organized by: what's done and tested,
what's a real backend fix (not frontend polish), and what's still open.
---
0. Before you deploy anything: the SEBI placeholder
`trust.html`, `index.html` (FAQ + JSON-LD), and `terms.html` now say
"SEBI-registered Research Analyst" instead of "not currently registered,"
per your instruction — you're not deploying until approval is confirmed, so
it's safe to write it that way now.
But every one of those files has `[[SEBI_RA_REGISTRATION_NUMBER]]` and
`[[SEBI_RA_REGISTRATION_DATE]]` as literal placeholder text. I don't know
your actual registration number, and I'm not willing to invent one —
falsely claiming SEBI registration on a public site is a securities-law
problem, not a copy bug. `trust.html` has an HTML comment right above the
section in all caps warning not to deploy with the placeholder still in.
Before you go live: find-and-replace `[[SEBI_RA_REGISTRATION_NUMBER]]`
and `[[SEBI_RA_REGISTRATION_DATE]]` across `trust.html`, `index.html`, and
`terms.html` (and the mirrored copies in `viksit-analyst-app/www/`) with
the real values. I'd also get `terms.html`'s updated disclaimer paragraph
looked at by whoever handles your compliance — the actual disclosure
obligations under the SEBI (Research Analysts) Regulations, 2014
(conflicts of interest, recommendation basis, record-keeping) are more
specific than what I wrote, which is deliberately conservative boilerplate.
---
1. Dashboard — wired to real data, fabricated data removed
`dashboard/dashboardApi.js` is new — a real, tested client for
`DashboardApi.gs`'s session-authenticated endpoints (customer, subscription,
payments, renewal, status) plus one `BrokerRouter.gs` action (`botStatus`,
see §2). Loaded in `dashboard/index.html` right before `dashboard.js`.
Removed entirely (was hardcoded fake data, shown identically to every
customer):
146 fabricated trades with fake instruments/entry/exit/P&L
Fake Sharpe/Sortino/CAGR/max-drawdown/win-rate
Fake equity curve, monthly returns, daily P&L
Fake GST invoices (including a made-up GSTIN — a fake number on
something that reads as a tax document)
Fake stored payment method ("HDFC Bank •••• 4821")
Fake broker connection data (portfolio value, access token status)
A fake broker-OAuth-connect simulation (~30 lines, fake "connected"
toast after a timeout)
Fake "password updated" / "two-factor enabled" toasts — this platform
has no password system at all (email-OTP only), so that whole panel
was describing a feature that can't exist as written
Fabricated Reports catalog (7 report types) and Downloads catalog
(fake bot binary with a fake SHA-256 checksum, fake file sizes, fake
version changelog)
Now real:
Customer name, email, phone, subscription status, renewal date,
renewal amount (sourced from `Config.js`'s actual `CONFIG.STRATEGIES`
pricing — ₹999/mo — not invented)
Payment history (Billing tab)
Bot status (Overview card) — see §2, this one's a real backend fix
Cancel button → opens a real support email instead of faking success
(there's no cancellation endpoint on the backend at all yet)
Renew button → explains the real renewal flow (emailed Razorpay link,
7/3/1/0 days out) instead of faking a payment
Honest empty states instead of fabrication, for the pieces that
genuinely have no backend yet:
Trade history tab
Performance tab
Reports / Downloads tabs
Equity curve on Overview
A real bug I found and fixed along the way: the frontend's
subscription-status badges (`PENDING`, `GRACE_PERIOD`, `PAUSED`,
`ARCHIVED`) never matched the backend's actual enum
(`PENDING_ACTIVATION`, `ACTIVE`, `EXPIRED`, `SUSPENDED`, `CANCELLED` — see
`Config.js`'s `CONFIG.SUBSCRIPTION_STATUS`). This would have thrown on any
non-`ACTIVE` customer. Fixed, and `badge()` is now defensive against
unmapped values so a future enum change degrades instead of crashing.
Tested: `smoketest.js` (needs `npm install` first, then
`npm run smoketest`) drives every dashboard route in a simulated DOM
against stubbed real backend responses, including error paths (backend
failure, VM unreachable, no subscription, suspended subscription). All
pass clean with zero uncaught errors. It's not a replacement for testing
against your actual deployed backend, but it catches the class of bug
("this reference doesn't exist anymore") that a big rewiring pass like
this is most likely to introduce.
---
2. Backend fix — `vmBridgeConfig_()` (Apps Script)
Real bug, not a frontend issue. `VMConnector.gs`'s `vmSignedRequest_()`
called `vmBridgeConfig_()` — referenced everywhere, defined nowhere in the
project. Every VM call (`botStatus`, `brokerHealth`'s VM check) was
throwing a `ReferenceError`.
Fixed in `VMConnector.js`, following the exact property names the
file's own header comment already documented, and the same
`getProperty()` pattern `Utils.gs` already uses for Razorpay keys:
```
VM_BRIDGE_BASE_URL        e.g. "https://vm.viksitanalyst.internal:8443"
VM_BRIDGE_SHARED_SECRET   same value configured in the VM's broker_bridge.py
```
You need to set these two Script Properties (Project Settings → Script
Properties in the Apps Script editor) for bot status to show anything
real. `getBotStatus_()` already degrades to a `STOPPED` state rather than
throwing if they're missing or the VM is unreachable, so this is a
silent no-op until set, not a crash.
Once set, the dashboard's Overview "Bot Status" card is live — real
status, active strategy, heartbeat, server, latency, pulled straight from
the VM.
What this does not fix: broker connection status
(`brokerStatus`/`brokerHealth`) and everything under it (holdings,
positions, orders, funds, margins, profile, market status) still throws,
because that chain additionally depends on `brokerConfig_()`,
`brokerDatabaseSheet_()`, `brokerAppCredentials_()`, and the entire
`upstoxFetch*`/`upstoxBuildAuthUrl_`/`upstoxCheckHealth_`/
`upstoxGetMarketStatus_`/`upstoxVerifyPermissions_` family — none of which
exist anywhere in this project. That's a real Upstox API client that
needs to be built, not a missing config value. I didn't fabricate one —
getting an API contract wrong for a live broker integration is worse than
leaving it honestly unbuilt. See `dashboardApi.js`'s header comment for
the full trace.
The dashboard's Broker tab now correctly points at
`dashboard/broker/broker.html`, which is a separate, already fully-wired
sub-app (real `brokerAPI.js` client, real auto-login/TOTP handoff flow —
see §4) — it was just being duplicated badly by a second, fake mock
inside `dashboard.js` itself. That duplicate is now gone.
---
3. Onboarding — "setup documents" step removed
Per your note that this was never a real feature: removed the `downloads`
step from the 9-step wizard entirely (`progressTracker.js`'s `STEPS`
array, `wizard.js`'s render dispatch and import), and deleted
`onboarding/downloadCenter.js`. The wizard is 8 steps now, straight from
System Check to Activate.
The dashboard's own Reports/Downloads tabs had the same underlying
problem (a fabricated file catalog — see §1) and got the same treatment,
since it's the same "no real document delivery system exists" issue in a
different spot.
---
4. The auto-login "handoff" you mentioned
Checked — it's real and already fully built, not something added this
pass: `TokenStore.gs`'s `enableAutoLogin_(customerId, brokerId, {totpSecret, pin})` / `disableAutoLogin_()`, exposed via
`BrokerRouter.gs`'s `brokerEnableAutoLogin`/`brokerDisableAutoLogin`
actions, and already wired end-to-end in
`dashboard/broker/js/brokerAPI.js` and `brokerSession.js` on the frontend.
I didn't touch it — just made sure the dashboard's copy/routing doesn't
undersell it or contradict how it actually works.
---
5. `viksit-analyst-app` (mobile) brought back in sync
Its `www/` folder was a stale fork — literally predating the original
audit-fixes changelog (its `dashboard.js` was still the old 1860-line
mock-heavy version). Per `src/bridge.js`'s own header comment, `www/` is
supposed to ship the website's `auth/`, `assets/`, `dashboard/`, and
`onboarding/` directories byte-for-byte, plus one injected
`<script src="/js/capacitor-bridge.bundle.js" defer>` tag per page.
Replaced those four directories and the root customer-facing HTML/config
files with the updated versions from the site above (confirmed
byte-identical via `diff`), added the two pages the mobile bundle didn't
have yet (`trust.html`, `research.html`), and injected the bridge script
tag into every page that was missing it after the sync (13 files — the
sync had overwritten their tags along with everything else). Verified
every `.html` file in `www/` now has exactly one bridge-tag reference,
and every `.js` file passes a syntax check.
`admin/` and dev-only files (`README.md`, `AUDIT_FIXES_CHANGELOG.md`,
`smoketest.js`, `node_modules/`) were deliberately excluded, matching
what was already true before this pass — an admin panel doesn't belong in
a customer-facing mobile bundle.
Going forward: treat `payment-success-main` as the one real codebase
and re-sync `viksit-analyst-app/www` from it before each mobile release,
rather than hand-editing both. Two independently-maintained copies of the
same product is exactly the kind of "not connected" problem this whole
pass was about fixing.
---
6. Still open — needs your decision or a bigger dedicated pass
Upstox API client. The real gap behind §2. Needs actual Upstox API
docs/credentials to build correctly — I didn't want to guess at a
financial API contract from memory.
Trade/P&L backend. Even with a working Upstox client, raw order
history isn't the same as a strategy-attributed P&L ledger. Needs
design work, not just a connection.
Self-service cancel/renew endpoints. Currently support-mediated by
design (see §1) — build real endpoints if you want this in-app.
Profile/Settings edit endpoints. Name/phone/email fields are
read-only now (no fake save) because there's no backend write action
for them yet.
`RENDERERS.settings` (notification prefs, API keys, etc.) wasn't
part of this pass — same fake-save pattern likely lives there too,
worth the same treatment.
Given the size of what's left (a real broker API integration, most
of all), this is a good point to hand off to Claude Code for the
next stretch rather than continuing in chat — it's better suited to
the kind of iterative, testable backend build that's left.
---
7. How to verify before deploying
```bash
npm install          # jsdom, for smoketest.js only
npm run smoketest    # drives every dashboard route against stubbed real API responses
```
Then, against your actual deployed Apps Script backend (this sandbox has
no network access to script.google.com, so everything above was verified
by reading the real source contracts + a simulated-DOM test, not a live
end-to-end run):
Log in as a real customer, confirm Overview shows real name/subscription/renewal.
Check Billing shows real payment history.
Set `VM_BRIDGE_BASE_URL`/`VM_BRIDGE_SHARED_SECRET`, confirm Bot Status goes live.
Walk the onboarding wizard end-to-end (now 8 steps).
Replace the SEBI placeholder (§0) before any public deploy.
