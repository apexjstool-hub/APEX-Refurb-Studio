'use strict';
// Whole-pallet storage is independent of device locations and device membership.
(function(){
 const host=$('palletLocationsContent');if(!host)return;
 let viewed=null,query='';
 const same=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
 const data=()=>window.ApexPalletLocationData||{names:[],available:false};
 const pallets=()=>managedPallets;
 const names=()=>[...new Set([...data().names,...pallets().map(p=>p.storageLocation).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const at=name=>pallets().filter(p=>same(p.storageLocation,name));
 const ready=()=>data().available&&!!api.createPalletLocation&&!!api.movePallets;
 function render(){
  const locations=names().filter(n=>n.toLowerCase().includes(query.toLowerCase()));
  host.innerHTML=`${ready()?'':'<div class="pl-notice" role="status">Pallet storage is not enabled on this connection yet. Update the shared hub, or apply the pallet-locations cloud migration.</div>'}<div class="section-panel pl-list"><div class="pl-list-heading management-toolbar"><div class="management-toolbar-title"><h3>Pallet locations</h3><span class="management-total">${names().length} ${names().length===1?'location':'locations'}</span></div><input type="search" id="plSearch" aria-label="Search pallet locations" placeholder="Search locations…" value="${html(query)}"><button type="button" class="primary" id="plAddLocation" ${!ready()?'disabled':''}>＋ Add pallet location</button><button type="button" class="secondary" id="plMove" ${!ready()||!pallets().length?'disabled':''}>Move pallets</button></div><div class="pl-scroll"><table class="asset-table"><thead><tr><th>Location name</th><th>Pallets</th><th class="storage-actions-heading">Actions</th></tr></thead><tbody>${locations.map(n=>`<tr><td><strong>${html(n)}</strong></td><td><span class="pl-count">${at(n).length}</span></td><td class="storage-actions-cell"><div class="storage-row-actions"><button type="button" class="secondary" data-pl-view="${html(n)}">View pallets</button> <button type="button" class="secondary" data-pl-assign="${html(n)}" ${!ready()||!pallets().length?'disabled':''}>Move pallets here</button> <button type="button" class="secondary pl-delete-location" data-pl-delete="${html(n)}" ${!ready()||at(n).length?'disabled':''} title="${at(n).length?'Move the pallets out before deleting this location.':'Delete this empty pallet location'}">Delete location</button></div></td></tr>`).join('')||'<tr><td colspan="3" class="pl-empty">No pallet locations found. Use Add pallet location to get started.</td></tr>'}<tr><td>Unassigned pallets</td><td><span class="pl-count">${at('').length}</span></td><td class="storage-actions-cell"><div class="storage-row-actions"><button type="button" class="secondary" data-pl-view="">View pallets</button></div></td></tr></tbody></table></div></div>`;
  $('plSearch').oninput=e=>{const pos=e.target.selectionStart;query=e.target.value;render();$('plSearch').focus();if(pos!==null)$('plSearch').setSelectionRange(pos,pos);};
  $('plMove').onclick=()=>move();
  host.querySelectorAll('[data-pl-view]').forEach(b=>b.onclick=()=>openLocation(b.dataset.plView));
  host.querySelectorAll('[data-pl-assign]').forEach(b=>b.onclick=()=>move([],b.dataset.plAssign));
  host.querySelectorAll('[data-pl-delete]').forEach(b=>b.onclick=()=>removeLocation(b.dataset.plDelete,b));

  $('plAddLocation').onclick=createLocation;
  window.ApexDeleteControls?.decorate(host);
 }
 function createLocation(){window.ApexManagementUI.createLocation('pallet');}

 async function removeLocation(name,button){
  if(at(name).length){notify('Move the pallets out before deleting this location.');return;}
  if(!api.deletePalletLocation){notify('Update this connection to enable pallet-location deletion.');return;}
  window.ApexManagementUI.confirmDelete({kind:'location',name,remove:()=>api.deletePalletLocation({name})});
 }
 function countInventory(pallet){return items.filter(a=>!a.deletedAt&&same(a.pallet,pallet.name)).length;}
 function openLocation(name){
  const before=viewed;viewed=name;
  if(!setPage('palletLocationDetail')){viewed=before;return false;}
  return true;
 }
 function openInventory(name){
  if(!pallets().some(p=>same(p.name,name))){notify('This pallet no longer exists. Refresh the location.');return;}
  window.ApexContainerInventory?.open('pallet',name,{returnPage:'palletLocationDetail'});
 }
 function renderDetail(){
  const detail=$('palletLocationDetailContent');if(!detail)return;
  const list=viewed===null?[]:at(viewed),total=list.reduce((n,p)=>n+countInventory(p),0);
  const canMove=viewed!==null&&ready()&&pallets().length>0;
  detail.innerHTML=`<button type="button" class="pl-back" id="plBackToLocations">← Pallet locations</button><section class="section-panel pl-location-pallets pl-location-table-panel"><div class="pl-detail-toolbar"><div class="pl-location-heading"><span class="pl-eyebrow">PALLET LOCATION</span><h1>${html(viewed===null?'Choose a location':viewed||'Unassigned pallets')}</h1></div><div class="pl-detail-toolbar-actions"><button type="button" class="secondary" id="plLocationRefresh">Refresh</button>${list.length?`<button type="button" class="primary" data-pl-detail-move ${!canMove?'disabled':''}>Move pallets here</button>`:''}</div></div><div class="pl-location-summary"><div><small>Pallets</small><strong>${list.length}</strong></div><div><small>Total inventory</small><strong>${total}</strong></div><p>Pallets remain available in the main Pallets register.</p></div>${list.length?`<div class="pl-location-table-scroll"><table class="asset-table"><thead><tr><th>Pallet number</th><th>Description</th><th>Created</th><th>Pallet location</th><th>Inventory</th><th class="storage-actions-heading">Actions</th></tr></thead><tbody>${list.map(p=>`<tr class="pl-pallet-row"><td><strong>${html(p.name)}</strong></td><td>${html(p.label||'—')}</td><td>${html(p.createdAt?new Date(p.createdAt).toLocaleDateString():'—')}</td><td>${html(p.storageLocation||'Unassigned')}</td><td class="pl-pallet-count"><strong>${countInventory(p)}</strong></td><td class="storage-actions-cell"><div class="storage-row-actions"><a href="#inventory" data-pl-inventory="${html(p.name)}">View inventory →</a><button type="button" class="secondary" data-pl-move="${html(p.name)}" ${!ready()?'disabled':''}>Move pallet</button><button type="button" class="secondary" data-pl-remove-pallet="${html(p.name)}" aria-label="Delete empty pallet ${html(p.name)}" title="Delete empty pallet">Delete empty pallet</button></div></td></tr>`).join('')}</tbody></table></div>`:`<div class="pl-location-empty"><span class="pl-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/></svg></span><h2>No pallets here yet</h2><p>${pallets().length?'Move pallets into this location to organise your stock.':'Create a pallet in Pallets, then move it into this location.'}</p><button type="button" class="primary" data-pl-detail-move ${!canMove?'disabled':''}>Move pallets here</button></div>`}</section>`;
  $('plBackToLocations').onclick=()=>setPage('palletLocations');
  $('plLocationRefresh').onclick=async()=>{const b=$('plLocationRefresh');b.disabled=true;try{await refresh();renderDetail();}finally{if(b.isConnected)b.disabled=false;}};
  detail.querySelectorAll('[data-pl-inventory]').forEach(a=>a.onclick=e=>{e.preventDefault();openInventory(a.dataset.plInventory);});
  detail.querySelectorAll('[data-pl-detail-move]').forEach(b=>b.onclick=()=>move([],viewed||''));
  detail.querySelectorAll('[data-pl-move]').forEach(b=>b.onclick=()=>move([b.dataset.plMove]));
  detail.querySelectorAll('[data-pl-remove-pallet]').forEach(b=>b.onclick=()=>window.ApexPalletPage.remove(b.dataset.plRemovePallet,b));
  window.ApexDeleteControls?.decorate(detail);
  if(currentPage==='palletLocationDetail')$('breadSub').textContent=viewed||'Unassigned pallets';
 }
 function move(initial=[],target=''){
  if(!ready()){notify('Enable pallet locations on your shared connection first.');return;}
  const list=pallets().map(p=>({...p}));
  if(!list.length){notify('Create a pallet first.');return;}
  showModal('Move pallets','INVENTORY / PALLET LOCATIONS',`<form id="plMoveForm" class="modal-body"><p>Move whole pallets. Their devices remain assigned, and the pallets stay visible in the Pallets register.</p><label class="field">Destination<select name="location"><option value="">Unassigned</option>${names().map(n=>`<option value="${html(n)}" ${same(n,target)?'selected':''}>${html(n)}</option>`).join('')}</select></label><div class="pl-select-heading"><label><input type="checkbox" id="plSelectAll"> Select all pallets</label><span id="plSelectionCount" aria-live="polite"></span></div><div class="pl-pick-list">${list.map(p=>`<label><input type="checkbox" name="pallet" value="${html(p.name)}" ${initial.some(n=>same(n,p.name))?'checked':''}><span><strong>${html(p.name)}</strong><small>${html(p.label||'No description')} · ${html(p.storageLocation||'Unassigned')}</small></span></label>`).join('')}</div><div id="plMoveError" class="form-error" role="alert"></div><div class="modal-actions"><button type="button" class="secondary" id="plCancel">Cancel</button><button type="submit" class="primary" id="plSaveMove" disabled>Move selected pallets</button></div></form>`);
  const form=$('plMoveForm'),boxes=[...form.querySelectorAll('[name=pallet]')],all=$('plSelectAll');
  const sync=()=>{const count=boxes.filter(b=>b.checked).length;$('plSelectionCount').textContent=count+' selected';$('plSaveMove').disabled=!count;all.checked=count===boxes.length;all.indeterminate=count>0&&count<boxes.length;};
  boxes.forEach(b=>b.onchange=sync);all.onchange=()=>{boxes.forEach(b=>b.checked=all.checked);sync();};sync();$('plCancel').onclick=closeModal;
  form.onsubmit=async e=>{
   e.preventDefault();const names=boxes.filter(b=>b.checked).map(b=>b.value);if(!names.length)return;
   const button=$('plSaveMove');button.disabled=true;
   try{const r=await api.movePallets({names,location:form.elements.location.value,expected:names.map(name=>({name,location:list.find(p=>same(p.name,name)).storageLocation||''}))});if(!r.ok){$('plMoveError').textContent=r.error||'Could not move pallets.';return;}closeModal();await refresh();notify(`${r.moved||names.length} pallet(s) moved`);}
   catch{if($('plMoveError'))$('plMoveError').textContent='Unable to save. Refresh before trying again.';}finally{if(button.isConnected)sync();}
  };
 }
 window.ApexPalletLocations={render:()=>{render();renderDetail();},move,open:openLocation};
 const previous=setPage;setPage=function(page,force){const ok=previous(page,force);if(ok&&page==='palletLocations')render();if(ok&&page==='palletLocationDetail')renderDetail();return ok;};
 render();renderDetail();
})();
