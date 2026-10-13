'use strict';
/** Admin-reviewed identity conflicts. Restricted raw submissions never appear in list APIs. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const LIMIT=120;
const trim=(v,n=180)=>String(v??'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,n);
function read(file){
 if(!fs.existsSync(file))return [];
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!Array.isArray(data))throw Error('Conflict queue file is invalid; no records have been overwritten.');
 return data;
}
function write(file,data){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(data,null,2),{mode:0o600});fs.renameSync(temp,file);
}
function incomingId(scope,p){return trim(scope==='diagnostics'?p.id:(p.assetId||p.assetTag),80).toUpperCase();}
function incomingSerial(scope,p){return trim(scope==='diagnostics'?p.serial:(p.serial||p.serialNumber),90);}
function copyPayload(scope,p){
 // Strict allowlist of fields supported by each intake endpoint, no tokens, device keys, or unknown data.
 const out={};
 const fields=scope==='diagnostics'?['id','model','manufacturer','serial','processor','gpu','ram','storage','operatingSystem','ramType','ssdType','batteryPercentage']:
  ['assetId','assetTag','manufacturer','model','serial','serialNumber','batchId','jobId','source','updatedAt','notes','refurbStatus','status','cosmeticIssues','functionalityResults'];
 for(const key of fields)if(p[key]!==undefined){
  out[key]=key==='updatedAt'?(Number.isFinite(Number(p[key]))?Number(p[key]):Date.now()):trim(p[key],['notes','cosmeticIssues','functionalityResults'].includes(key)?4500:150);
 }
 if(scope==='diagnostics'&&p.tests&&typeof p.tests==='object'&&!Array.isArray(p.tests)){
  out.tests={}; for(const [key,v] of Object.entries(p.tests).slice(0,40))if(/^[a-zA-Z0-9_-]{1,50}$/.test(key))out.tests[key]=typeof v==='string'?trim(v,60):{status:trim(v?.status,60)};
 }
 if(scope==='refurb'){
  out.parts=Array.isArray(p.parts)?p.parts.slice(0,90).map(x=>trim(x,200)):[];
  out.repairs=Array.isArray(p.repairs)?p.repairs.slice(0,90).filter(x=>x&&typeof x==='object').map(x=>({name:trim(x.name,180),quantity:Math.max(1,Math.min(999,Number(x.quantity)||1))})):[];
 }
 return out;
}
function summary(entry){
 const {payload,...rest}=entry;
 return {...rest,hasSubmission:!!payload};
}
function list(file){return read(file).map(summary).reverse();}
function stage(file,scope,payload,existing,device=''){
 if(!existing||!['diagnostics','refurb'].includes(scope))return null;
 const id=incomingId(scope,payload),serial=incomingSerial(scope,payload);
 if(!id||!serial||!existing.serial||existing.id!==id||serial.toUpperCase()===String(existing.serial).toUpperCase())return null;
 const entries=read(file);
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify([scope,id,serial.toUpperCase(),String(existing.serial).toUpperCase(),scope==='refurb'?`${payload.batchId}:${payload.jobId}`:''])).digest('hex');
 const prior=entries.find(e=>e.fingerprint===fingerprint);
 if(prior)return summary(prior);
 const now=new Date().toISOString(),entry={id:crypto.randomUUID(),fingerprint,createdAt:now,status:'pending',scope,source:scope==='diagnostics'?'APEX Diagnostics':'RefurbFlow',device:trim(device,64),assetId:id,
  existing:{manufacturer:trim(existing.manufacturer,90),model:trim(existing.model,140),serial:trim(existing.serial,90)},
  incoming:{manufacturer:trim(payload.manufacturer,90),model:trim(payload.model,140),serial},payload:copyPayload(scope,payload),handledAt:null,decision:null};
 // Keep all unresolved conflicts; refuse rather than silently dropping unreviewed work.
 if(entries.filter(e=>e.status==='pending').length>=LIMIT)throw Error('Conflict queue is full. Ask an administrator to review pending records.');
 entries.push(entry);write(file,entries.slice(-400));return summary(entry);
}
function decide(file,id,decision,currentSerial){
 if(!['keepExisting','useIncoming'].includes(decision))return {ok:false,status:400,error:'Choose a valid resolution.'};
 const entries=read(file),entry=entries.find(e=>e.id===id);
 if(!entry)return {ok:false,status:404,error:'Conflict not found.'};
 if(entry.status!=='pending')return {ok:false,status:409,error:'This conflict has already been resolved.'};
 if(String(currentSerial||'').toUpperCase()!==entry.existing.serial.toUpperCase()){
  // If the import reached the DB before an interrupted receipt write, allow safe reconciliation.
  if(decision!=='useIncoming'||String(currentSerial||'').toUpperCase()!==entry.incoming.serial.toUpperCase())return {ok:false,status:409,error:'The current serial changed. Refresh and review this asset again.'};
 }
 return {ok:true,entry,entries,decision};
}
function mark(file,entries,entry,decision){entry.status=decision==='keepExisting'?'dismissed':'accepted';entry.handledAt=new Date().toISOString();entry.decision=decision;delete entry.payload;write(file,entries);return summary(entry);}
module.exports={read,list,stage,decide,mark,incomingId,incomingSerial,LIMIT};
