'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../src/renderer');
const source=fs.readFileSync(path.join(root,'smart-workstation.js'),'utf8');
const markup=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'smart-workstation.css'),'utf8');
test('Workstation is a separate accessible sidebar view loaded after existing workflows',()=>{
 assert.match(markup,/data-page="workstation"/);
 assert.match(markup,/id="workstationPage"/);
 assert.match(markup,/id="wsScanForm"/);
 assert.match(markup,/id="wsScanInput"/);
 assert.match(markup,/id="wsCurrentAsset"/);
 assert.match(markup,/id="wsFocusMode"/);
 assert(markup.indexOf('src="refurb-ui.js"')<markup.indexOf('src="smart-workstation.js"'));
 assert(markup.indexOf('src="../bulk-refurb-plan.js"')<markup.indexOf('src="smart-workstation.js"'));
 assert.match(markup,/smart-workstation\.css/);
});
test('Barcode workstation relies on existing inventory and workflow APIs instead of creating duplicate records',()=>{
 assert.match(source,/api\.workflow\(\)/);
 assert.match(source,/api\.workflowAction\(command\)/);
 assert.match(source,/api\.update\(a\.id,\{pallet:destination\}\)/);
 assert.match(source,/window\.ApexOps\.receivePart/);
 assert.match(source,/window\.ApexOps\.fitPart/);
 assert.match(source,/window\.ApexOps\.quality/);
 assert.match(source,/window\.ApexOps\.printWorksheet/);
 assert.match(source,/openAssetPrintDialog\(selected\)/);
 assert.doesNotMatch(source,/api\.add\(/);
 assert.doesNotMatch(source,/localStorage\.setItem/);
});
test('Existing workflow guards and explicit confirmation are used for bulk orders and pallet moves',()=>{
 assert.match(source,/ApexBulkRefurbPlan/);
 assert.match(source,/expectedSignature:preview\.signature/);
 assert.match(source,/supplier:''/);
 assert.match(source,/confirm\('Move asset/);
 assert.match(source,/confirm\('Record all/);
 assert.match(source,/if\(!response\?\.ok\)throw Error/);
});
test('Engineer mode is reversible and the view uses responsive CSS',()=>{
 assert.match(css,/data-ws-focus="true"/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(source,/document\.documentElement\.removeAttribute\('data-ws-focus'\)/);
 assert.match(markup,/Finish &amp; scan next/);
 assert.match(markup,/it does not automatically approve QC/);
});
