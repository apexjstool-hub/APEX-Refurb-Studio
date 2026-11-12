'use strict';
/* APEX Smart Reminders: non-destructive, read-only ageing checks and editable local thresholds. */
(function(){
 const defaults={enabled:true,popup:true,attention:7,overdue:14,critical:30,respray:7,repair:7,ordering:3,delivery:10,pallet:14,desktopNotifications:false,keepInTray:false,startWithWindows:false,checkMinutes:15,repeatHours:24};
 const labels={attention:'Attention',overdue:'Overdue',critical:'Critical',respray:'Awaiting respray',repair:'Awaiting repair',ordering:'Parts not ordered',delivery:'Awaiting delivery',pallet:'Pallet inactivity'};
 let settings={...defaults},loaded=false,lastPopupKey='',snoozed=new Map(),lastBackgroundCheck=0,backgroundBusy=false;
 const $=id=>document.getElementById(id);
 const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 function alerts(){
  if(!settings.enabled||!window.ApexWorkflowSnapshot)return [];
  const s=window.ApexWorkflowSnapshot;
  const assets=new Map((typeof items!=='undefined'?items:[]).filter(a=>!a.deletedAt).map(a=>[a.id,a]));
  const summaries=window.ApexInventoryWorkflow?.index(s)||new Map(),now=Date.now();
  const age=value=>{const t=Date.parse(value);return Number.isFinite(t)?Math.max(0,Math.floor((now-t)/86400000)):null;};
  return Object.values(s.jobs||{}).flatMap(job=>{
   const asset=assets.get(job.assetId),summary=summaries.get(job.assetId);
   if(!asset||!summary||['Completed','On Hold'].includes(job.status)||(snoozed.get(job.assetId)||0)>now)return [];
   const parts=summary.parts||[],spray=p=>/respray|re[ -]?spray|paint/i.test(String(p.name||''));
   const unordered=job.partsBoard==='ordered'?[]:parts.filter(p=>!spray(p)&&p.toOrder>0);
   const unsprayed=parts.filter(p=>spray(p)&&p.fitted<p.required);
   const oldest=rows=>{const dates=rows.map(p=>Date.parse(p.createdAt||job.createdAt)).filter(Number.isFinite);return dates.length?age(new Date(Math.min(...dates)).toISOString()):null;};
   let category=null,days=null;
   if(unordered.length){category={type:'ordering',title:'Parts still need ordering',priority:0};days=oldest(unordered);}
   else if(summary.awaitingDelivery>0){category={type:'delivery',title:'Waiting for parts delivery',priority:2};days=age(job.updatedAt||job.createdAt);}
   else if(unsprayed.length){category={type:'respray',title:'Respray not completed',priority:3};days=oldest(unsprayed);}
   else if(summary.toFit>0||['Repair In Progress','Ready for Repair'].includes(job.status)){category={type:'repair',title:'Repair work inactive',priority:4};days=age(job.updatedAt||job.createdAt);}
   if(!category||days===null||days<(settings[category.type]||7))return [];
   return [{id:job.assetId,asset,job,age:days,category,level:days>=settings.critical?'critical':days>=settings.overdue?'overdue':'attention'}];
  }).sort((a,b)=>a.category.priority-b.category.priority||b.age-a.age);
 }
 async function backgroundCheck(force=false){
  if(!loaded||!settings.enabled||!settings.desktopNotifications||!settings.keepInTray||backgroundBusy)return;
  if(!force&&Date.now()-lastBackgroundCheck<settings.checkMinutes*60000)return;
  backgroundBusy=true;lastBackgroundCheck=Date.now();
  try{
   if(typeof refresh==='function')await refresh(true); // existing authenticated inventory read
   await window.ApexOps?.load(true); // existing authenticated workflow read
   const pending=alerts().filter(row=>row.category.type==='ordering').map(row=>({id:row.id,days:row.age}));
   await window.apexInventory?.desktopReminderNotify(pending);
  }catch(err){console.warn('Desktop reminders refresh skipped:',err.message);}
  finally{backgroundBusy=false;}
 }
 function openAssetSafely(id){
  if(window.ApexRefurbWorkspace?.openAsset)window.ApexRefurbWorkspace.openAsset(id);
 }
 function dismiss(id,days){
  snoozed.set(id,Date.now()+days*86400000);draw(); // This snooze is per-session; it never changes asset history or age.
 }
 // Reminders are shown as small, dismissible toasts, never as a Work Queue panel.
 // Suppress repeats for the configured repeat interval and notify immediately
 // when a new asset crosses a threshold.
 const notified=new Map();
 let toastTimer=null;
 function showReminderToast(rows){
  if(!loaded||!settings.enabled||!settings.popup||!rows.length)return;
  const now=Date.now(),repeatMs=Math.max(1,settings.repeatHours)*3600000;
  const pending=rows.filter(r=>{
   const key=r.id+'|'+r.category.type+'|'+r.level;
   return now-(notified.get(key)||0)>=repeatMs;
  });
  if(!pending.length)return;
  for(const row of pending)notified.set(row.id+'|'+row.category.type+'|'+row.level,now);
  // Keep memory bounded even across long-running tray sessions.
  if(notified.size>1200)for(const [key,seen] of notified)if(now-seen>repeatMs*2)notified.delete(key);
  const existing=$('apexReminderToast');if(existing)existing.remove();
  if(toastTimer){clearTimeout(toastTimer);toastTimer=null;}
  const lead=pending[0],count=pending.length,urgent=pending.filter(r=>r.level==='critical').length;
  const toast=document.createElement('div');toast.id='apexReminderToast';
  toast.className='apex-reminder-popup apex-reminder-toast';
  toast.dataset.level=urgent?'critical':lead.level;
  toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
  toast.innerHTML='<div class="apex-reminder-toast-icon" aria-hidden="true">!</div><div class="apex-reminder-toast-copy"><strong>'+escape(count===1?lead.category.title:count+' refurbishment reminders')+'</strong><p>'+escape(count===1?lead.id+' · '+lead.age+' days waiting':lead.id+' · '+lead.category.title+' ('+lead.age+' days)'+(count>1?' · plus '+(count-1)+' other asset'+(count===2?'':'s'):''))+'</p></div><div class="apex-reminder-toast-buttons"><button type="button" class="secondary" data-reminder-open>View</button><button type="button" class="secondary" data-reminder-snooze>Snooze</button><button type="button" class="apex-reminder-toast-dismiss" data-reminder-close aria-label="Dismiss refurbishment notification">×</button></div>';
  document.body.appendChild(toast);
  const close=()=>{if(toastTimer){clearTimeout(toastTimer);toastTimer=null;}toast.remove();};
  toast.querySelector('[data-reminder-close]').onclick=close;
  toast.querySelector('[data-reminder-snooze]').onclick=()=>{for(const row of pending)snoozed.set(row.id,Date.now()+3*86400000);close();};
  toast.querySelector('[data-reminder-open]').onclick=()=>{
   close();
   if(count===1)openAssetSafely(lead.id);
   else if(typeof setPage==='function')setPage('refurbWorkspace',true);
  };
  toastTimer=setTimeout(()=>{toast.remove();toastTimer=null;},12000);
 }
 function draw(){
  // Remove obsolete Work Queue panel left by earlier app versions, including
  // when a Work Queue tab is re-rendered without reload.
  $('apexAgeingAlerts')?.remove();
  const rows=alerts();
  if(!rows.length){$('apexReminderToast')?.remove();if(toastTimer){clearTimeout(toastTimer);toastTimer=null;}return;}
  showReminderToast(rows);
 }
 function fields(){
  const root=$('apexReminderSettings');if(!root)return;
  root.innerHTML='<p class="apex-reminder-hint"><strong>Parts ordering is prioritised:</strong> unordered part requirements count from the date they were first recorded. Editing notes will not reset this timer. In-app notification toasts summarise outstanding refurbishment work without adding a panel to the Work Queue.</p><label class="apex-reminder-toggle"><input type="checkbox" id="apexReminderEnabled"> Enable automatic reminders</label><label class="apex-reminder-toggle"><input type="checkbox" id="apexReminderPopup"> Show refurbishment notification toasts in APEX</label><div class="apex-reminder-grid">'+Object.keys(labels).map(key=>'<label>'+escape(labels[key])+'<span><input type="number" min="1" max="365" step="1" data-apex-days="'+key+'" required> days</span></label>').join('')+'</div><div class="apex-background-settings"><strong>Windows desktop notifications</strong><label class="apex-reminder-toggle"><input type="checkbox" id="apexReminderTray"> Keep APEX running in the system tray when the window is closed</label><label class="apex-reminder-toggle"><input type="checkbox" id="apexReminderDesktop"> Show Windows desktop reminders for unordered parts</label><label class="apex-reminder-toggle"><input type="checkbox" id="apexReminderStartup"> Start APEX with Windows (sign-in may still be required)</label><div class="apex-reminder-grid"><label>Check every <span><input type="number" min="1" max="120" id="apexReminderCheckMinutes"> minutes</span></label><label>Repeat reminder after <span><input type="number" min="1" max="168" id="apexReminderRepeatHours"> hours</span></label></div><p class="apex-reminder-hint">Desktop reminders work while APEX is running and you are signed in. Closing the window keeps it in the tray when enabled; Exit APEX completely in the tray menu stops notifications. Windows sign-in may require you to open APEX and log in.</p></div><p class="apex-reminder-hint">Set the day limits separately for each type of work (1–365 days). Attention must be less than Overdue, and Overdue less than Critical. Changes apply immediately after saving.</p><div class="apex-reminder-actions"><button id="apexReminderSave" class="primary" type="button">Save reminder settings</button><span id="apexReminderResult" role="status" aria-live="polite"></span></div>';
  $('apexReminderEnabled').checked=settings.enabled;$('apexReminderPopup').checked=settings.popup;
  $('apexReminderTray').checked=settings.keepInTray;$('apexReminderDesktop').checked=settings.desktopNotifications;$('apexReminderStartup').checked=settings.startWithWindows;
  $('apexReminderCheckMinutes').value=settings.checkMinutes;$('apexReminderRepeatHours').value=settings.repeatHours;
  $('apexReminderDesktop').onchange=()=>{if($('apexReminderDesktop').checked)$('apexReminderTray').checked=true;};
  $('apexReminderStartup').onchange=()=>{if($('apexReminderStartup').checked)$('apexReminderTray').checked=true;};
  for(const [key,val] of Object.entries(settings))if(typeof val==='number'){const el=root.querySelector('[data-apex-days="'+key+'"]');if(el)el.value=val;}
  $('apexReminderSave').onclick=save;
 }
 async function save(){
  const next={enabled:$('apexReminderEnabled').checked,popup:$('apexReminderPopup').checked,keepInTray:$('apexReminderTray').checked,desktopNotifications:$('apexReminderDesktop').checked,startWithWindows:$('apexReminderStartup').checked,checkMinutes:Number($('apexReminderCheckMinutes').value),repeatHours:Number($('apexReminderRepeatHours').value)};
  if((next.desktopNotifications||next.startWithWindows)&&!next.keepInTray){$('apexReminderResult').textContent='Enable tray mode to use desktop reminders or Windows startup.';return;}
  if(!Number.isInteger(next.checkMinutes)||next.checkMinutes<1||next.checkMinutes>120||!Number.isInteger(next.repeatHours)||next.repeatHours<1||next.repeatHours>168){$('apexReminderResult').textContent='Check interval must be 1–120 minutes; repeat interval 1–168 hours.';return;}
  for(const key of Object.keys(labels)){const value=$('apexReminderSettings').querySelector('[data-apex-days="'+key+'"]').value;next[key]=Number(value);if(!/^[0-9]+$/.test(value)||next[key]<1||next[key]>365){$('apexReminderResult').textContent='Enter whole numbers between 1 and 365.';return;}}
  if(!(next.attention<next.overdue&&next.overdue<next.critical)){$('apexReminderResult').textContent='Reminder levels must increase from Attention to Overdue to Critical.';return;}
  try{const result=await window.apexInventory.saveReminderSettings(next);if(!result?.ok)throw Error(result?.error||'Unable to save. Unlock Admin Centre first.');settings={...defaults,...result.settings};loaded=true;lastBackgroundCheck=0;$('apexReminderResult').textContent='Saved successfully';draw();window.ApexRefurbWorkspace?.draw();backgroundCheck(true);}
  catch(e){$('apexReminderResult').textContent=e.message||'Unable to save reminder settings.';}
 }
 async function init(){
  if(!window.apexInventory?.reminderSettings)return;
  try{const result=await window.apexInventory.reminderSettings();if(result?.ok){settings={...defaults,...result.settings};loaded=true;}}
  catch(e){console.warn('Reminder settings unavailable',e);}
  fields();draw();backgroundCheck(true);
 }
 document.addEventListener('DOMContentLoaded',init);
 window.addEventListener('apex:workflow-updated',draw);
 window.addEventListener('apex:reminders-refresh',draw);
 const heartbeat=setInterval(()=>{draw();backgroundCheck();},60000);
 window.addEventListener('apex:workflow-updated',()=>{if(loaded&&settings.desktopNotifications&&Date.now()-lastBackgroundCheck>=settings.checkMinutes*60000)backgroundCheck();});
 window.ApexRefurbReminders=Object.freeze({refresh:draw,getAlerts:alerts,getSettings:()=>({...settings})});
})();
