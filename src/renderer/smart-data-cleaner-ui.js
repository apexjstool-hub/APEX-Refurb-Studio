'use strict';
(function(){
 const $=id=>document.getElementById(id), cleaner=window.ApexSmartDataCleaner;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let busy=false;
 function open(){
  if(busy)return;
  const selected=window.ApexInventorySelection?.selected?.inventory||new Set();
  const hasSelected=selected.size>0;
  showModal('Smart Data Cleaner','INVENTORY / CLEAN & STANDARDISE',
   '<div class="smart-cleaner"><p class="section-note">Preview formatting changes before saving. Asset IDs, pallets, statuses, inspections and parts workflow are never changed.</p>'+
   '<div class="smart-cleaner-settings"><label class="field">Records<select id="cleanScope"><option value="selected" '+(hasSelected?'':'disabled')+'>Selected assets ('+selected.size+')</option><option value="all" '+(!hasSelected?'selected':'')+'>All inventory</option></select></label>'+
   '<label><input type="checkbox" id="cleanHardware" checked> Manufacturers, models, processor, RAM and storage</label>'+
   '<label><input type="checkbox" id="cleanSerial" checked> Serial numbers (uppercase)</label>'+
   '<label><input type="checkbox" id="cleanNotes"> Notes: whitespace, punctuation spacing and sentence starts (optional)</label></div>'+
   '<p class="section-note">Serials keep the same characters except letter case and surrounding spaces. Check external manufacturer records before standardising case-sensitive identifiers.</p>'+
   '<div id="cleanSummary" aria-live="polite"></div><div id="cleanPreview" class="smart-cleaner-preview"></div>'+
   '<div id="cleanError" class="form-error" role="alert"></div>'+
   '<div class="modal-actions"><button type="button" class="secondary" id="cleanCancel">Close</button><button type="button" class="primary" id="cleanApply" disabled>Apply reviewed changes</button></div></div>');
  const modal=$('cleanPreview'),apply=$('cleanApply');let proposed=[];
  function build(){
   const opts={hardware:$('cleanHardware').checked,serial:$('cleanSerial').checked,notes:$('cleanNotes').checked};
   const ids=$('cleanScope').value==='all'?null:new Set(selected);
   proposed=items.filter(a=>!a.deletedAt&&(!ids||ids.has(a.id))).map(a=>({id:a.id,...cleaner.plan(a,opts)})).filter(p=>p.changes.length);
   const count=proposed.reduce((n,p)=>n+p.changes.length,0);
   $('cleanSummary').textContent=proposed.length+' asset(s) · '+count+' proposed field correction(s). No changes saved yet.';
   const limited=proposed.slice(0,80).flatMap(p=>p.changes.slice(0,12).map(change=>'<tr><td>'+escape(p.id)+'</td><td>'+escape(change.field)+'</td><td title="'+escape(change.before)+'">'+escape(change.before)+'</td><td title="'+escape(change.after)+'">'+escape(change.after)+'</td></tr>'));
   modal.innerHTML=count?'<table class="smart-cleaner-table"><thead><tr><th>Asset</th><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>'+limited.join('')+'</tbody></table>'+(proposed.length>80?'<p class="section-note">Showing first 80 assets. All proposed changes will be checked again before saving.</p>':''):'<p class="section-note">No formatting changes needed for this selection.</p>';
   apply.disabled=!count||proposed.length>250;
   $('cleanError').textContent=proposed.length>250?'For safety, select 250 assets or fewer per operation.':'';
  }
  for(const id of ['cleanScope','cleanHardware','cleanSerial','cleanNotes'])$(id).onchange=build;
  $('cleanCancel').onclick=closeModal;
  apply.onclick=async()=>{
   if(busy||!proposed.length)return;
   const total=proposed.length;
   if(!confirm('Apply reviewed formatting updates to '+total+' asset(s)? These updates will be saved to inventory and recorded in asset history.'))return;
   busy=true;apply.disabled=true;$('cleanCancel').disabled=true;
   let saved=0,skipped=0,failed=0;const errors=[];
   try{
    for(const proposal of proposed){
     // Detect changes since the preview; do not write a stale result.
     const latest=items.find(a=>a.id===proposal.id);
     if(!latest||latest.deletedAt||proposal.changes.some(ch=>latest[ch.field]!==ch.before)){skipped++;continue;}
     const result=await api.update(proposal.id,proposal.patch);
     if(result?.ok)saved++;else{failed++;errors.push(proposal.id+': '+(result?.error||'Could not save'));}
    }
    await refresh();
    $('cleanSummary').textContent='Completed: '+saved+' updated, '+skipped+' skipped (changed since preview), '+failed+' failed.';
    modal.innerHTML='';
    $('cleanError').textContent=errors.slice(0,6).join(' · ');
    notify('Smart Data Cleaner: '+saved+' asset(s) updated.');
   }catch(e){$('cleanError').textContent=e.message||'Unexpected error while cleaning.';}
   finally{busy=false;$('cleanCancel').disabled=false;apply.disabled=true;}
  };
  build();
 }
 function install(){
  const bar=$('selection-toolbar-inventory');if(!bar||$('apexSmartCleanButton'))return;
  const button=document.createElement('button');button.id='apexSmartCleanButton';button.type='button';button.className='secondary apex-smart-clean-button';button.textContent='✦ Clean & Standardise';button.title='Preview and standardise device names, serials and specifications';
  button.onclick=open;const bulk=$('inventoryBulkRefurbButton');(bulk||bar.querySelector('.inventory-selection-scan'))?.after(button);
 }
 const original=render;render=function(...args){const out=original(...args);install();return out;};
 window.ApexSmartCleanerUI={open,install};install();
})();
