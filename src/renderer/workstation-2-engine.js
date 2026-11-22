'use strict';
/* Workstation 2.0 read-only advisory engine. Shares the canonical inventory/workflow.
   No guessed pass/fail and no QC/database writes. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.ApexWorkstation2=api;
})(typeof window!=='undefined'?window:null,function(){
 const QC=Object.freeze(['Visual inspection','Required parts fitted','Hardware retest','Final clean & sign-off']);
 const labels={display:'Display / LCD',touchscreen:'Touchscreen',keyboard:'Keyboard',pointer:'Touchpad',audio:'Speakers',microphone:'Microphone',camera:'Webcam',wifi:'Wi-Fi',bluetooth:'Bluetooth',battery:'Battery',physical:'Ports',system:'Internal hardware',hardware:'Hardware checks',health:'Windows health',gauntlet:'Stability',advanced:'Advanced',cosmetics:'Cosmetics'};
 const num=x=>Math.max(0,Number(x)||0);
 const cosmetic=name=>/respray|re[ -]?spray|repaint|re[ -]?paint|painting/i.test(String(name||''));
 function assess(asset={},job=null,orders=[]){
  const raw=asset.diagnosticTests&&typeof asset.diagnosticTests==='object'?asset.diagnosticTests:{};
  const tests=Object.entries(raw).filter(([,v])=>v&&typeof v==='object'&&['pass','fail','unsupported','not-tested'].includes(String(v.status||'').toLowerCase()))
   .map(([id,v])=>({id,label:labels[id]||id,status:String(v.status).toLowerCase(),comment:String(v.comment||'')}));
  const failed=tests.filter(t=>t.status==='fail'),untested=tests.filter(t=>t.status==='not-tested');
  const noResults=tests.length===0;
  const parts=Array.isArray(job?.parts)?job.parts:[];
  const required=parts.filter(p=>num(p.fitted)<num(p.qty));
  const unresolved=required.map(p=>{
   const related=orders.filter(o=>o.status!=='Draft').flatMap(o=>o.lines||[]).filter(l=>l.assetId===asset.id&&l.partId===p.id);
   const outstanding=related.reduce((n,l)=>n+Math.max(0,num(l.qty)-num(l.received)),0);
   return {part:p,cosmetic:cosmetic(p.name),toOrder:Math.max(0,num(p.qty)-num(p.received)-outstanding),outstanding,canFit:num(p.received)>num(p.fitted)};
  });
  const toOrder=unresolved.filter(x=>x.toOrder>0),canFit=unresolved.filter(x=>x.canFit),awaiting=unresolved.filter(x=>!x.canFit&&x.outstanding>0),cosmetics=unresolved.filter(x=>x.cosmetic);
  const qcDone=QC.filter(k=>job?.qc?.[k]===true).length,allQC=qcDone===QC.length;
  const isLocked=['Completed','On Hold'].includes(job?.status||'');
  let kind='qc',title='Open final QC checklist',reason='Review all required checks before approving the device.';
  if(!job){kind='job';title='Open refurbishment record';reason='No refurbishment job has been opened for this asset.';}
  else if(job.status==='On Hold'){kind='hold';title='Review on-hold job';reason='This job is on hold and cannot be completed automatically.';}
  else if(job.status==='Completed'){kind='done';title='Review completed device';reason='This job is already completed. Existing authorisations control any changes.';}
  else if(toOrder.length){kind='order';title='Arrange outstanding parts or respray';reason=toOrder.map(x=>x.part.name).slice(0,3).join(', ')+' still require ordering or an approved refurbishment action.';}
  else if(canFit.length){kind='fit';title='Fit received parts / inspect returned respray';reason='Received work remains to be fitted or checked.';}
  else if(awaiting.length){kind='wait';title='Await parts / respray return';reason='Outstanding repair requirements have not been received yet.';}
  else if(cosmetics.length){kind='cosmetic';title='Review cosmetic work';reason='Cosmetic refurbishment requirements are not yet complete.';}
  else if(failed.length){kind='retest';title='Review failed diagnostics and retest';reason='Failed test results remain recorded. Repair, retest and explicitly sync new diagnostic results.';}
  else if(untested.length){kind='diagnostics';title='Run outstanding diagnostic tests';reason='Some recorded tests have not been completed.';}
  else if(noResults){kind='diagnostics';title='Verify diagnostic results';reason='No explicit diagnostic test results are recorded. Do not assume the device passed.';}
  else if(!allQC){kind='qc';title='Complete final quality control';reason='Review the QC checklist and confirm all required tests have been performed.';}
  else{kind='review';title='Review job completion';reason='All recorded requirements are clear. Final sign-off remains a separate authorised step.';}
  const qcReady=!!job&&!isLocked&&!required.length&&!failed.length&&!untested.length&&!noResults;
  return Object.freeze({kind,title,reason,tests,failed,untested,noResults,required,unresolved,qcDone,qcTotal:QC.length,qcReady,allQC,canReviewCompletion:qcReady&&allQC,status:job?.status||'No job',QC});
 }
 return Object.freeze({assess,QC,labels});
});
