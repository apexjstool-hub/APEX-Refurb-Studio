'use strict';
// Browse a pallet/location in place without changing the All devices filters.
(function(){
 const host=$('containerInventoryContent');if(!host)return;
 let context=null,query='',page=0,assetReturn=false;
 const same=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
 function tab(){return context?.returnPage==='palletLocationDetail'||context?.returnPage==='palletLocations'?'palletLocations':context?.kind==='location'?'locations':'pallets';}
 function contents(){return context?items.filter(a=>!a.deletedAt&&same(context.kind==='pallet'?a.pallet:a.location||'Unassigned',context.name)):[];}
 function open(kind,name,options={}){
  if(!['pallet','location'].includes(kind)||!String(name||'').trim())return false;
  const before=context,oldQuery=query,oldPage=page;
  const returnPage=options.returnPage||(currentPage==='containerInventory'?context?.returnPage:currentPage)|| (kind==='pallet'?'pallets':'locations');
  context={kind,name:String(name),returnPage};query='';page=0;assetReturn=false;
  if(!setPage('containerInventory')){context=before;query=oldQuery;page=oldPage;return false;}
  return true;
 }
 function draw(){
  if(currentPage!=='containerInventory')return;
  const all=contents(),q=query.trim().toLowerCase(),filtered=all.filter(a=>!q||[a.id,deviceName(a),a.serial,a.condition,a.status].some(v=>String(v||'').toLowerCase().includes(q)));
  const totalPages=Math.max(1,Math.ceil(filtered.length/50));page=Math.max(0,Math.min(page,totalPages-1));const visible=filtered.slice(page*50,page*50+50),title=context?.name||'Inventory contents';
  const backNames={palletLocationDetail:'pallet location',palletLocations:'Pallet locations',pallets:'Pallets',locations:'Locations',dashboard:'Dashboard',reports:'Reports'};
  const backLabel='Back to '+(backNames[context?.returnPage]||'previous page');
  host.innerHTML=`<button type="button" class="secondary ci-back" id="ciBack">← ${backLabel}</button><div class="ci-heading"><div><span class="ci-eyebrow">${context?.kind==='pallet'?'PALLET INVENTORY':'LOCATION INVENTORY'}</span><h1>${html(title)}</h1><p><strong>${all.length}</strong> inventory item${all.length===1?'':'s'} in this ${context?.kind==='pallet'?'pallet':'location'}</p></div><button type="button" class="secondary" id="ciRefresh">Refresh</button></div><div class="ci-panel"><div class="ci-toolbar"><label for="ciSearch">Search these items</label><input type="search" id="ciSearch" placeholder="Search asset, model or serial…" value="${html(query)}"><span>${filtered.length} item${filtered.length===1?'':'s'}</span></div><div class="ci-table-scroll"><table class="asset-table"><thead><tr><th>Asset ID</th><th>Device</th><th>Serial</th><th>Condition</th><th>Status</th></tr></thead><tbody>${visible.map(a=>`<tr><td><a href="#device" data-ci-asset="${html(a.id)}">${html(a.id)}</a></td><td><strong>${html(deviceName(a))}</strong></td><td>${html(a.serial||'—')}</td><td>${conditionBadge(a.condition)}</td><td><span class="ci-status">${html(a.status||'Awaiting Processing')}</span></td></tr>`).join('')||`<tr><td colspan="5" class="ci-empty">${all.length?'No items match your search.':'There are no inventory items in this '+(context?.kind==='pallet'?'pallet':'location')+'.'}</td></tr>`}</tbody></table></div><div class="ci-pagebar"><span>Page ${page+1} of ${totalPages}</span><div><button type="button" class="secondary" id="ciPrevious" ${page===0?'disabled':''}>Previous</button><button type="button" class="secondary" id="ciNext" ${page>=totalPages-1?'disabled':''}>Next</button></div></div></div>`;
  $('ciBack').onclick=()=>setPage(context?.returnPage||'pallets');
  $('ciSearch').oninput=e=>{const position=e.target.selectionStart;query=e.target.value;page=0;draw();$('ciSearch').focus();if(position!==null)$('ciSearch').setSelectionRange(position,position);};
  $('ciRefresh').onclick=async()=>{const b=$('ciRefresh');b.disabled=true;try{await refresh();draw();}finally{if(b.isConnected)b.disabled=false;}};
  $('ciPrevious').onclick=()=>{page--;draw();};$('ciNext').onclick=()=>{page++;draw();};
  host.querySelectorAll('[data-ci-asset]').forEach(b=>b.onclick=e=>{e.preventDefault();const id=b.dataset.ciAsset;if(!contents().some(a=>same(a.id,id))){notify('This item has moved. Refresh this contents page.');return;}openAsset(id);assetReturn=currentPage==='asset'&&same(activeAssetId,id);updateAssetReturn();});
  $('breadSub').textContent=title;
 }
 function updateAssetReturn(){
  let b=$('ciReturnFromAsset');const existing=$('deviceReturnInventory');if(!existing)return;
  if(!b){b=document.createElement('button');b.type='button';b.id='ciReturnFromAsset';b.className='secondary';existing.after(b);b.onclick=()=>setPage('containerInventory');}
  b.hidden=!(assetReturn&&context&&currentPage==='asset');
  b.textContent='← Back to '+(context?.name||'contents');
 }
 // Existing device back buttons respect this browse context and the unsaved-change guard.
 for(const id of ['assetBack','assetCancel','deviceReturnInventory'])$(id)?.addEventListener('click',e=>{
  if(currentPage!=='asset'||!assetReturn||!context)return;
  e.preventDefault();e.stopImmediatePropagation();setPage('containerInventory');
 },true);
 const previousRender=render;render=function(...args){const result=previousRender(...args);draw();updateAssetReturn();return result;};
 const previousPage=setPage;setPage=function(next,force){const ok=previousPage(next,force);if(!ok)return false;if(!['asset','containerInventory'].includes(next))assetReturn=false;draw();updateAssetReturn();return true;};
 window.ApexContainerInventory=Object.freeze({open,tab});
})();
