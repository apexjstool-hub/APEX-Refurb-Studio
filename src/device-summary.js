'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexDeviceSummary=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const num=v=>Math.max(0,Number.isFinite(Number(v))?Number(v):0);
 const respray=name=>/respray|re[ -]?spray|paint/i.test(String(name||''));
 function process(asset,workflow){
  const job=workflow?.jobs?.[asset.id];
  if(job?.status==='Completed')return {labels:['Completed'],parts:0,respray:0,known:true};
  const ref=asset.refurbishment||{},report=Array.isArray(ref.reports)?(ref.reports.find(r=>r.key===ref.latestKey)||ref.reports.at(-1)):ref;
  let requirements=job?job.parts:Array.isArray(report?.repairs)?report.repairs:Array.isArray(report?.parts)?report.parts.map(p=>typeof p==='string'?{name:p,quantity:1}:p):[];
  requirements=Array.isArray(requirements)?requirements:[];
  let parts=0,sprays=0;
  for(const p of requirements){const qty=num(p.qty??p.quantity??1),fitted=p.fitted===undefined&&p.status==='Fitted'?qty:num(p.fitted),remaining=Math.max(0,qty-fitted);if(!remaining)continue;if(respray(p.name))sprays+=remaining;else if(String(p.name||'').trim())parts+=remaining;}
  const labels=[];if(parts)labels.push('Parts fitting');if(sprays)labels.push('Respray');
  if(!labels.length)labels.push(job?(requirements.length||job.status==='Quality Control'?'Final checks / QC':'No repair tasks recorded'):workflow?'Not recorded':'Workflow loading');
  return {labels,parts,respray:sprays,known:!!job||requirements.length>0,onHold:job?.status==='On Hold'};
 }
 function grade(asset,suggestion){
  if(/^[ABCD]$/.test(String(asset.condition||'')))return {value:asset.condition,source:'Assigned grade'};
  const value=suggestion?.grade||asset.grade;
  return value&&value!=='Pending'?{value,source:'Inspection grade'}:{value:'Not assessed',source:'No grade recorded'};
 }
 return {process,grade};
});
