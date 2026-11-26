'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const display=require('../src/inventory-status-display');
const part=(name,extra={})=>({name,required:1,received:0,fitted:0,toOrder:0,toFit:0,...extra});
test('combined ordered replacement and dispatched respray renders two labelled chips',()=>{
 const s={key:'delivery',parts:[part('Battery'),part('Keyboard respray')],needsOrdering:0,awaitingDelivery:1,resprayStatus:'Sent for Respray'};
 assert.deepEqual(display.compose(s,null).badges.map(b=>b.label),['Parts ordered','Sent for respray']);
});
test('overdue replacement is visually highlighted without changing respray progress',()=>{
 const s={key:'order',parts:[part('LCD',{toOrder:1}),part('Lid respray')],needsOrdering:1,awaitingDelivery:0};
 const v=display.compose(s,27);assert.deepEqual(v.badges.map(b=>b.label),['Needs ordering','Needs respray']);assert.equal(v.waiting,'27d awaiting order');
});
test('completed respray and fitted parts show independently',()=>{
 const s={key:'qc',parts:[part('Battery',{received:1,fitted:1}),part('Keyboard repaint',{received:1,fitted:1})],needsOrdering:0,awaitingDelivery:0};
 assert.deepEqual(display.compose(s).badges.map(b=>b.label),['Parts fitted','Respray complete']);
});
test('respray-only jobs never display a parts ordered chip',()=>{
 const s={key:'respray-sent',parts:[part('Full respray')],resprayStatus:'Sent for Respray',needsOrdering:0,awaitingDelivery:0};
 assert.deepEqual(display.compose(s).badges.map(b=>b.label),['Sent for respray']);
});
test('no job and completed jobs have simple labels',()=>{
 assert.equal(display.compose(null).badges[0].label,'No refurb job');
 assert.equal(display.compose({key:'completed',parts:[]}).badges[0].label,'Completed');
});

test('Manual Parts Needed uses the calculated Needs ordering display',()=>{
 const summary={key:'order',manualBoard:'needed',parts:[part('LCD Panel',{toOrder:1}),part('Respray')],needsOrdering:1,awaitingDelivery:0};
 assert.deepEqual(display.compose(summary,4).badges.map(b=>b.label),['Needs ordering','Needs respray']);
 assert.equal(display.compose(summary,4).waiting,'4d awaiting order');
});
test('Manual Parts Needed must not relabel genuinely ordered parts as needing ordering',()=>{
 const summary={key:'delivery',manualBoard:'needed',parts:[part('LCD Panel',{required:1,awaiting:1,toOrder:0})],needsOrdering:0,awaitingDelivery:1};
 assert.deepEqual(display.compose(summary).badges.map(b=>b.label),['Parts ordered']);
});
test('Workflow stage derives from actual purchase progress instead of manually selected category',()=>{
 const workflow=require('../src/inventory-workflow');
 const job={assetId:'83253',partsBoard:'needed',parts:[{id:'lcd',name:'LCD Panel',qty:1,received:0,fitted:0}]};
 const ordered=workflow.summarize(job,[{status:'Ordered',lines:[{assetId:'83253',partId:'lcd',qty:1,received:0}]}]);
 assert.equal(ordered.key,'delivery');assert.equal(ordered.stage,'Parts ordered');
 assert.equal(ordered.needsOrdering,0);assert.equal(ordered.awaitingDelivery,1);
 const required=workflow.summarize(job,[]);
 assert.equal(required.key,'order');assert.equal(required.stage,'Needs ordering');assert.equal(required.needsOrdering,1);
 const arrived=workflow.summarize({...job,parts:[{...job.parts[0],received:1}]},[]);
 assert.equal(arrived.key,'fit');assert.equal(arrived.stage,'Ready to fit');
});
