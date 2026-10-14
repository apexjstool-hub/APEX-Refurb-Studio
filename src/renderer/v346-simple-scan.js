'use strict';
/* v3.4.6 — minimal Scan sidebar workspace + independent pallet register. */
(function(){
 const el=id=>document.getElementById(id);
 const clean=value=>String(value??'').trim().replace(/\s+/g,' ');
 const upper=value=>clean(value).toUpperCase();
 let batch=[];
 let lastMove=null;
 let transferBusy=false;
 // A scanner with an Enter suffix submits immediately through the form.
 // Scanners without a suffix are supported by a short, exact-match idle timer.
 // Manual entry and unknown values can still be submitted with Enter/Add.
 const IDLE_SUBMIT_MS=260;
 let autoScanTimer=null;
 let fastKeyCount=0;
 let lastKeyTime=0;
 let fastScanBurst=false;
 const scanField=el('v346ScanInput');
 const sounds=el('v360Sounds');
 try{sounds.checked=localStorage.getItem('apex-scan-sound-enabled')==='1';}catch{}
 sounds.addEventListener('change',()=>{try{localStorage.setItem('apex-scan-sound-enabled',sounds.checked?'1':'0');}catch{}});
 function feedbackTone(error=false){
  if(!sounds.checked)return;
  try{
   const AudioCtx=window.AudioContext||window.webkitAudioContext;
   if(!AudioCtx)return;
   const ctx=new AudioCtx(),osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type='sine';osc.frequency.value=error?300:880;gain.gain.value=.025;
   osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+(error?.11:.065));
   osc.onended=()=>ctx.close();
  }catch{} // scanning must never fail because audio cannot play
 }
 function updateUndo(){
  const bar=el('v360UndoBar');
  bar.classList.toggle('hidden',!lastMove);
  if(lastMove)el('v360UndoText').textContent=`${lastMove.entries.length} device(s) moved to ${lastMove.destination}.`;
  el('v360UndoMove').disabled=!lastMove||transferBusy;
 }

 function stopAutoScan(){if(autoScanTimer!==null){clearTimeout(autoScanTimer);autoScanTimer=null;}}
 function resetKeys(){fastKeyCount=0;lastKeyTime=0;fastScanBurst=false;}
 function exactKnownScan(raw){
  const value=clean(raw);
  if(!value)return false;
  const decoded=upper(window.ApexAssetLabelQR?.readAssetId(value)||value);
  const matchingAsset=items.some(a=>a.id===decoded);
  if(matchingAsset){
   // Avoid auto-adding a shorter ID that prefixes another registered Asset ID.
   return !items.some(a=>a.id!==decoded&&a.id.startsWith(decoded));
  }
  const loc=clean(value.replace(/^(LOCATION|LOC)\s*[:#]\s*/i,'' )).toLowerCase();
  const all=locations();
  return all.some(name=>name.toLowerCase()===loc) &&
   !all.some(name=>name.toLowerCase()!==loc&&name.toLowerCase().startsWith(loc));
 }
 function submitScan(){
  stopAutoScan();resetKeys();
  const value=scanField.value;
  if(!clean(value))return;
  scan(value);scanField.value='';
  if(currentPage==='bulk')scanField.focus();
 }
 function queueAutoScan(){
  stopAutoScan();
  const value=scanField.value;
  const exact=exactKnownScan(value);
  // Very rapid scanner keystrokes can also be recognised if the tag is unknown;
  // the existing validation then shows a clear error instead of silently dropping it.
  if(!exact && !(fastScanBurst&&clean(value).length>=6))return;
  autoScanTimer=setTimeout(()=>{
   autoScanTimer=null;
   if(currentPage!=='bulk'||scanField.value!==value)return;
   if(exactKnownScan(value)||(fastScanBurst&&clean(value).length>=6))submitScan();
  },IDLE_SUBMIT_MS);
 }

 function locations(){return [...new Set([...managedLocations,...items.map(a=>a.location).filter(x=>x&&x!=='Unassigned')])].sort((a,b)=>a.localeCompare(b));}
 function showStatus(text,error=false){const node=el('v346ScanStatus');node.textContent=text;node.classList.toggle('v346-error',error);node.classList.toggle('v348-success',!error && (/added|moved|cleared|found|undone|restored/.test(text.toLowerCase())));if(error||/added|found/.test(text.toLowerCase()))feedbackTone(error);}
 function drawScan(){
  const active=batch.map(id=>items.find(a=>a.id===id)).filter(Boolean);
  if(active.length!==batch.length)batch=active.map(x=>x.id);
  el('v346Count').textContent=`${active.length} device${active.length===1?'':'s'}`;
  // Keep the whole scanned-device section visible, including its header, when empty.
  el('v346BatchContent').classList.remove('hidden');
  el('v346Clear').disabled=active.length===0;
  el('v346MoveLocation').disabled=active.length===0||transferBusy;el('scanCreatePallet').disabled=transferBusy;
  el('v346DeviceList').innerHTML=`<table class="asset-table v346-table"><thead><tr><th>Asset ID</th><th>Full device name</th><th>Current assignment</th><th><span class="v352-actions-col">Action</span></th></tr></thead><tbody>${active.length?active.map(a=>`<tr><td><b>${html(a.id)}</b></td><td>${html(deviceName(a))}<small>${html(a.serial||'')}</small></td><td>${html(a.pallet||a.location||'Unassigned')}</td><td class="v346-remove-cell"><button class="v346-remove" type="button" data-remove-id="${html(a.id)}" aria-label="Remove ${html(a.id)} from scan list">Remove</button></td></tr>`).join(''):'<tr class="v352-empty-row"><td colspan="4">No devices scanned yet. Scan an Asset ID or a saved location above.</td></tr>'}</tbody></table>`;
  el('v346DeviceList').querySelectorAll('[data-remove-id]').forEach(b=>b.onclick=()=>{batch=batch.filter(id=>id!==b.dataset.removeId);drawScan();showStatus(`${b.dataset.removeId} removed from the scan list. No asset was moved.`);el('v346ScanInput').focus();});
  el('v346Destinations').innerHTML=[...new Set([...locations(),...managedPallets.map(p=>p.name)])].map(name=>`<option value="${html(name)}"></option>`).join('');
 }
 function scan(raw){
  const value=clean(raw);if(!value)return;
  const decoded=upper(window.ApexAssetLabelQR?.readAssetId(value)||value);
  const asset=items.find(a=>a.id===decoded);
  if(asset){inventoryLookupFeedback(true);if(batch.includes(asset.id)){showStatus(`${asset.id} already scanned — not added twice.`,true);return;}
   if(batch.length>=300){showStatus('Maximum 300 devices per move.',true);return;}
   batch.push(asset.id);showStatus(`${asset.id} added. ${batch.length} device(s) in your list.`);drawScan();return;}
  const scannedLocation=clean(value.replace(/^(LOCATION|LOC)\s*[:#]\s*/i,''));
  const found=locations().find(name=>name.toLowerCase()===scannedLocation.toLowerCase());
  if(found){const matches=items.filter(a=>a.location.toLowerCase()===found.toLowerCase());let added=0;
   for(const a of matches){if(batch.length>=300)break;if(!batch.includes(a.id)){batch.push(a.id);added++;}}
   showStatus(`${found}: ${matches.length} device(s) found, ${added} added${batch.length>=300?' (300-device limit)':''}.`);
   drawScan();return;}
  inventoryLookupFeedback(false);showStatus(`“${value}” isn't an existing Asset ID or location. Check the scan.`,true);
 }
 el('topScan').onclick=()=>setPage('bulk');
 scanField.addEventListener('keydown',event=>{
  if(event.key==='Enter'){
   stopAutoScan();
   return;
  }
  if(event.key.length!==1||event.ctrlKey||event.altKey||event.metaKey||event.repeat)return;
  const now=performance.now();
  const gap=now-lastKeyTime;
  fastKeyCount=(lastKeyTime&&gap<80)?fastKeyCount+1:1;
  lastKeyTime=now;
  if(fastKeyCount>=6)fastScanBurst=true;
 });
 scanField.addEventListener('input',queueAutoScan);
 // Most USB / Bluetooth barcode scanners act as a fast keyboard. If focus was
 // accidentally left on a button or blank area, capture a *complete recognised*
 // code from a rapid burst instead of losing the scan. Never interfere with
 // an editable field (destination location, search, login, etc.).
 let backgroundKeys='';let backgroundLast=0;let backgroundTimer=null;
 function clearBackground(){backgroundKeys='';backgroundLast=0;if(backgroundTimer!==null){clearTimeout(backgroundTimer);backgroundTimer=null;}}
 document.addEventListener('keydown',event=>{
  if(currentPage!=='bulk'||event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return;
  if(event.key==='F8'){event.preventDefault();scanField.focus();scanField.select();clearBackground();return;}
  const target=event.target;
  if(target?.closest?.('input,textarea,select,[contenteditable=true]')){clearBackground();return;}
  if(event.key==='Enter'){
   if(backgroundKeys.length>=6&&exactKnownScan(backgroundKeys)){
    event.preventDefault();const captured=backgroundKeys;clearBackground();scan(captured);scanField.value='';scanField.focus();
   }else clearBackground();
   return;
  }
  if(event.key.length!==1||event.repeat){return;}
  const now=performance.now();
  if(!backgroundLast||now-backgroundLast>110){backgroundKeys='';}
  backgroundLast=now;backgroundKeys+=event.key;
  if(backgroundTimer!==null)clearTimeout(backgroundTimer);
  backgroundTimer=setTimeout(()=>{
   const captured=backgroundKeys;const last=backgroundLast;clearBackground();
   if(currentPage==='bulk'&&captured.length>=6&&performance.now()-last>=180&&exactKnownScan(captured)){
    scan(captured);scanField.value='';scanField.focus();
   }
  },210);
 },true);
 el('v346ScanForm').onsubmit=event=>{event.preventDefault();submitScan();};
 el('v346Clear').onclick=()=>{if(transferBusy)return;stopAutoScan();resetKeys();batch=[];drawScan();showStatus('Scan list cleared. No inventory records changed.');el('v346ScanInput').focus();};
 // A review step ensures the operator sees the location and affected devices.
 el('v346MoveLocation').onclick=()=>{
  if(transferBusy)return;
  if(!batch.length){showStatus('Scan at least one laptop first.',true);return;}
  const typed=clean(el('v346Destination').value),targetPallet=managedPallets.find(p=>p.name.toLowerCase()===typed.toLowerCase()),destination=targetPallet?.name||locations().find(name=>name.toLowerCase()===typed.toLowerCase());
  if(!destination){showStatus('Choose an existing location or pallet, or press Create pallet.',true);el('v346Destination').focus();return;}
  const originals=batch.map(id=>items.find(a=>a.id===id));
  if(originals.some(a=>!a)){showStatus('Some assets are no longer available. Refresh and scan again.',true);return;}
  const unchanged=originals.filter(a=>targetPallet?upper(a.pallet)===upper(destination):a.location.toLowerCase()===destination.toLowerCase()&&!a.pallet).length;
  const preview=originals.slice(0,7).map(a=>`<li><strong>${html(a.id)}</strong> — ${html(deviceName(a))} <span>${html(a.location||'Unassigned')}</span></li>`).join('');
  showModal(targetPallet?'Review pallet transfer':'Review location transfer','SCAN / CONFIRM MOVE',`<div class="modal-body v360-review">
   <p>Move <b>${originals.length} laptop${originals.length===1?'':'s'}</b> to <strong>${html(destination)}</strong>?</p>
   <div class="v360-review-summary"><span>Destination</span><strong>${html(destination)}</strong><span>Already there</span><strong>${unchanged}</strong></div>
   <ul>${preview}${originals.length>7?`<li>… and ${originals.length-7} more devices</li>`:''}</ul>
   <p class="section-note">${targetPallet?'Their direct locations will be cleared and they will be assigned to this pallet.':'Their existing location and pallet assignments will be replaced.'} This batch can be undone until another user changes one of these assets.</p>
   <div id="v360TransferError" class="form-error" role="alert"></div>
   <div class="modal-actions"><button type="button" class="secondary" id="v360CancelMove">Cancel</button><button type="button" class="primary" id="v360ConfirmMove">Confirm move</button></div></div>`);
  el('v360CancelMove').onclick=()=>{closeModal();scanField.focus();};
  el('v360ConfirmMove').onclick=async()=>{
   if(transferBusy)return;
   transferBusy=true;el('v360ConfirmMove').disabled=true;el('v360ConfirmMove').textContent='Moving…';
   const expectedAssignments=originals.map(a=>({id:a.id,location:a.location,pallet:a.pallet||'',updatedAt:a.updatedAt}));
   try{
    const r=await api.bulkMove({ids:[...batch],location:targetPallet?'Unassigned':destination,pallet:targetPallet?destination:'',expectedAssignments});
    if(!r.ok){const message=r.error||'Transfer failed. No devices were moved.';el('v360TransferError').textContent=message;showStatus(message,true);return;}
    const count=batch.length;
    batch=[];el('v346Destination').value='';closeModal();await refresh();
    lastMove={destination,entries:expectedAssignments.map(a=>({id:a.id,location:a.location,pallet:a.pallet,expectedLocation:targetPallet?'Unassigned':destination,expectedPallet:targetPallet?destination:'',expectedUpdatedAt:items.find(x=>x.id===a.id)?.updatedAt||''}))};
    showStatus(`${count} device(s) moved to ${destination}. Undo is available below.`);updateUndo();drawScan();
   }catch(e){const message='Could not confirm the transfer. Refresh Inventory and check assignments before retrying.';showStatus(message,true);if(el('v360TransferError'))el('v360TransferError').textContent=message;}
   finally{transferBusy=false;updateUndo();drawScan();scanField.focus();}
  };
 };
 el('scanCreatePallet').onclick=()=>{if(transferBusy)return;window.ApexPalletPage.create(pallet=>{el('v346Destination').value=pallet.name;drawScan();showStatus(`${pallet.name} created. Ready to move the scanned devices.`);el('v346Destination').focus();});};
 el('v360UndoMove').onclick=async()=>{
  if(!lastMove||transferBusy)return;
  const previous=lastMove;
  if(!confirm(`Undo the move of ${previous.entries.length} laptop(s) to ${previous.destination}? This will restore their previous assignments.`))return;
  transferBusy=true;updateUndo();
  try{
   if(typeof api.undoBulkMove!=='function'){showStatus('Undo requires the updated v3.6.0 Inventory Hub. No records were changed.',true);return;}
   const r=await api.undoBulkMove({entries:previous.entries});
   if(!r.ok){showStatus(r.error||'Undo could not be completed. No records were changed.',true);return;}
   lastMove=null;batch=previous.entries.map(a=>a.id);await refresh();drawScan();updateUndo();
   showStatus(`${previous.entries.length} previous assignment(s) restored. The laptops are back in your scan list.`);
  }catch(e){showStatus('Undo could not be verified. Check device locations before trying again.',true);}
  finally{transferBusy=false;updateUndo();scanField.focus();}
 };
 const beforeRender=render;
 render=function(...args){const result=beforeRender(...args);if(currentPage==='bulk')drawScan();return result;};
 const beforePage=setPage;
 setPage=function(page,...rest){if(page!=='bulk')stopAutoScan();const result=beforePage(page,...rest);if(result&&page==='bulk'){drawScan();scanField.focus();}return result;};
 // Render initial empty list for users who arrive directly at Scan.
 drawScan();updateUndo();
})();
