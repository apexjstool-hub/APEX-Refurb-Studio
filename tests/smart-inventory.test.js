'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const crypto=require('node:crypto');
const core=require('../src/inventory-core');
const grade=a=>core.assess(a).grade;
for(const [inspection,expected] of [
 [{cosmetic:'Excellent',functional:'Pass',battery:'Good'},'A'],
 [{cosmetic:'Good',functional:'Pass',battery:'Not applicable'},'B'],
 [{cosmetic:'Fair',functional:'Pass',battery:'Worn'},'C'],
 [{cosmetic:'Good',functional:'Issues',battery:'Good'},'D'],
 [{cosmetic:'Excellent',functional:'Not tested',battery:'Good'},'Pending']])assert.equal(grade(inspection),expected);
let items=[];
let r=core.add(items,{id:'t-123',manufacturer:'Dell',model:'Latitude 5420',productType:'Laptop',processor:'Intel Core i5',gpu:'Intel Iris Xe',ram:'16 GB',ramType:'DDR4',location:'Inspection',pallet:'PALLET-07',sku:'DL5420',condition:'Excellent',status:'Awaiting Processing',inspection:{cosmetic:'Excellent',functional:'Pass',battery:'Good'}});
assert.equal(r.ok,true);assert.equal(r.item.grade,'A');assert.equal(r.item.condition,'Excellent');assert.equal(r.item.status,'Awaiting Processing');assert.equal(r.item.history.length,1);
assert.equal(core.add(items,{id:'T-123',model:'Duplicate'}).ok,false);
r=core.update(items,'T-123',{manufacturer:'Dell',model:'Latitude 5420',location:'Warehouse B',pallet:'PALLET-16',ram:'32 GB',ramType:'DDR4',condition:'B',status:'Processed',inspection:{cosmetic:'Fair',functional:'Pass',battery:'Good'}});
assert.equal(r.ok,true);assert.equal(r.item.grade,'C');assert.equal(r.item.condition,'B');assert.equal(r.item.status,'Processed');assert.equal(r.item.pallet,'PALLET-16');assert.equal(r.item.ram,'32 GB');assert.equal(r.item.location,'Warehouse B');
assert.ok(r.item.history.length>3);
assert.equal(core.update(items,'T-123',{location:''}).ok,false);
assert.equal(core.normalize({id:'legacy',model:'Old',condition:'Ready',inspection:{cosmetic:'Excellent',functional:'Pass',battery:'Good'}}).status,'Processed');
assert.equal(core.normalize({id:'legacy2',model:'Old',condition:'Needs repair'}).status,'Awaiting Processing');
assert.equal(core.normalize({id:'legacy',model:'Old',condition:'Ready',inspection:{cosmetic:'Excellent',functional:'Pass',battery:'Good'}}).condition,'A');
assert.equal(core.update(items,'T-123',{status:'Ready'}).ok,false);
console.log('PASS: inspection grading, full device fields, independent condition and status, intake, edits, migration and audit history');
async function runHub(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'apex-hub-test-'));
 const port=45000+crypto.randomInt(10000);
 const proc=spawn(process.execPath,[path.join(__dirname,'../hub/server.js')],{env:{...process.env,APEX_HUB_PORT:String(port),APEX_HUB_HOST:'127.0.0.1',APEX_HUB_DATA_DIR:dir},stdio:'pipe'});
 try{
  const url=`http://127.0.0.1:${port}`;let online=false;
  for(let k=0;k<50;k++){try{if((await fetch(url+'/health')).ok){online=true;break;}}catch{}await new Promise(r=>setTimeout(r,80));}
  assert.equal(online,true,'Hub started');
  const token=fs.readFileSync(path.join(dir,'hub-token.txt'),'utf8').trim();
  const hdr={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  let resp=await fetch(url+'/v1/items');assert.equal(resp.status,401);
  resp=await fetch(url+'/v1/items',{method:'POST',headers:hdr,body:JSON.stringify({id:'H-1',manufacturer:'HP',model:'ProBook 440 G9',status:'Awaiting Processing',condition:'Fair',location:'Office',inspection:{cosmetic:'Good',functional:'Pass',battery:'Not applicable'}})});
  assert.equal(resp.status,201);assert.equal((await resp.json()).item.grade,'B');
  resp=await fetch(url+'/v1/items/H-1',{method:'PATCH',headers:hdr,body:JSON.stringify({location:'Warehouse',pallet:'P-2',status:'Processed',condition:'B'})});
  assert.equal(resp.status,200);const updated=(await resp.json()).item;assert.equal(updated.location,'Warehouse');assert.equal(updated.pallet,'P-2');assert.equal(updated.status,'Processed');assert.equal(updated.condition,'B');
  resp=await fetch(url+'/v1/items',{headers:hdr});assert.equal((await resp.json()).items[0].location,'Warehouse');
  resp=await fetch(url+'/v1/items/H-1',{method:'DELETE',headers:hdr});assert.equal(resp.status,200);
  resp=await fetch(url+'/v1/items',{headers:hdr});assert.equal((await resp.json()).items.length,0);
  console.log('PASS: shared-hub authentication, CRUD, full field persistence, status and condition updates');
 }finally{proc.kill();fs.rmSync(dir,{recursive:true,force:true});}
}
runHub().catch(err=>{console.error(err);process.exitCode=1;});
