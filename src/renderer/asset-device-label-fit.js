'use strict';
/* Shared by live preview and print/PDF document. Never scales a machine-readable barcode. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.ApexDeviceLabelFit=api;
})(typeof window!=='undefined'?window:null,function(){
 const fields=['serial','processor','ram','storage','condition'];
 const sizes={'2x1':[50.8,25.4],'50x25':[50,25],'50x30':[50,30],'60x40':[60,40],'40x30':[40,30],'80x30':[80,30]};
 function options(raw={}){
  return {fields:[...new Set(Array.isArray(raw.fields)?raw.fields.filter(f=>fields.includes(f)):[])],
   barcodeHeight:['small','medium','large'].includes(raw.barcodeHeight)?raw.barcodeHeight:'medium',
   detailSize:['compact','normal','large'].includes(raw.detailSize)?raw.detailSize:'normal',
   align:raw.align==='left'?'left':'center'};
 }
 function recommendation(size,record={},raw={}){
  const [width,height]=sizes[size]||sizes['2x1'],o=options(raw);
  const present=o.fields.filter(k=>String(record[k]||'').trim());
  // Selection count alone must never flag 2x1 stock as unprintable.
  // The actual DOM fit and printer-module checks decide if it is safe.
  const tooSmall=false;
  const suggested=size;
  return {tooSmall,suggested,fields:present.length,paper:`${width} × ${height} mm`};
 }
 function fits(sheet){
  const stock=sheet?.querySelector?.('.apex-device-barcode-label');
  if(!stock)return {ok:false,error:'Asset label markup is unavailable.'};
  // Physical barcode module width is never reduced to force a fit.
  const dots=Number(stock.dataset.moduleDots||0);
  if(dots>0&&dots<2)return {ok:false,error:'The barcode is only one printer dot per narrow bar. Choose a wider label (such as 80 × 30 mm) or a shorter asset number for reliable scanning.'};
  const box=stock.getBoundingClientRect(),tolerance=1;
  const parts=[...stock.querySelectorAll('.apex-barcode-image,.apex-barcode-human,.apex-device-label-name,.apex-device-label-detail')];
  const overflow=parts.some(part=>{
   const r=part.getBoundingClientRect();
   return r.top<box.top-tolerance||r.bottom>box.bottom+tolerance||r.left<box.left-tolerance||r.right>box.right+tolerance
      ||part.scrollHeight>part.clientHeight+tolerance||part.scrollWidth>part.clientWidth+tolerance;
  });
  const detail=stock.querySelector('.apex-device-label-details');
  return {ok:!overflow&&(!detail||detail.scrollHeight<=detail.clientHeight+tolerance)&&stock.scrollHeight<=stock.clientHeight+tolerance,
   error:'The selected details genuinely overflow this label. Try shorter values, compact details, or a larger label. The barcode will not be distorted.'};
 }
 function fit(sheet){
  const stock=sheet?.querySelector?.('.apex-device-barcode-label');
  if(!stock)return {ok:false,error:'No device asset label is available.'};
  const small=['2x1','50x25'].includes(stock.dataset.size);
  const details=[...stock.querySelectorAll('.apex-device-label-detail')];
  const model=stock.querySelector('.apex-device-label-name');
  const id=stock.querySelector('.apex-barcode-human');
  const text=[...details,model,id].filter(Boolean);
  const minimum=new Map(details.map(el=>[el,small?7.1:8.8]));
  if(model)minimum.set(model,small?8.1:10.7);
  if(id)minimum.set(id,small?9.1:13.35);
  const reduceText=()=>{
   let changed=false;
   for(const el of text){
    const current=parseFloat(getComputedStyle(el).fontSize),limit=minimum.get(el);
    if(Number.isFinite(current)&&current>limit+.1){
     el.style.fontSize=Math.max(limit,current-.4)+'px';changed=true;
    }
   }
   return changed;
  };
  // Try the real, unsqueezed print layout first, then tighter row spacing,
  // then a modest barcode HEIGHT reduction (never barcode width).
  // The exact same function is called in live preview and the print/PDF page.
  stock.removeAttribute('data-fit-stage');
  const stages=small?['normal','compact','tight']:['normal','compact'];
  for(const stage of stages){
   stock.dataset.fitStage=stage;
   for(let attempt=0;attempt<25;attempt++){
    const check=fits(sheet);
    if(check.ok)return check;
    if(/one printer dot/.test(check.error))return check;
    if(!reduceText())break;
   }
  }
  return fits(sheet);
 }
 return Object.freeze({sizes,options,recommendation,fit,fits});
});
