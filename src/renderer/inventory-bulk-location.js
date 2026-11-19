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
  let savedLocations=[...new Set([...managedLocations,...valid().map(a=>a.location)].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  showModal('Bulk set asset location','INVENTORY / LOCATION ONLY',`<div class="modal-body apex-bulk-modal">
   <p class="section-note">Scan a <strong>pallet barcode</strong> to select every active asset assigned to it, or scan individual asset barcodes. Set the <strong>Location</strong> field on many laptops at once. Existing pallet numbers and pallet storage locations are preserved. This does not physically move pallets.</p>
   <label class="field">Which assets?<select id="apexLocationScope"><option value="selected">Selected / scanned assets</option><option value="all">All active inventory assets</option></select></label>
   <form id="apexLocationScanForm" class="apex-bulk-scan"><label class="field" for="apexLocationScan">Scan / enter Asset ID or pallet<input id="apexLocationScan" autocomplete="off" spellcheck="false" placeholder="Scan pallet or asset barcode, then press Enter"></label><button type="submit" class="secondary">Add</button></form>
   <p class="section-note" id="apexLocationScanStatus" role="status">Pallet scans add every active asset assigned to that pallet without changing the pallet itself.</p>
   <div class="apex-bulk-summary"><strong id="apexLocationCount"></strong><button type="button" class="secondary" id="apexLocationClear">Clear selection</button></div>
   <div class="apex-bulk-devices" id="apexLocationDevices" aria-live="polite"></div>
   <label class="field" for="apexLocationTarget">New asset location<input id="apexLocationTarget" list="apexLocationOptions" maxlength="90" placeholder="Choose or enter an existing location" autocomplete="off" required></label>
   <datalist id="apexLocationOptions">${savedLocations.map(n=>'<option value="'+esc(n)+'"></option>').join('')}</datalist>
   <div class="modal-actions"><button type="button" class="secondary" id="apexLocationCreate">+ Create new asset location</button><button type="button" class="secondary" id="apexLocationUndo" disabled>Undo last location update</button></div><p class="section-note" id="apexLocationUndoSummary">Checking recent location changes…</p><p class="section-note">This changes asset Location only. Pallet IDs and pallet storage locations are not changed.</p>
   <label class="field"><span><input type="checkbox" id="apexLocationConfirm"> I understand this updates the asset Location field only, and keeps pallet assignments unchanged.</span></label>
   <div id="apexLocationReview" class="apex-bulk-review" role="status"></div>
   <p class="form-error" id="apexLocationError" role="alert"></p>
   <div class="modal-actions"><button type="button" class="secondary" id="apexLocationCancel">Cancel</button><button type="button" class="primary" id="apexLocationApply" disabled>Update asset locations</button></div>
  </div>`);
  const scope=$('apexLocationScope'),target=$('apexLocationTarget'),apply=$('apexLocationApply'),scan=$('apexLocationScan');
  // Start in scan/select mode even with no initial selection. Selecting ALL must be explicit.
  scope.value='selected';
  const batchGroup='loc-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
  async function loadUndo(){const result=await api.lastBulkAssetLocation();const batch=result?.batch;$('apexLocationUndo').disabled=busy||!batch;$('apexLocationUndoSummary').textContent=batch?'Latest reversible batch: '+batch.count+' asset(s) → '+batch.location+' · '+new Date(batch.at).toLocaleString('en-GB')+'. This undo is available on this PC only.':'No location batch available to undo from this PC.';}
  const chosenAssets=()=>scope.value==='all'?valid():valid().filter(a=>chosen.has(read(a.id)));
  function render(){
   const list=chosenAssets(),all=scope.value==='all';
   $('apexLocationScanForm').hidden=all;$('apexLocationClear').hidden=all;
   $('apexLocationCount').textContent=list.length+' asset(s) '+(all?'in active inventory':'selected');
   $('apexLocationDevices').innerHTML=all?'<p class="section-note">All active inventory is selected. Existing pallet memberships will be kept.</p>':list.length?list.slice(0,30).map(a=>'<div class="apex-bulk-device"><div><b>'+esc(a.id)+'</b><small>'+esc(a.pallet?'Pallet '+a.pallet:'No pallet')+' · '+esc(a.location)+'</small></div><button type="button" class="secondary" data-location-remove="'+esc(a.id)+'" aria-label="Remove '+esc(a.id)+'">×</button></div>').join('')+(list.length>30?'<p class="section-note">+'+(list.length-30)+' more selected</p>':''):'<p class="section-note">Scan or select assets to begin.</p>';
   const destination=savedLocations.find(n=>n.toLowerCase()===target.value.trim().toLowerCase());
   const changing=list.filter(a=>destination&&a.location!==destination);
   $('apexLocationReview').innerHTML=list.length?(destination?
    '<p><strong>'+changing.length+'</strong> asset(s) will change; '+(list.length-changing.length)+' already match. Pallet assignments are retained.</p>'+
    '<div class="table-overflow" style="max-height:250px;overflow:auto"><table class="asset-table"><thead><tr><th>Asset</th><th>Current location</th><th>New location</th><th>Pallet (unchanged)</th></tr></thead><tbody>'+changing.slice(0,40).map(a=>'<tr><td>'+esc(a.id)+'</td><td>'+esc(a.location||'Unassigned')+'</td><td>'+esc(destination)+'</td><td>'+esc(a.pallet||'No pallet')+'</td></tr>').join('')+'</tbody></table></div>'+(changing.length>40?'<p class="section-note">+'+(changing.length-40)+' more assets will be updated.</p>':'')
    :'Enter an existing asset location above.'):'No active assets selected.';
   apply.disabled=busy||!list.length||!destination||!changing.length||!$('apexLocationConfirm').checked;
  }
  scope.onchange=render;target.oninput=render;$('apexLocationConfirm').onchange=render;
  $('apexLocationClear').onclick=()=>{chosen.clear();render();scan.focus();};
  $('apexLocationDevices').onclick=e=>{const b=e.target.closest('[data-location-remove]');if(b){chosen.delete(b.dataset.locationRemove);render();}};
  $('apexLocationScanForm').onsubmit=e=>{
   e.preventDefault();
   if(busy)return;
   const scanned=scan.value;scan.value='';
   const result=window.ApexPalletLocationScan?.resolve(scanned,valid(),managedPallets);
   if(!result?.ok){
    $('apexLocationError').textContent=result?.error||'Could not read this asset or pallet barcode.';
    scan.focus();return;
   }
   const previous=chosen.size;
   for(const id of result.ids)chosen.add(read(id));
   const added=chosen.size-previous;
   $('apexLocationScanStatus').textContent=result.type==='pallet'
    ?'Pallet '+result.pallet+': '+result.count+' active asset(s) found; '+added+' added to this batch. Existing selections kept.'
    :'Asset '+result.ids[0]+(added?' added to batch.':' is already selected.');
   $('apexLocationError').textContent='';
   $('apexLocationConfirm').checked=false; // Force a fresh review when the batch changes.
   render();scan.focus();
  };
  $('apexLocationCreate').onclick=async()=>{
   if(busy)return;
   // Use the name already typed into the Location field; avoid browser prompts.
   const value=target.value.trim().replace(/\s+/g,' ');
   if(!value||value.length>90){$('apexLocationError').textContent='Enter a location name of 1–90 characters.';return;}
   try{
    const r=await api.addLocation(value);
    if(!r.ok)throw Error(r.error||'Could not create the location.');
    savedLocations.push(value);
    savedLocations=[...new Set(savedLocations)].sort((a,b)=>a.localeCompare(b));
    $('apexLocationOptions').innerHTML=savedLocations.map(n=>'<option value="'+esc(n)+'"></option>').join('');
    target.value=value;$('apexLocationError').textContent='';render();
    notify('Asset location created. Review and confirm the batch.');
   }catch(e){$('apexLocationError').textContent=e.message;}
  };
  $('apexLocationUndo').onclick=async()=>{
   if(busy)return;
   const r=await api.lastBulkAssetLocation(),batch=r?.batch;
   if(!batch)return;
   if(!confirm('Undo the last '+batch.count+' asset location changes from '+new Date(batch.at).toLocaleString('en-GB')+'? This restores the previous asset locations and retains the pallets. Changes made since this batch will block undo.'))return;
   busy=true;$('apexLocationUndo').disabled=true;$('apexLocationError').textContent='';
   try{
    const answer=await api.undoLastBulkAssetLocation();
    if(!answer.ok)throw Error(answer.error||'Undo failed.');
    notify(answer.restored+' asset location(s) restored; pallets unchanged.');
    await refresh();render();await loadUndo();
   }catch(e){$('apexLocationError').textContent=e.message;await loadUndo();}
   finally{busy=false;render();await loadUndo();}
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
     const result=await api.bulkSetAssetLocation({ids:batch.map(a=>a.id),location:destination,groupId:batchGroup,expectedAssignments:batch.map(a=>({id:a.id,location:a.location,pallet:a.pallet,updatedAt:a.updatedAt}))});
     if(!result.ok){total+=Number(result.updated||0);throw Error(result.error||'Location update failed. '+total+' asset(s) were updated; refresh before retrying.');}
     total+=Number(result.updated||0);done+=batch.length;
    }
    notify(total+' asset location(s) updated. Pallets unchanged.');
    await refresh();await loadUndo();closeModal();
   }catch(error){
    $('apexLocationError').textContent=error.message+' If any assets were changed, use Undo Last Location Update after reviewing them. An interrupted batch may be partially applied.';
    await refresh().catch(()=>{});
   }finally{
    busy=false;if($('apexLocationCancel'))$('apexLocationCancel').disabled=false;
    if(scope.isConnected){scope.disabled=false;target.disabled=false;render();}
   }
  };
  render();await loadUndo();if(scope.value==='selected')scan.focus();else target.focus();
 }
 window.ApexBulkAssetLocation=Object.freeze({open});
})();
