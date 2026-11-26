'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const workflow=require('../src/refurb-workflow');
const docs=require('../src/microdream-documents');
const records=[
 {id:'101',pallet:'IR-560',manufacturer:'Dell',model:'Latitude 5420'},
 {id:'102',pallet:'IR-560',manufacturer:'HP',model:'EliteBook 840'},
 {id:'103',pallet:'IR-560',manufacturer:'Dell',model:'Latitude 5410'},
 {id:'104',pallet:'IR-999',manufacturer:'Lenovo',model:'ThinkPad T14'}
];
const tasks=(id,name)=>({id,name,qty:1,received:0,fitted:0});
function state(){
 return workflow.init({jobs:{
  101:{assetId:'101',status:'Awaiting Parts',parts:[tasks('spray-1','Full respray'),tasks('battery','Replacement battery')],qc:{}},
  102:{assetId:'102',status:'Awaiting Parts',parts:[tasks('battery-2','Replacement battery')],qc:{}},
  103:{assetId:'103',status:'Awaiting Parts',parts:[tasks('spray-3','Keyboard respray')],qc:{}},
  104:{assetId:'104',status:'Awaiting Parts',parts:[tasks('spray-4','Lid respray')],qc:{}}
 },orders:[],audit:[]});
}
const assign=(s,ids,extra={})=>workflow.apply(s,records,{type:'saveResprayAssignment',palletName:'NEXT RESPRAY PALLET',reference:'MD100241187-7',assetIds:ids,expectedAssignmentId:extra.id||null,expectedUpdatedAt:extra.updatedAt||''});
test('respray assigns assets from original IR-560 without changing original pallet',()=>{
 const s=state(),initial=JSON.stringify(records);
 const result=assign(s,['101','103']);
 assert.equal(result.ok,true,result.error);
 assert.deepEqual(result.assignment.assetIds,['101','103']);
 assert.equal(result.assignment.reference,'MD100241187-7');
 assert.equal(JSON.stringify(records),initial);
 assert.equal(result.workflow.jobs['101'].parts.find(x=>x.id==='battery').fitted,0);
});
test('non-respray assets and duplicate IDs cannot enter Microdream respray assignment',()=>{
 assert.equal(assign(state(),['102']).ok,false);
 assert.equal(assign(state(),['101','101']).ok,false);
});
test('can save another original pallet asset to same respray box and reject stale updates',()=>{
 const first=assign(state(),['101','103']);
 assert.equal(first.ok,true,first.error);
 const updated=assign(first.workflow,['101','103','104'],first.assignment);
 assert.equal(updated.ok,true,updated.error);
 assert.equal(assign(updated.workflow,['101'],first.assignment).ok,false);
});
test('dispatch snapshots only assigned respray assets, with reference and original pallet',()=>{
 const first=assign(state(),['101','103']);
 const sent=workflow.apply(first.workflow,records,{type:'dispatchResprayPallet',palletName:'NEXT RESPRAY PALLET'});
 assert.equal(sent.ok,true,sent.error);assert.equal(sent.affected,2);
 assert.equal(sent.resprayPallet.reference,'MD100241187-7');
 assert.deepEqual(sent.resprayPallet.manifest.map(x=>x.assetId),['101','103']);
 assert.deepEqual(sent.resprayPallet.manifest.map(x=>x.originalPallet),['IR-560','IR-560']);
 assert.deepEqual(sent.resprayPallet.manifest[0].parts.map(x=>x.partId),['spray-1']);
 assert.equal(sent.workflow.resprayAssignments.length,0);
 assert.equal(records[0].pallet,'IR-560');
});
test('assigned Microdream document uses only respray assets and retains reference',()=>{
 const a=assign(state(),['101','103']);
 const data={items:records,pallets:[{name:'NEXT RESPRAY PALLET',storageLocation:'Microdream'}],resprayAssignments:a.workflow.resprayAssignments};
 const doc=docs.select(data,{palletNames:['NEXT RESPRAY PALLET']});
 assert.equal(doc.jobRef,'MD100241187-7');
 assert.equal(doc.total,2);
 assert.equal(doc.rows.reduce((n,x)=>n+x.quantity,0),2);
 assert(!doc.fingerprint.includes('102'));
});
test('assets already assigned to a Microdream box cannot be double-booked',()=>{
 const a=assign(state(),['101']);
 const result=workflow.apply(a.workflow,records,{type:'saveResprayAssignment',palletName:'SECOND MD BOX',reference:'MD-SECOND',assetIds:['101'],expectedAssignmentId:null,expectedUpdatedAt:''});
 assert.equal(result.ok,false);
});
