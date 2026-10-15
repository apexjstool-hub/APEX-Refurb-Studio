'use strict';
/** Single-writer shared inventory hub. Run only over trusted private networks/VPN. */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const os=require('node:os');
const dgram=require('node:dgram');
const core=require('../src/inventory-core');
const workflow=require('../src/refurb-workflow');
const assetActivity=require('../src/asset-activity');
const {importDiagnostic}=require('../src/diagnostic-intake');
const {importRefurb}=require('../src/refurb-intake');
const maintenance=require('../src/record-maintenance');
const locationManagement=require('../src/location-management');
const palletManagement=require('../src/pallet-management');
const backupManager=require('../src/backup-manager');
const intakeVerification=require('../src/intake-verification');
const conflicts=require('../src/sync-conflicts');
const bind=process.env.APEX_HUB_HOST||'127.0.0.1';
const port=Number(process.env.APEX_HUB_PORT||4217);
const dataDir=process.env.APEX_HUB_DATA_DIR||path.join(__dirname,'data');
const dbPath=path.join(dataDir,'inventory.json');
const tokenPath=path.join(dataDir,'hub-token.txt');
const intakeTokenPath=path.join(dataDir,'hub-intake-token.txt');
const refurbTokenPath=path.join(dataDir,'hub-refurb-token.txt');
fs.mkdirSync(dataDir,{recursive:true});
if(!fs.existsSync(tokenPath))fs.writeFileSync(tokenPath,crypto.randomBytes(32).toString('hex')+'\n',{mode:0o600,flag:'wx'});
const token=fs.readFileSync(tokenPath,'utf8').trim();
if(!fs.existsSync(intakeTokenPath))fs.writeFileSync(intakeTokenPath,crypto.randomBytes(32).toString('hex')+'\n',{mode:0o600,flag:'wx'});
const intakeToken=fs.readFileSync(intakeTokenPath,'utf8').trim();
if(!fs.existsSync(refurbTokenPath))fs.writeFileSync(refurbTokenPath,crypto.randomBytes(32).toString('hex')+'\n',{mode:0o600,flag:'wx'});
const refurbToken=fs.readFileSync(refurbTokenPath,'utf8').trim();
// Each auto-connected device has its own restricted credential. No hub admin key is advertised.
const devicesPath=path.join(dataDir,'trusted-devices.json');
const receiptsPath=path.join(dataDir,'intake-receipts.json');
const conflictsPath=path.join(dataDir,'intake-conflicts.json');
let devicesData={autoApprove:false,devices:[],revoked:[],revokedInfo:[]};
try { const saved=JSON.parse(fs.readFileSync(devicesPath,'utf8'));if(Array.isArray(saved.devices)) devicesData={autoApprove:saved.autoApprove===true,devices:saved.devices,revoked:Array.isArray(saved.revoked)?saved.revoked:[],revokedInfo:Array.isArray(saved.revokedInfo)?saved.revokedInfo:[]}; }catch{}
function saveDevices(){const tmp=devicesPath+'.tmp';fs.writeFileSync(tmp,JSON.stringify(devicesData,null,2),{mode:0o600});fs.renameSync(tmp,devicesPath);}
function ipNum(ip){if(!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip))return null;const a=ip.split('.').map(Number);return a.every(n=>n>=0&&n<=255)?a.reduce((sum,n)=>((sum<<8)>>>0)+n,0)>>>0:null;}
function trustedLocal(ip){
 ip=String(ip||'').replace(/^::ffff:/,'');if(ip==='::1'||ip==='127.0.0.1')return true;
 const n=ipNum(ip);if(n===null)return false;
 for(const list of Object.values(os.networkInterfaces()))for(const nic of list||[]){
  if(nic.family!=='IPv4'||nic.internal)continue;
  const own=ipNum(nic.address), mask=ipNum(nic.netmask);
  if(own!==null&&mask!==null&&((own&mask)>>>0)===((n&mask)>>>0))return true;
 }
 return false;
}
function restrictedCredential(req,scope){
 const provided=String(req.headers.authorization||'').replace(/^Bearer /,'');
 const global=scope==='diagnostics'?intakeToken:refurbToken;
 if(authorizedAs(req,global))return true; // existing installations remain compatible
 if(!trustedLocal(req.socket.remoteAddress))return false;
 return devicesData.devices.some(d=>d.approved&&d.scope===scope&&d.token&&provided.length===d.token.length&&crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(d.token)));
}
function safeDevice(d){return {id:d.id,label:d.label,scope:d.scope,approved:!!d.approved,created:d.created,lastSeen:d.lastSeen,lastImportedAt:d.lastImportedAt||null,lastErrorAt:d.lastErrorAt||null,lastError:d.lastError||null,ip:d.ip,pendingCount:Number.isInteger(d.pendingCount)?d.pendingCount:null,attentionCount:Number.isInteger(d.attentionCount)?d.attentionCount:null,lastQueueReportAt:d.lastQueueReportAt||null};}
function recordIntake(req,scope,action,payload,item,reason){
 // A verified receipt is written AFTER the inventory save succeeds.
 // If log storage fails, do not claim the import failed or lose an acknowledged intake.
 try{
  const supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');
  const device=devicesData.devices.find(d=>d.approved&&d.scope===scope&&d.token===supplied);
  return intakeVerification.append(receiptsPath,{scope,action,assetId:payload?.assetId||payload?.assetTag||payload?.id||item?.id||'',label:device?.label||'',item,reason});
 }catch(e){console.error('[APEX intake history] Could not record receipt:',e.message);return null;}
}
function markDeviceRequest(req,scope,imported=false){
 const provided=String(req.headers.authorization||'').replace(/^Bearer /,'');
 const d=devicesData.devices.find(d=>d.approved&&d.scope===scope&&d.token===provided);
 if(!d)return; // legacy shared save-only credentials have no unique device identity
 const now=Date.now();
 if(imported){d.lastImportedAt=now;d.lastSeen=now;d.lastErrorAt=null;d.lastError=null;saveDevices();}
 else if(!d.lastSeen||now-d.lastSeen>60000){d.lastSeen=now;saveDevices();}
}

function registerDevice(req,payload){
 if(!trustedLocal(req.socket.remoteAddress))return {status:403,body:{ok:false,error:'Automatic joining is restricted to this local network.'}};
 const id=String(payload.id||''),key=String(payload.key||''),scope=String(payload.scope||''),label=String(payload.label||'').trim().slice(0,64);
 if(!/^[a-f0-9-]{36}$/i.test(id)||!/^[a-f0-9]{64}$/i.test(key)||!['diagnostics','refurb'].includes(scope)||!label)return {status:400,body:{ok:false,error:'Invalid device identity or type.'}};
 if(devicesData.revoked.includes(id))return {status:403,body:{ok:false,error:'Device was revoked. Administrator must clear revocation on the hub.'}};
 const keyHash=crypto.createHash('sha256').update(key).digest('hex');
 let d=devicesData.devices.find(x=>x.id===id);
 if(d){if(d.keyHash!==keyHash||d.scope!==scope)return {status:403,body:{ok:false,error:'Existing device identity does not match.'}};}
 else{
  if(devicesData.devices.length>=150)return {status:429,body:{ok:false,error:'Too many known devices; remove unused devices.'}};
  d={id,keyHash,scope,label,ip:'',created:Date.now(),approved:devicesData.autoApprove,token:crypto.randomBytes(32).toString('hex')};devicesData.devices.push(d);
 }
 d.label=label;d.ip=String(req.socket.remoteAddress||'').replace(/^::ffff:/,'');d.lastSeen=Date.now();
 saveDevices();
 return d.approved?{status:200,body:{ok:true,connected:true,scope,token:d.token,service:'APEX Shared Inventory Hub'}}:{status:202,body:{ok:true,connected:false,pending:true,message:'Waiting for the Inventory administrator to approve this device.'}};
}

function recordDeviceError(req,scope,error){
 const provided=String(req.headers.authorization||'').replace(/^Bearer /,'');
 const d=devicesData.devices.find(d=>d.approved&&d.scope===scope&&d.token===provided);
 if(!d)return;
 d.lastErrorAt=Date.now();d.lastError=String(error||'Import rejected').slice(0,160);saveDevices();
}

let data=fs.existsSync(dbPath)?JSON.parse(fs.readFileSync(dbPath,'utf8')):{items:[],version:0};
if(!Array.isArray(data.items))throw Error('Hub data is invalid');
data.removedLinks=data.removedLinks||{};
assetActivity.capture(data);data.items=data.items.map(core.normalize);
// Reconcile saved locations against active assets. Device intake may create a laptop
// in 'Inspection' without going through the manual location-creation endpoint.
const storedLocations=Array.isArray(data.locations)?data.locations:[];
data.locations=[...storedLocations];
for(const item of data.items){
 const name=String(item.location||'').trim();
 if(!item.deletedAt&&name&&name!=='Unassigned'&&!data.locations.some(x=>x.toLowerCase()===name.toLowerCase()))data.locations.push(name);
}
function registerIncomingLocation(item){
 const name=String(item?.location||'').trim();
 if(name&&name!=='Unassigned'&&!data.locations.some(x=>x.toLowerCase()===name.toLowerCase()))data.locations.push(name);
}
data.operations=workflow.init(data.operations);data.pallets=Array.isArray(data.pallets)?data.pallets:[];data.version=Number.isSafeInteger(data.version)?data.version:0;
function save(){assetActivity.capture(data);const temp=dbPath+'.tmp';fs.writeFileSync(temp,JSON.stringify(data),{mode:0o600});fs.renameSync(temp,dbPath);}
function hubBackupFiles(){return [
 {name:'inventory.json',path:dbPath},
 {name:'trusted-devices.json',path:devicesPath,required:false},
 {name:'intake-receipts.json',path:receiptsPath,required:false},
 {name:'intake-conflicts.json',path:conflictsPath,required:false},
 {name:'hub-token.txt',path:tokenPath},
 {name:'hub-intake-token.txt',path:intakeTokenPath},
 {name:'hub-refurb-token.txt',path:refurbTokenPath}
];}
function createHubBackup(reason='manual'){
 if(!fs.existsSync(dbPath))save();
 return backupManager.snapshot({root:dataDir,files:hubBackupFiles(),reason});
}
function periodicBackup(){
 try{if(backupManager.due(dataDir))createHubBackup('automatic');}
 catch(e){console.error('[APEX backup]',e.message);}
}
// Backups stay on the hub computer, with restricted filesystem permissions.
// Startup and six-hour checks create at most one backup per 24 hours.
if(require.main===module){periodicBackup();const backupTimer=setInterval(periodicBackup,6*60*60*1000);backupTimer.unref();}

const maxBody=32768;
let pairing=null;
const failedPairs=new Map();
function allowPairAttempt(ip){
 const now=Date.now(), entry=failedPairs.get(ip)||{count:0,until:now+60000};
 if(now>entry.until){entry.count=0;entry.until=now+60000;}
 if(entry.count>=5){failedPairs.set(ip,entry);return false;}
 entry.count++;failedPairs.set(ip,entry);return true;
}

function json(res,status,obj){const b=JSON.stringify(obj);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(b);}
function statusPage(res){
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>APEX Shared Hub — Online</title><style>body{margin:0;background:#0d101a;color:#f2edff;font:16px system-ui,-apple-system,Segoe UI,sans-serif;min-height:100vh;display:grid;place-items:center;padding:20px;box-sizing:border-box}.panel{max-width:650px;background:#191b2a;border:1px solid #5f4885;border-radius:12px;padding:30px;box-shadow:0 20px 70px #05050d8a}.brand{color:#c4a4ff;letter-spacing:2px;font-weight:900;font-size:13px}h1{margin:10px 0;font-size:30px}.state{color:#82e6b0;font-weight:700}.muted{color:#aca4bd;line-height:1.7}code{background:#292439;color:#d5c1ff;padding:3px 7px;border-radius:4px}a{color:#cdb0ff}.line{height:1px;background:#3b344b;margin:23px 0}</style></head><body><main class="panel"><div class="brand">APEX SMART INVENTORY</div><h1>Shared Inventory Hub</h1><p class="state">● Hub is online and ready</p><p class="muted">This page confirms the inventory server is running. This is not the inventory dashboard. Open the <b>APEX Smart Inventory Studio desktop app</b> to view and edit assets.</p><div class="line"></div><p><b>On this computer:</b> <code>http://localhost:${port}</code></p><p class="muted"><b>Other computers:</b> use this computer's private IPv4 address, followed by <code>:${port}</code> (for example <code>http://192.168.1.10:${port}</code>). Both devices must be connected to an approved private network or VPN.</p><p><a href="/health">View connection health check</a></p><p class="muted">To connect the desktop app, go to <b>Settings → Configure hub</b> and provide the hub address plus the key from <code>hub\data\hub-token.txt</code>. For APEX Laptop Diagnostics, use the separate save-only key from <code>hub\data\hub-intake-token.txt</code>.</p></main></body></html>`;
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(html);
}
function authorizedAs(req,secret){const incoming=(req.headers.authorization||'').replace(/^Bearer /,'');const a=Buffer.from(incoming);const b=Buffer.from(secret);return a.length===b.length&&crypto.timingSafeEqual(a,b);}
function authorized(req){return authorizedAs(req,token);}
async function body(req){let b='';for await(const c of req){b+=c.toString();if(b.length>maxBody)throw Error('Payload too large');}return JSON.parse(b||'{}');}
const adminCentre=process.env.APEX_HUB_CLOUD_CONFIG?require('./admin-centre').createAdminCentre({configFile:process.env.APEX_HUB_CLOUD_CONFIG,stateFile:process.env.APEX_HUB_CLOUD_STATE,publicConfig:require('../src/cloud-login-distribution.json'),hubUrl:'http://127.0.0.1:'+port,hubToken:token,items:()=>data.items.filter(a=>!a.deletedAt)}):null;
process.on('exit',()=>adminCentre?.stop());process.on('SIGTERM',()=>{adminCentre?.stop(true);process.exit(0);});
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(req.method==='GET'&&pathname==='/')return statusPage(res);
    if(req.method==='GET'&&pathname==='/health')return json(res,200,{ok:true,service:'APEX Shared Inventory Hub',version:data.version});
    if(pathname==='/v1/diagnostic-intake' && req.method==='GET'){const approved=restrictedCredential(req,'diagnostics');if(approved)markDeviceRequest(req,'diagnostics');return json(res,approved?200:401,approved?{ok:true,service:'APEX Diagnostics intake'}:{ok:false,error:'Invalid diagnostic intake token.'});}
    if(pathname==='/v1/diagnostic-intake' && req.method==='POST'){
      if(!restrictedCredential(req,'diagnostics'))return json(res,401,{ok:false,error:'Invalid diagnostic intake token.'});
      markDeviceRequest(req,'diagnostics');
      const payload=await body(req);const existing=data.items.find(i=>i.id===conflicts.incomingId('diagnostics',payload));
      if(existing?.deletedAt){recordIntake(req,'diagnostics','rejected',payload,null,'Asset is deleted; restore it first.');return json(res,409,{ok:false,error:'Asset is in Recycle Bin; restore it first.'});}
      const result=importDiagnostic(data.items,payload);
      if(!result.ok){
       const asset=data.items.find(i=>i.id===conflicts.incomingId('diagnostics',payload));
       const queued=result.error?.includes('different serial')?conflicts.stage(conflictsPath,'diagnostics',payload,asset,devicesData.devices.find(d=>d.token===String(req.headers.authorization||'').replace(/^Bearer /,''))?.label):null;
       recordDeviceError(req,'diagnostics',result.error);recordIntake(req,'diagnostics','rejected',payload,null,result.error);
       return json(res,queued?409:400,{...result,...(queued?{conflictQueued:true}:{} )});
      }
      if(result.action!=='unchanged'){registerIncomingLocation(result.item);data.version++;save();}
      markDeviceRequest(req,'diagnostics',true);
      recordIntake(req,'diagnostics',result.action,payload,result.item);
      return json(res,result.action==='created'?201:200,{...result,version:data.version});
    }
    if(pathname==='/v1/refurb-intake' && req.method==='GET'){const approved=restrictedCredential(req,'refurb');if(approved)markDeviceRequest(req,'refurb');return json(res,approved?200:401,approved?{ok:true,service:'RefurbFlow intake'}:{ok:false,error:'Invalid refurbishment token.'});}
    if(pathname==='/v1/refurb-intake' && req.method==='POST'){
      if(!restrictedCredential(req,'refurb'))return json(res,401,{ok:false,error:'Invalid refurbishment token.'});
      markDeviceRequest(req,'refurb');
      const payload=await body(req);const existing=data.items.find(i=>i.id===String(payload.assetId||payload.assetTag||'').trim().toUpperCase());
      if(existing?.deletedAt){recordIntake(req,'refurb','rejected',payload,null,'Asset is deleted; restore it first.');return json(res,409,{ok:false,error:'Asset is in Recycle Bin; restore it before sending refurb records.'});}
      const result=importRefurb(data.items,payload);
      if(!result.ok){
       const asset=data.items.find(i=>i.id===conflicts.incomingId('refurb',payload));
       const queued=result.error?.includes('different serial')?conflicts.stage(conflictsPath,'refurb',payload,asset,devicesData.devices.find(d=>d.token===String(req.headers.authorization||'').replace(/^Bearer /,''))?.label):null;
       recordDeviceError(req,'refurb',result.error);recordIntake(req,'refurb','rejected',payload,null,result.error);
       return json(res,queued?409:400,{...result,...(queued?{conflictQueued:true}:{})});
      }
      if(!['unchanged','ignored'].includes(result.action)){registerIncomingLocation(result.item);workflow.syncRefurb(data.operations,result.item,result.action);data.version++;save();}
      markDeviceRequest(req,'refurb',true);
      recordIntake(req,'refurb',result.action,payload,result.item);
      return json(res,result.action==='created'?201:200,{...result,version:data.version});
    }
    if(pathname==='/v1/connect/request'&&req.method==='POST'){
      const outcome=registerDevice(req,await body(req));return json(res,outcome.status,outcome.body);
    }
    if(pathname==='/v1/backups/status'&&req.method==='GET'){
      if(!authorized(req))return json(res,401,{ok:false,error:'Admin permission required.'});
      return json(res,200,{ok:true,...backupManager.details(dataDir),storage:'hub'});
    }
    if(pathname==='/v1/backups/create'&&req.method==='POST'){
      if(!authorized(req))return json(res,401,{ok:false,error:'Admin permission required.'});
      return json(res,200,{ok:true,backup:createHubBackup('manual')});
    }
    // Queue metrics contain counts only, never queued assets or repair details.
    // This endpoint is deliberately unavailable to shared legacy intake tokens.
    if(pathname==='/v1/connect/sync-status'&&req.method==='POST'){
      if(!trustedLocal(req.socket.remoteAddress))return json(res,403,{ok:false,error:'Private network required.'});
      const provided=String(req.headers.authorization||'').replace(/^Bearer /,'');
      const device=devicesData.devices.find(d=>d.approved&&d.token&&d.token.length===provided.length&&crypto.timingSafeEqual(Buffer.from(d.token),Buffer.from(provided)));
      if(!device)return json(res,401,{ok:false,error:'Approved device credential required.'});
      const info=await body(req),pending=info.pendingCount,attention=info.attentionCount;
      if(!Number.isInteger(pending)||!Number.isInteger(attention)||pending<0||pending>100000||attention<0||attention>pending)return json(res,400,{ok:false,error:'Invalid queue counts.'});
      device.pendingCount=pending;device.attentionCount=attention;
      device.lastQueueReportAt=Date.now();device.lastSeen=Date.now();saveDevices();
      return json(res,200,{ok:true,reportedAt:device.lastQueueReportAt});
    }
    if(pathname==='/v1/intake/conflicts'&&req.method==='GET'){
      if(!authorized(req))return json(res,401,{ok:false,error:'Admin permission required.'});
      return json(res,200,{ok:true,conflicts:conflicts.list(conflictsPath)});
    }
    if(pathname==='/v1/intake/conflicts/resolve'&&req.method==='POST'){
      if(!authorized(req))return json(res,401,{ok:false,error:'Admin permission required.'});
      const input=await body(req),conflictId=String(input.id||''),decision=String(input.decision||'');
      if(!/^[0-9a-f-]{36}$/i.test(conflictId))return json(res,400,{ok:false,error:'Invalid conflict ID.'});
      const entry=conflicts.read(conflictsPath).find(e=>e.id===conflictId);
      if(!entry)return json(res,404,{ok:false,error:'Conflict no longer exists.'});
      const existing=data.items.find(a=>a.id===entry.assetId&&!a.deletedAt);
      if(!existing)return json(res,409,{ok:false,error:'Asset was deleted or is unavailable. Resolution blocked.'});
      const prepared=conflicts.decide(conflictsPath,conflictId,decision,existing.serial);
      if(!prepared.ok)return json(res,prepared.status,prepared);
      if(decision==='keepExisting'){
       const resolved=conflicts.mark(conflictsPath,prepared.entries,prepared.entry,decision);
       return json(res,200,{ok:true,resolved});
      }
      if(!prepared.entry.payload)return json(res,409,{ok:false,error:'Incoming submission is unavailable. Ask the device to resend.'});
      // Prepare all changes on copies. No mutation of current records until the new import validates.
      const proposedItems=structuredClone(data.items),proposedOperations=structuredClone(data.operations);
      const target=proposedItems.find(a=>a.id===entry.assetId);
      target.serial=prepared.entry.incoming.serial;
      const importResult=entry.scope==='diagnostics'?importDiagnostic(proposedItems,prepared.entry.payload):importRefurb(proposedItems,prepared.entry.payload);
      if(!importResult.ok)return json(res,409,{ok:false,error:'Cannot apply incoming record: '+importResult.error});
      if(entry.scope==='refurb'&&!['unchanged','ignored'].includes(importResult.action))workflow.syncRefurb(proposedOperations,importResult.item,importResult.action);
      const updated=proposedItems.find(a=>a.id===entry.assetId);
      updated.history=Array.isArray(updated.history)?updated.history:[];
      updated.history.push({type:'Sync conflict resolved',detail:'Administrator accepted the incoming '+entry.scope+' device identity',at:new Date().toISOString()});
      updated.history=updated.history.slice(-120);
      data.items=proposedItems;data.operations=proposedOperations;data.version++;save();
      const resolved=conflicts.mark(conflictsPath,prepared.entries,prepared.entry,decision);
      return json(res,200,{ok:true,resolved,assetId:entry.assetId,version:data.version});
    }
    if(pathname.startsWith('/v1/admin-centre/')){
      if(!authorized(req))return json(res,401,{ok:false,error:'Hub administrator connection required.'});
      if(!adminCentre)return json(res,409,{ok:false,error:'Update and restart APEX on the trusted hub PC, then start its hub through Settings.'});
      const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
      const proof=String(req.headers['x-apex-admin-session']||'');
      if(!await adminCentre.authorize(proof,local))return json(res,403,{ok:false,error:'An active shared administrator account is required.'});
      const action=pathname.slice('/v1/admin-centre/'.length);
      if((action==='status'||action==='users-list')?req.method!=='GET':req.method!=='POST')return json(res,405,{ok:false,error:'Method not allowed.'});
      const result=await adminCentre.handle(action,req.method==='POST'?await body(req):{},local);
      return json(res,result.ok?200:400,{...result,localControl:local});
    }
    if(pathname==='/v1/intake/receipts'&&req.method==='GET'){
      if(!authorized(req))return json(res,401,{ok:false,error:'Admin permission required.'});
      const events=intakeVerification.read(receiptsPath).reverse();
      return json(res,200,{ok:true,events,retained:intakeVerification.LIMIT});
    }
    if(pathname==='/v1/connect/devices'&&req.method==='GET'){
      if(!authorized(req))return json(res,401,{ok:false,error:'Admin permission required.'});
      return json(res,200,{ok:true,autoApprove:devicesData.autoApprove,devices:devicesData.devices.map(safeDevice),revokedDevices:devicesData.revoked.map(id=>devicesData.revokedInfo.find(d=>d.id===id)||{id,label:'Previously blocked device',scope:'diagnostics'})});
    }
    if(pathname==='/v1/connect/config'&&req.method==='POST'){
      if(!authorized(req))return json(res,401,{ok:false,error:'Admin permission required.'});
      const config=await body(req);if(typeof config.autoApprove!=='boolean')return json(res,400,{ok:false,error:'Expected autoApprove true or false.'});
      devicesData.autoApprove=config.autoApprove;saveDevices();return json(res,200,{ok:true,autoApprove:devicesData.autoApprove});
    }
    if(pathname==='/v1/connect/approve'&&req.method==='POST'){
      if(!authorized(req))return json(res,401,{ok:false,error:'Admin permission required.'});
      const payload=await body(req),d=devicesData.devices.find(x=>x.id===payload.id);
      if(!d)return json(res,404,{ok:false,error:'Device not found.'});d.approved=true;saveDevices();return json(res,200,{ok:true});
    }
    if(pathname==='/v1/connect/revoke'&&req.method==='POST'){
      if(!authorized(req))return json(res,401,{ok:false,error:'Admin permission required.'});
      const payload=await body(req),i=devicesData.devices.findIndex(x=>x.id===payload.id);
      if(i<0)return json(res,404,{ok:false,error:'Device not found.'});devicesData.revoked.push(payload.id);devicesData.revoked=devicesData.revoked.slice(-1000);devicesData.revokedInfo.push({id:payload.id,label:devicesData.devices[i].label,scope:devicesData.devices[i].scope,at:Date.now()});devicesData.revokedInfo=devicesData.revokedInfo.filter(d=>devicesData.revoked.includes(d.id)).slice(-1000);devicesData.devices.splice(i,1);saveDevices();return json(res,200,{ok:true});
    }
    if(pathname==='/v1/connect/unrevoke'&&req.method==='POST'){
      if(!authorized(req))return json(res,401,{ok:false,error:'Admin permission required.'});
      const payload=await body(req),id=String(payload.id||'');
      if(!devicesData.revoked.includes(id))return json(res,404,{ok:false,error:'Blocked device not found.'});
      devicesData.revoked=devicesData.revoked.filter(x=>x!==id);
      devicesData.revokedInfo=devicesData.revokedInfo.filter(x=>x.id!==id);
      saveDevices();return json(res,200,{ok:true,message:'Device may request a new connection. Approval is still required unless trusted-LAN auto acceptance is enabled.'});
    }
    if(pathname==='/v1/pair/exchange'&&req.method==='POST'){
      const ip=req.socket.remoteAddress||'unknown';
      if(!allowPairAttempt(ip))return json(res,429,{ok:false,error:'Too many attempts; wait one minute.'});
      const payload=await body(req), code=String(payload.code||'').trim();
      const scope=payload.scope==='refurb'?'refurb':'diagnostics';
      if(!pairing||Date.now()>pairing.expiresAt||!/^\d{6}$/.test(code)||code!==pairing.code)return json(res,401,{ok:false,error:'Pairing code is invalid or expired. Generate a new code in Smart Inventory.'});
      pairing=null;
      return json(res,200,{ok:true,token:scope==='refurb'?refurbToken:intakeToken});
    }
    if(pathname==='/v1/pair/create'&&req.method==='POST'){
      if(!authorized(req))return json(res,401,{ok:false,error:'Invalid hub access token.'});
      const code=String(crypto.randomInt(100000,1000000));
      pairing={code,expiresAt:Date.now()+120000};
      return json(res,200,{ok:true,code,expiresAt:pairing.expiresAt});
    }
    if(!authorized(req))return json(res,401,{ok:false,error:'Invalid hub access token.'});
    if(pathname==='/v1/asset-activity'&&req.method==='POST'){const result=assetActivity.page(data,await body(req));return json(res,result.ok?200:404,result);}
    if(pathname==='/v1/operations'&&req.method==='GET')return json(res,200,{ok:true,workflow:data.operations,version:data.version});
    if(pathname==='/v1/operations/action'&&req.method==='POST'){
      const draft=structuredClone(data.operations);const result=workflow.apply(draft,data.items.filter(a=>!a.deletedAt),await body(req));
      if(!result.ok)return json(res,400,result);
      data.operations=result.workflow;data.version++;save();return json(res,200,{...result,version:data.version});
    }
    if(pathname==='/v1/trash'&&req.method==='GET')return json(res,200,{ok:true,items:data.items.filter(a=>a.deletedAt)});
    if(pathname==='/v1/trash/restore'&&req.method==='POST'){
      const payload=await body(req);const outcome=maintenance.mutate(data,{type:'restoreAsset',assetId:payload.id});
      if(!outcome.ok)return json(res,400,outcome);data.version++;save();return json(res,200,outcome);
    }
    if(pathname==='/v1/maintenance/delete'&&req.method==='POST'){
      const outcome=maintenance.mutate(data,await body(req));
      if(!outcome.ok)return json(res,400,outcome);data.version++;save();return json(res,200,{...outcome,version:data.version});
    }
    if(pathname==='/v1/items'&&req.method==='GET'){
      // Every request reaches the administrator authentication check above.
      // A matching version avoids serialising the entire inventory on each poll.
      const known=new URL(req.url,'http://localhost').searchParams.get('knownVersion');
      if(known!==null&&/^\d{1,15}$/.test(known)&&Number(known)===data.version)
        return json(res,200,{ok:true,unchanged:true,version:data.version});
      return json(res,200,{ok:true,items:data.items.filter(a=>!a.deletedAt),locations:data.locations,palletLocations:palletManagement.palletLocations(data),pallets:palletManagement.listPallets(data),version:data.version});
    }
    if(pathname==='/v1/locations'&&req.method==='POST'){const input=await body(req);const name=String(input.name||'').trim().replace(/\s+/g,' ').slice(0,90);if(!name||/[<>\r\n]/.test(name))return json(res,400,{ok:false,error:'Enter a valid location.'});if(data.locations.some(l=>l.toLowerCase()===name.toLowerCase()))return json(res,409,{ok:false,error:'Location already exists.'});data.locations.push(name);data.version++;save();return json(res,201,{ok:true,locations:data.locations,palletLocations:palletManagement.palletLocations(data),pallets:palletManagement.listPallets(data),version:data.version});}
    if(pathname.startsWith('/v1/locations/')&&req.method==='DELETE'){const name=decodeURIComponent(pathname.slice('/v1/locations/'.length));const input=await body(req);const result=locationManagement.deleteLocation(data,{name,moveTo:input.moveTo});if(!result.ok)return json(res,result.requiresMove?409:400,result);data.version++;save();return json(res,200,{...result,version:data.version});}
    if(pathname==='/v1/pallet-locations/delete'&&req.method==='POST'){const result=palletManagement.deletePalletLocation(data,await body(req));if(!result.ok)return json(res,409,result);data.version++;save();return json(res,200,{...result,version:data.version});}
    if(pathname==='/v1/pallet-locations'&&req.method==='POST'){const result=palletManagement.createPalletLocation(data,await body(req));if(!result.ok)return json(res,400,result);data.version++;save();return json(res,201,{...result,version:data.version});}
    if(pathname==='/v1/pallets/move'&&req.method==='POST'){const result=palletManagement.movePallets(data,await body(req));if(!result.ok)return json(res,409,result);data.version++;save();return json(res,200,{...result,version:data.version});}
    if(pathname==='/v1/pallets'&&req.method==='POST'){const result=palletManagement.createPallet(data,await body(req));if(!result.ok)return json(res,400,result);data.version++;save();return json(res,201,{...result,version:data.version});}
    if(pathname==='/v1/pallets/delete'&&req.method==='POST'){const result=palletManagement.deletePallet(data,await body(req));if(!result.ok)return json(res,result.requiresConfirmation?409:400,result);data.version++;save();return json(res,200,{...result,version:data.version});}
    if(pathname==='/v1/items/bulk-move'&&req.method==='POST'){const result=palletManagement.moveBatch(data,await body(req));if(!result.ok)return json(res,400,result);data.version++;save();return json(res,200,{...result,version:data.version});}
    if(pathname==='/v1/items/bulk-restore'&&req.method==='POST'){const result=palletManagement.restoreBatch(data,await body(req));if(!result.ok)return json(res,409,result);data.version++;save();return json(res,200,{...result,version:data.version});}
    if(pathname==='/v1/items'&&req.method==='POST'){const r=core.add(data.items,await body(req));if(!r.ok)return json(res,400,r);data.version++;save();return json(res,201,{...r,version:data.version});}
    if(pathname.startsWith('/v1/items/')&&req.method==='PATCH'){const id=decodeURIComponent(pathname.slice('/v1/items/'.length));const r=core.update(data.items,id,await body(req));if(!r.ok)return json(res,404,r);data.version++;save();return json(res,200,{...r,version:data.version});}
    if(pathname.startsWith('/v1/items/')&&req.method==='DELETE'){const id=decodeURIComponent(pathname.slice('/v1/items/'.length));const result=maintenance.mutate(data,{type:'deleteAsset',assetId:id});if(!result.ok)return json(res,404,result);data.version++;save();return json(res,200,{...result,version:data.version});}
    return json(res,404,{ok:false,error:'Unknown endpoint.'});
  }catch(e){console.error('[Hub]',e.message);return json(res,400,{ok:false,error:'Invalid request.'});}
});
if(require.main===module){
 // UDP announcement only: discovery replies never include admin or intake credentials.
 const discovery=dgram.createSocket({type:'udp4',reuseAddr:true});
 discovery.on('message',(message,peer)=>{
  if(!trustedLocal(peer.address)||message.toString('utf8')!=='APEX_HUB_DISCOVER_V1')return;
  const result=Buffer.from(JSON.stringify({service:'APEX_SMART_INVENTORY',port,version:1}));
  discovery.send(result,peer.port,peer.address,()=>{});
 });
 discovery.on('error',e=>console.warn('[APEX Hub] UDP discovery unavailable:',e.message));
 discovery.bind(4218,'0.0.0.0',()=>console.log('[APEX Hub] Automatic LAN discovery: UDP 4218'));
 server.on('close',()=>{try{discovery.close();}catch{}});
 server.on('error',err=>{
   if(err.code==='EADDRINUSE')console.error(`\n[APEX Hub] Cannot start: port ${port} is already in use. Another copy of the hub may already be running. Close its window or use the existing instance.`);
   else if(err.code==='EACCES')console.error(`\n[APEX Hub] Permission denied while starting on ${bind}:${port}.`);
   else console.error('\n[APEX Hub] Startup failure:',err.message);
   process.exitCode=1;
 });
 server.listen(port,bind,()=>{
   console.log('\n==========================================');
   console.log('    APEX SHARED INVENTORY HUB: ONLINE');
   console.log('==========================================');
   console.log(`Open ON THIS COMPUTER: http://127.0.0.1:${port}/`);
   console.log(`Health check: http://127.0.0.1:${port}/health`);
   console.log(`Listen address: ${bind}:${port}`);
   console.log(`Admin hub token stored in: ${tokenPath}`);
   console.log(`Diagnostics SAVE-ONLY token stored in: ${intakeTokenPath}`);
   console.log(`RefurbFlow SAVE-ONLY token stored in: ${refurbTokenPath}`);
   console.log('Keep this window open. Do not forward this port to the public Internet.');
 });
}
module.exports={server};
