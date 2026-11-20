'use strict';
/* Client-side policy for update notifications, no automatic restarts. */
(function(root,build){
 const policy=build();
 if(typeof module==='object'&&module.exports)module.exports=policy;
 if(root)root.ApexUpdateNoticePolicy=policy;
})(typeof window!=='undefined'?window:null,function(){
 const validVersion=v=>typeof v==='string'&&/^[0-9]+\.[0-9]+\.[0-9]+(?:[-.][0-9A-Za-z.-]+)?$/.test(v)&&v.length<70;
 const timestamp=t=>Number.isFinite(Number(t))&&Number(t)>0&&Number(t)<8640000000000000?Number(t):0;
 function normalized(value){
  if(!value||typeof value!=='object')return {version:null,remindAt:0,scheduledAt:0,dismissed:false};
  return {version:validVersion(value.version)?value.version:null,
   remindAt:timestamp(value.remindAt),scheduledAt:timestamp(value.scheduledAt),dismissed:value.dismissed===true};
 }
 function eligible(state,stored,now=Date.now()){
  if(!state||!['available','ready'].includes(state.state)||!validVersion(state.availableVersion))return false;
  const setting=normalized(stored);
  if(setting.version!==state.availableVersion)return true;
  if(setting.dismissed)return false;
  const due=setting.scheduledAt||setting.remindAt;
  return !due||now>=due;
 }
 function choice(version,action,now=Date.now(),scheduledAt=0){
  if(!validVersion(version))throw new Error('Cannot schedule an unknown update.');
  if(action==='later')return {version,remindAt:now+24*60*60*1000,scheduledAt:0,dismissed:false};
  if(action==='schedule'){
   const future=timestamp(scheduledAt);
   if(future<=now+60*1000||future>now+90*24*60*60*1000)throw new Error('Choose a time between 2 minutes and 90 days ahead.');
   return {version,remindAt:0,scheduledAt:future,dismissed:false};
  }
  if(action==='dismiss')return {version,remindAt:0,scheduledAt:0,dismissed:true};
  if(action==='now')return {version,remindAt:0,scheduledAt:0,dismissed:false};
  throw new Error('Unknown update reminder action.');
 }
 return Object.freeze({normalized,eligible,choice});
});
