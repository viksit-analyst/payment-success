Viksit Analyst — Website
Marketing site and legal/compliance pages for Viksit Analyst, a quantitative research and automated execution platform. Static HTML/CSS/JS — no build step, no framework, no dependencies beyond Google Fonts.
Live: https://www.viksitanalyst.com
What's in this repo
```
/
├── index.html                 Landing page (hero, strategies, pricing, FAQ, Mission Control)
├── privacy.html                Privacy Policy
├── terms.html                  Terms & Conditions (incl. Risk Disclosure)
├── refund.html                 Refund Policy
├── contact.html                 Contact page
├── 404.html                    Custom error page
├── styles.css                  Core design system (VDS) — tokens, layout, components
├── legal.css                   Supplementary styles for legal/contact/404 pages only
├── script.js                   All interactivity (nav, theme, FAQ, modal, reveal animations)
├── robots.txt
├── sitemap.xml
├── manifest.webmanifest
├── browserconfig.xml
├── humans.txt
├── security.txt                 Root mirror of /.well-known/security.txt
├── .well-known/
│   └── security.txt             Canonical security contact (RFC 9116)
└── assets/
    └── favicon.svg
```
Design system note: all new pages reuse `styles.css` and `script.js` as-is — nothing was duplicated. `legal.css` only adds layout patterns that didn't already exist (the policy page shell, the contact form, and the 404 layout). Every page shares the exact same header, mobile drawer, footer, and modal markup so `script.js` behaves identically everywhere.
Before you deploy — assets you still need to add
A few referenced assets are not included in this pass and should be added to `/assets/` before launch:
File	Used by	Notes
`assets/favicon.svg`	all pages	Already present — verify it renders correctly at 16–48px.
`assets/og-cover.png`	Open Graph / Twitter cards	1200×630px recommended.
`assets/icon-192.png`, `assets/icon-512.png`, `assets/icon-maskable-512.png`	`manifest.webmanifest`	Now included (generated from the brand mark) — spot-check the maskable variant on an actual Android device before launch; automated safe-zone padding is a good approximation, not a substitute for a designer's eye.
`assets/mstile-70x70.png`, `-150x150.png`, `-310x310.png`, `-310x150.png`	`browserconfig.xml`	Windows tile icons.
Until these exist, browsers will simply fall back gracefully (no broken layout), but generate and add them before going live for a polished install/share experience.
---
Deploying to GitHub Pages
Push to a repository. Commit all files at the repo root (not inside a subfolder), so `https://<user>.github.io/<repo>/` resolves to `index.html`.
Enable Pages. In the repo: `Settings → Pages → Build and deployment → Source: Deploy from a branch`. Choose your default branch (e.g. `main`) and `/ (root)`.
Set the custom domain. Under `Settings → Pages → Custom domain`, enter `www.viksitanalyst.com`. GitHub will commit a `CNAME` file to the repo root automatically — don't delete it.
Configure DNS. At your domain registrar / DNS provider:
`www` → `CNAME` → `<user>.github.io`
Apex (`viksitanalyst.com`) → `A` records pointing to GitHub Pages' IPs (currently `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` — confirm current values in GitHub's own Pages documentation before setting them), or an `ALIAS`/`ANAME` record if your DNS provider supports one, then redirect apex → `www` at the registrar level to match the canonical URLs used throughout this site (`https://www.viksitanalyst.com/...`).
Apex (viksitanalyst.com)
Configured using an ALIAS record pointing to:
viksit-analyst.github.io
DNS is managed through Squarespace Domains.
Enforce HTTPS. Once DNS propagates and GitHub issues the TLS certificate (can take up to a few hours), tick Enforce HTTPS in the same Pages settings panel. All canonical URLs, sitemap entries, and structured data on this site already assume `https://www.viksitanalyst.com`.
Verify. Confirm `https://www.viksitanalyst.com/`, `/privacy.html`, `/terms.html`, `/refund.html`, `/contact.html`, and a deliberately broken URL (to confirm `404.html` renders — GitHub Pages serves `404.html` automatically for unmatched paths at the repo root) all load correctly.
Razorpay configuration
Payments (one-time onboarding fee + recurring monthly subscription) are processed through Razorpay. This repository does not contain Razorpay's client SDK or checkout invocation code — that lives in the platform's subscription flow, wired to the plan IDs already provisioned in the backend (`PLAN_MAP` in `Config.gs` of the Apps Script project). Before launch, confirm:
The Razorpay account is out of test mode and live API keys are in use.
Webhook endpoints (see Section 5) are registered under Razorpay Dashboard → Settings → Webhooks, subscribed at minimum to: `payment.captured`, `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.paused`, `subscription.halted`.
The Razorpay webhook secret matches the value configured in the Apps Script project's script properties.
Legal pages are linked from the checkout flow where required (Razorpay's own compliance review may ask for direct links to `terms.html`, `refund.html`, and `privacy.html`).
---
Google Apps Script backend
The subscription/payment backend runs on Google Apps Script, backed by Google Sheets as the data store (`Customers`, `Payments`, `Subscriptions`, `Email Queue`, `PaymentMapping`, `Logs`, `AuditLog`, `RetryQueue` tabs) and a Gmail-based email queue for report and confirmation delivery. This code lives in a separate Apps Script project, not in this static site repo.
To deploy or update it:
Open the Apps Script project bound to the platform's Google Sheet (`Extensions → Apps Script` from the Sheet, or the standalone project if separated).
Confirm `CONFIG.SPREADSHEET_ID` in `Config.gs` points to the correct production spreadsheet.
Set script properties (`Project Settings → Script properties`) for the Razorpay key ID, key secret, and webhook secret — never hard-code these in source.
Deploy as a Web App (`Deploy → New deployment → Web app`), execute as Me, access Anyone (required for Razorpay's webhook to reach it unauthenticated).
Copy the resulting web app URL into the Razorpay webhook configuration described in Section 4.
Re-deploy (not just save) after every code change — Apps Script web app URLs are versioned, and edits don't go live until a new deployment version is published.
---
5b. Security headers (audit finding M6 — hosting-layer, not fixable in this repo)
This site currently has no Content-Security-Policy, `X-Frame-Options`/`frame-ancestors`,
`Referrer-Policy`, or `Strict-Transport-Security` set anywhere, on any page — including the
authenticated dashboard/admin/broker pages added since the original marketing-site pass.
Given the `CNAME` file in Section 3, this is plain GitHub Pages, which does not support
custom response headers at all — there's no `_headers` file, no server config, nothing that
can be committed to this repo to fix it. Before launch, pick one:
Front GitHub Pages with Cloudflare (free tier is enough): keep GH Pages as the origin,
point DNS through Cloudflare instead of directly at GitHub's IPs, and add the headers above
via a Cloudflare Transform Rule / Worker. Smallest change from the current setup.
Move hosting to a platform with native header support (Cloudflare Pages, Netlify,
Vercel), which do support a `_headers` file committed to the repo. Bigger change (re-point
DNS, re-verify the custom domain + HTTPS cert), but headers then live in version control
alongside the code they protect.
Recommended starting values once you have a place to set them: `Content-Security-Policy`
scoped to this site's actual third-party origins (Google Fonts, `checkout.razorpay.com`,
`cdnjs.cloudflare.com` for Chart.js, and the Apps Script `script.google.com` deployment —
see `auth/config.js`); `X-Frame-Options: DENY` (or an equivalent `frame-ancestors 'none'` in
the CSP); `Referrer-Policy: strict-origin-when-cross-origin`; `Strict-Transport-Security`
with a long `max-age` once HTTPS is confirmed stable.
---
Local development
No build tooling is required. To preview locally:
```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000
```
Any static file server works — the site has zero server-side dependencies.
Pre-launch checklist
[ ] Add missing image assets listed in Section 2 (`og-cover.png`, Windows tiles — the PWA icons are now included).
[ ] Confirm `styles.css` and `script.js` are unchanged (this pass only added `legal.css`).
[ ] Update `og:image` / `twitter:image` once `assets/og-cover.png` exists.
[ ] Point DNS + enforce HTTPS per Section 3.
[ ] Set security headers per Section 5b — cannot be done in this repo alone on plain GitHub Pages.
[ ] Move Razorpay to live keys and register production webhooks per Section 4.
[ ] Confirm the Apps Script web app deployment URL matches the Razorpay webhook URL, and that `auth/config.js`'s `API_BASE_URL` (the single source of truth other pages now read from) matches it too.
[ ] Wire real persistence for the dashboard's billing/profile/settings save actions (currently demo-only success toasts — see the H5 TODO comments in `dashboard/dashboard.js`).
[ ] Make Mission Control's admin authorization real server-side once a backend exists — `admin/adminGuard.js` is UI-only today (see its own header comment).
[ ] Verify `success.html`'s `payment_id` against the backend, or replace it with a signed token, before relying on that page for anything more than a friendly confirmation screen.
[ ] Spot-check `privacy.html`, `terms.html`, `refund.html`, and `contact.html` render identically in light and dark mode.
[ ] Validate `sitemap.xml` and `robots.txt` against the final domain once live.
[ ] Submit the sitemap in Google Search Console after launch.
---
© Viksit Analyst. All rights reserved.
