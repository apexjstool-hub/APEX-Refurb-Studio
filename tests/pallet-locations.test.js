'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../src/pallet-management');
const fixture=()=>({locations:['Repair room'],palletLocations:[],pallets:[{name:'PALLET-0001',label:'Batch A',location:'Legacy warehouse'},{name:'PALLET-0002',label:'Batch B'}],items:[{id:'A',pallet:'PALLET-0001',location:'Unassigned'},{id:'B',pallet:'PALLET-0001',location:'Unassigned'}]});
test('pallet locations are separate, case-insensitive and retain empty locations',()=>{
 const db=fixture();assert.equal(P.createPalletLocation(db,{name:'Rack A'}).ok,true);assert.equal(P.createPalletLocation(db,{name:' rack a '}).ok,false);assert.equal(P.createPalletLocation(db,{name:'<bad>'}).ok,false);
 assert.deepEqual(db.locations,['Repair room']);assert.deepEqual(P.palletLocations(db),['Rack A']);
});
test('whole-pallet moves persist, retain every pallet and never alter device membership',()=>{
 const db=fixture();P.createPalletLocation(db,{name:'Rack A'});P.createPalletLocation(db,{name:'Rack B'});const assignments=items=>items.map(({history,updatedAt,...a})=>a);const before=JSON.stringify(assignments(db.items));
 let result=P.movePallets(db,{names:['PALLET-0001','PALLET-0002'],location:'Rack A',expected:[{name:'PALLET-0001',location:''},{name:'PALLET-0002',location:''}]});
 assert.equal(result.ok,true);assert.equal(result.moved,2);assert.equal(result.pallets.length,2);assert.equal(result.pallets.filter(p=>p.storageLocation==='Rack A').length,2);assert.equal(JSON.stringify(assignments(db.items)),before);assert(db.items.every(a=>a.history.length===1&&a.history[0].type==='Pallet location'&&a.history[0].detail.includes('Unassigned → Rack A')));assert.equal(db.pallets[0].location,'Legacy warehouse');
 const reloaded=JSON.parse(JSON.stringify(db));result=P.movePallets(reloaded,{names:['PALLET-0001'],location:'Rack B',expected:[{name:'PALLET-0001',location:'Rack A'}]});assert.equal(result.ok,true);
 assert.equal(result.pallets.filter(p=>p.storageLocation==='Rack A').length,1);assert.equal(result.pallets.filter(p=>p.storageLocation==='Rack B').length,1);assert.equal(result.pallets[0].assets,2);
 result=P.movePallets(reloaded,{names:['PALLET-0001'],location:'',expected:[{name:'PALLET-0001',location:'Rack B'}]});assert.equal(result.ok,true);assert.equal(P.listPallets(reloaded).length,2);assert.deepEqual(P.palletLocations(reloaded),['Rack A','Rack B']);
});
test('invalid, duplicate and stale pallet selections cause no partial changes',()=>{
 for(const input of [
 {names:['PALLET-0001','UNKNOWN'],location:'Rack A',expected:[{name:'PALLET-0001',location:''},{name:'UNKNOWN',location:''}]},
 {names:['PALLET-0001'],location:'UNKNOWN',expected:[{name:'PALLET-0001',location:''}]},
 {names:['PALLET-0001','PALLET-0001'],location:'Rack A',expected:[]},
 {names:['PALLET-0001'],location:'Rack A',expected:[{name:'PALLET-0001',location:'Rack B'}]},
 {names:[],location:'Rack A',expected:[]}]){
 const db=fixture();P.createPalletLocation(db,{name:'Rack A'});const before=JSON.stringify(db);assert.equal(P.movePallets(db,input).ok,false);assert.equal(JSON.stringify(db),before);
 }
});
test('historical inferred pallets can be assigned without changing or losing their devices',()=>{
 const db=fixture();db.items.push({id:'C',pallet:'OLD-PALLET',location:'Unassigned'});P.createPalletLocation(db,{name:'Rack A'});
 assert.equal(P.movePallets(db,{names:['OLD-PALLET'],location:'Rack A',expected:[{name:'OLD-PALLET',location:''}]}).ok,true);
 assert.equal(P.listPallets(db).length,3);assert.equal(P.listPallets(db).find(p=>p.name==='OLD-PALLET').assets,1);
});

test('only empty pallet locations can be deleted and no pallet/device records are removed',()=>{
 const db=fixture();P.createPalletLocation(db,{name:'Empty rack'});P.createPalletLocation(db,{name:'Full rack'});
 P.movePallets(db,{names:['PALLET-0002'],location:'Full rack',expected:[{name:'PALLET-0002',location:''}]});
 const before=JSON.stringify(db);assert.equal(P.deletePalletLocation(db,{name:'Full rack'}).ok,false);assert.equal(JSON.stringify(db),before);
 const palletsBefore=JSON.stringify(db.pallets),itemsBefore=JSON.stringify(db.items);
 assert.equal(P.deletePalletLocation(db,{name:'empty RACK'}).ok,true);assert.deepEqual(P.palletLocations(db),['Full rack']);assert.equal(JSON.stringify(db.pallets),palletsBefore);assert.equal(JSON.stringify(db.items),itemsBefore);
 assert.equal(P.deletePalletLocation(db,{name:'Missing'}).ok,false);
});
test('custom pallet names preserve case, support punctuation, stay unique and work for assignments',()=>{
 const db=fixture(),name="John's returns / Batch #3";
 const created=P.createPallet(db,{name,label:'Custom batch'});assert.equal(created.ok,true);assert.equal(created.pallet.name,name);
 assert.equal(P.createPallet(db,{name:name.toUpperCase()}).ok,false);
 assert.equal(P.createPallet(db,{name:'<bad>'}).ok,false);assert.equal(P.createPallet(db,{name:'x'.repeat(81)}).ok,false);
 assert.equal(P.moveBatch(db,{ids:['A'],pallet:name}).ok,true);assert.equal(db.items[0].pallet,name);assert.equal(P.listPallets(db).find(p=>p.name===name).assets,1);
 assert.equal(P.deletePallet(db,{name}).ok,false);
});

test('Rename occupied, empty and inferred pallets without changing contents or storage',()=>{
 const db={locations:['Inspection'],pallets:[{name:'Old pallet',label:'Keep label',storageLocation:'Rack A',createdAt:'2025-01-01'},{name:'Other'}],items:[{id:'A',pallet:'Old pallet',location:'Unassigned',history:[],refurbNotes:'Keep notes'},{id:'B',pallet:'OLD PALLET',location:'Inspection',history:[]},{id:'C',pallet:'Other',history:[]}]};
 const r=P.renamePallet(db,{name:'Old pallet',newName:'Custom / Batch 7'});assert.equal(r.ok,true);assert.equal(r.renamed,2);assert.equal(db.items[0].pallet,'Custom / Batch 7');assert.equal(db.items[1].pallet,'Custom / Batch 7');assert.equal(db.items[1].location,'Inspection');assert.equal(db.items[0].refurbNotes,'Keep notes');assert.equal(db.items[2].pallet,'Other');assert.equal(db.pallets[0].storageLocation,'Rack A');assert.equal(db.pallets[0].createdAt,'2025-01-01');assert.equal(db.pallets[0].label,'Keep label');assert.equal(db.items[0].history.at(-1).type,'Pallet assignment');
 for(const newName of ['Other','','<bad>','a'.repeat(81)]){const before=JSON.stringify(db);assert.equal(P.renamePallet(db,{name:'Custom / Batch 7',newName}).ok,false);assert.equal(JSON.stringify(db),before);}
 assert.equal(P.renamePallet(db,{name:'Old pallet',newName:'Stale'}).ok,false);
 assert.equal(P.renamePallet(db,{name:'Custom / Batch 7',newName:'CUSTOM / BATCH 7'}).ok,true);assert.equal(db.items[0].pallet,'CUSTOM / BATCH 7');
 const before=JSON.stringify(db);assert.equal(P.renamePallet(db,{name:'CUSTOM / BATCH 7',newName:'CUSTOM / BATCH 7'}).renamed,0);assert.equal(JSON.stringify(db),before);
 assert.equal(P.renamePallet(db,{name:'Other',newName:'Empty renamed'}).ok,true);
 const legacy={items:[{id:'L',pallet:'Legacy',history:[]}]};assert.equal(P.renamePallet(legacy,{name:'Legacy',newName:'Registered now'}).ok,true);assert.equal(legacy.pallets[0].name,'Registered now');
});
