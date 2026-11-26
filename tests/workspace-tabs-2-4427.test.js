'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/renderer/workspace-tabs-v2.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../src/renderer/index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../src/renderer/workspace-tabs-v2.css'),'utf8');
function setup(){
 const listeners=new Map(),main={scrollTop:0},input={name:'model',type:'text',value:'',checked:false},form={querySelectorAll:()=>[input]};
 const hint={textContent:''},app={classList:{contains:()=>false}},list={innerHTML:'',querySelectorAll:()=>[]};
 const back={disabled:false,onclick:null},forward={disabled:false,onclick:null},newTab={onclick:null};
 const strip={innerHTML:'',className:'',setAttribute(){},querySelector(sel){return ({'#apexWorkspaceTabList':list,'#apexTabBack':back,'#apexTabForward':forward,'#apexWorkspaceNewTab':newTab})[sel]||null;}};
 const host={after(el){assert.equal(el,strip);}},ids={v3Topline:host,assetEditor:form,assetPage:{dataset:{section:'overview'}},assetEditedHint:hint,appPage:app};
 const doc={getElementById:id=>ids[id]||null,querySelector:sel=>sel==='main.main'?main:null,createElement:()=>strip,addEventListener:(name,cb)=>listeners.set(name,cb)};
 const ctx={window:null,document:doc,console,apexConfirm:()=>Promise.resolve(true),items:[{id:'83253',model:'Dell 5420'},{id:'83254',model:'HP 840'}]};
 ctx.window=ctx;vm.createContext(ctx);
 vm.runInContext(`
 let currentPage='inventory',activeAssetId=null,dirty=false;
 function setPage(page,force=false){if(currentPage==='asset'&&dirty&&!force)return false;dirty=false;currentPage=page;document.querySelector('main.main').scrollTop=0;return true;}
 function openAsset(id){activeAssetId=id;setPage('asset',true);document.getElementById('assetEditor').querySelectorAll()[0].value=items.find(a=>a.id===id)?.model||'';dirty=false;}
 `,ctx);
 vm.runInContext(source,ctx);
 return {ctx,main,input,list,back,forward,newTab,listeners,eval:s=>vm.runInContext(s,ctx)};
}
test('V2 loaded alone, preserves current APEX theme, sidebar and page markup',()=>{
 assert.match(html,/workspace-tabs-v2\.js/);assert.match(html,/workspace-tabs-v2\.css/);
 assert.doesNotMatch(html,/workspace-tabs-v1\.js/);assert.match(css,/min-width:162px/);
 assert.doesNotMatch(source,/\b(?:api\.(?:save|update|delete)|cloudFetch|ipcRenderer|localStorage\.setItem)\b/);
});
test('Normal clicks replace current tab, not create a new tab',()=>{
 const h=setup(),t=h.ctx.ApexWorkspaceTabs;
 assert.equal(t.keys().length,1);
 h.eval("openAsset('83253')");assert.equal(t.keys().length,1);assert.equal(t.route().id,'83253');
 h.eval("setPage('assetLabels')");assert.equal(t.keys().length,1);assert.equal(t.route().page,'assetLabels');
 assert.equal(t.back(),true);assert.equal(t.route().page,'asset');assert.equal(h.eval('currentPage'),'asset');
 assert.equal(t.back(),true);assert.equal(t.route().page,'inventory');
 assert.equal(t.forward(),true);assert.equal(t.route().id,'83253');
});
test('Explicit new tab holds inventory independently and duplicate assets focus existing open tab',()=>{
 const h=setup(),t=h.ctx.ApexWorkspaceTabs;
 h.eval("openAsset('83253')");
 assert.equal(t.openNew('inventory'),true);assert.equal(t.keys().length,2);
 assert.equal(t.route().page,'inventory');
 assert.equal(t.openNew('asset','83253'),true);
 assert.equal(t.keys().length,2,'existing asset tab is reused');
 assert.equal(t.route().id,'83253');
 assert.equal(t.openNew('asset','83254'),true);
 assert.equal(t.keys().length,3);
 assert.equal(t.close(t.active()),true);
 assert.equal(t.keys().length,2);
});
test('One tab remains visible after closing the last tab',()=>{
 const h=setup(),t=h.ctx.ApexWorkspaceTabs;
 assert.equal(t.close(t.active()),true);
 assert.equal(t.keys().length,1);assert.equal(t.route().page,'inventory');
});
test('Unsaved edits restore across tab switches and Back/Forward without cloud writes',async()=>{
 const h=setup(),t=h.ctx.ApexWorkspaceTabs;
 h.eval("openAsset('83253')");h.input.value='Dell UNSAVED';h.eval('dirty=true');
 t.openNew('assetLabels');t.activate(t.keys()[0]);
 assert.equal(h.input.value,'Dell UNSAVED');assert.equal(h.eval('dirty'),true);
 h.eval("openAsset('83254')");assert.equal(t.keys().length,2);
 t.back();assert.equal(h.input.value,'Dell UNSAVED');assert.equal(h.eval('dirty'),true);
 const originalTabCount=t.keys().length;
 h.ctx.apexConfirm=()=>Promise.resolve(false);assert.equal(t.close(t.active()),false);
 await Promise.resolve();assert.equal(t.keys().length,originalTabCount,'Cancel preserves tab and unsaved form');
 h.ctx.apexConfirm=()=>Promise.resolve(true);assert.equal(t.close(t.active()),false);
 await Promise.resolve();assert.equal(t.keys().length,originalTabCount-1,'Confirmed themed dialog closes tab asynchronously');
});
test('Tab switching restores captured scroll, does not call scrollIntoView or animate layout',()=>{
 const h=setup(),t=h.ctx.ApexWorkspaceTabs;
 h.main.scrollTop=310;t.openNew('assetLabels');t.activate(t.keys()[0]);
 assert.equal(h.main.scrollTop,310);
 assert.doesNotMatch(source,/scrollIntoView|scroll-behavior:\s*smooth/);
});
test('Ctrl+click on asset explicitly opens new tab and suppresses normal click handler',()=>{
 const h=setup(),t=h.ctx.ApexWorkspaceTabs;
 let prevented=false,stopped=false;
 const asset={dataset:{asset:'83253'}},target={closest:query=>query.includes('[data-asset]')?asset:null};
 h.listeners.get('click')({button:0,ctrlKey:true,metaKey:false,altKey:false,target,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;},stopPropagation(){}});
 assert.equal(t.keys().length,2);assert.equal(t.route().id,'83253');
 assert.equal(prevented,true);assert.equal(stopped,true);
});
