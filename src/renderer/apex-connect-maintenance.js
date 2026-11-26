'use strict';
/* Settings-only APEX Connect retention controls. No local secrets or direct DB access. */
(()=>{
 const api=window.apexInventory;
 const panel=document.getElementById('apexConnectMaintenance');
 if(!panel||!api?.connectMaintenanceStatus)return;
 const $=id=>document.getElementById(id);
 const state=$('apexConnectMaintenanceStatus');
 const enabled=$('apexConnectRetentionEnabled'),days=$('apexConnectRetentionDays');
 const save=$('apexConnectMaintenanceSave'),run=$('apexConnectMaintenanceRun'),refresh=$('apexConnectMaintenanceRefresh');
 let current={enabled:false,retentionDays:90},loading=false;
 const note=(message,error=false)=>{state.textContent=message;state.classList.toggle('apex-connect-maintenance-error',error);};
 const busy=v=>{loading=v;save.disabled=v;run.disabled=v;refresh.disabled=v;};
 const date=v=>v?new Date(v).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'Never';
 const show=data=>{
  current={enabled:!!data.enabled,retentionDays:Number(data.retentionDays)||90};
  enabled.checked=current.enabled;days.value=String(current.retentionDays);
  $('apexConnectMaintenanceCount').textContent='Messages: '+Number(data.messageCount||0).toLocaleString('en-GB');
  $('apexConnectMaintenanceBytes').textContent='Table storage: '+(Number(data.storageBytes||0)/1024).toFixed(1)+' KB (including indexes)';
  $('apexConnectMaintenanceLast').textContent='Last cleanup: '+date(data.lastRunAt)+' · Last removed: '+Number(data.lastDeleted||0)+' · Total removed: '+Number(data.deletedTotal||0);
  note(current.enabled?'Automatic cleanup is enabled · '+current.retentionDays+'-day retention.':'Automatic cleanup is disabled · messages will not be deleted by the daily schedule.');
 };
 const load=async()=>{
  if(loading)return;busy(true);note('Checking cloud message maintenance…');
  try{const result=await api.connectMaintenanceStatus();if(!result?.ok)note(result?.error||'Unable to read messaging settings.',true);else show(result);}
  catch{note('Unable to contact cloud messaging maintenance.',true);}finally{busy(false);}
 };
 refresh.addEventListener('click',load);
 $('apexConnectTestNotification')?.addEventListener('click',()=>{
  if(window.ApexConnect?.testNotification?.())note('Notification test shown in the top header. The red unread badge will return to its real value automatically.');
  else note('Sign into APEX to preview the message notification.',true);
 });
 save.addEventListener('click',async()=>{
  if(loading)return;
  const chosen=Number(days.value),on=enabled.checked;
  if(on&&!current.enabled&&!confirm('Enable automatic deletion of APEX Connect messages older than '+chosen+' days? Deleted messages cannot be recovered from chat.'))return;
  if(current.enabled&&on&&chosen<current.retentionDays&&!confirm('Shorten message retention to '+chosen+' days? More old messages may be deleted by the next cleanup.'))return;
  busy(true);note('Saving retention settings…');
  try{
   const result=await api.connectMaintenanceSave({enabled:on,days:chosen});
   if(!result?.ok)note(result?.error||'Unable to save retention settings. Unlock Settings and try again.',true);
   else show(result);
  }catch{note('Failed to save cloud retention settings.',true);}finally{busy(false);}
 });
 run.addEventListener('click',async()=>{
  if(loading)return;
  if(!confirm('Permanently delete up to 500 APEX Connect messages older than the SAVED '+current.retentionDays+'-day retention period? This cannot be undone.'))return;
  busy(true);note('Cleaning expired messages…');
  try{
   const result=await api.connectMaintenanceRun();
   if(!result?.ok){note(result?.error||'Cleanup failed.',true);return;}
   const fresh=await api.connectMaintenanceStatus();
   if(fresh?.ok){show(fresh);note('Cleanup complete · '+Number(result.deleted||0)+' expired messages removed.');}
   else note('Cleanup complete · '+Number(result.deleted||0)+' removed. Refresh statistics to confirm.');
   window.ApexConnect?.refresh?.();
  }catch{note('Cleanup failed. No other APEX data was changed.',true);}finally{busy(false);}
 });
 let previousVisible=false;
 setInterval(()=>{
  const visible=!document.getElementById('settingsPage')?.classList.contains('hidden')&&!document.getElementById('appPage')?.classList.contains('hidden');
  if(visible&&!previousVisible)load();
  previousVisible=visible;
 },1500);
})();
