'use strict';
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url');
const summary=require('../src/device-summary');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
app.whenReady().then(async()=>{
 let win;const folder=fs.mkdtempSync(path.join(os.tmpdir(),'apex-summary-layout-'));
 try{
  const renderer=path.resolve(__dirname,'../src/renderer'),index=fs.readFileSync(path.join(renderer,'index.html'),'utf8');
  const links=[...index.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)].map(m=>'<link rel="stylesheet" href="'+pathToFileURL(path.join(renderer,m[1])).href+'">').join('');
  const short={id:'68055',serial:'7MDSGY3',manufacturer:'Dell',model:'Latitude 5440',productType:'Laptop',condition:'C',status:'Processed',location:'LT PARTS 1ST',pallet:''};
  const long={...short,id:'LONG-ASSET-REFERENCE-0000123456789',serial:'LONG-SERIAL-12345678901234567890123456789',manufacturer:'Hewlett Packard',model:'ZBook Studio 16 inch G10 Mobile Workstation PC',status:'Awaiting Processing',location:'Inspection and refurbishment — workshop storage area 1',pallet:'Long pallet name — awaiting repair'};
  fs.writeFileSync(path.join(folder,'index.html'),'<!doctype html><html class="apex-v34" data-theme="light"><head><meta charset="utf-8">'+links+'</head><body><main id="assetPage" style="display:block;padding:16px;max-width:none"><div id="assetSummary" class="asset-summary mock-summary"></div></main></body></html>');
  win=new BrowserWindow({show:false,width:1440,height:1000,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});await win.loadFile(path.join(folder,'index.html'));
  fs.mkdirSync(path.resolve('qa-print'),{recursive:true});
  for(const asset of [short,long])for(const theme of ['light','dark'])for(const width of [420,760,1100,1440]){
   const work={labels:['Parts fitting','Respray']};
   const markup=summary.card(asset,work,summary.grade(asset),esc,asset.manufacturer+' '+asset.model);
   win.setContentSize(width,1000);
   await win.webContents.executeJavaScript('document.documentElement.dataset.theme='+JSON.stringify(theme)+';document.getElementById("assetSummary").innerHTML='+JSON.stringify(markup)+';window.printClicks=0;document.getElementById("assetPrintLabel").onclick=()=>window.printClicks++;void 0;');
   await new Promise(r=>setTimeout(r,60));
   const result=await win.webContents.executeJavaScript(`(()=>{
    const card=document.getElementById('assetSummary'),box=card.getBoundingClientRect();
    const bad=[...card.querySelectorAll('h2,strong,small,button,.device-card-fact')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.left<box.left+10||r.right>box.right-10||r.bottom>box.bottom-10||e.scrollWidth>e.clientWidth+2)});
    const rgb=s=>(s.match(/[\\d.]+/g)||[]).slice(0,3).map(Number),lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0),ratio=(a,b)=>{const x=lum(rgb(a)),y=lum(rgb(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
    const style=getComputedStyle(card),contrast=ratio(style.color,style.backgroundColor);
    const badges=[...card.querySelectorAll('.device-card-status,.device-card-location')].map(e=>{const s=getComputedStyle(e);return ratio(s.color,s.backgroundColor)});
    document.getElementById('assetPrintLabel').click();
    return {overflow:document.documentElement.scrollWidth>innerWidth+2,bad:bad.map(e=>e.className||e.tagName),contrast,badges,printClicks,grade:card.querySelector('.device-card-primary .device-card-fact:last-child strong').textContent};
   })()`);
   if(result.overflow||result.bad.length||result.contrast<4.5||result.badges.some(n=>n<4.5)||result.printClicks!==1||result.grade!=='C')throw Error('Device summary layout/contrast/action failed '+theme+' '+width+': '+JSON.stringify(result));
   if(asset===short&&width===1100)fs.writeFileSync(path.resolve('qa-print/device-summary-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  console.log('Device summary: both themes, long metadata, responsive widths, text/badge contrast, assigned grade and print button passed.');
  win.destroy();fs.rmSync(folder,{recursive:true,force:true});app.exit(0);
 }catch(error){console.error(error);if(win&&!win.isDestroyed())win.destroy();fs.rmSync(folder,{recursive:true,force:true});app.exit(1);}
});
