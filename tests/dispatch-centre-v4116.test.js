'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const D=require('../src/dispatch-status-v4116');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const part=(name,qty=1,fitted=0,received=fitted)=>({id:name,name,qty,fitted,received});
const job=(parts,status='Repair In Progress',qc={})=>({assetId:'APX-1',parts,status,qc});
const qc={'Visual inspection':true,'Required parts fitted':true,'Hardware retest':true,'Final clean & sign-off':true};
const pallet=(status)=>({id:'DISPATCH-1',palletName:'MD-01',status,dispatchedAt:'2026-11-12T12:00:00Z',manifest:[{assetId:'APX-1',parts:[{partId:'Full respray',qty:1,name:'Full respray'}]}]});
test('Parts may be completed while outstanding respray remains incomplete and laptop cannot be complete',()=>{
 const s=D.status(job([part('LCD',1,1,1),part('Full respray')]),{});
 assert.equal(s.parts,'Completed');assert.equal(s.respray,'Incomplete');assert.equal(s.partsDone,true);
 assert.equal(s.resprayDone,false);assert.equal(s.readyForQc,false);assert.equal(s.completed,false);
 assert.equal(s.overall,'Respray outstanding');
});
test('Respray done never automatically marks replacement parts completed',()=>{
 const s=D.status(job([part('LCD'),part('Full respray',1,1,1)]),{});
 assert.equal(s.parts,'Incomplete');assert.equal(s.respray,'Completed');assert.equal(s.completed,false);
 assert.equal(s.overall,'Replacement parts outstanding');
});
test('Not-required work is not treated as outstanding, and QC gates overall completion',()=>{
 const a=D.status(job([part('LCD',1,1,1)]),{});
 assert.equal(a.respray,'Not required');assert.equal(a.readyForQc,true);assert.equal(a.completed,false);
 const b=D.status(job([part('Full respray',1,1,1)],'Quality Control',qc),{});
 assert.equal(b.parts,'Not required');assert.equal(b.completed,false);
 assert.equal(b.overall,'QC passed — confirm job completion');
 const c=D.status(job([part('LCD',1,1,1),part('Full respray',1,1,1)],'Completed',qc),{});
 assert.equal(c.completed,true);assert.equal(c.overall,'Completed');
});
test('Pallet dispatch, return and inspection state remain separate from parts fitting',()=>{
 const j=job([part('LCD',1,1,1),part('Full respray')]);
 const sent=D.status(j,{resprayPallets:[pallet('Dispatched')]});
 const returned=D.status(j,{resprayPallets:[pallet('Returned')]});
 assert.equal(sent.parts,'Completed');assert.equal(sent.respray,'Sent for respray');
 assert.equal(returned.parts,'Completed');assert.equal(returned.respray,'Returned — inspect');
 assert.equal(returned.readyForQc,false);
});
test('Dispatch history includes completed records and original captured manifests without mutation',()=>{
 const a=pallet('Dispatched'),b={...pallet('Completed'),id:'D-2',dispatchedAt:'2026-11-11T10:00:00Z'};
 const workflow={resprayPallets:[b,a]},snapshot=JSON.stringify(workflow);
 const out=D.shipments(workflow);
 assert.deepEqual(out.map(s=>s.status),['Dispatched','Completed']);
 assert.equal(out[0].manifest[0].assetId,'APX-1');
 assert.equal(JSON.stringify(workflow),snapshot);
});
test('Dispatch navigation and independent completion display retain original workflow actions',()=>{
 const html=read('src/renderer/index.html'),app=read('src/renderer/app.js'),ui=read('src/renderer/refurb-ui.js'),dispatch=read('src/renderer/dispatch-centre-v4116.js');
 for(const id of ['dispatchPage','dispatchRefresh','dispatchSummary','dispatchRecords','dispatchSearch'])assert(html.includes('id="'+id+'"'),id);
 assert.match(html,/data-page="dispatch"/);assert.match(app,/dispatch:'Dispatch'/);
 assert.match(app,/ApexDispatchCentre\?\.open\(\)/);
 assert.match(html,/dispatch-status-v4116\.js/);
 assert.match(html,/independent-completion-v4116\.css/);
 assert.match(ui,/ApexDispatchStatus\?\.status\(job,ops\)/);
 assert.match(ui,/Replacement parts/);assert.match(ui,/Quality control/);
 assert.match(dispatch,/ApexMicrodreamRespray\?\.open/);
 assert.match(dispatch,/api\.workflow\(\)/);
 assert.doesNotMatch(dispatch,/api\.workflowAction\(/);
});
