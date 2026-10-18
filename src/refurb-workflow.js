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
function init(raw){const s={jobs:raw?.jobs&&typeof raw.jobs==='object'&&!Array.isArray(raw.jobs)?raw.jobs:{},orders:Array.isArray(raw?.orders)?raw.orders:[],audit:Array.isArray(raw?.audit)?raw.audit:[],v3DraftsMigrated:raw?.v3DraftsMigrated===true,draftSuppressed:raw?.draftSuppressed===true};if(!s.v3DraftsMigrated){s.v3DraftsMigrated=true;}return s;}
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
  draft.supplier=supplier;draft.expectedAt=checkDate(cmd.expectedAt);draft.reference=clip(cmd.reference,90);draft.status='Ordered';draft.auto=false;draft.id='PO-'+Date.now().toString(36).toUpperCase();draft.updatedAt=stamp();
  for(const l of draft.lines){const j=s.jobs[l.assetId];if(j){if(['Inspected','Received','Ready for Repair'].includes(j.status))j.status='Awaiting Parts';j.updatedAt=stamp();history(s,isCosmetic(l.name)?'Respray sent / booked':'Part ordered',l.name+' × '+l.qty+' · '+draft.id,l.assetId,by);}}
  history(s,'Order approved','Purchase order '+draft.id+' approved for '+supplier,'',by);autoDraft(s);return {ok:true,workflow:s,order:draft};
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
   j.partsBoard=cmd.board;j.updatedAt=stamp();
   history(s,'Parts board changed',cmd.board==='ordered'?'Moved to Parts Ordered':'Moved to Parts Needed',j.assetId,by);
  }
  return {ok:true,workflow:s};
 }
 if(type==='setPartsBoard'){
  if(!['needed','ordered'].includes(cmd.board))throw Error('Choose Parts Needed or Parts Ordered.');
  const j=ensure(s,id,assets);
  if(!(j.parts||[]).some(p=>p.fitted<p.qty))throw Error('This laptop has no outstanding parts.');
  j.partsBoard=cmd.board;j.updatedAt=stamp();
  history(s,'Parts board changed',cmd.board==='ordered'?'Moved to Parts Ordered':'Moved to Parts Needed',id,by);
  return {ok:true,workflow:s};
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
  return {ok:true,workflow:s,order};
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

