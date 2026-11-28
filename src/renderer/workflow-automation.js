'use strict';
(function(){
 const $=id=>document.getElementById(id),root=$('automationSettings'),engine=window.ApexAutomation,session=window.ApexNotificationSession;
 if(!root||!engine||!session)return;
 let config=engine.empty(),base=null,history=[],seen=new Set(),ready=false,editing='',loading=false,loadId=0,saving=false,version=0,scope='';
 const active=()=>session.active(),esc=html;
 const text=(id,value)=>{$(id).textContent=value;};
 const option=(o)=>Object.entries(o).map(([k,v])=>'<option value="'+esc(k)+'">'+esc(v)+'</option>').join('');
 $('waTrigger').innerHTML=option(engine.triggers);$('waCondition').innerHTML=option(engine.conditions);$('waAction').innerHTML=option(engine.actions);
 $('waTemplates').innerHTML='<option value="">Choose a template…</option>'+engine.templates.map((t,i)=>'<option value="'+i+'">'+esc(t.name)+'</option>').join('');
 function fields(rule){editing=rule?.id||'';$('waName').value=rule?.name||'';$('waTrigger').value=rule?.trigger||'qa';$('waCondition').value=rule?.condition||'any';$('waDays').value=rule?.days||7;$('waAction').value=rule?.action||'flag';$('waRuleEnabled').checked=rule?rule.enabled:false;text('waEditorTitle',editing?'Edit rule':'Create rule');$('waDaysWrap').hidden=$('waCondition').value!=='age';text('waTestResult','');}
 function draft(){return {id:editing||('r-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)),name:$('waName').value,trigger:$('waTrigger').value,condition:$('waCondition').value,days:Number($('waDays').value),action:$('waAction').value,enabled:$('waRuleEnabled').checked};}
 function draw(){
  $('waEnabled').checked=config.enabled;$('waEnabled').disabled=!ready||saving;
  
  text('waRuleCount',config.rules.filter(r=>r.enabled).length+' / '+config.rules.length+' enabled rules');
  $('waRules').innerHTML=config.rules.length?config.rules.map(r=>'<div class="wa-rule"><div><strong>'+esc(r.name)+'</strong><small>'+esc(engine.triggers[r.trigger])+' · '+esc(engine.actions[r.action])+'</small></div><span>'+ (r.enabled?'Enabled':'Disabled')+'</span><button type="button" class="secondary" data-wa-edit="'+esc(r.id)+'">Edit</button><button type="button" class="secondary" data-wa-toggle="'+esc(r.id)+'">'+(r.enabled?'Disable':'Enable')+'</button><button type="button" class="secondary" data-wa-delete="'+esc(r.id)+'">Delete</button></div>').join(''):'<p class="section-note">No rules yet. Choose a template or create your own.</p>';
  $('waHistory').innerHTML=history.length?history.slice(0,100).map(h=>'<div class="wa-history-row"><small>'+esc(new Date(h.at).toLocaleTimeString('en-GB'))+'</small><strong>'+esc(h.rule)+'</strong><span>'+esc(h.asset)+'</span><small>'+esc(engine.actions[h.action])+'</small></div>').join(''):'<p class="section-note">No matching rules have run during this sign-in.</p>';
  for(const b of root.querySelectorAll('button,input,select'))b.disabled=!ready||saving;
 }
 function apply(report,{fresh=true}={}){
  base=report;
  if(!active()||!ready||!config.enabled||!report?.available)return report;
  const result=engine.evaluate(config,report);
  if(fresh){
   const change=engine.transitions(seen,result.matches);seen=change.next;
   if(change.newHits.length){
    const at=Date.now();history=[...change.newHits.slice(0,100).map(h=>({...h,at})),...history].slice(0,100);
    const n=change.newHits.filter(h=>h.action==='notice').length;if(n)notify('Workflow Automation: '+n+' new matching reminder'+(n===1?'':'s')+'. Open Action Centre.');
    if(currentPage==='settings')draw();
   }
  }
  return result.report;
 }
 function changed(){version++;window.dispatchEvent(new Event('apex:automation-updated'));}
 async function load(){
  if(!active()||loading||saving||!api.automationRead)return;
  const ticket=session.ticket(),id=++loadId;loading=true;
  try{const r=await api.automationRead();if(!session.current(ticket)||id!==loadId)return;if(!r?.ok)throw Error(r?.error||'Could not read automation rules');const next=engine.validate(r.config);const scopeChanged=scope!==String(r.scope||'');if(scopeChanged){scope=String(r.scope||'');seen.clear();history=[];fields();}const different=scopeChanged||JSON.stringify(next)!==JSON.stringify(config);config=next;ready=true;if(different)changed();text('waStatus','Rules apply only on this computer while APEX is signed in.');}
  catch(e){if(session.current(ticket)&&id===loadId){config=engine.empty();ready=false;seen.clear();changed();text('waStatus',e.message||'Rules unavailable. Automation disabled.');}}
  finally{if(id===loadId){loading=false;draw();}}
 }
 async function save(next){
  if(!active()||saving||loading||!ready)return false;
  const ticket=session.ticket();saving=true;draw();
  try{if(!await window.apexEnsureSettingsUnlocked())return false;if(!session.current(ticket)||currentPage!=='settings')return false;
   const r=await api.automationSave({scope,config:engine.validate(next)});if(!session.current(ticket))return false;if(!r?.ok)throw Error(r?.error||'Save failed');config=engine.validate(r.config);if(!config.enabled)seen.clear();text('waStatus','Saved on this computer.');changed();return true;}
  catch(e){if(session.current(ticket))text('waStatus',e.message||'Save failed.');return false;}
  finally{if(session.current(ticket)){saving=false;draw();}}
 }
 $('waEnabled').onchange=()=>{const value=$('waEnabled').checked;void save({...config,enabled:value}).then(draw);};
 $('waCondition').onchange=()=>{$('waDaysWrap').hidden=$('waCondition').value!=='age';};
 $('waTemplates').onchange=()=>{const v=$('waTemplates').value;if(v!=='')fields({...engine.templates[Number(v)],enabled:false});$('waTemplates').value='';};
 $('waNew').onclick=()=>fields();
 $('waTest').onclick=()=>{try{const r=engine.validate({enabled:true,rules:[draft()]}).rules[0];if(!base?.available){text('waTestResult','Current workflow data is unavailable. Refresh Action Centre first.');return;}const hits=engine.matches(r,base.rows);text('waTestResult',hits.length+' matching actions'+(hits.length?' · '+hits.slice(0,8).map(h=>h.id).join(', '):'')+'. Test only — no alerts or changes made.');}catch(e){text('waTestResult',e.message);}};
 $('waForm').onsubmit=async e=>{e.preventDefault();const r=draft();const rules=config.rules.filter(x=>x.id!==r.id).concat(r);if(await save({...config,rules}))fields();};
 $('waRules').onclick=async e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.waEdit||b.dataset.waToggle||b.dataset.waDelete,r=config.rules.find(x=>x.id===id);if(!r)return;
  if(b.dataset.waEdit)fields(r);
  else if(b.dataset.waToggle)await save({...config,rules:config.rules.map(x=>x.id===id?{...x,enabled:!x.enabled}:x)});
  else if(await apexConfirm('Delete automation rule '+r.name+'?',{title:'Delete rule',tone:'warning',confirmLabel:'Delete rule'})){if(await save({...config,rules:config.rules.filter(x=>x.id!==id)})&&editing===id)fields();}
 };
 window.addEventListener('apex:notification-session',()=>{if(!active()){loadId++;loading=false;saving=false;config=engine.empty();base=null;history=[];seen.clear();scope='';ready=false;fields();text('waStatus','Sign in to load automation rules.');changed();draw();}else void load();});
 // Read the connection-scoped local rules periodically, not a second database poll.
 setInterval(()=>{if(active()&&!saving)void load();},30000);
 window.ApexWorkflowAutomation=Object.freeze({apply,version:()=>version});
 fields();draw();if(active())void load();
})();
