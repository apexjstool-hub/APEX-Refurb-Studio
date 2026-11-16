'use strict';
/* Smart Barcode Workstation: a scan-first view over the existing inventory and
   refurbishment IPC workflows. Never stores a second asset/job database. */
(function(){
 const $=id=>document.getElementById(id);
 const root=$('workstationPage');
 if(!root||!window.ApexOps)return;
 let selected='',workflow=null,loading=false,commandBusy=false;
 const esc=typeof html==='function'?html:(s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c])));
 const asset=()=>items.find(a=>a.id===selected&&!a.deletedAt);
 const job=()=>workflow?.jobs?.[selected]||null;
 const cosmetic=p=>window.ApexRepairWork?.isCosmetic(p.name)||/respray|re[ -]?spray|paint/i.test(p.name);
 const active=()=>currentPage==='workstation';
 const cleanCode=s=>{
  const value=String(s||'').trim();
  try{return String(window.ApexAssetLabelQR?.readAssetId(value)||value).trim().toUpperCase();}catch{return value.toUpperCase();}
 };
 const message=(text,isError=false)=>{const node=$('wsMessage');if(node){node.textContent=text||'';node.classList.toggle('is-error',isError);}};
 const locked=()=>['Completed','On Hold'].includes(job()?.status||'');
 const status=part=>{
  const related=(workflow?.orders||[]).filter(o=>o.status!=='Draft').flatMap(o=>o.lines||[]).filter(l=>l.assetId===selected&&l.partId===part.id);
  const outstanding=related.reduce((n,l)=>n+Math.max(0,(Number(l.qty)||0)-(Number(l.received)||0)),0);
  const toOrder=Math.max(0,part.qty-part.received-outstanding);
  const label=part.fitted>=part.qty?'Fitted':part.received>=part.qty?'Received':outstanding>0?'Ordered':toOrder>0?'Needs ordering':'In progress';
  return {outstanding,toOrder,label};
 };
 async function fetchWorkflow(){
  const response=await api.workflow();
  if(!response?.ok)throw Error(response?.error||'Refurbishment data could not be loaded.');
  workflow=response.workflow||{jobs:{},orders:[]};
 }
 function reset(){
  selected='';workflow=null;$('wsScanInput').value='';renderWorkstation();$('wsScanInput').focus();
 }
 async function loadCode(value){
  if(loading||commandBusy)return;
  loading=true;message('Loading device and refurbishment data...');
  try{
   const code=cleanCode(value);
   if(!code){message('Scan or enter an asset barcode.',true);return;}
   // Refresh locally cached assets; no speculative or automatic write.
   await refresh(true);
   const match=items.find(a=>!a.deletedAt&&(a.id===code||String(a.serial||'').trim().toUpperCase()===code));
   if(!match){message('Asset not found in this inventory. Nothing was created or changed.',true);return;}
   selected=match.id;
   await fetchWorkflow();
   $('wsScanInput').value=selected;
   renderWorkstation();
   message('Asset '+selected+' loaded. All changes are made through existing APEX workflows.');
  }catch(e){message(e?.message||'Unable to load workstation data.',true);}
  finally{loading=false;}
 }
 async function reload(){
  if(!selected)return;
  try{await refresh(true);await fetchWorkflow();renderWorkstation();message('Device and job information refreshed.');}
  catch(e){message(e?.message||'Refresh failed.',true);}
 }
 function renderWorkstation(){
  const a=asset(),j=job(),box=$('wsCurrentAsset');
  $('wsEmpty').hidden=!!a;
  box.hidden=!a;
  if(!a)return;
  const specs=[['Processor',a.processor||'Not recorded'],['Memory',[a.ram,a.ramType].filter(Boolean).join(' ')||'Not recorded'],['Storage',a.storage||'Not recorded'],['Battery',a.batteryPercentage==null?'Not recorded':String(a.batteryPercentage)+'%']];
  const name=deviceName(a);
  $('wsDeviceName').textContent=name;
  $('wsAssetId').textContent=a.id;
  $('wsSerial').textContent=a.serial||'Not recorded';
  $('wsStatus').textContent=a.status||'Unknown';
  $('wsGrade').textContent=a.condition||'Not assessed';
  $('wsSpecs').innerHTML=specs.map(([k,v])=>'<div class="ws-spec"><small>'+esc(k)+'</small><b>'+esc(v)+'</b></div>').join('');
  $('wsJobStatus').textContent=j?.status||'No refurbishment job';
  $('wsNotes').textContent=j?.notes||'No engineer notes on this job.';
  const parts=j?.parts||[];
  const tbody=$('wsParts');
  tbody.innerHTML=parts.length?parts.map(p=>{
   const s=status(p),isCosmetic=cosmetic(p),isLocked=locked(),canReceive=p.received<p.qty&&s.outstanding>0,canFit=p.received>p.fitted;
   return '<div class="ws-part"><div class="ws-part-info"><b>'+esc(p.name)+'</b><small>'+esc(String(p.fitted))+' of '+esc(String(p.qty))+' '+(isCosmetic?'checked':'fitted')+' · '+esc(s.label)+'</small></div><div class="ws-part-actions">'+
    (s.toOrder>0&&!isLocked?'<button type="button" class="secondary" data-ws-action="order" data-part="'+esc(p.id)+'">'+(isCosmetic?'Record sent':'Mark ordered')+'</button>':'')+
    (canReceive&&!isLocked?'<button type="button" class="secondary" data-ws-action="receive" data-part="'+esc(p.id)+'">'+(isCosmetic?'Returned':'Received')+'</button>':'')+
    (canFit&&!isLocked?'<button type="button" class="primary" data-ws-action="fit" data-part="'+esc(p.id)+'">'+(isCosmetic?'Check finish':'Fit part')+'</button>':'')+
    '</div></div>';
  }).join(''):'<p class="section-note">No parts recorded. Use Manage refurbishment to add requirements.</p>';
  const pallets=[...new Set([...managedPallets.map(x=>x.name),...items.map(x=>x.pallet).filter(Boolean)])].filter(Boolean).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  $('wsPallet').innerHTML='<option value="">No pallet</option>'+pallets.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('');
  $('wsPallet').value=a.pallet||'';
  $('wsPalletSave').disabled=false;
  $('wsQC').disabled=!j;
  $('wsWorksheet').disabled=!j;
  $('wsManage').disabled=false;
  $('wsOrderAll').disabled=!j||locked()||!parts.some(p=>status(p).toOrder>0);
  $('wsJobNotes').disabled=!j;
 }
 async function markOrder(partId){
  const j=job(),part=j?.parts.find(p=>p.id===partId);
  if(!part||locked())return message('Job is locked or part is unavailable.',true);
  const s=status(part);
  if(!s.toOrder)return message('No remaining quantity to order.',true);
  const proceed=confirm('Record '+part.name+' as '+(cosmetic(part)?'sent for respray':'ordered')+' for asset '+selected+'? No supplier order will be placed.');
  if(!proceed)return;
  await apply({type:'markPartOrdered',assetId:selected,partId:part.id,expectedQty:part.qty,expectedReceived:part.received,expectedOnOrder:s.outstanding});
 }
 async function apply(command){
  if(commandBusy)return;
  commandBusy=true;
  try{
   const r=await api.workflowAction(command);
   if(!r?.ok)throw Error(r?.error||'Unable to update refurbishment record.');
   await reload();
   await window.ApexOps.load(true);
   message('Refurbishment update saved successfully.');
  }catch(e){message(e.message||'Update failed. Try refreshing.',true)}
  finally{commandBusy=false}
 }
 async function markAll(){
  const j=job();if(!j||locked()||commandBusy)return;
  const count=j.parts.filter(p=>status(p).toOrder>0).length;
  if(!count)return;
  if(!confirm('Record all '+count+' outstanding parts as ordered / sent for '+selected+'? This is a status update, not a supplier purchase.'))return;
  commandBusy=true;
  try{
   // Use the existing server-validated bulk workflow and signed preview.
   const planner=window.ApexBulkRefurbPlan;
   if(!planner?.prepare)throw Error('Bulk parts planner unavailable. Use individual part actions.');
   const preview=planner.prepare(workflow,items,[selected],'ordered');
   if(preview.invalid?.length)throw Error(preview.invalid.map(x=>x.reason||x.error||'Not eligible').join('; '));
   const response=await api.workflowAction({type:'bulkPartsStage',stage:'ordered',assetIds:[selected],expectedSignature:preview.signature,supplier:''});
   if(!response?.ok)throw Error(response?.error||'Unable to update parts.');
   await reload();await window.ApexOps.load(true);
   message('Outstanding parts marked ordered; supplier is optional.');
  }catch(e){message(e.message||'Bulk update failed.',true)}
  finally{commandBusy=false}
 }
 async function movePallet(){
  const a=asset();if(!a||commandBusy)return;
  const destination=$('wsPallet').value;
  if(destination===String(a.pallet||''))return message('Pallet assignment is unchanged.');
  if(!confirm('Move asset '+a.id+' to '+(destination||'No pallet')+'? This changes the existing Inventory record.'))return;
  commandBusy=true;$('wsPalletSave').disabled=true;
  try{
   const r=await api.update(a.id,{pallet:destination});
   if(!r?.ok)throw Error(r?.error||'Could not move the asset.');
   await reload();message('Pallet assignment saved.');
  }catch(e){message(e.message||'Unable to move asset.',true)}
  finally{commandBusy=false;$('wsPalletSave').disabled=false;}
 }
 function action(name,part){
  if(!asset())return;
  if(name==='order')markOrder(part);
  else if(name==='receive'){window.ApexOps.receivePart(selected+'|'+part);message('Confirm the physical receipt in the existing APEX dialog, then press Refresh.');}
  else if(name==='fit'){window.ApexOps.fitPart(selected+'|'+part);message('Confirm fitting in the existing APEX dialog, then press Refresh.');}
  else if(name==='manage')window.ApexOps.openJob(selected);
  else if(name==='notes')window.ApexOps.openJob(selected);
  else if(name==='qc')window.ApexOps.quality(selected);
  else if(name==='worksheet')window.ApexOps.printWorksheet(selected);
  else if(name==='label'){if(typeof openAssetPrintDialog==='function')openAssetPrintDialog(selected);else message('Open Device Details to print labels.',true);}
  else if(name==='details'){document.documentElement.removeAttribute('data-ws-focus');openAsset(selected);}
  else if(name==='orderAll')markAll();
  else if(name==='pallet')movePallet();
  else if(name==='next')reset();
  else if(name==='refresh')reload();
 }
 function toggleFocus(force){
  const next=force===undefined?document.documentElement.dataset.wsFocus!=='true':Boolean(force);
  if(next)document.documentElement.dataset.wsFocus='true';
  else document.documentElement.removeAttribute('data-ws-focus');
  $('wsFocusMode').setAttribute('aria-pressed',String(next));
  $('wsFocusMode').textContent=next?'↙ Exit focus mode':'⛶ Focus mode';
  $('wsScanInput').focus();
 }
 $('wsFocusMode').addEventListener('click',()=>toggleFocus());
  $('wsScanForm').addEventListener('submit',e=>{e.preventDefault();loadCode($('wsScanInput').value);});
 // Existing APEX modal dialogs own receipt, fitting, QC and job edits.
 // Re-read the canonical workflow after each dialog closes.
 const layer=$('modalLayer');
 if(layer&&typeof MutationObserver!=='undefined'){
  let wasOpen=!layer.classList.contains('hidden');
  new MutationObserver(()=>{
   const nowOpen=!layer.classList.contains('hidden');
   if(wasOpen&&!nowOpen&&active()&&selected&&!commandBusy)reload();
   wasOpen=nowOpen;
  }).observe(layer,{attributes:true,attributeFilter:['class']});
 }

 root.addEventListener('click',e=>{const button=e.target.closest('[data-ws-action]');if(button&&!button.disabled)action(button.dataset.wsAction,button.dataset.part);});
 const initialRender=render;
 render=function(...args){const result=initialRender(...args);if(active())renderWorkstation();return result;};
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&e.target===$('wsScanInput'))reset();});
 const previousSetPage=setPage;
 setPage=function(page,...args){
  if(page!=='workstation'){
   document.documentElement.removeAttribute('data-ws-focus');
   $('wsFocusMode').setAttribute('aria-pressed','false');
   $('wsFocusMode').textContent='⛶ Focus mode';
  }
  return previousSetPage(page,...args);
 };
 window.ApexWorkstation={open:()=>{setPage('workstation');$('wsScanInput').focus();},load:loadCode,refresh:reload};
})();
