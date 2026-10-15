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
 $('apexAddLocation').onclick=()=>createLocation();
 window.ApexManagementUI={createLocation};
})();
