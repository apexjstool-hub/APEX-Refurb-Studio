'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const n=require('../src/parts-order-notification');
const now=Date.UTC(2026,10,12),iso=days=>new Date(now-days*86400000).toISOString();
const asset=id=>({id});
const job=(id,parts,status='Awaiting Parts')=>({assetId:id,status,createdAt:iso(20),parts});
const part=(id,name,qty=1,received=0,days=1)=>({id,name,qty,received,createdAt:iso(days)});
test('counts only unordered replacement part laptops, excluding resprays, completed and already ordered',()=>{
 const assets=['A','B','C','D','E','F'].map(asset);
 const workflow={jobs:{
  A:job('A',[part('A1','Battery',1,0,9)]),
  B:job('B',[part('B1','Full respray',1,0,20)]),
  C:job('C',[part('C1','LCD',1,0,20)],'Completed'),
  D:{...job('D',[part('D1','Keyboard',1,0,20)]),partsBoard:'ordered'},
  E:job('E',[part('E1','Screen',1,0,5)]),
  F:job('F',[part('F1','Trackpad',1,0,20)],'On Hold')
 },orders:[{status:'Ordered',lines:[{assetId:'E',partId:'E1',qty:1,received:0}]}]};
 assert.deepEqual(n.summary(workflow,assets,now),{count:1,older7:1,ids:['A']});
});
test('one laptop counts once even with multiple replacement requirements',()=>{
 const wf={jobs:{A:job('A',[part('1','LCD',1,0,2),part('2','Battery',1,0,12)])},orders:[]};
 assert.deepEqual(n.summary(wf,[asset('A')],now),{count:1,older7:1,ids:['A']});
});
test('unavailable assets and fully ordered or received parts are excluded',()=>{
 const wf={jobs:{A:job('A',[part('1','Battery',1,1)]),B:job('B',[part('2','LCD')])},orders:[]};
 assert.equal(n.summary(wf,[{id:'A'},{id:'B',deletedAt:iso(0)}],now).count,0);
});
test('frequency selections respect interval and increased counts',()=>{
 assert.equal(n.shouldShow({count:2,frequency:'session',now}),true);
 assert.equal(n.shouldShow({count:2,frequency:'session',lastShown:now-10000,lastCount:2,now}),false);
 assert.equal(n.shouldShow({count:3,frequency:'session',lastShown:now-10000,lastCount:2,now}),true);
 assert.equal(n.shouldShow({count:1,frequency:'30m',lastShown:now-30*60000,lastCount:1,now}),true);
 assert.equal(n.shouldShow({count:1,frequency:'4h',lastShown:now-30*60000,lastCount:1,now}),false);
 assert.equal(n.shouldShow({count:10,frequency:'off',now}),false);
});
test('Admin Centre uses only simple parts notice frequency controls',()=>{
 const c=fs.readFileSync(path.join(__dirname,'../src/renderer/refurb-reminders.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../src/renderer/index.html'),'utf8');
 assert.match(c,/apexPartsNoticeFrequency/);
 assert.match(c,/localStorage\.setItem/);
 assert.match(c,/setPage\('parts',true\)/);
 assert.match(c,/10000/);
 assert.doesNotMatch(c,/desktopReminderNotify|apexAgeingAlerts|apexReminderToast|settings\.attention/);
 assert.doesNotMatch(html,/<h2>Smart reminders<\/h2>/);
});
