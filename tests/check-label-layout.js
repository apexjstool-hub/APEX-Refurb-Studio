'use strict';
const {app,BrowserWindow}=require('electron'),path=require('node:path');
app.whenReady().then(async()=>{
 let win;
 try{
  win=new BrowserWindow({show:false,width:600,height:500,webPreferences:{nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
  const record={id:'APEX-AUTO-TEST-002',manufacturer:'HP',model:'ZBook Studio 16 inch G10 Mobile Workstation PC',serial:'ABC123456'};
  for(const size of ['50x25','50x30','60x40','40x30','80x30'])for(const type of ['asset','refurb']){
   const [w,h]=size.split('x').map(Number);
   await win.loadFile(path.join(__dirname,'../src/renderer/asset-label-page.html'),{query:{label:JSON.stringify({record,type,size,dpi:203,preview:false})}});
   const check=await win.webContents.executeJavaScript(`(async()=>{await window.apexLabelReady;const sheet=document.getElementById('labelSheet');const b=sheet.getBoundingClientRect();return {error:window.apexLabelError,overflow:[...sheet.querySelectorAll('svg,.apex-label-copy,.apex-barcode-human')].some(el=>{const r=el.getBoundingClientRect();return r.right>b.right+.5||r.bottom>b.bottom+.5||r.left<b.left-.5||r.top<b.top-.5;}),width:b.width,height:b.height};})()`);
   if(check.error||check.overflow)throw Error(size+' '+type+' layout failed: '+JSON.stringify(check));
   const pdf=await win.webContents.printToPDF({pageSize:{width:w*1000,height:h*1000},preferCSSPageSize:true,printBackground:true,margins:{top:0,bottom:0,left:0,right:0},scale:1});
   const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
   if(pages!==1)throw Error(size+' '+type+' produced '+pages+' pages');
   console.log('PASS: '+size+' '+type+' fits and prints exactly one page');
  }
  win.destroy();app.exit(0);
 }catch(e){console.error(e);if(win&&!win.isDestroyed())win.destroy();app.exit(1);}
});
