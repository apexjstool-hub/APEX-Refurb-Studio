'use strict';
/* User-confirmed GitHub update notification; scheduling is a reminder, never silent installation. */
(function(){
 const api=window.apexInventory,policy=window.ApexUpdateNoticePolicy;
 if(!api?.updateStatus||!policy)return;
 const STORAGE_KEY='apex-update-notice-v1';
 let latest=null,busy=false;
 const read=()=>{try{return policy.normalized(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'));}catch{return policy.normalized(null);}};
 const store=value=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}catch{}};
 const loggedIn=()=>document.getElementById('loginPage')?.classList.contains('hidden')===true;
 const showWhenSafe=()=>loggedIn()&&document.visibilityState!=='hidden'&&!busy;
 const dialog=document.createElement('section');
 dialog.id='apexUpdateNotice';
 dialog.className='apex-update-notice hidden';
 dialog.setAttribute('role','dialog');
 dialog.setAttribute('aria-modal','true');
 dialog.setAttribute('aria-labelledby','apexUpdateNoticeTitle');
 dialog.innerHTML=`<div class="apex-update-notice-card">
  <div class="apex-update-notice-head"><span class="apex-update-notice-icon" aria-hidden="true">↻</span><div><span class="apex-update-notice-eyebrow">APEX SOFTWARE UPDATE</span><h2 id="apexUpdateNoticeTitle">New version available</h2></div><button type="button" id="apexUpdateNoticeClose" aria-label="Remind me later">×</button></div>
  <p id="apexUpdateNoticeVersion" class="apex-update-notice-version"></p>
  <p id="apexUpdateNoticeMessage" class="apex-update-notice-description">A verified Windows update is available from GitHub. Nothing is installed without your confirmation.</p>
  <div id="apexUpdateNoticeProgress" class="apex-update-notice-progress" hidden><div class="apex-update-progress-track"><span id="apexUpdateNoticeBar"></span></div><span id="apexUpdateNoticePercent"></span></div>
  <div class="apex-update-notice-actions">
   <button type="button" class="primary" id="apexUpdateNoticeInstall">Download update</button>
   <button type="button" class="secondary" id="apexUpdateNoticeLater">Remind me tomorrow</button>
   <button type="button" class="secondary" id="apexUpdateNoticeSchedule">Schedule install reminder</button>
  </div>
  <form id="apexUpdateNoticeScheduleForm" class="apex-update-notice-schedule" hidden><label for="apexUpdateNoticeDate">Choose a date and time (this PC)</label><input type="datetime-local" id="apexUpdateNoticeDate" required><div class="apex-update-notice-schedule-actions"><button type="submit" class="primary">Save schedule</button><button type="button" id="apexUpdateNoticeScheduleCancel" class="secondary">Cancel</button></div><p>APEX will remind you at this time when it is open. Installation will require your confirmation; APEX will never restart automatically.</p></form>
  <p id="apexUpdateNoticeFeedback" role="status" aria-live="polite"></p>
 </div>`;
 document.body.appendChild(dialog);
 const by=id=>document.getElementById(id);
 const installButton=by('apexUpdateNoticeInstall'),message=by('apexUpdateNoticeMessage'),feedback=by('apexUpdateNoticeFeedback');
 function hide(){dialog.classList.add('hidden');by('apexUpdateNoticeScheduleForm').hidden=true;}
 function postpone(){
  if(latest?.availableVersion)store(policy.choice(latest.availableVersion,'later'));
  hide();
 }
 function update(state){
  if(!state||state.ok===false)return;
  latest=state;
  const ready=state.state==='ready',downloading=state.state==='downloading';
  const canAct=ready||state.state==='available';
  if(!dialog.classList.contains('hidden')){
   by('apexUpdateNoticeVersion').textContent='Version '+String(state.availableVersion||'')+' · Installed '+String(state.currentVersion||'');
   by('apexUpdateNoticeProgress').hidden=!downloading;
   by('apexUpdateNoticeBar').style.width=String(Math.min(100,Math.max(0,state.progress||0)))+'%';
   by('apexUpdateNoticePercent').textContent=String(state.progress||0)+'%';
   installButton.textContent=ready?'Restart & install':downloading?'Downloading…':'Download update';
   installButton.disabled=busy||!canAct;
   message.textContent=ready?'Update downloaded and verified. Save all work before restarting to install.':downloading?'Downloading the verified update from GitHub…':'New stable APEX update from GitHub. You can install it now or schedule a reminder.';
   if(state.state==='current'||state.state==='installing')hide();
  }
  if(canAct&&policy.eligible(state,read())&&showWhenSafe()&&dialog.classList.contains('hidden'))show();
 }
 function show(){
  if(!latest||!showWhenSafe()||!policy.eligible(latest,read()))return;
  by('apexUpdateNoticeVersion').textContent='Version '+latest.availableVersion+' · Installed '+latest.currentVersion;
  feedback.textContent='';
  dialog.classList.remove('hidden');
  update(latest);
 }
 function setBusy(active){busy=active;installButton.disabled=active;by('apexUpdateNoticeLater').disabled=active;by('apexUpdateNoticeSchedule').disabled=active;}
 installButton.onclick=async()=>{
  if(busy||!latest)return;
  if(latest.state==='ready'){
   if(!window.await apexConfirm('Save all open work before restarting APEX. Install the verified update and restart now?'))return;
   setBusy(true);
   try{const response=await api.updateInstall();if(response?.ok===false)throw Error(response.error||'Unable to install update.');feedback.textContent='Preparing to restart and install…';}
   catch(e){feedback.textContent=e.message;setBusy(false);}
   return;
  }
  if(latest.state!=='available')return;
  setBusy(true);feedback.textContent='Downloading update. APEX remains open during download.';
  try{const response=await api.updateDownload();if(response?.ok===false)throw Error(response.error||'Download failed.');}
  catch(e){feedback.textContent=e.message;}
  finally{setBusy(false);api.updateStatus().then(update).catch(()=>{});}
 };
 by('apexUpdateNoticeLater').onclick=postpone;
 by('apexUpdateNoticeClose').onclick=postpone;
 by('apexUpdateNoticeSchedule').onclick=()=>{
  if(busy)return;
  const form=by('apexUpdateNoticeScheduleForm');
  form.hidden=false;
  const dt=new Date(Date.now()+2*60*60*1000),local=new Date(dt.getTime()-dt.getTimezoneOffset()*60000);
  by('apexUpdateNoticeDate').value=local.toISOString().slice(0,16);
  by('apexUpdateNoticeDate').focus();
 };
 by('apexUpdateNoticeScheduleCancel').onclick=()=>{by('apexUpdateNoticeScheduleForm').hidden=true;};
 by('apexUpdateNoticeScheduleForm').onsubmit=e=>{
  e.preventDefault();
  try{
   const date=by('apexUpdateNoticeDate').value;
   const at=new Date(date).getTime();
   const saved=policy.choice(latest.availableVersion,'schedule',Date.now(),at);
   store(saved);hide();
   // Notification only: never automatically install or close APEX when the time arrives.
   const text='APEX update reminder scheduled for '+new Date(at).toLocaleString('en-GB')+'. Keep APEX open or reopen it after that time.';
   if(typeof notify==='function')notify(text);else feedback.textContent=text;
  }catch(error){feedback.textContent=error.message||'Choose a valid future time.';}
 };
 // One check on focus, then low-cost local reminder checks. GitHub network checks
 // remain controlled by the existing installed updater (startup + periodic).
 const refresh=()=>{if(latest&&policy.eligible(latest,read())&&showWhenSafe())show();};
 document.addEventListener('visibilitychange',refresh);
 window.addEventListener('focus',refresh);
 setInterval(refresh,60000);
 api.updateStatus().then(update).catch(()=>{});
 window.ApexUpdateNotifications=Object.freeze({update});
})();
