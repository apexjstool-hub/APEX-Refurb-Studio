'use strict';
/* Phase 4 — per-PC Inventory view preferences and sorting. */
(function(){
 const key='apex.inventory.saved-views.v1',sortKey='apex.inventory.sort.v1';
 const $=id=>document.getElementById(id);
 const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const ids=['inventorySearch','locationFilter','gradeFilter','statusFilter','palletFilter','repairFilter'];
 let views=[],selected='',isRestoring=false;
 const read=(k,otherwise)=>{try{const str=localStorage.getItem(k);return str?JSON.parse(str):otherwise;}catch{return otherwise;}};
 const write=(k,value)=>{try{localStorage.setItem(k,JSON.stringify(value));return true;}catch{notify('Local view preferences could not be saved on this PC.');return false;}};
 const persisted=read(key,[]);
 if(Array.isArray(persisted))views=persisted.filter(v=>v&&typeof v.name==='string'&&v.name.length<=60&&v.settings&&typeof v.settings==='object').slice(0,12);
 const existingSort=read(sortKey,null);
 if(existingSort){try{window.ApexInventorySort.configure(existingSort.key,existingSort.direction);}catch{}}
 function settings(){const filters=Object.fromEntries(ids.map(id=>[id,$(id)?.value||'']));return {filters,sort:window.ApexInventorySort.get(),density:$('apexInventoryDensity')?.value||'compact'};}
 function controls(){
  const toolbar=$('selection-toolbar-inventory');if(!toolbar)return null;
  let bar=$('inventoryViewControls');if(bar)return bar;
  bar=document.createElement('div');bar.id='inventoryViewControls';bar.className='inventory-view-controls';
  bar.innerHTML='<label for="inventorySavedViews">Saved view</label><select id="inventorySavedViews" aria-label="Choose saved Inventory view"><option value="">Current view</option></select><button type="button" id="inventorySaveView" class="secondary">Save view</button><button type="button" id="inventoryRemoveView" class="secondary" disabled aria-label="Delete selected saved view">Delete saved view</button>';
  const quick=$('inventoryQuickFilters'),active=$('inventoryActiveFilters');
  if(active)active.after(bar);else if(quick)quick.after(bar);else toolbar.after(bar);
  $('inventorySavedViews').onchange=()=>{const name=$('inventorySavedViews').value;selected=name;if(name)apply(name);else $('inventoryRemoveView').disabled=true;};
  $('inventorySaveView').onclick=saveDialog;
  $('inventoryRemoveView').onclick=removeDialog;
  refreshViews();
  return bar;
 }
 function refreshViews(){
  const input=$('inventorySavedViews');if(!input)return;
  const previous=selected;
  input.innerHTML='<option value="">Current view</option>'+views.map(v=>'<option value="'+safe(v.name)+'">'+safe(v.name)+'</option>').join('');
  if(views.some(v=>v.name===previous))input.value=previous;else{selected='';input.value='';}
  $('inventoryRemoveView').disabled=!selected;
 }
 function apply(name){
  const view=views.find(v=>v.name===name);if(!view)return;
  isRestoring=true;
  try{
   // Refresh dynamic Location/Pallet dropdowns without discarding saved choices.
   const choices=view.settings.filters||{};
   for(const id of ids){const el=$(id);if(!el)continue;const value=String(choices[id]||'');el.value=[...el.options||[]].length&&!([...el.options].some(o=>o.value===value))?'':value;}
   const sort=view.settings.sort||{};
   if(sort.key)window.ApexInventorySort.configure(sort.key,sort.direction);
   const density=$('apexInventoryDensity');if(density&&['compact','comfortable'].includes(view.settings.density)){
    density.value=view.settings.density;
    density.dispatchEvent(new Event('change',{bubbles:true}));
   }
   write(sortKey,window.ApexInventorySort.get());
   inventoryPageIndex=0;
  }finally{isRestoring=false;}
  render();
  decorate();
 }
 function saveDialog(){
  showModal('Save inventory view','INVENTORY / VIEW SETTINGS','<form class="modal-body" id="inventorySaveViewForm"><p>Save the current filters, sorting and row spacing on this PC. No inventory data is changed.</p><label class="field">View name<input id="inventoryViewName" maxlength="60" required autocomplete="off" placeholder="e.g. Awaiting respray"></label><p id="inventoryViewError" role="alert" class="form-error"></p><div class="modal-actions"><button type="button" class="secondary" id="inventoryViewCancel">Cancel</button><button type="submit" class="primary">Save view</button></div></form>');
  $('inventoryViewCancel').onclick=closeModal;
  $('inventorySaveViewForm').onsubmit=e=>{
   e.preventDefault();const name=$('inventoryViewName').value.trim();
   if(!name){$('inventoryViewError').textContent='Enter a view name.';return;}
   if(views.length>=12&&!views.some(v=>v.name.toLowerCase()===name.toLowerCase())){$('inventoryViewError').textContent='You can save up to 12 views. Delete one first.';return;}
   const old=views.findIndex(v=>v.name.toLowerCase()===name.toLowerCase());
   if(old>=0)views.splice(old,1);
   views.push({name,settings:settings()});
   if(write(key,views)){selected=name;refreshViews();closeModal();notify('Inventory view saved to this PC.');}
  };
 }
 function removeDialog(){
  if(!selected)return;const name=selected;
  showModal('Delete saved view','INVENTORY / VIEW SETTINGS','<div class="modal-body"><p>Delete the saved view <b>'+safe(name)+'</b>? This removes only local display preferences and does not delete any devices or refurbishment records.</p><div class="modal-actions"><button id="inventoryKeepView" type="button" class="secondary">Cancel</button><button id="inventoryConfirmViewDelete" type="button" class="primary">Delete saved view</button></div></div>');
  $('inventoryKeepView').onclick=closeModal;
  $('inventoryConfirmViewDelete').onclick=()=>{const next=views.filter(v=>v.name!==name);if(write(key,next)){views=next;selected='';refreshViews();closeModal();notify('Saved view deleted.');}};
 }
 const headings=[['Device / asset','device'],['Condition','condition'],['Location','location'],['Pallet','pallet'],['Status','status'],['Repair progress','repair'],['Time waiting','waiting']];
 function decorate(){
  controls();
  const table=$('inventoryTable')?.querySelector('table');if(!table||table.dataset.apexSortDecorated)return;
  table.dataset.apexSortDecorated='1';
  const chosen=window.ApexInventorySort.get();
  for(const [title,key] of headings){
   const cell=[...table.tHead.rows[0].cells].find(th=>th.textContent.trim()===title);
   if(!cell)continue;
   const label=cell.textContent;cell.textContent='';cell.classList.add('apex-sort-heading');
   const button=document.createElement('button');button.type='button';button.className='apex-sort-button';button.dataset.apexSort=key;
   const isActive=chosen.key===key;
   button.textContent=label+(isActive?(chosen.direction==='asc'?' ↑':' ↓'):' ↕');
   button.title='Sort Inventory by '+label;
   cell.setAttribute('aria-sort',isActive?(chosen.direction==='asc'?'ascending':'descending'):'none');
   button.onclick=()=>{
    const current=window.ApexInventorySort.get(),dir=current.key===key&&current.direction==='asc'?'desc':'asc';
    window.ApexInventorySort.configure(key,dir);
    write(sortKey,window.ApexInventorySort.get());
    inventoryPageIndex=0;selected='';refreshViews();render();
   };
   cell.append(button);
  }
 }
 const previousRender=render;
 render=function(...args){const result=previousRender(...args);decorate();return result;};
 document.addEventListener('DOMContentLoaded',decorate,{once:true});
 decorate();
})();
