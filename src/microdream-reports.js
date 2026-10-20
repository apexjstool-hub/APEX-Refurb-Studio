'use strict';
const docs=require('./microdream-documents'),{randomUUID}=require('node:crypto');
const key=v=>String(v||'').trim().toLowerCase();
function reference(v){const value=String(v??'').trim();if(value.length>100||/[\x00-\x1f\x7f]/.test(value))throw Error('Job Ref must be one line of 100 characters or fewer.');return value;}
function prepare(data,input){
 if(!/^[a-f0-9-]{36}$/i.test(input.requestId||''))throw Error('Reopen Create purchase order before trying again.');
 docs.select(data,input); // Validate the entire selection before preparing any reports.
 const names=[...new Set(input.palletNames.map(key))];
 return names.map(name=>{const pallet=data.pallets.find(p=>key(p.name)===name),document=docs.select(data,{palletNames:[pallet.name],jobRef:reference(input.jobRef)}),at=new Date().toISOString();
 return {id:randomUUID(),requestKey:input.requestId+':'+name,palletName:pallet.name,palletCreatedAt:pallet.createdAt||'',createdAt:at,updatedAt:at,revision:1,document,assetIds:data.items.filter(a=>!a.deletedAt&&key(a.pallet)===name).map(a=>a.id)};});
}
function matches(report,pallet){return report.palletCreatedAt&&pallet.createdAt?report.palletCreatedAt===pallet.createdAt:key(report.palletName)===key(pallet.name);}
function apply(db,input){
 try{
 const reports=Array.isArray(db.microdreamReports)?db.microdreamReports:[];
 if(input.action==='create'){
  const next=prepare({items:db.items,pallets:require('./pallet-management').listPallets(db)},input),saved=next.map(r=>reports.find(x=>x.requestKey===r.requestKey)||r);
  db.microdreamReports=[...reports,...saved.filter(r=>!reports.some(x=>x.id===r.id))];return {ok:true,reports:saved};
 }
 if(input.action==='list')return {ok:true,reports:reports.filter(r=>matches(r,input.pallet||{})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};
 const report=reports.find(r=>r.id===input.id);if(!report)throw Error('Saved report not found.');
 if(input.action==='get')return {ok:true,report};
 if(input.action!=='update')throw Error('Invalid report action.');
 if(report.revision!==input.expectedRevision)throw Error('This report was updated elsewhere. Reopen View report before saving.');
 const document=input.edits!==undefined?docs.applyEdits(report.document,input.edits):{...report.document,jobRef:reference(input.jobRef)},updated={...report,document,revision:report.revision+1,updatedAt:new Date().toISOString()};
 db.microdreamReports=reports.map(r=>r.id===updated.id?updated:r);return {ok:true,report:updated};
 }catch(e){return {ok:false,error:e.message};}
}
module.exports={prepare,apply,matches,reference};

