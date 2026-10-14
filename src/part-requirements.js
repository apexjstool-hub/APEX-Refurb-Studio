'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexPartRequirements=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const nameKey=name=>String(name||'').trim().replace(/\s+/g,' ').toLowerCase();
 const imported=p=>!!p&&typeof p.sourceKey==='string'&&(p.sourceKey.includes('|')||p.sourceKey.startsWith('refurbflow:'));
 function duplicates(job,orders){
  if(!job||['Completed','On Hold'].includes(job.status))return [];
  const linked=new Set((orders||[]).flatMap(o=>o.lines||[]).filter(l=>l.assetId===job.assetId).map(l=>l.partId));const groups=new Map();
  for(const p of job.parts||[]){if(!imported(p))continue;const key=nameKey(p.name)+'|'+p.qty;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
  const output=[];
  for(const parts of groups.values()){
   if(parts.length<2)continue;
   const protectedPart=p=>p.received>0||p.fitted>0||linked.has(p.id)||!!p.notes||!!p.repairNote||!!p.lastProgressAt;
   const keeper=parts.find(protectedPart)||parts[0];
   for(const p of parts)if(p.id!==keeper.id&&!protectedPart(p))output.push({keepId:keeper.id,removeId:p.id,name:p.name,qty:p.qty});
  }
  return output;
 }
 return {nameKey,imported,duplicates};
});
