'use strict';
/* Browser-level verification of real physical CSS layout, preview and PDF. */
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
const {renderLabelDocument,pdfOptions}=require('../src/label-output');
const base={id:'85543',manufacturer:'Dell',model:'Latitude 5420',serial:'ABC123456',processor:'Intel Core i5',ram:'8GB',storage:'512GB SSD',condition:'Good'};
const fields=['serial','processor','ram','storage','condition'];
async function check(win,size,selected,record=base){
 const payload={type:'assetDevice',record,size,dpi:203,assetOptions:{fields:selected,barcodeHeight:'medium',detailSize:'normal'},preview:false};
 await win.loadFile(path.join(__dirname,'../src/renderer/asset-label-page.html'),{query:{label:JSON.stringify(payload)}});
 const actual=await win.webContents.executeJavaScript(`(async()=>{
  await window.apexLabelReady;
  const stock=document.querySelector('.apex-device-barcode-label');
  const code=stock?.querySelector('.apex-barcode-image svg');
  const box=stock?.getBoundingClientRect();
  const details=[...stock.querySelectorAll('.apex-device-label-detail')];
  return {error:window.apexLabelError,stage:stock.dataset.fitStage,
   count:details.length,paperW:box.width,paperH:box.height,
   barcodeW:code.getBoundingClientRect().width,barcodeH:code.getBoundingClientRect().height,
   moduleDots:stock.dataset.moduleDots,options:details.map(x=>x.dataset.field)};
 })()`);
 if(actual.error)throw Error(size+' '+selected.join(',')+': '+actual.error);
 if(actual.count!==selected.length)throw Error('Missing details '+JSON.stringify(actual));
 const expectedW=(size==='2x1'?50.8:50)*96/25.4,expectedH=(size==='2x1'?25.4:25)*96/25.4;
 if(Math.abs(actual.paperW-expectedW)>2||Math.abs(actual.paperH-expectedH)>2)throw Error('Wrong paper geometry '+JSON.stringify(actual));
 if(Number(actual.moduleDots)<2)throw Error('Barcode module width was unsafe');
 const rendered=await renderLabelDocument(payload);
 try{
  const pdf=await rendered.window.webContents.printToPDF(pdfOptions(size==='2x1'?50.8:50,size==='2x1'?25.4:25));
  const pages=pdf.toString('latin1').split('/Type /Page').length-1;
  if(pages!==1)throw Error('Expected one PDF page; got '+pages);
 }finally{rendered.window.destroy();}
 console.log('PASS',size,selected.length,'fields',actual.stage,actual.barcodeH.toFixed(1)+'px');
}
app.whenReady().then(async()=>{
 const win=new BrowserWindow({show:false,width:500,height:350,webPreferences:{nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
 try{
  // Balanced, dense, and all-field combinations must use the real print document.
  for(const size of ['2x1','50x25'])for(let n=0;n<=5;n++)await check(win,size,fields.slice(0,n));
  for(const selected of [['processor','ram','storage'],['serial','ram','condition'],['processor','storage','condition']])await check(win,'2x1',selected);
  await check(win,'2x1',['processor','ram','storage'],{...base,model:'EliteBook 840 G8'});
  win.destroy();app.exit(0);
 }catch(e){console.error(e);if(!win.isDestroyed())win.destroy();app.exit(1);}
});
