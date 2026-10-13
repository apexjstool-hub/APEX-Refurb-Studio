/* Upgrade 4 — view preferences only; existing inventory model is authoritative. */
(()=>{
'use strict';
const init=()=>{
 const root=document.getElementById('inventoryPage');
 const density=document.getElementById('apexInventoryDensity');
 const reset=document.getElementById('apexInventoryReset');
 const results=document.getElementById('apexInventoryResults');
 const table=document.getElementById('inventoryTable');
 if(!root||!density||!reset||!table||!results)return;
 let pref='compact';
 try{pref=localStorage.getItem('apex.inventory.density')==='comfortable'?'comfortable':'compact';}catch(_e){}
 density.value=pref;
 root.classList.toggle('apex-inventory-comfortable',pref==='comfortable');
 density.addEventListener('change',()=>{
  root.classList.toggle('apex-inventory-comfortable',density.value==='comfortable');
  try{localStorage.setItem('apex.inventory.density',density.value);}catch(_e){}
 });
 const ids=['inventorySearch','locationFilter','gradeFilter','statusFilter'];
 const update=()=>{
  const bar=table.querySelector('.v395-pagebar span');
  results.textContent=bar?bar.textContent.split(' · Page')[0]:'Inventory records';
  const active=ids.some(id=>{const el=document.getElementById(id);return el&&(id==='statusFilter'?el.value!=='All statuses':Boolean(el.value));});
  reset.disabled=!active;
 };
 reset.addEventListener('click',()=>{
  for(const id of ids){const el=document.getElementById(id);if(!el)continue;el.value=id==='statusFilter'?'All statuses':'';}
  // Use existing handlers, so filters and pagination are refreshed by the app itself.
  document.getElementById('locationFilter')?.dispatchEvent(new Event('change',{bubbles:true}));
  update();
 });
 const observer=new MutationObserver(update);
 observer.observe(table,{childList:true,subtree:false});
 for(const id of ids)document.getElementById(id)?.addEventListener(id==='inventorySearch'?'input':'change',update);
 update();
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
