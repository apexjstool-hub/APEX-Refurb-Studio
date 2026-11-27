'use strict';
(function(root,factory){const policy=factory();if(typeof module==='object'&&module.exports)module.exports=policy;else root.ApexMessageNoticePreferences=policy;})(typeof window!=='undefined'?window:globalThis,function(){
 const defaults=Object.freeze({enabled:true,mode:'timed',seconds:12,repeatMinutes:0,senders:true,shake:true,atSignIn:true});
 const seconds=[5,10,12,15,20,30,60,120],intervals=[0,1,5,10,15,30,60],modes=['timed','manual','read'];
 const key='apex.connect.message-popups.v2';
 function normalize(raw={}){raw=raw&&typeof raw==='object'?raw:{};return {enabled:typeof raw.enabled==='boolean'?raw.enabled:defaults.enabled,mode:modes.includes(raw.mode)?raw.mode:defaults.mode,seconds:seconds.includes(raw.seconds)?raw.seconds:defaults.seconds,repeatMinutes:intervals.includes(raw.repeatMinutes)?raw.repeatMinutes:defaults.repeatMinutes,senders:typeof raw.senders==='boolean'?raw.senders:defaults.senders,shake:typeof raw.shake==='boolean'?raw.shake:defaults.shake,atSignIn:typeof raw.atSignIn==='boolean'?raw.atSignIn:defaults.atSignIn};}
 function read(storage){try{const raw=storage.getItem(key);if(raw)return normalize(JSON.parse(raw));return normalize({enabled:storage.getItem('apex.connect.message-popups.v1')!=='off'});}catch{return normalize();}}
 function delay(p){return p.mode==='timed'?p.seconds*1000:null;}
 function repeatDue(p,closedAt,now){return p.enabled&&p.repeatMinutes>0&&Number.isFinite(closedAt)&&now-closedAt>=p.repeatMinutes*60000;}
 return Object.freeze({defaults,seconds,intervals,modes,key,normalize,read,delay,repeatDue});
});