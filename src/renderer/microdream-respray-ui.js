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
   <div class="md-respray-actions"><button type="button" class="secondary" id="mdResprayPrint">Print pallet QR</button><button type="button" class="secondary" id="mdResprayReload">Refresh status</button></div>
   <div id="mdResprayStatus" class="md-respray-status" role="status">Loading respray dispatch…</div>
   <div id="mdResprayManifest" class="md-respray-manifest"></div>
   <label class="md-respray-check"><input id="mdResprayConfirm" type="checkbox"> I have checked every listed laptop and all its respray work is complete.</label>
   <p id="mdResprayError" class="form-error" role="alert"></p>
   <div class="modal-actions"><button type="button" class="secondary" id="mdResprayClose">Close</button><button type="button" class="primary" id="mdResprayDispatch" disabled>Confirm dispatched</button><button type="button" class="primary" id="mdResprayReturn" disabled>Confirm pallet returned</button><button type="button" class="primary" id="mdResprayComplete" disabled>Mark all resprays complete</button></div></div>`);
  const scan=$('mdResprayScan');scan.value=pallet.name;
  $('mdResprayClose').onclick=closeModal;
  $('mdResprayPrint').onclick=()=>{try{const html='<h2>APEX / MICRODREAM RESPRAY PALLET</h2><h1>'+esc(pallet.name)+'</h1><p>Scan to open this pallet in APEX and record dispatch or respray return.</p>'+qr+'<p>'+esc(payload(pallet.name))+'</p>';window.ApexOps.printDocument(html,'Microdream pallet QR','A4');}catch(e){$('mdResprayError').textContent=e.message;}};
  let record=null,workflow=null;
  const inBox=()=>items.filter(a=>!a.deletedAt&&same(a.pallet,pallet.name));
  function preview(){
   const jobs=workflow?.jobs||{},rows=inBox().flatMap(a=>{
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
    const stage=record?.status||'Ready to dispatch';
    $('mdResprayStatus').textContent=stage+' · '+list.length+' laptop'+(list.length===1?'':'s')+' · '+list.reduce((n,x)=>n+x.parts.length,0)+' respray task(s)';
    $('mdResprayManifest').innerHTML=list.length?'<div class="md-respray-list">'+list.slice(0,60).map(x=>'<div><b>'+esc(x.assetId||x.id)+'</b><small>'+x.parts.map(p=>esc(p.name)).join(' · ')+'</small></div>').join('')+'</div>'+(list.length>60?'<p>Plus '+(list.length-60)+' additional laptops.</p>':''):'<p>No outstanding resprays are recorded on this pallet.</p>';
    $('mdResprayDispatch').hidden=!!record;$('mdResprayReturn').hidden=!record||record.status!=='Dispatched';$('mdResprayComplete').hidden=!record||record.status!=='Returned';
    $('mdResprayDispatch').disabled=!list.length;$('mdResprayReturn').disabled=!record||record.status!=='Dispatched';
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
 window.ApexMicrodreamRespray=Object.freeze({open:show,payload,parse});
})();
