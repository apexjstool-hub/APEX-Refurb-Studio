'use strict';
const requirements=require('../src/part-requirements');
const crypto=require('node:crypto');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const clip=(x,n)=>String(x??'').trim().slice(0,n);
// Import requirements only. Cloud purchasing/fitting/QC remain authoritative.
function mergeRequirements(document,localAssets,cloudAssets,deleted){
 if(!document||typeof document.jobs!=='object'||Array.isArray(document.jobs)||!Array.isArray(document.orders)||!Array.isArray(document.audit))throw Error('Cloud refurbishment workflow is invalid.');
 const next=structuredClone(document);let changed=false,added=0,updated=0,skipped=0;
 for(const asset of localAssets){
  if(!asset.id||deleted.has(asset.id)||asset.deletedAt)continue;const remote=cloudAssets.get(asset.id);if(!remote||remote.payload?.deletedAt)continue;
  const a=clip(asset.serial,100).toLowerCase(),b=clip(remote.payload?.serial,100).toLowerCase();if(a&&b&&a!==b){skipped++;continue;}
  const ref=asset.refurbishment;if(!ref)continue;
  const reports=Array.isArray(ref.reports)&&ref.reports.length?ref.reports:[{...ref,key:ref.latestKey}];
  for(const report of reports){
   const key=clip(report.key,140);if(!key||!Array.isArray(report.repairs)||!report.repairs.length)continue;
   let job=next.jobs[asset.id];if(job&&['Completed','On Hold'].includes(job.status)){skipped++;continue;}
   const digest=hash(report.repairs);const marker=hash(key);
   if(job?.hubReportImports?.[marker]===digest)continue;
   const now=new Date().toISOString();
   if(!job){job={assetId:asset.id,status:'Inspected',technician:'',priority:'Normal',notes:'',parts:[],qc:{},createdAt:now,updatedAt:now};next.jobs[asset.id]=job;}
   if(!Array.isArray(job.parts))throw Error('Cloud job contains invalid required parts.');
   let changes=0;
   const direct=(remote.payload?.refurbflowIntake||[]).filter(e=>clip((e.report?.batchId||'')+':'+(e.report?.jobId||''),140)===key);
   for(const req of report.repairs){
    const name=clip(req.name,160),qty=Number(req.quantity||1);if(!name||!Number.isSafeInteger(qty)||qty<1||qty>999)continue;
    const sourceKey=key+'|'+name.toLowerCase();
    const directKeys=direct.map(e=>'refurbflow:'+e.eventId+':'+name);
    let part=job.parts.find(p=>p.sourceKey===sourceKey||(Array.isArray(p.hubSourceKeys)?p.hubSourceKeys:[]).includes(sourceKey)||directKeys.includes(p.sourceKey)||(requirements.imported(p)&&requirements.nameKey(p.name)===requirements.nameKey(name))); 
    if(part){
     if(part.sourceKey!==sourceKey&&!(Array.isArray(part.hubSourceKeys)?part.hubSourceKeys:[]).includes(sourceKey)){part.hubSourceKeys=[...(Array.isArray(part.hubSourceKeys)?part.hubSourceKeys:[]),sourceKey];changed=true;}
     if(qty>part.qty){part.qty=qty;updated++;changes++;}
    }else{job.parts.push({id:crypto.randomUUID(),name,qty,received:0,fitted:0,sourceKey,notes:'',createdAt:now});added++;changes++;}
   }
   job.hubReportImports={...(job.hubReportImports||{}),[marker]:digest};changed=true;
   if(changes){
    if(['Received','Inspected','Ready for Repair'].includes(job.status)&&job.parts.some(p=>p.received<p.qty))job.status='Awaiting Parts';
    job.updatedAt=now;next.audit.unshift({id:crypto.randomUUID(),at:now,type:'RefurbFlow synced',detail:'Imported '+changes+' part requirement changes from the trusted hub',assetId:asset.id,by:'RefurbFlow Hub'});next.audit=next.audit.slice(0,2500);
   }
  }
 }
 if(Object.values(next.jobs).some(job=>!Array.isArray(job.parts)||job.parts.length>1000)||Buffer.byteLength(JSON.stringify(next))>10485760)throw Error('Cloud refurbishment limit exceeded. No partial requirements were saved.');
 return {document:next,changed,added,updated,skipped};
}
async function syncRequirements({localAssets,cloudAssets,deleted,read,write}){
 for(let attempt=0;attempt<3;attempt++){
  const row=await read();if(!row||!Number.isSafeInteger(row.revision))throw Error('Cloud refurbishment workflow is not installed. Run the existing shared-refurb-workflow.sql setup.');
  const merged=mergeRequirements(row.document,localAssets,cloudAssets,deleted);if(!merged.changed)return merged;
  if(await write(row.revision,merged.document))return merged;
 }
 throw Error('Cloud refurbishment changed during sync; parts will retry next cycle.');
}
module.exports={mergeRequirements,syncRequirements};
