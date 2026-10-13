'use strict';
const {app,BrowserWindow}=require('electron'),path=require('node:path');
const {renderLabelDocument,pdfOptions,printerOptions}=require('../src/label-output');
app.whenReady().then(async()=>{
 let win;
 try{
  win=new BrowserWindow({show:false,width:600,height:500,webPreferences:{nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
  const record={id:'APEX-AUTO-TEST-002',manufacturer:'HP',model:'ZBook Studio 16 inch G10 Mobile Workstation PC',serial:'ABC123456'};
  for(const size of ['2x1','50x25','50x30','60x40','40x30','80x30'])for(const type of ['asset','refurb']){
   const [w,h]=size==='2x1'?[50.8,25.4]:size.split('x').map(Number);
   await win.loadFile(path.join(__dirname,'../src/renderer/asset-label-page.html'),{query:{label:JSON.stringify({record,type,size,dpi:203,preview:false})}});
   const check=await win.webContents.executeJavaScript(`(async()=>{await window.apexLabelReady;const sheet=document.getElementById('labelSheet');const b=sheet.getBoundingClientRect();return {error:window.apexLabelError,overflow:[...sheet.querySelectorAll('svg,.apex-label-copy,.apex-barcode-human')].some(el=>{const r=el.getBoundingClientRect();return r.right>b.right+.5||r.bottom>b.bottom+.5||r.left<b.left-.5||r.top<b.top-.5;}),width:b.width,height:b.height};})()`);
   if(check.error||check.overflow)throw Error(size+' '+type+' layout failed: '+JSON.stringify(check));
   const rendered=await renderLabelDocument({record,type,size,dpi:203});
   const pdf=await rendered.window.webContents.printToPDF(pdfOptions(w,h));rendered.window.destroy();
   const expectedWidth=w*72/25.4,expectedHeight=h*72/25.4;
   const media=pdf.toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)/);
   if(!media||Math.abs(Number(media[1])-expectedWidth)>1||Math.abs(Number(media[2])-expectedHeight)>1)throw Error('Wrong physical PDF size: '+size);
   const options=printerOptions(w,h,203);if(options.pageSize.width!==w*1000||options.landscape||options.scaleFactor!==100)throw Error('Wrong printer options');
   await win.loadFile(path.join(__dirname,'../src/renderer/asset-label-page.html'),{query:{label:JSON.stringify({record,type,size,dpi:203,preview:true})}});
   await win.webContents.executeJavaScript('window.apexLabelReady');
   for(const [vw,vh] of [[500,Math.round(500*h/w)],[300,Math.round(300*h/w)]]){
    win.setContentSize(vw,vh);await win.webContents.executeJavaScript('window.apexResizeLabelPreview?.()');await new Promise(r=>setTimeout(r,200));
    const preview=await win.webContents.executeJavaScript(`(()=>{const s=document.getElementById('labelSheet').getBoundingClientRect();const clips=[document.body,document.documentElement].some(el=>{const r=el.getBoundingClientRect();const css=getComputedStyle(el);return ['hidden','clip','auto','scroll'].includes(css.overflowY)&&s.bottom>r.bottom+1;});return {width:s.width,height:s.height,vw:innerWidth,vh:innerHeight,clips,error:window.apexLabelError};})()`);
    if(preview.error||preview.clips||preview.width>preview.vw+1||preview.height>preview.vh+1||Math.abs(preview.width/preview.height-w/h)>.02)throw Error('Preview clipped/distorted: '+JSON.stringify(preview));
   }
   const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
   if(pages!==1)throw Error(size+' '+type+' produced '+pages+' pages');
   console.log('PASS: '+size+' '+type+' fits and prints exactly one page');
  }
  win.destroy();app.exit(0);
 }catch(e){console.error(e);if(win&&!win.isDestroyed())win.destroy();app.exit(1);}
});


