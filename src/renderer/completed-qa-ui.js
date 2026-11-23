'use strict';
/* Completed QA: only surface for assets whose pallet storage-location or direct
   Location equals Completed QA. All changes reuse existing validated APIs. */
(function(){
 const root=document.getElementById('completedQAContent'),model=window.ApexCompletedQA;
 if(!root||!model)return;
 const $=id=>document.getElementById(id);
 const esc=typeof html==='function'?html:(s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&amp;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
 let workflow={jobs:{},orders:[],resprayPallets:[]},search='',palletFilter='',busy=false;
 const archive=()=>window.ApexCompletedQAArchive||{assets:[],pallets:[]};
 const available=()=>window.ApexPalletLocationData?.available===true;
 const exists=()=>Array.isArray(window.ApexPalletLocationData?.names)&&window.ApexPalletLocationData.names.some(x=>model.same(x,model.NAME));
 const active=()=>currentPage==='completedQA';
 const ids=()=>new Set(archive().pallets.map(p=>String(p.name||'').toLowerCase()));
 const rows=()=>{
  const q=search.trim().toLowerCase(),group=palletFilter.toLowerCase();
  return model.manifest(archive().assets,workflow).filter(r=>(!group||r.pallet.toLowerCase()===group)&&(!q||[r.id,r.brand,r.model,r.serial,r.pallet,r.refurbStatus,r.partsStatus,r.sprayStatus].some(v=>String(v).toLowerCase().includes(q)))).sort((a,b)=>a.pallet.localeCompare(b.pallet,undefined,{numeric:true})||a.id.localeCompare(b.id,undefined,{numeric:true}));
 };
 const word=(value)=>'<span class="qa-status '+(/completed|not required/i.test(value)?'qa-done':/outstanding|not recorded|no refurbishment/i.test(value)?'qa-review':'')+'">'+esc(value)+'</span>';
 function render(){
  const stored=archive(),list=rows(),total=stored.assets.filter(a=>!a.deletedAt).length;
  const pallets=stored.pallets;
  const complete=model.manifest(stored.assets,workflow).filter(r=>r.refurbStatus==='Completed').length;
  const qaReady=exists();
  root.innerHTML=`
   <section class="qa-overview">
     <div><small>ARCHIVED ASSETS</small><strong>${total}</strong></div>
     <div><small>PALLETS IN COMPLETED QA</small><strong>${pallets.length}</strong></div>
     <div><small>REFURBISHMENT COMPLETED</small><strong>${complete}</strong></div>
     <div><small>LOCATION ID</small><strong>Completed QA</strong></div>
   </section>
   <section class="section-panel qa-actions">
     <h3>Scan an asset into Completed QA</h3>
     <p>Scan an Asset ID or serial number, then click Move to Completed QA. After you confirm the actual repair, respray and QA work is finished, the refurbishment, repair/respray and QC records are marked Completed. The asset Location changes to Completed QA, its Inventory processing status becomes Processed, and its pallet ID is preserved.</p>
     <form id="qaAssignForm" class="qa-scanner qa-simple-scan">
       <label>Asset ID / serial<input name="asset" autocomplete="off" spellcheck="false" placeholder="Scan asset ID or serial…" required maxlength="160"></label>
       <button type="submit" class="primary" ${busy?'disabled':''}>Move to Completed QA</button>
     </form>
     <p id="qaActionMessage" class="qa-message" role="status"></p>
     <div class="qa-toolbar"><button type="button" class="secondary" id="qaRefresh">Refresh archive</button><button type="button" class="secondary" id="qaReconcile" ${!stored.assets.some(a=>!a.deletedAt&&!model.same(a.location,model.NAME))?'disabled':''}>Fix older QA locations</button><button type="button" class="secondary" id="qaPrint" ${!list.length?'disabled':''}>▤ Print QA manifest</button></div>
     <p class="section-note">Final QA completion requires explicit engineer confirmation. Synced diagnostic failures block completion until retested and synced; diagnostic pass/fail results are never rewritten.</p>
   </section>
   <section class="section-panel qa-actions">
     <div class="qa-action-head"><div><h3>Completed QA manifest</h3><p>Model, brand, asset ID, serial, original pallet ID and recorded repair/QC status.</p></div><span class="qa-pill">${list.length} shown</span></div>
     <div class="qa-filters"><label>Search assets<input id="qaSearch" type="search" placeholder="Asset ID, model, serial, pallet…" value="${esc(search)}"></label>
       <label>QA pallet<select id="qaPalletFilter"><option value="">All QA pallets and direct QA assets</option>${pallets.map(p=>'<option value="'+esc(p.name)+'" '+(model.same(palletFilter,p.name)?'selected':'')+'>'+esc(p.name)+'</option>').join('')}</select></label></div>
     <div class="qa-table-scroll"><table class="asset-table qa-table"><thead><tr><th>Asset ID</th><th>Brand / model</th><th>Serial number</th><th>Pallet ID</th><th>Location ID</th><th>Repair</th><th>Respray</th><th>Refurbishment</th><th>QC</th><th>Action</th></tr></thead><tbody>
       ${list.map(r=>'<tr><td><strong>'+esc(r.id)+'</strong></td><td><strong>'+esc(r.brand||'Not recorded')+'</strong><small>'+esc(r.model||'Not recorded')+'</small></td><td>'+esc(r.serial||'—')+'</td><td>'+esc(r.pallet)+'</td><td>Completed QA</td><td>'+word(r.partsStatus)+'</td><td>'+word(r.sprayStatus)+'</td><td>'+word(r.refurbStatus)+'</td><td>'+word(r.qcStatus)+'</td><td><button type="button" class="secondary" data-qa-restore="'+esc(r.id)+'">Restore asset</button></td></tr>').join('')||'<tr><td colspan="10">No archived assets match this view.</td></tr>'}
     </tbody></table></div>
     ${pallets.length?'<div class="qa-pallet-actions"><h3>Archived pallets</h3>'+pallets.map(p=>'<div class="qa-pallet-row"><span><strong>'+esc(p.name)+'</strong> · Completed QA</span><button type="button" class="secondary" data-qa-restore-pallet="'+esc(p.name)+'">Restore whole pallet</button></div>').join('')+'</div>':''}
   </section>`;
  $('qaSearch').oninput=e=>{search=e.target.value;render();$('qaSearch')?.focus();$('qaSearch')?.setSelectionRange(search.length,search.length);};
  $('qaPalletFilter').onchange=e=>{palletFilter=e.target.value;render();};
  $('qaRefresh').onclick=refreshQA;
  $('qaReconcile').onclick=reconcileExisting;
  $('qaPrint').onclick=printManifest;
  $('qaAssignForm').onsubmit=archiveAsset;
  root.querySelectorAll('[data-qa-restore]').forEach(b=>b.onclick=()=>restoreAsset(b.dataset.qaRestore));
  root.querySelectorAll('[data-qa-restore-pallet]').forEach(b=>b.onclick=()=>restorePallet(b.dataset.qaRestorePallet));
 }
 function report(){
  const data=rows(),escape=esc;
  if(!data.length)return null;
  const generated=new Date().toLocaleString('en-GB');
  const head=window.ApexReportBrand?.header?.()||'<h2>APEX MANAGEMENT STUDIO</h2>';
  const th=['Asset ID','Brand','Model','Serial number','Pallet ID','Location ID','Repair status','Respray status','Refurbishment status','QC status'];
  return head+'<h1>Completed QA — Asset Manifest</h1><p>Generated '+escape(generated)+' · '+data.length+' archived assets · Location ID: Completed QA</p><p>Statuses reflect recorded work only. Verify unresolved items before dispatch.</p><table><thead><tr>'+th.map(x=>'<th>'+escape(x)+'</th>').join('')+'</tr></thead><tbody>'+data.map(r=>'<tr>'+[r.id,r.brand,r.model,r.serial,r.pallet,r.location,r.partsStatus,r.sprayStatus,r.refurbStatus,r.qcStatus].map(x=>'<td>'+escape(x||'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table><p>End of Completed QA manifest</p>';
 }
 function printManifest(){
  const content=report();if(!content)return;
  if(window.ApexReportPreview?.capture){window.ApexReportPreview.capture(content,'Completed QA manifest','A4','inventory');return;}
  if(typeof printInventoryMarkup==='function'){printInventoryMarkup(content);return;}
  notify('Print preview is unavailable. Open Reports to check printer configuration.');
 }
 async function loadWorkflow(){
  try{const result=await api.workflow();if(result?.ok&&result.workflow)workflow=result.workflow;else throw Error(result?.error||'Unable to read refurbishment data.');}
  catch(e){notify('Could not load QA repair status: '+e.message,'error');workflow={jobs:{},orders:[],resprayPallets:[]};}
 }
 async function refreshQA(){if(busy)return;busy=true;try{await refresh(true);await loadWorkflow();render();}finally{busy=false;}}
 async function reconcileExisting(){
  if(busy)return;
  const missing=archive().assets.filter(a=>!a.deletedAt&&!model.same(a.location,model.NAME));
  if(!missing.length)return notify('All archived assets already have Location = Completed QA.');
  if(!confirm('Update the individual Location field to Completed QA for '+missing.length+' already archived asset(s)? Pallet IDs and all refurbishment records will remain unchanged.'))return;
  busy=true;const failed=[];
  try{
   for(const a of missing){
    const response=await api.update(a.id,{location:model.NAME});
    if(!response?.ok)failed.push(a.id);
   }
   await refresh(true);render();
   if(failed.length)notify('Could not update '+failed.length+' archived assets: '+failed.slice(0,8).join(', '),'error');
   else notify('Updated '+missing.length+' individual asset Location fields to Completed QA.');
  }catch(e){notify('Unable to finish updating archived locations: '+e.message,'error');await refresh(true);render();}
  finally{busy=false;}
 }
 async function createLocation(){
  if(!available()||!api.createPalletLocation)return notify('Pallet locations are not enabled on this connection.','error');
  if(!confirm('Create the reserved pallet location Completed QA? Assets placed in its pallets will be archived from active pages.'))return;
  busy=true;try{
   const r=await api.createPalletLocation({name:model.NAME});
   if(!r?.ok)throw Error(r?.error||'Unable to create Completed QA.');
   await refresh(true);render();notify('Completed QA pallet location created.');
  }catch(e){notify(e.message,'error');}finally{busy=false}
 }
 async function archiveAsset(event){
  event.preventDefault();if(busy)return;
  const input=event.currentTarget.elements.asset,scanned=String(input.value||'').trim().toUpperCase();
  const found=items.find(a=>a.id===scanned||String(a.serial||'').trim().toUpperCase()===scanned);
  if(!found){notify('Asset not found in active Inventory. Check the scanned ID or serial number.','error');input.focus();return;}
  // The user explicitly confirms actual repair, respray and QC work.
  // Simply changing a location never means that a failed hardware test passed.
  if(!confirm('FINAL QA SIGN-OFF — Asset '+found.id+'\\n\\nI confirm that all required repairs, respray work and all four final QA checks have actually been completed. APEX will mark the refurbishment, parts/respray and QC records Completed, then move the asset to Completed QA.\\n\\nIts pallet ID will remain unchanged. Any FAILED synced diagnostics must be retested and synced first.\\n\\nProceed?'))return;
  busy=true;
  try{
   // Read the live workflow just before updating, to detect stale job changes.
   const live=await api.workflow();
   if(!live?.ok||!live.workflow)throw Error(live?.error||'Could not check the current refurbishment record.');
   const job=live.workflow.jobs?.[found.id];
   const finished=await api.workflowAction({type:'completeForQA',assetId:found.id,
    expectedUpdatedAt:job?.updatedAt||'',confirmPhysicalWork:true,confirmFinalQC:true});
   if(!finished?.ok)throw Error(finished?.error||'Could not complete repair, respray and QA statuses.');
   workflow=finished.workflow||live.workflow;
   // Save Location separately only after workflow completion succeeds.
   // Do not remove or rename the pallet or mutate diagnostic pass/fail.
   const result=await api.update(found.id,{location:model.NAME,status:'Processed'});
   if(!result?.ok)throw Error('All repair/respray and QC statuses were completed, but the Location save failed: '+(result?.error||'unknown error')+'. The asset is still in active Inventory; retry the move.');
   await refresh(true);render();notify('Asset '+found.id+' — repair, respray, refurbishment and QA completed. Location: Completed QA.');
   document.querySelector('#qaAssignForm input[name="asset"]')?.focus();
  }catch(e){notify(e.message,'error');input.focus();}
  finally{busy=false;}
 }
 async function restoreAsset(id){
  const found=archive().assets.find(a=>model.same(a.id,id));if(!found||busy)return;
  if(!confirm('Restore asset '+found.id+' to active inventory? Its repair history will be preserved. The pallet ID is retained unless the pallet itself remains in Completed QA.'))return;
  busy=true;try{
   // Retain the pallet for direct QA assets. Only unlink a pallet if that
   // pallet itself is still in QA; otherwise the asset would remain archived.
   const qaPallet=archive().pallets.some(p=>model.same(p.name,found.pallet));
   const result=await api.update(found.id,qaPallet?{pallet:'',location:'Unassigned'}:{location:'Unassigned'});
   if(!result?.ok)throw Error(result?.error||'Unable to restore asset.');
   await refresh(true);render();notify('Restored '+found.id+' to active inventory.');
  }catch(e){notify(e.message,'error');}finally{busy=false;}
 }
 async function restorePallet(name){
  const found=archive().pallets.find(p=>model.same(p.name,name));if(!found||busy)return;
  if(!confirm('Restore whole pallet '+found.name+' from Completed QA to unassigned storage? Its asset IDs and pallet ID will be preserved.'))return;
  busy=true;try{
   const members=archive().assets.filter(a=>model.same(a.pallet,found.name)&&!a.deletedAt);
   // A cloud pallet-location move does not necessarily change per-asset Location.
   // Reconcile each asset through the existing validated inventory update API.
   // Keep records archived until the pallet move succeeds.
   const r=await api.movePallets({names:[found.name],location:'',expected:[{name:found.name,location:found.storageLocation}]});
   if(!r?.ok)throw Error(r?.error||'Unable to restore pallet.');
   const errors=[];
   for(const a of members){
    if(!model.same(a.location,model.NAME))continue;
    const result=await api.update(a.id,{location:'Unassigned'});
    if(!result?.ok)errors.push(a.id);
   }
   if(errors.length)throw Error('Pallet moved, but these asset Location fields could not be restored: '+errors.join(', ')+'. Refresh and retry these assets individually.');
   await refresh(true);render();notify('Pallet '+found.name+' returned to active storage.');
  }catch(e){notify(e.message,'error');}finally{busy=false;}
 }
 const previous=setPage;
 setPage=function(page,force){const ok=previous(page,force);if(ok&&page==='completedQA'){render();loadWorkflow().then(()=>{if(active())render();});}return ok;};
 window.ApexCompletedQAUI={render:()=>{if(active())render();},report};
})();
