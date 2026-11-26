'use strict';
/* APEX Design System 4.4.33 — accessible async dialogs; never block Electron. */
(function(root){
 const queue=[];let active=null,previousFocus=null,sequence=0;
 const layer=document.createElement('div');
 layer.id='apexDialogLayer';layer.className='apex-dialog-layer';layer.hidden=true;
 layer.innerHTML='<div class="apex-dialog-backdrop"></div><section class="apex-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="apexDialogTitle" aria-describedby="apexDialogDescription" tabindex="-1"><div class="apex-dialog-heading"><span id="apexDialogIcon" class="apex-dialog-icon" aria-hidden="true"></span><div class="apex-dialog-titles"><div class="apex-dialog-kicker">APEX MANAGEMENT STUDIO</div><h2 id="apexDialogTitle"></h2></div><button id="apexDialogClose" type="button" class="apex-dialog-close" aria-label="Cancel and close">×</button></div><p id="apexDialogDescription" class="apex-dialog-description"></p><label id="apexDialogInputWrap" class="apex-dialog-input-label" hidden><span id="apexDialogInputLabel">Your response</span><input id="apexDialogInput" type="text" maxlength="200" autocomplete="off"></label><div id="apexDialogValidation" class="apex-dialog-validation" role="alert" hidden></div><div class="apex-dialog-buttons"><button type="button" id="apexDialogCancel" class="apex-dialog-cancel">Cancel</button><button type="button" id="apexDialogAccept" class="apex-dialog-accept">Continue</button></div></section>';
 document.body.append(layer);
 const $=id=>document.getElementById(id);
 const panel=layer.querySelector('.apex-dialog-panel');
 const icon=$('apexDialogIcon'),title=$('apexDialogTitle'),description=$('apexDialogDescription');
 const input=$('apexDialogInput'),inputWrap=$('apexDialogInputWrap'),inputLabel=$('apexDialogInputLabel');
 const validation=$('apexDialogValidation'),cancel=$('apexDialogCancel'),accept=$('apexDialogAccept');
 const sanitize=s=>String(s??'').slice(0,4000);
 const infer=message=>{
  if(/delete|remove|clear|discard|revoke|permanent|wipe|reset/i.test(message))return {tone:'danger',title:/conversation/i.test(message)?'Delete conversation?':/message/i.test(message)?'Delete message?':'Confirm deletion'};
  if(/unsaved|without saving|leave this asset/i.test(message))return {tone:'warning',title:'Discard unsaved changes?'};
  if(/sign out|logout/i.test(message))return {tone:'warning',title:'Sign out of APEX?'};
  if(/install|restart|update/i.test(message))return {tone:'warning',title:'Confirm update'};
  if(/print/i.test(message))return {tone:'info',title:'Confirm printing'};
  return {tone:'warning',title:'Confirm action'};
 };
 const focusable=()=>[...panel.querySelectorAll('button,input:not([hidden])')].filter(e=>!e.disabled&&!e.closest('[hidden]'));
 function next(){
  if(active||!queue.length)return;
  active=queue.shift();previousFocus=document.activeElement;
  const o=active.options;const inferred=infer(o.message);
  const tone=['danger','warning','info','success'].includes(o.tone)?o.tone:inferred.tone;
  layer.dataset.tone=tone;icon.textContent=tone==='danger'?'!':tone==='success'?'✓':tone==='warning'?'!':'i';
  title.textContent=sanitize(o.title||inferred.title);
  description.textContent=sanitize(o.message);
  validation.hidden=true;validation.textContent='';
  inputWrap.hidden=o.kind!=='prompt';
  input.type=o.inputType==='password'?'password':'text';
  input.value=String(o.defaultValue??'').slice(0,200);
  input.maxLength=Math.max(1,Math.min(200,Number(o.maxLength)||200));
  inputLabel.textContent=sanitize(o.inputLabel||'Enter a value');
  accept.textContent=sanitize(o.confirmLabel||(o.kind==='alert'?'OK':o.kind==='prompt'?'Save':tone==='danger'?'Delete':'Continue'));
  cancel.hidden=o.kind==='alert';
  cancel.textContent=sanitize(o.cancelLabel||'Cancel');
  accept.classList.toggle('apex-dialog-danger',tone==='danger');
  layer.hidden=false;
  root.requestAnimationFrame?.(()=>{layer.classList.add('is-open');(o.kind==='prompt'?input:(tone==='danger'&&o.kind==='confirm'?cancel:accept)).focus();});
  if(!root.requestAnimationFrame){layer.classList.add('is-open');(o.kind==='prompt'?input:cancel).focus();}
 }
 function settle(value){
  if(!active)return;
  const resolve=active.resolve;active=null;
  layer.classList.remove('is-open');layer.hidden=true;input.value='';
  previousFocus?.focus?.();previousFocus=null;
  resolve(value);next();
 }
 function submit(){
  if(!active)return;
  if(active.options.kind==='prompt'){
   const val=input.value;
   if(active.options.required&&!val.trim()){validation.textContent='Please enter a value.';validation.hidden=false;input.focus();return;}
   settle(val);
  }else settle(true);
 }
 accept.addEventListener('click',submit);
 cancel.addEventListener('click',()=>settle(active?.options.kind==='prompt'?null:false));
 $('apexDialogClose').addEventListener('click',()=>settle(active?.options.kind==='prompt'?null:false));
 layer.addEventListener('keydown',e=>{
  if(!active)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();settle(active.options.kind==='prompt'?null:false);}
  if(e.key==='Enter'&&(e.target.tagName==='INPUT'||e.target.tagName==='BUTTON')){if(e.target===cancel||e.target===$('apexDialogClose'))return;e.preventDefault();submit();}
  if(e.key==='Tab'){
   const all=focusable();if(!all.length)return;
   const first=all[0],last=all.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
 });
 // Cancel pending requests when APEX signs out: modal cannot leak between accounts.
 function show(options){
  return new Promise(resolve=>{queue.push({options:{...options,kind:options.kind||'confirm'},resolve,id:++sequence});next();});
 }
 root.ApexDialogs=Object.freeze({
  confirm:(message,options={})=>show({...options,message,kind:'confirm'}),
  alert:(message,options={})=>show({...options,message,kind:'alert'}),
  prompt:(message,options={})=>show({...options,message,kind:'prompt'}),
  close:()=>{if(active)settle(active.options.kind==='prompt'?null:false);},
  isOpen:()=>!layer.hidden
 });
 root.apexConfirm=(message,options)=>root.ApexDialogs.confirm(message,options);
 root.apexAlert=(message,options)=>root.ApexDialogs.alert(message,options);
 root.apexPrompt=(message,options)=>root.ApexDialogs.prompt(message,options);
})(window);
