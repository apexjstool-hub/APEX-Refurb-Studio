'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const reminders=require('../src/reminder-settings');
const workflow=require('../src/inventory-workflow');
const job=parts=>({assetId:'TEST-01',status:'Received',parts});
test('default reminder thresholds are editable and persist through reopening',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'apex-reminder-test-'));
 try{
  const file=path.join(folder,'settings.json');
  const before=reminders.read(file);
  assert.equal(before.attention,7);assert.equal(before.overdue,14);
  const after=reminders.write(file,{...before,attention:5,overdue:12,critical:25,respray:4,popup:false});
  assert.equal(after.respray,4);assert.equal(after.popup,false);
  assert.deepEqual(reminders.read(file),after);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('invalid reminder thresholds are rejected without changing stored preferences',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'apex-reminder-test-'));
 try{
  const file=path.join(folder,'settings.json'),initial=reminders.write(file,{...reminders.defaults});
  for(const patch of [{attention:15},{critical:0},{respray:366},{popup:'false'}]){
   assert.throws(()=>reminders.write(file,{...initial,...patch}));
   assert.deepEqual(reminders.read(file),initial);
  }
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
test('respray only is never shown as needs ordering',()=>{
 const result=workflow.summarize(job([{id:'spray',name:'Keyboard respray',qty:1,received:0,fitted:0}]));
 assert.equal(result.key,'respray');assert.equal(result.stage,'Awaiting Respray');assert.equal(result.needsOrdering,0);assert.equal(result.sprayOutstanding,true);
});
test('replacement parts remain in purchasing, even when respray is also required',()=>{
 const result=workflow.summarize(job([{id:'spray',name:'Full respray',qty:1,received:0,fitted:0},{id:'battery',name:'Replacement battery',qty:1,received:0,fitted:0}]));
 assert.equal(result.key,'order');assert.equal(result.needsOrdering,1);assert.equal(result.sprayOutstanding,true);
});
test('completed respray proceeds to quality control',()=>{
 const result=workflow.summarize(job([{id:'spray',name:'Lid respray',qty:1,received:1,fitted:1}]));
 assert.equal(result.key,'qc');assert.equal(result.sprayOutstanding,false);
});
