'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const D=require('../src/label-designer');
const source=fs.readFileSync(path.join(__dirname,'../src/renderer/label-designer-ui.js'),'utf8');
const encoders={ApexAssetBarcode:{code128Svg:()=>'<svg viewBox="0 0 100 30"><rect width="100" height="30"/></svg>'},ApexAssetLabelQR:{}};
test('barcode width and bar height percentages save in normalized designs and old templates default to 100%',()=>{
 const t=D.preset('barcode');
 const e=t.elements[0];
 assert.equal(e.barcodeWidthPct,100);
 assert.equal(e.barcodeHeightPct,100);
 e.barcodeWidthPct=75;e.barcodeHeightPct=50;e.fontSize=9;
 const saved=D.normalise(t);
 assert.equal(saved.elements[0].barcodeWidthPct,75);
 assert.equal(saved.elements[0].barcodeHeightPct,50);
 assert.equal(saved.elements[0].fontSize,9);
 const legacy=D.preset('barcode');delete legacy.elements[0].barcodeWidthPct;delete legacy.elements[0].barcodeHeightPct;
 assert.equal(D.normalise(legacy).elements[0].barcodeWidthPct,100);
 assert.equal(D.normalise(legacy).elements[0].barcodeHeightPct,100);
});
test('barcode bar sizes change without scaling the caption font or caption reserve',()=>{
 const e={...D.preset('barcode').elements[0],w:45,h:15,fontSize:9,value:'123456'};
 const full=D.geometry(e,{},203,encoders);
 const reduced=D.geometry({...e,barcodeWidthPct:60,barcodeHeightPct:50},{},203,encoders);
 assert(reduced.width<full.width);
 assert(reduced.height<full.height);
 assert.equal(reduced.human,full.human);
 assert.equal(e.fontSize,9);
 const html=D.markup({...D.preset('barcode'),elements:[{...e,barcodeWidthPct:60,barcodeHeightPct:50}]},{},203,encoders);
 assert.match(html,/class="ld-human">123456/);
});
test('barcode sizing controls are specific to barcode selection and caption remains a separate font field',()=>{
 assert(source.includes('Barcode width (% of box)'));
 assert(source.includes('Bar height (% of available space)'));
 assert(source.includes('data-ld-prop="barcodeWidthPct"'));
 assert(source.includes('data-ld-prop="barcodeHeightPct"'));
 assert(source.includes("e.type==='barcode'?'Caption text size':'Font size'"));
});
test('invalid barcode percentages are rejected to keep print layout predictable',()=>{
 const e=D.preset('barcode').elements[0];
 for(const pct of [-1,0,101,NaN])assert.throws(()=>D.normalise({...D.preset('barcode'),elements:[{...e,barcodeWidthPct:pct}]}));
});
