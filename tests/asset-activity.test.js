'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),A=require('../src/asset-activity'),T=require('../src/asset-timeline'),W=require('../src/refurb-workflow');
const event=(i,type='Specification')=>({type,detail:'Event '+i,at:new Date(Date.UTC(2026,0,1,0,0,i)).toISOString()});
test('saved per-asset history survives rolling source limits, reload and repeat captures',()=>{
 const db={items:[{id:'A',history:Array.from({length:120},(_,i)=>event(i))},{id:'B',history:[event(500)]}],operations:{audit:[]}};
 A.capture(db);db.items[0].history=Array.from({length:120},(_,i)=>event(i+120));db.operations.audit=[{...event(700,'Part fitted'),id:'fitted',assetId:'A',by:'Staff'}];A.capture(db);
 const saved=JSON.parse(JSON.stringify(db));saved.items[0].history=[];saved.operations.audit=[];A.capture(saved);
 const first=A.page(saved,{id:'A',limit:100}),second=A.page(saved,{id:'A',limit:100,cursor:first.nextCursor}),third=A.page(saved,{id:'A',limit:100,cursor:second.nextCursor});
 const events=[...first.events,...second.events,...third.events];assert.equal(events.length,241);assert.equal(new Set(events.map(T.key)).size,241);assert.equal(events[0].type,'Part fitted');assert.equal(events.at(-1).detail,'Event 0');assert.equal(third.nextCursor,null);assert(!events.some(e=>e.detail==='Event 500'));assert.equal(A.page(saved,{id:'MISSING'}).ok,false);
});
test('combined timeline deduplicates saved/current events without mutating sources',()=>{
 const recent=[event(1),{...event(2,'Part ordered'),id:'order'}],before=JSON.stringify(recent);
 const merged=T.merge(recent,[{...recent[1],by:'Technician'},{...event(3,'Pallet location'),detail:'Rack A → Rack B'}]);assert.equal(merged.length,3);assert.equal(merged[0].type,'Pallet location');assert.equal(merged[1].by,'Technician');assert.equal(JSON.stringify(recent),before);
});
test('purchasing, fitting, delivery tracking and QC are archived for only their assets',()=>{
 const db={items:[{id:'A',history:[]},{id:'B',history:[]}],operations:W.init({})};
 function act(command){const r=W.apply(structuredClone(db.operations),db.items,command,'Operator');assert.equal(r.ok,true,r.error);db.operations=r.workflow;A.capture(db);return r;}
 act({type:'addPart',assetId:'A',name:'Battery',qty:1});const part=db.operations.jobs.A.parts[0];
 const order=act({type:'createOrder',supplier:'Supplier',lines:[{assetId:'A',partId:part.id,qty:1}]}).order;
 act({type:'orderTracking',orderId:order.id,tracking:'TRACK-1',expectedAt:'2026-10-20'});
 act({type:'receiveOrder',assetId:'A',orderId:order.id,partId:part.id,qty:1});act({type:'fitPart',assetId:'A',partId:part.id,qty:1});
 act({type:'qc',assetId:'A',check:W.QC[0],passed:true});
 const types=A.page(db,{id:'A'}).events.map(e=>e.type);for(const type of ['Part required','Part ordered','Order updated','Delivery received','Part fitted','Quality control'])assert(types.includes(type),type);assert.equal(A.page(db,{id:'B'}).events.length,0);
});
test('removing an asset does not erase its previously saved audit records',()=>{
 const db={items:[{id:'A',history:[event(1)]}],operations:{audit:[]}};A.capture(db);db.items=[];db.operations.audit.push({...event(2,'Asset permanently deleted'),id:'deleted',assetId:'A'});A.capture(db);assert.equal(Object.keys(db.assetActivity.A).length,2);assert(Object.values(db.assetActivity.A).some(e=>e.type==='Asset permanently deleted'));
});
