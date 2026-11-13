'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Inventory 4.1.14 CSS is scoped to inventory only and keeps compact badges',()=>{
 const css=read('src/renderer/apex-inventory-refinement-v4114.css');
 assert.match(css,/#inventoryPage #inventoryTable \.apex-status-stack\{[^}]*flex-direction:row/);
 assert.match(css,/flex-wrap:wrap/);
 assert.match(css,/inventory-row-actions-menu/);
 assert.match(css,/\.inventory-view-controls/);
 assert.match(css,/@media\(max-width:780px\)/);
 assert.doesNotMatch(css,/#assetPage|#settingsPage|#refurbWorkspacePage/);
});
test('Original row delete event remains assigned before non-destructive menu enhancement',()=>{
 const app=read('src/renderer/app.js'),script=read('src/renderer/apex-inventory-refinement-v4114.js');
 assert.match(app,/\[data-delete-asset\]/);
 assert.match(app,/window\.ApexInventoryRefinement\?\.decorate\(\)/);
 assert.match(script,/options\.appendChild\(button\)/);
 assert.match(script,/if\(button\.closest\('\.inventory-row-actions-menu'\)\)continue/);
 assert.match(script,/details/);
 assert.doesNotMatch(script,/deleteAsset\(|\.remove\(\)/);
});
test('Saved views and stock inventory toolbar are preserved',()=>{
 const html=read('src/renderer/index.html'),views=read('src/renderer/inventory-saved-views.js'),script=read('src/renderer/apex-inventory-refinement-v4114.js');
 assert.match(html,/apex-inventory-refinement-v4114\.css/);
 assert.match(html,/apex-inventory-refinement-v4114\.js/);
 assert.match(views,/window\.ApexInventoryRefinement\?\.decorate\(\)/);
 assert.match(script,/toolbar\.appendChild\(views\)/);
 for(const id of ['inventorySearch','locationFilter','gradeFilter','statusFilter','invAdd','inventoryTable'])assert(html.includes('id="'+id+'"'),id);
});
