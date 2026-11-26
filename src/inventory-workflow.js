'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexInventoryWorkflow=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const n=v=>Math.max(0,Number.isFinite(Number(v))?Number(v):0);
 const isSpray=name=>/respray|re[ -]?spray|paint/i.test(String(name||''));
 function summarize(job,orders=[]){
  if(!job)return {stage:'No refurb job',next:'No refurbishment job',parts:[],required:0,ordered:0,received:0,fitted:0,toOrder:0,awaiting:0,toFit:0,needsOrdering:0,awaitingDelivery:0,key:'none'};
  const grouped=new Map();for(const o of orders)if(o.status!=='Draft')for(const l of o.lines||[])if(l.assetId===job.assetId){if(!grouped.has(l.partId))grouped.set(l.partId,[]);grouped.get(l.partId).push(l);}
  const parts=(job.parts||[]).map(p=>{const lines=grouped.get(p.id)||[];const required=n(p.qty),received=n(p.received),fitted=n(p.fitted),ordered=lines.reduce((a,l)=>a+n(l.qty),0),awaiting=lines.reduce((a,l)=>a+Math.max(0,n(l.qty)-n(l.received)),0);return {...p,required,received,fitted,ordered,awaiting,toOrder:Math.max(0,required-received-awaiting),toFit:Math.max(0,received-fitted)};});
  const totals=Object.fromEntries(['required','ordered','received','fitted','toOrder','awaiting','toFit'].map(k=>[k,parts.reduce((a,p)=>a+p[k],0)]));
  const replacements=parts.filter(p=>!isSpray(p.name)),sprays=parts.filter(p=>isSpray(p.name));
  const sum=(rows,key)=>rows.reduce((total,p)=>total+p[key],0);
  const sprayNeeded=sum(sprays,'toOrder'),sprayAwaiting=sum(sprays,'awaiting'),sprayReady=sum(sprays,'toFit');
  const needsOrdering=job.partsBoard==='ordered'?0:sum(replacements,'toOrder');
  const awaitingDelivery=sum(replacements,'awaiting')+(job.partsBoard==='ordered'?sum(replacements,'toOrder'):0);
  const replacementToFit=sum(replacements,'toFit');
  const sprayOutstanding=sprays.some(p=>p.fitted<p.required);
  let key='qc',next='Review QC and finish job';
  if(job.status==='Completed'){key='completed';next='Completed';}
  else if(job.status==='On Hold'){key='hold';next='Resolve hold';}
  else if(needsOrdering){key='order';next='Order '+needsOrdering+' replacement unit(s)';}
  else if(awaitingDelivery){key='delivery';next='Receive '+awaitingDelivery+' replacement unit(s)';}
  else if(sprayOutstanding){key='respray';next=sprayAwaiting?'Awaiting respray return':sprayReady?'Complete respray work':'Arrange respray';}
  else if(replacementToFit){key='fit';next='Fit '+replacementToFit+' replacement unit(s)';}
  if(['order','delivery'].includes(key)&&sprayOutstanding)next+='; respray outstanding';
  const stages={order:'Needs ordering',delivery:'Parts ordered',respray:'Awaiting Respray',fit:totals.fitted?'Repair in progress':'Ready to fit',qc:'Awaiting QC',completed:'Completed',hold:'On Hold'};
  return {...totals,needsOrdering,awaitingDelivery,sprayNeeded,sprayAwaiting,sprayReady,sprayOutstanding,parts,stage:stages[key],next,key,technician:job.technician||'Unassigned',recordedStage:job.status||'Received',manualBoard:job.partsBoard||''};
 }
 function latest(job,audit=[]){const events=audit.filter(e=>(e.assetId||e.AssetID)===job?.assetId).map(e=>({at:e.at||e.time,by:e.by||'',text:e.type||e.detail||'Activity'}));for(const p of job?.parts||[]){if(p.lastProgressAt)events.push({at:p.lastProgressAt,by:p.lastProgressBy||'',text:'Repair progress'});if(p.lastReceivedAt)events.push({at:p.lastReceivedAt,by:p.lastReceivedBy||'',text:'Parts received'});}return events.filter(e=>Number.isFinite(Date.parse(e.at))).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0]||null;}
 function index(workflow){
  const grouped=new Map();
  for(const order of workflow.orders||[])if(order.status!=='Draft')for(const l of order.lines||[]){
   if(!grouped.has(l.assetId))grouped.set(l.assetId,[]);
   grouped.get(l.assetId).push(l);
  }
  const result=new Map(Object.entries(workflow.jobs||{}).map(([id,j])=>[id,summarize(j,[{status:'Ordered',lines:grouped.get(id)||[]}])]));
  // Only the exact IDs snapshotted at dispatch inherit its respray stage.
  for(const shipment of workflow.resprayPallets||[])for(const item of shipment.manifest||[]){
   const row=result.get(item.assetId);if(!row||row.resprayStatus)continue;
   if(shipment.status==='Dispatched'&&row.sprayOutstanding)row.resprayStatus='Sent for Respray';
   if(shipment.status==='Returned'&&row.sprayOutstanding)row.resprayStatus='Respray Returned';
   if(shipment.status==='Completed'&&!row.sprayOutstanding)row.resprayStatus='Respray Completed';
   if(row.key==='respray'&&row.resprayStatus&&shipment.status!=='Completed'){
    row.stage=row.resprayStatus;row.key=shipment.status==='Dispatched'?'respray-sent':'respray-returned';
    row.next=shipment.status==='Dispatched'?'Await Microdream pallet return':'Inspect and complete respray';
   }
  }
  return result;
 }
 return {summarize,latest,index};
});
