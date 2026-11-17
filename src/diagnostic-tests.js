'use strict';
// Explicit results from APEX Laptop Diagnostics, including comments from test pages.
// Do not generate Pass/Fail outcomes from untested or automatic hardware evidence.
const names=Object.freeze({"display":"Display / LCD","touchscreen":"Touchscreen","keyboard":"Keyboard","pointer":"Touchpad","audio":"Speakers","microphone":"Microphone","camera":"Webcam","wifi":"Wi-Fi","bluetooth":"Bluetooth","battery":"Battery","physical":"Ports / connections","system":"Storage / internal hardware","hardware":"Hardware checks","health":"Windows health","gauntlet":"Stability test","advanced":"Advanced diagnostics","cosmetics":"Cosmetic inspection"});
const allowed=Object.keys(names);
function sanitise(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
 const output={};
 for(const id of allowed){
  const entry=raw[id],status=String(typeof entry==='string'?entry:entry?.status||'').toLowerCase();
  if(!['pass','fail','unsupported'].includes(status))continue;
  output[id]={status,source:'APEX Diagnostics',comment:String(typeof entry==='object'&&entry!==null?entry.comment||'':'').trim().slice(0,1200)};
 }
 return output;
}
function formatNotes(tests,{failuresOnly=false}={}){
 const normalised=sanitise(tests);
 return Object.entries(normalised).filter(([,entry])=>!failuresOnly||entry.status==='fail').map(([id,entry])=>{
  return names[id]+' — '+entry.status.toUpperCase()+(entry.comment?'\n'+entry.comment:'');
 }).join('\n\n');
}
module.exports={names,allowed,sanitise,formatNotes};
