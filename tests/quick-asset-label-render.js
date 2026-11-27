'use strict';
const {app}=require('electron'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'apex-quick-label-test-'));app.setPath('userData',dir);app.disableHardwareAcceleration();
const {renderLabelDocument}=require('../src/label-output');
const record={id:'69897',manufacturer:'HP',model:'ProBook 440 G9',serial:'DEMO123'};
app.whenReady().then(async()=>{
 for(const input of [{record,type:'assetDevice',size:'2x1',dpi:203,assetOptions:{fields:[]}},{record,type:'qa',size:'2x1',dpi:203,qa:{technician:'Demo Technician',serial:record.serial,createdDate:'2026-11-27'}}]){
  const {window}=await renderLabelDocument(input);
  try{const result=await window.webContents.executeJavaScript("({text:document.getElementById('labelSheet').innerText,stock:!!document.querySelector('.apex-label-stock')})");assert.ok(result.stock);if(input.type==='assetDevice'){assert.match(result.text,/69897/);assert.match(result.text,/HP ProBook 440 G9/);assert.doesNotMatch(result.text,/APEX ASSET TAG/);}else{assert.match(result.text,/DEMO123/);assert.match(result.text,/Demo Technician/i);assert.match(result.text,/27\\/11\\/2026/);}}finally{window.destroy();}
 }
 console.log('Both quick label formats rendered at 2x1 without a physical printer.');app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
