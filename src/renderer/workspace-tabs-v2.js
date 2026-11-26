'use strict';
/* APEX Workspace Tabs 2.0 — opt-in new tabs, ordinary navigation replaces the
   current tab. Existing sidebar/theme/pages/IPC and cloud records are untouched.
   Asset form snapshots and tab history remain in memory until this window closes. */
(function(root){
 const host=document.getElementById('v3Topline'),main=document.querySelector('main.main');
 if(!host||!main||typeof setPage!=='function'||typeof openAsset!=='function')return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const titles={connect:'APEX Connect',dashboard:'Dashboard',inventory:'Inventory',asset:'Asset',assetLabels:'Asset Labels',labelStudio:'Custom Labels',qaStickers:'QA Stickers',refurbWorkspace:'Refurbishment',palletLocations:'Pallet Locations',palletLocationDetail:'Location Pallets',completedQA:'Completed QA',settings:'Settings',pallets:'Pallets',locations:'Locations',scan:'Scanner',bulk:'Bulk Scan',reports:'Reports',dispatch:'Microdream',workstation:'Workstation',users:'Users',containerInventory:'Container Inventory'};
 const icons={connect:'✉',dashboard:'◈',inventory:'▦',asset:'▣',assetLabels:'▤',labelStudio:'▤',qaStickers:'▤',refurbWorkspace:'⚒',palletLocations:'▧',completedQA:'✓',settings:'⚙'};
 const location=(page,id)=>({page,id:page==='asset'?(id||null):null,scroll:0,draft:null});
 const locKey=l=>l.page==='asset'?'asset:'+(l.id||'new'):'page:'+l.page;
 const name=l=>l.page==='asset'?(l.id?'Asset '+l.id:'New Asset'):(titles[l.page]||l.page);
 const tabs=[],rawSetPage=setPage,rawOpenAsset=openAsset;
 let active=null,sequence=0,navigatingAsset=false,switching=false,menu=null,connectUnread=0;
 const el=document.createElement('nav');el.id='apexWorkspaceTabs';el.className='apex-workspace-tabs';el.setAttribute('aria-label','Open APEX workspace tabs');
 el.innerHTML='<div class="apex-workspace-history"><button type="button" id="apexTabBack" title="Back in tab" aria-label="Back in this tab">‹</button><button type="button" id="apexTabForward" title="Forward in tab" aria-label="Forward in this tab">›</button></div><div id="apexWorkspaceTabList" class="apex-workspace-tab-list" role="tablist" aria-label="Open APEX pages"></div><button type="button" id="apexWorkspaceNewTab" class="apex-workspace-tab-add" aria-label="New Inventory tab" title="New Inventory tab">＋</button>';
 host.after(el);
 const list=el.querySelector('#apexWorkspaceTabList');
 const get=()=>tabs.find(t=>t.key===active);
 const current=()=>location(currentPage,currentPage==='asset'?activeAssetId:null);
 function capture(){
  const tab=get();if(!tab||switching)return;
  const entry=tab.entries[tab.index];if(!entry)return;
  if(locKey(entry)!==locKey(current()))return;
  entry.scroll=main.scrollTop||0;
  if(entry.page!=='asset')return;
  const form=document.getElementById('assetEditor');if(!form)return;
  entry.draft={dirty:!!dirty,section:document.getElementById('assetPage')?.dataset.section||'',
   fields:[...form.querySelectorAll('input,textarea,select')].filter(f=>f.name&&f.type!=='file'&&f.type!=='password')
    .map(f=>({name:f.name,value:f.value,checked:!!f.checked,type:f.type}))};
 }
 function restoreDraft(entry){
  if(entry.page!=='asset'||!entry.draft)return;
  const form=document.getElementById('assetEditor');if(!form)return;
  const fields=[...form.querySelectorAll('input,textarea,select')];
  for(const saved of entry.draft.fields)for(const field of fields){
   if(field.name!==saved.name||field.type!==saved.type)continue;
   if(field.type==='checkbox'||field.type==='radio')field.checked=saved.checked;
   else field.value=saved.value;
  }
  const assetPage=document.getElementById('assetPage');
  if(assetPage&&entry.draft.section)assetPage.dataset.section=entry.draft.section;
  dirty=!!entry.draft.dirty;
  if(dirty){const hint=document.getElementById('assetEditedHint');if(hint)hint.textContent='Unsaved changes in this tab · press Save changes before closing APEX.';}
 }
 function doRoute(route){
  const priorDirty=dirty;
  // The existing page handler clears this shared flag, but each tab owns
  // a separate in-memory draft. Never auto-save or overwrite Supabase data.
  if(currentPage==='asset'&&dirty)dirty=false;
  switching=true;
  try{
   if(route.page==='asset'){
    navigatingAsset=true;
    try{rawOpenAsset(route.id||'');}finally{navigatingAsset=false;}
   }else rawSetPage(route.page,true);
  }catch(error){dirty=priorDirty;throw error;}
  finally{switching=false;}
  restoreDraft(route);
  main.scrollTop=route.scroll||0;
 }
 function redraw(){
  const horizontalOffset=list.scrollLeft||0;
  const tab=get();
  el.querySelector('#apexTabBack').disabled=!tab||tab.index<=0;
  el.querySelector('#apexTabForward').disabled=!tab||tab.index>=tab.entries.length-1;
  list.innerHTML=tabs.map(t=>{
   const entry=t.entries[t.index],selected=t.key===active;
   const unsaved=t.entries.some(e=>e.draft?.dirty);
   return '<div class="apex-workspace-tab'+(selected?' is-active':'')+'" data-tab="'+esc(t.key)+'" role="presentation">'+
    '<button type="button" class="apex-workspace-tab-switch" role="tab" aria-selected="'+selected+'" title="'+esc(name(entry))+'"><span aria-hidden="true">'+(icons[entry.page]||'▣')+'</span><span class="apex-workspace-tab-title">'+esc(name(entry))+'</span>'+(unsaved?'<span class="apex-workspace-unsaved" title="Unsaved asset changes">●</span>':'')+(entry.page==='connect'&&connectUnread>0?'<span class="apex-workspace-message-unread" aria-label="'+connectUnread+' unread messages">'+(connectUnread>99?'99+':connectUnread)+'</span>':'')+'</button>'+
    '<button type="button" class="apex-workspace-tab-close" aria-label="Close '+esc(name(entry))+'" title="Close tab">×</button></div>';
  }).join('');
  list.querySelectorAll('.apex-workspace-tab-switch').forEach(b=>b.onclick=()=>activate(b.closest('[data-tab]').dataset.tab));
  list.querySelectorAll('.apex-workspace-tab-close').forEach(b=>b.onclick=()=>close(b.closest('[data-tab]').dataset.tab));
  list.scrollLeft=horizontalOffset;
 }
 function makeTab(route){
  const key='tab:'+ ++sequence;
  tabs.push({key,entries:[route],index:0});return key;
 }
 function follow(route){
  if(switching)return;
  let tab=get();
  if(!tab){active=makeTab(route);redraw();return;}
  if(locKey(tab.entries[tab.index])===locKey(route)){redraw();return;}
  tab.entries=tab.entries.slice(0,tab.index+1);
  tab.entries.push(route);
  if(tab.entries.length>35)tab.entries.shift();
  tab.index=tab.entries.length-1;
  redraw();
 }
 function normalPage(page,force){
  if(switching||navigatingAsset)return rawSetPage(page,force);
  if(currentPage===page&&page!=='asset'){const scroll=main.scrollTop;const ok=rawSetPage(page,force);main.scrollTop=scroll;return ok;}
  capture();
  if(currentPage==='asset'&&dirty)dirty=false;
  let result;try{result=rawSetPage(page,true);}catch(e){restoreDraft(get()?.entries[get()?.index]||{});throw e;}
  if(!result){restoreDraft(get()?.entries[get()?.index]||{});return false;}
  follow(location(page,page==='asset'?activeAssetId:null));
  main.scrollTop=0;return result;
 }
 setPage=normalPage;
 function normalAsset(id){
  const code=String(id||'').trim().toUpperCase();
  if(currentPage==='asset'&&activeAssetId===code)return;
  capture();
  if(currentPage==='asset'&&dirty)dirty=false;
  navigatingAsset=true;
  try{rawOpenAsset(id);}
  finally{navigatingAsset=false;}
  if(currentPage!=='asset'||(code&&activeAssetId!==code))return;
  follow(location('asset',activeAssetId));
  main.scrollTop=0;
 }
 openAsset=normalAsset;
 function activate(key){
  if(key===active)return true;
  const target=tabs.find(t=>t.key===key);if(!target)return false;
  capture();active=key;doRoute(target.entries[target.index]);redraw();return true;
 }
 function openNew(page,id){
  if(page==='asset'){
   const code=String(id||'').trim().toUpperCase();
   if(!code||!items.some(a=>a.id===code&&!a.deletedAt))return false;
   id=code;
  }
  capture();
  const route=location(page,id);
  // Explicit new tab only. Avoid duplicate copies of the same asset tab.
  const existing=page==='asset'?tabs.find(t=>locKey(t.entries[t.index])===locKey(route)):null;
  if(existing)return activate(existing.key);
  const key=makeTab(route);active=key;doRoute(route);redraw();return true;
 }
 function go(delta){
  const tab=get();if(!tab)return false;
  const next=tab.index+delta;if(next<0||next>=tab.entries.length)return false;
  capture();tab.index=next;doRoute(tab.entries[next]);redraw();return true;
 }
 function close(key,confirmed=false){
  const index=tabs.findIndex(t=>t.key===key);
  if(index<0)return false;
  if(key===active)capture();
  const tab=tabs[index];
  if(!confirmed&&tab.entries.some(e=>e.draft?.dirty)){apexConfirm('This tab contains unsaved asset edits. Close it and discard those changes?',{title:'Close tab without saving?',tone:'warning',confirmLabel:'Discard and close'}).then(ok=>{if(ok)close(key,true);});return false;}
  tabs.splice(index,1);
  if(key===active){
   if(tabs.length){active=null;const next=tabs[Math.min(index,tabs.length-1)];active=next.key;doRoute(next.entries[next.index]);}
   else{active=makeTab(location('inventory'));doRoute(get().entries[0]);}
  }
  redraw();return true;
 }
 el.querySelector('#apexWorkspaceNewTab').onclick=()=>openNew('inventory');
 el.querySelector('#apexTabBack').onclick=()=>go(-1);
 el.querySelector('#apexTabForward').onclick=()=>go(1);
 function targetRoute(target){
  if(!target?.closest)return null;
  const asset=target.closest('[data-asset], [data-op="open"][data-id]');
  if(asset){const id=asset.dataset.asset||asset.dataset.id;return id?location('asset',String(id).trim().toUpperCase()):null;}
  const qa=target.closest('[data-qa-asset-label]');
  if(qa)return location('assetLabels');
  const nav=target.closest('[data-v3tab], .menu-item[data-page]');
  if(nav){const page=nav.dataset.v3tab||nav.dataset.page;return titles[page]?location(page):null;}
  return null;
 }
 function hideMenu(){if(menu){menu.remove();menu=null;}}
 function newTabFromEvent(event){
  const route=targetRoute(event.target);if(!route)return false;
  if(route.page==='asset'&&!items.some(a=>a.id===route.id&&!a.deletedAt))return false;
  event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation?.();
  hideMenu();return openNew(route.page,route.id);
 }
 document.addEventListener('click',event=>{
  if(menu&&!menu.contains(event.target))hideMenu();
  if(event.button===0&&(event.ctrlKey||event.metaKey)&&!event.altKey)newTabFromEvent(event);
 },true);
 document.addEventListener('auxclick',event=>{if(event.button===1)newTabFromEvent(event);},true);
 document.addEventListener('contextmenu',event=>{
  const route=targetRoute(event.target);if(!route)return;
  if(route.page==='asset'&&!items.some(a=>a.id===route.id&&!a.deletedAt))return;
  event.preventDefault();hideMenu();
  menu=document.createElement('div');menu.className='apex-workspace-context';
  menu.setAttribute('role','menu');
  const btn=document.createElement('button');btn.type='button';btn.setAttribute('role','menuitem');btn.textContent='Open in New Tab';
  btn.onclick=()=>{hideMenu();openNew(route.page,route.id);};
  menu.append(btn);document.body.append(menu);
  const x=Math.max(8,Math.min(event.clientX||8,(document.documentElement.clientWidth||1000)-190));
  const y=Math.max(8,Math.min(event.clientY||8,(document.documentElement.clientHeight||700)-55));
  menu.style.left=x+'px';menu.style.top=y+'px';btn.focus();
 },true);
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape')hideMenu();
  if(event.defaultPrevented||document.getElementById('appPage')?.classList.contains('hidden'))return;
  if(event.altKey&&!event.ctrlKey&&!event.metaKey&&event.key==='ArrowLeft'){event.preventDefault();go(-1);}
  if(event.altKey&&!event.ctrlKey&&!event.metaKey&&event.key==='ArrowRight'){event.preventDefault();go(1);}
  if(!event.ctrlKey||event.altKey||event.metaKey)return;
  if(event.key==='Tab'&&tabs.length>1){event.preventDefault();const index=tabs.findIndex(t=>t.key===active);activate(tabs[(index+(event.shiftKey?-1:1)+tabs.length)%tabs.length].key);}
  if(event.key.toLowerCase()==='w'){event.preventDefault();close(active);}
 },true);
 active=makeTab(current());redraw();
 root.ApexWorkspaceTabs=Object.freeze({openPage:page=>setPage(page),openAsset:id=>openAsset(id),openNew,activate,close,back:()=>go(-1),forward:()=>go(1),keys:()=>tabs.map(t=>t.key),active:()=>active,route:()=>({...get().entries[get().index]}),setConnectUnread:count=>{const value=Math.max(0,Math.min(9999,Number(count)||0));if(connectUnread!==value){connectUnread=value;redraw();}}});
})(window);
