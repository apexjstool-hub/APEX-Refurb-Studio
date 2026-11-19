'use strict';
// Bulk Location is deliberately distinct from physical pallet transfers.
// It only changes the direct Location field and leaves pallet membership intact.
(function(){
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const read=raw=>(window.ApexAssetLabelQR?.readAssetId(raw)||String(raw||'').trim()).toUpperCase();
 let busy=false;
 async function open(initial=[]){
  if(busy)return;
  const valid=()=>items.filter(a=>!a.deletedAt);
  const chosen=new Set(initial.map(read).filter(Boolean));
  const savedLocations=[...new Set([...managedLocations,...valid().map(a=>a.location)].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  showModal('Bulk set asset location','INVENTORY / LOCATION ONLY',`<div class="modal-body apex-bulk-modal">
   <p class="section-note">Set the <strong>Location</strong> field on many laptops at once. Existing pallet numbers and pallet storage locations are preserved. This does not physically move pallets.</p>
   <label class="field">Which assets?<select id="apexLocationScope"><option value="selected">Selected / scanned assets</option><option value="all">All active inventory assets</option></select></label>
   <form id="apexLocationScanForm" class="apex-bulk-scan"><label class="field" for="apexLocationScan">Scan / enter Asset ID<input id="apexLocationScan" autocomplete="off" spellcheck="false" placeholder="Scan barcode then press Enter"></label><button type="submit" class="secondary">Add</button></form>
   <div class="apex-bulk-summary"><strong id="apexLocationCount"></strong><button type="button" class="secondary" id="apexLocationClear">Clear selection</button></div>
   <div class="apex-bulk-devices" id="apexLocationDevices" aria-live="polite"></div>
   <label class="field" for="apexLocationTarget">New asset location<input id="apexLocationTarget" list="apexLocationOptions" maxlength="90" placeholder="Choose or enter an existing location" autocomplete="off" required></label>
   <datalist id="apexLocationOptions">${savedLocations.map(n=>'<option value="'+esc(n)+'"></option>').join('')}</datalist>
   <p class="section-note">To use a new location, create it under <strong>Locations → Add location</strong> first. This action will not delete any pallet assignment.</p>
   <label class="field"><span><input type="checkbox" id="apexLocationConfirm"> I understand this updates the asset Location field only, and keeps pallet assignments unchanged.</span></label>
   <div id="apexLocationReview" class="apex-bulk-review" role="status"></div>
   <p class="form-error" id="apexLocationError" role="alert"></p>
   <div class="modal-actions"><button type="button" class="secondary" id="apexLocationCancel">Cancel</button><button type="button" class="primary" id="apexLocationApply" disabled>Update asset locations</button></div>
  </div>`);
  const scope=$('apexLocationScope'),target=$('apexLocationTarget'),apply=$('apexLocationApply'),scan=$('apexLocationScan');
  if(!chosen.size)scope.value='all';
  const chosenAssets=()=>scope.value==='all'?valid():valid().filter(a=>chosen.has(read(a.id)));
  function render(){
   const list=chosenAssets(),all=scope.value==='all';
   $('apexLocationScanForm').hidden=all;$('apexLocationClear').hidden=all;
   $('apexLocationCount').textContent=list.length+' asset(s) '+(all?'in active inventory':'selected');
   $('apexLocationDevices').innerHTML=all?'<p class="section-note">All active inventory is selected. Existing pallet memberships will be kept.</p>':list.length?list.slice(0,30).map(a=>'<div class="apex-bulk-device"><div><b>'+esc(a.id)+'</b><small>'+esc(a.pallet?'Pallet '+a.pallet:'No pallet')+' · '+esc(a.location)+'</small></div><button type="button" class="secondary" data-location-remove="'+esc(a.id)+'" aria-label="Remove '+esc(a.id)+'">×</button></div>').join('')+(list.length>30?'<p class="section-note">+'+(list.length-30)+' more selected</p>':''):'<p class="section-note">Scan or select assets to begin.</p>';
   const destination=savedLocations.find(n=>n.toLowerCase()===target.value.trim().toLowerCase());
   const changing=list.filter(a=>destination&&a.location!==destination);
   $('apexLocationReview').textContent=list.length?(destination?changing.length+' asset(s) will have their Location changed; '+(list.length-changing.length)+' already match. All pallet assignments remain unchanged.':'Enter an existing asset location above.'):'No active assets selected.';
   apply.disabled=busy||!list.length||!destination||!changing.length||!$('apexLocationConfirm').checked;
  }
  scope.onchange=render;target.oninput=render;$('apexLocationConfirm').onchange=render;
  $('apexLocationClear').onclick=()=>{chosen.clear();render();scan.focus();};
  $('apexLocationDevices').onclick=e=>{const b=e.target.closest('[data-location-remove]');if(b){chosen.delete(b.dataset.locationRemove);render();}};
  $('apexLocationScanForm').onsubmit=e=>{
   e.preventDefault();
   const id=read(scan.value);scan.value='';
   if(!id)return;const asset=valid().find(a=>read(a.id)===id);
   if(!asset){$('apexLocationError').textContent='Asset '+id+' is not in the current inventory.';return;}
   chosen.add(id);$('apexLocationError').textContent='';render();scan.focus();
  };
  $('apexLocationCancel').onclick=()=>{if(!busy)closeModal();};
  apply.onclick=async()=>{
   if(busy||apply.disabled)return;
   const destination=savedLocations.find(n=>n.toLowerCase()===target.value.trim().toLowerCase());
   if(!destination)return;
   const list=chosenAssets();
   const pending=list.filter(a=>a.location!==destination);
   if(!pending.length)return;
   busy=true;apply.disabled=true;$('apexLocationCancel').disabled=true;scope.disabled=true;target.disabled=true;
   let total=0,done=0;
   try{
    // Server accepts up to 300 per transaction. For larger inventories, continue
    // in sequential batches; show partial progress rather than claiming atomicity.
    for(let i=0;i<pending.length;i+=300){
     const batch=pending.slice(i,i+300);
     $('apexLocationReview').textContent='Updating '+(i+1)+'–'+Math.min(i+300,pending.length)+' of '+pending.length+' assets…';
     const result=await api.bulkSetAssetLocation({ids:batch.map(a=>a.id),location:destination,expectedAssignments:batch.map(a=>({id:a.id,location:a.location,pallet:a.pallet,updatedAt:a.updatedAt}))});
     if(!result.ok){total+=Number(result.updated||0);throw Error(result.error||'Location update failed. '+total+' asset(s) were updated; refresh before retrying.');}
     total+=Number(result.updated||0);done+=batch.length;
    }
    notify(total+' asset location(s) updated. Pallets unchanged.');
    closeModal();await refresh();
   }catch(error){
    $('apexLocationError').textContent=error.message+' Changes already saved to the cloud cannot be automatically rolled back.';
    await refresh().catch(()=>{});
   }finally{
    busy=false;if($('apexLocationCancel'))$('apexLocationCancel').disabled=false;
    if(scope.isConnected){scope.disabled=false;target.disabled=false;render();}
   }
  };
  render();if(scope.value==='selected')scan.focus();else target.focus();
 }
 window.ApexBulkAssetLocation=Object.freeze({open});
})();
