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
  const locations=names().filter(n=>n.toLowerCase().includes(query.toLowerCase())),selected=viewed!==null?at(viewed):[];
  host.innerHTML=`${ready()?'':'<div class="pl-notice" role="status">Pallet storage is not enabled on this connection yet. Update the shared hub, or apply the pallet-locations cloud migration.</div>'}<div class="pl-heading"><div><h2>Storage overview</h2><p>${names().length} location${names().length===1?'':'s'} · ${pallets().length} pallets · ${at('').length} unassigned</p></div><button type="button" class="primary" id="plMove" ${!ready()||!pallets().length?'disabled':''}>Move pallets</button></div><form id="plCreateForm" class="pl-create"><label for="plName">New pallet location</label><input id="plName" name="name" maxlength="90" placeholder="e.g. Warehouse A — Rack 2" required ${!ready()?'disabled':''}><button type="submit" class="secondary" ${!ready()?'disabled':''}>Add location</button><span id="plCreateError" role="alert"></span></form><div class="section-panel pl-list"><div class="pl-list-heading"><h3>Pallet locations</h3><input type="search" id="plSearch" aria-label="Search pallet locations" placeholder="Search locations…" value="${html(query)}"></div><div class="pl-scroll"><table class="asset-table"><thead><tr><th>Location name</th><th>Pallets</th><th>Actions</th></tr></thead><tbody>${locations.map(n=>`<tr><td><strong>${html(n)}</strong></td><td><span class="pl-count">${at(n).length}</span></td><td><button type="button" class="secondary" data-pl-view="${html(n)}">View pallets</button> <button type="button" class="secondary" data-pl-assign="${html(n)}" ${!ready()||!pallets().length?'disabled':''}>Move pallets here</button></td></tr>`).join('')||'<tr><td colspan="3" class="pl-empty">No pallet locations found. Add a location above to get started.</td></tr>'}<tr><td>Unassigned pallets</td><td><span class="pl-count">${at('').length}</span></td><td><button type="button" class="secondary" data-pl-view="">View pallets</button></td></tr></tbody></table></div></div>${viewed===null?'':`<div class="section-panel pl-detail"><div class="pl-list-heading"><div><h3>${html(viewed||'Unassigned pallets')}</h3><p>${selected.length} pallet${selected.length===1?'':'s'}</p></div><button type="button" class="secondary" id="plCloseDetail">Close</button></div><div class="pl-scroll"><table class="asset-table"><thead><tr><th>Pallet</th><th>Description</th><th>Devices</th><th></th></tr></thead><tbody>${selected.map(p=>`<tr><td><strong>${html(p.name)}</strong></td><td>${html(p.label||'—')}</td><td>${Number(p.assets)||items.filter(a=>same(a.pallet,p.name)).length}</td><td><button type="button" class="secondary" data-pl-move="${html(p.name)}" ${!ready()?'disabled':''}>Move pallet</button></td></tr>`).join('')||'<tr><td colspan="4" class="pl-empty">No pallets in this location.</td></tr>'}</tbody></table></div></div>`}`;
  $('plSearch').oninput=e=>{const pos=e.target.selectionStart;query=e.target.value;render();$('plSearch').focus();if(pos!==null)$('plSearch').setSelectionRange(pos,pos);};
  $('plMove').onclick=()=>move();
  host.querySelectorAll('[data-pl-view]').forEach(b=>b.onclick=()=>{viewed=b.dataset.plView;render();});
  host.querySelectorAll('[data-pl-assign]').forEach(b=>b.onclick=()=>move([],b.dataset.plAssign));
  host.querySelectorAll('[data-pl-move]').forEach(b=>b.onclick=()=>move([b.dataset.plMove]));
  if($('plCloseDetail'))$('plCloseDetail').onclick=()=>{viewed=null;render();};
  $('plCreateForm').onsubmit=async e=>{
   e.preventDefault();const form=e.currentTarget,button=form.querySelector('button'),name=form.elements.name.value.trim();if(!name||!ready())return;
   button.disabled=true;
   try{const r=await api.createPalletLocation({name});if(!r.ok){$('plCreateError').textContent=r.error||'Could not create location.';return;}await refresh();notify('Pallet location created');}
   catch{$('plCreateError').textContent='Unable to save. Refresh and try again.';}finally{if(button.isConnected)button.disabled=false;}
  };
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
 window.ApexPalletLocations={render,move};
 const previous=setPage;setPage=function(page,force){const ok=previous(page,force);if(ok&&page==='palletLocations')render();return ok;};
 render();
})();
