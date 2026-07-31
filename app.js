const SCRIPT_URL =
"https://script.google.com/macros/s/AKfycbxzbo25oQHBZRB-oZUgdtKiXo_R1EP0Gsu7Q5D_vGhgnzCowsLNBkEmUMC-YuwGRkxU/exec";

async function buy(bot) {

    try {

        const response = await fetch(
            SCRIPT_URL +
            "?action=createOrder&bot=" +
            encodeURIComponent(bot)
        );

        const data = await response.json();

        if (!data.success) {
            alert(data.error);
            return;
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

            handler: function () {

                window.location.href = "success.html";

            }

        };

        const rzp = new Razorpay(options);

        rzp.open();

    }

    catch (e) {

        console.error(e);

        alert(e);

    }

}
