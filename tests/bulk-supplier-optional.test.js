'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const workflow=require('../src/refurb-workflow');
const plan=require('../src/bulk-refurb-plan');

const assets=[{id:'ASSET-101',model:'Test Laptop'}];
function initial(){
 return {
  jobs:{'ASSET-101':{assetId:'ASSET-101',status:'Awaiting Parts',parts:[{id:'part-1',name:'Replacement keyboard',qty:2,received:0,fitted:0}],qc:{}}},
  orders:[],audit:[],v3DraftsMigrated:true
 };
}
function run(state,stage,supplier=''){
 const preview=plan.prepare(state,assets,['ASSET-101'],stage);
 assert.equal(preview.invalid.length,0);
 return workflow.apply(state,assets,{type:'bulkPartsStage',stage,assetIds:['ASSET-101'],expectedSignature:preview.signature,supplier});
}
test('bulk ordered -> received -> fitted works without any supplier',()=>{
 const ordered=run(initial(),'ordered');
 assert.equal(ordered.ok,true,ordered.error);
 assert.equal(ordered.workflow.orders.length,1);
 assert.equal(ordered.workflow.orders[0].supplier,'');
 assert.equal(ordered.workflow.orders[0].status,'Ordered');
 assert.equal(ordered.workflow.orders[0].lines[0].qty,2);
 const received=run(ordered.workflow,'received');
 assert.equal(received.ok,true,received.error);
 assert.equal(received.workflow.jobs['ASSET-101'].parts[0].received,2);
 assert.equal(received.workflow.orders[0].lines[0].received,2);
 const fitted=run(received.workflow,'fitted');
 assert.equal(fitted.ok,true,fitted.error);
 assert.equal(fitted.workflow.jobs['ASSET-101'].parts[0].fitted,2);
 assert.equal(fitted.workflow.audit.some(x=>x.type==='Part fitted'),true);
});
test('provided supplier is preserved when entered',()=>{
 const result=run(initial(),'ordered','Existing Supplier');
 assert.equal(result.ok,true,result.error);
 assert.equal(result.workflow.orders[0].supplier,'Existing Supplier');
});
test('fitted cannot skip the existing received-first safeguard',()=>{
 const state=initial();
 const preview=plan.prepare(state,assets,['ASSET-101'],'fitted');
 assert.equal(preview.invalid.length,1);
 const result=workflow.apply(state,assets,{type:'bulkPartsStage',stage:'fitted',assetIds:['ASSET-101'],expectedSignature:preview.signature});
 assert.equal(result.ok,false);
 assert.match(result.error,/must be received first/i);
});
