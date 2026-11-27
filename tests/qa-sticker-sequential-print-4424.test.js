'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const labels=require('../src/custom-labels');

function setup(overrides={}){
 const nodes=new Map(), get=id=>{
  if(!nodes.has(id))nodes.set(id,{id,value:({qaSize:'2x1',qaDpi:'203',qaCopies:'1'})[id]||'',disabled:false,isConnected:true,textContent:'',dataset:{},style:{},innerHTML:'',src:'',srcdoc:'',onload:null,removeAttribute(){},focus(){}});
  return nodes.get(id);
 };
 const prints=[],pdfs=[],messages=[];let saved={technicians:['JAMIE SALE'],templates:[],revision:0,lastQa:null};
 const api={
  async labelStudioSettings(input){
   if(input.action==='get')return {ok:true,settings:{...saved}};
   if(overrides.save)await overrides.save(input);
   if(input.expectedRevision!==saved.revision)throw Error('Stale settings');
   saved={technicians:input.technicians,templates:input.templates,revision:saved.revision+1,lastQa:input.lastQa??null};
   return {ok:true,settings:{...saved}};
  },
  async printAssetLabel(payload){prints.push(structuredClone(payload));return overrides.print?overrides.print(payload):{ok:true};},
  async saveLabelPdf(payload){pdfs.push(structuredClone(payload));return overrides.pdf?overrides.pdf(payload):{ok:true};}
 };
 const window={
  ApexCustomLabels:labels,
  ApexLabelDesignerUI:{render(){}},
  ApexDeleteControls:{decorate(){}}
 };
 let currentPage='qaStickers';
 const ctx={window,URL,location:{href:'file:///app/index.html'},APEX_LABEL_SIZES:{'2x1':[50.8,25.4]},ApexCustomLabels:labels,api,
  $:get,notify(message){messages.push(message);},currentPage,setPage(page){ctx.currentPage=page;return true;},
  showModal(){},closeModal(){},console};
 vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer/label-studio.js'),'utf8'),ctx);
 return {get,ctx,prints,pdfs,messages,saved:()=>saved,recreate(){for(const n of nodes.values())n.isConnected=false;nodes.clear();}};
}

async function tick(){await new Promise(resolve=>setImmediate(resolve));}
test('QA sticker printing works for a second different serial even if iframe never calls onload',async()=>{
 const h=setup();
 assert.equal(h.ctx.window.ApexLabelStudio.open('qaStickers'),true);
 await tick();
 const tech=h.get('qaTechnician'),serial=h.get('qaSerial');
 tech.value='JAMIE SALE';tech.onchange();
 serial.value='118PFL3';serial.oninput();
 assert.equal(h.get('qaPrint').disabled,true,'draft must never be printed without Create sticker');
 await h.get('qaCreate').onclick();
 assert.equal(h.get('qaPrint').disabled,false,'first saved sticker must be printable');
 await h.get('qaPrint').onclick();await tick();
 assert.equal(h.prints.length,1);assert.equal(h.prints[0].qa.serial,'118PFL3');
 serial.value='9ABX772';serial.oninput();
 assert.equal(h.get('qaPrint').disabled,true,'editing serial invalidates previously saved sticker');
 await h.get('qaCreate').onclick();
 assert.equal(h.get('qaPrint').disabled,false,'second sticker must not be stuck disabled after Create sticker');
 await h.get('qaPrint').onclick();await tick();
 assert.equal(h.prints.length,2);
 assert.equal(h.prints[1].qa.serial,'9ABX772');
 assert.equal(h.prints[1].qa.technician,'JAMIE SALE');
 assert.equal(h.prints[0].qa.createdDate,h.prints[1].qa.createdDate,'each creation freezes its date');
 assert.equal(h.saved().lastQa.serial,'9ABX772');
});
test('Create a different QA serial after printing supports PDF without reloading the page',async()=>{
 const h=setup();h.ctx.window.ApexLabelStudio.open('qaStickers');await tick();
 h.get('qaTechnician').value='JAMIE SALE';h.get('qaSerial').value='SERIAL-A';h.get('qaSerial').oninput();
 await h.get('qaCreate').onclick();
 await h.get('qaPrint').onclick();await tick();
 h.get('qaSerial').value='SERIAL-B';h.get('qaSerial').oninput();
 await h.get('qaCreate').onclick();
 assert.equal(h.get('qaPdf').disabled,false);
 await h.get('qaPdf').onclick();await tick();
 assert.equal(h.pdfs.length,1);assert.equal(h.pdfs[0].qa.serial,'SERIAL-B');
});

async function create(h){h.ctx.window.ApexLabelStudio.open('qaStickers');await tick();h.get('qaTechnician').value='JAMIE SALE';h.get('qaSerial').value='DEMO-RECOVERY';h.get('qaSerial').oninput();await h.get('qaCreate').onclick();}
test('cancelled and failed native print restores both buttons without changing the saved sticker',async()=>{
 let attempt=0;const h=setup({print:()=>{attempt++;if(attempt===1)return {ok:false,cancelled:true};if(attempt===2)throw Error('Printer unavailable');return {ok:true};}});
 await create(h);const date=h.saved().lastQa.createdDate;
 for(let i=0;i<3;i++){await h.get('qaPrint').onclick();assert.equal(h.get('qaPrint').disabled,false);assert.equal(h.get('qaPdf').disabled,false);}
 assert.equal(h.prints.length,3);assert.equal(h.saved().lastQa.createdDate,date);
});
test('recreated QA controls recover when an outstanding print completes',async()=>{
 let finish;const h=setup({print:()=>new Promise(resolve=>{finish=resolve;})});await create(h);
 const pending=h.get('qaPrint').onclick();assert.equal(h.get('qaPrint').disabled,true);
 h.recreate();await h.ctx.window.ApexLabelStudio.reload();assert.equal(h.get('qaPrint').disabled,true);
 finish({ok:false,cancelled:true});await pending;assert.equal(h.get('qaPrint').disabled,false);assert.equal(h.get('qaPdf').disabled,false);
});
test('failed recreation of an already valid sticker keeps it printable',async()=>{
 let fail=false;const h=setup({save:()=>{if(fail)throw Error('Save failed');}});await create(h);
 fail=true;await h.get('qaCreate').onclick();assert.equal(h.get('qaPrint').disabled,false);assert.equal(h.get('qaPdf').disabled,false);
});
