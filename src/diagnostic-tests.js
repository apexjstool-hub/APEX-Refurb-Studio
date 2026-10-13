'use strict';
// Only explicitly recorded Pass/Fail decisions from APEX Diagnostics.
const names=Object.freeze({"display":"Display / LCD","touchscreen":"Touchscreen","keyboard":"Keyboard","pointer":"Touchpad","audio":"Speakers","microphone":"Microphone","camera":"Webcam","wifi":"Wi-Fi","bluetooth":"Bluetooth","battery":"Battery","physical":"Ports / connections","system":"Storage / internal hardware","hardware":"Hardware checks","health":"Windows health","gauntlet":"Stability test","advanced":"Advanced diagnostics"});
const allowed=Object.keys(names);
function sanitise(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
 const output={};
 for(const id of allowed){
   const r=raw[id];const status=String(typeof r==='string'?r:r?.status??'').toLowerCase();
   if(status==='pass'||status==='fail')output[id]={status,source:'APEX Diagnostics'};
 }
 return output;
}
module.exports={names,allowed,sanitise};
