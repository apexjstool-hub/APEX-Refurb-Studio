'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const css=read('src/renderer/pallets-locations-professional-v4118.css');
const html=read('src/renderer/index.html');
test('Pallet professional UI stays scoped to pallet, pallet-location and scanner pages',()=>{
 for(const sel of ['#palletsPage','#palletLocationsPage','#palletLocationDetailPage','#bulkPage'])assert(css.includes(sel),sel);
 for(const sel of ['#inventoryPage','#dispatchPage','#assetPage','#refurbWorkspacePage','#labelStudioPage','#modalLayer'])assert(!css.includes(sel),'unexpected style change '+sel);
 assert.match(css,/@media\(max-width:740px\)/);assert.match(css,/var\(--text\)/);
});
test('All original pallet and location controls remain present',()=>{
 const j=read('src/renderer/pallet-locations.js');
 for(const id of ['plSearch','plAddLocation','plMove','plDetailSearch','plBackToLocations','plCreateMicrodreamOrder'])assert(j.includes(id),id);
 for(const id of ['data-pl-rename','data-pl-move','data-pl-remove-pallet','data-pl-inventory','data-pl-report','data-pl-respray'])assert(j.includes(id),id);
 assert.match(j,/ApexMicrodreamRespray\?\.open/);
 assert.match(j,/ApexPalletPage\.rename/);
 assert.match(j,/ApexPalletPage\.remove/);
 assert.match(j,/ApexPalletStatusPolish\?\.refresh/);
});
test('Original scan forms, batch device list and focus controls remain intact',()=>{
 for(const id of ['v346ScanInput','v346ScanForm','v346DeviceList','v346Clear','v346ScanStatus'])assert(html.includes('id="'+id+'"'),id);
 assert.match(css,/#bulkPage #v346ScanInput/);
});
test('Microdream badges read workflow records and do not write dispatch or completion states',()=>{
 const script=read('src/renderer/pallets-microdream-status-v4118.js');
 assert.match(script,/resprayPallets/);
 assert.match(script,/data-pl-respray/);
 assert.match(script,/Sent for respray/);
 assert.match(script,/Returned — inspect/);
 assert.match(script,/Respray completed/);
 assert.match(script,/window\.apexInventory\?\.workflow/);
 assert.doesNotMatch(script,/workflowAction\(|createPallet\(|deletePallet\(|localStorage|api\.movePallets\(/);
});
test('Styles and status enhancement load after existing workflow scripts without replacing them',()=>{
 assert.match(html,/href="pallets-locations-professional-v4118\.css"/);
 assert(html.indexOf('pallets-locations-professional-v4118.css')>html.indexOf('apex-pallets-v4111.css'));
 assert.match(html,/src="pallets-microdream-status-v4118\.js"/);
 assert(html.indexOf('pallets-microdream-status-v4118.js')<html.indexOf('pallet-locations.js'));
 assert.match(html,/src="microdream-respray-ui\.js"/);
 assert.match(html,/src="dispatch-centre-v4116\.js"/);
});
