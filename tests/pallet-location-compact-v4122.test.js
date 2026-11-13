'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const js=read('src/renderer/pallet-locations.js'),css=read('src/renderer/pallet-location-compact-v4122.css'),html=read('src/renderer/index.html');
test('Compact detail has inline live pallet and laptop counts without redundant summary panels',()=>{
 assert.match(js,/class="pl-inline-metrics"/);
 assert.match(js,/\$\{list\.length\}/);
 assert.match(js,/\$\{total\}/);
 assert.doesNotMatch(js,/class="pl-location-summary"/);
 assert.match(css,/#palletLocationDetailPage \.pl-inline-metrics/);
 assert.match(css,/#palletLocationDetailPage \.pl-detail-toolbar/);
});
test('View inventory stays visible and Actions dropdown retains ALL original data action attributes',()=>{
 assert.match(js,/class="pl-view-inventory" data-pl-inventory/);
 assert.match(js,/data-pl-actions-toggle/);
 for(const action of ['data-pl-report','data-pl-respray','data-pl-rename','data-pl-move','data-pl-remove-pallet'])assert(js.includes(action),action);
 for(const control of ['View report','Respray QR / status','Rename pallet','Move pallet','Delete empty pallet'])assert(js.includes(control),control);
 assert.match(js,/window\.ApexMicrodreamRequests\.view/);
 assert.match(js,/window\.ApexMicrodreamRespray\?\.open/);
 assert.match(js,/window\.ApexPalletPage\.rename/);
 assert.match(js,/window\.ApexPalletPage\.remove/);
 assert.match(js,/openInventory\(a\.dataset\.plInventory\)/);
 assert.match(js,/move\(\[b\.dataset\.plMove\]\)/);
});
test('Dropdown is interactive, accessible and not clipped by horizontal table scrolling',()=>{
 assert.match(js,/aria-haspopup="true"/);
 assert.match(js,/aria-expanded="false"/);
 assert.match(js,/document\.body\.appendChild\(popup\)/);
 assert.match(js,/popup\.style\.left/);
 assert.match(js,/popup\.style\.top/);
 assert.match(js,/document\.addEventListener\('click'/);
 assert.match(js,/event\.key==='Escape'/);
 assert.match(js,/toggle\.setAttribute\('aria-expanded','true'\)/);
 assert.match(js,/popup\.addEventListener\('click'/);
 assert.match(css,/\.pl-actions-popup\{position:fixed/);
 assert.match(css,/\.pl-actions-popup\[hidden\]\{display:none!important\}/);
});
test('Microdream purchase-order selection bar is hidden until at least one pallet is selected',()=>{
 assert.match(js,/id="plCompactSelection"/);
 assert.match(js,/jobSelection\.size\?'hidden':''/);
 assert.match(js,/\$\('plCompactSelection'\)\.hidden=!selected\.length/);
 assert.match(js,/\$\('plCreateMicrodreamOrder'\)\.disabled=!selected\.length\|\|!devices/);
 assert.match(js,/window\.ApexMicrodreamRequests\.open\(\[\.\.\.jobSelection\]\)/);
 assert.match(js,/data-pl-job-select/);
 assert.match(js,/plSelectJobPallets/);
 assert.match(css,/#palletLocationDetailPage \.md-pallet-selection\[hidden\]\{display:none!important\}/);
});
test('Pallet search, refresh, moves and deletion retain the existing flow and database calls',()=>{
 for(const id of ['plBackToLocations','plLocationRefresh','plDetailSearch','plDetailMatches','plCreateMicrodreamOrder'])assert(js.includes(id),id);
 assert.match(js,/\$\('plLocationRefresh'\)\.onclick=async/);
 assert.match(js,/detailSearch\.oninput=filter/);
 assert.match(js,/api\.movePallets\(/);
 assert.match(js,/window\.ApexDeleteControls\?\.decorate\(detail\)/);
 assert.match(js,/window\.ApexPalletStatusPolish\?\.refresh\(\)/);
 assert.match(js,/ApexPalletLocations=\{render:/);
});
test('Styles are scoped to location details; existing theme and routes still load',()=>{
 assert.match(html,/href="pallet-location-compact-v4122\.css"/);
 assert(html.indexOf('pallet-location-compact-v4122.css')>html.indexOf('pallets-locations-professional-v4118.css'));
 assert.match(css,/var\(--panel2\)/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 for(const unrelated of ['#assetPage','#dispatchPage','#refurbWorkspacePage','#reportsPage','#inventoryPage'])assert(!css.includes(unrelated),unrelated);
 assert.match(html,/id="topTheme"/);
});
