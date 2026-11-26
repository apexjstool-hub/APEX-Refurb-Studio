'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('cloud/apex-connect-maintenance-4.4.29.sql');
const main=read('src/main.js'),preload=read('src/preload.js'),html=read('src/renderer/index.html');
const panel=read('src/renderer/apex-connect-maintenance.js');
const icon=read('src/renderer/apex-connect.js'),css=read('src/renderer/apex-connect.css');
test('Retaining messages is opt-in; daily cron is bounded and affects only chat rows',()=>{
 assert.match(sql,/enabled boolean not null default false/);
 assert.match(sql,/values \(1,false,90\)/);
 assert.match(sql,/retention_days in \(30,90,180,365\)/);
 assert.match(sql,/cron\.schedule\('apex-connect-daily-retention','0 3 \* \* \*'/);
 assert.match(sql,/where created_at < now\(\) - make_interval\(days=>cfg\.retention_days\)/);
 assert.match(sql,/limit max_rows/);
 assert.match(sql,/least\(greatest\(coalesce\(p_limit,500\),1\),500\)/);
 assert.match(sql,/delete from public\.apex_connect_messages/);
 assert.doesNotMatch(sql,/delete from public\.(?:apex_assets|apex_staff|apex_refurb_workflow|apex_audit)/i);
});
test('All maintenance write calls require cloud administrator and unlocked Settings',()=>{
 assert.match(sql,/s\.active and s\.role='admin'/);
 assert.match(sql,/auth\.uid\(\) is null/);
 assert.match(sql,/revoke all on function public\.apex_connect_maintenance_run\(\) from public,anon/);
 assert.match(sql,/revoke all on public\.apex_connect_maintenance from public, anon, authenticated/);
 assert.match(main,/inventory:connectMaintenanceSave',settingsSecured/);
 assert.match(main,/inventory:connectMaintenanceRun',settingsSecured/);
 assert.match(main,/inventory:connectMaintenanceStatus',adminSecured/);
 assert.match(preload,/connectMaintenanceSave:input=>ipcRenderer\.invoke\('inventory:connectMaintenanceSave'/);
 assert.doesNotMatch(panel,/service_role|apikey|Bearer /);
});
test('Maintenance settings include confirmation, cloud stats and admin-only controls',()=>{
 assert.match(html,/id="apexConnectMaintenance"/);
 assert.match(html,/id="apexConnectRetentionEnabled"/);
 assert.match(html,/id="apexConnectMaintenanceRun"/);
 assert.match(html,/apex-connect-maintenance\.js/);
 assert.match(html,/Messaging maintenance/);
 assert.match(panel,/confirm\('Enable automatic deletion/);
 assert.match(panel,/confirm\('Permanently delete up to 500/);
 assert.match(panel,/api\.connectMaintenanceStatus\(\)/);
 assert.match(panel,/api\.connectMaintenanceSave\(/);
 assert.match(panel,/api\.connectMaintenanceRun\(\)/);
});
test('Header has real message icon, distinct unread badge and motion accessibility',()=>{
 assert.match(html,/id="apexConnectToggle"/);
 assert.match(html,/class="apex-connect-icon"/);
 assert.doesNotMatch(html,/>♧<span id="apexConnectUnread"/);
 assert.match(icon,/const count=me\?unreadTotal\(\):0/);
 assert.match(icon,/count>lastUnread/);
 assert.match(icon,/initialisedUnread/);
 assert.match(icon,/classList\.add\('apex-connect-notify'\)/);
 assert.match(css,/@keyframes apex-connect-shake/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/#apexConnectUnread\{background:#dc283a/);
});
test('No installed dependencies or underlying inventory code are changed',()=>{
 assert.match(html,/workspace-tabs-v2\.js/);
 assert.match(html,/assetTopSave/);
 assert.doesNotMatch(panel,/localStorage|sessionStorage|indexedDB/);
});
