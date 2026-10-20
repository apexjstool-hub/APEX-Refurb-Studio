'use strict';
(function(){
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function open(palletNames){
  const requestId=crypto.randomUUID();
  showModal('Create Microdream purchase orders','MICRODREAM / SAVE REPORTS',`<form id="mdCreateReports" class="modal-body"><p>A permanent report will be saved for each selected pallet, using its devices and model quantities now. Existing reports remain available.</p><p>${palletNames.map(escape).join(' · ')}</p><label class="field">Job Ref (optional)<input name="jobRef" maxlength="100" autocomplete="off" placeholder="You can update this later"></label><p id="mdCreateError" class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="secondary" id="mdCreateCancel">Cancel</button><button type="submit" class="primary">Create purchase order</button></div></form>`);
  const form=$('mdCreateReports');$('mdCreateCancel').onclick=closeModal;
  form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
   try{const r=await api.microdreamReports({action:'create',palletNames,jobRef:form.elements.jobRef.value,requestId});if(!form.isConnected)return;if(!r.ok)throw Error(r.error||'Could not save reports.');notify(r.reports.length+' permanent report(s) saved.');await preview(r.reports);}
   catch(e){if(form.isConnected)$('mdCreateError').textContent=e.message;}finally{if(button.isConnected)button.disabled=false;}
  };
 }
 async function view(pallet){
  showModal('Microdream reports','MICRODREAM / SAVED REPORTS','<div class="modal-body"><p id="mdReportLoading" role="status">Loading saved reports…</p><div class="modal-actions"><button class="secondary" id="mdReportClose">Close</button></div></div>');
  const status=$('mdReportLoading');$('mdReportClose').onclick=closeModal;
  try{const r=await api.microdreamReports({action:'list',pallet});if(!status.isConnected)return;if(!r.ok)throw Error(r.error||'Could not load reports.');if(!r.reports.length){status.textContent='No saved report for this pallet yet. Select it and use Create purchase order.';return;}await preview(r.reports);}
  catch(e){if(status.isConnected)status.textContent=e.message;}
 }
 async function preview(reports){
  let current=null,draft=null,busy=false,generation=0;
  showModal('Microdream purchase order — saved report','MICRODREAM / PERMANENT REPORT',`<div class="modal-body microdream-request-dialog"><label class="field">Saved report<select id="mdSavedReport">${reports.map(r=>`<option value="${escape(r.id)}">${escape(r.palletName)} · ${escape(new Date(r.createdAt).toLocaleString('en-GB'))}</option>`).join('')}</select></label><div class="md-preview-controls"><label class="field" for="microdreamJobRef">Job Ref<input id="microdreamJobRef" maxlength="100" autocomplete="off" placeholder="Your job or purchase order reference"></label><button type="button" class="secondary" id="microdreamRefreshPreview">Save changes</button></div><p class="section-note">Click a Job Ref or table value in the preview to edit it, then select <b>Save changes</b>. Edits are saved on this pallet’s report.</p><p id="microdreamPreviewSummary" class="section-note" aria-live="polite">Loading saved report…</p><iframe id="microdreamPreviewFrame" class="microdream-preview-frame" title="Saved Microdream purchase order" sandbox="allow-scripts allow-same-origin"></iframe><p id="microdreamPreviewError" class="form-error" role="alert"></p><div class="modal-actions"><button id="microdreamDiscard" type="button" class="secondary" disabled>Discard changes</button><button id="microdreamPreviewClose" type="button" class="secondary">Close</button><button id="microdreamSavePdf" type="button" class="secondary" disabled>Save PDF</button><button id="microdreamPrint" type="button" class="primary" disabled>Print</button></div></div>`);
  const frame=$('microdreamPreviewFrame'),root=frame.closest('.microdream-request-dialog'),print=$('microdreamPrint'),pdf=$('microdreamSavePdf'),save=$('microdreamRefreshPreview'),reference=$('microdreamJobRef'),error=$('microdreamPreviewError'),select=$('mdSavedReport'),discard=$('microdreamDiscard');
  const canonical=document=>JSON.stringify({jobRef:String(document.jobRef??'').trim(),rows:document.rows.map(r=>Object.fromEntries(['type','model','language','comment','quantity','received'].map(k=>[k,String(r[k]??'').trim()])))});
  const dirty=()=>current&&draft&&canonical(draft)!==canonical(current.document);
  function buttons(){print.disabled=pdf.disabled=busy||!current||!!dirty();save.disabled=busy||!current||!dirty();reference.disabled=busy;select.disabled=busy||!!dirty();discard.disabled=busy||!current||!dirty();frame.contentWindow?.setMicrodreamEditing?.(!busy&&!!current);}
  function changed(){buttons();$('microdreamPreviewSummary').textContent=dirty()?'Unsaved report changes — Save changes before printing.':summary();}
  const requestClose=()=>{if(busy)return;if(dirty()){error.textContent='Save changes or Discard changes before closing this report.';return;}closeModal();};
  $('microdreamPreviewClose').onclick=requestClose;
  const layer=$('modalLayer')||root.closest('.modal-card');
  const guardClose=event=>{if(!root.isConnected){layer?.removeEventListener('click',guardClose,true);return;}if((dirty()||busy)&&(event.target===layer||event.target.closest('#modalClose,[data-close-modal],.modal-close,button[aria-label="Close"]'))){event.preventDefault();event.stopImmediatePropagation();requestClose();}};
  layer?.addEventListener('click',guardClose,true);
  const guardEscape=event=>{if(!root.isConnected){window.removeEventListener('keydown',guardEscape,true);return;}if(event.key==='Escape'&&(dirty()||busy)){event.preventDefault();event.stopImmediatePropagation();requestClose();}};
  window.addEventListener('keydown',guardEscape,true);
  reference.oninput=()=>{if(!draft)return;draft.jobRef=reference.value;frame.contentWindow?.setMicrodreamJobRef?.(reference.value);changed();};
  discard.onclick=async()=>{if(busy||!current)return;busy=true;buttons();error.textContent='';try{await render(current);}catch(e){error.textContent=e.message;}finally{busy=false;buttons();}};
  function summary(){return current?current.palletName+' · '+current.document.total+' units · '+current.document.rows.length+' model(s) · Saved '+new Date(current.createdAt).toLocaleString('en-GB'):'';}
  async function render(report){
   current=report;draft=structuredClone(report.document);reference.value=report.document.jobRef;const attempt=++generation;
   await new Promise((resolve,reject)=>{frame.onload=async()=>{try{if(!root.isConnected||attempt!==generation)return resolve();await frame.contentWindow.renderMicrodreamDocument(report.document,{editable:true});frame.contentWindow.onMicrodreamEdit=edits=>{if(!root.isConnected||attempt!==generation||busy)return;draft=edits;reference.value=edits.jobRef;changed();};resolve();}catch(e){reject(e);}};frame.onerror=()=>reject(Error('Could not display saved report.'));frame.src=new URL('microdream-print-page.html',window.ApexPreviewBase||location.href).href+'?saved='+attempt;});
   if(root.isConnected)$('microdreamPreviewSummary').textContent=summary();
  }
  async function load(){if(busy)return;busy=true;buttons();error.textContent='';try{const r=await api.microdreamReports({action:'get',id:select.value});if(!root.isConnected)return;if(!r.ok)throw Error(r.error);await render(r.report);}catch(e){current=null;if(root.isConnected)error.textContent=e.message;}finally{busy=false;if(root.isConnected)buttons();}}
  select.onchange=()=>{if(dirty()){select.value=current.id;error.textContent='Save changes or Discard changes before opening another report.';return;}load();};
  save.onclick=async()=>{if(busy||!current)return;busy=true;buttons();error.textContent='';try{const r=await api.microdreamReports({action:'update',id:current.id,edits:{jobRef:draft.jobRef,rows:draft.rows},expectedRevision:current.revision});if(!root.isConnected)return;if(!r.ok)throw Error(r.error);await render(r.report);notify('Purchase order changes saved permanently.');}catch(e){if(root.isConnected)error.textContent=e.message;}finally{busy=false;if(root.isConnected)buttons();}};
  async function output(mode){if(busy||!current||dirty())return;busy=true;buttons();error.textContent='';try{const r=await api.printMicrodreamRequest({reportId:current.id,expectedRevision:current.revision,expectedFingerprint:current.document.fingerprint,mode});if(!root.isConnected)return;if(!r.ok&&!r.cancelled)error.textContent=r.error||'Unable to print report.';else if(r.ok)notify(mode==='pdf'?'Microdream PDF saved.':'Microdream report sent to printer.');}catch(e){if(root.isConnected)error.textContent=e.message;}finally{busy=false;if(root.isConnected)buttons();}}
  print.onclick=()=>output('print');pdf.onclick=()=>output('pdf');await load();
 }
 window.ApexMicrodreamRequests=Object.freeze({open,view});
})();

