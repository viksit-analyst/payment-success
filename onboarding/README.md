# Viksit Analyst — Customer Onboarding System

Guided, resumable setup flow that runs between a successful Razorpay
payment and an active, trading bot. Vanilla HTML/CSS/ES2023 JavaScript —
no build step, no framework — built as a direct extension of the
existing marketing site's design system and JavaScript conventions.

---

## 1. What this actually integrates with (read this first)

This was built after studying the real `payment-success-main` repo, not
from the planning docs alone. Three things that came out of that study
materially shaped this build:

1. **No `localStorage`/`sessionStorage`, anywhere.** `script.js`'s theme
   toggle is explicitly in-memory, session-scoped by design. "Resume
   later" therefore works by persisting progress to the backend
   (`saveProgress`/`getProgress`) and using the **emailed onboarding
   link itself** (`onboarding.html?token=...`) as the resumable
   bookmark — not a cookie, not local storage.
2. **The live pricing card sells a single unified "Professional Plan,"**
   not per-strategy purchases (`app.js`'s `buy(bot)` function assumes
   per-strategy purchases and isn't actually wired to any button on
   `index.html` right now). This build treats **Step 5 ("Strategy
   Setup") as where a specific strategy gets allocated to the
   customer's bot**, independent of the unified billing plan.
3. **There is no Dashboard, Auth, or Broker-Integration code anywhere**
   in the repo this was built against — only the marketing site and a
   bare `success.html` stub. Everything here is built against a
   documented API contract (§5) rather than real backend code, because
   that code lives in a separate Apps Script project this pass didn't
   have access to. `dashboard.html` (linked from the final screen and
   from `nav-actions`) **does not exist yet** — see §8.

---

## 2. Folder structure

```
/
├── success.html            Rebuilt — was an unstyled stub; now on-brand,
│                             reads ?payment_id=, sets expectations for the
│                             emailed onboarding link
├── onboarding.html          The wizard page itself
├── onboarding.css           Extends styles.css tokens — zero duplication
├── onboarding.js            Entry point — boots the wizard, handles
│                             OAuth-return query params
├── api.js                   Backend contract layer (§5)
├── progressTracker.js       Progress state + persistence (no browser storage)
├── wizard.js                Step orchestrator: sequencing, stepper, nav
├── welcome.js                Steps 1–2: Welcome, Verify Profile
├── brokerSetup.js             Steps 3–4: Broker Connection, Broker Verification
├── botSetup.js                  Steps 5–6: Strategy Setup, Bot Configuration
├── downloadCenter.js              Step 8: Downloads
├── activation.js                    Step 7, 9 + Final Screen: Infrastructure
│                                     Check, Activation, "Ready to Trade"
├── checklist.js              Coarse 6-item checklist (Payment / Verified /
│                              Broker / Strategy / Bot / Ready) — used on the
│                              welcome step and reusable on a future dashboard
└── components/
    ├── toast.js               Toast notifications
    └── confirmDialog.js        Confirm dialogs (reuses styles.css's
                                  existing .modal-overlay markup/behavior)
```

Every file above is an ES2023 module (`import`/`export`). This is a
deliberate, scoped departure from `script.js`/`app.js`, which are plain
IIFE scripts — with 13 files sharing state (progress, session data,
step sequencing), native modules avoid global-namespace collisions
without introducing a bundler. It doesn't touch how `script.js`/`app.js`
work on the pages that already use them; `onboarding.html` loads both
`script.js` (unchanged, for nav/theme/drawer) and `onboarding.js`
(`type="module"`) side by side.

---

## 3. Onboarding flow

```
Payment Success (Razorpay)
  → success.html (?payment_id=...)
  → [Apps Script webhook creates customer + subscription, emails
     onboarding.html?token=... — asynchronous, not shown client-side]
  → onboarding.html?token=...
      1. Welcome
      2. Verify Profile
      3. Broker Connection      (Upstox OAuth redirect out and back)
      4. Broker Verification    (all checks must pass to continue)
      5. Strategy Setup         (strategy allocation — see §1.2)
      6. Bot Configuration
      7. Infrastructure Check   (warnings are dismissable, failures aren't)
      8. Downloads
      9. Activation             (Backend → VM → Bot → Heartbeat → Success)
  → Final Screen ("Ready to Trade") → dashboard.html (§8)
```

The 9-step stepper (`onboarding.css` §2) is distinct from the 6-item
checklist (`checklist.js`) — the stepper is the wizard's internal state
machine; the checklist is the coarser mental model a customer actually
holds ("is my broker connected yet?"), and is what a future dashboard's
"Resume Setup" card should render.

---

## 4. Progress tracking

`progressTracker.js` is the single source of truth for wizard position.
On every step completion it calls `Api.saveProgress()`; on boot,
`Api.loadProgress()` restores `currentStep`, `completedSteps`, and
`progressPct`. If no saved progress exists (first visit), it starts
fresh at `welcome` — this is expected and not treated as an error.

If `?token=` is missing or invalid, the wizard renders a dedicated
empty state (`wizard.js`'s `renderNoTokenEmptyState`) rather than
crashing or showing a blank page.

---

## 5. API integration — the backend contract

`api.js` calls the **same Apps Script Web App** `app.js` already calls
for checkout (identical `SCRIPT_URL`), using the identical pattern:
`GET {SCRIPT_URL}?action=<name>&<params>` → `{success, ...}` or
`{success: false, error}`.

**None of the `action` values below existed before this pass.** This
table is the exact spec the Apps Script project needs to implement —
since that project wasn't in this handoff, these are documented
precisely rather than guessed at in code that might not match:

| `action` | Params | Returns | Used by |
|---|---|---|---|
| `getCustomer` | `token` | `{customer: {id, name, firstName, email, phone, country}}` | `loadCustomer()` |
| `getSubscription` | `token` | `{subscription: {planName, expiresAt, strategyId, orderId, userGuideUrl, strategyGuideUrl, setupGuideUrl, configSummaryUrl, invoiceUrl, receiptUrl}}` | `loadSubscription()` |
| `getProgress` | `token` | `{progress: {currentStep, completedSteps[], lastUpdated, completionTime}}` | `loadProgress()` |
| `saveProgress` | `token, currentStep, completedSteps (JSON), progressPct` | `{progress: {...}}` | `saveProgress()` |
| `getBrokerStatus` | `token` | `{broker: {status: 'connected'\|'not_connected', clientId, accountLabel}}` | `loadBrokerStatus()` |
| `startBrokerAuth` | `token, broker` | `{redirectUrl}` — Upstox OAuth URL; must redirect back to `onboarding.html?token=...&oauth=success` or `...&oauth=failed&reason=...` | `connectBroker()` |
| `validateBroker` | `token` | `{checks: {tradingEnabled, fnoEnabled, apiEnabled, margins, exchangePermissions, latencyMs}}` | `validateBroker()` |
| `generateBotConfig` | `token, strategy` | `{config: {strategy, broker, customerId, server, region, botVersion, status}}` | `generateBotConfig()` |
| `checkInfrastructure` | `token` | `{infrastructure: {backend, vm, broker, api, scheduler, database, network, heartbeat}}` — each `'healthy'\|'warning'\|'critical'` | `checkInfrastructure()` |
| `activateBot` | `token` | `{activation: {status: 'active'\|'failed', stages: {backend, vm, bot, heartbeat}}}` | `activateBot()` |
| `completeOnboarding` | `token` | `{customer: {...}}` | `completeOnboarding()` |

**Not yet wired:** a dedicated `saveProfile` action for Step 2's editable
fields (name/email/phone/timezone/country/experience/language) wasn't in
the original spec's 10-function API list — `welcome.js`'s
`readProfileForm()` reads the form but `wizard.js` doesn't currently
persist it anywhere. Add a `saveProfile` action and one `Api` call
before treating Step 2 as functionally complete.

**Email templates** (Welcome, Setup Started, Broker Connected, Bot
Activated, Setup Completed, Support) are backend concerns — the real
README documents an `Email Queue` Sheet tab already used for report
delivery. These onboarding lifecycle emails should be queued the same
way, triggered by the corresponding `action` calls above (e.g.
`activateBot` succeeding queues "Bot Activated"). No template content
is generated here since it belongs in the Apps Script project, not this
static frontend.

---

## 6. VM activation flow

```
onboarding.js (activateBot)
  → Apps Script (action=activateBot)
  → VM API
  → Generate customer workspace, generate config, assign strategy, start bot
  → Heartbeat confirmed
  → Apps Script returns {status, stages}
  → activation.js animates the Backend → VM → Bot → Heartbeat → Success track
```

`activation.js`'s `animateStages()` paces the UI regardless of whether
the backend returns granular per-stage status yet — if it doesn't
(`stages` omitted), the sequence still animates through in order rather
than jumping straight to "done," so the UI degrades gracefully ahead of
the backend catching up to this contract.

---

## 7. Error handling

- **Network/timeout** — `api.js` wraps every call in a 15s timeout and
  surfaces a clear message rather than hanging.
- **OAuth failure** — `onboarding.js` reads `?oauth=failed&reason=...`
  on load, shows a toast, then strips those params (keeping `?token=`)
  so a refresh doesn't re-show it.
- **Failed broker/infrastructure checks** — block advancing (broker) or
  prompt for explicit confirmation (infrastructure warnings only;
  critical failures should also block — extend `validateAndAdvance()`
  in `wizard.js` once the backend distinguishes warning vs. critical
  infra states, which `checkInfrastructure`'s current 3-state contract
  already supports but this pass treats uniformly as "needs
  confirmation").
- **Missing/expired token** — dedicated empty state, not a crash.

---

## 8. What's still needed (not built in this pass, scope was frontend)

- **`dashboard.html`** — doesn't exist. The final screen and nav both
  link to it. Needs: Setup Progress card (reuse `checklist.js`),
  Complete/Resume Setup CTA, Performance page, and the logic to never
  show onboarding again once `completeOnboarding` has succeeded.
- **The Apps Script backend itself** — §5's contract table needs
  implementing against the real `Config.gs`/Sheet schema, which wasn't
  part of this handoff.
- **`legal.css`** — referenced by the real site's `contact.html` etc.
  but wasn't in the backup provided, so `onboarding.css`'s form styles
  (§5 in that file) were built fresh from the same design tokens rather
  than copied from it. If `legal.css` turns up later, reconcile the two.
- **A `saveProfile` backend action** (§5).

---

## 9. Local development

Same as the real site — no build tooling:

```bash
python3 -m http.server 8000
# http://localhost:8000/onboarding.html?token=test-token
```

Without a real backend, every `Api.*` call will fail against the live
`SCRIPT_URL` unless `token=test-token` (or similar) is provisioned
there. To develop the frontend in isolation before the backend contract
is implemented, swap `api.js`'s `request()` internals for a mock that
returns fixture data matching §5's shapes — the rest of the codebase
only depends on `Api`'s public function signatures, not on `request()`
directly.

---

## 10. Testing

No test framework is wired up (matches the rest of the site — zero
build tooling). Before shipping:

- Walk all 9 steps forward with a valid token and mocked/staged backend
  responses for each `action`.
- Reload mid-flow (e.g. after Step 5) and confirm it resumes at Step 5,
  not Step 1.
- Hit `onboarding.html` with no `?token=` and confirm the empty state
  renders instead of a blank page or console error.
- Force `validateBroker` to return a failing check and confirm Continue
  is blocked with a toast, not a silent no-op.
- Force `checkInfrastructure` to return one `'warning'` value and
  confirm the confirm-dialog path fires.
- Test with `prefers-reduced-motion: reduce` — all animations
  (`onboarding.css`) have a reduced-motion fallback.

---

## 11. Customization & future expansion

- **Multiple strategies per bot** — `botSetup.js`'s `STRATEGY_META` is a
  flat object; a customer selecting more than one would need Step 5's
  `radiogroup` changed to checkboxes and `generateBotConfig` called per
  strategy. Not built now since the current plan model allocates one
  strategy at a time.
- **Multiple brokers** — `brokerSetup.js`'s `connectBroker('upstox')`
  already takes a broker parameter; adding Zerodha only needs a second
  card in Step 3 and no changes to `api.js`'s contract shape.
- **Plugin-style steps** — `STEPS` in `progressTracker.js` is a single
  ordered array; inserting a new step is adding one entry there plus a
  `case` in `wizard.js`'s `runStep()`/`validateAndAdvance()` switches —
  no other file needs to change.

---

© Viksit Analyst. Built to extend, not replace, the existing site.
