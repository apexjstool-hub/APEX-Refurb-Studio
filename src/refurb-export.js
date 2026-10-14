"use strict";
(function(factory){const mod=factory();if(typeof module!=="undefined"&&module.exports)module.exports=mod;if(typeof window!=="undefined")window.ApexRefurbExport=mod;})(function(){
const fullName=a=>{const maker=String(a?.manufacturer||'').trim(),model=String(a?.model||'').trim();return model.toLowerCase().startsWith(maker.toLowerCase()+' ')?model:[maker,model].filter(Boolean).join(' ');};
function requiredPartsRows(assets,workflow,selectedAssetIds){
 // Omitting the third argument exports every asset; an empty selection exports none.
 const allowed=selectedAssetIds===undefined?null:new Set(selectedAssetIds);
 const rows=[['Asset ID','Full Manufacturer and Model','Serial Number','Part Needed']];
 for(const asset of (assets||[])){
  if(asset.deletedAt||(allowed&&!allowed.has(String(asset.id))))continue;
  const job=workflow?.jobs?.[asset.id];let parts=Array.isArray(job?.parts)?job.parts:[];
  if(!parts.length){const r=asset.refurbishment||{};const latest=Array.isArray(r.reports)?(r.reports.find(x=>x.key===r.latestKey)||r.reports.at(-1)):r;parts=latest?.repairs||[];}
  for(const part of parts){const name=String(part?.name||'').trim();if(name)rows.push([String(asset.id),fullName(asset),String(asset.serial||''),name]);}
 }
 return rows;
}
function templatePartsRows(assets,workflow,selectedAssetIds){
 const allowed=selectedAssetIds===undefined?null:new Set(selectedAssetIds);
 const rows=[['Item ID','Make/Model','CPU','RAM','Storage','Serial Number','Part #1','Part #1 Cost','Part #2','Part #2 Cost','Part #3','Part #3 Cost','Part #4','Part #4 Cost','Parts Total']];
 for(const asset of assets||[]){
  if(asset.deletedAt||(allowed&&!allowed.has(String(asset.id))))continue;
  const job=workflow?.jobs?.[asset.id];let parts=Array.isArray(job?.parts)?job.parts:[];
  if(!job){const r=asset.refurbishment||{};const latest=Array.isArray(r.reports)?(r.reports.find(x=>x.key===r.latestKey)||r.reports.at(-1)):r;parts=latest?.repairs||[];}
  parts=parts.filter(p=>String(p?.name||'').trim());if(!parts.length)continue;
  for(let start=0;start<parts.length;start+=4){
   const row=[String(asset.id),fullName(asset),String(asset.processor||''),String(asset.ram||''),String(asset.storage||''),String(asset.serial||'')];
   for(let slot=0;slot<4;slot++){const p=parts[start+slot],qty=Number(p?.qty??p?.quantity??1);row.push(p?String(p.name).trim()+(qty>1?' × '+qty:''):'',null);}row.push(null);rows.push(row);
  }
 }
 return rows;
}
return {requiredPartsRows,templatePartsRows,fullName};
});
