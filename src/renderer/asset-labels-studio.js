'use strict';
/* Asset Labels: code128 asset ID + real manufacturer/model, using existing thermal label output. */
(function(){
 const host=document.getElementById('assetLabelsContent');if(!host)return;
 const el=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sizes={'2x1':'2 × 1 inch · 50.8 × 25.4 mm','50x25':'50 × 25 mm','50x30':'50 × 30 mm','60x40':'60 × 40 mm','40x30':'40 × 30 mm','80x30':'80 × 30 mm'};
 let selected=[],busy=false;
 const prefs={fields:[],barcodeHeight:'medium',align:'center',detailSize:'normal'};
 const active=()=>items.filter(a=>!a.deletedAt&&a.id);
 const name=a=>{const m=String(a.manufacturer||'').trim(),model=String(a.model||'').trim();return model.toLowerCase().startsWith(m.toLowerCase()+' ')?model:[m,model].filter(Boolean).join(' ')};
 const find=raw=>{
  const cleaned=window.ApexAssetLabelQR?.readAssetId(raw)||String(raw||'').trim();
  const value=String(cleaned).trim().toLowerCase();
  return active().find(a=>String(a.id).trim().toLowerCase()===value);
 };
 function message(s,bad=false){if(el('assetLabelsStatus')){el('assetLabelsStatus').textContent=s;el('assetLabelsStatus').dataset.error=bad?'true':'false';}}
 function positionPreview(preview,sheet,w,h){
  if(!preview?.isConnected)return;
  const scale=Math.min(2.8,Math.max(.1,(preview.clientWidth-40)/(w*96/25.4)),240/(h*96/25.4));
  sheet.style.transform='translate(-50%, -50%) scale('+scale+')';
  preview.style.height=Math.ceil(Math.max(170,h*96/25.4*scale+42))+'px';
 }
 window.addEventListener('resize',()=>{
  const preview=el('assetLabelsPreview'),sheet=el('assetLabelsPreviewSheet'),size=el('assetLabelsSize')?.value;
  if(preview&&sheet&&APEX_LABEL_SIZES[size])positionPreview(preview,sheet,...APEX_LABEL_SIZES[size]);
 });
 function render(){
  if(!host.isConnected)return;
  host.innerHTML=`<div class="label-studio apex-asset-label-studio"><div class="ls-heading"><h1>Asset Labels</h1><p>Scan, type or select an inventory asset. Each label prints its Code 128 barcode, Asset ID and real device name—without the APEX Asset Tag heading.</p></div>
  <div class="ls-grid">
   <section class="ls-panel"><h2>Choose your assets</h2>
    <form id="assetLabelsForm" class="apex-label-search"><label class="field">Scan or type Asset ID<input id="assetLabelsInput" list="assetLabelsOptions" placeholder="Scan asset barcode or enter asset number" autocomplete="off" spellcheck="false" required></label><datalist id="assetLabelsOptions">${active().slice(0,10000).map(a=>'<option value="'+esc(a.id)+'" label="'+esc(name(a))+'"></option>').join('')}</datalist><button class="primary" type="submit">Add asset</button></form>
    <label class="field">Or select a device<select id="assetLabelsPicker"><option value="">Choose an inventory asset…</option>${active().slice(0,10000).map(a=>'<option value="'+esc(a.id)+'">'+esc(a.id)+' · '+esc(name(a))+'</option>').join('')}</select></label>
    <p class="section-note">Only real inventory records are accepted. The device name is read from saved Manufacturer and Model fields.</p>
    <div id="assetLabelsSelection" class="apex-asset-label-selection" aria-live="polite"></div>
    <div class="ls-inline"><label class="field">Label size<select id="assetLabelsSize">${Object.entries(sizes).map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')}</select></label><label class="field">Printer resolution<select id="assetLabelsDpi"><option value="203">203 dpi</option><option value="300">300 dpi</option><option value="600">600 dpi</option></select></label></div>
    <div class="apex-asset-label-options"><h3>Customize label contents</h3><p class="section-note">The barcode, Asset ID and device model are always printed. Choose optional details below.</p><div class="ls-field-list" id="assetLabelsFields">
     <label><input type="checkbox" data-asset-label-field="serial"> Serial number</label>
     <label><input type="checkbox" data-asset-label-field="processor"> Processor / CPU</label>
     <label><input type="checkbox" data-asset-label-field="ram"> RAM</label>
     <label><input type="checkbox" data-asset-label-field="storage"> Storage</label>
     <label><input type="checkbox" data-asset-label-field="condition"> Grade / condition</label></div>
     <div class="ls-inline"><label class="field">Barcode height<select id="assetLabelsBarcodeHeight"><option value="small">Compact</option><option value="medium">Standard</option><option value="large">Tall</option></select></label><label class="field">Text alignment<select id="assetLabelsAlign"><option value="center">Centre</option><option value="left">Left</option></select></label></div>
     <label class="field">Specification text<select id="assetLabelsDetailSize"><option value="compact">Compact</option><option value="normal">Standard</option><option value="large">Large</option></select></label>
     <p class="section-note">For small labels, fewer details produce larger, more readable text. Missing specification values are omitted automatically.</p></div>
    <label class="field">Copies per selected asset<input id="assetLabelsCopies" type="number" min="1" max="20" value="1"></label>
    <p class="section-note">Print at Actual size / 100%, no margins. Match the selected paper size and DPI to your thermal printer.</p>
   </section>
   <section class="ls-panel"><div class="ls-preview-title">LIVE ASSET LABEL PREVIEW</div><div class="ls-preview-surface"><div id="assetLabelsPreview" class="apex-live-label-preview" role="img" aria-label="Exact-size asset label preview"><div id="assetLabelsPreviewSheet"></div></div></div><p id="assetLabelsStatus" class="ls-status" role="status">Select an asset to replace the example label with live inventory data.</p><button type="button" class="secondary" id="assetLabelsFitSize" hidden>Use 60 × 40 mm for all details</button><div class="ls-actions"><button type="button" class="secondary" id="assetLabelsPdf" disabled>Save label PDF</button><button type="button" class="primary" id="assetLabelsPrint" disabled>Print asset labels</button></div></section>
  </div></div>`;
  el('assetLabelsForm').onsubmit=e=>{e.preventDefault();add(el('assetLabelsInput').value);el('assetLabelsInput').value='';el('assetLabelsInput').focus();};
  el('assetLabelsPicker').onchange=e=>{if(e.target.value)add(e.target.value);e.target.value='';};
  for(const id of ['assetLabelsSize','assetLabelsDpi','assetLabelsCopies'])el(id).onchange=draw;
  for(const input of host.querySelectorAll('[data-asset-label-field]'))input.onchange=()=>{prefs.fields=[...host.querySelectorAll('[data-asset-label-field]:checked')].map(x=>x.dataset.assetLabelField);draw();};
  for(const id of ['assetLabelsBarcodeHeight','assetLabelsAlign','assetLabelsDetailSize'])el(id).onchange=()=>{prefs.barcodeHeight=el('assetLabelsBarcodeHeight').value;prefs.align=el('assetLabelsAlign').value;prefs.detailSize=el('assetLabelsDetailSize').value;draw();};
  el('assetLabelsBarcodeHeight').value=prefs.barcodeHeight;el('assetLabelsAlign').value=prefs.align;el('assetLabelsDetailSize').value=prefs.detailSize;
  for(const input of host.querySelectorAll('[data-asset-label-field]'))input.checked=prefs.fields.includes(input.dataset.assetLabelField);
  el('assetLabelsSelection').onclick=e=>{const btn=e.target.closest('[data-remove-label-asset]');if(btn){selected=selected.filter(id=>id!==btn.dataset.removeLabelAsset);draw();}};
  el('assetLabelsFitSize').onclick=()=>{el('assetLabelsSize').value=el('assetLabelsFitSize').dataset.target||'60x40';draw();};
  el('assetLabelsPrint').onclick=()=>output('print');
  el('assetLabelsPdf').onclick=()=>output('pdf');
  el('assetLabelsSize').value='2x1';
  draw();
 }
 function add(raw){
  const asset=find(raw);
  if(!asset){message('Asset was not found in Inventory. Refresh your inventory or check the scanned ID.',true);return;}
  if(!String(asset.model||'').trim()){message('Asset '+asset.id+' has no saved model. Set its model in Device Details before printing.',true);return;}
  if(!selected.includes(asset.id)&&selected.length>=100){message('Select up to 100 assets in one print batch.',true);return;}
  if(!selected.includes(asset.id))selected.push(asset.id);
  draw();
 }
 function records(){
  const current=selected.map(id=>active().find(a=>a.id===id));
  if(current.some(a=>!a||!String(a.model||'').trim()))return null;
  return current;
 }
 function copies(){const n=Number(el('assetLabelsCopies').value);return Number.isInteger(n)&&n>=1&&n<=20?n:0;}
 function payload(preview=false){
  const list=records(),num=copies();if(!list?.length||!num||list.length*num>300)return null;
  return {type:'assetDevice',records:list.flatMap(a=>Array.from({length:num},()=>({id:a.id,manufacturer:a.manufacturer,model:a.model,serial:a.serial,processor:a.processor,ram:a.ram,storage:a.storage,condition:a.condition}))),size:el('assetLabelsSize').value,dpi:Number(el('assetLabelsDpi').value),assetOptions:{fields:[...prefs.fields],barcodeHeight:prefs.barcodeHeight,align:prefs.align,detailSize:prefs.detailSize},preview};
 }
 function draw(){
  if(!host.querySelector('#assetLabelsSelection'))return;
  const assets=records(),count=copies(),valid=!!assets?.length&&!!count&&assets.length*count<=300&&!busy;
  el('assetLabelsSelection').innerHTML=selected.length?selected.map(id=>{const a=active().find(x=>x.id===id);return '<div class="apex-asset-label-row"><span><strong>'+esc(id)+'</strong><small>'+esc(a?name(a):'Asset unavailable')+'</small></span><button type="button" class="secondary" data-remove-label-asset="'+esc(id)+'">Remove</button></div>';}).join(''):'<p class="section-note">No assets selected yet.</p>';
  el('assetLabelsPrint').disabled=el('assetLabelsPdf').disabled=!valid;
  const preview=el('assetLabelsPreview'),sheet=el('assetLabelsPreviewSheet');
  const example={id:'85543',manufacturer:'Dell',model:'Latitude 5420',serial:'ABC123456',processor:'Intel Core i5',ram:'8GB',storage:'512GB SSD',condition:'Good'};
  const p=valid?payload(true):{type:'assetDevice',records:[example],size:el('assetLabelsSize').value,dpi:Number(el('assetLabelsDpi').value),assetOptions:{...prefs},preview:true};
  const [w,h]=APEX_LABEL_SIZES[p.size];
  const row=p.records[0];
  const advice=ApexDeviceLabelFit.recommendation(p.size,row,p.assetOptions);
  const fitSizeButton=el('assetLabelsFitSize');
  fitSizeButton.hidden=!advice.tooSmall;
  fitSizeButton.dataset.target='60x40';fitSizeButton.textContent='Use 60 × 40 mm for all details';
  const sizeWarning='This label is too small for the selected details. Use 60 × 40 mm (recommended) or remove specifications.';
  try{
   // Render the exact print markup on this page, and use the same physical fit
   // validator as PDF/thermal output. Never reduce barcode module width.
   sheet.innerHTML=makeLabelMarkup(row,p.type,p.size,p.dpi,p);
   sheet.style.width=w+'mm';sheet.style.height=h+'mm';
   preview.dataset.example=String(!valid);
   preview.dataset.size=p.size;
   // CSS positioning is centred. Scaling changes appearance only, never print geometry.
   positionPreview(preview,sheet,w,h);
   const result=ApexDeviceLabelFit.fit(sheet);
   if(!result.ok){
    const tooNarrow=/one printer dot/.test(result.error||'');
    fitSizeButton.dataset.target=tooNarrow?'80x30':'60x40';
    fitSizeButton.textContent=tooNarrow?'Use wider 80 × 30 mm label':'Use 60 × 40 mm for all details';
    message((valid?'Cannot print yet. ':'Example does not fit. ')+(result.error||sizeWarning),true);
    el('assetLabelsPrint').disabled=el('assetLabelsPdf').disabled=true;
    fitSizeButton.hidden=false;
   }else if(valid){
    message(assets.length+' asset(s) selected · '+(assets.length*count)+' label(s). Preview is fitted to the selected label stock and reflects printing.');
   }else{
    message('Example label shown. Scan or select an asset to preview its real details.');
   }
  }catch(error){
   sheet.innerHTML='<div class="apex-preview-empty">Preview unavailable: '+esc(error.message)+'</div>';
   message('Unable to preview label: '+error.message,true);
   el('assetLabelsPrint').disabled=el('assetLabelsPdf').disabled=true;
  }

 }
 async function output(mode){
  if(busy)return;const p=payload(false);if(!p){message('Select valid assets and label settings first.',true);return;}
  busy=true;el('assetLabelsPrint').disabled=el('assetLabelsPdf').disabled=true;
  try{const result=await (mode==='pdf'?api.saveLabelPdf(p):api.printAssetLabel(p));
   if(!result?.ok&&!result?.cancelled)throw Error(result?.error||'Label output failed.');
   if(result?.ok)notify(mode==='pdf'?'Asset label PDF saved.':'Asset labels sent to printer.');
  }catch(e){message(e.message,true);}finally{busy=false;draw();}
 }
 const prior=setPage;
 setPage=function(page,force){const ok=prior(page,force);if(ok&&page==='assetLabels')render();return ok;};
 window.ApexAssetLabels=Object.freeze({openForAsset(id){const ok=setPage('assetLabels');if(ok&&id)add(id);return ok;}});
})();
