'use strict';
(function(){
 const $=id=>document.getElementById(id),root=$('saDrawer'),host=$('assetSummary'),engine=window.ApexSmartAssistant,session=window.ApexNotificationSession;
 if(!root||!host||!engine||!session)return;
 const pref='apex.smart-assistant.enabled.v1',widthKey='apex.smart-assistant.width.v1',esc=html;
 let enabled=true,width=380,opened=false,displayKey='',lastAsset='',view='work';
 try{enabled=localStorage.getItem(pref)!=='off';const w=Number(localStorage.getItem(widthKey));if(w>=320&&w<=560)width=w;}catch{}
 const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3zM20 2v4M18 4h4"/></svg>';
 const labels=Object.fromEntries((window.ApexActionCentre?.groups||[]).map(([key,label])=>[key,label]));
 const levels={urgent:'Urgent',attention:'Attention',ready:'Ready to progress'};
 const tabLabels={overview:'Device information',parts:'Parts & repair',tests:'Hardware tests',refurb:'Refurb notes'};
 const active=()=>session.active()&&currentPage==='asset'&&!!activeAssetId;
 const asset=()=>active()?items.find(a=>a.id===activeAssetId&&!a.deletedAt):null;
 const state=()=>window.ApexActionCentreView?.getAssetState(activeAssetId)||null;
 function setWidth(n,persist=false){width=Math.min(560,Math.max(320,Number(n)||380));root.style.setProperty('--sa-width',width+'px');$('saWidth').value=String(width);if(persist)try{localStorage.setItem(widthKey,String(width));}catch{}}
 function removeToggle(){const group=host.querySelector('.sa-heading-actions');if(group){const p=group.querySelector('#assetPrintLabel');if(p)group.before(p);group.remove();}else $('saToggle')?.remove();}
 function selectView(next){if(!['work','tests','notes'].includes(next))return;view=next;for(const b of root.querySelectorAll('[data-sa-view]'))b.setAttribute('aria-pressed',String(b.dataset.saView===view));for(const el of $('saContent').querySelectorAll('[data-sa-section]'))el.hidden=el.dataset.saSection!==view;$('saContent').scrollTop=0;}
 function close(focus=false){opened=false;root.hidden=true;displayKey='';$('saContent').replaceChildren();$('saTitleAsset').textContent='';const b=$('saToggle');if(b){b.setAttribute('aria-expanded','false');if(focus)b.focus();}}
 function attach(a,summary){
  if(!enabled||!a){removeToggle();return;}
  const print=$('assetPrintLabel');if(!print)return;
  let b=$('saToggle');if(!b){
   const group=document.createElement('div');group.className='sa-heading-actions';print.before(group);group.append(print);
   b=document.createElement('button');b.id='saToggle';b.type='button';b.title='Smart Info — full asset assessment (Ctrl+Shift+A)';b.setAttribute('aria-label','Open Smart Info');b.setAttribute('aria-controls','saDrawer');b.innerHTML=icon+'<span class="sa-toggle-text">Smart Info</span><span class="sa-badge" hidden></span>';group.append(b);b.onclick=()=>opened?close(true):open();
  }
  const count=summary?.available?summary.actions.length:0,badge=b.querySelector('.sa-badge');badge.hidden=count===0;badge.textContent=count>99?'99+':String(count);b.setAttribute('aria-label','Smart Info'+(count?' · '+count+' flagged actions':''));b.setAttribute('aria-expanded',String(opened));
 }
 function update(){
  const a=asset();
  if(!enabled||!a){close();removeToggle();lastAsset='';return;}
  const st=state();attach(a,{available:st?.available,actions:st?.rows||[]});
  if(!opened)return;
  const summary=engine.summarize(a,st);
  const changed=lastAsset!==a.id;lastAsset=a.id;if(changed)view='work';
  const key=JSON.stringify([a.id,a.model,a.manufacturer,summary,dirty,a.diagnosticTests,a.refurbNotes,a.engineerNotes,a.refurbishment]);if(key===displayKey)return;displayKey=key;
  const content=$('saContent'),scroll=changed?0:content.scrollTop;
  $('saTitleAsset').textContent=a.id+' · '+deviceName(a);
  const link=tab=>'<button type="button" class="secondary" data-sa-tab="'+esc(tab)+'">Open '+esc(tabLabels[tab]||'Overview')+'</button>';
  const safeCount=summary.available?String(summary.actions.length):'—';
  const actionRows=summary.actions.map(r=>'<div class="sa-action"><strong class="sa-'+esc(r.level)+'">'+esc(levels[r.level]||'Review')+' · '+esc(labels[r.category]||r.category)+'</strong><p>'+esc(r.detail)+'</p>'+(r.age!==null&&r.age!==undefined?'<p class="sa-muted">'+esc(r.age)+' days recorded waiting</p>':'')+(r.automation?.length?'<p class="sa-muted">Rule: '+esc(r.automation.join(', '))+'</p>':'')+'</div>').join('');
  const p=summary.projection,w=summary.work;
  const val=v=>esc(v===null||v===undefined?'—':v);
  const partRow=(r,kind)=>{
   const complete=r.fitted>=r.required&&kind!=='other'&&w.known;
   const tone=complete?'ready':kind==='other'?'neutral':r.status==='Ready to fit'||r.status==='Returned — check required'?'ready':'attention';
   const orders=r.orders.map(o=>'<div class="sa-order"><strong>'+esc(o.reference||o.id||'Recorded order')+'</strong><span>'+esc(o.supplier||'Supplier not recorded')+'</span><small>ETA: '+esc(o.expectedAt||'Not set')+' · '+val(o.received)+' / '+val(o.qty)+' received</small></div>').join('');
   const quantities=kind==='other'?'': '<div class="sa-quantities">'+[['Required',r.required],[kind==='cosmetic'?'Booked':'Ordered',r.ordered],[kind==='cosmetic'?'Returned':'Received',r.received],[kind==='cosmetic'?'Checked':'Fitted',r.fitted]].map(([label,value])=>'<div><small>'+label+'</small><strong>'+val(value)+'</strong></div>').join('')+'</div>';
   return '<article class="sa-part"><div class="sa-part-head"><strong>'+esc(r.name)+'</strong><span class="sa-pill sa-'+tone+'">'+esc(r.status)+'</span></div>'+quantities+(kind==='replacement'&&w.known&&r.toOrder>0?'<p class="sa-muted">'+val(r.toOrder)+' still to order</p>':'')+(r.notes?'<p class="sa-note">'+esc(r.notes)+'</p>':'')+orders+'</article>';
  };
  const group=(title,rows,kind)=>'<div class="sa-card" data-sa-section="work"><div class="sa-section-title"><h3>'+title+'</h3><span>'+rows.length+'</span></div>'+(!rows.length?'<p class="sa-muted">'+(w.known?'None recorded.':'No saved requirements found.')+'</p>':rows.map(r=>partRow(r,kind)).join(''))+'</div>';
  const ship=w.shipment;
  const shipment=ship?'<div class="sa-shipment"><strong>Microdream · '+esc(ship.status)+'</strong><p>Pallet: '+esc(ship.pallet||'Not recorded')+' · Ref: '+esc(ship.reference||'Not recorded')+'</p><p>Dispatched: '+esc(ship.dispatchedAt?String(ship.dispatchedAt).slice(0,10):'Not recorded')+(ship.returnedAt?' · Returned: '+esc(String(ship.returnedAt).slice(0,10)):'')+'</p></div>':'';
  const records=Object.entries(a.diagnosticTests||{}).map(([id,r])=>({name:(typeof APEX_TEST_LABELS!=='undefined'?APEX_TEST_LABELS[id]:null)||id,status:String(r?.status||r).toLowerCase(),note:typeof r==='object'&&r?String(r.comment||r.note||r.notes||''):''}));
  const diagnosticRows=records.sort((a,b)=>Number(b.status==='fail')-Number(a.status==='fail')).map(r=>'<div class="sa-record"><div><strong>'+esc(r.name)+'</strong>'+(r.note?'<p>'+esc(r.note)+'</p>':'')+'</div><span class="sa-'+(r.status==='fail'?'urgent':r.status==='pass'?'ready':'muted')+'">'+esc(r.status==='pass'?'Passed':r.status==='fail'?'Failed':r.status||'Not recorded')+'</span></div>').join('')||'<p class="sa-muted">No diagnostic results recorded.</p>';
  const ref=a.refurbishment||{},report=Array.isArray(ref.reports)?ref.reports.find(r=>r.key===ref.latestKey)||ref.reports.at(-1)||ref:ref;
  const noteRows=[['Refurbishment notes',a.refurbNotes],['Engineer notes',a.engineerNotes],['Job notes',w.notes],['Inspection notes',report.notes],['Cosmetic findings',report.cosmeticIssues],['Functional observations',report.functionalityResults]].filter(([,v])=>String(v??'').trim()).map(([label,v])=>'<div class="sa-card" data-sa-section="notes"><h3>'+label+'</h3><p class="sa-note">'+esc(v)+'</p></div>').join('');
  const pct=w.known&&w.required?Math.round(100*w.finished/w.required):null;
  content.innerHTML='<p class="sa-muted sa-source">Saved records only. '+(dirty?'Unsaved edits are not included. ':'')+esc(w.source)+'.</p>'+
   (!summary.available?'<div class="sa-card"><strong>Workflow data not available</strong><p>Imported requirements may be shown; progress is not verified.</p></div>':summary.stale?'<div class="sa-card"><strong>Connection interrupted</strong><p>Last available findings only; verify before taking action.</p></div>':'')+
   '<div class="sa-card sa-overview-card" data-sa-section="work"><div class="sa-section-title"><h3>Repair overview</h3><span>'+safeCount+' alerts</span></div><div class="sa-dual"><div><small>Replacement parts</small><strong>'+esc(w.partsStatus||'Not verified')+'</strong></div><div><small>Respray</small><strong>'+esc(w.resprayStatus||'Not verified')+'</strong></div></div>'+
   (w.known?'<p class="sa-muted">Job: '+esc(w.jobStatus||'Not recorded')+' · Engineer: '+esc(w.technician)+'</p><p><strong>'+w.finished+' / '+w.required+'</strong> repair units fitted / checked</p>'+(pct!==null?'<progress max="100" value="'+pct+'" aria-label="Recorded repair completion"></progress>':''):'')+
   '<p class="sa-next"><strong>'+esc(summary.next?(labels[summary.next.category]||summary.next.category):summary.available?'No action currently flagged':'Assessment unavailable')+'</strong><span>'+esc(summary.next?summary.next.detail:summary.available?'Final QA must still be confirmed.':'Workflow data is needed for recommendations.')+'</span></p></div>'+
   group('Replacement parts',w.groups.replacement,'replacement')+
   '<div class="sa-card" data-sa-section="work"><div class="sa-section-title"><h3>Respray &amp; cosmetic work</h3><span>'+w.groups.cosmetic.length+'</span></div>'+shipment+(w.groups.cosmetic.length?w.groups.cosmetic.map(r=>partRow(r,'cosmetic')).join(''):'<p class="sa-muted">'+(w.known?'No respray requirements recorded.':'No saved requirements found.')+'</p>')+'</div>'+
   (w.groups.other.length?group('Other requirements · reference only',w.groups.other,'other'):'')+
   '<div class="sa-card" data-sa-section="tests"><div class="sa-section-title"><h3>Recorded diagnostics</h3><span>'+summary.tests.failed+' failed</span></div><div class="sa-metrics"><div><span class="sa-muted">Passed</span><strong>'+summary.tests.passed+'</strong></div><div><span class="sa-muted">Failed</span><strong>'+summary.tests.failed+'</strong></div><div><span class="sa-muted">Other</span><strong>'+summary.tests.other+'</strong></div></div><p>Battery health: <strong>'+esc(summary.battery===null?'Not recorded':summary.battery+'%')+'</strong></p>'+diagnosticRows+'<p class="sa-muted">Recorded tests may predate repairs. Verify with a retest.</p></div>'+
   '<div class="sa-card" data-sa-section="notes"><h3>Final quality checks</h3>'+(w.qc.length?w.qc.map(c=>'<div class="sa-check"><span class="'+(c.done?'sa-ready':'sa-muted')+'">'+(c.done?'✓':'○')+'</span>'+esc(c.name)+'</div>').join(''):'<p class="sa-muted">No job checklist available.</p>')+'</div>'+
   '<div class="sa-card" data-sa-section="notes"><h3>Grade projection</h3>'+(p?'<p>Assigned grade: <strong>'+esc(p.current)+'</strong></p><p>Potential cosmetic grade: <strong>'+esc(p.potential||'Needs assessment')+'</strong></p><p class="sa-muted">'+esc(p.explanation?.[0]||'Projection only.')+'</p><p class="sa-muted">'+esc(p.readiness||'')+'</p>':'<p class="sa-muted">Projection unavailable until current workflow is loaded.</p>')+'</div>'+
   (noteRows||'<div class="sa-card" data-sa-section="notes"><h3>Recorded notes</h3><p class="sa-muted">No notes recorded.</p></div>')+
   (actionRows?'<details class="sa-card" data-sa-section="work"><summary>All Action Centre findings · '+safeCount+'</summary><div class="sa-actions">'+actionRows+'</div></details>':'')+
   '<div class="sa-optional-links"><span class="sa-muted">Edit or update records using the original asset tools.</span>'+link('parts')+link('tests')+'</div>';
  selectView(view);content.scrollTop=scroll;
 }
 function open(){if(!enabled||!asset())return;opened=true;root.hidden=false;displayKey='';update();$('saClose').focus();}
 $('saClose').onclick=()=>close(true);
 for(const b of root.querySelectorAll('[data-sa-view]'))b.onclick=()=>selectView(b.dataset.saView);
 $('saContent').addEventListener('click',e=>{const b=e.target.closest('[data-sa-tab]');if(!b||!active())return;const tab=b.dataset.saTab;if(!Object.hasOwn(tabLabels,tab))return;const target=document.querySelector('[data-asset-tab="'+tab+'"]');if(target){close();target.click();target.focus();}});
 $('saWidth').oninput=()=>setWidth($('saWidth').value);$('saWidth').onchange=()=>setWidth($('saWidth').value,true);
 const settings=$('saEnabled');settings.checked=enabled;
 $('saSave').onclick=async()=>{if(!session.active()||currentPage!=='settings')return;const ticket=session.ticket();try{if(!await window.apexEnsureSettingsUnlocked()||!session.current(ticket)||currentPage!=='settings')return;const value=settings.checked;localStorage.setItem(pref,value?'on':'off');enabled=value;$('saSettingsStatus').textContent='Saved on this computer.';update();}catch{$('saSettingsStatus').textContent='Could not save the preference.';}};
 $('saPreviousRelease').onclick=async()=>{if(!session.active()||currentPage!=='settings')return;const ticket=session.ticket();try{if(!await window.apexEnsureSettingsUnlocked()||!session.current(ticket)||currentPage!=='settings')return;const r=await api.openAssistantRollback();$('saRollbackStatus').textContent=r?.ok?'Previous stable release opened in your browser.':r?.error||'Could not open release.';}catch{$('saRollbackStatus').textContent='Could not open release.';}};
 const baseOverview=updateAssetOverview;updateAssetOverview=function(...args){const result=baseOverview(...args);update();return result;};
 window.addEventListener('apex:action-centre-updated',update);
 window.addEventListener('apex:notification-session',()=>{if(!session.active()){close();removeToggle();lastAsset='';}else update();});
 // Navigation, including restored workspace tabs, must never leave another asset's data visible.
 new MutationObserver(update).observe(document.documentElement,{attributes:true,attributeFilter:['data-apex-page']});
 document.addEventListener('keydown',e=>{if(e.defaultPrevented||!active()||!enabled||!$('modalLayer')?.classList.contains('hidden'))return;if(e.key==='Escape'&&opened){e.preventDefault();close(true);}else if(e.ctrlKey&&e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='a'){e.preventDefault();opened?close(true):open();}});
 setWidth(width);update();
})();
