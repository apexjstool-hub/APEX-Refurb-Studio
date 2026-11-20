'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Asset Labels appear as a third Labels & Printing tab, existing Custom and QA tabs preserved',()=>{
 const nav=read('src/renderer/v3-ui.js'),html=read('src/renderer/index.html'),app=read('src/renderer/app.js');
 assert.match(nav,/\['labelStudio','Custom Asset Labels'\],\['assetLabels','Asset Labels'\],\['qaStickers','QA Stickers'\]/);
 for(const id of ['labelStudioPage','assetLabelsPage','qaStickersPage','assetLabelsContent'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/asset-labels-studio\.js/);assert.match(html,/asset-labels-studio\.css/);
 assert.match(app,/assetLabels:'Labels & Printing'/);
});
test('Asset Labels use offline Code 128, display asset number and manufacturer/model without APEX ASSET TAG heading',()=>{
 const code=read('src/renderer/asset-label-print.js');
 const context={window:{ApexAssetBarcode:{code128Svg:id=>'<svg viewBox="0 0 70 32"><rect width="2" height="32"/></svg>'},ApexAssetLabelQR:{deviceName:a=>a.model,qrCodeSvg:()=>'<svg viewBox="0 0 32 32"></svg>',makePayload:a=>a}},console};
 vm.createContext(context);
 vm.runInContext(code+'\nthis.output=makeLabelMarkup({id:"85543",manufacturer:"Dell",model:"Latitude 5420"},"assetDevice","2x1",203);',context);
 const label=context.output;
 assert.match(label,/apex-device-barcode-label/);
 assert.match(label,/apex-barcode-image/);
 assert.match(label,/85543/);
 assert.match(label,/Dell Latitude 5420/);
 assert.doesNotMatch(label,/APEX ASSET TAG/);
 assert.match(label,/shape-rendering|viewBox=/);
 vm.runInContext('this.original=makeLabelMarkup({id:"85543",manufacturer:"Dell",model:"Latitude 5420"},"asset","2x1",203);',context);
 assert.match(context.original,/APEX ASSET TAG/,'Original Asset Tag Barcode style is retained');
});
test('Asset Labels require saved device model, existing asset ID, and keep thermal PDF/print pipeline',()=>{
 const page=read('src/renderer/asset-label-page.js'),out=read('src/label-output.js'),ui=read('src/renderer/asset-labels-studio.js');
 assert.match(out,/\['asset','assetDevice','refurb','custom','qa'\]/);
 assert.match(out,/Device model is required for Asset Labels/);
 assert.match(page,/\['asset','assetDevice','refurb','custom','qa'\]/);
 assert.match(ui,/ApexAssetLabelQR\?\.readAssetId/);
 assert.match(ui,/items\.filter\(a=>!a\.deletedAt&&a\.id\)/);
 assert.match(ui,/type:'assetDevice'/);
 assert.match(ui,/api\.saveLabelPdf\(p\)/);assert.match(ui,/api\.printAssetLabel\(p\)/);
 assert.match(ui,/model\|\|'\)\.trim\(\)/);
 assert.doesNotMatch(ui,/core\.update\(|api\.update\(/,'Label creation must never modify inventory records');
});
