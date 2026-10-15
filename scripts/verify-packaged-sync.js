'use strict';
/* Execute with the PACKAGED Electron binary in Node mode, not the development Node runtime. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const archive=path.resolve('dist/win-unpacked/resources/app.asar');
for(const file of ['cloud/sync-bridge.js','cloud/refurb-parts-bridge.js','cloud/hub-diagnostics-reentry.js','src/diagnostic-tests.js']){
 assert(fs.existsSync(path.join(archive,file)),'Missing packaged sync dependency: '+file);
}
const forwarding=require(path.join(archive,'cloud/hub-diagnostics-reentry.js'));
assert.equal(typeof forwarding.forwardDeletedDiagnostics,'function');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'apex-packaged-sync-'));
try{
 const config=path.join(folder,'private-test.json'),state=path.join(folder,'state.json'),output=path.join(folder,'forwarded.json');
 fs.writeFileSync(config,JSON.stringify({supabaseUrl:'https://test.supabase.co',serviceRoleKey:'sb_secret_isolated_packaging_test',hubUrl:'http://127.0.0.1:4217',hubToken:'isolated-test-token'}));
 const asset={id:'PACKAGED-RETEST',model:'Packaged test laptop',serial:'NEW-SERIAL',location:'OLD LOCATION',condition:'D',diagnosticTests:{keyboard:{status:'pass'}}};
 asset.refurbishment={reports:[{key:'old:job',sourceUpdatedAt:Date.now()-120000,receivedAt:new Date(Date.now()-120000).toISOString(),repairs:[{name:'OLD PART',quantity:1}]},{key:'new:job',sourceUpdatedAt:Date.now()-1000,receivedAt:new Date(Date.now()-1000).toISOString(),repairs:[{name:'NEW PART',quantity:1}]}]};
 const receipt={source:'Diagnostics',assetId:asset.id,eventId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',at:new Date(Date.now()-1000).toISOString(),outcome:'unchanged'};
 const marker={id:asset.id,deleted_at:new Date(Date.now()-60000).toISOString()};
 const shim="const fs=require('node:fs');let forwarded=false;const asset="+JSON.stringify(asset)+";global.setInterval=()=>{};global.fetch=async(url,options={})=>{const u=new URL(url);let data;if(u.pathname==='/v1/items')data={items:[asset]};else if(u.pathname==='/v1/intake/receipts')data={events:["+JSON.stringify(receipt)+"]};else if(u.pathname==='/rest/v1/apex_deleted_assets')data=["+JSON.stringify(marker)+"];else if(u.pathname==='/rest/v1/rpc/apex_receive_hub_diagnostics'){fs.writeFileSync("+JSON.stringify(output)+",options.body);forwarded=true;data={ok:true};}else if(u.pathname==='/rest/v1/apex_assets'){if(options.method&&options.method!=='GET')throw Error('Stale inventory write attempted');data=forwarded?[{id:asset.id,payload:{id:asset.id,model:asset.model,createdAt:new Date(Date.now()-30000).toISOString()},revision:25}]:[];}else if(u.pathname==='/rest/v1/apex_refurb_workflow'){if(options.method==='PATCH'){fs.writeFileSync("+JSON.stringify(path.join(folder,'parts.json'))+",options.body);data=[{revision:2}];}else data=[{document:{jobs:{},orders:[],audit:[]},revision:1}];}else throw Error('Unexpected request '+u.pathname);return new Response(JSON.stringify(data),{status:200});};require("+JSON.stringify(path.join(archive,'cloud/sync-bridge.js'))+");";
 const child=spawnSync(process.execPath,['-e',shim],{encoding:'utf8',timeout:20000,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',APEX_CLOUD_BRIDGE_CONFIG:config,APEX_CLOUD_STATE_FILE:state}});
 assert.equal(child.status,0,'Packaged sync worker failed: '+child.stderr);
 assert.match(child.stdout,/diagnostics-reentered=1/);
 assert.match(child.stdout,/refurb-parts added=1/);
 const parts=JSON.parse(fs.readFileSync(path.join(folder,'parts.json'),'utf8'));
 assert.deepEqual(parts.document.jobs[asset.id].parts.map(p=>p.name),['NEW PART']);
 const forwarded=JSON.parse(fs.readFileSync(output,'utf8'));
 assert.equal(forwarded.p_asset_id,asset.id);assert.equal(forwarded.p_report.location,undefined);
 assert.equal(JSON.parse(fs.readFileSync(state,'utf8'))[asset.id].lastHubDiagnosticEvent,receipt.eventId);
 console.log('PASS: packaged app.asar sync worker starts, loads dependencies and forwards a fresh deleted-tag Diagnostics receipt and imports only new RefurbFlow parts.');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
