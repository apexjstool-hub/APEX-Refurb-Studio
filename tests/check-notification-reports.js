'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
app.whenReady().then(async()=>{
 let win;try{
  win=new BrowserWindow({show:false,width:380,height:156,useContentSize:true,webPreferences:{preload:path.resolve('src/notification-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  await win.loadFile(path.resolve('src/renderer/inventory-notification.html'),{query:{count:'3',ids:'APX-001 · APX-002 · APX-003'}});
  const result=await win.webContents.executeJavaScript("(()=>{const image=document.querySelector('img'),box=document.querySelector('.notification');return {logo:image.complete&&image.naturalWidth>0,text:document.getElementById('arrivalBody').textContent,width:box.scrollWidth,height:box.scrollHeight,viewWidth:innerWidth,viewHeight:innerHeight,open:typeof document.getElementById('arrivalOpen').onclick==='function',dismiss:typeof document.getElementById('arrivalClose').onclick==='function'};})()");
  if(!result.logo||result.text!=='3 new items added to your inventory.'||result.width>result.viewWidth||result.height>result.viewHeight||!result.open||!result.dismiss)throw Error('Desktop notification layout failed: '+JSON.stringify(result));
  win.showInactive();await new Promise(r=>setTimeout(r,250));fs.mkdirSync(path.resolve('qa-print'),{recursive:true});fs.writeFileSync(path.resolve('qa-print/desktop-intake-notification.png'),(await win.webContents.capturePage()).toPNG());
  console.log('PASS: branded desktop notification displays the actual batch count, logo and controls without clipping.');win.destroy();app.exit(0);
 }catch(error){console.error(error);if(win&&!win.isDestroyed())win.destroy();app.exit(1);}
});
