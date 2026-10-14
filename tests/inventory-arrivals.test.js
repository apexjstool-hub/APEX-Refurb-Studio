'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{InventoryArrivals}=require('../src/inventory-arrivals');
test('Startup stock, failed refreshes and duplicate intake do not notify; new batches do',()=>{
 const tracker=new InventoryArrivals(),read=items=>({ok:true,items});
 assert.deepEqual(tracker.observe(read([{id:'A'}]),'hub'),[]);
 assert.deepEqual(tracker.observe({ok:false,error:'Offline'},'hub'),[]);
 assert.deepEqual(tracker.observe(read([{id:'A'},{id:'B'},{id:'C'}]),'hub').map(a=>a.id),['B','C']);
 assert.deepEqual(tracker.observe(read([{id:'A'},{id:'B'},{id:'C'}]),'hub'),[]);
 assert.deepEqual(tracker.observe(read([{id:'A'}]),'hub'),[]);
 assert.deepEqual(tracker.observe(read([{id:'A'},{id:'B'},{id:'C'}]),'hub'),[]);
});
test('Manual additions and deleted records are excluded; account/source switches establish a fresh baseline',()=>{
 const tracker=new InventoryArrivals();
 tracker.observe({ok:true,items:[]},'cloud:first');tracker.remember('MANUAL');
 assert.deepEqual(tracker.observe({ok:true,items:[{id:'MANUAL'},{id:'DELETED',deletedAt:'2026-01-01'}]},'cloud:first'),[]);
 assert.deepEqual(tracker.observe({ok:true,items:[{id:'OTHER'}]},'cloud:second'),[]);
 assert.deepEqual(tracker.observe({ok:true,unchanged:true},'cloud:second'),[]);
 tracker.reset();assert.deepEqual(tracker.observe({ok:true,items:[{id:'OTHER'},{id:'NEW'}]},'cloud:second'),[]);
});
