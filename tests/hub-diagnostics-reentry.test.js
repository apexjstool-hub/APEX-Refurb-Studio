'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {latestReceipt,reportFor,forwardDeletedDiagnostics}=require('../cloud/hub-diagnostics-reentry');
const now=Date.parse('2026-10-15T15:00:00Z'),id='74484',eventId='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const marker={id,deleted_at:'2026-10-15T14:50:00Z'};
const receipt={source:'Diagnostics',assetId:id,eventId,at:'2026-10-15T14:55:00Z',outcome:'unchanged'};
const asset={id,model:'Retested model',serial:'SERIAL',condition:'D',location:'OLD LOCATION',pallet:'OLD PALLET',notes:'OLD NOTES',diagnosticTests:{keyboard:{status:'pass'},touchscreen:{status:'not-tested'}},refurbishment:{parts:['Old part']}};
test('Only an accepted Diagnostics receipt after deletion authorises forwarding',()=>{
 assert.equal(latestReceipt([receipt],id,marker.deleted_at,now).eventId,eventId);
 for(const altered of [{...receipt,source:'RefurbFlow'},{...receipt,outcome:'rejected'},{...receipt,at:'2026-10-15T14:49:00Z'},{...receipt,at:'2026-10-15T16:00:00Z'},{...receipt,eventId:'invalid'}])assert.equal(latestReceipt([altered],id,marker.deleted_at,now),null);
});
test('Re-entry payload excludes old placement, grade, notes and refurbishment history',()=>{
 const report=reportFor(asset);assert.equal(report.model,asset.model);assert.deepEqual(report.tests,{keyboard:{status:'pass',source:'APEX Diagnostics'}});
 for(const key of ['condition','location','pallet','notes','refurbishment','history'])assert.equal(Object.hasOwn(report,key),false);
});
test('Fresh unchanged hub intake re-registers, confirms and checkpoints once',async()=>{
 const remote=new Map(),state={};let calls=0;
 const args={assets:[asset],markers:[marker],receipts:[receipt],remote,state,now,
 receive:async cmd=>{calls++;assert.equal(cmd.p_asset_id,id);assert.equal(cmd.p_event_id,'hub-diagnostics:'+eventId);return {ok:true};},
 read:async()=>({id,payload:{id,model:'Retested model'},revision:20})};
 assert.equal((await forwardDeletedDiagnostics(args)).forwarded,1);assert.equal(state[id].lastHubDiagnosticEvent,eventId);assert.equal(remote.get(id).revision,20);
 assert.equal((await forwardDeletedDiagnostics(args)).forwarded,0);assert.equal(calls,1);
});
test('Rejected or interrupted forwarding is not acknowledged and can retry idempotently',async()=>{
 const remote=new Map(),state={};let confirmed=false;
 const args={assets:[asset],markers:[marker],receipts:[receipt],remote,state,now,receive:async()=>({ok:true}),read:async()=>confirmed?{id,payload:{id},revision:21}:null};
 const first=await forwardDeletedDiagnostics(args);assert.equal(first.errors.length,1);assert.equal(state[id],undefined);
 confirmed=true;assert.equal((await forwardDeletedDiagnostics(args)).forwarded,1);
});
test('Old local copy without a new accepted receipt stays blocked',async()=>{
 let called=false;const args={assets:[asset],markers:[marker],receipts:[],remote:new Map(),state:{},now,receive:async()=>{called=true;},read:async()=>null};
 assert.equal((await forwardDeletedDiagnostics(args)).forwarded,0);assert.equal(called,false);
});

test('The real sync worker forwards a new hub receipt before its deleted-tag skip',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'apex-hub-reentry-'));
 try{
  const config=path.join(folder,'config.json'),state=path.join(folder,'state.json'),output=path.join(folder,'forwarded.json');
  fs.writeFileSync(config,JSON.stringify({supabaseUrl:'https://test.supabase.co',serviceRoleKey:'sb_secret_isolated_test',hubUrl:'http://127.0.0.1:4217',hubToken:'isolated-test-token'}));
  const local={...asset},deletedAt=new Date(Date.now()-60000).toISOString(),at=new Date(Date.now()-1000).toISOString();
  const shim="const fs=require('node:fs');let forwarded=false;const local="+JSON.stringify(local)+";global.setInterval=()=>{};global.fetch=async(url,options={})=>{let data;const u=new URL(url);if(u.pathname==='/v1/items')data={items:[local]};else if(u.pathname==='/v1/intake/receipts')data={events:["+JSON.stringify({...receipt,at})+"]};else if(u.pathname==='/rest/v1/apex_deleted_assets')data=["+JSON.stringify({id,deleted_at:deletedAt})+"];else if(u.pathname==='/rest/v1/rpc/apex_receive_hub_diagnostics'){fs.writeFileSync("+JSON.stringify(output)+",options.body);forwarded=true;data={ok:true};}else if(u.pathname==='/rest/v1/apex_assets'){if(options.method&&options.method!=='GET')throw Error('Stale asset write attempted');data=forwarded?[{id:local.id,payload:{id:local.id,model:local.model},revision:25}]:[];}else if(u.pathname==='/rest/v1/apex_refurb_workflow')data=[{document:{jobs:{},orders:[],audit:[]},revision:1}];else throw Error('Unexpected route '+u.pathname);return new Response(JSON.stringify(data),{status:200});};require("+JSON.stringify(path.resolve(__dirname,'../cloud/sync-bridge.js'))+");";
  const result=spawnSync(process.execPath,['-e',shim],{encoding:'utf8',timeout:10000,env:{...process.env,APEX_CLOUD_BRIDGE_CONFIG:config,APEX_CLOUD_STATE_FILE:state}});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/diagnostics-reentered=1/);const sent=JSON.parse(fs.readFileSync(output,'utf8'));
  assert.equal(sent.p_asset_id,id);assert.equal(sent.p_report.location,undefined);assert.equal(sent.p_report.pallet,undefined);assert.equal(JSON.parse(fs.readFileSync(state,'utf8'))[id].lastHubDiagnosticEvent,eventId);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
