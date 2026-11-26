'use strict';
/* Microdream simple workflow: scan existing pallet -> review eligible assets -> add to reference.
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
  wrap.innerHTML='<div class="md-simple-head"><div><h2>Microdream Respray Centre</h2><p>Scan a pallet, check the respray assets and add them to a reference. Original pallets and inventory stay unchanged.</p></div><button type="button" class="secondary" id="mdSimpleRefresh">Refresh</button></div>'+
   '<div class="md-simple-scan"><label>Scan or enter original pallet<input id="mdSimpleScan" placeholder="e.g. IR-560" autocomplete="off"></label><button type="button" class="primary" id="mdSimpleFind">Find respray assets</button></div>'+
   '<div id="mdSimpleMessage" role="status"></div><div id="mdSimplePreview"></div><div class="md-simple-ref-heading"><h3>Microdream references</h3><p>Multiple original pallets can share one reference.</p></div><div id="mdSimpleReferences">Loading...</div>';
  const table=detail.querySelector('.pl-location-table-scroll')||detail.querySelector('.pl-location-empty');
  if(table){
   const legacy=document.createElement('details');legacy.className='md-original-pallets';legacy.innerHTML='<summary>View original pallet inventory and existing pallet actions</summary>';
   table.before(wrap);table.before(legacy);legacy.appendChild(table);
  }else detail.querySelector('.pl-location-pallets')?.appendChild(wrap);
  const $=id=>wrap.querySelector('#'+id);
  let state=null,assets=[],pallet='',preview=[],selected=new Set(),busy=false;
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
   const host=$('mdSimplePreview');if(!pallet){host.innerHTML='';return;}
   const eligibleCount=preview.filter(eligible).length;
   host.innerHTML='<div class="md-simple-preview-head"><h3>Pallet '+esc(pallet)+'</h3><span>'+preview.length+' inventory assets · '+eligibleCount+' need respray</span></div>'+
    '<div class="md-simple-rows">'+(preview.length?preview.map(a=>{
      const yes=!!eligible(a),checked=selected.has(a.id);
      const jobs=(state.jobs[a.id]?.parts||[]).filter(p=>p.fitted<p.qty);
      return '<label class="md-simple-asset"><input type="checkbox" data-md-asset="'+esc(a.id)+'" '+(yes?'':'disabled ')+(checked?'checked ':'')+'/>'+
       '<span><strong>'+esc(a.id)+'</strong><small>'+esc(a.model||a.name||'Unknown model')+'</small></span>'+
       '<span>'+esc(jobs.map(p=>p.name).join(', ')||'No outstanding work')+'</span><small>'+(yes?'Respray eligible':'Parts only / no respray')+'</small></label>';
    }).join(''):'<p>No active assets belong to this original pallet.</p>')+'</div>'+
    '<div class="md-simple-save"><label>Microdream reference (existing or new)<input id="mdSimpleReference" list="mdSimpleReferenceList" maxlength="75" placeholder="e.g. MD100241187-7"></label>'+
    '<datalist id="mdSimpleReferenceList">'+refs().filter(x=>!x.shipment||x.shipment.status==='Completed').map(x=>'<option value="'+esc(x.reference)+'"></option>').join('')+'</datalist>'+
    '<button id="mdSimpleSave" type="button" class="primary">Add selected to reference</button></div>';
   host.querySelectorAll('[data-md-asset]').forEach(input=>input.onchange=()=>{
     if(input.checked)selected.add(input.dataset.mdAsset);else selected.delete(input.dataset.mdAsset);
   });
   const save=$('mdSimpleSave');save.disabled=!eligibleCount;save.onclick=saveSelection;
  }
  function drawRefs(){
   const host=$('mdSimpleReferences'),groups=refs();
   host.innerHTML=groups.length?groups.map(g=>{
    const row=g.shipment,ids=row?.manifest?.map(x=>x.assetId)||g.draft?.assetIds||[];
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
    if(pallet){preview=assets.filter(x=>same(x.pallet,pallet));selected=new Set([...selected].filter(id=>preview.some(x=>x.id===id&&eligible(x))));drawPreview();}
    drawRefs();status('');
   }catch(e){status(e.message||'Could not refresh Microdream.',true);}
   finally{busy=false;}
  }
  async function findPallet(){
   if(!state)await refresh();if(!state)return;
   const raw=$('mdSimpleScan').value.trim();
   if(!raw){status('Scan or enter a pallet number first.',true);return;}
   pallet=raw;preview=assets.filter(a=>same(a.pallet,pallet));
   selected=new Set(preview.filter(eligible).map(a=>a.id));
   drawPreview();
   status(!preview.length?'No inventory assets found on '+pallet+'. Check the original pallet number.':selected.size+' of '+preview.length+' assets automatically selected for respray.',!preview.length);
  }
  async function saveSelection(){
   const ref=String($('mdSimpleReference')?.value||'').trim();
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
    status('Added '+ids.length+' respray asset(s) from '+pallet+' to '+ref+'. Original pallet numbers unchanged.');
    const w=await api.workflow();if(w.ok)state=w.workflow;
    drawRefs();drawPreview();
    notify('Microdream respray reference saved. Original pallets unchanged.');
   }catch(e){status(e.message||'Save failed; refresh and retry.',true);}
   finally{busy=false;}
  }
  function viewRef(ref){
   const entry=refs().find(x=>same(x.reference,ref));if(!entry)return;
   const ids=entry.shipment?.manifest?.map(x=>x.assetId)||entry.draft?.assetIds||[];
   showModal('Microdream '+ref,'RESRAY / ASSET LIST','<div class="modal-body"><p>'+ids.length+' respray assets under reference '+esc(ref)+'</p><div class="md-simple-rows">'+
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
   if(!confirm(labels[type]))return;
   busy=true;
   try{
    const result=await api.workflowAction({type,palletName:key(ref),expectedDispatchId:entry.shipment?.id,confirmChecked:type==='completeResprayPallet'});
    if(!result.ok)throw Error(result.error||'Could not update dispatch status.');
    status(ref+' updated successfully. Replacement parts and original inventory pallets remain unchanged.');
    notify(ref+' respray status updated.');const w=await api.workflow();if(w.ok)state=w.workflow;drawRefs();
   }catch(e){status(e.message||'Could not save status; refresh before retrying.',true);}
   finally{busy=false;}
  }
  $('mdSimpleRefresh').onclick=refresh;$('mdSimpleFind').onclick=findPallet;
  $('mdSimpleScan').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();findPallet();}};
  refresh();
 }
 window.ApexMicrodreamSimple=Object.freeze({mount});
})();
