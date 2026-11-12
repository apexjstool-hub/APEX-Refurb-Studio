'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const sort=require('../src/inventory-view-model');
const source=fs.readFileSync(path.join(__dirname,'../src/renderer/app.js'),'utf8');
const viewSource=fs.readFileSync(path.join(__dirname,'../src/renderer/inventory-saved-views.js'),'utf8');
test('sorts all inventory records naturally before page slicing and leaves original untouched',()=>{
 const input=[{id:'APX-10',createdAt:'2026-11-01'},{id:'APX-2',createdAt:'2026-11-02'},{id:'APX-1',createdAt:'2026-11-03'}];
 sort.configure('asset','asc');
 assert.deepEqual(sort.sort(input).map(x=>x.id),['APX-1','APX-2','APX-10']);
 assert.equal(input[0].id,'APX-10');
 assert.match(source,/ApexInventorySort\.sort\(filtered,window\.ApexWorkflowSnapshot\)/);
 assert.match(source,/rows\(ordered\.slice\(first,first\+pageSize\),true\)/);
});
test('stable numeric sort and missing waiting time stays at end in either direction',()=>{
 const assets=[{id:'1',createdAt:'2026-01-01'},{id:'2',createdAt:'2026-01-02'},{id:'3',createdAt:'2026-01-03'}];
 const summary=new Map([['1',{needsOrdering:1,parts:[{name:'Battery',toOrder:1,createdAt:'2026-11-01'}]}],['2',{needsOrdering:1,parts:[{name:'Battery',toOrder:1,createdAt:'2026-11-10'}]}]]);
 const oldIndex=globalThis.ApexInventoryWorkflow,oldDisplay=globalThis.ApexInventoryStatusDisplay;
 globalThis.ApexInventoryWorkflow={index:()=>summary};
 globalThis.ApexInventoryStatusDisplay=require('../src/inventory-status-display');
 try{
  const wf={jobs:{'1':{createdAt:'2026-11-01'},'2':{createdAt:'2026-11-10'}}};
  const now=Date.parse('2026-11-12');
  sort.configure('waiting','desc');
  assert.deepEqual(sort.sort(assets,wf,now).map(x=>x.id),['1','2','3']);
  sort.configure('waiting','asc');
  assert.deepEqual(sort.sort(assets,wf,now).map(x=>x.id),['2','1','3']);
 }finally{globalThis.ApexInventoryWorkflow=oldIndex;globalThis.ApexInventoryStatusDisplay=oldDisplay;}
});
test('all sortable keys validate',()=>{
 for(const key of sort.KEYS){assert.equal(sort.configure(key,'asc').key,key);}
 assert.throws(()=>sort.configure('delete','asc'));
 assert.throws(()=>sort.configure('asset','up'));
});
test('views use per-PC localStorage and never write to cloud',()=>{
 assert.match(viewSource,/apex\.inventory\.saved-views\.v1/);
 assert.match(viewSource,/localStorage\.setItem/);
 assert.match(viewSource,/inventorySavedViews/);
 assert.match(viewSource,/inventorySaveView/);
 assert.match(viewSource,/inventoryRemoveView/);
 assert.match(viewSource,/apex-sort-button/);
 assert.doesNotMatch(viewSource,/api\.workflowAction|api\.save|cloudWrite/);
});
