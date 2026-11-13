'use strict';
/* Microdream pallet status presentation only; reads existing workflow snapshots.
   No new dispatch, return, completion or database mutation paths. */
(function(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const equal=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
 let loading=false,revision=0;
 function decorate(workflow){
  const page=document.getElementById('palletLocationDetailPage');
  if(!page||page.classList.contains('hidden'))return;
  const rows=page.querySelectorAll('tr[data-pl-pallet-name]');if(!rows.length)return;
  const shipments=(workflow?.resprayPallets||[]).filter(x=>x&&x.palletName);
  for(const row of rows){
   // Only Microdream rows expose the existing protected respray action.
   if(!row.querySelector('[data-pl-respray]'))continue;
   const name=row.dataset.plPalletName;
   const records=shipments.filter(s=>equal(s.palletName,name)).sort((a,b)=>String(b.dispatchedAt||'').localeCompare(String(a.dispatchedAt||'')));
   const current=records.find(s=>s.status==='Dispatched'||s.status==='Returned')||records[0];
   let badge=row.querySelector('.pl-microdream-status');
   if(!badge){badge=document.createElement('span');badge.className='pl-microdream-status';const palletCell=row.querySelector('td:nth-child(2)')||row.querySelector('td');palletCell?.appendChild(badge);}
   if(!badge)continue;
   const stage=current?.status||'Not dispatched';
   badge.dataset.stage=stage;
   badge.textContent=stage==='Dispatched'?'Sent for respray':stage==='Returned'?'Returned — inspect':stage==='Completed'?'Respray completed':'Not dispatched';
   badge.title=current?'Latest recorded dispatch: '+(current.dispatchedAt||'Date unavailable'):'No Microdream dispatch history recorded for this pallet';
  }
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
 window.ApexPalletStatusPolish=Object.freeze({decorate,refresh});
 window.addEventListener('apex:workflow-updated',()=>decorate(window.ApexWorkflowSnapshot));
})();
