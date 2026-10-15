'use strict';
const {app,BrowserWindow,ipcMain}=require('electron'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),{pathToFileURL}=require('node:url');const wf=require('../src/refurb-workflow'),core=require('../src/inventory-core'),pallets=require('../src/pallet-management');
app.whenReady().then(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'apex-tracker-'));let win;
 try{
  const renderer=path.resolve(__dirname,'../src/renderer');let html=fs.readFileSync(path.join(renderer,'index.html'),'utf8').replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'').replace(/href="([^"]+\.css)"/g,(_,p)=>'href="'+pathToFileURL(path.join(renderer,p)).href+'"');
  const assets=[core.normalize({id:'TEST-TRACKER',model:'HP ZBook Studio 16 inch G10 Mobile Workstation PC',manufacturer:'HP',serial:'TEST-SERIAL',location:'Unassigned',pallet:'PALLET-0001',status:'Awaiting Processing'})];let state=wf.init({jobs:{'TEST-TRACKER':{assetId:'TEST-TRACKER',status:'Awaiting Parts',priority:'Normal',partsBoard:'ordered',parts:[{id:'p',name:'Battery',qty:1,received:0,fitted:0,sourceKey:'test|battery'}],qc:{}}},orders:[],audit:[]});
  const db={items:assets,locations:['Unassigned','Inspection'],pallets:[{name:'PALLET-0001',label:'Batch'}]};
  ipcMain.handle('test:deletePallet',(_e,c)=>pallets.deletePallet(db,c));
  ipcMain.handle('test:deletePalletLocation',(_e,c)=>pallets.deletePalletLocation(db,c));
  ipcMain.handle('test:createPalletLocation',(_e,c)=>pallets.createPalletLocation(db,c));ipcMain.handle('test:movePallets',(_e,c)=>pallets.movePallets(db,c));
  ipcMain.handle('test:pallet',(_e,c)=>pallets.createPallet(db,c));ipcMain.handle('test:move',(_e,c)=>pallets.moveBatch(db,c));ipcMain.handle('test:assets',()=>({items:db.items,pallets:pallets.listPallets(db),palletLocations:pallets.palletLocations(db)}));
  ipcMain.handle('test:workflow',()=>({ok:true,workflow:state}));ipcMain.handle('test:action',(_e,c)=>{const r=wf.apply(structuredClone(state),assets,c,'Test operator');if(r.ok)state=r.workflow;return r;});
  fs.writeFileSync(path.join(folder,'preload.js'),"const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('testTracker',{workflow:()=>ipcRenderer.invoke('test:workflow'),workflowAction:c=>ipcRenderer.invoke('test:action',c),deletePallet:c=>ipcRenderer.invoke('test:deletePallet',c),deletePalletLocation:c=>ipcRenderer.invoke('test:deletePalletLocation',c),createPalletLocation:c=>ipcRenderer.invoke('test:createPalletLocation',c),movePallets:c=>ipcRenderer.invoke('test:movePallets',c),createPallet:c=>ipcRenderer.invoke('test:pallet',c),bulkMove:c=>ipcRenderer.invoke('test:move',c),testAssets:()=>ipcRenderer.invoke('test:assets')});");fs.writeFileSync(path.join(folder,'index.html'),html);
  win=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{preload:path.join(folder,'preload.js'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});await win.loadFile(path.join(folder,'index.html'));
  await win.webContents.executeJavaScript("var api=window.testTracker;var $=id=>document.getElementById(id);var PAGE_NAMES={},PAGE_SUBS={},items="+JSON.stringify(assets)+",managedLocations=['Unassigned','Inspection'],managedPallets=[{name:'PALLET-0001',label:'Batch'}],syncMode='local',currentPage='inventory',activeAssetId=null,inventoryPageIndex=0,dirty=false;function html(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))};function shortDate(s){return s};var toastTimer;function notify(){};function inventoryLookupFeedback(){};function setPage(p){currentPage=p;render();return true};function openAsset(){};async function refresh(){const d=await api.testAssets();items=d.items;managedPallets=d.pallets;window.ApexPalletLocationData={names:d.palletLocations||[],available:true};render()};function showModal(t,e,c){$('modalClose').classList.remove('hidden');$('modalTitle').textContent=t;$('modalEyebrow').textContent=e;$('modalContent').innerHTML=c;$('modalLayer').classList.remove('hidden')};function closeModal(){$('modalLayer').classList.add('hidden');$('modalContent').innerHTML=''};function renderSupplementalPages(){};function deviceName(a){return a.model||a.id};function grade(g){return g};function state(s){return s};function updateAssetOverview(){};document.documentElement.dataset.theme='light';document.body.classList.add('apex-v34');$('loginPage').classList.add('hidden');$('appPage').classList.remove('hidden');$('inventoryPage').classList.remove('hidden');$('dashboardPage').classList.add('hidden');");
  for(const name of ['inventory-core','pallet-management','part-requirements','inventory-workflow','refurb-export'])await win.webContents.executeJavaScript(fs.readFileSync(path.resolve(__dirname,'../src/'+name+'.js'),'utf8'));
  const source=fs.readFileSync(path.join(renderer,'app.js'),'utf8');await win.webContents.executeJavaScript(source.slice(source.indexOf('function notify('),source.indexOf('const PAGE_NAMES')));await win.webContents.executeJavaScript(source.slice(source.indexOf('function inventoryLookupFeedback('),source.indexOf('async function toggleCamera'))+';void 0;');await win.webContents.executeJavaScript('function stopCamera(){};var lookupOpened=null;openAsset=id=>{lookupOpened=id};resolveScan("MISSING-ASSET");void 0;');if(!await win.webContents.executeJavaScript("lookupOpened===null&&$('toast').textContent==='Inventory not found'&&getComputedStyle($('toast')).position==='fixed'"))throw Error('Missing inventory scan opened a new asset or lacked the toast.');await win.webContents.executeJavaScript('resolveScan("TEST-TRACKER");void 0;');if(!await win.webContents.executeJavaScript("lookupOpened==='TEST-TRACKER'&&$('toast').textContent==='Inventory found'"))throw Error('Existing scan lacked the success toast.');await win.webContents.executeJavaScript(source.slice(source.indexOf('function rows('),source.indexOf('function summarizeLocations')));await win.webContents.executeJavaScript(source.slice(source.indexOf('function summarizeLocations()'),source.indexOf('function confirmDeleteLocation(')));
  for(const name of ['delete-controls.js','inventory-management-ui.js'])await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,name),'utf8'));
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,'refurb-ui.js'),'utf8'));await win.webContents.executeJavaScript('window.ApexOps.load()');await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,'v34-reference-ui.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,'inventory-workflow-ui.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,'dashboard-visuals.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,'asset-label-barcode.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.resolve(renderer,'../report-brand.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.resolve(renderer,'../assignment-documents.js'),'utf8'));await win.webContents.executeJavaScript('api={...api,list:async()=>({ok:true,items,locations:managedLocations,pallets:managedPallets})};void 0;');await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,'assignment-print-ui.js'),'utf8'));await win.webContents.executeJavaScript('window.ApexPreviewBase='+JSON.stringify(pathToFileURL(renderer+path.sep).href)+';void 0;');await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,'selection-previews.js'),'utf8'));await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,'inventory-selection.js'),'utf8'));await win.webContents.executeJavaScript('render();');

  const addJob=(id,status,parts,extra={})=>{assets.push(core.normalize({id,manufacturer:'Dell',model:'Latitude 5420',serial:'SERIAL-'+id,location:'Inspection',pallet:'',status:'Awaiting Processing'}));state.jobs[id]={assetId:id,status,parts,qc:{},updatedAt:'2026-10-15T10:00:00Z',...extra};};
  addJob('RW-DELIVERY','Awaiting Parts',[{id:'delivery',name:'Keyboard',qty:2,received:0,fitted:0}]);
  addJob('RW-FIT','Ready for Repair',[{id:'fit',name:'LCD',qty:2,received:2,fitted:1}],{technician:'Alex'});
  addJob('RW-SPRAY','Repair In Progress',[{id:'spray',name:'Lid respray',qty:1,received:1,fitted:0}]);
  addJob('RW-QC','Quality Control',[{id:'qc',name:'Battery',qty:1,received:1,fitted:1}]);
  addJob('RW-DONE','Completed',[{id:'done',name:'Keyboard',qty:1,received:1,fitted:1}]);
  addJob('RW-HOLD','On Hold',[{id:'hold',name:'LCD',qty:1,received:0,fitted:0}]);
  state.orders.push({id:'PO-DELIVERY',supplier:'Test supplier',lines:[{assetId:'RW-DELIVERY',partId:'delivery',name:'Keyboard',qty:2,received:0}]});
  await win.webContents.executeJavaScript("refresh();");
  await win.webContents.executeJavaScript(fs.readFileSync(path.resolve(renderer,'../device-summary.js'),'utf8'));
  for(const name of ['PAGE_NAMES','PAGE_SUBS']){
   const literal=source.slice(source.indexOf('const '+name+'=')+('const '+name+'=').length).split(';')[0];
   await win.webContents.executeJavaScript('Object.assign('+name+','+literal+');void 0;');
  }
  await win.webContents.executeJavaScript(source.slice(source.indexOf('function setPage('),source.indexOf('function rows('))+';void 0;');
  await win.webContents.executeJavaScript("openAsset=id=>{activeAssetId=id;setPage('asset');};void 0;");
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,'v3-ui.js'),'utf8'));
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,'refurb-workspace.js'),'utf8'));
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,'pallet-locations.js'),'utf8'));
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,'container-inventory.js'),'utf8'));
  await win.webContents.executeJavaScript("$('refurbNav').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='refurbWorkspace'&&!$('refurbWorkspacePage').classList.contains('hidden')&&$('refurbNav').classList.contains('active')&&!$('refurbNavLinks')&&!$('refurbNavToggle')&&$('v3Workspace').textContent==='Refurbishment'"))throw Error('Refurbishment sidebar routing or grouping failed.');
  if(!await win.webContents.executeJavaScript("$('rwQueueTable').querySelectorAll('[data-rw-expand]').length===6&&!$('rwQueueTable').textContent.includes('RW-DONE')"))throw Error('Active queue did not include all active jobs or included completed jobs.');
  for(const [key,id] of [['delivery','RW-DELIVERY'],['fit','RW-FIT'],['respray','RW-SPRAY'],['qc','RW-QC'],['hold','RW-HOLD']]){
   await win.webContents.executeJavaScript("$('rwFilters').querySelector('[data-rw-filter="+key+"]').click();void 0;");
   if(!await win.webContents.executeJavaScript("$('rwQueueTable').textContent.includes("+JSON.stringify(id)+")"))throw Error('Queue filter failed: '+key);
  }
  await win.webContents.executeJavaScript("$('rwFilters').querySelector('[data-rw-filter=all]').click();$('rwSearch').value='Alex';$('rwSearch').dispatchEvent(new Event('input'));void 0;");
  if(!await win.webContents.executeJavaScript("$('rwQueueTable').querySelectorAll('[data-rw-expand]').length===1&&$('rwQueueTable').textContent.includes('RW-FIT')"))throw Error('Technician search failed.');
  await win.webContents.executeJavaScript("$('rwSearch').value='TEST-TRACKER';$('rwSearch').dispatchEvent(new Event('input'));$('rwQueueTable').querySelector('[data-rw-expand]').click();$('rwQueueTable').querySelector('[data-rw-select]').click();$('rwOrderSelected').click();void 0;");
  if(!await win.webContents.executeJavaScript("$('opsOrderForm').querySelectorAll('input[type=checkbox]:checked').length===1&&$('opsOrderForm').textContent.includes('TEST-TRACKER')&&!$('opsOrderForm').textContent.includes('RW-HOLD')"))throw Error('Selected queue ordering affected other devices.');
  await win.webContents.executeJavaScript("$('opsCancel').click();$('rwReceiveSelected').click();void 0;");
  if(!await win.webContents.executeJavaScript("$('opsBulkReceiveForm').querySelectorAll('tbody tr').length===1&&$('opsBulkReceiveForm').textContent.includes('TEST-TRACKER')"))throw Error('Selected receipt scope was not preserved.');
  await win.webContents.executeJavaScript("$('opsCancel').click();$('rwQueueTable').querySelector('[data-rw-action=device]').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='asset'&&!$('rwReturnToQueue').hidden"))throw Error('Device details lack Return to Refurbishment.');
  await win.webContents.executeJavaScript("dirty=true;window.confirm=()=>false;$('rwReturnToQueue').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='asset'&&dirty"))throw Error('New workspace bypassed unsaved device changes.');
  await win.webContents.executeJavaScript("dirty=false;$('rwReturnToQueue').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='refurbWorkspace'&&$('rwSearch').value==='TEST-TRACKER'&&$('rwSelected').textContent==='1 selected'&&$('rwQueueTable').querySelector('[data-rw-expand]').getAttribute('aria-expanded')==='true'"))throw Error('Returning lost queue search, selection or expanded device.');
  await win.webContents.executeJavaScript("$('rwQueueTable').querySelector('[data-rw-action=receiveAll]').click();$('opsBulkReceiveForm').dispatchEvent(new Event('submit',{cancelable:true}));void 0;");
  for(let i=0;i<30;i++){if(state.jobs['TEST-TRACKER'].parts[0].received===1)break;await new Promise(r=>setTimeout(r,100));}
  if(state.jobs['TEST-TRACKER'].parts[0].received!==1||!await win.webContents.executeJavaScript("$('rwQueueTable').textContent.includes('Ready to fit')&&currentPage==='refurbWorkspace'"))throw Error('Work queue receipt failed to persist and refresh in place.');
  await win.webContents.executeJavaScript("window.ApexRefurbWorkspace.open('purchasing');void 0;");
  for(const name of ['parts','partsOrdered','orders','deliveries']){
   await win.webContents.executeJavaScript("$('rwPurchasingTabs').querySelector('[data-rw-purchase="+name+"]').click();void 0;");
   if(!await win.webContents.executeJavaScript("$("+JSON.stringify(name+'Content')+").parentElement.id==='rwExistingPanel'&&document.querySelectorAll('#"+name+"Content').length===1"))throw Error('Purchasing panel was duplicated or not mounted: '+name);
  }
  // Purchasing presentation keeps the same live controls, with summary and selection on separate rows.
  await win.webContents.executeJavaScript("$('rwPurchasingTabs').querySelector('[data-rw-purchase=parts]').click();void 0;");
  fs.mkdirSync(path.resolve('qa-print'),{recursive:true});
  for(const width of [1440,1100,760]){
   win.setSize(width,1000);await new Promise(r=>setTimeout(r,200));
   const partsLayout=await win.webContents.executeJavaScript("(()=>{const root=$('partsContent'),heading=root.querySelector('.ops-parts-heading').getBoundingClientRect(),bulk=root.querySelector('.ops-part-export-actions').getBoundingClientRect(),move=$('opsMoveSelectedParts'),exportButton=$('opsExportRefurbPartsSelected'),buttons=[move,exportButton,$('opsExportRefurbPartsAll')];return {separated:heading.bottom<=bulk.top+1,controls:buttons.every(b=>b.getBoundingClientRect().width>0),contained:root.scrollWidth<=root.clientWidth+2,unique:buttons.every(b=>document.querySelectorAll('#'+b.id).length===1)};})()");
   if(!partsLayout.separated||!partsLayout.controls||!partsLayout.contained||!partsLayout.unique)throw Error('Purchasing layout regression at '+width+': '+JSON.stringify(partsLayout));
   fs.writeFileSync(path.resolve('qa-print/parts-required-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  win.setSize(1440,1000);
  await win.webContents.executeJavaScript("document.documentElement.dataset.theme='dark';void 0;");await new Promise(r=>setTimeout(r,150));
  fs.writeFileSync(path.resolve('qa-print/parts-required-dark.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("document.documentElement.dataset.theme='light';void 0;");
  await win.webContents.executeJavaScript("setPage('orders');void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='refurbWorkspace'&&$('ordersContent').parentElement.id==='rwExistingPanel'"))throw Error('Existing purchase flow navigated out of the new workspace.');
  for(const name of ['qc','completed']){
   await win.webContents.executeJavaScript("window.ApexRefurbWorkspace.open("+JSON.stringify(name)+");void 0;");
   if(!await win.webContents.executeJavaScript("$("+JSON.stringify(name+'Content')+").parentElement.id==='rwExistingPanel'&&$('rwExistingPanel').textContent.includes("+JSON.stringify(name==='qc'?'RW-QC':'RW-DONE')+")"))throw Error('QC/completed route failed: '+name);
  }
  await win.webContents.executeJavaScript("setPage('inventory');void 0;");
  if(!await win.webContents.executeJavaScript("['parts','partsOrdered','orders','deliveries','qc','completed'].every(id=>$(id+'Content').parentElement.id===id+'Page')&&!!$('inventoryTable').querySelector('[data-tracker-toggle]')&&JSON.stringify([...$('v3Tabs').querySelectorAll('[data-v3tab]')].map(b=>b.dataset.v3tab))===JSON.stringify(['inventory','locations','pallets','palletLocations'])"))throw Error('Inventory must retain its repair details and All devices, Locations, Pallets and Pallet locations tabs.');
  for(const name of ['locations','pallets','inventory']){
   await win.webContents.executeJavaScript("$('v3Tabs').querySelector('[data-v3tab="+name+"]').click();void 0;");
   if(!await win.webContents.executeJavaScript("currentPage==="+JSON.stringify(name)))throw Error('Inventory navigation failed: '+name);
  }
  for(const [target,content] of [['parts','partsContent'],['partsOrdered','partsOrderedContent'],['completed','completedContent']]){
   await win.webContents.executeJavaScript("setPage('inventory');setPage("+JSON.stringify(target)+");void 0;");
   if(!await win.webContents.executeJavaScript("currentPage==='refurbWorkspace'&&$("+JSON.stringify(content)+").parentElement.id==='rwExistingPanel'&&$('refurbNav').classList.contains('active')"))throw Error('Existing refurbishment shortcut did not route to the new workspace: '+target);
  }
  await win.webContents.executeJavaScript("window.ApexRefurbWorkspace.open('queue');$('rwSearch').value='';$('rwSearch').dispatchEvent(new Event('input'));void 0;");
  const membersBeforeStorage=JSON.stringify(db.items.map(a=>[a.id,a.location,a.pallet]));
  await win.webContents.executeJavaScript("setPage('palletLocations');void 0;");
  if(!await win.webContents.executeJavaScript("!!$('v3Tabs').querySelector('[data-v3tab=palletLocations].selected')&&!!$('plAddLocation')&&!$('plCreateForm')"))throw Error('Pallet locations tab not routed.');
  await win.webContents.executeJavaScript("$('plAddLocation').click();$('managementLocationName').value='Cancelled location';$('managementLocationCancel').click();void 0;");
  if((db.palletLocations||[]).includes('Cancelled location')||await win.webContents.executeJavaScript("!!$('managementLocationForm')"))throw Error('Cancelling pallet-location creation changed records.');
  for(const name of ['Rack A','Rack B','Delete me']){
   await win.webContents.executeJavaScript("$('plAddLocation').click();$('managementLocationName').value="+JSON.stringify(name)+";$('managementLocationForm').dispatchEvent(new Event('submit',{cancelable:true}));void 0;");
   for(let i=0;i<30;i++){if((db.palletLocations||[]).includes(name)&&await win.webContents.executeJavaScript("!!document.querySelector('[data-pl-view=\""+name+"\"]')"))break;await new Promise(r=>setTimeout(r,100));}
   if(!(db.palletLocations||[]).includes(name))throw Error('Pallet location creation did not persist.');
  }
  await win.webContents.executeJavaScript("(()=>{const button=document.createElement('button');button.id='testDeleteRetry';button.textContent='Delete test item';button.onclick=()=>window.testDeleteClickCount=(window.testDeleteClickCount||0)+1;$('modalContent').appendChild(button);window.ApexDeleteControls.decorate(button);button.textContent='Delete test item';})()" );
  await new Promise(r=>setTimeout(r,50));
  if(!await win.webContents.executeJavaScript("(()=>{const button=$('testDeleteRetry');const ok=!!button.querySelector('svg')&&!!button.getAttribute('aria-label');button.click();button.remove();return ok&&window.testDeleteClickCount===1;})()"))throw Error('Delete icon was lost after a retry label change or its handler was replaced.');
  if(!await win.webContents.executeJavaScript("[...document.querySelectorAll('[data-pl-delete]')].every(b=>b.classList.contains('apex-delete-button')&&!!b.querySelector('svg')&&b.getAttribute('aria-label')&&!b.textContent.trim())"))throw Error('Pallet location bins are inconsistent or unlabelled.');
  await win.webContents.executeJavaScript("window.confirm=()=>{throw Error('Native delete prompt used')};document.querySelector('[data-pl-delete=\"Delete me\"]').click();void 0;");
  if(!await win.webContents.executeJavaScript("$('modalTitle').textContent==='Delete pallet location?'&&$('managementDeleteForm').textContent.includes('Delete me')&&document.activeElement.id==='managementDeleteCancel'&&!!$('managementDeleteConfirm').querySelector('svg')"))throw Error('Location delete did not open its themed confirmation.');
  win.show();await new Promise(r=>setTimeout(r,250));fs.writeFileSync(path.resolve('qa-print/delete-pallet-location.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("$('managementDeleteCancel').click();void 0;");
  if(!db.palletLocations.includes('Delete me')||await win.webContents.executeJavaScript("!!$('managementDeleteForm')"))throw Error('Cancelled location deletion removed it or left dialog open.');
  await win.webContents.executeJavaScript("document.querySelector('[data-pl-delete=\"Delete me\"]').click();$('managementDeleteForm').dispatchEvent(new Event('submit',{cancelable:true}));void 0;");
  for(let i=0;i<30;i++){if(!db.palletLocations.includes('Delete me')&&await win.webContents.executeJavaScript("!document.querySelector('[data-pl-view=\"Delete me\"]')"))break;await new Promise(r=>setTimeout(r,100));}
  if(db.palletLocations.includes('Delete me'))throw Error('Empty pallet location deletion did not persist.');
  await win.webContents.executeJavaScript("$('plMove').click();$('plMoveForm').elements.location.value='Rack A';$('plMoveForm').querySelector('[name=pallet]').click();$('plMoveForm').dispatchEvent(new Event('submit',{cancelable:true}));void 0;");
  for(let i=0;i<30;i++){if(db.pallets[0].storageLocation==='Rack A'&&await win.webContents.executeJavaScript("!$('plMoveForm')"))break;await new Promise(r=>setTimeout(r,100));}
  if(!await win.webContents.executeJavaScript("document.querySelector('[data-pl-delete=\"Rack A\"]').disabled"))throw Error('Occupied pallet location deletion is enabled.');
  if(db.pallets[0].storageLocation!=='Rack A'||JSON.stringify(db.items.map(a=>[a.id,a.location,a.pallet]))!==membersBeforeStorage)throw Error('Pallet move failed or altered its devices.');
  await win.webContents.executeJavaScript("setPage('pallets');void 0;");
  if(!await win.webContents.executeJavaScript("$('apexPalletTable').textContent.includes('PALLET-0001')&&$('apexPalletTable').textContent.includes('Rack A')"))throw Error('Assigned pallet disappeared from Pallets register.');
  await win.webContents.executeJavaScript("$('apexPalletTable').querySelector('[data-pallet-location]').click();$('plMoveForm').elements.location.value='Rack B';$('plMoveForm').dispatchEvent(new Event('submit',{cancelable:true}));void 0;");
  for(let i=0;i<30;i++){if(db.pallets[0].storageLocation==='Rack B'&&await win.webContents.executeJavaScript("!$('plMoveForm')"))break;await new Promise(r=>setTimeout(r,100));}
  await win.webContents.executeJavaScript("setPage('palletLocations');refresh();void 0;");
  for(let i=0;i<30;i++){if(await win.webContents.executeJavaScript("document.querySelector('[data-pl-view=\"Rack B\"]')?.closest('tr').querySelector('.pl-count').textContent==='1'"))break;await new Promise(r=>setTimeout(r,100));}
  if(!await win.webContents.executeJavaScript("document.querySelector('[data-pl-view=\"Rack A\"]').closest('tr').querySelector('.pl-count').textContent==='0'&&document.querySelector('[data-pl-view=\"Rack B\"]').closest('tr').querySelector('.pl-count').textContent==='1'"))throw Error('Pallet counts did not follow the move after refresh.');
  win.show();await new Promise(r=>setTimeout(r,400));
  if(!await win.webContents.executeJavaScript("currentPage==='palletLocations'&&!$('palletLocationsPage').classList.contains('hidden')&&$('palletLocationsPage').getBoundingClientRect().height>200"))throw Error('Pallet locations page is not visible.');
  fs.writeFileSync(path.resolve('qa-print/pallet-locations.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("$('plAddLocation').click();void 0;");await new Promise(r=>setTimeout(r,250));fs.writeFileSync(path.resolve('qa-print/create-pallet-location.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("$('managementLocationCancel').click();setPage('pallets');void 0;");await new Promise(r=>setTimeout(r,250));fs.writeFileSync(path.resolve('qa-print/pallet-toolbar.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("setPage('locations');void 0;");await new Promise(r=>setTimeout(r,250));fs.writeFileSync(path.resolve('qa-print/location-toolbar.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("$('apexAddLocation').click();void 0;");await new Promise(r=>setTimeout(r,250));fs.writeFileSync(path.resolve('qa-print/create-location.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("$('managementLocationCancel').click();setPage('palletLocations');void 0;");
  for(const [width,theme,zoom] of [[1440,'light',1],[760,'light',1],[1440,'dark',1],[1440,'light',1.25]]){
   win.setSize(width,1000);win.webContents.setZoomFactor(zoom);
   for(const page of ['pallets','palletLocations']){
    await win.webContents.executeJavaScript("document.documentElement.dataset.theme="+JSON.stringify(theme)+";setPage("+JSON.stringify(page)+");void 0;");await new Promise(r=>setTimeout(r,250));
    const alignment=await win.webContents.executeJavaScript("(()=>{const root=$(currentPage==='pallets'?'palletsPage':'palletLocationsPage'),groups=[...root.querySelectorAll('.storage-row-actions')];return {count:groups.length,contained:root.scrollWidth<=root.clientWidth+2,aligned:groups.every(group=>{const rects=[...group.querySelectorAll('button')].map(b=>b.getBoundingClientRect());return rects.every(r=>Math.abs(r.top+r.height/2-(rects[0].top+rects[0].height/2))<1)&&rects.slice(1).every((r,i)=>Math.abs(r.left-rects[i].right-8)<1);})};})()");
    if(!alignment.count||!alignment.contained||!alignment.aligned)throw Error('Storage action alignment failed: '+JSON.stringify({page,width,theme,zoom,...alignment}));
    fs.writeFileSync(path.resolve('qa-print/storage-actions-'+page+'-'+width+'-'+theme+'-'+zoom+'.png'),(await win.webContents.capturePage()).toPNG());
   }
  }
  win.webContents.setZoomFactor(1);win.setSize(1440,1000);await win.webContents.executeJavaScript("document.documentElement.dataset.theme='light';setPage('palletLocations');void 0;");
  if(!await win.webContents.executeJavaScript("(()=>{const buttons=[...document.querySelectorAll('[data-pl-delete],[data-pallet-delete],[data-delete-location]')];return buttons.length>2&&buttons.every(b=>b.querySelector('svg path')?.getAttribute('d')===buttons[0].querySelector('svg path')?.getAttribute('d')&&getComputedStyle(b).width==='32px'&&getComputedStyle(b).height==='32px');})()"))throw Error('Delete icons or button dimensions differ between storage pages.');


  await win.webContents.executeJavaScript("$('plMove').click();$('plCancel').click();void 0;");
  if(db.pallets[0].storageLocation!=='Rack B')throw Error('Cancelling changed pallet location.');
  // Location → pallets → inventory, with a neighbouring location and an empty pallet.
  db.pallets.push({name:'PALLET-0002',label:'Different location',storageLocation:'Rack A'},{name:'PALLET-0003',label:'Empty pallet',storageLocation:'Rack B'});
  db.items.push(core.normalize({id:'OUTSIDE-PALLET',model:'Other laptop',serial:'OUTSIDE-SERIAL',pallet:'PALLET-0002',location:'Unassigned',status:'Awaiting Processing'}));
  await win.webContents.executeJavaScript("refresh();void 0;");
  for(let i=0;i<30;i++){if(await win.webContents.executeJavaScript("managedPallets.length===3"))break;await new Promise(r=>setTimeout(r,100));}
  await win.webContents.executeJavaScript("document.querySelector('[data-pl-view=\"Rack B\"]').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='palletLocationDetail'&&!$('palletLocationDetailPage').classList.contains('hidden')&&$('palletLocationsPage').classList.contains('hidden')&&$('v3Tabs').querySelector('[data-v3tab=palletLocations]').classList.contains('selected')"))throw Error('View pallets did not open its dedicated page.');
  if(!await win.webContents.executeJavaScript("(()=>{const p=$('palletLocationDetailContent'),cards=[...p.querySelectorAll('.pl-pallet-row')];return p.querySelectorAll('table thead th').length===6&&cards.length===2&&cards.some(c=>c.textContent.includes('PALLET-0001')&&c.querySelector('.pl-pallet-count strong').textContent==='1')&&cards.some(c=>c.textContent.includes('PALLET-0003')&&c.querySelector('.pl-pallet-count strong').textContent==='0')&&!p.textContent.includes('PALLET-0002')&&p.querySelectorAll('.pl-location-summary strong')[1].textContent==='1';})()"))throw Error('Location pallet scope or inventory counts are incorrect.');
  await new Promise(r=>setTimeout(r,250));fs.writeFileSync(path.resolve('qa-print/pallet-location-detail.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("$('locationFilter').value='Inspection';$('gradeFilter').value='D';$('repairFilter').value='hold';$('inventorySearch').value='no match';$('palletLocationDetailContent').querySelector('[data-pl-inventory=PALLET-0001]').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='containerInventory'&&$('inventoryPage').classList.contains('hidden')&&$('inventorySearch').value==='no match'&&$('locationFilter').value==='Inspection'&&$('gradeFilter').value==='D'&&$('repairFilter').value==='hold'&&$('v3Tabs').querySelector('[data-v3tab=palletLocations].selected')&&JSON.stringify([...$('containerInventoryContent').querySelectorAll('[data-ci-asset]')].map(a=>a.dataset.ciAsset).filter((id,i,all)=>all.indexOf(id)===i))===JSON.stringify(['TEST-TRACKER'])"))throw Error('Pallet inventory escaped its contents page, showed other pallets or changed All devices filters.');
  await new Promise(r=>setTimeout(r,250));fs.writeFileSync(path.resolve('qa-print/pallet-contents.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("$('ciSearch').value='nothing matches';$('ciSearch').dispatchEvent(new Event('input'));void 0;");
  if(!await win.webContents.executeJavaScript("!!$('containerInventoryContent').querySelector('.ci-empty')&&$('inventorySearch').value==='no match'"))throw Error('Contents search changed the All devices search.');
  await win.webContents.executeJavaScript("$('ciSearch').value='';$('ciSearch').dispatchEvent(new Event('input'));$('containerInventoryContent').querySelector('[data-ci-asset]').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='asset'&&activeAssetId==='TEST-TRACKER'&&!$('ciReturnFromAsset').hidden"))throw Error('Contents device view lacks a return path.');
  await win.webContents.executeJavaScript("dirty=true;window.confirm=()=>false;$('assetBack').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='asset'&&dirty"))throw Error('Contents return bypassed unsaved device changes.');
  await win.webContents.executeJavaScript("dirty=false;$('assetBack').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='containerInventory'&&$('containerInventoryContent').textContent.includes('PALLET-0001')"))throw Error('Device Back returned to All devices instead of its pallet.');
  await win.webContents.executeJavaScript("$('ciBack').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='palletLocationDetail'&&$('palletLocationDetailContent').textContent.includes('Rack B')"))throw Error('Contents Back lost the parent pallet location.');
  await win.webContents.executeJavaScript("setPage('pallets');$('apexPalletTable').querySelector('[data-pallet-show=PALLET-0002]').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='containerInventory'&&$('v3Tabs').querySelector('[data-v3tab=pallets].selected')&&$('containerInventoryContent').textContent.includes('OUTSIDE-PALLET')&&!$('containerInventoryContent').textContent.includes('TEST-TRACKER')"))throw Error('Pallets register did not open its own scoped contents page.');
  await win.webContents.executeJavaScript("$('ciBack').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='pallets'"))throw Error('Pallet contents Back did not return to Pallets.');
  await win.webContents.executeJavaScript("setPage('locations');$('locationsTable').querySelector('[data-jump-location=Inspection]').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='containerInventory'&&$('v3Tabs').querySelector('[data-v3tab=locations].selected')&&$('containerInventoryContent').textContent.includes('RW-DELIVERY')&&!$('containerInventoryContent').textContent.includes('OUTSIDE-PALLET')&&!$('containerInventoryContent').textContent.includes('TEST-TRACKER')"))throw Error('Locations did not show exactly the items stored inside the location.');
  await new Promise(r=>setTimeout(r,250));fs.writeFileSync(path.resolve('qa-print/location-contents.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("$('ciBack').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='locations'"))throw Error('Location contents Back did not return to Locations.');
  await win.webContents.executeJavaScript("setPage('pallets');$('apexPalletTable').querySelector('[data-pallet-show=PALLET-0003]').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='containerInventory'&&!!$('containerInventoryContent').querySelector('.ci-empty')&&!$('containerInventoryContent').querySelector('[data-ci-asset]')"))throw Error('Empty pallet exposed unrelated inventory.');
  await win.webContents.executeJavaScript("setPage('inventory');$('inventorySearch').value='';$('locationFilter').value='';$('gradeFilter').value='';$('repairFilter').value='';render();void 0;");

  await win.webContents.executeJavaScript("window.ApexPalletLocations.open('Rack B');$('palletLocationDetailContent').querySelector('[data-pl-move=PALLET-0003]').click();$('plMoveForm').elements.location.value='Rack A';$('plMoveForm').dispatchEvent(new Event('submit',{cancelable:true}));void 0;");
  for(let i=0;i<30;i++){if(await win.webContents.executeJavaScript("$('palletLocationDetailContent').querySelectorAll('.pl-pallet-row').length===1&&!$('plMoveForm')"))break;await new Promise(r=>setTimeout(r,100));}
  if(!await win.webContents.executeJavaScript("currentPage==='palletLocationDetail'&&$('palletLocationDetailContent').querySelectorAll('.pl-pallet-row').length===1&&!$('palletLocationDetailContent').textContent.includes('PALLET-0003')"))throw Error('Moving a pallet did not refresh its location page.');
  await win.webContents.executeJavaScript("$('plBackToLocations').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='palletLocations'&&!$('palletLocationsPage').classList.contains('hidden')"))throw Error('Back to Pallet locations failed.');
  await win.webContents.executeJavaScript("document.querySelector('[data-pl-view=\"\"]').click();void 0;");
  if(!await win.webContents.executeJavaScript("currentPage==='palletLocationDetail'&&!!$('palletLocationDetailContent').querySelector('.pl-location-empty')&&!$('palletLocationDetailContent').querySelector('.pl-pallet-row')"))throw Error('Empty unassigned pallet location did not show its empty state.');
  for(const [width,theme] of [[1440,'light'],[760,'light'],[1440,'dark']]){
   win.setSize(width,1000);await win.webContents.executeJavaScript("document.documentElement.dataset.theme="+JSON.stringify(theme)+";void 0;");await new Promise(r=>setTimeout(r,200));
   if(!await win.webContents.executeJavaScript("(()=>{const empty=document.querySelector('.pl-location-empty'),title=empty.querySelector('h2').getBoundingClientRect(),panel=empty.getBoundingClientRect();return Math.abs(title.left+title.width/2-panel.left-panel.width/2)<1&&!!empty.querySelector('[data-pl-detail-move]')&&!empty.closest('table')&&document.querySelector('.pl-location-summary').getBoundingClientRect().height<100;})()"))throw Error('Empty pallet location is not centred or compact.');
   fs.writeFileSync(path.resolve('qa-print/pallet-location-empty-'+width+'-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  win.setSize(1440,1000);await win.webContents.executeJavaScript("document.documentElement.dataset.theme='light';document.querySelector('.pl-location-empty [data-pl-detail-move]').click();void 0;");
  if(!await win.webContents.executeJavaScript("!!$('plMoveForm')&&$('plMoveForm').elements.location.value===''"))throw Error('Empty-location Move pallets here did not select its destination.');
  await win.webContents.executeJavaScript("$('plCancel').click();void 0;");

  await win.webContents.executeJavaScript("setPage('inventory');$('palletFilter').value='';render();void 0;");
  for(const target of ['parts','partsOrdered','orders','deliveries','qc','completed']){
   await win.webContents.executeJavaScript("setPage("+JSON.stringify(target)+");void 0;");
   if(!await win.webContents.executeJavaScript("!$('partsContent').querySelector('[data-op=boardOrdered]')&&!!$('opsMoveSelectedParts')"))throw Error('Per-device order moves remain, or bulk move was removed.');
   await new Promise(r=>setTimeout(r,250));
   fs.writeFileSync(path.resolve('qa-print/refurb-'+target+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  for(const [width,theme] of [[1440,'light'],[1100,'light'],[760,'light'],[1440,'dark']]){
   win.setSize(width,1000);await win.webContents.executeJavaScript("document.documentElement.dataset.theme="+JSON.stringify(theme)+";window.ApexPalletLocations.open('Rack A');void 0;");await new Promise(r=>setTimeout(r,250));
   const locationLayout=await win.webContents.executeJavaScript("(()=>{const root=$('palletLocationDetailPage');return {visible:root.getBoundingClientRect().height>100,contained:root.scrollWidth<=root.clientWidth+2,links:[...root.querySelectorAll('[data-pl-inventory]')].every(a=>a.getBoundingClientRect().width>50)};})()");
   if(!locationLayout.visible||!locationLayout.contained||!locationLayout.links)throw Error('Pallet location page layout regression: '+JSON.stringify(locationLayout));
   fs.writeFileSync(path.resolve('qa-print/pallet-location-'+width+'-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());
   await win.webContents.executeJavaScript("$('palletLocationDetailContent').querySelector('[data-pl-inventory=PALLET-0002]').click();void 0;");await new Promise(r=>setTimeout(r,200));
   if(!await win.webContents.executeJavaScript("currentPage==='containerInventory'&&$('containerInventoryContent').scrollWidth<=$('containerInventoryContent').clientWidth+2"))throw Error('Contained inventory layout overflows the page.');
   fs.writeFileSync(path.resolve('qa-print/contained-inventory-'+width+'-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());

  }
  win.setSize(1440,1000);await win.webContents.executeJavaScript("document.documentElement.dataset.theme='light';window.ApexRefurbWorkspace.open('queue');void 0;");await new Promise(r=>setTimeout(r,250));
  if(!await win.webContents.executeJavaScript("$('rwQueueSummary').children.length===3&&$('rwQueueSummary').textContent.includes('Active jobs')&&$('rwQueueTable').querySelectorAll('.rw-progress-track').length>0"))throw Error('Work queue overview or progress indicators missing.');
  const layout=await win.webContents.executeJavaScript("(()=>{const r=$('refurbWorkspacePage').getBoundingClientRect();return {width:r.width,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth+2,tableFits:$('rwQueueTable').querySelector('.rw-table-scroll').scrollWidth<=$('rwQueueTable').querySelector('.rw-table-scroll').clientWidth+2};})()");
  if(layout.width<700||layout.height<200||layout.overflow||!layout.tableFits)throw Error('New workspace layout failed: '+JSON.stringify(layout));
  const readability=await win.webContents.executeJavaScript("(()=>{const table=$('rwQueueTable').querySelector('.rw-work-table'),row=table.tBodies[0].rows[0],box=row.querySelector('[data-rw-select]'),cb=box.getBoundingClientRect(),style=getComputedStyle(box),name=row.querySelector('.rw-device-name'),action=row.querySelector('[data-rw-expand]'),range=document.createRange();range.selectNodeContents(action);const lines=[...range.getClientRects()];return {columns:table.tHead.rows[0].cells.length,checkbox:cb.width===16&&cb.height===16&&style.appearance==='auto'&&box.classList.contains('inventory-row-select'),nameWidth:name.getBoundingClientRect().width,nameWrap:getComputedStyle(name).overflowWrap,buttonLines:lines.length,buttonHeight:action.getBoundingClientRect().height,selectionBar:!$('rwSelectionBar').hidden,tabs:[...document.querySelectorAll('#refurbWorkspacePage [data-rw-view]')].every(b=>b.classList.contains('v3-tab'))};})()");
  if(readability.columns!==4||!readability.checkbox||readability.nameWidth<230||readability.nameWrap==='anywhere'||readability.buttonLines!==1||readability.buttonHeight<30||!readability.selectionBar||!readability.tabs)throw Error('Refurbishment readability or original controls failed: '+JSON.stringify(readability));
  await win.webContents.executeJavaScript("document.querySelectorAll('img[src]').forEach(img=>{const src=img.getAttribute('src');if(src&&!/^(data:|https?:|file:)/.test(src))img.src=new URL(src,window.ApexPreviewBase).href;});void 0;");
  win.show();await new Promise(r=>setTimeout(r,300));
  fs.mkdirSync(path.resolve('qa-print'),{recursive:true});fs.writeFileSync(path.resolve('qa-print/refurb-workspace.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("document.documentElement.dataset.theme='dark';void 0;");await new Promise(r=>setTimeout(r,150));
  fs.writeFileSync(path.resolve('qa-print/refurb-workspace-dark.png'),(await win.webContents.capturePage()).toPNG());
  db.pallets.push({name:'Delete test pallet',label:'Confirmation fixture'});
  const devicesBeforeDelete=JSON.stringify(db.items);
  await win.webContents.executeJavaScript("refresh();void 0;");
  for(let i=0;i<30;i++){if(await win.webContents.executeJavaScript("managedPallets.some(p=>p.name==='Delete test pallet')"))break;await new Promise(r=>setTimeout(r,50));}
  await win.webContents.executeJavaScript("document.documentElement.dataset.theme='light';dirty=false;setPage('pallets');window.confirm=()=>{throw Error('Native delete prompt used')};document.querySelector('[data-pallet-delete=\"Delete test pallet\"]').click();void 0;");
  if(!await win.webContents.executeJavaScript("$('modalTitle').textContent==='Delete pallet?'&&$('managementDeleteForm').textContent.includes('Delete test pallet')&&document.activeElement.id==='managementDeleteCancel'"))throw Error('Pallet delete did not use its themed named confirmation.');
  await new Promise(r=>setTimeout(r,200));fs.writeFileSync(path.resolve('qa-print/delete-pallet-light.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("document.documentElement.dataset.theme='dark';void 0;");await new Promise(r=>setTimeout(r,150));fs.writeFileSync(path.resolve('qa-print/delete-pallet-dark.png'),(await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript("$('managementDeleteCancel').click();void 0;");
  if(!db.pallets.some(p=>p.name==='Delete test pallet'))throw Error('Cancelling deleted a pallet.');
  await win.webContents.executeJavaScript("window.realDeletePallet=api.deletePallet;api={...api,deletePallet:async()=>({ok:false,error:'Pallet changed; refresh'})};document.querySelector('[data-pallet-delete=\"Delete test pallet\"]').click();$('managementDeleteForm').dispatchEvent(new Event('submit',{cancelable:true}));void 0;");
  await new Promise(r=>setTimeout(r,100));
  if(!await win.webContents.executeJavaScript("$('managementDeleteError').textContent==='Pallet changed; refresh'&&!$('managementDeleteConfirm').disabled&&!$('managementDeleteCancel').disabled&&!$('modalClose').classList.contains('hidden')"))throw Error('Delete server error did not remain in a retryable dialog.');
  await win.webContents.executeJavaScript("window.testDeleteCalls=0;api={...api,deletePallet:async c=>{window.testDeleteCalls++;await new Promise(r=>setTimeout(r,150));return window.realDeletePallet(c)}};$('managementDeleteForm').dispatchEvent(new Event('submit',{cancelable:true}));$('managementDeleteForm').dispatchEvent(new Event('submit',{cancelable:true}));void 0;");
  if(!await win.webContents.executeJavaScript("$('managementDeleteConfirm').disabled&&$('managementDeleteCancel').disabled&&$('modalClose').classList.contains('hidden')&&window.testDeleteCalls===1"))throw Error('Delete confirmation allowed a duplicate in-flight request.');
  for(let i=0;i<30;i++){if(!db.pallets.some(p=>p.name==='Delete test pallet')&&await win.webContents.executeJavaScript("!$('managementDeleteForm')"))break;await new Promise(r=>setTimeout(r,50));}
  if(db.pallets.some(p=>p.name==='Delete test pallet')||JSON.stringify(db.items)!==devicesBeforeDelete)throw Error('Confirmed pallet deletion failed or changed device records.');
  console.log('PASS: new Refurbishment workspace routes, filters, selection, writes and original Inventory views verified.');
  win.destroy();fs.rmSync(folder,{recursive:true,force:true});app.exit(0);
 }catch(e){console.error(e);if(win&&!win.isDestroyed())win.destroy();fs.rmSync(folder,{recursive:true,force:true});app.exit(1);}
});
