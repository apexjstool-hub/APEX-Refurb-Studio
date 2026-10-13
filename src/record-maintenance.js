'use strict';
/** Admin-only mutations; keep device intake deliberately write-only and separate. */
const workflow=require('./refurb-workflow');
const stamp=()=>new Date().toISOString();
const clean=v=>String(v||'').trim().toUpperCase();
function detach(state,id){
 const s=state;const job=s.jobs[id]?structuredClone(s.jobs[id]):null;
 const orders=[];
 for(const o of [...s.orders]){
  const lines=(o.lines||[]).filter(l=>l.assetId===id);
  if(!lines.length)continue;
  orders.push({order:structuredClone(o),lines:structuredClone(lines)});
  o.lines=o.lines.filter(l=>l.assetId!==id);
 }
 delete s.jobs[id];s.orders=s.orders.filter(o=>(o.lines||[]).length);
 workflow.autoDraft(s);
 s.audit.unshift({id:require('node:crypto').randomUUID(),type:'Data removed',at:stamp(),assetId:id,detail:'Admin removed linked refurbishment/parts and order lines.',by:'Administrator'});
 return {job,orders};
}
function restoreLinks(db,id){const bundle=db.removedLinks?.[id];if(!bundle)return;
 const s=db.operations=workflow.init(db.operations);
 if(bundle.job&&!s.jobs[id])s.jobs[id]=bundle.job;
 for(const record of bundle.orders||[]){
  const original=record.order;
  let dest=s.orders.find(o=>o.id===original.id);
  if(!dest){dest={...original,lines:[]};s.orders.push(dest);}
  for(const line of record.lines){if(!dest.lines.some(l=>l.assetId===line.assetId&&l.partId===line.partId))dest.lines.push(line);}
 }
 delete db.removedLinks[id];workflow.autoDraft(s);
}
function mutate(db,command){
 const id=clean(command?.assetId),kind=String(command?.type||'');
 db.operations=workflow.init(db.operations);db.removedLinks=db.removedLinks||{};
 const s=db.operations,item=db.items.find(a=>a.id===id);
 function fail(message){return {ok:false,error:message};}
 if(kind==='hardDeleteAsset'){
  if(!item)return fail('Asset not found.');
  if(!item.deletedAt)detach(s,id);
  // Old archived links from a previous soft delete are also removed.
  db.items=db.items.filter(a=>a!==item);
  delete db.removedLinks[id];
  s.audit.unshift({id:require('node:crypto').randomUUID(),type:'Asset permanently deleted',at:stamp(),assetId:id,detail:'Administrator permanently deleted asset and linked records.',by:'Administrator'});
  s.audit=s.audit.slice(0,2500);
  return {ok:true,kind,deleted:id};
 }
 if(kind==='deleteAsset'){
  if(!item||item.deletedAt)return fail('Active asset not found.');
  db.removedLinks[id]=detach(s,id);item.deletedAt=stamp();item.deletedReason='Removed from Inventory';
  return {ok:true,kind};
 }
 if(kind==='restoreAsset'){
  if(!item||!item.deletedAt)return fail('Asset not in Recycle Bin.');
  delete item.deletedAt;delete item.deletedReason;restoreLinks(db,id);return {ok:true,kind};
 }
 if(kind==='permanentDeleteAsset'){
  if(!item||!item.deletedAt)return fail('Move this asset to Recycle Bin first.');
  db.items=db.items.filter(a=>a!==item);delete db.removedLinks[id];return {ok:true,kind};
 }
 if(kind==='deleteRefurb'){
  if(!item||item.deletedAt)return fail('Active asset not found.');
  // Clear the entire refurbishment journey. Hardware and other inventory fields stay intact.
  const removed=detach(s,id);delete item.refurbishment;
  item.history=(item.history||[]).concat([{type:'Admin',detail:'Refurbishment history and linked job removed',at:stamp()}]).slice(-120);
  item.updatedAt=stamp();return {ok:true,kind,removedOrders:removed.orders.length};
 }
 if(kind==='deleteJob'){
  if(!item||item.deletedAt)return fail('Active asset not found.');
  if(!s.jobs[id])return fail('No repair job exists.');
  detach(s,id);return {ok:true,kind};
 }
 if(kind==='clearTests'){
  if(!item||item.deletedAt)return fail('Active asset not found.');
  delete item.diagnosticTests;delete item.diagnosticsUpdatedAt;
  item.updatedAt=stamp();return {ok:true,kind};
 }
 if(kind==='deleteOrder'){
  const oid=String(command?.orderId||'');const order=s.orders.find(o=>o.id===oid);
  if(!order)return fail('Purchase order not found.');
  // Reverse receipts linked to this order without making fitted counts invalid.
  for(const l of order.lines||[]){const part=s.jobs[l.assetId]?.parts.find(p=>p.id===l.partId);
   if(part){part.received=Math.max(part.fitted,part.received-(Number(l.received)||0));}}
  s.orders=s.orders.filter(o=>o!==order);
  if(order.status==='Draft')s.draftSuppressed=true;
  s.audit.unshift({id:require('node:crypto').randomUUID(),type:'Order deleted',at:stamp(),assetId:'',detail:`Administrator deleted ${oid} (including ${order.lines.length} lines).`,by:'Administrator'});
  workflow.autoDraft(s);return {ok:true,kind};
 }
 return fail('Unknown deletion action.');
}
module.exports={mutate};
