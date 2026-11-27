'use strict';
(function(root){
 const $=id=>document.getElementById(id),key='apex.connect.message-popups.v1';
 let timer=null,enabled=true;
 try{enabled=localStorage.getItem(key)!=='off';}catch{}
 function hide(){clearTimeout(timer);timer=null;$('apexMessagePopup')?.remove();}
 function show(data,onOpen,preview=false){
  if(!root.ApexNotificationSession?.active()||(!enabled&&!preview)||!data?.count)return false;
  hide();
  const card=document.createElement('section');card.id='apexMessagePopup';card.className='apex-message-popup';card.setAttribute('role','status');card.setAttribute('aria-live','polite');
  card.innerHTML='<div class="apex-message-popup-top"><span class="apex-message-popup-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.6-4.2A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 10h8M8 14h5"/></svg></span><div class="apex-message-popup-copy"><small>APEX CONNECT</small><strong data-notice-title></strong><p data-notice-senders></p></div><button type="button" class="apex-message-popup-close" aria-label="Dismiss message notification"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><div class="apex-message-popup-actions"><small data-notice-hint></small><button type="button" class="primary apex-message-popup-open">Open messages</button></div>';
  card.querySelector('[data-notice-title]').textContent='You have '+data.count+' unread message'+(data.count===1?'':'s');
  card.querySelector('[data-notice-senders]').textContent='From '+data.senders.join(', ')+(data.extra?' and '+data.extra+' more':'');
  card.querySelector('[data-notice-hint]').textContent=preview?'Example notification':'Just now';
  const open=card.querySelector('.apex-message-popup-open');open.hidden=preview;open.onclick=()=>{hide();if(root.ApexNotificationSession.active())onOpen?.();};
  card.querySelector('.apex-message-popup-close').onclick=hide;
  $('appPage').appendChild(card);
  timer=setTimeout(hide,12000);
  return true;
 }
 function settings(){
  const panel=$('apexReminderSettings')?.parentElement;if(!panel)return;
  const card=document.createElement('div');card.className='apex-message-notice-settings';card.innerHTML='<h3>Message notifications</h3><p>Show a private in-app popup after sign-in when unread APEX Connect messages arrive. The red unread badge remains visible until messages are read.</p><label><input type="checkbox" id="apexMessagePopupEnabled"> Show message popups on this PC</label><div class="apex-message-notice-settings-actions"><button class="primary" type="button" id="apexMessagePopupSave">Save message notifications</button><button class="secondary" type="button" id="apexMessagePopupTest">Preview popup</button><small role="status" id="apexMessagePopupSaved"></small></div>';
  panel.append(card);const toggle=$('apexMessagePopupEnabled');toggle.checked=enabled;
  $('apexMessagePopupSave').onclick=()=>{try{localStorage.setItem(key,toggle.checked?'on':'off');enabled=toggle.checked;if(!enabled)hide();$('apexMessagePopupSaved').textContent='Saved on this PC.';}catch{$('apexMessagePopupSaved').textContent='Unable to save preferences.';}};
  $('apexMessagePopupTest').onclick=()=>show({count:2,senders:['Example colleague'],extra:0},null,true);
 }
 root.addEventListener('apex:notification-session',()=>{if(!root.ApexNotificationSession.active())hide();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',settings,{once:true});else settings();
 root.ApexMessageNotices=Object.freeze({show,hide});
})(window);
