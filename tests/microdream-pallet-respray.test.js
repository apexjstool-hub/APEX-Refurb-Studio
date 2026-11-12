'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const flow=require('../src/refurb-workflow');
const view=require('../src/inventory-workflow');
const parts=(id,name)=>({id,name,qty:1,received:0,fitted:0,createdAt:'2026-11-01T00:00:00Z'});
function fixture(){
 const assets=[{id:'A',pallet:'MD-BOX-01'},{id:'B',pallet:'MD-BOX-01'},{id:'C',pallet:'OTHER'}];
 const jobs={A:{assetId:'A',status:'Awaiting Parts',parts:[parts('a-s','Keyboard respray'),parts('a-b','Replacement battery')],qc:{}},B:{assetId:'B',status:'Awaiting Parts',parts:[parts('b-s','Full respray')],qc:{}},C:{assetId:'C',status:'Awaiting Parts',parts:[parts('c-s','Lid respray')],qc:{}}};
 return {assets,state:{jobs,orders:[],audit:[]}};
}
function apply(state,assets,command){const result=flow.apply(state,assets,command);assert.equal(result.ok,true,result.error);return result;}
test('dispatch takes frozen snapshot of only resprays in pallet',()=>{
 const {state,assets}=fixture();
 const a=apply(state,assets,{type:'dispatchResprayPallet',palletName:'MD-BOX-01'});
 assert.equal(a.affected,2);
 assert.deepEqual(a.resprayPallet.manifest.map(x=>x.assetId),['A','B']);
 assert.deepEqual(a.resprayPallet.manifest[0].parts.map(x=>x.partId),['a-s']);
 assert.equal(a.workflow.jobs.A.parts[1].fitted,0);
 assert.equal(view.index(a.workflow).get('B').stage,'Sent for Respray');
});
test('pallet return then complete marks all snapshotted resprays finished, not batteries',()=>{
 const {state,assets}=fixture();
 const send=apply(state,assets,{type:'dispatchResprayPallet',palletName:'MD-BOX-01'});
 const returned=apply(send.workflow,assets,{type:'returnResprayPallet',palletName:'MD-BOX-01',expectedDispatchId:send.resprayPallet.id});
 assert.equal(view.index(returned.workflow).get('B').stage,'Respray Returned');
 const completed=apply(returned.workflow,assets,{type:'completeResprayPallet',palletName:'MD-BOX-01',expectedDispatchId:send.resprayPallet.id,confirmChecked:true});
 assert.equal(completed.completedTasks,2);
 assert.equal(completed.workflow.jobs.A.parts[0].received,1);
 assert.equal(completed.workflow.jobs.A.parts[0].fitted,1);
 assert.equal(completed.workflow.jobs.B.parts[0].fitted,1);
 assert.equal(completed.workflow.jobs.A.parts[1].fitted,0);
 assert.equal(completed.workflow.jobs.C.parts[0].fitted,0);
 assert.equal(view.index(completed.workflow).get('A').resprayStatus,'Respray Completed');
 assert(completed.workflow.audit.some(event=>event.type==='Respray Completed'&&event.assetId==='B'));
});
test('changes to manifest prevent accidental partial bulk completion',()=>{
 const {state,assets}=fixture(),sent=apply(state,assets,{type:'dispatchResprayPallet',palletName:'MD-BOX-01'});
 const returned=apply(sent.workflow,assets,{type:'returnResprayPallet',palletName:'MD-BOX-01',expectedDispatchId:sent.resprayPallet.id});
 const changed=structuredClone(returned.workflow);changed.jobs.B.parts[0].qty=2;
 const before=JSON.stringify(changed);
 const result=flow.apply(changed,assets,{type:'completeResprayPallet',palletName:'MD-BOX-01',expectedDispatchId:sent.resprayPallet.id,confirmChecked:true});
 assert.equal(result.ok,false);
 assert.equal(JSON.stringify(changed),before);
});
test('re-dispatch blocked until prior pallet completes, and completion requires return and inspection',()=>{
 const {state,assets}=fixture(),sent=apply(state,assets,{type:'dispatchResprayPallet',palletName:'MD-BOX-01'});
 assert.equal(flow.apply(sent.workflow,assets,{type:'dispatchResprayPallet',palletName:'MD-BOX-01'}).ok,false);
 assert.equal(flow.apply(sent.workflow,assets,{type:'completeResprayPallet',palletName:'MD-BOX-01',expectedDispatchId:sent.resprayPallet.id,confirmChecked:true}).ok,false);
 const returned=apply(sent.workflow,assets,{type:'returnResprayPallet',palletName:'MD-BOX-01',expectedDispatchId:sent.resprayPallet.id});
 assert.equal(flow.apply(returned.workflow,assets,{type:'completeResprayPallet',palletName:'MD-BOX-01',expectedDispatchId:sent.resprayPallet.id}).ok,false);
});
test('newly added respray after dispatch is NOT marked complete',()=>{
 const {state,assets}=fixture(),sent=apply(state,assets,{type:'dispatchResprayPallet',palletName:'MD-BOX-01'});
 sent.workflow.jobs.A.parts.push(parts('late','Palmrest respray'));
 const back=apply(sent.workflow,assets,{type:'returnResprayPallet',palletName:'MD-BOX-01',expectedDispatchId:sent.resprayPallet.id});
 const completed=apply(back.workflow,assets,{type:'completeResprayPallet',palletName:'MD-BOX-01',expectedDispatchId:sent.resprayPallet.id,confirmChecked:true});
 assert.equal(completed.workflow.jobs.A.parts.find(p=>p.id==='late').fitted,0);
});
