'use strict';
/* APEX 4.2: precompute inventory sort and search terms once per inventory snapshot.
   Does not change persisted records or cloud revision semantics. */
(function(factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(typeof window!=='undefined')window.ApexInventoryPerformance=api;})(function(){
 const keys=['id','model','manufacturer','serial','location','pallet','sku','processor','gpu','productType'];
 function build(items){
  const source=Array.isArray(items)?items:[];
  const sorted=[...source].sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0));
  const searchable=new WeakMap();
  let processed=0,awaiting=0,needsRepair=0;
  for(const item of sorted){
   searchable.set(item,keys.map(key=>String(item[key]??'').toLowerCase()).join('\u0000'));
   if(item.status==='Processed')processed++;
   if(item.status==='Awaiting Processing')awaiting++;
   if(item.grade==='D'||item.condition==='D')needsRepair++;
  }
  function filter({query='',location='',grade='',status='All statuses',matches}={}){
   const q=String(query).trim().toLowerCase();
   return sorted.filter(asset=>(!location||asset.location===location)&&(!grade||asset.grade===grade)&&
    (status==='All statuses'||asset.status===status)&&(!q||searchable.get(asset).includes(q))&&
    (!matches||matches(asset)));
  }
  return {sorted,filter,stats:{total:source.length,processed,awaiting,needsRepair}};
 }
 return {build};
});
