'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),A=require('../src/action-centre');
const now=Date.parse('2026-11-27T12:00:00Z'),old='2026-11-01T12:00:00Z';
const asset=(id,patch={})=>({id,manufacturer:'Dell',model:'Latitude',serial:'S'+id,productType:'Laptop',processor:'i5',ram:'8 GB',storage:'256 GB',location:'Shelf 1',status:'Awaiting Processing',...patch});
const part=(id,name,patch={})=>({id,name,qty:1,received:0,fitted:0,createdAt:old,...patch});
const job=(id,parts,patch={})=>({assetId:id,status:'Awaiting Parts',createdAt:old,updatedAt:old,parts,...patch});
const calc=(jobs,assets,extra={},settings={})=>A.calculate({jobs,orders:[],resprayPallets:[],...extra},assets,settings,now);
test('unavailable snapshot is not a clean bill of health',()=>assert.equal(A.calculate(null,[asset('A')]).available,false));
test('ordering excludes smart keys, respray, held, completed and archived assets; urgency threshold is configurable',()=>{
 const jobs={A:job('A',[part('1','Keyboard')]),B:job('B',[part('1','Smart key'),part('2','Respray')]),C:job('C',[part('1','LCD')],{status:'Completed'}),D:job('D',[part('1','LCD')],{status:'On Hold'}),E:job('E',[part('1','LCD')]),F:job('F',[part('1','LCD')],{partsBoard:'ordered'})};
 const assets=['A','B','C','D','F'].map(x=>asset(x)).concat(asset('E',{location:'Completed QA'}));
 const r=calc(jobs,assets);
 assert.deepEqual(r.rows.filter(x=>x.category==='order').map(x=>[x.id,x.level]),[['A','urgent']]);
 assert.ok(r.rows.some(x=>x.id==='B'&&x.category==='respray'));
 assert.ok(r.rows.some(x=>x.id==='F'&&x.category==='delivery'));
 assert.ok(!r.rows.some(x=>['C','E'].includes(x.id)));
 assert.equal(calc(jobs,assets,{}, {ordering:30}).rows.find(x=>x.category==='order').level,'attention');
});
test('overdue is based on recorded ETA, unpaid draft and received lines are excluded',()=>{
 const jobs={A:job('A',[part('1','LCD')]),B:job('B',[part('1','LCD')]),C:job('C',[part('1','LCD')])};
 const o=(id,date,status='Ordered',received=0)=>({id,status,expectedAt:date,lines:[{assetId:id,partId:'1',qty:1,received}]});
 const r=calc(jobs,['A','B','C'].map(x=>asset(x)),{orders:[o('A','2026-11-20'),o('B','2026-11-27'),o('C','2026-11-20','Draft')]});
 assert.deepEqual(r.rows.filter(x=>x.category==='overdue').map(x=>x.id),['A']);
});
test('fit and respray return are separate, QA never marks a record complete',()=>{
 const jobs={A:job('A',[part('1','LCD',{received:1}),part('2','Respray')]),B:job('B',[part('1','LCD',{received:1,fitted:1})]),C:job('C',[])};
 const wf={resprayPallets:[{status:'Returned',returnedAt:old,manifest:[{assetId:'A'}]}]};
 const before=JSON.stringify(jobs);const r=calc(jobs,['A','B','C'].map(x=>asset(x)),wf);
 assert.ok(r.rows.some(x=>x.id==='A'&&x.category==='fit'));
 assert.ok(r.rows.some(x=>x.id==='A'&&x.category==='respray-return'));
 assert.deepEqual(r.rows.filter(x=>x.category==='qa').map(x=>x.id),['B']);
 assert.equal(JSON.stringify(jobs),before);
});
test('recorded failures and missing fields are review items; deleted assets omitted',()=>{
 const r=calc({},[asset('A',{serial:'',location:'Unassigned',diagnosticTests:{display:{status:'fail'}}}),asset('B',{deletedAt:old})]);
 assert.deepEqual(r.rows.map(x=>x.category).sort(),['diagnostic','location','missing']);
 assert.equal(r.counts.attention,3);
});
test('thresholds validated and limited',()=>assert.deepEqual(A.settings({ordering:0,respray:365,inactive:2.2}),{ordering:7,respray:365,inactive:14}));
