'use strict';
(function(){
 function createLocation(kind='device'){
  const pallet=kind==='pallet',title=pallet?'Add pallet location':'Add location';
  showModal(title,pallet?'INVENTORY / PALLET LOCATIONS':'INVENTORY / LOCATIONS',`<form id="managementLocationForm" class="modal-body management-create-form"><p>${pallet?'Create a storage location for whole pallets.':'Create a location for devices. You can assign devices after creating it.'}</p><label class="field" for="managementLocationName">Location name<input id="managementLocationName" name="name" maxlength="90" placeholder="${pallet?'e.g. Warehouse A — Rack 2':'e.g. Repair Room 2'}" autocomplete="off" required></label><div id="managementLocationError" class="form-error" role="alert"></div><div class="modal-actions"><button type="button" class="secondary" id="managementLocationCancel">Cancel</button><button type="submit" class="primary">Create location</button></div></form>`);
  const form=$('managementLocationForm');$('managementLocationCancel').onclick=closeModal;$('managementLocationName').focus();
  form.onsubmit=async e=>{
   e.preventDefault();const name=form.elements.name.value.trim().replace(/\s+/g,' '),error=$('managementLocationError'),button=form.querySelector('[type=submit]');if(!name)return;
   if(!pallet&&name.toLowerCase()==='unassigned'){error.textContent='Unassigned is used automatically when a device has no location.';return;}
   button.disabled=true;error.textContent='';
   try{
    const result=pallet?await api.createPalletLocation({name}):await api.addLocation(name);
    if(!result.ok){if(error.isConnected)error.textContent=result.error||'Could not create location.';return;}
    if(form.isConnected)closeModal();await refresh();notify(pallet?'Pallet location created':'Location created');
   }catch{if(error.isConnected)error.textContent='Unable to save. Refresh and try again.';}
   finally{if(button.isConnected)button.disabled=false;}
  };
 }
 function confirmDelete({kind,name,remove}){
  const pallet=kind==='pallet',noun=pallet?'pallet':'pallet location',title=pallet?'Delete pallet':'Delete pallet location';
  showModal(title,pallet?'INVENTORY / PALLETS':'INVENTORY / PALLET LOCATIONS',`<form id="managementDeleteForm" class="modal-body v344-location-dialog management-delete-form"><p>Delete <strong>${html(name)}</strong> from the ${pallet?'pallet list':'pallet location list'}?</p><p>This ${noun} is empty and can be deleted immediately.</p><p class="v344-location-warning">${pallet?'This removes the pallet name. Laptop records and refurbishment information will not be deleted. Pallets containing laptops cannot be deleted.':'This removes the pallet location name. Pallets, laptop records and refurbishment information will not be deleted. Move all pallets out before deleting a location.'}</p><div id="managementDeleteError" class="form-error" role="alert"></div><div class="modal-actions"><button type="button" class="secondary" id="managementDeleteCancel">Cancel</button><button type="submit" class="v344-confirm-delete" id="managementDeleteConfirm">Delete ${noun}</button></div></form>`);
  const form=$('managementDeleteForm'),cancel=$('managementDeleteCancel'),button=$('managementDeleteConfirm'),error=$('managementDeleteError');let pending=false;
  window.ApexDeleteControls.decorate(form);cancel.onclick=closeModal;cancel.focus();
  form.onsubmit=async e=>{
   e.preventDefault();if(pending)return;pending=true;form.setAttribute('aria-busy','true');button.querySelector('span').textContent='Deleting…';button.disabled=true;cancel.disabled=true;$('modalClose').classList.add('hidden');error.textContent='';
   try{
    const result=await remove();
    if(!result.ok){if(error.isConnected)error.textContent=result.error||'Could not delete this '+noun+'.';return;}
    if(form.isConnected)closeModal();await refresh();notify(pallet?'Pallet deleted':'Pallet location deleted');
   }catch{if(error.isConnected)error.textContent='Unable to confirm deletion. Refresh before trying again.';}
   finally{pending=false;if(form.isConnected){form.setAttribute('aria-busy','false');button.querySelector('span').textContent='Delete '+noun;button.disabled=false;cancel.disabled=false;$('modalClose').classList.remove('hidden');}}
  };
 }
 $('apexAddLocation').onclick=()=>createLocation();
 window.ApexManagementUI={createLocation,confirmDelete};
})();
