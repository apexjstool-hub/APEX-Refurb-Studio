'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
app.whenReady().then(async()=>{
 let win;const folder=fs.mkdtempSync(path.join(os.tmpdir(),'apex-device-parts-'));
 try{
  const renderer=path.resolve(__dirname,'../src/renderer');
  const index=fs.readFileSync(path.join(renderer,'index.html'),'utf8');
  const links=[...index.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)].map(m=>'<link rel="stylesheet" href="'+pathToFileURL(path.join(renderer,m[1])).href+'">').join('');
  const panel=index.slice(index.indexOf('<section id="apexAssetRepairsSection"'),index.indexOf('<button id="assetTopSave"'));
  fs.writeFileSync(path.join(folder,'index.html'),'<!doctype html><html class="apex-v34" data-theme="light"><head><meta charset="utf-8">'+links+'</head><body><main id="assetPage" data-section="parts" style="display:block;padding:16px;max-width:none">'+panel+'</main></body></html>');
  win=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  await win.loadFile(path.join(folder,'index.html'));
  const source=fs.readFileSync(path.join(renderer,'refurb-ui.js'),'utf8');
  const setup="var $=id=>document.getElementById(id),activeAssetId='DEVICE-1',ops={jobs:{},orders:[]};var checks=['Visual inspection','Required parts fitted','Hardware retest','Final clean & sign-off'];var calls=[];function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]))};function empty(s){return '<p>'+esc(s)+'</p>'};";
  await win.webContents.executeJavaScript(setup+source.slice(source.indexOf('const pill='),source.indexOf('// Manual board moves'))+source.slice(source.indexOf('function partOrderControl('),source.indexOf('async function markPartOrdered('))+source.slice(source.indexOf('const btn='),source.indexOf('const empty='))+source.slice(source.indexOf('function repairViewControl('),source.indexOf('function duplicateButton('))+source.slice(source.indexOf('function bindActions('),source.indexOf('function jobModal('))+";function markPartOrdered(id){calls.push(['ordered',id])};function fitModal(id){calls.push(['fit',id])};function jobModal(id){calls.push(['job',id])};function partModal(id){calls.push(['part',id])};function qcModal(id){calls.push(['qc',id])};function bulkReceiveModal(id){calls.push(['receive',id])};function action(c){calls.push(c)};window.confirm=()=>true;void 0;");
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,'delete-controls.js'),'utf8'));
  const job={assetId:'DEVICE-1',status:'Awaiting Parts',technician:'Alex',qc:{'Visual inspection':true},parts:[
   {id:'lcd',name:'LCD Panel',qty:1,received:0,fitted:0},
   {id:'spray',name:'Respray',qty:1,received:0,fitted:0},
   {id:'keyboard',name:'UK keyboard',qty:2,received:1,fitted:0},
   {id:'battery',name:'Battery',qty:1,received:1,fitted:1},
   {id:'long',name:'Replacement palmrest / full upper chassis with UK keyboard and trackpad assembly',notes:'Compatibility notes <must stay literal>',qty:1,received:0,fitted:0}
  ]};
  await win.webContents.executeJavaScript('ops.jobs[activeAssetId]='+JSON.stringify(job)+";ops.orders=[{status:'Ordered',lines:[{assetId:activeAssetId,partId:'spray',qty:1,received:0}]}];renderAsset();bindActions(document);void 0;");
  const check=await win.webContents.executeJavaScript("({rows:document.querySelectorAll('.device-repair-row').length,badges:[...document.querySelectorAll('.device-repair-badge')].map(x=>x.textContent),qc:document.querySelector('.device-repair-qc progress').value,bins:document.querySelectorAll('[data-op=removePart] svg').length,notes:document.querySelector('.device-repair-name small').textContent})");
  if(check.rows!==5||check.badges.join('|')!=='Needs ordering|Ordered|Part received|Fitted|Needs ordering'||check.qc!==1||check.bins!==2||check.notes!=='Compatibility notes <must stay literal>')throw Error('Part state, quantities, escaping or shared bin icon failed: '+JSON.stringify(check));
  for(const [op,id] of [['markPartOrdered','DEVICE-1|lcd'],['fit','DEVICE-1|keyboard'],['job','DEVICE-1'],['part','DEVICE-1'],['quality','DEVICE-1'],['receiveAll','DEVICE-1'],['removePart','DEVICE-1|long']]){
   await win.webContents.executeJavaScript('document.querySelector('+JSON.stringify('[data-op="'+op+'"][data-id="'+id+'"]')+').click();void 0;');
  }
  if(!await win.webContents.executeJavaScript("calls.length===7&&calls[0][1]==='DEVICE-1|lcd'&&calls[1][1]==='DEVICE-1|keyboard'&&calls[6].type==='removePart'&&calls[6].partId==='long'"))throw Error('Existing action routing changed.');
  // Exercise the new display with the actual browser classifier, then switch back without writes.
  await win.webContents.executeJavaScript(fs.readFileSync(path.resolve(renderer,'../repair-work-type.js'),'utf8'));
  await win.webContents.executeJavaScript("localStorage.removeItem('apexRepairView');ops.jobs[activeAssetId].parts.push({id:'bundle',name:'Respray + UK Keyboard',qty:1,received:0,fitted:0});window.beforeViewSwitch=JSON.stringify(ops);renderAsset();bindActions(document);void 0;");
  const split=await win.webContents.executeJavaScript("({parts:document.querySelectorAll('[data-repair-group=replacement] .device-repair-row').length,cosmetic:document.querySelectorAll('[data-repair-group=cosmetic] .device-repair-row').length,bundles:document.querySelectorAll('.device-repair-bundle').length,noFitted:![...document.querySelectorAll('[data-repair-group=cosmetic] button')].some(b=>b.textContent==='Mark fitted'),partsOnly:document.querySelector('[data-op=receiveAll]').dataset.replacementsOnly})");
  if(split.parts!==4||split.cosmetic!==2||split.bundles!==1||!split.noFitted||split.partsOnly!=='1')throw Error('Separated repair groups or bundle reference failed: '+JSON.stringify(split));
  await win.webContents.executeJavaScript("document.querySelector('[data-op=repairView]').click();void 0;");
  if(!await win.webContents.executeJavaScript("!document.querySelector('[data-repair-group]')&&document.querySelectorAll('.device-repair-row').length===6&&JSON.stringify(ops)===beforeViewSwitch"))throw Error('Combined view changed work data or failed to restore the original list.');
  await win.webContents.executeJavaScript("document.querySelector('[data-op=repairView]').click();void 0;");
  if(!await win.webContents.executeJavaScript("document.querySelectorAll('[data-repair-group]').length===2&&JSON.stringify(ops)===beforeViewSwitch"))throw Error('Returning to separate sections changed records.');
  // Use the real send/return/check forms and verify their command payloads.
  await win.webContents.executeJavaScript("document.body.insertAdjacentHTML('beforeend','<div id=modalContent></div>');var modalTitle='';function showModal(title,eye,content){modalTitle=title;$('modalContent').innerHTML=content};function closeModal(){$('modalContent').innerHTML=''};action=async c=>{calls.push(c);return true};function notify(){};var api={workflowAction:async c=>{calls.push(c);return {ok:true,workflow:ops}}};void 0;"+source.slice(source.indexOf('function receivePartModal('),source.indexOf('function duplicateModal('))+source.slice(source.indexOf('function fitModal('),source.indexOf('function newOrderModal('))+';void 0;');
  await win.webContents.executeJavaScript("cosmeticSendModal('DEVICE-1|bundle');$('opsCosmeticSend').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));void 0;");
  await new Promise(r=>setTimeout(r,20));
  if(!await win.webContents.executeJavaScript("calls.at(-1).type==='markPartOrdered'&&calls.at(-1).partId==='bundle'&&calls.at(-1).expectedOnOrder===0"))throw Error('Cosmetic dispatch form changed legacy command semantics.');
  await win.webContents.executeJavaScript("receivePartModal('DEVICE-1|spray');$('opsDirectReceive').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));void 0;");
  await new Promise(r=>setTimeout(r,20));
  if(!await win.webContents.executeJavaScript("calls.at(-1).type==='receivePart'&&calls.at(-1).cosmeticEvent==='return'&&calls.at(-1).qty===1"))throw Error('Respray return form did not send the guarded return command.');
  await win.webContents.executeJavaScript("ops.jobs[activeAssetId].parts.find(p=>p.id==='spray').received=1;ops.orders[0].lines[0].received=1;fitModal('DEVICE-1|spray');$('opsFitForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));void 0;");
  await new Promise(r=>setTimeout(r,20));
  if(!await win.webContents.executeJavaScript("calls.at(-1).type==='fitPart'&&calls.at(-1).cosmeticEvent==='check'&&calls.at(-1).expectedFitted===0&&calls.at(-1).expectedReceived===1"))throw Error('Returned finish check lacked stale-state protection.');
  await win.webContents.executeJavaScript("closeModal();renderAsset();bindActions(document);void 0;");
  fs.mkdirSync(path.resolve('qa-print'),{recursive:true});
  for(const theme of ['light','dark'])for(const width of [420,760,1100,1440]){
   win.setContentSize(width,1600);
   await win.webContents.executeJavaScript('document.documentElement.dataset.theme='+JSON.stringify(theme)+';void 0;');
   await new Promise(r=>setTimeout(r,100));
   const result=await win.webContents.executeJavaScript("(()=>{const panel=$('apexAssetRepairsSection').getBoundingClientRect();const bad=[...document.querySelectorAll('#assetJobProgress button,.device-repair-name,.device-repair-state,.device-repair-quantities')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.left<panel.left-1||r.right>panel.right+1||e.scrollWidth>e.clientWidth+2)});return {overflow:document.documentElement.scrollWidth>innerWidth+2,bottom:document.querySelector('.device-repair-qc').getBoundingClientRect().bottom>panel.bottom-10,padding:[...document.querySelectorAll('.device-repair-row')].some(e=>parseFloat(getComputedStyle(e).paddingLeft)<20||parseFloat(getComputedStyle(e).paddingTop)<18),bad:bad.map(e=>e.className)}})()");
   if(result.overflow||result.bottom||result.padding||result.bad.length)throw Error('Parts layout overflow '+theme+' '+width+': '+JSON.stringify(result));
   if(width===1100){const capture=await win.webContents.capturePage();fs.writeFileSync(path.resolve('qa-print/device-parts-'+theme+'.png'),capture.toPNG());}
  }
  await win.webContents.executeJavaScript("ops.jobs[activeAssetId].parts=[];renderAsset();void 0;");
  if(!await win.webContents.executeJavaScript("document.querySelectorAll('.device-repair-empty').length===2&&!document.querySelector('.device-repair-row')"))throw Error('Empty parts state failed.');
  console.log('Device repair details: states, escaping, bin icons, existing actions, separated/combined views, bundle references, send/return/check forms, empty groups and light/dark layouts passed.');
  win.destroy();fs.rmSync(folder,{recursive:true,force:true});app.exit(0);
 }catch(error){console.error(error);if(win&&!win.isDestroyed())win.destroy();fs.rmSync(folder,{recursive:true,force:true});app.exit(1);}
});

