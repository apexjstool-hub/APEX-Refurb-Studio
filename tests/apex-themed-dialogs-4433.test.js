'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(base,p),'utf8');
const dialogs=read('src/renderer/apex-dialogs.js'),css=read('src/renderer/apex-dialogs.css'),html=read('src/renderer/index.html');
const files=['app.js','refurb-ui.js','v3-ui.js','workspace-tabs-v2.js','completed-qa-ui.js','apex-connect.js','apex-connect-maintenance.js','apex-portable-devices.js','inventory-bulk-location.js','microdream-simple-centre.js','pallet-locations.js','smart-data-cleaner-ui.js','smart-workstation.js','update-notifications.js','v346-simple-scan.js','v393-conflicts.js'];
function harness(){
 const elements={},handlers={};
 function elem(id){if(!elements[id])elements[id]={id,hidden:false,dataset:{},textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},focus(){document.activeElement=this;},addEventListener(type,fn){handlers[id+':'+type]=fn;},querySelectorAll(){return[];},setAttribute(){}};return elements[id];}
 const panel=elem('panel');
 panel.querySelectorAll=()=>[];
 const layer=elem('apexDialogLayer');
 layer.querySelector=()=>panel;
 const document={body:{append(x){this.child=x}},activeElement:elem('before'),createElement:()=>layer,getElementById:elem};
 const root={document,Promise,Number,Math,String,Array};
 root.window=root;
 vm.runInNewContext(dialogs,root,{filename:'apex-dialogs.js'});
 return {root,elements,handlers,layer};
}
test('Shared modal is available and cancel never approves a destructive confirmation',async()=>{
 const h=harness();
 const p=h.root.apexConfirm('Permanently delete a part?',{title:'Delete part?',tone:'danger',confirmLabel:'Delete part'});
 assert.equal(h.layer.hidden,false);
 assert.equal(h.elements.apexDialogTitle.textContent,'Delete part?');
 assert.equal(h.elements.apexDialogAccept.textContent,'Delete part');
 h.handlers['apexDialogCancel:click']();
 assert.equal(await p,false);
 assert.equal(h.layer.hidden,true);
});
test('Alert, prompt and queued requests have predictable action semantics',async()=>{
 const h=harness(),modal=h.root.ApexDialogs;
 let first=modal.alert('Operation completed',{title:'Success',tone:'success'});
 let second=modal.prompt('Enter label name',{defaultValue:'Asset Tag',required:true});
 h.handlers['apexDialogAccept:click']();
 assert.equal(await first,true);
 assert.equal(h.elements.apexDialogInput.value,'Asset Tag');
 h.elements.apexDialogInput.value='QA Station';
 h.handlers['apexDialogAccept:click']();
 assert.equal(await second,'QA Station');
 const third=modal.prompt('Enter label name',{required:true});
 h.handlers['apexDialogCancel:click']();
 assert.equal(await third,null);
});
test('All active renderer confirmation sites use the themed async dialog API',()=>{
 for(const f of files){
  const source=read('src/renderer/'+f);
  assert.doesNotMatch(source,/(?<!\w)(?:window\.)?confirm\s*\(/,'Native browser confirm still present in '+f);
 }
 assert.match(html,/<script src="apex-dialogs\.js"><\/script><script src="app\.js">/);
 assert.match(html,/apex-dialogs\.css/);
 assert.match(dialogs,/root\.ApexDialogs=Object\.freeze/);
 assert.match(dialogs,/root\.apexConfirm=/);
});
test('Sensitive unsaved navigation retains cancellation and explicit continuation',()=>{
 const app=read('src/renderer/app.js');
 const tabs=read('src/renderer/workspace-tabs-v2.js');
 assert.match(app,/if\(currentPage==='asset'&&dirty&&!force\)\{apexConfirm/);
 assert.match(app,/if\(ok\)\{dirty=false;setPage\(page,true\);\}/);
 assert.match(app,/if\(currentPage==='asset'&&dirty\)\{apexConfirm/);
 assert.match(tabs,/function close\(key,confirmed=false\)/);
 assert.match(tabs,/if\(ok\)close\(key,true\)/);
});
test('Modal keyboard access, focus management, danger buttons and theme styling are present',()=>{
 assert.match(dialogs,/aria-modal="true"/);
 assert.match(dialogs,/aria-labelledby="apexDialogTitle"/);
 assert.match(dialogs,/e\.key==='Escape'/);
 assert.match(dialogs,/e\.key==='Tab'/);
 assert.match(dialogs,/previousFocus\?\.focus/);
 assert.match(dialogs,/root\.apexPrompt=/);
 assert.match(css,/data-theme=dark/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/apex-dialog-accept\.apex-dialog-danger/);
});
