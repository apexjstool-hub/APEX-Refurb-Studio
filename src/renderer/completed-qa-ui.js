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
     <div class="qa-action-head"><div><h3>Completed QA location</h3><p>Devices are archived when their pallet is placed in this location. Pallet IDs, repair history and original asset records are retained.</p></div><span class="qa-pill">${qaReady?'Location ready':'Location not created'}</span></div>
     <div class="qa-toolbar">
       ${qaReady?'':'<button type="button" class="primary" id="qaCreateLocation" '+(!available()?'disabled':'')+'>Create Completed QA location</button>'}
       <button type="button" class="primary" id="qaMovePallet" ${!qaReady||!available()?'disabled':''}>Move pallets into Completed QA</button>
       <button type="button" class="secondary" id="qaRefresh">Refresh archive</button>
       <button type="button" class="secondary" id="qaPrint" ${!list.length?'disabled':''}>▤ Print QA manifest</button>
     </div>
     ${!available()?'<p class="qa-warning">Pallet locations are not enabled for this connection. The existing cloud location setup must be available before creating or moving pallets.</p>':''}
     <p class="section-note">Archiving hides devices from active workspaces; it does not mark repairs or QA checks as passed. Verify the manifest before dispatch.</p>
   </section>
   <section class="section-panel qa-actions">
     <h3>Scan asset into a Completed QA pallet</h3>
     <form id="qaAssignForm" class="qa-scanner">
       <label>Asset ID / serial<input name="asset" autocomplete="off" spellcheck="false" placeholder="Scan an active asset ID" required maxlength="160"></label>
       <label>QA pallet ID<select name="pallet" required><option value="">Select a QA pallet</option>${pallets.map(p=>'<option value="'+esc(p.name)+'">'+esc(p.name)+'</option>').join('')}</select></label>
       <button type="submit" class="primary" ${!pallets.length||busy?'disabled':''}>Archive asset</button>
     </form>
     <p class="section-note">If no QA pallet is listed, move an existing pallet into the Completed QA location first. This action preserves its pallet ID.</p>
     <p id="qaActionMessage" class="qa-message" role="status"></p>
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
  $('qaCreateLocation')?.addEventListener('click',createLocation);
  $('qaMovePallet').onclick=()=>window.ApexPalletLocations?.move([],model.NAME);
  $('qaRefresh').onclick=refreshQA;
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
  const form=event.currentTarget,id=String(form.elements.asset.value||'').trim().toUpperCase(),pallet=form.elements.pallet.value;
  const validPallet=archive().pallets.some(p=>model.same(p.name,pallet)),found=items.find(a=>a.id===id||String(a.serial||'').trim().toUpperCase()===id);
  if(!validPallet||!found){notify('Select a QA pallet and scan an existing active asset.','error');return;}
  if(!confirm('Archive asset '+found.id+' onto pallet '+pallet+' in Completed QA? It will disappear from active Inventory and Work Queue until restored.'))return;
  busy=true;try{
   const result=await api.update(found.id,{pallet,location:'Unassigned'});
   if(!result?.ok)throw Error(result?.error||'Could not archive asset.');
   await refresh(true);render();notify('Asset '+found.id+' archived in Completed QA.');
  }catch(e){notify(e.message,'error');}finally{busy=false;}
 }
 async function restoreAsset(id){
  const found=archive().assets.find(a=>model.same(a.id,id));if(!found||busy)return;
  if(!confirm('Restore asset '+found.id+' to active inventory? The asset will leave its QA pallet; its repair history is preserved.'))return;
  busy=true;try{
   const result=await api.update(found.id,{pallet:'',location:'Unassigned'});
   if(!result?.ok)throw Error(result?.error||'Unable to restore asset.');
   await refresh(true);render();notify('Restored '+found.id+' to active inventory.');
  }catch(e){notify(e.message,'error');}finally{busy=false;}
 }
 async function restorePallet(name){
  const found=archive().pallets.find(p=>model.same(p.name,name));if(!found||busy)return;
  if(!confirm('Restore whole pallet '+found.name+' from Completed QA to unassigned storage? Its asset IDs and pallet ID will be preserved.'))return;
  busy=true;try{
   const r=await api.movePallets({names:[found.name],location:'',expected:[{name:found.name,location:found.storageLocation}]});
   if(!r?.ok)throw Error(r?.error||'Unable to restore pallet.');
   await refresh(true);render();notify('Pallet '+found.name+' returned to active storage.');
  }catch(e){notify(e.message,'error');}finally{busy=false;}
 }
 const previous=setPage;
 setPage=function(page,force){const ok=previous(page,force);if(ok&&page==='completedQA'){render();loadWorkflow().then(()=>{if(active())render();});}return ok;};
 window.ApexCompletedQAUI={render:()=>{if(active())render();},report};
})();
