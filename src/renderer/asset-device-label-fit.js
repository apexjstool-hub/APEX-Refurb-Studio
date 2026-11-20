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
  const highDensity=present.length>=4;
  const suggested=highDensity?'60x40':present.length>=3?'50x30':size;
  const tooSmall=highDensity&&height<30||present.length>=3&&height<25.4;
  return {tooSmall,suggested,fields:present.length,paper:`${width} × ${height} mm`};
 }
 function fits(sheet){
  const stock=sheet?.querySelector?.('.apex-device-barcode-label');if(!stock)return {ok:false,error:'Asset label markup is unavailable.'};
  // Note: the label is intentionally fixed in millimetres, and overflow stays visible
  // until validation; never treat clipped/hidden text as a successful label.
  const box=stock.getBoundingClientRect(),parts=[...stock.querySelectorAll('.apex-barcode-image,.apex-barcode-human,.apex-device-label-name,.apex-device-label-detail')];
  const overflow=parts.some(part=>{
   const r=part.getBoundingClientRect();
   return r.top<box.top-.75||r.bottom>box.bottom+.75||r.left<box.left-.75||r.right>box.right+.75
      ||part.scrollHeight>part.clientHeight+1||part.scrollWidth>part.clientWidth+1;
  });
  const detail=stock.querySelector('.apex-device-label-details');
  return {ok:!overflow&&(!detail||detail.scrollHeight<=detail.clientHeight+1)&&stock.scrollHeight<=stock.clientHeight+1,
   error:'These specifications do not fit at a legible size. Choose 60 × 40 mm or a larger label, select Compact text, or remove a field.'};
 }
 function fit(sheet){
  const stock=sheet?.querySelector?.('.apex-device-barcode-label');
  if(!stock)return {ok:false,error:'No device asset label is available.'};
  // Maintain a minimum readable size. The Code 128 SVG geometry is never resized.
  const details=[...stock.querySelectorAll('.apex-device-label-detail')];
  const model=stock.querySelector('.apex-device-label-name');
  const id=stock.querySelector('.apex-barcode-human');
  const minimum=new Map(details.map(el=>[el,8.8])); // 6.6 pt floor
  if(model)minimum.set(model,10.7); // 8 pt floor
  if(id)minimum.set(id,13.35); // 10 pt floor
  let check=fits(sheet);
  for(let attempt=0;!check.ok&&attempt<12;attempt++){
   let changed=false;
   for(const el of [...details,model,id].filter(Boolean)){
    const current=parseFloat(getComputedStyle(el).fontSize),limit=minimum.get(el);
    if(current>limit+.1){el.style.fontSize=Math.max(limit,current-.6)+'px';changed=true;}
   }
   if(!changed)break;
   check=fits(sheet);
  }
  return check;
 }
 return Object.freeze({sizes,options,recommendation,fit,fits});
});
