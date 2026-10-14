'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),summary=require('../src/device-summary');
test('Process required distinguishes outstanding fitted parts from respray tasks',()=>{
 const asset={id:'A'},wf={jobs:{A:{parts:[{name:'Keyboard',qty:2,received:2,fitted:1},{name:'Lid respray',qty:1,fitted:0},{name:'Battery',qty:1,fitted:1}]}}};
 const result=summary.process(asset,wf);assert.deepEqual(result.labels,['Parts fitting','Respray']);assert.equal(result.parts,1);assert.equal(result.respray,1);
 wf.jobs.A.parts[0].fitted=2;assert.deepEqual(summary.process(asset,wf).labels,['Respray']);wf.jobs.A.parts[1].fitted=1;assert.deepEqual(summary.process(asset,wf).labels,['Final checks / QC']);
});
test('Latest recorded RefurbFlow requirements provide a fallback without guessing from notes',()=>{
 const a={id:'A',refurbishment:{latestKey:'new',reports:[{key:'old',repairs:[{name:'Keyboard',quantity:1}]},{key:'new',repairs:[{name:'Base re-spray',quantity:1}]}]}};
 assert.deepEqual(summary.process(a,{jobs:{}}).labels,['Respray']);assert.deepEqual(summary.process({id:'A',notes:'maybe needs paint'},{jobs:{}}).labels,['Not recorded']);
 assert.deepEqual(summary.process(a,{jobs:{A:{status:'Completed',parts:[{name:'Lid respray',qty:1,fitted:0}]}}}).labels,['Completed']);
});
test('Every selected device grade takes precedence over calculated inspection grades',()=>{
 assert.deepEqual(summary.grade({condition:'B'},{grade:'D'}),{value:'B',source:'Assigned grade'});
 for(const condition of ['A','B','C','D','Excellent','Good','Fair'])assert.deepEqual(summary.grade({condition},{grade:'C'}),{value:condition,source:'Assigned grade'});
 assert.deepEqual(summary.grade({condition:'Not assessed'},{grade:'C'}),{value:'Not assessed',source:'No grade recorded'});
 assert.deepEqual(summary.grade({}, {grade:'C'}),{value:'C',source:'Inspection grade'});
 assert.equal(summary.grade({}, {grade:'Pending'}).value,'Not assessed');
});
