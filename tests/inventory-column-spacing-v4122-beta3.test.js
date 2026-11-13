'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const css=read('src/renderer/inventory-column-spacing-v4122-beta3.css');
test('Inventory all-devices table fills available horizontal room instead of auto-packing',()=>{
 assert.match(css,/#inventoryPage #inventoryTable\{width:100%!important/);
 assert.match(css,/table-layout:fixed!important/);
 assert.match(css,/min-width:0!important/);
 assert.doesNotMatch(css,/min-width:1360px!important/);
 assert.match(css,/:has\(>thead>tr>th:nth-child\(10\):last-child\)/);
 const widths=[3.5,6.5,15,9,9,10,8,24,10,5];
 assert.equal(widths.reduce((a,b)=>a+b,0),100);
 widths.forEach((w,i)=>assert(css.includes('>thead>tr>th:nth-child('+(i+1)+'){width:'+w+'%!important}'),'column '+(i+1)));
});
test('Repair, waiting, identity and actions remain visible and support narrow windows',()=>{
 for(const v of ['.inventory-repair-cell','.inventory-waiting-cell','.inventory-waiting-heading','.v32-row-actions','.apex-device-identity','.apex-status-stack'])assert(css.includes(v),v);
 assert.match(css,/overflow-x:hidden!important/);
 assert.match(css,/flex-wrap:wrap!important/);
 assert.match(css,/@media\(max-width:1200px\)/);
});
test('No unrelated page or data actions are modified',()=>{
 const html=read('src/renderer/index.html');
 assert.match(html,/inventory-column-spacing-v4122-beta3\.css/);
 assert(html.indexOf('inventory-column-spacing-v4122-beta3.css')>html.indexOf('apex-inventory-refinement-v4114.css'));
 for(const id of ['#palletLocationDetailPage','#dispatchPage','#refurbWorkspacePage','#reportsPage','#assetPage'])assert(!css.includes(id),id);
 assert.doesNotMatch(css,/display:none!important|url\(/);
 for(const original of ['inventorySearch','inventoryTable','invAdd','topTheme'])assert(html.includes(original),original);
});
