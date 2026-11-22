'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'../previews/workstation-2');
const {assess,REQUIRED_QC}=require('../previews/workstation-2/rules');
const record=(extra={})=>({tests:{display:{status:'pass'},keyboard:{status:'pass'},battery:{status:'pass'}},job:{status:'Repair In Progress',parts:[],qc:{}},...extra});
test('Never infer a passed test from a fitted part',()=>{
 const r=record({tests:{battery:{status:'fail',comment:'low health'}},job:{status:'Repair In Progress',parts:[{name:'Battery',qty:1,received:1,fitted:1}],qc:{}}});
 const result=assess(r);
 assert.equal(result.kind,'retest');assert.equal(result.failures.length,1);assert.equal(r.tests.battery.status,'fail');
});
test('Ordered parts do not count as received or fitted',()=>{
 const p={name:'UK keyboard',qty:1,received:0,fitted:0,ordered:true};
 assert.equal(assess(record({job:{status:'Awaiting Parts',parts:[p],qc:{}}})).kind,'waiting');
 p.received=1;assert.equal(assess(record({job:{status:'Awaiting Parts',parts:[p],qc:{}}})).kind,'fit');
});
test('Prioritise unallocated parts, cosmetic repair, missing tests, then QC',()=>{
 const basic=record();
 assert.equal(assess(record({job:{status:'Awaiting Parts',parts:[{name:'Battery',qty:1,received:0,fitted:0}],qc:{}}})).kind,'order');
 assert.equal(assess(record({job:{status:'Repair In Progress',parts:[{name:'Full respray',qty:1,received:0,fitted:0}],qc:{}}})).kind,'cosmetic');
 assert.equal(assess(record({tests:{battery:{status:'not-tested'}},job:basic.job})).kind,'test');
 assert.equal(assess(basic).kind,'qc');
});
test('QC cannot complete an asset with failed tests or unfinished parts',()=>{
 const qc=Object.fromEntries(REQUIRED_QC.map(k=>[k,true]));
 assert.equal(assess(record({job:{status:'Quality Control',parts:[],qc}})).canComplete,true);
 assert.equal(assess(record({tests:{battery:{status:'fail'}},job:{status:'Quality Control',parts:[],qc}})).canComplete,false);
 assert.equal(assess(record({job:{status:'Quality Control',parts:[{name:'Screen',qty:1,fitted:0}],qc}})).canComplete,false);
 assert.equal(assess(record({job:{status:'On Hold',parts:[],qc}})).canComplete,false);
});
test('Demo app uses distinct identity and blocks cloud/network by design',()=>{
 const pkg=require('../previews/workstation-2/package.json');
 const main=fs.readFileSync(path.join(dir,'main.js'),'utf8'),preload=fs.readFileSync(path.join(dir,'preload.js'),'utf8'),html=fs.readFileSync(path.join(dir,'index.html'),'utf8'),renderer=fs.readFileSync(path.join(dir,'renderer.js'),'utf8');
 assert.notEqual(pkg.build.appId,'com.apex.inventory');
 assert.match(pkg.build.appId,/preview/);
 assert.match(main,/APEX-Workstation-2-Preview/);
 assert.match(preload,/productionAccess:false/);
 assert.match(html,/connect-src 'none'/);
 assert.doesNotMatch(renderer,/fetch\(|XMLHttpRequest|localStorage|api\.workflow|supabase|ipcRenderer|require\(/i);
 assert.match(html,/Smart Refurbishment/);
});
