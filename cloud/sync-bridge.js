'use strict';
/* Runs only on an administrator-controlled computer. Never embed service-role keys in Electron renderer. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const envFile=process.env.APEX_CLOUD_BRIDGE_CONFIG || path.join(__dirname,'cloud-bridge.local.json');
if(!fs.existsSync(envFile)){console.error('Create cloud-bridge.local.json from example first.');process.exit(1);}
const config=JSON.parse(fs.readFileSync(envFile,'utf8'));
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl||'')||!config.serviceRoleKey||!/^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(config.hubUrl||'')||!config.hubToken||config.hubToken==='SET_WHEN_STARTED'){console.error('Invalid bridge configuration. Use loopback hub URL and private server credentials.');process.exit(1);}
const base=config.supabaseUrl+'/rest/v1/apex_assets',stateFile=process.env.APEX_CLOUD_STATE_FILE || path.join(__dirname,'cloud-sync-state.local.json');
let state={};try{state=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{}
const headers={apikey:config.serviceRoleKey,Authorization:'Bearer '+config.serviceRoleKey,'Content-Type':'application/json'};
const hash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const syncedFields=['model','manufacturer','serial','location','status','condition','notes'];
const shape=x=>Object.fromEntries(syncedFields.map(k=>[k,x?.[k]??'']));
function persist(){const temp=stateFile+'.tmp';fs.writeFileSync(temp,JSON.stringify(state,null,2),{mode:0o600});fs.renameSync(temp,stateFile);}
async function fetchJson(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(`${r.status}: ${(await r.text()).slice(0,250)}`);if(r.status===204)return null;return r.json();}
async function hub(method,p,body){return fetchJson(config.hubUrl+p,{method,headers:{Authorization:'Bearer '+config.hubToken,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
async function cloud(method,p,body,moreHeaders={}){return fetchJson(base+p,{method,headers:{...headers,...moreHeaders},body:body?JSON.stringify(body):undefined});}
// Exclusive process lock protects the local sync state against two independent bridge processes.
// If a process crashes, a stale lock is cleared only when its PID no longer exists.
const lockFile=stateFile+'.lock';
function runningPid(pid){if(!Number.isInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}}
function takeLock(){
 for(let attempt=0;attempt<2;attempt++){
  try{const fd=fs.openSync(lockFile,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({pid:process.pid,started:new Date().toISOString()}));fs.closeSync(fd);return true;}
  catch(e){if(e.code!=='EEXIST')throw e;}
  let owner;try{owner=JSON.parse(fs.readFileSync(lockFile,'utf8'));}catch{return false;}
  if(runningPid(Number(owner.pid)))return false;
  try{fs.unlinkSync(lockFile);}catch{return false;}
 }
 return false;
}
if(!takeLock()){console.error('[SYNC ALREADY RUNNING] Another bridge owns the cloud state. Not starting a second sync process.');process.exit(3);}
function releaseLock(){try{const owner=JSON.parse(fs.readFileSync(lockFile,'utf8'));if(owner.pid===process.pid)fs.unlinkSync(lockFile);}catch{}}
process.on('exit',releaseLock);
process.on('SIGINT',()=>process.exit(0));
process.on('SIGTERM',()=>process.exit(0));
let busy=false;
async function cycle(){if(busy)return;busy=true;
try{
 const [local,remote]=await Promise.all([hub('GET','/v1/items'),cloud('GET','?select=id,payload,revision&limit=10000')]);
 // Permanent deletion markers are authoritative. Never recreate a deleted asset
 // from a stale Shared Hub copy, even if the previous sync state still has it.
 const deletedRows=await fetchJson(config.supabaseUrl+'/rest/v1/apex_deleted_assets?select=id&limit=10000',
  {headers});
 const permanentlyDeleted=new Set(deletedRows.map(row=>row.id));
 const rem=new Map(remote.map(x=>[x.id,x]));let added=0,pushed=0,pulled=0,conflicts=0,blocked=0;
 for(const a of local.items){if(!a.id)continue;
 const id=a.id;
 if(permanentlyDeleted.has(id)){
  // Retain the tombstone; do not seed or push a deleted asset.
  delete state[id];blocked++;continue;
 }
 const r=rem.get(id),h=hash(shape(a)),s=state[id];
 if(!r){ // Seed only new assets; never silently remove remote data.
  const created=await cloud('POST','?select=id,payload,revision',[{id,payload:a}],{Prefer:'return=representation'});
  state[id]={localHash:h,cloudRevision:created[0].revision};added++;continue;
 }
 if(!s){ // Both sides existed before first sync. Require review unless identical.
  if(hash(shape(r.payload))===h)state[id]={localHash:h,cloudRevision:r.revision};
  else {conflicts++;console.error('[CONFLICT initial]',id,'Different cloud and local records. No overwrite.');}
  continue;
 }
 const localChanged=s.localHash!==h,cloudChanged=s.cloudRevision!==r.revision;
 if(localChanged&&cloudChanged){conflicts++;console.error('[CONFLICT concurrent]',id,'Both copies changed. No overwrite.');continue;}
 if(cloudChanged){
  const patch=shape(r.payload);
  await hub('PATCH','/v1/items/'+encodeURIComponent(id),patch);
  const refreshed=(await hub('GET','/v1/items')).items.find(x=>x.id===id);
  if(refreshed)state[id]={localHash:hash(shape(refreshed)),cloudRevision:r.revision};pulled++;
 }else if(localChanged){
  const saved=await cloud('PATCH','?id=eq.'+encodeURIComponent(id)+'&revision=eq.'+r.revision+'&select=id,revision',[{payload:a}][0],{Prefer:'return=representation'});
  if(saved.length!==1){conflicts++;console.error('[CONFLICT revision]',id,'Cloud changed during write.');continue;}
  state[id]={localHash:h,cloudRevision:saved[0].revision};pushed++;
 }
 }
 persist();console.log(new Date().toISOString(),`Synced: seeded=${added}, local→cloud=${pushed}, cloud→local=${pulled}, permanently-deleted-skipped=${blocked}, conflicts=${conflicts}`);
}catch(e){console.error('[SYNC ERROR]',e.message);}finally{busy=false;}}
cycle();setInterval(cycle,Number(config.intervalSeconds||15)*1000);
