'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const maintenance=require('../src/record-maintenance');
const makeDb=()=>({
 items:[{id:'A1',model:'Latitude',serial:'S123',refurbNotes:'Original note',refurbishment:{repairs:[{name:'Keyboard'}]}}],
 operations:{jobs:{A1:{assetId:'A1',status:'Completed',parts:[
  {id:'p1',name:'Keyboard',qty:1,received:1,fitted:1},
  {id:'p2',name:'Battery',qty:1,received:0,fitted:0}]}},
  orders:[{id:'PO-1',status:'Ordered',lines:[
   {assetId:'A1',partId:'p1',qty:1,received:1},
   {assetId:'A1',partId:'p2',qty:1,received:0},
   {assetId:'B1',partId:'other',qty:1,received:0}]}],audit:[]}
});
test('administrator removes one fitted part without deleting asset, other parts, or another order line',()=>{
 const db=makeDb();
 const r=maintenance.mutate(db,{type:'deletePart',assetId:'A1',partId:'p1'});
 assert.equal(r.ok,true);
 assert.equal(db.items.length,1);
 assert.equal(db.items[0].serial,'S123');
 assert.deepEqual(db.operations.jobs.A1.parts.map(p=>p.id),['p2']);
 assert.deepEqual(db.operations.orders[0].lines.map(l=>l.partId),['p2','other']);
 assert.equal(db.operations.audit[0].type,'Part deleted');
 assert.equal(db.operations.audit[0].assetId,'A1');
});
test('removing an ordered part deletes only its order line; empty orders are removed',()=>{
 const db=makeDb();db.operations.orders=[{id:'PO-A',status:'Ordered',lines:[{assetId:'A1',partId:'p2',qty:1,received:0}]}];
 const r=maintenance.mutate(db,{type:'deletePart',assetId:'A1',partId:'p2'});
 assert.equal(r.ok,true);
 assert.equal(db.operations.orders.length,0);
 assert.deepEqual(db.operations.jobs.A1.parts.map(p=>p.id),['p1']);
});
test('unknown part cannot change database',()=>{
 const db=makeDb(),before=JSON.stringify(db);
 const r=maintenance.mutate(db,{type:'deletePart',assetId:'A1',partId:'missing'});
 assert.equal(r.ok,false);
 assert.equal(JSON.stringify(db.items),JSON.stringify(JSON.parse(before).items));
 assert.equal(db.operations.jobs.A1.parts.length,2);
});
test('clearing refurbishment leaves hardware and asset intact',()=>{
 const db=makeDb();
 const r=maintenance.mutate(db,{type:'deleteRefurb',assetId:'A1'});
 assert.equal(r.ok,true);
 assert.equal(db.items[0].serial,'S123');
 assert.equal(db.items[0].refurbNotes,'');
 assert.equal(db.items[0].refurbishment,undefined);
 assert.equal(db.operations.jobs.A1,undefined);
 assert.equal(db.operations.orders[0].lines.length,1);
 assert.equal(db.operations.orders[0].lines[0].assetId,'B1');
});
