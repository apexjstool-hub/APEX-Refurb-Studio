'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
// Guard that this phase remains presentation-only and preserves
// event-bearing asset links, repair status and waiting column ordering.
const inventory=fs.readFileSync(path.join(__dirname,'../src/renderer/inventory-workflow-ui.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../src/renderer/inventory-status-polish.css'),'utf8');
test('inventory combines model and asset reference without rewriting records',()=>{
 assert.match(inventory,/className='apex-device-identity'/);
 assert.match(inventory,/nameLine.appendChild\(model\)/);
 assert.match(inventory,/identifier.appendChild\(assetButton\)/);
 assert.match(inventory,/details.appendChild\(secondary\)/);
 assert.match(inventory,/nameCell.remove\(\)/);
});
test('inventory retains repair progress, time waiting and final delete ordering',()=>{
 assert.match(inventory,/progress.textContent='Repair progress'/);
 assert.match(inventory,/waitingHeader.textContent='Time waiting'/);
 assert.match(inventory,/row.insertBefore\(cell,row.lastElementChild\)/);
 assert.match(inventory,/row.insertBefore\(waiting,row.lastElementChild\)/);
 assert.match(css,/v32-row-actions/);
});
test('asset id and serial remain accessible, with no app-wide style overrides',()=>{
 assert.match(css,/#inventoryPage #inventoryTable \.apex-device-identity/);
 assert.match(css,/#inventoryPage #inventoryTable \.apex-device-number/);
 assert.match(css,/#inventoryPage #inventoryTable \.apex-device-serial/);
});
