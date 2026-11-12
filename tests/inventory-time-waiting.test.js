'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const display=require('../src/inventory-status-display');
const at=Date.UTC(2026,10,12,12);
const ago=n=>new Date(at-n*86400000).toISOString();
const part=(name,days,toOrder=1)=>({name,required:1,received:0,fitted:0,toOrder,createdAt:ago(days)});
test('Time waiting includes freshly required parts before reminders trigger',()=>{
 const summary={needsOrdering:1,parts:[part('Replacement battery',1)]},job={createdAt:ago(40)};
 assert.equal(display.waitingDays(summary,job,at),1);
 assert.equal(display.compose(summary,1).waiting,'1d awaiting order');
});
test('Time waiting tracks oldest un-ordered replacement request regardless of job edit time',()=>{
 const summary={needsOrdering:2,parts:[part('LCD',27),part('Battery',3),part('Keyboard respray',50)]};
 const job={createdAt:ago(100),updatedAt:ago(0)};
 assert.equal(display.waitingDays(summary,job,at),27);
});
test('Time waiting ignores respray-only, already ordered and completed requests',()=>{
 assert.equal(display.waitingDays({needsOrdering:0,parts:[part('Full respray',12)]},{createdAt:ago(60)},at),null);
 assert.equal(display.waitingDays({needsOrdering:0,parts:[part('Battery',12,0)]},{createdAt:ago(60)},at),null);
});
test('Legacy requirements use job creation time where their own timestamp is missing',()=>{
 const summary={needsOrdering:1,parts:[{name:'LCD',toOrder:1}]};
 assert.equal(display.waitingDays(summary,{createdAt:ago(8),updatedAt:ago(0)},at),8);
});
test('no reliable timestamp shows dash instead of invented duration',()=>{
 assert.equal(display.waitingDays({needsOrdering:1,parts:[{name:'Battery',toOrder:1}]},{},at),null);
});
