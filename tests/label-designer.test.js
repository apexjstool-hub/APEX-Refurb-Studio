'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),D=require('../src/label-designer'),settings=require('../src/custom-labels');
test('Text, barcode and combined presets centre their content on every supported stock',()=>{
 for(const size of Object.keys(D.sizes))for(const kind of ['text','barcode','text-barcode']){const t=D.preset(kind,size),[w,h]=D.sizes[size];for(const e of t.elements)assert(Math.abs(e.x+e.w/2-w/2)<.001);const top=Math.min(...t.elements.map(e=>e.y)),bottom=Math.max(...t.elements.map(e=>e.y+e.h));assert(Math.abs((top+bottom)/2-h/2)<.001);}
});
test('Saved designs preserve exact fonts, positions, arbitrary text and manual barcode values',()=>{
 const t=D.preset('text-barcode');Object.assign(t.elements[0],{value:'Hello\nWorld',font:'Georgia',bold:true,italic:true,fontSize:11,x:4,w:40});t.elements[1].value='Abc-123';const next=settings.settings({templates:[{id:'saved',...t}],technicians:['Alex'],lastQa:{}});assert.deepEqual(next.templates[0],{id:'saved',...D.normalise(t)});assert.equal(D.value('{assetId}: {model}',{id:'ASSET-1',model:'Latitude'}),'ASSET-1: Latitude');
 assert.throws(()=>D.normalise({...t,elements:[{...t.elements[0],x:50}]}),/beyond/);assert.throws(()=>D.normalise({...t,elements:[{...t.elements[0],fontSize:200}]}));assert.equal(D.normalise({...t,elements:[{...t.elements[0],font:'bad; display:none'}]}).elements[0].font,'Arial');assert.equal(D.fromLegacy({name:'Old text',fields:['id','serial'],code:'none'}).designerVersion,2);
});
test('Renderer uses safe literal text, integer-dot codes and original RefurbFlow payload',()=>{
 const c={TextEncoder,console};c.window=c;c.globalThis=c;vm.createContext(c);for(const f of ['asset-label-barcode.js','asset-label-qr.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer',f),'utf8'),c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/label-designer.js'),'utf8'),c);
 const t=D.preset('text-barcode');t.elements[0].value='<img src=x onerror=alert(1)>';t.elements[1].value='Abc-123';c.t=t;const html=vm.runInContext('ApexLabelDesigner.markup(t,{id:"LABEL"},203)',c);assert(!html.includes('<img')&&html.includes('&lt;img'));assert(html.includes('Abc-123'));for(const dpi of [203,300,600]){const g=c.ApexLabelDesigner.geometry(t.elements[1],{},dpi,c);assert(Number.isInteger(g.dots)&&g.dots>=1);assert(g.width<=t.elements[1].w);}
 const qr={...D.element('qr',50.8,25.4,'qr'),w:22,h:22,payload:'refurb'};const record={id:'APX-1',manufacturer:'Dell',model:'Latitude',serial:'SER'};assert.equal(c.ApexLabelDesigner.geometry(qr,record,203,c).content,c.ApexAssetLabelQR.makePayload(record));
});
