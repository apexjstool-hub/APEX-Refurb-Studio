'use strict';
/* Admin-only recent intake receipts, supplied by the authenticated Shared Hub. */
(function(){
 const el=id=>document.getElementById(id), api=window.apexInventory;
 if(!el('verificationPanel'))return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let events=[],loading=false,mode='unknown';
 const time=s=>{const t=Date.parse(s);return Number.isFinite(t)?new Date(t).toLocaleString():'Unknown';};
 function render(){
  const filter=el('verificationFilter').value;
  const saved=events.filter(e=>e.outcome==='saved').length,review=events.filter(e=>e.outcome==='rejected'||(e.warnings||[]).length).length;
  el('verificationTotals').textContent=(mode==='shared'||mode==='demo')?`${events.length} ${mode==='demo'?'sample':'recent'} receipts · ${saved} saved · ${review} need review`:mode==='loading'?'Loading hub receipts…':mode==='local'?'Shared hub not connected':'Hub status unavailable';
  const filtered=events.filter(e=>filter==='all'||(filter==='review'?(e.outcome==='rejected'||(e.warnings||[]).length):e.outcome===filter));
  el('verificationRows').innerHTML=filtered.length?filtered.slice(0,60).map(e=>{
   const outcome=e.outcome==='rejected'?'Rejected':e.outcome==='unchanged'?'No change':'Saved';
   const warning=(e.warnings||[]).join(' · '),notes=e.reason||warning||(e.outcome==='unchanged'?'Duplicate or older submission':'Received by hub (cloud sync not verified)');
   const canOpen=!!e.assetId&&typeof items!=='undefined'&&items.some(a=>String(a.id).toUpperCase()===String(e.assetId).toUpperCase());
   return `<tr><td>${esc(time(e.at))}</td><td>${esc(e.source)}<br><small>${esc(e.device||'Unknown device')}</small></td><td>${esc(e.assetId||'—')}</td><td><span class="verification-result ${esc(e.outcome)}">${esc(outcome)}</span></td><td>${esc(notes)}</td><td>${canOpen?`<button class="secondary" type="button" data-intake-asset="${esc(e.assetId)}">Open device</button>`:e.outcome==='saved'?`<button class="secondary" type="button" data-intake-check="${esc(e.assetId)}">Check inventory</button>`:''}</td></tr>`;
  }).join(''):`<tr><td colspan="6">${mode==='local'?'Connect Smart Inventory to your Shared Hub to see imported records.':(mode==='shared'||mode==='demo')?'No matching receipts yet.':'Could not retrieve hub receipts.'}</td></tr>`;
  el('verificationRows').querySelectorAll('[data-intake-asset]').forEach(button=>button.onclick=()=>{
   const id=button.dataset.intakeAsset;
   // Opening a detail page never changes inventory records.
   if(typeof openAsset==='function')openAsset(id);
  });
  el('verificationRows').querySelectorAll('[data-intake-check]').forEach(button=>button.onclick=async()=>{
   const id=button.dataset.intakeCheck;
   button.disabled=true;button.textContent='Checking…';
   try{
    if(typeof window.refresh==='function')await window.refresh();
    const match=typeof items!=='undefined'&&items.some(a=>String(a.id).toUpperCase()===String(id).toUpperCase());
    if(match){if(typeof openAsset==='function')openAsset(id);else button.textContent='Found in inventory';}
    else{
     button.textContent='Not in this inventory';
     el('verificationFootnote').textContent=`Asset ${id} was saved by the Hub, but is not in this Studio inventory. If you are signed into Cloud Inventory, start/check APEX Cloud Sync on the hub PC under Settings, then refresh Inventory. Do not re-scan or duplicate the asset.`;
    }
   }catch{button.textContent='Unable to check';}
   finally{button.disabled=false;}
  });
 }
 async function refresh(){
  if(loading||el('settingsPage').classList.contains('hidden')||el('appPage').classList.contains('hidden'))return;
  loading=true;el('verificationRefresh').disabled=true;mode='loading';render();
  try{
   const r=typeof api.intakeReceipts==='function'?await api.intakeReceipts():{ok:false,error:'Updated Studio required.'};
   if(!r.ok){mode='error';events=[];el('verificationFootnote').textContent=r.error||'Cannot retrieve intake history.';}

   else if(r.mode==='demo'){mode='demo';events=Array.isArray(r.events)?r.events:[];el('verificationFootnote').textContent='DEMO DATA ONLY — browser preview is not connected to your inventory. Actual receipt history requires the Windows Studio and shared hub.';}
   else if(r.mode==='local'){mode='local';events=[];el('verificationFootnote').textContent='This panel records imports acknowledged by the Shared Hub; it does not list pending offline files.';}
   else{mode='shared';events=Array.isArray(r.events)?r.events:[];el('verificationFootnote').textContent='Latest '+(r.retained||250)+' hub receipts retained. Records before this upgrade do not appear; offline pending jobs remain on the sending device.';}
  }catch(e){mode='error';events=[];el('verificationFootnote').textContent='Hub not reachable. Refresh when your connection is restored.';}
  finally{loading=false;el('verificationRefresh').disabled=false;render();}
 }
 el('verificationRefresh').onclick=refresh;
 el('verificationFilter').onchange=render;
 el('v3Settings')?.addEventListener('click',()=>setTimeout(refresh,70));
 document.querySelectorAll('.menu-item[data-page="settings"]').forEach(e=>e.addEventListener('click',()=>setTimeout(refresh,70)));
 setInterval(()=>{if(!el('settingsPage').classList.contains('hidden'))refresh();},30000);
})();
