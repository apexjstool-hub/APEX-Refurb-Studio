'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const D=require('../src/label-designer');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Label Maker 2.0 exposes edge alignment, layering and barcode-only presets',()=>{
 const ui=read('src/renderer/label-designer-ui.js');
 for(const id of ['ldAlignLeft','ldAlignRight','ldAlignTop','ldAlignBottom','ldBringFront','ldSendBack','ldBarsCompact','ldBarsStandard','ldBarsFull'])assert(ui.includes('id="'+id+'"'),id+' must be present in inspector');
 assert.match(ui,/e\.barcodeWidthPct=widthPct;e\.barcodeHeightPct=heightPct/);
 assert.match(ui,/const order=front=>/);
 assert.match(ui,/checkpoint\(\)/);
 const css=read('src/renderer/label-designer-ui.css');
 assert.match(css,/ld-barcode-presets/);
});
test('Barcode bar size and caption font persist separately across save/print normalisation',()=>{
 const t=D.preset('text-barcode','60x40');
 const b=t.elements.find(e=>e.type==='barcode');
 b.barcodeWidthPct=60;b.barcodeHeightPct=45;b.fontSize=10;
 const saved=D.normalise(t);const printed=D.normalise(saved);
 const output=printed.elements.find(e=>e.type==='barcode');
 assert.equal(output.barcodeWidthPct,60);assert.equal(output.barcodeHeightPct,45);
 assert.equal(output.fontSize,10);assert.equal(output.human,true);
 assert.throws(()=>D.normalise({...t,elements:[{...b,barcodeWidthPct:101}]}),/Barcode width percentage/);
});
