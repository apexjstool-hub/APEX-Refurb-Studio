'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const qa=require('../src/renderer/completed-qa-core');
const pallets=require('../src/pallet-management');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const asset=(id,pallet,location='Unassigned')=>({id,pallet,location,manufacturer:'HP',model:'ProBook',serial:'S-'+id});
test('Completed QA partitions by pallet storage location while preserving original pallet and inventory fields',()=>{
 const assets=[asset('1','PALLET-0001'),asset('2','PALLET-0002'),asset('3','',qa.NAME),asset('4','PALLET-0002')];
 const before=structuredClone(assets);
 const all=[{name:'PALLET-0001',storageLocation:qa.NAME},{name:'PALLET-0002',storageLocation:'Rack 1'}];
 const p=qa.partition(assets,all);
 assert.deepEqual(p.archived.map(a=>a.id),['1','3']);assert.deepEqual(p.active.map(a=>a.id),['2','4']);
 assert.deepEqual(p.archivedPallets.map(p=>p.name),['PALLET-0001']);assert.deepEqual(assets,before);
});
test('Pallet location move archives entire pallet and moving it back restores assets without changing pallet IDs',()=>{
 const db={items:[asset('A','P-100'),asset('B','P-100'),asset('C','P-200')],pallets:[{name:'P-100',storageLocation:'Rack 1'},{name:'P-200',storageLocation:''}],palletLocations:['Rack 1',qa.NAME],locations:['Unassigned']};
 const base=qa.partition(db.items,pallets.listPallets(db));assert.equal(base.archived.length,0);
 const moved=pallets.movePallets(db,{names:['P-100'],location:qa.NAME,expected:[{name:'P-100',location:'Rack 1'}]});assert.equal(moved.ok,true,JSON.stringify(moved));
 const archived=qa.partition(db.items,pallets.listPallets(db));assert.deepEqual(archived.archived.map(a=>a.id),['A','B']);assert.equal(db.items[0].pallet,'P-100');
 const restored=pallets.movePallets(db,{names:['P-100'],location:'',expected:[{name:'P-100',location:qa.NAME}]});assert.equal(restored.ok,true,JSON.stringify(restored));
 assert.equal(qa.partition(db.items,pallets.listPallets(db)).archived.length,0);
 assert.equal(db.items[0].pallet,'P-100');
});
test('Manifest reports explicit job, repair and respray statuses without inventing completion',()=>{
 const assets=[asset('A','P-100'),asset('B','P-100')];
 const workflow={jobs:{A:{assetId:'A',status:'Completed',parts:[{name:'Keyboard',qty:1,fitted:1},{name:'Full respray',qty:1,fitted:1}],qc:Object.fromEntries(qa.status(assets[0],{}).job?.qc||[])},B:{assetId:'B',status:'Awaiting Parts',parts:[{name:'LCD',qty:1,fitted:0},{name:'Lid respray',qty:1,fitted:0}],qc:{}}}};
 const results=qa.manifest(assets,workflow);
 assert.equal(results[0].refurbStatus,'Completed');assert.equal(results[0].partsStatus,'Repair completed');assert.equal(results[0].sprayStatus,'Respray completed');
 assert.equal(results[1].partsStatus,'Repair outstanding');assert.equal(results[1].sprayStatus,'Respray outstanding');assert.equal(results[1].qcStatus,'0/4 checks');
 assert.equal(results[0].location,qa.NAME);assert.equal(results[0].pallet,'P-100');
});
test('No repair job is not represented as completed',()=>{
 const r=qa.status(asset('X','P-100'),{});assert.equal(r.refurbStatus,'No refurbishment record');assert.equal(r.partsStatus,'Not recorded');assert.equal(r.sprayStatus,'Not recorded');
});
test('Pages hide archived assets from active all-pages model; QA interface has dedicated print and reversible controls',()=>{
 const app=read('src/renderer/app.js'),html=read('src/renderer/index.html'),ui=read('src/renderer/completed-qa-ui.js'),nav=read('src/renderer/v3-ui.js'),loc=read('src/renderer/pallet-locations.js');
 assert.match(app,/items=qa\.active/);assert.match(app,/managedPallets=qa\.activePallets/);assert.match(app,/window\.ApexCompletedQAArchive=/);
 assert.match(html,/id="completedQAPage"/);assert.match(html,/src="completed-qa-core\.js"/);assert.match(html,/src="completed-qa-ui\.js"/);
 assert.match(nav,/\['completedQA','Completed QA'\]/);assert.match(loc,/locations=names\(\)\.filter/);
 assert.match(ui,/api\.movePallets/);assert.match(ui,/api\.update/);assert.match(ui,/Print QA manifest/);assert.match(ui,/ApexReportPreview/);
 assert.doesNotMatch(ui,/deleteAsset|api\.remove|diagnosticTests\s*=/);
});
