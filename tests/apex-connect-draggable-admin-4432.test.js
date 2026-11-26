'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('cloud/apex-connect-admin-moderation-4.4.32.sql');
const ui=read('src/renderer/apex-connect.js'),css=read('src/renderer/apex-connect.css');
const main=read('src/main.js'),preload=read('src/preload.js'),html=read('src/renderer/index.html');
test('Admin permission is checked again in PostgreSQL for each destructive action',()=>{
 assert.match(sql,/role='admin'/);
 assert.match(sql,/s\.active/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/security definer/);
 assert.match(sql,/set search_path=pg_catalog/);
 assert.match(sql,/apex_connect_private\.admin_deletion_audit/);
 assert.match(sql,/revoke all on function public\.apex_connect_admin_delete_message\(bigint\) from public,anon/);
 assert.match(sql,/revoke all on function public\.apex_connect_admin_delete_conversation\(text,uuid\) from public,anon/);
 assert.doesNotMatch(sql,/grant (?:delete|update) on public\.apex_connect_messages to anon/i);
});
test('Admin deletion of a private conversation scopes both sides to current admin and selected colleague',()=>{
 assert.match(sql,/m\.sender_id=actor_id and m\.recipient_id=p_other_user/);
 assert.match(sql,/m\.sender_id=p_other_user and m\.recipient_id=actor_id/);
 assert.match(sql,/recipient_id is null/);
 assert.match(sql,/m\.recipient_id=actor_id/);
 assert.doesNotMatch(sql,/delete from public\.apex_assets/i);
});
test('IPC only allows named admin actions with strict argument checks',()=>{
 assert.match(main,/inventory:connectList',secured\(async/);
 assert.match(main,/isAdmin:authMode==='cloud'&&cloudUserRole==='admin'/);
 assert.match(main,/inventory:connectAdminDeleteMessage',adminSecured/);
 assert.match(main,/inventory:connectAdminDeleteConversation',adminSecured/);
 assert.match(main,/connectMaintenanceRpc\('apex_connect_admin_delete_message'/);
 assert.match(main,/connectMaintenanceRpc\('apex_connect_admin_delete_conversation'/);
 assert.match(preload,/connectAdminDeleteMessage:input=>ipcRenderer\.invoke/);
 assert.match(preload,/connectAdminDeleteConversation:input=>ipcRenderer\.invoke/);
});
test('Original popup can be dragged around viewport, resized, and reset without affecting Workspace Tabs',()=>{
 assert.match(html,/id="apexConnectDragHandle"/);
 assert.match(html,/id="apexConnectResetPosition"/);
 assert.match(ui,/addEventListener\('pointerdown'/);
 assert.match(ui,/addEventListener\('pointermove'/);
 assert.match(ui,/addEventListener\('pointerup'/);
 assert.match(ui,/addEventListener\('pointercancel'/);
 assert.match(ui,/innerWidth-drag\.width-8/);
 assert.match(ui,/innerHeight-drag\.height-8/);
 assert.match(ui,/apex-connect-moved/);
 assert.match(css,/#apexConnectDrawer\{resize:both/);
 assert.match(css,/#apexConnectDragHandle\{cursor:grab/);
});
test('Admin can moderate messages sent by others and clear a selected conversation with two confirmations',()=>{
 assert.match(ui,/isAdmin=info\.isAdmin===true/);
 assert.match(ui,/m\.sender_id===me\|\|isAdmin/);
 assert.match(ui,/api\.connectAdminDeleteMessage/);
 assert.match(ui,/api\.connectAdminDeleteConversation/);
 assert.match(ui,/if\(!confirm\(confirmText\)\)return/);
 assert.match(ui,/Final confirmation: permanently clear/);
 assert.match(ui,/\$\('apexConnectAdminClear'\)\.hidden=!isAdmin/);
 assert.match(ui,/thread=\[\];renderMessages/);
});
test('Admin panel remains hidden to non-admin accounts',()=>{
 assert.match(ui,/isAdmin=false/);
 assert.match(ui,/isAdmin=info\.isAdmin===true/);
 assert.match(ui,/if\(!isAdmin\|\|!ready\|\|modBusy\)return/);
 assert.match(ui,/!isAdmin&&message\.sender_id!==me/);
 assert.match(css,/\.apex-connect-clear-thread\[hidden\]/);
});
