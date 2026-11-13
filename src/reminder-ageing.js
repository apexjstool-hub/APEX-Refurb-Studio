'use strict';
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ApexReminderAgeing=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const spray=name=>/respray|re[ -]?spray|paint/i.test(String(name||''));
 const daysSince=(value,now=Date.now())=>{
  const t=Date.parse(value);
  return Number.isFinite(t)?Math.max(0,Math.floor((now-t)/86400000)):null;
 };
 function classify(job,summary,now=Date.now()){
  if(!job||['Completed','On Hold'].includes(job.status)||!summary)return null;
  const parts=Array.isArray(summary.parts)?summary.parts:[];
  const toOrder=job.partsBoard==='ordered'?[]:parts.filter(p=>!spray(p.name)&&Number(p.toOrder)>0);
  // An unrelated job edit must never make an outstanding part appear newly needed.
  // Imported/manual requirements have their own createdAt. Missing legacy timestamps
  // fall back to the job's createdAt, not its most recent note/status update.
  const ageFrom=rows=>{
   const timestamps=rows.map(p=>p.createdAt||job.createdAt).map(t=>Date.parse(t)).filter(Number.isFinite);
   return timestamps.length?daysSince(new Date(Math.min(...timestamps)).toISOString(),now):null;
  };
  if(toOrder.length)return {type:'ordering',title:'Parts still need ordering',age:ageFrom(toOrder),count:toOrder.length,priority:0};
  const waitingDelivery=parts.filter(p=>!spray(p.name)&&Number(p.awaiting)>0);
  if(summary.awaitingDelivery>0)return {type:'delivery',title:'Waiting for parts delivery',age:daysSince(job.updatedAt||job.createdAt,now),count:waitingDelivery.length||1,priority:2};
  const resprays=parts.filter(p=>spray(p.name)&&Number(p.fitted)<Number(p.required));
  if(resprays.length)return {type:'respray',title:'Respray not completed',age:ageFrom(resprays),count:resprays.length,priority:3};
  if(summary.toFit>0||['Repair In Progress','Ready for Repair'].includes(job.status))return {type:'repair',title:'Repair work inactive',age:daysSince(job.updatedAt||job.createdAt,now),count:1,priority:4};
  return null; // No arbitrary alerts for all old stock: only actionable outstanding work.
 }
 function getAlerts(workflow,assets,summaries,settings,now=Date.now()){
  if(!settings?.enabled||!workflow)return [];
  const byAsset=new Map((assets||[]).filter(a=>!a.deletedAt).map(a=>[a.id,a]));
  const rows=[];
  for(const job of Object.values(workflow.jobs||{})){
   const asset=byAsset.get(job.assetId);
   if(!asset)continue;
   const category=classify(job,summaries?.get(job.assetId),now);
   if(!category||category.age===null)continue;
   const threshold=Number(settings[category.type])||7;
   if(category.age<threshold)continue;
   const level=category.age>=settings.critical?'critical':category.age>=settings.overdue?'overdue':'attention';
   rows.push({id:job.assetId,asset,job,age:category.age,category,level});
  }
  return rows.sort((a,b)=>a.category.priority-b.category.priority||b.age-a.age||a.id.localeCompare(b.id));
 }
 return {daysSince,classify,getAlerts};
});
