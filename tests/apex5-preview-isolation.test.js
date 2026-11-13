'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const pkg=JSON.parse(read('package.json'));
const main=read('src/main.js'),html=read('src/renderer/index.html'),css=read('src/renderer/apex5-professional-preview.css');
test('Standalone preview has an entirely separate Windows application and installer identity',()=>{
 assert.equal(pkg.name,'apex-management-studio-5-preview');
 assert.equal(pkg.version,'5.0.0-preview.2');
 assert.equal(pkg.build.appId,'com.apex.management.preview5');
 assert.equal(pkg.build.productName,'APEX Management Studio 5 Preview');
 assert.match(pkg.build.win.artifactName,/APEX-Management-Studio-5-Preview-Setup-/);
 assert.equal(pkg.build.nsis.shortcutName,'APEX Management Studio 5 Preview');
 assert.notEqual(pkg.build.appId,'com.apex.inventory');
 assert.equal(pkg.build.publish,undefined);
 assert.match(main,/app\.setAppUserModelId\('com\.apex\.management\.preview5'\)/);
 assert.match(main,/app\.setName\('APEX Management Studio 5 Preview'\)/);
});
test('Preview uses a separate user-data location before any database or credential read',()=>{
 assert.match(main,/path\.join\(app\.getPath\('appData'\),'APEX-Management-Studio-5-Preview-Demo'\)/);
 assert.match(main,/fs\.mkdirSync\(previewUserData,\{recursive:true\}\)/);
 assert.match(main,/app\.setPath\('userData',previewUserData\)/);
 assert(main.indexOf("app.setPath('userData',previewUserData)")<main.indexOf('const dbPath='));
 assert.match(main,/const dbPath=\(\)=>path\.join\(userDir\(\),'inventory-db\.json'\)/);
});
test('Production cloud login, hub connections, updates and network are blocked',()=>{
 assert.match(main,/const PREVIEW_DEMO=true/);
 for(const phrase of [
  "if(PREVIEW_DEMO)return null;try{",
  "if(PREVIEW_DEMO)return {ok:false,error:'Demo preview cannot connect to hubs.'}",
  "if(PREVIEW_DEMO)return {ok:false,error:'Cloud login disabled in isolated preview.'}",
  "if(PREVIEW_DEMO)return {ok:false,remembered:false}",
  "if(PREVIEW_DEMO)throw Error('Preview cannot access cloud.')",
  "if(PREVIEW_DEMO)return {ok:false,error:'Cloud sync disabled in preview.'}",
  "if(!PREVIEW_DEMO)updateCentre.init(win)"
 ])assert(main.includes(phrase),phrase);
 assert.match(main,/globalThis\.fetch=async\(\)=>\{throw Error\('Network disabled:/);
 assert.match(main,/session\.defaultSession\.webRequest\.onBeforeRequest/);
 assert.match(main,/callback\(\{cancel:true\}\)/);
 assert(!pkg.build.files.some(x=>x.startsWith('cloud/')||x.startsWith('hub/')));
 assert.equal(pkg.build.extraResources.length,0);
 assert.deepEqual(JSON.parse(read('src/cloud-login-distribution.json')),{});
 assert.equal(pkg.scripts['prepack:windows'],undefined);
 assert.equal(pkg.scripts['prepack:portable'],undefined);
});
test('Synthetic laptop records and local-only demo account ship with the preview',()=>{
 for(const id of ['APX-10482','APX-10483','APX-10484','APX-10485','APX-10486','APX-10487','APX-10488','APX-10489','APX-10490'])assert(main.includes(id),id);
 assert.match(main,/mustChangePassword:false\},items:demoItems/);
 assert.match(html,/Offline demo · No live Supabase connection/);
 assert.match(html,/Demo records only · No cloud connections/);
});
test('Concept A redesign covers Dashboard, Inventory and Device Details without replacing their handlers',()=>{
 assert.match(html,/href="apex5-professional-preview\.css"/);
 assert.match(html,/<title>APEX 5\.0 Preview — Offline Demo<\/title>/);
 for(const id of ['dashboardPage','inventoryPage','assetPage','inventoryTable','assetEditor','assetJobProgress','mTotal','mTesting','topTheme'])assert(html.includes('id="'+id+'"'),id);
 for(const area of ['#dashboardPage .hero-banner','#dashboardPage .metric','#dashboardPage .apex-pulse','#inventoryPage #inventoryTable','#inventoryPage .inventory-quick-chip','#assetPage .v3-asset-tabs','#assetPage #apexAssetDetailsSection.flat-editor'])assert(css.includes(area),area);
 assert.match(css,/#appPage \.menu-item\.active/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(html,/src="app\.js"/);
 assert.match(html,/src="refurb-ui\.js"/);
 assert.match(html,/src="microdream-respray-ui\.js"/);
 assert.match(html,/src="dashboard-operations-v4120\.js"/);
 assert.match(html,/src="label-studio\.js"/);
});
