'use strict';
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./grade-projection'):root.ApexGradeProjection);if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexSmartAssistant=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Grade){
 const tabs={order:'parts',overdue:'parts',delivery:'parts',respray:'parts','respray-return':'parts',fit:'parts',qa:'parts',signoff:'parts',hold:'parts',inactive:'parts',diagnostic:'tests',missing:'overview',location:'overview'};
 function summarize(asset,state){
  if(!asset||asset.deletedAt||!asset.id)return null;
  const available=state?.available===true,actions=available?(state.rows||[]).filter(r=>String(r.id)===String(asset.id)).map(r=>({...r,tab:tabs[r.category]||'overview'})):[];
  const statuses=Object.values(asset.diagnosticTests||{}).map(v=>String(v?.status||v).toLowerCase());
  const tests={passed:statuses.filter(v=>v==='pass').length,failed:statuses.filter(v=>v==='fail').length,other:statuses.filter(v=>v!=='pass'&&v!=='fail').length};
  const raw=asset.batteryPercentage,battery=raw!==''&&raw!==null&&raw!==undefined&&Number.isFinite(Number(raw))&&Number(raw)>=0&&Number(raw)<=100?Number(raw):null;
  const projection=available&&!state.stale?Grade.project(asset,state.workflow):null;
  return {id:asset.id,available,stale:!!state?.stale,actions,tests,battery,projection,next:actions[0]||null};
 }
 return Object.freeze({summarize});
});