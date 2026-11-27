'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'apex-action-smoke-'));app.setPath('userData',dir);app.disableHardwareAcceleration();
const renderer=path.join(__dirname,'../src/renderer'),fixture=path.join(renderer,'.action-centre-smoke.html');let win;
const timer=setTimeout(()=>finish(1,Error('Action Centre smoke timed out')),45000);
function finish(code,error){clearTimeout(timer);if(error)console.error(error);if(win&&!win.isDestroyed())win.destroy();try{fs.rmSync(fixture,{force:true});}catch{}app.exit(code);}
app.whenReady().then(async()=>{
 const markup=fs.readFileSync(path.join(renderer,'index-evolution.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 fs.writeFileSync(fixture,markup);win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 await win.loadFile(fixture);
 const run=s=>win.webContents.executeJavaScript(s);
 await run(`document.getElementById('loginPage').classList.add('hidden');document.getElementById('appPage').classList.remove('hidden');document.getElementById('dashboardPage').classList.add('hidden');document.getElementById('actionCentrePage').classList.remove('hidden');document.documentElement.dataset.theme='light';document.documentElement.dataset.apexPage='actionCentre';
 let currentPage='actionCentre',syncMode='local',cloudRefreshFailed=false,opened='',routed='',items=[{id:'DEMO-1',model:'Latitude',manufacturer:'Dell',serial:'S1',productType:'Laptop',processor:'i5',ram:'8 GB',storage:'256 GB',location:'Shelf 1',status:'Awaiting Processing'},{id:'DEMO-2',model:'ThinkPad',manufacturer:'Lenovo',serial:'S2',productType:'Laptop',processor:'i5',ram:'8 GB',storage:'256 GB',location:'Shelf 2',status:'Awaiting Processing'}];
 const html=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 let render=()=>{},openAsset=id=>{opened=id;},setPage=p=>{routed=p;},refresh=async()=>{},notify=()=>{};
 const old=new Date(Date.now()-20*86400000).toISOString();
 const fixtureWorkflow={jobs:{'DEMO-1':{assetId:'DEMO-1',status:'Awaiting Parts',createdAt:old,updatedAt:old,parts:[{id:'p1',name:'LCD',qty:1,received:0,fitted:0,createdAt:old}]},'DEMO-2':{assetId:'DEMO-2',status:'Quality Control',parts:[]}},orders:[],resprayPallets:[]};
 window.apexInventory={workflow:async()=>({ok:true,workflow:fixtureWorkflow})};`);
 for(const p of ['../inventory-workflow.js','../action-centre.js','notification-session.js','action-centre.js'])await run(fs.readFileSync(path.join(renderer,p),'utf8'));
 const result=await run(`(async()=>{const $=id=>document.getElementById(id);window.ApexNotificationSession.start();await new Promise(r=>setTimeout(r,30));const urgent=$('actionCentreBadge').textContent,visible=!$('actionCentreBadge').hidden,initial=$('acRows').textContent;
 $('acSearch').value='DEMO-2';$('acSearch').dispatchEvent(new Event('input'));const filtered=$('acRows').textContent;
 $('acRows').querySelector('[data-ac-asset]').click();const direct=opened;
 $('acSearch').value='';$('acSearch').dispatchEvent(new Event('input'));$('acCategory').value='order';$('acCategory').dispatchEvent(new Event('change'));$('acRoute').click();const route=routed;
 $('acThreshold-ordering').value=30;$('acSaveThresholds').click();const saved=JSON.parse(localStorage.getItem('apex.action-centre.thresholds.v1')).ordering;
 window.ApexNotificationSession.stop();return {urgent,visible,initial,filtered,direct,route,saved,cleared:$('acRows').textContent==='',badgeHidden:$('actionCentreBadge').hidden};})()`);
 assert.equal(result.urgent,'1');assert.equal(result.visible,true);assert.match(result.initial,/DEMO-1/);assert.match(result.initial,/DEMO-2/);assert.match(result.filtered,/DEMO-2/);assert.doesNotMatch(result.filtered,/DEMO-1/);assert.equal(result.direct,'DEMO-2');assert.equal(result.route,'parts');assert.equal(result.saved,30);assert.equal(result.cleared,true);assert.equal(result.badgeHidden,true);console.log('Action Centre smoke passed');finish(0);
}).catch(e=>finish(1,e));
