'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),gp=require('../src/grade-projection');
const asset=(condition='Fair')=>({id:'A-1',condition,batteryPercentage:'65',inspection:{},history:[]});
const workflow=names=>({jobs:{'A-1':{parts:names.map(name=>({name,qty:1,received:0,fitted:0}))}}});
test('Agreed LCD + full respray + battery projects Excellent before ordering or fitting without mutation',()=>{
 const a=asset(),w=workflow(['LCD','Full respray','Battery']),before=JSON.stringify([a,w]);const p=gp.project(a,w);
 assert.equal(p.current,'Fair');assert.equal(p.potential,'Excellent');assert.equal(p.requirements.length,3);assert.match(p.readiness,/replacement planned/);assert(p.assumptions.some(s=>/remaining keyboard/.test(s)));assert.equal(JSON.stringify([a,w]),before);
 for(const part of w.jobs[a.id].parts){part.received=part.fitted=1;}assert.equal(gp.project(a,w).potential,'Excellent');
});
test('No full respray conservatively retains assigned grade; battery alone never raises cosmetic grade',()=>{
 for(const [current,expected] of [['Fair','Fair'],['Good','Good'],['Excellent','Excellent'],['A','Excellent'],['B','Good'],['C','Fair']])assert.equal(gp.project(asset(current),workflow(['LCD','Battery','Keyboard'])).potential,expected);
 assert.equal(gp.project(asset(),workflow(['Battery'])).potential,'Fair');
 assert.equal(gp.project(asset('D'),workflow(['Full respray'])).potential,null);
 assert.equal(gp.project(asset('Not assessed'),workflow(['LCD','Respray'])).potential,null);
});
test('Only whole-device respray restores the full body; related cables and casing parts are not new LCDs',()=>{
 for(const name of ['Respray','Full respray','Full body respray','Complete laptop respray','Re-spray','Full respray required'])assert.equal(gp.classify(name),'full-respray',name);
 for(const name of ['Lid respray','Keyboard respray','Full lid respray','Partial respray','Base repaint']){assert.equal(gp.classify(name),'partial-respray');assert.equal(gp.project(asset(),workflow([name])).potential,'Fair');}
 for(const name of ['LCD cable','Screen bezel','Display hinge','LCD lid cover'])assert.notEqual(gp.classify(name),'screen');
 for(const name of ['LCD','LCD panel','New screen','Display assembly'])assert.equal(gp.classify(name),'screen');
 for(const name of ['Battery cable','CMOS battery','Battery cover'])assert.notEqual(gp.classify(name),'battery');
});
test('Use authoritative live job, including empty requirements; do not resurrect old imported tasks',()=>{
 const a=asset();a.refurbishment={latestKey:'latest',reports:[{key:'old',repairs:[{name:'Full respray'}]},{key:'latest',repairs:[{name:'LCD',quantity:1},{name:'Respray',quantity:1}]}]};
 assert.equal(gp.project(a).potential,'Excellent');assert.equal(gp.project(a).requirements.length,2);
 assert.equal(gp.project(a,workflow([])).potential,'Fair');assert.equal(gp.project(a,workflow([])).requirements.length,0);
 assert.equal(gp.project(a,workflow(['Battery'])).potential,'Fair');
});
test('Unknown, duplicate, zero and completed requirements do not change other assets or current grades',()=>{
 const a=asset('Good'),w=workflow(['SSD','LCD','LCD']);w.jobs['A-1'].parts.push({name:'Respray',qty:0},{name:'Battery',qty:-1});w.jobs.OTHER={parts:[{name:'Full respray',qty:1}]};
 const p=gp.project(a,w);assert.equal(p.potential,'Good');assert.equal(p.requirements.length,2);assert.equal(p.requirements.find(p=>p.name==='LCD').qty,2);assert.match(p.explanation.join(' '),/Other listed parts/);assert.equal(a.condition,'Good');
});
test('Battery eligibility and failed diagnostics are separate from the cosmetic projection',()=>{
 const a=asset();a.diagnosticTests={wifi:{status:'fail'}};
 const p=gp.project(a,workflow(['Full respray']));assert.equal(p.potential,'Excellent');assert.match(p.readiness,/below 80%/);assert.match(p.readiness,/functional failures/);
 a.batteryPercentage='';assert.match(gp.project(a,workflow([])).readiness,/not recorded/);
 a.inspection.battery='Failed';assert.match(gp.project(a,workflow([])).readiness,/failure recorded/);
});
