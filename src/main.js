'use strict';
const { app, BrowserWindow, ipcMain, session, dialog, safeStorage } = require('electron');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const os=require('node:os');
const {spawn}=require('node:child_process');
const core=require('./inventory-core');
const workflow=require('./refurb-workflow');
const maintenance=require('./record-maintenance');
const locationManagement=require('./location-management');
const palletManagement=require('./pallet-management');
const xlsx=require('./xlsx-export');
const backupManager=require('./backup-manager');
const {shell}=require('electron');
const updateCentre=require('./update-centre');
const arrivalTracker=new (require('./inventory-arrivals').InventoryArrivals)();
let intakeNotification=null,arrivalPollBusy=false;
// Use the same app identity and native Windows icon as APEX Laptop Diagnostics.
app.setName('APEX Refurb Management Studio');
if(process.platform==='win32') app.setAppUserModelId('com.apex.inventory');
let cloudSession=null;
const cloudSeenRevisions=new Map();
let win,authenticated=false,authMode=null,cloudUserRole=null,loginFailures=0,nextAttempt=0,ownedHub=null,cloudProcess=null,cloudRunningSince=null,cloudLastMessage="";
const userDir=()=>app.getPath('userData');
const dbPath=()=>path.join(userDir(),'inventory-db.json');
const hubPath=()=>path.join(userDir(),'hub-connection.json');
const demoItems=[
 {id:'APX-10482',manufacturer:'Dell',model:'Latitude 5420',serial:'DL5420-K73M',productType:'Laptop',processor:'Intel Core i5-1145G7',gpu:'Intel Iris Xe Graphics',ram:'16 GB',ramType:'DDR4',pallet:'PALLET-07',sku:'DELL-5420-I5',status:'Processed',condition:'A',location:'Warehouse A',inspection:{cosmetic:'Excellent',functional:'Pass',battery:'Good'},createdAt:'2026-10-03T10:00:00Z'},
 {id:'APX-10483',manufacturer:'HP',model:'EliteBook 840 G9',serial:'HP840-V21F',productType:'Laptop',processor:'Intel Core i5-1235U',gpu:'Intel Iris Xe Graphics',ram:'16 GB',ramType:'DDR4',pallet:'PALLET-09',sku:'HP-840G9',status:'Awaiting Processing',condition:'Good',location:'Inspection',inspection:{cosmetic:'Good',functional:'Not tested',battery:'Good'},createdAt:'2026-10-04T11:00:00Z'},
 {id:'APX-10484',manufacturer:'Lenovo',model:'ThinkPad T14',serial:'LN-T14-X01',productType:'Laptop',processor:'AMD Ryzen 5 PRO',gpu:'AMD Radeon Graphics',ram:'8 GB',ramType:'DDR4',pallet:'PALLET-11',sku:'LEN-T14',status:'Awaiting Processing',condition:'D',location:'Repair bench',inspection:{cosmetic:'Fair',functional:'Issues',battery:'Worn'},createdAt:'2026-10-05T12:00:00Z'},
 {id:'APX-10485',manufacturer:'Dell',model:'Precision 3581',serial:'DP3581-U28Q',productType:'Laptop',processor:'Intel Core i7-13700H',gpu:'NVIDIA RTX A500',ram:'32 GB',ramType:'DDR5',pallet:'PALLET-14',sku:'DELL-3581',status:'Processed',condition:'B',location:'Warehouse B',inspection:{cosmetic:'Good',functional:'Pass',battery:'Not applicable'},createdAt:'2026-10-06T13:00:00Z'}
].map(core.normalize);
const hash=(p,s)=>crypto.scryptSync(p,s,64).toString('hex');
function atomic(file,obj){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(obj,null,2),{mode:0o600});fs.renameSync(tmp,file);}
function loadDB(){if(!fs.existsSync(dbPath())){const salt=crypto.randomBytes(24).toString('hex');atomic(dbPath(),{user:{username:'admin',salt,passwordHash:hash('Admin123!',salt),mustChangePassword:true},items:demoItems});}
 const db=JSON.parse(fs.readFileSync(dbPath(),'utf8'));if(!db.user?.passwordHash||!Array.isArray(db.items))throw Error('Invalid inventory database');db.items=db.items.map(core.normalize);db.locations=Array.isArray(db.locations)?db.locations:[...new Set(db.items.map(a=>a.location).filter(Boolean))];db.operations=workflow.init(db.operations);db.pallets=Array.isArray(db.pallets)?db.pallets:[];return db;}
function checkInput(v,max){return String(v??'').trim().slice(0,max);}
const safe=fn=>{try{return fn();}catch(e){console.error(e);return {ok:false,error:'Unable to complete the operation. Check the application log.'};}};
const adminOnly=()=>authMode==='local'||(authMode==='cloud'&&cloudUserRole==='admin');
const secured=fn=>(evt,...args)=>safe(()=>{if(!authenticated)return {ok:false,error:'Please sign in first.'};if(authMode==='local'&&loadDB().user.mustChangePassword)return {ok:false,error:'Change your temporary admin password first.'};return fn(...args);});
const adminSecured=fn=>secured((...args)=>adminOnly()?fn(...args):{ok:false,error:'Administrator access required.'});
function hubConfig(){try{const h=JSON.parse(fs.readFileSync(hubPath(),'utf8'));return h?.url&&h?.token?h:null;}catch{return null;}}
const accountSecurity=require('./account-security').createAccountSecurity({authenticated:()=>authenticated,admin:adminOnly,mode:()=>authMode,localUser:()=>loadDB().user,hash,cloud:()=>cloudSession,config:readPrivateCloud,fetch:(...args)=>fetch(...args)});
const settingsSecured=fn=>adminSecured((...args)=>accountSecurity.isUnlocked()?fn(...args):{ok:false,error:'Unlock Settings with your administrator password first.'});

function validateHub(url,token){const u=new URL(checkInput(url,240));if(u.username||u.password||u.search||u.hash||!['http:','https:'].includes(u.protocol))throw Error('Enter a valid hub URL without credentials, query or fragments.');
 if(u.pathname!=='/')throw Error('Use only the base URL of the hub.');
 const host=u.hostname.toLowerCase();const privateHost=host==='localhost'||host==='127.0.0.1'||host==='[::1]'||host.endsWith('.local')||/^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(1[6-9]|2[0-9]|3[01])\./.test(host);
 if(u.protocol==='http:'&&!privateHost)throw Error('HTTP hubs must be on a private LAN. Use HTTPS for other hosts.');
 if(!token||String(token).trim().length<32)throw Error('Provide the 64-character token from the hub computer.');
 return {url:u.origin,token:String(token).trim()};
}
async function hubRequest(method,route,payload,override){const conf=override||hubConfig();if(!conf)return {ok:false,error:'No shared hub is connected.'};
 // Read-only requests can be retried once after a brief network interruption.
 // Never automatically replay writes: the hub may have saved them even when a reply is lost.
 for(let attempt=0;attempt<(method==='GET'?2:1);attempt++){
  try{const response=await fetch(conf.url+route,{method,headers:{Authorization:`Bearer ${conf.token}`,...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(4000)});
   const json=await response.json();if(!response.ok)return {ok:false,error:json.error||`Hub error HTTP ${response.status}`,status:response.status};return json;
  }catch(e){if(attempt===0&&method==='GET'){await new Promise(resolve=>setTimeout(resolve,350));continue;}}
 }
 return {ok:false,error:'Shared hub cannot be reached. Check network and hub service. No write was automatically retried.'};} 
async function hubAdmin(action,input){
 const h=hubConfig();if(!h)return {ok:false,error:'Connect to your trusted hub once through Admin Centre → Inventory connection. Use your main administrator account; no account switch is needed.'};
 const read=['status','users-list'].includes(action);
 if(authMode==='cloud'){try{await renewCloudSession();}catch{return {ok:false,error:'Your cloud administrator session could not be renewed. Sign out and sign in again before controlling the hub.'};}}
 try{
  const response=await fetch(h.url+'/v1/admin-centre/'+action,{method:read?'GET':'POST',headers:{Authorization:'Bearer '+h.token,...(authMode==='cloud'?{'X-APEX-Admin-Session':cloudSession.token}:{}),'Content-Type':'application/json'},body:read?undefined:JSON.stringify(input||{}),signal:AbortSignal.timeout(60000)});
  const result=await response.json().catch(()=>null);
  if(!result||typeof result!=='object')return {ok:false,error:'Trusted hub returned an unreadable response (HTTP '+response.status+'). Check that the configured address belongs to the APEX hub.'+(read?'':' A write may already have completed; check inventory before retrying.')};
  return result;
 }catch(e){
  const timedOut=['TimeoutError','AbortError'].includes(e?.name);
  return {ok:false,error:(timedOut?'Trusted hub did not respond within 60 seconds.':'Trusted hub cannot be reached at '+h.url+'.')+' Start Shared Hub on that PC and check its connection.'+(read?'':' A write may already have completed; check inventory before retrying.')};
 }
}
function localList(){const d=loadDB();return {ok:true,items:d.items.filter(a=>!a.deletedAt),locations:d.locations,pallets:palletManagement.listPallets(d),mode:'local'};}
let cloudRenewal=null;
async function renewCloudSession(){
 const original=cloudSession;
 if(!original)throw Error('Cloud login required. Sign in again.');
 if(Date.now()<original.expiresAt)return original;
 if(!original.refreshToken)throw Error('Cloud login expired. Sign in again.');
 if(!cloudRenewal){
  cloudRenewal=(async()=>{
   const response=await fetch(original.url+'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',headers:{apikey:original.anonKey,'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:original.refreshToken}),signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('Cloud session could not be renewed. Sign out and sign in again.');
   const data=await response.json();
   if(!data.access_token||!data.refresh_token)throw Error('Invalid cloud renewal response. Sign in again.');
   if(cloudSession!==original)throw Error('Cloud session changed. Sign in again.');
   original.token=data.access_token;
   original.refreshToken=data.refresh_token;
   original.expiresAt=Date.now()+Math.max(0,Number(data.expires_in||3600)-45)*1000;
   const remembered=readRememberedCloud();if(remembered)saveRememberedCloud(remembered.email);
   return original;
  })().finally(()=>{cloudRenewal=null;});
 }
 return cloudRenewal;
}
async function cloudFetch(endpoint,options={}){
 const current=await renewCloudSession();
 const headers={...options.headers,apikey:current.anonKey,Authorization:'Bearer '+current.token};
 return fetch(current.url+endpoint,{...options,headers});
}
async function cloudRead(route){
 try{
  const res=await cloudFetch('/rest/v1/'+route,{headers:{apikey:cloudSession.anonKey,Authorization:'Bearer '+cloudSession.token},signal:AbortSignal.timeout(12000)});
  if(!res.ok)return {ok:false,error:'Cloud request failed (HTTP '+res.status+').'};
  return {ok:true,rows:await res.json()};
 }catch{return {ok:false,error:'Cloud unavailable; nothing saved.'};}
}
// Read every page before publishing a new inventory snapshot. Abort on any failed page.
async function cloudReadAllAssets(){
 const all=[],pageSize=500,maxPages=200;
 for(let page=0;page<maxPages;page++){
  const start=page*pageSize;
  const query='apex_assets?select=payload,revision&order=id.asc&limit='+pageSize+'&offset='+start;
  const result=await cloudRead(query);
  if(!result.ok)return result;
  if(!Array.isArray(result.rows))return {ok:false,error:'Invalid cloud page response.'};
  all.push(...result.rows);
  if(result.rows.length<pageSize)return {ok:true,rows:all};
 }
 return {ok:false,error:'Cloud inventory exceeds safe loading limit. No partial inventory shown.'};
}
async function cloudWrite(fn,args){
 try{
  const res=await cloudFetch('/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:cloudSession.anonKey,Authorization:'Bearer '+cloudSession.token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});
  const row=await res.json().catch(()=>null);
  if(!res.ok)return {ok:false,error:res.status===409||row?.code==='23505'?'Duplicate Asset ID or conflicting edit. Refresh inventory before retrying.':('Cloud write failed (HTTP '+res.status+'). '+String(row?.message||''))};
  return {ok:true,item:core.normalize(row.payload),revision:row.revision};
 }catch{return {ok:false,error:'Cloud request was interrupted. Check inventory before retrying to avoid duplicates.'};}
}
async function cloudArchive(id,archived){
 if(!cloudSeenRevisions.has(id))return {ok:false,error:'Refresh inventory before changing this record.'};
 const revision=cloudSeenRevisions.get(id);
 const result=await cloudWrite('apex_set_asset_archived',{p_id:id,p_expected_revision:revision,p_archived:archived});
 if(result.ok)cloudSeenRevisions.set(id,Number(result.revision));
 return result;
}
async function cloudWorkflowGet(){
 if(!cloudSession)return {ok:false,error:'Sign in to cloud inventory.'};
 try{
  const r=await cloudFetch('/rest/v1/rpc/apex_get_refurb_workflow',{
   method:'POST',headers:{apikey:cloudSession.anonKey,Authorization:'Bearer '+cloudSession.token,'Content-Type':'application/json'},
   body:'{}',signal:AbortSignal.timeout(12000)});
  const value=await r.json().catch(()=>null);
  if(!r.ok||!value?.workflow)return {ok:false,error:'Cloud refurbishment unavailable. Check migration and permissions (HTTP '+r.status+').'};
  return {ok:true,workflow:workflow.init(value.workflow),revision:Number(value.revision)};
 }catch{return {ok:false,error:'Could not reach cloud refurbishment. Nothing saved.'};}
}
async function cloudWorkflowWrite(revision,document){
 try{
  const r=await cloudFetch('/rest/v1/rpc/apex_save_refurb_workflow',{
   method:'POST',headers:{apikey:cloudSession.anonKey,Authorization:'Bearer '+cloudSession.token,'Content-Type':'application/json'},
   body:JSON.stringify({p_expected_revision:revision,p_document:document}),signal:AbortSignal.timeout(12000)});
  const value=await r.json().catch(()=>null);
  if(!r.ok)return {ok:false,error:'Could not save shared refurbishment. Another user may have changed it; refresh and retry. HTTP '+r.status};
  return {ok:true,workflow:workflow.init(value.workflow)};
 }catch{return {ok:false,error:'Cloud refurbishment save interrupted. Refresh to verify before retrying.'};}
}
async function cloudMeta(){
 try{
  const r=await cloudFetch('/rest/v1/rpc/apex_inventory_meta_get',{method:'POST',headers:{apikey:cloudSession.anonKey,Authorization:'Bearer '+cloudSession.token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(12000)});
  if(!r.ok)return {ok:false,error:'Cloud locations/pallets are unavailable. Database migration may be missing.'};
  return {ok:true,data:await r.json()};
 }catch{return {ok:false,error:'Unable to reach cloud locations/pallets.'};}
}
async function cloudMetaAction(action,input){
 const meta=await cloudMeta();
 if(!meta.ok)return meta;
 return cloudMetaSave(action,input,meta.data.revision);
}
async function cloudMetaSave(action,input,revision){
 try{
  const r=await cloudFetch('/rest/v1/rpc/apex_inventory_location_pallet_action',{method:'POST',
   headers:{apikey:cloudSession.anonKey,Authorization:'Bearer '+cloudSession.token,'Content-Type':'application/json'},
   body:JSON.stringify({p_action:action,p_input:input,p_meta_revision:revision}),signal:AbortSignal.timeout(15000)});
  const value=await r.json().catch(()=>null);
  if(!r.ok)return {ok:false,error:String(value?.message||'Cloud operation failed. Refresh and try again.')};
  return {...value,ok:true};
 }catch{return {ok:false,error:'Cloud move interrupted. Refresh before trying again.'};}
}
async function cloudInventoryCall(method,route,payload){
 if(!cloudSession)return {ok:false,error:'Sign in to cloud inventory.'};
 if(method==='POST'&&(route==='/v1/items/bulk-move'||route==='/v1/items/bulk-restore')){
  const undo=route.endsWith('bulk-restore');
  const entries=undo?payload?.entries:payload?.ids;
  if(!Array.isArray(entries)||!entries.length||entries.length>300)return {ok:false,error:'Select between 1 and 300 laptops.'};
  const ids=undo?entries.map(e=>String(e.id||'').toUpperCase()):entries.map(x=>String(x||'').toUpperCase());
  if(new Set(ids).size!==ids.length)return {ok:false,error:'Duplicate Asset IDs in batch.'};
  if(ids.some(id=>!cloudSeenRevisions.has(id)))return {ok:false,error:'Refresh the shared inventory before moving these laptops.'};
  const moves=ids.map((id,i)=>{
   const e=undo?entries[i]:null;
   const expected=(payload?.expectedAssignments||[]).find(x=>String(x.id||'').toUpperCase()===id);
   return {id,revision:cloudSeenRevisions.get(id),location:undo?e.location:(payload.pallet?'Unassigned':payload.location),
     pallet:undo?e.pallet:(payload.pallet||''),...(undo?{expectedLocation:e.expectedLocation,expectedPallet:e.expectedPallet}:
     expected?{expectedLocation:expected.location,expectedPallet:expected.pallet}:{})};
  });
  const result=await cloudMetaAction(undo?'undoBulkMove':'bulkMove',{moves});
  if(result.ok){for(const id of ids)cloudSeenRevisions.delete(id);}
  return result.ok?{...result,ids,...(undo?{restored:result.moved}:{moved:result.moved})}:result;
 }
 if(method==='POST'&&route==='/v1/locations')return cloudMetaAction('addLocation',payload);
 if(method==='DELETE'&&route.startsWith('/v1/locations/'))return cloudMetaAction('deleteLocation',{name:decodeURIComponent(route.slice('/v1/locations/'.length)),moveTo:payload?.moveTo||''});
 if(method==='POST'&&route==='/v1/pallets')return cloudMetaAction('createPallet',payload);
 if(method==='POST'&&route==='/v1/pallets/delete')return cloudMetaAction('deletePallet',payload);
 if(method==='GET'&&route==='/v1/operations'){
  const response=await cloudWorkflowGet();
  return response.ok?{ok:true,workflow:response.workflow}:response;
 }
 if(method==='POST'&&route==='/v1/operations/action'){
  const current=await cloudWorkflowGet();
  if(!current.ok)return current;
  const assets=await cloudInventoryCall('GET','/v1/items',null);
  if(!assets.ok)return assets;
  const prepared=workflow.apply(structuredClone(current.workflow),assets.items,payload,cloudSession?.email||cloudUserRole||'staff');
  if(!prepared.ok)return prepared;
  const saved=await cloudWorkflowWrite(current.revision,prepared.workflow);
  return saved.ok?{...prepared,workflow:saved.workflow}:saved;
 }
 if(method==='GET'&&route==='/v1/trash'){
  const result=await cloudReadAllAssets();
  if(!result.ok)return result;
  const archived=result.rows.map(x=>core.normalize(x.payload)).filter(x=>x.deletedAt);
  for(const row of result.rows)if(row.payload?.id&&Number.isSafeInteger(Number(row.revision)))cloudSeenRevisions.set(row.payload.id,Number(row.revision));
  return {ok:true,items:archived};
 }
 if(method==='POST'&&route==='/v1/maintenance/delete'){
  if(payload?.type!=='hardDeleteAsset')return {ok:false,error:'Only confirmed permanent asset deletion is available in cloud mode.'};
  const id=String(payload.assetId||'').trim().toUpperCase();
  if(!cloudSeenRevisions.has(id))return {ok:false,error:'Refresh shared inventory before deleting this laptop.'};
  try{
   const response=await cloudFetch('/rest/v1/rpc/apex_hard_delete_asset',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({p_id:id,p_expected_revision:cloudSeenRevisions.get(id)}),signal:AbortSignal.timeout(15000)});
   const result=await response.json().catch(()=>null);
   if(!response.ok)return {ok:false,error:String(result?.message||('Cloud deletion failed (HTTP '+response.status+').'))};
   if(!result?.ok||result.deleted!==id)return {ok:false,error:'Cloud did not confirm deletion. Refresh to check the laptop.'};
   cloudSeenRevisions.delete(id);
   return {ok:true,kind:'hardDeleteAsset',deleted:id};
  }catch{return {ok:false,error:'Cloud deletion response was interrupted. Refresh inventory before trying again.'};}
 }
 if(method==='POST'&&route==='/v1/trash/restore'){
  return cloudArchive(payload?.id,false);
 }
 if(method==='DELETE'&&route.startsWith('/v1/items/')){
  return cloudArchive(decodeURIComponent(route.slice('/v1/items/'.length)),true);
 }
 if(method==='POST'&&route==='/v1/items'){
  const validation=core.add([],payload);
  if(!validation.ok)return validation;
  const saved=await cloudWrite('apex_create_full_asset',{p_payload:validation.item});
  if(saved.ok)cloudSeenRevisions.set(saved.item.id,Number(saved.revision));
  return saved;
 }
 if(method==='PATCH'&&route.startsWith('/v1/items/')){
  const id=decodeURIComponent(route.slice('/v1/items/'.length));
  const current=await cloudRead('apex_assets?select=payload,revision&id=eq.'+encodeURIComponent(id));
  if(!current.ok)return current;
  if(!Array.isArray(current.rows)||current.rows.length!==1)return {ok:false,error:'Cloud asset not found.'};
  const prior=current.rows[0];
  if(!cloudSeenRevisions.has(id)||cloudSeenRevisions.get(id)!==Number(prior.revision))return {ok:false,error:'This laptop changed since it was loaded. Refresh inventory and review before saving.'};
  const edited=core.update([core.normalize(prior.payload)],id,payload);
  if(!edited.ok)return edited;
  const saved=await cloudWrite('apex_replace_full_asset',{p_id:id,p_expected_revision:prior.revision,p_payload:edited.item});
  if(saved.ok)cloudSeenRevisions.set(id,Number(saved.revision));
  return saved;
 }
 if(method!=='GET'||!route.startsWith('/v1/items'))return {ok:false,error:'This operation is not available in cloud mode yet. No local data was changed.'};
 try{
  const result=await cloudReadAllAssets();
  if(!result.ok)return result;
  const rows=result.rows;
  if(rows.some(row=>!row?.payload?.id||!Number.isSafeInteger(Number(row.revision))))
   return {ok:false,error:'Cloud returned an invalid asset. Inventory was not refreshed.'};
  const items=rows.map(r=>core.normalize(r.payload));
  const meta=await cloudMeta();
  if(!meta.ok)return meta;
  const nextRevisions=new Map(rows.map(row=>[row.payload.id,Number(row.revision)]));
  cloudSeenRevisions.clear();
  for(const [id,revision] of nextRevisions)cloudSeenRevisions.set(id,revision);
  const locations=[...new Set([...(meta.data.locations||[]),...items.map(x=>x.location).filter(Boolean)])];
  const pallets=palletManagement.listPallets({items,locations,pallets:meta.data.pallets||[]});
  return {ok:true,items:items.filter(x=>!x.deletedAt),locations,pallets,mode:'cloud'};
 }catch{return {ok:false,error:'Cloud inventory cannot be reached. No local data shown.'};}
}
function arrivalWorkspace(){return authMode==='cloud'?'cloud:'+cloudSession?.url+':'+cloudSession?.userId:'hub:'+(hubConfig()?.url||'local');}
function observeArrivals(result){if(!authenticated)return result;const added=arrivalTracker.observe(result,arrivalWorkspace());if(added.length)intakeNotification?.show(added).catch(error=>console.warn('Inventory notification:',error.message));return result;}
async function inventoryCall(method,route,payload,local){if(authMode==='cloud')return cloudInventoryCall(method,route,payload);const h=hubConfig();if(h)return hubRequest(method,route,payload,h);return local();}
function ipv4Addresses(){
 const arr=[];
 for(const list of Object.values(os.networkInterfaces()))for(const item of list||[]){
  if(item.family==='IPv4'&&!item.internal&&(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address)))arr.push(item.address);
 }
 return [...new Set(arr)];
}
async function localHubRequest(url){try{const r=await fetch(url+'/health',{signal:AbortSignal.timeout(1200)});return r.ok;}catch{return false;}}
async function startOwnedHub(){
 const url='http://127.0.0.1:4217';
 if(ownedHub&&await localHubRequest(url))return {ok:true,url:hubConfig()?.url||url,ips:ipv4Addresses()};
 if(await localHubRequest(url))return {ok:false,error:'Port 4217 already has a running hub. Close the old hub or connect to it using the existing token.'};
 const dir=path.join(userDir(),'shared-hub');
 const script=path.join(__dirname,'..','hub','server.js');
 fs.mkdirSync(dir,{recursive:true});
 const env={...process.env,APEX_HUB_HOST:'0.0.0.0',APEX_HUB_PORT:'4217',APEX_HUB_DATA_DIR:dir,APEX_HUB_CLOUD_CONFIG:privateCloudConfig(),APEX_HUB_CLOUD_STATE:privateCloudState()};
 if(process.versions.electron)env.ELECTRON_RUN_AS_NODE='1';
 const child=spawn(process.execPath,[script],{env,windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
 ownedHub=child;
 let stderr='';child.stderr.on('data',d=>{stderr+=String(d).slice(0,500);});child.on('error',e=>{stderr=e.message;});
 for(let i=0;i<32;i++){
  if(await localHubRequest(url)){
   const token=fs.readFileSync(path.join(dir,'hub-token.txt'),'utf8').trim();
   const address={url,token};
   const r=await hubRequest('GET','/v1/items',null,address);
   if(!r.ok)return r;
   atomic(hubPath(),address);
   return {ok:true,url,ips:ipv4Addresses()};
  }
  if(child.exitCode!==null||child.killed)break;
  await new Promise(resolve=>setTimeout(resolve,130));
 }
 return {ok:false,error:'Could not start shared hub. '+(stderr.trim().slice(0,180)||'Check Windows Firewall and whether port 4217 is in use.')};
}

// Upgrade 14: Cloud settings stay exclusively in Electron main/userData, never the renderer.
const privateCloudConfig=()=>path.join(userDir(),'cloud-bridge.local.json');
const privateCloudState=()=>path.join(userDir(),'cloud-sync-state.local.json');
function readPrivateCloud(){try{return JSON.parse(fs.readFileSync(privateCloudConfig(),'utf8'));}catch{return null;}}
function validCloudUrl(value){return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(String(value||''));}
function cloudStatus(){const c=readPrivateCloud();return {ok:true,configured:!!c?.supabaseUrl&&!!c?.serviceRoleKey,projectUrl:c?.supabaseUrl||'',running:!!cloudProcess&&cloudProcess.exitCode===null,startedAt:cloudRunningSince,lastMessage:cloudLastMessage,localHub:hubConfig()?.url||null};}
function cloudSave(input){
 const url=String(input?.supabaseUrl||'').trim().replace(/\/$/,'');
 if(!validCloudUrl(url))return {ok:false,error:'Enter the Supabase Project URL ending in .supabase.co.'};
 const previous=readPrivateCloud()||{};
 const secret=String(input?.secret||'').trim()||previous.serviceRoleKey;
 if(!secret||secret.length<24)return {ok:false,error:'Enter the server-only Supabase secret / service_role key on this trusted hub computer.'};
 if(cloudProcess&&cloudProcess.exitCode===null)return {ok:false,error:'Stop cloud sync before changing its configuration.'};
 // The hub token is resolved from the existing authenticated local hub connection at launch.
 atomic(privateCloudConfig(),{supabaseUrl:url,serviceRoleKey:secret,hubUrl:'http://127.0.0.1:4217',hubToken:'SET_WHEN_STARTED',intervalSeconds:15});
 return cloudStatus();
}
async function cloudCheck(){
 const c=readPrivateCloud();if(!c)return {ok:false,error:'Save your cloud configuration first.'};
 const h=hubConfig();if(!h)return {ok:false,error:'No inventory hub connected. Use Settings → Configure hub or start the local hub first.'};
 if(!/^http:\/\/(127\.0\.0\.1|localhost):4217$/.test(h.url))return {ok:false,error:'For safety, run this sync on the actual hub computer, connected to http://127.0.0.1:4217.'};
 const r=await hubRequest('GET','/v1/items',null,h);
 if(!r.ok)return {ok:false,error:'Hub check failed: '+r.error};
 try{const response=await fetch(c.supabaseUrl+'/rest/v1/apex_assets?select=id&limit=1',{headers:{apikey:c.serviceRoleKey,Authorization:'Bearer '+c.serviceRoleKey},signal:AbortSignal.timeout(9000)});
 if(!response.ok)return {ok:false,error:'Supabase check failed (HTTP '+response.status+'). Check your project URL and server-side secret key.'};
 const cloudItems=await response.json();return {ok:true,localAssets:r.items?.length||0,cloudReachable:true,cloudSample:cloudItems?.length||0,warning:(r.items?.length||0)===0?'The connected hub contains no assets. If your laptops are currently stored only in the local Studio, migrate them to the hub before syncing.':''};
 }catch(e){return {ok:false,error:'Supabase unreachable: '+e.message};}
}
async function cloudStart(input){
 if(cloudProcess&&cloudProcess.exitCode===null)return cloudStatus();
 const checked=await cloudCheck();if(!checked.ok)return checked;
 if(!input?.confirmed)return {ok:false,error:'Review the first-sync safety notice and confirm before starting.'};
 const c=readPrivateCloud(),h=hubConfig();
 if(checked.localAssets===0)return {ok:false,error:'The Shared Hub has no assets. Import or transfer your existing Studio inventory to the hub before enabling cloud sync.'};
 const runtimeFile=path.join(userDir(),'cloud-bridge.runtime.json');
 atomic(runtimeFile,{...c,hubUrl:h.url,hubToken:h.token});
 const script=path.join(__dirname,'..','cloud','sync-bridge.js');
 const env={...process.env,APEX_CLOUD_BRIDGE_CONFIG:runtimeFile,APEX_CLOUD_STATE_FILE:privateCloudState()};
 if(process.versions.electron)env.ELECTRON_RUN_AS_NODE='1';
 const child=spawn(process.execPath,[script],{cwd:userDir(),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 cloudProcess=child;cloudRunningSince=new Date().toISOString();cloudLastMessage='Starting synchronisation…';
 const capture=d=>{cloudLastMessage=String(d).trim().slice(-500).replace(/sb_secret_[^\s]+/gi,'[redacted]');};
 child.stdout.on('data',capture);child.stderr.on('data',capture);
 child.on('error',e=>{cloudLastMessage='Sync failed to start: '+e.message;});
 child.on('exit',code=>{cloudLastMessage='Sync process stopped ('+code+'). '+cloudLastMessage;cloudProcess=null;try{fs.unlinkSync(runtimeFile);}catch{}});
 return {...cloudStatus(),assetCount:checked.localAssets};
}
function cloudStop(){if(cloudProcess&&cloudProcess.exitCode===null){cloudProcess.kill();cloudLastMessage='Cloud sync stopped by administrator.';}return {ok:true};}

// Upgrade 15: online Supabase staff authentication. Passwords and access tokens
// stay in Electron main memory; only non-secret URL/publishable key are persisted.
const rememberedCloudFile=()=>path.join(userDir(),'cloud-remembered-session.json');
function forgetRememberedCloud(){try{fs.unlinkSync(rememberedCloudFile());}catch{}}
function saveRememberedCloud(email){
 if(!cloudSession?.refreshToken||!safeStorage.isEncryptionAvailable())return false;
 const value={url:cloudSession.url,anonKey:cloudSession.anonKey,email:String(email||''),refreshToken:cloudSession.refreshToken};
 const encrypted=safeStorage.encryptString(JSON.stringify(value)).toString('base64');
 atomic(rememberedCloudFile(),{encrypted});return true;
}
function readRememberedCloud(){
 try{
  if(!safeStorage.isEncryptionAvailable())return null;
  const payload=JSON.parse(fs.readFileSync(rememberedCloudFile(),'utf8'));
  return JSON.parse(safeStorage.decryptString(Buffer.from(payload.encrypted,'base64')));
 }catch{return null;}
}
async function resumeRememberedCloud(){
 if(authenticated)return {ok:false,error:'Already signed in.'};
 const saved=readRememberedCloud();if(!saved)return {ok:false,remembered:false};
 const {url,anonKey,email,refreshToken}=saved;
 if(!validCloudUrl(url)||!validPublishableKey(anonKey)||typeof refreshToken!=='string')return {ok:false,error:'Saved login invalid.'};
 try{
  const response=await fetch(url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refreshToken}),signal:AbortSignal.timeout(12000)});
  if(!response.ok){if([400,401,403].includes(response.status))forgetRememberedCloud();return {ok:false,error:'Saved session expired. Please sign in again.'};}
  const auth=await response.json();if(!auth.access_token||!auth.refresh_token||!auth.user?.id)throw Error('Invalid renewal');
  const staffResponse=await fetch(url+'/rest/v1/apex_staff?select=user_id,role,active&user_id=eq.'+encodeURIComponent(auth.user.id),{headers:{apikey:anonKey,Authorization:'Bearer '+auth.access_token},signal:AbortSignal.timeout(12000)});
  if(!staffResponse.ok)throw Error('Staff check unavailable');
  const staff=await staffResponse.json();
  if(!Array.isArray(staff)||staff.length!==1||staff[0].active!==true){forgetRememberedCloud();return {ok:false,error:'Cloud account is no longer authorised.'};}
  cloudSession={email:auth.user.email||email,userId:auth.user.id,url,anonKey,token:auth.access_token,refreshToken:auth.refresh_token,expiresAt:Date.now()+Math.max(0,Number(auth.expires_in||3600)-45)*1000};
  authenticated=true;authMode='cloud';cloudUserRole=staff[0].role;loginFailures=0;cloudSeenRevisions.clear();
  saveRememberedCloud(email);return {ok:true,username:email,authMode:'cloud',role:staff[0].role};
 }catch{return {ok:false,error:'Cloud temporarily unavailable. Sign in manually or try again later.'};}
}
const cloudLoginPublicFile=()=>path.join(userDir(),'cloud-login-public.json');
// Packaged public values make staff installation zero-configuration. Per-PC administrator
// settings, when present, take precedence; secrets are NEVER packaged here.
const bundledPublicFile=()=>path.join(__dirname,'cloud-login-distribution.json');
function readPublicFile(file){try{const value=JSON.parse(fs.readFileSync(file,'utf8'));return value&&typeof value==='object'?value:{};}catch{return {};}}
function publicCloudLogin(){
 const local=readPublicFile(cloudLoginPublicFile());
 const bundled=readPublicFile(bundledPublicFile());
 return {url:local.url||bundled.url||'',anonKey:local.anonKey||bundled.anonKey||''};
}
function validPublishableKey(s){return /^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(s)||/^eyJ[A-Za-z0-9._-]{40,}$/.test(s);}
async function cloudStaffLogin(input){
 if(Date.now()<nextAttempt)return {ok:false,error:'Too many login attempts. Try again shortly.'};
 const prior=publicCloudLogin();
 const url=String(input?.url||prior.url||'').trim().replace(/\/$/,'');
 const anonKey=String(input?.anonKey||prior.anonKey||'').trim();
 const email=String(input?.email||'').trim();
 const password=String(input?.password||'');
 if(!validCloudUrl(url)||!validPublishableKey(anonKey))return {ok:false,error:'Cloud login is not configured on this computer. Ask an administrator to configure it in Settings.'};
 if(!/^\S+@\S+\.\S+$/.test(email)||!password)return {ok:false,error:'Enter your Supabase email and password.'};
 try{
  const authResponse=await fetch(url+'/auth/v1/token?grant_type=password',{
   method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},
   body:JSON.stringify({email,password}),signal:AbortSignal.timeout(12000)});
  if(!authResponse.ok){if(authResponse.status===400||authResponse.status===401){if(++loginFailures>=5){loginFailures=0;nextAttempt=Date.now()+30000;}return {ok:false,error:'Email/password incorrect or the account is not confirmed.'};}return {ok:false,error:'Cloud sign-in failed (HTTP '+authResponse.status+').'};}
  const auth=await authResponse.json();
  if(!auth.access_token||!auth.user?.id)return {ok:false,error:'Cloud did not return a valid session.'};
  // Authorisation is enforced by Supabase RLS; never trust a user-supplied role.
  const staffResp=await fetch(url+'/rest/v1/apex_staff?select=user_id,role,active&user_id=eq.'+encodeURIComponent(auth.user.id),{
   headers:{apikey:anonKey,Authorization:'Bearer '+auth.access_token},signal:AbortSignal.timeout(12000)});
  if(!staffResp.ok)return {ok:false,error:'Unable to verify staff permissions (HTTP '+staffResp.status+').'};
  const staff=await staffResp.json();
  if(!Array.isArray(staff)||staff.length!==1||staff[0].active!==true)return {ok:false,error:'Your cloud account is not authorised in apex_staff.'};
  // Remembering the session is opt-in and uses OS-backed encryption, never the password.
  atomic(cloudLoginPublicFile(),{url,anonKey});
  cloudSeenRevisions.clear();cloudSession={email:auth.user.email||email,userId:auth.user.id,url,anonKey,token:auth.access_token,refreshToken:auth.refresh_token||null,expiresAt:Date.now()+Math.max(0,Number(auth.expires_in||3600)-45)*1000};authenticated=true;authMode='cloud';cloudUserRole=staff[0].role;loginFailures=0;
  if(input?.rememberMe===true){if(!saveRememberedCloud(email))return {ok:true,username:email,mustChangePassword:false,authMode:'cloud',role:staff[0].role,warning:'Secure session storage unavailable. Sign-in will not be remembered.'};}
  else forgetRememberedCloud();
  return {ok:true,username:email,mustChangePassword:false,authMode:'cloud',role:staff[0].role};
 }catch(e){return {ok:false,error:'Unable to reach Supabase. Check your internet connection and project URL.'};}
}
// Update operations require sign-in; installation is an explicit user decision.
ipcMain.handle('inventory:updateStatus',()=>safe(()=>authenticated?updateCentre.status():{ok:false,error:'Sign in first.'}));
ipcMain.handle('inventory:updateCheck',()=>safe(()=>authenticated?updateCentre.check(true):{ok:false,error:'Sign in first.'}));
ipcMain.handle('inventory:updateDownload',()=>safe(()=>authenticated?updateCentre.download():{ok:false,error:'Sign in first.'}));
ipcMain.handle('inventory:updateInstall',()=>safe(()=>authenticated?updateCentre.install():{ok:false,error:'Sign in first.'}));
app.whenReady().then(()=>{
 loadDB();
 session.defaultSession.setPermissionRequestHandler((wc,permission,cb,details)=>{
  const camera=permission==='media'&&(!details?.mediaTypes||(details.mediaTypes.includes('video')&&!details.mediaTypes.includes('audio')));
  cb(Boolean(camera&&wc===win?.webContents));
 });
 ipcMain.handle('inventory:settingsUnlock',secured(password=>accountSecurity.unlock(password)));
 ipcMain.handle('inventory:settingsLock',()=>accountSecurity.lock());
 ipcMain.handle('inventory:settingsAccess',secured(()=>({ok:true,admin:adminOnly(),unlocked:accountSecurity.isUnlocked()})));
 ipcMain.handle('inventory:usersList',settingsSecured(()=>hubAdmin('users-list')));
 ipcMain.handle('inventory:usersCreate',settingsSecured(input=>hubAdmin('users-create',input)));
 ipcMain.handle('inventory:usersUpdate',settingsSecured(input=>hubAdmin('users-update',input)));
 ipcMain.handle('inventory:login',(evt,credentials)=>safe(()=>{
  if(Date.now()<nextAttempt)return {ok:false,error:'Too many login attempts. Try again shortly.'};
  const db=loadDB();const username=checkInput(credentials?.username,100).toLowerCase();const candidate=Buffer.from(hash(String(credentials?.password||''),db.user.salt),'hex');const actual=Buffer.from(db.user.passwordHash,'hex');
  if(username!==db.user.username||candidate.length!==actual.length||!crypto.timingSafeEqual(candidate,actual)){
   if(++loginFailures>=5){loginFailures=0;nextAttempt=Date.now()+30000;}
   return {ok:false,error:'Incorrect username or password.'};
  }
  authenticated=true;authMode='local';cloudUserRole=null;loginFailures=0;return {ok:true,username,mustChangePassword:db.user.mustChangePassword,authMode:'local'};
 }));
 ipcMain.handle('inventory:cloudLoginInfo',()=>safe(()=>({ok:true,configured:validCloudUrl(publicCloudLogin().url||'')&&validPublishableKey(publicCloudLogin().anonKey||'')})));
 ipcMain.handle('inventory:cloudLoginConfigure',(evt,input)=>safe(()=>{
  if(!authenticated||!adminOnly()||!accountSecurity.isUnlocked())return {ok:false,error:'Unlock Admin Centre with your administrator password first.'};
  const url=String(input?.url||'').trim().replace(/\/$/,'');
  const anonKey=String(input?.anonKey||'').trim();
  if(!validCloudUrl(url)||!validPublishableKey(anonKey))return {ok:false,error:'Enter a valid Supabase URL and publishable key.'};
  if(authMode==='cloud'&&url!==cloudSession.url)return {ok:false,error:'Your administrator account can configure this cloud project only.'};
  atomic(cloudLoginPublicFile(),{url,anonKey});
  return {ok:true,configured:true};
 }));
 ipcMain.handle('inventory:cloudStaffLogin',(evt,input)=>safe(()=>cloudStaffLogin(input)));
 ipcMain.handle('inventory:cloudResume',()=>safe(()=>resumeRememberedCloud()));
 ipcMain.handle('inventory:cloudRememberedInfo',()=>safe(()=>{const saved=readRememberedCloud();return {ok:true,remembered:!!saved,email:saved?.email||''};}));
 ipcMain.handle('inventory:logout',()=>{arrivalTracker.reset();intakeNotification?.close();accountSecurity.lock();forgetRememberedCloud();cloudSession=null;cloudSeenRevisions.clear();authenticated=false;authMode=null;cloudUserRole=null;return {ok:true};});
 ipcMain.handle('inventory:password',(evt,oldPass,newPass)=>safe(()=>{
  if(!authenticated||authMode!=='local')return {ok:false,error:'Local password changes require local admin sign-in.'};const db=loadDB();if(hash(String(oldPass),db.user.salt)!==db.user.passwordHash)return {ok:false,error:'Current password is incorrect.'};
  if(typeof newPass!=='string'||newPass.length<8||newPass.length>128)return {ok:false,error:'Choose a password of 8–128 characters.'};
  db.user.salt=crypto.randomBytes(24).toString('hex');db.user.passwordHash=hash(newPass,db.user.salt);db.user.mustChangePassword=false;atomic(dbPath(),db);return {ok:true};
 }));
 ipcMain.handle('inventory:workflow',secured(()=>inventoryCall('GET','/v1/operations',null,()=>({ok:true,workflow:loadDB().operations}))));
 ipcMain.handle('inventory:workflowAction',secured(command=>inventoryCall('POST','/v1/operations/action',command,()=>{
  const db=loadDB();const cloned=structuredClone(db.operations);const r=workflow.apply(cloned,db.items,command);
  if(r.ok){db.operations=r.workflow;atomic(dbPath(),db);}return r;
 })));
 ipcMain.handle('inventory:list',secured(async knownVersion=>{
  // A version hint is a read-only optimisation, not a way to skip authentication.
  const valid=Number.isSafeInteger(knownVersion)&&knownVersion>=0;
  const route=valid?'/v1/items?knownVersion='+knownVersion:'/v1/items';
  const workspace=arrivalWorkspace();const result=await inventoryCall('GET',route,null,()=>localList());return workspace===arrivalWorkspace()?observeArrivals(result):result;
 }));
 ipcMain.handle('inventory:addLocation',secured(input=>inventoryCall('POST','/v1/locations',{name:input},()=>{const db=loadDB();const name=String(input||'').trim().replace(/\s+/g,' ').slice(0,90);if(!name||/[<>\r\n]/.test(name))return {ok:false,error:'Enter a valid location name.'};if(db.locations.some(n=>n.toLowerCase()===name.toLowerCase()))return {ok:false,error:'Location already exists.'};db.locations.push(name);atomic(dbPath(),db);return {ok:true,locations:db.locations};})));
 ipcMain.handle('inventory:deleteLocation',secured(input=>inventoryCall('DELETE','/v1/locations/'+encodeURIComponent(String(input?.name||'')),{moveTo:input?.moveTo||''},()=>{const db=loadDB();const result=locationManagement.deleteLocation(db,input);if(result.ok)atomic(dbPath(),db);return result;})));
 ipcMain.handle('inventory:createPallet',secured(input=>inventoryCall('POST','/v1/pallets',input,()=>{const db=loadDB();const result=palletManagement.createPallet(db,input);if(result.ok)atomic(dbPath(),db);return result;})));
 ipcMain.handle('inventory:deletePallet',secured(input=>inventoryCall('POST','/v1/pallets/delete',input,()=>{const db=loadDB();const result=palletManagement.deletePallet(db,input);if(result.ok)atomic(dbPath(),db);return result;})));
 ipcMain.handle('inventory:bulkMove',secured(input=>inventoryCall('POST','/v1/items/bulk-move',input,()=>{const db=loadDB();const result=palletManagement.moveBatch(db,input);if(result.ok)atomic(dbPath(),db);return result;})));
 ipcMain.handle('inventory:undoBulkMove',secured(input=>inventoryCall('POST','/v1/items/bulk-restore',input,()=>{const db=loadDB();const result=palletManagement.restoreBatch(db,input);if(result.ok)atomic(dbPath(),db);return result;}))); 
 ipcMain.handle('inventory:add',secured(async data=>{const result=await inventoryCall('POST','/v1/items',data,()=>{const db=loadDB();const r=core.add(db.items,data);if(r.ok)atomic(dbPath(),db);return r;});if(result.ok)arrivalTracker.remember(result.item?.id||data?.id);return result;}));
 ipcMain.handle('inventory:update',secured((id,patch)=>inventoryCall('PATCH','/v1/items/'+encodeURIComponent(id),patch,()=>{const db=loadDB();const r=core.update(db.items,id,patch);if(r.ok)atomic(dbPath(),db);return r;})));
 ipcMain.handle('inventory:trash',secured(()=>inventoryCall('GET','/v1/trash',null,()=>({ok:true,items:loadDB().items.filter(a=>a.deletedAt)}))));
 ipcMain.handle('inventory:restore',secured(id=>inventoryCall('POST','/v1/trash/restore',{id},()=>{const db=loadDB(),r=maintenance.mutate(db,{type:'restoreAsset',assetId:id});if(r.ok)atomic(dbPath(),db);return r;})));
 ipcMain.handle('inventory:manageDelete',adminSecured(command=>inventoryCall('POST','/v1/maintenance/delete',command,()=>{const db=loadDB(),r=maintenance.mutate(db,command);if(r.ok)atomic(dbPath(),db);return r;})));
 ipcMain.handle('inventory:remove',secured(id=>inventoryCall('DELETE','/v1/items/'+encodeURIComponent(id),null,()=>{const db=loadDB(),r=maintenance.mutate(db,{type:'deleteAsset',assetId:id});if(r.ok)atomic(dbPath(),db);return r;})));
 ipcMain.handle('inventory:printAssetBatch',secured(async input=>{
  if(!Array.isArray(input?.ids)||!input.ids.length||input.ids.length>300||!['print','pdf'].includes(input.mode))return {ok:false,error:'Select between 1 and 300 devices for labels.'};
  const data=await inventoryCall('GET','/v1/items',null,()=>localList());if(!data.ok)return data;
  const byId=new Map(data.items.filter(a=>!a.deletedAt).map(a=>[a.id,a])),ids=[...new Set(input.ids)],records=ids.map(id=>byId.get(id));
  if(records.some(a=>!a))return {ok:false,error:'A selected device no longer exists. Refresh inventory and select it again.'};
  return require('./label-output').outputLabel({records,type:input.type,size:'2x1',dpi:Number(input.dpi)||203},win,input.mode);
 }));
 ipcMain.handle('inventory:printAssignment',secured(async input=>{const data=await inventoryCall('GET','/v1/items',null,()=>localList());if(!data.ok)return data;return require('./assignment-output').output(input,win,data);}));
 ipcMain.handle('inventory:saveLabelPdf',secured(input=>require('./label-output').outputLabel(input,win,'pdf')));
 ipcMain.handle('inventory:printAssetLabel',secured(input=>require('./label-output').outputLabel(input,win,'print')));
 ipcMain.handle('inventory:exportXlsx',secured(async (rows,kind)=>{
  if(!Array.isArray(rows)||rows.length>30001)return {ok:false,error:'Too many spreadsheet rows.'};
  const title=kind==='refurb-parts'?'Refurb Parts Required':kind==='inventory'?'Inventory':kind==='orders'?'Purchase Orders':'Parts Needed';
  const result=await dialog.showSaveDialog(win,{title:'Export '+title+' to Excel',defaultPath:'APEX-'+title.replaceAll(' ','-')+'-'+new Date().toISOString().slice(0,10)+'.xlsx',filters:[{name:'Excel workbook',extensions:['xlsx']}]});
  if(result.canceled||!result.filePath)return {ok:false,cancelled:true};
  try{await fs.promises.writeFile(result.filePath,kind==='refurb-parts'?require('./refurb-template-xlsx').workbook(rows):xlsx.workbook(rows,title));return {ok:true};}
  catch(e){return {ok:false,error:'Could not create Excel file: '+e.message};}
 }));
 ipcMain.handle('inventory:exportCsv',secured(async csv=>{
  if(typeof csv!=='string'||csv.length>15_000_000)return {ok:false,error:'Export exceeds allowed file size.'};
  const result=await dialog.showSaveDialog(win,{title:'Export APEX inventory',defaultPath:'APEX-Inventory-'+new Date().toISOString().slice(0,10)+'.csv',filters:[{name:'CSV files',extensions:['csv']}]});
  if(result.canceled||!result.filePath)return {ok:false,cancelled:true};
  try{await fs.promises.writeFile(result.filePath,csv,'utf8');return {ok:true};}catch(e){return {ok:false,error:'Could not write export. Check folder permissions.'};}
 }));

 function localBackupFiles(){return [
   {name:'inventory-db.json',path:dbPath()},
   {name:'hub-connection.json',path:hubPath(),required:false}
 ];}
 function localBackup(){return backupManager.snapshot({root:userDir(),files:localBackupFiles()});}
 // Local backups are separate from backups run on the shared hub PC.
 ipcMain.handle('inventory:backupStatus',secured(async()=>{
  const h=hubConfig();if(h)return hubRequest('GET','/v1/backups/status');
  return {ok:true,...backupManager.details(userDir()),storage:'local'};
 }));
 ipcMain.handle('inventory:backupNow',secured(async()=>{
  const h=hubConfig();if(h)return hubRequest('POST','/v1/backups/create',{});
  return {ok:true,backup:localBackup()};
 }));
 ipcMain.handle('inventory:backupFolder',secured(async()=>{
  if(hubConfig())return {ok:false,error:'Backups are stored on the hub PC. Use the folder shown under Backup status on that computer.'};
  const folder=path.join(userDir(),'backups');fs.mkdirSync(folder,{recursive:true,mode:0o700});
  const message=await shell.openPath(folder);return message?{ok:false,error:message}:{ok:true};
 }));
 ipcMain.handle('inventory:syncConflicts',secured(async()=>{
  if(!hubConfig())return {ok:true,mode:'local',conflicts:[]};
  return {...await hubRequest('GET','/v1/intake/conflicts'),mode:'shared'};
 }));
 ipcMain.handle('inventory:resolveSyncConflict',secured(async payload=>{
  if(!hubConfig())return {ok:false,error:'Connect the shared hub to resolve imports.'};
  return hubRequest('POST','/v1/intake/conflicts/resolve',{id:payload?.id,decision:payload?.decision});
 }));
 ipcMain.handle('inventory:intakeReceipts',secured(async()=>{
  if(!hubConfig())return {ok:true,mode:'local',events:[],message:'Connect to the shared hub to see accepted and rejected device submissions.'};
  const result=await hubRequest('GET','/v1/intake/receipts');
  if(!result.ok)return result;
  if(authMode==='cloud'){
   const ids=[...new Set((result.events||[]).map(e=>e.assetId).filter(Boolean))];
   const present=new Set();let verified=true;
   for(let offset=0;offset<ids.length;offset+=40){
    const group=ids.slice(offset,offset+40);const found=await cloudRead('apex_assets?select=id,payload&id=in.'+encodeURIComponent('('+group.map(id=>JSON.stringify(String(id))).join(',')+')'));
    if(!found.ok){verified=false;break;}for(const row of found.rows)if(!row.payload?.deletedAt)present.add(row.id);
   }
   return {...result,mode:'shared',inventoryMode:'cloud',events:(result.events||[]).map(e=>({...e,cloudVerified:verified?present.has(e.assetId):null}))};
  }
  return {...result,mode:'shared',inventoryMode:'shared'};
 }));
 ipcMain.handle('inventory:deviceHealth',secured(async()=>{
  const h=hubConfig();
  if(!h)return {ok:true,mode:'local',devices:[],message:'Connect the shared hub to view approved Diagnostics and RefurbFlow devices.'};
  const r=await hubRequest('GET','/v1/connect/devices');
  return {...r,mode:'shared'};
 }));
 ipcMain.handle('inventory:cloudStatus',adminSecured(()=>hubAdmin('status')));
 ipcMain.handle('inventory:cloudSave',settingsSecured(input=>hubAdmin('save',input)));
 ipcMain.handle('inventory:cloudCheck',settingsSecured(()=>hubAdmin('check')));
 ipcMain.handle('inventory:cloudStart',settingsSecured(input=>hubAdmin('start',input)));
 ipcMain.handle('inventory:cloudStop',settingsSecured(()=>hubAdmin('stop')));
 ipcMain.handle('inventory:hubStatus',secured(()=>{if(authMode==='cloud')return {ok:true,mode:'cloud',adminHubUrl:hubConfig()?.url||null};const h=hubConfig();return {ok:true,mode:h?'shared':'local',url:h?.url||null};}));
 ipcMain.handle('inventory:hubConnect',settingsSecured(async data=>{
  try{const connection=validateHub(data?.url,data?.token);const r=await hubRequest('GET','/v1/items',null,connection);if(!r.ok)return r;atomic(hubPath(),connection);return {ok:true,mode:'shared',url:connection.url};}
  catch(e){return {ok:false,error:e.message||'Invalid hub connection.'};}
 }));
 ipcMain.handle('inventory:hubStart',settingsSecured(async()=>startOwnedHub()));
 ipcMain.handle('inventory:hubDevices',secured(async()=>hubRequest('GET','/v1/connect/devices')));
 ipcMain.handle('inventory:hubAutoApprove',settingsSecured(async value=>hubRequest('POST','/v1/connect/config',{autoApprove:value===true})));
 ipcMain.handle('inventory:hubApprove',settingsSecured(async id=>hubRequest('POST','/v1/connect/approve',{id})));
 ipcMain.handle('inventory:hubRevoke',settingsSecured(async id=>hubRequest('POST','/v1/connect/revoke',{id})));
 ipcMain.handle('inventory:hubUnrevoke',settingsSecured(async id=>hubRequest('POST','/v1/connect/unrevoke',{id})));
 ipcMain.handle('inventory:hubPair',settingsSecured(async()=>{
  const config=hubConfig();if(!config)return {ok:false,error:'Start or connect a shared hub first.'};
  const result=await hubRequest('POST','/v1/pair/create',{},config);
  if(!result.ok)return result;
  return {ok:true,code:result.code,expiresAt:result.expiresAt,host:config.url,ips:ipv4Addresses()};
 }));
 ipcMain.handle('inventory:hubDisconnect',settingsSecured(()=>{if(fs.existsSync(hubPath()))fs.unlinkSync(hubPath());return {ok:true,mode:'local'};}));
 // A daily protected local snapshot covers local-only use; the separate shared hub
 // maintains its own snapshots, even when this Studio window is closed.
 const localAutoBackup=()=>{try{if(backupManager.due(userDir()))backupManager.snapshot({root:userDir(),files:localBackupFiles(),reason:'automatic'});}catch(e){console.error('Local backup:',e.message);}};
 localAutoBackup();const localBackupTimer=setInterval(localAutoBackup,6*60*60*1000);localBackupTimer.unref();
 win=new BrowserWindow({width:1536,height:960,minWidth:980,minHeight:640,backgroundColor:'#0c0e17',show:false,title:'APEX Smart Inventory Studio',icon:path.join(__dirname,'assets',process.platform==='win32'?'apex-app.ico':'apex-app.png'),webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 win.once('ready-to-show',()=>win.show());win.loadFile(path.join(__dirname,'renderer','index.html'));
 intakeNotification=require('./desktop-intake-notification').createDesktopIntakeNotification(()=>win,ids=>{win.webContents.send('apex:inventory-arrived',{ids,open:true});});
 const arrivalTimer=setInterval(async()=>{
  if(arrivalPollBusy||!authenticated||!win||win.isDestroyed()||(authMode==='local'&&loadDB().user.mustChangePassword))return;
  arrivalPollBusy=true;const workspace=arrivalWorkspace();
  try{const result=await inventoryCall('GET','/v1/items',null,()=>localList());if(authenticated&&workspace===arrivalWorkspace())observeArrivals(result);}
  catch(error){/* Failed reads never create notifications or replace the baseline. */}
  finally{arrivalPollBusy=false;}
 },15000);arrivalTimer.unref();
 win.on('closed',()=>{clearInterval(arrivalTimer);intakeNotification?.close();});
 updateCentre.init(win); // Silent on startup, no automatic installation.

 // Re-launch the hub automatically only when this installation previously owned one.
 // Never silently replace an external shared hub or migrate a local database.
 if(hubConfig()?.url==='http://127.0.0.1:4217'&&fs.existsSync(path.join(userDir(),'shared-hub','hub-token.txt'))){
   startOwnedHub().catch(err=>console.warn('Hub autostart:',err.message));
 }
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',e=>e.preventDefault());
});
let closingHub=false;
app.on('before-quit',event=>{
 cloudStop();if(closingHub||!ownedHub||ownedHub.exitCode!==null)return;
 event.preventDefault();closingHub=true;const child=ownedHub;
 let finished=false;const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);app.quit();};
 const timer=setTimeout(()=>{if(!child.killed)child.kill();finish();},2000);
 child.once('exit',finish);
 try{if(child.connected)child.send({type:'apex-shutdown'});else child.kill();}catch{child.kill();}
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)app.quit();});

