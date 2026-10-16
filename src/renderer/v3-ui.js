'use strict';
// APEX v3 workspace layer; reuses the existing verified inventory, hub, and repairs logic.
(function(){
const groups={refurbWorkspace:[['refurbWorkspace','Refurbishment']],dashboard:[['dashboard','Today']],scan:[],inventory:[['inventory','All devices'],['locations','Locations'],['pallets','Pallets'],['palletLocations','Pallet locations']],reports:[['reports','Reports & exports']],settings:[['settings','Admin Centre'],['users','Users']]};
const groupNames={refurbWorkspace:'Refurbishment',dashboard:'Dashboard',scan:'Scan',inventory:'Inventory',reports:'Reports',settings:'Admin Centre'};
const esc=html;
const getGroup=p=>p==='asset'||p==='scan'||p==='palletLocationDetail'||p==='containerInventory'?'inventory':p==='bulk'?'scan':Object.keys(groups).find(k=>groups[k].some(x=>x[0]===p))||'dashboard';
const titles={refurbWorkspace:'Manage refurbishment work, parts and final checks',scan:'Scan assets or a saved location to build a batch',dashboard:'Assets, refurbishment and outstanding work',inventory:'Devices, locations and pallets in one place',reports:'A4 reports and simple Excel exports',settings:'Connection and workstation settings'};
// Preserve existing page IDs and rendering logic, but group routes behind only four main navigation items.
const parentSetPage=setPage;
let assetTab='overview',lastGroup='dashboard',reportTab='worksheet';
function renderTabs(page){const group=getGroup(page),bar=$('v3Tabs'),selectedTab=page==='containerInventory'?(window.ApexContainerInventory?.tab()||'pallets'):page==='palletLocationDetail'?'palletLocations':page;lastGroup=group;$('v3Workspace').textContent=groupNames[group];$('v3WorkspaceSubtitle').textContent=titles[group];
if(page==='asset')$('v3WorkspaceSubtitle').textContent='Specifications, refurb notes and diagnostics in one place';
bar.innerHTML=(groups[group]||[]).map(([id,label])=>`<button type="button" class="v3-tab ${id===selectedTab?'selected':''}" data-v3tab="${id}" role="tab" aria-selected="${id===selectedTab}">${label}</button>`).join('');
bar.querySelectorAll('[data-v3tab]').forEach(b=>b.onclick=()=>setPage(b.dataset.v3tab));
document.querySelectorAll('.sidebar .menu-item').forEach(b=>b.classList.toggle('active',b.dataset.page===group));
const tabCount=(groups[group]||[]).length;bar.classList.toggle('v3-single',tabCount===1);
}
setPage=function(page,force){const result=parentSetPage(page,force);if(!result)return false;renderTabs(page);
if(page==='asset'){assetTab='overview';updateAssetTabs();}
if(page==='reports')renderReports();
return true;};
// Existing app.js installed navigation handlers with late-binding setPage(); no event replacement needed.
$('v3Settings').onclick=()=>setPage('settings');
// The asset summary stays present while only one compact detail pane is shown.
// The Overview is a focused summary. Advanced checks and the audit trail live in History & checks.
const assetOverviewStyle=document.createElement('style');
assetOverviewStyle.textContent='#assetPage[data-section="overview"] #assetAdvanced,#assetPage[data-section="overview"] #assetAdvancedToggle{display:none!important}';
document.head.appendChild(assetOverviewStyle);
const assetSection=$('assetPage'),tabs=document.createElement('div');tabs.id='v3AssetTabs';tabs.className='v3-asset-tabs';
assetSection.querySelector('.asset-summary')?.after(tabs);
function updateAssetTabs(){if(currentPage!=='asset')return;assetSection.dataset.section=assetTab;
const choices=[['overview','Overview'],['refurb','Refurb notes'],['parts','Parts & repair'],['tests','Hardware tests'],['history','History & checks']];
tabs.innerHTML=choices.map(([k,n])=>`<button type="button" class="v3-tab ${assetTab===k?'selected':''}" data-asset-tab="${k}">${n}</button>`).join('');
tabs.querySelectorAll('[data-asset-tab]').forEach(b=>b.onclick=()=>{assetTab=b.dataset.assetTab;updateAssetTabs();});
if(assetTab==='history'){$('assetAdvanced').classList.remove('hidden');$('assetAdvancedToggle').setAttribute('aria-expanded','true');renderHistoryWorkspace();}
}
// Unified, persisted asset trail. Keep record sources immutable and retain original timestamps.
const savedHistory=new Map();
function historyState(id){const asset=items.find(a=>a.id===id),key=id+':'+(asset?.createdAt||'');if(!savedHistory.has(key))savedHistory.set(key,{events:[],cursor:null,loaded:false,busy:false,error:''});return savedHistory.get(key);}
async function loadSavedHistory(id,state,append=false){
 if(state.busy||!api.assetActivity)return;state.busy=true;state.error='';renderHistoryWorkspace();
 try{const result=await api.assetActivity({id,cursor:append?state.cursor:null,limit:100});if(!result.ok)throw Error(result.error||'Saved trail unavailable.');state.events=window.ApexAssetTimeline.merge(append?state.events:[],result.events||[]);state.cursor=result.nextCursor||null;}
 catch(e){state.error=e.message||'Saved trail unavailable.';}
 finally{state.loaded=true;state.busy=false;if(currentPage==='asset'&&assetTab==='history'&&activeAssetId===id)renderHistoryWorkspace();}
}
function historyCategory(value){const v=String(value||'').toLowerCase();if(/test|check|diagnos|inspect|quality|battery/.test(v))return 'checks';if(/repair|refurb|part|order|respray/.test(v))return 'repair';return 'inventory';}
function renderHistoryWorkspace(){
 const host=$('assetAdvanced'),activity=$('assetActivity');if(!host||!activity)return;
 host.classList.add('v63-history-ready');
 let toolbar=host.querySelector('#v63HistoryTools');
 if(!toolbar){
  toolbar=document.createElement('div');toolbar.id='v63HistoryTools';toolbar.className='v63-history-tools';
  const heading=host.querySelector('.history-heading');heading?.before(toolbar);
  toolbar.innerHTML='<div class="v63-history-intro"><div><span class="v63-history-eyebrow">DEVICE AUDIT TRAIL</span><h3>History &amp; checks</h3><p>Recorded inventory changes, diagnostics and refurbishment activity for this asset.</p></div><strong id="v63HistoryCount" aria-live="polite"></strong></div><div class="v63-history-controls"><label>Search activity<input id="v63HistoryQuery" type="search" placeholder="Search recorded events" autocomplete="off"></label><label>Event type<select id="v63HistoryFilter"><option value="all">All events</option><option value="inventory">Inventory</option><option value="checks">Checks</option><option value="repair">Repairs</option></select></label></div>';
  const footer=document.createElement('div');footer.className='asset-history-footer';footer.innerHTML='<span id="assetHistoryStatus" role="status"></span><div><button type="button" class="secondary" id="assetHistoryOlder">Load older events</button><button type="button" class="secondary" id="assetHistoryRefresh">Refresh trail</button></div>';toolbar.appendChild(footer);
  $('assetHistoryOlder').onclick=()=>loadSavedHistory(activeAssetId,historyState(activeAssetId),true);
  $('assetHistoryRefresh').onclick=()=>loadSavedHistory(activeAssetId,historyState(activeAssetId));
  toolbar.querySelector('#v63HistoryQuery').addEventListener('input',filterHistoryWorkspace);
  toolbar.querySelector('#v63HistoryFilter').addEventListener('change',filterHistoryWorkspace);
 }
 activity.classList.add('v63-history-timeline');
 // Combine saved inventory history and the separate refurbishment audit for this asset.
 // Keep source records immutable and sort by their original timestamps.
 const asset=items.find(a=>a.id===activeAssetId),saved=historyState(activeAssetId);
 if(host.dataset.historyAsset!==activeAssetId){host.dataset.historyAsset=activeAssetId;$('v63HistoryQuery').value='';$('v63HistoryFilter').value='all';}
 const inventory=Array.isArray(asset?.history)?asset.history:[];
 const workflow=Array.isArray(window.ApexWorkflowSnapshot?.audit)?window.ApexWorkflowSnapshot.audit.filter(e=>e.assetId===activeAssetId):[];
 const events=window.ApexAssetTimeline.merge(inventory,workflow,saved.events);
 $('assetHistoryStatus').textContent=saved.busy?'Loading saved activity…':saved.error?'Saved trail unavailable: '+saved.error:api.assetActivity?'Recorded changes for this asset.':'Showing recent activity from this connection.';
 $('assetHistoryOlder').hidden=!saved.cursor;$('assetHistoryOlder').disabled=saved.busy;$('assetHistoryRefresh').disabled=saved.busy||!api.assetActivity;
 activity.innerHTML=events.length?events.map(e=>'<div class="asset-event v63-history-event"><time>'+esc(shortDate(e.at))+'</time><b>'+esc(e.type||'Activity')+'</b><span>'+esc(e.detail||'')+(e.by?' · By '+esc(e.by):'')+'</span></div>').join(''):'<p class="section-note">No recorded activity for this asset yet.</p>';
 for(const node of activity.querySelectorAll('.asset-event'))node.dataset.category=historyCategory(node.querySelector('b')?.textContent);

 filterHistoryWorkspace();
 if(!saved.loaded&&!saved.busy&&api.assetActivity)void loadSavedHistory(activeAssetId,saved);
}
function filterHistoryWorkspace(){
 const host=$('assetAdvanced');if(!host)return;
 const activity=$('assetActivity'),filter=host.querySelector('#v63HistoryFilter')?.value||'all',query=(host.querySelector('#v63HistoryQuery')?.value||'').trim().toLowerCase();
 const nodes=[...activity.querySelectorAll('.asset-event')];let visible=0;
 for(const node of nodes){const show=(filter==='all'||node.dataset.category===filter)&&(!query||node.textContent.toLowerCase().includes(query));node.hidden=!show;if(show)visible++;}
 const count=host.querySelector('#v63HistoryCount');if(count)count.textContent=visible+' of '+nodes.length+' loaded events';
 let empty=activity.querySelector('.v63-history-empty');if(!empty){empty=document.createElement('p');empty.className='v63-history-empty';empty.textContent='No activity matches this filter.';activity.append(empty);}
 empty.hidden=Boolean(visible)||!nodes.length;
}
// Open asset direct from scan; sidebar remains on Inventory.
const oldOpenAsset=openAsset;openAsset=function(...args){const r=oldOpenAsset(...args);assetTab='overview';updateAssetTabs();return r;};
function snapshot(){return window.ApexWorkflowSnapshot||{jobs:{},orders:[],audit:[]};}
const name=a=>deviceName(a);
function exportRows(kind){const ops=snapshot();
if(kind==='refurb-parts')return window.ApexRefurbExport.templatePartsRows(items,ops);
if(kind==='orders'){const rows=[['Purchase Order','Supplier','Asset Tag','Full Manufacturer and Model','Part Needed','Quantity','Received','Expected Date','Status']];
for(const o of ops.orders||[])for(const line of o.lines||[]){const a=items.find(x=>x.id===line.assetId);rows.push([o.id,o.supplier||'Not selected',line.assetId,a?name(a):'',line.name,line.qty,line.received,o.expectedAt||'',o.status==='Draft'?'Draft':line.qty===line.received?'Received':'Ordered']);}return rows;}
return [['Asset Tag','Full Manufacturer and Model','Serial Number','Location','Condition','Processing Status','Refurb notes'],...items.map(a=>[a.id,name(a),a.serial,a.location,a.condition,a.status,a.refurbNotes||''])];
}
async function xlsxExport(kind){const rows=exportRows(kind);if(rows.length===1){notify('Nothing to export yet.');return;}
if(!api.exportXlsx){notify('Excel export requires the Electron desktop app.');return;}
try{const r=await api.exportXlsx(rows,kind);if(r.ok)notify('Excel workbook saved');else if(!r.cancelled)notify(r.error||'Could not export');}catch(e){notify('Excel export failed');}
}
// Report view: focused, no long page of report cards. Print sheets on A4.
function renderReports(){if(currentPage!=='reports')return;
const holder=$('v3ReportsWorkspace');const ops=snapshot(),assetsWithJobs=Object.keys(ops.jobs||{}).filter(id=>items.some(a=>a.id===id));
const selected=holder.querySelector('#v3ReportAsset')?.value||assetsWithJobs[0]||'';
const choices=[['worksheet','A4 Refurb worksheet'],['refurb-parts','Refurb parts → Excel'],['qc','Final QC'],['inventory','Inventory']];
holder.innerHTML=`<div class="v3-reports"><div class="v3-report-tabs">${choices.map(([id,label])=>`<button type="button" class="v3-tab ${reportTab===id?'selected':''}" data-report-tab="${id}">${label}</button>`).join('')}</div><div class="v3-report-body"><div><h2>${esc(choices.find(([id])=>id===reportTab)?.[1]||'Reports')}</h2><p>${reportTab==='worksheet'?'A clean A4 repair worksheet with only required repairs, RefurbFlow notes and sign-off.':reportTab==='refurb-parts'?'Export one Excel row for every required part, repeating Asset ID, full device name and serial number.':reportTab==='qc'?'Final checks and only tests that were actually completed.':'Inventory register with model, condition and location.'}</p></div>${['worksheet','qc'].includes(reportTab)?`<label>Choose asset <select id="v3ReportAsset">${assetsWithJobs.map(id=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(id)} — ${esc(name(items.find(a=>a.id===id)))}</option>`).join('')}</select></label>`:''}<div class="v3-report-actions">${reportTab!=='refurb-parts'?'<button id="v3PrintReport" class="primary" type="button">▤ Print A4</button>':'<button id="v3PrintReport" class="secondary" type="button">▤ Print A4 parts list</button>'}${['refurb-parts','inventory'].includes(reportTab)?'<button id="v3ExcelReport" class="primary" type="button">↓ Export Excel (.xlsx)</button>':''}</div>${reportTab==='worksheet'&&assetsWithJobs.length>1?'<button type="button" class="secondary" id="v3BatchPrint">Print all refurbishment worksheets (A4)</button>':''}<div class="v3-report-hint">Excel exports include a separate Refurb notes column. All printouts are A4.</div></div></div>`;holder.querySelectorAll('[data-report-tab]').forEach(b=>b.onclick=()=>{reportTab=b.dataset.reportTab;renderReports();});
if($('v3ExcelReport'))$('v3ExcelReport').onclick=()=>xlsxExport(reportTab==='inventory'?'inventory':'refurb-parts');
if($('v3BatchPrint'))$('v3BatchPrint').onclick=()=>{if(confirm('Print all '+Math.min(assetsWithJobs.length,40)+' worksheets? Each will use a separate A4 page.'))window.ApexOps.printBatchWorksheets(assetsWithJobs);};
$('v3PrintReport').onclick=()=>{const opt=window.ApexOps;if(!opt){notify('Reports are loading');return;}const id=$('v3ReportAsset')?.value;
if(reportTab==='worksheet')opt.printWorksheet(id);else if(reportTab==='qc')opt.printQCReport(id);else if(reportTab==='refurb-parts')opt.printRefurbPartsReport();else printInventory();};
}
// Destructive actions are explicit, admin-gated in the Electron main process and hub.
// A permanent deletion is NOT a soft delete; linked jobs, order lines and drafts are cleaned up.
async function deleteAsset(id){
 const entry=items.find(a=>a.id===id);
 if(!entry){notify('The asset is no longer in inventory.');return;}
 showModal('Delete this laptop?', 'CONFIRM PERMANENT DELETION', `<div class="modal-body">
  <p class="section-note" style="font-size:13px;line-height:1.7">Permanently remove <strong>${esc(id)} — ${esc(name(entry))}</strong> from Smart Inventory?</p>
  <p class="section-note">This also deletes its linked refurbishment information, repair job and purchase-order lines. Other laptops and their order lines are not affected. <strong>This cannot be undone.</strong></p>
  <div id="v32DeleteError" class="form-error" role="alert"></div>
  <div class="modal-actions"><button id="v32CancelDelete" type="button" class="secondary">Cancel</button><button id="v32ConfirmDelete" type="button" class="v32-danger-button">Yes, delete asset</button></div></div>`);
 $('v32CancelDelete').onclick=closeModal;
 $('v32ConfirmDelete').onclick=async()=>{
   const b=$('v32ConfirmDelete');b.disabled=true;b.textContent='Deleting…';
   const r=await api.manageDelete({type:'hardDeleteAsset',assetId:id});
   if(!r.ok){$('v32DeleteError').textContent=r.error||'Delete failed';b.disabled=false;b.textContent='Yes, delete asset';return;}
   closeModal();dirty=false;activeAssetId=null;await refresh();setPage('inventory',true);window.ApexOps?.load(true);notify('Asset and linked records permanently deleted');
 };
}
// Called by the inventory table and the current asset page.
window.apexDeleteAsset=deleteAsset;
const deleteWrap=document.createElement('div');deleteWrap.className='v3-delete-wrap';tabs.after(deleteWrap);
const manage=document.createElement('button');manage.className='secondary';manage.type='button';manage.textContent='Manage / clear asset data';deleteWrap.appendChild(manage);
const danger=document.createElement('button');danger.id='v3DeleteAsset';danger.type='button';danger.className='v3-delete';danger.textContent='Delete asset';deleteWrap.appendChild(danger);
danger.onclick=()=>{if(!activeAssetId){notify('Save this asset first.');return;}deleteAsset(activeAssetId);};
manage.onclick=()=>{
 const id=activeAssetId;if(!id){notify('Open a registered asset first.');return;}
 showModal('Manage asset information','ADMIN / DELETE OR CLEAR',`<div class="modal-body"><p class="section-note">Clear specific data from <b>${esc(id)}</b> without deleting the laptop.</p><div class="v3-manage-grid"><button type="button" class="secondary" data-clean="deleteRefurb">Clear refurb notes, parts and repair job</button><button type="button" class="secondary" data-clean="deleteJob">Clear repair job and related order lines</button><button type="button" class="secondary" data-clean="clearTests">Clear imported Diagnostics results</button><button type="button" class="v3-delete" id="v32DeleteAll">Delete entire asset permanently</button></div><p class="section-note">Only this asset is affected. Deleting approved orders may affect purchasing history; an audit record is retained.</p><div class="modal-actions"><button id="v3CloseManage" type="button" class="secondary">Close</button></div></div>`);
 $('v3CloseManage').onclick=closeModal;
 $('v32DeleteAll').onclick=()=>deleteAsset(id);
 document.querySelectorAll('[data-clean]').forEach(button=>button.onclick=async()=>{
  if(!confirm(`Are you sure you want to ${button.textContent.trim().toLowerCase()} for ${id}?`))return;
  const r=await api.manageDelete({type:button.dataset.clean,assetId:id});
  if(!r.ok){notify(r.error||'Delete failed');return;}
  closeModal();dirty=false;await refresh();openAsset(id);window.ApexOps?.load(true);notify('Selected data removed');
 });
};
function attention(){const host=$('v3Today');if(!host)return;const ops=snapshot(),jobs=Object.values(ops.jobs||{});const parts=jobs.reduce((n,j)=>n+(j.parts||[]).length,0);
const tiles=[['Registered laptops',items.length,'inventory'],['Refurb jobs',jobs.length,'refurbJobs'],['Parts required',parts,'refurbJobs'],['Final QC',jobs.filter(j=>j.status==='Quality Control').length,'qc']];
host.innerHTML=tiles.map(([t,n,id])=>`<button type="button" class="v3-today-tile" data-go="${id}"><small>${t}</small><strong>${n}</strong><span>Open →</span></button>`).join('');host.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>setPage(b.dataset.go));}
const dashboard=$('dashboardPage');const today=document.createElement('div');today.id='v3Today';today.className='v3-today';dashboard.querySelector('.metrics')?.before(today);
// Reapply action indicators when the hub refreshes or workflow changes.
window.addEventListener('apex:workflow-updated',()=>{attention();if(currentPage==='reports')renderReports();if(currentPage==='asset'&&assetTab==='history')renderHistoryWorkspace();});
const savedRender=render;render=function(...args){const v=savedRender(...args);attention();if(currentPage==='asset'&&assetTab==='history')renderHistoryWorkspace();return v;};
renderTabs(currentPage);attention();
})();
