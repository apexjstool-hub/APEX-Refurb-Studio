'use strict';
/* Visual appearance selection only — never changes inventory, jobs, Supabase or routes.
   Heritage Refined (default) follows the user's preferred original dark APEX layout.
   One button cycles Heritage -> Concept B -> Classic -> Heritage. */
(function(){
 const key='apex-ui-concept-v2';
 const previousThemeKey='apex-concept-b-previous-theme-v1';
 const $=id=>document.getElementById(id);
 const get=(k,fallback)=>{try{return localStorage.getItem(k)||fallback;}catch{return fallback;}};
 const put=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
 const options=['heritage','minimal','classic'];
 let design=options.includes(get(key,'heritage'))?get(key,'heritage'):'heritage';
 function renderButton(){
  const button=$('apexDesignSwitch');
  if(!button)return;
  const label=button.querySelector('.apex-design-label');
  const next=options[(options.indexOf(design)+1)%options.length];
  const names={heritage:'Classic Refined',minimal:'Concept B',classic:'Original Classic'};
  if(label)label.textContent=design==='heritage'?'Try Concept B':design==='minimal'?'Original Classic':'Classic Refined';
  button.setAttribute('aria-label','Current appearance: '+names[design]+'. Switch to '+names[next]);
  button.setAttribute('aria-pressed',String(design!=='classic'));
  button.title='Current: '+names[design]+' · Click for '+names[next];
 }
 function apply(next){
  design=options.includes(next)?next:'heritage';
  document.documentElement.dataset.apexDesign=design;
  put(key,design);
  if(design==='minimal'){
   document.documentElement.dataset.theme='light';
  }else if(design==='heritage'){
   document.documentElement.dataset.theme='dark';
  }else{
   const theme=get(previousThemeKey,get('apex-inventory-appearance-v1','dark'));
   document.documentElement.dataset.theme=theme==='light'?'light':'dark';
  }
  renderButton();
 }
 // Existing theme setup executes earlier. A new key lets previous beta choices
 // remain intact if the user reinstalls v4.1.07.
 apply(design);
 $('apexDesignSwitch')?.addEventListener('click',()=>{
  apply(options[(options.indexOf(design)+1)%options.length]);
 });
 // Existing light/dark toggle stays functional and switches to the original
 // Classic mode rather than mixing an incompatible light theme with Heritage.
 $('topTheme')?.addEventListener('click',()=>{
  if(design!=='classic'){
   design='classic';
   document.documentElement.dataset.apexDesign='classic';
   put(key,'classic');
   renderButton();
  }
 });
})();
