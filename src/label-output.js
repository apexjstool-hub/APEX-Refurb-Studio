'use strict';
const {BrowserWindow,dialog}=require('electron'),path=require('node:path'),fs=require('node:fs');
const sizes={'2x1':[50.8,25.4],'50x25':[50,25],'50x30':[50,30],'60x40':[60,40],'40x30':[40,30],'80x30':[80,30]};
function sanitise(input){
 if(!input||!sizes[input.size]||!['asset','refurb'].includes(input.type)||![203,300,600].includes(input.dpi))throw Error('Invalid label settings.');
 const record={};for(const [key,max] of Object.entries({id:80,manufacturer:90,model:140,serial:90}))record[key]=String(input.record?.[key]??'').trim().slice(0,max);
 if(!record.id)throw Error('Asset ID is required.');
 return {record,size:input.size,type:input.type,dpi:input.dpi,preview:false};
}
async function renderLabelDocument(input){
 const payload=sanitise(input),[w,h]=sizes[payload.size];
 const window=new BrowserWindow({show:false,width:600,height:400,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,backgroundThrottling:false}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 try{
  await window.loadFile(path.join(__dirname,'renderer/asset-label-page.html'),{query:{label:JSON.stringify(payload)}});
  const error=await window.webContents.executeJavaScript('(async()=>{await window.apexLabelReady;return window.apexLabelError||null;})()');
  if(error)throw Error(error);
  return {window,payload,w,h};
 }catch(error){window.destroy();throw error;}
}
function pdfOptions(w,h){return {pageSize:{width:w/25.4,height:h/25.4},preferCSSPageSize:true,printBackground:true,landscape:false,scale:1,margins:{top:0,bottom:0,left:0,right:0}};}
function printerOptions(w,h,dpi){return {silent:false,pageSize:{width:w*1000,height:h*1000},landscape:false,scaleFactor:100,margins:{marginType:'none'},printBackground:true,copies:1,dpi:{horizontal:dpi,vertical:dpi}};}
async function outputLabel(input,parent,mode){
 let rendered;
 try{
  rendered=await renderLabelDocument(input);const {window,w,h,payload}=rendered;
  if(mode==='pdf'){
   const selected=await dialog.showSaveDialog(parent,{title:'Save label PDF ('+w+' × '+h+' mm)',defaultPath:'APEX-'+payload.record.id.replace(/[^a-zA-Z0-9_-]/g,'_')+'-'+payload.type+'.pdf',filters:[{name:'PDF label',extensions:['pdf']}]});
   if(selected.canceled||!selected.filePath)return {ok:false,cancelled:true};
   const pdf=await window.webContents.printToPDF(pdfOptions(w,h));await fs.promises.writeFile(selected.filePath,pdf);return {ok:true};
  }
  return await new Promise(resolve=>window.webContents.print(printerOptions(w,h,payload.dpi),(success,reason)=>resolve(success?{ok:true}:{ok:false,error:reason||'Printing was cancelled.'})));
 }catch(error){return {ok:false,error:error.message};}
 finally{if(rendered&&!rendered.window.isDestroyed())rendered.window.destroy();}
}
module.exports={renderLabelDocument,pdfOptions,printerOptions,outputLabel,sanitise};

