'use strict';const {test}=require('node:test'),assert=require('node:assert/strict'),progress=require('../src/inventory-workflow'),pallets=require('../src/pallet-management');
const job=()=>({assetId:'A-1',status:'Awaiting Parts',partsBoard:'ordered',parts:[{id:'p',name:'Battery',qty:3,received:0,fitted:0}],qc:{}});
test('Manual ordered board controls progress without counting draft POs as purchases',()=>{const j=job(),s=progress.summarize(j,[{status:'Draft',lines:[{assetId:'A-1',partId:'p',qty:3,received:0}]}]);assert.equal(s.ordered,0);assert.equal(s.toOrder,3);assert.equal(s.stage,'Parts ordered');assert.equal(s.key,'delivery');assert.equal(s.needsOrdering,0);assert.equal(s.awaitingDelivery,3);assert.equal(s.awaiting,0);assert.equal(s.next,'Receive 3 unit(s)');assert.equal(s.manualBoard,'ordered');});
test('Recorded order, receipt and fitting quantities produce the correct next action',()=>{const j=job(),orders=[{lines:[{assetId:'A-1',partId:'p',qty:3,received:0}]}];let s=progress.summarize(j,orders);assert.equal(s.key,'delivery');j.parts[0].received=3;orders[0].lines[0].received=3;s=progress.summarize(j,orders);assert.equal(s.key,'fit');j.parts[0].fitted=1;s=progress.summarize(j,orders);assert.equal(s.toFit,2);assert.equal(s.stage,'Repair in progress');j.parts[0].fitted=3;assert.equal(progress.summarize(j,orders).key,'qc');j.status='Completed';assert.equal(progress.summarize(j,orders).key,'completed');});
test('Direct received stock is not reported as a purchase order',()=>{const j=job();j.parts[0].received=3;const s=progress.summarize(j);assert.equal(s.ordered,0);assert.equal(s.toOrder,0);assert.equal(s.toFit,3);assert.equal(s.key,'fit');});
test('Phone and Studio timestamp/actor audit formats are displayed from real records',()=>{const j=job();j.parts[0].lastProgressAt='2026-10-14T10:00:00Z';j.parts[0].lastProgressBy='Phone staff';const e=progress.latest(j,[{AssetID:'A-1',time:'2026-10-14T10:01:00Z',by:'Another staff',type:'Part fitted'}]);assert.equal(e.by,'Another staff');assert.equal(e.text,'Part fitted');assert.equal(progress.latest({assetId:'OTHER'},[]),null);});
test('Pallet section reuses existing creation, assignment, empty-delete and concurrency safeguards',()=>{const db={items:[{id:'A-1',model:'Model',location:'Bench',pallet:'',inspection:{}}],locations:['Bench','Unassigned'],pallets:[]};assert.equal(pallets.createPallet(db,{name:'PALLET-0001',label:'Batch'}).ok,true);assert.equal(pallets.moveBatch(db,{ids:['A-1'],pallet:'PALLET-0001'}).ok,true);assert.equal(db.items[0].location,'Unassigned');assert.equal(db.items[0].pallet,'PALLET-0001');assert.equal(pallets.deletePallet(db,{name:'PALLET-0001'}).ok,false);});

test('Moving back and later receipts, fitting, hold and completion retain their correct progress',()=>{
 const j=job();j.partsBoard='needed';let s=progress.summarize(j);
 assert.equal(s.stage,'Needs ordering');assert.equal(s.needsOrdering,3);assert.equal(s.awaitingDelivery,0);
 j.partsBoard='ordered';j.parts[0].received=1;s=progress.summarize(j);
 assert.equal(s.stage,'Parts ordered');assert.equal(s.awaitingDelivery,2);assert.equal(s.toFit,1);
 assert.equal(s.next,'Receive 2 unit(s); fit 1 available unit(s)');
 j.parts[0].received=3;s=progress.summarize(j);assert.equal(s.stage,'Ready to fit');assert.equal(s.awaitingDelivery,0);
 j.parts[0].fitted=1;assert.equal(progress.summarize(j).stage,'Repair in progress');
 j.parts[0].fitted=3;assert.equal(progress.summarize(j).key,'qc');
 j.status='On Hold';assert.equal(progress.summarize(j).key,'hold');
 j.status='Completed';assert.equal(progress.summarize(j).key,'completed');
});
test('Workflow index preserves ordered board after reopening and does not double count linked orders',()=>{
 const j=job(),orders=[{status:'Ordered',lines:[{assetId:j.assetId,partId:'p',qty:2,received:0}]}];
 const before=JSON.stringify({jobs:{[j.assetId]:j},orders});
 const s=progress.index(JSON.parse(before)).get(j.assetId);
 assert.equal(s.stage,'Parts ordered');assert.equal(s.ordered,2);assert.equal(s.awaiting,2);
 assert.equal(s.toOrder,1);assert.equal(s.needsOrdering,0);assert.equal(s.awaitingDelivery,3);
 assert.equal(JSON.stringify({jobs:{[j.assetId]:j},orders}),before);
 j.partsBoard='needed';assert.equal(progress.summarize(j,orders).stage,'Needs ordering');
 j.partsBoard='';assert.equal(progress.summarize(j,orders).stage,'Needs ordering');
 orders[0].lines[0].qty=3;assert.equal(progress.summarize(j,orders).stage,'Parts ordered');
});
