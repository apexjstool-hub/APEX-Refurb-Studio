'use strict';
/* v3.4.6 — minimal Scan sidebar workspace + independent pallet register. */
(function(){
 const el=id=>document.getElementById(id);
 const clean=value=>String(value??'').trim().replace(/\s+/g,' ');
 const upper=value=>clean(value).toUpperCase();
 let batch=[];
 let lastMove=null;
 let transferBusy=false;
 let pendingReview=null;
 const clearInlineReview=()=>{pendingReview=null;const box=el('v346InlineReview');if(box)box.hidden=true;};
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
  const value=clean(raw).replace(/^APEX-MICRODREAM-PALLET:/i,'PALLET:');
  if(!value)return false;
  const decoded=upper(window.ApexAssetLabelQR?.readAssetId(value)||value);
  const matchingAsset=items.some(a=>!a.deletedAt&&a.id===decoded);
  if(matchingAsset){
   // Avoid auto-adding a shorter ID that prefixes another registered Asset ID.
   return !items.some(a=>a.id!==decoded&&a.id.startsWith(decoded));
  }
  const lookup=upper(value.replace(/^(PALLET|LOCATION|LOC)\s*[:#]\s*/i,(_,kind)=>kind.toUpperCase()+':'));
  const names=[...pallets().flatMap(p=>[upper(p.name),'PALLET:'+upper(p.name)]),...locations().flatMap(n=>[upper(n),'LOC:'+upper(n),'LOCATION:'+upper(n)]),...items.filter(a=>!a.deletedAt).map(a=>upper(a.id))];
  return names.includes(lookup)&&!names.some(n=>n!==lookup&&n.startsWith(lookup));
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

 function pallets(){return window.ApexPalletManagement.listPallets({items,pallets:managedPallets});}
 function locations(){return [...new Set([...managedLocations,...items.map(a=>a.location).filter(x=>x&&x!=='Unassigned')])].sort((a,b)=>a.localeCompare(b));}
 function showStatus(text,error=false){const node=el('v346ScanStatus');node.textContent=text;node.classList.toggle('v346-error',error);node.classList.toggle('v348-success',!error && (/added|moved|cleared|found|undone|restored/.test(text.toLowerCase())));if(error||/added|found/.test(text.toLowerCase()))feedbackTone(error);}
 function drawScan(){
  const active=batch.map(id=>items.find(a=>a.id===id)).filter(Boolean);
  if(active.length!==batch.length)batch=active.map(x=>x.id);
  el('v346Count').textContent=`${active.length} device${active.length===1?'':'s'}`;
  // Keep the whole scanned-device section visible, including its header, when empty.
  el('v346BatchContent').classList.remove('hidden');
  el('v346Clear').disabled=active.length===0;
  el('v346MoveLocation').disabled=active.length===0||transferBusy;
  el('v346SetAssetLocation').disabled=active.length===0||transferBusy;
  el('scanCreatePallet').disabled=transferBusy;
  el('v346CreateAssetLocation').disabled=transferBusy;
  el('v346DeviceList').innerHTML=`<table class="asset-table v346-table"><thead><tr><th>Asset ID</th><th>Full device name</th><th>Current assignment</th><th><span class="v352-actions-col">Action</span></th></tr></thead><tbody>${active.length?active.map(a=>`<tr><td><b>${html(a.id)}</b></td><td>${html(deviceName(a))}<small>${html(a.serial||'')}</small></td><td>${html('Asset: '+(a.location||'Unassigned')+(a.pallet?' · Pallet: '+a.pallet:''))}</td><td class="v346-remove-cell"><button class="v346-remove" type="button" data-remove-id="${html(a.id)}" aria-label="Remove ${html(a.id)} from scan list">Remove</button></td></tr>`).join(''):'<tr class="v352-empty-row"><td colspan="4">No devices scanned yet. Scan an Asset ID, pallet name or saved location above.</td></tr>'}</tbody></table>`;
  el('v346DeviceList').querySelectorAll('[data-remove-id]').forEach(b=>b.onclick=()=>{clearInlineReview();batch=batch.filter(id=>id!==b.dataset.removeId);drawScan();showStatus(`${b.dataset.removeId} removed from the scan list. No asset was moved.`);el('v346ScanInput').focus();});
  el('v346Destinations').innerHTML=pallets().map(p=>`<option value="${html(p.name)}"></option>`).join('');
  el('v346AssetLocationOptions').innerHTML=locations().map(name=>`<option value="${html(name)}"></option>`).join('');
 }
 function scan(raw){
  clearInlineReview();
  const value=clean(raw).replace(/^APEX-MICRODREAM-PALLET:/i,'PALLET:');if(!value)return;
  const decoded=upper(window.ApexAssetLabelQR?.readAssetId(value)||value);
  const asset=items.find(a=>!a.deletedAt&&a.id===decoded);
  if(asset&&pallets().some(p=>upper(p.name)===upper(value))){showStatus(`This name matches both a device and a pallet. Use PALLET: ${value} to load the whole pallet.`,true);return;}
  if(asset){inventoryLookupFeedback(true);if(batch.includes(asset.id)){showStatus(`${asset.id} already scanned — not added twice.`,true);return;}
   if(batch.length>=300){showStatus('Maximum 300 devices per move.',true);return;}
   batch.push(asset.id);showStatus(`${asset.id} added. ${batch.length} device(s) in your list.`);drawScan();return;}
  const palletName=clean(value.replace(/^PALLET\s*[:#]\s*/i,''));
  const pallet=!/^(LOCATION|LOC)\s*[:#]/i.test(value)&&pallets().find(p=>upper(p.name)===upper(palletName));
  if(pallet){
   const matches=items.filter(a=>!a.deletedAt&&upper(a.pallet)===upper(pallet.name)),fresh=matches.filter(a=>!batch.includes(a.id));
   if(batch.length+fresh.length>300){showStatus(`${pallet.name} contains ${matches.length} device(s). Adding all would exceed the 300-device move limit. Clear the list or move a smaller batch; no devices were added.`,true);return;}
   batch.push(...fresh.map(a=>a.id));inventoryLookupFeedback(true);showStatus(`${pallet.name}: ${matches.length} device(s) found, ${fresh.length} added. Choose the destination pallet and review the move.`);drawScan();return;
  }
  const scannedLocation=clean(value.replace(/^(LOCATION|LOC)\s*[:#]\s*/i,''));
  const found=locations().find(name=>name.toLowerCase()===scannedLocation.toLowerCase());
  if(found){const matches=items.filter(a=>a.location.toLowerCase()===found.toLowerCase());let added=0;
   for(const a of matches){if(batch.length>=300)break;if(!batch.includes(a.id)){batch.push(a.id);added++;}}
   showStatus(`${found}: ${matches.length} device(s) found, ${added} added${batch.length>=300?' (300-device limit)':''}.`);
   drawScan();return;}
  inventoryLookupFeedback(false);showStatus(`“${value}” isn't an existing Asset ID, pallet or location. Check the scan.`,true);
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
 el('v346Clear').onclick=()=>{if(transferBusy)return;clearInlineReview();stopAutoScan();resetKeys();batch=[];drawScan();showStatus('Scan list cleared. No inventory records changed.');el('v346ScanInput').focus();};
 // Both destinations share one scan list and an inline review, not a modal.
 function reviewedAssets(){
  const records=batch.map(id=>items.find(a=>a.id===id&&!a.deletedAt));
  if(!records.length||records.some(a=>!a))return null;
  return records;
 }
 function review(mode){
  if(transferBusy)return;
  const originals=reviewedAssets();
  if(!originals){showStatus('Scan at least one active asset, then review the assignment.',true);return;}
  let destination;
  if(mode==='pallet'){
   const typed=clean(el('v346Destination').value);
   const target=pallets().find(p=>upper(p.name)===upper(typed));
   if(!target){showStatus('Choose an existing pallet or use Create pallet first.',true);el('v346Destination').focus();return;}
   destination=target.name;
  }else if(mode==='location'){
   const typed=clean(el('v346AssetLocation').value);
   const target=locations().find(name=>upper(name)===upper(typed));
   if(!target){showStatus('Choose a saved asset location or create one first.',true);el('v346AssetLocation').focus();return;}
   destination=target;
  }else return;
  const changes=originals.filter(a=>mode==='pallet'?upper(a.pallet)!==upper(destination):upper(a.location)!==upper(destination));
  if(!changes.length){showStatus('All scanned assets already have that '+(mode==='pallet'?'pallet':'asset location')+'.');return;}
  pendingReview={mode,destination,records:originals.map(a=>({id:a.id,location:a.location,pallet:a.pallet||'',updatedAt:a.updatedAt}))};
  el('v346InlineReview').hidden=false;
  el('v346InlineReviewTitle').textContent=mode==='pallet'?'Confirm pallet transfer':'Confirm asset location update';
  el('v346InlineReviewSummary').textContent=changes.length+' of '+originals.length+' scanned asset(s) will change to '+destination+'.';
  el('v346InlineReviewDevices').innerHTML='<table class="asset-table"><thead><tr><th>Asset ID</th><th>Current asset location</th><th>Current pallet</th><th>New '+(mode==='pallet'?'pallet':'asset location')+'</th></tr></thead><tbody>'+changes.slice(0,50).map(a=>'<tr><td>'+html(a.id)+'</td><td>'+html(a.location||'Unassigned')+'</td><td>'+html(a.pallet||'None')+'</td><td>'+html(destination)+'</td></tr>').join('')+'</tbody></table>'+(changes.length>50?'<p>+'+(changes.length-50)+' more assets</p>':'');
  el('v346InlineReviewNotice').textContent=mode==='pallet'?'Uses the existing pallet transfer: it assigns the pallet and clears the direct asset location. The pallet’s own storage location is unchanged.':'Only Asset Location changes. Existing pallet IDs and pallet storage locations remain untouched.';
  el('v346InlineReviewError').textContent='';
  el('v346ReviewConfirm').textContent=mode==='pallet'?'Confirm pallet transfer':'Confirm asset locations';
  el('v346ReviewConfirm').disabled=false;
  el('v346InlineReview').scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 el('v346MoveLocation').onclick=()=>review('pallet');
 el('v346SetAssetLocation').onclick=()=>review('location');
 el('v346ReviewCancel').onclick=()=>{clearInlineReview();scanField.focus();};
 async function refreshLocationUndo(){
  try{const r=await api.lastBulkAssetLocation();el('v346UndoAssetLocation').disabled=transferBusy||!r.ok||!r.batch;el('v346UndoAssetLocation').title=r.batch?'Undo '+r.batch.count+' asset location changes from this PC':'No location batch available to undo on this PC';}
  catch{el('v346UndoAssetLocation').disabled=true;}
 }
 el('v346ReviewConfirm').onclick=async()=>{
  const planned=pendingReview;
  if(!planned||transferBusy)return;
  const latest=reviewedAssets();
  if(planned.mode!=='undo'&&(!latest||latest.length!==planned.records.length||latest.some((a,i)=>a.id!==planned.records[i].id||a.location!==planned.records[i].location||(a.pallet||'')!==planned.records[i].pallet||a.updatedAt!==planned.records[i].updatedAt))){
   el('v346InlineReviewError').textContent='Scanned assets changed since the review. Refresh and review again.';return;
  }
  transferBusy=true;el('v346ReviewConfirm').disabled=true;el('v346ReviewConfirm').textContent='Saving…';drawScan();
  try{
   if(planned.mode==='undo'){
    const answer=await api.undoLastBulkAssetLocation();
    if(!answer.ok)throw Error(answer.error||'Could not undo last location update.');
    clearInlineReview();await refresh();drawScan();showStatus(answer.restored+' asset location(s) restored. Pallets unchanged.');
   }else if(planned.mode==='pallet'){
    const entries=planned.records;
    const result=await api.bulkMove({ids:entries.map(a=>a.id),pallet:planned.destination,location:'Unassigned',expectedAssignments:entries});
    if(!result.ok)throw Error(result.error||'Pallet transfer failed.');
    await refresh();
    lastMove={destination:planned.destination,entries:entries.map(a=>({id:a.id,location:a.location,pallet:a.pallet,expectedLocation:'Unassigned',expectedPallet:planned.destination,expectedUpdatedAt:items.find(x=>x.id===a.id)?.updatedAt||''}))};
    batch=[];el('v346Destination').value='';clearInlineReview();drawScan();updateUndo();
    showStatus(entries.length+' asset(s) moved to pallet '+planned.destination+'. Undo last move is available below.');
   }else{
    // Cloud uses individually revision-checked writes. Report partial failures accurately.
    const records=planned.records.filter(a=>upper(a.location)!==upper(planned.destination));
    const batchGroup='loc-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
    let updated=0;
    for(let i=0;i<records.length;i+=300){
     const entries=records.slice(i,i+300);
     const result=await api.bulkSetAssetLocation({ids:entries.map(a=>a.id),location:planned.destination,groupId:batchGroup,expectedAssignments:entries});
     if(!result.ok)throw Error('Updated '+(updated+Number(result.updated||0))+' asset(s) before interruption. '+(result.error||'Refresh and check inventory before retrying.'));
     updated+=Number(result.updated||0);
    }
    await refresh();
    batch=[];el('v346AssetLocation').value='';clearInlineReview();drawScan();
    showStatus(updated+' asset location(s) set to '+planned.destination+'. Pallet assignments unchanged.');
   }
  }catch(error){
   el('v346InlineReviewError').textContent=error.message||'Update failed. Check inventory before retrying.';
   showStatus(error.message||'Update failed. Check inventory before retrying.',true);
  }finally{transferBusy=false;drawScan();updateUndo();await refreshLocationUndo();scanField.focus();}
 };
 el('v346AssetLocation').addEventListener('input',clearInlineReview);
 el('v346Destination').addEventListener('input',clearInlineReview);
 el('v346CreateAssetLocation').onclick=async()=>{
  if(transferBusy)return;
  const name=clean(el('v346AssetLocation').value);
  if(!name||name.length>90||/[<>\r\n]/.test(name)){showStatus('Enter a valid asset location name (1–90 characters).',true);return;}
  const previous=locations().find(x=>upper(x)===upper(name));
  if(previous){showStatus('That asset location already exists. Use Set location.');return;}
  transferBusy=true;drawScan();
  try{
   const r=await api.addLocation(name);if(!r.ok)throw Error(r.error||'Could not create the asset location.');
   managedLocations.push(name);el('v346AssetLocation').value=name;clearInlineReview();drawScan();
   showStatus('Asset location '+name+' created. You can now set it for scanned assets.');
  }catch(e){showStatus(e.message||'Could not create location.',true);}
  finally{transferBusy=false;drawScan();}
 };
 el('v346UndoAssetLocation').onclick=async()=>{
  if(transferBusy)return;
  const r=await api.lastBulkAssetLocation();
  if(!r.ok||!r.batch){showStatus('No recent batch available to undo on this PC.',true);return;}
  clearInlineReview();
  pendingReview={mode:'undo',records:[]};
  el('v346InlineReview').hidden=false;
  el('v346InlineReviewTitle').textContent='Review undo of last asset location batch';
  el('v346InlineReviewSummary').textContent='Restore '+r.batch.count+' asset location(s) from batch '+r.batch.id+'.';
  el('v346InlineReviewDevices').textContent='APEX will verify every asset and block undo if an affected asset has changed since the batch.';
  el('v346InlineReviewNotice').textContent='Pallet assignments are never changed by asset-location undo. Cloud undo may be partial if a connection is interrupted.';
  el('v346InlineReviewError').textContent='';
  el('v346ReviewConfirm').textContent='Confirm undo';
  el('v346ReviewConfirm').disabled=false;
 };
 el('scanCreatePallet').onclick=()=>{if(transferBusy)return;window.ApexPalletPage.create(pallet=>{el('v346Destination').value=pallet.name;clearInlineReview();drawScan();showStatus(`${pallet.name} created. Ready to move the scanned devices.`);el('v346Destination').focus();});};
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
 window.ApexScanWorkspace=Object.freeze({openSelection(ids=[]){setPage('bulk');for(const raw of ids){const id=upper(raw);if(items.some(a=>!a.deletedAt&&upper(a.id)===id)&&!batch.includes(id)&&batch.length<300)batch.push(id);}clearInlineReview();drawScan();scanField.focus();}});
 drawScan();updateUndo();refreshLocationUndo();
})();
