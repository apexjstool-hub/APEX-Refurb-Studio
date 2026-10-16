'use strict';
/* APEX v3.4: reference-matched presentation layer.
 * Uses the existing inventory, hub, diagnostics, reports and RefurbFlow functions.
 * No additional data store and no alternate save path are introduced.
 */
(function () {
  const byId = id => document.getElementById(id);
  const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const label = asset => deviceName(asset);
  const root = document.documentElement;
  root.classList.add('apex-v34');
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    const brand = sidebar.querySelector('.sidebar-header .wordmark span');
    if (brand) brand.innerHTML = 'APEX <b>Refurb Management Studio</b>';
    byId('hubSettings')?.setAttribute('aria-label', 'Inventory connection settings');
  }
  // Keep each existing button and listener. Only relocate the live elements.
  const actionSlot = document.createElement('div');
  actionSlot.id = 'v34HeaderActions';
  actionSlot.className = 'v34-header-actions';
  document.querySelector('.v3-topline')?.appendChild(actionSlot);
  ['invScan','invAdd','assetTopSave'].forEach(id => {
    const btn = byId(id);
    if (btn) { actionSlot.appendChild(btn); if(id==='assetTopSave'){btn.classList.remove('hidden');btn.classList.add('primary');btn.setAttribute('aria-label','Save asset changes');} }
  });
  const dashboard = byId('dashboardPage');
  const dashboardView = document.createElement('div');
  dashboardView.id = 'v34Dashboard';
  dashboardView.className = 'v34-dashboard';
  dashboard?.prepend(dashboardView);
  // Group existing form inputs without changing form names, values or submit handlers.
  const editor = byId('assetEditor');
  const fieldGrid = editor?.querySelector('.flat-fields');
  if (fieldGrid) {
    const general = ['id', 'manufacturer', 'model', 'serial', 'productType', 'sku', 'location', 'pallet', 'condition', 'status'];
    const hardware = ['processor', 'gpu', 'operatingSystem', 'batteryPercentage', 'ram', 'ramType', 'storage', 'ssdType'];
    const columns = document.createElement('div');
    columns.className = 'v34-editor-columns';
    const makeSection = (heading, hint, names, cls) => {
      const section = document.createElement('section');
      section.className = 'v34-form-group ' + cls;
      section.innerHTML = `<div class="v34-form-group-head"><h3>${heading}</h3><span>${hint}</span></div>`;
      const fields = document.createElement('div'); fields.className = 'v34-group-fields';
      names.forEach(name => {
        const element = fieldGrid.querySelector(`[name="${name}"]`);
        if (element) {
          const field = element.closest('label');
          if (field) fields.appendChild(field);
        }
      });
      section.appendChild(fields); columns.appendChild(section);
    };
    makeSection('General Information', 'Asset identity and location', general, 'v34-general');
    makeSection('Hardware Information', 'Synced from APEX Diagnostics', hardware, 'v34-hardware');
    fieldGrid.replaceWith(columns);
    const header = editor.querySelector('.flat-editor-heading h2');
    if (header) header.textContent = 'Device Information';
  }
  // Clean row layout: serial has its own column; View/Delete still work via existing listeners.
  rows = function(data, actions) {
    if (!data.length) return '<div class="empty"><strong>No devices found</strong><p>Scan an asset ID or add a device to begin.</p></div>';
    return `<table class="asset-table v34-table"><thead><tr><th>Asset ID</th><th>Device</th><th>Serial Number</th><th>Location</th><th>Status</th>${actions?'<th class="v34-actions-cell">Actions</th>':''}</tr></thead><tbody>${data.map(asset => `<tr><td><button class="asset-link" data-asset="${escapeText(asset.id)}">${escapeText(asset.id)}</button></td><td><strong>${escapeText(label(asset))}</strong></td><td class="v34-serial">${escapeText(asset.serial || '—')}</td><td>${escapeText(asset.location || 'Unassigned')}</td><td>${asset.status==='Processed'?'<span class="v34-state v34-done">Processed</span>':'<span class="v34-state v34-wait">Awaiting Processing</span>'}</td>${actions?`<td class="v34-actions-cell"><button class="v34-row-delete" type="button" data-delete-asset="${escapeText(asset.id)}" aria-label="Delete ${escapeText(asset.id)}" title="Delete ${escapeText(asset.id)}">×</button></td>`:''}</tr>`).join('')}</tbody></table>`;
  };
  // Small, genuinely useful overview instead of the old hero/grade dashboard.
  function renderDashboard() {
    if (!dashboardView) return;
    const snapshot = window.ApexWorkflowSnapshot || {jobs:{}};
    const jobs = Object.values(snapshot.jobs || {});
    const locationCounts=new Map(managedLocations.map(name=>[name,0]));
    for(const asset of items){const name=asset.location||'Unassigned';locationCounts.set(name,(locationCounts.get(name)||0)+1);}
    const counts=[...locationCounts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
    const inRefurb = jobs.length ? jobs.filter(job => job.status !== 'Completed').length : items.filter(a => a.status !== 'Processed').length;
    const completed = jobs.length ? jobs.filter(job => job.status === 'Completed').length : items.filter(a => a.status === 'Processed').length;
    const parts = jobs.reduce((total,job)=>total+(job.parts||[]).filter(part=>part.status!=='Fitted').length,0);
    const total = items.length;
    const recent = [...items].sort((a,b)=>new Date(b.updatedAt || b.createdAt || 0)-new Date(a.updatedAt || a.createdAt || 0)).slice(0,6);
    let palette=['#1c73ea','#ff9d45','#7356dc','#27b684','#6783ab','#8b94a8'];
    let accum=0;
    const slices = counts.filter(x=>x.count>0).map((x,i)=>{const s=(accum/Math.max(1,total))*100;accum+=x.count;return `${palette[i%palette.length]} ${s}% ${(accum/Math.max(1,total))*100}%`});
    const statuses = [['Received',items.filter(a=>a.status!=='Processed').length,'#2576e9'],['In refurbishment',inRefurb,'#ffa54d'],['Completed',completed,'#29b782'],['Parts needed',parts,'#8762d9']];
    const highest = Math.max(1,...statuses.map(s=>s[1]));
    dashboardView.innerHTML = `<div class="v34-stat-grid">
      ${[['Total Devices',total,'▣','v34-blue'],['In Refurbishment',inRefurb,'⚒','v34-orange'],['Completed',completed,'✓','v34-green'],['Parts Needed',parts,'△','v34-amber']].map(([name,count,icon,cls])=>`<div class="v34-stat"><span class="v34-stat-icon ${cls}">${icon}</span><span><small>${name}</small><b>${count}</b></span></div>`).join('')}
    </div><div class="v34-overview-grid"><section class="v34-panel"><h3>Devices by Location</h3><div class="v34-donut-wrap"><div class="v34-donut" style="background:conic-gradient(${slices.join(',')||'#e9edf4 0% 100%'})"><span><strong>${total}</strong><small>Total</small></span></div><div class="v34-location-legend">${counts.slice(0,6).map((entry,index)=>`<button class="v34-legend-row" data-v34-location="${escapeText(entry.name)}"><i style="background:${palette[index%palette.length]}"></i><span>${escapeText(entry.name)}</span><b>${entry.count}</b></button>`).join('')||'<span>No locations yet</span>'}</div></div></section><section class="v34-panel"><h3>Refurbishment Status</h3><div class="v34-progress-group">${statuses.map(([name,count,color])=>`<div class="v34-progress-row"><span>${name}</span><div><i style="width:${Math.round(count/highest*100)}%;background:${color}"></i></div><b>${count}</b></div>`).join('')}</div></section></div>
    <section class="v34-panel v34-recent"><div class="v34-panel-title"><h3>Recent Devices</h3><button id="v34ViewAll" type="button">View all →</button></div><div class="v34-recent-scroller"><table><thead><tr><th>Asset ID</th><th>Device</th><th>Status</th><th>Location</th></tr></thead><tbody>${recent.map(a=>`<tr><td><button data-v34-open="${escapeText(a.id)}">${escapeText(a.id)}</button></td><td>${escapeText(label(a))}</td><td>${a.status==='Processed'?'<span class="v34-state v34-done">Processed</span>':'<span class="v34-state v34-wait">Awaiting Processing</span>'}</td><td>${escapeText(a.location||'—')}</td></tr>`).join('')||'<tr><td colspan="4">No assets registered yet.</td></tr>'}</tbody></table></div></section>`;
    dashboardView.querySelector('#v34ViewAll')?.addEventListener('click',()=>setPage('inventory'));
    dashboardView.querySelectorAll('[data-v34-open]').forEach(button=>button.addEventListener('click',()=>openAsset(button.dataset.v34Open)));
    dashboardView.querySelectorAll('[data-v34-location]').forEach(button=>button.addEventListener('click',()=>{
      if(setPage('inventory')) { byId('locationFilter').value=button.dataset.v34Location; render(); }
    }));
  }
  const reportLinks = document.createElement('div');
  reportLinks.id='v34ReportLinks';
  reportLinks.className='v34-report-shortcuts';
  byId('v3ReportsWorkspace')?.before(reportLinks);
  function paintReportLinks() {
    if (!reportLinks || currentPage!=='reports') return;
    reportLinks.innerHTML = `<div class="v34-report-list-heading"><h3>Reports & exports</h3><p>Print A4 worksheets, export refurbishment parts, or print asset labels.</p></div><div class="v34-report-list">
      <button data-v34-report="worksheet"><span class="v34-report-icon">▤</span><span><strong>Refurbishment Report</strong><small>A4 worksheet with required repairs and notes</small></span><b>→</b></button>
      <button data-v34-report="refurb-parts"><span class="v34-report-icon">▥</span><span><strong>Parts Needed Export</strong><small>Excel: one row per part, with asset ID, model and serial</small></span><b>→</b></button>
      <button data-v34-report="inventory"><span class="v34-report-icon">▣</span><span><strong>Inventory Report</strong><small>Export all laptops and locations</small></span><b>→</b></button>
      <button data-v34-go="locations"><span class="v34-report-icon">⌖</span><span><strong>Location Overview</strong><small>View all warehouse locations and stock counts</small></span><b>→</b></button>
      <button data-v34-go="inventory"><span class="v34-report-icon">▦</span><span><strong>Print Device Label</strong><small>Select a laptop and print its barcode or QR</small></span><b>→</b></button>
    </div>`;
    reportLinks.querySelectorAll('[data-v34-report]').forEach(button=>button.onclick=()=>{
      const target=byId('v3ReportsWorkspace')?.querySelector(`[data-report-tab="${button.dataset.v34Report}"]`);
      target?.click();
      byId('v3ReportsWorkspace')?.scrollIntoView({block:'nearest',behavior:'smooth'});
    });
    reportLinks.querySelectorAll('[data-v34-go]').forEach(button=>button.onclick=()=>setPage(button.dataset.v34Go));
  }
  function showRelevantControls() {
    const page = currentPage;
    actionSlot.classList.toggle('v34-actions-visible',page==='asset' || page==='inventory' || page==='refurbJobs'||page==='parts'||page==='locations');
    document.querySelector('.app-shell')?.setAttribute('data-active-workspace',page);
    const title=byId('v3Workspace');
    if(title&&page==='asset')title.textContent='Device Details';
    if(title&&page==='locations')title.textContent='Locations';
    if(title&&page==='reports')title.textContent='Reports';
    if(title&&page==='dashboard')title.textContent='Dashboard';
  }
  const baseRender = render;
  render = function(...args) {
    const result = baseRender(...args);
    renderDashboard();
    showRelevantControls();
    paintReportLinks();
    return result;
  };
  const originalPage = setPage;
  setPage=function(...args){
    const ok=originalPage(...args);
    if(ok){showRelevantControls();paintReportLinks();}
    return ok;
  };
  window.addEventListener('apex:workflow-updated',()=>renderDashboard());
  showRelevantControls();
  renderDashboard();
})();
