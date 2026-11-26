'use strict';
/* APEX Connect 1.0: small in-app office chat with an optional full Workspace tab.
   UI never receives a Supabase token, secret, or direct database URL. */
(function(root){
 const api=root.apexInventory,button=document.getElementById('apexConnectToggle');
 const drawer=document.getElementById('apexConnectDrawer'),drawerHost=document.getElementById('apexConnectDrawerHost');
 const page=document.getElementById('connectPage'),pageHost=document.getElementById('apexConnectPageHost');
 if(!api?.connectList||!button||!drawer||!page)return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clamp=s=>String(s||'').slice(0,2000);
 const t=time=>{try{return new Date(time).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return '';}};
 const shell=document.createElement('div');shell.className='apex-connect-shell';
 shell.innerHTML='<div class="apex-connect-contacts"><div class="apex-connect-contact-title">CONVERSATIONS</div><div id="apexConnectConversations"></div></div>'+
 '<div class="apex-connect-thread"><div class="apex-connect-thread-head"><div><strong id="apexConnectThreadName">Office Team</strong><small>Internal APEX messages</small></div><div class="apex-connect-thread-tools"><span id="apexConnectStatus"></span><button id="apexConnectAdminClear" type="button" class="apex-connect-clear-thread" title="Delete all messages from this conversation" hidden>Clear conversation</button></div></div>'+
 '<div id="apexConnectMessages" class="apex-connect-messages" role="log" aria-label="Conversation messages"></div>'+
 '<form id="apexConnectForm" class="apex-connect-form"><label>Linked asset (optional)<input id="apexConnectAsset" maxlength="80" autocomplete="off" placeholder="Asset ID, e.g. 83253"></label>'+
 '<label>Message<textarea id="apexConnectBody" rows="2" maxlength="2000" placeholder="Type a message to the office..." required></textarea></label>'+
 '<div class="apex-connect-actions"><small>Messages are separate from Engineer and Refurb Notes.</small><button type="submit" class="primary" id="apexConnectSend">Send</button></div></form></div>';
 drawerHost.append(shell);
 const $=id=>document.getElementById(id);
 let me=null,members=[],latest=[],reads=new Map(),selected='team',thread=[],busy=false,sending=false,ready=false,mode='drawer',lastUnread=0,lastPoll=0,initialisedUnread=false,shakeTimer=null,lastInboundId=0,previewUntil=0,previewTimer=null,isAdmin=false,modBusy=false;
 const drafts=new Map();
 const key=recipient=>recipient==='team'?'team':'dm:'+recipient.toLowerCase();
 const active=()=>!drawer.hidden||!page.classList.contains('hidden');
 const visible=()=>!document.getElementById('appPage')?.classList.contains('hidden');
 const display=id=>members.find(m=>m.user_id===id)?.display_name||'Team member';
 const unreadFor=(recipient)=>{
  const seen=Number(reads.get(key(recipient))||0);
  return latest.filter(m=>m.id>seen&&m.sender_id!==me&&(recipient==='team'?m.recipient_id===null:
   (m.sender_id===recipient&&m.recipient_id===me))).length;
 };
 const unreadTotal=()=>members.filter(m=>m.user_id!==me).reduce((n,m)=>n+unreadFor(m.user_id),unreadFor('team'));
 function animateNotification(){
  if(document.visibilityState==='hidden')return;
  button.classList.remove('apex-connect-notify');
  // Restart CSS animation for a new arrival, even when the badge count is unchanged.
  void button.offsetWidth;
  button.classList.add('apex-connect-notify');
  clearTimeout(shakeTimer);
  shakeTimer=setTimeout(()=>button.classList.remove('apex-connect-notify'),800);
 }
 function renderBadge(){
  const count=me?unreadTotal():0,badge=$('apexConnectUnread');
  // Check message identity as well as count: a new arrival can replace
  // an older, read message without increasing the numeric unread total.
  const inbound=me?latest.filter(m=>m.sender_id!==me&&(m.recipient_id===null||m.recipient_id===me)):[];
  const newest=inbound.reduce((max,m)=>Math.max(max,Number(m.id)||0),0);
  const arrivals=count>0&&(newest>lastInboundId||count>lastUnread);
  // Show existing unread messages after sign-in, not just newly arrived ones.
  if((!initialisedUnread&&count>0)||(initialisedUnread&&arrivals))animateNotification();
  initialisedUnread=true;lastUnread=count;lastInboundId=Math.max(lastInboundId,newest);
  button.setAttribute('aria-label',count?'APEX Connect, '+count+' unread message'+(count===1?'':'s'):'Open APEX Connect');
  button.title=count?count+' unread APEX message'+(count===1?'':'s'):'APEX Connect messages';
  if(Date.now()<previewUntil)return;
  badge.hidden=count===0;
  badge.textContent=count>99?'99+':String(count);
  root.ApexWorkspaceTabs?.setConnectUnread?.(count);
 }
 function testNotification(){
  if(!visible())return false;
  clearTimeout(previewTimer);
  previewUntil=Date.now()+2300;
  const badge=$('apexConnectUnread');
  badge.hidden=false;
  badge.textContent=String(Math.max(1,lastUnread));
  root.ApexWorkspaceTabs?.setConnectUnread?.(Math.max(1,lastUnread));
  button.setAttribute('aria-label','APEX Connect notification preview');
  animateNotification();
  previewTimer=setTimeout(()=>{previewUntil=0;renderBadge();},2350);
  return true;
 }
 function renderContacts(){
  const host=$('apexConnectConversations');if(!host)return;
  const entries=[{id:'team',name:'Office Team',subtitle:'Shared team conversation'},...members.filter(m=>m.user_id!==me).map(m=>({id:m.user_id,name:m.display_name,subtitle:'Direct message'}))];
  host.innerHTML=entries.map(x=>{
   const n=unreadFor(x.id);return '<button type="button" class="apex-connect-contact'+(selected===x.id?' is-current':'')+'" data-connect-recipient="'+esc(x.id)+'"><span class="apex-connect-contact-avatar" aria-hidden="true">'+esc(x.id==='team'?'OF':x.name.slice(0,2).toUpperCase())+'</span><span class="apex-connect-contact-text"><strong>'+esc(x.name)+'</strong><small>'+esc(x.subtitle)+'</small></span>'+(n?'<span class="apex-connect-count">'+(n>99?'99+':n)+'</span>':'')+'</button>';
  }).join('');
  host.querySelectorAll('[data-connect-recipient]').forEach(el=>el.onclick=()=>choose(el.dataset.connectRecipient));
  $('apexConnectThreadName').textContent=selected==='team'?'Office Team':display(selected);
  $('apexConnectAdminClear').hidden=!isAdmin;
 }
 function renderMessages(){
  const host=$('apexConnectMessages'),stick=host.scrollTop+host.clientHeight>=host.scrollHeight-90;
  host.innerHTML=thread.length?thread.map(m=>'<article class="apex-connect-message'+(m.sender_id===me?' from-me can-delete':(isAdmin?' can-delete':''))+'" data-message-id="'+esc(m.id)+'"><div class="apex-connect-message-by">'+esc(m.sender_id===me?'You':display(m.sender_id))+' · '+esc(t(m.created_at))+'</div><div class="apex-connect-message-text">'+esc(m.body)+'</div>'+
   (m.asset_id?'<button type="button" class="apex-connect-asset-link" data-connect-asset="'+esc(m.asset_id)+'">▣ Asset '+esc(m.asset_id)+'</button>':'')+
   ((m.sender_id===me||isAdmin)?'<button type="button" class="apex-connect-message-actions" data-message-actions="'+esc(m.id)+'" aria-expanded="false" title="Message options">⋯</button><button type="button" class="apex-connect-message-delete" data-delete-message="'+esc(m.id)+'" hidden>Delete message</button>':'')+'</article>').join(''):
   '<div class="apex-connect-empty">No messages yet. Send the first message to your team.</div>';
  host.querySelectorAll('[data-message-actions]').forEach(b=>b.onclick=()=>{
   const target=host.querySelector('[data-delete-message="'+b.dataset.messageActions+'"]');
   if(!target)return;
   const shouldShow=target.hidden;
   host.querySelectorAll('[data-delete-message]').forEach(x=>x.hidden=true);
   host.querySelectorAll('[data-message-actions]').forEach(x=>x.setAttribute('aria-expanded','false'));
   target.hidden=!shouldShow;
   b.setAttribute('aria-expanded',String(shouldShow));
  });
  // Tapping the message bubble itself opens the same delete option.
  host.querySelectorAll('.apex-connect-message.can-delete').forEach(b=>b.onclick=e=>{
   if(e.target.closest?.('button'))return;
   b.querySelector('[data-message-actions]')?.click();
  });
  host.querySelectorAll('[data-delete-message]').forEach(b=>b.onclick=async()=>{
   const id=Number(b.dataset.deleteMessage);
   const message=thread.find(m=>Number(m.id)===id);
   if(!message||(!isAdmin&&message.sender_id!==me)||modBusy)return;
   if(!confirm('Permanently delete this message for everyone in this conversation? This cannot be undone.'))return;
   b.disabled=true;modBusy=true;
   try{
    const result=isAdmin?await api.connectAdminDeleteMessage({messageId:id}):await api.connectDelete({messageId:id});
    if(!result?.ok){$('apexConnectStatus').textContent=result?.error||'Message could not be deleted.';return;}
    thread=thread.filter(m=>Number(m.id)!==id);
    latest=latest.filter(m=>Number(m.id)!==id);
    renderMessages();renderContacts();renderBadge();
    // Fetch authoritative cloud state so other conversations stay consistent.
    poll(true);
   }catch{$('apexConnectStatus').textContent='Message deletion failed. Check your connection.';}
   finally{b.disabled=false;modBusy=false;}
  });
  host.querySelectorAll('[data-connect-asset]').forEach(b=>b.onclick=()=>{const id=b.dataset.connectAsset;
   const ok=root.ApexWorkspaceTabs?.openNew?.('asset',id);
   if(!ok){const status=$('apexConnectStatus');status.textContent='Asset '+id+' is not in active inventory.';}
  });
  if(stick)host.scrollTop=host.scrollHeight;
 }
 async function loadThread(){
  if(!ready||!active())return;
  const target=selected;
  const data=await api.connectHistory(target);
  if(!data?.ok){$('apexConnectStatus').textContent=data?.error||'Unable to load conversation';return;}
  if(selected!==target)return;
  const changed=thread.length!==data.messages.length||thread.at(-1)?.id!==data.messages.at(-1)?.id;
  thread=data.messages;
  if(changed)renderMessages();
  $('apexConnectStatus').textContent='';
  const max=Math.max(0,...thread.map(m=>Number(m.id)||0));
  if(max>Number(reads.get(key(target))||0)){
   const result=await api.connectRead({recipient:target,lastId:max});
   if(result?.ok){reads.set(key(target),result.lastRead);renderContacts();renderBadge();}
  }
 }
 function stashDraft(){
  drafts.set(selected,{body:$('apexConnectBody').value,asset:$('apexConnectAsset').value});
 }
 async function choose(target){
  if(target!=='team'&&!members.some(m=>m.user_id===target))return;
  stashDraft();selected=target;
  const draft=drafts.get(target)||{};
  $('apexConnectBody').value=draft.body||'';
  $('apexConnectAsset').value=draft.asset||'';
  thread=[];renderContacts();renderMessages();
  await loadThread();
 }
 async function poll(force=false){
  if(busy||!visible()||document.visibilityState==='hidden')return;
  if(!force&&Date.now()-lastPoll<5500)return;
  busy=true;lastPoll=Date.now();
  try{
   const info=await api.connectList();
   if(!info?.ok){
    ready=false;me=null;isAdmin=false;members=[];latest=[];reads=new Map();thread=[];
    $('apexConnectStatus').textContent=info?.error||'APEX Connect unavailable';
    $('apexConnectSend').disabled=true;renderContacts();renderMessages();renderBadge();return;
   }
   if(me!==info.userId){selected='team';drafts.clear();thread=[];initialisedUnread=false;lastUnread=0;lastInboundId=0;}
   me=info.userId;isAdmin=info.isAdmin===true;members=info.members||[];latest=info.latest||[];
   reads=new Map((info.reads||[]).map(r=>[r.conversation_key,Number(r.last_read_id)||0]));
   ready=true;$('apexConnectSend').disabled=false;
   renderContacts();renderBadge();
   if(active())await loadThread();
  }catch(e){$('apexConnectStatus').textContent='Cannot reach team messaging right now.';}
  finally{busy=false;}
 }
 $('apexConnectAdminClear').onclick=async()=>{
  if(!isAdmin||!ready||modBusy)return;
  const target=selected,name=target==='team'?'the entire Office Team conversation':'your entire direct conversation with '+display(target);
  const confirmText='Delete ALL messages from '+name+' for everyone? This is permanent and cannot be undone.';
  if(!confirm(confirmText))return;
  if(!confirm('Final confirmation: permanently clear '+name+'?'))return;
  modBusy=true;const action=$('apexConnectAdminClear');action.disabled=true;
  try{
   const data=await api.connectAdminDeleteConversation({kind:target==='team'?'team':'direct',otherUser:target==='team'?null:target});
   if(!data?.ok){$('apexConnectStatus').textContent=data?.error||'Conversation could not be deleted.';return;}
   if(selected===target){thread=[];renderMessages();}
   $('apexConnectStatus').textContent=Number(data.deleted||0)+' messages deleted for everyone.';
   await poll(true);
  }catch{$('apexConnectStatus').textContent='Failed to clear conversation. Check your cloud connection.';}
  finally{modBusy=false;action.disabled=false;}
 };
 function syncPlacement(){
  const isPage=!page.classList.contains('hidden');
  const destination=isPage?pageHost:drawerHost;
  if(shell.parentNode!==destination)destination.append(shell);
  mode=isPage?'page':'drawer';
  if(isPage){drawer.hidden=true;poll(true);}
 }
 function showDrawer(assetId){
  if(!visible())return;
  if(!page.classList.contains('hidden')){
   // A workspace tab is already open; attach to that tab rather than duplicating the chat.
   syncPlacement();
  }else{drawer.hidden=false;syncPlacement();}
  if(assetId){$('apexConnectAsset').value=String(assetId).trim().toUpperCase();stashDraft();}
  poll(true);
 }
 // The original floating popup is independently movable; Workspace Tabs are unchanged.
 const dragHandle=$('apexConnectDragHandle');
 const resetPosition=()=>{
  drawer.style.left='';drawer.style.top='';drawer.style.right='';
  drawer.style.width='';drawer.style.height='';
  drawer.classList.remove('apex-connect-moved');
 };
 const keepInViewport=()=>{
  if(drawer.hidden||!drawer.classList.contains('apex-connect-moved'))return;
  const box=drawer.getBoundingClientRect();
  const x=Math.max(8,Math.min(box.left,Math.max(8,innerWidth-box.width-8)));
  const y=Math.max(8,Math.min(box.top,Math.max(8,innerHeight-box.height-8)));
  drawer.style.left=x+'px';drawer.style.top=y+'px';drawer.style.right='auto';
 };
 let drag=null;
 dragHandle?.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('button')||drawer.hidden)return;
  const box=drawer.getBoundingClientRect();
  drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,left:box.left,top:box.top,width:box.width,height:box.height};
  drawer.classList.add('apex-connect-moved','apex-connect-dragging');
  drawer.style.left=box.left+'px';drawer.style.top=box.top+'px';drawer.style.right='auto';
  e.preventDefault();
 });
 document.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const x=Math.max(8,Math.min(drag.left+e.clientX-drag.startX,Math.max(8,innerWidth-drag.width-8)));
  const y=Math.max(8,Math.min(drag.top+e.clientY-drag.startY,Math.max(8,innerHeight-drag.height-8)));
  drawer.style.left=x+'px';drawer.style.top=y+'px';
 });
 const stopDrag=e=>{if(drag&&e.pointerId===drag.id){drag=null;drawer.classList.remove('apex-connect-dragging');}};
 document.addEventListener('pointerup',stopDrag);
 document.addEventListener('pointercancel',stopDrag);
 root.addEventListener('resize',keepInViewport);
 $('apexConnectResetPosition').onclick=resetPosition;
 button.onclick=()=>{if(!page.classList.contains('hidden')){syncPlacement();return;}
  if(drawer.hidden)showDrawer();else drawer.hidden=true;};
 $('apexConnectClose').onclick=()=>{drawer.hidden=true;};
 $('apexConnectOpenTab').onclick=()=>{
  drawer.hidden=true;
  if(root.ApexWorkspaceTabs?.openNew)root.ApexWorkspaceTabs.openNew('connect');
  else setPage('connect');
  syncPlacement();poll(true);
 };
 const assetSave=document.getElementById('assetTopSave');
 if(assetSave){
  const trigger=document.createElement('button');trigger.type='button';trigger.className='secondary apex-connect-asset-action';trigger.textContent='Message Office';
  trigger.onclick=()=>showDrawer(typeof activeAssetId!=='undefined'?activeAssetId:null);
  assetSave.after(trigger);
 }
 $('apexConnectForm').onsubmit=async e=>{
  e.preventDefault();if(sending||!ready)return;
  const body=clamp($('apexConnectBody').value).trim(),asset=$('apexConnectAsset').value.trim();
  if(!body)return;
  sending=true;$('apexConnectSend').disabled=true;
  try{
   const result=await api.connectSend({recipient:selected,body,assetId:asset||null});
   if(!result?.ok){$('apexConnectStatus').textContent=result?.error||'Message not sent';return;}
   $('apexConnectBody').value='';drafts.delete(selected);
   const recipient=selected;await loadThread();
   if(selected===recipient)await poll(true);
  }catch{$('apexConnectStatus').textContent='Message not sent. Check your connection.';}
  finally{sending=false;$('apexConnectSend').disabled=!ready;}
 };
 const watcher=new MutationObserver(syncPlacement);
 watcher.observe(page,{attributes:true,attributeFilter:['class']});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!drawer.hidden){drawer.hidden=true;}});
 setInterval(()=>poll(),6500);
 // Catch messages received while APEX is minimised or another application is in front.
 // The next foreground activation checks immediately rather than waiting for the timer.
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')poll(true);});
 root.addEventListener('focus',()=>poll(true));
 setTimeout(()=>poll(true),1500);
 root.ApexConnect=Object.freeze({open:showDrawer,openTab:()=>$('apexConnectOpenTab').click(),refresh:()=>poll(true),testNotification});
})(window);
