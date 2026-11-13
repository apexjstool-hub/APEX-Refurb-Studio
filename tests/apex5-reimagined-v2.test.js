'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('src/renderer/index.html');
const css=read('src/renderer/apex5-reimagined-v2.css');
const js=read('src/renderer/apex5-reimagined-v2.js');
test('Preview 2 actually rearranges Dashboard structure rather than just recolouring cards',()=>{
 assert.match(html,/id="dashboardPage" class="ap5-v2-dashboard"/);
 assert.match(html,/class="ap5-v2-command-grid"/);
 assert.match(html,/class="ap5-v2-briefing"/);
 assert.match(html,/class="ap5-v2-briefing-list"/);
 assert.match(html,/class="ap5-v2-section-overline"/);
 assert.match(css,/#dashboardPage \.ap5-v2-command-grid\{display:grid;grid-template-columns/);
 for(const target of ['data-ap5-action="inventory"','data-ap5-action="parts"','data-ap5-action="qc"'])assert(html.includes(target),target);
 for(const id of ['mTotal','mReady','mTesting','mRepair','locationSummary','gradeSummary','recentTable'])assert(html.includes('id="'+id+'"'),id);
});
test('Preview 2 restructures Inventory with real sidebar and unchanged assets register',()=>{
 assert.match(html,/class="ap5-v2-register-layout"/);
 assert.match(html,/class="ap5-v2-register-rail"/);
 assert.match(html,/class="ap5-v2-register-main"/);
 assert.match(html,/class="ap5-v2-rail-nav"/);
 assert.match(css,/#inventoryPage \.ap5-v2-register-layout\{display:grid;grid-template-columns/);
 for(const id of ['inventorySearch','locationFilter','gradeFilter','statusFilter','inventoryTable','invAdd','invScan','apexInventoryDensity'])assert(html.includes('id="'+id+'"'),id);
});
test('Device Details now has a real summary rail and main editor pane, retaining all form IDs',()=>{
 assert.match(html,/class="ap5-v2-device-grid"/);
 assert.match(html,/class="ap5-v2-device-rail"/);
 assert.match(html,/class="ap5-v2-device-main"/);
 assert.match(html,/class="ap5-v2-edit-section-title"/);
 assert.match(css,/#assetPage \.ap5-v2-device-grid\{display:grid;grid-template-columns/);
 for(const id of ['assetSummary','assetEditor','assetJobProgress','apexAssetDiagnosticsSection','apexAssetRefurbSection','apexAssetRepairsSection','apexDeviceSave','assetBottomSave','assetActivity','assetAdvanced'])assert(html.includes('id="'+id+'"'),id);
 assert.match(html,/form="assetEditor"/);
});
test('Demo preview remains separately installed, offline, and excludes cloud and hub workers',()=>{
 const pkg=JSON.parse(read('package.json')),main=read('src/main.js');
 assert.equal(pkg.version,'5.0.0-preview.2');
 assert.equal(pkg.build.appId,'com.apex.management.preview5');
 assert.equal(pkg.build.productName,'APEX Management Studio 5 Preview');
 assert.match(main,/app\.setPath\('userData',previewUserData\)/);
 assert.match(main,/globalThis\.fetch=async\(\)=>\{throw Error\('Network disabled/);
 assert.match(main,/callback\(\{cancel:true\}\)/);
 assert(!pkg.build.files.some(x=>x.startsWith('hub/')||x.startsWith('cloud/')));
 assert.equal(pkg.build.publish,undefined);
});
test('New action cards navigate using existing setPage, never write inventory or workflow',()=>{
 assert.match(js,/setPage\(route\)/);
 assert.match(js,/parts:'parts'/);
 assert.match(js,/qc:'qc'/);
 assert.doesNotMatch(js,/fetch\(|workflowAction\(|api\.update\(|api\.add\(|localStorage/);
 assert.match(html,/src="apex5-reimagined-v2\.js"/);
 assert.match(html,/href="apex5-reimagined-v2\.css"/);
 assert(html.indexOf('apex5-reimagined-v2.css')>html.indexOf('apex5-professional-preview.css'));
 assert.match(css,/@media\(max-width:1100px\)/);
 assert.match(css,/@media\(max-width:830px\)/);
});
