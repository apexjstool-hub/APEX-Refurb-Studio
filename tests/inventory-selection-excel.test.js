'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const selection=fs.readFileSync(require('node:path').join(__dirname,'../src/renderer/inventory-selection.js'),'utf8');
const exporter=require('../src/refurb-export');
test('Inventory Reports menu exposes the professional Excel action without removing the print action',()=>{
 assert.match(selection,/data-selection-action="parts">Parts required report/);
 assert.match(selection,/data-selection-action="partsExcel">Export parts to Excel/);
 assert.match(selection,/kind==='inventory'&&name==='partsExcel'/);
 assert.match(selection,/api\.exportXlsx\(rows,'refurb-parts'\)/);
 assert.match(selection,/window\.ApexRefurbExport\.templatePartsRows\(devices\(kind\),window\.ApexWorkflowSnapshot/);
});
test('Selection-scoped Excel export retains ordered requirements, one row per asset and individual costs',()=>{
 const assets=[{id:'83253',manufacturer:'HP',model:'250 G9'},{id:'99999',manufacturer:'Dell',model:'Latitude 5540'}];
 const workflow={jobs:{'83253':{parts:[{name:'lcd panle',qty:1,status:'Ordered',cost:35},{name:'Rubber Foot Strip',qty:1,status:'Ordered',cost:2.5},{name:'Screen Bezel',qty:1,status:'Ordered',cost:15},{name:'Respray',qty:1,cost:20},{name:'Keyboard',qty:1,cost:22}]},'99999':{parts:[{name:'Battery',qty:1,cost:50}]}}};
 const rows=exporter.templatePartsRows(assets,workflow,['83253']);
 assert.equal(rows.length,2);
 assert.equal(rows[1][0],'83253');
 assert.equal(rows[0].length,18);
 assert.deepEqual([rows[1][6],rows[1][8],rows[1][10],rows[1][12],rows[1][14]],['LCD Panel','Rubber Foot Strip','Screen Bezel','Respray','Keyboard']);
 assert.deepEqual([rows[1][7],rows[1][9],rows[1][11],rows[1][13],rows[1][15]],[35,2.5,15,20,22]);
 assert.equal(exporter.templatePartsRows(assets,workflow,[]).length,1);
 const entries=require('../src/refurb-template-xlsx').readArchive(require('../src/refurb-template-xlsx').workbook(rows));
 const sheet=entries.get('xl/worksheets/sheet1.xml').toString();
 assert.ok(sheet.includes('83253')&&!sheet.includes('99999'));
 assert.ok(sheet.includes('SUM(H4,J4,L4,N4,P4)'));
});
