'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../src/renderer/inventory-selection.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../src/renderer/inventory-header-compact.css'),'utf8');
test('inventory quick filters reuse the existing repairFilter rather than altering inventory data',()=>{
 assert.match(src,/id='inventoryQuickFilters'/);
 assert.match(src,/control=\$\('repairFilter'\)/);
 assert.match(src,/data-quick-repair/);
 assert.match(src,/dispatchEvent\(new Event\('change'/);
});
test('quick chips include useful purchasing and respray counts',()=>{
 for(const label of ['All devices','Needs ordering','Needs respray','Parts ordered','Completed','On hold'])assert(src.includes(label));
 assert.match(src,/s\.needsOrdering>0/);
 assert.match(src,/s\.sprayOutstanding/);
 assert.match(src,/s\.awaitingDelivery>0/);
});
test('existing filter controls retained in the Advanced filters menu',()=>{
 for(const id of ['locationFilter','gradeFilter','statusFilter','palletFilter','repairFilter','apexInventoryDensity'])assert(src.includes(id));
 assert(src.includes('Advanced filters'));
 assert(src.includes('inventoryActiveFilters'));
 assert(src.includes('data-clear-filter'));
});
test('compact header and quick chips are scoped to Inventory only',()=>{
 assert.match(css,/#inventoryPage #selection-toolbar-inventory/);
 assert.match(css,/#inventoryPage \.inventory-quick-filters/);
 assert.match(css,/#inventoryPage \.inventory-active-filters/);
});
