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
 '<div class="apex-connect-thread"><div class="apex-connect-thread-head"><div><strong id="apexConnectThreadName">Office Team</strong><small>Internal APEX messages</small></div><span id="apexConnectStatus"></span></div>'+
 '<div id="apexConnectMessages" class="apex-connect-messages" role="log" aria-label="Conversation messages"></div>'+
 '<form id="apexConnectForm" class="apex-connect-form"><label>Linked asset (optional)<input id="apexConnectAsset" maxlength="80" autocomplete="off" placeholder="Asset ID, e.g. 83253"></label>'+
 '<label>Message<textarea id="apexConnectBody" rows="2" maxlength="2000" placeholder="Type a message to the office..." required></textarea></label>'+
 '<div class="apex-connect-actions"><small>Messages are separate from Engineer and Refurb Notes.</small><button type="submit" class="primary" id="apexConnectSend">Send</button></div></form></div>';
 drawerHost.append(shell);
 const $=id=>document.getElementById(id);
 let me=null,members=[],latest=[],reads=new Map(),selected='team',thread=[],busy=false,sending=false,ready=false,mode='drawer',lastUnread=0,lastPoll=0;
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
 function renderBadge(){
  const count=unreadTotal(),badge=$('apexConnectUnread');
  badge.hidden=!count;badge.textContent=count>99?'99+':String(count);
  button.setAttribute('aria-label',count?'APEX Connect, '+count+' unread messages':'Open APEX Connect');
  lastUnread=count;
 }
 function renderContacts(){
  const host=$('apexConnectConversations');if(!host)return;
  const entries=[{id:'team',name:'Office Team',subtitle:'Shared team conversation'},...members.filter(m=>m.user_id!==me).map(m=>({id:m.user_id,name:m.display_name,subtitle:'Direct message'}))];
  host.innerHTML=entries.map(x=>{
   const n=unreadFor(x.id);return '<button type="button" class="apex-connect-contact'+(selected===x.id?' is-current':'')+'" data-connect-recipient="'+esc(x.id)+'"><span class="apex-connect-contact-avatar" aria-hidden="true">'+esc(x.id==='team'?'OF':x.name.slice(0,2).toUpperCase())+'</span><span class="apex-connect-contact-text"><strong>'+esc(x.name)+'</strong><small>'+esc(x.subtitle)+'</small></span>'+(n?'<span class="apex-connect-count">'+(n>99?'99+':n)+'</span>':'')+'</button>';
  }).join('');
  host.querySelectorAll('[data-connect-recipient]').forEach(el=>el.onclick=()=>choose(el.dataset.connectRecipient));
  $('apexConnectThreadName').textContent=selected==='team'?'Office Team':display(selected);
 }
 function renderMessages(){
  const host=$('apexConnectMessages'),stick=host.scrollTop+host.clientHeight>=host.scrollHeight-90;
  host.innerHTML=thread.length?thread.map(m=>'<article class="apex-connect-message'+(m.sender_id===me?' from-me':'')+'"><div class="apex-connect-message-by">'+esc(m.sender_id===me?'You':display(m.sender_id))+' · '+esc(t(m.created_at))+'</div><div class="apex-connect-message-text">'+esc(m.body)+'</div>'+
   (m.asset_id?'<button type="button" class="apex-connect-asset-link" data-connect-asset="'+esc(m.asset_id)+'">▣ Asset '+esc(m.asset_id)+'</button>':'')+'</article>').join(''):
   '<div class="apex-connect-empty">No messages yet. Send the first message to your team.</div>';
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
  if(!force&&Date.now()-lastPoll<16000)return;
  busy=true;lastPoll=Date.now();
  try{
   const info=await api.connectList();
   if(!info?.ok){
    ready=false;me=null;members=[];latest=[];reads=new Map();thread=[];
    $('apexConnectStatus').textContent=info?.error||'APEX Connect unavailable';
    $('apexConnectSend').disabled=true;renderContacts();renderMessages();renderBadge();return;
   }
   if(me!==info.userId){selected='team';drafts.clear();thread=[];}
   me=info.userId;members=info.members||[];latest=info.latest||[];
   reads=new Map((info.reads||[]).map(r=>[r.conversation_key,Number(r.last_read_id)||0]));
   ready=true;$('apexConnectSend').disabled=false;
   renderContacts();renderBadge();
   if(active())await loadThread();
  }catch(e){$('apexConnectStatus').textContent='Cannot reach team messaging right now.';}
  finally{busy=false;}
 }
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
 setInterval(()=>poll(),20000);
 setTimeout(()=>poll(true),2500);
 root.ApexConnect=Object.freeze({open:showDrawer,openTab:()=>$('apexConnectOpenTab').click(),refresh:()=>poll(true)});
})(window);
