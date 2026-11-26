'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const flow=require('../src/refurb-workflow'),status=require('../src/inventory-workflow');
const ui=fs.readFileSync(path.join(__dirname,'../src/renderer/microdream-simple-centre.js'),'utf8');
const locations=fs.readFileSync(path.join(__dirname,'../src/renderer/pallet-locations.js'),'utf8');
const markup=fs.readFileSync(path.join(__dirname,'../src/renderer/index.html'),'utf8');
const part=(id,name)=>({id,name,qty:1,received:0,fitted:0});
const assets=[{id:'A1',pallet:'IR-560'},{id:'A2',pallet:'IR-560'},{id:'B1',pallet:'IR-561'}];
const start=()=>flow.init({jobs:{
 A1:{assetId:'A1',status:'Awaiting Parts',parts:[part('spray1','Full respray'),part('battery','Replacement battery')],qc:{}},
 A2:{assetId:'A2',status:'Awaiting Parts',parts:[part('battery2','Replacement battery')],qc:{}},
 B1:{assetId:'B1',status:'Awaiting Parts',parts:[part('spray2','Keyboard respray')],qc:{}}
},orders:[],audit:[]});
const save=(state,ids,existing)=>flow.apply(state,assets,{type:'saveResprayAssignment',palletName:'REF:MD100241187-7',reference:'MD100241187-7',assetIds:ids,expectedAssignmentId:existing?.id||null,expectedUpdatedAt:existing?.updatedAt||''});
test('Simple scan UI is mounted at Microdream and does not write asset pallet or location',()=>{
 assert.match(markup,/microdream-simple-centre\.js/);
 assert.match(locations,/ApexMicrodreamSimple\?\.mount\(detail\)/);
 assert.match(ui,/mdSimpleScan/);assert.match(ui,/Pallet number or Asset ID/);assert.match(ui,/Add to review/);
 assert.match(ui,/Add selected to reference/);assert.match(ui,/Confirm dispatched/);
 assert.match(ui,/input\.checked/);assert.match(ui,/preview\.filter\(eligible\)/);
 assert.doesNotMatch(ui,/api\.(?:update|movePallets|moveAssets|bulkMove)\s*\(/);
});
test('Original IR-560 and IR-561 assets join one reference independently of physical pallet location',()=>{
 const original=JSON.stringify(assets),first=save(start(),['A1']);
 assert.equal(first.ok,true,first.error);
 const next=save(first.workflow,['A1','B1'],first.assignment);
 assert.equal(next.ok,true,next.error);assert.deepEqual(next.assignment.sourcePallets,['IR-560','IR-561']);
 assert.equal(JSON.stringify(assets),original);
 assert.equal(next.workflow.jobs.A1.parts[1].fitted,0);
 const sent=flow.apply(next.workflow,assets,{type:'dispatchResprayPallet',palletName:'REF:MD100241187-7'});
 assert.equal(sent.ok,true,sent.error);assert.deepEqual(sent.resprayPallet.manifest.map(m=>m.assetId),['A1','B1']);
 assert.equal(sent.resprayPallet.reference,'MD100241187-7');
 assert.equal(status.index(sent.workflow).get('A1').resprayStatus,'Sent for Respray');
 assert.equal(JSON.stringify(assets),original);
});
test('Parts-only asset cannot be added and stale snapshot is rejected',()=>{
 const first=save(start(),['A1']);assert.equal(first.ok,true);
 assert.equal(save(first.workflow,['A1','A2'],first.assignment).ok,false);
 const stale=flow.apply(first.workflow,assets,{type:'saveResprayAssignment',palletName:'REF:MD100241187-7',reference:'MD100241187-7',assetIds:['A1','B1'],expectedAssignmentId:'wrong',expectedUpdatedAt:''});
 assert.equal(stale.ok,false);
});
test('Return and completion update respray only; ordered replacement remains unfinished',()=>{
 const first=save(start(),['A1','B1']);
 const sent=flow.apply(first.workflow,assets,{type:'dispatchResprayPallet',palletName:'REF:MD100241187-7'});
 const returned=flow.apply(sent.workflow,assets,{type:'returnResprayPallet',palletName:'REF:MD100241187-7',expectedDispatchId:sent.resprayPallet.id});
 assert.equal(returned.ok,true,returned.error);
 const complete=flow.apply(returned.workflow,assets,{type:'completeResprayPallet',palletName:'REF:MD100241187-7',expectedDispatchId:sent.resprayPallet.id,confirmChecked:true});
 assert.equal(complete.ok,true,complete.error);
 assert.equal(complete.workflow.jobs.A1.parts[0].fitted,1);
 assert.equal(complete.workflow.jobs.A1.parts[1].fitted,0);
 assert.equal(status.index(complete.workflow).get('A1').resprayStatus,'Respray Completed');
});
