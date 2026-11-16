'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const cleaner=require('../src/smart-data-cleaner');
test('Standardises common laptop names while preserving IDs and workflow',()=>{
 const asset={id:'00064393',manufacturer:'hewlett packard',model:'HP PROBOOK 440 G8',processor:'intel core i5 1135g7',ram:'16gb ddr4',storage:'512gb nvme ssd',serial:'ab0-001',status:'Processed',pallet:'IR-552',parts:[{name:'keyboard'}]};
 const before=JSON.stringify(asset),{patch,changes}=cleaner.plan(asset);
 assert.deepEqual(patch,{manufacturer:'HP',model:'HP ProBook 440 G8',processor:'Intel Core i5-1135G7',ram:'16 GB DDR4',storage:'512 GB NVME SSD',serial:'AB0-001'});
 assert.equal(changes.length,6);
 assert.equal(JSON.stringify(asset),before);
 assert(!('id' in patch));assert(!('status' in patch));assert(!('pallet' in patch));assert(!('parts' in patch));
});
test('Lenovo ThinkPad E15 Gen 3 gets correct capitalisation',()=>{
 assert.equal(cleaner.model('Lenovo THINKPAD E15 GEN 3'),'Lenovo ThinkPad E15 Gen 3');
});
test('Notes correction is opt-in and leaves technical terms intact',()=>{
 const asset={id:'A1',notes:'screen scratched . needs checking',refurbNotes:'battery OK. usb-c intermittent'};
 assert.deepEqual(cleaner.plan(asset).patch,{});
 const patch=cleaner.plan(asset,{hardware:false,serial:false,notes:true}).patch;
 assert.equal(patch.notes,'Screen scratched. Needs checking');
 assert.equal(patch.refurbNotes,'Battery OK. Usb-c intermittent');
});
test('Serials are uppercased without guessing ambiguous digits',()=>{
 const {patch}=cleaner.plan({id:'A',serial:'pf0oi-01'}, {hardware:false,serial:true,notes:false});
 assert.equal(patch.serial,'PF0OI-01');
});
