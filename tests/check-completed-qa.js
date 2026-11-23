'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
app.whenReady().then(async()=>{
 let win,folder;
 try{
  const base=path.resolve(__dirname,'../src/renderer');
  folder=fs.mkdtempSync(path.join(os.tmpdir(),'apex-completed-qa-'));
  const markup=fs.readFileSync(path.join(base,'index.html'),'utf8').replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'');
  fs.writeFileSync(path.join(folder,'index.html'),markup);
  win=new BrowserWindow({show:false,width:1450,height:900,webPreferences:{contextIsolation:false,nodeIntegration:false,backgroundThrottling:false}});
  await win.loadFile(path.join(folder,'index.html'));
  await win.webContents.executeJavaScript(`
    var currentPage='inventory',items=[{id:'ACTIVE-1',manufacturer:'HP',model:'EliteBook',serial:'ACTIVE-SERIAL',location:'Unassigned',pallet:'P-1'}];
    var lastManifest='',moveRequests=[],updateRequests=[],notifyMessages=[];
    function html(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
    function setPage(page){currentPage=page;document.getElementById('completedQAPage').classList.toggle('hidden',page!=='completedQA');return true;}
    function notify(message){notifyMessages.push(message);}
    async function refresh(){return true;}
    var api={workflow:async()=>({ok:true,workflow:{jobs:{'ARCH-1':{assetId:'ARCH-1',status:'Completed',parts:[{name:'Battery',qty:1,fitted:1},{name:'Respray lid',qty:1,fitted:1}],qc:{'Visual inspection':true,'Required parts fitted':true,'Hardware retest':true,'Final clean & sign-off':true}}},orders:[],resprayPallets:[]}}),
      movePallets:async input=>{moveRequests.push(input);return {ok:true};},
      update:async(id,fields)=>{updateRequests.push({id,fields});return {ok:true};},
      createPalletLocation:async()=>({ok:true})};
    window.ApexPalletLocationData={names:['Completed QA'],available:true};
    window.ApexCompletedQAArchive={assets:[{id:'ARCH-1',manufacturer:'Dell',model:'Latitude 5420',serial:'SERIAL-1',pallet:'QA-7',location:'Completed QA'}],pallets:[{name:'QA-7',storageLocation:'Completed QA'}]};
    window.ApexReportPreview={capture:(markup)=>{lastManifest=markup}};
    window.ApexPalletLocations={move:()=>{}};
    void 0;
  `);
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(base,'completed-qa-core.js'),'utf8'));
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(base,'completed-qa-ui.js'),'utf8'));
  await win.webContents.executeJavaScript("setPage('completedQA');void 0");
  const result=await win.webContents.executeJavaScript(`(async()=>{
    await new Promise(r=>setTimeout(r,100));
    const root=document.getElementById('completedQAContent');
    const before={hasAsset:root.textContent.includes('ARCH-1'),hasModel:root.textContent.includes('Latitude 5420'),hasPallet:root.textContent.includes('QA-7'),hasLocation:root.querySelector('.qa-table')?.textContent.includes('Completed QA'),hasRepair:root.textContent.includes('Repair completed'),hasRespray:root.textContent.includes('Respray completed')};
    document.getElementById('qaPrint').click();
    before.manifest=lastManifest.includes('ARCH-1')&&lastManifest.includes('SERIAL-1')&&lastManifest.includes('Repair completed')&&lastManifest.includes('Completed QA');
    before.simpleScan=!root.querySelector('select[name="pallet"]')&&root.textContent.includes('Move to Completed QA');
    const form=document.getElementById('qaAssignForm');
    form.querySelector('input[name="asset"]').value='ACTIVE-1';
    window.confirm=()=>true;
    await form.onsubmit({preventDefault(){},currentTarget:form});
    before.moveSavesOnlyLocation=updateRequests.length===1&&updateRequests[0].id==='ACTIVE-1'&&
      updateRequests[0].fields.location==='Completed QA'&&!Object.hasOwn(updateRequests[0].fields,'pallet');
    return before;
  })()`);
  if(Object.values(result).some(v=>v!==true))throw Error('QA Electron render/manifest failed '+JSON.stringify(result));
  console.log('PASS Completed QA Electron archive and manifest '+JSON.stringify(result));
  win.destroy();app.exit(0);
 }catch(e){console.error(e.stack||e);if(win&&!win.isDestroyed())win.destroy();app.exit(1)}
 finally{if(folder)try{fs.rmSync(folder,{recursive:true,force:true})}catch{}}
});
