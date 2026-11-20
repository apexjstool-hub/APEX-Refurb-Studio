'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Scan page shows separate pallet and asset-location inputs under one scanned list',()=>{
 const html=read('src/renderer/index.html');
 for(const id of ['v346DeviceList','v346Destination','v346AssetLocation','v346MoveLocation','v346SetAssetLocation','scanCreatePallet','v346CreateAssetLocation','v346UndoAssetLocation','v346InlineReview','v346ReviewConfirm','v346ReviewCancel']){
  assert.match(html,new RegExp('id="'+id+'"'),id+' must exist');
 }
 assert.match(html,/Move to pallet/);
 assert.match(html,/Set asset location/);
 assert.match(html,/Only devices in the scanned list are affected/);
 assert.match(html,/scan-unified-location.css/);
});
test('Existing Scan list expands pallet scan to asset IDs and supports undo',()=>{
 const js=read('src/renderer/v346-simple-scan.js');
 assert.match(js,/const matches=items\.filter\(a=>!a\.deletedAt&&upper\(a\.pallet\)===upper\(pallet\.name\)\)/);
 assert.match(js,/batch\.push\(\.\.\.fresh\.map\(a=>a\.id\)\)/);
 assert.match(js,/lastMove=\{destination:planned\.destination/);
 assert.match(js,/api\.undoBulkMove/);
 assert.match(js,/v346Destinations'\)\.innerHTML=pallets\(\)/);
 assert.match(js,/v346AssetLocationOptions'\)\.innerHTML=locations\(\)/);
});
test('Pallet create fills pallet input and separate location action preserves pallet via secured API',()=>{
 const js=read('src/renderer/v346-simple-scan.js'),selection=read('src/renderer/inventory-selection.js'),main=read('src/main.js');
 assert.match(js,/ApexPalletPage\.create\(pallet=>\{el\('v346Destination'\)\.value=pallet\.name/);
 assert.match(js,/api\.bulkMove\(\{ids:entries\.map\(a=>a\.id\),pallet:planned\.destination/);
 assert.match(js,/api\.bulkSetAssetLocation\(\{ids:entries\.map\(a=>a\.id\),location:planned\.destination/);
 assert.match(js,/api\.lastBulkAssetLocation\(\)/);
 assert.match(js,/api\.undoLastBulkAssetLocation\(\)/);
 assert.match(js,/api\.addLocation\(name\)/);
 assert.match(selection,/ApexScanWorkspace\?\.openSelection\(\[\.\.\.selected\.inventory\]\)/);
 assert.doesNotMatch(selection,/ApexBulkAssetLocation\?\.open/);
 assert.match(main,/inventory:bulkSetAssetLocation/);
 assert.match(main,/bulkAssetLocation\.apply/);
});
test('Both pallet and asset location actions use inline review without a confirmation popup',()=>{
 const js=read('src/renderer/v346-simple-scan.js');
 const start=js.indexOf(' // Both destinations share one scan list');
 const end=js.indexOf(" el('scanCreatePallet').onclick=",start);
 assert.ok(start>=0&&end>start);
 const section=js.slice(start,end);
 assert.doesNotMatch(section,/showModal\(/);
 assert.match(section,/pendingReview=\{mode,destination/);
 assert.match(section,/v346InlineReview'\)\.hidden=false/);
 assert.match(section,/v346ReviewConfirm'\)\.onclick=async/);
 assert.match(section,/v346ReviewCancel'\)\.onclick=/);
 assert.match(section,/if\(planned\.mode==='pallet'\)/);
 assert.match(section,/else\{\s*\/\/ Cloud uses individually revision-checked writes/);
});
test('Direct asset location updates preserve pallets and have reversible history',()=>{
 const logic=require('../src/bulk-asset-location'),core=require('../src/inventory-core');
 const db={locations:['Testing','Refurb'],palletLocations:['Rack 4'],pallets:[{name:'PALLET-4',storageLocation:'Rack 4'}],items:[
  core.normalize({id:'T-1',model:'Latitude',location:'Testing',pallet:'PALLET-4'}),
  core.normalize({id:'T-2',model:'Latitude',location:'Testing',pallet:'PALLET-4'})
 ]};
 const snapshot=JSON.stringify(db.pallets),before=JSON.stringify(db.palletLocations);
 const result=logic.apply(db,{ids:['T-1','T-2'],location:'Refurb',batchId:'loc-rc6-test',expectedAssignments:db.items.map(a=>({id:a.id,location:a.location,pallet:a.pallet,updatedAt:a.updatedAt}))});
 assert.equal(result.ok,true,result.error);
 assert.equal(db.items[0].pallet,'PALLET-4');
 assert.equal(JSON.stringify(db.pallets),snapshot);assert.equal(JSON.stringify(db.palletLocations),before);
 const reversed=logic.undo(db,{id:'loc-rc6-test',changes:result.changes});
 assert.equal(reversed.ok,true,reversed.error);
 assert.equal(db.items[0].location,'Testing');assert.equal(db.items[1].pallet,'PALLET-4');
});
