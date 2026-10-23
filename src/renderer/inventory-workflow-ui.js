'use strict';
(function(){
 let snapshot=null,summaries=new Map();
 const state=()=>window.ApexWorkflowSnapshot||null;
 function current(){const next=state();if(next!==snapshot){snapshot=next;summaries=window.ApexInventoryWorkflow.index(next||{});}return snapshot;}
 const info=id=>{current();return summaries.get(id)||window.ApexInventoryWorkflow.summarize(null);};
 const toolbar=$('inventoryPage').querySelector('.toolbar');
 toolbar.insertAdjacentHTML('beforeend','<select id="palletFilter" aria-label="Filter by pallet"><option value="">All pallets</option></select><select id="repairFilter" aria-label="Filter by repair progress"><option value="">All repair stages</option><option value="order">Needs ordering</option><option value="delivery">Parts ordered / awaiting delivery</option><option value="fit">Ready to fit / fitting</option><option value="qc">Awaiting QC</option><option value="hold">On hold</option><option value="completed">Completed</option><option value="none">No refurb job</option></select>');
 for(const id of ['palletFilter','repairFilter'])$(id).onchange=()=>{inventoryPageIndex=0;render();};
 function decorate(){
  const picker=$('palletFilter'),previous=picker.value,names=[...new Set([...managedPallets.map(p=>p.name),...items.map(a=>a.pallet).filter(Boolean)])].sort();picker.innerHTML='<option value="">All pallets</option>'+names.map(n=>`<option value="${html(n)}">${html(n)}</option>`).join('');picker.value=names.includes(previous)?previous:'';
  const table=$('inventoryTable').querySelector('table');if(!table||table.dataset.tracker)return;table.dataset.tracker='1';current();
  const header=table.tHead.rows[0];const pal=document.createElement('th');pal.textContent='Pallet';header.insertBefore(pal,header.cells[4]);const progress=document.createElement('th');progress.textContent='Repair progress';header.insertBefore(progress,header.lastElementChild);
  const assetsById=new Map(items.map(a=>[a.id,a]));
  for(const row of [...table.tBodies[0].rows]){
   const id=row.querySelector('[data-asset]')?.dataset.asset;if(!id)continue;const s=info(id),asset=assetsById.get(id),pallet=document.createElement('td');pallet.textContent=asset?.pallet||'—';row.insertBefore(pallet,row.cells[4]);
   const cell=document.createElement('td');cell.className='inventory-repair-cell';cell.innerHTML=`<span class="inventory-stage inventory-stage-${s.key}" title="${html(snapshot?s.next:'Workflow is loading')}">${html(snapshot?s.stage:'Loading workflow…')}</span>`;row.insertBefore(cell,row.lastElementChild);
  }
 }

 window.ApexInventoryTracker={decorate,matches:a=>{if($('palletFilter').value&&String(a.pallet||'').trim().toUpperCase()!==$('palletFilter').value.trim().toUpperCase())return false;const filter=$('repairFilter').value;if(!filter)return true;const s=info(a.id);if(['order','delivery','fit'].includes(filter)){if(['completed','hold'].includes(s.key))return false;return (filter==='order'?s.needsOrdering:filter==='delivery'?s.awaitingDelivery:s.toFit)>0;}return s.key===filter;}};
 window.addEventListener('apex:workflow-updated',()=>{if(currentPage==='inventory')render();});
 const pals=()=>managedPallets;
 function renderPallets(){const list=pals(),counts=new Map();for(const a of items){const key=String(a.pallet||'').toUpperCase();counts.set(key,(counts.get(key)||0)+1);}$('apexPalletTable').innerHTML=list.length?`<table class="asset-table"><thead><tr><th>Pallet number</th><th>Description</th><th>Created</th><th>Pallet location</th><th>Devices</th><th class="storage-actions-heading">Actions</th></tr></thead><tbody>${list.map(p=>`<tr><td><strong>${html(p.name)}</strong></td><td>${html(p.label||'—')}</td><td>${html(p.createdAt?new Date(p.createdAt).toLocaleDateString():'—')}</td><td>${html(p.storageLocation||'Unassigned')}</td><td>${counts.get(p.name.toUpperCase())||0}</td><td class="storage-actions-cell"><div class="storage-row-actions"><button class="secondary" type="button" data-pallet-show="${html(p.name)}">View devices</button> <button class="secondary" type="button" data-pallet-rename="${html(p.name)}">Rename</button> <button class="secondary" type="button" data-pallet-location="${html(p.name)}">Move pallet</button> <button class="secondary" type="button" data-pallet-delete="${html(p.name)}">Delete empty pallet</button></div></td></tr>`).join('')}</tbody></table>`:'<div class="empty"><strong>No pallets yet</strong>Create a pallet, then assign devices from their Overview page.</div>';
  $('apexPalletTable').querySelectorAll('[data-pallet-rename]').forEach(b=>b.onclick=()=>renamePallet(b.dataset.palletRename));
  $('apexPalletTable').querySelectorAll('[data-pallet-location]').forEach(b=>b.onclick=()=>window.ApexPalletLocations?.move([b.dataset.palletLocation]));
  $('apexPalletTable').querySelectorAll('[data-pallet-show]').forEach(b=>b.onclick=()=>window.ApexContainerInventory?.open('pallet',b.dataset.palletShow));
  $('apexPalletTable').querySelectorAll('[data-pallet-delete]').forEach(b=>b.onclick=()=>removePallet(b.dataset.palletDelete,b));
 }
 function renamePallet(name){
  const count=items.filter(a=>!a.deletedAt&&String(a.pallet||'').trim().toUpperCase()===name.trim().toUpperCase()).length;
  showModal('Rename pallet','INVENTORY / PALLETS',`<form id="renamePalletForm" class="modal-body"><p>Rename <b>${html(name)}</b>. The pallet name in all ${count} assigned device(s) will update too.</p><label class="field">Pallet name or number<input name="newName" value="${html(name)}" maxlength="80" required autocomplete="off"></label><p class="section-note">After renaming, print a new pallet label to scan the new name.</p><div id="renamePalletError" class="form-error" role="alert"></div><div class="modal-actions"><button id="renamePalletCancel" type="button" class="secondary">Cancel</button><button type="submit" class="primary">Save pallet name</button></div></form>`);
  $('renamePalletCancel').onclick=closeModal;
  $('renamePalletForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;$('renamePalletCancel').disabled=true;
   try{const r=await api.renamePallet({name,newName:form.elements.newName.value});if(!r.ok){$('renamePalletError').textContent=r.error||'Unable to rename pallet.';return;}closeModal();await refresh();notify('Pallet renamed; assigned devices updated.');}
   catch{if($('renamePalletError'))$('renamePalletError').textContent='Rename could not be confirmed. Refresh before retrying.';}
   finally{button.disabled=false;if($('renamePalletCancel'))$('renamePalletCancel').disabled=false;}
  };
 }
 async function removePallet(name,button){
  if(items.some(a=>!a.deletedAt&&String(a.pallet||'').toUpperCase()===String(name).toUpperCase())){notify('Move the devices off this pallet before deleting it.');return;}
  window.ApexManagementUI.confirmDelete({kind:'pallet',name,remove:()=>api.deletePallet({name})});
 }
 function createPallet(onCreated){
  const next=window.ApexPalletManagement.nextPalletId({items,pallets:managedPallets}),openedAt=new Date();
  showModal('Create refurbishment pallet','INVENTORY / PALLETS',`<form id="apexPalletForm" class="modal-body"><div class="pallet-creation-facts"><label class="field pallet-name-field">Pallet name or number<input id="apexPalletNumber" name="name" type="text" maxlength="80" value="${html(next)}" required autocomplete="off"><small>Use your own name or keep the suggested number.</small></label><div><small>Creation date</small><strong>${html(openedAt.toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}))}</strong></div></div><label class="field">Description<input name="label" maxlength="90" placeholder="Optional pallet description"></label><div id="apexPalletError" class="form-error" role="alert"></div><div class="modal-actions"><button id="apexPalletCancel" type="button" class="secondary">Cancel</button><button type="submit" class="primary">Create pallet</button></div></form>`);
  $('apexPalletCancel').onclick=closeModal;
  $('apexPalletForm').onsubmit=async e=>{
   e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;
   try{
    const name=form.elements.name.value.trim().replace(/\s+/g,' ');
    const r=await api.createPallet({name,label:form.elements.label.value});
    if(!r.ok){$('apexPalletError').textContent=r.error||'Could not create pallet.';return;}
    const created=r.pallet||{name};closeModal();await refresh();if(onCreated)onCreated(created);else notify('Pallet created');
   }catch{if($('apexPalletError'))$('apexPalletError').textContent='Could not confirm pallet creation. Refresh before retrying.';}
   finally{button.disabled=false;}
  };
 }
 $('apexCreatePallet').onclick=()=>createPallet();
 window.ApexPalletPage={render:renderPallets,create:createPallet,rename:renamePallet,remove:removePallet};
 $('editPallet').addEventListener('change',()=>{if($('editPallet').value)$('editLocation').value='Unassigned';dirty=true;updateAssetOverview();});
 $('editLocation').addEventListener('change',()=>{if($('editLocation').value!=='Unassigned')$('editPallet').value='';dirty=true;updateAssetOverview();});
 decorate();renderPallets();
 if(!$('appPage').classList.contains('hidden'))window.ApexOps?.load(true);
})();
