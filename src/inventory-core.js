'use strict';
/* Inventory schema v1.2: condition is the selected asset condition; status is workflow stage.
   grade remains the rules-based inspection suggestion and never silently overrides manual condition. */
(function(factory){const result=factory();if(typeof module!=='undefined'&&module.exports)module.exports=result;if(typeof window!=='undefined')window.ApexInventoryCore=result;})(function(){
 const cosmetics=['Not assessed','Excellent','Good','Fair','Poor'];
 const functions=['Not tested','Pass','Issues'];
 const batteries=['Not checked','Good','Worn','Failed','Not applicable'];
 const statuses=['Awaiting Processing','Processed'];
 const conditions=['Not assessed','A','B','C','D','Excellent','Good','Fair'];
 const productTypes=['Laptop','Desktop','Phone','Tablet','Monitor','All-in-One','Workstation','Server','Other'];
 const ssdTypes=['Not specified','NVMe SSD','SATA SSD','M.2 SATA SSD','eMMC','Other'];
 const ramTypes=['Not specified','DDR3','DDR3L','DDR4','DDR5','LPDDR3','LPDDR4','LPDDR4X','LPDDR5','LPDDR5X','Other'];
 const trim=(v,n)=>String(v??'').trim().slice(0,n);
 const stringEq=(x,y)=>String(x??'')===String(y??'');
 function assess(a={}){
   const cosmetic=cosmetics.includes(a.cosmetic)?a.cosmetic:'Not assessed';
   const functional=functions.includes(a.functional)?a.functional:'Not tested';
   const battery=batteries.includes(a.battery)?a.battery:'Not checked';
   if(functional==='Issues'||battery==='Failed')return {grade:'D',reason:'A functionality issue or failed battery was reported.'};
   if(cosmetic==='Not assessed'||functional==='Not tested'||battery==='Not checked')return {grade:'Pending',reason:'Complete the inspection checks to receive a suggested grade.'};
   if(cosmetic==='Poor'||cosmetic==='Fair'||battery==='Worn')return {grade:'C',reason:'Cosmetic or battery wear reduces the suggested grade.'};
   if(cosmetic==='Good')return {grade:'B',reason:'Good cosmetic condition with passed functional checks.'};
   return {grade:'A',reason:'Excellent cosmetic condition with passed functional checks.'};
 }
 function normalize(item={}){
   const inspection={cosmetic:cosmetics.includes(item?.inspection?.cosmetic)?item.inspection.cosmetic:'Not assessed',functional:functions.includes(item?.inspection?.functional)?item.inspection.functional:'Not tested',battery:batteries.includes(item?.inspection?.battery)?item.inspection.battery:'Not checked'};
   const suggestion=assess(inspection).grade;
   // Migrate v1.1 where `condition` stored workflow status (Ready / In testing / Needs repair).
   const legacyStatuses=['Ready','In testing','Needs repair'];
   const status=statuses.includes(item.status)?item.status:(legacyStatuses.includes(item.condition)?(item.condition==='Ready'?'Processed':'Awaiting Processing'):'Awaiting Processing');
   const condition=conditions.includes(item.condition)?item.condition:(legacyStatuses.includes(item.condition)?(suggestion==='Pending'?'Not assessed':suggestion):'Not assessed');
   const productType=productTypes.includes(item.productType)?item.productType:(productTypes.includes(item.category)?item.category:'Laptop');
   return {id:trim(item.id,80).toUpperCase(),manufacturer:trim(item.manufacturer,90),model:trim(item.model,140),serial:trim(item.serial,90),productType,category:productType,
     processor:trim(item.processor,140),gpu:trim(item.gpu,140),ram:trim(item.ram,70),storage:trim(item.storage,140),ssdType:ssdTypes.includes(item.ssdType)?item.ssdType:'Not specified',batteryPercentage:item.batteryPercentage===undefined||item.batteryPercentage===null||item.batteryPercentage===''?'':(Number(item.batteryPercentage)>=0&&Number(item.batteryPercentage)<=100?String(Math.round(Number(item.batteryPercentage))):''),operatingSystem:trim(item.operatingSystem,140),ramType:ramTypes.includes(item.ramType)?item.ramType:'Not specified',
     location:trim(item.location,90)||'Unassigned',pallet:trim(item.pallet,80),sku:trim(item.sku,90),condition,status,inspection,grade:suggestion,notes:trim(item.notes,500),
     refurbishment:(item.refurbishment&&typeof item.refurbishment==='object'&&!Array.isArray(item.refurbishment))?item.refurbishment:null,
     diagnosticTests:(typeof require==='function'?require('./diagnostic-tests').sanitise(item.diagnosticTests):Object.fromEntries(Object.entries(item.diagnosticTests||{}).filter(([k,v])=>['pass','fail'].includes(v?.status||v)))),
     deletedAt:item.deletedAt||null,createdAt:item.createdAt||new Date().toISOString(),updatedAt:item.updatedAt||item.createdAt||new Date().toISOString(),history:Array.isArray(item.history)?item.history.slice(-120):[]};
 }
 function add(items,data){
   const now=new Date().toISOString();const i=normalize({...data,createdAt:now,updatedAt:now});
   if(!i.id||!i.model)return {ok:false,error:'Asset ID and model are required.'};
   if(items.some(x=>x.id.toUpperCase()===i.id))return {ok:false,error:'This asset ID already exists.'};
   i.history=[{type:'Intake',detail:`Asset received at ${i.location} · ${i.status}`,at:now}];items.unshift(i);return {ok:true,item:i};
 }
 function update(items,id,patch){
   const original=items.find(x=>x.id===trim(id,80).toUpperCase());if(!original)return {ok:false,error:'Asset not found.'};
   // Validate and stage all edits before committing. Invalid late fields must not
   // leave earlier fields modified in memory or accidentally persist on a later save.
   const i={...original,history:Array.isArray(original.history)?[...original.history]:[]};
   const events=[];
   const fields={manufacturer:90,model:140,serial:90,processor:140,gpu:140,ram:70,storage:140,operatingSystem:140,location:90,pallet:80,sku:90,notes:500};
   for(const [key,max] of Object.entries(fields))if(patch?.[key]!==undefined){const value=trim(patch[key],max);if(['model','location'].includes(key)&&!value)return {ok:false,error:`${key==='model'?'Model':'Location'} is required.`};if(!stringEq(i[key],value)){
     if(key==='location')events.push({type:'Transfer',detail:`${i.location} → ${value}`});
     else if(key!=='notes')events.push({type:'Specification',detail:`${key}: ${value||'—'}`});
     else events.push({type:'Notes',detail:'Notes updated'});i[key]=value;
   }}
   if(patch?.productType!==undefined){if(!productTypes.includes(patch.productType))return {ok:false,error:'Choose a valid product type.'};if(i.productType!==patch.productType){i.productType=i.category=patch.productType;events.push({type:'Product type',detail:patch.productType});}}
   if(patch?.ssdType!==undefined){if(!ssdTypes.includes(patch.ssdType))return {ok:false,error:'Choose a valid SSD type.'};if(i.ssdType!==patch.ssdType){i.ssdType=patch.ssdType;events.push({type:'Specification',detail:`SSD type: ${i.ssdType}`});}}
   if(patch?.batteryPercentage!==undefined){const value=String(patch.batteryPercentage??'').trim();if(value&&!(/^(100|[1-9]?\d)$/.test(value)))return {ok:false,error:'Battery health must be between 0 and 100%.'};if(i.batteryPercentage!==value){i.batteryPercentage=value;events.push({type:'Specification',detail:`Battery health: ${value||'Not recorded'}%`});}}
   if(patch?.ramType!==undefined){if(!ramTypes.includes(patch.ramType))return {ok:false,error:'Choose a valid RAM type.'};if(i.ramType!==patch.ramType){i.ramType=patch.ramType;events.push({type:'Specification',detail:`RAM type: ${i.ramType}`});}}
   if(patch?.condition!==undefined){if(!conditions.includes(patch.condition))return {ok:false,error:'Choose a valid condition.'};if(i.condition!==patch.condition){i.condition=patch.condition;events.push({type:'Condition',detail:`Condition set to ${i.condition}`});}}
   if(patch?.status!==undefined){if(!statuses.includes(patch.status))return {ok:false,error:'Choose a valid processing status.'};if(i.status!==patch.status){i.status=patch.status;events.push({type:'Status',detail:`Status set to ${i.status}`});}}
   if(patch?.inspection){const inp=patch.inspection;const next={cosmetic:cosmetics.includes(inp.cosmetic)?inp.cosmetic:i.inspection.cosmetic,functional:functions.includes(inp.functional)?inp.functional:i.inspection.functional,battery:batteries.includes(inp.battery)?inp.battery:i.inspection.battery};if(JSON.stringify(next)!==JSON.stringify(i.inspection)){
     i.inspection=next;i.grade=assess(next).grade;events.push({type:'Assessment',detail:`Suggested grade ${i.grade}. Assigned condition unchanged.`});
   }}
   if(events.length){i.updatedAt=new Date().toISOString();i.history=[...i.history,...events.map(x=>({...x,at:i.updatedAt}))].slice(-120);}
   Object.assign(original,i);
   return {ok:true,item:original};
 }
 return {assess,normalize,add,update,cosmetics,functions,batteries,statuses,conditions,productTypes,ramTypes,ssdTypes};
});
