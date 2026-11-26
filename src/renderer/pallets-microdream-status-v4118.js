'use strict';
/* Microdream pallet status presentation only; reads existing workflow snapshots.
   No new dispatch, return, completion or database mutation paths. */
(function(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const equal=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
 let loading=false,revision=0;
 const counts=new Map();
 const count=name=>counts.get(String(name||'').trim().toLowerCase())||0;
 function decorate(workflow){
  const page=document.getElementById('palletLocationDetailPage');
  if(!page||page.classList.contains('hidden'))return;
  const rows=page.querySelectorAll('tr[data-pl-pallet-name]');if(!rows.length)return;
  const shipments=(workflow?.resprayPallets||[]).filter(x=>x&&x.palletName);
  const assignments=(workflow?.resprayAssignments||[]).filter(x=>x&&x.palletName);
  let assignedTotal=0;counts.clear();
  for(const row of rows){
   // Only Microdream rows expose the existing protected respray action.
   if(!row.querySelector('[data-pl-respray]'))continue;
   const name=row.dataset.plPalletName;
   const records=shipments.filter(s=>equal(s.palletName,name)).sort((a,b)=>String(b.dispatchedAt||'').localeCompare(String(a.dispatchedAt||'')));
   const current=records.find(s=>s.status==='Dispatched'||s.status==='Returned')||records[0];
   let badge=row.querySelector('.pl-microdream-status');
   if(!badge){badge=document.createElement('span');badge.className='pl-microdream-status';const palletCell=row.querySelector('td:nth-child(2)')||row.querySelector('td');palletCell?.appendChild(badge);}
   if(!badge)continue;
   const assigned=assignments.find(x=>equal(x.palletName,name));
   const active=current&&['Dispatched','Returned'].includes(current.status)?current:null;
   const reference=active?.reference||assigned?.reference||current?.reference||'—';
   const assignedCount=active?.manifest?.length??assigned?.assetIds?.length??0;
   counts.set(String(name||'').trim().toLowerCase(),assignedCount);
   assignedTotal+=assignedCount;
   const cell=row.querySelector('[data-md-reference]');
   if(cell){cell.textContent=reference;cell.title=reference==='—'?'Assign a Microdream reference in Actions':reference;}
   const inventoryCell=row.querySelector('.pl-pallet-count strong');
   // The inventory cell must show the true assets in this original pallet.
   // Show respray-only membership separately; never overwrite the pallet inventory count.
   let resprayCount=row.querySelector('.pl-respray-count');
   if(!resprayCount){resprayCount=document.createElement('small');resprayCount.className='pl-respray-count';inventoryCell?.parentElement?.appendChild(resprayCount);}
   if(resprayCount)resprayCount.textContent=' · '+assignedCount+' for respray';
   const stage=current?.status||'Not dispatched';
   badge.dataset.stage=stage;
   badge.textContent=stage==='Dispatched'?'Sent for respray':stage==='Returned'?'Returned — inspect':stage==='Completed'?'Respray completed':assigned?'Assigned / awaiting dispatch':'Not dispatched';
   badge.title=current?'Latest recorded dispatch: '+(current.dispatchedAt||'Date unavailable'):'No Microdream dispatch history recorded for this pallet';
  }
  const overview=page.querySelector('.pl-inline-metrics');
  if(overview){let info=overview.querySelector('.pl-md-respray-total');if(!info){info=document.createElement('span');info.className='pl-md-respray-total';overview.appendChild(info);}info.textContent=assignedTotal+' assigned for respray';}
  let groupHost=page.querySelector('#mdReferenceGroups');
  if(!groupHost){groupHost=document.createElement('section');groupHost.id='mdReferenceGroups';groupHost.className='md-reference-groups';page.querySelector('.pl-location-table-scroll')?.after(groupHost);}
  if(groupHost){
   const groups=new Map();
   for(const row of rows){const name=row.dataset.plPalletName,record=assignments.find(a=>equal(a.palletName,name));if(!record)continue;const reference=record.reference||'Unreferenced',bucket=groups.get(reference)||{pallets:new Set(),ids:new Set()};bucket.pallets.add(name);for(const id of record.assetIds||[])bucket.ids.add(id);for(const source of record.sourcePallets||[])bucket.pallets.add(source);groups.set(reference,bucket);}
   groupHost.innerHTML=groups.size?'<h3>Respray references</h3>'+[...groups].map(([ref,entry])=>'<div class="md-reference-group"><strong>'+esc(ref)+'</strong><span>'+entry.ids.size+' respray asset(s) · '+entry.pallets.size+' linked pallet(s)</span><small>Source pallets: '+esc([...entry.pallets].join(', '))+'</small></div>').join(''):'<p class="section-note">No Microdream assignments yet. Move your original pallets here, then assign eligible respray assets to a reference.</p>';
  }
  window.dispatchEvent(new Event('apex:microdream-assignment-counts'));
 }
 async function refresh(){
  const page=document.getElementById('palletLocationDetailPage');if(!page||page.classList.contains('hidden'))return;
  const seq=++revision;
  const snapshot=window.ApexWorkflowSnapshot;
  if(snapshot)decorate(snapshot);
  if(loading||!window.apexInventory?.workflow)return;
  loading=true;
  try{const result=await window.apexInventory.workflow();if(result?.ok&&seq===revision)decorate(result.workflow);}
  catch{/* Keep existing actions available even when workflow status cannot be loaded. */}
  finally{loading=false;}
 }
 window.ApexPalletStatusPolish=Object.freeze({decorate,refresh,count});
 window.addEventListener('apex:workflow-updated',()=>decorate(window.ApexWorkflowSnapshot));
})();
