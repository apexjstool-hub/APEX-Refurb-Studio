'use strict';
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./inventory-workflow'):root.ApexInventoryWorkflow);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexActionCentre=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Workflow){
 const defaults=Object.freeze({ordering:7,respray:14,inactive:14});
 const number=v=>Math.max(0,Number(v)||0);
 const age=(date,now)=>{const t=Date.parse(date);return Number.isFinite(t)?Math.max(0,Math.floor((now-t)/86400000)):null;};
 const text=v=>String(v??'').trim();
 const key=v=>text(v).toLowerCase();
 const smart=p=>/\bsmart[\s_-]*key\b/i.test(text(p.name));
 const spray=p=>/respray|re[ -]?spray|paint/i.test(text(p.name));
 const active=a=>a&&a.id&&!a.deletedAt&&key(a.location)!=='completed qa';
 const groups=Object.freeze([
 ['order','Parts awaiting ordering','purchasing'],['overdue','Overdue supplier orders','purchasing'],
 ['delivery','Awaiting parts delivery','purchasing'],['respray','Respray outstanding','workshop'],
 ['respray-return','Respray returns to inspect','workshop'],['fit','Parts ready to fit','workshop'],
 ['qa','Ready for QA review','workshop'],['signoff','Ready for final sign-off','workshop'],
 ['hold','Jobs on hold','workshop'],['inactive','Refurbishment delays','workshop'],
 ['diagnostic','Recorded diagnostic failures','inventory'],['missing','Missing device information','inventory'],['location','Unassigned locations','inventory']
 ]);
 function settings(input={}){return Object.fromEntries(Object.entries(defaults).map(([k,v])=>{const n=Number(input?.[k]);return [k,Number.isInteger(n)&&n>=1&&n<=365?n:v];}));}
 function calculate(workflow,assets=[],input={},now=Date.now()){
  const cfg=settings(input),byId=new Map(assets.filter(active).map(a=>[String(a.id),a])),rows=[];
  const add=(category,a,level,detail,wait=null,route='asset',id=a.id)=>rows.push({category,level,detail,age:wait,route,id:String(id),assetId:route==='asset'?String(a.id):'',name:[a.manufacturer,a.model].filter(Boolean).join(' '),location:a.location||'',technician:workflow?.jobs?.[a.id]?.technician||''});
  if(!workflow||!workflow.jobs)return {available:false,rows:[],counts:{urgent:0,attention:0,ready:0}};
  const summaries=Workflow.index(workflow),overdue=new Map(),dispatchByAsset=new Map();
  for(const d of workflow.resprayPallets||[])if(['Dispatched','Returned'].includes(d.status))for(const m of d.manifest||[])if(!dispatchByAsset.has(String(m.assetId)))dispatchByAsset.set(String(m.assetId),d);
  // A date-only supplier ETA is due through the end of that local calendar day.
  const date=new Date(now),localDay=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  for(const o of workflow.orders||[]){
   const due=text(o.expectedAt).slice(0,10);
   if(o.status==='Draft'||o.status==='Received'||!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||due>=localDay)continue;
   for(const l of o.lines||[]){
    const j=workflow.jobs[l.assetId],p=j?.parts?.find(p=>p.id===l.partId);
    if(!byId.has(String(l.assetId))||!j||['Completed','On Hold'].includes(j.status)||!p||smart(p)||spray(p)||number(p.fitted)>=number(p.qty)||number(l.qty)<=number(l.received))continue;
    const id=String(l.assetId);if(!overdue.has(id))overdue.set(id,new Set());overdue.get(id).add(text(o.reference)||text(o.id)||'Supplier order');
   }
  }
  for(const a of byId.values()){
   const j=workflow.jobs[a.id],s=summaries.get(a.id);
   if(j?.status==='Completed')continue;
   if(j?.status==='On Hold'){add('hold',a,'attention','Review hold before progressing',age(j.updatedAt||j.createdAt,now));continue;}
   if(j&&s){
    const relevant=s.parts.filter(p=>!smart(p)),outstanding=relevant.filter(p=>number(p.fitted)<number(p.required)),replacements=outstanding.filter(p=>!spray(p)),sprays=outstanding.filter(spray);
    const oldest=parts=>{const dates=parts.map(p=>age(p.createdAt||j.createdAt,now)).filter(v=>v!==null);return dates.length?Math.max(...dates):null;};
    const toOrder=j.partsBoard==='ordered'?[]:replacements.filter(p=>p.toOrder>0);
    if(toOrder.length){const wait=oldest(toOrder);add('order',a,wait!==null&&wait>=cfg.ordering?'urgent':'attention',toOrder.map(p=>p.name).join(', '),wait);}
    const late=overdue.get(String(a.id));
    if(late?.size)add('overdue',a,'urgent','Past recorded ETA: '+[...late].join(', '));
    else if(replacements.some(p=>p.awaiting>0||j.partsBoard==='ordered'&&p.toOrder>0))add('delivery',a,'attention','Outstanding replacement parts');
    if(replacements.some(p=>p.toFit>0))add('fit',a,'ready','Received replacement parts ready to fit');
    if(sprays.length){
     const dispatch=dispatchByAsset.get(String(a.id));
     const wait=dispatch?age(dispatch.status==='Returned'?dispatch.returnedAt:dispatch.dispatchedAt,now):oldest(sprays);
     if(dispatch?.status==='Returned'||s.resprayStatus==='Respray Returned')add('respray-return',a,'ready','Inspect and complete returned respray',wait);
     else add('respray',a,wait!==null&&wait>=cfg.respray?'urgent':'attention',dispatch?'Awaiting Microdream return':'Arrange or complete respray',wait);
    }
    const checks=['Visual inspection','Required parts fitted','Hardware retest','Final clean & sign-off'];
    if(!outstanding.length&&relevant.length===0&&j.status!=='Quality Control'&&!checks.some(k=>j.qc?.[k]===true)){
     // A new empty job is not evidence of QA readiness.
    }else if(!outstanding.length){const all=checks.every(k=>j.qc?.[k]===true);add(all?'signoff':'qa',a,'ready',all?'All recorded checks passed; review final sign-off':'Review existing repair and QA records');}
    const wait=age(j.updatedAt||j.createdAt,now);
    if(outstanding.length&&wait!==null&&wait>=cfg.inactive)add('inactive',a,'attention','No recorded job update for '+wait+' days',wait);
   }
   // Imported failures are historical observations, not proof of a current fault.
   if(a.status!=='Processed'){
    const failed=Object.entries(a.diagnosticTests||{}).filter(([,v])=>key(v?.status||v)==='fail').map(([k])=>k);
    if(failed.length)add('diagnostic',a,'attention','Review recorded failures: '+failed.join(', '));
   }
   const missing=['manufacturer','model','serial',...(a.productType==='Laptop'||a.productType==='Desktop'?['processor','ram','storage']:[])].filter(k=>!text(a[k]));
   if(missing.length)add('missing',a,'attention','Missing: '+missing.join(', '));
   if(!text(a.location)||key(a.location)==='unassigned')add('location',a,'attention','Assign an inventory location');
  }
  const rank={urgent:0,attention:1,ready:2};
  rows.sort((a,b)=>rank[a.level]-rank[b.level]||(b.age??-1)-(a.age??-1)||a.category.localeCompare(b.category)||a.id.localeCompare(b.id));
  const counts={urgent:0,attention:0,ready:0};for(const r of rows)counts[r.level]++;
  return {available:true,rows,counts};
 }
 return Object.freeze({defaults,settings,groups,calculate});
});
