'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ApexAssetTimeline=factory();})(typeof window==='object'?window:globalThis,function(){
 const key=e=>e.id?'id:'+e.id:JSON.stringify([e.at||'',e.type||'',e.detail||'']);
 function merge(...sources){const entries=new Map();for(const source of sources)for(const event of source||[]){if(!event||!event.type)continue;const k=key(event);entries.set(k,{...entries.get(k),...event});}return [...entries.values()].sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0)||key(b).localeCompare(key(a)));}
 return {merge,key};
});
