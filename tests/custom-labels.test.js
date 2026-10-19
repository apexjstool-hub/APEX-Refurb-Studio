'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),labels=require('../src/custom-labels'),store=require('../src/label-studio-settings');
test('Templates, technicians and created QA date survive reopening; stale settings writes are blocked',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'apex-labels-test-')),file=path.join(root,'settings.json');try{
 let p=store.read(file);assert.equal(p.revision,0);p=store.save(file,{...p,expectedRevision:0,technicians:['Alex Morgan','alex morgan'],templates:[{id:'one',name:'Asset label',heading:'APEX',code:'qr',fields:['id','serial']}],lastQa:{technician:'Alex Morgan',serial:'',createdDate:'2026-10-19'}});
 const reloaded=store.read(file);assert.equal(reloaded.technicians.length,1);assert.equal(reloaded.lastQa.createdDate,'2026-10-19');assert.equal(reloaded.templates[0].fields[1],'serial');assert.throws(()=>store.save(file,{...p,expectedRevision:0}),/changed/);assert.throws(()=>labels.qa({technician:'',createdDate:'2026-10-19'}),/technician/);assert.throws(()=>labels.settings({technicians:['Alex\nNew']}));
 const cleared=store.save(file,{...reloaded,expectedRevision:reloaded.revision,lastQa:null});assert.equal(cleared.lastQa,null);assert.equal(store.read(file).lastQa,null);assert.deepEqual(cleared.technicians,reloaded.technicians);assert.deepEqual(cleared.templates,reloaded.templates);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('QA output has serial space, literal technician text, and the frozen creation date beneath the name',()=>{
 const html=labels.markup({},'qa','2x1',203,{qa:{technician:'Alex <Morgan>',serial:'',createdDate:'2026-10-19'}});assert(html.includes('SERIAL NUMBER')&&html.includes('&nbsp;'));assert(html.includes('Alex &lt;Morgan&gt;'));assert(html.indexOf('Alex &lt;Morgan&gt;')<html.indexOf('19/10/2026'));assert(!html.includes('Passed'));assert(!html.includes('>APEX<'));assert(html.includes('QUALITY ASSURANCE'));
 assert.throws(()=>labels.template({fields:['unknown']}));assert.throws(()=>labels.template({fields:['id','id']}));
});
test('Custom labels retain the existing QR / barcode geometry and escape device and template text',()=>{
 const c={TextEncoder,console};c.window=c;c.globalThis=c;vm.createContext(c);for(const f of ['asset-label-barcode.js','asset-label-qr.js','asset-label-print.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer',f),'utf8'),c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/custom-labels.js'),'utf8'),c);
 const record={id:'APX-101',model:'Dell <test>',serial:'SER-123'};for(const code of ['qr','barcode','none']){c.record=record;c.template={name:'Example',heading:'APEX <test>',fields:['id','model','serial'],code};const html=vm.runInContext("ApexCustomLabels.markup(record,'custom','2x1',203,{template})",c);assert(html.includes('Dell &lt;test&gt;')&&html.includes('APEX &lt;test&gt;'));assert.equal(html.includes('<svg'),code!=='none');}
});
