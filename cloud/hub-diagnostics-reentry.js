'use strict';
const {sanitise}=require('../src/diagnostic-tests');
const fields=['manufacturer','model','serial','processor','gpu','ram','storage','operatingSystem'];
function reportFor(asset){
 const report={assetId:asset.id};
 for(const key of fields)report[key]=String(asset[key]||'').trim().slice(0,140);
 report.tests=sanitise(asset.diagnosticTests);return report;
}
function latestReceipt(receipts,id,deletedAt,now=Date.now()){
 const deleted=Date.parse(deletedAt);if(!Number.isFinite(deleted))return null;
 return receipts.filter(r=>r.source==='Diagnostics'&&r.assetId===id&&['saved','unchanged'].includes(r.outcome)&&/^[a-f0-9-]{36}$/i.test(r.eventId||'')&&Number.isFinite(Date.parse(r.at))&&Date.parse(r.at)>deleted&&Date.parse(r.at)<=now+120000)
  .sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0]||null;
}
async function forwardDeletedDiagnostics({assets,markers,receipts,remote,state,receive,read,now=Date.now()}){
 let forwarded=0;const errors=[];
 for(const marker of markers){
  const asset=assets.find(a=>a.id===marker.id&&!a.deletedAt);if(!asset)continue;
  const receipt=latestReceipt(receipts,marker.id,marker.deleted_at,now);if(!receipt)continue;
  if(state[marker.id]?.lastHubDiagnosticEvent===receipt.eventId&&remote.has(marker.id))continue;
  try{
   const result=await receive({p_event_id:'hub-diagnostics:'+receipt.eventId,p_asset_id:marker.id,p_received_at:receipt.at,p_report:reportFor(asset)});
   if(!result?.ok)throw Error(result?.error||'Cloud did not confirm Diagnostics registration.');
   const row=await read(marker.id);if(!row?.payload||row.id!==marker.id)throw Error('Cloud accepted the report but inventory confirmation was unavailable.');
   remote.set(marker.id,row);
   state[marker.id]={lastHubDiagnosticEvent:receipt.eventId,cloudRevision:row.revision};forwarded++;
  }catch(e){errors.push({id:marker.id,message:String(e.message||e).slice(0,250)});}
 }
 return {forwarded,errors};
}
module.exports={latestReceipt,reportFor,forwardDeletedDiagnostics};
