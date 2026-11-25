"use strict";
(function(factory){const mod=factory();if(typeof module!=="undefined"&&module.exports)module.exports=mod;if(typeof window!=="undefined")window.ApexRefurbExport=mod;})(function(){
const fullName=a=>{const maker=String(a?.manufacturer||'').trim(),model=String(a?.model||'').trim();return model.toLowerCase().startsWith(maker.toLowerCase()+' ')?model:[maker,model].filter(Boolean).join(' ');};
const count=v=>Math.max(0,Number(v)||0);
// Presentation-only clean-up. The export never modifies the saved asset record.
const tidy=v=>String(v??'').normalize('NFKC').replace(/[\u00A0\t ]+/g,' ').trim();
const knownParts=new Map(Object.entries({
 'lcd panel':'LCD Panel','lcd panle':'LCD Panel','lcd pannel':'LCD Panel',
 'screen bezel':'Screen Bezel','scren bezel':'Screen Bezel','screen bezzel':'Screen Bezel',
 'rubber foot strip':'Rubber Foot Strip','rubber foot strop':'Rubber Foot Strip','rubber feet strip':'Rubber Foot Strip',
 'respray':'Respray','respary':'Respray','re spray':'Respray',
 'keyboard':'Keyboard','keybaord':'Keyboard','battery':'Battery','battrey':'Battery',
 'touchpad':'Touchpad','touchapd':'Touchpad','palmrest':'Palmrest','palm rest':'Palmrest',
 'ssd':'SSD','hdd':'HDD','ram':'RAM','wifi card':'Wi-Fi Card','wi fi card':'Wi-Fi Card',
 'webcam':'Webcam','screen':'Screen','charger':'Charger','power adapter':'Power Adapter'
}));
function partDisplayName(v){
 const raw=tidy(v);if(!raw)return '';
 const key=raw.toLowerCase().replace(/[-_]+/g,' ').replace(/\s+/g,' ');
 if(knownParts.has(key))return knownParts.get(key);
 // Avoid guessing at uncommon technical product descriptions or identifiers.
 if(raw===raw.toUpperCase()||raw===raw.toLowerCase())return raw.toLowerCase().replace(/\b[a-z]/g,m=>m.toUpperCase()).replace(/\b(Lcd|Ssd|Hdd|Ram|Usb|Hdmi|Nvme|Cpu|Gpu)\b/g,m=>m.toUpperCase());
 return raw;
}

function partsToOrder(asset,workflow){
 const job=workflow?.jobs?.[asset.id];
 if(job?.partsBoard==='ordered')return [];
 let parts=Array.isArray(job?.parts)?job.parts:[];
 if(!job){const r=asset.refurbishment||{};const latest=Array.isArray(r.reports)?(r.reports.find(x=>x.key===r.latestKey)||r.reports.at(-1)):r;parts=Array.isArray(latest?.repairs)?latest.repairs:[];}
 return parts.flatMap(p=>{
  if(!String(p?.name||'').trim()||['Ordered','Received','Fitted'].includes(p.status))return [];
  const pending=p.id?(workflow?.orders||[]).filter(o=>o.status!=='Draft').flatMap(o=>o.lines||[]).filter(l=>l.assetId===asset.id&&l.partId===p.id).reduce((n,l)=>n+Math.max(0,count(l.qty)-count(l.received)),0):0;
  const qty=Math.max(0,count(p.qty??p.quantity??1)-Math.max(count(p.received),count(p.fitted))-pending);
  return qty>0?[{...p,qty}]:[];
 });
}
// Refurb exports include all parts not yet fully fitted, including ordered and received.
// The separate purchasing list still uses partsToOrder(), to avoid double ordering.
function outstandingParts(asset,workflow){
 const job=workflow?.jobs?.[asset.id];
 let parts=Array.isArray(job?.parts)?job.parts:[];
 if(!job){const r=asset.refurbishment||{};const latest=Array.isArray(r.reports)?(r.reports.find(x=>x.key===r.latestKey)||r.reports.at(-1)):r;parts=Array.isArray(latest?.repairs)?latest.repairs:[];}
 return parts.flatMap(p=>{
  const name=String(p?.name||'').trim();
  if(!name||String(p?.status||'').toLowerCase()==='fitted')return [];
  const required=count(p.qty??p.quantity??1);
  const remaining=Math.max(0,required-count(p.fitted));
  return remaining>0?[{...p,name,qty:remaining}]:[];
 });
}
function requiredPartsRows(assets,workflow,selectedAssetIds){
 // Omitting the third argument exports every asset; an empty selection exports none.
 const allowed=selectedAssetIds===undefined?null:new Set(selectedAssetIds);
 const rows=[['Asset ID','Full Manufacturer and Model','Serial Number','Part Needed']];
 for(const asset of (assets||[])){
  if(asset.deletedAt||(allowed&&!allowed.has(String(asset.id))))continue;
  const parts=outstandingParts(asset,workflow);
  for(const part of parts){const name=partDisplayName(part?.name);if(name)rows.push([String(asset.id),fullName(asset),String(asset.serial||''),name]);}
 }
 return rows;
}
function templatePartsRows(assets,workflow,selectedAssetIds){
 const allowed=selectedAssetIds===undefined?null:new Set(selectedAssetIds.map(String));
 const selected=(assets||[]).filter(a=>!a.deletedAt&&(!allowed||allowed.has(String(a.id))));
 const entries=selected.map(asset=>({asset,parts:outstandingParts(asset,workflow)})).filter(x=>x.parts.length);
 // Four pairs minimum maintains the established APEX template; expand to fit every requirement.
 const slots=Math.max(4,...entries.map(x=>x.parts.length),0);
 if(slots>1000)throw Error('Too many part columns for Excel; export in smaller batches.');
 const headers=['Item ID','Make/Model','CPU','RAM','Storage','Serial Number'];
 for(let i=1;i<=slots;i++)headers.push('Part #'+i,'Part #'+i+' Cost');
 headers.push('Parts Total','Refurb notes');
 const rows=[headers];
 for(const {asset,parts} of entries){
  const row=[String(asset.id),fullName(asset),String(asset.processor||''),String(asset.ram||''),String(asset.storage||''),String(asset.serial||'')];
  for(let i=0;i<slots;i++){
   const p=parts[i];const qty=Number(p?.qty??p?.quantity??1);
   row.push(p?partDisplayName(p.name)+(qty>1?' × '+qty:''):'');
   const amount=p?.cost??p?.unitCost;
   row.push(p&&amount!==undefined&&amount!==null&&amount!==''&&Number.isFinite(Number(amount))?Number(amount):null);
  }
  row.push(null,String(asset.refurbNotes||'').replace(/\r\n/g,'\n').trim());
  rows.push(row);
 }
 return rows;
}

return {requiredPartsRows,templatePartsRows,fullName,partsToOrder,outstandingParts,partDisplayName};
});
