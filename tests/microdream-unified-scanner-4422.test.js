'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const flow=require('../src/refurb-workflow'),view=require('../src/inventory-workflow');
const scanner=fs.readFileSync(path.join(__dirname,'../src/renderer/microdream-simple-centre.js'),'utf8');
const parts=(id,name)=>({id,name,qty:1,received:0,fitted:0});
const assets=[{id:'83253',pallet:'IR-560',model:'Dell Latitude'},{id:'83254',pallet:'IR-560',model:'HP EliteBook'},{id:'83255',pallet:'IR-561',model:'Lenovo ThinkPad'}];
const state=()=>flow.init({jobs:{
 83253:{assetId:'83253',status:'Awaiting Parts',parts:[parts('spray1','Full respray'),parts('battery1','Replacement battery')],qc:{}},
 83254:{assetId:'83254',status:'Awaiting Parts',parts:[parts('battery2','Replacement battery')],qc:{}},
 83255:{assetId:'83255',status:'Awaiting Parts',parts:[parts('spray2','Keyboard respray')],qc:{}}
},orders:[],audit:[]});
const save=(s,ids,existing)=>flow.apply(s,assets,{type:'saveResprayAssignment',palletName:'REF:MD100241187-7',reference:'MD100241187-7',assetIds:ids,expectedAssignmentId:existing?.id||null,expectedUpdatedAt:existing?.updatedAt||''});
test('Scanner accepts both a pallet number and an Asset ID in a single input',()=>{
 assert.match(scanner,/Pallet number or Asset ID/);
 assert.match(scanner,/const palletAssets=assets\.filter/);
 assert.match(scanner,/const asset=assets\.find/);
 assert.match(scanner,/const found=palletAssets\.length\?palletAssets:asset\?\[asset\]:\[\]/);
 assert.match(scanner,/preview=\[\.\.\.preview,\.\.\.added\]/);
 assert.match(scanner,/const previously=new Set\(preview\.map/);
 assert.match(scanner,/if\(eligible\(a\)\)selected\.add/);
 assert.match(scanner,/mdSimpleClear/);
 assert.match(scanner,/referenceDraft/);
 assert.doesNotMatch(scanner,/api\.(?:movePallets|update|bulkMove)\(/);
});
test('Existing reference receives individually scanned assets from different pallets, no duplicates',()=>{
 const frozen=JSON.stringify(assets),first=save(state(),['83253']);
 assert.equal(first.ok,true,first.error);
 const second=save(first.workflow,['83253','83255'],first.assignment);
 assert.equal(second.ok,true,second.error);
 assert.deepEqual(second.assignment.assetIds,['83253','83255']);
 assert.deepEqual(second.assignment.sourcePallets,['IR-560','IR-561']);
 assert.equal(JSON.stringify(assets),frozen);
 assert.equal(second.workflow.jobs['83253'].parts[1].fitted,0);
 const dispatched=flow.apply(second.workflow,assets,{type:'dispatchResprayPallet',palletName:'REF:MD100241187-7'});
 assert.equal(dispatched.ok,true,dispatched.error);
 assert.deepEqual(dispatched.resprayPallet.manifest.map(row=>row.assetId),['83253','83255']);
 assert.equal(view.index(dispatched.workflow).get('83253').resprayStatus,'Sent for Respray');
 assert.equal(JSON.stringify(assets),frozen);
});
test('A parts-only individual Asset ID cannot be assigned as respray',()=>{
 const result=save(state(),['83254']);
 assert.equal(result.ok,false);
 assert.match(result.error,/no outstanding respray/i);
});
