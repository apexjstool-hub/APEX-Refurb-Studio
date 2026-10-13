'use strict';
/** Receive RefurbFlow records without touching inventory operator-managed fields. */
const core=require('./inventory-core');
const clip=(v,max)=>String(v??'').trim().slice(0,max);
const array=(v,n=80)=>Array.isArray(v)?v.slice(0,n):[];
const safeParts=p=>array(p,90).map(x=>clip(x,200)).filter(Boolean);
const safeRepairs=p=>array(p,90).filter(x=>x&&typeof x==='object').map(x=>({name:clip(x.name,180),quantity:Math.min(999,Math.max(1,parseInt(x.quantity,10)||1))})).filter(x=>x.name);
const asTime=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0&&n<Date.now()+86400000?n:Date.now();};
function importRefurb(items,payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return {ok:false,error:'Invalid refurbishment payload.'};
 const id=clip(payload.assetId||payload.assetTag,80).toUpperCase();
 const model=clip(payload.model,140),serial=clip(payload.serial||payload.serialNumber,90);
 const batchId=clip(payload.batchId,130),jobId=clip(payload.jobId,130);
 if(!id||!batchId||!jobId)return {ok:false,error:'Asset ID, batch ID and job ID are required.'};
 const key=`${batchId}:${jobId}`;
 let item=items.find(x=>x.id===id);
 if(item&&item.serial&&serial&&item.serial.toLowerCase()!==serial.toLowerCase())return {ok:false,error:'Asset ID already belongs to a different serial. Resolve manually.'};
 if(!item&&!model)return {ok:false,error:'A model is required when first creating an asset.'};
 const record={source:payload.source==='RefurbFlow Android'?'RefurbFlow Android':'RefurbFlow Office Receiver',key,batchId,jobId,
  sourceUpdatedAt:asTime(payload.updatedAt),receivedAt:new Date().toISOString(),
  notes:clip(payload.notes,4500),status:clip(payload.refurbStatus||payload.status,100),
  cosmeticIssues:clip(payload.cosmeticIssues,4500),functionalityResults:clip(payload.functionalityResults,4500),
  parts:safeParts(payload.parts),repairs:safeRepairs(payload.repairs)};
 if(!record.repairs.length&&record.parts.length)record.repairs=record.parts.map(x=>({name:x,quantity:1}));
 const prevReports=Array.isArray(item?.refurbishment?.reports)?item.refurbishment.reports:[];
 const prev=prevReports.find(r=>r.key===key);
 // Stale phone/receiver copies must not replace fresher updates.
 if(prev&&record.sourceUpdatedAt<Number(prev.sourceUpdatedAt||0))return {ok:true,action:'ignored',item,reason:'Older refurbishment report.'};
 if(prev){
  const comparable=r=>JSON.stringify([r.notes,r.status,r.cosmeticIssues,r.functionalityResults,r.parts,r.repairs]);
  if(comparable(prev)===comparable(record))return {ok:true,action:'unchanged',item};
 }
 if(!item){
  item=core.normalize({id,manufacturer:clip(payload.manufacturer,90),model,serial,productType:'Laptop',
   location:'Inspection',condition:'Not assessed',status:'Awaiting Processing'});
  item.history=[{type:'RefurbFlow',detail:'Asset created from RefurbFlow receiver',at:new Date().toISOString()}];
  items.unshift(item);
 }else{
  // Hardware data and operator-assigned status/location/condition remain untouched.
  if(!item.serial&&serial)item.serial=serial;
  if(!item.manufacturer&&payload.manufacturer)item.manufacturer=clip(payload.manufacturer,90);
  if(!item.model&&model)item.model=model;
 }
 const reports=prevReports.filter(r=>r.key!==key).concat([record]).sort((a,b)=>a.sourceUpdatedAt-b.sourceUpdatedAt).slice(-30);
 const latest=reports[reports.length-1];
 item.refurbishment={source:'RefurbFlow',latestKey:latest.key,updatedAt:latest.receivedAt,status:latest.status,
   notes:latest.notes,cosmeticIssues:latest.cosmeticIssues,functionalityResults:latest.functionalityResults,
   parts:latest.parts,repairs:latest.repairs,reports};
 item.updatedAt=new Date().toISOString();
 item.history=[...(item.history||[]),{type:'RefurbFlow',detail:`Refurbishment report ${prev?'updated':'received'} · ${record.status||'Unspecified status'}`,at:item.updatedAt}].slice(-120);
 return {ok:true,action:prev?'updated':prevReports.length?'added-report':'created',item};
}
module.exports={importRefurb};
