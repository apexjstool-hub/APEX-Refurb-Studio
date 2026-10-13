'use strict';
/** Status is based on recent authenticated requests, never inferred from approvals alone. */
(function(){
 const el=id=>document.getElementById(id),api=window.apexInventory;
 if(!el('reliabilityPanel'))return;
 let busy=false;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const stamp=v=>{
  if(!v)return 'Never';const n=Number(v)||Date.parse(v);
  return Number.isFinite(n)&&n>0?new Date(n).toLocaleString():'Unknown';
 };
 const badge=(id,label,kind='')=>{el(id).textContent=label;el(id).className='reliability-badge '+kind;};
 async function refreshReliability(){
  if(busy||el('settingsPage').classList.contains('hidden')||el('appPage').classList.contains('hidden'))return;
  busy=true;el('reliabilityRefresh').disabled=true;
  try{
   if(typeof api.backupStatus!=='function'){
    el('reliabilityBackupLast').textContent='Backup controls require the updated Windows Studio.';
    el('reliabilityBackupNow').disabled=true;el('reliabilityOpenFolder').disabled=true;
    badge('reliabilityBackupBadge','Not available','warning');
   }else{
    const b=await api.backupStatus();
    if(!b.ok){badge('reliabilityBackupBadge','Check failed','warning');el('reliabilityBackupLast').textContent=b.error||'Could not check backups';el('reliabilityBackupInfo').textContent='Check your Hub connection, then refresh.';}
    else{
     const lastAge=b.last?Date.now()-Date.parse(b.last.at):Infinity;
     badge('reliabilityBackupBadge',lastAge<36*60*60*1000?'Backup recent':'Backup overdue',lastAge<36*60*60*1000?'good':'warning');
     el('reliabilityBackupLast').textContent=b.last?'Last backup: '+stamp(b.last.at):'No successful backups recorded';
     el('reliabilityBackupInfo').textContent=(b.storage==='hub'?'Stored on the shared Hub PC':'Stored on this PC')+' · Daily automatic backup · '+(b.count||0)+' snapshots (max 14) · Folder: '+(b.directory||'Unavailable');
     el('reliabilityOpenFolder').disabled=b.storage==='hub';
     el('reliabilityOpenFolder').title=b.storage==='hub'?'Backups are on the hub PC': 'Open local backup directory';
    }
   }
   if(typeof api.deviceHealth!=='function'){
    badge('reliabilityHubBadge','Not available','warning');el('reliabilityHubInfo').textContent='Hub monitoring requires the updated Windows Studio.';
   }else{
    const result=await api.deviceHealth();
    if(!result.ok){badge('reliabilityHubBadge','Hub unreachable','warning');el('reliabilityHubInfo').textContent=result.error||'No reply from shared hub';el('reliabilityDeviceList').innerHTML='';}
    else if(result.mode==='local'){
     badge('reliabilityHubBadge','Local mode');el('reliabilityHubInfo').textContent='No shared hub configured. '+(result.message||'');el('reliabilityDeviceList').innerHTML='';
    }else{
     const devices=result.devices||[],approved=devices.filter(d=>d.approved);
     badge('reliabilityHubBadge','Hub responding','good');
     el('reliabilityHubInfo').textContent=approved.length+' approved device'+(approved.length===1?'':'s')+' · These times show actual hub requests, not live presence.';
     el('reliabilityDeviceList').innerHTML=devices.length?devices.slice().sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0)).slice(0,8).map(d=>{
      const recent=d.lastSeen&&Date.now()-Number(d.lastSeen)<10*60*1000;
      const reportRecent=d.lastQueueReportAt&&Date.now()-Number(d.lastQueueReportAt)<15*60*1000;
      const reported=d.pendingCount!==null&&d.pendingCount!==undefined;
      const queueText=reported?'Last reported queue: '+Number(d.pendingCount)+' pending'+(d.attentionCount?' · '+Number(d.attentionCount)+' need attention':'')+(reportRecent?'':' (stale)'):'Queue not reported yet';
      return '<div class="reliability-device"><div><span>'+escape(d.label||d.scope)+'</span><br><small>'+escape(d.scope==='diagnostics'?'Diagnostics':'RefurbFlow')+' · '+(d.approved?(recent?'Recently seen':'Not recently seen'):'Awaiting approval')+'</small></div><small>'+escape(queueText)+'<br>Queue report: '+escape(stamp(d.lastQueueReportAt))+'<br>Last contact: '+escape(stamp(d.lastSeen))+(d.lastImportedAt?'<br>Last import: '+escape(stamp(d.lastImportedAt)):'')+(d.lastErrorAt?'<br>Last failed import: '+escape(stamp(d.lastErrorAt))+' — '+escape(d.lastError||'Rejected'):'')+'</small></div>';
     }).join(''):'<p class="reliability-muted">No individually registered devices yet. Older clients using shared tokens cannot be identified individually.</p>';
    }
   }
  }catch(e){el('reliabilityMessage').textContent='Unable to refresh all statuses. Check your network connection.';}
  finally{busy=false;el('reliabilityRefresh').disabled=false;}
 }
 el('reliabilityRefresh').onclick=refreshReliability;
 el('reliabilityBackupNow').onclick=async()=>{
  const button=el('reliabilityBackupNow');button.disabled=true;button.textContent='Backing up…';
  try{
   const result=await api.backupNow();
   el('reliabilityMessage').textContent=result.ok?'Backup completed and verified. Stored on the '+(result.backup?.directory||'inventory computer')+'.':(result.error||'Backup failed. No existing backup was deleted.');
   await refreshReliability();
  }catch(e){el('reliabilityMessage').textContent='Backup failed. Check disk space and folder permissions.';}
  finally{button.disabled=false;button.textContent='Back up now';}
 };
 el('reliabilityOpenFolder').onclick=async()=>{
  if(typeof api.backupFolder!=='function')return;
  const r=await api.backupFolder();if(!r.ok)el('reliabilityMessage').textContent=r.error||'Could not open backup folder.';
 };
 el('v3Settings')?.addEventListener('click',()=>setTimeout(refreshReliability,50));
 document.querySelectorAll('.menu-item[data-page="settings"]').forEach(e=>e.addEventListener('click',()=>setTimeout(refreshReliability,50)));
 setInterval(()=>{if(!el('settingsPage').classList.contains('hidden'))refreshReliability();},30000);
})();
