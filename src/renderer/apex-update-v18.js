(() => {
 'use strict';
 const el=id=>document.getElementById(id), api=window.apexInventory;
 const check=el('apexUpdateCheck'),download=el('apexUpdateDownload'),install=el('apexUpdateInstall');
 if(!check||!api?.updateStatus)return;
 const labels={idle:'Idle',unsupported:'Installer required',checking:'Checking…',current:'Up to date',available:'Update available',downloading:'Downloading…',ready:'Ready to install',installing:'Applying update…', 'starting-installer':'Preparing update…',error:'Check failed'};
 function draw(s){if(!s)return;el('apexUpdateBadge').textContent=labels[s.state]||s.state;download.disabled=s.state!=='available';install.disabled=s.state!=='ready';
  const msg={unsupported:'Portable EXE updating is not enabled yet. Install the NSIS version for public updates.',current:s.mode==='development'?'No GitHub development prerelease was found. Publish an APEX-Studio-DEV-*.zip as a prerelease first.':'Version '+s.currentVersion+' is up to date.',available:(s.mode==='development'?'GitHub development test ':'Version ')+s.availableVersion+' is available. Download it when ready.',ready:s.mode==='development'?'GitHub update downloaded. Click Install to back up and update this Management Studio folder.':'Download complete. Save your work before restarting.',checking:'Contacting GitHub…',downloading:'Downloading update '+(s.progress||0)+'%…',error:s.error||'Unable to check for updates.',installing:s.mode==='development'?'Update prepared. Closing Management Studio to apply the verified files.':'Installing update…','starting-installer':'Verifying files and creating backup; APEX will stay open until ready.'};
  el('apexUpdateMessage').textContent=msg[s.state]||'Installed version: '+s.currentVersion;
 }
 api.onUpdateState?.(draw);api.updateStatus().then(draw).catch(()=>{});
 for(const [button,fn] of [[check,'updateCheck'],[download,'updateDownload'],[install,'updateInstall']])button.addEventListener('click',async()=>{button.disabled=true;try{const r=await api[fn]();if(r?.ok===false)el('apexUpdateMessage').textContent=r.error||'Action failed.';else draw(r);}catch(e){el('apexUpdateMessage').textContent='Update action failed.';}finally{if(fn!=='updateInstall')api.updateStatus().then(draw).catch(()=>{});}});
})();
