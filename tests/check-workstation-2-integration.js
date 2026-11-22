'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{pathToFileURL}=require('node:url');
app.whenReady().then(async()=>{
 let win,folder;
 try{
  const base=path.resolve(__dirname,'../src/renderer');
  folder=fs.mkdtempSync(path.join(os.tmpdir(),'apex-workstation-2-'));
  const markup=fs.readFileSync(path.join(base,'index.html'),'utf8').replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'').replace(/href="([^"]+\.css)"/g,(_,p)=>'href="'+pathToFileURL(path.join(base,p)).href+'"');
  fs.writeFileSync(path.join(folder,'index.html'),markup);
  win=new BrowserWindow({show:false,width:1400,height:960,webPreferences:{contextIsolation:false,nodeIntegration:false,backgroundThrottling:false}});
  win.webContents.on('console-message',(_event,details)=>console.log('Renderer:',typeof details==='object'?details.message:details));
  await win.loadFile(path.join(folder,'index.html'));
  await win.webContents.executeJavaScript(`var items=[{id:'TEST-1',model:'HP 250 G8',manufacturer:'HP',serial:'TEST-1',status:'Awaiting Processing',condition:'Good',processor:'i5',ram:'8GB',storage:'256GB',diagnosticTests:{battery:{status:'fail',comment:'Requires replacement'},display:{status:'pass'}}}];
   var managedPallets=[],currentPage='workstation';
   function html(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
   function deviceName(a){return a.model};function render(){};
   function setPage(p){currentPage=p;return true};
   function openAsset(){};
   var api={workflow:async()=>({ok:true,workflow:{jobs:{'TEST-1':{assetId:'TEST-1',status:'Repair In Progress',parts:[{id:'p1',name:'Battery',qty:1,received:1,fitted:1}],qc:{}}},orders:[]}}),workflowAction:async()=>{throw Error('No writes expected')},update:async()=>{throw Error('No writes expected')}};
   async function refresh(){return true};
   window.ApexOps={openJob(){},receivePart(){},fitPart(){},quality(){},printWorksheet(){},load:async()=>{}};
   document.querySelector('#workstationPage').classList.remove('hidden');
   void 0;`);
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(base,'workstation-2-engine.js'),'utf8'));
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(base,'smart-workstation.js'),'utf8'));
  await win.webContents.executeJavaScript("window.ApexWorkstation.load('TEST-1')");
  const before=await win.webContents.executeJavaScript(`(()=>({
    name:document.getElementById('wsDeviceName').textContent,
    action:document.getElementById('ws2NextTitle').textContent,
    status:document.getElementById('ws2DiagnosticStatus').textContent,
    parts:document.getElementById('ws2RepairCount').textContent,
    qc:document.getElementById('ws2QCCount').textContent,
    diagnostics:document.getElementById('ws2DiagnosticList').textContent,
    ready:document.getElementById('ws2Readiness').textContent,
    otherPage:document.getElementById('inventoryPage').querySelector('#ws2NextButton')===null
  }))()`);
  if(before.name!=='HP 250 G8'||before.action!=='Review failed diagnostics and retest'||!before.status.includes('FAILED')||!before.diagnostics.includes('Requires replacement')||before.parts!=='0 outstanding'||!before.otherPage)throw Error('Live workstation guidance failed '+JSON.stringify(before));
  console.log('PASS integrated scan + real diagnostic failure + read-only QC '+JSON.stringify(before));
  win.destroy();app.exit(0);
 }catch(e){console.error(e.stack||e);if(win&&!win.isDestroyed())win.destroy();app.exit(1)}
 finally{if(folder)try{fs.rmSync(folder,{recursive:true,force:true})}catch{}}
});
