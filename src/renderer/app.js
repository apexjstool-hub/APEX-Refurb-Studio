'use strict';
const api=window.apexInventory;
const core=window.ApexInventoryCore;
const $=id=>document.getElementById(id);
let cloudRefreshFailed=false,cloudLastRefresh=0;
let items=[],managedLocations=[],managedPallets=[],currentPage='dashboard',activeAssetId=null,dirty=false,toastTimer,scannerControls=null,cameraStream=null,scanRunning=false,syncMode='local',syncBusy=false,inventoryPageIndex=0,lastHubVersion=null,lastFullRefreshAt=0;
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortDate=s=>s?new Date(s).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const grade=a=>`<span class="grade-badge grade-${html(a.grade||'Pending')}">${html(a.grade||'Pending')}</span>`;
const state=a=>`<span class="status ${a==='Processed'?'ready':'testing'}">● ${html(a||'Awaiting Processing')}</span>`;
function notify(msg,kind='info'){$('toast').dataset.kind=kind;$('toast').textContent=msg;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),3200);}
const PAGE_NAMES={refurbWorkspace:'Refurbishment',dashboard:'Dashboard',inventory:'Inventory',scan:'Inventory',asset:'Inventory',locations:'Locations',bulk:'Scan',reports:'Reports',users:'Users',settings:'Admin Centre',pallets:'Pallets',palletLocations:'Pallet locations',palletLocationDetail:'Pallet locations',containerInventory:'Inventory contents'};
const PAGE_SUBS={refurbWorkspace:'Work queue',dashboard:'Overview',inventory:'Asset register',scan:'Scan asset',asset:'Asset details',locations:'Warehouse',bulk:'Batch transfer',reports:'Export',users:'Access',settings:'Configuration',pallets:'Register',palletLocations:'Storage',palletLocationDetail:'Location pallets',containerInventory:'Contained items'};
function setPage(page,force=false){
 if(!PAGE_NAMES[page])return false;
 if(currentPage==='asset'&&dirty&&!force&&!confirm('Leave this asset without saving your changes?'))return false;
 if(currentPage==='scan'&&page!=='scan')stopCamera();dirty=false;currentPage=page;document.documentElement.dataset.apexPage=page;
 for(const name of Object.keys(PAGE_NAMES))$(name+'Page').classList.toggle('hidden',name!==page);
 document.querySelectorAll('.menu-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page||(['asset','scan'].includes(page)&&b.dataset.page==='inventory')));
 $('breadPage').textContent=PAGE_NAMES[page];$('breadSub').textContent=PAGE_SUBS[page];
 document.querySelector('.main').scrollTop=0;render();return true;
}
function rows(data,actions){
 if(!data.length)return '<div class="empty"><strong>No assets found</strong>Scan another ID or add a new asset.</div>';
 return `<table class="asset-table"><thead><tr><th>Asset ID</th><th>Full device name</th><th>Condition</th><th>Location</th><th>Status</th>${actions?'<th>Action</th>':''}</tr></thead><tbody>${data.map(a=>`<tr><td><button class="asset-link" data-asset="${html(a.id)}">${html(a.id)}</button></td><td><b>${html(deviceName(a))}</b><div class="section-note">${html(a.serial||a.productType)}</div></td><td>${conditionBadge(a.condition)}</td><td>${html(a.location||'Unassigned')}</td><td>${state(a.status)}</td>${actions?`<td class="v32-row-actions"><button class="text-button" data-asset="${html(a.id)}">View ↗</button><button type="button" class="v3-delete" data-delete-asset="${html(a.id)}" aria-label="Delete ${html(a.id)}">Delete</button></td>`:''}</tr>`).join('')}</tbody></table>`;
}
function deviceName(a){const maker=String(a.manufacturer||'').trim(),model=String(a.model||'').trim();return !maker?model||'New asset':model.toLowerCase().startsWith(maker.toLowerCase()+' ')?model:maker+(model?' '+model:'');}
function conditionBadge(c){const cls=['A','Excellent'].includes(c)?'cond-good':['D'].includes(c)?'cond-bad':['C','Fair'].includes(c)?'cond-warn':'cond-neutral';return `<span class="condition-pill ${cls}">${html(c||'Not assessed')}</span>`;}
function render(){
 const sorted=[...items].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
 $('sideCount').textContent=$('mTotal').textContent=$('inventoryCount').textContent=items.length;
 $('mReady').textContent=items.filter(a=>a.status==='Processed').length;
 $('mTesting').textContent=items.filter(a=>a.status==='Awaiting Processing').length;
 $('mRepair').textContent=items.filter(a=>a.grade==='D'||a.condition==='D').length;
 $('recentTable').innerHTML=rows(sorted.slice(0,4),false);
 const locationCounts=new Map(managedLocations.map(name=>[name,0]));
 for(const asset of items){const name=asset.location||'Unassigned';locationCounts.set(name,(locationCounts.get(name)||0)+1);}
 const locations=[...locationCounts.keys()].sort();const previous=$('locationFilter').value;
 $('locationFilter').innerHTML='<option value="">All locations</option>'+locations.map(l=>`<option value="${html(l)}">${html(l)}</option>`).join('');$('locationFilter').value=locations.includes(previous)?previous:'';
 $('locationSummary').innerHTML=locations.length?locations.map(loc=>`<button class="location-chip" data-location="${html(loc)}"><span>${html(loc)}</span><strong>${locationCounts.get(loc)||0}</strong></button>`).join(''):'<span class="section-note">No locations yet.</span>';
 const gradeCounts=new Map();
 for(const asset of items)gradeCounts.set(asset.grade,(gradeCounts.get(asset.grade)||0)+1);
 $('gradeSummary').innerHTML=['A','B','C','D','Pending'].map(g=>`<div class="grade-tile"><b>${g}</b><small>${gradeCounts.get(g)||0} assets</small></div>`).join('');
 const q=$('inventorySearch').value.trim().toLowerCase(),loc=$('locationFilter').value,g=$('gradeFilter').value,s=$('statusFilter').value;
 const filtered=sorted.filter(a=>(!loc||a.location===loc)&&(!g||a.grade===g)&&(s==='All statuses'||a.status===s)&&(!q||[a.id,a.model,a.manufacturer,a.serial,a.location,a.pallet,a.sku,a.processor,a.gpu,a.productType].some(v=>String(v??'').toLowerCase().includes(q)))&&(!window.ApexInventoryTracker||window.ApexInventoryTracker.matches(a)));
 // Only draw the current page. Exports and scans still use the entire items array.
 const pageSize=100, pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
 inventoryPageIndex=Math.min(Math.max(0,inventoryPageIndex),pageCount-1);
 const first=inventoryPageIndex*pageSize;
 $('inventoryTable').innerHTML=rows(filtered.slice(first,first+pageSize),true)+
  `<div class="v395-pagebar" role="navigation" aria-label="Inventory pages"><span>${filtered.length?`${first+1}–${Math.min(filtered.length,first+pageSize)} of ${filtered.length} devices`:'0 devices'} · Page ${inventoryPageIndex+1} of ${pageCount}</span><div><button type="button" data-inventory-page="prev" ${inventoryPageIndex===0?'disabled':''} aria-label="Previous page">← Previous</button><button type="button" data-inventory-page="next" ${inventoryPageIndex>=pageCount-1?'disabled':''} aria-label="Next page">Next →</button></div></div>`;
 $('inventoryTable').querySelectorAll('[data-inventory-page]').forEach(button=>button.onclick=()=>{
   inventoryPageIndex+=button.dataset.inventoryPage==='next'?1:-1;
   render();
 });
 document.querySelectorAll('[data-asset]').forEach(b=>b.onclick=()=>openAsset(b.dataset.asset));
 document.querySelectorAll('[data-print-asset]').forEach(b=>b.onclick=()=>openAssetPrintDialog(b.dataset.printAsset));
 document.querySelectorAll('[data-delete-asset]').forEach(b=>b.onclick=()=>window.apexDeleteAsset?.(b.dataset.deleteAsset));
 document.querySelectorAll('[data-location]').forEach(b=>b.onclick=()=>window.ApexContainerInventory?.open('location',b.dataset.location));
 renderSupplementalPages();window.ApexInventoryTracker?.decorate();window.ApexPalletPage?.render();window.ApexPalletLocations?.render();
}
function summarizeLocations(){
 const map=new Map(managedLocations.filter(name=>String(name).trim().toLowerCase()!=='unassigned').map(name=>[name,[]]));
 for(const item of items){const location=item.location||'Unassigned';if(location.trim().toLowerCase()==='unassigned')continue;if(!map.has(location))map.set(location,[]);map.get(location).push(item);}
 return [...map].sort(([a],[b])=>a.localeCompare(b)).map(([location,assets])=>({location,assets}));
}
function renderSupplementalPages(){
 const locs=summarizeLocations();
 $('locationCards').innerHTML=`<div class="loc-metric"><span>Active locations</span><strong>${locs.length}</strong><small>Locations with recorded assets</small></div><div class="loc-metric"><span>Assets tracked</span><strong>${items.length}</strong><small>Current inventory</small></div><div class="loc-metric"><span>Processed</span><strong>${items.filter(a=>a.status==='Processed').length}</strong><small>Finished devices</small></div>`;
 $('locationsTable').innerHTML=locs.length?`<table class="asset-table locations-table"><thead><tr><th>Location</th><th>Assets</th><th>Processed</th><th></th></tr></thead><tbody>${locs.map(l=>`<tr><td><b>${html(l.location)}</b></td><td>${l.assets.length}</td><td>${l.assets.filter(a=>a.status==='Processed').length}</td><td class="v344-location-actions"><button class="text-button" data-jump-location="${html(l.location)}">View assets →</button>${l.location.toLowerCase()==='unassigned'?'':`<button class="v344-delete-location" type="button" data-delete-location="${html(l.location)}" aria-label="Delete location ${html(l.location)}" title="Delete location">Delete</button>`}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No inventory locations yet.</div>';
 document.querySelectorAll('[data-jump-location]').forEach(b=>b.onclick=()=>window.ApexContainerInventory?.open('location',b.dataset.jumpLocation));
 document.querySelectorAll('[data-delete-location]').forEach(b=>b.onclick=()=>confirmDeleteLocation(b.dataset.deleteLocation));
 $('reportTotal').textContent=items.length;$('reportProcessed').textContent=items.filter(a=>a.status==='Processed').length;$('reportAwaiting').textContent=items.filter(a=>a.status==='Awaiting Processing').length;
 $('reportLocationSummary').innerHTML=locs.length?locs.map(l=>`<div class="report-location"><span>${html(l.location)}</span><strong>${l.assets.length} assets</strong></div>`).join(''):'<p class="section-note">No locations yet.</p>';
 $('settingsConnectionText').textContent=syncMode==='cloud'?'Shared cloud inventory · Supabase':syncMode==='shared'?'Connected to shared inventory hub · refreshed every four seconds':'Local workspace · this computer only';
}
function confirmDeleteLocation(name){
 const affected=items.filter(a=>(a.location||'Unassigned').toLowerCase()===name.toLowerCase());
 const alternatives=[...new Set([...managedLocations,...items.map(a=>a.location||'Unassigned'),'Unassigned'])].filter(l=>l.toLowerCase()!==name.toLowerCase()).sort();
 const needMove=affected.length>0;
 showModal('Delete location','INVENTORY / LOCATIONS',`<div class="modal-body v344-location-dialog"><p>Delete <strong>${html(name)}</strong> from the location list?</p>${needMove?`<p class="v344-move-note">${affected.length} laptop${affected.length===1?' is':'s are'} currently assigned here. Select where to move ${affected.length===1?'it':'them'} before deleting.</p><label class="field" for="v344MoveDestination">Move ${affected.length===1?'laptop':'laptops'} to<select id="v344MoveDestination" required>${alternatives.map(l=>`<option value="${html(l)}">${html(l)}</option>`).join('')}</select></label>`:'<p>This location is empty and can be deleted immediately.</p>'}<p class="v344-location-warning">This removes the location name. Laptop records and refurbishment information will not be deleted.</p><div class="form-error" id="v344DeleteLocationError" role="alert"></div><div class="modal-actions"><button id="v344CancelDeleteLocation" class="secondary" type="button">Cancel</button><button id="v344ConfirmDeleteLocation" class="v344-confirm-delete" type="button">${needMove?'Move assets & delete':'Delete location'}</button></div></div>`);
 $('v344CancelDeleteLocation').onclick=closeModal;
 $('v344ConfirmDeleteLocation').onclick=async()=>{
  const button=$('v344ConfirmDeleteLocation');button.disabled=true;
  try{
   const destination=needMove?$('v344MoveDestination')?.value||'':'';
   const result=await api.deleteLocation(name,destination);
   if(!result.ok){$('v344DeleteLocationError').textContent=result.error||'Could not delete location.';return;}
   closeModal();await refresh();notify(`${name} deleted${result.moved?` · ${result.moved} laptop(s) moved to ${result.moveTo}`:''}`);
  }catch(e){$('v344DeleteLocationError').textContent='Could not delete location. Please try again.';}
  finally{button.disabled=false;}
 };
}
function inventoryCsv(){
 const fields=[['id','Asset ID'],['manufacturer','Manufacturer'],['model','Model'],['productType','Product Type'],['serial','Serial Number'],['processor','Processor'],['gpu','GPU'],['ram','RAM'],['ramType','RAM Type'],['storage','Main SSD'],['operatingSystem','Operating System'],['location','Location'],['condition','Condition'],['sku','SKU'],['status','Status'],['grade','Suggested Grade'],['notes','Notes']];
 const cell=v=>{let s=String(v??'');if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\uFEFF'+[fields.map(x=>cell(x[1])).join(','),...items.map(a=>fields.map(([key])=>cell(a[key])).join(','))].join('\r\n');
}
async function exportInventory(){
 try{const text=inventoryCsv();if(api.exportCsv){const r=await api.exportCsv(text);if(r.ok)notify('Inventory CSV saved');else if(!r.cancelled)notify(r.error||'Export failed');}
 else{const blob=new Blob([text],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='APEX-Inventory-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);notify('Inventory CSV downloaded');}}
 catch(e){notify('Unable to export the CSV');}
}
let inventoryPrintCleanup=null;
function printInventory(selectedAssetIds){
 const ids=Array.isArray(selectedAssetIds)?new Set(selectedAssetIds):null,reportItems=ids?items.filter(a=>ids.has(a.id)):items;
 if(inventoryPrintCleanup)inventoryPrintCleanup();
 const content=`${window.ApexReportBrand.header()}<h1>APEX Smart Inventory — Asset Register</h1><p>Generated ${html(new Date().toLocaleString('en-GB'))} · ${reportItems.length} assets</p><table><thead><tr><th>Asset ID</th><th>Device</th><th>Serial</th><th>Location</th><th>Condition</th><th>Status</th></tr></thead><tbody>${reportItems.map(a=>`<tr><td>${html(a.id)}</td><td>${html(deviceName(a))}</td><td>${html(a.serial)}</td><td>${html(a.location)}</td><td>${html(a.condition)}</td><td>${html(a.status)}</td></tr>`).join('')}</tbody></table>`;
 if(window.ApexReportPreview?.capture){window.ApexReportPreview.capture(content,'Inventory report','A4','inventory');return;}
 printInventoryMarkup(content);
}
function printInventoryMarkup(content){
 if(inventoryPrintCleanup)inventoryPrintCleanup();
 const pane=document.createElement('div');pane.id='printPane';pane.innerHTML=content;document.body.appendChild(pane);
 let timeout,cleaned=false;
 const cleanup=()=>{if(cleaned)return;cleaned=true;clearTimeout(timeout);window.removeEventListener('afterprint',cleanup);pane.remove();inventoryPrintCleanup=null;};
 inventoryPrintCleanup=cleanup;window.addEventListener('afterprint',cleanup,{once:true});
 timeout=setTimeout(cleanup,600000);
 // Electron's print dialog can return before it captures the report.
 try{window.print();}catch(error){cleanup();notify('Unable to print inventory: '+error.message);}
}
function adminPasswordModal(){
 showModal('Change admin password','USERS / SECURITY',`<form id="adminPasswordForm" class="modal-body"><p class="help-text">Update the administrator password used to sign in to this computer.</p><label class="field">Current password<input name="old" type="password" required autocomplete="current-password"></label><label class="field">New password (8+ characters)<input name="next" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><label class="field">Confirm new password<input name="confirm" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><div class="form-error" id="adminPasswordError"></div><div class="modal-actions"><button class="secondary" type="button" id="adminPasswordCancel">Cancel</button><button class="primary" type="submit">Save password</button></div></form>`);
 $('adminPasswordCancel').onclick=closeModal;
 $('adminPasswordForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(f.get('next')!==f.get('confirm')){$('adminPasswordError').textContent='Passwords do not match.';return;}const r=await api.changePassword(f.get('old'),f.get('next'));if(!r.ok){$('adminPasswordError').textContent=r.error||'Could not update password.';return;}closeModal();notify('Admin password updated');};
}
function updateConnection(online=true){$('connectionLabel').textContent=syncMode==='cloud'?'Shared cloud inventory':syncMode==='shared'?'Shared inventory hub':'Local workspace';$('connectionDetail').textContent=syncMode==='cloud'?(online?'Connected to Supabase':'Cloud inventory unavailable'):syncMode==='shared'?(online?'Connected · auto-refresh':'Hub unavailable'):'This computer only';$('syncHint').textContent=syncMode==='cloud'?(online?'● CLOUD CONNECTED':'● CLOUD OFFLINE'):syncMode==='shared'?(online?'● SHARED LIVE · 4s':'● OFFLINE'):'● LOCAL LIVE';$('syncHint').style.color=online?'#8be4bc':'#f3b58c';}
async function refresh(silent=false){
 if(syncBusy)return;
 syncBusy=true;
 try{
  // Read-only polling can ask the Hub for a version only. Force a complete
  // re-read every 60 seconds, after explicit writes, and after reconnection.
  const useVersion=Boolean(silent&&syncMode==='shared'&&Number.isSafeInteger(lastHubVersion)&&Date.now()-lastFullRefreshAt<60000);
  const r=await api.list(useVersion?lastHubVersion:undefined);
  if(r.ok){
   if(r.mode==='cloud')syncMode='cloud';
   if(r.unchanged){updateConnection(true);return;}
   if(!Array.isArray(r.items))throw Error('Inventory response is missing asset records.');
   items=r.items.map(core.normalize);
   managedLocations=Array.isArray(r.locations)?r.locations:[];
   managedPallets=Array.isArray(r.pallets)?r.pallets:[];
   window.ApexPalletLocationData={names:Array.isArray(r.palletLocations)?r.palletLocations:[],available:r.mode==='local'||Array.isArray(r.palletLocations)&&r.palletLocationsAvailable!==false};
   lastHubVersion=Number.isSafeInteger(r.version)?r.version:null;
   lastFullRefreshAt=Date.now();
   if(syncMode==='cloud'){cloudRefreshFailed=false;cloudLastRefresh=Date.now();}
   render();updateConnection(true);
  }else{lastHubVersion=null;if(syncMode==='cloud')cloudRefreshFailed=true;updateConnection(false);if(!silent)notify(r.error);}
 }catch(e){lastHubVersion=null;if(syncMode==='cloud')cloudRefreshFailed=true;updateConnection(false);if(!silent)notify(e.message||'Inventory refresh failed');}
 finally{syncBusy=false;}
}
function showModal(title,eyebrow,content,closable=true){$('modalTitle').textContent=title;$('modalEyebrow').textContent=eyebrow;$('modalContent').innerHTML=content;$('modalClose').classList.toggle('hidden',!closable);$('modalLayer').classList.remove('hidden');}
function closeModal(){$('modalLayer').classList.add('hidden');$('modalContent').innerHTML='';}
const optionHtml=(name,values,selected)=>`<select name="${html(name)}">${values.map(v=>`<option ${v===selected?'selected':''}>${html(v)}</option>`).join('')}</select>`;
function fillOptions(id,choices,value){$(id).innerHTML=choices.map(v=>`<option value="${html(v)}" ${v===value?'selected':''}>${html(v)}</option>`).join('');}
const APEX_TEST_LABELS={"display":"Display / LCD","touchscreen":"Touchscreen","keyboard":"Keyboard","pointer":"Touchpad","audio":"Speakers","microphone":"Microphone","camera":"Webcam","wifi":"Wi-Fi","bluetooth":"Bluetooth","battery":"Battery","physical":"Ports / connections","system":"Storage / internal hardware","hardware":"Hardware checks","health":"Windows health","gauntlet":"Stability test","advanced":"Advanced diagnostics"};
function renderImportedTests(asset){
 const recorded=Object.entries(asset.diagnosticTests||{}).filter(([key,value])=>APEX_TEST_LABELS[key]&&['pass','fail'].includes(value?.status||value));
 const passed=recorded.filter(([k,v])=>(v?.status||v)==='pass').length;
 const failed=recorded.length-passed;
 $('apexTestTotals').innerHTML=`<span class="apex-test-total apex-test-total-pass"><strong>${passed}</strong><small>Passed</small></span><span class="apex-test-total apex-test-total-fail"><strong>${failed}</strong><small>Failed</small></span>`;
 $('apexTestList').innerHTML=recorded.length?recorded.map(([id,value])=>{const ok=(value?.status||value)==='pass';return `<div class="apex-test-tile ${ok?'apex-test-tile-ok':'apex-test-tile-bad'}"><span class="apex-test-symbol" aria-hidden="true">${ok?'✓':'!'}</span><span class="apex-test-name">${html(APEX_TEST_LABELS[id])}</span><b class="apex-test-result ${ok?'apex-test-pass':'apex-test-fail'}">${ok?'PASS':'FAIL'}</b></div>`;}).join(''):'<div class="apex-test-empty"><span class="apex-test-empty-icon">▦</span><div><strong>No tests received yet</strong><p>Enter this Asset ID in APEX Diagnostics, connect to the hub and mark completed checks Pass or Fail.</p></div></div>';
}
function renderRefurbishment(asset){
 const box=$('refurbContent'),status=$('refurbSyncLabel');
 if(!box||!status)return;
 const r=asset.refurbishment;
 if(!r||!Array.isArray(r.reports)||!r.reports.length){
  status.textContent='● No refurbishment received';status.className='refurb-sync-state waiting';
  box.innerHTML='<div class="refurb-empty"><div class="refurb-empty-icon">▤</div><div><strong>No refurbishment notes received</strong><p>Send this laptop directly from RefurbFlow Android to APEX Smart Inventory on the same private network. Approve the phone once in Settings; the Office Receiver is not required.</p></div></div>';return;
 }
 status.textContent='● Received from RefurbFlow';status.className='refurb-sync-state synced';
 const records=[...r.reports].sort((a,b)=>Number(b.sourceUpdatedAt||0)-Number(a.sourceUpdatedAt||0));
 const latest=records[0],resprays=(latest.repairs||[]).filter(x=>/respray|re-?spray|paint/i.test(x.name));
 const asLines=v=>String(v||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const multiline=v=>v?`<div class="refurb-text">${asLines(v).map(x=>`<div>${html(x)}</div>`).join('')}</div>`:'<span class="refurb-muted">Not recorded</span>';
 const repairs=(latest.repairs||[]);
 box.innerHTML=`<div class="refurb-facts"><div><small>RefurbFlow status</small><strong>${html(latest.status||'Not specified')}</strong></div><div><small>Parts / repairs</small><strong>${repairs.length}</strong></div><div><small>Respray items</small><strong>${resprays.length}</strong></div><div><small>Imported reports</small><strong>${records.length}</strong></div></div>
  <div class="refurb-info-grid"><div class="refurb-info-card"><h4>Technician notes</h4>${multiline(latest.notes)}</div><div class="refurb-info-card"><h4>Cosmetic findings</h4>${multiline(latest.cosmeticIssues)}</div><div class="refurb-info-card"><h4>Functionality observations</h4>${multiline(latest.functionalityResults)}</div><div class="refurb-info-card"><h4>Parts and repair requirements</h4>${repairs.length?`<div class="refurb-repairs">${repairs.map(x=>`<div><span>${html(x.name)}</span><b>× ${Number(x.quantity)||1}</b></div>`).join('')}</div>`:'<span class="refurb-muted">No parts selected</span>'}</div></div>
  ${resprays.length?`<div class="refurb-respray"><b>Respray required</b> · ${resprays.map(x=>html(x.name)).join(' · ')}</div>`:''}
  <div class="refurb-foot">Last received: ${html(shortDate(latest.receivedAt))} · RefurbFlow batch ${html((latest.batchId||'').slice(0,12))} · ${records.length} stored report${records.length===1?'':'s'}</div>`;
}
function openAsset(id=''){
 const code=String(id||'').trim().toUpperCase();const stored=items.find(a=>a.id===code);
 if(currentPage==='asset'&&dirty&&!confirm('Open another asset without saving your changes?'))return;
 activeAssetId=stored?.id||null;const a=stored||core.normalize({id:code,manufacturer:'',model:'',serial:'',productType:'Laptop',location:'Inspection',status:'Awaiting Processing',condition:'Not assessed'});
 if(!setPage('asset',true))return;
 const form=$('assetEditor');for(const [name,value] of Object.entries(a)){const field=form.elements.namedItem(name);if(field&&['INPUT','TEXTAREA'].includes(field.tagName))field.value=value??'';}
 fillOptions('editProductType',core.productTypes,a.productType);fillOptions('editRamType',core.ramTypes,a.ramType);fillOptions('editSsdType',core.ssdTypes,a.ssdType);
 fillOptions('editPallet',['',...new Set([...managedPallets.map(p=>p.name),...items.map(i=>i.pallet).filter(Boolean),a.pallet||''])].sort(),a.pallet||'');
 $('editPallet').options[0].textContent='No pallet';
 fillOptions('editLocation',[...new Set(['Unassigned',...managedLocations,...items.map(i=>i.location).filter(Boolean),a.location||'Inspection'])].sort(),a.location);
 fillOptions('editCondition',core.conditions,a.condition);fillOptions('editStatus',core.statuses,a.status);
 fillOptions('editCosmetic',core.cosmetics,a.inspection.cosmetic);fillOptions('editFunctional',core.functions,a.inspection.functional);fillOptions('editBattery',core.batteries,a.inspection.battery);
 
 $('editAssetId').readOnly=Boolean(stored);$('editAssetId').title=stored?'Asset IDs cannot be changed on an existing record.':'';
 $('assetPageLabel').textContent=stored?'Asset Details':'New Asset Intake';
 $('assetTopSave').textContent=stored?'✓ Save changes':'＋ Add inventory';$('assetBottomSave').textContent=stored?'▣ Save Changes':'＋ Save New Asset';
 $('assetActivity').innerHTML=(a.history||[]).length?`${a.history.slice().reverse().slice(0,12).map(e=>`<div class="asset-event"><time>${html(shortDate(e.at))}</time><b>${html(e.type)}</b><span>${html(e.detail)}</span></div>`).join('')}`:'<p class="section-note">Activity is recorded once the asset is saved.</p>';
 renderImportedTests(a);renderRefurbishment(a);
 $('assetError').textContent='';$('assetEditedHint').textContent='Changes are saved only when you press Save.';dirty=false;
 $('assetAdvanced').classList.add('hidden');$('assetAdvancedToggle').setAttribute('aria-expanded','false');$('assetAdvancedToggle').textContent='Advanced inspection & history ↓';
 updateAssetOverview();
}
function readAsset(){const f=Object.fromEntries(new FormData($('assetEditor')));f.id=String(f.id||'').trim().toUpperCase();f.inspection={cosmetic:f.cosmetic,functional:f.functional,battery:f.battery};return f;}
function updateAssetOverview(){if(currentPage!=='asset')return;const a=readAsset();const name=deviceName(a),suggested=core.assess(a.inspection),saved=items.find(item=>item.id===activeAssetId),assignedGrade=window.ApexDeviceSummary.grade(a,suggested),work=window.ApexDeviceSummary.process({...saved,...a,refurbishment:saved?.refurbishment},window.ApexWorkflowSnapshot);
 $('assetSummary').innerHTML=window.ApexDeviceSummary.card(a,work,assignedGrade,html,name);
 const printButton=$('assetPrintLabel');
 if(printButton){printButton.disabled=!activeAssetId;printButton.onclick=openAssetPrintDialog;}
 $('assetGradeSuggestion').innerHTML=`<span>Suggested grade</span>${grade(suggested)}<small>${html(suggested.reason)}</small>`;
 $('applySuggested').disabled=suggested.grade==='Pending';
}
window.addEventListener('apex:workflow-updated',()=>{if(currentPage==='asset')updateAssetOverview();});
async function saveAsset(e){e?.preventDefault();const data=readAsset();if(!data.id||!data.model.trim()){$('assetError').textContent='Asset ID and model are required.';return;}
 if(!data.location.trim()){$('assetError').textContent='Location is required.';return;}
 $('assetTopSave').disabled=true;$('assetBottomSave').disabled=true;$('assetError').textContent='';
 try{const r=activeAssetId?await api.update(activeAssetId,data):await api.add(data);if(!r.ok){$('assetError').textContent=r.error||'Could not save asset.';return;}
 activeAssetId=r.item.id;dirty=false;await refresh();openAsset(r.item.id);notify(`Saved ${r.item.id} · ${r.item.status}`);
 }finally{$('assetTopSave').disabled=false;$('assetBottomSave').disabled=false;}
}
function openScan(){if(!setPage('scan'))return;$('inlineScanInput').value='';$('pageScanHelp').textContent='USB/Bluetooth keyboard scanners typically press Enter after a successful scan.';$('inlineScanInput').focus();}
function inventoryLookupFeedback(found){notify(found?'Inventory found':'Inventory not found',found?'success':'warning');}
function resolveScan(raw){const id=window.ApexAssetLabelQR?.readAssetId(raw)||String(raw??'').trim().toUpperCase();if(!id)return;const asset=items.find(i=>i.id===id);inventoryLookupFeedback(Boolean(asset));if(!asset)return;stopCamera();openAsset(asset.id);}
async function toggleCamera(){if(scanRunning||scannerControls||cameraStream){stopCamera();return;}scanRunning=true;$('pageCameraFrame').classList.add('visible');$('pageCameraToggle').textContent='Stop camera';$('pageScanHelp').textContent='Starting camera…';try{
 const video=$('pageCameraVideo');if(window.ZXingBrowser?.BrowserMultiFormatReader){const reader=new window.ZXingBrowser.BrowserMultiFormatReader();scannerControls=await reader.decodeFromVideoDevice(undefined,video,result=>{if(result)resolveScan(result.getText());});}
 else if('BarcodeDetector' in window){const detector=new BarcodeDetector({formats:['qr_code','code_128','code_39','ean_13']});cameraStream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});video.srcObject=cameraStream;await video.play();const tick=async()=>{if(!cameraStream||currentPage!=='scan')return;try{const codes=await detector.detect(video);if(codes.length){resolveScan(codes[0].rawValue);return;}}catch{}requestAnimationFrame(tick);};requestAnimationFrame(tick);}
 else throw Error('Camera barcode scanning is not supported on this device. Use a USB/Bluetooth scanner instead.');
 if(scanRunning)$('pageScanHelp').textContent='Camera active. Show the asset barcode or QR code.';
 }catch(e){stopCamera();$('pageScanHelp').textContent=e?.message||'Camera unavailable.';}
}
function stopCamera(){scanRunning=false;try{scannerControls?.stop();}catch{}scannerControls=null;try{cameraStream?.getTracks().forEach(t=>t.stop());}catch{}cameraStream=null;const v=$('pageCameraVideo');if(v){try{v.pause();v.srcObject=null;}catch{}}$('pageCameraFrame').classList.remove('visible');$('pageCameraToggle').textContent='◎ Open camera scanner';}
async function pairWizard(){
 const status=await api.hubStatus(),active=status.ok&&(status.mode==='shared'||!!status.adminHubUrl);
 showModal('Automatic device connections','SMART INVENTORY / NETWORK',`<div class="modal-body pair-setup">
  <div class="hub-summary"><b>Smart Inventory · Automatic discovery</b><p>Start sharing on your Inventory PC. APEX Diagnostics and the RefurbFlow Android and APEX Diagnostics can find it on the same private local network. No pairing links.</p></div>
  <div class="pair-step"><span>01</span><div><strong>Shared inventory hub</strong><p>Your hub starts automatically on future launches after you enable it once. This computer must stay powered on for live transfers.</p><button id="pairStart" class="primary" type="button">${active?'✓ Hub connected':'▶ Start sharing on this PC'}</button><button id="pairExisting" class="secondary" type="button">Advanced / existing hub</button></div></div>
  <div class="pair-step"><span>02</span><div><strong>Device access</strong><p>For best security, approve the first connection from each laptop. You can instead permit automatic acceptance on a trusted, isolated office LAN.</p>
  <label style="display:flex;align-items:flex-start;gap:10px;margin-top:12px;"><input type="checkbox" id="pairAutoApprove" style="width:18px;min-width:18px;margin-top:2px;" ${active?'':'disabled'}><span><b>Automatically accept new local-network devices</b><br><small>This allows other computers on this network to submit inventory updates. Do not use on guest/public Wi-Fi.</small></span></label>
  <div id="pairDeviceList" style="margin-top:12px"></div><div id="pairRevokedList" style="margin-top:14px"></div><button id="pairRefresh" class="secondary" type="button" ${active?'':'disabled'}>Refresh connected devices</button></div></div>
  <div class="pair-step"><span>03</span><div><strong>Open your other apps</strong><p>Start APEX Diagnostics or direct-sync RefurbFlow Android on the trusted network. Once trusted, devices reconnect without any manual setup.</p></div></div>
  <p id="pairMessage" class="pair-message" role="status">${active?'Hub connected: '+html(status.adminHubUrl||status.url):'Click Start sharing on this PC once to enable discovery.'}</p>
  <div class="modal-actions"><button id="pairClose" class="secondary" type="button">Done</button></div></div>`);
 const msg=$('pairMessage');$('pairClose').onclick=closeModal;$('pairExisting').onclick=hubModal;
 const loadDevices=async()=>{
  const result=await api.hubDevices();
  if(!result.ok){msg.textContent=result.error||'Cannot read devices. Start hub first.';return;}
  $('pairAutoApprove').checked=!!result.autoApprove;
  const devices=result.devices||[],revoked=result.revokedDevices||[];
  $('pairDeviceList').innerHTML=devices.length?devices.map(d=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:9px;border:1px solid var(--line,#484359);border-radius:8px;padding:9px;margin:5px 0;flex-wrap:wrap;"><div><b>${html(d.label)}</b><br><small>${html(d.scope)} · ${html(d.ip||'network')} · ${d.approved?'Approved':'Awaiting approval'}</small></div><div style="display:flex;gap:6px;">${d.approved?'':`<button class="primary" type="button" data-approve="${html(d.id)}">Approve</button>`}<button class="secondary" type="button" data-revoke="${html(d.id)}">Block</button></div></div>`).join(''):'<p class="section-note">No devices discovered yet. Open Diagnostics or the Office Receiver and press Refresh.</p>';
  const revokedList=$('pairRevokedList');
  if(revokedList)revokedList.innerHTML=revoked.length?`<div class="v32-revoked-title">Blocked devices · ${revoked.length}</div>${revoked.map(d=>`<div class="v32-device-row"><div><b>${html(d.label||'Previously blocked device')}</b><small>${html(d.scope||'Diagnostics')} · ID ${html(d.id).slice(0,8)}…</small></div><button class="secondary" type="button" data-unrevoke="${html(d.id)}">Allow reconnect</button></div>`).join('')}`:'<p class="section-note">No devices blocked.</p>';
  document.querySelectorAll('[data-unrevoke]').forEach(b=>b.onclick=async()=>{
   if(!confirm('Allow this previously blocked device to request access again? You may still need to approve it.'))return;
   const result=await api.hubUnrevoke(b.dataset.unrevoke);
   msg.textContent=result.ok?'Unblocked. Reopen Diagnostics or wait for its next connection attempt, then approve the device if prompted.':result.error;
   await loadDevices();
  });
  document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=async()=>{const r=await api.hubApprove(b.dataset.approve);msg.textContent=r.ok?'Device approved. It will connect automatically.':r.error;await loadDevices();});
  document.querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{const r=await api.hubRevoke(b.dataset.revoke);msg.textContent=r.ok?'Device access removed.':r.error;await loadDevices();});
 };
 $('pairStart').onclick=async()=>{msg.textContent='Starting shared hub…';const r=await api.hubStart();if(!r.ok){msg.textContent=r.error;return;}syncMode='shared';await refresh();$('pairAutoApprove').disabled=false;$('pairRefresh').disabled=false;msg.textContent='Hub running. Connect devices on your trusted local network; network firewall must allow TCP 4217 and UDP 4218.';await loadDevices();};
 $('pairRefresh').onclick=loadDevices;
 $('pairAutoApprove').onchange=async e=>{const enabled=e.currentTarget.checked;
  if(enabled&&!confirm('Enable automatic acceptance of new testing devices on this private local network? Only use on a trusted office LAN, not guest/public Wi-Fi.')){e.currentTarget.checked=false;return;}
  const r=await api.hubAutoApprove(enabled);msg.textContent=r.ok?(enabled?'Trusted-LAN automatic access enabled. No pairing links needed.':'New devices will require one click to approve.'):(r.error||'Could not save connection setting');if(!r.ok)e.currentTarget.checked=!enabled;await loadDevices();
 };
 if(active)await loadDevices();
}
async function hubModal(){const r=await api.hubStatus();const active=r.ok&&r.mode==='shared';
 showModal('Advanced hub connection','SMART INVENTORY / CONNECTION',`<div class="modal-body"><div class="hub-summary"><b>${active?'● Shared hub connected':'● Local workspace'}</b><p>${active?html(r.url):'Assets are stored locally until a shared hub is connected.'}</p></div><p class="section-note">Usually, use Automatic discovery instead. This advanced screen supports existing hubs and admin keys.</p><button id="openPairWizard" type="button" class="primary">Automatic connection setup →</button><form id="connectForm" style="margin-top:18px"><label class="field">Hub address<input name="url" required placeholder="http://192.168.1.15:4217" value="${active?html(r.url):''}"></label><label class="field">Admin hub token<input type="password" name="token" minlength="32" required autocomplete="off" placeholder="Admin hub token"></label><p class="hub-warning">Trusted private LAN / VPN only for HTTP. Switching to a shared hub does not merge local items automatically.</p><div class="form-error" id="hubError"></div><div class="modal-actions"><button type="button" class="secondary" id="hubCancel">Close</button>${active?'<button type="button" class="secondary" id="hubDisconnect">Disconnect</button>':''}<button type="submit" class="primary">Connect hub ↗</button></div></form></div>`);
 $('openPairWizard').onclick=pairWizard;$('hubCancel').onclick=closeModal;
 $('connectForm').onsubmit=async e=>{e.preventDefault();const c=Object.fromEntries(new FormData(e.currentTarget));const res=await api.hubConnect(c);if(!res.ok){$('hubError').textContent=res.error;return;}syncMode='shared';items=[];closeModal();setPage('inventory',true);$('inventorySearch').value='';await refresh();notify('Connected to shared hub');};
 if(active)$('hubDisconnect').onclick=async()=>{const res=await api.hubDisconnect();if(!res.ok){$('hubError').textContent=res.error;return;}syncMode='local';items=[];closeModal();setPage('inventory',true);$('inventorySearch').value='';await refresh();notify('Showing local inventory');};
}
function changePasswordModal(){showModal('Set your admin password','SECURITY / FIRST SIGN-IN',`<form id="passwordForm" class="modal-body"><p class="help-text">Change the temporary admin password before using your desktop inventory.</p><label class="field">Temporary password<input name="old" type="password" required autocomplete="current-password"></label><label class="field">New password (8 or more characters)<input name="next" type="password" minlength="8" required autocomplete="new-password"></label><label class="field">Confirm new password<input name="confirm" type="password" minlength="8" required autocomplete="new-password"></label><div class="form-error" id="passwordError"></div><div class="modal-actions"><button type="submit" class="primary">Save password & continue</button></div></form>`,false);
 $('passwordForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(f.get('next')!==f.get('confirm')){$('passwordError').textContent='Passwords do not match.';return;}const r=await api.changePassword(f.get('old'),f.get('next'));if(!r.ok){$('passwordError').textContent=r.error;return;}closeModal();await loadSession();notify('Admin password changed');};}
async function loadSession(){const s=await api.hubStatus();syncMode=s.ok?s.mode:'local';cloudRefreshFailed=false;cloudLastRefresh=0;lastHubVersion=null;await refresh();}
let apexLoginMode='local',apexRememberedEmail='';
function updateLoginPassword(){const saved=apexLoginMode==='cloud'&&apexRememberedEmail&&$('apexRememberCloud').checked&&$('loginCloudEmail').value.trim().toLowerCase()===apexRememberedEmail.toLowerCase();$('loginPass').required=!saved;$('loginPass').placeholder=saved?'Saved sign-in available':'Enter password';$('loginSavedHint').classList.toggle('hidden',!saved);}
$('loginCloudEmail').addEventListener('input',updateLoginPassword);$('apexRememberCloud').addEventListener('change',updateLoginPassword);
function selectLoginMode(mode){apexLoginMode=mode;const cloud=mode==='cloud';$('apexCloudCredentials').classList.toggle('hidden',!cloud);$('apexRememberCloudBox').classList.toggle('hidden',!cloud);$('apexRememberCloudBox').style.display=cloud?'flex':'none';$('apexLocalUsername').classList.toggle('hidden',cloud);$('apexLocalHint').classList.toggle('hidden',cloud);$('loginLocalMode').classList.toggle('selected',!cloud);$('loginCloudMode').classList.toggle('selected',cloud);$('loginError').textContent='';$('loginUser').required=!cloud;$('loginCloudEmail').required=cloud;$('apexLoginDescription').textContent=cloud?'Sign in with your shared APEX email and password.':'Open the local workspace or administer this hub PC.';$('apexLoginFooter').textContent=cloud?'SHARED APEX WORKSPACE':'LOCAL / HUB ADMINISTRATOR';$('apexLoginHelp').textContent=cloud?'Need an account? Ask your administrator.':'Administrator access for this PC or trusted hub. Use shared sign-in for cloud inventory.';updateLoginPassword();}
$('loginLocalMode').onclick=()=>selectLoginMode('local');$('loginCloudMode').onclick=()=>selectLoginMode('cloud');
api.cloudLoginInfo().then(async r=>{selectLoginMode(r?.ok&&r.configured?'cloud':'local');const saved=await api.cloudRememberedInfo();if(saved?.remembered){apexRememberedEmail=saved.email||'';selectLoginMode('cloud');$('loginCloudEmail').value=apexRememberedEmail;updateLoginPassword();}}).catch(()=>{});
$('apexStaffAuthSave').onclick=async()=>{if(window.apexEnsureSettingsUnlocked&&!await window.apexEnsureSettingsUnlocked())return;const r=await api.cloudLoginConfigure({url:$('apexStaffAuthUrl').value,anonKey:$('apexStaffAuthKey').value});$('apexStaffAuthResult').textContent=r?.ok?'Staff login configured for this computer. Staff can now sign in with email and password.':r?.error||'Unable to save.';if(r?.ok){$('apexStaffAuthKey').value='';$('apexStaffAuthUrl').value='';}};
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginError').textContent='';const useSaved=apexLoginMode==='cloud'&&apexRememberedEmail&&$('apexRememberCloud').checked&&!$('loginPass').value&&$('loginCloudEmail').value.trim().toLowerCase()===apexRememberedEmail.toLowerCase();const r=useSaved?await api.cloudResume():apexLoginMode==='cloud'?await api.cloudStaffLogin({email:$('loginCloudEmail').value,password:$('loginPass').value,rememberMe:$('apexRememberCloud').checked}):await api.login({username:$('loginUser').value,password:$('loginPass').value});if(!r.ok){if(useSaved){apexRememberedEmail='';updateLoginPassword();}$('loginError').textContent=r.error||'Please enter your password and sign in again.';return;}if(r.warning)console.warn(r.warning);$('loginPass').value='';$('loginPage').classList.add('hidden');$('appPage').classList.remove('hidden');if(r.mustChangePassword)changePasswordModal();else await loadSession();};
document.querySelectorAll('[data-eye]').forEach(b=>b.onclick=()=>{const f=$(b.dataset.eye);f.type=f.type==='password'?'text':'password';b.textContent=f.type==='password'?'Show':'Hide';});
document.querySelectorAll('.menu-item').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
for(const id of ['dashAdd','invAdd'])$(id).onclick=()=>openAsset();
for(const id of ['topScan','invScan'])$(id).onclick=openScan;
for(const id of ['dashBrowse','viewAll','assetBack','assetCancel','scanBack','deviceReturnInventory'])$(id).onclick=()=>setPage('inventory');
$('assetEditor').onsubmit=saveAsset;$('assetTopSave').onclick=()=>$('assetEditor').requestSubmit();
$('assetEditor').addEventListener('input',()=>{dirty=true;updateAssetOverview();$('assetEditedHint').textContent='Unsaved changes · press Save changes when ready.';});
$('assetEditor').addEventListener('change',()=>{dirty=true;updateAssetOverview();});
$('applySuggested').onclick=()=>{const suggestion=core.assess(readAsset().inspection).grade;if(suggestion==='Pending')return;$('editCondition').value=suggestion;dirty=true;updateAssetOverview();};
$('inlineScanForm').onsubmit=e=>{e.preventDefault();resolveScan($('inlineScanInput').value);};$('pageCameraToggle').onclick=toggleCamera;
$('assetAdvancedToggle').onclick=()=>{const opening=$('assetAdvanced').classList.contains('hidden');$('assetAdvanced').classList.toggle('hidden',!opening);$('assetAdvancedToggle').setAttribute('aria-expanded',String(opening));$('assetAdvancedToggle').textContent=opening?'Hide inspection & history ↑':'Advanced inspection & history ↓';};
$('locScan').onclick=openScan;
$('reportExport').onclick=exportInventory;$('settingsExport').onclick=exportInventory;
$('reportPrint').onclick=printInventory;
$('userChangePassword').onclick=adminPasswordModal;
$('settingsHubButton').onclick=hubModal;$('settingsPairButton').onclick=pairWizard;
$('hubSettings').onclick=pairWizard;$('modalClose').onclick=closeModal;$('modalLayer').onclick=e=>{if(e.target===$('modalLayer')&&!$('modalClose').classList.contains('hidden'))closeModal();};
let inventorySearchTimer;
 for(const id of ['inventorySearch','locationFilter','gradeFilter','statusFilter'])$(id).addEventListener(id==='inventorySearch'?'input':'change',()=>{
  inventoryPageIndex=0;
  if(id==='inventorySearch'){clearTimeout(inventorySearchTimer);inventorySearchTimer=setTimeout(render,120);}
  else render();
 });
$('inventorySearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(inventoryLookupTimer);resolveScan(e.currentTarget.value);}});
let inventoryLookupTimer;
$('inventorySearch').addEventListener('input',()=>{clearTimeout(inventoryLookupTimer);const value=$('inventorySearch').value.trim();if(!value)return;inventoryLookupTimer=setTimeout(()=>{const code=(window.ApexAssetLabelQR?.readAssetId(value)||value).toUpperCase(),found=items.some(a=>a.id===code);if(found)inventoryLookupFeedback(true);else if(!items.some(a=>[a.id,a.model,a.manufacturer,a.serial].some(v=>String(v||'').toLowerCase().includes(value.toLowerCase()))))inventoryLookupFeedback(false);},650);});
api.onInventoryArrived?.(event=>{if(currentPage==='asset'&&dirty)return;if(!$('modalLayer').classList.contains('hidden'))return;refresh(true);if(event?.open)setPage('inventory');});
$('globalSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();resolveScan(e.target.value);e.target.value='';}};
$('sidebarUser').onclick=async()=>{if(currentPage==='asset'&&dirty&&!confirm('Sign out without saving changes?'))return;stopCamera();closeModal();await api.logout();items=[];syncMode='local';lastHubVersion=null;dirty=false;$('appPage').classList.add('hidden');$('loginPage').classList.remove('hidden');$('loginPass').focus();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modalLayer').classList.contains('hidden')&&!$('modalClose').classList.contains('hidden'))closeModal();});
// Refresh only while the workspace is in use. Background windows do not need
// repeated IPC/network requests; resuming the window triggers a fresh check.
function canBackgroundRefresh(){
 return document.visibilityState!=='hidden' &&
  (syncMode==='shared'||syncMode==='cloud') && !$('appPage').classList.contains('hidden') &&
  !(syncMode==='cloud'&&currentPage==='asset'&&dirty) &&
  $('modalLayer').classList.contains('hidden') && !syncBusy;
}
setInterval(()=>{if(canBackgroundRefresh())refresh(true);},10000);
document.addEventListener('visibilitychange',()=>{
 if(canBackgroundRefresh())refresh(true);
});
updateConnection();
// One preference for login and all workspace pages. Apply before sign-in to avoid flashing themes.
const appearanceKey='apex-inventory-appearance-v1';
function applyTheme(theme){
 const mode=theme==='light'?'light':'dark';document.documentElement.dataset.theme=mode;
 try{localStorage.setItem(appearanceKey,mode);}catch{}
 const button=$('topTheme');if(button)button.innerHTML=mode==='dark'?'☀ <span>Light</span>':'☾ <span>Dark</span>';
 document.querySelectorAll('[data-set-theme]').forEach(b=>{b.classList.toggle('selected',b.dataset.setTheme===mode);b.setAttribute('aria-pressed',String(b.dataset.setTheme===mode));});
}
try{applyTheme(localStorage.getItem(appearanceKey)||'light');}catch{applyTheme('light');}
$('topTheme').onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
document.querySelectorAll('[data-set-theme]').forEach(b=>b.onclick=()=>applyTheme(b.dataset.setTheme));

