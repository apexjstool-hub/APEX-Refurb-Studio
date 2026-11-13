'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Pulse=require('../src/operations-pulse-v4120');
const asset=id=>({id}),part=(name,qty=1,fitted=0)=>({name,qty,fitted});
const job=(assetId,parts,status='Repair In Progress',qc={})=>({assetId,parts,status,qc});
test('Dashboard pulse counts Parts and Respray independently without duplicating laptops',()=>{
 const workflow={jobs:{A:job('A',[part('Battery'),part('Full respray')]),B:job('B',[part('LCD',1,1),part('Keyboard respray')]),C:job('C',[part('Keyboard',1,1)],'Quality Control')},resprayPallets:[]};
 const p=Pulse.calculate(workflow,[asset('A'),asset('B'),asset('C')]);
 assert.equal(p.waitingParts,1);assert.equal(p.waitingRespray,2);assert.equal(p.readyQc,1);
});
test('Completed and on-hold jobs do not inflate actionable counts',()=>{
 const p=Pulse.calculate({jobs:{A:job('A',[part('Battery')],'Completed'),B:job('B',[part('Full respray')],'On Hold')}},[asset('A'),asset('B')]);
 assert.equal(p.waitingParts,0);assert.equal(p.waitingRespray,0);assert.equal(p.readyQc,0);
});
test('Removed assets are excluded and no workflow displays unknown counts',()=>{
 const wf={jobs:{A:job('A',[part('Battery')])}};
 assert.equal(Pulse.calculate(wf,[{id:'A',deletedAt:'2026-11-13'}]).waitingParts,0);
 assert.equal(Pulse.calculate(undefined,[asset('A')]).available,false);
});
test('Dispatch lifecycle tracks sent returned and inspected status without marking resprays complete',()=>{
 assert.deepEqual(Pulse.steps('Dispatched').map(x=>x.done),[true,false,false]);
 assert.deepEqual(Pulse.steps('Returned').map(x=>x.done),[true,true,false]);
 assert.deepEqual(Pulse.steps('Completed').map(x=>x.done),[true,true,true]);
 const p=Pulse.calculate({jobs:{},resprayPallets:[{status:'Dispatched'},{status:'Returned'},{status:'Completed'}]},[]);
 assert.equal(p.dispatched,1);assert.equal(p.returned,1);
});
test('Dashboard and Dispatch improvements read existing records and preserve original navigation/actions',()=>{
 const html=read('src/renderer/index.html'),dash=read('src/renderer/dashboard-operations-v4120.js'),disp=read('src/renderer/dispatch-centre-v4116.js');
 const css=read('src/renderer/dashboard-dispatch-v4120.css'),app=read('src/renderer/app.js');
 for(const id of ['dashboardPage','dispatchPage','dispatchRefresh','dispatchSummary','dispatchRecords'])assert(html.includes('id="'+id+'"'),id);
 for(const name of ['operations-pulse-v4120.js','dashboard-operations-v4120.js','dashboard-dispatch-v4120.css'])assert(html.includes(name),name);
 assert.match(dash,/ApexOperationsPulse/);assert.match(dash,/apex:workflow-updated/);
 assert.match(disp,/ApexOperationsPulse\?\.steps/);
 assert.match(disp,/ApexMicrodreamRespray\?\.open/);
 assert.match(disp,/api\.workflow\(\)/);
 assert.match(app,/setPage\(page,force=false\)/);
 assert.doesNotMatch(dash,/workflowAction\(|api\.update\(|api\.add\(|localStorage/);
 assert.doesNotMatch(css,/#assetPage|#inventoryPage|#palletsPage|#refurbWorkspacePage/);
 assert.match(css,/@media\(max-width:760px\)/);
});
