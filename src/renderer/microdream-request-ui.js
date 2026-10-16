'use strict';
(function(){
 async function open(palletNames){
  const selected=[...palletNames];let current=null,busy=false,generation=0;
  showModal('Microdream purchase order — preview','MICRODREAM / JOB REQUEST',`<div class="modal-body microdream-request-dialog"><div class="md-preview-controls"><label class="field" for="microdreamJobRef">Job Ref (optional)<input id="microdreamJobRef" maxlength="100" autocomplete="off" placeholder="Your job or purchase order reference"></label><button type="button" class="secondary" id="microdreamRefreshPreview">Update preview</button></div><p id="microdreamPreviewSummary" class="section-note" aria-live="polite">Preparing selected pallets…</p><iframe id="microdreamPreviewFrame" class="microdream-preview-frame" title="Microdream job request preview" sandbox="allow-scripts allow-same-origin"></iframe><p id="microdreamPreviewError" class="form-error" role="alert"></p><div class="modal-actions"><button id="microdreamPreviewClose" type="button" class="secondary">Close</button><button id="microdreamSavePdf" type="button" class="secondary" disabled>Save PDF</button><button id="microdreamPrint" type="button" class="primary" disabled>Print</button></div></div>`);
  const root=$('microdreamPreviewFrame').closest('.microdream-request-dialog'),frame=$('microdreamPreviewFrame'),print=$('microdreamPrint'),pdf=$('microdreamSavePdf'),update=$('microdreamRefreshPreview'),reference=$('microdreamJobRef'),error=$('microdreamPreviewError');
  const buttons=()=>{print.disabled=pdf.disabled=busy||!current;update.disabled=busy;reference.disabled=busy;};
  $('microdreamPreviewClose').onclick=closeModal;
  reference.oninput=()=>{current=null;generation++;buttons();$('microdreamPreviewSummary').textContent='Job Ref changed. Update the preview before printing.';};
  async function preview(){
   if(busy||!root.isConnected)return;busy=true;current=null;const attempt=++generation;buttons();error.textContent='';
   try{
    const result=await api.microdreamPreview({palletNames:selected,jobRef:reference.value});if(!root.isConnected||attempt!==generation)return;
    if(!result.ok)throw Error(result.error||'Unable to prepare the document.');
    const document=result.document;
    frame.onload=async()=>{if(!root.isConnected||attempt!==generation)return;try{await frame.contentWindow.renderMicrodreamDocument(document);if(!root.isConnected||attempt!==generation)return;current=document;$('microdreamPreviewSummary').textContent=document.palletNames.length+' pallet(s) · '+document.total+' devices · '+document.rows.length+' model(s) · A4 landscape';}catch(e){error.textContent=e.message||'Unable to display the document.';}finally{if(root.isConnected&&attempt===generation){busy=false;buttons();}}};
    frame.src=new URL('microdream-print-page.html',window.ApexPreviewBase||location.href).href+'?preview='+attempt;
   }catch(e){if(root.isConnected&&attempt===generation){error.textContent=e.message;busy=false;buttons();}}
  }
  async function output(mode){
   if(busy||!current)return;busy=true;buttons();error.textContent='';
   try{const result=await api.printMicrodreamRequest({palletNames:selected,jobRef:current.jobRef,expectedFingerprint:current.fingerprint,mode});if(!root.isConnected)return;if(!result.ok&&!result.cancelled){error.textContent=result.error||'Unable to complete printing.';current=null;}else if(result.ok)notify(mode==='pdf'?'Microdream PDF saved.':'Microdream document sent to printer.');}
   catch{if(root.isConnected){error.textContent='The print result could not be confirmed. Update the preview before retrying.';current=null;}}
   finally{busy=false;if(root.isConnected)buttons();}
  }
  update.onclick=preview;print.onclick=()=>output('print');pdf.onclick=()=>output('pdf');await preview();
 }
 window.ApexMicrodreamRequests=Object.freeze({open});
})();
