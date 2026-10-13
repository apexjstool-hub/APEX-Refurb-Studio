'use strict';
const {app,BrowserWindow}=require('electron'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
app.whenReady().then(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'apex-inventory-print-'));let win;
 try{
  const style=fs.readFileSync(path.join(__dirname,'../src/renderer/apex-studio-bundle-v10.css'),'utf8');
  const rows=Array.from({length:80},(_,i)=>'<tr><td>ASSET-'+i+'</td><td>Lenovo ThinkPad T495</td><td>SERIAL-'+i+'</td><td>Warehouse</td><td>Grade B</td><td>Awaiting Processing</td></tr>').join('');
  const file=path.join(folder,'report.html');
  fs.writeFileSync(file,'<!doctype html><html><head><meta charset="utf-8"><style>'+style+'</style></head><body><main id="appShell">Application should not print</main><div id="printPane"><h1>APEX Inventory Register</h1><table><thead><tr><th>Asset ID</th><th>Device</th><th>Serial</th><th>Location</th><th>Condition</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table></div></body></html>');
  win=new BrowserWindow({show:false,width:1100,height:800,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  await win.loadFile(file);win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{media:'print'});
  const result=await win.webContents.executeJavaScript(`(()=>{const pane=document.getElementById('printPane');return {display:getComputedStyle(pane).display,height:pane.getBoundingClientRect().height,rows:pane.querySelectorAll('tbody tr').length,app:getComputedStyle(document.getElementById('appShell')).display,bodyOverflow:getComputedStyle(document.body).overflow};})()`);
  if(result.display==='none'||result.height<100||result.rows!==80||result.app!=='none'||result.bodyOverflow!=='visible')throw Error('Inventory print hidden/clipped: '+JSON.stringify(result));
  const pdf=await win.webContents.printToPDF({pageSize:'A4',printBackground:true,displayHeaderFooter:false,margins:{top:0,bottom:0,left:0,right:0}});
  const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
  if(pages<2)throw Error('Inventory rows did not paginate: '+pages);
  console.log('PASS: 80 inventory rows remain visible in print media and paginate across '+pages+' PDF pages.');
  win.destroy();fs.rmSync(folder,{recursive:true,force:true});app.exit(0);
 }catch(error){console.error(error);if(win&&!win.isDestroyed())win.destroy();fs.rmSync(folder,{recursive:true,force:true});app.exit(1);}
});
