'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('../src/smart-asset-assistant'),G=require('../src/grade-projection');
const asset={id:'A',model:'Latitude',condition:'Good',batteryPercentage:'91',diagnosticTests:{display:{status:'fail'},keyboard:{status:'pass'},wifi:{status:'not-tested'}}};
const state={available:true,stale:false,workflow:{jobs:{A:{assetId:'A',parts:[{id:'p',name:'Full respray',qty:1,received:0,fitted:0}]}}},rows:[{id:'B',category:'qa',level:'ready'},{id:'A',category:'order',level:'urgent',detail:'LCD',age:9},{id:'A',category:'diagnostic',level:'attention',detail:'Display'}]};
test('reuses exact Action Centre findings, order and existing grade projection without changing data',()=>{const before=JSON.stringify([asset,state]);const result=A.summarize(asset,state);assert.equal(result.actions.length,2);assert.equal(result.next.category,'order');assert.equal(result.actions[0].tab,'parts');assert.equal(result.actions[1].tab,'tests');assert.equal(result.projection.potential,G.project(asset,state.workflow).potential);assert.deepEqual(result.tests,{passed:1,failed:1,other:1});assert.equal(result.battery,91);assert.equal(JSON.stringify([asset,state]),before);});
test('unknown/stale workflow never manufactures a clear bill of health or projection',()=>{assert.equal(A.summarize(asset,null).available,false);assert.equal(A.summarize(asset,null).projection,null);assert.equal(A.summarize(asset,{...state,stale:true}).projection,null);assert.equal(A.summarize({...asset,batteryPercentage:''},state).battery,null);assert.equal(A.summarize({...asset,deletedAt:'x'},state),null);});
test('assistant present in both layouts and rollback URL is fixed and protected',()=>{const root=path.join(__dirname,'../src');for(const file of ['index.html','index-evolution.html']){const h=fs.readFileSync(path.join(root,'renderer',file),'utf8');assert.match(h,/id="saDrawer"[^>]*hidden/);assert.match(h,/id="saEnabled"/);assert.match(h,/id="saPreviousRelease"/);assert.doesNotMatch(h,/data-page="smartAssistant"/);}const main=fs.readFileSync(path.join(root,'main.js'),'utf8');assert.match(main,/inventory:openAssistantRollback',settingsSecured/);assert.ok(main.includes('https://github.com/apexjstool-hub/APEX-Refurb-Studio/releases/tag/v4.4.52'));});

test('individual parts, supplier records, respray manifest and smart keys stay separated',()=>{
 const a={...asset,id:'X'};
 const job={assetId:'X',status:'Awaiting Parts',technician:'Engineer',notes:'Check hinges',parts:[
 {id:'p1',name:'LCD',qty:2,received:1,fitted:0,notes:'Matte'},
 {id:'p2',name:'Full respray + UK Keyboard',qty:1,received:0,fitted:0},
 {id:'p3',name:'Smart Key',qty:1,received:0,fitted:0}],qc:{'Visual inspection':true}};
 const workflow={jobs:{X:job},orders:[{id:'PO-1',status:'Ordered',supplier:'Supplier A',reference:'REF-1',expectedAt:'2026-12-01',lines:[{assetId:'X',partId:'p1',qty:2,received:1}]}],resprayPallets:[{status:'Dispatched',palletName:'IR-560',reference:'MD1',manifest:[{assetId:'X',parts:[{partId:'p2'}]}]}]};
 const result=A.summarize(a,{available:true,workflow,rows:[]}),w=result.work;
 assert.equal(w.groups.replacement.length,1);assert.equal(w.groups.cosmetic.length,1);assert.equal(w.groups.other.length,1);
 assert.equal(w.required,3);assert.equal(w.finished,0);assert.equal(w.groups.replacement[0].required,2);assert.equal(w.groups.replacement[0].ordered,2);assert.equal(w.groups.replacement[0].received,1);assert.equal(w.groups.replacement[0].status,'Ready to fit');assert.equal(w.groups.replacement[0].orders[0].reference,'REF-1');assert.equal(w.groups.cosmetic[0].status,'Sent for respray');assert.equal(w.shipment.reference,'MD1');assert.equal(w.qc[0].done,true);assert.equal(w.notes,'Check hinges');assert.equal(result.failed[0].name,'display');
});
test('imported requirements are visible without claiming order or receipt status',()=>{
 const a={id:'Y',refurbishment:{repairs:[{name:'Battery',quantity:2}]}};
 const w=A.summarize(a,null).work;
 assert.equal(w.known,false);assert.equal(w.groups.replacement[0].required,2);assert.equal(w.groups.replacement[0].ordered,null);
});
