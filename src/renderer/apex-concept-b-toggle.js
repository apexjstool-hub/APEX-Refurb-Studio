'use strict';
/* Visual design preference only; rollback never changes inventory/cloud data. */
(function(){
 const key='apex-ui-concept-v1';
 const previousThemeKey='apex-concept-b-previous-theme-v1';
 const $=id=>document.getElementById(id);
 const get=(k,fallback)=>{try{return localStorage.getItem(k)||fallback;}catch{return fallback;}};
 const put=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
 let design=get(key,'minimal')==='classic'?'classic':'minimal';
 function renderButton(){
  const button=$('apexDesignSwitch');
  if(!button)return;
  const label=button.querySelector('.apex-design-label');
  if(label)label.textContent=design==='minimal'?'Classic UI':'Try Concept B';
  button.setAttribute('aria-pressed',String(design==='minimal'));
  button.title=design==='minimal'?'Revert to original APEX appearance without changing any records':'Switch to Concept B light design';
 }
 function apply(next){
  design=next==='classic'?'classic':'minimal';
  document.documentElement.dataset.apexDesign=design;
  put(key,design);
  if(design==='minimal'){
   if(document.documentElement.dataset.theme==='dark')put(previousThemeKey,'dark');
   document.documentElement.dataset.theme='light';
  }else{
   const theme=get(previousThemeKey,get('apex-inventory-appearance-v1','light'));
   if(theme==='light'||theme==='dark')document.documentElement.dataset.theme=theme;
  }
  renderButton();
 }
 // Existing app theme setter executes before this script.
 apply(design);
 $('apexDesignSwitch')?.addEventListener('click',()=>apply(design==='minimal'?'classic':'minimal'));
 // Concept B is a light theme: choosing Dark mode switches to Classic
 // while retaining the user's selected appearance setting.
 $('topTheme')?.addEventListener('click',()=>{
  if(design==='minimal'){design='classic';put(key,'classic');document.documentElement.dataset.apexDesign='classic';renderButton();}
 });
})();
