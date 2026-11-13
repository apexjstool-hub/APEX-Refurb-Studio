'use strict';
/* v4.1.16: read-only completion and dispatch projections. The workflow remains the sole source of truth. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexDispatchStatus=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const cosmetic=name=>/\b(?:respray|re[ -]?spray|repaint|re[ -]?paint|painting|paint)\b/i.test(String(name||'').replace(/[_–—]/g,' '));
 const checks=['Visual inspection','Required parts fitted','Hardware retest','Final clean & sign-off'];
 const number=v=>Math.max(0,Number(v)||0);
 function status(job,workflow){
  if(!job)return null;
  const parts=Array.isArray(job.parts)?job.parts:[],replacement=parts.filter(p=>!cosmetic(p.name)),respray=parts.filter(p=>cosmetic(p.name));
  const complete=rows=>rows.every(p=>number(p.fitted)>=number(p.qty));
  const partsDone=complete(replacement),resprayDone=complete(respray);
  const qcDone=checks.every(k=>job.qc?.[k]===true);
  const shipped=(workflow?.resprayPallets||[]).find(s=>
   (s.status==='Dispatched'||s.status==='Returned')&&
   (s.manifest||[]).some(m=>m.assetId===job.assetId));
  const resprayState=!respray.length?'Not required':resprayDone?'Completed':
   shipped?.status==='Dispatched'?'Sent for respray':
   shipped?.status==='Returned'?'Returned — inspect':
   respray.some(p=>number(p.received)>number(p.fitted))?'Returned — inspect':'Incomplete';
  const partsState=!replacement.length?'Not required':partsDone?'Completed':
   replacement.some(p=>number(p.received)>number(p.fitted))?'Ready to fit':'Incomplete';
  const actualComplete=job.status==='Completed'&&partsDone&&resprayDone&&qcDone;
  const next=job.status==='On Hold'?'On hold':
   !partsDone&&!resprayDone?'Parts and respray outstanding':
   !partsDone?'Replacement parts outstanding':
   !resprayDone?'Respray outstanding':
   !qcDone?'Ready for QC':actualComplete?'Completed':'QC passed — confirm job completion';
  return {assetId:job.assetId,parts:partsState,respray:resprayState,partsDone,resprayDone,qcDone,readyForQc:partsDone&&resprayDone,completed:actualComplete,overall:actualComplete?'Completed':next};
 }
 function shipments(workflow){
  return (Array.isArray(workflow?.resprayPallets)?workflow.resprayPallets:[]).map(s=>({
   id:String(s.id||''),name:String(s.palletName||''),status:String(s.status||''),
   dispatchedAt:s.dispatchedAt||'',returnedAt:s.returnedAt||'',completedAt:s.completedAt||'',
   dispatchedBy:s.dispatchedBy||'',returnedBy:s.returnedBy||'',completedBy:s.completedBy||'',
   manifest:Array.isArray(s.manifest)?s.manifest:[],
   count:Array.isArray(s.manifest)?s.manifest.length:0
  })).sort((a,b)=>String(b.dispatchedAt).localeCompare(String(a.dispatchedAt)));
 }
 return Object.freeze({cosmetic,status,shipments});
});
