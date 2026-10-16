'use strict';
const {app}=require('electron'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),output=require('../src/microdream-output'),docs=require('../src/microdream-documents');
app.whenReady().then(async()=>{let rendered;try{
 const folder=path.resolve('qa-print');fs.mkdirSync(folder,{recursive:true});
 const data={pallets:[{name:'MD-1',storageLocation:'MICRODREAM'},{name:'MD-2',storageLocation:'MICRODREAM'}],items:[...Array.from({length:9},(_,i)=>({id:'D'+i,manufacturer:'Dell',model:'Latitude 5420',pallet:i<5?'MD-1':'MD-2'})),...Array.from({length:3},(_,i)=>({id:'H'+i,manufacturer:'HP',model:'EliteBook 840 G8',pallet:'MD-2'}))]};
 const input={palletNames:['MD-1','MD-2'],jobRef:'MD-TEST-2026'},snapshot=docs.select(data,input);
 rendered=await output.renderDocument({...input,expectedFingerprint:snapshot.fingerprint},data);
 let check=await rendered.window.webContents.executeJavaScript("(()=>{const rows=[...document.querySelectorAll('.md-model-row')];return {ready:window.microdreamReady,rows:rows.map(r=>[...r.cells].map(c=>c.textContent)),image:[...document.images].every(i=>i.complete&&i.naturalWidth>0),width:document.body.scrollWidth,available:document.body.clientWidth};})()");
 assert(check.ready&&check.image);assert.equal(check.rows.length,2);assert.deepEqual(check.rows[0],['Dell Latitude 5420','','UK','Full respray','9','']);assert.deepEqual(check.rows[1],['HP EliteBook 840 G8','','UK','Full respray','3','']);assert(check.width<=check.available+2);
 let pdf=await rendered.window.webContents.printToPDF(output.pdfOptions());assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1);fs.writeFileSync(path.join(folder,'microdream-job-request.pdf'),pdf);
 fs.writeFileSync(path.join(folder,'microdream-job-request.png'),(await rendered.window.webContents.capturePage()).toPNG());rendered.window.destroy();
 const many={...data,items:Array.from({length:23},(_,i)=>({id:'M'+i,manufacturer:'Dell',model:'Precision '+i+(i%3?'':' Professional mobile workstation with a long model description and variant '.repeat(2)),pallet:'MD-1'}))};
 rendered=await output.renderDocument({palletNames:['MD-1'],jobRef:'MULTI-PAGE'},many);
 check=await rendered.window.webContents.executeJavaScript("(()=>{const sheets=[...document.querySelectorAll('.microdream-sheet')];return {rows:document.querySelectorAll('.md-model-row').length,sheets:sheets.length,maxHeight:Math.max(...sheets.map(s=>s.getBoundingClientRect().height))};})()");assert.equal(check.rows,23);assert(check.maxHeight<184.6*96/25.4);
 pdf=await rendered.window.webContents.printToPDF(output.pdfOptions());assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,check.sheets);fs.writeFileSync(path.join(folder,'microdream-job-request-multipage.pdf'),pdf);rendered.window.destroy();rendered=null;
 data.items[0].pallet='MD-2';await assert.rejects(()=>output.renderDocument({...input,expectedFingerprint:snapshot.fingerprint},data),/changed/);
 console.log('PASS: Microdream template groups selected devices, prints one A4 landscape sheet and paginates long model lists without extra or clipped pages; stale preview rejected.');app.exit(0);
 }catch(e){console.error(e);if(rendered&&!rendered.window.isDestroyed())rendered.window.destroy();app.exit(1);}});
