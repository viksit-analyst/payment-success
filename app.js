const SCRIPT_URL="https://script.google.com/macros/s/AKfycbxzbo25oQHBZRB-oZUgdtKiXo_R1EP0Gsu7Q5D_vGhgnzCowsLNBkEmUMC-YuwGRkxU/exec";

async function buy(bot){

try{

const res=await fetch(

SCRIPT_URL+

"?action=createOrder&bot="+bot

);

const data=await res.json();

if(!data.success){

alert(data.error);

return;

}

const order=data.order;

const options={

key:data.key,

amount:order.amount,

currency:order.currency,

name:"Viksit Analyst",

description:order.notes.botName,

order_id:order.id,

theme:{
color:"#2563eb"
},

handler:function(){

window.location.href="success.html";

}

};

new Razorpay(options).open();

}

catch(e){

alert(e);

}

}
