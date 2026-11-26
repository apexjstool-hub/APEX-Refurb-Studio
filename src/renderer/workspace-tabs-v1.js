'use strict';
/* APEX Workspace Tabs 1.0: additive navigation only. Does not alter sidebar,
   page markup, Supabase calls, existing render functions, or application theme.
   Tabs share existing app pages; asset form drafts are held only in memory. */
(function(root){
 const escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icons={inventory:'▦',asset:'▣',assetLabels:'▤',labelStudio:'▤',qaStickers:'▤',refurbWorkspace:'⚒',palletLocations:'▧',palletLocationDetail:'▧',completedQA:'✓',settings:'⚙',dashboard:'◈'};
 const friendly={dashboard:'Dashboard',inventory:'Inventory',asset:'Asset',assetLabels:'Asset Labels',labelStudio:'Custom Labels',qaStickers:'QA Stickers',refurbWorkspace:'Refurbishment',palletLocations:'Pallet Locations',palletLocationDetail:'Pallet Location',completedQA:'Completed QA',settings:'Settings',pallets:'Pallets',locations:'Locations',scan:'Scanner',bulk:'Bulk Scan',reports:'Reports',dispatch:'Microdream',workstation:'Workstation',users:'Users',containerInventory:'Container Inventory'};
 const host=document.getElementById('v3Topline'),content=document.querySelector('main.main>.content');
 if(!host||!content||typeof setPage!=='function'||typeof openAsset!=='function')return;
 const strip=document.createElement('nav');
 strip.id='apexWorkspaceTabs';strip.className='apex-workspace-tabs';strip.setAttribute('aria-label','Open workspace tabs');
 strip.innerHTML='<div id="apexWorkspaceTabList" class="apex-workspace-tab-list" role="tablist" aria-label="Open APEX pages"></div><button type="button" id="apexWorkspaceOpenInventory" class="apex-workspace-tab-add" title="Open Inventory tab" aria-label="Open Inventory tab">＋</button>';
 host.after(strip);
 const list=strip.querySelector('#apexWorkspaceTabList');
 const tabKey=(page,id)=>page==='asset'?'asset:'+(id||'new'):'page:'+page;
 const label=(page,id)=>page==='asset'?(id?'Asset '+id:'New Asset'):(friendly[page]||page);
 const tabs=new Map(),drafts=new Map();
 let currentKey=null,openingAsset=false,restoring=false,muted=false;
 let lastScroll=0;
 const snapshot=()=>{
  if(restoring||muted||!currentKey)return;
  const tab=tabs.get(currentKey);if(!tab)return;
  tab.scroll=document.querySelector('main.main')?.scrollTop||0;
  if(currentPage!=='asset'||!currentKey.startsWith('asset:'))return;
  const editor=document.getElementById('assetEditor');
  if(!editor)return;
  const fields=[...editor.querySelectorAll('input,textarea,select')].filter(el=>el.name&&!['password','file'].includes(el.type));
  const values=fields.map(el=>({name:el.name,value:el.value,checked:el.checked,type:el.type}));
  drafts.set(currentKey,{values,dirty:!!dirty,section:document.getElementById('assetPage')?.dataset.section||''});
 };
 const restoreAsset=key=>{
  const draft=drafts.get(key);if(!draft)return;
  const form=document.getElementById('assetEditor');if(!form)return;
  for(const field of draft.values){
   const matches=[...form.querySelectorAll('input,textarea,select')].filter(el=>el.name===field.name);
   for(const el of matches){
    if(el.type==='checkbox'||el.type==='radio')el.checked=!!field.checked;
    else if(el.type!=='file'&&el.type!=='password')el.value=field.value;
   }
  }
  if(draft.section)document.getElementById('assetPage').dataset.section=draft.section;
  dirty=!!draft.dirty;
  const hint=document.getElementById('assetEditedHint');
  if(hint&&dirty)hint.textContent='Unsaved changes in this tab · press Save changes when ready.';
 };
 const draw=()=>{
  list.innerHTML=[...tabs].map(([key,tab])=>'<div class="apex-workspace-tab'+(key===currentKey?' is-active':'')+'" data-workspace-key="'+escapeText(key)+'" role="presentation">'+
   '<button type="button" class="apex-workspace-tab-switch" role="tab" aria-selected="'+(key===currentKey)+'" title="'+escapeText(tab.name)+'"><span aria-hidden="true">'+(icons[tab.page]||'▣')+'</span><span class="apex-workspace-tab-title">'+escapeText(tab.name)+'</span>'+(drafts.get(key)?.dirty?' <span class="apex-workspace-unsaved" aria-label="Unsaved changes">●</span>':'')+'</button>'+
   '<button type="button" class="apex-workspace-tab-close" aria-label="Close '+escapeText(tab.name)+'" title="Close tab">×</button></div>').join('');
  list.querySelectorAll('.apex-workspace-tab-switch').forEach(b=>b.onclick=()=>activate(b.closest('[data-workspace-key]').dataset.workspaceKey));
  list.querySelectorAll('.apex-workspace-tab-close').forEach(b=>b.onclick=()=>close(b.closest('[data-workspace-key]').dataset.workspaceKey));
  list.querySelector('.is-active')?.scrollIntoView?.({block:'nearest',inline:'nearest'});
 };
 const register=(page,id)=>{
  const key=tabKey(page,id);
  if(!tabs.has(key))tabs.set(key,{page,id:id||null,name:label(page,id),scroll:0});
  else tabs.get(key).name=label(page,id);
  currentKey=key;draw();return key;
 };
 const rawSetPage=setPage,rawOpenAsset=openAsset;
 function switchPage(page,force){
  if(muted)return rawSetPage(page,force);
  if(!openingAsset)snapshot();
  // APEX's original dirty guard is replaced with in-memory tab snapshots.
  // A draft is never automatically sent to Supabase or saved on disk.
  const movingFromAsset=currentPage==='asset'&&page!=='asset';
  if(movingFromAsset&&dirty)dirty=false;
  let ok;
  try{ok=rawSetPage(page,force||movingFromAsset);}catch(e){if(movingFromAsset&&drafts.get(currentKey)?.dirty)dirty=true;throw e;}
  if(!ok){if(movingFromAsset&&drafts.get(currentKey)?.dirty)dirty=true;return false;}
  if(!openingAsset)register(page,page==='asset'?activeAssetId:null);
  const tab=tabs.get(currentKey);
  if(tab&&page==='asset')restoreAsset(currentKey);
  if(tab)document.querySelector('main.main').scrollTop=tab.scroll||0;
  return true;
 }
 setPage=switchPage;
 function switchAsset(id){
  const code=String(id||'').trim().toUpperCase();
  if(!items.some(a=>a.id===code)&&code!=='')return rawOpenAsset(id);
  snapshot();
  // Each asset has its own form draft. Do not discard the previous tab's edits.
  if(currentPage==='asset'&&dirty)dirty=false;
  openingAsset=true;
  try{rawOpenAsset(id);}finally{openingAsset=false;}
  if(currentPage==='asset'){
   const key=register('asset',activeAssetId);
   restoring=true;try{restoreAsset(key);}finally{restoring=false;}
   const tab=tabs.get(key);if(tab)document.querySelector('main.main').scrollTop=tab.scroll||0;
  }
 }
 openAsset=switchAsset;
 function activate(key){
  if(!tabs.has(key)||key===currentKey)return true;
  const tab=tabs.get(key);
  snapshot();
  if(tab.page==='asset')switchAsset(tab.id||'');
  else setPage(tab.page,true);
  return currentKey===key;
 }
 function close(key){
  const tab=tabs.get(key);if(!tab)return false;
  if(key===currentKey)snapshot();
  if(drafts.get(key)?.dirty&&!confirm('Close '+tab.name+' and discard its unsaved edits?'))return false;
  tabs.delete(key);drafts.delete(key);
  if(currentKey===key){
   const next=[...tabs.keys()].at(-1);
   currentKey=null;
   if(next)activate(next);
   else {muted=true;try{rawSetPage('dashboard',true);}finally{muted=false;}register('dashboard',null);}
  }else draw();
  return true;
 }
 strip.querySelector('#apexWorkspaceOpenInventory').onclick=()=>{if(tabs.has('page:inventory'))activate('page:inventory');else setPage('inventory');};
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.altKey||!e.ctrlKey||e.metaKey||document.getElementById('appPage')?.classList.contains('hidden'))return;
  const keys=[...tabs.keys()];
  if(e.key==='Tab'&&keys.length>1){e.preventDefault();activate(keys[(keys.indexOf(currentKey)+(e.shiftKey?-1:1)+keys.length)%keys.length]);}
  else if(e.key.toLowerCase()==='w'){e.preventDefault();close(currentKey);}
 },true);
 register(currentPage,currentPage==='asset'?activeAssetId:null);
 root.ApexWorkspaceTabs=Object.freeze({openPage:page=>setPage(page),openAsset:id=>openAsset(id),activate,close,keys:()=>[...tabs.keys()],active:()=>currentKey});
})(window);
