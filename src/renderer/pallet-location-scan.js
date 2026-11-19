'use strict';
/* Barcode/QR helper for Set Asset Locations. Selection only: never mutates pallet records. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.ApexPalletLocationScan=api;
})(typeof window!=='undefined'?window:null,function(){
 const canonical=value=>String(value??'').trim().toUpperCase();
 function decoded(raw){
  const text=String(raw??'').trim();
  if(!text)return '';
  try{
   const value=JSON.parse(text);
   if(value&&typeof value==='object'&&!Array.isArray(value)){
    for(const field of ['pallet','palletId','palletName','pallet_id','pallet_name'])if(typeof value[field]==='string')return value[field].trim();
   }
  }catch{}
  return text.replace(/^(?:APEX[-_ ]?)?PALLET(?:[-_ ]?(?:ID|NAME))?\s*[:=]\s*/i,'').trim();
 }
 function resolve(raw,assets,pallets=[]){
  const active=(Array.isArray(assets)?assets:[]).filter(x=>x&&x.id&&!x.deletedAt);
  const input=canonical(decoded(raw));
  if(!input)return {ok:false,error:'Scan or enter an Asset ID or pallet barcode.'};
  // Direct pallet match may come from a managed pallet or existing asset assignments.
  const names=new Map();
  for(const p of Array.isArray(pallets)?pallets:[]){
   const name=typeof p==='string'?p:p?.name;
   if(canonical(name))names.set(canonical(name),name);
  }
  for(const asset of active)if(canonical(asset.pallet)&&!names.has(canonical(asset.pallet)))names.set(canonical(asset.pallet),asset.pallet);
  const pallet=names.get(input);
  if(pallet){
   const matches=active.filter(asset=>canonical(asset.pallet)===input);
   if(!matches.length)return {ok:false,error:'Pallet '+pallet+' has no active assets assigned to it.'};
   return {ok:true,type:'pallet',pallet,ids:matches.map(a=>a.id),count:matches.length};
  }
  const single=active.find(a=>canonical(a.id)===input);
  if(single)return {ok:true,type:'asset',ids:[single.id],count:1};
  return {ok:false,error:'No active asset or pallet matches this barcode. Refresh inventory or check the pallet number.'};
 }
 return Object.freeze({resolve});
});
