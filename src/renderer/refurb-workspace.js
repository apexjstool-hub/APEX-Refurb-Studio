'use strict';
/* Additive refurbishment workspace. All writes reuse existing authenticated operations. */
(function(){
 const $=id=>document.getElementById(id),root=$('refurbWorkspacePage');
 if(!root||!window.ApexOps)return;
 const views={queue:['Work queue','Parts, respray and the next action for each laptop.'],purchasing:['Parts & purchasing','Manage requirements, supplier orders and deliveries together.'],qc:['Quality control','Use the existing checks to finish refurbishment jobs.'],completed:['Completed','Recorded completed refurbishment jobs.']};
 const filterNames={all:'All active',order:'Needs ordering',delivery:'Awaiting delivery',fit:'Ready to fit',respray:'Needs respray',qc:'Awaiting QC',hold:'On hold'};
 let view='queue',purchase='parts',filter='all',query='',page=0,returnToQueue=false,queueScroll=0;
 const expanded=new Set(),selected=new Set(),homes=new Map();
 const snapshot=()=>window.ApexWorkflowSnapshot;
 const esc=html,locked=j=>['Completed','On Hold'].includes(j.status);
 const spray=p=>/respray|re[ -]?spray|paint/i.test(String(p.name||''));
 const button=(label,action,id,part='')=>'<button type="button" class="secondary" data-rw-action="'+action+'" data-rw-id="'+esc(id)+'" data-rw-part="'+esc(part)+'">'+label+'</button>';
 const active=()=>currentPage==='refurbWorkspace';
 function restorePanels(){for(const [id,marker] of homes){const node=$(id);if(node&&marker.parentNode)marker.after(node);}}
 function mount(id){
  restorePanels();const node=$(id);if(!node)return;
  if(!homes.has(id)){const marker=document.createComment('Refurbishment panel home');node.before(marker);homes.set(id,marker);}
  $('rwExistingPanel').append(node);
 }
 function entries(){
  const s=snapshot();if(!s)return [];
  const byAsset=new Map(items.filter(a=>!a.deletedAt).map(a=>[a.id,a])),summaries=window.ApexInventoryWorkflow.index(s);
  return Object.values(s.jobs||{}).filter(j=>byAsset.has(j.assetId)).map(j=>({job:j,asset:byAsset.get(j.assetId),summary:summaries.get(j.assetId),activity:window.ApexInventoryWorkflow.latest(j,s.audit)})).sort((a,b)=>String(b.job.updatedAt||'').localeCompare(String(a.job.updatedAt||''))||a.job.assetId.localeCompare(b.job.assetId,undefined,{numeric:true}));
 }
 function matches(row,value){
  const s=row.summary,j=row.job;
  if(j.status==='Completed')return false;
  if(value==='all')return true;if(value==='hold')return j.status==='On Hold';if(locked(j))return false;
  if(value==='respray')return s.parts.some(p=>spray(p)&&p.fitted<p.required);
  if(value==='order')return s.toOrder>0;if(value==='delivery')return s.awaiting>0;if(value==='fit')return s.toFit>0;
  return s.key===value;
 }
 function selectionState(){
  $('rwSelected').textContent=selected.size+' selected';$('rwSelectionBar').hidden=!selected.size;
  for(const id of ['rwOrderSelected','rwReceiveSelected','rwPrintSelected','rwClearSelection'])$(id).disabled=!selected.size;
 }
 function detail(row){
  const j=row.job,s=row.summary,e=row.activity;
  const actions=(!locked(j)&&s.toOrder?button('Order parts','order',j.assetId):'')+(!locked(j)&&s.parts.some(p=>p.received<p.required)?button('Receive all parts','receiveAll',j.assetId):'')+button('Edit job','job',j.assetId)+button('QC checklist','qc',j.assetId)+button('Print worksheet','print',j.assetId);
  const parts=s.parts.map(p=>'<tr><td><b>'+esc(p.name)+'</b><small class="rw-part-kind">'+(spray(p)?'Respray':'Replacement part')+'</small></td><td>'+p.required+'</td><td>'+p.ordered+'</td><td>'+p.received+'</td><td>'+p.fitted+'</td><td>'+(!locked(j)&&p.received<p.required?button('Mark received','receive',j.assetId,p.id):'')+(!locked(j)&&p.toFit?button(spray(p)?'Record progress':'Record fitted','fit',j.assetId,p.id):'')+(p.fitted>=p.required?'Complete':locked(j)?'Job is locked':'')+'</td></tr>').join('');
  return '<div class="rw-detail"><div class="rw-detail-top"><div><strong>Next: '+esc(s.next)+'</strong><p>Technician: '+esc(j.technician||'Unassigned')+' · Recorded stage: '+esc(j.status)+'</p></div><div class="rw-actions">'+actions+'</div></div><div class="rw-table-scroll"><table class="inventory-parts-table"><thead><tr><th>Part / respray task</th><th>Required</th><th>Ordered</th><th>Received</th><th>Fitted / done</th><th>Action</th></tr></thead><tbody>'+ (parts||'<tr><td colspan="6">No parts or respray requirements recorded. Review the job and QC checklist.</td></tr>')+'</tbody></table></div>'+(j.notes?'<p class="rw-notes">'+esc(j.notes)+'</p>':'')+'<div class="rw-last">'+(e?'Last activity: '+esc(new Date(e.at).toLocaleString())+' · '+esc(e.by||'Recorded activity')+' · '+esc(e.text):'No recorded refurbishment activity yet.')+'</div></div>';
 }
 function drawQueue(){
  const rows=entries(),valid=new Set(rows.map(r=>r.job.assetId));for(const id of selected)if(!valid.has(id))selected.delete(id);
  for(const id of expanded)if(!valid.has(id))expanded.delete(id);
  $('rwQueueSummary').innerHTML=[['Active jobs',rows.filter(r=>r.job.status!=='Completed').length],['Awaiting delivery',rows.filter(r=>matches(r,'delivery')).length],['Ready to fit',rows.filter(r=>matches(r,'fit')).length]].map(([label,count])=>'<div><span>'+label+'</span><strong>'+count+'</strong></div>').join('');
  $('rwFilters').innerHTML=Object.entries(filterNames).map(([key,name])=>'<button type="button" class="secondary '+(filter===key?'selected':'')+'" data-rw-filter="'+key+'" aria-pressed="'+(filter===key)+'">'+name+' <span>'+rows.filter(r=>matches(r,key)).length+'</span></button>').join('');
  const q=query.trim().toLowerCase(),list=rows.filter(r=>matches(r,filter)&&(!q||[r.asset.id,deviceName(r.asset),r.asset.serial,r.asset.location,r.asset.pallet,r.job.technician,...r.summary.parts.map(p=>p.name)].some(v=>String(v||'').toLowerCase().includes(q))));
  const pages=Math.max(1,Math.ceil(list.length/50));page=Math.max(0,Math.min(page,pages-1));const visible=list.slice(page*50,page*50+50);
  $('rwResults').textContent=list.length+' of '+rows.length+' jobs';
  const loaded=!!snapshot();
  $('rwQueueTable').innerHTML=visible.length?'<div class="rw-table-scroll"><table class="asset-table rw-work-table"><thead><tr><th><input id="rwSelectVisible" class="inventory-row-select" type="checkbox" aria-label="Select visible refurbishment jobs"></th><th>Device</th><th>Progress</th><th>Next action</th></tr></thead><tbody>'+visible.map((r,i)=>{
   const id=r.job.assetId,s=r.summary,process=window.ApexDeviceSummary.process(r.asset,snapshot()),open=expanded.has(id);
   const assignment=r.asset.pallet||r.asset.location||'Unassigned',assignmentType=r.asset.pallet?'Pallet':'Location';
   return '<tr class="rw-job-row '+(selected.has(id)?'inventory-row-selected':'')+'"><td class="inventory-selection-cell"><input type="checkbox" class="inventory-row-select" data-rw-select="'+esc(id)+'" aria-label="Select '+esc(id)+'" '+(selected.has(id)?'checked':'')+'></td><td><button type="button" class="asset-link" data-rw-action="device" data-rw-id="'+esc(id)+'">'+esc(id)+'</button><b class="rw-device-name" title="'+esc(deviceName(r.asset))+'">'+esc(deviceName(r.asset))+'</b><div class="rw-device-meta"><span title="'+esc(r.asset.serial||'Not recorded')+'"><small>Serial</small> '+esc(r.asset.serial||'Not recorded')+'</span><span title="'+esc(assignment)+'"><small>'+assignmentType+'</small> '+esc(assignment)+'</span></div></td><td><span class="inventory-stage inventory-stage-'+s.key+'">'+esc(s.stage)+'</span><div class="rw-task-tags">'+process.labels.map(label=>'<span class="rw-tag">'+esc(label)+'</span>').join('')+'</div><div class="rw-progress-track" role="progressbar" aria-label="Parts and respray completed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.max(0,Math.min(100,s.required?Math.round(s.fitted/s.required*100):0))+'" title="'+(s.required?s.fitted+' of '+s.required+' units completed':'No parts required')+'"><span style="width:'+Math.max(0,Math.min(100,s.required?Math.round(s.fitted/s.required*100):0))+'%"></span></div><small class="rw-completion">'+(s.required?s.fitted+' of '+s.required+' units completed':'No parts required')+'</small></td><td class="rw-next-cell"><button type="button" class="secondary" data-rw-expand="'+esc(id)+'" aria-expanded="'+open+'" aria-controls="rw-detail-'+i+'">'+(open?'Hide details':'Work on device')+'</button><small class="rw-next-description">'+esc(s.next)+'</small></td></tr><tr id="rw-detail-'+i+'" '+(open?'':'hidden')+'><td colspan="4">'+detail(r)+'</td></tr>';
  }).join('')+'</tbody></table></div><div class="rw-pagebar"><span>'+list.length+' jobs · Page '+(page+1)+' of '+pages+'</span><div><button type="button" class="secondary" data-rw-page="-1" '+(page===0?'disabled':'')+'>Previous</button><button type="button" class="secondary" data-rw-page="1" '+(page>=pages-1?'disabled':'')+'>Next</button></div></div>':'<div class="empty"><strong>'+(loaded?'No matching refurbishment jobs':'Loading refurbishment records…')+'</strong>'+(loaded?'Try another filter or open a device to create its refurbishment job.':'Use Refresh if the connection is unavailable.')+'</div>';
  $('rwQueueTable').querySelectorAll('[data-rw-expand]').forEach(b=>b.onclick=()=>{const id=b.dataset.rwExpand;if(expanded.has(id))expanded.delete(id);else expanded.add(id);drawQueue();});
  $('rwQueueTable').querySelectorAll('[data-rw-select]').forEach(c=>c.onchange=()=>{if(c.checked)selected.add(c.dataset.rwSelect);else selected.delete(c.dataset.rwSelect);c.closest('tr').classList.toggle('inventory-row-selected',c.checked);selectionState();syncSelectAll();});
  const all=$('rwSelectVisible');if(all)all.onchange=()=>{for(const r of visible){if(all.checked)selected.add(r.job.assetId);else selected.delete(r.job.assetId);}drawQueue();};
  $('rwQueueTable').querySelectorAll('[data-rw-page]').forEach(b=>b.onclick=()=>{page+=Number(b.dataset.rwPage);drawQueue();});
  $('rwFilters').querySelectorAll('[data-rw-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.rwFilter;page=0;drawQueue();});
  $('rwQueueTable').querySelectorAll('[data-rw-action]').forEach(b=>b.onclick=()=>runAction(b.dataset.rwAction,b.dataset.rwId,b.dataset.rwPart));
  selectionState();syncSelectAll();
 }
 function syncSelectAll(){const all=$('rwSelectVisible');if(!all)return;const checks=[...$('rwQueueTable').querySelectorAll('[data-rw-select]')],count=checks.filter(c=>c.checked).length;all.checked=!!checks.length&&count===checks.length;all.indeterminate=count>0&&count<checks.length;}
 function runAction(kind,id,part){
  const ops=window.ApexOps;if(kind==='device'){queueScroll=document.querySelector('.main').scrollTop;returnToQueue=true;openAsset(id);updateReturn();return;}
  if(kind==='order')ops.orderParts(id);if(kind==='receiveAll')ops.receiveParts(id);if(kind==='receive')ops.receivePart(id+'|'+part);if(kind==='fit')ops.fitPart(id+'|'+part);
  if(kind==='job')ops.openJob(id);if(kind==='qc')ops.quality(id);if(kind==='print')ops.printWorksheet(id);
 }
 function updateReturn(){
  let back=$('rwReturnToQueue');if(!back){back=document.createElement('button');back.type='button';back.id='rwReturnToQueue';back.className='secondary';back.textContent='← Return to Refurbishment';$('deviceReturnInventory').after(back);back.onclick=()=>{if(setPage('refurbWorkspace'))returnToQueue=false;};}
  back.hidden=!(returnToQueue&&currentPage==='asset');
 }
 function draw(){
  if(!active())return;
  $('rwHeading').textContent=views[view][0];$('rwSubtitle').textContent=views[view][1];
  $('rwQueue').hidden=view!=='queue';$('rwPurchasingTabs').hidden=view!=='purchasing';
  document.querySelectorAll('[data-rw-view]').forEach(b=>{b.classList.toggle('selected',b.dataset.rwView===view);b.setAttribute('aria-current',b.dataset.rwView===view?'page':'false');});
  document.querySelectorAll('[data-rw-purchase]').forEach(b=>b.classList.toggle('selected',b.dataset.rwPurchase===purchase));
  $('breadSub').textContent=views[view][0];
  if(view==='queue'){restorePanels();drawQueue();}else mount((view==='purchasing'?purchase:view)+'Content');
 }
 function openView(next){if(!views[next])return;const previous=view;view=next;if(!setPage('refurbWorkspace'))view=previous;}
 const parentPage=setPage;
 const routeViews={refurbJobs:['queue'],parts:['purchasing','parts'],partsOrdered:['purchasing','partsOrdered'],orders:['purchasing','orders'],deliveries:['purchasing','deliveries'],qc:['qc'],completed:['completed']};
 setPage=function(target,force){
  if(routeViews[target]){const route=routeViews[target];view=route[0];if(route[1])purchase=route[1];target='refurbWorkspace';}
  const restoreScroll=returnToQueue&&currentPage==='asset'&&target==='refurbWorkspace';
  const ok=parentPage(target,force);if(!ok)return false;
  if(target==='refurbWorkspace'){draw();window.ApexOps.load(true);}else restorePanels();
  updateReturn();if(restoreScroll)requestAnimationFrame(()=>{document.querySelector('.main').scrollTop=queueScroll;});return ok;
 };
 const parentRender=render;render=function(...args){const result=parentRender(...args);draw();return result;};
 window.addEventListener('apex:workflow-updated',draw);
 document.querySelectorAll('[data-rw-view]').forEach(b=>b.onclick=()=>openView(b.dataset.rwView));
 document.querySelectorAll('[data-rw-purchase]').forEach(b=>b.onclick=()=>{purchase=b.dataset.rwPurchase;draw();});
 $('rwRefresh').onclick=async()=>{const b=$('rwRefresh');b.disabled=true;try{await refresh();await window.ApexOps.load();}finally{b.disabled=false;}};
 $('rwSearch').oninput=()=>{query=$('rwSearch').value;page=0;drawQueue();};
 $('rwOrderSelected').onclick=()=>window.ApexOps.orderParts([...selected]);
 $('rwReceiveSelected').onclick=()=>window.ApexOps.receiveParts([...selected]);
 $('rwPrintSelected').onclick=()=>window.ApexOps.printBatchWorksheets([...selected]);
 $('rwClearSelection').onclick=()=>{selected.clear();drawQueue();};
 // Original navigation handlers are attached during app initialization.
 $('refurbNav').onclick=()=>setPage('refurbWorkspace');
 window.ApexRefurbWorkspace=Object.freeze({open:openView,draw});
 updateReturn();
})();
