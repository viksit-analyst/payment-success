const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxzbo25oQHBZRB-oZUgdtKiXo_R1EP0Gsu7Q5D_vGhgnzCowsLNBkEmUMC-YuwGRkxU/exec";

let paymentInProgress = false;

async function buy(bot) {

    if (paymentInProgress) return;

    paymentInProgress = true;

    const buttons = document.querySelectorAll(".buy-btn");

    buttons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.style.cursor = "not-allowed";
    });

    try {

        const response = await fetch(
            `${SCRIPT_URL}?action=createOrder&bot=${encodeURIComponent(bot)}`
        );

        if (!response.ok) {
            throw new Error(`Server Error ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || "Unable to create order.");
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
                escape: false
            },

            handler: async function (payment) {

                try {

                    const verifyResponse = await fetch(SCRIPT_URL, {

                        method: "POST",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify({

                            action: "verify",

                            razorpay_payment_id:
                                payment.razorpay_payment_id,

                            razorpay_order_id:
                                payment.razorpay_order_id,

                            razorpay_signature:
                                payment.razorpay_signature

                        })

                    });

                    const verify = await verifyResponse.json();

                    if (verify.success) {

                        window.location.href = "success.html";

                    } else {

                        alert(
                            verify.error ||
                            "Payment verification failed."
                        );

                        enableButtons();

                    }

                }

                catch (e) {

                    console.error(e);

                    alert("Verification failed.");

                    enableButtons();

                }

            }

        };

        const rzp = new Razorpay(options);

        rzp.on("payment.failed", function (response) {

            console.error(response.error);

            alert(
                "Payment Failed\n\n" +
                response.error.description
            );

            enableButtons();

        });

        rzp.open();

    }

    catch (e) {

        console.error(e);

        alert(e.message || e);

        enableButtons();

    }

}

function enableButtons() {

    paymentInProgress = false;

    document.querySelectorAll(".buy-btn").forEach(btn => {

        btn.disabled = false;

        btn.style.opacity = "";

        btn.style.cursor = "";

    });

}
