'use strict';
window.apexLabelReady=(async()=>{
 try{
  const payload=JSON.parse(new URLSearchParams(location.search).get('label')||'null');
  if(!payload||!APEX_LABEL_SIZES[payload.size]||!['asset','refurb'].includes(payload.type)||![203,300,600].includes(payload.dpi))throw Error('Invalid label settings.');
  const [w,h]=APEX_LABEL_SIZES[payload.size];
  const root=document.documentElement;root.dataset.preview=String(payload.preview===true);root.dataset.size=payload.size;root.style.setProperty('--label-width',w+'mm');root.style.setProperty('--label-height',h+'mm');
  const sizeLink=document.getElementById('labelPageSize');
  const loaded=new Promise((resolve,reject)=>{sizeLink.onload=resolve;sizeLink.onerror=()=>reject(Error('Label paper stylesheet could not load.'));});
  sizeLink.href='asset-label-size-'+payload.size+'.css';
  const sheet=document.getElementById('labelSheet');sheet.innerHTML=makeLabelMarkup(payload.record,payload.type,payload.size,payload.dpi);
  await loaded;await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  // Fit only the human text; never stretch or shrink a machine-readable code.
  const fits=()=>{const copy=sheet.querySelector('.apex-label-copy');const human=sheet.querySelector('.apex-barcode-human');return copy?copy.scrollHeight<=sheet.clientHeight-8:human.scrollWidth<=human.clientWidth;};
  const texts=[...sheet.querySelectorAll('.apex-label-asset,.apex-label-name,.apex-barcode-human')];
  while(!fits()){
   let changed=false;for(const el of texts){const px=parseFloat(getComputedStyle(el).fontSize);if(px>8){el.style.fontSize=Math.max(8,px-.5)+'px';changed=true;}}
   if(!changed)throw Error('Device text does not fit. Choose a larger label.');
  }
  if(payload.preview){
   const resize=()=>{const scale=Math.min(innerWidth/(w*96/25.4),innerHeight/(h*96/25.4));sheet.style.transformOrigin='top left';sheet.style.transform='scale('+scale+')';};
   window.apexResizeLabelPreview=resize;resize();window.addEventListener('resize',resize);
  }
 }catch(error){window.apexLabelError=error.message;document.getElementById('labelSheet').textContent=error.message;}
})();


