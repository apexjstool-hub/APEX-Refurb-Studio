'use strict';
(function(){
 const $=id=>document.getElementById(id),root=$('saDrawer'),host=$('assetSummary'),engine=window.ApexSmartAssistant,session=window.ApexNotificationSession;
 if(!root||!host||!engine||!session)return;
 const pref='apex.smart-assistant.enabled.v1',widthKey='apex.smart-assistant.width.v1',esc=html;
 let enabled=true,width=380,opened=false,displayKey='',lastAsset='';
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
 function close(focus=false){opened=false;root.hidden=true;displayKey='';$('saContent').replaceChildren();$('saTitleAsset').textContent='';const b=$('saToggle');if(b){b.setAttribute('aria-expanded','false');if(focus)b.focus();}}
 function attach(a,summary){
  if(!enabled||!a){removeToggle();return;}
  const print=$('assetPrintLabel');if(!print)return;
  let b=$('saToggle');if(!b){
   const group=document.createElement('div');group.className='sa-heading-actions';print.before(group);group.append(print);
   b=document.createElement('button');b.id='saToggle';b.type='button';b.title='Smart Assistant (Ctrl+Shift+A)';b.setAttribute('aria-label','Open Smart Assistant');b.setAttribute('aria-controls','saDrawer');b.innerHTML=icon+'<span class="sa-toggle-text">Smart Assistant</span><span class="sa-badge" hidden></span>';group.append(b);b.onclick=()=>opened?close(true):open();
  }
  const count=summary?.available?summary.actions.length:0,badge=b.querySelector('.sa-badge');badge.hidden=count===0;badge.textContent=count>99?'99+':String(count);b.setAttribute('aria-label','Smart Assistant'+(count?' · '+count+' flagged actions':''));b.setAttribute('aria-expanded',String(opened));
 }
 function update(){
  const a=asset();
  if(!enabled||!a){close();removeToggle();lastAsset='';return;}
  const st=state();attach(a,{available:st?.available,actions:st?.rows||[]});
  if(!opened)return;
  const summary=engine.summarize(a,st);
  const changed=lastAsset!==a.id;lastAsset=a.id;
  const key=JSON.stringify([a.id,a.model,a.manufacturer,summary,dirty]);if(key===displayKey)return;displayKey=key;
  const content=$('saContent'),scroll=changed?0:content.scrollTop;
  $('saTitleAsset').textContent=a.id+' · '+deviceName(a);
  const link=tab=>'<button type="button" class="secondary" data-sa-tab="'+esc(tab)+'">Open '+esc(tabLabels[tab]||'Overview')+'</button>';
  const safeCount=summary.available?String(summary.actions.length):'—';
  const actionRows=summary.actions.map(r=>'<div class="sa-action"><strong class="sa-'+esc(r.level)+'">'+esc(levels[r.level]||'Review')+' · '+esc(labels[r.category]||r.category)+'</strong><p>'+esc(r.detail)+'</p>'+(r.age!==null&&r.age!==undefined?'<p class="sa-muted">'+esc(r.age)+' days recorded waiting</p>':'')+(r.automation?.length?'<p class="sa-muted">Rule: '+esc(r.automation.join(', '))+'</p>':'')+link(r.tab)+'</div>').join('');
  const p=summary.projection;
  content.innerHTML='<p class="sa-muted">Saved records only. '+(dirty?'Unsaved edits are not included. ':'')+'Recommendations do not change the asset.</p>'+
   (!summary.available?'<div class="sa-card"><strong>Workflow data not available</strong><p>Wait for the existing Action Centre to load or refresh it.</p></div>':summary.stale?'<div class="sa-card"><strong>Connection interrupted</strong><p>Last available findings only; verify before taking action.</p></div>':'')+
   '<div class="sa-card"><h3>Recommended next action</h3><p><strong>'+esc(summary.next?(labels[summary.next.category]||summary.next.category):summary.available?'No action currently flagged':'Assessment unavailable')+'</strong></p><p class="sa-muted">'+esc(summary.next?summary.next.detail:summary.available?'This does not mean QA has passed.':'Workflow data is required for recommendations.')+'</p>'+(summary.next?link(summary.next.tab):'')+'</div>'+
   '<div class="sa-card"><h3>Action Centre findings · '+safeCount+'</h3><div class="sa-actions">'+(actionRows||'<p class="sa-muted">'+(summary.available?'No matching actions.':'Not loaded yet.')+'</p>')+'</div></div>'+
   '<div class="sa-card"><h3>Recorded diagnostics</h3><div class="sa-metrics"><div><span class="sa-muted">Passed</span><strong>'+summary.tests.passed+'</strong></div><div><span class="sa-muted">Failed</span><strong>'+summary.tests.failed+'</strong></div><div><span class="sa-muted">Other</span><strong>'+summary.tests.other+'</strong></div></div><p>Battery health: <strong>'+esc(summary.battery===null?'Not recorded':summary.battery+'%')+'</strong></p><p class="sa-muted">Recorded tests may predate repairs. Verify with a retest.</p>'+link('tests')+'</div>'+
   '<div class="sa-card"><h3>Existing grade projection</h3>'+(p?'<p>Assigned grade: <strong>'+esc(p.current)+'</strong></p><p>Potential cosmetic grade: <strong>'+esc(p.potential||'Needs assessment')+'</strong></p><p class="sa-muted">'+esc(p.explanation?.[0]||'Projection only.')+'</p><p class="sa-muted">'+esc(p.readiness||'')+'</p>':'<p class="sa-muted">Projection unavailable until current workflow is loaded.</p>')+link('refurb')+'</div>';
  content.scrollTop=scroll;
 }
 function open(){if(!enabled||!asset())return;opened=true;root.hidden=false;displayKey='';update();$('saClose').focus();}
 $('saClose').onclick=()=>close(true);
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
