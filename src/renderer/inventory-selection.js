'use strict';
(function(){
 const selected={inventory:new Set(),location:new Set(),pallet:new Set()};
 const scopes={inventory:{page:'inventoryPage',table:'inventoryTable',label:'devices'},location:{page:'locationsPage',table:'locationsTable',label:'locations'},pallet:{page:'palletsPage',table:'apexPalletTable',label:'pallets'}};
 const bin='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
 function names(kind){return kind==='inventory'?items.map(a=>a.id):kind==='location'?summarizeLocations().map(l=>l.location):managedPallets.map(p=>p.name);}
 function devices(kind){const values=new Set([...selected[kind]].map(value=>String(value).trim().toUpperCase())),has=value=>values.has(String(value||'').trim().toUpperCase());return kind==='inventory'?items.filter(a=>has(a.id)):kind==='pallet'?items.filter(a=>has(a.pallet)):items.filter(a=>!a.pallet&&has(a.location));}
 function ids(kind){return devices(kind).map(a=>a.id);}
 function closeMenus(){document.querySelectorAll('.inventory-action-menu').forEach(m=>{if(m.matches(':popover-open'))m.hidePopover();m.hidden=true;});document.querySelectorAll('[data-selection-menu]').forEach(b=>b.setAttribute('aria-expanded','false'));}
 function update(kind){
  const host=$('selection-toolbar-'+kind);if(!host)return;
  const n=selected[kind].size;host.querySelector('.inventory-selection-count').textContent=n?n+' '+scopes[kind].label+' selected':'Select '+scopes[kind].label;
  host.querySelectorAll('[data-selection-menu]').forEach(b=>b.disabled=!n);
  const table=$(scopes[kind].table)?.querySelector('table');if(!table)return;
  const allBoxes=[...table.querySelectorAll('tbody input[data-select-row]')],boxes=allBoxes.filter(b=>!b.closest('tr').hidden);
  for(const input of allBoxes){input.checked=selected[kind].has(input.dataset.selectRow);input.closest('tr').classList.toggle('inventory-row-selected',input.checked);}
  const all=table.querySelector('[data-select-all]');if(all){all.checked=boxes.length>0&&boxes.every(b=>b.checked);all.indeterminate=boxes.some(b=>b.checked)&&!all.checked;}
 }
 function placeMenu(kind){
  const button=$('selection-toolbar-'+kind)?.querySelector('[data-selection-menu]'),menu=$('selection-actions-'+kind);if(!button||!menu||menu.hidden)return;
  const r=button.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.left,innerWidth-menu.offsetWidth-8))+'px';menu.style.right='auto';menu.style.top=(r.bottom-1)+'px';menu.style.maxHeight=Math.max(60,innerHeight-r.bottom-12)+'px';
 }
 function ensureToolbar(kind){
  if($('selection-toolbar-'+kind))return;
  const scope=scopes[kind],host=$(scope.table);if(!host)return;
  const bar=document.createElement('div');bar.id='selection-toolbar-'+kind;bar.className='inventory-selection-toolbar';
  const labels=kind==='inventory'?'<button type="button" data-selection-action="asset">Asset barcode</button><button type="button" data-selection-action="refurb">QR Refurb</button>':'<button type="button" data-selection-action="assignment">'+(kind==='pallet'?'Pallet':'Location')+' barcode</button>';
  bar.innerHTML='<button type="button" class="secondary inventory-selection-scan"><span aria-hidden="true">▦</span> Scan</button><div class="inventory-menu-wrap"><button type="button" class="secondary" data-selection-menu="actions" aria-expanded="false" aria-controls="selection-actions-'+kind+'" disabled>Actions <span aria-hidden="true">↓</span></button><div id="selection-actions-'+kind+'" class="inventory-action-menu" popover="manual" hidden><div data-menu-level="root"><button type="button" data-selection-group="labels">Labels <span aria-hidden="true">›</span></button><button type="button" data-selection-group="reports">Reports <span aria-hidden="true">›</span></button><button type="button" data-selection-action="clear">Clear selection</button></div><div data-menu-level="labels" hidden><button type="button" class="inventory-menu-back">‹ Labels</button>'+labels+'</div><div data-menu-level="reports" hidden><button type="button" class="inventory-menu-back">‹ Reports</button>'+(kind==='pallet'?'<button type="button" data-selection-action="manifest">A4 pallet manifest</button>':'')+'<button type="button" data-selection-action="inventory">Inventory report</button><button type="button" data-selection-action="worksheet">Refurbishment worksheets</button><button type="button" data-selection-action="diagnostics">Diagnostics reports</button><button type="button" data-selection-action="qc">Quality control reports</button><button type="button" data-selection-action="parts">Parts required report</button></div></div></div><div class="inventory-inline-search"></div><span class="inventory-selection-count">Select '+scope.label+'</span>';
  host.before(bar);
  const search=kind==='inventory'?$('inventorySearch'):document.createElement('input'),old=search.closest('.table-search');
  search.type='search';search.placeholder='Search...';search.setAttribute('aria-label','Search '+scope.label);if(kind!=='inventory'){search.id='selectionSearch-'+kind;search.oninput=()=>filter(kind);}
  bar.querySelector('.inventory-inline-search').appendChild(search);old?.remove();
  bar.querySelector('.inventory-selection-scan').onclick=()=>{closeMenus();setPage('bulk');};
  const menu=bar.querySelector('.inventory-action-menu'),button=bar.querySelector('[data-selection-menu]');
  const level=name=>{menu.querySelectorAll('[data-menu-level]').forEach(p=>p.hidden=p.dataset.menuLevel!==name);placeMenu(kind);};
  button.onclick=()=>{
   const open=menu.hidden;closeMenus();if(!open)return;const deviceIds=ids(kind);
   menu.querySelectorAll('[data-selection-action]').forEach(b=>{const action=b.dataset.selectionAction;b.disabled=['inventory','worksheet','diagnostics','qc','parts'].includes(action)&&!deviceIds.length;if(action==='qc'&&deviceIds.some(id=>!window.ApexWorkflowSnapshot?.jobs?.[id])){b.disabled=true;b.title='Each selected device needs a refurbishment job for a QC report.';}});
   menu.hidden=false;menu.showPopover();button.setAttribute('aria-expanded','true');level('root');
  };
  menu.querySelectorAll('[data-selection-group]').forEach(b=>b.onclick=()=>level(b.dataset.selectionGroup));menu.querySelectorAll('.inventory-menu-back').forEach(b=>b.onclick=()=>level('root'));
  menu.querySelectorAll('[data-selection-action]').forEach(b=>b.onclick=()=>action(kind,b.dataset.selectionAction));
 }
 function filter(kind){
  if(kind==='inventory')return;const query=$('selectionSearch-'+kind)?.value.trim().toLowerCase()||'',table=$(scopes[kind].table)?.querySelector('table');
  if(table)for(const row of table.tBodies[0].rows)row.hidden=!!query&&!row.textContent.toLowerCase().includes(query);update(kind);
 }
 function decorate(){
  for(const kind of Object.keys(scopes)){
   const allowed=new Set(names(kind));for(const value of selected[kind])if(!allowed.has(value))selected[kind].delete(value);
   ensureToolbar(kind);const table=$(scopes[kind].table)?.querySelector('table');if(!table){update(kind);continue;}
   if(!table.dataset.selection){
    table.dataset.selection='1';const head=document.createElement('th');head.className='inventory-selection-cell';head.innerHTML='<input type="checkbox" class="inventory-row-select" data-select-all aria-label="Select all '+scopes[kind].label+' on this page">';table.tHead.rows[0].prepend(head);
    for(const row of [...table.tBodies[0].rows]){
     const key=kind==='inventory'?row.querySelector('[data-asset]')?.dataset.asset:kind==='location'?row.querySelector('[data-jump-location]')?.dataset.jumpLocation:row.querySelector('[data-pallet-show]')?.dataset.palletShow;
     if(!key){if(row.classList.contains('inventory-repair-row'))row.cells[0].colSpan=table.tHead.rows[0].cells.length;continue;}
     const cell=document.createElement('td');cell.className='inventory-selection-cell';const box=document.createElement('input');box.type='checkbox';box.className='inventory-row-select';box.dataset.selectRow=key;box.setAttribute('aria-label','Select '+key);cell.appendChild(box);row.prepend(cell);box.onchange=()=>{if(box.checked)selected[kind].add(key);else selected[kind].delete(key);update(kind);};
    }
    head.querySelector('input').onchange=e=>{for(const input of [...table.querySelectorAll('tbody input[data-select-row]')].filter(b=>!b.closest('tr').hidden)){if(e.target.checked)selected[kind].add(input.dataset.selectRow);else selected[kind].delete(input.dataset.selectRow);}update(kind);};
   }
   table.querySelectorAll('[data-print-asset],[data-assignment-label]').forEach(b=>b.remove());
   table.querySelectorAll('[data-delete-asset],[data-delete-location],[data-pallet-delete]').forEach(b=>{b.classList.add('inventory-bin-delete');b.innerHTML=bin;const value=b.dataset.deleteAsset||b.dataset.deleteLocation||b.dataset.palletDelete;b.title='Delete '+value;b.setAttribute('aria-label','Delete '+value);});
   filter(kind);update(kind);
  }
 }
 function action(kind,name){
  closeMenus();if(name==='clear'){selected[kind].clear();update(kind);return;}
  const deviceIds=ids(kind);
  if(name==='asset'||name==='refurb'){labelDialog(kind,name);return;}
  if(name==='assignment'||name==='manifest'){labelDialog(kind,name==='manifest'?'manifest':'barcode');return;}
  if(!deviceIds.length){notify('No devices are assigned to the selected '+scopes[kind].label+'.');return;}
  if(currentPage==='asset'&&dirty){notify('Save your device changes before printing.');return;}
  window.ApexSelectionPreviews.capture(()=>{switch(name){case 'inventory':printInventory(deviceIds);break;case 'worksheet':window.ApexOps.printBatchWorksheets(deviceIds);break;case 'diagnostics':window.ApexOps.printDiagnosticsReports(deviceIds);break;case 'qc':window.ApexOps.printBatchQC(deviceIds);break;case 'parts':window.ApexOps.printRefurbPartsReport(deviceIds);break;}});
 }
 function labelDialog(kind,type){
  const values=[...selected[kind]];if(!values.length)return;if(values.length>300){notify('Select up to 300 rows for one print job.');return;}
  window.ApexSelectionPreviews.labels(kind,type,values,scopes[kind].label);
 }
 document.addEventListener('click',event=>{if(!event.target.closest('.inventory-menu-wrap'))closeMenus();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenus();});
 window.addEventListener('resize',()=>Object.keys(scopes).forEach(placeMenu));document.addEventListener('scroll',()=>Object.keys(scopes).forEach(placeMenu),true);
 const previous=render;render=function(...args){const result=previous(...args);decorate();return result;};
 const previousPage=setPage;setPage=function(...args){closeMenus();return previousPage(...args);};
 window.ApexInventorySelection={decorate,selected,ids};decorate();
})();
