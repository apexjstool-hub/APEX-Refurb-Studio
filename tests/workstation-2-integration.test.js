'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {assess}=require('../src/renderer/workstation-2-engine');
const renderer=path.join(__dirname,'../src/renderer'),html=fs.readFileSync(path.join(renderer,'index.html'),'utf8'),script=fs.readFileSync(path.join(renderer,'smart-workstation.js'),'utf8'),css=fs.readFileSync(path.join(renderer,'workstation-2.css'),'utf8');
const asset=(tests={display:{status:'pass'}})=>({id:'85543',diagnosticTests:tests});
const job=(parts=[],qc={})=>({status:'Repair In Progress',parts,qc});
test('Missing diagnostics never implies a passed device',()=>{
 const result=assess(asset({}),job());
 assert.equal(result.noResults,true);assert.equal(result.kind,'diagnostics');assert.equal(result.qcReady,false);
});
test('Failed battery stays failed after part fitting until explicit Diagnostics sync',()=>{
 const a=asset({battery:{status:'fail',comment:'capacity too low'}});
 const j=job([{id:'a',name:'Battery',qty:1,fitted:1,received:1}]);
 const result=assess(a,j);
 assert.equal(result.kind,'retest');assert.equal(result.failed[0].comment,'capacity too low');assert.equal(a.diagnosticTests.battery.status,'fail');assert.equal(result.qcReady,false);
});
test('Parts ordering status comes from existing order lines and received quantities',()=>{
 const a=asset(),p={id:'bat',name:'Battery',qty:1,received:0,fitted:0};
 assert.equal(assess(a,job([p]),[]).kind,'order');
 const orders=[{status:'Placed',lines:[{assetId:a.id,partId:'bat',qty:1,received:0}]}];
 assert.equal(assess(a,job([p]),orders).kind,'wait');
 p.received=1;assert.equal(assess(a,job([p]),orders).kind,'fit');
});
test('Final QC is advisory and never changes workflow state',()=>{
 const a=asset(),j=job();
 const first=assess(a,j);assert.equal(first.kind,'qc');assert.equal(first.canReviewCompletion,false);
 for(const key of first.QC)j.qc[key]=true;
 const last=assess(a,j);assert.equal(last.canReviewCompletion,true);assert.equal(j.status,'Repair In Progress');
});
test('Paused and completed jobs are never advertised as ready',()=>{
 assert.equal(assess(asset(),{...job(),status:'On Hold'}).kind,'hold');
 assert.equal(assess(asset(),{...job(),status:'Completed'}).canReviewCompletion,false);
});
test('New UI elements and CSS only exist inside workstation page',()=>{
 const start=html.indexOf('<section id="workstationPage"'),end=html.indexOf('<section id="inventoryPage"',start);
 assert(start>=0&&end>start);
 const section=html.slice(start,end);
 for(const id of ['ws2Summary','ws2DiagnosticsCount','ws2RepairCount','ws2QCCount','ws2Readiness','ws2NextButton','ws2DiagnosticList','ws2QCChecklist'])assert(section.includes('id="'+id+'"'));
 assert.match(html,/src="workstation-2-engine.js"/);assert.match(html,/href="workstation-2.css"/);
 assert(html.indexOf('src="workstation-2-engine.js"')<html.indexOf('src="smart-workstation.js"'));
 assert.match(css,/#workstationPage/);
 for(const rule of css.split('\n').filter(x=>x.trim()&&!x.trim().startsWith('/*')&&!x.trim().startsWith('*'))){if(rule.includes('{')&&!rule.trim().startsWith('@'))assert(rule.includes('#workstationPage'),'Unscoped CSS: '+rule);}
 assert.match(script,/renderGuidance\(a,j\)/);
 assert.doesNotMatch(script,/diagnosticTests\s*=|qc\s*=|autoPass|setInterval\(/);
});
