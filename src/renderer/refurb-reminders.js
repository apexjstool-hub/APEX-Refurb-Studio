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
 function showStartupSummary(rows){
  const urgent=rows.filter(row=>row.category.type==='ordering');
  if(!loaded||!settings.enabled||!settings.popup||!urgent.length||lastPopupKey)return;
  lastPopupKey='shown';
  const toast=document.createElement('div');toast.className='apex-reminder-popup';toast.setAttribute('role','status');
  toast.innerHTML='<div><strong>Parts ordering reminders</strong><p>'+urgent.length+' devices are waiting for replacement parts to be ordered. Open Refurbishment to review them.</p></div><button type="button" class="secondary">Dismiss</button>';
  document.body.appendChild(toast);
  toast.querySelector('button').onclick=()=>toast.remove();
 }
 function draw(){
  const root=$('refurbWorkspacePage');if(!root)return;
  let panel=$('apexAgeingAlerts');if(!panel){panel=document.createElement('section');panel.id='apexAgeingAlerts';panel.className='apex-ageing-alerts';panel.setAttribute('aria-label','Outstanding refurbishment reminders');const anchor=$('rwQueueSummary');if(anchor)anchor.before(panel);}
  if(!panel)return;
  const rows=alerts();panel.hidden=!rows.length;showStartupSummary(rows);
  if(!rows.length)return;
  const n=rows.filter(r=>r.level==='critical').length,unplaced=rows.filter(r=>r.category.type==='ordering').length;
  panel.innerHTML='<div class="apex-ageing-head"><div><strong>⏰ Inactive refurbishment reminders</strong><p>'+unplaced+' devices still need parts ordered · '+rows.length+' total flagged'+(n?' · '+n+' critical':'')+'. Parts ordering age starts when a requirement was recorded.</p></div><button class="secondary" type="button" data-apex-toggle>Show '+Math.min(rows.length,10)+' alerts</button></div><div class="apex-ageing-list" hidden>'+rows.slice(0,10).map(r=>'<div class="apex-ageing-item"><div><b>'+escape(r.id)+'</b> <span class="apex-age-pill '+escape(r.level)+'">'+escape(r.age)+' days · '+escape(r.category.title)+'</span><small>'+escape([r.asset.manufacturer,r.asset.model,r.asset.pallet||r.asset.location].filter(Boolean).join(' · '))+'</small></div><div class="apex-age-actions"><button type="button" class="secondary" data-apex-open="'+escape(r.id)+'">View asset</button><button type="button" class="secondary" data-apex-snooze="'+escape(r.id)+'">Snooze 3 days</button></div></div>').join('')+'</div>';
  panel.querySelector('[data-apex-toggle]').onclick=()=>{const list=panel.querySelector('.apex-ageing-list');list.hidden=!list.hidden;};
  panel.querySelectorAll('[data-apex-open]').forEach(b=>b.onclick=()=>openAssetSafely(b.dataset.apexOpen));
  panel.querySelectorAll('[data-apex-snooze]').forEach(b=>b.onclick=()=>dismiss(b.dataset.apexSnooze,3));
 }
 function fields(){
  const root=$('apexReminderSettings');if(!root)return;
  root.innerHTML='<p class="apex-reminder-hint"><strong>Parts ordering is prioritised:</strong> unordered part requirements count from the date they were first recorded. Editing notes will not reset this timer. Startup popups focus on un-ordered parts; other active jobs appear in the Work Queue.</p><label class="apex-reminder-toggle"><input type="checkbox" id="apexReminderEnabled"> Enable automatic reminders</label><label class="apex-reminder-toggle"><input type="checkbox" id="apexReminderPopup"> Show a reminder summary when APEX opens</label><div class="apex-reminder-grid">'+Object.keys(labels).map(key=>'<label>'+escape(labels[key])+'<span><input type="number" min="1" max="365" step="1" data-apex-days="'+key+'" required> days</span></label>').join('')+'</div><div class="apex-background-settings"><strong>Windows desktop notifications</strong><label class="apex-reminder-toggle"><input type="checkbox" id="apexReminderTray"> Keep APEX running in the system tray when the window is closed</label><label class="apex-reminder-toggle"><input type="checkbox" id="apexReminderDesktop"> Show Windows desktop reminders for unordered parts</label><label class="apex-reminder-toggle"><input type="checkbox" id="apexReminderStartup"> Start APEX with Windows (sign-in may still be required)</label><div class="apex-reminder-grid"><label>Check every <span><input type="number" min="1" max="120" id="apexReminderCheckMinutes"> minutes</span></label><label>Repeat reminder after <span><input type="number" min="1" max="168" id="apexReminderRepeatHours"> hours</span></label></div><p class="apex-reminder-hint">Desktop reminders work while APEX is running and you are signed in. Closing the window keeps it in the tray when enabled; Exit APEX completely in the tray menu stops notifications. Windows sign-in may require you to open APEX and log in.</p></div><p class="apex-reminder-hint">Set the day limits separately for each type of work (1–365 days). Attention must be less than Overdue, and Overdue less than Critical. Changes apply immediately after saving.</p><div class="apex-reminder-actions"><button id="apexReminderSave" class="primary" type="button">Save reminder settings</button><span id="apexReminderResult" role="status" aria-live="polite"></span></div>';
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
 const heartbeat=setInterval(()=>backgroundCheck(),60000);
 window.addEventListener('apex:workflow-updated',()=>{if(loaded&&settings.desktopNotifications&&Date.now()-lastBackgroundCheck>=settings.checkMinutes*60000)backgroundCheck();});
 window.ApexRefurbReminders=Object.freeze({refresh:draw,getAlerts:alerts,getSettings:()=>({...settings})});
})();
