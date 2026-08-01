const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxzbo25oQHBZRB-oZUgdtKiXo_R1EP0Gsu7Q5D_vGhgnzCowsLNBkEmUMC-YuwGRkxU/exec";

let paymentInProgress = false;

async function buy(bot) {

    if (paymentInProgress) return;

    paymentInProgress = true;

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

            handler: function (response) {

                window.location.href =
                    `success.html?payment_id=${response.razorpay_payment_id}`;

            }

        };

        const rzp = new Razorpay(options);

        rzp.on("payment.failed", function (response) {

            console.error(response.error);

            alert(
                "Payment Failed\n\n" +
                response.error.description
            );

            paymentInProgress = false;

        });

        rzp.open();

    }

    catch (e) {

        console.error(e);

        alert(e.message || "Something went wrong.");

        paymentInProgress = false;

    }

}
