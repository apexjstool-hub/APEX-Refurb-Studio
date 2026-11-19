'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Refurbishment preview retains dedicated bulk, purchasing, QC and queue views',()=>{
 const html=read('src/renderer/index.html'),js=read('src/renderer/refurb-workspace.js');
 for(const id of ['queue','bulk','purchasing','qc','completed'])assert.match(html,new RegExp('data-rw-view="'+id+'"'));
 assert.match(html,/id="rwBulkPanel"/);
 assert.match(html,/id="rwBulkOpen"/);
 assert.match(html,/id="rwBulkSelected"/);
 assert.match(js,/ApexBulkRefurb\.open\(\[\.\.\.selected\]\)/);
 assert.match(js,/ApexBulkRefurb\.open\(\)/);
 assert.match(js,/Open device/);
 assert.doesNotMatch(js,/data-rw-expand/);
 assert.match(html,/data-rw-purchase="deliveries"/);
 assert.match(html,/id="rwLaneView"/); // old navigation links safely retained
});
test('Device Details has one visible repair view, Undo Fitted and respray still exist',()=>{
 const ui=read('src/renderer/refurb-ui.js');
 assert.match(ui,/function renderAsset\(\)/);
 assert.match(ui,/renderSeparatedAsset\(\)/);
 assert.doesNotMatch(ui,/div\.innerHTML=repairViewControl\(false\)/);
 assert.match(ui,/btn\('Undo Fitted','undoFit'/);
 assert.match(ui,/Check returned respray/);
});
test('Preview installer and user data do not share the production identity',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.equal(pkg.build.appId,'com.apex.inventory.refurb43preview');
 assert.equal(pkg.build.productName,'APEX Refurb 4.3 Preview');
 assert.match(pkg.build.win.artifactName,/Preview-Setup/);
 const main=read('src/main.js');
 assert.match(main,/app\.setPath\('userData',[^\n]*APEX Refurb 4\.3 Preview/);
 assert.match(main,/Shared cloud and Hub inventory are disabled/);
 assert.match(main,/Preview is demo-only/);
 assert.match(main,/demoJobs=/);
});
