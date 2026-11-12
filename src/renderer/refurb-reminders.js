'use strict';
/* One in-app Parts Awaiting Order notification. Replaces Smart Reminders. */
(function(){
 const $=id=>document.getElementById(id);
 const key='apex.parts-order-notification.frequency.v1';
 const frequencies=[['session','Once each session'],['30m','Every 30 minutes'],['1h','Every hour'],['4h','Every 4 hours'],['24h','Once a day'],['off','Off']];
 let frequency='session',lastShown=0,lastCount=0,closeTimer=null;
 const read=()=>{try{return localStorage.getItem(key)||'session';}catch{return 'session';}};
 const save=value=>{try{localStorage.setItem(key,value);return true;}catch{return false;}};
 const safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 function getSummary(){
  if(!window.ApexWorkflowSnapshot||typeof items==='undefined')return {count:0,older7:0,ids:[]};
  return window.ApexPartsOrderNotice.summary(window.ApexWorkflowSnapshot,items);
 }
 function hide(){
  if(closeTimer){clearTimeout(closeTimer);closeTimer=null;}
  $('apexPartsOrderNotification')?.remove();
 }
 function show(data){
  hide();
  const toast=document.createElement('div');
  toast.id='apexPartsOrderNotification';toast.className='apex-parts-order-notice';
  toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
  const noun=data.count===1?'laptop still has':'laptops still have';
  toast.innerHTML='<span class="apex-parts-order-icon" aria-hidden="true">!</span><div class="apex-parts-order-copy"><strong>Parts awaiting order</strong><p><b>'+data.count+'</b> '+noun+' replacement parts that need ordering.</p>'+(data.older7?'<small>'+data.older7+' waiting longer than 7 days</small>':'')+'</div><div class="apex-parts-order-actions"><button type="button" class="secondary" data-parts-order-view>View parts</button><button type="button" class="apex-parts-order-close" data-parts-order-close aria-label="Dismiss parts ordering notification">×</button></div>';
  document.body.appendChild(toast);
  toast.querySelector('[data-parts-order-view]').onclick=()=>{hide();if(typeof setPage==='function')setPage('parts',true);};
  toast.querySelector('[data-parts-order-close]').onclick=hide;
  closeTimer=setTimeout(hide,10000);
 }
 function check(){
  if(frequency==='off'){hide();return;}
  // Wait until both the signed-in workspace and refurbishment data are ready.
  if(!$('loginPage')?.classList.contains('hidden')||!window.ApexWorkflowSnapshot)return;
  const data=getSummary();
  if(!data.count){hide();return;}
  if(!window.ApexPartsOrderNotice.shouldShow({frequency,lastShown,lastCount,count:data.count}))return;
  lastShown=Date.now();lastCount=data.count;
  show(data);
 }
 function fields(){
  const root=$('apexReminderSettings');if(!root)return;
  root.innerHTML='<div class="apex-parts-notice-settings"><label class="field" for="apexPartsNoticeFrequency"><span>Notification frequency</span><select id="apexPartsNoticeFrequency">'+frequencies.map(([value,label])=>'<option value="'+safe(value)+'">'+safe(label)+'</option>').join('')+'</select></label><p class="apex-reminder-hint">Shows one brief on-screen notification only when replacement parts still need ordering. The reminder appears after sign-in and repeats at your chosen interval while APEX is running. Resprays are excluded.</p><div class="apex-reminder-actions"><button id="apexPartsNoticeSave" class="primary" type="button">Save notification settings</button><span id="apexPartsNoticeSaved" role="status" aria-live="polite"></span></div></div>';
  $('apexPartsNoticeFrequency').value=frequency;
  $('apexPartsNoticeSave').onclick=()=>{
   const choice=$('apexPartsNoticeFrequency').value;
   if(!Object.prototype.hasOwnProperty.call(window.ApexPartsOrderNotice.INTERVALS,choice))return;
   if(!save(choice)){$('apexPartsNoticeSaved').textContent='Unable to save settings on this PC.';return;}
   frequency=choice;
   $('apexPartsNoticeSaved').textContent='Saved on this PC.';
   if(frequency==='off')hide();else check();
  };
 }
 function init(){
  const saved=read();
  frequency=Object.prototype.hasOwnProperty.call(window.ApexPartsOrderNotice.INTERVALS,saved)?saved:'session';
  fields();
  check();
 }
 document.addEventListener('DOMContentLoaded',init,{once:true});
 window.addEventListener('apex:workflow-updated',check);
 window.addEventListener('apex:reminders-refresh',check);
 setInterval(check,60000);
 // Preserve a lightweight read interface for existing read-only integrations.
 window.ApexRefurbReminders=Object.freeze({refresh:check,getAlerts:()=>getSummary().ids.map(id=>({id,category:{type:'ordering'}})),getSettings:()=>({enabled:frequency!=='off',frequency})});
})();
