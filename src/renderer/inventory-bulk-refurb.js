'use strict';
/* Inventory bulk refurbishment: USB QR/barcode input + existing selected rows.
   Mutations use one validated workflowAction transaction per whole batch. */
(function(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const $=id=>document.getElementById(id);
 const read=raw=>(window.ApexAssetLabelQR?.readAssetId(raw)||String(raw||'').trim()).toUpperCase();
 const labels={ordered:'Parts ordered',received:'Parts received',fitted:'Parts fitted',resprayComplete:'Respray Complete'};
 let busy=false;
 async function open(ids=[]){
  const chosen=new Set(ids.map(read).filter(Boolean));
  showModal('Bulk refurbishment update','INVENTORY / BULK PROCESSING',`<div class="modal-body apex-bulk-modal">
   <p class="section-note">Scan multiple laptop barcodes/QR codes, or start with selected Inventory rows. Changes are only saved after you confirm the entire eligible batch.</p>
   <form id="apexBulkScanForm" class="apex-bulk-scan"><label class="field" for="apexBulkScan">Scan / enter Asset ID<input id="apexBulkScan" autofocus autocomplete="off" spellcheck="false" placeholder="Scan asset barcode, then press Enter"></label><button type="submit" class="secondary">Add</button></form>
   <div class="apex-bulk-summary"><strong id="apexBulkCount">0 devices selected</strong><button type="button" class="secondary" id="apexBulkClear">Clear batch</button></div>
   <div id="apexBulkDevices" class="apex-bulk-devices" aria-live="polite"></div>
   <label class="field">Bulk refurbishment action<select id="apexBulkStage"><option value="ordered">Parts ordered</option><option value="received">Parts received</option><option value="fitted">Parts fitted</option><option value="resprayComplete">Respray Complete</option></select></label>
   <div id="apexBulkOrderInfo"><label class="field">Supplier (optional)<input id="apexBulkSupplier" maxlength="120" placeholder="Optional supplier name"></label><label class="field">Additional reference (optional)<input id="apexBulkReference" maxlength="90"></label><p class="section-note">Recording Parts Ordered confirms an existing purchase; APEX will not send an order to any supplier.</p></div>
   <div id="apexBulkReview" class="apex-bulk-review" role="status">Loading refurbishment records…</div>
   <p class="section-note" id="apexBulkActionHelp">Replacement part actions only affect replacement parts. Respray Complete marks the selected laptops’ cosmetic respray tasks as returned and checked, leaving unrelated parts and final QC unchanged.</p><label class="field" id="apexBulkResprayConfirm" hidden><span><input type="checkbox" id="apexBulkResprayChecked"> I have physically checked that all selected respray work is complete</span></label>
   <p class="form-error" id="apexBulkError" role="alert"></p>
   <div class="modal-actions"><button type="button" class="secondary" id="apexBulkCancel">Close</button><button type="button" class="primary" id="apexBulkApply" disabled>Confirm bulk update</button></div>
  </div>`);
  const root=$('apexBulkDevices'),input=$('apexBulkScan'),stage=$('apexBulkStage'),apply=$('apexBulkApply');
  let workflow=null,plan=null,requestId=0;
  $('apexBulkCancel').onclick=()=>{if(!busy)closeModal();};
  function renderIds(){
   const selected=[...chosen];
   $('apexBulkCount').textContent=selected.length+' laptop'+(selected.length===1?'':'s')+' selected';
   root.innerHTML=selected.length?selected.map(id=>{
    const asset=items.find(a=>String(a.id).toUpperCase()===id&&!a.deletedAt);
    return '<div class="apex-bulk-device"><div><b>'+esc(id)+'</b><small>'+esc(asset?deviceName(asset):'Not found in active inventory')+'</small></div><button type="button" class="secondary" data-apex-bulk-remove="'+esc(id)+'" aria-label="Remove '+esc(id)+'">×</button></div>';
   }).join(''):'<p class="section-note">No laptops scanned. Scan or enter an Asset ID above.</p>';
  }
  function refreshPlan(){
   const revision=++requestId,mode=stage.value,selected=[...chosen];
   $('apexBulkOrderInfo').hidden=mode!=='ordered';
   $('apexBulkResprayConfirm').hidden=mode!=='resprayComplete';
   if(mode!=='resprayComplete')$('apexBulkResprayChecked').checked=false;
   plan=null;apply.disabled=true;
   if(!selected.length){$('apexBulkReview').textContent='Scan at least one laptop to begin.';return;}
   if(!workflow){$('apexBulkReview').textContent='Loading the latest refurbishment workflow…';return;}
   try{
    const preview=window.ApexBulkRefurbPlan.prepare(workflow,items,selected,mode);
    if(revision!==requestId)return;
    plan=preview;
    const lines=preview.lines.length,failed=preview.invalid;
    $('apexBulkReview').innerHTML='<div class="apex-bulk-metrics"><span><b>'+preview.eligible.length+'</b> eligible</span><span><b>'+lines+'</b> part tasks</span><span class="'+(failed.length?'is-warning':'')+'"><b>'+failed.length+'</b> blocked</span></div>'+(failed.length?'<div class="apex-bulk-blocked">'+failed.map(x=>'<p><b>'+esc(x.assetId)+'</b> · '+esc(x.reason)+'</p>').join('')+'</div>':'<p>All scanned laptops can be updated together. Review quantities and confirm after the physical action is done.</p>');
    apply.disabled=!!failed.length||!lines||(mode==='resprayComplete'&&!$('apexBulkResprayChecked').checked);
   }catch(error){$('apexBulkReview').textContent=error.message;}
  }
  function add(raw){
   const id=read(raw);
   if(!id){return;}
   if(!items.some(a=>String(a.id).toUpperCase()===id&&!a.deletedAt)){$('apexBulkError').textContent='Asset '+id+' is not in active Inventory.';return;}
   if(chosen.size>=100&&!chosen.has(id)){$('apexBulkError').textContent='Maximum 100 laptops per batch.';return;}
   $('apexBulkError').textContent='';
   chosen.add(id);renderIds();refreshPlan();
  }
  $('apexBulkScanForm').onsubmit=e=>{e.preventDefault();add(input.value);input.value='';input.focus();};
  $('apexBulkClear').onclick=()=>{chosen.clear();renderIds();refreshPlan();input.focus();};
  root.onclick=e=>{const target=e.target.closest('[data-apex-bulk-remove]');if(!target)return;chosen.delete(target.dataset.apexBulkRemove);renderIds();refreshPlan();};
  stage.onchange=refreshPlan;
  $('apexBulkResprayChecked').onchange=()=>{apply.disabled=!plan||!!plan.invalid.length||!plan.lines.length||(stage.value==='resprayComplete'&&!$('apexBulkResprayChecked').checked);};
  async function load(){
   $('apexBulkError').textContent='';
   try{const result=await api.workflow();if(!result.ok)throw Error(result.error||'Could not read refurbishment workflow.');workflow=result.workflow;refreshPlan();}
   catch(e){$('apexBulkReview').textContent=e.message;apply.disabled=true;}
  }
  apply.onclick=async()=>{
   if(busy||!plan||plan.invalid.length||!plan.lines.length||(stage.value==='resprayComplete'&&!$('apexBulkResprayChecked').checked))return;
   // Refresh immediately before saving. The server validates the same plan
   // signature against the current database, blocking stale changes.
   busy=true;apply.disabled=true;$('apexBulkCancel').disabled=true;
   $('apexBulkError').textContent='';
   try{
    const latest=await api.workflow();if(!latest.ok)throw Error(latest.error||'Could not refresh selected laptops.');
    const fresh=window.ApexBulkRefurbPlan.prepare(latest.workflow,items,[...chosen],stage.value);
    if(fresh.invalid.length||fresh.signature!==plan.signature)throw Error('Selected laptop parts have changed. Review the batch again.');
    const answer=await api.workflowAction({type:'bulkPartsStage',assetIds:[...chosen],stage:stage.value,expectedSignature:plan.signature,confirmChecked:stage.value==='resprayComplete'&&$('apexBulkResprayChecked').checked,supplier:$('apexBulkSupplier').value.trim(),reference:$('apexBulkReference').value.trim()});
    if(!answer.ok)throw Error(answer.error||'The bulk update was not saved.');
    notify(answer.affected+' laptop(s) updated · '+answer.partLines+(stage.value==='resprayComplete'?' respray task(s) completed.':' replacement part task(s).'));
    closeModal();window.ApexOps?.load(true);await refresh();
   }catch(error){$('apexBulkError').textContent=error.message;await load();}
   finally{busy=false;if($('apexBulkCancel'))$('apexBulkCancel').disabled=false;}
  };
  renderIds();await load();input.focus();
 }
 window.ApexBulkRefurb=Object.freeze({open});
})();
