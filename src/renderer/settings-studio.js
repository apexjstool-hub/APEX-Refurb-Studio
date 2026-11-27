'use strict';
/* Presentation only: keep original controls, IPC and administrator navigation gate. */
(()=>{
 const $=id=>document.getElementById(id),root=document.documentElement;
 if(root.dataset.layout!=='evolution')return;
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const settings=$('settingsPage'),rail=settings.querySelector('.evo-settings-rail'),body=settings.querySelector('.evo-settings-body');
 if(!rail||!body)return;
 const groups=[
 ['updates','Updates','Install verified APEX releases and check the installed version.'],
 ['appearance','Appearance','Choose light or dark mode for this computer.'],
 ['fonts','Fonts','Choose a readable interface font. Printing and label fonts are unchanged.'],
 ['colours','Colours','Choose an accent palette independently of light or dark mode.'],
 ['cloud','Cloud & connections','Shared account, trusted hub and cloud synchronisation.'],
 ['devices','Authorised SSDs','Manage approved portable Diagnostics devices.'],
 ['notifications','Notifications','Configure workstation reminders.'],
 ['messages','Messaging','Manage message retention and notifications.'],
 ['backups','Backups & health','Review backups and connected tool health.'],
 ['intake','Intake verification','Review confirmed Diagnostics and RefurbFlow imports.'],
 ['conflicts','Sync conflicts','Review conflicting device identities.'],
 ['maintenance','Inventory maintenance','Standardise or export inventory records.']
 ];
 const pages=new Map(),buttons=new Map();
 const menu=make('nav','studio-settings-nav');menu.setAttribute('aria-label','Settings pages');
 rail.replaceChildren(make('strong','studio-settings-index','Settings'),menu);
 const originalNodes=[...body.children];
 for(const [id,label,description] of groups){
  const page=make('section','studio-settings-page');page.dataset.settingsView=id;page.hidden=true;page.setAttribute('aria-labelledby','studio-setting-'+id);
  const intro=make('header','studio-settings-page-head');const title=make('h2','',''+label);title.id='studio-setting-'+id;intro.append(title,make('p','',description));page.append(intro);
  const b=make('button','studio-setting-link',label);b.type='button';b.dataset.settingsTarget=id;b.addEventListener('click',()=>show(id));menu.append(b);pages.set(id,page);buttons.set(id,b);
 }
 const direct=(id)=>originalNodes.find(n=>n.id===id||n.querySelector('#'+id));
 const append=(id,node)=>{if(node)pages.get(id).append(node);};
 append('updates',direct('apexUpdateCentre'));
 append('cloud',direct('apexSharedAccountPanel'));append('cloud',direct('apexAdvancedCloudSetup'));append('cloud',direct('apexCloudUrl'));
 append('devices',direct('apexPortableDevices'));append('notifications',direct('apexReminderSettings'));append('messages',direct('apexConnectMaintenance'));append('backups',direct('reliabilityPanel'));append('intake',direct('verificationPanel'));append('conflicts',direct('conflictPanel'));
 const stack=originalNodes.find(n=>n.classList.contains('settings-stack'));
 if(stack){
  for(const row of [...stack.children]){
   const id=row.querySelector('#settingsPairButton,#settingsHubButton')?'cloud':row.id==='apexAdminAppearance'?'appearance':row.querySelector('.settings-tag')?'updates':'maintenance';
   let target=pages.get(id).querySelector(':scope > .settings-stack');if(!target){target=make('div','settings-stack');append(id,target);}target.append(row);
  }
  stack.remove();
 }
 // Any newly introduced settings panels remain reachable, rather than being discarded.
 for(const node of originalNodes){if(node.parentElement===body){if(node.classList.contains('page-intro'))node.hidden=true;else append('maintenance',node);}}
 for(const page of pages.values())body.append(page);
 const users=make('button','studio-setting-link','Users & access');users.type='button';users.onclick=()=>setPage('users');menu.append(users);
 function show(id){if(!pages.has(id))return;for(const [key,page] of pages){page.hidden=key!==id;buttons.get(key).classList.toggle('is-current',key===id);if(key===id)buttons.get(key).setAttribute('aria-current','page');else buttons.get(key).removeAttribute('aria-current');}body.scrollTop=0;}
 show('appearance');
 const appearance=window.ApexAppearance;
 let saved=appearance.read(localStorage),draft={...saved};
 const statusLabels=[],saveButtons=[],choiceButtons=[];
 const changed=()=>Object.keys(saved).some(key=>saved[key]!==draft[key]);
 function refresh(message=''){
  for(const [key,value,button] of choiceButtons){const active=draft[key]===value;button.setAttribute('aria-pressed',String(active));button.classList.toggle('selected',active);}
  for(const button of saveButtons)button.disabled=!changed();
  for(const label of statusLabels)label.textContent=message||(changed()?'Unsaved changes — press Save appearance to apply.':'Saved on this computer.');
 }
 function stage(key,value){if(!appearance.allowed[key].includes(value))return;draft={...draft,[key]:value};refresh();}
 function commit(){try{saved=appearance.save(localStorage,draft);draft={...saved};appearance.apply(root,saved);applyTheme(saved.theme,false);refresh('Appearance saved on this computer.');}catch{refresh('Unable to save appearance. Your previous settings are unchanged.');}}
 function controls(id){const bar=make('div','studio-save-row');const note=make('span','studio-save-status');note.setAttribute('role','status');const cancel=make('button','secondary','Discard changes');cancel.type='button';cancel.onclick=()=>{draft={...saved};refresh();};const save=make('button','primary','Save appearance');save.type='button';save.onclick=commit;bar.append(note,cancel,save);statusLabels.push(note);saveButtons.push(save);append(id,bar);}
 function prefs(id,key,choices){
  const card=make('div','studio-preference-card');const label=make('label','studio-pref-label',id==='fonts'?'Interface font':'Colour scheme');const group=make('div','studio-pref-grid');group.setAttribute('role','group');group.setAttribute('aria-label',label.textContent);
  for(const [v,name,desc] of choices){const b=make('button','studio-pref-option');b.type='button';b.dataset.preference=v;b.append(make('strong','',name),make('small','',desc));b.onclick=()=>stage(key,v);choiceButtons.push([key,v,b]);group.append(b);}
  card.append(label,group,make('p','studio-pref-note','Choose your preference, then save to apply it to the workspace and login screen.'));append(id,card);
 }
 for(const button of pages.get('appearance').querySelectorAll('[data-set-theme]')){button.onclick=()=>stage('theme',button.dataset.setTheme);choiceButtons.push(['theme',button.dataset.setTheme,button]);}
 prefs('fonts','font',[['original','APEX default','Original Inter / Jakarta combination'],['segoe','Segoe UI','Native Windows typography'],['inter','Inter','Clean, compact and readable'],['jakarta','Plus Jakarta Sans','Modern rounded typography'],['arial','Arial','Familiar and widely supported']]);
 prefs('colours','accent',[['cobalt','Cobalt','Blue sidebar, artwork and sign-in'],['indigo','Indigo','Deep violet-blue'],['teal','Teal','Cool blue-green'],['slate','Slate','Restrained neutral accent']]);
 for(const id of ['appearance','fonts','colours'])controls(id);
 refresh();
 const loginTheme=$('previewLoginTheme');
 if(loginTheme)loginTheme.onclick=()=>{try{saved=appearance.save(localStorage,{...saved,theme:saved.theme==='dark'?'light':'dark'});draft={...saved};appearance.apply(root,saved);applyTheme(saved.theme,false);refresh();$('apexDesignLoginMessage').textContent='Theme saved on this computer.';}catch{$('apexDesignLoginMessage').textContent='Unable to save theme.';}};
 // Keep the existing theme button alive for login shortcut, but remove it from main toolbar.
 const theme=$('topTheme');theme.hidden=true;theme.setAttribute('aria-hidden','true');theme.tabIndex=-1;
 const actions=document.querySelector('.topbar .top-actions'),avatar=actions.querySelector('.top-avatar'),name=actions.querySelector('.header-username');
 const profile=make('div','studio-profile'),trigger=make('button','studio-profile-trigger');trigger.type='button';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','studioProfileMenu');trigger.setAttribute('aria-label','Account options');
 const identity=make('span','studio-profile-identity');identity.append(name,make('small','','Signed in'));const chevron=make('span','studio-profile-chevron');chevron.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m7 10 5 5 5-5"/></svg>';trigger.append(avatar,identity,chevron);profile.append(trigger);
 const menuPanel=make('div','studio-profile-menu');menuPanel.id='studioProfileMenu';menuPanel.hidden=true;const profileLabel=make('div','studio-profile-label','Signed-in account');menuPanel.append(profileLabel);
 function close(focus=false){menuPanel.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
 function action(label,fn,destructive=false){const b=make('button',destructive?'studio-profile-action studio-profile-danger':'studio-profile-action',label);b.type='button';b.onclick=()=>{close();fn();};menuPanel.append(b);}
 action('Settings',()=>$('v3Settings').click());action('Switch shared account',()=>$('apexSharedAccountSignIn').click());action('Sign out',()=>$('sidebarUser').click(),true);
 document.querySelector('#apexSidebar .evo-utilities').append(profile);$('appPage').append(menuPanel);
 // The original sign-out node remains for account-settings and unsaved-change confirmation.
 $('sidebarUser').hidden=true;$('sidebarUser').setAttribute('aria-hidden','true');$('sidebarUser').tabIndex=-1;
 function positionMenu(){const rect=trigger.getBoundingClientRect();menuPanel.style.left=Math.max(8,rect.left)+'px';menuPanel.style.bottom=Math.max(8,window.innerHeight-rect.top+8)+'px';}
 trigger.onclick=()=>{if(menuPanel.hidden){positionMenu();menuPanel.hidden=false;trigger.setAttribute('aria-expanded','true');}else close();};
 window.addEventListener('resize',()=>{if(!menuPanel.hidden)positionMenu();});
 document.addEventListener('click',e=>{if(!profile.contains(e.target)&&!menuPanel.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menuPanel.hidden){e.stopPropagation();close(true);}});
 const login=$('loginForm');let identifier='';
 login.addEventListener('submit',()=>{identifier=($('apexCloudCredentials').classList.contains('hidden')?$('loginUser').value:$('loginCloudEmail').value).trim();},true);
 const app=$('appPage');new MutationObserver(()=>{if(app.classList.contains('hidden')){close();draft={...saved};refresh();return;}if(identifier){const display=identifier.split('@')[0].slice(0,48);name.textContent=display;avatar.textContent=display.slice(0,2).toUpperCase();profileLabel.textContent=identifier.slice(0,120);}}).observe(app,{attributes:true,attributeFilter:['class']});
 const logo=make('img','studio-brand-icon');logo.src='assets/apex-logo.svg';logo.alt='APEX';logo.width=32;logo.height=32;document.querySelector('#apexSidebar .evo-wordmark')?.prepend(logo);
})();
