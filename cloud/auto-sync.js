'use strict';
/* Hub-side auto-sync entrypoint. Runs separately from Electron Management Studio.
 * Secrets are read from the existing per-user private config, never shipped in the app.
 */
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const appData=process.env.APPDATA;
if(!appData){console.error('[AUTO SYNC] APPDATA is unavailable.');process.exit(1);}
const appDir=process.env.APEX_CLOUD_USER_DATA || path.join(appData,'APEX Refurb Management Studio');
const settingsPath=path.join(appDir,'cloud-bridge.local.json');
const statePath=path.join(appDir,'cloud-sync-state.local.json');
const tokenPath=path.join(__dirname,'..','hub','data','hub-token.txt');
if(!fs.existsSync(settingsPath)){
 console.log('[AUTO SYNC] Cloud settings missing. Configure cloud sync in Studio on this Hub computer.');process.exit(0);
}
if(!fs.existsSync(statePath)){
 console.log('[AUTO SYNC] First sync has not been confirmed/completed. Run the first safety-approved sync in Studio once.');process.exit(0);
}
if(!fs.existsSync(tokenPath)){
 console.error('[AUTO SYNC] Hub admin token missing. Start Shared Hub first.');process.exit(1);
}
let c;try{c=JSON.parse(fs.readFileSync(settingsPath,'utf8'));}catch{console.error('[AUTO SYNC] Cloud configuration is invalid.');process.exit(1);}
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(c.supabaseUrl||'')||!c.serviceRoleKey){
 console.error('[AUTO SYNC] Cloud credentials incomplete.');process.exit(1);
}
const token=fs.readFileSync(tokenPath,'utf8').trim();
const runtime=path.join(appDir,'cloud-bridge.auto.runtime.json');
const tmp=runtime+'.tmp';
fs.writeFileSync(tmp,JSON.stringify({...c,hubUrl:'http://127.0.0.1:4217',hubToken:token}),{mode:0o600});
fs.renameSync(tmp,runtime);
const env={...process.env,APEX_CLOUD_BRIDGE_CONFIG:runtime,APEX_CLOUD_STATE_FILE:statePath};
console.log('[AUTO SYNC] Starting independent Hub-to-Supabase background synchronisation (15s cadence).');
const child=spawn(process.execPath,[path.join(__dirname,'sync-bridge.js')],{env,stdio:'inherit',windowsHide:false});
child.on('error',e=>console.error('[AUTO SYNC] Worker launch failed:',e.message));
child.on('exit',code=>{try{fs.unlinkSync(runtime);}catch{}process.exitCode=code||0;});
