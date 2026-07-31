const SCRIPT_URL = "YOUR_APPS_SCRIPT_URL";

function buy(bot) {

    const callbackName = "jsonp_" + Date.now();

    window[callbackName] = function (data) {

        delete window[callbackName];
        script.remove();

        if (!data.success) {

            alert(data.error);
            return;

        }

        const order = data.order;

        const options = {

            key: data.key,

            amount: order.amount,

            currency: order.currency,

            name: "Viksit Analyst",

            description: order.notes.botName,

            order_id: order.id,

            theme: {
                color: "#2563eb"
            },

            handler: function () {

                window.location.href = "success.html";

            }

        };

        const rzp = new Razorpay(options);

        rzp.open();

    };

    const script = document.createElement("script");

    script.src =
        SCRIPT_URL +
        "?action=createOrder&bot=" +
        encodeURIComponent(bot) +
        "&callback=" +
        callbackName;

    document.body.appendChild(script);

}
