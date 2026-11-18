'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const {build}=require('../src/inventory-performance');
function asset(i){
 return {id:'ASSET-'+String(i).padStart(6,'0'),model:'Latitude '+(5400+i%20),manufacturer:i%2?'Dell':'HP',serial:'S'+i,
 location:i%3?'Warehouse A':'Warehouse B',pallet:'PAL-'+i%10,sku:'SKU-'+i,processor:'Core i5',
 gpu:'Intel',productType:'Laptop',createdAt:new Date(1700000000000+i*5000).toISOString(),
 status:i%4?'Processed':'Awaiting Processing',grade:i%9?'B':'D',condition:i%7?'B':'D'};
}
test('preindexed search is case-insensitive and respects all filters',()=>{
 const items=Array.from({length:400},(_,i)=>asset(i));const index=build(items);
 assert.equal(index.stats.total,400);
 assert.equal(index.filter({query:'asset-000018'}).length,1);
 assert.equal(index.filter({query:'ASSET-000018'})[0].id,'ASSET-000018');
 assert.equal(index.filter({query:'does not exist'}).length,0);
 const filtered=index.filter({query:'Latitude',location:'Warehouse A',grade:'B',status:'Processed',matches:a=>a.id.endsWith('2')});
 const expected=items.filter(a=>a.model.includes('Latitude')&&a.location==='Warehouse A'&&a.grade==='B'&&a.status==='Processed'&&a.id.endsWith('2'));
 assert.deepEqual(filtered.map(a=>a.id).sort(),expected.map(a=>a.id).sort());
 assert.equal(index.sorted[0].id,items.at(-1).id);
});
test('inventory index is a read-only snapshot and does not modify asset order or fields',()=>{
 const items=Array.from({length:50},(_,i)=>asset(i));
 const before=JSON.stringify(items);const index=build(items);index.filter({query:'hp'});
 assert.equal(JSON.stringify(items),before);
 assert.equal(index.stats.processed,items.filter(a=>a.status==='Processed').length);
 assert.equal(index.stats.awaiting,items.filter(a=>a.status==='Awaiting Processing').length);
 assert.equal(index.stats.needsRepair,items.filter(a=>a.grade==='D'||a.condition==='D').length);
});
test('thousands of assets are filtered promptly without reparsing createdAt per search',()=>{
 const items=Array.from({length:12000},(_,i)=>asset(i));
 const start=performance.now();const index=build(items);
 let found=0;
 for(let i=0;i<40;i++)found+=index.filter({query:'ASSET-01199'}).length;
 const elapsed=performance.now()-start;
 assert.ok(found>0);
 assert.ok(elapsed<8000,'12,000 asset index and 40 searches should remain under a generous 8s limit, measured '+elapsed+'ms');
});
test('cloud lightweight checks remain opt-in and retain normal full-snapshot path',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../src/main.js'),'utf8');
 const renderer=fs.readFileSync(path.join(__dirname,'../src/renderer/app.js'),'utf8');
 assert.match(main,/backgroundRefresh=route\.startsWith\('\/v1\/items\?background=1'\)/);
 assert.match(main,/cloudReadAssetRevisions/);
 assert.match(main,/lastCloudInventorySignature=cloudInventorySignature\(rows\)/);
 assert.match(main,/lastCloudMetaRevision=String\(meta\.data\.revision\)/);
 assert.match(main,/if\(identity!==lastCloudIdentity\)/);
 assert.match(renderer,/silent&&syncMode==='cloud'\?\{background:true\}/);
 assert.match(renderer,/inventoryIndex=null/);
});

test('repair worksheet includes saved Device Details refurb comments and repair job notes',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/renderer/refurb-ui.js'),'utf8');
 const start=source.indexOf('function worksheetMarkup(id)');
 const end=source.indexOf('let printCleanup=null;',start);
 assert.ok(start>=0&&end>start,'worksheet renderer exists');
 const worksheet=source.slice(start,end);
 assert.match(worksheet,/\['Refurbishment comments',a\.refurbNotes\]/);
 assert.match(worksheet,/\['Repair job notes',j\?\.notes\]/);
 assert.match(worksheet,/\['Cosmetic findings',cos\]/);
 assert.match(worksheet,/\['Inspection notes',notes\]/);
 assert.match(worksheet,/esc\(String\(value\)\.trim\(\)\)/,'user-provided comments must be HTML escaped');
 assert.match(worksheet,/worksheetNotesMarkup/,'print view must insert all saved notes');
 assert.match(source,/list\.map\(worksheetMarkup\)/,'batch worksheets share the same renderer');
});
