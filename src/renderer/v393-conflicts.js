'use strict';
/* Admin-only review of serial conflicts from the Hub. Only safe summary fields are rendered. */
(function(){
 const el=id=>document.getElementById(id),api=window.apexInventory;
 if(!el('conflictPanel'))return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let rows=[],mode='unknown',selected=null,busy=false;
 const time=s=>{const n=Date.parse(s||'');return Number.isFinite(n)?new Date(n).toLocaleString():'Unknown time'};
 function render(){
  const filter=el('conflictFilter').value;
  const pending=rows.filter(x=>x.status==='pending').length;
  el('conflictCount').textContent=mode==='loading'?'Loading…':mode==='error'?'Cannot retrieve conflicts':`${pending} need a decision · ${rows.length} total${mode==='demo'?' (sample data)':''}`;
  const list=rows.filter(x=>filter==='all'||(filter==='pending'?x.status==='pending':x.status!=='pending'));
  el('conflictRows').innerHTML=list.length?list.map(x=>`<tr><td><b>${esc(x.assetId)}</b><br><small>${esc(time(x.createdAt))}</small></td><td>${esc(x.source)}<br><small>${esc(x.device||'Older client')}</small></td><td>${esc(x.existing?.serial||'—')}</td><td>${esc(x.incoming?.serial||'—')}</td><td><span class="conflict-status ${esc(x.status)}">${esc(x.status==='pending'?'Needs review':x.status==='accepted'?'Accepted':'Kept existing')}</span></td><td>${x.status==='pending'?`<button class="secondary" type="button" data-conflict-id="${esc(x.id)}">Review</button>`:''}</td></tr>`).join(''):`<tr><td colspan="6">${mode==='local'?'Connect to a Shared Hub to review incoming records.':mode==='error'?'Hub unavailable. Try Refresh.':'No conflicts match this filter.'}</td></tr>`;
  el('conflictRows').querySelectorAll('[data-conflict-id]').forEach(button=>button.onclick=()=>{selected=button.dataset.conflictId;renderReview()});
  if(selected&&!rows.some(x=>x.id===selected&&x.status==='pending'))selected=null;
  renderReview();
 }
 function renderReview(){
  const view=el('conflictReview'),entry=rows.find(x=>x.id===selected&&x.status==='pending');
  if(!entry){view.hidden=true;view.innerHTML='';return;}
  const box=(label,a)=>`<div class="conflict-identity"><small>${label}</small><b>${esc([a.manufacturer,a.model].filter(Boolean).join(' ')||'Unknown device')}</b><span>Serial: <strong>${esc(a.serial)}</strong></span></div>`;
  view.hidden=false;view.innerHTML=`<h3>Resolve ${esc(entry.assetId)} — ${esc(entry.source)}</h3><div class="conflict-compare">${box('Currently saved in Smart Inventory',entry.existing||{})}${box('Incoming device submission',entry.incoming||{})}</div><p class="conflict-warning">Keep existing rejects this incoming identity; the sending device must be corrected before it can sync. Use incoming changes the asset serial and imports the saved submission, but does not change assigned location, condition or status. Verify the physical laptop first.</p><div class="conflict-actions"><button class="secondary" id="conflictCancel" type="button">Cancel</button><button class="secondary" id="conflictKeep" type="button">Keep existing</button><button class="primary" id="conflictUse" type="button">Use incoming record</button></div>`;
  el('conflictCancel').onclick=()=>{selected=null;renderReview()};
  el('conflictKeep').onclick=()=>act(entry,'keepExisting');
  el('conflictUse').onclick=()=>act(entry,'useIncoming');
 }
 async function act(entry,decision){
  if(busy)return;
  const prompt=decision==='useIncoming'?`Replace the saved serial for ${entry.assetId} with ${entry.incoming.serial} and import the queued ${entry.source} record?`:`Keep the current serial for ${entry.assetId} and dismiss this conflicting submission?`;
  if(!window.confirm(prompt))return;
  busy=true;el('conflictReview').querySelectorAll('button').forEach(b=>b.disabled=true);
  try{const r=await api.resolveSyncConflict({id:entry.id,decision});if(!r.ok){el('conflictFootnote').textContent=r.error||'Conflict could not be resolved. Refresh and check the asset.';return;}
   selected=null;el('conflictFootnote').textContent=decision==='useIncoming'?'Incoming record accepted. Verify the asset details and any refurbishment work.':'Existing asset kept. Correct the source record so it stops retrying the rejected submission.';
   busy=false;await refresh();
  }catch(e){el('conflictFootnote').textContent='Hub unavailable. No automatic retry was attempted. Refresh before trying again.';}
  finally{busy=false;renderReview()}
 }
 async function refresh(){if(busy&&mode!=='loading')return;
  mode='loading';el('conflictRefresh').disabled=true;
  try{const r=typeof api.syncConflicts==='function'?await api.syncConflicts():{ok:false,error:'Update Studio to review conflicts.'};
   if(!r.ok){rows=[];mode='error';el('conflictFootnote').textContent=r.error||'Hub unavailable.';}
   else{mode=r.mode||'shared';rows=Array.isArray(r.conflicts)?r.conflicts:[];if(mode==='demo')el('conflictFootnote').textContent='Browser demo only. Decisions here do not affect the Shared Hub.';else if(mode==='local')el('conflictFootnote').textContent='Shared Hub is not configured in this Studio.';}
  }catch(e){mode='error';rows=[];el('conflictFootnote').textContent='Cannot reach Hub. Check your network.';}
  finally{el('conflictRefresh').disabled=false;render()}
 }
 el('conflictRefresh').onclick=refresh;el('conflictFilter').onchange=render;
 el('v3Settings')?.addEventListener('click',()=>setTimeout(refresh,80));
 document.querySelectorAll('.menu-item[data-page="settings"]').forEach(e=>e.addEventListener('click',()=>setTimeout(refresh,80)));
 setInterval(()=>{if(!el('settingsPage').classList.contains('hidden'))refresh()},45000);
})();
