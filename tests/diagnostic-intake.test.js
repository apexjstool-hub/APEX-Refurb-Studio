'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {importDiagnostic}=require('../src/diagnostic-intake');
const core=require('../src/inventory-core');
const data={id:'ASSET-123',manufacturer:'Dell',model:'Latitude 5420',serial:'SER-ABC',processor:'Intel Core i5-1145G7',gpu:'Intel Iris Xe',ram:'16 GB',ramType:'DDR4',storage:'Samsung SSD 512 GB',operatingSystem:'Windows 11 Pro',condition:'D',status:'Processed',location:'Not allowed',pallet:'INJECTED'};
const items=[];
let r=importDiagnostic(items,data);
assert.equal(r.ok,true);assert.equal(r.action,'created');
assert.equal(r.item.location,'Inspection');assert.equal(r.item.condition,'Not assessed');assert.equal(r.item.status,'Awaiting Processing');assert.equal(r.item.storage,'Samsung SSD 512 GB');
assert.equal(r.item.operatingSystem,'Windows 11 Pro');
core.update(items,'ASSET-123',{location:'Warehouse B',pallet:'PALLET-07',condition:'A',status:'Processed',sku:'DELL-5420'});
r=importDiagnostic(items,{...data,processor:'Intel Core i5-1145G7 (updated)',condition:'D'});
assert.equal(r.ok,true);assert.equal(r.action,'updated');assert.equal(r.item.processor,'Intel Core i5-1145G7 (updated)');
assert.equal(r.item.location,'Warehouse B');assert.equal(r.item.pallet,'PALLET-07');assert.equal(r.item.condition,'A');assert.equal(r.item.status,'Processed');assert.equal(r.item.sku,'DELL-5420');
assert.equal(items.length,1);
r=importDiagnostic(items,{...data,processor:'Intel Core i5-1145G7 (updated)'});
assert.equal(r.action,'unchanged');
r=importDiagnostic(items,{...data,serial:'OTHER-SERIAL'});assert.equal(r.ok,false);
console.log('PASS: intake import preserves warehouse, grade, pallet, SKU and status; duplicate protection');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'apex-diag-intake-test-'));
 const port=45000+crypto.randomInt(17000);
 const proc=spawn(process.execPath,[path.join(__dirname,'../hub/server.js')],{env:{...process.env,APEX_HUB_DATA_DIR:dir,APEX_HUB_PORT:String(port),APEX_HUB_HOST:'127.0.0.1'},stdio:'pipe'});
 try{
  const url='http://127.0.0.1:'+port;
  let up=false;
  for(let i=0;i<70;i++){try{if((await fetch(url+'/health')).ok){up=true;break;}}catch{}await new Promise(r=>setTimeout(r,70));}
  assert.ok(up,'Hub started');
  const token=fs.readFileSync(path.join(dir,'hub-intake-token.txt'),'utf8').trim();
  const header={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  let resp=await fetch(url+'/v1/items',{headers:header});assert.equal(resp.status,401,'Diagnostic key cannot read inventory');
  resp=await fetch(url+'/v1/items',{method:'POST',headers:header,body:JSON.stringify(data)});assert.equal(resp.status,401,'Diagnostic key cannot use normal CRUD');
  resp=await fetch(url+'/v1/diagnostic-intake',{method:'POST',headers:header,body:JSON.stringify(data)});assert.equal(resp.status,201);assert.equal((await resp.json()).action,'created');
  resp=await fetch(url+'/v1/diagnostic-intake',{method:'POST',headers:header,body:JSON.stringify(data)});assert.equal(resp.status,200);assert.equal((await resp.json()).action,'unchanged');
  resp=await fetch(url+'/v1/diagnostic-intake',{method:'POST',headers:header,body:JSON.stringify({...data,serial:'DIFFERENT'})});assert.equal(resp.status,409);
  resp=await fetch(url+'/v1/diagnostic-intake',{headers:header});assert.equal(resp.status,200);
  resp=await fetch(url+'/v1/diagnostic-intake',{headers:{Authorization:'Bearer '+('0'.repeat(64))}});assert.equal(resp.status,401);
  console.log('PASS: live hub intake, save-only token scope, authentication, duplicate and serial mismatch');
 }finally{proc.kill();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
