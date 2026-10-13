'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ZX=require('@zxing/library');
const dir=path.join(__dirname,'../src/renderer');
const c={TextEncoder,URLSearchParams,console};c.window=c;c.globalThis=c;vm.createContext(c);
for(const f of ['asset-label-qr.js','asset-label-barcode.js','asset-label-print.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),c);
function decode(svg,type){
 const b=svg.match(/viewBox="0 0 (\d+) (\d+)"/);const w=Number(b[1])*3,h=Number(b[2])*3;
 const pixels=new Uint8ClampedArray(w*h);pixels.fill(255);
 for(const m of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\//g)){
  const [x,y,rw,rh]=m.slice(1).map(Number);for(let row=y*3;row<(y+rh)*3;row++)for(let col=x*3;col<(x+rw)*3;col++)pixels[row*w+col]=0;
 }
 const reader=new ZX.MultiFormatReader();reader.setHints(new Map([[ZX.DecodeHintType.POSSIBLE_FORMATS,[type==='asset'?ZX.BarcodeFormat.CODE_128:ZX.BarcodeFormat.QR_CODE]]]));
 return reader.decode(new ZX.BinaryBitmap(new ZX.HybridBinarizer(new ZX.RGBLuminanceSource(pixels,w,h)))).getText();
}
const device={id:'APEX-AUTO-TEST-002',manufacturer:'HP',model:'ZBook Studio 16 inch G10 Mobile Workstation PC',serial:'ABC123456'};
test('printed barcode and RefurbFlow QR decode to their original identities',()=>{
 for(const type of ['asset','refurb']){
  const geometry=c.labelCodeGeometry(device,type,'50x25',203);
  assert(Number.isInteger(geometry.dots)&&geometry.dots>=1);
  const value=decode(geometry.svg,type);
  if(type==='asset')assert.equal(value,device.id);
  else{const payload=JSON.parse(value);assert.equal(payload.rf,1);assert.equal(payload.assetTag,device.id);assert.equal(payload.model,device.model);assert.equal(payload.serial,device.serial);}
 }
});
test('print layouts use isolated page, physical sizes and keep QR quiet zone',()=>{
 for(const size of ['50x25','50x30','60x40','40x30','80x30']){
  for(const type of ['asset','refurb']){
   const g=c.labelCodeGeometry(device,type,size,203);assert(g.mm<Number(size.split('x')[0]));
   const markup=c.makeLabelMarkup(device,type,size,203);assert(markup.includes('width="'+g.mm.toFixed(4)+'mm"'));assert(!markup.includes('apex-label-spec'));
  }
  assert(fs.readFileSync(path.join(dir,'asset-label-size-'+size+'.css'),'utf8').includes('margin:0'));
 }
 const b=c.makeLabelMarkup(device,'asset');assert(!b.includes('apex-barcode-name'));
 assert(!c.makeLabelMarkup({...device,id:'<img src=x>'},'refurb').includes('<img src=x>'));
 assert.equal(c.labelCodeGeometry(device,'refurb','60x40',203).dots>=c.labelCodeGeometry(device,'refurb','50x25',203).dots,true);
});
