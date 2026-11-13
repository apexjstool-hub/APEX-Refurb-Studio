'use strict';
/* Non-invasive Dashboard pulse: calculates from existing inventory and workflow snapshots. */
(function(){
 const root=document.getElementById('dashboardPage'),Pulse=window.ApexOperationsPulse;
 if(!root||!Pulse)return;
 const el=id=>document.getElementById(id);
 const cards=[
  {key:'waitingParts',label:'Parts outstanding',detail:'Laptops with replacement parts still to fit',route:'parts'},
  {key:'waitingRespray',label:'Respray outstanding',detail:'Laptops still needing cosmetic work',route:'refurbJobs'},
  {key:'readyQc',label:'Ready for QC',detail:'All required repair work fitted or checked',route:'qc'},
  {key:'dispatched',label:'Pallets dispatched',detail:'Microdream pallets out for respray',route:'dispatch'},
  {key:'returned',label:'Returns to inspect',detail:'Microdream pallets returned, awaiting completion',route:'dispatch'}
 ];
 const panel=document.createElement('section');
 panel.className='apex-pulse';panel.id='apexPulse';panel.setAttribute('aria-label','Refurbishment and dispatch attention');
 panel.innerHTML='<div class="apex-pulse-heading"><div><span class="eyebrow violet">OPERATIONS AT A GLANCE</span><h2>Work needing attention</h2><p>Live refurbishment stages and Microdream pallet returns. All figures use existing workflow records.</p></div><button type="button" id="apexPulseRefresh" class="secondary">Refresh overview</button></div><div class="apex-pulse-grid">'+cards.map(x=>'<button type="button" class="apex-pulse-card" data-pulse-route="'+x.route+'" data-pulse-key="'+x.key+'"><small>'+x.label+'</small><strong data-pulse-number="'+x.key+'">—</strong><span>'+x.detail+'</span></button>').join('')+'</div><p id="apexPulseNote" class="apex-pulse-note" role="status">Awaiting refurbishment workflow data…</p>';
 const metrics=root.querySelector('.metrics'),hero=root.querySelector('.hero-banner');
 if(metrics)metrics.after(panel);else hero?.after(panel);
 const routeTargets={waitingParts:'parts',waitingRespray:'refurbJobs',readyQc:'qc',dispatched:'dispatch',returned:'dispatch'};
 panel.querySelectorAll('[data-pulse-key]').forEach(b=>b.onclick=()=>setPage(routeTargets[b.dataset.pulseKey]));
 function paint(){
  const workflow=window.ApexWorkflowSnapshot;
  const pulse=Pulse.calculate(workflow,typeof items!=='undefined'?items:[]);
  for(const key of Object.keys(routeTargets)){const e=panel.querySelector('[data-pulse-number="'+key+'"]');if(e)e.textContent=pulse.available?String(pulse[key]):'—';}
  el('apexPulseNote').textContent=pulse.available?'Counts update from your current inventory and refurbishment records.':'Refurbishment records are not loaded yet. Open the Refurbishment page or refresh to load current workflow counts.';
 }
 let loading=false;
 async function refresh(){
  if(loading||!window.apexInventory?.workflow)return;
  loading=true;el('apexPulseRefresh').disabled=true;
  try{const result=await window.apexInventory.workflow();if(result?.ok&&result.workflow){window.ApexWorkflowSnapshot=result.workflow;paint();}
   else{el('apexPulseNote').textContent='Could not refresh refurbishment counts. Existing inventory views are unaffected.';}}
  catch{el('apexPulseNote').textContent='Could not refresh refurbishment counts. Existing inventory views are unaffected.';}
  finally{loading=false;el('apexPulseRefresh').disabled=false;}
 }
 el('apexPulseRefresh').onclick=refresh;
 const before=render;render=function(...args){const value=before(...args);paint();return value;};
 window.addEventListener('apex:workflow-updated',paint);
 paint();
})();
