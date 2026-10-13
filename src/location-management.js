'use strict';
/** One transaction for removing a managed inventory location, with optional transfer. */
const core=require('./inventory-core');
function deleteLocation(db,input={}){
  if(!db||!Array.isArray(db.items)||!Array.isArray(db.locations))return {ok:false,error:'Invalid inventory database.'};
  const raw=String(input.name??'').trim();
  const name=db.locations.find(x=>x.toLowerCase()===raw.toLowerCase()) || [...new Set(db.items.filter(x=>!x.deletedAt).map(x=>x.location))].find(x=>x.toLowerCase()===raw.toLowerCase());
  if(!name||name.toLowerCase()==='unassigned')return {ok:false,error:'This location cannot be deleted.'};
  const active=db.items.filter(x=>!x.deletedAt&&x.location.toLowerCase()===name.toLowerCase());
  let destination='';
  if(active.length){
    const requested=String(input.moveTo??'').trim();
    const choices=[...new Set([...db.locations,...db.items.filter(x=>!x.deletedAt).map(x=>x.location),'Unassigned'])];
    destination=choices.find(x=>x.toLowerCase()===requested.toLowerCase()&&x.toLowerCase()!==name.toLowerCase())||'';
    if(!destination)return {ok:false,error:`${active.length} asset(s) still use this location. Choose a different location before deleting it.`,requiresMove:true,assetCount:active.length};
  }
  // Validate everything before changing the database.
  for(const item of active){const result=core.update([item],item.id,{location:destination});if(!result.ok)return result;}
  if(Array.isArray(db.pallets)) { for(const pallet of db.pallets.filter(p=>p.location.toLowerCase()===name.toLowerCase())){if(!destination && db.items.some(i=>!i.deletedAt&&i.pallet===pallet.name))return {ok:false,error:'Pallets at this location must be moved before deleting it.'};pallet.location=destination||'Unassigned';} }
  db.locations=db.locations.filter(x=>x.toLowerCase()!==name.toLowerCase());
  return {ok:true,removed:name,moved:active.length,moveTo:destination||null,locations:db.locations};
}
module.exports={deleteLocation};
