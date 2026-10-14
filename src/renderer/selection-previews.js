'use strict';
(function(){
 const url=file=>new URL(file,window.ApexPreviewBase||location.href).href;
 function report(markup,title,paper,format='report',print){
  showModal(title+' — preview','REPORT / PRINT PREVIEW','<div class="modal-body selection-report-dialog"><p class="section-note">Preview of the selected documents · A4</p><iframe id="selectionReportPreview" title="'+html(title)+' preview" class="selection-report-preview"></iframe><div class="modal-actions"><button id="selectionReportClose" type="button" class="secondary">Close</button><button id="selectionReportPrint" type="button" class="primary" disabled>Print / Save PDF</button></div></div>');
  const frame=$('selectionReportPreview');frame.onload=()=>{frame.contentWindow.postMessage({type:'apex-report-preview',markup,format},'*');$('selectionReportPrint').disabled=false;};frame.src=url('report-preview.html');
  $('selectionReportClose').onclick=closeModal;
  $('selectionReportPrint').onclick=()=>{closeModal();if(print)print();else if(format==='inventory')printInventoryMarkup(markup);else window.ApexOps.printDocument(markup,title,paper);};
 }
 function capture(run){window.ApexReportPreview={capture:report};try{run();}finally{window.ApexReportPreview=null;}}
 async function labels(kind,type,values,scopeLabel){
  const manifest=type==='manifest';if(manifest){await manifests(values);return;}
  showModal(type==='refurb'?'Refurb QR labels — preview':type==='asset'?'Asset barcodes — preview':kind+' barcodes — preview','LABELS / '+values.length+' SELECTED','<div class="modal-body selection-label-dialog"><p>'+values.length+' '+html(scopeLabel)+' selected · one 2 × 1 inch label per row</p><div class="selection-preview-controls"><label class="field">Preview item<select id="selectionPreviewItem">'+values.map(value=>'<option value="'+html(value)+'">'+html(value)+'</option>').join('')+'</select></label><label class="field">Printer resolution<select id="selectionPrintDpi"><option value="203">203 DPI</option><option value="300">300 DPI</option><option value="600">600 DPI</option></select></label></div><div class="selection-label-preview-host"><iframe id="selectionLabelPreview" title="Selected label preview"></iframe></div><p id="selectionPrintError" class="form-error" role="alert"></p><div class="modal-actions"><button id="selectionPrintClose" type="button" class="secondary">Close</button><button id="selectionPrintPdf" type="button" class="secondary" disabled>Save PDF</button><button id="selectionPrintGo" type="button" class="primary" disabled>Print selected labels</button></div></div>');
  const frame=$('selectionLabelPreview'),buttons=[$('selectionPrintGo'),$('selectionPrintPdf')];$('selectionPrintClose').onclick=closeModal;let data;
  try{data=await api.list();if(!frame.isConnected)return;if(!data.ok)throw Error(data.error||'Could not load the selected devices.');}catch(error){if(frame.isConnected)$('selectionPrintError').textContent=error.message;return;}
  async function preview(){
   buttons.forEach(b=>b.disabled=true);$('selectionPrintError').textContent='';
   try{
    const value=$('selectionPreviewItem').value,dpi=Number($('selectionPrintDpi').value),target=new URL(url(kind==='inventory'?'asset-label-page.html':'assignment-label-preview.html'));
    if(kind==='inventory'){const record=data.items.find(a=>a.id===value);if(!record)throw Error('The selected asset no longer exists. Refresh inventory.');target.searchParams.set('label',JSON.stringify({record,type,size:'2x1',dpi,preview:true}));}
    else{const meta=window.ApexAssignmentDocuments.select(data,kind,value);window.ApexAssignmentDocuments.barcodeGeometry(meta.name,'2x1',dpi);target.searchParams.set('label',JSON.stringify({...meta,assets:undefined,size:'2x1',dpi,preview:true}));}
    frame.onload=async()=>{try{if(kind==='inventory'){await frame.contentWindow.apexLabelReady;if(frame.contentWindow.apexLabelError)throw Error(frame.contentWindow.apexLabelError);}else if(frame.contentWindow.assignmentLabelPreviewError)throw Error(frame.contentWindow.assignmentLabelPreviewError);if(frame.isConnected)buttons.forEach(b=>b.disabled=false);}catch(error){if(frame.isConnected)$('selectionPrintError').textContent=error.message;}};
    frame.src=target.href;
   }catch(error){$('selectionPrintError').textContent=error.message;}
  }
  $('selectionPreviewItem').onchange=preview;$('selectionPrintDpi').onchange=preview;
  async function output(mode){
   buttons.forEach(b=>b.disabled=true);try{
    const dpi=Number($('selectionPrintDpi').value),result=kind==='inventory'?await api.printAssetBatch({ids:values,type,dpi,mode}):await api.printAssignment({kind,names:values,document:'barcode',size:'2x1',dpi,mode});
    if(result.ok)notify(mode==='pdf'?'Selected labels saved to PDF.':'Selected labels sent to the printer.');else if(!result.cancelled&&frame.isConnected)$('selectionPrintError').textContent=result.error||'Could not print labels.';
   }catch(error){if(frame.isConnected)$('selectionPrintError').textContent=error.message;}finally{if(frame.isConnected)buttons.forEach(b=>b.disabled=false);}
  }
  $('selectionPrintGo').onclick=()=>output('print');$('selectionPrintPdf').onclick=()=>output('pdf');preview();
 }
 async function manifests(values){
  try{const data=await api.list();if(!data.ok)throw Error(data.error||'Could not load pallets.');
   const markup=values.map(name=>'<section class="manifest-preview-page">'+window.ApexAssignmentDocuments.manifestDocument(window.ApexAssignmentDocuments.select(data,'pallet',name)).match(/<body>([\s\S]*)<\/body>/)[1]+'</section>').join('');
   report(markup,'Pallet manifests','A4','manifest',async()=>{const result=await api.printAssignment({kind:'pallet',names:values,document:'manifest',size:'2x1',dpi:203,mode:'print'});if(!result.ok&&!result.cancelled)notify(result.error||'Could not print manifests.');});
  }catch(error){notify(error.message);}
 }
 window.ApexSelectionPreviews={labels,capture};
})();
