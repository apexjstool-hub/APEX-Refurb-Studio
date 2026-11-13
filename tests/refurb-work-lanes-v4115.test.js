'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('../src/refurb-work-lanes');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const part=(name,required=1,fitted=0,received=0,awaiting=0,toOrder=required-received-awaiting)=>({id:name,name,required,fitted,received,awaiting,toOrder});
const row=(id,parts,status='Awaiting Parts',resprayStatus='')=>({job:{assetId:id,status},asset:{id,model:'Latitude 5440',serial:'SER-'+id},summary:{parts,resprayStatus}});
test('Physical parts and cosmetic respray stay in independent queues without cloning assets',()=>{
 const r=row('67997',[part('LCD assembly'),part('Full respray')]);
 const a=L.lanes([r]);
 assert.equal(a.parts.length,1);assert.equal(a.respray.length,1);assert.deepEqual(a.both,['67997']);
 assert.strictEqual(a.parts[0].job,r.job);assert.strictEqual(a.respray[0].job,r.job);
 assert.equal(a.parts[0].parts[0].name,'LCD assembly');
 assert.equal(a.respray[0].parts[0].name,'Full respray');
});
test('Parts-only and respray-only devices appear in their corresponding lanes',()=>{
 const q=L.lanes([row('A',[part('Battery')]),row('B',[part('Keyboard respray')])]);
 assert.deepEqual(q.parts.map(x=>x.assetId),['A']);assert.deepEqual(q.respray.map(x=>x.assetId),['B']);assert.deepEqual(q.both,[]);
});
test('Completed tasks leave their own queue while other work remains visible',()=>{
 const r=row('A',[part('Battery',1,1,1,0,0),part('All respray',1,0)]);
 const q=L.lanes([r]);assert.equal(q.parts.length,0);assert.equal(q.respray.length,1);
 const done=L.lanes([row('B',[part('LCD')],'Completed'),row('C',[part('Full respray')],'On Hold')]);
 assert.equal(done.parts.length,0);assert.equal(done.respray.length,0);
});
test('Respray dispatched and returned stages are read from existing manifest-derived status',()=>{
 const parts=[part('Full respray',1,0,0,1,0)];
 assert.equal(L.lanes([row('A',parts,'Awaiting Parts','Sent for Respray')]).respray[0].status,'Sent for respray');
 assert.equal(L.lanes([row('A',[part('Full respray',1,0,1,0,0)],'Awaiting Parts','Respray Returned')]).respray[0].status,'Respray returned');
});
test('Parts workflow statuses never become cosmetic statuses',()=>{
 assert.equal(L.lanes([row('A',[part('LCD',1,0,0,0,1)])]).parts[0].status,'Needs ordering');
 assert.equal(L.lanes([row('A',[part('LCD',1,0,0,1,0)])]).parts[0].status,'Parts ordered');
 assert.equal(L.lanes([row('A',[part('LCD',1,0,1,0,0)])]).parts[0].status,'Ready to fit');
});
test('Refurbishment UI exposes and routes separate queue tabs without new persistence',()=>{
 const html=read('src/renderer/index.html'),js=read('src/renderer/refurb-workspace.js');
 for(const id of ['rwLaneView','rwLaneSearch','rwLaneTable','rwLaneSummary'])assert(html.includes('id="'+id+'"'),id);
 assert.match(html,/data-rw-view="partsLane"/);assert.match(html,/data-rw-view="resprayLane"/);
 assert.match(html,/refurb-work-lanes\.js/);assert.match(html,/refurb-work-lanes-v4115\.css/);
 assert.match(js,/function drawLane\(/);assert.match(js,/window\.ApexRefurbLanes\.lanes\(entries\(\)\)/);
 assert.match(js,/both:'Both required'/);assert.match(js,/parts:\['partsLane'\]/);
 assert.match(js,/openDevice\(button\.dataset\.rwLaneOpen/);
 assert.doesNotMatch(read('src/refurb-work-lanes.js'),/workflowAction|fetch\(|supabase|localStorage/);
});
