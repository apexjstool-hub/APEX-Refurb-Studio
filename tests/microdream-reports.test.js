'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),reports=require('../src/microdream-reports');
function fixture(){return {pallets:[{name:'MD-1',storageLocation:'MICRODREAM',createdAt:'2026-01-01T01:00:00Z'},{name:'MD-2',storageLocation:'MICRODREAM',createdAt:'2026-01-02T01:00:00Z'}],items:[{id:'A',model:'Latitude 5420',manufacturer:'Dell',pallet:'MD-1'},{id:'B',model:'Latitude 5420',manufacturer:'Dell',pallet:'MD-1'},{id:'C',model:'EliteBook',manufacturer:'HP',pallet:'MD-2'}]};}
function create(db,extra={}){return reports.apply(db,{action:'create',palletNames:['MD-1','MD-2'],requestId:randomUUID(),...extra});}
test('Each pallet has its own durable report; restart, moved devices and ref updates retain original snapshot',()=>{
 let db=fixture();const r=create(db,{jobRef:'ORIGINAL'});assert(r.ok);assert.equal(r.reports.length,2);assert.equal(r.reports[0].document.total,2);assert.equal(r.reports[0].document.rows[0].quantity,2);assert.deepEqual(r.reports[0].assetIds,['A','B']);
 const first=r.reports[0];db=JSON.parse(JSON.stringify(db));db.items=[];db.pallets[0].name='RENAMED';
 assert.equal(reports.apply(db,{action:'list',pallet:db.pallets[0]}).reports[0].id,first.id);
 const updated=reports.apply(db,{action:'update',id:first.id,expectedRevision:1,jobRef:'NEW JOB-123'});assert(updated.ok);assert.equal(updated.report.revision,2);
 db=JSON.parse(JSON.stringify(db));const reopened=reports.apply(db,{action:'get',id:first.id});assert.equal(reopened.report.document.jobRef,'NEW JOB-123');assert.deepEqual(reopened.report.document.rows,first.document.rows);assert.equal(reopened.report.document.total,2);
 assert.equal(reports.apply(db,{action:'get',id:r.reports[1].id}).report.document.jobRef,'ORIGINAL');
 assert.equal(reports.apply(db,{action:'update',id:first.id,expectedRevision:1,jobRef:'STALE'}).ok,false);
 assert.equal(reports.apply(db,{action:'update',id:first.id,expectedRevision:2,jobRef:'x\ny'}).ok,false);
 assert(reports.apply(db,{action:'update',id:first.id,expectedRevision:2,jobRef:''}).ok);
});
test('Creation retry is idempotent, fresh creation retains history, invalid selection saves nothing',()=>{
 const db=fixture(),requestId=randomUUID(),one=create(db,{requestId});assert(one.ok);assert.equal(create(db,{requestId}).reports[0].id,one.reports[0].id);assert.equal(db.microdreamReports.length,2);
 assert(create(db).ok);assert.equal(db.microdreamReports.length,4);
 const before=JSON.stringify(db);db.items.find(a=>a.id==='C').model='';const invalidBefore=JSON.stringify(db);assert.equal(create(db).ok,false);assert.equal(JSON.stringify(db),invalidBefore);
 const other=fixture();other.pallets[1].storageLocation='OTHER';assert.equal(create(other).ok,false);assert.equal(other.microdreamReports,undefined);
 assert.equal(reports.apply(db,{action:'list',pallet:{name:'MD-1',createdAt:'new-pallet-date'}}).reports.length,0);
 assert(before.includes('microdreamReports'));
});


test('Inline report edits survive restart and leave pallet, assets and other reports unchanged',()=>{
 const db=fixture(),created=create(db),first=created.reports[0],other=created.reports[1],assets=JSON.stringify(db.items),pallets=JSON.stringify(db.pallets);
 const docs=require('../src/microdream-documents'),edits=docs.editable(first.document);
 edits.jobRef='KEYBOARD-ONLY';Object.assign(edits.rows[0],{comment:'Keyboard spray',language:'UK keyboard only',type:'Notebook',model:'Dell Latitude 5420 UK',quantity:'2',received:'1'});
 const result=reports.apply(db,{action:'update',id:first.id,expectedRevision:1,edits});assert(result.ok,result.error);
 assert.equal(result.report.document.rows[0].comment,'Keyboard spray');assert.equal(result.report.document.rows[0].received,1);assert.equal(result.report.document.total,2);
 assert.deepEqual(result.report.assetIds,first.assetIds);assert.equal(result.report.document.fingerprint,first.document.fingerprint);
 assert.equal(JSON.stringify(db.items),assets);assert.equal(JSON.stringify(db.pallets),pallets);assert.deepEqual(db.microdreamReports[1],other);
 const restarted=JSON.parse(JSON.stringify(db)),loaded=reports.apply(restarted,{action:'get',id:first.id}).report;
 assert.equal(loaded.document.rows[0].language,'UK keyboard only');assert.equal(loaded.document.jobRef,'KEYBOARD-ONLY');
 const html=docs.markup(loaded.document);assert(html.includes('Keyboard spray'));assert(!html.includes('Full respray'));assert(html.includes('UK keyboard only'));assert(!html.includes('contenteditable'));
 const oldClient=reports.apply(restarted,{action:'update',id:first.id,expectedRevision:2,jobRef:'JOB-NEW'});assert(oldClient.ok);assert.equal(oldClient.report.document.rows[0].comment,'Keyboard spray');
});
test('Editable cells validate quantities and text without partial writes or metadata replacement',()=>{
 const docs=require('../src/microdream-documents'),db=fixture(),first=create(db).reports[0];
 for(const alter of [e=>e.rows.pop(),e=>e.rows[0].quantity='1.5',e=>e.rows[0].quantity='-1',e=>e.rows[0].received='100001',e=>e.rows[0].type='',e=>e.rows[0].comment='line\nbreak',e=>e.rows[0].comment='x'.repeat(201),e=>e.rows[0].language={},e=>e.jobRef='x'.repeat(101)]){
  const edits=docs.editable(first.document);alter(edits);const before=JSON.stringify(db);
  assert.equal(reports.apply(db,{action:'update',id:first.id,expectedRevision:1,edits}).ok,false);assert.equal(JSON.stringify(db),before);
 }
 const edits=docs.editable(first.document);edits.rows[0].comment='<script>Keyboard spray</script>';edits.rows[0].language='';edits.rows[0].quantity='0';edits.rows[0].received='';edits.id='REPLACED';edits.fingerprint='REPLACED';
 const r=reports.apply(db,{action:'update',id:first.id,expectedRevision:1,edits});assert(r.ok,r.error);assert.equal(r.report.id,first.id);assert.equal(r.report.document.fingerprint,first.document.fingerprint);assert.equal(r.report.document.total,0);assert.equal(r.report.document.rows[0].received,'');
 assert(docs.markup(r.report.document).includes('&lt;script&gt;'));assert(!docs.markup(r.report.document).includes('<script>'));
 assert.equal(reports.apply(db,{action:'update',id:first.id,expectedRevision:1,edits}).ok,false);
});
