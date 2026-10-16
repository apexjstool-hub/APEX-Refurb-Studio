'use strict';
const {BrowserWindow,dialog}=require('electron'),path=require('node:path'),fs=require('node:fs'),docs=require('./microdream-documents');
const pdfOptions=()=>({pageSize:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
async function renderDocument(input,data){
 const document=docs.select(data,input);
 if(input.expectedFingerprint!==undefined&&input.expectedFingerprint!==document.fingerprint)throw Error('The selected pallets or devices changed. Update the preview before printing.');
 const win=new BrowserWindow({show:false,width:1200,height:850,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 try{await win.loadFile(path.join(__dirname,'renderer/microdream-print-page.html'));await win.webContents.executeJavaScript('window.renderMicrodreamDocument('+JSON.stringify(document)+')');return {window:win,document};}
 catch(e){win.destroy();throw e;}
}
async function output(input,parent,data){let rendered;
 try{
  if(!['print','pdf'].includes(input?.mode))throw Error('Choose Print or Save PDF.');
  if(typeof input.expectedFingerprint!=='string')throw Error('Create a preview before printing.');
  rendered=await renderDocument(input,data);const win=rendered.window;
  if(input.mode==='pdf'){
   const selected=await dialog.showSaveDialog(parent,{title:'Save Microdream job request',defaultPath:'Microdream-Job-Request'+(rendered.document.jobRef?'-'+rendered.document.jobRef.replace(/[^a-zA-Z0-9_-]/g,'_'):'')+'.pdf',filters:[{name:'PDF',extensions:['pdf']}]});
   if(selected.canceled||!selected.filePath)return {ok:false,cancelled:true};
   await fs.promises.writeFile(selected.filePath,await win.webContents.printToPDF(pdfOptions()));return {ok:true,count:rendered.document.total};
  }
  return await new Promise(resolve=>win.webContents.print({silent:false,pageSize:'A4',landscape:true,printBackground:true,scaleFactor:100},(ok,error)=>resolve(ok?{ok:true,count:rendered.document.total}:{ok:false,error:error||'Printing cancelled.'})));
 }catch(e){return {ok:false,error:e.message};}
 finally{if(rendered&&!rendered.window.isDestroyed())rendered.window.destroy();}
}
module.exports={renderDocument,output,pdfOptions};
