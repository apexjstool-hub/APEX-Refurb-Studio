'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const get=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=get('cloud/apex-connect-user-delete-4.4.31.sql');
const tabs=get('src/renderer/workspace-tabs-v2.js'),ui=get('src/renderer/apex-connect.js');
const css=get('src/renderer/apex-connect.css'),main=get('src/main.js'),preload=get('src/preload.js');
const {createConnectService}=require('../src/apex-connect-service');
const ME='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
test('Database policy permits deletion of own sent messages only for active authenticated staff',()=>{
 assert.match(sql,/grant delete on public\.apex_connect_messages to authenticated/);
 assert.match(sql,/for delete to authenticated/);
 assert.match(sql,/sender_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/s\.active=true/);
 assert.doesNotMatch(sql,/grant delete .* to anon/i);
});
test('Connect IPC restricts deletion to existing authenticated main-process service',()=>{
 assert.match(main,/inventory:connectDelete',secured\(input=>apexConnect\.deleteMessage\(input\)\)/);
 assert.match(preload,/connectDelete:input=>ipcRenderer\.invoke\('inventory:connectDelete'/);
});
test('Direct message sender deletion uses scoped row id and authenticated current sender, never arbitrary URLs',async()=>{
 const requests=[],client=createConnectService({
  identity:()=>({userId:ME,email:'engineer@apex.test'}),
  cloudFetch:async (uri,opts)=>{requests.push({uri,opts});return {ok:true,status:200,json:async()=>[{id:17,sender_id:ME}]};}
 });
 assert.deepEqual(JSON.parse(JSON.stringify(await client.deleteMessage({messageId:17}))),{ok:true,deletedId:17});
 assert.equal(requests.length,1);
 assert.equal(requests[0].opts.method,'DELETE');
 assert.equal(requests[0].uri,'/rest/v1/apex_connect_messages?id=eq.17&sender_id=eq.'+ME);
 assert.equal(requests[0].opts.headers.Prefer,'return=representation');
 assert.equal((await client.deleteMessage({messageId:'1;delete from assets'})).ok,false);
 assert.equal((await client.deleteMessage({messageId:0})).ok,false);
 assert.equal(requests.length,1);
});
test('Server reports error when message belongs to someone else and no row is deleted',async()=>{
 const client=createConnectService({identity:()=>({userId:ME,email:'engineer@apex.test'}),cloudFetch:async()=>({ok:true,status:200,json:async()=>[]})});
 const result=await client.deleteMessage({messageId:33});
 assert.equal(result.ok,false);
 assert.match(result.error,/only your own messages/i);
});
test('Message tap shows delete option with confirmation and updates visible conversation on success',()=>{
 assert.match(ui,/\.apex-connect-message\.can-delete/);
 assert.match(ui,/data-delete-message/);
 assert.match(ui,/data-message-actions/);
 assert.match(ui,/api\.connectDelete\(\{messageId:id\}\)/);
 assert.match(ui,/message\.sender_id!==me/);
 assert.match(ui,/Permanently delete this message for everyone/);
 assert.match(ui,/thread=thread\.filter/);
 assert.match(css,/\.apex-connect-message-delete\[hidden\]/);
});
test('Phone-style red badges on both header and Workspace Connect tab persist until read',()=>{
 assert.match(ui,/root\.ApexWorkspaceTabs\?\.setConnectUnread\?\.\(count\)/);
 assert.match(tabs,/entry\.page==='connect'&&connectUnread>0/);
 assert.match(tabs,/setConnectUnread:count=>/);
 assert.match(tabs,/apex-workspace-message-unread/);
 assert.match(css,/\.apex-workspace-message-unread/);
 assert.match(css,/#apexConnectUnread:not\(\[hidden\]\)/);
 assert.match(css,/background:#e1263b/);
});
