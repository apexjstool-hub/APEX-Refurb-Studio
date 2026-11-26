'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const workflow=require('../src/refurb-workflow'),docs=require('../src/microdream-documents');
const assets=[
 {id:'A1',pallet:'IR-560',manufacturer:'Dell',model:'Latitude 5420'},
 {id:'A2',pallet:'IR-560',manufacturer:'HP',model:'EliteBook 840'},
 {id:'B1',pallet:'IR-561',manufacturer:'Dell',model:'Latitude 5420'},
 {id:'C1',pallet:'IR-562',manufacturer:'HP',model:'EliteBook 840'}
];
function setup(){
 const jobs={};for(const a of assets)jobs[a.id]={assetId:a.id,status:'Awaiting Parts',parts:[{id:'part-'+a.id,name:a.id==='A2'?'Replacement battery':'Full respray',qty:1,received:0,fitted:0}],qc:{}};
 jobs.A1.parts.push({id:'battery',name:'Replacement battery',qty:1,received:0,fitted:0});
 return workflow.init({jobs,orders:[],audit:[]});
}
function save(s,ids,expected){return workflow.apply(s,assets,{type:'saveResprayAssignment',palletName:'NEXT RESPRAY PALLET',reference:'MD100241187-7',assetIds:ids,expectedAssignmentId:expected?.id||null,expectedUpdatedAt:expected?.updatedAt||''});}
test('Multiple original pallets share one Microdream reference with original assignments unchanged',()=>{
 const unchanged=JSON.stringify(assets),saved=save(setup(),['A1','B1','C1']);
 assert.equal(saved.ok,true,saved.error);
 assert.deepEqual(saved.assignment.sourcePallets,['IR-560','IR-561','IR-562']);
 assert.equal(saved.assignment.reference,'MD100241187-7');
 assert.equal(JSON.stringify(assets),unchanged);
 const sent=workflow.apply(saved.workflow,assets,{type:'dispatchResprayPallet',palletName:'NEXT RESPRAY PALLET'});
 assert.equal(sent.ok,true,sent.error);assert.equal(sent.affected,3);
 assert.deepEqual(sent.resprayPallet.manifest.map(x=>x.originalPallet),['IR-560','IR-561','IR-562']);
 assert.deepEqual(sent.resprayPallet.manifest.flatMap(x=>x.parts.map(p=>p.partId)),['part-A1','part-B1','part-C1']);
 assert.equal(sent.workflow.jobs.A1.parts[1].fitted,0,'battery stays separate');
 assert.equal(JSON.stringify(assets),unchanged);
});
test('Parts-only assets are excluded even when their original pallet was moved into Microdream',()=>{
 const saved=save(setup(),['A1','A2','B1']);assert.equal(saved.ok,false);
 assert.match(saved.error,/no outstanding respray/i);
});
test('Reports select respray-only assets from three original pallets using same Microdream reference',()=>{
 const saved=save(setup(),['A1','B1','C1']);assert.equal(saved.ok,true);
 const doc=docs.select({items:assets,pallets:[{name:'NEXT RESPRAY PALLET',storageLocation:'Microdream'}],resprayAssignments:saved.workflow.resprayAssignments},{palletNames:['NEXT RESPRAY PALLET']});
 assert.equal(doc.total,3);assert.equal(doc.jobRef,'MD100241187-7');
 assert.equal(doc.rows.reduce((n,x)=>n+x.quantity,0),3);
 assert(!doc.fingerprint.includes('A2'));
});
test('Microdream UI preserves View inventory and offers separate View respray and bulk source pallet actions',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../src/renderer/pallet-locations.js'),'utf8');
 const respray=fs.readFileSync(path.join(__dirname,'../src/renderer/microdream-respray-ui.js'),'utf8');
 const status=fs.readFileSync(path.join(__dirname,'../src/renderer/pallets-microdream-status-v4118.js'),'utf8');
 assert.match(ui,/View inventory/);assert.match(ui,/View respray/);
 assert.match(ui,/data-pl-inventory/);assert.match(ui,/data-pl-view-respray/);
 assert.match(respray,/mdAssignmentSource/);assert.match(respray,/mdAssignmentAddPallet/);
 assert.match(status,/pl-respray-count/);assert.doesNotMatch(status,/inventoryCell\.textContent=assignedCount/);
});
