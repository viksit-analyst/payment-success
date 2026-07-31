const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxzbo25oQHBZRB-oZUgdtKiXo_R1EP0Gsu7Q5D_vGhgnzCowsLNBkEmUMC-YuwGRkxU/exec";

async function buy(bot) {

    try {

        const url = SCRIPT_URL + "?action=createOrder&bot=" + encodeURIComponent(bot);

        const res = await fetch(url);

        const text = await res.text();

        console.log("Status:", res.status);
        console.log("Response:");
        console.log(text);

        alert(text);

        const data = JSON.parse(text);

        const order = data.order;

        const options = {
            key: data.key,
            amount: order.amount,
            currency: order.currency,
            order_id: order.id,
            name: "Viksit Analyst",
            description: order.notes.botName,

            handler: function () {
                window.location.href = "success.html";
            }
        };

        new Razorpay(options).open();

    } catch (e) {

        console.error(e);
        alert(e);

    }

}
