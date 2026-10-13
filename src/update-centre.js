'use strict';
const {app}=require('electron');
const fs=require('fs'),path=require('path'),https=require('https'),crypto=require('crypto'),{spawn}=require('child_process');
let updater=null,windowRef=null,initialised=false,devRelease=null,devZip=null,portableRelease=null,portableExe=null;
const isPortable=app.isPackaged&&process.platform==='win32'&&Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
const data={state:'idle',currentVersion:app.getVersion(),availableVersion:null,progress:0,error:null,releases:null,supported:app.isPackaged&&process.platform==='win32'};
function broadcast(){if(windowRef&&!windowRef.isDestroyed())windowRef.webContents.send('apex:update-state',{...data});}
function set(patch){Object.assign(data,patch);broadcast();return {...data};}
function init(win){
 windowRef=win;
 if(initialised)return;initialised=true;
 if(!data.supported){set({state:'idle',mode:'development',supported:true});return;}
 if(isPortable){set({mode:'portable',supported:true,state:'idle'});return;}
 try {
  updater=require('electron-updater').autoUpdater;
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;
  updater.allowPrerelease=false;
  updater.on('checking-for-update',()=>set({state:'checking',error:null}));
  updater.on('update-available',info=>set({state:'available',availableVersion:info.version,releases:info.releaseNotes||null}));
  updater.on('update-not-available',()=>set({state:'current',availableVersion:null}));
  updater.on('download-progress',p=>set({state:'downloading',progress:Math.round(p.percent||0)}));
  updater.on('update-downloaded',()=>set({state:'ready',progress:100}));
  updater.on('error',err=>set({state:'error',error:String(err.message||err).slice(0,280)}));
  // Startup checks are silent; do not notify for success or up-to-date.
  win.webContents.once('did-finish-load',()=>{setTimeout(()=>check(false),12000);});
  const periodic=setInterval(()=>check(false),6*60*60*1000);periodic.unref?.();
 }catch(err){set({state:'error',error:'Updater failed to initialise: '+err.message});}
}
function status(){return {...data};}
async function check(manual=false){
 if(!app.isPackaged)return devCheck();
 if(isPortable)return portableCheck();
 if(!data.supported)return {ok:false,error:'Portable updater has not been enabled. Production NSIS updater remains supported.'};
 if(!updater)return {ok:false,error:'Updater not ready.'};
 if(['checking','downloading','ready'].includes(data.state))return {ok:true,...status()};
 try{await updater.checkForUpdates();return {ok:true,...status()};}
 catch(err){const raw=String(err.message||err);const missing=/Unable to find latest version|releases\/latest|HttpError: 406|Cannot parse releases feed/i.test(raw);set({state:'error',error:missing?'No production installer release found on GitHub. Publish a normal release with both the newer Setup EXE and matching latest.yml (development ZIP prereleases cannot update installed APEX).':'Update check failed: '+raw.slice(0,220)});return manual?{ok:false,error:data.error}:{ok:true,...status()};}
}
async function download(){if(!app.isPackaged)return devDownload();
 if(isPortable)return portableDownload();
 if(data.state!=='available'||!updater)return {ok:false,error:'Check for an available update first.'};try{await updater.downloadUpdate();return {ok:true,...status()};}catch(err){return {ok:false,error:String(err.message||err)};}}
function install(){if(!app.isPackaged)return devInstall();
 if(isPortable)return portableInstall();
 if(data.state!=='ready'||!updater)return {ok:false,error:'No verified downloaded update is ready.'};set({state:'installing'});setImmediate(()=>updater.quitAndInstall(false,true));return {ok:true};}
// Development-only releases: explicit GitHub prereleases containing APEX-Studio-DEV-*.zip.
// Never silently replace the active source, deployed EXE, or any Supabase data.
const REPO='apexjstool-hub/APEX-Refurb-Studio';
function getText(url,redirects=0){return new Promise((resolve,reject)=>{
 if(redirects>5)return reject(new Error('Too many redirects'));
 const u=new URL(url);if(u.protocol!=='https:'||!['api.github.com','github.com','objects.githubusercontent.com','release-assets.githubusercontent.com'].includes(u.hostname))return reject(new Error('Untrusted release host'));
 https.get(u,{headers:{'User-Agent':'APEX-Refurb-Studio-Dev-Updater','Accept':'application/vnd.github+json'},timeout:20000},r=>{
  if([301,302,303,307,308].includes(r.statusCode)){r.resume();return resolve(getText(new URL(r.headers.location,url).href,redirects+1));}
  if(r.statusCode!==200){r.resume();return reject(new Error('GitHub returned HTTP '+r.statusCode));}
  let chunks=[],size=0;r.on('data',b=>{size+=b.length;if(size>3000000){r.destroy(new Error('Response too large'));return;}chunks.push(b)});r.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));r.on('error',reject);
 }).on('error',reject).on('timeout',function(){this.destroy(new Error('GitHub request timed out'));});
});}
async function devCheck(){
 if(process.platform!=='win32')return {ok:false,error:'Development test updates require Windows.'};
 set({state:'checking',mode:'development',error:null});
 try{
  const releases=JSON.parse(await getText('https://api.github.com/repos/'+REPO+'/releases?per_page=30'));
  if(!Array.isArray(releases))throw new Error('Unexpected GitHub response');
  let match=null;
  for(const release of releases){
   if(release.draft||!release.prerelease)continue;
   const asset=(release.assets||[]).find(a=>/^APEX-Studio-DEV-[0-9A-Za-z.\-]+\.zip$/.test(a.name)&&a.size>0&&a.size<=52428800);
   if(asset){match={version:release.tag_name||release.name,asset};break;}
  }
  devRelease=match;devZip=null;
  if(!match){set({state:'current',availableVersion:null});return {ok:true,...status()};}
  set({state:'available',availableVersion:match.version,releases:'GitHub development update for this source folder'});
  return {ok:true,...status()};
 }catch(e){set({state:'error',error:'GitHub development update check failed: '+String(e.message||e).slice(0,200)});return {ok:false,error:data.error};}
}
async function devDownload(){
 if(data.state!=='available'||!devRelease)return {ok:false,error:'Check for GitHub updates first.'};
 set({state:'downloading',progress:0});
 try{
  const target=path.join(app.getPath('userData'),'development-updates');fs.mkdirSync(target,{recursive:true});
  const file=path.join(target,path.basename(devRelease.asset.name));
  const temp=file+'.partial';
  await new Promise((resolve,reject)=>{
   function follow(url,redirects){
    if(redirects>5)return reject(new Error('Too many download redirects'));
    const u=new URL(url);if(u.protocol!=='https:'||!['github.com','objects.githubusercontent.com','release-assets.githubusercontent.com'].includes(u.hostname))return reject(new Error('Untrusted download host'));
    https.get(u,{headers:{'User-Agent':'APEX-Refurb-Studio-Dev-Updater'},timeout:30000},r=>{
     if([301,302,303,307,308].includes(r.statusCode)){r.resume();return follow(new URL(r.headers.location,url).href,redirects+1)}
     if(r.statusCode!==200){r.resume();return reject(new Error('Download HTTP '+r.statusCode))}
     const out=fs.createWriteStream(temp);let total=0;
     r.on('data',b=>{total+=b.length;if(total>52428800){r.destroy(new Error('File exceeds 50 MB limit'));return;}set({progress:Math.min(99,Math.round(total/devRelease.asset.size*100))});});
     r.on('error',reject);out.on('error',reject);out.on('finish',resolve);r.pipe(out);
    }).on('error',reject).on('timeout',function(){this.destroy(new Error('Download timed out'))});
   }
   follow(devRelease.asset.browser_download_url,0);
  });
  if(fs.statSync(temp).size!==devRelease.asset.size)throw new Error('Downloaded size does not match GitHub release');
  fs.renameSync(temp,file);devZip=file;set({state:'ready',progress:100});return {ok:true,...status()};
 }catch(e){set({state:'error',error:String(e.message||e).slice(0,220)});return {ok:false,error:data.error};}
}
function devInstall(){
 if(data.state!=='ready'||!devZip||!fs.existsSync(devZip))return {ok:false,error:'Download the GitHub update first.'};
 if(process.platform!=='win32')return {ok:false,error:'Windows is required for source updates.'};
 const project=path.resolve(__dirname,'..');
 const installer=path.join(project,'tools','update-centre-v2','INSTALL-MAIN-UPDATE.ps1');
 if(!fs.existsSync(installer))return {ok:false,error:'Update helper missing: '+installer};
 const handshake=fs.mkdtempSync(path.join(require('os').tmpdir(),'apex-v2-handshake-'));
 const readyFile=path.join(handshake,'ready.txt'),errorFile=path.join(handshake,'error.txt');
 const outputFile=path.join(handshake,'helper-output.txt');
 const launchFile=path.join(handshake,'launcher-started.txt');
 const exitFile=path.join(handshake,'powershell-exit.txt');
 // CMD batch parsing must not be allowed to reinterpret path metacharacters.
 // Reject unsafe inputs rather than risk executing a malformed command.
 const unsafe=[project,installer,devZip,handshake].find(v=>/[\r\n"%\!\^&|<>]/.test(v));
 if(unsafe)return {ok:false,error:'Updater folder path contains a Windows command character (&, %, !, etc.). Please place the project/update in a simpler folder.'};
 // Independent CMD bootstrap records evidence *before* PowerShell is started.
 // It survives Electron closing and logs any PowerShell error/exit code.
 const bat=path.join(handshake,'launch-updater.cmd');
 const psLine='powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "'+installer+'" -Package "'+devZip+'" -Project "'+project+'" -ParentPid '+process.pid+' -Handshake "'+handshake+'"';
 const lines=[
  '@echo off','setlocal DisableDelayedExpansion',
  'cd /d "'+project+'"',
  '> "'+launchFile+'" echo bootstrap started',
  psLine+' >> "'+outputFile+'" 2>&1',
  'set "APEX_RESULT=%ERRORLEVEL%"',
  '> "'+exitFile+'" echo %APEX_RESULT%',
  'exit /b %APEX_RESULT%'
 ];
 try{fs.writeFileSync(bat,lines.join('\r\n')+'\r\n','utf8');}
 catch(e){return {ok:false,error:'Could not prepare update bootstrap: '+e.message};}
 let finished=false,interval,timeout,child;
 const stop=()=>{if(interval)clearInterval(interval);if(timeout)clearTimeout(timeout);};
 const read=(p)=>{try{return fs.existsSync(p)?fs.readFileSync(p,'utf8').trim():'';}catch{return '';}};
 const fail=(m)=>{if(finished)return;finished=true;stop();set({state:'error',error:m,releases:'Update not installed. APEX remained open.'});};
 try{
  child=spawn('cmd.exe',['/d','/c',bat],{cwd:project,detached:true,windowsHide:true,stdio:'ignore'});
  child.once('error',e=>fail('Windows could not start update bootstrap: '+e.message));
  child.once('spawn',()=>{
   child.unref();
   interval=setInterval(()=>{
    if(finished)return;
    if(fs.existsSync(errorFile))return fail('Updater preparation failed: '+read(errorFile).slice(0,500));
    if(fs.existsSync(readyFile)){
     finished=true;stop();
     set({state:'installing',error:null,releases:'Files verified and backed up. Closing APEX to install into the original folder.'});
     setTimeout(()=>app.quit(),500);
     return;
    }
    if(fs.existsSync(exitFile)){
     const details=read(outputFile).slice(-900)||'PowerShell wrote no output.';
     return fail('Update helper exited before readiness (code '+read(exitFile)+'). '+details+' Diagnostic: '+outputFile);
    }
   },300);
   timeout=setTimeout(()=>{
    const stage=fs.existsSync(launchFile)?'PowerShell started but did not confirm readiness':'Windows bootstrap did not start';
    fail(stage+' within 45 seconds. Log: '+outputFile);
   },45000);
  });
  return {ok:true,...set({state:'starting-installer',error:null,releases:'Windows updater starting. APEX will remain open until verification and backup finish.'})};
 }catch(e){return {ok:false,error:'Could not start Windows updater: '+e.message};}
}


// Step 3: Portable executable distribution. Uses public, production GitHub releases.
// Requires BOTH APEX-Refurb-Studio-Portable-X.Y.Z.exe and matching .exe.sha256 asset.
const PORTABLE_ASSET=/^APEX-Refurb-Studio-Portable-(\d+\.\d+\.\d+)\.exe$/;
const TRUSTED_DOWNLOAD_HOSTS=new Set(['github.com','objects.githubusercontent.com','release-assets.githubusercontent.com']);
function compareVersions(a,b){const aa=String(a).split('.').map(Number),bb=String(b).split('.').map(Number);for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]>bb[i]?1:-1;}return 0;}
function fetchBuffer(url,maxBytes,hosts=TRUSTED_DOWNLOAD_HOSTS,redirects=0){return new Promise((resolve,reject)=>{
 if(redirects>5)return reject(new Error('Too many redirects'));
 let u;try{u=new URL(url);}catch(e){return reject(e);}
 if(u.protocol!=='https:'||!hosts.has(u.hostname))return reject(new Error('Untrusted download location'));
 const req=https.get(u,{headers:{'User-Agent':'APEX-Refurb-Studio-Portable-Updater'},timeout:30000},resp=>{
  if([301,302,303,307,308].includes(resp.statusCode)){const loc=resp.headers.location;resp.resume();if(!loc)return reject(new Error('Download redirect missing location'));fetchBuffer(new URL(loc,url).href,maxBytes,hosts,redirects+1).then(resolve,reject);return;}
  if(resp.statusCode!==200){resp.resume();return reject(new Error('GitHub HTTP '+resp.statusCode));}
  const chunks=[];let size=0;
  resp.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){resp.destroy(new Error('File larger than allowed limit'));return;}chunks.push(chunk);});
  resp.on('end',()=>resolve(Buffer.concat(chunks)));resp.on('error',reject);
 });req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Download timed out')));
});}
async function portableCheck(){
 set({state:'checking',mode:'portable',error:null});
 try{
  const body=JSON.parse(await getText('https://api.github.com/repos/'+REPO+'/releases?per_page=30'));
  if(!Array.isArray(body))throw new Error('Unexpected GitHub release response');
  let best=null;
  for(const release of body){
   if(release.draft||release.prerelease)continue;
   for(const exe of release.assets||[]){
    const m=PORTABLE_ASSET.exec(exe.name);
    if(!m||compareVersions(m[1],app.getVersion())<=0||!exe.size||exe.size>500*1024*1024)continue;
    const hash=(release.assets||[]).find(a=>a.name===exe.name+'.sha256'&&a.size>0&&a.size<1024);
    if(!hash)continue;
    if(!best||compareVersions(m[1],best.version)>0)best={version:m[1],exe,hash};
   }
  }
  portableRelease=best;portableExe=null;
  if(!best)return {ok:true,...set({state:'current',availableVersion:null,releases:'No newer signed-off portable release with checksum was found.'})};
  return {ok:true,...set({state:'available',availableVersion:best.version,releases:'New portable EXE available from GitHub Releases.'})};
 }catch(e){return {ok:false,...set({state:'error',error:'Portable update check failed: '+String(e.message||e).slice(0,240)})};}
}
async function portableDownload(){
 if(data.state!=='available'||!portableRelease)return {ok:false,error:'Check for an available portable release first.'};
 const limit=500*1024*1024;set({state:'downloading',progress:0,error:null});
 try{
  const hashBody=(await fetchBuffer(portableRelease.hash.browser_download_url,1024)).toString('utf8').trim();
  const pattern=/^([a-fA-F0-9]{64})(?:\s+\*?([^\r\n]+))?$/;
  const hm=pattern.exec(hashBody);if(!hm||hm[2]&&hm[2]!==portableRelease.exe.name)throw new Error('Invalid GitHub SHA-256 asset');
  const target=path.join(app.getPath('userData'),'portable-updates');fs.mkdirSync(target,{recursive:true});
  const dest=path.join(target,portableRelease.exe.name),tmp=dest+'.partial';
  // Bounded download with progressive hashing and cleanup on failure.
  await new Promise((resolve,reject)=>{
   let settled=false;const finish=e=>{if(settled)return;settled=true;e?reject(e):resolve();};
   function follow(url,hops){
    if(hops>5)return finish(new Error('Too many download redirects'));
    const u=new URL(url);if(u.protocol!=='https:'||!TRUSTED_DOWNLOAD_HOSTS.has(u.hostname))return finish(new Error('Untrusted asset server'));
    const req=https.get(u,{headers:{'User-Agent':'APEX-Refurb-Studio-Portable-Updater'},timeout:30000},r=>{
     if([301,302,303,307,308].includes(r.statusCode)){const loc=r.headers.location;r.resume();if(!loc)return finish(new Error('Missing redirect'));return follow(new URL(loc,url).href,hops+1);}
     if(r.statusCode!==200){r.resume();return finish(new Error('Download HTTP '+r.statusCode));}
     const out=fs.createWriteStream(tmp);let received=0;
     r.on('data',b=>{received+=b.length;if(received>limit){r.destroy(new Error('Portable update exceeds size limit'));return;}set({progress:Math.min(99,Math.round(received/portableRelease.exe.size*100))});});
     r.on('error',e=>{out.destroy();finish(e)});out.on('error',e=>finish(e));out.on('finish',()=>finish());r.pipe(out);
    });req.on('error',finish);req.on('timeout',()=>req.destroy(new Error('GitHub download timed out')));
   }follow(portableRelease.exe.browser_download_url,0);
  });
  if(fs.statSync(tmp).size!==portableRelease.exe.size)throw new Error('Portable EXE size mismatch');
  const calculated=await new Promise((resolve,reject)=>{const h=crypto.createHash('sha256');const stream=fs.createReadStream(tmp);stream.on('data',x=>h.update(x));stream.on('end',()=>resolve(h.digest('hex')));stream.on('error',reject);});
  if(calculated.toLowerCase()!==hm[1].toLowerCase())throw new Error('Portable EXE checksum mismatch');
  fs.renameSync(tmp,dest);portableExe={file:dest,hash:calculated};
  return {ok:true,...set({state:'ready',progress:100,releases:'Verified portable EXE downloaded. Ready to replace after APEX exits.'})};
 }catch(e){return {ok:false,...set({state:'error',error:String(e.message||e).slice(0,250)})};}
}
function portableInstall(){
 if(data.state!=='ready'||!portableExe||!fs.existsSync(portableExe.file))return {ok:false,error:'Download the verified portable update first.'};
 const current=process.env.PORTABLE_EXECUTABLE_FILE;
 if(!current||!path.isAbsolute(current)||!fs.existsSync(current))return {ok:false,error:'Portable EXE path unavailable; install cancelled.'};
 const helper=path.join(process.resourcesPath,'updater','INSTALL-PORTABLE-UPDATE.ps1');
 if(!fs.existsSync(helper))return {ok:false,error:'Portable update helper missing in this build. Rebuild portable with Step 3 source.'};
 const dir=fs.mkdtempSync(path.join(require('os').tmpdir(),'apex-portable-update-'));
 const ready=path.join(dir,'ready.txt'),failure=path.join(dir,'error.txt');
 let child,done=false,watch,limit;
 const stop=()=>{clearInterval(watch);clearTimeout(limit);};
 const fail=msg=>{if(done)return;done=true;stop();set({state:'error',error:msg,releases:'APEX has remained open. No update installed.'});};
 try{
  child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-Current',current,'-Replacement',portableExe.file,'-ExpectedHash',portableExe.hash,'-ParentPid',String(process.pid),'-Handshake',dir],{detached:true,windowsHide:true,stdio:'ignore'});
  child.on('error',e=>fail('Portable helper failed to start: '+e.message));
  child.on('spawn',()=>{
   child.unref();watch=setInterval(()=>{
    if(done)return;
    if(fs.existsSync(failure))return fail('Portable update preparation failed: '+fs.readFileSync(failure,'utf8').slice(0,350));
    if(fs.existsSync(ready)){done=true;stop();set({state:'installing',releases:'Portable update verified; restarting to apply.'});setTimeout(()=>app.quit(),500);}
   },250);limit=setTimeout(()=>fail('Portable updater did not become ready. APEX stayed open.'),30000);
  });
  child.on('exit',(code)=>{if(!done)setTimeout(()=>{if(!done)fail('Portable update helper exited before ready ('+code+').');},500);});
  return {ok:true,...set({state:'starting-installer',releases:'Preparing portable update safely; APEX is still open.'})};
 }catch(e){return {ok:false,error:'Portable updater could not start: '+e.message};}
}

module.exports={init,status,check,download,install};
