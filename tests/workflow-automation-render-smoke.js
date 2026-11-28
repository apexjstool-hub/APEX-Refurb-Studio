'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'apex-automation-smoke-'));app.setPath('userData',dir);app.disableHardwareAcceleration();
const renderer=path.join(__dirname,'../src/renderer'),fixture=path.join(renderer,'.automation-smoke.html');let win;
const timer=setTimeout(()=>finish(1,Error('Automation smoke timed out')),45000);
function finish(code,error){clearTimeout(timer);if(error)console.error(error);if(win&&!win.isDestroyed())win.destroy();try{fs.rmSync(fixture,{force:true});}catch{}app.exit(code);}
app.whenReady().then(async()=>{
 const markup=fs.readFileSync(path.join(renderer,'index-evolution.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 fs.writeFileSync(fixture,markup);win=new BrowserWindow({show:false,width:1366,height:768,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 await win.loadFile(fixture);
 const run=s=>win.webContents.executeJavaScript(s);
 // Keep fixture state and renderer code in one evaluation; IPC receives only plain test results.
 const setup=`document.getElementById('loginPage').classList.add('hidden');document.getElementById('appPage').classList.remove('hidden');document.getElementById('dashboardPage').classList.add('hidden');document.getElementById('actionCentrePage').classList.remove('hidden');document.documentElement.dataset.theme='light';document.documentElement.dataset.apexPage='actionCentre';
 let currentPage='actionCentre',syncMode='local',cloudRefreshFailed=false,opened='',routed='',items=[{id:'DEMO-1',model:'Latitude',manufacturer:'Dell',serial:'S1',productType:'Laptop',processor:'i5',ram:'8 GB',storage:'256 GB',location:'Shelf 1',status:'Awaiting Processing'},{id:'DEMO-2',model:'ThinkPad',manufacturer:'Lenovo',serial:'S2',productType:'Laptop',processor:'i5',ram:'8 GB',storage:'256 GB',location:'Shelf 2',status:'Awaiting Processing'}];
 const html=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 let render=()=>{},openAsset=id=>{opened=id;},setPage=p=>{routed=p;},refresh=async()=>{},notify=()=>{};
 const old=new Date(Date.now()-20*86400000).toISOString();
 const fixtureWorkflow={jobs:{'DEMO-1':{assetId:'DEMO-1',status:'Awaiting Parts',createdAt:old,updatedAt:old,parts:[{id:'p1',name:'LCD',qty:1,received:0,fitted:0,createdAt:old}]},'DEMO-2':{assetId:'DEMO-2',status:'Quality Control',parts:[]}},orders:[],resprayPallets:[]};
 let config={enabled:false,rules:[]},notices=0;
 notify=()=>{notices++;};
 window.apexInventory={workflow:async()=>({ok:true,workflow:fixtureWorkflow}),automationRead:async()=>({ok:true,scope:'fixture',config}),automationSave:async input=>{config=input.config;return {ok:true,config};}};
 const api=window.apexInventory;window.apexEnsureSettingsUnlocked=async()=>true;`;
 const scripts=['../inventory-workflow.js','../action-centre.js','../workflow-automation.js','notification-session.js','workflow-automation.js','action-centre.js'].map(p=>fs.readFileSync(path.join(renderer,p),'utf8')).join('\n;\n');
 const checks=`const $=id=>document.getElementById(id);window.ApexNotificationSession.start();await new Promise(r=>setTimeout(r,60));
 currentPage='settings';$('waName').value='Escalate LCD';$('waTrigger').value='order';$('waCondition').value='any';$('waAction').value='notice';$('waRuleEnabled').checked=true;
 $('waTest').click();const dry=$('waTestResult').textContent;
 $('waForm').dispatchEvent(new Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,30));
 $('waEnabled').checked=true;$('waEnabled').dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,30));
 currentPage='actionCentre';render();const tagged=$('acRows').textContent,first=notices;render();const repeated=notices;
 currentPage='settings';const hist=$('waHistory').textContent;window.ApexNotificationSession.stop();
 return {dry,tagged,first,repeated,hist,enabled:config.enabled,rules:config.rules.length,cleared:!$('waHistory').textContent.includes('DEMO-1')};`;
 const result=await run('(async()=>{\n'+setup+'\n;\n'+scripts+'\n;\n'+checks+'\n})()');
 assert.match(result.dry,/1 matching actions/);assert.match(result.tagged,/Automation: Escalate LCD/);assert.equal(result.first,1);assert.equal(result.repeated,1);assert.match(result.hist,/DEMO-1/);assert.equal(result.enabled,true);assert.equal(result.rules,1);assert.equal(result.cleared,true);console.log('Workflow Automation smoke passed');finish(0);
}).catch(e=>finish(1,e));
