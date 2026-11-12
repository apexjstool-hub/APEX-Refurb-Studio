'use strict';
/* APEX Smart Reminders: non-destructive, read-only ageing checks and editable local thresholds. */
(function(){
 const defaults={enabled:true,popup:true,attention:7,overdue:14,critical:30,respray:7,repair:7,ordering:3,delivery:10,pallet:14};
 const labels={attention:'Attention',overdue:'Overdue',critical:'Critical',respray:'Awaiting respray',repair:'Awaiting repair',ordering:'Parts not ordered',delivery:'Awaiting delivery',pallet:'Pallet inactivity'};
 let settings={...defaults},loaded=false,lastPopupKey='',snoozed=new Map();
 const $=id=>document.getElementById(id);
 const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const daysSince=value=>{const t=Date.parse(value);return Number.isFinite(t)?Math.max(0,Math.floor((Date.now()-t)/86400000)):null;};
 const spray=name=>/respray|re[ -]?spray|paint/i.test(String(name||''));
 function severity(days,threshold){
  if(days===null||days<threshold)return '';
  return days>=settings.critical?'critical':days>=settings.overdue?'overdue':'attention';
 }
 function classify(job,summary){
  if(['Completed','On Hold'].includes(job.status))return null;
  if(summary?.needsOrdering>0)return {type:'ordering',title:'Parts not ordered'};
  if(summary?.awaitingDelivery>0)return {type:'delivery',title:'Awaiting delivery'};
  if(summary?.sprayOutstanding||job.parts?.some(p=>spray(p.name)&&Number(p.fitted||0)<Number(p.qty||0)))return {type:'respray',title:'Awaiting respray'};
  if(summary?.toFit>0||['Repair In Progress','Ready for Repair'].includes(job.status))return {type:'repair',title:'Awaiting repair'};
  return {type:'attention',title:'Refurbishment pending'};
 }
 function alerts(){
  if(!settings.enabled||!window.ApexWorkflowSnapshot)return [];
  const s=window.ApexWorkflowSnapshot,assets=new Map((typeof items!=='undefined'?items:[]).filter(a=>!a.deletedAt).map(a=>[a.id,a]));
  const summaries=window.ApexInventoryWorkflow?.index(s)||new Map();
  return Object.values(s.jobs||{}).flatMap(job=>{
   const asset=assets.get(job.assetId);if(!asset)return [];
   const category=classify(job,summaries.get(job.assetId));if(!category)return [];
   // No stage timestamp exists in old records. Use the last job update as the
   // conservative, verifiable ageing anchor rather than inventing a stage date.
   const age=daysSince(job.updatedAt||job.createdAt),limit=settings[category.type]||settings.attention;
   if(age===null||age<limit)return [];
   if((snoozed.get(job.assetId)||0)>Date.now())return [];
   return [{id:job.assetId,asset,job,age,category,level:severity(age,limit)}];
  }).sort((a,b)=>b.age-a.age);
 }
 function openAssetSafely(id){
  if(window.ApexRefurbWorkspace?.openAsset)window.ApexRefurbWorkspace.openAsset(id);
 }
 function dismiss(id,days){
  snoozed.set(id,Date.now()+days*86400000);draw(); // This snooze is per-session; it never changes asset history or age.
 }
 function showStartupSummary(rows){
  if(!loaded||!settings.enabled||!settings.popup||!rows.length||lastPopupKey)return;
  lastPopupKey='shown';
  const toast=document.createElement('div');toast.className='apex-reminder-popup';toast.setAttribute('role','status');
  toast.innerHTML='<div><strong>Outstanding refurbishment reminders</strong><p>'+rows.length+' jobs need attention. Open the refurbishment queue to review them.</p></div><button type="button" class="secondary">Dismiss</button>';
  document.body.appendChild(toast);
  toast.querySelector('button').onclick=()=>toast.remove();
 }
 function draw(){
  const root=$('refurbWorkspacePage');if(!root||!settings.enabled)return;
  let panel=$('apexAgeingAlerts');if(!panel){panel=document.createElement('section');panel.id='apexAgeingAlerts';panel.className='apex-ageing-alerts';panel.setAttribute('aria-label','Outstanding refurbishment reminders');const anchor=$('rwQueueSummary');if(anchor)anchor.before(panel);}
  if(!panel)return;
  const rows=alerts();panel.hidden=!rows.length;showStartupSummary(rows);
  if(!rows.length)return;
  const n=rows.filter(r=>r.level==='critical').length;
  panel.innerHTML='<div class="apex-ageing-head"><div><strong>⏰ Smart refurbishment reminders</strong><p>'+rows.length+' outstanding jobs require attention'+(n?' · '+n+' critical':'')+'. Age is counted from the last recorded job update.</p></div><button class="secondary" type="button" data-apex-toggle>Show '+Math.min(rows.length,10)+' alerts</button></div><div class="apex-ageing-list" hidden>'+rows.slice(0,10).map(r=>'<div class="apex-ageing-item"><div><b>'+escape(r.id)+'</b> <span class="apex-age-pill '+escape(r.level)+'">'+escape(r.age)+' days · '+escape(r.category.title)+'</span><small>'+escape([r.asset.manufacturer,r.asset.model,r.asset.pallet||r.asset.location].filter(Boolean).join(' · '))+'</small></div><div class="apex-age-actions"><button type="button" class="secondary" data-apex-open="'+escape(r.id)+'">View asset</button><button type="button" class="secondary" data-apex-snooze="'+escape(r.id)+'">Snooze 3 days</button></div></div>').join('')+'</div>';
  panel.querySelector('[data-apex-toggle]').onclick=()=>{const list=panel.querySelector('.apex-ageing-list');list.hidden=!list.hidden;};
  panel.querySelectorAll('[data-apex-open]').forEach(b=>b.onclick=()=>openAssetSafely(b.dataset.apexOpen));
  panel.querySelectorAll('[data-apex-snooze]').forEach(b=>b.onclick=()=>dismiss(b.dataset.apexSnooze,3));
 }
 function fields(){
  const root=$('apexReminderSettings');if(!root)return;
  root.innerHTML='<label class="apex-reminder-toggle"><input type="checkbox" id="apexReminderEnabled"> Enable automatic reminders</label><label class="apex-reminder-toggle"><input type="checkbox" id="apexReminderPopup"> Show a reminder summary when APEX opens</label><div class="apex-reminder-grid">'+Object.keys(labels).map(key=>'<label>'+escape(labels[key])+'<span><input type="number" min="1" max="365" step="1" data-apex-days="'+key+'" required> days</span></label>').join('')+'</div><p class="apex-reminder-hint">Set the day limits separately for each type of work (1–365 days). Attention must be less than Overdue, and Overdue less than Critical. Changes apply immediately after saving.</p><div class="apex-reminder-actions"><button id="apexReminderSave" class="primary" type="button">Save reminder settings</button><span id="apexReminderResult" role="status" aria-live="polite"></span></div>';
  $('apexReminderEnabled').checked=settings.enabled;$('apexReminderPopup').checked=settings.popup;
  for(const [key,val] of Object.entries(settings))if(typeof val==='number'){const el=root.querySelector('[data-apex-days="'+key+'"]');if(el)el.value=val;}
  $('apexReminderSave').onclick=save;
 }
 async function save(){
  const next={enabled:$('apexReminderEnabled').checked,popup:$('apexReminderPopup').checked};
  for(const key of Object.keys(labels)){const value=$('apexReminderSettings').querySelector('[data-apex-days="'+key+'"]').value;next[key]=Number(value);if(!/^[0-9]+$/.test(value)||next[key]<1||next[key]>365){$('apexReminderResult').textContent='Enter whole numbers between 1 and 365.';return;}}
  if(!(next.attention<next.overdue&&next.overdue<next.critical)){$('apexReminderResult').textContent='Reminder levels must increase from Attention to Overdue to Critical.';return;}
  try{const result=await window.apexInventory.saveReminderSettings(next);if(!result?.ok)throw Error(result?.error||'Unable to save. Unlock Admin Centre first.');settings=result.settings;loaded=true;$('apexReminderResult').textContent='Saved successfully';draw();window.ApexRefurbWorkspace?.draw();}
  catch(e){$('apexReminderResult').textContent=e.message||'Unable to save reminder settings.';}
 }
 async function init(){
  if(!window.apexInventory?.reminderSettings)return;
  try{const result=await window.apexInventory.reminderSettings();if(result?.ok){settings={...defaults,...result.settings};loaded=true;}}
  catch(e){console.warn('Reminder settings unavailable',e);}
  fields();draw();
 }
 document.addEventListener('DOMContentLoaded',init);
 window.addEventListener('apex:workflow-updated',draw);
 window.addEventListener('apex:reminders-refresh',draw);
 window.ApexRefurbReminders=Object.freeze({refresh:draw,getAlerts:alerts,getSettings:()=>({...settings})});
})();
