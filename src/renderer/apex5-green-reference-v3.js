'use strict';
/* APEX 5 Preview 3: user-approved green inventory concept, still an OFFLINE DEMO.
   Reuses production-derived controls and records, does not send network requests. */
(function(){
 const byId=id=>document.getElementById(id);
 const inventory=byId('inventoryPage');
 if(!inventory)return;
 const panel=inventory.querySelector('.ap5-v3-register-main > .section-panel');
 const filters=byId('ap5V3Filters'),actions=byId('ap5V3FilterActions');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function createSelect(id,placeholder){
  const sel=document.createElement('select');sel.id=id;sel.setAttribute('aria-label',placeholder);
  sel.innerHTML='<option value="">'+esc(placeholder)+'</option>';
  const wrap=document.createElement('label');wrap.className='ap5-v3-filter-field';wrap.setAttribute('aria-label',placeholder);wrap.appendChild(sel);filters.appendChild(wrap);
  sel.addEventListener('change',()=>{inventoryPageIndex=0;render();});
  return sel;
 }
 const type=createSelect('ap5V3TypeFilter','Device type');
 const brand=createSelect('ap5V3BrandFilter','Brand');
 function moveControl(id,label){
  const control=byId(id);if(!control)return;
  const wrapper=document.createElement('label');wrapper.className='ap5-v3-filter-field';wrapper.setAttribute('aria-label',label);wrapper.appendChild(control);
  filters.appendChild(wrapper);
 }
 moveControl('statusFilter','Status');
 moveControl('locationFilter','Location');
 const search=byId('inventorySearch');
 if(search){
  const wrap=document.createElement('label');wrap.className='ap5-v3-filter-field ap5-v3-search';wrap.setAttribute('aria-label','Search inventory');
  wrap.innerHTML='<span class="ap5-v3-search-icon" aria-hidden="true">⌕</span>';
  wrap.appendChild(search);search.placeholder='Search by asset ID, serial number, model…';
  filters.appendChild(wrap);
 }
 const toolbar=byId('selection-toolbar-inventory');
 const quick=byId('inventoryQuickFilters'),active=byId('inventoryActiveFilters');
 if(quick)panel.insertBefore(quick,filters);
 if(active)actions.appendChild(active);
 if(toolbar)actions.appendChild(toolbar);
 const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='ap5-v3-export';exportButton.textContent='↧  Export';exportButton.title='Export current inventory records';
 exportButton.onclick=()=>byId('settingsExport')?.click();
 actions.appendChild(exportButton);
 const reset=document.createElement('button');reset.type='button';reset.className='ap5-v3-clear';reset.textContent='♲  Clear filters';
 reset.onclick=()=>{for(const id of ['ap5V3TypeFilter','ap5V3BrandFilter','locationFilter','gradeFilter','palletFilter','repairFilter','inventorySearch']){const el=byId(id);if(el)el.value='';}if(byId('statusFilter'))byId('statusFilter').value='All statuses';inventoryPageIndex=0;render();};
 actions.prepend(reset);
 const sync=byId('ap5V3Sync');
 if(sync)sync.onclick=async()=>{if(sync.disabled)return;sync.disabled=true;const old=sync.innerHTML;sync.textContent='↻  Refreshing…';try{await refresh();}catch(e){console.warn('Demo refresh unavailable',e);}finally{sync.innerHTML=old;sync.disabled=false;}};
 const symbols={dashboard:'▦',inventory:'▱',bulk:'⌗',refurbWorkspace:'↻',dispatch:'⇥',reports:'▤',labelStudio:'▥'};
 for(const item of document.querySelectorAll('#apexSidebar .menu-item')){
  const sym=item.querySelector('.nav-symbol');if(sym&&symbols[item.dataset.page])sym.textContent=symbols[item.dataset.page];
 }
 function updateOptions(el,values,heading){
  const current=el.value,unique=[...new Set(values.map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  if(unique.join('\u0000')===el.dataset.options)return;
  el.dataset.options=unique.join('\u0000');el.replaceChildren();
  const first=document.createElement('option');first.value='';first.textContent=heading;el.appendChild(first);
  for(const value of unique){const opt=document.createElement('option');opt.value=value;opt.textContent=value;el.appendChild(opt);}
  el.value=unique.includes(current)?current:'';
 }
 function rebuildDeviceColumns(){
  const table=byId('inventoryTable')?.querySelector('table.asset-table');
  if(!table||table.dataset.ap5V3)return;table.dataset.ap5V3='1';
  const headings=[...table.tHead.rows[0].cells];
  const nameHeader=headings.find(th=>th.textContent.trim()==='Device / asset');
  const conditionHeader=headings.find(th=>th.textContent.trim()==='Condition');
  if(!nameHeader||!conditionHeader)return;
  nameHeader.textContent='Asset ID';
  const deviceHeader=document.createElement('th');deviceHeader.textContent='Device';
  const serialHeader=document.createElement('th');serialHeader.textContent='Serial number';
  nameHeader.after(deviceHeader,serialHeader);conditionHeader.remove();
  for(const row of [...table.tBodies[0].rows]){
   const idButton=row.querySelector('[data-asset]');if(!idButton)continue;
   const identity=idButton.closest('td');if(!identity)continue;
   const condition=row.querySelector('.condition-pill')?.closest('td');
   const originalModel=identity.querySelector('.apex-device-model b');
   const model=originalModel?.textContent?.trim()||'Unknown device';
   const serial=identity.querySelector('.apex-device-serial')?.textContent?.trim()||'—';
   const record=items.find(a=>String(a.id)===String(idButton.dataset.asset));
   const maker=String(record?.manufacturer||'').trim();
   const deviceCell=document.createElement('td');deviceCell.className='ap5-v3-device-cell';
   const icon=document.createElement('span');icon.className='ap5-v3-device-icon';icon.textContent='▱';icon.setAttribute('aria-hidden','true');
   const info=document.createElement('div');info.className='ap5-v3-device-info';
   const title=document.createElement('strong');title.textContent=model;
   const sub=document.createElement('small');sub.textContent=maker||record?.productType||'Laptop';
   info.append(title,sub);deviceCell.append(icon,info);
   if(condition){const badge=condition.querySelector('.condition-pill');if(badge){badge.classList.add('ap5-v3-inline-condition');info.appendChild(badge);}condition.remove();}
   const serialCell=document.createElement('td');serialCell.className='ap5-v3-serial';serialCell.textContent=serial;
   identity.replaceChildren(idButton);
   identity.classList.add('ap5-v3-asset-cell');
   identity.after(deviceCell,serialCell);
  }
  const header=table.tHead.rows[0];
  const status=[...header.cells].find(th=>th.textContent.trim()==='Status');
  if(status)status.textContent='Status';
  const action=[...header.cells].find(th=>['Action','Actions'].includes(th.textContent.trim()));
  if(action)action.textContent='Actions';
  table.classList.add('ap5-v3-asset-table');
 }
 function decorate(){
  updateOptions(type,items.map(a=>a.productType||'Laptop'),'Device type');
  updateOptions(brand,items.map(a=>a.manufacturer),'Brand');
  rebuildDeviceColumns();
  for(const [i,label] of [[0,'▱'],[1,'⌁'],[2,'♧'],[3,'▤'],[4,'✓'],[5,'⊘']]){
   const tab=byId('inventoryQuickFilters')?.querySelectorAll('.inventory-quick-chip')[i];
   if(tab&&!tab.querySelector('.ap5-v3-tab-icon')){const ico=document.createElement('span');ico.className='ap5-v3-tab-icon';ico.textContent=label;ico.setAttribute('aria-hidden','true');tab.prepend(ico);}
  }
 }
 const prior=render;
 render=function(...args){const output=prior(...args);decorate();return output;};
 decorate();
})();
