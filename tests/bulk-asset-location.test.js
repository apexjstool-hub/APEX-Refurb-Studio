'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('../src/inventory-core'),bulk=require('../src/bulk-asset-location');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const asset=(id,location,pallet)=>core.normalize({id,model:'Latitude 5420',manufacturer:'Dell',location,pallet,status:'Processed',createdAt:'2026-01-01T00:00:00Z'});
const db=()=>({locations:['Warehouse A','Testing','Repaired'],palletLocations:['Rack 12'],pallets:[{name:'PALLET-1',storageLocation:'Rack 12'},{name:'PALLET-2',storageLocation:'Rack 12'}],items:[asset('ASSET-1','Warehouse A','PALLET-1'),asset('ASSET-2','Testing','PALLET-2'),asset('ASSET-3','Warehouse A','')]});
const input=(d,ids,location='Repaired')=>({ids,location,expectedAssignments:ids.map(id=>{const a=d.items.find(x=>x.id===id);return {id,location:a.location,pallet:a.pallet,updatedAt:a.updatedAt};})});
test('Bulk location keeps pallet membership, pallet storage, other asset fields and history',()=>{
 const d=db(),before=JSON.stringify(d.pallets),palletLocations=JSON.stringify(d.palletLocations),prior=d.items[0].serial;
 const out=bulk.apply(d,input(d,['ASSET-1','ASSET-2','ASSET-3']));
 assert.equal(out.ok,true,out.error);assert.equal(out.updated,3);assert.equal(out.palletsPreserved,true);
 assert.deepEqual(d.items.map(a=>a.location),['Repaired','Repaired','Repaired']);
 assert.deepEqual(d.items.map(a=>a.pallet),['PALLET-1','PALLET-2','']);
 assert.equal(JSON.stringify(d.pallets),before);assert.equal(JSON.stringify(d.palletLocations),palletLocations);
 assert.equal(d.items[0].serial,prior);
 assert.ok(d.items[0].history.some(h=>h.type==='Transfer'&&h.detail.includes('Repaired')));
});
test('No-op location remains unchanged and does not append history',()=>{
 const d=db(),prior=JSON.stringify(d.items);
 const out=bulk.apply(d,input(d,['ASSET-1'],'Warehouse A'));
 assert.equal(out.ok,true);assert.equal(out.updated,0);assert.equal(out.unchanged,1);assert.equal(JSON.stringify(d.items),prior);
});
test('Reject missing location, stale pallet, stale direct location, duplicate and nonexistent assets atomically',()=>{
 const mutations=[
  i=>{i.location='Missing'},
  i=>{i.expectedAssignments[0].pallet='WRONG'},
  i=>{i.expectedAssignments[0].location='WRONG'},
  i=>{i.ids=['ASSET-1','ASSET-1']},
  i=>{i.ids=['ASSET-1','MISSING']},
  i=>{i.expectedAssignments[0].updatedAt='1999-01-01T00:00:00Z'},
 ];
 for(const mutate of mutations){
  const d=db(),prior=JSON.stringify(d),i=input(d,['ASSET-1','ASSET-2']);
  mutate(i);const out=bulk.apply(d,i);
  assert.equal(out.ok,false,JSON.stringify(i));
  assert.equal(JSON.stringify(d),prior,'failed batch must not modify local records');
 }
});
test('Bulk inventory UI calls location-only API, not destructive pallet bulkMove',()=>{
 const ui=read('src/renderer/inventory-bulk-location.js'),nav=read('src/renderer/inventory-selection.js'),preload=read('src/preload.js'),main=read('src/main.js'),html=read('src/renderer/index.html');
 assert.match(ui,/bulkSetAssetLocation/);
 assert.doesNotMatch(ui,/api\.bulkMove\(/);
 assert.match(ui,/All active inventory assets/);
 assert.match(ui,/selected \/ scanned assets/i);
 assert.match(nav,/inventoryBulkAssetLocationButton/);
 assert.match(preload,/inventory:bulkSetAssetLocation/);
 assert.match(main,/const bulkAssetLocation=require\('\.\/bulk-asset-location'\)/);
 assert.match(main,/location:check\.location/);
 assert.match(main,/palletsPreserved:true/);
 assert.match(html,/inventory-bulk-location\.js/);
});

test('Set asset locations button is attached only after bulk refurbishment button is mounted',()=>{
 const nav=read('src/renderer/inventory-selection.js');
 const attach=nav.indexOf("scan?.after(bulk);bulk.after(location);");
 assert.ok(attach>0,'Location button must be appended to the live DOM after bulk refurbishment');
 assert.ok(nav.indexOf("location.onclick=()=>window.ApexBulkAssetLocation?.open")<attach);
});

test('Undo Last Location Update restores direct location but leaves both pallet fields unchanged',()=>{
 const d=db(),oldPallets=JSON.stringify(d.pallets),snap=input(d,['ASSET-1','ASSET-2']);
 const apply=bulk.apply(d,{...snap,batchId:'loc-test-2026'});
 assert.equal(apply.ok,true);assert.equal(apply.changes.length,2);
 const undone=bulk.undo(d,{id:'loc-test-2026',changes:apply.changes});
 assert.equal(undone.ok,true,undone.error);
 assert.deepEqual(d.items.slice(0,2).map(a=>a.location),['Warehouse A','Testing']);
 assert.deepEqual(d.items.slice(0,2).map(a=>a.pallet),['PALLET-1','PALLET-2']);
 assert.equal(JSON.stringify(d.pallets),oldPallets);
 assert.ok(d.items[0].history.some(h=>h.type==='Bulk location update'));
 assert.ok(d.items[0].history.some(h=>h.type==='Bulk location undo'));
});
test('Undo refuses later changes and does not partly revert a local batch',()=>{
 const d=db(),apply=bulk.apply(d,{...input(d,['ASSET-1','ASSET-2']),batchId:'loc-test-2026'});
 assert.equal(apply.ok,true);
 const result=core.update(d.items,'ASSET-2',{location:'Testing'});
 assert.equal(result.ok,true);
 const before=JSON.stringify(d);
 const undo=bulk.undo(d,{id:'loc-test-2026',changes:apply.changes});
 assert.equal(undo.ok,false);assert.equal(JSON.stringify(d),before);
});
test('Bulk location UI previews old/new/pallet, creates a new location and exposes undo',()=>{
 const ui=read('src/renderer/inventory-bulk-location.js'),main=read('src/main.js'),preload=read('src/preload.js');
 for(const id of ['apexLocationReview','apexLocationCreate','apexLocationUndo','apexLocationUndoSummary'])assert.ok(ui.includes(id));
 assert.match(ui,/Current location/);assert.match(ui,/New location/);assert.match(ui,/Pallet \(unchanged\)/);
 assert.match(ui,/api\.addLocation/);assert.match(ui,/api\.undoLastBulkAssetLocation/);assert.match(ui,/groupId:batchGroup/);
 assert.match(preload,/undoLastBulkAssetLocation/);assert.match(main,/inventory:undoLastBulkAssetLocation/);
 assert.match(main,/logLocationUpdates/);
});
