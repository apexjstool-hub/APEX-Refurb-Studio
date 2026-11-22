'use strict';
// Preview-only rules. Read-only derived advice, never guesses test outcomes.
const REQUIRED_QC=['Visual inspection','Required parts fitted','Hardware retest','Final clean & sign-off'];
const COSMETIC=/\b(respray|re[ -]?paint|paint|re[ -]?spray)\b/i;
const n=v=>Math.max(0,Number(v)||0);
function assess(record={}){
 const tests=record.tests||{},job=record.job||{},parts=Array.isArray(job.parts)?job.parts:[];
 const failures=Object.entries(tests).filter(([,v])=>v?.status==='fail').map(([id,v])=>({id,label:v.label||id,comment:v.comment||''}));
 const missing=Object.entries(tests).filter(([,v])=>v?.status==='not-tested').map(([id])=>id);
 const pending=parts.filter(p=>n(p.fitted)<n(p.qty));
 const repair=pending.filter(p=>!COSMETIC.test(p.name||''));
 const cosmetic=pending.filter(p=>COSMETIC.test(p.name||''));
 const awaiting=repair.filter(p=>n(p.received)<=n(p.fitted)&&p.ordered===true);
 const toOrder=repair.filter(p=>n(p.received)<=n(p.fitted)&&p.ordered!==true);
 const ready=repair.filter(p=>n(p.received)>n(p.fitted));
 const qcDone=REQUIRED_QC.every(k=>job.qc?.[k]===true);
 let action,reason,kind;
 if(job.status==='On Hold'){action='Review on-hold job';reason='This job is on hold. Only an authorised engineer should resume it.';kind='hold';}
 else if(job.status==='Completed'){action='Review completed device';reason='This job is marked completed. Reopening requires the existing approval process.';kind='done';}
 else if(toOrder.length){action='Request replacement parts';reason=toOrder.map(p=>p.name).join(', ')+' must be ordered or allocated.';kind='order';}
 else if(ready.length){action='Fit available parts';reason=ready.map(p=>p.name).join(', ')+' are recorded as received but not fitted.';kind='fit';}
 else if(awaiting.length){action='Await parts delivery';reason='Required parts have not yet been received.';kind='waiting';}
 else if(cosmetic.length){action='Complete cosmetic refurbishment';reason='Outstanding respray or paint work needs inspection and completion.';kind='cosmetic';}
 else if(failures.length){action='Review failed diagnostics and retest';reason='Failures remain recorded; confirm repair or document an authorised exception, then sync fresh results manually.';kind='retest';}
 else if(missing.length){action='Complete outstanding diagnostics';reason='Some device tests have not been run.';kind='test';}
 else if(!qcDone){action='Open final QC checklist';reason='Required refurbishment tasks are clear. Complete and verify the four QC checks.';kind='qc';}
 else{action='Review for completion';reason='No outstanding requirements are recorded and QC is complete. Final completion still requires approval.';kind='complete';}
 return {action,reason,kind,failures,missing,pending,counts:{failed:failures.length,parts:pending.length,qc:REQUIRED_QC.filter(x=>job.qc?.[x]).length,totalQC:REQUIRED_QC.length},qcReady:!pending.length&&!failures.length&&!missing.length,qcDone,canComplete:!pending.length&&!failures.length&&!missing.length&&qcDone&&job.status!=='On Hold'&&job.status!=='Completed'};
}
module.exports={assess,REQUIRED_QC};
