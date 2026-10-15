'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {mergeRequirements,syncRequirements}=require('../cloud/refurb-parts-bridge');
const empty=()=>({jobs:{},orders:[],audit:[]});
const asset=(repairs=[{name:'LCD',quantity:1}])=>({id:'A-1',serial:'SERIAL',refurbishment:{latestKey:'batch:job',reports:[{key:'batch:job',sourceUpdatedAt:1,repairs}]}});
const remote=()=>new Map([['A-1',{id:'A-1',payload:{serial:'SERIAL'}}]]);
const merge=(d,assets=[asset()],r=remote(),deleted=new Set())=>mergeRequirements(d,assets,r,deleted);
test('Previously saved Hub reports create cloud Parts Needed without rescanning',()=>{const original=empty(),result=merge(original);assert.equal(result.added,1);assert.equal(result.document.jobs['A-1'].status,'Awaiting Parts');assert.deepEqual(result.document.jobs['A-1'].parts.map(p=>[p.name,p.qty,p.received,p.fitted]),[['LCD',1,0,0]]);assert.equal(original.jobs['A-1'],undefined);assert.equal(merge(result.document).changed,false);});
test('Parts-only edits sync and preserve cloud progress, orders, QC and manual requirements',()=>{let d=merge(empty()).document;const job=d.jobs['A-1'];job.parts[0].received=1;job.parts[0].fitted=1;job.qc={'Hardware retest':true};job.technician='Technician';job.parts.push({id:'manual',name:'Keyboard',qty:1,received:0,fitted:0,sourceKey:''});d.orders=[{id:'ordered',lines:[{assetId:'A-1',partId:job.parts[0].id,qty:1,received:1}]}];const input=asset([{name:'LCD',quantity:2},{name:'Base',quantity:1}]);input.refurbishment.reports[0].sourceUpdatedAt=2;const result=merge(d,[input]);const j=result.document.jobs['A-1'];assert.equal(result.added,1);assert.equal(result.updated,1);assert.deepEqual([j.parts[0].qty,j.parts[0].received,j.parts[0].fitted],[2,1,1]);assert.deepEqual(j.qc,job.qc);assert.equal(j.technician,'Technician');assert.deepEqual(result.document.orders,d.orders);assert.ok(j.parts.some(p=>p.id==='manual'));});
test('A user-removed requirement stays removed on an unchanged Hub report',()=>{const d=merge(empty()).document;d.jobs['A-1'].parts=[];const result=merge(d);assert.equal(result.changed,false);assert.deepEqual(result.document.jobs['A-1'].parts,[]);});
test('Cloud direct intake and Hub intake of the same phone report do not duplicate requirements',()=>{const d=empty();d.jobs['A-1']={assetId:'A-1',status:'Repair In Progress',parts:[{id:'existing',name:'LCD',qty:1,received:1,fitted:1,sourceKey:'refurbflow:event:LCD'}],qc:{}};const r=remote();r.get('A-1').payload.refurbflowIntake=[{eventId:'event',report:{batchId:'batch',jobId:'job'}}];const result=merge(d,[asset()],r);assert.equal(result.added,0);assert.equal(result.document.jobs['A-1'].parts.length,1);assert.equal(result.document.jobs['A-1'].parts[0].id,'existing');assert.equal(result.document.jobs['A-1'].parts[0].fitted,1);});
test('Deleted assets, serial conflicts, completed and on-hold jobs are not reopened',()=>{assert.equal(merge(empty(),[asset()],remote(),new Set(['A-1'])).added,0);const r=remote();r.get('A-1').payload.serial='OTHER';assert.equal(merge(empty(),[asset()],r).skipped,1);for(const status of ['Completed','On Hold']){const d=empty();d.jobs['A-1']={assetId:'A-1',status,parts:[],qc:{}};const result=merge(d);assert.equal(result.skipped,1);assert.equal(result.changed,false);}r.get('A-1').payload.deletedAt='2026-10-14';assert.equal(merge(empty(),[asset()],r).added,0);});
test('Concurrent cloud progress forces a reread and is preserved in the retried write',async()=>{let row={revision:1,document:merge(empty()).document},writes=0;const edited=asset([{name:'LCD',quantity:2}]);const result=await syncRequirements({localAssets:[edited],cloudAssets:remote(),deleted:new Set(),read:async()=>structuredClone(row),write:async(revision,doc)=>{writes++;if(writes===1){row.revision=2;row.document.jobs['A-1'].parts[0].received=1;row.document.jobs['A-1'].parts[0].fitted=1;return false;}assert.equal(revision,2);row={revision:3,document:doc};return true;}});assert.equal(writes,2);assert.equal(result.updated,1);assert.equal(row.document.jobs['A-1'].parts[0].fitted,1);});
test('Repeated revision conflicts do not acknowledge requirements as saved',async()=>{await assert.rejects(syncRequirements({localAssets:[asset()],cloudAssets:remote(),deleted:new Set(),read:async()=>({revision:1,document:empty()}),write:async()=>false}),/retry next cycle/);});

const deletedAt='2026-10-15T08:00:00.000Z',freshAt='2026-10-15T09:00:00.000Z';
function reentryFixture(){
 const a=asset();a.refurbishment.reports=[
 {key:'old:job',receivedAt:'2026-10-14T08:00:00.000Z',sourceUpdatedAt:Date.parse('2026-10-14T08:00:00Z'),repairs:[{name:'Old LCD',quantity:1}]},
 {key:'fresh:job',receivedAt:freshAt,sourceUpdatedAt:Date.parse(freshAt),repairs:[{name:'New keyboard',quantity:1},{name:'Respray',quantity:1}]}];
 const r=remote();r.get('A-1').payload.createdAt='2026-10-15T08:30:00Z';
 return {a,r,markers:new Map([['A-1',{deleted_at:deletedAt}]])};
}
test('Re-registered asset accepts only fresh parts and respray; repeat sync is idempotent',()=>{
 const {a,r,markers}=reentryFixture(),blocked=new Set(['A-1']);
 const result=mergeRequirements(empty(),[a],r,blocked,markers);
 assert.deepEqual(result.document.jobs['A-1'].parts.map(p=>p.name),['New keyboard','Respray']);
 assert.equal(mergeRequirements(result.document,[a],r,blocked,markers).changed,false);
});
test('Stale reports, redelivered old payloads and invalid times remain blocked after re-entry',()=>{
 for(const field of ['sourceUpdatedAt','receivedAt']){
  const {a,r,markers}=reentryFixture();
  a.refurbishment.reports[1][field]=field==='sourceUpdatedAt'?Date.parse(deletedAt):deletedAt;
  assert.equal(mergeRequirements(empty(),[a],r,new Set(['A-1']),markers).added,0);
  delete a.refurbishment.reports[1][field];
  assert.equal(mergeRequirements(empty(),[a],r,new Set(['A-1']),markers).added,0);
 }
});
test('Deletion requires a confirmed fresh cloud generation and a second deletion blocks the previous generation',()=>{
 const {a,r,markers}=reentryFixture(),blocked=new Set(['A-1']);
 for(const created of [undefined,'invalid',deletedAt,'2026-10-14T00:00:00Z']){
  r.get('A-1').payload.createdAt=created;
  assert.equal(mergeRequirements(empty(),[a],r,blocked,markers).added,0);
 }
 r.get('A-1').payload.createdAt='2026-10-15T10:00:00Z';
 markers.get('A-1').deleted_at='2026-10-15T09:30:00Z';
 assert.equal(mergeRequirements(empty(),[a],r,blocked,markers).added,0);
 r.clear();assert.equal(mergeRequirements(empty(),[a],r,blocked,markers).added,0);
});
test('syncRequirements passes deletion generation through revision retries',async()=>{
 const {a,r,markers}=reentryFixture();let writes=0;
 const result=await syncRequirements({localAssets:[a],cloudAssets:r,deleted:new Set(['A-1']),deletionMarkers:markers,
 read:async()=>({revision:writes+1,document:empty()}),write:async(_,doc)=>{assert.equal(doc.jobs['A-1'].parts.length,2);return ++writes===2;}});
 assert.equal(result.added,2);assert.equal(writes,2);
});
test('A newer identical phone report refreshes its accepted version; stale and duplicate retries do not',()=>{
 const {importRefurb}=require('../src/refurb-intake');
 const items=[{id:'A-1',model:'Laptop',serial:'SERIAL'}];
 const payload={assetId:'A-1',batchId:'b',jobId:'j',updatedAt:Date.now()-3000,repairs:[{name:'Keyboard',quantity:1}]};
 assert.equal(importRefurb(items,payload).action,'created');
 assert.equal(importRefurb(items,payload).action,'unchanged');
 const newer={...payload,updatedAt:payload.updatedAt+1000};
 assert.equal(importRefurb(items,newer).action,'updated');
 assert.equal(items[0].refurbishment.reports[0].sourceUpdatedAt,newer.updatedAt);
 assert.equal(importRefurb(items,payload).action,'ignored');
 assert.equal(importRefurb(items,newer).action,'unchanged');
});
