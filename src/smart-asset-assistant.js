'use strict';
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./grade-projection'):root.ApexGradeProjection,typeof module==='object'&&module.exports?require('./inventory-workflow'):root.ApexInventoryWorkflow,typeof module==='object'&&module.exports?require('./repair-work-type'):root.ApexRepairWork);if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexSmartAssistant=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Grade,Workflow,Repair){
 const tabs={order:'parts',overdue:'parts',delivery:'parts',respray:'parts','respray-return':'parts',fit:'parts',qa:'parts',signoff:'parts',hold:'parts',inactive:'parts',diagnostic:'tests',missing:'overview',location:'overview'};
 const checks=['Visual inspection','Required parts fitted','Hardware retest','Final clean & sign-off'];
 const sum=(rows,key)=>rows.reduce((n,r)=>n+Math.max(0,Number(r[key])||0),0);
 function workDetails(asset,state){
  const wf=state?.workflow,job=wf?.jobs?.[asset.id];
  if(!job){
   const imported=Grade.requirementsFor(asset,null).rows.map(p=>({name:p.name,required:p.qty,fitted:p.fitted,received:null,ordered:null,awaiting:null,toOrder:null,toFit:null,status:'Imported requirement — verify progress',notes:'',orders:[]}));
   return {source:imported.length?'Imported requirements; no job progress available':'No saved refurbishment job',known:false,groups:Repair.split(imported),jobStatus:null,technician:null,notes:'',qc:[],shipment:null};
  }
  const orders=(wf.orders||[]).filter(o=>o.status!=='Draft'&&(o.lines||[]).some(l=>l.assetId===asset.id));
  const shipments=(wf.resprayPallets||[]).filter(o=>o.manifest?.some(m=>m.assetId===asset.id));
  const summary=Workflow.index({jobs:{[asset.id]:job},orders,resprayPallets:shipments}).get(asset.id);
  const shipment=shipments.find(x=>['Dispatched','Returned'].includes(x.status));
  const rows=summary.parts.map(p=>{
   const cosmetic=Repair.isCosmetic(p.name),other=Repair.isSmartKey(p.name),done=p.fitted>=p.required;
   const onShipment=cosmetic&&shipment?.manifest?.some(m=>m.assetId===asset.id&&m.parts?.some(x=>x.partId===p.id));
   let status=other?'Reference only':done?(cosmetic?'Checked / complete':'Fitted'):cosmetic?(onShipment?(shipment.status==='Returned'?'Returned — check required':'Sent for respray'):p.toFit>0?'Returned — check required':p.awaiting>0?'Booked / sent':'Awaiting respray'):p.toFit>0?'Ready to fit':p.awaiting>0&&p.toOrder>0&&job.partsBoard!=='ordered'?'Part ordered — more needed':p.awaiting>0?'Awaiting delivery':job.partsBoard==='ordered'?'Marked ordered':p.fitted>0?'Partially fitted':'Needs ordering';
   const linked=orders.flatMap(o=>(o.lines||[]).filter(l=>l.assetId===asset.id&&l.partId===p.id).map(l=>({id:o.id,supplier:o.supplier||'',reference:o.reference||'',expectedAt:o.expectedAt||'',qty:l.qty,received:l.received})));
   return {name:p.name,required:p.required,ordered:p.ordered,received:p.received,fitted:p.fitted,awaiting:p.awaiting,toOrder:job.partsBoard==='ordered'&&!cosmetic?0:p.toOrder,toFit:p.toFit,status,notes:p.notes||'',orders:linked,shipment:!!onShipment};
  });
  const groups=Repair.split(rows),all=[...groups.replacement,...groups.cosmetic];
  const required=sum(all,'required'),finished=all.reduce((n,p)=>n+Math.min(p.required,p.fitted),0);
  return {source:'Saved refurbishment job',known:true,groups,required,finished,partsStatus:summary.partsStatus,resprayStatus:summary.resprayStatus,jobStatus:job.status,technician:job.technician||'Unassigned',notes:job.notes||'',qc:checks.map(name=>({name,done:job.qc?.[name]===true})),shipment:shipment?{pallet:shipment.palletName,reference:shipment.reference,status:shipment.status,dispatchedAt:shipment.dispatchedAt,returnedAt:shipment.returnedAt}:null};
 }
 function summarize(asset,state){
  if(!asset||asset.deletedAt||!asset.id)return null;
  const available=state?.available===true,actions=available?(state.rows||[]).filter(r=>String(r.id)===String(asset.id)).map(r=>({...r,tab:tabs[r.category]||'overview'})):[];
  const statuses=Object.values(asset.diagnosticTests||{}).map(v=>String(v?.status||v).toLowerCase());
  const tests={passed:statuses.filter(v=>v==='pass').length,failed:statuses.filter(v=>v==='fail').length,other:statuses.filter(v=>v!=='pass'&&v!=='fail').length};
  const raw=asset.batteryPercentage,battery=raw!==''&&raw!==null&&raw!==undefined&&Number.isFinite(Number(raw))&&Number(raw)>=0&&Number(raw)<=100?Number(raw):null;
  const projection=available&&!state.stale?Grade.project(asset,state.workflow):null;
  const failed=Object.entries(asset.diagnosticTests||{}).filter(([,v])=>String(v?.status||v).toLowerCase()==='fail').map(([name,v])=>({name,note:typeof v==='object'?String(v.note||v.notes||v.comment||''):''}));
  return {id:asset.id,available,stale:!!state?.stale,actions,tests,battery,projection,next:actions[0]||null,work:workDetails(asset,state),failed};
 }
 return Object.freeze({summarize});
});