'use strict';const assert=require('node:assert/strict');const {test}=require('node:test');const W=require('../src/refurb-workflow');
test('RefurbFlow requirements, ordering, partial delivery, fitting, QC, completion',()=>{
const asset={id:'932453',manufacturer:'Dell',model:'Latitude 5420',serial:'J123',refurbishment:{latestKey:'b:j',reports:[{key:'b:j',repairs:[{name:'UK keyboard',quantity:2}]}]}};
let ops=W.init();assert.equal(W.syncRefurb(ops,asset),true);assert.equal(W.syncRefurb(ops,asset),false);
const id=asset.id,j=ops.jobs[id],p=j.parts[0];assert.equal(j.status,'Awaiting Parts');assert.equal(p.qty,2);
const act=c=>{const r=W.apply(structuredClone(ops),[asset],c);if(r.ok)ops=r.workflow;return r;};
assert.equal(act({type:'job',assetId:id,status:'Completed'}).ok,false);
assert.equal(act({type:'createOrder',supplier:'Parts PLC',expectedAt:'2026-11-01',lines:[{assetId:id,partId:p.id,qty:2}],cost:37.40}).ok,true);
assert.equal(W.outstanding(ops)[0].toOrder,0);const order=ops.orders[0];
assert.equal(act({type:'createOrder',supplier:'Duplicate',lines:[{assetId:id,partId:p.id,qty:1}]}).ok,false);
assert.equal(act({type:'receiveOrder',orderId:order.id,assetId:id,partId:p.id,qty:1}).ok,true);
assert.equal(act({type:'fitPart',assetId:id,partId:p.id,qty:2}).ok,false);
assert.equal(act({type:'receiveOrder',orderId:order.id,assetId:id,partId:p.id,qty:1}).ok,true);
assert.equal(ops.jobs[id].status,'Ready for Repair');
assert.equal(act({type:'fitPart',assetId:id,partId:p.id,qty:2}).ok,true);
for(const check of W.QC)assert.equal(act({type:'qc',assetId:id,check,passed:true}).ok,true);
assert.equal(act({type:'job',assetId:id,status:'Completed',technician:'Worker A',priority:'Normal'}).ok,true);
assert.equal(ops.jobs[id].status,'Completed');assert.equal(ops.orders[0].lines[0].received,2);
assert.ok(ops.audit.length>3);assert.equal(asset.location,undefined);assert.equal(asset.serial,'J123');
});

test('Bulk receiving records only remaining quantities, linked orders and per-device audit',()=>{
 const assets=[{id:'A'},{id:'B'}],state=W.init({jobs:{
 A:{assetId:'A',status:'Awaiting Parts',parts:[{id:'a',name:'Keyboard',qty:3,received:1,fitted:1},{id:'done',name:'Lid',qty:1,received:1,fitted:1}]},
 B:{assetId:'B',status:'Awaiting Parts',parts:[{id:'b',name:'Battery',qty:2,received:0,fitted:0}]}
 },orders:[{id:'PO-1',lines:[{assetId:'A',partId:'a',qty:3,received:1},{assetId:'B',partId:'b',qty:1,received:0}]}]});
 const parts=[{assetId:'A',partId:'a',expectedQty:3,expectedReceived:1,qty:2},{assetId:'B',partId:'b',expectedQty:2,expectedReceived:0,qty:2}],before=JSON.stringify(state);
 const r=W.apply(state,assets,{type:'receiveParts',parts},'Operator');
 assert.equal(r.ok,true);assert.equal(JSON.stringify(state),before);
 assert.equal(r.workflow.jobs.A.parts[0].received,3);assert.equal(r.workflow.jobs.A.parts[0].fitted,1);
 assert.equal(r.workflow.jobs.B.parts[0].received,2);assert.equal(r.workflow.orders[0].lines[0].received,3);assert.equal(r.workflow.orders[0].lines[1].received,1);
 assert.equal(r.workflow.jobs.A.status,'Ready for Repair');assert.equal(r.workflow.jobs.B.status,'Ready for Repair');
 assert.deepEqual(r.workflow.audit.map(a=>a.assetId).sort(),['A','B']);assert(r.workflow.audit.every(a=>a.by==='Operator'&&a.at));
 assert.equal(W.apply(r.workflow,assets,{type:'receiveParts',parts}).ok,false);
 for(const change of [
  p=>{p[1].expectedReceived=1;},p=>{p[1].qty=3;},p=>{p.push({...p[0]});},p=>{p[1].partId='missing';}
 ]){
  const selected=structuredClone(parts);change(selected);assert.equal(W.apply(state,assets,{type:'receiveParts',parts:selected}).ok,false);assert.equal(JSON.stringify(state),before);
 }
 const locked=structuredClone(state);locked.jobs.B.status='On Hold';const lockedBefore=JSON.stringify(locked);
 assert.equal(W.apply(locked,assets,{type:'receiveParts',parts}).ok,false);assert.equal(JSON.stringify(locked),lockedBefore);
});
test('Receive all orders excludes un-ordered quantities and rejects changed order snapshots',()=>{
 const assets=[{id:'A'}],s=W.init({jobs:{A:{assetId:'A',status:'Awaiting Parts',parts:[{id:'a',name:'Keyboard',qty:4,received:1,fitted:0}]}},orders:[{id:'PO',lines:[{assetId:'A',partId:'a',qty:2,received:1}]}]});
 const cmd={type:'receiveParts',ordersOnly:true,parts:[{assetId:'A',partId:'a',expectedQty:4,expectedReceived:1,expectedOnOrder:1,qty:1}]};
 const r=W.apply(s,assets,cmd);assert.equal(r.ok,true);assert.equal(r.workflow.jobs.A.parts[0].received,2);assert.equal(r.workflow.jobs.A.status,'Awaiting Parts');
 const changed=structuredClone(s);changed.orders[0].lines[0].qty=3;const before=JSON.stringify(changed);assert.equal(W.apply(changed,assets,cmd).ok,false);assert.equal(JSON.stringify(changed),before);
});

test('Undo Fitted restores received-but-not-fitted status with audit and QC protection',()=>{
 const assets=[{id:'ASSET-90'}],part={id:'p1',name:'LCD panel',qty:3,received:3,fitted:3};
 const state=W.init({jobs:{'ASSET-90':{assetId:'ASSET-90',status:'Quality Control',parts:[part],qc:{'Required parts fitted':true,'Visual inspection':true}}},orders:[],audit:[]});
 const result=W.apply(state,assets,{type:'undoFittedPart',assetId:'ASSET-90',partId:'p1',qty:2,reason:'Marked fitted by mistake',expectedFitted:3,expectedReceived:3},'Tester');
 assert.equal(result.ok,true,result.error);
 const job=result.workflow.jobs['ASSET-90'];
 assert.equal(job.parts[0].fitted,1);
 assert.equal(job.parts[0].received,3);
 assert.equal(job.status,'Repair In Progress');
 assert.equal(job.qc['Required parts fitted'],false);
 assert.equal(job.qc['Visual inspection'],true);
 assert.match(result.workflow.audit.find(e=>e.type==='Part fitted reversed').detail,/Marked fitted by mistake/);
});
test('Undo Fitted blocks mismatched quantities, cosmetic parts, completed jobs, and invalid requests',()=>{
 const assets=[{id:'ASSET-90'}];
 const make=()=>W.init({jobs:{'ASSET-90':{assetId:'ASSET-90',status:'Repair In Progress',parts:[{id:'p1',name:'Battery',qty:2,received:2,fitted:2}],qc:{}}},orders:[],audit:[]});
 for(const patch of [
  {expectedFitted:1},{expectedReceived:1},{qty:3},{qty:0},{reason:' '}
 ]){
  const state=make(),before=JSON.stringify(state);
  const response=W.apply(state,assets,{type:'undoFittedPart',assetId:'ASSET-90',partId:'p1',qty:1,reason:'Error',expectedFitted:2,expectedReceived:2,...patch},'Tester');
  assert.equal(response.ok,false);
  assert.equal(JSON.stringify(state),before,'failed request must not alter workflow');
 }
 const locked=make();locked.jobs['ASSET-90'].status='Completed';
 assert.equal(W.apply(locked,assets,{type:'undoFittedPart',assetId:'ASSET-90',partId:'p1',qty:1,reason:'Error',expectedFitted:2,expectedReceived:2}).ok,false);
 const cosmetic=make();cosmetic.jobs['ASSET-90'].parts[0].name='Full respray';
 assert.equal(W.apply(cosmetic,assets,{type:'undoFittedPart',assetId:'ASSET-90',partId:'p1',qty:1,reason:'Error',expectedFitted:2,expectedReceived:2}).ok,false);
});
test('Undo Fitted control is present for both Device Details repair layouts',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const ui=fs.readFileSync(path.join(__dirname,'../src/renderer/refurb-ui.js'),'utf8');
 assert.match(ui,/btn\('Undo Fitted','undoFit'/);
 assert.match(ui,/function undoFitModal\(ref\)/);
 assert.match(ui,/type:'undoFittedPart'/);
 assert.match(ui,/expectedFitted,expectedReceived/);
});
