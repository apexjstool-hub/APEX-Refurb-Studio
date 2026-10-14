'use strict';
(function(){
 const baseSetPage=setPage;let accessReady=false,pending=false;
 let unlocking=null;
 function promptSettings(){
  return new Promise(resolve=>{
   showModal('Unlock Settings','ADMINISTRATOR ACCESS',`<form id="apexUnlockSettings" class="modal-body"><p>Enter the password for your signed-in administrator account.</p><label class="field">Administrator password<input id="apexSettingsPassword" type="password" autocomplete="current-password" maxlength="128" required></label><div id="apexSettingsError" class="form-error" role="alert"></div><div class="modal-actions"><button id="apexSettingsCancel" class="secondary" type="button">Cancel</button><button class="primary" type="submit">Unlock Settings</button></div></form>`);
   let finished=false;
   const finish=ok=>{if(finished)return;finished=true;$('modalClose').removeEventListener('click',cancel);$('modalLayer').removeEventListener('click',outside);document.removeEventListener('keydown',escape);resolve(ok);};
   const cancel=()=>{closeModal();finish(false);};
   const outside=e=>{if(e.target===$('modalLayer'))cancel();};
   const escape=e=>{if(e.key==='Escape')cancel();};
   $('modalClose').addEventListener('click',cancel);$('modalLayer').addEventListener('click',outside);document.addEventListener('keydown',escape);$('apexSettingsCancel').onclick=cancel;$('apexSettingsPassword').focus();
   $('apexUnlockSettings').onsubmit=async e=>{e.preventDefault();const button=e.currentTarget.querySelector('[type="submit"]');button.disabled=true;
    try{const r=await api.settingsUnlock($('apexSettingsPassword').value);if(finished)return;$('apexSettingsPassword').value='';if(!r.ok){$('apexSettingsError').textContent=r.error;return;}closeModal();finish(true);}catch{if(!finished)$('apexSettingsError').textContent='Could not verify your password. Try again.';}finally{button.disabled=false;}
   };
  });
 }
 window.apexEnsureSettingsUnlocked=async function(){
  if(unlocking)return unlocking;
  unlocking=(async()=>{try{const r=await api.settingsAccess();if(!r.ok||!r.admin){notify(r.error||'Only administrators can access Settings.');return false;}if(r.unlocked)return true;accessReady=false;return await promptSettings();}catch{notify('Could not check Settings access.');return false;}})();
  try{return await unlocking;}finally{unlocking=null;}
 };
 setPage=function(page,force){
  if(['settings','users'].includes(page)&&!accessReady){
   if(pending)return false;pending=true;
   window.apexEnsureSettingsUnlocked().then(ok=>{if(ok){accessReady=true;setPage(page,force);}}).finally(()=>pending=false);return false;
  }
  const result=baseSetPage(page,force);if(!result)return result;
  if(!['settings','users'].includes(page)&&accessReady){accessReady=false;api.settingsLock();}
  if(page==='users')renderUsers();return result;
 };
 $('apexSharedAccountSignIn').onclick=async()=>{
  await $('sidebarUser').onclick();
  if($('appPage').classList.contains('hidden')){selectLoginMode('cloud');$('loginCloudEmail').focus();}
 };
 async function connectionStatus(){
  const r=await api.hubStatus();
  $('apexSharedAccountStatus').textContent=r.ok&&r.mode==='cloud'?'Connected to your shared cloud workspace. No hub secret is needed on this PC.':'You are using a local or LAN workspace. Sign in with a shared account to open your cloud inventory.';
  $('apexSharedAccountSignIn').textContent=r.ok&&r.mode==='cloud'?'Switch shared account':'Sign in to shared workspace';
 }
 const beforeConnectionPage=setPage;
 setPage=function(page,force){const result=beforeConnectionPage(page,force);if(result&&page==='settings')connectionStatus().catch(()=>{});return result;};
 async function renderUsers(){
  const host=$('apexUsersManager');if(!host)return;host.innerHTML='<p>Loading shared accounts…</p>';
  if(!await window.apexEnsureSettingsUnlocked())return;const result=await api.usersList();if(currentPage!=='users')return;
  if(!result.ok){host.innerHTML=`<div class="refurb-empty"><strong>Shared account management</strong><p>${html(result.error)}</p><button id="apexUsersRetry" class="secondary">Try again</button></div>`;$('apexUsersRetry').onclick=renderUsers;return;}
  host.innerHTML=`<div class="apex-users-heading"><div><h2>Shared staff accounts</h2><p>Each account works on every APEX PC connected to this cloud project.</p></div><button id="apexAddUser" class="primary">＋ Add account</button></div><div class="apex-user-roles"><p><b>Staff</b> · Inventory, locations, refurbishment and reports. No Settings or account administration.</p><p><b>Administrator</b> · Staff access plus protected Settings, account management and permanent deletion.</p></div><div class="apex-users-list">${result.users.map(u=>`<div class="apex-user-row"><div><strong>${html(u.name||u.email)}</strong><small>${html(u.email)}</small></div><span>${u.role==='admin'?'Administrator':'Staff'}</span><span>${u.active?'Active':'Disabled'}</span><button class="secondary" data-edit-user="${html(u.id)}">Manage</button></div>`).join('')||'<p>No shared staff profiles found.</p>'}</div>`;
  $('apexAddUser').onclick=()=>userModal();host.querySelectorAll('[data-edit-user]').forEach(b=>b.onclick=()=>userModal(result.users.find(u=>u.id===b.dataset.editUser)));
 }
 function userModal(user){
  const existing=!!user,admin=user?.role==='admin';
  showModal(existing?'Manage account':'Add shared account','SETTINGS / USERS',`<form id="apexUserForm" class="modal-body">${existing?`<p><strong>${html(user.email)}</strong></p>`:'<label class="field">Full name<input name="name" maxlength="100" required autocomplete="off"></label><label class="field">Email<input name="email" type="email" maxlength="254" required autocomplete="off"></label><label class="field">Initial password<input name="password" type="password" minlength="12" maxlength="128" required autocomplete="new-password"></label><p class="section-note">Share the initial password privately with this person. No email is sent.</p>'}<label class="field">Access level<select name="role" ${admin?'disabled':''}><option value="staff">Staff</option><option value="admin" ${admin?'selected':''}>Administrator</option></select></label>${existing?`<label class="field">Account status<select name="active" ${admin?'disabled':''}><option value="true" ${user.active?'selected':''}>Active</option><option value="false" ${!user.active?'selected':''}>Disabled</option></select></label>${admin?'<p class="section-note">Administrator accounts cannot be downgraded or disabled here, to protect administrator access.</p>':''}`:'<p class="section-note">The new account will have active inventory access immediately.</p>'}<div class="form-error" id="apexUserError" role="alert"></div><div class="modal-actions"><button id="apexUserCancel" class="secondary" type="button">Cancel</button><button class="primary" type="submit">${existing?'Save access':'Create account'}</button></div></form>`);
  $('apexUserCancel').onclick=closeModal;$('apexUserForm').onsubmit=async e=>{e.preventDefault();const button=e.currentTarget.querySelector('[type="submit"]');button.disabled=true;const input=Object.fromEntries(new FormData(e.currentTarget));
   try{const r=existing?await api.usersUpdate({id:user.id,role:admin?'admin':input.role,active:admin?true:input.active==='true'}):await api.usersCreate(input);if(!r.ok){$('apexUserError').textContent=r.error;return;}closeModal();notify(existing?'Account access updated':'Shared account created');await renderUsers();}catch{$('apexUserError').textContent='Account operation failed. Check your connection.';}finally{button.disabled=false;}
  };
 }
 const logout=$('sidebarUser').onclick;$('sidebarUser').onclick=async(...args)=>{await logout(...args);if($('appPage').classList.contains('hidden')){accessReady=false;await api.settingsLock();}};
})();
