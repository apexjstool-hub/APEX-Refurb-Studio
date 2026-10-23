'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../src/refurb-workflow');
const progress=require('../src/inventory-workflow');
function fixture(){
 const assets=['A','B','C'].map(id=>({id,location:'Inspection'}));
 const state=W.init({jobs:Object.fromEntries(assets.map(a=>[a.id,{assetId:a.id,status:'Awaiting Parts',parts:[{id:'part-'+a.id,name:'Battery',qty:2,received:1,fitted:0}]}]))});
 return {assets,state};
}
test('bulk move changes only selected boards and preserves quantities, locations and orders',()=>{
 const {assets,state}=fixture(),before=JSON.stringify(state),locations=JSON.stringify(assets);
 const r=W.apply(state,assets,{type:'bulkSetPartsBoard',assetIds:['A','C','A'],board:'ordered'},'Operator');
 assert.equal(r.ok,true);
 assert.equal(r.workflow.jobs.A.partsBoard,'ordered');assert.equal(r.workflow.jobs.C.partsBoard,'ordered');
 assert.deepEqual(r.workflow.jobs.B,state.jobs.B);
 for(const id of ['A','C']){assert.deepEqual(r.workflow.jobs[id].parts,state.jobs[id].parts);assert.equal(r.workflow.jobs[id].status,state.jobs[id].status);}
 assert.deepEqual(r.workflow.orders,state.orders);assert.equal(JSON.stringify(assets),locations);assert.equal(JSON.stringify(state),before);
 assert.deepEqual(r.workflow.audit.map(a=>a.assetId).sort(),['A','C']);
 const reopened=progress.index(JSON.parse(JSON.stringify(r.workflow)));
 for(const id of ['A','C']){assert.equal(reopened.get(id).stage,'Parts ordered');assert.equal(reopened.get(id).needsOrdering,0);assert.equal(reopened.get(id).awaitingDelivery,1);}
 assert.equal(reopened.get('B').stage,'Needs ordering');
 const back=W.apply(r.workflow,assets,{type:'setPartsBoard',assetId:'A',board:'needed'});
 assert.equal(back.ok,true);assert.equal(back.workflow.jobs.A.partsBoard,'needed');assert.equal(progress.index(back.workflow).get('A').stage,'Needs ordering');
});
test('bulk move rejects empty, invalid and stale selections without partial changes',()=>{
 for(const command of [
 {assetIds:[] ,board:'ordered'}, {assetIds:['A'],board:'bad'},
 {assetIds:['A','MISSING'],board:'ordered'}, {assetIds:['A','B'],board:'ordered'}]){
  const {assets,state}=fixture();if(command.assetIds.includes('B'))state.jobs.B.parts[0].fitted=2;
  const before=JSON.stringify(state);
  assert.equal(W.apply(state,assets,{type:'bulkSetPartsBoard',...command}).ok,false);
  assert.equal(JSON.stringify(state),before);
 }
});
