'use strict';
/* Dispatch Centre: existing Microdream records only. No new write path. */
(function(){
 const $=id=>document.getElementById(id),root=$('dispatchPage'),D=window.ApexDispatchStatus;
 if(!root||!D)return;
 let workflow=null,filter='Dispatched',query='',loading=false;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const format=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('en-GB'):'—';
 const active=()=>currentPage==='dispatch';
 function draw(){
  if(!active())return;
  const all=D.shipments(workflow||window.ApexWorkflowSnapshot),out=all.filter(x=>x.status==='Dispatched'),returned=all.filter(x=>x.status==='Returned'),completed=all.filter(x=>x.status==='Completed');
  $('dispatchSummary').innerHTML=[['Out for respray',out.length],['Returned — awaiting inspection',returned.length],['Completed dispatches',completed.length]].map(([label,count])=>'<div><small>'+esc(label)+'</small><strong>'+count+'</strong></div>').join('');
  root.querySelectorAll('[data-dispatch-filter]').forEach(b=>{b.classList.toggle('selected',b.dataset.dispatchFilter===filter);b.setAttribute('aria-pressed',String(b.dataset.dispatchFilter===filter));});
  const q=query.toLowerCase().trim();
  const list=all.filter(s=>(filter==='All'||s.status===filter)&&(!q||[s.name,s.id,s.dispatchedBy,...s.manifest.map(x=>x.assetId)].some(x=>String(x||'').toLowerCase().includes(q))));
  $('dispatchRecords').innerHTML=list.length?list.map(s=>{
   const live=['Dispatched','Returned'].includes(s.status);
   const pallet=managedPallets.find(p=>String(p.name||'').trim().toLowerCase()===s.name.toLowerCase()&&String(p.storageLocation||'').toLowerCase()==='microdream');
   const open=live&&pallet;
   const rows=s.manifest.map(x=>'<tr><td><button type="button" class="asset-link" data-dispatch-asset="'+esc(x.assetId)+'">'+esc(x.assetId)+'</button></td><td>'+esc(x.parts.map(p=>p.name+' × '+p.qty).join(', '))+'</td><td>'+esc(D.status((workflow||window.ApexWorkflowSnapshot)?.jobs?.[x.assetId],workflow||window.ApexWorkflowSnapshot)?.overall||'Job unavailable')+'</td></tr>').join('');
   const lifecycle=window.ApexOperationsPulse?.steps(s.status)||[];
   const timeline='<div class="apex-dispatch-timeline" aria-label="Pallet dispatch progress">'+lifecycle.map((step,i)=>'<div class="apex-dispatch-step '+(step.done?'is-done':'')+' '+(step.active?'is-current':'')+'"><span class="apex-dispatch-step-count">'+(step.done?'✓':i+1)+'</span><span>'+esc(step.label)+'</span></div>').join('')+'</div>';
   return '<article class="apex-dispatch-card"><div class="apex-dispatch-card-head"><div><h3>'+esc(s.name)+'</h3><span>'+s.count+' laptops · Dispatched '+esc(format(s.dispatchedAt))+'</span></div><span class="apex-dispatch-state" data-state="'+esc(s.status)+'">'+esc(s.status)+'</span></div><div class="apex-dispatch-details"><span>Dispatched by <b>'+esc(s.dispatchedBy||'Not recorded')+'</b></span><span>Returned <b>'+esc(format(s.returnedAt))+'</b></span><span>Completed <b>'+esc(format(s.completedAt))+'</b></span></div>'+timeline+'<div class="apex-dispatch-actions"><button type="button" class="secondary" data-dispatch-manifest="'+esc(s.id)+'" aria-expanded="false">View manifest</button>'+(open?'<button type="button" class="secondary" data-dispatch-manage="'+esc(s.name)+'">'+(s.status==='Dispatched'?'Confirm pallet return':'Inspect / complete resprays')+'</button>':'')+'</div><div class="apex-dispatch-manifest" data-dispatch-detail="'+esc(s.id)+'" hidden><div class="apex-dispatch-scroll"><table class="asset-table"><thead><tr><th>Asset ID</th><th>Dispatched respray work</th><th>Overall progress</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></article>';
  }).join(''):'<div class="empty"><strong>No matching dispatch records</strong>Use the existing Microdream pallet controls to register a respray dispatch.</div>';
  root.querySelectorAll('[data-dispatch-manifest]').forEach(b=>b.onclick=()=>{const detail=[...root.querySelectorAll('[data-dispatch-detail]')].find(x=>x.dataset.dispatchDetail===b.dataset.dispatchManifest);if(!detail)return;detail.hidden=!detail.hidden;b.setAttribute('aria-expanded',String(!detail.hidden));b.textContent=detail.hidden?'View manifest':'Hide manifest';});
  root.querySelectorAll('[data-dispatch-asset]').forEach(b=>b.onclick=()=>{if(!items.some(a=>a.id===b.dataset.dispatchAsset&&!a.deletedAt))return notify('Asset is not present in inventory.');openAsset(b.dataset.dispatchAsset);});
  root.querySelectorAll('[data-dispatch-manage]').forEach(b=>b.onclick=()=>window.ApexMicrodreamRespray?.open(b.dataset.dispatchManage));
 }
 async function reload(){
  if(loading||!active())return;loading=true;$('dispatchRefresh').disabled=true;
  try{const r=await api.workflow();if(!r.ok)throw Error(r.error||'Could not load dispatches');workflow=r.workflow;draw();}
  catch(e){$('dispatchRecords').textContent='Unable to read dispatch history. Please refresh. '+String(e.message||'');}
  finally{loading=false;$('dispatchRefresh').disabled=false;}
 }
 function open(){workflow=window.ApexWorkflowSnapshot||workflow;draw();reload();}
 root.querySelectorAll('[data-dispatch-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.dispatchFilter;draw();});
 $('dispatchSearch').oninput=e=>{query=e.target.value;draw();};
 $('dispatchRefresh').onclick=()=>reload();
 window.addEventListener('apex:workflow-updated',()=>{workflow=window.ApexWorkflowSnapshot||workflow;draw();});
 window.ApexDispatchCentre=Object.freeze({open,draw});
})();
