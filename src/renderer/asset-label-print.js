/* APEX Smart Inventory — scoped label preview, selection and print functionality.
   Barcode payload is structured JSON with an explicit assetId and can be scanned back
   into the existing Inventory lookup. No remote QR service or printer driver needed. */
'use strict';
const APEX_LABEL_SIZES={'2x1':[50.8,25.4],'50x30':[50,30],'50x25':[50,25],'60x40':[60,40],'40x30':[40,30],'80x30':[80,30]};
let apexLabelChoice='assetDevice',apexLabelSize='2x1',apexLabelData=null,apexLabelCleanup=null,apexLabelDpi=203;
let apexQuickQA=null,apexQuickBusy=false,apexQuickPreviewObserver=null;
function quickLabelDate(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function quickLabelPayload(preview=false){
 const payload={record:apexLabelData,type:apexLabelChoice,size:apexLabelSize,dpi:apexLabelDpi,preview};
 if(!apexLabelData)throw Error('Select an asset first.');
 if(apexLabelChoice==='assetDevice'){if(!String(apexLabelData.model||'').trim())throw Error('Save the device model in Device Details before printing an asset label.');payload.assetOptions={fields:[],barcodeHeight:'medium',align:'center',detailSize:'normal'};}
 if(apexLabelChoice==='qa')payload.qa=window.ApexCustomLabels.qa(apexQuickQA||{});
 return payload;
}
function quickLabelButtons(valid){const print=$('apexLabelPrintNow'),pdf=$('apexLabelSavePdf');if(print)print.disabled=apexQuickBusy||!valid;if(pdf)pdf.disabled=apexQuickBusy||!valid||!window.apexInventory?.saveLabelPdf;}
async function loadQuickTechnicians(select,help){
 try{const result=await window.apexInventory.labelStudioSettings({action:'get'});if(!result?.ok)throw Error(result?.error||'Unable to load technicians.');if(!select.isConnected)return;
 const names=result.settings.technicians||[];select.replaceChildren(new Option('Choose a technician',''));for(const name of names)select.append(new Option(name,name));select.disabled=false;help.textContent=names.length?'Choose who is carrying out QA for this asset.':'No saved technicians. Use Manage technicians to add a name.';
 }catch(error){if(select.isConnected){select.disabled=true;help.textContent=error.message+' Use Manage technicians to try again.';}}
}
const labelEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function labelCodeGeometry(record,style,size=apexLabelSize,dpi=apexLabelDpi,bounds={}){
 const [w,h]=APEX_LABEL_SIZES[size]||APEX_LABEL_SIZES['2x1'];
 const svg=['asset','assetDevice'].includes(style)?window.ApexAssetBarcode.code128Svg(record.id):window.ApexAssetLabelQR.qrCodeSvg(window.ApexAssetLabelQR.makePayload(record));
 const box=svg.match(/viewBox="0 0 ([0-9]+) ([0-9]+)"/);
 if(!box)throw Error('Code geometry is missing.');
 const units=Number(box[1]);
 const available=Math.min(['asset','assetDevice'].includes(style)?w-3:Math.min(h-2,w*0.48),bounds.maxMm||Infinity);
 const dots=Math.floor(available*dpi/25.4/units);
 if(dots<1)throw Error('This code is too dense for this label. Choose a larger label.');
 const mm=units*dots*25.4/dpi;
 const height=style==='assetDevice'?Math.max(6,(h-2)*0.39):style==='asset'?Math.max(8,(h-2)*0.55):mm;
 return {svg:svg.replace('<svg ',`<svg width="${mm.toFixed(4)}mm" height="${height.toFixed(4)}mm" `),dots,mm,height,dpi};
}
function makeLabelMarkup(record,style,size=apexLabelSize,dpi=apexLabelDpi,options={}){
 if(['custom','qa'].includes(style))return window.ApexCustomLabels.markup(record,style,size,dpi,options);
 const qr=window.ApexAssetLabelQR;
 if(!qr)throw Error('Offline QR label generator is missing.');
 const asset=labelEscape(record.id||'');
 const full=labelEscape(qr.deviceName(record)||'Unknown device');
 const model=labelEscape(record.model||'Unknown model');
 const maker=labelEscape(record.manufacturer||'');
 const serial=labelEscape(record.serial||'—');
 if(style==='assetDevice'){
   if(!window.ApexAssetBarcode)throw Error('Barcode encoder missing.');
   if(!record.id||!record.model)throw Error('An asset ID and device model are required for Asset Labels.');
   const settings=options.assetOptions||{};
   const include=Array.isArray(settings.fields)?settings.fields.filter(x=>['serial','processor','ram','storage','condition'].includes(x)).slice(0,5):[];
   const present=include.filter(key=>String(record[key]||'').trim());
   // Fit the entire requested data set on standard 2x1 stock before adjusting
   // any lettering. Keep the barcode's computed Code128 module width unchanged.
   const smallStock=['2x1','50x25'].includes(size);
   const density=present.length>=4?'dense':present.length>=2?'balanced':'spacious';
   const requested=({small:6,medium:8,large:10})[settings.barcodeHeight]||8;
   const barHeight=smallStock?(present.length>=4?5:present.length>=2?5.7:6.8):requested;
   const align=settings.align==='left'?'left':'center';
   const font=smallStock?(present.length>=4?6:present.length>=2?6.6:7.2):(({compact:7,normal:7.5,large:8.5})[settings.detailSize]||7.5);
   const rows={serial:['S/N',record.serial],processor:['CPU',record.processor],ram:['RAM',record.ram],storage:['SSD',record.storage],condition:['GRD',record.condition]};
   const details=present.map(key=>'<div class="apex-device-label-detail" data-field="'+key+'"><strong>'+rows[key][0]+':</strong> '+labelEscape(rows[key][1])+'</div>').join('');
   const geometry=labelCodeGeometry(record,style,size,dpi);
   let svg=geometry.svg;
   // Code 128 is a one-dimensional symbol: lock its measured horizontal module
   // width and only adjust bar height. Default SVG aspect-ratio fitting would
   // otherwise silently shrink the barcode horizontally on short labels.
   svg=svg.replace(/height="[^"]+"/,'height="'+barHeight+'mm"');
   svg=svg.replace(/\s+preserveAspectRatio="[^"]*"/g,'').replace('<svg ','<svg preserveAspectRatio="none" ');
   const device=full;
   const styleVars='--device-label-bar-height:'+barHeight+'mm;--device-label-align:'+align+';--device-label-detail-size:'+font+'pt';
   return `<div class="apex-label-stock apex-device-barcode-label" data-module-dots="${geometry.dots}" data-size="${size}" data-density="${density}" data-fields="${present.length}" data-align="${align}" style="${styleVars}" role="img" aria-label="Asset ${asset}, device ${device}">
     <div class="apex-barcode-image">${svg}</div>
     <div class="apex-barcode-human">${asset}</div>
     <div class="apex-device-label-name">${device}</div>
     <div class="apex-device-label-details">${details}</div>
   </div>`;
 }
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
 if(apexQuickBusy){notify('Finish or cancel the current label output first.');return;}
 apexQuickPreviewObserver?.disconnect();apexLabelData={...record};apexLabelChoice='assetDevice';apexLabelSize='2x1';apexQuickQA=null;
 showModal('Thermal labels · '+String(record.id),'INVENTORY / LABEL STUDIO',`<div class="modal-body apex-label-dialog">
 <div class="apex-label-workspace"><div class="apex-label-settings">
  <p class="apex-print-caption">Select a label design and your printer paper size.</p>
  <div class="apex-label-choices" role="group" aria-label="Label type">
   <button class="apex-label-type selected" type="button" data-label-type="assetDevice"><b>▥ Asset Label</b><small>Code 128 · Asset ID and device model</small></button>
   <button class="apex-label-type" type="button" data-label-type="refurb"><b>▦ Refurb QR Label</b><small>Same QR format as APEX Diagnostics</small></button>
   <button class="apex-label-type" type="button" data-label-type="qa"><b>QA Sticker</b><small>Saved serial number · Technician · Date</small></button>
  </div>
  <div id="apexQuickQAFields" class="apex-quick-qa-fields" hidden>
   <div class="apex-quick-qa-meta"><span>Serial number</span><strong>${labelEscape(record.serial||"Not recorded — blank on sticker")}</strong></div>
   <label class="field apex-label-size-select">Technician<select id="apexQuickTechnician" disabled><option value="">Loading saved technicians…</option></select></label>
   <p id="apexQuickTechnicianHelp" class="apex-quick-qa-help" role="status"></p>
   <button type="button" class="secondary" id="apexQuickManageTech">Manage technicians</button>
  </div>
  <label class="field apex-label-size-select">Label size<select id="apexPrintLabelSize"><option value="2x1" selected>2 × 1 inch · 50.8 × 25.4 mm</option></select></label>
  <label class="field apex-label-size-select">Printer resolution<select id="apexPrintLabelDpi"><option value="203">203 dpi · Zebra GK420t</option><option value="300">300 dpi</option><option value="600">600 dpi</option></select></label>
  <div class="apex-label-help"><strong>2 × 1 inch thermal labels:</strong> Select <b>50.8 × 25.4 mm</b> paper in your printer driver. Match the actual printer resolution (GK420t: 203 dpi), use Actual size / 100%, no margins and one label per page. Use <b>Save label PDF</b> for an exact-size PDF.</div>
 </div><div class="apex-label-display"><div class="apex-label-preview-title">LIVE LABEL PREVIEW · ${labelEscape(record.id)}</div><div id="apexLabelPreview" class="apex-label-preview"></div>
 <div class="apex-label-preview-desc" id="apexLabelDescription">Barcode encodes only ${labelEscape(record.id)}.</div></div></div>
 <div class="modal-actions apex-label-footer"><button class="secondary" type="button" id="apexLabelCancel">Cancel</button><button class="secondary" type="button" id="apexLabelCustom">Custom labels</button><button class="secondary" type="button" id="apexLabelSavePdf">Save label PDF</button><button class="primary" type="button" id="apexLabelPrintNow">▣ Print label</button></div></div>`);
 document.querySelectorAll('[data-label-type]').forEach(button=>button.onclick=()=>{
  if(apexQuickBusy)return;
  apexLabelChoice=button.dataset.labelType;
  $('apexQuickQAFields').hidden=apexLabelChoice!=='qa';
  document.querySelectorAll('[data-label-type]').forEach(b=>b.classList.toggle('selected',b===button));
  drawLabelPreview();
 });
 const technician=$('apexQuickTechnician');
 technician.onchange=()=>{if(apexQuickBusy)return;apexQuickQA=technician.value?{technician:technician.value,serial:String(record.serial||'').trim(),createdDate:quickLabelDate()}:null;drawLabelPreview();};
 $('apexQuickManageTech').onclick=()=>{if(apexQuickBusy)return;closeModal();window.ApexLabelStudio?.open('qaStickers');};
 if(window.apexInventory?.labelStudioSettings)loadQuickTechnicians(technician,$('apexQuickTechnicianHelp'));else $('apexQuickTechnicianHelp').textContent='Saved technicians require installed APEX.';
 $('apexPrintLabelSize').onchange=e=>{apexLabelSize=e.target.value;drawLabelPreview();};
 $('apexPrintLabelDpi').value=String(apexLabelDpi);
 $('apexPrintLabelDpi').onchange=e=>{apexLabelDpi=Number(e.target.value);drawLabelPreview();};
 $('apexLabelCancel').onclick=closeModal;
 $('apexLabelCustom').onclick=()=>{closeModal();window.ApexLabelStudio?.openForAsset(record.id);};
 $('apexLabelPrintNow').onclick=printSelectedAssetLabel;
 $('apexLabelSavePdf').onclick=()=>outputDesktopLabel('pdf');
 $('apexLabelSavePdf').disabled=!window.apexInventory?.saveLabelPdf;
 drawLabelPreview();
}
function labelPageUrl(preview=false){
 const payload=quickLabelPayload(preview);
 return 'asset-label-page.html?label='+encodeURIComponent(JSON.stringify(payload));
}
function drawLabelPreview(){
 const preview=$('apexLabelPreview');if(!preview||!apexLabelData)return;
 const description=$('apexLabelDescription');
 apexQuickPreviewObserver?.disconnect();apexQuickPreviewObserver=null;
 quickLabelButtons(false);preview.replaceChildren();
 try{
  const payload=quickLabelPayload(true);
  const geometry=payload.type==='qa'?null:labelCodeGeometry(payload.record,payload.type,payload.size,payload.dpi);
  const [w,h]=APEX_LABEL_SIZES[payload.size];
  const frame=document.createElement('iframe');frame.className='apex-isolated-label-preview';frame.title='Actual label layout preview';
  preview.append(frame);
  const resize=()=>{frame.style.height=(frame.getBoundingClientRect().width*h/w)+'px';try{frame.contentWindow?.apexResizeLabelPreview?.();}catch{}};
  resize();const observer=new ResizeObserver(()=>{if(frame.isConnected)resize();else observer.disconnect();});observer.observe(preview);apexQuickPreviewObserver=observer;
  frame.onload=async()=>{try{const win=frame.contentWindow;if(!win?.apexLabelReady)return;await win.apexLabelReady;if(!frame.isConnected)return;if(win.apexLabelError){description.textContent=win.apexLabelError;return;}resize();}catch(error){if(frame.isConnected)description.textContent=error.message;}};
  frame.src=labelPageUrl(true);
  description.textContent=payload.type==='qa'?'QA sticker · '+payload.qa.createdDate.split('-').reverse().join('/')+' · '+(payload.qa.serial?'Serial taken from saved asset.':'No saved serial — blank serial field.') : 'Code 128 / QR · '+geometry.dots+' printer dots per narrow bar/module. Print at actual size with matching paper size and no margins.';
  // Native output independently validates the exact label document. A missed preview load
  // event must not leave an otherwise valid label permanently disabled.
  quickLabelButtons(true);
 }catch(error){preview.textContent=apexLabelChoice==='qa'&&!apexQuickQA?'Choose a technician to preview the QA sticker.':'Unable to generate label: '+error.message;description.textContent=apexLabelChoice==='qa'&&!apexQuickQA?'The serial number is filled automatically from this asset.':error.message;quickLabelButtons(false);}
}
async function outputDesktopLabel(mode){
 if(apexQuickBusy)return;
 const method=mode==='pdf'?window.apexInventory?.saveLabelPdf:window.apexInventory?.printAssetLabel;
 if(!method){notify('Label output requires installed APEX.');return;}
 let payload;try{payload=quickLabelPayload(false);}catch(error){notify(error.message);return;}
 const original=$('apexLabelPrintNow');
 apexQuickBusy=true;quickLabelButtons(false);
 const controls=[...document.querySelectorAll('.apex-label-dialog [data-label-type],.apex-label-dialog select,#apexQuickManageTech,#apexLabelCustom')];
 const previous=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);
 try{
  const result=await method(payload);
  if(result?.ok)notify(mode==='pdf'?'Label PDF saved at the selected label size.':'Label sent to printer.');
  else if(!result?.cancelled)notify('Label output failed: '+(result?.error||'Unknown printer error'));
 }catch(error){notify('Label output failed: '+error.message);}
 finally{apexQuickBusy=false;controls.forEach((control,i)=>{if(control.isConnected)control.disabled=previous[i];});if(original?.isConnected)drawLabelPreview();}
}
function printSelectedAssetLabel(){
 if(window.apexInventory?.printAssetLabel){return outputDesktopLabel('print');}

 try{quickLabelPayload(false);}catch(error){notify(error.message);return;}
 if(apexLabelCleanup)apexLabelCleanup();
 let frame,timeout;
 const button=$('apexLabelPrintNow');button.disabled=true;
 const cleanup=()=>{clearTimeout(timeout);frame?.remove();if(button?.isConnected)button.disabled=false;apexLabelCleanup=null;};
 apexLabelCleanup=cleanup;
 try{
  if(apexLabelChoice!=='qa')labelCodeGeometry(apexLabelData,apexLabelChoice);
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



