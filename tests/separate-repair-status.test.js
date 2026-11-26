'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const workflow=require('../src/inventory-workflow');
const base=()=>({assetId:'A-1',status:'Awaiting Parts',parts:[],qc:{}});
const battery={id:'battery',name:'Replacement battery',qty:1,received:1,fitted:1};
const spray={id:'spray',name:'Full respray',qty:1,received:0,fitted:0};
test('fitted parts are complete despite outstanding respray',()=>{
 const j=base();j.parts=[{...battery},{...spray}];
 const s=workflow.summarize(j);
 assert.equal(s.partsStatus,'Parts Fitted');
 assert.equal(s.resprayStatus,'Awaiting Respray');
 assert.equal(s.needsOrdering,0);
 assert.equal(s.key,'respray');
});
test('dispatched respray does not make replacement parts appear ordered',()=>{
 const j=base();j.parts=[{...battery},{...spray}];
 const orders=[{status:'Ordered',lines:[{assetId:'A-1',partId:'spray',qty:1,received:0}]}];
 const s=workflow.summarize(j,orders);
 assert.equal(s.partsStatus,'Parts Fitted');
 assert.equal(s.resprayStatus,'Sent for Respray');
 assert.equal(s.stage,'Sent for Respray');
});
test('parts can be needed while respray is complete',()=>{
 const j=base();j.parts=[{...battery,received:0,fitted:0},{...spray,received:1,fitted:1}];
 const s=workflow.summarize(j);
 assert.equal(s.partsStatus,'Parts Needed');
 assert.equal(s.resprayStatus,'Respray Complete');
 assert.equal(s.stage,'Needs ordering');
});
test('separate statuses are not required if no tasks exist',()=>{
 const s=workflow.summarize(base());
 assert.equal(s.partsStatus,'Not Required');
 assert.equal(s.resprayStatus,'Not Required');
 assert.equal(s.key,'qc');
});
