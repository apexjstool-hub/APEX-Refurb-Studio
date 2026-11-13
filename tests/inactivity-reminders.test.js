'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {getAlerts,classify}=require('../src/reminder-ageing');
const {index}=require('../src/inventory-workflow');
const daysAgo=n=>new Date(Date.UTC(2026,10,12)-n*86400000).toISOString();
const now=Date.UTC(2026,10,12);
const settings={enabled:true,attention:7,overdue:14,critical:30,ordering:3,delivery:10,respray:7,repair:7,pallet:14};
const part=(id,name,age,received=0,fitted=0)=>({id,name,qty:1,createdAt:daysAgo(age),received,fitted});
const job=(id,parts,updated=0)=>({assetId:id,status:'Received',createdAt:daysAgo(50),updatedAt:daysAgo(updated),parts});
const assess=(jobs,orders=[])=>{
 const workflow={jobs:Object.fromEntries(jobs.map(j=>[j.assetId,j])),orders};
 const assets=jobs.map(j=>({id:j.assetId,model:'test laptop'}));
 return getAlerts(workflow,assets,index(workflow),settings,now);
};
test('un-ordered part age remains overdue despite recent unrelated job edits',()=>{
 const result=assess([job('A',[part('p','Replacement LCD',12)],0)]);
 assert.equal(result.length,1);
 assert.equal(result[0].age,12);
 assert.equal(result[0].category.type,'ordering');
});
test('newly required parts do not inherit age of old job',()=>{
 assert.equal(assess([job('A',[part('p','Replacement LCD',1)],40)]).length,0);
});
test('an old ordered item does not trigger parts-not-ordered reminder',()=>{
 const j=job('A',[part('p','Replacement LCD',23)],0);
 const order={status:'Ordered',lines:[{assetId:'A',partId:'p',qty:1,received:0}]};
 const result=assess([j],[order]);
 assert.equal(result.length,0);
});
test('old respray is lower priority than an un-ordered replacement part',()=>{
 const result=assess([job('A',[part('s','Full respray',20)]),job('B',[part('b','Battery',6)])]);
 assert.deepEqual(result.map(r=>r.category.type),['ordering','respray']);
});
test('completed and held jobs are ignored',()=>{
 const a=job('A',[part('x','Battery',20)]);a.status='Completed';
 const b=job('B',[part('y','Battery',20)]);b.status='On Hold';
 assert.equal(assess([a,b]).length,0);
});
