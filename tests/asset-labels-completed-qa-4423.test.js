'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {partition}=require('../src/renderer/completed-qa-core');
const labels=fs.readFileSync(path.join(__dirname,'../src/renderer/asset-labels-studio.js'),'utf8');
const qaUi=fs.readFileSync(path.join(__dirname,'../src/renderer/completed-qa-ui.js'),'utf8');
const a=[{id:'101',pallet:'IR-560',model:'Latitude',processor:'Intel Core i5',serial:'QA101',location:'Completed QA'},{id:'102',pallet:'IR-561',model:'EliteBook',processor:'AMD Ryzen',location:'Storage'}];
const p=partition(a,[]);
test('Completed QA records are archived from inventory without being deleted',()=>{
 assert.deepEqual(p.archived.map(a=>a.id),['101']);
 assert.deepEqual(p.active.map(a=>a.id),['102']);
 assert.equal(p.archived[0].processor,'Intel Core i5');
});
test('Asset Labels combines active inventory with Completed QA archive but does not mutate either',()=>{
 assert.match(labels,/ApexCompletedQAArchive\?\.assets/);
 assert.match(labels,/const activeInventory=/);
 assert.match(labels,/for\(const asset of \[\.\.\.archived\(\),\.\.\.activeInventory\(\)\]\)/);
 assert.match(labels,/const active=\(\)=>\{const unique=new Map/);
 assert.doesNotMatch(labels,/api\.(?:update|movePallets|archiveAsset|deleteAsset)\(/);
});
test('Asset Labels supports scanning and filtering Completed QA, preserving processor and label output',()=>{
 assert.match(labels,/Completed QA only/);
 assert.match(labels,/All assets \(including Completed QA\)/);
 assert.match(labels,/assetLabelsSource/);
 assert.match(labels,/Scan any asset barcode, including Completed QA/);
 assert.match(labels,/const asset=find\(raw\)/);
 assert.match(labels,/processor:a\.processor/);
 assert.match(labels,/serial:a\.serial/);
 assert.match(labels,/api\.printAssetLabel\(p\)/);
 assert.match(labels,/api\.saveLabelPdf\(p\)/);
});
test('Completed QA manifest opens the existing Asset Labels studio with selected QA ID',()=>{
 assert.match(qaUi,/data-qa-asset-label/);
 assert.match(qaUi,/ApexAssetLabels\?\.openForAsset/);
 assert.match(labels,/openForAsset\(id\)/);
});
