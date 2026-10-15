'use strict';
(function () {
 const core = typeof require === 'function' ? require('./inventory-core') : window.ApexInventoryCore;
 const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
 const key = value => clean(value).toUpperCase();
 const equal = (a,b) => key(a)===key(b);
 function listPallets(db) {
  const active=(db.items||[]).filter(x=>!x.deletedAt);
  const saved=(Array.isArray(db.pallets)?db.pallets:[]).filter(p=>p&&clean(p.name)).map(p=>({name:p.name,label:p.label||'',location:p.location||'',storageLocation:p.storageLocation||'',managed:true,createdAt:p.createdAt||''}));
  for(const item of active) if(clean(item.pallet)&&!saved.some(p=>equal(p.name,item.pallet))) saved.push({name:item.pallet,label:'',location:'',storageLocation:'',managed:false,createdAt:''});
  return saved.map(p=>({...p,assets:active.filter(a=>equal(a.pallet,p.name)).length})).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
 }
 function palletLocations(db){
  const names=Array.isArray(db.palletLocations)?db.palletLocations.filter(n=>typeof n==='string'&&clean(n)):[];
  const pallets=listPallets(db),out=[];
  for(const name of [...names,...pallets.map(p=>p.storageLocation||'')]){
   if(!clean(name)||out.some(n=>equal(n,name)))continue;
   out.push(clean(name));
  }
  return out.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 }
 function createPalletLocation(db,input={}){
  const name=clean(input.name);
  if(!name||name.length>90||/[<>\r\n\x00-\x1f]/.test(name))return {ok:false,error:'Enter a pallet location name of 1–90 characters.'};
  if(palletLocations(db).some(n=>equal(n,name)))return {ok:false,error:'That pallet location already exists.'};
  db.palletLocations=[...(db.palletLocations||[]),name];
  return {ok:true,palletLocations:palletLocations(db)};
 }
 function deletePalletLocation(db,input={}){
  const name=palletLocations(db).find(n=>equal(n,input.name));
  if(!name)return {ok:false,error:'Pallet location not found.'};
  const count=listPallets(db).filter(p=>equal(p.storageLocation,name)).length;
  if(count)return {ok:false,error:`This location contains ${count} pallet(s). Move them out before deleting it.`,palletCount:count};
  db.palletLocations=(Array.isArray(db.palletLocations)?db.palletLocations:[]).filter(n=>!equal(n,name));
  return {ok:true,removed:name,palletLocations:palletLocations(db)};
 }
 function movePallets(db,input={}){
  const names=Array.isArray(input.names)?input.names.map(key):[];
  if(!names.length||names.length>300||names.some(n=>!n)||new Set(names).size!==names.length)return {ok:false,error:'Select between 1 and 300 different pallets.'};
  const target=clean(input.location),location=target?palletLocations(db).find(n=>equal(n,target)):'';
  if(target&&!location)return {ok:false,error:'Choose an existing pallet location.'};
  const all=listPallets(db),selected=names.map(n=>all.find(p=>equal(p.name,n)));
  if(selected.some(p=>!p))return {ok:false,error:'A pallet no longer exists. Refresh and try again.'};
  if(!Array.isArray(input.expected)||input.expected.length!==names.length)return {ok:false,error:'Refresh the pallets before moving them.'};
  const expected=new Map(input.expected.map(p=>[key(p.name),p]));
  if(expected.size!==names.length||selected.some(p=>!expected.has(key(p.name))||!equal(p.storageLocation,expected.get(key(p.name)).location)))return {ok:false,error:'A pallet changed location. Refresh and try again.'};
  const next=(db.pallets||[]).map(p=>({...p}));
  for(const p of selected){let saved=next.find(x=>equal(x.name,p.name));if(!saved){saved={name:p.name,label:p.label||'',location:p.location||'',createdAt:p.createdAt||''};next.push(saved);}saved.storageLocation=location||'';saved.updatedAt=new Date().toISOString();}
  db.pallets=next;
  // Pallet location changes leave the asset's direct Location field unchanged.
  // Add a dated asset history entry so the move appears in History & checks.
  const now=new Date().toISOString();
  for(const p of selected){
   if(equal(p.storageLocation,location))continue;
   for(const asset of db.items||[]){
    if(asset.deletedAt||!equal(asset.pallet,p.name))continue;
    const old=clean(p.storageLocation)||'Unassigned',destination=location||'Unassigned';
    asset.history=[...(Array.isArray(asset.history)?asset.history:[]),{id:'move-'+now+'-'+Math.random().toString(36).slice(2),type:'Pallet location',detail:`Pallet ${p.name} moved: ${old} → ${destination}`,at:now}].slice(-120);
    asset.updatedAt=now;
   }
  }
  return {ok:true,moved:names.length,pallets:listPallets(db),palletLocations:palletLocations(db)};
 }
 function nextPalletId(db) {
  const registered=new Set(listPallets(db).map(p=>key(p.name)));
  let n=1;
  while(registered.has(`PALLET-${String(n).padStart(4,'0')}`)) n++;
  return `PALLET-${String(n).padStart(4,'0')}`;
 }
 // One device is stored in a direct Location OR on a Pallet, never both.
 // A pallet transfer clears the direct location to the explicit Unassigned value.
 function moveBatch(db,input={}) {
  const ids=Array.isArray(input.ids)?input.ids.map(key):[];
  if(ids.length<1||ids.length>300)return {ok:false,error:'Scan between 1 and 300 devices for one move.'};
  if(ids.some(id=>!id||id.length>80)||new Set(ids).size!==ids.length)return {ok:false,error:'Invalid or duplicated Asset IDs.'};
  const existing=ids.map(id=>(db.items||[]).find(a=>key(a.id)===id&&!a.deletedAt));
  if(existing.some(x=>!x))return {ok:false,error:'One or more Asset IDs no longer exist. Refresh the scan list.'};
  const palletName=clean(input.pallet);
  let location='Unassigned',pallet='';
  if(palletName){const selected=listPallets(db).find(p=>equal(p.name,palletName));if(!selected)return {ok:false,error:'That pallet does not exist.'};pallet=selected.name;}
  else {const chosen=(db.locations||[]).find(l=>equal(l,input.location));if(!chosen)return {ok:false,error:'Choose an existing location. You can add locations from Inventory → Locations.'};location=chosen;}
  // Optional concurrency check: a scan must not move a device whose assignment
  // changed after it was scanned. Validate *all* entries before making any edits.
  if(input.expectedAssignments!==undefined){
   if(!Array.isArray(input.expectedAssignments)||input.expectedAssignments.length!==ids.length)return {ok:false,error:'Refresh the scanned devices and try again.'};
   const expected=new Map();
   for(const entry of input.expectedAssignments){
    const id=key(entry?.id);
    if(!id||expected.has(id)||!ids.includes(id))return {ok:false,error:'Invalid scan assignment snapshot.'};
    expected.set(id,entry);
   }
   if(existing.some((a,i)=>!expected.has(ids[i])||!equal(a.location,expected.get(ids[i]).location)||!equal(a.pallet,expected.get(ids[i]).pallet)||(expected.get(ids[i]).updatedAt&&a.updatedAt!==expected.get(ids[i]).updatedAt)))
    return {ok:false,error:'A laptop changed location since it was scanned. Refresh the list and review the move.'};
  }
  // Stage every update on independent copies: no partial saves on validation failures.
  const copies=[];
  for(const old of existing){const next=structuredClone(old),out=core.update([next],next.id,{location,pallet});if(!out.ok)return out;copies.push(next);}
  copies.forEach((copy,i)=>{db.items[db.items.indexOf(existing[i])]=copy;});
  return {ok:true,moved:copies.length,ids,location,pallet};
 }
 // Restore a recently moved batch atomically. Each asset must still be in the
 // location assigned by the original move, to avoid overwriting later activity.
 function restoreBatch(db,input={}){
  const entries=Array.isArray(input.entries)?input.entries:[];
  if(entries.length<1||entries.length>300)return {ok:false,error:'No recent batch to undo.'};
  const ids=entries.map(e=>key(e?.id));
  if(ids.some(id=>!id||id.length>80)||new Set(ids).size!==ids.length)return {ok:false,error:'Invalid or repeated Asset ID in undo request.'};
  const originals=ids.map(id=>(db.items||[]).find(a=>key(a.id)===id&&!a.deletedAt));
  if(originals.some(x=>!x))return {ok:false,error:'A moved asset is missing. Nothing was undone.'};
  const restored=[];
  for(let i=0;i<entries.length;i++){
   const entry=entries[i],old=originals[i];
   if(!equal(old.location,entry.expectedLocation)||!equal(old.pallet,entry.expectedPallet)||(entry.expectedUpdatedAt&&old.updatedAt!==entry.expectedUpdatedAt))
    return {ok:false,error:`${old.id} has changed since the move. Nothing was undone.`};
   const location=clean(entry.location)||'Unassigned';
   const pallet=clean(entry.pallet);
   // Historical assets may still carry pallet values although pallet management
   // was removed from the UI. Undo must preserve that exact original assignment.
   if(pallet.length>80||/[<>\r\n]/.test(pallet))return {ok:false,error:'Invalid historical pallet assignment.'};
   if(!equal(location,'Unassigned')&&(!Array.isArray(db.locations)||!db.locations.some(l=>equal(l,location))))
    return {ok:false,error:`The previous location for ${old.id} no longer exists.`};
   const copy=structuredClone(old),result=core.update([copy],copy.id,{location,pallet});
   if(!result.ok)return result;
   restored.push(copy);
  }
  restored.forEach((copy,i)=>{db.items[db.items.indexOf(originals[i])]=copy;});
  return {ok:true,restored:restored.length,ids};
 }
 // Can optionally create the pallet and assign a scanned batch as ONE transaction.
 function createPallet(db,input={}) {
  if(!Array.isArray(db.pallets))db.pallets=[];
  const name=clean(input.name)||nextPalletId(db);
  const label=clean(input.label);
  if(!name||name.length>80||/[<>\x00-\x1f\x7f]/.test(name))return {ok:false,error:'Enter a pallet name or number of 1–80 characters, without < or >.'};
  if(label.length>90||/[<>\r\n]/.test(label))return {ok:false,error:'Pallet name must be 90 characters or fewer.'};
  if(listPallets(db).some(p=>equal(p.name,name)))return {ok:false,error:'That pallet name or number already exists. Choose a different one.'};
  const proposed={name,label,location:'',createdAt:new Date().toISOString()};
  const ids=Array.isArray(input.ids)?input.ids:[];
  if(ids.length){
   const draft={...db,pallets:[...db.pallets,proposed],items:db.items.map(a=>structuredClone(a))};
   const move=moveBatch(draft,{ids,pallet:name});if(!move.ok)return move;
   db.items=draft.items;
  }
  db.pallets.push(proposed);
  return {ok:true,pallet:{...proposed,assets:ids.length},moved:ids.length,pallets:listPallets(db)};
 }
 function deletePallet(db,input={}) {
  const current=listPallets(db).find(p=>equal(p.name,input.name));
  if(!current)return {ok:false,error:'Pallet not found.'};
  const existing=(db.items||[]).filter(a=>!a.deletedAt&&equal(a.pallet,current.name));
  if(existing.length&&!input.unassign)return {ok:false,error:`${existing.length} device(s) are on this pallet. Confirm before unassigning.`,requiresConfirmation:true};
  const next=[];
  for(const old of existing){const copy=structuredClone(old),r=core.update([copy],copy.id,{pallet:''});if(!r.ok)return r;next.push(copy);}
  next.forEach((copy,i)=>{db.items[db.items.indexOf(existing[i])]=copy;});
  db.pallets=(db.pallets||[]).filter(p=>!equal(p.name,current.name));
  return {ok:true,removed:current.name,unassigned:next.length};
 }
 const api={palletLocations,createPalletLocation,deletePalletLocation,movePallets,listPallets,nextPalletId,createPallet,moveBatch,restoreBatch,deletePallet};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(typeof window!=='undefined')window.ApexPalletManagement=api;
})();
