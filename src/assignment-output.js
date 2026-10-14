'use strict';
const {BrowserWindow,dialog}=require('electron'),fs=require('node:fs'),docs=require('./assignment-documents'),labelOutput=require('./label-output');
async function renderDocument(input,data){
 if(!input||!['barcode','manifest'].includes(input.document))throw Error('Choose a barcode label or pallet manifest.');
 const meta=docs.select(data,input.kind,input.name),size=input.size||'2x1',dpi=Number(input.dpi)||203;
 const markup=input.document==='manifest'?docs.manifestDocument(meta):docs.labelDocument(meta,size,dpi);
 const win=new BrowserWindow({show:false,width:900,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 try{await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(markup));await win.webContents.executeJavaScript("document.fonts.ready.then(()=>true)");return {window:win,meta,size,dpi,document:input.document};}
 catch(e){win.destroy();throw e;}
}
function pdfOptions(document){const [w,h]=docs.sizes[document.size]||[];return document.document==='manifest'?{pageSize:'A4',preferCSSPageSize:true,printBackground:true,landscape:false,displayHeaderFooter:false}:labelOutput.pdfOptions(w,h);}
async function output(input,parent,data){
 let document;
 try{
  if(!['print','pdf'].includes(input?.mode))throw Error('Invalid print operation.');
  document=await renderDocument(input,data);const {window:win,meta,size,dpi}=document,manifest=input.document==='manifest';
  const [w,h]=docs.sizes[size]||[];
  if(input.mode==='pdf'){
   const selected=await dialog.showSaveDialog(parent,{title:manifest?'Save A4 pallet manifest':'Save barcode label PDF',defaultPath:'APEX-'+meta.name.replace(/[^a-zA-Z0-9_-]/g,'_')+'-'+(manifest?'manifest':'barcode')+'.pdf',filters:[{name:'PDF',extensions:['pdf']}]});
   if(selected.canceled||!selected.filePath)return {ok:false,cancelled:true};
   const options=pdfOptions(document);
   const pdf=await win.webContents.printToPDF(options);await fs.promises.writeFile(selected.filePath,pdf);return {ok:true,count:meta.assets.length};
  }
  const options=manifest?{silent:false,pageSize:'A4',landscape:false,printBackground:true,scaleFactor:100}:labelOutput.printerOptions(w,h,dpi);
  return await new Promise(resolve=>win.webContents.print(options,(ok,reason)=>resolve(ok?{ok:true,count:meta.assets.length}:{ok:false,error:reason||'Printing was cancelled.'})));
 }catch(e){return {ok:false,error:e.message};}
 finally{if(document&&!document.window.isDestroyed())document.window.destroy();}
}
module.exports={renderDocument,output,pdfOptions};
