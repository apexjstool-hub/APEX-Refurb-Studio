'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const css=read('src/renderer/device-details-professional-v4119.css');
const html=read('src/renderer/index.html');
test('Device Details 3.0 stylesheet loads after existing UI styling and keeps the navy original summary',()=>{
 assert.match(html,/href="device-details-professional-v4119\.css"/);
 assert(html.indexOf('device-details-professional-v4119.css')>html.indexOf('device-summary-polish.css'));
 assert(html.indexOf('device-details-professional-v4119.css')>html.indexOf('pallets-locations-professional-v4118.css'));
 assert.doesNotMatch(css,/#assetSummary|device-card-bg|device-card-art|device-card-fact/);
 assert.match(read('src/renderer/device-summary-polish.css'),/--device-card-bg:#203a5b/);
});
test('Original asset editor fields and save controls are unchanged',()=>{
 for(const name of ['manufacturer','model','processor','gpu','operatingSystem','ram','ramType','storage','ssdType','batteryPercentage','serial','location','pallet','condition','sku','status','id'])assert(html.includes('name="'+name+'"'),name);
 for(const id of ['assetEditor','assetTopSave','assetBottomSave','assetCancel','apexDeviceSave','assetEditedHint','assetError'])assert(html.includes('id="'+id+'"'),id);
 assert.match(read('src/renderer/app.js'),/api\.update\(activeAssetId,data\)/);
 assert.match(read('src/renderer/app.js'),/api\.add\(data\)/);
 assert.match(css,/#assetPage \.flat-editor-heading/);
});
test('Device action bar, tabs, label printing and asset history survive',()=>{
 for(const id of ['apexDeviceActions','apexDeviceBack','apexDevicePrint','apexDeviceParts','deviceReturnInventory','assetSummary','assetActivity','assetAdvanced'])assert(html.includes('id="'+id+'"'),id);
 const js=read('src/renderer/apex-concept-b-device-details.js');
 assert.match(js,/\$\('assetPrintLabel'\)/);
 assert.match(js,/\[data-asset-tab="parts"\]/);
 assert.match(css,/#assetPage \.v3-asset-tabs/);
 assert.match(css,/#assetPage #assetActivity/);
});
test('Parts, Respray, QC, diagnostics and notes retain existing operation markup',()=>{
 for(const id of ['assetJobProgress','apexAssetDiagnosticsSection','apexAssetRefurbSection','apexAssetRepairsSection','refurbNotesSave','editRefurbNotes','opsPrintJob'])assert(html.includes('id="'+id+'"'),id);
 const ui=read('src/renderer/refurb-ui.js');
 assert.match(ui,/ApexDispatchStatus\?\.status\(job,ops\)/);
 assert.match(ui,/api\.workflowAction/);
 assert.match(css,/#assetPage #assetJobProgress \.device-repair-row/);
 assert.match(css,/#assetPage #assetJobProgress \.device-repair-qc/);
});
test('Styling is scoped and responsive, does not change printing or unrelated workspaces',()=>{
 for(const forbidden of ['#inventoryPage','#dispatchPage','#palletsPage','#refurbWorkspacePage','#labelStudioPage','#modalLayer'])assert(!css.includes(forbidden),forbidden);
 assert.doesNotMatch(css,/url\(|@import|display:none!important.*assetSummary/);
 assert.match(css,/@media\(max-width:750px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media print/);
 assert.match(html,/id="topTheme"/);
});
