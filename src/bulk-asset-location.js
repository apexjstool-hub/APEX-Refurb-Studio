'use strict';
// Set only the direct location field; preserve pallet assignment and pallet storage location.
// Local updates are staged and committed together after all safeguards pass.
const core=require('./inventory-core');
const norm=s=>String(s??'').trim().replace(/\s+/g,' ');
const key=s=>norm(s).toUpperCase();
function validate(db,input={}){
 const ids=Array.isArray(input.ids)?input.ids.map(key):[];
 const location=norm(input.location);
 if(!ids.length||ids.length>300||new Set(ids).size!==ids.length)return {ok:false,error:'Choose 1–300 unique asset IDs per update.'};
 if(!location||location.length>90||/[<>\x00-\x1f]/.test(location))return {ok:false,error:'Enter a valid location (1–90 characters).'};
 const chosen=(db.locations||[]).find(x=>norm(x).toLowerCase()===location.toLowerCase());
 if(!chosen)return {ok:false,error:'Choose an existing asset location. Create it in Locations first.'};
 const expected=Array.isArray(input.expectedAssignments)?input.expectedAssignments:[];
 if(expected.length!==ids.length)return {ok:false,error:'Refresh and review current asset assignments before updating.'};
 const map=new Map(expected.map(x=>[key(x?.id),x]));
 if(map.size!==ids.length)return {ok:false,error:'Duplicate or missing asset assignment snapshots.'};
 const originals=[];
 for(const id of ids){
  const item=(db.items||[]).find(x=>key(x.id)===id&&!x.deletedAt),prior=map.get(id);
  if(!item||!prior)return {ok:false,error:'One or more assets are missing. Refresh and retry.'};
  if(norm(item.location)!==norm(prior.location)||norm(item.pallet)!==norm(prior.pallet)||(prior.updatedAt&&item.updatedAt!==prior.updatedAt))
   return {ok:false,error:'Asset '+id+' changed since selection. Refresh and review before updating.'};
  originals.push(item);
 }
 return {ok:true,ids,location:chosen,originals};
}
function apply(db,input={}){
 const check=validate(db,input);if(!check.ok)return check;
 const updates=[];
 for(const old of check.originals){
  if(norm(old.location)===norm(check.location))continue;
  const copy=structuredClone(old);
  const updated=core.update([copy],copy.id,{location:check.location});if(!updated.ok)return updated;
  if(key(copy.pallet)!==key(old.pallet))return {ok:false,error:'Pallet assignment changed unexpectedly. No records updated.'};
  updates.push(copy);
 }
 for(const copy of updates){const index=db.items.findIndex(x=>key(x.id)===key(copy.id));db.items[index]=copy;}
 return {ok:true,updated:updates.length,unchanged:check.originals.length-updates.length,ids:check.ids,location:check.location,palletsPreserved:true};
}
module.exports={validate,apply};
