const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxzbo25oQHBZRB-oZUgdtKiXo_R1EP0Gsu7Q5D_vGhgnzCowsLNBkEmUMC-YuwGRkxU/exec";

let paymentInProgress = false;

async function buy(bot) {
    console.log("buy() called:", bot);
    if (paymentInProgress) return;

    paymentInProgress = true;

    try {

        console.log("Sending request...");
        
        const response = await fetch(
            SCRIPT_URL +
            "?action=createOrder&bot=" +
            encodeURIComponent(bot)
        );
        
        console.log("Fetch completed");
        
        console.log("HTTP Status:", response.status);

        if (!response.ok) {
            throw new Error(`Server Error ${response.status}`);
        }
        const text = await response.text();
        
        console.log("Raw Response:");
        
        console.log(text);
        
        const data = JSON.parse(text);
        
        console.log("Parsed Data:");
        
        console.log(data);

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
            
                }
            
            },

            handler: function (response) {
            
                paymentInProgress = false;
            
                window.location.href =
                    `success.html?payment_id=${response.razorpay_payment_id}`;
            
            }

        };
        console.log("Options:");
        
        console.log(options);
        const rzp = new Razorpay(options);
        
        console.log("Opening Razorpay...");
        
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

    }

}
