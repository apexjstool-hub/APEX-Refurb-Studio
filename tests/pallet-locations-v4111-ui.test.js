'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('src/renderer/index.html'),css=read('src/renderer/apex-pallets-v4111.css');
const register=read('src/renderer/inventory-workflow-ui.js'),locations=read('src/renderer/pallet-locations.js');
test('Pallets register shows live counts and preserves original actions',()=>{
 assert.match(html,/id="apexPalletOverview"/);
 assert.match(html,/apex-pallets-v4111\.css/);
 for(const token of ['Total pallets','Devices on pallets','In storage locations','Unassigned to location','apex-pallet-metric'])assert(register.includes(token),token);
 for(const action of ['data-pallet-show','data-pallet-rename','data-pallet-location','data-pallet-delete','apexCreatePallet'])assert(register.includes(action)||html.includes(action),action);
 assert.match(register,/if\(a\.deletedAt\)continue/);
});
test('Pallet Locations has summary, asset counts and a non-rerendering live search',()=>{
 for(const token of ['pl-overview','pl-metric','pl-device-count','plResultCount','data-pl-location','plSearchEmpty','applySearch'])assert(locations.includes(token),token);
 assert.match(locations,/\$\('plSearch'\)\.oninput=e=>\{query=e\.target\.value;applySearch\(\);\}/);
 assert.match(locations,/const devicesAt=name=>/);
 assert.match(locations,/if\(asset\.deletedAt\|\|!asset\.pallet\)continue/);
 assert.match(locations,/openLocation\(b\.dataset\.plView\)/);
});
test('Location contents and bulk movement have search controls without changing storage APIs',()=>{
 for(const token of ['plDetailSearch','plDetailMatches','data-pl-pallet-name','plMoveSearch','Select all visible pallets','data-pl-choice','data-pl-current'])assert(locations.includes(token),token);
 assert.match(locations,/const visible=\(\)=>boxes\.filter/);
 assert.match(locations,/for\(const b of visible\(\)\)b\.checked=all\.checked/);
 assert.match(locations,/api\.movePallets\(\{names,location:form\.elements\.location\.value,expected:/);
 assert.match(locations,/api\.deletePalletLocation/);
 assert.match(locations,/ApexMicrodreamRequests\.open/);
 assert.match(locations,/ApexPalletPage\.rename/);
});
test('Appearance works in original dark and minimal light modes without affecting label printing',()=>{
 assert.match(css,/#palletsPage/);
 assert.match(css,/#palletLocationDetailPage/);
 assert.match(css,/background:var\(--panel\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media print/);
 assert.match(html,/id="topTheme"/);
 assert.doesNotMatch(css,/api\.movePallets|workflowAction|fetch\(/);
});
