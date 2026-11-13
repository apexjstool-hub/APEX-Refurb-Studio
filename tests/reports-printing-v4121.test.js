'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('src/renderer/index.html'),preview=read('src/renderer/report-preview.html');
const css=read('src/renderer/reports-professional-v4121.css'),screen=read('src/renderer/report-preview-professional-v4121.css');
test('Reports UI 3.0 builds on previous Reports and A4 system without changing form handlers',()=>{
 assert.match(html,/href="reports-professional-v4121\.css"/);
 assert(html.indexOf('reports-professional-v4121.css')>html.indexOf('apex-report-admin-v4112.css'));
 for(const id of ['reportsPage','reportTotal','reportProcessed','reportAwaiting','v3ReportsWorkspace','apexReportMore','reportExport','reportPrint','reportJobSheet','reportPartsSheet','reportLocationSummary'])assert(html.includes('id="'+id+'"'),id);
 const ui=read('src/renderer/v3-ui.js');
 for(const tab of ['worksheet','refurb-parts','qc','inventory'])assert(ui.includes("'"+tab+"'"),tab);
 assert.match(ui,/data-report-tab/);assert.match(ui,/v3ExcelReport/);assert.match(ui,/v3PrintReport/);
});
test('Report styling touches report page only and preserves dark/light design tokens',()=>{
 assert.match(css,/#reportsPage \.v3-report-tabs/);assert.match(css,/#reportsPage \.report-card/);
 assert.match(css,/@media\(max-width:640px\)/);assert.match(css,/var\(--panel2\)/);
 for(const id of ['#inventoryPage','#assetPage','#dispatchPage','#palletsPage','#refurbWorkspacePage','#settingsPage'])assert(!css.includes(id),'unexpected page style '+id);
});
test('A4 preview remains CSP safe and print barcode widths are not modified',()=>{
 assert.match(preview,/href="report-preview-professional-v4121\.css"/);
 assert.match(preview,/href="report-asset-barcode\.css"/);
 assert.match(preview,/style-src 'self'/);
 assert.match(screen,/@media screen/);assert.match(screen,/@media print/);
 assert.doesNotMatch(screen,/\.apex-report-bars>svg.*width/);
 assert.doesNotMatch(screen,/\.apex-report-bars>svg.*height/);
 assert.doesNotMatch(screen,/@page\s*\{/);
 const barcodeCss=read('src/renderer/report-asset-barcode.css');
 assert.match(barcodeCss,/height:7mm/);assert.match(barcodeCss,/width:auto!important/);
});
test('Existing reports retain Code 128 barcodes, Microdream print paths and Excel and notes',()=>{
 const app=read('src/renderer/app.js'),refurb=read('src/renderer/refurb-ui.js');
 assert.match(app,/ApexReportBarcode\.td\(a\.id,window\.ApexAssetBarcode\)/);
 assert.match(refurb,/ApexReportBarcode\.printStyles/);
 assert.match(html,/src="microdream-request-ui\.js"/);
 assert.match(html,/src="microdream-respray-ui\.js"/);
 assert.match(html,/src="label-designer-ui\.js"/);
 assert.match(html,/id="topTheme"/);
});
