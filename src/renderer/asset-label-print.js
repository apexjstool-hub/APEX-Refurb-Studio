/* APEX Smart Inventory — scoped label preview, selection and print functionality.
   Barcode payload is structured JSON with an explicit assetId and can be scanned back
   into the existing Inventory lookup. No remote QR service or printer driver needed. */
'use strict';
const APEX_LABEL_SIZES={'50x30':[50,30],'50x25':[50,25],'60x40':[60,40],'40x30':[40,30],'80x30':[80,30]};
let apexLabelChoice='asset',apexLabelSize='50x25',apexLabelData=null,apexLabelCleanup=null,apexLabelDpi=203;
const labelEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function labelCodeGeometry(record,style,size=apexLabelSize,dpi=apexLabelDpi){
 const [w,h]=APEX_LABEL_SIZES[size]||APEX_LABEL_SIZES['50x25'];
 const svg=style==='asset'?window.ApexAssetBarcode.code128Svg(record.id):window.ApexAssetLabelQR.qrCodeSvg(window.ApexAssetLabelQR.makePayload(record));
 const box=svg.match(/viewBox="0 0 ([0-9]+) ([0-9]+)"/);
 if(!box)throw Error('Code geometry is missing.');
 const units=Number(box[1]);
 const available=style==='asset'?w-3:Math.min(h-2,w*0.48);
 const dots=Math.floor(available*dpi/25.4/units);
 if(dots<1)throw Error('This code is too dense for this label. Choose a larger label.');
 const mm=units*dots*25.4/dpi;
 const height=style==='asset'?Math.max(8,(h-2)*0.55):mm;
 return {svg:svg.replace('<svg ',`<svg width="${mm.toFixed(4)}mm" height="${height.toFixed(4)}mm" `),dots,mm,height,dpi};
}
function makeLabelMarkup(record,style,size=apexLabelSize,dpi=apexLabelDpi){
 const qr=window.ApexAssetLabelQR;
 if(!qr)throw Error('Offline QR label generator is missing.');
 const asset=labelEscape(record.id||'');
 const full=labelEscape(qr.deviceName(record)||'Unknown device');
 const model=labelEscape(record.model||'Unknown model');
 const maker=labelEscape(record.manufacturer||'');
 const serial=labelEscape(record.serial||'—');
 if(style==='asset'){
   if(!window.ApexAssetBarcode)throw Error('Barcode encoder missing.');
   const svg=labelCodeGeometry(record,style,size,dpi).svg;
   return `<div class="apex-label-stock apex-barcode-label" role="img" aria-label="Barcode for asset ${asset}">
     <div class="apex-label-title">APEX ASSET TAG</div>
     <div class="apex-barcode-image">${svg}</div><div class="apex-barcode-human">${asset}</div>
     </div>`;
 }
 // EXACT RefurbFlow QR format used by Diagnostics main.js: {rf,manufacturer,model,serial,assetTag}.
 // 'full model' is displayed on the label but intentionally not added to the QR payload.
 return `<div class="apex-label-stock apex-refurb-label" role="img" aria-label="RefurbFlow QR for ${asset}">
  <div class="apex-label-columns">
  <div class="apex-label-qr">${labelCodeGeometry(record,style,size,dpi).svg}</div>
  <div class="apex-label-copy"><div class="apex-label-asset">${asset}</div>
  <div class="apex-label-name">${full}</div></div>
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
  </div>
  <label class="field apex-label-size-select">Label size<select id="apexPrintLabelSize"><option value="50x30">50 × 30 mm · Standard</option><option value="50x25" selected>50 × 25 mm · Zebra GK420t</option><option value="60x40">60 × 40 mm · Clear QR</option><option value="40x30">40 × 30 mm · Small thermal</option><option value="80x30">80 × 30 mm · Wide barcode</option></select></label>
  <label class="field apex-label-size-select">Printer resolution<select id="apexPrintLabelDpi"><option value="203">203 dpi · Zebra GK420t</option><option value="300">300 dpi</option><option value="600">600 dpi</option></select></label>
  <div class="apex-label-help"><strong>Thermal printer setup:</strong> Pick the same roll size in the printer driver. Use 100% / Actual size, margins None, headers off and Portrait. For the clearest QR, choose <b>60 × 40 mm</b>. Long device details can make a QR too dense for small labels. Test one label before a batch.</div>
 </div><div class="apex-label-display"><div class="apex-label-preview-title">LIVE LABEL PREVIEW · ${labelEscape(record.id)}</div><div id="apexLabelPreview" class="apex-label-preview"></div>
 <div class="apex-label-preview-desc" id="apexLabelDescription">Barcode encodes only ${labelEscape(record.id)}.</div></div></div>
 <div class="modal-actions apex-label-footer"><button class="secondary" type="button" id="apexLabelCancel">Cancel</button><button class="secondary" type="button" id="apexLabelSavePdf">Save label PDF</button><button class="primary" type="button" id="apexLabelPrintNow">▣ Print label</button></div></div>`);
 document.querySelectorAll('[data-label-type]').forEach(button=>button.onclick=()=>{
  apexLabelChoice=button.dataset.labelType;
  if(apexLabelChoice==='refurb'&&apexLabelSize==='50x30'){apexLabelSize='60x40';$('apexPrintLabelSize').value=apexLabelSize;}
  document.querySelectorAll('[data-label-type]').forEach(b=>b.classList.toggle('selected',b===button));
  drawLabelPreview();
 });
 $('apexPrintLabelSize').onchange=e=>{apexLabelSize=e.target.value;drawLabelPreview();};
 $('apexPrintLabelDpi').value=String(apexLabelDpi);
 $('apexPrintLabelDpi').onchange=e=>{apexLabelDpi=Number(e.target.value);drawLabelPreview();};
 $('apexLabelCancel').onclick=closeModal;
 $('apexLabelPrintNow').onclick=printSelectedAssetLabel;
 $('apexLabelSavePdf').onclick=()=>outputDesktopLabel('pdf');
 $('apexLabelSavePdf').disabled=!window.apexInventory?.saveLabelPdf;
 drawLabelPreview();
}
function labelPageUrl(preview=false){
 const payload={record:apexLabelData,type:apexLabelChoice,size:apexLabelSize,dpi:apexLabelDpi,preview};
 return 'asset-label-page.html?label='+encodeURIComponent(JSON.stringify(payload));
}
function drawLabelPreview(){
 const preview=$('apexLabelPreview');if(!preview||!apexLabelData)return;
 try{
  const geometry=labelCodeGeometry(apexLabelData,apexLabelChoice);
  const [w,h]=APEX_LABEL_SIZES[apexLabelSize];
  preview.replaceChildren();
  const frame=document.createElement('iframe');frame.className='apex-isolated-label-preview';frame.title='Actual label layout preview';frame.src=labelPageUrl(true);preview.append(frame);
  // Iframes otherwise keep a 150px intrinsic height, clipping the scaled preview.
  const resize=()=>{frame.style.height=(frame.getBoundingClientRect().width*h/w)+'px';};resize();
  const observer=new ResizeObserver(()=>{if(frame.isConnected)resize();else observer.disconnect();});observer.observe(preview);
  frame.onload=resize;
  $('apexLabelDescription').textContent=geometry.dots<2?'Fine code: only 1 printer dot per narrow bar/module. A larger label (80 × 30 for long barcodes) or a higher-resolution printer gives more scan margin.':'Sharp black-on-white code at '+geometry.dots+' printer dots per narrow bar/module. Print at Actual size, with the matching paper size and margins None.';
  $('apexLabelPrintNow').disabled=false;
 }catch(error){preview.textContent='Unable to generate label: '+error.message;$('apexLabelPrintNow').disabled=true;}
}
async function outputDesktopLabel(mode){
 const method=mode==='pdf'?window.apexInventory?.saveLabelPdf:window.apexInventory?.printAssetLabel;
 if(!method){notify('Label PDF export requires installed APEX.');return;}
 const buttons=[$('apexLabelPrintNow'),$('apexLabelSavePdf')];buttons.forEach(b=>{if(b)b.disabled=true;});
 try{
  const result=await method({record:apexLabelData,type:apexLabelChoice,size:apexLabelSize,dpi:apexLabelDpi});
  if(result.ok)notify(mode==='pdf'?'Label PDF saved at the selected label size.':'Label sent to printer.');
  else if(!result.cancelled)notify('Label output failed: '+result.error);
 }catch(error){notify('Label output failed: '+error.message);}
 finally{buttons.forEach(b=>{if(b?.isConnected)b.disabled=false;});}
}
function printSelectedAssetLabel(){
 if(window.apexInventory?.printAssetLabel){return outputDesktopLabel('print');}

 if(!apexLabelData)return;
 if(apexLabelCleanup)apexLabelCleanup();
 let frame,timeout;
 const button=$('apexLabelPrintNow');button.disabled=true;
 const cleanup=()=>{clearTimeout(timeout);frame?.remove();if(button?.isConnected)button.disabled=false;apexLabelCleanup=null;};
 apexLabelCleanup=cleanup;
 try{
  labelCodeGeometry(apexLabelData,apexLabelChoice);
  frame=document.createElement('iframe');frame.className='apex-label-print-frame';frame.title='Thermal label print document';
  frame.onload=async()=>{
   try{
    const win=frame.contentWindow;
    await win.apexLabelReady;
    if(win.apexLabelError)throw Error(win.apexLabelError);
    win.addEventListener('afterprint',cleanup,{once:true});
    win.focus();win.print();
   }catch(error){cleanup();notify('Unable to print label: '+error.message);}
  };
  frame.src=labelPageUrl(false);document.body.append(frame);
  // Allow a long printer dialog without destroying its document prematurely.
  timeout=setTimeout(cleanup,600000);
 }catch(error){cleanup();notify('Unable to open label printer: '+error.message);}
}

