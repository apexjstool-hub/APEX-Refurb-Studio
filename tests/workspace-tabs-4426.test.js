'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/renderer/workspace-tabs-v1.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../src/renderer/index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../src/renderer/workspace-tabs-v1.css'),'utf8');
function mock(){
 const ctx={console,confirm:()=>true};
 const main={scrollTop:0};
 const input={name:'model',value:'',checked:false,type:'text'};
 const form={querySelectorAll:()=>[input]};
 const label={textContent:'',dataset:{}};
 const appPage={classList:{contains:()=>false}};
 const list={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};
 const add={onclick:null};
 const strip={innerHTML:'',className:'',setAttribute(){},querySelector(selector){if(selector==='#apexWorkspaceTabList')return list;if(selector==='#apexWorkspaceOpenInventory')return add;return null;}};
 const host={after(item){assert.equal(item,strip);}};
 const listeners=new Map();
 const ids={v3Topline:host,assetEditor:form,assetPage:{dataset:{section:'overview'}},assetEditedHint:label,appPage};
 ctx.document={getElementById:id=>ids[id]||null,querySelector:selector=>selector==='main.main>.content'?{}:selector==='main.main'?main:null,createElement:()=>strip,addEventListener:(name,callback)=>listeners.set(name,callback)};
 ctx.window=ctx;
 vm.createContext(ctx);
 vm.runInContext(`
 let currentPage='inventory',activeAssetId=null,dirty=false;
 let items=[{id:'83253',model:'Dell Latitude'},{id:'83254',model:'HP EliteBook'}];
 function setPage(page,force=false){
  if(currentPage==='asset'&&dirty&&!force&&!confirm('Discard?'))return false;
  dirty=false;currentPage=page;document.querySelector('main.main').scrollTop=0;return true;
 }
 function openAsset(id){
  activeAssetId=id||null;
  if(!setPage('asset',true))return;
  document.getElementById('assetEditor').querySelectorAll()[0].value=items.find(x=>x.id===id)?.model||'';
  dirty=false;
 }
 `,ctx);
 vm.runInContext(source,ctx);
 return {ctx,input,main,list,add,listeners,eval:expr=>vm.runInContext(expr,ctx)};
}
test('Workspace tab bar is a new stylesheet and script added after the existing APEX controllers',()=>{
 assert.match(html,/workspace-tabs-v1.css/);
 assert.match(html,/completed-qa-ui\.js.*workspace-tabs-v1\.js/);
 assert.match(css,/\.apex-workspace-tabs/);
 assert.doesNotMatch(source,/api\.(?:update|save|delete|move)/);
 assert.doesNotMatch(source,/innerHTML\s*=.*<aside/);
});
test('Inventory, Asset Details and Asset Labels open as distinct tabs without changing sidebar page markup',()=>{
 const h=mock();
 h.eval("openAsset('83253')");
 h.eval("setPage('assetLabels')");
 const keys=h.ctx.ApexWorkspaceTabs.keys();
 assert.deepEqual(Array.from(keys),['page:inventory','asset:83253','page:assetLabels']);
 assert.equal(h.ctx.ApexWorkspaceTabs.active(),'page:assetLabels');
 assert.equal(h.ctx.ApexWorkspaceTabs.activate('page:inventory'),true);
 assert.equal(h.eval('currentPage'),'inventory');
 assert.equal(h.ctx.ApexWorkspaceTabs.activate('asset:83253'),true);
 assert.equal(h.eval('activeAssetId'),'83253');
 assert.equal(h.ctx.ApexWorkspaceTabs.openAsset('83253'),undefined);
 assert.equal(h.ctx.ApexWorkspaceTabs.keys().length,3,'reopening same asset must reuse the existing tab');
});
test('Two assets preserve their own unsaved form drafts and never write those drafts to backend',()=>{
 const h=mock();
 h.eval("openAsset('83253')");
 h.input.value='Dell Latitude UPDATED';h.eval('dirty=true');
 h.eval("openAsset('83254')");
 assert.equal(h.input.value,'HP EliteBook');
 h.input.value='HP EliteBook DRAFT';h.eval('dirty=true');
 h.ctx.ApexWorkspaceTabs.activate('asset:83253');
 assert.equal(h.input.value,'Dell Latitude UPDATED');
 assert.equal(h.eval('dirty'),true);
 h.ctx.ApexWorkspaceTabs.activate('asset:83254');
 assert.equal(h.input.value,'HP EliteBook DRAFT');
 assert.equal(h.eval('dirty'),true);
 assert.deepEqual(Array.from(h.ctx.ApexWorkspaceTabs.keys()),['page:inventory','asset:83253','asset:83254']);
});
test('Closing a dirty asset tab asks for confirmation and does not delete or save its inventory',()=>{
 const h=mock();h.eval("openAsset('83253')");h.input.value='Unsaved';h.eval('dirty=true');
 h.ctx.confirm=()=>false;assert.equal(h.ctx.ApexWorkspaceTabs.close('asset:83253'),false);
 assert.equal(h.ctx.ApexWorkspaceTabs.keys().includes('asset:83253'),true);
 h.ctx.confirm=()=>true;assert.equal(h.ctx.ApexWorkspaceTabs.close('asset:83253'),true);
 assert.equal(h.ctx.ApexWorkspaceTabs.keys().includes('asset:83253'),false);
 assert.equal(h.eval('currentPage'),'inventory');
});
test('Inventory retains tab scroll position when opening Labels and returning',()=>{
 const h=mock();h.main.scrollTop=430;
 h.eval("setPage('assetLabels')");
 h.ctx.ApexWorkspaceTabs.activate('page:inventory');
 assert.equal(h.main.scrollTop,430);
});
