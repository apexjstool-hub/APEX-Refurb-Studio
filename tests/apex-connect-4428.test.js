'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createConnectService}=require('../src/apex-connect-service');
const ME='11111111-1111-4111-8111-111111111111';
const OFFICE='22222222-2222-4222-8222-222222222222';
const schema=fs.readFileSync(path.join(__dirname,'../cloud/apex-connect-4.4.28.sql'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../src/renderer/apex-connect.js'),'utf8');
const page=fs.readFileSync(path.join(__dirname,'../src/renderer/index.html'),'utf8');
function fixture(){
 const calls=[],messages=[],reads=[];let membership=false;
 const cloudFetch=async (url,options={})=>{
  calls.push({url,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
  const data=()=>{
   if(url.includes('apex_connect_members')){
    if(options.method==='POST'){membership=true;return [{user_id:ME,display_name:'Engineer'}];}
    return membership?[{user_id:ME,display_name:'Engineer'},{user_id:OFFICE,display_name:'Office'}]:[];
   }
   if(url.includes('apex_connect_messages')){
    if(options.method==='POST'){const row={...JSON.parse(options.body),id:messages.length+1,created_at:new Date().toISOString()};messages.push(row);return [row];}
    if(url.includes('recipient_id=is.null'))return messages.filter(x=>x.recipient_id===null).slice(-150).reverse();
    if(url.includes('or='))return messages.filter(x=>x.recipient_id===OFFICE||x.sender_id===OFFICE).slice(-150).reverse();
    return [...messages].reverse();
   }
   if(url.includes('apex_connect_reads')){
    if(options.method==='POST'){reads.push(JSON.parse(options.body));return reads.slice(-1);}
    if(options.method==='PATCH'){Object.assign(reads[0],JSON.parse(options.body));return [];}
    return reads;
   }
   return [];
  };
  return {ok:true,status:200,json:async()=>data()};
 };
 const identity=()=>({userId:ME,email:'engineer@company.test'});
 return {client:createConnectService({cloudFetch,identity}),calls,messages,reads};
}
test('Secure APEX Connect transport supports office-wide and private messages',async()=>{
 const {client,calls}=fixture();
 let result=await client.list();assert.equal(result.ok,true,result.error);assert.equal(result.members.length,2);
 result=await client.send({recipient:'team',body:'Pallet IR-560 is ready for QA',assetId:'83253'});
 assert.equal(result.ok,true,result.error);assert.equal(result.message.recipient_id,null);
 assert.equal(result.message.asset_id,'83253');
 result=await client.send({recipient:OFFICE,body:'Can you order the LCD?'});
 assert.equal(result.ok,true,result.error);assert.equal(result.message.recipient_id,OFFICE);
 assert.equal((await client.history('team')).messages.length,1);
 assert.equal((await client.history(OFFICE)).messages.length,1);
 assert.equal((await client.read({recipient:'team',lastId:1})).ok,true);
 assert.equal((await client.read({recipient:'team',lastId:0})).lastRead,1,'read cursor is monotonic');
 assert(calls.every(x=>x.url.startsWith('/rest/v1/apex_connect_')),'renderer cannot select arbitrary REST endpoints');
 assert(calls.every(x=>!JSON.stringify(x).includes('service_role')));
});
test('Payload validation blocks forged recipients, blank messages and oversized content',async()=>{
 const {client,calls}=fixture();
 assert.equal((await client.send({recipient:ME,body:'self'})).ok,false);
 assert.equal((await client.send({recipient:'bad-id',body:'hello'})).ok,false);
 assert.equal((await client.send({recipient:OFFICE,body:'   '})).ok,false);
 assert.equal((await client.send({recipient:OFFICE,body:'x'.repeat(2001)})).ok,false);
 assert.equal((await client.send({recipient:OFFICE,body:'hello',assetId:'1);drop table'})).ok,false);
 assert.equal((await client.history('bad-id')).ok,false);
 assert.equal((await client.read({recipient:OFFICE,lastId:-1})).ok,false);
 assert.equal(calls.length,0,'invalid requests never contact cloud');
});
test('Signed-out users cannot read or send, without exposing secrets',async()=>{
 const api=createConnectService({cloudFetch:async()=>{throw Error('Should not call');},identity:()=>null});
 assert.equal((await api.list()).requiresCloud,true);
 assert.equal((await api.send({body:'hello',recipient:'team'})).ok,false);
});
test('Schema enforces RLS on all new tables and restricts chat to active APEX staff',()=>{
 for(const table of ['apex_connect_members','apex_connect_messages','apex_connect_reads']){
  assert.match(schema,new RegExp('alter table public\\.'+table+' enable row level security'));
 }
 assert.match(schema,/sender_id=\(select auth\.uid\(\)\)/);
 assert.match(schema,/recipient_id is null or sender_id=\(select auth\.uid\(\)\) or recipient_id=\(select auth\.uid\(\)\)/);
 assert.match(schema,/s\.active=true/);
 assert.match(schema,/revoke all on public\.apex_connect_members/);
 assert.doesNotMatch(schema,/security definer/i);
 assert.doesNotMatch(schema,/grant .* to anon/i);
});
test('Existing UI gains an optional message drawer, unread badge, asset links and Workspace tab',()=>{
 assert.match(page,/id="apexConnectToggle"/);
 assert.match(page,/id="apexConnectUnread"/);
 assert.match(page,/id="apexConnectDrawer"/);
 assert.match(page,/id="connectPage"/);
 assert.match(page,/apex-connect\.js/);
 assert.match(ui,/ApexWorkspaceTabs\.openNew\('connect'\)/);
 assert.match(ui,/data-connect-asset/);
 assert.match(ui,/api\.connectSend/);
 assert.match(ui,/api\.connectRead/);
 assert.match(ui,/textContent/);
 assert.match(ui,/Messages are separate from Engineer and Refurb Notes/);
});
