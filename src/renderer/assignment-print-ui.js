'use strict';
(function(){
 const $id=id=>document.getElementById(id),esc=html;
 function toolbar(page,kind){
  if($id('assignmentPrint-'+kind))return;
  const div=document.createElement('div');div.id='assignmentPrint-'+kind;div.className='assignment-print-toolbar';
  div.innerHTML='<span>Print '+(kind==='pallet'?'pallet documents':'location labels')+'</span><button type="button" class="secondary" data-open-doc="barcode">▣ Barcode label</button>'+(kind==='pallet'?'<button type="button" class="secondary" data-open-doc="manifest">▤ A4 manifest</button>':'');
  const host=$id(page);host?.prepend(div);div.querySelectorAll('[data-open-doc]').forEach(b=>b.onclick=()=>open(kind,'',b.dataset.openDoc));
 }
 function decorate(){
  toolbar('locationsPage','location');toolbar('palletsPage','pallet');
  $id('locationsTable')?.querySelectorAll('[data-jump-location]').forEach(b=>{
   const cell=b.closest('td');if(cell.querySelector('[data-assignment-label]'))return;
   const button=document.createElement('button');button.type='button';button.className='secondary assignment-row-print';button.dataset.assignmentLabel='location';button.textContent='▣ Barcode';button.onclick=()=>open('location',b.dataset.jumpLocation,'barcode');cell.prepend(button);
  });
  $id('apexPalletTable')?.querySelectorAll('[data-pallet-show]').forEach(b=>{
   const cell=b.closest('td');if(cell.querySelector('[data-assignment-label]'))return;
   for(const [label,document] of [['▣ Barcode','barcode'],['▤ Manifest','manifest']]){const button=window.document.createElement('button');button.type='button';button.className='secondary assignment-row-print';button.dataset.assignmentLabel='pallet';button.textContent=label;button.onclick=()=>open('pallet',b.dataset.palletShow,document);cell.insertBefore(button,b);}
  });
 }
 async function open(kind,name,document){
  try{
   const data=await api.list();if(!data.ok){notify(data.error||'Could not read inventory for printing.');return;}
   const choices=kind==='pallet'?(data.pallets||[]).map(p=>p.name):(data.locations||[]);
   showModal(document==='manifest'?'Pallet manifest':'Print barcode label','INVENTORY / '+kind.toUpperCase(),'<div class="modal-body assignment-print-dialog"><label class="field">'+(kind==='pallet'?'Pallet':'Location')+'<select id="assignmentPrintChoice"><option value="">Choose '+kind+'</option>'+choices.map(n=>'<option value="'+esc(n)+'" '+(n===name?'selected':'')+'>'+esc(n)+'</option>').join('')+'</select></label><div id="assignmentPrintFacts"></div>'+(document==='barcode'?'<div class="assignment-label-controls"><label class="field">Label size<select id="assignmentLabelSize"><option value="2x1">2 × 1 inches</option><option value="4x2">4 × 2 inches</option></select></label><label class="field">Printer resolution<select id="assignmentLabelDpi"><option value="203">203 DPI</option><option value="300">300 DPI</option><option value="600">600 DPI</option></select></label></div>':'')+'<div id="assignmentDocumentPreview"></div><div id="assignmentPrintError" class="form-error" role="alert"></div><div class="modal-actions"><button id="assignmentPrintCancel" type="button" class="secondary">Close</button><button id="assignmentSavePdf" type="button" class="secondary" disabled>Save PDF</button><button id="assignmentPrintGo" type="button" class="primary" disabled>Print '+(document==='manifest'?'A4 manifest':'barcode')+'</button></div></div>');
   function preview(){
    $id('assignmentPrintError').textContent='';$id('assignmentPrintFacts').innerHTML='';$id('assignmentDocumentPreview').innerHTML='';let valid=false;
    try{
     const value=$id('assignmentPrintChoice').value;if(!value)return;
     const meta=window.ApexAssignmentDocuments.select(data,kind,value);
     $id('assignmentPrintFacts').innerHTML='<div><small>Created</small><strong>'+esc(window.ApexAssignmentDocuments.date(meta.createdAt))+'</strong></div><div><small>Devices</small><strong>'+meta.assets.length+'</strong></div>'+(meta.label?'<p>'+esc(meta.label)+'</p>':'');
     if(document==='barcode'){
      const size=$id('assignmentLabelSize').value,dpi=Number($id('assignmentLabelDpi').value),dimensions=window.ApexAssignmentDocuments.sizes[size],frame=window.document.createElement('iframe');frame.className='assignment-barcode-preview';frame.title='Barcode label preview';frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.style.width=dimensions[0]*96/25.4+'px';frame.style.height=dimensions[1]*96/25.4+'px';window.ApexAssignmentDocuments.barcodeGeometry(meta.name,size,dpi);const url=new URL('assignment-label-preview.html',window.location.href);url.searchParams.set('label',JSON.stringify({name:meta.name,kind:meta.kind,label:meta.label,createdAt:meta.createdAt,size,dpi}));frame.src=url.href;$id('assignmentDocumentPreview').appendChild(frame);
     }else $id('assignmentDocumentPreview').innerHTML='<p class="section-note">A4 portrait · '+meta.assets.length+' devices · all rows included in print/PDF</p><div class="assignment-manifest-preview"><table class="asset-table"><thead><tr><th>Asset ID</th><th>Device</th><th>Serial</th></tr></thead><tbody>'+meta.assets.slice(0,8).map(a=>'<tr><td>'+esc(a.id)+'</td><td>'+esc(deviceName(a))+'</td><td>'+esc(a.serial||'—')+'</td></tr>').join('')+'</tbody></table>'+(meta.assets.length>8?'<p>… and '+(meta.assets.length-8)+' more devices</p>':!meta.assets.length?'<p>This pallet is empty.</p>':'')+'</div>';
     valid=true;
    }catch(e){$id('assignmentPrintError').textContent=e.message;}
    finally{$id('assignmentSavePdf').disabled=!valid;$id('assignmentPrintGo').disabled=!valid;}
   }
   $id('assignmentPrintChoice').onchange=preview;for(const id of ['assignmentLabelSize','assignmentLabelDpi'])if($id(id))$id(id).onchange=preview;
   $id('assignmentPrintCancel').onclick=closeModal;
   async function output(mode){
    const buttons=[$id('assignmentSavePdf'),$id('assignmentPrintGo')];buttons.forEach(b=>b.disabled=true);
    const selected=$id('assignmentPrintChoice').value;
    try{const result=await api.printAssignment({kind,name:selected,document,mode,size:$id('assignmentLabelSize')?.value||'2x1',dpi:Number($id('assignmentLabelDpi')?.value)||203});if(!result.ok&&!result.cancelled&&$id('assignmentPrintError'))$id('assignmentPrintError').textContent=result.error||'Could not print.';else if(result.ok)notify(mode==='pdf'?'PDF saved':'Document sent to printer');}
    catch{if($id('assignmentPrintError'))$id('assignmentPrintError').textContent='Could not complete printing. Check the printer and try again.';}
    finally{buttons.forEach(b=>b.disabled=false);}
   }
   $id('assignmentSavePdf').onclick=()=>output('pdf');$id('assignmentPrintGo').onclick=()=>output('print');preview();
  }catch(e){notify(e.message||'Could not open printing.');}
 }
 const previous=render;render=function(...args){const result=previous(...args);decorate();return result;};
 window.ApexAssignmentPrint={open,decorate};decorate();
})();
