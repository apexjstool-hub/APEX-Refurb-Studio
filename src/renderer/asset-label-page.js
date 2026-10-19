'use strict';
window.apexLabelReady=(async()=>{
 try{
  const payload=JSON.parse(new URLSearchParams(location.search).get('label')||'null');
  if(!payload||!APEX_LABEL_SIZES[payload.size]||!['asset','refurb','custom','qa'].includes(payload.type)||![203,300,600].includes(payload.dpi))throw Error('Invalid label settings.');
  if(payload.type==='custom'&&payload.template?.designerVersion===2&&(payload.template.size!==payload.size||Number(payload.template.dpi)!==payload.dpi))throw Error('Design and print settings do not match.');
  const [w,h]=APEX_LABEL_SIZES[payload.size];
  const root=document.documentElement;root.dataset.preview=String(payload.preview===true);root.dataset.size=payload.size;root.style.setProperty('--label-width',w+'mm');root.style.setProperty('--label-height',h+'mm');
  const sizeLink=document.getElementById('labelPageSize');
  const loaded=new Promise((resolve,reject)=>{sizeLink.onload=resolve;sizeLink.onerror=()=>reject(Error('Label paper stylesheet could not load.'));});
  sizeLink.href='asset-label-size-'+payload.size+'.css';
  const records=Array.isArray(payload.records)?payload.records:[payload.record];if(!records.length||records.length>300)throw Error('Invalid label count.');root.dataset.batch=String(records.length>1);
  const sheet=document.getElementById('labelSheet'),sheets=[sheet];for(let i=1;i<records.length;i++){const next=document.createElement('section');next.className='label-batch-sheet';sheet.parentElement.appendChild(next);sheets.push(next);}sheets.forEach((target,i)=>target.innerHTML=makeLabelMarkup(records[i],payload.type,payload.size,payload.dpi,payload));
  if(payload.type==='custom'&&payload.template?.designerVersion===2)for(const target of sheets)ApexLabelDesigner.applyLayout(target,payload.template);
  await loaded;await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  // Fit only the human text; never stretch or shrink a machine-readable code.
  for(const sheet of sheets){if(['custom','qa'].includes(payload.type))continue;const fits=()=>{const copy=sheet.querySelector('.apex-label-copy');const human=sheet.querySelector('.apex-barcode-human');return copy?copy.scrollHeight<=sheet.clientHeight-8:human.scrollWidth<=human.clientWidth;};
  const texts=[...sheet.querySelectorAll('.apex-label-asset,.apex-label-name,.apex-barcode-human')];
  while(!fits()){
   let changed=false;for(const el of texts){const px=parseFloat(getComputedStyle(el).fontSize);if(px>8){el.style.fontSize=Math.max(8,px-.5)+'px';changed=true;}}
   if(!changed)throw Error('Device text does not fit. Choose a larger label.');
  }
  }
  if(payload.type==='custom'&&payload.template?.designerVersion===2){for(const target of sheets){const errors=ApexLabelDesigner.problems(target);if(errors.length)throw Error(errors.join(' '));}}
  else if(['custom','qa'].includes(payload.type))for(const target of sheets){
   const fits=()=>{const box=target.getBoundingClientRect();return [...target.querySelectorAll('.apex-label-stock *')].every(el=>{const r=el.getBoundingClientRect();return r.left>=box.left-.6&&r.right<=box.right+.6&&r.top>=box.top-.6&&r.bottom<=box.bottom+.6&&el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1;});};
   for(let attempt=0;!fits()&&attempt<20;attempt++)for(const el of target.querySelectorAll('[data-label-fit]')){const px=parseFloat(getComputedStyle(el).fontSize);if(px>7)el.style.fontSize=Math.max(7,px-.5)+'px';}
   if(!fits())throw Error('Label content does not fit safely. Choose a larger paper size, fewer fields or shorter text.');
  }
  if(payload.preview){
   const resize=()=>{const scale=Math.min(innerWidth/(w*96/25.4),innerHeight/(h*96/25.4));sheet.style.transformOrigin='top left';sheet.style.transform='scale('+scale+')';};
   window.apexResizeLabelPreview=resize;resize();window.addEventListener('resize',resize);
  }
 }catch(error){window.apexLabelError=error.message;document.getElementById('labelSheet').textContent=error.message;}
})();



