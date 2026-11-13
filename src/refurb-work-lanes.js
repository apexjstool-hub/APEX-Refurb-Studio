'use strict';
/* APEX Refurbishment work lanes: read-only projections of ONE shared job per asset.
   Never clone, edit or persist asset records. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ApexRefurbLanes=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const cosmetic=name=>/\b(?:respray|re[ -]?spray|repaint|re[ -]?paint|painting|paint)\b/i.test(String(name||'').replace(/[_–—]/g,' '));
 const number=v=>Math.max(0,Number(v)||0);
 function project(row,kind){
  const src=row?.summary?.parts||[],wanted=kind==='respray';
  const parts=src.filter(p=>cosmetic(p.name)===wanted);
  if(!parts.length)return null;
  const outstanding=parts.filter(p=>number(p.fitted)<number(p.required??p.qty));
  if(!outstanding.length)return null;
  const qty=field=>parts.reduce((n,p)=>n+number(p[field]),0);
  const required=qty('required'),fitted=qty('fitted'),received=qty('received'),awaiting=qty('awaiting'),toOrder=qty('toOrder');
  let status,next;
  if(wanted){
   const stage=row.summary.resprayStatus||'';
   if(stage==='Sent for Respray'){status='Sent for respray';next='Await pallet return';}
   else if(stage==='Respray Returned'){status='Respray returned';next='Inspect and complete respray';}
   else if(received>fitted){status='Respray returned';next='Inspect and mark work completed';}
   else if(awaiting>0){status='Sent for respray';next='Await return';}
   else{status='Needs respray';next='Arrange respray';}
  }else{
   if(toOrder>0&&row.job?.partsBoard!=='ordered'){status='Needs ordering';next='Order replacement parts';}
   else if(awaiting>0||row.job?.partsBoard==='ordered'){status='Parts ordered';next='Await parts delivery';}
   else if(received>fitted){status='Ready to fit';next='Fit received parts';}
   else{status='Needs review';next='Review part requirements';}
  }
  return {assetId:row.job.assetId,kind,parts,status,next,required,fitted,received,awaiting,toOrder,pallet:row.asset?.pallet||'',location:row.asset?.location||'',job:row.job,asset:row.asset};
 }
 function lanes(rows=[]){
  const parts=[],respray=[],both=[];
  for(const row of rows){
   if(!row?.job||row.job.status==='Completed'||row.job.status==='On Hold')continue;
   const physical=project(row,'parts'),cosmetics=project(row,'respray');
   if(physical)parts.push(physical);
   if(cosmetics)respray.push(cosmetics);
   if(physical&&cosmetics)both.push(row.job.assetId);
  }
  return {parts,respray,both};
 }
 return Object.freeze({cosmetic,project,lanes});
});
