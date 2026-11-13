'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('src/renderer/index.html'),css=read('src/renderer/apex-concept-b-device-details.css'),js=read('src/renderer/apex-concept-b-device-details.js');
test('Device Details 2.0 loads only on Concept B and retains Classic styling',()=>{
 assert.match(html,/apex-concept-b-device-details\.css/);
 assert.match(html,/apex-concept-b-device-details\.js/);
 assert.match(css,/html\[data-apex-design="minimal"\] #assetPage/);
 assert.match(css,/html:not\(\[data-apex-design="minimal"\]\) #assetPage #apexDeviceActions\{display:none!important\}/);
 assert.match(html,/id="topTheme"/);
});
test('device action bar reuses existing app actions and forms',()=>{
 for(const id of ['apexDeviceActions','apexDeviceBack','apexDevicePrint','apexDeviceParts','apexDeviceSave'])assert(html.includes('id="'+id+'"'),id);
 assert.match(html,/type="submit" form="assetEditor" id="apexDeviceSave"/);
 assert.match(js,/\$\('deviceReturnInventory'\)\?\.click\(\)/);
 assert.match(js,/\$\('assetPrintLabel'\)/);
 assert.match(js,/\[data-asset-tab="parts"\]/);
 assert.match(js,/const isNew=!activeAssetId/);
 assert.doesNotMatch(js,/api\.update|api\.add|fetch\(|workflowAction/);
});
test('existing device form fields, tabs and edit notes are preserved',()=>{
 for(const field of ['manufacturer','model','processor','gpu','operatingSystem','ram','ramType','storage','ssdType','batteryPercentage','serial','pallet','condition','sku','status','id'])assert(html.includes('name="'+field+'"'),field);
 for(const id of ['assetEditor','assetActivity','assetAdvanced','assetJobProgress','apexAssetDiagnosticsSection','apexAssetRefurbSection','refurbNotesSave','editRefurbNotes'])assert(html.includes('id="'+id+'"'),id);
 assert.match(css,/#assetPage \.v3-asset-tabs/);
 assert.match(css,/#assetPage \.v34-editor-columns/);
 assert.match(css,/#assetPage #assetJobProgress/);
});
test('responsive and accessible layout respects existing print settings',()=>{
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(css,/@media print/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
