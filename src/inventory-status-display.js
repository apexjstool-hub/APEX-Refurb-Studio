'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexInventoryStatusDisplay=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const cosmetic=name=>/respray|re[ -]?spray|paint/i.test(String(name||''));
 function compose(summary,age){
  const s=summary||{},parts=Array.isArray(s.parts)?s.parts:[],replacement=parts.filter(p=>!cosmetic(p.name)),spray=parts.filter(p=>cosmetic(p.name));
  const badges=[];
  const required=replacement.reduce((n,p)=>n+(Number(p.required)||0),0);
  const fitted=replacement.reduce((n,p)=>n+(Number(p.fitted)||0),0);
  if(['completed','hold'].includes(s.key)){
   badges.push({tone:s.key,label:s.key==='completed'?'Completed':'On hold'});
  }else if(replacement.length){
   if(s.needsOrdering>0)badges.push({tone:'order',label:'Needs ordering'});
   else if(s.awaitingDelivery>0)badges.push({tone:'delivery',label:'Parts ordered'});
   else if(required>0&&fitted>=required)badges.push({tone:'fitted',label:'Parts fitted'});
   else if(replacement.some(p=>(Number(p.toFit)||0)>0))badges.push({tone:'fit',label:fitted>0?'Parts fitting':'Ready to fit'});
   else badges.push({tone:'qc',label:'Parts pending review'});
  }
  if(s.key!=='completed'&&spray.length){
   const outstanding=spray.some(p=>(Number(p.fitted)||0)<(Number(p.required)||0));
   if(outstanding){
    if(s.resprayStatus==='Sent for Respray')badges.push({tone:'respray-sent',label:'Sent for respray'});
    else if(s.resprayStatus==='Respray Returned')badges.push({tone:'respray-returned',label:'Respray returned'});
    else badges.push({tone:'respray',label:'Needs respray'});
   }else badges.push({tone:'respray-complete',label:'Respray complete'});
  }
  if(!badges.length)badges.push({tone:s.key||'none',label:s.stage||'No refurb job'});
  // Keep age as subtle supporting text, not a competing full-width status.
  const waiting=badges.some(b=>b.tone==='order')&&Number.isFinite(age)&&age>=0?age+'d awaiting order':'';
  return {badges,waiting};
 }
 return {compose};
});
