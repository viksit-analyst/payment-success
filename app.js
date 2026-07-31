const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxzbo25oQHBZRB-oZUgdtKiXo_R1EP0Gsu7Q5D_vGhgnzCowsLNBkEmUMC-YuwGRkxU/exec";

async function buy(bot) {

    try {

        const url = SCRIPT_URL + "?action=createOrder&bot=" + encodeURIComponent(bot);

        const res = await fetch(url, {
            redirect: "follow"
        });

        const text = await res.text();

        console.log("Status:", res.status);
        console.log("URL:", res.url);
        console.log("Response:");
        console.log(text);

        alert(text);

        return;

    } catch (e) {

        console.error(e);
        alert(e);

    }

}
