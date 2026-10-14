'use strict';
const params=new URLSearchParams(location.search),count=Math.max(1,Number(params.get('count'))||1);
document.getElementById('arrivalBody').textContent=count+' new item'+(count===1?'':'s')+' added to your inventory.';
document.getElementById('arrivalIds').textContent=params.get('ids')||'';
document.getElementById('arrivalOpen').onclick=()=>window.apexIntakeNotification.open();
document.getElementById('arrivalClose').onclick=()=>window.apexIntakeNotification.dismiss();
