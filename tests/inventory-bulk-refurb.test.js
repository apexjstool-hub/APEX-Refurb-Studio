'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const flow=require('../src/refurb-workflow');
const planner=require('../src/bulk-refurb-plan');
const make=(id,name)=>({id,name,qty:1,received:0,fitted:0});
const assets=[{id:'A',pallet:'PALLET-1'},{id:'B',pallet:'PALLET-1'}];
const initial=()=>({jobs:{
 A:{assetId:'A',status:'Awaiting Parts',parts:[make('a1','LCD replacement'),make('a2','Keyboard respray')],qc:{}},
 B:{assetId:'B',status:'Awaiting Parts',parts:[make('b1','Battery replacement')],qc:{}}
},orders:[],audit:[]});
function run(s,stage,extra={}){
 const prepared=planner.prepare(s,assets,['A','B'],stage);
 assert.equal(prepared.invalid.length,0,JSON.stringify(prepared.invalid));
 const r=flow.apply(s,assets,{type:'bulkPartsStage',assetIds:['A','B'],stage,expectedSignature:prepared.signature,...extra},'Engineer');
 assert.equal(r.ok,true,r.error);return r.workflow;
}
test('bulk ordered creates one actual record for replacement parts only',()=>{
 const state=run(initial(),'ordered',{supplier:'Supplier on invoice'});
 assert.equal(state.orders.length,1);
 assert.deepEqual(state.orders[0].lines.map(l=>l.partId),['a1','b1']);
 assert.equal(state.jobs.A.parts[1].fitted,0);
 assert.equal(state.jobs.A.parts[1].received,0);
 assert(state.audit.some(e=>e.type==='Part ordered'&&e.assetId==='A'));
});
test('bulk received and fitted update two devices atomically, never respray',()=>{
 const ordered=run(initial(),'ordered',{supplier:'Parts supplier'});
 const received=run(ordered,'received');
 assert.equal(received.jobs.A.parts[0].received,1);
 assert.equal(received.jobs.B.parts[0].received,1);
 assert.equal(received.jobs.A.parts[1].received,0);
 const fitted=run(received,'fitted');
 assert.equal(fitted.jobs.A.parts[0].fitted,1);
 assert.equal(fitted.jobs.B.parts[0].fitted,1);
 assert.equal(fitted.jobs.A.parts[1].fitted,0);
});
test('parts cannot be fitted before receipt; no partial mutation',()=>{
 const state=initial(),before=JSON.stringify(state);
 const result=planner.prepare(state,assets,['A','B'],'fitted');
 assert.equal(result.invalid.length,2);
 assert.equal(JSON.stringify(state),before);
});
test('stale batch snapshots are rejected',()=>{
 const state=initial(),prepared=planner.prepare(state,assets,['A','B'],'ordered');
 state.jobs.B.parts[0].qty=2;
 const saved=flow.apply(state,assets,{type:'bulkPartsStage',stage:'ordered',assetIds:['A','B'],expectedSignature:prepared.signature,supplier:'Supplier'});
 assert.equal(saved.ok,false);
 assert.equal(state.orders.length,0);
});
test('missing supplier or locked job blocks entire batch',()=>{
 const state=initial(),plan=planner.prepare(state,assets,['A','B'],'ordered');
 assert.equal(flow.apply(state,assets,{type:'bulkPartsStage',stage:'ordered',assetIds:['A','B'],expectedSignature:plan.signature}).ok,false);
 state.jobs.B.status='On Hold';
 assert.equal(planner.prepare(state,assets,['A','B'],'ordered').invalid.length,1);
});
