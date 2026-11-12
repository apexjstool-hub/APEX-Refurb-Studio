'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexBulkRefurbPlan=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const cosmetic=name=>/\b(?:respray|re[ -]?spray|repaint|re[ -]?paint|paint|painting)\b/i.test(String(name||'').replace(/[_–—-]/g,' '));
 function prepare(workflow,assets,rawIds,stage){
  const selected=Array.isArray(rawIds)?rawIds.map(v=>String(v??'').trim().toUpperCase()):[];
  if(!['ordered','received','fitted'].includes(stage))throw Error('Choose an available parts action.');
  if(!selected.length||selected.length>100||new Set(selected).size!==selected.length)throw Error('Choose 1–100 different laptops.');
  const state=workflow||{},jobs=state.jobs||{},orders=(state.orders||[]).filter(o=>o.status!=='Draft');
  const existing=new Set((assets||[]).filter(a=>!a.deletedAt).map(a=>String(a.id||'').toUpperCase()));
  const eligible=[],invalid=[],lines=[],fingerprint=[];
  for(const id of selected){
   const job=jobs[id],reason=[];
   if(!existing.has(id))reason.push('Asset not in inventory');
   if(!job)reason.push('No refurbishment job');
   if(job&&['Completed','On Hold'].includes(job.status))reason.push('Job is locked');
   const parts=(job?.parts||[]).filter(p=>!cosmetic(p.name));
   if(job&&!parts.length)reason.push('No replacement parts required');
   const picked=[];
   for(const part of parts){
    const qty=Number(part.qty)||0,received=Number(part.received)||0,fitted=Number(part.fitted)||0;
    const pending=orders.flatMap(o=>o.lines||[]).filter(l=>l.assetId===id&&l.partId===part.id).reduce((n,l)=>n+Math.max(0,Number(l.qty)-Number(l.received)),0);
    if(!Number.isSafeInteger(qty)||qty<1||received<0||fitted<0||fitted>received||received>qty){reason.push('Invalid part quantities');continue;}
    let amount=0;
    if(stage==='ordered')amount=Math.max(0,qty-received-pending);
    if(stage==='received'){amount=Math.max(0,qty-received);if(amount>pending)reason.push('Some replacement parts have not been ordered');}
    if(stage==='fitted'){amount=Math.max(0,qty-fitted);if(received<qty)reason.push('All replacement parts must be received first');}
    fingerprint.push([id,part.id,qty,received,fitted,pending]);
    if(amount>0)picked.push({assetId:id,partId:part.id,name:String(part.name||''),qty:amount});
   }
   if(!picked.length&&!reason.length)reason.push('Nothing outstanding for this action');
   if(reason.length)invalid.push({assetId:id,reason:[...new Set(reason)].join('; ')});
   else{eligible.push(id);lines.push(...picked);}
  }
  if(lines.length>350)throw Error('Choose a smaller batch (maximum 350 part lines).');
  return {stage,eligible,invalid,lines,signature:JSON.stringify([stage,selected,fingerprint])};
 }
 return {prepare,cosmetic};
});
