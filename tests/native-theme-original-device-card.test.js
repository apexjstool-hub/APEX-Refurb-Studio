'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('src/renderer/index.html'),app=read('src/renderer/app.js'),device=read('src/renderer/apex-concept-b-device-details.css'),original=read('src/renderer/device-summary-polish.css');
test('Top bar contains only native dark/light theme switch',()=>{
 assert.match(html,/id="topTheme"/);
 assert.doesNotMatch(html,/id="apexDesignSwitch"/);
 assert.doesNotMatch(html,/src="apex-concept-b-toggle.js"/);
 assert.match(app,/dataset\.apexDesign=mode==='light'\?'minimal':'classic'/);
 assert.match(app,/dataset\.theme=mode/);
 assert.match(app,/\$\('topTheme'\)\.onclick/);
 assert.match(app,/apex-inventory-appearance-v1/);
});
test('Screenshot-style navy Device Summary layout remains the original in both modes',()=>{
 assert.match(original,/--device-card-bg:#203a5b/);
 assert.match(original,/--device-card-bg:#182b43/);
 assert.match(original,/#assetSummary \.device-card-art/);
 assert.match(original,/#assetSummary \.device-card-fact/);
 assert.doesNotMatch(device,/html\[data-apex-design="minimal"\] #assetPage #assetSummary/);
 assert.match(html,/id="assetSummary"/);
 assert.match(html,/id="assetPrintLabel"|assetSummary/);
});
test('All original Device Details actions remain available',()=>{
 for(const id of ['assetEditor','assetJobProgress','assetAdvanced','assetActivity','editRefurbNotes','apexAssetDiagnosticsSection'])assert(html.includes('id="'+id+'"'),id);
 assert.match(html,/id="apexDevicePrint"/);
 assert.match(html,/id="apexDeviceParts"/);
});
