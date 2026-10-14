'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),docs=require('../src/assignment-documents');
const data={locations:['LT PARTS'],pallets:[{name:'PALLET-0001',label:'Refurb batch',createdAt:'2026-10-14T10:00:00Z'}],items:[{id:'00001',pallet:'PALLET-0001',location:'Unassigned',model:'HP EliteBook',serial:'001234',ram:'16 GB',storage:'512 GB'},{id:'2',location:'LT PARTS',pallet:''},{id:'3',pallet:'PALLET-0001',deletedAt:'2026-01-01'},{id:'4',pallet:'PALLET-0002',location:'LT PARTS'}]};
test('Manifest uses only current active pallet members and recorded metadata',()=>{
 const before=JSON.stringify(data),meta=docs.select(data,'pallet','pallet-0001');assert.equal(meta.assets.length,1);assert.equal(meta.assets[0].id,'00001');const html=docs.manifestDocument(meta,'2026-10-14T11:00:00Z');assert.match(html,/00001/);assert.match(html,/001234/);assert.match(html,/Refurb batch/);assert.match(html,/14 Oct 2026/);assert.equal(JSON.stringify(data),before);assert.equal(docs.select(data,'location','LT PARTS').assets.length,1);
});
test('Thermal label geometry preserves integer printer dots and refuses dense names',()=>{
 for(const name of ['PALLET-0001','LT PARTS']){const geometry=docs.barcodeGeometry(name,'2x1',203);assert(geometry.dots>=1);assert.match(docs.labelDocument({...data.pallets[0],name,kind:'pallet'}),/@page\{size:50.8mm 25.4mm/);}
 assert.throws(()=>docs.barcodeGeometry('X'.repeat(80),'2x1',203),/too long/);assert.throws(()=>docs.barcodeGeometry('PALLET-0001','other',203),/Invalid/);
});
test('Empty pallets, missing dates and HTML text are handled literally',()=>{
 const empty={kind:'pallet',name:'PALLET-0002',label:'<script>bad</script>',assets:[]};assert.match(docs.manifestDocument(empty),/This pallet is empty/);assert.match(docs.manifestDocument(empty),/&lt;script&gt;/);assert.match(docs.labelDocument(empty),/Created: Not recorded/);assert.throws(()=>docs.select(data,'pallet','missing'),/no longer exists/);
});

test('Location labels omit creation text while pallet labels retain recorded dates',()=>{
 for(const createdAt of ['', '2026-10-14T10:00:00Z']){
  const markup=docs.labelDocument({kind:'location',name:'LT PARTS',createdAt});
  assert.match(markup,/LT PARTS/);assert.doesNotMatch(markup,/class="label-date"|Created:|Not recorded/);
 }
 assert.match(docs.labelDocument({...data.pallets[0],kind:'pallet'}),/Created: 14 Oct 2026/);
});
