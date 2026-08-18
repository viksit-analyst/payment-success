// M3 fix: this used to be its own hardcoded copy of the Apps Script
// deployment URL — one of three independent copies (this file, auth/config.js,
// onboarding/api.js) that could silently drift out of sync on redeploy.
// auth/config.js is now the single source of truth; index.html loads it
// before this script (see index.html's script tags). No hardcoded fallback
// URL here on purpose — a silent fallback would just reintroduce a second
// copy that can drift; missing config should fail loudly instead.
const SCRIPT_URL = window.VA_AUTH_CONFIG && window.VA_AUTH_CONFIG.API_BASE_URL;

// Low-priority audit item: this file's payment flow previously called
// console.log directly, logging full Razorpay request/response objects
// unconditionally. Not a secrets leak (no keys are logged), but noisy in
// production. Gated behind DEBUG now — append ?debug=1 to the URL to see
// these while diagnosing a checkout issue.
const DEBUG = /[?&]debug=1\b/.test(window.location.search);
function debugLog(...args) { if (DEBUG) console.log(...args); }

let paymentInProgress = false;

// PERF FIX: checkout.razorpay.com/v1/checkout.js used to be a blocking
// <script> tag loaded on every page view, whether or not the visitor ever
// clicked "Subscribe" - PageSpeed flagged this as a large chunk of unused
// JavaScript on first load, and it also queued in front of this file and
// script.js, delaying the hero reveal on slow mobile connections. It's now
// fetched on demand, the first time buy() actually runs, and cached so a
// second click doesn't reload it. CSP already allowlists this exact origin
// (script-src 'self' https://checkout.razorpay.com), so no CSP change is
// needed to load it this way.
let razorpayScriptPromise = null;
function loadRazorpayScript() {
    if (window.Razorpay) return Promise.resolve();
    if (razorpayScriptPromise) return razorpayScriptPromise;
    razorpayScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => {
            razorpayScriptPromise = null;
            reject(new Error('Could not load the payment gateway. Please check your connection and try again.'));
        };
        document.head.appendChild(script);
    });
    return razorpayScriptPromise;
}

// UX FIX: buy() previously gave zero visual feedback between the click and
// Razorpay's checkout modal opening — just a silent paymentInProgress flag.
// On a cold Apps Script execution (createOrder can genuinely take 1-3s)
// the button looked broken, and nothing stopped a confused user clicking
// it again. This swaps the label for a spinner and disables the button;
// restored on every exit path below.
function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.classList.toggle('is-loading', isLoading);
    const label = btn.querySelector('.va-btn-label');
    const loading = btn.querySelector('.va-btn-loading');
    if (label) label.hidden = isLoading;
    if (loading) loading.hidden = !isLoading;
}

async function buy(bot, btn) {
    debugLog("buy() called:", bot);
    if (paymentInProgress) return;

    if (!SCRIPT_URL) {
        alert("Something went wrong.\n\nPayments aren't configured correctly on this page. Please contact support.");
        console.error('[app.js] window.VA_AUTH_CONFIG.API_BASE_URL is missing — make sure auth/config.js loads before app.js.');
        return;
    }

    paymentInProgress = true;
    setButtonLoading(btn, true);
    const resetButton = () => setButtonLoading(btn, false);

    try {

        debugLog("Sending request...");

        // Kick off the Razorpay script load and the order-creation request
        // at the same time - the modal needs both, so there's no reason to
        // make one wait on the other.
        const razorpayReady = loadRazorpayScript();

        const response = await fetch(
            SCRIPT_URL +
            "?action=createOrder&bot=" +
            encodeURIComponent(bot)
        );
        
        debugLog("Fetch completed");
        
        debugLog("HTTP Status:", response.status);

        if (!response.ok) {
            throw new Error(`Server Error ${response.status}`);
        }
        const text = await response.text();
        
        debugLog("Raw Response:");
        
        debugLog(text);
        
        const data = JSON.parse(text);
        
        debugLog("Parsed Data:");
        
        debugLog(data);

        if (
            data.success !== true &&
            data.status !== "success"
        ) {
            throw new Error(
                data.error ||
                data.message ||
                "Unable to create order."
            );
        }
                
        const order = data.order;

        const options = {

            key: data.key,

            amount: order.amount,

            currency: order.currency,

            order_id: order.id,

            name: "Viksit Analyst",

            description: order.notes.botName,

            theme: {
                color: "#2563eb"
            },

            retry: {
                enabled: true,
                max_count: 2
            },

            modal: {
            
                confirm_close: true,
            
                escape: false,
            
                ondismiss: function () {
            
                    paymentInProgress = false;
                    resetButton();
            
                }
            
            },

            handler: function (response) {
            
                paymentInProgress = false;
                // Intentionally no resetButton() here — we're about to
                // navigate to success.html, so leaving the button in its
                // loading state avoids a flash of the normal label right
                // before the page unloads.
            
                window.location.href =
                    `success.html?payment_id=${response.razorpay_payment_id}`;
            
            }

        };
        debugLog("Options:");
        
        debugLog(options);

        await razorpayReady;
        const rzp = new Razorpay(options);
        
        debugLog("Opening Razorpay...");

        // The checkout modal is its own loading indicator from here on —
        // drop the button's spinner right before it opens so the two
        // don't run at the same time.
        resetButton();
        
        rzp.on("payment.failed", function (response) {
        
            console.error(response.error);
        
            alert(
                "Payment Failed\n\n" +
                response.error.description
            );
        
            paymentInProgress = false;
        
        });
        
        try {
        
            rzp.open();
        
        } catch (err) {
        
            paymentInProgress = false;
        
            throw err;
        
        }

    }

    catch (e) {

        console.error(e);

        alert(e.message || "Something went wrong.");

        paymentInProgress = false;
        resetButton();

    }

}
