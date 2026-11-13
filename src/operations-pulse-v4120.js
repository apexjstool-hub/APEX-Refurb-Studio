'use strict';
/* v4.1.20 read-only operational indicators; existing workflow remains authoritative. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexOperationsPulse=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const number=n=>Math.max(0,Number(n)||0);
 function calculate(workflow,assets=[]){
  const jobs=workflow?.jobs||{},activeAssets=new Set(assets.filter(a=>a&&!a.deletedAt).map(a=>String(a.id)));
  const all=Object.values(jobs).filter(j=>j&&activeAssets.has(String(j.assetId)));
  const cosmetic=name=>/\b(?:respray|re[ -]?spray|repaint|re[ -]?paint|painting|paint)\b/i.test(String(name||'').replace(/[_–—]/g,' '));
  let waitingParts=0,waitingRespray=0,readyQc=0;
  for(const job of all){
   if(['On Hold','Completed'].includes(job.status))continue;
   const parts=job.parts||[];
   const outstanding=parts.filter(p=>number(p.fitted)<number(p.qty));
   if(outstanding.some(p=>!cosmetic(p.name)))waitingParts++;
   if(outstanding.some(p=>cosmetic(p.name)))waitingRespray++;
   if(!outstanding.length&&job.status!=='Completed'&&job.status!=='On Hold'&&
      !['Visual inspection','Required parts fitted','Hardware retest','Final clean & sign-off'].every(k=>job.qc?.[k]===true))readyQc++;
  }
  const dispatch=Array.isArray(workflow?.resprayPallets)?workflow.resprayPallets:[];
  return {waitingParts,waitingRespray,readyQc,dispatched:dispatch.filter(x=>x.status==='Dispatched').length,returned:dispatch.filter(x=>x.status==='Returned').length,available:!!workflow};
 }
 function steps(status){
  return [{label:'Dispatched',done:['Dispatched','Returned','Completed'].includes(status),active:status==='Dispatched'},
          {label:'Returned',done:['Returned','Completed'].includes(status),active:status==='Returned'},
          {label:'Inspected / completed',done:status==='Completed',active:status==='Completed'}];
 }
 return Object.freeze({calculate,steps});
});
