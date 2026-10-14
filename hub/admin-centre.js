'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {createAccountManager}=require('../src/account-security');
function createAdminCentre(options){
 const request=options.fetch||fetch;let child=null,startedAt=null,lastMessage='',starting=false;
 const read=()=>{try{return JSON.parse(fs.readFileSync(options.configFile,'utf8'));}catch{return {};}};
 const status=()=>{const c=read();return {ok:true,managed:true,configured:!!c.supabaseUrl&&!!c.serviceRoleKey,projectUrl:c.supabaseUrl||options.publicConfig.url||'',running:!!child&&child.exitCode===null,startedAt,lastMessage,localHub:options.hubUrl};};
 const cloudHeaders=c=>({apikey:c.serviceRoleKey,...(!c.serviceRoleKey.startsWith('sb_secret_')?{Authorization:'Bearer '+c.serviceRoleKey}:{}),'Content-Type':'application/json'});
 async function authorize(proof,local){
  // The caller must also possess the existing private Hub administrator token.
  // Loopback local administration remains available as a recovery path.
  if(!proof)return local;
  const pub=options.publicConfig,c=read(),url=c.supabaseUrl||pub.url;
  if(!url||url!==pub.url||!pub.anonKey)return false;
  try{
   const auth=await request(url+'/auth/v1/user',{headers:{apikey:pub.anonKey,Authorization:'Bearer '+proof},signal:AbortSignal.timeout(10000)});
   if(!auth.ok)return false;const u=await auth.json();if(!u.id)return false;
   const profile=await request(url+'/rest/v1/apex_staff?select=active,role&user_id=eq.'+encodeURIComponent(u.id),{headers:{apikey:pub.anonKey,Authorization:'Bearer '+proof},signal:AbortSignal.timeout(10000)});
   if(!profile.ok)return false;const rows=await profile.json();return rows.length===1&&rows[0].active===true&&rows[0].role==='admin';
  }catch{return false;}
 }
 async function check(){
  const c=read();if(!c.supabaseUrl||!c.serviceRoleKey)return {ok:false,error:'Configure the private cloud bridge once on the trusted hub PC, using your main administrator account.'};
  const response=await request(c.supabaseUrl+'/rest/v1/apex_assets?select=id&limit=1',{headers:cloudHeaders(c),signal:AbortSignal.timeout(12000)});
  if(!response.ok)return {ok:false,error:'Cloud check failed (HTTP '+response.status+').'};
  const assets=options.items();return {ok:true,localAssets:assets.length,cloudReachable:true,warning:assets.length?'':'The hub has no active assets.'};
 }
 function stop(shutdown=false){if(child&&child.exitCode===null)child.kill();if(!shutdown){const c=read();if(c.supabaseUrl){const tmp=options.configFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify({...c,syncEnabled:false}),{mode:0o600});fs.renameSync(tmp,options.configFile);}lastMessage='Cloud sync stopped by administrator.';}return {ok:true};}
 async function start(input){
  if(child&&child.exitCode===null)return status();if(starting)return {ok:false,error:'Sync is already starting.'};starting=true;
  try{
   if(input.confirmed!==true)return {ok:false,error:'Confirm the first-sync review before starting.'};
   const checked=await check();if(!checked.ok)return checked;if(!checked.localAssets)return {ok:false,error:'The hub has no active assets to sync.'};
   const runtime=options.configFile+'.runtime';const c=read();fs.writeFileSync(runtime,JSON.stringify({...c,hubUrl:options.hubUrl,hubToken:options.hubToken}),{mode:0o600});
   const env={...process.env,APEX_CLOUD_BRIDGE_CONFIG:runtime,APEX_CLOUD_STATE_FILE:options.stateFile};if(process.versions.electron)env.ELECTRON_RUN_AS_NODE='1';
   const saved=options.configFile+'.tmp';fs.writeFileSync(saved,JSON.stringify({...c,syncEnabled:true}),{mode:0o600});fs.renameSync(saved,options.configFile);
   child=(options.spawn||spawn)(process.execPath,[path.resolve(__dirname,'../cloud/sync-bridge.js')],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});const current=child;startedAt=new Date().toISOString();lastMessage='Starting cloud synchronisation…';
   const capture=d=>{lastMessage=String(d).trim().slice(-500).replace(/sb_secret_[^\s]+|eyJ[^\s]+/gi,'[redacted]');};
   current.stdout.on('data',capture);current.stderr.on('data',capture);current.on('error',()=>{lastMessage='Cloud sync could not start.';});
   current.on('exit',code=>{if(child===current){child=null;lastMessage='Sync process stopped ('+code+'). '+lastMessage;}try{fs.unlinkSync(runtime);}catch{}});return status();
  }finally{starting=false;}
 }
 const accounts=createAccountManager(()=>{const c=read();if(!c.supabaseUrl||!c.serviceRoleKey)throw Error('Configure the private cloud connection once on the trusted hub PC.');return c;},request);
 async function handle(action,input={},local=false){
  try{
   if(action==='status')return status();if(action==='check')return await check();if(action==='start')return await start(input);if(action==='stop')return stop();
   if(action==='save'){
    if(!local)return {ok:false,error:'The private secret can only be saved on the trusted hub PC. Remote administrators can test, start and stop its sync.'};
    if(child&&child.exitCode===null)return {ok:false,error:'Stop sync before changing its configuration.'};
    const url=String(input.supabaseUrl||'').trim().replace(/\/$/,'');const c=read();const key=String(input.secret||'').trim()||c.serviceRoleKey;
    if(url!==options.publicConfig.url)return {ok:false,error:'Use the same cloud project as the shared APEX account.'};
    if(!key||(!key.startsWith('sb_secret_')&&!key.startsWith('eyJ')))return {ok:false,error:'Enter the server-only secret on this trusted hub PC.'};
    if(key.startsWith('eyJ')){let claims;try{claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());}catch{}if(claims?.role!=='service_role')return {ok:false,error:'Use a service-role secret for the trusted bridge, not a public key.'};}
    const temp=options.configFile+'.tmp';fs.writeFileSync(temp,JSON.stringify({...c,supabaseUrl:url,serviceRoleKey:key,intervalSeconds:c.intervalSeconds||15}),{mode:0o600});fs.renameSync(temp,options.configFile);return status();
   }
   if(action==='users-list')return await accounts.list();if(action==='users-create')return await accounts.create(input);if(action==='users-update')return await accounts.update(input);
   return {ok:false,error:'Unknown Admin Centre action.'};
  }catch{return {ok:false,error:'Hub administration failed. Check the trusted hub connection.'};}
 }
 if(read().syncEnabled===true)setImmediate(()=>start({confirmed:true}).catch(()=>{lastMessage='Cloud sync could not resume. Check the connection.';}));
 return {authorize,handle,stop};
}
module.exports={createAdminCentre};
