'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const wf=require('../src/refurb-workflow');
const item=(diagnosticTests={display:{status:'pass'}})=>({id:'QA-440',location:'Inspection',pallet:'PALLET-007',model:'Latitude',diagnosticTests});
const make=()=>({jobs:{'QA-440':{assetId:'QA-440',status:'Repair In Progress',updatedAt:'2026-11-01T00:00:00.000Z',parts:[{id:'p',name:'LCD',qty:1,received:0,fitted:0},{id:'c',name:'Full respray',qty:1,received:0,fitted:0}],qc:{}}},orders:[],audit:[]});
const cmd={type:'completeForQA',assetId:'QA-440',expectedUpdatedAt:'2026-11-01T00:00:00.000Z',confirmPhysicalWork:true,confirmFinalQC:true};
test('Explicit final signoff marks both repair and cosmetic work, all QA checks and job complete',()=>{
 const state=make(),asset=item(),r=wf.apply(structuredClone(state),[asset],cmd,'QA engineer');
 assert.equal(r.ok,true,r.error);assert.equal(r.workflow.jobs['QA-440'].status,'Completed');
 const j=r.workflow.jobs['QA-440'];
 for(const p of j.parts){assert.equal(p.received,1);assert.equal(p.fitted,1);}
 for(const k of wf.QC)assert.equal(j.qc[k],true);
 assert(r.workflow.audit.some(e=>e.type==='Completed QA sign-off'&&e.by==='QA engineer'));
 assert.equal(asset.pallet,'PALLET-007');
 assert.equal(asset.diagnosticTests.display.status,'pass');
});
test('Stale jobs and absent engineer confirmation cannot be completed',()=>{
 for(const patch of [{confirmFinalQC:false},{confirmPhysicalWork:false},{expectedUpdatedAt:'old'}]){
  const original=make(),snapshot=structuredClone(original),r=wf.apply(original,[item()],{...cmd,...patch});
  assert.equal(r.ok,false);assert.deepEqual(original,snapshot);
 }
});
test('Explicit failed diagnostics block QA completion without altering pass/fail or job',()=>{
 const a=item({battery:{status:'fail',comment:'capacity below threshold'},display:{status:'pass'}}),s=make(),snapshot=structuredClone(s);
 const r=wf.apply(s,[a],cmd);
 assert.equal(r.ok,false);assert.match(r.error,/failed synced diagnostics/i);assert.deepEqual(s,snapshot);
 assert.equal(a.diagnosticTests.battery.status,'fail');
});
test('Job on hold cannot be silently completed',()=>{
 const s=make();s.jobs['QA-440'].status='On Hold';
 const r=wf.apply(s,[item()],cmd);
 assert.equal(r.ok,false);assert.match(r.error,/on hold/i);
});
test('Order line receipts are not fabricated when final work is manually attested',()=>{
 const s=make();
 s.orders.push({status:'Ordered',lines:[{assetId:'QA-440',partId:'p',qty:1,received:0}]});
 const r=wf.apply(structuredClone(s),[item()],cmd);
 assert.equal(r.ok,true,r.error);
 assert.equal(r.workflow.orders[0].lines[0].received,0,'do not mark supplier order received without supplier receipt');
 assert(r.workflow.audit.some(e=>/operator.attested/i.test(e.detail)));
});
test('New Completed QA scanner signs off before saving individual Location and retains pallet',()=>{
 const src=fs.readFileSync(path.resolve(__dirname,'../src/renderer/completed-qa-ui.js'),'utf8');
 const action=src.slice(src.indexOf('async function archiveAsset'),src.indexOf('async function restoreAsset'));
 assert(action.includes('confirmFinalQC:true'));
 assert(action.includes('confirmPhysicalWork:true'));
 assert(action.indexOf('api.workflowAction(')<action.indexOf('api.update(found.id,{location:model.NAME})'));
 assert.doesNotMatch(action,/diagnosticTests\s*=|pallet\s*:/);
});
