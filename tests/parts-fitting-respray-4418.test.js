'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const workflow=require('../src/refurb-workflow');
const progress=require('../src/inventory-workflow');
const assets=[{id:'83253',pallet:'551'},{id:'83254',pallet:'552'}];
const setup=()=>{
 const state=workflow.init();
 for(const a of assets)workflow.ensure(state,a.id,assets);
 state.jobs['83253'].parts.push({id:'keyboard',name:'Replacement keyboard',qty:1,received:0,fitted:0},{id:'spray',name:'Full respray',qty:1,received:0,fitted:0});
 state.jobs['83254'].parts.push({id:'other',name:'Full respray',qty:1,received:0,fitted:0});
 return state;
};
test('Mark fitted on Asset Details also confirms receipt without completing respray',()=>{
 const r=workflow.apply(setup(),assets,{type:'confirmPartFitted',assetId:'83253',partId:'keyboard',expectedQty:1,expectedReceived:0,expectedFitted:0,qty:1});
 assert.equal(r.ok,true,r.error);
 assert.equal(r.workflow.jobs['83253'].parts[0].fitted,1);
 assert.equal(r.workflow.jobs['83253'].parts[0].received,1);
 assert.equal(r.workflow.jobs['83253'].parts[1].fitted,0);
 const row=progress.index(r.workflow).get('83253');
 assert.equal(row.partsStatus,'Parts Fitted');
 assert.equal(row.resprayStatus,'Awaiting Respray');
 assert.equal(row.needsOrdering,0);
 assert.equal(row.key,'respray');
});
test('Stale edits are blocked and respray cannot be marked fitted as a replacement part',()=>{
 const r1=workflow.apply(setup(),assets,{type:'confirmPartFitted',assetId:'83253',partId:'keyboard',expectedQty:1,expectedReceived:1,expectedFitted:0,qty:1});
 const r2=workflow.apply(setup(),assets,{type:'confirmPartFitted',assetId:'83253',partId:'spray',expectedQty:1,expectedReceived:0,expectedFitted:0,qty:1});
 assert.equal(r1.ok,false);assert.equal(r2.ok,false);
});
test('Respray dispatch follows pallet snapshot and does not modify replacement parts',()=>{
 const state=setup();
 const send=workflow.apply(state,assets,{type:'dispatchResprayPallet',palletName:'551'});
 assert.equal(send.ok,true,send.error);assert.equal(send.affected,1);
 const row=progress.index(send.workflow).get('83253');
 assert.equal(row.resprayStatus,'Sent for Respray');
 assert.equal(row.partsStatus,'Parts Needed');
 assert.equal(send.workflow.jobs['83253'].parts[0].fitted,0);
 assert.equal(progress.index(send.workflow).get('83254').resprayStatus,'Awaiting Respray');
 const repeated=workflow.apply(send.workflow,assets,{type:'dispatchResprayPallet',palletName:'551'});
 assert.equal(repeated.ok,false,'A pallet must not dispatch twice while active');
});
