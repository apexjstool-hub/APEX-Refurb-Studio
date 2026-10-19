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
