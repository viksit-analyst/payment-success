const SCRIPT_URL="YOUR_APPS_SCRIPT_URL";

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
