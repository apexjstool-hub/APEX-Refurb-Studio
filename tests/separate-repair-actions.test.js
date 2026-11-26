'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const workflow=require('../src/refurb-workflow');
const assets=[{id:'83253',pallet:'551'},{id:'83254',pallet:'551'},{id:'83255',pallet:'552'}];
const fresh=()=>{const s=workflow.init();for(const a of assets)workflow.ensure(s,a.id,assets);s.jobs['83253'].parts.push({id:'keyboard',name:'Replacement keyboard',qty:1,received:0,fitted:0},{id:'spray',name:'Full respray',qty:1,received:0,fitted:0});s.jobs['83255'].parts.push({id:'other',name:'Full respray',qty:1,received:0,fitted:0});return s;};
test('marking a part fitted records receipt and fitting without completing respray',()=>{
 const r=workflow.apply(fresh(),assets,{type:'confirmPartFitted',assetId:'83253',partId:'keyboard',expectedQty:1,expectedReceived:0,expectedFitted:0,qty:1});
 assert.equal(r.ok,true,r.error);const parts=r.workflow.jobs['83253'].parts;
 assert.equal(parts[0].received,1);assert.equal(parts[0].fitted,1);assert.equal(parts[1].fitted,0);
 assert(r.workflow.audit.some(x=>x.type==='Part fitted'&&x.assetId==='83253'));
});
test('stale confirmations fail without editing quantities',()=>{
 const r=workflow.apply(fresh(),assets,{type:'confirmPartFitted',assetId:'83253',partId:'keyboard',expectedQty:1,expectedReceived:1,expectedFitted:0,qty:1});
 assert.equal(r.ok,false);
});
test('respray cannot be fitted through the replacement-part shortcut',()=>{
 const r=workflow.apply(fresh(),assets,{type:'confirmPartFitted',assetId:'83253',partId:'spray',expectedQty:1,expectedReceived:0,expectedFitted:0,qty:1});
 assert.equal(r.ok,false);
});
test('confirmed Microdream dispatch affects only selected pallet respray and is idempotent',()=>{
 const first=workflow.apply(fresh(),assets,{type:'dispatchResprayPallet',palletName:'551'});
 assert.equal(first.ok,true,first.error);assert.equal(first.dispatched,1);
 assert.equal(first.workflow.orders.length,1);
 assert.equal(first.workflow.orders[0].lines[0].partId,'spray');
 assert.equal(first.workflow.jobs['83253'].parts[0].fitted,0);
 assert.equal(first.workflow.jobs['83255'].parts[0].fitted,0);
 const again=workflow.apply(first.workflow,assets,{type:'dispatchResprayPallet',palletName:'551'});
 assert.equal(again.ok,true,again.error);assert.equal(again.dispatched,0);assert.equal(again.workflow.orders.length,1);
});
