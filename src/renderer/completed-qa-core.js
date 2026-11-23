'use strict';
// Completed QA is a reversible, derived archive based on the existing storage-location
// and pallet assignments. Never mark a job completed or delete an inventory record.
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.ApexCompletedQA=api;
})(typeof window!=='undefined'?window:null,function(){
 const NAME='Completed QA',key=v=>String(v??'').trim().toLocaleLowerCase('en-GB'),same=(a,b)=>key(a)===key(b),num=v=>Math.max(0,Number(v)||0);
 const cosmetic=name=>/respray|re[ -]?spray|repaint|re[ -]?paint|painting/i.test(String(name||''));
 const QC=['Visual inspection','Required parts fitted','Hardware retest','Final clean & sign-off'];
 function partition(assets=[],pallets=[]){
  const reserved=new Set(pallets.filter(p=>same(p.storageLocation,NAME)).map(p=>key(p.name)));
  const archived=[],active=[];
  for(const a of assets){
   const target=same(a.location,NAME)||(!!key(a.pallet)&&reserved.has(key(a.pallet)));
   (target?archived:active).push(a);
  }
  return {active,archived,activePallets:pallets.filter(p=>!same(p.storageLocation,NAME)),archivedPallets:pallets.filter(p=>same(p.storageLocation,NAME))};
 }
 function status(asset,workflow={}){
  const job=workflow.jobs?.[asset.id],all=Array.isArray(job?.parts)?job.parts:[],parts=all.filter(p=>!cosmetic(p.name)),spray=all.filter(p=>cosmetic(p.name));
  const isDone=group=>group.length>0&&group.every(p=>num(p.fitted)>=Math.max(1,num(p.qty)));
  const partsStatus=!job?'Not recorded':!parts.length?'Not required':isDone(parts)?'Repair completed':'Repair outstanding';
  const completedSpray=(workflow.resprayPallets||[]).some(s=>s.status==='Completed'&&(s.manifest||[]).some(item=>same(item.assetId,asset.id)));
  const sprayStatus=!job?'Not recorded':!spray.length?'Not required':isDone(spray)?'Respray completed':completedSpray?'Respray needs verification':'Respray outstanding';
  const qc=QC.filter(k=>job?.qc?.[k]===true).length;
  const qcStatus=!job?'Not recorded':qc===QC.length?'QC completed':qc+'/4 checks';
  const refurbStatus=!job?'No refurbishment record':job.status==='Completed'?'Completed':job.status||'Not recorded';
  return {partsStatus,sprayStatus,qcStatus,refurbStatus,job};
 }
 function manifest(assets=[],workflow={}){
  return assets.filter(a=>a&&!a.deletedAt).map(a=>({id:String(a.id||''),brand:String(a.manufacturer||''),model:String(a.model||''),serial:String(a.serial||''),pallet:String(a.pallet||'No pallet'),location:String(a.location||'Unassigned'),...status(a,workflow)}));
 }
 return Object.freeze({NAME,same,partition,status,manifest});
});
