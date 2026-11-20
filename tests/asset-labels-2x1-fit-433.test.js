'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Fit=require('../src/renderer/asset-device-label-fit');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('2x1 labels try compact and tight physical layouts before refusing overflow',()=>{
 const box={top:0,left:0,right:200,bottom:100};
 const child={getBoundingClientRect:()=>({top:2,left:2,right:198,bottom:98}),scrollHeight:10,clientHeight:10,scrollWidth:30,clientWidth:30,style:{fontSize:'9px'}};
 const stock={dataset:{size:'2x1',moduleDots:'2'},style:{},
  getBoundingClientRect:()=>box,
  get scrollHeight(){return this.dataset.fitStage==='tight'?100:120;},
  clientHeight:100,
  removeAttribute(n){if(n==='data-fit-stage')delete this.dataset.fitStage;},
  querySelectorAll(){return [child];},
  querySelector(selector){return selector==='.apex-barcode-human'?child:null;}
 };
 const sheet={querySelector(){return stock;}};
 const old=global.getComputedStyle;
 global.getComputedStyle=el=>({fontSize:el.style.fontSize||'9px'});
 try{
  const result=Fit.fit(sheet);
  assert.equal(result.ok,true);
  assert.equal(stock.dataset.fitStage,'tight');
  assert.equal(stock.dataset.moduleDots,'2');
 }finally{if(old===undefined)delete global.getComputedStyle;else global.getComputedStyle=old;}
});

test('one printer dot remains blocked even if text and height could fit',()=>{
 const stock={dataset:{size:'2x1',moduleDots:'1'},getBoundingClientRect:()=>({}),querySelectorAll:()=>[],querySelector:()=>null,removeAttribute(){},scrollHeight:1,clientHeight:2};
 const sheet={querySelector:()=>stock};
 assert.match(Fit.fit(sheet).error,/one printer dot/);
});

test('2x1 Code128 retains its computed width when bar height is made shorter',()=>{
 const context={window:{
  ApexAssetBarcode:{code128Svg:()=>'<svg viewBox="0 0 90 32"><rect width="2" height="32"/></svg>'},
  ApexAssetLabelQR:{deviceName:r=>r.manufacturer+' '+r.model}
 }};
 vm.createContext(context);
 vm.runInContext(read('src/renderer/asset-label-print.js'),context);
 const record={id:'85543',manufacturer:'Dell',model:'Latitude 5420',processor:'Intel Core i5',ram:'8GB',storage:'512GB SSD'};
 context.record=record;
 vm.runInContext("this.result=makeLabelMarkup(record,'assetDevice','2x1',203,{assetOptions:{fields:['processor','ram','storage']}})",context);
 const html=context.result;
 assert.match(html,/preserveAspectRatio="none"/);
 assert.match(html,/data-fields="3"/);
 assert.match(html,/data-field="processor"/);
 assert.match(html,/data-field="ram"/);
 assert.match(html,/data-field="storage"/);
 assert.match(html,/width="[0-9.]+mm"/);
 assert.match(html,/height="5\.7mm"/);
 assert.doesNotMatch(html,/APEX ASSET TAG/);
});
