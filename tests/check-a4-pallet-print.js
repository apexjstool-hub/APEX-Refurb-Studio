'use strict';
const {app}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const output=require('../src/assignment-output');
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 let rendered;
 try{
  const data={pallets:[{name:'PALLET-0001',label:'Refurb batch',createdAt:'2026-10-14T10:00:00Z'}],items:[],locations:[]};
  rendered=await output.renderDocument({kind:'pallet',name:'PALLET-0001',document:'barcode',size:'a4'},data);
  const check=await rendered.window.webContents.executeJavaScript("(()=>({name:document.querySelector('.name')?.textContent,caption:document.querySelector('.caption')?.textContent,width:document.querySelector('.barcode svg')?.getBoundingClientRect().width}))()");
  assert.equal(check.name,'PALLET-0001');
  assert.equal(check.caption,'PALLET-0001');
  assert(check.width>250);
  const pdf=await Promise.race([rendered.window.webContents.printToPDF(output.pdfOptions(rendered)),new Promise((_,reject)=>setTimeout(()=>reject(Error('A4 PDF timed out')),30000))]);
  assert.equal((pdf.toString('latin1').match(/\\/Type\\s*\\/Page\\b/g)||[]).length,1);
  const dir=path.resolve('qa-print');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'pallet-barcode-a4.pdf'),pdf);
  console.log('PASS: A4 pallet barcode is scannable-size and one-page portrait PDF.');
  rendered.window.destroy();app.exit(0);
 }catch(e){console.error(e);if(rendered&&!rendered.window.isDestroyed())rendered.window.destroy();app.exit(1);}
});
