'use strict';
(function(){
 const $=id=>document.getElementById(id),root=$('actionCentrePage'),model=window.ApexActionCentre;
 if(!root||!model)return;
 const esc=html,session=window.ApexNotificationSession,key='apex.action-centre.thresholds.v1';
 let lastItems=null,lastSnapshot=null,lastCfg=null,lastMinute=-1,latestReport=null;
 let cfg=model.defaults,snapshot=null,baseReport=null,level='all',category='all',query='',page=0,busy=false,error='',lastLoaded=0;
 const size=25;
 try{cfg=model.settings(JSON.parse(localStorage.getItem(key)||'{}'));}catch{}
 const labels=Object.fromEntries(model.groups.map(([id,label])=>[id,label]));
 const routes={order:'parts',overdue:'orders',delivery:'partsOrdered',respray:'dispatch','respray-return':'dispatch',fit:'refurbJobs',qa:'qc',signoff:'qc',hold:'refurbJobs',inactive:'refurbJobs',diagnostic:'inventory',missing:'inventory',location:'inventory'};
 const levels={urgent:'Urgent',attention:'Requires attention',ready:'Ready to progress'};
 const badge=$('actionCentreBadge'),status=$('acStatus'),body=$('acRows'),categories=$('acCategory'),search=$('acSearch'),filter=$('acLevel');
 const isActive=()=>session?.active()===true;
 function showBadge(n){badge.hidden=!n;badge.textContent=n>99?'99+':String(n);badge.setAttribute('aria-label',n+' urgent actions');}
 function update(reset=false){
  if(reset)page=0;
  if(!isActive()){baseReport=null;latestReport=null;showBadge(0);body.replaceChildren();status.textContent='Sign in to view actions.';for(const el of root.querySelectorAll('[data-ac-count]'))el.textContent='—';return;}
  const minute=Math.floor(Date.now()/60000);if(!baseReport||lastItems!==items||lastSnapshot!==snapshot||lastCfg!==cfg||lastMinute!==minute){baseReport=model.calculate(snapshot,items,cfg);lastItems=items;lastSnapshot=snapshot;lastCfg=cfg;lastMinute=minute;}
  const report=window.ApexWorkflowAutomation?.apply(baseReport,{fresh:!error&&!(syncMode==='cloud'&&cloudRefreshFailed)})||baseReport;
  latestReport=report;
  window.dispatchEvent(new Event('apex:action-centre-updated'));
  const counts=report.counts;showBadge(report.available?counts.urgent:0);
  for(const el of root.querySelectorAll('[data-ac-count]'))el.textContent=report.available?String(counts[el.dataset.acCount]):'—';
  const inventoryStale=syncMode==='cloud'&&cloudRefreshFailed;
  status.textContent=error?error:inventoryStale?'Inventory connection interrupted. Showing last available records.':!report.available?'Waiting for authenticated refurbishment data…':(lastLoaded?'Workflow read '+new Date(lastLoaded).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})+' · ':'')+'Counts represent actions, not unique assets. No records are changed here.';
  if(currentPage!=='actionCentre')return;
  const visible=report.rows.filter(r=>(level==='all'||r.level===level)&&(category==='all'||(category==='purchasing'||category==='workshop'||category==='inventory'?model.groups.some(g=>g[0]===r.category&&g[2]===category):r.category===category))&&(!query||[r.id,r.name,r.location,r.detail,r.technician,labels[r.category]].join(' ').toLowerCase().includes(query)));
  const max=Math.max(0,Math.ceil(visible.length/size)-1);page=Math.min(page,max);
  $('acResultCount').textContent=report.available?visible.length+' matching actions':'—';
  $('acPrevious').disabled=page===0;$('acNext').disabled=page>=max;$('acRange').textContent=visible.length?(page*size+1)+'–'+Math.min(visible.length,(page+1)*size)+' of '+visible.length:'0 results';
  $('acRoute').hidden=!(routes[category]); 
  body.innerHTML=visible.length?visible.slice(page*size,(page+1)*size).map(r=>'<tr><td><span class="ac-priority ac-'+esc(r.level)+'">'+esc(levels[r.level])+'</span></td><td><button type="button" class="asset-link ac-open" data-ac-asset="'+esc(r.id)+'">'+esc(r.id)+'</button><small>'+esc(r.name||'Unknown device')+'</small></td><td><strong>'+esc(labels[r.category])+'</strong><small>'+esc(r.detail)+'</small>'+(r.automation?.length?'<small class="wa-label">Automation: '+esc(r.automation.join(', '))+'</small>':'')+'</td><td>'+esc(r.location||'Unassigned')+'<small>'+esc(r.technician||'')+'</small></td><td>'+esc(r.age===null?'—':r.age+'d')+'</td><td><button type="button" class="secondary ac-open" data-ac-asset="'+esc(r.id)+'">Review asset</button></td></tr>').join(''):'<tr><td colspan="6" class="ac-empty">'+(report.available?'No actions match this view.':'Workflow data is not available yet. Use Refresh actions to retry.')+'</td></tr>';
 }
 function handleSnapshot(){if(!isActive())return;snapshot=window.ApexWorkflowSnapshot||null;lastLoaded=Date.now();error='';update();}
 async function readWorkflow(){
  if(busy||!isActive()||!window.apexInventory?.workflow)return;
  const ticket=session.ticket(),before=snapshot;busy=true;$('acRefresh').disabled=true;
  try{const result=await window.apexInventory.workflow();if(!session.current(ticket))return;if(!result?.ok||!result.workflow)throw Error('Unavailable');if(snapshot===before){snapshot=result.workflow;lastLoaded=Date.now();}error='';}
  catch{if(session.current(ticket))error='Could not refresh refurbishment records. Showing last available results.';}
  finally{busy=false;$('acRefresh').disabled=false;if(session.current(ticket))update();else if(isActive())void readWorkflow();}
 }
 root.addEventListener('click',e=>{const b=e.target.closest('[data-ac-asset]');if(!b||!isActive())return;const id=b.dataset.acAsset;if(items.some(a=>a.id===id&&!a.deletedAt))openAsset(id);else{update();notify('This asset is no longer in active inventory.');}});
 categories.innerHTML='<option value="all">All categories</option><option value="purchasing">Purchasing</option><option value="workshop">Workshop</option><option value="inventory">Inventory</option>'+model.groups.map(([id,label])=>'<option value="'+esc(id)+'">'+esc(label)+'</option>').join('');
 categories.onchange=()=>{category=categories.value;update(true);};filter.onchange=()=>{level=filter.value;update(true);};search.oninput=()=>{query=search.value.trim().toLowerCase();update(true);};
 for(const b of root.querySelectorAll('[data-ac-filter]'))b.onclick=()=>{level=b.dataset.acFilter;filter.value=level;update(true);};
 $('acPrevious').onclick=()=>{page=Math.max(0,page-1);update();};$('acNext').onclick=()=>{page++;update();};
 $('acRoute').onclick=()=>{if(isActive()&&routes[category])setPage(routes[category]);};
 $('acRefresh').onclick=async()=>{if(busy||!isActive())return;await refresh();await readWorkflow();};
 const prefs=$('acSettings');
 if(prefs){
  for(const k of Object.keys(model.defaults))$('acThreshold-'+k).value=cfg[k];
  $('acSaveThresholds').onclick=()=>{if(!isActive())return;const next={};for(const k of Object.keys(model.defaults)){const el=$('acThreshold-'+k);if(!el.checkValidity()){el.reportValidity();return;}next[k]=Number(el.value);}try{localStorage.setItem(key,JSON.stringify(model.settings(next)));cfg=model.settings(next);$('acSettingsStatus').textContent='Saved on this computer.';update(true);}catch{$('acSettingsStatus').textContent='Unable to save preferences.';}};
 }
 window.ApexActionCentreView=Object.freeze({getAssetState(id){if(!isActive()||!latestReport?.available)return {available:false,rows:[],workflow:null,stale:false};return {available:true,rows:latestReport.rows.filter(r=>String(r.id)===String(id)),workflow:snapshot,stale:!!error||syncMode==='cloud'&&cloudRefreshFailed||syncMode==='shared'&&$('connectionDetail')?.textContent==='Hub unavailable'};}});
 window.addEventListener('apex:workflow-updated',handleSnapshot);
 window.addEventListener('apex:automation-updated',()=>update());
 window.addEventListener('apex:notification-session',()=>{if(!isActive()){snapshot=null;baseReport=null;lastLoaded=0;error='';level=category='all';query='';page=0;search.value='';filter.value=categories.value='all';update();}else void readWorkflow();});
 const baseRender=render;render=function(...args){const result=baseRender(...args);update();return result;};
 if(isActive())void readWorkflow();else update();
})();
