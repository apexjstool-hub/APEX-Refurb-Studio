'use strict';
/* Inventory presentation settings only. Never changes stored asset order or cloud records. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexInventorySort=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const KEYS=['created','device','asset','condition','location','pallet','status','repair','waiting'];
 const allowed=new Set(KEYS);
 let current={key:'created',direction:'desc'};
 function configure(key,direction){
  if(!allowed.has(key)||!['asc','desc'].includes(direction))throw Error('Invalid Inventory sort option.');
  current={key,direction};return {...current};
 }
 function get(){return {...current};}
 function keyValue(asset,key,workflow,summaryIndex,now){
  const val=v=>String(v??'').trim();
  if(key==='created')return Number.isFinite(Date.parse(asset.createdAt))?Date.parse(asset.createdAt):null;
  if(key==='asset')return val(asset.id);
  if(key==='device')return [asset.manufacturer,asset.model].filter(Boolean).join(' ').trim();
  if(key==='condition')return val(asset.condition);
  if(key==='location')return val(asset.location);
  if(key==='pallet')return val(asset.pallet);
  if(key==='status')return val(asset.status);
  const summary=summaryIndex.get(asset.id);
  if(key==='repair')return val(summary?.stage);
  if(key==='waiting')return globalThis.ApexInventoryStatusDisplay?.waitingDays?.(summary,workflow?.jobs?.[asset.id],now)??null;
  return null;
 }
 function sort(assets,workflow=null,now=Date.now()){
  const {key,direction}=current,sign=direction==='asc'?1:-1;
  const summaryIndex=['repair','waiting'].includes(key)&&workflow&&globalThis.ApexInventoryWorkflow?.index?globalThis.ApexInventoryWorkflow.index(workflow):new Map();
  const collator=new Intl.Collator('en-GB',{numeric:true,sensitivity:'base'});
  const decorated=assets.map((asset,index)=>({asset,index,value:keyValue(asset,key,workflow,summaryIndex,now)}));
  decorated.sort((a,b)=>{
   const blank=v=>v===null||v===undefined||v==='';
   if(blank(a.value)&&!blank(b.value))return 1;
   if(!blank(a.value)&&blank(b.value))return -1;
   if(blank(a.value)&&blank(b.value))return a.index-b.index;
   const diff=typeof a.value==='number'&&typeof b.value==='number'?Math.sign(a.value-b.value):collator.compare(String(a.value),String(b.value));
   return sign*diff||collator.compare(String(a.asset.id),String(b.asset.id))||a.index-b.index;
  });
  return decorated.map(x=>x.asset);
 }
 return {configure,get,sort,KEYS};
});
