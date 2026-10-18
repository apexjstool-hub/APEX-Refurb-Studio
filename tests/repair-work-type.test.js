'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const kind=require('../src/repair-work-type'),workflow=require('../src/refurb-workflow'),grade=require('../src/grade-projection');
const assets=[{id:'A',condition:'C'}];
const run=(s,c)=>{if(c.cosmeticEvent==='check'){const p=s.jobs.A.parts.find(p=>p.id===c.partId);c={expectedFitted:p.fitted,expectedReceived:p.received,...c};}const r=workflow.apply(structuredClone(s),assets,{assetId:'A',...c},'Test technician');assert.equal(r.ok,true,r.error);return r.workflow;};
const initial=()=>run(workflow.init({}),{type:'addPart',name:'Full respray',qty:2});
test('Respray is separated from replacement parts without mutating or duplicating records',()=>{
 const rows=[{id:'lcd',name:'LCD Panel'},{id:'uk',name:'UK Keyboard'},{id:'spray',name:'All Respray + UK Keyboard'},{id:'keys',name:'Respray Keyboard'},{id:'lid',name:'Lid re-spray'}];const before=JSON.stringify(rows),groups=kind.split(rows);
 assert.deepEqual(groups.replacement.map(p=>p.id),['lcd','uk']);assert.deepEqual(groups.cosmetic.map(p=>p.id),['spray','keys','lid']);assert.deepEqual(groups.bundled.map(p=>p.id),['spray']);assert.equal(kind.bundledKeyboard('Respray Keyboard'),false);assert.equal(JSON.stringify(rows),before);
 assert.equal(grade.project(assets[0],{jobs:{A:{parts:[{name:'All Respray + UK Keyboard',qty:1}]}}}).potential,'Excellent');
 assert.equal(grade.classify('Respray Keyboard'),'partial-respray');
});
test('Cosmetic dispatch, partial return and check preserve legacy quantities and audit each action',()=>{
 let s=initial(),p=s.jobs.A.parts[0];
 assert.equal(workflow.apply(structuredClone(s),assets,{type:'receivePart',assetId:'A',partId:p.id,qty:1,expectedReceived:0,cosmeticEvent:'return'}).ok,false);
 s=run(s,{type:'markPartOrdered',partId:p.id,expectedQty:2,expectedReceived:0,expectedOnOrder:0});
 assert.equal(s.jobs.A.parts[0].received,0);assert.equal(s.jobs.A.parts[0].fitted,0);assert.equal(s.orders[0].lines[0].qty,2);
 assert.equal(workflow.apply(structuredClone(s),assets,{type:'fitPart',assetId:'A',partId:p.id,qty:1,cosmeticEvent:'check'}).ok,false);
 s=run(s,{type:'receivePart',partId:p.id,qty:1,expectedReceived:0,cosmeticEvent:'return'});
 s=run(s,{type:'fitPart',partId:p.id,qty:1,cosmeticEvent:'check'});
 assert.equal(workflow.apply(structuredClone(s),assets,{type:'fitPart',assetId:'A',partId:p.id,qty:1,cosmeticEvent:'check',expectedFitted:0,expectedReceived:1}).ok,false);assert.equal(s.jobs.A.parts[0].received,1);assert.equal(s.jobs.A.parts[0].fitted,1);assert.equal(workflow.outstanding(s)[0].onOrder,1);
 assert.ok(s.audit.some(a=>a.type==='Respray sent / booked'));assert.ok(s.audit.some(a=>a.type==='Respray returned'));assert.ok(s.audit.some(a=>a.type==='Respray checked'));
 assert.equal(workflow.apply(structuredClone(s),assets,{type:'fitPart',assetId:'A',partId:p.id,qty:1,cosmeticEvent:'check'}).ok,false);
 s.jobs.A.status='On Hold';assert.equal(workflow.apply(structuredClone(s),assets,{type:'fitPart',assetId:'A',partId:p.id,qty:1,cosmeticEvent:'check'}).ok,false);
});
test('New work remains readable and editable by the actual 4.0.77 workflow implementation',()=>{
 let s=initial(),p=s.jobs.A.parts[0];s=run(s,{type:'markPartOrdered',partId:p.id,expectedQty:2,expectedReceived:0,expectedOnOrder:0});s=run(s,{type:'receivePart',partId:p.id,qty:1,expectedReceived:0,cosmeticEvent:'return'});s=run(s,{type:'fitPart',partId:p.id,qty:1,cosmeticEvent:'check'});
 const old={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fixtures/refurb-workflow-4.0.77.cjs'),'utf8'),{module:old,exports:old.exports,require:createRequire(path.resolve(__dirname,'../src/refurb-workflow.js'))});
 const saved=JSON.parse(JSON.stringify(s)),read=old.exports.outstanding(saved);assert.equal(read[0].name,'Full respray');assert.equal(read[0].received,1);assert.equal(read[0].fitted,1);assert.equal(read[0].onOrder,1);
 const result=old.exports.apply(saved,assets,{type:'addPart',assetId:'A',name:'Battery',qty:1},'Previous build');assert.equal(result.ok,true,result.error);assert.equal(result.workflow.jobs.A.parts.length,2);
 assert.equal(grade.project(assets[0],s).potential,'Excellent');
});
