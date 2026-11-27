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
 ['appearance','Layout & appearance','Choose your interface layout and light or dark mode.'],
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
 append('updates',direct('apexUpdateCentre'));append('appearance',direct('apexDesignPreference'));
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
 function prefs(id,key,attr,choices){
  const card=make('div','studio-preference-card');const label=make('label','studio-pref-label',id==='fonts'?'Interface font':'Accent colour');const group=make('div','studio-pref-grid');group.setAttribute('role','group');group.setAttribute('aria-label',label.textContent);
  const controls=[];
  function select(value){if(!choices.some(c=>c[0]===value))value=choices[0][0];root.dataset[attr]=value;try{localStorage.setItem(key,value);}catch{}for(const [v,b] of controls)b.setAttribute('aria-pressed',String(v===value));}
  for(const [v,name,desc] of choices){const b=make('button','studio-pref-option');b.type='button';b.dataset.preference=v;b.append(make('strong','',name),make('small','',desc));b.onclick=()=>select(v);controls.push([v,b]);group.append(b);}
  card.append(label,group,make('p','studio-pref-note','Saved on this computer. No inventory or account data is changed.'));append(id,card);select(root.dataset[attr]||choices[0][0]);
 }
 prefs('fonts','apex-studio-font-v1','studioFont',[['original','APEX default','Original Inter / Jakarta combination'],['segoe','Segoe UI','Native Windows typography'],['inter','Inter','Clean, compact and readable'],['jakarta','Plus Jakarta Sans','Modern rounded typography'],['arial','Arial','Familiar and widely supported']]);
 prefs('colours','apex-studio-accent-v1','studioAccent',[['cobalt','Cobalt','Original Evolution blue'],['indigo','Indigo','Deep violet-blue'],['teal','Teal','Cool blue-green'],['slate','Slate','Restrained neutral accent']]);
 // Keep the existing theme button alive for login shortcut, but remove it from main toolbar.
 const theme=$('topTheme');theme.hidden=true;theme.setAttribute('aria-hidden','true');theme.tabIndex=-1;
 const actions=document.querySelector('.topbar .top-actions'),avatar=actions.querySelector('.top-avatar'),name=actions.querySelector('.header-username');
 const profile=make('div','studio-profile'),trigger=make('button','studio-profile-trigger');trigger.type='button';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','studioProfileMenu');trigger.setAttribute('aria-label','Account options');
 trigger.append(avatar,name,make('span','studio-profile-chevron','⌄'));profile.append(trigger);
 const menuPanel=make('div','studio-profile-menu');menuPanel.id='studioProfileMenu';menuPanel.hidden=true;const profileLabel=make('div','studio-profile-label','Signed-in account');menuPanel.append(profileLabel);
 function close(focus=false){menuPanel.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
 function action(label,fn,destructive=false){const b=make('button',destructive?'studio-profile-action studio-profile-danger':'studio-profile-action',label);b.type='button';b.onclick=()=>{close();fn();};menuPanel.append(b);}
 action('Settings',()=>$('v3Settings').click());action('Switch shared account',()=>$('apexSharedAccountSignIn').click());action('Sign out',()=>$('sidebarUser').click(),true);
 profile.append(menuPanel);actions.append(profile);
 // The original sign-out node remains for account-settings and unsaved-change confirmation.
 $('sidebarUser').hidden=true;$('sidebarUser').setAttribute('aria-hidden','true');$('sidebarUser').tabIndex=-1;
 trigger.onclick=()=>{if(menuPanel.hidden){menuPanel.hidden=false;trigger.setAttribute('aria-expanded','true');}else close();};
 document.addEventListener('click',e=>{if(!profile.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menuPanel.hidden){e.stopPropagation();close(true);}});
 const login=$('loginForm');let identifier='';
 login.addEventListener('submit',()=>{identifier=($('apexCloudCredentials').classList.contains('hidden')?$('loginUser').value:$('loginCloudEmail').value).trim();},true);
 const app=$('appPage');new MutationObserver(()=>{if(app.classList.contains('hidden')){close();return;}if(identifier){const display=identifier.split('@')[0].slice(0,48);name.textContent=display;avatar.textContent=display.slice(0,2).toUpperCase();profileLabel.textContent=identifier.slice(0,120);}}).observe(app,{attributes:true,attributeFilter:['class']});
 const logo=make('img','studio-brand-icon');logo.src='assets/apex-logo.svg';logo.alt='APEX';logo.width=32;logo.height=32;document.querySelector('#apexSidebar .evo-wordmark')?.prepend(logo);
})();
