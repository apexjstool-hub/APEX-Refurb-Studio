'use strict';
(function(root){
 const $=id=>document.getElementById(id),P=root.ApexMessageNoticePreferences,key=P.key;
 let prefs=P.read(localStorage),timer=null,previewTimer=null,closedAt=null,unread=null,openUnread=null,signature='';
 const active=()=>root.ApexNotificationSession?.active()===true;
 function remove(preview=false){if(preview){clearTimeout(previewTimer);previewTimer=null;$('apexMessagePopupPreview')?.remove();}else{clearTimeout(timer);timer=null;$('apexMessagePopup')?.remove();signature='';}}
 function dismiss(){remove();if(unread?.count)closedAt=Date.now();}
 function hide(){remove();unread=null;openUnread=null;closedAt=null;}
 function reset(){hide();remove(true);}
 function position(card){
  const bar=document.querySelector?.('#appPage .topbar');
  const rect=bar?.getBoundingClientRect();
  if(rect&&rect.height>0)card.style.setProperty('--apex-message-top',Math.ceil(rect.bottom+10)+'px');
 }
 function reposition(){for(const id of ['apexMessagePopup','apexMessagePopupPreview']){const card=$(id);if(card)position(card);}}
 root.addEventListener('resize',reposition);
 document.addEventListener('scroll',reposition,{capture:true,passive:true});
 const bar=document.querySelector?.('#appPage .topbar');
 if(bar&&typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(reposition);observer.observe(bar);}
 function arm(preview,p){
  if(preview){clearTimeout(previewTimer);previewTimer=null;}else{clearTimeout(timer);timer=null;}
  const duration=P.delay(p);
  if(duration!==null){if(preview)previewTimer=setTimeout(()=>remove(true),duration);else timer=setTimeout(dismiss,duration);}
 }
 function paint(card,data,p,preview=false){
  card.querySelector('[data-notice-title]').textContent=data.count+' unread message'+(data.count===1?'':'s');
  const sender=card.querySelector('[data-notice-senders]');
  if(p.senders){sender.textContent='From '+data.senders.join(', ')+(data.extra?' and '+data.extra+' more':'');}else sender.textContent='Open APEX Connect to view your messages.';
  card.querySelector('[data-notice-hint]').textContent=preview?'Example notification':p.mode==='manual'?'Until closed':p.mode==='read'?'Until read':'Just now';
 }
 function render(data,onOpen,preview=false,p=prefs){
  if(!active()||(!p.enabled&&!preview)||!data?.count)return false;
  if(preview&&$('apexMessagePopup'))return false;
  if(!preview){
   remove(true);
   const existing=$('apexMessagePopup');
   if(existing){paint(existing,data,p);signature=JSON.stringify(data);closedAt=null;position(existing);arm(false,p);return true;}
  }
  remove(preview);
  const card=document.createElement('section');card.id=preview?'apexMessagePopupPreview':'apexMessagePopup';card.className='apex-message-popup';card.setAttribute('role','status');card.setAttribute('aria-live','polite');
  card.innerHTML='<div class="apex-message-popup-top"><span class="apex-message-popup-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.6-4.2A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 10h8M8 14h5"/></svg></span><div class="apex-message-popup-copy"><small>APEX CONNECT</small><strong data-notice-title></strong><p data-notice-senders></p></div><button type="button" class="apex-message-popup-close" aria-label="Dismiss message notification"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><div class="apex-message-popup-actions"><small data-notice-hint></small><button type="button" class="primary apex-message-popup-open">Open messages</button></div>';
  paint(card,data,p,preview);
  const open=card.querySelector('.apex-message-popup-open');open.hidden=false;
  open.onclick=()=>{if(preview){remove(true);return;}if(!active()){reset();return;}if(prefs.mode!=='read')dismiss();openUnread?.();};
  card.querySelector('.apex-message-popup-close').onclick=()=>preview?remove(true):dismiss();
  $('appPage').appendChild(card);position(card);
  if(!preview){signature=JSON.stringify(data);closedAt=null;}
  arm(preview,p);
  return true;
 }
 function show(data,onOpen,preview=false,options={}){
  if(!active())return false;
  if(preview)return render(data,null,true,options.preferences||prefs);
  unread=data;openUnread=onOpen;
  if(!data?.count){hide();return false;}
  if(!prefs.enabled)return false;
  if(options.initial&&!prefs.atSignIn){closedAt=null;return false;}
  return render(data,onOpen);
 }
 // Called only with authoritative unread snapshots from the existing messaging poll.
 function sync(data,onOpen){
  if(!active()){reset();return;}
  if(!data?.count){hide();return;}
  unread=data;openUnread=onOpen;
  if(!prefs.enabled){remove();return;}
  const card=$('apexMessagePopup');
  if(card){const next=JSON.stringify(data);if(next!==signature){paint(card,data,prefs);signature=next;}return;}
  if(document.visibilityState!=='hidden'&&P.repeatDue(prefs,closedAt,Date.now()))render(data,onOpen);
 }
 function settings(){
  const panel=$('apexMessageNotificationSettings');if(!panel)return;
  const card=document.createElement('div');card.className='apex-message-notice-settings';
  card.innerHTML='<div class="apex-notice-controls"><label class="apex-notice-toggle"><input type="checkbox" id="apexMessagePopupEnabled"> <span><strong>Show message popups</strong><small>Private notifications after sign-in only.</small></span></label><label class="apex-notice-field">Popup behaviour<select id="apexMessagePopupMode"><option value="timed">Automatically disappear</option><option value="manual">Stay until closed or opened</option><option value="read">Stay until messages are read</option></select></label><label class="apex-notice-field" id="apexMessageDurationRow">Time on screen<select id="apexMessagePopupDuration">'+P.seconds.map(n=>'<option value="'+n+'">'+n+' seconds</option>').join('')+'</select></label><label class="apex-notice-field">Repeat unread reminders<select id="apexMessagePopupRepeat">'+P.intervals.map(n=>'<option value="'+n+'">'+(n===0?'New messages only':'Every '+n+' minute'+(n===1?'':'s'))+'</option>').join('')+'</select><small>Repeat only after a popup closes, while messages remain unread.</small></label><label class="apex-notice-toggle"><input type="checkbox" id="apexMessagePopupSignIn"><span><strong>Notify about existing unread messages at sign-in</strong><small>Show unread messages already waiting when you log in.</small></span></label><label class="apex-notice-toggle"><input type="checkbox" id="apexMessagePopupSenders"><span><strong>Show sender names</strong><small>Otherwise show only the unread message count.</small></span></label><label class="apex-notice-toggle"><input type="checkbox" id="apexMessagePopupShake"><span><strong>Animate message icon on arrival</strong><small>Respects reduced-motion settings.</small></span></label></div><p class="apex-notice-explainer">Closing a popup never marks messages as read. The red unread badge remains until the messages are read. Popups clear when all messages are read or you sign out.</p><div class="apex-message-notice-settings-actions"><button class="primary" type="button" id="apexMessagePopupSave">Save notification settings</button><button class="secondary" type="button" id="apexMessagePopupTest">Preview popup</button><button class="secondary" type="button" id="apexMessagePopupReset">Reset to defaults</button><small role="status" id="apexMessagePopupSaved"></small></div>';
  panel.append(card);
  const readDraft=()=>P.normalize({enabled:$('apexMessagePopupEnabled').checked,mode:$('apexMessagePopupMode').value,seconds:Number($('apexMessagePopupDuration').value),repeatMinutes:Number($('apexMessagePopupRepeat').value),senders:$('apexMessagePopupSenders').checked,shake:$('apexMessagePopupShake').checked,atSignIn:$('apexMessagePopupSignIn').checked});
  const dependencies=()=>{$('apexMessagePopupDuration').disabled=$('apexMessagePopupMode').value!=='timed';$('apexMessageDurationRow').classList.toggle('is-inactive',$('apexMessagePopupDuration').disabled);};
  const fill=p=>{$('apexMessagePopupEnabled').checked=p.enabled;$('apexMessagePopupMode').value=p.mode;$('apexMessagePopupDuration').value=String(p.seconds);$('apexMessagePopupRepeat').value=String(p.repeatMinutes);$('apexMessagePopupSenders').checked=p.senders;$('apexMessagePopupShake').checked=p.shake;$('apexMessagePopupSignIn').checked=p.atSignIn;dependencies();};
  fill(prefs);$('apexMessagePopupMode').onchange=dependencies;
  $('apexMessagePopupSave').onclick=()=>{const next=readDraft();try{localStorage.setItem(key,JSON.stringify(next));const wasVisible=!!$('apexMessagePopup');prefs=next;remove(true);if(!prefs.enabled){remove();closedAt=null;}else if(wasVisible&&unread?.count)render(unread,openUnread);else if(unread?.count)closedAt=Date.now();$('apexMessagePopupSaved').textContent='Saved on this PC.';}catch{$('apexMessagePopupSaved').textContent='Unable to save preferences.';}};
  $('apexMessagePopupTest').onclick=()=>{const shown=show({count:2,senders:['Example colleague'],extra:0},null,true,{preferences:readDraft()});$('apexMessagePopupSaved').textContent=shown?'Example shown at the top right.':'Close the active message notification before previewing.';};
  $('apexMessagePopupReset').onclick=()=>{fill(P.defaults);$('apexMessagePopupSaved').textContent='Defaults selected — press Save to apply.';};
 }
 root.addEventListener('apex:notification-session',()=>{if(!active())reset();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',settings,{once:true});else settings();
 root.ApexMessageNotices=Object.freeze({show,sync,hide,getPreferences:()=>({...prefs})});
})(window);
