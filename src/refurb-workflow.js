'use strict';
/* APEX refurbishment workflow. Admin-only writes; device intake can create requirements but cannot place orders. */
const requirements=require('./part-requirements');
const {isCosmetic}=require('./repair-work-type');
const STATUSES=['Received','Inspected','Awaiting Parts','Ready for Repair','Repair In Progress','Quality Control','Completed','On Hold'];
const PART_STATUSES=['Needed','Ordered','Partially Received','Received','Fitted'];
const QC=['Visual inspection','Required parts fitted','Hardware retest','Final clean & sign-off'];
const clip=(v,n=200)=>String(v??'').trim().slice(0,n);
const stamp=()=>new Date().toISOString();
const uid=()=>require('node:crypto').randomUUID();
function reconcilePartsBoards(state){
 const candidates=new Map(Object.entries(state.jobs).filter(([,job])=>job?.partsBoard==='needed'));
 if(!candidates.size)return state;
 const movedAt=new Map();
 for(const event of state.audit){
  if(!candidates.has(event.assetId)||event.type!=='Parts board changed'||event.detail!=='Moved to Parts Needed')continue;
  const at=Date.parse(event.at);
  if(at>(movedAt.get(event.assetId)||0))movedAt.set(event.assetId,at);
 }
 const pending=new Map();
 for(const order of state.orders){
  if(order.status==='Draft')continue;
  const at=Date.parse(order.approvedAt||order.createdAt);
  for(const line of order.lines||[]){
   if(!candidates.has(line.assetId))continue;
   const quantity=Math.max(0,Number(line.qty||0)-Number(line.received||0));
   if(!quantity)continue;
   if(!pending.has(line.assetId))pending.set(line.assetId,new Map());
   const parts=pending.get(line.assetId);
   const prior=parts.get(line.partId)||{quantity:0,latest:0};
   parts.set(line.partId,{quantity:prior.quantity+quantity,latest:Math.max(prior.latest,at||0)});
  }
 }
 let jobs=state.jobs;
 for(const [id,job] of candidates){
  const cutoff=Date.parse(job.partsBoardAt)||movedAt.get(id);
  const ordered=pending.get(id);
  if(!cutoff||!ordered)continue;
  const replacement=(job.parts||[]).filter(part=>!isCosmetic(part.name)&&part.fitted<part.qty);
  if(!replacement.every(part=>Number(part.received||0)+(ordered.get(part.id)?.quantity||0)>=part.qty))continue;
  if(!replacement.some(part=>(ordered.get(part.id)?.latest||0)>cutoff))continue;
  if(jobs===state.jobs)jobs={...jobs};
  const updated={...job};
  delete updated.partsBoard;
  delete updated.partsBoardAt;
  jobs[id]=updated;
 }
 return jobs===state.jobs?state:{...state,jobs};
}
function init(raw){const s={jobs:raw?.jobs&&typeof raw.jobs==='object'&&!Array.isArray(raw.jobs)?raw.jobs:{},orders:Array.isArray(raw?.orders)?raw.orders:[],audit:Array.isArray(raw?.audit)?raw.audit:[],v3DraftsMigrated:raw?.v3DraftsMigrated===true,draftSuppressed:raw?.draftSuppressed===true,resprayPallets:Array.isArray(raw?.resprayPallets)?raw.resprayPallets:[],resprayAssignments:Array.isArray(raw?.resprayAssignments)?raw.resprayAssignments:[]};if(!s.v3DraftsMigrated){s.v3DraftsMigrated=true;}return reconcilePartsBoards(s);}
function history(s,type,detail,assetId='',by='Administrator'){
 s.audit.unshift({id:uid(),at:stamp(),type,detail:clip(detail,400),assetId:clip(assetId,80),by:clip(by,80)});s.audit=s.audit.slice(0,2500);
}
function ensure(s,id,assets){id=clip(id,80).toUpperCase();if(!assets.some(a=>a.id===id))throw Error('Register this Asset ID in Inventory first.');
 if(!s.jobs[id]){s.jobs[id]={assetId:id,status:'Received',technician:'',priority:'Normal',notes:'',parts:[],qc:{},createdAt:stamp(),updatedAt:stamp()};history(s,'Job opened','Refurbishment job created',id);}
 return s.jobs[id];}
function asQty(v,min=0){const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>9999)throw Error('Enter a valid whole-number quantity.');return n;}
function checkDate(v){const s=clip(v,12);if(s&&!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Date must be YYYY-MM-DD.');return s;}
function syncRefurb(s,asset,action){
 const ref=asset?.refurbishment;if(!ref)return false;
 const report=Array.isArray(ref.reports)?(ref.reports.find(x=>x.key===ref.latestKey)||ref.reports.at(-1)):ref;
 const parts=Array.isArray(report?.repairs)&&report.repairs.length?report.repairs:(ref.repairs||[]);
 const job=ensure(s,asset.id,[asset]);let changed=false;
 if(job.status==='Received'){job.status='Inspected';changed=true;}
 for(const request of parts){const name=clip(request.name,160);if(!name)continue;
  const source=clip(report.key||ref.latestKey,140), key=(source+'|'+name.toLowerCase());
  const existing=job.parts.find(p=>p.sourceKey===key||(p.hubSourceKeys||[]).includes(key)||(requirements.imported(p)&&requirements.nameKey(p.name)===requirements.nameKey(name)));
  if(existing&&existing.sourceKey!==key&&!(existing.hubSourceKeys||[]).includes(key))existing.hubSourceKeys=[...(existing.hubSourceKeys||[]),key];
  if(existing){const latestQty=Math.max(1,Math.min(999,Number(request.quantity)||1));if(latestQty>existing.qty){existing.qty=latestQty;changed=true;}continue;} // Never erase ordered or received quantities on an older report.
  job.parts.push({id:uid(),name,qty:Math.max(1,Math.min(999,Number(request.quantity)||1)),received:0,fitted:0,sourceKey:key,notes:'',createdAt:stamp()});changed=true;
 }
 if(changed){autoDraft(s,asset.id);if(job.parts.some(p=>p.received<p.qty)&&['Received','Inspected','Ready for Repair'].includes(job.status))job.status='Awaiting Parts';job.updatedAt=stamp();history(s,'RefurbFlow synced',`Imported ${parts.length} requirements from RefurbFlow`,asset.id);}
 return changed;
}
function autoDraft(s,assetId){
 // v3.3 is an inventory and refurbishment register, not a purchasing tool.
 // Historical orders are retained, but new automatic purchase drafts are not created.
 return null;
 if(assetId)s.draftSuppressed=false;
 if(s.draftSuppressed){s.orders=s.orders.filter(o=>!(o.status==='Draft'&&o.auto));return null;}
 // Drafts reserve no stock and never imply an actual purchase. Rebuild auto draft lines
 // idempotently from all unmet requirements after each Android inspection intake.
 let draft=s.orders.find(o=>o.status==='Draft'&&o.auto===true);
 if(!draft){draft={id:'DRAFT-AUTO',status:'Draft',auto:true,supplier:'',expectedAt:'',reference:'',cost:0,currency:'GBP',tracking:'',notes:'Automatically prepared. Choose a supplier and approve before ordering.',createdAt:stamp(),updatedAt:stamp(),lines:[]};s.orders.unshift(draft);}
 const used=new Map();
 for(const o of s.orders.filter(o=>o.status!=='Draft'))for(const l of o.lines||[]){const k=l.assetId+'|'+l.partId;used.set(k,(used.get(k)||0)+Math.max(0,l.qty-l.received));}
 const lines=[];
 for(const j of Object.values(s.jobs))for(const part of j.parts){const pending=Math.max(0,part.qty-part.received-(used.get(j.assetId+'|'+part.id)||0));if(pending)lines.push({assetId:j.assetId,partId:part.id,name:part.name,qty:pending,received:0});}
 draft.lines=lines;draft.updatedAt=stamp();
 if(!lines.length){s.orders=s.orders.filter(o=>o!==draft);return null;}
 return draft;
}
function validateCompletion(job){if(job.parts.some(p=>p.fitted<p.qty))throw Error('All required parts must be fitted before completing the job.');
 if(QC.some(k=>job.qc[k]!==true))throw Error('Complete the four QC checks before finishing this job.');}
function apply(state,assets,cmd,by='Administrator'){
 const s=init(state);try{
 if(!cmd||typeof cmd!=='object')throw Error('Invalid workflow request.');
 const type=clip(cmd.type,40),id=clip(cmd.assetId,80).toUpperCase();let job;
 if(type==='saveResprayAssignment'){
  const pallet=clip(cmd.palletName,80),key=pallet.toLowerCase();
  if(!pallet)throw Error('Choose a Microdream pallet.');
  const reference=clip(cmd.reference,80);
  if(!reference||!/^[-A-Za-z0-9/._ ]{1,80}$/.test(reference))throw Error('Enter a valid Microdream reference (letters, numbers, hyphens, spaces, /, _ or .).');
  const existing=s.resprayAssignments.find(x=>String(x.palletName||'').toLowerCase()===key);
  if((existing?.id||null)!==(cmd.expectedAssignmentId||null)||String(existing?.updatedAt||'')!==String(cmd.expectedUpdatedAt||''))throw Error('Microdream assignment changed. Refresh before saving.');
  if(s.resprayPallets.some(x=>String(x.palletName||'').toLowerCase()===key&&['Dispatched','Returned'].includes(x.status)))throw Error('This pallet has already been dispatched. Finish the existing shipment first.');
  const ids=Array.isArray(cmd.assetIds)?cmd.assetIds.map(x=>clip(x,80).toUpperCase()):[];
  if(ids.length>300||new Set(ids).size!==ids.length)throw Error('Choose up to 300 different Asset IDs.');
  for(const assetId of ids){
   const asset=assets.find(a=>a.id===assetId&&!a.deletedAt),j=s.jobs[assetId];
   if(!asset||!j||['Completed','On Hold'].includes(j.status))throw Error('Asset '+assetId+' is not available for respray.');
   if(!j.parts.some(p=>isCosmetic(p.name)&&p.fitted<p.qty))throw Error('Asset '+assetId+' has no outstanding respray.');
   const occupied=s.resprayAssignments.some(x=>String(x.palletName||'').toLowerCase()!==key&&(x.assetIds||[]).includes(assetId));
   const inTransit=s.resprayPallets.some(x=>['Dispatched','Returned'].includes(x.status)&&(x.manifest||[]).some(row=>row.assetId===assetId));
   if(occupied||inTransit)throw Error('Asset '+assetId+' is already allocated to another Microdream respray job.');
  }
  const sourcePallets=[...new Set(ids.map(assetId=>clip(assets.find(a=>a.id===assetId)?.pallet,80)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const record={id:existing?.id||uid(),palletName:pallet,reference,assetIds:ids,sourcePallets,updatedAt:stamp(),updatedBy:clip(by,80)};
  s.resprayAssignments=existing?s.resprayAssignments.map(x=>x===existing?record:x):[record,...s.resprayAssignments];
  for(const assetId of ids.filter(x=>!(existing?.assetIds||[]).includes(x)))history(s,'Assigned to Microdream',pallet+' · '+reference,assetId,by);
  for(const assetId of (existing?.assetIds||[]).filter(x=>!ids.includes(x)))history(s,'Removed from Microdream assignment',pallet+' · '+reference,assetId,by);
  history(s,'Microdream reference saved',pallet+' · '+reference,'',by);
  return {ok:true,workflow:s,assignment:record,affected:ids.length};
 }
 if(['dispatchResprayPallet','returnResprayPallet','completeResprayPallet'].includes(type)){
  const pallet=clip(cmd.palletName,80),key=pallet.toLowerCase();
  if(!pallet)throw Error('Choose a Microdream pallet.');
  const active=s.resprayPallets.find(x=>String(x.palletName||'').toLowerCase()===key&&['Dispatched','Returned'].includes(x.status));
  if(type==='dispatchResprayPallet'){
   if(active)throw Error('This pallet already has an active respray dispatch.');
   const assigned=s.resprayAssignments.find(x=>String(x.palletName||'').toLowerCase()===key);
   const manifest=[];
   // Assignments are independent of the asset's permanent inventory pallet.
   // Older pallets without assignments retain their legacy dispatch behaviour.
   const candidates=assigned?assigned.assetIds.map(assetId=>assets.find(a=>a.id===assetId&&!a.deletedAt)):assets.filter(a=>!a.deletedAt&&clip(a.pallet,80).toLowerCase()===key);
   for(const asset of candidates){
    if(!asset)throw Error('Assigned asset no longer exists. Refresh the Microdream assignment.');
    const job=s.jobs[asset.id];
    if(!job||['Completed','On Hold'].includes(job.status))throw Error('Assigned asset is not ready for respray: '+asset.id);
    const parts=job.parts.filter(p=>isCosmetic(p.name)&&p.fitted<p.qty).map(p=>({partId:p.id,qty:p.qty,name:p.name}));
    if(!parts.length&&assigned)throw Error('Asset '+asset.id+' no longer requires respray. Remove it from this assignment.');
    if(parts.length)manifest.push({assetId:asset.id,originalPallet:clip(asset.pallet,80),parts});
   }
   if(!manifest.length)throw Error('No outstanding respray jobs on this pallet.');
   if(manifest.length>300)throw Error('Maximum 300 laptops per dispatch.');
   const record={id:uid(),palletName:pallet,reference:assigned?.reference||'',status:'Dispatched',dispatchedAt:stamp(),dispatchedBy:clip(by,80),manifest};
   s.resprayPallets.unshift(record);
   if(assigned)s.resprayAssignments=s.resprayAssignments.filter(x=>x.id!==assigned.id);
   for(const item of manifest)history(s,'Sent for Respray',pallet+' · '+(record.reference||'No reference')+' · '+item.parts.length+' tasks; original pallet '+(item.originalPallet||'Unassigned'),item.assetId,by);
   return {ok:true,workflow:s,resprayPallet:record,affected:manifest.length};
  }
  if(!active||cmd.expectedDispatchId!==active.id)throw Error('Dispatch changed or not found. Refresh and scan again.');
  if(type==='returnResprayPallet'){
   if(active.status!=='Dispatched')throw Error('This box has already been returned.');
   active.status='Returned';active.returnedAt=stamp();active.returnedBy=clip(by,80);
   for(const item of active.manifest)history(s,'Respray pallet returned',pallet,item.assetId,by);
   return {ok:true,workflow:s,resprayPallet:active,affected:active.manifest.length};
  }
  if(active.status!=='Returned')throw Error('Confirm the pallet has returned first.');
  if(cmd.confirmChecked!==true)throw Error('Confirm respray inspection before completion.');
  const prepared=[];
  for(const item of active.manifest){
   const job=s.jobs[item.assetId];
   if(!job||['Completed','On Hold'].includes(job.status)||!assets.some(a=>a.id===item.assetId&&!a.deletedAt))throw Error('Dispatched asset unavailable or locked: '+item.assetId);
   for(const row of item.parts){
    const part=job.parts.find(p=>p.id===row.partId);
    if(!part||!isCosmetic(part.name)||part.qty!==row.qty||part.received>part.qty||part.fitted>part.qty)throw Error('Respray requirement changed: '+item.assetId);
    prepared.push({job,part,assetId:item.assetId});
   }
  }
  for(const {job,part,assetId} of prepared){
   let left=part.qty-part.received;
   for(const order of s.orders.filter(o=>o.status!=='Draft'))for(const line of order.lines||[]){
    if(line.assetId!==assetId||line.partId!==part.id||left<=0)continue;
    const fill=Math.min(left,Math.max(0,line.qty-line.received));line.received+=fill;left-=fill;
    if(fill)order.updatedAt=stamp();
   }
   part.received=part.qty;part.fitted=part.qty;
   part.lastReceivedAt=stamp();part.lastReceivedBy=by;
   part.lastProgressAt=stamp();part.lastProgressBy=by;job.updatedAt=stamp();
   history(s,'Respray Completed',part.name+' × '+part.qty+' · '+pallet,assetId,by);
  }
  active.status='Completed';active.completedAt=stamp();active.completedBy=clip(by,80);
  return {ok:true,workflow:s,resprayPallet:active,affected:active.manifest.length,completedTasks:prepared.length};
 }
 if(type==='confirmPartFitted'){
  const j=s.jobs[id],p=j?.parts?.find(x=>x.id===cmd.partId);
  if(!j||!p||!assets.some(a=>a.id===id&&!a.deletedAt))throw Error('Part or asset no longer exists. Refresh and retry.');
  if(isCosmetic(p.name))throw Error('Respray is separate; use the returned respray inspection action.');
  if(['Completed','On Hold'].includes(j.status))throw Error('Change the job stage before fitting parts.');
  if(p.qty!==cmd.expectedQty||p.received!==cmd.expectedReceived||p.fitted!==cmd.expectedFitted)throw Error('Part quantities changed. Refresh before confirming.');
  const qty=asQty(cmd.qty,1);if(qty>p.qty-p.fitted)throw Error('Quantity exceeds outstanding required parts.');
  const original=p.received;
  p.received=Math.max(original,p.fitted+qty);
  let remaining=p.received-original;
  for(const order of s.orders.filter(o=>o.status!=='Draft'))for(const line of order.lines||[]){
   if(line.assetId!==id||line.partId!==p.id||remaining<=0)continue;
   const applied=Math.min(remaining,Math.max(0,line.qty-line.received));line.received+=applied;remaining-=applied;if(applied)order.updatedAt=stamp();
  }
  p.fitted+=qty;p.lastReceivedAt=stamp();p.lastReceivedBy=by;p.lastProgressAt=stamp();p.lastProgressBy=by;j.updatedAt=stamp();
  history(s,'Part fitted',p.name+' × '+qty+'; receipt verified during fitting',id,by);
  return {ok:true,workflow:s};
 }
 if(type==='markPartOrdered'){
  const j=s.jobs[id],p=j?.parts?.find(p=>p.id===cmd.partId);
  if(!p||!assets.some(a=>a.id===id&&!a.deletedAt))throw Error('This part or asset no longer exists. Refresh and try again.');
  if(['Completed','On Hold'].includes(j.status))throw Error('Change this job stage before marking parts as ordered.');
  const pending=s.orders.filter(o=>o.status!=='Draft').flatMap(o=>o.lines||[]).filter(l=>l.assetId===id&&l.partId===p.id).reduce((n,l)=>n+Math.max(0,l.qty-l.received),0);
  if(cmd.expectedQty!==p.qty||cmd.expectedReceived!==p.received||cmd.expectedOnOrder!==pending)throw Error('Part quantities or orders changed. Refresh before marking as ordered.');
  const qty=p.qty-p.received-pending;
  if(qty<=0)throw Error('This part is already ordered or received.');
  return apply(s,assets,{type:'createOrder',supplier:isCosmetic(p.name)?'Respray provider not recorded':'Supplier not recorded',notes:isCosmetic(p.name)?'Respray dispatch recorded in APEX. No booking or message is sent to a provider.':'Manually marked as ordered in APEX. Records an existing order; no purchase is sent to a supplier.',lines:[{assetId:id,partId:p.id,qty}]},by);
 }
 if(type==='receiveParts'){
  const rows=Array.isArray(cmd.parts)?cmd.parts:[];
  if(!rows.length||rows.length>1000)throw Error('Choose between 1 and 1000 outstanding parts.');
  const seen=new Set(),prepared=[];
  for(const row of rows){
   const assetId=clip(row.assetId,80).toUpperCase(),key=assetId+'|'+row.partId,j=s.jobs[assetId],p=j?.parts.find(p=>p.id===row.partId);
   if(seen.has(key))throw Error('A part was selected twice. Refresh and try again.');seen.add(key);
   if(!p||!assets.some(a=>a.id===assetId&&!a.deletedAt))throw Error('A selected part or device no longer exists. Refresh and try again.');
   if(['Completed','On Hold'].includes(j.status))throw Error('A selected job is locked. Refresh before receiving parts.');
   if(p.qty!==row.expectedQty||p.received!==row.expectedReceived)throw Error('Part quantities changed. Refresh before receiving parts.');
   const onOrder=s.orders.filter(o=>o.status!=='Draft').flatMap(o=>o.lines||[]).filter(l=>l.assetId===assetId&&l.partId===p.id).reduce((n,l)=>n+Math.max(0,l.qty-l.received),0);
   if(cmd.ordersOnly&&onOrder!==row.expectedOnOrder)throw Error('Order quantities changed. Refresh before receiving deliveries.');
   const qty=cmd.ordersOnly?Math.min(p.qty-p.received,onOrder):p.qty-p.received;
   if(qty<=0||row.qty!==qty)throw Error('Only outstanding quantities can be received. Refresh and try again.');
   prepared.push({type:'receivePart',assetId,partId:p.id,expectedReceived:p.received,qty});
  }
  let next=structuredClone(s);
  for(const receipt of prepared){const result=apply(next,assets,receipt,by);if(!result.ok)throw Error(result.error);next=result.workflow;}
  return {ok:true,workflow:next};
 }
 if(type==='approveDraft'){
  const draft=s.orders.find(o=>o.id===cmd.orderId&&o.status==='Draft');if(!draft)throw Error('Draft not found.');
  const supplier=clip(cmd.supplier,120);if(!supplier)throw Error('Choose a supplier before approval.');
  if(!draft.lines.length)throw Error('No parts remain to order.');
  draft.supplier=supplier;draft.expectedAt=checkDate(cmd.expectedAt);draft.reference=clip(cmd.reference,90);draft.status='Ordered';draft.auto=false;draft.id='PO-'+Date.now().toString(36).toUpperCase();draft.updatedAt=stamp();draft.approvedAt=draft.updatedAt;
  for(const l of draft.lines){const j=s.jobs[l.assetId];if(j){if(['Inspected','Received','Ready for Repair'].includes(j.status))j.status='Awaiting Parts';j.updatedAt=stamp();history(s,isCosmetic(l.name)?'Respray sent / booked':'Part ordered',l.name+' × '+l.qty+' · '+draft.id,l.assetId,by);}}
  history(s,'Order approved','Purchase order '+draft.id+' approved for '+supplier,'',by);autoDraft(s);return {ok:true,workflow:reconcilePartsBoards(s),order:draft};
 }
 if(type==='discardDraft'){
  const draft=s.orders.find(o=>o.id===cmd.orderId&&o.status==='Draft');if(!draft)throw Error('Draft not found.');
  s.orders=s.orders.filter(o=>o!==draft);s.draftSuppressed=true;for(const assetId of new Set(draft.lines.map(l=>l.assetId)))history(s,'Draft cleared',draft.id+' draft cleared by administrator',assetId,by);return {ok:true,workflow:s};
 }
 if(type==='removePart'){
  const j=ensure(s,id,assets),p=j.parts.find(p=>p.id===cmd.partId);if(!p)throw Error('Part not found.');
  if(p.received||p.fitted||s.orders.some(o=>o.status!=='Draft'&&o.lines.some(l=>l.assetId===id&&l.partId===p.id)))throw Error('Cannot remove a part already ordered, received or fitted. Archive the job instead.');
  j.parts=j.parts.filter(x=>x!==p);j.updatedAt=stamp();history(s,'Part removed',p.name,id,by);autoDraft(s);return {ok:true,workflow:s};
 }
 if(type==='removeOrder'){
  const o=s.orders.find(o=>o.id===cmd.orderId);if(!o)throw Error('Order not found.');
  if(o.status!=='Draft')throw Error('Only unapproved drafts can be removed. Approved orders form part of your purchasing history.');
  s.orders=s.orders.filter(x=>x!==o);for(const assetId of new Set(o.lines.map(l=>l.assetId)))history(s,'Draft removed',o.id,assetId,by);return {ok:true,workflow:s};
 }
 if(type==='bulkPartsStage'){
  const plan=require('./bulk-refurb-plan').prepare(s,assets,cmd.assetIds,cmd.stage);
  if(plan.invalid.length)throw Error('Some selected laptops cannot be updated: '+plan.invalid[0].assetId+' — '+plan.invalid[0].reason);
  if(cmd.expectedSignature!==plan.signature)throw Error('Parts or purchase records have changed. Refresh the selection before saving.');
  if(!plan.lines.length)throw Error('No replacement parts need updating.');
  const supplier=clip(cmd.supplier,120);
  // All checks happen before any mutation. The caller commits this document in
  // one optimistic-concurrency transaction, not one write per asset.
  if(cmd.stage==='resprayComplete'){
   if(cmd.confirmChecked!==true)throw Error('Confirm that selected resprays have been physically inspected and completed.');
   // Explicit operator confirmation is required by the UI. The planner checks
   // the whole batch before any mutation; the workflow is saved atomically.
   // Only cosmetic work is completed, not unrelated parts or final QC.
   for(const line of plan.lines){
    const j=s.jobs[line.assetId],p=j.parts.find(x=>x.id===line.partId);
    let remaining=p.qty-p.received;
    for(const order of s.orders.filter(o=>o.status!=='Draft'))for(const orderLine of order.lines||[]){
     if(orderLine.assetId!==line.assetId||orderLine.partId!==line.partId||remaining<=0)continue;
     const fill=Math.min(remaining,Math.max(0,orderLine.qty-orderLine.received));
     if(fill){orderLine.received+=fill;remaining-=fill;order.updatedAt=stamp();}
    }
    p.received=p.qty;p.fitted=p.qty;
    p.lastReceivedAt=stamp();p.lastReceivedBy=by;
    p.lastProgressAt=stamp();p.lastProgressBy=by;
    j.updatedAt=stamp();
    history(s,'Respray Completed',p.name+' × '+p.qty+' · bulk refurbishment',line.assetId,by);
   }
   return {ok:true,workflow:s,affected:plan.eligible.length,partLines:plan.lines.length};
  }
  if(cmd.stage==='ordered'){
   const order={id:'PO-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,5).toUpperCase(),supplier,reference:clip(cmd.reference,90),notes:'Bulk parts marked as ordered by an operator. Supplier optional; no order was transmitted automatically.',status:'Ordered',expectedAt:'',cost:0,currency:'GBP',tracking:'',createdAt:stamp(),updatedAt:stamp(),lines:plan.lines.map(l=>({...l,received:0}))};
   s.orders.unshift(order);
   for(const line of plan.lines){const j=s.jobs[line.assetId];if(['Received','Inspected','Ready for Repair'].includes(j.status))j.status='Awaiting Parts';j.updatedAt=stamp();history(s,'Part ordered',line.name+' × '+line.qty+' · '+order.id,line.assetId,by);}
  }else{
   for(const line of plan.lines){
    const j=s.jobs[line.assetId],p=j.parts.find(x=>x.id===line.partId);
    if(cmd.stage==='received'){
     let remaining=line.qty;
     for(const order of s.orders.filter(o=>o.status!=='Draft'))for(const orderLine of order.lines||[]){
      if(orderLine.assetId!==line.assetId||orderLine.partId!==line.partId||remaining<=0)continue;
      const received=Math.min(remaining,Math.max(0,orderLine.qty-orderLine.received));
      orderLine.received+=received;remaining-=received;if(received)order.updatedAt=stamp();
     }
     if(remaining)throw Error('Order quantity changed for '+line.assetId);
     p.received+=line.qty;p.lastReceivedAt=stamp();p.lastReceivedBy=by;
     if(j.parts.every(x=>x.received>=x.qty)&&j.status==='Awaiting Parts')j.status='Ready for Repair';
     history(s,'Parts received',line.name+' × '+line.qty,line.assetId,by);
    }else{
     p.fitted+=line.qty;p.lastProgressAt=stamp();p.lastProgressBy=by;
     history(s,'Part fitted',line.name+' × '+line.qty,line.assetId,by);
    }
    j.updatedAt=stamp();
   }
  }
  return {ok:true,workflow:reconcilePartsBoards(s),affected:plan.eligible.length,partLines:plan.lines.length};
 }
 if(type==='bulkSetPartsBoard'){
  s.jobs={...s.jobs};s.audit=[...s.audit];
  if(!['needed','ordered'].includes(cmd.board))throw Error('Choose Parts Needed or Parts Ordered.');
  if(!Array.isArray(cmd.assetIds)||!cmd.assetIds.length)throw Error('Select at least one laptop.');
  const ids=[...new Set(cmd.assetIds.map(x=>clip(x,80).toUpperCase()))];
  const jobs=ids.map(assetId=>{
   if(!s.jobs[assetId]||!assets.some(a=>a.id===assetId))throw Error('A selected laptop no longer exists. Refresh and try again.');
   const j=s.jobs[assetId];
   if(!(j.parts||[]).some(p=>p.fitted<p.qty))throw Error('A selected laptop has no outstanding parts. Refresh and try again.');
   s.jobs[assetId]={...j};return s.jobs[assetId];
  });
  for(const j of jobs){
   j.partsBoard=cmd.board;j.updatedAt=stamp();j.partsBoardAt=j.updatedAt;
   history(s,'Parts board changed',cmd.board==='ordered'?'Moved to Parts Ordered':'Moved to Parts Needed',j.assetId,by);
  }
  return {ok:true,workflow:s};
 }
 if(type==='setPartsBoard'){
  if(!['needed','ordered'].includes(cmd.board))throw Error('Choose Parts Needed or Parts Ordered.');
  const j=ensure(s,id,assets);
  if(!(j.parts||[]).some(p=>p.fitted<p.qty))throw Error('This laptop has no outstanding parts.');
  j.partsBoard=cmd.board;j.updatedAt=stamp();j.partsBoardAt=j.updatedAt;
  history(s,'Parts board changed',cmd.board==='ordered'?'Moved to Parts Ordered':'Moved to Parts Needed',id,by);
  return {ok:true,workflow:s};
 }
 if(type==='completeForQA'){
  // One expressly authorised final sign-off, rather than treating moving a
  // storage location as evidence that diagnostic tests passed. This action
  // updates the canonical repair, cosmetic and QC workflow together.
  if(cmd.confirmPhysicalWork!==true||cmd.confirmFinalQC!==true)
   throw Error('Confirm that every repair, respray and QC check was physically completed before finalising.');
  const asset=assets.find(a=>a.id===id&&!a.deletedAt);
  if(!asset)throw Error('Asset not found in active Inventory. Refresh and scan again.');
  const existing=s.jobs[id];
  if(clip(cmd.expectedUpdatedAt,80)!==clip(existing?.updatedAt,80))
   throw Error('This refurbishment job changed since it was scanned. Refresh and review it again.');
  if(existing?.status==='On Hold')throw Error('This job is on hold. Resolve the hold before completing it.');
  const failed=Object.entries(asset.diagnosticTests||{}).filter(([,test])=>String(test?.status||test).toLowerCase()==='fail').map(([name])=>name);
  if(failed.length)throw Error('Cannot approve final QA with failed synced diagnostics: '+failed.join(', ')+'. Retest and Sync the device first.');
  // Validate every part before changes. Retain original supplier/order history.
  const parts=Array.isArray(existing?.parts)?existing.parts:[];
  for(const p of parts){
   const q=Number(p.qty),received=Number(p.received),fitted=Number(p.fitted);
   if(!Number.isSafeInteger(q)||q<1||q>9999||!Number.isSafeInteger(received)||received<0||received>q||!Number.isSafeInteger(fitted)||fitted<0||fitted>received)
    throw Error('Invalid recorded repair quantities. Review '+clip(p.name,80)+' before QA sign-off.');
  }
  job=ensure(s,id,assets);
  if(job.status==='Completed'&&job.parts.every(p=>p.fitted>=p.qty)&&QC.every(k=>job.qc?.[k]===true))
   return {ok:true,workflow:s,alreadyCompleted:true};
  const time=stamp(),actor=clip(by,80)||'Administrator',changed=[];
  for(const p of job.parts){
   if(p.fitted>=p.qty)continue;
   const outstanding=p.qty-p.fitted;
   // This is an explicit human-attested finalisation, not a purchase order.
   // Do NOT fabricate supplier deliveries or modify order-line receipt totals.
   p.received=p.qty;p.fitted=p.qty;
   p.lastReceivedAt=time;p.lastReceivedBy=actor;p.lastProgressAt=time;p.lastProgressBy=actor;
   changed.push(clip(p.name,80)+' × '+outstanding);
   history(s,isCosmetic(p.name)?'Respray completed at final QA':'Repair completed at final QA',
    clip(p.name,100)+' × '+outstanding+' · operator attested completion (not supplier receipt)',id,by);
  }
  job.qc=job.qc&&typeof job.qc==='object'?job.qc:{};
  for(const check of QC){job.qc[check]=true;}
  job.status='Completed';job.updatedAt=time;
  history(s,'Completed QA sign-off','All four QC checks confirmed by operator; refurbishment completed; '+changed.length+' outstanding repair/respray requirements operator-attested. Synced diagnostics unchanged.',id,by);
  return {ok:true,workflow:s,completedQA:true,changedRequirements:changed.length};
 }
 if(type==='bulkJob'){
  const ids=Array.isArray(cmd.assetIds)?[...new Set(cmd.assetIds.map(x=>clip(x,80).toUpperCase()))]:[];
  if(!ids.length||ids.length>150)throw Error('Select between 1 and 150 refurbishment jobs.');
  const status=clip(cmd.status,50);if(!STATUSES.includes(status))throw Error('Choose a valid refurbishment stage.');
  const jobs=ids.map(assetId=>ensure(s,assetId,assets));
  if(status==='Completed')jobs.forEach(validateCompletion);
  for(const j of jobs){j.status=status;j.updatedAt=stamp();history(s,'Batch job update',`Stage changed to ${status}`,j.assetId,by);}
  return {ok:true,workflow:s};
 }
 if(!['createOrder','receiveOrder','orderTracking'].includes(type))job=ensure(s,id,assets);
 if(type==='job'){
  const status=clip(cmd.status,50);if(!STATUSES.includes(status))throw Error('Choose a valid refurbishment stage.');
  if(status==='Completed')validateCompletion(job);
  job.status=status;job.technician=clip(cmd.technician,90);job.notes=clip(cmd.notes,2500);job.priority=['Low','Normal','High','Urgent'].includes(cmd.priority)?cmd.priority:'Normal';
  history(s,'Job updated',`Stage ${status}; technician ${job.technician||'Unassigned'}; priority ${job.priority}; repair notes ${job.notes||'empty'}`,id,by);
 }else if(type==='addPart'){
  const name=clip(cmd.name,160);if(!name)throw Error('Part name is required.');
  const qty=asQty(cmd.qty,1);job.parts.push({id:uid(),name,qty,received:0,fitted:0,sourceKey:'',notes:clip(cmd.notes,200),createdAt:stamp()});
  if(job.status==='Received'||job.status==='Inspected'||job.status==='Ready for Repair')job.status='Awaiting Parts';
  history(s,'Part required',`${name} × ${qty}`,id,by);
 }else if(type==='receivePart'){
  if(['Completed','On Hold'].includes(job.status))throw Error('Change this job stage before receiving parts.');
  const p=job.parts.find(x=>x.id===cmd.partId);if(!p)throw Error('Part not found.');
  if(cmd.expectedReceived!==p.received)throw Error('Received quantity changed. Refresh before recording another receipt.');
  if(cmd.cosmeticEvent==='return'){const sent=s.orders.filter(o=>o.status!=='Draft').flatMap(o=>o.lines||[]).filter(l=>l.assetId===id&&l.partId===p.id).reduce((n,l)=>n+Math.max(0,l.qty-l.received),0);if(!isCosmetic(p.name)||Number(cmd.qty)>sent)throw Error('Only respray work already sent or booked can be returned. Refresh and try again.');}
  const qty=asQty(cmd.qty,1);if(p.received+qty>p.qty)throw Error('Cannot receive more than the required quantity.');
  let remaining=qty;
  for(const order of s.orders.filter(o=>o.status!=='Draft'))for(const line of order.lines||[]){
   if(line.assetId!==id||line.partId!==p.id||remaining<=0)continue;
   const amount=Math.min(remaining,Math.max(0,line.qty-line.received));if(!amount)continue;
   line.received+=amount;remaining-=amount;order.updatedAt=stamp();
  }
  p.received+=qty;p.lastReceivedAt=stamp();p.lastReceivedBy=by;
  if(job.parts.every(x=>x.received>=x.qty)&&job.status==='Awaiting Parts')job.status='Ready for Repair';
  history(s,isCosmetic(p.name)?'Respray returned':'Parts received',`${p.name} × ${qty}; received ${p.received}/${p.qty}`+(remaining?' · direct receipt':' · linked order updated'),id,by);
 }else if(type==='removeDuplicateParts'){
  const available=requirements.duplicates(job,s.orders),chosen=Array.isArray(cmd.partIds)?cmd.partIds:[];
  if(!chosen.length||new Set(chosen).size!==chosen.length||chosen.length>1000)throw Error('Select duplicate requirements to remove.');
  const rows=chosen.map(partId=>available.find(x=>x.removeId===partId));if(rows.some(x=>!x))throw Error('These duplicates changed or have recorded work. Refresh and review again.');
  for(const row of rows){const keep=job.parts.find(p=>p.id===row.keepId),removed=job.parts.find(p=>p.id===row.removeId);keep.hubSourceKeys=[...new Set([...(keep.hubSourceKeys||[]),removed.sourceKey,...(removed.hubSourceKeys||[])])];}
  const removed=new Set(chosen);job.parts=job.parts.filter(p=>!removed.has(p.id));
  history(s,'Duplicate requirements reviewed',`Removed ${chosen.length} unused imported duplicates; original requirements and progress retained`,id,by);
 }else if(type==='undoFittedPart'){
  if(['Completed','On Hold'].includes(job.status))throw Error('Reopen this job before correcting fitted parts.');
  const p=job.parts.find(x=>x.id===cmd.partId);
  if(!p)throw Error('Part not found. Refresh the device before correcting fitting.');
  if(isCosmetic(p.name))throw Error('Use the respray workflow to correct cosmetic work, not Undo Fitted.');
  const current=Number(p.fitted),received=Number(p.received);
  if(!Number.isSafeInteger(current)||current<=0||!Number.isSafeInteger(received)||received<current)throw Error('This part has no valid fitted quantity to reverse.');
  if(cmd.expectedFitted!==current||cmd.expectedReceived!==received)throw Error('The fitted quantity changed. Refresh the device before undoing it.');
  const quantity=asQty(cmd.qty,1);
  if(quantity>current)throw Error('Cannot undo more units than are fitted.');
  const note=clip(cmd.reason,200);
  if(!note)throw Error('Enter the reason for this fitting correction.');
  p.fitted=current-quantity;
  p.lastProgressAt=stamp();p.lastProgressBy=by;
  if(job.qc?.['Required parts fitted']===true){
   job.qc['Required parts fitted']=false;
   history(s,'Quality control reset','Required parts fitted check reset after fitted quantity correction',id,by);
  }
  if(job.status==='Quality Control')job.status='Repair In Progress';
  history(s,'Part fitted reversed',p.name+' × '+quantity+' · '+current+' → '+p.fitted+' fitted; '+note,id,by);
 }else if(type==='fitPart'){
  const p=job.parts.find(x=>x.id===cmd.partId);if(!p)throw Error('Part not found.');if(cmd.cosmeticEvent==='check'&&(!isCosmetic(p.name)||['Completed','On Hold'].includes(job.status)))throw Error('This cosmetic work is locked or no longer available.');if(cmd.cosmeticEvent==='check'&&(cmd.expectedFitted!==p.fitted||cmd.expectedReceived!==p.received))throw Error('Cosmetic progress changed. Refresh before checking this work again.');const qty=asQty(cmd.qty,1);
  if(qty+p.fitted>p.received)throw Error('Cannot fit more parts than have been received.');p.fitted+=qty;
  history(s,isCosmetic(p.name)?'Respray checked':'Part fitted',`${p.name} × ${qty}`,id,by);
 }else if(type==='qc'){
  if(!QC.includes(cmd.check))throw Error('Unknown QC check.');job.qc[cmd.check]=cmd.passed===true;
  history(s,'Quality control',`${cmd.check}: ${cmd.passed===true?'Passed':'Not complete'}`,id,by);
 }else if(type==='createOrder'){
  const supplier=clip(cmd.supplier,120);if(!supplier)throw Error('Supplier is required.');
  const lines=Array.isArray(cmd.lines)?cmd.lines:[];if(!lines.length||lines.length>100)throw Error('Select at least one part.');
  const picked=[];
  for(const line of lines){const j=ensure(s,line.assetId,assets),p=j.parts.find(x=>x.id===line.partId);if(!p)throw Error('A selected part no longer exists.');
   const qty=asQty(line.qty,1),onOrder=s.orders.filter(o=>o.status!=='Draft').flatMap(o=>o.lines).filter(x=>x.assetId===j.assetId&&x.partId===p.id).reduce((sum,x)=>sum+(x.qty-x.received),0);
   if(qty>p.qty-p.received-onOrder)throw Error(`Too many ${p.name} requested; check outstanding quantities.`);
   picked.push({assetId:j.assetId,partId:p.id,name:p.name,qty,received:0});
  }
  const order={id:'PO-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,5).toUpperCase(),supplier,expectedAt:checkDate(cmd.expectedAt),reference:clip(cmd.reference,90),cost:Math.max(0,Math.min(1e7,Number(cmd.cost)||0)),currency:'GBP',tracking:clip(cmd.tracking,120),notes:clip(cmd.notes,1000),createdAt:stamp(),updatedAt:stamp(),lines:picked};
  s.orders.unshift(order);for(const l of picked){const j=s.jobs[l.assetId];if(['Received','Inspected','Ready for Repair'].includes(j.status))j.status='Awaiting Parts';j.updatedAt=stamp();history(s,isCosmetic(l.name)?'Respray sent / booked':'Part ordered',`${l.name} × ${l.qty} · ${order.id}`,l.assetId,by);}history(s,'Purchase order',`${order.id} · ${supplier}`);
  return {ok:true,workflow:reconcilePartsBoards(s),order};
 }else if(type==='receiveOrder'){
  const order=s.orders.find(x=>x.id===cmd.orderId);if(!order)throw Error('Purchase order not found.');
  const line=order.lines.find(x=>x.assetId===id&&x.partId===cmd.partId);if(!line)throw Error('Purchase order line not found.');
  const qty=asQty(cmd.qty,1);if(line.received+qty>line.qty)throw Error('Cannot receive more than was ordered.');
  const j=ensure(s,id,assets),p=j.parts.find(x=>x.id===cmd.partId);if(!p)throw Error('Part requirement missing.');
  line.received+=qty;p.received+=qty;order.updatedAt=stamp();
  if(j.parts.every(x=>x.received>=x.qty)&&j.status==='Awaiting Parts')j.status='Ready for Repair';
  history(s,isCosmetic(p.name)?'Respray returned':'Delivery received',`${p.name} × ${qty} · ${order.id}`,id,by);
 }else if(type==='orderTracking'){
  const o=s.orders.find(x=>x.id===cmd.orderId);if(!o)throw Error('Order not found.');o.tracking=clip(cmd.tracking,120);o.expectedAt=checkDate(cmd.expectedAt);o.updatedAt=stamp();for(const assetId of new Set(o.lines.map(l=>l.assetId)))history(s,'Order updated',`${o.id} · tracking ${o.tracking||'not set'} · expected ${o.expectedAt||'not set'}`,assetId,by);
 }else throw Error('Unknown workflow action.');
 if(job)job.updatedAt=stamp();if(['addPart','receiveOrder'].includes(type))autoDraft(s);return {ok:true,workflow:s};
 }catch(e){return {ok:false,error:e.message};}
}
function outstanding(state){const s=init(state);const output=[];
 for(const j of Object.values(s.jobs))for(const p of j.parts){const ordered=s.orders.filter(o=>o.status!=='Draft').flatMap(o=>o.lines).filter(l=>l.assetId===j.assetId&&l.partId===p.id).reduce((n,l)=>n+l.qty-l.received,0);output.push({...p,assetId:j.assetId,toOrder:Math.max(0,p.qty-p.received-ordered),onOrder:ordered});}
 return output;
}
module.exports={init,ensure,syncRefurb,apply,outstanding,autoDraft,STATUSES,PART_STATUSES,QC};

