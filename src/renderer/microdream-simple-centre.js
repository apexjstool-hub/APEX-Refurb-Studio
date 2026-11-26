'use strict';
/* Microdream simple workflow: scan a pallet or asset -> review eligible assets -> add to reference.
   No inventory pallet or location writes are permitted in this module. */
(function(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const same=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
 const key=ref=>'REF:'+ref;
 const isSpray=name=>/respray|re[ -]?spray|repaint|paint/i.test(String(name||''));
 const sourceRef=row=>row.reference||String(row.palletName||'').replace(/^REF:/,'');
 function mount(detail){
  if(!detail||detail.querySelector('#mdSimpleCentre'))return;
  const wrap=document.createElement('section');wrap.id='mdSimpleCentre';wrap.className='md-simple-centre';
  wrap.innerHTML='<div class="md-simple-head"><div><span class="md-simple-eyebrow">RESPRAY DISPATCH</span><h2>Microdream</h2><p>Scan original pallets or individual Asset IDs. Select the required resprays, then add them to one reference.</p></div><button type="button" class="secondary" id="mdSimpleRefresh">Refresh</button></div>'+
   '<div class="md-simple-workspace"><div class="md-simple-step"><span>1</span><div><strong>Scan inventory</strong><small>One field for pallets and assets</small></div></div>'+
   '<div class="md-simple-scan"><label for="mdSimpleScan">Pallet number or Asset ID<input id="mdSimpleScan" placeholder="Scan IR-560 or asset 83253" autocomplete="off" spellcheck="false" aria-describedby="mdSimpleHint"></label><button type="button" class="primary" id="mdSimpleFind">Add to review</button></div>'+
   '<div class="md-simple-scan-footer"><span id="mdSimpleHint">Scanner: press Enter automatically. Multiple scans build one review list.</span><button type="button" class="secondary" id="mdSimpleClear">Clear review</button></div>'+
   '<div id="mdSimpleMessage" role="status" aria-live="polite"></div><div id="mdSimplePreview"></div></div>'+
   '<div class="md-simple-ref-heading"><h3>Microdream references</h3><p>Track and dispatch resprays from multiple original pallets without changing their pallet numbers.</p></div><div id="mdSimpleReferences">Loading...</div>';
  const table=detail.querySelector('.pl-location-table-scroll')||detail.querySelector('.pl-location-empty');
  if(table){
   const legacy=document.createElement('details');legacy.className='md-original-pallets';legacy.innerHTML='<summary>View original pallet inventory and existing pallet actions</summary>';
   table.before(wrap);table.before(legacy);legacy.appendChild(table);
  }else detail.querySelector('.pl-location-pallets')?.appendChild(wrap);
  const $=id=>wrap.querySelector('#'+id);
  let state=null,assets=[],preview=[],selected=new Set(),busy=false,referenceDraft='';
  function status(message,error=false){const el=$('mdSimpleMessage');el.textContent=message;el.dataset.error=error?'true':'false';}
  function eligible(asset){
   const job=state?.jobs?.[asset.id];
   return job&&!['Completed','On Hold'].includes(job.status)&&(job.parts||[]).some(p=>isSpray(p.name)&&Number(p.fitted||0)<Number(p.qty||0));
  }
  function refs(){
   const rows=new Map();
   for(const row of state?.resprayAssignments||[])if(String(row.palletName||'').startsWith('REF:'))rows.set(row.palletName,{reference:sourceRef(row),draft:row});
   for(const row of state?.resprayPallets||[])if(String(row.palletName||'').startsWith('REF:')){
    const group=rows.get(row.palletName)||{reference:sourceRef(row)};
    if(!group.shipment||String(row.dispatchedAt||'')>String(group.shipment.dispatchedAt||''))group.shipment=row;
    rows.set(row.palletName,group);
   }
   return [...rows.values()].sort((a,b)=>a.reference.localeCompare(b.reference,undefined,{numeric:true}));
  }
  function drawPreview(){
   const host=$('mdSimplePreview');
   if(!preview.length){host.innerHTML='<div class="md-simple-zero"><strong>No assets scanned</strong><p>Scan a pallet to review its laptops, or scan one individual Asset ID.</p></div>';return;}
   const eligibleCount=preview.filter(eligible).length;
   const originalPallets=new Set(preview.map(a=>a.pallet).filter(Boolean));
   host.innerHTML='<div class="md-simple-step"><span>2</span><div><strong>Review respray requirements</strong><small>Eligible assets are preselected. Parts-only assets cannot be added.</small></div></div>'+
    '<div class="md-simple-preview-head"><div><b>'+preview.length+'</b> scanned assets <b>'+eligibleCount+'</b> need respray <b>'+originalPallets.size+'</b> original pallets</div><div class="md-simple-selection-actions"><button type="button" class="secondary" id="mdSimpleSelectAll">Select eligible</button><button type="button" class="secondary" id="mdSimpleUnselect">Deselect all</button></div></div>'+
    '<div class="md-simple-column-heading"><span>Asset / Original pallet</span><span>Outstanding work</span><span>Eligibility</span></div>'+
    '<div class="md-simple-rows">'+preview.map(a=>{
      const yes=!!eligible(a),checked=selected.has(a.id);
      const jobs=(state.jobs[a.id]?.parts||[]).filter(p=>Number(p.fitted||0)<Number(p.qty||0));
      return '<label class="md-simple-asset '+(yes?'':'md-simple-ineligible')+'"><input type="checkbox" data-md-asset="'+esc(a.id)+'" '+(yes?'':'disabled ')+(checked?'checked ':'')+'/>'+
       '<span><strong>'+esc(a.id)+'</strong><small>'+esc(a.model||a.name||'Unknown model')+' · Pallet '+esc(a.pallet||'Unassigned')+'</small></span>'+
       '<span>'+esc(jobs.map(p=>p.name).join(', ')||'No outstanding work')+'</span><small class="'+(yes?'md-simple-eligible':'')+'">'+(yes?'Respray needed':'Not eligible')+'</small></label>';
    }).join('')+'</div>'+
    '<div class="md-simple-step"><span>3</span><div><strong>Save to Microdream reference</strong><small>Select an existing reference or create a new one</small></div></div>'+
    '<div class="md-simple-save"><label for="mdSimpleReference">Microdream reference<input id="mdSimpleReference" list="mdSimpleReferenceList" maxlength="75" placeholder="e.g. MD100241187-7" autocomplete="off" value="'+esc(referenceDraft)+'"></label>'+
    '<datalist id="mdSimpleReferenceList">'+refs().filter(x=>!x.shipment||x.shipment.status==='Completed').map(x=>'<option value="'+esc(x.reference)+'"></option>').join('')+'</datalist>'+
    '<button id="mdSimpleSave" type="button" class="primary">Add selected to reference</button></div>';
   host.querySelectorAll('[data-md-asset]').forEach(input=>input.onchange=()=>{
     if(input.checked)selected.add(input.dataset.mdAsset);else selected.delete(input.dataset.mdAsset);
     host.querySelector('#mdSimpleSave').disabled=!selected.size;
   });
   host.querySelector('#mdSimpleSelectAll').onclick=()=>{selected=new Set(preview.filter(eligible).map(a=>a.id));drawPreview();};
   host.querySelector('#mdSimpleUnselect').onclick=()=>{selected.clear();drawPreview();};
   const refInput=$('mdSimpleReference');refInput.oninput=()=>{referenceDraft=refInput.value;};
   const save=$('mdSimpleSave');save.disabled=!selected.size;save.onclick=saveSelection;
  }
  function drawRefs(){
   const host=$('mdSimpleReferences'),groups=refs();
   host.innerHTML=groups.length?groups.map(g=>{
    const row=g.draft&&g.shipment?.status==='Completed'?null:g.shipment,ids=row?.manifest?.map(x=>x.assetId)||g.draft?.assetIds||[];
    const pallets=[...new Set((row?.manifest||[]).map(x=>x.originalPallet).filter(Boolean).concat(g.draft?.sourcePallets||[]))];
    const stage=row?.status||'Awaiting dispatch';
    return '<article class="md-simple-group" data-md-ref="'+esc(g.reference)+'"><div><strong>'+esc(g.reference)+'</strong><span>'+esc(stage)+'</span></div>'+
     '<p>'+ids.length+' respray assets · '+pallets.length+' original pallet(s): '+esc(pallets.join(', ')||'Not recorded')+'</p>'+
     '<div class="md-simple-group-actions"><button type="button" class="secondary" data-md-view>View assets</button><button type="button" class="secondary" data-md-print>Print summary</button>'+
     (!row?'<button type="button" class="primary" data-md-dispatch>Confirm dispatched</button>':row.status==='Dispatched'?'<button type="button" class="primary" data-md-return>Record returned</button>':row.status==='Returned'?'<button type="button" class="primary" data-md-complete>Confirm inspected & complete</button>':'')+'</div></article>';
   }).join(''):'<p>No respray references yet. Scan an original pallet above to begin.</p>';
   host.querySelectorAll('[data-md-ref]').forEach(card=>{
    const ref=card.dataset.mdRef;
    card.querySelector('[data-md-view]').onclick=()=>viewRef(ref);
    card.querySelector('[data-md-print]').onclick=()=>printRef(ref);
    for(const [selector,action] of [['[data-md-dispatch]','dispatchResprayPallet'],['[data-md-return]','returnResprayPallet'],['[data-md-complete]','completeResprayPallet']]){
     const button=card.querySelector(selector);if(button)button.onclick=()=>transition(ref,action);
    }
   });
  }
  async function refresh(){
   if(busy)return;busy=true;status('Refreshing inventory and Microdream references...');
   try{
    const [w,a]=await Promise.all([api.workflow(),api.list()]);
    if(!w.ok||!a.ok)throw Error(w.error||a.error||'Could not load inventory.');
    state=w.workflow;assets=(a.items||[]).filter(x=>!x.deletedAt);
    preview=preview.map(a=>assets.find(x=>same(x.id,a.id))).filter(Boolean);selected=new Set([...selected].filter(id=>preview.some(x=>x.id===id&&eligible(x))));drawPreview();
    drawRefs();status('');
   }catch(e){status(e.message||'Could not refresh Microdream.',true);}
   finally{busy=false;}
  }
  async function scanInput(){
   if(!state)await refresh();if(!state)return;
   const raw=$('mdSimpleScan').value.trim();
   if(!raw){status('Scan or enter an Asset ID or pallet number.',true);return;}
   // Explicit matches take precedence: a pallet barcode must never accidentally select a same-named asset.
   const palletCode=raw.replace(/^APEX[- :]*PALLET[- :]+/i,'').trim();
   const palletAssets=assets.filter(a=>same(a.pallet,palletCode));
   const asset=assets.find(a=>same(a.id,raw.replace(/^APEX[- :]*ASSET[- :]+/i,'')));
   const found=palletAssets.length?palletAssets:asset?[asset]:[];
   if(!found.length){status('No pallet or Asset ID matches '+raw+'. Confirm the scan and refresh inventory.',true);return;}
   const previously=new Set(preview.map(a=>a.id));
   const added=found.filter(a=>!previously.has(a.id));
   preview=[...preview,...added];
   for(const a of added)if(eligible(a))selected.add(a.id);
   drawPreview();
   $('mdSimpleScan').value='';$('mdSimpleScan').focus();
   status((palletAssets.length?'Pallet '+palletCode: 'Asset '+asset.id)+' reviewed: '+added.length+' new item(s), '+added.filter(eligible).length+' eligible for respray. Original pallet numbers unchanged.');
  }
  async function saveSelection(){
   const ref=String($('mdSimpleReference')?.value||'').trim();
   referenceDraft=ref;
   if(!ref||!/^[-A-Za-z0-9/._ ]{1,75}$/.test(ref)){status('Enter a reference using letters, numbers, hyphens, spaces, /, _ or .',true);return;}
   const ids=[...selected].filter(id=>preview.some(x=>x.id===id&&eligible(x)));
   if(!ids.length){status('Select at least one asset needing respray.',true);return;}
   const existing=refs().find(x=>same(x.reference,ref));
   if(existing?.shipment&&['Dispatched','Returned'].includes(existing.shipment.status)){status('That reference has already been dispatched. Use a new reference.',true);return;}
   const current=existing?.draft,merged=[...new Set([...(current?.assetIds||[]),...ids])];
   if(merged.length>300){status('Maximum 300 assets per reference. Create another shipment.',true);return;}
   if(busy)return;busy=true;
   try{
    const result=await api.workflowAction({type:'saveResprayAssignment',palletName:key(ref),reference:ref,assetIds:merged,expectedAssignmentId:current?.id||null,expectedUpdatedAt:current?.updatedAt||''});
    if(!result.ok)throw Error(result.error||'Cannot save reference.');
    status('Added '+ids.length+' selected respray asset(s) to '+ref+'. Original pallet numbers unchanged.');
    const w=await api.workflow();if(w.ok)state=w.workflow;
    drawRefs();drawPreview();
    notify('Microdream respray reference saved. Original pallets unchanged.');
   }catch(e){status(e.message||'Save failed; refresh and retry.',true);}
   finally{busy=false;}
  }
  function viewRef(ref){
   const entry=refs().find(x=>same(x.reference,ref));if(!entry)return;
   const active=entry.draft&&entry.shipment?.status==='Completed'?null:entry.shipment;
   const ids=active?.manifest?.map(x=>x.assetId)||entry.draft?.assetIds||[];
   showModal('Microdream '+ref,'RESPRAY / ASSET LIST','<div class="modal-body"><p>'+ids.length+' respray assets under reference '+esc(ref)+'</p><div class="md-simple-rows">'+
    ids.map(id=>{const a=assets.find(x=>x.id===id);return '<div class="md-simple-asset"><span><b>'+esc(id)+'</b><small>'+esc(a?.model||'')+'</small></span><span>Original pallet: '+esc(a?.pallet||entry.shipment?.manifest?.find(x=>x.assetId===id)?.originalPallet||'Unassigned')+'</span></div>';}).join('')+
    '</div><div class="modal-actions"><button type="button" class="secondary" id="mdSimpleClose">Close</button></div></div>');
   document.getElementById('mdSimpleClose').onclick=closeModal;
  }
  function printRef(ref){
   const entry=refs().find(x=>same(x.reference,ref));if(!entry)return;
   const ids=entry.shipment?.manifest?.map(x=>x.assetId)||entry.draft?.assetIds||[];
   const rows=ids.map(id=>{const a=assets.find(x=>x.id===id),origin=a?.pallet||entry.shipment?.manifest?.find(x=>x.assetId===id)?.originalPallet||'';
    return '<tr><td>'+esc(id)+'</td><td>'+esc(origin)+'</td><td>'+esc(a?.model||'')+'</td></tr>';}).join('');
   window.ApexOps?.printDocument('<h1>Microdream respray dispatch</h1><h2>Reference: '+esc(ref)+'</h2><p>'+ids.length+' respray assets. Original pallet numbers preserved.</p><table border="1" cellspacing="0" cellpadding="8"><thead><tr><th>Asset ID</th><th>Original pallet</th><th>Model</th></tr></thead><tbody>'+rows+'</tbody></table>','Microdream '+ref,'A4');
  }
  async function transition(ref,type){
   const entry=refs().find(x=>same(x.reference,ref));if(!entry||busy)return;
   const labels={dispatchResprayPallet:'Confirm this reference has been physically dispatched?',returnResprayPallet:'Confirm the shipment has returned?',completeResprayPallet:'Have all listed respray jobs been inspected and accepted? This marks the entire shipment complete.'};
   if(!await apexConfirm(labels[type]))return;
   busy=true;
   try{
    const result=await api.workflowAction({type,palletName:key(ref),expectedDispatchId:entry.shipment?.id,confirmChecked:type==='completeResprayPallet'});
    if(!result.ok)throw Error(result.error||'Could not update dispatch status.');
    status(ref+' updated successfully. Replacement parts and original inventory pallets remain unchanged.');
    notify(ref+' respray status updated.');const w=await api.workflow();if(w.ok)state=w.workflow;drawRefs();
   }catch(e){status(e.message||'Could not save status; refresh before retrying.',true);}
   finally{busy=false;}
  }
  $('mdSimpleRefresh').onclick=refresh;$('mdSimpleFind').onclick=scanInput;
  $('mdSimpleClear').onclick=()=>{preview=[];selected.clear();drawPreview();status('Review cleared; saved Microdream references are unchanged.');$('mdSimpleScan').focus();};
  $('mdSimpleScan').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();scanInput();}};
  refresh();
 }
 window.ApexMicrodreamSimple=Object.freeze({mount});
})();
