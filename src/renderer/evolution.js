'use strict';
/* Evolution presentation components. Move the original live nodes instead of
   cloning controls: original IDs, event handlers, routing and IPC stay intact. */
(()=>{
 const $=id=>document.getElementById(id), shell=$('appPage'), side=$('apexSidebar');
 const make=(tag,cls)=>Object.assign(document.createElement(tag),{className:cls});
 const nav=make('div','evo-navigation');const brand=make('div','evo-brand');
 const originalBrand=side.querySelector('.sidebar-header');brand.append(originalBrand);
 const mark=make('div','evo-wordmark');mark.innerHTML='<span>APEX<span class="evo-mark-dot">.</span></span><small>MANAGEMENT STUDIO</small>';brand.append(mark);
 const menu=make('div','evo-menu');
 const label=(name)=>{const el=make('div','evo-nav-label');el.textContent=name;return el;};
 [...side.querySelectorAll('.menu')].forEach((m,i)=>{menu.append(label(i?'TOOLS & PRINTING':'WORKSPACE'),m);});
 const utilities=make('div','evo-utilities');utilities.append(side.querySelector('.v3-utilities'),$('sidebarUser'));
 const shared=$('apexSharedAccountPanel'),hub=$('hubSettings');
 const connection=make('div','evo-settings-connection');
 const heading=make('strong','evo-connection-heading');heading.textContent='Shared inventory & local hub';
 connection.append(heading,hub);shared.append(connection);
 utilities.prepend(label('ADMINISTRATION'));nav.append(brand,menu,utilities);side.append(nav);
 const demo=make('div','evo-demo');demo.innerHTML='<span class="evo-demo-dot"></span><b>Evolution edition</b><span>4.4.55</span>';document.querySelector('.topbar .top-left').append(demo);
 const top=$('v3Topline');top.classList.add('evo-workspace-header');
 // Keep the live workspace tabs and their history/close/add handlers; place in unused topbar space.
 const openTabs=$('apexWorkspaceTabs');if(openTabs){document.querySelector('.topbar .top-left').append(openTabs);openTabs.classList.add('evo-docked-tabs');}
 const inv=$('inventoryPage'),intro=inv.querySelector('.page-intro'),count=inv.querySelector('.inventory-overview'),panel=inv.querySelector('.section-panel');
 const register=make('div','evo-register-head');inv.prepend(register);register.append(intro,count);count.classList.add('evo-register-count');
 // The workspace title, header actions and inventory results already contain the same information.
 // Hide the duplicate title card only if there are no interactive controls left inside it.
 if(!register.querySelector('button,input,select,textarea,a[href]'))register.classList.add('evo-redundant-register');
 const filters=$('inventorySearch')?.closest('.section-panel-head')||$('inventorySearch')?.closest('.toolbar')?.parentElement;filters?.classList.add('evo-filterbar');
 const chip=make('span','evo-register-tag');chip.textContent='INVENTORY / ASSET REGISTER';intro.firstElementChild.prepend(chip);
 // Keep filter fields and their handlers; the header is reorganised into two rows.
 const settings=$('settingsPage'),adminIntro=settings.querySelector('.apex-admin-intro'),links=adminIntro.querySelector('.apex-admin-links');
 const layout=make('div','evo-settings-layout'),rail=make('aside','evo-settings-rail'),body=make('div','evo-settings-body');
 const title=make('strong','evo-settings-title');title.textContent='Settings index';rail.append(title,links);
 [...settings.children].filter(n=>n!==adminIntro).forEach(n=>body.append(n));layout.append(rail,body);settings.append(layout);
 // Apply a consistent page masthead without changing section visibility or tab logic.
 [...document.querySelectorAll('.content>section')].forEach((page,i)=>{const h=page.querySelector(':scope > .page-intro,:scope > .rw-heading,:scope > .apex-connect-page-intro');if(h){h.classList.add('evo-page-head');h.dataset.sectionIndex=String(i+1).padStart(2,'0');}});
 const asset=$('assetPage');asset.classList.add('evo-asset-workspace');
 // Reuse the live actions: do not clone them or replace their permission/confirmation handlers.
 const assetTabs=$('v3AssetTabs'), actions=asset.querySelector('.v3-delete-wrap');
 const infoHeader=asset.querySelector('#apexAssetDetailsSection .flat-editor-heading');
 if(assetTabs&&actions&&infoHeader){
  actions.classList.add('evo-asset-data-actions');
  const hint=$('assetEditedHint');if(hint){hint.hidden=true;hint.setAttribute('aria-hidden','true');}
  const dockAssetActions=()=>{
   const overview=!asset.dataset.section||asset.dataset.section==='overview';
   if(overview){if(actions.parentElement!==infoHeader)infoHeader.append(actions);}
   else if(actions.previousElementSibling!==assetTabs)assetTabs.after(actions);
  };
  dockAssetActions();
  new MutationObserver(dockAssetActions).observe(asset,{attributes:true,attributeFilter:['data-section']});
 }

})();
