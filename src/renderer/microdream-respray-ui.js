'use strict';
/* Existing Microdream pallet = physical respray box; no duplicate box register. */
(function(){
 const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const $=id=>document.getElementById(id);
 const same=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
 const payload=name=>'APEX-MICRODREAM-PALLET:'+name;
 const parse=raw=>String(raw||'').trim().replace(/^APEX-MICRODREAM-PALLET:/i,'');
 let processing=false;
 function show(name){
  const pallet=managedPallets.find(p=>same(p.name,name)&&same(p.storageLocation,'Microdream'));
  if(!pallet){notify('Choose a pallet stored in the Microdream pallet location.');return;}
  const qr=window.ApexAssetLabelQR?.qrCodeSvg(payload(pallet.name))||'';
  showModal('Microdream pallet respray','RESPRAY / PALLET QR',`<div class="modal-body md-respray-modal">
   <div class="md-respray-head"><div><strong>${esc(pallet.name)}</strong><p>One Microdream pallet represents one physical respray box.</p></div><div class="md-respray-qr">${qr}</div></div>
   <label class="field">Scan this pallet QR, or type its name<input id="mdResprayScan" autocomplete="off" placeholder="Scan the QR on the box"></label>
   <div class="md-respray-actions"><button type="button" class="secondary" id="mdResprayAssign">Assign respray assets / reference</button><button type="button" class="secondary" id="mdResprayPrint">Print pallet QR</button><button type="button" class="secondary" id="mdResprayReload">Refresh status</button></div>
   <div id="mdResprayStatus" class="md-respray-status" role="status">Loading respray dispatch…</div>
   <div id="mdResprayManifest" class="md-respray-manifest"></div>
   <label class="md-respray-check"><input id="mdResprayConfirm" type="checkbox"> I have checked every listed laptop and all its respray work is complete.</label>
   <p id="mdResprayError" class="form-error" role="alert"></p>
   <div class="modal-actions"><button type="button" class="secondary" id="mdResprayClose">Close</button><button type="button" class="primary" id="mdResprayDispatch" disabled>Confirm dispatched</button><button type="button" class="primary" id="mdResprayReturn" disabled>Confirm pallet returned</button><button type="button" class="primary" id="mdResprayComplete" disabled>Mark all resprays complete</button></div></div>`);
  const scan=$('mdResprayScan');scan.value=pallet.name;
  $('mdResprayClose').onclick=closeModal;
  $('mdResprayAssign').onclick=()=>assign(pallet.name);
  $('mdResprayPrint').onclick=()=>{try{const html='<h2>APEX / MICRODREAM RESPRAY PALLET</h2><h1>'+esc(pallet.name)+'</h1><p>Reference: '+esc(record?.reference||assignment()?.reference||'Not set')+'</p><p>Scan to open this pallet in APEX and record dispatch or respray return.</p>'+qr+'<p>'+esc(payload(pallet.name))+'</p>';window.ApexOps.printDocument(html,'Microdream pallet QR','A4');}catch(e){$('mdResprayError').textContent=e.message;}};
  let record=null,workflow=null;
  const assignment=()=>workflow?.resprayAssignments?.find(x=>same(x.palletName,pallet.name));

  const inBox=()=>items.filter(a=>!a.deletedAt&&same(a.pallet,pallet.name));
  function preview(){
   const jobs=workflow?.jobs||{},stored=assignment(),selected=stored?stored.assetIds.map(id=>items.find(a=>a.id===id&&!a.deletedAt)).filter(Boolean):inBox(),rows=selected.flatMap(a=>{
    const parts=(jobs[a.id]?.parts||[]).filter(p=>/respray|re[ -]?spray|paint/i.test(p.name||'')&&p.fitted<p.qty);
    return parts.length?[{id:a.id,parts}]:[];
   });
   return rows;
  }
  async function reload(){
   $('mdResprayError').textContent='';
   try{
    const r=await api.workflow();if(!r.ok)throw Error(r.error||'Could not read refurbishment workflow.');
    workflow=r.workflow;record=(workflow.resprayPallets||[]).find(x=>same(x.palletName,pallet.name)&&['Dispatched','Returned'].includes(x.status))||null;
    const list=record?.manifest||preview();
    const stage=record?.status||(assignment()?'Assigned / awaiting dispatch':'Ready to dispatch');
    $('mdResprayStatus').textContent=(record?.reference||assignment()?.reference||'No Microdream reference')+' · '+stage+' · '+list.length+' laptop'+(list.length===1?'':'s')+' · '+list.reduce((n,x)=>n+x.parts.length,0)+' respray task(s)';
    $('mdResprayManifest').innerHTML=list.length?'<div class="md-respray-list">'+list.slice(0,60).map(x=>'<div><b>'+esc(x.assetId||x.id)+'</b><small>'+x.parts.map(p=>esc(p.name)).join(' · ')+'</small></div>').join('')+'</div>'+(list.length>60?'<p>Plus '+(list.length-60)+' additional laptops.</p>':''):'<p>No outstanding resprays are recorded on this pallet.</p>';
    $('mdResprayDispatch').hidden=!!record;$('mdResprayReturn').hidden=!record||record.status!=='Dispatched';$('mdResprayComplete').hidden=!record||record.status!=='Returned';
    $('mdResprayDispatch').disabled=!list.length||(!!assignment()&&!assignment().reference);$('mdResprayReturn').disabled=!record||record.status!=='Dispatched';
    $('mdResprayComplete').disabled=!record||record.status!=='Returned'||!$('mdResprayConfirm').checked;
    $('mdResprayConfirm').hidden=!record||record.status!=='Returned';$('mdResprayConfirm').parentElement.hidden=!record||record.status!=='Returned';
   }catch(e){$('mdResprayError').textContent=e.message;for(const key of ['mdResprayDispatch','mdResprayReturn','mdResprayComplete'])$(key).disabled=true;}
  }
  async function act(type){
   if(processing)return;
   const value=parse(scan.value);
   if(!same(value,pallet.name)){$('mdResprayError').textContent='Scanned pallet does not match this Microdream box. No changes saved.';return;}
   if(type==='completeResprayPallet'&&!$('mdResprayConfirm').checked){$('mdResprayError').textContent='Confirm every listed respray was checked first.';return;}
   processing=true;
   for(const key of ['mdResprayDispatch','mdResprayReturn','mdResprayComplete'])$(key).disabled=true;
   $('mdResprayError').textContent='';
   try{
    const r=await api.workflowAction({type,palletName:pallet.name,expectedDispatchId:record?.id,confirmChecked:type==='completeResprayPallet'&&$('mdResprayConfirm').checked});
    if(!r.ok)throw Error(r.error||'Unable to update respray pallet.');
    window.ApexOps?.load(true);
    notify(type==='completeResprayPallet'?r.completedTasks+' respray task(s) marked complete across '+r.affected+' laptop(s).':type==='returnResprayPallet'?'Pallet returned. Inspect all resprays before completing.':'Respray pallet dispatched.');
    await reload();
   }catch(e){$('mdResprayError').textContent=e.message;await reload();}finally{processing=false;}
  }
  $('mdResprayDispatch').onclick=()=>act('dispatchResprayPallet');
  $('mdResprayReturn').onclick=()=>act('returnResprayPallet');
  $('mdResprayComplete').onclick=()=>act('completeResprayPallet');
  $('mdResprayReload').onclick=reload;
  $('mdResprayConfirm').onchange=()=>{$('mdResprayComplete').disabled=!$('mdResprayConfirm').checked;};
  scan.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(!same(parse(scan.value),pallet.name))$('mdResprayError').textContent='Wrong pallet QR scanned. Check the box label.';else $('mdResprayError').textContent='Pallet verified. Choose the appropriate action below.';}};
  reload();
 }
 async function assign(name){
  const pallet=managedPallets.find(p=>same(p.name,name)&&same(p.storageLocation,'Microdream'));
  if(!pallet){notify('Choose a Microdream respray pallet first.');return;}
  showModal('Microdream respray assignment','RESPRAY / REFERENCE & SCANNING',`<form class="modal-body" id="mdAssignmentForm">
   <p>Add only assets requiring outstanding respray, including devices that also need replacement parts. Their original inventory pallets remain unchanged.</p>
   <label class="field">Microdream reference<input id="mdAssignmentReference" maxlength="80" required placeholder="MD100241187-7" autocomplete="off"></label>
   <label class="field">Scan Asset ID or enter manually<input id="mdAssignmentScan" autocomplete="off" placeholder="Scan an asset barcode, then press Enter"></label>
   <div class="md-respray-actions"><button type="button" class="secondary" id="mdAssignmentAdd">Add asset</button><button type="button" class="secondary" id="mdAssignmentRefresh">Refresh</button></div>
   <div id="mdAssignmentSummary" role="status"></div><div id="mdAssignmentList" class="md-respray-list"></div>
   <p id="mdAssignmentError" role="alert" class="form-error"></p>
   <div class="modal-actions"><button type="button" class="secondary" id="mdAssignmentClose">Cancel</button><button type="submit" class="primary" id="mdAssignmentSave">Save Microdream assignment</button></div>
   </form>`);
  let current=null,inventory=[],selected=[],busy=false;
  const error=$('mdAssignmentError'),reference=$('mdAssignmentReference'),scan=$('mdAssignmentScan'),summary=$('mdAssignmentSummary'),list=$('mdAssignmentList'),save=$('mdAssignmentSave');
  $('mdAssignmentClose').onclick=closeModal;
  function draw(){
   summary.textContent=selected.length+' asset'+(selected.length===1?'':'s')+' assigned to '+pallet.name;
   list.innerHTML=selected.length?selected.map(id=>{
    const asset=inventory.find(a=>a.id===id);
    return '<div class="md-assignment-row"><span><b>'+esc(id)+'</b><small>Original pallet: '+esc(asset?.pallet||'Unassigned')+'</small></span><button type="button" class="secondary" data-md-remove="'+esc(id)+'">Remove</button></div>';
   }).join(''):'<p>No respray assets assigned. Scan an asset ID to begin.</p>';
   list.querySelectorAll('[data-md-remove]').forEach(b=>b.onclick=()=>{selected=selected.filter(id=>id!==b.dataset.mdRemove);draw();});
  }
  async function load(){
   if(busy)return;busy=true;error.textContent='';
   try{
    const [w,a]=await Promise.all([api.workflow(),api.list()]);
    if(!w.ok||!a.ok)throw Error(w.error||a.error||'Cannot load current inventory.');
    inventory=(a.items||[]).filter(x=>!x.deletedAt);
    const shipment=(w.workflow.resprayPallets||[]).find(x=>same(x.palletName,pallet.name)&&['Dispatched','Returned'].includes(x.status));
    if(shipment)throw Error('This Microdream pallet has an active dispatch. Complete that shipment before changing assignments.');
    current=(w.workflow.resprayAssignments||[]).find(x=>same(x.palletName,pallet.name))||null;
    reference.value=current?.reference||'';selected=[...(current?.assetIds||[])];draw();
    scan.focus();
   }catch(e){error.textContent=e.message;save.disabled=true;}
   finally{busy=false;}
  }
  function add(){
   const id=scan.value.trim().toUpperCase();
   if(!id)return;
   const asset=inventory.find(a=>a.id===id);
   if(!asset){error.textContent='Asset '+id+' is not in active inventory. Refresh and retry.';return;}
   if(selected.includes(id)){error.textContent='Asset is already in this respray assignment.';return;}
   if(selected.length>=300){error.textContent='Maximum 300 respray assets per pallet.';return;}
   error.textContent='';selected.push(id);scan.value='';draw();scan.focus();
  }
  $('mdAssignmentAdd').onclick=add;
  scan.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add();}};
  $('mdAssignmentRefresh').onclick=load;
  $('mdAssignmentForm').onsubmit=async e=>{
   e.preventDefault();if(busy)return;busy=true;save.disabled=true;error.textContent='';
   try{
    const result=await api.workflowAction({type:'saveResprayAssignment',palletName:pallet.name,reference:reference.value.trim(),assetIds:selected,expectedAssignmentId:current?.id||null,expectedUpdatedAt:current?.updatedAt||''});
    if(!result.ok)throw Error(result.error||'Could not save Microdream assignment.');
    notify('Microdream reference and '+selected.length+' respray asset(s) saved. Original pallets unchanged.');
    window.ApexPalletStatusPolish?.refresh();
    closeModal();
   }catch(e){error.textContent=e.message;}finally{busy=false;if(save.isConnected)save.disabled=false;}
  };
  load();
 }
 window.ApexMicrodreamRespray=Object.freeze({open:show,assign,payload,parse});
})();
