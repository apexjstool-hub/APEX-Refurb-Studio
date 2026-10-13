/* APEX Smart Inventory — scoped label preview, selection and print functionality.
   Barcode payload is structured JSON with an explicit assetId and can be scanned back
   into the existing Inventory lookup. No remote QR service or printer driver needed. */
'use strict';
const APEX_LABEL_SIZES={'50x30':[50,30],'50x25':[50,25],'60x40':[60,40],'40x30':[40,30]};
let apexLabelChoice='asset',apexLabelSize='50x25',apexLabelData=null,apexLabelCleanup=null;
const labelEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function makeLabelMarkup(record,style){
 const qr=window.ApexAssetLabelQR;
 if(!qr)throw Error('Offline QR label generator is missing.');
 const asset=labelEscape(record.id||'');
 const full=labelEscape(qr.deviceName(record)||'Unknown device');
 const model=labelEscape(record.model||'Unknown model');
 const maker=labelEscape(record.manufacturer||'');
 const serial=labelEscape(record.serial||'—');
 if(style==='asset'){
   if(!window.ApexAssetBarcode)throw Error('Barcode encoder missing.');
   const svg=window.ApexAssetBarcode.code128Svg(record.id);
   return `<div class="apex-label-stock apex-barcode-label" role="img" aria-label="Barcode for asset ${asset}">
     <div class="apex-label-title">APEX · ASSET TAG</div><div class="apex-barcode-name">${full}</div>
     <div class="apex-barcode-image">${svg}</div><div class="apex-barcode-human">${asset}</div>
     </div>`;
 }
 // EXACT RefurbFlow QR format used by Diagnostics main.js: {rf,manufacturer,model,serial,assetTag}.
 // 'full model' is displayed on the label but intentionally not added to the QR payload.
 return `<div class="apex-label-stock apex-refurb-label" role="img" aria-label="RefurbFlow QR for ${asset}">
  <div class="apex-label-columns">
  <div class="apex-label-qr">${qr.qrCodeSvg(qr.makePayload(record))}</div>
  <div class="apex-label-copy"><div class="apex-label-id-caption">ASSET ID</div><div class="apex-label-asset">${asset}</div>
  <div class="apex-label-name">${full}</div><div class="apex-label-spec">S/N: <strong>${serial}</strong></div></div>
  </div></div>`;
}
function openAssetPrintDialog(requestedAssetId){
 // Clicking a row passes its Asset ID; clicking the existing asset-summary button
 // passes a MouseEvent, which should fall back to the open asset.
 const assetId=typeof requestedAssetId==='string' ? requestedAssetId : activeAssetId;
 if(!assetId){notify('Save this asset before printing a label.');return;}
 if(dirty&&assetId===activeAssetId){notify('Save your unsaved changes before printing.');return;}
 const record=items.find(item=>item.id===assetId);
 if(!record){notify('Asset not found. Refresh and try again.');return;}
 apexLabelData={...record};apexLabelChoice='asset';apexLabelSize='50x25';
 showModal('Thermal labels · '+String(record.id),'INVENTORY / LABEL STUDIO',`<div class="modal-body apex-label-dialog">
 <div class="apex-label-workspace"><div class="apex-label-settings">
  <p class="apex-print-caption">Select a label design and your printer paper size.</p>
  <div class="apex-label-choices" role="group" aria-label="Label type">
   <button class="apex-label-type selected" type="button" data-label-type="asset"><b>▥ Asset Tag Barcode</b><small>Code 128 · Asset ID only</small></button>
   <button class="apex-label-type" type="button" data-label-type="refurb"><b>▦ Refurb QR Label</b><small>Same QR format as APEX Diagnostics</small></button>
  </div
  <label class="field apex-label-size-select">Label size<select id="apexPrintLabelSize"><option value="50x30">50 × 30 mm · Standard</option><option value="50x25" selected>50 × 25 mm · Zebra GK420t</option><option value="60x40">60 × 40 mm · Clear QR</option><option value="40x30">40 × 30 mm · Small thermal</option></select></label>
  <div class="apex-label-help"><strong>Thermal printer setup:</strong> Pick the same roll size in the printer driver. Use 100% / Actual size, margins None, headers off and Portrait. For the clearest QR, choose <b>60 × 40 mm</b>. Long device details can make a QR too dense for small labels. Test one label before a batch.</div>
 </div><div class="apex-label-display"><div class="apex-label-preview-title">LIVE LABEL PREVIEW · ${labelEscape(record.id)}</div><div id="apexLabelPreview" class="apex-label-preview"></div>
 <div class="apex-label-preview-desc" id="apexLabelDescription">Barcode encodes only ${labelEscape(record.id)}.</div></div></div>
 <div class="modal-actions apex-label-footer"><button class="secondary" type="button" id="apexLabelCancel">Cancel</button><button class="primary" type="button" id="apexLabelPrintNow">▣ Print label</button></div></div>`);
 document.querySelectorAll('[data-label-type]').forEach(button=>button.onclick=()=>{
  apexLabelChoice=button.dataset.labelType;
  if(apexLabelChoice==='refurb'&&apexLabelSize==='50x30'){apexLabelSize='60x40';$('apexPrintLabelSize').value=apexLabelSize;}
  document.querySelectorAll('[data-label-type]').forEach(b=>b.classList.toggle('selected',b===button));
  drawLabelPreview();
 });
 $('apexPrintLabelSize').onchange=e=>{apexLabelSize=e.target.value;drawLabelPreview();};
 $('apexLabelCancel').onclick=closeModal;
 $('apexLabelPrintNow').onclick=printSelectedAssetLabel;
 drawLabelPreview();
}
function drawLabelPreview(){
 const preview=$('apexLabelPreview');if(!preview||!apexLabelData)return;
 try{
  const [w,h]=APEX_LABEL_SIZES[apexLabelSize]||APEX_LABEL_SIZES['50x30'];
  preview.style.setProperty('--apex-preview-ratio',w+'/'+h);
  preview.dataset.labelSize=apexLabelSize;
  preview.dataset.labelType=apexLabelChoice;
  preview.innerHTML=makeLabelMarkup(apexLabelData,apexLabelChoice);const description=$('apexLabelDescription');if(description)description.textContent=apexLabelChoice==='asset'?'Code 128 barcode contains only the Asset ID.':['50x25','40x30'].includes(apexLabelSize)?'Small roll: dense RefurbFlow QR codes may be difficult to scan. Try 60 × 40 mm if scanning fails.':'QR matches APEX Diagnostics. Print black on white at 100% / Actual size.';
  const print=$('apexLabelPrintNow');print.disabled=false;
 }catch(error){preview.textContent='Unable to generate QR: '+error.message;$('apexLabelPrintNow').disabled=true;}
}
function printSelectedAssetLabel(){
 if(!apexLabelData)return;
 if(apexLabelCleanup)apexLabelCleanup();
 let element;
 try{
  const [w,h]=APEX_LABEL_SIZES[apexLabelSize]||APEX_LABEL_SIZES['50x30'];
  element=document.createElement('div');element.id='apexLabelPrintPane';
  element.style.setProperty('--label-width',w+'mm');element.style.setProperty('--label-height',h+'mm');element.dataset.labelSize=apexLabelSize;element.dataset.labelType=apexLabelChoice;
  element.innerHTML=makeLabelMarkup(apexLabelData,apexLabelChoice);
  document.body.appendChild(element);
  const pageStyle=document.createElement('style');pageStyle.id='apexPrintPageSize';
  pageStyle.textContent='@page{size:'+w+'mm '+h+'mm;margin:0}';
  document.head.appendChild(pageStyle);
  let cleanupDone=false;
  const cleanup=()=>{if(cleanupDone)return;cleanupDone=true;window.removeEventListener('afterprint',cleanup);pageStyle.remove();element.remove();apexLabelCleanup=null;};
  apexLabelCleanup=cleanup;
  window.addEventListener('afterprint',cleanup,{once:true});
  // Some printer drivers do not fire afterprint; clean up defensively.
  setTimeout(cleanup,45000);
  window.print();
 }catch(error){if(apexLabelCleanup)apexLabelCleanup();else if(element)element.remove();notify('Unable to open label printer: '+error.message);}
}
