'use strict';
/* Presentation classification only: original IDs, names and quantities are never rewritten. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexRepairWork=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const normal=name=>String(name||'').toLowerCase().replace(/[–—_-]/g,' ').replace(/\s+/g,' ').trim();
 const isCosmetic=name=>/\b(?:respray|re spray|repaint|re paint|paint|painting)\b/.test(normal(name));
 // Smart Key is a recorded service/requirement, not a replacement part.
 // Match only the full phrase: Smart Keyboard must remain an ordinary keyboard part.
 const isSmartKey=name=>/\bsmart\s*key\b/.test(normal(name));
 const isReplacement=name=>!isCosmetic(name)&&!isSmartKey(name);
 function bundledKeyboard(name){
  const tasks=normal(name).split(/\s*(?:\+|&|\band\b)\s*/).filter(Boolean);
  return tasks.length>1&&tasks.some(isCosmetic)&&tasks.some(t=>/^(?:(?:new|replacement) )?(?:(?:uk|united kingdom|british) )?keyboard(?: replacement)?$/.test(t));
 }
 function split(parts=[]){return {replacement:parts.filter(p=>isReplacement(p.name)),cosmetic:parts.filter(p=>isCosmetic(p.name)),other:parts.filter(p=>isSmartKey(p.name)),bundled:parts.filter(p=>bundledKeyboard(p.name))};}
 return {isCosmetic,isSmartKey,isReplacement,bundledKeyboard,split};
});
