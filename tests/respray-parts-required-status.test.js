'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/renderer/refurb-ui.js'),'utf8');
const work=require('../src/repair-work-type');
test('cosmetic work is identified consistently with repair workflow',()=>{
 assert.equal(work.isCosmetic('Full respray'),true);
 assert.equal(work.isCosmetic('Keyboard respray'),true);
 assert.equal(work.isCosmetic('LCD replacement'),false);
});
test('respray in expanded Parts Required uses respray wording, not Needs ordering',()=>{
 const part=source.slice(source.indexOf('function partProgress(p){'),source.indexOf('function partOrderControl('));
 assert.match(part,/Awaiting respray/);
 assert.match(part,/Sent for respray/);
 assert.match(part,/Respray returned/);
 assert.match(part,/Respray checked/);
 assert.match(part,/Needs ordering/);
 assert.match(part,/cosmetic\?/);
});
test('respray action records dispatch using existing respray-specific workflow',()=>{
 const part=source.slice(source.indexOf('function partOrderControl('),source.indexOf('async function markPartOrdered('));
 assert.match(part,/btn\('Record sent','sendCosmetic'/);
 assert.match(part,/Sent for respray/);
 assert.match(part,/btn\('Mark as ordered','markPartOrdered'/);
 assert.match(source,/if\(op==='sendCosmetic'\)\{cosmeticSendModal\(id\)/);
});
