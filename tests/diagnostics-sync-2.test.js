'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const {importDiagnostic}=require('../src/diagnostic-intake');
const {sanitise}=require('../src/diagnostic-tests');
const core=require('../src/inventory-core');
const first={id:'ASSET-515',model:'HP 250 G9',serial:'HP-515',tests:{
 keyboard:{status:'fail',comment:'Keys Q and W do not respond'},
 display:{status:'pass',comment:'LCD passed inspection'},
 camera:{status:'pass',comment:'Webcam functions'},
 audio:{status:'fail',comment:'Left speaker crackles'},
 physical:{status:'fail',comment:'Left USB-A does not work'},
 cosmetics:{status:'not-tested',comment:'Minor scuffs around corners'},
 bluetooth:{status:'unsupported',comment:'Adapter not fitted'}
}};
test('diagnostic importer stores every completed test and all technician comments',()=>{
 const items=[];const r=importDiagnostic(items,first);
 assert.equal(r.ok,true);assert.equal(Object.keys(r.item.diagnosticTests).length,7);
 assert.equal(r.item.diagnosticTests.keyboard.status,'fail');
 assert.equal(r.item.diagnosticTests.keyboard.comment,'Keys Q and W do not respond');
 assert.equal(r.item.diagnosticTests.display.status,'pass');
 assert.equal(r.item.diagnosticTests.cosmetics.status,'not-tested');
 assert.equal(r.item.diagnosticTests.bluetooth.status,'unsupported');
 assert.equal(core.normalize(r.item).diagnosticTests.keyboard.comment,'Keys Q and W do not respond');
});
test('same test results and notes do not create duplicate history; changed comments do',()=>{
 const items=[];let result=importDiagnostic(items,first);
 const count=result.item.history.length;
 result=importDiagnostic(items,first);
 assert.equal(result.action,'unchanged');
 assert.equal(result.item.history.length,count);
 const next={...first,tests:{keyboard:{status:'fail',comment:'Retested: W key not registering'}}};
 result=importDiagnostic(items,next);
 assert.equal(result.action,'updated');
 assert.equal(result.item.diagnosticTests.keyboard.comment,'Retested: W key not registering');
 assert.equal(result.item.diagnosticTests.display.status,'pass');
 assert.equal(result.item.history.filter(x=>x.type==='Diagnostic results').length,1); // first registration has a separate intake event
});
test('diagnostic results never overwrite manual refurbishment notes or job notes',()=>{
 const items=[];let result=importDiagnostic(items,{...first,refurbNotes:'Untrusted injection'});
 result.item.refurbNotes='MANUAL - order bottom case only';
 result.item.notes='DO NOT ERASE';
 result=importDiagnostic(items,{...first,tests:{keyboard:{status:'pass',comment:'Keyboard replaced and retested'}}});
 assert.equal(result.item.refurbNotes,'MANUAL - order bottom case only');
 assert.equal(result.item.notes,'DO NOT ERASE');
});
test('unknown keys, untested without comments and oversized notes are excluded or bounded',()=>{
 const raw=sanitise({keyboard:{status:'fail',comment:'x'.repeat(2500)},unknown:{status:'pass'},camera:{status:'not-tested',comment:''}});
 assert.equal(raw.keyboard.comment.length,1200);
 assert.ok(!raw.unknown);assert.ok(!raw.camera);
});
test('asset view has both engineer and refurbishment imported note targets',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../src/renderer/index.html'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'../src/renderer/app.js'),'utf8');
 assert.match(html,/id="apexDiagnosticEngineerNotes"/);
 assert.match(html,/id="apexDiagnosticRefurbNotes"/);
 assert.match(app,/function renderImportedTests/);
 assert.match(app,/apexDiagnosticRefurbNotes/);
 assert.match(app,/apexDiagnosticEngineerNotes/);
});
test('cloud migration uses separate status and comment while retaining original notes fields',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../cloud/diagnostics-sync-2-notes-migration.sql'),'utf8');
 assert.match(sql,/test_comment:=left/);
 assert.match(sql,/'comment',test_comment/);
 assert.match(sql,/test_status in \('pass','fail','unsupported'\)/);
});
