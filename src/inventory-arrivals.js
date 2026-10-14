'use strict';
// Session-scoped IDs prevent duplicate notifications across refreshes and reconnects.
class InventoryArrivals{
 constructor(){this.reset();}
 reset(){this.workspace=null;this.seen=new Set();this.ready=false;}
 remember(id){if(id)this.seen.add(String(id).trim().toUpperCase());}
 observe(result,workspace){
  if(!result?.ok||result.unchanged||!Array.isArray(result.items))return [];
  if(this.workspace!==workspace){this.reset();this.workspace=workspace;}
  const added=[];
  for(const item of result.items){const id=String(item.id||'').trim().toUpperCase();if(!id)continue;if(this.ready&&!item.deletedAt&&!this.seen.has(id))added.push({...item,id});this.seen.add(id);}
  this.ready=true;return added;
 }
}
module.exports={InventoryArrivals};
