'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const kind=require('../src/repair-work-type');
const workflow=require('../src/refurb-workflow');
const status=require('../src/inventory-workflow');
const display=require('../src/inventory-status-display');
const exportParts=require('../src/refurb-export');
const qa=require('../src/renderer/completed-qa-core');
const asset={id:'83253',manufacturer:'Dell',model:'Latitude 5420',serial:'TEST1',pallet:'IR-560'};
const part=(id,name,qty=1,received=0,fitted=0)=>({id,name,qty,received,fitted});
const job=()=>({assetId:asset.id,status:'Repair In Progress',parts:[
 part('bat','Battery',1,1,1),part('lcd','LCD Panel',1,1,1),part('smart','Smart Key',1,0,0)
]});
const state=()=>workflow.init({jobs:{[asset.id]:job()},orders:[],audit:[]});
test('Smart Key is a non-part; Smart Keyboard remains a real replacement part',()=>{
 assert.equal(kind.isSmartKey('Smart Key'),true);
 assert.equal(kind.isSmartKey('SMART-KEY'),true);
 assert.equal(kind.isSmartKey('smartkey'),true);
 assert.equal(kind.isSmartKey('smart key required'),true);
 assert.equal(kind.isSmartKey('Smart Keyboard'),false);
 assert.equal(kind.isReplacement('Smart Keyboard'),true);
 assert.equal(kind.isReplacement('Battery'),true);
 assert.equal(kind.isReplacement('Smart Key'),false);
 const data=kind.split(job().parts);
 assert.deepEqual(data.replacement.map(p=>p.id),['bat','lcd']);
 assert.deepEqual(data.other.map(p=>p.id),['smart']);
 assert.equal(data.cosmetic.length,0);
});
test('Fitted genuine parts yield Parts Fitted while Smart Key remains unmatched and unfitted',()=>{
 const s=state(),row=status.index(s).get(asset.id);
 assert.equal(row.partsStatus,'Parts Fitted');
 assert.equal(row.needsOrdering,0);
 assert.equal(row.awaitingDelivery,0);
 assert.equal(row.replacementToFit,0);
 assert.equal(row.key,'qc');
 assert.deepEqual(display.compose(row).badges.map(b=>b.label),['Parts fitted']);
 assert.equal(s.jobs[asset.id].parts[2].fitted,0);
 assert.equal(s.jobs[asset.id].parts[2].name,'Smart Key');
 assert.equal(qa.status(asset,s).partsStatus,'Repair completed');
 assert.equal(exportParts.outstandingParts(asset,s).length,0);
 assert.equal(exportParts.partsToOrder(asset,s).length,0);
 assert.equal(exportParts.requiredPartsRows([asset],s).length,1);
 assert.equal(exportParts.templatePartsRows([asset],s).length,1);
});
test('Smart Key alone does not make an asset need parts or falsely say Parts Fitted',()=>{
 const s=workflow.init({jobs:{[asset.id]:{assetId:asset.id,status:'Awaiting Parts',parts:[part('smart','Smart Key',1,0,0)]}},orders:[],audit:[]});
 const row=status.index(s).get(asset.id);
 assert.equal(row.partsStatus,'Not Required');
 assert.equal(row.needsOrdering,0);assert.equal(row.awaitingDelivery,0);
 assert.equal(row.replacementToFit,0);
 assert.equal(display.compose(row).badges.some(b=>b.label==='Parts ordered'||b.label==='Needs ordering'),false);
 assert.equal(exportParts.outstandingParts(asset,s).length,0);
});
test('Outstanding real replacement parts still prevent Parts Fitted',()=>{
 const s=state();s.jobs[asset.id].parts[1].fitted=0;
 const row=status.index(s).get(asset.id);
 assert.notEqual(row.partsStatus,'Parts Fitted');
 assert.equal(row.replacementToFit,1);
 assert.equal(display.compose(row).badges.some(b=>b.label==='Parts fitted'),false);
 assert.equal(exportParts.outstandingParts(asset,s).length,1);
 assert.equal(exportParts.outstandingParts(asset,s)[0].name,'LCD Panel');
});
test('Existing Smart Key record is preserved but cannot be sent to purchasing or marked fitted',()=>{
 const s=state(),before=JSON.stringify(s);
 assert.equal(workflow.apply(s,[asset],{type:'markPartOrdered',assetId:asset.id,partId:'smart',expectedQty:1,expectedReceived:0,expectedOnOrder:0}).ok,false);
 assert.equal(workflow.apply(s,[asset],{type:'createOrder',supplier:'Supplier',lines:[{assetId:asset.id,partId:'smart',qty:1}]}).ok,false);
 assert.equal(workflow.apply(s,[asset],{type:'confirmPartFitted',assetId:asset.id,partId:'smart',expectedQty:1,expectedReceived:0,expectedFitted:0,qty:1}).ok,false);
 assert.equal(workflow.apply(s,[asset],{type:'setPartsBoard',assetId:asset.id,board:'needed'}).ok,false);
 assert.equal(JSON.stringify(s),before);
});
test('Parts page and Asset Details exclude Smart Key from replacement parts while keeping it visible in Other requirements',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../src/renderer/refurb-ui.js'),'utf8');
 const inv=fs.readFileSync(path.join(__dirname,'../src/renderer/inventory-workflow-ui.js'),'utf8');
 assert.match(ui,/isReplacement/);
 assert.match(ui,/Other requirements/);
 assert.match(ui,/Not a replacement part/);
 assert.match(ui,/Smart Key is recorded for reference only/);
 assert.match(inv,/replacementToFit/);
});
